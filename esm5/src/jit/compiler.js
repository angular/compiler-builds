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
import { identifierName, ngModuleJitUrl, sharedStylesheetJitUrl, templateJitUrl, templateSourceUrl } from '../compile_metadata';
import { ConstantPool } from '../constant_pool';
import * as ir from '../output/output_ast';
import { interpretStatements } from '../output/output_interpreter';
import { jitStatements } from '../output/output_jit';
import { SyncAsync, stringify } from '../util';
/**
 * @record
 */
export function ModuleWithComponentFactories() { }
function ModuleWithComponentFactories_tsickle_Closure_declarations() {
    /** @type {?} */
    ModuleWithComponentFactories.prototype.ngModuleFactory;
    /** @type {?} */
    ModuleWithComponentFactories.prototype.componentFactories;
}
/**
 * An internal module of the Angular compiler that begins with component types,
 * extracts templates, and eventually produces a compiled version of the component
 * ready for linking into an application.
 *
 * \@security When compiling templates at runtime, you must ensure that the entire template comes
 * from a trusted source. Attacker-controlled data introduced by a template could expose your
 * application to XSS risks.  For more detail, see the [Security Guide](http://g.co/ng/security).
 */
var /**
 * An internal module of the Angular compiler that begins with component types,
 * extracts templates, and eventually produces a compiled version of the component
 * ready for linking into an application.
 *
 * \@security When compiling templates at runtime, you must ensure that the entire template comes
 * from a trusted source. Attacker-controlled data introduced by a template could expose your
 * application to XSS risks.  For more detail, see the [Security Guide](http://g.co/ng/security).
 */
JitCompiler = /** @class */ (function () {
    function JitCompiler(_metadataResolver, _templateParser, _styleCompiler, _viewCompiler, _ngModuleCompiler, _summaryResolver, _reflector, _compilerConfig, _console, getExtraNgModuleProviders) {
        this._metadataResolver = _metadataResolver;
        this._templateParser = _templateParser;
        this._styleCompiler = _styleCompiler;
        this._viewCompiler = _viewCompiler;
        this._ngModuleCompiler = _ngModuleCompiler;
        this._summaryResolver = _summaryResolver;
        this._reflector = _reflector;
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
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype.compileModuleSync = /**
     * @param {?} moduleType
     * @return {?}
     */
    function (moduleType) {
        return SyncAsync.assertSync(this._compileModuleAndComponents(moduleType, true));
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype.compileModuleAsync = /**
     * @param {?} moduleType
     * @return {?}
     */
    function (moduleType) {
        return Promise.resolve(this._compileModuleAndComponents(moduleType, false));
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype.compileModuleAndAllComponentsSync = /**
     * @param {?} moduleType
     * @return {?}
     */
    function (moduleType) {
        return SyncAsync.assertSync(this._compileModuleAndAllComponents(moduleType, true));
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype.compileModuleAndAllComponentsAsync = /**
     * @param {?} moduleType
     * @return {?}
     */
    function (moduleType) {
        return Promise.resolve(this._compileModuleAndAllComponents(moduleType, false));
    };
    /**
     * @param {?} component
     * @return {?}
     */
    JitCompiler.prototype.getComponentFactory = /**
     * @param {?} component
     * @return {?}
     */
    function (component) {
        var /** @type {?} */ summary = this._metadataResolver.getDirectiveSummary(component);
        return /** @type {?} */ (summary.componentFactory);
    };
    /**
     * @param {?} summaries
     * @return {?}
     */
    JitCompiler.prototype.loadAotSummaries = /**
     * @param {?} summaries
     * @return {?}
     */
    function (summaries) {
        this.clearCache();
        this._addAotSummaries(summaries);
    };
    /**
     * @param {?} fn
     * @return {?}
     */
    JitCompiler.prototype._addAotSummaries = /**
     * @param {?} fn
     * @return {?}
     */
    function (fn) {
        if (this._addedAotSummaries.has(fn)) {
            return;
        }
        this._addedAotSummaries.add(fn);
        var /** @type {?} */ summaries = fn();
        for (var /** @type {?} */ i = 0; i < summaries.length; i++) {
            var /** @type {?} */ entry = summaries[i];
            if (typeof entry === 'function') {
                this._addAotSummaries(entry);
            }
            else {
                var /** @type {?} */ summary = /** @type {?} */ (entry);
                this._summaryResolver.addSummary({ symbol: summary.type.reference, metadata: null, type: summary });
            }
        }
    };
    /**
     * @param {?} ref
     * @return {?}
     */
    JitCompiler.prototype.hasAotSummary = /**
     * @param {?} ref
     * @return {?}
     */
    function (ref) { return !!this._summaryResolver.resolveSummary(ref); };
    /**
     * @param {?} ids
     * @return {?}
     */
    JitCompiler.prototype._filterJitIdentifiers = /**
     * @param {?} ids
     * @return {?}
     */
    function (ids) {
        var _this = this;
        return ids.map(function (mod) { return mod.reference; }).filter(function (ref) { return !_this.hasAotSummary(ref); });
    };
    /**
     * @param {?} moduleType
     * @param {?} isSync
     * @return {?}
     */
    JitCompiler.prototype._compileModuleAndComponents = /**
     * @param {?} moduleType
     * @param {?} isSync
     * @return {?}
     */
    function (moduleType, isSync) {
        var _this = this;
        return SyncAsync.then(this._loadModules(moduleType, isSync), function () {
            _this._compileComponents(moduleType, null);
            return _this._compileModule(moduleType);
        });
    };
    /**
     * @param {?} moduleType
     * @param {?} isSync
     * @return {?}
     */
    JitCompiler.prototype._compileModuleAndAllComponents = /**
     * @param {?} moduleType
     * @param {?} isSync
     * @return {?}
     */
    function (moduleType, isSync) {
        var _this = this;
        return SyncAsync.then(this._loadModules(moduleType, isSync), function () {
            var /** @type {?} */ componentFactories = [];
            _this._compileComponents(moduleType, componentFactories);
            return {
                ngModuleFactory: _this._compileModule(moduleType),
                componentFactories: componentFactories
            };
        });
    };
    /**
     * @param {?} mainModule
     * @param {?} isSync
     * @return {?}
     */
    JitCompiler.prototype._loadModules = /**
     * @param {?} mainModule
     * @param {?} isSync
     * @return {?}
     */
    function (mainModule, isSync) {
        var _this = this;
        var /** @type {?} */ loading = [];
        var /** @type {?} */ mainNgModule = /** @type {?} */ ((this._metadataResolver.getNgModuleMetadata(mainModule)));
        // Note: for runtime compilation, we want to transitively compile all modules,
        // so we also need to load the declared directives / pipes for all nested modules.
        this._filterJitIdentifiers(mainNgModule.transitiveModule.modules).forEach(function (nestedNgModule) {
            // getNgModuleMetadata only returns null if the value passed in is not an NgModule
            var /** @type {?} */ moduleMeta = /** @type {?} */ ((_this._metadataResolver.getNgModuleMetadata(nestedNgModule)));
            _this._filterJitIdentifiers(moduleMeta.declaredDirectives).forEach(function (ref) {
                var /** @type {?} */ promise = _this._metadataResolver.loadDirectiveMetadata(moduleMeta.type.reference, ref, isSync);
                if (promise) {
                    loading.push(promise);
                }
            });
            _this._filterJitIdentifiers(moduleMeta.declaredPipes)
                .forEach(function (ref) { return _this._metadataResolver.getOrLoadPipeMetadata(ref); });
        });
        return SyncAsync.all(loading);
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype._compileModule = /**
     * @param {?} moduleType
     * @return {?}
     */
    function (moduleType) {
        var /** @type {?} */ ngModuleFactory = /** @type {?} */ ((this._compiledNgModuleCache.get(moduleType)));
        if (!ngModuleFactory) {
            var /** @type {?} */ moduleMeta = /** @type {?} */ ((this._metadataResolver.getNgModuleMetadata(moduleType)));
            // Always provide a bound Compiler
            var /** @type {?} */ extraProviders = this.getExtraNgModuleProviders(moduleMeta.type.reference);
            var /** @type {?} */ outputCtx = createOutputContext();
            var /** @type {?} */ compileResult = this._ngModuleCompiler.compile(outputCtx, moduleMeta, extraProviders);
            ngModuleFactory = this._interpretOrJit(ngModuleJitUrl(moduleMeta), outputCtx.statements)[compileResult.ngModuleFactoryVar];
            this._compiledNgModuleCache.set(moduleMeta.type.reference, ngModuleFactory);
        }
        return ngModuleFactory;
    };
    /**
     * @internal
     */
    /**
     * \@internal
     * @param {?} mainModule
     * @param {?} allComponentFactories
     * @return {?}
     */
    JitCompiler.prototype._compileComponents = /**
     * \@internal
     * @param {?} mainModule
     * @param {?} allComponentFactories
     * @return {?}
     */
    function (mainModule, allComponentFactories) {
        var _this = this;
        var /** @type {?} */ ngModule = /** @type {?} */ ((this._metadataResolver.getNgModuleMetadata(mainModule)));
        var /** @type {?} */ moduleByJitDirective = new Map();
        var /** @type {?} */ templates = new Set();
        var /** @type {?} */ transJitModules = this._filterJitIdentifiers(ngModule.transitiveModule.modules);
        transJitModules.forEach(function (localMod) {
            var /** @type {?} */ localModuleMeta = /** @type {?} */ ((_this._metadataResolver.getNgModuleMetadata(localMod)));
            _this._filterJitIdentifiers(localModuleMeta.declaredDirectives).forEach(function (dirRef) {
                moduleByJitDirective.set(dirRef, localModuleMeta);
                var /** @type {?} */ dirMeta = _this._metadataResolver.getDirectiveMetadata(dirRef);
                if (dirMeta.isComponent) {
                    templates.add(_this._createCompiledTemplate(dirMeta, localModuleMeta));
                    if (allComponentFactories) {
                        var /** @type {?} */ template = _this._createCompiledHostTemplate(dirMeta.type.reference, localModuleMeta);
                        templates.add(template);
                        allComponentFactories.push(/** @type {?} */ (dirMeta.componentFactory));
                    }
                }
            });
        });
        transJitModules.forEach(function (localMod) {
            var /** @type {?} */ localModuleMeta = /** @type {?} */ ((_this._metadataResolver.getNgModuleMetadata(localMod)));
            _this._filterJitIdentifiers(localModuleMeta.declaredDirectives).forEach(function (dirRef) {
                var /** @type {?} */ dirMeta = _this._metadataResolver.getDirectiveMetadata(dirRef);
                if (dirMeta.isComponent) {
                    dirMeta.entryComponents.forEach(function (entryComponentType) {
                        var /** @type {?} */ moduleMeta = /** @type {?} */ ((moduleByJitDirective.get(entryComponentType.componentType)));
                        templates.add(_this._createCompiledHostTemplate(entryComponentType.componentType, moduleMeta));
                    });
                }
            });
            localModuleMeta.entryComponents.forEach(function (entryComponentType) {
                if (!_this.hasAotSummary(entryComponentType.componentType.reference)) {
                    var /** @type {?} */ moduleMeta = /** @type {?} */ ((moduleByJitDirective.get(entryComponentType.componentType)));
                    templates.add(_this._createCompiledHostTemplate(entryComponentType.componentType, moduleMeta));
                }
            });
        });
        templates.forEach(function (template) { return _this._compileTemplate(template); });
    };
    /**
     * @param {?} type
     * @return {?}
     */
    JitCompiler.prototype.clearCacheFor = /**
     * @param {?} type
     * @return {?}
     */
    function (type) {
        this._compiledNgModuleCache.delete(type);
        this._metadataResolver.clearCacheFor(type);
        this._compiledHostTemplateCache.delete(type);
        var /** @type {?} */ compiledTemplate = this._compiledTemplateCache.get(type);
        if (compiledTemplate) {
            this._compiledTemplateCache.delete(type);
        }
    };
    /**
     * @return {?}
     */
    JitCompiler.prototype.clearCache = /**
     * @return {?}
     */
    function () {
        // Note: don't clear the _addedAotSummaries, as they don't change!
        this._metadataResolver.clearCache();
        this._compiledTemplateCache.clear();
        this._compiledHostTemplateCache.clear();
        this._compiledNgModuleCache.clear();
    };
    /**
     * @param {?} compType
     * @param {?} ngModule
     * @return {?}
     */
    JitCompiler.prototype._createCompiledHostTemplate = /**
     * @param {?} compType
     * @param {?} ngModule
     * @return {?}
     */
    function (compType, ngModule) {
        if (!ngModule) {
            throw new Error("Component " + stringify(compType) + " is not part of any NgModule or the module has not been imported into your module.");
        }
        var /** @type {?} */ compiledTemplate = this._compiledHostTemplateCache.get(compType);
        if (!compiledTemplate) {
            var /** @type {?} */ compMeta = this._metadataResolver.getDirectiveMetadata(compType);
            assertComponent(compMeta);
            var /** @type {?} */ hostMeta = this._metadataResolver.getHostComponentMetadata(compMeta, (/** @type {?} */ (compMeta.componentFactory)).viewDefFactory);
            compiledTemplate =
                new CompiledTemplate(true, compMeta.type, hostMeta, ngModule, [compMeta.type]);
            this._compiledHostTemplateCache.set(compType, compiledTemplate);
        }
        return compiledTemplate;
    };
    /**
     * @param {?} compMeta
     * @param {?} ngModule
     * @return {?}
     */
    JitCompiler.prototype._createCompiledTemplate = /**
     * @param {?} compMeta
     * @param {?} ngModule
     * @return {?}
     */
    function (compMeta, ngModule) {
        var /** @type {?} */ compiledTemplate = this._compiledTemplateCache.get(compMeta.type.reference);
        if (!compiledTemplate) {
            assertComponent(compMeta);
            compiledTemplate = new CompiledTemplate(false, compMeta.type, compMeta, ngModule, ngModule.transitiveModule.directives);
            this._compiledTemplateCache.set(compMeta.type.reference, compiledTemplate);
        }
        return compiledTemplate;
    };
    /**
     * @param {?} template
     * @return {?}
     */
    JitCompiler.prototype._compileTemplate = /**
     * @param {?} template
     * @return {?}
     */
    function (template) {
        var _this = this;
        if (template.isCompiled) {
            return;
        }
        var /** @type {?} */ compMeta = template.compMeta;
        var /** @type {?} */ externalStylesheetsByModuleUrl = new Map();
        var /** @type {?} */ outputContext = createOutputContext();
        var /** @type {?} */ componentStylesheet = this._styleCompiler.compileComponent(outputContext, compMeta); /** @type {?} */
        ((compMeta.template)).externalStylesheets.forEach(function (stylesheetMeta) {
            var /** @type {?} */ compiledStylesheet = _this._styleCompiler.compileStyles(createOutputContext(), compMeta, stylesheetMeta);
            externalStylesheetsByModuleUrl.set(/** @type {?} */ ((stylesheetMeta.moduleUrl)), compiledStylesheet);
        });
        this._resolveStylesCompileResult(componentStylesheet, externalStylesheetsByModuleUrl);
        var /** @type {?} */ pipes = template.ngModule.transitiveModule.pipes.map(function (pipe) { return _this._metadataResolver.getPipeSummary(pipe.reference); });
        var _a = this._parseTemplate(compMeta, template.ngModule, template.directives), parsedTemplate = _a.template, usedPipes = _a.pipes;
        var /** @type {?} */ compileResult = this._viewCompiler.compileComponent(outputContext, compMeta, parsedTemplate, ir.variable(componentStylesheet.stylesVar), usedPipes);
        var /** @type {?} */ evalResult = this._interpretOrJit(templateJitUrl(template.ngModule.type, template.compMeta), outputContext.statements);
        var /** @type {?} */ viewClass = evalResult[compileResult.viewClassVar];
        var /** @type {?} */ rendererType = evalResult[compileResult.rendererTypeVar];
        template.compiled(viewClass, rendererType);
    };
    /**
     * @param {?} compMeta
     * @param {?} ngModule
     * @param {?} directiveIdentifiers
     * @return {?}
     */
    JitCompiler.prototype._parseTemplate = /**
     * @param {?} compMeta
     * @param {?} ngModule
     * @param {?} directiveIdentifiers
     * @return {?}
     */
    function (compMeta, ngModule, directiveIdentifiers) {
        var _this = this;
        // Note: ! is ok here as components always have a template.
        var /** @type {?} */ preserveWhitespaces = /** @type {?} */ ((compMeta.template)).preserveWhitespaces;
        var /** @type {?} */ directives = directiveIdentifiers.map(function (dir) { return _this._metadataResolver.getDirectiveSummary(dir.reference); });
        var /** @type {?} */ pipes = ngModule.transitiveModule.pipes.map(function (pipe) { return _this._metadataResolver.getPipeSummary(pipe.reference); });
        return this._templateParser.parse(compMeta, /** @type {?} */ ((/** @type {?} */ ((compMeta.template)).htmlAst)), directives, pipes, ngModule.schemas, templateSourceUrl(ngModule.type, compMeta, /** @type {?} */ ((compMeta.template))), preserveWhitespaces);
    };
    /**
     * @param {?} result
     * @param {?} externalStylesheetsByModuleUrl
     * @return {?}
     */
    JitCompiler.prototype._resolveStylesCompileResult = /**
     * @param {?} result
     * @param {?} externalStylesheetsByModuleUrl
     * @return {?}
     */
    function (result, externalStylesheetsByModuleUrl) {
        var _this = this;
        result.dependencies.forEach(function (dep, i) {
            var /** @type {?} */ nestedCompileResult = /** @type {?} */ ((externalStylesheetsByModuleUrl.get(dep.moduleUrl)));
            var /** @type {?} */ nestedStylesArr = _this._resolveAndEvalStylesCompileResult(nestedCompileResult, externalStylesheetsByModuleUrl);
            dep.setValue(nestedStylesArr);
        });
    };
    /**
     * @param {?} result
     * @param {?} externalStylesheetsByModuleUrl
     * @return {?}
     */
    JitCompiler.prototype._resolveAndEvalStylesCompileResult = /**
     * @param {?} result
     * @param {?} externalStylesheetsByModuleUrl
     * @return {?}
     */
    function (result, externalStylesheetsByModuleUrl) {
        this._resolveStylesCompileResult(result, externalStylesheetsByModuleUrl);
        return this._interpretOrJit(sharedStylesheetJitUrl(result.meta, this._sharedStylesheetCount++), result.outputCtx.statements)[result.stylesVar];
    };
    /**
     * @param {?} sourceUrl
     * @param {?} statements
     * @return {?}
     */
    JitCompiler.prototype._interpretOrJit = /**
     * @param {?} sourceUrl
     * @param {?} statements
     * @return {?}
     */
    function (sourceUrl, statements) {
        if (!this._compilerConfig.useJit) {
            return interpretStatements(statements, this._reflector);
        }
        else {
            return jitStatements(sourceUrl, statements, this._reflector, this._compilerConfig.jitDevMode);
        }
    };
    return JitCompiler;
}());
/**
 * An internal module of the Angular compiler that begins with component types,
 * extracts templates, and eventually produces a compiled version of the component
 * ready for linking into an application.
 *
 * \@security When compiling templates at runtime, you must ensure that the entire template comes
 * from a trusted source. Attacker-controlled data introduced by a template could expose your
 * application to XSS risks.  For more detail, see the [Security Guide](http://g.co/ng/security).
 */
export { JitCompiler };
function JitCompiler_tsickle_Closure_declarations() {
    /** @type {?} */
    JitCompiler.prototype._compiledTemplateCache;
    /** @type {?} */
    JitCompiler.prototype._compiledHostTemplateCache;
    /** @type {?} */
    JitCompiler.prototype._compiledDirectiveWrapperCache;
    /** @type {?} */
    JitCompiler.prototype._compiledNgModuleCache;
    /** @type {?} */
    JitCompiler.prototype._sharedStylesheetCount;
    /** @type {?} */
    JitCompiler.prototype._addedAotSummaries;
    /** @type {?} */
    JitCompiler.prototype._metadataResolver;
    /** @type {?} */
    JitCompiler.prototype._templateParser;
    /** @type {?} */
    JitCompiler.prototype._styleCompiler;
    /** @type {?} */
    JitCompiler.prototype._viewCompiler;
    /** @type {?} */
    JitCompiler.prototype._ngModuleCompiler;
    /** @type {?} */
    JitCompiler.prototype._summaryResolver;
    /** @type {?} */
    JitCompiler.prototype._reflector;
    /** @type {?} */
    JitCompiler.prototype._compilerConfig;
    /** @type {?} */
    JitCompiler.prototype._console;
    /** @type {?} */
    JitCompiler.prototype.getExtraNgModuleProviders;
}
var CompiledTemplate = /** @class */ (function () {
    function CompiledTemplate(isHost, compType, compMeta, ngModule, directives) {
        this.isHost = isHost;
        this.compType = compType;
        this.compMeta = compMeta;
        this.ngModule = ngModule;
        this.directives = directives;
        this._viewClass = /** @type {?} */ ((null));
        this.isCompiled = false;
    }
    /**
     * @param {?} viewClass
     * @param {?} rendererType
     * @return {?}
     */
    CompiledTemplate.prototype.compiled = /**
     * @param {?} viewClass
     * @param {?} rendererType
     * @return {?}
     */
    function (viewClass, rendererType) {
        this._viewClass = viewClass;
        (/** @type {?} */ (this.compMeta.componentViewType)).setDelegate(viewClass);
        for (var /** @type {?} */ prop in rendererType) {
            (/** @type {?} */ (this.compMeta.rendererType))[prop] = rendererType[prop];
        }
        this.isCompiled = true;
    };
    return CompiledTemplate;
}());
function CompiledTemplate_tsickle_Closure_declarations() {
    /** @type {?} */
    CompiledTemplate.prototype._viewClass;
    /** @type {?} */
    CompiledTemplate.prototype.isCompiled;
    /** @type {?} */
    CompiledTemplate.prototype.isHost;
    /** @type {?} */
    CompiledTemplate.prototype.compType;
    /** @type {?} */
    CompiledTemplate.prototype.compMeta;
    /** @type {?} */
    CompiledTemplate.prototype.ngModule;
    /** @type {?} */
    CompiledTemplate.prototype.directives;
}
/**
 * @param {?} meta
 * @return {?}
 */
function assertComponent(meta) {
    if (!meta.isComponent) {
        throw new Error("Could not compile '" + identifierName(meta.type) + "' because it is not a component.");
    }
}
/**
 * @return {?}
 */
function createOutputContext() {
    var /** @type {?} */ importExpr = function (symbol) {
        return ir.importExpr({ name: identifierName(symbol), moduleName: null, runtime: symbol });
    };
    return { statements: [], genFilePath: '', importExpr: importExpr, constantPool: new ConstantPool() };
}
//# sourceMappingURL=compiler.js.map