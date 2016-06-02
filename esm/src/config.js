import { isBlank } from '../src/facade/lang';
import { unimplemented } from '../src/facade/exceptions';
import { Identifiers } from './identifiers';
import { ViewEncapsulation } from '@angular/core';
export class CompilerConfig {
    constructor(genDebugInfo, logBindingUpdate, useJit, renderTypes = null, defaultEncapsulation = null) {
        this.genDebugInfo = genDebugInfo;
        this.logBindingUpdate = logBindingUpdate;
        this.useJit = useJit;
        if (isBlank(renderTypes)) {
            renderTypes = new DefaultRenderTypes();
        }
        this.renderTypes = renderTypes;
        if (isBlank(defaultEncapsulation)) {
            defaultEncapsulation = ViewEncapsulation.Emulated;
        }
        this.defaultEncapsulation = defaultEncapsulation;
    }
}
/**
 * Types used for the renderer.
 * Can be replaced to specialize the generated output to a specific renderer
 * to help tree shaking.
 */
export class RenderTypes {
    get renderer() { return unimplemented(); }
    get renderText() { return unimplemented(); }
    get renderElement() { return unimplemented(); }
    get renderComment() { return unimplemented(); }
    get renderNode() { return unimplemented(); }
    get renderEvent() { return unimplemented(); }
}
export class DefaultRenderTypes {
    constructor() {
        this.renderer = Identifiers.Renderer;
        this.renderText = null;
        this.renderElement = null;
        this.renderComment = null;
        this.renderNode = null;
        this.renderEvent = null;
    }
}
//# sourceMappingURL=config.js.map