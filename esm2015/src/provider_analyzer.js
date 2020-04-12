/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { tokenName, tokenReference } from './compile_metadata';
import { Identifiers, createTokenForExternalReference } from './identifiers';
import { ParseError } from './parse_util';
import { ProviderAst, ProviderAstType } from './template_parser/template_ast';
export class ProviderError extends ParseError {
    constructor(message, span) { super(span, message); }
}
export class ProviderViewContext {
    constructor(reflector, component) {
        this.reflector = reflector;
        this.component = component;
        this.errors = [];
        this.viewQueries = _getViewQueries(component);
        this.viewProviders = new Map();
        component.viewProviders.forEach((provider) => {
            if (this.viewProviders.get(tokenReference(provider.token)) == null) {
                this.viewProviders.set(tokenReference(provider.token), true);
            }
        });
    }
}
export class ProviderElementContext {
    constructor(viewContext, _parent, _isViewRoot, _directiveAsts, attrs, refs, isTemplate, contentQueryStartId, _sourceSpan) {
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
        attrs.forEach((attrAst) => this._attrs[attrAst.name] = attrAst.value);
        const directivesMeta = _directiveAsts.map(directiveAst => directiveAst.directive);
        this._allProviders =
            _resolveProvidersFromDirectives(directivesMeta, _sourceSpan, viewContext.errors);
        this._contentQueries = _getContentQueries(contentQueryStartId, directivesMeta);
        Array.from(this._allProviders.values()).forEach((provider) => {
            this._addQueryReadsTo(provider.token, provider.token, this._queriedTokens);
        });
        if (isTemplate) {
            const templateRefId = createTokenForExternalReference(this.viewContext.reflector, Identifiers.TemplateRef);
            this._addQueryReadsTo(templateRefId, templateRefId, this._queriedTokens);
        }
        refs.forEach((refAst) => {
            let defaultQueryValue = refAst.value ||
                createTokenForExternalReference(this.viewContext.reflector, Identifiers.ElementRef);
            this._addQueryReadsTo({ value: refAst.name }, defaultQueryValue, this._queriedTokens);
        });
        if (this._queriedTokens.get(this.viewContext.reflector.resolveExternalReference(Identifiers.ViewContainerRef))) {
            this.transformedHasViewContainer = true;
        }
        // create the providers that we know are eager first
        Array.from(this._allProviders.values()).forEach((provider) => {
            const eager = provider.eager || this._queriedTokens.get(tokenReference(provider.token));
            if (eager) {
                this._getOrCreateLocalProvider(provider.providerType, provider.token, true);
            }
        });
    }
    afterElement() {
        // collect lazy providers
        Array.from(this._allProviders.values()).forEach((provider) => {
            this._getOrCreateLocalProvider(provider.providerType, provider.token, false);
        });
    }
    get transformProviders() {
        // Note: Maps keep their insertion order.
        const lazyProviders = [];
        const eagerProviders = [];
        this._transformedProviders.forEach(provider => {
            if (provider.eager) {
                eagerProviders.push(provider);
            }
            else {
                lazyProviders.push(provider);
            }
        });
        return lazyProviders.concat(eagerProviders);
    }
    get transformedDirectiveAsts() {
        const sortedProviderTypes = this.transformProviders.map(provider => provider.token.identifier);
        const sortedDirectives = this._directiveAsts.slice();
        sortedDirectives.sort((dir1, dir2) => sortedProviderTypes.indexOf(dir1.directive.type) -
            sortedProviderTypes.indexOf(dir2.directive.type));
        return sortedDirectives;
    }
    get queryMatches() {
        const allMatches = [];
        this._queriedTokens.forEach((matches) => { allMatches.push(...matches); });
        return allMatches;
    }
    _addQueryReadsTo(token, defaultValue, queryReadTokens) {
        this._getQueriesFor(token).forEach((query) => {
            const queryValue = query.meta.read || defaultValue;
            const tokenRef = tokenReference(queryValue);
            let queryMatches = queryReadTokens.get(tokenRef);
            if (!queryMatches) {
                queryMatches = [];
                queryReadTokens.set(tokenRef, queryMatches);
            }
            queryMatches.push({ queryId: query.queryId, value: queryValue });
        });
    }
    _getQueriesFor(token) {
        const result = [];
        let currentEl = this;
        let distance = 0;
        let queries;
        while (currentEl !== null) {
            queries = currentEl._contentQueries.get(tokenReference(token));
            if (queries) {
                result.push(...queries.filter((query) => query.meta.descendants || distance <= 1));
            }
            if (currentEl._directiveAsts.length > 0) {
                distance++;
            }
            currentEl = currentEl._parent;
        }
        queries = this.viewContext.viewQueries.get(tokenReference(token));
        if (queries) {
            result.push(...queries);
        }
        return result;
    }
    _getOrCreateLocalProvider(requestingProviderType, token, eager) {
        const resolvedProvider = this._allProviders.get(tokenReference(token));
        if (!resolvedProvider || ((requestingProviderType === ProviderAstType.Directive ||
            requestingProviderType === ProviderAstType.PublicService) &&
            resolvedProvider.providerType === ProviderAstType.PrivateService) ||
            ((requestingProviderType === ProviderAstType.PrivateService ||
                requestingProviderType === ProviderAstType.PublicService) &&
                resolvedProvider.providerType === ProviderAstType.Builtin)) {
            return null;
        }
        let transformedProviderAst = this._transformedProviders.get(tokenReference(token));
        if (transformedProviderAst) {
            return transformedProviderAst;
        }
        if (this._seenProviders.get(tokenReference(token)) != null) {
            this.viewContext.errors.push(new ProviderError(`Cannot instantiate cyclic dependency! ${tokenName(token)}`, this._sourceSpan));
            return null;
        }
        this._seenProviders.set(tokenReference(token), true);
        const transformedProviders = resolvedProvider.providers.map((provider) => {
            let transformedUseValue = provider.useValue;
            let transformedUseExisting = provider.useExisting;
            let transformedDeps = undefined;
            if (provider.useExisting != null) {
                const existingDiDep = this._getDependency(resolvedProvider.providerType, { token: provider.useExisting }, eager);
                if (existingDiDep.token != null) {
                    transformedUseExisting = existingDiDep.token;
                }
                else {
                    transformedUseExisting = null;
                    transformedUseValue = existingDiDep.value;
                }
            }
            else if (provider.useFactory) {
                const deps = provider.deps || provider.useFactory.diDeps;
                transformedDeps =
                    deps.map((dep) => this._getDependency(resolvedProvider.providerType, dep, eager));
            }
            else if (provider.useClass) {
                const deps = provider.deps || provider.useClass.diDeps;
                transformedDeps =
                    deps.map((dep) => this._getDependency(resolvedProvider.providerType, dep, eager));
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
    }
    _getLocalDependency(requestingProviderType, dep, eager = false) {
        if (dep.isAttribute) {
            const attrValue = this._attrs[dep.token.value];
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
    }
    _getDependency(requestingProviderType, dep, eager = false) {
        let currElement = this;
        let currEager = eager;
        let result = null;
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
                const prevElement = currElement;
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
            this.viewContext.errors.push(new ProviderError(`No provider for ${tokenName(dep.token)}`, this._sourceSpan));
        }
        return result;
    }
}
export class NgModuleProviderAnalyzer {
    constructor(reflector, ngModule, extraProviders, sourceSpan) {
        this.reflector = reflector;
        this._transformedProviders = new Map();
        this._seenProviders = new Map();
        this._errors = [];
        this._allProviders = new Map();
        ngModule.transitiveModule.modules.forEach((ngModuleType) => {
            const ngModuleProvider = { token: { identifier: ngModuleType }, useClass: ngModuleType };
            _resolveProviders([ngModuleProvider], ProviderAstType.PublicService, true, sourceSpan, this._errors, this._allProviders, /* isModule */ true);
        });
        _resolveProviders(ngModule.transitiveModule.providers.map(entry => entry.provider).concat(extraProviders), ProviderAstType.PublicService, false, sourceSpan, this._errors, this._allProviders, 
        /* isModule */ false);
    }
    parse() {
        Array.from(this._allProviders.values()).forEach((provider) => {
            this._getOrCreateLocalProvider(provider.token, provider.eager);
        });
        if (this._errors.length > 0) {
            const errorString = this._errors.join('\n');
            throw new Error(`Provider parse errors:\n${errorString}`);
        }
        // Note: Maps keep their insertion order.
        const lazyProviders = [];
        const eagerProviders = [];
        this._transformedProviders.forEach(provider => {
            if (provider.eager) {
                eagerProviders.push(provider);
            }
            else {
                lazyProviders.push(provider);
            }
        });
        return lazyProviders.concat(eagerProviders);
    }
    _getOrCreateLocalProvider(token, eager) {
        const resolvedProvider = this._allProviders.get(tokenReference(token));
        if (!resolvedProvider) {
            return null;
        }
        let transformedProviderAst = this._transformedProviders.get(tokenReference(token));
        if (transformedProviderAst) {
            return transformedProviderAst;
        }
        if (this._seenProviders.get(tokenReference(token)) != null) {
            this._errors.push(new ProviderError(`Cannot instantiate cyclic dependency! ${tokenName(token)}`, resolvedProvider.sourceSpan));
            return null;
        }
        this._seenProviders.set(tokenReference(token), true);
        const transformedProviders = resolvedProvider.providers.map((provider) => {
            let transformedUseValue = provider.useValue;
            let transformedUseExisting = provider.useExisting;
            let transformedDeps = undefined;
            if (provider.useExisting != null) {
                const existingDiDep = this._getDependency({ token: provider.useExisting }, eager, resolvedProvider.sourceSpan);
                if (existingDiDep.token != null) {
                    transformedUseExisting = existingDiDep.token;
                }
                else {
                    transformedUseExisting = null;
                    transformedUseValue = existingDiDep.value;
                }
            }
            else if (provider.useFactory) {
                const deps = provider.deps || provider.useFactory.diDeps;
                transformedDeps =
                    deps.map((dep) => this._getDependency(dep, eager, resolvedProvider.sourceSpan));
            }
            else if (provider.useClass) {
                const deps = provider.deps || provider.useClass.diDeps;
                transformedDeps =
                    deps.map((dep) => this._getDependency(dep, eager, resolvedProvider.sourceSpan));
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
    }
    _getDependency(dep, eager = false, requestorSourceSpan) {
        let foundLocal = false;
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
    }
}
function _transformProvider(provider, { useExisting, useValue, deps }) {
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
function _transformProviderAst(provider, { eager, providers }) {
    return new ProviderAst(provider.token, provider.multiProvider, provider.eager || eager, providers, provider.providerType, provider.lifecycleHooks, provider.sourceSpan, provider.isModule);
}
function _resolveProvidersFromDirectives(directives, sourceSpan, targetErrors) {
    const providersByToken = new Map();
    directives.forEach((directive) => {
        const dirProvider = { token: { identifier: directive.type }, useClass: directive.type };
        _resolveProviders([dirProvider], directive.isComponent ? ProviderAstType.Component : ProviderAstType.Directive, true, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
    });
    // Note: directives need to be able to overwrite providers of a component!
    const directivesWithComponentFirst = directives.filter(dir => dir.isComponent).concat(directives.filter(dir => !dir.isComponent));
    directivesWithComponentFirst.forEach((directive) => {
        _resolveProviders(directive.providers, ProviderAstType.PublicService, false, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
        _resolveProviders(directive.viewProviders, ProviderAstType.PrivateService, false, sourceSpan, targetErrors, providersByToken, /* isModule */ false);
    });
    return providersByToken;
}
function _resolveProviders(providers, providerType, eager, sourceSpan, targetErrors, targetProvidersByToken, isModule) {
    providers.forEach((provider) => {
        let resolvedProvider = targetProvidersByToken.get(tokenReference(provider.token));
        if (resolvedProvider != null && !!resolvedProvider.multiProvider !== !!provider.multi) {
            targetErrors.push(new ProviderError(`Mixing multi and non multi provider is not possible for token ${tokenName(resolvedProvider.token)}`, sourceSpan));
        }
        if (!resolvedProvider) {
            const lifecycleHooks = provider.token.identifier &&
                provider.token.identifier.lifecycleHooks ?
                provider.token.identifier.lifecycleHooks :
                [];
            const isUseValue = !(provider.useClass || provider.useExisting || provider.useFactory);
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
    let viewQueryId = 1;
    const viewQueries = new Map();
    if (component.viewQueries) {
        component.viewQueries.forEach((query) => _addQueryToTokenMap(viewQueries, { meta: query, queryId: viewQueryId++ }));
    }
    return viewQueries;
}
function _getContentQueries(contentQueryStartId, directives) {
    let contentQueryId = contentQueryStartId;
    const contentQueries = new Map();
    directives.forEach((directive, directiveIndex) => {
        if (directive.queries) {
            directive.queries.forEach((query) => _addQueryToTokenMap(contentQueries, { meta: query, queryId: contentQueryId++ }));
        }
    });
    return contentQueries;
}
function _addQueryToTokenMap(map, query) {
    query.meta.selectors.forEach((token) => {
        let entry = map.get(tokenReference(token));
        if (!entry) {
            entry = [];
            map.set(tokenReference(token), entry);
        }
        entry.push(query);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXJfYW5hbHl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcHJvdmlkZXJfYW5hbHl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFvTSxTQUFTLEVBQUUsY0FBYyxFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFFaFEsT0FBTyxFQUFDLFdBQVcsRUFBRSwrQkFBK0IsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMzRSxPQUFPLEVBQUMsVUFBVSxFQUFrQixNQUFNLGNBQWMsQ0FBQztBQUN6RCxPQUFPLEVBQXdCLFdBQVcsRUFBRSxlQUFlLEVBQTJCLE1BQU0sZ0NBQWdDLENBQUM7QUFFN0gsTUFBTSxPQUFPLGFBQWMsU0FBUSxVQUFVO0lBQzNDLFlBQVksT0FBZSxFQUFFLElBQXFCLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDOUU7QUFPRCxNQUFNLE9BQU8sbUJBQW1CO0lBVzlCLFlBQW1CLFNBQTJCLEVBQVMsU0FBbUM7UUFBdkUsY0FBUyxHQUFULFNBQVMsQ0FBa0I7UUFBUyxjQUFTLEdBQVQsU0FBUyxDQUEwQjtRQUYxRixXQUFNLEdBQW9CLEVBQUUsQ0FBQztRQUczQixJQUFJLENBQUMsV0FBVyxHQUFHLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO1FBQzdDLFNBQVMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDM0MsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxFQUFFO2dCQUNsRSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FB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QUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQTJCLEVBQUUsRUFBRTtRQUMzRCxJQUFJLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDVixLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQ1gsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDdkM7UUFDRCxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3BCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge0NvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSwgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsIENvbXBpbGVQcm92aWRlck1ldGFkYXRhLCBDb21waWxlUXVlcnlNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIENvbXBpbGVUeXBlTWV0YWRhdGEsIHRva2VuTmFtZSwgdG9rZW5SZWZlcmVuY2V9IGZyb20gJy4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtJZGVudGlmaWVycywgY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZX0gZnJvbSAnLi9pZGVudGlmaWVycyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7QXR0ckFzdCwgRGlyZWN0aXZlQXN0LCBQcm92aWRlckFzdCwgUHJvdmlkZXJBc3RUeXBlLCBRdWVyeU1hdGNoLCBSZWZlcmVuY2VBc3R9IGZyb20gJy4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX2FzdCc7XG5cbmV4cG9ydCBjbGFzcyBQcm92aWRlckVycm9yIGV4dGVuZHMgUGFyc2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgc3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7IHN1cGVyKHNwYW4sIG1lc3NhZ2UpOyB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVlcnlXaXRoSWQge1xuICBtZXRhOiBDb21waWxlUXVlcnlNZXRhZGF0YTtcbiAgcXVlcnlJZDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgUHJvdmlkZXJWaWV3Q29udGV4dCB7XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHZpZXdRdWVyaWVzOiBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPjtcbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgdmlld1Byb3ZpZGVyczogTWFwPGFueSwgYm9vbGVhbj47XG4gIGVycm9yczogUHJvdmlkZXJFcnJvcltdID0gW107XG5cbiAgY29uc3RydWN0b3IocHVibGljIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgcHVibGljIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKSB7XG4gICAgdGhpcy52aWV3UXVlcmllcyA9IF9nZXRWaWV3UXVlcmllcyhjb21wb25lbnQpO1xuICAgIHRoaXMudmlld1Byb3ZpZGVycyA9IG5ldyBNYXA8YW55LCBib29sZWFuPigpO1xuICAgIGNvbXBvbmVudC52aWV3UHJvdmlkZXJzLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICBpZiAodGhpcy52aWV3UHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbikpID09IG51bGwpIHtcbiAgICAgICAgdGhpcy52aWV3UHJvdmlkZXJzLnNldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbiksIHRydWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQcm92aWRlckVsZW1lbnRDb250ZXh0IHtcbiAgcHJpdmF0ZSBfY29udGVudFF1ZXJpZXM6IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+O1xuXG4gIHByaXZhdGUgX3RyYW5zZm9ybWVkUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIFByb3ZpZGVyQXN0PigpO1xuICBwcml2YXRlIF9zZWVuUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIGJvb2xlYW4+KCk7XG4gIHByaXZhdGUgX2FsbFByb3ZpZGVyczogTWFwPGFueSwgUHJvdmlkZXJBc3Q+O1xuICBwcml2YXRlIF9hdHRyczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHByaXZhdGUgX3F1ZXJpZWRUb2tlbnMgPSBuZXcgTWFwPGFueSwgUXVlcnlNYXRjaFtdPigpO1xuXG4gIHB1YmxpYyByZWFkb25seSB0cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXI6IGJvb2xlYW4gPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB2aWV3Q29udGV4dDogUHJvdmlkZXJWaWV3Q29udGV4dCwgcHJpdmF0ZSBfcGFyZW50OiBQcm92aWRlckVsZW1lbnRDb250ZXh0LFxuICAgICAgcHJpdmF0ZSBfaXNWaWV3Um9vdDogYm9vbGVhbiwgcHJpdmF0ZSBfZGlyZWN0aXZlQXN0czogRGlyZWN0aXZlQXN0W10sIGF0dHJzOiBBdHRyQXN0W10sXG4gICAgICByZWZzOiBSZWZlcmVuY2VBc3RbXSwgaXNUZW1wbGF0ZTogYm9vbGVhbiwgY29udGVudFF1ZXJ5U3RhcnRJZDogbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBfc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgdGhpcy5fYXR0cnMgPSB7fTtcbiAgICBhdHRycy5mb3JFYWNoKChhdHRyQXN0KSA9PiB0aGlzLl9hdHRyc1thdHRyQXN0Lm5hbWVdID0gYXR0ckFzdC52YWx1ZSk7XG4gICAgY29uc3QgZGlyZWN0aXZlc01ldGEgPSBfZGlyZWN0aXZlQXN0cy5tYXAoZGlyZWN0aXZlQXN0ID0+IGRpcmVjdGl2ZUFzdC5kaXJlY3RpdmUpO1xuICAgIHRoaXMuX2FsbFByb3ZpZGVycyA9XG4gICAgICAgIF9yZXNvbHZlUHJvdmlkZXJzRnJvbURpcmVjdGl2ZXMoZGlyZWN0aXZlc01ldGEsIF9zb3VyY2VTcGFuLCB2aWV3Q29udGV4dC5lcnJvcnMpO1xuICAgIHRoaXMuX2NvbnRlbnRRdWVyaWVzID0gX2dldENvbnRlbnRRdWVyaWVzKGNvbnRlbnRRdWVyeVN0YXJ0SWQsIGRpcmVjdGl2ZXNNZXRhKTtcbiAgICBBcnJheS5mcm9tKHRoaXMuX2FsbFByb3ZpZGVycy52YWx1ZXMoKSkuZm9yRWFjaCgocHJvdmlkZXIpID0+IHtcbiAgICAgIHRoaXMuX2FkZFF1ZXJ5UmVhZHNUbyhwcm92aWRlci50b2tlbiwgcHJvdmlkZXIudG9rZW4sIHRoaXMuX3F1ZXJpZWRUb2tlbnMpO1xuICAgIH0pO1xuICAgIGlmIChpc1RlbXBsYXRlKSB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZVJlZklkID1cbiAgICAgICAgICBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLCBJZGVudGlmaWVycy5UZW1wbGF0ZVJlZik7XG4gICAgICB0aGlzLl9hZGRRdWVyeVJlYWRzVG8odGVtcGxhdGVSZWZJZCwgdGVtcGxhdGVSZWZJZCwgdGhpcy5fcXVlcmllZFRva2Vucyk7XG4gICAgfVxuICAgIHJlZnMuZm9yRWFjaCgocmVmQXN0KSA9PiB7XG4gICAgICBsZXQgZGVmYXVsdFF1ZXJ5VmFsdWUgPSByZWZBc3QudmFsdWUgfHxcbiAgICAgICAgICBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLCBJZGVudGlmaWVycy5FbGVtZW50UmVmKTtcbiAgICAgIHRoaXMuX2FkZFF1ZXJ5UmVhZHNUbyh7dmFsdWU6IHJlZkFzdC5uYW1lfSwgZGVmYXVsdFF1ZXJ5VmFsdWUsIHRoaXMuX3F1ZXJpZWRUb2tlbnMpO1xuICAgIH0pO1xuICAgIGlmICh0aGlzLl9xdWVyaWVkVG9rZW5zLmdldChcbiAgICAgICAgICAgIHRoaXMudmlld0NvbnRleHQucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5WaWV3Q29udGFpbmVyUmVmKSkpIHtcbiAgICAgIHRoaXMudHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgdGhlIHByb3ZpZGVycyB0aGF0IHdlIGtub3cgYXJlIGVhZ2VyIGZpcnN0XG4gICAgQXJyYXkuZnJvbSh0aGlzLl9hbGxQcm92aWRlcnMudmFsdWVzKCkpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICBjb25zdCBlYWdlciA9IHByb3ZpZGVyLmVhZ2VyIHx8IHRoaXMuX3F1ZXJpZWRUb2tlbnMuZ2V0KHRva2VuUmVmZXJlbmNlKHByb3ZpZGVyLnRva2VuKSk7XG4gICAgICBpZiAoZWFnZXIpIHtcbiAgICAgICAgdGhpcy5fZ2V0T3JDcmVhdGVMb2NhbFByb3ZpZGVyKHByb3ZpZGVyLnByb3ZpZGVyVHlwZSwgcHJvdmlkZXIudG9rZW4sIHRydWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYWZ0ZXJFbGVtZW50KCkge1xuICAgIC8vIGNvbGxlY3QgbGF6eSBwcm92aWRlcnNcbiAgICBBcnJheS5mcm9tKHRoaXMuX2FsbFByb3ZpZGVycy52YWx1ZXMoKSkuZm9yRWFjaCgocHJvdmlkZXIpID0+IHtcbiAgICAgIHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihwcm92aWRlci5wcm92aWRlclR5cGUsIHByb3ZpZGVyLnRva2VuLCBmYWxzZSk7XG4gICAgfSk7XG4gIH1cblxuICBnZXQgdHJhbnNmb3JtUHJvdmlkZXJzKCk6IFByb3ZpZGVyQXN0W10ge1xuICAgIC8vIE5vdGU6IE1hcHMga2VlcCB0aGVpciBpbnNlcnRpb24gb3JkZXIuXG4gICAgY29uc3QgbGF6eVByb3ZpZGVyczogUHJvdmlkZXJBc3RbXSA9IFtdO1xuICAgIGNvbnN0IGVhZ2VyUHJvdmlkZXJzOiBQcm92aWRlckFzdFtdID0gW107XG4gICAgdGhpcy5fdHJhbnNmb3JtZWRQcm92aWRlcnMuZm9yRWFjaChwcm92aWRlciA9PiB7XG4gICAgICBpZiAocHJvdmlkZXIuZWFnZXIpIHtcbiAgICAgICAgZWFnZXJQcm92aWRlcnMucHVzaChwcm92aWRlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsYXp5UHJvdmlkZXJzLnB1c2gocHJvdmlkZXIpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBsYXp5UHJvdmlkZXJzLmNvbmNhdChlYWdlclByb3ZpZGVycyk7XG4gIH1cblxuICBnZXQgdHJhbnNmb3JtZWREaXJlY3RpdmVBc3RzKCk6IERpcmVjdGl2ZUFzdFtdIHtcbiAgICBjb25zdCBzb3J0ZWRQcm92aWRlclR5cGVzID0gdGhpcy50cmFuc2Zvcm1Qcm92aWRlcnMubWFwKHByb3ZpZGVyID0+IHByb3ZpZGVyLnRva2VuLmlkZW50aWZpZXIpO1xuICAgIGNvbnN0IHNvcnRlZERpcmVjdGl2ZXMgPSB0aGlzLl9kaXJlY3RpdmVBc3RzLnNsaWNlKCk7XG4gICAgc29ydGVkRGlyZWN0aXZlcy5zb3J0KFxuICAgICAgICAoZGlyMSwgZGlyMikgPT4gc29ydGVkUHJvdmlkZXJUeXBlcy5pbmRleE9mKGRpcjEuZGlyZWN0aXZlLnR5cGUpIC1cbiAgICAgICAgICAgIHNvcnRlZFByb3ZpZGVyVHlwZXMuaW5kZXhPZihkaXIyLmRpcmVjdGl2ZS50eXBlKSk7XG4gICAgcmV0dXJuIHNvcnRlZERpcmVjdGl2ZXM7XG4gIH1cblxuICBnZXQgcXVlcnlNYXRjaGVzKCk6IFF1ZXJ5TWF0Y2hbXSB7XG4gICAgY29uc3QgYWxsTWF0Y2hlczogUXVlcnlNYXRjaFtdID0gW107XG4gICAgdGhpcy5fcXVlcmllZFRva2Vucy5mb3JFYWNoKChtYXRjaGVzOiBRdWVyeU1hdGNoW10pID0+IHsgYWxsTWF0Y2hlcy5wdXNoKC4uLm1hdGNoZXMpOyB9KTtcbiAgICByZXR1cm4gYWxsTWF0Y2hlcztcbiAgfVxuXG4gIHByaXZhdGUgX2FkZFF1ZXJ5UmVhZHNUbyhcbiAgICAgIHRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSwgZGVmYXVsdFZhbHVlOiBDb21waWxlVG9rZW5NZXRhZGF0YSxcbiAgICAgIHF1ZXJ5UmVhZFRva2VuczogTWFwPGFueSwgUXVlcnlNYXRjaFtdPikge1xuICAgIHRoaXMuX2dldFF1ZXJpZXNGb3IodG9rZW4pLmZvckVhY2goKHF1ZXJ5KSA9PiB7XG4gICAgICBjb25zdCBxdWVyeVZhbHVlID0gcXVlcnkubWV0YS5yZWFkIHx8IGRlZmF1bHRWYWx1ZTtcbiAgICAgIGNvbnN0IHRva2VuUmVmID0gdG9rZW5SZWZlcmVuY2UocXVlcnlWYWx1ZSk7XG4gICAgICBsZXQgcXVlcnlNYXRjaGVzID0gcXVlcnlSZWFkVG9rZW5zLmdldCh0b2tlblJlZik7XG4gICAgICBpZiAoIXF1ZXJ5TWF0Y2hlcykge1xuICAgICAgICBxdWVyeU1hdGNoZXMgPSBbXTtcbiAgICAgICAgcXVlcnlSZWFkVG9rZW5zLnNldCh0b2tlblJlZiwgcXVlcnlNYXRjaGVzKTtcbiAgICAgIH1cbiAgICAgIHF1ZXJ5TWF0Y2hlcy5wdXNoKHtxdWVyeUlkOiBxdWVyeS5xdWVyeUlkLCB2YWx1ZTogcXVlcnlWYWx1ZX0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0UXVlcmllc0Zvcih0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEpOiBRdWVyeVdpdGhJZFtdIHtcbiAgICBjb25zdCByZXN1bHQ6IFF1ZXJ5V2l0aElkW10gPSBbXTtcbiAgICBsZXQgY3VycmVudEVsOiBQcm92aWRlckVsZW1lbnRDb250ZXh0ID0gdGhpcztcbiAgICBsZXQgZGlzdGFuY2UgPSAwO1xuICAgIGxldCBxdWVyaWVzOiBRdWVyeVdpdGhJZFtdfHVuZGVmaW5lZDtcbiAgICB3aGlsZSAoY3VycmVudEVsICE9PSBudWxsKSB7XG4gICAgICBxdWVyaWVzID0gY3VycmVudEVsLl9jb250ZW50UXVlcmllcy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICAgIGlmIChxdWVyaWVzKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKC4uLnF1ZXJpZXMuZmlsdGVyKChxdWVyeSkgPT4gcXVlcnkubWV0YS5kZXNjZW5kYW50cyB8fCBkaXN0YW5jZSA8PSAxKSk7XG4gICAgICB9XG4gICAgICBpZiAoY3VycmVudEVsLl9kaXJlY3RpdmVBc3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZGlzdGFuY2UrKztcbiAgICAgIH1cbiAgICAgIGN1cnJlbnRFbCA9IGN1cnJlbnRFbC5fcGFyZW50O1xuICAgIH1cbiAgICBxdWVyaWVzID0gdGhpcy52aWV3Q29udGV4dC52aWV3UXVlcmllcy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAocXVlcmllcykge1xuICAgICAgcmVzdWx0LnB1c2goLi4ucXVlcmllcyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuXG4gIHByaXZhdGUgX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihcbiAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGU6IFByb3ZpZGVyQXN0VHlwZSwgdG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhLFxuICAgICAgZWFnZXI6IGJvb2xlYW4pOiBQcm92aWRlckFzdHxudWxsIHtcbiAgICBjb25zdCByZXNvbHZlZFByb3ZpZGVyID0gdGhpcy5fYWxsUHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpO1xuICAgIGlmICghcmVzb2x2ZWRQcm92aWRlciB8fCAoKHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5EaXJlY3RpdmUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0aW5nUHJvdmlkZXJUeXBlID09PSBQcm92aWRlckFzdFR5cGUuUHVibGljU2VydmljZSkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJUeXBlID09PSBQcm92aWRlckFzdFR5cGUuUHJpdmF0ZVNlcnZpY2UpIHx8XG4gICAgICAgICgocmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlByaXZhdGVTZXJ2aWNlIHx8XG4gICAgICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UpICYmXG4gICAgICAgICByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLkJ1aWx0aW4pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbGV0IHRyYW5zZm9ybWVkUHJvdmlkZXJBc3QgPSB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAodHJhbnNmb3JtZWRQcm92aWRlckFzdCkge1xuICAgICAgcmV0dXJuIHRyYW5zZm9ybWVkUHJvdmlkZXJBc3Q7XG4gICAgfVxuICAgIGlmICh0aGlzLl9zZWVuUHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpICE9IG51bGwpIHtcbiAgICAgIHRoaXMudmlld0NvbnRleHQuZXJyb3JzLnB1c2gobmV3IFByb3ZpZGVyRXJyb3IoXG4gICAgICAgICAgYENhbm5vdCBpbnN0YW50aWF0ZSBjeWNsaWMgZGVwZW5kZW5jeSEgJHt0b2tlbk5hbWUodG9rZW4pfWAsIHRoaXMuX3NvdXJjZVNwYW4pKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLl9zZWVuUHJvdmlkZXJzLnNldCh0b2tlblJlZmVyZW5jZSh0b2tlbiksIHRydWUpO1xuICAgIGNvbnN0IHRyYW5zZm9ybWVkUHJvdmlkZXJzID0gcmVzb2x2ZWRQcm92aWRlci5wcm92aWRlcnMubWFwKChwcm92aWRlcikgPT4ge1xuICAgICAgbGV0IHRyYW5zZm9ybWVkVXNlVmFsdWUgPSBwcm92aWRlci51c2VWYWx1ZTtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gcHJvdmlkZXIudXNlRXhpc3RpbmcgITtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZERlcHM6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YVtdID0gdW5kZWZpbmVkICE7XG4gICAgICBpZiAocHJvdmlkZXIudXNlRXhpc3RpbmcgIT0gbnVsbCkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0RpRGVwID0gdGhpcy5fZ2V0RGVwZW5kZW5jeShcbiAgICAgICAgICAgIHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJUeXBlLCB7dG9rZW46IHByb3ZpZGVyLnVzZUV4aXN0aW5nfSwgZWFnZXIpICE7XG4gICAgICAgIGlmIChleGlzdGluZ0RpRGVwLnRva2VuICE9IG51bGwpIHtcbiAgICAgICAgICB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gZXhpc3RpbmdEaURlcC50b2tlbjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nID0gbnVsbCAhO1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlVmFsdWUgPSBleGlzdGluZ0RpRGVwLnZhbHVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHByb3ZpZGVyLnVzZUZhY3RvcnkpIHtcbiAgICAgICAgY29uc3QgZGVwcyA9IHByb3ZpZGVyLmRlcHMgfHwgcHJvdmlkZXIudXNlRmFjdG9yeS5kaURlcHM7XG4gICAgICAgIHRyYW5zZm9ybWVkRGVwcyA9XG4gICAgICAgICAgICBkZXBzLm1hcCgoZGVwKSA9PiB0aGlzLl9nZXREZXBlbmRlbmN5KHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJUeXBlLCBkZXAsIGVhZ2VyKSAhKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvdmlkZXIudXNlQ2xhc3MpIHtcbiAgICAgICAgY29uc3QgZGVwcyA9IHByb3ZpZGVyLmRlcHMgfHwgcHJvdmlkZXIudXNlQ2xhc3MuZGlEZXBzO1xuICAgICAgICB0cmFuc2Zvcm1lZERlcHMgPVxuICAgICAgICAgICAgZGVwcy5tYXAoKGRlcCkgPT4gdGhpcy5fZ2V0RGVwZW5kZW5jeShyZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVyVHlwZSwgZGVwLCBlYWdlcikgISk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3RyYW5zZm9ybVByb3ZpZGVyKHByb3ZpZGVyLCB7XG4gICAgICAgIHVzZUV4aXN0aW5nOiB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nLFxuICAgICAgICB1c2VWYWx1ZTogdHJhbnNmb3JtZWRVc2VWYWx1ZSxcbiAgICAgICAgZGVwczogdHJhbnNmb3JtZWREZXBzXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0ID1cbiAgICAgICAgX3RyYW5zZm9ybVByb3ZpZGVyQXN0KHJlc29sdmVkUHJvdmlkZXIsIHtlYWdlcjogZWFnZXIsIHByb3ZpZGVyczogdHJhbnNmb3JtZWRQcm92aWRlcnN9KTtcbiAgICB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0KTtcbiAgICByZXR1cm4gdHJhbnNmb3JtZWRQcm92aWRlckFzdDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldExvY2FsRGVwZW5kZW5jeShcbiAgICAgIHJlcXVlc3RpbmdQcm92aWRlclR5cGU6IFByb3ZpZGVyQXN0VHlwZSwgZGVwOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGEsXG4gICAgICBlYWdlcjogYm9vbGVhbiA9IGZhbHNlKTogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhfG51bGwge1xuICAgIGlmIChkZXAuaXNBdHRyaWJ1dGUpIHtcbiAgICAgIGNvbnN0IGF0dHJWYWx1ZSA9IHRoaXMuX2F0dHJzW2RlcC50b2tlbiAhLnZhbHVlXTtcbiAgICAgIHJldHVybiB7aXNWYWx1ZTogdHJ1ZSwgdmFsdWU6IGF0dHJWYWx1ZSA9PSBudWxsID8gbnVsbCA6IGF0dHJWYWx1ZX07XG4gICAgfVxuXG4gICAgaWYgKGRlcC50b2tlbiAhPSBudWxsKSB7XG4gICAgICAvLyBhY2Nlc3MgYnVpbHRpbnRzXG4gICAgICBpZiAoKHJlcXVlc3RpbmdQcm92aWRlclR5cGUgPT09IFByb3ZpZGVyQXN0VHlwZS5EaXJlY3RpdmUgfHxcbiAgICAgICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZSA9PT0gUHJvdmlkZXJBc3RUeXBlLkNvbXBvbmVudCkpIHtcbiAgICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlJlbmRlcmVyKSB8fFxuICAgICAgICAgICAgdG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuKSA9PT1cbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuRWxlbWVudFJlZikgfHxcbiAgICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKFxuICAgICAgICAgICAgICAgICAgICBJZGVudGlmaWVycy5DaGFuZ2VEZXRlY3RvclJlZikgfHxcbiAgICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3Q29udGV4dC5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlRlbXBsYXRlUmVmKSkge1xuICAgICAgICAgIHJldHVybiBkZXA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuVmlld0NvbnRhaW5lclJlZikpIHtcbiAgICAgICAgICAodGhpcyBhc3t0cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXI6IGJvb2xlYW59KS50cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXIgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBhY2Nlc3MgdGhlIGluamVjdG9yXG4gICAgICBpZiAodG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuKSA9PT1cbiAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuSW5qZWN0b3IpKSB7XG4gICAgICAgIHJldHVybiBkZXA7XG4gICAgICB9XG4gICAgICAvLyBhY2Nlc3MgcHJvdmlkZXJzXG4gICAgICBpZiAodGhpcy5fZ2V0T3JDcmVhdGVMb2NhbFByb3ZpZGVyKHJlcXVlc3RpbmdQcm92aWRlclR5cGUsIGRlcC50b2tlbiwgZWFnZXIpICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGRlcDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9nZXREZXBlbmRlbmN5KFxuICAgICAgcmVxdWVzdGluZ1Byb3ZpZGVyVHlwZTogUHJvdmlkZXJBc3RUeXBlLCBkZXA6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSxcbiAgICAgIGVhZ2VyOiBib29sZWFuID0gZmFsc2UpOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGF8bnVsbCB7XG4gICAgbGV0IGN1cnJFbGVtZW50OiBQcm92aWRlckVsZW1lbnRDb250ZXh0ID0gdGhpcztcbiAgICBsZXQgY3VyckVhZ2VyOiBib29sZWFuID0gZWFnZXI7XG4gICAgbGV0IHJlc3VsdDogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhfG51bGwgPSBudWxsO1xuICAgIGlmICghZGVwLmlzU2tpcFNlbGYpIHtcbiAgICAgIHJlc3VsdCA9IHRoaXMuX2dldExvY2FsRGVwZW5kZW5jeShyZXF1ZXN0aW5nUHJvdmlkZXJUeXBlLCBkZXAsIGVhZ2VyKTtcbiAgICB9XG4gICAgaWYgKGRlcC5pc1NlbGYpIHtcbiAgICAgIGlmICghcmVzdWx0ICYmIGRlcC5pc09wdGlvbmFsKSB7XG4gICAgICAgIHJlc3VsdCA9IHtpc1ZhbHVlOiB0cnVlLCB2YWx1ZTogbnVsbH07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNoZWNrIHBhcmVudCBlbGVtZW50c1xuICAgICAgd2hpbGUgKCFyZXN1bHQgJiYgY3VyckVsZW1lbnQuX3BhcmVudCkge1xuICAgICAgICBjb25zdCBwcmV2RWxlbWVudCA9IGN1cnJFbGVtZW50O1xuICAgICAgICBjdXJyRWxlbWVudCA9IGN1cnJFbGVtZW50Ll9wYXJlbnQ7XG4gICAgICAgIGlmIChwcmV2RWxlbWVudC5faXNWaWV3Um9vdCkge1xuICAgICAgICAgIGN1cnJFYWdlciA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCA9IGN1cnJFbGVtZW50Ll9nZXRMb2NhbERlcGVuZGVuY3koUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UsIGRlcCwgY3VyckVhZ2VyKTtcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIEBIb3N0IHJlc3RyaWN0aW9uXG4gICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICBpZiAoIWRlcC5pc0hvc3QgfHwgdGhpcy52aWV3Q29udGV4dC5jb21wb25lbnQuaXNIb3N0IHx8XG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LmNvbXBvbmVudC50eXBlLnJlZmVyZW5jZSA9PT0gdG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuICEpIHx8XG4gICAgICAgICAgICB0aGlzLnZpZXdDb250ZXh0LnZpZXdQcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbiAhKSkgIT0gbnVsbCkge1xuICAgICAgICAgIHJlc3VsdCA9IGRlcDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSBkZXAuaXNPcHRpb25hbCA/IHtpc1ZhbHVlOiB0cnVlLCB2YWx1ZTogbnVsbH0gOiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICB0aGlzLnZpZXdDb250ZXh0LmVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQcm92aWRlckVycm9yKGBObyBwcm92aWRlciBmb3IgJHt0b2tlbk5hbWUoZGVwLnRva2VuISl9YCwgdGhpcy5fc291cmNlU3BhbikpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIE5nTW9kdWxlUHJvdmlkZXJBbmFseXplciB7XG4gIHByaXZhdGUgX3RyYW5zZm9ybWVkUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIFByb3ZpZGVyQXN0PigpO1xuICBwcml2YXRlIF9zZWVuUHJvdmlkZXJzID0gbmV3IE1hcDxhbnksIGJvb2xlYW4+KCk7XG4gIHByaXZhdGUgX2FsbFByb3ZpZGVyczogTWFwPGFueSwgUHJvdmlkZXJBc3Q+O1xuICBwcml2YXRlIF9lcnJvcnM6IFByb3ZpZGVyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsIG5nTW9kdWxlOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSxcbiAgICAgIGV4dHJhUHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICB0aGlzLl9hbGxQcm92aWRlcnMgPSBuZXcgTWFwPGFueSwgUHJvdmlkZXJBc3Q+KCk7XG4gICAgbmdNb2R1bGUudHJhbnNpdGl2ZU1vZHVsZS5tb2R1bGVzLmZvckVhY2goKG5nTW9kdWxlVHlwZTogQ29tcGlsZVR5cGVNZXRhZGF0YSkgPT4ge1xuICAgICAgY29uc3QgbmdNb2R1bGVQcm92aWRlciA9IHt0b2tlbjoge2lkZW50aWZpZXI6IG5nTW9kdWxlVHlwZX0sIHVzZUNsYXNzOiBuZ01vZHVsZVR5cGV9O1xuICAgICAgX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgICAgICAgW25nTW9kdWxlUHJvdmlkZXJdLCBQcm92aWRlckFzdFR5cGUuUHVibGljU2VydmljZSwgdHJ1ZSwgc291cmNlU3BhbiwgdGhpcy5fZXJyb3JzLFxuICAgICAgICAgIHRoaXMuX2FsbFByb3ZpZGVycywgLyogaXNNb2R1bGUgKi8gdHJ1ZSk7XG4gICAgfSk7XG4gICAgX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgICAgIG5nTW9kdWxlLnRyYW5zaXRpdmVNb2R1bGUucHJvdmlkZXJzLm1hcChlbnRyeSA9PiBlbnRyeS5wcm92aWRlcikuY29uY2F0KGV4dHJhUHJvdmlkZXJzKSxcbiAgICAgICAgUHJvdmlkZXJBc3RUeXBlLlB1YmxpY1NlcnZpY2UsIGZhbHNlLCBzb3VyY2VTcGFuLCB0aGlzLl9lcnJvcnMsIHRoaXMuX2FsbFByb3ZpZGVycyxcbiAgICAgICAgLyogaXNNb2R1bGUgKi8gZmFsc2UpO1xuICB9XG5cbiAgcGFyc2UoKTogUHJvdmlkZXJBc3RbXSB7XG4gICAgQXJyYXkuZnJvbSh0aGlzLl9hbGxQcm92aWRlcnMudmFsdWVzKCkpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICB0aGlzLl9nZXRPckNyZWF0ZUxvY2FsUHJvdmlkZXIocHJvdmlkZXIudG9rZW4sIHByb3ZpZGVyLmVhZ2VyKTtcbiAgICB9KTtcbiAgICBpZiAodGhpcy5fZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGVycm9yU3RyaW5nID0gdGhpcy5fZXJyb3JzLmpvaW4oJ1xcbicpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm92aWRlciBwYXJzZSBlcnJvcnM6XFxuJHtlcnJvclN0cmluZ31gKTtcbiAgICB9XG4gICAgLy8gTm90ZTogTWFwcyBrZWVwIHRoZWlyIGluc2VydGlvbiBvcmRlci5cbiAgICBjb25zdCBsYXp5UHJvdmlkZXJzOiBQcm92aWRlckFzdFtdID0gW107XG4gICAgY29uc3QgZWFnZXJQcm92aWRlcnM6IFByb3ZpZGVyQXN0W10gPSBbXTtcbiAgICB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5mb3JFYWNoKHByb3ZpZGVyID0+IHtcbiAgICAgIGlmIChwcm92aWRlci5lYWdlcikge1xuICAgICAgICBlYWdlclByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxhenlQcm92aWRlcnMucHVzaChwcm92aWRlcik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGxhenlQcm92aWRlcnMuY29uY2F0KGVhZ2VyUHJvdmlkZXJzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcih0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEsIGVhZ2VyOiBib29sZWFuKTogUHJvdmlkZXJBc3R8bnVsbCB7XG4gICAgY29uc3QgcmVzb2x2ZWRQcm92aWRlciA9IHRoaXMuX2FsbFByb3ZpZGVycy5nZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pKTtcbiAgICBpZiAoIXJlc29sdmVkUHJvdmlkZXIpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBsZXQgdHJhbnNmb3JtZWRQcm92aWRlckFzdCA9IHRoaXMuX3RyYW5zZm9ybWVkUHJvdmlkZXJzLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpO1xuICAgIGlmICh0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0KSB7XG4gICAgICByZXR1cm4gdHJhbnNmb3JtZWRQcm92aWRlckFzdDtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3NlZW5Qcm92aWRlcnMuZ2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSkgIT0gbnVsbCkge1xuICAgICAgdGhpcy5fZXJyb3JzLnB1c2gobmV3IFByb3ZpZGVyRXJyb3IoXG4gICAgICAgICAgYENhbm5vdCBpbnN0YW50aWF0ZSBjeWNsaWMgZGVwZW5kZW5jeSEgJHt0b2tlbk5hbWUodG9rZW4pfWAsXG4gICAgICAgICAgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5fc2VlblByb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCB0cnVlKTtcbiAgICBjb25zdCB0cmFuc2Zvcm1lZFByb3ZpZGVycyA9IHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJzLm1hcCgocHJvdmlkZXIpID0+IHtcbiAgICAgIGxldCB0cmFuc2Zvcm1lZFVzZVZhbHVlID0gcHJvdmlkZXIudXNlVmFsdWU7XG4gICAgICBsZXQgdHJhbnNmb3JtZWRVc2VFeGlzdGluZyA9IHByb3ZpZGVyLnVzZUV4aXN0aW5nICE7XG4gICAgICBsZXQgdHJhbnNmb3JtZWREZXBzOiBDb21waWxlRGlEZXBlbmRlbmN5TWV0YWRhdGFbXSA9IHVuZGVmaW5lZCAhO1xuICAgICAgaWYgKHByb3ZpZGVyLnVzZUV4aXN0aW5nICE9IG51bGwpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdEaURlcCA9XG4gICAgICAgICAgICB0aGlzLl9nZXREZXBlbmRlbmN5KHt0b2tlbjogcHJvdmlkZXIudXNlRXhpc3Rpbmd9LCBlYWdlciwgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nRGlEZXAudG9rZW4gIT0gbnVsbCkge1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlRXhpc3RpbmcgPSBleGlzdGluZ0RpRGVwLnRva2VuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyYW5zZm9ybWVkVXNlRXhpc3RpbmcgPSBudWxsICE7XG4gICAgICAgICAgdHJhbnNmb3JtZWRVc2VWYWx1ZSA9IGV4aXN0aW5nRGlEZXAudmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocHJvdmlkZXIudXNlRmFjdG9yeSkge1xuICAgICAgICBjb25zdCBkZXBzID0gcHJvdmlkZXIuZGVwcyB8fCBwcm92aWRlci51c2VGYWN0b3J5LmRpRGVwcztcbiAgICAgICAgdHJhbnNmb3JtZWREZXBzID1cbiAgICAgICAgICAgIGRlcHMubWFwKChkZXApID0+IHRoaXMuX2dldERlcGVuZGVuY3koZGVwLCBlYWdlciwgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKSk7XG4gICAgICB9IGVsc2UgaWYgKHByb3ZpZGVyLnVzZUNsYXNzKSB7XG4gICAgICAgIGNvbnN0IGRlcHMgPSBwcm92aWRlci5kZXBzIHx8IHByb3ZpZGVyLnVzZUNsYXNzLmRpRGVwcztcbiAgICAgICAgdHJhbnNmb3JtZWREZXBzID1cbiAgICAgICAgICAgIGRlcHMubWFwKChkZXApID0+IHRoaXMuX2dldERlcGVuZGVuY3koZGVwLCBlYWdlciwgcmVzb2x2ZWRQcm92aWRlci5zb3VyY2VTcGFuKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3RyYW5zZm9ybVByb3ZpZGVyKHByb3ZpZGVyLCB7XG4gICAgICAgIHVzZUV4aXN0aW5nOiB0cmFuc2Zvcm1lZFVzZUV4aXN0aW5nLFxuICAgICAgICB1c2VWYWx1ZTogdHJhbnNmb3JtZWRVc2VWYWx1ZSxcbiAgICAgICAgZGVwczogdHJhbnNmb3JtZWREZXBzXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0ID1cbiAgICAgICAgX3RyYW5zZm9ybVByb3ZpZGVyQXN0KHJlc29sdmVkUHJvdmlkZXIsIHtlYWdlcjogZWFnZXIsIHByb3ZpZGVyczogdHJhbnNmb3JtZWRQcm92aWRlcnN9KTtcbiAgICB0aGlzLl90cmFuc2Zvcm1lZFByb3ZpZGVycy5zZXQodG9rZW5SZWZlcmVuY2UodG9rZW4pLCB0cmFuc2Zvcm1lZFByb3ZpZGVyQXN0KTtcbiAgICByZXR1cm4gdHJhbnNmb3JtZWRQcm92aWRlckFzdDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldERlcGVuZGVuY3koXG4gICAgICBkZXA6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSwgZWFnZXI6IGJvb2xlYW4gPSBmYWxzZSxcbiAgICAgIHJlcXVlc3RvclNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSB7XG4gICAgbGV0IGZvdW5kTG9jYWwgPSBmYWxzZTtcbiAgICBpZiAoIWRlcC5pc1NraXBTZWxmICYmIGRlcC50b2tlbiAhPSBudWxsKSB7XG4gICAgICAvLyBhY2Nlc3MgdGhlIGluamVjdG9yXG4gICAgICBpZiAodG9rZW5SZWZlcmVuY2UoZGVwLnRva2VuKSA9PT1cbiAgICAgICAgICAgICAgdGhpcy5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLkluamVjdG9yKSB8fFxuICAgICAgICAgIHRva2VuUmVmZXJlbmNlKGRlcC50b2tlbikgPT09XG4gICAgICAgICAgICAgIHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5Db21wb25lbnRGYWN0b3J5UmVzb2x2ZXIpKSB7XG4gICAgICAgIGZvdW5kTG9jYWwgPSB0cnVlO1xuICAgICAgICAvLyBhY2Nlc3MgcHJvdmlkZXJzXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2dldE9yQ3JlYXRlTG9jYWxQcm92aWRlcihkZXAudG9rZW4sIGVhZ2VyKSAhPSBudWxsKSB7XG4gICAgICAgIGZvdW5kTG9jYWwgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVwO1xuICB9XG59XG5cbmZ1bmN0aW9uIF90cmFuc2Zvcm1Qcm92aWRlcihcbiAgICBwcm92aWRlcjogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEsXG4gICAge3VzZUV4aXN0aW5nLCB1c2VWYWx1ZSwgZGVwc306XG4gICAgICAgIHt1c2VFeGlzdGluZzogQ29tcGlsZVRva2VuTWV0YWRhdGEsIHVzZVZhbHVlOiBhbnksIGRlcHM6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YVtdfSkge1xuICByZXR1cm4ge1xuICAgIHRva2VuOiBwcm92aWRlci50b2tlbixcbiAgICB1c2VDbGFzczogcHJvdmlkZXIudXNlQ2xhc3MsXG4gICAgdXNlRXhpc3Rpbmc6IHVzZUV4aXN0aW5nLFxuICAgIHVzZUZhY3Rvcnk6IHByb3ZpZGVyLnVzZUZhY3RvcnksXG4gICAgdXNlVmFsdWU6IHVzZVZhbHVlLFxuICAgIGRlcHM6IGRlcHMsXG4gICAgbXVsdGk6IHByb3ZpZGVyLm11bHRpXG4gIH07XG59XG5cbmZ1bmN0aW9uIF90cmFuc2Zvcm1Qcm92aWRlckFzdChcbiAgICBwcm92aWRlcjogUHJvdmlkZXJBc3QsXG4gICAge2VhZ2VyLCBwcm92aWRlcnN9OiB7ZWFnZXI6IGJvb2xlYW4sIHByb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXX0pOiBQcm92aWRlckFzdCB7XG4gIHJldHVybiBuZXcgUHJvdmlkZXJBc3QoXG4gICAgICBwcm92aWRlci50b2tlbiwgcHJvdmlkZXIubXVsdGlQcm92aWRlciwgcHJvdmlkZXIuZWFnZXIgfHwgZWFnZXIsIHByb3ZpZGVycyxcbiAgICAgIHByb3ZpZGVyLnByb3ZpZGVyVHlwZSwgcHJvdmlkZXIubGlmZWN5Y2xlSG9va3MsIHByb3ZpZGVyLnNvdXJjZVNwYW4sIHByb3ZpZGVyLmlzTW9kdWxlKTtcbn1cblxuZnVuY3Rpb24gX3Jlc29sdmVQcm92aWRlcnNGcm9tRGlyZWN0aXZlcyhcbiAgICBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgdGFyZ2V0RXJyb3JzOiBQYXJzZUVycm9yW10pOiBNYXA8YW55LCBQcm92aWRlckFzdD4ge1xuICBjb25zdCBwcm92aWRlcnNCeVRva2VuID0gbmV3IE1hcDxhbnksIFByb3ZpZGVyQXN0PigpO1xuICBkaXJlY3RpdmVzLmZvckVhY2goKGRpcmVjdGl2ZSkgPT4ge1xuICAgIGNvbnN0IGRpclByb3ZpZGVyOlxuICAgICAgICBDb21waWxlUHJvdmlkZXJNZXRhZGF0YSA9IHt0b2tlbjoge2lkZW50aWZpZXI6IGRpcmVjdGl2ZS50eXBlfSwgdXNlQ2xhc3M6IGRpcmVjdGl2ZS50eXBlfTtcbiAgICBfcmVzb2x2ZVByb3ZpZGVycyhcbiAgICAgICAgW2RpclByb3ZpZGVyXSxcbiAgICAgICAgZGlyZWN0aXZlLmlzQ29tcG9uZW50ID8gUHJvdmlkZXJBc3RUeXBlLkNvbXBvbmVudCA6IFByb3ZpZGVyQXN0VHlwZS5EaXJlY3RpdmUsIHRydWUsXG4gICAgICAgIHNvdXJjZVNwYW4sIHRhcmdldEVycm9ycywgcHJvdmlkZXJzQnlUb2tlbiwgLyogaXNNb2R1bGUgKi8gZmFsc2UpO1xuICB9KTtcblxuICAvLyBOb3RlOiBkaXJlY3RpdmVzIG5lZWQgdG8gYmUgYWJsZSB0byBvdmVyd3JpdGUgcHJvdmlkZXJzIG9mIGEgY29tcG9uZW50IVxuICBjb25zdCBkaXJlY3RpdmVzV2l0aENvbXBvbmVudEZpcnN0ID1cbiAgICAgIGRpcmVjdGl2ZXMuZmlsdGVyKGRpciA9PiBkaXIuaXNDb21wb25lbnQpLmNvbmNhdChkaXJlY3RpdmVzLmZpbHRlcihkaXIgPT4gIWRpci5pc0NvbXBvbmVudCkpO1xuICBkaXJlY3RpdmVzV2l0aENvbXBvbmVudEZpcnN0LmZvckVhY2goKGRpcmVjdGl2ZSkgPT4ge1xuICAgIF9yZXNvbHZlUHJvdmlkZXJzKFxuICAgICAgICBkaXJlY3RpdmUucHJvdmlkZXJzLCBQcm92aWRlckFzdFR5cGUuUHVibGljU2VydmljZSwgZmFsc2UsIHNvdXJjZVNwYW4sIHRhcmdldEVycm9ycyxcbiAgICAgICAgcHJvdmlkZXJzQnlUb2tlbiwgLyogaXNNb2R1bGUgKi8gZmFsc2UpO1xuICAgIF9yZXNvbHZlUHJvdmlkZXJzKFxuICAgICAgICBkaXJlY3RpdmUudmlld1Byb3ZpZGVycywgUHJvdmlkZXJBc3RUeXBlLlByaXZhdGVTZXJ2aWNlLCBmYWxzZSwgc291cmNlU3BhbiwgdGFyZ2V0RXJyb3JzLFxuICAgICAgICBwcm92aWRlcnNCeVRva2VuLCAvKiBpc01vZHVsZSAqLyBmYWxzZSk7XG4gIH0pO1xuICByZXR1cm4gcHJvdmlkZXJzQnlUb2tlbjtcbn1cblxuZnVuY3Rpb24gX3Jlc29sdmVQcm92aWRlcnMoXG4gICAgcHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdLCBwcm92aWRlclR5cGU6IFByb3ZpZGVyQXN0VHlwZSwgZWFnZXI6IGJvb2xlYW4sXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB0YXJnZXRFcnJvcnM6IFBhcnNlRXJyb3JbXSxcbiAgICB0YXJnZXRQcm92aWRlcnNCeVRva2VuOiBNYXA8YW55LCBQcm92aWRlckFzdD4sIGlzTW9kdWxlOiBib29sZWFuKSB7XG4gIHByb3ZpZGVycy5mb3JFYWNoKChwcm92aWRlcikgPT4ge1xuICAgIGxldCByZXNvbHZlZFByb3ZpZGVyID0gdGFyZ2V0UHJvdmlkZXJzQnlUb2tlbi5nZXQodG9rZW5SZWZlcmVuY2UocHJvdmlkZXIudG9rZW4pKTtcbiAgICBpZiAocmVzb2x2ZWRQcm92aWRlciAhPSBudWxsICYmICEhcmVzb2x2ZWRQcm92aWRlci5tdWx0aVByb3ZpZGVyICE9PSAhIXByb3ZpZGVyLm11bHRpKSB7XG4gICAgICB0YXJnZXRFcnJvcnMucHVzaChuZXcgUHJvdmlkZXJFcnJvcihcbiAgICAgICAgICBgTWl4aW5nIG11bHRpIGFuZCBub24gbXVsdGkgcHJvdmlkZXIgaXMgbm90IHBvc3NpYmxlIGZvciB0b2tlbiAke1xuICAgICAgICAgICAgICB0b2tlbk5hbWUocmVzb2x2ZWRQcm92aWRlci50b2tlbil9YCxcbiAgICAgICAgICBzb3VyY2VTcGFuKSk7XG4gICAgfVxuICAgIGlmICghcmVzb2x2ZWRQcm92aWRlcikge1xuICAgICAgY29uc3QgbGlmZWN5Y2xlSG9va3MgPSBwcm92aWRlci50b2tlbi5pZGVudGlmaWVyICYmXG4gICAgICAgICAgICAgICg8Q29tcGlsZVR5cGVNZXRhZGF0YT5wcm92aWRlci50b2tlbi5pZGVudGlmaWVyKS5saWZlY3ljbGVIb29rcyA/XG4gICAgICAgICAgKDxDb21waWxlVHlwZU1ldGFkYXRhPnByb3ZpZGVyLnRva2VuLmlkZW50aWZpZXIpLmxpZmVjeWNsZUhvb2tzIDpcbiAgICAgICAgICBbXTtcbiAgICAgIGNvbnN0IGlzVXNlVmFsdWUgPSAhKHByb3ZpZGVyLnVzZUNsYXNzIHx8IHByb3ZpZGVyLnVzZUV4aXN0aW5nIHx8IHByb3ZpZGVyLnVzZUZhY3RvcnkpO1xuICAgICAgcmVzb2x2ZWRQcm92aWRlciA9IG5ldyBQcm92aWRlckFzdChcbiAgICAgICAgICBwcm92aWRlci50b2tlbiwgISFwcm92aWRlci5tdWx0aSwgZWFnZXIgfHwgaXNVc2VWYWx1ZSwgW3Byb3ZpZGVyXSwgcHJvdmlkZXJUeXBlLFxuICAgICAgICAgIGxpZmVjeWNsZUhvb2tzLCBzb3VyY2VTcGFuLCBpc01vZHVsZSk7XG4gICAgICB0YXJnZXRQcm92aWRlcnNCeVRva2VuLnNldCh0b2tlblJlZmVyZW5jZShwcm92aWRlci50b2tlbiksIHJlc29sdmVkUHJvdmlkZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXByb3ZpZGVyLm11bHRpKSB7XG4gICAgICAgIHJlc29sdmVkUHJvdmlkZXIucHJvdmlkZXJzLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICByZXNvbHZlZFByb3ZpZGVyLnByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcbiAgICB9XG4gIH0pO1xufVxuXG5cbmZ1bmN0aW9uIF9nZXRWaWV3UXVlcmllcyhjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSk6IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+IHtcbiAgLy8gTm90ZTogcXVlcmllcyBzdGFydCB3aXRoIGlkIDEgc28gd2UgY2FuIHVzZSB0aGUgbnVtYmVyIGluIGEgQmxvb20gZmlsdGVyIVxuICBsZXQgdmlld1F1ZXJ5SWQgPSAxO1xuICBjb25zdCB2aWV3UXVlcmllcyA9IG5ldyBNYXA8YW55LCBRdWVyeVdpdGhJZFtdPigpO1xuICBpZiAoY29tcG9uZW50LnZpZXdRdWVyaWVzKSB7XG4gICAgY29tcG9uZW50LnZpZXdRdWVyaWVzLmZvckVhY2goXG4gICAgICAgIChxdWVyeSkgPT4gX2FkZFF1ZXJ5VG9Ub2tlbk1hcCh2aWV3UXVlcmllcywge21ldGE6IHF1ZXJ5LCBxdWVyeUlkOiB2aWV3UXVlcnlJZCsrfSkpO1xuICB9XG4gIHJldHVybiB2aWV3UXVlcmllcztcbn1cblxuZnVuY3Rpb24gX2dldENvbnRlbnRRdWVyaWVzKFxuICAgIGNvbnRlbnRRdWVyeVN0YXJ0SWQ6IG51bWJlciwgZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSk6IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+IHtcbiAgbGV0IGNvbnRlbnRRdWVyeUlkID0gY29udGVudFF1ZXJ5U3RhcnRJZDtcbiAgY29uc3QgY29udGVudFF1ZXJpZXMgPSBuZXcgTWFwPGFueSwgUXVlcnlXaXRoSWRbXT4oKTtcbiAgZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJlY3RpdmUsIGRpcmVjdGl2ZUluZGV4KSA9PiB7XG4gICAgaWYgKGRpcmVjdGl2ZS5xdWVyaWVzKSB7XG4gICAgICBkaXJlY3RpdmUucXVlcmllcy5mb3JFYWNoKFxuICAgICAgICAgIChxdWVyeSkgPT4gX2FkZFF1ZXJ5VG9Ub2tlbk1hcChjb250ZW50UXVlcmllcywge21ldGE6IHF1ZXJ5LCBxdWVyeUlkOiBjb250ZW50UXVlcnlJZCsrfSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBjb250ZW50UXVlcmllcztcbn1cblxuZnVuY3Rpb24gX2FkZFF1ZXJ5VG9Ub2tlbk1hcChtYXA6IE1hcDxhbnksIFF1ZXJ5V2l0aElkW10+LCBxdWVyeTogUXVlcnlXaXRoSWQpIHtcbiAgcXVlcnkubWV0YS5zZWxlY3RvcnMuZm9yRWFjaCgodG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhKSA9PiB7XG4gICAgbGV0IGVudHJ5ID0gbWFwLmdldCh0b2tlblJlZmVyZW5jZSh0b2tlbikpO1xuICAgIGlmICghZW50cnkpIHtcbiAgICAgIGVudHJ5ID0gW107XG4gICAgICBtYXAuc2V0KHRva2VuUmVmZXJlbmNlKHRva2VuKSwgZW50cnkpO1xuICAgIH1cbiAgICBlbnRyeS5wdXNoKHF1ZXJ5KTtcbiAgfSk7XG59XG4iXX0=