/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ViewEncapsulation } from './core';
import { noUndefined } from './util';
export class CompilerConfig {
    /**
     * @param {?=} __0
     */
    constructor({ defaultEncapsulation = ViewEncapsulation.Emulated, useJit = true, jitDevMode = false, missingTranslation = null, preserveWhitespaces, strictInjectionParameters } = {}) {
        this.defaultEncapsulation = defaultEncapsulation;
        this.useJit = !!useJit;
        this.jitDevMode = !!jitDevMode;
        this.missingTranslation = missingTranslation;
        this.preserveWhitespaces = preserveWhitespacesDefault(noUndefined(preserveWhitespaces));
        this.strictInjectionParameters = strictInjectionParameters === true;
    }
}
function CompilerConfig_tsickle_Closure_declarations() {
    /** @type {?} */
    CompilerConfig.prototype.defaultEncapsulation;
    /** @type {?} */
    CompilerConfig.prototype.useJit;
    /** @type {?} */
    CompilerConfig.prototype.jitDevMode;
    /** @type {?} */
    CompilerConfig.prototype.missingTranslation;
    /** @type {?} */
    CompilerConfig.prototype.preserveWhitespaces;
    /** @type {?} */
    CompilerConfig.prototype.strictInjectionParameters;
}
/**
 * @param {?} preserveWhitespacesOption
 * @param {?=} defaultSetting
 * @return {?}
 */
export function preserveWhitespacesDefault(preserveWhitespacesOption, defaultSetting = false) {
    return preserveWhitespacesOption === null ? defaultSetting : preserveWhitespacesOption;
}
//# sourceMappingURL=config.js.map