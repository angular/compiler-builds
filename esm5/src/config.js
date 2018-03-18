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
var CompilerConfig = /** @class */ (function () {
    function CompilerConfig(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.defaultEncapsulation, defaultEncapsulation = _c === void 0 ? ViewEncapsulation.Emulated : _c, _d = _b.useJit, useJit = _d === void 0 ? true : _d, _e = _b.jitDevMode, jitDevMode = _e === void 0 ? false : _e, _f = _b.missingTranslation, missingTranslation = _f === void 0 ? null : _f, preserveWhitespaces = _b.preserveWhitespaces, strictInjectionParameters = _b.strictInjectionParameters;
        this.defaultEncapsulation = defaultEncapsulation;
        this.useJit = !!useJit;
        this.jitDevMode = !!jitDevMode;
        this.missingTranslation = missingTranslation;
        this.preserveWhitespaces = preserveWhitespacesDefault(noUndefined(preserveWhitespaces));
        this.strictInjectionParameters = strictInjectionParameters === true;
    }
    return CompilerConfig;
}());
export { CompilerConfig };
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
export function preserveWhitespacesDefault(preserveWhitespacesOption, defaultSetting) {
    if (defaultSetting === void 0) { defaultSetting = false; }
    return preserveWhitespacesOption === null ? defaultSetting : preserveWhitespacesOption;
}
//# sourceMappingURL=config.js.map