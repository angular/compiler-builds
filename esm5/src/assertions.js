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
/**
 * @param {?} identifier
 * @param {?} value
 * @return {?}
 */
export function assertArrayOfStrings(identifier, value) {
    if (value == null) {
        return;
    }
    if (!Array.isArray(value)) {
        throw new Error("Expected '" + identifier + "' to be an array of strings.");
    }
    for (var /** @type {?} */ i = 0; i < value.length; i += 1) {
        if (typeof value[i] !== 'string') {
            throw new Error("Expected '" + identifier + "' to be an array of strings.");
        }
    }
}
var /** @type {?} */ INTERPOLATION_BLACKLIST_REGEXPS = [
    /^\s*$/,
    /[<>]/,
    /^[{}]$/,
    /&(#|[a-z])/i,
    /^\/\//,
];
/**
 * @param {?} identifier
 * @param {?} value
 * @return {?}
 */
export function assertInterpolationSymbols(identifier, value) {
    if (value != null && !(Array.isArray(value) && value.length == 2)) {
        throw new Error("Expected '" + identifier + "' to be an array, [start, end].");
    }
    else if (value != null) {
        var /** @type {?} */ start_1 = /** @type {?} */ (value[0]);
        var /** @type {?} */ end_1 = /** @type {?} */ (value[1]);
        // black list checking
        INTERPOLATION_BLACKLIST_REGEXPS.forEach(function (regexp) {
            if (regexp.test(start_1) || regexp.test(end_1)) {
                throw new Error("['" + start_1 + "', '" + end_1 + "'] contains unusable interpolation symbol.");
            }
        });
    }
}
//# sourceMappingURL=assertions.js.map