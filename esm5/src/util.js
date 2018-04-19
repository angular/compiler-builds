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
var /** @type {?} */ DASH_CASE_REGEXP = /-+([a-z0-9])/g;
/**
 * @param {?} input
 * @return {?}
 */
export function dashCaseToCamelCase(input) {
    return input.replace(DASH_CASE_REGEXP, function () {
        var m = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            m[_i] = arguments[_i];
        }
        return m[1].toUpperCase();
    });
}
/**
 * @param {?} input
 * @param {?} defaultValues
 * @return {?}
 */
export function splitAtColon(input, defaultValues) {
    return _splitAt(input, ':', defaultValues);
}
/**
 * @param {?} input
 * @param {?} defaultValues
 * @return {?}
 */
export function splitAtPeriod(input, defaultValues) {
    return _splitAt(input, '.', defaultValues);
}
/**
 * @param {?} input
 * @param {?} character
 * @param {?} defaultValues
 * @return {?}
 */
function _splitAt(input, character, defaultValues) {
    var /** @type {?} */ characterIndex = input.indexOf(character);
    if (characterIndex == -1)
        return defaultValues;
    return [input.slice(0, characterIndex).trim(), input.slice(characterIndex + 1).trim()];
}
/**
 * @param {?} value
 * @param {?} visitor
 * @param {?} context
 * @return {?}
 */
export function visitValue(value, visitor, context) {
    if (Array.isArray(value)) {
        return visitor.visitArray(/** @type {?} */ (value), context);
    }
    if (isStrictStringMap(value)) {
        return visitor.visitStringMap(/** @type {?} */ (value), context);
    }
    if (value == null || typeof value == 'string' || typeof value == 'number' ||
        typeof value == 'boolean') {
        return visitor.visitPrimitive(value, context);
    }
    return visitor.visitOther(value, context);
}
/**
 * @param {?} val
 * @return {?}
 */
export function isDefined(val) {
    return val !== null && val !== undefined;
}
/**
 * @template T
 * @param {?} val
 * @return {?}
 */
export function noUndefined(val) {
    return val === undefined ? /** @type {?} */ ((null)) : val;
}
/**
 * @record
 */
export function ValueVisitor() { }
function ValueVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    ValueVisitor.prototype.visitArray;
    /** @type {?} */
    ValueVisitor.prototype.visitStringMap;
    /** @type {?} */
    ValueVisitor.prototype.visitPrimitive;
    /** @type {?} */
    ValueVisitor.prototype.visitOther;
}
var ValueTransformer = /** @class */ (function () {
    function ValueTransformer() {
    }
    /**
     * @param {?} arr
     * @param {?} context
     * @return {?}
     */
    ValueTransformer.prototype.visitArray = /**
     * @param {?} arr
     * @param {?} context
     * @return {?}
     */
    function (arr, context) {
        var _this = this;
        return arr.map(function (value) { return visitValue(value, _this, context); });
    };
    /**
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    ValueTransformer.prototype.visitStringMap = /**
     * @param {?} map
     * @param {?} context
     * @return {?}
     */
    function (map, context) {
        var _this = this;
        var /** @type {?} */ result = {};
        Object.keys(map).forEach(function (key) { result[key] = visitValue(map[key], _this, context); });
        return result;
    };
    /**
     * @param {?} value
     * @param {?} context
     * @return {?}
     */
    ValueTransformer.prototype.visitPrimitive = /**
     * @param {?} value
     * @param {?} context
     * @return {?}
     */
    function (value, context) { return value; };
    /**
     * @param {?} value
     * @param {?} context
     * @return {?}
     */
    ValueTransformer.prototype.visitOther = /**
     * @param {?} value
     * @param {?} context
     * @return {?}
     */
    function (value, context) { return value; };
    return ValueTransformer;
}());
export { ValueTransformer };
export var /** @type {?} */ SyncAsync = {
    assertSync: function (value) {
        if (isPromise(value)) {
            throw new Error("Illegal state: value cannot be a promise");
        }
        return value;
    },
    then: function (value, cb) { return isPromise(value) ? value.then(cb) : cb(value); },
    all: function (syncAsyncValues) {
        return syncAsyncValues.some(isPromise) ? Promise.all(syncAsyncValues) : /** @type {?} */ (syncAsyncValues);
    }
};
/**
 * @param {?} msg
 * @return {?}
 */
export function error(msg) {
    throw new Error("Internal Error: " + msg);
}
/**
 * @param {?} msg
 * @param {?=} parseErrors
 * @return {?}
 */
export function syntaxError(msg, parseErrors) {
    var /** @type {?} */ error = Error(msg);
    (/** @type {?} */ (error))[ERROR_SYNTAX_ERROR] = true;
    if (parseErrors)
        (/** @type {?} */ (error))[ERROR_PARSE_ERRORS] = parseErrors;
    return error;
}
var /** @type {?} */ ERROR_SYNTAX_ERROR = 'ngSyntaxError';
var /** @type {?} */ ERROR_PARSE_ERRORS = 'ngParseErrors';
/**
 * @param {?} error
 * @return {?}
 */
export function isSyntaxError(error) {
    return (/** @type {?} */ (error))[ERROR_SYNTAX_ERROR];
}
/**
 * @param {?} error
 * @return {?}
 */
export function getParseErrors(error) {
    return (/** @type {?} */ (error))[ERROR_PARSE_ERRORS] || [];
}
/**
 * @param {?} s
 * @return {?}
 */
export function escapeRegExp(s) {
    return s.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
}
var /** @type {?} */ STRING_MAP_PROTO = Object.getPrototypeOf({});
/**
 * @param {?} obj
 * @return {?}
 */
function isStrictStringMap(obj) {
    return typeof obj === 'object' && obj !== null && Object.getPrototypeOf(obj) === STRING_MAP_PROTO;
}
/**
 * @param {?} str
 * @return {?}
 */
export function utf8Encode(str) {
    var /** @type {?} */ encoded = '';
    for (var /** @type {?} */ index = 0; index < str.length; index++) {
        var /** @type {?} */ codePoint = str.charCodeAt(index);
        // decode surrogate
        // see https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
        if (codePoint >= 0xd800 && codePoint <= 0xdbff && str.length > (index + 1)) {
            var /** @type {?} */ low = str.charCodeAt(index + 1);
            if (low >= 0xdc00 && low <= 0xdfff) {
                index++;
                codePoint = ((codePoint - 0xd800) << 10) + low - 0xdc00 + 0x10000;
            }
        }
        if (codePoint <= 0x7f) {
            encoded += String.fromCharCode(codePoint);
        }
        else if (codePoint <= 0x7ff) {
            encoded += String.fromCharCode(((codePoint >> 6) & 0x1F) | 0xc0, (codePoint & 0x3f) | 0x80);
        }
        else if (codePoint <= 0xffff) {
            encoded += String.fromCharCode((codePoint >> 12) | 0xe0, ((codePoint >> 6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
        }
        else if (codePoint <= 0x1fffff) {
            encoded += String.fromCharCode(((codePoint >> 18) & 0x07) | 0xf0, ((codePoint >> 12) & 0x3f) | 0x80, ((codePoint >> 6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
        }
    }
    return encoded;
}
/**
 * @record
 */
export function OutputContext() { }
function OutputContext_tsickle_Closure_declarations() {
    /** @type {?} */
    OutputContext.prototype.genFilePath;
    /** @type {?} */
    OutputContext.prototype.statements;
    /** @type {?} */
    OutputContext.prototype.constantPool;
    /** @type {?} */
    OutputContext.prototype.importExpr;
}
/**
 * @param {?} token
 * @return {?}
 */
export function stringify(token) {
    if (typeof token === 'string') {
        return token;
    }
    if (token instanceof Array) {
        return '[' + token.map(stringify).join(', ') + ']';
    }
    if (token == null) {
        return '' + token;
    }
    if (token.overriddenName) {
        return "" + token.overriddenName;
    }
    if (token.name) {
        return "" + token.name;
    }
    // WARNING: do not try to `JSON.stringify(token)` here
    // see https://github.com/angular/angular/issues/23440
    var /** @type {?} */ res = token.toString();
    if (res == null) {
        return '' + res;
    }
    var /** @type {?} */ newLineIndex = res.indexOf('\n');
    return newLineIndex === -1 ? res : res.substring(0, newLineIndex);
}
/**
 * Lazily retrieves the reference value from a forwardRef.
 * @param {?} type
 * @return {?}
 */
export function resolveForwardRef(type) {
    if (typeof type === 'function' && type.hasOwnProperty('__forward_ref__')) {
        return type();
    }
    else {
        return type;
    }
}
/**
 * Determine if the argument is shaped like a Promise
 * @param {?} obj
 * @return {?}
 */
export function isPromise(obj) {
    // allow any Promise/A+ compliant thenable.
    // It's up to the caller to ensure that obj.then conforms to the spec
    return !!obj && typeof obj.then === 'function';
}
var Version = /** @class */ (function () {
    function Version(full) {
        this.full = full;
        var /** @type {?} */ splits = full.split('.');
        this.major = splits[0];
        this.minor = splits[1];
        this.patch = splits.slice(2).join('.');
    }
    return Version;
}());
export { Version };
function Version_tsickle_Closure_declarations() {
    /** @type {?} */
    Version.prototype.major;
    /** @type {?} */
    Version.prototype.minor;
    /** @type {?} */
    Version.prototype.patch;
    /** @type {?} */
    Version.prototype.full;
}
/**
 * @record
 */
export function Console() { }
function Console_tsickle_Closure_declarations() {
    /** @type {?} */
    Console.prototype.log;
    /** @type {?} */
    Console.prototype.warn;
}
//# sourceMappingURL=util.js.map