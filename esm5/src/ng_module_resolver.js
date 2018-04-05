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
import { createNgModule } from './core';
import { findLast } from './directive_resolver';
import { stringify } from './util';
/**
 * Resolves types to {\@link NgModule}.
 */
var /**
 * Resolves types to {\@link NgModule}.
 */
NgModuleResolver = /** @class */ (function () {
    function NgModuleResolver(_reflector) {
        this._reflector = _reflector;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    NgModuleResolver.prototype.isNgModule = /**
     * @param {?} type
     * @return {?}
     */
    function (type) { return this._reflector.annotations(type).some(createNgModule.isTypeOf); };
    /**
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    NgModuleResolver.prototype.resolve = /**
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    function (type, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        var /** @type {?} */ ngModuleMeta = findLast(this._reflector.annotations(type), createNgModule.isTypeOf);
        if (ngModuleMeta) {
            return ngModuleMeta;
        }
        else {
            if (throwIfNotFound) {
                throw new Error("No NgModule metadata found for '" + stringify(type) + "'.");
            }
            return null;
        }
    };
    return NgModuleResolver;
}());
/**
 * Resolves types to {\@link NgModule}.
 */
export { NgModuleResolver };
function NgModuleResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    NgModuleResolver.prototype._reflector;
}
//# sourceMappingURL=ng_module_resolver.js.map