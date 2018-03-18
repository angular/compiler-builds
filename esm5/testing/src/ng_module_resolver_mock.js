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
import * as tslib_1 from "tslib";
import { NgModuleResolver } from '@angular/compiler';
var MockNgModuleResolver = /** @class */ (function (_super) {
    tslib_1.__extends(MockNgModuleResolver, _super);
    function MockNgModuleResolver(reflector) {
        var _this = _super.call(this, reflector) || this;
        _this._ngModules = new Map();
        return _this;
    }
    /**
     * Overrides the {@link NgModule} for a module.
     */
    /**
     * Overrides the {\@link NgModule} for a module.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    MockNgModuleResolver.prototype.setNgModule = /**
     * Overrides the {\@link NgModule} for a module.
     * @param {?} type
     * @param {?} metadata
     * @return {?}
     */
    function (type, metadata) {
        this._ngModules.set(type, metadata);
    };
    /**
     * Returns the {@link NgModule} for a module:
     * - Set the {@link NgModule} to the overridden view when it exists or fallback to the
     * default
     * `NgModuleResolver`, see `setNgModule`.
     */
    /**
     * Returns the {\@link NgModule} for a module:
     * - Set the {\@link NgModule} to the overridden view when it exists or fallback to the
     * default
     * `NgModuleResolver`, see `setNgModule`.
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    MockNgModuleResolver.prototype.resolve = /**
     * Returns the {\@link NgModule} for a module:
     * - Set the {\@link NgModule} to the overridden view when it exists or fallback to the
     * default
     * `NgModuleResolver`, see `setNgModule`.
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    function (type, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        return this._ngModules.get(type) || /** @type {?} */ ((_super.prototype.resolve.call(this, type, throwIfNotFound)));
    };
    return MockNgModuleResolver;
}(NgModuleResolver));
export { MockNgModuleResolver };
function MockNgModuleResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    MockNgModuleResolver.prototype._ngModules;
}
//# sourceMappingURL=ng_module_resolver_mock.js.map