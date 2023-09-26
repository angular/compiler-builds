/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ParseError, ParseSourceSpan } from '../parse_util';
import * as html from './ast';
import { NAMED_ENTITIES } from './entities';
import { tokenize } from './lexer';
import { getNsPrefix, mergeNsAndName, splitNsName } from './tags';
export class TreeError extends ParseError {
    static create(elementName, span, msg) {
        return new TreeError(elementName, span, msg);
    }
    constructor(elementName, span, msg) {
        super(span, msg);
        this.elementName = elementName;
    }
}
export class ParseTreeResult {
    constructor(rootNodes, errors) {
        this.rootNodes = rootNodes;
        this.errors = errors;
    }
}
export class Parser {
    constructor(getTagDefinition) {
        this.getTagDefinition = getTagDefinition;
    }
    parse(source, url, options) {
        const tokenizeResult = tokenize(source, url, this.getTagDefinition, options);
        const parser = new _TreeBuilder(tokenizeResult.tokens, this.getTagDefinition);
        parser.build();
        return new ParseTreeResult(parser.rootNodes, tokenizeResult.errors.concat(parser.errors));
    }
}
class _TreeBuilder {
    constructor(tokens, getTagDefinition) {
        this.tokens = tokens;
        this.getTagDefinition = getTagDefinition;
        this._index = -1;
        this._containerStack = [];
        this.rootNodes = [];
        this.errors = [];
        this._advance();
    }
    build() {
        while (this._peek.type !== 28 /* TokenType.EOF */) {
            if (this._peek.type === 0 /* TokenType.TAG_OPEN_START */ ||
                this._peek.type === 4 /* TokenType.INCOMPLETE_TAG_OPEN */) {
                this._consumeStartTag(this._advance());
            }
            else if (this._peek.type === 3 /* TokenType.TAG_CLOSE */) {
                this._consumeEndTag(this._advance());
            }
            else if (this._peek.type === 12 /* TokenType.CDATA_START */) {
                this._closeVoidElement();
                this._consumeCdata(this._advance());
            }
            else if (this._peek.type === 10 /* TokenType.COMMENT_START */) {
                this._closeVoidElement();
                this._consumeComment(this._advance());
            }
            else if (this._peek.type === 5 /* TokenType.TEXT */ || this._peek.type === 7 /* TokenType.RAW_TEXT */ ||
                this._peek.type === 6 /* TokenType.ESCAPABLE_RAW_TEXT */) {
                this._closeVoidElement();
                this._consumeText(this._advance());
            }
            else if (this._peek.type === 19 /* TokenType.EXPANSION_FORM_START */) {
                this._consumeExpansion(this._advance());
            }
            else if (this._peek.type === 24 /* TokenType.BLOCK_OPEN_START */) {
                this._closeVoidElement();
                this._consumeBlockOpen(this._advance());
            }
            else if (this._peek.type === 26 /* TokenType.BLOCK_CLOSE */) {
                this._closeVoidElement();
                this._consumeBlockClose(this._advance());
            }
            else {
                // Skip all other tokens...
                this._advance();
            }
        }
        for (const leftoverContainer of this._containerStack) {
            // Unlike HTML elements, blocks aren't closed implicitly by the end of the file.
            if (leftoverContainer instanceof html.Block) {
                this.errors.push(TreeError.create(leftoverContainer.name, leftoverContainer.sourceSpan, `Unclosed block "${leftoverContainer.name}"`));
            }
        }
    }
    _advance() {
        const prev = this._peek;
        if (this._index < this.tokens.length - 1) {
            // Note: there is always an EOF token at the end
            this._index++;
        }
        this._peek = this.tokens[this._index];
        return prev;
    }
    _advanceIf(type) {
        if (this._peek.type === type) {
            return this._advance();
        }
        return null;
    }
    _consumeCdata(_startToken) {
        this._consumeText(this._advance());
        this._advanceIf(13 /* TokenType.CDATA_END */);
    }
    _consumeComment(token) {
        const text = this._advanceIf(7 /* TokenType.RAW_TEXT */);
        const endToken = this._advanceIf(11 /* TokenType.COMMENT_END */);
        const value = text != null ? text.parts[0].trim() : null;
        const sourceSpan = endToken == null ?
            token.sourceSpan :
            new ParseSourceSpan(token.sourceSpan.start, endToken.sourceSpan.end, token.sourceSpan.fullStart);
        this._addToParent(new html.Comment(value, sourceSpan));
    }
    _consumeExpansion(token) {
        const switchValue = this._advance();
        const type = this._advance();
        const cases = [];
        // read =
        while (this._peek.type === 20 /* TokenType.EXPANSION_CASE_VALUE */) {
            const expCase = this._parseExpansionCase();
            if (!expCase)
                return; // error
            cases.push(expCase);
        }
        // read the final }
        if (this._peek.type !== 23 /* TokenType.EXPANSION_FORM_END */) {
            this.errors.push(TreeError.create(null, this._peek.sourceSpan, `Invalid ICU message. Missing '}'.`));
            return;
        }
        const sourceSpan = new ParseSourceSpan(token.sourceSpan.start, this._peek.sourceSpan.end, token.sourceSpan.fullStart);
        this._addToParent(new html.Expansion(switchValue.parts[0], type.parts[0], cases, sourceSpan, switchValue.sourceSpan));
        this._advance();
    }
    _parseExpansionCase() {
        const value = this._advance();
        // read {
        if (this._peek.type !== 21 /* TokenType.EXPANSION_CASE_EXP_START */) {
            this.errors.push(TreeError.create(null, this._peek.sourceSpan, `Invalid ICU message. Missing '{'.`));
            return null;
        }
        // read until }
        const start = this._advance();
        const exp = this._collectExpansionExpTokens(start);
        if (!exp)
            return null;
        const end = this._advance();
        exp.push({ type: 28 /* TokenType.EOF */, parts: [], sourceSpan: end.sourceSpan });
        // parse everything in between { and }
        const expansionCaseParser = new _TreeBuilder(exp, this.getTagDefinition);
        expansionCaseParser.build();
        if (expansionCaseParser.errors.length > 0) {
            this.errors = this.errors.concat(expansionCaseParser.errors);
            return null;
        }
        const sourceSpan = new ParseSourceSpan(value.sourceSpan.start, end.sourceSpan.end, value.sourceSpan.fullStart);
        const expSourceSpan = new ParseSourceSpan(start.sourceSpan.start, end.sourceSpan.end, start.sourceSpan.fullStart);
        return new html.ExpansionCase(value.parts[0], expansionCaseParser.rootNodes, sourceSpan, value.sourceSpan, expSourceSpan);
    }
    _collectExpansionExpTokens(start) {
        const exp = [];
        const expansionFormStack = [21 /* TokenType.EXPANSION_CASE_EXP_START */];
        while (true) {
            if (this._peek.type === 19 /* TokenType.EXPANSION_FORM_START */ ||
                this._peek.type === 21 /* TokenType.EXPANSION_CASE_EXP_START */) {
                expansionFormStack.push(this._peek.type);
            }
            if (this._peek.type === 22 /* TokenType.EXPANSION_CASE_EXP_END */) {
                if (lastOnStack(expansionFormStack, 21 /* TokenType.EXPANSION_CASE_EXP_START */)) {
                    expansionFormStack.pop();
                    if (expansionFormStack.length === 0)
                        return exp;
                }
                else {
                    this.errors.push(TreeError.create(null, start.sourceSpan, `Invalid ICU message. Missing '}'.`));
                    return null;
                }
            }
            if (this._peek.type === 23 /* TokenType.EXPANSION_FORM_END */) {
                if (lastOnStack(expansionFormStack, 19 /* TokenType.EXPANSION_FORM_START */)) {
                    expansionFormStack.pop();
                }
                else {
                    this.errors.push(TreeError.create(null, start.sourceSpan, `Invalid ICU message. Missing '}'.`));
                    return null;
                }
            }
            if (this._peek.type === 28 /* TokenType.EOF */) {
                this.errors.push(TreeError.create(null, start.sourceSpan, `Invalid ICU message. Missing '}'.`));
                return null;
            }
            exp.push(this._advance());
        }
    }
    _consumeText(token) {
        const tokens = [token];
        const startSpan = token.sourceSpan;
        let text = token.parts[0];
        if (text.length > 0 && text[0] === '\n') {
            const parent = this._getContainer();
            if (parent != null && parent.children.length === 0 &&
                this.getTagDefinition(parent.name).ignoreFirstLf) {
                text = text.substring(1);
                tokens[0] = { type: token.type, sourceSpan: token.sourceSpan, parts: [text] };
            }
        }
        while (this._peek.type === 8 /* TokenType.INTERPOLATION */ || this._peek.type === 5 /* TokenType.TEXT */ ||
            this._peek.type === 9 /* TokenType.ENCODED_ENTITY */) {
            token = this._advance();
            tokens.push(token);
            if (token.type === 8 /* TokenType.INTERPOLATION */) {
                // For backward compatibility we decode HTML entities that appear in interpolation
                // expressions. This is arguably a bug, but it could be a considerable breaking change to
                // fix it. It should be addressed in a larger project to refactor the entire parser/lexer
                // chain after View Engine has been removed.
                text += token.parts.join('').replace(/&([^;]+);/g, decodeEntity);
            }
            else if (token.type === 9 /* TokenType.ENCODED_ENTITY */) {
                text += token.parts[0];
            }
            else {
                text += token.parts.join('');
            }
        }
        if (text.length > 0) {
            const endSpan = token.sourceSpan;
            this._addToParent(new html.Text(text, new ParseSourceSpan(startSpan.start, endSpan.end, startSpan.fullStart, startSpan.details), tokens));
        }
    }
    _closeVoidElement() {
        const el = this._getContainer();
        if (el instanceof html.Element && this.getTagDefinition(el.name).isVoid) {
            this._containerStack.pop();
        }
    }
    _consumeStartTag(startTagToken) {
        const [prefix, name] = startTagToken.parts;
        const attrs = [];
        while (this._peek.type === 14 /* TokenType.ATTR_NAME */) {
            attrs.push(this._consumeAttr(this._advance()));
        }
        const fullName = this._getElementFullName(prefix, name, this._getClosestParentElement());
        let selfClosing = false;
        // Note: There could have been a tokenizer error
        // so that we don't get a token for the end tag...
        if (this._peek.type === 2 /* TokenType.TAG_OPEN_END_VOID */) {
            this._advance();
            selfClosing = true;
            const tagDef = this.getTagDefinition(fullName);
            if (!(tagDef.canSelfClose || getNsPrefix(fullName) !== null || tagDef.isVoid)) {
                this.errors.push(TreeError.create(fullName, startTagToken.sourceSpan, `Only void, custom and foreign elements can be self closed "${startTagToken.parts[1]}"`));
            }
        }
        else if (this._peek.type === 1 /* TokenType.TAG_OPEN_END */) {
            this._advance();
            selfClosing = false;
        }
        const end = this._peek.sourceSpan.fullStart;
        const span = new ParseSourceSpan(startTagToken.sourceSpan.start, end, startTagToken.sourceSpan.fullStart);
        // Create a separate `startSpan` because `span` will be modified when there is an `end` span.
        const startSpan = new ParseSourceSpan(startTagToken.sourceSpan.start, end, startTagToken.sourceSpan.fullStart);
        const el = new html.Element(fullName, attrs, [], span, startSpan, undefined);
        const parentEl = this._getContainer();
        this._pushContainer(el, parentEl instanceof html.Element &&
            this.getTagDefinition(parentEl.name).isClosedByChild(el.name));
        if (selfClosing) {
            // Elements that are self-closed have their `endSourceSpan` set to the full span, as the
            // element start tag also represents the end tag.
            this._popContainer(fullName, html.Element, span);
        }
        else if (startTagToken.type === 4 /* TokenType.INCOMPLETE_TAG_OPEN */) {
            // We already know the opening tag is not complete, so it is unlikely it has a corresponding
            // close tag. Let's optimistically parse it as a full element and emit an error.
            this._popContainer(fullName, html.Element, null);
            this.errors.push(TreeError.create(fullName, span, `Opening tag "${fullName}" not terminated.`));
        }
    }
    _pushContainer(node, isClosedByChild) {
        if (isClosedByChild) {
            this._containerStack.pop();
        }
        this._addToParent(node);
        this._containerStack.push(node);
    }
    _consumeEndTag(endTagToken) {
        const fullName = this._getElementFullName(endTagToken.parts[0], endTagToken.parts[1], this._getClosestParentElement());
        if (this.getTagDefinition(fullName).isVoid) {
            this.errors.push(TreeError.create(fullName, endTagToken.sourceSpan, `Void elements do not have end tags "${endTagToken.parts[1]}"`));
        }
        else if (!this._popContainer(fullName, html.Element, endTagToken.sourceSpan)) {
            const errMsg = `Unexpected closing tag "${fullName}". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags`;
            this.errors.push(TreeError.create(fullName, endTagToken.sourceSpan, errMsg));
        }
    }
    /**
     * Closes the nearest element with the tag name `fullName` in the parse tree.
     * `endSourceSpan` is the span of the closing tag, or null if the element does
     * not have a closing tag (for example, this happens when an incomplete
     * opening tag is recovered).
     */
    _popContainer(expectedName, expectedType, endSourceSpan) {
        let unexpectedCloseTagDetected = false;
        for (let stackIndex = this._containerStack.length - 1; stackIndex >= 0; stackIndex--) {
            const node = this._containerStack[stackIndex];
            if ((node.name === expectedName || expectedName === null) && node instanceof expectedType) {
                // Record the parse span with the element that is being closed. Any elements that are
                // removed from the element stack at this point are closed implicitly, so they won't get
                // an end source span (as there is no explicit closing element).
                node.endSourceSpan = endSourceSpan;
                node.sourceSpan.end = endSourceSpan !== null ? endSourceSpan.end : node.sourceSpan.end;
                this._containerStack.splice(stackIndex, this._containerStack.length - stackIndex);
                return !unexpectedCloseTagDetected;
            }
            // Blocks and most elements are not self closing.
            if (node instanceof html.Block ||
                node instanceof html.Element && !this.getTagDefinition(node.name).closedByParent) {
                // Note that we encountered an unexpected close tag but continue processing the element
                // stack so we can assign an `endSourceSpan` if there is a corresponding start tag for this
                // end tag in the stack.
                unexpectedCloseTagDetected = true;
            }
        }
        return false;
    }
    _consumeAttr(attrName) {
        const fullName = mergeNsAndName(attrName.parts[0], attrName.parts[1]);
        let attrEnd = attrName.sourceSpan.end;
        // Consume any quote
        if (this._peek.type === 15 /* TokenType.ATTR_QUOTE */) {
            this._advance();
        }
        // Consume the attribute value
        let value = '';
        const valueTokens = [];
        let valueStartSpan = undefined;
        let valueEnd = undefined;
        // NOTE: We need to use a new variable `nextTokenType` here to hide the actual type of
        // `_peek.type` from TS. Otherwise TS will narrow the type of `_peek.type` preventing it from
        // being able to consider `ATTR_VALUE_INTERPOLATION` as an option. This is because TS is not
        // able to see that `_advance()` will actually mutate `_peek`.
        const nextTokenType = this._peek.type;
        if (nextTokenType === 16 /* TokenType.ATTR_VALUE_TEXT */) {
            valueStartSpan = this._peek.sourceSpan;
            valueEnd = this._peek.sourceSpan.end;
            while (this._peek.type === 16 /* TokenType.ATTR_VALUE_TEXT */ ||
                this._peek.type === 17 /* TokenType.ATTR_VALUE_INTERPOLATION */ ||
                this._peek.type === 9 /* TokenType.ENCODED_ENTITY */) {
                const valueToken = this._advance();
                valueTokens.push(valueToken);
                if (valueToken.type === 17 /* TokenType.ATTR_VALUE_INTERPOLATION */) {
                    // For backward compatibility we decode HTML entities that appear in interpolation
                    // expressions. This is arguably a bug, but it could be a considerable breaking change to
                    // fix it. It should be addressed in a larger project to refactor the entire parser/lexer
                    // chain after View Engine has been removed.
                    value += valueToken.parts.join('').replace(/&([^;]+);/g, decodeEntity);
                }
                else if (valueToken.type === 9 /* TokenType.ENCODED_ENTITY */) {
                    value += valueToken.parts[0];
                }
                else {
                    value += valueToken.parts.join('');
                }
                valueEnd = attrEnd = valueToken.sourceSpan.end;
            }
        }
        // Consume any quote
        if (this._peek.type === 15 /* TokenType.ATTR_QUOTE */) {
            const quoteToken = this._advance();
            attrEnd = quoteToken.sourceSpan.end;
        }
        const valueSpan = valueStartSpan && valueEnd &&
            new ParseSourceSpan(valueStartSpan.start, valueEnd, valueStartSpan.fullStart);
        return new html.Attribute(fullName, value, new ParseSourceSpan(attrName.sourceSpan.start, attrEnd, attrName.sourceSpan.fullStart), attrName.sourceSpan, valueSpan, valueTokens.length > 0 ? valueTokens : undefined, undefined);
    }
    _consumeBlockOpen(token) {
        const parameters = [];
        while (this._peek.type === 27 /* TokenType.BLOCK_PARAMETER */) {
            const paramToken = this._advance();
            parameters.push(new html.BlockParameter(paramToken.parts[0], paramToken.sourceSpan));
        }
        if (this._peek.type === 25 /* TokenType.BLOCK_OPEN_END */) {
            this._advance();
        }
        const end = this._peek.sourceSpan.fullStart;
        const span = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
        // Create a separate `startSpan` because `span` will be modified when there is an `end` span.
        const startSpan = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
        const block = new html.Block(token.parts[0], parameters, [], span, startSpan);
        this._pushContainer(block, false);
        return block;
    }
    _consumeBlockClose(token) {
        const previousContainer = this._getContainer();
        if (!this._popContainer(null, html.Block, token.sourceSpan)) {
            const context = previousContainer instanceof html.Element ?
                `There is an unclosed "${previousContainer.name}" HTML tag that may have to be closed first.` :
                `The block may have been closed earlier.`;
            this.errors.push(TreeError.create(null, token.sourceSpan, `Unexpected closing block. ${context}`));
        }
    }
    _getContainer() {
        return this._containerStack.length > 0 ? this._containerStack[this._containerStack.length - 1] :
            null;
    }
    _getClosestParentElement() {
        for (let i = this._containerStack.length - 1; i > -1; i--) {
            if (this._containerStack[i] instanceof html.Element) {
                return this._containerStack[i];
            }
        }
        return null;
    }
    _addToParent(node) {
        const parent = this._getContainer();
        if (parent === null) {
            this.rootNodes.push(node);
        }
        else {
            parent.children.push(node);
        }
    }
    _getElementFullName(prefix, localName, parentElement) {
        if (prefix === '') {
            prefix = this.getTagDefinition(localName).implicitNamespacePrefix || '';
            if (prefix === '' && parentElement != null) {
                const parentTagName = splitNsName(parentElement.name)[1];
                const parentTagDefinition = this.getTagDefinition(parentTagName);
                if (!parentTagDefinition.preventNamespaceInheritance) {
                    prefix = getNsPrefix(parentElement.name);
                }
            }
        }
        return mergeNsAndName(prefix, localName);
    }
}
function lastOnStack(stack, element) {
    return stack.length > 0 && stack[stack.length - 1] === element;
}
/**
 * Decode the `entity` string, which we believe is the contents of an HTML entity.
 *
 * If the string is not actually a valid/known entity then just return the original `match` string.
 */
function decodeEntity(match, entity) {
    if (NAMED_ENTITIES[entity] !== undefined) {
        return NAMED_ENTITIES[entity] || match;
    }
    if (/^#x[a-f0-9]+$/i.test(entity)) {
        return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (/^#\d+$/.test(entity)) {
        return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return match;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL21sX3BhcnNlci9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFVBQVUsRUFBaUIsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXpFLE9BQU8sS0FBSyxJQUFJLE1BQU0sT0FBTyxDQUFDO0FBQzlCLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDMUMsT0FBTyxFQUFDLFFBQVEsRUFBa0IsTUFBTSxTQUFTLENBQUM7QUFDbEQsT0FBTyxFQUFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFnQixNQUFNLFFBQVEsQ0FBQztBQVcvRSxNQUFNLE9BQU8sU0FBVSxTQUFRLFVBQVU7SUFDdkMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUF3QixFQUFFLElBQXFCLEVBQUUsR0FBVztRQUN4RSxPQUFPLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELFlBQW1CLFdBQXdCLEVBQUUsSUFBcUIsRUFBRSxHQUFXO1FBQzdFLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFEQSxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtJQUUzQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sZUFBZTtJQUMxQixZQUFtQixTQUFzQixFQUFTLE1BQW9CO1FBQW5ELGNBQVMsR0FBVCxTQUFTLENBQWE7UUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFjO0lBQUcsQ0FBQztDQUMzRTtBQUVELE1BQU0sT0FBTyxNQUFNO0lBQ2pCLFlBQW1CLGdCQUFvRDtRQUFwRCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW9DO0lBQUcsQ0FBQztJQUUzRSxLQUFLLENBQUMsTUFBYyxFQUFFLEdBQVcs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QUFZO0lBQzdDLE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssT0FBTyxDQUFDO0FBQ2pFLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBUyxZQUFZLENBQUMsS0FBYSxFQUFFLE1BQWM7SUFDakQsSUFBSSxjQUFjLENBQUMsTUFBTSxDQUFDLEtBQUssU0FBUyxFQUFFO1FBQ3hDLE9BQU8sY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQztLQUN4QztJQUNELElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ2pDLE9BQU8sTUFBTSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQzVEO0lBQ0QsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3pCLE9BQU8sTUFBTSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQzVEO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuL2FzdCc7XG5pbXBvcnQge05BTUVEX0VOVElUSUVTfSBmcm9tICcuL2VudGl0aWVzJztcbmltcG9ydCB7dG9rZW5pemUsIFRva2VuaXplT3B0aW9uc30gZnJvbSAnLi9sZXhlcic7XG5pbXBvcnQge2dldE5zUHJlZml4LCBtZXJnZU5zQW5kTmFtZSwgc3BsaXROc05hbWUsIFRhZ0RlZmluaXRpb259IGZyb20gJy4vdGFncyc7XG5pbXBvcnQge0F0dHJpYnV0ZU5hbWVUb2tlbiwgQXR0cmlidXRlUXVvdGVUb2tlbiwgQmxvY2tDbG9zZVRva2VuLCBCbG9ja09wZW5TdGFydFRva2VuLCBCbG9ja1BhcmFtZXRlclRva2VuLCBDZGF0YVN0YXJ0VG9rZW4sIENvbW1lbnRTdGFydFRva2VuLCBFeHBhbnNpb25DYXNlRXhwcmVzc2lvbkVuZFRva2VuLCBFeHBhbnNpb25DYXNlRXhwcmVzc2lvblN0YXJ0VG9rZW4sIEV4cGFuc2lvbkNhc2VWYWx1ZVRva2VuLCBFeHBhbnNpb25Gb3JtU3RhcnRUb2tlbiwgSW5jb21wbGV0ZVRhZ09wZW5Ub2tlbiwgSW50ZXJwb2xhdGVkQXR0cmlidXRlVG9rZW4sIEludGVycG9sYXRlZFRleHRUb2tlbiwgVGFnQ2xvc2VUb2tlbiwgVGFnT3BlblN0YXJ0VG9rZW4sIFRleHRUb2tlbiwgVG9rZW4sIFRva2VuVHlwZX0gZnJvbSAnLi90b2tlbnMnO1xuXG4vKiogTm9kZXMgdGhhdCBjYW4gY29udGFpbiBvdGhlciBub2Rlcy4gKi9cbnR5cGUgTm9kZUNvbnRhaW5lciA9IGh0bWwuRWxlbWVudHxodG1sLkJsb2NrO1xuXG4vKiogQ2xhc3MgdGhhdCBjYW4gY29uc3RydWN0IGEgYE5vZGVDb250YWluZXJgLiAqL1xuaW50ZXJmYWNlIE5vZGVDb250YWluZXJDb25zdHJ1Y3RvciBleHRlbmRzIEZ1bmN0aW9uIHtcbiAgbmV3KC4uLmFyZ3M6IGFueVtdKTogTm9kZUNvbnRhaW5lcjtcbn1cblxuZXhwb3J0IGNsYXNzIFRyZWVFcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBzdGF0aWMgY3JlYXRlKGVsZW1lbnROYW1lOiBzdHJpbmd8bnVsbCwgc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBtc2c6IHN0cmluZyk6IFRyZWVFcnJvciB7XG4gICAgcmV0dXJuIG5ldyBUcmVlRXJyb3IoZWxlbWVudE5hbWUsIHNwYW4sIG1zZyk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZWxlbWVudE5hbWU6IHN0cmluZ3xudWxsLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIG1zZzogc3RyaW5nKSB7XG4gICAgc3VwZXIoc3BhbiwgbXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VUcmVlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHJvb3ROb2RlczogaHRtbC5Ob2RlW10sIHB1YmxpYyBlcnJvcnM6IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBnZXRUYWdEZWZpbml0aW9uOiAodGFnTmFtZTogc3RyaW5nKSA9PiBUYWdEZWZpbml0aW9uKSB7fVxuXG4gIHBhcnNlKHNvdXJjZTogc3RyaW5nLCB1cmw6IHN0cmluZywgb3B0aW9ucz86IFRva2VuaXplT3B0aW9ucyk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gICAgY29uc3QgdG9rZW5pemVSZXN1bHQgPSB0b2tlbml6ZShzb3VyY2UsIHVybCwgdGhpcy5nZXRUYWdEZWZpbml0aW9uLCBvcHRpb25zKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgX1RyZWVCdWlsZGVyKHRva2VuaXplUmVzdWx0LnRva2VucywgdGhpcy5nZXRUYWdEZWZpbml0aW9uKTtcbiAgICBwYXJzZXIuYnVpbGQoKTtcbiAgICByZXR1cm4gbmV3IFBhcnNlVHJlZVJlc3VsdChcbiAgICAgICAgcGFyc2VyLnJvb3ROb2RlcyxcbiAgICAgICAgKHRva2VuaXplUmVzdWx0LmVycm9ycyBhcyBQYXJzZUVycm9yW10pLmNvbmNhdChwYXJzZXIuZXJyb3JzKSxcbiAgICApO1xuICB9XG59XG5cbmNsYXNzIF9UcmVlQnVpbGRlciB7XG4gIHByaXZhdGUgX2luZGV4OiBudW1iZXIgPSAtMTtcbiAgLy8gYF9wZWVrYCB3aWxsIGJlIGluaXRpYWxpemVkIGJ5IHRoZSBjYWxsIHRvIGBfYWR2YW5jZSgpYCBpbiB0aGUgY29uc3RydWN0b3IuXG4gIHByaXZhdGUgX3BlZWshOiBUb2tlbjtcbiAgcHJpdmF0ZSBfY29udGFpbmVyU3RhY2s6IE5vZGVDb250YWluZXJbXSA9IFtdO1xuXG4gIHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBbXTtcbiAgZXJyb3JzOiBUcmVlRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0b2tlbnM6IFRva2VuW10sIHByaXZhdGUgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbikge1xuICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgfVxuXG4gIGJ1aWxkKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgIT09IFRva2VuVHlwZS5FT0YpIHtcbiAgICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5UQUdfT1BFTl9TVEFSVCB8fFxuICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLklOQ09NUExFVEVfVEFHX09QRU4pIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZVN0YXJ0VGFnKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlRBR19DTE9TRSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRW5kVGFnKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkNEQVRBX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUNkYXRhKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkNPTU1FTlRfU1RBUlQpIHtcbiAgICAgICAgdGhpcy5fY2xvc2VWb2lkRWxlbWVudCgpO1xuICAgICAgICB0aGlzLl9jb25zdW1lQ29tbWVudCh0aGlzLl9hZHZhbmNlKCkpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5URVhUIHx8IHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlJBV19URVhUIHx8XG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVNDQVBBQkxFX1JBV19URVhUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZVRleHQodGhpcy5fYWR2YW5jZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbih0aGlzLl9hZHZhbmNlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5CTE9DS19PUEVOX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUJsb2NrT3Blbih0aGlzLl9hZHZhbmNlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5CTE9DS19DTE9TRSkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVCbG9ja0Nsb3NlKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTa2lwIGFsbCBvdGhlciB0b2tlbnMuLi5cbiAgICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgbGVmdG92ZXJDb250YWluZXIgb2YgdGhpcy5fY29udGFpbmVyU3RhY2spIHtcbiAgICAgIC8vIFVubGlrZSBIVE1MIGVsZW1lbnRzLCBibG9ja3MgYXJlbid0IGNsb3NlZCBpbXBsaWNpdGx5IGJ5IHRoZSBlbmQgb2YgdGhlIGZpbGUuXG4gICAgICBpZiAobGVmdG92ZXJDb250YWluZXIgaW5zdGFuY2VvZiBodG1sLkJsb2NrKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShcbiAgICAgICAgICAgIGxlZnRvdmVyQ29udGFpbmVyLm5hbWUsIGxlZnRvdmVyQ29udGFpbmVyLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICBgVW5jbG9zZWQgYmxvY2sgXCIke2xlZnRvdmVyQ29udGFpbmVyLm5hbWV9XCJgKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYWR2YW5jZTxUIGV4dGVuZHMgVG9rZW4+KCk6IFQge1xuICAgIGNvbnN0IHByZXYgPSB0aGlzLl9wZWVrO1xuICAgIGlmICh0aGlzLl9pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCAtIDEpIHtcbiAgICAgIC8vIE5vdGU6IHRoZXJlIGlzIGFsd2F5cyBhbiBFT0YgdG9rZW4gYXQgdGhlIGVuZFxuICAgICAgdGhpcy5faW5kZXgrKztcbiAgICB9XG4gICAgdGhpcy5fcGVlayA9IHRoaXMudG9rZW5zW3RoaXMuX2luZGV4XTtcbiAgICByZXR1cm4gcHJldiBhcyBUO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWR2YW5jZUlmPFQgZXh0ZW5kcyBUb2tlblR5cGU+KHR5cGU6IFQpOiAoVG9rZW4me3R5cGU6IFR9KXxudWxsIHtcbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSB0eXBlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYWR2YW5jZTxUb2tlbiZ7dHlwZTogVH0+KCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUNkYXRhKF9zdGFydFRva2VuOiBDZGF0YVN0YXJ0VG9rZW4pIHtcbiAgICB0aGlzLl9jb25zdW1lVGV4dCh0aGlzLl9hZHZhbmNlPFRleHRUb2tlbj4oKSk7XG4gICAgdGhpcy5fYWR2YW5jZUlmKFRva2VuVHlwZS5DREFUQV9FTkQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUNvbW1lbnQodG9rZW46IENvbW1lbnRTdGFydFRva2VuKSB7XG4gICAgY29uc3QgdGV4dCA9IHRoaXMuX2FkdmFuY2VJZihUb2tlblR5cGUuUkFXX1RFWFQpO1xuICAgIGNvbnN0IGVuZFRva2VuID0gdGhpcy5fYWR2YW5jZUlmKFRva2VuVHlwZS5DT01NRU5UX0VORCk7XG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0ICE9IG51bGwgPyB0ZXh0LnBhcnRzWzBdLnRyaW0oKSA6IG51bGw7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IGVuZFRva2VuID09IG51bGwgP1xuICAgICAgICB0b2tlbi5zb3VyY2VTcGFuIDpcbiAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgIHRva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZFRva2VuLnNvdXJjZVNwYW4uZW5kLCB0b2tlbi5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuQ29tbWVudCh2YWx1ZSwgc291cmNlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbih0b2tlbjogRXhwYW5zaW9uRm9ybVN0YXJ0VG9rZW4pIHtcbiAgICBjb25zdCBzd2l0Y2hWYWx1ZSA9IHRoaXMuX2FkdmFuY2U8VGV4dFRva2VuPigpO1xuXG4gICAgY29uc3QgdHlwZSA9IHRoaXMuX2FkdmFuY2U8VGV4dFRva2VuPigpO1xuICAgIGNvbnN0IGNhc2VzOiBodG1sLkV4cGFuc2lvbkNhc2VbXSA9IFtdO1xuXG4gICAgLy8gcmVhZCA9XG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX1ZBTFVFKSB7XG4gICAgICBjb25zdCBleHBDYXNlID0gdGhpcy5fcGFyc2VFeHBhbnNpb25DYXNlKCk7XG4gICAgICBpZiAoIWV4cENhc2UpIHJldHVybjsgIC8vIGVycm9yXG4gICAgICBjYXNlcy5wdXNoKGV4cENhc2UpO1xuICAgIH1cblxuICAgIC8vIHJlYWQgdGhlIGZpbmFsIH1cbiAgICBpZiAodGhpcy5fcGVlay50eXBlICE9PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fRU5EKSB7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgdG9rZW4uc291cmNlU3Bhbi5zdGFydCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLmVuZCwgdG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIHRoaXMuX2FkZFRvUGFyZW50KG5ldyBodG1sLkV4cGFuc2lvbihcbiAgICAgICAgc3dpdGNoVmFsdWUucGFydHNbMF0sIHR5cGUucGFydHNbMF0sIGNhc2VzLCBzb3VyY2VTcGFuLCBzd2l0Y2hWYWx1ZS5zb3VyY2VTcGFuKSk7XG5cbiAgICB0aGlzLl9hZHZhbmNlKCk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUV4cGFuc2lvbkNhc2UoKTogaHRtbC5FeHBhbnNpb25DYXNlfG51bGwge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5fYWR2YW5jZTxFeHBhbnNpb25DYXNlVmFsdWVUb2tlbj4oKTtcblxuICAgIC8vIHJlYWQge1xuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgIT09IFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCB0aGlzLl9wZWVrLnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd7Jy5gKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZWFkIHVudGlsIH1cbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2FkdmFuY2U8RXhwYW5zaW9uQ2FzZUV4cHJlc3Npb25TdGFydFRva2VuPigpO1xuXG4gICAgY29uc3QgZXhwID0gdGhpcy5fY29sbGVjdEV4cGFuc2lvbkV4cFRva2VucyhzdGFydCk7XG4gICAgaWYgKCFleHApIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZW5kID0gdGhpcy5fYWR2YW5jZTxFeHBhbnNpb25DYXNlRXhwcmVzc2lvbkVuZFRva2VuPigpO1xuICAgIGV4cC5wdXNoKHt0eXBlOiBUb2tlblR5cGUuRU9GLCBwYXJ0czogW10sIHNvdXJjZVNwYW46IGVuZC5zb3VyY2VTcGFufSk7XG5cbiAgICAvLyBwYXJzZSBldmVyeXRoaW5nIGluIGJldHdlZW4geyBhbmQgfVxuICAgIGNvbnN0IGV4cGFuc2lvbkNhc2VQYXJzZXIgPSBuZXcgX1RyZWVCdWlsZGVyKGV4cCwgdGhpcy5nZXRUYWdEZWZpbml0aW9uKTtcbiAgICBleHBhbnNpb25DYXNlUGFyc2VyLmJ1aWxkKCk7XG4gICAgaWYgKGV4cGFuc2lvbkNhc2VQYXJzZXIuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuZXJyb3JzID0gdGhpcy5lcnJvcnMuY29uY2F0KGV4cGFuc2lvbkNhc2VQYXJzZXIuZXJyb3JzKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNvdXJjZVNwYW4gPVxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKHZhbHVlLnNvdXJjZVNwYW4uc3RhcnQsIGVuZC5zb3VyY2VTcGFuLmVuZCwgdmFsdWUuc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIGNvbnN0IGV4cFNvdXJjZVNwYW4gPVxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LnNvdXJjZVNwYW4uc3RhcnQsIGVuZC5zb3VyY2VTcGFuLmVuZCwgc3RhcnQuc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIHJldHVybiBuZXcgaHRtbC5FeHBhbnNpb25DYXNlKFxuICAgICAgICB2YWx1ZS5wYXJ0c1swXSwgZXhwYW5zaW9uQ2FzZVBhcnNlci5yb290Tm9kZXMsIHNvdXJjZVNwYW4sIHZhbHVlLnNvdXJjZVNwYW4sIGV4cFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29sbGVjdEV4cGFuc2lvbkV4cFRva2VucyhzdGFydDogVG9rZW4pOiBUb2tlbltdfG51bGwge1xuICAgIGNvbnN0IGV4cDogVG9rZW5bXSA9IFtdO1xuICAgIGNvbnN0IGV4cGFuc2lvbkZvcm1TdGFjayA9IFtUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUXTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQgfHxcbiAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpIHtcbiAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnB1c2godGhpcy5fcGVlay50eXBlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9FTkQpIHtcbiAgICAgICAgaWYgKGxhc3RPblN0YWNrKGV4cGFuc2lvbkZvcm1TdGFjaywgVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkpIHtcbiAgICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucG9wKCk7XG4gICAgICAgICAgaWYgKGV4cGFuc2lvbkZvcm1TdGFjay5sZW5ndGggPT09IDApIHJldHVybiBleHA7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX0VORCkge1xuICAgICAgICBpZiAobGFzdE9uU3RhY2soZXhwYW5zaW9uRm9ybVN0YWNrLCBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQpKSB7XG4gICAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnBvcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgc3RhcnQuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ30nLmApKTtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRU9GKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBleHAucHVzaCh0aGlzLl9hZHZhbmNlKCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUZXh0KHRva2VuOiBJbnRlcnBvbGF0ZWRUZXh0VG9rZW4pIHtcbiAgICBjb25zdCB0b2tlbnMgPSBbdG9rZW5dO1xuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IHRva2VuLnNvdXJjZVNwYW47XG4gICAgbGV0IHRleHQgPSB0b2tlbi5wYXJ0c1swXTtcbiAgICBpZiAodGV4dC5sZW5ndGggPiAwICYmIHRleHRbMF0gPT09ICdcXG4nKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRDb250YWluZXIoKTtcblxuICAgICAgaWYgKHBhcmVudCAhPSBudWxsICYmIHBhcmVudC5jaGlsZHJlbi5sZW5ndGggPT09IDAgJiZcbiAgICAgICAgICB0aGlzLmdldFRhZ0RlZmluaXRpb24ocGFyZW50Lm5hbWUpLmlnbm9yZUZpcnN0TGYpIHtcbiAgICAgICAgdGV4dCA9IHRleHQuc3Vic3RyaW5nKDEpO1xuICAgICAgICB0b2tlbnNbMF0gPSB7dHlwZTogdG9rZW4udHlwZSwgc291cmNlU3BhbjogdG9rZW4uc291cmNlU3BhbiwgcGFydHM6IFt0ZXh0XX0gYXMgdHlwZW9mIHRva2VuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5JTlRFUlBPTEFUSU9OIHx8IHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlRFWFQgfHxcbiAgICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRU5DT0RFRF9FTlRJVFkpIHtcbiAgICAgIHRva2VuID0gdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgaWYgKHRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5JTlRFUlBPTEFUSU9OKSB7XG4gICAgICAgIC8vIEZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdlIGRlY29kZSBIVE1MIGVudGl0aWVzIHRoYXQgYXBwZWFyIGluIGludGVycG9sYXRpb25cbiAgICAgICAgLy8gZXhwcmVzc2lvbnMuIFRoaXMgaXMgYXJndWFibHkgYSBidWcsIGJ1dCBpdCBjb3VsZCBiZSBhIGNvbnNpZGVyYWJsZSBicmVha2luZyBjaGFuZ2UgdG9cbiAgICAgICAgLy8gZml4IGl0LiBJdCBzaG91bGQgYmUgYWRkcmVzc2VkIGluIGEgbGFyZ2VyIHByb2plY3QgdG8gcmVmYWN0b3IgdGhlIGVudGlyZSBwYXJzZXIvbGV4ZXJcbiAgICAgICAgLy8gY2hhaW4gYWZ0ZXIgVmlldyBFbmdpbmUgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgICAgdGV4dCArPSB0b2tlbi5wYXJ0cy5qb2luKCcnKS5yZXBsYWNlKC8mKFteO10rKTsvZywgZGVjb2RlRW50aXR5KTtcbiAgICAgIH0gZWxzZSBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkVOQ09ERURfRU5USVRZKSB7XG4gICAgICAgIHRleHQgKz0gdG9rZW4ucGFydHNbMF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZXh0ICs9IHRva2VuLnBhcnRzLmpvaW4oJycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGVuZFNwYW4gPSB0b2tlbi5zb3VyY2VTcGFuO1xuICAgICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuVGV4dChcbiAgICAgICAgICB0ZXh0LFxuICAgICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnRTcGFuLnN0YXJ0LCBlbmRTcGFuLmVuZCwgc3RhcnRTcGFuLmZ1bGxTdGFydCwgc3RhcnRTcGFuLmRldGFpbHMpLFxuICAgICAgICAgIHRva2VucykpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2Nsb3NlVm9pZEVsZW1lbnQoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLl9nZXRDb250YWluZXIoKTtcbiAgICBpZiAoZWwgaW5zdGFuY2VvZiBodG1sLkVsZW1lbnQgJiYgdGhpcy5nZXRUYWdEZWZpbml0aW9uKGVsLm5hbWUpLmlzVm9pZCkge1xuICAgICAgdGhpcy5fY29udGFpbmVyU3RhY2sucG9wKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVN0YXJ0VGFnKHN0YXJ0VGFnVG9rZW46IFRhZ09wZW5TdGFydFRva2VufEluY29tcGxldGVUYWdPcGVuVG9rZW4pIHtcbiAgICBjb25zdCBbcHJlZml4LCBuYW1lXSA9IHN0YXJ0VGFnVG9rZW4ucGFydHM7XG4gICAgY29uc3QgYXR0cnM6IGh0bWwuQXR0cmlidXRlW10gPSBbXTtcbiAgICB3aGlsZSAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQVRUUl9OQU1FKSB7XG4gICAgICBhdHRycy5wdXNoKHRoaXMuX2NvbnN1bWVBdHRyKHRoaXMuX2FkdmFuY2U8QXR0cmlidXRlTmFtZVRva2VuPigpKSk7XG4gICAgfVxuICAgIGNvbnN0IGZ1bGxOYW1lID0gdGhpcy5fZ2V0RWxlbWVudEZ1bGxOYW1lKHByZWZpeCwgbmFtZSwgdGhpcy5fZ2V0Q2xvc2VzdFBhcmVudEVsZW1lbnQoKSk7XG4gICAgbGV0IHNlbGZDbG9zaW5nID0gZmFsc2U7XG4gICAgLy8gTm90ZTogVGhlcmUgY291bGQgaGF2ZSBiZWVuIGEgdG9rZW5pemVyIGVycm9yXG4gICAgLy8gc28gdGhhdCB3ZSBkb24ndCBnZXQgYSB0b2tlbiBmb3IgdGhlIGVuZCB0YWcuLi5cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSUQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHNlbGZDbG9zaW5nID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHRhZ0RlZiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSk7XG4gICAgICBpZiAoISh0YWdEZWYuY2FuU2VsZkNsb3NlIHx8IGdldE5zUHJlZml4KGZ1bGxOYW1lKSAhPT0gbnVsbCB8fCB0YWdEZWYuaXNWb2lkKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoXG4gICAgICAgICAgICBmdWxsTmFtZSwgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgYE9ubHkgdm9pZCwgY3VzdG9tIGFuZCBmb3JlaWduIGVsZW1lbnRzIGNhbiBiZSBzZWxmIGNsb3NlZCBcIiR7XG4gICAgICAgICAgICAgICAgc3RhcnRUYWdUb2tlbi5wYXJ0c1sxXX1cImApKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlRBR19PUEVOX0VORCkge1xuICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgc2VsZkNsb3NpbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgZW5kID0gdGhpcy5fcGVlay5zb3VyY2VTcGFuLmZ1bGxTdGFydDtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLnN0YXJ0LCBlbmQsIHN0YXJ0VGFnVG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIC8vIENyZWF0ZSBhIHNlcGFyYXRlIGBzdGFydFNwYW5gIGJlY2F1c2UgYHNwYW5gIHdpbGwgYmUgbW9kaWZpZWQgd2hlbiB0aGVyZSBpcyBhbiBgZW5kYCBzcGFuLlxuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgIHN0YXJ0VGFnVG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICBjb25zdCBlbCA9IG5ldyBodG1sLkVsZW1lbnQoZnVsbE5hbWUsIGF0dHJzLCBbXSwgc3Bhbiwgc3RhcnRTcGFuLCB1bmRlZmluZWQpO1xuICAgIGNvbnN0IHBhcmVudEVsID0gdGhpcy5fZ2V0Q29udGFpbmVyKCk7XG4gICAgdGhpcy5fcHVzaENvbnRhaW5lcihcbiAgICAgICAgZWwsXG4gICAgICAgIHBhcmVudEVsIGluc3RhbmNlb2YgaHRtbC5FbGVtZW50ICYmXG4gICAgICAgICAgICB0aGlzLmdldFRhZ0RlZmluaXRpb24ocGFyZW50RWwubmFtZSkuaXNDbG9zZWRCeUNoaWxkKGVsLm5hbWUpKTtcbiAgICBpZiAoc2VsZkNsb3NpbmcpIHtcbiAgICAgIC8vIEVsZW1lbnRzIHRoYXQgYXJlIHNlbGYtY2xvc2VkIGhhdmUgdGhlaXIgYGVuZFNvdXJjZVNwYW5gIHNldCB0byB0aGUgZnVsbCBzcGFuLCBhcyB0aGVcbiAgICAgIC8vIGVsZW1lbnQgc3RhcnQgdGFnIGFsc28gcmVwcmVzZW50cyB0aGUgZW5kIHRhZy5cbiAgICAgIHRoaXMuX3BvcENvbnRhaW5lcihmdWxsTmFtZSwgaHRtbC5FbGVtZW50LCBzcGFuKTtcbiAgICB9IGVsc2UgaWYgKHN0YXJ0VGFnVG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLklOQ09NUExFVEVfVEFHX09QRU4pIHtcbiAgICAgIC8vIFdlIGFscmVhZHkga25vdyB0aGUgb3BlbmluZyB0YWcgaXMgbm90IGNvbXBsZXRlLCBzbyBpdCBpcyB1bmxpa2VseSBpdCBoYXMgYSBjb3JyZXNwb25kaW5nXG4gICAgICAvLyBjbG9zZSB0YWcuIExldCdzIG9wdGltaXN0aWNhbGx5IHBhcnNlIGl0IGFzIGEgZnVsbCBlbGVtZW50IGFuZCBlbWl0IGFuIGVycm9yLlxuICAgICAgdGhpcy5fcG9wQ29udGFpbmVyKGZ1bGxOYW1lLCBodG1sLkVsZW1lbnQsIG51bGwpO1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKGZ1bGxOYW1lLCBzcGFuLCBgT3BlbmluZyB0YWcgXCIke2Z1bGxOYW1lfVwiIG5vdCB0ZXJtaW5hdGVkLmApKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wdXNoQ29udGFpbmVyKG5vZGU6IE5vZGVDb250YWluZXIsIGlzQ2xvc2VkQnlDaGlsZDogYm9vbGVhbikge1xuICAgIGlmIChpc0Nsb3NlZEJ5Q2hpbGQpIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lclN0YWNrLnBvcCgpO1xuICAgIH1cblxuICAgIHRoaXMuX2FkZFRvUGFyZW50KG5vZGUpO1xuICAgIHRoaXMuX2NvbnRhaW5lclN0YWNrLnB1c2gobm9kZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRW5kVGFnKGVuZFRhZ1Rva2VuOiBUYWdDbG9zZVRva2VuKSB7XG4gICAgY29uc3QgZnVsbE5hbWUgPSB0aGlzLl9nZXRFbGVtZW50RnVsbE5hbWUoXG4gICAgICAgIGVuZFRhZ1Rva2VuLnBhcnRzWzBdLCBlbmRUYWdUb2tlbi5wYXJ0c1sxXSwgdGhpcy5fZ2V0Q2xvc2VzdFBhcmVudEVsZW1lbnQoKSk7XG5cbiAgICBpZiAodGhpcy5nZXRUYWdEZWZpbml0aW9uKGZ1bGxOYW1lKS5pc1ZvaWQpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShcbiAgICAgICAgICBmdWxsTmFtZSwgZW5kVGFnVG9rZW4uc291cmNlU3BhbixcbiAgICAgICAgICBgVm9pZCBlbGVtZW50cyBkbyBub3QgaGF2ZSBlbmQgdGFncyBcIiR7ZW5kVGFnVG9rZW4ucGFydHNbMV19XCJgKSk7XG4gICAgfSBlbHNlIGlmICghdGhpcy5fcG9wQ29udGFpbmVyKGZ1bGxOYW1lLCBodG1sLkVsZW1lbnQsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4pKSB7XG4gICAgICBjb25zdCBlcnJNc2cgPSBgVW5leHBlY3RlZCBjbG9zaW5nIHRhZyBcIiR7XG4gICAgICAgICAgZnVsbE5hbWV9XCIuIEl0IG1heSBoYXBwZW4gd2hlbiB0aGUgdGFnIGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkIGJ5IGFub3RoZXIgdGFnLiBGb3IgbW9yZSBpbmZvIHNlZSBodHRwczovL3d3dy53My5vcmcvVFIvaHRtbDUvc3ludGF4Lmh0bWwjY2xvc2luZy1lbGVtZW50cy10aGF0LWhhdmUtaW1wbGllZC1lbmQtdGFnc2A7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoZnVsbE5hbWUsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4sIGVyck1zZykpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZXMgdGhlIG5lYXJlc3QgZWxlbWVudCB3aXRoIHRoZSB0YWcgbmFtZSBgZnVsbE5hbWVgIGluIHRoZSBwYXJzZSB0cmVlLlxuICAgKiBgZW5kU291cmNlU3BhbmAgaXMgdGhlIHNwYW4gb2YgdGhlIGNsb3NpbmcgdGFnLCBvciBudWxsIGlmIHRoZSBlbGVtZW50IGRvZXNcbiAgICogbm90IGhhdmUgYSBjbG9zaW5nIHRhZyAoZm9yIGV4YW1wbGUsIHRoaXMgaGFwcGVucyB3aGVuIGFuIGluY29tcGxldGVcbiAgICogb3BlbmluZyB0YWcgaXMgcmVjb3ZlcmVkKS5cbiAgICovXG4gIHByaXZhdGUgX3BvcENvbnRhaW5lcihcbiAgICAgIGV4cGVjdGVkTmFtZTogc3RyaW5nfG51bGwsIGV4cGVjdGVkVHlwZTogTm9kZUNvbnRhaW5lckNvbnN0cnVjdG9yLFxuICAgICAgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBib29sZWFuIHtcbiAgICBsZXQgdW5leHBlY3RlZENsb3NlVGFnRGV0ZWN0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBzdGFja0luZGV4ID0gdGhpcy5fY29udGFpbmVyU3RhY2subGVuZ3RoIC0gMTsgc3RhY2tJbmRleCA+PSAwOyBzdGFja0luZGV4LS0pIHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLl9jb250YWluZXJTdGFja1tzdGFja0luZGV4XTtcblxuICAgICAgaWYgKChub2RlLm5hbWUgPT09IGV4cGVjdGVkTmFtZSB8fCBleHBlY3RlZE5hbWUgPT09IG51bGwpICYmIG5vZGUgaW5zdGFuY2VvZiBleHBlY3RlZFR5cGUpIHtcbiAgICAgICAgLy8gUmVjb3JkIHRoZSBwYXJzZSBzcGFuIHdpdGggdGhlIGVsZW1lbnQgdGhhdCBpcyBiZWluZyBjbG9zZWQuIEFueSBlbGVtZW50cyB0aGF0IGFyZVxuICAgICAgICAvLyByZW1vdmVkIGZyb20gdGhlIGVsZW1lbnQgc3RhY2sgYXQgdGhpcyBwb2ludCBhcmUgY2xvc2VkIGltcGxpY2l0bHksIHNvIHRoZXkgd29uJ3QgZ2V0XG4gICAgICAgIC8vIGFuIGVuZCBzb3VyY2Ugc3BhbiAoYXMgdGhlcmUgaXMgbm8gZXhwbGljaXQgY2xvc2luZyBlbGVtZW50KS5cbiAgICAgICAgbm9kZS5lbmRTb3VyY2VTcGFuID0gZW5kU291cmNlU3BhbjtcbiAgICAgICAgbm9kZS5zb3VyY2VTcGFuLmVuZCA9IGVuZFNvdXJjZVNwYW4gIT09IG51bGwgPyBlbmRTb3VyY2VTcGFuLmVuZCA6IG5vZGUuc291cmNlU3Bhbi5lbmQ7XG4gICAgICAgIHRoaXMuX2NvbnRhaW5lclN0YWNrLnNwbGljZShzdGFja0luZGV4LCB0aGlzLl9jb250YWluZXJTdGFjay5sZW5ndGggLSBzdGFja0luZGV4KTtcbiAgICAgICAgcmV0dXJuICF1bmV4cGVjdGVkQ2xvc2VUYWdEZXRlY3RlZDtcbiAgICAgIH1cblxuICAgICAgLy8gQmxvY2tzIGFuZCBtb3N0IGVsZW1lbnRzIGFyZSBub3Qgc2VsZiBjbG9zaW5nLlxuICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBodG1sLkJsb2NrIHx8XG4gICAgICAgICAgbm9kZSBpbnN0YW5jZW9mIGh0bWwuRWxlbWVudCAmJiAhdGhpcy5nZXRUYWdEZWZpbml0aW9uKG5vZGUubmFtZSkuY2xvc2VkQnlQYXJlbnQpIHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IHdlIGVuY291bnRlcmVkIGFuIHVuZXhwZWN0ZWQgY2xvc2UgdGFnIGJ1dCBjb250aW51ZSBwcm9jZXNzaW5nIHRoZSBlbGVtZW50XG4gICAgICAgIC8vIHN0YWNrIHNvIHdlIGNhbiBhc3NpZ24gYW4gYGVuZFNvdXJjZVNwYW5gIGlmIHRoZXJlIGlzIGEgY29ycmVzcG9uZGluZyBzdGFydCB0YWcgZm9yIHRoaXNcbiAgICAgICAgLy8gZW5kIHRhZyBpbiB0aGUgc3RhY2suXG4gICAgICAgIHVuZXhwZWN0ZWRDbG9zZVRhZ0RldGVjdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHIoYXR0ck5hbWU6IEF0dHJpYnV0ZU5hbWVUb2tlbik6IGh0bWwuQXR0cmlidXRlIHtcbiAgICBjb25zdCBmdWxsTmFtZSA9IG1lcmdlTnNBbmROYW1lKGF0dHJOYW1lLnBhcnRzWzBdLCBhdHRyTmFtZS5wYXJ0c1sxXSk7XG4gICAgbGV0IGF0dHJFbmQgPSBhdHRyTmFtZS5zb3VyY2VTcGFuLmVuZDtcblxuICAgIC8vIENvbnN1bWUgYW55IHF1b3RlXG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfUVVPVEUpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICB9XG5cbiAgICAvLyBDb25zdW1lIHRoZSBhdHRyaWJ1dGUgdmFsdWVcbiAgICBsZXQgdmFsdWUgPSAnJztcbiAgICBjb25zdCB2YWx1ZVRva2VuczogSW50ZXJwb2xhdGVkQXR0cmlidXRlVG9rZW5bXSA9IFtdO1xuICAgIGxldCB2YWx1ZVN0YXJ0U3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBsZXQgdmFsdWVFbmQ6IFBhcnNlTG9jYXRpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIC8vIE5PVEU6IFdlIG5lZWQgdG8gdXNlIGEgbmV3IHZhcmlhYmxlIGBuZXh0VG9rZW5UeXBlYCBoZXJlIHRvIGhpZGUgdGhlIGFjdHVhbCB0eXBlIG9mXG4gICAgLy8gYF9wZWVrLnR5cGVgIGZyb20gVFMuIE90aGVyd2lzZSBUUyB3aWxsIG5hcnJvdyB0aGUgdHlwZSBvZiBgX3BlZWsudHlwZWAgcHJldmVudGluZyBpdCBmcm9tXG4gICAgLy8gYmVpbmcgYWJsZSB0byBjb25zaWRlciBgQVRUUl9WQUxVRV9JTlRFUlBPTEFUSU9OYCBhcyBhbiBvcHRpb24uIFRoaXMgaXMgYmVjYXVzZSBUUyBpcyBub3RcbiAgICAvLyBhYmxlIHRvIHNlZSB0aGF0IGBfYWR2YW5jZSgpYCB3aWxsIGFjdHVhbGx5IG11dGF0ZSBgX3BlZWtgLlxuICAgIGNvbnN0IG5leHRUb2tlblR5cGUgPSB0aGlzLl9wZWVrLnR5cGUgYXMgVG9rZW5UeXBlO1xuICAgIGlmIChuZXh0VG9rZW5UeXBlID09PSBUb2tlblR5cGUuQVRUUl9WQUxVRV9URVhUKSB7XG4gICAgICB2YWx1ZVN0YXJ0U3BhbiA9IHRoaXMuX3BlZWsuc291cmNlU3BhbjtcbiAgICAgIHZhbHVlRW5kID0gdGhpcy5fcGVlay5zb3VyY2VTcGFuLmVuZDtcbiAgICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5BVFRSX1ZBTFVFX1RFWFQgfHxcbiAgICAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5BVFRSX1ZBTFVFX0lOVEVSUE9MQVRJT04gfHxcbiAgICAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FTkNPREVEX0VOVElUWSkge1xuICAgICAgICBjb25zdCB2YWx1ZVRva2VuID0gdGhpcy5fYWR2YW5jZTxJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbj4oKTtcbiAgICAgICAgdmFsdWVUb2tlbnMucHVzaCh2YWx1ZVRva2VuKTtcbiAgICAgICAgaWYgKHZhbHVlVG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTikge1xuICAgICAgICAgIC8vIEZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdlIGRlY29kZSBIVE1MIGVudGl0aWVzIHRoYXQgYXBwZWFyIGluIGludGVycG9sYXRpb25cbiAgICAgICAgICAvLyBleHByZXNzaW9ucy4gVGhpcyBpcyBhcmd1YWJseSBhIGJ1ZywgYnV0IGl0IGNvdWxkIGJlIGEgY29uc2lkZXJhYmxlIGJyZWFraW5nIGNoYW5nZSB0b1xuICAgICAgICAgIC8vIGZpeCBpdC4gSXQgc2hvdWxkIGJlIGFkZHJlc3NlZCBpbiBhIGxhcmdlciBwcm9qZWN0IHRvIHJlZmFjdG9yIHRoZSBlbnRpcmUgcGFyc2VyL2xleGVyXG4gICAgICAgICAgLy8gY2hhaW4gYWZ0ZXIgVmlldyBFbmdpbmUgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgICAgICB2YWx1ZSArPSB2YWx1ZVRva2VuLnBhcnRzLmpvaW4oJycpLnJlcGxhY2UoLyYoW147XSspOy9nLCBkZWNvZGVFbnRpdHkpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlVG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkVOQ09ERURfRU5USVRZKSB7XG4gICAgICAgICAgdmFsdWUgKz0gdmFsdWVUb2tlbi5wYXJ0c1swXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSArPSB2YWx1ZVRva2VuLnBhcnRzLmpvaW4oJycpO1xuICAgICAgICB9XG4gICAgICAgIHZhbHVlRW5kID0gYXR0ckVuZCA9IHZhbHVlVG9rZW4uc291cmNlU3Bhbi5lbmQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29uc3VtZSBhbnkgcXVvdGVcbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQVRUUl9RVU9URSkge1xuICAgICAgY29uc3QgcXVvdGVUb2tlbiA9IHRoaXMuX2FkdmFuY2U8QXR0cmlidXRlUXVvdGVUb2tlbj4oKTtcbiAgICAgIGF0dHJFbmQgPSBxdW90ZVRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlU3BhbiA9IHZhbHVlU3RhcnRTcGFuICYmIHZhbHVlRW5kICYmXG4gICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4odmFsdWVTdGFydFNwYW4uc3RhcnQsIHZhbHVlRW5kLCB2YWx1ZVN0YXJ0U3Bhbi5mdWxsU3RhcnQpO1xuICAgIHJldHVybiBuZXcgaHRtbC5BdHRyaWJ1dGUoXG4gICAgICAgIGZ1bGxOYW1lLCB2YWx1ZSxcbiAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihhdHRyTmFtZS5zb3VyY2VTcGFuLnN0YXJ0LCBhdHRyRW5kLCBhdHRyTmFtZS5zb3VyY2VTcGFuLmZ1bGxTdGFydCksXG4gICAgICAgIGF0dHJOYW1lLnNvdXJjZVNwYW4sIHZhbHVlU3BhbiwgdmFsdWVUb2tlbnMubGVuZ3RoID4gMCA/IHZhbHVlVG9rZW5zIDogdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUJsb2NrT3Blbih0b2tlbjogQmxvY2tPcGVuU3RhcnRUb2tlbikge1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IGh0bWwuQmxvY2tQYXJhbWV0ZXJbXSA9IFtdO1xuXG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkJMT0NLX1BBUkFNRVRFUikge1xuICAgICAgY29uc3QgcGFyYW1Ub2tlbiA9IHRoaXMuX2FkdmFuY2U8QmxvY2tQYXJhbWV0ZXJUb2tlbj4oKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChuZXcgaHRtbC5CbG9ja1BhcmFtZXRlcihwYXJhbVRva2VuLnBhcnRzWzBdLCBwYXJhbVRva2VuLnNvdXJjZVNwYW4pKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQkxPQ0tfT1BFTl9FTkQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICB9XG5cbiAgICBjb25zdCBlbmQgPSB0aGlzLl9wZWVrLnNvdXJjZVNwYW4uZnVsbFN0YXJ0O1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHRva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZCwgdG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIC8vIENyZWF0ZSBhIHNlcGFyYXRlIGBzdGFydFNwYW5gIGJlY2F1c2UgYHNwYW5gIHdpbGwgYmUgbW9kaWZpZWQgd2hlbiB0aGVyZSBpcyBhbiBgZW5kYCBzcGFuLlxuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4odG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCB0b2tlbi5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgY29uc3QgYmxvY2sgPSBuZXcgaHRtbC5CbG9jayh0b2tlbi5wYXJ0c1swXSwgcGFyYW1ldGVycywgW10sIHNwYW4sIHN0YXJ0U3Bhbik7XG4gICAgdGhpcy5fcHVzaENvbnRhaW5lcihibG9jaywgZmFsc2UpO1xuICAgIHJldHVybiBibG9jaztcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVCbG9ja0Nsb3NlKHRva2VuOiBCbG9ja0Nsb3NlVG9rZW4pIHtcbiAgICBjb25zdCBwcmV2aW91c0NvbnRhaW5lciA9IHRoaXMuX2dldENvbnRhaW5lcigpO1xuXG4gICAgaWYgKCF0aGlzLl9wb3BDb250YWluZXIobnVsbCwgaHRtbC5CbG9jaywgdG9rZW4uc291cmNlU3BhbikpIHtcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBwcmV2aW91c0NvbnRhaW5lciBpbnN0YW5jZW9mIGh0bWwuRWxlbWVudCA/XG4gICAgICAgICAgYFRoZXJlIGlzIGFuIHVuY2xvc2VkIFwiJHtcbiAgICAgICAgICAgICAgcHJldmlvdXNDb250YWluZXIubmFtZX1cIiBIVE1MIHRhZyB0aGF0IG1heSBoYXZlIHRvIGJlIGNsb3NlZCBmaXJzdC5gIDpcbiAgICAgICAgICBgVGhlIGJsb2NrIG1heSBoYXZlIGJlZW4gY2xvc2VkIGVhcmxpZXIuYDtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCB0b2tlbi5zb3VyY2VTcGFuLCBgVW5leHBlY3RlZCBjbG9zaW5nIGJsb2NrLiAke2NvbnRleHR9YCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2dldENvbnRhaW5lcigpOiBOb2RlQ29udGFpbmVyfG51bGwge1xuICAgIHJldHVybiB0aGlzLl9jb250YWluZXJTdGFjay5sZW5ndGggPiAwID8gdGhpcy5fY29udGFpbmVyU3RhY2tbdGhpcy5fY29udGFpbmVyU3RhY2subGVuZ3RoIC0gMV0gOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldENsb3Nlc3RQYXJlbnRFbGVtZW50KCk6IGh0bWwuRWxlbWVudHxudWxsIHtcbiAgICBmb3IgKGxldCBpID0gdGhpcy5fY29udGFpbmVyU3RhY2subGVuZ3RoIC0gMTsgaSA+IC0xOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLl9jb250YWluZXJTdGFja1tpXSBpbnN0YW5jZW9mIGh0bWwuRWxlbWVudCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udGFpbmVyU3RhY2tbaV0gYXMgaHRtbC5FbGVtZW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkVG9QYXJlbnQobm9kZTogaHRtbC5Ob2RlKSB7XG4gICAgY29uc3QgcGFyZW50ID0gdGhpcy5fZ2V0Q29udGFpbmVyKCk7XG5cbiAgICBpZiAocGFyZW50ID09PSBudWxsKSB7XG4gICAgICB0aGlzLnJvb3ROb2Rlcy5wdXNoKG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJlbnQuY2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9nZXRFbGVtZW50RnVsbE5hbWUocHJlZml4OiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBwYXJlbnRFbGVtZW50OiBodG1sLkVsZW1lbnR8bnVsbCk6XG4gICAgICBzdHJpbmcge1xuICAgIGlmIChwcmVmaXggPT09ICcnKSB7XG4gICAgICBwcmVmaXggPSB0aGlzLmdldFRhZ0RlZmluaXRpb24obG9jYWxOYW1lKS5pbXBsaWNpdE5hbWVzcGFjZVByZWZpeCB8fCAnJztcbiAgICAgIGlmIChwcmVmaXggPT09ICcnICYmIHBhcmVudEVsZW1lbnQgIT0gbnVsbCkge1xuICAgICAgICBjb25zdCBwYXJlbnRUYWdOYW1lID0gc3BsaXROc05hbWUocGFyZW50RWxlbWVudC5uYW1lKVsxXTtcbiAgICAgICAgY29uc3QgcGFyZW50VGFnRGVmaW5pdGlvbiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihwYXJlbnRUYWdOYW1lKTtcbiAgICAgICAgaWYgKCFwYXJlbnRUYWdEZWZpbml0aW9uLnByZXZlbnROYW1lc3BhY2VJbmhlcml0YW5jZSkge1xuICAgICAgICAgIHByZWZpeCA9IGdldE5zUHJlZml4KHBhcmVudEVsZW1lbnQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWVyZ2VOc0FuZE5hbWUocHJlZml4LCBsb2NhbE5hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGxhc3RPblN0YWNrKHN0YWNrOiBhbnlbXSwgZWxlbWVudDogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBzdGFjay5sZW5ndGggPiAwICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBlbGVtZW50O1xufVxuXG4vKipcbiAqIERlY29kZSB0aGUgYGVudGl0eWAgc3RyaW5nLCB3aGljaCB3ZSBiZWxpZXZlIGlzIHRoZSBjb250ZW50cyBvZiBhbiBIVE1MIGVudGl0eS5cbiAqXG4gKiBJZiB0aGUgc3RyaW5nIGlzIG5vdCBhY3R1YWxseSBhIHZhbGlkL2tub3duIGVudGl0eSB0aGVuIGp1c3QgcmV0dXJuIHRoZSBvcmlnaW5hbCBgbWF0Y2hgIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZGVjb2RlRW50aXR5KG1hdGNoOiBzdHJpbmcsIGVudGl0eTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKE5BTUVEX0VOVElUSUVTW2VudGl0eV0gIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBOQU1FRF9FTlRJVElFU1tlbnRpdHldIHx8IG1hdGNoO1xuICB9XG4gIGlmICgvXiN4W2EtZjAtOV0rJC9pLnRlc3QoZW50aXR5KSkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNvZGVQb2ludChwYXJzZUludChlbnRpdHkuc2xpY2UoMiksIDE2KSk7XG4gIH1cbiAgaWYgKC9eI1xcZCskLy50ZXN0KGVudGl0eSkpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21Db2RlUG9pbnQocGFyc2VJbnQoZW50aXR5LnNsaWNlKDEpLCAxMCkpO1xuICB9XG4gIHJldHVybiBtYXRjaDtcbn1cbiJdfQ==