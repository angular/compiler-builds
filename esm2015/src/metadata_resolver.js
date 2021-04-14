/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { StaticSymbol } from './aot/static_symbol';
import { ngfactoryFilePath } from './aot/util';
import { assertArrayOfStrings, assertInterpolationSymbols } from './assertions';
import * as cpl from './compile_metadata';
import { ChangeDetectionStrategy, createAttribute, createComponent, createHost, createInject, createInjectable, createInjectionToken, createNgModule, createOptional, createSelf, createSkipSelf, Type, ViewEncapsulation } from './core';
import { findLast } from './directive_resolver';
import { Identifiers } from './identifiers';
import { getAllLifecycleHooks } from './lifecycle_reflector';
import { CssSelector } from './selector';
import { isPromise, noUndefined, resolveForwardRef, stringify, SyncAsync, syntaxError, ValueTransformer, visitValue } from './util';
export const ERROR_COMPONENT_TYPE = 'ngComponentType';
const MISSING_NG_MODULE_METADATA_ERROR_DATA = 'ngMissingNgModuleMetadataErrorData';
export function getMissingNgModuleMetadataErrorData(error) {
    var _a;
    return (_a = error[MISSING_NG_MODULE_METADATA_ERROR_DATA]) !== null && _a !== void 0 ? _a : null;
}
// Design notes:
// - don't lazily create metadata:
//   For some metadata, we need to do async work sometimes,
//   so the user has to kick off this loading.
//   But we want to report errors even when the async work is
//   not required to check that the user would have been able
//   to wait correctly.
export class CompileMetadataResolver {
    constructor(_config, _htmlParser, _ngModuleResolver, _directiveResolver, _pipeResolver, _summaryResolver, _schemaRegistry, _directiveNormalizer, _console, _staticSymbolCache, _reflector, _errorCollector) {
        this._config = _config;
        this._htmlParser = _htmlParser;
        this._ngModuleResolver = _ngModuleResolver;
        this._directiveResolver = _directiveResolver;
        this._pipeResolver = _pipeResolver;
        this._summaryResolver = _summaryResolver;
        this._schemaRegistry = _schemaRegistry;
        this._directiveNormalizer = _directiveNormalizer;
        this._console = _console;
        this._staticSymbolCache = _staticSymbolCache;
        this._reflector = _reflector;
        this._errorCollector = _errorCollector;
        this._nonNormalizedDirectiveCache = new Map();
        this._directiveCache = new Map();
        this._summaryCache = new Map();
        this._pipeCache = new Map();
        this._ngModuleCache = new Map();
        this._ngModuleOfTypes = new Map();
        this._shallowModuleCache = new Map();
    }
    getReflector() {
        return this._reflector;
    }
    clearCacheFor(type) {
        const dirMeta = this._directiveCache.get(type);
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
    clearCache() {
        this._directiveCache.clear();
        this._nonNormalizedDirectiveCache.clear();
        this._summaryCache.clear();
        this._pipeCache.clear();
        this._ngModuleCache.clear();
        this._ngModuleOfTypes.clear();
        this._directiveNormalizer.clearCache();
    }
    _createProxyClass(baseType, name) {
        let delegate = null;
        const proxyClass = function () {
            if (!delegate) {
                throw new Error(`Illegal state: Class ${name} for type ${stringify(baseType)} is not compiled yet!`);
            }
            return delegate.apply(this, arguments);
        };
        proxyClass.setDelegate = (d) => {
            delegate = d;
            proxyClass.prototype = d.prototype;
        };
        // Make stringify work correctly
        proxyClass.overriddenName = name;
        return proxyClass;
    }
    getGeneratedClass(dirType, name) {
        if (dirType instanceof StaticSymbol) {
            return this._staticSymbolCache.get(ngfactoryFilePath(dirType.filePath), name);
        }
        else {
            return this._createProxyClass(dirType, name);
        }
    }
    getComponentViewClass(dirType) {
        return this.getGeneratedClass(dirType, cpl.viewClassName(dirType, 0));
    }
    getHostComponentViewClass(dirType) {
        return this.getGeneratedClass(dirType, cpl.hostViewClassName(dirType));
    }
    getHostComponentType(dirType) {
        const name = `${cpl.identifierName({ reference: dirType })}_Host`;
        if (dirType instanceof StaticSymbol) {
            return this._staticSymbolCache.get(dirType.filePath, name);
        }
        return this._createProxyClass(dirType, name);
    }
    getRendererType(dirType) {
        if (dirType instanceof StaticSymbol) {
            return this._staticSymbolCache.get(ngfactoryFilePath(dirType.filePath), cpl.rendererTypeName(dirType));
        }
        else {
            // returning an object as proxy,
            // that we fill later during runtime compilation.
            return {};
        }
    }
    getComponentFactory(selector, dirType, inputs, outputs) {
        if (dirType instanceof StaticSymbol) {
            return this._staticSymbolCache.get(ngfactoryFilePath(dirType.filePath), cpl.componentFactoryName(dirType));
        }
        else {
            const hostView = this.getHostComponentViewClass(dirType);
            // Note: ngContentSelectors will be filled later once the template is
            // loaded.
            const createComponentFactory = this._reflector.resolveExternalReference(Identifiers.createComponentFactory);
            return createComponentFactory(selector, dirType, hostView, inputs, outputs, []);
        }
    }
    initComponentFactory(factory, ngContentSelectors) {
        if (!(factory instanceof StaticSymbol)) {
            factory.ngContentSelectors.push(...ngContentSelectors);
        }
    }
    _loadSummary(type, kind) {
        let typeSummary = this._summaryCache.get(type);
        if (!typeSummary) {
            const summary = this._summaryResolver.resolveSummary(type);
            typeSummary = summary ? summary.type : null;
            this._summaryCache.set(type, typeSummary || null);
        }
        return typeSummary && typeSummary.summaryKind === kind ? typeSummary : null;
    }
    getHostComponentMetadata(compMeta, hostViewType) {
        const hostType = this.getHostComponentType(compMeta.type.reference);
        if (!hostViewType) {
            hostViewType = this.getHostComponentViewClass(hostType);
        }
        // Note: ! is ok here as this method should only be called with normalized directive
        // metadata, which always fills in the selector.
        const template = CssSelector.parse(compMeta.selector)[0].getMatchingElementTemplate();
        const templateUrl = '';
        const htmlAst = this._htmlParser.parse(template, templateUrl);
        return cpl.CompileDirectiveMetadata.create({
            isHost: true,
            type: { reference: hostType, diDeps: [], lifecycleHooks: [] },
            template: new cpl.CompileTemplateMetadata({
                encapsulation: ViewEncapsulation.None,
                template,
                templateUrl,
                htmlAst,
                styles: [],
                styleUrls: [],
                ngContentSelectors: [],
                animations: [],
                isInline: true,
                externalStylesheets: [],
                interpolation: null,
                preserveWhitespaces: false,
            }),
            exportAs: null,
            changeDetection: ChangeDetectionStrategy.Default,
            inputs: [],
            outputs: [],
            host: {},
            isComponent: true,
            selector: '*',
            providers: [],
            viewProviders: [],
            queries: [],
            guards: {},
            viewQueries: [],
            componentViewType: hostViewType,
            rendererType: { id: '__Host__', encapsulation: ViewEncapsulation.None, styles: [], data: {} },
            entryComponents: [],
            componentFactory: null
        });
    }
    loadDirectiveMetadata(ngModuleType, directiveType, isSync) {
        if (this._directiveCache.has(directiveType)) {
            return null;
        }
        directiveType = resolveForwardRef(directiveType);
        const { annotation, metadata } = this.getNonNormalizedDirectiveMetadata(directiveType);
        const createDirectiveMetadata = (templateMetadata) => {
            const normalizedDirMeta = new cpl.CompileDirectiveMetadata({
                isHost: false,
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
                guards: metadata.guards,
                viewQueries: metadata.viewQueries,
                entryComponents: metadata.entryComponents,
                componentViewType: metadata.componentViewType,
                rendererType: metadata.rendererType,
                componentFactory: metadata.componentFactory,
                template: templateMetadata
            });
            if (templateMetadata) {
                this.initComponentFactory(metadata.componentFactory, templateMetadata.ngContentSelectors);
            }
            this._directiveCache.set(directiveType, normalizedDirMeta);
            this._summaryCache.set(directiveType, normalizedDirMeta.toSummary());
            return null;
        };
        if (metadata.isComponent) {
            const template = metadata.template;
            const templateMeta = this._directiveNormalizer.normalizeTemplate({
                ngModuleType,
                componentType: directiveType,
                moduleUrl: this._reflector.componentModuleUrl(directiveType, annotation),
                encapsulation: template.encapsulation,
                template: template.template,
                templateUrl: template.templateUrl,
                styles: template.styles,
                styleUrls: template.styleUrls,
                animations: template.animations,
                interpolation: template.interpolation,
                preserveWhitespaces: template.preserveWhitespaces
            });
            if (isPromise(templateMeta) && isSync) {
                this._reportError(componentStillLoadingError(directiveType), directiveType);
                return null;
            }
            return SyncAsync.then(templateMeta, createDirectiveMetadata);
        }
        else {
            // directive
            createDirectiveMetadata(null);
            return null;
        }
    }
    getNonNormalizedDirectiveMetadata(directiveType) {
        directiveType = resolveForwardRef(directiveType);
        if (!directiveType) {
            return null;
        }
        let cacheEntry = this._nonNormalizedDirectiveCache.get(directiveType);
        if (cacheEntry) {
            return cacheEntry;
        }
        const dirMeta = this._directiveResolver.resolve(directiveType, false);
        if (!dirMeta) {
            return null;
        }
        let nonNormalizedTemplateMetadata = undefined;
        if (createComponent.isTypeOf(dirMeta)) {
            // component
            const compMeta = dirMeta;
            assertArrayOfStrings('styles', compMeta.styles);
            assertArrayOfStrings('styleUrls', compMeta.styleUrls);
            assertInterpolationSymbols('interpolation', compMeta.interpolation);
            const animations = compMeta.animations;
            nonNormalizedTemplateMetadata = new cpl.CompileTemplateMetadata({
                encapsulation: noUndefined(compMeta.encapsulation),
                template: noUndefined(compMeta.template),
                templateUrl: noUndefined(compMeta.templateUrl),
                htmlAst: null,
                styles: compMeta.styles || [],
                styleUrls: compMeta.styleUrls || [],
                animations: animations || [],
                interpolation: noUndefined(compMeta.interpolation),
                isInline: !!compMeta.template,
                externalStylesheets: [],
                ngContentSelectors: [],
                preserveWhitespaces: noUndefined(dirMeta.preserveWhitespaces),
            });
        }
        let changeDetectionStrategy = null;
        let viewProviders = [];
        let entryComponentMetadata = [];
        let selector = dirMeta.selector;
        if (createComponent.isTypeOf(dirMeta)) {
            // Component
            const compMeta = dirMeta;
            changeDetectionStrategy = compMeta.changeDetection;
            if (compMeta.viewProviders) {
                viewProviders = this._getProvidersMetadata(compMeta.viewProviders, entryComponentMetadata, `viewProviders for "${stringifyType(directiveType)}"`, [], directiveType);
            }
            if (compMeta.entryComponents) {
                entryComponentMetadata = flattenAndDedupeArray(compMeta.entryComponents)
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
                selector = null;
            }
        }
        let providers = [];
        if (dirMeta.providers != null) {
            providers = this._getProvidersMetadata(dirMeta.providers, entryComponentMetadata, `providers for "${stringifyType(directiveType)}"`, [], directiveType);
        }
        let queries = [];
        let viewQueries = [];
        if (dirMeta.queries != null) {
            queries = this._getQueriesMetadata(dirMeta.queries, false, directiveType);
            viewQueries = this._getQueriesMetadata(dirMeta.queries, true, directiveType);
        }
        const metadata = cpl.CompileDirectiveMetadata.create({
            isHost: false,
            selector: selector,
            exportAs: noUndefined(dirMeta.exportAs),
            isComponent: !!nonNormalizedTemplateMetadata,
            type: this._getTypeMetadata(directiveType),
            template: nonNormalizedTemplateMetadata,
            changeDetection: changeDetectionStrategy,
            inputs: dirMeta.inputs || [],
            outputs: dirMeta.outputs || [],
            host: dirMeta.host || {},
            providers: providers || [],
            viewProviders: viewProviders || [],
            queries: queries || [],
            guards: dirMeta.guards || {},
            viewQueries: viewQueries || [],
            entryComponents: entryComponentMetadata,
            componentViewType: nonNormalizedTemplateMetadata ? this.getComponentViewClass(directiveType) :
                null,
            rendererType: nonNormalizedTemplateMetadata ? this.getRendererType(directiveType) : null,
            componentFactory: null
        });
        if (nonNormalizedTemplateMetadata) {
            metadata.componentFactory =
                this.getComponentFactory(selector, directiveType, metadata.inputs, metadata.outputs);
        }
        cacheEntry = { metadata, annotation: dirMeta };
        this._nonNormalizedDirectiveCache.set(directiveType, cacheEntry);
        return cacheEntry;
    }
    /**
     * Gets the metadata for the given directive.
     * This assumes `loadNgModuleDirectiveAndPipeMetadata` has been called first.
     */
    getDirectiveMetadata(directiveType) {
        const dirMeta = this._directiveCache.get(directiveType);
        if (!dirMeta) {
            this._reportError(syntaxError(`Illegal state: getDirectiveMetadata can only be called after loadNgModuleDirectiveAndPipeMetadata for a module that declares it. Directive ${stringifyType(directiveType)}.`), directiveType);
        }
        return dirMeta;
    }
    getDirectiveSummary(dirType) {
        const dirSummary = this._loadSummary(dirType, cpl.CompileSummaryKind.Directive);
        if (!dirSummary) {
            this._reportError(syntaxError(`Illegal state: Could not load the summary for directive ${stringifyType(dirType)}.`), dirType);
        }
        return dirSummary;
    }
    isDirective(type) {
        return !!this._loadSummary(type, cpl.CompileSummaryKind.Directive) ||
            this._directiveResolver.isDirective(type);
    }
    isAbstractDirective(type) {
        const summary = this._loadSummary(type, cpl.CompileSummaryKind.Directive);
        if (summary && !summary.isComponent) {
            return !summary.selector;
        }
        const meta = this._directiveResolver.resolve(type, false);
        if (meta && !createComponent.isTypeOf(meta)) {
            return !meta.selector;
        }
        return false;
    }
    isPipe(type) {
        return !!this._loadSummary(type, cpl.CompileSummaryKind.Pipe) ||
            this._pipeResolver.isPipe(type);
    }
    isNgModule(type) {
        return !!this._loadSummary(type, cpl.CompileSummaryKind.NgModule) ||
            this._ngModuleResolver.isNgModule(type);
    }
    getNgModuleSummary(moduleType, alreadyCollecting = null) {
        let moduleSummary = this._loadSummary(moduleType, cpl.CompileSummaryKind.NgModule);
        if (!moduleSummary) {
            const moduleMeta = this.getNgModuleMetadata(moduleType, false, alreadyCollecting);
            moduleSummary = moduleMeta ? moduleMeta.toSummary() : null;
            if (moduleSummary) {
                this._summaryCache.set(moduleType, moduleSummary);
            }
        }
        return moduleSummary;
    }
    /**
     * Loads the declared directives and pipes of an NgModule.
     */
    loadNgModuleDirectiveAndPipeMetadata(moduleType, isSync, throwIfNotFound = true) {
        const ngModule = this.getNgModuleMetadata(moduleType, throwIfNotFound);
        const loading = [];
        if (ngModule) {
            ngModule.declaredDirectives.forEach((id) => {
                const promise = this.loadDirectiveMetadata(moduleType, id.reference, isSync);
                if (promise) {
                    loading.push(promise);
                }
            });
            ngModule.declaredPipes.forEach((id) => this._loadPipeMetadata(id.reference));
        }
        return Promise.all(loading);
    }
    getShallowModuleMetadata(moduleType) {
        let compileMeta = this._shallowModuleCache.get(moduleType);
        if (compileMeta) {
            return compileMeta;
        }
        const ngModuleMeta = findLast(this._reflector.shallowAnnotations(moduleType), createNgModule.isTypeOf);
        compileMeta = {
            type: this._getTypeMetadata(moduleType),
            rawExports: ngModuleMeta.exports,
            rawImports: ngModuleMeta.imports,
            rawProviders: ngModuleMeta.providers,
        };
        this._shallowModuleCache.set(moduleType, compileMeta);
        return compileMeta;
    }
    getNgModuleMetadata(moduleType, throwIfNotFound = true, alreadyCollecting = null) {
        moduleType = resolveForwardRef(moduleType);
        let compileMeta = this._ngModuleCache.get(moduleType);
        if (compileMeta) {
            return compileMeta;
        }
        const meta = this._ngModuleResolver.resolve(moduleType, throwIfNotFound);
        if (!meta) {
            return null;
        }
        const declaredDirectives = [];
        const exportedNonModuleIdentifiers = [];
        const declaredPipes = [];
        const importedModules = [];
        const exportedModules = [];
        const providers = [];
        const entryComponents = [];
        const bootstrapComponents = [];
        const schemas = [];
        if (meta.imports) {
            flattenAndDedupeArray(meta.imports).forEach((importedType) => {
                let importedModuleType = undefined;
                if (isValidType(importedType)) {
                    importedModuleType = importedType;
                }
                else if (importedType && importedType.ngModule) {
                    const moduleWithProviders = importedType;
                    importedModuleType = moduleWithProviders.ngModule;
                    if (moduleWithProviders.providers) {
                        providers.push(...this._getProvidersMetadata(moduleWithProviders.providers, entryComponents, `provider for the NgModule '${stringifyType(importedModuleType)}'`, [], importedType));
                    }
                }
                if (importedModuleType) {
                    if (this._checkSelfImport(moduleType, importedModuleType))
                        return;
                    if (!alreadyCollecting)
                        alreadyCollecting = new Set();
                    if (alreadyCollecting.has(importedModuleType)) {
                        this._reportError(syntaxError(`${this._getTypeDescriptor(importedModuleType)} '${stringifyType(importedType)}' is imported recursively by the module '${stringifyType(moduleType)}'.`), moduleType);
                        return;
                    }
                    alreadyCollecting.add(importedModuleType);
                    const importedModuleSummary = this.getNgModuleSummary(importedModuleType, alreadyCollecting);
                    alreadyCollecting.delete(importedModuleType);
                    if (!importedModuleSummary) {
                        const err = syntaxError(`Unexpected ${this._getTypeDescriptor(importedType)} '${stringifyType(importedType)}' imported by the module '${stringifyType(moduleType)}'. Please add a @NgModule annotation.`);
                        // If possible, record additional context for this error to enable more useful
                        // diagnostics on the compiler side.
                        if (importedType instanceof StaticSymbol) {
                            err[MISSING_NG_MODULE_METADATA_ERROR_DATA] = {
                                fileName: importedType.filePath,
                                className: importedType.name,
                            };
                        }
                        this._reportError(err, moduleType);
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
                if (!alreadyCollecting)
                    alreadyCollecting = new Set();
                if (alreadyCollecting.has(exportedType)) {
                    this._reportError(syntaxError(`${this._getTypeDescriptor(exportedType)} '${stringify(exportedType)}' is exported recursively by the module '${stringifyType(moduleType)}'`), moduleType);
                    return;
                }
                alreadyCollecting.add(exportedType);
                const exportedModuleSummary = this.getNgModuleSummary(exportedType, alreadyCollecting);
                alreadyCollecting.delete(exportedType);
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
        const transitiveModule = this._getTransitiveNgModuleMetadata(importedModules, exportedModules);
        if (meta.declarations) {
            flattenAndDedupeArray(meta.declarations).forEach((declaredType) => {
                if (!isValidType(declaredType)) {
                    this._reportError(syntaxError(`Unexpected value '${stringifyType(declaredType)}' declared by the module '${stringifyType(moduleType)}'`), moduleType);
                    return;
                }
                const declaredIdentifier = this._getIdentifierMetadata(declaredType);
                if (this.isDirective(declaredType)) {
                    if (this.isAbstractDirective(declaredType)) {
                        this._reportError(syntaxError(`Directive ${stringifyType(declaredType)} has no selector, please add it!`), declaredType);
                    }
                    transitiveModule.addDirective(declaredIdentifier);
                    declaredDirectives.push(declaredIdentifier);
                    this._addTypeToModule(declaredType, moduleType);
                }
                else if (this.isPipe(declaredType)) {
                    transitiveModule.addPipe(declaredIdentifier);
                    transitiveModule.pipes.push(declaredIdentifier);
                    declaredPipes.push(declaredIdentifier);
                    this._addTypeToModule(declaredType, moduleType);
                }
                else {
                    this._reportError(syntaxError(`Unexpected ${this._getTypeDescriptor(declaredType)} '${stringifyType(declaredType)}' declared by the module '${stringifyType(moduleType)}'. Please add a @Pipe/@Directive/@Component annotation.`), moduleType);
                    return;
                }
            });
        }
        const exportedDirectives = [];
        const exportedPipes = [];
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
                return;
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
            id: meta.id || null,
        });
        entryComponents.forEach((id) => transitiveModule.addEntryComponent(id));
        providers.forEach((provider) => transitiveModule.addProvider(provider, compileMeta.type));
        transitiveModule.addModule(compileMeta.type);
        this._ngModuleCache.set(moduleType, compileMeta);
        return compileMeta;
    }
    _checkSelfImport(moduleType, importedModuleType) {
        if (moduleType === importedModuleType) {
            this._reportError(syntaxError(`'${stringifyType(moduleType)}' module can't import itself`), moduleType);
            return true;
        }
        return false;
    }
    _getTypeDescriptor(type) {
        if (isValidType(type)) {
            if (this.isDirective(type)) {
                return 'directive';
            }
            if (this.isPipe(type)) {
                return 'pipe';
            }
            if (this.isNgModule(type)) {
                return 'module';
            }
        }
        if (type.provide) {
            return 'provider';
        }
        return 'value';
    }
    _addTypeToModule(type, moduleType) {
        const oldModule = this._ngModuleOfTypes.get(type);
        if (oldModule && oldModule !== moduleType) {
            this._reportError(syntaxError(`Type ${stringifyType(type)} is part of the declarations of 2 modules: ${stringifyType(oldModule)} and ${stringifyType(moduleType)}! ` +
                `Please consider moving ${stringifyType(type)} to a higher module that imports ${stringifyType(oldModule)} and ${stringifyType(moduleType)}. ` +
                `You can also create a new NgModule that exports and includes ${stringifyType(type)} then import that NgModule in ${stringifyType(oldModule)} and ${stringifyType(moduleType)}.`), moduleType);
            return;
        }
        this._ngModuleOfTypes.set(type, moduleType);
    }
    _getTransitiveNgModuleMetadata(importedModules, exportedModules) {
        // collect `providers` / `entryComponents` from all imported and all exported modules
        const result = new cpl.TransitiveCompileNgModuleMetadata();
        const modulesByToken = new Map();
        importedModules.concat(exportedModules).forEach((modSummary) => {
            modSummary.modules.forEach((mod) => result.addModule(mod));
            modSummary.entryComponents.forEach((comp) => result.addEntryComponent(comp));
            const addedTokens = new Set();
            modSummary.providers.forEach((entry) => {
                const tokenRef = cpl.tokenReference(entry.provider.token);
                let prevModules = modulesByToken.get(tokenRef);
                if (!prevModules) {
                    prevModules = new Set();
                    modulesByToken.set(tokenRef, prevModules);
                }
                const moduleRef = entry.module.reference;
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
    _getIdentifierMetadata(type) {
        type = resolveForwardRef(type);
        return { reference: type };
    }
    isInjectable(type) {
        const annotations = this._reflector.tryAnnotations(type);
        return annotations.some(ann => createInjectable.isTypeOf(ann));
    }
    getInjectableSummary(type) {
        return {
            summaryKind: cpl.CompileSummaryKind.Injectable,
            type: this._getTypeMetadata(type, null, false)
        };
    }
    getInjectableMetadata(type, dependencies = null, throwOnUnknownDeps = true) {
        const typeSummary = this._loadSummary(type, cpl.CompileSummaryKind.Injectable);
        const typeMetadata = typeSummary ?
            typeSummary.type :
            this._getTypeMetadata(type, dependencies, throwOnUnknownDeps);
        const annotations = this._reflector.annotations(type).filter(ann => createInjectable.isTypeOf(ann));
        if (annotations.length === 0) {
            return null;
        }
        const meta = annotations[annotations.length - 1];
        return {
            symbol: type,
            type: typeMetadata,
            providedIn: meta.providedIn,
            useValue: meta.useValue,
            useClass: meta.useClass,
            useExisting: meta.useExisting,
            useFactory: meta.useFactory,
            deps: meta.deps,
        };
    }
    _getTypeMetadata(type, dependencies = null, throwOnUnknownDeps = true) {
        const identifier = this._getIdentifierMetadata(type);
        return {
            reference: identifier.reference,
            diDeps: this._getDependenciesMetadata(identifier.reference, dependencies, throwOnUnknownDeps),
            lifecycleHooks: getAllLifecycleHooks(this._reflector, identifier.reference),
        };
    }
    _getFactoryMetadata(factory, dependencies = null) {
        factory = resolveForwardRef(factory);
        return { reference: factory, diDeps: this._getDependenciesMetadata(factory, dependencies) };
    }
    /**
     * Gets the metadata for the given pipe.
     * This assumes `loadNgModuleDirectiveAndPipeMetadata` has been called first.
     */
    getPipeMetadata(pipeType) {
        const pipeMeta = this._pipeCache.get(pipeType);
        if (!pipeMeta) {
            this._reportError(syntaxError(`Illegal state: getPipeMetadata can only be called after loadNgModuleDirectiveAndPipeMetadata for a module that declares it. Pipe ${stringifyType(pipeType)}.`), pipeType);
        }
        return pipeMeta || null;
    }
    getPipeSummary(pipeType) {
        const pipeSummary = this._loadSummary(pipeType, cpl.CompileSummaryKind.Pipe);
        if (!pipeSummary) {
            this._reportError(syntaxError(`Illegal state: Could not load the summary for pipe ${stringifyType(pipeType)}.`), pipeType);
        }
        return pipeSummary;
    }
    getOrLoadPipeMetadata(pipeType) {
        let pipeMeta = this._pipeCache.get(pipeType);
        if (!pipeMeta) {
            pipeMeta = this._loadPipeMetadata(pipeType);
        }
        return pipeMeta;
    }
    _loadPipeMetadata(pipeType) {
        pipeType = resolveForwardRef(pipeType);
        const pipeAnnotation = this._pipeResolver.resolve(pipeType);
        const pipeMeta = new cpl.CompilePipeMetadata({
            type: this._getTypeMetadata(pipeType),
            name: pipeAnnotation.name,
            pure: !!pipeAnnotation.pure
        });
        this._pipeCache.set(pipeType, pipeMeta);
        this._summaryCache.set(pipeType, pipeMeta.toSummary());
        return pipeMeta;
    }
    _getDependenciesMetadata(typeOrFunc, dependencies, throwOnUnknownDeps = true) {
        let hasUnknownDeps = false;
        const params = dependencies || this._reflector.parameters(typeOrFunc) || [];
        const dependenciesMetadata = params.map((param) => {
            let isAttribute = false;
            let isHost = false;
            let isSelf = false;
            let isSkipSelf = false;
            let isOptional = false;
            let token = null;
            if (Array.isArray(param)) {
                param.forEach((paramEntry) => {
                    if (createHost.isTypeOf(paramEntry)) {
                        isHost = true;
                    }
                    else if (createSelf.isTypeOf(paramEntry)) {
                        isSelf = true;
                    }
                    else if (createSkipSelf.isTypeOf(paramEntry)) {
                        isSkipSelf = true;
                    }
                    else if (createOptional.isTypeOf(paramEntry)) {
                        isOptional = true;
                    }
                    else if (createAttribute.isTypeOf(paramEntry)) {
                        isAttribute = true;
                        token = paramEntry.attributeName;
                    }
                    else if (createInject.isTypeOf(paramEntry)) {
                        token = paramEntry.token;
                    }
                    else if (createInjectionToken.isTypeOf(paramEntry) ||
                        paramEntry instanceof StaticSymbol) {
                        token = paramEntry;
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
                return {};
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
            const depsTokens = dependenciesMetadata.map((dep) => dep.token ? stringifyType(dep.token) : '?').join(', ');
            const message = `Can't resolve all parameters for ${stringifyType(typeOrFunc)}: (${depsTokens}).`;
            if (throwOnUnknownDeps || this._config.strictInjectionParameters) {
                this._reportError(syntaxError(message), typeOrFunc);
            }
        }
        return dependenciesMetadata;
    }
    _getTokenMetadata(token) {
        token = resolveForwardRef(token);
        let compileToken;
        if (typeof token === 'string') {
            compileToken = { value: token };
        }
        else {
            compileToken = { identifier: { reference: token } };
        }
        return compileToken;
    }
    _getProvidersMetadata(providers, targetEntryComponents, debugInfo, compileProviders = [], type) {
        providers.forEach((provider, providerIdx) => {
            if (Array.isArray(provider)) {
                this._getProvidersMetadata(provider, targetEntryComponents, debugInfo, compileProviders);
            }
            else {
                provider = resolveForwardRef(provider);
                let providerMeta = undefined;
                if (provider && typeof provider === 'object' && provider.hasOwnProperty('provide')) {
                    this._validateProvider(provider);
                    providerMeta = new cpl.ProviderMeta(provider.provide, provider);
                }
                else if (isValidType(provider)) {
                    providerMeta = new cpl.ProviderMeta(provider, { useClass: provider });
                }
                else if (provider === void 0) {
                    this._reportError(syntaxError(`Encountered undefined provider! Usually this means you have a circular dependencies. This might be caused by using 'barrel' index.ts files.`));
                    return;
                }
                else {
                    const providersInfo = providers
                        .reduce((soFar, seenProvider, seenProviderIdx) => {
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
                    }, [])
                        .join(', ');
                    this._reportError(syntaxError(`Invalid ${debugInfo ?
                        debugInfo :
                        'provider'} - only instances of Provider and Type are allowed, got: [${providersInfo}]`), type);
                    return;
                }
                if (providerMeta.token ===
                    this._reflector.resolveExternalReference(Identifiers.ANALYZE_FOR_ENTRY_COMPONENTS)) {
                    targetEntryComponents.push(...this._getEntryComponentsFromProvider(providerMeta, type));
                }
                else {
                    compileProviders.push(this.getProviderMetadata(providerMeta));
                }
            }
        });
        return compileProviders;
    }
    _validateProvider(provider) {
        if (provider.hasOwnProperty('useClass') && provider.useClass == null) {
            this._reportError(syntaxError(`Invalid provider for ${stringifyType(provider.provide)}. useClass cannot be ${provider.useClass}.
           Usually it happens when:
           1. There's a circular dependency (might be caused by using index.ts (barrel) files).
           2. Class was used before it was declared. Use forwardRef in this case.`));
        }
    }
    _getEntryComponentsFromProvider(provider, type) {
        const components = [];
        const collectedIdentifiers = [];
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
            const entry = this._getEntryComponentMetadata(identifier.reference, false);
            if (entry) {
                components.push(entry);
            }
        });
        return components;
    }
    _getEntryComponentMetadata(dirType, throwIfNotFound = true) {
        const dirMeta = this.getNonNormalizedDirectiveMetadata(dirType);
        if (dirMeta && dirMeta.metadata.isComponent) {
            return { componentType: dirType, componentFactory: dirMeta.metadata.componentFactory };
        }
        const dirSummary = this._loadSummary(dirType, cpl.CompileSummaryKind.Directive);
        if (dirSummary && dirSummary.isComponent) {
            return { componentType: dirType, componentFactory: dirSummary.componentFactory };
        }
        if (throwIfNotFound) {
            throw syntaxError(`${dirType.name} cannot be used as an entry component.`);
        }
        return null;
    }
    _getInjectableTypeMetadata(type, dependencies = null) {
        const typeSummary = this._loadSummary(type, cpl.CompileSummaryKind.Injectable);
        if (typeSummary) {
            return typeSummary.type;
        }
        return this._getTypeMetadata(type, dependencies);
    }
    getProviderMetadata(provider) {
        let compileDeps = undefined;
        let compileTypeMetadata = null;
        let compileFactoryMetadata = null;
        let token = this._getTokenMetadata(provider.token);
        if (provider.useClass) {
            compileTypeMetadata =
                this._getInjectableTypeMetadata(provider.useClass, provider.dependencies);
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
            useExisting: provider.useExisting ? this._getTokenMetadata(provider.useExisting) : undefined,
            deps: compileDeps,
            multi: provider.multi
        };
    }
    _getQueriesMetadata(queries, isViewQuery, directiveType) {
        const res = [];
        Object.keys(queries).forEach((propertyName) => {
            const query = queries[propertyName];
            if (query.isViewQuery === isViewQuery) {
                res.push(this._getQueryMetadata(query, propertyName, directiveType));
            }
        });
        return res;
    }
    _queryVarBindings(selector) {
        return selector.split(/\s*,\s*/);
    }
    _getQueryMetadata(q, propertyName, typeOrFunc) {
        let selectors;
        if (typeof q.selector === 'string') {
            selectors =
                this._queryVarBindings(q.selector).map(varName => this._getTokenMetadata(varName));
        }
        else {
            if (!q.selector) {
                this._reportError(syntaxError(`Can't construct a query for the property "${propertyName}" of "${stringifyType(typeOrFunc)}" since the query selector wasn't defined.`), typeOrFunc);
                selectors = [];
            }
            else {
                selectors = [this._getTokenMetadata(q.selector)];
            }
        }
        return {
            selectors,
            first: q.first,
            descendants: q.descendants,
            propertyName,
            read: q.read ? this._getTokenMetadata(q.read) : null,
            static: q.static
        };
    }
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
}
function flattenArray(tree, out = []) {
    if (tree) {
        for (let i = 0; i < tree.length; i++) {
            const item = resolveForwardRef(tree[i]);
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
function dedupeArray(array) {
    if (array) {
        return Array.from(new Set(array));
    }
    return [];
}
function flattenAndDedupeArray(tree) {
    return dedupeArray(flattenArray(tree));
}
function isValidType(value) {
    return (value instanceof StaticSymbol) || (value instanceof Type);
}
function extractIdentifiers(value, targetIdentifiers) {
    visitValue(value, new _CompileValueConverter(), targetIdentifiers);
}
class _CompileValueConverter extends ValueTransformer {
    visitOther(value, targetIdentifiers) {
        targetIdentifiers.push({ reference: value });
    }
}
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
 */
function componentStillLoadingError(compType) {
    const error = Error(`Can't compile synchronously as ${stringify(compType)} is still being loaded!`);
    error[ERROR_COMPONENT_TYPE] = compType;
    return error;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWRhdGFfcmVzb2x2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWV0YWRhdGFfcmVzb2x2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBb0IsTUFBTSxxQkFBcUIsQ0FBQztBQUNwRSxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDN0MsT0FBTyxFQUFDLG9CQUFvQixFQUFFLDBCQUEwQixFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQzlFLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFHMUMsT0FBTyxFQUFDLHVCQUF1QixFQUFhLGVBQWUsRUFBRSxlQUFlLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxvQkFBb0IsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQStFLElBQUksRUFBRSxpQkFBaUIsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUVoVSxPQUFPLEVBQW9CLFFBQVEsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ2pFLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDMUMsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFLM0QsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUV2QyxPQUFPLEVBQVUsU0FBUyxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFJM0ksTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQUcsaUJBQWlCLENBQUM7QUFFdEQsTUFBTSxxQ0FBcUMsR0FBRyxvQ0FBb0MsQ0FBQztBQU9uRixNQUFNLFVB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Q0FBQyxLQUFLLEVBQUUsSUFBSSxzQkFBc0IsRUFBRSxFQUFFLGlCQUFpQixDQUFDLENBQUM7QUFDckUsQ0FBQztBQUVELE1BQU0sc0JBQXVCLFNBQVEsZ0JBQWdCO0lBQ25ELFVBQVUsQ0FBQyxLQUFVLEVBQUUsaUJBQWtEO1FBQ3ZFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO0lBQzdDLENBQUM7Q0FDRjtBQUVELFNBQVMsYUFBYSxDQUFDLElBQVM7SUFDOUIsSUFBSSxJQUFJLFlBQVksWUFBWSxFQUFFO1FBQ2hDLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxPQUFPLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztLQUMzQztTQUFNO1FBQ0wsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDeEI7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLDBCQUEwQixDQUFDLFFBQWM7SUFDaEQsTUFBTSxLQUFLLEdBQ1AsS0FBSyxDQUFDLGtDQUFrQyxTQUFTLENBQUMsUUFBUSxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDekYsS0FBYSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsUUFBUSxDQUFDO0lBQ2hELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbCwgU3RhdGljU3ltYm9sQ2FjaGV9IGZyb20gJy4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtuZ2ZhY3RvcnlGaWxlUGF0aH0gZnJvbSAnLi9hb3QvdXRpbCc7XG5pbXBvcnQge2Fzc2VydEFycmF5T2ZTdHJpbmdzLCBhc3NlcnRJbnRlcnBvbGF0aW9uU3ltYm9sc30gZnJvbSAnLi9hc3NlcnRpb25zJztcbmltcG9ydCAqIGFzIGNwbCBmcm9tICcuL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7Q29tcGlsZXJDb25maWd9IGZyb20gJy4vY29uZmlnJztcbmltcG9ydCB7Q2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIENvbXBvbmVudCwgY3JlYXRlQXR0cmlidXRlLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZUhvc3QsIGNyZWF0ZUluamVjdCwgY3JlYXRlSW5qZWN0YWJsZSwgY3JlYXRlSW5qZWN0aW9uVG9rZW4sIGNyZWF0ZU5nTW9kdWxlLCBjcmVhdGVPcHRpb25hbCwgY3JlYXRlU2VsZiwgY3JlYXRlU2tpcFNlbGYsIERpcmVjdGl2ZSwgSW5qZWN0YWJsZSwgTW9kdWxlV2l0aFByb3ZpZGVycywgUHJvdmlkZXIsIFF1ZXJ5LCBTY2hlbWFNZXRhZGF0YSwgVHlwZSwgVmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4vY29yZSc7XG5pbXBvcnQge0RpcmVjdGl2ZU5vcm1hbGl6ZXJ9IGZyb20gJy4vZGlyZWN0aXZlX25vcm1hbGl6ZXInO1xuaW1wb3J0IHtEaXJlY3RpdmVSZXNvbHZlciwgZmluZExhc3R9IGZyb20gJy4vZGlyZWN0aXZlX3Jlc29sdmVyJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4vaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtnZXRBbGxMaWZlY3ljbGVIb29rc30gZnJvbSAnLi9saWZlY3ljbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7SHRtbFBhcnNlcn0gZnJvbSAnLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtOZ01vZHVsZVJlc29sdmVyfSBmcm9tICcuL25nX21vZHVsZV9yZXNvbHZlcic7XG5pbXBvcnQge1BpcGVSZXNvbHZlcn0gZnJvbSAnLi9waXBlX3Jlc29sdmVyJztcbmltcG9ydCB7RWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuL3NjaGVtYS9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuL3NlbGVjdG9yJztcbmltcG9ydCB7U3VtbWFyeVJlc29sdmVyfSBmcm9tICcuL3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtDb25zb2xlLCBpc1Byb21pc2UsIG5vVW5kZWZpbmVkLCByZXNvbHZlRm9yd2FyZFJlZiwgc3RyaW5naWZ5LCBTeW5jQXN5bmMsIHN5bnRheEVycm9yLCBWYWx1ZVRyYW5zZm9ybWVyLCB2aXNpdFZhbHVlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBFcnJvckNvbGxlY3RvciA9IChlcnJvcjogYW55LCB0eXBlPzogYW55KSA9PiB2b2lkO1xuXG5leHBvcnQgY29uc3QgRVJST1JfQ09NUE9ORU5UX1RZUEUgPSAnbmdDb21wb25lbnRUeXBlJztcblxuY29uc3QgTUlTU0lOR19OR19NT0RVTEVfTUVUQURBVEFfRVJST1JfREFUQSA9ICduZ01pc3NpbmdOZ01vZHVsZU1ldGFkYXRhRXJyb3JEYXRhJztcbmV4cG9ydCBpbnRlcmZhY2UgTWlzc2luZ05nTW9kdWxlTWV0YWRhdGFFcnJvckRhdGEge1xuICBmaWxlTmFtZTogc3RyaW5nO1xuICBjbGFzc05hbWU6IHN0cmluZztcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWlzc2luZ05nTW9kdWxlTWV0YWRhdGFFcnJvckRhdGEoZXJyb3I6IGFueSk6IE1pc3NpbmdOZ01vZHVsZU1ldGFkYXRhRXJyb3JEYXRhfFxuICAgIG51bGwge1xuICByZXR1cm4gZXJyb3JbTUlTU0lOR19OR19NT0RVTEVfTUVUQURBVEFfRVJST1JfREFUQV0gPz8gbnVsbDtcbn1cblxuLy8gRGVzaWduIG5vdGVzOlxuLy8gLSBkb24ndCBsYXppbHkgY3JlYXRlIG1ldGFkYXRhOlxuLy8gICBGb3Igc29tZSBtZXRhZGF0YSwgd2UgbmVlZCB0byBkbyBhc3luYyB3b3JrIHNvbWV0aW1lcyxcbi8vICAgc28gdGhlIHVzZXIgaGFzIHRvIGtpY2sgb2ZmIHRoaXMgbG9hZGluZy5cbi8vICAgQnV0IHdlIHdhbnQgdG8gcmVwb3J0IGVycm9ycyBldmVuIHdoZW4gdGhlIGFzeW5jIHdvcmsgaXNcbi8vICAgbm90IHJlcXVpcmVkIHRvIGNoZWNrIHRoYXQgdGhlIHVzZXIgd291bGQgaGF2ZSBiZWVuIGFibGVcbi8vICAgdG8gd2FpdCBjb3JyZWN0bHkuXG5leHBvcnQgY2xhc3MgQ29tcGlsZU1ldGFkYXRhUmVzb2x2ZXIge1xuICBwcml2YXRlIF9ub25Ob3JtYWxpemVkRGlyZWN0aXZlQ2FjaGUgPVxuICAgICAgbmV3IE1hcDxUeXBlLCB7YW5ub3RhdGlvbjogRGlyZWN0aXZlLCBtZXRhZGF0YTogY3BsLkNvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YX0+KCk7XG4gIHByaXZhdGUgX2RpcmVjdGl2ZUNhY2hlID0gbmV3IE1hcDxUeXBlLCBjcGwuQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhPigpO1xuICBwcml2YXRlIF9zdW1tYXJ5Q2FjaGUgPSBuZXcgTWFwPFR5cGUsIGNwbC5Db21waWxlVHlwZVN1bW1hcnl8bnVsbD4oKTtcbiAgcHJpdmF0ZSBfcGlwZUNhY2hlID0gbmV3IE1hcDxUeXBlLCBjcGwuQ29tcGlsZVBpcGVNZXRhZGF0YT4oKTtcbiAgcHJpdmF0ZSBfbmdNb2R1bGVDYWNoZSA9IG5ldyBNYXA8VHlwZSwgY3BsLkNvbXBpbGVOZ01vZHVsZU1ldGFkYXRhPigpO1xuICBwcml2YXRlIF9uZ01vZHVsZU9mVHlwZXMgPSBuZXcgTWFwPFR5cGUsIFR5cGU+KCk7XG4gIHByaXZhdGUgX3NoYWxsb3dNb2R1bGVDYWNoZSA9IG5ldyBNYXA8VHlwZSwgY3BsLkNvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGE+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9jb25maWc6IENvbXBpbGVyQ29uZmlnLCBwcml2YXRlIF9odG1sUGFyc2VyOiBIdG1sUGFyc2VyLFxuICAgICAgcHJpdmF0ZSBfbmdNb2R1bGVSZXNvbHZlcjogTmdNb2R1bGVSZXNvbHZlciwgcHJpdmF0ZSBfZGlyZWN0aXZlUmVzb2x2ZXI6IERpcmVjdGl2ZVJlc29sdmVyLFxuICAgICAgcHJpdmF0ZSBfcGlwZVJlc29sdmVyOiBQaXBlUmVzb2x2ZXIsIHByaXZhdGUgX3N1bW1hcnlSZXNvbHZlcjogU3VtbWFyeVJlc29sdmVyPGFueT4sXG4gICAgICBwcml2YXRlIF9zY2hlbWFSZWdpc3RyeTogRWxlbWVudFNjaGVtYVJlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBfZGlyZWN0aXZlTm9ybWFsaXplcjogRGlyZWN0aXZlTm9ybWFsaXplciwgcHJpdmF0ZSBfY29uc29sZTogQ29uc29sZSxcbiAgICAgIHByaXZhdGUgX3N0YXRpY1N5bWJvbENhY2hlOiBTdGF0aWNTeW1ib2xDYWNoZSwgcHJpdmF0ZSBfcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLFxuICAgICAgcHJpdmF0ZSBfZXJyb3JDb2xsZWN0b3I/OiBFcnJvckNvbGxlY3Rvcikge31cblxuICBnZXRSZWZsZWN0b3IoKTogQ29tcGlsZVJlZmxlY3RvciB7XG4gICAgcmV0dXJuIHRoaXMuX3JlZmxlY3RvcjtcbiAgfVxuXG4gIGNsZWFyQ2FjaGVGb3IodHlwZTogVHlwZSkge1xuICAgIGNvbnN0IGRpck1ldGEgPSB0aGlzLl9kaXJlY3RpdmVDYWNoZS5nZXQodHlwZSk7XG4gICAgdGhpcy5fZGlyZWN0aXZlQ2FjaGUuZGVsZXRlKHR5cGUpO1xuICAgIHRoaXMuX25vbk5vcm1hbGl6ZWREaXJlY3RpdmVDYWNoZS5kZWxldGUodHlwZSk7XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlLmRlbGV0ZSh0eXBlKTtcbiAgICB0aGlzLl9waXBlQ2FjaGUuZGVsZXRlKHR5cGUpO1xuICAgIHRoaXMuX25nTW9kdWxlT2ZUeXBlcy5kZWxldGUodHlwZSk7XG4gICAgLy8gQ2xlYXIgYWxsIG9mIHRoZSBOZ01vZHVsZSBhcyB0aGV5IGNvbnRhaW4gdHJhbnNpdGl2ZSBpbmZvcm1hdGlvbiFcbiAgICB0aGlzLl9uZ01vZHVsZUNhY2hlLmNsZWFyKCk7XG4gICAgaWYgKGRpck1ldGEpIHtcbiAgICAgIHRoaXMuX2RpcmVjdGl2ZU5vcm1hbGl6ZXIuY2xlYXJDYWNoZUZvcihkaXJNZXRhKTtcbiAgICB9XG4gIH1cblxuICBjbGVhckNhY2hlKCk6IHZvaWQge1xuICAgIHRoaXMuX2RpcmVjdGl2ZUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fbm9uTm9ybWFsaXplZERpcmVjdGl2ZUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fcGlwZUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fbmdNb2R1bGVDYWNoZS5jbGVhcigpO1xuICAgIHRoaXMuX25nTW9kdWxlT2ZUeXBlcy5jbGVhcigpO1xuICAgIHRoaXMuX2RpcmVjdGl2ZU5vcm1hbGl6ZXIuY2xlYXJDYWNoZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlUHJveHlDbGFzcyhiYXNlVHlwZTogYW55LCBuYW1lOiBzdHJpbmcpOiBjcGwuUHJveHlDbGFzcyB7XG4gICAgbGV0IGRlbGVnYXRlOiBhbnkgPSBudWxsO1xuICAgIGNvbnN0IHByb3h5Q2xhc3M6IGNwbC5Qcm94eUNsYXNzID0gPGFueT5mdW5jdGlvbih0aGlzOiB1bmtub3duKSB7XG4gICAgICBpZiAoIWRlbGVnYXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBDbGFzcyAke25hbWV9IGZvciB0eXBlICR7c3RyaW5naWZ5KGJhc2VUeXBlKX0gaXMgbm90IGNvbXBpbGVkIHlldCFgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkZWxlZ2F0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gICAgcHJveHlDbGFzcy5zZXREZWxlZ2F0ZSA9IChkKSA9PiB7XG4gICAgICBkZWxlZ2F0ZSA9IGQ7XG4gICAgICAoPGFueT5wcm94eUNsYXNzKS5wcm90b3R5cGUgPSBkLnByb3RvdHlwZTtcbiAgICB9O1xuICAgIC8vIE1ha2Ugc3RyaW5naWZ5IHdvcmsgY29ycmVjdGx5XG4gICAgKDxhbnk+cHJveHlDbGFzcykub3ZlcnJpZGRlbk5hbWUgPSBuYW1lO1xuICAgIHJldHVybiBwcm94eUNsYXNzO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRHZW5lcmF0ZWRDbGFzcyhkaXJUeXBlOiBhbnksIG5hbWU6IHN0cmluZyk6IFN0YXRpY1N5bWJvbHxjcGwuUHJveHlDbGFzcyB7XG4gICAgaWYgKGRpclR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGF0aWNTeW1ib2xDYWNoZS5nZXQobmdmYWN0b3J5RmlsZVBhdGgoZGlyVHlwZS5maWxlUGF0aCksIG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fY3JlYXRlUHJveHlDbGFzcyhkaXJUeXBlLCBuYW1lKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldENvbXBvbmVudFZpZXdDbGFzcyhkaXJUeXBlOiBhbnkpOiBTdGF0aWNTeW1ib2x8Y3BsLlByb3h5Q2xhc3Mge1xuICAgIHJldHVybiB0aGlzLmdldEdlbmVyYXRlZENsYXNzKGRpclR5cGUsIGNwbC52aWV3Q2xhc3NOYW1lKGRpclR5cGUsIDApKTtcbiAgfVxuXG4gIGdldEhvc3RDb21wb25lbnRWaWV3Q2xhc3MoZGlyVHlwZTogYW55KTogU3RhdGljU3ltYm9sfGNwbC5Qcm94eUNsYXNzIHtcbiAgICByZXR1cm4gdGhpcy5nZXRHZW5lcmF0ZWRDbGFzcyhkaXJUeXBlLCBjcGwuaG9zdFZpZXdDbGFzc05hbWUoZGlyVHlwZSkpO1xuICB9XG5cbiAgZ2V0SG9zdENvbXBvbmVudFR5cGUoZGlyVHlwZTogYW55KTogU3RhdGljU3ltYm9sfGNwbC5Qcm94eUNsYXNzIHtcbiAgICBjb25zdCBuYW1lID0gYCR7Y3BsLmlkZW50aWZpZXJOYW1lKHtyZWZlcmVuY2U6IGRpclR5cGV9KX1fSG9zdGA7XG4gICAgaWYgKGRpclR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGF0aWNTeW1ib2xDYWNoZS5nZXQoZGlyVHlwZS5maWxlUGF0aCwgbmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2NyZWF0ZVByb3h5Q2xhc3MoZGlyVHlwZSwgbmFtZSk7XG4gIH1cblxuICBwcml2YXRlIGdldFJlbmRlcmVyVHlwZShkaXJUeXBlOiBhbnkpOiBTdGF0aWNTeW1ib2x8b2JqZWN0IHtcbiAgICBpZiAoZGlyVHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXRpY1N5bWJvbENhY2hlLmdldChcbiAgICAgICAgICBuZ2ZhY3RvcnlGaWxlUGF0aChkaXJUeXBlLmZpbGVQYXRoKSwgY3BsLnJlbmRlcmVyVHlwZU5hbWUoZGlyVHlwZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyByZXR1cm5pbmcgYW4gb2JqZWN0IGFzIHByb3h5LFxuICAgICAgLy8gdGhhdCB3ZSBmaWxsIGxhdGVyIGR1cmluZyBydW50aW1lIGNvbXBpbGF0aW9uLlxuICAgICAgcmV0dXJuIDxhbnk+e307XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRDb21wb25lbnRGYWN0b3J5KFxuICAgICAgc2VsZWN0b3I6IHN0cmluZywgZGlyVHlwZTogYW55LCBpbnB1dHM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9fG51bGwsXG4gICAgICBvdXRwdXRzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSk6IFN0YXRpY1N5bWJvbHxvYmplY3Qge1xuICAgIGlmIChkaXJUeXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhdGljU3ltYm9sQ2FjaGUuZ2V0KFxuICAgICAgICAgIG5nZmFjdG9yeUZpbGVQYXRoKGRpclR5cGUuZmlsZVBhdGgpLCBjcGwuY29tcG9uZW50RmFjdG9yeU5hbWUoZGlyVHlwZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBob3N0VmlldyA9IHRoaXMuZ2V0SG9zdENvbXBvbmVudFZpZXdDbGFzcyhkaXJUeXBlKTtcbiAgICAgIC8vIE5vdGU6IG5nQ29udGVudFNlbGVjdG9ycyB3aWxsIGJlIGZpbGxlZCBsYXRlciBvbmNlIHRoZSB0ZW1wbGF0ZSBpc1xuICAgICAgLy8gbG9hZGVkLlxuICAgICAgY29uc3QgY3JlYXRlQ29tcG9uZW50RmFjdG9yeSA9XG4gICAgICAgICAgdGhpcy5fcmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5jcmVhdGVDb21wb25lbnRGYWN0b3J5KTtcbiAgICAgIHJldHVybiBjcmVhdGVDb21wb25lbnRGYWN0b3J5KHNlbGVjdG9yLCBkaXJUeXBlLCA8YW55Pmhvc3RWaWV3LCBpbnB1dHMsIG91dHB1dHMsIFtdKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGluaXRDb21wb25lbnRGYWN0b3J5KGZhY3Rvcnk6IFN0YXRpY1N5bWJvbHxvYmplY3QsIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10pIHtcbiAgICBpZiAoIShmYWN0b3J5IGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSkge1xuICAgICAgKGZhY3RvcnkgYXMgYW55KS5uZ0NvbnRlbnRTZWxlY3RvcnMucHVzaCguLi5uZ0NvbnRlbnRTZWxlY3RvcnMpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2xvYWRTdW1tYXJ5KHR5cGU6IGFueSwga2luZDogY3BsLkNvbXBpbGVTdW1tYXJ5S2luZCk6IGNwbC5Db21waWxlVHlwZVN1bW1hcnl8bnVsbCB7XG4gICAgbGV0IHR5cGVTdW1tYXJ5ID0gdGhpcy5fc3VtbWFyeUNhY2hlLmdldCh0eXBlKTtcbiAgICBpZiAoIXR5cGVTdW1tYXJ5KSB7XG4gICAgICBjb25zdCBzdW1tYXJ5ID0gdGhpcy5fc3VtbWFyeVJlc29sdmVyLnJlc29sdmVTdW1tYXJ5KHR5cGUpO1xuICAgICAgdHlwZVN1bW1hcnkgPSBzdW1tYXJ5ID8gc3VtbWFyeS50eXBlIDogbnVsbDtcbiAgICAgIHRoaXMuX3N1bW1hcnlDYWNoZS5zZXQodHlwZSwgdHlwZVN1bW1hcnkgfHwgbnVsbCk7XG4gICAgfVxuICAgIHJldHVybiB0eXBlU3VtbWFyeSAmJiB0eXBlU3VtbWFyeS5zdW1tYXJ5S2luZCA9PT0ga2luZCA/IHR5cGVTdW1tYXJ5IDogbnVsbDtcbiAgfVxuXG4gIGdldEhvc3RDb21wb25lbnRNZXRhZGF0YShcbiAgICAgIGNvbXBNZXRhOiBjcGwuQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLFxuICAgICAgaG9zdFZpZXdUeXBlPzogU3RhdGljU3ltYm9sfGNwbC5Qcm94eUNsYXNzKTogY3BsLkNvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSB7XG4gICAgY29uc3QgaG9zdFR5cGUgPSB0aGlzLmdldEhvc3RDb21wb25lbnRUeXBlKGNvbXBNZXRhLnR5cGUucmVmZXJlbmNlKTtcbiAgICBpZiAoIWhvc3RWaWV3VHlwZSkge1xuICAgICAgaG9zdFZpZXdUeXBlID0gdGhpcy5nZXRIb3N0Q29tcG9uZW50Vmlld0NsYXNzKGhvc3RUeXBlKTtcbiAgICB9XG4gICAgLy8gTm90ZTogISBpcyBvayBoZXJlIGFzIHRoaXMgbWV0aG9kIHNob3VsZCBvbmx5IGJlIGNhbGxlZCB3aXRoIG5vcm1hbGl6ZWQgZGlyZWN0aXZlXG4gICAgLy8gbWV0YWRhdGEsIHdoaWNoIGFsd2F5cyBmaWxscyBpbiB0aGUgc2VsZWN0b3IuXG4gICAgY29uc3QgdGVtcGxhdGUgPSBDc3NTZWxlY3Rvci5wYXJzZShjb21wTWV0YS5zZWxlY3RvciEpWzBdLmdldE1hdGNoaW5nRWxlbWVudFRlbXBsYXRlKCk7XG4gICAgY29uc3QgdGVtcGxhdGVVcmwgPSAnJztcbiAgICBjb25zdCBodG1sQXN0ID0gdGhpcy5faHRtbFBhcnNlci5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwpO1xuICAgIHJldHVybiBjcGwuQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLmNyZWF0ZSh7XG4gICAgICBpc0hvc3Q6IHRydWUsXG4gICAgICB0eXBlOiB7cmVmZXJlbmNlOiBob3N0VHlwZSwgZGlEZXBzOiBbXSwgbGlmZWN5Y2xlSG9va3M6IFtdfSxcbiAgICAgIHRlbXBsYXRlOiBuZXcgY3BsLkNvbXBpbGVUZW1wbGF0ZU1ldGFkYXRhKHtcbiAgICAgICAgZW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb24uTm9uZSxcbiAgICAgICAgdGVtcGxhdGUsXG4gICAgICAgIHRlbXBsYXRlVXJsLFxuICAgICAgICBodG1sQXN0LFxuICAgICAgICBzdHlsZXM6IFtdLFxuICAgICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdLFxuICAgICAgICBhbmltYXRpb25zOiBbXSxcbiAgICAgICAgaXNJbmxpbmU6IHRydWUsXG4gICAgICAgIGV4dGVybmFsU3R5bGVzaGVldHM6IFtdLFxuICAgICAgICBpbnRlcnBvbGF0aW9uOiBudWxsLFxuICAgICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBmYWxzZSxcbiAgICAgIH0pLFxuICAgICAgZXhwb3J0QXM6IG51bGwsXG4gICAgICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHQsXG4gICAgICBpbnB1dHM6IFtdLFxuICAgICAgb3V0cHV0czogW10sXG4gICAgICBob3N0OiB7fSxcbiAgICAgIGlzQ29tcG9uZW50OiB0cnVlLFxuICAgICAgc2VsZWN0b3I6ICcqJyxcbiAgICAgIHByb3ZpZGVyczogW10sXG4gICAgICB2aWV3UHJvdmlkZXJzOiBbXSxcbiAgICAgIHF1ZXJpZXM6IFtdLFxuICAgICAgZ3VhcmRzOiB7fSxcbiAgICAgIHZpZXdRdWVyaWVzOiBbXSxcbiAgICAgIGNvbXBvbmVudFZpZXdUeXBlOiBob3N0Vmlld1R5cGUsXG4gICAgICByZW5kZXJlclR5cGU6IHtpZDogJ19fSG9zdF9fJywgZW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb24uTm9uZSwgc3R5bGVzOiBbXSwgZGF0YToge319IGFzXG4gICAgICAgICAgb2JqZWN0LFxuICAgICAgZW50cnlDb21wb25lbnRzOiBbXSxcbiAgICAgIGNvbXBvbmVudEZhY3Rvcnk6IG51bGxcbiAgICB9KTtcbiAgfVxuXG4gIGxvYWREaXJlY3RpdmVNZXRhZGF0YShuZ01vZHVsZVR5cGU6IGFueSwgZGlyZWN0aXZlVHlwZTogYW55LCBpc1N5bmM6IGJvb2xlYW4pOiBTeW5jQXN5bmM8bnVsbD4ge1xuICAgIGlmICh0aGlzLl9kaXJlY3RpdmVDYWNoZS5oYXMoZGlyZWN0aXZlVHlwZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBkaXJlY3RpdmVUeXBlID0gcmVzb2x2ZUZvcndhcmRSZWYoZGlyZWN0aXZlVHlwZSk7XG4gICAgY29uc3Qge2Fubm90YXRpb24sIG1ldGFkYXRhfSA9IHRoaXMuZ2V0Tm9uTm9ybWFsaXplZERpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGUpITtcblxuICAgIGNvbnN0IGNyZWF0ZURpcmVjdGl2ZU1ldGFkYXRhID0gKHRlbXBsYXRlTWV0YWRhdGE6IGNwbC5Db21waWxlVGVtcGxhdGVNZXRhZGF0YXxudWxsKSA9PiB7XG4gICAgICBjb25zdCBub3JtYWxpemVkRGlyTWV0YSA9IG5ldyBjcGwuQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKHtcbiAgICAgICAgaXNIb3N0OiBmYWxzZSxcbiAgICAgICAgdHlwZTogbWV0YWRhdGEudHlwZSxcbiAgICAgICAgaXNDb21wb25lbnQ6IG1ldGFkYXRhLmlzQ29tcG9uZW50LFxuICAgICAgICBzZWxlY3RvcjogbWV0YWRhdGEuc2VsZWN0b3IsXG4gICAgICAgIGV4cG9ydEFzOiBtZXRhZGF0YS5leHBvcnRBcyxcbiAgICAgICAgY2hhbmdlRGV0ZWN0aW9uOiBtZXRhZGF0YS5jaGFuZ2VEZXRlY3Rpb24sXG4gICAgICAgIGlucHV0czogbWV0YWRhdGEuaW5wdXRzLFxuICAgICAgICBvdXRwdXRzOiBtZXRhZGF0YS5vdXRwdXRzLFxuICAgICAgICBob3N0TGlzdGVuZXJzOiBtZXRhZGF0YS5ob3N0TGlzdGVuZXJzLFxuICAgICAgICBob3N0UHJvcGVydGllczogbWV0YWRhdGEuaG9zdFByb3BlcnRpZXMsXG4gICAgICAgIGhvc3RBdHRyaWJ1dGVzOiBtZXRhZGF0YS5ob3N0QXR0cmlidXRlcyxcbiAgICAgICAgcHJvdmlkZXJzOiBtZXRhZGF0YS5wcm92aWRlcnMsXG4gICAgICAgIHZpZXdQcm92aWRlcnM6IG1ldGFkYXRhLnZpZXdQcm92aWRlcnMsXG4gICAgICAgIHF1ZXJpZXM6IG1ldGFkYXRhLnF1ZXJpZXMsXG4gICAgICAgIGd1YXJkczogbWV0YWRhdGEuZ3VhcmRzLFxuICAgICAgICB2aWV3UXVlcmllczogbWV0YWRhdGEudmlld1F1ZXJpZXMsXG4gICAgICAgIGVudHJ5Q29tcG9uZW50czogbWV0YWRhdGEuZW50cnlDb21wb25lbnRzLFxuICAgICAgICBjb21wb25lbnRWaWV3VHlwZTogbWV0YWRhdGEuY29tcG9uZW50Vmlld1R5cGUsXG4gICAgICAgIHJlbmRlcmVyVHlwZTogbWV0YWRhdGEucmVuZGVyZXJUeXBlLFxuICAgICAgICBjb21wb25lbnRGYWN0b3J5OiBtZXRhZGF0YS5jb21wb25lbnRGYWN0b3J5LFxuICAgICAgICB0ZW1wbGF0ZTogdGVtcGxhdGVNZXRhZGF0YVxuICAgICAgfSk7XG4gICAgICBpZiAodGVtcGxhdGVNZXRhZGF0YSkge1xuICAgICAgICB0aGlzLmluaXRDb21wb25lbnRGYWN0b3J5KG1ldGFkYXRhLmNvbXBvbmVudEZhY3RvcnkhLCB0ZW1wbGF0ZU1ldGFkYXRhLm5nQ29udGVudFNlbGVjdG9ycyk7XG4gICAgICB9XG4gICAgICB0aGlzLl9kaXJlY3RpdmVDYWNoZS5zZXQoZGlyZWN0aXZlVHlwZSwgbm9ybWFsaXplZERpck1ldGEpO1xuICAgICAgdGhpcy5fc3VtbWFyeUNhY2hlLnNldChkaXJlY3RpdmVUeXBlLCBub3JtYWxpemVkRGlyTWV0YS50b1N1bW1hcnkoKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9O1xuXG4gICAgaWYgKG1ldGFkYXRhLmlzQ29tcG9uZW50KSB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGFkYXRhLnRlbXBsYXRlICE7XG4gICAgICBjb25zdCB0ZW1wbGF0ZU1ldGEgPSB0aGlzLl9kaXJlY3RpdmVOb3JtYWxpemVyLm5vcm1hbGl6ZVRlbXBsYXRlKHtcbiAgICAgICAgbmdNb2R1bGVUeXBlLFxuICAgICAgICBjb21wb25lbnRUeXBlOiBkaXJlY3RpdmVUeXBlLFxuICAgICAgICBtb2R1bGVVcmw6IHRoaXMuX3JlZmxlY3Rvci5jb21wb25lbnRNb2R1bGVVcmwoZGlyZWN0aXZlVHlwZSwgYW5ub3RhdGlvbiksXG4gICAgICAgIGVuY2Fwc3VsYXRpb246IHRlbXBsYXRlLmVuY2Fwc3VsYXRpb24sXG4gICAgICAgIHRlbXBsYXRlOiB0ZW1wbGF0ZS50ZW1wbGF0ZSxcbiAgICAgICAgdGVtcGxhdGVVcmw6IHRlbXBsYXRlLnRlbXBsYXRlVXJsLFxuICAgICAgICBzdHlsZXM6IHRlbXBsYXRlLnN0eWxlcyxcbiAgICAgICAgc3R5bGVVcmxzOiB0ZW1wbGF0ZS5zdHlsZVVybHMsXG4gICAgICAgIGFuaW1hdGlvbnM6IHRlbXBsYXRlLmFuaW1hdGlvbnMsXG4gICAgICAgIGludGVycG9sYXRpb246IHRlbXBsYXRlLmludGVycG9sYXRpb24sXG4gICAgICAgIHByZXNlcnZlV2hpdGVzcGFjZXM6IHRlbXBsYXRlLnByZXNlcnZlV2hpdGVzcGFjZXNcbiAgICAgIH0pO1xuICAgICAgaWYgKGlzUHJvbWlzZSh0ZW1wbGF0ZU1ldGEpICYmIGlzU3luYykge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihjb21wb25lbnRTdGlsbExvYWRpbmdFcnJvcihkaXJlY3RpdmVUeXBlKSwgZGlyZWN0aXZlVHlwZSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFN5bmNBc3luYy50aGVuKHRlbXBsYXRlTWV0YSwgY3JlYXRlRGlyZWN0aXZlTWV0YWRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBkaXJlY3RpdmVcbiAgICAgIGNyZWF0ZURpcmVjdGl2ZU1ldGFkYXRhKG51bGwpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgZ2V0Tm9uTm9ybWFsaXplZERpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGU6IGFueSk6XG4gICAgICB7YW5ub3RhdGlvbjogRGlyZWN0aXZlLCBtZXRhZGF0YTogY3BsLkNvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YX18bnVsbCB7XG4gICAgZGlyZWN0aXZlVHlwZSA9IHJlc29sdmVGb3J3YXJkUmVmKGRpcmVjdGl2ZVR5cGUpO1xuICAgIGlmICghZGlyZWN0aXZlVHlwZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGxldCBjYWNoZUVudHJ5ID0gdGhpcy5fbm9uTm9ybWFsaXplZERpcmVjdGl2ZUNhY2hlLmdldChkaXJlY3RpdmVUeXBlKTtcbiAgICBpZiAoY2FjaGVFbnRyeSkge1xuICAgICAgcmV0dXJuIGNhY2hlRW50cnk7XG4gICAgfVxuICAgIGNvbnN0IGRpck1ldGEgPSB0aGlzLl9kaXJlY3RpdmVSZXNvbHZlci5yZXNvbHZlKGRpcmVjdGl2ZVR5cGUsIGZhbHNlKTtcbiAgICBpZiAoIWRpck1ldGEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBsZXQgbm9uTm9ybWFsaXplZFRlbXBsYXRlTWV0YWRhdGE6IGNwbC5Db21waWxlVGVtcGxhdGVNZXRhZGF0YSA9IHVuZGVmaW5lZCE7XG5cbiAgICBpZiAoY3JlYXRlQ29tcG9uZW50LmlzVHlwZU9mKGRpck1ldGEpKSB7XG4gICAgICAvLyBjb21wb25lbnRcbiAgICAgIGNvbnN0IGNvbXBNZXRhID0gZGlyTWV0YSBhcyBDb21wb25lbnQ7XG4gICAgICBhc3NlcnRBcnJheU9mU3RyaW5ncygnc3R5bGVzJywgY29tcE1ldGEuc3R5bGVzKTtcbiAgICAgIGFzc2VydEFycmF5T2ZTdHJpbmdzKCdzdHlsZVVybHMnLCBjb21wTWV0YS5zdHlsZVVybHMpO1xuICAgICAgYXNzZXJ0SW50ZXJwb2xhdGlvblN5bWJvbHMoJ2ludGVycG9sYXRpb24nLCBjb21wTWV0YS5pbnRlcnBvbGF0aW9uKTtcblxuICAgICAgY29uc3QgYW5pbWF0aW9ucyA9IGNvbXBNZXRhLmFuaW1hdGlvbnM7XG5cbiAgICAgIG5vbk5vcm1hbGl6ZWRUZW1wbGF0ZU1ldGFkYXRhID0gbmV3IGNwbC5Db21waWxlVGVtcGxhdGVNZXRhZGF0YSh7XG4gICAgICAgIGVuY2Fwc3VsYXRpb246IG5vVW5kZWZpbmVkKGNvbXBNZXRhLmVuY2Fwc3VsYXRpb24pLFxuICAgICAgICB0ZW1wbGF0ZTogbm9VbmRlZmluZWQoY29tcE1ldGEudGVtcGxhdGUpLFxuICAgICAgICB0ZW1wbGF0ZVVybDogbm9VbmRlZmluZWQoY29tcE1ldGEudGVtcGxhdGVVcmwpLFxuICAgICAgICBodG1sQXN0OiBudWxsLFxuICAgICAgICBzdHlsZXM6IGNvbXBNZXRhLnN0eWxlcyB8fCBbXSxcbiAgICAgICAgc3R5bGVVcmxzOiBjb21wTWV0YS5zdHlsZVVybHMgfHwgW10sXG4gICAgICAgIGFuaW1hdGlvbnM6IGFuaW1hdGlvbnMgfHwgW10sXG4gICAgICAgIGludGVycG9sYXRpb246IG5vVW5kZWZpbmVkKGNvbXBNZXRhLmludGVycG9sYXRpb24pLFxuICAgICAgICBpc0lubGluZTogISFjb21wTWV0YS50ZW1wbGF0ZSxcbiAgICAgICAgZXh0ZXJuYWxTdHlsZXNoZWV0czogW10sXG4gICAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW10sXG4gICAgICAgIHByZXNlcnZlV2hpdGVzcGFjZXM6IG5vVW5kZWZpbmVkKGRpck1ldGEucHJlc2VydmVXaGl0ZXNwYWNlcyksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBsZXQgY2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3k6IENoYW5nZURldGVjdGlvblN0cmF0ZWd5ID0gbnVsbCE7XG4gICAgbGV0IHZpZXdQcm92aWRlcnM6IGNwbC5Db21waWxlUHJvdmlkZXJNZXRhZGF0YVtdID0gW107XG4gICAgbGV0IGVudHJ5Q29tcG9uZW50TWV0YWRhdGE6IGNwbC5Db21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdID0gW107XG4gICAgbGV0IHNlbGVjdG9yID0gZGlyTWV0YS5zZWxlY3RvcjtcblxuICAgIGlmIChjcmVhdGVDb21wb25lbnQuaXNUeXBlT2YoZGlyTWV0YSkpIHtcbiAgICAgIC8vIENvbXBvbmVudFxuICAgICAgY29uc3QgY29tcE1ldGEgPSBkaXJNZXRhIGFzIENvbXBvbmVudDtcbiAgICAgIGNoYW5nZURldGVjdGlvblN0cmF0ZWd5ID0gY29tcE1ldGEuY2hhbmdlRGV0ZWN0aW9uITtcbiAgICAgIGlmIChjb21wTWV0YS52aWV3UHJvdmlkZXJzKSB7XG4gICAgICAgIHZpZXdQcm92aWRlcnMgPSB0aGlzLl9nZXRQcm92aWRlcnNNZXRhZGF0YShcbiAgICAgICAgICAgIGNvbXBNZXRhLnZpZXdQcm92aWRlcnMsIGVudHJ5Q29tcG9uZW50TWV0YWRhdGEsXG4gICAgICAgICAgICBgdmlld1Byb3ZpZGVycyBmb3IgXCIke3N0cmluZ2lmeVR5cGUoZGlyZWN0aXZlVHlwZSl9XCJgLCBbXSwgZGlyZWN0aXZlVHlwZSk7XG4gICAgICB9XG4gICAgICBpZiAoY29tcE1ldGEuZW50cnlDb21wb25lbnRzKSB7XG4gICAgICAgIGVudHJ5Q29tcG9uZW50TWV0YWRhdGEgPSBmbGF0dGVuQW5kRGVkdXBlQXJyYXkoY29tcE1ldGEuZW50cnlDb21wb25lbnRzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKHR5cGUpID0+IHRoaXMuX2dldEVudHJ5Q29tcG9uZW50TWV0YWRhdGEodHlwZSkhKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jb25jYXQoZW50cnlDb21wb25lbnRNZXRhZGF0YSk7XG4gICAgICB9XG4gICAgICBpZiAoIXNlbGVjdG9yKSB7XG4gICAgICAgIHNlbGVjdG9yID0gdGhpcy5fc2NoZW1hUmVnaXN0cnkuZ2V0RGVmYXVsdENvbXBvbmVudEVsZW1lbnROYW1lKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdGl2ZVxuICAgICAgaWYgKCFzZWxlY3Rvcikge1xuICAgICAgICBzZWxlY3RvciA9IG51bGwhO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBwcm92aWRlcnM6IGNwbC5Db21waWxlUHJvdmlkZXJNZXRhZGF0YVtdID0gW107XG4gICAgaWYgKGRpck1ldGEucHJvdmlkZXJzICE9IG51bGwpIHtcbiAgICAgIHByb3ZpZGVycyA9IHRoaXMuX2dldFByb3ZpZGVyc01ldGFkYXRhKFxuICAgICAgICAgIGRpck1ldGEucHJvdmlkZXJzLCBlbnRyeUNvbXBvbmVudE1ldGFkYXRhLFxuICAgICAgICAgIGBwcm92aWRlcnMgZm9yIFwiJHtzdHJpbmdpZnlUeXBlKGRpcmVjdGl2ZVR5cGUpfVwiYCwgW10sIGRpcmVjdGl2ZVR5cGUpO1xuICAgIH1cbiAgICBsZXQgcXVlcmllczogY3BsLkNvbXBpbGVRdWVyeU1ldGFkYXRhW10gPSBbXTtcbiAgICBsZXQgdmlld1F1ZXJpZXM6IGNwbC5Db21waWxlUXVlcnlNZXRhZGF0YVtdID0gW107XG4gICAgaWYgKGRpck1ldGEucXVlcmllcyAhPSBudWxsKSB7XG4gICAgICBxdWVyaWVzID0gdGhpcy5fZ2V0UXVlcmllc01ldGFkYXRhKGRpck1ldGEucXVlcmllcywgZmFsc2UsIGRpcmVjdGl2ZVR5cGUpO1xuICAgICAgdmlld1F1ZXJpZXMgPSB0aGlzLl9nZXRRdWVyaWVzTWV0YWRhdGEoZGlyTWV0YS5xdWVyaWVzLCB0cnVlLCBkaXJlY3RpdmVUeXBlKTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXRhZGF0YSA9IGNwbC5Db21waWxlRGlyZWN0aXZlTWV0YWRhdGEuY3JlYXRlKHtcbiAgICAgIGlzSG9zdDogZmFsc2UsXG4gICAgICBzZWxlY3Rvcjogc2VsZWN0b3IsXG4gICAgICBleHBvcnRBczogbm9VbmRlZmluZWQoZGlyTWV0YS5leHBvcnRBcyksXG4gICAgICBpc0NvbXBvbmVudDogISFub25Ob3JtYWxpemVkVGVtcGxhdGVNZXRhZGF0YSxcbiAgICAgIHR5cGU6IHRoaXMuX2dldFR5cGVNZXRhZGF0YShkaXJlY3RpdmVUeXBlKSxcbiAgICAgIHRlbXBsYXRlOiBub25Ob3JtYWxpemVkVGVtcGxhdGVNZXRhZGF0YSxcbiAgICAgIGNoYW5nZURldGVjdGlvbjogY2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksXG4gICAgICBpbnB1dHM6IGRpck1ldGEuaW5wdXRzIHx8IFtdLFxuICAgICAgb3V0cHV0czogZGlyTWV0YS5vdXRwdXRzIHx8IFtdLFxuICAgICAgaG9zdDogZGlyTWV0YS5ob3N0IHx8IHt9LFxuICAgICAgcHJvdmlkZXJzOiBwcm92aWRlcnMgfHwgW10sXG4gICAgICB2aWV3UHJvdmlkZXJzOiB2aWV3UHJvdmlkZXJzIHx8IFtdLFxuICAgICAgcXVlcmllczogcXVlcmllcyB8fCBbXSxcbiAgICAgIGd1YXJkczogZGlyTWV0YS5ndWFyZHMgfHwge30sXG4gICAgICB2aWV3UXVlcmllczogdmlld1F1ZXJpZXMgfHwgW10sXG4gICAgICBlbnRyeUNvbXBvbmVudHM6IGVudHJ5Q29tcG9uZW50TWV0YWRhdGEsXG4gICAgICBjb21wb25lbnRWaWV3VHlwZTogbm9uTm9ybWFsaXplZFRlbXBsYXRlTWV0YWRhdGEgPyB0aGlzLmdldENvbXBvbmVudFZpZXdDbGFzcyhkaXJlY3RpdmVUeXBlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgcmVuZGVyZXJUeXBlOiBub25Ob3JtYWxpemVkVGVtcGxhdGVNZXRhZGF0YSA/IHRoaXMuZ2V0UmVuZGVyZXJUeXBlKGRpcmVjdGl2ZVR5cGUpIDogbnVsbCxcbiAgICAgIGNvbXBvbmVudEZhY3Rvcnk6IG51bGxcbiAgICB9KTtcbiAgICBpZiAobm9uTm9ybWFsaXplZFRlbXBsYXRlTWV0YWRhdGEpIHtcbiAgICAgIG1ldGFkYXRhLmNvbXBvbmVudEZhY3RvcnkgPVxuICAgICAgICAgIHRoaXMuZ2V0Q29tcG9uZW50RmFjdG9yeShzZWxlY3RvciwgZGlyZWN0aXZlVHlwZSwgbWV0YWRhdGEuaW5wdXRzLCBtZXRhZGF0YS5vdXRwdXRzKTtcbiAgICB9XG4gICAgY2FjaGVFbnRyeSA9IHttZXRhZGF0YSwgYW5ub3RhdGlvbjogZGlyTWV0YX07XG4gICAgdGhpcy5fbm9uTm9ybWFsaXplZERpcmVjdGl2ZUNhY2hlLnNldChkaXJlY3RpdmVUeXBlLCBjYWNoZUVudHJ5KTtcbiAgICByZXR1cm4gY2FjaGVFbnRyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBtZXRhZGF0YSBmb3IgdGhlIGdpdmVuIGRpcmVjdGl2ZS5cbiAgICogVGhpcyBhc3N1bWVzIGBsb2FkTmdNb2R1bGVEaXJlY3RpdmVBbmRQaXBlTWV0YWRhdGFgIGhhcyBiZWVuIGNhbGxlZCBmaXJzdC5cbiAgICovXG4gIGdldERpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGU6IGFueSk6IGNwbC5Db21waWxlRGlyZWN0aXZlTWV0YWRhdGEge1xuICAgIGNvbnN0IGRpck1ldGEgPSB0aGlzLl9kaXJlY3RpdmVDYWNoZS5nZXQoZGlyZWN0aXZlVHlwZSkhO1xuICAgIGlmICghZGlyTWV0YSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBnZXREaXJlY3RpdmVNZXRhZGF0YSBjYW4gb25seSBiZSBjYWxsZWQgYWZ0ZXIgbG9hZE5nTW9kdWxlRGlyZWN0aXZlQW5kUGlwZU1ldGFkYXRhIGZvciBhIG1vZHVsZSB0aGF0IGRlY2xhcmVzIGl0LiBEaXJlY3RpdmUgJHtcbiAgICAgICAgICAgICAgICAgIHN0cmluZ2lmeVR5cGUoZGlyZWN0aXZlVHlwZSl9LmApLFxuICAgICAgICAgIGRpcmVjdGl2ZVR5cGUpO1xuICAgIH1cbiAgICByZXR1cm4gZGlyTWV0YTtcbiAgfVxuXG4gIGdldERpcmVjdGl2ZVN1bW1hcnkoZGlyVHlwZTogYW55KTogY3BsLkNvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5IHtcbiAgICBjb25zdCBkaXJTdW1tYXJ5ID1cbiAgICAgICAgPGNwbC5Db21waWxlRGlyZWN0aXZlU3VtbWFyeT50aGlzLl9sb2FkU3VtbWFyeShkaXJUeXBlLCBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLkRpcmVjdGl2ZSk7XG4gICAgaWYgKCFkaXJTdW1tYXJ5KSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBzeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgYElsbGVnYWwgc3RhdGU6IENvdWxkIG5vdCBsb2FkIHRoZSBzdW1tYXJ5IGZvciBkaXJlY3RpdmUgJHtzdHJpbmdpZnlUeXBlKGRpclR5cGUpfS5gKSxcbiAgICAgICAgICBkaXJUeXBlKTtcbiAgICB9XG4gICAgcmV0dXJuIGRpclN1bW1hcnk7XG4gIH1cblxuICBpc0RpcmVjdGl2ZSh0eXBlOiBhbnkpIHtcbiAgICByZXR1cm4gISF0aGlzLl9sb2FkU3VtbWFyeSh0eXBlLCBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLkRpcmVjdGl2ZSkgfHxcbiAgICAgICAgdGhpcy5fZGlyZWN0aXZlUmVzb2x2ZXIuaXNEaXJlY3RpdmUodHlwZSk7XG4gIH1cblxuICBpc0Fic3RyYWN0RGlyZWN0aXZlKHR5cGU6IGFueSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHN1bW1hcnkgPVxuICAgICAgICB0aGlzLl9sb2FkU3VtbWFyeSh0eXBlLCBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLkRpcmVjdGl2ZSkgYXMgY3BsLkNvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAgIGlmIChzdW1tYXJ5ICYmICFzdW1tYXJ5LmlzQ29tcG9uZW50KSB7XG4gICAgICByZXR1cm4gIXN1bW1hcnkuc2VsZWN0b3I7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YSA9IHRoaXMuX2RpcmVjdGl2ZVJlc29sdmVyLnJlc29sdmUodHlwZSwgZmFsc2UpO1xuICAgIGlmIChtZXRhICYmICFjcmVhdGVDb21wb25lbnQuaXNUeXBlT2YobWV0YSkpIHtcbiAgICAgIHJldHVybiAhbWV0YS5zZWxlY3RvcjtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpc1BpcGUodHlwZTogYW55KSB7XG4gICAgcmV0dXJuICEhdGhpcy5fbG9hZFN1bW1hcnkodHlwZSwgY3BsLkNvbXBpbGVTdW1tYXJ5S2luZC5QaXBlKSB8fFxuICAgICAgICB0aGlzLl9waXBlUmVzb2x2ZXIuaXNQaXBlKHR5cGUpO1xuICB9XG5cbiAgaXNOZ01vZHVsZSh0eXBlOiBhbnkpIHtcbiAgICByZXR1cm4gISF0aGlzLl9sb2FkU3VtbWFyeSh0eXBlLCBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLk5nTW9kdWxlKSB8fFxuICAgICAgICB0aGlzLl9uZ01vZHVsZVJlc29sdmVyLmlzTmdNb2R1bGUodHlwZSk7XG4gIH1cblxuICBnZXROZ01vZHVsZVN1bW1hcnkobW9kdWxlVHlwZTogYW55LCBhbHJlYWR5Q29sbGVjdGluZzogU2V0PGFueT58bnVsbCA9IG51bGwpOlxuICAgICAgY3BsLkNvbXBpbGVOZ01vZHVsZVN1bW1hcnl8bnVsbCB7XG4gICAgbGV0IG1vZHVsZVN1bW1hcnk6IGNwbC5Db21waWxlTmdNb2R1bGVTdW1tYXJ5fG51bGwgPVxuICAgICAgICA8Y3BsLkNvbXBpbGVOZ01vZHVsZVN1bW1hcnk+dGhpcy5fbG9hZFN1bW1hcnkobW9kdWxlVHlwZSwgY3BsLkNvbXBpbGVTdW1tYXJ5S2luZC5OZ01vZHVsZSk7XG4gICAgaWYgKCFtb2R1bGVTdW1tYXJ5KSB7XG4gICAgICBjb25zdCBtb2R1bGVNZXRhID0gdGhpcy5nZXROZ01vZHVsZU1ldGFkYXRhKG1vZHVsZVR5cGUsIGZhbHNlLCBhbHJlYWR5Q29sbGVjdGluZyk7XG4gICAgICBtb2R1bGVTdW1tYXJ5ID0gbW9kdWxlTWV0YSA/IG1vZHVsZU1ldGEudG9TdW1tYXJ5KCkgOiBudWxsO1xuICAgICAgaWYgKG1vZHVsZVN1bW1hcnkpIHtcbiAgICAgICAgdGhpcy5fc3VtbWFyeUNhY2hlLnNldChtb2R1bGVUeXBlLCBtb2R1bGVTdW1tYXJ5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1vZHVsZVN1bW1hcnk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZHMgdGhlIGRlY2xhcmVkIGRpcmVjdGl2ZXMgYW5kIHBpcGVzIG9mIGFuIE5nTW9kdWxlLlxuICAgKi9cbiAgbG9hZE5nTW9kdWxlRGlyZWN0aXZlQW5kUGlwZU1ldGFkYXRhKG1vZHVsZVR5cGU6IGFueSwgaXNTeW5jOiBib29sZWFuLCB0aHJvd0lmTm90Rm91bmQgPSB0cnVlKTpcbiAgICAgIFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgbmdNb2R1bGUgPSB0aGlzLmdldE5nTW9kdWxlTWV0YWRhdGEobW9kdWxlVHlwZSwgdGhyb3dJZk5vdEZvdW5kKTtcbiAgICBjb25zdCBsb2FkaW5nOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuICAgIGlmIChuZ01vZHVsZSkge1xuICAgICAgbmdNb2R1bGUuZGVjbGFyZWREaXJlY3RpdmVzLmZvckVhY2goKGlkKSA9PiB7XG4gICAgICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmxvYWREaXJlY3RpdmVNZXRhZGF0YShtb2R1bGVUeXBlLCBpZC5yZWZlcmVuY2UsIGlzU3luYyk7XG4gICAgICAgIGlmIChwcm9taXNlKSB7XG4gICAgICAgICAgbG9hZGluZy5wdXNoKHByb21pc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIG5nTW9kdWxlLmRlY2xhcmVkUGlwZXMuZm9yRWFjaCgoaWQpID0+IHRoaXMuX2xvYWRQaXBlTWV0YWRhdGEoaWQucmVmZXJlbmNlKSk7XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLmFsbChsb2FkaW5nKTtcbiAgfVxuXG4gIGdldFNoYWxsb3dNb2R1bGVNZXRhZGF0YShtb2R1bGVUeXBlOiBhbnkpOiBjcGwuQ29tcGlsZVNoYWxsb3dNb2R1bGVNZXRhZGF0YXxudWxsIHtcbiAgICBsZXQgY29tcGlsZU1ldGEgPSB0aGlzLl9zaGFsbG93TW9kdWxlQ2FjaGUuZ2V0KG1vZHVsZVR5cGUpO1xuICAgIGlmIChjb21waWxlTWV0YSkge1xuICAgICAgcmV0dXJuIGNvbXBpbGVNZXRhO1xuICAgIH1cblxuICAgIGNvbnN0IG5nTW9kdWxlTWV0YSA9XG4gICAgICAgIGZpbmRMYXN0KHRoaXMuX3JlZmxlY3Rvci5zaGFsbG93QW5ub3RhdGlvbnMobW9kdWxlVHlwZSksIGNyZWF0ZU5nTW9kdWxlLmlzVHlwZU9mKTtcblxuICAgIGNvbXBpbGVNZXRhID0ge1xuICAgICAgdHlwZTogdGhpcy5fZ2V0VHlwZU1ldGFkYXRhKG1vZHVsZVR5cGUpLFxuICAgICAgcmF3RXhwb3J0czogbmdNb2R1bGVNZXRhLmV4cG9ydHMsXG4gICAgICByYXdJbXBvcnRzOiBuZ01vZHVsZU1ldGEuaW1wb3J0cyxcbiAgICAgIHJhd1Byb3ZpZGVyczogbmdNb2R1bGVNZXRhLnByb3ZpZGVycyxcbiAgICB9O1xuXG4gICAgdGhpcy5fc2hhbGxvd01vZHVsZUNhY2hlLnNldChtb2R1bGVUeXBlLCBjb21waWxlTWV0YSk7XG4gICAgcmV0dXJuIGNvbXBpbGVNZXRhO1xuICB9XG5cbiAgZ2V0TmdNb2R1bGVNZXRhZGF0YShcbiAgICAgIG1vZHVsZVR5cGU6IGFueSwgdGhyb3dJZk5vdEZvdW5kID0gdHJ1ZSxcbiAgICAgIGFscmVhZHlDb2xsZWN0aW5nOiBTZXQ8YW55PnxudWxsID0gbnVsbCk6IGNwbC5Db21waWxlTmdNb2R1bGVNZXRhZGF0YXxudWxsIHtcbiAgICBtb2R1bGVUeXBlID0gcmVzb2x2ZUZvcndhcmRSZWYobW9kdWxlVHlwZSk7XG4gICAgbGV0IGNvbXBpbGVNZXRhID0gdGhpcy5fbmdNb2R1bGVDYWNoZS5nZXQobW9kdWxlVHlwZSk7XG4gICAgaWYgKGNvbXBpbGVNZXRhKSB7XG4gICAgICByZXR1cm4gY29tcGlsZU1ldGE7XG4gICAgfVxuICAgIGNvbnN0IG1ldGEgPSB0aGlzLl9uZ01vZHVsZVJlc29sdmVyLnJlc29sdmUobW9kdWxlVHlwZSwgdGhyb3dJZk5vdEZvdW5kKTtcbiAgICBpZiAoIW1ldGEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBkZWNsYXJlZERpcmVjdGl2ZXM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10gPSBbXTtcbiAgICBjb25zdCBleHBvcnRlZE5vbk1vZHVsZUlkZW50aWZpZXJzOiBjcGwuQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdID0gW107XG4gICAgY29uc3QgZGVjbGFyZWRQaXBlczogY3BsLkNvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSA9IFtdO1xuICAgIGNvbnN0IGltcG9ydGVkTW9kdWxlczogY3BsLkNvbXBpbGVOZ01vZHVsZVN1bW1hcnlbXSA9IFtdO1xuICAgIGNvbnN0IGV4cG9ydGVkTW9kdWxlczogY3BsLkNvbXBpbGVOZ01vZHVsZVN1bW1hcnlbXSA9IFtdO1xuICAgIGNvbnN0IHByb3ZpZGVyczogY3BsLkNvbXBpbGVQcm92aWRlck1ldGFkYXRhW10gPSBbXTtcbiAgICBjb25zdCBlbnRyeUNvbXBvbmVudHM6IGNwbC5Db21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdID0gW107XG4gICAgY29uc3QgYm9vdHN0cmFwQ29tcG9uZW50czogY3BsLkNvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSA9IFtdO1xuICAgIGNvbnN0IHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10gPSBbXTtcblxuICAgIGlmIChtZXRhLmltcG9ydHMpIHtcbiAgICAgIGZsYXR0ZW5BbmREZWR1cGVBcnJheShtZXRhLmltcG9ydHMpLmZvckVhY2goKGltcG9ydGVkVHlwZSkgPT4ge1xuICAgICAgICBsZXQgaW1wb3J0ZWRNb2R1bGVUeXBlOiBUeXBlID0gdW5kZWZpbmVkITtcbiAgICAgICAgaWYgKGlzVmFsaWRUeXBlKGltcG9ydGVkVHlwZSkpIHtcbiAgICAgICAgICBpbXBvcnRlZE1vZHVsZVR5cGUgPSBpbXBvcnRlZFR5cGU7XG4gICAgICAgIH0gZWxzZSBpZiAoaW1wb3J0ZWRUeXBlICYmIGltcG9ydGVkVHlwZS5uZ01vZHVsZSkge1xuICAgICAgICAgIGNvbnN0IG1vZHVsZVdpdGhQcm92aWRlcnM6IE1vZHVsZVdpdGhQcm92aWRlcnMgPSBpbXBvcnRlZFR5cGU7XG4gICAgICAgICAgaW1wb3J0ZWRNb2R1bGVUeXBlID0gbW9kdWxlV2l0aFByb3ZpZGVycy5uZ01vZHVsZTtcbiAgICAgICAgICBpZiAobW9kdWxlV2l0aFByb3ZpZGVycy5wcm92aWRlcnMpIHtcbiAgICAgICAgICAgIHByb3ZpZGVycy5wdXNoKC4uLnRoaXMuX2dldFByb3ZpZGVyc01ldGFkYXRhKFxuICAgICAgICAgICAgICAgIG1vZHVsZVdpdGhQcm92aWRlcnMucHJvdmlkZXJzLCBlbnRyeUNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgYHByb3ZpZGVyIGZvciB0aGUgTmdNb2R1bGUgJyR7c3RyaW5naWZ5VHlwZShpbXBvcnRlZE1vZHVsZVR5cGUpfSdgLCBbXSxcbiAgICAgICAgICAgICAgICBpbXBvcnRlZFR5cGUpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW1wb3J0ZWRNb2R1bGVUeXBlKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX2NoZWNrU2VsZkltcG9ydChtb2R1bGVUeXBlLCBpbXBvcnRlZE1vZHVsZVR5cGUpKSByZXR1cm47XG4gICAgICAgICAgaWYgKCFhbHJlYWR5Q29sbGVjdGluZykgYWxyZWFkeUNvbGxlY3RpbmcgPSBuZXcgU2V0KCk7XG4gICAgICAgICAgaWYgKGFscmVhZHlDb2xsZWN0aW5nLmhhcyhpbXBvcnRlZE1vZHVsZVR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgICBzeW50YXhFcnJvcihgJHt0aGlzLl9nZXRUeXBlRGVzY3JpcHRvcihpbXBvcnRlZE1vZHVsZVR5cGUpfSAnJHtcbiAgICAgICAgICAgICAgICAgICAgc3RyaW5naWZ5VHlwZShpbXBvcnRlZFR5cGUpfScgaXMgaW1wb3J0ZWQgcmVjdXJzaXZlbHkgYnkgdGhlIG1vZHVsZSAnJHtcbiAgICAgICAgICAgICAgICAgICAgc3RyaW5naWZ5VHlwZShtb2R1bGVUeXBlKX0nLmApLFxuICAgICAgICAgICAgICAgIG1vZHVsZVR5cGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhbHJlYWR5Q29sbGVjdGluZy5hZGQoaW1wb3J0ZWRNb2R1bGVUeXBlKTtcbiAgICAgICAgICBjb25zdCBpbXBvcnRlZE1vZHVsZVN1bW1hcnkgPVxuICAgICAgICAgICAgICB0aGlzLmdldE5nTW9kdWxlU3VtbWFyeShpbXBvcnRlZE1vZHVsZVR5cGUsIGFscmVhZHlDb2xsZWN0aW5nKTtcbiAgICAgICAgICBhbHJlYWR5Q29sbGVjdGluZy5kZWxldGUoaW1wb3J0ZWRNb2R1bGVUeXBlKTtcbiAgICAgICAgICBpZiAoIWltcG9ydGVkTW9kdWxlU3VtbWFyeSkge1xuICAgICAgICAgICAgY29uc3QgZXJyID0gc3ludGF4RXJyb3IoYFVuZXhwZWN0ZWQgJHt0aGlzLl9nZXRUeXBlRGVzY3JpcHRvcihpbXBvcnRlZFR5cGUpfSAnJHtcbiAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKGltcG9ydGVkVHlwZSl9JyBpbXBvcnRlZCBieSB0aGUgbW9kdWxlICcke1xuICAgICAgICAgICAgICAgIHN0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9Jy4gUGxlYXNlIGFkZCBhIEBOZ01vZHVsZSBhbm5vdGF0aW9uLmApO1xuICAgICAgICAgICAgLy8gSWYgcG9zc2libGUsIHJlY29yZCBhZGRpdGlvbmFsIGNvbnRleHQgZm9yIHRoaXMgZXJyb3IgdG8gZW5hYmxlIG1vcmUgdXNlZnVsXG4gICAgICAgICAgICAvLyBkaWFnbm9zdGljcyBvbiB0aGUgY29tcGlsZXIgc2lkZS5cbiAgICAgICAgICAgIGlmIChpbXBvcnRlZFR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgICAgICAgICAgKGVyciBhcyBhbnkpW01JU1NJTkdfTkdfTU9EVUxFX01FVEFEQVRBX0VSUk9SX0RBVEFdID0ge1xuICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBpbXBvcnRlZFR5cGUuZmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lOiBpbXBvcnRlZFR5cGUubmFtZSxcbiAgICAgICAgICAgICAgfSBhcyBNaXNzaW5nTmdNb2R1bGVNZXRhZGF0YUVycm9yRGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVyciwgbW9kdWxlVHlwZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGltcG9ydGVkTW9kdWxlcy5wdXNoKGltcG9ydGVkTW9kdWxlU3VtbWFyeSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgYFVuZXhwZWN0ZWQgdmFsdWUgJyR7c3RyaW5naWZ5VHlwZShpbXBvcnRlZFR5cGUpfScgaW1wb3J0ZWQgYnkgdGhlIG1vZHVsZSAnJHtcbiAgICAgICAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfSdgKSxcbiAgICAgICAgICAgICAgbW9kdWxlVHlwZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAobWV0YS5leHBvcnRzKSB7XG4gICAgICBmbGF0dGVuQW5kRGVkdXBlQXJyYXkobWV0YS5leHBvcnRzKS5mb3JFYWNoKChleHBvcnRlZFR5cGUpID0+IHtcbiAgICAgICAgaWYgKCFpc1ZhbGlkVHlwZShleHBvcnRlZFR5cGUpKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgYFVuZXhwZWN0ZWQgdmFsdWUgJyR7c3RyaW5naWZ5VHlwZShleHBvcnRlZFR5cGUpfScgZXhwb3J0ZWQgYnkgdGhlIG1vZHVsZSAnJHtcbiAgICAgICAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfSdgKSxcbiAgICAgICAgICAgICAgbW9kdWxlVHlwZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghYWxyZWFkeUNvbGxlY3RpbmcpIGFscmVhZHlDb2xsZWN0aW5nID0gbmV3IFNldCgpO1xuICAgICAgICBpZiAoYWxyZWFkeUNvbGxlY3RpbmcuaGFzKGV4cG9ydGVkVHlwZSkpIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgc3ludGF4RXJyb3IoYCR7dGhpcy5fZ2V0VHlwZURlc2NyaXB0b3IoZXhwb3J0ZWRUeXBlKX0gJyR7XG4gICAgICAgICAgICAgICAgICBzdHJpbmdpZnkoZXhwb3J0ZWRUeXBlKX0nIGlzIGV4cG9ydGVkIHJlY3Vyc2l2ZWx5IGJ5IHRoZSBtb2R1bGUgJyR7XG4gICAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfSdgKSxcbiAgICAgICAgICAgICAgbW9kdWxlVHlwZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGFscmVhZHlDb2xsZWN0aW5nLmFkZChleHBvcnRlZFR5cGUpO1xuICAgICAgICBjb25zdCBleHBvcnRlZE1vZHVsZVN1bW1hcnkgPSB0aGlzLmdldE5nTW9kdWxlU3VtbWFyeShleHBvcnRlZFR5cGUsIGFscmVhZHlDb2xsZWN0aW5nKTtcbiAgICAgICAgYWxyZWFkeUNvbGxlY3RpbmcuZGVsZXRlKGV4cG9ydGVkVHlwZSk7XG4gICAgICAgIGlmIChleHBvcnRlZE1vZHVsZVN1bW1hcnkpIHtcbiAgICAgICAgICBleHBvcnRlZE1vZHVsZXMucHVzaChleHBvcnRlZE1vZHVsZVN1bW1hcnkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4cG9ydGVkTm9uTW9kdWxlSWRlbnRpZmllcnMucHVzaCh0aGlzLl9nZXRJZGVudGlmaWVyTWV0YWRhdGEoZXhwb3J0ZWRUeXBlKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIE5vdGU6IFRoaXMgd2lsbCBiZSBtb2RpZmllZCBsYXRlciwgc28gd2UgcmVseSBvblxuICAgIC8vIGdldHRpbmcgYSBuZXcgaW5zdGFuY2UgZXZlcnkgdGltZSFcbiAgICBjb25zdCB0cmFuc2l0aXZlTW9kdWxlID0gdGhpcy5fZ2V0VHJhbnNpdGl2ZU5nTW9kdWxlTWV0YWRhdGEoaW1wb3J0ZWRNb2R1bGVzLCBleHBvcnRlZE1vZHVsZXMpO1xuICAgIGlmIChtZXRhLmRlY2xhcmF0aW9ucykge1xuICAgICAgZmxhdHRlbkFuZERlZHVwZUFycmF5KG1ldGEuZGVjbGFyYXRpb25zKS5mb3JFYWNoKChkZWNsYXJlZFR5cGUpID0+IHtcbiAgICAgICAgaWYgKCFpc1ZhbGlkVHlwZShkZWNsYXJlZFR5cGUpKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgYFVuZXhwZWN0ZWQgdmFsdWUgJyR7c3RyaW5naWZ5VHlwZShkZWNsYXJlZFR5cGUpfScgZGVjbGFyZWQgYnkgdGhlIG1vZHVsZSAnJHtcbiAgICAgICAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfSdgKSxcbiAgICAgICAgICAgICAgbW9kdWxlVHlwZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlY2xhcmVkSWRlbnRpZmllciA9IHRoaXMuX2dldElkZW50aWZpZXJNZXRhZGF0YShkZWNsYXJlZFR5cGUpO1xuICAgICAgICBpZiAodGhpcy5pc0RpcmVjdGl2ZShkZWNsYXJlZFR5cGUpKSB7XG4gICAgICAgICAgaWYgKHRoaXMuaXNBYnN0cmFjdERpcmVjdGl2ZShkZWNsYXJlZFR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgICBzeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgYERpcmVjdGl2ZSAke3N0cmluZ2lmeVR5cGUoZGVjbGFyZWRUeXBlKX0gaGFzIG5vIHNlbGVjdG9yLCBwbGVhc2UgYWRkIGl0IWApLFxuICAgICAgICAgICAgICAgIGRlY2xhcmVkVHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRyYW5zaXRpdmVNb2R1bGUuYWRkRGlyZWN0aXZlKGRlY2xhcmVkSWRlbnRpZmllcik7XG4gICAgICAgICAgZGVjbGFyZWREaXJlY3RpdmVzLnB1c2goZGVjbGFyZWRJZGVudGlmaWVyKTtcbiAgICAgICAgICB0aGlzLl9hZGRUeXBlVG9Nb2R1bGUoZGVjbGFyZWRUeXBlLCBtb2R1bGVUeXBlKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmlzUGlwZShkZWNsYXJlZFR5cGUpKSB7XG4gICAgICAgICAgdHJhbnNpdGl2ZU1vZHVsZS5hZGRQaXBlKGRlY2xhcmVkSWRlbnRpZmllcik7XG4gICAgICAgICAgdHJhbnNpdGl2ZU1vZHVsZS5waXBlcy5wdXNoKGRlY2xhcmVkSWRlbnRpZmllcik7XG4gICAgICAgICAgZGVjbGFyZWRQaXBlcy5wdXNoKGRlY2xhcmVkSWRlbnRpZmllcik7XG4gICAgICAgICAgdGhpcy5fYWRkVHlwZVRvTW9kdWxlKGRlY2xhcmVkVHlwZSwgbW9kdWxlVHlwZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKGBVbmV4cGVjdGVkICR7dGhpcy5fZ2V0VHlwZURlc2NyaXB0b3IoZGVjbGFyZWRUeXBlKX0gJyR7XG4gICAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKGRlY2xhcmVkVHlwZSl9JyBkZWNsYXJlZCBieSB0aGUgbW9kdWxlICcke1xuICAgICAgICAgICAgICAgICAgc3RyaW5naWZ5VHlwZShcbiAgICAgICAgICAgICAgICAgICAgICBtb2R1bGVUeXBlKX0nLiBQbGVhc2UgYWRkIGEgQFBpcGUvQERpcmVjdGl2ZS9AQ29tcG9uZW50IGFubm90YXRpb24uYCksXG4gICAgICAgICAgICAgIG1vZHVsZVR5cGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwb3J0ZWREaXJlY3RpdmVzOiBjcGwuQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdID0gW107XG4gICAgY29uc3QgZXhwb3J0ZWRQaXBlczogY3BsLkNvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSA9IFtdO1xuICAgIGV4cG9ydGVkTm9uTW9kdWxlSWRlbnRpZmllcnMuZm9yRWFjaCgoZXhwb3J0ZWRJZCkgPT4ge1xuICAgICAgaWYgKHRyYW5zaXRpdmVNb2R1bGUuZGlyZWN0aXZlc1NldC5oYXMoZXhwb3J0ZWRJZC5yZWZlcmVuY2UpKSB7XG4gICAgICAgIGV4cG9ydGVkRGlyZWN0aXZlcy5wdXNoKGV4cG9ydGVkSWQpO1xuICAgICAgICB0cmFuc2l0aXZlTW9kdWxlLmFkZEV4cG9ydGVkRGlyZWN0aXZlKGV4cG9ydGVkSWQpO1xuICAgICAgfSBlbHNlIGlmICh0cmFuc2l0aXZlTW9kdWxlLnBpcGVzU2V0LmhhcyhleHBvcnRlZElkLnJlZmVyZW5jZSkpIHtcbiAgICAgICAgZXhwb3J0ZWRQaXBlcy5wdXNoKGV4cG9ydGVkSWQpO1xuICAgICAgICB0cmFuc2l0aXZlTW9kdWxlLmFkZEV4cG9ydGVkUGlwZShleHBvcnRlZElkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgc3ludGF4RXJyb3IoYENhbid0IGV4cG9ydCAke3RoaXMuX2dldFR5cGVEZXNjcmlwdG9yKGV4cG9ydGVkSWQucmVmZXJlbmNlKX0gJHtcbiAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKGV4cG9ydGVkSWQucmVmZXJlbmNlKX0gZnJvbSAke1xuICAgICAgICAgICAgICAgIHN0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9IGFzIGl0IHdhcyBuZWl0aGVyIGRlY2xhcmVkIG5vciBpbXBvcnRlZCFgKSxcbiAgICAgICAgICAgIG1vZHVsZVR5cGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUaGUgcHJvdmlkZXJzIG9mIHRoZSBtb2R1bGUgaGF2ZSB0byBnbyBsYXN0XG4gICAgLy8gc28gdGhhdCB0aGV5IG92ZXJ3cml0ZSBhbnkgb3RoZXIgcHJvdmlkZXIgd2UgYWxyZWFkeSBhZGRlZC5cbiAgICBpZiAobWV0YS5wcm92aWRlcnMpIHtcbiAgICAgIHByb3ZpZGVycy5wdXNoKC4uLnRoaXMuX2dldFByb3ZpZGVyc01ldGFkYXRhKFxuICAgICAgICAgIG1ldGEucHJvdmlkZXJzLCBlbnRyeUNvbXBvbmVudHMsXG4gICAgICAgICAgYHByb3ZpZGVyIGZvciB0aGUgTmdNb2R1bGUgJyR7c3RyaW5naWZ5VHlwZShtb2R1bGVUeXBlKX0nYCwgW10sIG1vZHVsZVR5cGUpKTtcbiAgICB9XG5cbiAgICBpZiAobWV0YS5lbnRyeUNvbXBvbmVudHMpIHtcbiAgICAgIGVudHJ5Q29tcG9uZW50cy5wdXNoKC4uLmZsYXR0ZW5BbmREZWR1cGVBcnJheShtZXRhLmVudHJ5Q29tcG9uZW50cylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKHR5cGUgPT4gdGhpcy5fZ2V0RW50cnlDb21wb25lbnRNZXRhZGF0YSh0eXBlKSEpKTtcbiAgICB9XG5cbiAgICBpZiAobWV0YS5ib290c3RyYXApIHtcbiAgICAgIGZsYXR0ZW5BbmREZWR1cGVBcnJheShtZXRhLmJvb3RzdHJhcCkuZm9yRWFjaCh0eXBlID0+IHtcbiAgICAgICAgaWYgKCFpc1ZhbGlkVHlwZSh0eXBlKSkge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBzeW50YXhFcnJvcihgVW5leHBlY3RlZCB2YWx1ZSAnJHtcbiAgICAgICAgICAgICAgICAgIHN0cmluZ2lmeVR5cGUodHlwZSl9JyB1c2VkIGluIHRoZSBib290c3RyYXAgcHJvcGVydHkgb2YgbW9kdWxlICcke1xuICAgICAgICAgICAgICAgICAgc3RyaW5naWZ5VHlwZShtb2R1bGVUeXBlKX0nYCksXG4gICAgICAgICAgICAgIG1vZHVsZVR5cGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBib290c3RyYXBDb21wb25lbnRzLnB1c2godGhpcy5fZ2V0SWRlbnRpZmllck1ldGFkYXRhKHR5cGUpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGVudHJ5Q29tcG9uZW50cy5wdXNoKFxuICAgICAgICAuLi5ib290c3RyYXBDb21wb25lbnRzLm1hcCh0eXBlID0+IHRoaXMuX2dldEVudHJ5Q29tcG9uZW50TWV0YWRhdGEodHlwZS5yZWZlcmVuY2UpISkpO1xuXG4gICAgaWYgKG1ldGEuc2NoZW1hcykge1xuICAgICAgc2NoZW1hcy5wdXNoKC4uLmZsYXR0ZW5BbmREZWR1cGVBcnJheShtZXRhLnNjaGVtYXMpKTtcbiAgICB9XG5cbiAgICBjb21waWxlTWV0YSA9IG5ldyBjcGwuQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEoe1xuICAgICAgdHlwZTogdGhpcy5fZ2V0VHlwZU1ldGFkYXRhKG1vZHVsZVR5cGUpLFxuICAgICAgcHJvdmlkZXJzLFxuICAgICAgZW50cnlDb21wb25lbnRzLFxuICAgICAgYm9vdHN0cmFwQ29tcG9uZW50cyxcbiAgICAgIHNjaGVtYXMsXG4gICAgICBkZWNsYXJlZERpcmVjdGl2ZXMsXG4gICAgICBleHBvcnRlZERpcmVjdGl2ZXMsXG4gICAgICBkZWNsYXJlZFBpcGVzLFxuICAgICAgZXhwb3J0ZWRQaXBlcyxcbiAgICAgIGltcG9ydGVkTW9kdWxlcyxcbiAgICAgIGV4cG9ydGVkTW9kdWxlcyxcbiAgICAgIHRyYW5zaXRpdmVNb2R1bGUsXG4gICAgICBpZDogbWV0YS5pZCB8fCBudWxsLFxuICAgIH0pO1xuXG4gICAgZW50cnlDb21wb25lbnRzLmZvckVhY2goKGlkKSA9PiB0cmFuc2l0aXZlTW9kdWxlLmFkZEVudHJ5Q29tcG9uZW50KGlkKSk7XG4gICAgcHJvdmlkZXJzLmZvckVhY2goKHByb3ZpZGVyKSA9PiB0cmFuc2l0aXZlTW9kdWxlLmFkZFByb3ZpZGVyKHByb3ZpZGVyLCBjb21waWxlTWV0YSEudHlwZSkpO1xuICAgIHRyYW5zaXRpdmVNb2R1bGUuYWRkTW9kdWxlKGNvbXBpbGVNZXRhLnR5cGUpO1xuICAgIHRoaXMuX25nTW9kdWxlQ2FjaGUuc2V0KG1vZHVsZVR5cGUsIGNvbXBpbGVNZXRhKTtcbiAgICByZXR1cm4gY29tcGlsZU1ldGE7XG4gIH1cblxuICBwcml2YXRlIF9jaGVja1NlbGZJbXBvcnQobW9kdWxlVHlwZTogVHlwZSwgaW1wb3J0ZWRNb2R1bGVUeXBlOiBUeXBlKTogYm9vbGVhbiB7XG4gICAgaWYgKG1vZHVsZVR5cGUgPT09IGltcG9ydGVkTW9kdWxlVHlwZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoYCcke3N0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9JyBtb2R1bGUgY2FuJ3QgaW1wb3J0IGl0c2VsZmApLCBtb2R1bGVUeXBlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9nZXRUeXBlRGVzY3JpcHRvcih0eXBlOiBUeXBlKTogc3RyaW5nIHtcbiAgICBpZiAoaXNWYWxpZFR5cGUodHlwZSkpIHtcbiAgICAgIGlmICh0aGlzLmlzRGlyZWN0aXZlKHR5cGUpKSB7XG4gICAgICAgIHJldHVybiAnZGlyZWN0aXZlJztcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuaXNQaXBlKHR5cGUpKSB7XG4gICAgICAgIHJldHVybiAncGlwZSc7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmlzTmdNb2R1bGUodHlwZSkpIHtcbiAgICAgICAgcmV0dXJuICdtb2R1bGUnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgodHlwZSBhcyBhbnkpLnByb3ZpZGUpIHtcbiAgICAgIHJldHVybiAncHJvdmlkZXInO1xuICAgIH1cblxuICAgIHJldHVybiAndmFsdWUnO1xuICB9XG5cblxuICBwcml2YXRlIF9hZGRUeXBlVG9Nb2R1bGUodHlwZTogVHlwZSwgbW9kdWxlVHlwZTogVHlwZSkge1xuICAgIGNvbnN0IG9sZE1vZHVsZSA9IHRoaXMuX25nTW9kdWxlT2ZUeXBlcy5nZXQodHlwZSk7XG4gICAgaWYgKG9sZE1vZHVsZSAmJiBvbGRNb2R1bGUgIT09IG1vZHVsZVR5cGUpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICBgVHlwZSAke3N0cmluZ2lmeVR5cGUodHlwZSl9IGlzIHBhcnQgb2YgdGhlIGRlY2xhcmF0aW9ucyBvZiAyIG1vZHVsZXM6ICR7XG4gICAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKG9sZE1vZHVsZSl9IGFuZCAke3N0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9ISBgICtcbiAgICAgICAgICAgICAgYFBsZWFzZSBjb25zaWRlciBtb3ZpbmcgJHtzdHJpbmdpZnlUeXBlKHR5cGUpfSB0byBhIGhpZ2hlciBtb2R1bGUgdGhhdCBpbXBvcnRzICR7XG4gICAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKG9sZE1vZHVsZSl9IGFuZCAke3N0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9LiBgICtcbiAgICAgICAgICAgICAgYFlvdSBjYW4gYWxzbyBjcmVhdGUgYSBuZXcgTmdNb2R1bGUgdGhhdCBleHBvcnRzIGFuZCBpbmNsdWRlcyAke1xuICAgICAgICAgICAgICAgICAgc3RyaW5naWZ5VHlwZSh0eXBlKX0gdGhlbiBpbXBvcnQgdGhhdCBOZ01vZHVsZSBpbiAke1xuICAgICAgICAgICAgICAgICAgc3RyaW5naWZ5VHlwZShvbGRNb2R1bGUpfSBhbmQgJHtzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfS5gKSxcbiAgICAgICAgICBtb2R1bGVUeXBlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5fbmdNb2R1bGVPZlR5cGVzLnNldCh0eXBlLCBtb2R1bGVUeXBlKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFRyYW5zaXRpdmVOZ01vZHVsZU1ldGFkYXRhKFxuICAgICAgaW1wb3J0ZWRNb2R1bGVzOiBjcGwuQ29tcGlsZU5nTW9kdWxlU3VtbWFyeVtdLFxuICAgICAgZXhwb3J0ZWRNb2R1bGVzOiBjcGwuQ29tcGlsZU5nTW9kdWxlU3VtbWFyeVtdKTogY3BsLlRyYW5zaXRpdmVDb21waWxlTmdNb2R1bGVNZXRhZGF0YSB7XG4gICAgLy8gY29sbGVjdCBgcHJvdmlkZXJzYCAvIGBlbnRyeUNvbXBvbmVudHNgIGZyb20gYWxsIGltcG9ydGVkIGFuZCBhbGwgZXhwb3J0ZWQgbW9kdWxlc1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBjcGwuVHJhbnNpdGl2ZUNvbXBpbGVOZ01vZHVsZU1ldGFkYXRhKCk7XG4gICAgY29uc3QgbW9kdWxlc0J5VG9rZW4gPSBuZXcgTWFwPGFueSwgU2V0PGFueT4+KCk7XG4gICAgaW1wb3J0ZWRNb2R1bGVzLmNvbmNhdChleHBvcnRlZE1vZHVsZXMpLmZvckVhY2goKG1vZFN1bW1hcnkpID0+IHtcbiAgICAgIG1vZFN1bW1hcnkubW9kdWxlcy5mb3JFYWNoKChtb2QpID0+IHJlc3VsdC5hZGRNb2R1bGUobW9kKSk7XG4gICAgICBtb2RTdW1tYXJ5LmVudHJ5Q29tcG9uZW50cy5mb3JFYWNoKChjb21wKSA9PiByZXN1bHQuYWRkRW50cnlDb21wb25lbnQoY29tcCkpO1xuICAgICAgY29uc3QgYWRkZWRUb2tlbnMgPSBuZXcgU2V0PGFueT4oKTtcbiAgICAgIG1vZFN1bW1hcnkucHJvdmlkZXJzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICAgIGNvbnN0IHRva2VuUmVmID0gY3BsLnRva2VuUmVmZXJlbmNlKGVudHJ5LnByb3ZpZGVyLnRva2VuKTtcbiAgICAgICAgbGV0IHByZXZNb2R1bGVzID0gbW9kdWxlc0J5VG9rZW4uZ2V0KHRva2VuUmVmKTtcbiAgICAgICAgaWYgKCFwcmV2TW9kdWxlcykge1xuICAgICAgICAgIHByZXZNb2R1bGVzID0gbmV3IFNldDxhbnk+KCk7XG4gICAgICAgICAgbW9kdWxlc0J5VG9rZW4uc2V0KHRva2VuUmVmLCBwcmV2TW9kdWxlcyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbW9kdWxlUmVmID0gZW50cnkubW9kdWxlLnJlZmVyZW5jZTtcbiAgICAgICAgLy8gTm90ZTogdGhlIHByb3ZpZGVycyBvZiBvbmUgbW9kdWxlIG1heSBzdGlsbCBjb250YWluIG11bHRpcGxlIHByb3ZpZGVyc1xuICAgICAgICAvLyBwZXIgdG9rZW4gKGUuZy4gZm9yIG11bHRpIHByb3ZpZGVycyksIGFuZCB3ZSBuZWVkIHRvIHByZXNlcnZlIHRoZXNlLlxuICAgICAgICBpZiAoYWRkZWRUb2tlbnMuaGFzKHRva2VuUmVmKSB8fCAhcHJldk1vZHVsZXMuaGFzKG1vZHVsZVJlZikpIHtcbiAgICAgICAgICBwcmV2TW9kdWxlcy5hZGQobW9kdWxlUmVmKTtcbiAgICAgICAgICBhZGRlZFRva2Vucy5hZGQodG9rZW5SZWYpO1xuICAgICAgICAgIHJlc3VsdC5hZGRQcm92aWRlcihlbnRyeS5wcm92aWRlciwgZW50cnkubW9kdWxlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgZXhwb3J0ZWRNb2R1bGVzLmZvckVhY2goKG1vZFN1bW1hcnkpID0+IHtcbiAgICAgIG1vZFN1bW1hcnkuZXhwb3J0ZWREaXJlY3RpdmVzLmZvckVhY2goKGlkKSA9PiByZXN1bHQuYWRkRXhwb3J0ZWREaXJlY3RpdmUoaWQpKTtcbiAgICAgIG1vZFN1bW1hcnkuZXhwb3J0ZWRQaXBlcy5mb3JFYWNoKChpZCkgPT4gcmVzdWx0LmFkZEV4cG9ydGVkUGlwZShpZCkpO1xuICAgIH0pO1xuICAgIGltcG9ydGVkTW9kdWxlcy5mb3JFYWNoKChtb2RTdW1tYXJ5KSA9PiB7XG4gICAgICBtb2RTdW1tYXJ5LmV4cG9ydGVkRGlyZWN0aXZlcy5mb3JFYWNoKChpZCkgPT4gcmVzdWx0LmFkZERpcmVjdGl2ZShpZCkpO1xuICAgICAgbW9kU3VtbWFyeS5leHBvcnRlZFBpcGVzLmZvckVhY2goKGlkKSA9PiByZXN1bHQuYWRkUGlwZShpZCkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwcml2YXRlIF9nZXRJZGVudGlmaWVyTWV0YWRhdGEodHlwZTogVHlwZSk6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhIHtcbiAgICB0eXBlID0gcmVzb2x2ZUZvcndhcmRSZWYodHlwZSk7XG4gICAgcmV0dXJuIHtyZWZlcmVuY2U6IHR5cGV9O1xuICB9XG5cbiAgaXNJbmplY3RhYmxlKHR5cGU6IGFueSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGFubm90YXRpb25zID0gdGhpcy5fcmVmbGVjdG9yLnRyeUFubm90YXRpb25zKHR5cGUpO1xuICAgIHJldHVybiBhbm5vdGF0aW9ucy5zb21lKGFubiA9PiBjcmVhdGVJbmplY3RhYmxlLmlzVHlwZU9mKGFubikpO1xuICB9XG5cbiAgZ2V0SW5qZWN0YWJsZVN1bW1hcnkodHlwZTogYW55KTogY3BsLkNvbXBpbGVUeXBlU3VtbWFyeSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1bW1hcnlLaW5kOiBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLkluamVjdGFibGUsXG4gICAgICB0eXBlOiB0aGlzLl9nZXRUeXBlTWV0YWRhdGEodHlwZSwgbnVsbCwgZmFsc2UpXG4gICAgfTtcbiAgfVxuXG4gIGdldEluamVjdGFibGVNZXRhZGF0YShcbiAgICAgIHR5cGU6IGFueSwgZGVwZW5kZW5jaWVzOiBhbnlbXXxudWxsID0gbnVsbCxcbiAgICAgIHRocm93T25Vbmtub3duRGVwczogYm9vbGVhbiA9IHRydWUpOiBjcGwuQ29tcGlsZUluamVjdGFibGVNZXRhZGF0YXxudWxsIHtcbiAgICBjb25zdCB0eXBlU3VtbWFyeSA9IHRoaXMuX2xvYWRTdW1tYXJ5KHR5cGUsIGNwbC5Db21waWxlU3VtbWFyeUtpbmQuSW5qZWN0YWJsZSk7XG4gICAgY29uc3QgdHlwZU1ldGFkYXRhID0gdHlwZVN1bW1hcnkgP1xuICAgICAgICB0eXBlU3VtbWFyeS50eXBlIDpcbiAgICAgICAgdGhpcy5fZ2V0VHlwZU1ldGFkYXRhKHR5cGUsIGRlcGVuZGVuY2llcywgdGhyb3dPblVua25vd25EZXBzKTtcblxuICAgIGNvbnN0IGFubm90YXRpb25zOiBJbmplY3RhYmxlW10gPVxuICAgICAgICB0aGlzLl9yZWZsZWN0b3IuYW5ub3RhdGlvbnModHlwZSkuZmlsdGVyKGFubiA9PiBjcmVhdGVJbmplY3RhYmxlLmlzVHlwZU9mKGFubikpO1xuXG4gICAgaWYgKGFubm90YXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YSA9IGFubm90YXRpb25zW2Fubm90YXRpb25zLmxlbmd0aCAtIDFdO1xuICAgIHJldHVybiB7XG4gICAgICBzeW1ib2w6IHR5cGUsXG4gICAgICB0eXBlOiB0eXBlTWV0YWRhdGEsXG4gICAgICBwcm92aWRlZEluOiBtZXRhLnByb3ZpZGVkSW4sXG4gICAgICB1c2VWYWx1ZTogbWV0YS51c2VWYWx1ZSxcbiAgICAgIHVzZUNsYXNzOiBtZXRhLnVzZUNsYXNzLFxuICAgICAgdXNlRXhpc3Rpbmc6IG1ldGEudXNlRXhpc3RpbmcsXG4gICAgICB1c2VGYWN0b3J5OiBtZXRhLnVzZUZhY3RvcnksXG4gICAgICBkZXBzOiBtZXRhLmRlcHMsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFR5cGVNZXRhZGF0YSh0eXBlOiBUeXBlLCBkZXBlbmRlbmNpZXM6IGFueVtdfG51bGwgPSBudWxsLCB0aHJvd09uVW5rbm93bkRlcHMgPSB0cnVlKTpcbiAgICAgIGNwbC5Db21waWxlVHlwZU1ldGFkYXRhIHtcbiAgICBjb25zdCBpZGVudGlmaWVyID0gdGhpcy5fZ2V0SWRlbnRpZmllck1ldGFkYXRhKHR5cGUpO1xuICAgIHJldHVybiB7XG4gICAgICByZWZlcmVuY2U6IGlkZW50aWZpZXIucmVmZXJlbmNlLFxuICAgICAgZGlEZXBzOiB0aGlzLl9nZXREZXBlbmRlbmNpZXNNZXRhZGF0YShpZGVudGlmaWVyLnJlZmVyZW5jZSwgZGVwZW5kZW5jaWVzLCB0aHJvd09uVW5rbm93bkRlcHMpLFxuICAgICAgbGlmZWN5Y2xlSG9va3M6IGdldEFsbExpZmVjeWNsZUhvb2tzKHRoaXMuX3JlZmxlY3RvciwgaWRlbnRpZmllci5yZWZlcmVuY2UpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9nZXRGYWN0b3J5TWV0YWRhdGEoZmFjdG9yeTogRnVuY3Rpb24sIGRlcGVuZGVuY2llczogYW55W118bnVsbCA9IG51bGwpOlxuICAgICAgY3BsLkNvbXBpbGVGYWN0b3J5TWV0YWRhdGEge1xuICAgIGZhY3RvcnkgPSByZXNvbHZlRm9yd2FyZFJlZihmYWN0b3J5KTtcbiAgICByZXR1cm4ge3JlZmVyZW5jZTogZmFjdG9yeSwgZGlEZXBzOiB0aGlzLl9nZXREZXBlbmRlbmNpZXNNZXRhZGF0YShmYWN0b3J5LCBkZXBlbmRlbmNpZXMpfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBtZXRhZGF0YSBmb3IgdGhlIGdpdmVuIHBpcGUuXG4gICAqIFRoaXMgYXNzdW1lcyBgbG9hZE5nTW9kdWxlRGlyZWN0aXZlQW5kUGlwZU1ldGFkYXRhYCBoYXMgYmVlbiBjYWxsZWQgZmlyc3QuXG4gICAqL1xuICBnZXRQaXBlTWV0YWRhdGEocGlwZVR5cGU6IGFueSk6IGNwbC5Db21waWxlUGlwZU1ldGFkYXRhfG51bGwge1xuICAgIGNvbnN0IHBpcGVNZXRhID0gdGhpcy5fcGlwZUNhY2hlLmdldChwaXBlVHlwZSk7XG4gICAgaWYgKCFwaXBlTWV0YSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBnZXRQaXBlTWV0YWRhdGEgY2FuIG9ubHkgYmUgY2FsbGVkIGFmdGVyIGxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YSBmb3IgYSBtb2R1bGUgdGhhdCBkZWNsYXJlcyBpdC4gUGlwZSAke1xuICAgICAgICAgICAgICAgICAgc3RyaW5naWZ5VHlwZShwaXBlVHlwZSl9LmApLFxuICAgICAgICAgIHBpcGVUeXBlKTtcbiAgICB9XG4gICAgcmV0dXJuIHBpcGVNZXRhIHx8IG51bGw7XG4gIH1cblxuICBnZXRQaXBlU3VtbWFyeShwaXBlVHlwZTogYW55KTogY3BsLkNvbXBpbGVQaXBlU3VtbWFyeSB7XG4gICAgY29uc3QgcGlwZVN1bW1hcnkgPVxuICAgICAgICA8Y3BsLkNvbXBpbGVQaXBlU3VtbWFyeT50aGlzLl9sb2FkU3VtbWFyeShwaXBlVHlwZSwgY3BsLkNvbXBpbGVTdW1tYXJ5S2luZC5QaXBlKTtcbiAgICBpZiAoIXBpcGVTdW1tYXJ5KSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBzeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgYElsbGVnYWwgc3RhdGU6IENvdWxkIG5vdCBsb2FkIHRoZSBzdW1tYXJ5IGZvciBwaXBlICR7c3RyaW5naWZ5VHlwZShwaXBlVHlwZSl9LmApLFxuICAgICAgICAgIHBpcGVUeXBlKTtcbiAgICB9XG4gICAgcmV0dXJuIHBpcGVTdW1tYXJ5O1xuICB9XG5cbiAgZ2V0T3JMb2FkUGlwZU1ldGFkYXRhKHBpcGVUeXBlOiBhbnkpOiBjcGwuQ29tcGlsZVBpcGVNZXRhZGF0YSB7XG4gICAgbGV0IHBpcGVNZXRhID0gdGhpcy5fcGlwZUNhY2hlLmdldChwaXBlVHlwZSk7XG4gICAgaWYgKCFwaXBlTWV0YSkge1xuICAgICAgcGlwZU1ldGEgPSB0aGlzLl9sb2FkUGlwZU1ldGFkYXRhKHBpcGVUeXBlKTtcbiAgICB9XG4gICAgcmV0dXJuIHBpcGVNZXRhO1xuICB9XG5cbiAgcHJpdmF0ZSBfbG9hZFBpcGVNZXRhZGF0YShwaXBlVHlwZTogYW55KTogY3BsLkNvbXBpbGVQaXBlTWV0YWRhdGEge1xuICAgIHBpcGVUeXBlID0gcmVzb2x2ZUZvcndhcmRSZWYocGlwZVR5cGUpO1xuICAgIGNvbnN0IHBpcGVBbm5vdGF0aW9uID0gdGhpcy5fcGlwZVJlc29sdmVyLnJlc29sdmUocGlwZVR5cGUpITtcblxuICAgIGNvbnN0IHBpcGVNZXRhID0gbmV3IGNwbC5Db21waWxlUGlwZU1ldGFkYXRhKHtcbiAgICAgIHR5cGU6IHRoaXMuX2dldFR5cGVNZXRhZGF0YShwaXBlVHlwZSksXG4gICAgICBuYW1lOiBwaXBlQW5ub3RhdGlvbi5uYW1lLFxuICAgICAgcHVyZTogISFwaXBlQW5ub3RhdGlvbi5wdXJlXG4gICAgfSk7XG4gICAgdGhpcy5fcGlwZUNhY2hlLnNldChwaXBlVHlwZSwgcGlwZU1ldGEpO1xuICAgIHRoaXMuX3N1bW1hcnlDYWNoZS5zZXQocGlwZVR5cGUsIHBpcGVNZXRhLnRvU3VtbWFyeSgpKTtcbiAgICByZXR1cm4gcGlwZU1ldGE7XG4gIH1cblxuICBwcml2YXRlIF9nZXREZXBlbmRlbmNpZXNNZXRhZGF0YShcbiAgICAgIHR5cGVPckZ1bmM6IFR5cGV8RnVuY3Rpb24sIGRlcGVuZGVuY2llczogYW55W118bnVsbCxcbiAgICAgIHRocm93T25Vbmtub3duRGVwcyA9IHRydWUpOiBjcGwuQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhW10ge1xuICAgIGxldCBoYXNVbmtub3duRGVwcyA9IGZhbHNlO1xuICAgIGNvbnN0IHBhcmFtcyA9IGRlcGVuZGVuY2llcyB8fCB0aGlzLl9yZWZsZWN0b3IucGFyYW1ldGVycyh0eXBlT3JGdW5jKSB8fCBbXTtcblxuICAgIGNvbnN0IGRlcGVuZGVuY2llc01ldGFkYXRhOiBjcGwuQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhW10gPSBwYXJhbXMubWFwKChwYXJhbSkgPT4ge1xuICAgICAgbGV0IGlzQXR0cmlidXRlID0gZmFsc2U7XG4gICAgICBsZXQgaXNIb3N0ID0gZmFsc2U7XG4gICAgICBsZXQgaXNTZWxmID0gZmFsc2U7XG4gICAgICBsZXQgaXNTa2lwU2VsZiA9IGZhbHNlO1xuICAgICAgbGV0IGlzT3B0aW9uYWwgPSBmYWxzZTtcbiAgICAgIGxldCB0b2tlbjogYW55ID0gbnVsbDtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHBhcmFtKSkge1xuICAgICAgICBwYXJhbS5mb3JFYWNoKChwYXJhbUVudHJ5OiBhbnkpID0+IHtcbiAgICAgICAgICBpZiAoY3JlYXRlSG9zdC5pc1R5cGVPZihwYXJhbUVudHJ5KSkge1xuICAgICAgICAgICAgaXNIb3N0ID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNyZWF0ZVNlbGYuaXNUeXBlT2YocGFyYW1FbnRyeSkpIHtcbiAgICAgICAgICAgIGlzU2VsZiA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjcmVhdGVTa2lwU2VsZi5pc1R5cGVPZihwYXJhbUVudHJ5KSkge1xuICAgICAgICAgICAgaXNTa2lwU2VsZiA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjcmVhdGVPcHRpb25hbC5pc1R5cGVPZihwYXJhbUVudHJ5KSkge1xuICAgICAgICAgICAgaXNPcHRpb25hbCA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjcmVhdGVBdHRyaWJ1dGUuaXNUeXBlT2YocGFyYW1FbnRyeSkpIHtcbiAgICAgICAgICAgIGlzQXR0cmlidXRlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRva2VuID0gKHBhcmFtRW50cnkgYXMgYW55KS5hdHRyaWJ1dGVOYW1lO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY3JlYXRlSW5qZWN0LmlzVHlwZU9mKHBhcmFtRW50cnkpKSB7XG4gICAgICAgICAgICB0b2tlbiA9IChwYXJhbUVudHJ5IGFzIGFueSkudG9rZW47XG4gICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgICAgY3JlYXRlSW5qZWN0aW9uVG9rZW4uaXNUeXBlT2YocGFyYW1FbnRyeSkgfHxcbiAgICAgICAgICAgICAgKHBhcmFtRW50cnkgYXMgYW55KSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgICAgICAgdG9rZW4gPSBwYXJhbUVudHJ5O1xuICAgICAgICAgIH0gZWxzZSBpZiAoaXNWYWxpZFR5cGUocGFyYW1FbnRyeSkgJiYgdG9rZW4gPT0gbnVsbCkge1xuICAgICAgICAgICAgdG9rZW4gPSBwYXJhbUVudHJ5O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0b2tlbiA9IHBhcmFtO1xuICAgICAgfVxuICAgICAgaWYgKHRva2VuID09IG51bGwpIHtcbiAgICAgICAgaGFzVW5rbm93bkRlcHMgPSB0cnVlO1xuICAgICAgICByZXR1cm4ge307XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlzQXR0cmlidXRlLFxuICAgICAgICBpc0hvc3QsXG4gICAgICAgIGlzU2VsZixcbiAgICAgICAgaXNTa2lwU2VsZixcbiAgICAgICAgaXNPcHRpb25hbCxcbiAgICAgICAgdG9rZW46IHRoaXMuX2dldFRva2VuTWV0YWRhdGEodG9rZW4pXG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgaWYgKGhhc1Vua25vd25EZXBzKSB7XG4gICAgICBjb25zdCBkZXBzVG9rZW5zID1cbiAgICAgICAgICBkZXBlbmRlbmNpZXNNZXRhZGF0YS5tYXAoKGRlcCkgPT4gZGVwLnRva2VuID8gc3RyaW5naWZ5VHlwZShkZXAudG9rZW4pIDogJz8nKS5qb2luKCcsICcpO1xuICAgICAgY29uc3QgbWVzc2FnZSA9XG4gICAgICAgICAgYENhbid0IHJlc29sdmUgYWxsIHBhcmFtZXRlcnMgZm9yICR7c3RyaW5naWZ5VHlwZSh0eXBlT3JGdW5jKX06ICgke2RlcHNUb2tlbnN9KS5gO1xuICAgICAgaWYgKHRocm93T25Vbmtub3duRGVwcyB8fCB0aGlzLl9jb25maWcuc3RyaWN0SW5qZWN0aW9uUGFyYW1ldGVycykge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihzeW50YXhFcnJvcihtZXNzYWdlKSwgdHlwZU9yRnVuYyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlcGVuZGVuY2llc01ldGFkYXRhO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0VG9rZW5NZXRhZGF0YSh0b2tlbjogYW55KTogY3BsLkNvbXBpbGVUb2tlbk1ldGFkYXRhIHtcbiAgICB0b2tlbiA9IHJlc29sdmVGb3J3YXJkUmVmKHRva2VuKTtcbiAgICBsZXQgY29tcGlsZVRva2VuOiBjcGwuQ29tcGlsZVRva2VuTWV0YWRhdGE7XG4gICAgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbXBpbGVUb2tlbiA9IHt2YWx1ZTogdG9rZW59O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb21waWxlVG9rZW4gPSB7aWRlbnRpZmllcjoge3JlZmVyZW5jZTogdG9rZW59fTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBpbGVUb2tlbjtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFByb3ZpZGVyc01ldGFkYXRhKFxuICAgICAgcHJvdmlkZXJzOiBQcm92aWRlcltdLCB0YXJnZXRFbnRyeUNvbXBvbmVudHM6IGNwbC5Db21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdLFxuICAgICAgZGVidWdJbmZvPzogc3RyaW5nLCBjb21waWxlUHJvdmlkZXJzOiBjcGwuQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSA9IFtdLFxuICAgICAgdHlwZT86IGFueSk6IGNwbC5Db21waWxlUHJvdmlkZXJNZXRhZGF0YVtdIHtcbiAgICBwcm92aWRlcnMuZm9yRWFjaCgocHJvdmlkZXI6IGFueSwgcHJvdmlkZXJJZHg6IG51bWJlcikgPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkocHJvdmlkZXIpKSB7XG4gICAgICAgIHRoaXMuX2dldFByb3ZpZGVyc01ldGFkYXRhKHByb3ZpZGVyLCB0YXJnZXRFbnRyeUNvbXBvbmVudHMsIGRlYnVnSW5mbywgY29tcGlsZVByb3ZpZGVycyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm92aWRlciA9IHJlc29sdmVGb3J3YXJkUmVmKHByb3ZpZGVyKTtcbiAgICAgICAgbGV0IHByb3ZpZGVyTWV0YTogY3BsLlByb3ZpZGVyTWV0YSA9IHVuZGVmaW5lZCE7XG4gICAgICAgIGlmIChwcm92aWRlciAmJiB0eXBlb2YgcHJvdmlkZXIgPT09ICdvYmplY3QnICYmIHByb3ZpZGVyLmhhc093blByb3BlcnR5KCdwcm92aWRlJykpIHtcbiAgICAgICAgICB0aGlzLl92YWxpZGF0ZVByb3ZpZGVyKHByb3ZpZGVyKTtcbiAgICAgICAgICBwcm92aWRlck1ldGEgPSBuZXcgY3BsLlByb3ZpZGVyTWV0YShwcm92aWRlci5wcm92aWRlLCBwcm92aWRlcik7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNWYWxpZFR5cGUocHJvdmlkZXIpKSB7XG4gICAgICAgICAgcHJvdmlkZXJNZXRhID0gbmV3IGNwbC5Qcm92aWRlck1ldGEocHJvdmlkZXIsIHt1c2VDbGFzczogcHJvdmlkZXJ9KTtcbiAgICAgICAgfSBlbHNlIGlmIChwcm92aWRlciA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3Ioc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBFbmNvdW50ZXJlZCB1bmRlZmluZWQgcHJvdmlkZXIhIFVzdWFsbHkgdGhpcyBtZWFucyB5b3UgaGF2ZSBhIGNpcmN1bGFyIGRlcGVuZGVuY2llcy4gVGhpcyBtaWdodCBiZSBjYXVzZWQgYnkgdXNpbmcgJ2JhcnJlbCcgaW5kZXgudHMgZmlsZXMuYCkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBwcm92aWRlcnNJbmZvID1cbiAgICAgICAgICAgICAgcHJvdmlkZXJzXG4gICAgICAgICAgICAgICAgICAucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICAgIChzb0Zhcjogc3RyaW5nW10sIHNlZW5Qcm92aWRlcjogYW55LCBzZWVuUHJvdmlkZXJJZHg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlZW5Qcm92aWRlcklkeCA8IHByb3ZpZGVySWR4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNvRmFyLnB1c2goYCR7c3RyaW5naWZ5VHlwZShzZWVuUHJvdmlkZXIpfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZWVuUHJvdmlkZXJJZHggPT0gcHJvdmlkZXJJZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc29GYXIucHVzaChgPyR7c3RyaW5naWZ5VHlwZShzZWVuUHJvdmlkZXIpfT9gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VlblByb3ZpZGVySWR4ID09IHByb3ZpZGVySWR4ICsgMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzb0Zhci5wdXNoKCcuLi4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzb0ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIFtdKVxuICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKGBJbnZhbGlkICR7XG4gICAgICAgICAgICAgICAgICBkZWJ1Z0luZm8gP1xuICAgICAgICAgICAgICAgICAgICAgIGRlYnVnSW5mbyA6XG4gICAgICAgICAgICAgICAgICAgICAgJ3Byb3ZpZGVyJ30gLSBvbmx5IGluc3RhbmNlcyBvZiBQcm92aWRlciBhbmQgVHlwZSBhcmUgYWxsb3dlZCwgZ290OiBbJHtcbiAgICAgICAgICAgICAgICAgIHByb3ZpZGVyc0luZm99XWApLFxuICAgICAgICAgICAgICB0eXBlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3ZpZGVyTWV0YS50b2tlbiA9PT1cbiAgICAgICAgICAgIHRoaXMuX3JlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuQU5BTFlaRV9GT1JfRU5UUllfQ09NUE9ORU5UUykpIHtcbiAgICAgICAgICB0YXJnZXRFbnRyeUNvbXBvbmVudHMucHVzaCguLi50aGlzLl9nZXRFbnRyeUNvbXBvbmVudHNGcm9tUHJvdmlkZXIocHJvdmlkZXJNZXRhLCB0eXBlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29tcGlsZVByb3ZpZGVycy5wdXNoKHRoaXMuZ2V0UHJvdmlkZXJNZXRhZGF0YShwcm92aWRlck1ldGEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBjb21waWxlUHJvdmlkZXJzO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmFsaWRhdGVQcm92aWRlcihwcm92aWRlcjogYW55KTogdm9pZCB7XG4gICAgaWYgKHByb3ZpZGVyLmhhc093blByb3BlcnR5KCd1c2VDbGFzcycpICYmIHByb3ZpZGVyLnVzZUNsYXNzID09IG51bGwpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKHN5bnRheEVycm9yKGBJbnZhbGlkIHByb3ZpZGVyIGZvciAke1xuICAgICAgICAgIHN0cmluZ2lmeVR5cGUocHJvdmlkZXIucHJvdmlkZSl9LiB1c2VDbGFzcyBjYW5ub3QgYmUgJHtwcm92aWRlci51c2VDbGFzc30uXG4gICAgICAgICAgIFVzdWFsbHkgaXQgaGFwcGVucyB3aGVuOlxuICAgICAgICAgICAxLiBUaGVyZSdzIGEgY2lyY3VsYXIgZGVwZW5kZW5jeSAobWlnaHQgYmUgY2F1c2VkIGJ5IHVzaW5nIGluZGV4LnRzIChiYXJyZWwpIGZpbGVzKS5cbiAgICAgICAgICAgMi4gQ2xhc3Mgd2FzIHVzZWQgYmVmb3JlIGl0IHdhcyBkZWNsYXJlZC4gVXNlIGZvcndhcmRSZWYgaW4gdGhpcyBjYXNlLmApKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9nZXRFbnRyeUNvbXBvbmVudHNGcm9tUHJvdmlkZXIocHJvdmlkZXI6IGNwbC5Qcm92aWRlck1ldGEsIHR5cGU/OiBhbnkpOlxuICAgICAgY3BsLkNvbXBpbGVFbnRyeUNvbXBvbmVudE1ldGFkYXRhW10ge1xuICAgIGNvbnN0IGNvbXBvbmVudHM6IGNwbC5Db21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdID0gW107XG4gICAgY29uc3QgY29sbGVjdGVkSWRlbnRpZmllcnM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10gPSBbXTtcblxuICAgIGlmIChwcm92aWRlci51c2VGYWN0b3J5IHx8IHByb3ZpZGVyLnVzZUV4aXN0aW5nIHx8IHByb3ZpZGVyLnVzZUNsYXNzKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBzeW50YXhFcnJvcihgVGhlIEFOQUxZWkVfRk9SX0VOVFJZX0NPTVBPTkVOVFMgdG9rZW4gb25seSBzdXBwb3J0cyB1c2VWYWx1ZSFgKSwgdHlwZSk7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgaWYgKCFwcm92aWRlci5tdWx0aSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoYFRoZSBBTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTIHRva2VuIG9ubHkgc3VwcG9ydHMgJ211bHRpID0gdHJ1ZSchYCksXG4gICAgICAgICAgdHlwZSk7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgZXh0cmFjdElkZW50aWZpZXJzKHByb3ZpZGVyLnVzZVZhbHVlLCBjb2xsZWN0ZWRJZGVudGlmaWVycyk7XG4gICAgY29sbGVjdGVkSWRlbnRpZmllcnMuZm9yRWFjaCgoaWRlbnRpZmllcikgPT4ge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLl9nZXRFbnRyeUNvbXBvbmVudE1ldGFkYXRhKGlkZW50aWZpZXIucmVmZXJlbmNlLCBmYWxzZSk7XG4gICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgY29tcG9uZW50cy5wdXNoKGVudHJ5KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gY29tcG9uZW50cztcbiAgfVxuXG4gIHByaXZhdGUgX2dldEVudHJ5Q29tcG9uZW50TWV0YWRhdGEoZGlyVHlwZTogYW55LCB0aHJvd0lmTm90Rm91bmQgPSB0cnVlKTpcbiAgICAgIGNwbC5Db21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YXxudWxsIHtcbiAgICBjb25zdCBkaXJNZXRhID0gdGhpcy5nZXROb25Ob3JtYWxpemVkRGlyZWN0aXZlTWV0YWRhdGEoZGlyVHlwZSk7XG4gICAgaWYgKGRpck1ldGEgJiYgZGlyTWV0YS5tZXRhZGF0YS5pc0NvbXBvbmVudCkge1xuICAgICAgcmV0dXJuIHtjb21wb25lbnRUeXBlOiBkaXJUeXBlLCBjb21wb25lbnRGYWN0b3J5OiBkaXJNZXRhLm1ldGFkYXRhLmNvbXBvbmVudEZhY3RvcnkhfTtcbiAgICB9XG4gICAgY29uc3QgZGlyU3VtbWFyeSA9XG4gICAgICAgIDxjcGwuQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnk+dGhpcy5fbG9hZFN1bW1hcnkoZGlyVHlwZSwgY3BsLkNvbXBpbGVTdW1tYXJ5S2luZC5EaXJlY3RpdmUpO1xuICAgIGlmIChkaXJTdW1tYXJ5ICYmIGRpclN1bW1hcnkuaXNDb21wb25lbnQpIHtcbiAgICAgIHJldHVybiB7Y29tcG9uZW50VHlwZTogZGlyVHlwZSwgY29tcG9uZW50RmFjdG9yeTogZGlyU3VtbWFyeS5jb21wb25lbnRGYWN0b3J5IX07XG4gICAgfVxuICAgIGlmICh0aHJvd0lmTm90Rm91bmQpIHtcbiAgICAgIHRocm93IHN5bnRheEVycm9yKGAke2RpclR5cGUubmFtZX0gY2Fubm90IGJlIHVzZWQgYXMgYW4gZW50cnkgY29tcG9uZW50LmApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldEluamVjdGFibGVUeXBlTWV0YWRhdGEodHlwZTogVHlwZSwgZGVwZW5kZW5jaWVzOiBhbnlbXXxudWxsID0gbnVsbCk6XG4gICAgICBjcGwuQ29tcGlsZVR5cGVNZXRhZGF0YSB7XG4gICAgY29uc3QgdHlwZVN1bW1hcnkgPSB0aGlzLl9sb2FkU3VtbWFyeSh0eXBlLCBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLkluamVjdGFibGUpO1xuICAgIGlmICh0eXBlU3VtbWFyeSkge1xuICAgICAgcmV0dXJuIHR5cGVTdW1tYXJ5LnR5cGU7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9nZXRUeXBlTWV0YWRhdGEodHlwZSwgZGVwZW5kZW5jaWVzKTtcbiAgfVxuXG4gIGdldFByb3ZpZGVyTWV0YWRhdGEocHJvdmlkZXI6IGNwbC5Qcm92aWRlck1ldGEpOiBjcGwuQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEge1xuICAgIGxldCBjb21waWxlRGVwczogY3BsLkNvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YVtdID0gdW5kZWZpbmVkITtcbiAgICBsZXQgY29tcGlsZVR5cGVNZXRhZGF0YTogY3BsLkNvbXBpbGVUeXBlTWV0YWRhdGEgPSBudWxsITtcbiAgICBsZXQgY29tcGlsZUZhY3RvcnlNZXRhZGF0YTogY3BsLkNvbXBpbGVGYWN0b3J5TWV0YWRhdGEgPSBudWxsITtcbiAgICBsZXQgdG9rZW46IGNwbC5Db21waWxlVG9rZW5NZXRhZGF0YSA9IHRoaXMuX2dldFRva2VuTWV0YWRhdGEocHJvdmlkZXIudG9rZW4pO1xuXG4gICAgaWYgKHByb3ZpZGVyLnVzZUNsYXNzKSB7XG4gICAgICBjb21waWxlVHlwZU1ldGFkYXRhID1cbiAgICAgICAgICB0aGlzLl9nZXRJbmplY3RhYmxlVHlwZU1ldGFkYXRhKHByb3ZpZGVyLnVzZUNsYXNzLCBwcm92aWRlci5kZXBlbmRlbmNpZXMpO1xuICAgICAgY29tcGlsZURlcHMgPSBjb21waWxlVHlwZU1ldGFkYXRhLmRpRGVwcztcbiAgICAgIGlmIChwcm92aWRlci50b2tlbiA9PT0gcHJvdmlkZXIudXNlQ2xhc3MpIHtcbiAgICAgICAgLy8gdXNlIHRoZSBjb21waWxlVHlwZU1ldGFkYXRhIGFzIGl0IGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IGxpZmVjeWNsZUhvb2tzLi4uXG4gICAgICAgIHRva2VuID0ge2lkZW50aWZpZXI6IGNvbXBpbGVUeXBlTWV0YWRhdGF9O1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvdmlkZXIudXNlRmFjdG9yeSkge1xuICAgICAgY29tcGlsZUZhY3RvcnlNZXRhZGF0YSA9IHRoaXMuX2dldEZhY3RvcnlNZXRhZGF0YShwcm92aWRlci51c2VGYWN0b3J5LCBwcm92aWRlci5kZXBlbmRlbmNpZXMpO1xuICAgICAgY29tcGlsZURlcHMgPSBjb21waWxlRmFjdG9yeU1ldGFkYXRhLmRpRGVwcztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG9rZW46IHRva2VuLFxuICAgICAgdXNlQ2xhc3M6IGNvbXBpbGVUeXBlTWV0YWRhdGEsXG4gICAgICB1c2VWYWx1ZTogcHJvdmlkZXIudXNlVmFsdWUsXG4gICAgICB1c2VGYWN0b3J5OiBjb21waWxlRmFjdG9yeU1ldGFkYXRhLFxuICAgICAgdXNlRXhpc3Rpbmc6IHByb3ZpZGVyLnVzZUV4aXN0aW5nID8gdGhpcy5fZ2V0VG9rZW5NZXRhZGF0YShwcm92aWRlci51c2VFeGlzdGluZykgOiB1bmRlZmluZWQsXG4gICAgICBkZXBzOiBjb21waWxlRGVwcyxcbiAgICAgIG11bHRpOiBwcm92aWRlci5tdWx0aVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9nZXRRdWVyaWVzTWV0YWRhdGEoXG4gICAgICBxdWVyaWVzOiB7W2tleTogc3RyaW5nXTogUXVlcnl9LCBpc1ZpZXdRdWVyeTogYm9vbGVhbixcbiAgICAgIGRpcmVjdGl2ZVR5cGU6IFR5cGUpOiBjcGwuQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSB7XG4gICAgY29uc3QgcmVzOiBjcGwuQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSA9IFtdO1xuXG4gICAgT2JqZWN0LmtleXMocXVlcmllcykuZm9yRWFjaCgocHJvcGVydHlOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gcXVlcmllc1twcm9wZXJ0eU5hbWVdO1xuICAgICAgaWYgKHF1ZXJ5LmlzVmlld1F1ZXJ5ID09PSBpc1ZpZXdRdWVyeSkge1xuICAgICAgICByZXMucHVzaCh0aGlzLl9nZXRRdWVyeU1ldGFkYXRhKHF1ZXJ5LCBwcm9wZXJ0eU5hbWUsIGRpcmVjdGl2ZVR5cGUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBwcml2YXRlIF9xdWVyeVZhckJpbmRpbmdzKHNlbGVjdG9yOiBhbnkpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHNlbGVjdG9yLnNwbGl0KC9cXHMqLFxccyovKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFF1ZXJ5TWV0YWRhdGEocTogUXVlcnksIHByb3BlcnR5TmFtZTogc3RyaW5nLCB0eXBlT3JGdW5jOiBUeXBlfEZ1bmN0aW9uKTpcbiAgICAgIGNwbC5Db21waWxlUXVlcnlNZXRhZGF0YSB7XG4gICAgbGV0IHNlbGVjdG9yczogY3BsLkNvbXBpbGVUb2tlbk1ldGFkYXRhW107XG4gICAgaWYgKHR5cGVvZiBxLnNlbGVjdG9yID09PSAnc3RyaW5nJykge1xuICAgICAgc2VsZWN0b3JzID1cbiAgICAgICAgICB0aGlzLl9xdWVyeVZhckJpbmRpbmdzKHEuc2VsZWN0b3IpLm1hcCh2YXJOYW1lID0+IHRoaXMuX2dldFRva2VuTWV0YWRhdGEodmFyTmFtZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXEuc2VsZWN0b3IpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICBzeW50YXhFcnJvcihgQ2FuJ3QgY29uc3RydWN0IGEgcXVlcnkgZm9yIHRoZSBwcm9wZXJ0eSBcIiR7cHJvcGVydHlOYW1lfVwiIG9mIFwiJHtcbiAgICAgICAgICAgICAgICBzdHJpbmdpZnlUeXBlKHR5cGVPckZ1bmMpfVwiIHNpbmNlIHRoZSBxdWVyeSBzZWxlY3RvciB3YXNuJ3QgZGVmaW5lZC5gKSxcbiAgICAgICAgICAgIHR5cGVPckZ1bmMpO1xuICAgICAgICBzZWxlY3RvcnMgPSBbXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGVjdG9ycyA9IFt0aGlzLl9nZXRUb2tlbk1ldGFkYXRhKHEuc2VsZWN0b3IpXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc2VsZWN0b3JzLFxuICAgICAgZmlyc3Q6IHEuZmlyc3QsXG4gICAgICBkZXNjZW5kYW50czogcS5kZXNjZW5kYW50cyxcbiAgICAgIHByb3BlcnR5TmFtZSxcbiAgICAgIHJlYWQ6IHEucmVhZCA/IHRoaXMuX2dldFRva2VuTWV0YWRhdGEocS5yZWFkKSA6IG51bGwhLFxuICAgICAgc3RhdGljOiBxLnN0YXRpY1xuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihlcnJvcjogYW55LCB0eXBlPzogYW55LCBvdGhlclR5cGU/OiBhbnkpIHtcbiAgICBpZiAodGhpcy5fZXJyb3JDb2xsZWN0b3IpIHtcbiAgICAgIHRoaXMuX2Vycm9yQ29sbGVjdG9yKGVycm9yLCB0eXBlKTtcbiAgICAgIGlmIChvdGhlclR5cGUpIHtcbiAgICAgICAgdGhpcy5fZXJyb3JDb2xsZWN0b3IoZXJyb3IsIG90aGVyVHlwZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmbGF0dGVuQXJyYXkodHJlZTogYW55W10sIG91dDogQXJyYXk8YW55PiA9IFtdKTogQXJyYXk8YW55PiB7XG4gIGlmICh0cmVlKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gcmVzb2x2ZUZvcndhcmRSZWYodHJlZVtpXSk7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuICAgICAgICBmbGF0dGVuQXJyYXkoaXRlbSwgb3V0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dC5wdXNoKGl0ZW0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBkZWR1cGVBcnJheShhcnJheTogYW55W10pOiBBcnJheTxhbnk+IHtcbiAgaWYgKGFycmF5KSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20obmV3IFNldChhcnJheSkpO1xuICB9XG4gIHJldHVybiBbXTtcbn1cblxuZnVuY3Rpb24gZmxhdHRlbkFuZERlZHVwZUFycmF5KHRyZWU6IGFueVtdKTogQXJyYXk8YW55PiB7XG4gIHJldHVybiBkZWR1cGVBcnJheShmbGF0dGVuQXJyYXkodHJlZSkpO1xufVxuXG5mdW5jdGlvbiBpc1ZhbGlkVHlwZSh2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiAodmFsdWUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHx8ICh2YWx1ZSBpbnN0YW5jZW9mIFR5cGUpO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0SWRlbnRpZmllcnModmFsdWU6IGFueSwgdGFyZ2V0SWRlbnRpZmllcnM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10pIHtcbiAgdmlzaXRWYWx1ZSh2YWx1ZSwgbmV3IF9Db21waWxlVmFsdWVDb252ZXJ0ZXIoKSwgdGFyZ2V0SWRlbnRpZmllcnMpO1xufVxuXG5jbGFzcyBfQ29tcGlsZVZhbHVlQ29udmVydGVyIGV4dGVuZHMgVmFsdWVUcmFuc2Zvcm1lciB7XG4gIHZpc2l0T3RoZXIodmFsdWU6IGFueSwgdGFyZ2V0SWRlbnRpZmllcnM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10pOiBhbnkge1xuICAgIHRhcmdldElkZW50aWZpZXJzLnB1c2goe3JlZmVyZW5jZTogdmFsdWV9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlUeXBlKHR5cGU6IGFueSk6IHN0cmluZyB7XG4gIGlmICh0eXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgcmV0dXJuIGAke3R5cGUubmFtZX0gaW4gJHt0eXBlLmZpbGVQYXRofWA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0cmluZ2lmeSh0eXBlKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZGljYXRlcyB0aGF0IGEgY29tcG9uZW50IGlzIHN0aWxsIGJlaW5nIGxvYWRlZCBpbiBhIHN5bmNocm9ub3VzIGNvbXBpbGUuXG4gKi9cbmZ1bmN0aW9uIGNvbXBvbmVudFN0aWxsTG9hZGluZ0Vycm9yKGNvbXBUeXBlOiBUeXBlKSB7XG4gIGNvbnN0IGVycm9yID1cbiAgICAgIEVycm9yKGBDYW4ndCBjb21waWxlIHN5bmNocm9ub3VzbHkgYXMgJHtzdHJpbmdpZnkoY29tcFR5cGUpfSBpcyBzdGlsbCBiZWluZyBsb2FkZWQhYCk7XG4gIChlcnJvciBhcyBhbnkpW0VSUk9SX0NPTVBPTkVOVF9UWVBFXSA9IGNvbXBUeXBlO1xuICByZXR1cm4gZXJyb3I7XG59XG4iXX0=