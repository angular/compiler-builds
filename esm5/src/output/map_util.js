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
import * as o from './output_ast';
/**
 * @param {?} key
 * @param {?} value
 * @return {?}
 */
export function mapEntry(key, value) {
    return { key: key, value: value, quoted: false };
}
/**
 * @param {?} obj
 * @return {?}
 */
export function mapLiteral(obj) {
    return o.literalMap(Object.keys(obj).map(function (key) {
        return ({
            key: key,
            quoted: false,
            value: obj[key],
        });
    }));
}
//# sourceMappingURL=map_util.js.map