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
        define("@angular/compiler/src/chars", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isOctalDigit = exports.isNewLine = exports.isAsciiHexDigit = exports.isAsciiLetter = exports.isDigit = exports.isWhitespace = exports.$BT = exports.$AT = exports.$TILDA = exports.$PIPE = exports.$NBSP = exports.$RBRACE = exports.$BAR = exports.$LBRACE = exports.$z = exports.$x = exports.$v = exports.$u = exports.$t = exports.$r = exports.$n = exports.$f = exports.$e = exports.$b = exports.$a = exports.$_ = exports.$CARET = exports.$RBRACKET = exports.$BACKSLASH = exports.$LBRACKET = exports.$Z = exports.$X = exports.$F = exports.$E = exports.$A = exports.$9 = exports.$7 = exports.$0 = exports.$QUESTION = exports.$GT = exports.$EQ = exports.$LT = exports.$SEMICOLON = exports.$COLON = exports.$SLASH = exports.$PERIOD = exports.$MINUS = exports.$COMMA = exports.$PLUS = exports.$STAR = exports.$RPAREN = exports.$LPAREN = exports.$SQ = exports.$AMPERSAND = exports.$PERCENT = exports.$$ = exports.$HASH = exports.$DQ = exports.$BANG = exports.$SPACE = exports.$CR = exports.$FF = exports.$VTAB = exports.$LF = exports.$TAB = exports.$BSPACE = exports.$EOF = void 0;
    exports.$EOF = 0;
    exports.$BSPACE = 8;
    exports.$TAB = 9;
    exports.$LF = 10;
    exports.$VTAB = 11;
    exports.$FF = 12;
    exports.$CR = 13;
    exports.$SPACE = 32;
    exports.$BANG = 33;
    exports.$DQ = 34;
    exports.$HASH = 35;
    exports.$$ = 36;
    exports.$PERCENT = 37;
    exports.$AMPERSAND = 38;
    exports.$SQ = 39;
    exports.$LPAREN = 40;
    exports.$RPAREN = 41;
    exports.$STAR = 42;
    exports.$PLUS = 43;
    exports.$COMMA = 44;
    exports.$MINUS = 45;
    exports.$PERIOD = 46;
    exports.$SLASH = 47;
    exports.$COLON = 58;
    exports.$SEMICOLON = 59;
    exports.$LT = 60;
    exports.$EQ = 61;
    exports.$GT = 62;
    exports.$QUESTION = 63;
    exports.$0 = 48;
    exports.$7 = 55;
    exports.$9 = 57;
    exports.$A = 65;
    exports.$E = 69;
    exports.$F = 70;
    exports.$X = 88;
    exports.$Z = 90;
    exports.$LBRACKET = 91;
    exports.$BACKSLASH = 92;
    exports.$RBRACKET = 93;
    exports.$CARET = 94;
    exports.$_ = 95;
    exports.$a = 97;
    exports.$b = 98;
    exports.$e = 101;
    exports.$f = 102;
    exports.$n = 110;
    exports.$r = 114;
    exports.$t = 116;
    exports.$u = 117;
    exports.$v = 118;
    exports.$x = 120;
    exports.$z = 122;
    exports.$LBRACE = 123;
    exports.$BAR = 124;
    exports.$RBRACE = 125;
    exports.$NBSP = 160;
    exports.$PIPE = 124;
    exports.$TILDA = 126;
    exports.$AT = 64;
    exports.$BT = 96;
    function isWhitespace(code) {
        return (code >= exports.$TAB && code <= exports.$SPACE) || (code == exports.$NBSP);
    }
    exports.isWhitespace = isWhitespace;
    function isDigit(code) {
        return exports.$0 <= code && code <= exports.$9;
    }
    exports.isDigit = isDigit;
    function isAsciiLetter(code) {
        return code >= exports.$a && code <= exports.$z || code >= exports.$A && code <= exports.$Z;
    }
    exports.isAsciiLetter = isAsciiLetter;
    function isAsciiHexDigit(code) {
        return code >= exports.$a && code <= exports.$f || code >= exports.$A && code <= exports.$F || isDigit(code);
    }
    exports.isAsciiHexDigit = isAsciiHexDigit;
    function isNewLine(code) {
        return code === exports.$LF || code === exports.$CR;
    }
    exports.isNewLine = isNewLine;
    function isOctalDigit(code) {
        return exports.$0 <= code && code <= exports.$7;
    }
    exports.isOctalDigit = isOctalDigit;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY2hhcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRVUsUUFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ1QsUUFBQSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBQ1osUUFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ1QsUUFBQSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ1QsUUFBQSxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ1gsUUFBQSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ1QsUUFBQSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ1QsUUFBQSxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ1osUUFBQSxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ1gsUUFBQSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ1QsUUFBQSxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ1gsUUFBQSxFQUFFLEdBQUcsRUFBRSxDQUFDO0lBQ1IsUUFBQSxRQUFRLEdBQUcsRUFBRSxDQUFDO0lBQ2QsUUFBQSxVQUFVLEdBQUcsRUFBRSxDQUFDO0lBQ2hCLFFBQUEsR0FBRyxHQUFHLEVBQUUsQ0FBQztJQUNULFFBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQztJQUNiLFFBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQztJQUNiLFFBQUEsS0FBSyxHQUFHLEVBQUUsQ0FBQztJQUNYLFFBQUEsS0FBSyxHQUFHLEVBQUUsQ0FBQztJQUNYLFFBQUEsTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFFBQUEsTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFFBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQztJQUNiLFFBQUEsTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFFBQUEsTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFFBQUEsVUFBVSxHQUFHLEVBQUUsQ0FBQztJQUNoQixRQUFBLEdBQUcsR0FBRyxFQUFFLENBQUM7SUFDVCxRQUFBLEdBQUcsR0FBRyxFQUFFLENBQUM7SUFDVCxRQUFBLEdBQUcsR0FBRyxFQUFFLENBQUM7SUFDVCxRQUFBLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFFZixRQUFBLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDUixRQUFBLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDUixRQUFBLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFFUixRQUFBLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDUixRQUFBLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDUixRQUFBLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDUixRQUFBLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDUixRQUFBLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFFUixRQUFBLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDZixRQUFBLFVBQVUsR0FBRyxFQUFFLENBQUM7SUFDaEIsUUFBQSxTQUFTLEdBQUcsRUFBRSxDQUFDO0lBQ2YsUUFBQSxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ1osUUFBQSxFQUFFLEdBQUcsRUFBRSxDQUFDO0lBRVIsUUFBQSxFQUFFLEdBQUcsRUFBRSxDQUFDO0lBQ1IsUUFBQSxFQUFFLEdBQUcsRUFBRSxDQUFDO0lBQ1IsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ1QsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ1QsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ1QsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ1QsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ1QsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ1QsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ1QsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ1QsUUFBQSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBRVQsUUFBQSxPQUFPLEdBQUcsR0FBRyxDQUFDO0lBQ2QsUUFBQSxJQUFJLEdBQUcsR0FBRyxDQUFDO0lBQ1gsUUFBQSxPQUFPLEdBQUcsR0FBRyxDQUFDO0lBQ2QsUUFBQSxLQUFLLEdBQUcsR0FBRyxDQUFDO0lBRVosUUFBQSxLQUFLLEdBQUcsR0FBRyxDQUFDO0lBQ1osUUFBQSxNQUFNLEdBQUcsR0FBRyxDQUFDO0lBQ2IsUUFBQSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBRVQsUUFBQSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBRXRCLFNBQWdCLFlBQVksQ0FBQyxJQUFZO1FBQ3ZDLE9BQU8sQ0FBQyxJQUFJLElBQUksWUFBSSxJQUFJLElBQUksSUFBSSxjQUFNLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxhQUFLLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRkQsb0NBRUM7SUFFRCxTQUFnQixPQUFPLENBQUMsSUFBWTtRQUNsQyxPQUFPLFVBQUUsSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLFVBQUUsQ0FBQztJQUNsQyxDQUFDO0lBRkQsMEJBRUM7SUFFRCxTQUFnQixhQUFhLENBQUMsSUFBWTtRQUN4QyxPQUFPLElBQUksSUFBSSxVQUFFLElBQUksSUFBSSxJQUFJLFVBQUUsSUFBSSxJQUFJLElBQUksVUFBRSxJQUFJLElBQUksSUFBSSxVQUFFLENBQUM7SUFDOUQsQ0FBQztJQUZELHNDQUVDO0lBRUQsU0FBZ0IsZUFBZSxDQUFDLElBQVk7UUFDMUMsT0FBTyxJQUFJLElBQUksVUFBRSxJQUFJLElBQUksSUFBSSxVQUFFLElBQUksSUFBSSxJQUFJLFVBQUUsSUFBSSxJQUFJLElBQUksVUFBRSxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRkQsMENBRUM7SUFFRCxTQUFnQixTQUFTLENBQUMsSUFBWTtRQUNwQyxPQUFPLElBQUksS0FBSyxXQUFHLElBQUksSUFBSSxLQUFLLFdBQUcsQ0FBQztJQUN0QyxDQUFDO0lBRkQsOEJBRUM7SUFFRCxTQUFnQixZQUFZLENBQUMsSUFBWTtRQUN2QyxPQUFPLFVBQUUsSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLFVBQUUsQ0FBQztJQUNsQyxDQUFDO0lBRkQsb0NBRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuZXhwb3J0IGNvbnN0ICRFT0YgPSAwO1xuZXhwb3J0IGNvbnN0ICRCU1BBQ0UgPSA4O1xuZXhwb3J0IGNvbnN0ICRUQUIgPSA5O1xuZXhwb3J0IGNvbnN0ICRMRiA9IDEwO1xuZXhwb3J0IGNvbnN0ICRWVEFCID0gMTE7XG5leHBvcnQgY29uc3QgJEZGID0gMTI7XG5leHBvcnQgY29uc3QgJENSID0gMTM7XG5leHBvcnQgY29uc3QgJFNQQUNFID0gMzI7XG5leHBvcnQgY29uc3QgJEJBTkcgPSAzMztcbmV4cG9ydCBjb25zdCAkRFEgPSAzNDtcbmV4cG9ydCBjb25zdCAkSEFTSCA9IDM1O1xuZXhwb3J0IGNvbnN0ICQkID0gMzY7XG5leHBvcnQgY29uc3QgJFBFUkNFTlQgPSAzNztcbmV4cG9ydCBjb25zdCAkQU1QRVJTQU5EID0gMzg7XG5leHBvcnQgY29uc3QgJFNRID0gMzk7XG5leHBvcnQgY29uc3QgJExQQVJFTiA9IDQwO1xuZXhwb3J0IGNvbnN0ICRSUEFSRU4gPSA0MTtcbmV4cG9ydCBjb25zdCAkU1RBUiA9IDQyO1xuZXhwb3J0IGNvbnN0ICRQTFVTID0gNDM7XG5leHBvcnQgY29uc3QgJENPTU1BID0gNDQ7XG5leHBvcnQgY29uc3QgJE1JTlVTID0gNDU7XG5leHBvcnQgY29uc3QgJFBFUklPRCA9IDQ2O1xuZXhwb3J0IGNvbnN0ICRTTEFTSCA9IDQ3O1xuZXhwb3J0IGNvbnN0ICRDT0xPTiA9IDU4O1xuZXhwb3J0IGNvbnN0ICRTRU1JQ09MT04gPSA1OTtcbmV4cG9ydCBjb25zdCAkTFQgPSA2MDtcbmV4cG9ydCBjb25zdCAkRVEgPSA2MTtcbmV4cG9ydCBjb25zdCAkR1QgPSA2MjtcbmV4cG9ydCBjb25zdCAkUVVFU1RJT04gPSA2MztcblxuZXhwb3J0IGNvbnN0ICQwID0gNDg7XG5leHBvcnQgY29uc3QgJDcgPSA1NTtcbmV4cG9ydCBjb25zdCAkOSA9IDU3O1xuXG5leHBvcnQgY29uc3QgJEEgPSA2NTtcbmV4cG9ydCBjb25zdCAkRSA9IDY5O1xuZXhwb3J0IGNvbnN0ICRGID0gNzA7XG5leHBvcnQgY29uc3QgJFggPSA4ODtcbmV4cG9ydCBjb25zdCAkWiA9IDkwO1xuXG5leHBvcnQgY29uc3QgJExCUkFDS0VUID0gOTE7XG5leHBvcnQgY29uc3QgJEJBQ0tTTEFTSCA9IDkyO1xuZXhwb3J0IGNvbnN0ICRSQlJBQ0tFVCA9IDkzO1xuZXhwb3J0IGNvbnN0ICRDQVJFVCA9IDk0O1xuZXhwb3J0IGNvbnN0ICRfID0gOTU7XG5cbmV4cG9ydCBjb25zdCAkYSA9IDk3O1xuZXhwb3J0IGNvbnN0ICRiID0gOTg7XG5leHBvcnQgY29uc3QgJGUgPSAxMDE7XG5leHBvcnQgY29uc3QgJGYgPSAxMDI7XG5leHBvcnQgY29uc3QgJG4gPSAxMTA7XG5leHBvcnQgY29uc3QgJHIgPSAxMTQ7XG5leHBvcnQgY29uc3QgJHQgPSAxMTY7XG5leHBvcnQgY29uc3QgJHUgPSAxMTc7XG5leHBvcnQgY29uc3QgJHYgPSAxMTg7XG5leHBvcnQgY29uc3QgJHggPSAxMjA7XG5leHBvcnQgY29uc3QgJHogPSAxMjI7XG5cbmV4cG9ydCBjb25zdCAkTEJSQUNFID0gMTIzO1xuZXhwb3J0IGNvbnN0ICRCQVIgPSAxMjQ7XG5leHBvcnQgY29uc3QgJFJCUkFDRSA9IDEyNTtcbmV4cG9ydCBjb25zdCAkTkJTUCA9IDE2MDtcblxuZXhwb3J0IGNvbnN0ICRQSVBFID0gMTI0O1xuZXhwb3J0IGNvbnN0ICRUSUxEQSA9IDEyNjtcbmV4cG9ydCBjb25zdCAkQVQgPSA2NDtcblxuZXhwb3J0IGNvbnN0ICRCVCA9IDk2O1xuXG5leHBvcnQgZnVuY3Rpb24gaXNXaGl0ZXNwYWNlKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKGNvZGUgPj0gJFRBQiAmJiBjb2RlIDw9ICRTUEFDRSkgfHwgKGNvZGUgPT0gJE5CU1ApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNEaWdpdChjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuICQwIDw9IGNvZGUgJiYgY29kZSA8PSAkOTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQXNjaWlMZXR0ZXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb2RlID49ICRhICYmIGNvZGUgPD0gJHogfHwgY29kZSA+PSAkQSAmJiBjb2RlIDw9ICRaO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNBc2NpaUhleERpZ2l0KGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29kZSA+PSAkYSAmJiBjb2RlIDw9ICRmIHx8IGNvZGUgPj0gJEEgJiYgY29kZSA8PSAkRiB8fCBpc0RpZ2l0KGNvZGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOZXdMaW5lKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gY29kZSA9PT0gJExGIHx8IGNvZGUgPT09ICRDUjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzT2N0YWxEaWdpdChjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuICQwIDw9IGNvZGUgJiYgY29kZSA8PSAkNztcbn1cbiJdfQ==