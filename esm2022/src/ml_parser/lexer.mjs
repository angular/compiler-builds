/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as chars from '../chars';
import { ParseError, ParseLocation, ParseSourceFile, ParseSourceSpan } from '../parse_util';
import { DEFAULT_INTERPOLATION_CONFIG } from './defaults';
import { NAMED_ENTITIES } from './entities';
import { TagContentType } from './tags';
export class TokenError extends ParseError {
    constructor(errorMsg, tokenType, span) {
        super(span, errorMsg);
        this.tokenType = tokenType;
    }
}
export class TokenizeResult {
    constructor(tokens, errors, nonNormalizedIcuExpressions) {
        this.tokens = tokens;
        this.errors = errors;
        this.nonNormalizedIcuExpressions = nonNormalizedIcuExpressions;
    }
}
export function tokenize(source, url, getTagDefinition, options = {}) {
    const tokenizer = new _Tokenizer(new ParseSourceFile(source, url), getTagDefinition, options);
    tokenizer.tokenize();
    return new TokenizeResult(mergeTextTokens(tokenizer.tokens), tokenizer.errors, tokenizer.nonNormalizedIcuExpressions);
}
const _CR_OR_CRLF_REGEXP = /\r\n?/g;
function _unexpectedCharacterErrorMsg(charCode) {
    const char = charCode === chars.$EOF ? 'EOF' : String.fromCharCode(charCode);
    return `Unexpected character "${char}"`;
}
function _unknownEntityErrorMsg(entitySrc) {
    return `Unknown entity "${entitySrc}" - use the "&#<decimal>;" or  "&#x<hex>;" syntax`;
}
function _unparsableEntityErrorMsg(type, entityStr) {
    return `Unable to parse entity "${entityStr}" - ${type} character reference entities must end with ";"`;
}
var CharacterReferenceType;
(function (CharacterReferenceType) {
    CharacterReferenceType["HEX"] = "hexadecimal";
    CharacterReferenceType["DEC"] = "decimal";
})(CharacterReferenceType || (CharacterReferenceType = {}));
class _ControlFlowError {
    constructor(error) {
        this.error = error;
    }
}
// See https://www.w3.org/TR/html51/syntax.html#writing-html-documents
class _Tokenizer {
    /**
     * @param _file The html source file being tokenized.
     * @param _getTagDefinition A function that will retrieve a tag definition for a given tag name.
     * @param options Configuration of the tokenization.
     */
    constructor(_file, _getTagDefinition, options) {
        this._getTagDefinition = _getTagDefinition;
        this._currentTokenStart = null;
        this._currentTokenType = null;
        this._expansionCaseStack = [];
        this._inInterpolation = false;
        this.tokens = [];
        this.errors = [];
        this.nonNormalizedIcuExpressions = [];
        this._tokenizeIcu = options.tokenizeExpansionForms || false;
        this._interpolationConfig = options.interpolationConfig || DEFAULT_INTERPOLATION_CONFIG;
        this._leadingTriviaCodePoints =
            options.leadingTriviaChars && options.leadingTriviaChars.map((c) => c.codePointAt(0) || 0);
        const range = options.range || {
            endPos: _file.content.length,
            startPos: 0,
            startLine: 0,
            startCol: 0,
        };
        this._cursor = options.escapedString
            ? new EscapedCharacterCursor(_file, range)
            : new PlainCharacterCursor(_file, range);
        this._preserveLineEndings = options.preserveLineEndings || false;
        this._i18nNormalizeLineEndingsInICUs = options.i18nNormalizeLineEndingsInICUs || false;
        this._tokenizeBlocks = options.tokenizeBlocks ?? true;
        try {
            this._cursor.init();
        }
        catch (e) {
            this.handleError(e);
        }
    }
    _processCarriageReturns(content) {
        if (this._preserveLineEndings) {
            return content;
        }
        // https://www.w3.org/TR/html51/syntax.html#preprocessing-the-input-stream
        // In order to keep the original position in the source, we can not
        // pre-process it.
        // Instead CRs are processed right before instantiating the tokens.
        return content.replace(_CR_OR_CRLF_REGEXP, '\n');
    }
    tokenize() {
        while (this._cursor.peek() !== chars.$EOF) {
            const start = this._cursor.clone();
            try {
                if (this._attemptCharCode(chars.$LT)) {
                    if (this._attemptCharCode(chars.$BANG)) {
                        if (this._attemptCharCode(chars.$LBRACKET)) {
                            this._consumeCdata(start);
                        }
                        else if (this._attemptCharCode(chars.$MINUS)) {
                            this._consumeComment(start);
                        }
                        else {
                            this._consumeDocType(start);
                        }
                    }
                    else if (this._attemptCharCode(chars.$SLASH)) {
                        this._consumeTagClose(start);
                    }
                    else {
                        this._consumeTagOpen(start);
                    }
                }
                else if (this._tokenizeBlocks && this._attemptCharCode(chars.$AT)) {
                    this._consumeBlockStart(start);
                }
                else if (this._tokenizeBlocks &&
                    !this._inInterpolation &&
                    !this._isInExpansionCase() &&
                    !this._isInExpansionForm() &&
                    this._attemptCharCode(chars.$RBRACE)) {
                    this._consumeBlockEnd(start);
                }
                else if (!(this._tokenizeIcu && this._tokenizeExpansionForm())) {
                    // In (possibly interpolated) text the end of the text is given by `isTextEnd()`, while
                    // the premature end of an interpolation is given by the start of a new HTML element.
                    this._consumeWithInterpolation(5 /* TokenType.TEXT */, 8 /* TokenType.INTERPOLATION */, () => this._isTextEnd(), () => this._isTagStart());
                }
            }
            catch (e) {
                this.handleError(e);
            }
        }
        this._beginToken(29 /* TokenType.EOF */);
        this._endToken([]);
    }
    _getBlockName() {
        // This allows us to capture up something like `@else if`, but not `@ if`.
        let spacesInNameAllowed = false;
        const nameCursor = this._cursor.clone();
        this._attemptCharCodeUntilFn((code) => {
            if (chars.isWhitespace(code)) {
                return !spacesInNameAllowed;
            }
            if (isBlockNameChar(code)) {
                spacesInNameAllowed = true;
                return false;
            }
            return true;
        });
        return this._cursor.getChars(nameCursor).trim();
    }
    _consumeBlockStart(start) {
        this._beginToken(24 /* TokenType.BLOCK_OPEN_START */, start);
        const startToken = this._endToken([this._getBlockName()]);
        if (this._cursor.peek() === chars.$LPAREN) {
            // Advance past the opening paren.
            this._cursor.advance();
            // Capture the parameters.
            this._consumeBlockParameters();
            // Allow spaces before the closing paren.
            this._attemptCharCodeUntilFn(isNotWhitespace);
            if (this._attemptCharCode(chars.$RPAREN)) {
                // Allow spaces after the paren.
                this._attemptCharCodeUntilFn(isNotWhitespace);
            }
            else {
                startToken.type = 28 /* TokenType.INCOMPLETE_BLOCK_OPEN */;
                return;
            }
        }
        if (this._attemptCharCode(chars.$LBRACE)) {
            this._beginToken(25 /* TokenType.BLOCK_OPEN_END */);
            this._endToken([]);
        }
        else {
            startToken.type = 28 /* TokenType.INCOMPLETE_BLOCK_OPEN */;
        }
    }
    _consumeBlockEnd(start) {
        this._beginToken(26 /* TokenType.BLOCK_CLOSE */, start);
        this._endToken([]);
    }
    _consumeBlockParameters() {
        // Trim the whitespace until the first parameter.
        this._attemptCharCodeUntilFn(isBlockParameterChar);
        while (this._cursor.peek() !== chars.$RPAREN && this._cursor.peek() !== chars.$EOF) {
            this._beginToken(27 /* TokenType.BLOCK_PARAMETER */);
            const start = this._cursor.clone();
            let inQuote = null;
            let openParens = 0;
            // Consume the parameter until the next semicolon or brace.
            // Note that we skip over semicolons/braces inside of strings.
            while ((this._cursor.peek() !== chars.$SEMICOLON && this._cursor.peek() !== chars.$EOF) ||
                inQuote !== null) {
                const char = this._cursor.peek();
                // Skip to the next character if it was escaped.
                if (char === chars.$BACKSLASH) {
                    this._cursor.advance();
                }
                else if (char === inQuote) {
                    inQuote = null;
                }
                else if (inQuote === null && chars.isQuote(char)) {
                    inQuote = char;
                }
                else if (char === chars.$LPAREN && inQuote === null) {
                    openParens++;
                }
                else if (char === chars.$RPAREN && inQuote === null) {
                    if (openParens === 0) {
                        break;
                    }
                    else if (openParens > 0) {
                        openParens--;
                    }
                }
                this._cursor.advance();
            }
            this._endToken([this._cursor.getChars(start)]);
            // Skip to the next parameter.
            this._attemptCharCodeUntilFn(isBlockParameterChar);
        }
    }
    /**
     * @returns whether an ICU token has been created
     * @internal
     */
    _tokenizeExpansionForm() {
        if (this.isExpansionFormStart()) {
            this._consumeExpansionFormStart();
            return true;
        }
        if (isExpansionCaseStart(this._cursor.peek()) && this._isInExpansionForm()) {
            this._consumeExpansionCaseStart();
            return true;
        }
        if (this._cursor.peek() === chars.$RBRACE) {
            if (this._isInExpansionCase()) {
                this._consumeExpansionCaseEnd();
                return true;
            }
            if (this._isInExpansionForm()) {
                this._consumeExpansionFormEnd();
                return true;
            }
        }
        return false;
    }
    _beginToken(type, start = this._cursor.clone()) {
        this._currentTokenStart = start;
        this._currentTokenType = type;
    }
    _endToken(parts, end) {
        if (this._currentTokenStart === null) {
            throw new TokenError('Programming error - attempted to end a token when there was no start to the token', this._currentTokenType, this._cursor.getSpan(end));
        }
        if (this._currentTokenType === null) {
            throw new TokenError('Programming error - attempted to end a token which has no token type', null, this._cursor.getSpan(this._currentTokenStart));
        }
        const token = {
            type: this._currentTokenType,
            parts,
            sourceSpan: (end ?? this._cursor).getSpan(this._currentTokenStart, this._leadingTriviaCodePoints),
        };
        this.tokens.push(token);
        this._currentTokenStart = null;
        this._currentTokenType = null;
        return token;
    }
    _createError(msg, span) {
        if (this._isInExpansionForm()) {
            msg += ` (Do you have an unescaped "{" in your template? Use "{{ '{' }}") to escape it.)`;
        }
        const error = new TokenError(msg, this._currentTokenType, span);
        this._currentTokenStart = null;
        this._currentTokenType = null;
        return new _ControlFlowError(error);
    }
    handleError(e) {
        if (e instanceof CursorError) {
            e = this._createError(e.msg, this._cursor.getSpan(e.cursor));
        }
        if (e instanceof _ControlFlowError) {
            this.errors.push(e.error);
        }
        else {
            throw e;
        }
    }
    _attemptCharCode(charCode) {
        if (this._cursor.peek() === charCode) {
            this._cursor.advance();
            return true;
        }
        return false;
    }
    _attemptCharCodeCaseInsensitive(charCode) {
        if (compareCharCodeCaseInsensitive(this._cursor.peek(), charCode)) {
            this._cursor.advance();
            return true;
        }
        return false;
    }
    _requireCharCode(charCode) {
        const location = this._cursor.clone();
        if (!this._attemptCharCode(charCode)) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(location));
        }
    }
    _attemptStr(chars) {
        const len = chars.length;
        if (this._cursor.charsLeft() < len) {
            return false;
        }
        const initialPosition = this._cursor.clone();
        for (let i = 0; i < len; i++) {
            if (!this._attemptCharCode(chars.charCodeAt(i))) {
                // If attempting to parse the string fails, we want to reset the parser
                // to where it was before the attempt
                this._cursor = initialPosition;
                return false;
            }
        }
        return true;
    }
    _attemptStrCaseInsensitive(chars) {
        for (let i = 0; i < chars.length; i++) {
            if (!this._attemptCharCodeCaseInsensitive(chars.charCodeAt(i))) {
                return false;
            }
        }
        return true;
    }
    _requireStr(chars) {
        const location = this._cursor.clone();
        if (!this._attemptStr(chars)) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(location));
        }
    }
    _attemptCharCodeUntilFn(predicate) {
        while (!predicate(this._cursor.peek())) {
            this._cursor.advance();
        }
    }
    _requireCharCodeUntilFn(predicate, len) {
        const start = this._cursor.clone();
        this._attemptCharCodeUntilFn(predicate);
        if (this._cursor.diff(start) < len) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(start));
        }
    }
    _attemptUntilChar(char) {
        while (this._cursor.peek() !== char) {
            this._cursor.advance();
        }
    }
    _readChar() {
        // Don't rely upon reading directly from `_input` as the actual char value
        // may have been generated from an escape sequence.
        const char = String.fromCodePoint(this._cursor.peek());
        this._cursor.advance();
        return char;
    }
    _consumeEntity(textTokenType) {
        this._beginToken(9 /* TokenType.ENCODED_ENTITY */);
        const start = this._cursor.clone();
        this._cursor.advance();
        if (this._attemptCharCode(chars.$HASH)) {
            const isHex = this._attemptCharCode(chars.$x) || this._attemptCharCode(chars.$X);
            const codeStart = this._cursor.clone();
            this._attemptCharCodeUntilFn(isDigitEntityEnd);
            if (this._cursor.peek() != chars.$SEMICOLON) {
                // Advance cursor to include the peeked character in the string provided to the error
                // message.
                this._cursor.advance();
                const entityType = isHex ? CharacterReferenceType.HEX : CharacterReferenceType.DEC;
                throw this._createError(_unparsableEntityErrorMsg(entityType, this._cursor.getChars(start)), this._cursor.getSpan());
            }
            const strNum = this._cursor.getChars(codeStart);
            this._cursor.advance();
            try {
                const charCode = parseInt(strNum, isHex ? 16 : 10);
                this._endToken([String.fromCharCode(charCode), this._cursor.getChars(start)]);
            }
            catch {
                throw this._createError(_unknownEntityErrorMsg(this._cursor.getChars(start)), this._cursor.getSpan());
            }
        }
        else {
            const nameStart = this._cursor.clone();
            this._attemptCharCodeUntilFn(isNamedEntityEnd);
            if (this._cursor.peek() != chars.$SEMICOLON) {
                // No semicolon was found so abort the encoded entity token that was in progress, and treat
                // this as a text token
                this._beginToken(textTokenType, start);
                this._cursor = nameStart;
                this._endToken(['&']);
            }
            else {
                const name = this._cursor.getChars(nameStart);
                this._cursor.advance();
                const char = NAMED_ENTITIES[name];
                if (!char) {
                    throw this._createError(_unknownEntityErrorMsg(name), this._cursor.getSpan(start));
                }
                this._endToken([char, `&${name};`]);
            }
        }
    }
    _consumeRawText(consumeEntities, endMarkerPredicate) {
        this._beginToken(consumeEntities ? 6 /* TokenType.ESCAPABLE_RAW_TEXT */ : 7 /* TokenType.RAW_TEXT */);
        const parts = [];
        while (true) {
            const tagCloseStart = this._cursor.clone();
            const foundEndMarker = endMarkerPredicate();
            this._cursor = tagCloseStart;
            if (foundEndMarker) {
                break;
            }
            if (consumeEntities && this._cursor.peek() === chars.$AMPERSAND) {
                this._endToken([this._processCarriageReturns(parts.join(''))]);
                parts.length = 0;
                this._consumeEntity(6 /* TokenType.ESCAPABLE_RAW_TEXT */);
                this._beginToken(6 /* TokenType.ESCAPABLE_RAW_TEXT */);
            }
            else {
                parts.push(this._readChar());
            }
        }
        this._endToken([this._processCarriageReturns(parts.join(''))]);
    }
    _consumeComment(start) {
        this._beginToken(10 /* TokenType.COMMENT_START */, start);
        this._requireCharCode(chars.$MINUS);
        this._endToken([]);
        this._consumeRawText(false, () => this._attemptStr('-->'));
        this._beginToken(11 /* TokenType.COMMENT_END */);
        this._requireStr('-->');
        this._endToken([]);
    }
    _consumeCdata(start) {
        this._beginToken(12 /* TokenType.CDATA_START */, start);
        this._requireStr('CDATA[');
        this._endToken([]);
        this._consumeRawText(false, () => this._attemptStr(']]>'));
        this._beginToken(13 /* TokenType.CDATA_END */);
        this._requireStr(']]>');
        this._endToken([]);
    }
    _consumeDocType(start) {
        this._beginToken(18 /* TokenType.DOC_TYPE */, start);
        const contentStart = this._cursor.clone();
        this._attemptUntilChar(chars.$GT);
        const content = this._cursor.getChars(contentStart);
        this._cursor.advance();
        this._endToken([content]);
    }
    _consumePrefixAndName() {
        const nameOrPrefixStart = this._cursor.clone();
        let prefix = '';
        while (this._cursor.peek() !== chars.$COLON && !isPrefixEnd(this._cursor.peek())) {
            this._cursor.advance();
        }
        let nameStart;
        if (this._cursor.peek() === chars.$COLON) {
            prefix = this._cursor.getChars(nameOrPrefixStart);
            this._cursor.advance();
            nameStart = this._cursor.clone();
        }
        else {
            nameStart = nameOrPrefixStart;
        }
        this._requireCharCodeUntilFn(isNameEnd, prefix === '' ? 0 : 1);
        const name = this._cursor.getChars(nameStart);
        return [prefix, name];
    }
    _consumeTagOpen(start) {
        let tagName;
        let prefix;
        let openTagToken;
        try {
            if (!chars.isAsciiLetter(this._cursor.peek())) {
                throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(start));
            }
            openTagToken = this._consumeTagOpenStart(start);
            prefix = openTagToken.parts[0];
            tagName = openTagToken.parts[1];
            this._attemptCharCodeUntilFn(isNotWhitespace);
            while (this._cursor.peek() !== chars.$SLASH &&
                this._cursor.peek() !== chars.$GT &&
                this._cursor.peek() !== chars.$LT &&
                this._cursor.peek() !== chars.$EOF) {
                this._consumeAttributeName();
                this._attemptCharCodeUntilFn(isNotWhitespace);
                if (this._attemptCharCode(chars.$EQ)) {
                    this._attemptCharCodeUntilFn(isNotWhitespace);
                    this._consumeAttributeValue();
                }
                this._attemptCharCodeUntilFn(isNotWhitespace);
            }
            this._consumeTagOpenEnd();
        }
        catch (e) {
            if (e instanceof _ControlFlowError) {
                if (openTagToken) {
                    // We errored before we could close the opening tag, so it is incomplete.
                    openTagToken.type = 4 /* TokenType.INCOMPLETE_TAG_OPEN */;
                }
                else {
                    // When the start tag is invalid, assume we want a "<" as text.
                    // Back to back text tokens are merged at the end.
                    this._beginToken(5 /* TokenType.TEXT */, start);
                    this._endToken(['<']);
                }
                return;
            }
            throw e;
        }
        const contentTokenType = this._getTagDefinition(tagName).getContentType(prefix);
        if (contentTokenType === TagContentType.RAW_TEXT) {
            this._consumeRawTextWithTagClose(prefix, tagName, false);
        }
        else if (contentTokenType === TagContentType.ESCAPABLE_RAW_TEXT) {
            this._consumeRawTextWithTagClose(prefix, tagName, true);
        }
    }
    _consumeRawTextWithTagClose(prefix, tagName, consumeEntities) {
        this._consumeRawText(consumeEntities, () => {
            if (!this._attemptCharCode(chars.$LT))
                return false;
            if (!this._attemptCharCode(chars.$SLASH))
                return false;
            this._attemptCharCodeUntilFn(isNotWhitespace);
            if (!this._attemptStrCaseInsensitive(tagName))
                return false;
            this._attemptCharCodeUntilFn(isNotWhitespace);
            return this._attemptCharCode(chars.$GT);
        });
        this._beginToken(3 /* TokenType.TAG_CLOSE */);
        this._requireCharCodeUntilFn((code) => code === chars.$GT, 3);
        this._cursor.advance(); // Consume the `>`
        this._endToken([prefix, tagName]);
    }
    _consumeTagOpenStart(start) {
        this._beginToken(0 /* TokenType.TAG_OPEN_START */, start);
        const parts = this._consumePrefixAndName();
        return this._endToken(parts);
    }
    _consumeAttributeName() {
        const attrNameStart = this._cursor.peek();
        if (attrNameStart === chars.$SQ || attrNameStart === chars.$DQ) {
            throw this._createError(_unexpectedCharacterErrorMsg(attrNameStart), this._cursor.getSpan());
        }
        this._beginToken(14 /* TokenType.ATTR_NAME */);
        const prefixAndName = this._consumePrefixAndName();
        this._endToken(prefixAndName);
    }
    _consumeAttributeValue() {
        if (this._cursor.peek() === chars.$SQ || this._cursor.peek() === chars.$DQ) {
            const quoteChar = this._cursor.peek();
            this._consumeQuote(quoteChar);
            // In an attribute then end of the attribute value and the premature end to an interpolation
            // are both triggered by the `quoteChar`.
            const endPredicate = () => this._cursor.peek() === quoteChar;
            this._consumeWithInterpolation(16 /* TokenType.ATTR_VALUE_TEXT */, 17 /* TokenType.ATTR_VALUE_INTERPOLATION */, endPredicate, endPredicate);
            this._consumeQuote(quoteChar);
        }
        else {
            const endPredicate = () => isNameEnd(this._cursor.peek());
            this._consumeWithInterpolation(16 /* TokenType.ATTR_VALUE_TEXT */, 17 /* TokenType.ATTR_VALUE_INTERPOLATION */, endPredicate, endPredicate);
        }
    }
    _consumeQuote(quoteChar) {
        this._beginToken(15 /* TokenType.ATTR_QUOTE */);
        this._requireCharCode(quoteChar);
        this._endToken([String.fromCodePoint(quoteChar)]);
    }
    _consumeTagOpenEnd() {
        const tokenType = this._attemptCharCode(chars.$SLASH)
            ? 2 /* TokenType.TAG_OPEN_END_VOID */
            : 1 /* TokenType.TAG_OPEN_END */;
        this._beginToken(tokenType);
        this._requireCharCode(chars.$GT);
        this._endToken([]);
    }
    _consumeTagClose(start) {
        this._beginToken(3 /* TokenType.TAG_CLOSE */, start);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        const prefixAndName = this._consumePrefixAndName();
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._requireCharCode(chars.$GT);
        this._endToken(prefixAndName);
    }
    _consumeExpansionFormStart() {
        this._beginToken(19 /* TokenType.EXPANSION_FORM_START */);
        this._requireCharCode(chars.$LBRACE);
        this._endToken([]);
        this._expansionCaseStack.push(19 /* TokenType.EXPANSION_FORM_START */);
        this._beginToken(7 /* TokenType.RAW_TEXT */);
        const condition = this._readUntil(chars.$COMMA);
        const normalizedCondition = this._processCarriageReturns(condition);
        if (this._i18nNormalizeLineEndingsInICUs) {
            // We explicitly want to normalize line endings for this text.
            this._endToken([normalizedCondition]);
        }
        else {
            // We are not normalizing line endings.
            const conditionToken = this._endToken([condition]);
            if (normalizedCondition !== condition) {
                this.nonNormalizedIcuExpressions.push(conditionToken);
            }
        }
        this._requireCharCode(chars.$COMMA);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._beginToken(7 /* TokenType.RAW_TEXT */);
        const type = this._readUntil(chars.$COMMA);
        this._endToken([type]);
        this._requireCharCode(chars.$COMMA);
        this._attemptCharCodeUntilFn(isNotWhitespace);
    }
    _consumeExpansionCaseStart() {
        this._beginToken(20 /* TokenType.EXPANSION_CASE_VALUE */);
        const value = this._readUntil(chars.$LBRACE).trim();
        this._endToken([value]);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._beginToken(21 /* TokenType.EXPANSION_CASE_EXP_START */);
        this._requireCharCode(chars.$LBRACE);
        this._endToken([]);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._expansionCaseStack.push(21 /* TokenType.EXPANSION_CASE_EXP_START */);
    }
    _consumeExpansionCaseEnd() {
        this._beginToken(22 /* TokenType.EXPANSION_CASE_EXP_END */);
        this._requireCharCode(chars.$RBRACE);
        this._endToken([]);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._expansionCaseStack.pop();
    }
    _consumeExpansionFormEnd() {
        this._beginToken(23 /* TokenType.EXPANSION_FORM_END */);
        this._requireCharCode(chars.$RBRACE);
        this._endToken([]);
        this._expansionCaseStack.pop();
    }
    /**
     * Consume a string that may contain interpolation expressions.
     *
     * The first token consumed will be of `tokenType` and then there will be alternating
     * `interpolationTokenType` and `tokenType` tokens until the `endPredicate()` returns true.
     *
     * If an interpolation token ends prematurely it will have no end marker in its `parts` array.
     *
     * @param textTokenType the kind of tokens to interleave around interpolation tokens.
     * @param interpolationTokenType the kind of tokens that contain interpolation.
     * @param endPredicate a function that should return true when we should stop consuming.
     * @param endInterpolation a function that should return true if there is a premature end to an
     *     interpolation expression - i.e. before we get to the normal interpolation closing marker.
     */
    _consumeWithInterpolation(textTokenType, interpolationTokenType, endPredicate, endInterpolation) {
        this._beginToken(textTokenType);
        const parts = [];
        while (!endPredicate()) {
            const current = this._cursor.clone();
            if (this._interpolationConfig && this._attemptStr(this._interpolationConfig.start)) {
                this._endToken([this._processCarriageReturns(parts.join(''))], current);
                parts.length = 0;
                this._consumeInterpolation(interpolationTokenType, current, endInterpolation);
                this._beginToken(textTokenType);
            }
            else if (this._cursor.peek() === chars.$AMPERSAND) {
                this._endToken([this._processCarriageReturns(parts.join(''))]);
                parts.length = 0;
                this._consumeEntity(textTokenType);
                this._beginToken(textTokenType);
            }
            else {
                parts.push(this._readChar());
            }
        }
        // It is possible that an interpolation was started but not ended inside this text token.
        // Make sure that we reset the state of the lexer correctly.
        this._inInterpolation = false;
        this._endToken([this._processCarriageReturns(parts.join(''))]);
    }
    /**
     * Consume a block of text that has been interpreted as an Angular interpolation.
     *
     * @param interpolationTokenType the type of the interpolation token to generate.
     * @param interpolationStart a cursor that points to the start of this interpolation.
     * @param prematureEndPredicate a function that should return true if the next characters indicate
     *     an end to the interpolation before its normal closing marker.
     */
    _consumeInterpolation(interpolationTokenType, interpolationStart, prematureEndPredicate) {
        const parts = [];
        this._beginToken(interpolationTokenType, interpolationStart);
        parts.push(this._interpolationConfig.start);
        // Find the end of the interpolation, ignoring content inside quotes.
        const expressionStart = this._cursor.clone();
        let inQuote = null;
        let inComment = false;
        while (this._cursor.peek() !== chars.$EOF &&
            (prematureEndPredicate === null || !prematureEndPredicate())) {
            const current = this._cursor.clone();
            if (this._isTagStart()) {
                // We are starting what looks like an HTML element in the middle of this interpolation.
                // Reset the cursor to before the `<` character and end the interpolation token.
                // (This is actually wrong but here for backward compatibility).
                this._cursor = current;
                parts.push(this._getProcessedChars(expressionStart, current));
                this._endToken(parts);
                return;
            }
            if (inQuote === null) {
                if (this._attemptStr(this._interpolationConfig.end)) {
                    // We are not in a string, and we hit the end interpolation marker
                    parts.push(this._getProcessedChars(expressionStart, current));
                    parts.push(this._interpolationConfig.end);
                    this._endToken(parts);
                    return;
                }
                else if (this._attemptStr('//')) {
                    // Once we are in a comment we ignore any quotes
                    inComment = true;
                }
            }
            const char = this._cursor.peek();
            this._cursor.advance();
            if (char === chars.$BACKSLASH) {
                // Skip the next character because it was escaped.
                this._cursor.advance();
            }
            else if (char === inQuote) {
                // Exiting the current quoted string
                inQuote = null;
            }
            else if (!inComment && inQuote === null && chars.isQuote(char)) {
                // Entering a new quoted string
                inQuote = char;
            }
        }
        // We hit EOF without finding a closing interpolation marker
        parts.push(this._getProcessedChars(expressionStart, this._cursor));
        this._endToken(parts);
    }
    _getProcessedChars(start, end) {
        return this._processCarriageReturns(end.getChars(start));
    }
    _isTextEnd() {
        if (this._isTagStart() || this._cursor.peek() === chars.$EOF) {
            return true;
        }
        if (this._tokenizeIcu && !this._inInterpolation) {
            if (this.isExpansionFormStart()) {
                // start of an expansion form
                return true;
            }
            if (this._cursor.peek() === chars.$RBRACE && this._isInExpansionCase()) {
                // end of and expansion case
                return true;
            }
        }
        if (this._tokenizeBlocks &&
            !this._inInterpolation &&
            !this._isInExpansion() &&
            (this._cursor.peek() === chars.$AT || this._cursor.peek() === chars.$RBRACE)) {
            return true;
        }
        return false;
    }
    /**
     * Returns true if the current cursor is pointing to the start of a tag
     * (opening/closing/comments/cdata/etc).
     */
    _isTagStart() {
        if (this._cursor.peek() === chars.$LT) {
            // We assume that `<` followed by whitespace is not the start of an HTML element.
            const tmp = this._cursor.clone();
            tmp.advance();
            // If the next character is alphabetic, ! nor / then it is a tag start
            const code = tmp.peek();
            if ((chars.$a <= code && code <= chars.$z) ||
                (chars.$A <= code && code <= chars.$Z) ||
                code === chars.$SLASH ||
                code === chars.$BANG) {
                return true;
            }
        }
        return false;
    }
    _readUntil(char) {
        const start = this._cursor.clone();
        this._attemptUntilChar(char);
        return this._cursor.getChars(start);
    }
    _isInExpansion() {
        return this._isInExpansionCase() || this._isInExpansionForm();
    }
    _isInExpansionCase() {
        return (this._expansionCaseStack.length > 0 &&
            this._expansionCaseStack[this._expansionCaseStack.length - 1] ===
                21 /* TokenType.EXPANSION_CASE_EXP_START */);
    }
    _isInExpansionForm() {
        return (this._expansionCaseStack.length > 0 &&
            this._expansionCaseStack[this._expansionCaseStack.length - 1] ===
                19 /* TokenType.EXPANSION_FORM_START */);
    }
    isExpansionFormStart() {
        if (this._cursor.peek() !== chars.$LBRACE) {
            return false;
        }
        if (this._interpolationConfig) {
            const start = this._cursor.clone();
            const isInterpolation = this._attemptStr(this._interpolationConfig.start);
            this._cursor = start;
            return !isInterpolation;
        }
        return true;
    }
}
function isNotWhitespace(code) {
    return !chars.isWhitespace(code) || code === chars.$EOF;
}
function isNameEnd(code) {
    return (chars.isWhitespace(code) ||
        code === chars.$GT ||
        code === chars.$LT ||
        code === chars.$SLASH ||
        code === chars.$SQ ||
        code === chars.$DQ ||
        code === chars.$EQ ||
        code === chars.$EOF);
}
function isPrefixEnd(code) {
    return ((code < chars.$a || chars.$z < code) &&
        (code < chars.$A || chars.$Z < code) &&
        (code < chars.$0 || code > chars.$9));
}
function isDigitEntityEnd(code) {
    return code === chars.$SEMICOLON || code === chars.$EOF || !chars.isAsciiHexDigit(code);
}
function isNamedEntityEnd(code) {
    return code === chars.$SEMICOLON || code === chars.$EOF || !chars.isAsciiLetter(code);
}
function isExpansionCaseStart(peek) {
    return peek !== chars.$RBRACE;
}
function compareCharCodeCaseInsensitive(code1, code2) {
    return toUpperCaseCharCode(code1) === toUpperCaseCharCode(code2);
}
function toUpperCaseCharCode(code) {
    return code >= chars.$a && code <= chars.$z ? code - chars.$a + chars.$A : code;
}
function isBlockNameChar(code) {
    return chars.isAsciiLetter(code) || chars.isDigit(code) || code === chars.$_;
}
function isBlockParameterChar(code) {
    return code !== chars.$SEMICOLON && isNotWhitespace(code);
}
function mergeTextTokens(srcTokens) {
    const dstTokens = [];
    let lastDstToken = undefined;
    for (let i = 0; i < srcTokens.length; i++) {
        const token = srcTokens[i];
        if ((lastDstToken && lastDstToken.type === 5 /* TokenType.TEXT */ && token.type === 5 /* TokenType.TEXT */) ||
            (lastDstToken &&
                lastDstToken.type === 16 /* TokenType.ATTR_VALUE_TEXT */ &&
                token.type === 16 /* TokenType.ATTR_VALUE_TEXT */)) {
            lastDstToken.parts[0] += token.parts[0];
            lastDstToken.sourceSpan.end = token.sourceSpan.end;
        }
        else {
            lastDstToken = token;
            dstTokens.push(lastDstToken);
        }
    }
    return dstTokens;
}
class PlainCharacterCursor {
    constructor(fileOrCursor, range) {
        if (fileOrCursor instanceof PlainCharacterCursor) {
            this.file = fileOrCursor.file;
            this.input = fileOrCursor.input;
            this.end = fileOrCursor.end;
            const state = fileOrCursor.state;
            // Note: avoid using `{...fileOrCursor.state}` here as that has a severe performance penalty.
            // In ES5 bundles the object spread operator is translated into the `__assign` helper, which
            // is not optimized by VMs as efficiently as a raw object literal. Since this constructor is
            // called in tight loops, this difference matters.
            this.state = {
                peek: state.peek,
                offset: state.offset,
                line: state.line,
                column: state.column,
            };
        }
        else {
            if (!range) {
                throw new Error('Programming error: the range argument must be provided with a file argument.');
            }
            this.file = fileOrCursor;
            this.input = fileOrCursor.content;
            this.end = range.endPos;
            this.state = {
                peek: -1,
                offset: range.startPos,
                line: range.startLine,
                column: range.startCol,
            };
        }
    }
    clone() {
        return new PlainCharacterCursor(this);
    }
    peek() {
        return this.state.peek;
    }
    charsLeft() {
        return this.end - this.state.offset;
    }
    diff(other) {
        return this.state.offset - other.state.offset;
    }
    advance() {
        this.advanceState(this.state);
    }
    init() {
        this.updatePeek(this.state);
    }
    getSpan(start, leadingTriviaCodePoints) {
        start = start || this;
        let fullStart = start;
        if (leadingTriviaCodePoints) {
            while (this.diff(start) > 0 && leadingTriviaCodePoints.indexOf(start.peek()) !== -1) {
                if (fullStart === start) {
                    start = start.clone();
                }
                start.advance();
            }
        }
        const startLocation = this.locationFromCursor(start);
        const endLocation = this.locationFromCursor(this);
        const fullStartLocation = fullStart !== start ? this.locationFromCursor(fullStart) : startLocation;
        return new ParseSourceSpan(startLocation, endLocation, fullStartLocation);
    }
    getChars(start) {
        return this.input.substring(start.state.offset, this.state.offset);
    }
    charAt(pos) {
        return this.input.charCodeAt(pos);
    }
    advanceState(state) {
        if (state.offset >= this.end) {
            this.state = state;
            throw new CursorError('Unexpected character "EOF"', this);
        }
        const currentChar = this.charAt(state.offset);
        if (currentChar === chars.$LF) {
            state.line++;
            state.column = 0;
        }
        else if (!chars.isNewLine(currentChar)) {
            state.column++;
        }
        state.offset++;
        this.updatePeek(state);
    }
    updatePeek(state) {
        state.peek = state.offset >= this.end ? chars.$EOF : this.charAt(state.offset);
    }
    locationFromCursor(cursor) {
        return new ParseLocation(cursor.file, cursor.state.offset, cursor.state.line, cursor.state.column);
    }
}
class EscapedCharacterCursor extends PlainCharacterCursor {
    constructor(fileOrCursor, range) {
        if (fileOrCursor instanceof EscapedCharacterCursor) {
            super(fileOrCursor);
            this.internalState = { ...fileOrCursor.internalState };
        }
        else {
            super(fileOrCursor, range);
            this.internalState = this.state;
        }
    }
    advance() {
        this.state = this.internalState;
        super.advance();
        this.processEscapeSequence();
    }
    init() {
        super.init();
        this.processEscapeSequence();
    }
    clone() {
        return new EscapedCharacterCursor(this);
    }
    getChars(start) {
        const cursor = start.clone();
        let chars = '';
        while (cursor.internalState.offset < this.internalState.offset) {
            chars += String.fromCodePoint(cursor.peek());
            cursor.advance();
        }
        return chars;
    }
    /**
     * Process the escape sequence that starts at the current position in the text.
     *
     * This method is called to ensure that `peek` has the unescaped value of escape sequences.
     */
    processEscapeSequence() {
        const peek = () => this.internalState.peek;
        if (peek() === chars.$BACKSLASH) {
            // We have hit an escape sequence so we need the internal state to become independent
            // of the external state.
            this.internalState = { ...this.state };
            // Move past the backslash
            this.advanceState(this.internalState);
            // First check for standard control char sequences
            if (peek() === chars.$n) {
                this.state.peek = chars.$LF;
            }
            else if (peek() === chars.$r) {
                this.state.peek = chars.$CR;
            }
            else if (peek() === chars.$v) {
                this.state.peek = chars.$VTAB;
            }
            else if (peek() === chars.$t) {
                this.state.peek = chars.$TAB;
            }
            else if (peek() === chars.$b) {
                this.state.peek = chars.$BSPACE;
            }
            else if (peek() === chars.$f) {
                this.state.peek = chars.$FF;
            }
            // Now consider more complex sequences
            else if (peek() === chars.$u) {
                // Unicode code-point sequence
                this.advanceState(this.internalState); // advance past the `u` char
                if (peek() === chars.$LBRACE) {
                    // Variable length Unicode, e.g. `\x{123}`
                    this.advanceState(this.internalState); // advance past the `{` char
                    // Advance past the variable number of hex digits until we hit a `}` char
                    const digitStart = this.clone();
                    let length = 0;
                    while (peek() !== chars.$RBRACE) {
                        this.advanceState(this.internalState);
                        length++;
                    }
                    this.state.peek = this.decodeHexDigits(digitStart, length);
                }
                else {
                    // Fixed length Unicode, e.g. `\u1234`
                    const digitStart = this.clone();
                    this.advanceState(this.internalState);
                    this.advanceState(this.internalState);
                    this.advanceState(this.internalState);
                    this.state.peek = this.decodeHexDigits(digitStart, 4);
                }
            }
            else if (peek() === chars.$x) {
                // Hex char code, e.g. `\x2F`
                this.advanceState(this.internalState); // advance past the `x` char
                const digitStart = this.clone();
                this.advanceState(this.internalState);
                this.state.peek = this.decodeHexDigits(digitStart, 2);
            }
            else if (chars.isOctalDigit(peek())) {
                // Octal char code, e.g. `\012`,
                let octal = '';
                let length = 0;
                let previous = this.clone();
                while (chars.isOctalDigit(peek()) && length < 3) {
                    previous = this.clone();
                    octal += String.fromCodePoint(peek());
                    this.advanceState(this.internalState);
                    length++;
                }
                this.state.peek = parseInt(octal, 8);
                // Backup one char
                this.internalState = previous.internalState;
            }
            else if (chars.isNewLine(this.internalState.peek)) {
                // Line continuation `\` followed by a new line
                this.advanceState(this.internalState); // advance over the newline
                this.state = this.internalState;
            }
            else {
                // If none of the `if` blocks were executed then we just have an escaped normal character.
                // In that case we just, effectively, skip the backslash from the character.
                this.state.peek = this.internalState.peek;
            }
        }
    }
    decodeHexDigits(start, length) {
        const hex = this.input.slice(start.internalState.offset, start.internalState.offset + length);
        const charCode = parseInt(hex, 16);
        if (!isNaN(charCode)) {
            return charCode;
        }
        else {
            start.state = start.internalState;
            throw new CursorError('Invalid hexadecimal escape sequence', start);
        }
    }
}
export class CursorError {
    constructor(msg, cursor) {
        this.msg = msg;
        this.cursor = cursor;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV4ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2xleGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxLQUFLLE1BQU0sVUFBVSxDQUFDO0FBQ2xDLE9BQU8sRUFBQyxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFMUYsT0FBTyxFQUFDLDRCQUE0QixFQUFzQixNQUFNLFlBQVksQ0FBQztBQUM3RSxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQzFDLE9BQU8sRUFBQyxjQUFjLEVBQWdCLE1BQU0sUUFBUSxDQUFDO0FBR3JELE1BQU0sT0FBTyxVQUFXLFNBQVEsVUFBVTtJQUN4QyxZQUNFLFFBQWdCLEVBQ1QsU0FBMkIsRUFDbEMsSUFBcUI7UUFFckIsS0FBSyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUhmLGNBQVMsR0FBVCxTQUFTLENBQWtCO0lBSXBDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxjQUFjO0lBQ3pCLFlBQ1MsTUFBZSxFQUNmLE1BQW9CLEVBQ3BCLDJCQUFvQztRQUZwQyxXQUFNLEdBQU4sTUFBTSxDQUFTO1FBQ2YsV0FBTSxHQUFOLE1BQU0sQ0FBYztRQUNwQixnQ0FBMkIsR0FBM0IsMkJBQTJCLENBQVM7SUFDMUMsQ0FBQztDQUNMO0FBeUVELE1BQU0sVUFBVSxRQUFRLENBQ3RCLE1BQWMsRUFDZCxHQUFXLEVBQ1gsZ0JBQW9ELEVBQ3BELFVBQTJCLEVBQUU7SUFFN0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsSUFBSSxlQUFlLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzlGLFNBQVMsQ0FBQyxRQUFR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TyxXQUFXO0lBQ3RCLFlBQ1MsR0FBVyxFQUNYLE1BQXVCO1FBRHZCLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFDWCxXQUFNLEdBQU4sTUFBTSxDQUFpQjtJQUM3QixDQUFDO0NBQ0wiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi4vY2hhcnMnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUxvY2F0aW9uLCBQYXJzZVNvdXJjZUZpbGUsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9kZWZhdWx0cyc7XG5pbXBvcnQge05BTUVEX0VOVElUSUVTfSBmcm9tICcuL2VudGl0aWVzJztcbmltcG9ydCB7VGFnQ29udGVudFR5cGUsIFRhZ0RlZmluaXRpb259IGZyb20gJy4vdGFncyc7XG5pbXBvcnQge0luY29tcGxldGVUYWdPcGVuVG9rZW4sIFRhZ09wZW5TdGFydFRva2VuLCBUb2tlbiwgVG9rZW5UeXBlfSBmcm9tICcuL3Rva2Vucyc7XG5cbmV4cG9ydCBjbGFzcyBUb2tlbkVycm9yIGV4dGVuZHMgUGFyc2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVycm9yTXNnOiBzdHJpbmcsXG4gICAgcHVibGljIHRva2VuVHlwZTogVG9rZW5UeXBlIHwgbnVsbCxcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICkge1xuICAgIHN1cGVyKHNwYW4sIGVycm9yTXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW5pemVSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgdG9rZW5zOiBUb2tlbltdLFxuICAgIHB1YmxpYyBlcnJvcnM6IFRva2VuRXJyb3JbXSxcbiAgICBwdWJsaWMgbm9uTm9ybWFsaXplZEljdUV4cHJlc3Npb25zOiBUb2tlbltdLFxuICApIHt9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGV4ZXJSYW5nZSB7XG4gIHN0YXJ0UG9zOiBudW1iZXI7XG4gIHN0YXJ0TGluZTogbnVtYmVyO1xuICBzdGFydENvbDogbnVtYmVyO1xuICBlbmRQb3M6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBPcHRpb25zIHRoYXQgbW9kaWZ5IGhvdyB0aGUgdGV4dCBpcyB0b2tlbml6ZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVG9rZW5pemVPcHRpb25zIHtcbiAgLyoqIFdoZXRoZXIgdG8gdG9rZW5pemUgSUNVIG1lc3NhZ2VzIChjb25zaWRlcmVkIGFzIHRleHQgbm9kZXMgd2hlbiBmYWxzZSkuICovXG4gIHRva2VuaXplRXhwYW5zaW9uRm9ybXM/OiBib29sZWFuO1xuICAvKiogSG93IHRvIHRva2VuaXplIGludGVycG9sYXRpb24gbWFya2Vycy4gKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgYW5kIGVuZCBwb2ludCBvZiB0aGUgdGV4dCB0byBwYXJzZSB3aXRoaW4gdGhlIGBzb3VyY2VgIHN0cmluZy5cbiAgICogVGhlIGVudGlyZSBgc291cmNlYCBzdHJpbmcgaXMgcGFyc2VkIGlmIHRoaXMgaXMgbm90IHByb3ZpZGVkLlxuICAgKiAqL1xuICByYW5nZT86IExleGVyUmFuZ2U7XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGEgSmF2YVNjcmlwdCBzdHJpbmcsIHRoZW4gd2UgaGF2ZSB0byBkZWFsIHdpdGggZXNjYXBlIHNlcXVlbmNlcy5cbiAgICpcbiAgICogKipFeGFtcGxlIDE6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcImRlZlxcbmdoaVwiXG4gICAqIGBgYFxuICAgKlxuICAgKiAtIFRoZSBgXFxcImAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYFwiYC5cbiAgICogLSBUaGUgYFxcbmAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYSBuZXcgbGluZSBjaGFyYWN0ZXIgaW4gYSB0b2tlbixcbiAgICogICBidXQgaXQgc2hvdWxkIG5vdCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqXG4gICAqICoqRXhhbXBsZSAyOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXG4gICAqICBkZWZcIlxuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGxpbmUgY29udGludWF0aW9uIChgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3bGluZSkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBhIHRva2VuXG4gICAqIGJ1dCB0aGUgbmV3IGxpbmUgc2hvdWxkIGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICovXG4gIGVzY2FwZWRTdHJpbmc/OiBib29sZWFuO1xuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhbiBleHRlcm5hbCB0ZW1wbGF0ZSAoZS5nLiB2aWEgYHRlbXBsYXRlVXJsYCkgdGhlbiB3ZSBuZWVkIHRvIGRlY2lkZVxuICAgKiB3aGV0aGVyIG9yIG5vdCB0byBub3JtYWxpemUgdGhlIGxpbmUtZW5kaW5ncyAoZnJvbSBgXFxyXFxuYCB0byBgXFxuYCkgd2hlbiBwcm9jZXNzaW5nIElDVVxuICAgKiBleHByZXNzaW9ucy5cbiAgICpcbiAgICogSWYgYHRydWVgIHRoZW4gd2Ugd2lsbCBub3JtYWxpemUgSUNVIGV4cHJlc3Npb24gbGluZSBlbmRpbmdzLlxuICAgKiBUaGUgZGVmYXVsdCBpcyBgZmFsc2VgLCBidXQgdGhpcyB3aWxsIGJlIHN3aXRjaGVkIGluIGEgZnV0dXJlIG1ham9yIHJlbGVhc2UuXG4gICAqL1xuICBpMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXM/OiBib29sZWFuO1xuICAvKipcbiAgICogQW4gYXJyYXkgb2YgY2hhcmFjdGVycyB0aGF0IHNob3VsZCBiZSBjb25zaWRlcmVkIGFzIGxlYWRpbmcgdHJpdmlhLlxuICAgKiBMZWFkaW5nIHRyaXZpYSBhcmUgY2hhcmFjdGVycyB0aGF0IGFyZSBub3QgaW1wb3J0YW50IHRvIHRoZSBkZXZlbG9wZXIsIGFuZCBzbyBzaG91bGQgbm90IGJlXG4gICAqIGluY2x1ZGVkIGluIHNvdXJjZS1tYXAgc2VnbWVudHMuICBBIGNvbW1vbiBleGFtcGxlIGlzIHdoaXRlc3BhY2UuXG4gICAqL1xuICBsZWFkaW5nVHJpdmlhQ2hhcnM/OiBzdHJpbmdbXTtcbiAgLyoqXG4gICAqIElmIHRydWUsIGRvIG5vdCBjb252ZXJ0IENSTEYgdG8gTEYuXG4gICAqL1xuICBwcmVzZXJ2ZUxpbmVFbmRpbmdzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogV2hldGhlciB0byB0b2tlbml6ZSBAIGJsb2NrIHN5bnRheC4gT3RoZXJ3aXNlIGNvbnNpZGVyZWQgdGV4dCxcbiAgICogb3IgSUNVIHRva2VucyBpZiBgdG9rZW5pemVFeHBhbnNpb25Gb3Jtc2AgaXMgZW5hYmxlZC5cbiAgICovXG4gIHRva2VuaXplQmxvY2tzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRva2VuaXplKFxuICBzb3VyY2U6IHN0cmluZyxcbiAgdXJsOiBzdHJpbmcsXG4gIGdldFRhZ0RlZmluaXRpb246ICh0YWdOYW1lOiBzdHJpbmcpID0+IFRhZ0RlZmluaXRpb24sXG4gIG9wdGlvbnM6IFRva2VuaXplT3B0aW9ucyA9IHt9LFxuKTogVG9rZW5pemVSZXN1bHQge1xuICBjb25zdCB0b2tlbml6ZXIgPSBuZXcgX1Rva2VuaXplcihuZXcgUGFyc2VTb3VyY2VGaWxlKHNvdXJjZSwgdXJsKSwgZ2V0VGFnRGVmaW5pdGlvbiwgb3B0aW9ucyk7XG4gIHRva2VuaXplci50b2tlbml6ZSgpO1xuICByZXR1cm4gbmV3IFRva2VuaXplUmVzdWx0KFxuICAgIG1lcmdlVGV4dFRva2Vucyh0b2tlbml6ZXIudG9rZW5zKSxcbiAgICB0b2tlbml6ZXIuZXJyb3JzLFxuICAgIHRva2VuaXplci5ub25Ob3JtYWxpemVkSWN1RXhwcmVzc2lvbnMsXG4gICk7XG59XG5cbmNvbnN0IF9DUl9PUl9DUkxGX1JFR0VYUCA9IC9cXHJcXG4/L2c7XG5cbmZ1bmN0aW9uIF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2coY2hhckNvZGU6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGNoYXIgPSBjaGFyQ29kZSA9PT0gY2hhcnMuJEVPRiA/ICdFT0YnIDogU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSk7XG4gIHJldHVybiBgVW5leHBlY3RlZCBjaGFyYWN0ZXIgXCIke2NoYXJ9XCJgO1xufVxuXG5mdW5jdGlvbiBfdW5rbm93bkVudGl0eUVycm9yTXNnKGVudGl0eVNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBVbmtub3duIGVudGl0eSBcIiR7ZW50aXR5U3JjfVwiIC0gdXNlIHRoZSBcIiYjPGRlY2ltYWw+O1wiIG9yICBcIiYjeDxoZXg+O1wiIHN5bnRheGA7XG59XG5cbmZ1bmN0aW9uIF91bnBhcnNhYmxlRW50aXR5RXJyb3JNc2codHlwZTogQ2hhcmFjdGVyUmVmZXJlbmNlVHlwZSwgZW50aXR5U3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFVuYWJsZSB0byBwYXJzZSBlbnRpdHkgXCIke2VudGl0eVN0cn1cIiAtICR7dHlwZX0gY2hhcmFjdGVyIHJlZmVyZW5jZSBlbnRpdGllcyBtdXN0IGVuZCB3aXRoIFwiO1wiYDtcbn1cblxuZW51bSBDaGFyYWN0ZXJSZWZlcmVuY2VUeXBlIHtcbiAgSEVYID0gJ2hleGFkZWNpbWFsJyxcbiAgREVDID0gJ2RlY2ltYWwnLFxufVxuXG5jbGFzcyBfQ29udHJvbEZsb3dFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlcnJvcjogVG9rZW5FcnJvcikge31cbn1cblxuLy8gU2VlIGh0dHBzOi8vd3d3LnczLm9yZy9UUi9odG1sNTEvc3ludGF4Lmh0bWwjd3JpdGluZy1odG1sLWRvY3VtZW50c1xuY2xhc3MgX1Rva2VuaXplciB7XG4gIHByaXZhdGUgX2N1cnNvcjogQ2hhcmFjdGVyQ3Vyc29yO1xuICBwcml2YXRlIF90b2tlbml6ZUljdTogYm9vbGVhbjtcbiAgcHJpdmF0ZSBfaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgcHJpdmF0ZSBfbGVhZGluZ1RyaXZpYUNvZGVQb2ludHM6IG51bWJlcltdIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9jdXJyZW50VG9rZW5TdGFydDogQ2hhcmFjdGVyQ3Vyc29yIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2N1cnJlbnRUb2tlblR5cGU6IFRva2VuVHlwZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9leHBhbnNpb25DYXNlU3RhY2s6IFRva2VuVHlwZVtdID0gW107XG4gIHByaXZhdGUgX2luSW50ZXJwb2xhdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIHJlYWRvbmx5IF9wcmVzZXJ2ZUxpbmVFbmRpbmdzOiBib29sZWFuO1xuICBwcml2YXRlIHJlYWRvbmx5IF9pMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXM6IGJvb2xlYW47XG4gIHByaXZhdGUgcmVhZG9ubHkgX3Rva2VuaXplQmxvY2tzOiBib29sZWFuO1xuICB0b2tlbnM6IFRva2VuW10gPSBbXTtcbiAgZXJyb3JzOiBUb2tlbkVycm9yW10gPSBbXTtcbiAgbm9uTm9ybWFsaXplZEljdUV4cHJlc3Npb25zOiBUb2tlbltdID0gW107XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBfZmlsZSBUaGUgaHRtbCBzb3VyY2UgZmlsZSBiZWluZyB0b2tlbml6ZWQuXG4gICAqIEBwYXJhbSBfZ2V0VGFnRGVmaW5pdGlvbiBBIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXRyaWV2ZSBhIHRhZyBkZWZpbml0aW9uIGZvciBhIGdpdmVuIHRhZyBuYW1lLlxuICAgKiBAcGFyYW0gb3B0aW9ucyBDb25maWd1cmF0aW9uIG9mIHRoZSB0b2tlbml6YXRpb24uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBfZmlsZTogUGFyc2VTb3VyY2VGaWxlLFxuICAgIHByaXZhdGUgX2dldFRhZ0RlZmluaXRpb246ICh0YWdOYW1lOiBzdHJpbmcpID0+IFRhZ0RlZmluaXRpb24sXG4gICAgb3B0aW9uczogVG9rZW5pemVPcHRpb25zLFxuICApIHtcbiAgICB0aGlzLl90b2tlbml6ZUljdSA9IG9wdGlvbnMudG9rZW5pemVFeHBhbnNpb25Gb3JtcyB8fCBmYWxzZTtcbiAgICB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnID0gb3B0aW9ucy5pbnRlcnBvbGF0aW9uQ29uZmlnIHx8IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgdGhpcy5fbGVhZGluZ1RyaXZpYUNvZGVQb2ludHMgPVxuICAgICAgb3B0aW9ucy5sZWFkaW5nVHJpdmlhQ2hhcnMgJiYgb3B0aW9ucy5sZWFkaW5nVHJpdmlhQ2hhcnMubWFwKChjKSA9PiBjLmNvZGVQb2ludEF0KDApIHx8IDApO1xuICAgIGNvbnN0IHJhbmdlID0gb3B0aW9ucy5yYW5nZSB8fCB7XG4gICAgICBlbmRQb3M6IF9maWxlLmNvbnRlbnQubGVuZ3RoLFxuICAgICAgc3RhcnRQb3M6IDAsXG4gICAgICBzdGFydExpbmU6IDAsXG4gICAgICBzdGFydENvbDogMCxcbiAgICB9O1xuICAgIHRoaXMuX2N1cnNvciA9IG9wdGlvbnMuZXNjYXBlZFN0cmluZ1xuICAgICAgPyBuZXcgRXNjYXBlZENoYXJhY3RlckN1cnNvcihfZmlsZSwgcmFuZ2UpXG4gICAgICA6IG5ldyBQbGFpbkNoYXJhY3RlckN1cnNvcihfZmlsZSwgcmFuZ2UpO1xuICAgIHRoaXMuX3ByZXNlcnZlTGluZUVuZGluZ3MgPSBvcHRpb25zLnByZXNlcnZlTGluZUVuZGluZ3MgfHwgZmFsc2U7XG4gICAgdGhpcy5faTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzID0gb3B0aW9ucy5pMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXMgfHwgZmFsc2U7XG4gICAgdGhpcy5fdG9rZW5pemVCbG9ja3MgPSBvcHRpb25zLnRva2VuaXplQmxvY2tzID8/IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuX2N1cnNvci5pbml0KCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuX3ByZXNlcnZlTGluZUVuZGluZ3MpIHtcbiAgICAgIHJldHVybiBjb250ZW50O1xuICAgIH1cbiAgICAvLyBodHRwczovL3d3dy53My5vcmcvVFIvaHRtbDUxL3N5bnRheC5odG1sI3ByZXByb2Nlc3NpbmctdGhlLWlucHV0LXN0cmVhbVxuICAgIC8vIEluIG9yZGVyIHRvIGtlZXAgdGhlIG9yaWdpbmFsIHBvc2l0aW9uIGluIHRoZSBzb3VyY2UsIHdlIGNhbiBub3RcbiAgICAvLyBwcmUtcHJvY2VzcyBpdC5cbiAgICAvLyBJbnN0ZWFkIENScyBhcmUgcHJvY2Vzc2VkIHJpZ2h0IGJlZm9yZSBpbnN0YW50aWF0aW5nIHRoZSB0b2tlbnMuXG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZShfQ1JfT1JfQ1JMRl9SRUdFWFAsICdcXG4nKTtcbiAgfVxuXG4gIHRva2VuaXplKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kRU9GKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kTFQpKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kQkFORykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lQ2RhdGEoc3RhcnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJE1JTlVTKSkge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lQ29tbWVudChzdGFydCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lRG9jVHlwZShzdGFydCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFNMQVNIKSkge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZVRhZ0Nsb3NlKHN0YXJ0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZVRhZ09wZW4oc3RhcnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90b2tlbml6ZUJsb2NrcyAmJiB0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJEFUKSkge1xuICAgICAgICAgIHRoaXMuX2NvbnN1bWVCbG9ja1N0YXJ0KHN0YXJ0KTtcbiAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0aGlzLl90b2tlbml6ZUJsb2NrcyAmJlxuICAgICAgICAgICF0aGlzLl9pbkludGVycG9sYXRpb24gJiZcbiAgICAgICAgICAhdGhpcy5faXNJbkV4cGFuc2lvbkNhc2UoKSAmJlxuICAgICAgICAgICF0aGlzLl9pc0luRXhwYW5zaW9uRm9ybSgpICYmXG4gICAgICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRSQlJBQ0UpXG4gICAgICAgICkge1xuICAgICAgICAgIHRoaXMuX2NvbnN1bWVCbG9ja0VuZChzdGFydCk7XG4gICAgICAgIH0gZWxzZSBpZiAoISh0aGlzLl90b2tlbml6ZUljdSAmJiB0aGlzLl90b2tlbml6ZUV4cGFuc2lvbkZvcm0oKSkpIHtcbiAgICAgICAgICAvLyBJbiAocG9zc2libHkgaW50ZXJwb2xhdGVkKSB0ZXh0IHRoZSBlbmQgb2YgdGhlIHRleHQgaXMgZ2l2ZW4gYnkgYGlzVGV4dEVuZCgpYCwgd2hpbGVcbiAgICAgICAgICAvLyB0aGUgcHJlbWF0dXJlIGVuZCBvZiBhbiBpbnRlcnBvbGF0aW9uIGlzIGdpdmVuIGJ5IHRoZSBzdGFydCBvZiBhIG5ldyBIVE1MIGVsZW1lbnQuXG4gICAgICAgICAgdGhpcy5fY29uc3VtZVdpdGhJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgICAgVG9rZW5UeXBlLlRFWFQsXG4gICAgICAgICAgICBUb2tlblR5cGUuSU5URVJQT0xBVElPTixcbiAgICAgICAgICAgICgpID0+IHRoaXMuX2lzVGV4dEVuZCgpLFxuICAgICAgICAgICAgKCkgPT4gdGhpcy5faXNUYWdTdGFydCgpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhpcy5oYW5kbGVFcnJvcihlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRU9GKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9nZXRCbG9ja05hbWUoKTogc3RyaW5nIHtcbiAgICAvLyBUaGlzIGFsbG93cyB1cyB0byBjYXB0dXJlIHVwIHNvbWV0aGluZyBsaWtlIGBAZWxzZSBpZmAsIGJ1dCBub3QgYEAgaWZgLlxuICAgIGxldCBzcGFjZXNJbk5hbWVBbGxvd2VkID0gZmFsc2U7XG4gICAgY29uc3QgbmFtZUN1cnNvciA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuXG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbigoY29kZSkgPT4ge1xuICAgICAgaWYgKGNoYXJzLmlzV2hpdGVzcGFjZShjb2RlKSkge1xuICAgICAgICByZXR1cm4gIXNwYWNlc0luTmFtZUFsbG93ZWQ7XG4gICAgICB9XG4gICAgICBpZiAoaXNCbG9ja05hbWVDaGFyKGNvZGUpKSB7XG4gICAgICAgIHNwYWNlc0luTmFtZUFsbG93ZWQgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVDdXJzb3IpLnRyaW0oKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVCbG9ja1N0YXJ0KHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5CTE9DS19PUEVOX1NUQVJULCBzdGFydCk7XG4gICAgY29uc3Qgc3RhcnRUb2tlbiA9IHRoaXMuX2VuZFRva2VuKFt0aGlzLl9nZXRCbG9ja05hbWUoKV0pO1xuXG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRMUEFSRU4pIHtcbiAgICAgIC8vIEFkdmFuY2UgcGFzdCB0aGUgb3BlbmluZyBwYXJlbi5cbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICAvLyBDYXB0dXJlIHRoZSBwYXJhbWV0ZXJzLlxuICAgICAgdGhpcy5fY29uc3VtZUJsb2NrUGFyYW1ldGVycygpO1xuICAgICAgLy8gQWxsb3cgc3BhY2VzIGJlZm9yZSB0aGUgY2xvc2luZyBwYXJlbi5cbiAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kUlBBUkVOKSkge1xuICAgICAgICAvLyBBbGxvdyBzcGFjZXMgYWZ0ZXIgdGhlIHBhcmVuLlxuICAgICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGFydFRva2VuLnR5cGUgPSBUb2tlblR5cGUuSU5DT01QTEVURV9CTE9DS19PUEVOO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kTEJSQUNFKSkge1xuICAgICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQkxPQ0tfT1BFTl9FTkQpO1xuICAgICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGFydFRva2VuLnR5cGUgPSBUb2tlblR5cGUuSU5DT01QTEVURV9CTE9DS19PUEVOO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVCbG9ja0VuZChzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQkxPQ0tfQ0xPU0UsIHN0YXJ0KTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQmxvY2tQYXJhbWV0ZXJzKCkge1xuICAgIC8vIFRyaW0gdGhlIHdoaXRlc3BhY2UgdW50aWwgdGhlIGZpcnN0IHBhcmFtZXRlci5cbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzQmxvY2tQYXJhbWV0ZXJDaGFyKTtcblxuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kUlBBUkVOICYmIHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRFT0YpIHtcbiAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkJMT0NLX1BBUkFNRVRFUik7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgbGV0IGluUXVvdGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICAgICAgbGV0IG9wZW5QYXJlbnMgPSAwO1xuXG4gICAgICAvLyBDb25zdW1lIHRoZSBwYXJhbWV0ZXIgdW50aWwgdGhlIG5leHQgc2VtaWNvbG9uIG9yIGJyYWNlLlxuICAgICAgLy8gTm90ZSB0aGF0IHdlIHNraXAgb3ZlciBzZW1pY29sb25zL2JyYWNlcyBpbnNpZGUgb2Ygc3RyaW5ncy5cbiAgICAgIHdoaWxlIChcbiAgICAgICAgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRTRU1JQ09MT04gJiYgdGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJEVPRikgfHxcbiAgICAgICAgaW5RdW90ZSAhPT0gbnVsbFxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSB0aGlzLl9jdXJzb3IucGVlaygpO1xuXG4gICAgICAgIC8vIFNraXAgdG8gdGhlIG5leHQgY2hhcmFjdGVyIGlmIGl0IHdhcyBlc2NhcGVkLlxuICAgICAgICBpZiAoY2hhciA9PT0gY2hhcnMuJEJBQ0tTTEFTSCkge1xuICAgICAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gaW5RdW90ZSkge1xuICAgICAgICAgIGluUXVvdGUgPSBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKGluUXVvdGUgPT09IG51bGwgJiYgY2hhcnMuaXNRdW90ZShjaGFyKSkge1xuICAgICAgICAgIGluUXVvdGUgPSBjaGFyO1xuICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IGNoYXJzLiRMUEFSRU4gJiYgaW5RdW90ZSA9PT0gbnVsbCkge1xuICAgICAgICAgIG9wZW5QYXJlbnMrKztcbiAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBjaGFycy4kUlBBUkVOICYmIGluUXVvdGUgPT09IG51bGwpIHtcbiAgICAgICAgICBpZiAob3BlblBhcmVucyA9PT0gMCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChvcGVuUGFyZW5zID4gMCkge1xuICAgICAgICAgICAgb3BlblBhcmVucy0tO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMoc3RhcnQpXSk7XG5cbiAgICAgIC8vIFNraXAgdG8gdGhlIG5leHQgcGFyYW1ldGVyLlxuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc0Jsb2NrUGFyYW1ldGVyQ2hhcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHdoZXRoZXIgYW4gSUNVIHRva2VuIGhhcyBiZWVuIGNyZWF0ZWRcbiAgICogQGludGVybmFsXG4gICAqL1xuICBwcml2YXRlIF90b2tlbml6ZUV4cGFuc2lvbkZvcm0oKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuaXNFeHBhbnNpb25Gb3JtU3RhcnQoKSkge1xuICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbkZvcm1TdGFydCgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGlzRXhwYW5zaW9uQ2FzZVN0YXJ0KHRoaXMuX2N1cnNvci5wZWVrKCkpICYmIHRoaXMuX2lzSW5FeHBhbnNpb25Gb3JtKCkpIHtcbiAgICAgIHRoaXMuX2NvbnN1bWVFeHBhbnNpb25DYXNlU3RhcnQoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kUkJSQUNFKSB7XG4gICAgICBpZiAodGhpcy5faXNJbkV4cGFuc2lvbkNhc2UoKSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uQ2FzZUVuZCgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2lzSW5FeHBhbnNpb25Gb3JtKCkpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbkZvcm1FbmQoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfYmVnaW5Ub2tlbih0eXBlOiBUb2tlblR5cGUsIHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCkpIHtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5TdGFydCA9IHN0YXJ0O1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUgPSB0eXBlO1xuICB9XG5cbiAgcHJpdmF0ZSBfZW5kVG9rZW4ocGFydHM6IHN0cmluZ1tdLCBlbmQ/OiBDaGFyYWN0ZXJDdXJzb3IpOiBUb2tlbiB7XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgVG9rZW5FcnJvcihcbiAgICAgICAgJ1Byb2dyYW1taW5nIGVycm9yIC0gYXR0ZW1wdGVkIHRvIGVuZCBhIHRva2VuIHdoZW4gdGhlcmUgd2FzIG5vIHN0YXJ0IHRvIHRoZSB0b2tlbicsXG4gICAgICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUsXG4gICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKGVuZCksXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodGhpcy5fY3VycmVudFRva2VuVHlwZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAgICdQcm9ncmFtbWluZyBlcnJvciAtIGF0dGVtcHRlZCB0byBlbmQgYSB0b2tlbiB3aGljaCBoYXMgbm8gdG9rZW4gdHlwZScsXG4gICAgICAgIG51bGwsXG4gICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0KSxcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuID0ge1xuICAgICAgdHlwZTogdGhpcy5fY3VycmVudFRva2VuVHlwZSxcbiAgICAgIHBhcnRzLFxuICAgICAgc291cmNlU3BhbjogKGVuZCA/PyB0aGlzLl9jdXJzb3IpLmdldFNwYW4oXG4gICAgICAgIHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0LFxuICAgICAgICB0aGlzLl9sZWFkaW5nVHJpdmlhQ29kZVBvaW50cyxcbiAgICAgICksXG4gICAgfSBhcyBUb2tlbjtcbiAgICB0aGlzLnRva2Vucy5wdXNoKHRva2VuKTtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5TdGFydCA9IG51bGw7XG4gICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSA9IG51bGw7XG4gICAgcmV0dXJuIHRva2VuO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRXJyb3IobXNnOiBzdHJpbmcsIHNwYW46IFBhcnNlU291cmNlU3Bhbik6IF9Db250cm9sRmxvd0Vycm9yIHtcbiAgICBpZiAodGhpcy5faXNJbkV4cGFuc2lvbkZvcm0oKSkge1xuICAgICAgbXNnICs9IGAgKERvIHlvdSBoYXZlIGFuIHVuZXNjYXBlZCBcIntcIiBpbiB5b3VyIHRlbXBsYXRlPyBVc2UgXCJ7eyAneycgfX1cIikgdG8gZXNjYXBlIGl0LilgO1xuICAgIH1cbiAgICBjb25zdCBlcnJvciA9IG5ldyBUb2tlbkVycm9yKG1zZywgdGhpcy5fY3VycmVudFRva2VuVHlwZSwgc3Bhbik7XG4gICAgdGhpcy5fY3VycmVudFRva2VuU3RhcnQgPSBudWxsO1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUgPSBudWxsO1xuICAgIHJldHVybiBuZXcgX0NvbnRyb2xGbG93RXJyb3IoZXJyb3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVFcnJvcihlOiBhbnkpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIEN1cnNvckVycm9yKSB7XG4gICAgICBlID0gdGhpcy5fY3JlYXRlRXJyb3IoZS5tc2csIHRoaXMuX2N1cnNvci5nZXRTcGFuKGUuY3Vyc29yKSk7XG4gICAgfVxuICAgIGlmIChlIGluc3RhbmNlb2YgX0NvbnRyb2xGbG93RXJyb3IpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goZS5lcnJvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdENoYXJDb2RlKGNoYXJDb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhckNvZGUpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdENoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKGNoYXJDb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAoY29tcGFyZUNoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKHRoaXMuX2N1cnNvci5wZWVrKCksIGNoYXJDb2RlKSkge1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9yZXF1aXJlQ2hhckNvZGUoY2hhckNvZGU6IG51bWJlcikge1xuICAgIGNvbnN0IGxvY2F0aW9uID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhckNvZGUpKSB7XG4gICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSxcbiAgICAgICAgdGhpcy5fY3Vyc29yLmdldFNwYW4obG9jYXRpb24pLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0U3RyKGNoYXJzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBsZW4gPSBjaGFycy5sZW5ndGg7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5jaGFyc0xlZnQoKSA8IGxlbikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBpbml0aWFsUG9zaXRpb24gPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy5jaGFyQ29kZUF0KGkpKSkge1xuICAgICAgICAvLyBJZiBhdHRlbXB0aW5nIHRvIHBhcnNlIHRoZSBzdHJpbmcgZmFpbHMsIHdlIHdhbnQgdG8gcmVzZXQgdGhlIHBhcnNlclxuICAgICAgICAvLyB0byB3aGVyZSBpdCB3YXMgYmVmb3JlIHRoZSBhdHRlbXB0XG4gICAgICAgIHRoaXMuX2N1cnNvciA9IGluaXRpYWxQb3NpdGlvbjtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgX2F0dGVtcHRTdHJDYXNlSW5zZW5zaXRpdmUoY2hhcnM6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hhcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdENoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKGNoYXJzLmNoYXJDb2RlQXQoaSkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwcml2YXRlIF9yZXF1aXJlU3RyKGNoYXJzOiBzdHJpbmcpIHtcbiAgICBjb25zdCBsb2NhdGlvbiA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIGlmICghdGhpcy5fYXR0ZW1wdFN0cihjaGFycykpIHtcbiAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKHRoaXMuX2N1cnNvci5wZWVrKCkpLFxuICAgICAgICB0aGlzLl9jdXJzb3IuZ2V0U3Bhbihsb2NhdGlvbiksXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4ocHJlZGljYXRlOiAoY29kZTogbnVtYmVyKSA9PiBib29sZWFuKSB7XG4gICAgd2hpbGUgKCFwcmVkaWNhdGUodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVxdWlyZUNoYXJDb2RlVW50aWxGbihwcmVkaWNhdGU6IChjb2RlOiBudW1iZXIpID0+IGJvb2xlYW4sIGxlbjogbnVtYmVyKSB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKHByZWRpY2F0ZSk7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5kaWZmKHN0YXJ0KSA8IGxlbikge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgIF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2codGhpcy5fY3Vyc29yLnBlZWsoKSksXG4gICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKHN0YXJ0KSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdFVudGlsQ2hhcihjaGFyOiBudW1iZXIpIHtcbiAgICB3aGlsZSAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcikge1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9yZWFkQ2hhcigpOiBzdHJpbmcge1xuICAgIC8vIERvbid0IHJlbHkgdXBvbiByZWFkaW5nIGRpcmVjdGx5IGZyb20gYF9pbnB1dGAgYXMgdGhlIGFjdHVhbCBjaGFyIHZhbHVlXG4gICAgLy8gbWF5IGhhdmUgYmVlbiBnZW5lcmF0ZWQgZnJvbSBhbiBlc2NhcGUgc2VxdWVuY2UuXG4gICAgY29uc3QgY2hhciA9IFN0cmluZy5mcm9tQ29kZVBvaW50KHRoaXMuX2N1cnNvci5wZWVrKCkpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIGNoYXI7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRW50aXR5KHRleHRUb2tlblR5cGU6IFRva2VuVHlwZSk6IHZvaWQge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVOQ09ERURfRU5USVRZKTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kSEFTSCkpIHtcbiAgICAgIGNvbnN0IGlzSGV4ID0gdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiR4KSB8fCB0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFgpO1xuICAgICAgY29uc3QgY29kZVN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzRGlnaXRFbnRpdHlFbmQpO1xuICAgICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT0gY2hhcnMuJFNFTUlDT0xPTikge1xuICAgICAgICAvLyBBZHZhbmNlIGN1cnNvciB0byBpbmNsdWRlIHRoZSBwZWVrZWQgY2hhcmFjdGVyIGluIHRoZSBzdHJpbmcgcHJvdmlkZWQgdG8gdGhlIGVycm9yXG4gICAgICAgIC8vIG1lc3NhZ2UuXG4gICAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICAgIGNvbnN0IGVudGl0eVR5cGUgPSBpc0hleCA/IENoYXJhY3RlclJlZmVyZW5jZVR5cGUuSEVYIDogQ2hhcmFjdGVyUmVmZXJlbmNlVHlwZS5ERUM7XG4gICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICAgIF91bnBhcnNhYmxlRW50aXR5RXJyb3JNc2coZW50aXR5VHlwZSwgdGhpcy5fY3Vyc29yLmdldENoYXJzKHN0YXJ0KSksXG4gICAgICAgICAgdGhpcy5fY3Vyc29yLmdldFNwYW4oKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0ck51bSA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhjb2RlU3RhcnQpO1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNoYXJDb2RlID0gcGFyc2VJbnQoc3RyTnVtLCBpc0hleCA/IDE2IDogMTApO1xuICAgICAgICB0aGlzLl9lbmRUb2tlbihbU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSksIHRoaXMuX2N1cnNvci5nZXRDaGFycyhzdGFydCldKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgICAgICBfdW5rbm93bkVudGl0eUVycm9yTXNnKHRoaXMuX2N1cnNvci5nZXRDaGFycyhzdGFydCkpLFxuICAgICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKCksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5hbWVTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05hbWVkRW50aXR5RW5kKTtcbiAgICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpICE9IGNoYXJzLiRTRU1JQ09MT04pIHtcbiAgICAgICAgLy8gTm8gc2VtaWNvbG9uIHdhcyBmb3VuZCBzbyBhYm9ydCB0aGUgZW5jb2RlZCBlbnRpdHkgdG9rZW4gdGhhdCB3YXMgaW4gcHJvZ3Jlc3MsIGFuZCB0cmVhdFxuICAgICAgICAvLyB0aGlzIGFzIGEgdGV4dCB0b2tlblxuICAgICAgICB0aGlzLl9iZWdpblRva2VuKHRleHRUb2tlblR5cGUsIHN0YXJ0KTtcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gbmFtZVN0YXJ0O1xuICAgICAgICB0aGlzLl9lbmRUb2tlbihbJyYnXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVTdGFydCk7XG4gICAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICAgIGNvbnN0IGNoYXIgPSBOQU1FRF9FTlRJVElFU1tuYW1lXTtcbiAgICAgICAgaWYgKCFjaGFyKSB7XG4gICAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoX3Vua25vd25FbnRpdHlFcnJvck1zZyhuYW1lKSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oc3RhcnQpKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbmRUb2tlbihbY2hhciwgYCYke25hbWV9O2BdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lUmF3VGV4dChjb25zdW1lRW50aXRpZXM6IGJvb2xlYW4sIGVuZE1hcmtlclByZWRpY2F0ZTogKCkgPT4gYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oY29uc3VtZUVudGl0aWVzID8gVG9rZW5UeXBlLkVTQ0FQQUJMRV9SQVdfVEVYVCA6IFRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHRhZ0Nsb3NlU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIGNvbnN0IGZvdW5kRW5kTWFya2VyID0gZW5kTWFya2VyUHJlZGljYXRlKCk7XG4gICAgICB0aGlzLl9jdXJzb3IgPSB0YWdDbG9zZVN0YXJ0O1xuICAgICAgaWYgKGZvdW5kRW5kTWFya2VyKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGNvbnN1bWVFbnRpdGllcyAmJiB0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kQU1QRVJTQU5EKSB7XG4gICAgICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKHBhcnRzLmpvaW4oJycpKV0pO1xuICAgICAgICBwYXJ0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9jb25zdW1lRW50aXR5KFRva2VuVHlwZS5FU0NBUEFCTEVfUkFXX1RFWFQpO1xuICAgICAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FU0NBUEFCTEVfUkFXX1RFWFQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFydHMucHVzaCh0aGlzLl9yZWFkQ2hhcigpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fZW5kVG9rZW4oW3RoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnMocGFydHMuam9pbignJykpXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ29tbWVudChzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ09NTUVOVF9TVEFSVCwgc3RhcnQpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kTUlOVVMpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgICB0aGlzLl9jb25zdW1lUmF3VGV4dChmYWxzZSwgKCkgPT4gdGhpcy5fYXR0ZW1wdFN0cignLS0+JykpO1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkNPTU1FTlRfRU5EKTtcbiAgICB0aGlzLl9yZXF1aXJlU3RyKCctLT4nKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ2RhdGEoc3RhcnQ6IENoYXJhY3RlckN1cnNvcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkNEQVRBX1NUQVJULCBzdGFydCk7XG4gICAgdGhpcy5fcmVxdWlyZVN0cignQ0RBVEFbJyk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0KGZhbHNlLCAoKSA9PiB0aGlzLl9hdHRlbXB0U3RyKCddXT4nKSk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ0RBVEFfRU5EKTtcbiAgICB0aGlzLl9yZXF1aXJlU3RyKCddXT4nKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRG9jVHlwZShzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRE9DX1RZUEUsIHN0YXJ0KTtcbiAgICBjb25zdCBjb250ZW50U3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0VW50aWxDaGFyKGNoYXJzLiRHVCk7XG4gICAgY29uc3QgY29udGVudCA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhjb250ZW50U3RhcnQpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW2NvbnRlbnRdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVQcmVmaXhBbmROYW1lKCk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBuYW1lT3JQcmVmaXhTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIGxldCBwcmVmaXg6IHN0cmluZyA9ICcnO1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kQ09MT04gJiYgIWlzUHJlZml4RW5kKHRoaXMuX2N1cnNvci5wZWVrKCkpKSB7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgICBsZXQgbmFtZVN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3I7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRDT0xPTikge1xuICAgICAgcHJlZml4ID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVPclByZWZpeFN0YXJ0KTtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICBuYW1lU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZVN0YXJ0ID0gbmFtZU9yUHJlZml4U3RhcnQ7XG4gICAgfVxuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZVVudGlsRm4oaXNOYW1lRW5kLCBwcmVmaXggPT09ICcnID8gMCA6IDEpO1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMobmFtZVN0YXJ0KTtcbiAgICByZXR1cm4gW3ByZWZpeCwgbmFtZV07XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGFnT3BlbihzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgbGV0IHRhZ05hbWU6IHN0cmluZztcbiAgICBsZXQgcHJlZml4OiBzdHJpbmc7XG4gICAgbGV0IG9wZW5UYWdUb2tlbjogVGFnT3BlblN0YXJ0VG9rZW4gfCBJbmNvbXBsZXRlVGFnT3BlblRva2VuIHwgdW5kZWZpbmVkO1xuICAgIHRyeSB7XG4gICAgICBpZiAoIWNoYXJzLmlzQXNjaWlMZXR0ZXIodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSxcbiAgICAgICAgICB0aGlzLl9jdXJzb3IuZ2V0U3BhbihzdGFydCksXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIG9wZW5UYWdUb2tlbiA9IHRoaXMuX2NvbnN1bWVUYWdPcGVuU3RhcnQoc3RhcnQpO1xuICAgICAgcHJlZml4ID0gb3BlblRhZ1Rva2VuLnBhcnRzWzBdO1xuICAgICAgdGFnTmFtZSA9IG9wZW5UYWdUb2tlbi5wYXJ0c1sxXTtcbiAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgIHdoaWxlIChcbiAgICAgICAgdGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJFNMQVNIICYmXG4gICAgICAgIHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRHVCAmJlxuICAgICAgICB0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kTFQgJiZcbiAgICAgICAgdGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJEVPRlxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVBdHRyaWJ1dGVOYW1lKCk7XG4gICAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kRVEpKSB7XG4gICAgICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgICAgIHRoaXMuX2NvbnN1bWVBdHRyaWJ1dGVWYWx1ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NvbnN1bWVUYWdPcGVuRW5kKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBfQ29udHJvbEZsb3dFcnJvcikge1xuICAgICAgICBpZiAob3BlblRhZ1Rva2VuKSB7XG4gICAgICAgICAgLy8gV2UgZXJyb3JlZCBiZWZvcmUgd2UgY291bGQgY2xvc2UgdGhlIG9wZW5pbmcgdGFnLCBzbyBpdCBpcyBpbmNvbXBsZXRlLlxuICAgICAgICAgIG9wZW5UYWdUb2tlbi50eXBlID0gVG9rZW5UeXBlLklOQ09NUExFVEVfVEFHX09QRU47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gV2hlbiB0aGUgc3RhcnQgdGFnIGlzIGludmFsaWQsIGFzc3VtZSB3ZSB3YW50IGEgXCI8XCIgYXMgdGV4dC5cbiAgICAgICAgICAvLyBCYWNrIHRvIGJhY2sgdGV4dCB0b2tlbnMgYXJlIG1lcmdlZCBhdCB0aGUgZW5kLlxuICAgICAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRFWFQsIHN0YXJ0KTtcbiAgICAgICAgICB0aGlzLl9lbmRUb2tlbihbJzwnXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRUb2tlblR5cGUgPSB0aGlzLl9nZXRUYWdEZWZpbml0aW9uKHRhZ05hbWUpLmdldENvbnRlbnRUeXBlKHByZWZpeCk7XG5cbiAgICBpZiAoY29udGVudFRva2VuVHlwZSA9PT0gVGFnQ29udGVudFR5cGUuUkFXX1RFWFQpIHtcbiAgICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0V2l0aFRhZ0Nsb3NlKHByZWZpeCwgdGFnTmFtZSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY29udGVudFRva2VuVHlwZSA9PT0gVGFnQ29udGVudFR5cGUuRVNDQVBBQkxFX1JBV19URVhUKSB7XG4gICAgICB0aGlzLl9jb25zdW1lUmF3VGV4dFdpdGhUYWdDbG9zZShwcmVmaXgsIHRhZ05hbWUsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVSYXdUZXh0V2l0aFRhZ0Nsb3NlKHByZWZpeDogc3RyaW5nLCB0YWdOYW1lOiBzdHJpbmcsIGNvbnN1bWVFbnRpdGllczogYm9vbGVhbikge1xuICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0KGNvbnN1bWVFbnRpdGllcywgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJExUKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFNMQVNIKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0U3RyQ2FzZUluc2Vuc2l0aXZlKHRhZ05hbWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRHVCk7XG4gICAgfSk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuVEFHX0NMT1NFKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGVVbnRpbEZuKChjb2RlKSA9PiBjb2RlID09PSBjaGFycy4kR1QsIDMpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7IC8vIENvbnN1bWUgdGhlIGA+YFxuICAgIHRoaXMuX2VuZFRva2VuKFtwcmVmaXgsIHRhZ05hbWVdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUYWdPcGVuU3RhcnQoc3RhcnQ6IENoYXJhY3RlckN1cnNvcik6IFRhZ09wZW5TdGFydFRva2VuIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5UQUdfT1BFTl9TVEFSVCwgc3RhcnQpO1xuICAgIGNvbnN0IHBhcnRzID0gdGhpcy5fY29uc3VtZVByZWZpeEFuZE5hbWUoKTtcbiAgICByZXR1cm4gdGhpcy5fZW5kVG9rZW4ocGFydHMpIGFzIFRhZ09wZW5TdGFydFRva2VuO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHJpYnV0ZU5hbWUoKSB7XG4gICAgY29uc3QgYXR0ck5hbWVTdGFydCA9IHRoaXMuX2N1cnNvci5wZWVrKCk7XG4gICAgaWYgKGF0dHJOYW1lU3RhcnQgPT09IGNoYXJzLiRTUSB8fCBhdHRyTmFtZVN0YXJ0ID09PSBjaGFycy4kRFEpIHtcbiAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2coYXR0ck5hbWVTdGFydCksIHRoaXMuX2N1cnNvci5nZXRTcGFuKCkpO1xuICAgIH1cbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5BVFRSX05BTUUpO1xuICAgIGNvbnN0IHByZWZpeEFuZE5hbWUgPSB0aGlzLl9jb25zdW1lUHJlZml4QW5kTmFtZSgpO1xuICAgIHRoaXMuX2VuZFRva2VuKHByZWZpeEFuZE5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHJpYnV0ZVZhbHVlKCkge1xuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kU1EgfHwgdGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJERRKSB7XG4gICAgICBjb25zdCBxdW90ZUNoYXIgPSB0aGlzLl9jdXJzb3IucGVlaygpO1xuICAgICAgdGhpcy5fY29uc3VtZVF1b3RlKHF1b3RlQ2hhcik7XG4gICAgICAvLyBJbiBhbiBhdHRyaWJ1dGUgdGhlbiBlbmQgb2YgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBhbmQgdGhlIHByZW1hdHVyZSBlbmQgdG8gYW4gaW50ZXJwb2xhdGlvblxuICAgICAgLy8gYXJlIGJvdGggdHJpZ2dlcmVkIGJ5IHRoZSBgcXVvdGVDaGFyYC5cbiAgICAgIGNvbnN0IGVuZFByZWRpY2F0ZSA9ICgpID0+IHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IHF1b3RlQ2hhcjtcbiAgICAgIHRoaXMuX2NvbnN1bWVXaXRoSW50ZXJwb2xhdGlvbihcbiAgICAgICAgVG9rZW5UeXBlLkFUVFJfVkFMVUVfVEVYVCxcbiAgICAgICAgVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTixcbiAgICAgICAgZW5kUHJlZGljYXRlLFxuICAgICAgICBlbmRQcmVkaWNhdGUsXG4gICAgICApO1xuICAgICAgdGhpcy5fY29uc3VtZVF1b3RlKHF1b3RlQ2hhcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGVuZFByZWRpY2F0ZSA9ICgpID0+IGlzTmFtZUVuZCh0aGlzLl9jdXJzb3IucGVlaygpKTtcbiAgICAgIHRoaXMuX2NvbnN1bWVXaXRoSW50ZXJwb2xhdGlvbihcbiAgICAgICAgVG9rZW5UeXBlLkFUVFJfVkFMVUVfVEVYVCxcbiAgICAgICAgVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTixcbiAgICAgICAgZW5kUHJlZGljYXRlLFxuICAgICAgICBlbmRQcmVkaWNhdGUsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVRdW90ZShxdW90ZUNoYXI6IG51bWJlcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkFUVFJfUVVPVEUpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShxdW90ZUNoYXIpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtTdHJpbmcuZnJvbUNvZGVQb2ludChxdW90ZUNoYXIpXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGFnT3BlbkVuZCgpIHtcbiAgICBjb25zdCB0b2tlblR5cGUgPSB0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFNMQVNIKVxuICAgICAgPyBUb2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSURcbiAgICAgIDogVG9rZW5UeXBlLlRBR19PUEVOX0VORDtcbiAgICB0aGlzLl9iZWdpblRva2VuKHRva2VuVHlwZSk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRHVCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVRhZ0Nsb3NlKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5UQUdfQ0xPU0UsIHN0YXJ0KTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgY29uc3QgcHJlZml4QW5kTmFtZSA9IHRoaXMuX2NvbnN1bWVQcmVmaXhBbmROYW1lKCk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kR1QpO1xuICAgIHRoaXMuX2VuZFRva2VuKHByZWZpeEFuZE5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbkZvcm1TdGFydCgpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRMQlJBQ0UpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wdXNoKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCk7XG5cbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgY29uc3QgY29uZGl0aW9uID0gdGhpcy5fcmVhZFVudGlsKGNoYXJzLiRDT01NQSk7XG4gICAgY29uc3Qgbm9ybWFsaXplZENvbmRpdGlvbiA9IHRoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnMoY29uZGl0aW9uKTtcbiAgICBpZiAodGhpcy5faTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzKSB7XG4gICAgICAvLyBXZSBleHBsaWNpdGx5IHdhbnQgdG8gbm9ybWFsaXplIGxpbmUgZW5kaW5ncyBmb3IgdGhpcyB0ZXh0LlxuICAgICAgdGhpcy5fZW5kVG9rZW4oW25vcm1hbGl6ZWRDb25kaXRpb25dKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2UgYXJlIG5vdCBub3JtYWxpemluZyBsaW5lIGVuZGluZ3MuXG4gICAgICBjb25zdCBjb25kaXRpb25Ub2tlbiA9IHRoaXMuX2VuZFRva2VuKFtjb25kaXRpb25dKTtcbiAgICAgIGlmIChub3JtYWxpemVkQ29uZGl0aW9uICE9PSBjb25kaXRpb24pIHtcbiAgICAgICAgdGhpcy5ub25Ob3JtYWxpemVkSWN1RXhwcmVzc2lvbnMucHVzaChjb25kaXRpb25Ub2tlbik7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kQ09NTUEpO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlJBV19URVhUKTtcbiAgICBjb25zdCB0eXBlID0gdGhpcy5fcmVhZFVudGlsKGNoYXJzLiRDT01NQSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW3R5cGVdKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJENPTU1BKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uQ2FzZVN0YXJ0KCkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX1ZBTFVFKTtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuX3JlYWRVbnRpbChjaGFycy4kTEJSQUNFKS50cmltKCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW3ZhbHVlXSk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuXG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJExCUkFDRSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wdXNoKFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbkNhc2VFbmQoKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX0VORCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRSQlJBQ0UpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG5cbiAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2sucG9wKCk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uRm9ybUVuZCgpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9FTkQpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kUkJSQUNFKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG5cbiAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2sucG9wKCk7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3VtZSBhIHN0cmluZyB0aGF0IG1heSBjb250YWluIGludGVycG9sYXRpb24gZXhwcmVzc2lvbnMuXG4gICAqXG4gICAqIFRoZSBmaXJzdCB0b2tlbiBjb25zdW1lZCB3aWxsIGJlIG9mIGB0b2tlblR5cGVgIGFuZCB0aGVuIHRoZXJlIHdpbGwgYmUgYWx0ZXJuYXRpbmdcbiAgICogYGludGVycG9sYXRpb25Ub2tlblR5cGVgIGFuZCBgdG9rZW5UeXBlYCB0b2tlbnMgdW50aWwgdGhlIGBlbmRQcmVkaWNhdGUoKWAgcmV0dXJucyB0cnVlLlxuICAgKlxuICAgKiBJZiBhbiBpbnRlcnBvbGF0aW9uIHRva2VuIGVuZHMgcHJlbWF0dXJlbHkgaXQgd2lsbCBoYXZlIG5vIGVuZCBtYXJrZXIgaW4gaXRzIGBwYXJ0c2AgYXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSB0ZXh0VG9rZW5UeXBlIHRoZSBraW5kIG9mIHRva2VucyB0byBpbnRlcmxlYXZlIGFyb3VuZCBpbnRlcnBvbGF0aW9uIHRva2Vucy5cbiAgICogQHBhcmFtIGludGVycG9sYXRpb25Ub2tlblR5cGUgdGhlIGtpbmQgb2YgdG9rZW5zIHRoYXQgY29udGFpbiBpbnRlcnBvbGF0aW9uLlxuICAgKiBAcGFyYW0gZW5kUHJlZGljYXRlIGEgZnVuY3Rpb24gdGhhdCBzaG91bGQgcmV0dXJuIHRydWUgd2hlbiB3ZSBzaG91bGQgc3RvcCBjb25zdW1pbmcuXG4gICAqIEBwYXJhbSBlbmRJbnRlcnBvbGF0aW9uIGEgZnVuY3Rpb24gdGhhdCBzaG91bGQgcmV0dXJuIHRydWUgaWYgdGhlcmUgaXMgYSBwcmVtYXR1cmUgZW5kIHRvIGFuXG4gICAqICAgICBpbnRlcnBvbGF0aW9uIGV4cHJlc3Npb24gLSBpLmUuIGJlZm9yZSB3ZSBnZXQgdG8gdGhlIG5vcm1hbCBpbnRlcnBvbGF0aW9uIGNsb3NpbmcgbWFya2VyLlxuICAgKi9cbiAgcHJpdmF0ZSBfY29uc3VtZVdpdGhJbnRlcnBvbGF0aW9uKFxuICAgIHRleHRUb2tlblR5cGU6IFRva2VuVHlwZSxcbiAgICBpbnRlcnBvbGF0aW9uVG9rZW5UeXBlOiBUb2tlblR5cGUsXG4gICAgZW5kUHJlZGljYXRlOiAoKSA9PiBib29sZWFuLFxuICAgIGVuZEludGVycG9sYXRpb246ICgpID0+IGJvb2xlYW4sXG4gICkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4odGV4dFRva2VuVHlwZSk7XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG5cbiAgICB3aGlsZSAoIWVuZFByZWRpY2F0ZSgpKSB7XG4gICAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICBpZiAodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyAmJiB0aGlzLl9hdHRlbXB0U3RyKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcuc3RhcnQpKSB7XG4gICAgICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKHBhcnRzLmpvaW4oJycpKV0sIGN1cnJlbnQpO1xuICAgICAgICBwYXJ0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9jb25zdW1lSW50ZXJwb2xhdGlvbihpbnRlcnBvbGF0aW9uVG9rZW5UeXBlLCBjdXJyZW50LCBlbmRJbnRlcnBvbGF0aW9uKTtcbiAgICAgICAgdGhpcy5fYmVnaW5Ub2tlbih0ZXh0VG9rZW5UeXBlKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJEFNUEVSU0FORCkge1xuICAgICAgICB0aGlzLl9lbmRUb2tlbihbdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhwYXJ0cy5qb2luKCcnKSldKTtcbiAgICAgICAgcGFydHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fY29uc3VtZUVudGl0eSh0ZXh0VG9rZW5UeXBlKTtcbiAgICAgICAgdGhpcy5fYmVnaW5Ub2tlbih0ZXh0VG9rZW5UeXBlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5fcmVhZENoYXIoKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSXQgaXMgcG9zc2libGUgdGhhdCBhbiBpbnRlcnBvbGF0aW9uIHdhcyBzdGFydGVkIGJ1dCBub3QgZW5kZWQgaW5zaWRlIHRoaXMgdGV4dCB0b2tlbi5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCB3ZSByZXNldCB0aGUgc3RhdGUgb2YgdGhlIGxleGVyIGNvcnJlY3RseS5cbiAgICB0aGlzLl9pbkludGVycG9sYXRpb24gPSBmYWxzZTtcblxuICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKHBhcnRzLmpvaW4oJycpKV0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN1bWUgYSBibG9jayBvZiB0ZXh0IHRoYXQgaGFzIGJlZW4gaW50ZXJwcmV0ZWQgYXMgYW4gQW5ndWxhciBpbnRlcnBvbGF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gaW50ZXJwb2xhdGlvblRva2VuVHlwZSB0aGUgdHlwZSBvZiB0aGUgaW50ZXJwb2xhdGlvbiB0b2tlbiB0byBnZW5lcmF0ZS5cbiAgICogQHBhcmFtIGludGVycG9sYXRpb25TdGFydCBhIGN1cnNvciB0aGF0IHBvaW50cyB0byB0aGUgc3RhcnQgb2YgdGhpcyBpbnRlcnBvbGF0aW9uLlxuICAgKiBAcGFyYW0gcHJlbWF0dXJlRW5kUHJlZGljYXRlIGEgZnVuY3Rpb24gdGhhdCBzaG91bGQgcmV0dXJuIHRydWUgaWYgdGhlIG5leHQgY2hhcmFjdGVycyBpbmRpY2F0ZVxuICAgKiAgICAgYW4gZW5kIHRvIHRoZSBpbnRlcnBvbGF0aW9uIGJlZm9yZSBpdHMgbm9ybWFsIGNsb3NpbmcgbWFya2VyLlxuICAgKi9cbiAgcHJpdmF0ZSBfY29uc3VtZUludGVycG9sYXRpb24oXG4gICAgaW50ZXJwb2xhdGlvblRva2VuVHlwZTogVG9rZW5UeXBlLFxuICAgIGludGVycG9sYXRpb25TdGFydDogQ2hhcmFjdGVyQ3Vyc29yLFxuICAgIHByZW1hdHVyZUVuZFByZWRpY2F0ZTogKCgpID0+IGJvb2xlYW4pIHwgbnVsbCxcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihpbnRlcnBvbGF0aW9uVG9rZW5UeXBlLCBpbnRlcnBvbGF0aW9uU3RhcnQpO1xuICAgIHBhcnRzLnB1c2godGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydCk7XG5cbiAgICAvLyBGaW5kIHRoZSBlbmQgb2YgdGhlIGludGVycG9sYXRpb24sIGlnbm9yaW5nIGNvbnRlbnQgaW5zaWRlIHF1b3Rlcy5cbiAgICBjb25zdCBleHByZXNzaW9uU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICBsZXQgaW5RdW90ZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGluQ29tbWVudCA9IGZhbHNlO1xuICAgIHdoaWxlIChcbiAgICAgIHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRFT0YgJiZcbiAgICAgIChwcmVtYXR1cmVFbmRQcmVkaWNhdGUgPT09IG51bGwgfHwgIXByZW1hdHVyZUVuZFByZWRpY2F0ZSgpKVxuICAgICkge1xuICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuXG4gICAgICBpZiAodGhpcy5faXNUYWdTdGFydCgpKSB7XG4gICAgICAgIC8vIFdlIGFyZSBzdGFydGluZyB3aGF0IGxvb2tzIGxpa2UgYW4gSFRNTCBlbGVtZW50IGluIHRoZSBtaWRkbGUgb2YgdGhpcyBpbnRlcnBvbGF0aW9uLlxuICAgICAgICAvLyBSZXNldCB0aGUgY3Vyc29yIHRvIGJlZm9yZSB0aGUgYDxgIGNoYXJhY3RlciBhbmQgZW5kIHRoZSBpbnRlcnBvbGF0aW9uIHRva2VuLlxuICAgICAgICAvLyAoVGhpcyBpcyBhY3R1YWxseSB3cm9uZyBidXQgaGVyZSBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSkuXG4gICAgICAgIHRoaXMuX2N1cnNvciA9IGN1cnJlbnQ7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5fZ2V0UHJvY2Vzc2VkQ2hhcnMoZXhwcmVzc2lvblN0YXJ0LCBjdXJyZW50KSk7XG4gICAgICAgIHRoaXMuX2VuZFRva2VuKHBhcnRzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW5RdW90ZSA9PT0gbnVsbCkge1xuICAgICAgICBpZiAodGhpcy5fYXR0ZW1wdFN0cih0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnLmVuZCkpIHtcbiAgICAgICAgICAvLyBXZSBhcmUgbm90IGluIGEgc3RyaW5nLCBhbmQgd2UgaGl0IHRoZSBlbmQgaW50ZXJwb2xhdGlvbiBtYXJrZXJcbiAgICAgICAgICBwYXJ0cy5wdXNoKHRoaXMuX2dldFByb2Nlc3NlZENoYXJzKGV4cHJlc3Npb25TdGFydCwgY3VycmVudCkpO1xuICAgICAgICAgIHBhcnRzLnB1c2godGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQpO1xuICAgICAgICAgIHRoaXMuX2VuZFRva2VuKHBhcnRzKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXR0ZW1wdFN0cignLy8nKSkge1xuICAgICAgICAgIC8vIE9uY2Ugd2UgYXJlIGluIGEgY29tbWVudCB3ZSBpZ25vcmUgYW55IHF1b3Rlc1xuICAgICAgICAgIGluQ29tbWVudCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgY2hhciA9IHRoaXMuX2N1cnNvci5wZWVrKCk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgaWYgKGNoYXIgPT09IGNoYXJzLiRCQUNLU0xBU0gpIHtcbiAgICAgICAgLy8gU2tpcCB0aGUgbmV4dCBjaGFyYWN0ZXIgYmVjYXVzZSBpdCB3YXMgZXNjYXBlZC5cbiAgICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gaW5RdW90ZSkge1xuICAgICAgICAvLyBFeGl0aW5nIHRoZSBjdXJyZW50IHF1b3RlZCBzdHJpbmdcbiAgICAgICAgaW5RdW90ZSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKCFpbkNvbW1lbnQgJiYgaW5RdW90ZSA9PT0gbnVsbCAmJiBjaGFycy5pc1F1b3RlKGNoYXIpKSB7XG4gICAgICAgIC8vIEVudGVyaW5nIGEgbmV3IHF1b3RlZCBzdHJpbmdcbiAgICAgICAgaW5RdW90ZSA9IGNoYXI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2UgaGl0IEVPRiB3aXRob3V0IGZpbmRpbmcgYSBjbG9zaW5nIGludGVycG9sYXRpb24gbWFya2VyXG4gICAgcGFydHMucHVzaCh0aGlzLl9nZXRQcm9jZXNzZWRDaGFycyhleHByZXNzaW9uU3RhcnQsIHRoaXMuX2N1cnNvcikpO1xuICAgIHRoaXMuX2VuZFRva2VuKHBhcnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFByb2Nlc3NlZENoYXJzKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IsIGVuZDogQ2hhcmFjdGVyQ3Vyc29yKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhlbmQuZ2V0Q2hhcnMoc3RhcnQpKTtcbiAgfVxuXG4gIHByaXZhdGUgX2lzVGV4dEVuZCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5faXNUYWdTdGFydCgpIHx8IHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRFT0YpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl90b2tlbml6ZUljdSAmJiAhdGhpcy5faW5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICBpZiAodGhpcy5pc0V4cGFuc2lvbkZvcm1TdGFydCgpKSB7XG4gICAgICAgIC8vIHN0YXJ0IG9mIGFuIGV4cGFuc2lvbiBmb3JtXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJFJCUkFDRSAmJiB0aGlzLl9pc0luRXhwYW5zaW9uQ2FzZSgpKSB7XG4gICAgICAgIC8vIGVuZCBvZiBhbmQgZXhwYW5zaW9uIGNhc2VcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdGhpcy5fdG9rZW5pemVCbG9ja3MgJiZcbiAgICAgICF0aGlzLl9pbkludGVycG9sYXRpb24gJiZcbiAgICAgICF0aGlzLl9pc0luRXhwYW5zaW9uKCkgJiZcbiAgICAgICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kQVQgfHwgdGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJFJCUkFDRSlcbiAgICApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGN1cnJlbnQgY3Vyc29yIGlzIHBvaW50aW5nIHRvIHRoZSBzdGFydCBvZiBhIHRhZ1xuICAgKiAob3BlbmluZy9jbG9zaW5nL2NvbW1lbnRzL2NkYXRhL2V0YykuXG4gICAqL1xuICBwcml2YXRlIF9pc1RhZ1N0YXJ0KCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kTFQpIHtcbiAgICAgIC8vIFdlIGFzc3VtZSB0aGF0IGA8YCBmb2xsb3dlZCBieSB3aGl0ZXNwYWNlIGlzIG5vdCB0aGUgc3RhcnQgb2YgYW4gSFRNTCBlbGVtZW50LlxuICAgICAgY29uc3QgdG1wID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICB0bXAuYWR2YW5jZSgpO1xuICAgICAgLy8gSWYgdGhlIG5leHQgY2hhcmFjdGVyIGlzIGFscGhhYmV0aWMsICEgbm9yIC8gdGhlbiBpdCBpcyBhIHRhZyBzdGFydFxuICAgICAgY29uc3QgY29kZSA9IHRtcC5wZWVrKCk7XG4gICAgICBpZiAoXG4gICAgICAgIChjaGFycy4kYSA8PSBjb2RlICYmIGNvZGUgPD0gY2hhcnMuJHopIHx8XG4gICAgICAgIChjaGFycy4kQSA8PSBjb2RlICYmIGNvZGUgPD0gY2hhcnMuJFopIHx8XG4gICAgICAgIGNvZGUgPT09IGNoYXJzLiRTTEFTSCB8fFxuICAgICAgICBjb2RlID09PSBjaGFycy4kQkFOR1xuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9yZWFkVW50aWwoY2hhcjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRoaXMuX2F0dGVtcHRVbnRpbENoYXIoY2hhcik7XG4gICAgcmV0dXJuIHRoaXMuX2N1cnNvci5nZXRDaGFycyhzdGFydCk7XG4gIH1cblxuICBwcml2YXRlIF9pc0luRXhwYW5zaW9uKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9pc0luRXhwYW5zaW9uQ2FzZSgpIHx8IHRoaXMuX2lzSW5FeHBhbnNpb25Gb3JtKCk7XG4gIH1cblxuICBwcml2YXRlIF9pc0luRXhwYW5zaW9uQ2FzZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLmxlbmd0aCA+IDAgJiZcbiAgICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFja1t0aGlzLl9leHBhbnNpb25DYXNlU3RhY2subGVuZ3RoIC0gMV0gPT09XG4gICAgICAgIFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlRcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfaXNJbkV4cGFuc2lvbkZvcm0oKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5sZW5ndGggPiAwICYmXG4gICAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2tbdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLmxlbmd0aCAtIDFdID09PVxuICAgICAgICBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlRcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0V4cGFuc2lvbkZvcm1TdGFydCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJExCUkFDRSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIGNvbnN0IGlzSW50ZXJwb2xhdGlvbiA9IHRoaXMuX2F0dGVtcHRTdHIodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydCk7XG4gICAgICB0aGlzLl9jdXJzb3IgPSBzdGFydDtcbiAgICAgIHJldHVybiAhaXNJbnRlcnBvbGF0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc05vdFdoaXRlc3BhY2UoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAhY2hhcnMuaXNXaGl0ZXNwYWNlKGNvZGUpIHx8IGNvZGUgPT09IGNoYXJzLiRFT0Y7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZUVuZChjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICBjaGFycy5pc1doaXRlc3BhY2UoY29kZSkgfHxcbiAgICBjb2RlID09PSBjaGFycy4kR1QgfHxcbiAgICBjb2RlID09PSBjaGFycy4kTFQgfHxcbiAgICBjb2RlID09PSBjaGFycy4kU0xBU0ggfHxcbiAgICBjb2RlID09PSBjaGFycy4kU1EgfHxcbiAgICBjb2RlID09PSBjaGFycy4kRFEgfHxcbiAgICBjb2RlID09PSBjaGFycy4kRVEgfHxcbiAgICBjb2RlID09PSBjaGFycy4kRU9GXG4gICk7XG59XG5cbmZ1bmN0aW9uIGlzUHJlZml4RW5kKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIChjb2RlIDwgY2hhcnMuJGEgfHwgY2hhcnMuJHogPCBjb2RlKSAmJlxuICAgIChjb2RlIDwgY2hhcnMuJEEgfHwgY2hhcnMuJFogPCBjb2RlKSAmJlxuICAgIChjb2RlIDwgY2hhcnMuJDAgfHwgY29kZSA+IGNoYXJzLiQ5KVxuICApO1xufVxuXG5mdW5jdGlvbiBpc0RpZ2l0RW50aXR5RW5kKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29kZSA9PT0gY2hhcnMuJFNFTUlDT0xPTiB8fCBjb2RlID09PSBjaGFycy4kRU9GIHx8ICFjaGFycy5pc0FzY2lpSGV4RGlnaXQoY29kZSk7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZWRFbnRpdHlFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID09PSBjaGFycy4kU0VNSUNPTE9OIHx8IGNvZGUgPT09IGNoYXJzLiRFT0YgfHwgIWNoYXJzLmlzQXNjaWlMZXR0ZXIoY29kZSk7XG59XG5cbmZ1bmN0aW9uIGlzRXhwYW5zaW9uQ2FzZVN0YXJ0KHBlZWs6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gcGVlayAhPT0gY2hhcnMuJFJCUkFDRTtcbn1cblxuZnVuY3Rpb24gY29tcGFyZUNoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKGNvZGUxOiBudW1iZXIsIGNvZGUyOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIHRvVXBwZXJDYXNlQ2hhckNvZGUoY29kZTEpID09PSB0b1VwcGVyQ2FzZUNoYXJDb2RlKGNvZGUyKTtcbn1cblxuZnVuY3Rpb24gdG9VcHBlckNhc2VDaGFyQ29kZShjb2RlOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gY29kZSA+PSBjaGFycy4kYSAmJiBjb2RlIDw9IGNoYXJzLiR6ID8gY29kZSAtIGNoYXJzLiRhICsgY2hhcnMuJEEgOiBjb2RlO1xufVxuXG5mdW5jdGlvbiBpc0Jsb2NrTmFtZUNoYXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjaGFycy5pc0FzY2lpTGV0dGVyKGNvZGUpIHx8IGNoYXJzLmlzRGlnaXQoY29kZSkgfHwgY29kZSA9PT0gY2hhcnMuJF87XG59XG5cbmZ1bmN0aW9uIGlzQmxvY2tQYXJhbWV0ZXJDaGFyKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29kZSAhPT0gY2hhcnMuJFNFTUlDT0xPTiAmJiBpc05vdFdoaXRlc3BhY2UoY29kZSk7XG59XG5cbmZ1bmN0aW9uIG1lcmdlVGV4dFRva2VucyhzcmNUb2tlbnM6IFRva2VuW10pOiBUb2tlbltdIHtcbiAgY29uc3QgZHN0VG9rZW5zOiBUb2tlbltdID0gW107XG4gIGxldCBsYXN0RHN0VG9rZW46IFRva2VuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNyY1Rva2Vucy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHRva2VuID0gc3JjVG9rZW5zW2ldO1xuICAgIGlmIChcbiAgICAgIChsYXN0RHN0VG9rZW4gJiYgbGFzdERzdFRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5URVhUICYmIHRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5URVhUKSB8fFxuICAgICAgKGxhc3REc3RUb2tlbiAmJlxuICAgICAgICBsYXN0RHN0VG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfVkFMVUVfVEVYVCAmJlxuICAgICAgICB0b2tlbi50eXBlID09PSBUb2tlblR5cGUuQVRUUl9WQUxVRV9URVhUKVxuICAgICkge1xuICAgICAgbGFzdERzdFRva2VuLnBhcnRzWzBdISArPSB0b2tlbi5wYXJ0c1swXTtcbiAgICAgIGxhc3REc3RUb2tlbi5zb3VyY2VTcGFuLmVuZCA9IHRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYXN0RHN0VG9rZW4gPSB0b2tlbjtcbiAgICAgIGRzdFRva2Vucy5wdXNoKGxhc3REc3RUb2tlbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRzdFRva2Vucztcbn1cblxuLyoqXG4gKiBUaGUgX1Rva2VuaXplciB1c2VzIG9iamVjdHMgb2YgdGhpcyB0eXBlIHRvIG1vdmUgdGhyb3VnaCB0aGUgaW5wdXQgdGV4dCxcbiAqIGV4dHJhY3RpbmcgXCJwYXJzZWQgY2hhcmFjdGVyc1wiLiBUaGVzZSBjb3VsZCBiZSBtb3JlIHRoYW4gb25lIGFjdHVhbCBjaGFyYWN0ZXJcbiAqIGlmIHRoZSB0ZXh0IGNvbnRhaW5zIGVzY2FwZSBzZXF1ZW5jZXMuXG4gKi9cbmludGVyZmFjZSBDaGFyYWN0ZXJDdXJzb3Ige1xuICAvKiogSW5pdGlhbGl6ZSB0aGUgY3Vyc29yLiAqL1xuICBpbml0KCk6IHZvaWQ7XG4gIC8qKiBUaGUgcGFyc2VkIGNoYXJhY3RlciBhdCB0aGUgY3VycmVudCBjdXJzb3IgcG9zaXRpb24uICovXG4gIHBlZWsoKTogbnVtYmVyO1xuICAvKiogQWR2YW5jZSB0aGUgY3Vyc29yIGJ5IG9uZSBwYXJzZWQgY2hhcmFjdGVyLiAqL1xuICBhZHZhbmNlKCk6IHZvaWQ7XG4gIC8qKiBHZXQgYSBzcGFuIGZyb20gdGhlIG1hcmtlZCBzdGFydCBwb2ludCB0byB0aGUgY3VycmVudCBwb2ludC4gKi9cbiAgZ2V0U3BhbihzdGFydD86IHRoaXMsIGxlYWRpbmdUcml2aWFDb2RlUG9pbnRzPzogbnVtYmVyW10pOiBQYXJzZVNvdXJjZVNwYW47XG4gIC8qKiBHZXQgdGhlIHBhcnNlZCBjaGFyYWN0ZXJzIGZyb20gdGhlIG1hcmtlZCBzdGFydCBwb2ludCB0byB0aGUgY3VycmVudCBwb2ludC4gKi9cbiAgZ2V0Q2hhcnMoc3RhcnQ6IHRoaXMpOiBzdHJpbmc7XG4gIC8qKiBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgbGVmdCBiZWZvcmUgdGhlIGVuZCBvZiB0aGUgY3Vyc29yLiAqL1xuICBjaGFyc0xlZnQoKTogbnVtYmVyO1xuICAvKiogVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGJldHdlZW4gYHRoaXNgIGN1cnNvciBhbmQgYG90aGVyYCBjdXJzb3IuICovXG4gIGRpZmYob3RoZXI6IHRoaXMpOiBudW1iZXI7XG4gIC8qKiBNYWtlIGEgY29weSBvZiB0aGlzIGN1cnNvciAqL1xuICBjbG9uZSgpOiBDaGFyYWN0ZXJDdXJzb3I7XG59XG5cbmludGVyZmFjZSBDdXJzb3JTdGF0ZSB7XG4gIHBlZWs6IG51bWJlcjtcbiAgb2Zmc2V0OiBudW1iZXI7XG4gIGxpbmU6IG51bWJlcjtcbiAgY29sdW1uOiBudW1iZXI7XG59XG5cbmNsYXNzIFBsYWluQ2hhcmFjdGVyQ3Vyc29yIGltcGxlbWVudHMgQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgcHJvdGVjdGVkIHN0YXRlOiBDdXJzb3JTdGF0ZTtcbiAgcHJvdGVjdGVkIGZpbGU6IFBhcnNlU291cmNlRmlsZTtcbiAgcHJvdGVjdGVkIGlucHV0OiBzdHJpbmc7XG4gIHByb3RlY3RlZCBlbmQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBsYWluQ2hhcmFjdGVyQ3Vyc29yKTtcbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQYXJzZVNvdXJjZUZpbGUsIHJhbmdlOiBMZXhlclJhbmdlKTtcbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQYXJzZVNvdXJjZUZpbGUgfCBQbGFpbkNoYXJhY3RlckN1cnNvciwgcmFuZ2U/OiBMZXhlclJhbmdlKSB7XG4gICAgaWYgKGZpbGVPckN1cnNvciBpbnN0YW5jZW9mIFBsYWluQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgICB0aGlzLmZpbGUgPSBmaWxlT3JDdXJzb3IuZmlsZTtcbiAgICAgIHRoaXMuaW5wdXQgPSBmaWxlT3JDdXJzb3IuaW5wdXQ7XG4gICAgICB0aGlzLmVuZCA9IGZpbGVPckN1cnNvci5lbmQ7XG5cbiAgICAgIGNvbnN0IHN0YXRlID0gZmlsZU9yQ3Vyc29yLnN0YXRlO1xuICAgICAgLy8gTm90ZTogYXZvaWQgdXNpbmcgYHsuLi5maWxlT3JDdXJzb3Iuc3RhdGV9YCBoZXJlIGFzIHRoYXQgaGFzIGEgc2V2ZXJlIHBlcmZvcm1hbmNlIHBlbmFsdHkuXG4gICAgICAvLyBJbiBFUzUgYnVuZGxlcyB0aGUgb2JqZWN0IHNwcmVhZCBvcGVyYXRvciBpcyB0cmFuc2xhdGVkIGludG8gdGhlIGBfX2Fzc2lnbmAgaGVscGVyLCB3aGljaFxuICAgICAgLy8gaXMgbm90IG9wdGltaXplZCBieSBWTXMgYXMgZWZmaWNpZW50bHkgYXMgYSByYXcgb2JqZWN0IGxpdGVyYWwuIFNpbmNlIHRoaXMgY29uc3RydWN0b3IgaXNcbiAgICAgIC8vIGNhbGxlZCBpbiB0aWdodCBsb29wcywgdGhpcyBkaWZmZXJlbmNlIG1hdHRlcnMuXG4gICAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICBwZWVrOiBzdGF0ZS5wZWVrLFxuICAgICAgICBvZmZzZXQ6IHN0YXRlLm9mZnNldCxcbiAgICAgICAgbGluZTogc3RhdGUubGluZSxcbiAgICAgICAgY29sdW1uOiBzdGF0ZS5jb2x1bW4sXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXJhbmdlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnUHJvZ3JhbW1pbmcgZXJyb3I6IHRoZSByYW5nZSBhcmd1bWVudCBtdXN0IGJlIHByb3ZpZGVkIHdpdGggYSBmaWxlIGFyZ3VtZW50LicsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB0aGlzLmZpbGUgPSBmaWxlT3JDdXJzb3I7XG4gICAgICB0aGlzLmlucHV0ID0gZmlsZU9yQ3Vyc29yLmNvbnRlbnQ7XG4gICAgICB0aGlzLmVuZCA9IHJhbmdlLmVuZFBvcztcbiAgICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgIHBlZWs6IC0xLFxuICAgICAgICBvZmZzZXQ6IHJhbmdlLnN0YXJ0UG9zLFxuICAgICAgICBsaW5lOiByYW5nZS5zdGFydExpbmUsXG4gICAgICAgIGNvbHVtbjogcmFuZ2Uuc3RhcnRDb2wsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGNsb25lKCk6IFBsYWluQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgICByZXR1cm4gbmV3IFBsYWluQ2hhcmFjdGVyQ3Vyc29yKHRoaXMpO1xuICB9XG5cbiAgcGVlaygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5wZWVrO1xuICB9XG4gIGNoYXJzTGVmdCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbmQgLSB0aGlzLnN0YXRlLm9mZnNldDtcbiAgfVxuICBkaWZmKG90aGVyOiB0aGlzKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUub2Zmc2V0IC0gb3RoZXIuc3RhdGUub2Zmc2V0O1xuICB9XG5cbiAgYWR2YW5jZSgpOiB2b2lkIHtcbiAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLnN0YXRlKTtcbiAgfVxuXG4gIGluaXQoKTogdm9pZCB7XG4gICAgdGhpcy51cGRhdGVQZWVrKHRoaXMuc3RhdGUpO1xuICB9XG5cbiAgZ2V0U3BhbihzdGFydD86IHRoaXMsIGxlYWRpbmdUcml2aWFDb2RlUG9pbnRzPzogbnVtYmVyW10pOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIHN0YXJ0ID0gc3RhcnQgfHwgdGhpcztcbiAgICBsZXQgZnVsbFN0YXJ0ID0gc3RhcnQ7XG4gICAgaWYgKGxlYWRpbmdUcml2aWFDb2RlUG9pbnRzKSB7XG4gICAgICB3aGlsZSAodGhpcy5kaWZmKHN0YXJ0KSA+IDAgJiYgbGVhZGluZ1RyaXZpYUNvZGVQb2ludHMuaW5kZXhPZihzdGFydC5wZWVrKCkpICE9PSAtMSkge1xuICAgICAgICBpZiAoZnVsbFN0YXJ0ID09PSBzdGFydCkge1xuICAgICAgICAgIHN0YXJ0ID0gc3RhcnQuY2xvbmUoKSBhcyB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIHN0YXJ0LmFkdmFuY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgc3RhcnRMb2NhdGlvbiA9IHRoaXMubG9jYXRpb25Gcm9tQ3Vyc29yKHN0YXJ0KTtcbiAgICBjb25zdCBlbmRMb2NhdGlvbiA9IHRoaXMubG9jYXRpb25Gcm9tQ3Vyc29yKHRoaXMpO1xuICAgIGNvbnN0IGZ1bGxTdGFydExvY2F0aW9uID1cbiAgICAgIGZ1bGxTdGFydCAhPT0gc3RhcnQgPyB0aGlzLmxvY2F0aW9uRnJvbUN1cnNvcihmdWxsU3RhcnQpIDogc3RhcnRMb2NhdGlvbjtcbiAgICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydExvY2F0aW9uLCBlbmRMb2NhdGlvbiwgZnVsbFN0YXJ0TG9jYXRpb24pO1xuICB9XG5cbiAgZ2V0Q2hhcnMoc3RhcnQ6IHRoaXMpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydC5zdGF0ZS5vZmZzZXQsIHRoaXMuc3RhdGUub2Zmc2V0KTtcbiAgfVxuXG4gIGNoYXJBdChwb3M6IG51bWJlcik6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuaW5wdXQuY2hhckNvZGVBdChwb3MpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFkdmFuY2VTdGF0ZShzdGF0ZTogQ3Vyc29yU3RhdGUpIHtcbiAgICBpZiAoc3RhdGUub2Zmc2V0ID49IHRoaXMuZW5kKSB7XG4gICAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gICAgICB0aHJvdyBuZXcgQ3Vyc29yRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhcmFjdGVyIFwiRU9GXCInLCB0aGlzKTtcbiAgICB9XG4gICAgY29uc3QgY3VycmVudENoYXIgPSB0aGlzLmNoYXJBdChzdGF0ZS5vZmZzZXQpO1xuICAgIGlmIChjdXJyZW50Q2hhciA9PT0gY2hhcnMuJExGKSB7XG4gICAgICBzdGF0ZS5saW5lKys7XG4gICAgICBzdGF0ZS5jb2x1bW4gPSAwO1xuICAgIH0gZWxzZSBpZiAoIWNoYXJzLmlzTmV3TGluZShjdXJyZW50Q2hhcikpIHtcbiAgICAgIHN0YXRlLmNvbHVtbisrO1xuICAgIH1cbiAgICBzdGF0ZS5vZmZzZXQrKztcbiAgICB0aGlzLnVwZGF0ZVBlZWsoc3RhdGUpO1xuICB9XG5cbiAgcHJvdGVjdGVkIHVwZGF0ZVBlZWsoc3RhdGU6IEN1cnNvclN0YXRlKTogdm9pZCB7XG4gICAgc3RhdGUucGVlayA9IHN0YXRlLm9mZnNldCA+PSB0aGlzLmVuZCA/IGNoYXJzLiRFT0YgOiB0aGlzLmNoYXJBdChzdGF0ZS5vZmZzZXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2NhdGlvbkZyb21DdXJzb3IoY3Vyc29yOiB0aGlzKTogUGFyc2VMb2NhdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBQYXJzZUxvY2F0aW9uKFxuICAgICAgY3Vyc29yLmZpbGUsXG4gICAgICBjdXJzb3Iuc3RhdGUub2Zmc2V0LFxuICAgICAgY3Vyc29yLnN0YXRlLmxpbmUsXG4gICAgICBjdXJzb3Iuc3RhdGUuY29sdW1uLFxuICAgICk7XG4gIH1cbn1cblxuY2xhc3MgRXNjYXBlZENoYXJhY3RlckN1cnNvciBleHRlbmRzIFBsYWluQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgcHJvdGVjdGVkIGludGVybmFsU3RhdGU6IEN1cnNvclN0YXRlO1xuXG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogRXNjYXBlZENoYXJhY3RlckN1cnNvcik7XG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogUGFyc2VTb3VyY2VGaWxlLCByYW5nZTogTGV4ZXJSYW5nZSk7XG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogUGFyc2VTb3VyY2VGaWxlIHwgRXNjYXBlZENoYXJhY3RlckN1cnNvciwgcmFuZ2U/OiBMZXhlclJhbmdlKSB7XG4gICAgaWYgKGZpbGVPckN1cnNvciBpbnN0YW5jZW9mIEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICAgIHN1cGVyKGZpbGVPckN1cnNvcik7XG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB7Li4uZmlsZU9yQ3Vyc29yLmludGVybmFsU3RhdGV9O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlcihmaWxlT3JDdXJzb3IsIHJhbmdlISk7XG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB0aGlzLnN0YXRlO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGFkdmFuY2UoKTogdm9pZCB7XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMuaW50ZXJuYWxTdGF0ZTtcbiAgICBzdXBlci5hZHZhbmNlKCk7XG4gICAgdGhpcy5wcm9jZXNzRXNjYXBlU2VxdWVuY2UoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGluaXQoKTogdm9pZCB7XG4gICAgc3VwZXIuaW5pdCgpO1xuICAgIHRoaXMucHJvY2Vzc0VzY2FwZVNlcXVlbmNlKCk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgICByZXR1cm4gbmV3IEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IodGhpcyk7XG4gIH1cblxuICBvdmVycmlkZSBnZXRDaGFycyhzdGFydDogdGhpcyk6IHN0cmluZyB7XG4gICAgY29uc3QgY3Vyc29yID0gc3RhcnQuY2xvbmUoKTtcbiAgICBsZXQgY2hhcnMgPSAnJztcbiAgICB3aGlsZSAoY3Vyc29yLmludGVybmFsU3RhdGUub2Zmc2V0IDwgdGhpcy5pbnRlcm5hbFN0YXRlLm9mZnNldCkge1xuICAgICAgY2hhcnMgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3Vyc29yLnBlZWsoKSk7XG4gICAgICBjdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgICByZXR1cm4gY2hhcnM7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgZXNjYXBlIHNlcXVlbmNlIHRoYXQgc3RhcnRzIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uIGluIHRoZSB0ZXh0LlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgdG8gZW5zdXJlIHRoYXQgYHBlZWtgIGhhcyB0aGUgdW5lc2NhcGVkIHZhbHVlIG9mIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgcHJvY2Vzc0VzY2FwZVNlcXVlbmNlKCk6IHZvaWQge1xuICAgIGNvbnN0IHBlZWsgPSAoKSA9PiB0aGlzLmludGVybmFsU3RhdGUucGVlaztcblxuICAgIGlmIChwZWVrKCkgPT09IGNoYXJzLiRCQUNLU0xBU0gpIHtcbiAgICAgIC8vIFdlIGhhdmUgaGl0IGFuIGVzY2FwZSBzZXF1ZW5jZSBzbyB3ZSBuZWVkIHRoZSBpbnRlcm5hbCBzdGF0ZSB0byBiZWNvbWUgaW5kZXBlbmRlbnRcbiAgICAgIC8vIG9mIHRoZSBleHRlcm5hbCBzdGF0ZS5cbiAgICAgIHRoaXMuaW50ZXJuYWxTdGF0ZSA9IHsuLi50aGlzLnN0YXRlfTtcblxuICAgICAgLy8gTW92ZSBwYXN0IHRoZSBiYWNrc2xhc2hcbiAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG5cbiAgICAgIC8vIEZpcnN0IGNoZWNrIGZvciBzdGFuZGFyZCBjb250cm9sIGNoYXIgc2VxdWVuY2VzXG4gICAgICBpZiAocGVlaygpID09PSBjaGFycy4kbikge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kTEY7XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJHIpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJENSO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR2KSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRWVEFCO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR0KSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRUQUI7XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJGIpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJEJTUEFDRTtcbiAgICAgIH0gZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kZikge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kRkY7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdyBjb25zaWRlciBtb3JlIGNvbXBsZXggc2VxdWVuY2VzXG4gICAgICBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR1KSB7XG4gICAgICAgIC8vIFVuaWNvZGUgY29kZS1wb2ludCBzZXF1ZW5jZVxuICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpOyAvLyBhZHZhbmNlIHBhc3QgdGhlIGB1YCBjaGFyXG4gICAgICAgIGlmIChwZWVrKCkgPT09IGNoYXJzLiRMQlJBQ0UpIHtcbiAgICAgICAgICAvLyBWYXJpYWJsZSBsZW5ndGggVW5pY29kZSwgZS5nLiBgXFx4ezEyM31gXG4gICAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTsgLy8gYWR2YW5jZSBwYXN0IHRoZSBge2AgY2hhclxuICAgICAgICAgIC8vIEFkdmFuY2UgcGFzdCB0aGUgdmFyaWFibGUgbnVtYmVyIG9mIGhleCBkaWdpdHMgdW50aWwgd2UgaGl0IGEgYH1gIGNoYXJcbiAgICAgICAgICBjb25zdCBkaWdpdFN0YXJ0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgIGxldCBsZW5ndGggPSAwO1xuICAgICAgICAgIHdoaWxlIChwZWVrKCkgIT09IGNoYXJzLiRSQlJBQ0UpIHtcbiAgICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgICBsZW5ndGgrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5kZWNvZGVIZXhEaWdpdHMoZGlnaXRTdGFydCwgbGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaXhlZCBsZW5ndGggVW5pY29kZSwgZS5nLiBgXFx1MTIzNGBcbiAgICAgICAgICBjb25zdCBkaWdpdFN0YXJ0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuICAgICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHRoaXMuZGVjb2RlSGV4RGlnaXRzKGRpZ2l0U3RhcnQsIDQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJHgpIHtcbiAgICAgICAgLy8gSGV4IGNoYXIgY29kZSwgZS5nLiBgXFx4MkZgXG4gICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7IC8vIGFkdmFuY2UgcGFzdCB0aGUgYHhgIGNoYXJcbiAgICAgICAgY29uc3QgZGlnaXRTdGFydCA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5kZWNvZGVIZXhEaWdpdHMoZGlnaXRTdGFydCwgMik7XG4gICAgICB9IGVsc2UgaWYgKGNoYXJzLmlzT2N0YWxEaWdpdChwZWVrKCkpKSB7XG4gICAgICAgIC8vIE9jdGFsIGNoYXIgY29kZSwgZS5nLiBgXFwwMTJgLFxuICAgICAgICBsZXQgb2N0YWwgPSAnJztcbiAgICAgICAgbGV0IGxlbmd0aCA9IDA7XG4gICAgICAgIGxldCBwcmV2aW91cyA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgd2hpbGUgKGNoYXJzLmlzT2N0YWxEaWdpdChwZWVrKCkpICYmIGxlbmd0aCA8IDMpIHtcbiAgICAgICAgICBwcmV2aW91cyA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICBvY3RhbCArPSBTdHJpbmcuZnJvbUNvZGVQb2ludChwZWVrKCkpO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgbGVuZ3RoKys7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gcGFyc2VJbnQob2N0YWwsIDgpO1xuICAgICAgICAvLyBCYWNrdXAgb25lIGNoYXJcbiAgICAgICAgdGhpcy5pbnRlcm5hbFN0YXRlID0gcHJldmlvdXMuaW50ZXJuYWxTdGF0ZTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhcnMuaXNOZXdMaW5lKHRoaXMuaW50ZXJuYWxTdGF0ZS5wZWVrKSkge1xuICAgICAgICAvLyBMaW5lIGNvbnRpbnVhdGlvbiBgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3IGxpbmVcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTsgLy8gYWR2YW5jZSBvdmVyIHRoZSBuZXdsaW5lXG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLmludGVybmFsU3RhdGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiBub25lIG9mIHRoZSBgaWZgIGJsb2NrcyB3ZXJlIGV4ZWN1dGVkIHRoZW4gd2UganVzdCBoYXZlIGFuIGVzY2FwZWQgbm9ybWFsIGNoYXJhY3Rlci5cbiAgICAgICAgLy8gSW4gdGhhdCBjYXNlIHdlIGp1c3QsIGVmZmVjdGl2ZWx5LCBza2lwIHRoZSBiYWNrc2xhc2ggZnJvbSB0aGUgY2hhcmFjdGVyLlxuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSB0aGlzLmludGVybmFsU3RhdGUucGVlaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgZGVjb2RlSGV4RGlnaXRzKHN0YXJ0OiBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yLCBsZW5ndGg6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgaGV4ID0gdGhpcy5pbnB1dC5zbGljZShzdGFydC5pbnRlcm5hbFN0YXRlLm9mZnNldCwgc3RhcnQuaW50ZXJuYWxTdGF0ZS5vZmZzZXQgKyBsZW5ndGgpO1xuICAgIGNvbnN0IGNoYXJDb2RlID0gcGFyc2VJbnQoaGV4LCAxNik7XG4gICAgaWYgKCFpc05hTihjaGFyQ29kZSkpIHtcbiAgICAgIHJldHVybiBjaGFyQ29kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhcnQuc3RhdGUgPSBzdGFydC5pbnRlcm5hbFN0YXRlO1xuICAgICAgdGhyb3cgbmV3IEN1cnNvckVycm9yKCdJbnZhbGlkIGhleGFkZWNpbWFsIGVzY2FwZSBzZXF1ZW5jZScsIHN0YXJ0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvckVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIG1zZzogc3RyaW5nLFxuICAgIHB1YmxpYyBjdXJzb3I6IENoYXJhY3RlckN1cnNvcixcbiAgKSB7fVxufVxuIl19