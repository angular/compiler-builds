/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/i18n/i18n_html_parser", ["require", "exports", "tslib", "@angular/compiler/src/core", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/parser", "@angular/compiler/src/i18n/digest", "@angular/compiler/src/i18n/extractor_merger", "@angular/compiler/src/i18n/serializers/xliff", "@angular/compiler/src/i18n/serializers/xliff2", "@angular/compiler/src/i18n/serializers/xmb", "@angular/compiler/src/i18n/serializers/xtb", "@angular/compiler/src/i18n/translation_bundle"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.I18NHtmlParser = void 0;
    var tslib_1 = require("tslib");
    var core_1 = require("@angular/compiler/src/core");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var parser_1 = require("@angular/compiler/src/ml_parser/parser");
    var digest_1 = require("@angular/compiler/src/i18n/digest");
    var extractor_merger_1 = require("@angular/compiler/src/i18n/extractor_merger");
    var xliff_1 = require("@angular/compiler/src/i18n/serializers/xliff");
    var xliff2_1 = require("@angular/compiler/src/i18n/serializers/xliff2");
    var xmb_1 = require("@angular/compiler/src/i18n/serializers/xmb");
    var xtb_1 = require("@angular/compiler/src/i18n/serializers/xtb");
    var translation_bundle_1 = require("@angular/compiler/src/i18n/translation_bundle");
    var I18NHtmlParser = /** @class */ (function () {
        function I18NHtmlParser(_htmlParser, translations, translationsFormat, missingTranslation, console) {
            if (missingTranslation === void 0) { missingTranslation = core_1.MissingTranslationStrategy.Warning; }
            this._htmlParser = _htmlParser;
            if (translations) {
                var serializer = createSerializer(translationsFormat);
                this._translationBundle =
                    translation_bundle_1.TranslationBundle.load(translations, 'i18n', serializer, missingTranslation, console);
            }
            else {
                this._translationBundle =
                    new translation_bundle_1.TranslationBundle({}, null, digest_1.digest, undefined, missingTranslation, console);
            }
        }
        I18NHtmlParser.prototype.parse = function (source, url, options) {
            if (options === void 0) { options = {}; }
            var interpolationConfig = options.interpolationConfig || interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG;
            var parseResult = this._htmlParser.parse(source, url, (0, tslib_1.__assign)({ interpolationConfig: interpolationConfig }, options));
            if (parseResult.errors.length) {
                return new parser_1.ParseTreeResult(parseResult.rootNodes, parseResult.errors);
            }
            return (0, extractor_merger_1.mergeTranslations)(parseResult.rootNodes, this._translationBundle, interpolationConfig, [], {});
        };
        return I18NHtmlParser;
    }());
    exports.I18NHtmlParser = I18NHtmlParser;
    function createSerializer(format) {
        format = (format || 'xlf').toLowerCase();
        switch (format) {
            case 'xmb':
                return new xmb_1.Xmb();
            case 'xtb':
                return new xtb_1.Xtb();
            case 'xliff2':
            case 'xlf2':
                return new xliff2_1.Xliff2();
            case 'xliff':
            case 'xlf':
            default:
                return new xliff_1.Xliff();
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9odG1sX3BhcnNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9pMThuL2kxOG5faHRtbF9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILG1EQUFtRDtJQUVuRCw2RkFBK0U7SUFFL0UsaUVBQW9EO0lBR3BELDREQUFnQztJQUNoQyxnRkFBcUQ7SUFFckQsc0VBQTBDO0lBQzFDLHdFQUE0QztJQUM1QyxrRUFBc0M7SUFDdEMsa0VBQXNDO0lBQ3RDLG9GQUF1RDtJQUV2RDtRQU1FLHdCQUNZLFdBQXVCLEVBQUUsWUFBcUIsRUFBRSxrQkFBMkIsRUFDbkYsa0JBQW1GLEVBQ25GLE9BQWlCO1lBRGpCLG1DQUFBLEVBQUEscUJBQWlELGlDQUEwQixDQUFDLE9BQU87WUFEM0UsZ0JBQVcsR0FBWCxXQUFXLENBQVk7WUFHakMsSUFBSSxZQUFZLEVBQUU7Z0JBQ2hCLElBQU0sVUFBVSxHQUFHLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxrQkFBa0I7b0JBQ25CLHNDQUFpQixDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUMzRjtpQkFBTTtnQkFDTCxJQUFJLENBQUMsa0JBQWtCO29CQUNuQixJQUFJLHNDQUFpQixDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsZUFBTSxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUNyRjtRQUNILENBQUM7UUFFRCw4QkFBSyxHQUFMLFVBQU0sTUFBYyxFQUFFLEdBQVcsRUFBRSxPQUE2QjtZQUE3Qix3QkFBQSxFQUFBLFlBQTZCO1lBQzlELElBQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixJQUFJLG1EQUE0QixDQUFDO1lBQ3hGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxHQUFHLDBCQUFHLG1CQUFtQixxQkFBQSxJQUFLLE9BQU8sRUFBRSxDQUFDO1lBRTNGLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Z0JBQzdCLE9BQU8sSUFBSSx3QkFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3ZFO1lBRUQsT0FBTyxJQUFBLG9DQUFpQixFQUNwQixXQUFXLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbkYsQ0FBQztRQUNILHFCQUFDO0lBQUQsQ0FBQyxBQS9CRCxJQStCQztJQS9CWSx3Q0FBYztJQWlDM0IsU0FBUyxnQkFBZ0IsQ0FBQyxNQUFlO1FBQ3ZDLE1BQU0sR0FBRyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUV6QyxRQUFRLE1BQU0sRUFBRTtZQUNkLEtBQUssS0FBSztnQkFDUixPQUFPLElBQUksU0FBRyxFQUFFLENBQUM7WUFDbkIsS0FBSyxLQUFLO2dCQUNSLE9BQU8sSUFBSSxTQUFHLEVBQUUsQ0FBQztZQUNuQixLQUFLLFFBQVEsQ0FBQztZQUNkLEtBQUssTUFBTTtnQkFDVCxPQUFPLElBQUksZUFBTSxFQUFFLENBQUM7WUFDdEIsS0FBSyxPQUFPLENBQUM7WUFDYixLQUFLLEtBQUssQ0FBQztZQUNYO2dCQUNFLE9BQU8sSUFBSSxhQUFLLEVBQUUsQ0FBQztTQUN0QjtJQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtNaXNzaW5nVHJhbnNsYXRpb25TdHJhdGVneX0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge1Rva2VuaXplT3B0aW9uc30gZnJvbSAnLi4vbWxfcGFyc2VyL2xleGVyJztcbmltcG9ydCB7UGFyc2VUcmVlUmVzdWx0fSBmcm9tICcuLi9tbF9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCB7Q29uc29sZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7ZGlnZXN0fSBmcm9tICcuL2RpZ2VzdCc7XG5pbXBvcnQge21lcmdlVHJhbnNsYXRpb25zfSBmcm9tICcuL2V4dHJhY3Rvcl9tZXJnZXInO1xuaW1wb3J0IHtTZXJpYWxpemVyfSBmcm9tICcuL3NlcmlhbGl6ZXJzL3NlcmlhbGl6ZXInO1xuaW1wb3J0IHtYbGlmZn0gZnJvbSAnLi9zZXJpYWxpemVycy94bGlmZic7XG5pbXBvcnQge1hsaWZmMn0gZnJvbSAnLi9zZXJpYWxpemVycy94bGlmZjInO1xuaW1wb3J0IHtYbWJ9IGZyb20gJy4vc2VyaWFsaXplcnMveG1iJztcbmltcG9ydCB7WHRifSBmcm9tICcuL3NlcmlhbGl6ZXJzL3h0Yic7XG5pbXBvcnQge1RyYW5zbGF0aW9uQnVuZGxlfSBmcm9tICcuL3RyYW5zbGF0aW9uX2J1bmRsZSc7XG5cbmV4cG9ydCBjbGFzcyBJMThOSHRtbFBhcnNlciBpbXBsZW1lbnRzIEh0bWxQYXJzZXIge1xuICAvLyBAb3ZlcnJpZGVcbiAgZ2V0VGFnRGVmaW5pdGlvbjogYW55O1xuXG4gIHByaXZhdGUgX3RyYW5zbGF0aW9uQnVuZGxlOiBUcmFuc2xhdGlvbkJ1bmRsZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2h0bWxQYXJzZXI6IEh0bWxQYXJzZXIsIHRyYW5zbGF0aW9ucz86IHN0cmluZywgdHJhbnNsYXRpb25zRm9ybWF0Pzogc3RyaW5nLFxuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiBNaXNzaW5nVHJhbnNsYXRpb25TdHJhdGVneSA9IE1pc3NpbmdUcmFuc2xhdGlvblN0cmF0ZWd5Lldhcm5pbmcsXG4gICAgICBjb25zb2xlPzogQ29uc29sZSkge1xuICAgIGlmICh0cmFuc2xhdGlvbnMpIHtcbiAgICAgIGNvbnN0IHNlcmlhbGl6ZXIgPSBjcmVhdGVTZXJpYWxpemVyKHRyYW5zbGF0aW9uc0Zvcm1hdCk7XG4gICAgICB0aGlzLl90cmFuc2xhdGlvbkJ1bmRsZSA9XG4gICAgICAgICAgVHJhbnNsYXRpb25CdW5kbGUubG9hZCh0cmFuc2xhdGlvbnMsICdpMThuJywgc2VyaWFsaXplciwgbWlzc2luZ1RyYW5zbGF0aW9uLCBjb25zb2xlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fdHJhbnNsYXRpb25CdW5kbGUgPVxuICAgICAgICAgIG5ldyBUcmFuc2xhdGlvbkJ1bmRsZSh7fSwgbnVsbCwgZGlnZXN0LCB1bmRlZmluZWQsIG1pc3NpbmdUcmFuc2xhdGlvbiwgY29uc29sZSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2Uoc291cmNlOiBzdHJpbmcsIHVybDogc3RyaW5nLCBvcHRpb25zOiBUb2tlbml6ZU9wdGlvbnMgPSB7fSk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbkNvbmZpZyA9IG9wdGlvbnMuaW50ZXJwb2xhdGlvbkNvbmZpZyB8fCBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHO1xuICAgIGNvbnN0IHBhcnNlUmVzdWx0ID0gdGhpcy5faHRtbFBhcnNlci5wYXJzZShzb3VyY2UsIHVybCwge2ludGVycG9sYXRpb25Db25maWcsIC4uLm9wdGlvbnN9KTtcblxuICAgIGlmIChwYXJzZVJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gbmV3IFBhcnNlVHJlZVJlc3VsdChwYXJzZVJlc3VsdC5yb290Tm9kZXMsIHBhcnNlUmVzdWx0LmVycm9ycyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1lcmdlVHJhbnNsYXRpb25zKFxuICAgICAgICBwYXJzZVJlc3VsdC5yb290Tm9kZXMsIHRoaXMuX3RyYW5zbGF0aW9uQnVuZGxlLCBpbnRlcnBvbGF0aW9uQ29uZmlnLCBbXSwge30pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNlcmlhbGl6ZXIoZm9ybWF0Pzogc3RyaW5nKTogU2VyaWFsaXplciB7XG4gIGZvcm1hdCA9IChmb3JtYXQgfHwgJ3hsZicpLnRvTG93ZXJDYXNlKCk7XG5cbiAgc3dpdGNoIChmb3JtYXQpIHtcbiAgICBjYXNlICd4bWInOlxuICAgICAgcmV0dXJuIG5ldyBYbWIoKTtcbiAgICBjYXNlICd4dGInOlxuICAgICAgcmV0dXJuIG5ldyBYdGIoKTtcbiAgICBjYXNlICd4bGlmZjInOlxuICAgIGNhc2UgJ3hsZjInOlxuICAgICAgcmV0dXJuIG5ldyBYbGlmZjIoKTtcbiAgICBjYXNlICd4bGlmZic6XG4gICAgY2FzZSAneGxmJzpcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG5ldyBYbGlmZigpO1xuICB9XG59XG4iXX0=