/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Compiler, ComponentFactory, ComponentResolver, ComponentStillLoadingError, Injectable, Injector, OptionalMetadata, Provider, SkipSelfMetadata } from '@angular/core';
import { BaseException } from '../src/facade/exceptions';
import { IS_DART, isBlank, isString } from '../src/facade/lang';
import { PromiseWrapper } from '../src/facade/async';
import { createHostComponentMeta } from './compile_metadata';
import { StyleCompiler } from './style_compiler';
import { ViewCompiler, ViewFactoryDependency, ComponentFactoryDependency } from './view_compiler/view_compiler';
import { AppModuleCompiler } from './app_module_compiler';
import { TemplateParser } from './template_parser';
import { DirectiveNormalizer } from './directive_normalizer';
import { CompileMetadataResolver } from './metadata_resolver';
import { CompilerConfig } from './config';
import * as ir from './output/output_ast';
import { jitStatements } from './output/output_jit';
import { interpretStatements } from './output/output_interpreter';
import { SyncAsyncResult } from './util';
export class RuntimeCompiler {
    constructor(_injector, _metadataResolver, _templateNormalizer, _templateParser, _styleCompiler, _viewCompiler, _appModuleCompiler, _genConfig) {
        this._injector = _injector;
        this._metadataResolver = _metadataResolver;
        this._templateNormalizer = _templateNormalizer;
        this._templateParser = _templateParser;
        this._styleCompiler = _styleCompiler;
        this._viewCompiler = _viewCompiler;
        this._appModuleCompiler = _appModuleCompiler;
        this._genConfig = _genConfig;
        this._compiledTemplateCache = new Map();
        this._compiledHostTemplateCache = new Map();
        this._compiledAppModuleCache = new Map();
    }
    get injector() { return this._injector; }
    resolveComponent(component) {
        if (isString(component)) {
            return PromiseWrapper.reject(new BaseException(`Cannot resolve component using '${component}'.`), null);
        }
        return this.compileComponentAsync(component);
    }
    compileAppModuleSync(moduleType, metadata = null) {
        return this._compileAppModule(moduleType, true, metadata).syncResult;
    }
    compileAppModuleAsync(moduleType, metadata = null) {
        return this._compileAppModule(moduleType, false, metadata).asyncResult;
    }
    _compileAppModule(moduleType, isSync, metadata = null) {
        // Only cache if we read the metadata via the reflector,
        // as we use the moduleType as cache key.
        let useCache = !metadata;
        let appModuleFactory = this._compiledAppModuleCache.get(moduleType);
        let componentCompilePromises = [];
        if (!appModuleFactory || !useCache) {
            var compileModuleMeta = this._metadataResolver.getAppModuleMetadata(moduleType, metadata);
            let boundCompilerFactory = (parentResolver) => new BoundCompiler(this, compileModuleMeta.directives.map(dir => dir.type.runtime), compileModuleMeta.pipes.map((pipe) => pipe.type.runtime), parentResolver);
            // Always provide a bound Compiler and ComponentResolver
            compileModuleMeta.providers.push(this._metadataResolver.getProviderMetadata(new Provider(Compiler, {
                useFactory: boundCompilerFactory,
                deps: [[new OptionalMetadata(), new SkipSelfMetadata(), ComponentResolver]]
            })));
            compileModuleMeta.providers.push(this._metadataResolver.getProviderMetadata(new Provider(ComponentResolver, { useExisting: Compiler })));
            var compileResult = this._appModuleCompiler.compile(compileModuleMeta);
            compileResult.dependencies.forEach((dep) => {
                let compileResult = this._compileComponent(dep.comp.runtime, isSync, compileModuleMeta.directives.map(compileType => compileType.runtime), compileModuleMeta.pipes.map(compileType => compileType.runtime));
                dep.placeholder.runtime = compileResult.syncResult;
                componentCompilePromises.push(compileResult.asyncResult);
                dep.placeholder.name = `compFactory_${dep.comp.name}`;
            });
            if (IS_DART || !this._genConfig.useJit) {
                appModuleFactory =
                    interpretStatements(compileResult.statements, compileResult.appModuleFactoryVar);
            }
            else {
                appModuleFactory = jitStatements(`${compileModuleMeta.type.name}.ngfactory.js`, compileResult.statements, compileResult.appModuleFactoryVar);
            }
            if (useCache) {
                this._compiledAppModuleCache.set(moduleType, appModuleFactory);
            }
        }
        return new SyncAsyncResult(appModuleFactory, Promise.all(componentCompilePromises).then(() => appModuleFactory));
    }
    compileComponentAsync(compType) {
        return this._compileComponent(compType, false, [], []).asyncResult;
    }
    compileComponentSync(compType) {
        return this._compileComponent(compType, true, [], []).syncResult;
    }
    /**
     * @internal
     */
    _compileComponent(compType, isSync, moduleDirectives, modulePipes) {
        var templates = this._getTransitiveCompiledTemplates(compType, true, moduleDirectives, modulePipes);
        var loadingPromises = [];
        templates.forEach((template) => {
            if (template.loading) {
                if (isSync) {
                    throw new ComponentStillLoadingError(template.compType.runtime);
                }
                else {
                    loadingPromises.push(template.loading);
                }
            }
        });
        let compile = () => { templates.forEach((template) => { this._compileTemplate(template); }); };
        if (isSync) {
            compile();
        }
        let result = this._compiledHostTemplateCache.get(compType).proxyComponentFactory;
        return new SyncAsyncResult(result, Promise.all(loadingPromises).then(() => {
            compile();
            return result;
        }));
    }
    clearCacheFor(type) {
        this._compiledAppModuleCache.delete(type);
        this._metadataResolver.clearCacheFor(type);
        this._compiledHostTemplateCache.delete(type);
        var compiledTemplate = this._compiledTemplateCache.get(type);
        if (compiledTemplate) {
            this._templateNormalizer.clearCacheFor(compiledTemplate.normalizedCompMeta);
            this._compiledTemplateCache.delete(type);
        }
    }
    clearCache() {
        this._metadataResolver.clearCache();
        this._compiledTemplateCache.clear();
        this._compiledHostTemplateCache.clear();
        this._templateNormalizer.clearCache();
        this._compiledAppModuleCache.clear();
    }
    _createCompiledHostTemplate(type) {
        var compiledTemplate = this._compiledHostTemplateCache.get(type);
        if (isBlank(compiledTemplate)) {
            var compMeta = this._metadataResolver.getDirectiveMetadata(type);
            assertComponent(compMeta);
            var hostMeta = createHostComponentMeta(compMeta.type, compMeta.selector);
            compiledTemplate = new CompiledTemplate(true, compMeta.selector, compMeta.type, [], [type], [], [], this._templateNormalizer.normalizeDirective(hostMeta));
            this._compiledHostTemplateCache.set(type, compiledTemplate);
        }
        return compiledTemplate;
    }
    _createCompiledTemplate(type, moduleDirectives, modulePipes) {
        var compiledTemplate = this._compiledTemplateCache.get(type);
        if (isBlank(compiledTemplate)) {
            var compMeta = this._metadataResolver.getDirectiveMetadata(type);
            assertComponent(compMeta);
            var viewDirectives = [];
            moduleDirectives.forEach((type) => viewDirectives.push(this._metadataResolver.getDirectiveMetadata(type)));
            var viewComponentTypes = [];
            this._metadataResolver.getViewDirectivesMetadata(type).forEach(dirOrComp => {
                if (dirOrComp.isComponent) {
                    viewComponentTypes.push(dirOrComp.type.runtime);
                }
                else {
                    viewDirectives.push(dirOrComp);
                }
            });
            var precompileComponentTypes = compMeta.precompile.map((typeMeta) => typeMeta.runtime);
            var pipes = [
                ...modulePipes.map((type) => this._metadataResolver.getPipeMetadata(type)),
                ...this._metadataResolver.getViewPipesMetadata(type)
            ];
            compiledTemplate = new CompiledTemplate(false, compMeta.selector, compMeta.type, viewDirectives, viewComponentTypes, precompileComponentTypes, pipes, this._templateNormalizer.normalizeDirective(compMeta));
            this._compiledTemplateCache.set(type, compiledTemplate);
        }
        return compiledTemplate;
    }
    _getTransitiveCompiledTemplates(compType, isHost, moduleDirectives, modulePipes, target = new Set()) {
        var template = isHost ? this._createCompiledHostTemplate(compType) :
            this._createCompiledTemplate(compType, moduleDirectives, modulePipes);
        if (!target.has(template)) {
            target.add(template);
            template.viewComponentTypes.forEach((compType) => {
                this._getTransitiveCompiledTemplates(compType, false, moduleDirectives, modulePipes, target);
            });
            template.precompileHostComponentTypes.forEach((compType) => {
                this._getTransitiveCompiledTemplates(compType, true, moduleDirectives, modulePipes, target);
            });
        }
        return target;
    }
    _compileTemplate(template) {
        if (template.isCompiled) {
            return;
        }
        var compMeta = template.normalizedCompMeta;
        var externalStylesheetsByModuleUrl = new Map();
        var stylesCompileResult = this._styleCompiler.compileComponent(compMeta);
        stylesCompileResult.externalStylesheets.forEach((r) => { externalStylesheetsByModuleUrl.set(r.meta.moduleUrl, r); });
        this._resolveStylesCompileResult(stylesCompileResult.componentStylesheet, externalStylesheetsByModuleUrl);
        var viewCompMetas = template.viewComponentTypes.map((compType) => this._compiledTemplateCache.get(compType).normalizedCompMeta);
        var parsedTemplate = this._templateParser.parse(compMeta, compMeta.template.template, template.viewDirectives.concat(viewCompMetas), template.viewPipes, compMeta.type.name);
        var compileResult = this._viewCompiler.compileComponent(compMeta, parsedTemplate, ir.variable(stylesCompileResult.componentStylesheet.stylesVar), template.viewPipes);
        var depTemplates = compileResult.dependencies.map((dep) => {
            let depTemplate;
            if (dep instanceof ViewFactoryDependency) {
                let vfd = dep;
                depTemplate = this._compiledTemplateCache.get(vfd.comp.runtime);
                vfd.placeholder.runtime = depTemplate.proxyViewFactory;
                vfd.placeholder.name = `viewFactory_${vfd.comp.name}`;
            }
            else if (dep instanceof ComponentFactoryDependency) {
                let cfd = dep;
                depTemplate = this._compiledHostTemplateCache.get(cfd.comp.runtime);
                cfd.placeholder.runtime = depTemplate.proxyComponentFactory;
                cfd.placeholder.name = `compFactory_${cfd.comp.name}`;
            }
            return depTemplate;
        });
        var statements = stylesCompileResult.componentStylesheet.statements.concat(compileResult.statements);
        var factory;
        if (IS_DART || !this._genConfig.useJit) {
            factory = interpretStatements(statements, compileResult.viewFactoryVar);
        }
        else {
            factory = jitStatements(`${template.compType.name}.ngfactory.js`, statements, compileResult.viewFactoryVar);
        }
        template.compiled(factory);
    }
    _resolveStylesCompileResult(result, externalStylesheetsByModuleUrl) {
        result.dependencies.forEach((dep, i) => {
            var nestedCompileResult = externalStylesheetsByModuleUrl.get(dep.moduleUrl);
            var nestedStylesArr = this._resolveAndEvalStylesCompileResult(nestedCompileResult, externalStylesheetsByModuleUrl);
            dep.valuePlaceholder.runtime = nestedStylesArr;
            dep.valuePlaceholder.name = `importedStyles${i}`;
        });
    }
    _resolveAndEvalStylesCompileResult(result, externalStylesheetsByModuleUrl) {
        this._resolveStylesCompileResult(result, externalStylesheetsByModuleUrl);
        if (IS_DART || !this._genConfig.useJit) {
            return interpretStatements(result.statements, result.stylesVar);
        }
        else {
            return jitStatements(`${result.meta.moduleUrl}.css.js`, result.statements, result.stylesVar);
        }
    }
}
/** @nocollapse */
RuntimeCompiler.decorators = [
    { type: Injectable },
];
/** @nocollapse */
RuntimeCompiler.ctorParameters = [
    { type: Injector, },
    { type: CompileMetadataResolver, },
    { type: DirectiveNormalizer, },
    { type: TemplateParser, },
    { type: StyleCompiler, },
    { type: ViewCompiler, },
    { type: AppModuleCompiler, },
    { type: CompilerConfig, },
];
class CompiledTemplate {
    constructor(isHost, selector, compType, viewDirectives, viewComponentTypes, precompileHostComponentTypes, viewPipes, _normalizeResult) {
        this.isHost = isHost;
        this.compType = compType;
        this.viewDirectives = viewDirectives;
        this.viewComponentTypes = viewComponentTypes;
        this.precompileHostComponentTypes = precompileHostComponentTypes;
        this.viewPipes = viewPipes;
        this._viewFactory = null;
        this.loading = null;
        this._normalizedCompMeta = null;
        this.isCompiled = false;
        this.isCompiledWithDeps = false;
        this.proxyViewFactory = (...args) => this._viewFactory.apply(null, args);
        this.proxyComponentFactory = isHost ?
            new ComponentFactory(selector, this.proxyViewFactory, compType.runtime) :
            null;
        if (_normalizeResult.syncResult) {
            this._normalizedCompMeta = _normalizeResult.syncResult;
        }
        else {
            this.loading = _normalizeResult.asyncResult.then((normalizedCompMeta) => {
                this._normalizedCompMeta = normalizedCompMeta;
                this.loading = null;
            });
        }
    }
    get normalizedCompMeta() {
        if (this.loading) {
            throw new BaseException(`Template is still loading for ${this.compType.name}!`);
        }
        return this._normalizedCompMeta;
    }
    compiled(viewFactory) {
        this._viewFactory = viewFactory;
        this.isCompiled = true;
    }
    depsCompiled() { this.isCompiledWithDeps = true; }
}
function assertComponent(meta) {
    if (!meta.isComponent) {
        throw new BaseException(`Could not compile '${meta.type.name}' because it is not a component.`);
    }
}
/**
 * A wrapper around `Compiler` and `ComponentResolver` that
 * provides default patform directives / pipes.
 */
class BoundCompiler {
    constructor(_delegate, _directives, _pipes, _parentComponentResolver) {
        this._delegate = _delegate;
        this._directives = _directives;
        this._pipes = _pipes;
        this._parentComponentResolver = _parentComponentResolver;
    }
    get injector() { return this._delegate.injector; }
    resolveComponent(component) {
        if (isString(component)) {
            if (this._parentComponentResolver) {
                return this._parentComponentResolver.resolveComponent(component);
            }
            else {
                return PromiseWrapper.reject(new BaseException(`Cannot resolve component using '${component}'.`), null);
            }
        }
        return this.compileComponentAsync(component);
    }
    compileComponentAsync(compType) {
        return this._delegate._compileComponent(compType, false, this._directives, this._pipes)
            .asyncResult;
    }
    compileComponentSync(compType) {
        return this._delegate._compileComponent(compType, true, this._directives, this._pipes)
            .syncResult;
    }
    compileAppModuleSync(moduleType, metadata = null) {
        return this._delegate.compileAppModuleSync(moduleType, metadata);
    }
    compileAppModuleAsync(moduleType, metadata = null) {
        return this._delegate.compileAppModuleAsync(moduleType, metadata);
    }
    /**
     * Clears all caches
     */
    clearCache() {
        this._delegate.clearCache();
        if (this._parentComponentResolver) {
            this._parentComponentResolver.clearCache();
        }
    }
    /**
     * Clears the cache for the given component/appModule.
     */
    clearCacheFor(type) { this._delegate.clearCacheFor(type); }
}
//# sourceMappingURL=runtime_compiler.js.map