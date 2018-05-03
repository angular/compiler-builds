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
export var /** @type {?} */ QUOTED_KEYS = '$quoted$';
/**
 * @param {?} ctx
 * @param {?} value
 * @param {?=} type
 * @return {?}
 */
export function convertValueToOutputAst(ctx, value, type) {
    if (type === void 0) { type = null; }
    return visitValue(value, new _ValueOutputAstTransformer(ctx), type);
}
var _ValueOutputAstTransformer = /** @class */ (function () {
    function _ValueOutputAstTransformer(ctx) {
        this.ctx = ctx;
    }
    /**
     * @param {?} arr
     * @param {?} type
     * @return {?}
     */
    _ValueOutputAstTransformer.prototype.visitArray = /**
     * @param {?} arr
     * @param {?} type
     * @return {?}
     */
    function (arr, type) {
        var _this = this;
        return o.literalArr(arr.map(function (value) { return visitValue(value, _this, null); }), type);
    };
    /**
     * @param {?} map
     * @param {?} type
     * @return {?}
     */
    _ValueOutputAstTransformer.prototype.visitStringMap = /**
     * @param {?} map
     * @param {?} type
     * @return {?}
     */
    function (map, type) {
        var _this = this;
        var /** @type {?} */ entries = [];
        var /** @type {?} */ quotedSet = new Set(map && map[QUOTED_KEYS]);
        Object.keys(map).forEach(function (key) {
            entries.push(new o.LiteralMapEntry(key, visitValue(map[key], _this, null), quotedSet.has(key)));
        });
        return new o.LiteralMapExpr(entries, type);
    };
    /**
     * @param {?} value
     * @param {?} type
     * @return {?}
     */
    _ValueOutputAstTransformer.prototype.visitPrimitive = /**
     * @param {?} value
     * @param {?} type
     * @return {?}
     */
    function (value, type) { return o.literal(value, type); };
    /**
     * @param {?} value
     * @param {?} type
     * @return {?}
     */
    _ValueOutputAstTransformer.prototype.visitOther = /**
     * @param {?} value
     * @param {?} type
     * @return {?}
     */
    function (value, type) {
        if (value instanceof o.Expression) {
            return value;
        }
        else {
            return this.ctx.importExpr(value);
        }
    };
    return _ValueOutputAstTransformer;
}());
function _ValueOutputAstTransformer_tsickle_Closure_declarations() {
    /** @type {?} */
    _ValueOutputAstTransformer.prototype.ctx;
}
//# sourceMappingURL=value_util.js.map