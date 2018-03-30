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
export const /** @type {?} */ $EOF = 0;
export const /** @type {?} */ $TAB = 9;
export const /** @type {?} */ $LF = 10;
export const /** @type {?} */ $VTAB = 11;
export const /** @type {?} */ $FF = 12;
export const /** @type {?} */ $CR = 13;
export const /** @type {?} */ $SPACE = 32;
export const /** @type {?} */ $BANG = 33;
export const /** @type {?} */ $DQ = 34;
export const /** @type {?} */ $HASH = 35;
export const /** @type {?} */ $$ = 36;
export const /** @type {?} */ $PERCENT = 37;
export const /** @type {?} */ $AMPERSAND = 38;
export const /** @type {?} */ $SQ = 39;
export const /** @type {?} */ $LPAREN = 40;
export const /** @type {?} */ $RPAREN = 41;
export const /** @type {?} */ $STAR = 42;
export const /** @type {?} */ $PLUS = 43;
export const /** @type {?} */ $COMMA = 44;
export const /** @type {?} */ $MINUS = 45;
export const /** @type {?} */ $PERIOD = 46;
export const /** @type {?} */ $SLASH = 47;
export const /** @type {?} */ $COLON = 58;
export const /** @type {?} */ $SEMICOLON = 59;
export const /** @type {?} */ $LT = 60;
export const /** @type {?} */ $EQ = 61;
export const /** @type {?} */ $GT = 62;
export const /** @type {?} */ $QUESTION = 63;
export const /** @type {?} */ $0 = 48;
export const /** @type {?} */ $9 = 57;
export const /** @type {?} */ $A = 65;
export const /** @type {?} */ $E = 69;
export const /** @type {?} */ $F = 70;
export const /** @type {?} */ $X = 88;
export const /** @type {?} */ $Z = 90;
export const /** @type {?} */ $LBRACKET = 91;
export const /** @type {?} */ $BACKSLASH = 92;
export const /** @type {?} */ $RBRACKET = 93;
export const /** @type {?} */ $CARET = 94;
export const /** @type {?} */ $_ = 95;
export const /** @type {?} */ $a = 97;
export const /** @type {?} */ $e = 101;
export const /** @type {?} */ $f = 102;
export const /** @type {?} */ $n = 110;
export const /** @type {?} */ $r = 114;
export const /** @type {?} */ $t = 116;
export const /** @type {?} */ $u = 117;
export const /** @type {?} */ $v = 118;
export const /** @type {?} */ $x = 120;
export const /** @type {?} */ $z = 122;
export const /** @type {?} */ $LBRACE = 123;
export const /** @type {?} */ $BAR = 124;
export const /** @type {?} */ $RBRACE = 125;
export const /** @type {?} */ $NBSP = 160;
export const /** @type {?} */ $PIPE = 124;
export const /** @type {?} */ $TILDA = 126;
export const /** @type {?} */ $AT = 64;
export const /** @type {?} */ $BT = 96;
/**
 * @param {?} code
 * @return {?}
 */
export function isWhitespace(code) {
    return (code >= $TAB && code <= $SPACE) || (code == $NBSP);
}
/**
 * @param {?} code
 * @return {?}
 */
export function isDigit(code) {
    return $0 <= code && code <= $9;
}
/**
 * @param {?} code
 * @return {?}
 */
export function isAsciiLetter(code) {
    return code >= $a && code <= $z || code >= $A && code <= $Z;
}
/**
 * @param {?} code
 * @return {?}
 */
export function isAsciiHexDigit(code) {
    return code >= $a && code <= $f || code >= $A && code <= $F || isDigit(code);
}
//# sourceMappingURL=chars.js.map