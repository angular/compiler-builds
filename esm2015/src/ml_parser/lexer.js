/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as chars from '../chars';
import { ParseError, ParseLocation, ParseSourceFile, ParseSourceSpan } from '../parse_util';
import { DEFAULT_INTERPOLATION_CONFIG } from './interpolation_config';
import { NAMED_ENTITIES, TagContentType } from './tags';
/** @enum {number} */
const TokenType = {
    TAG_OPEN_START: 0,
    TAG_OPEN_END: 1,
    TAG_OPEN_END_VOID: 2,
    TAG_CLOSE: 3,
    TEXT: 4,
    ESCAPABLE_RAW_TEXT: 5,
    RAW_TEXT: 6,
    COMMENT_START: 7,
    COMMENT_END: 8,
    CDATA_START: 9,
    CDATA_END: 10,
    ATTR_NAME: 11,
    ATTR_VALUE: 12,
    DOC_TYPE: 13,
    EXPANSION_FORM_START: 14,
    EXPANSION_CASE_VALUE: 15,
    EXPANSION_CASE_EXP_START: 16,
    EXPANSION_CASE_EXP_END: 17,
    EXPANSION_FORM_END: 18,
    EOF: 19,
};
export { TokenType };
TokenType[TokenType.TAG_OPEN_START] = "TAG_OPEN_START";
TokenType[TokenType.TAG_OPEN_END] = "TAG_OPEN_END";
TokenType[TokenType.TAG_OPEN_END_VOID] = "TAG_OPEN_END_VOID";
TokenType[TokenType.TAG_CLOSE] = "TAG_CLOSE";
TokenType[TokenType.TEXT] = "TEXT";
TokenType[TokenType.ESCAPABLE_RAW_TEXT] = "ESCAPABLE_RAW_TEXT";
TokenType[TokenType.RAW_TEXT] = "RAW_TEXT";
TokenType[TokenType.COMMENT_START] = "COMMENT_START";
TokenType[TokenType.COMMENT_END] = "COMMENT_END";
TokenType[TokenType.CDATA_START] = "CDATA_START";
TokenType[TokenType.CDATA_END] = "CDATA_END";
TokenType[TokenType.ATTR_NAME] = "ATTR_NAME";
TokenType[TokenType.ATTR_VALUE] = "ATTR_VALUE";
TokenType[TokenType.DOC_TYPE] = "DOC_TYPE";
TokenType[TokenType.EXPANSION_FORM_START] = "EXPANSION_FORM_START";
TokenType[TokenType.EXPANSION_CASE_VALUE] = "EXPANSION_CASE_VALUE";
TokenType[TokenType.EXPANSION_CASE_EXP_START] = "EXPANSION_CASE_EXP_START";
TokenType[TokenType.EXPANSION_CASE_EXP_END] = "EXPANSION_CASE_EXP_END";
TokenType[TokenType.EXPANSION_FORM_END] = "EXPANSION_FORM_END";
TokenType[TokenType.EOF] = "EOF";
export class Token {
    /**
     * @param {?} type
     * @param {?} parts
     * @param {?} sourceSpan
     */
    constructor(type, parts, sourceSpan) {
        this.type = type;
        this.parts = parts;
        this.sourceSpan = sourceSpan;
    }
}
function Token_tsickle_Closure_declarations() {
    /** @type {?} */
    Token.prototype.type;
    /** @type {?} */
    Token.prototype.parts;
    /** @type {?} */
    Token.prototype.sourceSpan;
}
export class TokenError extends ParseError {
    /**
     * @param {?} errorMsg
     * @param {?} tokenType
     * @param {?} span
     */
    constructor(errorMsg, tokenType, span) {
        super(span, errorMsg);
        this.tokenType = tokenType;
    }
}
function TokenError_tsickle_Closure_declarations() {
    /** @type {?} */
    TokenError.prototype.tokenType;
}
export class TokenizeResult {
    /**
     * @param {?} tokens
     * @param {?} errors
     */
    constructor(tokens, errors) {
        this.tokens = tokens;
        this.errors = errors;
    }
}
function TokenizeResult_tsickle_Closure_declarations() {
    /** @type {?} */
    TokenizeResult.prototype.tokens;
    /** @type {?} */
    TokenizeResult.prototype.errors;
}
/**
 * @param {?} source
 * @param {?} url
 * @param {?} getTagDefinition
 * @param {?=} tokenizeExpansionForms
 * @param {?=} interpolationConfig
 * @return {?}
 */
export function tokenize(source, url, getTagDefinition, tokenizeExpansionForms = false, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
    return new _Tokenizer(new ParseSourceFile(source, url), getTagDefinition, tokenizeExpansionForms, interpolationConfig)
        .tokenize();
}
const /** @type {?} */ _CR_OR_CRLF_REGEXP = /\r\n?/g;
/**
 * @param {?} charCode
 * @return {?}
 */
function _unexpectedCharacterErrorMsg(charCode) {
    const /** @type {?} */ char = charCode === chars.$EOF ? 'EOF' : String.fromCharCode(charCode);
    return `Unexpected character "${char}"`;
}
/**
 * @param {?} entitySrc
 * @return {?}
 */
function _unknownEntityErrorMsg(entitySrc) {
    return `Unknown entity "${entitySrc}" - use the "&#<decimal>;" or  "&#x<hex>;" syntax`;
}
class _ControlFlowError {
    /**
     * @param {?} error
     */
    constructor(error) {
        this.error = error;
    }
}
function _ControlFlowError_tsickle_Closure_declarations() {
    /** @type {?} */
    _ControlFlowError.prototype.error;
}
class _Tokenizer {
    /**
     * @param {?} _file The html source
     * @param {?} _getTagDefinition
     * @param {?} _tokenizeIcu Whether to tokenize ICU messages (considered as text nodes when false)
     * @param {?=} _interpolationConfig
     */
    constructor(_file, _getTagDefinition, _tokenizeIcu, _interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        this._file = _file;
        this._getTagDefinition = _getTagDefinition;
        this._tokenizeIcu = _tokenizeIcu;
        this._interpolationConfig = _interpolationConfig;
        this._peek = -1;
        this._nextPeek = -1;
        this._index = -1;
        this._line = 0;
        this._column = -1;
        this._expansionCaseStack = [];
        this._inInterpolation = false;
        this.tokens = [];
        this.errors = [];
        this._input = _file.content;
        this._length = _file.content.length;
        this._advance();
    }
    /**
     * @param {?} content
     * @return {?}
     */
    _processCarriageReturns(content) {
        // http://www.w3.org/TR/html5/syntax.html#preprocessing-the-input-stream
        // In order to keep the original position in the source, we can not
        // pre-process it.
        // Instead CRs are processed right before instantiating the tokens.
        return content.replace(_CR_OR_CRLF_REGEXP, '\n');
    }
    /**
     * @return {?}
     */
    tokenize() {
        while (this._peek !== chars.$EOF) {
            const /** @type {?} */ start = this._getLocation();
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
                else if (!(this._tokenizeIcu && this._tokenizeExpansionForm())) {
                    this._consumeText();
                }
            }
            catch (/** @type {?} */ e) {
                if (e instanceof _ControlFlowError) {
                    this.errors.push(e.error);
                }
                else {
                    throw e;
                }
            }
        }
        this._beginToken(TokenType.EOF);
        this._endToken([]);
        return new TokenizeResult(mergeTextTokens(this.tokens), this.errors);
    }
    /**
     * \@internal
     * @return {?} whether an ICU token has been created
     */
    _tokenizeExpansionForm() {
        if (isExpansionFormStart(this._input, this._index, this._interpolationConfig)) {
            this._consumeExpansionFormStart();
            return true;
        }
        if (isExpansionCaseStart(this._peek) && this._isInExpansionForm()) {
            this._consumeExpansionCaseStart();
            return true;
        }
        if (this._peek === chars.$RBRACE) {
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
    /**
     * @return {?}
     */
    _getLocation() {
        return new ParseLocation(this._file, this._index, this._line, this._column);
    }
    /**
     * @param {?=} start
     * @param {?=} end
     * @return {?}
     */
    _getSpan(start = this._getLocation(), end = this._getLocation()) {
        return new ParseSourceSpan(start, end);
    }
    /**
     * @param {?} type
     * @param {?=} start
     * @return {?}
     */
    _beginToken(type, start = this._getLocation()) {
        this._currentTokenStart = start;
        this._currentTokenType = type;
    }
    /**
     * @param {?} parts
     * @param {?=} end
     * @return {?}
     */
    _endToken(parts, end = this._getLocation()) {
        const /** @type {?} */ token = new Token(this._currentTokenType, parts, new ParseSourceSpan(this._currentTokenStart, end));
        this.tokens.push(token);
        this._currentTokenStart = /** @type {?} */ ((null));
        this._currentTokenType = /** @type {?} */ ((null));
        return token;
    }
    /**
     * @param {?} msg
     * @param {?} span
     * @return {?}
     */
    _createError(msg, span) {
        if (this._isInExpansionForm()) {
            msg += ` (Do you have an unescaped "{" in your template? Use "{{ '{' }}") to escape it.)`;
        }
        const /** @type {?} */ error = new TokenError(msg, this._currentTokenType, span);
        this._currentTokenStart = /** @type {?} */ ((null));
        this._currentTokenType = /** @type {?} */ ((null));
        return new _ControlFlowError(error);
    }
    /**
     * @return {?}
     */
    _advance() {
        if (this._index >= this._length) {
            throw this._createError(_unexpectedCharacterErrorMsg(chars.$EOF), this._getSpan());
        }
        if (this._peek === chars.$LF) {
            this._line++;
            this._column = 0;
        }
        else if (this._peek !== chars.$LF && this._peek !== chars.$CR) {
            this._column++;
        }
        this._index++;
        this._peek = this._index >= this._length ? chars.$EOF : this._input.charCodeAt(this._index);
        this._nextPeek =
            this._index + 1 >= this._length ? chars.$EOF : this._input.charCodeAt(this._index + 1);
    }
    /**
     * @param {?} charCode
     * @return {?}
     */
    _attemptCharCode(charCode) {
        if (this._peek === charCode) {
            this._advance();
            return true;
        }
        return false;
    }
    /**
     * @param {?} charCode
     * @return {?}
     */
    _attemptCharCodeCaseInsensitive(charCode) {
        if (compareCharCodeCaseInsensitive(this._peek, charCode)) {
            this._advance();
            return true;
        }
        return false;
    }
    /**
     * @param {?} charCode
     * @return {?}
     */
    _requireCharCode(charCode) {
        const /** @type {?} */ location = this._getLocation();
        if (!this._attemptCharCode(charCode)) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._peek), this._getSpan(location, location));
        }
    }
    /**
     * @param {?} chars
     * @return {?}
     */
    _attemptStr(chars) {
        const /** @type {?} */ len = chars.length;
        if (this._index + len > this._length) {
            return false;
        }
        const /** @type {?} */ initialPosition = this._savePosition();
        for (let /** @type {?} */ i = 0; i < len; i++) {
            if (!this._attemptCharCode(chars.charCodeAt(i))) {
                // If attempting to parse the string fails, we want to reset the parser
                // to where it was before the attempt
                this._restorePosition(initialPosition);
                return false;
            }
        }
        return true;
    }
    /**
     * @param {?} chars
     * @return {?}
     */
    _attemptStrCaseInsensitive(chars) {
        for (let /** @type {?} */ i = 0; i < chars.length; i++) {
            if (!this._attemptCharCodeCaseInsensitive(chars.charCodeAt(i))) {
                return false;
            }
        }
        return true;
    }
    /**
     * @param {?} chars
     * @return {?}
     */
    _requireStr(chars) {
        const /** @type {?} */ location = this._getLocation();
        if (!this._attemptStr(chars)) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._peek), this._getSpan(location));
        }
    }
    /**
     * @param {?} predicate
     * @return {?}
     */
    _attemptCharCodeUntilFn(predicate) {
        while (!predicate(this._peek)) {
            this._advance();
        }
    }
    /**
     * @param {?} predicate
     * @param {?} len
     * @return {?}
     */
    _requireCharCodeUntilFn(predicate, len) {
        const /** @type {?} */ start = this._getLocation();
        this._attemptCharCodeUntilFn(predicate);
        if (this._index - start.offset < len) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._peek), this._getSpan(start, start));
        }
    }
    /**
     * @param {?} char
     * @return {?}
     */
    _attemptUntilChar(char) {
        while (this._peek !== char) {
            this._advance();
        }
    }
    /**
     * @param {?} decodeEntities
     * @return {?}
     */
    _readChar(decodeEntities) {
        if (decodeEntities && this._peek === chars.$AMPERSAND) {
            return this._decodeEntity();
        }
        else {
            const /** @type {?} */ index = this._index;
            this._advance();
            return this._input[index];
        }
    }
    /**
     * @return {?}
     */
    _decodeEntity() {
        const /** @type {?} */ start = this._getLocation();
        this._advance();
        if (this._attemptCharCode(chars.$HASH)) {
            const /** @type {?} */ isHex = this._attemptCharCode(chars.$x) || this._attemptCharCode(chars.$X);
            const /** @type {?} */ numberStart = this._getLocation().offset;
            this._attemptCharCodeUntilFn(isDigitEntityEnd);
            if (this._peek != chars.$SEMICOLON) {
                throw this._createError(_unexpectedCharacterErrorMsg(this._peek), this._getSpan());
            }
            this._advance();
            const /** @type {?} */ strNum = this._input.substring(numberStart, this._index - 1);
            try {
                const /** @type {?} */ charCode = parseInt(strNum, isHex ? 16 : 10);
                return String.fromCharCode(charCode);
            }
            catch (/** @type {?} */ e) {
                const /** @type {?} */ entity = this._input.substring(start.offset + 1, this._index - 1);
                throw this._createError(_unknownEntityErrorMsg(entity), this._getSpan(start));
            }
        }
        else {
            const /** @type {?} */ startPosition = this._savePosition();
            this._attemptCharCodeUntilFn(isNamedEntityEnd);
            if (this._peek != chars.$SEMICOLON) {
                this._restorePosition(startPosition);
                return '&';
            }
            this._advance();
            const /** @type {?} */ name = this._input.substring(start.offset + 1, this._index - 1);
            const /** @type {?} */ char = NAMED_ENTITIES[name];
            if (!char) {
                throw this._createError(_unknownEntityErrorMsg(name), this._getSpan(start));
            }
            return char;
        }
    }
    /**
     * @param {?} decodeEntities
     * @param {?} firstCharOfEnd
     * @param {?} attemptEndRest
     * @return {?}
     */
    _consumeRawText(decodeEntities, firstCharOfEnd, attemptEndRest) {
        let /** @type {?} */ tagCloseStart;
        const /** @type {?} */ textStart = this._getLocation();
        this._beginToken(decodeEntities ? TokenType.ESCAPABLE_RAW_TEXT : TokenType.RAW_TEXT, textStart);
        const /** @type {?} */ parts = [];
        while (true) {
            tagCloseStart = this._getLocation();
            if (this._attemptCharCode(firstCharOfEnd) && attemptEndRest()) {
                break;
            }
            if (this._index > tagCloseStart.offset) {
                // add the characters consumed by the previous if statement to the output
                parts.push(this._input.substring(tagCloseStart.offset, this._index));
            }
            while (this._peek !== firstCharOfEnd) {
                parts.push(this._readChar(decodeEntities));
            }
        }
        return this._endToken([this._processCarriageReturns(parts.join(''))], tagCloseStart);
    }
    /**
     * @param {?} start
     * @return {?}
     */
    _consumeComment(start) {
        this._beginToken(TokenType.COMMENT_START, start);
        this._requireCharCode(chars.$MINUS);
        this._endToken([]);
        const /** @type {?} */ textToken = this._consumeRawText(false, chars.$MINUS, () => this._attemptStr('->'));
        this._beginToken(TokenType.COMMENT_END, textToken.sourceSpan.end);
        this._endToken([]);
    }
    /**
     * @param {?} start
     * @return {?}
     */
    _consumeCdata(start) {
        this._beginToken(TokenType.CDATA_START, start);
        this._requireStr('CDATA[');
        this._endToken([]);
        const /** @type {?} */ textToken = this._consumeRawText(false, chars.$RBRACKET, () => this._attemptStr(']>'));
        this._beginToken(TokenType.CDATA_END, textToken.sourceSpan.end);
        this._endToken([]);
    }
    /**
     * @param {?} start
     * @return {?}
     */
    _consumeDocType(start) {
        this._beginToken(TokenType.DOC_TYPE, start);
        this._attemptUntilChar(chars.$GT);
        this._advance();
        this._endToken([this._input.substring(start.offset + 2, this._index - 1)]);
    }
    /**
     * @return {?}
     */
    _consumePrefixAndName() {
        const /** @type {?} */ nameOrPrefixStart = this._index;
        let /** @type {?} */ prefix = /** @type {?} */ ((null));
        while (this._peek !== chars.$COLON && !isPrefixEnd(this._peek)) {
            this._advance();
        }
        let /** @type {?} */ nameStart;
        if (this._peek === chars.$COLON) {
            this._advance();
            prefix = this._input.substring(nameOrPrefixStart, this._index - 1);
            nameStart = this._index;
        }
        else {
            nameStart = nameOrPrefixStart;
        }
        this._requireCharCodeUntilFn(isNameEnd, this._index === nameStart ? 1 : 0);
        const /** @type {?} */ name = this._input.substring(nameStart, this._index);
        return [prefix, name];
    }
    /**
     * @param {?} start
     * @return {?}
     */
    _consumeTagOpen(start) {
        const /** @type {?} */ savedPos = this._savePosition();
        let /** @type {?} */ tagName;
        let /** @type {?} */ lowercaseTagName;
        try {
            if (!chars.isAsciiLetter(this._peek)) {
                throw this._createError(_unexpectedCharacterErrorMsg(this._peek), this._getSpan());
            }
            const /** @type {?} */ nameStart = this._index;
            this._consumeTagOpenStart(start);
            tagName = this._input.substring(nameStart, this._index);
            lowercaseTagName = tagName.toLowerCase();
            this._attemptCharCodeUntilFn(isNotWhitespace);
            while (this._peek !== chars.$SLASH && this._peek !== chars.$GT) {
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
        catch (/** @type {?} */ e) {
            if (e instanceof _ControlFlowError) {
                // When the start tag is invalid, assume we want a "<"
                this._restorePosition(savedPos);
                // Back to back text tokens are merged at the end
                this._beginToken(TokenType.TEXT, start);
                this._endToken(['<']);
                return;
            }
            throw e;
        }
        const /** @type {?} */ contentTokenType = this._getTagDefinition(tagName).contentType;
        if (contentTokenType === TagContentType.RAW_TEXT) {
            this._consumeRawTextWithTagClose(lowercaseTagName, false);
        }
        else if (contentTokenType === TagContentType.ESCAPABLE_RAW_TEXT) {
            this._consumeRawTextWithTagClose(lowercaseTagName, true);
        }
    }
    /**
     * @param {?} lowercaseTagName
     * @param {?} decodeEntities
     * @return {?}
     */
    _consumeRawTextWithTagClose(lowercaseTagName, decodeEntities) {
        const /** @type {?} */ textToken = this._consumeRawText(decodeEntities, chars.$LT, () => {
            if (!this._attemptCharCode(chars.$SLASH))
                return false;
            this._attemptCharCodeUntilFn(isNotWhitespace);
            if (!this._attemptStrCaseInsensitive(lowercaseTagName))
                return false;
            this._attemptCharCodeUntilFn(isNotWhitespace);
            return this._attemptCharCode(chars.$GT);
        });
        this._beginToken(TokenType.TAG_CLOSE, textToken.sourceSpan.end);
        this._endToken([/** @type {?} */ ((null)), lowercaseTagName]);
    }
    /**
     * @param {?} start
     * @return {?}
     */
    _consumeTagOpenStart(start) {
        this._beginToken(TokenType.TAG_OPEN_START, start);
        const /** @type {?} */ parts = this._consumePrefixAndName();
        this._endToken(parts);
    }
    /**
     * @return {?}
     */
    _consumeAttributeName() {
        this._beginToken(TokenType.ATTR_NAME);
        const /** @type {?} */ prefixAndName = this._consumePrefixAndName();
        this._endToken(prefixAndName);
    }
    /**
     * @return {?}
     */
    _consumeAttributeValue() {
        this._beginToken(TokenType.ATTR_VALUE);
        let /** @type {?} */ value;
        if (this._peek === chars.$SQ || this._peek === chars.$DQ) {
            const /** @type {?} */ quoteChar = this._peek;
            this._advance();
            const /** @type {?} */ parts = [];
            while (this._peek !== quoteChar) {
                parts.push(this._readChar(true));
            }
            value = parts.join('');
            this._advance();
        }
        else {
            const /** @type {?} */ valueStart = this._index;
            this._requireCharCodeUntilFn(isNameEnd, 1);
            value = this._input.substring(valueStart, this._index);
        }
        this._endToken([this._processCarriageReturns(value)]);
    }
    /**
     * @return {?}
     */
    _consumeTagOpenEnd() {
        const /** @type {?} */ tokenType = this._attemptCharCode(chars.$SLASH) ? TokenType.TAG_OPEN_END_VOID : TokenType.TAG_OPEN_END;
        this._beginToken(tokenType);
        this._requireCharCode(chars.$GT);
        this._endToken([]);
    }
    /**
     * @param {?} start
     * @return {?}
     */
    _consumeTagClose(start) {
        this._beginToken(TokenType.TAG_CLOSE, start);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        const /** @type {?} */ prefixAndName = this._consumePrefixAndName();
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._requireCharCode(chars.$GT);
        this._endToken(prefixAndName);
    }
    /**
     * @return {?}
     */
    _consumeExpansionFormStart() {
        this._beginToken(TokenType.EXPANSION_FORM_START, this._getLocation());
        this._requireCharCode(chars.$LBRACE);
        this._endToken([]);
        this._expansionCaseStack.push(TokenType.EXPANSION_FORM_START);
        this._beginToken(TokenType.RAW_TEXT, this._getLocation());
        const /** @type {?} */ condition = this._readUntil(chars.$COMMA);
        this._endToken([condition], this._getLocation());
        this._requireCharCode(chars.$COMMA);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._beginToken(TokenType.RAW_TEXT, this._getLocation());
        const /** @type {?} */ type = this._readUntil(chars.$COMMA);
        this._endToken([type], this._getLocation());
        this._requireCharCode(chars.$COMMA);
        this._attemptCharCodeUntilFn(isNotWhitespace);
    }
    /**
     * @return {?}
     */
    _consumeExpansionCaseStart() {
        this._beginToken(TokenType.EXPANSION_CASE_VALUE, this._getLocation());
        const /** @type {?} */ value = this._readUntil(chars.$LBRACE).trim();
        this._endToken([value], this._getLocation());
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._beginToken(TokenType.EXPANSION_CASE_EXP_START, this._getLocation());
        this._requireCharCode(chars.$LBRACE);
        this._endToken([], this._getLocation());
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._expansionCaseStack.push(TokenType.EXPANSION_CASE_EXP_START);
    }
    /**
     * @return {?}
     */
    _consumeExpansionCaseEnd() {
        this._beginToken(TokenType.EXPANSION_CASE_EXP_END, this._getLocation());
        this._requireCharCode(chars.$RBRACE);
        this._endToken([], this._getLocation());
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._expansionCaseStack.pop();
    }
    /**
     * @return {?}
     */
    _consumeExpansionFormEnd() {
        this._beginToken(TokenType.EXPANSION_FORM_END, this._getLocation());
        this._requireCharCode(chars.$RBRACE);
        this._endToken([]);
        this._expansionCaseStack.pop();
    }
    /**
     * @return {?}
     */
    _consumeText() {
        const /** @type {?} */ start = this._getLocation();
        this._beginToken(TokenType.TEXT, start);
        const /** @type {?} */ parts = [];
        do {
            if (this._interpolationConfig && this._attemptStr(this._interpolationConfig.start)) {
                parts.push(this._interpolationConfig.start);
                this._inInterpolation = true;
            }
            else if (this._interpolationConfig && this._inInterpolation &&
                this._attemptStr(this._interpolationConfig.end)) {
                parts.push(this._interpolationConfig.end);
                this._inInterpolation = false;
            }
            else {
                parts.push(this._readChar(true));
            }
        } while (!this._isTextEnd());
        this._endToken([this._processCarriageReturns(parts.join(''))]);
    }
    /**
     * @return {?}
     */
    _isTextEnd() {
        if (this._peek === chars.$LT || this._peek === chars.$EOF) {
            return true;
        }
        if (this._tokenizeIcu && !this._inInterpolation) {
            if (isExpansionFormStart(this._input, this._index, this._interpolationConfig)) {
                // start of an expansion form
                return true;
            }
            if (this._peek === chars.$RBRACE && this._isInExpansionCase()) {
                // end of and expansion case
                return true;
            }
        }
        return false;
    }
    /**
     * @return {?}
     */
    _savePosition() {
        return [this._peek, this._index, this._column, this._line, this.tokens.length];
    }
    /**
     * @param {?} char
     * @return {?}
     */
    _readUntil(char) {
        const /** @type {?} */ start = this._index;
        this._attemptUntilChar(char);
        return this._input.substring(start, this._index);
    }
    /**
     * @param {?} position
     * @return {?}
     */
    _restorePosition(position) {
        this._peek = position[0];
        this._index = position[1];
        this._column = position[2];
        this._line = position[3];
        const /** @type {?} */ nbTokens = position[4];
        if (nbTokens < this.tokens.length) {
            // remove any extra tokens
            this.tokens = this.tokens.slice(0, nbTokens);
        }
    }
    /**
     * @return {?}
     */
    _isInExpansionCase() {
        return this._expansionCaseStack.length > 0 &&
            this._expansionCaseStack[this._expansionCaseStack.length - 1] ===
                TokenType.EXPANSION_CASE_EXP_START;
    }
    /**
     * @return {?}
     */
    _isInExpansionForm() {
        return this._expansionCaseStack.length > 0 &&
            this._expansionCaseStack[this._expansionCaseStack.length - 1] ===
                TokenType.EXPANSION_FORM_START;
    }
}
function _Tokenizer_tsickle_Closure_declarations() {
    /** @type {?} */
    _Tokenizer.prototype._input;
    /** @type {?} */
    _Tokenizer.prototype._length;
    /** @type {?} */
    _Tokenizer.prototype._peek;
    /** @type {?} */
    _Tokenizer.prototype._nextPeek;
    /** @type {?} */
    _Tokenizer.prototype._index;
    /** @type {?} */
    _Tokenizer.prototype._line;
    /** @type {?} */
    _Tokenizer.prototype._column;
    /** @type {?} */
    _Tokenizer.prototype._currentTokenStart;
    /** @type {?} */
    _Tokenizer.prototype._currentTokenType;
    /** @type {?} */
    _Tokenizer.prototype._expansionCaseStack;
    /** @type {?} */
    _Tokenizer.prototype._inInterpolation;
    /** @type {?} */
    _Tokenizer.prototype.tokens;
    /** @type {?} */
    _Tokenizer.prototype.errors;
    /** @type {?} */
    _Tokenizer.prototype._file;
    /** @type {?} */
    _Tokenizer.prototype._getTagDefinition;
    /** @type {?} */
    _Tokenizer.prototype._tokenizeIcu;
    /** @type {?} */
    _Tokenizer.prototype._interpolationConfig;
}
/**
 * @param {?} code
 * @return {?}
 */
function isNotWhitespace(code) {
    return !chars.isWhitespace(code) || code === chars.$EOF;
}
/**
 * @param {?} code
 * @return {?}
 */
function isNameEnd(code) {
    return chars.isWhitespace(code) || code === chars.$GT || code === chars.$SLASH ||
        code === chars.$SQ || code === chars.$DQ || code === chars.$EQ;
}
/**
 * @param {?} code
 * @return {?}
 */
function isPrefixEnd(code) {
    return (code < chars.$a || chars.$z < code) && (code < chars.$A || chars.$Z < code) &&
        (code < chars.$0 || code > chars.$9);
}
/**
 * @param {?} code
 * @return {?}
 */
function isDigitEntityEnd(code) {
    return code == chars.$SEMICOLON || code == chars.$EOF || !chars.isAsciiHexDigit(code);
}
/**
 * @param {?} code
 * @return {?}
 */
function isNamedEntityEnd(code) {
    return code == chars.$SEMICOLON || code == chars.$EOF || !chars.isAsciiLetter(code);
}
/**
 * @param {?} input
 * @param {?} offset
 * @param {?} interpolationConfig
 * @return {?}
 */
function isExpansionFormStart(input, offset, interpolationConfig) {
    const /** @type {?} */ isInterpolationStart = interpolationConfig ? input.indexOf(interpolationConfig.start, offset) == offset : false;
    return input.charCodeAt(offset) == chars.$LBRACE && !isInterpolationStart;
}
/**
 * @param {?} peek
 * @return {?}
 */
function isExpansionCaseStart(peek) {
    return peek === chars.$EQ || chars.isAsciiLetter(peek) || chars.isDigit(peek);
}
/**
 * @param {?} code1
 * @param {?} code2
 * @return {?}
 */
function compareCharCodeCaseInsensitive(code1, code2) {
    return toUpperCaseCharCode(code1) == toUpperCaseCharCode(code2);
}
/**
 * @param {?} code
 * @return {?}
 */
function toUpperCaseCharCode(code) {
    return code >= chars.$a && code <= chars.$z ? code - chars.$a + chars.$A : code;
}
/**
 * @param {?} srcTokens
 * @return {?}
 */
function mergeTextTokens(srcTokens) {
    const /** @type {?} */ dstTokens = [];
    let /** @type {?} */ lastDstToken = undefined;
    for (let /** @type {?} */ i = 0; i < srcTokens.length; i++) {
        const /** @type {?} */ token = srcTokens[i];
        if (lastDstToken && lastDstToken.type == TokenType.TEXT && token.type == TokenType.TEXT) {
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
//# sourceMappingURL=lexer.js.map