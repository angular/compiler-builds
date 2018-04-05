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
 * Provides access to reflection data about symbols that the compiler needs.
 * @abstract
 */
export class CompileReflector {
}
function CompileReflector_tsickle_Closure_declarations() {
    /**
     * @abstract
     * @param {?} typeOrFunc
     * @return {?}
     */
    CompileReflector.prototype.parameters = function (typeOrFunc) { };
    /**
     * @abstract
     * @param {?} typeOrFunc
     * @return {?}
     */
    CompileReflector.prototype.annotations = function (typeOrFunc) { };
    /**
     * @abstract
     * @param {?} typeOrFunc
     * @return {?}
     */
    CompileReflector.prototype.shallowAnnotations = function (typeOrFunc) { };
    /**
     * @abstract
     * @param {?} typeOrFunc
     * @return {?}
     */
    CompileReflector.prototype.tryAnnotations = function (typeOrFunc) { };
    /**
     * @abstract
     * @param {?} typeOrFunc
     * @return {?}
     */
    CompileReflector.prototype.propMetadata = function (typeOrFunc) { };
    /**
     * @abstract
     * @param {?} type
     * @param {?} lcProperty
     * @return {?}
     */
    CompileReflector.prototype.hasLifecycleHook = function (type, lcProperty) { };
    /**
     * @abstract
     * @param {?} typeOrFunc
     * @return {?}
     */
    CompileReflector.prototype.guards = function (typeOrFunc) { };
    /**
     * @abstract
     * @param {?} type
     * @param {?} cmpMetadata
     * @return {?}
     */
    CompileReflector.prototype.componentModuleUrl = function (type, cmpMetadata) { };
    /**
     * @abstract
     * @param {?} ref
     * @return {?}
     */
    CompileReflector.prototype.resolveExternalReference = function (ref) { };
}
//# sourceMappingURL=compile_reflector.js.map