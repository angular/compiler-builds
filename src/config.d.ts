/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { MissingTranslationStrategy, ViewEncapsulation } from '@angular/core';
import { CompileIdentifierMetadata } from './compile_metadata';
export declare class CompilerConfig {
    renderTypes: RenderTypes;
    defaultEncapsulation: ViewEncapsulation;
    private _genDebugInfo;
    private _logBindingUpdate;
    useJit: boolean;
    missingTranslation: MissingTranslationStrategy;
    constructor({renderTypes, defaultEncapsulation, genDebugInfo, logBindingUpdate, useJit, missingTranslation}?: {
        renderTypes?: RenderTypes;
        defaultEncapsulation?: ViewEncapsulation;
        genDebugInfo?: boolean;
        logBindingUpdate?: boolean;
        useJit?: boolean;
        missingTranslation?: MissingTranslationStrategy;
    });
    readonly genDebugInfo: boolean;
    readonly logBindingUpdate: boolean;
}
/**
 * Types used for the renderer.
 * Can be replaced to specialize the generated output to a specific renderer
 * to help tree shaking.
 */
export declare abstract class RenderTypes {
    readonly abstract renderer: CompileIdentifierMetadata;
    readonly abstract renderText: CompileIdentifierMetadata;
    readonly abstract renderElement: CompileIdentifierMetadata;
    readonly abstract renderComment: CompileIdentifierMetadata;
    readonly abstract renderNode: CompileIdentifierMetadata;
    readonly abstract renderEvent: CompileIdentifierMetadata;
}
export declare class DefaultRenderTypes implements RenderTypes {
    readonly renderer: CompileIdentifierMetadata;
    renderText: any;
    renderElement: any;
    renderComment: any;
    renderNode: any;
    renderEvent: any;
}
