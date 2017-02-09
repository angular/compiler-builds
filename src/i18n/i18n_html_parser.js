/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { MissingTranslationStrategy } from '@angular/core';
import { DEFAULT_INTERPOLATION_CONFIG } from '../ml_parser/interpolation_config';
import { ParseTreeResult } from '../ml_parser/parser';
import { mergeTranslations } from './extractor_merger';
import { Xliff } from './serializers/xliff';
import { Xmb } from './serializers/xmb';
import { Xtb } from './serializers/xtb';
import { TranslationBundle } from './translation_bundle';
var I18NHtmlParser = (function () {
    /**
     * @param {?} _htmlParser
     * @param {?=} translations
     * @param {?=} translationsFormat
     * @param {?=} missingTranslation
     * @param {?=} console
     */
    function I18NHtmlParser(_htmlParser, translations, translationsFormat, missingTranslation, console) {
        if (missingTranslation === void 0) { missingTranslation = MissingTranslationStrategy.Warning; }
        this._htmlParser = _htmlParser;
        if (translations) {
            var serializer = createSerializer(translationsFormat);
            this._translationBundle =
                TranslationBundle.load(translations, 'i18n', serializer, missingTranslation, console);
        }
    }
    /**
     * @param {?} source
     * @param {?} url
     * @param {?=} parseExpansionForms
     * @param {?=} interpolationConfig
     * @return {?}
     */
    I18NHtmlParser.prototype.parse = function (source, url, parseExpansionForms, interpolationConfig) {
        if (parseExpansionForms === void 0) { parseExpansionForms = false; }
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        var /** @type {?} */ parseResult = this._htmlParser.parse(source, url, parseExpansionForms, interpolationConfig);
        if (!this._translationBundle) {
            // Do not enable i18n when no translation bundle is provided
            return parseResult;
        }
        if (parseResult.errors.length) {
            return new ParseTreeResult(parseResult.rootNodes, parseResult.errors);
        }
        return mergeTranslations(parseResult.rootNodes, this._translationBundle, interpolationConfig, [], {});
    };
    return I18NHtmlParser;
}());
export { I18NHtmlParser };
function I18NHtmlParser_tsickle_Closure_declarations() {
    /** @type {?} */
    I18NHtmlParser.prototype.getTagDefinition;
    /** @type {?} */
    I18NHtmlParser.prototype._translationBundle;
    /** @type {?} */
    I18NHtmlParser.prototype._htmlParser;
}
/**
 * @param {?=} format
 * @return {?}
 */
function createSerializer(format) {
    format = (format || 'xlf').toLowerCase();
    switch (format) {
        case 'xmb':
            return new Xmb();
        case 'xtb':
            return new Xtb();
        case 'xliff':
        case 'xlf':
        default:
            return new Xliff();
    }
}
//# sourceMappingURL=i18n_html_parser.js.map