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
        define("@angular/compiler/src/metadata_resolver", ["require", "exports", "tslib", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/aot/util", "@angular/compiler/src/assertions", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/core", "@angular/compiler/src/directive_resolver", "@angular/compiler/src/identifiers", "@angular/compiler/src/lifecycle_reflector", "@angular/compiler/src/selector", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var static_symbol_1 = require("@angular/compiler/src/aot/static_symbol");
    var util_1 = require("@angular/compiler/src/aot/util");
    var assertions_1 = require("@angular/compiler/src/assertions");
    var cpl = require("@angular/compiler/src/compile_metadata");
    var core_1 = require("@angular/compiler/src/core");
    var directive_resolver_1 = require("@angular/compiler/src/directive_resolver");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var lifecycle_reflector_1 = require("@angular/compiler/src/lifecycle_reflector");
    var selector_1 = require("@angular/compiler/src/selector");
    var util_2 = require("@angular/compiler/src/util");
    exports.ERROR_COMPONENT_TYPE = 'ngComponentType';
    // Design notes:
    // - don't lazily create metadata:
    //   For some metadata, we need to do async work sometimes,
    //   so the user has to kick off this loading.
    //   But we want to report errors even when the async work is
    //   not required to check that the user would have been able
    //   to wait correctly.
    var CompileMetadataResolver = /** @class */ (function () {
        function CompileMetadataResolver(_config, _htmlParser, _ngModuleResolver, _directiveResolver, _pipeResolver, _summaryResolver, _schemaRegistry, _directiveNormalizer, _console, _staticSymbolCache, _reflector, _errorCollector) {
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
        CompileMetadataResolver.prototype.getReflector = function () { return this._reflector; };
        CompileMetadataResolver.prototype.clearCacheFor = function (type) {
            var dirMeta = this._directiveCache.get(type);
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
        };
        CompileMetadataResolver.prototype.clearCache = function () {
            this._directiveCache.clear();
            this._nonNormalizedDirectiveCache.clear();
            this._summaryCache.clear();
            this._pipeCache.clear();
            this._ngModuleCache.clear();
            this._ngModuleOfTypes.clear();
            this._directiveNormalizer.clearCache();
        };
        CompileMetadataResolver.prototype._createProxyClass = function (baseType, name) {
            var delegate = null;
            var proxyClass = function () {
                if (!delegate) {
                    throw new Error("Illegal state: Class " + name + " for type " + util_2.stringify(baseType) + " is not compiled yet!");
                }
                return delegate.apply(this, arguments);
            };
            proxyClass.setDelegate = function (d) {
                delegate = d;
                proxyClass.prototype = d.prototype;
            };
            // Make stringify work correctly
            proxyClass.overriddenName = name;
            return proxyClass;
        };
        CompileMetadataResolver.prototype.getGeneratedClass = function (dirType, name) {
            if (dirType instanceof static_symbol_1.StaticSymbol) {
                return this._staticSymbolCache.get(util_1.ngfactoryFilePath(dirType.filePath), name);
            }
            else {
                return this._createProxyClass(dirType, name);
            }
        };
        CompileMetadataResolver.prototype.getComponentViewClass = function (dirType) {
            return this.getGeneratedClass(dirType, cpl.viewClassName(dirType, 0));
        };
        CompileMetadataResolver.prototype.getHostComponentViewClass = function (dirType) {
            return this.getGeneratedClass(dirType, cpl.hostViewClassName(dirType));
        };
        CompileMetadataResolver.prototype.getHostComponentType = function (dirType) {
            var name = cpl.identifierName({ reference: dirType }) + "_Host";
            if (dirType instanceof static_symbol_1.StaticSymbol) {
                return this._staticSymbolCache.get(dirType.filePath, name);
            }
            return this._createProxyClass(dirType, name);
        };
        CompileMetadataResolver.prototype.getRendererType = function (dirType) {
            if (dirType instanceof static_symbol_1.StaticSymbol) {
                return this._staticSymbolCache.get(util_1.ngfactoryFilePath(dirType.filePath), cpl.rendererTypeName(dirType));
            }
            else {
                // returning an object as proxy,
                // that we fill later during runtime compilation.
                return {};
            }
        };
        CompileMetadataResolver.prototype.getComponentFactory = function (selector, dirType, inputs, outputs) {
            if (dirType instanceof static_symbol_1.StaticSymbol) {
                return this._staticSymbolCache.get(util_1.ngfactoryFilePath(dirType.filePath), cpl.componentFactoryName(dirType));
            }
            else {
                var hostView = this.getHostComponentViewClass(dirType);
                // Note: ngContentSelectors will be filled later once the template is
                // loaded.
                var createComponentFactory = this._reflector.resolveExternalReference(identifiers_1.Identifiers.createComponentFactory);
                return createComponentFactory(selector, dirType, hostView, inputs, outputs, []);
            }
        };
        CompileMetadataResolver.prototype.initComponentFactory = function (factory, ngContentSelectors) {
            var _a;
            if (!(factory instanceof static_symbol_1.StaticSymbol)) {
                (_a = factory.ngContentSelectors).push.apply(_a, tslib_1.__spread(ngContentSelectors));
            }
        };
        CompileMetadataResolver.prototype._loadSummary = function (type, kind) {
            var typeSummary = this._summaryCache.get(type);
            if (!typeSummary) {
                var summary = this._summaryResolver.resolveSummary(type);
                typeSummary = summary ? summary.type : null;
                this._summaryCache.set(type, typeSummary || null);
            }
            return typeSummary && typeSummary.summaryKind === kind ? typeSummary : null;
        };
        CompileMetadataResolver.prototype.getHostComponentMetadata = function (compMeta, hostViewType) {
            var hostType = this.getHostComponentType(compMeta.type.reference);
            if (!hostViewType) {
                hostViewType = this.getHostComponentViewClass(hostType);
            }
            // Note: ! is ok here as this method should only be called with normalized directive
            // metadata, which always fills in the selector.
            var template = selector_1.CssSelector.parse(compMeta.selector)[0].getMatchingElementTemplate();
            var templateUrl = '';
            var htmlAst = this._htmlParser.parse(template, templateUrl);
            return cpl.CompileDirectiveMetadata.create({
                isHost: true,
                type: { reference: hostType, diDeps: [], lifecycleHooks: [] },
                template: new cpl.CompileTemplateMetadata({
                    encapsulation: core_1.ViewEncapsulation.None,
                    template: template,
                    templateUrl: templateUrl,
                    htmlAst: htmlAst,
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
                changeDetection: core_1.ChangeDetectionStrategy.Default,
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
                rendererType: { id: '__Host__', encapsulation: core_1.ViewEncapsulation.None, styles: [], data: {} },
                entryComponents: [],
                componentFactory: null
            });
        };
        CompileMetadataResolver.prototype.loadDirectiveMetadata = function (ngModuleType, directiveType, isSync) {
            var _this = this;
            if (this._directiveCache.has(directiveType)) {
                return null;
            }
            directiveType = util_2.resolveForwardRef(directiveType);
            var _a = this.getNonNormalizedDirectiveMetadata(directiveType), annotation = _a.annotation, metadata = _a.metadata;
            var createDirectiveMetadata = function (templateMetadata) {
                var normalizedDirMeta = new cpl.CompileDirectiveMetadata({
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
                    _this.initComponentFactory(metadata.componentFactory, templateMetadata.ngContentSelectors);
                }
                _this._directiveCache.set(directiveType, normalizedDirMeta);
                _this._summaryCache.set(directiveType, normalizedDirMeta.toSummary());
                return null;
            };
            if (metadata.isComponent) {
                var template = metadata.template;
                var templateMeta = this._directiveNormalizer.normalizeTemplate({
                    ngModuleType: ngModuleType,
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
                if (util_2.isPromise(templateMeta) && isSync) {
                    this._reportError(componentStillLoadingError(directiveType), directiveType);
                    return null;
                }
                return util_2.SyncAsync.then(templateMeta, createDirectiveMetadata);
            }
            else {
                // directive
                createDirectiveMetadata(null);
                return null;
            }
        };
        CompileMetadataResolver.prototype.getNonNormalizedDirectiveMetadata = function (directiveType) {
            var _this = this;
            directiveType = util_2.resolveForwardRef(directiveType);
            if (!directiveType) {
                return null;
            }
            var cacheEntry = this._nonNormalizedDirectiveCache.get(directiveType);
            if (cacheEntry) {
                return cacheEntry;
            }
            var dirMeta = this._directiveResolver.resolve(directiveType, false);
            if (!dirMeta) {
                return null;
            }
            var nonNormalizedTemplateMetadata = undefined;
            if (core_1.createComponent.isTypeOf(dirMeta)) {
                // component
                var compMeta = dirMeta;
                assertions_1.assertArrayOfStrings('styles', compMeta.styles);
                assertions_1.assertArrayOfStrings('styleUrls', compMeta.styleUrls);
                assertions_1.assertInterpolationSymbols('interpolation', compMeta.interpolation);
                var animations = compMeta.animations;
                nonNormalizedTemplateMetadata = new cpl.CompileTemplateMetadata({
                    encapsulation: util_2.noUndefined(compMeta.encapsulation),
                    template: util_2.noUndefined(compMeta.template),
                    templateUrl: util_2.noUndefined(compMeta.templateUrl),
                    htmlAst: null,
                    styles: compMeta.styles || [],
                    styleUrls: compMeta.styleUrls || [],
                    animations: animations || [],
                    interpolation: util_2.noUndefined(compMeta.interpolation),
                    isInline: !!compMeta.template,
                    externalStylesheets: [],
                    ngContentSelectors: [],
                    preserveWhitespaces: util_2.noUndefined(dirMeta.preserveWhitespaces),
                });
            }
            var changeDetectionStrategy = null;
            var viewProviders = [];
            var entryComponentMetadata = [];
            var selector = dirMeta.selector;
            if (core_1.createComponent.isTypeOf(dirMeta)) {
                // Component
                var compMeta = dirMeta;
                changeDetectionStrategy = compMeta.changeDetection;
                if (compMeta.viewProviders) {
                    viewProviders = this._getProvidersMetadata(compMeta.viewProviders, entryComponentMetadata, "viewProviders for \"" + stringifyType(directiveType) + "\"", [], directiveType);
                }
                if (compMeta.entryComponents) {
                    entryComponentMetadata = flattenAndDedupeArray(compMeta.entryComponents)
                        .map(function (type) { return _this._getEntryComponentMetadata(type); })
                        .concat(entryComponentMetadata);
                }
                if (!selector) {
                    selector = this._schemaRegistry.getDefaultComponentElementName();
                }
            }
            else {
                // Directive
                if (!selector) {
                    this._reportError(util_2.syntaxError("Directive " + stringifyType(directiveType) + " has no selector, please add it!"), directiveType);
                    selector = 'error';
                }
            }
            var providers = [];
            if (dirMeta.providers != null) {
                providers = this._getProvidersMetadata(dirMeta.providers, entryComponentMetadata, "providers for \"" + stringifyType(directiveType) + "\"", [], directiveType);
            }
            var queries = [];
            var viewQueries = [];
            if (dirMeta.queries != null) {
                queries = this._getQueriesMetadata(dirMeta.queries, false, directiveType);
                viewQueries = this._getQueriesMetadata(dirMeta.queries, true, directiveType);
            }
            var metadata = cpl.CompileDirectiveMetadata.create({
                isHost: false,
                selector: selector,
                exportAs: util_2.noUndefined(dirMeta.exportAs),
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
            cacheEntry = { metadata: metadata, annotation: dirMeta };
            this._nonNormalizedDirectiveCache.set(directiveType, cacheEntry);
            return cacheEntry;
        };
        /**
         * Gets the metadata for the given directive.
         * This assumes `loadNgModuleDirectiveAndPipeMetadata` has been called first.
         */
        CompileMetadataResolver.prototype.getDirectiveMetadata = function (directiveType) {
            var dirMeta = this._directiveCache.get(directiveType);
            if (!dirMeta) {
                this._reportError(util_2.syntaxError("Illegal state: getDirectiveMetadata can only be called after loadNgModuleDirectiveAndPipeMetadata for a module that declares it. Directive " + stringifyType(directiveType) + "."), directiveType);
            }
            return dirMeta;
        };
        CompileMetadataResolver.prototype.getDirectiveSummary = function (dirType) {
            var dirSummary = this._loadSummary(dirType, cpl.CompileSummaryKind.Directive);
            if (!dirSummary) {
                this._reportError(util_2.syntaxError("Illegal state: Could not load the summary for directive " + stringifyType(dirType) + "."), dirType);
            }
            return dirSummary;
        };
        CompileMetadataResolver.prototype.isDirective = function (type) {
            return !!this._loadSummary(type, cpl.CompileSummaryKind.Directive) ||
                this._directiveResolver.isDirective(type);
        };
        CompileMetadataResolver.prototype.isPipe = function (type) {
            return !!this._loadSummary(type, cpl.CompileSummaryKind.Pipe) ||
                this._pipeResolver.isPipe(type);
        };
        CompileMetadataResolver.prototype.isNgModule = function (type) {
            return !!this._loadSummary(type, cpl.CompileSummaryKind.NgModule) ||
                this._ngModuleResolver.isNgModule(type);
        };
        CompileMetadataResolver.prototype.getNgModuleSummary = function (moduleType, alreadyCollecting) {
            if (alreadyCollecting === void 0) { alreadyCollecting = null; }
            var moduleSummary = this._loadSummary(moduleType, cpl.CompileSummaryKind.NgModule);
            if (!moduleSummary) {
                var moduleMeta = this.getNgModuleMetadata(moduleType, false, alreadyCollecting);
                moduleSummary = moduleMeta ? moduleMeta.toSummary() : null;
                if (moduleSummary) {
                    this._summaryCache.set(moduleType, moduleSummary);
                }
            }
            return moduleSummary;
        };
        /**
         * Loads the declared directives and pipes of an NgModule.
         */
        CompileMetadataResolver.prototype.loadNgModuleDirectiveAndPipeMetadata = function (moduleType, isSync, throwIfNotFound) {
            var _this = this;
            if (throwIfNotFound === void 0) { throwIfNotFound = true; }
            var ngModule = this.getNgModuleMetadata(moduleType, throwIfNotFound);
            var loading = [];
            if (ngModule) {
                ngModule.declaredDirectives.forEach(function (id) {
                    var promise = _this.loadDirectiveMetadata(moduleType, id.reference, isSync);
                    if (promise) {
                        loading.push(promise);
                    }
                });
                ngModule.declaredPipes.forEach(function (id) { return _this._loadPipeMetadata(id.reference); });
            }
            return Promise.all(loading);
        };
        CompileMetadataResolver.prototype.getShallowModuleMetadata = function (moduleType) {
            var compileMeta = this._shallowModuleCache.get(moduleType);
            if (compileMeta) {
                return compileMeta;
            }
            var ngModuleMeta = directive_resolver_1.findLast(this._reflector.shallowAnnotations(moduleType), core_1.createNgModule.isTypeOf);
            compileMeta = {
                type: this._getTypeMetadata(moduleType),
                rawExports: ngModuleMeta.exports,
                rawImports: ngModuleMeta.imports,
                rawProviders: ngModuleMeta.providers,
            };
            this._shallowModuleCache.set(moduleType, compileMeta);
            return compileMeta;
        };
        CompileMetadataResolver.prototype.getNgModuleMetadata = function (moduleType, throwIfNotFound, alreadyCollecting) {
            var _this = this;
            if (throwIfNotFound === void 0) { throwIfNotFound = true; }
            if (alreadyCollecting === void 0) { alreadyCollecting = null; }
            moduleType = util_2.resolveForwardRef(moduleType);
            var compileMeta = this._ngModuleCache.get(moduleType);
            if (compileMeta) {
                return compileMeta;
            }
            var meta = this._ngModuleResolver.resolve(moduleType, throwIfNotFound);
            if (!meta) {
                return null;
            }
            var declaredDirectives = [];
            var exportedNonModuleIdentifiers = [];
            var declaredPipes = [];
            var importedModules = [];
            var exportedModules = [];
            var providers = [];
            var entryComponents = [];
            var bootstrapComponents = [];
            var schemas = [];
            if (meta.imports) {
                flattenAndDedupeArray(meta.imports).forEach(function (importedType) {
                    var importedModuleType = undefined;
                    if (isValidType(importedType)) {
                        importedModuleType = importedType;
                    }
                    else if (importedType && importedType.ngModule) {
                        var moduleWithProviders = importedType;
                        importedModuleType = moduleWithProviders.ngModule;
                        if (moduleWithProviders.providers) {
                            providers.push.apply(providers, tslib_1.__spread(_this._getProvidersMetadata(moduleWithProviders.providers, entryComponents, "provider for the NgModule '" + stringifyType(importedModuleType) + "'", [], importedType)));
                        }
                    }
                    if (importedModuleType) {
                        if (_this._checkSelfImport(moduleType, importedModuleType))
                            return;
                        if (!alreadyCollecting)
                            alreadyCollecting = new Set();
                        if (alreadyCollecting.has(importedModuleType)) {
                            _this._reportError(util_2.syntaxError(_this._getTypeDescriptor(importedModuleType) + " '" + stringifyType(importedType) + "' is imported recursively by the module '" + stringifyType(moduleType) + "'."), moduleType);
                            return;
                        }
                        alreadyCollecting.add(importedModuleType);
                        var importedModuleSummary = _this.getNgModuleSummary(importedModuleType, alreadyCollecting);
                        alreadyCollecting.delete(importedModuleType);
                        if (!importedModuleSummary) {
                            _this._reportError(util_2.syntaxError("Unexpected " + _this._getTypeDescriptor(importedType) + " '" + stringifyType(importedType) + "' imported by the module '" + stringifyType(moduleType) + "'. Please add a @NgModule annotation."), moduleType);
                            return;
                        }
                        importedModules.push(importedModuleSummary);
                    }
                    else {
                        _this._reportError(util_2.syntaxError("Unexpected value '" + stringifyType(importedType) + "' imported by the module '" + stringifyType(moduleType) + "'"), moduleType);
                        return;
                    }
                });
            }
            if (meta.exports) {
                flattenAndDedupeArray(meta.exports).forEach(function (exportedType) {
                    if (!isValidType(exportedType)) {
                        _this._reportError(util_2.syntaxError("Unexpected value '" + stringifyType(exportedType) + "' exported by the module '" + stringifyType(moduleType) + "'"), moduleType);
                        return;
                    }
                    if (!alreadyCollecting)
                        alreadyCollecting = new Set();
                    if (alreadyCollecting.has(exportedType)) {
                        _this._reportError(util_2.syntaxError(_this._getTypeDescriptor(exportedType) + " '" + util_2.stringify(exportedType) + "' is exported recursively by the module '" + stringifyType(moduleType) + "'"), moduleType);
                        return;
                    }
                    alreadyCollecting.add(exportedType);
                    var exportedModuleSummary = _this.getNgModuleSummary(exportedType, alreadyCollecting);
                    alreadyCollecting.delete(exportedType);
                    if (exportedModuleSummary) {
                        exportedModules.push(exportedModuleSummary);
                    }
                    else {
                        exportedNonModuleIdentifiers.push(_this._getIdentifierMetadata(exportedType));
                    }
                });
            }
            // Note: This will be modified later, so we rely on
            // getting a new instance every time!
            var transitiveModule = this._getTransitiveNgModuleMetadata(importedModules, exportedModules);
            if (meta.declarations) {
                flattenAndDedupeArray(meta.declarations).forEach(function (declaredType) {
                    if (!isValidType(declaredType)) {
                        _this._reportError(util_2.syntaxError("Unexpected value '" + stringifyType(declaredType) + "' declared by the module '" + stringifyType(moduleType) + "'"), moduleType);
                        return;
                    }
                    var declaredIdentifier = _this._getIdentifierMetadata(declaredType);
                    if (_this.isDirective(declaredType)) {
                        transitiveModule.addDirective(declaredIdentifier);
                        declaredDirectives.push(declaredIdentifier);
                        _this._addTypeToModule(declaredType, moduleType);
                    }
                    else if (_this.isPipe(declaredType)) {
                        transitiveModule.addPipe(declaredIdentifier);
                        transitiveModule.pipes.push(declaredIdentifier);
                        declaredPipes.push(declaredIdentifier);
                        _this._addTypeToModule(declaredType, moduleType);
                    }
                    else {
                        _this._reportError(util_2.syntaxError("Unexpected " + _this._getTypeDescriptor(declaredType) + " '" + stringifyType(declaredType) + "' declared by the module '" + stringifyType(moduleType) + "'. Please add a @Pipe/@Directive/@Component annotation."), moduleType);
                        return;
                    }
                });
            }
            var exportedDirectives = [];
            var exportedPipes = [];
            exportedNonModuleIdentifiers.forEach(function (exportedId) {
                if (transitiveModule.directivesSet.has(exportedId.reference)) {
                    exportedDirectives.push(exportedId);
                    transitiveModule.addExportedDirective(exportedId);
                }
                else if (transitiveModule.pipesSet.has(exportedId.reference)) {
                    exportedPipes.push(exportedId);
                    transitiveModule.addExportedPipe(exportedId);
                }
                else {
                    _this._reportError(util_2.syntaxError("Can't export " + _this._getTypeDescriptor(exportedId.reference) + " " + stringifyType(exportedId.reference) + " from " + stringifyType(moduleType) + " as it was neither declared nor imported!"), moduleType);
                    return;
                }
            });
            // The providers of the module have to go last
            // so that they overwrite any other provider we already added.
            if (meta.providers) {
                providers.push.apply(providers, tslib_1.__spread(this._getProvidersMetadata(meta.providers, entryComponents, "provider for the NgModule '" + stringifyType(moduleType) + "'", [], moduleType)));
            }
            if (meta.entryComponents) {
                entryComponents.push.apply(entryComponents, tslib_1.__spread(flattenAndDedupeArray(meta.entryComponents)
                    .map(function (type) { return _this._getEntryComponentMetadata(type); })));
            }
            if (meta.bootstrap) {
                flattenAndDedupeArray(meta.bootstrap).forEach(function (type) {
                    if (!isValidType(type)) {
                        _this._reportError(util_2.syntaxError("Unexpected value '" + stringifyType(type) + "' used in the bootstrap property of module '" + stringifyType(moduleType) + "'"), moduleType);
                        return;
                    }
                    bootstrapComponents.push(_this._getIdentifierMetadata(type));
                });
            }
            entryComponents.push.apply(entryComponents, tslib_1.__spread(bootstrapComponents.map(function (type) { return _this._getEntryComponentMetadata(type.reference); })));
            if (meta.schemas) {
                schemas.push.apply(schemas, tslib_1.__spread(flattenAndDedupeArray(meta.schemas)));
            }
            compileMeta = new cpl.CompileNgModuleMetadata({
                type: this._getTypeMetadata(moduleType),
                providers: providers,
                entryComponents: entryComponents,
                bootstrapComponents: bootstrapComponents,
                schemas: schemas,
                declaredDirectives: declaredDirectives,
                exportedDirectives: exportedDirectives,
                declaredPipes: declaredPipes,
                exportedPipes: exportedPipes,
                importedModules: importedModules,
                exportedModules: exportedModules,
                transitiveModule: transitiveModule,
                id: meta.id || null,
            });
            entryComponents.forEach(function (id) { return transitiveModule.addEntryComponent(id); });
            providers.forEach(function (provider) { return transitiveModule.addProvider(provider, compileMeta.type); });
            transitiveModule.addModule(compileMeta.type);
            this._ngModuleCache.set(moduleType, compileMeta);
            return compileMeta;
        };
        CompileMetadataResolver.prototype._checkSelfImport = function (moduleType, importedModuleType) {
            if (moduleType === importedModuleType) {
                this._reportError(util_2.syntaxError("'" + stringifyType(moduleType) + "' module can't import itself"), moduleType);
                return true;
            }
            return false;
        };
        CompileMetadataResolver.prototype._getTypeDescriptor = function (type) {
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
        };
        CompileMetadataResolver.prototype._addTypeToModule = function (type, moduleType) {
            var oldModule = this._ngModuleOfTypes.get(type);
            if (oldModule && oldModule !== moduleType) {
                this._reportError(util_2.syntaxError("Type " + stringifyType(type) + " is part of the declarations of 2 modules: " + stringifyType(oldModule) + " and " + stringifyType(moduleType) + "! " +
                    ("Please consider moving " + stringifyType(type) + " to a higher module that imports " + stringifyType(oldModule) + " and " + stringifyType(moduleType) + ". ") +
                    ("You can also create a new NgModule that exports and includes " + stringifyType(type) + " then import that NgModule in " + stringifyType(oldModule) + " and " + stringifyType(moduleType) + ".")), moduleType);
                return;
            }
            this._ngModuleOfTypes.set(type, moduleType);
        };
        CompileMetadataResolver.prototype._getTransitiveNgModuleMetadata = function (importedModules, exportedModules) {
            // collect `providers` / `entryComponents` from all imported and all exported modules
            var result = new cpl.TransitiveCompileNgModuleMetadata();
            var modulesByToken = new Map();
            importedModules.concat(exportedModules).forEach(function (modSummary) {
                modSummary.modules.forEach(function (mod) { return result.addModule(mod); });
                modSummary.entryComponents.forEach(function (comp) { return result.addEntryComponent(comp); });
                var addedTokens = new Set();
                modSummary.providers.forEach(function (entry) {
                    var tokenRef = cpl.tokenReference(entry.provider.token);
                    var prevModules = modulesByToken.get(tokenRef);
                    if (!prevModules) {
                        prevModules = new Set();
                        modulesByToken.set(tokenRef, prevModules);
                    }
                    var moduleRef = entry.module.reference;
                    // Note: the providers of one module may still contain multiple providers
                    // per token (e.g. for multi providers), and we need to preserve these.
                    if (addedTokens.has(tokenRef) || !prevModules.has(moduleRef)) {
                        prevModules.add(moduleRef);
                        addedTokens.add(tokenRef);
                        result.addProvider(entry.provider, entry.module);
                    }
                });
            });
            exportedModules.forEach(function (modSummary) {
                modSummary.exportedDirectives.forEach(function (id) { return result.addExportedDirective(id); });
                modSummary.exportedPipes.forEach(function (id) { return result.addExportedPipe(id); });
            });
            importedModules.forEach(function (modSummary) {
                modSummary.exportedDirectives.forEach(function (id) { return result.addDirective(id); });
                modSummary.exportedPipes.forEach(function (id) { return result.addPipe(id); });
            });
            return result;
        };
        CompileMetadataResolver.prototype._getIdentifierMetadata = function (type) {
            type = util_2.resolveForwardRef(type);
            return { reference: type };
        };
        CompileMetadataResolver.prototype.isInjectable = function (type) {
            var annotations = this._reflector.tryAnnotations(type);
            return annotations.some(function (ann) { return core_1.createInjectable.isTypeOf(ann); });
        };
        CompileMetadataResolver.prototype.getInjectableSummary = function (type) {
            return {
                summaryKind: cpl.CompileSummaryKind.Injectable,
                type: this._getTypeMetadata(type, null, false)
            };
        };
        CompileMetadataResolver.prototype.getInjectableMetadata = function (type, dependencies, throwOnUnknownDeps) {
            if (dependencies === void 0) { dependencies = null; }
            if (throwOnUnknownDeps === void 0) { throwOnUnknownDeps = true; }
            var typeSummary = this._loadSummary(type, cpl.CompileSummaryKind.Injectable);
            var typeMetadata = typeSummary ?
                typeSummary.type :
                this._getTypeMetadata(type, dependencies, throwOnUnknownDeps);
            var annotations = this._reflector.annotations(type).filter(function (ann) { return core_1.createInjectable.isTypeOf(ann); });
            if (annotations.length === 0) {
                return null;
            }
            var meta = annotations[annotations.length - 1];
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
        };
        CompileMetadataResolver.prototype._getTypeMetadata = function (type, dependencies, throwOnUnknownDeps) {
            if (dependencies === void 0) { dependencies = null; }
            if (throwOnUnknownDeps === void 0) { throwOnUnknownDeps = true; }
            var identifier = this._getIdentifierMetadata(type);
            return {
                reference: identifier.reference,
                diDeps: this._getDependenciesMetadata(identifier.reference, dependencies, throwOnUnknownDeps),
                lifecycleHooks: lifecycle_reflector_1.getAllLifecycleHooks(this._reflector, identifier.reference),
            };
        };
        CompileMetadataResolver.prototype._getFactoryMetadata = function (factory, dependencies) {
            if (dependencies === void 0) { dependencies = null; }
            factory = util_2.resolveForwardRef(factory);
            return { reference: factory, diDeps: this._getDependenciesMetadata(factory, dependencies) };
        };
        /**
         * Gets the metadata for the given pipe.
         * This assumes `loadNgModuleDirectiveAndPipeMetadata` has been called first.
         */
        CompileMetadataResolver.prototype.getPipeMetadata = function (pipeType) {
            var pipeMeta = this._pipeCache.get(pipeType);
            if (!pipeMeta) {
                this._reportError(util_2.syntaxError("Illegal state: getPipeMetadata can only be called after loadNgModuleDirectiveAndPipeMetadata for a module that declares it. Pipe " + stringifyType(pipeType) + "."), pipeType);
            }
            return pipeMeta || null;
        };
        CompileMetadataResolver.prototype.getPipeSummary = function (pipeType) {
            var pipeSummary = this._loadSummary(pipeType, cpl.CompileSummaryKind.Pipe);
            if (!pipeSummary) {
                this._reportError(util_2.syntaxError("Illegal state: Could not load the summary for pipe " + stringifyType(pipeType) + "."), pipeType);
            }
            return pipeSummary;
        };
        CompileMetadataResolver.prototype.getOrLoadPipeMetadata = function (pipeType) {
            var pipeMeta = this._pipeCache.get(pipeType);
            if (!pipeMeta) {
                pipeMeta = this._loadPipeMetadata(pipeType);
            }
            return pipeMeta;
        };
        CompileMetadataResolver.prototype._loadPipeMetadata = function (pipeType) {
            pipeType = util_2.resolveForwardRef(pipeType);
            var pipeAnnotation = this._pipeResolver.resolve(pipeType);
            var pipeMeta = new cpl.CompilePipeMetadata({
                type: this._getTypeMetadata(pipeType),
                name: pipeAnnotation.name,
                pure: !!pipeAnnotation.pure
            });
            this._pipeCache.set(pipeType, pipeMeta);
            this._summaryCache.set(pipeType, pipeMeta.toSummary());
            return pipeMeta;
        };
        CompileMetadataResolver.prototype._getDependenciesMetadata = function (typeOrFunc, dependencies, throwOnUnknownDeps) {
            var _this = this;
            if (throwOnUnknownDeps === void 0) { throwOnUnknownDeps = true; }
            var hasUnknownDeps = false;
            var params = dependencies || this._reflector.parameters(typeOrFunc) || [];
            var dependenciesMetadata = params.map(function (param) {
                var isAttribute = false;
                var isHost = false;
                var isSelf = false;
                var isSkipSelf = false;
                var isOptional = false;
                var token = null;
                if (Array.isArray(param)) {
                    param.forEach(function (paramEntry) {
                        if (core_1.createHost.isTypeOf(paramEntry)) {
                            isHost = true;
                        }
                        else if (core_1.createSelf.isTypeOf(paramEntry)) {
                            isSelf = true;
                        }
                        else if (core_1.createSkipSelf.isTypeOf(paramEntry)) {
                            isSkipSelf = true;
                        }
                        else if (core_1.createOptional.isTypeOf(paramEntry)) {
                            isOptional = true;
                        }
                        else if (core_1.createAttribute.isTypeOf(paramEntry)) {
                            isAttribute = true;
                            token = paramEntry.attributeName;
                        }
                        else if (core_1.createInject.isTypeOf(paramEntry)) {
                            token = paramEntry.token;
                        }
                        else if (core_1.createInjectionToken.isTypeOf(paramEntry) || paramEntry instanceof static_symbol_1.StaticSymbol) {
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
                    return null;
                }
                return {
                    isAttribute: isAttribute,
                    isHost: isHost,
                    isSelf: isSelf,
                    isSkipSelf: isSkipSelf,
                    isOptional: isOptional,
                    token: _this._getTokenMetadata(token)
                };
            });
            if (hasUnknownDeps) {
                var depsTokens = dependenciesMetadata.map(function (dep) { return dep ? stringifyType(dep.token) : '?'; }).join(', ');
                var message = "Can't resolve all parameters for " + stringifyType(typeOrFunc) + ": (" + depsTokens + ").";
                if (throwOnUnknownDeps || this._config.strictInjectionParameters) {
                    this._reportError(util_2.syntaxError(message), typeOrFunc);
                }
                else {
                    this._console.warn("Warning: " + message + " This will become an error in Angular v6.x");
                }
            }
            return dependenciesMetadata;
        };
        CompileMetadataResolver.prototype._getTokenMetadata = function (token) {
            token = util_2.resolveForwardRef(token);
            var compileToken;
            if (typeof token === 'string') {
                compileToken = { value: token };
            }
            else {
                compileToken = { identifier: { reference: token } };
            }
            return compileToken;
        };
        CompileMetadataResolver.prototype._getProvidersMetadata = function (providers, targetEntryComponents, debugInfo, compileProviders, type) {
            var _this = this;
            if (compileProviders === void 0) { compileProviders = []; }
            providers.forEach(function (provider, providerIdx) {
                if (Array.isArray(provider)) {
                    _this._getProvidersMetadata(provider, targetEntryComponents, debugInfo, compileProviders);
                }
                else {
                    provider = util_2.resolveForwardRef(provider);
                    var providerMeta = undefined;
                    if (provider && typeof provider === 'object' && provider.hasOwnProperty('provide')) {
                        _this._validateProvider(provider);
                        providerMeta = new cpl.ProviderMeta(provider.provide, provider);
                    }
                    else if (isValidType(provider)) {
                        providerMeta = new cpl.ProviderMeta(provider, { useClass: provider });
                    }
                    else if (provider === void 0) {
                        _this._reportError(util_2.syntaxError("Encountered undefined provider! Usually this means you have a circular dependencies. This might be caused by using 'barrel' index.ts files."));
                        return;
                    }
                    else {
                        var providersInfo = providers.reduce(function (soFar, seenProvider, seenProviderIdx) {
                            if (seenProviderIdx < providerIdx) {
                                soFar.push("" + stringifyType(seenProvider));
                            }
                            else if (seenProviderIdx == providerIdx) {
                                soFar.push("?" + stringifyType(seenProvider) + "?");
                            }
                            else if (seenProviderIdx == providerIdx + 1) {
                                soFar.push('...');
                            }
                            return soFar;
                        }, [])
                            .join(', ');
                        _this._reportError(util_2.syntaxError("Invalid " + (debugInfo ? debugInfo : 'provider') + " - only instances of Provider and Type are allowed, got: [" + providersInfo + "]"), type);
                        return;
                    }
                    if (providerMeta.token ===
                        _this._reflector.resolveExternalReference(identifiers_1.Identifiers.ANALYZE_FOR_ENTRY_COMPONENTS)) {
                        targetEntryComponents.push.apply(targetEntryComponents, tslib_1.__spread(_this._getEntryComponentsFromProvider(providerMeta, type)));
                    }
                    else {
                        compileProviders.push(_this.getProviderMetadata(providerMeta));
                    }
                }
            });
            return compileProviders;
        };
        CompileMetadataResolver.prototype._validateProvider = function (provider) {
            if (provider.hasOwnProperty('useClass') && provider.useClass == null) {
                this._reportError(util_2.syntaxError("Invalid provider for " + stringifyType(provider.provide) + ". useClass cannot be " + provider.useClass + ".\n           Usually it happens when:\n           1. There's a circular dependency (might be caused by using index.ts (barrel) files).\n           2. Class was used before it was declared. Use forwardRef in this case."));
            }
        };
        CompileMetadataResolver.prototype._getEntryComponentsFromProvider = function (provider, type) {
            var _this = this;
            var components = [];
            var collectedIdentifiers = [];
            if (provider.useFactory || provider.useExisting || provider.useClass) {
                this._reportError(util_2.syntaxError("The ANALYZE_FOR_ENTRY_COMPONENTS token only supports useValue!"), type);
                return [];
            }
            if (!provider.multi) {
                this._reportError(util_2.syntaxError("The ANALYZE_FOR_ENTRY_COMPONENTS token only supports 'multi = true'!"), type);
                return [];
            }
            extractIdentifiers(provider.useValue, collectedIdentifiers);
            collectedIdentifiers.forEach(function (identifier) {
                var entry = _this._getEntryComponentMetadata(identifier.reference, false);
                if (entry) {
                    components.push(entry);
                }
            });
            return components;
        };
        CompileMetadataResolver.prototype._getEntryComponentMetadata = function (dirType, throwIfNotFound) {
            if (throwIfNotFound === void 0) { throwIfNotFound = true; }
            var dirMeta = this.getNonNormalizedDirectiveMetadata(dirType);
            if (dirMeta && dirMeta.metadata.isComponent) {
                return { componentType: dirType, componentFactory: dirMeta.metadata.componentFactory };
            }
            var dirSummary = this._loadSummary(dirType, cpl.CompileSummaryKind.Directive);
            if (dirSummary && dirSummary.isComponent) {
                return { componentType: dirType, componentFactory: dirSummary.componentFactory };
            }
            if (throwIfNotFound) {
                throw util_2.syntaxError(dirType.name + " cannot be used as an entry component.");
            }
            return null;
        };
        CompileMetadataResolver.prototype._getInjectableTypeMetadata = function (type, dependencies) {
            if (dependencies === void 0) { dependencies = null; }
            var typeSummary = this._loadSummary(type, cpl.CompileSummaryKind.Injectable);
            if (typeSummary) {
                return typeSummary.type;
            }
            return this._getTypeMetadata(type, dependencies);
        };
        CompileMetadataResolver.prototype.getProviderMetadata = function (provider) {
            var compileDeps = undefined;
            var compileTypeMetadata = null;
            var compileFactoryMetadata = null;
            var token = this._getTokenMetadata(provider.token);
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
        };
        CompileMetadataResolver.prototype._getQueriesMetadata = function (queries, isViewQuery, directiveType) {
            var _this = this;
            var res = [];
            Object.keys(queries).forEach(function (propertyName) {
                var query = queries[propertyName];
                if (query.isViewQuery === isViewQuery) {
                    res.push(_this._getQueryMetadata(query, propertyName, directiveType));
                }
            });
            return res;
        };
        CompileMetadataResolver.prototype._queryVarBindings = function (selector) { return selector.split(/\s*,\s*/); };
        CompileMetadataResolver.prototype._getQueryMetadata = function (q, propertyName, typeOrFunc) {
            var _this = this;
            var selectors;
            if (typeof q.selector === 'string') {
                selectors =
                    this._queryVarBindings(q.selector).map(function (varName) { return _this._getTokenMetadata(varName); });
            }
            else {
                if (!q.selector) {
                    this._reportError(util_2.syntaxError("Can't construct a query for the property \"" + propertyName + "\" of \"" + stringifyType(typeOrFunc) + "\" since the query selector wasn't defined."), typeOrFunc);
                    selectors = [];
                }
                else {
                    selectors = [this._getTokenMetadata(q.selector)];
                }
            }
            return {
                selectors: selectors,
                first: q.first,
                descendants: q.descendants, propertyName: propertyName,
                read: q.read ? this._getTokenMetadata(q.read) : null
            };
        };
        CompileMetadataResolver.prototype._reportError = function (error, type, otherType) {
            if (this._errorCollector) {
                this._errorCollector(error, type);
                if (otherType) {
                    this._errorCollector(error, otherType);
                }
            }
            else {
                throw error;
            }
        };
        return CompileMetadataResolver;
    }());
    exports.CompileMetadataResolver = CompileMetadataResolver;
    function flattenArray(tree, out) {
        if (out === void 0) { out = []; }
        if (tree) {
            for (var i = 0; i < tree.length; i++) {
                var item = util_2.resolveForwardRef(tree[i]);
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
        return (value instanceof static_symbol_1.StaticSymbol) || (value instanceof core_1.Type);
    }
    function extractIdentifiers(value, targetIdentifiers) {
        util_2.visitValue(value, new _CompileValueConverter(), targetIdentifiers);
    }
    var _CompileValueConverter = /** @class */ (function (_super) {
        tslib_1.__extends(_CompileValueConverter, _super);
        function _CompileValueConverter() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        _CompileValueConverter.prototype.visitOther = function (value, targetIdentifiers) {
            targetIdentifiers.push({ reference: value });
        };
        return _CompileValueConverter;
    }(util_2.ValueTransformer));
    function stringifyType(type) {
        if (type instanceof static_symbol_1.StaticSymbol) {
            return type.name + " in " + type.filePath;
        }
        else {
            return util_2.stringify(type);
        }
    }
    /**
     * Indicates that a component is still being loaded in a synchronous compile.
     */
    function componentStillLoadingError(compType) {
        var error = Error("Can't compile synchronously as " + util_2.stringify(compType) + " is still being loaded!");
        error[exports.ERROR_COMPONENT_TYPE] = compType;
        return error;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWRhdGFfcmVzb2x2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWV0YWRhdGFfcmVzb2x2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgseUVBQW9FO0lBQ3BFLHVEQUE2QztJQUM3QywrREFBOEU7SUFDOUUsNERBQTBDO0lBRzFDLG1EQUFnVTtJQUVoVSwrRUFBaUU7SUFDakUsaUVBQTBDO0lBQzFDLGlGQUEyRDtJQUszRCwyREFBdUM7SUFFdkMsbURBQTJJO0lBSTlILFFBQUEsb0JBQW9CLEdBQUcsaUJBQWlCLENBQUM7SUFFdEQsZ0JBQWdCO0lBQ2hCLGtDQUFrQztJQUNsQywyREFBMkQ7SUFDM0QsOENBQThDO0lBQzlDLDZEQUE2RDtJQUM3RCw2REFBNkQ7SUFDN0QsdUJBQXVCO0lBQ3ZCO1FBVUUsaUNBQ1ksT0FBdUIsRUFBVSxXQUF1QixFQUN4RCxpQkFBbUMsRUFBVSxrQkFBcUMsRUFDbEYsYUFBMkIsRUFBVSxnQkFBc0MsRUFDM0UsZUFBc0MsRUFDdEMsb0JBQXlDLEVBQVUsUUFBaUIsRUFDcEUsa0JBQXFDLEVBQVUsVUFBNEIsRUFDM0UsZUFBZ0M7WUFOaEMsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7WUFBVSxnQkFBVyxHQUFYLFdBQVcsQ0FBWTtZQUN4RCxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWtCO1lBQVUsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFtQjtZQUNsRixrQkFBYSxHQUFiLGFBQWEsQ0FBYztZQUFVLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBc0I7WUFDM0Usb0JBQWUsR0FBZixlQUFlLENBQXVCO1lBQ3RDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBcUI7WUFBVSxhQUFRLEdBQVIsUUFBUSxDQUFTO1lBQ3BFLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBbUI7WUFBVSxlQUFVLEdBQVYs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NkJBQUM7SUFBRCxDQUFDLEFBSkQsQ0FBcUMsdUJBQWdCLEdBSXBEO0lBRUQsdUJBQXVCLElBQVM7UUFDOUIsSUFBSSxJQUFJLFlBQVksNEJBQVksRUFBRTtZQUNoQyxPQUFVLElBQUksQ0FBQyxJQUFJLFlBQU8sSUFBSSxDQUFDLFFBQVUsQ0FBQztTQUMzQzthQUFNO1lBQ0wsT0FBTyxnQkFBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3hCO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsb0NBQW9DLFFBQWM7UUFDaEQsSUFBTSxLQUFLLEdBQ1AsS0FBSyxDQUFDLG9DQUFrQyxnQkFBUyxDQUFDLFFBQVEsQ0FBQyw0QkFBeUIsQ0FBQyxDQUFDO1FBQ3pGLEtBQWEsQ0FBQyw0QkFBb0IsQ0FBQyxHQUFHLFFBQVEsQ0FBQztRQUNoRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sLCBTdGF0aWNTeW1ib2xDYWNoZX0gZnJvbSAnLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge25nZmFjdG9yeUZpbGVQYXRofSBmcm9tICcuL2FvdC91dGlsJztcbmltcG9ydCB7YXNzZXJ0QXJyYXlPZlN0cmluZ3MsIGFzc2VydEludGVycG9sYXRpb25TeW1ib2xzfSBmcm9tICcuL2Fzc2VydGlvbnMnO1xuaW1wb3J0ICogYXMgY3BsIGZyb20gJy4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtDb21waWxlckNvbmZpZ30gZnJvbSAnLi9jb25maWcnO1xuaW1wb3J0IHtDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSwgQ29tcG9uZW50LCBEaXJlY3RpdmUsIEluamVjdGFibGUsIE1vZHVsZVdpdGhQcm92aWRlcnMsIFByb3ZpZGVyLCBRdWVyeSwgU2NoZW1hTWV0YWRhdGEsIFR5cGUsIFZpZXdFbmNhcHN1bGF0aW9uLCBjcmVhdGVBdHRyaWJ1dGUsIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlSG9zdCwgY3JlYXRlSW5qZWN0LCBjcmVhdGVJbmplY3RhYmxlLCBjcmVhdGVJbmplY3Rpb25Ub2tlbiwgY3JlYXRlTmdNb2R1bGUsIGNyZWF0ZU9wdGlvbmFsLCBjcmVhdGVTZWxmLCBjcmVhdGVTa2lwU2VsZn0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7RGlyZWN0aXZlTm9ybWFsaXplcn0gZnJvbSAnLi9kaXJlY3RpdmVfbm9ybWFsaXplcic7XG5pbXBvcnQge0RpcmVjdGl2ZVJlc29sdmVyLCBmaW5kTGFzdH0gZnJvbSAnLi9kaXJlY3RpdmVfcmVzb2x2ZXInO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi9pZGVudGlmaWVycyc7XG5pbXBvcnQge2dldEFsbExpZmVjeWNsZUhvb2tzfSBmcm9tICcuL2xpZmVjeWNsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge05nTW9kdWxlUmVzb2x2ZXJ9IGZyb20gJy4vbmdfbW9kdWxlX3Jlc29sdmVyJztcbmltcG9ydCB7UGlwZVJlc29sdmVyfSBmcm9tICcuL3BpcGVfcmVzb2x2ZXInO1xuaW1wb3J0IHtFbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4vc2NoZW1hL2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q3NzU2VsZWN0b3J9IGZyb20gJy4vc2VsZWN0b3InO1xuaW1wb3J0IHtTdW1tYXJ5UmVzb2x2ZXJ9IGZyb20gJy4vc3VtbWFyeV9yZXNvbHZlcic7XG5pbXBvcnQge0NvbnNvbGUsIFN5bmNBc3luYywgVmFsdWVUcmFuc2Zvcm1lciwgaXNQcm9taXNlLCBub1VuZGVmaW5lZCwgcmVzb2x2ZUZvcndhcmRSZWYsIHN0cmluZ2lmeSwgc3ludGF4RXJyb3IsIHZpc2l0VmFsdWV9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCB0eXBlIEVycm9yQ29sbGVjdG9yID0gKGVycm9yOiBhbnksIHR5cGU/OiBhbnkpID0+IHZvaWQ7XG5cbmV4cG9ydCBjb25zdCBFUlJPUl9DT01QT05FTlRfVFlQRSA9ICduZ0NvbXBvbmVudFR5cGUnO1xuXG4vLyBEZXNpZ24gbm90ZXM6XG4vLyAtIGRvbid0IGxhemlseSBjcmVhdGUgbWV0YWRhdGE6XG4vLyAgIEZvciBzb21lIG1ldGFkYXRhLCB3ZSBuZWVkIHRvIGRvIGFzeW5jIHdvcmsgc29tZXRpbWVzLFxuLy8gICBzbyB0aGUgdXNlciBoYXMgdG8ga2ljayBvZmYgdGhpcyBsb2FkaW5nLlxuLy8gICBCdXQgd2Ugd2FudCB0byByZXBvcnQgZXJyb3JzIGV2ZW4gd2hlbiB0aGUgYXN5bmMgd29yayBpc1xuLy8gICBub3QgcmVxdWlyZWQgdG8gY2hlY2sgdGhhdCB0aGUgdXNlciB3b3VsZCBoYXZlIGJlZW4gYWJsZVxuLy8gICB0byB3YWl0IGNvcnJlY3RseS5cbmV4cG9ydCBjbGFzcyBDb21waWxlTWV0YWRhdGFSZXNvbHZlciB7XG4gIHByaXZhdGUgX25vbk5vcm1hbGl6ZWREaXJlY3RpdmVDYWNoZSA9XG4gICAgICBuZXcgTWFwPFR5cGUsIHthbm5vdGF0aW9uOiBEaXJlY3RpdmUsIG1ldGFkYXRhOiBjcGwuQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhfT4oKTtcbiAgcHJpdmF0ZSBfZGlyZWN0aXZlQ2FjaGUgPSBuZXcgTWFwPFR5cGUsIGNwbC5Db21waWxlRGlyZWN0aXZlTWV0YWRhdGE+KCk7XG4gIHByaXZhdGUgX3N1bW1hcnlDYWNoZSA9IG5ldyBNYXA8VHlwZSwgY3BsLkNvbXBpbGVUeXBlU3VtbWFyeXxudWxsPigpO1xuICBwcml2YXRlIF9waXBlQ2FjaGUgPSBuZXcgTWFwPFR5cGUsIGNwbC5Db21waWxlUGlwZU1ldGFkYXRhPigpO1xuICBwcml2YXRlIF9uZ01vZHVsZUNhY2hlID0gbmV3IE1hcDxUeXBlLCBjcGwuQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGE+KCk7XG4gIHByaXZhdGUgX25nTW9kdWxlT2ZUeXBlcyA9IG5ldyBNYXA8VHlwZSwgVHlwZT4oKTtcbiAgcHJpdmF0ZSBfc2hhbGxvd01vZHVsZUNhY2hlID0gbmV3IE1hcDxUeXBlLCBjcGwuQ29tcGlsZVNoYWxsb3dNb2R1bGVNZXRhZGF0YT4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2NvbmZpZzogQ29tcGlsZXJDb25maWcsIHByaXZhdGUgX2h0bWxQYXJzZXI6IEh0bWxQYXJzZXIsXG4gICAgICBwcml2YXRlIF9uZ01vZHVsZVJlc29sdmVyOiBOZ01vZHVsZVJlc29sdmVyLCBwcml2YXRlIF9kaXJlY3RpdmVSZXNvbHZlcjogRGlyZWN0aXZlUmVzb2x2ZXIsXG4gICAgICBwcml2YXRlIF9waXBlUmVzb2x2ZXI6IFBpcGVSZXNvbHZlciwgcHJpdmF0ZSBfc3VtbWFyeVJlc29sdmVyOiBTdW1tYXJ5UmVzb2x2ZXI8YW55PixcbiAgICAgIHByaXZhdGUgX3NjaGVtYVJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksXG4gICAgICBwcml2YXRlIF9kaXJlY3RpdmVOb3JtYWxpemVyOiBEaXJlY3RpdmVOb3JtYWxpemVyLCBwcml2YXRlIF9jb25zb2xlOiBDb25zb2xlLFxuICAgICAgcHJpdmF0ZSBfc3RhdGljU3ltYm9sQ2FjaGU6IFN0YXRpY1N5bWJvbENhY2hlLCBwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgICBwcml2YXRlIF9lcnJvckNvbGxlY3Rvcj86IEVycm9yQ29sbGVjdG9yKSB7fVxuXG4gIGdldFJlZmxlY3RvcigpOiBDb21waWxlUmVmbGVjdG9yIHsgcmV0dXJuIHRoaXMuX3JlZmxlY3RvcjsgfVxuXG4gIGNsZWFyQ2FjaGVGb3IodHlwZTogVHlwZSkge1xuICAgIGNvbnN0IGRpck1ldGEgPSB0aGlzLl9kaXJlY3RpdmVDYWNoZS5nZXQodHlwZSk7XG4gICAgdGhpcy5fZGlyZWN0aXZlQ2FjaGUuZGVsZXRlKHR5cGUpO1xuICAgIHRoaXMuX25vbk5vcm1hbGl6ZWREaXJlY3RpdmVDYWNoZS5kZWxldGUodHlwZSk7XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlLmRlbGV0ZSh0eXBlKTtcbiAgICB0aGlzLl9waXBlQ2FjaGUuZGVsZXRlKHR5cGUpO1xuICAgIHRoaXMuX25nTW9kdWxlT2ZUeXBlcy5kZWxldGUodHlwZSk7XG4gICAgLy8gQ2xlYXIgYWxsIG9mIHRoZSBOZ01vZHVsZSBhcyB0aGV5IGNvbnRhaW4gdHJhbnNpdGl2ZSBpbmZvcm1hdGlvbiFcbiAgICB0aGlzLl9uZ01vZHVsZUNhY2hlLmNsZWFyKCk7XG4gICAgaWYgKGRpck1ldGEpIHtcbiAgICAgIHRoaXMuX2RpcmVjdGl2ZU5vcm1hbGl6ZXIuY2xlYXJDYWNoZUZvcihkaXJNZXRhKTtcbiAgICB9XG4gIH1cblxuICBjbGVhckNhY2hlKCk6IHZvaWQge1xuICAgIHRoaXMuX2RpcmVjdGl2ZUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fbm9uTm9ybWFsaXplZERpcmVjdGl2ZUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fcGlwZUNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5fbmdNb2R1bGVDYWNoZS5jbGVhcigpO1xuICAgIHRoaXMuX25nTW9kdWxlT2ZUeXBlcy5jbGVhcigpO1xuICAgIHRoaXMuX2RpcmVjdGl2ZU5vcm1hbGl6ZXIuY2xlYXJDYWNoZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlUHJveHlDbGFzcyhiYXNlVHlwZTogYW55LCBuYW1lOiBzdHJpbmcpOiBjcGwuUHJveHlDbGFzcyB7XG4gICAgbGV0IGRlbGVnYXRlOiBhbnkgPSBudWxsO1xuICAgIGNvbnN0IHByb3h5Q2xhc3M6IGNwbC5Qcm94eUNsYXNzID0gPGFueT5mdW5jdGlvbigpIHtcbiAgICAgIGlmICghZGVsZWdhdGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYElsbGVnYWwgc3RhdGU6IENsYXNzICR7bmFtZX0gZm9yIHR5cGUgJHtzdHJpbmdpZnkoYmFzZVR5cGUpfSBpcyBub3QgY29tcGlsZWQgeWV0IWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRlbGVnYXRlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgICBwcm94eUNsYXNzLnNldERlbGVnYXRlID0gKGQpID0+IHtcbiAgICAgIGRlbGVnYXRlID0gZDtcbiAgICAgICg8YW55PnByb3h5Q2xhc3MpLnByb3RvdHlwZSA9IGQucHJvdG90eXBlO1xuICAgIH07XG4gICAgLy8gTWFrZSBzdHJpbmdpZnkgd29yayBjb3JyZWN0bHlcbiAgICAoPGFueT5wcm94eUNsYXNzKS5vdmVycmlkZGVuTmFtZSA9IG5hbWU7XG4gICAgcmV0dXJuIHByb3h5Q2xhc3M7XG4gIH1cblxuICBwcml2YXRlIGdldEdlbmVyYXRlZENsYXNzKGRpclR5cGU6IGFueSwgbmFtZTogc3RyaW5nKTogU3RhdGljU3ltYm9sfGNwbC5Qcm94eUNsYXNzIHtcbiAgICBpZiAoZGlyVHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXRpY1N5bWJvbENhY2hlLmdldChuZ2ZhY3RvcnlGaWxlUGF0aChkaXJUeXBlLmZpbGVQYXRoKSwgbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9jcmVhdGVQcm94eUNsYXNzKGRpclR5cGUsIG5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q29tcG9uZW50Vmlld0NsYXNzKGRpclR5cGU6IGFueSk6IFN0YXRpY1N5bWJvbHxjcGwuUHJveHlDbGFzcyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0R2VuZXJhdGVkQ2xhc3MoZGlyVHlwZSwgY3BsLnZpZXdDbGFzc05hbWUoZGlyVHlwZSwgMCkpO1xuICB9XG5cbiAgZ2V0SG9zdENvbXBvbmVudFZpZXdDbGFzcyhkaXJUeXBlOiBhbnkpOiBTdGF0aWNTeW1ib2x8Y3BsLlByb3h5Q2xhc3Mge1xuICAgIHJldHVybiB0aGlzLmdldEdlbmVyYXRlZENsYXNzKGRpclR5cGUsIGNwbC5ob3N0Vmlld0NsYXNzTmFtZShkaXJUeXBlKSk7XG4gIH1cblxuICBnZXRIb3N0Q29tcG9uZW50VHlwZShkaXJUeXBlOiBhbnkpOiBTdGF0aWNTeW1ib2x8Y3BsLlByb3h5Q2xhc3Mge1xuICAgIGNvbnN0IG5hbWUgPSBgJHtjcGwuaWRlbnRpZmllck5hbWUoe3JlZmVyZW5jZTogZGlyVHlwZX0pfV9Ib3N0YDtcbiAgICBpZiAoZGlyVHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXRpY1N5bWJvbENhY2hlLmdldChkaXJUeXBlLmZpbGVQYXRoLCBuYW1lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fY3JlYXRlUHJveHlDbGFzcyhkaXJUeXBlLCBuYW1lKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UmVuZGVyZXJUeXBlKGRpclR5cGU6IGFueSk6IFN0YXRpY1N5bWJvbHxvYmplY3Qge1xuICAgIGlmIChkaXJUeXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhdGljU3ltYm9sQ2FjaGUuZ2V0KFxuICAgICAgICAgIG5nZmFjdG9yeUZpbGVQYXRoKGRpclR5cGUuZmlsZVBhdGgpLCBjcGwucmVuZGVyZXJUeXBlTmFtZShkaXJUeXBlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHJldHVybmluZyBhbiBvYmplY3QgYXMgcHJveHksXG4gICAgICAvLyB0aGF0IHdlIGZpbGwgbGF0ZXIgZHVyaW5nIHJ1bnRpbWUgY29tcGlsYXRpb24uXG4gICAgICByZXR1cm4gPGFueT57fTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldENvbXBvbmVudEZhY3RvcnkoXG4gICAgICBzZWxlY3Rvcjogc3RyaW5nLCBkaXJUeXBlOiBhbnksIGlucHV0czoge1trZXk6IHN0cmluZ106IHN0cmluZ318bnVsbCxcbiAgICAgIG91dHB1dHM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KTogU3RhdGljU3ltYm9sfG9iamVjdCB7XG4gICAgaWYgKGRpclR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGF0aWNTeW1ib2xDYWNoZS5nZXQoXG4gICAgICAgICAgbmdmYWN0b3J5RmlsZVBhdGgoZGlyVHlwZS5maWxlUGF0aCksIGNwbC5jb21wb25lbnRGYWN0b3J5TmFtZShkaXJUeXBlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGhvc3RWaWV3ID0gdGhpcy5nZXRIb3N0Q29tcG9uZW50Vmlld0NsYXNzKGRpclR5cGUpO1xuICAgICAgLy8gTm90ZTogbmdDb250ZW50U2VsZWN0b3JzIHdpbGwgYmUgZmlsbGVkIGxhdGVyIG9uY2UgdGhlIHRlbXBsYXRlIGlzXG4gICAgICAvLyBsb2FkZWQuXG4gICAgICBjb25zdCBjcmVhdGVDb21wb25lbnRGYWN0b3J5ID1cbiAgICAgICAgICB0aGlzLl9yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLmNyZWF0ZUNvbXBvbmVudEZhY3RvcnkpO1xuICAgICAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudEZhY3Rvcnkoc2VsZWN0b3IsIGRpclR5cGUsIDxhbnk+aG9zdFZpZXcsIGlucHV0cywgb3V0cHV0cywgW10pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaW5pdENvbXBvbmVudEZhY3RvcnkoZmFjdG9yeTogU3RhdGljU3ltYm9sfG9iamVjdCwgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSkge1xuICAgIGlmICghKGZhY3RvcnkgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpKSB7XG4gICAgICAoZmFjdG9yeSBhcyBhbnkpLm5nQ29udGVudFNlbGVjdG9ycy5wdXNoKC4uLm5nQ29udGVudFNlbGVjdG9ycyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfbG9hZFN1bW1hcnkodHlwZTogYW55LCBraW5kOiBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kKTogY3BsLkNvbXBpbGVUeXBlU3VtbWFyeXxudWxsIHtcbiAgICBsZXQgdHlwZVN1bW1hcnkgPSB0aGlzLl9zdW1tYXJ5Q2FjaGUuZ2V0KHR5cGUpO1xuICAgIGlmICghdHlwZVN1bW1hcnkpIHtcbiAgICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLl9zdW1tYXJ5UmVzb2x2ZXIucmVzb2x2ZVN1bW1hcnkodHlwZSk7XG4gICAgICB0eXBlU3VtbWFyeSA9IHN1bW1hcnkgPyBzdW1tYXJ5LnR5cGUgOiBudWxsO1xuICAgICAgdGhpcy5fc3VtbWFyeUNhY2hlLnNldCh0eXBlLCB0eXBlU3VtbWFyeSB8fCBudWxsKTtcbiAgICB9XG4gICAgcmV0dXJuIHR5cGVTdW1tYXJ5ICYmIHR5cGVTdW1tYXJ5LnN1bW1hcnlLaW5kID09PSBraW5kID8gdHlwZVN1bW1hcnkgOiBudWxsO1xuICB9XG5cbiAgZ2V0SG9zdENvbXBvbmVudE1ldGFkYXRhKFxuICAgICAgY29tcE1ldGE6IGNwbC5Db21waWxlRGlyZWN0aXZlTWV0YWRhdGEsXG4gICAgICBob3N0Vmlld1R5cGU/OiBTdGF0aWNTeW1ib2x8Y3BsLlByb3h5Q2xhc3MpOiBjcGwuQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgICBjb25zdCBob3N0VHlwZSA9IHRoaXMuZ2V0SG9zdENvbXBvbmVudFR5cGUoY29tcE1ldGEudHlwZS5yZWZlcmVuY2UpO1xuICAgIGlmICghaG9zdFZpZXdUeXBlKSB7XG4gICAgICBob3N0Vmlld1R5cGUgPSB0aGlzLmdldEhvc3RDb21wb25lbnRWaWV3Q2xhc3MoaG9zdFR5cGUpO1xuICAgIH1cbiAgICAvLyBOb3RlOiAhIGlzIG9rIGhlcmUgYXMgdGhpcyBtZXRob2Qgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIHdpdGggbm9ybWFsaXplZCBkaXJlY3RpdmVcbiAgICAvLyBtZXRhZGF0YSwgd2hpY2ggYWx3YXlzIGZpbGxzIGluIHRoZSBzZWxlY3Rvci5cbiAgICBjb25zdCB0ZW1wbGF0ZSA9IENzc1NlbGVjdG9yLnBhcnNlKGNvbXBNZXRhLnNlbGVjdG9yICEpWzBdLmdldE1hdGNoaW5nRWxlbWVudFRlbXBsYXRlKCk7XG4gICAgY29uc3QgdGVtcGxhdGVVcmwgPSAnJztcbiAgICBjb25zdCBodG1sQXN0ID0gdGhpcy5faHRtbFBhcnNlci5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwpO1xuICAgIHJldHVybiBjcGwuQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLmNyZWF0ZSh7XG4gICAgICBpc0hvc3Q6IHRydWUsXG4gICAgICB0eXBlOiB7cmVmZXJlbmNlOiBob3N0VHlwZSwgZGlEZXBzOiBbXSwgbGlmZWN5Y2xlSG9va3M6IFtdfSxcbiAgICAgIHRlbXBsYXRlOiBuZXcgY3BsLkNvbXBpbGVUZW1wbGF0ZU1ldGFkYXRhKHtcbiAgICAgICAgZW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb24uTm9uZSxcbiAgICAgICAgdGVtcGxhdGUsXG4gICAgICAgIHRlbXBsYXRlVXJsLFxuICAgICAgICBodG1sQXN0LFxuICAgICAgICBzdHlsZXM6IFtdLFxuICAgICAgICBzdHlsZVVybHM6IFtdLFxuICAgICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdLFxuICAgICAgICBhbmltYXRpb25zOiBbXSxcbiAgICAgICAgaXNJbmxpbmU6IHRydWUsXG4gICAgICAgIGV4dGVybmFsU3R5bGVzaGVldHM6IFtdLFxuICAgICAgICBpbnRlcnBvbGF0aW9uOiBudWxsLFxuICAgICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBmYWxzZSxcbiAgICAgIH0pLFxuICAgICAgZXhwb3J0QXM6IG51bGwsXG4gICAgICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHQsXG4gICAgICBpbnB1dHM6IFtdLFxuICAgICAgb3V0cHV0czogW10sXG4gICAgICBob3N0OiB7fSxcbiAgICAgIGlzQ29tcG9uZW50OiB0cnVlLFxuICAgICAgc2VsZWN0b3I6ICcqJyxcbiAgICAgIHByb3ZpZGVyczogW10sXG4gICAgICB2aWV3UHJvdmlkZXJzOiBbXSxcbiAgICAgIHF1ZXJpZXM6IFtdLFxuICAgICAgZ3VhcmRzOiB7fSxcbiAgICAgIHZpZXdRdWVyaWVzOiBbXSxcbiAgICAgIGNvbXBvbmVudFZpZXdUeXBlOiBob3N0Vmlld1R5cGUsXG4gICAgICByZW5kZXJlclR5cGU6XG4gICAgICAgICAge2lkOiAnX19Ib3N0X18nLCBlbmNhcHN1bGF0aW9uOiBWaWV3RW5jYXBzdWxhdGlvbi5Ob25lLCBzdHlsZXM6IFtdLCBkYXRhOiB7fX0gYXMgb2JqZWN0LFxuICAgICAgZW50cnlDb21wb25lbnRzOiBbXSxcbiAgICAgIGNvbXBvbmVudEZhY3Rvcnk6IG51bGxcbiAgICB9KTtcbiAgfVxuXG4gIGxvYWREaXJlY3RpdmVNZXRhZGF0YShuZ01vZHVsZVR5cGU6IGFueSwgZGlyZWN0aXZlVHlwZTogYW55LCBpc1N5bmM6IGJvb2xlYW4pOiBTeW5jQXN5bmM8bnVsbD4ge1xuICAgIGlmICh0aGlzLl9kaXJlY3RpdmVDYWNoZS5oYXMoZGlyZWN0aXZlVHlwZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBkaXJlY3RpdmVUeXBlID0gcmVzb2x2ZUZvcndhcmRSZWYoZGlyZWN0aXZlVHlwZSk7XG4gICAgY29uc3Qge2Fubm90YXRpb24sIG1ldGFkYXRhfSA9IHRoaXMuZ2V0Tm9uTm9ybWFsaXplZERpcmVjdGl2ZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGUpICE7XG5cbiAgICBjb25zdCBjcmVhdGVEaXJlY3RpdmVNZXRhZGF0YSA9ICh0ZW1wbGF0ZU1ldGFkYXRhOiBjcGwuQ29tcGlsZVRlbXBsYXRlTWV0YWRhdGEgfCBudWxsKSA9PiB7XG4gICAgICBjb25zdCBub3JtYWxpemVkRGlyTWV0YSA9IG5ldyBjcGwuQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKHtcbiAgICAgICAgaXNIb3N0OiBmYWxzZSxcbiAgICAgICAgdHlwZTogbWV0YWRhdGEudHlwZSxcbiAgICAgICAgaXNDb21wb25lbnQ6IG1ldGFkYXRhLmlzQ29tcG9uZW50LFxuICAgICAgICBzZWxlY3RvcjogbWV0YWRhdGEuc2VsZWN0b3IsXG4gICAgICAgIGV4cG9ydEFzOiBtZXRhZGF0YS5leHBvcnRBcyxcbiAgICAgICAgY2hhbmdlRGV0ZWN0aW9uOiBtZXRhZGF0YS5jaGFuZ2VEZXRlY3Rpb24sXG4gICAgICAgIGlucHV0czogbWV0YWRhdGEuaW5wdXRzLFxuICAgICAgICBvdXRwdXRzOiBtZXRhZGF0YS5vdXRwdXRzLFxuICAgICAgICBob3N0TGlzdGVuZXJzOiBtZXRhZGF0YS5ob3N0TGlzdGVuZXJzLFxuICAgICAgICBob3N0UHJvcGVydGllczogbWV0YWRhdGEuaG9zdFByb3BlcnRpZXMsXG4gICAgICAgIGhvc3RBdHRyaWJ1dGVzOiBtZXRhZGF0YS5ob3N0QXR0cmlidXRlcyxcbiAgICAgICAgcHJvdmlkZXJzOiBtZXRhZGF0YS5wcm92aWRlcnMsXG4gICAgICAgIHZpZXdQcm92aWRlcnM6IG1ldGFkYXRhLnZpZXdQcm92aWRlcnMsXG4gICAgICAgIHF1ZXJpZXM6IG1ldGFkYXRhLnF1ZXJpZXMsXG4gICAgICAgIGd1YXJkczogbWV0YWRhdGEuZ3VhcmRzLFxuICAgICAgICB2aWV3UXVlcmllczogbWV0YWRhdGEudmlld1F1ZXJpZXMsXG4gICAgICAgIGVudHJ5Q29tcG9uZW50czogbWV0YWRhdGEuZW50cnlDb21wb25lbnRzLFxuICAgICAgICBjb21wb25lbnRWaWV3VHlwZTogbWV0YWRhdGEuY29tcG9uZW50Vmlld1R5cGUsXG4gICAgICAgIHJlbmRlcmVyVHlwZTogbWV0YWRhdGEucmVuZGVyZXJUeXBlLFxuICAgICAgICBjb21wb25lbnRGYWN0b3J5OiBtZXRhZGF0YS5jb21wb25lbnRGYWN0b3J5LFxuICAgICAgICB0ZW1wbGF0ZTogdGVtcGxhdGVNZXRhZGF0YVxuICAgICAgfSk7XG4gICAgICBpZiAodGVtcGxhdGVNZXRhZGF0YSkge1xuICAgICAgICB0aGlzLmluaXRDb21wb25lbnRGYWN0b3J5KG1ldGFkYXRhLmNvbXBvbmVudEZhY3RvcnkgISwgdGVtcGxhdGVNZXRhZGF0YS5uZ0NvbnRlbnRTZWxlY3RvcnMpO1xuICAgICAgfVxuICAgICAgdGhpcy5fZGlyZWN0aXZlQ2FjaGUuc2V0KGRpcmVjdGl2ZVR5cGUsIG5vcm1hbGl6ZWREaXJNZXRhKTtcbiAgICAgIHRoaXMuX3N1bW1hcnlDYWNoZS5zZXQoZGlyZWN0aXZlVHlwZSwgbm9ybWFsaXplZERpck1ldGEudG9TdW1tYXJ5KCkpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIGlmIChtZXRhZGF0YS5pc0NvbXBvbmVudCkge1xuICAgICAgY29uc3QgdGVtcGxhdGUgPSBtZXRhZGF0YS50ZW1wbGF0ZSAhO1xuICAgICAgY29uc3QgdGVtcGxhdGVNZXRhID0gdGhpcy5fZGlyZWN0aXZlTm9ybWFsaXplci5ub3JtYWxpemVUZW1wbGF0ZSh7XG4gICAgICAgIG5nTW9kdWxlVHlwZSxcbiAgICAgICAgY29tcG9uZW50VHlwZTogZGlyZWN0aXZlVHlwZSxcbiAgICAgICAgbW9kdWxlVXJsOiB0aGlzLl9yZWZsZWN0b3IuY29tcG9uZW50TW9kdWxlVXJsKGRpcmVjdGl2ZVR5cGUsIGFubm90YXRpb24pLFxuICAgICAgICBlbmNhcHN1bGF0aW9uOiB0ZW1wbGF0ZS5lbmNhcHN1bGF0aW9uLFxuICAgICAgICB0ZW1wbGF0ZTogdGVtcGxhdGUudGVtcGxhdGUsXG4gICAgICAgIHRlbXBsYXRlVXJsOiB0ZW1wbGF0ZS50ZW1wbGF0ZVVybCxcbiAgICAgICAgc3R5bGVzOiB0ZW1wbGF0ZS5zdHlsZXMsXG4gICAgICAgIHN0eWxlVXJsczogdGVtcGxhdGUuc3R5bGVVcmxzLFxuICAgICAgICBhbmltYXRpb25zOiB0ZW1wbGF0ZS5hbmltYXRpb25zLFxuICAgICAgICBpbnRlcnBvbGF0aW9uOiB0ZW1wbGF0ZS5pbnRlcnBvbGF0aW9uLFxuICAgICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiB0ZW1wbGF0ZS5wcmVzZXJ2ZVdoaXRlc3BhY2VzXG4gICAgICB9KTtcbiAgICAgIGlmIChpc1Byb21pc2UodGVtcGxhdGVNZXRhKSAmJiBpc1N5bmMpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoY29tcG9uZW50U3RpbGxMb2FkaW5nRXJyb3IoZGlyZWN0aXZlVHlwZSksIGRpcmVjdGl2ZVR5cGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBTeW5jQXN5bmMudGhlbih0ZW1wbGF0ZU1ldGEsIGNyZWF0ZURpcmVjdGl2ZU1ldGFkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gZGlyZWN0aXZlXG4gICAgICBjcmVhdGVEaXJlY3RpdmVNZXRhZGF0YShudWxsKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGdldE5vbk5vcm1hbGl6ZWREaXJlY3RpdmVNZXRhZGF0YShkaXJlY3RpdmVUeXBlOiBhbnkpOlxuICAgICAge2Fubm90YXRpb246IERpcmVjdGl2ZSwgbWV0YWRhdGE6IGNwbC5Db21waWxlRGlyZWN0aXZlTWV0YWRhdGF9fG51bGwge1xuICAgIGRpcmVjdGl2ZVR5cGUgPSByZXNvbHZlRm9yd2FyZFJlZihkaXJlY3RpdmVUeXBlKTtcbiAgICBpZiAoIWRpcmVjdGl2ZVR5cGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBsZXQgY2FjaGVFbnRyeSA9IHRoaXMuX25vbk5vcm1hbGl6ZWREaXJlY3RpdmVDYWNoZS5nZXQoZGlyZWN0aXZlVHlwZSk7XG4gICAgaWYgKGNhY2hlRW50cnkpIHtcbiAgICAgIHJldHVybiBjYWNoZUVudHJ5O1xuICAgIH1cbiAgICBjb25zdCBkaXJNZXRhID0gdGhpcy5fZGlyZWN0aXZlUmVzb2x2ZXIucmVzb2x2ZShkaXJlY3RpdmVUeXBlLCBmYWxzZSk7XG4gICAgaWYgKCFkaXJNZXRhKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbGV0IG5vbk5vcm1hbGl6ZWRUZW1wbGF0ZU1ldGFkYXRhOiBjcGwuQ29tcGlsZVRlbXBsYXRlTWV0YWRhdGEgPSB1bmRlZmluZWQgITtcblxuICAgIGlmIChjcmVhdGVDb21wb25lbnQuaXNUeXBlT2YoZGlyTWV0YSkpIHtcbiAgICAgIC8vIGNvbXBvbmVudFxuICAgICAgY29uc3QgY29tcE1ldGEgPSBkaXJNZXRhIGFzIENvbXBvbmVudDtcbiAgICAgIGFzc2VydEFycmF5T2ZTdHJpbmdzKCdzdHlsZXMnLCBjb21wTWV0YS5zdHlsZXMpO1xuICAgICAgYXNzZXJ0QXJyYXlPZlN0cmluZ3MoJ3N0eWxlVXJscycsIGNvbXBNZXRhLnN0eWxlVXJscyk7XG4gICAgICBhc3NlcnRJbnRlcnBvbGF0aW9uU3ltYm9scygnaW50ZXJwb2xhdGlvbicsIGNvbXBNZXRhLmludGVycG9sYXRpb24pO1xuXG4gICAgICBjb25zdCBhbmltYXRpb25zID0gY29tcE1ldGEuYW5pbWF0aW9ucztcblxuICAgICAgbm9uTm9ybWFsaXplZFRlbXBsYXRlTWV0YWRhdGEgPSBuZXcgY3BsLkNvbXBpbGVUZW1wbGF0ZU1ldGFkYXRhKHtcbiAgICAgICAgZW5jYXBzdWxhdGlvbjogbm9VbmRlZmluZWQoY29tcE1ldGEuZW5jYXBzdWxhdGlvbiksXG4gICAgICAgIHRlbXBsYXRlOiBub1VuZGVmaW5lZChjb21wTWV0YS50ZW1wbGF0ZSksXG4gICAgICAgIHRlbXBsYXRlVXJsOiBub1VuZGVmaW5lZChjb21wTWV0YS50ZW1wbGF0ZVVybCksXG4gICAgICAgIGh0bWxBc3Q6IG51bGwsXG4gICAgICAgIHN0eWxlczogY29tcE1ldGEuc3R5bGVzIHx8IFtdLFxuICAgICAgICBzdHlsZVVybHM6IGNvbXBNZXRhLnN0eWxlVXJscyB8fCBbXSxcbiAgICAgICAgYW5pbWF0aW9uczogYW5pbWF0aW9ucyB8fCBbXSxcbiAgICAgICAgaW50ZXJwb2xhdGlvbjogbm9VbmRlZmluZWQoY29tcE1ldGEuaW50ZXJwb2xhdGlvbiksXG4gICAgICAgIGlzSW5saW5lOiAhIWNvbXBNZXRhLnRlbXBsYXRlLFxuICAgICAgICBleHRlcm5hbFN0eWxlc2hlZXRzOiBbXSxcbiAgICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBbXSxcbiAgICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlczogbm9VbmRlZmluZWQoZGlyTWV0YS5wcmVzZXJ2ZVdoaXRlc3BhY2VzKSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGxldCBjaGFuZ2VEZXRlY3Rpb25TdHJhdGVneTogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kgPSBudWxsICE7XG4gICAgbGV0IHZpZXdQcm92aWRlcnM6IGNwbC5Db21waWxlUHJvdmlkZXJNZXRhZGF0YVtdID0gW107XG4gICAgbGV0IGVudHJ5Q29tcG9uZW50TWV0YWRhdGE6IGNwbC5Db21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdID0gW107XG4gICAgbGV0IHNlbGVjdG9yID0gZGlyTWV0YS5zZWxlY3RvcjtcblxuICAgIGlmIChjcmVhdGVDb21wb25lbnQuaXNUeXBlT2YoZGlyTWV0YSkpIHtcbiAgICAgIC8vIENvbXBvbmVudFxuICAgICAgY29uc3QgY29tcE1ldGEgPSBkaXJNZXRhIGFzIENvbXBvbmVudDtcbiAgICAgIGNoYW5nZURldGVjdGlvblN0cmF0ZWd5ID0gY29tcE1ldGEuY2hhbmdlRGV0ZWN0aW9uICE7XG4gICAgICBpZiAoY29tcE1ldGEudmlld1Byb3ZpZGVycykge1xuICAgICAgICB2aWV3UHJvdmlkZXJzID0gdGhpcy5fZ2V0UHJvdmlkZXJzTWV0YWRhdGEoXG4gICAgICAgICAgICBjb21wTWV0YS52aWV3UHJvdmlkZXJzLCBlbnRyeUNvbXBvbmVudE1ldGFkYXRhLFxuICAgICAgICAgICAgYHZpZXdQcm92aWRlcnMgZm9yIFwiJHtzdHJpbmdpZnlUeXBlKGRpcmVjdGl2ZVR5cGUpfVwiYCwgW10sIGRpcmVjdGl2ZVR5cGUpO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBNZXRhLmVudHJ5Q29tcG9uZW50cykge1xuICAgICAgICBlbnRyeUNvbXBvbmVudE1ldGFkYXRhID0gZmxhdHRlbkFuZERlZHVwZUFycmF5KGNvbXBNZXRhLmVudHJ5Q29tcG9uZW50cylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKCh0eXBlKSA9PiB0aGlzLl9nZXRFbnRyeUNvbXBvbmVudE1ldGFkYXRhKHR5cGUpICEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNvbmNhdChlbnRyeUNvbXBvbmVudE1ldGFkYXRhKTtcbiAgICAgIH1cbiAgICAgIGlmICghc2VsZWN0b3IpIHtcbiAgICAgICAgc2VsZWN0b3IgPSB0aGlzLl9zY2hlbWFSZWdpc3RyeS5nZXREZWZhdWx0Q29tcG9uZW50RWxlbWVudE5hbWUoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0aXZlXG4gICAgICBpZiAoIXNlbGVjdG9yKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgICAgYERpcmVjdGl2ZSAke3N0cmluZ2lmeVR5cGUoZGlyZWN0aXZlVHlwZSl9IGhhcyBubyBzZWxlY3RvciwgcGxlYXNlIGFkZCBpdCFgKSxcbiAgICAgICAgICAgIGRpcmVjdGl2ZVR5cGUpO1xuICAgICAgICBzZWxlY3RvciA9ICdlcnJvcic7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IHByb3ZpZGVyczogY3BsLkNvbXBpbGVQcm92aWRlck1ldGFkYXRhW10gPSBbXTtcbiAgICBpZiAoZGlyTWV0YS5wcm92aWRlcnMgIT0gbnVsbCkge1xuICAgICAgcHJvdmlkZXJzID0gdGhpcy5fZ2V0UHJvdmlkZXJzTWV0YWRhdGEoXG4gICAgICAgICAgZGlyTWV0YS5wcm92aWRlcnMsIGVudHJ5Q29tcG9uZW50TWV0YWRhdGEsXG4gICAgICAgICAgYHByb3ZpZGVycyBmb3IgXCIke3N0cmluZ2lmeVR5cGUoZGlyZWN0aXZlVHlwZSl9XCJgLCBbXSwgZGlyZWN0aXZlVHlwZSk7XG4gICAgfVxuICAgIGxldCBxdWVyaWVzOiBjcGwuQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSA9IFtdO1xuICAgIGxldCB2aWV3UXVlcmllczogY3BsLkNvbXBpbGVRdWVyeU1ldGFkYXRhW10gPSBbXTtcbiAgICBpZiAoZGlyTWV0YS5xdWVyaWVzICE9IG51bGwpIHtcbiAgICAgIHF1ZXJpZXMgPSB0aGlzLl9nZXRRdWVyaWVzTWV0YWRhdGEoZGlyTWV0YS5xdWVyaWVzLCBmYWxzZSwgZGlyZWN0aXZlVHlwZSk7XG4gICAgICB2aWV3UXVlcmllcyA9IHRoaXMuX2dldFF1ZXJpZXNNZXRhZGF0YShkaXJNZXRhLnF1ZXJpZXMsIHRydWUsIGRpcmVjdGl2ZVR5cGUpO1xuICAgIH1cblxuICAgIGNvbnN0IG1ldGFkYXRhID0gY3BsLkNvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YS5jcmVhdGUoe1xuICAgICAgaXNIb3N0OiBmYWxzZSxcbiAgICAgIHNlbGVjdG9yOiBzZWxlY3RvcixcbiAgICAgIGV4cG9ydEFzOiBub1VuZGVmaW5lZChkaXJNZXRhLmV4cG9ydEFzKSxcbiAgICAgIGlzQ29tcG9uZW50OiAhIW5vbk5vcm1hbGl6ZWRUZW1wbGF0ZU1ldGFkYXRhLFxuICAgICAgdHlwZTogdGhpcy5fZ2V0VHlwZU1ldGFkYXRhKGRpcmVjdGl2ZVR5cGUpLFxuICAgICAgdGVtcGxhdGU6IG5vbk5vcm1hbGl6ZWRUZW1wbGF0ZU1ldGFkYXRhLFxuICAgICAgY2hhbmdlRGV0ZWN0aW9uOiBjaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSxcbiAgICAgIGlucHV0czogZGlyTWV0YS5pbnB1dHMgfHwgW10sXG4gICAgICBvdXRwdXRzOiBkaXJNZXRhLm91dHB1dHMgfHwgW10sXG4gICAgICBob3N0OiBkaXJNZXRhLmhvc3QgfHwge30sXG4gICAgICBwcm92aWRlcnM6IHByb3ZpZGVycyB8fCBbXSxcbiAgICAgIHZpZXdQcm92aWRlcnM6IHZpZXdQcm92aWRlcnMgfHwgW10sXG4gICAgICBxdWVyaWVzOiBxdWVyaWVzIHx8IFtdLFxuICAgICAgZ3VhcmRzOiBkaXJNZXRhLmd1YXJkcyB8fCB7fSxcbiAgICAgIHZpZXdRdWVyaWVzOiB2aWV3UXVlcmllcyB8fCBbXSxcbiAgICAgIGVudHJ5Q29tcG9uZW50czogZW50cnlDb21wb25lbnRNZXRhZGF0YSxcbiAgICAgIGNvbXBvbmVudFZpZXdUeXBlOiBub25Ob3JtYWxpemVkVGVtcGxhdGVNZXRhZGF0YSA/IHRoaXMuZ2V0Q29tcG9uZW50Vmlld0NsYXNzKGRpcmVjdGl2ZVR5cGUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICByZW5kZXJlclR5cGU6IG5vbk5vcm1hbGl6ZWRUZW1wbGF0ZU1ldGFkYXRhID8gdGhpcy5nZXRSZW5kZXJlclR5cGUoZGlyZWN0aXZlVHlwZSkgOiBudWxsLFxuICAgICAgY29tcG9uZW50RmFjdG9yeTogbnVsbFxuICAgIH0pO1xuICAgIGlmIChub25Ob3JtYWxpemVkVGVtcGxhdGVNZXRhZGF0YSkge1xuICAgICAgbWV0YWRhdGEuY29tcG9uZW50RmFjdG9yeSA9XG4gICAgICAgICAgdGhpcy5nZXRDb21wb25lbnRGYWN0b3J5KHNlbGVjdG9yLCBkaXJlY3RpdmVUeXBlLCBtZXRhZGF0YS5pbnB1dHMsIG1ldGFkYXRhLm91dHB1dHMpO1xuICAgIH1cbiAgICBjYWNoZUVudHJ5ID0ge21ldGFkYXRhLCBhbm5vdGF0aW9uOiBkaXJNZXRhfTtcbiAgICB0aGlzLl9ub25Ob3JtYWxpemVkRGlyZWN0aXZlQ2FjaGUuc2V0KGRpcmVjdGl2ZVR5cGUsIGNhY2hlRW50cnkpO1xuICAgIHJldHVybiBjYWNoZUVudHJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIG1ldGFkYXRhIGZvciB0aGUgZ2l2ZW4gZGlyZWN0aXZlLlxuICAgKiBUaGlzIGFzc3VtZXMgYGxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YWAgaGFzIGJlZW4gY2FsbGVkIGZpcnN0LlxuICAgKi9cbiAgZ2V0RGlyZWN0aXZlTWV0YWRhdGEoZGlyZWN0aXZlVHlwZTogYW55KTogY3BsLkNvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSB7XG4gICAgY29uc3QgZGlyTWV0YSA9IHRoaXMuX2RpcmVjdGl2ZUNhY2hlLmdldChkaXJlY3RpdmVUeXBlKSAhO1xuICAgIGlmICghZGlyTWV0YSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBnZXREaXJlY3RpdmVNZXRhZGF0YSBjYW4gb25seSBiZSBjYWxsZWQgYWZ0ZXIgbG9hZE5nTW9kdWxlRGlyZWN0aXZlQW5kUGlwZU1ldGFkYXRhIGZvciBhIG1vZHVsZSB0aGF0IGRlY2xhcmVzIGl0LiBEaXJlY3RpdmUgJHtzdHJpbmdpZnlUeXBlKGRpcmVjdGl2ZVR5cGUpfS5gKSxcbiAgICAgICAgICBkaXJlY3RpdmVUeXBlKTtcbiAgICB9XG4gICAgcmV0dXJuIGRpck1ldGE7XG4gIH1cblxuICBnZXREaXJlY3RpdmVTdW1tYXJ5KGRpclR5cGU6IGFueSk6IGNwbC5Db21waWxlRGlyZWN0aXZlU3VtbWFyeSB7XG4gICAgY29uc3QgZGlyU3VtbWFyeSA9XG4gICAgICAgIDxjcGwuQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnk+dGhpcy5fbG9hZFN1bW1hcnkoZGlyVHlwZSwgY3BsLkNvbXBpbGVTdW1tYXJ5S2luZC5EaXJlY3RpdmUpO1xuICAgIGlmICghZGlyU3VtbWFyeSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBDb3VsZCBub3QgbG9hZCB0aGUgc3VtbWFyeSBmb3IgZGlyZWN0aXZlICR7c3RyaW5naWZ5VHlwZShkaXJUeXBlKX0uYCksXG4gICAgICAgICAgZGlyVHlwZSk7XG4gICAgfVxuICAgIHJldHVybiBkaXJTdW1tYXJ5O1xuICB9XG5cbiAgaXNEaXJlY3RpdmUodHlwZTogYW55KSB7XG4gICAgcmV0dXJuICEhdGhpcy5fbG9hZFN1bW1hcnkodHlwZSwgY3BsLkNvbXBpbGVTdW1tYXJ5S2luZC5EaXJlY3RpdmUpIHx8XG4gICAgICAgIHRoaXMuX2RpcmVjdGl2ZVJlc29sdmVyLmlzRGlyZWN0aXZlKHR5cGUpO1xuICB9XG5cbiAgaXNQaXBlKHR5cGU6IGFueSkge1xuICAgIHJldHVybiAhIXRoaXMuX2xvYWRTdW1tYXJ5KHR5cGUsIGNwbC5Db21waWxlU3VtbWFyeUtpbmQuUGlwZSkgfHxcbiAgICAgICAgdGhpcy5fcGlwZVJlc29sdmVyLmlzUGlwZSh0eXBlKTtcbiAgfVxuXG4gIGlzTmdNb2R1bGUodHlwZTogYW55KSB7XG4gICAgcmV0dXJuICEhdGhpcy5fbG9hZFN1bW1hcnkodHlwZSwgY3BsLkNvbXBpbGVTdW1tYXJ5S2luZC5OZ01vZHVsZSkgfHxcbiAgICAgICAgdGhpcy5fbmdNb2R1bGVSZXNvbHZlci5pc05nTW9kdWxlKHR5cGUpO1xuICB9XG5cbiAgZ2V0TmdNb2R1bGVTdW1tYXJ5KG1vZHVsZVR5cGU6IGFueSwgYWxyZWFkeUNvbGxlY3Rpbmc6IFNldDxhbnk+fG51bGwgPSBudWxsKTpcbiAgICAgIGNwbC5Db21waWxlTmdNb2R1bGVTdW1tYXJ5fG51bGwge1xuICAgIGxldCBtb2R1bGVTdW1tYXJ5OiBjcGwuQ29tcGlsZU5nTW9kdWxlU3VtbWFyeXxudWxsID1cbiAgICAgICAgPGNwbC5Db21waWxlTmdNb2R1bGVTdW1tYXJ5PnRoaXMuX2xvYWRTdW1tYXJ5KG1vZHVsZVR5cGUsIGNwbC5Db21waWxlU3VtbWFyeUtpbmQuTmdNb2R1bGUpO1xuICAgIGlmICghbW9kdWxlU3VtbWFyeSkge1xuICAgICAgY29uc3QgbW9kdWxlTWV0YSA9IHRoaXMuZ2V0TmdNb2R1bGVNZXRhZGF0YShtb2R1bGVUeXBlLCBmYWxzZSwgYWxyZWFkeUNvbGxlY3RpbmcpO1xuICAgICAgbW9kdWxlU3VtbWFyeSA9IG1vZHVsZU1ldGEgPyBtb2R1bGVNZXRhLnRvU3VtbWFyeSgpIDogbnVsbDtcbiAgICAgIGlmIChtb2R1bGVTdW1tYXJ5KSB7XG4gICAgICAgIHRoaXMuX3N1bW1hcnlDYWNoZS5zZXQobW9kdWxlVHlwZSwgbW9kdWxlU3VtbWFyeSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBtb2R1bGVTdW1tYXJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWRzIHRoZSBkZWNsYXJlZCBkaXJlY3RpdmVzIGFuZCBwaXBlcyBvZiBhbiBOZ01vZHVsZS5cbiAgICovXG4gIGxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YShtb2R1bGVUeXBlOiBhbnksIGlzU3luYzogYm9vbGVhbiwgdGhyb3dJZk5vdEZvdW5kID0gdHJ1ZSk6XG4gICAgICBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IG5nTW9kdWxlID0gdGhpcy5nZXROZ01vZHVsZU1ldGFkYXRhKG1vZHVsZVR5cGUsIHRocm93SWZOb3RGb3VuZCk7XG4gICAgY29uc3QgbG9hZGluZzogUHJvbWlzZTxhbnk+W10gPSBbXTtcbiAgICBpZiAobmdNb2R1bGUpIHtcbiAgICAgIG5nTW9kdWxlLmRlY2xhcmVkRGlyZWN0aXZlcy5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICBjb25zdCBwcm9taXNlID0gdGhpcy5sb2FkRGlyZWN0aXZlTWV0YWRhdGEobW9kdWxlVHlwZSwgaWQucmVmZXJlbmNlLCBpc1N5bmMpO1xuICAgICAgICBpZiAocHJvbWlzZSkge1xuICAgICAgICAgIGxvYWRpbmcucHVzaChwcm9taXNlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBuZ01vZHVsZS5kZWNsYXJlZFBpcGVzLmZvckVhY2goKGlkKSA9PiB0aGlzLl9sb2FkUGlwZU1ldGFkYXRhKGlkLnJlZmVyZW5jZSkpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwobG9hZGluZyk7XG4gIH1cblxuICBnZXRTaGFsbG93TW9kdWxlTWV0YWRhdGEobW9kdWxlVHlwZTogYW55KTogY3BsLkNvbXBpbGVTaGFsbG93TW9kdWxlTWV0YWRhdGF8bnVsbCB7XG4gICAgbGV0IGNvbXBpbGVNZXRhID0gdGhpcy5fc2hhbGxvd01vZHVsZUNhY2hlLmdldChtb2R1bGVUeXBlKTtcbiAgICBpZiAoY29tcGlsZU1ldGEpIHtcbiAgICAgIHJldHVybiBjb21waWxlTWV0YTtcbiAgICB9XG5cbiAgICBjb25zdCBuZ01vZHVsZU1ldGEgPVxuICAgICAgICBmaW5kTGFzdCh0aGlzLl9yZWZsZWN0b3Iuc2hhbGxvd0Fubm90YXRpb25zKG1vZHVsZVR5cGUpLCBjcmVhdGVOZ01vZHVsZS5pc1R5cGVPZik7XG5cbiAgICBjb21waWxlTWV0YSA9IHtcbiAgICAgIHR5cGU6IHRoaXMuX2dldFR5cGVNZXRhZGF0YShtb2R1bGVUeXBlKSxcbiAgICAgIHJhd0V4cG9ydHM6IG5nTW9kdWxlTWV0YS5leHBvcnRzLFxuICAgICAgcmF3SW1wb3J0czogbmdNb2R1bGVNZXRhLmltcG9ydHMsXG4gICAgICByYXdQcm92aWRlcnM6IG5nTW9kdWxlTWV0YS5wcm92aWRlcnMsXG4gICAgfTtcblxuICAgIHRoaXMuX3NoYWxsb3dNb2R1bGVDYWNoZS5zZXQobW9kdWxlVHlwZSwgY29tcGlsZU1ldGEpO1xuICAgIHJldHVybiBjb21waWxlTWV0YTtcbiAgfVxuXG4gIGdldE5nTW9kdWxlTWV0YWRhdGEoXG4gICAgICBtb2R1bGVUeXBlOiBhbnksIHRocm93SWZOb3RGb3VuZCA9IHRydWUsXG4gICAgICBhbHJlYWR5Q29sbGVjdGluZzogU2V0PGFueT58bnVsbCA9IG51bGwpOiBjcGwuQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGF8bnVsbCB7XG4gICAgbW9kdWxlVHlwZSA9IHJlc29sdmVGb3J3YXJkUmVmKG1vZHVsZVR5cGUpO1xuICAgIGxldCBjb21waWxlTWV0YSA9IHRoaXMuX25nTW9kdWxlQ2FjaGUuZ2V0KG1vZHVsZVR5cGUpO1xuICAgIGlmIChjb21waWxlTWV0YSkge1xuICAgICAgcmV0dXJuIGNvbXBpbGVNZXRhO1xuICAgIH1cbiAgICBjb25zdCBtZXRhID0gdGhpcy5fbmdNb2R1bGVSZXNvbHZlci5yZXNvbHZlKG1vZHVsZVR5cGUsIHRocm93SWZOb3RGb3VuZCk7XG4gICAgaWYgKCFtZXRhKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZGVjbGFyZWREaXJlY3RpdmVzOiBjcGwuQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdID0gW107XG4gICAgY29uc3QgZXhwb3J0ZWROb25Nb2R1bGVJZGVudGlmaWVyczogY3BsLkNvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSA9IFtdO1xuICAgIGNvbnN0IGRlY2xhcmVkUGlwZXM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10gPSBbXTtcbiAgICBjb25zdCBpbXBvcnRlZE1vZHVsZXM6IGNwbC5Db21waWxlTmdNb2R1bGVTdW1tYXJ5W10gPSBbXTtcbiAgICBjb25zdCBleHBvcnRlZE1vZHVsZXM6IGNwbC5Db21waWxlTmdNb2R1bGVTdW1tYXJ5W10gPSBbXTtcbiAgICBjb25zdCBwcm92aWRlcnM6IGNwbC5Db21waWxlUHJvdmlkZXJNZXRhZGF0YVtdID0gW107XG4gICAgY29uc3QgZW50cnlDb21wb25lbnRzOiBjcGwuQ29tcGlsZUVudHJ5Q29tcG9uZW50TWV0YWRhdGFbXSA9IFtdO1xuICAgIGNvbnN0IGJvb3RzdHJhcENvbXBvbmVudHM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10gPSBbXTtcbiAgICBjb25zdCBzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdID0gW107XG5cbiAgICBpZiAobWV0YS5pbXBvcnRzKSB7XG4gICAgICBmbGF0dGVuQW5kRGVkdXBlQXJyYXkobWV0YS5pbXBvcnRzKS5mb3JFYWNoKChpbXBvcnRlZFR5cGUpID0+IHtcbiAgICAgICAgbGV0IGltcG9ydGVkTW9kdWxlVHlwZTogVHlwZSA9IHVuZGVmaW5lZCAhO1xuICAgICAgICBpZiAoaXNWYWxpZFR5cGUoaW1wb3J0ZWRUeXBlKSkge1xuICAgICAgICAgIGltcG9ydGVkTW9kdWxlVHlwZSA9IGltcG9ydGVkVHlwZTtcbiAgICAgICAgfSBlbHNlIGlmIChpbXBvcnRlZFR5cGUgJiYgaW1wb3J0ZWRUeXBlLm5nTW9kdWxlKSB7XG4gICAgICAgICAgY29uc3QgbW9kdWxlV2l0aFByb3ZpZGVyczogTW9kdWxlV2l0aFByb3ZpZGVycyA9IGltcG9ydGVkVHlwZTtcbiAgICAgICAgICBpbXBvcnRlZE1vZHVsZVR5cGUgPSBtb2R1bGVXaXRoUHJvdmlkZXJzLm5nTW9kdWxlO1xuICAgICAgICAgIGlmIChtb2R1bGVXaXRoUHJvdmlkZXJzLnByb3ZpZGVycykge1xuICAgICAgICAgICAgcHJvdmlkZXJzLnB1c2goLi4udGhpcy5fZ2V0UHJvdmlkZXJzTWV0YWRhdGEoXG4gICAgICAgICAgICAgICAgbW9kdWxlV2l0aFByb3ZpZGVycy5wcm92aWRlcnMsIGVudHJ5Q29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICBgcHJvdmlkZXIgZm9yIHRoZSBOZ01vZHVsZSAnJHtzdHJpbmdpZnlUeXBlKGltcG9ydGVkTW9kdWxlVHlwZSl9J2AsIFtdLFxuICAgICAgICAgICAgICAgIGltcG9ydGVkVHlwZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbXBvcnRlZE1vZHVsZVR5cGUpIHtcbiAgICAgICAgICBpZiAodGhpcy5fY2hlY2tTZWxmSW1wb3J0KG1vZHVsZVR5cGUsIGltcG9ydGVkTW9kdWxlVHlwZSkpIHJldHVybjtcbiAgICAgICAgICBpZiAoIWFscmVhZHlDb2xsZWN0aW5nKSBhbHJlYWR5Q29sbGVjdGluZyA9IG5ldyBTZXQoKTtcbiAgICAgICAgICBpZiAoYWxyZWFkeUNvbGxlY3RpbmcuaGFzKGltcG9ydGVkTW9kdWxlVHlwZSkpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLl9nZXRUeXBlRGVzY3JpcHRvcihpbXBvcnRlZE1vZHVsZVR5cGUpfSAnJHtzdHJpbmdpZnlUeXBlKGltcG9ydGVkVHlwZSl9JyBpcyBpbXBvcnRlZCByZWN1cnNpdmVseSBieSB0aGUgbW9kdWxlICcke3N0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9Jy5gKSxcbiAgICAgICAgICAgICAgICBtb2R1bGVUeXBlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgYWxyZWFkeUNvbGxlY3RpbmcuYWRkKGltcG9ydGVkTW9kdWxlVHlwZSk7XG4gICAgICAgICAgY29uc3QgaW1wb3J0ZWRNb2R1bGVTdW1tYXJ5ID1cbiAgICAgICAgICAgICAgdGhpcy5nZXROZ01vZHVsZVN1bW1hcnkoaW1wb3J0ZWRNb2R1bGVUeXBlLCBhbHJlYWR5Q29sbGVjdGluZyk7XG4gICAgICAgICAgYWxyZWFkeUNvbGxlY3RpbmcuZGVsZXRlKGltcG9ydGVkTW9kdWxlVHlwZSk7XG4gICAgICAgICAgaWYgKCFpbXBvcnRlZE1vZHVsZVN1bW1hcnkpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgICBgVW5leHBlY3RlZCAke3RoaXMuX2dldFR5cGVEZXNjcmlwdG9yKGltcG9ydGVkVHlwZSl9ICcke3N0cmluZ2lmeVR5cGUoaW1wb3J0ZWRUeXBlKX0nIGltcG9ydGVkIGJ5IHRoZSBtb2R1bGUgJyR7c3RyaW5naWZ5VHlwZShtb2R1bGVUeXBlKX0nLiBQbGVhc2UgYWRkIGEgQE5nTW9kdWxlIGFubm90YXRpb24uYCksXG4gICAgICAgICAgICAgICAgbW9kdWxlVHlwZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGltcG9ydGVkTW9kdWxlcy5wdXNoKGltcG9ydGVkTW9kdWxlU3VtbWFyeSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgYFVuZXhwZWN0ZWQgdmFsdWUgJyR7c3RyaW5naWZ5VHlwZShpbXBvcnRlZFR5cGUpfScgaW1wb3J0ZWQgYnkgdGhlIG1vZHVsZSAnJHtzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfSdgKSxcbiAgICAgICAgICAgICAgbW9kdWxlVHlwZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAobWV0YS5leHBvcnRzKSB7XG4gICAgICBmbGF0dGVuQW5kRGVkdXBlQXJyYXkobWV0YS5leHBvcnRzKS5mb3JFYWNoKChleHBvcnRlZFR5cGUpID0+IHtcbiAgICAgICAgaWYgKCFpc1ZhbGlkVHlwZShleHBvcnRlZFR5cGUpKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgYFVuZXhwZWN0ZWQgdmFsdWUgJyR7c3RyaW5naWZ5VHlwZShleHBvcnRlZFR5cGUpfScgZXhwb3J0ZWQgYnkgdGhlIG1vZHVsZSAnJHtzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfSdgKSxcbiAgICAgICAgICAgICAgbW9kdWxlVHlwZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghYWxyZWFkeUNvbGxlY3RpbmcpIGFscmVhZHlDb2xsZWN0aW5nID0gbmV3IFNldCgpO1xuICAgICAgICBpZiAoYWxyZWFkeUNvbGxlY3RpbmcuaGFzKGV4cG9ydGVkVHlwZSkpIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgICAgICBgJHt0aGlzLl9nZXRUeXBlRGVzY3JpcHRvcihleHBvcnRlZFR5cGUpfSAnJHtzdHJpbmdpZnkoZXhwb3J0ZWRUeXBlKX0nIGlzIGV4cG9ydGVkIHJlY3Vyc2l2ZWx5IGJ5IHRoZSBtb2R1bGUgJyR7c3RyaW5naWZ5VHlwZShtb2R1bGVUeXBlKX0nYCksXG4gICAgICAgICAgICAgIG1vZHVsZVR5cGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBhbHJlYWR5Q29sbGVjdGluZy5hZGQoZXhwb3J0ZWRUeXBlKTtcbiAgICAgICAgY29uc3QgZXhwb3J0ZWRNb2R1bGVTdW1tYXJ5ID0gdGhpcy5nZXROZ01vZHVsZVN1bW1hcnkoZXhwb3J0ZWRUeXBlLCBhbHJlYWR5Q29sbGVjdGluZyk7XG4gICAgICAgIGFscmVhZHlDb2xsZWN0aW5nLmRlbGV0ZShleHBvcnRlZFR5cGUpO1xuICAgICAgICBpZiAoZXhwb3J0ZWRNb2R1bGVTdW1tYXJ5KSB7XG4gICAgICAgICAgZXhwb3J0ZWRNb2R1bGVzLnB1c2goZXhwb3J0ZWRNb2R1bGVTdW1tYXJ5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBleHBvcnRlZE5vbk1vZHVsZUlkZW50aWZpZXJzLnB1c2godGhpcy5fZ2V0SWRlbnRpZmllck1ldGFkYXRhKGV4cG9ydGVkVHlwZSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBOb3RlOiBUaGlzIHdpbGwgYmUgbW9kaWZpZWQgbGF0ZXIsIHNvIHdlIHJlbHkgb25cbiAgICAvLyBnZXR0aW5nIGEgbmV3IGluc3RhbmNlIGV2ZXJ5IHRpbWUhXG4gICAgY29uc3QgdHJhbnNpdGl2ZU1vZHVsZSA9IHRoaXMuX2dldFRyYW5zaXRpdmVOZ01vZHVsZU1ldGFkYXRhKGltcG9ydGVkTW9kdWxlcywgZXhwb3J0ZWRNb2R1bGVzKTtcbiAgICBpZiAobWV0YS5kZWNsYXJhdGlvbnMpIHtcbiAgICAgIGZsYXR0ZW5BbmREZWR1cGVBcnJheShtZXRhLmRlY2xhcmF0aW9ucykuZm9yRWFjaCgoZGVjbGFyZWRUeXBlKSA9PiB7XG4gICAgICAgIGlmICghaXNWYWxpZFR5cGUoZGVjbGFyZWRUeXBlKSkge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBzeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgICAgIGBVbmV4cGVjdGVkIHZhbHVlICcke3N0cmluZ2lmeVR5cGUoZGVjbGFyZWRUeXBlKX0nIGRlY2xhcmVkIGJ5IHRoZSBtb2R1bGUgJyR7c3RyaW5naWZ5VHlwZShtb2R1bGVUeXBlKX0nYCksXG4gICAgICAgICAgICAgIG1vZHVsZVR5cGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkZWNsYXJlZElkZW50aWZpZXIgPSB0aGlzLl9nZXRJZGVudGlmaWVyTWV0YWRhdGEoZGVjbGFyZWRUeXBlKTtcbiAgICAgICAgaWYgKHRoaXMuaXNEaXJlY3RpdmUoZGVjbGFyZWRUeXBlKSkge1xuICAgICAgICAgIHRyYW5zaXRpdmVNb2R1bGUuYWRkRGlyZWN0aXZlKGRlY2xhcmVkSWRlbnRpZmllcik7XG4gICAgICAgICAgZGVjbGFyZWREaXJlY3RpdmVzLnB1c2goZGVjbGFyZWRJZGVudGlmaWVyKTtcbiAgICAgICAgICB0aGlzLl9hZGRUeXBlVG9Nb2R1bGUoZGVjbGFyZWRUeXBlLCBtb2R1bGVUeXBlKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmlzUGlwZShkZWNsYXJlZFR5cGUpKSB7XG4gICAgICAgICAgdHJhbnNpdGl2ZU1vZHVsZS5hZGRQaXBlKGRlY2xhcmVkSWRlbnRpZmllcik7XG4gICAgICAgICAgdHJhbnNpdGl2ZU1vZHVsZS5waXBlcy5wdXNoKGRlY2xhcmVkSWRlbnRpZmllcik7XG4gICAgICAgICAgZGVjbGFyZWRQaXBlcy5wdXNoKGRlY2xhcmVkSWRlbnRpZmllcik7XG4gICAgICAgICAgdGhpcy5fYWRkVHlwZVRvTW9kdWxlKGRlY2xhcmVkVHlwZSwgbW9kdWxlVHlwZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgYFVuZXhwZWN0ZWQgJHt0aGlzLl9nZXRUeXBlRGVzY3JpcHRvcihkZWNsYXJlZFR5cGUpfSAnJHtzdHJpbmdpZnlUeXBlKGRlY2xhcmVkVHlwZSl9JyBkZWNsYXJlZCBieSB0aGUgbW9kdWxlICcke3N0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9Jy4gUGxlYXNlIGFkZCBhIEBQaXBlL0BEaXJlY3RpdmUvQENvbXBvbmVudCBhbm5vdGF0aW9uLmApLFxuICAgICAgICAgICAgICBtb2R1bGVUeXBlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGV4cG9ydGVkRGlyZWN0aXZlczogY3BsLkNvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSA9IFtdO1xuICAgIGNvbnN0IGV4cG9ydGVkUGlwZXM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10gPSBbXTtcbiAgICBleHBvcnRlZE5vbk1vZHVsZUlkZW50aWZpZXJzLmZvckVhY2goKGV4cG9ydGVkSWQpID0+IHtcbiAgICAgIGlmICh0cmFuc2l0aXZlTW9kdWxlLmRpcmVjdGl2ZXNTZXQuaGFzKGV4cG9ydGVkSWQucmVmZXJlbmNlKSkge1xuICAgICAgICBleHBvcnRlZERpcmVjdGl2ZXMucHVzaChleHBvcnRlZElkKTtcbiAgICAgICAgdHJhbnNpdGl2ZU1vZHVsZS5hZGRFeHBvcnRlZERpcmVjdGl2ZShleHBvcnRlZElkKTtcbiAgICAgIH0gZWxzZSBpZiAodHJhbnNpdGl2ZU1vZHVsZS5waXBlc1NldC5oYXMoZXhwb3J0ZWRJZC5yZWZlcmVuY2UpKSB7XG4gICAgICAgIGV4cG9ydGVkUGlwZXMucHVzaChleHBvcnRlZElkKTtcbiAgICAgICAgdHJhbnNpdGl2ZU1vZHVsZS5hZGRFeHBvcnRlZFBpcGUoZXhwb3J0ZWRJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgIGBDYW4ndCBleHBvcnQgJHt0aGlzLl9nZXRUeXBlRGVzY3JpcHRvcihleHBvcnRlZElkLnJlZmVyZW5jZSl9ICR7c3RyaW5naWZ5VHlwZShleHBvcnRlZElkLnJlZmVyZW5jZSl9IGZyb20gJHtzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfSBhcyBpdCB3YXMgbmVpdGhlciBkZWNsYXJlZCBub3IgaW1wb3J0ZWQhYCksXG4gICAgICAgICAgICBtb2R1bGVUeXBlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVGhlIHByb3ZpZGVycyBvZiB0aGUgbW9kdWxlIGhhdmUgdG8gZ28gbGFzdFxuICAgIC8vIHNvIHRoYXQgdGhleSBvdmVyd3JpdGUgYW55IG90aGVyIHByb3ZpZGVyIHdlIGFscmVhZHkgYWRkZWQuXG4gICAgaWYgKG1ldGEucHJvdmlkZXJzKSB7XG4gICAgICBwcm92aWRlcnMucHVzaCguLi50aGlzLl9nZXRQcm92aWRlcnNNZXRhZGF0YShcbiAgICAgICAgICBtZXRhLnByb3ZpZGVycywgZW50cnlDb21wb25lbnRzLFxuICAgICAgICAgIGBwcm92aWRlciBmb3IgdGhlIE5nTW9kdWxlICcke3N0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9J2AsIFtdLCBtb2R1bGVUeXBlKSk7XG4gICAgfVxuXG4gICAgaWYgKG1ldGEuZW50cnlDb21wb25lbnRzKSB7XG4gICAgICBlbnRyeUNvbXBvbmVudHMucHVzaCguLi5mbGF0dGVuQW5kRGVkdXBlQXJyYXkobWV0YS5lbnRyeUNvbXBvbmVudHMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCh0eXBlID0+IHRoaXMuX2dldEVudHJ5Q29tcG9uZW50TWV0YWRhdGEodHlwZSkgISkpO1xuICAgIH1cblxuICAgIGlmIChtZXRhLmJvb3RzdHJhcCkge1xuICAgICAgZmxhdHRlbkFuZERlZHVwZUFycmF5KG1ldGEuYm9vdHN0cmFwKS5mb3JFYWNoKHR5cGUgPT4ge1xuICAgICAgICBpZiAoIWlzVmFsaWRUeXBlKHR5cGUpKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIHN5bnRheEVycm9yKFxuICAgICAgICAgICAgICAgICAgYFVuZXhwZWN0ZWQgdmFsdWUgJyR7c3RyaW5naWZ5VHlwZSh0eXBlKX0nIHVzZWQgaW4gdGhlIGJvb3RzdHJhcCBwcm9wZXJ0eSBvZiBtb2R1bGUgJyR7c3RyaW5naWZ5VHlwZShtb2R1bGVUeXBlKX0nYCksXG4gICAgICAgICAgICAgIG1vZHVsZVR5cGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBib290c3RyYXBDb21wb25lbnRzLnB1c2godGhpcy5fZ2V0SWRlbnRpZmllck1ldGFkYXRhKHR5cGUpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGVudHJ5Q29tcG9uZW50cy5wdXNoKFxuICAgICAgICAuLi5ib290c3RyYXBDb21wb25lbnRzLm1hcCh0eXBlID0+IHRoaXMuX2dldEVudHJ5Q29tcG9uZW50TWV0YWRhdGEodHlwZS5yZWZlcmVuY2UpICEpKTtcblxuICAgIGlmIChtZXRhLnNjaGVtYXMpIHtcbiAgICAgIHNjaGVtYXMucHVzaCguLi5mbGF0dGVuQW5kRGVkdXBlQXJyYXkobWV0YS5zY2hlbWFzKSk7XG4gICAgfVxuXG4gICAgY29tcGlsZU1ldGEgPSBuZXcgY3BsLkNvbXBpbGVOZ01vZHVsZU1ldGFkYXRhKHtcbiAgICAgIHR5cGU6IHRoaXMuX2dldFR5cGVNZXRhZGF0YShtb2R1bGVUeXBlKSxcbiAgICAgIHByb3ZpZGVycyxcbiAgICAgIGVudHJ5Q29tcG9uZW50cyxcbiAgICAgIGJvb3RzdHJhcENvbXBvbmVudHMsXG4gICAgICBzY2hlbWFzLFxuICAgICAgZGVjbGFyZWREaXJlY3RpdmVzLFxuICAgICAgZXhwb3J0ZWREaXJlY3RpdmVzLFxuICAgICAgZGVjbGFyZWRQaXBlcyxcbiAgICAgIGV4cG9ydGVkUGlwZXMsXG4gICAgICBpbXBvcnRlZE1vZHVsZXMsXG4gICAgICBleHBvcnRlZE1vZHVsZXMsXG4gICAgICB0cmFuc2l0aXZlTW9kdWxlLFxuICAgICAgaWQ6IG1ldGEuaWQgfHwgbnVsbCxcbiAgICB9KTtcblxuICAgIGVudHJ5Q29tcG9uZW50cy5mb3JFYWNoKChpZCkgPT4gdHJhbnNpdGl2ZU1vZHVsZS5hZGRFbnRyeUNvbXBvbmVudChpZCkpO1xuICAgIHByb3ZpZGVycy5mb3JFYWNoKChwcm92aWRlcikgPT4gdHJhbnNpdGl2ZU1vZHVsZS5hZGRQcm92aWRlcihwcm92aWRlciwgY29tcGlsZU1ldGEgIS50eXBlKSk7XG4gICAgdHJhbnNpdGl2ZU1vZHVsZS5hZGRNb2R1bGUoY29tcGlsZU1ldGEudHlwZSk7XG4gICAgdGhpcy5fbmdNb2R1bGVDYWNoZS5zZXQobW9kdWxlVHlwZSwgY29tcGlsZU1ldGEpO1xuICAgIHJldHVybiBjb21waWxlTWV0YTtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrU2VsZkltcG9ydChtb2R1bGVUeXBlOiBUeXBlLCBpbXBvcnRlZE1vZHVsZVR5cGU6IFR5cGUpOiBib29sZWFuIHtcbiAgICBpZiAobW9kdWxlVHlwZSA9PT0gaW1wb3J0ZWRNb2R1bGVUeXBlKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBzeW50YXhFcnJvcihgJyR7c3RyaW5naWZ5VHlwZShtb2R1bGVUeXBlKX0nIG1vZHVsZSBjYW4ndCBpbXBvcnQgaXRzZWxmYCksIG1vZHVsZVR5cGUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFR5cGVEZXNjcmlwdG9yKHR5cGU6IFR5cGUpOiBzdHJpbmcge1xuICAgIGlmIChpc1ZhbGlkVHlwZSh0eXBlKSkge1xuICAgICAgaWYgKHRoaXMuaXNEaXJlY3RpdmUodHlwZSkpIHtcbiAgICAgICAgcmV0dXJuICdkaXJlY3RpdmUnO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5pc1BpcGUodHlwZSkpIHtcbiAgICAgICAgcmV0dXJuICdwaXBlJztcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuaXNOZ01vZHVsZSh0eXBlKSkge1xuICAgICAgICByZXR1cm4gJ21vZHVsZSc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCh0eXBlIGFzIGFueSkucHJvdmlkZSkge1xuICAgICAgcmV0dXJuICdwcm92aWRlcic7XG4gICAgfVxuXG4gICAgcmV0dXJuICd2YWx1ZSc7XG4gIH1cblxuXG4gIHByaXZhdGUgX2FkZFR5cGVUb01vZHVsZSh0eXBlOiBUeXBlLCBtb2R1bGVUeXBlOiBUeXBlKSB7XG4gICAgY29uc3Qgb2xkTW9kdWxlID0gdGhpcy5fbmdNb2R1bGVPZlR5cGVzLmdldCh0eXBlKTtcbiAgICBpZiAob2xkTW9kdWxlICYmIG9sZE1vZHVsZSAhPT0gbW9kdWxlVHlwZSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBUeXBlICR7c3RyaW5naWZ5VHlwZSh0eXBlKX0gaXMgcGFydCBvZiB0aGUgZGVjbGFyYXRpb25zIG9mIDIgbW9kdWxlczogJHtzdHJpbmdpZnlUeXBlKG9sZE1vZHVsZSl9IGFuZCAke3N0cmluZ2lmeVR5cGUobW9kdWxlVHlwZSl9ISBgICtcbiAgICAgICAgICAgICAgYFBsZWFzZSBjb25zaWRlciBtb3ZpbmcgJHtzdHJpbmdpZnlUeXBlKHR5cGUpfSB0byBhIGhpZ2hlciBtb2R1bGUgdGhhdCBpbXBvcnRzICR7c3RyaW5naWZ5VHlwZShvbGRNb2R1bGUpfSBhbmQgJHtzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfS4gYCArXG4gICAgICAgICAgICAgIGBZb3UgY2FuIGFsc28gY3JlYXRlIGEgbmV3IE5nTW9kdWxlIHRoYXQgZXhwb3J0cyBhbmQgaW5jbHVkZXMgJHtzdHJpbmdpZnlUeXBlKHR5cGUpfSB0aGVuIGltcG9ydCB0aGF0IE5nTW9kdWxlIGluICR7c3RyaW5naWZ5VHlwZShvbGRNb2R1bGUpfSBhbmQgJHtzdHJpbmdpZnlUeXBlKG1vZHVsZVR5cGUpfS5gKSxcbiAgICAgICAgICBtb2R1bGVUeXBlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5fbmdNb2R1bGVPZlR5cGVzLnNldCh0eXBlLCBtb2R1bGVUeXBlKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFRyYW5zaXRpdmVOZ01vZHVsZU1ldGFkYXRhKFxuICAgICAgaW1wb3J0ZWRNb2R1bGVzOiBjcGwuQ29tcGlsZU5nTW9kdWxlU3VtbWFyeVtdLFxuICAgICAgZXhwb3J0ZWRNb2R1bGVzOiBjcGwuQ29tcGlsZU5nTW9kdWxlU3VtbWFyeVtdKTogY3BsLlRyYW5zaXRpdmVDb21waWxlTmdNb2R1bGVNZXRhZGF0YSB7XG4gICAgLy8gY29sbGVjdCBgcHJvdmlkZXJzYCAvIGBlbnRyeUNvbXBvbmVudHNgIGZyb20gYWxsIGltcG9ydGVkIGFuZCBhbGwgZXhwb3J0ZWQgbW9kdWxlc1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBjcGwuVHJhbnNpdGl2ZUNvbXBpbGVOZ01vZHVsZU1ldGFkYXRhKCk7XG4gICAgY29uc3QgbW9kdWxlc0J5VG9rZW4gPSBuZXcgTWFwPGFueSwgU2V0PGFueT4+KCk7XG4gICAgaW1wb3J0ZWRNb2R1bGVzLmNvbmNhdChleHBvcnRlZE1vZHVsZXMpLmZvckVhY2goKG1vZFN1bW1hcnkpID0+IHtcbiAgICAgIG1vZFN1bW1hcnkubW9kdWxlcy5mb3JFYWNoKChtb2QpID0+IHJlc3VsdC5hZGRNb2R1bGUobW9kKSk7XG4gICAgICBtb2RTdW1tYXJ5LmVudHJ5Q29tcG9uZW50cy5mb3JFYWNoKChjb21wKSA9PiByZXN1bHQuYWRkRW50cnlDb21wb25lbnQoY29tcCkpO1xuICAgICAgY29uc3QgYWRkZWRUb2tlbnMgPSBuZXcgU2V0PGFueT4oKTtcbiAgICAgIG1vZFN1bW1hcnkucHJvdmlkZXJzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICAgIGNvbnN0IHRva2VuUmVmID0gY3BsLnRva2VuUmVmZXJlbmNlKGVudHJ5LnByb3ZpZGVyLnRva2VuKTtcbiAgICAgICAgbGV0IHByZXZNb2R1bGVzID0gbW9kdWxlc0J5VG9rZW4uZ2V0KHRva2VuUmVmKTtcbiAgICAgICAgaWYgKCFwcmV2TW9kdWxlcykge1xuICAgICAgICAgIHByZXZNb2R1bGVzID0gbmV3IFNldDxhbnk+KCk7XG4gICAgICAgICAgbW9kdWxlc0J5VG9rZW4uc2V0KHRva2VuUmVmLCBwcmV2TW9kdWxlcyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbW9kdWxlUmVmID0gZW50cnkubW9kdWxlLnJlZmVyZW5jZTtcbiAgICAgICAgLy8gTm90ZTogdGhlIHByb3ZpZGVycyBvZiBvbmUgbW9kdWxlIG1heSBzdGlsbCBjb250YWluIG11bHRpcGxlIHByb3ZpZGVyc1xuICAgICAgICAvLyBwZXIgdG9rZW4gKGUuZy4gZm9yIG11bHRpIHByb3ZpZGVycyksIGFuZCB3ZSBuZWVkIHRvIHByZXNlcnZlIHRoZXNlLlxuICAgICAgICBpZiAoYWRkZWRUb2tlbnMuaGFzKHRva2VuUmVmKSB8fCAhcHJldk1vZHVsZXMuaGFzKG1vZHVsZVJlZikpIHtcbiAgICAgICAgICBwcmV2TW9kdWxlcy5hZGQobW9kdWxlUmVmKTtcbiAgICAgICAgICBhZGRlZFRva2Vucy5hZGQodG9rZW5SZWYpO1xuICAgICAgICAgIHJlc3VsdC5hZGRQcm92aWRlcihlbnRyeS5wcm92aWRlciwgZW50cnkubW9kdWxlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgZXhwb3J0ZWRNb2R1bGVzLmZvckVhY2goKG1vZFN1bW1hcnkpID0+IHtcbiAgICAgIG1vZFN1bW1hcnkuZXhwb3J0ZWREaXJlY3RpdmVzLmZvckVhY2goKGlkKSA9PiByZXN1bHQuYWRkRXhwb3J0ZWREaXJlY3RpdmUoaWQpKTtcbiAgICAgIG1vZFN1bW1hcnkuZXhwb3J0ZWRQaXBlcy5mb3JFYWNoKChpZCkgPT4gcmVzdWx0LmFkZEV4cG9ydGVkUGlwZShpZCkpO1xuICAgIH0pO1xuICAgIGltcG9ydGVkTW9kdWxlcy5mb3JFYWNoKChtb2RTdW1tYXJ5KSA9PiB7XG4gICAgICBtb2RTdW1tYXJ5LmV4cG9ydGVkRGlyZWN0aXZlcy5mb3JFYWNoKChpZCkgPT4gcmVzdWx0LmFkZERpcmVjdGl2ZShpZCkpO1xuICAgICAgbW9kU3VtbWFyeS5leHBvcnRlZFBpcGVzLmZvckVhY2goKGlkKSA9PiByZXN1bHQuYWRkUGlwZShpZCkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwcml2YXRlIF9nZXRJZGVudGlmaWVyTWV0YWRhdGEodHlwZTogVHlwZSk6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhIHtcbiAgICB0eXBlID0gcmVzb2x2ZUZvcndhcmRSZWYodHlwZSk7XG4gICAgcmV0dXJuIHtyZWZlcmVuY2U6IHR5cGV9O1xuICB9XG5cbiAgaXNJbmplY3RhYmxlKHR5cGU6IGFueSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGFubm90YXRpb25zID0gdGhpcy5fcmVmbGVjdG9yLnRyeUFubm90YXRpb25zKHR5cGUpO1xuICAgIHJldHVybiBhbm5vdGF0aW9ucy5zb21lKGFubiA9PiBjcmVhdGVJbmplY3RhYmxlLmlzVHlwZU9mKGFubikpO1xuICB9XG5cbiAgZ2V0SW5qZWN0YWJsZVN1bW1hcnkodHlwZTogYW55KTogY3BsLkNvbXBpbGVUeXBlU3VtbWFyeSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1bW1hcnlLaW5kOiBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLkluamVjdGFibGUsXG4gICAgICB0eXBlOiB0aGlzLl9nZXRUeXBlTWV0YWRhdGEodHlwZSwgbnVsbCwgZmFsc2UpXG4gICAgfTtcbiAgfVxuXG4gIGdldEluamVjdGFibGVNZXRhZGF0YShcbiAgICAgIHR5cGU6IGFueSwgZGVwZW5kZW5jaWVzOiBhbnlbXXxudWxsID0gbnVsbCxcbiAgICAgIHRocm93T25Vbmtub3duRGVwczogYm9vbGVhbiA9IHRydWUpOiBjcGwuQ29tcGlsZUluamVjdGFibGVNZXRhZGF0YXxudWxsIHtcbiAgICBjb25zdCB0eXBlU3VtbWFyeSA9IHRoaXMuX2xvYWRTdW1tYXJ5KHR5cGUsIGNwbC5Db21waWxlU3VtbWFyeUtpbmQuSW5qZWN0YWJsZSk7XG4gICAgY29uc3QgdHlwZU1ldGFkYXRhID0gdHlwZVN1bW1hcnkgP1xuICAgICAgICB0eXBlU3VtbWFyeS50eXBlIDpcbiAgICAgICAgdGhpcy5fZ2V0VHlwZU1ldGFkYXRhKHR5cGUsIGRlcGVuZGVuY2llcywgdGhyb3dPblVua25vd25EZXBzKTtcblxuICAgIGNvbnN0IGFubm90YXRpb25zOiBJbmplY3RhYmxlW10gPVxuICAgICAgICB0aGlzLl9yZWZsZWN0b3IuYW5ub3RhdGlvbnModHlwZSkuZmlsdGVyKGFubiA9PiBjcmVhdGVJbmplY3RhYmxlLmlzVHlwZU9mKGFubikpO1xuXG4gICAgaWYgKGFubm90YXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YSA9IGFubm90YXRpb25zW2Fubm90YXRpb25zLmxlbmd0aCAtIDFdO1xuICAgIHJldHVybiB7XG4gICAgICBzeW1ib2w6IHR5cGUsXG4gICAgICB0eXBlOiB0eXBlTWV0YWRhdGEsXG4gICAgICBwcm92aWRlZEluOiBtZXRhLnByb3ZpZGVkSW4sXG4gICAgICB1c2VWYWx1ZTogbWV0YS51c2VWYWx1ZSxcbiAgICAgIHVzZUNsYXNzOiBtZXRhLnVzZUNsYXNzLFxuICAgICAgdXNlRXhpc3Rpbmc6IG1ldGEudXNlRXhpc3RpbmcsXG4gICAgICB1c2VGYWN0b3J5OiBtZXRhLnVzZUZhY3RvcnksXG4gICAgICBkZXBzOiBtZXRhLmRlcHMsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFR5cGVNZXRhZGF0YSh0eXBlOiBUeXBlLCBkZXBlbmRlbmNpZXM6IGFueVtdfG51bGwgPSBudWxsLCB0aHJvd09uVW5rbm93bkRlcHMgPSB0cnVlKTpcbiAgICAgIGNwbC5Db21waWxlVHlwZU1ldGFkYXRhIHtcbiAgICBjb25zdCBpZGVudGlmaWVyID0gdGhpcy5fZ2V0SWRlbnRpZmllck1ldGFkYXRhKHR5cGUpO1xuICAgIHJldHVybiB7XG4gICAgICByZWZlcmVuY2U6IGlkZW50aWZpZXIucmVmZXJlbmNlLFxuICAgICAgZGlEZXBzOiB0aGlzLl9nZXREZXBlbmRlbmNpZXNNZXRhZGF0YShpZGVudGlmaWVyLnJlZmVyZW5jZSwgZGVwZW5kZW5jaWVzLCB0aHJvd09uVW5rbm93bkRlcHMpLFxuICAgICAgbGlmZWN5Y2xlSG9va3M6IGdldEFsbExpZmVjeWNsZUhvb2tzKHRoaXMuX3JlZmxlY3RvciwgaWRlbnRpZmllci5yZWZlcmVuY2UpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9nZXRGYWN0b3J5TWV0YWRhdGEoZmFjdG9yeTogRnVuY3Rpb24sIGRlcGVuZGVuY2llczogYW55W118bnVsbCA9IG51bGwpOlxuICAgICAgY3BsLkNvbXBpbGVGYWN0b3J5TWV0YWRhdGEge1xuICAgIGZhY3RvcnkgPSByZXNvbHZlRm9yd2FyZFJlZihmYWN0b3J5KTtcbiAgICByZXR1cm4ge3JlZmVyZW5jZTogZmFjdG9yeSwgZGlEZXBzOiB0aGlzLl9nZXREZXBlbmRlbmNpZXNNZXRhZGF0YShmYWN0b3J5LCBkZXBlbmRlbmNpZXMpfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBtZXRhZGF0YSBmb3IgdGhlIGdpdmVuIHBpcGUuXG4gICAqIFRoaXMgYXNzdW1lcyBgbG9hZE5nTW9kdWxlRGlyZWN0aXZlQW5kUGlwZU1ldGFkYXRhYCBoYXMgYmVlbiBjYWxsZWQgZmlyc3QuXG4gICAqL1xuICBnZXRQaXBlTWV0YWRhdGEocGlwZVR5cGU6IGFueSk6IGNwbC5Db21waWxlUGlwZU1ldGFkYXRhfG51bGwge1xuICAgIGNvbnN0IHBpcGVNZXRhID0gdGhpcy5fcGlwZUNhY2hlLmdldChwaXBlVHlwZSk7XG4gICAgaWYgKCFwaXBlTWV0YSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBnZXRQaXBlTWV0YWRhdGEgY2FuIG9ubHkgYmUgY2FsbGVkIGFmdGVyIGxvYWROZ01vZHVsZURpcmVjdGl2ZUFuZFBpcGVNZXRhZGF0YSBmb3IgYSBtb2R1bGUgdGhhdCBkZWNsYXJlcyBpdC4gUGlwZSAke3N0cmluZ2lmeVR5cGUocGlwZVR5cGUpfS5gKSxcbiAgICAgICAgICBwaXBlVHlwZSk7XG4gICAgfVxuICAgIHJldHVybiBwaXBlTWV0YSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0UGlwZVN1bW1hcnkocGlwZVR5cGU6IGFueSk6IGNwbC5Db21waWxlUGlwZVN1bW1hcnkge1xuICAgIGNvbnN0IHBpcGVTdW1tYXJ5ID1cbiAgICAgICAgPGNwbC5Db21waWxlUGlwZVN1bW1hcnk+dGhpcy5fbG9hZFN1bW1hcnkocGlwZVR5cGUsIGNwbC5Db21waWxlU3VtbWFyeUtpbmQuUGlwZSk7XG4gICAgaWYgKCFwaXBlU3VtbWFyeSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBDb3VsZCBub3QgbG9hZCB0aGUgc3VtbWFyeSBmb3IgcGlwZSAke3N0cmluZ2lmeVR5cGUocGlwZVR5cGUpfS5gKSxcbiAgICAgICAgICBwaXBlVHlwZSk7XG4gICAgfVxuICAgIHJldHVybiBwaXBlU3VtbWFyeTtcbiAgfVxuXG4gIGdldE9yTG9hZFBpcGVNZXRhZGF0YShwaXBlVHlwZTogYW55KTogY3BsLkNvbXBpbGVQaXBlTWV0YWRhdGEge1xuICAgIGxldCBwaXBlTWV0YSA9IHRoaXMuX3BpcGVDYWNoZS5nZXQocGlwZVR5cGUpO1xuICAgIGlmICghcGlwZU1ldGEpIHtcbiAgICAgIHBpcGVNZXRhID0gdGhpcy5fbG9hZFBpcGVNZXRhZGF0YShwaXBlVHlwZSk7XG4gICAgfVxuICAgIHJldHVybiBwaXBlTWV0YTtcbiAgfVxuXG4gIHByaXZhdGUgX2xvYWRQaXBlTWV0YWRhdGEocGlwZVR5cGU6IGFueSk6IGNwbC5Db21waWxlUGlwZU1ldGFkYXRhIHtcbiAgICBwaXBlVHlwZSA9IHJlc29sdmVGb3J3YXJkUmVmKHBpcGVUeXBlKTtcbiAgICBjb25zdCBwaXBlQW5ub3RhdGlvbiA9IHRoaXMuX3BpcGVSZXNvbHZlci5yZXNvbHZlKHBpcGVUeXBlKSAhO1xuXG4gICAgY29uc3QgcGlwZU1ldGEgPSBuZXcgY3BsLkNvbXBpbGVQaXBlTWV0YWRhdGEoe1xuICAgICAgdHlwZTogdGhpcy5fZ2V0VHlwZU1ldGFkYXRhKHBpcGVUeXBlKSxcbiAgICAgIG5hbWU6IHBpcGVBbm5vdGF0aW9uLm5hbWUsXG4gICAgICBwdXJlOiAhIXBpcGVBbm5vdGF0aW9uLnB1cmVcbiAgICB9KTtcbiAgICB0aGlzLl9waXBlQ2FjaGUuc2V0KHBpcGVUeXBlLCBwaXBlTWV0YSk7XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlLnNldChwaXBlVHlwZSwgcGlwZU1ldGEudG9TdW1tYXJ5KCkpO1xuICAgIHJldHVybiBwaXBlTWV0YTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldERlcGVuZGVuY2llc01ldGFkYXRhKFxuICAgICAgdHlwZU9yRnVuYzogVHlwZXxGdW5jdGlvbiwgZGVwZW5kZW5jaWVzOiBhbnlbXXxudWxsLFxuICAgICAgdGhyb3dPblVua25vd25EZXBzID0gdHJ1ZSk6IGNwbC5Db21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGFbXSB7XG4gICAgbGV0IGhhc1Vua25vd25EZXBzID0gZmFsc2U7XG4gICAgY29uc3QgcGFyYW1zID0gZGVwZW5kZW5jaWVzIHx8IHRoaXMuX3JlZmxlY3Rvci5wYXJhbWV0ZXJzKHR5cGVPckZ1bmMpIHx8IFtdO1xuXG4gICAgY29uc3QgZGVwZW5kZW5jaWVzTWV0YWRhdGE6IGNwbC5Db21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGFbXSA9IHBhcmFtcy5tYXAoKHBhcmFtKSA9PiB7XG4gICAgICBsZXQgaXNBdHRyaWJ1dGUgPSBmYWxzZTtcbiAgICAgIGxldCBpc0hvc3QgPSBmYWxzZTtcbiAgICAgIGxldCBpc1NlbGYgPSBmYWxzZTtcbiAgICAgIGxldCBpc1NraXBTZWxmID0gZmFsc2U7XG4gICAgICBsZXQgaXNPcHRpb25hbCA9IGZhbHNlO1xuICAgICAgbGV0IHRva2VuOiBhbnkgPSBudWxsO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyYW0pKSB7XG4gICAgICAgIHBhcmFtLmZvckVhY2goKHBhcmFtRW50cnkpID0+IHtcbiAgICAgICAgICBpZiAoY3JlYXRlSG9zdC5pc1R5cGVPZihwYXJhbUVudHJ5KSkge1xuICAgICAgICAgICAgaXNIb3N0ID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNyZWF0ZVNlbGYuaXNUeXBlT2YocGFyYW1FbnRyeSkpIHtcbiAgICAgICAgICAgIGlzU2VsZiA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjcmVhdGVTa2lwU2VsZi5pc1R5cGVPZihwYXJhbUVudHJ5KSkge1xuICAgICAgICAgICAgaXNTa2lwU2VsZiA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjcmVhdGVPcHRpb25hbC5pc1R5cGVPZihwYXJhbUVudHJ5KSkge1xuICAgICAgICAgICAgaXNPcHRpb25hbCA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjcmVhdGVBdHRyaWJ1dGUuaXNUeXBlT2YocGFyYW1FbnRyeSkpIHtcbiAgICAgICAgICAgIGlzQXR0cmlidXRlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRva2VuID0gcGFyYW1FbnRyeS5hdHRyaWJ1dGVOYW1lO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY3JlYXRlSW5qZWN0LmlzVHlwZU9mKHBhcmFtRW50cnkpKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHBhcmFtRW50cnkudG9rZW47XG4gICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgICAgY3JlYXRlSW5qZWN0aW9uVG9rZW4uaXNUeXBlT2YocGFyYW1FbnRyeSkgfHwgcGFyYW1FbnRyeSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgICAgICAgdG9rZW4gPSBwYXJhbUVudHJ5O1xuICAgICAgICAgIH0gZWxzZSBpZiAoaXNWYWxpZFR5cGUocGFyYW1FbnRyeSkgJiYgdG9rZW4gPT0gbnVsbCkge1xuICAgICAgICAgICAgdG9rZW4gPSBwYXJhbUVudHJ5O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0b2tlbiA9IHBhcmFtO1xuICAgICAgfVxuICAgICAgaWYgKHRva2VuID09IG51bGwpIHtcbiAgICAgICAgaGFzVW5rbm93bkRlcHMgPSB0cnVlO1xuICAgICAgICByZXR1cm4gbnVsbCAhO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBpc0F0dHJpYnV0ZSxcbiAgICAgICAgaXNIb3N0LFxuICAgICAgICBpc1NlbGYsXG4gICAgICAgIGlzU2tpcFNlbGYsXG4gICAgICAgIGlzT3B0aW9uYWwsXG4gICAgICAgIHRva2VuOiB0aGlzLl9nZXRUb2tlbk1ldGFkYXRhKHRva2VuKVxuICAgICAgfTtcblxuICAgIH0pO1xuXG4gICAgaWYgKGhhc1Vua25vd25EZXBzKSB7XG4gICAgICBjb25zdCBkZXBzVG9rZW5zID1cbiAgICAgICAgICBkZXBlbmRlbmNpZXNNZXRhZGF0YS5tYXAoKGRlcCkgPT4gZGVwID8gc3RyaW5naWZ5VHlwZShkZXAudG9rZW4pIDogJz8nKS5qb2luKCcsICcpO1xuICAgICAgY29uc3QgbWVzc2FnZSA9XG4gICAgICAgICAgYENhbid0IHJlc29sdmUgYWxsIHBhcmFtZXRlcnMgZm9yICR7c3RyaW5naWZ5VHlwZSh0eXBlT3JGdW5jKX06ICgke2RlcHNUb2tlbnN9KS5gO1xuICAgICAgaWYgKHRocm93T25Vbmtub3duRGVwcyB8fCB0aGlzLl9jb25maWcuc3RyaWN0SW5qZWN0aW9uUGFyYW1ldGVycykge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihzeW50YXhFcnJvcihtZXNzYWdlKSwgdHlwZU9yRnVuYyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9jb25zb2xlLndhcm4oYFdhcm5pbmc6ICR7bWVzc2FnZX0gVGhpcyB3aWxsIGJlY29tZSBhbiBlcnJvciBpbiBBbmd1bGFyIHY2LnhgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVwZW5kZW5jaWVzTWV0YWRhdGE7XG4gIH1cblxuICBwcml2YXRlIF9nZXRUb2tlbk1ldGFkYXRhKHRva2VuOiBhbnkpOiBjcGwuQ29tcGlsZVRva2VuTWV0YWRhdGEge1xuICAgIHRva2VuID0gcmVzb2x2ZUZvcndhcmRSZWYodG9rZW4pO1xuICAgIGxldCBjb21waWxlVG9rZW46IGNwbC5Db21waWxlVG9rZW5NZXRhZGF0YTtcbiAgICBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgY29tcGlsZVRva2VuID0ge3ZhbHVlOiB0b2tlbn07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbXBpbGVUb2tlbiA9IHtpZGVudGlmaWVyOiB7cmVmZXJlbmNlOiB0b2tlbn19O1xuICAgIH1cbiAgICByZXR1cm4gY29tcGlsZVRva2VuO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0UHJvdmlkZXJzTWV0YWRhdGEoXG4gICAgICBwcm92aWRlcnM6IFByb3ZpZGVyW10sIHRhcmdldEVudHJ5Q29tcG9uZW50czogY3BsLkNvbXBpbGVFbnRyeUNvbXBvbmVudE1ldGFkYXRhW10sXG4gICAgICBkZWJ1Z0luZm8/OiBzdHJpbmcsIGNvbXBpbGVQcm92aWRlcnM6IGNwbC5Db21waWxlUHJvdmlkZXJNZXRhZGF0YVtdID0gW10sXG4gICAgICB0eXBlPzogYW55KTogY3BsLkNvbXBpbGVQcm92aWRlck1ldGFkYXRhW10ge1xuICAgIHByb3ZpZGVycy5mb3JFYWNoKChwcm92aWRlcjogYW55LCBwcm92aWRlcklkeDogbnVtYmVyKSA9PiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShwcm92aWRlcikpIHtcbiAgICAgICAgdGhpcy5fZ2V0UHJvdmlkZXJzTWV0YWRhdGEocHJvdmlkZXIsIHRhcmdldEVudHJ5Q29tcG9uZW50cywgZGVidWdJbmZvLCBjb21waWxlUHJvdmlkZXJzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByb3ZpZGVyID0gcmVzb2x2ZUZvcndhcmRSZWYocHJvdmlkZXIpO1xuICAgICAgICBsZXQgcHJvdmlkZXJNZXRhOiBjcGwuUHJvdmlkZXJNZXRhID0gdW5kZWZpbmVkICE7XG4gICAgICAgIGlmIChwcm92aWRlciAmJiB0eXBlb2YgcHJvdmlkZXIgPT09ICdvYmplY3QnICYmIHByb3ZpZGVyLmhhc093blByb3BlcnR5KCdwcm92aWRlJykpIHtcbiAgICAgICAgICB0aGlzLl92YWxpZGF0ZVByb3ZpZGVyKHByb3ZpZGVyKTtcbiAgICAgICAgICBwcm92aWRlck1ldGEgPSBuZXcgY3BsLlByb3ZpZGVyTWV0YShwcm92aWRlci5wcm92aWRlLCBwcm92aWRlcik7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNWYWxpZFR5cGUocHJvdmlkZXIpKSB7XG4gICAgICAgICAgcHJvdmlkZXJNZXRhID0gbmV3IGNwbC5Qcm92aWRlck1ldGEocHJvdmlkZXIsIHt1c2VDbGFzczogcHJvdmlkZXJ9KTtcbiAgICAgICAgfSBlbHNlIGlmIChwcm92aWRlciA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3Ioc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgIGBFbmNvdW50ZXJlZCB1bmRlZmluZWQgcHJvdmlkZXIhIFVzdWFsbHkgdGhpcyBtZWFucyB5b3UgaGF2ZSBhIGNpcmN1bGFyIGRlcGVuZGVuY2llcy4gVGhpcyBtaWdodCBiZSBjYXVzZWQgYnkgdXNpbmcgJ2JhcnJlbCcgaW5kZXgudHMgZmlsZXMuYCkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBwcm92aWRlcnNJbmZvID1cbiAgICAgICAgICAgICAgKDxzdHJpbmdbXT5wcm92aWRlcnMucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgIChzb0Zhcjogc3RyaW5nW10sIHNlZW5Qcm92aWRlcjogYW55LCBzZWVuUHJvdmlkZXJJZHg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgaWYgKHNlZW5Qcm92aWRlcklkeCA8IHByb3ZpZGVySWR4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgIHNvRmFyLnB1c2goYCR7c3RyaW5naWZ5VHlwZShzZWVuUHJvdmlkZXIpfWApO1xuICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZWVuUHJvdmlkZXJJZHggPT0gcHJvdmlkZXJJZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgc29GYXIucHVzaChgPyR7c3RyaW5naWZ5VHlwZShzZWVuUHJvdmlkZXIpfT9gKTtcbiAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VlblByb3ZpZGVySWR4ID09IHByb3ZpZGVySWR4ICsgMSkge1xuICAgICAgICAgICAgICAgICAgICAgICBzb0Zhci5wdXNoKCcuLi4nKTtcbiAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzb0ZhcjtcbiAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgIFtdKSlcbiAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBzeW50YXhFcnJvcihcbiAgICAgICAgICAgICAgICAgIGBJbnZhbGlkICR7ZGVidWdJbmZvID8gZGVidWdJbmZvIDogJ3Byb3ZpZGVyJ30gLSBvbmx5IGluc3RhbmNlcyBvZiBQcm92aWRlciBhbmQgVHlwZSBhcmUgYWxsb3dlZCwgZ290OiBbJHtwcm92aWRlcnNJbmZvfV1gKSxcbiAgICAgICAgICAgICAgdHlwZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm92aWRlck1ldGEudG9rZW4gPT09XG4gICAgICAgICAgICB0aGlzLl9yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkFOQUxZWkVfRk9SX0VOVFJZX0NPTVBPTkVOVFMpKSB7XG4gICAgICAgICAgdGFyZ2V0RW50cnlDb21wb25lbnRzLnB1c2goLi4udGhpcy5fZ2V0RW50cnlDb21wb25lbnRzRnJvbVByb3ZpZGVyKHByb3ZpZGVyTWV0YSwgdHlwZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbXBpbGVQcm92aWRlcnMucHVzaCh0aGlzLmdldFByb3ZpZGVyTWV0YWRhdGEocHJvdmlkZXJNZXRhKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gY29tcGlsZVByb3ZpZGVycztcbiAgfVxuXG4gIHByaXZhdGUgX3ZhbGlkYXRlUHJvdmlkZXIocHJvdmlkZXI6IGFueSk6IHZvaWQge1xuICAgIGlmIChwcm92aWRlci5oYXNPd25Qcm9wZXJ0eSgndXNlQ2xhc3MnKSAmJiBwcm92aWRlci51c2VDbGFzcyA9PSBudWxsKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihzeW50YXhFcnJvcihcbiAgICAgICAgICBgSW52YWxpZCBwcm92aWRlciBmb3IgJHtzdHJpbmdpZnlUeXBlKHByb3ZpZGVyLnByb3ZpZGUpfS4gdXNlQ2xhc3MgY2Fubm90IGJlICR7cHJvdmlkZXIudXNlQ2xhc3N9LlxuICAgICAgICAgICBVc3VhbGx5IGl0IGhhcHBlbnMgd2hlbjpcbiAgICAgICAgICAgMS4gVGhlcmUncyBhIGNpcmN1bGFyIGRlcGVuZGVuY3kgKG1pZ2h0IGJlIGNhdXNlZCBieSB1c2luZyBpbmRleC50cyAoYmFycmVsKSBmaWxlcykuXG4gICAgICAgICAgIDIuIENsYXNzIHdhcyB1c2VkIGJlZm9yZSBpdCB3YXMgZGVjbGFyZWQuIFVzZSBmb3J3YXJkUmVmIGluIHRoaXMgY2FzZS5gKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0RW50cnlDb21wb25lbnRzRnJvbVByb3ZpZGVyKHByb3ZpZGVyOiBjcGwuUHJvdmlkZXJNZXRhLCB0eXBlPzogYW55KTpcbiAgICAgIGNwbC5Db21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdIHtcbiAgICBjb25zdCBjb21wb25lbnRzOiBjcGwuQ29tcGlsZUVudHJ5Q29tcG9uZW50TWV0YWRhdGFbXSA9IFtdO1xuICAgIGNvbnN0IGNvbGxlY3RlZElkZW50aWZpZXJzOiBjcGwuQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdID0gW107XG5cbiAgICBpZiAocHJvdmlkZXIudXNlRmFjdG9yeSB8fCBwcm92aWRlci51c2VFeGlzdGluZyB8fCBwcm92aWRlci51c2VDbGFzcykge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgc3ludGF4RXJyb3IoYFRoZSBBTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTIHRva2VuIG9ubHkgc3VwcG9ydHMgdXNlVmFsdWUhYCksIHR5cGUpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGlmICghcHJvdmlkZXIubXVsdGkpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIHN5bnRheEVycm9yKGBUaGUgQU5BTFlaRV9GT1JfRU5UUllfQ09NUE9ORU5UUyB0b2tlbiBvbmx5IHN1cHBvcnRzICdtdWx0aSA9IHRydWUnIWApLFxuICAgICAgICAgIHR5cGUpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGV4dHJhY3RJZGVudGlmaWVycyhwcm92aWRlci51c2VWYWx1ZSwgY29sbGVjdGVkSWRlbnRpZmllcnMpO1xuICAgIGNvbGxlY3RlZElkZW50aWZpZXJzLmZvckVhY2goKGlkZW50aWZpZXIpID0+IHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5fZ2V0RW50cnlDb21wb25lbnRNZXRhZGF0YShpZGVudGlmaWVyLnJlZmVyZW5jZSwgZmFsc2UpO1xuICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIGNvbXBvbmVudHMucHVzaChlbnRyeSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gIH1cblxuICBwcml2YXRlIF9nZXRFbnRyeUNvbXBvbmVudE1ldGFkYXRhKGRpclR5cGU6IGFueSwgdGhyb3dJZk5vdEZvdW5kID0gdHJ1ZSk6XG4gICAgICBjcGwuQ29tcGlsZUVudHJ5Q29tcG9uZW50TWV0YWRhdGF8bnVsbCB7XG4gICAgY29uc3QgZGlyTWV0YSA9IHRoaXMuZ2V0Tm9uTm9ybWFsaXplZERpcmVjdGl2ZU1ldGFkYXRhKGRpclR5cGUpO1xuICAgIGlmIChkaXJNZXRhICYmIGRpck1ldGEubWV0YWRhdGEuaXNDb21wb25lbnQpIHtcbiAgICAgIHJldHVybiB7Y29tcG9uZW50VHlwZTogZGlyVHlwZSwgY29tcG9uZW50RmFjdG9yeTogZGlyTWV0YS5tZXRhZGF0YS5jb21wb25lbnRGYWN0b3J5ICF9O1xuICAgIH1cbiAgICBjb25zdCBkaXJTdW1tYXJ5ID1cbiAgICAgICAgPGNwbC5Db21waWxlRGlyZWN0aXZlU3VtbWFyeT50aGlzLl9sb2FkU3VtbWFyeShkaXJUeXBlLCBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLkRpcmVjdGl2ZSk7XG4gICAgaWYgKGRpclN1bW1hcnkgJiYgZGlyU3VtbWFyeS5pc0NvbXBvbmVudCkge1xuICAgICAgcmV0dXJuIHtjb21wb25lbnRUeXBlOiBkaXJUeXBlLCBjb21wb25lbnRGYWN0b3J5OiBkaXJTdW1tYXJ5LmNvbXBvbmVudEZhY3RvcnkgIX07XG4gICAgfVxuICAgIGlmICh0aHJvd0lmTm90Rm91bmQpIHtcbiAgICAgIHRocm93IHN5bnRheEVycm9yKGAke2RpclR5cGUubmFtZX0gY2Fubm90IGJlIHVzZWQgYXMgYW4gZW50cnkgY29tcG9uZW50LmApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldEluamVjdGFibGVUeXBlTWV0YWRhdGEodHlwZTogVHlwZSwgZGVwZW5kZW5jaWVzOiBhbnlbXXxudWxsID0gbnVsbCk6XG4gICAgICBjcGwuQ29tcGlsZVR5cGVNZXRhZGF0YSB7XG4gICAgY29uc3QgdHlwZVN1bW1hcnkgPSB0aGlzLl9sb2FkU3VtbWFyeSh0eXBlLCBjcGwuQ29tcGlsZVN1bW1hcnlLaW5kLkluamVjdGFibGUpO1xuICAgIGlmICh0eXBlU3VtbWFyeSkge1xuICAgICAgcmV0dXJuIHR5cGVTdW1tYXJ5LnR5cGU7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9nZXRUeXBlTWV0YWRhdGEodHlwZSwgZGVwZW5kZW5jaWVzKTtcbiAgfVxuXG4gIGdldFByb3ZpZGVyTWV0YWRhdGEocHJvdmlkZXI6IGNwbC5Qcm92aWRlck1ldGEpOiBjcGwuQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEge1xuICAgIGxldCBjb21waWxlRGVwczogY3BsLkNvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YVtdID0gdW5kZWZpbmVkICE7XG4gICAgbGV0IGNvbXBpbGVUeXBlTWV0YWRhdGE6IGNwbC5Db21waWxlVHlwZU1ldGFkYXRhID0gbnVsbCAhO1xuICAgIGxldCBjb21waWxlRmFjdG9yeU1ldGFkYXRhOiBjcGwuQ29tcGlsZUZhY3RvcnlNZXRhZGF0YSA9IG51bGwgITtcbiAgICBsZXQgdG9rZW46IGNwbC5Db21waWxlVG9rZW5NZXRhZGF0YSA9IHRoaXMuX2dldFRva2VuTWV0YWRhdGEocHJvdmlkZXIudG9rZW4pO1xuXG4gICAgaWYgKHByb3ZpZGVyLnVzZUNsYXNzKSB7XG4gICAgICBjb21waWxlVHlwZU1ldGFkYXRhID1cbiAgICAgICAgICB0aGlzLl9nZXRJbmplY3RhYmxlVHlwZU1ldGFkYXRhKHByb3ZpZGVyLnVzZUNsYXNzLCBwcm92aWRlci5kZXBlbmRlbmNpZXMpO1xuICAgICAgY29tcGlsZURlcHMgPSBjb21waWxlVHlwZU1ldGFkYXRhLmRpRGVwcztcbiAgICAgIGlmIChwcm92aWRlci50b2tlbiA9PT0gcHJvdmlkZXIudXNlQ2xhc3MpIHtcbiAgICAgICAgLy8gdXNlIHRoZSBjb21waWxlVHlwZU1ldGFkYXRhIGFzIGl0IGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IGxpZmVjeWNsZUhvb2tzLi4uXG4gICAgICAgIHRva2VuID0ge2lkZW50aWZpZXI6IGNvbXBpbGVUeXBlTWV0YWRhdGF9O1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvdmlkZXIudXNlRmFjdG9yeSkge1xuICAgICAgY29tcGlsZUZhY3RvcnlNZXRhZGF0YSA9IHRoaXMuX2dldEZhY3RvcnlNZXRhZGF0YShwcm92aWRlci51c2VGYWN0b3J5LCBwcm92aWRlci5kZXBlbmRlbmNpZXMpO1xuICAgICAgY29tcGlsZURlcHMgPSBjb21waWxlRmFjdG9yeU1ldGFkYXRhLmRpRGVwcztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG9rZW46IHRva2VuLFxuICAgICAgdXNlQ2xhc3M6IGNvbXBpbGVUeXBlTWV0YWRhdGEsXG4gICAgICB1c2VWYWx1ZTogcHJvdmlkZXIudXNlVmFsdWUsXG4gICAgICB1c2VGYWN0b3J5OiBjb21waWxlRmFjdG9yeU1ldGFkYXRhLFxuICAgICAgdXNlRXhpc3Rpbmc6IHByb3ZpZGVyLnVzZUV4aXN0aW5nID8gdGhpcy5fZ2V0VG9rZW5NZXRhZGF0YShwcm92aWRlci51c2VFeGlzdGluZykgOiB1bmRlZmluZWQsXG4gICAgICBkZXBzOiBjb21waWxlRGVwcyxcbiAgICAgIG11bHRpOiBwcm92aWRlci5tdWx0aVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9nZXRRdWVyaWVzTWV0YWRhdGEoXG4gICAgICBxdWVyaWVzOiB7W2tleTogc3RyaW5nXTogUXVlcnl9LCBpc1ZpZXdRdWVyeTogYm9vbGVhbixcbiAgICAgIGRpcmVjdGl2ZVR5cGU6IFR5cGUpOiBjcGwuQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSB7XG4gICAgY29uc3QgcmVzOiBjcGwuQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSA9IFtdO1xuXG4gICAgT2JqZWN0LmtleXMocXVlcmllcykuZm9yRWFjaCgocHJvcGVydHlOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gcXVlcmllc1twcm9wZXJ0eU5hbWVdO1xuICAgICAgaWYgKHF1ZXJ5LmlzVmlld1F1ZXJ5ID09PSBpc1ZpZXdRdWVyeSkge1xuICAgICAgICByZXMucHVzaCh0aGlzLl9nZXRRdWVyeU1ldGFkYXRhKHF1ZXJ5LCBwcm9wZXJ0eU5hbWUsIGRpcmVjdGl2ZVR5cGUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBwcml2YXRlIF9xdWVyeVZhckJpbmRpbmdzKHNlbGVjdG9yOiBhbnkpOiBzdHJpbmdbXSB7IHJldHVybiBzZWxlY3Rvci5zcGxpdCgvXFxzKixcXHMqLyk7IH1cblxuICBwcml2YXRlIF9nZXRRdWVyeU1ldGFkYXRhKHE6IFF1ZXJ5LCBwcm9wZXJ0eU5hbWU6IHN0cmluZywgdHlwZU9yRnVuYzogVHlwZXxGdW5jdGlvbik6XG4gICAgICBjcGwuQ29tcGlsZVF1ZXJ5TWV0YWRhdGEge1xuICAgIGxldCBzZWxlY3RvcnM6IGNwbC5Db21waWxlVG9rZW5NZXRhZGF0YVtdO1xuICAgIGlmICh0eXBlb2YgcS5zZWxlY3RvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHNlbGVjdG9ycyA9XG4gICAgICAgICAgdGhpcy5fcXVlcnlWYXJCaW5kaW5ncyhxLnNlbGVjdG9yKS5tYXAodmFyTmFtZSA9PiB0aGlzLl9nZXRUb2tlbk1ldGFkYXRhKHZhck5hbWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFxLnNlbGVjdG9yKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgc3ludGF4RXJyb3IoXG4gICAgICAgICAgICAgICAgYENhbid0IGNvbnN0cnVjdCBhIHF1ZXJ5IGZvciB0aGUgcHJvcGVydHkgXCIke3Byb3BlcnR5TmFtZX1cIiBvZiBcIiR7c3RyaW5naWZ5VHlwZSh0eXBlT3JGdW5jKX1cIiBzaW5jZSB0aGUgcXVlcnkgc2VsZWN0b3Igd2Fzbid0IGRlZmluZWQuYCksXG4gICAgICAgICAgICB0eXBlT3JGdW5jKTtcbiAgICAgICAgc2VsZWN0b3JzID0gW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxlY3RvcnMgPSBbdGhpcy5fZ2V0VG9rZW5NZXRhZGF0YShxLnNlbGVjdG9yKV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHNlbGVjdG9ycyxcbiAgICAgIGZpcnN0OiBxLmZpcnN0LFxuICAgICAgZGVzY2VuZGFudHM6IHEuZGVzY2VuZGFudHMsIHByb3BlcnR5TmFtZSxcbiAgICAgIHJlYWQ6IHEucmVhZCA/IHRoaXMuX2dldFRva2VuTWV0YWRhdGEocS5yZWFkKSA6IG51bGwgIVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihlcnJvcjogYW55LCB0eXBlPzogYW55LCBvdGhlclR5cGU/OiBhbnkpIHtcbiAgICBpZiAodGhpcy5fZXJyb3JDb2xsZWN0b3IpIHtcbiAgICAgIHRoaXMuX2Vycm9yQ29sbGVjdG9yKGVycm9yLCB0eXBlKTtcbiAgICAgIGlmIChvdGhlclR5cGUpIHtcbiAgICAgICAgdGhpcy5fZXJyb3JDb2xsZWN0b3IoZXJyb3IsIG90aGVyVHlwZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmbGF0dGVuQXJyYXkodHJlZTogYW55W10sIG91dDogQXJyYXk8YW55PiA9IFtdKTogQXJyYXk8YW55PiB7XG4gIGlmICh0cmVlKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gcmVzb2x2ZUZvcndhcmRSZWYodHJlZVtpXSk7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuICAgICAgICBmbGF0dGVuQXJyYXkoaXRlbSwgb3V0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dC5wdXNoKGl0ZW0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBkZWR1cGVBcnJheShhcnJheTogYW55W10pOiBBcnJheTxhbnk+IHtcbiAgaWYgKGFycmF5KSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20obmV3IFNldChhcnJheSkpO1xuICB9XG4gIHJldHVybiBbXTtcbn1cblxuZnVuY3Rpb24gZmxhdHRlbkFuZERlZHVwZUFycmF5KHRyZWU6IGFueVtdKTogQXJyYXk8YW55PiB7XG4gIHJldHVybiBkZWR1cGVBcnJheShmbGF0dGVuQXJyYXkodHJlZSkpO1xufVxuXG5mdW5jdGlvbiBpc1ZhbGlkVHlwZSh2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiAodmFsdWUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHx8ICh2YWx1ZSBpbnN0YW5jZW9mIFR5cGUpO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0SWRlbnRpZmllcnModmFsdWU6IGFueSwgdGFyZ2V0SWRlbnRpZmllcnM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10pIHtcbiAgdmlzaXRWYWx1ZSh2YWx1ZSwgbmV3IF9Db21waWxlVmFsdWVDb252ZXJ0ZXIoKSwgdGFyZ2V0SWRlbnRpZmllcnMpO1xufVxuXG5jbGFzcyBfQ29tcGlsZVZhbHVlQ29udmVydGVyIGV4dGVuZHMgVmFsdWVUcmFuc2Zvcm1lciB7XG4gIHZpc2l0T3RoZXIodmFsdWU6IGFueSwgdGFyZ2V0SWRlbnRpZmllcnM6IGNwbC5Db21waWxlSWRlbnRpZmllck1ldGFkYXRhW10pOiBhbnkge1xuICAgIHRhcmdldElkZW50aWZpZXJzLnB1c2goe3JlZmVyZW5jZTogdmFsdWV9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnlUeXBlKHR5cGU6IGFueSk6IHN0cmluZyB7XG4gIGlmICh0eXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgcmV0dXJuIGAke3R5cGUubmFtZX0gaW4gJHt0eXBlLmZpbGVQYXRofWA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0cmluZ2lmeSh0eXBlKTtcbiAgfVxufVxuXG4vKipcbiAqIEluZGljYXRlcyB0aGF0IGEgY29tcG9uZW50IGlzIHN0aWxsIGJlaW5nIGxvYWRlZCBpbiBhIHN5bmNocm9ub3VzIGNvbXBpbGUuXG4gKi9cbmZ1bmN0aW9uIGNvbXBvbmVudFN0aWxsTG9hZGluZ0Vycm9yKGNvbXBUeXBlOiBUeXBlKSB7XG4gIGNvbnN0IGVycm9yID1cbiAgICAgIEVycm9yKGBDYW4ndCBjb21waWxlIHN5bmNocm9ub3VzbHkgYXMgJHtzdHJpbmdpZnkoY29tcFR5cGUpfSBpcyBzdGlsbCBiZWluZyBsb2FkZWQhYCk7XG4gIChlcnJvciBhcyBhbnkpW0VSUk9SX0NPTVBPTkVOVF9UWVBFXSA9IGNvbXBUeXBlO1xuICByZXR1cm4gZXJyb3I7XG59XG4iXX0=