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
        define("@angular/compiler/src/jit/compiler", ["require", "exports", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/constant_pool", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/output_interpreter", "@angular/compiler/src/parse_util", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.JitCompiler = void 0;
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var constant_pool_1 = require("@angular/compiler/src/constant_pool");
    var ir = require("@angular/compiler/src/output/output_ast");
    var output_interpreter_1 = require("@angular/compiler/src/output/output_interpreter");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var util_1 = require("@angular/compiler/src/util");
    /**
     * An internal module of the Angular compiler that begins with component types,
     * extracts templates, and eventually produces a compiled version of the component
     * ready for linking into an application.
     *
     * @security  When compiling templates at runtime, you must ensure that the entire template comes
     * from a trusted source. Attacker-controlled data introduced by a template could expose your
     * application to XSS risks.  For more detail, see the [Security Guide](https://g.co/ng/security).
     */
    var JitCompiler = /** @class */ (function () {
        function JitCompiler(_metadataResolver, _templateParser, _styleCompiler, _viewCompiler, _ngModuleCompiler, _summaryResolver, _reflector, _jitEvaluator, _compilerConfig, _console, getExtraNgModuleProviders) {
            this._metadataResolver = _metadataResolver;
            this._templateParser = _templateParser;
            this._styleCompiler = _styleCompiler;
            this._viewCompiler = _viewCompiler;
            this._ngModuleCompiler = _ngModuleCompiler;
            this._summaryResolver = _summaryResolver;
            this._reflector = _reflector;
            this._jitEvaluator = _jitEvaluator;
            this._compilerConfig = _compilerConfig;
            this._console = _console;
            this.getExtraNgModuleProviders = getExtraNgModuleProviders;
            this._compiledTemplateCache = new Map();
            this._compiledHostTemplateCache = new Map();
            this._compiledDirectiveWrapperCache = new Map();
            this._compiledNgModuleCache = new Map();
            this._sharedStylesheetCount = 0;
            this._addedAotSummaries = new Set();
        }
        JitCompiler.prototype.compileModuleSync = function (moduleType) {
            return util_1.SyncAsync.assertSync(this._compileModuleAndComponents(moduleType, true));
        };
        JitCompiler.prototype.compileModuleAsync = function (moduleType) {
            return Promise.resolve(this._compileModuleAndComponents(moduleType, false));
        };
        JitCompiler.prototype.compileModuleAndAllComponentsSync = function (moduleType) {
            return util_1.SyncAsync.assertSync(this._compileModuleAndAllComponents(moduleType, true));
        };
        JitCompiler.prototype.compileModuleAndAllComponentsAsync = function (moduleType) {
            return Promise.resolve(this._compileModuleAndAllComponents(moduleType, false));
        };
        JitCompiler.prototype.getComponentFactory = function (component) {
            var summary = this._metadataResolver.getDirectiveSummary(component);
            return summary.componentFactory;
        };
        JitCompiler.prototype.loadAotSummaries = function (summaries) {
            this.clearCache();
            this._addAotSummaries(summaries);
        };
        JitCompiler.prototype._addAotSummaries = function (fn) {
            if (this._addedAotSummaries.has(fn)) {
                return;
            }
            this._addedAotSummaries.add(fn);
            var summaries = fn();
            for (var i = 0; i < summaries.length; i++) {
                var entry = summaries[i];
                if (typeof entry === 'function') {
                    this._addAotSummaries(entry);
                }
                else {
                    var summary = entry;
                    this._summaryResolver.addSummary({ symbol: summary.type.reference, metadata: null, type: summary });
                }
            }
        };
        JitCompiler.prototype.hasAotSummary = function (ref) {
            return !!this._summaryResolver.resolveSummary(ref);
        };
        JitCompiler.prototype._filterJitIdentifiers = function (ids) {
            var _this = this;
            return ids.map(function (mod) { return mod.reference; }).filter(function (ref) { return !_this.hasAotSummary(ref); });
        };
        JitCompiler.prototype._compileModuleAndComponents = function (moduleType, isSync) {
            var _this = this;
            return util_1.SyncAsync.then(this._loadModules(moduleType, isSync), function () {
                _this._compileComponents(moduleType, null);
                return _this._compileModule(moduleType);
            });
        };
        JitCompiler.prototype._compileModuleAndAllComponents = function (moduleType, isSync) {
            var _this = this;
            return util_1.SyncAsync.then(this._loadModules(moduleType, isSync), function () {
                var componentFactories = [];
                _this._compileComponents(moduleType, componentFactories);
                return {
                    ngModuleFactory: _this._compileModule(moduleType),
                    componentFactories: componentFactories
                };
            });
        };
        JitCompiler.prototype._loadModules = function (mainModule, isSync) {
            var _this = this;
            var loading = [];
            var mainNgModule = this._metadataResolver.getNgModuleMetadata(mainModule);
            // Note: for runtime compilation, we want to transitively compile all modules,
            // so we also need to load the declared directives / pipes for all nested modules.
            this._filterJitIdentifiers(mainNgModule.transitiveModule.modules).forEach(function (nestedNgModule) {
                // getNgModuleMetadata only returns null if the value passed in is not an NgModule
                var moduleMeta = _this._metadataResolver.getNgModuleMetadata(nestedNgModule);
                _this._filterJitIdentifiers(moduleMeta.declaredDirectives).forEach(function (ref) {
                    var promise = _this._metadataResolver.loadDirectiveMetadata(moduleMeta.type.reference, ref, isSync);
                    if (promise) {
                        loading.push(promise);
                    }
                });
                _this._filterJitIdentifiers(moduleMeta.declaredPipes)
                    .forEach(function (ref) { return _this._metadataResolver.getOrLoadPipeMetadata(ref); });
            });
            return util_1.SyncAsync.all(loading);
        };
        JitCompiler.prototype._compileModule = function (moduleType) {
            var ngModuleFactory = this._compiledNgModuleCache.get(moduleType);
            if (!ngModuleFactory) {
                var moduleMeta = this._metadataResolver.getNgModuleMetadata(moduleType);
                // Always provide a bound Compiler
                var extraProviders = this.getExtraNgModuleProviders(moduleMeta.type.reference);
                var outputCtx = createOutputContext();
                var compileResult = this._ngModuleCompiler.compile(outputCtx, moduleMeta, extraProviders);
                ngModuleFactory = this._interpretOrJit((0, compile_metadata_1.ngModuleJitUrl)(moduleMeta), outputCtx.statements)[compileResult.ngModuleFactoryVar];
                this._compiledNgModuleCache.set(moduleMeta.type.reference, ngModuleFactory);
            }
            return ngModuleFactory;
        };
        /**
         * @internal
         */
        JitCompiler.prototype._compileComponents = function (mainModule, allComponentFactories) {
            var _this = this;
            var ngModule = this._metadataResolver.getNgModuleMetadata(mainModule);
            var moduleByJitDirective = new Map();
            var templates = new Set();
            var transJitModules = this._filterJitIdentifiers(ngModule.transitiveModule.modules);
            transJitModules.forEach(function (localMod) {
                var localModuleMeta = _this._metadataResolver.getNgModuleMetadata(localMod);
                _this._filterJitIdentifiers(localModuleMeta.declaredDirectives).forEach(function (dirRef) {
                    moduleByJitDirective.set(dirRef, localModuleMeta);
                    var dirMeta = _this._metadataResolver.getDirectiveMetadata(dirRef);
                    if (dirMeta.isComponent) {
                        templates.add(_this._createCompiledTemplate(dirMeta, localModuleMeta));
                        if (allComponentFactories) {
                            var template = _this._createCompiledHostTemplate(dirMeta.type.reference, localModuleMeta);
                            templates.add(template);
                            allComponentFactories.push(dirMeta.componentFactory);
                        }
                    }
                });
            });
            transJitModules.forEach(function (localMod) {
                var localModuleMeta = _this._metadataResolver.getNgModuleMetadata(localMod);
                _this._filterJitIdentifiers(localModuleMeta.declaredDirectives).forEach(function (dirRef) {
                    var dirMeta = _this._metadataResolver.getDirectiveMetadata(dirRef);
                    if (dirMeta.isComponent) {
                        dirMeta.entryComponents.forEach(function (entryComponentType) {
                            var moduleMeta = moduleByJitDirective.get(entryComponentType.componentType);
                            templates.add(_this._createCompiledHostTemplate(entryComponentType.componentType, moduleMeta));
                        });
                    }
                });
                localModuleMeta.entryComponents.forEach(function (entryComponentType) {
                    if (!_this.hasAotSummary(entryComponentType.componentType)) {
                        var moduleMeta = moduleByJitDirective.get(entryComponentType.componentType);
                        templates.add(_this._createCompiledHostTemplate(entryComponentType.componentType, moduleMeta));
                    }
                });
            });
            templates.forEach(function (template) { return _this._compileTemplate(template); });
        };
        JitCompiler.prototype.clearCacheFor = function (type) {
            this._compiledNgModuleCache.delete(type);
            this._metadataResolver.clearCacheFor(type);
            this._compiledHostTemplateCache.delete(type);
            var compiledTemplate = this._compiledTemplateCache.get(type);
            if (compiledTemplate) {
                this._compiledTemplateCache.delete(type);
            }
        };
        JitCompiler.prototype.clearCache = function () {
            // Note: don't clear the _addedAotSummaries, as they don't change!
            this._metadataResolver.clearCache();
            this._compiledTemplateCache.clear();
            this._compiledHostTemplateCache.clear();
            this._compiledNgModuleCache.clear();
        };
        JitCompiler.prototype._createCompiledHostTemplate = function (compType, ngModule) {
            if (!ngModule) {
                throw new Error("Component " + (0, util_1.stringify)(compType) + " is not part of any NgModule or the module has not been imported into your module.");
            }
            var compiledTemplate = this._compiledHostTemplateCache.get(compType);
            if (!compiledTemplate) {
                var compMeta = this._metadataResolver.getDirectiveMetadata(compType);
                assertComponent(compMeta);
                var hostMeta = this._metadataResolver.getHostComponentMetadata(compMeta, compMeta.componentFactory.viewDefFactory);
                compiledTemplate =
                    new CompiledTemplate(true, compMeta.type, hostMeta, ngModule, [compMeta.type]);
                this._compiledHostTemplateCache.set(compType, compiledTemplate);
            }
            return compiledTemplate;
        };
        JitCompiler.prototype._createCompiledTemplate = function (compMeta, ngModule) {
            var compiledTemplate = this._compiledTemplateCache.get(compMeta.type.reference);
            if (!compiledTemplate) {
                assertComponent(compMeta);
                compiledTemplate = new CompiledTemplate(false, compMeta.type, compMeta, ngModule, ngModule.transitiveModule.directives);
                this._compiledTemplateCache.set(compMeta.type.reference, compiledTemplate);
            }
            return compiledTemplate;
        };
        JitCompiler.prototype._compileTemplate = function (template) {
            var _this = this;
            if (template.isCompiled) {
                return;
            }
            var compMeta = template.compMeta;
            var externalStylesheetsByModuleUrl = new Map();
            var outputContext = createOutputContext();
            var componentStylesheet = this._styleCompiler.compileComponent(outputContext, compMeta);
            compMeta.template.externalStylesheets.forEach(function (stylesheetMeta) {
                var compiledStylesheet = _this._styleCompiler.compileStyles(createOutputContext(), compMeta, stylesheetMeta);
                externalStylesheetsByModuleUrl.set(stylesheetMeta.moduleUrl, compiledStylesheet);
            });
            this._resolveStylesCompileResult(componentStylesheet, externalStylesheetsByModuleUrl);
            var pipes = template.ngModule.transitiveModule.pipes.map(function (pipe) { return _this._metadataResolver.getPipeSummary(pipe.reference); });
            var _a = this._parseTemplate(compMeta, template.ngModule, template.directives), parsedTemplate = _a.template, usedPipes = _a.pipes;
            var compileResult = this._viewCompiler.compileComponent(outputContext, compMeta, parsedTemplate, ir.variable(componentStylesheet.stylesVar), usedPipes);
            var evalResult = this._interpretOrJit((0, compile_metadata_1.templateJitUrl)(template.ngModule.type, template.compMeta), outputContext.statements);
            var viewClass = evalResult[compileResult.viewClassVar];
            var rendererType = evalResult[compileResult.rendererTypeVar];
            template.compiled(viewClass, rendererType);
        };
        JitCompiler.prototype._parseTemplate = function (compMeta, ngModule, directiveIdentifiers) {
            var _this = this;
            // Note: ! is ok here as components always have a template.
            var preserveWhitespaces = compMeta.template.preserveWhitespaces;
            var directives = directiveIdentifiers.map(function (dir) { return _this._metadataResolver.getDirectiveSummary(dir.reference); });
            var pipes = ngModule.transitiveModule.pipes.map(function (pipe) { return _this._metadataResolver.getPipeSummary(pipe.reference); });
            return this._templateParser.parse(compMeta, compMeta.template.htmlAst, directives, pipes, ngModule.schemas, (0, compile_metadata_1.templateSourceUrl)(ngModule.type, compMeta, compMeta.template), preserveWhitespaces);
        };
        JitCompiler.prototype._resolveStylesCompileResult = function (result, externalStylesheetsByModuleUrl) {
            var _this = this;
            result.dependencies.forEach(function (dep, i) {
                var nestedCompileResult = externalStylesheetsByModuleUrl.get(dep.moduleUrl);
                var nestedStylesArr = _this._resolveAndEvalStylesCompileResult(nestedCompileResult, externalStylesheetsByModuleUrl);
                dep.setValue(nestedStylesArr);
            });
        };
        JitCompiler.prototype._resolveAndEvalStylesCompileResult = function (result, externalStylesheetsByModuleUrl) {
            this._resolveStylesCompileResult(result, externalStylesheetsByModuleUrl);
            return this._interpretOrJit((0, compile_metadata_1.sharedStylesheetJitUrl)(result.meta, this._sharedStylesheetCount++), result.outputCtx.statements)[result.stylesVar];
        };
        JitCompiler.prototype._interpretOrJit = function (sourceUrl, statements) {
            if (!this._compilerConfig.useJit) {
                return (0, output_interpreter_1.interpretStatements)(statements, this._reflector);
            }
            else {
                return this._jitEvaluator.evaluateStatements(sourceUrl, statements, this._reflector, this._compilerConfig.jitDevMode);
            }
        };
        return JitCompiler;
    }());
    exports.JitCompiler = JitCompiler;
    var CompiledTemplate = /** @class */ (function () {
        function CompiledTemplate(isHost, compType, compMeta, ngModule, directives) {
            this.isHost = isHost;
            this.compType = compType;
            this.compMeta = compMeta;
            this.ngModule = ngModule;
            this.directives = directives;
            this._viewClass = null;
            this.isCompiled = false;
        }
        CompiledTemplate.prototype.compiled = function (viewClass, rendererType) {
            this._viewClass = viewClass;
            this.compMeta.componentViewType.setDelegate(viewClass);
            for (var prop in rendererType) {
                this.compMeta.rendererType[prop] = rendererType[prop];
            }
            this.isCompiled = true;
        };
        return CompiledTemplate;
    }());
    function assertComponent(meta) {
        if (!meta.isComponent) {
            throw new Error("Could not compile '" + (0, parse_util_1.identifierName)(meta.type) + "' because it is not a component.");
        }
    }
    function createOutputContext() {
        var importExpr = function (symbol) {
            return ir.importExpr({ name: (0, parse_util_1.identifierName)(symbol), moduleName: null, runtime: symbol });
        };
        return { statements: [], genFilePath: '', importExpr: importExpr, constantPool: new constant_pool_1.ConstantPool() };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaml0L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUE4TztJQUc5TyxxRUFBNkQ7SUFJN0QsNERBQTJDO0lBQzNDLHNGQUFpRTtJQUVqRSwrREFBd0U7SUFLeEUsbURBQXNEO0lBUXREOzs7Ozs7OztPQVFHO0lBQ0g7UUFRRSxxQkFDWSxpQkFBMEMsRUFBVSxlQUErQixFQUNuRixjQUE2QixFQUFVLGFBQTJCLEVBQ2xFLGlCQUFtQyxFQUFVLGdCQUF1QyxFQUNwRixVQUE0QixFQUFVLGFBQTJCLEVBQ2pFLGVBQStCLEVBQVUsUUFBaUIsRUFDMUQseUJBQXVFO1lBTHZFLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBeUI7WUFBVSxvQkFBZSxHQUFmLGVBQWUsQ0FBZ0I7WUFDbkYsbUJBQWMsR0FBZCxjQUFjLENBQWU7WUFBVSxrQkFBYSxHQUFiLGFBQWEsQ0FBYztZQUNsRSxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWtCO1lBQVUscUJBQWdCLEdBQWhCLGdCQUFnQixDQUF1QjtZQUNwRixlQUFVLEdBQVYsVUFBVSxDQUFrQjtZQUFVLGtCQUFhLEdBQWIsYUFBYSxDQUFjO1lBQ2pFLG9CQUFlLEdBQWYsZUFBZSxDQUFnQjtZQUFVLGFBQVEsR0FBUixRQUFRLENBQVM7WUFDMUQsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUE4QztZQWIzRSwyQkFBc0IsR0FBRyxJQUFJLEdBQUcsRUFBMEIsQ0FBQztZQUMzRCwrQkFBMEIsR0FBRyxJQUFJLEdBQUcsRUFBMEIsQ0FBQztZQUMvRCxtQ0FBOEIsR0FBRyxJQUFJLEdBQUcsRUFBYyxDQUFDO1lBQ3ZELDJCQUFzQixHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO1lBQ2pELDJCQUFzQixHQUFHLENBQUMs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QUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNyRSxLQUFLLElBQUksSUFBSSxJQUFJLFlBQVksRUFBRTtnQkFDdkIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzlEO1lBQ0QsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7UUFDekIsQ0FBQztRQUNILHVCQUFDO0lBQUQsQ0FBQyxBQWpCRCxJQWlCQztJQUVELFNBQVMsZUFBZSxDQUFDLElBQThCO1FBQ3JELElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQ1gsd0JBQXNCLElBQUEsMkJBQWMsRUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHFDQUFrQyxDQUFDLENBQUM7U0FDeEY7SUFDSCxDQUFDO0lBRUQsU0FBUyxtQkFBbUI7UUFDMUIsSUFBTSxVQUFVLEdBQUcsVUFBQyxNQUFXO1lBQzNCLE9BQUEsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFDLElBQUksRUFBRSxJQUFBLDJCQUFjLEVBQUMsTUFBTSxDQUFDLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFDLENBQUM7UUFBaEYsQ0FBZ0YsQ0FBQztRQUNyRixPQUFPLEVBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFLFVBQVUsWUFBQSxFQUFFLFlBQVksRUFBRSxJQUFJLDRCQUFZLEVBQUUsRUFBQyxDQUFDO0lBQ3pGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCBDb21waWxlUGlwZVN1bW1hcnksIENvbXBpbGVQcm92aWRlck1ldGFkYXRhLCBDb21waWxlVHlwZVN1bW1hcnksIG5nTW9kdWxlSml0VXJsLCBQcm94eUNsYXNzLCBzaGFyZWRTdHlsZXNoZWV0Sml0VXJsLCB0ZW1wbGF0ZUppdFVybCwgdGVtcGxhdGVTb3VyY2VVcmx9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0NvbXBpbGVyQ29uZmlnfSBmcm9tICcuLi9jb25maWcnO1xuaW1wb3J0IHtDb25zdGFudFBvb2wsIE91dHB1dENvbnRleHR9IGZyb20gJy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtUeXBlfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7Q29tcGlsZU1ldGFkYXRhUmVzb2x2ZXJ9IGZyb20gJy4uL21ldGFkYXRhX3Jlc29sdmVyJztcbmltcG9ydCB7TmdNb2R1bGVDb21waWxlcn0gZnJvbSAnLi4vbmdfbW9kdWxlX2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7aW50ZXJwcmV0U3RhdGVtZW50c30gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9pbnRlcnByZXRlcic7XG5pbXBvcnQge0ppdEV2YWx1YXRvcn0gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9qaXQnO1xuaW1wb3J0IHtDb21waWxlSWRlbnRpZmllck1ldGFkYXRhLCBpZGVudGlmaWVyTmFtZX0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0NvbXBpbGVkU3R5bGVzaGVldCwgU3R5bGVDb21waWxlcn0gZnJvbSAnLi4vc3R5bGVfY29tcGlsZXInO1xuaW1wb3J0IHtTdW1tYXJ5UmVzb2x2ZXJ9IGZyb20gJy4uL3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtUZW1wbGF0ZUFzdH0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX2FzdCc7XG5pbXBvcnQge1RlbXBsYXRlUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcGFyc2VyJztcbmltcG9ydCB7Q29uc29sZSwgc3RyaW5naWZ5LCBTeW5jQXN5bmN9IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtWaWV3Q29tcGlsZXJ9IGZyb20gJy4uL3ZpZXdfY29tcGlsZXIvdmlld19jb21waWxlcic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTW9kdWxlV2l0aENvbXBvbmVudEZhY3RvcmllcyB7XG4gIG5nTW9kdWxlRmFjdG9yeTogb2JqZWN0O1xuICBjb21wb25lbnRGYWN0b3JpZXM6IG9iamVjdFtdO1xufVxuXG4vKipcbiAqIEFuIGludGVybmFsIG1vZHVsZSBvZiB0aGUgQW5ndWxhciBjb21waWxlciB0aGF0IGJlZ2lucyB3aXRoIGNvbXBvbmVudCB0eXBlcyxcbiAqIGV4dHJhY3RzIHRlbXBsYXRlcywgYW5kIGV2ZW50dWFsbHkgcHJvZHVjZXMgYSBjb21waWxlZCB2ZXJzaW9uIG9mIHRoZSBjb21wb25lbnRcbiAqIHJlYWR5IGZvciBsaW5raW5nIGludG8gYW4gYXBwbGljYXRpb24uXG4gKlxuICogQHNlY3VyaXR5ICBXaGVuIGNvbXBpbGluZyB0ZW1wbGF0ZXMgYXQgcnVudGltZSwgeW91IG11c3QgZW5zdXJlIHRoYXQgdGhlIGVudGlyZSB0ZW1wbGF0ZSBjb21lc1xuICogZnJvbSBhIHRydXN0ZWQgc291cmNlLiBBdHRhY2tlci1jb250cm9sbGVkIGRhdGEgaW50cm9kdWNlZCBieSBhIHRlbXBsYXRlIGNvdWxkIGV4cG9zZSB5b3VyXG4gKiBhcHBsaWNhdGlvbiB0byBYU1Mgcmlza3MuICBGb3IgbW9yZSBkZXRhaWwsIHNlZSB0aGUgW1NlY3VyaXR5IEd1aWRlXShodHRwczovL2cuY28vbmcvc2VjdXJpdHkpLlxuICovXG5leHBvcnQgY2xhc3MgSml0Q29tcGlsZXIge1xuICBwcml2YXRlIF9jb21waWxlZFRlbXBsYXRlQ2FjaGUgPSBuZXcgTWFwPFR5cGUsIENvbXBpbGVkVGVtcGxhdGU+KCk7XG4gIHByaXZhdGUgX2NvbXBpbGVkSG9zdFRlbXBsYXRlQ2FjaGUgPSBuZXcgTWFwPFR5cGUsIENvbXBpbGVkVGVtcGxhdGU+KCk7XG4gIHByaXZhdGUgX2NvbXBpbGVkRGlyZWN0aXZlV3JhcHBlckNhY2hlID0gbmV3IE1hcDxUeXBlLCBUeXBlPigpO1xuICBwcml2YXRlIF9jb21waWxlZE5nTW9kdWxlQ2FjaGUgPSBuZXcgTWFwPFR5cGUsIG9iamVjdD4oKTtcbiAgcHJpdmF0ZSBfc2hhcmVkU3R5bGVzaGVldENvdW50ID0gMDtcbiAgcHJpdmF0ZSBfYWRkZWRBb3RTdW1tYXJpZXMgPSBuZXcgU2V0PCgpID0+IGFueVtdPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfbWV0YWRhdGFSZXNvbHZlcjogQ29tcGlsZU1ldGFkYXRhUmVzb2x2ZXIsIHByaXZhdGUgX3RlbXBsYXRlUGFyc2VyOiBUZW1wbGF0ZVBhcnNlcixcbiAgICAgIHByaXZhdGUgX3N0eWxlQ29tcGlsZXI6IFN0eWxlQ29tcGlsZXIsIHByaXZhdGUgX3ZpZXdDb21waWxlcjogVmlld0NvbXBpbGVyLFxuICAgICAgcHJpdmF0ZSBfbmdNb2R1bGVDb21waWxlcjogTmdNb2R1bGVDb21waWxlciwgcHJpdmF0ZSBfc3VtbWFyeVJlc29sdmVyOiBTdW1tYXJ5UmVzb2x2ZXI8VHlwZT4sXG4gICAgICBwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsIHByaXZhdGUgX2ppdEV2YWx1YXRvcjogSml0RXZhbHVhdG9yLFxuICAgICAgcHJpdmF0ZSBfY29tcGlsZXJDb25maWc6IENvbXBpbGVyQ29uZmlnLCBwcml2YXRlIF9jb25zb2xlOiBDb25zb2xlLFxuICAgICAgcHJpdmF0ZSBnZXRFeHRyYU5nTW9kdWxlUHJvdmlkZXJzOiAobmdNb2R1bGU6IGFueSkgPT4gQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSkge31cblxuICBjb21waWxlTW9kdWxlU3luYyhtb2R1bGVUeXBlOiBUeXBlKTogb2JqZWN0IHtcbiAgICByZXR1cm4gU3luY0FzeW5jLmFzc2VydFN5bmModGhpcy5fY29tcGlsZU1vZHVsZUFuZENvbXBvbmVudHMobW9kdWxlVHlwZSwgdHJ1ZSkpO1xuICB9XG5cbiAgY29tcGlsZU1vZHVsZUFzeW5jKG1vZHVsZVR5cGU6IFR5cGUpOiBQcm9taXNlPG9iamVjdD4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fY29tcGlsZU1vZHVsZUFuZENvbXBvbmVudHMobW9kdWxlVHlwZSwgZmFsc2UpKTtcbiAgfVxuXG4gIGNvbXBpbGVNb2R1bGVBbmRBbGxDb21wb25lbnRzU3luYyhtb2R1bGVUeXBlOiBUeXBlKTogTW9kdWxlV2l0aENvbXBvbmVudEZhY3RvcmllcyB7XG4gICAgcmV0dXJuIFN5bmNBc3luYy5hc3NlcnRTeW5jKHRoaXMuX2NvbXBpbGVNb2R1bGVBbmRBbGxDb21wb25lbnRzKG1vZHVsZVR5cGUsIHRydWUpKTtcbiAgfVxuXG4gIGNvbXBpbGVNb2R1bGVBbmRBbGxDb21wb25lbnRzQXN5bmMobW9kdWxlVHlwZTogVHlwZSk6IFByb21pc2U8TW9kdWxlV2l0aENvbXBvbmVudEZhY3Rvcmllcz4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fY29tcGlsZU1vZHVsZUFuZEFsbENvbXBvbmVudHMobW9kdWxlVHlwZSwgZmFsc2UpKTtcbiAgfVxuXG4gIGdldENvbXBvbmVudEZhY3RvcnkoY29tcG9uZW50OiBUeXBlKTogb2JqZWN0IHtcbiAgICBjb25zdCBzdW1tYXJ5ID0gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXREaXJlY3RpdmVTdW1tYXJ5KGNvbXBvbmVudCk7XG4gICAgcmV0dXJuIHN1bW1hcnkuY29tcG9uZW50RmFjdG9yeSBhcyBvYmplY3Q7XG4gIH1cblxuICBsb2FkQW90U3VtbWFyaWVzKHN1bW1hcmllczogKCkgPT4gYW55W10pIHtcbiAgICB0aGlzLmNsZWFyQ2FjaGUoKTtcbiAgICB0aGlzLl9hZGRBb3RTdW1tYXJpZXMoc3VtbWFyaWVzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2FkZEFvdFN1bW1hcmllcyhmbjogKCkgPT4gYW55W10pIHtcbiAgICBpZiAodGhpcy5fYWRkZWRBb3RTdW1tYXJpZXMuaGFzKGZuKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9hZGRlZEFvdFN1bW1hcmllcy5hZGQoZm4pO1xuICAgIGNvbnN0IHN1bW1hcmllcyA9IGZuKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdW1tYXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gc3VtbWFyaWVzW2ldO1xuICAgICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLl9hZGRBb3RTdW1tYXJpZXMoZW50cnkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgc3VtbWFyeSA9IGVudHJ5IGFzIENvbXBpbGVUeXBlU3VtbWFyeTtcbiAgICAgICAgdGhpcy5fc3VtbWFyeVJlc29sdmVyLmFkZFN1bW1hcnkoXG4gICAgICAgICAgICB7c3ltYm9sOiBzdW1tYXJ5LnR5cGUucmVmZXJlbmNlLCBtZXRhZGF0YTogbnVsbCwgdHlwZTogc3VtbWFyeX0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGhhc0FvdFN1bW1hcnkocmVmOiBUeXBlKSB7XG4gICAgcmV0dXJuICEhdGhpcy5fc3VtbWFyeVJlc29sdmVyLnJlc29sdmVTdW1tYXJ5KHJlZik7XG4gIH1cblxuICBwcml2YXRlIF9maWx0ZXJKaXRJZGVudGlmaWVycyhpZHM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSk6IGFueVtdIHtcbiAgICByZXR1cm4gaWRzLm1hcChtb2QgPT4gbW9kLnJlZmVyZW5jZSkuZmlsdGVyKChyZWYpID0+ICF0aGlzLmhhc0FvdFN1bW1hcnkocmVmKSk7XG4gIH1cblxuICBwcml2YXRlIF9jb21waWxlTW9kdWxlQW5kQ29tcG9uZW50cyhtb2R1bGVUeXBlOiBUeXBlLCBpc1N5bmM6IGJvb2xlYW4pOiBTeW5jQXN5bmM8b2JqZWN0PiB7XG4gICAgcmV0dXJuIFN5bmNBc3luYy50aGVuKHRoaXMuX2xvYWRNb2R1bGVzKG1vZHVsZVR5cGUsIGlzU3luYyksICgpID0+IHtcbiAgICAgIHRoaXMuX2NvbXBpbGVDb21wb25lbnRzKG1vZHVsZVR5cGUsIG51bGwpO1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbXBpbGVNb2R1bGUobW9kdWxlVHlwZSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9jb21waWxlTW9kdWxlQW5kQWxsQ29tcG9uZW50cyhtb2R1bGVUeXBlOiBUeXBlLCBpc1N5bmM6IGJvb2xlYW4pOlxuICAgICAgU3luY0FzeW5jPE1vZHVsZVdpdGhDb21wb25lbnRGYWN0b3JpZXM+IHtcbiAgICByZXR1cm4gU3luY0FzeW5jLnRoZW4odGhpcy5fbG9hZE1vZHVsZXMobW9kdWxlVHlwZSwgaXNTeW5jKSwgKCkgPT4ge1xuICAgICAgY29uc3QgY29tcG9uZW50RmFjdG9yaWVzOiBvYmplY3RbXSA9IFtdO1xuICAgICAgdGhpcy5fY29tcGlsZUNvbXBvbmVudHMobW9kdWxlVHlwZSwgY29tcG9uZW50RmFjdG9yaWVzKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5nTW9kdWxlRmFjdG9yeTogdGhpcy5fY29tcGlsZU1vZHVsZShtb2R1bGVUeXBlKSxcbiAgICAgICAgY29tcG9uZW50RmFjdG9yaWVzOiBjb21wb25lbnRGYWN0b3JpZXNcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9sb2FkTW9kdWxlcyhtYWluTW9kdWxlOiBhbnksIGlzU3luYzogYm9vbGVhbik6IFN5bmNBc3luYzxhbnk+IHtcbiAgICBjb25zdCBsb2FkaW5nOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuICAgIGNvbnN0IG1haW5OZ01vZHVsZSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShtYWluTW9kdWxlKSE7XG4gICAgLy8gTm90ZTogZm9yIHJ1bnRpbWUgY29tcGlsYXRpb24sIHdlIHdhbnQgdG8gdHJhbnNpdGl2ZWx5IGNvbXBpbGUgYWxsIG1vZHVsZXMsXG4gICAgLy8gc28gd2UgYWxzbyBuZWVkIHRvIGxvYWQgdGhlIGRlY2xhcmVkIGRpcmVjdGl2ZXMgLyBwaXBlcyBmb3IgYWxsIG5lc3RlZCBtb2R1bGVzLlxuICAgIHRoaXMuX2ZpbHRlckppdElkZW50aWZpZXJzKG1haW5OZ01vZHVsZS50cmFuc2l0aXZlTW9kdWxlLm1vZHVsZXMpLmZvckVhY2goKG5lc3RlZE5nTW9kdWxlKSA9PiB7XG4gICAgICAvLyBnZXROZ01vZHVsZU1ldGFkYXRhIG9ubHkgcmV0dXJucyBudWxsIGlmIHRoZSB2YWx1ZSBwYXNzZWQgaW4gaXMgbm90IGFuIE5nTW9kdWxlXG4gICAgICBjb25zdCBtb2R1bGVNZXRhID0gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXROZ01vZHVsZU1ldGFkYXRhKG5lc3RlZE5nTW9kdWxlKSE7XG4gICAgICB0aGlzLl9maWx0ZXJKaXRJZGVudGlmaWVycyhtb2R1bGVNZXRhLmRlY2xhcmVkRGlyZWN0aXZlcykuZm9yRWFjaCgocmVmKSA9PiB7XG4gICAgICAgIGNvbnN0IHByb21pc2UgPVxuICAgICAgICAgICAgdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5sb2FkRGlyZWN0aXZlTWV0YWRhdGEobW9kdWxlTWV0YS50eXBlLnJlZmVyZW5jZSwgcmVmLCBpc1N5bmMpO1xuICAgICAgICBpZiAocHJvbWlzZSkge1xuICAgICAgICAgIGxvYWRpbmcucHVzaChwcm9taXNlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLl9maWx0ZXJKaXRJZGVudGlmaWVycyhtb2R1bGVNZXRhLmRlY2xhcmVkUGlwZXMpXG4gICAgICAgICAgLmZvckVhY2goKHJlZikgPT4gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXRPckxvYWRQaXBlTWV0YWRhdGEocmVmKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFN5bmNBc3luYy5hbGwobG9hZGluZyk7XG4gIH1cblxuICBwcml2YXRlIF9jb21waWxlTW9kdWxlKG1vZHVsZVR5cGU6IFR5cGUpOiBvYmplY3Qge1xuICAgIGxldCBuZ01vZHVsZUZhY3RvcnkgPSB0aGlzLl9jb21waWxlZE5nTW9kdWxlQ2FjaGUuZ2V0KG1vZHVsZVR5cGUpITtcbiAgICBpZiAoIW5nTW9kdWxlRmFjdG9yeSkge1xuICAgICAgY29uc3QgbW9kdWxlTWV0YSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShtb2R1bGVUeXBlKSE7XG4gICAgICAvLyBBbHdheXMgcHJvdmlkZSBhIGJvdW5kIENvbXBpbGVyXG4gICAgICBjb25zdCBleHRyYVByb3ZpZGVycyA9IHRoaXMuZ2V0RXh0cmFOZ01vZHVsZVByb3ZpZGVycyhtb2R1bGVNZXRhLnR5cGUucmVmZXJlbmNlKTtcbiAgICAgIGNvbnN0IG91dHB1dEN0eCA9IGNyZWF0ZU91dHB1dENvbnRleHQoKTtcbiAgICAgIGNvbnN0IGNvbXBpbGVSZXN1bHQgPSB0aGlzLl9uZ01vZHVsZUNvbXBpbGVyLmNvbXBpbGUob3V0cHV0Q3R4LCBtb2R1bGVNZXRhLCBleHRyYVByb3ZpZGVycyk7XG4gICAgICBuZ01vZHVsZUZhY3RvcnkgPSB0aGlzLl9pbnRlcnByZXRPckppdChcbiAgICAgICAgICBuZ01vZHVsZUppdFVybChtb2R1bGVNZXRhKSwgb3V0cHV0Q3R4LnN0YXRlbWVudHMpW2NvbXBpbGVSZXN1bHQubmdNb2R1bGVGYWN0b3J5VmFyXTtcbiAgICAgIHRoaXMuX2NvbXBpbGVkTmdNb2R1bGVDYWNoZS5zZXQobW9kdWxlTWV0YS50eXBlLnJlZmVyZW5jZSwgbmdNb2R1bGVGYWN0b3J5KTtcbiAgICB9XG4gICAgcmV0dXJuIG5nTW9kdWxlRmFjdG9yeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIF9jb21waWxlQ29tcG9uZW50cyhtYWluTW9kdWxlOiBUeXBlLCBhbGxDb21wb25lbnRGYWN0b3JpZXM6IG9iamVjdFtdfG51bGwpIHtcbiAgICBjb25zdCBuZ01vZHVsZSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShtYWluTW9kdWxlKSE7XG4gICAgY29uc3QgbW9kdWxlQnlKaXREaXJlY3RpdmUgPSBuZXcgTWFwPGFueSwgQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGE+KCk7XG4gICAgY29uc3QgdGVtcGxhdGVzID0gbmV3IFNldDxDb21waWxlZFRlbXBsYXRlPigpO1xuXG4gICAgY29uc3QgdHJhbnNKaXRNb2R1bGVzID0gdGhpcy5fZmlsdGVySml0SWRlbnRpZmllcnMobmdNb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5tb2R1bGVzKTtcbiAgICB0cmFuc0ppdE1vZHVsZXMuZm9yRWFjaCgobG9jYWxNb2QpID0+IHtcbiAgICAgIGNvbnN0IGxvY2FsTW9kdWxlTWV0YSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0TmdNb2R1bGVNZXRhZGF0YShsb2NhbE1vZCkhO1xuICAgICAgdGhpcy5fZmlsdGVySml0SWRlbnRpZmllcnMobG9jYWxNb2R1bGVNZXRhLmRlY2xhcmVkRGlyZWN0aXZlcykuZm9yRWFjaCgoZGlyUmVmKSA9PiB7XG4gICAgICAgIG1vZHVsZUJ5Sml0RGlyZWN0aXZlLnNldChkaXJSZWYsIGxvY2FsTW9kdWxlTWV0YSk7XG4gICAgICAgIGNvbnN0IGRpck1ldGEgPSB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldERpcmVjdGl2ZU1ldGFkYXRhKGRpclJlZik7XG4gICAgICAgIGlmIChkaXJNZXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICAgICAgdGVtcGxhdGVzLmFkZCh0aGlzLl9jcmVhdGVDb21waWxlZFRlbXBsYXRlKGRpck1ldGEsIGxvY2FsTW9kdWxlTWV0YSkpO1xuICAgICAgICAgIGlmIChhbGxDb21wb25lbnRGYWN0b3JpZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHRlbXBsYXRlID1cbiAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVDb21waWxlZEhvc3RUZW1wbGF0ZShkaXJNZXRhLnR5cGUucmVmZXJlbmNlLCBsb2NhbE1vZHVsZU1ldGEpO1xuICAgICAgICAgICAgdGVtcGxhdGVzLmFkZCh0ZW1wbGF0ZSk7XG4gICAgICAgICAgICBhbGxDb21wb25lbnRGYWN0b3JpZXMucHVzaChkaXJNZXRhLmNvbXBvbmVudEZhY3RvcnkgYXMgb2JqZWN0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHRyYW5zSml0TW9kdWxlcy5mb3JFYWNoKChsb2NhbE1vZCkgPT4ge1xuICAgICAgY29uc3QgbG9jYWxNb2R1bGVNZXRhID0gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXROZ01vZHVsZU1ldGFkYXRhKGxvY2FsTW9kKSE7XG4gICAgICB0aGlzLl9maWx0ZXJKaXRJZGVudGlmaWVycyhsb2NhbE1vZHVsZU1ldGEuZGVjbGFyZWREaXJlY3RpdmVzKS5mb3JFYWNoKChkaXJSZWYpID0+IHtcbiAgICAgICAgY29uc3QgZGlyTWV0YSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoZGlyUmVmKTtcbiAgICAgICAgaWYgKGRpck1ldGEuaXNDb21wb25lbnQpIHtcbiAgICAgICAgICBkaXJNZXRhLmVudHJ5Q29tcG9uZW50cy5mb3JFYWNoKChlbnRyeUNvbXBvbmVudFR5cGUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1vZHVsZU1ldGEgPSBtb2R1bGVCeUppdERpcmVjdGl2ZS5nZXQoZW50cnlDb21wb25lbnRUeXBlLmNvbXBvbmVudFR5cGUpITtcbiAgICAgICAgICAgIHRlbXBsYXRlcy5hZGQoXG4gICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlQ29tcGlsZWRIb3N0VGVtcGxhdGUoZW50cnlDb21wb25lbnRUeXBlLmNvbXBvbmVudFR5cGUsIG1vZHVsZU1ldGEpKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBsb2NhbE1vZHVsZU1ldGEuZW50cnlDb21wb25lbnRzLmZvckVhY2goKGVudHJ5Q29tcG9uZW50VHlwZSkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuaGFzQW90U3VtbWFyeShlbnRyeUNvbXBvbmVudFR5cGUuY29tcG9uZW50VHlwZSkpIHtcbiAgICAgICAgICBjb25zdCBtb2R1bGVNZXRhID0gbW9kdWxlQnlKaXREaXJlY3RpdmUuZ2V0KGVudHJ5Q29tcG9uZW50VHlwZS5jb21wb25lbnRUeXBlKSE7XG4gICAgICAgICAgdGVtcGxhdGVzLmFkZChcbiAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlQ29tcGlsZWRIb3N0VGVtcGxhdGUoZW50cnlDb21wb25lbnRUeXBlLmNvbXBvbmVudFR5cGUsIG1vZHVsZU1ldGEpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGVtcGxhdGVzLmZvckVhY2goKHRlbXBsYXRlKSA9PiB0aGlzLl9jb21waWxlVGVtcGxhdGUodGVtcGxhdGUpKTtcbiAgfVxuXG4gIGNsZWFyQ2FjaGVGb3IodHlwZTogVHlwZSkge1xuICAgIHRoaXMuX2NvbXBpbGVkTmdNb2R1bGVDYWNoZS5kZWxldGUodHlwZSk7XG4gICAgdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5jbGVhckNhY2hlRm9yKHR5cGUpO1xuICAgIHRoaXMuX2NvbXBpbGVkSG9zdFRlbXBsYXRlQ2FjaGUuZGVsZXRlKHR5cGUpO1xuICAgIGNvbnN0IGNvbXBpbGVkVGVtcGxhdGUgPSB0aGlzLl9jb21waWxlZFRlbXBsYXRlQ2FjaGUuZ2V0KHR5cGUpO1xuICAgIGlmIChjb21waWxlZFRlbXBsYXRlKSB7XG4gICAgICB0aGlzLl9jb21waWxlZFRlbXBsYXRlQ2FjaGUuZGVsZXRlKHR5cGUpO1xuICAgIH1cbiAgfVxuXG4gIGNsZWFyQ2FjaGUoKTogdm9pZCB7XG4gICAgLy8gTm90ZTogZG9uJ3QgY2xlYXIgdGhlIF9hZGRlZEFvdFN1bW1hcmllcywgYXMgdGhleSBkb24ndCBjaGFuZ2UhXG4gICAgdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5jbGVhckNhY2hlKCk7XG4gICAgdGhpcy5fY29tcGlsZWRUZW1wbGF0ZUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fY29tcGlsZWRIb3N0VGVtcGxhdGVDYWNoZS5jbGVhcigpO1xuICAgIHRoaXMuX2NvbXBpbGVkTmdNb2R1bGVDYWNoZS5jbGVhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlQ29tcGlsZWRIb3N0VGVtcGxhdGUoY29tcFR5cGU6IFR5cGUsIG5nTW9kdWxlOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSk6XG4gICAgICBDb21waWxlZFRlbXBsYXRlIHtcbiAgICBpZiAoIW5nTW9kdWxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudCAke1xuICAgICAgICAgIHN0cmluZ2lmeShcbiAgICAgICAgICAgICAgY29tcFR5cGUpfSBpcyBub3QgcGFydCBvZiBhbnkgTmdNb2R1bGUgb3IgdGhlIG1vZHVsZSBoYXMgbm90IGJlZW4gaW1wb3J0ZWQgaW50byB5b3VyIG1vZHVsZS5gKTtcbiAgICB9XG4gICAgbGV0IGNvbXBpbGVkVGVtcGxhdGUgPSB0aGlzLl9jb21waWxlZEhvc3RUZW1wbGF0ZUNhY2hlLmdldChjb21wVHlwZSk7XG4gICAgaWYgKCFjb21waWxlZFRlbXBsYXRlKSB7XG4gICAgICBjb25zdCBjb21wTWV0YSA9IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0RGlyZWN0aXZlTWV0YWRhdGEoY29tcFR5cGUpO1xuICAgICAgYXNzZXJ0Q29tcG9uZW50KGNvbXBNZXRhKTtcblxuICAgICAgY29uc3QgaG9zdE1ldGEgPSB0aGlzLl9tZXRhZGF0YVJlc29sdmVyLmdldEhvc3RDb21wb25lbnRNZXRhZGF0YShcbiAgICAgICAgICBjb21wTWV0YSwgKGNvbXBNZXRhLmNvbXBvbmVudEZhY3RvcnkgYXMgYW55KS52aWV3RGVmRmFjdG9yeSk7XG4gICAgICBjb21waWxlZFRlbXBsYXRlID1cbiAgICAgICAgICBuZXcgQ29tcGlsZWRUZW1wbGF0ZSh0cnVlLCBjb21wTWV0YS50eXBlLCBob3N0TWV0YSwgbmdNb2R1bGUsIFtjb21wTWV0YS50eXBlXSk7XG4gICAgICB0aGlzLl9jb21waWxlZEhvc3RUZW1wbGF0ZUNhY2hlLnNldChjb21wVHlwZSwgY29tcGlsZWRUZW1wbGF0ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb21waWxlZFRlbXBsYXRlO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlQ29tcGlsZWRUZW1wbGF0ZShcbiAgICAgIGNvbXBNZXRhOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIG5nTW9kdWxlOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSk6IENvbXBpbGVkVGVtcGxhdGUge1xuICAgIGxldCBjb21waWxlZFRlbXBsYXRlID0gdGhpcy5fY29tcGlsZWRUZW1wbGF0ZUNhY2hlLmdldChjb21wTWV0YS50eXBlLnJlZmVyZW5jZSk7XG4gICAgaWYgKCFjb21waWxlZFRlbXBsYXRlKSB7XG4gICAgICBhc3NlcnRDb21wb25lbnQoY29tcE1ldGEpO1xuICAgICAgY29tcGlsZWRUZW1wbGF0ZSA9IG5ldyBDb21waWxlZFRlbXBsYXRlKFxuICAgICAgICAgIGZhbHNlLCBjb21wTWV0YS50eXBlLCBjb21wTWV0YSwgbmdNb2R1bGUsIG5nTW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUuZGlyZWN0aXZlcyk7XG4gICAgICB0aGlzLl9jb21waWxlZFRlbXBsYXRlQ2FjaGUuc2V0KGNvbXBNZXRhLnR5cGUucmVmZXJlbmNlLCBjb21waWxlZFRlbXBsYXRlKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBpbGVkVGVtcGxhdGU7XG4gIH1cblxuICBwcml2YXRlIF9jb21waWxlVGVtcGxhdGUodGVtcGxhdGU6IENvbXBpbGVkVGVtcGxhdGUpIHtcbiAgICBpZiAodGVtcGxhdGUuaXNDb21waWxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBjb21wTWV0YSA9IHRlbXBsYXRlLmNvbXBNZXRhO1xuICAgIGNvbnN0IGV4dGVybmFsU3R5bGVzaGVldHNCeU1vZHVsZVVybCA9IG5ldyBNYXA8c3RyaW5nLCBDb21waWxlZFN0eWxlc2hlZXQ+KCk7XG4gICAgY29uc3Qgb3V0cHV0Q29udGV4dCA9IGNyZWF0ZU91dHB1dENvbnRleHQoKTtcbiAgICBjb25zdCBjb21wb25lbnRTdHlsZXNoZWV0ID0gdGhpcy5fc3R5bGVDb21waWxlci5jb21waWxlQ29tcG9uZW50KG91dHB1dENvbnRleHQsIGNvbXBNZXRhKTtcbiAgICBjb21wTWV0YS50ZW1wbGF0ZSAhLmV4dGVybmFsU3R5bGVzaGVldHMuZm9yRWFjaCgoc3R5bGVzaGVldE1ldGEpID0+IHtcbiAgICAgIGNvbnN0IGNvbXBpbGVkU3R5bGVzaGVldCA9XG4gICAgICAgICAgdGhpcy5fc3R5bGVDb21waWxlci5jb21waWxlU3R5bGVzKGNyZWF0ZU91dHB1dENvbnRleHQoKSwgY29tcE1ldGEsIHN0eWxlc2hlZXRNZXRhKTtcbiAgICAgIGV4dGVybmFsU3R5bGVzaGVldHNCeU1vZHVsZVVybC5zZXQoc3R5bGVzaGVldE1ldGEubW9kdWxlVXJsISwgY29tcGlsZWRTdHlsZXNoZWV0KTtcbiAgICB9KTtcbiAgICB0aGlzLl9yZXNvbHZlU3R5bGVzQ29tcGlsZVJlc3VsdChjb21wb25lbnRTdHlsZXNoZWV0LCBleHRlcm5hbFN0eWxlc2hlZXRzQnlNb2R1bGVVcmwpO1xuICAgIGNvbnN0IHBpcGVzID0gdGVtcGxhdGUubmdNb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5waXBlcy5tYXAoXG4gICAgICAgIHBpcGUgPT4gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXRQaXBlU3VtbWFyeShwaXBlLnJlZmVyZW5jZSkpO1xuICAgIGNvbnN0IHt0ZW1wbGF0ZTogcGFyc2VkVGVtcGxhdGUsIHBpcGVzOiB1c2VkUGlwZXN9ID1cbiAgICAgICAgdGhpcy5fcGFyc2VUZW1wbGF0ZShjb21wTWV0YSwgdGVtcGxhdGUubmdNb2R1bGUsIHRlbXBsYXRlLmRpcmVjdGl2ZXMpO1xuICAgIGNvbnN0IGNvbXBpbGVSZXN1bHQgPSB0aGlzLl92aWV3Q29tcGlsZXIuY29tcGlsZUNvbXBvbmVudChcbiAgICAgICAgb3V0cHV0Q29udGV4dCwgY29tcE1ldGEsIHBhcnNlZFRlbXBsYXRlLCBpci52YXJpYWJsZShjb21wb25lbnRTdHlsZXNoZWV0LnN0eWxlc1ZhciksXG4gICAgICAgIHVzZWRQaXBlcyk7XG4gICAgY29uc3QgZXZhbFJlc3VsdCA9IHRoaXMuX2ludGVycHJldE9ySml0KFxuICAgICAgICB0ZW1wbGF0ZUppdFVybCh0ZW1wbGF0ZS5uZ01vZHVsZS50eXBlLCB0ZW1wbGF0ZS5jb21wTWV0YSksIG91dHB1dENvbnRleHQuc3RhdGVtZW50cyk7XG4gICAgY29uc3Qgdmlld0NsYXNzID0gZXZhbFJlc3VsdFtjb21waWxlUmVzdWx0LnZpZXdDbGFzc1Zhcl07XG4gICAgY29uc3QgcmVuZGVyZXJUeXBlID0gZXZhbFJlc3VsdFtjb21waWxlUmVzdWx0LnJlbmRlcmVyVHlwZVZhcl07XG4gICAgdGVtcGxhdGUuY29tcGlsZWQodmlld0NsYXNzLCByZW5kZXJlclR5cGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VUZW1wbGF0ZShcbiAgICAgIGNvbXBNZXRhOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIG5nTW9kdWxlOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSxcbiAgICAgIGRpcmVjdGl2ZUlkZW50aWZpZXJzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW10pOlxuICAgICAge3RlbXBsYXRlOiBUZW1wbGF0ZUFzdFtdLCBwaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W119IHtcbiAgICAvLyBOb3RlOiAhIGlzIG9rIGhlcmUgYXMgY29tcG9uZW50cyBhbHdheXMgaGF2ZSBhIHRlbXBsYXRlLlxuICAgIGNvbnN0IHByZXNlcnZlV2hpdGVzcGFjZXMgPSBjb21wTWV0YS50ZW1wbGF0ZSAhLnByZXNlcnZlV2hpdGVzcGFjZXM7XG4gICAgY29uc3QgZGlyZWN0aXZlcyA9XG4gICAgICAgIGRpcmVjdGl2ZUlkZW50aWZpZXJzLm1hcChkaXIgPT4gdGhpcy5fbWV0YWRhdGFSZXNvbHZlci5nZXREaXJlY3RpdmVTdW1tYXJ5KGRpci5yZWZlcmVuY2UpKTtcbiAgICBjb25zdCBwaXBlcyA9IG5nTW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUucGlwZXMubWFwKFxuICAgICAgICBwaXBlID0+IHRoaXMuX21ldGFkYXRhUmVzb2x2ZXIuZ2V0UGlwZVN1bW1hcnkocGlwZS5yZWZlcmVuY2UpKTtcbiAgICByZXR1cm4gdGhpcy5fdGVtcGxhdGVQYXJzZXIucGFyc2UoXG4gICAgICAgIGNvbXBNZXRhLCBjb21wTWV0YS50ZW1wbGF0ZSAhLmh0bWxBc3QhLCBkaXJlY3RpdmVzLCBwaXBlcywgbmdNb2R1bGUuc2NoZW1hcyxcbiAgICAgICAgdGVtcGxhdGVTb3VyY2VVcmwobmdNb2R1bGUudHlwZSwgY29tcE1ldGEsIGNvbXBNZXRhLnRlbXBsYXRlICEpLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Jlc29sdmVTdHlsZXNDb21waWxlUmVzdWx0KFxuICAgICAgcmVzdWx0OiBDb21waWxlZFN0eWxlc2hlZXQsIGV4dGVybmFsU3R5bGVzaGVldHNCeU1vZHVsZVVybDogTWFwPHN0cmluZywgQ29tcGlsZWRTdHlsZXNoZWV0Pikge1xuICAgIHJlc3VsdC5kZXBlbmRlbmNpZXMuZm9yRWFjaCgoZGVwLCBpKSA9PiB7XG4gICAgICBjb25zdCBuZXN0ZWRDb21waWxlUmVzdWx0ID0gZXh0ZXJuYWxTdHlsZXNoZWV0c0J5TW9kdWxlVXJsLmdldChkZXAubW9kdWxlVXJsKSE7XG4gICAgICBjb25zdCBuZXN0ZWRTdHlsZXNBcnIgPSB0aGlzLl9yZXNvbHZlQW5kRXZhbFN0eWxlc0NvbXBpbGVSZXN1bHQoXG4gICAgICAgICAgbmVzdGVkQ29tcGlsZVJlc3VsdCwgZXh0ZXJuYWxTdHlsZXNoZWV0c0J5TW9kdWxlVXJsKTtcbiAgICAgIGRlcC5zZXRWYWx1ZShuZXN0ZWRTdHlsZXNBcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVzb2x2ZUFuZEV2YWxTdHlsZXNDb21waWxlUmVzdWx0KFxuICAgICAgcmVzdWx0OiBDb21waWxlZFN0eWxlc2hlZXQsXG4gICAgICBleHRlcm5hbFN0eWxlc2hlZXRzQnlNb2R1bGVVcmw6IE1hcDxzdHJpbmcsIENvbXBpbGVkU3R5bGVzaGVldD4pOiBzdHJpbmdbXSB7XG4gICAgdGhpcy5fcmVzb2x2ZVN0eWxlc0NvbXBpbGVSZXN1bHQocmVzdWx0LCBleHRlcm5hbFN0eWxlc2hlZXRzQnlNb2R1bGVVcmwpO1xuICAgIHJldHVybiB0aGlzLl9pbnRlcnByZXRPckppdChcbiAgICAgICAgc2hhcmVkU3R5bGVzaGVldEppdFVybChyZXN1bHQubWV0YSwgdGhpcy5fc2hhcmVkU3R5bGVzaGVldENvdW50KyspLFxuICAgICAgICByZXN1bHQub3V0cHV0Q3R4LnN0YXRlbWVudHMpW3Jlc3VsdC5zdHlsZXNWYXJdO1xuICB9XG5cbiAgcHJpdmF0ZSBfaW50ZXJwcmV0T3JKaXQoc291cmNlVXJsOiBzdHJpbmcsIHN0YXRlbWVudHM6IGlyLlN0YXRlbWVudFtdKTogYW55IHtcbiAgICBpZiAoIXRoaXMuX2NvbXBpbGVyQ29uZmlnLnVzZUppdCkge1xuICAgICAgcmV0dXJuIGludGVycHJldFN0YXRlbWVudHMoc3RhdGVtZW50cywgdGhpcy5fcmVmbGVjdG9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX2ppdEV2YWx1YXRvci5ldmFsdWF0ZVN0YXRlbWVudHMoXG4gICAgICAgICAgc291cmNlVXJsLCBzdGF0ZW1lbnRzLCB0aGlzLl9yZWZsZWN0b3IsIHRoaXMuX2NvbXBpbGVyQ29uZmlnLmppdERldk1vZGUpO1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBDb21waWxlZFRlbXBsYXRlIHtcbiAgcHJpdmF0ZSBfdmlld0NsYXNzOiBGdW5jdGlvbiA9IG51bGwhO1xuICBpc0NvbXBpbGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaXNIb3N0OiBib29sZWFuLCBwdWJsaWMgY29tcFR5cGU6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEsXG4gICAgICBwdWJsaWMgY29tcE1ldGE6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcHVibGljIG5nTW9kdWxlOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSxcbiAgICAgIHB1YmxpYyBkaXJlY3RpdmVzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW10pIHt9XG5cbiAgY29tcGlsZWQodmlld0NsYXNzOiBGdW5jdGlvbiwgcmVuZGVyZXJUeXBlOiBhbnkpIHtcbiAgICB0aGlzLl92aWV3Q2xhc3MgPSB2aWV3Q2xhc3M7XG4gICAgKDxQcm94eUNsYXNzPnRoaXMuY29tcE1ldGEuY29tcG9uZW50Vmlld1R5cGUpLnNldERlbGVnYXRlKHZpZXdDbGFzcyk7XG4gICAgZm9yIChsZXQgcHJvcCBpbiByZW5kZXJlclR5cGUpIHtcbiAgICAgICg8YW55PnRoaXMuY29tcE1ldGEucmVuZGVyZXJUeXBlKVtwcm9wXSA9IHJlbmRlcmVyVHlwZVtwcm9wXTtcbiAgICB9XG4gICAgdGhpcy5pc0NvbXBpbGVkID0gdHJ1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnRDb21wb25lbnQobWV0YTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKSB7XG4gIGlmICghbWV0YS5pc0NvbXBvbmVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYENvdWxkIG5vdCBjb21waWxlICcke2lkZW50aWZpZXJOYW1lKG1ldGEudHlwZSl9JyBiZWNhdXNlIGl0IGlzIG5vdCBhIGNvbXBvbmVudC5gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVPdXRwdXRDb250ZXh0KCk6IE91dHB1dENvbnRleHQge1xuICBjb25zdCBpbXBvcnRFeHByID0gKHN5bWJvbDogYW55KSA9PlxuICAgICAgaXIuaW1wb3J0RXhwcih7bmFtZTogaWRlbnRpZmllck5hbWUoc3ltYm9sKSwgbW9kdWxlTmFtZTogbnVsbCwgcnVudGltZTogc3ltYm9sfSk7XG4gIHJldHVybiB7c3RhdGVtZW50czogW10sIGdlbkZpbGVQYXRoOiAnJywgaW1wb3J0RXhwciwgY29uc3RhbnRQb29sOiBuZXcgQ29uc3RhbnRQb29sKCl9O1xufVxuIl19