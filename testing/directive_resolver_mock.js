/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { DirectiveResolver } from '@angular/compiler';
import { Compiler, Component, Directive, Injectable, Injector, resolveForwardRef } from '@angular/core';
import { isPresent } from './facade/lang';
/**
 * An implementation of {@link DirectiveResolver} that allows overriding
 * various properties of directives.
 */
export class MockDirectiveResolver extends DirectiveResolver {
    constructor(_injector) {
        super();
        this._injector = _injector;
        this._directives = new Map();
        this._providerOverrides = new Map();
        this._viewProviderOverrides = new Map();
        this._views = new Map();
        this._inlineTemplates = new Map();
        this._animations = new Map();
    }
    get _compiler() { return this._injector.get(Compiler); }
    _clearCacheFor(component) { this._compiler.clearCacheFor(component); }
    resolve(type, throwIfNotFound = true) {
        let metadata = this._directives.get(type);
        if (!metadata) {
            metadata = super.resolve(type, throwIfNotFound);
        }
        if (!metadata) {
            return null;
        }
        const providerOverrides = this._providerOverrides.get(type);
        const viewProviderOverrides = this._viewProviderOverrides.get(type);
        let providers = metadata.providers;
        if (isPresent(providerOverrides)) {
            const originalViewProviders = metadata.providers || [];
            providers = originalViewProviders.concat(providerOverrides);
        }
        if (metadata instanceof Component) {
            let viewProviders = metadata.viewProviders;
            if (isPresent(viewProviderOverrides)) {
                const originalViewProviders = metadata.viewProviders || [];
                viewProviders = originalViewProviders.concat(viewProviderOverrides);
            }
            let view = this._views.get(type);
            if (!view) {
                view = metadata;
            }
            let animations = view.animations;
            let templateUrl = view.templateUrl;
            const inlineAnimations = this._animations.get(type);
            if (isPresent(inlineAnimations)) {
                animations = inlineAnimations;
            }
            let inlineTemplate = this._inlineTemplates.get(type);
            if (isPresent(inlineTemplate)) {
                templateUrl = null;
            }
            else {
                inlineTemplate = view.template;
            }
            return new Component({
                selector: metadata.selector,
                inputs: metadata.inputs,
                outputs: metadata.outputs,
                host: metadata.host,
                exportAs: metadata.exportAs,
                moduleId: metadata.moduleId,
                queries: metadata.queries,
                changeDetection: metadata.changeDetection,
                providers: providers,
                viewProviders: viewProviders,
                entryComponents: metadata.entryComponents,
                template: inlineTemplate,
                templateUrl: templateUrl,
                animations: animations,
                styles: view.styles,
                styleUrls: view.styleUrls,
                encapsulation: view.encapsulation,
                interpolation: view.interpolation
            });
        }
        return new Directive({
            selector: metadata.selector,
            inputs: metadata.inputs,
            outputs: metadata.outputs,
            host: metadata.host,
            providers: providers,
            exportAs: metadata.exportAs,
            queries: metadata.queries
        });
    }
    /**
     * Overrides the {@link Directive} for a directive.
     */
    setDirective(type, metadata) {
        this._directives.set(type, metadata);
        this._clearCacheFor(type);
    }
    setProvidersOverride(type, providers) {
        this._providerOverrides.set(type, providers);
        this._clearCacheFor(type);
    }
    setViewProvidersOverride(type, viewProviders) {
        this._viewProviderOverrides.set(type, viewProviders);
        this._clearCacheFor(type);
    }
    /**
     * Overrides the {@link ViewMetadata} for a component.
     */
    setView(component, view) {
        this._views.set(component, view);
        this._clearCacheFor(component);
    }
    /**
     * Overrides the inline template for a component - other configuration remains unchanged.
     */
    setInlineTemplate(component, template) {
        this._inlineTemplates.set(component, template);
        this._clearCacheFor(component);
    }
    setAnimations(component, animations) {
        this._animations.set(component, animations);
        this._clearCacheFor(component);
    }
}
MockDirectiveResolver.decorators = [
    { type: Injectable },
];
/** @nocollapse */
MockDirectiveResolver.ctorParameters = () => [
    { type: Injector, },
];
function flattenArray(tree, out) {
    if (!isPresent(tree))
        return;
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
//# sourceMappingURL=directive_resolver_mock.js.map