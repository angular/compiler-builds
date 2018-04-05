/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
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
    /**
     * @param {?} message
     * @param {?} span
     */
    constructor(message, span) { super(span, message); }
}
/**
 * @record
 */
export function QueryWithId() { }
function QueryWithId_tsickle_Closure_declarations() {
    /** @type {?} */
    QueryWithId.prototype.meta;
    /** @type {?} */
    QueryWithId.prototype.queryId;
}
export class ProviderViewContext {
    /**
     * @param {?} reflector
     * @param {?} component
     */
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
function ProviderViewContext_tsickle_Closure_declarations() {
    /**
     * \@internal
     * @type {?}
     */
    ProviderViewContext.prototype.viewQueries;
    /**
     * \@internal
     * @type {?}
     */
    ProviderViewContext.prototype.viewProviders;
    /** @type {?} */
    ProviderViewContext.prototype.errors;
    /** @type {?} */
    ProviderViewContext.prototype.reflector;
    /** @type {?} */
    ProviderViewContext.prototype.component;
}
export class ProviderElementContext {
    /**
     * @param {?} viewContext
     * @param {?} _parent
     * @param {?} _isViewRoot
     * @param {?} _directiveAsts
     * @param {?} attrs
     * @param {?} refs
     * @param {?} isTemplate
     * @param {?} contentQueryStartId
     * @param {?} _sourceSpan
     */
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
        const /** @type {?} */ directivesMeta = _directiveAsts.map(directiveAst => directiveAst.directive);
        this._allProviders =
            _resolveProvidersFromDirectives(directivesMeta, _sourceSpan, viewContext.errors);
        this._contentQueries = _getContentQueries(contentQueryStartId, directivesMeta);
        Array.from(this._allProviders.values()).forEach((provider) => {
            this._addQueryReadsTo(provider.token, provider.token, this._queriedTokens);
        });
        if (isTemplate) {
            const /** @type {?} */ templateRefId = createTokenForExternalReference(this.viewContext.reflector, Identifiers.TemplateRef);
            this._addQueryReadsTo(templateRefId, templateRefId, this._queriedTokens);
        }
        refs.forEach((refAst) => {
            let /** @type {?} */ defaultQueryValue = refAst.value ||
                createTokenForExternalReference(this.viewContext.reflector, Identifiers.ElementRef);
            this._addQueryReadsTo({ value: refAst.name }, defaultQueryValue, this._queriedTokens);
        });
        if (this._queriedTokens.get(this.viewContext.reflector.resolveExternalReference(Identifiers.ViewContainerRef))) {
            this.transformedHasViewContainer = true;
        }
        // create the providers that we know are eager first
        Array.from(this._allProviders.values()).forEach((provider) => {
            const /** @type {?} */ eager = provider.eager || this._queriedTokens.get(tokenReference(provider.token));
            if (eager) {
                this._getOrCreateLocalProvider(provider.providerType, provider.token, true);
            }
        });
    }
    /**
     * @return {?}
     */
    afterElement() {
        // collect lazy providers
        Array.from(this._allProviders.values()).forEach((provider) => {
            this._getOrCreateLocalProvider(provider.providerType, provider.token, false);
        });
    }
    /**
     * @return {?}
     */
    get transformProviders() {
        // Note: Maps keep their insertion order.
        const /** @type {?} */ lazyProviders = [];
        const /** @type {?} */ eagerProviders = [];
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
    /**
     * @return {?}
     */
    get transformedDirectiveAsts() {
        const /** @type {?} */ sortedProviderTypes = this.transformProviders.map(provider => provider.token.identifier);
        const /** @type {?} */ sortedDirectives = this._directiveAsts.slice();
        sortedDirectives.sort((dir1, dir2) => sortedProviderTypes.indexOf(dir1.directive.type) -
            sortedProviderTypes.indexOf(dir2.directive.type));
        return sortedDirectives;
    }
    /**
     * @return {?}
     */
    get queryMatches() {
        const /** @type {?} */ allMatches = [];
        this._queriedTokens.forEach((matches) => { allMatches.push(...matches); });
        return allMatches;
    }
    /**
     * @param {?} token
     * @param {?} defaultValue
     * @param {?} queryReadTokens
     * @return {?}
     */
    _addQueryReadsTo(token, defaultValue, queryReadTokens) {
        this._getQueriesFor(token).forEach((query) => {
            const /** @type {?} */ queryValue = query.meta.read || defaultValue;
            const /** @type {?} */ tokenRef = tokenReference(queryValue);
            let /** @type {?} */ queryMatches = queryReadTokens.get(tokenRef);
            if (!queryMatches) {
                queryMatches = [];
                queryReadTokens.set(tokenRef, queryMatches);
            }
            queryMatches.push({ queryId: query.queryId, value: queryValue });
        });
    }
    /**
     * @param {?} token
     * @return {?}
     */
    _getQueriesFor(token) {
        const /** @type {?} */ result = [];
        let /** @type {?} */ currentEl = this;
        let /** @type {?} */ distance = 0;
        let /** @type {?} */ queries;
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
    /**
     * @param {?} requestingProviderType
     * @param {?} token
     * @param {?} eager
     * @return {?}
     */
    _getOrCreateLocalProvider(requestingProviderType, token, eager) {
        const /** @type {?} */ resolvedProvider = this._allProviders.get(tokenReference(token));
        if (!resolvedProvider || ((requestingProviderType === ProviderAstType.Directive ||
            requestingProviderType === ProviderAstType.PublicService) &&
            resolvedProvider.providerType === ProviderAstType.PrivateService) ||
            ((requestingProviderType === ProviderAstType.PrivateService ||
                requestingProviderType === ProviderAstType.PublicService) &&
                resolvedProvider.providerType === ProviderAstType.Builtin)) {
            return null;
        }
        let /** @type {?} */ transformedProviderAst = this._transformedProviders.get(tokenReference(token));
        if (transformedProviderAst) {
            return transformedProviderAst;
        }
        if (this._seenProviders.get(tokenReference(token)) != null) {
            this.viewContext.errors.push(new ProviderError(`Cannot instantiate cyclic dependency! ${tokenName(token)}`, this._sourceSpan));
            return null;
        }
        this._seenProviders.set(tokenReference(token), true);
        const /** @type {?} */ transformedProviders = resolvedProvider.providers.map((provider) => {
            let /** @type {?} */ transformedUseValue = provider.useValue;
            let /** @type {?} */ transformedUseExisting = /** @type {?} */ ((provider.useExisting));
            let /** @type {?} */ transformedDeps = /** @type {?} */ ((undefined));
            if (provider.useExisting != null) {
                const /** @type {?} */ existingDiDep = /** @type {?} */ ((this._getDependency(resolvedProvider.providerType, { token: provider.useExisting }, eager)));
                if (existingDiDep.token != null) {
                    transformedUseExisting = existingDiDep.token;
                }
                else {
                    transformedUseExisting = /** @type {?} */ ((null));
                    transformedUseValue = existingDiDep.value;
                }
            }
            else if (provider.useFactory) {
                const /** @type {?} */ deps = provider.deps || provider.useFactory.diDeps;
                transformedDeps =
                    deps.map((dep) => /** @type {?} */ ((this._getDependency(resolvedProvider.providerType, dep, eager))));
            }
            else if (provider.useClass) {
                const /** @type {?} */ deps = provider.deps || provider.useClass.diDeps;
                transformedDeps =
                    deps.map((dep) => /** @type {?} */ ((this._getDependency(resolvedProvider.providerType, dep, eager))));
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
    /**
     * @param {?} requestingProviderType
     * @param {?} dep
     * @param {?=} eager
     * @return {?}
     */
    _getLocalDependency(requestingProviderType, dep, eager = false) {
        if (dep.isAttribute) {
            const /** @type {?} */ attrValue = this._attrs[/** @type {?} */ ((dep.token)).value];
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
                    (/** @type {?} */ (this)).transformedHasViewContainer = true;
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
    /**
     * @param {?} requestingProviderType
     * @param {?} dep
     * @param {?=} eager
     * @return {?}
     */
    _getDependency(requestingProviderType, dep, eager = false) {
        let /** @type {?} */ currElement = this;
        let /** @type {?} */ currEager = eager;
        let /** @type {?} */ result = null;
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
                const /** @type {?} */ prevElement = currElement;
                currElement = currElement._parent;
                if (prevElement._isViewRoot) {
                    currEager = false;
                }
                result = currElement._getLocalDependency(ProviderAstType.PublicService, dep, currEager);
            }
            // check @Host restriction
            if (!result) {
                if (!dep.isHost || this.viewContext.component.isHost ||
                    this.viewContext.component.type.reference === tokenReference(/** @type {?} */ ((dep.token))) ||
                    this.viewContext.viewProviders.get(tokenReference(/** @type {?} */ ((dep.token)))) != null) {
                    result = dep;
                }
                else {
                    result = dep.isOptional ? { isValue: true, value: null } : null;
                }
            }
        }
        if (!result) {
            this.viewContext.errors.push(new ProviderError(`No provider for ${tokenName((/** @type {?} */ ((dep.token))))}`, this._sourceSpan));
        }
        return result;
    }
}
function ProviderElementContext_tsickle_Closure_declarations() {
    /** @type {?} */
    ProviderElementContext.prototype._contentQueries;
    /** @type {?} */
    ProviderElementContext.prototype._transformedProviders;
    /** @type {?} */
    ProviderElementContext.prototype._seenProviders;
    /** @type {?} */
    ProviderElementContext.prototype._allProviders;
    /** @type {?} */
    ProviderElementContext.prototype._attrs;
    /** @type {?} */
    ProviderElementContext.prototype._queriedTokens;
    /** @type {?} */
    ProviderElementContext.prototype.transformedHasViewContainer;
    /** @type {?} */
    ProviderElementContext.prototype.viewContext;
    /** @type {?} */
    ProviderElementContext.prototype._parent;
    /** @type {?} */
    ProviderElementContext.prototype._isViewRoot;
    /** @type {?} */
    ProviderElementContext.prototype._directiveAsts;
    /** @type {?} */
    ProviderElementContext.prototype._sourceSpan;
}
export class NgModuleProviderAnalyzer {
    /**
     * @param {?} reflector
     * @param {?} ngModule
     * @param {?} extraProviders
     * @param {?} sourceSpan
     */
    constructor(reflector, ngModule, extraProviders, sourceSpan) {
        this.reflector = reflector;
        this._transformedProviders = new Map();
        this._seenProviders = new Map();
        this._errors = [];
        this._allProviders = new Map();
        ngModule.transitiveModule.modules.forEach((ngModuleType) => {
            const /** @type {?} */ ngModuleProvider = { token: { identifier: ngModuleType }, useClass: ngModuleType };
            _resolveProviders([ngModuleProvider], ProviderAstType.PublicService, true, sourceSpan, this._errors, this._allProviders, /* isModule */ /* isModule */ true);
        });
        _resolveProviders(ngModule.transitiveModule.providers.map(entry => entry.provider).concat(extraProviders), ProviderAstType.PublicService, false, sourceSpan, this._errors, this._allProviders, /* isModule */ false);
    }
    /**
     * @return {?}
     */
    parse() {
        Array.from(this._allProviders.values()).forEach((provider) => {
            this._getOrCreateLocalProvider(provider.token, provider.eager);
        });
        if (this._errors.length > 0) {
            const /** @type {?} */ errorString = this._errors.join('\n');
            throw new Error(`Provider parse errors:\n${errorString}`);
        }
        // Note: Maps keep their insertion order.
        const /** @type {?} */ lazyProviders = [];
        const /** @type {?} */ eagerProviders = [];
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
    /**
     * @param {?} token
     * @param {?} eager
     * @return {?}
     */
    _getOrCreateLocalProvider(token, eager) {
        const /** @type {?} */ resolvedProvider = this._allProviders.get(tokenReference(token));
        if (!resolvedProvider) {
            return null;
        }
        let /** @type {?} */ transformedProviderAst = this._transformedProviders.get(tokenReference(token));
        if (transformedProviderAst) {
            return transformedProviderAst;
        }
        if (this._seenProviders.get(tokenReference(token)) != null) {
            this._errors.push(new ProviderError(`Cannot instantiate cyclic dependency! ${tokenName(token)}`, resolvedProvider.sourceSpan));
            return null;
        }
        this._seenProviders.set(tokenReference(token), true);
        const /** @type {?} */ transformedProviders = resolvedProvider.providers.map((provider) => {
            let /** @type {?} */ transformedUseValue = provider.useValue;
            let /** @type {?} */ transformedUseExisting = /** @type {?} */ ((provider.useExisting));
            let /** @type {?} */ transformedDeps = /** @type {?} */ ((undefined));
            if (provider.useExisting != null) {
                const /** @type {?} */ existingDiDep = this._getDependency({ token: provider.useExisting }, eager, resolvedProvider.sourceSpan);
                if (existingDiDep.token != null) {
                    transformedUseExisting = existingDiDep.token;
                }
                else {
                    transformedUseExisting = /** @type {?} */ ((null));
                    transformedUseValue = existingDiDep.value;
                }
            }
            else if (provider.useFactory) {
                const /** @type {?} */ deps = provider.deps || provider.useFactory.diDeps;
                transformedDeps =
                    deps.map((dep) => this._getDependency(dep, eager, resolvedProvider.sourceSpan));
            }
            else if (provider.useClass) {
                const /** @type {?} */ deps = provider.deps || provider.useClass.diDeps;
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
    /**
     * @param {?} dep
     * @param {?=} eager
     * @param {?=} requestorSourceSpan
     * @return {?}
     */
    _getDependency(dep, eager = false, requestorSourceSpan) {
        let /** @type {?} */ foundLocal = false;
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
function NgModuleProviderAnalyzer_tsickle_Closure_declarations() {
    /** @type {?} */
    NgModuleProviderAnalyzer.prototype._transformedProviders;
    /** @type {?} */
    NgModuleProviderAnalyzer.prototype._seenProviders;
    /** @type {?} */
    NgModuleProviderAnalyzer.prototype._allProviders;
    /** @type {?} */
    NgModuleProviderAnalyzer.prototype._errors;
    /** @type {?} */
    NgModuleProviderAnalyzer.prototype.reflector;
}
/**
 * @param {?} provider
 * @param {?} __1
 * @return {?}
 */
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
/**
 * @param {?} provider
 * @param {?} __1
 * @return {?}
 */
function _transformProviderAst(provider, { eager, providers }) {
    return new ProviderAst(provider.token, provider.multiProvider, provider.eager || eager, providers, provider.providerType, provider.lifecycleHooks, provider.sourceSpan, provider.isModule);
}
/**
 * @param {?} directives
 * @param {?} sourceSpan
 * @param {?} targetErrors
 * @return {?}
 */
function _resolveProvidersFromDirectives(directives, sourceSpan, targetErrors) {
    const /** @type {?} */ providersByToken = new Map();
    directives.forEach((directive) => {
        const /** @type {?} */ dirProvider = { token: { identifier: directive.type }, useClass: directive.type };
        _resolveProviders([dirProvider], directive.isComponent ? ProviderAstType.Component : ProviderAstType.Directive, true, sourceSpan, targetErrors, providersByToken, /* isModule */ /* isModule */ false);
    });
    // Note: directives need to be able to overwrite providers of a component!
    const /** @type {?} */ directivesWithComponentFirst = directives.filter(dir => dir.isComponent).concat(directives.filter(dir => !dir.isComponent));
    directivesWithComponentFirst.forEach((directive) => {
        _resolveProviders(directive.providers, ProviderAstType.PublicService, false, sourceSpan, targetErrors, providersByToken, /* isModule */ /* isModule */ false);
        _resolveProviders(directive.viewProviders, ProviderAstType.PrivateService, false, sourceSpan, targetErrors, providersByToken, /* isModule */ /* isModule */ false);
    });
    return providersByToken;
}
/**
 * @param {?} providers
 * @param {?} providerType
 * @param {?} eager
 * @param {?} sourceSpan
 * @param {?} targetErrors
 * @param {?} targetProvidersByToken
 * @param {?} isModule
 * @return {?}
 */
function _resolveProviders(providers, providerType, eager, sourceSpan, targetErrors, targetProvidersByToken, isModule) {
    providers.forEach((provider) => {
        let /** @type {?} */ resolvedProvider = targetProvidersByToken.get(tokenReference(provider.token));
        if (resolvedProvider != null && !!resolvedProvider.multiProvider !== !!provider.multi) {
            targetErrors.push(new ProviderError(`Mixing multi and non multi provider is not possible for token ${tokenName(resolvedProvider.token)}`, sourceSpan));
        }
        if (!resolvedProvider) {
            const /** @type {?} */ lifecycleHooks = provider.token.identifier &&
                (/** @type {?} */ (provider.token.identifier)).lifecycleHooks ?
                (/** @type {?} */ (provider.token.identifier)).lifecycleHooks :
                [];
            const /** @type {?} */ isUseValue = !(provider.useClass || provider.useExisting || provider.useFactory);
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
/**
 * @param {?} component
 * @return {?}
 */
function _getViewQueries(component) {
    // Note: queries start with id 1 so we can use the number in a Bloom filter!
    let /** @type {?} */ viewQueryId = 1;
    const /** @type {?} */ viewQueries = new Map();
    if (component.viewQueries) {
        component.viewQueries.forEach((query) => _addQueryToTokenMap(viewQueries, { meta: query, queryId: viewQueryId++ }));
    }
    return viewQueries;
}
/**
 * @param {?} contentQueryStartId
 * @param {?} directives
 * @return {?}
 */
function _getContentQueries(contentQueryStartId, directives) {
    let /** @type {?} */ contentQueryId = contentQueryStartId;
    const /** @type {?} */ contentQueries = new Map();
    directives.forEach((directive, directiveIndex) => {
        if (directive.queries) {
            directive.queries.forEach((query) => _addQueryToTokenMap(contentQueries, { meta: query, queryId: contentQueryId++ }));
        }
    });
    return contentQueries;
}
/**
 * @param {?} map
 * @param {?} query
 * @return {?}
 */
function _addQueryToTokenMap(map, query) {
    query.meta.selectors.forEach((token) => {
        let /** @type {?} */ entry = map.get(tokenReference(token));
        if (!entry) {
            entry = [];
            map.set(tokenReference(token), entry);
        }
        entry.push(query);
    });
}
//# sourceMappingURL=provider_analyzer.js.map