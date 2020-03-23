/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __assign, __extends } from "tslib";
import * as chars from '../chars';
import { ParseError, ParseLocation, ParseSourceFile, ParseSourceSpan } from '../parse_util';
import { DEFAULT_INTERPOLATION_CONFIG } from './interpolation_config';
import { NAMED_ENTITIES, TagContentType } from './tags';
export var TokenType;
(function (TokenType) {
    TokenType[TokenType["TAG_OPEN_START"] = 0] = "TAG_OPEN_START";
    TokenType[TokenType["TAG_OPEN_END"] = 1] = "TAG_OPEN_END";
    TokenType[TokenType["TAG_OPEN_END_VOID"] = 2] = "TAG_OPEN_END_VOID";
    TokenType[TokenType["TAG_CLOSE"] = 3] = "TAG_CLOSE";
    TokenType[TokenType["TEXT"] = 4] = "TEXT";
    TokenType[TokenType["ESCAPABLE_RAW_TEXT"] = 5] = "ESCAPABLE_RAW_TEXT";
    TokenType[TokenType["RAW_TEXT"] = 6] = "RAW_TEXT";
    TokenType[TokenType["COMMENT_START"] = 7] = "COMMENT_START";
    TokenType[TokenType["COMMENT_END"] = 8] = "COMMENT_END";
    TokenType[TokenType["CDATA_START"] = 9] = "CDATA_START";
    TokenType[TokenType["CDATA_END"] = 10] = "CDATA_END";
    TokenType[TokenType["ATTR_NAME"] = 11] = "ATTR_NAME";
    TokenType[TokenType["ATTR_QUOTE"] = 12] = "ATTR_QUOTE";
    TokenType[TokenType["ATTR_VALUE"] = 13] = "ATTR_VALUE";
    TokenType[TokenType["DOC_TYPE"] = 14] = "DOC_TYPE";
    TokenType[TokenType["EXPANSION_FORM_START"] = 15] = "EXPANSION_FORM_START";
    TokenType[TokenType["EXPANSION_CASE_VALUE"] = 16] = "EXPANSION_CASE_VALUE";
    TokenType[TokenType["EXPANSION_CASE_EXP_START"] = 17] = "EXPANSION_CASE_EXP_START";
    TokenType[TokenType["EXPANSION_CASE_EXP_END"] = 18] = "EXPANSION_CASE_EXP_END";
    TokenType[TokenType["EXPANSION_FORM_END"] = 19] = "EXPANSION_FORM_END";
    TokenType[TokenType["EOF"] = 20] = "EOF";
})(TokenType || (TokenType = {}));
var Token = /** @class */ (function () {
    function Token(type, parts, sourceSpan) {
        this.type = type;
        this.parts = parts;
        this.sourceSpan = sourceSpan;
    }
    return Token;
}());
export { Token };
var TokenError = /** @class */ (function (_super) {
    __extends(TokenError, _super);
    function TokenError(errorMsg, tokenType, span) {
        var _this = _super.call(this, span, errorMsg) || this;
        _this.tokenType = tokenType;
        return _this;
    }
    return TokenError;
}(ParseError));
export { TokenError };
var TokenizeResult = /** @class */ (function () {
    function TokenizeResult(tokens, errors) {
        this.tokens = tokens;
        this.errors = errors;
    }
    return TokenizeResult;
}());
export { TokenizeResult };
export function tokenize(source, url, getTagDefinition, options) {
    if (options === void 0) { options = {}; }
    return new _Tokenizer(new ParseSourceFile(source, url), getTagDefinition, options).tokenize();
}
var _CR_OR_CRLF_REGEXP = /\r\n?/g;
function _unexpectedCharacterErrorMsg(charCode) {
    var char = charCode === chars.$EOF ? 'EOF' : String.fromCharCode(charCode);
    return "Unexpected character \"" + char + "\"";
}
function _unknownEntityErrorMsg(entitySrc) {
    return "Unknown entity \"" + entitySrc + "\" - use the \"&#<decimal>;\" or  \"&#x<hex>;\" syntax";
}
var _ControlFlowError = /** @class */ (function () {
    function _ControlFlowError(error) {
        this.error = error;
    }
    return _ControlFlowError;
}());
// See http://www.w3.org/TR/html51/syntax.html#writing
var _Tokenizer = /** @class */ (function () {
    /**
     * @param _file The html source file being tokenized.
     * @param _getTagDefinition A function that will retrieve a tag definition for a given tag name.
     * @param options Configuration of the tokenization.
     */
    function _Tokenizer(_file, _getTagDefinition, options) {
        this._getTagDefinition = _getTagDefinition;
        this._currentTokenStart = null;
        this._currentTokenType = null;
        this._expansionCaseStack = [];
        this._inInterpolation = false;
        this.tokens = [];
        this.errors = [];
        this._tokenizeIcu = options.tokenizeExpansionForms || false;
        this._interpolationConfig = options.interpolationConfig || DEFAULT_INTERPOLATION_CONFIG;
        this._leadingTriviaCodePoints =
            options.leadingTriviaChars && options.leadingTriviaChars.map(function (c) { return c.codePointAt(0) || 0; });
        var range = options.range || { endPos: _file.content.length, startPos: 0, startLine: 0, startCol: 0 };
        this._cursor = options.escapedString ? new EscapedCharacterCursor(_file, range) :
            new PlainCharacterCursor(_file, range);
        this._preserveLineEndings = options.preserveLineEndings || false;
        try {
            this._cursor.init();
        }
        catch (e) {
            this.handleError(e);
        }
    }
    _Tokenizer.prototype._processCarriageReturns = function (content) {
        if (this._preserveLineEndings) {
            return content;
        }
        // http://www.w3.org/TR/html5/syntax.html#preprocessing-the-input-stream
        // In order to keep the original position in the source, we can not
        // pre-process it.
        // Instead CRs are processed right before instantiating the tokens.
        return content.replace(_CR_OR_CRLF_REGEXP, '\n');
    };
    _Tokenizer.prototype.tokenize = function () {
        while (this._cursor.peek() !== chars.$EOF) {
            var start = this._cursor.clone();
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
            catch (e) {
                this.handleError(e);
            }
        }
        this._beginToken(TokenType.EOF);
        this._endToken([]);
        return new TokenizeResult(mergeTextTokens(this.tokens), this.errors);
    };
    /**
     * @returns whether an ICU token has been created
     * @internal
     */
    _Tokenizer.prototype._tokenizeExpansionForm = function () {
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
    };
    _Tokenizer.prototype._beginToken = function (type, start) {
        if (start === void 0) { start = this._cursor.clone(); }
        this._currentTokenStart = start;
        this._currentTokenType = type;
    };
    _Tokenizer.prototype._endToken = function (parts, end) {
        if (this._currentTokenStart === null) {
            throw new TokenError('Programming error - attempted to end a token when there was no start to the token', this._currentTokenType, this._cursor.getSpan(end));
        }
        if (this._currentTokenType === null) {
            throw new TokenError('Programming error - attempted to end a token which has no token type', null, this._cursor.getSpan(this._currentTokenStart));
        }
        var token = new Token(this._currentTokenType, parts, this._cursor.getSpan(this._currentTokenStart, this._leadingTriviaCodePoints));
        this.tokens.push(token);
        this._currentTokenStart = null;
        this._currentTokenType = null;
        return token;
    };
    _Tokenizer.prototype._createError = function (msg, span) {
        if (this._isInExpansionForm()) {
            msg += " (Do you have an unescaped \"{\" in your template? Use \"{{ '{' }}\") to escape it.)";
        }
        var error = new TokenError(msg, this._currentTokenType, span);
        this._currentTokenStart = null;
        this._currentTokenType = null;
        return new _ControlFlowError(error);
    };
    _Tokenizer.prototype.handleError = function (e) {
        if (e instanceof CursorError) {
            e = this._createError(e.msg, this._cursor.getSpan(e.cursor));
        }
        if (e instanceof _ControlFlowError) {
            this.errors.push(e.error);
        }
        else {
            throw e;
        }
    };
    _Tokenizer.prototype._attemptCharCode = function (charCode) {
        if (this._cursor.peek() === charCode) {
            this._cursor.advance();
            return true;
        }
        return false;
    };
    _Tokenizer.prototype._attemptCharCodeCaseInsensitive = function (charCode) {
        if (compareCharCodeCaseInsensitive(this._cursor.peek(), charCode)) {
            this._cursor.advance();
            return true;
        }
        return false;
    };
    _Tokenizer.prototype._requireCharCode = function (charCode) {
        var location = this._cursor.clone();
        if (!this._attemptCharCode(charCode)) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(location));
        }
    };
    _Tokenizer.prototype._attemptStr = function (chars) {
        var len = chars.length;
        if (this._cursor.charsLeft() < len) {
            return false;
        }
        var initialPosition = this._cursor.clone();
        for (var i = 0; i < len; i++) {
            if (!this._attemptCharCode(chars.charCodeAt(i))) {
                // If attempting to parse the string fails, we want to reset the parser
                // to where it was before the attempt
                this._cursor = initialPosition;
                return false;
            }
        }
        return true;
    };
    _Tokenizer.prototype._attemptStrCaseInsensitive = function (chars) {
        for (var i = 0; i < chars.length; i++) {
            if (!this._attemptCharCodeCaseInsensitive(chars.charCodeAt(i))) {
                return false;
            }
        }
        return true;
    };
    _Tokenizer.prototype._requireStr = function (chars) {
        var location = this._cursor.clone();
        if (!this._attemptStr(chars)) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(location));
        }
    };
    _Tokenizer.prototype._attemptCharCodeUntilFn = function (predicate) {
        while (!predicate(this._cursor.peek())) {
            this._cursor.advance();
        }
    };
    _Tokenizer.prototype._requireCharCodeUntilFn = function (predicate, len) {
        var start = this._cursor.clone();
        this._attemptCharCodeUntilFn(predicate);
        if (this._cursor.diff(start) < len) {
            throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(start));
        }
    };
    _Tokenizer.prototype._attemptUntilChar = function (char) {
        while (this._cursor.peek() !== char) {
            this._cursor.advance();
        }
    };
    _Tokenizer.prototype._readChar = function (decodeEntities) {
        if (decodeEntities && this._cursor.peek() === chars.$AMPERSAND) {
            return this._decodeEntity();
        }
        else {
            // Don't rely upon reading directly from `_input` as the actual char value
            // may have been generated from an escape sequence.
            var char = String.fromCodePoint(this._cursor.peek());
            this._cursor.advance();
            return char;
        }
    };
    _Tokenizer.prototype._decodeEntity = function () {
        var start = this._cursor.clone();
        this._cursor.advance();
        if (this._attemptCharCode(chars.$HASH)) {
            var isHex = this._attemptCharCode(chars.$x) || this._attemptCharCode(chars.$X);
            var codeStart = this._cursor.clone();
            this._attemptCharCodeUntilFn(isDigitEntityEnd);
            if (this._cursor.peek() != chars.$SEMICOLON) {
                throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan());
            }
            var strNum = this._cursor.getChars(codeStart);
            this._cursor.advance();
            try {
                var charCode = parseInt(strNum, isHex ? 16 : 10);
                return String.fromCharCode(charCode);
            }
            catch (_a) {
                throw this._createError(_unknownEntityErrorMsg(this._cursor.getChars(start)), this._cursor.getSpan());
            }
        }
        else {
            var nameStart = this._cursor.clone();
            this._attemptCharCodeUntilFn(isNamedEntityEnd);
            if (this._cursor.peek() != chars.$SEMICOLON) {
                this._cursor = nameStart;
                return '&';
            }
            var name_1 = this._cursor.getChars(nameStart);
            this._cursor.advance();
            var char = NAMED_ENTITIES[name_1];
            if (!char) {
                throw this._createError(_unknownEntityErrorMsg(name_1), this._cursor.getSpan(start));
            }
            return char;
        }
    };
    _Tokenizer.prototype._consumeRawText = function (decodeEntities, endMarkerPredicate) {
        this._beginToken(decodeEntities ? TokenType.ESCAPABLE_RAW_TEXT : TokenType.RAW_TEXT);
        var parts = [];
        while (true) {
            var tagCloseStart = this._cursor.clone();
            var foundEndMarker = endMarkerPredicate();
            this._cursor = tagCloseStart;
            if (foundEndMarker) {
                break;
            }
            parts.push(this._readChar(decodeEntities));
        }
        return this._endToken([this._processCarriageReturns(parts.join(''))]);
    };
    _Tokenizer.prototype._consumeComment = function (start) {
        var _this = this;
        this._beginToken(TokenType.COMMENT_START, start);
        this._requireCharCode(chars.$MINUS);
        this._endToken([]);
        this._consumeRawText(false, function () { return _this._attemptStr('-->'); });
        this._beginToken(TokenType.COMMENT_END);
        this._requireStr('-->');
        this._endToken([]);
    };
    _Tokenizer.prototype._consumeCdata = function (start) {
        var _this = this;
        this._beginToken(TokenType.CDATA_START, start);
        this._requireStr('CDATA[');
        this._endToken([]);
        this._consumeRawText(false, function () { return _this._attemptStr(']]>'); });
        this._beginToken(TokenType.CDATA_END);
        this._requireStr(']]>');
        this._endToken([]);
    };
    _Tokenizer.prototype._consumeDocType = function (start) {
        this._beginToken(TokenType.DOC_TYPE, start);
        var contentStart = this._cursor.clone();
        this._attemptUntilChar(chars.$GT);
        var content = this._cursor.getChars(contentStart);
        this._cursor.advance();
        this._endToken([content]);
    };
    _Tokenizer.prototype._consumePrefixAndName = function () {
        var nameOrPrefixStart = this._cursor.clone();
        var prefix = '';
        while (this._cursor.peek() !== chars.$COLON && !isPrefixEnd(this._cursor.peek())) {
            this._cursor.advance();
        }
        var nameStart;
        if (this._cursor.peek() === chars.$COLON) {
            prefix = this._cursor.getChars(nameOrPrefixStart);
            this._cursor.advance();
            nameStart = this._cursor.clone();
        }
        else {
            nameStart = nameOrPrefixStart;
        }
        this._requireCharCodeUntilFn(isNameEnd, prefix === '' ? 0 : 1);
        var name = this._cursor.getChars(nameStart);
        return [prefix, name];
    };
    _Tokenizer.prototype._consumeTagOpen = function (start) {
        var tagName;
        var prefix;
        var openTagToken;
        var tokensBeforeTagOpen = this.tokens.length;
        var innerStart = this._cursor.clone();
        try {
            if (!chars.isAsciiLetter(this._cursor.peek())) {
                throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(start));
            }
            openTagToken = this._consumeTagOpenStart(start);
            prefix = openTagToken.parts[0];
            tagName = openTagToken.parts[1];
            this._attemptCharCodeUntilFn(isNotWhitespace);
            while (this._cursor.peek() !== chars.$SLASH && this._cursor.peek() !== chars.$GT) {
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
                // When the start tag is invalid (including invalid "attributes"), assume we want a "<"
                this._cursor = innerStart;
                if (openTagToken) {
                    this.tokens.length = tokensBeforeTagOpen;
                }
                // Back to back text tokens are merged at the end
                this._beginToken(TokenType.TEXT, start);
                this._endToken(['<']);
                return;
            }
            throw e;
        }
        var contentTokenType = this._getTagDefinition(tagName).contentType;
        if (contentTokenType === TagContentType.RAW_TEXT) {
            this._consumeRawTextWithTagClose(prefix, tagName, false);
        }
        else if (contentTokenType === TagContentType.ESCAPABLE_RAW_TEXT) {
            this._consumeRawTextWithTagClose(prefix, tagName, true);
        }
    };
    _Tokenizer.prototype._consumeRawTextWithTagClose = function (prefix, tagName, decodeEntities) {
        var _this = this;
        var textToken = this._consumeRawText(decodeEntities, function () {
            if (!_this._attemptCharCode(chars.$LT))
                return false;
            if (!_this._attemptCharCode(chars.$SLASH))
                return false;
            _this._attemptCharCodeUntilFn(isNotWhitespace);
            if (!_this._attemptStrCaseInsensitive(tagName))
                return false;
            _this._attemptCharCodeUntilFn(isNotWhitespace);
            return _this._attemptCharCode(chars.$GT);
        });
        this._beginToken(TokenType.TAG_CLOSE);
        this._requireCharCodeUntilFn(function (code) { return code === chars.$GT; }, 3);
        this._cursor.advance(); // Consume the `>`
        this._endToken([prefix, tagName]);
    };
    _Tokenizer.prototype._consumeTagOpenStart = function (start) {
        this._beginToken(TokenType.TAG_OPEN_START, start);
        var parts = this._consumePrefixAndName();
        return this._endToken(parts);
    };
    _Tokenizer.prototype._consumeAttributeName = function () {
        var attrNameStart = this._cursor.peek();
        if (attrNameStart === chars.$SQ || attrNameStart === chars.$DQ) {
            throw this._createError(_unexpectedCharacterErrorMsg(attrNameStart), this._cursor.getSpan());
        }
        this._beginToken(TokenType.ATTR_NAME);
        var prefixAndName = this._consumePrefixAndName();
        this._endToken(prefixAndName);
    };
    _Tokenizer.prototype._consumeAttributeValue = function () {
        var value;
        if (this._cursor.peek() === chars.$SQ || this._cursor.peek() === chars.$DQ) {
            this._beginToken(TokenType.ATTR_QUOTE);
            var quoteChar = this._cursor.peek();
            this._cursor.advance();
            this._endToken([String.fromCodePoint(quoteChar)]);
            this._beginToken(TokenType.ATTR_VALUE);
            var parts = [];
            while (this._cursor.peek() !== quoteChar) {
                parts.push(this._readChar(true));
            }
            value = parts.join('');
            this._endToken([this._processCarriageReturns(value)]);
            this._beginToken(TokenType.ATTR_QUOTE);
            this._cursor.advance();
            this._endToken([String.fromCodePoint(quoteChar)]);
        }
        else {
            this._beginToken(TokenType.ATTR_VALUE);
            var valueStart = this._cursor.clone();
            this._requireCharCodeUntilFn(isNameEnd, 1);
            value = this._cursor.getChars(valueStart);
            this._endToken([this._processCarriageReturns(value)]);
        }
    };
    _Tokenizer.prototype._consumeTagOpenEnd = function () {
        var tokenType = this._attemptCharCode(chars.$SLASH) ? TokenType.TAG_OPEN_END_VOID : TokenType.TAG_OPEN_END;
        this._beginToken(tokenType);
        this._requireCharCode(chars.$GT);
        this._endToken([]);
    };
    _Tokenizer.prototype._consumeTagClose = function (start) {
        this._beginToken(TokenType.TAG_CLOSE, start);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        var prefixAndName = this._consumePrefixAndName();
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._requireCharCode(chars.$GT);
        this._endToken(prefixAndName);
    };
    _Tokenizer.prototype._consumeExpansionFormStart = function () {
        this._beginToken(TokenType.EXPANSION_FORM_START);
        this._requireCharCode(chars.$LBRACE);
        this._endToken([]);
        this._expansionCaseStack.push(TokenType.EXPANSION_FORM_START);
        this._beginToken(TokenType.RAW_TEXT);
        var condition = this._readUntil(chars.$COMMA);
        this._endToken([condition]);
        this._requireCharCode(chars.$COMMA);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._beginToken(TokenType.RAW_TEXT);
        var type = this._readUntil(chars.$COMMA);
        this._endToken([type]);
        this._requireCharCode(chars.$COMMA);
        this._attemptCharCodeUntilFn(isNotWhitespace);
    };
    _Tokenizer.prototype._consumeExpansionCaseStart = function () {
        this._beginToken(TokenType.EXPANSION_CASE_VALUE);
        var value = this._readUntil(chars.$LBRACE).trim();
        this._endToken([value]);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._beginToken(TokenType.EXPANSION_CASE_EXP_START);
        this._requireCharCode(chars.$LBRACE);
        this._endToken([]);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._expansionCaseStack.push(TokenType.EXPANSION_CASE_EXP_START);
    };
    _Tokenizer.prototype._consumeExpansionCaseEnd = function () {
        this._beginToken(TokenType.EXPANSION_CASE_EXP_END);
        this._requireCharCode(chars.$RBRACE);
        this._endToken([]);
        this._attemptCharCodeUntilFn(isNotWhitespace);
        this._expansionCaseStack.pop();
    };
    _Tokenizer.prototype._consumeExpansionFormEnd = function () {
        this._beginToken(TokenType.EXPANSION_FORM_END);
        this._requireCharCode(chars.$RBRACE);
        this._endToken([]);
        this._expansionCaseStack.pop();
    };
    _Tokenizer.prototype._consumeText = function () {
        var start = this._cursor.clone();
        this._beginToken(TokenType.TEXT, start);
        var parts = [];
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
    };
    _Tokenizer.prototype._isTextEnd = function () {
        if (this._cursor.peek() === chars.$LT || this._cursor.peek() === chars.$EOF) {
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
        return false;
    };
    _Tokenizer.prototype._readUntil = function (char) {
        var start = this._cursor.clone();
        this._attemptUntilChar(char);
        return this._cursor.getChars(start);
    };
    _Tokenizer.prototype._isInExpansionCase = function () {
        return this._expansionCaseStack.length > 0 &&
            this._expansionCaseStack[this._expansionCaseStack.length - 1] ===
                TokenType.EXPANSION_CASE_EXP_START;
    };
    _Tokenizer.prototype._isInExpansionForm = function () {
        return this._expansionCaseStack.length > 0 &&
            this._expansionCaseStack[this._expansionCaseStack.length - 1] ===
                TokenType.EXPANSION_FORM_START;
    };
    _Tokenizer.prototype.isExpansionFormStart = function () {
        if (this._cursor.peek() !== chars.$LBRACE) {
            return false;
        }
        if (this._interpolationConfig) {
            var start = this._cursor.clone();
            var isInterpolation = this._attemptStr(this._interpolationConfig.start);
            this._cursor = start;
            return !isInterpolation;
        }
        return true;
    };
    return _Tokenizer;
}());
function isNotWhitespace(code) {
    return !chars.isWhitespace(code) || code === chars.$EOF;
}
function isNameEnd(code) {
    return chars.isWhitespace(code) || code === chars.$GT || code === chars.$SLASH ||
        code === chars.$SQ || code === chars.$DQ || code === chars.$EQ;
}
function isPrefixEnd(code) {
    return (code < chars.$a || chars.$z < code) && (code < chars.$A || chars.$Z < code) &&
        (code < chars.$0 || code > chars.$9);
}
function isDigitEntityEnd(code) {
    return code == chars.$SEMICOLON || code == chars.$EOF || !chars.isAsciiHexDigit(code);
}
function isNamedEntityEnd(code) {
    return code == chars.$SEMICOLON || code == chars.$EOF || !chars.isAsciiLetter(code);
}
function isExpansionCaseStart(peek) {
    return peek !== chars.$RBRACE;
}
function compareCharCodeCaseInsensitive(code1, code2) {
    return toUpperCaseCharCode(code1) == toUpperCaseCharCode(code2);
}
function toUpperCaseCharCode(code) {
    return code >= chars.$a && code <= chars.$z ? code - chars.$a + chars.$A : code;
}
function mergeTextTokens(srcTokens) {
    var dstTokens = [];
    var lastDstToken = undefined;
    for (var i = 0; i < srcTokens.length; i++) {
        var token = srcTokens[i];
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
var PlainCharacterCursor = /** @class */ (function () {
    function PlainCharacterCursor(fileOrCursor, range) {
        if (fileOrCursor instanceof PlainCharacterCursor) {
            this.file = fileOrCursor.file;
            this.input = fileOrCursor.input;
            this.end = fileOrCursor.end;
            var state = fileOrCursor.state;
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
    PlainCharacterCursor.prototype.clone = function () { return new PlainCharacterCursor(this); };
    PlainCharacterCursor.prototype.peek = function () { return this.state.peek; };
    PlainCharacterCursor.prototype.charsLeft = function () { return this.end - this.state.offset; };
    PlainCharacterCursor.prototype.diff = function (other) { return this.state.offset - other.state.offset; };
    PlainCharacterCursor.prototype.advance = function () { this.advanceState(this.state); };
    PlainCharacterCursor.prototype.init = function () { this.updatePeek(this.state); };
    PlainCharacterCursor.prototype.getSpan = function (start, leadingTriviaCodePoints) {
        start = start || this;
        var cloned = false;
        if (leadingTriviaCodePoints) {
            while (this.diff(start) > 0 && leadingTriviaCodePoints.indexOf(start.peek()) !== -1) {
                if (!cloned) {
                    start = start.clone();
                    cloned = true;
                }
                start.advance();
            }
        }
        return new ParseSourceSpan(new ParseLocation(start.file, start.state.offset, start.state.line, start.state.column), new ParseLocation(this.file, this.state.offset, this.state.line, this.state.column));
    };
    PlainCharacterCursor.prototype.getChars = function (start) {
        return this.input.substring(start.state.offset, this.state.offset);
    };
    PlainCharacterCursor.prototype.charAt = function (pos) { return this.input.charCodeAt(pos); };
    PlainCharacterCursor.prototype.advanceState = function (state) {
        if (state.offset >= this.end) {
            this.state = state;
            throw new CursorError('Unexpected character "EOF"', this);
        }
        var currentChar = this.charAt(state.offset);
        if (currentChar === chars.$LF) {
            state.line++;
            state.column = 0;
        }
        else if (!chars.isNewLine(currentChar)) {
            state.column++;
        }
        state.offset++;
        this.updatePeek(state);
    };
    PlainCharacterCursor.prototype.updatePeek = function (state) {
        state.peek = state.offset >= this.end ? chars.$EOF : this.charAt(state.offset);
    };
    return PlainCharacterCursor;
}());
var EscapedCharacterCursor = /** @class */ (function (_super) {
    __extends(EscapedCharacterCursor, _super);
    function EscapedCharacterCursor(fileOrCursor, range) {
        var _this = this;
        if (fileOrCursor instanceof EscapedCharacterCursor) {
            _this = _super.call(this, fileOrCursor) || this;
            _this.internalState = __assign({}, fileOrCursor.internalState);
        }
        else {
            _this = _super.call(this, fileOrCursor, range) || this;
            _this.internalState = _this.state;
        }
        return _this;
    }
    EscapedCharacterCursor.prototype.advance = function () {
        this.state = this.internalState;
        _super.prototype.advance.call(this);
        this.processEscapeSequence();
    };
    EscapedCharacterCursor.prototype.init = function () {
        _super.prototype.init.call(this);
        this.processEscapeSequence();
    };
    EscapedCharacterCursor.prototype.clone = function () { return new EscapedCharacterCursor(this); };
    EscapedCharacterCursor.prototype.getChars = function (start) {
        var cursor = start.clone();
        var chars = '';
        while (cursor.internalState.offset < this.internalState.offset) {
            chars += String.fromCodePoint(cursor.peek());
            cursor.advance();
        }
        return chars;
    };
    /**
     * Process the escape sequence that starts at the current position in the text.
     *
     * This method is called to ensure that `peek` has the unescaped value of escape sequences.
     */
    EscapedCharacterCursor.prototype.processEscapeSequence = function () {
        var _this = this;
        var peek = function () { return _this.internalState.peek; };
        if (peek() === chars.$BACKSLASH) {
            // We have hit an escape sequence so we need the internal state to become independent
            // of the external state.
            this.internalState = __assign({}, this.state);
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
                    var digitStart = this.clone();
                    var length_1 = 0;
                    while (peek() !== chars.$RBRACE) {
                        this.advanceState(this.internalState);
                        length_1++;
                    }
                    this.state.peek = this.decodeHexDigits(digitStart, length_1);
                }
                else {
                    // Fixed length Unicode, e.g. `\u1234`
                    var digitStart = this.clone();
                    this.advanceState(this.internalState);
                    this.advanceState(this.internalState);
                    this.advanceState(this.internalState);
                    this.state.peek = this.decodeHexDigits(digitStart, 4);
                }
            }
            else if (peek() === chars.$x) {
                // Hex char code, e.g. `\x2F`
                this.advanceState(this.internalState); // advance past the `x` char
                var digitStart = this.clone();
                this.advanceState(this.internalState);
                this.state.peek = this.decodeHexDigits(digitStart, 2);
            }
            else if (chars.isOctalDigit(peek())) {
                // Octal char code, e.g. `\012`,
                var octal = '';
                var length_2 = 0;
                var previous = this.clone();
                while (chars.isOctalDigit(peek()) && length_2 < 3) {
                    previous = this.clone();
                    octal += String.fromCodePoint(peek());
                    this.advanceState(this.internalState);
                    length_2++;
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
    };
    EscapedCharacterCursor.prototype.decodeHexDigits = function (start, length) {
        var hex = this.input.substr(start.internalState.offset, length);
        var charCode = parseInt(hex, 16);
        if (!isNaN(charCode)) {
            return charCode;
        }
        else {
            start.state = start.internalState;
            throw new CursorError('Invalid hexadecimal escape sequence', start);
        }
    };
    return EscapedCharacterCursor;
}(PlainCharacterCursor));
var CursorError = /** @class */ (function () {
    function CursorError(msg, cursor) {
        this.msg = msg;
        this.cursor = cursor;
    }
    return CursorError;
}());
export { CursorError };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV4ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2xleGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRTFGLE9BQU8sRUFBQyw0QkFBNEIsRUFBc0IsTUFBTSx3QkFBd0IsQ0FBQztBQUN6RixPQUFPLEVBQUMsY0FBYyxFQUFFLGNBQWMsRUFBZ0IsTUFBTSxRQUFRLENBQUM7QUFFckUsTUFBTSxDQUFOLElBQVksU0FzQlg7QUF0QkQsV0FBWSxTQUFTO0lBQ25CLDZEQUFjLENBQUE7SUFDZCx5REFBWSxDQUFBO0lBQ1osbUVBQWlCLENBQUE7SUFDakIsbURBQVMsQ0FBQTtJQUNULHlDQUFJLENBQUE7SUFDSixxRUFBa0IsQ0FBQTtJQUNsQixpREFBUSxDQUFBO0lBQ1IsMkRBQWEsQ0FBQTtJQUNiLHVEQUFXLENBQUE7SUFDWCx1REFBVyxDQUFBO0lBQ1gsb0RBQVMsQ0FBQTtJQUNULG9EQUFTLENBQUE7SUFDVCxzREFBVSxDQUFBO0lBQ1Ysc0RBQVUsQ0FBQTtJQUNWLGtEQUFRLENBQUE7SUFDUiwwRUFBb0IsQ0FBQTtJQUNwQiwwRUFBb0IsQ0FBQTtJQUNwQixrRkFBd0IsQ0FBQTtJQUN4Qiw4RUFBc0IsQ0FBQTtJQUN0QixzRUFBa0IsQ0FBQTtJQUNsQix3Q0FBRyxDQUFBO0FBQ0wsQ0FBQyxFQXRCVyxTQUFTLEtBQVQsU0FBUyxRQXNCcEI7QUFFRDtJQUNFLGVBQ1csSUFBb0IsRUFBUyxLQUFlLEVBQVMsVUFBMkI7UUFBaEYsU0FBSSxHQUFKLElBQUksQ0FBZ0I7UUFBUyxVQUFLLEdBQUwsS0FBSyxDQUFV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WUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFFLDJCQUEyQjtnQkFDbkUsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO2FBQ2pDO2lCQUVJO2dCQUNILDBGQUEwRjtnQkFDMUYsNEVBQTRFO2dCQUM1RSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQzthQUMzQztTQUNGO0lBQ0gsQ0FBQztJQUVTLGdEQUFlLEdBQXpCLFVBQTBCLEtBQTZCLEVBQUUsTUFBYztRQUNyRSxJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNsRSxJQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDcEIsT0FBTyxRQUFRLENBQUM7U0FDakI7YUFBTTtZQUNMLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQztZQUNsQyxNQUFNLElBQUksV0FBVyxDQUFDLHFDQUFxQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3JFO0lBQ0gsQ0FBQztJQUNILDZCQUFDO0FBQUQsQ0FBQyxBQTlJRCxDQUFxQyxvQkFBb0IsR0E4SXhEO0FBRUQ7SUFDRSxxQkFBbUIsR0FBVyxFQUFTLE1BQXVCO1FBQTNDLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFpQjtJQUFHLENBQUM7SUFDcEUsa0JBQUM7QUFBRCxDQUFDLEFBRkQsSUFFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi4vY2hhcnMnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUxvY2F0aW9uLCBQYXJzZVNvdXJjZUZpbGUsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge05BTUVEX0VOVElUSUVTLCBUYWdDb250ZW50VHlwZSwgVGFnRGVmaW5pdGlvbn0gZnJvbSAnLi90YWdzJztcblxuZXhwb3J0IGVudW0gVG9rZW5UeXBlIHtcbiAgVEFHX09QRU5fU1RBUlQsXG4gIFRBR19PUEVOX0VORCxcbiAgVEFHX09QRU5fRU5EX1ZPSUQsXG4gIFRBR19DTE9TRSxcbiAgVEVYVCxcbiAgRVNDQVBBQkxFX1JBV19URVhULFxuICBSQVdfVEVYVCxcbiAgQ09NTUVOVF9TVEFSVCxcbiAgQ09NTUVOVF9FTkQsXG4gIENEQVRBX1NUQVJULFxuICBDREFUQV9FTkQsXG4gIEFUVFJfTkFNRSxcbiAgQVRUUl9RVU9URSxcbiAgQVRUUl9WQUxVRSxcbiAgRE9DX1RZUEUsXG4gIEVYUEFOU0lPTl9GT1JNX1NUQVJULFxuICBFWFBBTlNJT05fQ0FTRV9WQUxVRSxcbiAgRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJULFxuICBFWFBBTlNJT05fQ0FTRV9FWFBfRU5ELFxuICBFWFBBTlNJT05fRk9STV9FTkQsXG4gIEVPRlxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0eXBlOiBUb2tlblR5cGV8bnVsbCwgcHVibGljIHBhcnRzOiBzdHJpbmdbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbn1cblxuZXhwb3J0IGNsYXNzIFRva2VuRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3IoZXJyb3JNc2c6IHN0cmluZywgcHVibGljIHRva2VuVHlwZTogVG9rZW5UeXBlfG51bGwsIHNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKHNwYW4sIGVycm9yTXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW5pemVSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdG9rZW5zOiBUb2tlbltdLCBwdWJsaWMgZXJyb3JzOiBUb2tlbkVycm9yW10pIHt9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGV4ZXJSYW5nZSB7XG4gIHN0YXJ0UG9zOiBudW1iZXI7XG4gIHN0YXJ0TGluZTogbnVtYmVyO1xuICBzdGFydENvbDogbnVtYmVyO1xuICBlbmRQb3M6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBPcHRpb25zIHRoYXQgbW9kaWZ5IGhvdyB0aGUgdGV4dCBpcyB0b2tlbml6ZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVG9rZW5pemVPcHRpb25zIHtcbiAgLyoqIFdoZXRoZXIgdG8gdG9rZW5pemUgSUNVIG1lc3NhZ2VzIChjb25zaWRlcmVkIGFzIHRleHQgbm9kZXMgd2hlbiBmYWxzZSkuICovXG4gIHRva2VuaXplRXhwYW5zaW9uRm9ybXM/OiBib29sZWFuO1xuICAvKiogSG93IHRvIHRva2VuaXplIGludGVycG9sYXRpb24gbWFya2Vycy4gKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgYW5kIGVuZCBwb2ludCBvZiB0aGUgdGV4dCB0byBwYXJzZSB3aXRoaW4gdGhlIGBzb3VyY2VgIHN0cmluZy5cbiAgICogVGhlIGVudGlyZSBgc291cmNlYCBzdHJpbmcgaXMgcGFyc2VkIGlmIHRoaXMgaXMgbm90IHByb3ZpZGVkLlxuICAgKiAqL1xuICByYW5nZT86IExleGVyUmFuZ2U7XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGEgSmF2YVNjcmlwdCBzdHJpbmcsIHRoZW4gd2UgaGF2ZSB0byBkZWFsIHdpdGggZXNjYXBlIHNlcXVlbmNlcy5cbiAgICpcbiAgICogKipFeGFtcGxlIDE6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcImRlZlxcbmdoaVwiXG4gICAqIGBgYFxuICAgKlxuICAgKiAtIFRoZSBgXFxcImAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYFwiYC5cbiAgICogLSBUaGUgYFxcbmAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYSBuZXcgbGluZSBjaGFyYWN0ZXIgaW4gYSB0b2tlbixcbiAgICogICBidXQgaXQgc2hvdWxkIG5vdCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqXG4gICAqICoqRXhhbXBsZSAyOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXG4gICAqICBkZWZcIlxuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGxpbmUgY29udGludWF0aW9uIChgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3bGluZSkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBhIHRva2VuXG4gICAqIGJ1dCB0aGUgbmV3IGxpbmUgc2hvdWxkIGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICovXG4gIGVzY2FwZWRTdHJpbmc/OiBib29sZWFuO1xuICAvKipcbiAgICogQW4gYXJyYXkgb2YgY2hhcmFjdGVycyB0aGF0IHNob3VsZCBiZSBjb25zaWRlcmVkIGFzIGxlYWRpbmcgdHJpdmlhLlxuICAgKiBMZWFkaW5nIHRyaXZpYSBhcmUgY2hhcmFjdGVycyB0aGF0IGFyZSBub3QgaW1wb3J0YW50IHRvIHRoZSBkZXZlbG9wZXIsIGFuZCBzbyBzaG91bGQgbm90IGJlXG4gICAqIGluY2x1ZGVkIGluIHNvdXJjZS1tYXAgc2VnbWVudHMuICBBIGNvbW1vbiBleGFtcGxlIGlzIHdoaXRlc3BhY2UuXG4gICAqL1xuICBsZWFkaW5nVHJpdmlhQ2hhcnM/OiBzdHJpbmdbXTtcbiAgLyoqXG4gICAqIElmIHRydWUsIGRvIG5vdCBjb252ZXJ0IENSTEYgdG8gTEYuXG4gICAqL1xuICBwcmVzZXJ2ZUxpbmVFbmRpbmdzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRva2VuaXplKFxuICAgIHNvdXJjZTogc3RyaW5nLCB1cmw6IHN0cmluZywgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbixcbiAgICBvcHRpb25zOiBUb2tlbml6ZU9wdGlvbnMgPSB7fSk6IFRva2VuaXplUmVzdWx0IHtcbiAgcmV0dXJuIG5ldyBfVG9rZW5pemVyKG5ldyBQYXJzZVNvdXJjZUZpbGUoc291cmNlLCB1cmwpLCBnZXRUYWdEZWZpbml0aW9uLCBvcHRpb25zKS50b2tlbml6ZSgpO1xufVxuXG5jb25zdCBfQ1JfT1JfQ1JMRl9SRUdFWFAgPSAvXFxyXFxuPy9nO1xuXG5mdW5jdGlvbiBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKGNoYXJDb2RlOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBjaGFyID0gY2hhckNvZGUgPT09IGNoYXJzLiRFT0YgPyAnRU9GJyA6IFN0cmluZy5mcm9tQ2hhckNvZGUoY2hhckNvZGUpO1xuICByZXR1cm4gYFVuZXhwZWN0ZWQgY2hhcmFjdGVyIFwiJHtjaGFyfVwiYDtcbn1cblxuZnVuY3Rpb24gX3Vua25vd25FbnRpdHlFcnJvck1zZyhlbnRpdHlTcmM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgVW5rbm93biBlbnRpdHkgXCIke2VudGl0eVNyY31cIiAtIHVzZSB0aGUgXCImIzxkZWNpbWFsPjtcIiBvciAgXCImI3g8aGV4PjtcIiBzeW50YXhgO1xufVxuXG5jbGFzcyBfQ29udHJvbEZsb3dFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlcnJvcjogVG9rZW5FcnJvcikge31cbn1cblxuLy8gU2VlIGh0dHA6Ly93d3cudzMub3JnL1RSL2h0bWw1MS9zeW50YXguaHRtbCN3cml0aW5nXG5jbGFzcyBfVG9rZW5pemVyIHtcbiAgcHJpdmF0ZSBfY3Vyc29yOiBDaGFyYWN0ZXJDdXJzb3I7XG4gIHByaXZhdGUgX3Rva2VuaXplSWN1OiBib29sZWFuO1xuICBwcml2YXRlIF9pbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICBwcml2YXRlIF9sZWFkaW5nVHJpdmlhQ29kZVBvaW50czogbnVtYmVyW118dW5kZWZpbmVkO1xuICBwcml2YXRlIF9jdXJyZW50VG9rZW5TdGFydDogQ2hhcmFjdGVyQ3Vyc29yfG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9jdXJyZW50VG9rZW5UeXBlOiBUb2tlblR5cGV8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2V4cGFuc2lvbkNhc2VTdGFjazogVG9rZW5UeXBlW10gPSBbXTtcbiAgcHJpdmF0ZSBfaW5JbnRlcnBvbGF0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3ByZXNlcnZlTGluZUVuZGluZ3M6IGJvb2xlYW47XG4gIHRva2VuczogVG9rZW5bXSA9IFtdO1xuICBlcnJvcnM6IFRva2VuRXJyb3JbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBAcGFyYW0gX2ZpbGUgVGhlIGh0bWwgc291cmNlIGZpbGUgYmVpbmcgdG9rZW5pemVkLlxuICAgKiBAcGFyYW0gX2dldFRhZ0RlZmluaXRpb24gQSBmdW5jdGlvbiB0aGF0IHdpbGwgcmV0cmlldmUgYSB0YWcgZGVmaW5pdGlvbiBmb3IgYSBnaXZlbiB0YWcgbmFtZS5cbiAgICogQHBhcmFtIG9wdGlvbnMgQ29uZmlndXJhdGlvbiBvZiB0aGUgdG9rZW5pemF0aW9uLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgICBfZmlsZTogUGFyc2VTb3VyY2VGaWxlLCBwcml2YXRlIF9nZXRUYWdEZWZpbml0aW9uOiAodGFnTmFtZTogc3RyaW5nKSA9PiBUYWdEZWZpbml0aW9uLFxuICAgICAgb3B0aW9uczogVG9rZW5pemVPcHRpb25zKSB7XG4gICAgdGhpcy5fdG9rZW5pemVJY3UgPSBvcHRpb25zLnRva2VuaXplRXhwYW5zaW9uRm9ybXMgfHwgZmFsc2U7XG4gICAgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyA9IG9wdGlvbnMuaW50ZXJwb2xhdGlvbkNvbmZpZyB8fCBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHO1xuICAgIHRoaXMuX2xlYWRpbmdUcml2aWFDb2RlUG9pbnRzID1cbiAgICAgICAgb3B0aW9ucy5sZWFkaW5nVHJpdmlhQ2hhcnMgJiYgb3B0aW9ucy5sZWFkaW5nVHJpdmlhQ2hhcnMubWFwKGMgPT4gYy5jb2RlUG9pbnRBdCgwKSB8fCAwKTtcbiAgICBjb25zdCByYW5nZSA9XG4gICAgICAgIG9wdGlvbnMucmFuZ2UgfHwge2VuZFBvczogX2ZpbGUuY29udGVudC5sZW5ndGgsIHN0YXJ0UG9zOiAwLCBzdGFydExpbmU6IDAsIHN0YXJ0Q29sOiAwfTtcbiAgICB0aGlzLl9jdXJzb3IgPSBvcHRpb25zLmVzY2FwZWRTdHJpbmcgPyBuZXcgRXNjYXBlZENoYXJhY3RlckN1cnNvcihfZmlsZSwgcmFuZ2UpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgUGxhaW5DaGFyYWN0ZXJDdXJzb3IoX2ZpbGUsIHJhbmdlKTtcbiAgICB0aGlzLl9wcmVzZXJ2ZUxpbmVFbmRpbmdzID0gb3B0aW9ucy5wcmVzZXJ2ZUxpbmVFbmRpbmdzIHx8IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLl9jdXJzb3IuaW5pdCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLl9wcmVzZXJ2ZUxpbmVFbmRpbmdzKSB7XG4gICAgICByZXR1cm4gY29udGVudDtcbiAgICB9XG4gICAgLy8gaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUvc3ludGF4Lmh0bWwjcHJlcHJvY2Vzc2luZy10aGUtaW5wdXQtc3RyZWFtXG4gICAgLy8gSW4gb3JkZXIgdG8ga2VlcCB0aGUgb3JpZ2luYWwgcG9zaXRpb24gaW4gdGhlIHNvdXJjZSwgd2UgY2FuIG5vdFxuICAgIC8vIHByZS1wcm9jZXNzIGl0LlxuICAgIC8vIEluc3RlYWQgQ1JzIGFyZSBwcm9jZXNzZWQgcmlnaHQgYmVmb3JlIGluc3RhbnRpYXRpbmcgdGhlIHRva2Vucy5cbiAgICByZXR1cm4gY29udGVudC5yZXBsYWNlKF9DUl9PUl9DUkxGX1JFR0VYUCwgJ1xcbicpO1xuICB9XG5cbiAgdG9rZW5pemUoKTogVG9rZW5pemVSZXN1bHQge1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kRU9GKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kTFQpKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kQkFORykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lQ2RhdGEoc3RhcnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJE1JTlVTKSkge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lQ29tbWVudChzdGFydCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lRG9jVHlwZShzdGFydCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFNMQVNIKSkge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZVRhZ0Nsb3NlKHN0YXJ0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZVRhZ09wZW4oc3RhcnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghKHRoaXMuX3Rva2VuaXplSWN1ICYmIHRoaXMuX3Rva2VuaXplRXhwYW5zaW9uRm9ybSgpKSkge1xuICAgICAgICAgIHRoaXMuX2NvbnN1bWVUZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhpcy5oYW5kbGVFcnJvcihlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRU9GKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gICAgcmV0dXJuIG5ldyBUb2tlbml6ZVJlc3VsdChtZXJnZVRleHRUb2tlbnModGhpcy50b2tlbnMpLCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICAvKipcbiAgICogQHJldHVybnMgd2hldGhlciBhbiBJQ1UgdG9rZW4gaGFzIGJlZW4gY3JlYXRlZFxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHByaXZhdGUgX3Rva2VuaXplRXhwYW5zaW9uRm9ybSgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5pc0V4cGFuc2lvbkZvcm1TdGFydCgpKSB7XG4gICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uRm9ybVN0YXJ0KCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNFeHBhbnNpb25DYXNlU3RhcnQodGhpcy5fY3Vyc29yLnBlZWsoKSkgJiYgdGhpcy5faXNJbkV4cGFuc2lvbkZvcm0oKSkge1xuICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbkNhc2VTdGFydCgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRSQlJBQ0UpIHtcbiAgICAgIGlmICh0aGlzLl9pc0luRXhwYW5zaW9uQ2FzZSgpKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVFeHBhbnNpb25DYXNlRW5kKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5faXNJbkV4cGFuc2lvbkZvcm0oKSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uRm9ybUVuZCgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9iZWdpblRva2VuKHR5cGU6IFRva2VuVHlwZSwgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKSkge1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0ID0gc3RhcnQ7XG4gICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSA9IHR5cGU7XG4gIH1cblxuICBwcml2YXRlIF9lbmRUb2tlbihwYXJ0czogc3RyaW5nW10sIGVuZD86IENoYXJhY3RlckN1cnNvcik6IFRva2VuIHtcbiAgICBpZiAodGhpcy5fY3VycmVudFRva2VuU3RhcnQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBUb2tlbkVycm9yKFxuICAgICAgICAgICdQcm9ncmFtbWluZyBlcnJvciAtIGF0dGVtcHRlZCB0byBlbmQgYSB0b2tlbiB3aGVuIHRoZXJlIHdhcyBubyBzdGFydCB0byB0aGUgdG9rZW4nLFxuICAgICAgICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUsIHRoaXMuX2N1cnNvci5nZXRTcGFuKGVuZCkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fY3VycmVudFRva2VuVHlwZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAgICAgJ1Byb2dyYW1taW5nIGVycm9yIC0gYXR0ZW1wdGVkIHRvIGVuZCBhIHRva2VuIHdoaWNoIGhhcyBubyB0b2tlbiB0eXBlJywgbnVsbCxcbiAgICAgICAgICB0aGlzLl9jdXJzb3IuZ2V0U3Bhbih0aGlzLl9jdXJyZW50VG9rZW5TdGFydCkpO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbiA9IG5ldyBUb2tlbihcbiAgICAgICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSwgcGFydHMsXG4gICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0LCB0aGlzLl9sZWFkaW5nVHJpdmlhQ29kZVBvaW50cykpO1xuICAgIHRoaXMudG9rZW5zLnB1c2godG9rZW4pO1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0ID0gbnVsbDtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5UeXBlID0gbnVsbDtcbiAgICByZXR1cm4gdG9rZW47XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVFcnJvcihtc2c6IHN0cmluZywgc3BhbjogUGFyc2VTb3VyY2VTcGFuKTogX0NvbnRyb2xGbG93RXJyb3Ige1xuICAgIGlmICh0aGlzLl9pc0luRXhwYW5zaW9uRm9ybSgpKSB7XG4gICAgICBtc2cgKz0gYCAoRG8geW91IGhhdmUgYW4gdW5lc2NhcGVkIFwie1wiIGluIHlvdXIgdGVtcGxhdGU/IFVzZSBcInt7ICd7JyB9fVwiKSB0byBlc2NhcGUgaXQuKWA7XG4gICAgfVxuICAgIGNvbnN0IGVycm9yID0gbmV3IFRva2VuRXJyb3IobXNnLCB0aGlzLl9jdXJyZW50VG9rZW5UeXBlLCBzcGFuKTtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5TdGFydCA9IG51bGw7XG4gICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSA9IG51bGw7XG4gICAgcmV0dXJuIG5ldyBfQ29udHJvbEZsb3dFcnJvcihlcnJvcik7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZUVycm9yKGU6IGFueSkge1xuICAgIGlmIChlIGluc3RhbmNlb2YgQ3Vyc29yRXJyb3IpIHtcbiAgICAgIGUgPSB0aGlzLl9jcmVhdGVFcnJvcihlLm1zZywgdGhpcy5fY3Vyc29yLmdldFNwYW4oZS5jdXJzb3IpKTtcbiAgICB9XG4gICAgaWYgKGUgaW5zdGFuY2VvZiBfQ29udHJvbEZsb3dFcnJvcikge1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChlLmVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0Q2hhckNvZGUoY2hhckNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFyQ29kZSkge1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0Q2hhckNvZGVDYXNlSW5zZW5zaXRpdmUoY2hhckNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmIChjb21wYXJlQ2hhckNvZGVDYXNlSW5zZW5zaXRpdmUodGhpcy5fY3Vyc29yLnBlZWsoKSwgY2hhckNvZGUpKSB7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcXVpcmVDaGFyQ29kZShjaGFyQ29kZTogbnVtYmVyKSB7XG4gICAgY29uc3QgbG9jYXRpb24gPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICBpZiAoIXRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFyQ29kZSkpIHtcbiAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICAgIF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2codGhpcy5fY3Vyc29yLnBlZWsoKSksIHRoaXMuX2N1cnNvci5nZXRTcGFuKGxvY2F0aW9uKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdFN0cihjaGFyczogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbGVuID0gY2hhcnMubGVuZ3RoO1xuICAgIGlmICh0aGlzLl9jdXJzb3IuY2hhcnNMZWZ0KCkgPCBsZW4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgaW5pdGlhbFBvc2l0aW9uID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuY2hhckNvZGVBdChpKSkpIHtcbiAgICAgICAgLy8gSWYgYXR0ZW1wdGluZyB0byBwYXJzZSB0aGUgc3RyaW5nIGZhaWxzLCB3ZSB3YW50IHRvIHJlc2V0IHRoZSBwYXJzZXJcbiAgICAgICAgLy8gdG8gd2hlcmUgaXQgd2FzIGJlZm9yZSB0aGUgYXR0ZW1wdFxuICAgICAgICB0aGlzLl9jdXJzb3IgPSBpbml0aWFsUG9zaXRpb247XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0U3RyQ2FzZUluc2Vuc2l0aXZlKGNoYXJzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMuX2F0dGVtcHRDaGFyQ29kZUNhc2VJbnNlbnNpdGl2ZShjaGFycy5jaGFyQ29kZUF0KGkpKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVxdWlyZVN0cihjaGFyczogc3RyaW5nKSB7XG4gICAgY29uc3QgbG9jYXRpb24gPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICBpZiAoIXRoaXMuX2F0dGVtcHRTdHIoY2hhcnMpKSB7XG4gICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgICAgICBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKHRoaXMuX2N1cnNvci5wZWVrKCkpLCB0aGlzLl9jdXJzb3IuZ2V0U3Bhbihsb2NhdGlvbikpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4ocHJlZGljYXRlOiAoY29kZTogbnVtYmVyKSA9PiBib29sZWFuKSB7XG4gICAgd2hpbGUgKCFwcmVkaWNhdGUodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVxdWlyZUNoYXJDb2RlVW50aWxGbihwcmVkaWNhdGU6IChjb2RlOiBudW1iZXIpID0+IGJvb2xlYW4sIGxlbjogbnVtYmVyKSB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKHByZWRpY2F0ZSk7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5kaWZmKHN0YXJ0KSA8IGxlbikge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oc3RhcnQpKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0VW50aWxDaGFyKGNoYXI6IG51bWJlcikge1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFyKSB7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3JlYWRDaGFyKGRlY29kZUVudGl0aWVzOiBib29sZWFuKTogc3RyaW5nIHtcbiAgICBpZiAoZGVjb2RlRW50aXRpZXMgJiYgdGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJEFNUEVSU0FORCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2RlY29kZUVudGl0eSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEb24ndCByZWx5IHVwb24gcmVhZGluZyBkaXJlY3RseSBmcm9tIGBfaW5wdXRgIGFzIHRoZSBhY3R1YWwgY2hhciB2YWx1ZVxuICAgICAgLy8gbWF5IGhhdmUgYmVlbiBnZW5lcmF0ZWQgZnJvbSBhbiBlc2NhcGUgc2VxdWVuY2UuXG4gICAgICBjb25zdCBjaGFyID0gU3RyaW5nLmZyb21Db2RlUG9pbnQodGhpcy5fY3Vyc29yLnBlZWsoKSk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIGNoYXI7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZGVjb2RlRW50aXR5KCk6IHN0cmluZyB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJEhBU0gpKSB7XG4gICAgICBjb25zdCBpc0hleCA9IHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4keCkgfHwgdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRYKTtcbiAgICAgIGNvbnN0IGNvZGVTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc0RpZ2l0RW50aXR5RW5kKTtcbiAgICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpICE9IGNoYXJzLiRTRU1JQ09MT04pIHtcbiAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgICBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKHRoaXMuX2N1cnNvci5wZWVrKCkpLCB0aGlzLl9jdXJzb3IuZ2V0U3BhbigpKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0ck51bSA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhjb2RlU3RhcnQpO1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNoYXJDb2RlID0gcGFyc2VJbnQoc3RyTnVtLCBpc0hleCA/IDE2IDogMTApO1xuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgICBfdW5rbm93bkVudGl0eUVycm9yTXNnKHRoaXMuX2N1cnNvci5nZXRDaGFycyhzdGFydCkpLCB0aGlzLl9jdXJzb3IuZ2V0U3BhbigpKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTmFtZWRFbnRpdHlFbmQpO1xuICAgICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT0gY2hhcnMuJFNFTUlDT0xPTikge1xuICAgICAgICB0aGlzLl9jdXJzb3IgPSBuYW1lU3RhcnQ7XG4gICAgICAgIHJldHVybiAnJic7XG4gICAgICB9XG4gICAgICBjb25zdCBuYW1lID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVTdGFydCk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgY29uc3QgY2hhciA9IE5BTUVEX0VOVElUSUVTW25hbWVdO1xuICAgICAgaWYgKCFjaGFyKSB7XG4gICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKF91bmtub3duRW50aXR5RXJyb3JNc2cobmFtZSksIHRoaXMuX2N1cnNvci5nZXRTcGFuKHN0YXJ0KSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hhcjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lUmF3VGV4dChkZWNvZGVFbnRpdGllczogYm9vbGVhbiwgZW5kTWFya2VyUHJlZGljYXRlOiAoKSA9PiBib29sZWFuKTogVG9rZW4ge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oZGVjb2RlRW50aXRpZXMgPyBUb2tlblR5cGUuRVNDQVBBQkxFX1JBV19URVhUIDogVG9rZW5UeXBlLlJBV19URVhUKTtcbiAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgdGFnQ2xvc2VTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgY29uc3QgZm91bmRFbmRNYXJrZXIgPSBlbmRNYXJrZXJQcmVkaWNhdGUoKTtcbiAgICAgIHRoaXMuX2N1cnNvciA9IHRhZ0Nsb3NlU3RhcnQ7XG4gICAgICBpZiAoZm91bmRFbmRNYXJrZXIpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBwYXJ0cy5wdXNoKHRoaXMuX3JlYWRDaGFyKGRlY29kZUVudGl0aWVzKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9lbmRUb2tlbihbdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhwYXJ0cy5qb2luKCcnKSldKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVDb21tZW50KHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5DT01NRU5UX1NUQVJULCBzdGFydCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRNSU5VUyk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0KGZhbHNlLCAoKSA9PiB0aGlzLl9hdHRlbXB0U3RyKCctLT4nKSk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ09NTUVOVF9FTkQpO1xuICAgIHRoaXMuX3JlcXVpcmVTdHIoJy0tPicpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVDZGF0YShzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ0RBVEFfU1RBUlQsIHN0YXJ0KTtcbiAgICB0aGlzLl9yZXF1aXJlU3RyKCdDREFUQVsnKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gICAgdGhpcy5fY29uc3VtZVJhd1RleHQoZmFsc2UsICgpID0+IHRoaXMuX2F0dGVtcHRTdHIoJ11dPicpKTtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5DREFUQV9FTkQpO1xuICAgIHRoaXMuX3JlcXVpcmVTdHIoJ11dPicpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVEb2NUeXBlKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5ET0NfVFlQRSwgc3RhcnQpO1xuICAgIGNvbnN0IGNvbnRlbnRTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRoaXMuX2F0dGVtcHRVbnRpbENoYXIoY2hhcnMuJEdUKTtcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKGNvbnRlbnRTdGFydCk7XG4gICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbY29udGVudF0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVByZWZpeEFuZE5hbWUoKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IG5hbWVPclByZWZpeFN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgbGV0IHByZWZpeDogc3RyaW5nID0gJyc7XG4gICAgd2hpbGUgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRDT0xPTiAmJiAhaXNQcmVmaXhFbmQodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgfVxuICAgIGxldCBuYW1lU3RhcnQ6IENoYXJhY3RlckN1cnNvcjtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJENPTE9OKSB7XG4gICAgICBwcmVmaXggPSB0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMobmFtZU9yUHJlZml4U3RhcnQpO1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIG5hbWVTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lU3RhcnQgPSBuYW1lT3JQcmVmaXhTdGFydDtcbiAgICB9XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlVW50aWxGbihpc05hbWVFbmQsIHByZWZpeCA9PT0gJycgPyAwIDogMSk7XG4gICAgY29uc3QgbmFtZSA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhuYW1lU3RhcnQpO1xuICAgIHJldHVybiBbcHJlZml4LCBuYW1lXTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUYWdPcGVuKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICBsZXQgdGFnTmFtZTogc3RyaW5nO1xuICAgIGxldCBwcmVmaXg6IHN0cmluZztcbiAgICBsZXQgb3BlblRhZ1Rva2VuOiBUb2tlbnx1bmRlZmluZWQ7XG4gICAgbGV0IHRva2Vuc0JlZm9yZVRhZ09wZW4gPSB0aGlzLnRva2Vucy5sZW5ndGg7XG4gICAgY29uc3QgaW5uZXJTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRyeSB7XG4gICAgICBpZiAoIWNoYXJzLmlzQXNjaWlMZXR0ZXIodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgICBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKHRoaXMuX2N1cnNvci5wZWVrKCkpLCB0aGlzLl9jdXJzb3IuZ2V0U3BhbihzdGFydCkpO1xuICAgICAgfVxuXG4gICAgICBvcGVuVGFnVG9rZW4gPSB0aGlzLl9jb25zdW1lVGFnT3BlblN0YXJ0KHN0YXJ0KTtcbiAgICAgIHByZWZpeCA9IG9wZW5UYWdUb2tlbi5wYXJ0c1swXTtcbiAgICAgIHRhZ05hbWUgPSBvcGVuVGFnVG9rZW4ucGFydHNbMV07XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICB3aGlsZSAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJFNMQVNIICYmIHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRHVCkge1xuICAgICAgICB0aGlzLl9jb25zdW1lQXR0cmlidXRlTmFtZSgpO1xuICAgICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJEVRKSkge1xuICAgICAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgICAgICB0aGlzLl9jb25zdW1lQXR0cmlidXRlVmFsdWUoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jb25zdW1lVGFnT3BlbkVuZCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgX0NvbnRyb2xGbG93RXJyb3IpIHtcbiAgICAgICAgLy8gV2hlbiB0aGUgc3RhcnQgdGFnIGlzIGludmFsaWQgKGluY2x1ZGluZyBpbnZhbGlkIFwiYXR0cmlidXRlc1wiKSwgYXNzdW1lIHdlIHdhbnQgYSBcIjxcIlxuICAgICAgICB0aGlzLl9jdXJzb3IgPSBpbm5lclN0YXJ0O1xuICAgICAgICBpZiAob3BlblRhZ1Rva2VuKSB7XG4gICAgICAgICAgdGhpcy50b2tlbnMubGVuZ3RoID0gdG9rZW5zQmVmb3JlVGFnT3BlbjtcbiAgICAgICAgfVxuICAgICAgICAvLyBCYWNrIHRvIGJhY2sgdGV4dCB0b2tlbnMgYXJlIG1lcmdlZCBhdCB0aGUgZW5kXG4gICAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRFWFQsIHN0YXJ0KTtcbiAgICAgICAgdGhpcy5fZW5kVG9rZW4oWyc8J10pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudFRva2VuVHlwZSA9IHRoaXMuX2dldFRhZ0RlZmluaXRpb24odGFnTmFtZSkuY29udGVudFR5cGU7XG5cbiAgICBpZiAoY29udGVudFRva2VuVHlwZSA9PT0gVGFnQ29udGVudFR5cGUuUkFXX1RFWFQpIHtcbiAgICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0V2l0aFRhZ0Nsb3NlKHByZWZpeCwgdGFnTmFtZSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY29udGVudFRva2VuVHlwZSA9PT0gVGFnQ29udGVudFR5cGUuRVNDQVBBQkxFX1JBV19URVhUKSB7XG4gICAgICB0aGlzLl9jb25zdW1lUmF3VGV4dFdpdGhUYWdDbG9zZShwcmVmaXgsIHRhZ05hbWUsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVSYXdUZXh0V2l0aFRhZ0Nsb3NlKHByZWZpeDogc3RyaW5nLCB0YWdOYW1lOiBzdHJpbmcsIGRlY29kZUVudGl0aWVzOiBib29sZWFuKSB7XG4gICAgY29uc3QgdGV4dFRva2VuID0gdGhpcy5fY29uc3VtZVJhd1RleHQoZGVjb2RlRW50aXRpZXMsICgpID0+IHtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRMVCkpIHJldHVybiBmYWxzZTtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRTTEFTSCkpIHJldHVybiBmYWxzZTtcbiAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdFN0ckNhc2VJbnNlbnNpdGl2ZSh0YWdOYW1lKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgcmV0dXJuIHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kR1QpO1xuICAgIH0pO1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRBR19DTE9TRSk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlVW50aWxGbihjb2RlID0+IGNvZGUgPT09IGNoYXJzLiRHVCwgMyk7XG4gICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTsgIC8vIENvbnN1bWUgdGhlIGA+YFxuICAgIHRoaXMuX2VuZFRva2VuKFtwcmVmaXgsIHRhZ05hbWVdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUYWdPcGVuU3RhcnQoc3RhcnQ6IENoYXJhY3RlckN1cnNvcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRBR19PUEVOX1NUQVJULCBzdGFydCk7XG4gICAgY29uc3QgcGFydHMgPSB0aGlzLl9jb25zdW1lUHJlZml4QW5kTmFtZSgpO1xuICAgIHJldHVybiB0aGlzLl9lbmRUb2tlbihwYXJ0cyk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQXR0cmlidXRlTmFtZSgpIHtcbiAgICBjb25zdCBhdHRyTmFtZVN0YXJ0ID0gdGhpcy5fY3Vyc29yLnBlZWsoKTtcbiAgICBpZiAoYXR0ck5hbWVTdGFydCA9PT0gY2hhcnMuJFNRIHx8IGF0dHJOYW1lU3RhcnQgPT09IGNoYXJzLiREUSkge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyhhdHRyTmFtZVN0YXJ0KSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oKSk7XG4gICAgfVxuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkFUVFJfTkFNRSk7XG4gICAgY29uc3QgcHJlZml4QW5kTmFtZSA9IHRoaXMuX2NvbnN1bWVQcmVmaXhBbmROYW1lKCk7XG4gICAgdGhpcy5fZW5kVG9rZW4ocHJlZml4QW5kTmFtZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQXR0cmlidXRlVmFsdWUoKSB7XG4gICAgbGV0IHZhbHVlOiBzdHJpbmc7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRTUSB8fCB0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kRFEpIHtcbiAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkFUVFJfUVVPVEUpO1xuICAgICAgY29uc3QgcXVvdGVDaGFyID0gdGhpcy5fY3Vyc29yLnBlZWsoKTtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICB0aGlzLl9lbmRUb2tlbihbU3RyaW5nLmZyb21Db2RlUG9pbnQocXVvdGVDaGFyKV0pO1xuICAgICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQVRUUl9WQUxVRSk7XG4gICAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBxdW90ZUNoYXIpIHtcbiAgICAgICAgcGFydHMucHVzaCh0aGlzLl9yZWFkQ2hhcih0cnVlKSk7XG4gICAgICB9XG4gICAgICB2YWx1ZSA9IHBhcnRzLmpvaW4oJycpO1xuICAgICAgdGhpcy5fZW5kVG9rZW4oW3RoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnModmFsdWUpXSk7XG4gICAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5BVFRSX1FVT1RFKTtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICB0aGlzLl9lbmRUb2tlbihbU3RyaW5nLmZyb21Db2RlUG9pbnQocXVvdGVDaGFyKV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5BVFRSX1ZBTFVFKTtcbiAgICAgIGNvbnN0IHZhbHVlU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZVVudGlsRm4oaXNOYW1lRW5kLCAxKTtcbiAgICAgIHZhbHVlID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKHZhbHVlU3RhcnQpO1xuICAgICAgdGhpcy5fZW5kVG9rZW4oW3RoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnModmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVRhZ09wZW5FbmQoKSB7XG4gICAgY29uc3QgdG9rZW5UeXBlID1cbiAgICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRTTEFTSCkgPyBUb2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSUQgOiBUb2tlblR5cGUuVEFHX09QRU5fRU5EO1xuICAgIHRoaXMuX2JlZ2luVG9rZW4odG9rZW5UeXBlKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJEdUKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGFnQ2xvc2Uoc3RhcnQ6IENoYXJhY3RlckN1cnNvcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRBR19DTE9TRSwgc3RhcnQpO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICBjb25zdCBwcmVmaXhBbmROYW1lID0gdGhpcy5fY29uc3VtZVByZWZpeEFuZE5hbWUoKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRHVCk7XG4gICAgdGhpcy5fZW5kVG9rZW4ocHJlZml4QW5kTmFtZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uRm9ybVN0YXJ0KCkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJExCUkFDRSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuXG4gICAgdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLnB1c2goVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUKTtcblxuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlJBV19URVhUKTtcbiAgICBjb25zdCBjb25kaXRpb24gPSB0aGlzLl9yZWFkVW50aWwoY2hhcnMuJENPTU1BKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbY29uZGl0aW9uXSk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRDT01NQSk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuXG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuUkFXX1RFWFQpO1xuICAgIGNvbnN0IHR5cGUgPSB0aGlzLl9yZWFkVW50aWwoY2hhcnMuJENPTU1BKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbdHlwZV0pO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kQ09NTUEpO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVFeHBhbnNpb25DYXNlU3RhcnQoKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfVkFMVUUpO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5fcmVhZFVudGlsKGNoYXJzLiRMQlJBQ0UpLnRyaW0oKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbdmFsdWVdKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG5cbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kTEJSQUNFKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuXG4gICAgdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLnB1c2goVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uQ2FzZUVuZCgpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfRU5EKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJFJCUkFDRSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wb3AoKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVFeHBhbnNpb25Gb3JtRW5kKCkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX0VORCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRSQlJBQ0UpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wb3AoKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUZXh0KCkge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuVEVYVCwgc3RhcnQpO1xuICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgZG8ge1xuICAgICAgaWYgKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcgJiYgdGhpcy5fYXR0ZW1wdFN0cih0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0KSkge1xuICAgICAgICBwYXJ0cy5wdXNoKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcuc3RhcnQpO1xuICAgICAgICB0aGlzLl9pbkludGVycG9sYXRpb24gPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnICYmIHRoaXMuX2luSW50ZXJwb2xhdGlvbiAmJlxuICAgICAgICAgIHRoaXMuX2F0dGVtcHRTdHIodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQpKSB7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQpO1xuICAgICAgICB0aGlzLl9pbkludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5fcmVhZENoYXIodHJ1ZSkpO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKCF0aGlzLl9pc1RleHRFbmQoKSk7XG5cbiAgICB0aGlzLl9lbmRUb2tlbihbdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhwYXJ0cy5qb2luKCcnKSldKTtcbiAgfVxuXG4gIHByaXZhdGUgX2lzVGV4dEVuZCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJExUIHx8IHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRFT0YpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl90b2tlbml6ZUljdSAmJiAhdGhpcy5faW5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICBpZiAodGhpcy5pc0V4cGFuc2lvbkZvcm1TdGFydCgpKSB7XG4gICAgICAgIC8vIHN0YXJ0IG9mIGFuIGV4cGFuc2lvbiBmb3JtXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJFJCUkFDRSAmJiB0aGlzLl9pc0luRXhwYW5zaW9uQ2FzZSgpKSB7XG4gICAgICAgIC8vIGVuZCBvZiBhbmQgZXhwYW5zaW9uIGNhc2VcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVhZFVudGlsKGNoYXI6IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0VW50aWxDaGFyKGNoYXIpO1xuICAgIHJldHVybiB0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMoc3RhcnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfaXNJbkV4cGFuc2lvbkNhc2UoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5sZW5ndGggPiAwICYmXG4gICAgICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFja1t0aGlzLl9leHBhbnNpb25DYXNlU3RhY2subGVuZ3RoIC0gMV0gPT09XG4gICAgICAgIFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQ7XG4gIH1cblxuICBwcml2YXRlIF9pc0luRXhwYW5zaW9uRm9ybSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrW3RoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5sZW5ndGggLSAxXSA9PT1cbiAgICAgICAgVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0V4cGFuc2lvbkZvcm1TdGFydCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJExCUkFDRSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIGNvbnN0IGlzSW50ZXJwb2xhdGlvbiA9IHRoaXMuX2F0dGVtcHRTdHIodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydCk7XG4gICAgICB0aGlzLl9jdXJzb3IgPSBzdGFydDtcbiAgICAgIHJldHVybiAhaXNJbnRlcnBvbGF0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc05vdFdoaXRlc3BhY2UoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAhY2hhcnMuaXNXaGl0ZXNwYWNlKGNvZGUpIHx8IGNvZGUgPT09IGNoYXJzLiRFT0Y7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZUVuZChjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNoYXJzLmlzV2hpdGVzcGFjZShjb2RlKSB8fCBjb2RlID09PSBjaGFycy4kR1QgfHwgY29kZSA9PT0gY2hhcnMuJFNMQVNIIHx8XG4gICAgICBjb2RlID09PSBjaGFycy4kU1EgfHwgY29kZSA9PT0gY2hhcnMuJERRIHx8IGNvZGUgPT09IGNoYXJzLiRFUTtcbn1cblxuZnVuY3Rpb24gaXNQcmVmaXhFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAoY29kZSA8IGNoYXJzLiRhIHx8IGNoYXJzLiR6IDwgY29kZSkgJiYgKGNvZGUgPCBjaGFycy4kQSB8fCBjaGFycy4kWiA8IGNvZGUpICYmXG4gICAgICAoY29kZSA8IGNoYXJzLiQwIHx8IGNvZGUgPiBjaGFycy4kOSk7XG59XG5cbmZ1bmN0aW9uIGlzRGlnaXRFbnRpdHlFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID09IGNoYXJzLiRTRU1JQ09MT04gfHwgY29kZSA9PSBjaGFycy4kRU9GIHx8ICFjaGFycy5pc0FzY2lpSGV4RGlnaXQoY29kZSk7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZWRFbnRpdHlFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID09IGNoYXJzLiRTRU1JQ09MT04gfHwgY29kZSA9PSBjaGFycy4kRU9GIHx8ICFjaGFycy5pc0FzY2lpTGV0dGVyKGNvZGUpO1xufVxuXG5mdW5jdGlvbiBpc0V4cGFuc2lvbkNhc2VTdGFydChwZWVrOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIHBlZWsgIT09IGNoYXJzLiRSQlJBQ0U7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVDaGFyQ29kZUNhc2VJbnNlbnNpdGl2ZShjb2RlMTogbnVtYmVyLCBjb2RlMjogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiB0b1VwcGVyQ2FzZUNoYXJDb2RlKGNvZGUxKSA9PSB0b1VwcGVyQ2FzZUNoYXJDb2RlKGNvZGUyKTtcbn1cblxuZnVuY3Rpb24gdG9VcHBlckNhc2VDaGFyQ29kZShjb2RlOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gY29kZSA+PSBjaGFycy4kYSAmJiBjb2RlIDw9IGNoYXJzLiR6ID8gY29kZSAtIGNoYXJzLiRhICsgY2hhcnMuJEEgOiBjb2RlO1xufVxuXG5mdW5jdGlvbiBtZXJnZVRleHRUb2tlbnMoc3JjVG9rZW5zOiBUb2tlbltdKTogVG9rZW5bXSB7XG4gIGNvbnN0IGRzdFRva2VuczogVG9rZW5bXSA9IFtdO1xuICBsZXQgbGFzdERzdFRva2VuOiBUb2tlbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3JjVG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgdG9rZW4gPSBzcmNUb2tlbnNbaV07XG4gICAgaWYgKGxhc3REc3RUb2tlbiAmJiBsYXN0RHN0VG9rZW4udHlwZSA9PSBUb2tlblR5cGUuVEVYVCAmJiB0b2tlbi50eXBlID09IFRva2VuVHlwZS5URVhUKSB7XG4gICAgICBsYXN0RHN0VG9rZW4ucGFydHNbMF0gISArPSB0b2tlbi5wYXJ0c1swXTtcbiAgICAgIGxhc3REc3RUb2tlbi5zb3VyY2VTcGFuLmVuZCA9IHRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYXN0RHN0VG9rZW4gPSB0b2tlbjtcbiAgICAgIGRzdFRva2Vucy5wdXNoKGxhc3REc3RUb2tlbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRzdFRva2Vucztcbn1cblxuXG4vKipcbiAqIFRoZSBfVG9rZW5pemVyIHVzZXMgb2JqZWN0cyBvZiB0aGlzIHR5cGUgdG8gbW92ZSB0aHJvdWdoIHRoZSBpbnB1dCB0ZXh0LFxuICogZXh0cmFjdGluZyBcInBhcnNlZCBjaGFyYWN0ZXJzXCIuIFRoZXNlIGNvdWxkIGJlIG1vcmUgdGhhbiBvbmUgYWN0dWFsIGNoYXJhY3RlclxuICogaWYgdGhlIHRleHQgY29udGFpbnMgZXNjYXBlIHNlcXVlbmNlcy5cbiAqL1xuaW50ZXJmYWNlIENoYXJhY3RlckN1cnNvciB7XG4gIC8qKiBJbml0aWFsaXplIHRoZSBjdXJzb3IuICovXG4gIGluaXQoKTogdm9pZDtcbiAgLyoqIFRoZSBwYXJzZWQgY2hhcmFjdGVyIGF0IHRoZSBjdXJyZW50IGN1cnNvciBwb3NpdGlvbi4gKi9cbiAgcGVlaygpOiBudW1iZXI7XG4gIC8qKiBBZHZhbmNlIHRoZSBjdXJzb3IgYnkgb25lIHBhcnNlZCBjaGFyYWN0ZXIuICovXG4gIGFkdmFuY2UoKTogdm9pZDtcbiAgLyoqIEdldCBhIHNwYW4gZnJvbSB0aGUgbWFya2VkIHN0YXJ0IHBvaW50IHRvIHRoZSBjdXJyZW50IHBvaW50LiAqL1xuICBnZXRTcGFuKHN0YXJ0PzogdGhpcywgbGVhZGluZ1RyaXZpYUNvZGVQb2ludHM/OiBudW1iZXJbXSk6IFBhcnNlU291cmNlU3BhbjtcbiAgLyoqIEdldCB0aGUgcGFyc2VkIGNoYXJhY3RlcnMgZnJvbSB0aGUgbWFya2VkIHN0YXJ0IHBvaW50IHRvIHRoZSBjdXJyZW50IHBvaW50LiAqL1xuICBnZXRDaGFycyhzdGFydDogdGhpcyk6IHN0cmluZztcbiAgLyoqIFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBsZWZ0IGJlZm9yZSB0aGUgZW5kIG9mIHRoZSBjdXJzb3IuICovXG4gIGNoYXJzTGVmdCgpOiBudW1iZXI7XG4gIC8qKiBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgYmV0d2VlbiBgdGhpc2AgY3Vyc29yIGFuZCBgb3RoZXJgIGN1cnNvci4gKi9cbiAgZGlmZihvdGhlcjogdGhpcyk6IG51bWJlcjtcbiAgLyoqIE1ha2UgYSBjb3B5IG9mIHRoaXMgY3Vyc29yICovXG4gIGNsb25lKCk6IENoYXJhY3RlckN1cnNvcjtcbn1cblxuaW50ZXJmYWNlIEN1cnNvclN0YXRlIHtcbiAgcGVlazogbnVtYmVyO1xuICBvZmZzZXQ6IG51bWJlcjtcbiAgbGluZTogbnVtYmVyO1xuICBjb2x1bW46IG51bWJlcjtcbn1cblxuY2xhc3MgUGxhaW5DaGFyYWN0ZXJDdXJzb3IgaW1wbGVtZW50cyBDaGFyYWN0ZXJDdXJzb3Ige1xuICBwcm90ZWN0ZWQgc3RhdGU6IEN1cnNvclN0YXRlO1xuICBwcm90ZWN0ZWQgZmlsZTogUGFyc2VTb3VyY2VGaWxlO1xuICBwcm90ZWN0ZWQgaW5wdXQ6IHN0cmluZztcbiAgcHJvdGVjdGVkIGVuZDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogUGxhaW5DaGFyYWN0ZXJDdXJzb3IpO1xuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBhcnNlU291cmNlRmlsZSwgcmFuZ2U6IExleGVyUmFuZ2UpO1xuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBhcnNlU291cmNlRmlsZXxQbGFpbkNoYXJhY3RlckN1cnNvciwgcmFuZ2U/OiBMZXhlclJhbmdlKSB7XG4gICAgaWYgKGZpbGVPckN1cnNvciBpbnN0YW5jZW9mIFBsYWluQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgICB0aGlzLmZpbGUgPSBmaWxlT3JDdXJzb3IuZmlsZTtcbiAgICAgIHRoaXMuaW5wdXQgPSBmaWxlT3JDdXJzb3IuaW5wdXQ7XG4gICAgICB0aGlzLmVuZCA9IGZpbGVPckN1cnNvci5lbmQ7XG5cbiAgICAgIGNvbnN0IHN0YXRlID0gZmlsZU9yQ3Vyc29yLnN0YXRlO1xuICAgICAgLy8gTm90ZTogYXZvaWQgdXNpbmcgYHsuLi5maWxlT3JDdXJzb3Iuc3RhdGV9YCBoZXJlIGFzIHRoYXQgaGFzIGEgc2V2ZXJlIHBlcmZvcm1hbmNlIHBlbmFsdHkuXG4gICAgICAvLyBJbiBFUzUgYnVuZGxlcyB0aGUgb2JqZWN0IHNwcmVhZCBvcGVyYXRvciBpcyB0cmFuc2xhdGVkIGludG8gdGhlIGBfX2Fzc2lnbmAgaGVscGVyLCB3aGljaFxuICAgICAgLy8gaXMgbm90IG9wdGltaXplZCBieSBWTXMgYXMgZWZmaWNpZW50bHkgYXMgYSByYXcgb2JqZWN0IGxpdGVyYWwuIFNpbmNlIHRoaXMgY29uc3RydWN0b3IgaXNcbiAgICAgIC8vIGNhbGxlZCBpbiB0aWdodCBsb29wcywgdGhpcyBkaWZmZXJlbmNlIG1hdHRlcnMuXG4gICAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICBwZWVrOiBzdGF0ZS5wZWVrLFxuICAgICAgICBvZmZzZXQ6IHN0YXRlLm9mZnNldCxcbiAgICAgICAgbGluZTogc3RhdGUubGluZSxcbiAgICAgICAgY29sdW1uOiBzdGF0ZS5jb2x1bW4sXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXJhbmdlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdQcm9ncmFtbWluZyBlcnJvcjogdGhlIHJhbmdlIGFyZ3VtZW50IG11c3QgYmUgcHJvdmlkZWQgd2l0aCBhIGZpbGUgYXJndW1lbnQuJyk7XG4gICAgICB9XG4gICAgICB0aGlzLmZpbGUgPSBmaWxlT3JDdXJzb3I7XG4gICAgICB0aGlzLmlucHV0ID0gZmlsZU9yQ3Vyc29yLmNvbnRlbnQ7XG4gICAgICB0aGlzLmVuZCA9IHJhbmdlLmVuZFBvcztcbiAgICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgIHBlZWs6IC0xLFxuICAgICAgICBvZmZzZXQ6IHJhbmdlLnN0YXJ0UG9zLFxuICAgICAgICBsaW5lOiByYW5nZS5zdGFydExpbmUsXG4gICAgICAgIGNvbHVtbjogcmFuZ2Uuc3RhcnRDb2wsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGNsb25lKCk6IFBsYWluQ2hhcmFjdGVyQ3Vyc29yIHsgcmV0dXJuIG5ldyBQbGFpbkNoYXJhY3RlckN1cnNvcih0aGlzKTsgfVxuXG4gIHBlZWsoKSB7IHJldHVybiB0aGlzLnN0YXRlLnBlZWs7IH1cbiAgY2hhcnNMZWZ0KCkgeyByZXR1cm4gdGhpcy5lbmQgLSB0aGlzLnN0YXRlLm9mZnNldDsgfVxuICBkaWZmKG90aGVyOiB0aGlzKSB7IHJldHVybiB0aGlzLnN0YXRlLm9mZnNldCAtIG90aGVyLnN0YXRlLm9mZnNldDsgfVxuXG4gIGFkdmFuY2UoKTogdm9pZCB7IHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuc3RhdGUpOyB9XG5cbiAgaW5pdCgpOiB2b2lkIHsgdGhpcy51cGRhdGVQZWVrKHRoaXMuc3RhdGUpOyB9XG5cbiAgZ2V0U3BhbihzdGFydD86IHRoaXMsIGxlYWRpbmdUcml2aWFDb2RlUG9pbnRzPzogbnVtYmVyW10pOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIHN0YXJ0ID0gc3RhcnQgfHwgdGhpcztcbiAgICBsZXQgY2xvbmVkID0gZmFsc2U7XG4gICAgaWYgKGxlYWRpbmdUcml2aWFDb2RlUG9pbnRzKSB7XG4gICAgICB3aGlsZSAodGhpcy5kaWZmKHN0YXJ0KSA+IDAgJiYgbGVhZGluZ1RyaXZpYUNvZGVQb2ludHMuaW5kZXhPZihzdGFydC5wZWVrKCkpICE9PSAtMSkge1xuICAgICAgICBpZiAoIWNsb25lZCkge1xuICAgICAgICAgIHN0YXJ0ID0gc3RhcnQuY2xvbmUoKSBhcyB0aGlzO1xuICAgICAgICAgIGNsb25lZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgc3RhcnQuYWR2YW5jZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgbmV3IFBhcnNlTG9jYXRpb24oc3RhcnQuZmlsZSwgc3RhcnQuc3RhdGUub2Zmc2V0LCBzdGFydC5zdGF0ZS5saW5lLCBzdGFydC5zdGF0ZS5jb2x1bW4pLFxuICAgICAgICBuZXcgUGFyc2VMb2NhdGlvbih0aGlzLmZpbGUsIHRoaXMuc3RhdGUub2Zmc2V0LCB0aGlzLnN0YXRlLmxpbmUsIHRoaXMuc3RhdGUuY29sdW1uKSk7XG4gIH1cblxuICBnZXRDaGFycyhzdGFydDogdGhpcyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LnN0YXRlLm9mZnNldCwgdGhpcy5zdGF0ZS5vZmZzZXQpO1xuICB9XG5cbiAgY2hhckF0KHBvczogbnVtYmVyKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuaW5wdXQuY2hhckNvZGVBdChwb3MpOyB9XG5cbiAgcHJvdGVjdGVkIGFkdmFuY2VTdGF0ZShzdGF0ZTogQ3Vyc29yU3RhdGUpIHtcbiAgICBpZiAoc3RhdGUub2Zmc2V0ID49IHRoaXMuZW5kKSB7XG4gICAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gICAgICB0aHJvdyBuZXcgQ3Vyc29yRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhcmFjdGVyIFwiRU9GXCInLCB0aGlzKTtcbiAgICB9XG4gICAgY29uc3QgY3VycmVudENoYXIgPSB0aGlzLmNoYXJBdChzdGF0ZS5vZmZzZXQpO1xuICAgIGlmIChjdXJyZW50Q2hhciA9PT0gY2hhcnMuJExGKSB7XG4gICAgICBzdGF0ZS5saW5lKys7XG4gICAgICBzdGF0ZS5jb2x1bW4gPSAwO1xuICAgIH0gZWxzZSBpZiAoIWNoYXJzLmlzTmV3TGluZShjdXJyZW50Q2hhcikpIHtcbiAgICAgIHN0YXRlLmNvbHVtbisrO1xuICAgIH1cbiAgICBzdGF0ZS5vZmZzZXQrKztcbiAgICB0aGlzLnVwZGF0ZVBlZWsoc3RhdGUpO1xuICB9XG5cbiAgcHJvdGVjdGVkIHVwZGF0ZVBlZWsoc3RhdGU6IEN1cnNvclN0YXRlKTogdm9pZCB7XG4gICAgc3RhdGUucGVlayA9IHN0YXRlLm9mZnNldCA+PSB0aGlzLmVuZCA/IGNoYXJzLiRFT0YgOiB0aGlzLmNoYXJBdChzdGF0ZS5vZmZzZXQpO1xuICB9XG59XG5cbmNsYXNzIEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IgZXh0ZW5kcyBQbGFpbkNoYXJhY3RlckN1cnNvciB7XG4gIHByb3RlY3RlZCBpbnRlcm5hbFN0YXRlOiBDdXJzb3JTdGF0ZTtcblxuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IpO1xuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBhcnNlU291cmNlRmlsZSwgcmFuZ2U6IExleGVyUmFuZ2UpO1xuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBhcnNlU291cmNlRmlsZXxFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yLCByYW5nZT86IExleGVyUmFuZ2UpIHtcbiAgICBpZiAoZmlsZU9yQ3Vyc29yIGluc3RhbmNlb2YgRXNjYXBlZENoYXJhY3RlckN1cnNvcikge1xuICAgICAgc3VwZXIoZmlsZU9yQ3Vyc29yKTtcbiAgICAgIHRoaXMuaW50ZXJuYWxTdGF0ZSA9IHsuLi5maWxlT3JDdXJzb3IuaW50ZXJuYWxTdGF0ZX07XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1cGVyKGZpbGVPckN1cnNvciwgcmFuZ2UgISk7XG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB0aGlzLnN0YXRlO1xuICAgIH1cbiAgfVxuXG4gIGFkdmFuY2UoKTogdm9pZCB7XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMuaW50ZXJuYWxTdGF0ZTtcbiAgICBzdXBlci5hZHZhbmNlKCk7XG4gICAgdGhpcy5wcm9jZXNzRXNjYXBlU2VxdWVuY2UoKTtcbiAgfVxuXG4gIGluaXQoKTogdm9pZCB7XG4gICAgc3VwZXIuaW5pdCgpO1xuICAgIHRoaXMucHJvY2Vzc0VzY2FwZVNlcXVlbmNlKCk7XG4gIH1cblxuICBjbG9uZSgpOiBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yIHsgcmV0dXJuIG5ldyBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yKHRoaXMpOyB9XG5cbiAgZ2V0Q2hhcnMoc3RhcnQ6IHRoaXMpOiBzdHJpbmcge1xuICAgIGNvbnN0IGN1cnNvciA9IHN0YXJ0LmNsb25lKCk7XG4gICAgbGV0IGNoYXJzID0gJyc7XG4gICAgd2hpbGUgKGN1cnNvci5pbnRlcm5hbFN0YXRlLm9mZnNldCA8IHRoaXMuaW50ZXJuYWxTdGF0ZS5vZmZzZXQpIHtcbiAgICAgIGNoYXJzICs9IFN0cmluZy5mcm9tQ29kZVBvaW50KGN1cnNvci5wZWVrKCkpO1xuICAgICAgY3Vyc29yLmFkdmFuY2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIGNoYXJzO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdGhlIGVzY2FwZSBzZXF1ZW5jZSB0aGF0IHN0YXJ0cyBhdCB0aGUgY3VycmVudCBwb3NpdGlvbiBpbiB0aGUgdGV4dC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgaXMgY2FsbGVkIHRvIGVuc3VyZSB0aGF0IGBwZWVrYCBoYXMgdGhlIHVuZXNjYXBlZCB2YWx1ZSBvZiBlc2NhcGUgc2VxdWVuY2VzLlxuICAgKi9cbiAgcHJvdGVjdGVkIHByb2Nlc3NFc2NhcGVTZXF1ZW5jZSgpOiB2b2lkIHtcbiAgICBjb25zdCBwZWVrID0gKCkgPT4gdGhpcy5pbnRlcm5hbFN0YXRlLnBlZWs7XG5cbiAgICBpZiAocGVlaygpID09PSBjaGFycy4kQkFDS1NMQVNIKSB7XG4gICAgICAvLyBXZSBoYXZlIGhpdCBhbiBlc2NhcGUgc2VxdWVuY2Ugc28gd2UgbmVlZCB0aGUgaW50ZXJuYWwgc3RhdGUgdG8gYmVjb21lIGluZGVwZW5kZW50XG4gICAgICAvLyBvZiB0aGUgZXh0ZXJuYWwgc3RhdGUuXG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB7Li4udGhpcy5zdGF0ZX07XG5cbiAgICAgIC8vIE1vdmUgcGFzdCB0aGUgYmFja3NsYXNoXG4gICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuXG4gICAgICAvLyBGaXJzdCBjaGVjayBmb3Igc3RhbmRhcmQgY29udHJvbCBjaGFyIHNlcXVlbmNlc1xuICAgICAgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJG4pIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJExGO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiRyKSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRDUjtcbiAgICAgIH0gZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kdikge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kVlRBQjtcbiAgICAgIH0gZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kdCkge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kVEFCO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiRiKSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRCU1BBQ0U7XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJGYpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJEZGO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3cgY29uc2lkZXIgbW9yZSBjb21wbGV4IHNlcXVlbmNlc1xuICAgICAgZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kdSkge1xuICAgICAgICAvLyBVbmljb2RlIGNvZGUtcG9pbnQgc2VxdWVuY2VcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTsgIC8vIGFkdmFuY2UgcGFzdCB0aGUgYHVgIGNoYXJcbiAgICAgICAgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJExCUkFDRSkge1xuICAgICAgICAgIC8vIFZhcmlhYmxlIGxlbmd0aCBVbmljb2RlLCBlLmcuIGBcXHh7MTIzfWBcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpOyAgLy8gYWR2YW5jZSBwYXN0IHRoZSBge2AgY2hhclxuICAgICAgICAgIC8vIEFkdmFuY2UgcGFzdCB0aGUgdmFyaWFibGUgbnVtYmVyIG9mIGhleCBkaWdpdHMgdW50aWwgd2UgaGl0IGEgYH1gIGNoYXJcbiAgICAgICAgICBjb25zdCBkaWdpdFN0YXJ0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgIGxldCBsZW5ndGggPSAwO1xuICAgICAgICAgIHdoaWxlIChwZWVrKCkgIT09IGNoYXJzLiRSQlJBQ0UpIHtcbiAgICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgICBsZW5ndGgrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5kZWNvZGVIZXhEaWdpdHMoZGlnaXRTdGFydCwgbGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaXhlZCBsZW5ndGggVW5pY29kZSwgZS5nLiBgXFx1MTIzNGBcbiAgICAgICAgICBjb25zdCBkaWdpdFN0YXJ0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuICAgICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHRoaXMuZGVjb2RlSGV4RGlnaXRzKGRpZ2l0U3RhcnQsIDQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJHgpIHtcbiAgICAgICAgLy8gSGV4IGNoYXIgY29kZSwgZS5nLiBgXFx4MkZgXG4gICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7ICAvLyBhZHZhbmNlIHBhc3QgdGhlIGB4YCBjaGFyXG4gICAgICAgIGNvbnN0IGRpZ2l0U3RhcnQgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHRoaXMuZGVjb2RlSGV4RGlnaXRzKGRpZ2l0U3RhcnQsIDIpO1xuICAgICAgfVxuXG4gICAgICBlbHNlIGlmIChjaGFycy5pc09jdGFsRGlnaXQocGVlaygpKSkge1xuICAgICAgICAvLyBPY3RhbCBjaGFyIGNvZGUsIGUuZy4gYFxcMDEyYCxcbiAgICAgICAgbGV0IG9jdGFsID0gJyc7XG4gICAgICAgIGxldCBsZW5ndGggPSAwO1xuICAgICAgICBsZXQgcHJldmlvdXMgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgIHdoaWxlIChjaGFycy5pc09jdGFsRGlnaXQocGVlaygpKSAmJiBsZW5ndGggPCAzKSB7XG4gICAgICAgICAgcHJldmlvdXMgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgb2N0YWwgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQocGVlaygpKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuICAgICAgICAgIGxlbmd0aCsrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHBhcnNlSW50KG9jdGFsLCA4KTtcbiAgICAgICAgLy8gQmFja3VwIG9uZSBjaGFyXG4gICAgICAgIHRoaXMuaW50ZXJuYWxTdGF0ZSA9IHByZXZpb3VzLmludGVybmFsU3RhdGU7XG4gICAgICB9XG5cbiAgICAgIGVsc2UgaWYgKGNoYXJzLmlzTmV3TGluZSh0aGlzLmludGVybmFsU3RhdGUucGVlaykpIHtcbiAgICAgICAgLy8gTGluZSBjb250aW51YXRpb24gYFxcYCBmb2xsb3dlZCBieSBhIG5ldyBsaW5lXG4gICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7ICAvLyBhZHZhbmNlIG92ZXIgdGhlIG5ld2xpbmVcbiAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuaW50ZXJuYWxTdGF0ZTtcbiAgICAgIH1cblxuICAgICAgZWxzZSB7XG4gICAgICAgIC8vIElmIG5vbmUgb2YgdGhlIGBpZmAgYmxvY2tzIHdlcmUgZXhlY3V0ZWQgdGhlbiB3ZSBqdXN0IGhhdmUgYW4gZXNjYXBlZCBub3JtYWwgY2hhcmFjdGVyLlxuICAgICAgICAvLyBJbiB0aGF0IGNhc2Ugd2UganVzdCwgZWZmZWN0aXZlbHksIHNraXAgdGhlIGJhY2tzbGFzaCBmcm9tIHRoZSBjaGFyYWN0ZXIuXG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHRoaXMuaW50ZXJuYWxTdGF0ZS5wZWVrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBkZWNvZGVIZXhEaWdpdHMoc3RhcnQ6IEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IsIGxlbmd0aDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBoZXggPSB0aGlzLmlucHV0LnN1YnN0cihzdGFydC5pbnRlcm5hbFN0YXRlLm9mZnNldCwgbGVuZ3RoKTtcbiAgICBjb25zdCBjaGFyQ29kZSA9IHBhcnNlSW50KGhleCwgMTYpO1xuICAgIGlmICghaXNOYU4oY2hhckNvZGUpKSB7XG4gICAgICByZXR1cm4gY2hhckNvZGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXJ0LnN0YXRlID0gc3RhcnQuaW50ZXJuYWxTdGF0ZTtcbiAgICAgIHRocm93IG5ldyBDdXJzb3JFcnJvcignSW52YWxpZCBoZXhhZGVjaW1hbCBlc2NhcGUgc2VxdWVuY2UnLCBzdGFydCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtc2c6IHN0cmluZywgcHVibGljIGN1cnNvcjogQ2hhcmFjdGVyQ3Vyc29yKSB7fVxufVxuIl19