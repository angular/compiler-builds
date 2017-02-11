/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { NgModuleResolver } from '@angular/compiler';
import { Compiler, Injectable, Injector } from '@angular/core';
export class MockNgModuleResolver extends NgModuleResolver {
    constructor(_injector) {
        super();
        this._injector = _injector;
        this._ngModules = new Map();
    }
    /**
     * Overrides the {@link NgModule} for a module.
     */
    setNgModule(type, metadata) {
        this._ngModules.set(type, metadata);
        this._clearCacheFor(type);
    }
    /**
     * Returns the {@link NgModule} for a module:
     * - Set the {@link NgModule} to the overridden view when it exists or fallback to the
     * default
     * `NgModuleResolver`, see `setNgModule`.
     */
    resolve(type, throwIfNotFound = true) {
        return this._ngModules.get(type) || super.resolve(type, throwIfNotFound);
    }
    get _compiler() { return this._injector.get(Compiler); }
    _clearCacheFor(component) { this._compiler.clearCacheFor(component); }
}
MockNgModuleResolver.decorators = [
    { type: Injectable },
];
/** @nocollapse */
MockNgModuleResolver.ctorParameters = () => [
    { type: Injector, },
];
//# sourceMappingURL=ng_module_resolver_mock.js.map