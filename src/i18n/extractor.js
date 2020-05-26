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
            var _a = compiler_1.analyzeAndValidateNgModules(rootFiles, this.host, this.staticSymbolResolver, this.metadataResolver), files = _a.files, ngModules = _a.ngModules;
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
                        errors.push.apply(errors, tslib_1.__spread(_this.messageBundle.updateFromTemplate(html, templateUrl, interpolationConfig)));
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
            var urlResolver = compiler_factory_1.createAotUrlResolver(host);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2kxOG4vZXh0cmFjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFHSDs7T0FFRztJQUNILCtEQUE0RDtJQUM1RCwrRUFBNkQ7SUFDN0QsK0VBQXdEO0lBQ3hELHlFQUF1RDtJQUN2RCwyRkFBNkY7SUFDN0YsK0VBQW1GO0lBRW5GLHVEQUF5QztJQUN6QyxtREFBMEM7SUFDMUMsbUZBQTREO0lBQzVELCtFQUF3RDtJQUN4RCw2RUFBNkQ7SUFDN0QsMkVBQW9EO0lBQ3BELDZGQUFzRTtJQUN0RSwrRUFBdUQ7SUFFdkQscUVBQThDO0lBQzlDLHdHQUErRTtJQUcvRSw0RUFBK0M7SUFvQi9DO1FBQ0UsbUJBQ1csSUFBbUIsRUFBVSxvQkFBMEMsRUFDdEUsYUFBNEIsRUFBVSxnQkFBeUM7WUFEaEYsU0FBSSxHQUFKLElBQUksQ0FBZTtZQUFVLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBc0I7WUFDdEUsa0JBQWEsR0FBYixhQUFhLENBQWU7WUFBVSxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQXlCO1FBQUcsQ0FBQztRQUUvRiwyQkFBTyxHQUFQLFVBQVEsU0FBbUI7WUFBM0IsaUJBcUNDO1lBcENPLElBQUEsS0FBcUIsc0NBQTJCLENBQ2xELFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFEcEUsS0FBSyxXQUFBLEVBQUUsU0FBUyxlQUNvRCxDQUFDO1lBQzVFLE9BQU8sT0FBTztpQkFDVCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FDZCxVQUFBLFFBQVEsSUFBSSxPQUFBLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQ0FBb0MsQ0FDbEUsUUFBUSxDQUFDLElBQUksQ0FB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LENBQUMsZUFBZSxDQUFDLEVBQ3pELElBQUksc0NBQWlCLENBQUMsZUFBZSxDQUFDLEVBQUUsSUFBSSw0QkFBWSxDQUFDLGVBQWUsQ0FBQyxFQUFFLGVBQWUsRUFDMUYscUJBQXFCLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFFOUUseUNBQXlDO1lBQ3pDLElBQU0sYUFBYSxHQUFHLElBQUksOEJBQWEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUVwRSxJQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsYUFBYSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3JGLE9BQU8sRUFBQyxTQUFTLFdBQUEsRUFBRSxlQUFlLGlCQUFBLEVBQUMsQ0FBQztRQUN0QyxDQUFDO1FBQ0gsZ0JBQUM7SUFBRCxDQUFDLEFBdkVELElBdUVDO0lBdkVZLDhCQUFTIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbi8qKlxuICogRXh0cmFjdCBpMThuIG1lc3NhZ2VzIGZyb20gc291cmNlIGNvZGVcbiAqL1xuaW1wb3J0IHthbmFseXplQW5kVmFsaWRhdGVOZ01vZHVsZXN9IGZyb20gJy4uL2FvdC9jb21waWxlcic7XG5pbXBvcnQge2NyZWF0ZUFvdFVybFJlc29sdmVyfSBmcm9tICcuLi9hb3QvY29tcGlsZXJfZmFjdG9yeSc7XG5pbXBvcnQge1N0YXRpY1JlZmxlY3Rvcn0gZnJvbSAnLi4vYW90L3N0YXRpY19yZWZsZWN0b3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2xDYWNoZX0gZnJvbSAnLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2xSZXNvbHZlciwgU3RhdGljU3ltYm9sUmVzb2x2ZXJIb3N0fSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbF9yZXNvbHZlcic7XG5pbXBvcnQge0FvdFN1bW1hcnlSZXNvbHZlciwgQW90U3VtbWFyeVJlc29sdmVySG9zdH0gZnJvbSAnLi4vYW90L3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlckNvbmZpZ30gZnJvbSAnLi4vY29uZmlnJztcbmltcG9ydCB7Vmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtEaXJlY3RpdmVOb3JtYWxpemVyfSBmcm9tICcuLi9kaXJlY3RpdmVfbm9ybWFsaXplcic7XG5pbXBvcnQge0RpcmVjdGl2ZVJlc29sdmVyfSBmcm9tICcuLi9kaXJlY3RpdmVfcmVzb2x2ZXInO1xuaW1wb3J0IHtDb21waWxlTWV0YWRhdGFSZXNvbHZlcn0gZnJvbSAnLi4vbWV0YWRhdGFfcmVzb2x2ZXInO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtOZ01vZHVsZVJlc29sdmVyfSBmcm9tICcuLi9uZ19tb2R1bGVfcmVzb2x2ZXInO1xuaW1wb3J0IHtQYXJzZUVycm9yfSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UGlwZVJlc29sdmVyfSBmcm9tICcuLi9waXBlX3Jlc29sdmVyJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7c3ludGF4RXJyb3J9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge01lc3NhZ2VCdW5kbGV9IGZyb20gJy4vbWVzc2FnZV9idW5kbGUnO1xuXG5cblxuLyoqXG4gKiBUaGUgaG9zdCBvZiB0aGUgRXh0cmFjdG9yIGRpc2Nvbm5lY3RzIHRoZSBpbXBsZW1lbnRhdGlvbiBmcm9tIFR5cGVTY3JpcHQgLyBvdGhlciBsYW5ndWFnZVxuICogc2VydmljZXMgYW5kIGZyb20gdW5kZXJseWluZyBmaWxlIHN5c3RlbXMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRXh0cmFjdG9ySG9zdCBleHRlbmRzIFN0YXRpY1N5bWJvbFJlc29sdmVySG9zdCwgQW90U3VtbWFyeVJlc29sdmVySG9zdCB7XG4gIC8qKlxuICAgKiBDb252ZXJ0cyBhIHBhdGggdGhhdCByZWZlcnMgdG8gYSByZXNvdXJjZSBpbnRvIGFuIGFic29sdXRlIGZpbGVQYXRoXG4gICAqIHRoYXQgY2FuIGJlIGxhdGVyb24gdXNlZCBmb3IgbG9hZGluZyB0aGUgcmVzb3VyY2UgdmlhIGBsb2FkUmVzb3VyY2UuXG4gICAqL1xuICByZXNvdXJjZU5hbWVUb0ZpbGVOYW1lKHBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGU6IHN0cmluZyk6IHN0cmluZ3xudWxsO1xuICAvKipcbiAgICogTG9hZHMgYSByZXNvdXJjZSAoZS5nLiBodG1sIC8gY3NzKVxuICAgKi9cbiAgbG9hZFJlc291cmNlKHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPnxzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRyYWN0b3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBob3N0OiBFeHRyYWN0b3JIb3N0LCBwcml2YXRlIHN0YXRpY1N5bWJvbFJlc29sdmVyOiBTdGF0aWNTeW1ib2xSZXNvbHZlcixcbiAgICAgIHByaXZhdGUgbWVzc2FnZUJ1bmRsZTogTWVzc2FnZUJ1bmRsZSwgcHJpdmF0ZSBtZXRhZGF0YVJlc29sdmVyOiBDb21waWxlTWV0YWRhdGFSZXNvbHZlcikge31cblxuICBleHRyYWN0KHJvb3RGaWxlczogc3RyaW5nW10pOiBQcm9taXNlPE1lc3NhZ2VCdW5kbGU+IHtcbiAgICBjb25zdCB7ZmlsZXMsIG5nTW9kdWxlc30gPSBhbmFseXplQW5kVmFsaWRhdGVOZ01vZHVsZXMoXG4gICAgICAgIHJvb3RGaWxlcywgdGhpcy5ob3N0LCB0aGlzLnN0YXRpY1N5bWJvbFJlc29sdmVyLCB0aGlzLm1ldGFkYXRhUmVzb2x2ZXIpO1xuICAgIHJldHVybiBQcm9taXNlXG4gICAgICAgIC5hbGwobmdNb2R1bGVzLm1hcChcbiAgICAgICAgICAgIG5nTW9kdWxlID0+IHRoaXMubWV0YWRhdGFSZXNvbHZlci5sb2FkTmdNb2R1bGVEaXJlY3RpdmVBbmRQaXBlTWV0YWRhdGEoXG4gICAgICAgICAgICAgICAgbmdNb2R1bGUudHlwZS5yZWZlcmVuY2UsIGZhbHNlKSkpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuXG4gICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBNZXRhczogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhW10gPSBbXTtcbiAgICAgICAgICAgIGZpbGUuZGlyZWN0aXZlcy5mb3JFYWNoKGRpcmVjdGl2ZVR5cGUgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBkaXJNZXRhID0gdGhpcy5tZXRhZGF0YVJlc29sdmVyLmdldERpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGUpO1xuICAgICAgICAgICAgICBpZiAoZGlyTWV0YSAmJiBkaXJNZXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgY29tcE1ldGFzLnB1c2goZGlyTWV0YSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29tcE1ldGFzLmZvckVhY2goY29tcE1ldGEgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBodG1sID0gY29tcE1ldGEudGVtcGxhdGUgIS50ZW1wbGF0ZSAhO1xuICAgICAgICAgICAgICAvLyBUZW1wbGF0ZSBVUkwgcG9pbnRzIHRvIGVpdGhlciBhbiBIVE1MIG9yIFRTIGZpbGUgZGVwZW5kaW5nIG9uXG4gICAgICAgICAgICAgIC8vIHdoZXRoZXIgdGhlIGZpbGUgaXMgdXNlZCB3aXRoIGB0ZW1wbGF0ZVVybDpgIG9yIGB0ZW1wbGF0ZTpgLFxuICAgICAgICAgICAgICAvLyByZXNwZWN0aXZlbHkuXG4gICAgICAgICAgICAgIGNvbnN0IHRlbXBsYXRlVXJsID0gY29tcE1ldGEudGVtcGxhdGUgIS50ZW1wbGF0ZVVybCE7XG4gICAgICAgICAgICAgIGNvbnN0IGludGVycG9sYXRpb25Db25maWcgPVxuICAgICAgICAgICAgICAgICAgSW50ZXJwb2xhdGlvbkNvbmZpZy5mcm9tQXJyYXkoY29tcE1ldGEudGVtcGxhdGUgIS5pbnRlcnBvbGF0aW9uKTtcbiAgICAgICAgICAgICAgZXJyb3JzLnB1c2goLi4udGhpcy5tZXNzYWdlQnVuZGxlLnVwZGF0ZUZyb21UZW1wbGF0ZShcbiAgICAgICAgICAgICAgICAgIGh0bWwsIHRlbXBsYXRlVXJsLCBpbnRlcnBvbGF0aW9uQ29uZmlnKSEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5tYXAoZSA9PiBlLnRvU3RyaW5nKCkpLmpvaW4oJ1xcbicpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdGhpcy5tZXNzYWdlQnVuZGxlO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHN0YXRpYyBjcmVhdGUoaG9zdDogRXh0cmFjdG9ySG9zdCwgbG9jYWxlOiBzdHJpbmd8bnVsbCk6XG4gICAgICB7ZXh0cmFjdG9yOiBFeHRyYWN0b3IsIHN0YXRpY1JlZmxlY3RvcjogU3RhdGljUmVmbGVjdG9yfSB7XG4gICAgY29uc3QgaHRtbFBhcnNlciA9IG5ldyBIdG1sUGFyc2VyKCk7XG5cbiAgICBjb25zdCB1cmxSZXNvbHZlciA9IGNyZWF0ZUFvdFVybFJlc29sdmVyKGhvc3QpO1xuICAgIGNvbnN0IHN5bWJvbENhY2hlID0gbmV3IFN0YXRpY1N5bWJvbENhY2hlKCk7XG4gICAgY29uc3Qgc3VtbWFyeVJlc29sdmVyID0gbmV3IEFvdFN1bW1hcnlSZXNvbHZlcihob3N0LCBzeW1ib2xDYWNoZSk7XG4gICAgY29uc3Qgc3RhdGljU3ltYm9sUmVzb2x2ZXIgPSBuZXcgU3RhdGljU3ltYm9sUmVzb2x2ZXIoaG9zdCwgc3ltYm9sQ2FjaGUsIHN1bW1hcnlSZXNvbHZlcik7XG4gICAgY29uc3Qgc3RhdGljUmVmbGVjdG9yID0gbmV3IFN0YXRpY1JlZmxlY3RvcihzdW1tYXJ5UmVzb2x2ZXIsIHN0YXRpY1N5bWJvbFJlc29sdmVyKTtcblxuICAgIGNvbnN0IGNvbmZpZyA9XG4gICAgICAgIG5ldyBDb21waWxlckNvbmZpZyh7ZGVmYXVsdEVuY2Fwc3VsYXRpb246IFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkLCB1c2VKaXQ6IGZhbHNlfSk7XG5cbiAgICBjb25zdCBub3JtYWxpemVyID0gbmV3IERpcmVjdGl2ZU5vcm1hbGl6ZXIoXG4gICAgICAgIHtnZXQ6ICh1cmw6IHN0cmluZykgPT4gaG9zdC5sb2FkUmVzb3VyY2UodXJsKX0sIHVybFJlc29sdmVyLCBodG1sUGFyc2VyLCBjb25maWcpO1xuICAgIGNvbnN0IGVsZW1lbnRTY2hlbWFSZWdpc3RyeSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcbiAgICBjb25zdCByZXNvbHZlciA9IG5ldyBDb21waWxlTWV0YWRhdGFSZXNvbHZlcihcbiAgICAgICAgY29uZmlnLCBodG1sUGFyc2VyLCBuZXcgTmdNb2R1bGVSZXNvbHZlcihzdGF0aWNSZWZsZWN0b3IpLFxuICAgICAgICBuZXcgRGlyZWN0aXZlUmVzb2x2ZXIoc3RhdGljUmVmbGVjdG9yKSwgbmV3IFBpcGVSZXNvbHZlcihzdGF0aWNSZWZsZWN0b3IpLCBzdW1tYXJ5UmVzb2x2ZXIsXG4gICAgICAgIGVsZW1lbnRTY2hlbWFSZWdpc3RyeSwgbm9ybWFsaXplciwgY29uc29sZSwgc3ltYm9sQ2FjaGUsIHN0YXRpY1JlZmxlY3Rvcik7XG5cbiAgICAvLyBUT0RPKHZpY2IpOiBpbXBsaWNpdCB0YWdzICYgYXR0cmlidXRlc1xuICAgIGNvbnN0IG1lc3NhZ2VCdW5kbGUgPSBuZXcgTWVzc2FnZUJ1bmRsZShodG1sUGFyc2VyLCBbXSwge30sIGxvY2FsZSk7XG5cbiAgICBjb25zdCBleHRyYWN0b3IgPSBuZXcgRXh0cmFjdG9yKGhvc3QsIHN0YXRpY1N5bWJvbFJlc29sdmVyLCBtZXNzYWdlQnVuZGxlLCByZXNvbHZlcik7XG4gICAgcmV0dXJuIHtleHRyYWN0b3IsIHN0YXRpY1JlZmxlY3Rvcn07XG4gIH1cbn1cbiJdfQ==