/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var interpolation_config_1 = require('../ml_parser/interpolation_config');
var parser_1 = require('../ml_parser/parser');
var extractor_merger_1 = require('./extractor_merger');
var message_bundle_1 = require('./message_bundle');
var xliff_1 = require('./serializers/xliff');
var xmb_1 = require('./serializers/xmb');
var xtb_1 = require('./serializers/xtb');
var translation_bundle_1 = require('./translation_bundle');
var HtmlParser = (function () {
    // TODO(vicb): transB.load() should not need a msgB & add transB.resolve(msgB,
    // interpolationConfig)
    // TODO(vicb): remove the interpolationConfig from the Xtb serializer
    function HtmlParser(_htmlParser, _translations, _translationsFormat) {
        this._htmlParser = _htmlParser;
        this._translations = _translations;
        this._translationsFormat = _translationsFormat;
    }
    HtmlParser.prototype.parse = function (source, url, parseExpansionForms, interpolationConfig) {
        if (parseExpansionForms === void 0) { parseExpansionForms = false; }
        if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
        var parseResult = this._htmlParser.parse(source, url, parseExpansionForms, interpolationConfig);
        if (!this._translations || this._translations === '') {
            // Do not enable i18n when no translation bundle is provided
            return parseResult;
        }
        // TODO(vicb): add support for implicit tags / attributes
        var messageBundle = new message_bundle_1.MessageBundle(this._htmlParser, [], {});
        var errors = messageBundle.updateFromTemplate(source, url, interpolationConfig);
        if (errors && errors.length) {
            return new parser_1.ParseTreeResult(parseResult.rootNodes, parseResult.errors.concat(errors));
        }
        var serializer = this._createSerializer(interpolationConfig);
        var translationBundle = translation_bundle_1.TranslationBundle.load(this._translations, url, messageBundle, serializer);
        return extractor_merger_1.mergeTranslations(parseResult.rootNodes, translationBundle, interpolationConfig, [], {});
    };
    HtmlParser.prototype._createSerializer = function (interpolationConfig) {
        var format = (this._translationsFormat || 'xlf').toLowerCase();
        switch (format) {
            case 'xmb':
                return new xmb_1.Xmb();
            case 'xtb':
                return new xtb_1.Xtb(this._htmlParser, interpolationConfig);
            case 'xliff':
            case 'xlf':
            default:
                return new xliff_1.Xliff(this._htmlParser, interpolationConfig);
        }
    };
    return HtmlParser;
}());
exports.HtmlParser = HtmlParser;
//# sourceMappingURL=html_parser.js.map