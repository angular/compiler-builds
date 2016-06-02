import { CompileIdentifierMetadata } from './compile_metadata';
import { ViewEncapsulation } from '@angular/core';
export declare class CompilerConfig {
    genDebugInfo: boolean;
    logBindingUpdate: boolean;
    useJit: boolean;
    renderTypes: RenderTypes;
    defaultEncapsulation: ViewEncapsulation;
    constructor(genDebugInfo: boolean, logBindingUpdate: boolean, useJit: boolean, renderTypes?: RenderTypes, defaultEncapsulation?: ViewEncapsulation);
}
/**
 * Types used for the renderer.
 * Can be replaced to specialize the generated output to a specific renderer
 * to help tree shaking.
 */
export declare abstract class RenderTypes {
    renderer: CompileIdentifierMetadata;
    renderText: CompileIdentifierMetadata;
    renderElement: CompileIdentifierMetadata;
    renderComment: CompileIdentifierMetadata;
    renderNode: CompileIdentifierMetadata;
    renderEvent: CompileIdentifierMetadata;
}
export declare class DefaultRenderTypes implements RenderTypes {
    renderer: CompileIdentifierMetadata;
    renderText: any;
    renderElement: any;
    renderComment: any;
    renderNode: any;
    renderEvent: any;
}
