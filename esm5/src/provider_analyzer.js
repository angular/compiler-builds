/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __extends, __read, __spread } from "tslib";
import { tokenName, tokenReference } from './compile_metadata';
import { Identifiers, createTokenForExternalReference } from './identifiers';
import { ParseError } from './parse_util';
import { ProviderAst, ProviderAstType } from './template_parser/template_ast';
var ProviderError = /** @class */ (function (_super) {
    __extends(ProviderError, _super);
    function ProviderError(message, span) {
        return _super.call(this, span, message) || this;
    }
    return ProviderError;
}(ParseError));
export { ProviderError };
var ProviderViewContext = /** @class */ (function () {
    function ProviderViewContext(reflector, component) {
        var _this = this;
        this.reflector = reflector;
        this.component = component;
        this.errors = [];
        this.viewQueries = _getViewQueries(component);
        this.viewProviders = new Map();
        component.viewProviders.forEach(function (provider) {
            if (_this.viewProviders.get(tokenReference(provider.token)) == null) {
                _this.viewProviders.set(tokenReference(provider.token), true);
            }
        });
    }
    return ProviderViewContext;
}());
export { ProviderViewContext };
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
            var templateRefId = createTokenForExternalReference(this.viewContext.reflector, Identifiers.TemplateRef);
            this._addQueryReadsTo(templateRefId, templateRefId, this._queriedTokens);
        }
        refs.forEach(function (refAst) {
            var defaultQueryValue = refAst.value ||
                createTokenForExternalReference(_this.viewContext.reflector, Identifiers.ElementRef);
            _this._addQueryReadsTo({ value: refAst.name }, defaultQueryValue, _this._queriedTokens);
        });
        if (this._queriedTokens.get(this.viewContext.reflector.resolveExternalReference(Identifiers.ViewContainerRef))) {
            this.transformedHasViewContainer = true;
        }
        // create the providers that we know are eager first
        Array.from(this._allProviders.values()).forEach(function (provider) {
            var eager = provider.eager || _this._queriedTokens.get(tokenReference(provider.token));
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
            this._queriedTokens.forEach(function (matches) { allMatches.push.apply(allMatches, __spread(matches)); });
            return allMatches;
        },
        enumerable: true,
        configurable: true
    });
    ProviderElementContext.prototype._addQueryReadsTo = function (token, defaultValue, queryReadTokens) {
        this._getQueriesFor(token).forEach(function (query) {
            var queryValue = query.meta.read || defaultValue;
            var tokenRef = tokenReference(queryValue);
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
            queries = currentEl._contentQueries.get(tokenReference(token));
            if (queries) {
                result.push.apply(result, __spread(queries.filter(function (query) { return query.meta.descendants || distance <= 1; })));
            }
            if (currentEl._directiveAsts.length > 0) {
                distance++;
            }
            currentEl = currentEl._parent;
        }
        queries = this.viewContext.viewQueries.get(tokenReference(token));
        if (queries) {
            result.push.apply(result, __spread(queries));
        }
        return result;
    };
    ProviderElementContext.prototype._getOrCreateLocalProvider = function (requestingProviderType, token, eager) {
        var _this = this;
        var resolvedProvider = this._allProviders.get(tokenReference(token));
        if (!resolvedProvider || ((requestingProviderType === ProviderAstType.Directive ||
            requestingProviderType === ProviderAstType.PublicService) &&
            resolvedProvider.providerType === ProviderAstType.PrivateService) ||
            ((requestingProviderType === ProviderAstType.PrivateService ||
                requestingProviderType === ProviderAstType.PublicService) &&
                resolvedProvider.providerType === ProviderAstType.Builtin)) {
            return null;
        }
        var transformedProviderAst = this._transformedProviders.get(tokenReference(token));
        if (transformedProviderAst) {
            return transformedProviderAst;
        }
        if (this._seenProviders.get(tokenReference(token)) != null) {
            this.viewContext.errors.push(new ProviderError("Cannot instantiate cyclic dependency! " + tokenName(token), this._sourceSpan));
            return null;
        }
        this._seenProviders.set(tokenReference(token), true);
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
        this._transformedProviders.set(tokenReference(token), transformedProviderAst);
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
            if ((requestingProviderType === ProviderAstType.Directive ||
                requestingProviderType === ProviderAstType.Component)) {
                if (tokenReference(dep.token) ===
                    this.viewContext.reflector.resolveExternalReference(Identifiers.Renderer) ||
                    tokenReference(dep.token) ===
                        this.viewContext.reflector.resolveExternalReference(Identifiers.ElementRef) ||
                    tokenReference(dep.token) ===
                        this.viewContext.reflector.resolveExternalReference(Identifiers.ChangeDetectorRef) ||
                    tokenReference(dep.token) ===
                        this.viewContext.reflector.resolveExternalReference(Identifiers.TemplateRef)) {
                    return dep;
                }
                if (tokenReference(dep.token) ===
                    this.viewContext.reflector.resolveExternalReference(Identifiers.ViewContainerRef)) {
                    this.transformedHasViewContainer = true;
                }
            }
            // access the injector
            if (tokenReference(dep.token) ===
                this.viewContext.reflector.resolveExternalReference(Identifiers.Injector)) {
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
                result = currElement._getLocalDependency(ProviderAstType.PublicService, dep, currEager);
            }
            // check @Host restriction
            if (!result) {
                if (!dep.isHost || this.viewContext.component.isHost ||
                    this.viewContext.component.type.reference === tokenReference(dep.token) ||
                    this.viewContext.viewProviders.get(tokenReference(dep.token)) != null) {
                    result = dep;
                }
                else {
                    result = dep.isOptional ? { isValue: true, value: null } : null;
                }
            }
        }
        if (!result) {
            this.viewContext.errors.push(new ProviderError("No provider for " + tokenName(dep.token), this._sourceSpan));
        }
        return result;
    };
    return ProviderElementContext;
}());
export { ProviderElementContext };
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
            _resolveProviders([ngModuleProvider], ProviderAstType.PublicService, true, sourceSpan, _this._errors, _this._allProviders, /* isModule */ true);
        });
        _resolveProviders(ngModule.transitiveModule.providers.map(function (entry) { return entry.provider; }).concat(extraProviders), ProviderAstType.PublicService, false, sourceSpan, this._errors, this._allProviders, 
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
        var resolvedProvider = this._allProviders.get(tokenReference(token));
        if (!resolvedProvider) {
            return null;
        }
        var transformedProviderAst = this._transformedProviders.get(tokenReference(token));
        if (transformedProviderAst) {
            return transformedProviderAst;
        }
        if (this._seenProviders.get(tokenReference(token)) != null) {
            this._errors.push(new ProviderError("Cannot instantiate cyclic dependency! " + tokenName(token), resolvedProvider.sourceSpan));
            return null;
        }
        this._seenProviders.set(tokenReference(token), true);
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
        this._transformedProviders.set(tokenReference(token), transformedProviderAst);
        return transformedProviderAst;
    };
    NgModuleProviderAnalyzer.prototype._getDependency = function (dep, eager, requestorSourceSpan) {
        if (eager === void 0) { eager = false; }
        var foundLocal = false;
        if (!dep.isSkipSelf && dep.token != null) {
            // access the injector
            if (tokenReference(dep.token) ===
                this.reflector.resolveExternalReference(Identifiers.Injector) ||
                tokenReference(dep.token) ===
                    this.reflector.resolveExternalReference(Identifiers.ComponentFactoryResolver)) {
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
export { NgModuleProviderAnalyzer };
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
    return new ProviderAst(provider.token, provider.multiProvider, provider.eager || eager, providers, provider.providerType, provider.lifecycleHooks, provider.sourceSpan, provider.isModule);
}
function _resolveProvidersFromDirectives(directives, sourceSpan, targetErrors) {
    var providersByToken = new Map();
    directives.forEach(function (directive) {
        var dirProvider = { token: { identifier: directive.type }, useClass: directive.type };
        _resolveProviders([dirProvider], directive.isComponent ? ProviderAstType.Component : ProviderAstType.Directive, true, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
    });
    // Note: directives need to be able to overwrite providers of a component!
    var directivesWithComponentFirst = directives.filter(function (dir) { return dir.isComponent; }).concat(directives.filter(function (dir) { return !dir.isComponent; }));
    directivesWithComponentFirst.forEach(function (directive) {
        _resolveProviders(directive.providers, ProviderAstType.PublicService, false, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
        _resolveProviders(directive.viewProviders, ProviderAstType.PrivateService, false, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
    });
    return providersByToken;
}
function _resolveProviders(providers, providerType, eager, sourceSpan, targetErrors, targetProvidersByToken, isModule) {
    providers.forEach(function (provider) {
        var resolvedProvider = targetProvidersByToken.get(tokenReference(provider.token));
        if (resolvedProvider != null && !!resolvedProvider.multiProvider !== !!provider.multi) {
            targetErrors.push(new ProviderError("Mixing multi and non multi provider is not possible for token " + tokenName(resolvedProvider.token), sourceSpan));
        }
        if (!resolvedProvider) {
            var lifecycleHooks = provider.token.identifier &&
                provider.token.identifier.lifecycleHooks ?
                provider.token.identifier.lifecycleHooks :
                [];
            var isUseValue = !(provider.useClass || provider.useExisting || provider.useFactory);
            resolvedProvider = new ProviderAst(provider.token, !!provider.multi, eager || isUseValue, [provider], providerType, lifecycleHooks, sourceSpan, isModule);
            targetProvidersByToken.set(tokenReference(provider.token), resolvedProvider);
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
        var entry = map.get(tokenReference(token));
        if (!entry) {
            entry = [];
            map.set(tokenReference(token), entry);
        }
        entry.push(query);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXJfYW5hbHl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcHJvdmlkZXJfYW5hbHl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQUdILE9BQU8sRUFBb00sU0FBUyxFQUFFLGNBQWMsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBRWhRLE9BQU8sRUFBQyxXQUFXLEVBQUUsK0JBQStCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDM0UsT0FBTyxFQUFDLFVBQVUsRUFBa0IsTUFBTSxjQUFjLENBQUM7QUFDekQsT0FBTyxFQUF3QixXQUFXLEVBQUUsZUFBZSxFQUEyQixNQUFNLGdDQUFnQyxDQUFDO0FBRTdIO0lBQW1DLGlDQUFVO0lBQzNDLHVCQUFZLE9BQWUsRUFBRSxJQUFxQjtlQUFJLGtCQUFNLElBQUksRUFBRSxPQUFPLENBQUM7SUFBRSxDQUFDO0lBQy9FLG9CQUFDO0FBQUQsQ0FBQyxBQUZELENBQW1DLFVBQVUsR0FFNUM7O0FBT0Q7SUFXRSw2QkFBbUIsU0FBMkIsRUFBUyxTQUFtQztRQUExRixpQkFRQztRQVJrQixjQUFTLEdBQVQsU0FBUyxDQUFrQjtRQUFTLGNBQVMsR0FBVCxTQUFTLENBQTBCO1FBRjFGLFdBQU0sR0FBb0IsRUFBRSxDQUFDO1FBRzNCLElBQUksQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzlDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7UUFDN0MsU0FBUyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFRO1lBQ3ZDLElBQUksS0FBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksRUFBRTtnQkFDbEUsS0FBSSxDQUFDLGFBQWEs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Q3JCLFVBQUMsS0FBSyxJQUFLLE9BQUEsbUJBQW1CLENBQUMsY0FBYyxFQUFFLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLEVBQUMsQ0FBQyxFQUE3RSxDQUE2RSxDQUFDLENBQUM7U0FDL0Y7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sY0FBYyxDQUFDO0FBQ3hCLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUFDLEdBQTRCLEVBQUUsS0FBa0I7SUFDM0UsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBMkI7UUFDdkQsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1YsS0FBSyxHQUFHLEVBQUUsQ0FBQztZQUNYLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3ZDO1FBQ0QsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNwQixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCBDb21waWxlUHJvdmlkZXJNZXRhZGF0YSwgQ29tcGlsZVF1ZXJ5TWV0YWRhdGEsIENvbXBpbGVUb2tlbk1ldGFkYXRhLCBDb21waWxlVHlwZU1ldGFkYXRhLCB0b2tlbk5hbWUsIHRva2VuUmVmZXJlbmNlfSBmcm9tICcuL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7SWRlbnRpZmllcnMsIGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2V9IGZyb20gJy4vaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0F0dHJBc3QsIERpcmVjdGl2ZUFzdCwgUHJvdmlkZXJBc3QsIFByb3ZpZGVyQXN0VHlwZSwgUXVlcnlNYXRjaCwgUmVmZXJlbmNlQXN0fSBmcm9tICcuL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9hc3QnO1xuXG5leHBvcnQgY2xhc3MgUHJvdmlkZXJFcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIHNwYW46IFBhcnNlU291cmNlU3BhbikgeyBzdXBlcihzcGFuLCBtZXNzYWdlKTsgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFF1ZXJ5V2l0aElkIHtcbiAgbWV0YTogQ29tcGlsZVF1ZXJ5TWV0YWRhdGE7XG4gIHF1ZXJ5SWQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFByb3ZpZGVyVmlld0NvbnRleHQge1xuICAvKipcbiAgICogQGludGVybmFsXG4gICAqL1xuICB2aWV3UXVlcmllczogTWFwPGFueSwgUXVlcnlXaXRoSWRbXT47XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHZpZXdQcm92aWRlcnM6IE1hcDxhbnksIGJvb2xlYW4+O1xuICBlcnJvcnM6IFByb3ZpZGVyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsIHB1YmxpYyBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSkge1xuICAgIHRoaXMudmlld1F1ZXJpZXMgPSBfZ2V0Vmlld1F1ZXJpZXMoY29tcG9uZW50KTtcbiAgICB0aGlzLnZpZXdQcm92aWRlcnMgPSBuZXcgTWFwPGFueSwgYm9vbGVhbj4oKTtcbiAgICBjb21wb25lbnQudmlld1Byb3ZpZGVycy5mb3JFYWNoKChwcm92aWRlcikgPT4ge1xuICAgICAgaWYgKHRoaXMudmlld1Byb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UocHJvdmlkZXIudG9rZW4pKSA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMudmlld1Byb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UocHJvdmlkZXIudG9rZW4pLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvdmlkZXJFbGVtZW50Q29udGV4dCB7XG4gIHByaXZhdGUgX2NvbnRlbnRRdWVyaWVzOiBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPjtcblxuICBwcml2YXRlIF90cmFuc2Zvcm1lZFByb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBQcm92aWRlckFzdD4oKTtcbiAgcHJpdmF0ZSBfc2VlblByb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBib29sZWFuPigpO1xuICBwcml2YXRlIF9hbGxQcm92aWRlcnM6IE1hcDxhbnksIFByb3ZpZGVyQXN0PjtcbiAgcHJpdmF0ZSBfYXR0cnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcml2YXRlIF9xdWVyaWVkVG9rZW5zID0gbmV3IE1hcDxhbnksIFF1ZXJ5TWF0Y2hbXT4oKTtcblxuICBwdWJsaWMgcmVhZG9ubHkgdHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdmlld0NvbnRleHQ6IFByb3ZpZGVyVmlld0NvbnRleHQsIHByaXZhdGUgX3BhcmVudDogUHJvdmlkZXJFbGVtZW50Q29udGV4dCxcbiAgICAgIHByaXZhdGUgX2lzVmlld1Jvb3Q6IGJvb2xlYW4sIHByaXZhdGUgX2RpcmVjdGl2ZUFzdHM6IERpcmVjdGl2ZUFzdFtdLCBhdHRyczogQXR0ckFzdFtdLFxuICAgICAgcmVmczogUmVmZXJlbmNlQXN0W10sIGlzVGVtcGxhdGU6IGJvb2xlYW4sIGNvbnRlbnRRdWVyeVN0YXJ0SWQ6IG51bWJlcixcbiAgICAgIHByaXZhdGUgX3NvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIHRoaXMuX2F0dHJzID0ge307XG4gICAgYXR0cnMuZm9yRWFjaCgoYXR0ckFzdCkgPT4gdGhpcy5fYXR0cnNbYXR0ckFzdC5uYW1lXSA9IGF0dHJBc3QudmFsdWUpO1xuICAgIGNvbnN0IGRpcmVjdGl2ZXNNZXRhID0gX2RpcmVjdGl2ZUFzdHMubWFwKGRpcmVjdGl2ZUFzdCA9PiBkaXJlY3RpdmVBc3QuZGlyZWN0aXZlKTtcbiAgICB0aGlzLl9hbGxQcm92aWRlcnMgPVxuICAgICAgICBfcmVzb2x2ZVByb3ZpZGVyc0Zyb21EaXJlY3RpdmVzKGRpcmVjdGl2ZXNNZXRhLCBfc291cmNlU3Bhbiwgdmlld0NvbnRleHQuZXJyb3JzKTtcbiAgICB0aGlzLl9jb250ZW50UXVlcmllcyA9IF9nZXRDb250ZW50UXVlcmllcyhjb250ZW50UXVlcnlTdGFydElkLCBkaXJlY3RpdmVzTWV0YSk7XG4gICAgQXJyYXkuZnJvbSh0aGlzLl9hbGxQcm92aWRlcnMudmFsdWVzKCkpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICB0aGlzLl9hZGRRdWVyeVJlYWRzVG8ocHJvdmlkZXIudG9rZW4sIHByb3ZpZGVyLnRva2VuLCB0aGlzLl9xdWVyaWVkVG9rZW5zKTtcbiAgICB9KTtcbiAgICBpZiAoaXNUZW1wbGF0ZSkge1xuICAgICAgY29uc3QgdGVtcGxhdGVSZWZJZCA9XG4gICAgICAgICAgY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSh0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3RvciwgSWRlbnRpZmllcnMuVGVtcGxhdGVSZWYpO1xuICAgICAgdGhpcy5fYWRkUXVlcnlSZWFkc1RvKHRlbXBsYXRlUmVmSWQsIHRlbXBsYXRlUmVmSWQsIHRoaXMuX3F1ZXJpZWRUb2tlbnMpO1xuICAgIH1cbiAgICByZWZzLmZvckVhY2goKHJlZkFzdCkgPT4ge1xuICAgICAgbGV0IGRlZmF1bHRRdWVyeVZhbHVlID0gcmVmQXN0LnZhbHVlIHx8XG4gICAgICAgICAgY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSh0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3RvciwgSWRlbnRpZmllcnMuRWxlbWVudFJlZik7XG4gICAgICB0aGlzLl9hZGRRdWVyeVJlYWRzVG8oe3ZhbHVlOiByZWZBc3QubmFtZX0sIGRlZmF1bHRRdWVyeVZhbHVlLCB0aGlzLl9xdWVyaWVkVG9rZW5zKTtcbiAgICB9KTtcbiAgICBpZiAodGhpcy5fcXVlcmllZFRva2Vucy5nZXQoXG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuVmlld0NvbnRhaW5lclJlZikpKSB7XG4gICAgICB0aGlzLnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lciA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIHRoZSBwcm92aWRlcnMgdGhhdCB3ZSBrbm93IGFyZSBlYWdlciBmaXJzdFxuICAgIEFycmF5LmZyb20odGhpcy5fYWxsUHJvdmlkZXJzLnZhbHVlcygpKS5mb3JFYWNoKChwcm92aWRlcikgPT4ge1xuICAgICAgY29uc3QgZWFnZXIgPSBwcm92aWRlci5lYWdlciB8fCB0aGlzLl9xdWVyaWVkVG9rZW5zLmdldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbikpO1xuICAgICAgaWYgKGVhZ2VyKSB7XG4gICAgICAgIHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihwcm92aWRlci5wcm92aWRlclR5cGUsIHByb3ZpZGVyLnRva2VuLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFmdGVyRWxlbWVudCgpIHtcbiAgICAvLyBjb2xsZWN0IGxhenkgcHJvdmlkZXJzXG4gICAgQXJyYXkuZnJvbSh0aGlzLl9hbGxQcm92aWRlcnMudmFsdWVzKCkpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICB0aGlzLl9nZXRPckNyZWF0ZUxvY2FsUHJvdmlkZXIocHJvdmlkZXIucHJvdmlkZXJUeXBlLCBwcm92aWRlci50b2tlbiwgZmFsc2UpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHRyYW5zZm9ybVByb3ZpZGVycygpOiBQcm92aWRlckFzdFtdIHtcbiAgICAvLyBOb3RlOiBNYXBzIGtlZXAgdGhlaXIgaW5zZXJ0aW9uIG9yZGVyLlxuICAgIGNvbnN0IGxhenlQcm92aWRlcnM6IFByb3ZpZGVyQXN0W10gPSBbXTtcbiAgICBjb25zdCBlYWdlclByb3ZpZGVyczogUHJvdmlkZXJBc3RbXSA9IFtdO1xuICAgIHRoaXMuX3RyYW5zZm9ybWVkUHJvdmlkZXJzLmZvckVhY2gocHJvdmlkZXIgPT4ge1xuICAgICAgaWYgKHByb3ZpZGVyLmVhZ2VyKSB7XG4gICAgICAgIGVhZ2VyUHJvdmlkZXJzLnB1c2gocHJvdmlkZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGF6eVByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbGF6eVByb3ZpZGVycy5jb25jYXQoZWFnZXJQcm92aWRlcnMpO1xuICB9XG5cbiAgZ2V0IHRyYW5zZm9ybWVkRGlyZWN0aXZlQXN0cygpOiBEaXJlY3RpdmVBc3RbXSB7XG4gICAgY29uc3Qgc29ydGVkUHJvdmlkZXJUeXBlcyA9IHRoaXMudHJhbnNmb3JtUHJvdmlkZXJzLm1hcChwcm92aWRlciA9PiBwcm92aWRlci50b2tlbi5pZGVudGlmaWVyKTtcbiAgICBjb25zdCBzb3J0ZWREaXJlY3RpdmVzID0gdGhpcy5fZGlyZWN0aXZlQXN0cy5zbGljZSgpO1xuICAgIHNvcnRlZERpcmVjdGl2ZXMuc29ydChcbiAgICAgICAgKGRpcjEsIGRpcjIpID0+IHNvcnRlZFByb3ZpZGVyVHlwZXMuaW5kZXhPZihkaXIxLmRpcmVjdGl2ZS50eXBlKSAtXG4gICAgICAgICAgICBzb3J0ZWRQcm92aWRlclR5cGVzLmluZGV4T2YoZGlyMi5kaXJlY3RpdmUudHlwZSkpO1xuICAgIHJldHVybiBzb3J0ZWREaXJlY3RpdmVzO1xuICB9XG5cbiAgZ2V0IHF1ZXJ5TWF0Y2hlcygpOiBRdWVyeU1hdGNoW10ge1xuICAgIGNvbnN0IGFsbE1hdGNoZXM6IFF1ZXJ5TWF0Y2hbXSA9IFtdO1xuICAgIHRoaXMuX3F1ZXJpZWRUb2tlbnMuZm9yRWFjaCgobWF0Y2hlczogUXVlcnlNYXRjaFtdKSA9PiB7IGFsbE1hdGNoZXMucHVzaCguLi5tYXRjaGVzKTsgfSk7XG4gICAgcmV0dXJuIGFsbE1hdGNoZXM7XG4gIH1cblxuICBwcml2YXRlIF9hZGRRdWVyeVJlYWRzVG8oXG4gICAgICB0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEsIGRlZmF1bHRWYWx1ZTogQ29tcGlsZVRva2VuTWV0YWRhdGEsXG4gICAgICBxdWVyeVJlYWRUb2tlbnM6IE1hcDxhbnksIFF1ZXJ5TWF0Y2hbXT4pIHtcbiAgICB0aGlzLl9nZXRRdWVyaWVzRm9yKHRva2VuKS5mb3JFYWNoKChxdWVyeSkgPT4ge1xuICAgICAgY29uc3QgcXVlcnlWYWx1ZSA9IHF1ZXJ5Lm1ldGEucmVhZCB8fCBkZWZhdWx0VmFsdWU7XG4gICAgICBjb25zdCB0b2tlblJlZiA9IHRva2VuUmVmZXJlbmNlKHF1ZXJ5VmFsdWUpO1xuICAgICAgbGV0IHF1ZXJ5TWF0Y2hlcyA9IHF1ZXJ5UmVhZFRva2Vucy5nZXQodG9rZW5SZWYpO1xuICAgICAgaWYgKCFxdWVyeU1hdGNoZXMpIHtcbiAgICAgICAgcXVlcnlNYXRjaGVzID0gW107XG4gICAgICAgIHF1ZXJ5UmVhZFRva2Vucy5zZXQodG9rZW5SZWYsIHF1ZXJ5TWF0Y2hlcyk7XG4gICAgICB9XG4gICAgICBxdWVyeU1hdGNoZXMucHVzaCh7cXVlcnlJZDogcXVlcnkucXVlcnlJZCwgdmFsdWU6IHF1ZXJ5VmFsdWV9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFF1ZXJpZXNGb3IodG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhKTogUXVlcnlXaXRoSWRbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBRdWVyeVdpdGhJZFtdID0gW107XG4gICAgbGV0IGN1cnJlbnRFbDogUHJvdmlkZXJFbGVtZW50Q29udGV4dCA9IHRoaXM7XG4gICAgbGV0IGRpc3RhbmNlID0gMDtcbiAgICBsZXQgcXVlcmllczogUXVlcnlXaXRoSWRbXXx1bmRlZmluZWQ7XG4gICAgd2hpbGUgKGN1cnJlbnRFbCAhPT0gbnVsbCkge1xuICAgICAgcXVlcmllcyA9IGN1cnJlbnRFbC5fY29udGVudFF1ZXJpZXMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgICBpZiAocXVlcmllcykge1xuICAgICAgICByZXN1bHQucHVzaCguLi5xdWVyaWVzLmZpbHRlcigocXVlcnkpID0+IHF1ZXJ5Lm1ldGEuZGVzY2VuZGFudHMgfHwgZGlzdGFuY2UgPD0gMSkpO1xuICAgICAgfVxuICAgICAgaWYgKGN1cnJlbnRFbC5fZGlyZWN0aXZlQXN0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGRpc3RhbmNlKys7XG4gICAgICB9XG4gICAgICBjdXJyZW50RWwgPSBjdXJyZW50RWwuX3BhcmVudDtcbiAgICB9XG4gICAgcXVlcmllcyA9IHRoaXMudmlld0NvbnRleHQudmlld1F1ZXJpZXMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgaWYgKHF1ZXJpZXMpIHtcbiAgICAgIHJlc3VsdC5wdXNoKC4uLnF1ZXJpZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cblxuICBwcml2YXRlIF9nZXRPckNyZWF0ZUxvY2FsUHJvdmlkZXIoXG4gICAgICByZXF1ZXN0aW5nUHJvdmlkZXJUeXBlOiBQcm92aWRlckFzdFR5cGUsIHRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSxcbiAgICAgIGVhZ2VyOiBib29sZWFuKTogUHJvdmlkZXJBc3R8bnVsbCB7XG4gICAgY29uc3QgcmVzb2x2ZWRQcm92aWRlciA9IHRoaXMuX2FsbFByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAoIXJlc29sdmVkUHJvdmlkZXIgfHwgKChyZXF1ZXN0aW5nUHJvdmlkZXJUeXBlID09PSBQcm92aWRlckFzdFR5cGUuRGlyZWN0aXZlIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlByaXZhdGVTZXJ2aWNlKSB8fFxuICAgICAgICAoKHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5Qcml2YXRlU2VydmljZSB8fFxuICAgICAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5QdWJsaWNTZXJ2aWNlKSAmJlxuICAgICAgICAgcmVzb2x2ZWRQcm92aWRlci5wcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5CdWlsdGluKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGxldCB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0ID0gdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgaWYgKHRyYW5zZm9ybWVkUHJvdmlkZXJBc3QpIHtcbiAgICAgIHJldHVybiB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0O1xuICAgIH1cbiAgICBpZiAodGhpcy5fc2VlblByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKSAhPSBudWxsKSB7XG4gICAgICB0aGlzLnZpZXdDb250ZXh0LmVycm9ycy5wdXNoKG5ldyBQcm92aWRlckVycm9yKFxuICAgICAgICAgIGBDYW5ub3QgaW5zdGFudGlhdGUgY3ljbGljIGRlcGVuZGVuY3khICR7dG9rZW5OYW1lKHRva2VuKX1gLCB0aGlzLl9zb3VyY2VTcGFuKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5fc2VlblByb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCB0cnVlKTtcbiAgICBjb25zdCB0cmFuc2Zvcm1lZFByb3ZpZGVycyA9IHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJzLm1hcCgocHJvdmlkZXIpID0+IHtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZFVzZVZhbHVlID0gcHJvdmlkZXIudXNlVmFsdWU7XG4gICAgICBsZXQgdHJhbnNmb3JtZWRVc2VFeGlzdGluZyA9IHByb3ZpZGVyLnVzZUV4aXN0aW5nICE7XG4gICAgICBsZXQgdHJhbnNmb3JtZWREZXBzOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGFbXSA9IHVuZGVmaW5lZCAhO1xuICAgICAgaWYgKHByb3ZpZGVyLnVzZUV4aXN0aW5nICE9IG51bGwpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdEaURlcCA9IHRoaXMuX2dldERlcGVuZGVuY3koXG4gICAgICAgICAgICByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVyVHlwZSwge3Rva2VuOiBwcm92aWRlci51c2VFeGlzdGluZ30sIGVhZ2VyKSAhO1xuICAgICAgICBpZiAoZXhpc3RpbmdEaURlcC50b2tlbiAhPSBudWxsKSB7XG4gICAgICAgICAgdHJhbnNmb3JtZWRVc2VFeGlzdGluZyA9IGV4aXN0aW5nRGlEZXAudG9rZW47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJhbnNmb3JtZWRVc2VFeGlzdGluZyA9IG51bGwgITtcbiAgICAgICAgICB0cmFuc2Zvcm1lZFVzZVZhbHVlID0gZXhpc3RpbmdEaURlcC52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwcm92aWRlci51c2VGYWN0b3J5KSB7XG4gICAgICAgIGNvbnN0IGRlcHMgPSBwcm92aWRlci5kZXBzIHx8IHByb3ZpZGVyLnVzZUZhY3RvcnkuZGlEZXBzO1xuICAgICAgICB0cmFuc2Zvcm1lZERlcHMgPVxuICAgICAgICAgICAgZGVwcy5tYXAoKGRlcCkgPT4gdGhpcy5fZ2V0RGVwZW5kZW5jeShyZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVyVHlwZSwgZGVwLCBlYWdlcikgISk7XG4gICAgICB9IGVsc2UgaWYgKHByb3ZpZGVyLnVzZUNsYXNzKSB7XG4gICAgICAgIGNvbnN0IGRlcHMgPSBwcm92aWRlci5kZXBzIHx8IHByb3ZpZGVyLnVzZUNsYXNzLmRpRGVwcztcbiAgICAgICAgdHJhbnNmb3JtZWREZXBzID1cbiAgICAgICAgICAgIGRlcHMubWFwKChkZXApID0+IHRoaXMuX2dldERlcGVuZGVuY3kocmVzb2x2ZWRQcm92aWRlci5wcm92aWRlclR5cGUsIGRlcCwgZWFnZXIpICEpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF90cmFuc2Zvcm1Qcm92aWRlcihwcm92aWRlciwge1xuICAgICAgICB1c2VFeGlzdGluZzogdHJhbnNmb3JtZWRVc2VFeGlzdGluZyxcbiAgICAgICAgdXNlVmFsdWU6IHRyYW5zZm9ybWVkVXNlVmFsdWUsXG4gICAgICAgIGRlcHM6IHRyYW5zZm9ybWVkRGVwc1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdHJhbnNmb3JtZWRQcm92aWRlckFzdCA9XG4gICAgICAgIF90cmFuc2Zvcm1Qcm92aWRlckFzdChyZXNvbHZlZFByb3ZpZGVyLCB7ZWFnZXI6IGVhZ2VyLCBwcm92aWRlcnM6IHRyYW5zZm9ybWVkUHJvdmlkZXJzfSk7XG4gICAgdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuc2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSwgdHJhbnNmb3JtZWRQcm92aWRlckFzdCk7XG4gICAgcmV0dXJuIHRyYW5zZm9ybWVkUHJvdmlkZXJBc3Q7XG4gIH1cblxuICBwcml2YXRlIF9nZXRMb2NhbERlcGVuZGVuY3koXG4gICAgICByZXF1ZXN0aW5nUHJvdmlkZXJUeXBlOiBQcm92aWRlckFzdFR5cGUsIGRlcDogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhLFxuICAgICAgZWFnZXI6IGJvb2xlYW4gPSBmYWxzZSk6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YXxudWxsIHtcbiAgICBpZiAoZGVwLmlzQXR0cmlidXRlKSB7XG4gICAgICBjb25zdCBhdHRyVmFsdWUgPSB0aGlzLl9hdHRyc1tkZXAudG9rZW4gIS52YWx1ZV07XG4gICAgICByZXR1cm4ge2lzVmFsdWU6IHRydWUsIHZhbHVlOiBhdHRyVmFsdWUgPT0gbnVsbCA/IG51bGwgOiBhdHRyVmFsdWV9O1xuICAgIH1cblxuICAgIGlmIChkZXAudG9rZW4gIT0gbnVsbCkge1xuICAgICAgLy8gYWNjZXNzIGJ1aWx0aW50c1xuICAgICAgaWYgKChyZXF1ZXN0aW5nUHJvdmlkZXJUeXBlID09PSBQcm92aWRlckFzdFR5cGUuRGlyZWN0aXZlIHx8XG4gICAgICAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5Db21wb25lbnQpKSB7XG4gICAgICAgIGlmICh0b2tlblJlZmVyZW5jZShkZXAudG9rZW4pID09PVxuICAgICAgICAgICAgICAgIHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5SZW5kZXJlcikgfHxcbiAgICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkVsZW1lbnRSZWYpIHx8XG4gICAgICAgICAgICB0b2tlblJlZmVyZW5jZShkZXAudG9rZW4pID09PVxuICAgICAgICAgICAgICAgIHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShcbiAgICAgICAgICAgICAgICAgICAgSWRlbnRpZmllcnMuQ2hhbmdlRGV0ZWN0b3JSZWYpIHx8XG4gICAgICAgICAgICB0b2tlblJlZmVyZW5jZShkZXAudG9rZW4pID09PVxuICAgICAgICAgICAgICAgIHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5UZW1wbGF0ZVJlZikpIHtcbiAgICAgICAgICByZXR1cm4gZGVwO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0b2tlblJlZmVyZW5jZShkZXAudG9rZW4pID09PVxuICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlZpZXdDb250YWluZXJSZWYpKSB7XG4gICAgICAgICAgKHRoaXMgYXN7dHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyOiBib29sZWFufSkudHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gYWNjZXNzIHRoZSBpbmplY3RvclxuICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkluamVjdG9yKSkge1xuICAgICAgICByZXR1cm4gZGVwO1xuICAgICAgfVxuICAgICAgLy8gYWNjZXNzIHByb3ZpZGVyc1xuICAgICAgaWYgKHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihyZXF1ZXN0aW5nUHJvdmlkZXJUeXBlLCBkZXAudG9rZW4sIGVhZ2VyKSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBkZXA7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0RGVwZW5kZW5jeShcbiAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGU6IFByb3ZpZGVyQXN0VHlwZSwgZGVwOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGEsXG4gICAgICBlYWdlcjogYm9vbGVhbiA9IGZhbHNlKTogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhfG51bGwge1xuICAgIGxldCBjdXJyRWxlbWVudDogUHJvdmlkZXJFbGVtZW50Q29udGV4dCA9IHRoaXM7XG4gICAgbGV0IGN1cnJFYWdlcjogYm9vbGVhbiA9IGVhZ2VyO1xuICAgIGxldCByZXN1bHQ6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YXxudWxsID0gbnVsbDtcbiAgICBpZiAoIWRlcC5pc1NraXBTZWxmKSB7XG4gICAgICByZXN1bHQgPSB0aGlzLl9nZXRMb2NhbERlcGVuZGVuY3kocmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSwgZGVwLCBlYWdlcik7XG4gICAgfVxuICAgIGlmIChkZXAuaXNTZWxmKSB7XG4gICAgICBpZiAoIXJlc3VsdCAmJiBkZXAuaXNPcHRpb25hbCkge1xuICAgICAgICByZXN1bHQgPSB7aXNWYWx1ZTogdHJ1ZSwgdmFsdWU6IG51bGx9O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjaGVjayBwYXJlbnQgZWxlbWVudHNcbiAgICAgIHdoaWxlICghcmVzdWx0ICYmIGN1cnJFbGVtZW50Ll9wYXJlbnQpIHtcbiAgICAgICAgY29uc3QgcHJldkVsZW1lbnQgPSBjdXJyRWxlbWVudDtcbiAgICAgICAgY3VyckVsZW1lbnQgPSBjdXJyRWxlbWVudC5fcGFyZW50O1xuICAgICAgICBpZiAocHJldkVsZW1lbnQuX2lzVmlld1Jvb3QpIHtcbiAgICAgICAgICBjdXJyRWFnZXIgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPSBjdXJyRWxlbWVudC5fZ2V0TG9jYWxEZXBlbmRlbmN5KFByb3ZpZGVyQXN0VHlwZS5QdWJsaWNTZXJ2aWNlLCBkZXAsIGN1cnJFYWdlcik7XG4gICAgICB9XG4gICAgICAvLyBjaGVjayBASG9zdCByZXN0cmljdGlvblxuICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgaWYgKCFkZXAuaXNIb3N0IHx8IHRoaXMudmlld0NvbnRleHQuY29tcG9uZW50LmlzSG9zdCB8fFxuICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5jb21wb25lbnQudHlwZS5yZWZlcmVuY2UgPT09IHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbiAhKSB8fFxuICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC52aWV3UHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZShkZXAudG9rZW4gISkpICE9IG51bGwpIHtcbiAgICAgICAgICByZXN1bHQgPSBkZXA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gZGVwLmlzT3B0aW9uYWwgPyB7aXNWYWx1ZTogdHJ1ZSwgdmFsdWU6IG51bGx9IDogbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgdGhpcy52aWV3Q29udGV4dC5lcnJvcnMucHVzaChcbiAgICAgICAgICBuZXcgUHJvdmlkZXJFcnJvcihgTm8gcHJvdmlkZXIgZm9yICR7dG9rZW5OYW1lKGRlcC50b2tlbiEpfWAsIHRoaXMuX3NvdXJjZVNwYW4pKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBOZ01vZHVsZVByb3ZpZGVyQW5hbHl6ZXIge1xuICBwcml2YXRlIF90cmFuc2Zvcm1lZFByb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBQcm92aWRlckFzdD4oKTtcbiAgcHJpdmF0ZSBfc2VlblByb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBib29sZWFuPigpO1xuICBwcml2YXRlIF9hbGxQcm92aWRlcnM6IE1hcDxhbnksIFByb3ZpZGVyQXN0PjtcbiAgcHJpdmF0ZSBfZXJyb3JzOiBQcm92aWRlckVycm9yW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLCBuZ01vZHVsZTogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsXG4gICAgICBleHRyYVByb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgdGhpcy5fYWxsUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIFByb3ZpZGVyQXN0PigpO1xuICAgIG5nTW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUubW9kdWxlcy5mb3JFYWNoKChuZ01vZHVsZVR5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGEpID0+IHtcbiAgICAgIGNvbnN0IG5nTW9kdWxlUHJvdmlkZXIgPSB7dG9rZW46IHtpZGVudGlmaWVyOiBuZ01vZHVsZVR5cGV9LCB1c2VDbGFzczogbmdNb2R1bGVUeXBlfTtcbiAgICAgIF9yZXNvbHZlUHJvdmlkZXJzKFxuICAgICAgICAgIFtuZ01vZHVsZVByb3ZpZGVyXSwgUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UsIHRydWUsIHNvdXJjZVNwYW4sIHRoaXMuX2Vycm9ycyxcbiAgICAgICAgICB0aGlzLl9hbGxQcm92aWRlcnMsIC8qIGlzTW9kdWxlICovIHRydWUpO1xuICAgIH0pO1xuICAgIF9yZXNvbHZlUHJvdmlkZXJzKFxuICAgICAgICBuZ01vZHVsZS50cmFuc2l0aXZlTW9kdWxlLnByb3ZpZGVycy5tYXAoZW50cnkgPT4gZW50cnkucHJvdmlkZXIpLmNvbmNhdChleHRyYVByb3ZpZGVycyksXG4gICAgICAgIFByb3ZpZGVyQXN0VHlwZS5QdWJsaWNTZXJ2aWNlLCBmYWxzZSwgc291cmNlU3BhbiwgdGhpcy5fZXJyb3JzLCB0aGlzLl9hbGxQcm92aWRlcnMsXG4gICAgICAgIC8qIGlzTW9kdWxlICovIGZhbHNlKTtcbiAgfVxuXG4gIHBhcnNlKCk6IFByb3ZpZGVyQXN0W10ge1xuICAgIEFycmF5LmZyb20odGhpcy5fYWxsUHJvdmlkZXJzLnZhbHVlcygpKS5mb3JFYWNoKChwcm92aWRlcikgPT4ge1xuICAgICAgdGhpcy5fZ2V0T3JDcmVhdGVMb2NhbFByb3ZpZGVyKHByb3ZpZGVyLnRva2VuLCBwcm92aWRlci5lYWdlcik7XG4gICAgfSk7XG4gICAgaWYgKHRoaXMuX2Vycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBlcnJvclN0cmluZyA9IHRoaXMuX2Vycm9ycy5qb2luKCdcXG4nKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvdmlkZXIgcGFyc2UgZXJyb3JzOlxcbiR7ZXJyb3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIC8vIE5vdGU6IE1hcHMga2VlcCB0aGVpciBpbnNlcnRpb24gb3JkZXIuXG4gICAgY29uc3QgbGF6eVByb3ZpZGVyczogUHJvdmlkZXJBc3RbXSA9IFtdO1xuICAgIGNvbnN0IGVhZ2VyUHJvdmlkZXJzOiBQcm92aWRlckFzdFtdID0gW107XG4gICAgdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuZm9yRWFjaChwcm92aWRlciA9PiB7XG4gICAgICBpZiAocHJvdmlkZXIuZWFnZXIpIHtcbiAgICAgICAgZWFnZXJQcm92aWRlcnMucHVzaChwcm92aWRlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsYXp5UHJvdmlkZXJzLnB1c2gocHJvdmlkZXIpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBsYXp5UHJvdmlkZXJzLmNvbmNhdChlYWdlclByb3ZpZGVycyk7XG4gIH1cblxuICBwcml2YXRlIF9nZXRPckNyZWF0ZUxvY2FsUHJvdmlkZXIodG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhLCBlYWdlcjogYm9vbGVhbik6IFByb3ZpZGVyQXN0fG51bGwge1xuICAgIGNvbnN0IHJlc29sdmVkUHJvdmlkZXIgPSB0aGlzLl9hbGxQcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSk7XG4gICAgaWYgKCFyZXNvbHZlZFByb3ZpZGVyKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbGV0IHRyYW5zZm9ybWVkUHJvdmlkZXJBc3QgPSB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAodHJhbnNmb3JtZWRQcm92aWRlckFzdCkge1xuICAgICAgcmV0dXJuIHRyYW5zZm9ybWVkUHJvdmlkZXJBc3Q7XG4gICAgfVxuICAgIGlmICh0aGlzLl9zZWVuUHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpICE9IG51bGwpIHtcbiAgICAgIHRoaXMuX2Vycm9ycy5wdXNoKG5ldyBQcm92aWRlckVycm9yKFxuICAgICAgICAgIGBDYW5ub3QgaW5zdGFudGlhdGUgY3ljbGljIGRlcGVuZGVuY3khICR7dG9rZW5OYW1lKHRva2VuKX1gLFxuICAgICAgICAgIHJlc29sdmVkUHJvdmlkZXIuc291cmNlU3BhbikpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHRoaXMuX3NlZW5Qcm92aWRlcnMuc2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSwgdHJ1ZSk7XG4gICAgY29uc3QgdHJhbnNmb3JtZWRQcm92aWRlcnMgPSByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVycy5tYXAoKHByb3ZpZGVyKSA9PiB7XG4gICAgICBsZXQgdHJhbnNmb3JtZWRVc2VWYWx1ZSA9IHByb3ZpZGVyLnVzZVZhbHVlO1xuICAgICAgbGV0IHRyYW5zZm9ybWVkVXNlRXhpc3RpbmcgPSBwcm92aWRlci51c2VFeGlzdGluZyAhO1xuICAgICAgbGV0IHRyYW5zZm9ybWVkRGVwczogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhW10gPSB1bmRlZmluZWQgITtcbiAgICAgIGlmIChwcm92aWRlci51c2VFeGlzdGluZyAhPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nRGlEZXAgPVxuICAgICAgICAgICAgdGhpcy5fZ2V0RGVwZW5kZW5jeSh7dG9rZW46IHByb3ZpZGVyLnVzZUV4aXN0aW5nfSwgZWFnZXIsIHJlc29sdmVkUHJvdmlkZXIuc291cmNlU3Bhbik7XG4gICAgICAgIGlmIChleGlzdGluZ0RpRGVwLnRva2VuICE9IG51bGwpIHtcbiAgICAgICAgICB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gZXhpc3RpbmdEaURlcC50b2tlbjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gbnVsbCAhO1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlVmFsdWUgPSBleGlzdGluZ0RpRGVwLnZhbHVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHByb3ZpZGVyLnVzZUZhY3RvcnkpIHtcbiAgICAgICAgY29uc3QgZGVwcyA9IHByb3ZpZGVyLmRlcHMgfHwgcHJvdmlkZXIudXNlRmFjdG9yeS5kaURlcHM7XG4gICAgICAgIHRyYW5zZm9ybWVkRGVwcyA9XG4gICAgICAgICAgICBkZXBzLm1hcCgoZGVwKSA9PiB0aGlzLl9nZXREZXBlbmRlbmN5KGRlcCwgZWFnZXIsIHJlc29sdmVkUHJvdmlkZXIuc291cmNlU3BhbikpO1xuICAgICAgfSBlbHNlIGlmIChwcm92aWRlci51c2VDbGFzcykge1xuICAgICAgICBjb25zdCBkZXBzID0gcHJvdmlkZXIuZGVwcyB8fCBwcm92aWRlci51c2VDbGFzcy5kaURlcHM7XG4gICAgICAgIHRyYW5zZm9ybWVkRGVwcyA9XG4gICAgICAgICAgICBkZXBzLm1hcCgoZGVwKSA9PiB0aGlzLl9nZXREZXBlbmRlbmN5KGRlcCwgZWFnZXIsIHJlc29sdmVkUHJvdmlkZXIuc291cmNlU3BhbikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF90cmFuc2Zvcm1Qcm92aWRlcihwcm92aWRlciwge1xuICAgICAgICB1c2VFeGlzdGluZzogdHJhbnNmb3JtZWRVc2VFeGlzdGluZyxcbiAgICAgICAgdXNlVmFsdWU6IHRyYW5zZm9ybWVkVXNlVmFsdWUsXG4gICAgICAgIGRlcHM6IHRyYW5zZm9ybWVkRGVwc1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdHJhbnNmb3JtZWRQcm92aWRlckFzdCA9XG4gICAgICAgIF90cmFuc2Zvcm1Qcm92aWRlckFzdChyZXNvbHZlZFByb3ZpZGVyLCB7ZWFnZXI6IGVhZ2VyLCBwcm92aWRlcnM6IHRyYW5zZm9ybWVkUHJvdmlkZXJzfSk7XG4gICAgdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuc2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSwgdHJhbnNmb3JtZWRQcm92aWRlckFzdCk7XG4gICAgcmV0dXJuIHRyYW5zZm9ybWVkUHJvdmlkZXJBc3Q7XG4gIH1cblxuICBwcml2YXRlIF9nZXREZXBlbmRlbmN5KFxuICAgICAgZGVwOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGEsIGVhZ2VyOiBib29sZWFuID0gZmFsc2UsXG4gICAgICByZXF1ZXN0b3JTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGEge1xuICAgIGxldCBmb3VuZExvY2FsID0gZmFsc2U7XG4gICAgaWYgKCFkZXAuaXNTa2lwU2VsZiAmJiBkZXAudG9rZW4gIT0gbnVsbCkge1xuICAgICAgLy8gYWNjZXNzIHRoZSBpbmplY3RvclxuICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgIHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5JbmplY3RvcikgfHxcbiAgICAgICAgICB0b2tlblJlZmVyZW5jZShkZXAudG9rZW4pID09PVxuICAgICAgICAgICAgICB0aGlzLnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuQ29tcG9uZW50RmFjdG9yeVJlc29sdmVyKSkge1xuICAgICAgICBmb3VuZExvY2FsID0gdHJ1ZTtcbiAgICAgICAgLy8gYWNjZXNzIHByb3ZpZGVyc1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9nZXRPckNyZWF0ZUxvY2FsUHJvdmlkZXIoZGVwLnRva2VuLCBlYWdlcikgIT0gbnVsbCkge1xuICAgICAgICBmb3VuZExvY2FsID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlcDtcbiAgfVxufVxuXG5mdW5jdGlvbiBfdHJhbnNmb3JtUHJvdmlkZXIoXG4gICAgcHJvdmlkZXI6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhLFxuICAgIHt1c2VFeGlzdGluZywgdXNlVmFsdWUsIGRlcHN9OlxuICAgICAgICB7dXNlRXhpc3Rpbmc6IENvbXBpbGVUb2tlbk1ldGFkYXRhLCB1c2VWYWx1ZTogYW55LCBkZXBzOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGFbXX0pIHtcbiAgcmV0dXJuIHtcbiAgICB0b2tlbjogcHJvdmlkZXIudG9rZW4sXG4gICAgdXNlQ2xhc3M6IHByb3ZpZGVyLnVzZUNsYXNzLFxuICAgIHVzZUV4aXN0aW5nOiB1c2VFeGlzdGluZyxcbiAgICB1c2VGYWN0b3J5OiBwcm92aWRlci51c2VGYWN0b3J5LFxuICAgIHVzZVZhbHVlOiB1c2VWYWx1ZSxcbiAgICBkZXBzOiBkZXBzLFxuICAgIG11bHRpOiBwcm92aWRlci5tdWx0aVxuICB9O1xufVxuXG5mdW5jdGlvbiBfdHJhbnNmb3JtUHJvdmlkZXJBc3QoXG4gICAgcHJvdmlkZXI6IFByb3ZpZGVyQXN0LFxuICAgIHtlYWdlciwgcHJvdmlkZXJzfToge2VhZ2VyOiBib29sZWFuLCBwcm92aWRlcnM6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhW119KTogUHJvdmlkZXJBc3Qge1xuICByZXR1cm4gbmV3IFByb3ZpZGVyQXN0KFxuICAgICAgcHJvdmlkZXIudG9rZW4sIHByb3ZpZGVyLm11bHRpUHJvdmlkZXIsIHByb3ZpZGVyLmVhZ2VyIHx8IGVhZ2VyLCBwcm92aWRlcnMsXG4gICAgICBwcm92aWRlci5wcm92aWRlclR5cGUsIHByb3ZpZGVyLmxpZmVjeWNsZUhvb2tzLCBwcm92aWRlci5zb3VyY2VTcGFuLCBwcm92aWRlci5pc01vZHVsZSk7XG59XG5cbmZ1bmN0aW9uIF9yZXNvbHZlUHJvdmlkZXJzRnJvbURpcmVjdGl2ZXMoXG4gICAgZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIHRhcmdldEVycm9yczogUGFyc2VFcnJvcltdKTogTWFwPGFueSwgUHJvdmlkZXJBc3Q+IHtcbiAgY29uc3QgcHJvdmlkZXJzQnlUb2tlbiA9IG5ldyBNYXA8YW55LCBQcm92aWRlckFzdD4oKTtcbiAgZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJlY3RpdmUpID0+IHtcbiAgICBjb25zdCBkaXJQcm92aWRlcjpcbiAgICAgICAgQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEgPSB7dG9rZW46IHtpZGVudGlmaWVyOiBkaXJlY3RpdmUudHlwZX0sIHVzZUNsYXNzOiBkaXJlY3RpdmUudHlwZX07XG4gICAgX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgICAgIFtkaXJQcm92aWRlcl0sXG4gICAgICAgIGRpcmVjdGl2ZS5pc0NvbXBvbmVudCA/IFByb3ZpZGVyQXN0VHlwZS5Db21wb25lbnQgOiBQcm92aWRlckFzdFR5cGUuRGlyZWN0aXZlLCB0cnVlLFxuICAgICAgICBzb3VyY2VTcGFuLCB0YXJnZXRFcnJvcnMsIHByb3ZpZGVyc0J5VG9rZW4sIC8qIGlzTW9kdWxlICovIGZhbHNlKTtcbiAgfSk7XG5cbiAgLy8gTm90ZTogZGlyZWN0aXZlcyBuZWVkIHRvIGJlIGFibGUgdG8gb3ZlcndyaXRlIHByb3ZpZGVycyBvZiBhIGNvbXBvbmVudCFcbiAgY29uc3QgZGlyZWN0aXZlc1dpdGhDb21wb25lbnRGaXJzdCA9XG4gICAgICBkaXJlY3RpdmVzLmZpbHRlcihkaXIgPT4gZGlyLmlzQ29tcG9uZW50KS5jb25jYXQoZGlyZWN0aXZlcy5maWx0ZXIoZGlyID0+ICFkaXIuaXNDb21wb25lbnQpKTtcbiAgZGlyZWN0aXZlc1dpdGhDb21wb25lbnRGaXJzdC5mb3JFYWNoKChkaXJlY3RpdmUpID0+IHtcbiAgICBfcmVzb2x2ZVByb3ZpZGVycyhcbiAgICAgICAgZGlyZWN0aXZlLnByb3ZpZGVycywgUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UsIGZhbHNlLCBzb3VyY2VTcGFuLCB0YXJnZXRFcnJvcnMsXG4gICAgICAgIHByb3ZpZGVyc0J5VG9rZW4sIC8qIGlzTW9kdWxlICovIGZhbHNlKTtcbiAgICBfcmVzb2x2ZVByb3ZpZGVycyhcbiAgICAgICAgZGlyZWN0aXZlLnZpZXdQcm92aWRlcnMsIFByb3ZpZGVyQXN0VHlwZS5Qcml2YXRlU2VydmljZSwgZmFsc2UsIHNvdXJjZVNwYW4sIHRhcmdldEVycm9ycyxcbiAgICAgICAgcHJvdmlkZXJzQnlUb2tlbiwgLyogaXNNb2R1bGUgKi8gZmFsc2UpO1xuICB9KTtcbiAgcmV0dXJuIHByb3ZpZGVyc0J5VG9rZW47XG59XG5cbmZ1bmN0aW9uIF9yZXNvbHZlUHJvdmlkZXJzKFxuICAgIHByb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSwgcHJvdmlkZXJUeXBlOiBQcm92aWRlckFzdFR5cGUsIGVhZ2VyOiBib29sZWFuLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgdGFyZ2V0RXJyb3JzOiBQYXJzZUVycm9yW10sXG4gICAgdGFyZ2V0UHJvdmlkZXJzQnlUb2tlbjogTWFwPGFueSwgUHJvdmlkZXJBc3Q+LCBpc01vZHVsZTogYm9vbGVhbikge1xuICBwcm92aWRlcnMuZm9yRWFjaCgocHJvdmlkZXIpID0+IHtcbiAgICBsZXQgcmVzb2x2ZWRQcm92aWRlciA9IHRhcmdldFByb3ZpZGVyc0J5VG9rZW4uZ2V0KHRva2VuUmVmZXJlbmNlKHByb3ZpZGVyLnRva2VuKSk7XG4gICAgaWYgKHJlc29sdmVkUHJvdmlkZXIgIT0gbnVsbCAmJiAhIXJlc29sdmVkUHJvdmlkZXIubXVsdGlQcm92aWRlciAhPT0gISFwcm92aWRlci5tdWx0aSkge1xuICAgICAgdGFyZ2V0RXJyb3JzLnB1c2gobmV3IFByb3ZpZGVyRXJyb3IoXG4gICAgICAgICAgYE1peGluZyBtdWx0aSBhbmQgbm9uIG11bHRpIHByb3ZpZGVyIGlzIG5vdCBwb3NzaWJsZSBmb3IgdG9rZW4gJHtcbiAgICAgICAgICAgICAgdG9rZW5OYW1lKHJlc29sdmVkUHJvdmlkZXIudG9rZW4pfWAsXG4gICAgICAgICAgc291cmNlU3BhbikpO1xuICAgIH1cbiAgICBpZiAoIXJlc29sdmVkUHJvdmlkZXIpIHtcbiAgICAgIGNvbnN0IGxpZmVjeWNsZUhvb2tzID0gcHJvdmlkZXIudG9rZW4uaWRlbnRpZmllciAmJlxuICAgICAgICAgICAgICAoPENvbXBpbGVUeXBlTWV0YWRhdGE+cHJvdmlkZXIudG9rZW4uaWRlbnRpZmllcikubGlmZWN5Y2xlSG9va3MgP1xuICAgICAgICAgICg8Q29tcGlsZVR5cGVNZXRhZGF0YT5wcm92aWRlci50b2tlbi5pZGVudGlmaWVyKS5saWZlY3ljbGVIb29rcyA6XG4gICAgICAgICAgW107XG4gICAgICBjb25zdCBpc1VzZVZhbHVlID0gIShwcm92aWRlci51c2VDbGFzcyB8fCBwcm92aWRlci51c2VFeGlzdGluZyB8fCBwcm92aWRlci51c2VGYWN0b3J5KTtcbiAgICAgIHJlc29sdmVkUHJvdmlkZXIgPSBuZXcgUHJvdmlkZXJBc3QoXG4gICAgICAgICAgcHJvdmlkZXIudG9rZW4sICEhcHJvdmlkZXIubXVsdGksIGVhZ2VyIHx8IGlzVXNlVmFsdWUsIFtwcm92aWRlcl0sIHByb3ZpZGVyVHlwZSxcbiAgICAgICAgICBsaWZlY3ljbGVIb29rcywgc291cmNlU3BhbiwgaXNNb2R1bGUpO1xuICAgICAgdGFyZ2V0UHJvdmlkZXJzQnlUb2tlbi5zZXQodG9rZW5SZWZlcmVuY2UocHJvdmlkZXIudG9rZW4pLCByZXNvbHZlZFByb3ZpZGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFwcm92aWRlci5tdWx0aSkge1xuICAgICAgICByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVycy5sZW5ndGggPSAwO1xuICAgICAgfVxuICAgICAgcmVzb2x2ZWRQcm92aWRlci5wcm92aWRlcnMucHVzaChwcm92aWRlcik7XG4gICAgfVxuICB9KTtcbn1cblxuXG5mdW5jdGlvbiBfZ2V0Vmlld1F1ZXJpZXMoY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEpOiBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPiB7XG4gIC8vIE5vdGU6IHF1ZXJpZXMgc3RhcnQgd2l0aCBpZCAxIHNvIHdlIGNhbiB1c2UgdGhlIG51bWJlciBpbiBhIEJsb29tIGZpbHRlciFcbiAgbGV0IHZpZXdRdWVyeUlkID0gMTtcbiAgY29uc3Qgdmlld1F1ZXJpZXMgPSBuZXcgTWFwPGFueSwgUXVlcnlXaXRoSWRbXT4oKTtcbiAgaWYgKGNvbXBvbmVudC52aWV3UXVlcmllcykge1xuICAgIGNvbXBvbmVudC52aWV3UXVlcmllcy5mb3JFYWNoKFxuICAgICAgICAocXVlcnkpID0+IF9hZGRRdWVyeVRvVG9rZW5NYXAodmlld1F1ZXJpZXMsIHttZXRhOiBxdWVyeSwgcXVlcnlJZDogdmlld1F1ZXJ5SWQrK30pKTtcbiAgfVxuICByZXR1cm4gdmlld1F1ZXJpZXM7XG59XG5cbmZ1bmN0aW9uIF9nZXRDb250ZW50UXVlcmllcyhcbiAgICBjb250ZW50UXVlcnlTdGFydElkOiBudW1iZXIsIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10pOiBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPiB7XG4gIGxldCBjb250ZW50UXVlcnlJZCA9IGNvbnRlbnRRdWVyeVN0YXJ0SWQ7XG4gIGNvbnN0IGNvbnRlbnRRdWVyaWVzID0gbmV3IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+KCk7XG4gIGRpcmVjdGl2ZXMuZm9yRWFjaCgoZGlyZWN0aXZlLCBkaXJlY3RpdmVJbmRleCkgPT4ge1xuICAgIGlmIChkaXJlY3RpdmUucXVlcmllcykge1xuICAgICAgZGlyZWN0aXZlLnF1ZXJpZXMuZm9yRWFjaChcbiAgICAgICAgICAocXVlcnkpID0+IF9hZGRRdWVyeVRvVG9rZW5NYXAoY29udGVudFF1ZXJpZXMsIHttZXRhOiBxdWVyeSwgcXVlcnlJZDogY29udGVudFF1ZXJ5SWQrK30pKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gY29udGVudFF1ZXJpZXM7XG59XG5cbmZ1bmN0aW9uIF9hZGRRdWVyeVRvVG9rZW5NYXAobWFwOiBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPiwgcXVlcnk6IFF1ZXJ5V2l0aElkKSB7XG4gIHF1ZXJ5Lm1ldGEuc2VsZWN0b3JzLmZvckVhY2goKHRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSkgPT4ge1xuICAgIGxldCBlbnRyeSA9IG1hcC5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAoIWVudHJ5KSB7XG4gICAgICBlbnRyeSA9IFtdO1xuICAgICAgbWFwLnNldCh0b2tlblJlZmVyZW5jZSh0b2tlbiksIGVudHJ5KTtcbiAgICB9XG4gICAgZW50cnkucHVzaChxdWVyeSk7XG4gIH0pO1xufVxuIl19