/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Compiler, Injector, ModuleWithComponentFactories } from '@angular/core';
import { AnimationCompiler } from '../animation/animation_compiler';
import { AnimationParser } from '../animation/animation_parser';
import { ProviderMeta, createHostComponentMeta, identifierName } from '../compile_metadata';
import { CompilerConfig } from '../config';
import { DirectiveWrapperCompiler } from '../directive_wrapper_compiler';
import { stringify } from '../facade/lang';
import { CompilerInjectable } from '../injectable';
import { CompileMetadataResolver } from '../metadata_resolver';
import { NgModuleCompiler } from '../ng_module_compiler';
import * as ir from '../output/output_ast';
import { interpretStatements } from '../output/output_interpreter';
import { jitStatements } from '../output/output_jit';
import { view_utils } from '../private_import_core';
import { StyleCompiler } from '../style_compiler';
import { TemplateParser } from '../template_parser/template_parser';
import { SyncAsyncResult } from '../util';
import { ViewCompiler } from '../view_compiler/view_compiler';
/**
 * An internal module of the Angular compiler that begins with component types,
 * extracts templates, and eventually produces a compiled version of the component
 * ready for linking into an application.
 *
 * \@security When compiling templates at runtime, you must ensure that the entire template comes
 * from a trusted source. Attacker-controlled data introduced by a template could expose your
 * application to XSS risks.  For more detail, see the [Security Guide](http://g.co/ng/security).
 */
var JitCompiler = (function () {
    /**
     * @param {?} _injector
     * @param {?} _metadataResolver
     * @param {?} _templateParser
     * @param {?} _styleCompiler
     * @param {?} _viewCompiler
     * @param {?} _ngModuleCompiler
     * @param {?} _directiveWrapperCompiler
     * @param {?} _compilerConfig
     * @param {?} _animationParser
     */
    function JitCompiler(_injector, _metadataResolver, _templateParser, _styleCompiler, _viewCompiler, _ngModuleCompiler, _directiveWrapperCompiler, _compilerConfig, _animationParser) {
        this._injector = _injector;
        this._metadataResolver = _metadataResolver;
        this._templateParser = _templateParser;
        this._styleCompiler = _styleCompiler;
        this._viewCompiler = _viewCompiler;
        this._ngModuleCompiler = _ngModuleCompiler;
        this._directiveWrapperCompiler = _directiveWrapperCompiler;
        this._compilerConfig = _compilerConfig;
        this._animationParser = _animationParser;
        this._compiledTemplateCache = new Map();
        this._compiledHostTemplateCache = new Map();
        this._compiledDirectiveWrapperCache = new Map();
        this._compiledNgModuleCache = new Map();
        this._animationCompiler = new AnimationCompiler();
    }
    Object.defineProperty(JitCompiler.prototype, "injector", {
        /**
         * @return {?}
         */
        get: function () { return this._injector; },
        enumerable: true,
        configurable: true
    });
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype.compileModuleSync = function (moduleType) {
        return this._compileModuleAndComponents(moduleType, true).syncResult;
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype.compileModuleAsync = function (moduleType) {
        return this._compileModuleAndComponents(moduleType, false).asyncResult;
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype.compileModuleAndAllComponentsSync = function (moduleType) {
        return this._compileModuleAndAllComponents(moduleType, true).syncResult;
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype.compileModuleAndAllComponentsAsync = function (moduleType) {
        return this._compileModuleAndAllComponents(moduleType, false).asyncResult;
    };
    /**
     * @param {?} component
     * @return {?}
     */
    JitCompiler.prototype.getNgContentSelectors = function (component) {
        var /** @type {?} */ template = this._compiledTemplateCache.get(component);
        if (!template) {
            throw new Error("The component " + stringify(component) + " is not yet compiled!");
        }
        return template.compMeta.template.ngContentSelectors;
    };
    /**
     * @param {?} moduleType
     * @param {?} isSync
     * @return {?}
     */
    JitCompiler.prototype._compileModuleAndComponents = function (moduleType, isSync) {
        var _this = this;
        var /** @type {?} */ loadingPromise = this._loadModules(moduleType, isSync);
        var /** @type {?} */ createResult = function () {
            _this._compileComponents(moduleType, null);
            return _this._compileModule(moduleType);
        };
        if (isSync) {
            return new SyncAsyncResult(createResult());
        }
        else {
            return new SyncAsyncResult(null, loadingPromise.then(createResult));
        }
    };
    /**
     * @param {?} moduleType
     * @param {?} isSync
     * @return {?}
     */
    JitCompiler.prototype._compileModuleAndAllComponents = function (moduleType, isSync) {
        var _this = this;
        var /** @type {?} */ loadingPromise = this._loadModules(moduleType, isSync);
        var /** @type {?} */ createResult = function () {
            var /** @type {?} */ componentFactories = [];
            _this._compileComponents(moduleType, componentFactories);
            return new ModuleWithComponentFactories(_this._compileModule(moduleType), componentFactories);
        };
        if (isSync) {
            return new SyncAsyncResult(createResult());
        }
        else {
            return new SyncAsyncResult(null, loadingPromise.then(createResult));
        }
    };
    /**
     * @param {?} mainModule
     * @param {?} isSync
     * @return {?}
     */
    JitCompiler.prototype._loadModules = function (mainModule, isSync) {
        var _this = this;
        var /** @type {?} */ loadingPromises = [];
        var /** @type {?} */ ngModule = this._metadataResolver.getNgModuleMetadata(mainModule);
        // Note: the loadingPromise for a module only includes the loading of the exported directives
        // of imported modules.
        // However, for runtime compilation, we want to transitively compile all modules,
        // so we also need to call loadNgModuleDirectiveAndPipeMetadata for all nested modules.
        ngModule.transitiveModule.modules.forEach(function (localModuleMeta) {
            loadingPromises.push(_this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(localModuleMeta.reference, isSync));
        });
        return Promise.all(loadingPromises);
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    JitCompiler.prototype._compileModule = function (moduleType) {
        var _this = this;
        var /** @type {?} */ ngModuleFactory = this._compiledNgModuleCache.get(moduleType);
        if (!ngModuleFactory) {
            var /** @type {?} */ moduleMeta_1 = this._metadataResolver.getNgModuleMetadata(moduleType);
            // Always provide a bound Compiler
            var /** @type {?} */ extraProviders = [this._metadataResolver.getProviderMetadata(new ProviderMeta(Compiler, { useFactory: function () { return new ModuleBoundCompiler(_this, moduleMeta_1.type.reference); } }))];
            var /** @type {?} */ compileResult = this._ngModuleCompiler.compile(moduleMeta_1, extraProviders);
            if (!this._compilerConfig.useJit) {
                ngModuleFactory =
                    interpretStatements(compileResult.statements, [compileResult.ngModuleFactoryVar])[0];
            }
            else {
                ngModuleFactory = jitStatements("/" + identifierName(moduleMeta_1.type) + "/module.ngfactory.js", compileResult.statements, [compileResult.ngModuleFactoryVar])[0];
            }
            this._compiledNgModuleCache.set(moduleMeta_1.type.reference, ngModuleFactory);
        }
        return ngModuleFactory;
    };
    /**
     * \@internal
     * @param {?} mainModule
     * @param {?} allComponentFactories
     * @return {?}
     */
    JitCompiler.prototype._compileComponents = function (mainModule, allComponentFactories) {
        var _this = this;
        var /** @type {?} */ ngModule = this._metadataResolver.getNgModuleMetadata(mainModule);
        var /** @type {?} */ moduleByDirective = new Map();
        var /** @type {?} */ templates = new Set();
        ngModule.transitiveModule.modules.forEach(function (localModuleSummary) {
            var /** @type {?} */ localModuleMeta = _this._metadataResolver.getNgModuleMetadata(localModuleSummary.reference);
            localModuleMeta.declaredDirectives.forEach(function (dirIdentifier) {
                moduleByDirective.set(dirIdentifier.reference, localModuleMeta);
                var /** @type {?} */ dirMeta = _this._metadataResolver.getDirectiveMetadata(dirIdentifier.reference);
                _this._compileDirectiveWrapper(dirMeta, localModuleMeta);
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
        ngModule.transitiveModule.modules.forEach(function (localModuleSummary) {
            var /** @type {?} */ localModuleMeta = _this._metadataResolver.getNgModuleMetadata(localModuleSummary.reference);
            localModuleMeta.declaredDirectives.forEach(function (dirIdentifier) {
                var /** @type {?} */ dirMeta = _this._metadataResolver.getDirectiveMetadata(dirIdentifier.reference);
                if (dirMeta.isComponent) {
                    dirMeta.entryComponents.forEach(function (entryComponentType) {
                        var /** @type {?} */ moduleMeta = moduleByDirective.get(entryComponentType.componentType);
                        templates.add(_this._createCompiledHostTemplate(entryComponentType.componentType, moduleMeta));
                    });
                }
            });
            localModuleMeta.entryComponents.forEach(function (entryComponentType) {
                var /** @type {?} */ moduleMeta = moduleByDirective.get(entryComponentType.componentType);
                templates.add(_this._createCompiledHostTemplate(entryComponentType.componentType, moduleMeta));
            });
        });
        templates.forEach(function (template) { return _this._compileTemplate(template); });
    };
    /**
     * @param {?} type
     * @return {?}
     */
    JitCompiler.prototype.clearCacheFor = function (type) {
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
    JitCompiler.prototype.clearCache = function () {
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
    JitCompiler.prototype._createCompiledHostTemplate = function (compType, ngModule) {
        if (!ngModule) {
            throw new Error("Component " + stringify(compType) + " is not part of any NgModule or the module has not been imported into your module.");
        }
        var /** @type {?} */ compiledTemplate = this._compiledHostTemplateCache.get(compType);
        if (!compiledTemplate) {
            var /** @type {?} */ compMeta = this._metadataResolver.getDirectiveMetadata(compType);
            assertComponent(compMeta);
            var /** @type {?} */ componentFactory = (compMeta.componentFactory);
            var /** @type {?} */ hostClass = this._metadataResolver.getHostComponentType(compType);
            var /** @type {?} */ hostMeta = createHostComponentMeta(hostClass, compMeta, /** @type {?} */ (view_utils.getComponentFactoryViewClass(componentFactory)));
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
    JitCompiler.prototype._createCompiledTemplate = function (compMeta, ngModule) {
        var /** @type {?} */ compiledTemplate = this._compiledTemplateCache.get(compMeta.type.reference);
        if (!compiledTemplate) {
            assertComponent(compMeta);
            compiledTemplate = new CompiledTemplate(false, compMeta.type, compMeta, ngModule, ngModule.transitiveModule.directives);
            this._compiledTemplateCache.set(compMeta.type.reference, compiledTemplate);
        }
        return compiledTemplate;
    };
    /**
     * @param {?} dirMeta
     * @param {?} moduleMeta
     * @return {?}
     */
    JitCompiler.prototype._compileDirectiveWrapper = function (dirMeta, moduleMeta) {
        if (this._compilerConfig.useViewEngine) {
            return;
        }
        var /** @type {?} */ compileResult = this._directiveWrapperCompiler.compile(dirMeta);
        var /** @type {?} */ statements = compileResult.statements;
        var /** @type {?} */ directiveWrapperClass;
        if (!this._compilerConfig.useJit) {
            directiveWrapperClass =
                interpretStatements(statements, [compileResult.dirWrapperClassVar])[0];
        }
        else {
            directiveWrapperClass = jitStatements("/" + identifierName(moduleMeta.type) + "/" + identifierName(dirMeta.type) + "/wrapper.ngfactory.js", statements, [compileResult.dirWrapperClassVar])[0];
        }
        ((dirMeta.wrapperType)).setDelegate(directiveWrapperClass);
        this._compiledDirectiveWrapperCache.set(dirMeta.type.reference, directiveWrapperClass);
    };
    /**
     * @param {?} template
     * @return {?}
     */
    JitCompiler.prototype._compileTemplate = function (template) {
        var _this = this;
        if (template.isCompiled) {
            return;
        }
        var /** @type {?} */ compMeta = template.compMeta;
        var /** @type {?} */ externalStylesheetsByModuleUrl = new Map();
        var /** @type {?} */ stylesCompileResult = this._styleCompiler.compileComponent(compMeta);
        stylesCompileResult.externalStylesheets.forEach(function (r) { externalStylesheetsByModuleUrl.set(r.meta.moduleUrl, r); });
        this._resolveStylesCompileResult(stylesCompileResult.componentStylesheet, externalStylesheetsByModuleUrl);
        var /** @type {?} */ parsedAnimations = this._animationParser.parseComponent(compMeta);
        var /** @type {?} */ directives = template.directives.map(function (dir) { return _this._metadataResolver.getDirectiveSummary(dir.reference); });
        var /** @type {?} */ pipes = template.ngModule.transitiveModule.pipes.map(function (pipe) { return _this._metadataResolver.getPipeSummary(pipe.reference); });
        var _a = this._templateParser.parse(compMeta, compMeta.template.template, directives, pipes, template.ngModule.schemas, identifierName(compMeta.type)), parsedTemplate = _a.template, usedPipes = _a.pipes;
        var /** @type {?} */ compiledAnimations = this._animationCompiler.compile(identifierName(compMeta.type), parsedAnimations);
        var /** @type {?} */ compileResult = this._viewCompiler.compileComponent(compMeta, parsedTemplate, ir.variable(stylesCompileResult.componentStylesheet.stylesVar), usedPipes, compiledAnimations);
        var /** @type {?} */ statements = (_b = stylesCompileResult.componentStylesheet.statements).concat.apply(_b, compiledAnimations.map(function (ca) { return ca.statements; })).concat(compileResult.statements);
        var /** @type {?} */ viewClass;
        var /** @type {?} */ rendererType;
        if (!this._compilerConfig.useJit) {
            _c = interpretStatements(statements, [compileResult.viewClassVar, compileResult.rendererTypeVar]), viewClass = _c[0], rendererType = _c[1];
        }
        else {
            var /** @type {?} */ sourceUrl = "/" + identifierName(template.ngModule.type) + "/" + identifierName(template.compType) + "/" + (template.isHost ? 'host' : 'component') + ".ngfactory.js";
            _d = jitStatements(sourceUrl, statements, [compileResult.viewClassVar, compileResult.rendererTypeVar]), viewClass = _d[0], rendererType = _d[1];
        }
        template.compiled(viewClass, rendererType);
        var _b, _c, _d;
    };
    /**
     * @param {?} result
     * @param {?} externalStylesheetsByModuleUrl
     * @return {?}
     */
    JitCompiler.prototype._resolveStylesCompileResult = function (result, externalStylesheetsByModuleUrl) {
        var _this = this;
        result.dependencies.forEach(function (dep, i) {
            var /** @type {?} */ nestedCompileResult = externalStylesheetsByModuleUrl.get(dep.moduleUrl);
            var /** @type {?} */ nestedStylesArr = _this._resolveAndEvalStylesCompileResult(nestedCompileResult, externalStylesheetsByModuleUrl);
            dep.valuePlaceholder.reference = nestedStylesArr;
        });
    };
    /**
     * @param {?} result
     * @param {?} externalStylesheetsByModuleUrl
     * @return {?}
     */
    JitCompiler.prototype._resolveAndEvalStylesCompileResult = function (result, externalStylesheetsByModuleUrl) {
        this._resolveStylesCompileResult(result, externalStylesheetsByModuleUrl);
        if (!this._compilerConfig.useJit) {
            return interpretStatements(result.statements, [result.stylesVar])[0];
        }
        else {
            return jitStatements("/" + result.meta.moduleUrl + ".ngstyle.js", result.statements, [result.stylesVar])[0];
        }
    };
    return JitCompiler;
}());
JitCompiler = __decorate([
    CompilerInjectable(),
    __metadata("design:paramtypes", [Injector,
        CompileMetadataResolver,
        TemplateParser,
        StyleCompiler,
        ViewCompiler,
        NgModuleCompiler,
        DirectiveWrapperCompiler,
        CompilerConfig,
        AnimationParser])
], JitCompiler);
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
    JitCompiler.prototype._animationCompiler;
    /** @type {?} */
    JitCompiler.prototype._injector;
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
    JitCompiler.prototype._directiveWrapperCompiler;
    /** @type {?} */
    JitCompiler.prototype._compilerConfig;
    /** @type {?} */
    JitCompiler.prototype._animationParser;
}
var CompiledTemplate = (function () {
    /**
     * @param {?} isHost
     * @param {?} compType
     * @param {?} compMeta
     * @param {?} ngModule
     * @param {?} directives
     */
    function CompiledTemplate(isHost, compType, compMeta, ngModule, directives) {
        this.isHost = isHost;
        this.compType = compType;
        this.compMeta = compMeta;
        this.ngModule = ngModule;
        this.directives = directives;
        this._viewClass = null;
        this.isCompiled = false;
    }
    /**
     * @param {?} viewClass
     * @param {?} rendererType
     * @return {?}
     */
    CompiledTemplate.prototype.compiled = function (viewClass, rendererType) {
        this._viewClass = viewClass;
        ((this.compMeta.componentViewType)).setDelegate(viewClass);
        for (var /** @type {?} */ prop in rendererType) {
            ((this.compMeta.rendererType))[prop] = rendererType[prop];
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
 * Implements `Compiler` by delegating to the JitCompiler using a known module.
 */
var ModuleBoundCompiler = (function () {
    /**
     * @param {?} _delegate
     * @param {?} _ngModule
     */
    function ModuleBoundCompiler(_delegate, _ngModule) {
        this._delegate = _delegate;
        this._ngModule = _ngModule;
    }
    Object.defineProperty(ModuleBoundCompiler.prototype, "_injector", {
        /**
         * @return {?}
         */
        get: function () { return this._delegate.injector; },
        enumerable: true,
        configurable: true
    });
    /**
     * @param {?} moduleType
     * @return {?}
     */
    ModuleBoundCompiler.prototype.compileModuleSync = function (moduleType) {
        return this._delegate.compileModuleSync(moduleType);
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    ModuleBoundCompiler.prototype.compileModuleAsync = function (moduleType) {
        return this._delegate.compileModuleAsync(moduleType);
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    ModuleBoundCompiler.prototype.compileModuleAndAllComponentsSync = function (moduleType) {
        return this._delegate.compileModuleAndAllComponentsSync(moduleType);
    };
    /**
     * @param {?} moduleType
     * @return {?}
     */
    ModuleBoundCompiler.prototype.compileModuleAndAllComponentsAsync = function (moduleType) {
        return this._delegate.compileModuleAndAllComponentsAsync(moduleType);
    };
    /**
     * @param {?} component
     * @return {?}
     */
    ModuleBoundCompiler.prototype.getNgContentSelectors = function (component) {
        return this._delegate.getNgContentSelectors(component);
    };
    /**
     * Clears all caches
     * @return {?}
     */
    ModuleBoundCompiler.prototype.clearCache = function () { this._delegate.clearCache(); };
    /**
     * Clears the cache for the given component/ngModule.
     * @param {?} type
     * @return {?}
     */
    ModuleBoundCompiler.prototype.clearCacheFor = function (type) { this._delegate.clearCacheFor(type); };
    return ModuleBoundCompiler;
}());
function ModuleBoundCompiler_tsickle_Closure_declarations() {
    /** @type {?} */
    ModuleBoundCompiler.prototype._delegate;
    /** @type {?} */
    ModuleBoundCompiler.prototype._ngModule;
}
//# sourceMappingURL=compiler.js.map