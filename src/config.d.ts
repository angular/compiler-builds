import { MissingTranslationStrategy, ViewEncapsulation } from './core';
export declare class CompilerConfig {
    defaultEncapsulation: ViewEncapsulation | null;
    enableLegacyTemplate: boolean;
    useJit: boolean;
    jitDevMode: boolean;
    missingTranslation: MissingTranslationStrategy | null;
    preserveWhitespaces: boolean;
    constructor({defaultEncapsulation, useJit, jitDevMode, missingTranslation, enableLegacyTemplate, preserveWhitespaces}?: {
        defaultEncapsulation?: ViewEncapsulation;
        useJit?: boolean;
        jitDevMode?: boolean;
        missingTranslation?: MissingTranslationStrategy;
        enableLegacyTemplate?: boolean;
        preserveWhitespaces?: boolean;
    });
}
export declare function preserveWhitespacesDefault(preserveWhitespacesOption: boolean | null, defaultSetting?: boolean): boolean;
