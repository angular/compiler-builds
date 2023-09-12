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
                return;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL21sX3BhcnNlci9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFVBQVUsRUFBaUIsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXpFLE9BQU8sS0FBSyxJQUFJLE1BQU0sT0FBTyxDQUFDO0FBQzlCLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDMUMsT0FBTyxFQUFDLFFBQVEsRUFBa0IsTUFBTSxTQUFTLENBQUM7QUFDbEQsT0FBTyxFQUFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFnQixNQUFNLFFBQVEsQ0FBQztBQVcvRSxNQUFNLE9BQU8sU0FBVSxTQUFRLFVBQVU7SUFDdkMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUF3QixFQUFFLElBQXFCLEVBQUUsR0FBVztRQUN4RSxPQUFPLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELFlBQW1CLFdBQXdCLEVBQUUsSUFBcUIsRUFBRSxHQUFXO1FBQzdFLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFEQSxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtJQUUzQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sZUFBZTtJQUMxQixZQUFtQixTQUFzQixFQUFTLE1BQW9CO1FBQW5ELGNBQVMsR0FBVCxTQUFTLENBQWE7UUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFjO0lBQUcsQ0FBQztDQUMzRTtBQUVELE1BQU0sT0FBTyxNQUFNO0lBQ2pCLFlBQW1CLGdCQUFvRDtRQUFwRCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW9DO0lBQUcsQ0FBQztJQUUzRSxLQUFLLENBQUMsTUFBYyxFQUFFLEdBQVcs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QUFhLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQzFDO2FBQ0Y7U0FDRjtRQUVELE9BQU8sY0FBYyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztJQUMzQyxDQUFDO0NBQ0Y7QUFFRCxTQUFTLFdBQVcsQ0FBQyxLQUFZLEVBQUUsT0FBWTtJQUM3QyxPQUFPLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLE9BQU8sQ0FBQztBQUNqRSxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsWUFBWSxDQUFDLEtBQWEsRUFBRSxNQUFjO0lBQ2pELElBQUksY0FBYyxDQUFDLE1BQU0sQ0FBQyxLQUFLLFNBQVMsRUFBRTtRQUN4QyxPQUFPLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUM7S0FDeEM7SUFDRCxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUNqQyxPQUFPLE1BQU0sQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztLQUM1RDtJQUNELElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUN6QixPQUFPLE1BQU0sQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztLQUM1RDtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlTG9jYXRpb24sIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi9hc3QnO1xuaW1wb3J0IHtOQU1FRF9FTlRJVElFU30gZnJvbSAnLi9lbnRpdGllcyc7XG5pbXBvcnQge3Rva2VuaXplLCBUb2tlbml6ZU9wdGlvbnN9IGZyb20gJy4vbGV4ZXInO1xuaW1wb3J0IHtnZXROc1ByZWZpeCwgbWVyZ2VOc0FuZE5hbWUsIHNwbGl0TnNOYW1lLCBUYWdEZWZpbml0aW9ufSBmcm9tICcuL3RhZ3MnO1xuaW1wb3J0IHtBdHRyaWJ1dGVOYW1lVG9rZW4sIEF0dHJpYnV0ZVF1b3RlVG9rZW4sIEJsb2NrR3JvdXBDbG9zZVRva2VuLCBCbG9ja0dyb3VwT3BlblN0YXJ0VG9rZW4sIEJsb2NrT3BlblN0YXJ0VG9rZW4sIEJsb2NrUGFyYW1ldGVyVG9rZW4sIENkYXRhU3RhcnRUb2tlbiwgQ29tbWVudFN0YXJ0VG9rZW4sIEV4cGFuc2lvbkNhc2VFeHByZXNzaW9uRW5kVG9rZW4sIEV4cGFuc2lvbkNhc2VFeHByZXNzaW9uU3RhcnRUb2tlbiwgRXhwYW5zaW9uQ2FzZVZhbHVlVG9rZW4sIEV4cGFuc2lvbkZvcm1TdGFydFRva2VuLCBJbmNvbXBsZXRlVGFnT3BlblRva2VuLCBJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbiwgSW50ZXJwb2xhdGVkVGV4dFRva2VuLCBUYWdDbG9zZVRva2VuLCBUYWdPcGVuU3RhcnRUb2tlbiwgVGV4dFRva2VuLCBUb2tlbiwgVG9rZW5UeXBlfSBmcm9tICcuL3Rva2Vucyc7XG5cbi8qKiBOb2RlcyB0aGF0IGNhbiBjb250YWluIG90aGVyIG5vZGVzLiAqL1xudHlwZSBOb2RlQ29udGFpbmVyID0gaHRtbC5FbGVtZW50fGh0bWwuQmxvY2t8aHRtbC5CbG9ja0dyb3VwO1xuXG4vKiogQ2xhc3MgdGhhdCBjYW4gY29uc3RydWN0IGEgYE5vZGVDb250YWluZXJgLiAqL1xuaW50ZXJmYWNlIE5vZGVDb250YWluZXJDb25zdHJ1Y3RvciBleHRlbmRzIEZ1bmN0aW9uIHtcbiAgbmV3KC4uLmFyZ3M6IGFueVtdKTogTm9kZUNvbnRhaW5lcjtcbn1cblxuZXhwb3J0IGNsYXNzIFRyZWVFcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBzdGF0aWMgY3JlYXRlKGVsZW1lbnROYW1lOiBzdHJpbmd8bnVsbCwgc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBtc2c6IHN0cmluZyk6IFRyZWVFcnJvciB7XG4gICAgcmV0dXJuIG5ldyBUcmVlRXJyb3IoZWxlbWVudE5hbWUsIHNwYW4sIG1zZyk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZWxlbWVudE5hbWU6IHN0cmluZ3xudWxsLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIG1zZzogc3RyaW5nKSB7XG4gICAgc3VwZXIoc3BhbiwgbXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VUcmVlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHJvb3ROb2RlczogaHRtbC5Ob2RlW10sIHB1YmxpYyBlcnJvcnM6IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBnZXRUYWdEZWZpbml0aW9uOiAodGFnTmFtZTogc3RyaW5nKSA9PiBUYWdEZWZpbml0aW9uKSB7fVxuXG4gIHBhcnNlKHNvdXJjZTogc3RyaW5nLCB1cmw6IHN0cmluZywgb3B0aW9ucz86IFRva2VuaXplT3B0aW9ucyk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gICAgY29uc3QgdG9rZW5pemVSZXN1bHQgPSB0b2tlbml6ZShzb3VyY2UsIHVybCwgdGhpcy5nZXRUYWdEZWZpbml0aW9uLCBvcHRpb25zKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgX1RyZWVCdWlsZGVyKHRva2VuaXplUmVzdWx0LnRva2VucywgdGhpcy5nZXRUYWdEZWZpbml0aW9uKTtcbiAgICBwYXJzZXIuYnVpbGQoKTtcbiAgICByZXR1cm4gbmV3IFBhcnNlVHJlZVJlc3VsdChcbiAgICAgICAgcGFyc2VyLnJvb3ROb2RlcyxcbiAgICAgICAgKHRva2VuaXplUmVzdWx0LmVycm9ycyBhcyBQYXJzZUVycm9yW10pLmNvbmNhdChwYXJzZXIuZXJyb3JzKSxcbiAgICApO1xuICB9XG59XG5cbmNsYXNzIF9UcmVlQnVpbGRlciB7XG4gIHByaXZhdGUgX2luZGV4OiBudW1iZXIgPSAtMTtcbiAgLy8gYF9wZWVrYCB3aWxsIGJlIGluaXRpYWxpemVkIGJ5IHRoZSBjYWxsIHRvIGBfYWR2YW5jZSgpYCBpbiB0aGUgY29uc3RydWN0b3IuXG4gIHByaXZhdGUgX3BlZWshOiBUb2tlbjtcbiAgcHJpdmF0ZSBfY29udGFpbmVyU3RhY2s6IE5vZGVDb250YWluZXJbXSA9IFtdO1xuXG4gIHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBbXTtcbiAgZXJyb3JzOiBUcmVlRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0b2tlbnM6IFRva2VuW10sIHByaXZhdGUgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbikge1xuICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgfVxuXG4gIGJ1aWxkKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgIT09IFRva2VuVHlwZS5FT0YpIHtcbiAgICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5UQUdfT1BFTl9TVEFSVCB8fFxuICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLklOQ09NUExFVEVfVEFHX09QRU4pIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZVN0YXJ0VGFnKHRoaXMuX2FkdmFuY2U8VGFnT3BlblN0YXJ0VG9rZW58SW5jb21wbGV0ZVRhZ09wZW5Ub2tlbj4oKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlRBR19DTE9TRSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRW5kVGFnKHRoaXMuX2FkdmFuY2U8VGFnQ2xvc2VUb2tlbj4oKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkNEQVRBX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUNkYXRhKHRoaXMuX2FkdmFuY2U8Q2RhdGFTdGFydFRva2VuPigpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQ09NTUVOVF9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVDb21tZW50KHRoaXMuX2FkdmFuY2U8Q29tbWVudFN0YXJ0VG9rZW4+KCkpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5URVhUIHx8IHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlJBV19URVhUIHx8XG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVNDQVBBQkxFX1JBV19URVhUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZVRleHQodGhpcy5fYWR2YW5jZTxUZXh0VG9rZW4+KCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uKHRoaXMuX2FkdmFuY2U8RXhwYW5zaW9uRm9ybVN0YXJ0VG9rZW4+KCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5CTE9DS19HUk9VUF9PUEVOX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUJsb2NrR3JvdXBPcGVuKHRoaXMuX2FkdmFuY2U8QmxvY2tHcm91cE9wZW5TdGFydFRva2VuPigpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQkxPQ0tfT1BFTl9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVCbG9jayh0aGlzLl9hZHZhbmNlPEJsb2NrT3BlblN0YXJ0VG9rZW4+KCksIFRva2VuVHlwZS5CTE9DS19PUEVOX0VORCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkJMT0NLX0dST1VQX0NMT1NFKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUJsb2NrR3JvdXBDbG9zZSh0aGlzLl9hZHZhbmNlPEJsb2NrR3JvdXBDbG9zZVRva2VuPigpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNraXAgYWxsIG90aGVyIHRva2Vucy4uLlxuICAgICAgICB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYWR2YW5jZTxUIGV4dGVuZHMgVG9rZW4+KCk6IFQge1xuICAgIGNvbnN0IHByZXYgPSB0aGlzLl9wZWVrO1xuICAgIGlmICh0aGlzLl9pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCAtIDEpIHtcbiAgICAgIC8vIE5vdGU6IHRoZXJlIGlzIGFsd2F5cyBhbiBFT0YgdG9rZW4gYXQgdGhlIGVuZFxuICAgICAgdGhpcy5faW5kZXgrKztcbiAgICB9XG4gICAgdGhpcy5fcGVlayA9IHRoaXMudG9rZW5zW3RoaXMuX2luZGV4XTtcbiAgICByZXR1cm4gcHJldiBhcyBUO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWR2YW5jZUlmPFQgZXh0ZW5kcyBUb2tlblR5cGU+KHR5cGU6IFQpOiAoVG9rZW4me3R5cGU6IFR9KXxudWxsIHtcbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSB0eXBlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYWR2YW5jZTxUb2tlbiZ7dHlwZTogVH0+KCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUNkYXRhKF9zdGFydFRva2VuOiBDZGF0YVN0YXJ0VG9rZW4pIHtcbiAgICB0aGlzLl9jb25zdW1lVGV4dCh0aGlzLl9hZHZhbmNlPFRleHRUb2tlbj4oKSk7XG4gICAgdGhpcy5fYWR2YW5jZUlmKFRva2VuVHlwZS5DREFUQV9FTkQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUNvbW1lbnQodG9rZW46IENvbW1lbnRTdGFydFRva2VuKSB7XG4gICAgY29uc3QgdGV4dCA9IHRoaXMuX2FkdmFuY2VJZihUb2tlblR5cGUuUkFXX1RFWFQpO1xuICAgIGNvbnN0IGVuZFRva2VuID0gdGhpcy5fYWR2YW5jZUlmKFRva2VuVHlwZS5DT01NRU5UX0VORCk7XG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0ICE9IG51bGwgPyB0ZXh0LnBhcnRzWzBdLnRyaW0oKSA6IG51bGw7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IGVuZFRva2VuID09IG51bGwgP1xuICAgICAgICB0b2tlbi5zb3VyY2VTcGFuIDpcbiAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgIHRva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZFRva2VuLnNvdXJjZVNwYW4uZW5kLCB0b2tlbi5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuQ29tbWVudCh2YWx1ZSwgc291cmNlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbih0b2tlbjogRXhwYW5zaW9uRm9ybVN0YXJ0VG9rZW4pIHtcbiAgICBjb25zdCBzd2l0Y2hWYWx1ZSA9IHRoaXMuX2FkdmFuY2U8VGV4dFRva2VuPigpO1xuXG4gICAgY29uc3QgdHlwZSA9IHRoaXMuX2FkdmFuY2U8VGV4dFRva2VuPigpO1xuICAgIGNvbnN0IGNhc2VzOiBodG1sLkV4cGFuc2lvbkNhc2VbXSA9IFtdO1xuXG4gICAgLy8gcmVhZCA9XG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX1ZBTFVFKSB7XG4gICAgICBjb25zdCBleHBDYXNlID0gdGhpcy5fcGFyc2VFeHBhbnNpb25DYXNlKCk7XG4gICAgICBpZiAoIWV4cENhc2UpIHJldHVybjsgIC8vIGVycm9yXG4gICAgICBjYXNlcy5wdXNoKGV4cENhc2UpO1xuICAgIH1cblxuICAgIC8vIHJlYWQgdGhlIGZpbmFsIH1cbiAgICBpZiAodGhpcy5fcGVlay50eXBlICE9PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fRU5EKSB7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgdG9rZW4uc291cmNlU3Bhbi5zdGFydCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLmVuZCwgdG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIHRoaXMuX2FkZFRvUGFyZW50KG5ldyBodG1sLkV4cGFuc2lvbihcbiAgICAgICAgc3dpdGNoVmFsdWUucGFydHNbMF0sIHR5cGUucGFydHNbMF0sIGNhc2VzLCBzb3VyY2VTcGFuLCBzd2l0Y2hWYWx1ZS5zb3VyY2VTcGFuKSk7XG5cbiAgICB0aGlzLl9hZHZhbmNlKCk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUV4cGFuc2lvbkNhc2UoKTogaHRtbC5FeHBhbnNpb25DYXNlfG51bGwge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5fYWR2YW5jZTxFeHBhbnNpb25DYXNlVmFsdWVUb2tlbj4oKTtcblxuICAgIC8vIHJlYWQge1xuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgIT09IFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCB0aGlzLl9wZWVrLnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd7Jy5gKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZWFkIHVudGlsIH1cbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2FkdmFuY2U8RXhwYW5zaW9uQ2FzZUV4cHJlc3Npb25TdGFydFRva2VuPigpO1xuXG4gICAgY29uc3QgZXhwID0gdGhpcy5fY29sbGVjdEV4cGFuc2lvbkV4cFRva2VucyhzdGFydCk7XG4gICAgaWYgKCFleHApIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZW5kID0gdGhpcy5fYWR2YW5jZTxFeHBhbnNpb25DYXNlRXhwcmVzc2lvbkVuZFRva2VuPigpO1xuICAgIGV4cC5wdXNoKHt0eXBlOiBUb2tlblR5cGUuRU9GLCBwYXJ0czogW10sIHNvdXJjZVNwYW46IGVuZC5zb3VyY2VTcGFufSk7XG5cbiAgICAvLyBwYXJzZSBldmVyeXRoaW5nIGluIGJldHdlZW4geyBhbmQgfVxuICAgIGNvbnN0IGV4cGFuc2lvbkNhc2VQYXJzZXIgPSBuZXcgX1RyZWVCdWlsZGVyKGV4cCwgdGhpcy5nZXRUYWdEZWZpbml0aW9uKTtcbiAgICBleHBhbnNpb25DYXNlUGFyc2VyLmJ1aWxkKCk7XG4gICAgaWYgKGV4cGFuc2lvbkNhc2VQYXJzZXIuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuZXJyb3JzID0gdGhpcy5lcnJvcnMuY29uY2F0KGV4cGFuc2lvbkNhc2VQYXJzZXIuZXJyb3JzKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNvdXJjZVNwYW4gPVxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKHZhbHVlLnNvdXJjZVNwYW4uc3RhcnQsIGVuZC5zb3VyY2VTcGFuLmVuZCwgdmFsdWUuc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIGNvbnN0IGV4cFNvdXJjZVNwYW4gPVxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LnNvdXJjZVNwYW4uc3RhcnQsIGVuZC5zb3VyY2VTcGFuLmVuZCwgc3RhcnQuc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIHJldHVybiBuZXcgaHRtbC5FeHBhbnNpb25DYXNlKFxuICAgICAgICB2YWx1ZS5wYXJ0c1swXSwgZXhwYW5zaW9uQ2FzZVBhcnNlci5yb290Tm9kZXMsIHNvdXJjZVNwYW4sIHZhbHVlLnNvdXJjZVNwYW4sIGV4cFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29sbGVjdEV4cGFuc2lvbkV4cFRva2VucyhzdGFydDogVG9rZW4pOiBUb2tlbltdfG51bGwge1xuICAgIGNvbnN0IGV4cDogVG9rZW5bXSA9IFtdO1xuICAgIGNvbnN0IGV4cGFuc2lvbkZvcm1TdGFjayA9IFtUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUXTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQgfHxcbiAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpIHtcbiAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnB1c2godGhpcy5fcGVlay50eXBlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9FTkQpIHtcbiAgICAgICAgaWYgKGxhc3RPblN0YWNrKGV4cGFuc2lvbkZvcm1TdGFjaywgVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkpIHtcbiAgICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucG9wKCk7XG4gICAgICAgICAgaWYgKGV4cGFuc2lvbkZvcm1TdGFjay5sZW5ndGggPT09IDApIHJldHVybiBleHA7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX0VORCkge1xuICAgICAgICBpZiAobGFzdE9uU3RhY2soZXhwYW5zaW9uRm9ybVN0YWNrLCBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQpKSB7XG4gICAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnBvcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgc3RhcnQuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ30nLmApKTtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRU9GKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBleHAucHVzaCh0aGlzLl9hZHZhbmNlKCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUZXh0KHRva2VuOiBJbnRlcnBvbGF0ZWRUZXh0VG9rZW4pIHtcbiAgICBjb25zdCB0b2tlbnMgPSBbdG9rZW5dO1xuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IHRva2VuLnNvdXJjZVNwYW47XG4gICAgbGV0IHRleHQgPSB0b2tlbi5wYXJ0c1swXTtcbiAgICBpZiAodGV4dC5sZW5ndGggPiAwICYmIHRleHRbMF0gPT09ICdcXG4nKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRDb250YWluZXIoKTtcblxuICAgICAgLy8gVGhpcyBpcyB1bmxpa2VseSB0byBoYXBwZW4sIGJ1dCB3ZSBoYXZlIGFuIGFzc2VydGlvbiBqdXN0IGluIGNhc2UuXG4gICAgICBpZiAocGFyZW50IGluc3RhbmNlb2YgaHRtbC5CbG9ja0dyb3VwKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShcbiAgICAgICAgICAgIG51bGwsIHN0YXJ0U3BhbiwgJ1RleHQgY2Fubm90IGJlIHBsYWNlZCBkaXJlY3RseSBpbnNpZGUgb2YgYSBibG9jayBncm91cC4nKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHBhcmVudCAhPSBudWxsICYmIHBhcmVudC5jaGlsZHJlbi5sZW5ndGggPT09IDAgJiZcbiAgICAgICAgICB0aGlzLmdldFRhZ0RlZmluaXRpb24ocGFyZW50Lm5hbWUpLmlnbm9yZUZpcnN0TGYpIHtcbiAgICAgICAgdGV4dCA9IHRleHQuc3Vic3RyaW5nKDEpO1xuICAgICAgICB0b2tlbnNbMF0gPSB7dHlwZTogdG9rZW4udHlwZSwgc291cmNlU3BhbjogdG9rZW4uc291cmNlU3BhbiwgcGFydHM6IFt0ZXh0XX0gYXMgdHlwZW9mIHRva2VuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5JTlRFUlBPTEFUSU9OIHx8IHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlRFWFQgfHxcbiAgICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRU5DT0RFRF9FTlRJVFkpIHtcbiAgICAgIHRva2VuID0gdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgaWYgKHRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5JTlRFUlBPTEFUSU9OKSB7XG4gICAgICAgIC8vIEZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdlIGRlY29kZSBIVE1MIGVudGl0aWVzIHRoYXQgYXBwZWFyIGluIGludGVycG9sYXRpb25cbiAgICAgICAgLy8gZXhwcmVzc2lvbnMuIFRoaXMgaXMgYXJndWFibHkgYSBidWcsIGJ1dCBpdCBjb3VsZCBiZSBhIGNvbnNpZGVyYWJsZSBicmVha2luZyBjaGFuZ2UgdG9cbiAgICAgICAgLy8gZml4IGl0LiBJdCBzaG91bGQgYmUgYWRkcmVzc2VkIGluIGEgbGFyZ2VyIHByb2plY3QgdG8gcmVmYWN0b3IgdGhlIGVudGlyZSBwYXJzZXIvbGV4ZXJcbiAgICAgICAgLy8gY2hhaW4gYWZ0ZXIgVmlldyBFbmdpbmUgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgICAgdGV4dCArPSB0b2tlbi5wYXJ0cy5qb2luKCcnKS5yZXBsYWNlKC8mKFteO10rKTsvZywgZGVjb2RlRW50aXR5KTtcbiAgICAgIH0gZWxzZSBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkVOQ09ERURfRU5USVRZKSB7XG4gICAgICAgIHRleHQgKz0gdG9rZW4ucGFydHNbMF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZXh0ICs9IHRva2VuLnBhcnRzLmpvaW4oJycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGVuZFNwYW4gPSB0b2tlbi5zb3VyY2VTcGFuO1xuICAgICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuVGV4dChcbiAgICAgICAgICB0ZXh0LFxuICAgICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnRTcGFuLnN0YXJ0LCBlbmRTcGFuLmVuZCwgc3RhcnRTcGFuLmZ1bGxTdGFydCwgc3RhcnRTcGFuLmRldGFpbHMpLFxuICAgICAgICAgIHRva2VucykpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2Nsb3NlVm9pZEVsZW1lbnQoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLl9nZXRDb250YWluZXIoKTtcbiAgICBpZiAoZWwgaW5zdGFuY2VvZiBodG1sLkVsZW1lbnQgJiYgdGhpcy5nZXRUYWdEZWZpbml0aW9uKGVsLm5hbWUpLmlzVm9pZCkge1xuICAgICAgdGhpcy5fY29udGFpbmVyU3RhY2sucG9wKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVN0YXJ0VGFnKHN0YXJ0VGFnVG9rZW46IFRhZ09wZW5TdGFydFRva2VufEluY29tcGxldGVUYWdPcGVuVG9rZW4pIHtcbiAgICBjb25zdCBbcHJlZml4LCBuYW1lXSA9IHN0YXJ0VGFnVG9rZW4ucGFydHM7XG4gICAgY29uc3QgYXR0cnM6IGh0bWwuQXR0cmlidXRlW10gPSBbXTtcbiAgICB3aGlsZSAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQVRUUl9OQU1FKSB7XG4gICAgICBhdHRycy5wdXNoKHRoaXMuX2NvbnN1bWVBdHRyKHRoaXMuX2FkdmFuY2U8QXR0cmlidXRlTmFtZVRva2VuPigpKSk7XG4gICAgfVxuICAgIGNvbnN0IGZ1bGxOYW1lID0gdGhpcy5fZ2V0RWxlbWVudEZ1bGxOYW1lKHByZWZpeCwgbmFtZSwgdGhpcy5fZ2V0Q2xvc2VzdFBhcmVudEVsZW1lbnQoKSk7XG4gICAgbGV0IHNlbGZDbG9zaW5nID0gZmFsc2U7XG4gICAgLy8gTm90ZTogVGhlcmUgY291bGQgaGF2ZSBiZWVuIGEgdG9rZW5pemVyIGVycm9yXG4gICAgLy8gc28gdGhhdCB3ZSBkb24ndCBnZXQgYSB0b2tlbiBmb3IgdGhlIGVuZCB0YWcuLi5cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSUQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHNlbGZDbG9zaW5nID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHRhZ0RlZiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSk7XG4gICAgICBpZiAoISh0YWdEZWYuY2FuU2VsZkNsb3NlIHx8IGdldE5zUHJlZml4KGZ1bGxOYW1lKSAhPT0gbnVsbCB8fCB0YWdEZWYuaXNWb2lkKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoXG4gICAgICAgICAgICBmdWxsTmFtZSwgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgYE9ubHkgdm9pZCwgY3VzdG9tIGFuZCBmb3JlaWduIGVsZW1lbnRzIGNhbiBiZSBzZWxmIGNsb3NlZCBcIiR7XG4gICAgICAgICAgICAgICAgc3RhcnRUYWdUb2tlbi5wYXJ0c1sxXX1cImApKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlRBR19PUEVOX0VORCkge1xuICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgc2VsZkNsb3NpbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgZW5kID0gdGhpcy5fcGVlay5zb3VyY2VTcGFuLmZ1bGxTdGFydDtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLnN0YXJ0LCBlbmQsIHN0YXJ0VGFnVG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIC8vIENyZWF0ZSBhIHNlcGFyYXRlIGBzdGFydFNwYW5gIGJlY2F1c2UgYHNwYW5gIHdpbGwgYmUgbW9kaWZpZWQgd2hlbiB0aGVyZSBpcyBhbiBgZW5kYCBzcGFuLlxuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgIHN0YXJ0VGFnVG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICBjb25zdCBlbCA9IG5ldyBodG1sLkVsZW1lbnQoZnVsbE5hbWUsIGF0dHJzLCBbXSwgc3Bhbiwgc3RhcnRTcGFuLCB1bmRlZmluZWQpO1xuICAgIGNvbnN0IHBhcmVudEVsID0gdGhpcy5fZ2V0Q29udGFpbmVyKCk7XG4gICAgdGhpcy5fcHVzaENvbnRhaW5lcihcbiAgICAgICAgZWwsXG4gICAgICAgIHBhcmVudEVsIGluc3RhbmNlb2YgaHRtbC5FbGVtZW50ICYmXG4gICAgICAgICAgICB0aGlzLmdldFRhZ0RlZmluaXRpb24ocGFyZW50RWwubmFtZSkuaXNDbG9zZWRCeUNoaWxkKGVsLm5hbWUpKTtcbiAgICBpZiAoc2VsZkNsb3NpbmcpIHtcbiAgICAgIC8vIEVsZW1lbnRzIHRoYXQgYXJlIHNlbGYtY2xvc2VkIGhhdmUgdGhlaXIgYGVuZFNvdXJjZVNwYW5gIHNldCB0byB0aGUgZnVsbCBzcGFuLCBhcyB0aGVcbiAgICAgIC8vIGVsZW1lbnQgc3RhcnQgdGFnIGFsc28gcmVwcmVzZW50cyB0aGUgZW5kIHRhZy5cbiAgICAgIHRoaXMuX3BvcENvbnRhaW5lcihmdWxsTmFtZSwgaHRtbC5FbGVtZW50LCBzcGFuKTtcbiAgICB9IGVsc2UgaWYgKHN0YXJ0VGFnVG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLklOQ09NUExFVEVfVEFHX09QRU4pIHtcbiAgICAgIC8vIFdlIGFscmVhZHkga25vdyB0aGUgb3BlbmluZyB0YWcgaXMgbm90IGNvbXBsZXRlLCBzbyBpdCBpcyB1bmxpa2VseSBpdCBoYXMgYSBjb3JyZXNwb25kaW5nXG4gICAgICAvLyBjbG9zZSB0YWcuIExldCdzIG9wdGltaXN0aWNhbGx5IHBhcnNlIGl0IGFzIGEgZnVsbCBlbGVtZW50IGFuZCBlbWl0IGFuIGVycm9yLlxuICAgICAgdGhpcy5fcG9wQ29udGFpbmVyKGZ1bGxOYW1lLCBodG1sLkVsZW1lbnQsIG51bGwpO1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKGZ1bGxOYW1lLCBzcGFuLCBgT3BlbmluZyB0YWcgXCIke2Z1bGxOYW1lfVwiIG5vdCB0ZXJtaW5hdGVkLmApKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wdXNoQ29udGFpbmVyKG5vZGU6IE5vZGVDb250YWluZXIsIGlzQ2xvc2VkQnlDaGlsZDogYm9vbGVhbikge1xuICAgIGlmIChpc0Nsb3NlZEJ5Q2hpbGQpIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lclN0YWNrLnBvcCgpO1xuICAgIH1cblxuICAgIHRoaXMuX2FkZFRvUGFyZW50KG5vZGUpO1xuICAgIHRoaXMuX2NvbnRhaW5lclN0YWNrLnB1c2gobm9kZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRW5kVGFnKGVuZFRhZ1Rva2VuOiBUYWdDbG9zZVRva2VuKSB7XG4gICAgY29uc3QgZnVsbE5hbWUgPSB0aGlzLl9nZXRFbGVtZW50RnVsbE5hbWUoXG4gICAgICAgIGVuZFRhZ1Rva2VuLnBhcnRzWzBdLCBlbmRUYWdUb2tlbi5wYXJ0c1sxXSwgdGhpcy5fZ2V0Q2xvc2VzdFBhcmVudEVsZW1lbnQoKSk7XG5cbiAgICBpZiAodGhpcy5nZXRUYWdEZWZpbml0aW9uKGZ1bGxOYW1lKS5pc1ZvaWQpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShcbiAgICAgICAgICBmdWxsTmFtZSwgZW5kVGFnVG9rZW4uc291cmNlU3BhbixcbiAgICAgICAgICBgVm9pZCBlbGVtZW50cyBkbyBub3QgaGF2ZSBlbmQgdGFncyBcIiR7ZW5kVGFnVG9rZW4ucGFydHNbMV19XCJgKSk7XG4gICAgfSBlbHNlIGlmICghdGhpcy5fcG9wQ29udGFpbmVyKGZ1bGxOYW1lLCBodG1sLkVsZW1lbnQsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4pKSB7XG4gICAgICBjb25zdCBlcnJNc2cgPSBgVW5leHBlY3RlZCBjbG9zaW5nIHRhZyBcIiR7XG4gICAgICAgICAgZnVsbE5hbWV9XCIuIEl0IG1heSBoYXBwZW4gd2hlbiB0aGUgdGFnIGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkIGJ5IGFub3RoZXIgdGFnLiBGb3IgbW9yZSBpbmZvIHNlZSBodHRwczovL3d3dy53My5vcmcvVFIvaHRtbDUvc3ludGF4Lmh0bWwjY2xvc2luZy1lbGVtZW50cy10aGF0LWhhdmUtaW1wbGllZC1lbmQtdGFnc2A7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoZnVsbE5hbWUsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4sIGVyck1zZykpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZXMgdGhlIG5lYXJlc3QgZWxlbWVudCB3aXRoIHRoZSB0YWcgbmFtZSBgZnVsbE5hbWVgIGluIHRoZSBwYXJzZSB0cmVlLlxuICAgKiBgZW5kU291cmNlU3BhbmAgaXMgdGhlIHNwYW4gb2YgdGhlIGNsb3NpbmcgdGFnLCBvciBudWxsIGlmIHRoZSBlbGVtZW50IGRvZXNcbiAgICogbm90IGhhdmUgYSBjbG9zaW5nIHRhZyAoZm9yIGV4YW1wbGUsIHRoaXMgaGFwcGVucyB3aGVuIGFuIGluY29tcGxldGVcbiAgICogb3BlbmluZyB0YWcgaXMgcmVjb3ZlcmVkKS5cbiAgICovXG4gIHByaXZhdGUgX3BvcENvbnRhaW5lcihcbiAgICAgIGZ1bGxOYW1lOiBzdHJpbmcsIGV4cGVjdGVkVHlwZTogTm9kZUNvbnRhaW5lckNvbnN0cnVjdG9yLFxuICAgICAgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBib29sZWFuIHtcbiAgICBsZXQgdW5leHBlY3RlZENsb3NlVGFnRGV0ZWN0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBzdGFja0luZGV4ID0gdGhpcy5fY29udGFpbmVyU3RhY2subGVuZ3RoIC0gMTsgc3RhY2tJbmRleCA+PSAwOyBzdGFja0luZGV4LS0pIHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLl9jb250YWluZXJTdGFja1tzdGFja0luZGV4XTtcbiAgICAgIGNvbnN0IG5hbWUgPSBub2RlIGluc3RhbmNlb2YgaHRtbC5CbG9ja0dyb3VwID8gbm9kZS5ibG9ja3NbMF0/Lm5hbWUgOiBub2RlLm5hbWU7XG5cbiAgICAgIGlmIChuYW1lID09PSBmdWxsTmFtZSAmJiBub2RlIGluc3RhbmNlb2YgZXhwZWN0ZWRUeXBlKSB7XG4gICAgICAgIC8vIFJlY29yZCB0aGUgcGFyc2Ugc3BhbiB3aXRoIHRoZSBlbGVtZW50IHRoYXQgaXMgYmVpbmcgY2xvc2VkLiBBbnkgZWxlbWVudHMgdGhhdCBhcmVcbiAgICAgICAgLy8gcmVtb3ZlZCBmcm9tIHRoZSBlbGVtZW50IHN0YWNrIGF0IHRoaXMgcG9pbnQgYXJlIGNsb3NlZCBpbXBsaWNpdGx5LCBzbyB0aGV5IHdvbid0IGdldFxuICAgICAgICAvLyBhbiBlbmQgc291cmNlIHNwYW4gKGFzIHRoZXJlIGlzIG5vIGV4cGxpY2l0IGNsb3NpbmcgZWxlbWVudCkuXG4gICAgICAgIG5vZGUuZW5kU291cmNlU3BhbiA9IGVuZFNvdXJjZVNwYW47XG4gICAgICAgIG5vZGUuc291cmNlU3Bhbi5lbmQgPSBlbmRTb3VyY2VTcGFuICE9PSBudWxsID8gZW5kU291cmNlU3Bhbi5lbmQgOiBub2RlLnNvdXJjZVNwYW4uZW5kO1xuICAgICAgICB0aGlzLl9jb250YWluZXJTdGFjay5zcGxpY2Uoc3RhY2tJbmRleCwgdGhpcy5fY29udGFpbmVyU3RhY2subGVuZ3RoIC0gc3RhY2tJbmRleCk7XG4gICAgICAgIHJldHVybiAhdW5leHBlY3RlZENsb3NlVGFnRGV0ZWN0ZWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIEJsb2NrcyBhcmUgc2VsZi1jbG9zaW5nIHdoaWxlIGJsb2NrIGdyb3VwcyBhbmQgKG1vc3QgdGltZXMpIGVsZW1lbnRzIGFyZSBub3QuXG4gICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIGh0bWwuQmxvY2tHcm91cCB8fFxuICAgICAgICAgIG5vZGUgaW5zdGFuY2VvZiBodG1sLkVsZW1lbnQgJiYgIXRoaXMuZ2V0VGFnRGVmaW5pdGlvbihub2RlLm5hbWUpLmNsb3NlZEJ5UGFyZW50KSB7XG4gICAgICAgIC8vIE5vdGUgdGhhdCB3ZSBlbmNvdW50ZXJlZCBhbiB1bmV4cGVjdGVkIGNsb3NlIHRhZyBidXQgY29udGludWUgcHJvY2Vzc2luZyB0aGUgZWxlbWVudFxuICAgICAgICAvLyBzdGFjayBzbyB3ZSBjYW4gYXNzaWduIGFuIGBlbmRTb3VyY2VTcGFuYCBpZiB0aGVyZSBpcyBhIGNvcnJlc3BvbmRpbmcgc3RhcnQgdGFnIGZvciB0aGlzXG4gICAgICAgIC8vIGVuZCB0YWcgaW4gdGhlIHN0YWNrLlxuICAgICAgICB1bmV4cGVjdGVkQ2xvc2VUYWdEZXRlY3RlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVBdHRyKGF0dHJOYW1lOiBBdHRyaWJ1dGVOYW1lVG9rZW4pOiBodG1sLkF0dHJpYnV0ZSB7XG4gICAgY29uc3QgZnVsbE5hbWUgPSBtZXJnZU5zQW5kTmFtZShhdHRyTmFtZS5wYXJ0c1swXSwgYXR0ck5hbWUucGFydHNbMV0pO1xuICAgIGxldCBhdHRyRW5kID0gYXR0ck5hbWUuc291cmNlU3Bhbi5lbmQ7XG5cbiAgICAvLyBDb25zdW1lIGFueSBxdW90ZVxuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5BVFRSX1FVT1RFKSB7XG4gICAgICB0aGlzLl9hZHZhbmNlKCk7XG4gICAgfVxuXG4gICAgLy8gQ29uc3VtZSB0aGUgYXR0cmlidXRlIHZhbHVlXG4gICAgbGV0IHZhbHVlID0gJyc7XG4gICAgY29uc3QgdmFsdWVUb2tlbnM6IEludGVycG9sYXRlZEF0dHJpYnV0ZVRva2VuW10gPSBbXTtcbiAgICBsZXQgdmFsdWVTdGFydFNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHZhbHVlRW5kOiBQYXJzZUxvY2F0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAvLyBOT1RFOiBXZSBuZWVkIHRvIHVzZSBhIG5ldyB2YXJpYWJsZSBgbmV4dFRva2VuVHlwZWAgaGVyZSB0byBoaWRlIHRoZSBhY3R1YWwgdHlwZSBvZlxuICAgIC8vIGBfcGVlay50eXBlYCBmcm9tIFRTLiBPdGhlcndpc2UgVFMgd2lsbCBuYXJyb3cgdGhlIHR5cGUgb2YgYF9wZWVrLnR5cGVgIHByZXZlbnRpbmcgaXQgZnJvbVxuICAgIC8vIGJlaW5nIGFibGUgdG8gY29uc2lkZXIgYEFUVFJfVkFMVUVfSU5URVJQT0xBVElPTmAgYXMgYW4gb3B0aW9uLiBUaGlzIGlzIGJlY2F1c2UgVFMgaXMgbm90XG4gICAgLy8gYWJsZSB0byBzZWUgdGhhdCBgX2FkdmFuY2UoKWAgd2lsbCBhY3R1YWxseSBtdXRhdGUgYF9wZWVrYC5cbiAgICBjb25zdCBuZXh0VG9rZW5UeXBlID0gdGhpcy5fcGVlay50eXBlIGFzIFRva2VuVHlwZTtcbiAgICBpZiAobmV4dFRva2VuVHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfVkFMVUVfVEVYVCkge1xuICAgICAgdmFsdWVTdGFydFNwYW4gPSB0aGlzLl9wZWVrLnNvdXJjZVNwYW47XG4gICAgICB2YWx1ZUVuZCA9IHRoaXMuX3BlZWsuc291cmNlU3Bhbi5lbmQ7XG4gICAgICB3aGlsZSAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQVRUUl9WQUxVRV9URVhUIHx8XG4gICAgICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQVRUUl9WQUxVRV9JTlRFUlBPTEFUSU9OIHx8XG4gICAgICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRU5DT0RFRF9FTlRJVFkpIHtcbiAgICAgICAgY29uc3QgdmFsdWVUb2tlbiA9IHRoaXMuX2FkdmFuY2U8SW50ZXJwb2xhdGVkQXR0cmlidXRlVG9rZW4+KCk7XG4gICAgICAgIHZhbHVlVG9rZW5zLnB1c2godmFsdWVUb2tlbik7XG4gICAgICAgIGlmICh2YWx1ZVRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5BVFRSX1ZBTFVFX0lOVEVSUE9MQVRJT04pIHtcbiAgICAgICAgICAvLyBGb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSB3ZSBkZWNvZGUgSFRNTCBlbnRpdGllcyB0aGF0IGFwcGVhciBpbiBpbnRlcnBvbGF0aW9uXG4gICAgICAgICAgLy8gZXhwcmVzc2lvbnMuIFRoaXMgaXMgYXJndWFibHkgYSBidWcsIGJ1dCBpdCBjb3VsZCBiZSBhIGNvbnNpZGVyYWJsZSBicmVha2luZyBjaGFuZ2UgdG9cbiAgICAgICAgICAvLyBmaXggaXQuIEl0IHNob3VsZCBiZSBhZGRyZXNzZWQgaW4gYSBsYXJnZXIgcHJvamVjdCB0byByZWZhY3RvciB0aGUgZW50aXJlIHBhcnNlci9sZXhlclxuICAgICAgICAgIC8vIGNoYWluIGFmdGVyIFZpZXcgRW5naW5lIGhhcyBiZWVuIHJlbW92ZWQuXG4gICAgICAgICAgdmFsdWUgKz0gdmFsdWVUb2tlbi5wYXJ0cy5qb2luKCcnKS5yZXBsYWNlKC8mKFteO10rKTsvZywgZGVjb2RlRW50aXR5KTtcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZVRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5FTkNPREVEX0VOVElUWSkge1xuICAgICAgICAgIHZhbHVlICs9IHZhbHVlVG9rZW4ucGFydHNbMF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgKz0gdmFsdWVUb2tlbi5wYXJ0cy5qb2luKCcnKTtcbiAgICAgICAgfVxuICAgICAgICB2YWx1ZUVuZCA9IGF0dHJFbmQgPSB2YWx1ZVRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbnN1bWUgYW55IHF1b3RlXG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfUVVPVEUpIHtcbiAgICAgIGNvbnN0IHF1b3RlVG9rZW4gPSB0aGlzLl9hZHZhbmNlPEF0dHJpYnV0ZVF1b3RlVG9rZW4+KCk7XG4gICAgICBhdHRyRW5kID0gcXVvdGVUb2tlbi5zb3VyY2VTcGFuLmVuZDtcbiAgICB9XG5cbiAgICBjb25zdCB2YWx1ZVNwYW4gPSB2YWx1ZVN0YXJ0U3BhbiAmJiB2YWx1ZUVuZCAmJlxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKHZhbHVlU3RhcnRTcGFuLnN0YXJ0LCB2YWx1ZUVuZCwgdmFsdWVTdGFydFNwYW4uZnVsbFN0YXJ0KTtcbiAgICByZXR1cm4gbmV3IGh0bWwuQXR0cmlidXRlKFxuICAgICAgICBmdWxsTmFtZSwgdmFsdWUsXG4gICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oYXR0ck5hbWUuc291cmNlU3Bhbi5zdGFydCwgYXR0ckVuZCwgYXR0ck5hbWUuc291cmNlU3Bhbi5mdWxsU3RhcnQpLFxuICAgICAgICBhdHRyTmFtZS5zb3VyY2VTcGFuLCB2YWx1ZVNwYW4sIHZhbHVlVG9rZW5zLmxlbmd0aCA+IDAgPyB2YWx1ZVRva2VucyA6IHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkKTtcbiAgfVxuXG5cbiAgcHJpdmF0ZSBfY29uc3VtZUJsb2NrR3JvdXBPcGVuKHRva2VuOiBCbG9ja0dyb3VwT3BlblN0YXJ0VG9rZW4pIHtcbiAgICBjb25zdCBlbmQgPSB0aGlzLl9wZWVrLnNvdXJjZVNwYW4uZnVsbFN0YXJ0O1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHRva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZCwgdG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIC8vIENyZWF0ZSBhIHNlcGFyYXRlIGBzdGFydFNwYW5gIGJlY2F1c2UgYHNwYW5gIHdpbGwgYmUgbW9kaWZpZWQgd2hlbiB0aGVyZSBpcyBhbiBgZW5kYCBzcGFuLlxuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4odG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCB0b2tlbi5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgY29uc3QgYmxvY2tHcm91cCA9IG5ldyBodG1sLkJsb2NrR3JvdXAoW10sIHNwYW4sIHN0YXJ0U3BhbiwgbnVsbCk7XG4gICAgdGhpcy5fcHVzaENvbnRhaW5lcihibG9ja0dyb3VwLCBmYWxzZSk7XG4gICAgY29uc3QgaW1wbGljaXRCbG9jayA9IHRoaXMuX2NvbnN1bWVCbG9jayh0b2tlbiwgVG9rZW5UeXBlLkJMT0NLX0dST1VQX09QRU5fRU5EKTtcblxuICAgIC8vIEJsb2NrIHBhcmFtZXRlcnMgYXJlIGNvbnN1bWVkIGFzIGEgcGFydCBvZiB0aGUgaW1wbGljaXQgYmxvY2sgc28gd2UgbmVlZCB0byBleHBhbmQgdGhlXG4gICAgLy8gc3RhcnQgc291cmNlIHNwYW4gb25jZSB0aGUgYmxvY2sgaXMgcGFyc2VkIHRvIGluY2x1ZGUgdGhlIGZ1bGwgb3BlbmluZyB0YWcuXG4gICAgc3RhcnRTcGFuLmVuZCA9IGltcGxpY2l0QmxvY2suc3RhcnRTb3VyY2VTcGFuLmVuZDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVCbG9jayhcbiAgICAgIHRva2VuOiBCbG9ja09wZW5TdGFydFRva2VufEJsb2NrR3JvdXBPcGVuU3RhcnRUb2tlbiwgY2xvc2VUb2tlbjogVG9rZW5UeXBlKSB7XG4gICAgLy8gVGhlIHN0YXJ0IG9mIGEgYmxvY2sgaW1wbGljaXRseSBjbG9zZXMgdGhlIHByZXZpb3VzIGJsb2NrLlxuICAgIHRoaXMuX2NvbmRpdGlvbmFsbHlDbG9zZVByZXZpb3VzQmxvY2soKTtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IGh0bWwuQmxvY2tQYXJhbWV0ZXJbXSA9IFtdO1xuXG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkJMT0NLX1BBUkFNRVRFUikge1xuICAgICAgY29uc3QgcGFyYW1Ub2tlbiA9IHRoaXMuX2FkdmFuY2U8QmxvY2tQYXJhbWV0ZXJUb2tlbj4oKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChuZXcgaHRtbC5CbG9ja1BhcmFtZXRlcihwYXJhbVRva2VuLnBhcnRzWzBdLCBwYXJhbVRva2VuLnNvdXJjZVNwYW4pKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBjbG9zZVRva2VuKSB7XG4gICAgICB0aGlzLl9hZHZhbmNlKCk7XG4gICAgfVxuXG4gICAgY29uc3QgZW5kID0gdGhpcy5fcGVlay5zb3VyY2VTcGFuLmZ1bGxTdGFydDtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU291cmNlU3Bhbih0b2tlbi5zb3VyY2VTcGFuLnN0YXJ0LCBlbmQsIHRva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICAvLyBDcmVhdGUgYSBzZXBhcmF0ZSBgc3RhcnRTcGFuYCBiZWNhdXNlIGBzcGFuYCB3aWxsIGJlIG1vZGlmaWVkIHdoZW4gdGhlcmUgaXMgYW4gYGVuZGAgc3Bhbi5cbiAgICBjb25zdCBzdGFydFNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHRva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZCwgdG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIGNvbnN0IGJsb2NrID0gbmV3IGh0bWwuQmxvY2sodG9rZW4ucGFydHNbMF0sIHBhcmFtZXRlcnMsIFtdLCBzcGFuLCBzdGFydFNwYW4pO1xuICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX2dldENvbnRhaW5lcigpO1xuXG4gICAgaWYgKCEocGFyZW50IGluc3RhbmNlb2YgaHRtbC5CbG9ja0dyb3VwKSkge1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChUcmVlRXJyb3IuY3JlYXRlKFxuICAgICAgICAgIGJsb2NrLm5hbWUsIGJsb2NrLnNvdXJjZVNwYW4sICdCbG9ja3MgY2FuIG9ubHkgYmUgcGxhY2VkIGluc2lkZSBvZiBibG9jayBncm91cHMuJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJlbnQuYmxvY2tzLnB1c2goYmxvY2spO1xuICAgICAgdGhpcy5fY29udGFpbmVyU3RhY2sucHVzaChibG9jayk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJsb2NrO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUJsb2NrR3JvdXBDbG9zZSh0b2tlbjogQmxvY2tHcm91cENsb3NlVG9rZW4pIHtcbiAgICBjb25zdCBuYW1lID0gdG9rZW4ucGFydHNbMF07XG4gICAgY29uc3QgcHJldmlvdXNDb250YWluZXIgPSB0aGlzLl9nZXRDb250YWluZXIoKTtcblxuICAgIC8vIEJsb2NrcyBhcmUgaW1wbGNpdGx5IGNsb3NlZCBieSB0aGUgYmxvY2sgZ3JvdXAuXG4gICAgdGhpcy5fY29uZGl0aW9uYWxseUNsb3NlUHJldmlvdXNCbG9jaygpO1xuXG4gICAgaWYgKCF0aGlzLl9wb3BDb250YWluZXIobmFtZSwgaHRtbC5CbG9ja0dyb3VwLCB0b2tlbi5zb3VyY2VTcGFuKSkge1xuICAgICAgY29uc3QgY29udGV4dCA9IHByZXZpb3VzQ29udGFpbmVyIGluc3RhbmNlb2YgaHRtbC5FbGVtZW50ID9cbiAgICAgICAgICBgVGhlcmUgaXMgYW4gdW5jbG9zZWQgXCIke1xuICAgICAgICAgICAgICBwcmV2aW91c0NvbnRhaW5lci5uYW1lfVwiIEhUTUwgdGFnIG5hbWVkIHRoYXQgbWF5IGhhdmUgdG8gYmUgY2xvc2VkIGZpcnN0LmAgOlxuICAgICAgICAgIGBUaGUgYmxvY2sgbWF5IGhhdmUgYmVlbiBjbG9zZWQgZWFybGllci5gO1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChUcmVlRXJyb3IuY3JlYXRlKFxuICAgICAgICAgIG5hbWUsIHRva2VuLnNvdXJjZVNwYW4sIGBVbmV4cGVjdGVkIGNsb3NpbmcgYmxvY2sgXCIke25hbWV9XCIuICR7Y29udGV4dH1gKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY29uZGl0aW9uYWxseUNsb3NlUHJldmlvdXNCbG9jaygpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLl9nZXRDb250YWluZXIoKTtcblxuICAgIGlmIChjb250YWluZXIgaW5zdGFuY2VvZiBodG1sLkJsb2NrKSB7XG4gICAgICAvLyBCbG9ja3MgZG9uJ3QgaGF2ZSBhbiBleHBsaWNpdCBjbG9zaW5nIHRhZywgdGhleSdyZSBjbG9zZWQgZWl0aGVyIGJ5IHRoZSBuZXh0IGJsb2NrIG9yXG4gICAgICAvLyB0aGUgZW5kIG9mIHRoZSBibG9jayBncm91cC4gSW5mZXIgdGhlIGVuZCBzcGFuIGZyb20gdGhlIGxhc3QgY2hpbGQgbm9kZS5cbiAgICAgIGNvbnN0IGxhc3RDaGlsZCA9XG4gICAgICAgICAgY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aCA/IGNvbnRhaW5lci5jaGlsZHJlbltjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoIC0gMV0gOiBudWxsO1xuICAgICAgY29uc3QgZW5kU3BhbiA9IGxhc3RDaGlsZCA9PT0gbnVsbCA/XG4gICAgICAgICAgbnVsbCA6XG4gICAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihsYXN0Q2hpbGQuc291cmNlU3Bhbi5lbmQsIGxhc3RDaGlsZC5zb3VyY2VTcGFuLmVuZCk7XG5cbiAgICAgIHRoaXMuX3BvcENvbnRhaW5lcihjb250YWluZXIubmFtZSwgaHRtbC5CbG9jaywgZW5kU3Bhbik7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0Q29udGFpbmVyKCk6IE5vZGVDb250YWluZXJ8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbnRhaW5lclN0YWNrLmxlbmd0aCA+IDAgPyB0aGlzLl9jb250YWluZXJTdGFja1t0aGlzLl9jb250YWluZXJTdGFjay5sZW5ndGggLSAxXSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0Q2xvc2VzdFBhcmVudEVsZW1lbnQoKTogaHRtbC5FbGVtZW50fG51bGwge1xuICAgIGZvciAobGV0IGkgPSB0aGlzLl9jb250YWluZXJTdGFjay5sZW5ndGggLSAxOyBpID4gLTE7IGktLSkge1xuICAgICAgaWYgKHRoaXMuX2NvbnRhaW5lclN0YWNrW2ldIGluc3RhbmNlb2YgaHRtbC5FbGVtZW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb250YWluZXJTdGFja1tpXSBhcyBodG1sLkVsZW1lbnQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9hZGRUb1BhcmVudChub2RlOiBodG1sLk5vZGUpIHtcbiAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRDb250YWluZXIoKTtcblxuICAgIGlmIChwYXJlbnQgPT09IG51bGwpIHtcbiAgICAgIHRoaXMucm9vdE5vZGVzLnB1c2gobm9kZSk7XG4gICAgfSBlbHNlIGlmIChwYXJlbnQgaW5zdGFuY2VvZiBodG1sLkJsb2NrR3JvdXApIHtcbiAgICAgIC8vIER1ZSB0byBob3cgcGFyc2luZyBpcyBzZXQgdXAsIHdlJ3JlIHVubGlrZWx5IHRvIGhpdCB0aGlzIGNvZGUgcGF0aCwgYnV0IHdlXG4gICAgICAvLyBoYXZlIHRoZSBhc3NlcnRpb24gaGVyZSBqdXN0IGluIGNhc2UgYW5kIHRvIHNhdGlzZnkgdGhlIHR5cGUgY2hlY2tlci5cbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCBub2RlLnNvdXJjZVNwYW4sICdCbG9jayBncm91cHMgY2FuIG9ubHkgY29udGFpbiBibG9ja3MuJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJlbnQuY2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9nZXRFbGVtZW50RnVsbE5hbWUocHJlZml4OiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBwYXJlbnRFbGVtZW50OiBodG1sLkVsZW1lbnR8bnVsbCk6XG4gICAgICBzdHJpbmcge1xuICAgIGlmIChwcmVmaXggPT09ICcnKSB7XG4gICAgICBwcmVmaXggPSB0aGlzLmdldFRhZ0RlZmluaXRpb24obG9jYWxOYW1lKS5pbXBsaWNpdE5hbWVzcGFjZVByZWZpeCB8fCAnJztcbiAgICAgIGlmIChwcmVmaXggPT09ICcnICYmIHBhcmVudEVsZW1lbnQgIT0gbnVsbCkge1xuICAgICAgICBjb25zdCBwYXJlbnRUYWdOYW1lID0gc3BsaXROc05hbWUocGFyZW50RWxlbWVudC5uYW1lKVsxXTtcbiAgICAgICAgY29uc3QgcGFyZW50VGFnRGVmaW5pdGlvbiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihwYXJlbnRUYWdOYW1lKTtcbiAgICAgICAgaWYgKCFwYXJlbnRUYWdEZWZpbml0aW9uLnByZXZlbnROYW1lc3BhY2VJbmhlcml0YW5jZSkge1xuICAgICAgICAgIHByZWZpeCA9IGdldE5zUHJlZml4KHBhcmVudEVsZW1lbnQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWVyZ2VOc0FuZE5hbWUocHJlZml4LCBsb2NhbE5hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGxhc3RPblN0YWNrKHN0YWNrOiBhbnlbXSwgZWxlbWVudDogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBzdGFjay5sZW5ndGggPiAwICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBlbGVtZW50O1xufVxuXG4vKipcbiAqIERlY29kZSB0aGUgYGVudGl0eWAgc3RyaW5nLCB3aGljaCB3ZSBiZWxpZXZlIGlzIHRoZSBjb250ZW50cyBvZiBhbiBIVE1MIGVudGl0eS5cbiAqXG4gKiBJZiB0aGUgc3RyaW5nIGlzIG5vdCBhY3R1YWxseSBhIHZhbGlkL2tub3duIGVudGl0eSB0aGVuIGp1c3QgcmV0dXJuIHRoZSBvcmlnaW5hbCBgbWF0Y2hgIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZGVjb2RlRW50aXR5KG1hdGNoOiBzdHJpbmcsIGVudGl0eTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKE5BTUVEX0VOVElUSUVTW2VudGl0eV0gIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBOQU1FRF9FTlRJVElFU1tlbnRpdHldIHx8IG1hdGNoO1xuICB9XG4gIGlmICgvXiN4W2EtZjAtOV0rJC9pLnRlc3QoZW50aXR5KSkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNvZGVQb2ludChwYXJzZUludChlbnRpdHkuc2xpY2UoMiksIDE2KSk7XG4gIH1cbiAgaWYgKC9eI1xcZCskLy50ZXN0KGVudGl0eSkpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21Db2RlUG9pbnQocGFyc2VJbnQoZW50aXR5LnNsaWNlKDEpLCAxMCkpO1xuICB9XG4gIHJldHVybiBtYXRjaDtcbn1cbiJdfQ==