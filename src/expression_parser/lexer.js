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
        define("@angular/compiler/src/expression_parser/lexer", ["require", "exports", "@angular/compiler/src/chars"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isQuote = exports.isIdentifier = exports.EOF = exports.Token = exports.Lexer = exports.TokenType = void 0;
    var chars = require("@angular/compiler/src/chars");
    var TokenType;
    (function (TokenType) {
        TokenType[TokenType["Character"] = 0] = "Character";
        TokenType[TokenType["Identifier"] = 1] = "Identifier";
        TokenType[TokenType["Keyword"] = 2] = "Keyword";
        TokenType[TokenType["String"] = 3] = "String";
        TokenType[TokenType["Operator"] = 4] = "Operator";
        TokenType[TokenType["Number"] = 5] = "Number";
        TokenType[TokenType["Error"] = 6] = "Error";
    })(TokenType = exports.TokenType || (exports.TokenType = {}));
    var KEYWORDS = ['var', 'let', 'as', 'null', 'undefined', 'true', 'false', 'if', 'else', 'this'];
    var Lexer = /** @class */ (function () {
        function Lexer() {
        }
        Lexer.prototype.tokenize = function (text) {
            var scanner = new _Scanner(text);
            var tokens = [];
            var token = scanner.scanToken();
            while (token != null) {
                tokens.push(token);
                token = scanner.scanToken();
            }
            return tokens;
        };
        return Lexer;
    }());
    exports.Lexer = Lexer;
    var Token = /** @class */ (function () {
        function Token(index, end, type, numValue, strValue) {
            this.index = index;
            this.end = end;
            this.type = type;
            this.numValue = numValue;
            this.strValue = strValue;
        }
        Token.prototype.isCharacter = function (code) {
            return this.type == TokenType.Character && this.numValue == code;
        };
        Token.prototype.isNumber = function () {
            return this.type == TokenType.Number;
        };
        Token.prototype.isString = function () {
            return this.type == TokenType.String;
        };
        Token.prototype.isOperator = function (operator) {
            return this.type == TokenType.Operator && this.strValue == operator;
        };
        Token.prototype.isIdentifier = function () {
            return this.type == TokenType.Identifier;
        };
        Token.prototype.isKeyword = function () {
            return this.type == TokenType.Keyword;
        };
        Token.prototype.isKeywordLet = function () {
            return this.type == TokenType.Keyword && this.strValue == 'let';
        };
        Token.prototype.isKeywordAs = function () {
            return this.type == TokenType.Keyword && this.strValue == 'as';
        };
        Token.prototype.isKeywordNull = function () {
            return this.type == TokenType.Keyword && this.strValue == 'null';
        };
        Token.prototype.isKeywordUndefined = function () {
            return this.type == TokenType.Keyword && this.strValue == 'undefined';
        };
        Token.prototype.isKeywordTrue = function () {
            return this.type == TokenType.Keyword && this.strValue == 'true';
        };
        Token.prototype.isKeywordFalse = function () {
            return this.type == TokenType.Keyword && this.strValue == 'false';
        };
        Token.prototype.isKeywordThis = function () {
            return this.type == TokenType.Keyword && this.strValue == 'this';
        };
        Token.prototype.isError = function () {
            return this.type == TokenType.Error;
        };
        Token.prototype.toNumber = function () {
            return this.type == TokenType.Number ? this.numValue : -1;
        };
        Token.prototype.toString = function () {
            switch (this.type) {
                case TokenType.Character:
                case TokenType.Identifier:
                case TokenType.Keyword:
                case TokenType.Operator:
                case TokenType.String:
                case TokenType.Error:
                    return this.strValue;
                case TokenType.Number:
                    return this.numValue.toString();
                default:
                    return null;
            }
        };
        return Token;
    }());
    exports.Token = Token;
    function newCharacterToken(index, end, code) {
        return new Token(index, end, TokenType.Character, code, String.fromCharCode(code));
    }
    function newIdentifierToken(index, end, text) {
        return new Token(index, end, TokenType.Identifier, 0, text);
    }
    function newKeywordToken(index, end, text) {
        return new Token(index, end, TokenType.Keyword, 0, text);
    }
    function newOperatorToken(index, end, text) {
        return new Token(index, end, TokenType.Operator, 0, text);
    }
    function newStringToken(index, end, text) {
        return new Token(index, end, TokenType.String, 0, text);
    }
    function newNumberToken(index, end, n) {
        return new Token(index, end, TokenType.Number, n, '');
    }
    function newErrorToken(index, end, message) {
        return new Token(index, end, TokenType.Error, 0, message);
    }
    exports.EOF = new Token(-1, -1, TokenType.Character, 0, '');
    var _Scanner = /** @class */ (function () {
        function _Scanner(input) {
            this.input = input;
            this.peek = 0;
            this.index = -1;
            this.length = input.length;
            this.advance();
        }
        _Scanner.prototype.advance = function () {
            this.peek = ++this.index >= this.length ? chars.$EOF : this.input.charCodeAt(this.index);
        };
        _Scanner.prototype.scanToken = function () {
            var input = this.input, length = this.length;
            var peek = this.peek, index = this.index;
            // Skip whitespace.
            while (peek <= chars.$SPACE) {
                if (++index >= length) {
                    peek = chars.$EOF;
                    break;
                }
                else {
                    peek = input.charCodeAt(index);
                }
            }
            this.peek = peek;
            this.index = index;
            if (index >= length) {
                return null;
            }
            // Handle identifiers and numbers.
            if (isIdentifierStart(peek))
                return this.scanIdentifier();
            if (chars.isDigit(peek))
                return this.scanNumber(index);
            var start = index;
            switch (peek) {
                case chars.$PERIOD:
                    this.advance();
                    return chars.isDigit(this.peek) ? this.scanNumber(start) :
                        newCharacterToken(start, this.index, chars.$PERIOD);
                case chars.$LPAREN:
                case chars.$RPAREN:
                case chars.$LBRACE:
                case chars.$RBRACE:
                case chars.$LBRACKET:
                case chars.$RBRACKET:
                case chars.$COMMA:
                case chars.$COLON:
                case chars.$SEMICOLON:
                    return this.scanCharacter(start, peek);
                case chars.$SQ:
                case chars.$DQ:
                    return this.scanString();
                case chars.$HASH:
                case chars.$PLUS:
                case chars.$MINUS:
                case chars.$STAR:
                case chars.$SLASH:
                case chars.$PERCENT:
                case chars.$CARET:
                    return this.scanOperator(start, String.fromCharCode(peek));
                case chars.$QUESTION:
                    return this.scanComplexOperator(start, '?', chars.$PERIOD, '.');
                case chars.$LT:
                case chars.$GT:
                    return this.scanComplexOperator(start, String.fromCharCode(peek), chars.$EQ, '=');
                case chars.$BANG:
                case chars.$EQ:
                    return this.scanComplexOperator(start, String.fromCharCode(peek), chars.$EQ, '=', chars.$EQ, '=');
                case chars.$AMPERSAND:
                    return this.scanComplexOperator(start, '&', chars.$AMPERSAND, '&');
                case chars.$BAR:
                    return this.scanComplexOperator(start, '|', chars.$BAR, '|');
                case chars.$NBSP:
                    while (chars.isWhitespace(this.peek))
                        this.advance();
                    return this.scanToken();
            }
            this.advance();
            return this.error("Unexpected character [" + String.fromCharCode(peek) + "]", 0);
        };
        _Scanner.prototype.scanCharacter = function (start, code) {
            this.advance();
            return newCharacterToken(start, this.index, code);
        };
        _Scanner.prototype.scanOperator = function (start, str) {
            this.advance();
            return newOperatorToken(start, this.index, str);
        };
        /**
         * Tokenize a 2/3 char long operator
         *
         * @param start start index in the expression
         * @param one first symbol (always part of the operator)
         * @param twoCode code point for the second symbol
         * @param two second symbol (part of the operator when the second code point matches)
         * @param threeCode code point for the third symbol
         * @param three third symbol (part of the operator when provided and matches source expression)
         */
        _Scanner.prototype.scanComplexOperator = function (start, one, twoCode, two, threeCode, three) {
            this.advance();
            var str = one;
            if (this.peek == twoCode) {
                this.advance();
                str += two;
            }
            if (threeCode != null && this.peek == threeCode) {
                this.advance();
                str += three;
            }
            return newOperatorToken(start, this.index, str);
        };
        _Scanner.prototype.scanIdentifier = function () {
            var start = this.index;
            this.advance();
            while (isIdentifierPart(this.peek))
                this.advance();
            var str = this.input.substring(start, this.index);
            return KEYWORDS.indexOf(str) > -1 ? newKeywordToken(start, this.index, str) :
                newIdentifierToken(start, this.index, str);
        };
        _Scanner.prototype.scanNumber = function (start) {
            var simple = (this.index === start);
            this.advance(); // Skip initial digit.
            while (true) {
                if (chars.isDigit(this.peek)) {
                    // Do nothing.
                }
                else if (this.peek == chars.$PERIOD) {
                    simple = false;
                }
                else if (isExponentStart(this.peek)) {
                    this.advance();
                    if (isExponentSign(this.peek))
                        this.advance();
                    if (!chars.isDigit(this.peek))
                        return this.error('Invalid exponent', -1);
                    simple = false;
                }
                else {
                    break;
                }
                this.advance();
            }
            var str = this.input.substring(start, this.index);
            var value = simple ? parseIntAutoRadix(str) : parseFloat(str);
            return newNumberToken(start, this.index, value);
        };
        _Scanner.prototype.scanString = function () {
            var start = this.index;
            var quote = this.peek;
            this.advance(); // Skip initial quote.
            var buffer = '';
            var marker = this.index;
            var input = this.input;
            while (this.peek != quote) {
                if (this.peek == chars.$BACKSLASH) {
                    buffer += input.substring(marker, this.index);
                    this.advance();
                    var unescapedCode = void 0;
                    // Workaround for TS2.1-introduced type strictness
                    this.peek = this.peek;
                    if (this.peek == chars.$u) {
                        // 4 character hex code for unicode character.
                        var hex = input.substring(this.index + 1, this.index + 5);
                        if (/^[0-9a-f]+$/i.test(hex)) {
                            unescapedCode = parseInt(hex, 16);
                        }
                        else {
                            return this.error("Invalid unicode escape [\\u" + hex + "]", 0);
                        }
                        for (var i = 0; i < 5; i++) {
                            this.advance();
                        }
                    }
                    else {
                        unescapedCode = unescape(this.peek);
                        this.advance();
                    }
                    buffer += String.fromCharCode(unescapedCode);
                    marker = this.index;
                }
                else if (this.peek == chars.$EOF) {
                    return this.error('Unterminated quote', 0);
                }
                else {
                    this.advance();
                }
            }
            var last = input.substring(marker, this.index);
            this.advance(); // Skip terminating quote.
            return newStringToken(start, this.index, buffer + last);
        };
        _Scanner.prototype.error = function (message, offset) {
            var position = this.index + offset;
            return newErrorToken(position, this.index, "Lexer Error: " + message + " at column " + position + " in expression [" + this.input + "]");
        };
        return _Scanner;
    }());
    function isIdentifierStart(code) {
        return (chars.$a <= code && code <= chars.$z) || (chars.$A <= code && code <= chars.$Z) ||
            (code == chars.$_) || (code == chars.$$);
    }
    function isIdentifier(input) {
        if (input.length == 0)
            return false;
        var scanner = new _Scanner(input);
        if (!isIdentifierStart(scanner.peek))
            return false;
        scanner.advance();
        while (scanner.peek !== chars.$EOF) {
            if (!isIdentifierPart(scanner.peek))
                return false;
            scanner.advance();
        }
        return true;
    }
    exports.isIdentifier = isIdentifier;
    function isIdentifierPart(code) {
        return chars.isAsciiLetter(code) || chars.isDigit(code) || (code == chars.$_) ||
            (code == chars.$$);
    }
    function isExponentStart(code) {
        return code == chars.$e || code == chars.$E;
    }
    function isExponentSign(code) {
        return code == chars.$MINUS || code == chars.$PLUS;
    }
    function isQuote(code) {
        return code === chars.$SQ || code === chars.$DQ || code === chars.$BT;
    }
    exports.isQuote = isQuote;
    function unescape(code) {
        switch (code) {
            case chars.$n:
                return chars.$LF;
            case chars.$f:
                return chars.$FF;
            case chars.$r:
                return chars.$CR;
            case chars.$t:
                return chars.$TAB;
            case chars.$v:
                return chars.$VTAB;
            default:
                return code;
        }
    }
    function parseIntAutoRadix(text) {
        var result = parseInt(text);
        if (isNaN(result)) {
            throw new Error('Invalid integer literal when parsing ' + text);
        }
        return result;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV4ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvZXhwcmVzc2lvbl9wYXJzZXIvbGV4ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsbURBQWtDO0lBRWxDLElBQVksU0FRWDtJQVJELFdBQVksU0FBUztRQUNuQixtREFBUyxDQUFBO1FBQ1QscURBQVUsQ0FBQTtRQUNWLCtDQUFPLENBQUE7UUFDUCw2Q0FBTSxDQUFBO1FBQ04saURBQVEsQ0FBQTtRQUNSLDZDQUFNLENBQUE7UUFDTiwyQ0FBSyxDQUFBO0lBQ1AsQ0FBQyxFQVJXLFNBQVMsR0FBVCxpQkFBUyxLQUFULGlCQUFTLFFBUXBCO0lBRUQsSUFBTSxRQUFRLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUVsRztRQUFBO1FBV0EsQ0FBQztRQVZDLHdCQUFRLEdBQVIsVUFBUyxJQUFZO1lBQ25CLElBQU0sT0FBTyxHQUFHLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25DLElBQU0sTUFBTSxHQUFZLEVBQUUsQ0FBQztZQUMzQixJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEMsT0FBTyxLQUFLLElBQUksSUFBSSxFQUFFO2dCQUNwQixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNuQixLQUFLLEdBQUcsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO2FBQzdCO1lBQ0QsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUNILFlBQUM7SUFBRCxDQUFDLEFBWEQsSUFXQztJQVhZLHNCQUFLO0lBYWxCO1FBQ0UsZUFDVyxL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WUFDbkIsS0FBSyxLQUFLLENBQUMsRUFBRTtnQkFDWCxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUM7WUFDbkIsS0FBSyxLQUFLLENBQUMsRUFBRTtnQkFDWCxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUM7WUFDbkIsS0FBSyxLQUFLLENBQUMsRUFBRTtnQkFDWCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDcEIsS0FBSyxLQUFLLENBQUMsRUFBRTtnQkFDWCxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDckI7Z0JBQ0UsT0FBTyxJQUFJLENBQUM7U0FDZjtJQUNILENBQUM7SUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQVk7UUFDckMsSUFBTSxNQUFNLEdBQVcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RDLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLEdBQUcsSUFBSSxDQUFDLENBQUM7U0FDakU7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGFycyBmcm9tICcuLi9jaGFycyc7XG5cbmV4cG9ydCBlbnVtIFRva2VuVHlwZSB7XG4gIENoYXJhY3RlcixcbiAgSWRlbnRpZmllcixcbiAgS2V5d29yZCxcbiAgU3RyaW5nLFxuICBPcGVyYXRvcixcbiAgTnVtYmVyLFxuICBFcnJvclxufVxuXG5jb25zdCBLRVlXT1JEUyA9IFsndmFyJywgJ2xldCcsICdhcycsICdudWxsJywgJ3VuZGVmaW5lZCcsICd0cnVlJywgJ2ZhbHNlJywgJ2lmJywgJ2Vsc2UnLCAndGhpcyddO1xuXG5leHBvcnQgY2xhc3MgTGV4ZXIge1xuICB0b2tlbml6ZSh0ZXh0OiBzdHJpbmcpOiBUb2tlbltdIHtcbiAgICBjb25zdCBzY2FubmVyID0gbmV3IF9TY2FubmVyKHRleHQpO1xuICAgIGNvbnN0IHRva2VuczogVG9rZW5bXSA9IFtdO1xuICAgIGxldCB0b2tlbiA9IHNjYW5uZXIuc2NhblRva2VuKCk7XG4gICAgd2hpbGUgKHRva2VuICE9IG51bGwpIHtcbiAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgIHRva2VuID0gc2Nhbm5lci5zY2FuVG9rZW4oKTtcbiAgICB9XG4gICAgcmV0dXJuIHRva2VucztcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBpbmRleDogbnVtYmVyLCBwdWJsaWMgZW5kOiBudW1iZXIsIHB1YmxpYyB0eXBlOiBUb2tlblR5cGUsIHB1YmxpYyBudW1WYWx1ZTogbnVtYmVyLFxuICAgICAgcHVibGljIHN0clZhbHVlOiBzdHJpbmcpIHt9XG5cbiAgaXNDaGFyYWN0ZXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuQ2hhcmFjdGVyICYmIHRoaXMubnVtVmFsdWUgPT0gY29kZTtcbiAgfVxuXG4gIGlzTnVtYmVyKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLk51bWJlcjtcbiAgfVxuXG4gIGlzU3RyaW5nKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLlN0cmluZztcbiAgfVxuXG4gIGlzT3BlcmF0b3Iob3BlcmF0b3I6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yICYmIHRoaXMuc3RyVmFsdWUgPT0gb3BlcmF0b3I7XG4gIH1cblxuICBpc0lkZW50aWZpZXIoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuSWRlbnRpZmllcjtcbiAgfVxuXG4gIGlzS2V5d29yZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5LZXl3b3JkO1xuICB9XG5cbiAgaXNLZXl3b3JkTGV0KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLktleXdvcmQgJiYgdGhpcy5zdHJWYWx1ZSA9PSAnbGV0JztcbiAgfVxuXG4gIGlzS2V5d29yZEFzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLktleXdvcmQgJiYgdGhpcy5zdHJWYWx1ZSA9PSAnYXMnO1xuICB9XG5cbiAgaXNLZXl3b3JkTnVsbCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5LZXl3b3JkICYmIHRoaXMuc3RyVmFsdWUgPT0gJ251bGwnO1xuICB9XG5cbiAgaXNLZXl3b3JkVW5kZWZpbmVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLktleXdvcmQgJiYgdGhpcy5zdHJWYWx1ZSA9PSAndW5kZWZpbmVkJztcbiAgfVxuXG4gIGlzS2V5d29yZFRydWUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuS2V5d29yZCAmJiB0aGlzLnN0clZhbHVlID09ICd0cnVlJztcbiAgfVxuXG4gIGlzS2V5d29yZEZhbHNlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLktleXdvcmQgJiYgdGhpcy5zdHJWYWx1ZSA9PSAnZmFsc2UnO1xuICB9XG5cbiAgaXNLZXl3b3JkVGhpcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5LZXl3b3JkICYmIHRoaXMuc3RyVmFsdWUgPT0gJ3RoaXMnO1xuICB9XG5cbiAgaXNFcnJvcigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5FcnJvcjtcbiAgfVxuXG4gIHRvTnVtYmVyKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuTnVtYmVyID8gdGhpcy5udW1WYWx1ZSA6IC0xO1xuICB9XG5cbiAgdG9TdHJpbmcoKTogc3RyaW5nfG51bGwge1xuICAgIHN3aXRjaCAodGhpcy50eXBlKSB7XG4gICAgICBjYXNlIFRva2VuVHlwZS5DaGFyYWN0ZXI6XG4gICAgICBjYXNlIFRva2VuVHlwZS5JZGVudGlmaWVyOlxuICAgICAgY2FzZSBUb2tlblR5cGUuS2V5d29yZDpcbiAgICAgIGNhc2UgVG9rZW5UeXBlLk9wZXJhdG9yOlxuICAgICAgY2FzZSBUb2tlblR5cGUuU3RyaW5nOlxuICAgICAgY2FzZSBUb2tlblR5cGUuRXJyb3I6XG4gICAgICAgIHJldHVybiB0aGlzLnN0clZhbHVlO1xuICAgICAgY2FzZSBUb2tlblR5cGUuTnVtYmVyOlxuICAgICAgICByZXR1cm4gdGhpcy5udW1WYWx1ZS50b1N0cmluZygpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG5ld0NoYXJhY3RlclRva2VuKGluZGV4OiBudW1iZXIsIGVuZDogbnVtYmVyLCBjb2RlOiBudW1iZXIpOiBUb2tlbiB7XG4gIHJldHVybiBuZXcgVG9rZW4oaW5kZXgsIGVuZCwgVG9rZW5UeXBlLkNoYXJhY3RlciwgY29kZSwgU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKSk7XG59XG5cbmZ1bmN0aW9uIG5ld0lkZW50aWZpZXJUb2tlbihpbmRleDogbnVtYmVyLCBlbmQ6IG51bWJlciwgdGV4dDogc3RyaW5nKTogVG9rZW4ge1xuICByZXR1cm4gbmV3IFRva2VuKGluZGV4LCBlbmQsIFRva2VuVHlwZS5JZGVudGlmaWVyLCAwLCB0ZXh0KTtcbn1cblxuZnVuY3Rpb24gbmV3S2V5d29yZFRva2VuKGluZGV4OiBudW1iZXIsIGVuZDogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpOiBUb2tlbiB7XG4gIHJldHVybiBuZXcgVG9rZW4oaW5kZXgsIGVuZCwgVG9rZW5UeXBlLktleXdvcmQsIDAsIHRleHQpO1xufVxuXG5mdW5jdGlvbiBuZXdPcGVyYXRvclRva2VuKGluZGV4OiBudW1iZXIsIGVuZDogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpOiBUb2tlbiB7XG4gIHJldHVybiBuZXcgVG9rZW4oaW5kZXgsIGVuZCwgVG9rZW5UeXBlLk9wZXJhdG9yLCAwLCB0ZXh0KTtcbn1cblxuZnVuY3Rpb24gbmV3U3RyaW5nVG9rZW4oaW5kZXg6IG51bWJlciwgZW5kOiBudW1iZXIsIHRleHQ6IHN0cmluZyk6IFRva2VuIHtcbiAgcmV0dXJuIG5ldyBUb2tlbihpbmRleCwgZW5kLCBUb2tlblR5cGUuU3RyaW5nLCAwLCB0ZXh0KTtcbn1cblxuZnVuY3Rpb24gbmV3TnVtYmVyVG9rZW4oaW5kZXg6IG51bWJlciwgZW5kOiBudW1iZXIsIG46IG51bWJlcik6IFRva2VuIHtcbiAgcmV0dXJuIG5ldyBUb2tlbihpbmRleCwgZW5kLCBUb2tlblR5cGUuTnVtYmVyLCBuLCAnJyk7XG59XG5cbmZ1bmN0aW9uIG5ld0Vycm9yVG9rZW4oaW5kZXg6IG51bWJlciwgZW5kOiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZyk6IFRva2VuIHtcbiAgcmV0dXJuIG5ldyBUb2tlbihpbmRleCwgZW5kLCBUb2tlblR5cGUuRXJyb3IsIDAsIG1lc3NhZ2UpO1xufVxuXG5leHBvcnQgY29uc3QgRU9GOiBUb2tlbiA9IG5ldyBUb2tlbigtMSwgLTEsIFRva2VuVHlwZS5DaGFyYWN0ZXIsIDAsICcnKTtcblxuY2xhc3MgX1NjYW5uZXIge1xuICBsZW5ndGg6IG51bWJlcjtcbiAgcGVlazogbnVtYmVyID0gMDtcbiAgaW5kZXg6IG51bWJlciA9IC0xO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBpbnB1dDogc3RyaW5nKSB7XG4gICAgdGhpcy5sZW5ndGggPSBpbnB1dC5sZW5ndGg7XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gIH1cblxuICBhZHZhbmNlKCkge1xuICAgIHRoaXMucGVlayA9ICsrdGhpcy5pbmRleCA+PSB0aGlzLmxlbmd0aCA/IGNoYXJzLiRFT0YgOiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5pbmRleCk7XG4gIH1cblxuICBzY2FuVG9rZW4oKTogVG9rZW58bnVsbCB7XG4gICAgY29uc3QgaW5wdXQgPSB0aGlzLmlucHV0LCBsZW5ndGggPSB0aGlzLmxlbmd0aDtcbiAgICBsZXQgcGVlayA9IHRoaXMucGVlaywgaW5kZXggPSB0aGlzLmluZGV4O1xuXG4gICAgLy8gU2tpcCB3aGl0ZXNwYWNlLlxuICAgIHdoaWxlIChwZWVrIDw9IGNoYXJzLiRTUEFDRSkge1xuICAgICAgaWYgKCsraW5kZXggPj0gbGVuZ3RoKSB7XG4gICAgICAgIHBlZWsgPSBjaGFycy4kRU9GO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZWsgPSBpbnB1dC5jaGFyQ29kZUF0KGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnBlZWsgPSBwZWVrO1xuICAgIHRoaXMuaW5kZXggPSBpbmRleDtcblxuICAgIGlmIChpbmRleCA+PSBsZW5ndGgpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSBpZGVudGlmaWVycyBhbmQgbnVtYmVycy5cbiAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQocGVlaykpIHJldHVybiB0aGlzLnNjYW5JZGVudGlmaWVyKCk7XG4gICAgaWYgKGNoYXJzLmlzRGlnaXQocGVlaykpIHJldHVybiB0aGlzLnNjYW5OdW1iZXIoaW5kZXgpO1xuXG4gICAgY29uc3Qgc3RhcnQ6IG51bWJlciA9IGluZGV4O1xuICAgIHN3aXRjaCAocGVlaykge1xuICAgICAgY2FzZSBjaGFycy4kUEVSSU9EOlxuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgcmV0dXJuIGNoYXJzLmlzRGlnaXQodGhpcy5wZWVrKSA/IHRoaXMuc2Nhbk51bWJlcihzdGFydCkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q2hhcmFjdGVyVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIGNoYXJzLiRQRVJJT0QpO1xuICAgICAgY2FzZSBjaGFycy4kTFBBUkVOOlxuICAgICAgY2FzZSBjaGFycy4kUlBBUkVOOlxuICAgICAgY2FzZSBjaGFycy4kTEJSQUNFOlxuICAgICAgY2FzZSBjaGFycy4kUkJSQUNFOlxuICAgICAgY2FzZSBjaGFycy4kTEJSQUNLRVQ6XG4gICAgICBjYXNlIGNoYXJzLiRSQlJBQ0tFVDpcbiAgICAgIGNhc2UgY2hhcnMuJENPTU1BOlxuICAgICAgY2FzZSBjaGFycy4kQ09MT046XG4gICAgICBjYXNlIGNoYXJzLiRTRU1JQ09MT046XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5DaGFyYWN0ZXIoc3RhcnQsIHBlZWspO1xuICAgICAgY2FzZSBjaGFycy4kU1E6XG4gICAgICBjYXNlIGNoYXJzLiREUTpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhblN0cmluZygpO1xuICAgICAgY2FzZSBjaGFycy4kSEFTSDpcbiAgICAgIGNhc2UgY2hhcnMuJFBMVVM6XG4gICAgICBjYXNlIGNoYXJzLiRNSU5VUzpcbiAgICAgIGNhc2UgY2hhcnMuJFNUQVI6XG4gICAgICBjYXNlIGNoYXJzLiRTTEFTSDpcbiAgICAgIGNhc2UgY2hhcnMuJFBFUkNFTlQ6XG4gICAgICBjYXNlIGNoYXJzLiRDQVJFVDpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2Nhbk9wZXJhdG9yKHN0YXJ0LCBTdHJpbmcuZnJvbUNoYXJDb2RlKHBlZWspKTtcbiAgICAgIGNhc2UgY2hhcnMuJFFVRVNUSU9OOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ29tcGxleE9wZXJhdG9yKHN0YXJ0LCAnPycsIGNoYXJzLiRQRVJJT0QsICcuJyk7XG4gICAgICBjYXNlIGNoYXJzLiRMVDpcbiAgICAgIGNhc2UgY2hhcnMuJEdUOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ29tcGxleE9wZXJhdG9yKHN0YXJ0LCBTdHJpbmcuZnJvbUNoYXJDb2RlKHBlZWspLCBjaGFycy4kRVEsICc9Jyk7XG4gICAgICBjYXNlIGNoYXJzLiRCQU5HOlxuICAgICAgY2FzZSBjaGFycy4kRVE6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Db21wbGV4T3BlcmF0b3IoXG4gICAgICAgICAgICBzdGFydCwgU3RyaW5nLmZyb21DaGFyQ29kZShwZWVrKSwgY2hhcnMuJEVRLCAnPScsIGNoYXJzLiRFUSwgJz0nKTtcbiAgICAgIGNhc2UgY2hhcnMuJEFNUEVSU0FORDpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhbkNvbXBsZXhPcGVyYXRvcihzdGFydCwgJyYnLCBjaGFycy4kQU1QRVJTQU5ELCAnJicpO1xuICAgICAgY2FzZSBjaGFycy4kQkFSOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ29tcGxleE9wZXJhdG9yKHN0YXJ0LCAnfCcsIGNoYXJzLiRCQVIsICd8Jyk7XG4gICAgICBjYXNlIGNoYXJzLiROQlNQOlxuICAgICAgICB3aGlsZSAoY2hhcnMuaXNXaGl0ZXNwYWNlKHRoaXMucGVlaykpIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICByZXR1cm4gdGhpcy5zY2FuVG9rZW4oKTtcbiAgICB9XG5cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gdGhpcy5lcnJvcihgVW5leHBlY3RlZCBjaGFyYWN0ZXIgWyR7U3RyaW5nLmZyb21DaGFyQ29kZShwZWVrKX1dYCwgMCk7XG4gIH1cblxuICBzY2FuQ2hhcmFjdGVyKHN0YXJ0OiBudW1iZXIsIGNvZGU6IG51bWJlcik6IFRva2VuIHtcbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbmV3Q2hhcmFjdGVyVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIGNvZGUpO1xuICB9XG5cblxuICBzY2FuT3BlcmF0b3Ioc3RhcnQ6IG51bWJlciwgc3RyOiBzdHJpbmcpOiBUb2tlbiB7XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG5ld09wZXJhdG9yVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIHN0cik7XG4gIH1cblxuICAvKipcbiAgICogVG9rZW5pemUgYSAyLzMgY2hhciBsb25nIG9wZXJhdG9yXG4gICAqXG4gICAqIEBwYXJhbSBzdGFydCBzdGFydCBpbmRleCBpbiB0aGUgZXhwcmVzc2lvblxuICAgKiBAcGFyYW0gb25lIGZpcnN0IHN5bWJvbCAoYWx3YXlzIHBhcnQgb2YgdGhlIG9wZXJhdG9yKVxuICAgKiBAcGFyYW0gdHdvQ29kZSBjb2RlIHBvaW50IGZvciB0aGUgc2Vjb25kIHN5bWJvbFxuICAgKiBAcGFyYW0gdHdvIHNlY29uZCBzeW1ib2wgKHBhcnQgb2YgdGhlIG9wZXJhdG9yIHdoZW4gdGhlIHNlY29uZCBjb2RlIHBvaW50IG1hdGNoZXMpXG4gICAqIEBwYXJhbSB0aHJlZUNvZGUgY29kZSBwb2ludCBmb3IgdGhlIHRoaXJkIHN5bWJvbFxuICAgKiBAcGFyYW0gdGhyZWUgdGhpcmQgc3ltYm9sIChwYXJ0IG9mIHRoZSBvcGVyYXRvciB3aGVuIHByb3ZpZGVkIGFuZCBtYXRjaGVzIHNvdXJjZSBleHByZXNzaW9uKVxuICAgKi9cbiAgc2NhbkNvbXBsZXhPcGVyYXRvcihcbiAgICAgIHN0YXJ0OiBudW1iZXIsIG9uZTogc3RyaW5nLCB0d29Db2RlOiBudW1iZXIsIHR3bzogc3RyaW5nLCB0aHJlZUNvZGU/OiBudW1iZXIsXG4gICAgICB0aHJlZT86IHN0cmluZyk6IFRva2VuIHtcbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICBsZXQgc3RyOiBzdHJpbmcgPSBvbmU7XG4gICAgaWYgKHRoaXMucGVlayA9PSB0d29Db2RlKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHN0ciArPSB0d287XG4gICAgfVxuICAgIGlmICh0aHJlZUNvZGUgIT0gbnVsbCAmJiB0aGlzLnBlZWsgPT0gdGhyZWVDb2RlKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHN0ciArPSB0aHJlZTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld09wZXJhdG9yVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIHN0cik7XG4gIH1cblxuICBzY2FuSWRlbnRpZmllcigpOiBUb2tlbiB7XG4gICAgY29uc3Qgc3RhcnQ6IG51bWJlciA9IHRoaXMuaW5kZXg7XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgd2hpbGUgKGlzSWRlbnRpZmllclBhcnQodGhpcy5wZWVrKSkgdGhpcy5hZHZhbmNlKCk7XG4gICAgY29uc3Qgc3RyOiBzdHJpbmcgPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgdGhpcy5pbmRleCk7XG4gICAgcmV0dXJuIEtFWVdPUkRTLmluZGV4T2Yoc3RyKSA+IC0xID8gbmV3S2V5d29yZFRva2VuKHN0YXJ0LCB0aGlzLmluZGV4LCBzdHIpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdJZGVudGlmaWVyVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIHN0cik7XG4gIH1cblxuICBzY2FuTnVtYmVyKHN0YXJ0OiBudW1iZXIpOiBUb2tlbiB7XG4gICAgbGV0IHNpbXBsZTogYm9vbGVhbiA9ICh0aGlzLmluZGV4ID09PSBzdGFydCk7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBTa2lwIGluaXRpYWwgZGlnaXQuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmIChjaGFycy5pc0RpZ2l0KHRoaXMucGVlaykpIHtcbiAgICAgICAgLy8gRG8gbm90aGluZy5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5wZWVrID09IGNoYXJzLiRQRVJJT0QpIHtcbiAgICAgICAgc2ltcGxlID0gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGlzRXhwb25lbnRTdGFydCh0aGlzLnBlZWspKSB7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICBpZiAoaXNFeHBvbmVudFNpZ24odGhpcy5wZWVrKSkgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIGlmICghY2hhcnMuaXNEaWdpdCh0aGlzLnBlZWspKSByZXR1cm4gdGhpcy5lcnJvcignSW52YWxpZCBleHBvbmVudCcsIC0xKTtcbiAgICAgICAgc2ltcGxlID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIH1cbiAgICBjb25zdCBzdHI6IHN0cmluZyA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmluZGV4KTtcbiAgICBjb25zdCB2YWx1ZTogbnVtYmVyID0gc2ltcGxlID8gcGFyc2VJbnRBdXRvUmFkaXgoc3RyKSA6IHBhcnNlRmxvYXQoc3RyKTtcbiAgICByZXR1cm4gbmV3TnVtYmVyVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIHZhbHVlKTtcbiAgfVxuXG4gIHNjYW5TdHJpbmcoKTogVG9rZW4ge1xuICAgIGNvbnN0IHN0YXJ0OiBudW1iZXIgPSB0aGlzLmluZGV4O1xuICAgIGNvbnN0IHF1b3RlOiBudW1iZXIgPSB0aGlzLnBlZWs7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBTa2lwIGluaXRpYWwgcXVvdGUuXG5cbiAgICBsZXQgYnVmZmVyOiBzdHJpbmcgPSAnJztcbiAgICBsZXQgbWFya2VyOiBudW1iZXIgPSB0aGlzLmluZGV4O1xuICAgIGNvbnN0IGlucHV0OiBzdHJpbmcgPSB0aGlzLmlucHV0O1xuXG4gICAgd2hpbGUgKHRoaXMucGVlayAhPSBxdW90ZSkge1xuICAgICAgaWYgKHRoaXMucGVlayA9PSBjaGFycy4kQkFDS1NMQVNIKSB7XG4gICAgICAgIGJ1ZmZlciArPSBpbnB1dC5zdWJzdHJpbmcobWFya2VyLCB0aGlzLmluZGV4KTtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIGxldCB1bmVzY2FwZWRDb2RlOiBudW1iZXI7XG4gICAgICAgIC8vIFdvcmthcm91bmQgZm9yIFRTMi4xLWludHJvZHVjZWQgdHlwZSBzdHJpY3RuZXNzXG4gICAgICAgIHRoaXMucGVlayA9IHRoaXMucGVlaztcbiAgICAgICAgaWYgKHRoaXMucGVlayA9PSBjaGFycy4kdSkge1xuICAgICAgICAgIC8vIDQgY2hhcmFjdGVyIGhleCBjb2RlIGZvciB1bmljb2RlIGNoYXJhY3Rlci5cbiAgICAgICAgICBjb25zdCBoZXg6IHN0cmluZyA9IGlucHV0LnN1YnN0cmluZyh0aGlzLmluZGV4ICsgMSwgdGhpcy5pbmRleCArIDUpO1xuICAgICAgICAgIGlmICgvXlswLTlhLWZdKyQvaS50ZXN0KGhleCkpIHtcbiAgICAgICAgICAgIHVuZXNjYXBlZENvZGUgPSBwYXJzZUludChoZXgsIDE2KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3IoYEludmFsaWQgdW5pY29kZSBlc2NhcGUgW1xcXFx1JHtoZXh9XWAsIDApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKGxldCBpOiBudW1iZXIgPSAwOyBpIDwgNTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdW5lc2NhcGVkQ29kZSA9IHVuZXNjYXBlKHRoaXMucGVlayk7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgYnVmZmVyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodW5lc2NhcGVkQ29kZSk7XG4gICAgICAgIG1hcmtlciA9IHRoaXMuaW5kZXg7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMucGVlayA9PSBjaGFycy4kRU9GKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yKCdVbnRlcm1pbmF0ZWQgcXVvdGUnLCAwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGxhc3Q6IHN0cmluZyA9IGlucHV0LnN1YnN0cmluZyhtYXJrZXIsIHRoaXMuaW5kZXgpO1xuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gU2tpcCB0ZXJtaW5hdGluZyBxdW90ZS5cblxuICAgIHJldHVybiBuZXdTdHJpbmdUb2tlbihzdGFydCwgdGhpcy5pbmRleCwgYnVmZmVyICsgbGFzdCk7XG4gIH1cblxuICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyKTogVG9rZW4ge1xuICAgIGNvbnN0IHBvc2l0aW9uOiBudW1iZXIgPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHJldHVybiBuZXdFcnJvclRva2VuKFxuICAgICAgICBwb3NpdGlvbiwgdGhpcy5pbmRleCxcbiAgICAgICAgYExleGVyIEVycm9yOiAke21lc3NhZ2V9IGF0IGNvbHVtbiAke3Bvc2l0aW9ufSBpbiBleHByZXNzaW9uIFske3RoaXMuaW5wdXR9XWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzSWRlbnRpZmllclN0YXJ0KGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKGNoYXJzLiRhIDw9IGNvZGUgJiYgY29kZSA8PSBjaGFycy4keikgfHwgKGNoYXJzLiRBIDw9IGNvZGUgJiYgY29kZSA8PSBjaGFycy4kWikgfHxcbiAgICAgIChjb2RlID09IGNoYXJzLiRfKSB8fCAoY29kZSA9PSBjaGFycy4kJCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0lkZW50aWZpZXIoaW5wdXQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAoaW5wdXQubGVuZ3RoID09IDApIHJldHVybiBmYWxzZTtcbiAgY29uc3Qgc2Nhbm5lciA9IG5ldyBfU2Nhbm5lcihpbnB1dCk7XG4gIGlmICghaXNJZGVudGlmaWVyU3RhcnQoc2Nhbm5lci5wZWVrKSkgcmV0dXJuIGZhbHNlO1xuICBzY2FubmVyLmFkdmFuY2UoKTtcbiAgd2hpbGUgKHNjYW5uZXIucGVlayAhPT0gY2hhcnMuJEVPRikge1xuICAgIGlmICghaXNJZGVudGlmaWVyUGFydChzY2FubmVyLnBlZWspKSByZXR1cm4gZmFsc2U7XG4gICAgc2Nhbm5lci5hZHZhbmNlKCk7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGlzSWRlbnRpZmllclBhcnQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjaGFycy5pc0FzY2lpTGV0dGVyKGNvZGUpIHx8IGNoYXJzLmlzRGlnaXQoY29kZSkgfHwgKGNvZGUgPT0gY2hhcnMuJF8pIHx8XG4gICAgICAoY29kZSA9PSBjaGFycy4kJCk7XG59XG5cbmZ1bmN0aW9uIGlzRXhwb25lbnRTdGFydChjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvZGUgPT0gY2hhcnMuJGUgfHwgY29kZSA9PSBjaGFycy4kRTtcbn1cblxuZnVuY3Rpb24gaXNFeHBvbmVudFNpZ24oY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID09IGNoYXJzLiRNSU5VUyB8fCBjb2RlID09IGNoYXJzLiRQTFVTO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNRdW90ZShjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvZGUgPT09IGNoYXJzLiRTUSB8fCBjb2RlID09PSBjaGFycy4kRFEgfHwgY29kZSA9PT0gY2hhcnMuJEJUO1xufVxuXG5mdW5jdGlvbiB1bmVzY2FwZShjb2RlOiBudW1iZXIpOiBudW1iZXIge1xuICBzd2l0Y2ggKGNvZGUpIHtcbiAgICBjYXNlIGNoYXJzLiRuOlxuICAgICAgcmV0dXJuIGNoYXJzLiRMRjtcbiAgICBjYXNlIGNoYXJzLiRmOlxuICAgICAgcmV0dXJuIGNoYXJzLiRGRjtcbiAgICBjYXNlIGNoYXJzLiRyOlxuICAgICAgcmV0dXJuIGNoYXJzLiRDUjtcbiAgICBjYXNlIGNoYXJzLiR0OlxuICAgICAgcmV0dXJuIGNoYXJzLiRUQUI7XG4gICAgY2FzZSBjaGFycy4kdjpcbiAgICAgIHJldHVybiBjaGFycy4kVlRBQjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvZGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VJbnRBdXRvUmFkaXgodGV4dDogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgcmVzdWx0OiBudW1iZXIgPSBwYXJzZUludCh0ZXh0KTtcbiAgaWYgKGlzTmFOKHJlc3VsdCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW50ZWdlciBsaXRlcmFsIHdoZW4gcGFyc2luZyAnICsgdGV4dCk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==