/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/ml_parser/lexer", ["require", "exports", "tslib", "@angular/compiler/src/chars", "@angular/compiler/src/parse_util", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/tags"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var chars = require("@angular/compiler/src/chars");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var TokenType;
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
    })(TokenType = exports.TokenType || (exports.TokenType = {}));
    var Token = /** @class */ (function () {
        function Token(type, parts, sourceSpan) {
            this.type = type;
            this.parts = parts;
            this.sourceSpan = sourceSpan;
        }
        return Token;
    }());
    exports.Token = Token;
    var TokenError = /** @class */ (function (_super) {
        tslib_1.__extends(TokenError, _super);
        function TokenError(errorMsg, tokenType, span) {
            var _this = _super.call(this, span, errorMsg) || this;
            _this.tokenType = tokenType;
            return _this;
        }
        return TokenError;
    }(parse_util_1.ParseError));
    exports.TokenError = TokenError;
    var TokenizeResult = /** @class */ (function () {
        function TokenizeResult(tokens, errors) {
            this.tokens = tokens;
            this.errors = errors;
        }
        return TokenizeResult;
    }());
    exports.TokenizeResult = TokenizeResult;
    function tokenize(source, url, getTagDefinition, options) {
        if (options === void 0) { options = {}; }
        return new _Tokenizer(new parse_util_1.ParseSourceFile(source, url), getTagDefinition, options).tokenize();
    }
    exports.tokenize = tokenize;
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
            this._interpolationConfig = options.interpolationConfig || interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG;
            var range = options.range || { endPos: _file.content.length, startPos: 0, startLine: 0, startCol: 0 };
            this._cursor = options.escapedString ? new EscapedCharacterCursor(_file, range) :
                new PlainCharacterCursor(_file, range);
            try {
                this._cursor.init();
            }
            catch (e) {
                this.handleError(e);
            }
        }
        _Tokenizer.prototype._processCarriageReturns = function (content) {
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
            if (end === void 0) { end = this._cursor.clone(); }
            if (this._currentTokenStart === null) {
                throw new TokenError('Programming error - attempted to end a token when there was no start to the token', this._currentTokenType, this._cursor.getSpan(end));
            }
            if (this._currentTokenType === null) {
                throw new TokenError('Programming error - attempted to end a token which has no token type', null, this._cursor.getSpan(this._currentTokenStart));
            }
            var token = new Token(this._currentTokenType, parts, this._cursor.getSpan(this._currentTokenStart));
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
            var end = this._cursor.clone();
            if (end.diff(start) < len) {
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
                var char = tags_1.NAMED_ENTITIES[name_1];
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
            if (contentTokenType === tags_1.TagContentType.RAW_TEXT) {
                this._consumeRawTextWithTagClose(prefix, tagName, false);
            }
            else if (contentTokenType === tags_1.TagContentType.ESCAPABLE_RAW_TEXT) {
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
        return peek === chars.$EQ || chars.isAsciiLetter(peek) || chars.isDigit(peek);
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
                this.state = tslib_1.__assign({}, fileOrCursor.state);
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
        PlainCharacterCursor.prototype.getSpan = function (start) {
            start = start || this;
            return new parse_util_1.ParseSourceSpan(new parse_util_1.ParseLocation(start.file, start.state.offset, start.state.line, start.state.column), new parse_util_1.ParseLocation(this.file, this.state.offset, this.state.line, this.state.column));
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
        tslib_1.__extends(EscapedCharacterCursor, _super);
        function EscapedCharacterCursor(fileOrCursor, range) {
            var _this = this;
            if (fileOrCursor instanceof EscapedCharacterCursor) {
                _this = _super.call(this, fileOrCursor) || this;
                _this.internalState = tslib_1.__assign({}, fileOrCursor.internalState);
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
                this.internalState = tslib_1.__assign({}, this.state);
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
    exports.CursorError = CursorError;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV4ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2xleGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILG1EQUFrQztJQUNsQywrREFBMEY7SUFFMUYsNkZBQXlGO0lBQ3pGLDZEQUFxRTtJQUVyRSxJQUFZLFNBc0JYO0lBdEJELFdBQVksU0FBUztRQUNuQiw2REFBYyxDQUFBO1FBQ2QseURBQVksQ0FBQTtRQUNaLG1FQUFpQixDQUFBO1FBQ2pCLG1EQUFTLENBQUE7UUFDVCx5Q0FBSSxDQUFBO1FBQ0oscUVBQWtCLENBQUE7UUFDbEIsaURBQVEsQ0FBQTtRQUNSLDJEQUFhLENBQUE7UUFDYix1REFBVyxDQUFBO1FBQ1gsdURBQVcsQ0FBQTtRQUNYLG9EQUFTLENBQUE7UUFDVCxvREFBUyxDQUFBO1FBQ1Qsc0RBQVUsQ0FBQTtRQUNWLHNEQUFVLENBQUE7UUFDVixrREFBUSxDQUFBO1FBQ1IsMEVBQW9CLENBQUE7UUFDcEIsMEVBQW9CLENBQUE7UUFDcEIsa0ZBQXdCLENBQUE7UUFDeEIsOEVBQXNCLENBQUE7UUFDdEIsc0VBQWtCLENBQUE7UUFDbEIsd0NBQUcsQ0FBQTtJQUNMLENBQUMsRUF0QlcsU0FBUyxHQUFULGlCQUFTLEtBQVQsaUJBQVMsUUFzQnBCO0lBRUQ7UUFDRSxlQUNXLElBQW9CLEVBQVMsS0FBZSxFQUFTLFVBQTJCO1lBQWhGLFNBQUksR0FBSixJQUFJLENBQWdCO1lBQVMsVUFBSyxHQUFMLEtBQUssQ0FBVTtZQUFTLGVBQVUsR0FBVixVQUFVLENBQWlCO1FBQUcsQ0FBQztRQUNqRyxZQUFDO0lBQUQsQ0FBQyxBQUhELElBR0M7SUFIWSxzQkFBSztJQUtsQjtRQUFnQyxzQ0FBVTtRQUN4QyxvQkFBWSxRQUFnQixFQUFTLFNBQXlCLEVBQUUsSUFBcUI7WUFBckYsWUFDRSxr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O1FBQ0gsQ0FBQztRQUNILDZCQUFDO0lBQUQsQ0FBQyxBQTlJRCxDQUFxQyxvQkFBb0IsR0E4SXhEO0lBRUQ7UUFDRSxxQkFBbUIsR0FBVyxFQUFTLE1BQXVCO1lBQTNDLFFBQUcsR0FBSCxHQUFHLENBQVE7WUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFpQjtRQUFHLENBQUM7UUFDcEUsa0JBQUM7SUFBRCxDQUFDLEFBRkQsSUFFQztJQUZZLGtDQUFXIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGFycyBmcm9tICcuLi9jaGFycyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlTG9jYXRpb24sIFBhcnNlU291cmNlRmlsZSwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7TkFNRURfRU5USVRJRVMsIFRhZ0NvbnRlbnRUeXBlLCBUYWdEZWZpbml0aW9ufSBmcm9tICcuL3RhZ3MnO1xuXG5leHBvcnQgZW51bSBUb2tlblR5cGUge1xuICBUQUdfT1BFTl9TVEFSVCxcbiAgVEFHX09QRU5fRU5ELFxuICBUQUdfT1BFTl9FTkRfVk9JRCxcbiAgVEFHX0NMT1NFLFxuICBURVhULFxuICBFU0NBUEFCTEVfUkFXX1RFWFQsXG4gIFJBV19URVhULFxuICBDT01NRU5UX1NUQVJULFxuICBDT01NRU5UX0VORCxcbiAgQ0RBVEFfU1RBUlQsXG4gIENEQVRBX0VORCxcbiAgQVRUUl9OQU1FLFxuICBBVFRSX1FVT1RFLFxuICBBVFRSX1ZBTFVFLFxuICBET0NfVFlQRSxcbiAgRVhQQU5TSU9OX0ZPUk1fU1RBUlQsXG4gIEVYUEFOU0lPTl9DQVNFX1ZBTFVFLFxuICBFWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQsXG4gIEVYUEFOU0lPTl9DQVNFX0VYUF9FTkQsXG4gIEVYUEFOU0lPTl9GT1JNX0VORCxcbiAgRU9GXG59XG5cbmV4cG9ydCBjbGFzcyBUb2tlbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHR5cGU6IFRva2VuVHlwZXxudWxsLCBwdWJsaWMgcGFydHM6IHN0cmluZ1tdLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW5FcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihlcnJvck1zZzogc3RyaW5nLCBwdWJsaWMgdG9rZW5UeXBlOiBUb2tlblR5cGV8bnVsbCwgc3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgc3VwZXIoc3BhbiwgZXJyb3JNc2cpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUb2tlbml6ZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB0b2tlbnM6IFRva2VuW10sIHB1YmxpYyBlcnJvcnM6IFRva2VuRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGludGVyZmFjZSBMZXhlclJhbmdlIHtcbiAgc3RhcnRQb3M6IG51bWJlcjtcbiAgc3RhcnRMaW5lOiBudW1iZXI7XG4gIHN0YXJ0Q29sOiBudW1iZXI7XG4gIGVuZFBvczogbnVtYmVyO1xufVxuXG4vKipcbiAqIE9wdGlvbnMgdGhhdCBtb2RpZnkgaG93IHRoZSB0ZXh0IGlzIHRva2VuaXplZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUb2tlbml6ZU9wdGlvbnMge1xuICAvKiogV2hldGhlciB0byB0b2tlbml6ZSBJQ1UgbWVzc2FnZXMgKGNvbnNpZGVyZWQgYXMgdGV4dCBub2RlcyB3aGVuIGZhbHNlKS4gKi9cbiAgdG9rZW5pemVFeHBhbnNpb25Gb3Jtcz86IGJvb2xlYW47XG4gIC8qKiBIb3cgdG8gdG9rZW5pemUgaW50ZXJwb2xhdGlvbiBtYXJrZXJzLiAqL1xuICBpbnRlcnBvbGF0aW9uQ29uZmlnPzogSW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgLyoqXG4gICAqIFRoZSBzdGFydCBhbmQgZW5kIHBvaW50IG9mIHRoZSB0ZXh0IHRvIHBhcnNlIHdpdGhpbiB0aGUgYHNvdXJjZWAgc3RyaW5nLlxuICAgKiBUaGUgZW50aXJlIGBzb3VyY2VgIHN0cmluZyBpcyBwYXJzZWQgaWYgdGhpcyBpcyBub3QgcHJvdmlkZWQuXG4gICAqICovXG4gIHJhbmdlPzogTGV4ZXJSYW5nZTtcbiAgLyoqXG4gICAqIElmIHRoaXMgdGV4dCBpcyBzdG9yZWQgaW4gYSBKYXZhU2NyaXB0IHN0cmluZywgdGhlbiB3ZSBoYXZlIHRvIGRlYWwgd2l0aCBlc2NhcGUgc2VxdWVuY2VzLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMToqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFwiZGVmXFxuZ2hpXCJcbiAgICogYGBgXG4gICAqXG4gICAqIC0gVGhlIGBcXFwiYCBtdXN0IGJlIGNvbnZlcnRlZCB0byBgXCJgLlxuICAgKiAtIFRoZSBgXFxuYCBtdXN0IGJlIGNvbnZlcnRlZCB0byBhIG5ldyBsaW5lIGNoYXJhY3RlciBpbiBhIHRva2VuLFxuICAgKiAgIGJ1dCBpdCBzaG91bGQgbm90IGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICpcbiAgICogKipFeGFtcGxlIDI6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcbiAgICogIGRlZlwiXG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGUgbGluZSBjb250aW51YXRpb24gKGBcXGAgZm9sbG93ZWQgYnkgYSBuZXdsaW5lKSBzaG91bGQgYmUgcmVtb3ZlZCBmcm9tIGEgdG9rZW5cbiAgICogYnV0IHRoZSBuZXcgbGluZSBzaG91bGQgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKi9cbiAgZXNjYXBlZFN0cmluZz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b2tlbml6ZShcbiAgICBzb3VyY2U6IHN0cmluZywgdXJsOiBzdHJpbmcsIGdldFRhZ0RlZmluaXRpb246ICh0YWdOYW1lOiBzdHJpbmcpID0+IFRhZ0RlZmluaXRpb24sXG4gICAgb3B0aW9uczogVG9rZW5pemVPcHRpb25zID0ge30pOiBUb2tlbml6ZVJlc3VsdCB7XG4gIHJldHVybiBuZXcgX1Rva2VuaXplcihuZXcgUGFyc2VTb3VyY2VGaWxlKHNvdXJjZSwgdXJsKSwgZ2V0VGFnRGVmaW5pdGlvbiwgb3B0aW9ucykudG9rZW5pemUoKTtcbn1cblxuY29uc3QgX0NSX09SX0NSTEZfUkVHRVhQID0gL1xcclxcbj8vZztcblxuZnVuY3Rpb24gX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyhjaGFyQ29kZTogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgY2hhciA9IGNoYXJDb2RlID09PSBjaGFycy4kRU9GID8gJ0VPRicgOiBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXJDb2RlKTtcbiAgcmV0dXJuIGBVbmV4cGVjdGVkIGNoYXJhY3RlciBcIiR7Y2hhcn1cImA7XG59XG5cbmZ1bmN0aW9uIF91bmtub3duRW50aXR5RXJyb3JNc2coZW50aXR5U3JjOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFVua25vd24gZW50aXR5IFwiJHtlbnRpdHlTcmN9XCIgLSB1c2UgdGhlIFwiJiM8ZGVjaW1hbD47XCIgb3IgIFwiJiN4PGhleD47XCIgc3ludGF4YDtcbn1cblxuY2xhc3MgX0NvbnRyb2xGbG93RXJyb3Ige1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXJyb3I6IFRva2VuRXJyb3IpIHt9XG59XG5cbi8vIFNlZSBodHRwOi8vd3d3LnczLm9yZy9UUi9odG1sNTEvc3ludGF4Lmh0bWwjd3JpdGluZ1xuY2xhc3MgX1Rva2VuaXplciB7XG4gIHByaXZhdGUgX2N1cnNvcjogQ2hhcmFjdGVyQ3Vyc29yO1xuICBwcml2YXRlIF90b2tlbml6ZUljdTogYm9vbGVhbjtcbiAgcHJpdmF0ZSBfaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgcHJpdmF0ZSBfY3VycmVudFRva2VuU3RhcnQ6IENoYXJhY3RlckN1cnNvcnxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfY3VycmVudFRva2VuVHlwZTogVG9rZW5UeXBlfG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9leHBhbnNpb25DYXNlU3RhY2s6IFRva2VuVHlwZVtdID0gW107XG4gIHByaXZhdGUgX2luSW50ZXJwb2xhdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIHRva2VuczogVG9rZW5bXSA9IFtdO1xuICBlcnJvcnM6IFRva2VuRXJyb3JbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBAcGFyYW0gX2ZpbGUgVGhlIGh0bWwgc291cmNlIGZpbGUgYmVpbmcgdG9rZW5pemVkLlxuICAgKiBAcGFyYW0gX2dldFRhZ0RlZmluaXRpb24gQSBmdW5jdGlvbiB0aGF0IHdpbGwgcmV0cmlldmUgYSB0YWcgZGVmaW5pdGlvbiBmb3IgYSBnaXZlbiB0YWcgbmFtZS5cbiAgICogQHBhcmFtIG9wdGlvbnMgQ29uZmlndXJhdGlvbiBvZiB0aGUgdG9rZW5pemF0aW9uLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgICBfZmlsZTogUGFyc2VTb3VyY2VGaWxlLCBwcml2YXRlIF9nZXRUYWdEZWZpbml0aW9uOiAodGFnTmFtZTogc3RyaW5nKSA9PiBUYWdEZWZpbml0aW9uLFxuICAgICAgb3B0aW9uczogVG9rZW5pemVPcHRpb25zKSB7XG4gICAgdGhpcy5fdG9rZW5pemVJY3UgPSBvcHRpb25zLnRva2VuaXplRXhwYW5zaW9uRm9ybXMgfHwgZmFsc2U7XG4gICAgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyA9IG9wdGlvbnMuaW50ZXJwb2xhdGlvbkNvbmZpZyB8fCBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHO1xuICAgIGNvbnN0IHJhbmdlID1cbiAgICAgICAgb3B0aW9ucy5yYW5nZSB8fCB7ZW5kUG9zOiBfZmlsZS5jb250ZW50Lmxlbmd0aCwgc3RhcnRQb3M6IDAsIHN0YXJ0TGluZTogMCwgc3RhcnRDb2w6IDB9O1xuICAgIHRoaXMuX2N1cnNvciA9IG9wdGlvbnMuZXNjYXBlZFN0cmluZyA/IG5ldyBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yKF9maWxlLCByYW5nZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBQbGFpbkNoYXJhY3RlckN1cnNvcihfZmlsZSwgcmFuZ2UpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLl9jdXJzb3IuaW5pdCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIC8vIGh0dHA6Ly93d3cudzMub3JnL1RSL2h0bWw1L3N5bnRheC5odG1sI3ByZXByb2Nlc3NpbmctdGhlLWlucHV0LXN0cmVhbVxuICAgIC8vIEluIG9yZGVyIHRvIGtlZXAgdGhlIG9yaWdpbmFsIHBvc2l0aW9uIGluIHRoZSBzb3VyY2UsIHdlIGNhbiBub3RcbiAgICAvLyBwcmUtcHJvY2VzcyBpdC5cbiAgICAvLyBJbnN0ZWFkIENScyBhcmUgcHJvY2Vzc2VkIHJpZ2h0IGJlZm9yZSBpbnN0YW50aWF0aW5nIHRoZSB0b2tlbnMuXG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZShfQ1JfT1JfQ1JMRl9SRUdFWFAsICdcXG4nKTtcbiAgfVxuXG4gIHRva2VuaXplKCk6IFRva2VuaXplUmVzdWx0IHtcbiAgICB3aGlsZSAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJEVPRikge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJExUKSkge1xuICAgICAgICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJEJBTkcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRMQlJBQ0tFVCkpIHtcbiAgICAgICAgICAgICAgdGhpcy5fY29uc3VtZUNkYXRhKHN0YXJ0KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRNSU5VUykpIHtcbiAgICAgICAgICAgICAgdGhpcy5fY29uc3VtZUNvbW1lbnQoc3RhcnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5fY29uc3VtZURvY1R5cGUoc3RhcnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRTTEFTSCkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVUYWdDbG9zZShzdGFydCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVUYWdPcGVuKHN0YXJ0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoISh0aGlzLl90b2tlbml6ZUljdSAmJiB0aGlzLl90b2tlbml6ZUV4cGFuc2lvbkZvcm0oKSkpIHtcbiAgICAgICAgICB0aGlzLl9jb25zdW1lVGV4dCgpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRoaXMuaGFuZGxlRXJyb3IoZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVPRik7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHJldHVybiBuZXcgVG9rZW5pemVSZXN1bHQobWVyZ2VUZXh0VG9rZW5zKHRoaXMudG9rZW5zKSwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHdoZXRoZXIgYW4gSUNVIHRva2VuIGhhcyBiZWVuIGNyZWF0ZWRcbiAgICogQGludGVybmFsXG4gICAqL1xuICBwcml2YXRlIF90b2tlbml6ZUV4cGFuc2lvbkZvcm0oKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuaXNFeHBhbnNpb25Gb3JtU3RhcnQoKSkge1xuICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbkZvcm1TdGFydCgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGlzRXhwYW5zaW9uQ2FzZVN0YXJ0KHRoaXMuX2N1cnNvci5wZWVrKCkpICYmIHRoaXMuX2lzSW5FeHBhbnNpb25Gb3JtKCkpIHtcbiAgICAgIHRoaXMuX2NvbnN1bWVFeHBhbnNpb25DYXNlU3RhcnQoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kUkJSQUNFKSB7XG4gICAgICBpZiAodGhpcy5faXNJbkV4cGFuc2lvbkNhc2UoKSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uQ2FzZUVuZCgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2lzSW5FeHBhbnNpb25Gb3JtKCkpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbkZvcm1FbmQoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfYmVnaW5Ub2tlbih0eXBlOiBUb2tlblR5cGUsIHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCkpIHtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5TdGFydCA9IHN0YXJ0O1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUgPSB0eXBlO1xuICB9XG5cbiAgcHJpdmF0ZSBfZW5kVG9rZW4ocGFydHM6IHN0cmluZ1tdLCBlbmQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKSk6IFRva2VuIHtcbiAgICBpZiAodGhpcy5fY3VycmVudFRva2VuU3RhcnQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBUb2tlbkVycm9yKFxuICAgICAgICAgICdQcm9ncmFtbWluZyBlcnJvciAtIGF0dGVtcHRlZCB0byBlbmQgYSB0b2tlbiB3aGVuIHRoZXJlIHdhcyBubyBzdGFydCB0byB0aGUgdG9rZW4nLFxuICAgICAgICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUsIHRoaXMuX2N1cnNvci5nZXRTcGFuKGVuZCkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fY3VycmVudFRva2VuVHlwZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAgICAgJ1Byb2dyYW1taW5nIGVycm9yIC0gYXR0ZW1wdGVkIHRvIGVuZCBhIHRva2VuIHdoaWNoIGhhcyBubyB0b2tlbiB0eXBlJywgbnVsbCxcbiAgICAgICAgICB0aGlzLl9jdXJzb3IuZ2V0U3Bhbih0aGlzLl9jdXJyZW50VG9rZW5TdGFydCkpO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbiA9XG4gICAgICAgIG5ldyBUb2tlbih0aGlzLl9jdXJyZW50VG9rZW5UeXBlLCBwYXJ0cywgdGhpcy5fY3Vyc29yLmdldFNwYW4odGhpcy5fY3VycmVudFRva2VuU3RhcnQpKTtcbiAgICB0aGlzLnRva2Vucy5wdXNoKHRva2VuKTtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5TdGFydCA9IG51bGw7XG4gICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSA9IG51bGw7XG4gICAgcmV0dXJuIHRva2VuO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRXJyb3IobXNnOiBzdHJpbmcsIHNwYW46IFBhcnNlU291cmNlU3Bhbik6IF9Db250cm9sRmxvd0Vycm9yIHtcbiAgICBpZiAodGhpcy5faXNJbkV4cGFuc2lvbkZvcm0oKSkge1xuICAgICAgbXNnICs9IGAgKERvIHlvdSBoYXZlIGFuIHVuZXNjYXBlZCBcIntcIiBpbiB5b3VyIHRlbXBsYXRlPyBVc2UgXCJ7eyAneycgfX1cIikgdG8gZXNjYXBlIGl0LilgO1xuICAgIH1cbiAgICBjb25zdCBlcnJvciA9IG5ldyBUb2tlbkVycm9yKG1zZywgdGhpcy5fY3VycmVudFRva2VuVHlwZSwgc3Bhbik7XG4gICAgdGhpcy5fY3VycmVudFRva2VuU3RhcnQgPSBudWxsO1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUgPSBudWxsO1xuICAgIHJldHVybiBuZXcgX0NvbnRyb2xGbG93RXJyb3IoZXJyb3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVFcnJvcihlOiBhbnkpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIEN1cnNvckVycm9yKSB7XG4gICAgICBlID0gdGhpcy5fY3JlYXRlRXJyb3IoZS5tc2csIHRoaXMuX2N1cnNvci5nZXRTcGFuKGUuY3Vyc29yKSk7XG4gICAgfVxuICAgIGlmIChlIGluc3RhbmNlb2YgX0NvbnRyb2xGbG93RXJyb3IpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goZS5lcnJvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdENoYXJDb2RlKGNoYXJDb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhckNvZGUpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdENoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKGNoYXJDb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAoY29tcGFyZUNoYXJDb2RlQ2FzZUluc2Vuc2l0aXZlKHRoaXMuX2N1cnNvci5wZWVrKCksIGNoYXJDb2RlKSkge1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9yZXF1aXJlQ2hhckNvZGUoY2hhckNvZGU6IG51bWJlcikge1xuICAgIGNvbnN0IGxvY2F0aW9uID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhckNvZGUpKSB7XG4gICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgICAgICBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKHRoaXMuX2N1cnNvci5wZWVrKCkpLCB0aGlzLl9jdXJzb3IuZ2V0U3Bhbihsb2NhdGlvbikpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2F0dGVtcHRTdHIoY2hhcnM6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGxlbiA9IGNoYXJzLmxlbmd0aDtcbiAgICBpZiAodGhpcy5fY3Vyc29yLmNoYXJzTGVmdCgpIDwgbGVuKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IGluaXRpYWxQb3NpdGlvbiA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLmNoYXJDb2RlQXQoaSkpKSB7XG4gICAgICAgIC8vIElmIGF0dGVtcHRpbmcgdG8gcGFyc2UgdGhlIHN0cmluZyBmYWlscywgd2Ugd2FudCB0byByZXNldCB0aGUgcGFyc2VyXG4gICAgICAgIC8vIHRvIHdoZXJlIGl0IHdhcyBiZWZvcmUgdGhlIGF0dGVtcHRcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gaW5pdGlhbFBvc2l0aW9uO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdFN0ckNhc2VJbnNlbnNpdGl2ZShjaGFyczogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGVDYXNlSW5zZW5zaXRpdmUoY2hhcnMuY2hhckNvZGVBdChpKSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcXVpcmVTdHIoY2hhcnM6IHN0cmluZykge1xuICAgIGNvbnN0IGxvY2F0aW9uID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgaWYgKCF0aGlzLl9hdHRlbXB0U3RyKGNoYXJzKSkge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSwgdGhpcy5fY3Vyc29yLmdldFNwYW4obG9jYXRpb24pKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKHByZWRpY2F0ZTogKGNvZGU6IG51bWJlcikgPT4gYm9vbGVhbikge1xuICAgIHdoaWxlICghcHJlZGljYXRlKHRoaXMuX2N1cnNvci5wZWVrKCkpKSB7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3JlcXVpcmVDaGFyQ29kZVVudGlsRm4ocHJlZGljYXRlOiAoY29kZTogbnVtYmVyKSA9PiBib29sZWFuLCBsZW46IG51bWJlcikge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihwcmVkaWNhdGUpO1xuICAgIGNvbnN0IGVuZCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIGlmIChlbmQuZGlmZihzdGFydCkgPCBsZW4pIHtcbiAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICAgIF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2codGhpcy5fY3Vyc29yLnBlZWsoKSksIHRoaXMuX2N1cnNvci5nZXRTcGFuKHN0YXJ0KSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdFVudGlsQ2hhcihjaGFyOiBudW1iZXIpIHtcbiAgICB3aGlsZSAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcikge1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9yZWFkQ2hhcihkZWNvZGVFbnRpdGllczogYm9vbGVhbik6IHN0cmluZyB7XG4gICAgaWYgKGRlY29kZUVudGl0aWVzICYmIHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRBTVBFUlNBTkQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9kZWNvZGVFbnRpdHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRG9uJ3QgcmVseSB1cG9uIHJlYWRpbmcgZGlyZWN0bHkgZnJvbSBgX2lucHV0YCBhcyB0aGUgYWN0dWFsIGNoYXIgdmFsdWVcbiAgICAgIC8vIG1heSBoYXZlIGJlZW4gZ2VuZXJhdGVkIGZyb20gYW4gZXNjYXBlIHNlcXVlbmNlLlxuICAgICAgY29uc3QgY2hhciA9IFN0cmluZy5mcm9tQ29kZVBvaW50KHRoaXMuX2N1cnNvci5wZWVrKCkpO1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBjaGFyO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2RlY29kZUVudGl0eSgpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICBpZiAodGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRIQVNIKSkge1xuICAgICAgY29uc3QgaXNIZXggPSB0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJHgpIHx8IHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kWCk7XG4gICAgICBjb25zdCBjb2RlU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNEaWdpdEVudGl0eUVuZCk7XG4gICAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPSBjaGFycy4kU0VNSUNPTE9OKSB7XG4gICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oKSk7XG4gICAgICB9XG4gICAgICBjb25zdCBzdHJOdW0gPSB0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMoY29kZVN0YXJ0KTtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjaGFyQ29kZSA9IHBhcnNlSW50KHN0ck51bSwgaXNIZXggPyAxNiA6IDEwKTtcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoY2hhckNvZGUpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICAgICAgX3Vua25vd25FbnRpdHlFcnJvck1zZyh0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMoc3RhcnQpKSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5hbWVTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05hbWVkRW50aXR5RW5kKTtcbiAgICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpICE9IGNoYXJzLiRTRU1JQ09MT04pIHtcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gbmFtZVN0YXJ0O1xuICAgICAgICByZXR1cm4gJyYnO1xuICAgICAgfVxuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhuYW1lU3RhcnQpO1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIGNvbnN0IGNoYXIgPSBOQU1FRF9FTlRJVElFU1tuYW1lXTtcbiAgICAgIGlmICghY2hhcikge1xuICAgICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihfdW5rbm93bkVudGl0eUVycm9yTXNnKG5hbWUpLCB0aGlzLl9jdXJzb3IuZ2V0U3BhbihzdGFydCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNoYXI7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVJhd1RleHQoZGVjb2RlRW50aXRpZXM6IGJvb2xlYW4sIGVuZE1hcmtlclByZWRpY2F0ZTogKCkgPT4gYm9vbGVhbik6IFRva2VuIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKGRlY29kZUVudGl0aWVzID8gVG9rZW5UeXBlLkVTQ0FQQUJMRV9SQVdfVEVYVCA6IFRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHRhZ0Nsb3NlU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIGNvbnN0IGZvdW5kRW5kTWFya2VyID0gZW5kTWFya2VyUHJlZGljYXRlKCk7XG4gICAgICB0aGlzLl9jdXJzb3IgPSB0YWdDbG9zZVN0YXJ0O1xuICAgICAgaWYgKGZvdW5kRW5kTWFya2VyKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgcGFydHMucHVzaCh0aGlzLl9yZWFkQ2hhcihkZWNvZGVFbnRpdGllcykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZW5kVG9rZW4oW3RoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnMocGFydHMuam9pbignJykpXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ29tbWVudChzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ09NTUVOVF9TVEFSVCwgc3RhcnQpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kTUlOVVMpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgICB0aGlzLl9jb25zdW1lUmF3VGV4dChmYWxzZSwgKCkgPT4gdGhpcy5fYXR0ZW1wdFN0cignLS0+JykpO1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkNPTU1FTlRfRU5EKTtcbiAgICB0aGlzLl9yZXF1aXJlU3RyKCctLT4nKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ2RhdGEoc3RhcnQ6IENoYXJhY3RlckN1cnNvcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkNEQVRBX1NUQVJULCBzdGFydCk7XG4gICAgdGhpcy5fcmVxdWlyZVN0cignQ0RBVEFbJyk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0KGZhbHNlLCAoKSA9PiB0aGlzLl9hdHRlbXB0U3RyKCddXT4nKSk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ0RBVEFfRU5EKTtcbiAgICB0aGlzLl9yZXF1aXJlU3RyKCddXT4nKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRG9jVHlwZShzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRE9DX1RZUEUsIHN0YXJ0KTtcbiAgICBjb25zdCBjb250ZW50U3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0VW50aWxDaGFyKGNoYXJzLiRHVCk7XG4gICAgY29uc3QgY29udGVudCA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhjb250ZW50U3RhcnQpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW2NvbnRlbnRdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVQcmVmaXhBbmROYW1lKCk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBuYW1lT3JQcmVmaXhTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIGxldCBwcmVmaXg6IHN0cmluZyA9ICcnO1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kQ09MT04gJiYgIWlzUHJlZml4RW5kKHRoaXMuX2N1cnNvci5wZWVrKCkpKSB7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgICBsZXQgbmFtZVN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3I7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRDT0xPTikge1xuICAgICAgcHJlZml4ID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVPclByZWZpeFN0YXJ0KTtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICBuYW1lU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZVN0YXJ0ID0gbmFtZU9yUHJlZml4U3RhcnQ7XG4gICAgfVxuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZVVudGlsRm4oaXNOYW1lRW5kLCBwcmVmaXggPT09ICcnID8gMCA6IDEpO1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMobmFtZVN0YXJ0KTtcbiAgICByZXR1cm4gW3ByZWZpeCwgbmFtZV07XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGFnT3BlbihzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgbGV0IHRhZ05hbWU6IHN0cmluZztcbiAgICBsZXQgcHJlZml4OiBzdHJpbmc7XG4gICAgbGV0IG9wZW5UYWdUb2tlbjogVG9rZW58dW5kZWZpbmVkO1xuICAgIGxldCB0b2tlbnNCZWZvcmVUYWdPcGVuID0gdGhpcy50b2tlbnMubGVuZ3RoO1xuICAgIGNvbnN0IGlubmVyU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0cnkge1xuICAgICAgaWYgKCFjaGFycy5pc0FzY2lpTGV0dGVyKHRoaXMuX2N1cnNvci5wZWVrKCkpKSB7XG4gICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oc3RhcnQpKTtcbiAgICAgIH1cblxuICAgICAgb3BlblRhZ1Rva2VuID0gdGhpcy5fY29uc3VtZVRhZ09wZW5TdGFydChzdGFydCk7XG4gICAgICBwcmVmaXggPSBvcGVuVGFnVG9rZW4ucGFydHNbMF07XG4gICAgICB0YWdOYW1lID0gb3BlblRhZ1Rva2VuLnBhcnRzWzFdO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgd2hpbGUgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRTTEFTSCAmJiB0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kR1QpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZUF0dHJpYnV0ZU5hbWUoKTtcbiAgICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgICBpZiAodGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRFUSkpIHtcbiAgICAgICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICAgICAgdGhpcy5fY29uc3VtZUF0dHJpYnV0ZVZhbHVlKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY29uc3VtZVRhZ09wZW5FbmQoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIF9Db250cm9sRmxvd0Vycm9yKSB7XG4gICAgICAgIC8vIFdoZW4gdGhlIHN0YXJ0IHRhZyBpcyBpbnZhbGlkIChpbmNsdWRpbmcgaW52YWxpZCBcImF0dHJpYnV0ZXNcIiksIGFzc3VtZSB3ZSB3YW50IGEgXCI8XCJcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gaW5uZXJTdGFydDtcbiAgICAgICAgaWYgKG9wZW5UYWdUb2tlbikge1xuICAgICAgICAgIHRoaXMudG9rZW5zLmxlbmd0aCA9IHRva2Vuc0JlZm9yZVRhZ09wZW47XG4gICAgICAgIH1cbiAgICAgICAgLy8gQmFjayB0byBiYWNrIHRleHQgdG9rZW5zIGFyZSBtZXJnZWQgYXQgdGhlIGVuZFxuICAgICAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5URVhULCBzdGFydCk7XG4gICAgICAgIHRoaXMuX2VuZFRva2VuKFsnPCddKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRUb2tlblR5cGUgPSB0aGlzLl9nZXRUYWdEZWZpbml0aW9uKHRhZ05hbWUpLmNvbnRlbnRUeXBlO1xuXG4gICAgaWYgKGNvbnRlbnRUb2tlblR5cGUgPT09IFRhZ0NvbnRlbnRUeXBlLlJBV19URVhUKSB7XG4gICAgICB0aGlzLl9jb25zdW1lUmF3VGV4dFdpdGhUYWdDbG9zZShwcmVmaXgsIHRhZ05hbWUsIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGNvbnRlbnRUb2tlblR5cGUgPT09IFRhZ0NvbnRlbnRUeXBlLkVTQ0FQQUJMRV9SQVdfVEVYVCkge1xuICAgICAgdGhpcy5fY29uc3VtZVJhd1RleHRXaXRoVGFnQ2xvc2UocHJlZml4LCB0YWdOYW1lLCB0cnVlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lUmF3VGV4dFdpdGhUYWdDbG9zZShwcmVmaXg6IHN0cmluZywgdGFnTmFtZTogc3RyaW5nLCBkZWNvZGVFbnRpdGllczogYm9vbGVhbikge1xuICAgIGNvbnN0IHRleHRUb2tlbiA9IHRoaXMuX2NvbnN1bWVSYXdUZXh0KGRlY29kZUVudGl0aWVzLCAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kTFQpKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoIXRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kU0xBU0gpKSByZXR1cm4gZmFsc2U7XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICBpZiAoIXRoaXMuX2F0dGVtcHRTdHJDYXNlSW5zZW5zaXRpdmUodGFnTmFtZSkpIHJldHVybiBmYWxzZTtcbiAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgIHJldHVybiB0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJEdUKTtcbiAgICB9KTtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5UQUdfQ0xPU0UpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZVVudGlsRm4oY29kZSA9PiBjb2RlID09PSBjaGFycy4kR1QsIDMpO1xuICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7ICAvLyBDb25zdW1lIHRoZSBgPmBcbiAgICB0aGlzLl9lbmRUb2tlbihbcHJlZml4LCB0YWdOYW1lXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGFnT3BlblN0YXJ0KHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5UQUdfT1BFTl9TVEFSVCwgc3RhcnQpO1xuICAgIGNvbnN0IHBhcnRzID0gdGhpcy5fY29uc3VtZVByZWZpeEFuZE5hbWUoKTtcbiAgICByZXR1cm4gdGhpcy5fZW5kVG9rZW4ocGFydHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHJpYnV0ZU5hbWUoKSB7XG4gICAgY29uc3QgYXR0ck5hbWVTdGFydCA9IHRoaXMuX2N1cnNvci5wZWVrKCk7XG4gICAgaWYgKGF0dHJOYW1lU3RhcnQgPT09IGNoYXJzLiRTUSB8fCBhdHRyTmFtZVN0YXJ0ID09PSBjaGFycy4kRFEpIHtcbiAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2coYXR0ck5hbWVTdGFydCksIHRoaXMuX2N1cnNvci5nZXRTcGFuKCkpO1xuICAgIH1cbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5BVFRSX05BTUUpO1xuICAgIGNvbnN0IHByZWZpeEFuZE5hbWUgPSB0aGlzLl9jb25zdW1lUHJlZml4QW5kTmFtZSgpO1xuICAgIHRoaXMuX2VuZFRva2VuKHByZWZpeEFuZE5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHJpYnV0ZVZhbHVlKCkge1xuICAgIGxldCB2YWx1ZTogc3RyaW5nO1xuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kU1EgfHwgdGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJERRKSB7XG4gICAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5BVFRSX1FVT1RFKTtcbiAgICAgIGNvbnN0IHF1b3RlQ2hhciA9IHRoaXMuX2N1cnNvci5wZWVrKCk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgdGhpcy5fZW5kVG9rZW4oW1N0cmluZy5mcm9tQ29kZVBvaW50KHF1b3RlQ2hhcildKTtcbiAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkFUVFJfVkFMVUUpO1xuICAgICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgICB3aGlsZSAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gcXVvdGVDaGFyKSB7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5fcmVhZENoYXIodHJ1ZSkpO1xuICAgICAgfVxuICAgICAgdmFsdWUgPSBwYXJ0cy5qb2luKCcnKTtcbiAgICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKHZhbHVlKV0pO1xuICAgICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQVRUUl9RVU9URSk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgdGhpcy5fZW5kVG9rZW4oW1N0cmluZy5mcm9tQ29kZVBvaW50KHF1b3RlQ2hhcildKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQVRUUl9WQUxVRSk7XG4gICAgICBjb25zdCB2YWx1ZVN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGVVbnRpbEZuKGlzTmFtZUVuZCwgMSk7XG4gICAgICB2YWx1ZSA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyh2YWx1ZVN0YXJ0KTtcbiAgICAgIHRoaXMuX2VuZFRva2VuKFt0aGlzLl9wcm9jZXNzQ2FycmlhZ2VSZXR1cm5zKHZhbHVlKV0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUYWdPcGVuRW5kKCkge1xuICAgIGNvbnN0IHRva2VuVHlwZSA9XG4gICAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kU0xBU0gpID8gVG9rZW5UeXBlLlRBR19PUEVOX0VORF9WT0lEIDogVG9rZW5UeXBlLlRBR19PUEVOX0VORDtcbiAgICB0aGlzLl9iZWdpblRva2VuKHRva2VuVHlwZSk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRHVCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVRhZ0Nsb3NlKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5UQUdfQ0xPU0UsIHN0YXJ0KTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgY29uc3QgcHJlZml4QW5kTmFtZSA9IHRoaXMuX2NvbnN1bWVQcmVmaXhBbmROYW1lKCk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kR1QpO1xuICAgIHRoaXMuX2VuZFRva2VuKHByZWZpeEFuZE5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbkZvcm1TdGFydCgpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRMQlJBQ0UpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wdXNoKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCk7XG5cbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgY29uc3QgY29uZGl0aW9uID0gdGhpcy5fcmVhZFVudGlsKGNoYXJzLiRDT01NQSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW2NvbmRpdGlvbl0pO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kQ09NTUEpO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlJBV19URVhUKTtcbiAgICBjb25zdCB0eXBlID0gdGhpcy5fcmVhZFVudGlsKGNoYXJzLiRDT01NQSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW3R5cGVdKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJENPTU1BKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uQ2FzZVN0YXJ0KCkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX1ZBTFVFKTtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuX3JlYWRVbnRpbChjaGFycy4kTEJSQUNFKS50cmltKCk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW3ZhbHVlXSk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuXG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJExCUkFDRSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wdXNoKFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbkNhc2VFbmQoKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX0VORCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRSQlJBQ0UpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG5cbiAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2sucG9wKCk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uRm9ybUVuZCgpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9FTkQpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kUkJSQUNFKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG5cbiAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2sucG9wKCk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGV4dCgpIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRFWFQsIHN0YXJ0KTtcbiAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcblxuICAgIGRvIHtcbiAgICAgIGlmICh0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnICYmIHRoaXMuX2F0dGVtcHRTdHIodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydCkpIHtcbiAgICAgICAgcGFydHMucHVzaCh0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0KTtcbiAgICAgICAgdGhpcy5faW5JbnRlcnBvbGF0aW9uID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgdGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZyAmJiB0aGlzLl9pbkludGVycG9sYXRpb24gJiZcbiAgICAgICAgICB0aGlzLl9hdHRlbXB0U3RyKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcuZW5kKSkge1xuICAgICAgICBwYXJ0cy5wdXNoKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcuZW5kKTtcbiAgICAgICAgdGhpcy5faW5JbnRlcnBvbGF0aW9uID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJ0cy5wdXNoKHRoaXMuX3JlYWRDaGFyKHRydWUpKTtcbiAgICAgIH1cbiAgICB9IHdoaWxlICghdGhpcy5faXNUZXh0RW5kKCkpO1xuXG4gICAgdGhpcy5fZW5kVG9rZW4oW3RoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnMocGFydHMuam9pbignJykpXSk7XG4gIH1cblxuICBwcml2YXRlIF9pc1RleHRFbmQoKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRMVCB8fCB0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kRU9GKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fdG9rZW5pemVJY3UgJiYgIXRoaXMuX2luSW50ZXJwb2xhdGlvbikge1xuICAgICAgaWYgKHRoaXMuaXNFeHBhbnNpb25Gb3JtU3RhcnQoKSkge1xuICAgICAgICAvLyBzdGFydCBvZiBhbiBleHBhbnNpb24gZm9ybVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRSQlJBQ0UgJiYgdGhpcy5faXNJbkV4cGFuc2lvbkNhc2UoKSkge1xuICAgICAgICAvLyBlbmQgb2YgYW5kIGV4cGFuc2lvbiBjYXNlXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlYWRVbnRpbChjaGFyOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgdGhpcy5fYXR0ZW1wdFVudGlsQ2hhcihjaGFyKTtcbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yLmdldENoYXJzKHN0YXJ0KTtcbiAgfVxuXG4gIHByaXZhdGUgX2lzSW5FeHBhbnNpb25DYXNlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2subGVuZ3RoID4gMCAmJlxuICAgICAgICB0aGlzLl9leHBhbnNpb25DYXNlU3RhY2tbdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLmxlbmd0aCAtIDFdID09PVxuICAgICAgICBUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUO1xuICB9XG5cbiAgcHJpdmF0ZSBfaXNJbkV4cGFuc2lvbkZvcm0oKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5sZW5ndGggPiAwICYmXG4gICAgICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFja1t0aGlzLl9leHBhbnNpb25DYXNlU3RhY2subGVuZ3RoIC0gMV0gPT09XG4gICAgICAgIFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVDtcbiAgfVxuXG4gIHByaXZhdGUgaXNFeHBhbnNpb25Gb3JtU3RhcnQoKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRMQlJBQ0UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICBjb25zdCBpc0ludGVycG9sYXRpb24gPSB0aGlzLl9hdHRlbXB0U3RyKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcuc3RhcnQpO1xuICAgICAgdGhpcy5fY3Vyc29yID0gc3RhcnQ7XG4gICAgICByZXR1cm4gIWlzSW50ZXJwb2xhdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNOb3RXaGl0ZXNwYWNlKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gIWNoYXJzLmlzV2hpdGVzcGFjZShjb2RlKSB8fCBjb2RlID09PSBjaGFycy4kRU9GO1xufVxuXG5mdW5jdGlvbiBpc05hbWVFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjaGFycy5pc1doaXRlc3BhY2UoY29kZSkgfHwgY29kZSA9PT0gY2hhcnMuJEdUIHx8IGNvZGUgPT09IGNoYXJzLiRTTEFTSCB8fFxuICAgICAgY29kZSA9PT0gY2hhcnMuJFNRIHx8IGNvZGUgPT09IGNoYXJzLiREUSB8fCBjb2RlID09PSBjaGFycy4kRVE7XG59XG5cbmZ1bmN0aW9uIGlzUHJlZml4RW5kKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKGNvZGUgPCBjaGFycy4kYSB8fCBjaGFycy4keiA8IGNvZGUpICYmIChjb2RlIDwgY2hhcnMuJEEgfHwgY2hhcnMuJFogPCBjb2RlKSAmJlxuICAgICAgKGNvZGUgPCBjaGFycy4kMCB8fCBjb2RlID4gY2hhcnMuJDkpO1xufVxuXG5mdW5jdGlvbiBpc0RpZ2l0RW50aXR5RW5kKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29kZSA9PSBjaGFycy4kU0VNSUNPTE9OIHx8IGNvZGUgPT0gY2hhcnMuJEVPRiB8fCAhY2hhcnMuaXNBc2NpaUhleERpZ2l0KGNvZGUpO1xufVxuXG5mdW5jdGlvbiBpc05hbWVkRW50aXR5RW5kKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29kZSA9PSBjaGFycy4kU0VNSUNPTE9OIHx8IGNvZGUgPT0gY2hhcnMuJEVPRiB8fCAhY2hhcnMuaXNBc2NpaUxldHRlcihjb2RlKTtcbn1cblxuZnVuY3Rpb24gaXNFeHBhbnNpb25DYXNlU3RhcnQocGVlazogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBwZWVrID09PSBjaGFycy4kRVEgfHwgY2hhcnMuaXNBc2NpaUxldHRlcihwZWVrKSB8fCBjaGFycy5pc0RpZ2l0KHBlZWspO1xufVxuXG5mdW5jdGlvbiBjb21wYXJlQ2hhckNvZGVDYXNlSW5zZW5zaXRpdmUoY29kZTE6IG51bWJlciwgY29kZTI6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gdG9VcHBlckNhc2VDaGFyQ29kZShjb2RlMSkgPT0gdG9VcHBlckNhc2VDaGFyQ29kZShjb2RlMik7XG59XG5cbmZ1bmN0aW9uIHRvVXBwZXJDYXNlQ2hhckNvZGUoY29kZTogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIGNvZGUgPj0gY2hhcnMuJGEgJiYgY29kZSA8PSBjaGFycy4keiA/IGNvZGUgLSBjaGFycy4kYSArIGNoYXJzLiRBIDogY29kZTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VUZXh0VG9rZW5zKHNyY1Rva2VuczogVG9rZW5bXSk6IFRva2VuW10ge1xuICBjb25zdCBkc3RUb2tlbnM6IFRva2VuW10gPSBbXTtcbiAgbGV0IGxhc3REc3RUb2tlbjogVG9rZW58dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNyY1Rva2Vucy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHRva2VuID0gc3JjVG9rZW5zW2ldO1xuICAgIGlmIChsYXN0RHN0VG9rZW4gJiYgbGFzdERzdFRva2VuLnR5cGUgPT0gVG9rZW5UeXBlLlRFWFQgJiYgdG9rZW4udHlwZSA9PSBUb2tlblR5cGUuVEVYVCkge1xuICAgICAgbGFzdERzdFRva2VuLnBhcnRzWzBdICEgKz0gdG9rZW4ucGFydHNbMF07XG4gICAgICBsYXN0RHN0VG9rZW4uc291cmNlU3Bhbi5lbmQgPSB0b2tlbi5zb3VyY2VTcGFuLmVuZDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGFzdERzdFRva2VuID0gdG9rZW47XG4gICAgICBkc3RUb2tlbnMucHVzaChsYXN0RHN0VG9rZW4pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkc3RUb2tlbnM7XG59XG5cblxuLyoqXG4gKiBUaGUgX1Rva2VuaXplciB1c2VzIG9iamVjdHMgb2YgdGhpcyB0eXBlIHRvIG1vdmUgdGhyb3VnaCB0aGUgaW5wdXQgdGV4dCxcbiAqIGV4dHJhY3RpbmcgXCJwYXJzZWQgY2hhcmFjdGVyc1wiLiBUaGVzZSBjb3VsZCBiZSBtb3JlIHRoYW4gb25lIGFjdHVhbCBjaGFyYWN0ZXJcbiAqIGlmIHRoZSB0ZXh0IGNvbnRhaW5zIGVzY2FwZSBzZXF1ZW5jZXMuXG4gKi9cbmludGVyZmFjZSBDaGFyYWN0ZXJDdXJzb3Ige1xuICAvKiogSW5pdGlhbGl6ZSB0aGUgY3Vyc29yLiAqL1xuICBpbml0KCk6IHZvaWQ7XG4gIC8qKiBUaGUgcGFyc2VkIGNoYXJhY3RlciBhdCB0aGUgY3VycmVudCBjdXJzb3IgcG9zaXRpb24uICovXG4gIHBlZWsoKTogbnVtYmVyO1xuICAvKiogQWR2YW5jZSB0aGUgY3Vyc29yIGJ5IG9uZSBwYXJzZWQgY2hhcmFjdGVyLiAqL1xuICBhZHZhbmNlKCk6IHZvaWQ7XG4gIC8qKiBHZXQgYSBzcGFuIGZyb20gdGhlIG1hcmtlZCBzdGFydCBwb2ludCB0byB0aGUgY3VycmVudCBwb2ludC4gKi9cbiAgZ2V0U3BhbihzdGFydD86IHRoaXMpOiBQYXJzZVNvdXJjZVNwYW47XG4gIC8qKiBHZXQgdGhlIHBhcnNlZCBjaGFyYWN0ZXJzIGZyb20gdGhlIG1hcmtlZCBzdGFydCBwb2ludCB0byB0aGUgY3VycmVudCBwb2ludC4gKi9cbiAgZ2V0Q2hhcnMoc3RhcnQ6IHRoaXMpOiBzdHJpbmc7XG4gIC8qKiBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgbGVmdCBiZWZvcmUgdGhlIGVuZCBvZiB0aGUgY3Vyc29yLiAqL1xuICBjaGFyc0xlZnQoKTogbnVtYmVyO1xuICAvKiogVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGJldHdlZW4gYHRoaXNgIGN1cnNvciBhbmQgYG90aGVyYCBjdXJzb3IuICovXG4gIGRpZmYob3RoZXI6IHRoaXMpOiBudW1iZXI7XG4gIC8qKiBNYWtlIGEgY29weSBvZiB0aGlzIGN1cnNvciAqL1xuICBjbG9uZSgpOiBDaGFyYWN0ZXJDdXJzb3I7XG59XG5cbmludGVyZmFjZSBDdXJzb3JTdGF0ZSB7XG4gIHBlZWs6IG51bWJlcjtcbiAgb2Zmc2V0OiBudW1iZXI7XG4gIGxpbmU6IG51bWJlcjtcbiAgY29sdW1uOiBudW1iZXI7XG59XG5cbmNsYXNzIFBsYWluQ2hhcmFjdGVyQ3Vyc29yIGltcGxlbWVudHMgQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgcHJvdGVjdGVkIHN0YXRlOiBDdXJzb3JTdGF0ZTtcbiAgcHJvdGVjdGVkIGZpbGU6IFBhcnNlU291cmNlRmlsZTtcbiAgcHJvdGVjdGVkIGlucHV0OiBzdHJpbmc7XG4gIHByb3RlY3RlZCBlbmQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBsYWluQ2hhcmFjdGVyQ3Vyc29yKTtcbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQYXJzZVNvdXJjZUZpbGUsIHJhbmdlOiBMZXhlclJhbmdlKTtcbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQYXJzZVNvdXJjZUZpbGV8UGxhaW5DaGFyYWN0ZXJDdXJzb3IsIHJhbmdlPzogTGV4ZXJSYW5nZSkge1xuICAgIGlmIChmaWxlT3JDdXJzb3IgaW5zdGFuY2VvZiBQbGFpbkNoYXJhY3RlckN1cnNvcikge1xuICAgICAgdGhpcy5maWxlID0gZmlsZU9yQ3Vyc29yLmZpbGU7XG4gICAgICB0aGlzLmlucHV0ID0gZmlsZU9yQ3Vyc29yLmlucHV0O1xuICAgICAgdGhpcy5lbmQgPSBmaWxlT3JDdXJzb3IuZW5kO1xuICAgICAgdGhpcy5zdGF0ZSA9IHsuLi5maWxlT3JDdXJzb3Iuc3RhdGV9O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXJhbmdlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdQcm9ncmFtbWluZyBlcnJvcjogdGhlIHJhbmdlIGFyZ3VtZW50IG11c3QgYmUgcHJvdmlkZWQgd2l0aCBhIGZpbGUgYXJndW1lbnQuJyk7XG4gICAgICB9XG4gICAgICB0aGlzLmZpbGUgPSBmaWxlT3JDdXJzb3I7XG4gICAgICB0aGlzLmlucHV0ID0gZmlsZU9yQ3Vyc29yLmNvbnRlbnQ7XG4gICAgICB0aGlzLmVuZCA9IHJhbmdlLmVuZFBvcztcbiAgICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgIHBlZWs6IC0xLFxuICAgICAgICBvZmZzZXQ6IHJhbmdlLnN0YXJ0UG9zLFxuICAgICAgICBsaW5lOiByYW5nZS5zdGFydExpbmUsXG4gICAgICAgIGNvbHVtbjogcmFuZ2Uuc3RhcnRDb2wsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGNsb25lKCk6IFBsYWluQ2hhcmFjdGVyQ3Vyc29yIHsgcmV0dXJuIG5ldyBQbGFpbkNoYXJhY3RlckN1cnNvcih0aGlzKTsgfVxuXG4gIHBlZWsoKSB7IHJldHVybiB0aGlzLnN0YXRlLnBlZWs7IH1cbiAgY2hhcnNMZWZ0KCkgeyByZXR1cm4gdGhpcy5lbmQgLSB0aGlzLnN0YXRlLm9mZnNldDsgfVxuICBkaWZmKG90aGVyOiB0aGlzKSB7IHJldHVybiB0aGlzLnN0YXRlLm9mZnNldCAtIG90aGVyLnN0YXRlLm9mZnNldDsgfVxuXG4gIGFkdmFuY2UoKTogdm9pZCB7IHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuc3RhdGUpOyB9XG5cbiAgaW5pdCgpOiB2b2lkIHsgdGhpcy51cGRhdGVQZWVrKHRoaXMuc3RhdGUpOyB9XG5cbiAgZ2V0U3BhbihzdGFydD86IHRoaXMpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIHN0YXJ0ID0gc3RhcnQgfHwgdGhpcztcbiAgICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgbmV3IFBhcnNlTG9jYXRpb24oc3RhcnQuZmlsZSwgc3RhcnQuc3RhdGUub2Zmc2V0LCBzdGFydC5zdGF0ZS5saW5lLCBzdGFydC5zdGF0ZS5jb2x1bW4pLFxuICAgICAgICBuZXcgUGFyc2VMb2NhdGlvbih0aGlzLmZpbGUsIHRoaXMuc3RhdGUub2Zmc2V0LCB0aGlzLnN0YXRlLmxpbmUsIHRoaXMuc3RhdGUuY29sdW1uKSk7XG4gIH1cblxuICBnZXRDaGFycyhzdGFydDogdGhpcyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LnN0YXRlLm9mZnNldCwgdGhpcy5zdGF0ZS5vZmZzZXQpO1xuICB9XG5cbiAgY2hhckF0KHBvczogbnVtYmVyKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuaW5wdXQuY2hhckNvZGVBdChwb3MpOyB9XG5cbiAgcHJvdGVjdGVkIGFkdmFuY2VTdGF0ZShzdGF0ZTogQ3Vyc29yU3RhdGUpIHtcbiAgICBpZiAoc3RhdGUub2Zmc2V0ID49IHRoaXMuZW5kKSB7XG4gICAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gICAgICB0aHJvdyBuZXcgQ3Vyc29yRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhcmFjdGVyIFwiRU9GXCInLCB0aGlzKTtcbiAgICB9XG4gICAgY29uc3QgY3VycmVudENoYXIgPSB0aGlzLmNoYXJBdChzdGF0ZS5vZmZzZXQpO1xuICAgIGlmIChjdXJyZW50Q2hhciA9PT0gY2hhcnMuJExGKSB7XG4gICAgICBzdGF0ZS5saW5lKys7XG4gICAgICBzdGF0ZS5jb2x1bW4gPSAwO1xuICAgIH0gZWxzZSBpZiAoIWNoYXJzLmlzTmV3TGluZShjdXJyZW50Q2hhcikpIHtcbiAgICAgIHN0YXRlLmNvbHVtbisrO1xuICAgIH1cbiAgICBzdGF0ZS5vZmZzZXQrKztcbiAgICB0aGlzLnVwZGF0ZVBlZWsoc3RhdGUpO1xuICB9XG5cbiAgcHJvdGVjdGVkIHVwZGF0ZVBlZWsoc3RhdGU6IEN1cnNvclN0YXRlKTogdm9pZCB7XG4gICAgc3RhdGUucGVlayA9IHN0YXRlLm9mZnNldCA+PSB0aGlzLmVuZCA/IGNoYXJzLiRFT0YgOiB0aGlzLmNoYXJBdChzdGF0ZS5vZmZzZXQpO1xuICB9XG59XG5cbmNsYXNzIEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IgZXh0ZW5kcyBQbGFpbkNoYXJhY3RlckN1cnNvciB7XG4gIHByb3RlY3RlZCBpbnRlcm5hbFN0YXRlOiBDdXJzb3JTdGF0ZTtcblxuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IpO1xuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBhcnNlU291cmNlRmlsZSwgcmFuZ2U6IExleGVyUmFuZ2UpO1xuICBjb25zdHJ1Y3RvcihmaWxlT3JDdXJzb3I6IFBhcnNlU291cmNlRmlsZXxFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yLCByYW5nZT86IExleGVyUmFuZ2UpIHtcbiAgICBpZiAoZmlsZU9yQ3Vyc29yIGluc3RhbmNlb2YgRXNjYXBlZENoYXJhY3RlckN1cnNvcikge1xuICAgICAgc3VwZXIoZmlsZU9yQ3Vyc29yKTtcbiAgICAgIHRoaXMuaW50ZXJuYWxTdGF0ZSA9IHsuLi5maWxlT3JDdXJzb3IuaW50ZXJuYWxTdGF0ZX07XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1cGVyKGZpbGVPckN1cnNvciwgcmFuZ2UgISk7XG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB0aGlzLnN0YXRlO1xuICAgIH1cbiAgfVxuXG4gIGFkdmFuY2UoKTogdm9pZCB7XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMuaW50ZXJuYWxTdGF0ZTtcbiAgICBzdXBlci5hZHZhbmNlKCk7XG4gICAgdGhpcy5wcm9jZXNzRXNjYXBlU2VxdWVuY2UoKTtcbiAgfVxuXG4gIGluaXQoKTogdm9pZCB7XG4gICAgc3VwZXIuaW5pdCgpO1xuICAgIHRoaXMucHJvY2Vzc0VzY2FwZVNlcXVlbmNlKCk7XG4gIH1cblxuICBjbG9uZSgpOiBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yIHsgcmV0dXJuIG5ldyBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yKHRoaXMpOyB9XG5cbiAgZ2V0Q2hhcnMoc3RhcnQ6IHRoaXMpOiBzdHJpbmcge1xuICAgIGNvbnN0IGN1cnNvciA9IHN0YXJ0LmNsb25lKCk7XG4gICAgbGV0IGNoYXJzID0gJyc7XG4gICAgd2hpbGUgKGN1cnNvci5pbnRlcm5hbFN0YXRlLm9mZnNldCA8IHRoaXMuaW50ZXJuYWxTdGF0ZS5vZmZzZXQpIHtcbiAgICAgIGNoYXJzICs9IFN0cmluZy5mcm9tQ29kZVBvaW50KGN1cnNvci5wZWVrKCkpO1xuICAgICAgY3Vyc29yLmFkdmFuY2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIGNoYXJzO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdGhlIGVzY2FwZSBzZXF1ZW5jZSB0aGF0IHN0YXJ0cyBhdCB0aGUgY3VycmVudCBwb3NpdGlvbiBpbiB0aGUgdGV4dC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgaXMgY2FsbGVkIHRvIGVuc3VyZSB0aGF0IGBwZWVrYCBoYXMgdGhlIHVuZXNjYXBlZCB2YWx1ZSBvZiBlc2NhcGUgc2VxdWVuY2VzLlxuICAgKi9cbiAgcHJvdGVjdGVkIHByb2Nlc3NFc2NhcGVTZXF1ZW5jZSgpOiB2b2lkIHtcbiAgICBjb25zdCBwZWVrID0gKCkgPT4gdGhpcy5pbnRlcm5hbFN0YXRlLnBlZWs7XG5cbiAgICBpZiAocGVlaygpID09PSBjaGFycy4kQkFDS1NMQVNIKSB7XG4gICAgICAvLyBXZSBoYXZlIGhpdCBhbiBlc2NhcGUgc2VxdWVuY2Ugc28gd2UgbmVlZCB0aGUgaW50ZXJuYWwgc3RhdGUgdG8gYmVjb21lIGluZGVwZW5kZW50XG4gICAgICAvLyBvZiB0aGUgZXh0ZXJuYWwgc3RhdGUuXG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB7Li4udGhpcy5zdGF0ZX07XG5cbiAgICAgIC8vIE1vdmUgcGFzdCB0aGUgYmFja3NsYXNoXG4gICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuXG4gICAgICAvLyBGaXJzdCBjaGVjayBmb3Igc3RhbmRhcmQgY29udHJvbCBjaGFyIHNlcXVlbmNlc1xuICAgICAgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJG4pIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJExGO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiRyKSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRDUjtcbiAgICAgIH0gZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kdikge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kVlRBQjtcbiAgICAgIH0gZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kdCkge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kVEFCO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiRiKSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRCU1BBQ0U7XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJGYpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJEZGO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3cgY29uc2lkZXIgbW9yZSBjb21wbGV4IHNlcXVlbmNlc1xuICAgICAgZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kdSkge1xuICAgICAgICAvLyBVbmljb2RlIGNvZGUtcG9pbnQgc2VxdWVuY2VcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTsgIC8vIGFkdmFuY2UgcGFzdCB0aGUgYHVgIGNoYXJcbiAgICAgICAgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJExCUkFDRSkge1xuICAgICAgICAgIC8vIFZhcmlhYmxlIGxlbmd0aCBVbmljb2RlLCBlLmcuIGBcXHh7MTIzfWBcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpOyAgLy8gYWR2YW5jZSBwYXN0IHRoZSBge2AgY2hhclxuICAgICAgICAgIC8vIEFkdmFuY2UgcGFzdCB0aGUgdmFyaWFibGUgbnVtYmVyIG9mIGhleCBkaWdpdHMgdW50aWwgd2UgaGl0IGEgYH1gIGNoYXJcbiAgICAgICAgICBjb25zdCBkaWdpdFN0YXJ0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgIGxldCBsZW5ndGggPSAwO1xuICAgICAgICAgIHdoaWxlIChwZWVrKCkgIT09IGNoYXJzLiRSQlJBQ0UpIHtcbiAgICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgICBsZW5ndGgrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5kZWNvZGVIZXhEaWdpdHMoZGlnaXRTdGFydCwgbGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaXhlZCBsZW5ndGggVW5pY29kZSwgZS5nLiBgXFx1MTIzNGBcbiAgICAgICAgICBjb25zdCBkaWdpdFN0YXJ0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuICAgICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHRoaXMuZGVjb2RlSGV4RGlnaXRzKGRpZ2l0U3RhcnQsIDQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJHgpIHtcbiAgICAgICAgLy8gSGV4IGNoYXIgY29kZSwgZS5nLiBgXFx4MkZgXG4gICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7ICAvLyBhZHZhbmNlIHBhc3QgdGhlIGB4YCBjaGFyXG4gICAgICAgIGNvbnN0IGRpZ2l0U3RhcnQgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHRoaXMuZGVjb2RlSGV4RGlnaXRzKGRpZ2l0U3RhcnQsIDIpO1xuICAgICAgfVxuXG4gICAgICBlbHNlIGlmIChjaGFycy5pc09jdGFsRGlnaXQocGVlaygpKSkge1xuICAgICAgICAvLyBPY3RhbCBjaGFyIGNvZGUsIGUuZy4gYFxcMDEyYCxcbiAgICAgICAgbGV0IG9jdGFsID0gJyc7XG4gICAgICAgIGxldCBsZW5ndGggPSAwO1xuICAgICAgICBsZXQgcHJldmlvdXMgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgIHdoaWxlIChjaGFycy5pc09jdGFsRGlnaXQocGVlaygpKSAmJiBsZW5ndGggPCAzKSB7XG4gICAgICAgICAgcHJldmlvdXMgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgb2N0YWwgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQocGVlaygpKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuICAgICAgICAgIGxlbmd0aCsrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHBhcnNlSW50KG9jdGFsLCA4KTtcbiAgICAgICAgLy8gQmFja3VwIG9uZSBjaGFyXG4gICAgICAgIHRoaXMuaW50ZXJuYWxTdGF0ZSA9IHByZXZpb3VzLmludGVybmFsU3RhdGU7XG4gICAgICB9XG5cbiAgICAgIGVsc2UgaWYgKGNoYXJzLmlzTmV3TGluZSh0aGlzLmludGVybmFsU3RhdGUucGVlaykpIHtcbiAgICAgICAgLy8gTGluZSBjb250aW51YXRpb24gYFxcYCBmb2xsb3dlZCBieSBhIG5ldyBsaW5lXG4gICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7ICAvLyBhZHZhbmNlIG92ZXIgdGhlIG5ld2xpbmVcbiAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuaW50ZXJuYWxTdGF0ZTtcbiAgICAgIH1cblxuICAgICAgZWxzZSB7XG4gICAgICAgIC8vIElmIG5vbmUgb2YgdGhlIGBpZmAgYmxvY2tzIHdlcmUgZXhlY3V0ZWQgdGhlbiB3ZSBqdXN0IGhhdmUgYW4gZXNjYXBlZCBub3JtYWwgY2hhcmFjdGVyLlxuICAgICAgICAvLyBJbiB0aGF0IGNhc2Ugd2UganVzdCwgZWZmZWN0aXZlbHksIHNraXAgdGhlIGJhY2tzbGFzaCBmcm9tIHRoZSBjaGFyYWN0ZXIuXG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IHRoaXMuaW50ZXJuYWxTdGF0ZS5wZWVrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBkZWNvZGVIZXhEaWdpdHMoc3RhcnQ6IEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IsIGxlbmd0aDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBoZXggPSB0aGlzLmlucHV0LnN1YnN0cihzdGFydC5pbnRlcm5hbFN0YXRlLm9mZnNldCwgbGVuZ3RoKTtcbiAgICBjb25zdCBjaGFyQ29kZSA9IHBhcnNlSW50KGhleCwgMTYpO1xuICAgIGlmICghaXNOYU4oY2hhckNvZGUpKSB7XG4gICAgICByZXR1cm4gY2hhckNvZGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXJ0LnN0YXRlID0gc3RhcnQuaW50ZXJuYWxTdGF0ZTtcbiAgICAgIHRocm93IG5ldyBDdXJzb3JFcnJvcignSW52YWxpZCBoZXhhZGVjaW1hbCBlc2NhcGUgc2VxdWVuY2UnLCBzdGFydCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtc2c6IHN0cmluZywgcHVibGljIGN1cnNvcjogQ2hhcmFjdGVyQ3Vyc29yKSB7fVxufVxuIl19