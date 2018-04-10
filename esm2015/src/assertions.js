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
        throw new Error(`Expected '${identifier}' to be an array of strings.`);
    }
    for (let /** @type {?} */ i = 0; i < value.length; i += 1) {
        if (typeof value[i] !== 'string') {
            throw new Error(`Expected '${identifier}' to be an array of strings.`);
        }
    }
}
const /** @type {?} */ INTERPOLATION_BLACKLIST_REGEXPS = [
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
        throw new Error(`Expected '${identifier}' to be an array, [start, end].`);
    }
    else if (value != null) {
        const /** @type {?} */ start = /** @type {?} */ (value[0]);
        const /** @type {?} */ end = /** @type {?} */ (value[1]);
        // black list checking
        INTERPOLATION_BLACKLIST_REGEXPS.forEach(regexp => {
            if (regexp.test(start) || regexp.test(end)) {
                throw new Error(`['${start}', '${end}'] contains unusable interpolation symbol.`);
            }
        });
    }
}
//# sourceMappingURL=assertions.js.map