/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
    exports.CursorError = exports.tokenize = exports.TokenizeResult = exports.TokenError = exports.Token = exports.TokenType = void 0;
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
        function TokenizeResult(tokens, errors, nonNormalizedIcuExpressions) {
            this.tokens = tokens;
            this.errors = errors;
            this.nonNormalizedIcuExpressions = nonNormalizedIcuExpressions;
        }
        return TokenizeResult;
    }());
    exports.TokenizeResult = TokenizeResult;
    function tokenize(source, url, getTagDefinition, options) {
        if (options === void 0) { options = {}; }
        var tokenizer = new _Tokenizer(new parse_util_1.ParseSourceFile(source, url), getTagDefinition, options);
        tokenizer.tokenize();
        return new TokenizeResult(mergeTextTokens(tokenizer.tokens), tokenizer.errors, tokenizer.nonNormalizedIcuExpressions);
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
    function _unparsableEntityErrorMsg(type, entityStr) {
        return "Unable to parse entity \"" + entityStr + "\" - " + type + " character reference entities must end with \";\"";
    }
    var CharacterReferenceType;
    (function (CharacterReferenceType) {
        CharacterReferenceType["HEX"] = "hexadecimal";
        CharacterReferenceType["DEC"] = "decimal";
    })(CharacterReferenceType || (CharacterReferenceType = {}));
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
            this.nonNormalizedIcuExpressions = [];
            this._tokenizeIcu = options.tokenizeExpansionForms || false;
            this._interpolationConfig = options.interpolationConfig || interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG;
            this._leadingTriviaCodePoints =
                options.leadingTriviaChars && options.leadingTriviaChars.map(function (c) { return c.codePointAt(0) || 0; });
            var range = options.range || { endPos: _file.content.length, startPos: 0, startLine: 0, startCol: 0 };
            this._cursor = options.escapedString ? new EscapedCharacterCursor(_file, range) :
                new PlainCharacterCursor(_file, range);
            this._preserveLineEndings = options.preserveLineEndings || false;
            this._escapedString = options.escapedString || false;
            this._i18nNormalizeLineEndingsInICUs = options.i18nNormalizeLineEndingsInICUs || false;
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
                    // Advance cursor to include the peeked character in the string provided to the error
                    // message.
                    this._cursor.advance();
                    var entityType = isHex ? CharacterReferenceType.HEX : CharacterReferenceType.DEC;
                    throw this._createError(_unparsableEntityErrorMsg(entityType, this._cursor.getChars(start)), this._cursor.getSpan());
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
            var normalizedCondition = this._processCarriageReturns(condition);
            if (this._i18nNormalizeLineEndingsInICUs) {
                // We explicitly want to normalize line endings for this text.
                this._endToken([normalizedCondition]);
            }
            else {
                // We are not normalizing line endings.
                var conditionToken = this._endToken([condition]);
                if (normalizedCondition !== condition) {
                    this.nonNormalizedIcuExpressions.push(conditionToken);
                }
            }
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
        PlainCharacterCursor.prototype.clone = function () {
            return new PlainCharacterCursor(this);
        };
        PlainCharacterCursor.prototype.peek = function () {
            return this.state.peek;
        };
        PlainCharacterCursor.prototype.charsLeft = function () {
            return this.end - this.state.offset;
        };
        PlainCharacterCursor.prototype.diff = function (other) {
            return this.state.offset - other.state.offset;
        };
        PlainCharacterCursor.prototype.advance = function () {
            this.advanceState(this.state);
        };
        PlainCharacterCursor.prototype.init = function () {
            this.updatePeek(this.state);
        };
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
            return new parse_util_1.ParseSourceSpan(new parse_util_1.ParseLocation(start.file, start.state.offset, start.state.line, start.state.column), new parse_util_1.ParseLocation(this.file, this.state.offset, this.state.line, this.state.column));
        };
        PlainCharacterCursor.prototype.getChars = function (start) {
            return this.input.substring(start.state.offset, this.state.offset);
        };
        PlainCharacterCursor.prototype.charAt = function (pos) {
            return this.input.charCodeAt(pos);
        };
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
        EscapedCharacterCursor.prototype.clone = function () {
            return new EscapedCharacterCursor(this);
        };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV4ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2xleGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCxtREFBa0M7SUFDbEMsK0RBQTBGO0lBRTFGLDZGQUF5RjtJQUN6Riw2REFBcUU7SUFFckUsSUFBWSxTQXNCWDtJQXRCRCxXQUFZLFNBQVM7UUFDbkIsNkRBQWMsQ0FBQTtRQUNkLHlEQUFZLENBQUE7UUFDWixtRUFBaUIsQ0FBQTtRQUNqQixtREFBUyxDQUFBO1FBQ1QseUNBQUksQ0FBQTtRQUNKLHFFQUFrQixDQUFBO1FBQ2xCLGlEQUFRLENBQUE7UUFDUiwyREFBYSxDQUFBO1FBQ2IsdURBQVcsQ0FBQTtRQUNYLHVEQUFXLENBQUE7UUFDWCxvREFBUyxDQUFBO1FBQ1Qsb0RBQVMsQ0FBQTtRQUNULHNEQUFVLENBQUE7UUFDVixzREFBVSxDQUFBO1FBQ1Ysa0RBQVEsQ0FBQTtRQUNSLDBFQUFvQixDQUFBO1FBQ3BCLDBFQUFvQixDQUFBO1FBQ3BCLGtGQUF3QixDQUFBO1FBQ3hCLDhFQUFzQixDQUFBO1FBQ3RCLHNFQUFrQixDQUFBO1FBQ2xCLHdDQUFHLENBQUE7SUFDTCxDQUFDLEVBdEJXLFNBQVMsR0FBVCxpQkFBUyxLQUFULGlCQUFTLFFBc0JwQjtJQUVEO1FBQ0UsZUFDVyxJQUFvQixFQUFTLEtBQWUsRUFBUyxVQUEyQjtZQUFoRixTQUFJLEdBQUosSUFBSSxDQUFnQjtZQUFTLFVBQUssR0FBTCxLQUFLLENBQVU7WUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQUFHLENBQUM7UUFDakcsWUFBQztJQUFELENBQUMsQUFIRCxJQUdDO0lBSFksc0JBQUs7SUFLbEI7UUFBZ0Msc0NBQVU7UUFDeEMsb0JBQVksUUFBZ0IsRUFBUyxTQUF5QixFQUFFLElBQXFCO1lBQXJGLFlBQ0Us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Rlksa0NBQVciLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi4vY2hhcnMnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUxvY2F0aW9uLCBQYXJzZVNvdXJjZUZpbGUsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge05BTUVEX0VOVElUSUVTLCBUYWdDb250ZW50VHlwZSwgVGFnRGVmaW5pdGlvbn0gZnJvbSAnLi90YWdzJztcblxuZXhwb3J0IGVudW0gVG9rZW5UeXBlIHtcbiAgVEFHX09QRU5fU1RBUlQsXG4gIFRBR19PUEVOX0VORCxcbiAgVEFHX09QRU5fRU5EX1ZPSUQsXG4gIFRBR19DTE9TRSxcbiAgVEVYVCxcbiAgRVNDQVBBQkxFX1JBV19URVhULFxuICBSQVdfVEVYVCxcbiAgQ09NTUVOVF9TVEFSVCxcbiAgQ09NTUVOVF9FTkQsXG4gIENEQVRBX1NUQVJULFxuICBDREFUQV9FTkQsXG4gIEFUVFJfTkFNRSxcbiAgQVRUUl9RVU9URSxcbiAgQVRUUl9WQUxVRSxcbiAgRE9DX1RZUEUsXG4gIEVYUEFOU0lPTl9GT1JNX1NUQVJULFxuICBFWFBBTlNJT05fQ0FTRV9WQUxVRSxcbiAgRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJULFxuICBFWFBBTlNJT05fQ0FTRV9FWFBfRU5ELFxuICBFWFBBTlNJT05fRk9STV9FTkQsXG4gIEVPRlxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0eXBlOiBUb2tlblR5cGV8bnVsbCwgcHVibGljIHBhcnRzOiBzdHJpbmdbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbn1cblxuZXhwb3J0IGNsYXNzIFRva2VuRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3IoZXJyb3JNc2c6IHN0cmluZywgcHVibGljIHRva2VuVHlwZTogVG9rZW5UeXBlfG51bGwsIHNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHN1cGVyKHNwYW4sIGVycm9yTXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW5pemVSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0b2tlbnM6IFRva2VuW10sIHB1YmxpYyBlcnJvcnM6IFRva2VuRXJyb3JbXSxcbiAgICAgIHB1YmxpYyBub25Ob3JtYWxpemVkSWN1RXhwcmVzc2lvbnM6IFRva2VuW10pIHt9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGV4ZXJSYW5nZSB7XG4gIHN0YXJ0UG9zOiBudW1iZXI7XG4gIHN0YXJ0TGluZTogbnVtYmVyO1xuICBzdGFydENvbDogbnVtYmVyO1xuICBlbmRQb3M6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBPcHRpb25zIHRoYXQgbW9kaWZ5IGhvdyB0aGUgdGV4dCBpcyB0b2tlbml6ZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVG9rZW5pemVPcHRpb25zIHtcbiAgLyoqIFdoZXRoZXIgdG8gdG9rZW5pemUgSUNVIG1lc3NhZ2VzIChjb25zaWRlcmVkIGFzIHRleHQgbm9kZXMgd2hlbiBmYWxzZSkuICovXG4gIHRva2VuaXplRXhwYW5zaW9uRm9ybXM/OiBib29sZWFuO1xuICAvKiogSG93IHRvIHRva2VuaXplIGludGVycG9sYXRpb24gbWFya2Vycy4gKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgYW5kIGVuZCBwb2ludCBvZiB0aGUgdGV4dCB0byBwYXJzZSB3aXRoaW4gdGhlIGBzb3VyY2VgIHN0cmluZy5cbiAgICogVGhlIGVudGlyZSBgc291cmNlYCBzdHJpbmcgaXMgcGFyc2VkIGlmIHRoaXMgaXMgbm90IHByb3ZpZGVkLlxuICAgKiAqL1xuICByYW5nZT86IExleGVyUmFuZ2U7XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGEgSmF2YVNjcmlwdCBzdHJpbmcsIHRoZW4gd2UgaGF2ZSB0byBkZWFsIHdpdGggZXNjYXBlIHNlcXVlbmNlcy5cbiAgICpcbiAgICogKipFeGFtcGxlIDE6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcImRlZlxcbmdoaVwiXG4gICAqIGBgYFxuICAgKlxuICAgKiAtIFRoZSBgXFxcImAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYFwiYC5cbiAgICogLSBUaGUgYFxcbmAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYSBuZXcgbGluZSBjaGFyYWN0ZXIgaW4gYSB0b2tlbixcbiAgICogICBidXQgaXQgc2hvdWxkIG5vdCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqXG4gICAqICoqRXhhbXBsZSAyOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXG4gICAqICBkZWZcIlxuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGxpbmUgY29udGludWF0aW9uIChgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3bGluZSkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBhIHRva2VuXG4gICAqIGJ1dCB0aGUgbmV3IGxpbmUgc2hvdWxkIGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICovXG4gIGVzY2FwZWRTdHJpbmc/OiBib29sZWFuO1xuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhbiBleHRlcm5hbCB0ZW1wbGF0ZSAoZS5nLiB2aWEgYHRlbXBsYXRlVXJsYCkgdGhlbiB3ZSBuZWVkIHRvIGRlY2lkZVxuICAgKiB3aGV0aGVyIG9yIG5vdCB0byBub3JtYWxpemUgdGhlIGxpbmUtZW5kaW5ncyAoZnJvbSBgXFxyXFxuYCB0byBgXFxuYCkgd2hlbiBwcm9jZXNzaW5nIElDVVxuICAgKiBleHByZXNzaW9ucy5cbiAgICpcbiAgICogSWYgYHRydWVgIHRoZW4gd2Ugd2lsbCBub3JtYWxpemUgSUNVIGV4cHJlc3Npb24gbGluZSBlbmRpbmdzLlxuICAgKiBUaGUgZGVmYXVsdCBpcyBgZmFsc2VgLCBidXQgdGhpcyB3aWxsIGJlIHN3aXRjaGVkIGluIGEgZnV0dXJlIG1ham9yIHJlbGVhc2UuXG4gICAqL1xuICBpMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXM/OiBib29sZWFuO1xuICAvKipcbiAgICogQW4gYXJyYXkgb2YgY2hhcmFjdGVycyB0aGF0IHNob3VsZCBiZSBjb25zaWRlcmVkIGFzIGxlYWRpbmcgdHJpdmlhLlxuICAgKiBMZWFkaW5nIHRyaXZpYSBhcmUgY2hhcmFjdGVycyB0aGF0IGFyZSBub3QgaW1wb3J0YW50IHRvIHRoZSBkZXZlbG9wZXIsIGFuZCBzbyBzaG91bGQgbm90IGJlXG4gICAqIGluY2x1ZGVkIGluIHNvdXJjZS1tYXAgc2VnbWVudHMuICBBIGNvbW1vbiBleGFtcGxlIGlzIHdoaXRlc3BhY2UuXG4gICAqL1xuICBsZWFkaW5nVHJpdmlhQ2hhcnM/OiBzdHJpbmdbXTtcbiAgLyoqXG4gICAqIElmIHRydWUsIGRvIG5vdCBjb252ZXJ0IENSTEYgdG8gTEYuXG4gICAqL1xuICBwcmVzZXJ2ZUxpbmVFbmRpbmdzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRva2VuaXplKFxuICAgIHNvdXJjZTogc3RyaW5nLCB1cmw6IHN0cmluZywgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbixcbiAgICBvcHRpb25zOiBUb2tlbml6ZU9wdGlvbnMgPSB7fSk6IFRva2VuaXplUmVzdWx0IHtcbiAgY29uc3QgdG9rZW5pemVyID0gbmV3IF9Ub2tlbml6ZXIobmV3IFBhcnNlU291cmNlRmlsZShzb3VyY2UsIHVybCksIGdldFRhZ0RlZmluaXRpb24sIG9wdGlvbnMpO1xuICB0b2tlbml6ZXIudG9rZW5pemUoKTtcbiAgcmV0dXJuIG5ldyBUb2tlbml6ZVJlc3VsdChcbiAgICAgIG1lcmdlVGV4dFRva2Vucyh0b2tlbml6ZXIudG9rZW5zKSwgdG9rZW5pemVyLmVycm9ycywgdG9rZW5pemVyLm5vbk5vcm1hbGl6ZWRJY3VFeHByZXNzaW9ucyk7XG59XG5cbmNvbnN0IF9DUl9PUl9DUkxGX1JFR0VYUCA9IC9cXHJcXG4/L2c7XG5cbmZ1bmN0aW9uIF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2coY2hhckNvZGU6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGNoYXIgPSBjaGFyQ29kZSA9PT0gY2hhcnMuJEVPRiA/ICdFT0YnIDogU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSk7XG4gIHJldHVybiBgVW5leHBlY3RlZCBjaGFyYWN0ZXIgXCIke2NoYXJ9XCJgO1xufVxuXG5mdW5jdGlvbiBfdW5rbm93bkVudGl0eUVycm9yTXNnKGVudGl0eVNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBVbmtub3duIGVudGl0eSBcIiR7ZW50aXR5U3JjfVwiIC0gdXNlIHRoZSBcIiYjPGRlY2ltYWw+O1wiIG9yICBcIiYjeDxoZXg+O1wiIHN5bnRheGA7XG59XG5cbmZ1bmN0aW9uIF91bnBhcnNhYmxlRW50aXR5RXJyb3JNc2codHlwZTogQ2hhcmFjdGVyUmVmZXJlbmNlVHlwZSwgZW50aXR5U3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFVuYWJsZSB0byBwYXJzZSBlbnRpdHkgXCIke2VudGl0eVN0cn1cIiAtICR7XG4gICAgICB0eXBlfSBjaGFyYWN0ZXIgcmVmZXJlbmNlIGVudGl0aWVzIG11c3QgZW5kIHdpdGggXCI7XCJgO1xufVxuXG5lbnVtIENoYXJhY3RlclJlZmVyZW5jZVR5cGUge1xuICBIRVggPSAnaGV4YWRlY2ltYWwnLFxuICBERUMgPSAnZGVjaW1hbCcsXG59XG5cbmNsYXNzIF9Db250cm9sRmxvd0Vycm9yIHtcbiAgY29uc3RydWN0b3IocHVibGljIGVycm9yOiBUb2tlbkVycm9yKSB7fVxufVxuXG4vLyBTZWUgaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUxL3N5bnRheC5odG1sI3dyaXRpbmdcbmNsYXNzIF9Ub2tlbml6ZXIge1xuICBwcml2YXRlIF9jdXJzb3I6IENoYXJhY3RlckN1cnNvcjtcbiAgcHJpdmF0ZSBfdG9rZW5pemVJY3U6IGJvb2xlYW47XG4gIHByaXZhdGUgX2ludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWc7XG4gIHByaXZhdGUgX2xlYWRpbmdUcml2aWFDb2RlUG9pbnRzOiBudW1iZXJbXXx1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2N1cnJlbnRUb2tlblN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3J8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2N1cnJlbnRUb2tlblR5cGU6IFRva2VuVHlwZXxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfZXhwYW5zaW9uQ2FzZVN0YWNrOiBUb2tlblR5cGVbXSA9IFtdO1xuICBwcml2YXRlIF9pbkludGVycG9sYXRpb246IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSByZWFkb25seSBfcHJlc2VydmVMaW5lRW5kaW5nczogYm9vbGVhbjtcbiAgcHJpdmF0ZSByZWFkb25seSBfZXNjYXBlZFN0cmluZzogYm9vbGVhbjtcbiAgcHJpdmF0ZSByZWFkb25seSBfaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzOiBib29sZWFuO1xuICB0b2tlbnM6IFRva2VuW10gPSBbXTtcbiAgZXJyb3JzOiBUb2tlbkVycm9yW10gPSBbXTtcbiAgbm9uTm9ybWFsaXplZEljdUV4cHJlc3Npb25zOiBUb2tlbltdID0gW107XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBfZmlsZSBUaGUgaHRtbCBzb3VyY2UgZmlsZSBiZWluZyB0b2tlbml6ZWQuXG4gICAqIEBwYXJhbSBfZ2V0VGFnRGVmaW5pdGlvbiBBIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXRyaWV2ZSBhIHRhZyBkZWZpbml0aW9uIGZvciBhIGdpdmVuIHRhZyBuYW1lLlxuICAgKiBAcGFyYW0gb3B0aW9ucyBDb25maWd1cmF0aW9uIG9mIHRoZSB0b2tlbml6YXRpb24uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIF9maWxlOiBQYXJzZVNvdXJjZUZpbGUsIHByaXZhdGUgX2dldFRhZ0RlZmluaXRpb246ICh0YWdOYW1lOiBzdHJpbmcpID0+IFRhZ0RlZmluaXRpb24sXG4gICAgICBvcHRpb25zOiBUb2tlbml6ZU9wdGlvbnMpIHtcbiAgICB0aGlzLl90b2tlbml6ZUljdSA9IG9wdGlvbnMudG9rZW5pemVFeHBhbnNpb25Gb3JtcyB8fCBmYWxzZTtcbiAgICB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnID0gb3B0aW9ucy5pbnRlcnBvbGF0aW9uQ29uZmlnIHx8IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgdGhpcy5fbGVhZGluZ1RyaXZpYUNvZGVQb2ludHMgPVxuICAgICAgICBvcHRpb25zLmxlYWRpbmdUcml2aWFDaGFycyAmJiBvcHRpb25zLmxlYWRpbmdUcml2aWFDaGFycy5tYXAoYyA9PiBjLmNvZGVQb2ludEF0KDApIHx8IDApO1xuICAgIGNvbnN0IHJhbmdlID1cbiAgICAgICAgb3B0aW9ucy5yYW5nZSB8fCB7ZW5kUG9zOiBfZmlsZS5jb250ZW50Lmxlbmd0aCwgc3RhcnRQb3M6IDAsIHN0YXJ0TGluZTogMCwgc3RhcnRDb2w6IDB9O1xuICAgIHRoaXMuX2N1cnNvciA9IG9wdGlvbnMuZXNjYXBlZFN0cmluZyA/IG5ldyBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yKF9maWxlLCByYW5nZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBQbGFpbkNoYXJhY3RlckN1cnNvcihfZmlsZSwgcmFuZ2UpO1xuICAgIHRoaXMuX3ByZXNlcnZlTGluZUVuZGluZ3MgPSBvcHRpb25zLnByZXNlcnZlTGluZUVuZGluZ3MgfHwgZmFsc2U7XG4gICAgdGhpcy5fZXNjYXBlZFN0cmluZyA9IG9wdGlvbnMuZXNjYXBlZFN0cmluZyB8fCBmYWxzZTtcbiAgICB0aGlzLl9pMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXMgPSBvcHRpb25zLmkxOG5Ob3JtYWxpemVMaW5lRW5kaW5nc0luSUNVcyB8fCBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5fY3Vyc29yLmluaXQoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmhhbmRsZUVycm9yKGUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3Byb2Nlc3NDYXJyaWFnZVJldHVybnMoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5fcHJlc2VydmVMaW5lRW5kaW5ncykge1xuICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgfVxuICAgIC8vIGh0dHA6Ly93d3cudzMub3JnL1RSL2h0bWw1L3N5bnRheC5odG1sI3ByZXByb2Nlc3NpbmctdGhlLWlucHV0LXN0cmVhbVxuICAgIC8vIEluIG9yZGVyIHRvIGtlZXAgdGhlIG9yaWdpbmFsIHBvc2l0aW9uIGluIHRoZSBzb3VyY2UsIHdlIGNhbiBub3RcbiAgICAvLyBwcmUtcHJvY2VzcyBpdC5cbiAgICAvLyBJbnN0ZWFkIENScyBhcmUgcHJvY2Vzc2VkIHJpZ2h0IGJlZm9yZSBpbnN0YW50aWF0aW5nIHRoZSB0b2tlbnMuXG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZShfQ1JfT1JfQ1JMRl9SRUdFWFAsICdcXG4nKTtcbiAgfVxuXG4gIHRva2VuaXplKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFycy4kRU9GKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kTFQpKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kQkFORykpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lQ2RhdGEoc3RhcnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJE1JTlVTKSkge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lQ29tbWVudChzdGFydCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lRG9jVHlwZShzdGFydCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJFNMQVNIKSkge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZVRhZ0Nsb3NlKHN0YXJ0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZVRhZ09wZW4oc3RhcnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghKHRoaXMuX3Rva2VuaXplSWN1ICYmIHRoaXMuX3Rva2VuaXplRXhwYW5zaW9uRm9ybSgpKSkge1xuICAgICAgICAgIHRoaXMuX2NvbnN1bWVUZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhpcy5oYW5kbGVFcnJvcihlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRU9GKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICAvKipcbiAgICogQHJldHVybnMgd2hldGhlciBhbiBJQ1UgdG9rZW4gaGFzIGJlZW4gY3JlYXRlZFxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHByaXZhdGUgX3Rva2VuaXplRXhwYW5zaW9uRm9ybSgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5pc0V4cGFuc2lvbkZvcm1TdGFydCgpKSB7XG4gICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uRm9ybVN0YXJ0KCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNFeHBhbnNpb25DYXNlU3RhcnQodGhpcy5fY3Vyc29yLnBlZWsoKSkgJiYgdGhpcy5faXNJbkV4cGFuc2lvbkZvcm0oKSkge1xuICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbkNhc2VTdGFydCgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRSQlJBQ0UpIHtcbiAgICAgIGlmICh0aGlzLl9pc0luRXhwYW5zaW9uQ2FzZSgpKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVFeHBhbnNpb25DYXNlRW5kKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5faXNJbkV4cGFuc2lvbkZvcm0oKSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uRm9ybUVuZCgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9iZWdpblRva2VuKHR5cGU6IFRva2VuVHlwZSwgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKSkge1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0ID0gc3RhcnQ7XG4gICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSA9IHR5cGU7XG4gIH1cblxuICBwcml2YXRlIF9lbmRUb2tlbihwYXJ0czogc3RyaW5nW10sIGVuZD86IENoYXJhY3RlckN1cnNvcik6IFRva2VuIHtcbiAgICBpZiAodGhpcy5fY3VycmVudFRva2VuU3RhcnQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBUb2tlbkVycm9yKFxuICAgICAgICAgICdQcm9ncmFtbWluZyBlcnJvciAtIGF0dGVtcHRlZCB0byBlbmQgYSB0b2tlbiB3aGVuIHRoZXJlIHdhcyBubyBzdGFydCB0byB0aGUgdG9rZW4nLFxuICAgICAgICAgIHRoaXMuX2N1cnJlbnRUb2tlblR5cGUsIHRoaXMuX2N1cnNvci5nZXRTcGFuKGVuZCkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fY3VycmVudFRva2VuVHlwZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAgICAgJ1Byb2dyYW1taW5nIGVycm9yIC0gYXR0ZW1wdGVkIHRvIGVuZCBhIHRva2VuIHdoaWNoIGhhcyBubyB0b2tlbiB0eXBlJywgbnVsbCxcbiAgICAgICAgICB0aGlzLl9jdXJzb3IuZ2V0U3Bhbih0aGlzLl9jdXJyZW50VG9rZW5TdGFydCkpO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbiA9IG5ldyBUb2tlbihcbiAgICAgICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSwgcGFydHMsXG4gICAgICAgIHRoaXMuX2N1cnNvci5nZXRTcGFuKHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0LCB0aGlzLl9sZWFkaW5nVHJpdmlhQ29kZVBvaW50cykpO1xuICAgIHRoaXMudG9rZW5zLnB1c2godG9rZW4pO1xuICAgIHRoaXMuX2N1cnJlbnRUb2tlblN0YXJ0ID0gbnVsbDtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5UeXBlID0gbnVsbDtcbiAgICByZXR1cm4gdG9rZW47XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVFcnJvcihtc2c6IHN0cmluZywgc3BhbjogUGFyc2VTb3VyY2VTcGFuKTogX0NvbnRyb2xGbG93RXJyb3Ige1xuICAgIGlmICh0aGlzLl9pc0luRXhwYW5zaW9uRm9ybSgpKSB7XG4gICAgICBtc2cgKz0gYCAoRG8geW91IGhhdmUgYW4gdW5lc2NhcGVkIFwie1wiIGluIHlvdXIgdGVtcGxhdGU/IFVzZSBcInt7ICd7JyB9fVwiKSB0byBlc2NhcGUgaXQuKWA7XG4gICAgfVxuICAgIGNvbnN0IGVycm9yID0gbmV3IFRva2VuRXJyb3IobXNnLCB0aGlzLl9jdXJyZW50VG9rZW5UeXBlLCBzcGFuKTtcbiAgICB0aGlzLl9jdXJyZW50VG9rZW5TdGFydCA9IG51bGw7XG4gICAgdGhpcy5fY3VycmVudFRva2VuVHlwZSA9IG51bGw7XG4gICAgcmV0dXJuIG5ldyBfQ29udHJvbEZsb3dFcnJvcihlcnJvcik7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZUVycm9yKGU6IGFueSkge1xuICAgIGlmIChlIGluc3RhbmNlb2YgQ3Vyc29yRXJyb3IpIHtcbiAgICAgIGUgPSB0aGlzLl9jcmVhdGVFcnJvcihlLm1zZywgdGhpcy5fY3Vyc29yLmdldFNwYW4oZS5jdXJzb3IpKTtcbiAgICB9XG4gICAgaWYgKGUgaW5zdGFuY2VvZiBfQ29udHJvbEZsb3dFcnJvcikge1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChlLmVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0Q2hhckNvZGUoY2hhckNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFyQ29kZSkge1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0Q2hhckNvZGVDYXNlSW5zZW5zaXRpdmUoY2hhckNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmIChjb21wYXJlQ2hhckNvZGVDYXNlSW5zZW5zaXRpdmUodGhpcy5fY3Vyc29yLnBlZWsoKSwgY2hhckNvZGUpKSB7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcXVpcmVDaGFyQ29kZShjaGFyQ29kZTogbnVtYmVyKSB7XG4gICAgY29uc3QgbG9jYXRpb24gPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICBpZiAoIXRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFyQ29kZSkpIHtcbiAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKFxuICAgICAgICAgIF91bmV4cGVjdGVkQ2hhcmFjdGVyRXJyb3JNc2codGhpcy5fY3Vyc29yLnBlZWsoKSksIHRoaXMuX2N1cnNvci5nZXRTcGFuKGxvY2F0aW9uKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXR0ZW1wdFN0cihjaGFyczogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbGVuID0gY2hhcnMubGVuZ3RoO1xuICAgIGlmICh0aGlzLl9jdXJzb3IuY2hhcnNMZWZ0KCkgPCBsZW4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgaW5pdGlhbFBvc2l0aW9uID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKCF0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuY2hhckNvZGVBdChpKSkpIHtcbiAgICAgICAgLy8gSWYgYXR0ZW1wdGluZyB0byBwYXJzZSB0aGUgc3RyaW5nIGZhaWxzLCB3ZSB3YW50IHRvIHJlc2V0IHRoZSBwYXJzZXJcbiAgICAgICAgLy8gdG8gd2hlcmUgaXQgd2FzIGJlZm9yZSB0aGUgYXR0ZW1wdFxuICAgICAgICB0aGlzLl9jdXJzb3IgPSBpbml0aWFsUG9zaXRpb247XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0U3RyQ2FzZUluc2Vuc2l0aXZlKGNoYXJzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMuX2F0dGVtcHRDaGFyQ29kZUNhc2VJbnNlbnNpdGl2ZShjaGFycy5jaGFyQ29kZUF0KGkpKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVxdWlyZVN0cihjaGFyczogc3RyaW5nKSB7XG4gICAgY29uc3QgbG9jYXRpb24gPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICBpZiAoIXRoaXMuX2F0dGVtcHRTdHIoY2hhcnMpKSB7XG4gICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgICAgICBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKHRoaXMuX2N1cnNvci5wZWVrKCkpLCB0aGlzLl9jdXJzb3IuZ2V0U3Bhbihsb2NhdGlvbikpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4ocHJlZGljYXRlOiAoY29kZTogbnVtYmVyKSA9PiBib29sZWFuKSB7XG4gICAgd2hpbGUgKCFwcmVkaWNhdGUodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVxdWlyZUNoYXJDb2RlVW50aWxGbihwcmVkaWNhdGU6IChjb2RlOiBudW1iZXIpID0+IGJvb2xlYW4sIGxlbjogbnVtYmVyKSB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKHByZWRpY2F0ZSk7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5kaWZmKHN0YXJ0KSA8IGxlbikge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyh0aGlzLl9jdXJzb3IucGVlaygpKSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oc3RhcnQpKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hdHRlbXB0VW50aWxDaGFyKGNoYXI6IG51bWJlcikge1xuICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBjaGFyKSB7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3JlYWRDaGFyKGRlY29kZUVudGl0aWVzOiBib29sZWFuKTogc3RyaW5nIHtcbiAgICBpZiAoZGVjb2RlRW50aXRpZXMgJiYgdGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJEFNUEVSU0FORCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2RlY29kZUVudGl0eSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEb24ndCByZWx5IHVwb24gcmVhZGluZyBkaXJlY3RseSBmcm9tIGBfaW5wdXRgIGFzIHRoZSBhY3R1YWwgY2hhciB2YWx1ZVxuICAgICAgLy8gbWF5IGhhdmUgYmVlbiBnZW5lcmF0ZWQgZnJvbSBhbiBlc2NhcGUgc2VxdWVuY2UuXG4gICAgICBjb25zdCBjaGFyID0gU3RyaW5nLmZyb21Db2RlUG9pbnQodGhpcy5fY3Vyc29yLnBlZWsoKSk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIGNoYXI7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZGVjb2RlRW50aXR5KCk6IHN0cmluZyB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJEhBU0gpKSB7XG4gICAgICBjb25zdCBpc0hleCA9IHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4keCkgfHwgdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRYKTtcbiAgICAgIGNvbnN0IGNvZGVTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc0RpZ2l0RW50aXR5RW5kKTtcbiAgICAgIGlmICh0aGlzLl9jdXJzb3IucGVlaygpICE9IGNoYXJzLiRTRU1JQ09MT04pIHtcbiAgICAgICAgLy8gQWR2YW5jZSBjdXJzb3IgdG8gaW5jbHVkZSB0aGUgcGVla2VkIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nIHByb3ZpZGVkIHRvIHRoZSBlcnJvclxuICAgICAgICAvLyBtZXNzYWdlLlxuICAgICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgICBjb25zdCBlbnRpdHlUeXBlID0gaXNIZXggPyBDaGFyYWN0ZXJSZWZlcmVuY2VUeXBlLkhFWCA6IENoYXJhY3RlclJlZmVyZW5jZVR5cGUuREVDO1xuICAgICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgICAgICAgIF91bnBhcnNhYmxlRW50aXR5RXJyb3JNc2coZW50aXR5VHlwZSwgdGhpcy5fY3Vyc29yLmdldENoYXJzKHN0YXJ0KSksXG4gICAgICAgICAgICB0aGlzLl9jdXJzb3IuZ2V0U3BhbigpKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0ck51bSA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhjb2RlU3RhcnQpO1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNoYXJDb2RlID0gcGFyc2VJbnQoc3RyTnVtLCBpc0hleCA/IDE2IDogMTApO1xuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgICBfdW5rbm93bkVudGl0eUVycm9yTXNnKHRoaXMuX2N1cnNvci5nZXRDaGFycyhzdGFydCkpLCB0aGlzLl9jdXJzb3IuZ2V0U3BhbigpKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTmFtZWRFbnRpdHlFbmQpO1xuICAgICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT0gY2hhcnMuJFNFTUlDT0xPTikge1xuICAgICAgICB0aGlzLl9jdXJzb3IgPSBuYW1lU3RhcnQ7XG4gICAgICAgIHJldHVybiAnJic7XG4gICAgICB9XG4gICAgICBjb25zdCBuYW1lID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKG5hbWVTdGFydCk7XG4gICAgICB0aGlzLl9jdXJzb3IuYWR2YW5jZSgpO1xuICAgICAgY29uc3QgY2hhciA9IE5BTUVEX0VOVElUSUVTW25hbWVdO1xuICAgICAgaWYgKCFjaGFyKSB7XG4gICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUVycm9yKF91bmtub3duRW50aXR5RXJyb3JNc2cobmFtZSksIHRoaXMuX2N1cnNvci5nZXRTcGFuKHN0YXJ0KSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hhcjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lUmF3VGV4dChkZWNvZGVFbnRpdGllczogYm9vbGVhbiwgZW5kTWFya2VyUHJlZGljYXRlOiAoKSA9PiBib29sZWFuKTogVG9rZW4ge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oZGVjb2RlRW50aXRpZXMgPyBUb2tlblR5cGUuRVNDQVBBQkxFX1JBV19URVhUIDogVG9rZW5UeXBlLlJBV19URVhUKTtcbiAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgdGFnQ2xvc2VTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgICAgY29uc3QgZm91bmRFbmRNYXJrZXIgPSBlbmRNYXJrZXJQcmVkaWNhdGUoKTtcbiAgICAgIHRoaXMuX2N1cnNvciA9IHRhZ0Nsb3NlU3RhcnQ7XG4gICAgICBpZiAoZm91bmRFbmRNYXJrZXIpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBwYXJ0cy5wdXNoKHRoaXMuX3JlYWRDaGFyKGRlY29kZUVudGl0aWVzKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9lbmRUb2tlbihbdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhwYXJ0cy5qb2luKCcnKSldKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVDb21tZW50KHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5DT01NRU5UX1NUQVJULCBzdGFydCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRNSU5VUyk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0KGZhbHNlLCAoKSA9PiB0aGlzLl9hdHRlbXB0U3RyKCctLT4nKSk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ09NTUVOVF9FTkQpO1xuICAgIHRoaXMuX3JlcXVpcmVTdHIoJy0tPicpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVDZGF0YShzdGFydDogQ2hhcmFjdGVyQ3Vyc29yKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQ0RBVEFfU1RBUlQsIHN0YXJ0KTtcbiAgICB0aGlzLl9yZXF1aXJlU3RyKCdDREFUQVsnKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gICAgdGhpcy5fY29uc3VtZVJhd1RleHQoZmFsc2UsICgpID0+IHRoaXMuX2F0dGVtcHRTdHIoJ11dPicpKTtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5DREFUQV9FTkQpO1xuICAgIHRoaXMuX3JlcXVpcmVTdHIoJ11dPicpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVEb2NUeXBlKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5ET0NfVFlQRSwgc3RhcnQpO1xuICAgIGNvbnN0IGNvbnRlbnRTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRoaXMuX2F0dGVtcHRVbnRpbENoYXIoY2hhcnMuJEdUKTtcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKGNvbnRlbnRTdGFydCk7XG4gICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbY29udGVudF0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVByZWZpeEFuZE5hbWUoKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IG5hbWVPclByZWZpeFN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgbGV0IHByZWZpeDogc3RyaW5nID0gJyc7XG4gICAgd2hpbGUgKHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRDT0xPTiAmJiAhaXNQcmVmaXhFbmQodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgfVxuICAgIGxldCBuYW1lU3RhcnQ6IENoYXJhY3RlckN1cnNvcjtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJENPTE9OKSB7XG4gICAgICBwcmVmaXggPSB0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMobmFtZU9yUHJlZml4U3RhcnQpO1xuICAgICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTtcbiAgICAgIG5hbWVTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lU3RhcnQgPSBuYW1lT3JQcmVmaXhTdGFydDtcbiAgICB9XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlVW50aWxGbihpc05hbWVFbmQsIHByZWZpeCA9PT0gJycgPyAwIDogMSk7XG4gICAgY29uc3QgbmFtZSA9IHRoaXMuX2N1cnNvci5nZXRDaGFycyhuYW1lU3RhcnQpO1xuICAgIHJldHVybiBbcHJlZml4LCBuYW1lXTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUYWdPcGVuKHN0YXJ0OiBDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICBsZXQgdGFnTmFtZTogc3RyaW5nO1xuICAgIGxldCBwcmVmaXg6IHN0cmluZztcbiAgICBsZXQgb3BlblRhZ1Rva2VuOiBUb2tlbnx1bmRlZmluZWQ7XG4gICAgbGV0IHRva2Vuc0JlZm9yZVRhZ09wZW4gPSB0aGlzLnRva2Vucy5sZW5ndGg7XG4gICAgY29uc3QgaW5uZXJTdGFydCA9IHRoaXMuX2N1cnNvci5jbG9uZSgpO1xuICAgIHRyeSB7XG4gICAgICBpZiAoIWNoYXJzLmlzQXNjaWlMZXR0ZXIodGhpcy5fY3Vyc29yLnBlZWsoKSkpIHtcbiAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgICAgICBfdW5leHBlY3RlZENoYXJhY3RlckVycm9yTXNnKHRoaXMuX2N1cnNvci5wZWVrKCkpLCB0aGlzLl9jdXJzb3IuZ2V0U3BhbihzdGFydCkpO1xuICAgICAgfVxuXG4gICAgICBvcGVuVGFnVG9rZW4gPSB0aGlzLl9jb25zdW1lVGFnT3BlblN0YXJ0KHN0YXJ0KTtcbiAgICAgIHByZWZpeCA9IG9wZW5UYWdUb2tlbi5wYXJ0c1swXTtcbiAgICAgIHRhZ05hbWUgPSBvcGVuVGFnVG9rZW4ucGFydHNbMV07XG4gICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICB3aGlsZSAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJFNMQVNIICYmIHRoaXMuX2N1cnNvci5wZWVrKCkgIT09IGNoYXJzLiRHVCkge1xuICAgICAgICB0aGlzLl9jb25zdW1lQXR0cmlidXRlTmFtZSgpO1xuICAgICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICAgIGlmICh0aGlzLl9hdHRlbXB0Q2hhckNvZGUoY2hhcnMuJEVRKSkge1xuICAgICAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgICAgICB0aGlzLl9jb25zdW1lQXR0cmlidXRlVmFsdWUoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jb25zdW1lVGFnT3BlbkVuZCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgX0NvbnRyb2xGbG93RXJyb3IpIHtcbiAgICAgICAgLy8gV2hlbiB0aGUgc3RhcnQgdGFnIGlzIGludmFsaWQgKGluY2x1ZGluZyBpbnZhbGlkIFwiYXR0cmlidXRlc1wiKSwgYXNzdW1lIHdlIHdhbnQgYSBcIjxcIlxuICAgICAgICB0aGlzLl9jdXJzb3IgPSBpbm5lclN0YXJ0O1xuICAgICAgICBpZiAob3BlblRhZ1Rva2VuKSB7XG4gICAgICAgICAgdGhpcy50b2tlbnMubGVuZ3RoID0gdG9rZW5zQmVmb3JlVGFnT3BlbjtcbiAgICAgICAgfVxuICAgICAgICAvLyBCYWNrIHRvIGJhY2sgdGV4dCB0b2tlbnMgYXJlIG1lcmdlZCBhdCB0aGUgZW5kXG4gICAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRFWFQsIHN0YXJ0KTtcbiAgICAgICAgdGhpcy5fZW5kVG9rZW4oWyc8J10pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudFRva2VuVHlwZSA9IHRoaXMuX2dldFRhZ0RlZmluaXRpb24odGFnTmFtZSkuY29udGVudFR5cGU7XG5cbiAgICBpZiAoY29udGVudFRva2VuVHlwZSA9PT0gVGFnQ29udGVudFR5cGUuUkFXX1RFWFQpIHtcbiAgICAgIHRoaXMuX2NvbnN1bWVSYXdUZXh0V2l0aFRhZ0Nsb3NlKHByZWZpeCwgdGFnTmFtZSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY29udGVudFRva2VuVHlwZSA9PT0gVGFnQ29udGVudFR5cGUuRVNDQVBBQkxFX1JBV19URVhUKSB7XG4gICAgICB0aGlzLl9jb25zdW1lUmF3VGV4dFdpdGhUYWdDbG9zZShwcmVmaXgsIHRhZ05hbWUsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVSYXdUZXh0V2l0aFRhZ0Nsb3NlKHByZWZpeDogc3RyaW5nLCB0YWdOYW1lOiBzdHJpbmcsIGRlY29kZUVudGl0aWVzOiBib29sZWFuKSB7XG4gICAgY29uc3QgdGV4dFRva2VuID0gdGhpcy5fY29uc3VtZVJhd1RleHQoZGVjb2RlRW50aXRpZXMsICgpID0+IHtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRMVCkpIHJldHVybiBmYWxzZTtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRTTEFTSCkpIHJldHVybiBmYWxzZTtcbiAgICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICAgIGlmICghdGhpcy5fYXR0ZW1wdFN0ckNhc2VJbnNlbnNpdGl2ZSh0YWdOYW1lKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuICAgICAgcmV0dXJuIHRoaXMuX2F0dGVtcHRDaGFyQ29kZShjaGFycy4kR1QpO1xuICAgIH0pO1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRBR19DTE9TRSk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlVW50aWxGbihjb2RlID0+IGNvZGUgPT09IGNoYXJzLiRHVCwgMyk7XG4gICAgdGhpcy5fY3Vyc29yLmFkdmFuY2UoKTsgIC8vIENvbnN1bWUgdGhlIGA+YFxuICAgIHRoaXMuX2VuZFRva2VuKFtwcmVmaXgsIHRhZ05hbWVdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUYWdPcGVuU3RhcnQoc3RhcnQ6IENoYXJhY3RlckN1cnNvcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRBR19PUEVOX1NUQVJULCBzdGFydCk7XG4gICAgY29uc3QgcGFydHMgPSB0aGlzLl9jb25zdW1lUHJlZml4QW5kTmFtZSgpO1xuICAgIHJldHVybiB0aGlzLl9lbmRUb2tlbihwYXJ0cyk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQXR0cmlidXRlTmFtZSgpIHtcbiAgICBjb25zdCBhdHRyTmFtZVN0YXJ0ID0gdGhpcy5fY3Vyc29yLnBlZWsoKTtcbiAgICBpZiAoYXR0ck5hbWVTdGFydCA9PT0gY2hhcnMuJFNRIHx8IGF0dHJOYW1lU3RhcnQgPT09IGNoYXJzLiREUSkge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoX3VuZXhwZWN0ZWRDaGFyYWN0ZXJFcnJvck1zZyhhdHRyTmFtZVN0YXJ0KSwgdGhpcy5fY3Vyc29yLmdldFNwYW4oKSk7XG4gICAgfVxuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkFUVFJfTkFNRSk7XG4gICAgY29uc3QgcHJlZml4QW5kTmFtZSA9IHRoaXMuX2NvbnN1bWVQcmVmaXhBbmROYW1lKCk7XG4gICAgdGhpcy5fZW5kVG9rZW4ocHJlZml4QW5kTmFtZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQXR0cmlidXRlVmFsdWUoKSB7XG4gICAgbGV0IHZhbHVlOiBzdHJpbmc7XG4gICAgaWYgKHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRTUSB8fCB0aGlzLl9jdXJzb3IucGVlaygpID09PSBjaGFycy4kRFEpIHtcbiAgICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkFUVFJfUVVPVEUpO1xuICAgICAgY29uc3QgcXVvdGVDaGFyID0gdGhpcy5fY3Vyc29yLnBlZWsoKTtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICB0aGlzLl9lbmRUb2tlbihbU3RyaW5nLmZyb21Db2RlUG9pbnQocXVvdGVDaGFyKV0pO1xuICAgICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuQVRUUl9WQUxVRSk7XG4gICAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgICAgIHdoaWxlICh0aGlzLl9jdXJzb3IucGVlaygpICE9PSBxdW90ZUNoYXIpIHtcbiAgICAgICAgcGFydHMucHVzaCh0aGlzLl9yZWFkQ2hhcih0cnVlKSk7XG4gICAgICB9XG4gICAgICB2YWx1ZSA9IHBhcnRzLmpvaW4oJycpO1xuICAgICAgdGhpcy5fZW5kVG9rZW4oW3RoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnModmFsdWUpXSk7XG4gICAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5BVFRSX1FVT1RFKTtcbiAgICAgIHRoaXMuX2N1cnNvci5hZHZhbmNlKCk7XG4gICAgICB0aGlzLl9lbmRUb2tlbihbU3RyaW5nLmZyb21Db2RlUG9pbnQocXVvdGVDaGFyKV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5BVFRSX1ZBTFVFKTtcbiAgICAgIGNvbnN0IHZhbHVlU3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZVVudGlsRm4oaXNOYW1lRW5kLCAxKTtcbiAgICAgIHZhbHVlID0gdGhpcy5fY3Vyc29yLmdldENoYXJzKHZhbHVlU3RhcnQpO1xuICAgICAgdGhpcy5fZW5kVG9rZW4oW3RoaXMuX3Byb2Nlc3NDYXJyaWFnZVJldHVybnModmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZVRhZ09wZW5FbmQoKSB7XG4gICAgY29uc3QgdG9rZW5UeXBlID1cbiAgICAgICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlKGNoYXJzLiRTTEFTSCkgPyBUb2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSUQgOiBUb2tlblR5cGUuVEFHX09QRU5fRU5EO1xuICAgIHRoaXMuX2JlZ2luVG9rZW4odG9rZW5UeXBlKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJEdUKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGFnQ2xvc2Uoc3RhcnQ6IENoYXJhY3RlckN1cnNvcikge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlRBR19DTE9TRSwgc3RhcnQpO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgICBjb25zdCBwcmVmaXhBbmROYW1lID0gdGhpcy5fY29uc3VtZVByZWZpeEFuZE5hbWUoKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRHVCk7XG4gICAgdGhpcy5fZW5kVG9rZW4ocHJlZml4QW5kTmFtZSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uRm9ybVN0YXJ0KCkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJExCUkFDRSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuXG4gICAgdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLnB1c2goVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUKTtcblxuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLlJBV19URVhUKTtcbiAgICBjb25zdCBjb25kaXRpb24gPSB0aGlzLl9yZWFkVW50aWwoY2hhcnMuJENPTU1BKTtcbiAgICBjb25zdCBub3JtYWxpemVkQ29uZGl0aW9uID0gdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhjb25kaXRpb24pO1xuICAgIGlmICh0aGlzLl9pMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXMpIHtcbiAgICAgIC8vIFdlIGV4cGxpY2l0bHkgd2FudCB0byBub3JtYWxpemUgbGluZSBlbmRpbmdzIGZvciB0aGlzIHRleHQuXG4gICAgICB0aGlzLl9lbmRUb2tlbihbbm9ybWFsaXplZENvbmRpdGlvbl0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSBhcmUgbm90IG5vcm1hbGl6aW5nIGxpbmUgZW5kaW5ncy5cbiAgICAgIGNvbnN0IGNvbmRpdGlvblRva2VuID0gdGhpcy5fZW5kVG9rZW4oW2NvbmRpdGlvbl0pO1xuICAgICAgaWYgKG5vcm1hbGl6ZWRDb25kaXRpb24gIT09IGNvbmRpdGlvbikge1xuICAgICAgICB0aGlzLm5vbk5vcm1hbGl6ZWRJY3VFeHByZXNzaW9ucy5wdXNoKGNvbmRpdGlvblRva2VuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRDT01NQSk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuXG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuUkFXX1RFWFQpO1xuICAgIGNvbnN0IHR5cGUgPSB0aGlzLl9yZWFkVW50aWwoY2hhcnMuJENPTU1BKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbdHlwZV0pO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kQ09NTUEpO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVFeHBhbnNpb25DYXNlU3RhcnQoKSB7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfVkFMVUUpO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5fcmVhZFVudGlsKGNoYXJzLiRMQlJBQ0UpLnRyaW0oKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbdmFsdWVdKTtcbiAgICB0aGlzLl9hdHRlbXB0Q2hhckNvZGVVbnRpbEZuKGlzTm90V2hpdGVzcGFjZSk7XG5cbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpO1xuICAgIHRoaXMuX3JlcXVpcmVDaGFyQ29kZShjaGFycy4kTEJSQUNFKTtcbiAgICB0aGlzLl9lbmRUb2tlbihbXSk7XG4gICAgdGhpcy5fYXR0ZW1wdENoYXJDb2RlVW50aWxGbihpc05vdFdoaXRlc3BhY2UpO1xuXG4gICAgdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLnB1c2goVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uQ2FzZUVuZCgpIHtcbiAgICB0aGlzLl9iZWdpblRva2VuKFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfRU5EKTtcbiAgICB0aGlzLl9yZXF1aXJlQ2hhckNvZGUoY2hhcnMuJFJCUkFDRSk7XG4gICAgdGhpcy5fZW5kVG9rZW4oW10pO1xuICAgIHRoaXMuX2F0dGVtcHRDaGFyQ29kZVVudGlsRm4oaXNOb3RXaGl0ZXNwYWNlKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wb3AoKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVFeHBhbnNpb25Gb3JtRW5kKCkge1xuICAgIHRoaXMuX2JlZ2luVG9rZW4oVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX0VORCk7XG4gICAgdGhpcy5fcmVxdWlyZUNoYXJDb2RlKGNoYXJzLiRSQlJBQ0UpO1xuICAgIHRoaXMuX2VuZFRva2VuKFtdKTtcblxuICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5wb3AoKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUZXh0KCkge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fY3Vyc29yLmNsb25lKCk7XG4gICAgdGhpcy5fYmVnaW5Ub2tlbihUb2tlblR5cGUuVEVYVCwgc3RhcnQpO1xuICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgZG8ge1xuICAgICAgaWYgKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcgJiYgdGhpcy5fYXR0ZW1wdFN0cih0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0KSkge1xuICAgICAgICBwYXJ0cy5wdXNoKHRoaXMuX2ludGVycG9sYXRpb25Db25maWcuc3RhcnQpO1xuICAgICAgICB0aGlzLl9pbkludGVycG9sYXRpb24gPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0aGlzLl9pbnRlcnBvbGF0aW9uQ29uZmlnICYmIHRoaXMuX2luSW50ZXJwb2xhdGlvbiAmJlxuICAgICAgICAgIHRoaXMuX2F0dGVtcHRTdHIodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQpKSB7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQpO1xuICAgICAgICB0aGlzLl9pbkludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcnRzLnB1c2godGhpcy5fcmVhZENoYXIodHJ1ZSkpO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKCF0aGlzLl9pc1RleHRFbmQoKSk7XG5cbiAgICB0aGlzLl9lbmRUb2tlbihbdGhpcy5fcHJvY2Vzc0NhcnJpYWdlUmV0dXJucyhwYXJ0cy5qb2luKCcnKSldKTtcbiAgfVxuXG4gIHByaXZhdGUgX2lzVGV4dEVuZCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJExUIHx8IHRoaXMuX2N1cnNvci5wZWVrKCkgPT09IGNoYXJzLiRFT0YpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl90b2tlbml6ZUljdSAmJiAhdGhpcy5faW5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICBpZiAodGhpcy5pc0V4cGFuc2lvbkZvcm1TdGFydCgpKSB7XG4gICAgICAgIC8vIHN0YXJ0IG9mIGFuIGV4cGFuc2lvbiBmb3JtXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSA9PT0gY2hhcnMuJFJCUkFDRSAmJiB0aGlzLl9pc0luRXhwYW5zaW9uQ2FzZSgpKSB7XG4gICAgICAgIC8vIGVuZCBvZiBhbmQgZXhwYW5zaW9uIGNhc2VcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVhZFVudGlsKGNoYXI6IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICB0aGlzLl9hdHRlbXB0VW50aWxDaGFyKGNoYXIpO1xuICAgIHJldHVybiB0aGlzLl9jdXJzb3IuZ2V0Q2hhcnMoc3RhcnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfaXNJbkV4cGFuc2lvbkNhc2UoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5sZW5ndGggPiAwICYmXG4gICAgICAgIHRoaXMuX2V4cGFuc2lvbkNhc2VTdGFja1t0aGlzLl9leHBhbnNpb25DYXNlU3RhY2subGVuZ3RoIC0gMV0gPT09XG4gICAgICAgIFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQ7XG4gIH1cblxuICBwcml2YXRlIF9pc0luRXhwYW5zaW9uRm9ybSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgdGhpcy5fZXhwYW5zaW9uQ2FzZVN0YWNrW3RoaXMuX2V4cGFuc2lvbkNhc2VTdGFjay5sZW5ndGggLSAxXSA9PT1cbiAgICAgICAgVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0V4cGFuc2lvbkZvcm1TdGFydCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5fY3Vyc29yLnBlZWsoKSAhPT0gY2hhcnMuJExCUkFDRSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZykge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9jdXJzb3IuY2xvbmUoKTtcbiAgICAgIGNvbnN0IGlzSW50ZXJwb2xhdGlvbiA9IHRoaXMuX2F0dGVtcHRTdHIodGhpcy5faW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydCk7XG4gICAgICB0aGlzLl9jdXJzb3IgPSBzdGFydDtcbiAgICAgIHJldHVybiAhaXNJbnRlcnBvbGF0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc05vdFdoaXRlc3BhY2UoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAhY2hhcnMuaXNXaGl0ZXNwYWNlKGNvZGUpIHx8IGNvZGUgPT09IGNoYXJzLiRFT0Y7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZUVuZChjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNoYXJzLmlzV2hpdGVzcGFjZShjb2RlKSB8fCBjb2RlID09PSBjaGFycy4kR1QgfHwgY29kZSA9PT0gY2hhcnMuJFNMQVNIIHx8XG4gICAgICBjb2RlID09PSBjaGFycy4kU1EgfHwgY29kZSA9PT0gY2hhcnMuJERRIHx8IGNvZGUgPT09IGNoYXJzLiRFUTtcbn1cblxuZnVuY3Rpb24gaXNQcmVmaXhFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAoY29kZSA8IGNoYXJzLiRhIHx8IGNoYXJzLiR6IDwgY29kZSkgJiYgKGNvZGUgPCBjaGFycy4kQSB8fCBjaGFycy4kWiA8IGNvZGUpICYmXG4gICAgICAoY29kZSA8IGNoYXJzLiQwIHx8IGNvZGUgPiBjaGFycy4kOSk7XG59XG5cbmZ1bmN0aW9uIGlzRGlnaXRFbnRpdHlFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID09IGNoYXJzLiRTRU1JQ09MT04gfHwgY29kZSA9PSBjaGFycy4kRU9GIHx8ICFjaGFycy5pc0FzY2lpSGV4RGlnaXQoY29kZSk7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZWRFbnRpdHlFbmQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID09IGNoYXJzLiRTRU1JQ09MT04gfHwgY29kZSA9PSBjaGFycy4kRU9GIHx8ICFjaGFycy5pc0FzY2lpTGV0dGVyKGNvZGUpO1xufVxuXG5mdW5jdGlvbiBpc0V4cGFuc2lvbkNhc2VTdGFydChwZWVrOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIHBlZWsgIT09IGNoYXJzLiRSQlJBQ0U7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVDaGFyQ29kZUNhc2VJbnNlbnNpdGl2ZShjb2RlMTogbnVtYmVyLCBjb2RlMjogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiB0b1VwcGVyQ2FzZUNoYXJDb2RlKGNvZGUxKSA9PSB0b1VwcGVyQ2FzZUNoYXJDb2RlKGNvZGUyKTtcbn1cblxuZnVuY3Rpb24gdG9VcHBlckNhc2VDaGFyQ29kZShjb2RlOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gY29kZSA+PSBjaGFycy4kYSAmJiBjb2RlIDw9IGNoYXJzLiR6ID8gY29kZSAtIGNoYXJzLiRhICsgY2hhcnMuJEEgOiBjb2RlO1xufVxuXG5mdW5jdGlvbiBtZXJnZVRleHRUb2tlbnMoc3JjVG9rZW5zOiBUb2tlbltdKTogVG9rZW5bXSB7XG4gIGNvbnN0IGRzdFRva2VuczogVG9rZW5bXSA9IFtdO1xuICBsZXQgbGFzdERzdFRva2VuOiBUb2tlbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3JjVG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgdG9rZW4gPSBzcmNUb2tlbnNbaV07XG4gICAgaWYgKGxhc3REc3RUb2tlbiAmJiBsYXN0RHN0VG9rZW4udHlwZSA9PSBUb2tlblR5cGUuVEVYVCAmJiB0b2tlbi50eXBlID09IFRva2VuVHlwZS5URVhUKSB7XG4gICAgICBsYXN0RHN0VG9rZW4ucGFydHNbMF0hICs9IHRva2VuLnBhcnRzWzBdO1xuICAgICAgbGFzdERzdFRva2VuLnNvdXJjZVNwYW4uZW5kID0gdG9rZW4uc291cmNlU3Bhbi5lbmQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxhc3REc3RUb2tlbiA9IHRva2VuO1xuICAgICAgZHN0VG9rZW5zLnB1c2gobGFzdERzdFRva2VuKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZHN0VG9rZW5zO1xufVxuXG5cbi8qKlxuICogVGhlIF9Ub2tlbml6ZXIgdXNlcyBvYmplY3RzIG9mIHRoaXMgdHlwZSB0byBtb3ZlIHRocm91Z2ggdGhlIGlucHV0IHRleHQsXG4gKiBleHRyYWN0aW5nIFwicGFyc2VkIGNoYXJhY3RlcnNcIi4gVGhlc2UgY291bGQgYmUgbW9yZSB0aGFuIG9uZSBhY3R1YWwgY2hhcmFjdGVyXG4gKiBpZiB0aGUgdGV4dCBjb250YWlucyBlc2NhcGUgc2VxdWVuY2VzLlxuICovXG5pbnRlcmZhY2UgQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgLyoqIEluaXRpYWxpemUgdGhlIGN1cnNvci4gKi9cbiAgaW5pdCgpOiB2b2lkO1xuICAvKiogVGhlIHBhcnNlZCBjaGFyYWN0ZXIgYXQgdGhlIGN1cnJlbnQgY3Vyc29yIHBvc2l0aW9uLiAqL1xuICBwZWVrKCk6IG51bWJlcjtcbiAgLyoqIEFkdmFuY2UgdGhlIGN1cnNvciBieSBvbmUgcGFyc2VkIGNoYXJhY3Rlci4gKi9cbiAgYWR2YW5jZSgpOiB2b2lkO1xuICAvKiogR2V0IGEgc3BhbiBmcm9tIHRoZSBtYXJrZWQgc3RhcnQgcG9pbnQgdG8gdGhlIGN1cnJlbnQgcG9pbnQuICovXG4gIGdldFNwYW4oc3RhcnQ/OiB0aGlzLCBsZWFkaW5nVHJpdmlhQ29kZVBvaW50cz86IG51bWJlcltdKTogUGFyc2VTb3VyY2VTcGFuO1xuICAvKiogR2V0IHRoZSBwYXJzZWQgY2hhcmFjdGVycyBmcm9tIHRoZSBtYXJrZWQgc3RhcnQgcG9pbnQgdG8gdGhlIGN1cnJlbnQgcG9pbnQuICovXG4gIGdldENoYXJzKHN0YXJ0OiB0aGlzKTogc3RyaW5nO1xuICAvKiogVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGxlZnQgYmVmb3JlIHRoZSBlbmQgb2YgdGhlIGN1cnNvci4gKi9cbiAgY2hhcnNMZWZ0KCk6IG51bWJlcjtcbiAgLyoqIFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBiZXR3ZWVuIGB0aGlzYCBjdXJzb3IgYW5kIGBvdGhlcmAgY3Vyc29yLiAqL1xuICBkaWZmKG90aGVyOiB0aGlzKTogbnVtYmVyO1xuICAvKiogTWFrZSBhIGNvcHkgb2YgdGhpcyBjdXJzb3IgKi9cbiAgY2xvbmUoKTogQ2hhcmFjdGVyQ3Vyc29yO1xufVxuXG5pbnRlcmZhY2UgQ3Vyc29yU3RhdGUge1xuICBwZWVrOiBudW1iZXI7XG4gIG9mZnNldDogbnVtYmVyO1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbHVtbjogbnVtYmVyO1xufVxuXG5jbGFzcyBQbGFpbkNoYXJhY3RlckN1cnNvciBpbXBsZW1lbnRzIENoYXJhY3RlckN1cnNvciB7XG4gIHByb3RlY3RlZCBzdGF0ZTogQ3Vyc29yU3RhdGU7XG4gIHByb3RlY3RlZCBmaWxlOiBQYXJzZVNvdXJjZUZpbGU7XG4gIHByb3RlY3RlZCBpbnB1dDogc3RyaW5nO1xuICBwcm90ZWN0ZWQgZW5kOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQbGFpbkNoYXJhY3RlckN1cnNvcik7XG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogUGFyc2VTb3VyY2VGaWxlLCByYW5nZTogTGV4ZXJSYW5nZSk7XG4gIGNvbnN0cnVjdG9yKGZpbGVPckN1cnNvcjogUGFyc2VTb3VyY2VGaWxlfFBsYWluQ2hhcmFjdGVyQ3Vyc29yLCByYW5nZT86IExleGVyUmFuZ2UpIHtcbiAgICBpZiAoZmlsZU9yQ3Vyc29yIGluc3RhbmNlb2YgUGxhaW5DaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICAgIHRoaXMuZmlsZSA9IGZpbGVPckN1cnNvci5maWxlO1xuICAgICAgdGhpcy5pbnB1dCA9IGZpbGVPckN1cnNvci5pbnB1dDtcbiAgICAgIHRoaXMuZW5kID0gZmlsZU9yQ3Vyc29yLmVuZDtcblxuICAgICAgY29uc3Qgc3RhdGUgPSBmaWxlT3JDdXJzb3Iuc3RhdGU7XG4gICAgICAvLyBOb3RlOiBhdm9pZCB1c2luZyBgey4uLmZpbGVPckN1cnNvci5zdGF0ZX1gIGhlcmUgYXMgdGhhdCBoYXMgYSBzZXZlcmUgcGVyZm9ybWFuY2UgcGVuYWx0eS5cbiAgICAgIC8vIEluIEVTNSBidW5kbGVzIHRoZSBvYmplY3Qgc3ByZWFkIG9wZXJhdG9yIGlzIHRyYW5zbGF0ZWQgaW50byB0aGUgYF9fYXNzaWduYCBoZWxwZXIsIHdoaWNoXG4gICAgICAvLyBpcyBub3Qgb3B0aW1pemVkIGJ5IFZNcyBhcyBlZmZpY2llbnRseSBhcyBhIHJhdyBvYmplY3QgbGl0ZXJhbC4gU2luY2UgdGhpcyBjb25zdHJ1Y3RvciBpc1xuICAgICAgLy8gY2FsbGVkIGluIHRpZ2h0IGxvb3BzLCB0aGlzIGRpZmZlcmVuY2UgbWF0dGVycy5cbiAgICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgIHBlZWs6IHN0YXRlLnBlZWssXG4gICAgICAgIG9mZnNldDogc3RhdGUub2Zmc2V0LFxuICAgICAgICBsaW5lOiBzdGF0ZS5saW5lLFxuICAgICAgICBjb2x1bW46IHN0YXRlLmNvbHVtbixcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghcmFuZ2UpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ1Byb2dyYW1taW5nIGVycm9yOiB0aGUgcmFuZ2UgYXJndW1lbnQgbXVzdCBiZSBwcm92aWRlZCB3aXRoIGEgZmlsZSBhcmd1bWVudC4nKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZmlsZSA9IGZpbGVPckN1cnNvcjtcbiAgICAgIHRoaXMuaW5wdXQgPSBmaWxlT3JDdXJzb3IuY29udGVudDtcbiAgICAgIHRoaXMuZW5kID0gcmFuZ2UuZW5kUG9zO1xuICAgICAgdGhpcy5zdGF0ZSA9IHtcbiAgICAgICAgcGVlazogLTEsXG4gICAgICAgIG9mZnNldDogcmFuZ2Uuc3RhcnRQb3MsXG4gICAgICAgIGxpbmU6IHJhbmdlLnN0YXJ0TGluZSxcbiAgICAgICAgY29sdW1uOiByYW5nZS5zdGFydENvbCxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgY2xvbmUoKTogUGxhaW5DaGFyYWN0ZXJDdXJzb3Ige1xuICAgIHJldHVybiBuZXcgUGxhaW5DaGFyYWN0ZXJDdXJzb3IodGhpcyk7XG4gIH1cblxuICBwZWVrKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnBlZWs7XG4gIH1cbiAgY2hhcnNMZWZ0KCkge1xuICAgIHJldHVybiB0aGlzLmVuZCAtIHRoaXMuc3RhdGUub2Zmc2V0O1xuICB9XG4gIGRpZmYob3RoZXI6IHRoaXMpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5vZmZzZXQgLSBvdGhlci5zdGF0ZS5vZmZzZXQ7XG4gIH1cblxuICBhZHZhbmNlKCk6IHZvaWQge1xuICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuc3RhdGUpO1xuICB9XG5cbiAgaW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLnVwZGF0ZVBlZWsodGhpcy5zdGF0ZSk7XG4gIH1cblxuICBnZXRTcGFuKHN0YXJ0PzogdGhpcywgbGVhZGluZ1RyaXZpYUNvZGVQb2ludHM/OiBudW1iZXJbXSk6IFBhcnNlU291cmNlU3BhbiB7XG4gICAgc3RhcnQgPSBzdGFydCB8fCB0aGlzO1xuICAgIGxldCBjbG9uZWQgPSBmYWxzZTtcbiAgICBpZiAobGVhZGluZ1RyaXZpYUNvZGVQb2ludHMpIHtcbiAgICAgIHdoaWxlICh0aGlzLmRpZmYoc3RhcnQpID4gMCAmJiBsZWFkaW5nVHJpdmlhQ29kZVBvaW50cy5pbmRleE9mKHN0YXJ0LnBlZWsoKSkgIT09IC0xKSB7XG4gICAgICAgIGlmICghY2xvbmVkKSB7XG4gICAgICAgICAgc3RhcnQgPSBzdGFydC5jbG9uZSgpIGFzIHRoaXM7XG4gICAgICAgICAgY2xvbmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBzdGFydC5hZHZhbmNlKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICBuZXcgUGFyc2VMb2NhdGlvbihzdGFydC5maWxlLCBzdGFydC5zdGF0ZS5vZmZzZXQsIHN0YXJ0LnN0YXRlLmxpbmUsIHN0YXJ0LnN0YXRlLmNvbHVtbiksXG4gICAgICAgIG5ldyBQYXJzZUxvY2F0aW9uKHRoaXMuZmlsZSwgdGhpcy5zdGF0ZS5vZmZzZXQsIHRoaXMuc3RhdGUubGluZSwgdGhpcy5zdGF0ZS5jb2x1bW4pKTtcbiAgfVxuXG4gIGdldENoYXJzKHN0YXJ0OiB0aGlzKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQuc3RhdGUub2Zmc2V0LCB0aGlzLnN0YXRlLm9mZnNldCk7XG4gIH1cblxuICBjaGFyQXQocG9zOiBudW1iZXIpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmlucHV0LmNoYXJDb2RlQXQocG9zKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhZHZhbmNlU3RhdGUoc3RhdGU6IEN1cnNvclN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLm9mZnNldCA+PSB0aGlzLmVuZCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuICAgICAgdGhyb3cgbmV3IEN1cnNvckVycm9yKCdVbmV4cGVjdGVkIGNoYXJhY3RlciBcIkVPRlwiJywgdGhpcyk7XG4gICAgfVxuICAgIGNvbnN0IGN1cnJlbnRDaGFyID0gdGhpcy5jaGFyQXQoc3RhdGUub2Zmc2V0KTtcbiAgICBpZiAoY3VycmVudENoYXIgPT09IGNoYXJzLiRMRikge1xuICAgICAgc3RhdGUubGluZSsrO1xuICAgICAgc3RhdGUuY29sdW1uID0gMDtcbiAgICB9IGVsc2UgaWYgKCFjaGFycy5pc05ld0xpbmUoY3VycmVudENoYXIpKSB7XG4gICAgICBzdGF0ZS5jb2x1bW4rKztcbiAgICB9XG4gICAgc3RhdGUub2Zmc2V0Kys7XG4gICAgdGhpcy51cGRhdGVQZWVrKHN0YXRlKTtcbiAgfVxuXG4gIHByb3RlY3RlZCB1cGRhdGVQZWVrKHN0YXRlOiBDdXJzb3JTdGF0ZSk6IHZvaWQge1xuICAgIHN0YXRlLnBlZWsgPSBzdGF0ZS5vZmZzZXQgPj0gdGhpcy5lbmQgPyBjaGFycy4kRU9GIDogdGhpcy5jaGFyQXQoc3RhdGUub2Zmc2V0KTtcbiAgfVxufVxuXG5jbGFzcyBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yIGV4dGVuZHMgUGxhaW5DaGFyYWN0ZXJDdXJzb3Ige1xuICBwcm90ZWN0ZWQgaW50ZXJuYWxTdGF0ZTogQ3Vyc29yU3RhdGU7XG5cbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yKTtcbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQYXJzZVNvdXJjZUZpbGUsIHJhbmdlOiBMZXhlclJhbmdlKTtcbiAgY29uc3RydWN0b3IoZmlsZU9yQ3Vyc29yOiBQYXJzZVNvdXJjZUZpbGV8RXNjYXBlZENoYXJhY3RlckN1cnNvciwgcmFuZ2U/OiBMZXhlclJhbmdlKSB7XG4gICAgaWYgKGZpbGVPckN1cnNvciBpbnN0YW5jZW9mIEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IpIHtcbiAgICAgIHN1cGVyKGZpbGVPckN1cnNvcik7XG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB7Li4uZmlsZU9yQ3Vyc29yLmludGVybmFsU3RhdGV9O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlcihmaWxlT3JDdXJzb3IsIHJhbmdlISk7XG4gICAgICB0aGlzLmludGVybmFsU3RhdGUgPSB0aGlzLnN0YXRlO1xuICAgIH1cbiAgfVxuXG4gIGFkdmFuY2UoKTogdm9pZCB7XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMuaW50ZXJuYWxTdGF0ZTtcbiAgICBzdXBlci5hZHZhbmNlKCk7XG4gICAgdGhpcy5wcm9jZXNzRXNjYXBlU2VxdWVuY2UoKTtcbiAgfVxuXG4gIGluaXQoKTogdm9pZCB7XG4gICAgc3VwZXIuaW5pdCgpO1xuICAgIHRoaXMucHJvY2Vzc0VzY2FwZVNlcXVlbmNlKCk7XG4gIH1cblxuICBjbG9uZSgpOiBFc2NhcGVkQ2hhcmFjdGVyQ3Vyc29yIHtcbiAgICByZXR1cm4gbmV3IEVzY2FwZWRDaGFyYWN0ZXJDdXJzb3IodGhpcyk7XG4gIH1cblxuICBnZXRDaGFycyhzdGFydDogdGhpcyk6IHN0cmluZyB7XG4gICAgY29uc3QgY3Vyc29yID0gc3RhcnQuY2xvbmUoKTtcbiAgICBsZXQgY2hhcnMgPSAnJztcbiAgICB3aGlsZSAoY3Vyc29yLmludGVybmFsU3RhdGUub2Zmc2V0IDwgdGhpcy5pbnRlcm5hbFN0YXRlLm9mZnNldCkge1xuICAgICAgY2hhcnMgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3Vyc29yLnBlZWsoKSk7XG4gICAgICBjdXJzb3IuYWR2YW5jZSgpO1xuICAgIH1cbiAgICByZXR1cm4gY2hhcnM7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgZXNjYXBlIHNlcXVlbmNlIHRoYXQgc3RhcnRzIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uIGluIHRoZSB0ZXh0LlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgdG8gZW5zdXJlIHRoYXQgYHBlZWtgIGhhcyB0aGUgdW5lc2NhcGVkIHZhbHVlIG9mIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgcHJvY2Vzc0VzY2FwZVNlcXVlbmNlKCk6IHZvaWQge1xuICAgIGNvbnN0IHBlZWsgPSAoKSA9PiB0aGlzLmludGVybmFsU3RhdGUucGVlaztcblxuICAgIGlmIChwZWVrKCkgPT09IGNoYXJzLiRCQUNLU0xBU0gpIHtcbiAgICAgIC8vIFdlIGhhdmUgaGl0IGFuIGVzY2FwZSBzZXF1ZW5jZSBzbyB3ZSBuZWVkIHRoZSBpbnRlcm5hbCBzdGF0ZSB0byBiZWNvbWUgaW5kZXBlbmRlbnRcbiAgICAgIC8vIG9mIHRoZSBleHRlcm5hbCBzdGF0ZS5cbiAgICAgIHRoaXMuaW50ZXJuYWxTdGF0ZSA9IHsuLi50aGlzLnN0YXRlfTtcblxuICAgICAgLy8gTW92ZSBwYXN0IHRoZSBiYWNrc2xhc2hcbiAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG5cbiAgICAgIC8vIEZpcnN0IGNoZWNrIGZvciBzdGFuZGFyZCBjb250cm9sIGNoYXIgc2VxdWVuY2VzXG4gICAgICBpZiAocGVlaygpID09PSBjaGFycy4kbikge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kTEY7XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJHIpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJENSO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR2KSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRWVEFCO1xuICAgICAgfSBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR0KSB7XG4gICAgICAgIHRoaXMuc3RhdGUucGVlayA9IGNoYXJzLiRUQUI7XG4gICAgICB9IGVsc2UgaWYgKHBlZWsoKSA9PT0gY2hhcnMuJGIpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gY2hhcnMuJEJTUEFDRTtcbiAgICAgIH0gZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4kZikge1xuICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSBjaGFycy4kRkY7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdyBjb25zaWRlciBtb3JlIGNvbXBsZXggc2VxdWVuY2VzXG4gICAgICBlbHNlIGlmIChwZWVrKCkgPT09IGNoYXJzLiR1KSB7XG4gICAgICAgIC8vIFVuaWNvZGUgY29kZS1wb2ludCBzZXF1ZW5jZVxuICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpOyAgLy8gYWR2YW5jZSBwYXN0IHRoZSBgdWAgY2hhclxuICAgICAgICBpZiAocGVlaygpID09PSBjaGFycy4kTEJSQUNFKSB7XG4gICAgICAgICAgLy8gVmFyaWFibGUgbGVuZ3RoIFVuaWNvZGUsIGUuZy4gYFxceHsxMjN9YFxuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7ICAvLyBhZHZhbmNlIHBhc3QgdGhlIGB7YCBjaGFyXG4gICAgICAgICAgLy8gQWR2YW5jZSBwYXN0IHRoZSB2YXJpYWJsZSBudW1iZXIgb2YgaGV4IGRpZ2l0cyB1bnRpbCB3ZSBoaXQgYSBgfWAgY2hhclxuICAgICAgICAgIGNvbnN0IGRpZ2l0U3RhcnQgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgbGV0IGxlbmd0aCA9IDA7XG4gICAgICAgICAgd2hpbGUgKHBlZWsoKSAhPT0gY2hhcnMuJFJCUkFDRSkge1xuICAgICAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgICAgIGxlbmd0aCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLnN0YXRlLnBlZWsgPSB0aGlzLmRlY29kZUhleERpZ2l0cyhkaWdpdFN0YXJ0LCBsZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpeGVkIGxlbmd0aCBVbmljb2RlLCBlLmcuIGBcXHUxMjM0YFxuICAgICAgICAgIGNvbnN0IGRpZ2l0U3RhcnQgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2VTdGF0ZSh0aGlzLmludGVybmFsU3RhdGUpO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5kZWNvZGVIZXhEaWdpdHMoZGlnaXRTdGFydCwgNCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWxzZSBpZiAocGVlaygpID09PSBjaGFycy4keCkge1xuICAgICAgICAvLyBIZXggY2hhciBjb2RlLCBlLmcuIGBcXHgyRmBcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTsgIC8vIGFkdmFuY2UgcGFzdCB0aGUgYHhgIGNoYXJcbiAgICAgICAgY29uc3QgZGlnaXRTdGFydCA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTtcbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5kZWNvZGVIZXhEaWdpdHMoZGlnaXRTdGFydCwgMik7XG4gICAgICB9XG5cbiAgICAgIGVsc2UgaWYgKGNoYXJzLmlzT2N0YWxEaWdpdChwZWVrKCkpKSB7XG4gICAgICAgIC8vIE9jdGFsIGNoYXIgY29kZSwgZS5nLiBgXFwwMTJgLFxuICAgICAgICBsZXQgb2N0YWwgPSAnJztcbiAgICAgICAgbGV0IGxlbmd0aCA9IDA7XG4gICAgICAgIGxldCBwcmV2aW91cyA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgd2hpbGUgKGNoYXJzLmlzT2N0YWxEaWdpdChwZWVrKCkpICYmIGxlbmd0aCA8IDMpIHtcbiAgICAgICAgICBwcmV2aW91cyA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICBvY3RhbCArPSBTdHJpbmcuZnJvbUNvZGVQb2ludChwZWVrKCkpO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZVN0YXRlKHRoaXMuaW50ZXJuYWxTdGF0ZSk7XG4gICAgICAgICAgbGVuZ3RoKys7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gcGFyc2VJbnQob2N0YWwsIDgpO1xuICAgICAgICAvLyBCYWNrdXAgb25lIGNoYXJcbiAgICAgICAgdGhpcy5pbnRlcm5hbFN0YXRlID0gcHJldmlvdXMuaW50ZXJuYWxTdGF0ZTtcbiAgICAgIH1cblxuICAgICAgZWxzZSBpZiAoY2hhcnMuaXNOZXdMaW5lKHRoaXMuaW50ZXJuYWxTdGF0ZS5wZWVrKSkge1xuICAgICAgICAvLyBMaW5lIGNvbnRpbnVhdGlvbiBgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3IGxpbmVcbiAgICAgICAgdGhpcy5hZHZhbmNlU3RhdGUodGhpcy5pbnRlcm5hbFN0YXRlKTsgIC8vIGFkdmFuY2Ugb3ZlciB0aGUgbmV3bGluZVxuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5pbnRlcm5hbFN0YXRlO1xuICAgICAgfVxuXG4gICAgICBlbHNlIHtcbiAgICAgICAgLy8gSWYgbm9uZSBvZiB0aGUgYGlmYCBibG9ja3Mgd2VyZSBleGVjdXRlZCB0aGVuIHdlIGp1c3QgaGF2ZSBhbiBlc2NhcGVkIG5vcm1hbCBjaGFyYWN0ZXIuXG4gICAgICAgIC8vIEluIHRoYXQgY2FzZSB3ZSBqdXN0LCBlZmZlY3RpdmVseSwgc2tpcCB0aGUgYmFja3NsYXNoIGZyb20gdGhlIGNoYXJhY3Rlci5cbiAgICAgICAgdGhpcy5zdGF0ZS5wZWVrID0gdGhpcy5pbnRlcm5hbFN0YXRlLnBlZWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGRlY29kZUhleERpZ2l0cyhzdGFydDogRXNjYXBlZENoYXJhY3RlckN1cnNvciwgbGVuZ3RoOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IGhleCA9IHRoaXMuaW5wdXQuc3Vic3RyKHN0YXJ0LmludGVybmFsU3RhdGUub2Zmc2V0LCBsZW5ndGgpO1xuICAgIGNvbnN0IGNoYXJDb2RlID0gcGFyc2VJbnQoaGV4LCAxNik7XG4gICAgaWYgKCFpc05hTihjaGFyQ29kZSkpIHtcbiAgICAgIHJldHVybiBjaGFyQ29kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhcnQuc3RhdGUgPSBzdGFydC5pbnRlcm5hbFN0YXRlO1xuICAgICAgdGhyb3cgbmV3IEN1cnNvckVycm9yKCdJbnZhbGlkIGhleGFkZWNpbWFsIGVzY2FwZSBzZXF1ZW5jZScsIHN0YXJ0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1cnNvckVycm9yIHtcbiAgY29uc3RydWN0b3IocHVibGljIG1zZzogc3RyaW5nLCBwdWJsaWMgY3Vyc29yOiBDaGFyYWN0ZXJDdXJzb3IpIHt9XG59XG4iXX0=