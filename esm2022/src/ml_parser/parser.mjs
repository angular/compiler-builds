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
        while (this._peek.type !== 24 /* TokenType.EOF */) {
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
            else if (this._peek.type === 25 /* TokenType.BLOCK_GROUP_OPEN_START */) {
                this._closeVoidElement();
                this._consumeBlockGroupOpen(this._advance());
            }
            else if (this._peek.type === 29 /* TokenType.BLOCK_OPEN_START */) {
                this._closeVoidElement();
                this._consumeBlock(this._advance(), 30 /* TokenType.BLOCK_OPEN_END */);
            }
            else if (this._peek.type === 27 /* TokenType.BLOCK_GROUP_CLOSE */) {
                this._closeVoidElement();
                this._consumeBlockGroupClose(this._advance());
            }
            else {
                // Skip all other tokens...
                this._advance();
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
        this._advanceIf(11 /* TokenType.COMMENT_END */);
        const value = text != null ? text.parts[0].trim() : null;
        this._addToParent(new html.Comment(value, token.sourceSpan));
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
        exp.push({ type: 24 /* TokenType.EOF */, parts: [], sourceSpan: end.sourceSpan });
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
            if (this._peek.type === 24 /* TokenType.EOF */) {
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
            // This is unlikely to happen, but we have an assertion just in case.
            if (parent instanceof html.BlockGroup) {
                this.errors.push(TreeError.create(null, startSpan, 'Text cannot be placed directly inside of a block group.'));
                return null;
            }
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
    _popContainer(fullName, expectedType, endSourceSpan) {
        let unexpectedCloseTagDetected = false;
        for (let stackIndex = this._containerStack.length - 1; stackIndex >= 0; stackIndex--) {
            const node = this._containerStack[stackIndex];
            const name = node instanceof html.BlockGroup ? node.blocks[0]?.name : node.name;
            if (name === fullName && node instanceof expectedType) {
                // Record the parse span with the element that is being closed. Any elements that are
                // removed from the element stack at this point are closed implicitly, so they won't get
                // an end source span (as there is no explicit closing element).
                node.endSourceSpan = endSourceSpan;
                node.sourceSpan.end = endSourceSpan !== null ? endSourceSpan.end : node.sourceSpan.end;
                this._containerStack.splice(stackIndex, this._containerStack.length - stackIndex);
                return !unexpectedCloseTagDetected;
            }
            // Blocks are self-closing while block groups and (most times) elements are not.
            if (node instanceof html.BlockGroup ||
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
    _consumeBlockGroupOpen(token) {
        const end = this._peek.sourceSpan.fullStart;
        const span = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
        // Create a separate `startSpan` because `span` will be modified when there is an `end` span.
        const startSpan = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
        const blockGroup = new html.BlockGroup([], span, startSpan, null);
        this._pushContainer(blockGroup, false);
        const implicitBlock = this._consumeBlock(token, 26 /* TokenType.BLOCK_GROUP_OPEN_END */);
        // Block parameters are consumed as a part of the implicit block so we need to expand the
        // start source span once the block is parsed to include the full opening tag.
        startSpan.end = implicitBlock.startSourceSpan.end;
    }
    _consumeBlock(token, closeToken) {
        // The start of a block implicitly closes the previous block.
        this._conditionallyClosePreviousBlock();
        const parameters = [];
        while (this._peek.type === 28 /* TokenType.BLOCK_PARAMETER */) {
            const paramToken = this._advance();
            parameters.push(new html.BlockParameter(paramToken.parts[0], paramToken.sourceSpan));
        }
        if (this._peek.type === closeToken) {
            this._advance();
        }
        const end = this._peek.sourceSpan.fullStart;
        const span = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
        // Create a separate `startSpan` because `span` will be modified when there is an `end` span.
        const startSpan = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
        const block = new html.Block(token.parts[0], parameters, [], span, startSpan);
        const parent = this._getContainer();
        if (!(parent instanceof html.BlockGroup)) {
            this.errors.push(TreeError.create(block.name, block.sourceSpan, 'Blocks can only be placed inside of block groups.'));
        }
        else {
            parent.blocks.push(block);
            this._containerStack.push(block);
        }
        return block;
    }
    _consumeBlockGroupClose(token) {
        const name = token.parts[0];
        const previousContainer = this._getContainer();
        // Blocks are implcitly closed by the block group.
        this._conditionallyClosePreviousBlock();
        if (!this._popContainer(name, html.BlockGroup, token.sourceSpan)) {
            const context = previousContainer instanceof html.Element ?
                `There is an unclosed "${previousContainer.name}" HTML tag named that may have to be closed first.` :
                `The block may have been closed earlier.`;
            this.errors.push(TreeError.create(name, token.sourceSpan, `Unexpected closing block "${name}". ${context}`));
        }
    }
    _conditionallyClosePreviousBlock() {
        const container = this._getContainer();
        if (container instanceof html.Block) {
            // Blocks don't have an explicit closing tag, they're closed either by the next block or
            // the end of the block group. Infer the end span from the last child node.
            const lastChild = container.children.length ? container.children[container.children.length - 1] : null;
            const endSpan = lastChild === null ?
                null :
                new ParseSourceSpan(lastChild.sourceSpan.end, lastChild.sourceSpan.end);
            this._popContainer(container.name, html.Block, endSpan);
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
        else if (parent instanceof html.BlockGroup) {
            // Due to how parsing is set up, we're unlikely to hit this code path, but we
            // have the assertion here just in case and to satisfy the type checker.
            this.errors.push(TreeError.create(null, node.sourceSpan, 'Block groups can only contain blocks.'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL21sX3BhcnNlci9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFVBQVUsRUFBaUIsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXpFLE9BQU8sS0FBSyxJQUFJLE1BQU0sT0FBTyxDQUFDO0FBQzlCLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDMUMsT0FBTyxFQUFDLFFBQVEsRUFBa0IsTUFBTSxTQUFTLENBQUM7QUFDbEQsT0FBTyxFQUFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFnQixNQUFNLFFBQVEsQ0FBQztBQVcvRSxNQUFNLE9BQU8sU0FBVSxTQUFRLFVBQVU7SUFDdkMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUF3QixFQUFFLElBQXFCLEVBQUUsR0FBVztRQUN4RSxPQUFPLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELFlBQW1CLFdBQXdCLEVBQUUsSUFBcUIsRUFBRSxHQUFXO1FBQzdFLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFEQSxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtJQUUzQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sZUFBZTtJQUMxQixZQUFtQixTQUFzQixFQUFTLE1BQW9CO1FBQW5ELGNBQVMsR0FBVCxTQUFTLENBQWE7UUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFjO0lBQUcsQ0FBQztDQUMzRTtBQUVELE1BQU0sT0FBTyxNQUFNO0lBQ2pCLFlBQW1CLGdCQUFvRDtRQUFwRCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW9DO0lBQUcsQ0FBQztJQUUzRSxLQUFLLENBQUMsTUFBYyxFQUFFLEdBQVcs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S0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxPQUFPLENBQUM7QUFDakUsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFTLFlBQVksQ0FBQyxLQUFhLEVBQUUsTUFBYztJQUNqRCxJQUFJLGNBQWMsQ0FBQyxNQUFNLENBQUMsS0FBSyxTQUFTLEVBQUU7UUFDeEMsT0FBTyxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDO0tBQ3hDO0lBQ0QsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDakMsT0FBTyxNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDNUQ7SUFDRCxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDekIsT0FBTyxNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDNUQ7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUxvY2F0aW9uLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4vYXN0JztcbmltcG9ydCB7TkFNRURfRU5USVRJRVN9IGZyb20gJy4vZW50aXRpZXMnO1xuaW1wb3J0IHt0b2tlbml6ZSwgVG9rZW5pemVPcHRpb25zfSBmcm9tICcuL2xleGVyJztcbmltcG9ydCB7Z2V0TnNQcmVmaXgsIG1lcmdlTnNBbmROYW1lLCBzcGxpdE5zTmFtZSwgVGFnRGVmaW5pdGlvbn0gZnJvbSAnLi90YWdzJztcbmltcG9ydCB7QXR0cmlidXRlTmFtZVRva2VuLCBBdHRyaWJ1dGVRdW90ZVRva2VuLCBCbG9ja0dyb3VwQ2xvc2VUb2tlbiwgQmxvY2tHcm91cE9wZW5TdGFydFRva2VuLCBCbG9ja09wZW5TdGFydFRva2VuLCBCbG9ja1BhcmFtZXRlclRva2VuLCBDZGF0YVN0YXJ0VG9rZW4sIENvbW1lbnRTdGFydFRva2VuLCBFeHBhbnNpb25DYXNlRXhwcmVzc2lvbkVuZFRva2VuLCBFeHBhbnNpb25DYXNlRXhwcmVzc2lvblN0YXJ0VG9rZW4sIEV4cGFuc2lvbkNhc2VWYWx1ZVRva2VuLCBFeHBhbnNpb25Gb3JtU3RhcnRUb2tlbiwgSW5jb21wbGV0ZVRhZ09wZW5Ub2tlbiwgSW50ZXJwb2xhdGVkQXR0cmlidXRlVG9rZW4sIEludGVycG9sYXRlZFRleHRUb2tlbiwgVGFnQ2xvc2VUb2tlbiwgVGFnT3BlblN0YXJ0VG9rZW4sIFRleHRUb2tlbiwgVG9rZW4sIFRva2VuVHlwZX0gZnJvbSAnLi90b2tlbnMnO1xuXG4vKiogTm9kZXMgdGhhdCBjYW4gY29udGFpbiBvdGhlciBub2Rlcy4gKi9cbnR5cGUgTm9kZUNvbnRhaW5lciA9IGh0bWwuRWxlbWVudHxodG1sLkJsb2NrfGh0bWwuQmxvY2tHcm91cDtcblxuLyoqIENsYXNzIHRoYXQgY2FuIGNvbnN0cnVjdCBhIGBOb2RlQ29udGFpbmVyYC4gKi9cbmludGVyZmFjZSBOb2RlQ29udGFpbmVyQ29uc3RydWN0b3IgZXh0ZW5kcyBGdW5jdGlvbiB7XG4gIG5ldyguLi5hcmdzOiBhbnlbXSk6IE5vZGVDb250YWluZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBUcmVlRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgc3RhdGljIGNyZWF0ZShlbGVtZW50TmFtZTogc3RyaW5nfG51bGwsIHNwYW46IFBhcnNlU291cmNlU3BhbiwgbXNnOiBzdHJpbmcpOiBUcmVlRXJyb3Ige1xuICAgIHJldHVybiBuZXcgVHJlZUVycm9yKGVsZW1lbnROYW1lLCBzcGFuLCBtc2cpO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHVibGljIGVsZW1lbnROYW1lOiBzdHJpbmd8bnVsbCwgc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBtc2c6IHN0cmluZykge1xuICAgIHN1cGVyKHNwYW4sIG1zZyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlVHJlZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByb290Tm9kZXM6IGh0bWwuTm9kZVtdLCBwdWJsaWMgZXJyb3JzOiBQYXJzZUVycm9yW10pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXIge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbikge31cblxuICBwYXJzZShzb3VyY2U6IHN0cmluZywgdXJsOiBzdHJpbmcsIG9wdGlvbnM/OiBUb2tlbml6ZU9wdGlvbnMpOiBQYXJzZVRyZWVSZXN1bHQge1xuICAgIGNvbnN0IHRva2VuaXplUmVzdWx0ID0gdG9rZW5pemUoc291cmNlLCB1cmwsIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbiwgb3B0aW9ucyk7XG4gICAgY29uc3QgcGFyc2VyID0gbmV3IF9UcmVlQnVpbGRlcih0b2tlbml6ZVJlc3VsdC50b2tlbnMsIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbik7XG4gICAgcGFyc2VyLmJ1aWxkKCk7XG4gICAgcmV0dXJuIG5ldyBQYXJzZVRyZWVSZXN1bHQoXG4gICAgICAgIHBhcnNlci5yb290Tm9kZXMsXG4gICAgICAgICh0b2tlbml6ZVJlc3VsdC5lcnJvcnMgYXMgUGFyc2VFcnJvcltdKS5jb25jYXQocGFyc2VyLmVycm9ycyksXG4gICAgKTtcbiAgfVxufVxuXG5jbGFzcyBfVHJlZUJ1aWxkZXIge1xuICBwcml2YXRlIF9pbmRleDogbnVtYmVyID0gLTE7XG4gIC8vIGBfcGVla2Agd2lsbCBiZSBpbml0aWFsaXplZCBieSB0aGUgY2FsbCB0byBgX2FkdmFuY2UoKWAgaW4gdGhlIGNvbnN0cnVjdG9yLlxuICBwcml2YXRlIF9wZWVrITogVG9rZW47XG4gIHByaXZhdGUgX2NvbnRhaW5lclN0YWNrOiBOb2RlQ29udGFpbmVyW10gPSBbXTtcblxuICByb290Tm9kZXM6IGh0bWwuTm9kZVtdID0gW107XG4gIGVycm9yczogVHJlZUVycm9yW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdG9rZW5zOiBUb2tlbltdLCBwcml2YXRlIGdldFRhZ0RlZmluaXRpb246ICh0YWdOYW1lOiBzdHJpbmcpID0+IFRhZ0RlZmluaXRpb24pIHtcbiAgICB0aGlzLl9hZHZhbmNlKCk7XG4gIH1cblxuICBidWlsZCgpOiB2b2lkIHtcbiAgICB3aGlsZSAodGhpcy5fcGVlay50eXBlICE9PSBUb2tlblR5cGUuRU9GKSB7XG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuVEFHX09QRU5fU1RBUlQgfHxcbiAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5JTkNPTVBMRVRFX1RBR19PUEVOKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVTdGFydFRhZyh0aGlzLl9hZHZhbmNlPFRhZ09wZW5TdGFydFRva2VufEluY29tcGxldGVUYWdPcGVuVG9rZW4+KCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5UQUdfQ0xPU0UpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZUVuZFRhZyh0aGlzLl9hZHZhbmNlPFRhZ0Nsb3NlVG9rZW4+KCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5DREFUQV9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVDZGF0YSh0aGlzLl9hZHZhbmNlPENkYXRhU3RhcnRUb2tlbj4oKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkNPTU1FTlRfU1RBUlQpIHtcbiAgICAgICAgdGhpcy5fY2xvc2VWb2lkRWxlbWVudCgpO1xuICAgICAgICB0aGlzLl9jb25zdW1lQ29tbWVudCh0aGlzLl9hZHZhbmNlPENvbW1lbnRTdGFydFRva2VuPigpKTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuVEVYVCB8fCB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5SQVdfVEVYVCB8fFxuICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVTQ0FQQUJMRV9SQVdfVEVYVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVUZXh0KHRoaXMuX2FkdmFuY2U8VGV4dFRva2VuPigpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbih0aGlzLl9hZHZhbmNlPEV4cGFuc2lvbkZvcm1TdGFydFRva2VuPigpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQkxPQ0tfR1JPVVBfT1BFTl9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVCbG9ja0dyb3VwT3Blbih0aGlzLl9hZHZhbmNlPEJsb2NrR3JvdXBPcGVuU3RhcnRUb2tlbj4oKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkJMT0NLX09QRU5fU1RBUlQpIHtcbiAgICAgICAgdGhpcy5fY2xvc2VWb2lkRWxlbWVudCgpO1xuICAgICAgICB0aGlzLl9jb25zdW1lQmxvY2sodGhpcy5fYWR2YW5jZTxCbG9ja09wZW5TdGFydFRva2VuPigpLCBUb2tlblR5cGUuQkxPQ0tfT1BFTl9FTkQpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5CTE9DS19HUk9VUF9DTE9TRSkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVCbG9ja0dyb3VwQ2xvc2UodGhpcy5fYWR2YW5jZTxCbG9ja0dyb3VwQ2xvc2VUb2tlbj4oKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTa2lwIGFsbCBvdGhlciB0b2tlbnMuLi5cbiAgICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FkdmFuY2U8VCBleHRlbmRzIFRva2VuPigpOiBUIHtcbiAgICBjb25zdCBwcmV2ID0gdGhpcy5fcGVlaztcbiAgICBpZiAodGhpcy5faW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggLSAxKSB7XG4gICAgICAvLyBOb3RlOiB0aGVyZSBpcyBhbHdheXMgYW4gRU9GIHRva2VuIGF0IHRoZSBlbmRcbiAgICAgIHRoaXMuX2luZGV4Kys7XG4gICAgfVxuICAgIHRoaXMuX3BlZWsgPSB0aGlzLnRva2Vuc1t0aGlzLl9pbmRleF07XG4gICAgcmV0dXJuIHByZXYgYXMgVDtcbiAgfVxuXG4gIHByaXZhdGUgX2FkdmFuY2VJZjxUIGV4dGVuZHMgVG9rZW5UeXBlPih0eXBlOiBUKTogKFRva2VuJnt0eXBlOiBUfSl8bnVsbCB7XG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gdHlwZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2FkdmFuY2U8VG9rZW4me3R5cGU6IFR9PigpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVDZGF0YShfc3RhcnRUb2tlbjogQ2RhdGFTdGFydFRva2VuKSB7XG4gICAgdGhpcy5fY29uc3VtZVRleHQodGhpcy5fYWR2YW5jZTxUZXh0VG9rZW4+KCkpO1xuICAgIHRoaXMuX2FkdmFuY2VJZihUb2tlblR5cGUuQ0RBVEFfRU5EKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVDb21tZW50KHRva2VuOiBDb21tZW50U3RhcnRUb2tlbikge1xuICAgIGNvbnN0IHRleHQgPSB0aGlzLl9hZHZhbmNlSWYoVG9rZW5UeXBlLlJBV19URVhUKTtcbiAgICB0aGlzLl9hZHZhbmNlSWYoVG9rZW5UeXBlLkNPTU1FTlRfRU5EKTtcbiAgICBjb25zdCB2YWx1ZSA9IHRleHQgIT0gbnVsbCA/IHRleHQucGFydHNbMF0udHJpbSgpIDogbnVsbDtcbiAgICB0aGlzLl9hZGRUb1BhcmVudChuZXcgaHRtbC5Db21tZW50KHZhbHVlLCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uKHRva2VuOiBFeHBhbnNpb25Gb3JtU3RhcnRUb2tlbikge1xuICAgIGNvbnN0IHN3aXRjaFZhbHVlID0gdGhpcy5fYWR2YW5jZTxUZXh0VG9rZW4+KCk7XG5cbiAgICBjb25zdCB0eXBlID0gdGhpcy5fYWR2YW5jZTxUZXh0VG9rZW4+KCk7XG4gICAgY29uc3QgY2FzZXM6IGh0bWwuRXhwYW5zaW9uQ2FzZVtdID0gW107XG5cbiAgICAvLyByZWFkID1cbiAgICB3aGlsZSAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfVkFMVUUpIHtcbiAgICAgIGNvbnN0IGV4cENhc2UgPSB0aGlzLl9wYXJzZUV4cGFuc2lvbkNhc2UoKTtcbiAgICAgIGlmICghZXhwQ2FzZSkgcmV0dXJuOyAgLy8gZXJyb3JcbiAgICAgIGNhc2VzLnB1c2goZXhwQ2FzZSk7XG4gICAgfVxuXG4gICAgLy8gcmVhZCB0aGUgZmluYWwgfVxuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgIT09IFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9FTkQpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCB0aGlzLl9wZWVrLnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICB0b2tlbi5zb3VyY2VTcGFuLnN0YXJ0LCB0aGlzLl9wZWVrLnNvdXJjZVNwYW4uZW5kLCB0b2tlbi5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuRXhwYW5zaW9uKFxuICAgICAgICBzd2l0Y2hWYWx1ZS5wYXJ0c1swXSwgdHlwZS5wYXJ0c1swXSwgY2FzZXMsIHNvdXJjZVNwYW4sIHN3aXRjaFZhbHVlLnNvdXJjZVNwYW4pKTtcblxuICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlRXhwYW5zaW9uQ2FzZSgpOiBodG1sLkV4cGFuc2lvbkNhc2V8bnVsbCB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLl9hZHZhbmNlPEV4cGFuc2lvbkNhc2VWYWx1ZVRva2VuPigpO1xuXG4gICAgLy8gcmVhZCB7XG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSAhPT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkge1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHRoaXMuX3BlZWsuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ3snLmApKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIHJlYWQgdW50aWwgfVxuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fYWR2YW5jZTxFeHBhbnNpb25DYXNlRXhwcmVzc2lvblN0YXJ0VG9rZW4+KCk7XG5cbiAgICBjb25zdCBleHAgPSB0aGlzLl9jb2xsZWN0RXhwYW5zaW9uRXhwVG9rZW5zKHN0YXJ0KTtcbiAgICBpZiAoIWV4cCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBlbmQgPSB0aGlzLl9hZHZhbmNlPEV4cGFuc2lvbkNhc2VFeHByZXNzaW9uRW5kVG9rZW4+KCk7XG4gICAgZXhwLnB1c2goe3R5cGU6IFRva2VuVHlwZS5FT0YsIHBhcnRzOiBbXSwgc291cmNlU3BhbjogZW5kLnNvdXJjZVNwYW59KTtcblxuICAgIC8vIHBhcnNlIGV2ZXJ5dGhpbmcgaW4gYmV0d2VlbiB7IGFuZCB9XG4gICAgY29uc3QgZXhwYW5zaW9uQ2FzZVBhcnNlciA9IG5ldyBfVHJlZUJ1aWxkZXIoZXhwLCB0aGlzLmdldFRhZ0RlZmluaXRpb24pO1xuICAgIGV4cGFuc2lvbkNhc2VQYXJzZXIuYnVpbGQoKTtcbiAgICBpZiAoZXhwYW5zaW9uQ2FzZVBhcnNlci5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5lcnJvcnMgPSB0aGlzLmVycm9ycy5jb25jYXQoZXhwYW5zaW9uQ2FzZVBhcnNlci5lcnJvcnMpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc291cmNlU3BhbiA9XG4gICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4odmFsdWUuc291cmNlU3Bhbi5zdGFydCwgZW5kLnNvdXJjZVNwYW4uZW5kLCB2YWx1ZS5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgY29uc3QgZXhwU291cmNlU3BhbiA9XG4gICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQuc291cmNlU3Bhbi5zdGFydCwgZW5kLnNvdXJjZVNwYW4uZW5kLCBzdGFydC5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgcmV0dXJuIG5ldyBodG1sLkV4cGFuc2lvbkNhc2UoXG4gICAgICAgIHZhbHVlLnBhcnRzWzBdLCBleHBhbnNpb25DYXNlUGFyc2VyLnJvb3ROb2Rlcywgc291cmNlU3BhbiwgdmFsdWUuc291cmNlU3BhbiwgZXhwU291cmNlU3Bhbik7XG4gIH1cblxuICBwcml2YXRlIF9jb2xsZWN0RXhwYW5zaW9uRXhwVG9rZW5zKHN0YXJ0OiBUb2tlbik6IFRva2VuW118bnVsbCB7XG4gICAgY29uc3QgZXhwOiBUb2tlbltdID0gW107XG4gICAgY29uc3QgZXhwYW5zaW9uRm9ybVN0YWNrID0gW1Rva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlRdO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCB8fFxuICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkge1xuICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucHVzaCh0aGlzLl9wZWVrLnR5cGUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX0VORCkge1xuICAgICAgICBpZiAobGFzdE9uU3RhY2soZXhwYW5zaW9uRm9ybVN0YWNrLCBUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUKSkge1xuICAgICAgICAgIGV4cGFuc2lvbkZvcm1TdGFjay5wb3AoKTtcbiAgICAgICAgICBpZiAoZXhwYW5zaW9uRm9ybVN0YWNrLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGV4cDtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgc3RhcnQuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ30nLmApKTtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fRU5EKSB7XG4gICAgICAgIGlmIChsYXN0T25TdGFjayhleHBhbnNpb25Gb3JtU3RhY2ssIFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCkpIHtcbiAgICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCBzdGFydC5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FT0YpIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgc3RhcnQuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ30nLmApKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGV4cC5wdXNoKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVRleHQodG9rZW46IEludGVycG9sYXRlZFRleHRUb2tlbikge1xuICAgIGNvbnN0IHRva2VucyA9IFt0b2tlbl07XG4gICAgY29uc3Qgc3RhcnRTcGFuID0gdG9rZW4uc291cmNlU3BhbjtcbiAgICBsZXQgdGV4dCA9IHRva2VuLnBhcnRzWzBdO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDAgJiYgdGV4dFswXSA9PT0gJ1xcbicpIHtcbiAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX2dldENvbnRhaW5lcigpO1xuXG4gICAgICAvLyBUaGlzIGlzIHVubGlrZWx5IHRvIGhhcHBlbiwgYnV0IHdlIGhhdmUgYW4gYXNzZXJ0aW9uIGp1c3QgaW4gY2FzZS5cbiAgICAgIGlmIChwYXJlbnQgaW5zdGFuY2VvZiBodG1sLkJsb2NrR3JvdXApIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChUcmVlRXJyb3IuY3JlYXRlKFxuICAgICAgICAgICAgbnVsbCwgc3RhcnRTcGFuLCAnVGV4dCBjYW5ub3QgYmUgcGxhY2VkIGRpcmVjdGx5IGluc2lkZSBvZiBhIGJsb2NrIGdyb3VwLicpKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXJlbnQgIT0gbnVsbCAmJiBwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID09PSAwICYmXG4gICAgICAgICAgdGhpcy5nZXRUYWdEZWZpbml0aW9uKHBhcmVudC5uYW1lKS5pZ25vcmVGaXJzdExmKSB7XG4gICAgICAgIHRleHQgPSB0ZXh0LnN1YnN0cmluZygxKTtcbiAgICAgICAgdG9rZW5zWzBdID0ge3R5cGU6IHRva2VuLnR5cGUsIHNvdXJjZVNwYW46IHRva2VuLnNvdXJjZVNwYW4sIHBhcnRzOiBbdGV4dF19IGFzIHR5cGVvZiB0b2tlbjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB3aGlsZSAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuSU5URVJQT0xBVElPTiB8fCB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5URVhUIHx8XG4gICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVOQ09ERURfRU5USVRZKSB7XG4gICAgICB0b2tlbiA9IHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgIGlmICh0b2tlbi50eXBlID09PSBUb2tlblR5cGUuSU5URVJQT0xBVElPTikge1xuICAgICAgICAvLyBGb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSB3ZSBkZWNvZGUgSFRNTCBlbnRpdGllcyB0aGF0IGFwcGVhciBpbiBpbnRlcnBvbGF0aW9uXG4gICAgICAgIC8vIGV4cHJlc3Npb25zLiBUaGlzIGlzIGFyZ3VhYmx5IGEgYnVnLCBidXQgaXQgY291bGQgYmUgYSBjb25zaWRlcmFibGUgYnJlYWtpbmcgY2hhbmdlIHRvXG4gICAgICAgIC8vIGZpeCBpdC4gSXQgc2hvdWxkIGJlIGFkZHJlc3NlZCBpbiBhIGxhcmdlciBwcm9qZWN0IHRvIHJlZmFjdG9yIHRoZSBlbnRpcmUgcGFyc2VyL2xleGVyXG4gICAgICAgIC8vIGNoYWluIGFmdGVyIFZpZXcgRW5naW5lIGhhcyBiZWVuIHJlbW92ZWQuXG4gICAgICAgIHRleHQgKz0gdG9rZW4ucGFydHMuam9pbignJykucmVwbGFjZSgvJihbXjtdKyk7L2csIGRlY29kZUVudGl0eSk7XG4gICAgICB9IGVsc2UgaWYgKHRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5FTkNPREVEX0VOVElUWSkge1xuICAgICAgICB0ZXh0ICs9IHRva2VuLnBhcnRzWzBdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGV4dCArPSB0b2tlbi5wYXJ0cy5qb2luKCcnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGV4dC5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBlbmRTcGFuID0gdG9rZW4uc291cmNlU3BhbjtcbiAgICAgIHRoaXMuX2FkZFRvUGFyZW50KG5ldyBodG1sLlRleHQoXG4gICAgICAgICAgdGV4dCxcbiAgICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0U3Bhbi5zdGFydCwgZW5kU3Bhbi5lbmQsIHN0YXJ0U3Bhbi5mdWxsU3RhcnQsIHN0YXJ0U3Bhbi5kZXRhaWxzKSxcbiAgICAgICAgICB0b2tlbnMpKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jbG9zZVZvaWRFbGVtZW50KCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5fZ2V0Q29udGFpbmVyKCk7XG4gICAgaWYgKGVsIGluc3RhbmNlb2YgaHRtbC5FbGVtZW50ICYmIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihlbC5uYW1lKS5pc1ZvaWQpIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lclN0YWNrLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVTdGFydFRhZyhzdGFydFRhZ1Rva2VuOiBUYWdPcGVuU3RhcnRUb2tlbnxJbmNvbXBsZXRlVGFnT3BlblRva2VuKSB7XG4gICAgY29uc3QgW3ByZWZpeCwgbmFtZV0gPSBzdGFydFRhZ1Rva2VuLnBhcnRzO1xuICAgIGNvbnN0IGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdID0gW107XG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfTkFNRSkge1xuICAgICAgYXR0cnMucHVzaCh0aGlzLl9jb25zdW1lQXR0cih0aGlzLl9hZHZhbmNlPEF0dHJpYnV0ZU5hbWVUb2tlbj4oKSkpO1xuICAgIH1cbiAgICBjb25zdCBmdWxsTmFtZSA9IHRoaXMuX2dldEVsZW1lbnRGdWxsTmFtZShwcmVmaXgsIG5hbWUsIHRoaXMuX2dldENsb3Nlc3RQYXJlbnRFbGVtZW50KCkpO1xuICAgIGxldCBzZWxmQ2xvc2luZyA9IGZhbHNlO1xuICAgIC8vIE5vdGU6IFRoZXJlIGNvdWxkIGhhdmUgYmVlbiBhIHRva2VuaXplciBlcnJvclxuICAgIC8vIHNvIHRoYXQgd2UgZG9uJ3QgZ2V0IGEgdG9rZW4gZm9yIHRoZSBlbmQgdGFnLi4uXG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlRBR19PUEVOX0VORF9WT0lEKSB7XG4gICAgICB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICBzZWxmQ2xvc2luZyA9IHRydWU7XG4gICAgICBjb25zdCB0YWdEZWYgPSB0aGlzLmdldFRhZ0RlZmluaXRpb24oZnVsbE5hbWUpO1xuICAgICAgaWYgKCEodGFnRGVmLmNhblNlbGZDbG9zZSB8fCBnZXROc1ByZWZpeChmdWxsTmFtZSkgIT09IG51bGwgfHwgdGFnRGVmLmlzVm9pZCkpIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChUcmVlRXJyb3IuY3JlYXRlKFxuICAgICAgICAgICAgZnVsbE5hbWUsIHN0YXJ0VGFnVG9rZW4uc291cmNlU3BhbixcbiAgICAgICAgICAgIGBPbmx5IHZvaWQsIGN1c3RvbSBhbmQgZm9yZWlnbiBlbGVtZW50cyBjYW4gYmUgc2VsZiBjbG9zZWQgXCIke1xuICAgICAgICAgICAgICAgIHN0YXJ0VGFnVG9rZW4ucGFydHNbMV19XCJgKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5UQUdfT1BFTl9FTkQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHNlbGZDbG9zaW5nID0gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IGVuZCA9IHRoaXMuX3BlZWsuc291cmNlU3Bhbi5mdWxsU3RhcnQ7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgIHN0YXJ0VGFnVG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICAvLyBDcmVhdGUgYSBzZXBhcmF0ZSBgc3RhcnRTcGFuYCBiZWNhdXNlIGBzcGFuYCB3aWxsIGJlIG1vZGlmaWVkIHdoZW4gdGhlcmUgaXMgYW4gYGVuZGAgc3Bhbi5cbiAgICBjb25zdCBzdGFydFNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZCwgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgY29uc3QgZWwgPSBuZXcgaHRtbC5FbGVtZW50KGZ1bGxOYW1lLCBhdHRycywgW10sIHNwYW4sIHN0YXJ0U3BhbiwgdW5kZWZpbmVkKTtcbiAgICBjb25zdCBwYXJlbnRFbCA9IHRoaXMuX2dldENvbnRhaW5lcigpO1xuICAgIHRoaXMuX3B1c2hDb250YWluZXIoXG4gICAgICAgIGVsLFxuICAgICAgICBwYXJlbnRFbCBpbnN0YW5jZW9mIGh0bWwuRWxlbWVudCAmJlxuICAgICAgICAgICAgdGhpcy5nZXRUYWdEZWZpbml0aW9uKHBhcmVudEVsLm5hbWUpLmlzQ2xvc2VkQnlDaGlsZChlbC5uYW1lKSk7XG4gICAgaWYgKHNlbGZDbG9zaW5nKSB7XG4gICAgICAvLyBFbGVtZW50cyB0aGF0IGFyZSBzZWxmLWNsb3NlZCBoYXZlIHRoZWlyIGBlbmRTb3VyY2VTcGFuYCBzZXQgdG8gdGhlIGZ1bGwgc3BhbiwgYXMgdGhlXG4gICAgICAvLyBlbGVtZW50IHN0YXJ0IHRhZyBhbHNvIHJlcHJlc2VudHMgdGhlIGVuZCB0YWcuXG4gICAgICB0aGlzLl9wb3BDb250YWluZXIoZnVsbE5hbWUsIGh0bWwuRWxlbWVudCwgc3Bhbik7XG4gICAgfSBlbHNlIGlmIChzdGFydFRhZ1Rva2VuLnR5cGUgPT09IFRva2VuVHlwZS5JTkNPTVBMRVRFX1RBR19PUEVOKSB7XG4gICAgICAvLyBXZSBhbHJlYWR5IGtub3cgdGhlIG9wZW5pbmcgdGFnIGlzIG5vdCBjb21wbGV0ZSwgc28gaXQgaXMgdW5saWtlbHkgaXQgaGFzIGEgY29ycmVzcG9uZGluZ1xuICAgICAgLy8gY2xvc2UgdGFnLiBMZXQncyBvcHRpbWlzdGljYWxseSBwYXJzZSBpdCBhcyBhIGZ1bGwgZWxlbWVudCBhbmQgZW1pdCBhbiBlcnJvci5cbiAgICAgIHRoaXMuX3BvcENvbnRhaW5lcihmdWxsTmFtZSwgaHRtbC5FbGVtZW50LCBudWxsKTtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShmdWxsTmFtZSwgc3BhbiwgYE9wZW5pbmcgdGFnIFwiJHtmdWxsTmFtZX1cIiBub3QgdGVybWluYXRlZC5gKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcHVzaENvbnRhaW5lcihub2RlOiBOb2RlQ29udGFpbmVyLCBpc0Nsb3NlZEJ5Q2hpbGQ6IGJvb2xlYW4pIHtcbiAgICBpZiAoaXNDbG9zZWRCeUNoaWxkKSB7XG4gICAgICB0aGlzLl9jb250YWluZXJTdGFjay5wb3AoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9hZGRUb1BhcmVudChub2RlKTtcbiAgICB0aGlzLl9jb250YWluZXJTdGFjay5wdXNoKG5vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUVuZFRhZyhlbmRUYWdUb2tlbjogVGFnQ2xvc2VUb2tlbikge1xuICAgIGNvbnN0IGZ1bGxOYW1lID0gdGhpcy5fZ2V0RWxlbWVudEZ1bGxOYW1lKFxuICAgICAgICBlbmRUYWdUb2tlbi5wYXJ0c1swXSwgZW5kVGFnVG9rZW4ucGFydHNbMV0sIHRoaXMuX2dldENsb3Nlc3RQYXJlbnRFbGVtZW50KCkpO1xuXG4gICAgaWYgKHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSkuaXNWb2lkKSB7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoXG4gICAgICAgICAgZnVsbE5hbWUsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4sXG4gICAgICAgICAgYFZvaWQgZWxlbWVudHMgZG8gbm90IGhhdmUgZW5kIHRhZ3MgXCIke2VuZFRhZ1Rva2VuLnBhcnRzWzFdfVwiYCkpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX3BvcENvbnRhaW5lcihmdWxsTmFtZSwgaHRtbC5FbGVtZW50LCBlbmRUYWdUb2tlbi5zb3VyY2VTcGFuKSkge1xuICAgICAgY29uc3QgZXJyTXNnID0gYFVuZXhwZWN0ZWQgY2xvc2luZyB0YWcgXCIke1xuICAgICAgICAgIGZ1bGxOYW1lfVwiLiBJdCBtYXkgaGFwcGVuIHdoZW4gdGhlIHRhZyBoYXMgYWxyZWFkeSBiZWVuIGNsb3NlZCBieSBhbm90aGVyIHRhZy4gRm9yIG1vcmUgaW5mbyBzZWUgaHR0cHM6Ly93d3cudzMub3JnL1RSL2h0bWw1L3N5bnRheC5odG1sI2Nsb3NpbmctZWxlbWVudHMtdGhhdC1oYXZlLWltcGxpZWQtZW5kLXRhZ3NgO1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChUcmVlRXJyb3IuY3JlYXRlKGZ1bGxOYW1lLCBlbmRUYWdUb2tlbi5zb3VyY2VTcGFuLCBlcnJNc2cpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2xvc2VzIHRoZSBuZWFyZXN0IGVsZW1lbnQgd2l0aCB0aGUgdGFnIG5hbWUgYGZ1bGxOYW1lYCBpbiB0aGUgcGFyc2UgdHJlZS5cbiAgICogYGVuZFNvdXJjZVNwYW5gIGlzIHRoZSBzcGFuIG9mIHRoZSBjbG9zaW5nIHRhZywgb3IgbnVsbCBpZiB0aGUgZWxlbWVudCBkb2VzXG4gICAqIG5vdCBoYXZlIGEgY2xvc2luZyB0YWcgKGZvciBleGFtcGxlLCB0aGlzIGhhcHBlbnMgd2hlbiBhbiBpbmNvbXBsZXRlXG4gICAqIG9wZW5pbmcgdGFnIGlzIHJlY292ZXJlZCkuXG4gICAqL1xuICBwcml2YXRlIF9wb3BDb250YWluZXIoXG4gICAgICBmdWxsTmFtZTogc3RyaW5nLCBleHBlY3RlZFR5cGU6IE5vZGVDb250YWluZXJDb25zdHJ1Y3RvcixcbiAgICAgIGVuZFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKTogYm9vbGVhbiB7XG4gICAgbGV0IHVuZXhwZWN0ZWRDbG9zZVRhZ0RldGVjdGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgc3RhY2tJbmRleCA9IHRoaXMuX2NvbnRhaW5lclN0YWNrLmxlbmd0aCAtIDE7IHN0YWNrSW5kZXggPj0gMDsgc3RhY2tJbmRleC0tKSB7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5fY29udGFpbmVyU3RhY2tbc3RhY2tJbmRleF07XG4gICAgICBjb25zdCBuYW1lID0gbm9kZSBpbnN0YW5jZW9mIGh0bWwuQmxvY2tHcm91cCA/IG5vZGUuYmxvY2tzWzBdPy5uYW1lIDogbm9kZS5uYW1lO1xuXG4gICAgICBpZiAobmFtZSA9PT0gZnVsbE5hbWUgJiYgbm9kZSBpbnN0YW5jZW9mIGV4cGVjdGVkVHlwZSkge1xuICAgICAgICAvLyBSZWNvcmQgdGhlIHBhcnNlIHNwYW4gd2l0aCB0aGUgZWxlbWVudCB0aGF0IGlzIGJlaW5nIGNsb3NlZC4gQW55IGVsZW1lbnRzIHRoYXQgYXJlXG4gICAgICAgIC8vIHJlbW92ZWQgZnJvbSB0aGUgZWxlbWVudCBzdGFjayBhdCB0aGlzIHBvaW50IGFyZSBjbG9zZWQgaW1wbGljaXRseSwgc28gdGhleSB3b24ndCBnZXRcbiAgICAgICAgLy8gYW4gZW5kIHNvdXJjZSBzcGFuIChhcyB0aGVyZSBpcyBubyBleHBsaWNpdCBjbG9zaW5nIGVsZW1lbnQpLlxuICAgICAgICBub2RlLmVuZFNvdXJjZVNwYW4gPSBlbmRTb3VyY2VTcGFuO1xuICAgICAgICBub2RlLnNvdXJjZVNwYW4uZW5kID0gZW5kU291cmNlU3BhbiAhPT0gbnVsbCA/IGVuZFNvdXJjZVNwYW4uZW5kIDogbm9kZS5zb3VyY2VTcGFuLmVuZDtcbiAgICAgICAgdGhpcy5fY29udGFpbmVyU3RhY2suc3BsaWNlKHN0YWNrSW5kZXgsIHRoaXMuX2NvbnRhaW5lclN0YWNrLmxlbmd0aCAtIHN0YWNrSW5kZXgpO1xuICAgICAgICByZXR1cm4gIXVuZXhwZWN0ZWRDbG9zZVRhZ0RldGVjdGVkO1xuICAgICAgfVxuXG4gICAgICAvLyBCbG9ja3MgYXJlIHNlbGYtY2xvc2luZyB3aGlsZSBibG9jayBncm91cHMgYW5kIChtb3N0IHRpbWVzKSBlbGVtZW50cyBhcmUgbm90LlxuICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBodG1sLkJsb2NrR3JvdXAgfHxcbiAgICAgICAgICBub2RlIGluc3RhbmNlb2YgaHRtbC5FbGVtZW50ICYmICF0aGlzLmdldFRhZ0RlZmluaXRpb24obm9kZS5uYW1lKS5jbG9zZWRCeVBhcmVudCkge1xuICAgICAgICAvLyBOb3RlIHRoYXQgd2UgZW5jb3VudGVyZWQgYW4gdW5leHBlY3RlZCBjbG9zZSB0YWcgYnV0IGNvbnRpbnVlIHByb2Nlc3NpbmcgdGhlIGVsZW1lbnRcbiAgICAgICAgLy8gc3RhY2sgc28gd2UgY2FuIGFzc2lnbiBhbiBgZW5kU291cmNlU3BhbmAgaWYgdGhlcmUgaXMgYSBjb3JyZXNwb25kaW5nIHN0YXJ0IHRhZyBmb3IgdGhpc1xuICAgICAgICAvLyBlbmQgdGFnIGluIHRoZSBzdGFjay5cbiAgICAgICAgdW5leHBlY3RlZENsb3NlVGFnRGV0ZWN0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQXR0cihhdHRyTmFtZTogQXR0cmlidXRlTmFtZVRva2VuKTogaHRtbC5BdHRyaWJ1dGUge1xuICAgIGNvbnN0IGZ1bGxOYW1lID0gbWVyZ2VOc0FuZE5hbWUoYXR0ck5hbWUucGFydHNbMF0sIGF0dHJOYW1lLnBhcnRzWzFdKTtcbiAgICBsZXQgYXR0ckVuZCA9IGF0dHJOYW1lLnNvdXJjZVNwYW4uZW5kO1xuXG4gICAgLy8gQ29uc3VtZSBhbnkgcXVvdGVcbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQVRUUl9RVU9URSkge1xuICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgIH1cblxuICAgIC8vIENvbnN1bWUgdGhlIGF0dHJpYnV0ZSB2YWx1ZVxuICAgIGxldCB2YWx1ZSA9ICcnO1xuICAgIGNvbnN0IHZhbHVlVG9rZW5zOiBJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbltdID0gW107XG4gICAgbGV0IHZhbHVlU3RhcnRTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGxldCB2YWx1ZUVuZDogUGFyc2VMb2NhdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgLy8gTk9URTogV2UgbmVlZCB0byB1c2UgYSBuZXcgdmFyaWFibGUgYG5leHRUb2tlblR5cGVgIGhlcmUgdG8gaGlkZSB0aGUgYWN0dWFsIHR5cGUgb2ZcbiAgICAvLyBgX3BlZWsudHlwZWAgZnJvbSBUUy4gT3RoZXJ3aXNlIFRTIHdpbGwgbmFycm93IHRoZSB0eXBlIG9mIGBfcGVlay50eXBlYCBwcmV2ZW50aW5nIGl0IGZyb21cbiAgICAvLyBiZWluZyBhYmxlIHRvIGNvbnNpZGVyIGBBVFRSX1ZBTFVFX0lOVEVSUE9MQVRJT05gIGFzIGFuIG9wdGlvbi4gVGhpcyBpcyBiZWNhdXNlIFRTIGlzIG5vdFxuICAgIC8vIGFibGUgdG8gc2VlIHRoYXQgYF9hZHZhbmNlKClgIHdpbGwgYWN0dWFsbHkgbXV0YXRlIGBfcGVla2AuXG4gICAgY29uc3QgbmV4dFRva2VuVHlwZSA9IHRoaXMuX3BlZWsudHlwZSBhcyBUb2tlblR5cGU7XG4gICAgaWYgKG5leHRUb2tlblR5cGUgPT09IFRva2VuVHlwZS5BVFRSX1ZBTFVFX1RFWFQpIHtcbiAgICAgIHZhbHVlU3RhcnRTcGFuID0gdGhpcy5fcGVlay5zb3VyY2VTcGFuO1xuICAgICAgdmFsdWVFbmQgPSB0aGlzLl9wZWVrLnNvdXJjZVNwYW4uZW5kO1xuICAgICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfVkFMVUVfVEVYVCB8fFxuICAgICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTiB8fFxuICAgICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVOQ09ERURfRU5USVRZKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlVG9rZW4gPSB0aGlzLl9hZHZhbmNlPEludGVycG9sYXRlZEF0dHJpYnV0ZVRva2VuPigpO1xuICAgICAgICB2YWx1ZVRva2Vucy5wdXNoKHZhbHVlVG9rZW4pO1xuICAgICAgICBpZiAodmFsdWVUb2tlbi50eXBlID09PSBUb2tlblR5cGUuQVRUUl9WQUxVRV9JTlRFUlBPTEFUSU9OKSB7XG4gICAgICAgICAgLy8gRm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkgd2UgZGVjb2RlIEhUTUwgZW50aXRpZXMgdGhhdCBhcHBlYXIgaW4gaW50ZXJwb2xhdGlvblxuICAgICAgICAgIC8vIGV4cHJlc3Npb25zLiBUaGlzIGlzIGFyZ3VhYmx5IGEgYnVnLCBidXQgaXQgY291bGQgYmUgYSBjb25zaWRlcmFibGUgYnJlYWtpbmcgY2hhbmdlIHRvXG4gICAgICAgICAgLy8gZml4IGl0LiBJdCBzaG91bGQgYmUgYWRkcmVzc2VkIGluIGEgbGFyZ2VyIHByb2plY3QgdG8gcmVmYWN0b3IgdGhlIGVudGlyZSBwYXJzZXIvbGV4ZXJcbiAgICAgICAgICAvLyBjaGFpbiBhZnRlciBWaWV3IEVuZ2luZSBoYXMgYmVlbiByZW1vdmVkLlxuICAgICAgICAgIHZhbHVlICs9IHZhbHVlVG9rZW4ucGFydHMuam9pbignJykucmVwbGFjZSgvJihbXjtdKyk7L2csIGRlY29kZUVudGl0eSk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWVUb2tlbi50eXBlID09PSBUb2tlblR5cGUuRU5DT0RFRF9FTlRJVFkpIHtcbiAgICAgICAgICB2YWx1ZSArPSB2YWx1ZVRva2VuLnBhcnRzWzBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlICs9IHZhbHVlVG9rZW4ucGFydHMuam9pbignJyk7XG4gICAgICAgIH1cbiAgICAgICAgdmFsdWVFbmQgPSBhdHRyRW5kID0gdmFsdWVUb2tlbi5zb3VyY2VTcGFuLmVuZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb25zdW1lIGFueSBxdW90ZVxuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5BVFRSX1FVT1RFKSB7XG4gICAgICBjb25zdCBxdW90ZVRva2VuID0gdGhpcy5fYWR2YW5jZTxBdHRyaWJ1dGVRdW90ZVRva2VuPigpO1xuICAgICAgYXR0ckVuZCA9IHF1b3RlVG9rZW4uc291cmNlU3Bhbi5lbmQ7XG4gICAgfVxuXG4gICAgY29uc3QgdmFsdWVTcGFuID0gdmFsdWVTdGFydFNwYW4gJiYgdmFsdWVFbmQgJiZcbiAgICAgICAgbmV3IFBhcnNlU291cmNlU3Bhbih2YWx1ZVN0YXJ0U3Bhbi5zdGFydCwgdmFsdWVFbmQsIHZhbHVlU3RhcnRTcGFuLmZ1bGxTdGFydCk7XG4gICAgcmV0dXJuIG5ldyBodG1sLkF0dHJpYnV0ZShcbiAgICAgICAgZnVsbE5hbWUsIHZhbHVlLFxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKGF0dHJOYW1lLnNvdXJjZVNwYW4uc3RhcnQsIGF0dHJFbmQsIGF0dHJOYW1lLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KSxcbiAgICAgICAgYXR0ck5hbWUuc291cmNlU3BhbiwgdmFsdWVTcGFuLCB2YWx1ZVRva2Vucy5sZW5ndGggPiAwID8gdmFsdWVUb2tlbnMgOiB1bmRlZmluZWQsXG4gICAgICAgIHVuZGVmaW5lZCk7XG4gIH1cblxuXG4gIHByaXZhdGUgX2NvbnN1bWVCbG9ja0dyb3VwT3Blbih0b2tlbjogQmxvY2tHcm91cE9wZW5TdGFydFRva2VuKSB7XG4gICAgY29uc3QgZW5kID0gdGhpcy5fcGVlay5zb3VyY2VTcGFuLmZ1bGxTdGFydDtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU291cmNlU3Bhbih0b2tlbi5zb3VyY2VTcGFuLnN0YXJ0LCBlbmQsIHRva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICAvLyBDcmVhdGUgYSBzZXBhcmF0ZSBgc3RhcnRTcGFuYCBiZWNhdXNlIGBzcGFuYCB3aWxsIGJlIG1vZGlmaWVkIHdoZW4gdGhlcmUgaXMgYW4gYGVuZGAgc3Bhbi5cbiAgICBjb25zdCBzdGFydFNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHRva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZCwgdG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIGNvbnN0IGJsb2NrR3JvdXAgPSBuZXcgaHRtbC5CbG9ja0dyb3VwKFtdLCBzcGFuLCBzdGFydFNwYW4sIG51bGwpO1xuICAgIHRoaXMuX3B1c2hDb250YWluZXIoYmxvY2tHcm91cCwgZmFsc2UpO1xuICAgIGNvbnN0IGltcGxpY2l0QmxvY2sgPSB0aGlzLl9jb25zdW1lQmxvY2sodG9rZW4sIFRva2VuVHlwZS5CTE9DS19HUk9VUF9PUEVOX0VORCk7XG5cbiAgICAvLyBCbG9jayBwYXJhbWV0ZXJzIGFyZSBjb25zdW1lZCBhcyBhIHBhcnQgb2YgdGhlIGltcGxpY2l0IGJsb2NrIHNvIHdlIG5lZWQgdG8gZXhwYW5kIHRoZVxuICAgIC8vIHN0YXJ0IHNvdXJjZSBzcGFuIG9uY2UgdGhlIGJsb2NrIGlzIHBhcnNlZCB0byBpbmNsdWRlIHRoZSBmdWxsIG9wZW5pbmcgdGFnLlxuICAgIHN0YXJ0U3Bhbi5lbmQgPSBpbXBsaWNpdEJsb2NrLnN0YXJ0U291cmNlU3Bhbi5lbmQ7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQmxvY2soXG4gICAgICB0b2tlbjogQmxvY2tPcGVuU3RhcnRUb2tlbnxCbG9ja0dyb3VwT3BlblN0YXJ0VG9rZW4sIGNsb3NlVG9rZW46IFRva2VuVHlwZSkge1xuICAgIC8vIFRoZSBzdGFydCBvZiBhIGJsb2NrIGltcGxpY2l0bHkgY2xvc2VzIHRoZSBwcmV2aW91cyBibG9jay5cbiAgICB0aGlzLl9jb25kaXRpb25hbGx5Q2xvc2VQcmV2aW91c0Jsb2NrKCk7XG5cbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBodG1sLkJsb2NrUGFyYW1ldGVyW10gPSBbXTtcblxuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5CTE9DS19QQVJBTUVURVIpIHtcbiAgICAgIGNvbnN0IHBhcmFtVG9rZW4gPSB0aGlzLl9hZHZhbmNlPEJsb2NrUGFyYW1ldGVyVG9rZW4+KCk7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2gobmV3IGh0bWwuQmxvY2tQYXJhbWV0ZXIocGFyYW1Ub2tlbi5wYXJ0c1swXSwgcGFyYW1Ub2tlbi5zb3VyY2VTcGFuKSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gY2xvc2VUb2tlbikge1xuICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgIH1cblxuICAgIGNvbnN0IGVuZCA9IHRoaXMuX3BlZWsuc291cmNlU3Bhbi5mdWxsU3RhcnQ7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4odG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCB0b2tlbi5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgLy8gQ3JlYXRlIGEgc2VwYXJhdGUgYHN0YXJ0U3BhbmAgYmVjYXVzZSBgc3BhbmAgd2lsbCBiZSBtb2RpZmllZCB3aGVuIHRoZXJlIGlzIGFuIGBlbmRgIHNwYW4uXG4gICAgY29uc3Qgc3RhcnRTcGFuID0gbmV3IFBhcnNlU291cmNlU3Bhbih0b2tlbi5zb3VyY2VTcGFuLnN0YXJ0LCBlbmQsIHRva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICBjb25zdCBibG9jayA9IG5ldyBodG1sLkJsb2NrKHRva2VuLnBhcnRzWzBdLCBwYXJhbWV0ZXJzLCBbXSwgc3Bhbiwgc3RhcnRTcGFuKTtcbiAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRDb250YWluZXIoKTtcblxuICAgIGlmICghKHBhcmVudCBpbnN0YW5jZW9mIGh0bWwuQmxvY2tHcm91cCkpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShcbiAgICAgICAgICBibG9jay5uYW1lLCBibG9jay5zb3VyY2VTcGFuLCAnQmxvY2tzIGNhbiBvbmx5IGJlIHBsYWNlZCBpbnNpZGUgb2YgYmxvY2sgZ3JvdXBzLicpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyZW50LmJsb2Nrcy5wdXNoKGJsb2NrKTtcbiAgICAgIHRoaXMuX2NvbnRhaW5lclN0YWNrLnB1c2goYmxvY2spO1xuICAgIH1cblxuICAgIHJldHVybiBibG9jaztcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVCbG9ja0dyb3VwQ2xvc2UodG9rZW46IEJsb2NrR3JvdXBDbG9zZVRva2VuKSB7XG4gICAgY29uc3QgbmFtZSA9IHRva2VuLnBhcnRzWzBdO1xuICAgIGNvbnN0IHByZXZpb3VzQ29udGFpbmVyID0gdGhpcy5fZ2V0Q29udGFpbmVyKCk7XG5cbiAgICAvLyBCbG9ja3MgYXJlIGltcGxjaXRseSBjbG9zZWQgYnkgdGhlIGJsb2NrIGdyb3VwLlxuICAgIHRoaXMuX2NvbmRpdGlvbmFsbHlDbG9zZVByZXZpb3VzQmxvY2soKTtcblxuICAgIGlmICghdGhpcy5fcG9wQ29udGFpbmVyKG5hbWUsIGh0bWwuQmxvY2tHcm91cCwgdG9rZW4uc291cmNlU3BhbikpIHtcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBwcmV2aW91c0NvbnRhaW5lciBpbnN0YW5jZW9mIGh0bWwuRWxlbWVudCA/XG4gICAgICAgICAgYFRoZXJlIGlzIGFuIHVuY2xvc2VkIFwiJHtcbiAgICAgICAgICAgICAgcHJldmlvdXNDb250YWluZXIubmFtZX1cIiBIVE1MIHRhZyBuYW1lZCB0aGF0IG1heSBoYXZlIHRvIGJlIGNsb3NlZCBmaXJzdC5gIDpcbiAgICAgICAgICBgVGhlIGJsb2NrIG1heSBoYXZlIGJlZW4gY2xvc2VkIGVhcmxpZXIuYDtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShcbiAgICAgICAgICBuYW1lLCB0b2tlbi5zb3VyY2VTcGFuLCBgVW5leHBlY3RlZCBjbG9zaW5nIGJsb2NrIFwiJHtuYW1lfVwiLiAke2NvbnRleHR9YCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbmRpdGlvbmFsbHlDbG9zZVByZXZpb3VzQmxvY2soKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5fZ2V0Q29udGFpbmVyKCk7XG5cbiAgICBpZiAoY29udGFpbmVyIGluc3RhbmNlb2YgaHRtbC5CbG9jaykge1xuICAgICAgLy8gQmxvY2tzIGRvbid0IGhhdmUgYW4gZXhwbGljaXQgY2xvc2luZyB0YWcsIHRoZXkncmUgY2xvc2VkIGVpdGhlciBieSB0aGUgbmV4dCBibG9jayBvclxuICAgICAgLy8gdGhlIGVuZCBvZiB0aGUgYmxvY2sgZ3JvdXAuIEluZmVyIHRoZSBlbmQgc3BhbiBmcm9tIHRoZSBsYXN0IGNoaWxkIG5vZGUuXG4gICAgICBjb25zdCBsYXN0Q2hpbGQgPVxuICAgICAgICAgIGNvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGggPyBjb250YWluZXIuY2hpbGRyZW5bY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aCAtIDFdIDogbnVsbDtcbiAgICAgIGNvbnN0IGVuZFNwYW4gPSBsYXN0Q2hpbGQgPT09IG51bGwgP1xuICAgICAgICAgIG51bGwgOlxuICAgICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4obGFzdENoaWxkLnNvdXJjZVNwYW4uZW5kLCBsYXN0Q2hpbGQuc291cmNlU3Bhbi5lbmQpO1xuXG4gICAgICB0aGlzLl9wb3BDb250YWluZXIoY29udGFpbmVyLm5hbWUsIGh0bWwuQmxvY2ssIGVuZFNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2dldENvbnRhaW5lcigpOiBOb2RlQ29udGFpbmVyfG51bGwge1xuICAgIHJldHVybiB0aGlzLl9jb250YWluZXJTdGFjay5sZW5ndGggPiAwID8gdGhpcy5fY29udGFpbmVyU3RhY2tbdGhpcy5fY29udGFpbmVyU3RhY2subGVuZ3RoIC0gMV0gOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldENsb3Nlc3RQYXJlbnRFbGVtZW50KCk6IGh0bWwuRWxlbWVudHxudWxsIHtcbiAgICBmb3IgKGxldCBpID0gdGhpcy5fY29udGFpbmVyU3RhY2subGVuZ3RoIC0gMTsgaSA+IC0xOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLl9jb250YWluZXJTdGFja1tpXSBpbnN0YW5jZW9mIGh0bWwuRWxlbWVudCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udGFpbmVyU3RhY2tbaV0gYXMgaHRtbC5FbGVtZW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkVG9QYXJlbnQobm9kZTogaHRtbC5Ob2RlKSB7XG4gICAgY29uc3QgcGFyZW50ID0gdGhpcy5fZ2V0Q29udGFpbmVyKCk7XG5cbiAgICBpZiAocGFyZW50ID09PSBudWxsKSB7XG4gICAgICB0aGlzLnJvb3ROb2Rlcy5wdXNoKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAocGFyZW50IGluc3RhbmNlb2YgaHRtbC5CbG9ja0dyb3VwKSB7XG4gICAgICAvLyBEdWUgdG8gaG93IHBhcnNpbmcgaXMgc2V0IHVwLCB3ZSdyZSB1bmxpa2VseSB0byBoaXQgdGhpcyBjb2RlIHBhdGgsIGJ1dCB3ZVxuICAgICAgLy8gaGF2ZSB0aGUgYXNzZXJ0aW9uIGhlcmUganVzdCBpbiBjYXNlIGFuZCB0byBzYXRpc2Z5IHRoZSB0eXBlIGNoZWNrZXIuXG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgbm9kZS5zb3VyY2VTcGFuLCAnQmxvY2sgZ3JvdXBzIGNhbiBvbmx5IGNvbnRhaW4gYmxvY2tzLicpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyZW50LmNoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0RWxlbWVudEZ1bGxOYW1lKHByZWZpeDogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgcGFyZW50RWxlbWVudDogaHRtbC5FbGVtZW50fG51bGwpOlxuICAgICAgc3RyaW5nIHtcbiAgICBpZiAocHJlZml4ID09PSAnJykge1xuICAgICAgcHJlZml4ID0gdGhpcy5nZXRUYWdEZWZpbml0aW9uKGxvY2FsTmFtZSkuaW1wbGljaXROYW1lc3BhY2VQcmVmaXggfHwgJyc7XG4gICAgICBpZiAocHJlZml4ID09PSAnJyAmJiBwYXJlbnRFbGVtZW50ICE9IG51bGwpIHtcbiAgICAgICAgY29uc3QgcGFyZW50VGFnTmFtZSA9IHNwbGl0TnNOYW1lKHBhcmVudEVsZW1lbnQubmFtZSlbMV07XG4gICAgICAgIGNvbnN0IHBhcmVudFRhZ0RlZmluaXRpb24gPSB0aGlzLmdldFRhZ0RlZmluaXRpb24ocGFyZW50VGFnTmFtZSk7XG4gICAgICAgIGlmICghcGFyZW50VGFnRGVmaW5pdGlvbi5wcmV2ZW50TmFtZXNwYWNlSW5oZXJpdGFuY2UpIHtcbiAgICAgICAgICBwcmVmaXggPSBnZXROc1ByZWZpeChwYXJlbnRFbGVtZW50Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1lcmdlTnNBbmROYW1lKHByZWZpeCwgbG9jYWxOYW1lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBsYXN0T25TdGFjayhzdGFjazogYW55W10sIGVsZW1lbnQ6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gc3RhY2subGVuZ3RoID4gMCAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gZWxlbWVudDtcbn1cblxuLyoqXG4gKiBEZWNvZGUgdGhlIGBlbnRpdHlgIHN0cmluZywgd2hpY2ggd2UgYmVsaWV2ZSBpcyB0aGUgY29udGVudHMgb2YgYW4gSFRNTCBlbnRpdHkuXG4gKlxuICogSWYgdGhlIHN0cmluZyBpcyBub3QgYWN0dWFsbHkgYSB2YWxpZC9rbm93biBlbnRpdHkgdGhlbiBqdXN0IHJldHVybiB0aGUgb3JpZ2luYWwgYG1hdGNoYCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGRlY29kZUVudGl0eShtYXRjaDogc3RyaW5nLCBlbnRpdHk6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChOQU1FRF9FTlRJVElFU1tlbnRpdHldICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gTkFNRURfRU5USVRJRVNbZW50aXR5XSB8fCBtYXRjaDtcbiAgfVxuICBpZiAoL14jeFthLWYwLTldKyQvaS50ZXN0KGVudGl0eSkpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21Db2RlUG9pbnQocGFyc2VJbnQoZW50aXR5LnNsaWNlKDIpLCAxNikpO1xuICB9XG4gIGlmICgvXiNcXGQrJC8udGVzdChlbnRpdHkpKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ29kZVBvaW50KHBhcnNlSW50KGVudGl0eS5zbGljZSgxKSwgMTApKTtcbiAgfVxuICByZXR1cm4gbWF0Y2g7XG59XG4iXX0=