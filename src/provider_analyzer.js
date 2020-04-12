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
            enumerable: true,
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
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ProviderElementContext.prototype, "queryMatches", {
            get: function () {
                var allMatches = [];
                this._queriedTokens.forEach(function (matches) { allMatches.push.apply(allMatches, tslib_1.__spread(matches)); });
                return allMatches;
            },
            enumerable: true,
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
            if (!resolvedProvider || ((requestingProviderType === template_ast_1.ProviderAstType.Directive ||
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXJfYW5hbHl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcHJvdmlkZXJfYW5hbHl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBR0gsMkVBQWdRO0lBRWhRLGlFQUEyRTtJQUMzRSwrREFBeUQ7SUFDekQsbUZBQTZIO0lBRTdIO1FBQW1DLHlDQUFVO1FBQzNDLHVCQUFZLE9BQWUsRUFBRSxJQUFxQjttQkFBSSxrQkFBTSxJQUFJLEVBQUUsT0FBTyxDQUFDO1FBQUUsQ0FBQztRQUMvRSxvQkFBQztJQUFELENBQUMsQUFGRCxDQUFtQyx1QkFBVSxHQUU1QztJQUZZLHNDQUFhO0lBUzFCO1FBV0UsNkJBQW1CLFNBQTJCLEVBQVMsU0FBbUM7WUFBMUYsaUJBUUM7WUFSa0IsY0FBUyxHQUFULFNBQVMsQ0FBa0I7WUFBUyxjQUFTLEdBQVQsU0FBUyxDQUEwQjtZQUYxRixXQUFNLEdBQW9CLEVBQUUsQ0FBQztZQUczQixJQUFJLENBQUMsV0FBVyxHQUFHLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM5QyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO1lBQzdDLFNBQVMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLFVBQUMsUUFBUTtnQkFDdkMsSUFBSSxLQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxpQ0FBYyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksRUFBRTtvQkFDbEUsS0FBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsaUNBQWMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7aUJBQzlEO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0gsMEJBQUM7SUFBRCxDQUFDLEFBcEJELElBb0JD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VUFBQyxTQUFTLEVBQUUsY0FBYztZQUMzQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUU7Z0JBQ3JCLFNBQVMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUNyQixVQUFDLEtBQUssSUFBSyxPQUFBLG1CQUFtQixDQUFDLGNBQWMsRUFBRSxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxFQUFDLENBQUMsRUFBN0UsQ0FBNkUsQ0FBQyxDQUFDO2FBQy9GO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLGNBQWMsQ0FBQztJQUN4QixDQUFDO0lBRUQsU0FBUyxtQkFBbUIsQ0FBQyxHQUE0QixFQUFFLEtBQWtCO1FBQzNFLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFDLEtBQTJCO1lBQ3ZELElBQUksS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsaUNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzNDLElBQUksQ0FBQyxLQUFLLEVBQUU7Z0JBQ1YsS0FBSyxHQUFHLEVBQUUsQ0FBQztnQkFDWCxHQUFHLENBQUMsR0FBRyxDQUFDLGlDQUFjLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDdkM7WUFDRCxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge0NvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSwgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsIENvbXBpbGVQcm92aWRlck1ldGFkYXRhLCBDb21waWxlUXVlcnlNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIENvbXBpbGVUeXBlTWV0YWRhdGEsIHRva2VuTmFtZSwgdG9rZW5SZWZlcmVuY2V9IGZyb20gJy4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtJZGVudGlmaWVycywgY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZX0gZnJvbSAnLi9pZGVudGlmaWVycyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7QXR0ckFzdCwgRGlyZWN0aXZlQXN0LCBQcm92aWRlckFzdCwgUHJvdmlkZXJBc3RUeXBlLCBRdWVyeU1hdGNoLCBSZWZlcmVuY2VBc3R9IGZyb20gJy4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX2FzdCc7XG5cbmV4cG9ydCBjbGFzcyBQcm92aWRlckVycm9yIGV4dGVuZHMgUGFyc2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgc3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7IHN1cGVyKHNwYW4sIG1lc3NhZ2UpOyB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVlcnlXaXRoSWQge1xuICBtZXRhOiBDb21waWxlUXVlcnlNZXRhZGF0YTtcbiAgcXVlcnlJZDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgUHJvdmlkZXJWaWV3Q29udGV4dCB7XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHZpZXdRdWVyaWVzOiBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPjtcbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgdmlld1Byb3ZpZGVyczogTWFwPGFueSwgYm9vbGVhbj47XG4gIGVycm9yczogUHJvdmlkZXJFcnJvcltdID0gW107XG5cbiAgY29uc3RydWN0b3IocHVibGljIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgcHVibGljIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKSB7XG4gICAgdGhpcy52aWV3UXVlcmllcyA9IF9nZXRWaWV3UXVlcmllcyhjb21wb25lbnQpO1xuICAgIHRoaXMudmlld1Byb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBib29sZWFuPigpO1xuICAgIGNvbXBvbmVudC52aWV3UHJvdmlkZXJzLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICBpZiAodGhpcy52aWV3UHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbikpID09IG51bGwpIHtcbiAgICAgICAgdGhpcy52aWV3UHJvdmlkZXJzLnNldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbiksIHRydWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQcm92aWRlckVsZW1lbnRDb250ZXh0IHtcbiAgcHJpdmF0ZSBfY29udGVudFF1ZXJpZXM6IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+O1xuXG4gIHByaXZhdGUgX3RyYW5zZm9ybWVkUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIFByb3ZpZGVyQXN0PigpO1xuICBwcml2YXRlIF9zZWVuUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIGJvb2xlYW4+KCk7XG4gIHByaXZhdGUgX2FsbFByb3ZpZGVyczogTWFwPGFueSwgUHJvdmlkZXJBc3Q+O1xuICBwcml2YXRlIF9hdHRyczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHByaXZhdGUgX3F1ZXJpZWRUb2tlbnMgPSBuZXcgTWFwPGFueSwgUXVlcnlNYXRjaFtdPigpO1xuXG4gIHB1YmxpYyByZWFkb25seSB0cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXI6IGJvb2xlYW4gPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2aWV3Q29udGV4dDogUHJvdmlkZXJWaWV3Q29udGV4dCwgcHJpdmF0ZSBfcGFyZW50OiBQcm92aWRlckVsZW1lbnRDb250ZXh0LFxuICAgICAgcHJpdmF0ZSBfaXNWaWV3Um9vdDogYm9vbGVhbiwgcHJpdmF0ZSBfZGlyZWN0aXZlQXN0czogRGlyZWN0aXZlQXN0W10sIGF0dHJzOiBBdHRyQXN0W10sXG4gICAgICByZWZzOiBSZWZlcmVuY2VBc3RbXSwgaXNUZW1wbGF0ZTogYm9vbGVhbiwgY29udGVudFF1ZXJ5U3RhcnRJZDogbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBfc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgdGhpcy5fYXR0cnMgPSB7fTtcbiAgICBhdHRycy5mb3JFYWNoKChhdHRyQXN0KSA9PiB0aGlzLl9hdHRyc1thdHRyQXN0Lm5hbWVdID0gYXR0ckFzdC52YWx1ZSk7XG4gICAgY29uc3QgZGlyZWN0aXZlc01ldGEgPSBfZGlyZWN0aXZlQXN0cy5tYXAoZGlyZWN0aXZlQXN0ID0+IGRpcmVjdGl2ZUFzdC5kaXJlY3RpdmUpO1xuICAgIHRoaXMuX2FsbFByb3ZpZGVycyA9XG4gICAgICAgIF9yZXNvbHZlUHJvdmlkZXJzRnJvbURpcmVjdGl2ZXMoZGlyZWN0aXZlc01ldGEsIF9zb3VyY2VTcGFuLCB2aWV3Q29udGV4dC5lcnJvcnMpO1xuICAgIHRoaXMuX2NvbnRlbnRRdWVyaWVzID0gX2dldENvbnRlbnRRdWVyaWVzKGNvbnRlbnRRdWVyeVN0YXJ0SWQsIGRpcmVjdGl2ZXNNZXRhKTtcbiAgICBBcnJheS5mcm9tKHRoaXMuX2FsbFByb3ZpZGVycy52YWx1ZXMoKSkuZm9yRWFjaCgocHJvdmlkZXIpID0+IHtcbiAgICAgIHRoaXMuX2FkZFF1ZXJ5UmVhZHNUbyhwcm92aWRlci50b2tlbiwgcHJvdmlkZXIudG9rZW4sIHRoaXMuX3F1ZXJpZWRUb2tlbnMpO1xuICAgIH0pO1xuICAgIGlmIChpc1RlbXBsYXRlKSB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZVJlZklkID1cbiAgICAgICAgICBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLCBJZGVudGlmaWVycy5UZW1wbGF0ZVJlZik7XG4gICAgICB0aGlzLl9hZGRRdWVyeVJlYWRzVG8odGVtcGxhdGVSZWZJZCwgdGVtcGxhdGVSZWZJZCwgdGhpcy5fcXVlcmllZFRva2Vucyk7XG4gICAgfVxuICAgIHJlZnMuZm9yRWFjaCgocmVmQXN0KSA9PiB7XG4gICAgICBsZXQgZGVmYXVsdFF1ZXJ5VmFsdWUgPSByZWZBc3QudmFsdWUgfHxcbiAgICAgICAgICBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLCBJZGVudGlmaWVycy5FbGVtZW50UmVmKTtcbiAgICAgIHRoaXMuX2FkZFF1ZXJ5UmVhZHNUbyh7dmFsdWU6IHJlZkFzdC5uYW1lfSwgZGVmYXVsdFF1ZXJ5VmFsdWUsIHRoaXMuX3F1ZXJpZWRUb2tlbnMpO1xuICAgIH0pO1xuICAgIGlmICh0aGlzLl9xdWVyaWVkVG9rZW5zLmdldChcbiAgICAgICAgICAgIHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5WaWV3Q29udGFpbmVyUmVmKSkpIHtcbiAgICAgIHRoaXMudHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgdGhlIHByb3ZpZGVycyB0aGF0IHdlIGtub3cgYXJlIGVhZ2VyIGZpcnN0XG4gICAgQXJyYXkuZnJvbSh0aGlzLl9hbGxQcm92aWRlcnMudmFsdWVzKCkpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICBjb25zdCBlYWdlciA9IHByb3ZpZGVyLmVhZ2VyIHx8IHRoaXMuX3F1ZXJpZWRUb2tlbnMuZ2V0KHRva2VuUmVmZXJlbmNlKHByb3ZpZGVyLnRva2VuKSk7XG4gICAgICBpZiAoZWFnZXIpIHtcbiAgICAgICAgdGhpcy5fZ2V0T3JDcmVhdGVMb2NhbFByb3ZpZGVyKHByb3ZpZGVyLnByb3ZpZGVyVHlwZSwgcHJvdmlkZXIudG9rZW4sIHRydWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYWZ0ZXJFbGVtZW50KCkge1xuICAgIC8vIGNvbGxlY3QgbGF6eSBwcm92aWRlcnNcbiAgICBBcnJheS5mcm9tKHRoaXMuX2FsbFByb3ZpZGVycy52YWx1ZXMoKSkuZm9yRWFjaCgocHJvdmlkZXIpID0+IHtcbiAgICAgIHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihwcm92aWRlci5wcm92aWRlclR5cGUsIHByb3ZpZGVyLnRva2VuLCBmYWxzZSk7XG4gICAgfSk7XG4gIH1cblxuICBnZXQgdHJhbnNmb3JtUHJvdmlkZXJzKCk6IFByb3ZpZGVyQXN0W10ge1xuICAgIC8vIE5vdGU6IE1hcHMga2VlcCB0aGVpciBpbnNlcnRpb24gb3JkZXIuXG4gICAgY29uc3QgbGF6eVByb3ZpZGVyczogUHJvdmlkZXJBc3RbXSA9IFtdO1xuICAgIGNvbnN0IGVhZ2VyUHJvdmlkZXJzOiBQcm92aWRlckFzdFtdID0gW107XG4gICAgdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuZm9yRWFjaChwcm92aWRlciA9PiB7XG4gICAgICBpZiAocHJvdmlkZXIuZWFnZXIpIHtcbiAgICAgICAgZWFnZXJQcm92aWRlcnMucHVzaChwcm92aWRlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsYXp5UHJvdmlkZXJzLnB1c2gocHJvdmlkZXIpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBsYXp5UHJvdmlkZXJzLmNvbmNhdChlYWdlclByb3ZpZGVycyk7XG4gIH1cblxuICBnZXQgdHJhbnNmb3JtZWREaXJlY3RpdmVBc3RzKCk6IERpcmVjdGl2ZUFzdFtdIHtcbiAgICBjb25zdCBzb3J0ZWRQcm92aWRlclR5cGVzID0gdGhpcy50cmFuc2Zvcm1Qcm92aWRlcnMubWFwKHByb3ZpZGVyID0+IHByb3ZpZGVyLnRva2VuLmlkZW50aWZpZXIpO1xuICAgIGNvbnN0IHNvcnRlZERpcmVjdGl2ZXMgPSB0aGlzLl9kaXJlY3RpdmVBc3RzLnNsaWNlKCk7XG4gICAgc29ydGVkRGlyZWN0aXZlcy5zb3J0KFxuICAgICAgICAoZGlyMSwgZGlyMikgPT4gc29ydGVkUHJvdmlkZXJUeXBlcy5pbmRleE9mKGRpcjEuZGlyZWN0aXZlLnR5cGUpIC1cbiAgICAgICAgICAgIHNvcnRlZFByb3ZpZGVyVHlwZXMuaW5kZXhPZihkaXIyLmRpcmVjdGl2ZS50eXBlKSk7XG4gICAgcmV0dXJuIHNvcnRlZERpcmVjdGl2ZXM7XG4gIH1cblxuICBnZXQgcXVlcnlNYXRjaGVzKCk6IFF1ZXJ5TWF0Y2hbXSB7XG4gICAgY29uc3QgYWxsTWF0Y2hlczogUXVlcnlNYXRjaFtdID0gW107XG4gICAgdGhpcy5fcXVlcmllZFRva2Vucy5mb3JFYWNoKChtYXRjaGVzOiBRdWVyeU1hdGNoW10pID0+IHsgYWxsTWF0Y2hlcy5wdXNoKC4uLm1hdGNoZXMpOyB9KTtcbiAgICByZXR1cm4gYWxsTWF0Y2hlcztcbiAgfVxuXG4gIHByaXZhdGUgX2FkZFF1ZXJ5UmVhZHNUbyhcbiAgICAgIHRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSwgZGVmYXVsdFZhbHVlOiBDb21waWxlVG9rZW5NZXRhZGF0YSxcbiAgICAgIHF1ZXJ5UmVhZFRva2VuczogTWFwPGFueSwgUXVlcnlNYXRjaFtdPikge1xuICAgIHRoaXMuX2dldFF1ZXJpZXNGb3IodG9rZW4pLmZvckVhY2goKHF1ZXJ5KSA9PiB7XG4gICAgICBjb25zdCBxdWVyeVZhbHVlID0gcXVlcnkubWV0YS5yZWFkIHx8IGRlZmF1bHRWYWx1ZTtcbiAgICAgIGNvbnN0IHRva2VuUmVmID0gdG9rZW5SZWZlcmVuY2UocXVlcnlWYWx1ZSk7XG4gICAgICBsZXQgcXVlcnlNYXRjaGVzID0gcXVlcnlSZWFkVG9rZW5zLmdldCh0b2tlblJlZik7XG4gICAgICBpZiAoIXF1ZXJ5TWF0Y2hlcykge1xuICAgICAgICBxdWVyeU1hdGNoZXMgPSBbXTtcbiAgICAgICAgcXVlcnlSZWFkVG9rZW5zLnNldCh0b2tlblJlZiwgcXVlcnlNYXRjaGVzKTtcbiAgICAgIH1cbiAgICAgIHF1ZXJ5TWF0Y2hlcy5wdXNoKHtxdWVyeUlkOiBxdWVyeS5xdWVyeUlkLCB2YWx1ZTogcXVlcnlWYWx1ZX0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0UXVlcmllc0Zvcih0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEpOiBRdWVyeVdpdGhJZFtdIHtcbiAgICBjb25zdCByZXN1bHQ6IFF1ZXJ5V2l0aElkW10gPSBbXTtcbiAgICBsZXQgY3VycmVudEVsOiBQcm92aWRlckVsZW1lbnRDb250ZXh0ID0gdGhpcztcbiAgICBsZXQgZGlzdGFuY2UgPSAwO1xuICAgIGxldCBxdWVyaWVzOiBRdWVyeVdpdGhJZFtdfHVuZGVmaW5lZDtcbiAgICB3aGlsZSAoY3VycmVudEVsICE9PSBudWxsKSB7XG4gICAgICBxdWVyaWVzID0gY3VycmVudEVsLl9jb250ZW50UXVlcmllcy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICAgIGlmIChxdWVyaWVzKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKC4uLnF1ZXJpZXMuZmlsdGVyKChxdWVyeSkgPT4gcXVlcnkubWV0YS5kZXNjZW5kYW50cyB8fCBkaXN0YW5jZSA8PSAxKSk7XG4gICAgICB9XG4gICAgICBpZiAoY3VycmVudEVsLl9kaXJlY3RpdmVBc3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZGlzdGFuY2UrKztcbiAgICAgIH1cbiAgICAgIGN1cnJlbnRFbCA9IGN1cnJlbnRFbC5fcGFyZW50O1xuICAgIH1cbiAgICBxdWVyaWVzID0gdGhpcy52aWV3Q29udGV4dC52aWV3UXVlcmllcy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAocXVlcmllcykge1xuICAgICAgcmVzdWx0LnB1c2goLi4ucXVlcmllcyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuXG4gIHByaXZhdGUgX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihcbiAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGU6IFByb3ZpZGVyQXN0VHlwZSwgdG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhLFxuICAgICAgZWFnZXI6IGJvb2xlYW4pOiBQcm92aWRlckFzdHxudWxsIHtcbiAgICBjb25zdCByZXNvbHZlZFByb3ZpZGVyID0gdGhpcy5fYWxsUHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpO1xuICAgIGlmICghcmVzb2x2ZWRQcm92aWRlciB8fCAoKHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5EaXJlY3RpdmUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0aW5nUHJvdmlkZXJUeXBlID09PSBQcm92aWRlckFzdFR5cGUuUHVibGljU2VydmljZSkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJUeXBlID09PSBQcm92aWRlckFzdFR5cGUuUHJpdmF0ZVNlcnZpY2UpIHx8XG4gICAgICAgICgocmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlByaXZhdGVTZXJ2aWNlIHx8XG4gICAgICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UpICYmXG4gICAgICAgICByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLkJ1aWx0aW4pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbGV0IHRyYW5zZm9ybWVkUHJvdmlkZXJBc3QgPSB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAodHJhbnNmb3JtZWRQcm92aWRlckFzdCkge1xuICAgICAgcmV0dXJuIHRyYW5zZm9ybWVkUHJvdmlkZXJBc3Q7XG4gICAgfVxuICAgIGlmICh0aGlzLl9zZWVuUHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpICE9IG51bGwpIHtcbiAgICAgIHRoaXMudmlld0NvbnRleHQuZXJyb3JzLnB1c2gobmV3IFByb3ZpZGVyRXJyb3IoXG4gICAgICAgICAgYENhbm5vdCBpbnN0YW50aWF0ZSBjeWNsaWMgZGVwZW5kZW5jeSEgJHt0b2tlbk5hbWUodG9rZW4pfWAsIHRoaXMuX3NvdXJjZVNwYW4pKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLl9zZWVuUHJvdmlkZXJzLnNldCh0b2tlblJlZmVyZW5jZSh0b2tlbiksIHRydWUpO1xuICAgIGNvbnN0IHRyYW5zZm9ybWVkUHJvdmlkZXJzID0gcmVzb2x2ZWRQcm92aWRlci5wcm92aWRlcnMubWFwKChwcm92aWRlcikgPT4ge1xuICAgICAgbGV0IHRyYW5zZm9ybWVkVXNlVmFsdWUgPSBwcm92aWRlci51c2VWYWx1ZTtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gcHJvdmlkZXIudXNlRXhpc3RpbmcgITtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZERlcHM6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YVtdID0gdW5kZWZpbmVkICE7XG4gICAgICBpZiAocHJvdmlkZXIudXNlRXhpc3RpbmcgIT0gbnVsbCkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0RpRGVwID0gdGhpcy5fZ2V0RGVwZW5kZW5jeShcbiAgICAgICAgICAgIHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJUeXBlLCB7dG9rZW46IHByb3ZpZGVyLnVzZUV4aXN0aW5nfSwgZWFnZXIpICE7XG4gICAgICAgIGlmIChleGlzdGluZ0RpRGVwLnRva2VuICE9IG51bGwpIHtcbiAgICAgICAgICB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gZXhpc3RpbmdEaURlcC50b2tlbjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gbnVsbCAhO1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlVmFsdWUgPSBleGlzdGluZ0RpRGVwLnZhbHVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHByb3ZpZGVyLnVzZUZhY3RvcnkpIHtcbiAgICAgICAgY29uc3QgZGVwcyA9IHByb3ZpZGVyLmRlcHMgfHwgcHJvdmlkZXIudXNlRmFjdG9yeS5kaURlcHM7XG4gICAgICAgIHRyYW5zZm9ybWVkRGVwcyA9XG4gICAgICAgICAgICBkZXBzLm1hcCgoZGVwKSA9PiB0aGlzLl9nZXREZXBlbmRlbmN5KHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJUeXBlLCBkZXAsIGVhZ2VyKSAhKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvdmlkZXIudXNlQ2xhc3MpIHtcbiAgICAgICAgY29uc3QgZGVwcyA9IHByb3ZpZGVyLmRlcHMgfHwgcHJvdmlkZXIudXNlQ2xhc3MuZGlEZXBzO1xuICAgICAgICB0cmFuc2Zvcm1lZERlcHMgPVxuICAgICAgICAgICAgZGVwcy5tYXAoKGRlcCkgPT4gdGhpcy5fZ2V0RGVwZW5kZW5jeShyZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVyVHlwZSwgZGVwLCBlYWdlcikgISk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3RyYW5zZm9ybVByb3ZpZGVyKHByb3ZpZGVyLCB7XG4gICAgICAgIHVzZUV4aXN0aW5nOiB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nLFxuICAgICAgICB1c2VWYWx1ZTogdHJhbnNmb3JtZWRVc2VWYWx1ZSxcbiAgICAgICAgZGVwczogdHJhbnNmb3JtZWREZXBzXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0ID1cbiAgICAgICAgX3RyYW5zZm9ybVByb3ZpZGVyQXN0KHJlc29sdmVkUHJvdmlkZXIsIHtlYWdlcjogZWFnZXIsIHByb3ZpZGVyczogdHJhbnNmb3JtZWRQcm92aWRlcnN9KTtcbiAgICB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0KTtcbiAgICByZXR1cm4gdHJhbnNmb3JtZWRQcm92aWRlckFzdDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldExvY2FsRGVwZW5kZW5jeShcbiAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGU6IFByb3ZpZGVyQXN0VHlwZSwgZGVwOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGEsXG4gICAgICBlYWdlcjogYm9vbGVhbiA9IGZhbHNlKTogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhfG51bGwge1xuICAgIGlmIChkZXAuaXNBdHRyaWJ1dGUpIHtcbiAgICAgIGNvbnN0IGF0dHJWYWx1ZSA9IHRoaXMuX2F0dHJzW2RlcC50b2tlbiAhLnZhbHVlXTtcbiAgICAgIHJldHVybiB7aXNWYWx1ZTogdHJ1ZSwgdmFsdWU6IGF0dHJWYWx1ZSA9PSBudWxsID8gbnVsbCA6IGF0dHJWYWx1ZX07XG4gICAgfVxuXG4gICAgaWYgKGRlcC50b2tlbiAhPSBudWxsKSB7XG4gICAgICAvLyBhY2Nlc3MgYnVpbHRpbnRzXG4gICAgICBpZiAoKHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5EaXJlY3RpdmUgfHxcbiAgICAgICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLkNvbXBvbmVudCkpIHtcbiAgICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlJlbmRlcmVyKSB8fFxuICAgICAgICAgICAgdG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuKSA9PT1cbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuRWxlbWVudFJlZikgfHxcbiAgICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKFxuICAgICAgICAgICAgICAgICAgICBJZGVudGlmaWVycy5DaGFuZ2VEZXRlY3RvclJlZikgfHxcbiAgICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlRlbXBsYXRlUmVmKSkge1xuICAgICAgICAgIHJldHVybiBkZXA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuVmlld0NvbnRhaW5lclJlZikpIHtcbiAgICAgICAgICAodGhpcyBhc3t0cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXI6IGJvb2xlYW59KS50cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXIgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBhY2Nlc3MgdGhlIGluamVjdG9yXG4gICAgICBpZiAodG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuKSA9PT1cbiAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuSW5qZWN0b3IpKSB7XG4gICAgICAgIHJldHVybiBkZXA7XG4gICAgICB9XG4gICAgICAvLyBhY2Nlc3MgcHJvdmlkZXJzXG4gICAgICBpZiAodGhpcy5fZ2V0T3JDcmVhdGVMb2NhbFByb3ZpZGVyKHJlcXVlc3RpbmdQcm92aWRlclR5cGUsIGRlcC50b2tlbiwgZWFnZXIpICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGRlcDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9nZXREZXBlbmRlbmN5KFxuICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZTogUHJvdmlkZXJBc3RUeXBlLCBkZXA6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSxcbiAgICAgIGVhZ2VyOiBib29sZWFuID0gZmFsc2UpOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGF8bnVsbCB7XG4gICAgbGV0IGN1cnJFbGVtZW50OiBQcm92aWRlckVsZW1lbnRDb250ZXh0ID0gdGhpcztcbiAgICBsZXQgY3VyckVhZ2VyOiBib29sZWFuID0gZWFnZXI7XG4gICAgbGV0IHJlc3VsdDogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhfG51bGwgPSBudWxsO1xuICAgIGlmICghZGVwLmlzU2tpcFNlbGYpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMuX2dldExvY2FsRGVwZW5kZW5jeShyZXF1ZXN0aW5nUHJvdmlkZXJUeXBlLCBkZXAsIGVhZ2VyKTtcbiAgICB9XG4gICAgaWYgKGRlcC5pc1NlbGYpIHtcbiAgICAgIGlmICghcmVzdWx0ICYmIGRlcC5pc09wdGlvbmFsKSB7XG4gICAgICAgIHJlc3VsdCA9IHtpc1ZhbHVlOiB0cnVlLCB2YWx1ZTogbnVsbH07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNoZWNrIHBhcmVudCBlbGVtZW50c1xuICAgICAgd2hpbGUgKCFyZXN1bHQgJiYgY3VyckVsZW1lbnQuX3BhcmVudCkge1xuICAgICAgICBjb25zdCBwcmV2RWxlbWVudCA9IGN1cnJFbGVtZW50O1xuICAgICAgICBjdXJyRWxlbWVudCA9IGN1cnJFbGVtZW50Ll9wYXJlbnQ7XG4gICAgICAgIGlmIChwcmV2RWxlbWVudC5faXNWaWV3Um9vdCkge1xuICAgICAgICAgIGN1cnJFYWdlciA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCA9IGN1cnJFbGVtZW50Ll9nZXRMb2NhbERlcGVuZGVuY3koUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UsIGRlcCwgY3VyckVhZ2VyKTtcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIEBIb3N0IHJlc3RyaWN0aW9uXG4gICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICBpZiAoIWRlcC5pc0hvc3QgfHwgdGhpcy52aWV3Q29udGV4dC5jb21wb25lbnQuaXNIb3N0IHx8XG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LmNvbXBvbmVudC50eXBlLnJlZmVyZW5jZSA9PT0gdG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuICEpIHx8XG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnZpZXdQcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbiAhKSkgIT0gbnVsbCkge1xuICAgICAgICAgIHJlc3VsdCA9IGRlcDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSBkZXAuaXNPcHRpb25hbCA/IHtpc1ZhbHVlOiB0cnVlLCB2YWx1ZTogbnVsbH0gOiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICB0aGlzLnZpZXdDb250ZXh0LmVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQcm92aWRlckVycm9yKGBObyBwcm92aWRlciBmb3IgJHt0b2tlbk5hbWUoZGVwLnRva2VuISl9YCwgdGhpcy5fc291cmNlU3BhbikpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIE5nTW9kdWxlUHJvdmlkZXJBbmFseXplciB7XG4gIHByaXZhdGUgX3RyYW5zZm9ybWVkUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIFByb3ZpZGVyQXN0PigpO1xuICBwcml2YXRlIF9zZWVuUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIGJvb2xlYW4+KCk7XG4gIHByaXZhdGUgX2FsbFByb3ZpZGVyczogTWFwPGFueSwgUHJvdmlkZXJBc3Q+O1xuICBwcml2YXRlIF9lcnJvcnM6IFByb3ZpZGVyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsIG5nTW9kdWxlOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSxcbiAgICAgIGV4dHJhUHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICB0aGlzLl9hbGxQcm92aWRlcnMgPSBuZXcgTWFwPGFueSwgUHJvdmlkZXJBc3Q+KCk7XG4gICAgbmdNb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5tb2R1bGVzLmZvckVhY2goKG5nTW9kdWxlVHlwZTogQ29tcGlsZVR5cGVNZXRhZGF0YSkgPT4ge1xuICAgICAgY29uc3QgbmdNb2R1bGVQcm92aWRlciA9IHt0b2tlbjoge2lkZW50aWZpZXI6IG5nTW9kdWxlVHlwZX0sIHVzZUNsYXNzOiBuZ01vZHVsZVR5cGV9O1xuICAgICAgX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgICAgICAgW25nTW9kdWxlUHJvdmlkZXJdLCBQcm92aWRlckFzdFR5cGUuUHVibGljU2VydmljZSwgdHJ1ZSwgc291cmNlU3BhbiwgdGhpcy5fZXJyb3JzLFxuICAgICAgICAgIHRoaXMuX2FsbFByb3ZpZGVycywgLyogaXNNb2R1bGUgKi8gdHJ1ZSk7XG4gICAgfSk7XG4gICAgX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgICAgIG5nTW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUucHJvdmlkZXJzLm1hcChlbnRyeSA9PiBlbnRyeS5wcm92aWRlcikuY29uY2F0KGV4dHJhUHJvdmlkZXJzKSxcbiAgICAgICAgUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UsIGZhbHNlLCBzb3VyY2VTcGFuLCB0aGlzLl9lcnJvcnMsIHRoaXMuX2FsbFByb3ZpZGVycyxcbiAgICAgICAgLyogaXNNb2R1bGUgKi8gZmFsc2UpO1xuICB9XG5cbiAgcGFyc2UoKTogUHJvdmlkZXJBc3RbXSB7XG4gICAgQXJyYXkuZnJvbSh0aGlzLl9hbGxQcm92aWRlcnMudmFsdWVzKCkpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICB0aGlzLl9nZXRPckNyZWF0ZUxvY2FsUHJvdmlkZXIocHJvdmlkZXIudG9rZW4sIHByb3ZpZGVyLmVhZ2VyKTtcbiAgICB9KTtcbiAgICBpZiAodGhpcy5fZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGVycm9yU3RyaW5nID0gdGhpcy5fZXJyb3JzLmpvaW4oJ1xcbicpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm92aWRlciBwYXJzZSBlcnJvcnM6XFxuJHtlcnJvclN0cmluZ31gKTtcbiAgICB9XG4gICAgLy8gTm90ZTogTWFwcyBrZWVwIHRoZWlyIGluc2VydGlvbiBvcmRlci5cbiAgICBjb25zdCBsYXp5UHJvdmlkZXJzOiBQcm92aWRlckFzdFtdID0gW107XG4gICAgY29uc3QgZWFnZXJQcm92aWRlcnM6IFByb3ZpZGVyQXN0W10gPSBbXTtcbiAgICB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5mb3JFYWNoKHByb3ZpZGVyID0+IHtcbiAgICAgIGlmIChwcm92aWRlci5lYWdlcikge1xuICAgICAgICBlYWdlclByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxhenlQcm92aWRlcnMucHVzaChwcm92aWRlcik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGxhenlQcm92aWRlcnMuY29uY2F0KGVhZ2VyUHJvdmlkZXJzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcih0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEsIGVhZ2VyOiBib29sZWFuKTogUHJvdmlkZXJBc3R8bnVsbCB7XG4gICAgY29uc3QgcmVzb2x2ZWRQcm92aWRlciA9IHRoaXMuX2FsbFByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAoIXJlc29sdmVkUHJvdmlkZXIpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBsZXQgdHJhbnNmb3JtZWRQcm92aWRlckFzdCA9IHRoaXMuX3RyYW5zZm9ybWVkUHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpO1xuICAgIGlmICh0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0KSB7XG4gICAgICByZXR1cm4gdHJhbnNmb3JtZWRQcm92aWRlckFzdDtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3NlZW5Qcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSkgIT0gbnVsbCkge1xuICAgICAgdGhpcy5fZXJyb3JzLnB1c2gobmV3IFByb3ZpZGVyRXJyb3IoXG4gICAgICAgICAgYENhbm5vdCBpbnN0YW50aWF0ZSBjeWNsaWMgZGVwZW5kZW5jeSEgJHt0b2tlbk5hbWUodG9rZW4pfWAsXG4gICAgICAgICAgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5fc2VlblByb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCB0cnVlKTtcbiAgICBjb25zdCB0cmFuc2Zvcm1lZFByb3ZpZGVycyA9IHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJzLm1hcCgocHJvdmlkZXIpID0+IHtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZFVzZVZhbHVlID0gcHJvdmlkZXIudXNlVmFsdWU7XG4gICAgICBsZXQgdHJhbnNmb3JtZWRVc2VFeGlzdGluZyA9IHByb3ZpZGVyLnVzZUV4aXN0aW5nICE7XG4gICAgICBsZXQgdHJhbnNmb3JtZWREZXBzOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGFbXSA9IHVuZGVmaW5lZCAhO1xuICAgICAgaWYgKHByb3ZpZGVyLnVzZUV4aXN0aW5nICE9IG51bGwpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdEaURlcCA9XG4gICAgICAgICAgICB0aGlzLl9nZXREZXBlbmRlbmN5KHt0b2tlbjogcHJvdmlkZXIudXNlRXhpc3Rpbmd9LCBlYWdlciwgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nRGlEZXAudG9rZW4gIT0gbnVsbCkge1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlRXhpc3RpbmcgPSBleGlzdGluZ0RpRGVwLnRva2VuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlRXhpc3RpbmcgPSBudWxsICE7XG4gICAgICAgICAgdHJhbnNmb3JtZWRVc2VWYWx1ZSA9IGV4aXN0aW5nRGlEZXAudmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocHJvdmlkZXIudXNlRmFjdG9yeSkge1xuICAgICAgICBjb25zdCBkZXBzID0gcHJvdmlkZXIuZGVwcyB8fCBwcm92aWRlci51c2VGYWN0b3J5LmRpRGVwcztcbiAgICAgICAgdHJhbnNmb3JtZWREZXBzID1cbiAgICAgICAgICAgIGRlcHMubWFwKChkZXApID0+IHRoaXMuX2dldERlcGVuZGVuY3koZGVwLCBlYWdlciwgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKSk7XG4gICAgICB9IGVsc2UgaWYgKHByb3ZpZGVyLnVzZUNsYXNzKSB7XG4gICAgICAgIGNvbnN0IGRlcHMgPSBwcm92aWRlci5kZXBzIHx8IHByb3ZpZGVyLnVzZUNsYXNzLmRpRGVwcztcbiAgICAgICAgdHJhbnNmb3JtZWREZXBzID1cbiAgICAgICAgICAgIGRlcHMubWFwKChkZXApID0+IHRoaXMuX2dldERlcGVuZGVuY3koZGVwLCBlYWdlciwgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3RyYW5zZm9ybVByb3ZpZGVyKHByb3ZpZGVyLCB7XG4gICAgICAgIHVzZUV4aXN0aW5nOiB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nLFxuICAgICAgICB1c2VWYWx1ZTogdHJhbnNmb3JtZWRVc2VWYWx1ZSxcbiAgICAgICAgZGVwczogdHJhbnNmb3JtZWREZXBzXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0ID1cbiAgICAgICAgX3RyYW5zZm9ybVByb3ZpZGVyQXN0KHJlc29sdmVkUHJvdmlkZXIsIHtlYWdlcjogZWFnZXIsIHByb3ZpZGVyczogdHJhbnNmb3JtZWRQcm92aWRlcnN9KTtcbiAgICB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0KTtcbiAgICByZXR1cm4gdHJhbnNmb3JtZWRQcm92aWRlckFzdDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldERlcGVuZGVuY3koXG4gICAgICBkZXA6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSwgZWFnZXI6IGJvb2xlYW4gPSBmYWxzZSxcbiAgICAgIHJlcXVlc3RvclNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSB7XG4gICAgbGV0IGZvdW5kTG9jYWwgPSBmYWxzZTtcbiAgICBpZiAoIWRlcC5pc1NraXBTZWxmICYmIGRlcC50b2tlbiAhPSBudWxsKSB7XG4gICAgICAvLyBhY2Nlc3MgdGhlIGluamVjdG9yXG4gICAgICBpZiAodG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuKSA9PT1cbiAgICAgICAgICAgICAgdGhpcy5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkluamVjdG9yKSB8fFxuICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgIHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5Db21wb25lbnRGYWN0b3J5UmVzb2x2ZXIpKSB7XG4gICAgICAgIGZvdW5kTG9jYWwgPSB0cnVlO1xuICAgICAgICAvLyBhY2Nlc3MgcHJvdmlkZXJzXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihkZXAudG9rZW4sIGVhZ2VyKSAhPSBudWxsKSB7XG4gICAgICAgIGZvdW5kTG9jYWwgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVwO1xuICB9XG59XG5cbmZ1bmN0aW9uIF90cmFuc2Zvcm1Qcm92aWRlcihcbiAgICBwcm92aWRlcjogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEsXG4gICAge3VzZUV4aXN0aW5nLCB1c2VWYWx1ZSwgZGVwc306XG4gICAgICAgIHt1c2VFeGlzdGluZzogQ29tcGlsZVRva2VuTWV0YWRhdGEsIHVzZVZhbHVlOiBhbnksIGRlcHM6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YVtdfSkge1xuICByZXR1cm4ge1xuICAgIHRva2VuOiBwcm92aWRlci50b2tlbixcbiAgICB1c2VDbGFzczogcHJvdmlkZXIudXNlQ2xhc3MsXG4gICAgdXNlRXhpc3Rpbmc6IHVzZUV4aXN0aW5nLFxuICAgIHVzZUZhY3Rvcnk6IHByb3ZpZGVyLnVzZUZhY3RvcnksXG4gICAgdXNlVmFsdWU6IHVzZVZhbHVlLFxuICAgIGRlcHM6IGRlcHMsXG4gICAgbXVsdGk6IHByb3ZpZGVyLm11bHRpXG4gIH07XG59XG5cbmZ1bmN0aW9uIF90cmFuc2Zvcm1Qcm92aWRlckFzdChcbiAgICBwcm92aWRlcjogUHJvdmlkZXJBc3QsXG4gICAge2VhZ2VyLCBwcm92aWRlcnN9OiB7ZWFnZXI6IGJvb2xlYW4sIHByb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXX0pOiBQcm92aWRlckFzdCB7XG4gIHJldHVybiBuZXcgUHJvdmlkZXJBc3QoXG4gICAgICBwcm92aWRlci50b2tlbiwgcHJvdmlkZXIubXVsdGlQcm92aWRlciwgcHJvdmlkZXIuZWFnZXIgfHwgZWFnZXIsIHByb3ZpZGVycyxcbiAgICAgIHByb3ZpZGVyLnByb3ZpZGVyVHlwZSwgcHJvdmlkZXIubGlmZWN5Y2xlSG9va3MsIHByb3ZpZGVyLnNvdXJjZVNwYW4sIHByb3ZpZGVyLmlzTW9kdWxlKTtcbn1cblxuZnVuY3Rpb24gX3Jlc29sdmVQcm92aWRlcnNGcm9tRGlyZWN0aXZlcyhcbiAgICBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgdGFyZ2V0RXJyb3JzOiBQYXJzZUVycm9yW10pOiBNYXA8YW55LCBQcm92aWRlckFzdD4ge1xuICBjb25zdCBwcm92aWRlcnNCeVRva2VuID0gbmV3IE1hcDxhbnksIFByb3ZpZGVyQXN0PigpO1xuICBkaXJlY3RpdmVzLmZvckVhY2goKGRpcmVjdGl2ZSkgPT4ge1xuICAgIGNvbnN0IGRpclByb3ZpZGVyOlxuICAgICAgICBDb21waWxlUHJvdmlkZXJNZXRhZGF0YSA9IHt0b2tlbjoge2lkZW50aWZpZXI6IGRpcmVjdGl2ZS50eXBlfSwgdXNlQ2xhc3M6IGRpcmVjdGl2ZS50eXBlfTtcbiAgICBfcmVzb2x2ZVByb3ZpZGVycyhcbiAgICAgICAgW2RpclByb3ZpZGVyXSxcbiAgICAgICAgZGlyZWN0aXZlLmlzQ29tcG9uZW50ID8gUHJvdmlkZXJBc3RUeXBlLkNvbXBvbmVudCA6IFByb3ZpZGVyQXN0VHlwZS5EaXJlY3RpdmUsIHRydWUsXG4gICAgICAgIHNvdXJjZVNwYW4sIHRhcmdldEVycm9ycywgcHJvdmlkZXJzQnlUb2tlbiwgLyogaXNNb2R1bGUgKi8gZmFsc2UpO1xuICB9KTtcblxuICAvLyBOb3RlOiBkaXJlY3RpdmVzIG5lZWQgdG8gYmUgYWJsZSB0byBvdmVyd3JpdGUgcHJvdmlkZXJzIG9mIGEgY29tcG9uZW50IVxuICBjb25zdCBkaXJlY3RpdmVzV2l0aENvbXBvbmVudEZpcnN0ID1cbiAgICAgIGRpcmVjdGl2ZXMuZmlsdGVyKGRpciA9PiBkaXIuaXNDb21wb25lbnQpLmNvbmNhdChkaXJlY3RpdmVzLmZpbHRlcihkaXIgPT4gIWRpci5pc0NvbXBvbmVudCkpO1xuICBkaXJlY3RpdmVzV2l0aENvbXBvbmVudEZpcnN0LmZvckVhY2goKGRpcmVjdGl2ZSkgPT4ge1xuICAgIF9yZXNvbHZlUHJvdmlkZXJzKFxuICAgICAgICBkaXJlY3RpdmUucHJvdmlkZXJzLCBQcm92aWRlckFzdFR5cGUuUHVibGljU2VydmljZSwgZmFsc2UsIHNvdXJjZVNwYW4sIHRhcmdldEVycm9ycyxcbiAgICAgICAgcHJvdmlkZXJzQnlUb2tlbiwgLyogaXNNb2R1bGUgKi8gZmFsc2UpO1xuICAgIF9yZXNvbHZlUHJvdmlkZXJzKFxuICAgICAgICBkaXJlY3RpdmUudmlld1Byb3ZpZGVycywgUHJvdmlkZXJBc3RUeXBlLlByaXZhdGVTZXJ2aWNlLCBmYWxzZSwgc291cmNlU3BhbiwgdGFyZ2V0RXJyb3JzLFxuICAgICAgICBwcm92aWRlcnNCeVRva2VuLCAvKiBpc01vZHVsZSAqLyBmYWxzZSk7XG4gIH0pO1xuICByZXR1cm4gcHJvdmlkZXJzQnlUb2tlbjtcbn1cblxuZnVuY3Rpb24gX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgcHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdLCBwcm92aWRlclR5cGU6IFByb3ZpZGVyQXN0VHlwZSwgZWFnZXI6IGJvb2xlYW4sXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB0YXJnZXRFcnJvcnM6IFBhcnNlRXJyb3JbXSxcbiAgICB0YXJnZXRQcm92aWRlcnNCeVRva2VuOiBNYXA8YW55LCBQcm92aWRlckFzdD4sIGlzTW9kdWxlOiBib29sZWFuKSB7XG4gIHByb3ZpZGVycy5mb3JFYWNoKChwcm92aWRlcikgPT4ge1xuICAgIGxldCByZXNvbHZlZFByb3ZpZGVyID0gdGFyZ2V0UHJvdmlkZXJzQnlUb2tlbi5nZXQodG9rZW5SZWZlcmVuY2UocHJvdmlkZXIudG9rZW4pKTtcbiAgICBpZiAocmVzb2x2ZWRQcm92aWRlciAhPSBudWxsICYmICEhcmVzb2x2ZWRQcm92aWRlci5tdWx0aVByb3ZpZGVyICE9PSAhIXByb3ZpZGVyLm11bHRpKSB7XG4gICAgICB0YXJnZXRFcnJvcnMucHVzaChuZXcgUHJvdmlkZXJFcnJvcihcbiAgICAgICAgICBgTWl4aW5nIG11bHRpIGFuZCBub24gbXVsdGkgcHJvdmlkZXIgaXMgbm90IHBvc3NpYmxlIGZvciB0b2tlbiAke1xuICAgICAgICAgICAgICB0b2tlbk5hbWUocmVzb2x2ZWRQcm92aWRlci50b2tlbil9YCxcbiAgICAgICAgICBzb3VyY2VTcGFuKSk7XG4gICAgfVxuICAgIGlmICghcmVzb2x2ZWRQcm92aWRlcikge1xuICAgICAgY29uc3QgbGlmZWN5Y2xlSG9va3MgPSBwcm92aWRlci50b2tlbi5pZGVudGlmaWVyICYmXG4gICAgICAgICAgICAgICg8Q29tcGlsZVR5cGVNZXRhZGF0YT5wcm92aWRlci50b2tlbi5pZGVudGlmaWVyKS5saWZlY3ljbGVIb29rcyA/XG4gICAgICAgICAgKDxDb21waWxlVHlwZU1ldGFkYXRhPnByb3ZpZGVyLnRva2VuLmlkZW50aWZpZXIpLmxpZmVjeWNsZUhvb2tzIDpcbiAgICAgICAgICBbXTtcbiAgICAgIGNvbnN0IGlzVXNlVmFsdWUgPSAhKHByb3ZpZGVyLnVzZUNsYXNzIHx8IHByb3ZpZGVyLnVzZUV4aXN0aW5nIHx8IHByb3ZpZGVyLnVzZUZhY3RvcnkpO1xuICAgICAgcmVzb2x2ZWRQcm92aWRlciA9IG5ldyBQcm92aWRlckFzdChcbiAgICAgICAgICBwcm92aWRlci50b2tlbiwgISFwcm92aWRlci5tdWx0aSwgZWFnZXIgfHwgaXNVc2VWYWx1ZSwgW3Byb3ZpZGVyXSwgcHJvdmlkZXJUeXBlLFxuICAgICAgICAgIGxpZmVjeWNsZUhvb2tzLCBzb3VyY2VTcGFuLCBpc01vZHVsZSk7XG4gICAgICB0YXJnZXRQcm92aWRlcnNCeVRva2VuLnNldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbiksIHJlc29sdmVkUHJvdmlkZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXByb3ZpZGVyLm11bHRpKSB7XG4gICAgICAgIHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJzLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICB9XG4gIH0pO1xufVxuXG5cbmZ1bmN0aW9uIF9nZXRWaWV3UXVlcmllcyhjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSk6IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+IHtcbiAgLy8gTm90ZTogcXVlcmllcyBzdGFydCB3aXRoIGlkIDEgc28gd2UgY2FuIHVzZSB0aGUgbnVtYmVyIGluIGEgQmxvb20gZmlsdGVyIVxuICBsZXQgdmlld1F1ZXJ5SWQgPSAxO1xuICBjb25zdCB2aWV3UXVlcmllcyA9IG5ldyBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPigpO1xuICBpZiAoY29tcG9uZW50LnZpZXdRdWVyaWVzKSB7XG4gICAgY29tcG9uZW50LnZpZXdRdWVyaWVzLmZvckVhY2goXG4gICAgICAgIChxdWVyeSkgPT4gX2FkZFF1ZXJ5VG9Ub2tlbk1hcCh2aWV3UXVlcmllcywge21ldGE6IHF1ZXJ5LCBxdWVyeUlkOiB2aWV3UXVlcnlJZCsrfSkpO1xuICB9XG4gIHJldHVybiB2aWV3UXVlcmllcztcbn1cblxuZnVuY3Rpb24gX2dldENvbnRlbnRRdWVyaWVzKFxuICAgIGNvbnRlbnRRdWVyeVN0YXJ0SWQ6IG51bWJlciwgZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSk6IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+IHtcbiAgbGV0IGNvbnRlbnRRdWVyeUlkID0gY29udGVudFF1ZXJ5U3RhcnRJZDtcbiAgY29uc3QgY29udGVudFF1ZXJpZXMgPSBuZXcgTWFwPGFueSwgUXVlcnlXaXRoSWRbXT4oKTtcbiAgZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJlY3RpdmUsIGRpcmVjdGl2ZUluZGV4KSA9PiB7XG4gICAgaWYgKGRpcmVjdGl2ZS5xdWVyaWVzKSB7XG4gICAgICBkaXJlY3RpdmUucXVlcmllcy5mb3JFYWNoKFxuICAgICAgICAgIChxdWVyeSkgPT4gX2FkZFF1ZXJ5VG9Ub2tlbk1hcChjb250ZW50UXVlcmllcywge21ldGE6IHF1ZXJ5LCBxdWVyeUlkOiBjb250ZW50UXVlcnlJZCsrfSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBjb250ZW50UXVlcmllcztcbn1cblxuZnVuY3Rpb24gX2FkZFF1ZXJ5VG9Ub2tlbk1hcChtYXA6IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+LCBxdWVyeTogUXVlcnlXaXRoSWQpIHtcbiAgcXVlcnkubWV0YS5zZWxlY3RvcnMuZm9yRWFjaCgodG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhKSA9PiB7XG4gICAgbGV0IGVudHJ5ID0gbWFwLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpO1xuICAgIGlmICghZW50cnkpIHtcbiAgICAgIGVudHJ5ID0gW107XG4gICAgICBtYXAuc2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSwgZW50cnkpO1xuICAgIH1cbiAgICBlbnRyeS5wdXNoKHF1ZXJ5KTtcbiAgfSk7XG59XG4iXX0=