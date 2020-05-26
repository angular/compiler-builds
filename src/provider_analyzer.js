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
        define("@angular/compiler/src/provider_analyzer", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/identifiers", "@angular/compiler/src/parse_util", "@angular/compiler/src/template_parser/template_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NgModuleProviderAnalyzer = exports.ProviderElementContext = exports.ProviderViewContext = exports.ProviderError = void 0;
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var template_ast_1 = require("@angular/compiler/src/template_parser/template_ast");
    var ProviderError = /** @class */ (function (_super) {
        tslib_1.__extends(ProviderError, _super);
        function ProviderError(message, span) {
            return _super.call(this, span, message) || this;
        }
        return ProviderError;
    }(parse_util_1.ParseError));
    exports.ProviderError = ProviderError;
    var ProviderViewContext = /** @class */ (function () {
        function ProviderViewContext(reflector, component) {
            var _this = this;
            this.reflector = reflector;
            this.component = component;
            this.errors = [];
            this.viewQueries = _getViewQueries(component);
            this.viewProviders = new Map();
            component.viewProviders.forEach(function (provider) {
                if (_this.viewProviders.get(compile_metadata_1.tokenReference(provider.token)) == null) {
                    _this.viewProviders.set(compile_metadata_1.tokenReference(provider.token), true);
                }
            });
        }
        return ProviderViewContext;
    }());
    exports.ProviderViewContext = ProviderViewContext;
    var ProviderElementContext = /** @class */ (function () {
        function ProviderElementContext(viewContext, _parent, _isViewRoot, _directiveAsts, attrs, refs, isTemplate, contentQueryStartId, _sourceSpan) {
            var _this = this;
            this.viewContext = viewContext;
            this._parent = _parent;
            this._isViewRoot = _isViewRoot;
            this._directiveAsts = _directiveAsts;
            this._sourceSpan = _sourceSpan;
            this._transformedProviders = new Map();
            this._seenProviders = new Map();
            this._queriedTokens = new Map();
            this.transformedHasViewContainer = false;
            this._attrs = {};
            attrs.forEach(function (attrAst) { return _this._attrs[attrAst.name] = attrAst.value; });
            var directivesMeta = _directiveAsts.map(function (directiveAst) { return directiveAst.directive; });
            this._allProviders =
                _resolveProvidersFromDirectives(directivesMeta, _sourceSpan, viewContext.errors);
            this._contentQueries = _getContentQueries(contentQueryStartId, directivesMeta);
            Array.from(this._allProviders.values()).forEach(function (provider) {
                _this._addQueryReadsTo(provider.token, provider.token, _this._queriedTokens);
            });
            if (isTemplate) {
                var templateRefId = identifiers_1.createTokenForExternalReference(this.viewContext.reflector, identifiers_1.Identifiers.TemplateRef);
                this._addQueryReadsTo(templateRefId, templateRefId, this._queriedTokens);
            }
            refs.forEach(function (refAst) {
                var defaultQueryValue = refAst.value ||
                    identifiers_1.createTokenForExternalReference(_this.viewContext.reflector, identifiers_1.Identifiers.ElementRef);
                _this._addQueryReadsTo({ value: refAst.name }, defaultQueryValue, _this._queriedTokens);
            });
            if (this._queriedTokens.get(this.viewContext.reflector.resolveExternalReference(identifiers_1.Identifiers.ViewContainerRef))) {
                this.transformedHasViewContainer = true;
            }
            // create the providers that we know are eager first
            Array.from(this._allProviders.values()).forEach(function (provider) {
                var eager = provider.eager || _this._queriedTokens.get(compile_metadata_1.tokenReference(provider.token));
                if (eager) {
                    _this._getOrCreateLocalProvider(provider.providerType, provider.token, true);
                }
            });
        }
        ProviderElementContext.prototype.afterElement = function () {
            var _this = this;
            // collect lazy providers
            Array.from(this._allProviders.values()).forEach(function (provider) {
                _this._getOrCreateLocalProvider(provider.providerType, provider.token, false);
            });
        };
        Object.defineProperty(ProviderElementContext.prototype, "transformProviders", {
            get: function () {
                // Note: Maps keep their insertion order.
                var lazyProviders = [];
                var eagerProviders = [];
                this._transformedProviders.forEach(function (provider) {
                    if (provider.eager) {
                        eagerProviders.push(provider);
                    }
                    else {
                        lazyProviders.push(provider);
                    }
                });
                return lazyProviders.concat(eagerProviders);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ProviderElementContext.prototype, "transformedDirectiveAsts", {
            get: function () {
                var sortedProviderTypes = this.transformProviders.map(function (provider) { return provider.token.identifier; });
                var sortedDirectives = this._directiveAsts.slice();
                sortedDirectives.sort(function (dir1, dir2) { return sortedProviderTypes.indexOf(dir1.directive.type) -
                    sortedProviderTypes.indexOf(dir2.directive.type); });
                return sortedDirectives;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ProviderElementContext.prototype, "queryMatches", {
            get: function () {
                var allMatches = [];
                this._queriedTokens.forEach(function (matches) {
                    allMatches.push.apply(allMatches, tslib_1.__spread(matches));
                });
                return allMatches;
            },
            enumerable: false,
            configurable: true
        });
        ProviderElementContext.prototype._addQueryReadsTo = function (token, defaultValue, queryReadTokens) {
            this._getQueriesFor(token).forEach(function (query) {
                var queryValue = query.meta.read || defaultValue;
                var tokenRef = compile_metadata_1.tokenReference(queryValue);
                var queryMatches = queryReadTokens.get(tokenRef);
                if (!queryMatches) {
                    queryMatches = [];
                    queryReadTokens.set(tokenRef, queryMatches);
                }
                queryMatches.push({ queryId: query.queryId, value: queryValue });
            });
        };
        ProviderElementContext.prototype._getQueriesFor = function (token) {
            var result = [];
            var currentEl = this;
            var distance = 0;
            var queries;
            while (currentEl !== null) {
                queries = currentEl._contentQueries.get(compile_metadata_1.tokenReference(token));
                if (queries) {
                    result.push.apply(result, tslib_1.__spread(queries.filter(function (query) { return query.meta.descendants || distance <= 1; })));
                }
                if (currentEl._directiveAsts.length > 0) {
                    distance++;
                }
                currentEl = currentEl._parent;
            }
            queries = this.viewContext.viewQueries.get(compile_metadata_1.tokenReference(token));
            if (queries) {
                result.push.apply(result, tslib_1.__spread(queries));
            }
            return result;
        };
        ProviderElementContext.prototype._getOrCreateLocalProvider = function (requestingProviderType, token, eager) {
            var _this = this;
            var resolvedProvider = this._allProviders.get(compile_metadata_1.tokenReference(token));
            if (!resolvedProvider ||
                ((requestingProviderType === template_ast_1.ProviderAstType.Directive ||
                    requestingProviderType === template_ast_1.ProviderAstType.PublicService) &&
                    resolvedProvider.providerType === template_ast_1.ProviderAstType.PrivateService) ||
                ((requestingProviderType === template_ast_1.ProviderAstType.PrivateService ||
                    requestingProviderType === template_ast_1.ProviderAstType.PublicService) &&
                    resolvedProvider.providerType === template_ast_1.ProviderAstType.Builtin)) {
                return null;
            }
            var transformedProviderAst = this._transformedProviders.get(compile_metadata_1.tokenReference(token));
            if (transformedProviderAst) {
                return transformedProviderAst;
            }
            if (this._seenProviders.get(compile_metadata_1.tokenReference(token)) != null) {
                this.viewContext.errors.push(new ProviderError("Cannot instantiate cyclic dependency! " + compile_metadata_1.tokenName(token), this._sourceSpan));
                return null;
            }
            this._seenProviders.set(compile_metadata_1.tokenReference(token), true);
            var transformedProviders = resolvedProvider.providers.map(function (provider) {
                var transformedUseValue = provider.useValue;
                var transformedUseExisting = provider.useExisting;
                var transformedDeps = undefined;
                if (provider.useExisting != null) {
                    var existingDiDep = _this._getDependency(resolvedProvider.providerType, { token: provider.useExisting }, eager);
                    if (existingDiDep.token != null) {
                        transformedUseExisting = existingDiDep.token;
                    }
                    else {
                        transformedUseExisting = null;
                        transformedUseValue = existingDiDep.value;
                    }
                }
                else if (provider.useFactory) {
                    var deps = provider.deps || provider.useFactory.diDeps;
                    transformedDeps =
                        deps.map(function (dep) { return _this._getDependency(resolvedProvider.providerType, dep, eager); });
                }
                else if (provider.useClass) {
                    var deps = provider.deps || provider.useClass.diDeps;
                    transformedDeps =
                        deps.map(function (dep) { return _this._getDependency(resolvedProvider.providerType, dep, eager); });
                }
                return _transformProvider(provider, {
                    useExisting: transformedUseExisting,
                    useValue: transformedUseValue,
                    deps: transformedDeps
                });
            });
            transformedProviderAst =
                _transformProviderAst(resolvedProvider, { eager: eager, providers: transformedProviders });
            this._transformedProviders.set(compile_metadata_1.tokenReference(token), transformedProviderAst);
            return transformedProviderAst;
        };
        ProviderElementContext.prototype._getLocalDependency = function (requestingProviderType, dep, eager) {
            if (eager === void 0) { eager = false; }
            if (dep.isAttribute) {
                var attrValue = this._attrs[dep.token.value];
                return { isValue: true, value: attrValue == null ? null : attrValue };
            }
            if (dep.token != null) {
                // access builtints
                if ((requestingProviderType === template_ast_1.ProviderAstType.Directive ||
                    requestingProviderType === template_ast_1.ProviderAstType.Component)) {
                    if (compile_metadata_1.tokenReference(dep.token) ===
                        this.viewContext.reflector.resolveExternalReference(identifiers_1.Identifiers.Renderer) ||
                        compile_metadata_1.tokenReference(dep.token) ===
                            this.viewContext.reflector.resolveExternalReference(identifiers_1.Identifiers.ElementRef) ||
                        compile_metadata_1.tokenReference(dep.token) ===
                            this.viewContext.reflector.resolveExternalReference(identifiers_1.Identifiers.ChangeDetectorRef) ||
                        compile_metadata_1.tokenReference(dep.token) ===
                            this.viewContext.reflector.resolveExternalReference(identifiers_1.Identifiers.TemplateRef)) {
                        return dep;
                    }
                    if (compile_metadata_1.tokenReference(dep.token) ===
                        this.viewContext.reflector.resolveExternalReference(identifiers_1.Identifiers.ViewContainerRef)) {
                        this.transformedHasViewContainer = true;
                    }
                }
                // access the injector
                if (compile_metadata_1.tokenReference(dep.token) ===
                    this.viewContext.reflector.resolveExternalReference(identifiers_1.Identifiers.Injector)) {
                    return dep;
                }
                // access providers
                if (this._getOrCreateLocalProvider(requestingProviderType, dep.token, eager) != null) {
                    return dep;
                }
            }
            return null;
        };
        ProviderElementContext.prototype._getDependency = function (requestingProviderType, dep, eager) {
            if (eager === void 0) { eager = false; }
            var currElement = this;
            var currEager = eager;
            var result = null;
            if (!dep.isSkipSelf) {
                result = this._getLocalDependency(requestingProviderType, dep, eager);
            }
            if (dep.isSelf) {
                if (!result && dep.isOptional) {
                    result = { isValue: true, value: null };
                }
            }
            else {
                // check parent elements
                while (!result && currElement._parent) {
                    var prevElement = currElement;
                    currElement = currElement._parent;
                    if (prevElement._isViewRoot) {
                        currEager = false;
                    }
                    result = currElement._getLocalDependency(template_ast_1.ProviderAstType.PublicService, dep, currEager);
                }
                // check @Host restriction
                if (!result) {
                    if (!dep.isHost || this.viewContext.component.isHost ||
                        this.viewContext.component.type.reference === compile_metadata_1.tokenReference(dep.token) ||
                        this.viewContext.viewProviders.get(compile_metadata_1.tokenReference(dep.token)) != null) {
                        result = dep;
                    }
                    else {
                        result = dep.isOptional ? { isValue: true, value: null } : null;
                    }
                }
            }
            if (!result) {
                this.viewContext.errors.push(new ProviderError("No provider for " + compile_metadata_1.tokenName(dep.token), this._sourceSpan));
            }
            return result;
        };
        return ProviderElementContext;
    }());
    exports.ProviderElementContext = ProviderElementContext;
    var NgModuleProviderAnalyzer = /** @class */ (function () {
        function NgModuleProviderAnalyzer(reflector, ngModule, extraProviders, sourceSpan) {
            var _this = this;
            this.reflector = reflector;
            this._transformedProviders = new Map();
            this._seenProviders = new Map();
            this._errors = [];
            this._allProviders = new Map();
            ngModule.transitiveModule.modules.forEach(function (ngModuleType) {
                var ngModuleProvider = { token: { identifier: ngModuleType }, useClass: ngModuleType };
                _resolveProviders([ngModuleProvider], template_ast_1.ProviderAstType.PublicService, true, sourceSpan, _this._errors, _this._allProviders, /* isModule */ true);
            });
            _resolveProviders(ngModule.transitiveModule.providers.map(function (entry) { return entry.provider; }).concat(extraProviders), template_ast_1.ProviderAstType.PublicService, false, sourceSpan, this._errors, this._allProviders, 
            /* isModule */ false);
        }
        NgModuleProviderAnalyzer.prototype.parse = function () {
            var _this = this;
            Array.from(this._allProviders.values()).forEach(function (provider) {
                _this._getOrCreateLocalProvider(provider.token, provider.eager);
            });
            if (this._errors.length > 0) {
                var errorString = this._errors.join('\n');
                throw new Error("Provider parse errors:\n" + errorString);
            }
            // Note: Maps keep their insertion order.
            var lazyProviders = [];
            var eagerProviders = [];
            this._transformedProviders.forEach(function (provider) {
                if (provider.eager) {
                    eagerProviders.push(provider);
                }
                else {
                    lazyProviders.push(provider);
                }
            });
            return lazyProviders.concat(eagerProviders);
        };
        NgModuleProviderAnalyzer.prototype._getOrCreateLocalProvider = function (token, eager) {
            var _this = this;
            var resolvedProvider = this._allProviders.get(compile_metadata_1.tokenReference(token));
            if (!resolvedProvider) {
                return null;
            }
            var transformedProviderAst = this._transformedProviders.get(compile_metadata_1.tokenReference(token));
            if (transformedProviderAst) {
                return transformedProviderAst;
            }
            if (this._seenProviders.get(compile_metadata_1.tokenReference(token)) != null) {
                this._errors.push(new ProviderError("Cannot instantiate cyclic dependency! " + compile_metadata_1.tokenName(token), resolvedProvider.sourceSpan));
                return null;
            }
            this._seenProviders.set(compile_metadata_1.tokenReference(token), true);
            var transformedProviders = resolvedProvider.providers.map(function (provider) {
                var transformedUseValue = provider.useValue;
                var transformedUseExisting = provider.useExisting;
                var transformedDeps = undefined;
                if (provider.useExisting != null) {
                    var existingDiDep = _this._getDependency({ token: provider.useExisting }, eager, resolvedProvider.sourceSpan);
                    if (existingDiDep.token != null) {
                        transformedUseExisting = existingDiDep.token;
                    }
                    else {
                        transformedUseExisting = null;
                        transformedUseValue = existingDiDep.value;
                    }
                }
                else if (provider.useFactory) {
                    var deps = provider.deps || provider.useFactory.diDeps;
                    transformedDeps =
                        deps.map(function (dep) { return _this._getDependency(dep, eager, resolvedProvider.sourceSpan); });
                }
                else if (provider.useClass) {
                    var deps = provider.deps || provider.useClass.diDeps;
                    transformedDeps =
                        deps.map(function (dep) { return _this._getDependency(dep, eager, resolvedProvider.sourceSpan); });
                }
                return _transformProvider(provider, {
                    useExisting: transformedUseExisting,
                    useValue: transformedUseValue,
                    deps: transformedDeps
                });
            });
            transformedProviderAst =
                _transformProviderAst(resolvedProvider, { eager: eager, providers: transformedProviders });
            this._transformedProviders.set(compile_metadata_1.tokenReference(token), transformedProviderAst);
            return transformedProviderAst;
        };
        NgModuleProviderAnalyzer.prototype._getDependency = function (dep, eager, requestorSourceSpan) {
            if (eager === void 0) { eager = false; }
            var foundLocal = false;
            if (!dep.isSkipSelf && dep.token != null) {
                // access the injector
                if (compile_metadata_1.tokenReference(dep.token) ===
                    this.reflector.resolveExternalReference(identifiers_1.Identifiers.Injector) ||
                    compile_metadata_1.tokenReference(dep.token) ===
                        this.reflector.resolveExternalReference(identifiers_1.Identifiers.ComponentFactoryResolver)) {
                    foundLocal = true;
                    // access providers
                }
                else if (this._getOrCreateLocalProvider(dep.token, eager) != null) {
                    foundLocal = true;
                }
            }
            return dep;
        };
        return NgModuleProviderAnalyzer;
    }());
    exports.NgModuleProviderAnalyzer = NgModuleProviderAnalyzer;
    function _transformProvider(provider, _a) {
        var useExisting = _a.useExisting, useValue = _a.useValue, deps = _a.deps;
        return {
            token: provider.token,
            useClass: provider.useClass,
            useExisting: useExisting,
            useFactory: provider.useFactory,
            useValue: useValue,
            deps: deps,
            multi: provider.multi
        };
    }
    function _transformProviderAst(provider, _a) {
        var eager = _a.eager, providers = _a.providers;
        return new template_ast_1.ProviderAst(provider.token, provider.multiProvider, provider.eager || eager, providers, provider.providerType, provider.lifecycleHooks, provider.sourceSpan, provider.isModule);
    }
    function _resolveProvidersFromDirectives(directives, sourceSpan, targetErrors) {
        var providersByToken = new Map();
        directives.forEach(function (directive) {
            var dirProvider = { token: { identifier: directive.type }, useClass: directive.type };
            _resolveProviders([dirProvider], directive.isComponent ? template_ast_1.ProviderAstType.Component : template_ast_1.ProviderAstType.Directive, true, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
        });
        // Note: directives need to be able to overwrite providers of a component!
        var directivesWithComponentFirst = directives.filter(function (dir) { return dir.isComponent; }).concat(directives.filter(function (dir) { return !dir.isComponent; }));
        directivesWithComponentFirst.forEach(function (directive) {
            _resolveProviders(directive.providers, template_ast_1.ProviderAstType.PublicService, false, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
            _resolveProviders(directive.viewProviders, template_ast_1.ProviderAstType.PrivateService, false, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
        });
        return providersByToken;
    }
    function _resolveProviders(providers, providerType, eager, sourceSpan, targetErrors, targetProvidersByToken, isModule) {
        providers.forEach(function (provider) {
            var resolvedProvider = targetProvidersByToken.get(compile_metadata_1.tokenReference(provider.token));
            if (resolvedProvider != null && !!resolvedProvider.multiProvider !== !!provider.multi) {
                targetErrors.push(new ProviderError("Mixing multi and non multi provider is not possible for token " + compile_metadata_1.tokenName(resolvedProvider.token), sourceSpan));
            }
            if (!resolvedProvider) {
                var lifecycleHooks = provider.token.identifier &&
                    provider.token.identifier.lifecycleHooks ?
                    provider.token.identifier.lifecycleHooks :
                    [];
                var isUseValue = !(provider.useClass || provider.useExisting || provider.useFactory);
                resolvedProvider = new template_ast_1.ProviderAst(provider.token, !!provider.multi, eager || isUseValue, [provider], providerType, lifecycleHooks, sourceSpan, isModule);
                targetProvidersByToken.set(compile_metadata_1.tokenReference(provider.token), resolvedProvider);
            }
            else {
                if (!provider.multi) {
                    resolvedProvider.providers.length = 0;
                }
                resolvedProvider.providers.push(provider);
            }
        });
    }
    function _getViewQueries(component) {
        // Note: queries start with id 1 so we can use the number in a Bloom filter!
        var viewQueryId = 1;
        var viewQueries = new Map();
        if (component.viewQueries) {
            component.viewQueries.forEach(function (query) { return _addQueryToTokenMap(viewQueries, { meta: query, queryId: viewQueryId++ }); });
        }
        return viewQueries;
    }
    function _getContentQueries(contentQueryStartId, directives) {
        var contentQueryId = contentQueryStartId;
        var contentQueries = new Map();
        directives.forEach(function (directive, directiveIndex) {
            if (directive.queries) {
                directive.queries.forEach(function (query) { return _addQueryToTokenMap(contentQueries, { meta: query, queryId: contentQueryId++ }); });
            }
        });
        return contentQueries;
    }
    function _addQueryToTokenMap(map, query) {
        query.meta.selectors.forEach(function (token) {
            var entry = map.get(compile_metadata_1.tokenReference(token));
            if (!entry) {
                entry = [];
                map.set(compile_metadata_1.tokenReference(token), entry);
            }
            entry.push(query);
        });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXJfYW5hbHl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcHJvdmlkZXJfYW5hbHl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUdILDJFQUFnUTtJQUVoUSxpRUFBMkU7SUFDM0UsK0RBQXlEO0lBQ3pELG1GQUE2SDtJQUU3SDtRQUFtQyx5Q0FBVTtRQUMzQyx1QkFBWSxPQUFlLEVBQUUsSUFBcUI7bUJBQ2hELGtCQUFNLElBQUksRUFBRSxPQUFPLENBQUM7UUFDdEIsQ0FBQztRQUNILG9CQUFDO0lBQUQsQ0FBQyxBQUpELENBQW1DLHVCQUFVLEdBSTVDO0lBSlksc0NBQWE7SUFXMUI7UUFXRSw2QkFBbUIsU0FBMkIsRUFBUyxTQUFtQztZQUExRixpQkFRQztZQVJrQixjQUFTLEdBQVQsU0FBUyxDQUFrQjtZQUFTLGNBQVMsR0FBVCxTQUFTLENBQTBCO1lBRjFGLFdBQU0sR0FBb0IsRUFBRSxDQUFDO1lBRzNCLElBQUksQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzlDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7WUFDN0MsU0FBUyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFRO2dCQUN2QyxJQUFJLEtBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLGlDQUFjLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxFQUFFO29CQUNsRSxLQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxpQ0FBYyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFDOUQ7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDSCwwQkFBQztJQUFELENBQUMsQUFwQkQsSUFv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QUM7UUFDckQsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFDLFNBQVMsRUFBRSxjQUFjO1lBQzNDLElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRTtnQkFDckIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3JCLFVBQUMsS0FBSyxJQUFLLE9BQUEsbUJBQW1CLENBQUMsY0FBYyxFQUFFLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLEVBQUMsQ0FBQyxFQUE3RSxDQUE2RSxDQUFDLENBQUM7YUFDL0Y7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sY0FBYyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxTQUFTLG1CQUFtQixDQUFDLEdBQTRCLEVBQUUsS0FBa0I7UUFDM0UsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBMkI7WUFDdkQsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxpQ0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDM0MsSUFBSSxDQUFDLEtBQUssRUFBRTtnQkFDVixLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUNYLEdBQUcsQ0FBQyxHQUFHLENBQUMsaUNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUN2QztZQUNELEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDcEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCB7Q29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhLCBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSwgQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEsIENvbXBpbGVRdWVyeU1ldGFkYXRhLCBDb21waWxlVG9rZW5NZXRhZGF0YSwgQ29tcGlsZVR5cGVNZXRhZGF0YSwgdG9rZW5OYW1lLCB0b2tlblJlZmVyZW5jZX0gZnJvbSAnLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge2NyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2UsIElkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtBdHRyQXN0LCBEaXJlY3RpdmVBc3QsIFByb3ZpZGVyQXN0LCBQcm92aWRlckFzdFR5cGUsIFF1ZXJ5TWF0Y2gsIFJlZmVyZW5jZUFzdH0gZnJvbSAnLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfYXN0JztcblxuZXhwb3J0IGNsYXNzIFByb3ZpZGVyRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBzdXBlcihzcGFuLCBtZXNzYWdlKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFF1ZXJ5V2l0aElkIHtcbiAgbWV0YTogQ29tcGlsZVF1ZXJ5TWV0YWRhdGE7XG4gIHF1ZXJ5SWQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFByb3ZpZGVyVmlld0NvbnRleHQge1xuICAvKipcbiAgICogQGludGVybmFsXG4gICAqL1xuICB2aWV3UXVlcmllczogTWFwPGFueSwgUXVlcnlXaXRoSWRbXT47XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHZpZXdQcm92aWRlcnM6IE1hcDxhbnksIGJvb2xlYW4+O1xuICBlcnJvcnM6IFByb3ZpZGVyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsIHB1YmxpYyBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSkge1xuICAgIHRoaXMudmlld1F1ZXJpZXMgPSBfZ2V0Vmlld1F1ZXJpZXMoY29tcG9uZW50KTtcbiAgICB0aGlzLnZpZXdQcm92aWRlcnMgPSBuZXcgTWFwPGFueSwgYm9vbGVhbj4oKTtcbiAgICBjb21wb25lbnQudmlld1Byb3ZpZGVycy5mb3JFYWNoKChwcm92aWRlcikgPT4ge1xuICAgICAgaWYgKHRoaXMudmlld1Byb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UocHJvdmlkZXIudG9rZW4pKSA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMudmlld1Byb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UocHJvdmlkZXIudG9rZW4pLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvdmlkZXJFbGVtZW50Q29udGV4dCB7XG4gIHByaXZhdGUgX2NvbnRlbnRRdWVyaWVzOiBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPjtcblxuICBwcml2YXRlIF90cmFuc2Zvcm1lZFByb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBQcm92aWRlckFzdD4oKTtcbiAgcHJpdmF0ZSBfc2VlblByb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBib29sZWFuPigpO1xuICBwcml2YXRlIF9hbGxQcm92aWRlcnM6IE1hcDxhbnksIFByb3ZpZGVyQXN0PjtcbiAgcHJpdmF0ZSBfYXR0cnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcml2YXRlIF9xdWVyaWVkVG9rZW5zID0gbmV3IE1hcDxhbnksIFF1ZXJ5TWF0Y2hbXT4oKTtcblxuICBwdWJsaWMgcmVhZG9ubHkgdHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmlld0NvbnRleHQ6IFByb3ZpZGVyVmlld0NvbnRleHQsIHByaXZhdGUgX3BhcmVudDogUHJvdmlkZXJFbGVtZW50Q29udGV4dCxcbiAgICAgIHByaXZhdGUgX2lzVmlld1Jvb3Q6IGJvb2xlYW4sIHByaXZhdGUgX2RpcmVjdGl2ZUFzdHM6IERpcmVjdGl2ZUFzdFtdLCBhdHRyczogQXR0ckFzdFtdLFxuICAgICAgcmVmczogUmVmZXJlbmNlQXN0W10sIGlzVGVtcGxhdGU6IGJvb2xlYW4sIGNvbnRlbnRRdWVyeVN0YXJ0SWQ6IG51bWJlcixcbiAgICAgIHByaXZhdGUgX3NvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHRoaXMuX2F0dHJzID0ge307XG4gICAgYXR0cnMuZm9yRWFjaCgoYXR0ckFzdCkgPT4gdGhpcy5fYXR0cnNbYXR0ckFzdC5uYW1lXSA9IGF0dHJBc3QudmFsdWUpO1xuICAgIGNvbnN0IGRpcmVjdGl2ZXNNZXRhID0gX2RpcmVjdGl2ZUFzdHMubWFwKGRpcmVjdGl2ZUFzdCA9PiBkaXJlY3RpdmVBc3QuZGlyZWN0aXZlKTtcbiAgICB0aGlzLl9hbGxQcm92aWRlcnMgPVxuICAgICAgICBfcmVzb2x2ZVByb3ZpZGVyc0Zyb21EaXJlY3RpdmVzKGRpcmVjdGl2ZXNNZXRhLCBfc291cmNlU3Bhbiwgdmlld0NvbnRleHQuZXJyb3JzKTtcbiAgICB0aGlzLl9jb250ZW50UXVlcmllcyA9IF9nZXRDb250ZW50UXVlcmllcyhjb250ZW50UXVlcnlTdGFydElkLCBkaXJlY3RpdmVzTWV0YSk7XG4gICAgQXJyYXkuZnJvbSh0aGlzLl9hbGxQcm92aWRlcnMudmFsdWVzKCkpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICB0aGlzLl9hZGRRdWVyeVJlYWRzVG8ocHJvdmlkZXIudG9rZW4sIHByb3ZpZGVyLnRva2VuLCB0aGlzLl9xdWVyaWVkVG9rZW5zKTtcbiAgICB9KTtcbiAgICBpZiAoaXNUZW1wbGF0ZSkge1xuICAgICAgY29uc3QgdGVtcGxhdGVSZWZJZCA9XG4gICAgICAgICAgY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSh0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3RvciwgSWRlbnRpZmllcnMuVGVtcGxhdGVSZWYpO1xuICAgICAgdGhpcy5fYWRkUXVlcnlSZWFkc1RvKHRlbXBsYXRlUmVmSWQsIHRlbXBsYXRlUmVmSWQsIHRoaXMuX3F1ZXJpZWRUb2tlbnMpO1xuICAgIH1cbiAgICByZWZzLmZvckVhY2goKHJlZkFzdCkgPT4ge1xuICAgICAgbGV0IGRlZmF1bHRRdWVyeVZhbHVlID0gcmVmQXN0LnZhbHVlIHx8XG4gICAgICAgICAgY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSh0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3RvciwgSWRlbnRpZmllcnMuRWxlbWVudFJlZik7XG4gICAgICB0aGlzLl9hZGRRdWVyeVJlYWRzVG8oe3ZhbHVlOiByZWZBc3QubmFtZX0sIGRlZmF1bHRRdWVyeVZhbHVlLCB0aGlzLl9xdWVyaWVkVG9rZW5zKTtcbiAgICB9KTtcbiAgICBpZiAodGhpcy5fcXVlcmllZFRva2Vucy5nZXQoXG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuVmlld0NvbnRhaW5lclJlZikpKSB7XG4gICAgICB0aGlzLnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lciA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIHRoZSBwcm92aWRlcnMgdGhhdCB3ZSBrbm93IGFyZSBlYWdlciBmaXJzdFxuICAgIEFycmF5LmZyb20odGhpcy5fYWxsUHJvdmlkZXJzLnZhbHVlcygpKS5mb3JFYWNoKChwcm92aWRlcikgPT4ge1xuICAgICAgY29uc3QgZWFnZXIgPSBwcm92aWRlci5lYWdlciB8fCB0aGlzLl9xdWVyaWVkVG9rZW5zLmdldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbikpO1xuICAgICAgaWYgKGVhZ2VyKSB7XG4gICAgICAgIHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihwcm92aWRlci5wcm92aWRlclR5cGUsIHByb3ZpZGVyLnRva2VuLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFmdGVyRWxlbWVudCgpIHtcbiAgICAvLyBjb2xsZWN0IGxhenkgcHJvdmlkZXJzXG4gICAgQXJyYXkuZnJvbSh0aGlzLl9hbGxQcm92aWRlcnMudmFsdWVzKCkpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICB0aGlzLl9nZXRPckNyZWF0ZUxvY2FsUHJvdmlkZXIocHJvdmlkZXIucHJvdmlkZXJUeXBlLCBwcm92aWRlci50b2tlbiwgZmFsc2UpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHRyYW5zZm9ybVByb3ZpZGVycygpOiBQcm92aWRlckFzdFtdIHtcbiAgICAvLyBOb3RlOiBNYXBzIGtlZXAgdGhlaXIgaW5zZXJ0aW9uIG9yZGVyLlxuICAgIGNvbnN0IGxhenlQcm92aWRlcnM6IFByb3ZpZGVyQXN0W10gPSBbXTtcbiAgICBjb25zdCBlYWdlclByb3ZpZGVyczogUHJvdmlkZXJBc3RbXSA9IFtdO1xuICAgIHRoaXMuX3RyYW5zZm9ybWVkUHJvdmlkZXJzLmZvckVhY2gocHJvdmlkZXIgPT4ge1xuICAgICAgaWYgKHByb3ZpZGVyLmVhZ2VyKSB7XG4gICAgICAgIGVhZ2VyUHJvdmlkZXJzLnB1c2gocHJvdmlkZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGF6eVByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbGF6eVByb3ZpZGVycy5jb25jYXQoZWFnZXJQcm92aWRlcnMpO1xuICB9XG5cbiAgZ2V0IHRyYW5zZm9ybWVkRGlyZWN0aXZlQXN0cygpOiBEaXJlY3RpdmVBc3RbXSB7XG4gICAgY29uc3Qgc29ydGVkUHJvdmlkZXJUeXBlcyA9IHRoaXMudHJhbnNmb3JtUHJvdmlkZXJzLm1hcChwcm92aWRlciA9PiBwcm92aWRlci50b2tlbi5pZGVudGlmaWVyKTtcbiAgICBjb25zdCBzb3J0ZWREaXJlY3RpdmVzID0gdGhpcy5fZGlyZWN0aXZlQXN0cy5zbGljZSgpO1xuICAgIHNvcnRlZERpcmVjdGl2ZXMuc29ydChcbiAgICAgICAgKGRpcjEsIGRpcjIpID0+IHNvcnRlZFByb3ZpZGVyVHlwZXMuaW5kZXhPZihkaXIxLmRpcmVjdGl2ZS50eXBlKSAtXG4gICAgICAgICAgICBzb3J0ZWRQcm92aWRlclR5cGVzLmluZGV4T2YoZGlyMi5kaXJlY3RpdmUudHlwZSkpO1xuICAgIHJldHVybiBzb3J0ZWREaXJlY3RpdmVzO1xuICB9XG5cbiAgZ2V0IHF1ZXJ5TWF0Y2hlcygpOiBRdWVyeU1hdGNoW10ge1xuICAgIGNvbnN0IGFsbE1hdGNoZXM6IFF1ZXJ5TWF0Y2hbXSA9IFtdO1xuICAgIHRoaXMuX3F1ZXJpZWRUb2tlbnMuZm9yRWFjaCgobWF0Y2hlczogUXVlcnlNYXRjaFtdKSA9PiB7XG4gICAgICBhbGxNYXRjaGVzLnB1c2goLi4ubWF0Y2hlcyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGFsbE1hdGNoZXM7XG4gIH1cblxuICBwcml2YXRlIF9hZGRRdWVyeVJlYWRzVG8oXG4gICAgICB0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEsIGRlZmF1bHRWYWx1ZTogQ29tcGlsZVRva2VuTWV0YWRhdGEsXG4gICAgICBxdWVyeVJlYWRUb2tlbnM6IE1hcDxhbnksIFF1ZXJ5TWF0Y2hbXT4pIHtcbiAgICB0aGlzLl9nZXRRdWVyaWVzRm9yKHRva2VuKS5mb3JFYWNoKChxdWVyeSkgPT4ge1xuICAgICAgY29uc3QgcXVlcnlWYWx1ZSA9IHF1ZXJ5Lm1ldGEucmVhZCB8fCBkZWZhdWx0VmFsdWU7XG4gICAgICBjb25zdCB0b2tlblJlZiA9IHRva2VuUmVmZXJlbmNlKHF1ZXJ5VmFsdWUpO1xuICAgICAgbGV0IHF1ZXJ5TWF0Y2hlcyA9IHF1ZXJ5UmVhZFRva2Vucy5nZXQodG9rZW5SZWYpO1xuICAgICAgaWYgKCFxdWVyeU1hdGNoZXMpIHtcbiAgICAgICAgcXVlcnlNYXRjaGVzID0gW107XG4gICAgICAgIHF1ZXJ5UmVhZFRva2Vucy5zZXQodG9rZW5SZWYsIHF1ZXJ5TWF0Y2hlcyk7XG4gICAgICB9XG4gICAgICBxdWVyeU1hdGNoZXMucHVzaCh7cXVlcnlJZDogcXVlcnkucXVlcnlJZCwgdmFsdWU6IHF1ZXJ5VmFsdWV9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFF1ZXJpZXNGb3IodG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhKTogUXVlcnlXaXRoSWRbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBRdWVyeVdpdGhJZFtdID0gW107XG4gICAgbGV0IGN1cnJlbnRFbDogUHJvdmlkZXJFbGVtZW50Q29udGV4dCA9IHRoaXM7XG4gICAgbGV0IGRpc3RhbmNlID0gMDtcbiAgICBsZXQgcXVlcmllczogUXVlcnlXaXRoSWRbXXx1bmRlZmluZWQ7XG4gICAgd2hpbGUgKGN1cnJlbnRFbCAhPT0gbnVsbCkge1xuICAgICAgcXVlcmllcyA9IGN1cnJlbnRFbC5fY29udGVudFF1ZXJpZXMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgICBpZiAocXVlcmllcykge1xuICAgICAgICByZXN1bHQucHVzaCguLi5xdWVyaWVzLmZpbHRlcigocXVlcnkpID0+IHF1ZXJ5Lm1ldGEuZGVzY2VuZGFudHMgfHwgZGlzdGFuY2UgPD0gMSkpO1xuICAgICAgfVxuICAgICAgaWYgKGN1cnJlbnRFbC5fZGlyZWN0aXZlQXN0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGRpc3RhbmNlKys7XG4gICAgICB9XG4gICAgICBjdXJyZW50RWwgPSBjdXJyZW50RWwuX3BhcmVudDtcbiAgICB9XG4gICAgcXVlcmllcyA9IHRoaXMudmlld0NvbnRleHQudmlld1F1ZXJpZXMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgaWYgKHF1ZXJpZXMpIHtcbiAgICAgIHJlc3VsdC5wdXNoKC4uLnF1ZXJpZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cblxuICBwcml2YXRlIF9nZXRPckNyZWF0ZUxvY2FsUHJvdmlkZXIoXG4gICAgICByZXF1ZXN0aW5nUHJvdmlkZXJUeXBlOiBQcm92aWRlckFzdFR5cGUsIHRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSxcbiAgICAgIGVhZ2VyOiBib29sZWFuKTogUHJvdmlkZXJBc3R8bnVsbCB7XG4gICAgY29uc3QgcmVzb2x2ZWRQcm92aWRlciA9IHRoaXMuX2FsbFByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAoIXJlc29sdmVkUHJvdmlkZXIgfHxcbiAgICAgICAgKChyZXF1ZXN0aW5nUHJvdmlkZXJUeXBlID09PSBQcm92aWRlckFzdFR5cGUuRGlyZWN0aXZlIHx8XG4gICAgICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UpICYmXG4gICAgICAgICByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlByaXZhdGVTZXJ2aWNlKSB8fFxuICAgICAgICAoKHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5Qcml2YXRlU2VydmljZSB8fFxuICAgICAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5QdWJsaWNTZXJ2aWNlKSAmJlxuICAgICAgICAgcmVzb2x2ZWRQcm92aWRlci5wcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5CdWlsdGluKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGxldCB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0ID0gdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgaWYgKHRyYW5zZm9ybWVkUHJvdmlkZXJBc3QpIHtcbiAgICAgIHJldHVybiB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0O1xuICAgIH1cbiAgICBpZiAodGhpcy5fc2VlblByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKSAhPSBudWxsKSB7XG4gICAgICB0aGlzLnZpZXdDb250ZXh0LmVycm9ycy5wdXNoKG5ldyBQcm92aWRlckVycm9yKFxuICAgICAgICAgIGBDYW5ub3QgaW5zdGFudGlhdGUgY3ljbGljIGRlcGVuZGVuY3khICR7dG9rZW5OYW1lKHRva2VuKX1gLCB0aGlzLl9zb3VyY2VTcGFuKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5fc2VlblByb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCB0cnVlKTtcbiAgICBjb25zdCB0cmFuc2Zvcm1lZFByb3ZpZGVycyA9IHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJzLm1hcCgocHJvdmlkZXIpID0+IHtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZFVzZVZhbHVlID0gcHJvdmlkZXIudXNlVmFsdWU7XG4gICAgICBsZXQgdHJhbnNmb3JtZWRVc2VFeGlzdGluZyA9IHByb3ZpZGVyLnVzZUV4aXN0aW5nITtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZERlcHM6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YVtdID0gdW5kZWZpbmVkITtcbiAgICAgIGlmIChwcm92aWRlci51c2VFeGlzdGluZyAhPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nRGlEZXAgPSB0aGlzLl9nZXREZXBlbmRlbmN5KFxuICAgICAgICAgICAgcmVzb2x2ZWRQcm92aWRlci5wcm92aWRlclR5cGUsIHt0b2tlbjogcHJvdmlkZXIudXNlRXhpc3Rpbmd9LCBlYWdlcikhO1xuICAgICAgICBpZiAoZXhpc3RpbmdEaURlcC50b2tlbiAhPSBudWxsKSB7XG4gICAgICAgICAgdHJhbnNmb3JtZWRVc2VFeGlzdGluZyA9IGV4aXN0aW5nRGlEZXAudG9rZW47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJhbnNmb3JtZWRVc2VFeGlzdGluZyA9IG51bGwhO1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlVmFsdWUgPSBleGlzdGluZ0RpRGVwLnZhbHVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHByb3ZpZGVyLnVzZUZhY3RvcnkpIHtcbiAgICAgICAgY29uc3QgZGVwcyA9IHByb3ZpZGVyLmRlcHMgfHwgcHJvdmlkZXIudXNlRmFjdG9yeS5kaURlcHM7XG4gICAgICAgIHRyYW5zZm9ybWVkRGVwcyA9XG4gICAgICAgICAgICBkZXBzLm1hcCgoZGVwKSA9PiB0aGlzLl9nZXREZXBlbmRlbmN5KHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJUeXBlLCBkZXAsIGVhZ2VyKSEpO1xuICAgICAgfSBlbHNlIGlmIChwcm92aWRlci51c2VDbGFzcykge1xuICAgICAgICBjb25zdCBkZXBzID0gcHJvdmlkZXIuZGVwcyB8fCBwcm92aWRlci51c2VDbGFzcy5kaURlcHM7XG4gICAgICAgIHRyYW5zZm9ybWVkRGVwcyA9XG4gICAgICAgICAgICBkZXBzLm1hcCgoZGVwKSA9PiB0aGlzLl9nZXREZXBlbmRlbmN5KHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJUeXBlLCBkZXAsIGVhZ2VyKSEpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF90cmFuc2Zvcm1Qcm92aWRlcihwcm92aWRlciwge1xuICAgICAgICB1c2VFeGlzdGluZzogdHJhbnNmb3JtZWRVc2VFeGlzdGluZyxcbiAgICAgICAgdXNlVmFsdWU6IHRyYW5zZm9ybWVkVXNlVmFsdWUsXG4gICAgICAgIGRlcHM6IHRyYW5zZm9ybWVkRGVwc1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdHJhbnNmb3JtZWRQcm92aWRlckFzdCA9XG4gICAgICAgIF90cmFuc2Zvcm1Qcm92aWRlckFzdChyZXNvbHZlZFByb3ZpZGVyLCB7ZWFnZXI6IGVhZ2VyLCBwcm92aWRlcnM6IHRyYW5zZm9ybWVkUHJvdmlkZXJzfSk7XG4gICAgdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuc2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSwgdHJhbnNmb3JtZWRQcm92aWRlckFzdCk7XG4gICAgcmV0dXJuIHRyYW5zZm9ybWVkUHJvdmlkZXJBc3Q7XG4gIH1cblxuICBwcml2YXRlIF9nZXRMb2NhbERlcGVuZGVuY3koXG4gICAgICByZXF1ZXN0aW5nUHJvdmlkZXJUeXBlOiBQcm92aWRlckFzdFR5cGUsIGRlcDogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhLFxuICAgICAgZWFnZXI6IGJvb2xlYW4gPSBmYWxzZSk6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YXxudWxsIHtcbiAgICBpZiAoZGVwLmlzQXR0cmlidXRlKSB7XG4gICAgICBjb25zdCBhdHRyVmFsdWUgPSB0aGlzLl9hdHRyc1tkZXAudG9rZW4hLnZhbHVlXTtcbiAgICAgIHJldHVybiB7aXNWYWx1ZTogdHJ1ZSwgdmFsdWU6IGF0dHJWYWx1ZSA9PSBudWxsID8gbnVsbCA6IGF0dHJWYWx1ZX07XG4gICAgfVxuXG4gICAgaWYgKGRlcC50b2tlbiAhPSBudWxsKSB7XG4gICAgICAvLyBhY2Nlc3MgYnVpbHRpbnRzXG4gICAgICBpZiAoKHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5EaXJlY3RpdmUgfHxcbiAgICAgICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLkNvbXBvbmVudCkpIHtcbiAgICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlJlbmRlcmVyKSB8fFxuICAgICAgICAgICAgdG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuKSA9PT1cbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuRWxlbWVudFJlZikgfHxcbiAgICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKFxuICAgICAgICAgICAgICAgICAgICBJZGVudGlmaWVycy5DaGFuZ2VEZXRlY3RvclJlZikgfHxcbiAgICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlRlbXBsYXRlUmVmKSkge1xuICAgICAgICAgIHJldHVybiBkZXA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuVmlld0NvbnRhaW5lclJlZikpIHtcbiAgICAgICAgICAodGhpcyBhcyB7dHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyOiBib29sZWFufSkudHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gYWNjZXNzIHRoZSBpbmplY3RvclxuICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkluamVjdG9yKSkge1xuICAgICAgICByZXR1cm4gZGVwO1xuICAgICAgfVxuICAgICAgLy8gYWNjZXNzIHByb3ZpZGVyc1xuICAgICAgaWYgKHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihyZXF1ZXN0aW5nUHJvdmlkZXJUeXBlLCBkZXAudG9rZW4sIGVhZ2VyKSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBkZXA7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0RGVwZW5kZW5jeShcbiAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGU6IFByb3ZpZGVyQXN0VHlwZSwgZGVwOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGEsXG4gICAgICBlYWdlcjogYm9vbGVhbiA9IGZhbHNlKTogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhfG51bGwge1xuICAgIGxldCBjdXJyRWxlbWVudDogUHJvdmlkZXJFbGVtZW50Q29udGV4dCA9IHRoaXM7XG4gICAgbGV0IGN1cnJFYWdlcjogYm9vbGVhbiA9IGVhZ2VyO1xuICAgIGxldCByZXN1bHQ6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YXxudWxsID0gbnVsbDtcbiAgICBpZiAoIWRlcC5pc1NraXBTZWxmKSB7XG4gICAgICByZXN1bHQgPSB0aGlzLl9nZXRMb2NhbERlcGVuZGVuY3kocmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSwgZGVwLCBlYWdlcik7XG4gICAgfVxuICAgIGlmIChkZXAuaXNTZWxmKSB7XG4gICAgICBpZiAoIXJlc3VsdCAmJiBkZXAuaXNPcHRpb25hbCkge1xuICAgICAgICByZXN1bHQgPSB7aXNWYWx1ZTogdHJ1ZSwgdmFsdWU6IG51bGx9O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjaGVjayBwYXJlbnQgZWxlbWVudHNcbiAgICAgIHdoaWxlICghcmVzdWx0ICYmIGN1cnJFbGVtZW50Ll9wYXJlbnQpIHtcbiAgICAgICAgY29uc3QgcHJldkVsZW1lbnQgPSBjdXJyRWxlbWVudDtcbiAgICAgICAgY3VyckVsZW1lbnQgPSBjdXJyRWxlbWVudC5fcGFyZW50O1xuICAgICAgICBpZiAocHJldkVsZW1lbnQuX2lzVmlld1Jvb3QpIHtcbiAgICAgICAgICBjdXJyRWFnZXIgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPSBjdXJyRWxlbWVudC5fZ2V0TG9jYWxEZXBlbmRlbmN5KFByb3ZpZGVyQXN0VHlwZS5QdWJsaWNTZXJ2aWNlLCBkZXAsIGN1cnJFYWdlcik7XG4gICAgICB9XG4gICAgICAvLyBjaGVjayBASG9zdCByZXN0cmljdGlvblxuICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgaWYgKCFkZXAuaXNIb3N0IHx8IHRoaXMudmlld0NvbnRleHQuY29tcG9uZW50LmlzSG9zdCB8fFxuICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5jb21wb25lbnQudHlwZS5yZWZlcmVuY2UgPT09IHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbiEpIHx8XG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnZpZXdQcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbiEpKSAhPSBudWxsKSB7XG4gICAgICAgICAgcmVzdWx0ID0gZGVwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IGRlcC5pc09wdGlvbmFsID8ge2lzVmFsdWU6IHRydWUsIHZhbHVlOiBudWxsfSA6IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIHRoaXMudmlld0NvbnRleHQuZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFByb3ZpZGVyRXJyb3IoYE5vIHByb3ZpZGVyIGZvciAke3Rva2VuTmFtZShkZXAudG9rZW4hKX1gLCB0aGlzLl9zb3VyY2VTcGFuKSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgTmdNb2R1bGVQcm92aWRlckFuYWx5emVyIHtcbiAgcHJpdmF0ZSBfdHJhbnNmb3JtZWRQcm92aWRlcnMgPSBuZXcgTWFwPGFueSwgUHJvdmlkZXJBc3Q+KCk7XG4gIHByaXZhdGUgX3NlZW5Qcm92aWRlcnMgPSBuZXcgTWFwPGFueSwgYm9vbGVhbj4oKTtcbiAgcHJpdmF0ZSBfYWxsUHJvdmlkZXJzOiBNYXA8YW55LCBQcm92aWRlckFzdD47XG4gIHByaXZhdGUgX2Vycm9yczogUHJvdmlkZXJFcnJvcltdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgbmdNb2R1bGU6IENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLFxuICAgICAgZXh0cmFQcm92aWRlcnM6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHRoaXMuX2FsbFByb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBQcm92aWRlckFzdD4oKTtcbiAgICBuZ01vZHVsZS50cmFuc2l0aXZlTW9kdWxlLm1vZHVsZXMuZm9yRWFjaCgobmdNb2R1bGVUeXBlOiBDb21waWxlVHlwZU1ldGFkYXRhKSA9PiB7XG4gICAgICBjb25zdCBuZ01vZHVsZVByb3ZpZGVyID0ge3Rva2VuOiB7aWRlbnRpZmllcjogbmdNb2R1bGVUeXBlfSwgdXNlQ2xhc3M6IG5nTW9kdWxlVHlwZX07XG4gICAgICBfcmVzb2x2ZVByb3ZpZGVycyhcbiAgICAgICAgICBbbmdNb2R1bGVQcm92aWRlcl0sIFByb3ZpZGVyQXN0VHlwZS5QdWJsaWNTZXJ2aWNlLCB0cnVlLCBzb3VyY2VTcGFuLCB0aGlzLl9lcnJvcnMsXG4gICAgICAgICAgdGhpcy5fYWxsUHJvdmlkZXJzLCAvKiBpc01vZHVsZSAqLyB0cnVlKTtcbiAgICB9KTtcbiAgICBfcmVzb2x2ZVByb3ZpZGVycyhcbiAgICAgICAgbmdNb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5wcm92aWRlcnMubWFwKGVudHJ5ID0+IGVudHJ5LnByb3ZpZGVyKS5jb25jYXQoZXh0cmFQcm92aWRlcnMpLFxuICAgICAgICBQcm92aWRlckFzdFR5cGUuUHVibGljU2VydmljZSwgZmFsc2UsIHNvdXJjZVNwYW4sIHRoaXMuX2Vycm9ycywgdGhpcy5fYWxsUHJvdmlkZXJzLFxuICAgICAgICAvKiBpc01vZHVsZSAqLyBmYWxzZSk7XG4gIH1cblxuICBwYXJzZSgpOiBQcm92aWRlckFzdFtdIHtcbiAgICBBcnJheS5mcm9tKHRoaXMuX2FsbFByb3ZpZGVycy52YWx1ZXMoKSkuZm9yRWFjaCgocHJvdmlkZXIpID0+IHtcbiAgICAgIHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihwcm92aWRlci50b2tlbiwgcHJvdmlkZXIuZWFnZXIpO1xuICAgIH0pO1xuICAgIGlmICh0aGlzLl9lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZXJyb3JTdHJpbmcgPSB0aGlzLl9lcnJvcnMuam9pbignXFxuJyk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3ZpZGVyIHBhcnNlIGVycm9yczpcXG4ke2Vycm9yU3RyaW5nfWApO1xuICAgIH1cbiAgICAvLyBOb3RlOiBNYXBzIGtlZXAgdGhlaXIgaW5zZXJ0aW9uIG9yZGVyLlxuICAgIGNvbnN0IGxhenlQcm92aWRlcnM6IFByb3ZpZGVyQXN0W10gPSBbXTtcbiAgICBjb25zdCBlYWdlclByb3ZpZGVyczogUHJvdmlkZXJBc3RbXSA9IFtdO1xuICAgIHRoaXMuX3RyYW5zZm9ybWVkUHJvdmlkZXJzLmZvckVhY2gocHJvdmlkZXIgPT4ge1xuICAgICAgaWYgKHByb3ZpZGVyLmVhZ2VyKSB7XG4gICAgICAgIGVhZ2VyUHJvdmlkZXJzLnB1c2gocHJvdmlkZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGF6eVByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbGF6eVByb3ZpZGVycy5jb25jYXQoZWFnZXJQcm92aWRlcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0T3JDcmVhdGVMb2NhbFByb3ZpZGVyKHRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSwgZWFnZXI6IGJvb2xlYW4pOiBQcm92aWRlckFzdHxudWxsIHtcbiAgICBjb25zdCByZXNvbHZlZFByb3ZpZGVyID0gdGhpcy5fYWxsUHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpO1xuICAgIGlmICghcmVzb2x2ZWRQcm92aWRlcikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGxldCB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0ID0gdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgaWYgKHRyYW5zZm9ybWVkUHJvdmlkZXJBc3QpIHtcbiAgICAgIHJldHVybiB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0O1xuICAgIH1cbiAgICBpZiAodGhpcy5fc2VlblByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKSAhPSBudWxsKSB7XG4gICAgICB0aGlzLl9lcnJvcnMucHVzaChuZXcgUHJvdmlkZXJFcnJvcihcbiAgICAgICAgICBgQ2Fubm90IGluc3RhbnRpYXRlIGN5Y2xpYyBkZXBlbmRlbmN5ISAke3Rva2VuTmFtZSh0b2tlbil9YCxcbiAgICAgICAgICByZXNvbHZlZFByb3ZpZGVyLnNvdXJjZVNwYW4pKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLl9zZWVuUHJvdmlkZXJzLnNldCh0b2tlblJlZmVyZW5jZSh0b2tlbiksIHRydWUpO1xuICAgIGNvbnN0IHRyYW5zZm9ybWVkUHJvdmlkZXJzID0gcmVzb2x2ZWRQcm92aWRlci5wcm92aWRlcnMubWFwKChwcm92aWRlcikgPT4ge1xuICAgICAgbGV0IHRyYW5zZm9ybWVkVXNlVmFsdWUgPSBwcm92aWRlci51c2VWYWx1ZTtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gcHJvdmlkZXIudXNlRXhpc3RpbmchO1xuICAgICAgbGV0IHRyYW5zZm9ybWVkRGVwczogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhW10gPSB1bmRlZmluZWQhO1xuICAgICAgaWYgKHByb3ZpZGVyLnVzZUV4aXN0aW5nICE9IG51bGwpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdEaURlcCA9XG4gICAgICAgICAgICB0aGlzLl9nZXREZXBlbmRlbmN5KHt0b2tlbjogcHJvdmlkZXIudXNlRXhpc3Rpbmd9LCBlYWdlciwgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nRGlEZXAudG9rZW4gIT0gbnVsbCkge1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlRXhpc3RpbmcgPSBleGlzdGluZ0RpRGVwLnRva2VuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlRXhpc3RpbmcgPSBudWxsITtcbiAgICAgICAgICB0cmFuc2Zvcm1lZFVzZVZhbHVlID0gZXhpc3RpbmdEaURlcC52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwcm92aWRlci51c2VGYWN0b3J5KSB7XG4gICAgICAgIGNvbnN0IGRlcHMgPSBwcm92aWRlci5kZXBzIHx8IHByb3ZpZGVyLnVzZUZhY3RvcnkuZGlEZXBzO1xuICAgICAgICB0cmFuc2Zvcm1lZERlcHMgPVxuICAgICAgICAgICAgZGVwcy5tYXAoKGRlcCkgPT4gdGhpcy5fZ2V0RGVwZW5kZW5jeShkZXAsIGVhZ2VyLCByZXNvbHZlZFByb3ZpZGVyLnNvdXJjZVNwYW4pKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvdmlkZXIudXNlQ2xhc3MpIHtcbiAgICAgICAgY29uc3QgZGVwcyA9IHByb3ZpZGVyLmRlcHMgfHwgcHJvdmlkZXIudXNlQ2xhc3MuZGlEZXBzO1xuICAgICAgICB0cmFuc2Zvcm1lZERlcHMgPVxuICAgICAgICAgICAgZGVwcy5tYXAoKGRlcCkgPT4gdGhpcy5fZ2V0RGVwZW5kZW5jeShkZXAsIGVhZ2VyLCByZXNvbHZlZFByb3ZpZGVyLnNvdXJjZVNwYW4pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBfdHJhbnNmb3JtUHJvdmlkZXIocHJvdmlkZXIsIHtcbiAgICAgICAgdXNlRXhpc3Rpbmc6IHRyYW5zZm9ybWVkVXNlRXhpc3RpbmcsXG4gICAgICAgIHVzZVZhbHVlOiB0cmFuc2Zvcm1lZFVzZVZhbHVlLFxuICAgICAgICBkZXBzOiB0cmFuc2Zvcm1lZERlcHNcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHRyYW5zZm9ybWVkUHJvdmlkZXJBc3QgPVxuICAgICAgICBfdHJhbnNmb3JtUHJvdmlkZXJBc3QocmVzb2x2ZWRQcm92aWRlciwge2VhZ2VyOiBlYWdlciwgcHJvdmlkZXJzOiB0cmFuc2Zvcm1lZFByb3ZpZGVyc30pO1xuICAgIHRoaXMuX3RyYW5zZm9ybWVkUHJvdmlkZXJzLnNldCh0b2tlblJlZmVyZW5jZSh0b2tlbiksIHRyYW5zZm9ybWVkUHJvdmlkZXJBc3QpO1xuICAgIHJldHVybiB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0O1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0RGVwZW5kZW5jeShcbiAgICAgIGRlcDogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhLCBlYWdlcjogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgcmVxdWVzdG9yU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgICBsZXQgZm91bmRMb2NhbCA9IGZhbHNlO1xuICAgIGlmICghZGVwLmlzU2tpcFNlbGYgJiYgZGVwLnRva2VuICE9IG51bGwpIHtcbiAgICAgIC8vIGFjY2VzcyB0aGUgaW5qZWN0b3JcbiAgICAgIGlmICh0b2tlblJlZmVyZW5jZShkZXAudG9rZW4pID09PVxuICAgICAgICAgICAgICB0aGlzLnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuSW5qZWN0b3IpIHx8XG4gICAgICAgICAgdG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuKSA9PT1cbiAgICAgICAgICAgICAgdGhpcy5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkNvbXBvbmVudEZhY3RvcnlSZXNvbHZlcikpIHtcbiAgICAgICAgZm91bmRMb2NhbCA9IHRydWU7XG4gICAgICAgIC8vIGFjY2VzcyBwcm92aWRlcnNcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fZ2V0T3JDcmVhdGVMb2NhbFByb3ZpZGVyKGRlcC50b2tlbiwgZWFnZXIpICE9IG51bGwpIHtcbiAgICAgICAgZm91bmRMb2NhbCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkZXA7XG4gIH1cbn1cblxuZnVuY3Rpb24gX3RyYW5zZm9ybVByb3ZpZGVyKFxuICAgIHByb3ZpZGVyOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YSxcbiAgICB7dXNlRXhpc3RpbmcsIHVzZVZhbHVlLCBkZXBzfTpcbiAgICAgICAge3VzZUV4aXN0aW5nOiBDb21waWxlVG9rZW5NZXRhZGF0YSwgdXNlVmFsdWU6IGFueSwgZGVwczogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhW119KSB7XG4gIHJldHVybiB7XG4gICAgdG9rZW46IHByb3ZpZGVyLnRva2VuLFxuICAgIHVzZUNsYXNzOiBwcm92aWRlci51c2VDbGFzcyxcbiAgICB1c2VFeGlzdGluZzogdXNlRXhpc3RpbmcsXG4gICAgdXNlRmFjdG9yeTogcHJvdmlkZXIudXNlRmFjdG9yeSxcbiAgICB1c2VWYWx1ZTogdXNlVmFsdWUsXG4gICAgZGVwczogZGVwcyxcbiAgICBtdWx0aTogcHJvdmlkZXIubXVsdGlcbiAgfTtcbn1cblxuZnVuY3Rpb24gX3RyYW5zZm9ybVByb3ZpZGVyQXN0KFxuICAgIHByb3ZpZGVyOiBQcm92aWRlckFzdCxcbiAgICB7ZWFnZXIsIHByb3ZpZGVyc306IHtlYWdlcjogYm9vbGVhbiwgcHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdfSk6IFByb3ZpZGVyQXN0IHtcbiAgcmV0dXJuIG5ldyBQcm92aWRlckFzdChcbiAgICAgIHByb3ZpZGVyLnRva2VuLCBwcm92aWRlci5tdWx0aVByb3ZpZGVyLCBwcm92aWRlci5lYWdlciB8fCBlYWdlciwgcHJvdmlkZXJzLFxuICAgICAgcHJvdmlkZXIucHJvdmlkZXJUeXBlLCBwcm92aWRlci5saWZlY3ljbGVIb29rcywgcHJvdmlkZXIuc291cmNlU3BhbiwgcHJvdmlkZXIuaXNNb2R1bGUpO1xufVxuXG5mdW5jdGlvbiBfcmVzb2x2ZVByb3ZpZGVyc0Zyb21EaXJlY3RpdmVzKFxuICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICB0YXJnZXRFcnJvcnM6IFBhcnNlRXJyb3JbXSk6IE1hcDxhbnksIFByb3ZpZGVyQXN0PiB7XG4gIGNvbnN0IHByb3ZpZGVyc0J5VG9rZW4gPSBuZXcgTWFwPGFueSwgUHJvdmlkZXJBc3Q+KCk7XG4gIGRpcmVjdGl2ZXMuZm9yRWFjaCgoZGlyZWN0aXZlKSA9PiB7XG4gICAgY29uc3QgZGlyUHJvdmlkZXI6XG4gICAgICAgIENvbXBpbGVQcm92aWRlck1ldGFkYXRhID0ge3Rva2VuOiB7aWRlbnRpZmllcjogZGlyZWN0aXZlLnR5cGV9LCB1c2VDbGFzczogZGlyZWN0aXZlLnR5cGV9O1xuICAgIF9yZXNvbHZlUHJvdmlkZXJzKFxuICAgICAgICBbZGlyUHJvdmlkZXJdLFxuICAgICAgICBkaXJlY3RpdmUuaXNDb21wb25lbnQgPyBQcm92aWRlckFzdFR5cGUuQ29tcG9uZW50IDogUHJvdmlkZXJBc3RUeXBlLkRpcmVjdGl2ZSwgdHJ1ZSxcbiAgICAgICAgc291cmNlU3BhbiwgdGFyZ2V0RXJyb3JzLCBwcm92aWRlcnNCeVRva2VuLCAvKiBpc01vZHVsZSAqLyBmYWxzZSk7XG4gIH0pO1xuXG4gIC8vIE5vdGU6IGRpcmVjdGl2ZXMgbmVlZCB0byBiZSBhYmxlIHRvIG92ZXJ3cml0ZSBwcm92aWRlcnMgb2YgYSBjb21wb25lbnQhXG4gIGNvbnN0IGRpcmVjdGl2ZXNXaXRoQ29tcG9uZW50Rmlyc3QgPVxuICAgICAgZGlyZWN0aXZlcy5maWx0ZXIoZGlyID0+IGRpci5pc0NvbXBvbmVudCkuY29uY2F0KGRpcmVjdGl2ZXMuZmlsdGVyKGRpciA9PiAhZGlyLmlzQ29tcG9uZW50KSk7XG4gIGRpcmVjdGl2ZXNXaXRoQ29tcG9uZW50Rmlyc3QuZm9yRWFjaCgoZGlyZWN0aXZlKSA9PiB7XG4gICAgX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgICAgIGRpcmVjdGl2ZS5wcm92aWRlcnMsIFByb3ZpZGVyQXN0VHlwZS5QdWJsaWNTZXJ2aWNlLCBmYWxzZSwgc291cmNlU3BhbiwgdGFyZ2V0RXJyb3JzLFxuICAgICAgICBwcm92aWRlcnNCeVRva2VuLCAvKiBpc01vZHVsZSAqLyBmYWxzZSk7XG4gICAgX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgICAgIGRpcmVjdGl2ZS52aWV3UHJvdmlkZXJzLCBQcm92aWRlckFzdFR5cGUuUHJpdmF0ZVNlcnZpY2UsIGZhbHNlLCBzb3VyY2VTcGFuLCB0YXJnZXRFcnJvcnMsXG4gICAgICAgIHByb3ZpZGVyc0J5VG9rZW4sIC8qIGlzTW9kdWxlICovIGZhbHNlKTtcbiAgfSk7XG4gIHJldHVybiBwcm92aWRlcnNCeVRva2VuO1xufVxuXG5mdW5jdGlvbiBfcmVzb2x2ZVByb3ZpZGVycyhcbiAgICBwcm92aWRlcnM6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhW10sIHByb3ZpZGVyVHlwZTogUHJvdmlkZXJBc3RUeXBlLCBlYWdlcjogYm9vbGVhbixcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHRhcmdldEVycm9yczogUGFyc2VFcnJvcltdLFxuICAgIHRhcmdldFByb3ZpZGVyc0J5VG9rZW46IE1hcDxhbnksIFByb3ZpZGVyQXN0PiwgaXNNb2R1bGU6IGJvb2xlYW4pIHtcbiAgcHJvdmlkZXJzLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgbGV0IHJlc29sdmVkUHJvdmlkZXIgPSB0YXJnZXRQcm92aWRlcnNCeVRva2VuLmdldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbikpO1xuICAgIGlmIChyZXNvbHZlZFByb3ZpZGVyICE9IG51bGwgJiYgISFyZXNvbHZlZFByb3ZpZGVyLm11bHRpUHJvdmlkZXIgIT09ICEhcHJvdmlkZXIubXVsdGkpIHtcbiAgICAgIHRhcmdldEVycm9ycy5wdXNoKG5ldyBQcm92aWRlckVycm9yKFxuICAgICAgICAgIGBNaXhpbmcgbXVsdGkgYW5kIG5vbiBtdWx0aSBwcm92aWRlciBpcyBub3QgcG9zc2libGUgZm9yIHRva2VuICR7XG4gICAgICAgICAgICAgIHRva2VuTmFtZShyZXNvbHZlZFByb3ZpZGVyLnRva2VuKX1gLFxuICAgICAgICAgIHNvdXJjZVNwYW4pKTtcbiAgICB9XG4gICAgaWYgKCFyZXNvbHZlZFByb3ZpZGVyKSB7XG4gICAgICBjb25zdCBsaWZlY3ljbGVIb29rcyA9IHByb3ZpZGVyLnRva2VuLmlkZW50aWZpZXIgJiZcbiAgICAgICAgICAgICAgKDxDb21waWxlVHlwZU1ldGFkYXRhPnByb3ZpZGVyLnRva2VuLmlkZW50aWZpZXIpLmxpZmVjeWNsZUhvb2tzID9cbiAgICAgICAgICAoPENvbXBpbGVUeXBlTWV0YWRhdGE+cHJvdmlkZXIudG9rZW4uaWRlbnRpZmllcikubGlmZWN5Y2xlSG9va3MgOlxuICAgICAgICAgIFtdO1xuICAgICAgY29uc3QgaXNVc2VWYWx1ZSA9ICEocHJvdmlkZXIudXNlQ2xhc3MgfHwgcHJvdmlkZXIudXNlRXhpc3RpbmcgfHwgcHJvdmlkZXIudXNlRmFjdG9yeSk7XG4gICAgICByZXNvbHZlZFByb3ZpZGVyID0gbmV3IFByb3ZpZGVyQXN0KFxuICAgICAgICAgIHByb3ZpZGVyLnRva2VuLCAhIXByb3ZpZGVyLm11bHRpLCBlYWdlciB8fCBpc1VzZVZhbHVlLCBbcHJvdmlkZXJdLCBwcm92aWRlclR5cGUsXG4gICAgICAgICAgbGlmZWN5Y2xlSG9va3MsIHNvdXJjZVNwYW4sIGlzTW9kdWxlKTtcbiAgICAgIHRhcmdldFByb3ZpZGVyc0J5VG9rZW4uc2V0KHRva2VuUmVmZXJlbmNlKHByb3ZpZGVyLnRva2VuKSwgcmVzb2x2ZWRQcm92aWRlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghcHJvdmlkZXIubXVsdGkpIHtcbiAgICAgICAgcmVzb2x2ZWRQcm92aWRlci5wcm92aWRlcnMubGVuZ3RoID0gMDtcbiAgICAgIH1cbiAgICAgIHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJzLnB1c2gocHJvdmlkZXIpO1xuICAgIH1cbiAgfSk7XG59XG5cblxuZnVuY3Rpb24gX2dldFZpZXdRdWVyaWVzKGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKTogTWFwPGFueSwgUXVlcnlXaXRoSWRbXT4ge1xuICAvLyBOb3RlOiBxdWVyaWVzIHN0YXJ0IHdpdGggaWQgMSBzbyB3ZSBjYW4gdXNlIHRoZSBudW1iZXIgaW4gYSBCbG9vbSBmaWx0ZXIhXG4gIGxldCB2aWV3UXVlcnlJZCA9IDE7XG4gIGNvbnN0IHZpZXdRdWVyaWVzID0gbmV3IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+KCk7XG4gIGlmIChjb21wb25lbnQudmlld1F1ZXJpZXMpIHtcbiAgICBjb21wb25lbnQudmlld1F1ZXJpZXMuZm9yRWFjaChcbiAgICAgICAgKHF1ZXJ5KSA9PiBfYWRkUXVlcnlUb1Rva2VuTWFwKHZpZXdRdWVyaWVzLCB7bWV0YTogcXVlcnksIHF1ZXJ5SWQ6IHZpZXdRdWVyeUlkKyt9KSk7XG4gIH1cbiAgcmV0dXJuIHZpZXdRdWVyaWVzO1xufVxuXG5mdW5jdGlvbiBfZ2V0Q29udGVudFF1ZXJpZXMoXG4gICAgY29udGVudFF1ZXJ5U3RhcnRJZDogbnVtYmVyLCBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdKTogTWFwPGFueSwgUXVlcnlXaXRoSWRbXT4ge1xuICBsZXQgY29udGVudFF1ZXJ5SWQgPSBjb250ZW50UXVlcnlTdGFydElkO1xuICBjb25zdCBjb250ZW50UXVlcmllcyA9IG5ldyBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPigpO1xuICBkaXJlY3RpdmVzLmZvckVhY2goKGRpcmVjdGl2ZSwgZGlyZWN0aXZlSW5kZXgpID0+IHtcbiAgICBpZiAoZGlyZWN0aXZlLnF1ZXJpZXMpIHtcbiAgICAgIGRpcmVjdGl2ZS5xdWVyaWVzLmZvckVhY2goXG4gICAgICAgICAgKHF1ZXJ5KSA9PiBfYWRkUXVlcnlUb1Rva2VuTWFwKGNvbnRlbnRRdWVyaWVzLCB7bWV0YTogcXVlcnksIHF1ZXJ5SWQ6IGNvbnRlbnRRdWVyeUlkKyt9KSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGNvbnRlbnRRdWVyaWVzO1xufVxuXG5mdW5jdGlvbiBfYWRkUXVlcnlUb1Rva2VuTWFwKG1hcDogTWFwPGFueSwgUXVlcnlXaXRoSWRbXT4sIHF1ZXJ5OiBRdWVyeVdpdGhJZCkge1xuICBxdWVyeS5tZXRhLnNlbGVjdG9ycy5mb3JFYWNoKCh0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEpID0+IHtcbiAgICBsZXQgZW50cnkgPSBtYXAuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgaWYgKCFlbnRyeSkge1xuICAgICAgZW50cnkgPSBbXTtcbiAgICAgIG1hcC5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCBlbnRyeSk7XG4gICAgfVxuICAgIGVudHJ5LnB1c2gocXVlcnkpO1xuICB9KTtcbn1cbiJdfQ==