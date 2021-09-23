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
        define("@angular/compiler/src/i18n/extractor", ["require", "exports", "tslib", "@angular/compiler/src/aot/compiler", "@angular/compiler/src/aot/compiler_factory", "@angular/compiler/src/aot/static_reflector", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/aot/static_symbol_resolver", "@angular/compiler/src/aot/summary_resolver", "@angular/compiler/src/config", "@angular/compiler/src/core", "@angular/compiler/src/directive_normalizer", "@angular/compiler/src/directive_resolver", "@angular/compiler/src/metadata_resolver", "@angular/compiler/src/ml_parser/html_parser", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ng_module_resolver", "@angular/compiler/src/pipe_resolver", "@angular/compiler/src/schema/dom_element_schema_registry", "@angular/compiler/src/i18n/message_bundle"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Extractor = void 0;
    var tslib_1 = require("tslib");
    /**
     * Extract i18n messages from source code
     */
    var compiler_1 = require("@angular/compiler/src/aot/compiler");
    var compiler_factory_1 = require("@angular/compiler/src/aot/compiler_factory");
    var static_reflector_1 = require("@angular/compiler/src/aot/static_reflector");
    var static_symbol_1 = require("@angular/compiler/src/aot/static_symbol");
    var static_symbol_resolver_1 = require("@angular/compiler/src/aot/static_symbol_resolver");
    var summary_resolver_1 = require("@angular/compiler/src/aot/summary_resolver");
    var config_1 = require("@angular/compiler/src/config");
    var core_1 = require("@angular/compiler/src/core");
    var directive_normalizer_1 = require("@angular/compiler/src/directive_normalizer");
    var directive_resolver_1 = require("@angular/compiler/src/directive_resolver");
    var metadata_resolver_1 = require("@angular/compiler/src/metadata_resolver");
    var html_parser_1 = require("@angular/compiler/src/ml_parser/html_parser");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var ng_module_resolver_1 = require("@angular/compiler/src/ng_module_resolver");
    var pipe_resolver_1 = require("@angular/compiler/src/pipe_resolver");
    var dom_element_schema_registry_1 = require("@angular/compiler/src/schema/dom_element_schema_registry");
    var message_bundle_1 = require("@angular/compiler/src/i18n/message_bundle");
    var Extractor = /** @class */ (function () {
        function Extractor(host, staticSymbolResolver, messageBundle, metadataResolver) {
            this.host = host;
            this.staticSymbolResolver = staticSymbolResolver;
            this.messageBundle = messageBundle;
            this.metadataResolver = metadataResolver;
        }
        Extractor.prototype.extract = function (rootFiles) {
            var _this = this;
            var _a = (0, compiler_1.analyzeAndValidateNgModules)(rootFiles, this.host, this.staticSymbolResolver, this.metadataResolver), files = _a.files, ngModules = _a.ngModules;
            return Promise
                .all(ngModules.map(function (ngModule) { return _this.metadataResolver.loadNgModuleDirectiveAndPipeMetadata(ngModule.type.reference, false); }))
                .then(function () {
                var errors = [];
                files.forEach(function (file) {
                    var compMetas = [];
                    file.directives.forEach(function (directiveType) {
                        var dirMeta = _this.metadataResolver.getDirectiveMetadata(directiveType);
                        if (dirMeta && dirMeta.isComponent) {
                            compMetas.push(dirMeta);
                        }
                    });
                    compMetas.forEach(function (compMeta) {
                        var html = compMeta.template.template;
                        // Template URL points to either an HTML or TS file depending on
                        // whether the file is used with `templateUrl:` or `template:`,
                        // respectively.
                        var templateUrl = compMeta.template.templateUrl;
                        var interpolationConfig = interpolation_config_1.InterpolationConfig.fromArray(compMeta.template.interpolation);
                        errors.push.apply(errors, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(_this.messageBundle.updateFromTemplate(html, templateUrl, interpolationConfig)), false));
                    });
                });
                if (errors.length) {
                    throw new Error(errors.map(function (e) { return e.toString(); }).join('\n'));
                }
                return _this.messageBundle;
            });
        };
        Extractor.create = function (host, locale) {
            var htmlParser = new html_parser_1.HtmlParser();
            var urlResolver = (0, compiler_factory_1.createAotUrlResolver)(host);
            var symbolCache = new static_symbol_1.StaticSymbolCache();
            var summaryResolver = new summary_resolver_1.AotSummaryResolver(host, symbolCache);
            var staticSymbolResolver = new static_symbol_resolver_1.StaticSymbolResolver(host, symbolCache, summaryResolver);
            var staticReflector = new static_reflector_1.StaticReflector(summaryResolver, staticSymbolResolver);
            var config = new config_1.CompilerConfig({ defaultEncapsulation: core_1.ViewEncapsulation.Emulated, useJit: false });
            var normalizer = new directive_normalizer_1.DirectiveNormalizer({ get: function (url) { return host.loadResource(url); } }, urlResolver, htmlParser, config);
            var elementSchemaRegistry = new dom_element_schema_registry_1.DomElementSchemaRegistry();
            var resolver = new metadata_resolver_1.CompileMetadataResolver(config, htmlParser, new ng_module_resolver_1.NgModuleResolver(staticReflector), new directive_resolver_1.DirectiveResolver(staticReflector), new pipe_resolver_1.PipeResolver(staticReflector), summaryResolver, elementSchemaRegistry, normalizer, console, symbolCache, staticReflector);
            // TODO(vicb): implicit tags & attributes
            var messageBundle = new message_bundle_1.MessageBundle(htmlParser, [], {}, locale);
            var extractor = new Extractor(host, staticSymbolResolver, messageBundle, resolver);
            return { extractor: extractor, staticReflector: staticReflector };
        };
        return Extractor;
    }());
    exports.Extractor = Extractor;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2kxOG4vZXh0cmFjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFHSDs7T0FFRztJQUNILCtEQUE0RDtJQUM1RCwrRUFBNkQ7SUFDN0QsK0VBQXdEO0lBQ3hELHlFQUF1RDtJQUN2RCwyRkFBNkY7SUFDN0YsK0VBQW1GO0lBRW5GLHVEQUF5QztJQUN6QyxtREFBMEM7SUFDMUMsbUZBQTREO0lBQzVELCtFQUF3RDtJQUN4RCw2RUFBNkQ7SUFDN0QsMkVBQW9EO0lBQ3BELDZGQUFzRTtJQUN0RSwrRUFBdUQ7SUFFdkQscUVBQThDO0lBQzlDLHdHQUErRTtJQUUvRSw0RUFBK0M7SUFvQi9DO1FBQ0UsbUJBQ1csSUFBbUIsRUFBVSxvQkFBMEMsRUFDdEUsYUFBNEIsRUFBVSxnQkFBeUM7WUFEaEYsU0FBSSxHQUFKLElBQUksQ0FBZTtZQUFVLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBc0I7WUFDdEUsa0JBQWEsR0FBYixhQUFhLENBQWU7WUFBVSxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQXlCO1FBQUcsQ0FBQztRQUUvRiwyQkFBTyxHQUFQLFVBQVEsU0FBbUI7WUFBM0IsaUJBcUNDO1lBcENPLElBQUEsS0FBcUIsSUFBQSxzQ0FBMkIsRUFDbEQsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQURwRSxLQUFLLFdBQUEsRUFBRSxTQUFTLGVBQ29ELENBQUM7WUFDNUUsT0FBTyxPQUFPO2lCQUNULEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUNkLFVBQUEsUUFBUSxJQUFJLE9BQUEsS0FBSSxDQUFDLGdCQUFnQixDQUFDLG9DQUFvQyxDQUNsRSxRQUFRLENBQUMsSUFB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QUFJLHFDQUFnQixDQUFDLGVBQWUsQ0FBQyxFQUN6RCxJQUFJLHNDQUFpQixDQUFDLGVBQWUsQ0FBQyxFQUFFLElBQUksNEJBQVksQ0FBQyxlQUFlLENBQUMsRUFBRSxlQUFlLEVBQzFGLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBRTlFLHlDQUF5QztZQUN6QyxJQUFNLGFBQWEsR0FBRyxJQUFJLDhCQUFhLENBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFFcEUsSUFBTSxTQUFTLEdBQUcsSUFBSSxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNyRixPQUFPLEVBQUMsU0FBUyxXQUFBLEVBQUUsZUFBZSxpQkFBQSxFQUFDLENBQUM7UUFDdEMsQ0FBQztRQUNILGdCQUFDO0lBQUQsQ0FBQyxBQXZFRCxJQXVFQztJQXZFWSw4QkFBUyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbi8qKlxuICogRXh0cmFjdCBpMThuIG1lc3NhZ2VzIGZyb20gc291cmNlIGNvZGVcbiAqL1xuaW1wb3J0IHthbmFseXplQW5kVmFsaWRhdGVOZ01vZHVsZXN9IGZyb20gJy4uL2FvdC9jb21waWxlcic7XG5pbXBvcnQge2NyZWF0ZUFvdFVybFJlc29sdmVyfSBmcm9tICcuLi9hb3QvY29tcGlsZXJfZmFjdG9yeSc7XG5pbXBvcnQge1N0YXRpY1JlZmxlY3Rvcn0gZnJvbSAnLi4vYW90L3N0YXRpY19yZWZsZWN0b3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2xDYWNoZX0gZnJvbSAnLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2xSZXNvbHZlciwgU3RhdGljU3ltYm9sUmVzb2x2ZXJIb3N0fSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbF9yZXNvbHZlcic7XG5pbXBvcnQge0FvdFN1bW1hcnlSZXNvbHZlciwgQW90U3VtbWFyeVJlc29sdmVySG9zdH0gZnJvbSAnLi4vYW90L3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlckNvbmZpZ30gZnJvbSAnLi4vY29uZmlnJztcbmltcG9ydCB7Vmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtEaXJlY3RpdmVOb3JtYWxpemVyfSBmcm9tICcuLi9kaXJlY3RpdmVfbm9ybWFsaXplcic7XG5pbXBvcnQge0RpcmVjdGl2ZVJlc29sdmVyfSBmcm9tICcuLi9kaXJlY3RpdmVfcmVzb2x2ZXInO1xuaW1wb3J0IHtDb21waWxlTWV0YWRhdGFSZXNvbHZlcn0gZnJvbSAnLi4vbWV0YWRhdGFfcmVzb2x2ZXInO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtOZ01vZHVsZVJlc29sdmVyfSBmcm9tICcuLi9uZ19tb2R1bGVfcmVzb2x2ZXInO1xuaW1wb3J0IHtQYXJzZUVycm9yfSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UGlwZVJlc29sdmVyfSBmcm9tICcuLi9waXBlX3Jlc29sdmVyJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcblxuaW1wb3J0IHtNZXNzYWdlQnVuZGxlfSBmcm9tICcuL21lc3NhZ2VfYnVuZGxlJztcblxuXG5cbi8qKlxuICogVGhlIGhvc3Qgb2YgdGhlIEV4dHJhY3RvciBkaXNjb25uZWN0cyB0aGUgaW1wbGVtZW50YXRpb24gZnJvbSBUeXBlU2NyaXB0IC8gb3RoZXIgbGFuZ3VhZ2VcbiAqIHNlcnZpY2VzIGFuZCBmcm9tIHVuZGVybHlpbmcgZmlsZSBzeXN0ZW1zLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEV4dHJhY3Rvckhvc3QgZXh0ZW5kcyBTdGF0aWNTeW1ib2xSZXNvbHZlckhvc3QsIEFvdFN1bW1hcnlSZXNvbHZlckhvc3Qge1xuICAvKipcbiAgICogQ29udmVydHMgYSBwYXRoIHRoYXQgcmVmZXJzIHRvIGEgcmVzb3VyY2UgaW50byBhbiBhYnNvbHV0ZSBmaWxlUGF0aFxuICAgKiB0aGF0IGNhbiBiZSBsYXRlciBvbiB1c2VkIGZvciBsb2FkaW5nIHRoZSByZXNvdXJjZSB2aWEgYGxvYWRSZXNvdXJjZS5cbiAgICovXG4gIHJlc291cmNlTmFtZVRvRmlsZU5hbWUocGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZTogc3RyaW5nKTogc3RyaW5nfG51bGw7XG4gIC8qKlxuICAgKiBMb2FkcyBhIHJlc291cmNlIChlLmcuIGh0bWwgLyBjc3MpXG4gICAqL1xuICBsb2FkUmVzb3VyY2UocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+fHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEV4dHJhY3RvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGhvc3Q6IEV4dHJhY3Rvckhvc3QsIHByaXZhdGUgc3RhdGljU3ltYm9sUmVzb2x2ZXI6IFN0YXRpY1N5bWJvbFJlc29sdmVyLFxuICAgICAgcHJpdmF0ZSBtZXNzYWdlQnVuZGxlOiBNZXNzYWdlQnVuZGxlLCBwcml2YXRlIG1ldGFkYXRhUmVzb2x2ZXI6IENvbXBpbGVNZXRhZGF0YVJlc29sdmVyKSB7fVxuXG4gIGV4dHJhY3Qocm9vdEZpbGVzOiBzdHJpbmdbXSk6IFByb21pc2U8TWVzc2FnZUJ1bmRsZT4ge1xuICAgIGNvbnN0IHtmaWxlcywgbmdNb2R1bGVzfSA9IGFuYWx5emVBbmRWYWxpZGF0ZU5nTW9kdWxlcyhcbiAgICAgICAgcm9vdEZpbGVzLCB0aGlzLmhvc3QsIHRoaXMuc3RhdGljU3ltYm9sUmVzb2x2ZXIsIHRoaXMubWV0YWRhdGFSZXNvbHZlcik7XG4gICAgcmV0dXJuIFByb21pc2VcbiAgICAgICAgLmFsbChuZ01vZHVsZXMubWFwKFxuICAgICAgICAgICAgbmdNb2R1bGUgPT4gdGhpcy5tZXRhZGF0YVJlc29sdmVyLmxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YShcbiAgICAgICAgICAgICAgICBuZ01vZHVsZS50eXBlLnJlZmVyZW5jZSwgZmFsc2UpKSlcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG5cbiAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgY29uc3QgY29tcE1ldGFzOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFbXSA9IFtdO1xuICAgICAgICAgICAgZmlsZS5kaXJlY3RpdmVzLmZvckVhY2goZGlyZWN0aXZlVHlwZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGRpck1ldGEgPSB0aGlzLm1ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoZGlyZWN0aXZlVHlwZSk7XG4gICAgICAgICAgICAgIGlmIChkaXJNZXRhICYmIGRpck1ldGEuaXNDb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICBjb21wTWV0YXMucHVzaChkaXJNZXRhKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb21wTWV0YXMuZm9yRWFjaChjb21wTWV0YSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGh0bWwgPSBjb21wTWV0YS50ZW1wbGF0ZSAhLnRlbXBsYXRlICE7XG4gICAgICAgICAgICAgIC8vIFRlbXBsYXRlIFVSTCBwb2ludHMgdG8gZWl0aGVyIGFuIEhUTUwgb3IgVFMgZmlsZSBkZXBlbmRpbmcgb25cbiAgICAgICAgICAgICAgLy8gd2hldGhlciB0aGUgZmlsZSBpcyB1c2VkIHdpdGggYHRlbXBsYXRlVXJsOmAgb3IgYHRlbXBsYXRlOmAsXG4gICAgICAgICAgICAgIC8vIHJlc3BlY3RpdmVseS5cbiAgICAgICAgICAgICAgY29uc3QgdGVtcGxhdGVVcmwgPSBjb21wTWV0YS50ZW1wbGF0ZSAhLnRlbXBsYXRlVXJsITtcbiAgICAgICAgICAgICAgY29uc3QgaW50ZXJwb2xhdGlvbkNvbmZpZyA9XG4gICAgICAgICAgICAgICAgICBJbnRlcnBvbGF0aW9uQ29uZmlnLmZyb21BcnJheShjb21wTWV0YS50ZW1wbGF0ZSAhLmludGVycG9sYXRpb24pO1xuICAgICAgICAgICAgICBlcnJvcnMucHVzaCguLi50aGlzLm1lc3NhZ2VCdW5kbGUudXBkYXRlRnJvbVRlbXBsYXRlKFxuICAgICAgICAgICAgICAgICAgaHRtbCwgdGVtcGxhdGVVcmwsIGludGVycG9sYXRpb25Db25maWcpISk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm1hcChlID0+IGUudG9TdHJpbmcoKSkuam9pbignXFxuJykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB0aGlzLm1lc3NhZ2VCdW5kbGU7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgc3RhdGljIGNyZWF0ZShob3N0OiBFeHRyYWN0b3JIb3N0LCBsb2NhbGU6IHN0cmluZ3xudWxsKTpcbiAgICAgIHtleHRyYWN0b3I6IEV4dHJhY3Rvciwgc3RhdGljUmVmbGVjdG9yOiBTdGF0aWNSZWZsZWN0b3J9IHtcbiAgICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcblxuICAgIGNvbnN0IHVybFJlc29sdmVyID0gY3JlYXRlQW90VXJsUmVzb2x2ZXIoaG9zdCk7XG4gICAgY29uc3Qgc3ltYm9sQ2FjaGUgPSBuZXcgU3RhdGljU3ltYm9sQ2FjaGUoKTtcbiAgICBjb25zdCBzdW1tYXJ5UmVzb2x2ZXIgPSBuZXcgQW90U3VtbWFyeVJlc29sdmVyKGhvc3QsIHN5bWJvbENhY2hlKTtcbiAgICBjb25zdCBzdGF0aWNTeW1ib2xSZXNvbHZlciA9IG5ldyBTdGF0aWNTeW1ib2xSZXNvbHZlcihob3N0LCBzeW1ib2xDYWNoZSwgc3VtbWFyeVJlc29sdmVyKTtcbiAgICBjb25zdCBzdGF0aWNSZWZsZWN0b3IgPSBuZXcgU3RhdGljUmVmbGVjdG9yKHN1bW1hcnlSZXNvbHZlciwgc3RhdGljU3ltYm9sUmVzb2x2ZXIpO1xuXG4gICAgY29uc3QgY29uZmlnID1cbiAgICAgICAgbmV3IENvbXBpbGVyQ29uZmlnKHtkZWZhdWx0RW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsIHVzZUppdDogZmFsc2V9KTtcblxuICAgIGNvbnN0IG5vcm1hbGl6ZXIgPSBuZXcgRGlyZWN0aXZlTm9ybWFsaXplcihcbiAgICAgICAge2dldDogKHVybDogc3RyaW5nKSA9PiBob3N0LmxvYWRSZXNvdXJjZSh1cmwpfSwgdXJsUmVzb2x2ZXIsIGh0bWxQYXJzZXIsIGNvbmZpZyk7XG4gICAgY29uc3QgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuICAgIGNvbnN0IHJlc29sdmVyID0gbmV3IENvbXBpbGVNZXRhZGF0YVJlc29sdmVyKFxuICAgICAgICBjb25maWcsIGh0bWxQYXJzZXIsIG5ldyBOZ01vZHVsZVJlc29sdmVyKHN0YXRpY1JlZmxlY3RvciksXG4gICAgICAgIG5ldyBEaXJlY3RpdmVSZXNvbHZlcihzdGF0aWNSZWZsZWN0b3IpLCBuZXcgUGlwZVJlc29sdmVyKHN0YXRpY1JlZmxlY3RvciksIHN1bW1hcnlSZXNvbHZlcixcbiAgICAgICAgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5LCBub3JtYWxpemVyLCBjb25zb2xlLCBzeW1ib2xDYWNoZSwgc3RhdGljUmVmbGVjdG9yKTtcblxuICAgIC8vIFRPRE8odmljYik6IGltcGxpY2l0IHRhZ3MgJiBhdHRyaWJ1dGVzXG4gICAgY29uc3QgbWVzc2FnZUJ1bmRsZSA9IG5ldyBNZXNzYWdlQnVuZGxlKGh0bWxQYXJzZXIsIFtdLCB7fSwgbG9jYWxlKTtcblxuICAgIGNvbnN0IGV4dHJhY3RvciA9IG5ldyBFeHRyYWN0b3IoaG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXIsIG1lc3NhZ2VCdW5kbGUsIHJlc29sdmVyKTtcbiAgICByZXR1cm4ge2V4dHJhY3Rvciwgc3RhdGljUmVmbGVjdG9yfTtcbiAgfVxufVxuIl19