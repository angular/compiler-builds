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
import { visitValue } from '../util';
import * as o from './output_ast';
export const /** @type {?} */ QUOTED_KEYS = '$quoted$';
/**
 * @param {?} ctx
 * @param {?} value
 * @param {?=} type
 * @return {?}
 */
export function convertValueToOutputAst(ctx, value, type = null) {
    return visitValue(value, new _ValueOutputAstTransformer(ctx), type);
}
class _ValueOutputAstTransformer {
    /**
     * @param {?} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * @param {?} arr
     * @param {?} type
     * @return {?}
     */
    visitArray(arr, type) {
        return o.literalArr(arr.map(value => visitValue(value, this, null)), type);
    }
    /**
     * @param {?} map
     * @param {?} type
     * @return {?}
     */
    visitStringMap(map, type) {
        const /** @type {?} */ entries = [];
        const /** @type {?} */ quotedSet = new Set(map && map[QUOTED_KEYS]);
        Object.keys(map).forEach(key => {
            entries.push(new o.LiteralMapEntry(key, visitValue(map[key], this, null), quotedSet.has(key)));
        });
        return new o.LiteralMapExpr(entries, type);
    }
    /**
     * @param {?} value
     * @param {?} type
     * @return {?}
     */
    visitPrimitive(value, type) { return o.literal(value, type); }
    /**
     * @param {?} value
     * @param {?} type
     * @return {?}
     */
    visitOther(value, type) {
        if (value instanceof o.Expression) {
            return value;
        }
        else {
            return this.ctx.importExpr(value);
        }
    }
}
function _ValueOutputAstTransformer_tsickle_Closure_declarations() {
    /** @type {?} */
    _ValueOutputAstTransformer.prototype.ctx;
}
//# sourceMappingURL=value_util.js.map