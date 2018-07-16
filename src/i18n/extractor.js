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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2kxOG4vZXh0cmFjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUdIOztPQUVHO0lBQ0gsK0RBQTREO0lBQzVELCtFQUE2RDtJQUM3RCwrRUFBd0Q7SUFDeEQseUVBQXVEO0lBQ3ZELDJGQUE2RjtJQUM3RiwrRUFBbUY7SUFFbkYsdURBQXlDO0lBQ3pDLG1EQUEwQztJQUMxQyxtRkFBNEQ7SUFDNUQsK0VBQXdEO0lBQ3hELDZFQUE2RDtJQUM3RCwyRUFBb0Q7SUFDcEQsNkZBQXNFO0lBQ3RFLCtFQUF1RDtJQUV2RCxxRUFBOEM7SUFDOUMsd0dBQStFO0lBRy9FLDRFQUErQztJQW9CL0M7UUFDRSxtQkFDVyxJQUFtQixFQUFVLG9CQUEwQyxFQUN0RSxhQUE0QixFQUFVLGdCQUF5QztZQURoRixTQUFJLEdBQUosSUFBSSxDQUFlO1lBQVUseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFzQjtZQUN0RSxrQkFBYSxHQUFiLGFBQWEsQ0FBZTtZQUFVLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBeUI7UUFBRyxDQUFDO1FBRS9GLDJCQUFPLEdBQVAsVUFBUSxTQUFtQjtZQUEzQixpQkFxQ0M7WUFwQ08sSUFBQSxtSEFDcUUsRUFEcEUsZ0JBQUssRUFBRSx3QkFBUyxDQUNxRDtZQUM1RSxNQUFNLENBQUMsT0FBTztpQkFDVCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FDZCxVQUFBLFFBQVEsSUFBSSxPQUFBLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQ0FBb0MsQ0FDbEUsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLEVBRHZCLENBQ3VCLENBQUMsQ0FBQztpQkFDeEMsSUFBSSxDQUFDO2dCQUNKLElBQU0sTUFBTSxHQUFpQixFQUFFLENB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QUFDLGVBQWUsQ0FBQyxFQUFFLElBQUksNEJBQVksQ0FBQyxlQUFlLENBQUMsRUFBRSxlQUFlLEVBQzFGLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBRTlFLHlDQUF5QztZQUN6QyxJQUFNLGFBQWEsR0FBRyxJQUFJLDhCQUFhLENBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFFcEUsSUFBTSxTQUFTLEdBQUcsSUFBSSxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNyRixNQUFNLENBQUMsRUFBQyxTQUFTLFdBQUEsRUFBRSxlQUFlLGlCQUFBLEVBQUMsQ0FBQztRQUN0QyxDQUFDO1FBQ0gsZ0JBQUM7SUFBRCxDQUFDLEFBdkVELElBdUVDO0lBdkVZLDhCQUFTIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbi8qKlxuICogRXh0cmFjdCBpMThuIG1lc3NhZ2VzIGZyb20gc291cmNlIGNvZGVcbiAqL1xuaW1wb3J0IHthbmFseXplQW5kVmFsaWRhdGVOZ01vZHVsZXN9IGZyb20gJy4uL2FvdC9jb21waWxlcic7XG5pbXBvcnQge2NyZWF0ZUFvdFVybFJlc29sdmVyfSBmcm9tICcuLi9hb3QvY29tcGlsZXJfZmFjdG9yeSc7XG5pbXBvcnQge1N0YXRpY1JlZmxlY3Rvcn0gZnJvbSAnLi4vYW90L3N0YXRpY19yZWZsZWN0b3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2xDYWNoZX0gZnJvbSAnLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2xSZXNvbHZlciwgU3RhdGljU3ltYm9sUmVzb2x2ZXJIb3N0fSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbF9yZXNvbHZlcic7XG5pbXBvcnQge0FvdFN1bW1hcnlSZXNvbHZlciwgQW90U3VtbWFyeVJlc29sdmVySG9zdH0gZnJvbSAnLi4vYW90L3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlckNvbmZpZ30gZnJvbSAnLi4vY29uZmlnJztcbmltcG9ydCB7Vmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtEaXJlY3RpdmVOb3JtYWxpemVyfSBmcm9tICcuLi9kaXJlY3RpdmVfbm9ybWFsaXplcic7XG5pbXBvcnQge0RpcmVjdGl2ZVJlc29sdmVyfSBmcm9tICcuLi9kaXJlY3RpdmVfcmVzb2x2ZXInO1xuaW1wb3J0IHtDb21waWxlTWV0YWRhdGFSZXNvbHZlcn0gZnJvbSAnLi4vbWV0YWRhdGFfcmVzb2x2ZXInO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtOZ01vZHVsZVJlc29sdmVyfSBmcm9tICcuLi9uZ19tb2R1bGVfcmVzb2x2ZXInO1xuaW1wb3J0IHtQYXJzZUVycm9yfSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UGlwZVJlc29sdmVyfSBmcm9tICcuLi9waXBlX3Jlc29sdmVyJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7c3ludGF4RXJyb3J9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge01lc3NhZ2VCdW5kbGV9IGZyb20gJy4vbWVzc2FnZV9idW5kbGUnO1xuXG5cblxuLyoqXG4gKiBUaGUgaG9zdCBvZiB0aGUgRXh0cmFjdG9yIGRpc2Nvbm5lY3RzIHRoZSBpbXBsZW1lbnRhdGlvbiBmcm9tIFR5cGVTY3JpcHQgLyBvdGhlciBsYW5ndWFnZVxuICogc2VydmljZXMgYW5kIGZyb20gdW5kZXJseWluZyBmaWxlIHN5c3RlbXMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRXh0cmFjdG9ySG9zdCBleHRlbmRzIFN0YXRpY1N5bWJvbFJlc29sdmVySG9zdCwgQW90U3VtbWFyeVJlc29sdmVySG9zdCB7XG4gIC8qKlxuICAgKiBDb252ZXJ0cyBhIHBhdGggdGhhdCByZWZlcnMgdG8gYSByZXNvdXJjZSBpbnRvIGFuIGFic29sdXRlIGZpbGVQYXRoXG4gICAqIHRoYXQgY2FuIGJlIGxhdGVyb24gdXNlZCBmb3IgbG9hZGluZyB0aGUgcmVzb3VyY2UgdmlhIGBsb2FkUmVzb3VyY2UuXG4gICAqL1xuICByZXNvdXJjZU5hbWVUb0ZpbGVOYW1lKHBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGU6IHN0cmluZyk6IHN0cmluZ3xudWxsO1xuICAvKipcbiAgICogTG9hZHMgYSByZXNvdXJjZSAoZS5nLiBodG1sIC8gY3NzKVxuICAgKi9cbiAgbG9hZFJlc291cmNlKHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPnxzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRyYWN0b3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBob3N0OiBFeHRyYWN0b3JIb3N0LCBwcml2YXRlIHN0YXRpY1N5bWJvbFJlc29sdmVyOiBTdGF0aWNTeW1ib2xSZXNvbHZlcixcbiAgICAgIHByaXZhdGUgbWVzc2FnZUJ1bmRsZTogTWVzc2FnZUJ1bmRsZSwgcHJpdmF0ZSBtZXRhZGF0YVJlc29sdmVyOiBDb21waWxlTWV0YWRhdGFSZXNvbHZlcikge31cblxuICBleHRyYWN0KHJvb3RGaWxlczogc3RyaW5nW10pOiBQcm9taXNlPE1lc3NhZ2VCdW5kbGU+IHtcbiAgICBjb25zdCB7ZmlsZXMsIG5nTW9kdWxlc30gPSBhbmFseXplQW5kVmFsaWRhdGVOZ01vZHVsZXMoXG4gICAgICAgIHJvb3RGaWxlcywgdGhpcy5ob3N0LCB0aGlzLnN0YXRpY1N5bWJvbFJlc29sdmVyLCB0aGlzLm1ldGFkYXRhUmVzb2x2ZXIpO1xuICAgIHJldHVybiBQcm9taXNlXG4gICAgICAgIC5hbGwobmdNb2R1bGVzLm1hcChcbiAgICAgICAgICAgIG5nTW9kdWxlID0+IHRoaXMubWV0YWRhdGFSZXNvbHZlci5sb2FkTmdNb2R1bGVEaXJlY3RpdmVBbmRQaXBlTWV0YWRhdGEoXG4gICAgICAgICAgICAgICAgbmdNb2R1bGUudHlwZS5yZWZlcmVuY2UsIGZhbHNlKSkpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuXG4gICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBNZXRhczogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhW10gPSBbXTtcbiAgICAgICAgICAgIGZpbGUuZGlyZWN0aXZlcy5mb3JFYWNoKGRpcmVjdGl2ZVR5cGUgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBkaXJNZXRhID0gdGhpcy5tZXRhZGF0YVJlc29sdmVyLmdldERpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGUpO1xuICAgICAgICAgICAgICBpZiAoZGlyTWV0YSAmJiBkaXJNZXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgY29tcE1ldGFzLnB1c2goZGlyTWV0YSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29tcE1ldGFzLmZvckVhY2goY29tcE1ldGEgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBodG1sID0gY29tcE1ldGEudGVtcGxhdGUgIS50ZW1wbGF0ZSAhO1xuICAgICAgICAgICAgICAvLyBUZW1wbGF0ZSBVUkwgcG9pbnRzIHRvIGVpdGhlciBhbiBIVE1MIG9yIFRTIGZpbGUgZGVwZW5kaW5nIG9uXG4gICAgICAgICAgICAgIC8vIHdoZXRoZXIgdGhlIGZpbGUgaXMgdXNlZCB3aXRoIGB0ZW1wbGF0ZVVybDpgIG9yIGB0ZW1wbGF0ZTpgLFxuICAgICAgICAgICAgICAvLyByZXNwZWN0aXZlbHkuXG4gICAgICAgICAgICAgIGNvbnN0IHRlbXBsYXRlVXJsID0gY29tcE1ldGEudGVtcGxhdGUgIS50ZW1wbGF0ZVVybCAhO1xuICAgICAgICAgICAgICBjb25zdCBpbnRlcnBvbGF0aW9uQ29uZmlnID1cbiAgICAgICAgICAgICAgICAgIEludGVycG9sYXRpb25Db25maWcuZnJvbUFycmF5KGNvbXBNZXRhLnRlbXBsYXRlICEuaW50ZXJwb2xhdGlvbik7XG4gICAgICAgICAgICAgIGVycm9ycy5wdXNoKC4uLnRoaXMubWVzc2FnZUJ1bmRsZS51cGRhdGVGcm9tVGVtcGxhdGUoXG4gICAgICAgICAgICAgICAgICBodG1sLCB0ZW1wbGF0ZVVybCwgaW50ZXJwb2xhdGlvbkNvbmZpZykgISk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm1hcChlID0+IGUudG9TdHJpbmcoKSkuam9pbignXFxuJykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB0aGlzLm1lc3NhZ2VCdW5kbGU7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgc3RhdGljIGNyZWF0ZShob3N0OiBFeHRyYWN0b3JIb3N0LCBsb2NhbGU6IHN0cmluZ3xudWxsKTpcbiAgICAgIHtleHRyYWN0b3I6IEV4dHJhY3Rvciwgc3RhdGljUmVmbGVjdG9yOiBTdGF0aWNSZWZsZWN0b3J9IHtcbiAgICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcblxuICAgIGNvbnN0IHVybFJlc29sdmVyID0gY3JlYXRlQW90VXJsUmVzb2x2ZXIoaG9zdCk7XG4gICAgY29uc3Qgc3ltYm9sQ2FjaGUgPSBuZXcgU3RhdGljU3ltYm9sQ2FjaGUoKTtcbiAgICBjb25zdCBzdW1tYXJ5UmVzb2x2ZXIgPSBuZXcgQW90U3VtbWFyeVJlc29sdmVyKGhvc3QsIHN5bWJvbENhY2hlKTtcbiAgICBjb25zdCBzdGF0aWNTeW1ib2xSZXNvbHZlciA9IG5ldyBTdGF0aWNTeW1ib2xSZXNvbHZlcihob3N0LCBzeW1ib2xDYWNoZSwgc3VtbWFyeVJlc29sdmVyKTtcbiAgICBjb25zdCBzdGF0aWNSZWZsZWN0b3IgPSBuZXcgU3RhdGljUmVmbGVjdG9yKHN1bW1hcnlSZXNvbHZlciwgc3RhdGljU3ltYm9sUmVzb2x2ZXIpO1xuXG4gICAgY29uc3QgY29uZmlnID1cbiAgICAgICAgbmV3IENvbXBpbGVyQ29uZmlnKHtkZWZhdWx0RW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsIHVzZUppdDogZmFsc2V9KTtcblxuICAgIGNvbnN0IG5vcm1hbGl6ZXIgPSBuZXcgRGlyZWN0aXZlTm9ybWFsaXplcihcbiAgICAgICAge2dldDogKHVybDogc3RyaW5nKSA9PiBob3N0LmxvYWRSZXNvdXJjZSh1cmwpfSwgdXJsUmVzb2x2ZXIsIGh0bWxQYXJzZXIsIGNvbmZpZyk7XG4gICAgY29uc3QgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuICAgIGNvbnN0IHJlc29sdmVyID0gbmV3IENvbXBpbGVNZXRhZGF0YVJlc29sdmVyKFxuICAgICAgICBjb25maWcsIGh0bWxQYXJzZXIsIG5ldyBOZ01vZHVsZVJlc29sdmVyKHN0YXRpY1JlZmxlY3RvciksXG4gICAgICAgIG5ldyBEaXJlY3RpdmVSZXNvbHZlcihzdGF0aWNSZWZsZWN0b3IpLCBuZXcgUGlwZVJlc29sdmVyKHN0YXRpY1JlZmxlY3RvciksIHN1bW1hcnlSZXNvbHZlcixcbiAgICAgICAgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5LCBub3JtYWxpemVyLCBjb25zb2xlLCBzeW1ib2xDYWNoZSwgc3RhdGljUmVmbGVjdG9yKTtcblxuICAgIC8vIFRPRE8odmljYik6IGltcGxpY2l0IHRhZ3MgJiBhdHRyaWJ1dGVzXG4gICAgY29uc3QgbWVzc2FnZUJ1bmRsZSA9IG5ldyBNZXNzYWdlQnVuZGxlKGh0bWxQYXJzZXIsIFtdLCB7fSwgbG9jYWxlKTtcblxuICAgIGNvbnN0IGV4dHJhY3RvciA9IG5ldyBFeHRyYWN0b3IoaG9zdCwgc3RhdGljU3ltYm9sUmVzb2x2ZXIsIG1lc3NhZ2VCdW5kbGUsIHJlc29sdmVyKTtcbiAgICByZXR1cm4ge2V4dHJhY3Rvciwgc3RhdGljUmVmbGVjdG9yfTtcbiAgfVxufVxuIl19