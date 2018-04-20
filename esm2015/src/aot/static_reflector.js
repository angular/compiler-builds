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
import { CompileSummaryKind } from '../compile_metadata';
import { createAttribute, createComponent, createContentChild, createContentChildren, createDirective, createHost, createHostBinding, createHostListener, createInject, createInjectable, createInput, createNgModule, createOptional, createOutput, createPipe, createSelf, createSkipSelf, createViewChild, createViewChildren } from '../core';
import { syntaxError } from '../util';
import { formattedError } from './formatted_error';
import { StaticSymbol } from './static_symbol';
const /** @type {?} */ ANGULAR_CORE = '@angular/core';
const /** @type {?} */ ANGULAR_ROUTER = '@angular/router';
const /** @type {?} */ HIDDEN_KEY = /^\$.*\$$/;
const /** @type {?} */ IGNORE = {
    __symbolic: 'ignore'
};
const /** @type {?} */ USE_VALUE = 'useValue';
const /** @type {?} */ PROVIDE = 'provide';
const /** @type {?} */ REFERENCE_SET = new Set([USE_VALUE, 'useFactory', 'data', 'id', 'loadChildren']);
const /** @type {?} */ TYPEGUARD_POSTFIX = 'TypeGuard';
const /** @type {?} */ USE_IF = 'UseIf';
/**
 * @param {?} value
 * @return {?}
 */
function shouldIgnore(value) {
    return value && value.__symbolic == 'ignore';
}
/**
 * A static reflector implements enough of the Reflector API that is necessary to compile
 * templates statically.
 */
export class StaticReflector {
    /**
     * @param {?} summaryResolver
     * @param {?} symbolResolver
     * @param {?=} knownMetadataClasses
     * @param {?=} knownMetadataFunctions
     * @param {?=} errorRecorder
     */
    constructor(summaryResolver, symbolResolver, knownMetadataClasses = [], knownMetadataFunctions = [], errorRecorder) {
        this.summaryResolver = summaryResolver;
        this.symbolResolver = symbolResolver;
        this.errorRecorder = errorRecorder;
        this.annotationCache = new Map();
        this.shallowAnnotationCache = new Map();
        this.propertyCache = new Map();
        this.parameterCache = new Map();
        this.methodCache = new Map();
        this.staticCache = new Map();
        this.conversionMap = new Map();
        this.resolvedExternalReferences = new Map();
        this.annotationForParentClassWithSummaryKind = new Map();
        this.initializeConversionMap();
        knownMetadataClasses.forEach((kc) => this._registerDecoratorOrConstructor(this.getStaticSymbol(kc.filePath, kc.name), kc.ctor));
        knownMetadataFunctions.forEach((kf) => this._registerFunction(this.getStaticSymbol(kf.filePath, kf.name), kf.fn));
        this.annotationForParentClassWithSummaryKind.set(CompileSummaryKind.Directive, [createDirective, createComponent]);
        this.annotationForParentClassWithSummaryKind.set(CompileSummaryKind.Pipe, [createPipe]);
        this.annotationForParentClassWithSummaryKind.set(CompileSummaryKind.NgModule, [createNgModule]);
        this.annotationForParentClassWithSummaryKind.set(CompileSummaryKind.Injectable, [createInjectable, createPipe, createDirective, createComponent, createNgModule]);
    }
    /**
     * @param {?} typeOrFunc
     * @return {?}
     */
    componentModuleUrl(typeOrFunc) {
        const /** @type {?} */ staticSymbol = this.findSymbolDeclaration(typeOrFunc);
        return this.symbolResolver.getResourcePath(staticSymbol);
    }
    /**
     * @param {?} ref
     * @param {?=} containingFile
     * @return {?}
     */
    resolveExternalReference(ref, containingFile) {
        let /** @type {?} */ key = undefined;
        if (!containingFile) {
            key = `${ref.moduleName}:${ref.name}`;
            const /** @type {?} */ declarationSymbol = this.resolvedExternalReferences.get(key);
            if (declarationSymbol)
                return declarationSymbol;
        }
        const /** @type {?} */ refSymbol = this.symbolResolver.getSymbolByModule(/** @type {?} */ ((ref.moduleName)), /** @type {?} */ ((ref.name)), containingFile);
        const /** @type {?} */ declarationSymbol = this.findSymbolDeclaration(refSymbol);
        if (!containingFile) {
            this.symbolResolver.recordModuleNameForFileName(refSymbol.filePath, /** @type {?} */ ((ref.moduleName)));
            this.symbolResolver.recordImportAs(declarationSymbol, refSymbol);
        }
        if (key) {
            this.resolvedExternalReferences.set(key, declarationSymbol);
        }
        return declarationSymbol;
    }
    /**
     * @param {?} moduleUrl
     * @param {?} name
     * @param {?=} containingFile
     * @return {?}
     */
    findDeclaration(moduleUrl, name, containingFile) {
        return this.findSymbolDeclaration(this.symbolResolver.getSymbolByModule(moduleUrl, name, containingFile));
    }
    /**
     * @param {?} moduleUrl
     * @param {?} name
     * @param {?=} containingFile
     * @return {?}
     */
    tryFindDeclaration(moduleUrl, name, containingFile) {
        return this.symbolResolver.ignoreErrorsFor(() => this.findDeclaration(moduleUrl, name, containingFile));
    }
    /**
     * @param {?} symbol
     * @return {?}
     */
    findSymbolDeclaration(symbol) {
        const /** @type {?} */ resolvedSymbol = this.symbolResolver.resolveSymbol(symbol);
        if (resolvedSymbol) {
            let /** @type {?} */ resolvedMetadata = resolvedSymbol.metadata;
            if (resolvedMetadata && resolvedMetadata.__symbolic === 'resolved') {
                resolvedMetadata = resolvedMetadata.symbol;
            }
            if (resolvedMetadata instanceof StaticSymbol) {
                return this.findSymbolDeclaration(resolvedSymbol.metadata);
            }
        }
        return symbol;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    tryAnnotations(type) {
        const /** @type {?} */ originalRecorder = this.errorRecorder;
        this.errorRecorder = (error, fileName) => { };
        try {
            return this.annotations(type);
        }
        finally {
            this.errorRecorder = originalRecorder;
        }
    }
    /**
     * @param {?} type
     * @return {?}
     */
    annotations(type) {
        return this._annotations(type, (type, decorators) => this.simplify(type, decorators), this.annotationCache);
    }
    /**
     * @param {?} type
     * @return {?}
     */
    shallowAnnotations(type) {
        return this._annotations(type, (type, decorators) => this.simplify(type, decorators, true), this.shallowAnnotationCache);
    }
    /**
     * @param {?} type
     * @param {?} simplify
     * @param {?} annotationCache
     * @return {?}
     */
    _annotations(type, simplify, annotationCache) {
        let /** @type {?} */ annotations = annotationCache.get(type);
        if (!annotations) {
            annotations = [];
            const /** @type {?} */ classMetadata = this.getTypeMetadata(type);
            const /** @type {?} */ parentType = this.findParentType(type, classMetadata);
            if (parentType) {
                const /** @type {?} */ parentAnnotations = this.annotations(parentType);
                annotations.push(...parentAnnotations);
            }
            let /** @type {?} */ ownAnnotations = [];
            if (classMetadata['decorators']) {
                ownAnnotations = simplify(type, classMetadata['decorators']);
                if (ownAnnotations) {
                    annotations.push(...ownAnnotations);
                }
            }
            if (parentType && !this.summaryResolver.isLibraryFile(type.filePath) &&
                this.summaryResolver.isLibraryFile(parentType.filePath)) {
                const /** @type {?} */ summary = this.summaryResolver.resolveSummary(parentType);
                if (summary && summary.type) {
                    const /** @type {?} */ requiredAnnotationTypes = /** @type {?} */ ((this.annotationForParentClassWithSummaryKind.get(/** @type {?} */ ((summary.type.summaryKind)))));
                    const /** @type {?} */ typeHasRequiredAnnotation = requiredAnnotationTypes.some((requiredType) => ownAnnotations.some(ann => requiredType.isTypeOf(ann)));
                    if (!typeHasRequiredAnnotation) {
                        this.reportError(formatMetadataError(metadataError(`Class ${type.name} in ${type.filePath} extends from a ${CompileSummaryKind[(/** @type {?} */ ((summary.type.summaryKind)))]} in another compilation unit without duplicating the decorator`, undefined, `Please add a ${requiredAnnotationTypes.map((type) => type.ngMetadataName).join(' or ')} decorator to the class`), type), type);
                    }
                }
            }
            annotationCache.set(type, annotations.filter(ann => !!ann));
        }
        return annotations;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    propMetadata(type) {
        let /** @type {?} */ propMetadata = this.propertyCache.get(type);
        if (!propMetadata) {
            const /** @type {?} */ classMetadata = this.getTypeMetadata(type);
            propMetadata = {};
            const /** @type {?} */ parentType = this.findParentType(type, classMetadata);
            if (parentType) {
                const /** @type {?} */ parentPropMetadata = this.propMetadata(parentType);
                Object.keys(parentPropMetadata).forEach((parentProp) => {
                    /** @type {?} */ ((propMetadata))[parentProp] = parentPropMetadata[parentProp];
                });
            }
            const /** @type {?} */ members = classMetadata['members'] || {};
            Object.keys(members).forEach((propName) => {
                const /** @type {?} */ propData = members[propName];
                const /** @type {?} */ prop = (/** @type {?} */ (propData))
                    .find(a => a['__symbolic'] == 'property' || a['__symbolic'] == 'method');
                const /** @type {?} */ decorators = [];
                if (/** @type {?} */ ((propMetadata))[propName]) {
                    decorators.push(.../** @type {?} */ ((propMetadata))[propName]);
                } /** @type {?} */
                ((propMetadata))[propName] = decorators;
                if (prop && prop['decorators']) {
                    decorators.push(...this.simplify(type, prop['decorators']));
                }
            });
            this.propertyCache.set(type, propMetadata);
        }
        return propMetadata;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    parameters(type) {
        if (!(type instanceof StaticSymbol)) {
            this.reportError(new Error(`parameters received ${JSON.stringify(type)} which is not a StaticSymbol`), type);
            return [];
        }
        try {
            let /** @type {?} */ parameters = this.parameterCache.get(type);
            if (!parameters) {
                const /** @type {?} */ classMetadata = this.getTypeMetadata(type);
                const /** @type {?} */ parentType = this.findParentType(type, classMetadata);
                const /** @type {?} */ members = classMetadata ? classMetadata['members'] : null;
                const /** @type {?} */ ctorData = members ? members['__ctor__'] : null;
                if (ctorData) {
                    const /** @type {?} */ ctor = (/** @type {?} */ (ctorData)).find(a => a['__symbolic'] == 'constructor');
                    const /** @type {?} */ rawParameterTypes = /** @type {?} */ (ctor['parameters']) || [];
                    const /** @type {?} */ parameterDecorators = /** @type {?} */ (this.simplify(type, ctor['parameterDecorators'] || []));
                    parameters = [];
                    rawParameterTypes.forEach((rawParamType, index) => {
                        const /** @type {?} */ nestedResult = [];
                        const /** @type {?} */ paramType = this.trySimplify(type, rawParamType);
                        if (paramType)
                            nestedResult.push(paramType);
                        const /** @type {?} */ decorators = parameterDecorators ? parameterDecorators[index] : null;
                        if (decorators) {
                            nestedResult.push(...decorators);
                        } /** @type {?} */
                        ((parameters)).push(nestedResult);
                    });
                }
                else if (parentType) {
                    parameters = this.parameters(parentType);
                }
                if (!parameters) {
                    parameters = [];
                }
                this.parameterCache.set(type, parameters);
            }
            return parameters;
        }
        catch (/** @type {?} */ e) {
            console.error(`Failed on type ${JSON.stringify(type)} with error ${e}`);
            throw e;
        }
    }
    /**
     * @param {?} type
     * @return {?}
     */
    _methodNames(type) {
        let /** @type {?} */ methodNames = this.methodCache.get(type);
        if (!methodNames) {
            const /** @type {?} */ classMetadata = this.getTypeMetadata(type);
            methodNames = {};
            const /** @type {?} */ parentType = this.findParentType(type, classMetadata);
            if (parentType) {
                const /** @type {?} */ parentMethodNames = this._methodNames(parentType);
                Object.keys(parentMethodNames).forEach((parentProp) => {
                    /** @type {?} */ ((methodNames))[parentProp] = parentMethodNames[parentProp];
                });
            }
            const /** @type {?} */ members = classMetadata['members'] || {};
            Object.keys(members).forEach((propName) => {
                const /** @type {?} */ propData = members[propName];
                const /** @type {?} */ isMethod = (/** @type {?} */ (propData)).some(a => a['__symbolic'] == 'method'); /** @type {?} */
                ((methodNames))[propName] = /** @type {?} */ ((methodNames))[propName] || isMethod;
            });
            this.methodCache.set(type, methodNames);
        }
        return methodNames;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    _staticMembers(type) {
        let /** @type {?} */ staticMembers = this.staticCache.get(type);
        if (!staticMembers) {
            const /** @type {?} */ classMetadata = this.getTypeMetadata(type);
            const /** @type {?} */ staticMemberData = classMetadata['statics'] || {};
            staticMembers = Object.keys(staticMemberData);
            this.staticCache.set(type, staticMembers);
        }
        return staticMembers;
    }
    /**
     * @param {?} type
     * @param {?} classMetadata
     * @return {?}
     */
    findParentType(type, classMetadata) {
        const /** @type {?} */ parentType = this.trySimplify(type, classMetadata['extends']);
        if (parentType instanceof StaticSymbol) {
            return parentType;
        }
    }
    /**
     * @param {?} type
     * @param {?} lcProperty
     * @return {?}
     */
    hasLifecycleHook(type, lcProperty) {
        if (!(type instanceof StaticSymbol)) {
            this.reportError(new Error(`hasLifecycleHook received ${JSON.stringify(type)} which is not a StaticSymbol`), type);
        }
        try {
            return !!this._methodNames(type)[lcProperty];
        }
        catch (/** @type {?} */ e) {
            console.error(`Failed on type ${JSON.stringify(type)} with error ${e}`);
            throw e;
        }
    }
    /**
     * @param {?} type
     * @return {?}
     */
    guards(type) {
        if (!(type instanceof StaticSymbol)) {
            this.reportError(new Error(`guards received ${JSON.stringify(type)} which is not a StaticSymbol`), type);
            return {};
        }
        const /** @type {?} */ staticMembers = this._staticMembers(type);
        const /** @type {?} */ result = {};
        for (let /** @type {?} */ name of staticMembers) {
            if (name.endsWith(TYPEGUARD_POSTFIX)) {
                let /** @type {?} */ property = name.substr(0, name.length - TYPEGUARD_POSTFIX.length);
                let /** @type {?} */ value;
                if (property.endsWith(USE_IF)) {
                    property = name.substr(0, property.length - USE_IF.length);
                    value = USE_IF;
                }
                else {
                    value = this.getStaticSymbol(type.filePath, type.name, [name]);
                }
                result[property] = value;
            }
        }
        return result;
    }
    /**
     * @param {?} type
     * @param {?} ctor
     * @return {?}
     */
    _registerDecoratorOrConstructor(type, ctor) {
        this.conversionMap.set(type, (context, args) => new ctor(...args));
    }
    /**
     * @param {?} type
     * @param {?} fn
     * @return {?}
     */
    _registerFunction(type, fn) {
        this.conversionMap.set(type, (context, args) => fn.apply(undefined, args));
    }
    /**
     * @return {?}
     */
    initializeConversionMap() {
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Injectable'), createInjectable);
        this.injectionToken = this.findDeclaration(ANGULAR_CORE, 'InjectionToken');
        this.opaqueToken = this.findDeclaration(ANGULAR_CORE, 'OpaqueToken');
        this.ROUTES = this.tryFindDeclaration(ANGULAR_ROUTER, 'ROUTES');
        this.ANALYZE_FOR_ENTRY_COMPONENTS =
            this.findDeclaration(ANGULAR_CORE, 'ANALYZE_FOR_ENTRY_COMPONENTS');
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Host'), createHost);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Self'), createSelf);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'SkipSelf'), createSkipSelf);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Inject'), createInject);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Optional'), createOptional);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Attribute'), createAttribute);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'ContentChild'), createContentChild);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'ContentChildren'), createContentChildren);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'ViewChild'), createViewChild);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'ViewChildren'), createViewChildren);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Input'), createInput);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Output'), createOutput);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Pipe'), createPipe);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'HostBinding'), createHostBinding);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'HostListener'), createHostListener);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Directive'), createDirective);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Component'), createComponent);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'NgModule'), createNgModule);
        // Note: Some metadata classes can be used directly with Provider.deps.
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Host'), createHost);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Self'), createSelf);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'SkipSelf'), createSkipSelf);
        this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Optional'), createOptional);
    }
    /**
     * getStaticSymbol produces a Type whose metadata is known but whose implementation is not loaded.
     * All types passed to the StaticResolver should be pseudo-types returned by this method.
     *
     * @param {?} declarationFile the absolute path of the file where the symbol is declared
     * @param {?} name the name of the type.
     * @param {?=} members
     * @return {?}
     */
    getStaticSymbol(declarationFile, name, members) {
        return this.symbolResolver.getStaticSymbol(declarationFile, name, members);
    }
    /**
     * Simplify but discard any errors
     * @param {?} context
     * @param {?} value
     * @return {?}
     */
    trySimplify(context, value) {
        const /** @type {?} */ originalRecorder = this.errorRecorder;
        this.errorRecorder = (error, fileName) => { };
        const /** @type {?} */ result = this.simplify(context, value);
        this.errorRecorder = originalRecorder;
        return result;
    }
    /**
     * \@internal
     * @param {?} context
     * @param {?} value
     * @param {?=} lazy
     * @return {?}
     */
    simplify(context, value, lazy = false) {
        const /** @type {?} */ self = this;
        let /** @type {?} */ scope = BindingScope.empty;
        const /** @type {?} */ calling = new Map();
        const /** @type {?} */ rootContext = context;
        /**
         * @param {?} context
         * @param {?} value
         * @param {?} depth
         * @param {?} references
         * @return {?}
         */
        function simplifyInContext(context, value, depth, references) {
            /**
             * @param {?} staticSymbol
             * @return {?}
             */
            function resolveReferenceValue(staticSymbol) {
                const /** @type {?} */ resolvedSymbol = self.symbolResolver.resolveSymbol(staticSymbol);
                return resolvedSymbol ? resolvedSymbol.metadata : null;
            }
            /**
             * @param {?} value
             * @return {?}
             */
            function simplifyEagerly(value) {
                return simplifyInContext(context, value, depth, 0);
            }
            /**
             * @param {?} value
             * @return {?}
             */
            function simplifyLazily(value) {
                return simplifyInContext(context, value, depth, references + 1);
            }
            /**
             * @param {?} nestedContext
             * @param {?} value
             * @return {?}
             */
            function simplifyNested(nestedContext, value) {
                if (nestedContext === context) {
                    // If the context hasn't changed let the exception propagate unmodified.
                    return simplifyInContext(nestedContext, value, depth + 1, references);
                }
                try {
                    return simplifyInContext(nestedContext, value, depth + 1, references);
                }
                catch (/** @type {?} */ e) {
                    if (isMetadataError(e)) {
                        // Propagate the message text up but add a message to the chain that explains how we got
                        // here.
                        // e.chain implies e.symbol
                        const /** @type {?} */ summaryMsg = e.chain ? 'references \'' + /** @type {?} */ ((e.symbol)).name + '\'' : errorSummary(e);
                        const /** @type {?} */ summary = `'${nestedContext.name}' ${summaryMsg}`;
                        const /** @type {?} */ chain = { message: summary, position: e.position, next: e.chain };
                        // TODO(chuckj): retrieve the position information indirectly from the collectors node
                        // map if the metadata is from a .ts file.
                        self.error({
                            message: e.message,
                            advise: e.advise,
                            context: e.context, chain,
                            symbol: nestedContext
                        }, context);
                    }
                    else {
                        // It is probably an internal error.
                        throw e;
                    }
                }
            }
            /**
             * @param {?} functionSymbol
             * @param {?} targetFunction
             * @param {?} args
             * @param {?} targetExpression
             * @return {?}
             */
            function simplifyCall(functionSymbol, targetFunction, args, targetExpression) {
                if (targetFunction && targetFunction['__symbolic'] == 'function') {
                    if (calling.get(functionSymbol)) {
                        self.error({
                            message: 'Recursion is not supported',
                            summary: `called '${functionSymbol.name}' recursively`,
                            value: targetFunction
                        }, functionSymbol);
                    }
                    try {
                        const /** @type {?} */ value = targetFunction['value'];
                        if (value && (depth != 0 || value.__symbolic != 'error')) {
                            const /** @type {?} */ parameters = targetFunction['parameters'];
                            const /** @type {?} */ defaults = targetFunction.defaults;
                            args = args.map(arg => simplifyNested(context, arg))
                                .map(arg => shouldIgnore(arg) ? undefined : arg);
                            if (defaults && defaults.length > args.length) {
                                args.push(...defaults.slice(args.length).map((value) => simplify(value)));
                            }
                            calling.set(functionSymbol, true);
                            const /** @type {?} */ functionScope = BindingScope.build();
                            for (let /** @type {?} */ i = 0; i < parameters.length; i++) {
                                functionScope.define(parameters[i], args[i]);
                            }
                            const /** @type {?} */ oldScope = scope;
                            let /** @type {?} */ result;
                            try {
                                scope = functionScope.done();
                                result = simplifyNested(functionSymbol, value);
                            }
                            finally {
                                scope = oldScope;
                            }
                            return result;
                        }
                    }
                    finally {
                        calling.delete(functionSymbol);
                    }
                }
                if (depth === 0) {
                    // If depth is 0 we are evaluating the top level expression that is describing element
                    // decorator. In this case, it is a decorator we don't understand, such as a custom
                    // non-angular decorator, and we should just ignore it.
                    return IGNORE;
                }
                let /** @type {?} */ position = undefined;
                if (targetExpression && targetExpression.__symbolic == 'resolved') {
                    const /** @type {?} */ line = targetExpression.line;
                    const /** @type {?} */ character = targetExpression.character;
                    const /** @type {?} */ fileName = targetExpression.fileName;
                    if (fileName != null && line != null && character != null) {
                        position = { fileName, line, column: character };
                    }
                }
                self.error({
                    message: FUNCTION_CALL_NOT_SUPPORTED,
                    context: functionSymbol,
                    value: targetFunction, position
                }, context);
            }
            /**
             * @param {?} expression
             * @return {?}
             */
            function simplify(expression) {
                if (isPrimitive(expression)) {
                    return expression;
                }
                if (expression instanceof Array) {
                    const /** @type {?} */ result = [];
                    for (const /** @type {?} */ item of (/** @type {?} */ (expression))) {
                        // Check for a spread expression
                        if (item && item.__symbolic === 'spread') {
                            // We call with references as 0 because we require the actual value and cannot
                            // tolerate a reference here.
                            const /** @type {?} */ spreadArray = simplifyEagerly(item.expression);
                            if (Array.isArray(spreadArray)) {
                                for (const /** @type {?} */ spreadItem of spreadArray) {
                                    result.push(spreadItem);
                                }
                                continue;
                            }
                        }
                        const /** @type {?} */ value = simplify(item);
                        if (shouldIgnore(value)) {
                            continue;
                        }
                        result.push(value);
                    }
                    return result;
                }
                if (expression instanceof StaticSymbol) {
                    // Stop simplification at builtin symbols or if we are in a reference context and
                    // the symbol doesn't have members.
                    if (expression === self.injectionToken || self.conversionMap.has(expression) ||
                        (references > 0 && !expression.members.length)) {
                        return expression;
                    }
                    else {
                        const /** @type {?} */ staticSymbol = expression;
                        const /** @type {?} */ declarationValue = resolveReferenceValue(staticSymbol);
                        if (declarationValue != null) {
                            return simplifyNested(staticSymbol, declarationValue);
                        }
                        else {
                            return staticSymbol;
                        }
                    }
                }
                if (expression) {
                    if (expression['__symbolic']) {
                        let /** @type {?} */ staticSymbol;
                        switch (expression['__symbolic']) {
                            case 'binop':
                                let /** @type {?} */ left = simplify(expression['left']);
                                if (shouldIgnore(left))
                                    return left;
                                let /** @type {?} */ right = simplify(expression['right']);
                                if (shouldIgnore(right))
                                    return right;
                                switch (expression['operator']) {
                                    case '&&':
                                        return left && right;
                                    case '||':
                                        return left || right;
                                    case '|':
                                        return left | right;
                                    case '^':
                                        return left ^ right;
                                    case '&':
                                        return left & right;
                                    case '==':
                                        return left == right;
                                    case '!=':
                                        return left != right;
                                    case '===':
                                        return left === right;
                                    case '!==':
                                        return left !== right;
                                    case '<':
                                        return left < right;
                                    case '>':
                                        return left > right;
                                    case '<=':
                                        return left <= right;
                                    case '>=':
                                        return left >= right;
                                    case '<<':
                                        return left << right;
                                    case '>>':
                                        return left >> right;
                                    case '+':
                                        return left + right;
                                    case '-':
                                        return left - right;
                                    case '*':
                                        return left * right;
                                    case '/':
                                        return left / right;
                                    case '%':
                                        return left % right;
                                }
                                return null;
                            case 'if':
                                let /** @type {?} */ condition = simplify(expression['condition']);
                                return condition ? simplify(expression['thenExpression']) :
                                    simplify(expression['elseExpression']);
                            case 'pre':
                                let /** @type {?} */ operand = simplify(expression['operand']);
                                if (shouldIgnore(operand))
                                    return operand;
                                switch (expression['operator']) {
                                    case '+':
                                        return operand;
                                    case '-':
                                        return -operand;
                                    case '!':
                                        return !operand;
                                    case '~':
                                        return ~operand;
                                }
                                return null;
                            case 'index':
                                let /** @type {?} */ indexTarget = simplifyEagerly(expression['expression']);
                                let /** @type {?} */ index = simplifyEagerly(expression['index']);
                                if (indexTarget && isPrimitive(index))
                                    return indexTarget[index];
                                return null;
                            case 'select':
                                const /** @type {?} */ member = expression['member'];
                                let /** @type {?} */ selectContext = context;
                                let /** @type {?} */ selectTarget = simplify(expression['expression']);
                                if (selectTarget instanceof StaticSymbol) {
                                    const /** @type {?} */ members = selectTarget.members.concat(member);
                                    selectContext =
                                        self.getStaticSymbol(selectTarget.filePath, selectTarget.name, members);
                                    const /** @type {?} */ declarationValue = resolveReferenceValue(selectContext);
                                    if (declarationValue != null) {
                                        return simplifyNested(selectContext, declarationValue);
                                    }
                                    else {
                                        return selectContext;
                                    }
                                }
                                if (selectTarget && isPrimitive(member))
                                    return simplifyNested(selectContext, selectTarget[member]);
                                return null;
                            case 'reference':
                                // Note: This only has to deal with variable references, as symbol references have
                                // been converted into 'resolved'
                                // in the StaticSymbolResolver.
                                const /** @type {?} */ name = expression['name'];
                                const /** @type {?} */ localValue = scope.resolve(name);
                                if (localValue != BindingScope.missing) {
                                    return localValue;
                                }
                                break;
                            case 'resolved':
                                try {
                                    return simplify(expression.symbol);
                                }
                                catch (/** @type {?} */ e) {
                                    // If an error is reported evaluating the symbol record the position of the
                                    // reference in the error so it can
                                    // be reported in the error message generated from the exception.
                                    if (isMetadataError(e) && expression.fileName != null &&
                                        expression.line != null && expression.character != null) {
                                        e.position = {
                                            fileName: expression.fileName,
                                            line: expression.line,
                                            column: expression.character
                                        };
                                    }
                                    throw e;
                                }
                            case 'class':
                                return context;
                            case 'function':
                                return context;
                            case 'new':
                            case 'call':
                                // Determine if the function is a built-in conversion
                                staticSymbol = simplifyInContext(context, expression['expression'], depth + 1, /* references */ 0);
                                if (staticSymbol instanceof StaticSymbol) {
                                    if (staticSymbol === self.injectionToken || staticSymbol === self.opaqueToken) {
                                        // if somebody calls new InjectionToken, don't create an InjectionToken,
                                        // but rather return the symbol to which the InjectionToken is assigned to.
                                        // OpaqueToken is supported too as it is required by the language service to
                                        // support v4 and prior versions of Angular.
                                        return context;
                                    }
                                    const /** @type {?} */ argExpressions = expression['arguments'] || [];
                                    let /** @type {?} */ converter = self.conversionMap.get(staticSymbol);
                                    if (converter) {
                                        const /** @type {?} */ args = argExpressions.map(arg => simplifyNested(context, arg))
                                            .map(arg => shouldIgnore(arg) ? undefined : arg);
                                        return converter(context, args);
                                    }
                                    else {
                                        // Determine if the function is one we can simplify.
                                        const /** @type {?} */ targetFunction = resolveReferenceValue(staticSymbol);
                                        return simplifyCall(staticSymbol, targetFunction, argExpressions, expression['expression']);
                                    }
                                }
                                return IGNORE;
                            case 'error':
                                let /** @type {?} */ message = expression.message;
                                if (expression['line'] != null) {
                                    self.error({
                                        message,
                                        context: expression.context,
                                        value: expression,
                                        position: {
                                            fileName: expression['fileName'],
                                            line: expression['line'],
                                            column: expression['character']
                                        }
                                    }, context);
                                }
                                else {
                                    self.error({ message, context: expression.context }, context);
                                }
                                return IGNORE;
                            case 'ignore':
                                return expression;
                        }
                        return null;
                    }
                    return mapStringMap(expression, (value, name) => {
                        if (REFERENCE_SET.has(name)) {
                            if (name === USE_VALUE && PROVIDE in expression) {
                                // If this is a provider expression, check for special tokens that need the value
                                // during analysis.
                                const /** @type {?} */ provide = simplify(expression.provide);
                                if (provide === self.ROUTES || provide == self.ANALYZE_FOR_ENTRY_COMPONENTS) {
                                    return simplify(value);
                                }
                            }
                            return simplifyLazily(value);
                        }
                        return simplify(value);
                    });
                }
                return IGNORE;
            }
            return simplify(value);
        }
        let /** @type {?} */ result;
        try {
            result = simplifyInContext(context, value, 0, lazy ? 1 : 0);
        }
        catch (/** @type {?} */ e) {
            if (this.errorRecorder) {
                this.reportError(e, context);
            }
            else {
                throw formatMetadataError(e, context);
            }
        }
        if (shouldIgnore(result)) {
            return undefined;
        }
        return result;
    }
    /**
     * @param {?} type
     * @return {?}
     */
    getTypeMetadata(type) {
        const /** @type {?} */ resolvedSymbol = this.symbolResolver.resolveSymbol(type);
        return resolvedSymbol && resolvedSymbol.metadata ? resolvedSymbol.metadata :
            { __symbolic: 'class' };
    }
    /**
     * @param {?} error
     * @param {?} context
     * @param {?=} path
     * @return {?}
     */
    reportError(error, context, path) {
        if (this.errorRecorder) {
            this.errorRecorder(formatMetadataError(error, context), (context && context.filePath) || path);
        }
        else {
            throw error;
        }
    }
    /**
     * @param {?} __0
     * @param {?} reportingContext
     * @return {?}
     */
    error({ message, summary, advise, position, context, value, symbol, chain }, reportingContext) {
        this.reportError(metadataError(message, summary, advise, position, symbol, context, chain), reportingContext);
    }
}
function StaticReflector_tsickle_Closure_declarations() {
    /** @type {?} */
    StaticReflector.prototype.annotationCache;
    /** @type {?} */
    StaticReflector.prototype.shallowAnnotationCache;
    /** @type {?} */
    StaticReflector.prototype.propertyCache;
    /** @type {?} */
    StaticReflector.prototype.parameterCache;
    /** @type {?} */
    StaticReflector.prototype.methodCache;
    /** @type {?} */
    StaticReflector.prototype.staticCache;
    /** @type {?} */
    StaticReflector.prototype.conversionMap;
    /** @type {?} */
    StaticReflector.prototype.resolvedExternalReferences;
    /** @type {?} */
    StaticReflector.prototype.injectionToken;
    /** @type {?} */
    StaticReflector.prototype.opaqueToken;
    /** @type {?} */
    StaticReflector.prototype.ROUTES;
    /** @type {?} */
    StaticReflector.prototype.ANALYZE_FOR_ENTRY_COMPONENTS;
    /** @type {?} */
    StaticReflector.prototype.annotationForParentClassWithSummaryKind;
    /** @type {?} */
    StaticReflector.prototype.summaryResolver;
    /** @type {?} */
    StaticReflector.prototype.symbolResolver;
    /** @type {?} */
    StaticReflector.prototype.errorRecorder;
}
/**
 * @record
 */
function Position() { }
function Position_tsickle_Closure_declarations() {
    /** @type {?} */
    Position.prototype.fileName;
    /** @type {?} */
    Position.prototype.line;
    /** @type {?} */
    Position.prototype.column;
}
/**
 * @record
 */
function MetadataMessageChain() { }
function MetadataMessageChain_tsickle_Closure_declarations() {
    /** @type {?} */
    MetadataMessageChain.prototype.message;
    /** @type {?|undefined} */
    MetadataMessageChain.prototype.summary;
    /** @type {?|undefined} */
    MetadataMessageChain.prototype.position;
    /** @type {?|undefined} */
    MetadataMessageChain.prototype.context;
    /** @type {?|undefined} */
    MetadataMessageChain.prototype.symbol;
    /** @type {?|undefined} */
    MetadataMessageChain.prototype.next;
}
const /** @type {?} */ METADATA_ERROR = 'ngMetadataError';
/**
 * @param {?} message
 * @param {?=} summary
 * @param {?=} advise
 * @param {?=} position
 * @param {?=} symbol
 * @param {?=} context
 * @param {?=} chain
 * @return {?}
 */
function metadataError(message, summary, advise, position, symbol, context, chain) {
    const /** @type {?} */ error = /** @type {?} */ (syntaxError(message));
    (/** @type {?} */ (error))[METADATA_ERROR] = true;
    if (advise)
        error.advise = advise;
    if (position)
        error.position = position;
    if (summary)
        error.summary = summary;
    if (context)
        error.context = context;
    if (chain)
        error.chain = chain;
    if (symbol)
        error.symbol = symbol;
    return error;
}
/**
 * @param {?} error
 * @return {?}
 */
function isMetadataError(error) {
    return !!(/** @type {?} */ (error))[METADATA_ERROR];
}
const /** @type {?} */ REFERENCE_TO_NONEXPORTED_CLASS = 'Reference to non-exported class';
const /** @type {?} */ VARIABLE_NOT_INITIALIZED = 'Variable not initialized';
const /** @type {?} */ DESTRUCTURE_NOT_SUPPORTED = 'Destructuring not supported';
const /** @type {?} */ COULD_NOT_RESOLVE_TYPE = 'Could not resolve type';
const /** @type {?} */ FUNCTION_CALL_NOT_SUPPORTED = 'Function call not supported';
const /** @type {?} */ REFERENCE_TO_LOCAL_SYMBOL = 'Reference to a local symbol';
const /** @type {?} */ LAMBDA_NOT_SUPPORTED = 'Lambda not supported';
/**
 * @param {?} message
 * @param {?} context
 * @return {?}
 */
function expandedMessage(message, context) {
    switch (message) {
        case REFERENCE_TO_NONEXPORTED_CLASS:
            if (context && context.className) {
                return `References to a non-exported class are not supported in decorators but ${context.className} was referenced.`;
            }
            break;
        case VARIABLE_NOT_INITIALIZED:
            return 'Only initialized variables and constants can be referenced in decorators because the value of this variable is needed by the template compiler';
        case DESTRUCTURE_NOT_SUPPORTED:
            return 'Referencing an exported destructured variable or constant is not supported in decorators and this value is needed by the template compiler';
        case COULD_NOT_RESOLVE_TYPE:
            if (context && context.typeName) {
                return `Could not resolve type ${context.typeName}`;
            }
            break;
        case FUNCTION_CALL_NOT_SUPPORTED:
            if (context && context.name) {
                return `Function calls are not supported in decorators but '${context.name}' was called`;
            }
            return 'Function calls are not supported in decorators';
        case REFERENCE_TO_LOCAL_SYMBOL:
            if (context && context.name) {
                return `Reference to a local (non-exported) symbols are not supported in decorators but '${context.name}' was referenced`;
            }
            break;
        case LAMBDA_NOT_SUPPORTED:
            return `Function expressions are not supported in decorators`;
    }
    return message;
}
/**
 * @param {?} message
 * @param {?} context
 * @return {?}
 */
function messageAdvise(message, context) {
    switch (message) {
        case REFERENCE_TO_NONEXPORTED_CLASS:
            if (context && context.className) {
                return `Consider exporting '${context.className}'`;
            }
            break;
        case DESTRUCTURE_NOT_SUPPORTED:
            return 'Consider simplifying to avoid destructuring';
        case REFERENCE_TO_LOCAL_SYMBOL:
            if (context && context.name) {
                return `Consider exporting '${context.name}'`;
            }
            break;
        case LAMBDA_NOT_SUPPORTED:
            return `Consider changing the function expression into an exported function`;
    }
    return undefined;
}
/**
 * @param {?} error
 * @return {?}
 */
function errorSummary(error) {
    if (error.summary) {
        return error.summary;
    }
    switch (error.message) {
        case REFERENCE_TO_NONEXPORTED_CLASS:
            if (error.context && error.context.className) {
                return `references non-exported class ${error.context.className}`;
            }
            break;
        case VARIABLE_NOT_INITIALIZED:
            return 'is not initialized';
        case DESTRUCTURE_NOT_SUPPORTED:
            return 'is a destructured variable';
        case COULD_NOT_RESOLVE_TYPE:
            return 'could not be resolved';
        case FUNCTION_CALL_NOT_SUPPORTED:
            if (error.context && error.context.name) {
                return `calls '${error.context.name}'`;
            }
            return `calls a function`;
        case REFERENCE_TO_LOCAL_SYMBOL:
            if (error.context && error.context.name) {
                return `references local variable ${error.context.name}`;
            }
            return `references a local variable`;
    }
    return 'contains the error';
}
/**
 * @param {?} input
 * @param {?} transform
 * @return {?}
 */
function mapStringMap(input, transform) {
    if (!input)
        return {};
    const /** @type {?} */ result = {};
    Object.keys(input).forEach((key) => {
        const /** @type {?} */ value = transform(input[key], key);
        if (!shouldIgnore(value)) {
            if (HIDDEN_KEY.test(key)) {
                Object.defineProperty(result, key, { enumerable: false, configurable: true, value: value });
            }
            else {
                result[key] = value;
            }
        }
    });
    return result;
}
/**
 * @param {?} o
 * @return {?}
 */
function isPrimitive(o) {
    return o === null || (typeof o !== 'function' && typeof o !== 'object');
}
/**
 * @record
 */
function BindingScopeBuilder() { }
function BindingScopeBuilder_tsickle_Closure_declarations() {
    /** @type {?} */
    BindingScopeBuilder.prototype.define;
    /** @type {?} */
    BindingScopeBuilder.prototype.done;
}
/**
 * @abstract
 */
class BindingScope {
    /**
     * @return {?}
     */
    static build() {
        const /** @type {?} */ current = new Map();
        return {
            define: function (name, value) {
                current.set(name, value);
                return this;
            },
            done: function () {
                return current.size > 0 ? new PopulatedScope(current) : BindingScope.empty;
            }
        };
    }
}
BindingScope.missing = {};
BindingScope.empty = { resolve: name => BindingScope.missing };
function BindingScope_tsickle_Closure_declarations() {
    /** @type {?} */
    BindingScope.missing;
    /** @type {?} */
    BindingScope.empty;
    /**
     * @abstract
     * @param {?} name
     * @return {?}
     */
    BindingScope.prototype.resolve = function (name) { };
}
class PopulatedScope extends BindingScope {
    /**
     * @param {?} bindings
     */
    constructor(bindings) {
        super();
        this.bindings = bindings;
    }
    /**
     * @param {?} name
     * @return {?}
     */
    resolve(name) {
        return this.bindings.has(name) ? this.bindings.get(name) : BindingScope.missing;
    }
}
function PopulatedScope_tsickle_Closure_declarations() {
    /** @type {?} */
    PopulatedScope.prototype.bindings;
}
/**
 * @param {?} chain
 * @param {?} advise
 * @return {?}
 */
function formatMetadataMessageChain(chain, advise) {
    const /** @type {?} */ expanded = expandedMessage(chain.message, chain.context);
    const /** @type {?} */ nesting = chain.symbol ? ` in '${chain.symbol.name}'` : '';
    const /** @type {?} */ message = `${expanded}${nesting}`;
    const /** @type {?} */ position = chain.position;
    const /** @type {?} */ next = chain.next ?
        formatMetadataMessageChain(chain.next, advise) :
        advise ? { message: advise } : undefined;
    return { message, position, next };
}
/**
 * @param {?} e
 * @param {?} context
 * @return {?}
 */
function formatMetadataError(e, context) {
    if (isMetadataError(e)) {
        // Produce a formatted version of the and leaving enough information in the original error
        // to recover the formatting information to eventually produce a diagnostic error message.
        const /** @type {?} */ position = e.position;
        const /** @type {?} */ chain = {
            message: `Error during template compile of '${context.name}'`,
            position: position,
            next: { message: e.message, next: e.chain, context: e.context, symbol: e.symbol }
        };
        const /** @type {?} */ advise = e.advise || messageAdvise(e.message, e.context);
        return formattedError(formatMetadataMessageChain(chain, advise));
    }
    return e;
}
//# sourceMappingURL=static_reflector.js.map