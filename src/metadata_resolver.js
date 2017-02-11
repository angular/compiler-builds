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
import { AnimationAnimateMetadata, AnimationGroupMetadata, AnimationKeyframesSequenceMetadata, AnimationStateDeclarationMetadata, AnimationStateTransitionMetadata, AnimationStyleMetadata, AnimationWithStepsMetadata, Attribute, Component, ComponentFactory, Host, Inject, Injectable, InjectionToken, Optional, Self, SkipSelf, Type, resolveForwardRef } from '@angular/core/index';
import { StaticSymbol, StaticSymbolCache } from './aot/static_symbol';
import { ngfactoryFilePath } from './aot/util';
import { assertArrayOfStrings, assertInterpolationSymbols } from './assertions';
import * as cpl from './compile_metadata';
import { USE_VIEW_ENGINE } from './config';
import { DirectiveNormalizer } from './directive_normalizer';
import { DirectiveResolver } from './directive_resolver';
import { stringify } from './facade/lang';
import { Identifiers, resolveIdentifier } from './identifiers';
import { CompilerInjectable } from './injectable';
import { hasLifecycleHook } from './lifecycle_reflector';
import { NgModuleResolver } from './ng_module_resolver';
import { PipeResolver } from './pipe_resolver';
import { ERROR_COMPONENT_TYPE, LIFECYCLE_HOOKS_VALUES, ReflectorReader, reflector, viewEngine } from './private_import_core';
import { ElementSchemaRegistry } from './schema/element_schema_registry';
import { SummaryResolver } from './summary_resolver';
import { getUrlScheme } from './url_resolver';
import { MODULE_SUFFIX, ValueTransformer, syntaxError, visitValue } from './util';
export const /** @type {?} */ ERROR_COLLECTOR_TOKEN = new InjectionToken('ErrorCollector');
let CompileMetadataResolver = class CompileMetadataResolver {
    /**
     * @param {?} _ngModuleResolver
     * @param {?} _directiveResolver
     * @param {?} _pipeResolver
     * @param {?} _summaryResolver
     * @param {?} _schemaRegistry
     * @param {?} _directiveNormalizer
     * @param {?} _staticSymbolCache
     * @param {?=} _reflector
     * @param {?=} _errorCollector
     * @param {?=} _useViewEngine
     */
    constructor(_ngModuleResolver, _directiveResolver, _pipeResolver, _summaryResolver, _schemaRegistry, _directiveNormalizer, _staticSymbolCache, _reflector = reflector, _errorCollector, _useViewEngine) {
        this._ngModuleResolver = _ngModuleResolver;
        this._directiveResolver = _directiveResolver;
        this._pipeResolver = _pipeResolver;
        this._summaryResolver = _summaryResolver;
        this._schemaRegistry = _schemaRegistry;
        this._directiveNormalizer = _directiveNormalizer;
        this._staticSymbolCache = _staticSymbolCache;
        this._reflector = _reflector;
        this._errorCollector = _errorCollector;
        this._useViewEngine = _useViewEngine;
        this._nonNormalizedDirectiveCache = new Map();
        this._directiveCache = new Map();
        this._summaryCache = new Map();
        this._pipeCache = new Map();
        this._ngModuleCache = new Map();
        this._ngModuleOfTypes = new Map();
    }
    /**
     * @param {?} type
     * @return {?}
     */
    clearCacheFor(type) {
        const /** @type {?} */ dirMeta = this._directiveCache.get(type);
        this._directiveCache.delete(type);
        this._nonNormalizedDirectiveCache.delete(type);
        this._summaryCache.delete(type);
        this._pipeCache.delete(type);
        this._ngModuleOfTypes.delete(type);
        // Clear all of the NgModule as they contain transitive information!
        this._ngModuleCache.clear();
        if (dirMeta) {
            this._directiveNormalizer.clearCacheFor(dirMeta);
        }
    }
    /**
     * @return {?}
     */
    clearCache() {
        this._directiveCache.clear();
        this._nonNormalizedDirectiveCache.clear();
        this._summaryCache.clear();
        this._pipeCache.clear();
        this._ngModuleCache.clear();
        this._ngModuleOfTypes.clear();
        this._directiveNormalizer.clearCache();
    }
    /**
     * @param {?} baseType
     * @param {?} name
     * @return {?}
     */
    _createProxyClass(baseType, name) {
        let /** @type {?} */ delegate = null;
        const /** @type {?} */ proxyClass = (function () {
            if (!delegate) {
                throw new Error(`Illegal state: Class ${name} for type ${stringify(baseType)} is not compiled yet!`);
            }
            return delegate.apply(this, arguments);
        });
        proxyClass.setDelegate = (d) => {
            delegate = d;
            ((proxyClass)).prototype = d.prototype;
        };
        // Make stringify work correctly
        ((proxyClass)).overriddenName = name;
        return proxyClass;
    }
    /**
     * @param {?} dirType
     * @param {?} name
     * @return {?}
     */
    getGeneratedClass(dirType, name) {
        if (dirType instanceof StaticSymbol) {
            return this._staticSymbolCache.get(ngfactoryFilePath(dirType.filePath), name);
        }
        else {
            return this._createProxyClass(dirType, name);
        }
    }
    /**
     * @param {?} dirType
     * @return {?}
     */
    getDirectiveWrapperClass(dirType) {
        return this.getGeneratedClass(dirType, cpl.dirWrapperClassName(dirType));
    }
    /**
     * @param {?} dirType
     * @return {?}
     */
    getComponentViewClass(dirType) {
        return this.getGeneratedClass(dirType, cpl.viewClassName(dirType, 0));
    }
    /**
     * @param {?} dirType
     * @return {?}
     */
    getHostComponentViewClass(dirType) {
        return this.getGeneratedClass(dirType, cpl.hostViewClassName(dirType));
    }
    /**
     * @param {?} dirType
     * @return {?}
     */
    getHostComponentType(dirType) {
        const /** @type {?} */ name = `${cpl.identifierName({ reference: dirType })}_Host`;
        if (dirType instanceof StaticSymbol) {
            return this._staticSymbolCache.get(dirType.filePath, name);
        }
        else {
            const /** @type {?} */ HostClass = (function HostClass() { });
            HostClass.overriddenName = name;
            return HostClass;
        }
    }
    /**
     * @param {?} selector
     * @param {?} dirType
     * @return {?}
     */
    getComponentFactory(selector, dirType) {
        if (dirType instanceof StaticSymbol) {
            return this._staticSymbolCache.get(ngfactoryFilePath(dirType.filePath), cpl.componentFactoryName(dirType));
        }
        else {
            const /** @type {?} */ hostView = this.getHostComponentViewClass(dirType);
            if (this._useViewEngine) {
                return viewEngine.createComponentFactory(selector, dirType, /** @type {?} */ (hostView));
            }
            else {
                return new ComponentFactory(selector, /** @type {?} */ (hostView), dirType);
            }
        }
    }
    /**
     * @param {?} entry
     * @return {?}
     */
    getAnimationEntryMetadata(entry) {
        const /** @type {?} */ defs = entry.definitions.map(def => this._getAnimationStateMetadata(def));
        return new cpl.CompileAnimationEntryMetadata(entry.name, defs);
    }
    /**
     * @param {?} value
     * @return {?}
     */
    _getAnimationStateMetadata(value) {
        if (value instanceof AnimationStateDeclarationMetadata) {
            const /** @type {?} */ styles = this._getAnimationStyleMetadata(value.styles);
            return new cpl.CompileAnimationStateDeclarationMetadata(value.stateNameExpr, styles);
        }
        if (value instanceof AnimationStateTransitionMetadata) {
            return new cpl.CompileAnimationStateTransitionMetadata(value.stateChangeExpr, this._getAnimationMetadata(value.steps));
        }
        return null;
    }
    /**
     * @param {?} value
     * @return {?}
     */
    _getAnimationStyleMetadata(value) {
        return new cpl.CompileAnimationStyleMetadata(value.offset, value.styles);
    }
    /**
     * @param {?} value
     * @return {?}
     */
    _getAnimationMetadata(value) {
        if (value instanceof AnimationStyleMetadata) {
            return this._getAnimationStyleMetadata(value);
        }
        if (value instanceof AnimationKeyframesSequenceMetadata) {
            return new cpl.CompileAnimationKeyframesSequenceMetadata(value.steps.map(entry => this._getAnimationStyleMetadata(entry)));
        }
        if (value instanceof AnimationAnimateMetadata) {
            const /** @type {?} */ animateData = (this
                ._getAnimationMetadata(value.styles));
            return new cpl.CompileAnimationAnimateMetadata(value.timings, animateData);
        }
        if (value instanceof AnimationWithStepsMetadata) {
            const /** @type {?} */ steps = value.steps.map(step => this._getAnimationMetadata(step));
            if (value instanceof AnimationGroupMetadata) {
                return new cpl.CompileAnimationGroupMetadata(steps);
            }
            return new cpl.CompileAnimationSequenceMetadata(steps);
        }
        return null;
    }
    /**
     * @param {?} type
     * @param {?} kind
     * @return {?}
     */
    _loadSummary(type, kind) {
        let /** @type {?} */ typeSummary = this._summaryCache.get(type);
        if (!typeSummary) {
            const /** @type {?} */ summary = this._summaryResolver.resolveSummary(type);
            typeSummary = summary ? summary.type : null;
            this._summaryCache.set(type, typeSummary);
        }
        return typeSummary && typeSummary.summaryKind === kind ? typeSummary : null;
    }
    /**
     * @param {?} directiveType
     * @param {?} isSync
     * @return {?}
     */
    _loadDirectiveMetadata(directiveType, isSync) {
        if (this._directiveCache.has(directiveType)) {
            return;
        }
        directiveType = resolveForwardRef(directiveType);
        const { annotation, metadata } = this.getNonNormalizedDirectiveMetadata(directiveType);
        const /** @type {?} */ createDirectiveMetadata = (templateMetadata) => {
            const /** @type {?} */ normalizedDirMeta = new cpl.CompileDirectiveMetadata({
                type: metadata.type,
                isComponent: metadata.isComponent,
                selector: metadata.selector,
                exportAs: metadata.exportAs,
                changeDetection: metadata.changeDetection,
                inputs: metadata.inputs,
                outputs: metadata.outputs,
                hostListeners: metadata.hostListeners,
                hostProperties: metadata.hostProperties,
                hostAttributes: metadata.hostAttributes,
                providers: metadata.providers,
                viewProviders: metadata.viewProviders,
                queries: metadata.queries,
                viewQueries: metadata.viewQueries,
                entryComponents: metadata.entryComponents,
                wrapperType: metadata.wrapperType,
                componentViewType: metadata.componentViewType,
                componentFactory: metadata.componentFactory,
                template: templateMetadata
            });
            this._directiveCache.set(directiveType, normalizedDirMeta);
            this._summaryCache.set(directiveType, normalizedDirMeta.toSummary());
            return normalizedDirMeta;
        };
        if (metadata.isComponent) {
            const /** @type {?} */ templateMeta = this._directiveNormalizer.normalizeTemplate({
                componentType: directiveType,
                moduleUrl: componentModuleUrl(this._reflector, directiveType, annotation),
                encapsulation: metadata.template.encapsulation,
                template: metadata.template.template,
                templateUrl: metadata.template.templateUrl,
                styles: metadata.template.styles,
                styleUrls: metadata.template.styleUrls,
                animations: metadata.template.animations,
                interpolation: metadata.template.interpolation
            });
            if (templateMeta.syncResult) {
                createDirectiveMetadata(templateMeta.syncResult);
                return null;
            }
            else {
                if (isSync) {
                    this._reportError(componentStillLoadingError(directiveType), directiveType);
                    return null;
                }
                return templateMeta.asyncResult.then(createDirectiveMetadata);
            }
        }
        else {
            // directive
            createDirectiveMetadata(null);
            return null;
        }
    }
    /**
     * @param {?} directiveType
     * @return {?}
     */
    getNonNormalizedDirectiveMetadata(directiveType) {
        directiveType = resolveForwardRef(directiveType);
        if (!directiveType) {
            return null;
        }
        let /** @type {?} */ cacheEntry = this._nonNormalizedDirectiveCache.get(directiveType);
        if (cacheEntry) {
            return cacheEntry;
        }
        const /** @type {?} */ dirMeta = this._directiveResolver.resolve(directiveType, false);
        if (!dirMeta) {
            return null;
        }
        let /** @type {?} */ nonNormalizedTemplateMetadata;
        if (dirMeta instanceof Component) {
            // component
            assertArrayOfStrings('styles', dirMeta.styles);
            assertArrayOfStrings('styleUrls', dirMeta.styleUrls);
            assertInterpolationSymbols('interpolation', dirMeta.interpolation);
            const /** @type {?} */ animations = dirMeta.animations ?
                dirMeta.animations.map(e => this.getAnimationEntryMetadata(e)) :
                null;
            nonNormalizedTemplateMetadata = new cpl.CompileTemplateMetadata({
                encapsulation: dirMeta.encapsulation,
                template: dirMeta.template,
                templateUrl: dirMeta.templateUrl,
                styles: dirMeta.styles,
                styleUrls: dirMeta.styleUrls,
                animations: animations,
                interpolation: dirMeta.interpolation
            });
        }
        let /** @type {?} */ changeDetectionStrategy = null;
        let /** @type {?} */ viewProviders = [];
        let /** @type {?} */ entryComponentMetadata = [];
        let /** @type {?} */ selector = dirMeta.selector;
        if (dirMeta instanceof Component) {
            // Component
            changeDetectionStrategy = dirMeta.changeDetection;
            if (dirMeta.viewProviders) {
                viewProviders = this._getProvidersMetadata(dirMeta.viewProviders, entryComponentMetadata, `viewProviders for "${stringifyType(directiveType)}"`, [], directiveType);
            }
            if (dirMeta.entryComponents) {
                entryComponentMetadata = flattenAndDedupeArray(dirMeta.entryComponents)
                    .map((type) => this._getEntryComponentMetadata(type))
                    .concat(entryComponentMetadata);
            }
            if (!selector) {
                selector = this._schemaRegistry.getDefaultComponentElementName();
            }
        }
        else {
            // Directive
            if (!selector) {
                this._reportError(syntaxError(`Directive ${stringifyType(directiveType)} has no selector, please add it!`), directiveType);
                selector = 'error';
            }
        }
        let /** @type {?} */ providers = [];
        if (dirMeta.providers != null) {
            providers = this._getProvidersMetadata(dirMeta.providers, entryComponentMetadata, `providers for "${stringifyType(directiveType)}"`, [], directiveType);
        }
        let /** @type {?} */ queries = [];
        let /** @type {?} */ viewQueries = [];
        if (dirMeta.queries != null) {
            queries = this._getQueriesMetadata(dirMeta.queries, false, directiveType);
            viewQueries = this._getQueriesMetadata(dirMeta.queries, true, directiveType);
        }
        const /** @type {?} */ metadata = cpl.CompileDirectiveMetadata.create({
            selector: selector,
            exportAs: dirMeta.exportAs,
            isComponent: !!nonNormalizedTemplateMetadata,
            type: this._getTypeMetadata(directiveType),
            template: nonNormalizedTemplateMetadata,
            changeDetection: changeDetectionStrategy,
            inputs: dirMeta.inputs,
            outputs: dirMeta.outputs,
            host: dirMeta.host,
            providers: providers,
            viewProviders: viewProviders,
            queries: queries,
            viewQueries: viewQueries,
            entryComponents: entryComponentMetadata,
            wrapperType: this.getDirectiveWrapperClass(directiveType),
            componentViewType: nonNormalizedTemplateMetadata ? this.getComponentViewClass(directiveType) :
                undefined,
            componentFactory: nonNormalizedTemplateMetadata ?
                this.getComponentFactory(selector, directiveType) :
                undefined
        });
        cacheEntry = { metadata, annotation: dirMeta };
        this._nonNormalizedDirectiveCache.set(directiveType, cacheEntry);
        return cacheEntry;
    }
    /**
     * Gets the metadata for the given directive.
     * This assumes `loadNgModuleDirectiveAndPipeMetadata` has been called first.
     * @param {?} directiveType
     * @return {?}
     */
    getDirectiveMetadata(directiveType) {
        const /** @type {?} */ dirMeta = this._directiveCache.get(directiveType);
        if (!dirMeta) {
            this._reportError(syntaxError(`Illegal state: getDirectiveMetadata can only be called after loadNgModuleDirectiveAndPipeMetadata for a module that declares it. Directive ${stringifyType(directiveType)}.`), directiveType);
        }
        return dirMeta;
    }
    /**
     * @param {?} dirType
     * @return {?}
     */
    getDirectiveSummary(dirType) {
        const /** @type {?} */ dirSummary = (this._loadSummary(dirType, cpl.CompileSummaryKind.Directive));
        if (!dirSummary) {
            this._reportError(syntaxError(`Illegal state: Could not load the summary for directive ${stringifyType(dirType)}.`), dirType);
        }
        return dirSummary;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    isDirective(type) { return this._directiveResolver.isDirective(type); }
    /**
     * @param {?} type
     * @return {?}
     */
    isPipe(type) { return this._pipeResolver.isPipe(type); }
    /**
     * @param {?} moduleType
     * @return {?}
     */
    getNgModuleSummary(moduleType) {
        let /** @type {?} */ moduleSummary = (this._loadSummary(moduleType, cpl.CompileSummaryKind.NgModule));
        if (!moduleSummary) {
            const /** @type {?} */ moduleMeta = this.getNgModuleMetadata(moduleType, false);
            moduleSummary = moduleMeta ? moduleMeta.toSummary() : null;
            if (moduleSummary) {
                this._summaryCache.set(moduleType, moduleSummary);
            }
        }
        return moduleSummary;
    }
    /**
     * Loads the declared directives and pipes of an NgModule.
     * @param {?} moduleType
     * @param {?} isSync
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    loadNgModuleDirectiveAndPipeMetadata(moduleType, isSync, throwIfNotFound = true) {
        const /** @type {?} */ ngModule = this.getNgModuleMetadata(moduleType, throwIfNotFound);
        const /** @type {?} */ loading = [];
        if (ngModule) {
            ngModule.declaredDirectives.forEach((id) => {
                const /** @type {?} */ promise = this._loadDirectiveMetadata(id.reference, isSync);
                if (promise) {
                    loading.push(promise);
                }
            });
            ngModule.declaredPipes.forEach((id) => this._loadPipeMetadata(id.reference));
        }
        return Promise.all(loading);
    }
    /**
     * @param {?} moduleType
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    getNgModuleMetadata(moduleType, throwIfNotFound = true) {
        moduleType = resolveForwardRef(moduleType);
        let /** @type {?} */ compileMeta = this._ngModuleCache.get(moduleType);
        if (compileMeta) {
            return compileMeta;
        }
        const /** @type {?} */ meta = this._ngModuleResolver.resolve(moduleType, throwIfNotFound);
        if (!meta) {
            return null;
        }
        const /** @type {?} */ declaredDirectives = [];
        const /** @type {?} */ exportedNonModuleIdentifiers = [];
        const /** @type {?} */ declaredPipes = [];
        const /** @type {?} */ importedModules = [];
        const /** @type {?} */ exportedModules = [];
        const /** @type {?} */ providers = [];
        const /** @type {?} */ entryComponents = [];
        const /** @type {?} */ bootstrapComponents = [];
        const /** @type {?} */ schemas = [];
        if (meta.imports) {
            flattenAndDedupeArray(meta.imports).forEach((importedType) => {
                let /** @type {?} */ importedModuleType;
                if (isValidType(importedType)) {
                    importedModuleType = importedType;
                }
                else if (importedType && importedType.ngModule) {
                    const /** @type {?} */ moduleWithProviders = importedType;
                    importedModuleType = moduleWithProviders.ngModule;
                    if (moduleWithProviders.providers) {
                        providers.push(...this._getProvidersMetadata(moduleWithProviders.providers, entryComponents, `provider for the NgModule '${stringifyType(importedModuleType)}'`, [], importedType));
                    }
                }
                if (importedModuleType) {
                    const /** @type {?} */ importedModuleSummary = this.getNgModuleSummary(importedModuleType);
                    if (!importedModuleSummary) {
                        this._reportError(syntaxError(`Unexpected ${this._getTypeDescriptor(importedType)} '${stringifyType(importedType)}' imported by the module '${stringifyType(moduleType)}'`), moduleType);
                        return;
                    }
                    importedModules.push(importedModuleSummary);
                }
                else {
                    this._reportError(syntaxError(`Unexpected value '${stringifyType(importedType)}' imported by the module '${stringifyType(moduleType)}'`), moduleType);
                    return;
                }
            });
        }
        if (meta.exports) {
            flattenAndDedupeArray(meta.exports).forEach((exportedType) => {
                if (!isValidType(exportedType)) {
                    this._reportError(syntaxError(`Unexpected value '${stringifyType(exportedType)}' exported by the module '${stringifyType(moduleType)}'`), moduleType);
                    return;
                }
                const /** @type {?} */ exportedModuleSummary = this.getNgModuleSummary(exportedType);
                if (exportedModuleSummary) {
                    exportedModules.push(exportedModuleSummary);
                }
                else {
                    exportedNonModuleIdentifiers.push(this._getIdentifierMetadata(exportedType));
                }
            });
        }
        // Note: This will be modified later, so we rely on
        // getting a new instance every time!
        const /** @type {?} */ transitiveModule = this._getTransitiveNgModuleMetadata(importedModules, exportedModules);
        if (meta.declarations) {
            flattenAndDedupeArray(meta.declarations).forEach((declaredType) => {
                if (!isValidType(declaredType)) {
                    this._reportError(syntaxError(`Unexpected value '${stringifyType(declaredType)}' declared by the module '${stringifyType(moduleType)}'`), moduleType);
                    return;
                }
                const /** @type {?} */ declaredIdentifier = this._getIdentifierMetadata(declaredType);
                if (this._directiveResolver.isDirective(declaredType)) {
                    transitiveModule.addDirective(declaredIdentifier);
                    declaredDirectives.push(declaredIdentifier);
                    this._addTypeToModule(declaredType, moduleType);
                }
                else if (this._pipeResolver.isPipe(declaredType)) {
                    transitiveModule.addPipe(declaredIdentifier);
                    transitiveModule.pipes.push(declaredIdentifier);
                    declaredPipes.push(declaredIdentifier);
                    this._addTypeToModule(declaredType, moduleType);
                }
                else {
                    this._reportError(syntaxError(`Unexpected ${this._getTypeDescriptor(declaredType)} '${stringifyType(declaredType)}' declared by the module '${stringifyType(moduleType)}'`), moduleType);
                    return;
                }
            });
        }
        const /** @type {?} */ exportedDirectives = [];
        const /** @type {?} */ exportedPipes = [];
        exportedNonModuleIdentifiers.forEach((exportedId) => {
            if (transitiveModule.directivesSet.has(exportedId.reference)) {
                exportedDirectives.push(exportedId);
                transitiveModule.addExportedDirective(exportedId);
            }
            else if (transitiveModule.pipesSet.has(exportedId.reference)) {
                exportedPipes.push(exportedId);
                transitiveModule.addExportedPipe(exportedId);
            }
            else {
                this._reportError(syntaxError(`Can't export ${this._getTypeDescriptor(exportedId.reference)} ${stringifyType(exportedId.reference)} from ${stringifyType(moduleType)} as it was neither declared nor imported!`), moduleType);
            }
        });
        // The providers of the module have to go last
        // so that they overwrite any other provider we already added.
        if (meta.providers) {
            providers.push(...this._getProvidersMetadata(meta.providers, entryComponents, `provider for the NgModule '${stringifyType(moduleType)}'`, [], moduleType));
        }
        if (meta.entryComponents) {
            entryComponents.push(...flattenAndDedupeArray(meta.entryComponents)
                .map(type => this._getEntryComponentMetadata(type)));
        }
        if (meta.bootstrap) {
            flattenAndDedupeArray(meta.bootstrap).forEach(type => {
                if (!isValidType(type)) {
                    this._reportError(syntaxError(`Unexpected value '${stringifyType(type)}' used in the bootstrap property of module '${stringifyType(moduleType)}'`), moduleType);
                    return;
                }
                bootstrapComponents.push(this._getIdentifierMetadata(type));
            });
        }
        entryComponents.push(...bootstrapComponents.map(type => this._getEntryComponentMetadata(type.reference)));
        if (meta.schemas) {
            schemas.push(...flattenAndDedupeArray(meta.schemas));
        }
        compileMeta = new cpl.CompileNgModuleMetadata({
            type: this._getTypeMetadata(moduleType),
            providers,
            entryComponents,
            bootstrapComponents,
            schemas,
            declaredDirectives,
            exportedDirectives,
            declaredPipes,
            exportedPipes,
            importedModules,
            exportedModules,
            transitiveModule,
            id: meta.id,
        });
        entryComponents.forEach((id) => transitiveModule.addEntryComponent(id));
        providers.forEach((provider) => transitiveModule.addProvider(provider, compileMeta.type));
        transitiveModule.addModule(compileMeta.type);
        this._ngModuleCache.set(moduleType, compileMeta);
        return compileMeta;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    _getTypeDescriptor(type) {
        if (this._directiveResolver.isDirective(type)) {
            return 'directive';
        }
        if (this._pipeResolver.isPipe(type)) {
            return 'pipe';
        }
        if (this._ngModuleResolver.isNgModule(type)) {
            return 'module';
        }
        if (((type)).provide) {
            return 'provider';
        }
        return 'value';
    }
    /**
     * @param {?} type
     * @param {?} moduleType
     * @return {?}
     */
    _addTypeToModule(type, moduleType) {
        const /** @type {?} */ oldModule = this._ngModuleOfTypes.get(type);
        if (oldModule && oldModule !== moduleType) {
            this._reportError(syntaxError(`Type ${stringifyType(type)} is part of the declarations of 2 modules: ${stringifyType(oldModule)} and ${stringifyType(moduleType)}! ` +
                `Please consider moving ${stringifyType(type)} to a higher module that imports ${stringifyType(oldModule)} and ${stringifyType(moduleType)}. ` +
                `You can also create a new NgModule that exports and includes ${stringifyType(type)} then import that NgModule in ${stringifyType(oldModule)} and ${stringifyType(moduleType)}.`), moduleType);
        }
        this._ngModuleOfTypes.set(type, moduleType);
    }
    /**
     * @param {?} importedModules
     * @param {?} exportedModules
     * @return {?}
     */
    _getTransitiveNgModuleMetadata(importedModules, exportedModules) {
        // collect `providers` / `entryComponents` from all imported and all exported modules
        const /** @type {?} */ result = new cpl.TransitiveCompileNgModuleMetadata();
        const /** @type {?} */ modulesByToken = new Map();
        importedModules.concat(exportedModules).forEach((modSummary) => {
            modSummary.modules.forEach((mod) => result.addModule(mod));
            modSummary.entryComponents.forEach((comp) => result.addEntryComponent(comp));
            const /** @type {?} */ addedTokens = new Set();
            modSummary.providers.forEach((entry) => {
                const /** @type {?} */ tokenRef = cpl.tokenReference(entry.provider.token);
                let /** @type {?} */ prevModules = modulesByToken.get(tokenRef);
                if (!prevModules) {
                    prevModules = new Set();
                    modulesByToken.set(tokenRef, prevModules);
                }
                const /** @type {?} */ moduleRef = entry.module.reference;
                // Note: the providers of one module may still contain multiple providers
                // per token (e.g. for multi providers), and we need to preserve these.
                if (addedTokens.has(tokenRef) || !prevModules.has(moduleRef)) {
                    prevModules.add(moduleRef);
                    addedTokens.add(tokenRef);
                    result.addProvider(entry.provider, entry.module);
                }
            });
        });
        exportedModules.forEach((modSummary) => {
            modSummary.exportedDirectives.forEach((id) => result.addExportedDirective(id));
            modSummary.exportedPipes.forEach((id) => result.addExportedPipe(id));
        });
        importedModules.forEach((modSummary) => {
            modSummary.exportedDirectives.forEach((id) => result.addDirective(id));
            modSummary.exportedPipes.forEach((id) => result.addPipe(id));
        });
        return result;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    _getIdentifierMetadata(type) {
        type = resolveForwardRef(type);
        return { reference: type };
    }
    /**
     * @param {?} type
     * @return {?}
     */
    isInjectable(type) {
        const /** @type {?} */ annotations = this._reflector.annotations(type);
        // Note: We need an exact check here as @Component / @Directive / ... inherit
        // from @CompilerInjectable!
        return annotations.some(ann => ann.constructor === Injectable);
    }
    /**
     * @param {?} type
     * @return {?}
     */
    getInjectableSummary(type) {
        return { summaryKind: cpl.CompileSummaryKind.Injectable, type: this._getTypeMetadata(type) };
    }
    /**
     * @param {?} type
     * @param {?=} dependencies
     * @return {?}
     */
    _getInjectableMetadata(type, dependencies = null) {
        const /** @type {?} */ typeSummary = this._loadSummary(type, cpl.CompileSummaryKind.Injectable);
        if (typeSummary) {
            return typeSummary.type;
        }
        return this._getTypeMetadata(type, dependencies);
    }
    /**
     * @param {?} type
     * @param {?=} dependencies
     * @return {?}
     */
    _getTypeMetadata(type, dependencies = null) {
        const /** @type {?} */ identifier = this._getIdentifierMetadata(type);
        return {
            reference: identifier.reference,
            diDeps: this._getDependenciesMetadata(identifier.reference, dependencies),
            lifecycleHooks: LIFECYCLE_HOOKS_VALUES.filter(hook => hasLifecycleHook(hook, identifier.reference)),
        };
    }
    /**
     * @param {?} factory
     * @param {?=} dependencies
     * @return {?}
     */
    _getFactoryMetadata(factory, dependencies = null) {
        factory = resolveForwardRef(factory);
        return { reference: factory, diDeps: this._getDependenciesMetadata(factory, dependencies) };
    }
    /**
     * Gets the metadata for the given pipe.
     * This assumes `loadNgModuleDirectiveAndPipeMetadata` has been called first.
     * @param {?} pipeType
     * @return {?}
     */
    getPipeMetadata(pipeType) {
        const /** @type {?} */ pipeMeta = this._pipeCache.get(pipeType);
        if (!pipeMeta) {
            this._reportError(syntaxError(`Illegal state: getPipeMetadata can only be called after loadNgModuleDirectiveAndPipeMetadata for a module that declares it. Pipe ${stringifyType(pipeType)}.`), pipeType);
        }
        return pipeMeta;
    }
    /**
     * @param {?} pipeType
     * @return {?}
     */
    getPipeSummary(pipeType) {
        const /** @type {?} */ pipeSummary = (this._loadSummary(pipeType, cpl.CompileSummaryKind.Pipe));
        if (!pipeSummary) {
            this._reportError(syntaxError(`Illegal state: Could not load the summary for pipe ${stringifyType(pipeType)}.`), pipeType);
        }
        return pipeSummary;
    }
    /**
     * @param {?} pipeType
     * @return {?}
     */
    getOrLoadPipeMetadata(pipeType) {
        let /** @type {?} */ pipeMeta = this._pipeCache.get(pipeType);
        if (!pipeMeta) {
            pipeMeta = this._loadPipeMetadata(pipeType);
        }
        return pipeMeta;
    }
    /**
     * @param {?} pipeType
     * @return {?}
     */
    _loadPipeMetadata(pipeType) {
        pipeType = resolveForwardRef(pipeType);
        const /** @type {?} */ pipeAnnotation = this._pipeResolver.resolve(pipeType);
        const /** @type {?} */ pipeMeta = new cpl.CompilePipeMetadata({
            type: this._getTypeMetadata(pipeType),
            name: pipeAnnotation.name,
            pure: pipeAnnotation.pure
        });
        this._pipeCache.set(pipeType, pipeMeta);
        this._summaryCache.set(pipeType, pipeMeta.toSummary());
        return pipeMeta;
    }
    /**
     * @param {?} typeOrFunc
     * @param {?} dependencies
     * @return {?}
     */
    _getDependenciesMetadata(typeOrFunc, dependencies) {
        let /** @type {?} */ hasUnknownDeps = false;
        const /** @type {?} */ params = dependencies || this._reflector.parameters(typeOrFunc) || [];
        const /** @type {?} */ dependenciesMetadata = params.map((param) => {
            let /** @type {?} */ isAttribute = false;
            let /** @type {?} */ isHost = false;
            let /** @type {?} */ isSelf = false;
            let /** @type {?} */ isSkipSelf = false;
            let /** @type {?} */ isOptional = false;
            let /** @type {?} */ token = null;
            if (Array.isArray(param)) {
                param.forEach((paramEntry) => {
                    if (paramEntry instanceof Host) {
                        isHost = true;
                    }
                    else if (paramEntry instanceof Self) {
                        isSelf = true;
                    }
                    else if (paramEntry instanceof SkipSelf) {
                        isSkipSelf = true;
                    }
                    else if (paramEntry instanceof Optional) {
                        isOptional = true;
                    }
                    else if (paramEntry instanceof Attribute) {
                        isAttribute = true;
                        token = paramEntry.attributeName;
                    }
                    else if (paramEntry instanceof Inject) {
                        token = paramEntry.token;
                    }
                    else if (isValidType(paramEntry) && token == null) {
                        token = paramEntry;
                    }
                });
            }
            else {
                token = param;
            }
            if (token == null) {
                hasUnknownDeps = true;
                return null;
            }
            return {
                isAttribute,
                isHost,
                isSelf,
                isSkipSelf,
                isOptional,
                token: this._getTokenMetadata(token)
            };
        });
        if (hasUnknownDeps) {
            const /** @type {?} */ depsTokens = dependenciesMetadata.map((dep) => dep ? stringifyType(dep.token) : '?').join(', ');
            this._reportError(syntaxError(`Can't resolve all parameters for ${stringifyType(typeOrFunc)}: (${depsTokens}).`), typeOrFunc);
        }
        return dependenciesMetadata;
    }
    /**
     * @param {?} token
     * @return {?}
     */
    _getTokenMetadata(token) {
        token = resolveForwardRef(token);
        let /** @type {?} */ compileToken;
        if (typeof token === 'string') {
            compileToken = { value: token };
        }
        else {
            compileToken = { identifier: { reference: token } };
        }
        return compileToken;
    }
    /**
     * @param {?} providers
     * @param {?} targetEntryComponents
     * @param {?=} debugInfo
     * @param {?=} compileProviders
     * @param {?=} type
     * @return {?}
     */
    _getProvidersMetadata(providers, targetEntryComponents, debugInfo, compileProviders = [], type) {
        providers.forEach((provider, providerIdx) => {
            if (Array.isArray(provider)) {
                this._getProvidersMetadata(provider, targetEntryComponents, debugInfo, compileProviders);
            }
            else {
                provider = resolveForwardRef(provider);
                let /** @type {?} */ providerMeta;
                if (provider && typeof provider === 'object' && provider.hasOwnProperty('provide')) {
                    this._validateProvider(provider);
                    providerMeta = new cpl.ProviderMeta(provider.provide, provider);
                }
                else if (isValidType(provider)) {
                    providerMeta = new cpl.ProviderMeta(provider, { useClass: provider });
                }
                else if (provider === void 0) {
                    this._reportError(syntaxError(`Encountered undefined provider! Usually this means you have a circular dependencies (might be caused by using 'barrel' index.ts files.`));
                }
                else {
                    const /** @type {?} */ providersInfo = ((providers.reduce((soFar, seenProvider, seenProviderIdx) => {
                        if (seenProviderIdx < providerIdx) {
                            soFar.push(`${stringifyType(seenProvider)}`);
                        }
                        else if (seenProviderIdx == providerIdx) {
                            soFar.push(`?${stringifyType(seenProvider)}?`);
                        }
                        else if (seenProviderIdx == providerIdx + 1) {
                            soFar.push('...');
                        }
                        return soFar;
                    }, [])))
                        .join(', ');
                    this._reportError(syntaxError(`Invalid ${debugInfo ? debugInfo : 'provider'} - only instances of Provider and Type are allowed, got: [${providersInfo}]`), type);
                }
                if (providerMeta.token === resolveIdentifier(Identifiers.ANALYZE_FOR_ENTRY_COMPONENTS)) {
                    targetEntryComponents.push(...this._getEntryComponentsFromProvider(providerMeta, type));
                }
                else {
                    compileProviders.push(this.getProviderMetadata(providerMeta));
                }
            }
        });
        return compileProviders;
    }
    /**
     * @param {?} provider
     * @return {?}
     */
    _validateProvider(provider) {
        if (provider.hasOwnProperty('useClass') && provider.useClass == null) {
            this._reportError(syntaxError(`Invalid provider for ${stringifyType(provider.provide)}. useClass cannot be ${provider.useClass}.
           Usually it happens when:
           1. There's a circular dependency (might be caused by using index.ts (barrel) files).
           2. Class was used before it was declared. Use forwardRef in this case.`));
        }
    }
    /**
     * @param {?} provider
     * @param {?=} type
     * @return {?}
     */
    _getEntryComponentsFromProvider(provider, type) {
        const /** @type {?} */ components = [];
        const /** @type {?} */ collectedIdentifiers = [];
        if (provider.useFactory || provider.useExisting || provider.useClass) {
            this._reportError(syntaxError(`The ANALYZE_FOR_ENTRY_COMPONENTS token only supports useValue!`), type);
            return [];
        }
        if (!provider.multi) {
            this._reportError(syntaxError(`The ANALYZE_FOR_ENTRY_COMPONENTS token only supports 'multi = true'!`), type);
            return [];
        }
        extractIdentifiers(provider.useValue, collectedIdentifiers);
        collectedIdentifiers.forEach((identifier) => {
            const /** @type {?} */ entry = this._getEntryComponentMetadata(identifier.reference, false);
            if (entry) {
                components.push(entry);
            }
        });
        return components;
    }
    /**
     * @param {?} dirType
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    _getEntryComponentMetadata(dirType, throwIfNotFound = true) {
        const /** @type {?} */ dirMeta = this.getNonNormalizedDirectiveMetadata(dirType);
        if (dirMeta && dirMeta.metadata.isComponent) {
            return { componentType: dirType, componentFactory: dirMeta.metadata.componentFactory };
        }
        else {
            const /** @type {?} */ dirSummary = (this._loadSummary(dirType, cpl.CompileSummaryKind.Directive));
            if (dirSummary && dirSummary.isComponent) {
                return { componentType: dirType, componentFactory: dirSummary.componentFactory };
            }
        }
        if (throwIfNotFound) {
            throw syntaxError(`${dirType.name} cannot be used as an entry component.`);
        }
    }
    /**
     * @param {?} provider
     * @return {?}
     */
    getProviderMetadata(provider) {
        let /** @type {?} */ compileDeps;
        let /** @type {?} */ compileTypeMetadata = null;
        let /** @type {?} */ compileFactoryMetadata = null;
        let /** @type {?} */ token = this._getTokenMetadata(provider.token);
        if (provider.useClass) {
            compileTypeMetadata = this._getInjectableMetadata(provider.useClass, provider.dependencies);
            compileDeps = compileTypeMetadata.diDeps;
            if (provider.token === provider.useClass) {
                // use the compileTypeMetadata as it contains information about lifecycleHooks...
                token = { identifier: compileTypeMetadata };
            }
        }
        else if (provider.useFactory) {
            compileFactoryMetadata = this._getFactoryMetadata(provider.useFactory, provider.dependencies);
            compileDeps = compileFactoryMetadata.diDeps;
        }
        return {
            token: token,
            useClass: compileTypeMetadata,
            useValue: provider.useValue,
            useFactory: compileFactoryMetadata,
            useExisting: provider.useExisting ? this._getTokenMetadata(provider.useExisting) : null,
            deps: compileDeps,
            multi: provider.multi
        };
    }
    /**
     * @param {?} queries
     * @param {?} isViewQuery
     * @param {?} directiveType
     * @return {?}
     */
    _getQueriesMetadata(queries, isViewQuery, directiveType) {
        const /** @type {?} */ res = [];
        Object.keys(queries).forEach((propertyName) => {
            const /** @type {?} */ query = queries[propertyName];
            if (query.isViewQuery === isViewQuery) {
                res.push(this._getQueryMetadata(query, propertyName, directiveType));
            }
        });
        return res;
    }
    /**
     * @param {?} selector
     * @return {?}
     */
    _queryVarBindings(selector) { return selector.split(/\s*,\s*/); }
    /**
     * @param {?} q
     * @param {?} propertyName
     * @param {?} typeOrFunc
     * @return {?}
     */
    _getQueryMetadata(q, propertyName, typeOrFunc) {
        let /** @type {?} */ selectors;
        if (typeof q.selector === 'string') {
            selectors =
                this._queryVarBindings(q.selector).map(varName => this._getTokenMetadata(varName));
        }
        else {
            if (!q.selector) {
                this._reportError(syntaxError(`Can't construct a query for the property "${propertyName}" of "${stringifyType(typeOrFunc)}" since the query selector wasn't defined.`), typeOrFunc);
            }
            selectors = [this._getTokenMetadata(q.selector)];
        }
        return {
            selectors,
            first: q.first,
            descendants: q.descendants, propertyName,
            read: q.read ? this._getTokenMetadata(q.read) : null
        };
    }
    /**
     * @param {?} error
     * @param {?=} type
     * @param {?=} otherType
     * @return {?}
     */
    _reportError(error, type, otherType) {
        if (this._errorCollector) {
            this._errorCollector(error, type);
            if (otherType) {
                this._errorCollector(error, otherType);
            }
        }
        else {
            throw error;
        }
    }
};
/** @nocollapse */
CompileMetadataResolver.ctorParameters = () => [
    { type: NgModuleResolver, },
    { type: DirectiveResolver, },
    { type: PipeResolver, },
    { type: SummaryResolver, },
    { type: ElementSchemaRegistry, },
    { type: DirectiveNormalizer, },
    { type: StaticSymbolCache, decorators: [{ type: Optional },] },
    { type: ReflectorReader, },
    { type: undefined, decorators: [{ type: Optional }, { type: Inject, args: [ERROR_COLLECTOR_TOKEN,] },] },
    { type: undefined, decorators: [{ type: Optional }, { type: Inject, args: [USE_VIEW_ENGINE,] },] },
];
CompileMetadataResolver = __decorate([
    CompilerInjectable(),
    __metadata("design:paramtypes", [NgModuleResolver,
        DirectiveResolver,
        PipeResolver,
        SummaryResolver,
        ElementSchemaRegistry,
        DirectiveNormalizer,
        StaticSymbolCache, typeof (_a = typeof ReflectorReader !== "undefined" && ReflectorReader) === "function" && _a || Object, Function, Boolean])
], CompileMetadataResolver);
export { CompileMetadataResolver };
function CompileMetadataResolver_tsickle_Closure_declarations() {
    /**
     * @nocollapse
     * @type {?}
     */
    CompileMetadataResolver.ctorParameters;
    /** @type {?} */
    CompileMetadataResolver.prototype._nonNormalizedDirectiveCache;
    /** @type {?} */
    CompileMetadataResolver.prototype._directiveCache;
    /** @type {?} */
    CompileMetadataResolver.prototype._summaryCache;
    /** @type {?} */
    CompileMetadataResolver.prototype._pipeCache;
    /** @type {?} */
    CompileMetadataResolver.prototype._ngModuleCache;
    /** @type {?} */
    CompileMetadataResolver.prototype._ngModuleOfTypes;
    /** @type {?} */
    CompileMetadataResolver.prototype._ngModuleResolver;
    /** @type {?} */
    CompileMetadataResolver.prototype._directiveResolver;
    /** @type {?} */
    CompileMetadataResolver.prototype._pipeResolver;
    /** @type {?} */
    CompileMetadataResolver.prototype._summaryResolver;
    /** @type {?} */
    CompileMetadataResolver.prototype._schemaRegistry;
    /** @type {?} */
    CompileMetadataResolver.prototype._directiveNormalizer;
    /** @type {?} */
    CompileMetadataResolver.prototype._staticSymbolCache;
    /** @type {?} */
    CompileMetadataResolver.prototype._reflector;
    /** @type {?} */
    CompileMetadataResolver.prototype._errorCollector;
    /** @type {?} */
    CompileMetadataResolver.prototype._useViewEngine;
}
/**
 * @param {?} tree
 * @param {?=} out
 * @return {?}
 */
function flattenArray(tree, out = []) {
    if (tree) {
        for (let /** @type {?} */ i = 0; i < tree.length; i++) {
            const /** @type {?} */ item = resolveForwardRef(tree[i]);
            if (Array.isArray(item)) {
                flattenArray(item, out);
            }
            else {
                out.push(item);
            }
        }
    }
    return out;
}
/**
 * @param {?} array
 * @return {?}
 */
function dedupeArray(array) {
    if (array) {
        return Array.from(new Set(array));
    }
    return [];
}
/**
 * @param {?} tree
 * @return {?}
 */
function flattenAndDedupeArray(tree) {
    return dedupeArray(flattenArray(tree));
}
/**
 * @param {?} value
 * @return {?}
 */
function isValidType(value) {
    return (value instanceof StaticSymbol) || (value instanceof Type);
}
/**
 * @param {?} reflector
 * @param {?} type
 * @param {?} cmpMetadata
 * @return {?}
 */
export function componentModuleUrl(reflector, type, cmpMetadata) {
    if (type instanceof StaticSymbol) {
        return type.filePath;
    }
    const /** @type {?} */ moduleId = cmpMetadata.moduleId;
    if (typeof moduleId === 'string') {
        const /** @type {?} */ scheme = getUrlScheme(moduleId);
        return scheme ? moduleId : `package:${moduleId}${MODULE_SUFFIX}`;
    }
    else if (moduleId !== null && moduleId !== void 0) {
        throw syntaxError(`moduleId should be a string in "${stringifyType(type)}". See https://goo.gl/wIDDiL for more information.\n` +
            `If you're using Webpack you should inline the template and the styles, see https://goo.gl/X2J8zc.`);
    }
    return reflector.importUri(type);
}
/**
 * @param {?} value
 * @param {?} targetIdentifiers
 * @return {?}
 */
function extractIdentifiers(value, targetIdentifiers) {
    visitValue(value, new _CompileValueConverter(), targetIdentifiers);
}
class _CompileValueConverter extends ValueTransformer {
    /**
     * @param {?} value
     * @param {?} targetIdentifiers
     * @return {?}
     */
    visitOther(value, targetIdentifiers) {
        targetIdentifiers.push({ reference: value });
    }
}
/**
 * @param {?} type
 * @return {?}
 */
function stringifyType(type) {
    if (type instanceof StaticSymbol) {
        return `${type.name} in ${type.filePath}`;
    }
    else {
        return stringify(type);
    }
}
/**
 * Indicates that a component is still being loaded in a synchronous compile.
 * @param {?} compType
 * @return {?}
 */
function componentStillLoadingError(compType) {
    debugger;
    const /** @type {?} */ error = Error(`Can't compile synchronously as ${stringify(compType)} is still being loaded!`);
    ((error))[ERROR_COMPONENT_TYPE] = compType;
    return error;
}
var _a;
//# sourceMappingURL=metadata_resolver.js.map