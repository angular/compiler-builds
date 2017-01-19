/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ReflectionCapabilities, reflector } from '../private_import_core';
export class StaticAndDynamicReflectionCapabilities {
    /**
     * @param {?} staticDelegate
     */
    constructor(staticDelegate) {
        this.staticDelegate = staticDelegate;
        this.dynamicDelegate = new ReflectionCapabilities();
    }
    /**
     * @param {?} staticDelegate
     * @return {?}
     */
    static install(staticDelegate) {
        reflector.updateCapabilities(new StaticAndDynamicReflectionCapabilities(staticDelegate));
    }
    /**
     * @return {?}
     */
    isReflectionEnabled() { return true; }
    /**
     * @param {?} type
     * @return {?}
     */
    factory(type) { return this.dynamicDelegate.factory(type); }
    /**
     * @param {?} type
     * @param {?} lcProperty
     * @return {?}
     */
    hasLifecycleHook(type, lcProperty) {
        return isStaticType(type) ? this.staticDelegate.hasLifecycleHook(type, lcProperty) :
            this.dynamicDelegate.hasLifecycleHook(type, lcProperty);
    }
    /**
     * @param {?} type
     * @return {?}
     */
    parameters(type) {
        return isStaticType(type) ? this.staticDelegate.parameters(type) :
            this.dynamicDelegate.parameters(type);
    }
    /**
     * @param {?} type
     * @return {?}
     */
    annotations(type) {
        return isStaticType(type) ? this.staticDelegate.annotations(type) :
            this.dynamicDelegate.annotations(type);
    }
    /**
     * @param {?} typeOrFunc
     * @return {?}
     */
    propMetadata(typeOrFunc) {
        return isStaticType(typeOrFunc) ? this.staticDelegate.propMetadata(typeOrFunc) :
            this.dynamicDelegate.propMetadata(typeOrFunc);
    }
    /**
     * @param {?} name
     * @return {?}
     */
    getter(name) { return this.dynamicDelegate.getter(name); }
    /**
     * @param {?} name
     * @return {?}
     */
    setter(name) { return this.dynamicDelegate.setter(name); }
    /**
     * @param {?} name
     * @return {?}
     */
    method(name) { return this.dynamicDelegate.method(name); }
    /**
     * @param {?} type
     * @return {?}
     */
    importUri(type) { return this.staticDelegate.importUri(type); }
    /**
     * @param {?} name
     * @param {?} moduleUrl
     * @param {?} runtime
     * @return {?}
     */
    resolveIdentifier(name, moduleUrl, runtime) {
        return this.staticDelegate.resolveIdentifier(name, moduleUrl);
    }
    /**
     * @param {?} enumIdentifier
     * @param {?} name
     * @return {?}
     */
    resolveEnum(enumIdentifier, name) {
        if (isStaticType(enumIdentifier)) {
            return this.staticDelegate.resolveEnum(enumIdentifier, name);
        }
        else {
            return null;
        }
    }
}
function StaticAndDynamicReflectionCapabilities_tsickle_Closure_declarations() {
    /** @type {?} */
    StaticAndDynamicReflectionCapabilities.prototype.dynamicDelegate;
    /** @type {?} */
    StaticAndDynamicReflectionCapabilities.prototype.staticDelegate;
}
/**
 * @param {?} type
 * @return {?}
 */
function isStaticType(type) {
    return typeof type === 'object' && type.name && type.filePath;
}
//# sourceMappingURL=static_reflection_capabilities.js.map