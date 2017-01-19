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
import { Compiler, Injector, ModuleWithComponentFactories } from '@angular/core/index';
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
export let JitCompiler = class JitCompiler {
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
    constructor(_injector, _metadataResolver, _templateParser, _styleCompiler, _viewCompiler, _ngModuleCompiler, _directiveWrapperCompiler, _compilerConfig, _animationParser) {
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
    /**
     * @return {?}
     */
    get injector() { return this._injector; }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    compileModuleSync(moduleType) {
        return this._compileModuleAndComponents(moduleType, true).syncResult;
    }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    compileModuleAsync(moduleType) {
        return this._compileModuleAndComponents(moduleType, false).asyncResult;
    }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    compileModuleAndAllComponentsSync(moduleType) {
        return this._compileModuleAndAllComponents(moduleType, true).syncResult;
    }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    compileModuleAndAllComponentsAsync(moduleType) {
        return this._compileModuleAndAllComponents(moduleType, false).asyncResult;
    }
    /**
     * @param {?} component
     * @return {?}
     */
    getNgContentSelectors(component) {
        const /** @type {?} */ template = this._compiledTemplateCache.get(component);
        if (!template) {
            throw new Error(`The component ${stringify(component)} is not yet compiled!`);
        }
        return template.compMeta.template.ngContentSelectors;
    }
    /**
     * @param {?} moduleType
     * @param {?} isSync
     * @return {?}
     */
    _compileModuleAndComponents(moduleType, isSync) {
        const /** @type {?} */ loadingPromise = this._loadModules(moduleType, isSync);
        const /** @type {?} */ createResult = () => {
            this._compileComponents(moduleType, null);
            return this._compileModule(moduleType);
        };
        if (isSync) {
            return new SyncAsyncResult(createResult());
        }
        else {
            return new SyncAsyncResult(null, loadingPromise.then(createResult));
        }
    }
    /**
     * @param {?} moduleType
     * @param {?} isSync
     * @return {?}
     */
    _compileModuleAndAllComponents(moduleType, isSync) {
        const /** @type {?} */ loadingPromise = this._loadModules(moduleType, isSync);
        const /** @type {?} */ createResult = () => {
            const /** @type {?} */ componentFactories = [];
            this._compileComponents(moduleType, componentFactories);
            return new ModuleWithComponentFactories(this._compileModule(moduleType), componentFactories);
        };
        if (isSync) {
            return new SyncAsyncResult(createResult());
        }
        else {
            return new SyncAsyncResult(null, loadingPromise.then(createResult));
        }
    }
    /**
     * @param {?} mainModule
     * @param {?} isSync
     * @return {?}
     */
    _loadModules(mainModule, isSync) {
        const /** @type {?} */ loadingPromises = [];
        const /** @type {?} */ ngModule = this._metadataResolver.getNgModuleMetadata(mainModule);
        // Note: the loadingPromise for a module only includes the loading of the exported directives
        // of imported modules.
        // However, for runtime compilation, we want to transitively compile all modules,
        // so we also need to call loadNgModuleMetadata for all nested modules.
        ngModule.transitiveModule.modules.forEach((localModuleMeta) => {
            loadingPromises.push(this._metadataResolver.loadNgModuleDirectiveAndPipeMetadata(localModuleMeta.reference, isSync));
        });
        return Promise.all(loadingPromises);
    }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    _compileModule(moduleType) {
        let /** @type {?} */ ngModuleFactory = this._compiledNgModuleCache.get(moduleType);
        if (!ngModuleFactory) {
            const /** @type {?} */ moduleMeta = this._metadataResolver.getNgModuleMetadata(moduleType);
            // Always provide a bound Compiler
            const /** @type {?} */ extraProviders = [this._metadataResolver.getProviderMetadata(new ProviderMeta(Compiler, { useFactory: () => new ModuleBoundCompiler(this, moduleMeta.type.reference) }))];
            const /** @type {?} */ compileResult = this._ngModuleCompiler.compile(moduleMeta, extraProviders);
            if (!this._compilerConfig.useJit) {
                ngModuleFactory =
                    interpretStatements(compileResult.statements, compileResult.ngModuleFactoryVar);
            }
            else {
                ngModuleFactory = jitStatements(`/${identifierName(moduleMeta.type)}/module.ngfactory.js`, compileResult.statements, compileResult.ngModuleFactoryVar);
            }
            this._compiledNgModuleCache.set(moduleMeta.type.reference, ngModuleFactory);
        }
        return ngModuleFactory;
    }
    /**
     * \@internal
     * @param {?} mainModule
     * @param {?} allComponentFactories
     * @return {?}
     */
    _compileComponents(mainModule, allComponentFactories) {
        const /** @type {?} */ ngModule = this._metadataResolver.getNgModuleMetadata(mainModule);
        const /** @type {?} */ moduleByDirective = new Map();
        const /** @type {?} */ templates = new Set();
        ngModule.transitiveModule.modules.forEach((localModuleSummary) => {
            const /** @type {?} */ localModuleMeta = this._metadataResolver.getNgModuleMetadata(localModuleSummary.reference);
            localModuleMeta.declaredDirectives.forEach((dirIdentifier) => {
                moduleByDirective.set(dirIdentifier.reference, localModuleMeta);
                const /** @type {?} */ dirMeta = this._metadataResolver.getDirectiveMetadata(dirIdentifier.reference);
                this._compileDirectiveWrapper(dirMeta, localModuleMeta);
                if (dirMeta.isComponent) {
                    templates.add(this._createCompiledTemplate(dirMeta, localModuleMeta));
                    if (allComponentFactories) {
                        const /** @type {?} */ template = this._createCompiledHostTemplate(dirMeta.type.reference, localModuleMeta);
                        templates.add(template);
                        allComponentFactories.push(/** @type {?} */ (dirMeta.componentFactory));
                    }
                }
            });
        });
        ngModule.transitiveModule.modules.forEach((localModuleSummary) => {
            const /** @type {?} */ localModuleMeta = this._metadataResolver.getNgModuleMetadata(localModuleSummary.reference);
            localModuleMeta.declaredDirectives.forEach((dirIdentifier) => {
                const /** @type {?} */ dirMeta = this._metadataResolver.getDirectiveMetadata(dirIdentifier.reference);
                if (dirMeta.isComponent) {
                    dirMeta.entryComponents.forEach((entryComponentType) => {
                        const /** @type {?} */ moduleMeta = moduleByDirective.get(entryComponentType.componentType);
                        templates.add(this._createCompiledHostTemplate(entryComponentType.componentType, moduleMeta));
                    });
                }
            });
            localModuleMeta.entryComponents.forEach((entryComponentType) => {
                const /** @type {?} */ moduleMeta = moduleByDirective.get(entryComponentType.componentType);
                templates.add(this._createCompiledHostTemplate(entryComponentType.componentType, moduleMeta));
            });
        });
        templates.forEach((template) => this._compileTemplate(template));
    }
    /**
     * @param {?} type
     * @return {?}
     */
    clearCacheFor(type) {
        this._compiledNgModuleCache.delete(type);
        this._metadataResolver.clearCacheFor(type);
        this._compiledHostTemplateCache.delete(type);
        const /** @type {?} */ compiledTemplate = this._compiledTemplateCache.get(type);
        if (compiledTemplate) {
            this._compiledTemplateCache.delete(type);
        }
    }
    /**
     * @return {?}
     */
    clearCache() {
        this._metadataResolver.clearCache();
        this._compiledTemplateCache.clear();
        this._compiledHostTemplateCache.clear();
        this._compiledNgModuleCache.clear();
    }
    /**
     * @param {?} compType
     * @param {?} ngModule
     * @return {?}
     */
    _createCompiledHostTemplate(compType, ngModule) {
        if (!ngModule) {
            throw new Error(`Component ${stringify(compType)} is not part of any NgModule or the module has not been imported into your module.`);
        }
        let /** @type {?} */ compiledTemplate = this._compiledHostTemplateCache.get(compType);
        if (!compiledTemplate) {
            const /** @type {?} */ compMeta = this._metadataResolver.getDirectiveMetadata(compType);
            assertComponent(compMeta);
            const /** @type {?} */ componentFactory = (compMeta.componentFactory);
            const /** @type {?} */ hostClass = this._metadataResolver.getHostComponentType(compType);
            const /** @type {?} */ hostMeta = createHostComponentMeta(hostClass, compMeta, /** @type {?} */ (view_utils.getComponentFactoryViewClass(componentFactory)));
            compiledTemplate =
                new CompiledTemplate(true, compMeta.type, hostMeta, ngModule, [compMeta.type]);
            this._compiledHostTemplateCache.set(compType, compiledTemplate);
        }
        return compiledTemplate;
    }
    /**
     * @param {?} compMeta
     * @param {?} ngModule
     * @return {?}
     */
    _createCompiledTemplate(compMeta, ngModule) {
        let /** @type {?} */ compiledTemplate = this._compiledTemplateCache.get(compMeta.type.reference);
        if (!compiledTemplate) {
            assertComponent(compMeta);
            compiledTemplate = new CompiledTemplate(false, compMeta.type, compMeta, ngModule, ngModule.transitiveModule.directives);
            this._compiledTemplateCache.set(compMeta.type.reference, compiledTemplate);
        }
        return compiledTemplate;
    }
    /**
     * @param {?} dirMeta
     * @param {?} moduleMeta
     * @return {?}
     */
    _compileDirectiveWrapper(dirMeta, moduleMeta) {
        const /** @type {?} */ compileResult = this._directiveWrapperCompiler.compile(dirMeta);
        const /** @type {?} */ statements = compileResult.statements;
        let /** @type {?} */ directiveWrapperClass;
        if (!this._compilerConfig.useJit) {
            directiveWrapperClass = interpretStatements(statements, compileResult.dirWrapperClassVar);
        }
        else {
            directiveWrapperClass = jitStatements(`/${identifierName(moduleMeta.type)}/${identifierName(dirMeta.type)}/wrapper.ngfactory.js`, statements, compileResult.dirWrapperClassVar);
        }
        ((dirMeta.wrapperType)).setDelegate(directiveWrapperClass);
        this._compiledDirectiveWrapperCache.set(dirMeta.type.reference, directiveWrapperClass);
    }
    /**
     * @param {?} template
     * @return {?}
     */
    _compileTemplate(template) {
        if (template.isCompiled) {
            return;
        }
        const /** @type {?} */ compMeta = template.compMeta;
        const /** @type {?} */ externalStylesheetsByModuleUrl = new Map();
        const /** @type {?} */ stylesCompileResult = this._styleCompiler.compileComponent(compMeta);
        stylesCompileResult.externalStylesheets.forEach((r) => { externalStylesheetsByModuleUrl.set(r.meta.moduleUrl, r); });
        this._resolveStylesCompileResult(stylesCompileResult.componentStylesheet, externalStylesheetsByModuleUrl);
        const /** @type {?} */ parsedAnimations = this._animationParser.parseComponent(compMeta);
        const /** @type {?} */ directives = template.directives.map(dir => this._metadataResolver.getDirectiveSummary(dir.reference));
        const /** @type {?} */ pipes = template.ngModule.transitiveModule.pipes.map(pipe => this._metadataResolver.getPipeSummary(pipe.reference));
        const /** @type {?} */ parsedTemplate = this._templateParser.parse(compMeta, compMeta.template.template, directives, pipes, template.ngModule.schemas, identifierName(compMeta.type));
        const /** @type {?} */ compiledAnimations = this._animationCompiler.compile(identifierName(compMeta.type), parsedAnimations);
        const /** @type {?} */ compileResult = this._viewCompiler.compileComponent(compMeta, parsedTemplate, ir.variable(stylesCompileResult.componentStylesheet.stylesVar), pipes, compiledAnimations);
        const /** @type {?} */ statements = stylesCompileResult.componentStylesheet.statements
            .concat(...compiledAnimations.map(ca => ca.statements))
            .concat(compileResult.statements);
        let /** @type {?} */ viewClass;
        if (!this._compilerConfig.useJit) {
            viewClass = interpretStatements(statements, compileResult.viewClassVar);
        }
        else {
            viewClass = jitStatements(`/${identifierName(template.ngModule.type)}/${identifierName(template.compType)}/${template.isHost ? 'host' : 'component'}.ngfactory.js`, statements, compileResult.viewClassVar);
        }
        template.compiled(viewClass);
    }
    /**
     * @param {?} result
     * @param {?} externalStylesheetsByModuleUrl
     * @return {?}
     */
    _resolveStylesCompileResult(result, externalStylesheetsByModuleUrl) {
        result.dependencies.forEach((dep, i) => {
            const /** @type {?} */ nestedCompileResult = externalStylesheetsByModuleUrl.get(dep.moduleUrl);
            const /** @type {?} */ nestedStylesArr = this._resolveAndEvalStylesCompileResult(nestedCompileResult, externalStylesheetsByModuleUrl);
            dep.valuePlaceholder.reference = nestedStylesArr;
        });
    }
    /**
     * @param {?} result
     * @param {?} externalStylesheetsByModuleUrl
     * @return {?}
     */
    _resolveAndEvalStylesCompileResult(result, externalStylesheetsByModuleUrl) {
        this._resolveStylesCompileResult(result, externalStylesheetsByModuleUrl);
        if (!this._compilerConfig.useJit) {
            return interpretStatements(result.statements, result.stylesVar);
        }
        else {
            return jitStatements(`/${result.meta.moduleUrl}.ngstyle.js`, result.statements, result.stylesVar);
        }
    }
};
JitCompiler = __decorate([
    CompilerInjectable(), 
    __metadata('design:paramtypes', [(typeof (_a = typeof Injector !== 'undefined' && Injector) === 'function' && _a) || Object, CompileMetadataResolver, TemplateParser, StyleCompiler, ViewCompiler, NgModuleCompiler, DirectiveWrapperCompiler, CompilerConfig, AnimationParser])
], JitCompiler);
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
class CompiledTemplate {
    /**
     * @param {?} isHost
     * @param {?} compType
     * @param {?} compMeta
     * @param {?} ngModule
     * @param {?} directives
     */
    constructor(isHost, compType, compMeta, ngModule, directives) {
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
     * @return {?}
     */
    compiled(viewClass) {
        this._viewClass = viewClass;
        ((this.compMeta.componentViewType)).setDelegate(viewClass);
        this.isCompiled = true;
    }
}
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
        throw new Error(`Could not compile '${identifierName(meta.type)}' because it is not a component.`);
    }
}
/**
 * Implements `Compiler` by delegating to the JitCompiler using a known module.
 */
class ModuleBoundCompiler {
    /**
     * @param {?} _delegate
     * @param {?} _ngModule
     */
    constructor(_delegate, _ngModule) {
        this._delegate = _delegate;
        this._ngModule = _ngModule;
    }
    /**
     * @return {?}
     */
    get _injector() { return this._delegate.injector; }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    compileModuleSync(moduleType) {
        return this._delegate.compileModuleSync(moduleType);
    }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    compileModuleAsync(moduleType) {
        return this._delegate.compileModuleAsync(moduleType);
    }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    compileModuleAndAllComponentsSync(moduleType) {
        return this._delegate.compileModuleAndAllComponentsSync(moduleType);
    }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    compileModuleAndAllComponentsAsync(moduleType) {
        return this._delegate.compileModuleAndAllComponentsAsync(moduleType);
    }
    /**
     * @param {?} component
     * @return {?}
     */
    getNgContentSelectors(component) {
        return this._delegate.getNgContentSelectors(component);
    }
    /**
     * Clears all caches
     * @return {?}
     */
    clearCache() { this._delegate.clearCache(); }
    /**
     * Clears the cache for the given component/ngModule.
     * @param {?} type
     * @return {?}
     */
    clearCacheFor(type) { this._delegate.clearCacheFor(type); }
}
function ModuleBoundCompiler_tsickle_Closure_declarations() {
    /** @type {?} */
    ModuleBoundCompiler.prototype._delegate;
    /** @type {?} */
    ModuleBoundCompiler.prototype._ngModule;
}
var _a;
//# sourceMappingURL=compiler.js.map