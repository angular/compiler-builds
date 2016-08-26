/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var core_1 = require('@angular/core');
var identifiers_1 = require('./identifiers');
function unimplemented() {
    throw new Error('unimplemented');
}
var CompilerConfig = (function () {
    function CompilerConfig(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.renderTypes, renderTypes = _c === void 0 ? new DefaultRenderTypes() : _c, _d = _b.defaultEncapsulation, defaultEncapsulation = _d === void 0 ? core_1.ViewEncapsulation.Emulated : _d, genDebugInfo = _b.genDebugInfo, logBindingUpdate = _b.logBindingUpdate, _e = _b.useJit, useJit = _e === void 0 ? true : _e;
        this.renderTypes = renderTypes;
        this.defaultEncapsulation = defaultEncapsulation;
        this._genDebugInfo = genDebugInfo;
        this._logBindingUpdate = logBindingUpdate;
        this.useJit = useJit;
    }
    Object.defineProperty(CompilerConfig.prototype, "genDebugInfo", {
        get: function () {
            return this._genDebugInfo === void 0 ? core_1.isDevMode() : this._genDebugInfo;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CompilerConfig.prototype, "logBindingUpdate", {
        get: function () {
            return this._logBindingUpdate === void 0 ? core_1.isDevMode() : this._logBindingUpdate;
        },
        enumerable: true,
        configurable: true
    });
    return CompilerConfig;
}());
exports.CompilerConfig = CompilerConfig;
/**
 * Types used for the renderer.
 * Can be replaced to specialize the generated output to a specific renderer
 * to help tree shaking.
 */
var RenderTypes = (function () {
    function RenderTypes() {
    }
    Object.defineProperty(RenderTypes.prototype, "renderer", {
        get: function () { return unimplemented(); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RenderTypes.prototype, "renderText", {
        get: function () { return unimplemented(); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RenderTypes.prototype, "renderElement", {
        get: function () { return unimplemented(); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RenderTypes.prototype, "renderComment", {
        get: function () { return unimplemented(); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RenderTypes.prototype, "renderNode", {
        get: function () { return unimplemented(); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RenderTypes.prototype, "renderEvent", {
        get: function () { return unimplemented(); },
        enumerable: true,
        configurable: true
    });
    return RenderTypes;
}());
exports.RenderTypes = RenderTypes;
var DefaultRenderTypes = (function () {
    function DefaultRenderTypes() {
        this.renderer = identifiers_1.Identifiers.Renderer;
        this.renderText = null;
        this.renderElement = null;
        this.renderComment = null;
        this.renderNode = null;
        this.renderEvent = null;
    }
    return DefaultRenderTypes;
}());
exports.DefaultRenderTypes = DefaultRenderTypes;
//# sourceMappingURL=config.js.map