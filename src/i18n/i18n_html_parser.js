/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
            var parseResult = this._htmlParser.parse(source, url, tslib_1.__assign({ interpolationConfig: interpolationConfig }, options));
            if (parseResult.errors.length) {
                return new parser_1.ParseTreeResult(parseResult.rootNodes, parseResult.errors);
            }
            return extractor_merger_1.mergeTranslations(parseResult.rootNodes, this._translationBundle, interpolationConfig, [], {});
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9odG1sX3BhcnNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9pMThuL2kxOG5faHRtbF9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILG1EQUFtRDtJQUVuRCw2RkFBK0U7SUFFL0UsaUVBQW9EO0lBR3BELDREQUFnQztJQUNoQyxnRkFBcUQ7SUFFckQsc0VBQTBDO0lBQzFDLHdFQUE0QztJQUM1QyxrRUFBc0M7SUFDdEMsa0VBQXNDO0lBQ3RDLG9GQUF1RDtJQUV2RDtRQU1FLHdCQUNZLFdBQXVCLEVBQUUsWUFBcUIsRUFBRSxrQkFBMkIsRUFDbkYsa0JBQW1GLEVBQ25GLE9BQWlCO1lBRGpCLG1DQUFBLEVBQUEscUJBQWlELGlDQUEwQixDQUFDLE9BQU87WUFEM0UsZ0JBQVcsR0FBWCxXQUFXLENBQVk7WUFHakMsSUFBSSxZQUFZLEVBQUU7Z0JBQ2hCLElBQU0sVUFBVSxHQUFHLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxrQkFBa0I7b0JBQ25CLHNDQUFpQixDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUMzRjtpQkFBTTtnQkFDTCxJQUFJLENBQUMsa0JBQWtCO29CQUNuQixJQUFJLHNDQUFpQixDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsZUFBTSxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUNyRjtRQUNILENBQUM7UUFFRCw4QkFBSyxHQUFMLFVBQU0sTUFBYyxFQUFFLEdBQVcsRUFBRSxPQUE2QjtZQUE3Qix3QkFBQSxFQUFBLFlBQTZCO1lBQzlELElBQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixJQUFJLG1EQUE0QixDQUFDO1lBQ3hGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxHQUFHLHFCQUFHLG1CQUFtQixxQkFBQSxJQUFLLE9BQU8sRUFBRSxDQUFDO1lBRTNGLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Z0JBQzdCLE9BQU8sSUFBSSx3QkFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3ZFO1lBRUQsT0FBTyxvQ0FBaUIsQ0FDcEIsV0FBVyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ25GLENBQUM7UUFDSCxxQkFBQztJQUFELENBQUMsQUEvQkQsSUErQkM7SUEvQlksd0NBQWM7SUFpQzNCLFNBQVMsZ0JBQWdCLENBQUMsTUFBZTtRQUN2QyxNQUFNLEdBQUcsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFekMsUUFBUSxNQUFNLEVBQUU7WUFDZCxLQUFLLEtBQUs7Z0JBQ1IsT0FBTyxJQUFJLFNBQUcsRUFBRSxDQUFDO1lBQ25CLEtBQUssS0FBSztnQkFDUixPQUFPLElBQUksU0FBRyxFQUFFLENBQUM7WUFDbkIsS0FBSyxRQUFRLENBQUM7WUFDZCxLQUFLLE1BQU07Z0JBQ1QsT0FBTyxJQUFJLGVBQU0sRUFBRSxDQUFDO1lBQ3RCLEtBQUssT0FBTyxDQUFDO1lBQ2IsS0FBSyxLQUFLLENBQUM7WUFDWDtnQkFDRSxPQUFPLElBQUksYUFBSyxFQUFFLENBQUM7U0FDdEI7SUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge01pc3NpbmdUcmFuc2xhdGlvblN0cmF0ZWd5fSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7SHRtbFBhcnNlcn0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJR30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7VG9rZW5pemVPcHRpb25zfSBmcm9tICcuLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtQYXJzZVRyZWVSZXN1bHR9IGZyb20gJy4uL21sX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0IHtDb25zb2xlfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtkaWdlc3R9IGZyb20gJy4vZGlnZXN0JztcbmltcG9ydCB7bWVyZ2VUcmFuc2xhdGlvbnN9IGZyb20gJy4vZXh0cmFjdG9yX21lcmdlcic7XG5pbXBvcnQge1NlcmlhbGl6ZXJ9IGZyb20gJy4vc2VyaWFsaXplcnMvc2VyaWFsaXplcic7XG5pbXBvcnQge1hsaWZmfSBmcm9tICcuL3NlcmlhbGl6ZXJzL3hsaWZmJztcbmltcG9ydCB7WGxpZmYyfSBmcm9tICcuL3NlcmlhbGl6ZXJzL3hsaWZmMic7XG5pbXBvcnQge1htYn0gZnJvbSAnLi9zZXJpYWxpemVycy94bWInO1xuaW1wb3J0IHtYdGJ9IGZyb20gJy4vc2VyaWFsaXplcnMveHRiJztcbmltcG9ydCB7VHJhbnNsYXRpb25CdW5kbGV9IGZyb20gJy4vdHJhbnNsYXRpb25fYnVuZGxlJztcblxuZXhwb3J0IGNsYXNzIEkxOE5IdG1sUGFyc2VyIGltcGxlbWVudHMgSHRtbFBhcnNlciB7XG4gIC8vIEBvdmVycmlkZVxuICBnZXRUYWdEZWZpbml0aW9uOiBhbnk7XG5cbiAgcHJpdmF0ZSBfdHJhbnNsYXRpb25CdW5kbGU6IFRyYW5zbGF0aW9uQnVuZGxlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfaHRtbFBhcnNlcjogSHRtbFBhcnNlciwgdHJhbnNsYXRpb25zPzogc3RyaW5nLCB0cmFuc2xhdGlvbnNGb3JtYXQ/OiBzdHJpbmcsXG4gICAgICBtaXNzaW5nVHJhbnNsYXRpb246IE1pc3NpbmdUcmFuc2xhdGlvblN0cmF0ZWd5ID0gTWlzc2luZ1RyYW5zbGF0aW9uU3RyYXRlZ3kuV2FybmluZyxcbiAgICAgIGNvbnNvbGU/OiBDb25zb2xlKSB7XG4gICAgaWYgKHRyYW5zbGF0aW9ucykge1xuICAgICAgY29uc3Qgc2VyaWFsaXplciA9IGNyZWF0ZVNlcmlhbGl6ZXIodHJhbnNsYXRpb25zRm9ybWF0KTtcbiAgICAgIHRoaXMuX3RyYW5zbGF0aW9uQnVuZGxlID1cbiAgICAgICAgICBUcmFuc2xhdGlvbkJ1bmRsZS5sb2FkKHRyYW5zbGF0aW9ucywgJ2kxOG4nLCBzZXJpYWxpemVyLCBtaXNzaW5nVHJhbnNsYXRpb24sIGNvbnNvbGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl90cmFuc2xhdGlvbkJ1bmRsZSA9XG4gICAgICAgICAgbmV3IFRyYW5zbGF0aW9uQnVuZGxlKHt9LCBudWxsLCBkaWdlc3QsIHVuZGVmaW5lZCwgbWlzc2luZ1RyYW5zbGF0aW9uLCBjb25zb2xlKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZShzb3VyY2U6IHN0cmluZywgdXJsOiBzdHJpbmcsIG9wdGlvbnM6IFRva2VuaXplT3B0aW9ucyA9IHt9KTogUGFyc2VUcmVlUmVzdWx0IHtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uQ29uZmlnID0gb3B0aW9ucy5pbnRlcnBvbGF0aW9uQ29uZmlnIHx8IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgY29uc3QgcGFyc2VSZXN1bHQgPSB0aGlzLl9odG1sUGFyc2VyLnBhcnNlKHNvdXJjZSwgdXJsLCB7aW50ZXJwb2xhdGlvbkNvbmZpZywgLi4ub3B0aW9uc30pO1xuXG4gICAgaWYgKHBhcnNlUmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBuZXcgUGFyc2VUcmVlUmVzdWx0KHBhcnNlUmVzdWx0LnJvb3ROb2RlcywgcGFyc2VSZXN1bHQuZXJyb3JzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWVyZ2VUcmFuc2xhdGlvbnMoXG4gICAgICAgIHBhcnNlUmVzdWx0LnJvb3ROb2RlcywgdGhpcy5fdHJhbnNsYXRpb25CdW5kbGUsIGludGVycG9sYXRpb25Db25maWcsIFtdLCB7fSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlU2VyaWFsaXplcihmb3JtYXQ/OiBzdHJpbmcpOiBTZXJpYWxpemVyIHtcbiAgZm9ybWF0ID0gKGZvcm1hdCB8fCAneGxmJykudG9Mb3dlckNhc2UoKTtcblxuICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgIGNhc2UgJ3htYic6XG4gICAgICByZXR1cm4gbmV3IFhtYigpO1xuICAgIGNhc2UgJ3h0Yic6XG4gICAgICByZXR1cm4gbmV3IFh0YigpO1xuICAgIGNhc2UgJ3hsaWZmMic6XG4gICAgY2FzZSAneGxmMic6XG4gICAgICByZXR1cm4gbmV3IFhsaWZmMigpO1xuICAgIGNhc2UgJ3hsaWZmJzpcbiAgICBjYXNlICd4bGYnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbmV3IFhsaWZmKCk7XG4gIH1cbn1cbiJdfQ==