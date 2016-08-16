/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { DEFAULT_INTERPOLATION_CONFIG } from '../ml_parser/interpolation_config';
import { ParseTreeResult } from '../ml_parser/parser';
import { mergeTranslations } from './extractor_merger';
import { MessageBundle } from './message_bundle';
import { Xliff } from './serializers/xliff';
import { Xmb } from './serializers/xmb';
import { Xtb } from './serializers/xtb';
import { TranslationBundle } from './translation_bundle';
export class HtmlParser {
    // TODO(vicb): transB.load() should not need a msgB & add transB.resolve(msgB,
    // interpolationConfig)
    // TODO(vicb): remove the interpolationConfig from the Xtb serializer
    constructor(_htmlParser, _translations, _translationsFormat) {
        this._htmlParser = _htmlParser;
        this._translations = _translations;
        this._translationsFormat = _translationsFormat;
    }
    parse(source, url, parseExpansionForms = false, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        const parseResult = this._htmlParser.parse(source, url, parseExpansionForms, interpolationConfig);
        if (!this._translations || this._translations === '') {
            // Do not enable i18n when no translation bundle is provided
            return parseResult;
        }
        // TODO(vicb): add support for implicit tags / attributes
        const messageBundle = new MessageBundle(this._htmlParser, [], {});
        const errors = messageBundle.updateFromTemplate(source, url, interpolationConfig);
        if (errors && errors.length) {
            return new ParseTreeResult(parseResult.rootNodes, parseResult.errors.concat(errors));
        }
        const serializer = this._createSerializer(interpolationConfig);
        const translationBundle = TranslationBundle.load(this._translations, url, messageBundle, serializer);
        return mergeTranslations(parseResult.rootNodes, translationBundle, interpolationConfig, [], {});
    }
    _createSerializer(interpolationConfig) {
        const format = (this._translationsFormat || 'xlf').toLowerCase();
        switch (format) {
            case 'xmb':
                return new Xmb();
            case 'xtb':
                return new Xtb(this._htmlParser, interpolationConfig);
            case 'xliff':
            case 'xlf':
            default:
                return new Xliff(this._htmlParser, interpolationConfig);
        }
    }
}
//# sourceMappingURL=html_parser.js.map