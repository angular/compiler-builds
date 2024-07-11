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
        this._tokenizeLet = options.tokenizeLet ?? true;
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
                else if (this._tokenizeLet &&
                    // Use `peek` instead of `attempCharCode` since we
                    // don't want to advance in case it's not `@let`.
                    this._cursor.peek() === chars.$AT &&
                    !this._inInterpolation &&
                    this._attemptStr('@let')) {
                    this._consumeLetDeclaration(start);
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
        this._beginToken(33 /* TokenType.EOF */);
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
    _consumeLetDeclaration(start) {
        this._beginToken(29 /* TokenType.LET_START */, start);
        // Require at least one white space after the `@let`.
        if (chars.isWhitespace(this._cursor.peek())) {
            this._attemptCharCodeUntilFn(isNotWhitespace);
        }
        else {
            const token = this._endToken([this._cursor.getChars(start)]);
            token.type = 32 /* TokenType.INCOMPLETE_LET */;
            return;
        }
        const startToken = this._endToken([this._getLetDeclarationName()]);
        // Skip over white space before the equals character.
        this._attemptCharCodeUntilFn(isNotWhitespace);
        // Expect an equals sign.
        if (!this._attemptCharCode(chars.$EQ)) {
            startToken.type = 32 /* TokenType.INCOMPLETE_LET */;
            return;
        }
        // Skip spaces after the equals.
        this._attemptCharCodeUntilFn((code) => isNotWhitespace(code) && !chars.isNewLine(code));
        this._consumeLetDeclarationValue();
        // Terminate the `@let` with a semicolon.
        const endChar = this._cursor.peek();
        if (endChar === chars.$SEMICOLON) {
            this._beginToken(31 /* TokenType.LET_END */);
            this._endToken([]);
            this._cursor.advance();
        }
        else {
            startToken.type = 32 /* TokenType.INCOMPLETE_LET */;
            startToken.sourceSpan = this._cursor.getSpan(start);
        }
    }
    _getLetDeclarationName() {
        const nameCursor = this._cursor.clone();
        let allowDigit = false;
        this._attemptCharCodeUntilFn((code) => {
            if (chars.isAsciiLetter(code) ||
                code === chars.$$ ||
                code === chars.$_ ||
                // `@let` names can't start with a digit, but digits are valid anywhere else in the name.
                (allowDigit && chars.isDigit(code))) {
                allowDigit = true;
                return false;
            }
            return true;
        });
        return this._cursor.getChars(nameCursor).trim();
    }
    _consumeLetDeclarationValue() {
        const start = this._cursor.clone();
        this._beginToken(30 /* TokenType.LET_VALUE */, start);
        while (this._cursor.peek() !== chars.$EOF) {
            const char = this._cursor.peek();
            // `@let` declarations terminate with a semicolon.
            if (char === chars.$SEMICOLON) {
                break;
            }
            // If we hit a quote, skip over its content since we don't care what's inside.
            if (chars.isQuote(char)) {
                this._cursor.advance();
                this._attemptCharCodeUntilFn((inner) => {
                    if (inner === chars.$BACKSLASH) {
                        this._cursor.advance();
                        return false;
                    }
                    return inner === char;
                });
            }
            this._cursor.advance();
        }
        this._endToken([this._cursor.getChars(start)]);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV4ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2xleGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxLQUFLLE1BQU0sVUFBVSxDQUFDO0FBQ2xDLE9BQU8sRUFBQyxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFMUYsT0FBTyxFQUFDLDRCQUE0QixFQUFzQixNQUFNLFlBQVksQ0FBQztBQUM3RSxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQzFDLE9BQU8sRUFBQyxjQUFjLEVBQWdCLE1BQU0sUUFBUSxDQUFDO0FBR3JELE1BQU0sT0FBTyxVQUFXLFNBQVEsVUFBVTtJQUN4QyxZQUNFLFFBQWdCLEVBQ1QsU0FBMkIsRUFDbEMsSUFBcUI7UUFFckIsS0FBSyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUhmLGNBQVMsR0FBVCxTQUFTLENBQWtCO0lBSXBDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxjQUFjO0lBQ3pCLFlBQ1MsTUFBZSxFQUNmLE1BQW9CLEVBQ3BCLDJCQUFvQztRQUZwQyxXQUFNLEdBQU4sTUFBTSxDQUFTO1FBQ2YsV0FBTSxHQUFOLE1BQU0sQ0FBYztRQUNwQixnQ0FBMkIsR0FBM0IsMkJBQTJCLENBQVM7SUFDMUMsQ0FBQztDQUNMO0FBK0VELE1BQU0sVUFBVSxRQUFRLENBQ3RCLE1BQWMsRUFDZCxHQUFXLEVBQ1gsZ0JBQW9ELEVBQ3BELFVBQTJCLEVBQUU7SUFFN0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsSUFBSSxlQUFlLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzlGLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNyQixPQUFPLElBQUksY0FBYyxDQUN2QixlQUFlLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUNqQyxTQUFTLENBQUMsTUFBTSxFQUNoQixTQUFTLENBQUMsMkJBQTJCLENBQ3RDLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLENBQUM7QUFFcEMsU0FBUyw0QkFBNEIsQ0FBQyxRQUFnQjtJQUNwRCxNQUFNLElBQUksR0FBRyxRQUFRLEtBQUssS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdFLE9BQU8seUJBQXlCLElBQUksR0FBRyxDQUFDO0FBQzFDLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLFNBQWlCO0lBQy9DLE9BQU8sbUJBQW1CLFNBQVMsbURBQW1ELENBQUM7QUFDekYsQ0FBQztBQUVELFNBQVMseUJBQXlCLENBQUMsSUFBNEIsRUFBRSxTQUFpQjtJQUNoRixPQUFPLDJCQUEyQixTQUFTLE9BQU8sSUFBSSxpREFBaUQsQ0FBQztBQUMxRyxDQUFDO0FBRUQsSUFBSyxzQkFHSjtBQUhELFdBQUssc0JBQXNCO0lBQ3pCLDZDQUFtQixDQUFBO0lBQ25CLHlDQUFlLENBQUE7QUFDakIsQ0FBQyxFQUhJLHNCQUFzQixLQUF0QixzQkFBc0IsUUFHMUI7QUFFRCxNQUFNLGlCQUFpQjtJQUNyQixZQUFtQixLQUFpQjtRQUFqQixVQUFLLEdBQUwsS0FBSyxDQUFZO0lBQUcsQ0FBQztDQUN6QztBQUVELHNFQUFzRTtBQUN0RSxNQUFNLFVBQVU7SUFpQmQ7Ozs7T0FJRztJQUNILFlBQ0UsS0FBc0IsRUFDZCxpQkFBcUQsRUFDN0QsT0FBd0I7UUFEaEIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFvQztRQW5CdkQsdUJBQWtCLEdBQTJCLElBQUksQ0FBQztRQUNsRCxzQkFBaUIsR0FBcUIsSUFBSSxDQUFDO1FBQzNDLHdCQUFtQixHQUFnQixFQUFFLENBQUM7UUFDdEMscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBSzFDLFdBQU0sR0FBWSxFQUFFLENBQUM7UUFDckIsV0FBTSxHQUFpQixFQUFFLENBQUM7UUFDMUIsZ0NBQTJCLEdBQVksRUFBRSxDQUFDO1FBWXhDLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixJQUFJLEtBQUssQ0FBQztRQUM1RCxJQUFJLENBQUMsb0JBQW9CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixJQUFJLDRCQUE0QixDQUFDO1FBQ3hGLElBQUksQ0FBQyx3QkFBd0I7WUFDM0IsT0FBTyxDQUFDLGtCQUFrQixJQUFJLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDN0YsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssSUFBSTtZQUM3QixNQUFNLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNO1lBQzVCLFFBQVEsRUFBRSxDQUFDO1lBQ1gsU0FBUyxFQUFFLENBQUM7WUFDWixRQUFRLEVBQUUsQ0FBQztTQUNaLENBQUM7UUFDRixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxhQUFhO1lBQ2xDLENBQUMsQ0FBQyxJQUFJLHNCQUFzQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7WUFDMUMsQ0FBQyxDQUFDLElBQUksb0JBQW9CLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxPQUFPLENBQUMsbUJBQW1CLElBQUksS0FBSyxDQUFDO1FBQ2pFLElBQUksQ0FBQywrQkFBK0IsR0FBRyxPQUFPLENBQUMsOEJBQThCLElBQUksS0FBSyxDQUFDO1FBQ3ZGLElBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUM7UUFDdEQsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQztRQUNoRCxJQUFJLENBQUM7WUFDSCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3RCLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1gsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0QixDQUFDO0lBQ0gsQ0FBQztJQUVPLHVCQUF1QixDQUFDLE9BQWU7UUFDN0MsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUM5QixPQUFPLE9BQU8sQ0FBQztRQUNqQixDQUFDO1FBQ0QsMEVBQTBFO1FBQzFFLG1FQUFtRTtRQUNuRSxrQkFBa0I7UUFDbEIsbUVBQW1FO1FBQ25FLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsUUFBUTtRQUNOLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDMUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUM7Z0JBQ0gsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3JDLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO3dCQUN2QyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQzs0QkFDM0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDNUIsQ0FBQzs2QkFBTSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQzs0QkFDL0MsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDOUIsQ0FBQzs2QkFBTSxDQUFDOzRCQUNOLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQzlCLENBQUM7b0JBQ0gsQ0FBQzt5QkFBTSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQzt3QkFDL0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUMvQixDQUFDO3lCQUFNLENBQUM7d0JBQ04sSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDOUIsQ0FBQztnQkFDSCxDQUFDO3FCQUFNLElBQ0wsSUFBSSxDQUFDLFlBQVk7b0JBQ2pCLGtEQUFrRDtvQkFDbEQsaURBQWlEO29CQUNqRCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxHQUFHO29CQUNqQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0I7b0JBQ3RCLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQ3hCLENBQUM7b0JBQ0QsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNyQyxDQUFDO3FCQUFNLElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3BFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDakMsQ0FBQztxQkFBTSxJQUNMLElBQUksQ0FBQyxlQUFlO29CQUNwQixDQUFDLElBQUksQ0FBQyxnQkFBZ0I7b0JBQ3RCLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFO29CQUMxQixDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtvQkFDMUIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFDcEMsQ0FBQztvQkFDRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQy9CLENBQUM7cUJBQU0sSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxFQUFFLENBQUM7b0JBQ2pFLHVGQUF1RjtvQkFDdkYscUZBQXFGO29CQUNyRixJQUFJLENBQUMseUJBQXlCLDBEQUc1QixHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQ3ZCLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FDekIsQ0FBQztnQkFDSixDQUFDO1lBQ0gsQ0FBQztZQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ1gsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0QixDQUFDO1FBQ0gsQ0FBQztRQUNELElBQUksQ0FBQyxXQUFXLHdCQUFlLENBQUM7UUFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBRU8sYUFBYTtRQUNuQiwwRUFBMEU7UUFDMUUsSUFBSSxtQkFBbUIsR0FBRyxLQUFLLENBQUM7UUFDaEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUV4QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNwQyxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDN0IsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1lBQzlCLENBQUM7WUFDRCxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUMxQixtQkFBbUIsR0FBRyxJQUFJLENBQUM7Z0JBQzNCLE9BQU8sS0FBSyxDQUFDO1lBQ2YsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2xELENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxLQUFzQjtRQUMvQyxJQUFJLENBQUMsV0FBVyxzQ0FBNkIsS0FBSyxDQUFDLENBQUM7UUFDcEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFMUQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUMxQyxrQ0FBa0M7WUFDbEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN2QiwwQkFBMEI7WUFDMUIsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDL0IseUNBQXlDO1lBQ3pDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUU5QyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDekMsZ0NBQWdDO2dCQUNoQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDaEQsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLFVBQVUsQ0FBQyxJQUFJLDJDQUFrQyxDQUFDO2dCQUNsRCxPQUFPO1lBQ1QsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUN6QyxJQUFJLENBQUMsV0FBVyxtQ0FBMEIsQ0FBQztZQUMzQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3JCLENBQUM7YUFBTSxDQUFDO1lBQ04sVUFBVSxDQUFDLElBQUksMkNBQWtDLENBQUM7UUFDcEQsQ0FBQztJQUNILENBQUM7SUFFTyxnQkFBZ0IsQ0FBQyxLQUFzQjtRQUM3QyxJQUFJLENBQUMsV0FBVyxpQ0FBd0IsS0FBSyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBRU8sdUJBQXVCO1FBQzdCLGlEQUFpRDtRQUNqRCxJQUFJLENBQUMsdUJBQXVCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUVuRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNuRixJQUFJLENBQUMsV0FBVyxvQ0FBMkIsQ0FBQztZQUM1QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ25DLElBQUksT0FBTyxHQUFrQixJQUFJLENBQUM7WUFDbEMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO1lBRW5CLDJEQUEyRDtZQUMzRCw4REFBOEQ7WUFDOUQsT0FDRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUM7Z0JBQ2hGLE9BQU8sS0FBSyxJQUFJLEVBQ2hCLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFFakMsZ0RBQWdEO2dCQUNoRCxJQUFJLElBQUksS0FBSyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQzlCLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3pCLENBQUM7cUJBQU0sSUFBSSxJQUFJLEtBQUssT0FBTyxFQUFFLENBQUM7b0JBQzVCLE9BQU8sR0FBRyxJQUFJLENBQUM7Z0JBQ2pCLENBQUM7cUJBQU0sSUFBSSxPQUFPLEtBQUssSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDbkQsT0FBTyxHQUFHLElBQUksQ0FBQztnQkFDakIsQ0FBQztxQkFBTSxJQUFJLElBQUksS0FBSyxLQUFLLENBQUMsT0FBTyxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDdEQsVUFBVSxFQUFFLENBQUM7Z0JBQ2YsQ0FBQztxQkFBTSxJQUFJLElBQUksS0FBSyxLQUFLLENBQUMsT0FBTyxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDdEQsSUFBSSxVQUFVLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ3JCLE1BQU07b0JBQ1IsQ0FBQzt5QkFBTSxJQUFJLFVBQVUsR0FBRyxDQUFDLEVBQUUsQ0FBQzt3QkFDMUIsVUFBVSxFQUFFLENBQUM7b0JBQ2YsQ0FBQztnQkFDSCxDQUFDO2dCQUVELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDekIsQ0FBQztZQUVELElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFL0MsOEJBQThCO1lBQzlCLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3JELENBQUM7SUFDSCxDQUFDO0lBRU8sc0JBQXNCLENBQUMsS0FBc0I7UUFDbkQsSUFBSSxDQUFDLFdBQVcsK0JBQXNCLEtBQUssQ0FBQyxDQUFDO1FBRTdDLHFEQUFxRDtRQUNyRCxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDNUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2hELENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3RCxLQUFLLENBQUMsSUFBSSxvQ0FBMkIsQ0FBQztZQUN0QyxPQUFPO1FBQ1QsQ0FBQztRQUVELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFbkUscURBQXFEO1FBQ3JELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU5Qyx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN0QyxVQUFVLENBQUMsSUFBSSxvQ0FBMkIsQ0FBQztZQUMzQyxPQUFPO1FBQ1QsQ0FBQztRQUVELGdDQUFnQztRQUNoQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN4RixJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUVuQyx5Q0FBeUM7UUFDekMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNwQyxJQUFJLE9BQU8sS0FBSyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakMsSUFBSSxDQUFDLFdBQVcsNEJBQW1CLENBQUM7WUFDcEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3pCLENBQUM7YUFBTSxDQUFDO1lBQ04sVUFBVSxDQUFDLElBQUksb0NBQTJCLENBQUM7WUFDM0MsVUFBVSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN0RCxDQUFDO0lBQ0gsQ0FBQztJQUVPLHNCQUFzQjtRQUM1QixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3hDLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztRQUV2QixJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNwQyxJQUNFLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDO2dCQUN6QixJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUU7Z0JBQ2pCLElBQUksS0FBSyxLQUFLLENBQUMsRUFBRTtnQkFDakIseUZBQXlGO2dCQUN6RixDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ25DLENBQUM7Z0JBQ0QsVUFBVSxHQUFHLElBQUksQ0FBQztnQkFDbEIsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDbEQsQ0FBQztJQUVPLDJCQUEyQjtRQUNqQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxXQUFXLCtCQUFzQixLQUFLLENBQUMsQ0FBQztRQUU3QyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzFDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFFakMsa0RBQWtEO1lBQ2xELElBQUksSUFBSSxLQUFLLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDOUIsTUFBTTtZQUNSLENBQUM7WUFFRCw4RUFBOEU7WUFDOUUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ3hCLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO29CQUNyQyxJQUFJLEtBQUssS0FBSyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7d0JBQy9CLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ3ZCLE9BQU8sS0FBSyxDQUFDO29CQUNmLENBQUM7b0JBQ0QsT0FBTyxLQUFLLEtBQUssSUFBSSxDQUFDO2dCQUN4QixDQUFDLENBQUMsQ0FBQztZQUNMLENBQUM7WUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3pCLENBQUM7UUFFRCxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFRDs7O09BR0c7SUFDSyxzQkFBc0I7UUFDNUIsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1lBQ2xDLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELElBQUksb0JBQW9CLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7WUFDM0UsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUM7WUFDbEMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUMxQyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7Z0JBQzlCLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO2dCQUNoQyxPQUFPLElBQUksQ0FBQztZQUNkLENBQUM7WUFFRCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7Z0JBQzlCLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO2dCQUNoQyxPQUFPLElBQUksQ0FBQztZQUNkLENBQUM7UUFDSCxDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRU8sV0FBVyxDQUFDLElBQWUsRUFBRSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUU7UUFDL0QsSUFBSSxDQUFDLGtCQUFrQixHQUFHLEtBQUssQ0FBQztRQUNoQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO0lBQ2hDLENBQUM7SUFFTyxTQUFTLENBQUMsS0FBZSxFQUFFLEdBQXFCO1FBQ3RELElBQUksSUFBSSxDQUFDLGtCQUFrQixLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3JDLE1BQU0sSUFBSSxVQUFVLENBQ2xCLG1GQUFtRixFQUNuRixJQUFJLENBQUMsaUJBQWlCLEVBQ3RCLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUMxQixDQUFDO1FBQ0osQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLGlCQUFpQixLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3BDLE1BQU0sSUFBSSxVQUFVLENBQ2xCLHNFQUFzRSxFQUN0RSxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQzlDLENBQUM7UUFDSixDQUFDO1FBQ0QsTUFBTSxLQUFLLEdBQUc7WUFDWixJQUFJLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtZQUM1QixLQUFLO1lBQ0wsVUFBVSxFQUFFLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQ3ZDLElBQUksQ0FBQyxrQkFBa0IsRUFDdkIsSUFBSSxDQUFDLHdCQUF3QixDQUM5QjtTQUNPLENBQUM7UUFDWCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO1FBQy9CLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7UUFDOUIsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRU8sWUFBWSxDQUFDLEdBQVcsRUFBRSxJQUFxQjtRQUNyRCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7WUFDOUIsR0FBRyxJQUFJLGtGQUFrRixDQUFDO1FBQzVGLENBQUM7UUFDRCxNQUFNLEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2hFLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7UUFDL0IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQztRQUM5QixPQUFPLElBQUksaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVPLFdBQVcsQ0FBQyxDQUFNO1FBQ3hCLElBQUksQ0FBQyxZQUFZLFdBQVcsRUFBRSxDQUFDO1lBQzdCLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUNELElBQUksQ0FBQyxZQUFZLGlCQUFpQixFQUFFLENBQUM7WUFDbkMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVCLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxDQUFDLENBQUM7UUFDVixDQUFDO0lBQ0gsQ0FBQztJQUVPLGdCQUFnQixDQUFDLFFBQWdCO1FBQ3ZDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNyQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVPLCtCQUErQixDQUFDLFFBQWdCO1FBQ3RELElBQUksOEJBQThCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ2xFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRU8sZ0JBQWdCLENBQUMsUUFBZ0I7UUFDdkMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDckMsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUNyQiw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQ2pELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUMvQixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFTyxXQUFXLENBQUMsS0FBYTtRQUMvQixNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO1FBQ3pCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsR0FBRyxHQUFHLEVBQUUsQ0FBQztZQUNuQyxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUNoRCx1RUFBdUU7Z0JBQ3ZFLHFDQUFxQztnQkFDckMsSUFBSSxDQUFDLE9BQU8sR0FBRyxlQUFlLENBQUM7Z0JBQy9CLE9BQU8sS0FBSyxDQUFDO1lBQ2YsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTywwQkFBMEIsQ0FBQyxLQUFhO1FBQzlDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDL0QsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVPLFdBQVcsQ0FBQyxLQUFhO1FBQy9CLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM3QixNQUFNLElBQUksQ0FBQyxZQUFZLENBQ3JCLDRCQUE0QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFDakQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQy9CLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVPLHVCQUF1QixDQUFDLFNBQW9DO1FBQ2xFLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN6QixDQUFDO0lBQ0gsQ0FBQztJQUVPLHVCQUF1QixDQUFDLFNBQW9DLEVBQUUsR0FBVztRQUMvRSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN4QyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDO1lBQ25DLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FDckIsNEJBQTRCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUNqRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FDNUIsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0lBRU8saUJBQWlCLENBQUMsSUFBWTtRQUNwQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDcEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN6QixDQUFDO0lBQ0gsQ0FBQztJQUVPLFNBQVM7UUFDZiwwRUFBMEU7UUFDMUUsbURBQW1EO1FBQ25ELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdkIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRU8sY0FBYyxDQUFDLGFBQXdCO1FBQzdDLElBQUksQ0FBQyxXQUFXLGtDQUEwQixDQUFDO1FBQzNDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN2QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDakYsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUMvQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUM1QyxxRkFBcUY7Z0JBQ3JGLFdBQVc7Z0JBQ1gsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDdkIsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQztnQkFDbkYsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUNyQix5QkFBeUIsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFDbkUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FDdkIsQ0FBQztZQUNKLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQztnQkFDSCxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDbkQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLENBQUM7WUFBQyxNQUFNLENBQUM7Z0JBQ1AsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUNyQixzQkFBc0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUNwRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUN2QixDQUFDO1lBQ0osQ0FBQztRQUNILENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUMvQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUM1QywyRkFBMkY7Z0JBQzNGLHVCQUF1QjtnQkFDdkIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ3ZDLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDO2dCQUN6QixJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN4QixDQUFDO2lCQUFNLENBQUM7Z0JBQ04sTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzlDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3ZCLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNWLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNyRixDQUFDO2dCQUNELElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDdEMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRU8sZUFBZSxDQUFDLGVBQXdCLEVBQUUsa0JBQWlDO1FBQ2pGLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUMsc0NBQThCLENBQUMsMkJBQW1CLENBQUMsQ0FBQztRQUN0RixNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7UUFDM0IsT0FBTyxJQUFJLEVBQUUsQ0FBQztZQUNaLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDM0MsTUFBTSxjQUFjLEdBQUcsa0JBQWtCLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQztZQUM3QixJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUNuQixNQUFNO1lBQ1IsQ0FBQztZQUNELElBQUksZUFBZSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNoRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9ELEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO2dCQUNqQixJQUFJLENBQUMsY0FBYyxzQ0FBOEIsQ0FBQztnQkFDbEQsSUFBSSxDQUFDLFdBQVcsc0NBQThCLENBQUM7WUFDakQsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDL0IsQ0FBQztRQUNILENBQUM7UUFDRCxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUVPLGVBQWUsQ0FBQyxLQUFzQjtRQUM1QyxJQUFJLENBQUMsV0FBVyxtQ0FBMEIsS0FBSyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsV0FBVyxnQ0FBdUIsQ0FBQztRQUN4QyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUVPLGFBQWEsQ0FBQyxLQUFzQjtRQUMxQyxJQUFJLENBQUMsV0FBVyxpQ0FBd0IsS0FBSyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsV0FBVyw4QkFBcUIsQ0FBQztRQUN0QyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUVPLGVBQWUsQ0FBQyxLQUFzQjtRQUM1QyxJQUFJLENBQUMsV0FBVyw4QkFBcUIsS0FBSyxDQUFDLENBQUM7UUFDNUMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMxQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVPLHFCQUFxQjtRQUMzQixNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDL0MsSUFBSSxNQUFNLEdBQVcsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ2pGLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDekIsQ0FBQztRQUNELElBQUksU0FBMEIsQ0FBQztRQUMvQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3pDLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkIsU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbkMsQ0FBQzthQUFNLENBQUM7WUFDTixTQUFTLEdBQUcsaUJBQWlCLENBQUM7UUFDaEMsQ0FBQztRQUNELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLEVBQUUsTUFBTSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM5QyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFTyxlQUFlLENBQUMsS0FBc0I7UUFDNUMsSUFBSSxPQUFlLENBQUM7UUFDcEIsSUFBSSxNQUFjLENBQUM7UUFDbkIsSUFBSSxZQUFvRSxDQUFDO1FBQ3pFLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUM5QyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQ3JCLDRCQUE0QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFDakQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQzVCLENBQUM7WUFDSixDQUFDO1lBRUQsWUFBWSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNoRCxNQUFNLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQixPQUFPLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNoQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDOUMsT0FDRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxNQUFNO2dCQUNwQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxHQUFHO2dCQUNqQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxHQUFHO2dCQUNqQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQ2xDLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7Z0JBQzdCLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDOUMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3JDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDOUMsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7Z0JBQ2hDLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ2hELENBQUM7WUFDRCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUM1QixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNYLElBQUksQ0FBQyxZQUFZLGlCQUFpQixFQUFFLENBQUM7Z0JBQ25DLElBQUksWUFBWSxFQUFFLENBQUM7b0JBQ2pCLHlFQUF5RTtvQkFDekUsWUFBWSxDQUFDLElBQUksd0NBQWdDLENBQUM7Z0JBQ3BELENBQUM7cUJBQU0sQ0FBQztvQkFDTiwrREFBK0Q7b0JBQy9ELGtEQUFrRDtvQkFDbEQsSUFBSSxDQUFDLFdBQVcseUJBQWlCLEtBQUssQ0FBQyxDQUFDO29CQUN4QyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDeEIsQ0FBQztnQkFDRCxPQUFPO1lBQ1QsQ0FBQztZQUVELE1BQU0sQ0FBQyxDQUFDO1FBQ1YsQ0FBQztRQUVELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVoRixJQUFJLGdCQUFnQixLQUFLLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNqRCxJQUFJLENBQUMsMkJBQTJCLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzRCxDQUFDO2FBQU0sSUFBSSxnQkFBZ0IsS0FBSyxjQUFjLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUNsRSxJQUFJLENBQUMsMkJBQTJCLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMxRCxDQUFDO0lBQ0gsQ0FBQztJQUVPLDJCQUEyQixDQUFDLE1BQWMsRUFBRSxPQUFlLEVBQUUsZUFBd0I7UUFDM0YsSUFBSSxDQUFDLGVBQWUsQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO1lBQ3pDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQztnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUNwRCxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7Z0JBQUUsT0FBTyxLQUFLLENBQUM7WUFDdkQsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzlDLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsT0FBTyxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBQzVELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUM5QyxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsV0FBVyw2QkFBcUIsQ0FBQztRQUN0QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzlELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxrQkFBa0I7UUFDMUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxLQUFzQjtRQUNqRCxJQUFJLENBQUMsV0FBVyxtQ0FBMkIsS0FBSyxDQUFDLENBQUM7UUFDbEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDM0MsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBc0IsQ0FBQztJQUNwRCxDQUFDO0lBRU8scUJBQXFCO1FBQzNCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDMUMsSUFBSSxhQUFhLEtBQUssS0FBSyxDQUFDLEdBQUcsSUFBSSxhQUFhLEtBQUssS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQy9ELE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyw0QkFBNEIsQ0FBQyxhQUFhLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDL0YsQ0FBQztRQUNELElBQUksQ0FBQyxXQUFXLDhCQUFxQixDQUFDO1FBQ3RDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQ25ELElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVPLHNCQUFzQjtRQUM1QixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUMzRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3RDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDOUIsNEZBQTRGO1lBQzVGLHlDQUF5QztZQUN6QyxNQUFNLFlBQVksR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLFNBQVMsQ0FBQztZQUM3RCxJQUFJLENBQUMseUJBQXlCLGtGQUc1QixZQUFZLEVBQ1osWUFBWSxDQUNiLENBQUM7WUFDRixJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hDLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxZQUFZLEdBQUcsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUMxRCxJQUFJLENBQUMseUJBQXlCLGtGQUc1QixZQUFZLEVBQ1osWUFBWSxDQUNiLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVPLGFBQWEsQ0FBQyxTQUFpQjtRQUNyQyxJQUFJLENBQUMsV0FBVywrQkFBc0IsQ0FBQztRQUN2QyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFTyxrQkFBa0I7UUFDeEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7WUFDbkQsQ0FBQztZQUNELENBQUMsK0JBQXVCLENBQUM7UUFDM0IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM1QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2pDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUVPLGdCQUFnQixDQUFDLEtBQXNCO1FBQzdDLElBQUksQ0FBQyxXQUFXLDhCQUFzQixLQUFLLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDOUMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDbkQsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzlDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRU8sMEJBQTBCO1FBQ2hDLElBQUksQ0FBQyxXQUFXLHlDQUFnQyxDQUFDO1FBQ2pELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVuQixJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSx5Q0FBZ0MsQ0FBQztRQUU5RCxJQUFJLENBQUMsV0FBVyw0QkFBb0IsQ0FBQztRQUNyQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoRCxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRSxJQUFJLElBQUksQ0FBQywrQkFBK0IsRUFBRSxDQUFDO1lBQ3pDLDhEQUE4RDtZQUM5RCxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO1FBQ3hDLENBQUM7YUFBTSxDQUFDO1lBQ04sdUNBQXVDO1lBQ3ZDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ25ELElBQUksbUJBQW1CLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ3RDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDeEQsQ0FBQztRQUNILENBQUM7UUFDRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU5QyxJQUFJLENBQUMsV0FBVyw0QkFBb0IsQ0FBQztRQUNyQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN2QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU8sMEJBQTBCO1FBQ2hDLElBQUksQ0FBQyxXQUFXLHlDQUFnQyxDQUFDO1FBQ2pELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BELElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3hCLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU5QyxJQUFJLENBQUMsV0FBVyw2Q0FBb0MsQ0FBQztRQUNyRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbkIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRTlDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLDZDQUFvQyxDQUFDO0lBQ3BFLENBQUM7SUFFTyx3QkFBd0I7UUFDOUIsSUFBSSxDQUFDLFdBQVcsMkNBQWtDLENBQUM7UUFDbkQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU5QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVPLHdCQUF3QjtRQUM5QixJQUFJLENBQUMsV0FBVyx1Q0FBOEIsQ0FBQztRQUMvQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFbkIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ2pDLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7OztPQWFHO0lBQ0sseUJBQXlCLENBQy9CLGFBQXdCLEVBQ3hCLHNCQUFpQyxFQUNqQyxZQUEyQixFQUMzQixnQkFBK0I7UUFFL0IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNoQyxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7UUFFM0IsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUM7WUFDdkIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNyQyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUNuRixJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN4RSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztnQkFDakIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQixFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUM5RSxJQUFJLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ2xDLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDcEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMvRCxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztnQkFDakIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNsQyxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUMvQixDQUFDO1FBQ0gsQ0FBQztRQUVELHlGQUF5RjtRQUN6Riw0REFBNEQ7UUFDNUQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQztRQUU5QixJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSyxxQkFBcUIsQ0FDM0Isc0JBQWlDLEVBQ2pDLGtCQUFtQyxFQUNuQyxxQkFBNkM7UUFFN0MsTUFBTSxLQUFLLEdBQWEsRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxXQUFXLENBQUMsc0JBQXNCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUM3RCxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU1QyxxRUFBcUU7UUFDckUsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QyxJQUFJLE9BQU8sR0FBa0IsSUFBSSxDQUFDO1FBQ2xDLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN0QixPQUNFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLElBQUk7WUFDbEMsQ0FBQyxxQkFBcUIsS0FBSyxJQUFJLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLEVBQzVELENBQUM7WUFDRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBRXJDLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7Z0JBQ3ZCLHVGQUF1RjtnQkFDdkYsZ0ZBQWdGO2dCQUNoRixnRUFBZ0U7Z0JBQ2hFLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO2dCQUN2QixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDOUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEIsT0FBTztZQUNULENBQUM7WUFFRCxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDckIsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO29CQUNwRCxrRUFBa0U7b0JBQ2xFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUM5RCxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDMUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDdEIsT0FBTztnQkFDVCxDQUFDO3FCQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUNsQyxnREFBZ0Q7b0JBQ2hELFNBQVMsR0FBRyxJQUFJLENBQUM7Z0JBQ25CLENBQUM7WUFDSCxDQUFDO1lBRUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3ZCLElBQUksSUFBSSxLQUFLLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDOUIsa0RBQWtEO2dCQUNsRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3pCLENBQUM7aUJBQU0sSUFBSSxJQUFJLEtBQUssT0FBTyxFQUFFLENBQUM7Z0JBQzVCLG9DQUFvQztnQkFDcEMsT0FBTyxHQUFHLElBQUksQ0FBQztZQUNqQixDQUFDO2lCQUFNLElBQUksQ0FBQyxTQUFTLElBQUksT0FBTyxLQUFLLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ2pFLCtCQUErQjtnQkFDL0IsT0FBTyxHQUFHLElBQUksQ0FBQztZQUNqQixDQUFDO1FBQ0gsQ0FBQztRQUVELDREQUE0RDtRQUM1RCxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDbkUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRU8sa0JBQWtCLENBQUMsS0FBc0IsRUFBRSxHQUFvQjtRQUNyRSxPQUFPLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVPLFVBQVU7UUFDaEIsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDN0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDaEQsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxDQUFDO2dCQUNoQyw2QkFBNkI7Z0JBQzdCLE9BQU8sSUFBSSxDQUFDO1lBQ2QsQ0FBQztZQUVELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7Z0JBQ3ZFLDRCQUE0QjtnQkFDNUIsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDO1FBQ0gsQ0FBQztRQUVELElBQ0UsSUFBSSxDQUFDLGVBQWU7WUFDcEIsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO1lBQ3RCLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtZQUN0QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFDNUUsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOzs7T0FHRztJQUNLLFdBQVc7UUFDakIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN0QyxpRkFBaUY7WUFDakYsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNqQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxzRUFBc0U7WUFDdEUsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3hCLElBQ0UsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDdEMsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxLQUFLLEtBQUssQ0FBQyxNQUFNO2dCQUNyQixJQUFJLEtBQUssS0FBSyxDQUFDLEtBQUssRUFDcEIsQ0FBQztnQkFDRCxPQUFPLElBQUksQ0FBQztZQUNkLENBQUM7UUFDSCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRU8sVUFBVSxDQUFDLElBQVk7UUFDN0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0IsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRU8sY0FBYztRQUNwQixPQUFPLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQ2hFLENBQUM7SUFFTyxrQkFBa0I7UUFDeEIsT0FBTyxDQUNMLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQztZQUNuQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7MkRBQ3pCLENBQ3JDLENBQUM7SUFDSixDQUFDO0lBRU8sa0JBQWtCO1FBQ3hCLE9BQU8sQ0FDTCxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxHQUFHLENBQUM7WUFDbkMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO3VEQUM3QixDQUNqQyxDQUFDO0lBQ0osQ0FBQztJQUVPLG9CQUFvQjtRQUMxQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzFDLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDOUIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNuQyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMxRSxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztZQUNyQixPQUFPLENBQUMsZUFBZSxDQUFDO1FBQzFCLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQUVELFNBQVMsZUFBZSxDQUFDLElBQVk7SUFDbkMsT0FBTyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUM7QUFDMUQsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLElBQVk7SUFDN0IsT0FBTyxDQUNMLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDO1FBQ3hCLElBQUksS0FBSyxLQUFLLENBQUMsR0FBRztRQUNsQixJQUFJLEtBQUssS0FBSyxDQUFDLEdBQUc7UUFDbEIsSUFBSSxLQUFLLEtBQUssQ0FBQyxNQUFNO1FBQ3JCLElBQUksS0FBSyxLQUFLLENBQUMsR0FBRztRQUNsQixJQUFJLEtBQUssS0FBSyxDQUFDLEdBQUc7UUFDbEIsSUFBSSxLQUFLLEtBQUssQ0FBQyxHQUFHO1FBQ2xCLElBQUksS0FBSyxLQUFLLENBQUMsSUFBSSxDQUNwQixDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFDLElBQVk7SUFDL0IsT0FBTyxDQUNMLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxFQUFFLElBQUksS0FBSyxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDcEMsQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLEVBQUUsSUFBSSxLQUFLLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQztRQUNwQyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsRUFBRSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQ3JDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFZO0lBQ3BDLE9BQU8sSUFBSSxLQUFLLEtBQUssQ0FBQyxVQUFVLElBQUksSUFBSSxLQUFLLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLElBQVk7SUFDcEMsT0FBTyxJQUFJLEtBQUssS0FBSyxDQUFDLFVBQVUsSUFBSSxJQUFJLEtBQUssS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEYsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsSUFBWTtJQUN4QyxPQUFPLElBQUksS0FBSyxLQUFLLENBQUMsT0FBTyxDQUFDO0FBQ2hDLENBQUM7QUFFRCxTQUFTLDhCQUE4QixDQUFDLEtBQWEsRUFBRSxLQUFhO0lBQ2xFLE9BQU8sbUJBQW1CLENBQUMsS0FBSyxDQUFDLEtBQUssbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDbkUsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsSUFBWTtJQUN2QyxPQUFPLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRSxJQUFJLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbEYsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLElBQVk7SUFDbkMsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxLQUFLLEtBQUssQ0FBQyxFQUFFLENBQUM7QUFDL0UsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsSUFBWTtJQUN4QyxPQUFPLElBQUksS0FBSyxLQUFLLENBQUMsVUFBVSxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM1RCxDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsU0FBa0I7SUFDekMsTUFBTSxTQUFTLEdBQVksRUFBRSxDQUFDO0lBQzlCLElBQUksWUFBWSxHQUFzQixTQUFTLENBQUM7SUFDaEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUMxQyxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0IsSUFDRSxDQUFDLFlBQVksSUFBSSxZQUFZLENBQUMsSUFBSSwyQkFBbUIsSUFBSSxLQUFLLENBQUMsSUFBSSwyQkFBbUIsQ0FBQztZQUN2RixDQUFDLFlBQVk7Z0JBQ1gsWUFBWSxDQUFDLElBQUksdUNBQThCO2dCQUMvQyxLQUFLLENBQUMsSUFBSSx1Q0FBOEIsQ0FBQyxFQUMzQyxDQUFDO1lBQ0QsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLFlBQVksQ0FBQyxVQUFVLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1FBQ3JELENBQUM7YUFBTSxDQUFDO1lBQ04sWUFBWSxHQUFHLEtBQUssQ0FBQztZQUNyQixTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQy9CLENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQWlDRCxNQUFNLG9CQUFvQjtJQVF4QixZQUFZLFlBQW9ELEVBQUUsS0FBa0I7UUFDbEYsSUFBSSxZQUFZLFlBQVksb0JBQW9CLEVBQUUsQ0FBQztZQUNqRCxJQUFJLENBQUMsSUFBSSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUM7WUFDOUIsSUFBSSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDO1lBQ2hDLElBQUksQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQztZQUU1QixNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDO1lBQ2pDLDZGQUE2RjtZQUM3Riw0RkFBNEY7WUFDNUYsNEZBQTRGO1lBQzVGLGtEQUFrRDtZQUNsRCxJQUFJLENBQUMsS0FBSyxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtnQkFDaEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO2dCQUNwQixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7Z0JBQ2hCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTthQUNyQixDQUFDO1FBQ0osQ0FBQzthQUFNLENBQUM7WUFDTixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1gsTUFBTSxJQUFJLEtBQUssQ0FDYiw4RUFBOEUsQ0FDL0UsQ0FBQztZQUNKLENBQUM7WUFDRCxJQUFJLENBQUMsSUFBSSxHQUFHLFlBQVksQ0FBQztZQUN6QixJQUFJLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUM7WUFDbEMsSUFBSSxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxLQUFLLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDUixNQUFNLEVBQUUsS0FBSyxDQUFDLFFBQVE7Z0JBQ3RCLElBQUksRUFBRSxLQUFLLENBQUMsU0FBUztnQkFDckIsTUFBTSxFQUFFLEtBQUssQ0FBQyxRQUFRO2FBQ3ZCLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVELEtBQUs7UUFDSCxPQUFPLElBQUksb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVELElBQUk7UUFDRixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0lBQ3pCLENBQUM7SUFDRCxTQUFTO1FBQ1AsT0FBTyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQ3RDLENBQUM7SUFDRCxJQUFJLENBQUMsS0FBVztRQUNkLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDaEQsQ0FBQztJQUVELE9BQU87UUFDTCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsSUFBSTtRQUNGLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxPQUFPLENBQUMsS0FBWSxFQUFFLHVCQUFrQztRQUN0RCxLQUFLLEdBQUcsS0FBSyxJQUFJLElBQUksQ0FBQztRQUN0QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7UUFDdEIsSUFBSSx1QkFBdUIsRUFBRSxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksdUJBQXVCLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3BGLElBQUksU0FBUyxLQUFLLEtBQUssRUFBRSxDQUFDO29CQUN4QixLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBVSxDQUFDO2dCQUNoQyxDQUFDO2dCQUNELEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQixDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEQsTUFBTSxpQkFBaUIsR0FDckIsU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUM7UUFDM0UsT0FBTyxJQUFJLGVBQWUsQ0FBQyxhQUFhLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVELFFBQVEsQ0FBQyxLQUFXO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBRUQsTUFBTSxDQUFDLEdBQVc7UUFDaEIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRVMsWUFBWSxDQUFDLEtBQWtCO1FBQ3ZDLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDbkIsTUFBTSxJQUFJLFdBQVcsQ0FBQyw0QkFBNEIsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBQ0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUMsSUFBSSxXQUFXLEtBQUssS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQzlCLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNiLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLENBQUM7YUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ3pDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNqQixDQUFDO1FBQ0QsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2YsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRVMsVUFBVSxDQUFDLEtBQWtCO1FBQ3JDLEtBQUssQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqRixDQUFDO0lBRU8sa0JBQWtCLENBQUMsTUFBWTtRQUNyQyxPQUFPLElBQUksYUFBYSxDQUN0QixNQUFNLENBQUMsSUFBSSxFQUNYLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUNuQixNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFDakIsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQ3BCLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFFRCxNQUFNLHNCQUF1QixTQUFRLG9CQUFvQjtJQUt2RCxZQUFZLFlBQXNELEVBQUUsS0FBa0I7UUFDcEYsSUFBSSxZQUFZLFlBQVksc0JBQXNCLEVBQUUsQ0FBQztZQUNuRCxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDcEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFDLEdBQUcsWUFBWSxDQUFDLGFBQWEsRUFBQyxDQUFDO1FBQ3ZELENBQUM7YUFBTSxDQUFDO1lBQ04sS0FBSyxDQUFDLFlBQVksRUFBRSxLQUFNLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDbEMsQ0FBQztJQUNILENBQUM7SUFFUSxPQUFPO1FBQ2QsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQ2hDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBRVEsSUFBSTtRQUNYLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNiLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO0lBQy9CLENBQUM7SUFFUSxLQUFLO1FBQ1osT0FBTyxJQUFJLHNCQUFzQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFUSxRQUFRLENBQUMsS0FBVztRQUMzQixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ2YsT0FBTyxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQy9ELEtBQUssSUFBSSxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQixDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNPLHFCQUFxQjtRQUM3QixNQUFNLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztRQUUzQyxJQUFJLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNoQyxxRkFBcUY7WUFDckYseUJBQXlCO1lBQ3pCLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUMsQ0FBQztZQUVyQywwQkFBMEI7WUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFFdEMsa0RBQWtEO1lBQ2xELElBQUksSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO1lBQzlCLENBQUM7aUJBQU0sSUFBSSxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUM7WUFDOUIsQ0FBQztpQkFBTSxJQUFJLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDL0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQztZQUNoQyxDQUFDO2lCQUFNLElBQUksSUFBSSxFQUFFLEtBQUssS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMvQixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQy9CLENBQUM7aUJBQU0sSUFBSSxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7WUFDbEMsQ0FBQztpQkFBTSxJQUFJLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDL0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztZQUM5QixDQUFDO1lBRUQsc0NBQXNDO2lCQUNqQyxJQUFJLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDN0IsOEJBQThCO2dCQUM5QixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLDRCQUE0QjtnQkFDbkUsSUFBSSxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQzdCLDBDQUEwQztvQkFDMUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyw0QkFBNEI7b0JBQ25FLHlFQUF5RTtvQkFDekUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNoQyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7b0JBQ2YsT0FBTyxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ2hDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO3dCQUN0QyxNQUFNLEVBQUUsQ0FBQztvQkFDWCxDQUFDO29CQUNELElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUM3RCxDQUFDO3FCQUFNLENBQUM7b0JBQ04sc0NBQXNDO29CQUN0QyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ2hDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO29CQUN0QyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztvQkFDdEMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7b0JBQ3RDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN4RCxDQUFDO1lBQ0gsQ0FBQztpQkFBTSxJQUFJLElBQUksRUFBRSxLQUFLLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDL0IsNkJBQTZCO2dCQUM3QixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLDRCQUE0QjtnQkFDbkUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNoQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDeEQsQ0FBQztpQkFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUN0QyxnQ0FBZ0M7Z0JBQ2hDLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQztnQkFDZixJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7Z0JBQ2YsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUM1QixPQUFPLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ2hELFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ3hCLEtBQUssSUFBSSxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7b0JBQ3RDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLEVBQUUsQ0FBQztnQkFDWCxDQUFDO2dCQUNELElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JDLGtCQUFrQjtnQkFDbEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDO1lBQzlDLENBQUM7aUJBQU0sSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDcEQsK0NBQStDO2dCQUMvQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLDJCQUEyQjtnQkFDbEUsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1lBQ2xDLENBQUM7aUJBQU0sQ0FBQztnQkFDTiwwRkFBMEY7Z0JBQzFGLDRFQUE0RTtnQkFDNUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7WUFDNUMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRVMsZUFBZSxDQUFDLEtBQTZCLEVBQUUsTUFBYztRQUNyRSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsQ0FBQztRQUM5RixNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUNyQixPQUFPLFFBQVEsQ0FBQztRQUNsQixDQUFDO2FBQU0sQ0FBQztZQUNOLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQztZQUNsQyxNQUFNLElBQUksV0FBVyxDQUFDLHFDQUFxQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3RFLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sV0FBVztJQUN0QixZQUNTLEdBQVcsRUFDWCxNQUF1QjtRQUR2QixRQUFHLEdBQUgsR0FBRyxDQUFRO1FBQ1gsV0FBTSxHQUFOLE1BQU0sQ0FBaUI7SUFDN0IsQ0FBQztDQUNMIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoYXJzIGZyb20gJy4uL2NoYXJzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VGaWxlLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4vZGVmYXVsdHMnO1xuaW1wb3J0IHtOQU1FRF9FTlRJVElFU30gZnJvbSAnLi9lbnRpdGllcyc7XG5pbXBvcnQge1RhZ0NvbnRlbnRUeXBlLCBUYWdEZWZpbml0aW9ufSBmcm9tICcuL3RhZ3MnO1xuaW1wb3J0IHtJbmNvbXBsZXRlVGFnT3BlblRva2VuLCBUYWdPcGVuU3RhcnRUb2tlbiwgVG9rZW4sIFRva2VuVHlwZX0gZnJvbSAnLi90b2tlbnMnO1xuXG5leHBvcnQgY2xhc3MgVG9rZW5FcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICBlcnJvck1zZzogc3RyaW5nLFxuICAgIHB1YmxpYyB0b2tlblR5cGU6IFRva2VuVHlwZSB8IG51bGwsXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICApIHtcbiAgICBzdXBlcihzcGFuLCBlcnJvck1zZyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRva2VuaXplUmVzdWx0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHRva2VuczogVG9rZW5bXSxcbiAgICBwdWJsaWMgZXJyb3JzOiBUb2tlbkVycm9yW10sXG4gICAgcHVibGljIG5vbk5vcm1hbGl6ZWRJY3VFeHByZXNzaW9uczogVG9rZW5bXSxcbiAgKSB7fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIExleGVyUmFuZ2Uge1xuICBzdGFydFBvczogbnVtYmVyO1xuICBzdGFydExpbmU6IG51bWJlcjtcbiAgc3RhcnRDb2w6IG51bWJlcjtcbiAgZW5kUG9zOiBudW1iZXI7XG59XG5cbi8qKlxuICogT3B0aW9ucyB0aGF0IG1vZGlmeSBob3cgdGhlIHRleHQgaXMgdG9rZW5pemVkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRva2VuaXplT3B0aW9ucyB7XG4gIC8qKiBXaGV0aGVyIHRvIHRva2VuaXplIElDVSBtZXNzYWdlcyAoY29uc2lkZXJlZCBhcyB0ZXh0IG5vZGVzIHdoZW4gZmFsc2UpLiAqL1xuICB0b2tlbml6ZUV4cGFuc2lvbkZvcm1zPzogYm9vbGVhbjtcbiAgLyoqIEhvdyB0byB0b2tlbml6ZSBpbnRlcnBvbGF0aW9uIG1hcmtlcnMuICovXG4gIGludGVycG9sYXRpb25Db25maWc/OiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAvKipcbiAgICogVGhlIHN0YXJ0IGFuZCBlbmQgcG9pbnQgb2YgdGhlIHRleHQgdG8gcGFyc2Ugd2l0aGluIHRoZSBgc291cmNlYCBzdHJpbmcuXG4gICAqIFRoZSBlbnRpcmUgYHNvdXJjZWAgc3RyaW5nIGlzIHBhcnNlZCBpZiB0aGlzIGlzIG5vdCBwcm92aWRlZC5cbiAgICogKi9cbiAgcmFuZ2U/OiBMZXhlclJhbmdlO1xuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhIEphdmFTY3JpcHQgc3RyaW5nLCB0aGVuIHdlIGhhdmUgdG8gZGVhbCB3aXRoIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqXG4gICAqICoqRXhhbXBsZSAxOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXCJkZWZcXG5naGlcIlxuICAgKiBgYGBcbiAgICpcbiAgICogLSBUaGUgYFxcXCJgIG11c3QgYmUgY29udmVydGVkIHRvIGBcImAuXG4gICAqIC0gVGhlIGBcXG5gIG11c3QgYmUgY29udmVydGVkIHRvIGEgbmV3IGxpbmUgY2hhcmFjdGVyIGluIGEgdG9rZW4sXG4gICAqICAgYnV0IGl0IHNob3VsZCBub3QgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMjoqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFxuICAgKiAgZGVmXCJcbiAgICogYGBgXG4gICAqXG4gICAqIFRoZSBsaW5lIGNvbnRpbnVhdGlvbiAoYFxcYCBmb2xsb3dlZCBieSBhIG5ld2xpbmUpIHNob3VsZCBiZSByZW1vdmVkIGZyb20gYSB0b2tlblxuICAgKiBidXQgdGhlIG5ldyBsaW5lIHNob3VsZCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqL1xuICBlc2NhcGVkU3RyaW5nPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIElmIHRoaXMgdGV4dCBpcyBzdG9yZWQgaW4gYW4gZXh0ZXJuYWwgdGVtcGxhdGUgKGUuZy4gdmlhIGB0ZW1wbGF0ZVVybGApIHRoZW4gd2UgbmVlZCB0byBkZWNpZGVcbiAgICogd2hldGhlciBvciBub3QgdG8gbm9ybWFsaXplIHRoZSBsaW5lLWVuZGluZ3MgKGZyb20gYFxcclxcbmAgdG8gYFxcbmApIHdoZW4gcHJvY2Vzc2luZyBJQ1VcbiAgICogZXhwcmVzc2lvbnMuXG4gICAqXG4gICAqIElmIGB0cnVlYCB0aGVuIHdlIHdpbGwgbm9ybWFsaXplIElDVSBleHByZXNzaW9uIGxpbmUgZW5kaW5ncy5cbiAgICogVGhlIGRlZmF1bHQgaXMgYGZhbHNlYCwgYnV0IHRoaXMgd2lsbCBiZSBzd2l0Y2hlZCBpbiBhIGZ1dHVyZSBtYWpvciByZWxlYXNlLlxuICAgKi9cbiAgaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGNoYXJhY3RlcnMgdGhhdCBzaG91bGQgYmUgY29uc2lkZXJlZCBhcyBsZWFkaW5nIHRyaXZpYS5cbiAgICogTGVhZGluZyB0cml2aWEgYXJlIGNoYXJhY3RlcnMgdGhhdCBhcmUgbm90IGltcG9ydGFudCB0byB0aGUgZGV2ZWxvcGVyLCBhbmQgc28gc2hvdWxkIG5vdCBiZVxuICAgKiBpbmNsdWRlZCBpbiBzb3VyY2UtbWFwIHNlZ21lbnRzLiAgQSBjb21tb24gZXhhbXBsZSBpcyB3aGl0ZXNwYWNlLlxuICAgKi9cbiAgbGVhZGluZ1RyaXZpYUNoYXJzPzogc3RyaW5nW107XG4gIC8qKlxuICAgKiBJZiB0cnVlLCBkbyBub3QgY29udmVydCBDUkxGIHRvIExGLlxuICAgKi9cbiAgcHJlc2VydmVMaW5lRW5kaW5ncz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gdG9rZW5pemUgQCBibG9jayBzeW50YXguIE90aGVyd2lzZSBjb25zaWRlcmVkIHRleHQsXG4gICAqIG9yIElDVSB0b2tlbnMgaWYgYHRva2VuaXplRXhwYW5zaW9uRm9ybXNgIGlzIGVuYWJsZWQuXG4gICAqL1xuICB0b2tlbml6ZUJsb2Nrcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gdG9rZW5pemUgdGhlIGBAbGV0YCBzeW50YXguIE90aGVyd2lzZSB3aWxsIGJlIGNvbnNpZGVyZWQgZWl0aGVyXG4gICAqIHRleHQgb3IgYW4gaW5jb21wbGV0ZSBibG9jaywgZGVwZW5kaW5nIG9uIHdoZXRoZXIgYHRva2VuaXplQmxvY2tzYCBpcyBlbmFibGVkLlxuICAgKi9cbiAgdG9rZW5pemVMZXQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9rZW5pemUoXG4gIHNvdXJjZTogc3RyaW5nLFxuICB1cmw6IHN0cmluZyxcbiAgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbixcbiAgb3B0aW9uczogVG9rZW5pemVPcHRpb25zID0ge30sXG4pOiBUb2tlbml6ZVJlc3VsdCB7XG4gIGNvbnN0IHRva2VuaXplciA9IG5ldyBfVG9rZW5pemVyKG5ldyBQYXJzZVNvdXJjZUZpbGUoc291cmNlLCB1cmwpLCBnZXRUYWdEZWZpbml0aW9uLCBvcHRpb25zKTtcbiAgdG9rZW5pemVyLnRva2VuaXplKCk7XG4gIHJldHVybiBuZXcgVG9rZW5pemVSZXN1bHQoXG4gICAgbWVyZ2VUZXh0VG9rZW5zKHRva2VuaXplci50b2tlbnMpLFxuICAgIHRva2VuaXplci5lcnJvcnMsXG4gICAgdG9rZW5pemVyLm5vbk5vcm1hbGl6ZWRJY3VFeHByZXNzaW9ucyxcbiAgKTtcbn1cblxuY29uc3QgX0NSX09SX0NSTEZfUkVHRVhQID0gL1xcclxcbj8vZztcblxuZnVuY3Rpb24gX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyhjaGFyQ29kZTogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgY2hhciA9IGNoYXJDb2RlID09PSBjaGFycy4kRU9GID8gJ0VPRicgOiBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXJDb2RlKTtcbiAgcmV0dXJuIGBVbmV4cGVjdGVkIGNoYXJhY3RlciBcIiR7Y2hhcn1cImA7XG59XG5cbmZ1bmN0aW9uIF91bmtub3duRW50aXR5RXJyb3JNc2coZW50aXR5U3JjOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFVua25vd24gZW50aXR5IFwiJHtlbnRpdHlTcmN9XCIgLSB1c2UgdGhlIFwiJiM8ZGVjaW1hbD47XCIgb3IgIFwiJiN4PGhleD47XCIgc3ludGF4YDtcbn1cblxuZnVuY3Rpb24gX3VucGFyc2FibGVFbnRpdHlFcnJvck1zZyh0eXBlOiBDaGFyYWN0ZXJSZWZlcmVuY2VUeXBlLCBlbnRpdHlTdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgVW5hYmxlIHRvIHBhcnNlIGVudGl0eSBcIiR7ZW50aXR5U3RyfVwiIC0gJHt0eXBlfSBjaGFyYWN0ZXIgcmVmZXJlbmNlIGVudGl0aWVzIG11c3QgZW5kIHdpdGggXCI7XCJgO1xufVxuXG5lbnVtIENoYXJhY3RlclJlZmVyZW5jZVR5cGUge1xuICBIRVggPSAnaGV4YWRlY2ltYWwnLFxuICBERUMgPSAnZGVjaW1hbCcsXG59XG5cbmNsYXNzIF9Db250cm9sRmxvd0Vycm9yIHtcbiAgY29uc3RydWN0b3IocHVibGljIGVycm9yOiBUb2tlbkVycm9yKSB7fVxufVxuXG4vLyBTZWUgaHR0cHM6Ly93d3cudzMub3JnL1RSL2h0bWw1MS9zeW50YXguaHRtbCN3cml0aW5nLWh0bWwtZG9jdW1lbnRzXG5jbGFzcyBfVG9rZW5pemVyIHtcbiAgcHJpdmF0ZSBfY3Vyc29yOiBDaGFyYWN0ZXJDdXJzb3I7XG4gIHByaXZhdGUgX3Rva2VuaXplSWN1OiBib29sZWFuO1xuICBwcml2YXRlIF9pbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICBwcml2YXRlIF9sZWFkaW5nVHJpdmlhQ29kZVBvaW50czogbnVtYmVyW10gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2N1cnJlbnRUb2tlblN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfY3VycmVudFRva2VuVHlwZTogVG9rZW5UeXBlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2V4cGFuc2lvbkNhc2VTdGFjazogVG9rZW5UeXBlW10gPSBbXTtcbiAgcHJpdmF0ZSBfaW5JbnRlcnBvbGF0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3ByZXNlcnZlTGluZUVuZGluZ3M6IGJvb2xlYW47XG4gIHByaXZhdGUgcmVhZG9ubHkgX2kxOG5Ob3JtYWxpemVMaW5lRW5kaW5nc0luSUNVczogYm9vbGVhbjtcbiAgcHJpdmF0ZSByZWFkb25seSBfdG9rZW5pemVCbG9ja3M6IGJvb2xlYW47XG4gIHByaXZhdGUgcmVhZG9ubHkgX3Rva2VuaXplTGV0OiBib29sZWFuO1xuICB0b2tlbnM6IFRva2VuW10gPSBbXTtcbiAgZXJyb3JzOiBUb2tlbkVycm9yW10gPSBbXTtcbiAgbm9uTm9ybWFsaXplZEljdUV4cHJlc3Npb25zOiBUb2tlbltdID0gW107XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBfZmlsZSBUaGUgaHRtbCBzb3VyY2UgZmlsZSBiZWluZyB0b2tlbml6ZWQuXG4gICAqIEBwYXJhbSBfZ2V0VGFnRGVmaW5pdGlvbiBBIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXRyaWV2ZSBhIHRhZyBkZWZpbml0aW9uIGZvciBhIGdpdmVuIHRhZyBuYW1lLlxuICAgKiBAcGFyYW0gb3B0aW9ucyBDb25maWd1cmF0aW9uIG9mIHRoZSB0b2tlbml6YXRpb24uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBfZmlsZTogUGFyc2VTb3VyY2VGaWxlLFxuICAgIHByaXZhdGUgX2dldFRhZ0RlZmluaXRpb246ICh0YWdOYW1lOiBzdHJpbmcpID0+IFRhZ0RlZmluaXRpb24sXG4gICAgb3B0aW9uczogVG9rZW5pemVPcHRpb25zLFxuICApIHtcbiAgICB0aGlzLl90b2tlbml6ZUljdSA9IG9wdGlvbnMudG9rZW5pemVFeHBhbnNpb25Gb3JtcyB8fCBmYWxzZTtcbiAgICB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnID0gb3B0aW9ucy5pbnRlcnBvbGF0aW9uQ29uZmlnIHx8IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgdGhpcy5fbGVhZGluZ1RyaXZpYUNvZGVQb2ludHMgPVxuICAgICAgb3B0aW9ucy5sZWFkaW5nVHJpdmlhQ2hhcnMgJiYgb3B0aW9ucy5sZWFkaW5nVHJpdmlhQ2hhcnMubWFwKChjKSA9PiBjLmNvZGVQb2ludEF0KDApIHx8IDApO1xuICAgIGNvbnN0IHJhbmdlID0gb3B0aW9ucy5yYW5nZSB8fCB7XG4gICAgICBlbmRQb3M6IF9maWxlLmNvbnRlbnQubGVuZ3RoLFxuICAgICAgc3RhcnRQb3M6IDAsXG4gICAgICBzdGFydExpbmU6IDAsXG4gICAgICBzdGFydENvbDogMCxcbiAgICB9O1xuICAgIHRoaXMuX2N1cnNvciA9IG9wdGlvbnMuZXNjYXBlZFN0cmluZ1xuICAgICAgPyBuZXcgRXNjYXBlZENoYXJhY3RlckN1cnNvcihfZmlsZSwgcmFuZ2UpXG4gICAgICA6IG5ldyBQbGFpbkNoYXJhY3RlckN1cnNvcihfZmlsZSwgcmFuZ2UpO1xuICAgIHRoaXMuX3ByZXNlcnZlTGluZUVuZGluZ3MgPSBvcHRpb25zLnByZXNlcnZlTGluZUVuZGluZ3MgfHwgZmFsc2U7XG4gICAgdGhpcy5faTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzID0gb3B0aW9ucy5pMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXMgfHwgZmFsc2U7XG4gICAgdGhpcy5fdG9rZW5pemVCbG9ja3MgPSBvcHRpb25zLnRva2VuaXplQmxvY2tzID8/IHRydWU7XG4gICAgdGhpcy5fdG9rZW5pemVMZXQgPSBvcHRpb25zLnRva2VuaXplTGV0ID8/IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuX2N1cnNvci5pbml0KCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5oYW5kbGVFcnJvcihlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuX3ByZXNlcnZlTGluZUVuZGluZ3MpIHtcbiAgICAgIHJldHVybiBjb250ZW50O1xuICAgIH1cbiAgICAvLyBodHRwczovL3d3dy53My5vcmcvVFIvaHRtbDUxL3N5bnRheC5odG1sI3ByZXByb2Nlc3NpbmctdGhlLWlucHV0LXN0cmVhbVxuICAgIC8vIEluIG9yZGVyIHRvIGtlZXAgdGhlIG9yaWdpbmFsIHBvc2l0aW9uIGluIHRoZSBzb3VyY2UsIHdlIGNhbiBub3RcbiAgICAvLyBwcmUtcHJvY2VzcyBpdC5cbiAgICAvLyBJbnN0ZWFkIENScyBhcmUgcHJvY2Vzc2VkIHJpZ2h0IGJlZm9yZSBpbnN0YW50aWF0aW5nIHRoZSB0b2tlbnMuXG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZShfQ1JfT1JfQ1JMRl9SRUdFWFAsICdcXG4nKTtcbiAgfVxuXG4gIHRva2VuaXplKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kRU9GKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kTFQpKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kQkFORykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lQ2RhdGEoc3RhcnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJE1JTlVTKSkge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lQ29tbWVudChzdGFydCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lRG9jVHlwZShzdGFydCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFNMQVNIKSkge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZVRhZ0Nsb3NlKHN0YXJ0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZVRhZ09wZW4oc3RhcnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0aGlzLl90b2tlbml6ZUxldCAmJlxuICAgICAgICAgIC8vIFVzZSBgcGVla2AgaW5zdGVhZCBvZiBgYXR0ZW1wQ2hhckNvZGVgIHNpbmNlIHdlXG4gICAgICAgICAgLy8gZG9uJ3Qgd2FudCB0byBhZHZhbmNlIGluIGNhc2UgaXQncyBub3QgYEBsZXRgLlxuICAgICAgICAgIHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRBVCAmJlxuICAgICAgICAgICF0aGlzLl9pbkludGVycG9sYXRpb24gJiZcbiAgICAgICAgICB0aGlzLl9hdHRlbXB0U3RyKCdAbGV0JylcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhpcy5fY29uc3VtZUxldERlY2xhcmF0aW9uKHN0YXJ0KTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90b2tlbml6ZUJsb2NrcyAmJiB0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJEFUKSkge1xuICAgICAgICAgIHRoaXMuX2NvbnN1bWVCbG9ja1N0YXJ0KHN0YXJ0KTtcbiAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0aGlzLl90b2tlbml6ZUJsb2NrcyAmJlxuICAgICAgICAgICF0aGlzLl9pbkludGVycG9sYXRpb24gJiZcbiAgICAgICAgICAhdGhpcy5faXNJbkV4cGFuc2lvbkNhc2UoKSAmJlxuICAgICAgICAgICF0aGlzLl9pc0luRXhwYW5zaW9uRm9ybSgpICYmXG4gICAgICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRSQlJBQ0UpXG4gICAgICAgICkge1xuICAgICAgICAgIHRoaXMuX2NvbnN1bWVCbG9ja0VuZChzdGFydCk7XG4gICAgICAgIH0gZWxzZSBpZiAoISh0aGlzLl90b2tlbml6ZUljdSAmJiB0aGlzLl90b2tlbml6ZUV4cGFuc2lvbkZvcm0oKSkpIHtcbiAgICAgICAgICAvLyBJbiAocG9zc2libHkgaW50ZXJwb2xhdGVkKSB0ZXh0IHRoZSBlbmQgb2YgdGhlIHRleHQgaXMgZ2l2ZW4gYnkgYGlzVGV4dEVuZCgpYCwgd2hpbGVcbiAgICAgICAgICAvLyB0aGUgcHJlbWF0dXJlIGVuZCBvZiBhbiBpbnRlcnBvbGF0aW9uIGlzIGdpdmVuIGJ5IHRoZSBzdGFydCBvZiBhIG5ldyBIVE1MIGVsZW1lbnQuXG4gICAgICAgICAgdGhpcy5fY29uc3VtZVdpdGhJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgICAgVG9rZW5UeXBlLlRFWFQsXG4gICAgICAgICAgICBUb2tlblR5cGUuSU5URVJQT0xBVElPTixcbiAgICAgICAgICAgICgpID0+IHRoaXMuX2lzVGV4dEVuZCgpLFxuICAgICAgICAgICAgKCkgPT4gdGhpcy5faXNUYWdTdGFydCgpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhpcy5oYW5kbGVFcnJvcihlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRU9GKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9nZXRCbG9ja05hbWUoKTogc3RyaW5nIHtcbiAgICAvLyBUaGlzIGFsbG93cyB1cyB0byBjYXB0dXJlIHVwIHNvbWV0aGluZyBsaWtlIGBAZWxzZSBpZmAsIGJ1dCBub3QgYEAgaWZgLlxuICAgIGxldCBzcGFjZXNJbk5hbWVBbGxvd2VkID0gZmFsc2U7XG4gICAgY29uc3QgbmFtZUN1cnNvciA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuXG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbigoY29kZSkgPT4ge1xuICAgICAgaWYgKGNoYXJzLmlzV2hpdGVzcGFjZShjb2RlKSkge1xuICAgICAgICByZXR1cm4gIXNwYWNlc0luTmFtZUFsbG93ZWQ7XG4gICAgICB9XG4gICAgICBpZiAoaXNCbG9ja05hbWVDaGFyKGNvZGUpKSB7XG4gICAgICAgIHNwYWNlc0luTmFtZUFsbG93ZWQgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVDdXJzb3IpLnRyaW0oKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVCbG9ja1N0YXJ0KHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5CTE9DS19PUEVOX1NUQVJULCBzdGFydCk7XG4gICAgY29uc3Qgc3RhcnRUb2tlbiA9IHRoaXMuX2VuZFRva2VuKFt0aGlzLl9nZXRCbG9ja05hbWUoKV0pO1xuXG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRMUEFSRU4pIHtcbiAgICAgIC8vIEFkdmFuY2UgcGFzdCB0aGUgb3BlbmluZyBwYXJlbi5cbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICAvLyBDYXB0dXJlIHRoZSBwYXJhbWV0ZXJzLlxuICAgICAgdGhpcy5fY29uc3VtZUJsb2NrUGFyYW1ldGVycygpO1xuICAgICAgLy8gQWxsb3cgc3BhY2VzIGJlZm9yZSB0aGUgY2xvc2luZyBwYXJlbi5cbiAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kUlBBUkVOKSkge1xuICAgICAgICAvLyBBbGxvdyBzcGFjZXMgYWZ0ZXIgdGhlIHBhcmVuLlxuICAgICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGFydFRva2VuLnR5cGUgPSBUb2tlblR5cGUuSU5DT01QTEVURV9CTE9DS19PUEVOO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kTEJSQUNFKSkge1xuICAgICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQkxPQ0tfT1BFTl9FTkQpO1xuICAgICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGFydFRva2VuLnR5cGUgPSBUb2tlblR5cGUuSU5DT01QTEVURV9CTE9DS19PUEVOO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVCbG9ja0VuZChzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQkxPQ0tfQ0xPU0UsIHN0YXJ0KTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQmxvY2tQYXJhbWV0ZXJzKCkge1xuICAgIC8vIFRyaW0gdGhlIHdoaXRlc3BhY2UgdW50aWwgdGhlIGZpcnN0IHBhcmFtZXRlci5cbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzQmxvY2tQYXJhbWV0ZXJDaGFyKTtcblxuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kUlBBUkVOICYmIHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRFT0YpIHtcbiAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkJMT0NLX1BBUkFNRVRFUik7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgbGV0IGluUXVvdGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICAgICAgbGV0IG9wZW5QYXJlbnMgPSAwO1xuXG4gICAgICAvLyBDb25zdW1lIHRoZSBwYXJhbWV0ZXIgdW50aWwgdGhlIG5leHQgc2VtaWNvbG9uIG9yIGJyYWNlLlxuICAgICAgLy8gTm90ZSB0aGF0IHdlIHNraXAgb3ZlciBzZW1pY29sb25zL2JyYWNlcyBpbnNpZGUgb2Ygc3RyaW5ncy5cbiAgICAgIHdoaWxlIChcbiAgICAgICAgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRTRU1JQ09MT04gJiYgdGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJEVPRikgfHxcbiAgICAgICAgaW5RdW90ZSAhPT0gbnVsbFxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSB0aGlzLl9jdXJzb3IucGVlaygpO1xuXG4gICAgICAgIC8vIFNraXAgdG8gdGhlIG5leHQgY2hhcmFjdGVyIGlmIGl0IHdhcyBlc2NhcGVkLlxuICAgICAgICBpZiAoY2hhciA9PT0gY2hhcnMuJEJBQ0tTTEFTSCkge1xuICAgICAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gaW5RdW90ZSkge1xuICAgICAgICAgIGluUXVvdGUgPSBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKGluUXVvdGUgPT09IG51bGwgJiYgY2hhcnMuaXNRdW90ZShjaGFyKSkge1xuICAgICAgICAgIGluUXVvdGUgPSBjaGFyO1xuICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IGNoYXJzLiRMUEFSRU4gJiYgaW5RdW90ZSA9PT0gbnVsbCkge1xuICAgICAgICAgIG9wZW5QYXJlbnMrKztcbiAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBjaGFycy4kUlBBUkVOICYmIGluUXVvdGUgPT09IG51bGwpIHtcbiAgICAgICAgICBpZiAob3BlblBhcmVucyA9PT0gMCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChvcGVuUGFyZW5zID4gMCkge1xuICAgICAgICAgICAgb3BlblBhcmVucy0tO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMoc3RhcnQpXSk7XG5cbiAgICAgIC8vIFNraXAgdG8gdGhlIG5leHQgcGFyYW1ldGVyLlxuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc0Jsb2NrUGFyYW1ldGVyQ2hhcik7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUxldERlY2xhcmF0aW9uKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5MRVRfU1RBUlQsIHN0YXJ0KTtcblxuICAgIC8vIFJlcXVpcmUgYXQgbGVhc3Qgb25lIHdoaXRlIHNwYWNlIGFmdGVyIHRoZSBgQGxldGAuXG4gICAgaWYgKGNoYXJzLmlzV2hpdGVzcGFjZSh0aGlzLl9jdXJzb3IucGVlaygpKSkge1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0b2tlbiA9IHRoaXMuX2VuZFRva2VuKFt0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMoc3RhcnQpXSk7XG4gICAgICB0b2tlbi50eXBlID0gVG9rZW5UeXBlLklOQ09NUExFVEVfTEVUO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXJ0VG9rZW4gPSB0aGlzLl9lbmRUb2tlbihbdGhpcy5fZ2V0TGV0RGVjbGFyYXRpb25OYW1lKCldKTtcblxuICAgIC8vIFNraXAgb3ZlciB3aGl0ZSBzcGFjZSBiZWZvcmUgdGhlIGVxdWFscyBjaGFyYWN0ZXIuXG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuXG4gICAgLy8gRXhwZWN0IGFuIGVxdWFscyBzaWduLlxuICAgIGlmICghdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRFUSkpIHtcbiAgICAgIHN0YXJ0VG9rZW4udHlwZSA9IFRva2VuVHlwZS5JTkNPTVBMRVRFX0xFVDtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTa2lwIHNwYWNlcyBhZnRlciB0aGUgZXF1YWxzLlxuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oKGNvZGUpID0+IGlzTm90V2hpdGVzcGFjZShjb2RlKSAmJiAhY2hhcnMuaXNOZXdMaW5lKGNvZGUpKTtcbiAgICB0aGlzLl9jb25zdW1lTGV0RGVjbGFyYXRpb25WYWx1ZSgpO1xuXG4gICAgLy8gVGVybWluYXRlIHRoZSBgQGxldGAgd2l0aCBhIHNlbWljb2xvbi5cbiAgICBjb25zdCBlbmRDaGFyID0gdGhpcy5fY3Vyc29yLnBlZWsoKTtcbiAgICBpZiAoZW5kQ2hhciA9PT0gY2hhcnMuJFNFTUlDT0xPTikge1xuICAgICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuTEVUX0VORCk7XG4gICAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGFydFRva2VuLnR5cGUgPSBUb2tlblR5cGUuSU5DT01QTEVURV9MRVQ7XG4gICAgICBzdGFydFRva2VuLnNvdXJjZVNwYW4gPSB0aGlzLl9jdXJzb3IuZ2V0U3BhbihzdGFydCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0TGV0RGVjbGFyYXRpb25OYW1lKCk6IHN0cmluZyB7XG4gICAgY29uc3QgbmFtZUN1cnNvciA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIGxldCBhbGxvd0RpZ2l0ID0gZmFsc2U7XG5cbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKChjb2RlKSA9PiB7XG4gICAgICBpZiAoXG4gICAgICAgIGNoYXJzLmlzQXNjaWlMZXR0ZXIoY29kZSkgfHxcbiAgICAgICAgY29kZSA9PT0gY2hhcnMuJCQgfHxcbiAgICAgICAgY29kZSA9PT0gY2hhcnMuJF8gfHxcbiAgICAgICAgLy8gYEBsZXRgIG5hbWVzIGNhbid0IHN0YXJ0IHdpdGggYSBkaWdpdCwgYnV0IGRpZ2l0cyBhcmUgdmFsaWQgYW55d2hlcmUgZWxzZSBpbiB0aGUgbmFtZS5cbiAgICAgICAgKGFsbG93RGlnaXQgJiYgY2hhcnMuaXNEaWdpdChjb2RlKSlcbiAgICAgICkge1xuICAgICAgICBhbGxvd0RpZ2l0ID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVDdXJzb3IpLnRyaW0oKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVMZXREZWNsYXJhdGlvblZhbHVlKCk6IHZvaWQge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuTEVUX1ZBTFVFLCBzdGFydCk7XG5cbiAgICB3aGlsZSAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJEVPRikge1xuICAgICAgY29uc3QgY2hhciA9IHRoaXMuX2N1cnNvci5wZWVrKCk7XG5cbiAgICAgIC8vIGBAbGV0YCBkZWNsYXJhdGlvbnMgdGVybWluYXRlIHdpdGggYSBzZW1pY29sb24uXG4gICAgICBpZiAoY2hhciA9PT0gY2hhcnMuJFNFTUlDT0xPTikge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gSWYgd2UgaGl0IGEgcXVvdGUsIHNraXAgb3ZlciBpdHMgY29udGVudCBzaW5jZSB3ZSBkb24ndCBjYXJlIHdoYXQncyBpbnNpZGUuXG4gICAgICBpZiAoY2hhcnMuaXNRdW90ZShjaGFyKSkge1xuICAgICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKChpbm5lcikgPT4ge1xuICAgICAgICAgIGlmIChpbm5lciA9PT0gY2hhcnMuJEJBQ0tTTEFTSCkge1xuICAgICAgICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGlubmVyID09PSBjaGFyO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9lbmRUb2tlbihbdGhpcy5fY3Vyc29yLmdldENoYXJzKHN0YXJ0KV0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHdoZXRoZXIgYW4gSUNVIHRva2VuIGhhcyBiZWVuIGNyZWF0ZWRcbiAgICogQGludGVybmFsXG4gICAqL1xuICBwcml2YXRlIF90b2tlbml6ZUV4cGFuc2lvbkZvcm0oKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuaXNFeHBhbnNpb25Gb3JtU3RhcnQoKSkge1xuICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbkZvcm1TdGFydCgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGlzRXhwYW5zaW9uQ2FzZVN0YXJ0KHRoaXMuX2N1cnNvci5wZWVrKCkpICYmIHRoaXMuX2lzSW5FeHBhbnNpb25Gb3JtKCkpIHtcbiAgICAgIHRoaXMuX2NvbnN1bWVFeHBhbnNpb25DYXNlU3RhcnQoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kUkJSQUNFKSB7XG4gICAgICBpZiAodGhpcy5faXNJbkV4cGFuc2lvbkNhc2UoKSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uQ2FzZUVuZCgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2lzSW5FeHBhbnNpb25Gb3JtKCkpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbkZvcm1FbmQoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfYmVnaW5Ub2tlbih0eXBlOiBUb2tlblR5cGUsIHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCkpIHtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5TdGFydCA9IHN0YXJ0O1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUgPSB0eXBlO1xuICB9XG5cbiAgcHJpdmF0ZSBfZW5kVG9rZW4ocGFydHM6IHN0cmluZ1tdLCBlbmQ/OiBDaGFyYWN0ZXJDdXJzb3IpOiBUb2tlbiB7XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgVG9rZW5FcnJvcihcbiAgICAgICAgJ1Byb2dyYW1taW5nIGVycm9yIC0gYXR0ZW1wdGVkIHRvIGVuZCBhIHRva2VuIHdoZW4gdGhlcmUgd2FzIG5vIHN0YXJ0IHRvIHRoZSB0b2tlbicsXG4gICAgICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUsXG4gICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKGVuZCksXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodGhpcy5fY3VycmVudFRva2VuVHlwZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAgICdQcm9ncmFtbWluZyBlcnJvciAtIGF0dGVtcHRlZCB0byBlbmQgYSB0b2tlbiB3aGljaCBoYXMgbm8gdG9rZW4gdHlwZScsXG4gICAgICAgIG51bGwsXG4gICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0KSxcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuID0ge1xuICAgICAgdHlwZTogdGhpcy5fY3VycmVudFRva2VuVHlwZSxcbiAgICAgIHBhcnRzLFxuICAgICAgc291cmNlU3BhbjogKGVuZCA/PyB0aGlzLl9jdXJzb3IpLmdldFNwYW4oXG4gICAgICAgIHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0LFxuICAgICAgICB0aGlzLl9sZWFkaW5nVHJpdmlhQ29kZVBvaW50cyxcbiAgICAgICksXG4gICAgfSBhcyBUb2tlbjtcbiAgICB0aGlzLnRva2Vucy5wdXNoKHRva2VuKTtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5TdGFydCA9IG51bGw7XG4gICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSA9IG51bGw7XG4gICAgcmV0dXJuIHRva2VuO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRXJyb3IobXNnOiBzdHJpbmcsIHNwYW46IFBhcnNlU291cmNlU3Bhbik6IF9Db250cm9sRmxvd0Vycm9yIHtcbiAgICBpZiAodGhpcy5faXNJbkV4cGFuc2lvbkZvcm0oKSkge1xuICAgICAgbXNnICs9IGAgKERvIHlvdSBoYXZlIGFuIHVuZXNjYXBlZCBcIntcIiBpbiB5b3VyIHRlbXBsYXRlPyBVc2UgXCJ7eyAneycgfX1cIikgdG8gZXNjYXBlIGl0LilgO1xuICAgIH1cbiAgICBjb25zdCBlcnJvciA9IG5ldyBUb2tlbkVycm9yKG1zZywgdGhpcy5fY3VycmVudFRva2VuVHlwZSwgc3Bhbik7XG4gICAgdGhpcy5fY3VycmVudFRva2VuU3RhcnQgPSBudWxsO1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUgPSBudWxsO1xuICAgIHJldHVybiBuZXcgX0NvbnRyb2xGbG93RXJyb3IoZXJyb3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVFcnJvcihlOiBhbnkpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIEN1cnNvckVycm9yKSB7XG4gICAgICBlID0gdGhpcy5fY3JlYXRlRXJyb3IoZS5tc2csIHRoaXMuX2N1cnNvci5nZXRTcGFuKGUuY3Vyc29yKSk7XG4gICAgfVxuICAgIGlmIChlIGluc3RhbmNlb2YgX0NvbnRyb2xGbG93RXJyb3IpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goZS5lcnJvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdENoYXJDb2RlKGNoYXJDb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhckNvZGUpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdENoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKGNoYXJDb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAoY29tcGFyZUNoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKHRoaXMuX2N1cnNvci5wZWVrKCksIGNoYXJDb2RlKSkge1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9yZXF1aXJlQ2hhckNvZGUoY2hhckNvZGU6IG51bWJlcikge1xuICAgIGNvbnN0IGxvY2F0aW9uID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhckNvZGUpKSB7XG4gICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSxcbiAgICAgICAgdGhpcy5fY3Vyc29yLmdldFNwYW4obG9jYXRpb24pLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0U3RyKGNoYXJzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBsZW4gPSBjaGFycy5sZW5ndGg7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5jaGFyc0xlZnQoKSA8IGxlbikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBpbml0aWFsUG9zaXRpb24gPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy5jaGFyQ29kZUF0KGkpKSkge1xuICAgICAgICAvLyBJZiBhdHRlbXB0aW5nIHRvIHBhcnNlIHRoZSBzdHJpbmcgZmFpbHMsIHdlIHdhbnQgdG8gcmVzZXQgdGhlIHBhcnNlclxuICAgICAgICAvLyB0byB3aGVyZSBpdCB3YXMgYmVmb3JlIHRoZSBhdHRlbXB0XG4gICAgICAgIHRoaXMuX2N1cnNvciA9IGluaXRpYWxQb3NpdGlvbjtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgX2F0dGVtcHRTdHJDYXNlSW5zZW5zaXRpdmUoY2hhcnM6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hhcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdENoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKGNoYXJzLmNoYXJDb2RlQXQoaSkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwcml2YXRlIF9yZXF1aXJlU3RyKGNoYXJzOiBzdHJpbmcpIHtcbiAgICBjb25zdCBsb2NhdGlvbiA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIGlmICghdGhpcy5fYXR0ZW1wdFN0cihjaGFycykpIHtcbiAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKHRoaXMuX2N1cnNvci5wZWVrKCkpLFxuICAgICAgICB0aGlzLl9jdXJzb3IuZ2V0U3Bhbihsb2NhdGlvbiksXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4ocHJlZGljYXRlOiAoY29kZTogbnVtYmVyKSA9PiBib29sZWFuKSB7XG4gICAgd2hpbGUgKCFwcmVkaWNhdGUodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVxdWlyZUNoYXJDb2RlVW50aWxGbihwcmVkaWNhdGU6IChjb2RlOiBudW1iZXIpID0+IGJvb2xlYW4sIGxlbjogbnVtYmVyKSB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKHByZWRpY2F0ZSk7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5kaWZmKHN0YXJ0KSA8IGxlbikge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgIF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2codGhpcy5fY3Vyc29yLnBlZWsoKSksXG4gICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKHN0YXJ0KSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdFVudGlsQ2hhcihjaGFyOiBudW1iZXIpIHtcbiAgICB3aGlsZSAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcikge1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9yZWFkQ2hhcigpOiBzdHJpbmcge1xuICAgIC8vIERvbid0IHJlbHkgdXBvbiByZWFkaW5nIGRpcmVjdGx5IGZyb20gYF9pbnB1dGAgYXMgdGhlIGFjdHVhbCBjaGFyIHZhbHVlXG4gICAgLy8gbWF5IGhhdmUgYmVlbiBnZW5lcmF0ZWQgZnJvbSBhbiBlc2NhcGUgc2VxdWVuY2UuXG4gICAgY29uc3QgY2hhciA9IFN0cmluZy5mcm9tQ29kZVBvaW50KHRoaXMuX2N1cnNvci5wZWVrKCkpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIGNoYXI7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRW50aXR5KHRleHRUb2tlblR5cGU6IFRva2VuVHlwZSk6IHZvaWQge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVOQ09ERURfRU5USVRZKTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kSEFTSCkpIHtcbiAgICAgIGNvbnN0IGlzSGV4ID0gdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiR4KSB8fCB0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFgpO1xuICAgICAgY29uc3QgY29kZVN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzRGlnaXRFbnRpdHlFbmQpO1xuICAgICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT0gY2hhcnMuJFNFTUlDT0xPTikge1xuICAgICAgICAvLyBBZHZhbmNlIGN1cnNvciB0byBpbmNsdWRlIHRoZSBwZWVrZWQgY2hhcmFjdGVyIGluIHRoZSBzdHJpbmcgcHJvdmlkZWQgdG8gdGhlIGVycm9yXG4gICAgICAgIC8vIG1lc3NhZ2UuXG4gICAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICAgIGNvbnN0IGVudGl0eVR5cGUgPSBpc0hleCA/IENoYXJhY3RlclJlZmVyZW5jZVR5cGUuSEVYIDogQ2hhcmFjdGVyUmVmZXJlbmNlVHlwZS5ERUM7XG4gICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICAgIF91bnBhcnNhYmxlRW50aXR5RXJyb3JNc2coZW50aXR5VHlwZSwgdGhpcy5fY3Vyc29yLmdldENoYXJzKHN0YXJ0KSksXG4gICAgICAgICAgdGhpcy5fY3Vyc29yLmdldFNwYW4oKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0ck51bSA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhjb2RlU3RhcnQpO1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNoYXJDb2RlID0gcGFyc2VJbnQoc3RyTnVtLCBpc0hleCA/IDE2IDogMTApO1xuICAgICAgICB0aGlzLl9lbmRUb2tlbihbU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSksIHRoaXMuX2N1cnNvci5nZXRDaGFycyhzdGFydCldKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgICAgICBfdW5rbm93bkVudGl0eUVycm9yTXNnKHRoaXMuX2N1cnNvci5nZXRDaGFycyhzdGFydCkpLFxuICAgICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKCksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5hbWVTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05hbWVkRW50aXR5RW5kKTtcbiAgICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpICE9IGNoYXJzLiRTRU1JQ09MT04pIHtcbiAgICAgICAgLy8gTm8gc2VtaWNvbG9uIHdhcyBmb3VuZCBzbyBhYm9ydCB0aGUgZW5jb2RlZCBlbnRpdHkgdG9rZW4gdGhhdCB3YXMgaW4gcHJvZ3Jlc3MsIGFuZCB0cmVhdFxuICAgICAgICAvLyB0aGlzIGFzIGEgdGV4dCB0b2tlblxuICAgICAgICB0aGlzLl9iZWdpblRva2VuKHRleHRUb2tlblR5cGUsIHN0YXJ0KTtcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gbmFtZVN0YXJ0O1xuICAgICAgICB0aGlzLl9lbmRUb2tlbihbJyYnXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVTdGFydCk7XG4gICAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICAgIGNvbnN0IGNoYXIgPSBOQU1FRF9FTlRJVElFU1tuYW1lXTtcbiAgICAgICAgaWYgKCFjaGFyKSB7XG4gICAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoX3Vua25vd25FbnRpdHlFcnJvck1zZyhuYW1lKSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oc3RhcnQpKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbmRUb2tlbihbY2hhciwgYCYke25hbWV9O2BdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lUmF3VGV4dChjb25zdW1lRW50aXRpZXM6IGJvb2xlYW4sIGVuZE1hcmtlclByZWRpY2F0ZTogKCkgPT4gYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oY29uc3VtZUVudGl0aWVzID8gVG9rZW5UeXBlLkVTQ0FQQUJMRV9SQVdfVEVYVCA6IFRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHRhZ0Nsb3NlU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIGNvbnN0IGZvdW5kRW5kTWFya2VyID0gZW5kTWFya2VyUHJlZGljYXRlKCk7XG4gICAgICB0aGlzLl9jdXJzb3IgPSB0YWdDbG9zZVN0YXJ0O1xuICAgICAgaWYgKGZvdW5kRW5kTWFya2VyKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGNvbnN1bWVFbnRpdGllcyAmJiB0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kQU1QRVJTQU5EKSB7XG4gICAgICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKHBhcnRzLmpvaW4oJycpKV0pO1xuICAgICAgICBwYXJ0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9jb25zdW1lRW50aXR5KFRva2VuVHlwZS5FU0NBUEFCTEVfUkFXX1RFWFQpO1xuICAgICAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FU0NBUEFCTEVfUkFXX1RFWFQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFydHMucHVzaCh0aGlzLl9yZWFkQ2hhcigpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fZW5kVG9rZW4oW3RoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnMocGFydHMuam9pbignJykpXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ29tbWVudChzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ09NTUVOVF9TVEFSVCwgc3RhcnQpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kTUlOVVMpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgICB0aGlzLl9jb25zdW1lUmF3VGV4dChmYWxzZSwgKCkgPT4gdGhpcy5fYXR0ZW1wdFN0cignLS0+JykpO1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkNPTU1FTlRfRU5EKTtcbiAgICB0aGlzLl9yZXF1aXJlU3RyKCctLT4nKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ2RhdGEoc3RhcnQ6IENoYXJhY3RlckN1cnNvcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkNEQVRBX1NUQVJULCBzdGFydCk7XG4gICAgdGhpcy5fcmVxdWlyZVN0cignQ0RBVEFbJyk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0KGZhbHNlLCAoKSA9PiB0aGlzLl9hdHRlbXB0U3RyKCddXT4nKSk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ0RBVEFfRU5EKTtcbiAgICB0aGlzLl9yZXF1aXJlU3RyKCddXT4nKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRG9jVHlwZShzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRE9DX1RZUEUsIHN0YXJ0KTtcbiAgICBjb25zdCBjb250ZW50U3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0VW50aWxDaGFyKGNoYXJzLiRHVCk7XG4gICAgY29uc3QgY29udGVudCA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhjb250ZW50U3RhcnQpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW2NvbnRlbnRdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVQcmVmaXhBbmROYW1lKCk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBuYW1lT3JQcmVmaXhTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIGxldCBwcmVmaXg6IHN0cmluZyA9ICcnO1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kQ09MT04gJiYgIWlzUHJlZml4RW5kKHRoaXMuX2N1cnNvci5wZWVrKCkpKSB7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgICBsZXQgbmFtZVN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3I7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRDT0xPTikge1xuICAgICAgcHJlZml4ID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVPclByZWZpeFN0YXJ0KTtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICBuYW1lU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZVN0YXJ0ID0gbmFtZU9yUHJlZml4U3RhcnQ7XG4gICAgfVxuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZVVudGlsRm4oaXNOYW1lRW5kLCBwcmVmaXggPT09ICcnID8gMCA6IDEpO1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMobmFtZVN0YXJ0KTtcbiAgICByZXR1cm4gW3ByZWZpeCwgbmFtZV07XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGFnT3BlbihzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgbGV0IHRhZ05hbWU6IHN0cmluZztcbiAgICBsZXQgcHJlZml4OiBzdHJpbmc7XG4gICAgbGV0IG9wZW5UYWdUb2tlbjogVGFnT3BlblN0YXJ0VG9rZW4gfCBJbmNvbXBsZXRlVGFnT3BlblRva2VuIHwgdW5kZWZpbmVkO1xuICAgIHRyeSB7XG4gICAgICBpZiAoIWNoYXJzLmlzQXNjaWlMZXR0ZXIodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSxcbiAgICAgICAgICB0aGlzLl9jdXJzb3IuZ2V0U3BhbihzdGFydCksXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIG9wZW5UYWdUb2tlbiA9IHRoaXMuX2NvbnN1bWVUYWdPcGVuU3RhcnQoc3RhcnQpO1xuICAgICAgcHJlZml4ID0gb3BlblRhZ1Rva2VuLnBhcnRzWzBdO1xuICAgICAgdGFnTmFtZSA9IG9wZW5UYWdUb2tlbi5wYXJ0c1sxXTtcbiAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgIHdoaWxlIChcbiAgICAgICAgdGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJFNMQVNIICYmXG4gICAgICAgIHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRHVCAmJlxuICAgICAgICB0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kTFQgJiZcbiAgICAgICAgdGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJEVPRlxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVBdHRyaWJ1dGVOYW1lKCk7XG4gICAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kRVEpKSB7XG4gICAgICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgICAgIHRoaXMuX2NvbnN1bWVBdHRyaWJ1dGVWYWx1ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NvbnN1bWVUYWdPcGVuRW5kKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBfQ29udHJvbEZsb3dFcnJvcikge1xuICAgICAgICBpZiAob3BlblRhZ1Rva2VuKSB7XG4gICAgICAgICAgLy8gV2UgZXJyb3JlZCBiZWZvcmUgd2UgY291bGQgY2xvc2UgdGhlIG9wZW5pbmcgdGFnLCBzbyBpdCBpcyBpbmNvbXBsZXRlLlxuICAgICAgICAgIG9wZW5UYWdUb2tlbi50eXBlID0gVG9rZW5UeXBlLklOQ09NUExFVEVfVEFHX09QRU47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gV2hlbiB0aGUgc3RhcnQgdGFnIGlzIGludmFsaWQsIGFzc3VtZSB3ZSB3YW50IGEgXCI8XCIgYXMgdGV4dC5cbiAgICAgICAgICAvLyBCYWNrIHRvIGJhY2sgdGV4dCB0b2tlbnMgYXJlIG1lcmdlZCBhdCB0aGUgZW5kLlxuICAgICAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRFWFQsIHN0YXJ0KTtcbiAgICAgICAgICB0aGlzLl9lbmRUb2tlbihbJzwnXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRUb2tlblR5cGUgPSB0aGlzLl9nZXRUYWdEZWZpbml0aW9uKHRhZ05hbWUpLmdldENvbnRlbnRUeXBlKHByZWZpeCk7XG5cbiAgICBpZiAoY29udGVudFRva2VuVHlwZSA9PT0gVGFnQ29udGVudFR5cGUuUkFXX1RFWFQpIHtcbiAgICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0V2l0aFRhZ0Nsb3NlKHByZWZpeCwgdGFnTmFtZSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY29udGVudFRva2VuVHlwZSA9PT0gVGFnQ29udGVudFR5cGUuRVNDQVBBQkxFX1JBV19URVhUKSB7XG4gICAgICB0aGlzLl9jb25zdW1lUmF3VGV4dFdpdGhUYWdDbG9zZShwcmVmaXgsIHRhZ05hbWUsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVSYXdUZXh0V2l0aFRhZ0Nsb3NlKHByZWZpeDogc3RyaW5nLCB0YWdOYW1lOiBzdHJpbmcsIGNvbnN1bWVFbnRpdGllczogYm9vbGVhbikge1xuICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0KGNvbnN1bWVFbnRpdGllcywgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJExUKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFNMQVNIKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0U3RyQ2FzZUluc2Vuc2l0aXZlKHRhZ05hbWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRHVCk7XG4gICAgfSk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuVEFHX0NMT1NFKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGVVbnRpbEZuKChjb2RlKSA9PiBjb2RlID09PSBjaGFycy4kR1QsIDMpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7IC8vIENvbnN1bWUgdGhlIGA+YFxuICAgIHRoaXMuX2VuZFRva2VuKFtwcmVmaXgsIHRhZ05hbWVdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUYWdPcGVuU3RhcnQoc3RhcnQ6IENoYXJhY3RlckN1cnNvcik6IFRhZ09wZW5TdGFydFRva2VuIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5UQUdfT1BFTl9TVEFSVCwgc3RhcnQpO1xuICAgIGNvbnN0IHBhcnRzID0gdGhpcy5fY29uc3VtZVByZWZpeEFuZE5hbWUoKTtcbiAgICByZXR1cm4gdGhpcy5fZW5kVG9rZW4ocGFydHMpIGFzIFRhZ09wZW5TdGFydFRva2VuO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHJpYnV0ZU5hbWUoKSB7XG4gICAgY29uc3QgYXR0ck5hbWVTdGFydCA9IHRoaXMuX2N1cnNvci5wZWVrKCk7XG4gICAgaWYgKGF0dHJOYW1lU3RhcnQgPT09IGNoYXJzLiRTUSB8fCBhdHRyTmFtZVN0YXJ0ID09PSBjaGFycy4kRFEpIHtcbiAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2coYXR0ck5hbWVTdGFydCksIHRoaXMuX2N1cnNvci5nZXRTcGFuKCkpO1xuICAgIH1cbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5BVFRSX05BTUUpO1xuICAgIGNvbnN0IHByZWZpeEFuZE5hbWUgPSB0aGlzLl9jb25zdW1lUHJlZml4QW5kTmFtZSgpO1xuICAgIHRoaXMuX2VuZFRva2VuKHByZWZpeEFuZE5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHJpYnV0ZVZhbHVlKCkge1xuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kU1EgfHwgdGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJERRKSB7XG4gICAgICBjb25zdCBxdW90ZUNoYXIgPSB0aGlzLl9jdXJzb3IucGVlaygpO1xuICAgICAgdGhpcy5fY29uc3VtZVF1b3RlKHF1b3RlQ2hhcik7XG4gICAgICAvLyBJbiBhbiBhdHRyaWJ1dGUgdGhlbiBlbmQgb2YgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBhbmQgdGhlIHByZW1hdHVyZSBlbmQgdG8gYW4gaW50ZXJwb2xhdGlvblxuICAgICAgLy8gYXJlIGJvdGggdHJpZ2dlcmVkIGJ5IHRoZSBgcXVvdGVDaGFyYC5cbiAgICAgIGNvbnN0IGVuZFByZWRpY2F0ZSA9ICgpID0+IHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IHF1b3RlQ2hhcjtcbiAgICAgIHRoaXMuX2NvbnN1bWVXaXRoSW50ZXJwb2xhdGlvbihcbiAgICAgICAgVG9rZW5UeXBlLkFUVFJfVkFMVUVfVEVYVCxcbiAgICAgICAgVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTixcbiAgICAgICAgZW5kUHJlZGljYXRlLFxuICAgICAgICBlbmRQcmVkaWNhdGUsXG4gICAgICApO1xuICAgICAgdGhpcy5fY29uc3VtZVF1b3RlKHF1b3RlQ2hhcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGVuZFByZWRpY2F0ZSA9ICgpID0+IGlzTmFtZUVuZCh0aGlzLl9jdXJzb3IucGVlaygpKTtcbiAgICAgIHRoaXMuX2NvbnN1bWVXaXRoSW50ZXJwb2xhdGlvbihcbiAgICAgICAgVG9rZW5UeXBlLkFUVFJfVkFMVUVfVEVYVCxcbiAgICAgICAgVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTixcbiAgICAgICAgZW5kUHJlZGljYXRlLFxuICAgICAgICBlbmRQcmVkaWNhdGUsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVRdW90ZShxdW90ZUNoYXI6IG51bWJlcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkFUVFJfUVVPVEUpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShxdW90ZUNoYXIpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtTdHJpbmcuZnJvbUNvZGVQb2ludChxdW90ZUNoYXIpXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGFnT3BlbkVuZCgpIHtcbiAgICBjb25zdCB0b2tlblR5cGUgPSB0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFNMQVNIKVxuICAgICAgPyBUb2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSURcbiAgICAgIDogVG9rZW5UeXBlLlRBR19PUEVOX0VORDtcbiAgICB0aGlzLl9iZWdpblRva2VuKHRva2VuVHlwZSk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRHVCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVRhZ0Nsb3NlKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5UQUdfQ0xPU0UsIHN0YXJ0KTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgY29uc3QgcHJlZml4QW5kTmFtZSA9IHRoaXMuX2NvbnN1bWVQcmVmaXhBbmROYW1lKCk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kR1QpO1xuICAgIHRoaXMuX2VuZFRva2VuKHByZWZpeEFuZE5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbkZvcm1TdGFydCgpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRMQlJBQ0UpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wdXNoKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCk7XG5cbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgY29uc3QgY29uZGl0aW9uID0gdGhpcy5fcmVhZFVudGlsKGNoYXJzLiRDT01NQSk7XG4gICAgY29uc3Qgbm9ybWFsaXplZENvbmRpdGlvbiA9IHRoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnMoY29uZGl0aW9uKTtcbiAgICBpZiAodGhpcy5faTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzKSB7XG4gICAgICAvLyBXZSBleHBsaWNpdGx5IHdhbnQgdG8gbm9ybWFsaXplIGxpbmUgZW5kaW5ncyBmb3IgdGhpcyB0ZXh0LlxuICAgICAgdGhpcy5fZW5kVG9rZW4oW25vcm1hbGl6ZWRDb25kaXRpb25dKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2UgYXJlIG5vdCBub3JtYWxpemluZyBsaW5lIGVuZGluZ3MuXG4gICAgICBjb25zdCBjb25kaXRpb25Ub2tlbiA9IHRoaXMuX2VuZFRva2VuKFtjb25kaXRpb25dKTtcbiAgICAgIGlmIChub3JtYWxpemVkQ29uZGl0aW9uICE9PSBjb25kaXRpb24pIHtcbiAgICAgICAgdGhpcy5ub25Ob3JtYWxpemVkSWN1RXhwcmVzc2lvbnMucHVzaChjb25kaXRpb25Ub2tlbik7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kQ09NTUEpO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlJBV19URVhUKTtcbiAgICBjb25zdCB0eXBlID0gdGhpcy5fcmVhZFVudGlsKGNoYXJzLiRDT01NQSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW3R5cGVdKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJENPTU1BKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uQ2FzZVN0YXJ0KCkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX1ZBTFVFKTtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuX3JlYWRVbnRpbChjaGFycy4kTEJSQUNFKS50cmltKCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW3ZhbHVlXSk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuXG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJExCUkFDRSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wdXNoKFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbkNhc2VFbmQoKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX0VORCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRSQlJBQ0UpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG5cbiAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2sucG9wKCk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uRm9ybUVuZCgpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9FTkQpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kUkJSQUNFKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG5cbiAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2sucG9wKCk7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3VtZSBhIHN0cmluZyB0aGF0IG1heSBjb250YWluIGludGVycG9sYXRpb24gZXhwcmVzc2lvbnMuXG4gICAqXG4gICAqIFRoZSBmaXJzdCB0b2tlbiBjb25zdW1lZCB3aWxsIGJlIG9mIGB0b2tlblR5cGVgIGFuZCB0aGVuIHRoZXJlIHdpbGwgYmUgYWx0ZXJuYXRpbmdcbiAgICogYGludGVycG9sYXRpb25Ub2tlblR5cGVgIGFuZCBgdG9rZW5UeXBlYCB0b2tlbnMgdW50aWwgdGhlIGBlbmRQcmVkaWNhdGUoKWAgcmV0dXJucyB0cnVlLlxuICAgKlxuICAgKiBJZiBhbiBpbnRlcnBvbGF0aW9uIHRva2VuIGVuZHMgcHJlbWF0dXJlbHkgaXQgd2lsbCBoYXZlIG5vIGVuZCBtYXJrZXIgaW4gaXRzIGBwYXJ0c2AgYXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSB0ZXh0VG9rZW5UeXBlIHRoZSBraW5kIG9mIHRva2VucyB0byBpbnRlcmxlYXZlIGFyb3VuZCBpbnRlcnBvbGF0aW9uIHRva2Vucy5cbiAgICogQHBhcmFtIGludGVycG9sYXRpb25Ub2tlblR5cGUgdGhlIGtpbmQgb2YgdG9rZW5zIHRoYXQgY29udGFpbiBpbnRlcnBvbGF0aW9uLlxuICAgKiBAcGFyYW0gZW5kUHJlZGljYXRlIGEgZnVuY3Rpb24gdGhhdCBzaG91bGQgcmV0dXJuIHRydWUgd2hlbiB3ZSBzaG91bGQgc3RvcCBjb25zdW1pbmcuXG4gICAqIEBwYXJhbSBlbmRJbnRlcnBvbGF0aW9uIGEgZnVuY3Rpb24gdGhhdCBzaG91bGQgcmV0dXJuIHRydWUgaWYgdGhlcmUgaXMgYSBwcmVtYXR1cmUgZW5kIHRvIGFuXG4gICAqICAgICBpbnRlcnBvbGF0aW9uIGV4cHJlc3Npb24gLSBpLmUuIGJlZm9yZSB3ZSBnZXQgdG8gdGhlIG5vcm1hbCBpbnRlcnBvbGF0aW9uIGNsb3NpbmcgbWFya2VyLlxuICAgKi9cbiAgcHJpdmF0ZSBfY29uc3VtZVdpdGhJbnRlcnBvbGF0aW9uKFxuICAgIHRleHRUb2tlblR5cGU6IFRva2VuVHlwZSxcbiAgICBpbnRlcnBvbGF0aW9uVG9rZW5UeXBlOiBUb2tlblR5cGUsXG4gICAgZW5kUHJlZGljYXRlOiAoKSA9PiBib29sZWFuLFxuICAgIGVuZEludGVycG9sYXRpb246ICgpID0+IGJvb2xlYW4sXG4gICkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4odGV4dFRva2VuVHlwZSk7XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG5cbiAgICB3aGlsZSAoIWVuZFByZWRpY2F0ZSgpKSB7XG4gICAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICBpZiAodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyAmJiB0aGlzLl9hdHRlbXB0U3RyKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcuc3RhcnQpKSB7XG4gICAgICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKHBhcnRzLmpvaW4oJycpKV0sIGN1cnJlbnQpO1xuICAgICAgICBwYXJ0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9jb25zdW1lSW50ZXJwb2xhdGlvbihpbnRlcnBvbGF0aW9uVG9rZW5UeXBlLCBjdXJyZW50LCBlbmRJbnRlcnBvbGF0aW9uKTtcbiAgICAgICAgdGhpcy5fYmVnaW5Ub2tlbih0ZXh0VG9rZW5UeXBlKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJEFNUEVSU0FORCkge1xuICAgICAgICB0aGlzLl9lbmRUb2tlbihbdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhwYXJ0cy5qb2luKCcnKSldKTtcbiAgICAgICAgcGFydHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fY29uc3VtZUVudGl0eSh0ZXh0VG9rZW5UeXBlKTtcbiAgICAgICAgdGhpcy5fYmVnaW5Ub2tlbih0ZXh0VG9rZW5UeXBlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5fcmVhZENoYXIoKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSXQgaXMgcG9zc2libGUgdGhhdCBhbiBpbnRlcnBvbGF0aW9uIHdhcyBzdGFydGVkIGJ1dCBub3QgZW5kZWQgaW5zaWRlIHRoaXMgdGV4dCB0b2tlbi5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCB3ZSByZXNldCB0aGUgc3RhdGUgb2YgdGhlIGxleGVyIGNvcnJlY3RseS5cbiAgICB0aGlzLl9pbkludGVycG9sYXRpb24gPSBmYWxzZTtcblxuICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKHBhcnRzLmpvaW4oJycpKV0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN1bWUgYSBibG9jayBvZiB0ZXh0IHRoYXQgaGFzIGJlZW4gaW50ZXJwcmV0ZWQgYXMgYW4gQW5ndWxhciBpbnRlcnBvbGF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gaW50ZXJwb2xhdGlvblRva2VuVHlwZSB0aGUgdHlwZSBvZiB0aGUgaW50ZXJwb2xhdGlvbiB0b2tlbiB0byBnZW5lcmF0ZS5cbiAgICogQHBhcmFtIGludGVycG9sYXRpb25TdGFydCBhIGN1cnNvciB0aGF0IHBvaW50cyB0byB0aGUgc3RhcnQgb2YgdGhpcyBpbnRlcnBvbGF0aW9uLlxuICAgKiBAcGFyYW0gcHJlbWF0dXJlRW5kUHJlZGljYXRlIGEgZnVuY3Rpb24gdGhhdCBzaG91bGQgcmV0dXJuIHRydWUgaWYgdGhlIG5leHQgY2hhcmFjdGVycyBpbmRpY2F0ZVxuICAgKiAgICAgYW4gZW5kIHRvIHRoZSBpbnRlcnBvbGF0aW9uIGJlZm9yZSBpdHMgbm9ybWFsIGNsb3NpbmcgbWFya2VyLlxuICAgKi9cbiAgcHJpdmF0ZSBfY29uc3VtZUludGVycG9sYXRpb24oXG4gICAgaW50ZXJwb2xhdGlvblRva2VuVHlwZTogVG9rZW5UeXBlLFxuICAgIGludGVycG9sYXRpb25TdGFydDogQ2hhcmFjdGVyQ3Vyc29yLFxuICAgIHByZW1hdHVyZUVuZFByZWRpY2F0ZTogKCgpID0+IGJvb2xlYW4pIHwgbnVsbCxcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihpbnRlcnBvbGF0aW9uVG9rZW5UeXBlLCBpbnRlcnBvbGF0aW9uU3RhcnQpO1xuICAgIHBhcnRzLnB1c2godGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydCk7XG5cbiAgICAvLyBGaW5kIHRoZSBlbmQgb2YgdGhlIGludGVycG9sYXRpb24sIGlnbm9yaW5nIGNvbnRlbnQgaW5zaWRlIHF1b3Rlcy5cbiAgICBjb25zdCBleHByZXNzaW9uU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICBsZXQgaW5RdW90ZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGluQ29tbWVudCA9IGZhbHNlO1xuICAgIHdoaWxlIChcbiAgICAgIHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRFT0YgJiZcbiAgICAgIChwcmVtYXR1cmVFbmRQcmVkaWNhdGUgPT09IG51bGwgfHwgIXByZW1hdHVyZUVuZFByZWRpY2F0ZSgpKVxuICAgICkge1xuICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuXG4gICAgICBpZiAodGhpcy5faXNUYWdTdGFydCgpKSB7XG4gICAgICAgIC8vIFdlIGFyZSBzdGFydGluZyB3aGF0IGxvb2tzIGxpa2UgYW4gSFRNTCBlbGVtZW50IGluIHRoZSBtaWRkbGUgb2YgdGhpcyBpbnRlcnBvbGF0aW9uLlxuICAgICAgICAvLyBSZXNldCB0aGUgY3Vyc29yIHRvIGJlZm9yZSB0aGUgYDxgIGNoYXJhY3RlciBhbmQgZW5kIHRoZSBpbnRlcnBvbGF0aW9uIHRva2VuLlxuICAgICAgICAvLyAoVGhpcyBpcyBhY3R1YWxseSB3cm9uZyBidXQgaGVyZSBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSkuXG4gICAgICAgIHRoaXMuX2N1cnNvciA9IGN1cnJlbnQ7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5fZ2V0UHJvY2Vzc2VkQ2hhcnMoZXhwcmVzc2lvblN0YXJ0LCBjdXJyZW50KSk7XG4gICAgICAgIHRoaXMuX2VuZFRva2VuKHBhcnRzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW5RdW90ZSA9PT0gbnVsbCkge1xuICAgICAgICBpZiAodGhpcy5fYXR0ZW1wdFN0cih0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnLmVuZCkpIHtcbiAgICAgICAgICAvLyBXZSBhcmUgbm90IGluIGEgc3RyaW5nLCBhbmQgd2UgaGl0IHRoZSBlbmQgaW50ZXJwb2xhdGlvbiBtYXJrZXJcbiAgICAgICAgICBwYXJ0cy5wdXNoKHRoaXMuX2dldFByb2Nlc3NlZENoYXJzKGV4cHJlc3Npb25TdGFydCwgY3VycmVudCkpO1xuICAgICAgICAgIHBhcnRzLnB1c2godGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQpO1xuICAgICAgICAgIHRoaXMuX2VuZFRva2VuKHBhcnRzKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXR0ZW1wdFN0cignLy8nKSkge1xuICAgICAgICAgIC8vIE9uY2Ugd2UgYXJlIGluIGEgY29tbWVudCB3ZSBpZ25vcmUgYW55IHF1b3Rlc1xuICAgICAgICAgIGluQ29tbWVudCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgY2hhciA9IHRoaXMuX2N1cnNvci5wZWVrKCk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgaWYgKGNoYXIgPT09IGNoYXJzLiRCQUNLU0xBU0gpIHtcbiAgICAgICAgLy8gU2tpcCB0aGUgbmV4dCBjaGFyYWN0ZXIgYmVjYXVzZSBpdCB3YXMgZXNjYXBlZC5cbiAgICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gaW5RdW90ZSkge1xuICAgICAgICAvLyBFeGl0aW5nIHRoZSBjdXJyZW50IHF1b3RlZCBzdHJpbmdcbiAgICAgICAgaW5RdW90ZSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKCFpbkNvbW1lbnQgJiYgaW5RdW90ZSA9PT0gbnVsbCAmJiBjaGFycy5pc1F1b3RlKGNoYXIpKSB7XG4gICAgICAgIC8vIEVudGVyaW5nIGEgbmV3IHF1b3RlZCBzdHJpbmdcbiAgICAgICAgaW5RdW90ZSA9IGNoYXI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2UgaGl0IEVPRiB3aXRob3V0IGZpbmRpbmcgYSBjbG9zaW5nIGludGVycG9sYXRpb24gbWFya2VyXG4gICAgcGFydHMucHVzaCh0aGlzLl9nZXRQcm9jZXNzZWRDaGFycyhleHByZXNzaW9uU3RhcnQsIHRoaXMuX2N1cnNvcikpO1xuICAgIHRoaXMuX2VuZFRva2VuKHBhcnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFByb2Nlc3NlZENoYXJzKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IsIGVuZDogQ2hhcmFjdGVyQ3Vyc29yKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhlbmQuZ2V0Q2hhcnMoc3RhcnQpKTtcbiAgfVxuXG4gIHByaXZhdGUgX2lzVGV4dEVuZCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5faXNUYWdTdGFydCgpIHx8IHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRFT0YpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl90b2tlbml6ZUljdSAmJiAhdGhpcy5faW5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICBpZiAodGhpcy5pc0V4cGFuc2lvbkZvcm1TdGFydCgpKSB7XG4gICAgICAgIC8vIHN0YXJ0IG9mIGFuIGV4cGFuc2lvbiBmb3JtXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJFJCUkFDRSAmJiB0aGlzLl9pc0luRXhwYW5zaW9uQ2FzZSgpKSB7XG4gICAgICAgIC8vIGVuZCBvZiBhbmQgZXhwYW5zaW9uIGNhc2VcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdGhpcy5fdG9rZW5pemVCbG9ja3MgJiZcbiAgICAgICF0aGlzLl9pbkludGVycG9sYXRpb24gJiZcbiAgICAgICF0aGlzLl9pc0luRXhwYW5zaW9uKCkgJiZcbiAgICAgICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kQVQgfHwgdGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJFJCUkFDRSlcbiAgICApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGN1cnJlbnQgY3Vyc29yIGlzIHBvaW50aW5nIHRvIHRoZSBzdGFydCBvZiBhIHRhZ1xuICAgKiAob3BlbmluZy9jbG9zaW5nL2NvbW1lbnRzL2NkYXRhL2V0YykuXG4gICAqL1xuICBwcml2YXRlIF9pc1RhZ1N0YXJ0KCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kTFQpIHtcbiAgICAgIC8vIFdlIGFzc3VtZSB0aGF0IGA8YCBmb2xsb3dlZCBieSB3aGl0ZXNwYWNlIGlzIG5vdCB0aGUgc3RhcnQgb2YgYW4gSFRNTCBlbGVtZW50LlxuICAgICAgY29uc3QgdG1wID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICB0bXAuYWR2YW5jZSgpO1xuICAgICAgLy8gSWYgdGhlIG5leHQgY2hhcmFjdGVyIGlzIGFscGhhYmV0aWMsICEgbm9yIC8gdGhlbiBpdCBpcyBhIHRhZyBzdGFydFxuICAgICAgY29uc3QgY29kZSA9IHRtcC5wZWVrKCk7XG4gICAgICBpZiAoXG4gICAgICAgIChjaGFycy4kYSA8PSBjb2RlICYmIGNvZGUgPD0gY2hhcnMuJHopIHx8XG4gICAgICAgIChjaGFycy4kQSA8PSBjb2RlICYmIGNvZGUgPD0gY2hhcnMuJFopIHx8XG4gICAgICAgIGNvZGUgPT09IGNoYXJzLiRTTEFTSCB8fFxuICAgICAgICBjb2RlID09PSBjaGFycy4kQkFOR1xuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9yZWFkVW50aWwoY2hhcjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRoaXMuX2F0dGVtcHRVbnRpbENoYXIoY2hhcik7XG4gICAgcmV0dXJuIHRoaXMuX2N1cnNvci5nZXRDaGFycyhzdGFydCk7XG4gIH1cblxuICBwcml2YXRlIF9pc0luRXhwYW5zaW9uKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9pc0luRXhwYW5zaW9uQ2FzZSgpIHx8IHRoaXMuX2lzSW5FeHBhbnNpb25Gb3JtKCk7XG4gIH1cblxuICBwcml2YXRlIF9pc0luRXhwYW5zaW9uQ2FzZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLmxlbmd0aCA+IDAgJiZcbiAgICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFja1t0aGlzLl9leHBhbnNpb25DYXNlU3RhY2subGVuZ3RoIC0gMV0gPT09XG4gICAgICAgIFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlRcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfaXNJbkV4cGFuc2lvbkZvcm0oKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5sZW5ndGggPiAwICYmXG4gICAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2tbdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLmxlbmd0aCAtIDFdID09PVxuICAgICAgICBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlRcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0V4cGFuc2lvbkZvcm1TdGFydCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJExCUkFDRSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIGNvbnN0IGlzSW50ZXJwb2xhdGlvbiA9IHRoaXMuX2F0dGVtcHRTdHIodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydCk7XG4gICAgICB0aGlzLl9jdXJzb3IgPSBzdGFydDtcbiAgICAgIHJldHVybiAhaXNJbnRlcnBvbGF0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc05vdFdoaXRlc3BhY2UoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAhY2hhcnMuaXNXaGl0ZXNwYWNlKGNvZGUpIHx8IGNvZGUgPT09IGNoYXJzLiRFT0Y7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZUVuZChjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICBjaGFycy5pc1doaXRlc3BhY2UoY29kZSkgfHxcbiAgICBjb2RlID09PSBjaGFycy4kR1QgfHxcbiAgICBjb2RlID09PSBjaGFycy4kTFQgfHxcbiAgICBjb2RlID09PSBjaGFycy4kU0xBU0ggfHxcbiAgICBjb2RlID09PSBjaGFycy4kU1EgfHxcbiAgICBjb2RlID09PSBjaGFycy4kRFEgfHxcbiAgICBjb2RlID09PSBjaGFycy4kRVEgfHxcbiAgICBjb2RlID09PSBjaGFycy4kRU9GXG4gICk7XG59XG5cbmZ1bmN0aW9uIGlzUHJlZml4RW5kKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIChjb2RlIDwgY2hhcnMuJGEgfHwgY2hhcnMuJHogPCBjb2RlKSAmJlxuICAgIChjb2RlIDwgY2hhcnMuJEEgfHwgY2hhcnMuJFogPCBjb2RlKSAmJlxuICAgIChjb2RlIDwgY2hhcnMuJDAgfHwgY29kZSA+IGNoYXJzLiQ5KVxuICApO1xufVxuXG5mdW5jdGlvbiBpc0RpZ2l0RW50aXR5RW5kKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29kZSA9PT0gY2hhcnMuJFNFTUlDT0xPTiB8fCBjb2RlID09PSBjaGFycy4kRU9GIHx8ICFjaGFycy5pc0FzY2lpSGV4RGlnaXQoY29kZSk7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZWRFbnRpdHlFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID09PSBjaGFycy4kU0VNSUNPTE9OIHx8IGNvZGUgPT09IGNoYXJzLiRFT0YgfHwgIWNoYXJzLmlzQXNjaWlMZXR0ZXIoY29kZSk7XG59XG5cbmZ1bmN0aW9uIGlzRXhwYW5zaW9uQ2FzZVN0YXJ0KHBlZWs6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gcGVlayAhPT0gY2hhcnMuJFJCUkFDRTtcbn1cblxuZnVuY3Rpb24gY29tcGFyZUNoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKGNvZGUxOiBudW1iZXIsIGNvZGUyOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIHRvVXBwZXJDYXNlQ2hhckNvZGUoY29kZTEpID09PSB0b1VwcGVyQ2FzZUNoYXJDb2RlKGNvZGUyKTtcbn1cblxuZnVuY3Rpb24gdG9VcHBlckNhc2VDaGFyQ29kZShjb2RlOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gY29kZSA+PSBjaGFycy4kYSAmJiBjb2RlIDw9IGNoYXJzLiR6ID8gY29kZSAtIGNoYXJzLiRhICsgY2hhcnMuJEEgOiBjb2RlO1xufVxuXG5mdW5jdGlvbiBpc0Jsb2NrTmFtZUNoYXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjaGFycy5pc0FzY2lpTGV0dGVyKGNvZGUpIHx8IGNoYXJzLmlzRGlnaXQoY29kZSkgfHwgY29kZSA9PT0gY2hhcnMuJF87XG59XG5cbmZ1bmN0aW9uIGlzQmxvY2tQYXJhbWV0ZXJDaGFyKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29kZSAhPT0gY2hhcnMuJFNFTUlDT0xPTiAmJiBpc05vdFdoaXRlc3BhY2UoY29kZSk7XG59XG5cbmZ1bmN0aW9uIG1lcmdlVGV4dFRva2VucyhzcmNUb2tlbnM6IFRva2VuW10pOiBUb2tlbltdIHtcbiAgY29uc3QgZHN0VG9rZW5zOiBUb2tlbltdID0gW107XG4gIGxldCBsYXN0RHN0VG9rZW46IFRva2VuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNyY1Rva2Vucy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHRva2VuID0gc3JjVG9rZW5zW2ldO1xuICAgIGlmIChcbiAgICAgIChsYXN0RHN0VG9rZW4gJiYgbGFzdERzdFRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5URVhUICYmIHRva2VuLnR5cGUgPT09IFRva2VuVHlwZS5URVhUKSB8fFxuICAgICAgKGxhc3REc3RUb2tlbiAmJlxuICAgICAgICBsYXN0RHN0VG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfVkFMVUVfVEVYVCAmJlxuICAgICAgICB0b2tlbi50eXBlID09PSBUb2tlblR5cGUuQVRUUl9WQUxVRV9URVhUKVxuICAgICkge1xuICAgICAgbGFzdERzdFRva2VuLnBhcnRzWzBdISArPSB0b2tlbi5wYXJ0c1swXTtcbiAgICAgIGxhc3REc3RUb2tlbi5zb3VyY2VTcGFuLmVuZCA9IHRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYXN0RHN0VG9rZW4gPSB0b2tlbjtcbiAgICAgIGRzdFRva2Vucy5wdXNoKGxhc3REc3RUb2tlbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRzdFRva2Vucztcbn1cblxuLyoqXG4gKiBUaGUgX1Rva2VuaXplciB1c2VzIG9iamVjdHMgb2YgdGhpcyB0eXBlIHRvIG1vdmUgdGhyb3VnaCB0aGUgaW5wdXQgdGV4dCxcbiAqIGV4dHJhY3RpbmcgXCJwYXJzZWQgY2hhcmFjdGVyc1wiLiBUaGVzZSBjb3VsZCBiZSBtb3JlIHRoYW4gb25lIGFjdHVhbCBjaGFyYWN0ZXJcbiAqIGlmIHRoZSB0ZXh0IGNvbnRhaW5zIGVzY2FwZSBzZXF1ZW5jZXMuXG4gKi9cbmludGVyZmFjZSBDaGFyYWN0ZXJDdXJzb3Ige1xuICAvKiogSW5pdGlhbGl6ZSB0aGUgY3Vyc29yLiAqL1xuICBpbml0KCk6IHZvaWQ7XG4gIC8qKiBUaGUgcGFyc2VkIGNoYXJhY3RlciBhdCB0aGUgY3VycmVudCBjdXJzb3IgcG9zaXRpb24uICovXG4gIHBlZWsoKTogbnVtYmVyO1xuICAvKiogQWR2YW5jZSB0aGUgY3Vyc29yIGJ5IG9uZSBwYXJzZWQgY2hhcmFjdGVyLiAqL1xuICBhZHZhbmNlKCk6IHZvaWQ7XG4gIC8qKiBHZXQgYSBzcGFuIGZyb20gdGhlIG1hcmtlZCBzdGFydCBwb2ludCB0byB0aGUgY3VycmVudCBwb2ludC4gKi9cbiAgZ2V0U3BhbihzdGFydD86IHRoaXMsIGxlYWRpbmdUcml2aWFDb2RlUG9pbnRzPzogbnVtYmVyW10pOiBQYXJzZVNvdXJjZVNwYW47XG4gIC8qKiBHZXQgdGhlIHBhcnNlZCBjaGFyYWN0ZXJzIGZyb20gdGhlIG1hcmtlZCBzdGFydCBwb2ludCB0byB0aGUgY3VycmVudCBwb2ludC4gKi9cbiAgZ2V0Q2hhcnMoc3RhcnQ6IHRoaXMpOiBzdHJpbmc7XG4gIC8qKiBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgbGVmdCBiZWZvcmUgdGhlIGVuZCBvZiB0aGUgY3Vyc29yLiAqL1xuICBjaGFyc0xlZnQoKTogbnVtYmVyO1xuICAvKiogVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGJldHdlZW4gYHRoaXNgIGN1cnNvciBhbmQgYG90aGVyYCBjdXJzb3IuICovXG4gIGRpZmYob3RoZXI6IHRoaXMpOiBudW1iZXI7XG4gIC8qKiBNYWtlIGEgY29weSBvZiB0aGlzIGN1cnNvciAqL1xuICBjbG9uZSgpOiBDaGFyYWN0ZXJDdXJzb3I7XG59XG5cbmludGVyZmFjZSBDdXJzb3JTdGF0ZSB7XG4gIHBlZWs6IG51bWJlcjtcbiAgb2Zmc2V0OiBudW1iZXI7XG4gIGxpbmU6IG51bWJlcjtcbiAgY29sdW1uOiBudW1iZXI7XG59XG5cbmNsYXNzIFBsYWluQ2hhcmFjdGVyQ3Vyc29yIGltcGxlbWVudHMgQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgcHJvdGVjdGVkIHN0YXRlOiBDdXJzb3JTdGF0ZTtcbiAgcHJvdGVjdGVkIGZpbGU6IFBhcnNlU291cmNlRmlsZTtcbiAgcHJvdGVjdGVkIGlucHV0OiBzdHJpbmc7XG4gIHByb3RlY3RlZCBlbmQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBsYWluQ2hhcmFjdGVyQ3Vyc29yKTtcbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQYXJzZVNvdXJjZUZpbGUsIHJhbmdlOiBMZXhlclJhbmdlKTtcbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQYXJzZVNvdXJjZUZpbGUgfCBQbGFpbkNoYXJhY3RlckN1cnNvciwgcmFuZ2U/OiBMZXhlclJhbmdlKSB7XG4gICAgaWYgKGZpbGVPckN1cnNvciBpbnN0YW5jZW9mIFBsYWluQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgICB0aGlzLmZpbGUgPSBmaWxlT3JDdXJzb3IuZmlsZTtcbiAgICAgIHRoaXMuaW5wdXQgPSBmaWxlT3JDdXJzb3IuaW5wdXQ7XG4gICAgICB0aGlzLmVuZCA9IGZpbGVPckN1cnNvci5lbmQ7XG5cbiAgICAgIGNvbnN0IHN0YXRlID0gZmlsZU9yQ3Vyc29yLnN0YXRlO1xuICAgICAgLy8gTm90ZTogYXZvaWQgdXNpbmcgYHsuLi5maWxlT3JDdXJzb3Iuc3RhdGV9YCBoZXJlIGFzIHRoYXQgaGFzIGEgc2V2ZXJlIHBlcmZvcm1hbmNlIHBlbmFsdHkuXG4gICAgICAvLyBJbiBFUzUgYnVuZGxlcyB0aGUgb2JqZWN0IHNwcmVhZCBvcGVyYXRvciBpcyB0cmFuc2xhdGVkIGludG8gdGhlIGBfX2Fzc2lnbmAgaGVscGVyLCB3aGljaFxuICAgICAgLy8gaXMgbm90IG9wdGltaXplZCBieSBWTXMgYXMgZWZmaWNpZW50bHkgYXMgYSByYXcgb2JqZWN0IGxpdGVyYWwuIFNpbmNlIHRoaXMgY29uc3RydWN0b3IgaXNcbiAgICAgIC8vIGNhbGxlZCBpbiB0aWdodCBsb29wcywgdGhpcyBkaWZmZXJlbmNlIG1hdHRlcnMuXG4gICAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICBwZWVrOiBzdGF0ZS5wZWVrLFxuICAgICAgICBvZmZzZXQ6IHN0YXRlLm9mZnNldCxcbiAgICAgICAgbGluZTogc3RhdGUubGluZSxcbiAgICAgICAgY29sdW1uOiBzdGF0ZS5jb2x1bW4sXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXJhbmdlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnUHJvZ3JhbW1pbmcgZXJyb3I6IHRoZSByYW5nZSBhcmd1bWVudCBtdXN0IGJlIHByb3ZpZGVkIHdpdGggYSBmaWxlIGFyZ3VtZW50LicsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB0aGlzLmZpbGUgPSBmaWxlT3JDdXJzb3I7XG4gICAgICB0aGlzLmlucHV0ID0gZmlsZU9yQ3Vyc29yLmNvbnRlbnQ7XG4gICAgICB0aGlzLmVuZCA9IHJhbmdlLmVuZFBvcztcbiAgICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgIHBlZWs6IC0xLFxuICAgICAgICBvZmZzZXQ6IHJhbmdlLnN0YXJ0UG9zLFxuICAgICAgICBsaW5lOiByYW5nZS5zdGFydExpbmUsXG4gICAgICAgIGNvbHVtbjogcmFuZ2Uuc3RhcnRDb2wsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGNsb25lKCk6IFBsYWluQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgICByZXR1cm4gbmV3IFBsYWluQ2hhcmFjdGVyQ3Vyc29yKHRoaXMpO1xuICB9XG5cbiAgcGVlaygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5wZWVrO1xuICB9XG4gIGNoYXJzTGVmdCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbmQgLSB0aGlzLnN0YXRlLm9mZnNldDtcbiAgfVxuICBkaWZmKG90aGVyOiB0aGlzKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUub2Zmc2V0IC0gb3RoZXIuc3RhdGUub2Zmc2V0O1xuICB9XG5cbiAgYWR2YW5jZSgpOiB2b2lkIHtcbiAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLnN0YXRlKTtcbiAgfVxuXG4gIGluaXQoKTogdm9pZCB7XG4gICAgdGhpcy51cGRhdGVQZWVrKHRoaXMuc3RhdGUpO1xuICB9XG5cbiAgZ2V0U3BhbihzdGFydD86IHRoaXMsIGxlYWRpbmdUcml2aWFDb2RlUG9pbnRzPzogbnVtYmVyW10pOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIHN0YXJ0ID0gc3RhcnQgfHwgdGhpcztcbiAgICBsZXQgZnVsbFN0YXJ0ID0gc3RhcnQ7XG4gICAgaWYgKGxlYWRpbmdUcml2aWFDb2RlUG9pbnRzKSB7XG4gICAgICB3aGlsZSAodGhpcy5kaWZmKHN0YXJ0KSA+IDAgJiYgbGVhZGluZ1RyaXZpYUNvZGVQb2ludHMuaW5kZXhPZihzdGFydC5wZWVrKCkpICE9PSAtMSkge1xuICAgICAgICBpZiAoZnVsbFN0YXJ0ID09PSBzdGFydCkge1xuICAgICAgICAgIHN0YXJ0ID0gc3RhcnQuY2xvbmUoKSBhcyB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIHN0YXJ0LmFkdmFuY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgc3RhcnRMb2NhdGlvbiA9IHRoaXMubG9jYXRpb25Gcm9tQ3Vyc29yKHN0YXJ0KTtcbiAgICBjb25zdCBlbmRMb2NhdGlvbiA9IHRoaXMubG9jYXRpb25Gcm9tQ3Vyc29yKHRoaXMpO1xuICAgIGNvbnN0IGZ1bGxTdGFydExvY2F0aW9uID1cbiAgICAgIGZ1bGxTdGFydCAhPT0gc3RhcnQgPyB0aGlzLmxvY2F0aW9uRnJvbUN1cnNvcihmdWxsU3RhcnQpIDogc3RhcnRMb2NhdGlvbjtcbiAgICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydExvY2F0aW9uLCBlbmRMb2NhdGlvbiwgZnVsbFN0YXJ0TG9jYXRpb24pO1xuICB9XG5cbiAgZ2V0Q2hhcnMoc3RhcnQ6IHRoaXMpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydC5zdGF0ZS5vZmZzZXQsIHRoaXMuc3RhdGUub2Zmc2V0KTtcbiAgfVxuXG4gIGNoYXJBdChwb3M6IG51bWJlcik6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuaW5wdXQuY2hhckNvZGVBdChwb3MpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFkdmFuY2VTdGF0ZShzdGF0ZTogQ3Vyc29yU3RhdGUpIHtcbiAgICBpZiAoc3RhdGUub2Zmc2V0ID49IHRoaXMuZW5kKSB7XG4gICAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gICAgICB0aHJvdyBuZXcgQ3Vyc29yRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhcmFjdGVyIFwiRU9GXCInLCB0aGlzKTtcbiAgICB9XG4gICAgY29uc3QgY3VycmVudENoYXIgPSB0aGlzLmNoYXJBdChzdGF0ZS5vZmZzZXQpO1xuICAgIGlmIChjdXJyZW50Q2hhciA9PT0gY2hhcnMuJExGKSB7XG4gICAgICBzdGF0ZS5saW5lKys7XG4gICAgICBzdGF0ZS5jb2x1bW4gPSAwO1xuICAgIH0gZWxzZSBpZiAoIWNoYXJzLmlzTmV3TGluZShjdXJyZW50Q2hhcikpIHtcbiAgICAgIHN0YXRlLmNvbHVtbisrO1xuICAgIH1cbiAgICBzdGF0ZS5vZmZzZXQrKztcbiAgICB0aGlzLnVwZGF0ZVBlZWsoc3RhdGUpO1xuICB9XG5cbiAgcHJvdGVjdGVkIHVwZGF0ZVBlZWsoc3RhdGU6IEN1cnNvclN0YXRlKTogdm9pZCB7XG4gICAgc3RhdGUucGVlayA9IHN0YXRlLm9mZnNldCA+PSB0aGlzLmVuZCA/IGNoYXJzLiRFT0YgOiB0aGlzLmNoYXJBdChzdGF0ZS5vZmZzZXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2NhdGlvbkZyb21DdXJzb3IoY3Vyc29yOiB0aGlzKTogUGFyc2VMb2NhdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBQYXJzZUxvY2F0aW9uKFxuICAgICAgY3Vyc29yLmZpbGUsXG4gICAgICBjdXJzb3Iuc3RhdGUub2Zmc2V0LFxuICAgICAgY3Vyc29yLnN0YXRlLmxpbmUsXG4gICAgICBjdXJzb3Iuc3RhdGUuY29sdW1uLFxuICAgICk7XG4gIH1cbn1cblxuY2xhc3MgRXNjYXBlZENoYXJhY3RlckN1cnNvciBleHRlbmRzIFBsYWluQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgcHJvdGVjdGVkIGludGVybmFsU3RhdGU6IEN1cnNvclN0YXRlO1xuXG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogRXNjYXBlZENoYXJhY3RlckN1cnNvcik7XG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogUGFyc2VTb3VyY2VGaWxlLCByYW5nZTogTGV4ZXJSYW5nZSk7XG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogUGFyc2VTb3VyY2VGaWxlIHwgRXNjYXBlZENoYXJhY3RlckN1cnNvciwgcmFuZ2U/OiBMZXhlclJhbmdlKSB7XG4gICAgaWYgKGZpbGVPckN1cnNvciBpbnN0YW5jZW9mIEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICAgIHN1cGVyKGZpbGVPckN1cnNvcik7XG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB7Li4uZmlsZU9yQ3Vyc29yLmludGVybmFsU3RhdGV9O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlcihmaWxlT3JDdXJzb3IsIHJhbmdlISk7XG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB0aGlzLnN0YXRlO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGFkdmFuY2UoKTogdm9pZCB7XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMuaW50ZXJuYWxTdGF0ZTtcbiAgICBzdXBlci5hZHZhbmNlKCk7XG4gICAgdGhpcy5wcm9jZXNzRXNjYXBlU2VxdWVuY2UoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGluaXQoKTogdm9pZCB7XG4gICAgc3VwZXIuaW5pdCgpO1xuICAgIHRoaXMucHJvY2Vzc0VzY2FwZVNlcXVlbmNlKCk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgICByZXR1cm4gbmV3IEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IodGhpcyk7XG4gIH1cblxuICBvdmVycmlkZSBnZXRDaGFycyhzdGFydDogdGhpcyk6IHN0cmluZyB7XG4gICAgY29uc3QgY3Vyc29yID0gc3RhcnQuY2xvbmUoKTtcbiAgICBsZXQgY2hhcnMgPSAnJztcbiAgICB3aGlsZSAoY3Vyc29yLmludGVybmFsU3RhdGUub2Zmc2V0IDwgdGhpcy5pbnRlcm5hbFN0YXRlLm9mZnNldCkge1xuICAgICAgY2hhcnMgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3Vyc29yLnBlZWsoKSk7XG4gICAgICBjdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgICByZXR1cm4gY2hhcnM7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgZXNjYXBlIHNlcXVlbmNlIHRoYXQgc3RhcnRzIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uIGluIHRoZSB0ZXh0LlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgdG8gZW5zdXJlIHRoYXQgYHBlZWtgIGhhcyB0aGUgdW5lc2NhcGVkIHZhbHVlIG9mIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgcHJvY2Vzc0VzY2FwZVNlcXVlbmNlKCk6IHZvaWQge1xuICAgIGNvbnN0IHBlZWsgPSAoKSA9PiB0aGlzLmludGVybmFsU3RhdGUucGVlaztcblxuICAgIGlmIChwZWVrKCkgPT09IGNoYXJzLiRCQUNLU0xBU0gpIHtcbiAgICAgIC8vIFdlIGhhdmUgaGl0IGFuIGVzY2FwZSBzZXF1ZW5jZSBzbyB3ZSBuZWVkIHRoZSBpbnRlcm5hbCBzdGF0ZSB0byBiZWNvbWUgaW5kZXBlbmRlbnRcbiAgICAgIC8vIG9mIHRoZSBleHRlcm5hbCBzdGF0ZS5cbiAgICAgIHRoaXMuaW50ZXJuYWxTdGF0ZSA9IHsuLi50aGlzLnN0YXRlfTtcblxuICAgICAgLy8gTW92ZSBwYXN0IHRoZSBiYWNrc2xhc2hcbiAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG5cbiAgICAgIC8vIEZpcnN0IGNoZWNrIGZvciBzdGFuZGFyZCBjb250cm9sIGNoYXIgc2VxdWVuY2VzXG4gICAgICBpZiAocGVlaygpID09PSBjaGFycy4kbikge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kTEY7XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJHIpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJENSO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR2KSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRWVEFCO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR0KSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRUQUI7XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJGIpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJEJTUEFDRTtcbiAgICAgIH0gZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kZikge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kRkY7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdyBjb25zaWRlciBtb3JlIGNvbXBsZXggc2VxdWVuY2VzXG4gICAgICBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR1KSB7XG4gICAgICAgIC8vIFVuaWNvZGUgY29kZS1wb2ludCBzZXF1ZW5jZVxuICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpOyAvLyBhZHZhbmNlIHBhc3QgdGhlIGB1YCBjaGFyXG4gICAgICAgIGlmIChwZWVrKCkgPT09IGNoYXJzLiRMQlJBQ0UpIHtcbiAgICAgICAgICAvLyBWYXJpYWJsZSBsZW5ndGggVW5pY29kZSwgZS5nLiBgXFx4ezEyM31gXG4gICAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTsgLy8gYWR2YW5jZSBwYXN0IHRoZSBge2AgY2hhclxuICAgICAgICAgIC8vIEFkdmFuY2UgcGFzdCB0aGUgdmFyaWFibGUgbnVtYmVyIG9mIGhleCBkaWdpdHMgdW50aWwgd2UgaGl0IGEgYH1gIGNoYXJcbiAgICAgICAgICBjb25zdCBkaWdpdFN0YXJ0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgIGxldCBsZW5ndGggPSAwO1xuICAgICAgICAgIHdoaWxlIChwZWVrKCkgIT09IGNoYXJzLiRSQlJBQ0UpIHtcbiAgICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgICBsZW5ndGgrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5kZWNvZGVIZXhEaWdpdHMoZGlnaXRTdGFydCwgbGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaXhlZCBsZW5ndGggVW5pY29kZSwgZS5nLiBgXFx1MTIzNGBcbiAgICAgICAgICBjb25zdCBkaWdpdFN0YXJ0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuICAgICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHRoaXMuZGVjb2RlSGV4RGlnaXRzKGRpZ2l0U3RhcnQsIDQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJHgpIHtcbiAgICAgICAgLy8gSGV4IGNoYXIgY29kZSwgZS5nLiBgXFx4MkZgXG4gICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7IC8vIGFkdmFuY2UgcGFzdCB0aGUgYHhgIGNoYXJcbiAgICAgICAgY29uc3QgZGlnaXRTdGFydCA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5kZWNvZGVIZXhEaWdpdHMoZGlnaXRTdGFydCwgMik7XG4gICAgICB9IGVsc2UgaWYgKGNoYXJzLmlzT2N0YWxEaWdpdChwZWVrKCkpKSB7XG4gICAgICAgIC8vIE9jdGFsIGNoYXIgY29kZSwgZS5nLiBgXFwwMTJgLFxuICAgICAgICBsZXQgb2N0YWwgPSAnJztcbiAgICAgICAgbGV0IGxlbmd0aCA9IDA7XG4gICAgICAgIGxldCBwcmV2aW91cyA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgd2hpbGUgKGNoYXJzLmlzT2N0YWxEaWdpdChwZWVrKCkpICYmIGxlbmd0aCA8IDMpIHtcbiAgICAgICAgICBwcmV2aW91cyA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICBvY3RhbCArPSBTdHJpbmcuZnJvbUNvZGVQb2ludChwZWVrKCkpO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgbGVuZ3RoKys7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gcGFyc2VJbnQob2N0YWwsIDgpO1xuICAgICAgICAvLyBCYWNrdXAgb25lIGNoYXJcbiAgICAgICAgdGhpcy5pbnRlcm5hbFN0YXRlID0gcHJldmlvdXMuaW50ZXJuYWxTdGF0ZTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhcnMuaXNOZXdMaW5lKHRoaXMuaW50ZXJuYWxTdGF0ZS5wZWVrKSkge1xuICAgICAgICAvLyBMaW5lIGNvbnRpbnVhdGlvbiBgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3IGxpbmVcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTsgLy8gYWR2YW5jZSBvdmVyIHRoZSBuZXdsaW5lXG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLmludGVybmFsU3RhdGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiBub25lIG9mIHRoZSBgaWZgIGJsb2NrcyB3ZXJlIGV4ZWN1dGVkIHRoZW4gd2UganVzdCBoYXZlIGFuIGVzY2FwZWQgbm9ybWFsIGNoYXJhY3Rlci5cbiAgICAgICAgLy8gSW4gdGhhdCBjYXNlIHdlIGp1c3QsIGVmZmVjdGl2ZWx5LCBza2lwIHRoZSBiYWNrc2xhc2ggZnJvbSB0aGUgY2hhcmFjdGVyLlxuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSB0aGlzLmludGVybmFsU3RhdGUucGVlaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgZGVjb2RlSGV4RGlnaXRzKHN0YXJ0OiBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yLCBsZW5ndGg6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgaGV4ID0gdGhpcy5pbnB1dC5zbGljZShzdGFydC5pbnRlcm5hbFN0YXRlLm9mZnNldCwgc3RhcnQuaW50ZXJuYWxTdGF0ZS5vZmZzZXQgKyBsZW5ndGgpO1xuICAgIGNvbnN0IGNoYXJDb2RlID0gcGFyc2VJbnQoaGV4LCAxNik7XG4gICAgaWYgKCFpc05hTihjaGFyQ29kZSkpIHtcbiAgICAgIHJldHVybiBjaGFyQ29kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhcnQuc3RhdGUgPSBzdGFydC5pbnRlcm5hbFN0YXRlO1xuICAgICAgdGhyb3cgbmV3IEN1cnNvckVycm9yKCdJbnZhbGlkIGhleGFkZWNpbWFsIGVzY2FwZSBzZXF1ZW5jZScsIHN0YXJ0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvckVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIG1zZzogc3RyaW5nLFxuICAgIHB1YmxpYyBjdXJzb3I6IENoYXJhY3RlckN1cnNvcixcbiAgKSB7fVxufVxuIl19