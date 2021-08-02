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
        define("@angular/compiler/src/expression_parser/lexer", ["require", "exports", "@angular/compiler/src/chars"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isIdentifier = exports.EOF = exports.Token = exports.Lexer = exports.TokenType = void 0;
    var chars = require("@angular/compiler/src/chars");
    var TokenType;
    (function (TokenType) {
        TokenType[TokenType["Character"] = 0] = "Character";
        TokenType[TokenType["Identifier"] = 1] = "Identifier";
        TokenType[TokenType["PrivateIdentifier"] = 2] = "PrivateIdentifier";
        TokenType[TokenType["Keyword"] = 3] = "Keyword";
        TokenType[TokenType["String"] = 4] = "String";
        TokenType[TokenType["Operator"] = 5] = "Operator";
        TokenType[TokenType["Number"] = 6] = "Number";
        TokenType[TokenType["Error"] = 7] = "Error";
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
        Token.prototype.isPrivateIdentifier = function () {
            return this.type == TokenType.PrivateIdentifier;
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
                case TokenType.PrivateIdentifier:
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
    function newPrivateIdentifierToken(index, end, text) {
        return new Token(index, end, TokenType.PrivateIdentifier, 0, text);
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
                    return this.scanPrivateIdentifier();
                case chars.$PLUS:
                case chars.$MINUS:
                case chars.$STAR:
                case chars.$SLASH:
                case chars.$PERCENT:
                case chars.$CARET:
                    return this.scanOperator(start, String.fromCharCode(peek));
                case chars.$QUESTION:
                    return this.scanQuestion(start);
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
        /** Scans an ECMAScript private identifier. */
        _Scanner.prototype.scanPrivateIdentifier = function () {
            var start = this.index;
            this.advance();
            if (!isIdentifierStart(this.peek)) {
                return this.error('Invalid character [#]', -1);
            }
            while (isIdentifierPart(this.peek))
                this.advance();
            var identifierName = this.input.substring(start, this.index);
            return newPrivateIdentifierToken(start, this.index, identifierName);
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
        _Scanner.prototype.scanQuestion = function (start) {
            this.advance();
            var str = '?';
            // Either `a ?? b` or 'a?.b'.
            if (this.peek === chars.$QUESTION || this.peek === chars.$PERIOD) {
                str += this.peek === chars.$PERIOD ? '.' : '?';
                this.advance();
            }
            return newOperatorToken(start, this.index, str);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV4ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvZXhwcmVzc2lvbl9wYXJzZXIvbGV4ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsbURBQWtDO0lBRWxDLElBQVksU0FTWDtJQVRELFdBQVksU0FBUztRQUNuQixtREFBUyxDQUFBO1FBQ1QscURBQVUsQ0FBQTtRQUNWLG1FQUFpQixDQUFBO1FBQ2pCLCtDQUFPLENBQUE7UUFDUCw2Q0FBTSxDQUFBO1FBQ04saURBQVEsQ0FBQTtRQUNSLDZDQUFNLENBQUE7UUFDTiwyQ0FBSyxDQUFBO0lBQ1AsQ0FBQyxFQVRXLFNBQVMsR0FBVCxpQkFBUyxLQUFULGlCQUFTLFFBU3BCO0lBRUQsSUFBTSxRQUFRLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUVsRztRQUFBO1FBV0EsQ0FBQztRQVZDLHdCQUFRLEdBQVIsVUFBUyxJQUFZO1lBQ25CLElBQU0sT0FBTyxHQUFHLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25DLElBQU0sTUFBTSxHQUFZLEVBQUUsQ0FBQztZQUMzQixJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEMsT0FBTyxLQUFLLElBQUksSUFBSSxFQUFFO2dCQUNwQixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNuQixLQUFLLEdBQUcsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO2FBQzdCO1lBQ0QsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUNILFlBQUM7SUFBRCxDQUFDLEFBWEQsSUFXQztJQVhZLHNCQUFL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UUFBUSxDQUFDLElBQVk7UUFDNUIsUUFBUSxJQUFJLEVBQUU7WUFDWixLQUFLLEtBQUssQ0FBQyxFQUFFO2dCQUNYLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQztZQUNuQixLQUFLLEtBQUssQ0FBQyxFQUFFO2dCQUNYLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQztZQUNuQixLQUFLLEtBQUssQ0FBQyxFQUFFO2dCQUNYLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQztZQUNuQixLQUFLLEtBQUssQ0FBQyxFQUFFO2dCQUNYLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQztZQUNwQixLQUFLLEtBQUssQ0FBQyxFQUFFO2dCQUNYLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQztZQUNyQjtnQkFDRSxPQUFPLElBQUksQ0FBQztTQUNmO0lBQ0gsQ0FBQztJQUVELFNBQVMsaUJBQWlCLENBQUMsSUFBWTtRQUNyQyxJQUFNLE1BQU0sR0FBVyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEMsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsR0FBRyxJQUFJLENBQUMsQ0FBQztTQUNqRTtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi4vY2hhcnMnO1xuXG5leHBvcnQgZW51bSBUb2tlblR5cGUge1xuICBDaGFyYWN0ZXIsXG4gIElkZW50aWZpZXIsXG4gIFByaXZhdGVJZGVudGlmaWVyLFxuICBLZXl3b3JkLFxuICBTdHJpbmcsXG4gIE9wZXJhdG9yLFxuICBOdW1iZXIsXG4gIEVycm9yXG59XG5cbmNvbnN0IEtFWVdPUkRTID0gWyd2YXInLCAnbGV0JywgJ2FzJywgJ251bGwnLCAndW5kZWZpbmVkJywgJ3RydWUnLCAnZmFsc2UnLCAnaWYnLCAnZWxzZScsICd0aGlzJ107XG5cbmV4cG9ydCBjbGFzcyBMZXhlciB7XG4gIHRva2VuaXplKHRleHQ6IHN0cmluZyk6IFRva2VuW10ge1xuICAgIGNvbnN0IHNjYW5uZXIgPSBuZXcgX1NjYW5uZXIodGV4dCk7XG4gICAgY29uc3QgdG9rZW5zOiBUb2tlbltdID0gW107XG4gICAgbGV0IHRva2VuID0gc2Nhbm5lci5zY2FuVG9rZW4oKTtcbiAgICB3aGlsZSAodG9rZW4gIT0gbnVsbCkge1xuICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgdG9rZW4gPSBzY2FubmVyLnNjYW5Ub2tlbigpO1xuICAgIH1cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUb2tlbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGluZGV4OiBudW1iZXIsIHB1YmxpYyBlbmQ6IG51bWJlciwgcHVibGljIHR5cGU6IFRva2VuVHlwZSwgcHVibGljIG51bVZhbHVlOiBudW1iZXIsXG4gICAgICBwdWJsaWMgc3RyVmFsdWU6IHN0cmluZykge31cblxuICBpc0NoYXJhY3Rlcihjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5DaGFyYWN0ZXIgJiYgdGhpcy5udW1WYWx1ZSA9PSBjb2RlO1xuICB9XG5cbiAgaXNOdW1iZXIoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuTnVtYmVyO1xuICB9XG5cbiAgaXNTdHJpbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuU3RyaW5nO1xuICB9XG5cbiAgaXNPcGVyYXRvcihvcGVyYXRvcjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IgJiYgdGhpcy5zdHJWYWx1ZSA9PSBvcGVyYXRvcjtcbiAgfVxuXG4gIGlzSWRlbnRpZmllcigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5JZGVudGlmaWVyO1xuICB9XG5cbiAgaXNQcml2YXRlSWRlbnRpZmllcigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5Qcml2YXRlSWRlbnRpZmllcjtcbiAgfVxuXG4gIGlzS2V5d29yZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5LZXl3b3JkO1xuICB9XG5cbiAgaXNLZXl3b3JkTGV0KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLktleXdvcmQgJiYgdGhpcy5zdHJWYWx1ZSA9PSAnbGV0JztcbiAgfVxuXG4gIGlzS2V5d29yZEFzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLktleXdvcmQgJiYgdGhpcy5zdHJWYWx1ZSA9PSAnYXMnO1xuICB9XG5cbiAgaXNLZXl3b3JkTnVsbCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5LZXl3b3JkICYmIHRoaXMuc3RyVmFsdWUgPT0gJ251bGwnO1xuICB9XG5cbiAgaXNLZXl3b3JkVW5kZWZpbmVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLktleXdvcmQgJiYgdGhpcy5zdHJWYWx1ZSA9PSAndW5kZWZpbmVkJztcbiAgfVxuXG4gIGlzS2V5d29yZFRydWUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuS2V5d29yZCAmJiB0aGlzLnN0clZhbHVlID09ICd0cnVlJztcbiAgfVxuXG4gIGlzS2V5d29yZEZhbHNlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT0gVG9rZW5UeXBlLktleXdvcmQgJiYgdGhpcy5zdHJWYWx1ZSA9PSAnZmFsc2UnO1xuICB9XG5cbiAgaXNLZXl3b3JkVGhpcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5LZXl3b3JkICYmIHRoaXMuc3RyVmFsdWUgPT0gJ3RoaXMnO1xuICB9XG5cbiAgaXNFcnJvcigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09IFRva2VuVHlwZS5FcnJvcjtcbiAgfVxuXG4gIHRvTnVtYmVyKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PSBUb2tlblR5cGUuTnVtYmVyID8gdGhpcy5udW1WYWx1ZSA6IC0xO1xuICB9XG5cbiAgdG9TdHJpbmcoKTogc3RyaW5nfG51bGwge1xuICAgIHN3aXRjaCAodGhpcy50eXBlKSB7XG4gICAgICBjYXNlIFRva2VuVHlwZS5DaGFyYWN0ZXI6XG4gICAgICBjYXNlIFRva2VuVHlwZS5JZGVudGlmaWVyOlxuICAgICAgY2FzZSBUb2tlblR5cGUuS2V5d29yZDpcbiAgICAgIGNhc2UgVG9rZW5UeXBlLk9wZXJhdG9yOlxuICAgICAgY2FzZSBUb2tlblR5cGUuUHJpdmF0ZUlkZW50aWZpZXI6XG4gICAgICBjYXNlIFRva2VuVHlwZS5TdHJpbmc6XG4gICAgICBjYXNlIFRva2VuVHlwZS5FcnJvcjpcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyVmFsdWU7XG4gICAgICBjYXNlIFRva2VuVHlwZS5OdW1iZXI6XG4gICAgICAgIHJldHVybiB0aGlzLm51bVZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbmV3Q2hhcmFjdGVyVG9rZW4oaW5kZXg6IG51bWJlciwgZW5kOiBudW1iZXIsIGNvZGU6IG51bWJlcik6IFRva2VuIHtcbiAgcmV0dXJuIG5ldyBUb2tlbihpbmRleCwgZW5kLCBUb2tlblR5cGUuQ2hhcmFjdGVyLCBjb2RlLCBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpKTtcbn1cblxuZnVuY3Rpb24gbmV3SWRlbnRpZmllclRva2VuKGluZGV4OiBudW1iZXIsIGVuZDogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpOiBUb2tlbiB7XG4gIHJldHVybiBuZXcgVG9rZW4oaW5kZXgsIGVuZCwgVG9rZW5UeXBlLklkZW50aWZpZXIsIDAsIHRleHQpO1xufVxuXG5mdW5jdGlvbiBuZXdQcml2YXRlSWRlbnRpZmllclRva2VuKGluZGV4OiBudW1iZXIsIGVuZDogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpOiBUb2tlbiB7XG4gIHJldHVybiBuZXcgVG9rZW4oaW5kZXgsIGVuZCwgVG9rZW5UeXBlLlByaXZhdGVJZGVudGlmaWVyLCAwLCB0ZXh0KTtcbn1cblxuZnVuY3Rpb24gbmV3S2V5d29yZFRva2VuKGluZGV4OiBudW1iZXIsIGVuZDogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpOiBUb2tlbiB7XG4gIHJldHVybiBuZXcgVG9rZW4oaW5kZXgsIGVuZCwgVG9rZW5UeXBlLktleXdvcmQsIDAsIHRleHQpO1xufVxuXG5mdW5jdGlvbiBuZXdPcGVyYXRvclRva2VuKGluZGV4OiBudW1iZXIsIGVuZDogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpOiBUb2tlbiB7XG4gIHJldHVybiBuZXcgVG9rZW4oaW5kZXgsIGVuZCwgVG9rZW5UeXBlLk9wZXJhdG9yLCAwLCB0ZXh0KTtcbn1cblxuZnVuY3Rpb24gbmV3U3RyaW5nVG9rZW4oaW5kZXg6IG51bWJlciwgZW5kOiBudW1iZXIsIHRleHQ6IHN0cmluZyk6IFRva2VuIHtcbiAgcmV0dXJuIG5ldyBUb2tlbihpbmRleCwgZW5kLCBUb2tlblR5cGUuU3RyaW5nLCAwLCB0ZXh0KTtcbn1cblxuZnVuY3Rpb24gbmV3TnVtYmVyVG9rZW4oaW5kZXg6IG51bWJlciwgZW5kOiBudW1iZXIsIG46IG51bWJlcik6IFRva2VuIHtcbiAgcmV0dXJuIG5ldyBUb2tlbihpbmRleCwgZW5kLCBUb2tlblR5cGUuTnVtYmVyLCBuLCAnJyk7XG59XG5cbmZ1bmN0aW9uIG5ld0Vycm9yVG9rZW4oaW5kZXg6IG51bWJlciwgZW5kOiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZyk6IFRva2VuIHtcbiAgcmV0dXJuIG5ldyBUb2tlbihpbmRleCwgZW5kLCBUb2tlblR5cGUuRXJyb3IsIDAsIG1lc3NhZ2UpO1xufVxuXG5leHBvcnQgY29uc3QgRU9GOiBUb2tlbiA9IG5ldyBUb2tlbigtMSwgLTEsIFRva2VuVHlwZS5DaGFyYWN0ZXIsIDAsICcnKTtcblxuY2xhc3MgX1NjYW5uZXIge1xuICBsZW5ndGg6IG51bWJlcjtcbiAgcGVlazogbnVtYmVyID0gMDtcbiAgaW5kZXg6IG51bWJlciA9IC0xO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBpbnB1dDogc3RyaW5nKSB7XG4gICAgdGhpcy5sZW5ndGggPSBpbnB1dC5sZW5ndGg7XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gIH1cblxuICBhZHZhbmNlKCkge1xuICAgIHRoaXMucGVlayA9ICsrdGhpcy5pbmRleCA+PSB0aGlzLmxlbmd0aCA/IGNoYXJzLiRFT0YgOiB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5pbmRleCk7XG4gIH1cblxuICBzY2FuVG9rZW4oKTogVG9rZW58bnVsbCB7XG4gICAgY29uc3QgaW5wdXQgPSB0aGlzLmlucHV0LCBsZW5ndGggPSB0aGlzLmxlbmd0aDtcbiAgICBsZXQgcGVlayA9IHRoaXMucGVlaywgaW5kZXggPSB0aGlzLmluZGV4O1xuXG4gICAgLy8gU2tpcCB3aGl0ZXNwYWNlLlxuICAgIHdoaWxlIChwZWVrIDw9IGNoYXJzLiRTUEFDRSkge1xuICAgICAgaWYgKCsraW5kZXggPj0gbGVuZ3RoKSB7XG4gICAgICAgIHBlZWsgPSBjaGFycy4kRU9GO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZWsgPSBpbnB1dC5jaGFyQ29kZUF0KGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnBlZWsgPSBwZWVrO1xuICAgIHRoaXMuaW5kZXggPSBpbmRleDtcblxuICAgIGlmIChpbmRleCA+PSBsZW5ndGgpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSBpZGVudGlmaWVycyBhbmQgbnVtYmVycy5cbiAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQocGVlaykpIHJldHVybiB0aGlzLnNjYW5JZGVudGlmaWVyKCk7XG4gICAgaWYgKGNoYXJzLmlzRGlnaXQocGVlaykpIHJldHVybiB0aGlzLnNjYW5OdW1iZXIoaW5kZXgpO1xuXG4gICAgY29uc3Qgc3RhcnQ6IG51bWJlciA9IGluZGV4O1xuICAgIHN3aXRjaCAocGVlaykge1xuICAgICAgY2FzZSBjaGFycy4kUEVSSU9EOlxuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgcmV0dXJuIGNoYXJzLmlzRGlnaXQodGhpcy5wZWVrKSA/IHRoaXMuc2Nhbk51bWJlcihzdGFydCkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q2hhcmFjdGVyVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIGNoYXJzLiRQRVJJT0QpO1xuICAgICAgY2FzZSBjaGFycy4kTFBBUkVOOlxuICAgICAgY2FzZSBjaGFycy4kUlBBUkVOOlxuICAgICAgY2FzZSBjaGFycy4kTEJSQUNFOlxuICAgICAgY2FzZSBjaGFycy4kUkJSQUNFOlxuICAgICAgY2FzZSBjaGFycy4kTEJSQUNLRVQ6XG4gICAgICBjYXNlIGNoYXJzLiRSQlJBQ0tFVDpcbiAgICAgIGNhc2UgY2hhcnMuJENPTU1BOlxuICAgICAgY2FzZSBjaGFycy4kQ09MT046XG4gICAgICBjYXNlIGNoYXJzLiRTRU1JQ09MT046XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5DaGFyYWN0ZXIoc3RhcnQsIHBlZWspO1xuICAgICAgY2FzZSBjaGFycy4kU1E6XG4gICAgICBjYXNlIGNoYXJzLiREUTpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhblN0cmluZygpO1xuICAgICAgY2FzZSBjaGFycy4kSEFTSDpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhblByaXZhdGVJZGVudGlmaWVyKCk7XG4gICAgICBjYXNlIGNoYXJzLiRQTFVTOlxuICAgICAgY2FzZSBjaGFycy4kTUlOVVM6XG4gICAgICBjYXNlIGNoYXJzLiRTVEFSOlxuICAgICAgY2FzZSBjaGFycy4kU0xBU0g6XG4gICAgICBjYXNlIGNoYXJzLiRQRVJDRU5UOlxuICAgICAgY2FzZSBjaGFycy4kQ0FSRVQ6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5PcGVyYXRvcihzdGFydCwgU3RyaW5nLmZyb21DaGFyQ29kZShwZWVrKSk7XG4gICAgICBjYXNlIGNoYXJzLiRRVUVTVElPTjpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhblF1ZXN0aW9uKHN0YXJ0KTtcbiAgICAgIGNhc2UgY2hhcnMuJExUOlxuICAgICAgY2FzZSBjaGFycy4kR1Q6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Db21wbGV4T3BlcmF0b3Ioc3RhcnQsIFN0cmluZy5mcm9tQ2hhckNvZGUocGVlayksIGNoYXJzLiRFUSwgJz0nKTtcbiAgICAgIGNhc2UgY2hhcnMuJEJBTkc6XG4gICAgICBjYXNlIGNoYXJzLiRFUTpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhbkNvbXBsZXhPcGVyYXRvcihcbiAgICAgICAgICAgIHN0YXJ0LCBTdHJpbmcuZnJvbUNoYXJDb2RlKHBlZWspLCBjaGFycy4kRVEsICc9JywgY2hhcnMuJEVRLCAnPScpO1xuICAgICAgY2FzZSBjaGFycy4kQU1QRVJTQU5EOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ29tcGxleE9wZXJhdG9yKHN0YXJ0LCAnJicsIGNoYXJzLiRBTVBFUlNBTkQsICcmJyk7XG4gICAgICBjYXNlIGNoYXJzLiRCQVI6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Db21wbGV4T3BlcmF0b3Ioc3RhcnQsICd8JywgY2hhcnMuJEJBUiwgJ3wnKTtcbiAgICAgIGNhc2UgY2hhcnMuJE5CU1A6XG4gICAgICAgIHdoaWxlIChjaGFycy5pc1doaXRlc3BhY2UodGhpcy5wZWVrKSkgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Ub2tlbigpO1xuICAgIH1cblxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIGNoYXJhY3RlciBbJHtTdHJpbmcuZnJvbUNoYXJDb2RlKHBlZWspfV1gLCAwKTtcbiAgfVxuXG4gIHNjYW5DaGFyYWN0ZXIoc3RhcnQ6IG51bWJlciwgY29kZTogbnVtYmVyKTogVG9rZW4ge1xuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuZXdDaGFyYWN0ZXJUb2tlbihzdGFydCwgdGhpcy5pbmRleCwgY29kZSk7XG4gIH1cblxuXG4gIHNjYW5PcGVyYXRvcihzdGFydDogbnVtYmVyLCBzdHI6IHN0cmluZyk6IFRva2VuIHtcbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbmV3T3BlcmF0b3JUb2tlbihzdGFydCwgdGhpcy5pbmRleCwgc3RyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUb2tlbml6ZSBhIDIvMyBjaGFyIGxvbmcgb3BlcmF0b3JcbiAgICpcbiAgICogQHBhcmFtIHN0YXJ0IHN0YXJ0IGluZGV4IGluIHRoZSBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBvbmUgZmlyc3Qgc3ltYm9sIChhbHdheXMgcGFydCBvZiB0aGUgb3BlcmF0b3IpXG4gICAqIEBwYXJhbSB0d29Db2RlIGNvZGUgcG9pbnQgZm9yIHRoZSBzZWNvbmQgc3ltYm9sXG4gICAqIEBwYXJhbSB0d28gc2Vjb25kIHN5bWJvbCAocGFydCBvZiB0aGUgb3BlcmF0b3Igd2hlbiB0aGUgc2Vjb25kIGNvZGUgcG9pbnQgbWF0Y2hlcylcbiAgICogQHBhcmFtIHRocmVlQ29kZSBjb2RlIHBvaW50IGZvciB0aGUgdGhpcmQgc3ltYm9sXG4gICAqIEBwYXJhbSB0aHJlZSB0aGlyZCBzeW1ib2wgKHBhcnQgb2YgdGhlIG9wZXJhdG9yIHdoZW4gcHJvdmlkZWQgYW5kIG1hdGNoZXMgc291cmNlIGV4cHJlc3Npb24pXG4gICAqL1xuICBzY2FuQ29tcGxleE9wZXJhdG9yKFxuICAgICAgc3RhcnQ6IG51bWJlciwgb25lOiBzdHJpbmcsIHR3b0NvZGU6IG51bWJlciwgdHdvOiBzdHJpbmcsIHRocmVlQ29kZT86IG51bWJlcixcbiAgICAgIHRocmVlPzogc3RyaW5nKTogVG9rZW4ge1xuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIGxldCBzdHI6IHN0cmluZyA9IG9uZTtcbiAgICBpZiAodGhpcy5wZWVrID09IHR3b0NvZGUpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgc3RyICs9IHR3bztcbiAgICB9XG4gICAgaWYgKHRocmVlQ29kZSAhPSBudWxsICYmIHRoaXMucGVlayA9PSB0aHJlZUNvZGUpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgc3RyICs9IHRocmVlO1xuICAgIH1cbiAgICByZXR1cm4gbmV3T3BlcmF0b3JUb2tlbihzdGFydCwgdGhpcy5pbmRleCwgc3RyKTtcbiAgfVxuXG4gIHNjYW5JZGVudGlmaWVyKCk6IFRva2VuIHtcbiAgICBjb25zdCBzdGFydDogbnVtYmVyID0gdGhpcy5pbmRleDtcbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICB3aGlsZSAoaXNJZGVudGlmaWVyUGFydCh0aGlzLnBlZWspKSB0aGlzLmFkdmFuY2UoKTtcbiAgICBjb25zdCBzdHI6IHN0cmluZyA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmluZGV4KTtcbiAgICByZXR1cm4gS0VZV09SRFMuaW5kZXhPZihzdHIpID4gLTEgPyBuZXdLZXl3b3JkVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIHN0cikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0lkZW50aWZpZXJUb2tlbihzdGFydCwgdGhpcy5pbmRleCwgc3RyKTtcbiAgfVxuXG4gIC8qKiBTY2FucyBhbiBFQ01BU2NyaXB0IHByaXZhdGUgaWRlbnRpZmllci4gKi9cbiAgc2NhblByaXZhdGVJZGVudGlmaWVyKCk6IFRva2VuIHtcbiAgICBjb25zdCBzdGFydDogbnVtYmVyID0gdGhpcy5pbmRleDtcbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICBpZiAoIWlzSWRlbnRpZmllclN0YXJ0KHRoaXMucGVlaykpIHtcbiAgICAgIHJldHVybiB0aGlzLmVycm9yKCdJbnZhbGlkIGNoYXJhY3RlciBbI10nLCAtMSk7XG4gICAgfVxuICAgIHdoaWxlIChpc0lkZW50aWZpZXJQYXJ0KHRoaXMucGVlaykpIHRoaXMuYWR2YW5jZSgpO1xuICAgIGNvbnN0IGlkZW50aWZpZXJOYW1lOiBzdHJpbmcgPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgdGhpcy5pbmRleCk7XG4gICAgcmV0dXJuIG5ld1ByaXZhdGVJZGVudGlmaWVyVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIGlkZW50aWZpZXJOYW1lKTtcbiAgfVxuXG4gIHNjYW5OdW1iZXIoc3RhcnQ6IG51bWJlcik6IFRva2VuIHtcbiAgICBsZXQgc2ltcGxlOiBib29sZWFuID0gKHRoaXMuaW5kZXggPT09IHN0YXJ0KTtcbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIFNraXAgaW5pdGlhbCBkaWdpdC5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKGNoYXJzLmlzRGlnaXQodGhpcy5wZWVrKSkge1xuICAgICAgICAvLyBEbyBub3RoaW5nLlxuICAgICAgfSBlbHNlIGlmICh0aGlzLnBlZWsgPT0gY2hhcnMuJFBFUklPRCkge1xuICAgICAgICBzaW1wbGUgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoaXNFeHBvbmVudFN0YXJ0KHRoaXMucGVlaykpIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIGlmIChpc0V4cG9uZW50U2lnbih0aGlzLnBlZWspKSB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgaWYgKCFjaGFycy5pc0RpZ2l0KHRoaXMucGVlaykpIHJldHVybiB0aGlzLmVycm9yKCdJbnZhbGlkIGV4cG9uZW50JywgLTEpO1xuICAgICAgICBzaW1wbGUgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgfVxuICAgIGNvbnN0IHN0cjogc3RyaW5nID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIHRoaXMuaW5kZXgpO1xuICAgIGNvbnN0IHZhbHVlOiBudW1iZXIgPSBzaW1wbGUgPyBwYXJzZUludEF1dG9SYWRpeChzdHIpIDogcGFyc2VGbG9hdChzdHIpO1xuICAgIHJldHVybiBuZXdOdW1iZXJUb2tlbihzdGFydCwgdGhpcy5pbmRleCwgdmFsdWUpO1xuICB9XG5cbiAgc2NhblN0cmluZygpOiBUb2tlbiB7XG4gICAgY29uc3Qgc3RhcnQ6IG51bWJlciA9IHRoaXMuaW5kZXg7XG4gICAgY29uc3QgcXVvdGU6IG51bWJlciA9IHRoaXMucGVlaztcbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIFNraXAgaW5pdGlhbCBxdW90ZS5cblxuICAgIGxldCBidWZmZXI6IHN0cmluZyA9ICcnO1xuICAgIGxldCBtYXJrZXI6IG51bWJlciA9IHRoaXMuaW5kZXg7XG4gICAgY29uc3QgaW5wdXQ6IHN0cmluZyA9IHRoaXMuaW5wdXQ7XG5cbiAgICB3aGlsZSAodGhpcy5wZWVrICE9IHF1b3RlKSB7XG4gICAgICBpZiAodGhpcy5wZWVrID09IGNoYXJzLiRCQUNLU0xBU0gpIHtcbiAgICAgICAgYnVmZmVyICs9IGlucHV0LnN1YnN0cmluZyhtYXJrZXIsIHRoaXMuaW5kZXgpO1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgbGV0IHVuZXNjYXBlZENvZGU6IG51bWJlcjtcbiAgICAgICAgLy8gV29ya2Fyb3VuZCBmb3IgVFMyLjEtaW50cm9kdWNlZCB0eXBlIHN0cmljdG5lc3NcbiAgICAgICAgdGhpcy5wZWVrID0gdGhpcy5wZWVrO1xuICAgICAgICBpZiAodGhpcy5wZWVrID09IGNoYXJzLiR1KSB7XG4gICAgICAgICAgLy8gNCBjaGFyYWN0ZXIgaGV4IGNvZGUgZm9yIHVuaWNvZGUgY2hhcmFjdGVyLlxuICAgICAgICAgIGNvbnN0IGhleDogc3RyaW5nID0gaW5wdXQuc3Vic3RyaW5nKHRoaXMuaW5kZXggKyAxLCB0aGlzLmluZGV4ICsgNSk7XG4gICAgICAgICAgaWYgKC9eWzAtOWEtZl0rJC9pLnRlc3QoaGV4KSkge1xuICAgICAgICAgICAgdW5lc2NhcGVkQ29kZSA9IHBhcnNlSW50KGhleCwgMTYpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5lcnJvcihgSW52YWxpZCB1bmljb2RlIGVzY2FwZSBbXFxcXHUke2hleH1dYCwgMCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciAobGV0IGk6IG51bWJlciA9IDA7IGkgPCA1OyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1bmVzY2FwZWRDb2RlID0gdW5lc2NhcGUodGhpcy5wZWVrKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgfVxuICAgICAgICBidWZmZXIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh1bmVzY2FwZWRDb2RlKTtcbiAgICAgICAgbWFya2VyID0gdGhpcy5pbmRleDtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5wZWVrID09IGNoYXJzLiRFT0YpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3IoJ1VudGVybWluYXRlZCBxdW90ZScsIDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbGFzdDogc3RyaW5nID0gaW5wdXQuc3Vic3RyaW5nKG1hcmtlciwgdGhpcy5pbmRleCk7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBTa2lwIHRlcm1pbmF0aW5nIHF1b3RlLlxuXG4gICAgcmV0dXJuIG5ld1N0cmluZ1Rva2VuKHN0YXJ0LCB0aGlzLmluZGV4LCBidWZmZXIgKyBsYXN0KTtcbiAgfVxuXG4gIHNjYW5RdWVzdGlvbihzdGFydDogbnVtYmVyKTogVG9rZW4ge1xuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIGxldCBzdHI6IHN0cmluZyA9ICc/JztcbiAgICAvLyBFaXRoZXIgYGEgPz8gYmAgb3IgJ2E/LmInLlxuICAgIGlmICh0aGlzLnBlZWsgPT09IGNoYXJzLiRRVUVTVElPTiB8fCB0aGlzLnBlZWsgPT09IGNoYXJzLiRQRVJJT0QpIHtcbiAgICAgIHN0ciArPSB0aGlzLnBlZWsgPT09IGNoYXJzLiRQRVJJT0QgPyAnLicgOiAnPyc7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld09wZXJhdG9yVG9rZW4oc3RhcnQsIHRoaXMuaW5kZXgsIHN0cik7XG4gIH1cblxuICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyKTogVG9rZW4ge1xuICAgIGNvbnN0IHBvc2l0aW9uOiBudW1iZXIgPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHJldHVybiBuZXdFcnJvclRva2VuKFxuICAgICAgICBwb3NpdGlvbiwgdGhpcy5pbmRleCxcbiAgICAgICAgYExleGVyIEVycm9yOiAke21lc3NhZ2V9IGF0IGNvbHVtbiAke3Bvc2l0aW9ufSBpbiBleHByZXNzaW9uIFske3RoaXMuaW5wdXR9XWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzSWRlbnRpZmllclN0YXJ0KGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKGNoYXJzLiRhIDw9IGNvZGUgJiYgY29kZSA8PSBjaGFycy4keikgfHwgKGNoYXJzLiRBIDw9IGNvZGUgJiYgY29kZSA8PSBjaGFycy4kWikgfHxcbiAgICAgIChjb2RlID09IGNoYXJzLiRfKSB8fCAoY29kZSA9PSBjaGFycy4kJCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0lkZW50aWZpZXIoaW5wdXQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAoaW5wdXQubGVuZ3RoID09IDApIHJldHVybiBmYWxzZTtcbiAgY29uc3Qgc2Nhbm5lciA9IG5ldyBfU2Nhbm5lcihpbnB1dCk7XG4gIGlmICghaXNJZGVudGlmaWVyU3RhcnQoc2Nhbm5lci5wZWVrKSkgcmV0dXJuIGZhbHNlO1xuICBzY2FubmVyLmFkdmFuY2UoKTtcbiAgd2hpbGUgKHNjYW5uZXIucGVlayAhPT0gY2hhcnMuJEVPRikge1xuICAgIGlmICghaXNJZGVudGlmaWVyUGFydChzY2FubmVyLnBlZWspKSByZXR1cm4gZmFsc2U7XG4gICAgc2Nhbm5lci5hZHZhbmNlKCk7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGlzSWRlbnRpZmllclBhcnQoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjaGFycy5pc0FzY2lpTGV0dGVyKGNvZGUpIHx8IGNoYXJzLmlzRGlnaXQoY29kZSkgfHwgKGNvZGUgPT0gY2hhcnMuJF8pIHx8XG4gICAgICAoY29kZSA9PSBjaGFycy4kJCk7XG59XG5cbmZ1bmN0aW9uIGlzRXhwb25lbnRTdGFydChjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvZGUgPT0gY2hhcnMuJGUgfHwgY29kZSA9PSBjaGFycy4kRTtcbn1cblxuZnVuY3Rpb24gaXNFeHBvbmVudFNpZ24oY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID09IGNoYXJzLiRNSU5VUyB8fCBjb2RlID09IGNoYXJzLiRQTFVTO1xufVxuXG5mdW5jdGlvbiB1bmVzY2FwZShjb2RlOiBudW1iZXIpOiBudW1iZXIge1xuICBzd2l0Y2ggKGNvZGUpIHtcbiAgICBjYXNlIGNoYXJzLiRuOlxuICAgICAgcmV0dXJuIGNoYXJzLiRMRjtcbiAgICBjYXNlIGNoYXJzLiRmOlxuICAgICAgcmV0dXJuIGNoYXJzLiRGRjtcbiAgICBjYXNlIGNoYXJzLiRyOlxuICAgICAgcmV0dXJuIGNoYXJzLiRDUjtcbiAgICBjYXNlIGNoYXJzLiR0OlxuICAgICAgcmV0dXJuIGNoYXJzLiRUQUI7XG4gICAgY2FzZSBjaGFycy4kdjpcbiAgICAgIHJldHVybiBjaGFycy4kVlRBQjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvZGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VJbnRBdXRvUmFkaXgodGV4dDogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgcmVzdWx0OiBudW1iZXIgPSBwYXJzZUludCh0ZXh0KTtcbiAgaWYgKGlzTmFOKHJlc3VsdCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW50ZWdlciBsaXRlcmFsIHdoZW4gcGFyc2luZyAnICsgdGV4dCk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==