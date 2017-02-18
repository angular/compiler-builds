/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InjectionToken, ViewEncapsulation, isDevMode } from '@angular/core/index';
import { Identifiers, createIdentifier } from './identifiers';
/**
 * Temporal switch for the compiler to use the new view engine,
 * until it is fully integrated.
 *
 * Only works in Jit for now.
 */
export const /** @type {?} */ USE_VIEW_ENGINE = new InjectionToken('UseViewEngine');
export class CompilerConfig {
    /**
     * @param {?=} __0
     */
    constructor({ renderTypes = new DefaultRenderTypes(), defaultEncapsulation = ViewEncapsulation.Emulated, genDebugInfo, logBindingUpdate, useJit = true, missingTranslation, useViewEngine } = {}) {
        this.renderTypes = renderTypes;
        this.defaultEncapsulation = defaultEncapsulation;
        this._genDebugInfo = genDebugInfo;
        this._logBindingUpdate = logBindingUpdate;
        this.useJit = useJit;
        this.missingTranslation = missingTranslation;
        this.useViewEngine = useViewEngine;
    }
    /**
     * @return {?}
     */
    get genDebugInfo() {
        return this._genDebugInfo === void 0 ? isDevMode() : this._genDebugInfo;
    }
    /**
     * @return {?}
     */
    get logBindingUpdate() {
        return this._logBindingUpdate === void 0 ? isDevMode() : this._logBindingUpdate;
    }
}
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
export class RenderTypes {
    /**
     * @abstract
     * @return {?}
     */
    renderer() { }
    /**
     * @abstract
     * @return {?}
     */
    renderText() { }
    /**
     * @abstract
     * @return {?}
     */
    renderElement() { }
    /**
     * @abstract
     * @return {?}
     */
    renderComment() { }
    /**
     * @abstract
     * @return {?}
     */
    renderNode() { }
    /**
     * @abstract
     * @return {?}
     */
    renderEvent() { }
}
export class DefaultRenderTypes {
    constructor() {
        this.renderText = null;
        this.renderElement = null;
        this.renderComment = null;
        this.renderNode = null;
        this.renderEvent = null;
    }
    /**
     * @return {?}
     */
    get renderer() { return createIdentifier(Identifiers.Renderer); }
    ;
}
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