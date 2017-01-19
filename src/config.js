/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ViewEncapsulation, isDevMode } from '@angular/core/index';
import { Identifiers, createIdentifier } from './identifiers';
/**
 * @return {?}
 */
function unimplemented() {
    throw new Error('unimplemented');
}
export class CompilerConfig {
    /**
     * @param {?=} __0
     */
    constructor({ renderTypes = new DefaultRenderTypes(), defaultEncapsulation = ViewEncapsulation.Emulated, genDebugInfo, logBindingUpdate, useJit = true } = {}) {
        this.renderTypes = renderTypes;
        this.defaultEncapsulation = defaultEncapsulation;
        this._genDebugInfo = genDebugInfo;
        this._logBindingUpdate = logBindingUpdate;
        this.useJit = useJit;
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
}
/**
 * Types used for the renderer.
 * Can be replaced to specialize the generated output to a specific renderer
 * to help tree shaking.
 * @abstract
 */
export class RenderTypes {
    /**
     * @return {?}
     */
    get renderer() { return unimplemented(); }
    /**
     * @return {?}
     */
    get renderText() { return unimplemented(); }
    /**
     * @return {?}
     */
    get renderElement() { return unimplemented(); }
    /**
     * @return {?}
     */
    get renderComment() { return unimplemented(); }
    /**
     * @return {?}
     */
    get renderNode() { return unimplemented(); }
    /**
     * @return {?}
     */
    get renderEvent() { return unimplemented(); }
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