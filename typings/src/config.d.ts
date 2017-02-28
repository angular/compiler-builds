/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { MissingTranslationStrategy, ViewEncapsulation } from '@angular/core';
export declare class CompilerConfig {
    defaultEncapsulation: ViewEncapsulation;
    enableLegacyTemplate: boolean;
    useJit: boolean;
    missingTranslation: MissingTranslationStrategy;
    private _genDebugInfo;
    private _logBindingUpdate;
    constructor({defaultEncapsulation, genDebugInfo, logBindingUpdate, useJit, missingTranslation, enableLegacyTemplate}?: {
        defaultEncapsulation?: ViewEncapsulation;
        genDebugInfo?: boolean;
        logBindingUpdate?: boolean;
        useJit?: boolean;
        missingTranslation?: MissingTranslationStrategy;
        enableLegacyTemplate?: boolean;
    });
    readonly genDebugInfo: boolean;
    readonly logBindingUpdate: boolean;
}
