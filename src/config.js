/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InjectionToken, ViewEncapsulation, isDevMode } from '@angular/core';
import { Identifiers, createIdentifier } from './identifiers';
/**
 * Temporal switch for the compiler to use the new view engine,
 * until it is fully integrated.
 *
 * Only works in Jit for now.
 */
export var /** @type {?} */ USE_VIEW_ENGINE = new InjectionToken('UseViewEngine');
var CompilerConfig = (function () {
    /**
     * @param {?=} __0
     */
    function CompilerConfig(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.renderTypes, renderTypes = _c === void 0 ? new DefaultRenderTypes() : _c, _d = _b.defaultEncapsulation, defaultEncapsulation = _d === void 0 ? ViewEncapsulation.Emulated : _d, genDebugInfo = _b.genDebugInfo, logBindingUpdate = _b.logBindingUpdate, _e = _b.useJit, useJit = _e === void 0 ? true : _e, missingTranslation = _b.missingTranslation, useViewEngine = _b.useViewEngine;
        this.renderTypes = renderTypes;
        this.defaultEncapsulation = defaultEncapsulation;
        this._genDebugInfo = genDebugInfo;
        this._logBindingUpdate = logBindingUpdate;
        this.useJit = useJit;
        this.missingTranslation = missingTranslation;
        this.useViewEngine = useViewEngine;
    }
    Object.defineProperty(CompilerConfig.prototype, "genDebugInfo", {
        /**
         * @return {?}
         */
        get: function () {
            return this._genDebugInfo === void 0 ? isDevMode() : this._genDebugInfo;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CompilerConfig.prototype, "logBindingUpdate", {
        /**
         * @return {?}
         */
        get: function () {
            return this._logBindingUpdate === void 0 ? isDevMode() : this._logBindingUpdate;
        },
        enumerable: true,
        configurable: true
    });
    return CompilerConfig;
}());
export { CompilerConfig };
function CompilerConfig_tsickle_Closure_declarations() {
    /** @type {?} */
    CompilerConfig.prototype.renderTypes;
    /** @type {?} */
    CompilerConfig.prototype.defaultEncapsulation;
    /** @type {?} */
    CompilerConfig.prototype._genDebugInfo;
    /** @type {?} */
    CompilerConfig.prototype._logBindingUpdate;
    /** @type {?} */
    CompilerConfig.prototype.useJit;
    /** @type {?} */
    CompilerConfig.prototype.useViewEngine;
    /** @type {?} */
    CompilerConfig.prototype.missingTranslation;
}
/**
 * Types used for the renderer.
 * Can be replaced to specialize the generated output to a specific renderer
 * to help tree shaking.
 * @abstract
 */
var RenderTypes = (function () {
    function RenderTypes() {
    }
    /**
     * @abstract
     * @return {?}
     */
    RenderTypes.prototype.renderer = function () { };
    /**
     * @abstract
     * @return {?}
     */
    RenderTypes.prototype.renderText = function () { };
    /**
     * @abstract
     * @return {?}
     */
    RenderTypes.prototype.renderElement = function () { };
    /**
     * @abstract
     * @return {?}
     */
    RenderTypes.prototype.renderComment = function () { };
    /**
     * @abstract
     * @return {?}
     */
    RenderTypes.prototype.renderNode = function () { };
    /**
     * @abstract
     * @return {?}
     */
    RenderTypes.prototype.renderEvent = function () { };
    return RenderTypes;
}());
export { RenderTypes };
var DefaultRenderTypes = (function () {
    function DefaultRenderTypes() {
        this.renderText = null;
        this.renderElement = null;
        this.renderComment = null;
        this.renderNode = null;
        this.renderEvent = null;
    }
    Object.defineProperty(DefaultRenderTypes.prototype, "renderer", {
        /**
         * @return {?}
         */
        get: function () { return createIdentifier(Identifiers.Renderer); },
        enumerable: true,
        configurable: true
    });
    ;
    return DefaultRenderTypes;
}());
export { DefaultRenderTypes };
function DefaultRenderTypes_tsickle_Closure_declarations() {
    /** @type {?} */
    DefaultRenderTypes.prototype.renderText;
    /** @type {?} */
    DefaultRenderTypes.prototype.renderElement;
    /** @type {?} */
    DefaultRenderTypes.prototype.renderComment;
    /** @type {?} */
    DefaultRenderTypes.prototype.renderNode;
    /** @type {?} */
    DefaultRenderTypes.prototype.renderEvent;
}
//# sourceMappingURL=config.js.map