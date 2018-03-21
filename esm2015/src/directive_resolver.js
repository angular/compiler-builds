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
import { createComponent, createContentChild, createContentChildren, createDirective, createHostBinding, createHostListener, createInput, createOutput, createViewChild, createViewChildren } from './core';
import { resolveForwardRef, splitAtColon, stringify } from './util';
const /** @type {?} */ QUERY_METADATA_IDENTIFIERS = [
    createViewChild,
    createViewChildren,
    createContentChild,
    createContentChildren,
];
export class DirectiveResolver {
    /**
     * @param {?} _reflector
     */
    constructor(_reflector) {
        this._reflector = _reflector;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    isDirective(type) {
        const /** @type {?} */ typeMetadata = this._reflector.annotations(resolveForwardRef(type));
        return typeMetadata && typeMetadata.some(isDirectiveMetadata);
    }
    /**
     * @param {?} type
     * @param {?=} throwIfNotFound
     * @return {?}
     */
    resolve(type, throwIfNotFound = true) {
        const /** @type {?} */ typeMetadata = this._reflector.annotations(resolveForwardRef(type));
        if (typeMetadata) {
            const /** @type {?} */ metadata = findLast(typeMetadata, isDirectiveMetadata);
            if (metadata) {
                const /** @type {?} */ propertyMetadata = this._reflector.propMetadata(type);
                const /** @type {?} */ guards = this._reflector.guards(type);
                return this._mergeWithPropertyMetadata(metadata, propertyMetadata, guards, type);
            }
        }
        if (throwIfNotFound) {
            throw new Error(`No Directive annotation found on ${stringify(type)}`);
        }
        return null;
    }
    /**
     * @param {?} dm
     * @param {?} propertyMetadata
     * @param {?} guards
     * @param {?} directiveType
     * @return {?}
     */
    _mergeWithPropertyMetadata(dm, propertyMetadata, guards, directiveType) {
        const /** @type {?} */ inputs = [];
        const /** @type {?} */ outputs = [];
        const /** @type {?} */ host = {};
        const /** @type {?} */ queries = {};
        Object.keys(propertyMetadata).forEach((propName) => {
            const /** @type {?} */ input = findLast(propertyMetadata[propName], (a) => createInput.isTypeOf(a));
            if (input) {
                if (input.bindingPropertyName) {
                    inputs.push(`${propName}: ${input.bindingPropertyName}`);
                }
                else {
                    inputs.push(propName);
                }
            }
            const /** @type {?} */ output = findLast(propertyMetadata[propName], (a) => createOutput.isTypeOf(a));
            if (output) {
                if (output.bindingPropertyName) {
                    outputs.push(`${propName}: ${output.bindingPropertyName}`);
                }
                else {
                    outputs.push(propName);
                }
            }
            const /** @type {?} */ hostBindings = propertyMetadata[propName].filter(a => createHostBinding.isTypeOf(a));
            hostBindings.forEach(hostBinding => {
                if (hostBinding.hostPropertyName) {
                    const /** @type {?} */ startWith = hostBinding.hostPropertyName[0];
                    if (startWith === '(') {
                        throw new Error(`@HostBinding can not bind to events. Use @HostListener instead.`);
                    }
                    else if (startWith === '[') {
                        throw new Error(`@HostBinding parameter should be a property name, 'class.<name>', or 'attr.<name>'.`);
                    }
                    host[`[${hostBinding.hostPropertyName}]`] = propName;
                }
                else {
                    host[`[${propName}]`] = propName;
                }
            });
            const /** @type {?} */ hostListeners = propertyMetadata[propName].filter(a => createHostListener.isTypeOf(a));
            hostListeners.forEach(hostListener => {
                const /** @type {?} */ args = hostListener.args || [];
                host[`(${hostListener.eventName})`] = `${propName}(${args.join(',')})`;
            });
            const /** @type {?} */ query = findLast(propertyMetadata[propName], (a) => QUERY_METADATA_IDENTIFIERS.some(i => i.isTypeOf(a)));
            if (query) {
                queries[propName] = query;
            }
        });
        return this._merge(dm, inputs, outputs, host, queries, guards, directiveType);
    }
    /**
     * @param {?} def
     * @return {?}
     */
    _extractPublicName(def) { return splitAtColon(def, [/** @type {?} */ ((null)), def])[1].trim(); }
    /**
     * @param {?} bindings
     * @return {?}
     */
    _dedupeBindings(bindings) {
        const /** @type {?} */ names = new Set();
        const /** @type {?} */ publicNames = new Set();
        const /** @type {?} */ reversedResult = [];
        // go last to first to allow later entries to overwrite previous entries
        for (let /** @type {?} */ i = bindings.length - 1; i >= 0; i--) {
            const /** @type {?} */ binding = bindings[i];
            const /** @type {?} */ name = this._extractPublicName(binding);
            publicNames.add(name);
            if (!names.has(name)) {
                names.add(name);
                reversedResult.push(binding);
            }
        }
        return reversedResult.reverse();
    }
    /**
     * @param {?} directive
     * @param {?} inputs
     * @param {?} outputs
     * @param {?} host
     * @param {?} queries
     * @param {?} guards
     * @param {?} directiveType
     * @return {?}
     */
    _merge(directive, inputs, outputs, host, queries, guards, directiveType) {
        const /** @type {?} */ mergedInputs = this._dedupeBindings(directive.inputs ? directive.inputs.concat(inputs) : inputs);
        const /** @type {?} */ mergedOutputs = this._dedupeBindings(directive.outputs ? directive.outputs.concat(outputs) : outputs);
        const /** @type {?} */ mergedHost = directive.host ? Object.assign({}, directive.host, host) : host;
        const /** @type {?} */ mergedQueries = directive.queries ? Object.assign({}, directive.queries, queries) : queries;
        if (createComponent.isTypeOf(directive)) {
            const /** @type {?} */ comp = /** @type {?} */ (directive);
            return createComponent({
                selector: comp.selector,
                inputs: mergedInputs,
                outputs: mergedOutputs,
                host: mergedHost,
                exportAs: comp.exportAs,
                moduleId: comp.moduleId,
                queries: mergedQueries,
                changeDetection: comp.changeDetection,
                providers: comp.providers,
                viewProviders: comp.viewProviders,
                entryComponents: comp.entryComponents,
                template: comp.template,
                templateUrl: comp.templateUrl,
                styles: comp.styles,
                styleUrls: comp.styleUrls,
                encapsulation: comp.encapsulation,
                animations: comp.animations,
                interpolation: comp.interpolation,
                preserveWhitespaces: directive.preserveWhitespaces,
            });
        }
        else {
            return createDirective({
                selector: directive.selector,
                inputs: mergedInputs,
                outputs: mergedOutputs,
                host: mergedHost,
                exportAs: directive.exportAs,
                queries: mergedQueries,
                providers: directive.providers, guards
            });
        }
    }
}
function DirectiveResolver_tsickle_Closure_declarations() {
    /** @type {?} */
    DirectiveResolver.prototype._reflector;
}
/**
 * @param {?} type
 * @return {?}
 */
function isDirectiveMetadata(type) {
    return createDirective.isTypeOf(type) || createComponent.isTypeOf(type);
}
/**
 * @template T
 * @param {?} arr
 * @param {?} condition
 * @return {?}
 */
export function findLast(arr, condition) {
    for (let /** @type {?} */ i = arr.length - 1; i >= 0; i--) {
        if (condition(arr[i])) {
            return arr[i];
        }
    }
    return null;
}
//# sourceMappingURL=directive_resolver.js.map