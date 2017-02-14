/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Attribute, Component, ContentChild, ContentChildren, Directive, Host, HostBinding, HostListener, Inject, Injectable, Input, NgModule, Optional, Output, Pipe, Self, SkipSelf, ViewChild, ViewChildren, animate, group, keyframes, sequence, state, style, transition, trigger } from '@angular/core/index';
import { syntaxError } from '../util';
import { StaticSymbol } from './static_symbol';
const /** @type {?} */ ANGULAR_IMPORT_LOCATIONS = {
    coreDecorators: '@angular/core/src/metadata',
    diDecorators: '@angular/core/src/di/metadata',
    diMetadata: '@angular/core/src/di/metadata',
    diInjectionToken: '@angular/core/src/di/injection_token',
    diOpaqueToken: '@angular/core/src/di/injection_token',
    animationMetadata: '@angular/core/src/animation/metadata',
    provider: '@angular/core/src/di/provider'
};
const /** @type {?} */ HIDDEN_KEY = /^\$.*\$$/;
/**
 * A static reflector implements enough of the Reflector API that is necessary to compile
 * templates statically.
 */
export class StaticReflector {
    /**
     * @param {?} symbolResolver
     * @param {?=} knownMetadataClasses
     * @param {?=} knownMetadataFunctions
     * @param {?=} errorRecorder
     */
    constructor(symbolResolver, knownMetadataClasses = [], knownMetadataFunctions = [], errorRecorder) {
        this.symbolResolver = symbolResolver;
        this.errorRecorder = errorRecorder;
        this.annotationCache = new Map();
        this.propertyCache = new Map();
        this.parameterCache = new Map();
        this.methodCache = new Map();
        this.conversionMap = new Map();
        this.initializeConversionMap();
        knownMetadataClasses.forEach((kc) => this._registerDecoratorOrConstructor(this.getStaticSymbol(kc.filePath, kc.name), kc.ctor));
        knownMetadataFunctions.forEach((kf) => this._registerFunction(this.getStaticSymbol(kf.filePath, kf.name), kf.fn));
    }
    /**
     * @param {?} typeOrFunc
     * @return {?}
     */
    importUri(typeOrFunc) {
        const /** @type {?} */ staticSymbol = this.findSymbolDeclaration(typeOrFunc);
        return staticSymbol ? staticSymbol.filePath : null;
    }
    /**
     * @param {?} name
     * @param {?} moduleUrl
     * @param {?} members
     * @return {?}
     */
    resolveIdentifier(name, moduleUrl, members) {
        const /** @type {?} */ importSymbol = this.getStaticSymbol(moduleUrl, name);
        const /** @type {?} */ rootSymbol = this.findDeclaration(moduleUrl, name);
        if (importSymbol != rootSymbol) {
            this.symbolResolver.recordImportAs(rootSymbol, importSymbol);
        }
        if (members && members.length) {
            return this.getStaticSymbol(rootSymbol.filePath, rootSymbol.name, members);
        }
        return rootSymbol;
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
     * @param {?} symbol
     * @return {?}
     */
    findSymbolDeclaration(symbol) {
        const /** @type {?} */ resolvedSymbol = this.symbolResolver.resolveSymbol(symbol);
        if (resolvedSymbol && resolvedSymbol.metadata instanceof StaticSymbol) {
            return this.findSymbolDeclaration(resolvedSymbol.metadata);
        }
        else {
            return symbol;
        }
    }
    /**
     * @param {?} enumIdentifier
     * @param {?} name
     * @return {?}
     */
    resolveEnum(enumIdentifier, name) {
        const /** @type {?} */ staticSymbol = enumIdentifier;
        const /** @type {?} */ members = (staticSymbol.members || []).concat(name);
        return this.getStaticSymbol(staticSymbol.filePath, staticSymbol.name, members);
    }
    /**
     * @param {?} type
     * @return {?}
     */
    annotations(type) {
        let /** @type {?} */ annotations = this.annotationCache.get(type);
        if (!annotations) {
            annotations = [];
            const /** @type {?} */ classMetadata = this.getTypeMetadata(type);
            if (classMetadata['extends']) {
                const /** @type {?} */ parentType = this.trySimplify(type, classMetadata['extends']);
                if (parentType && (parentType instanceof StaticSymbol)) {
                    const /** @type {?} */ parentAnnotations = this.annotations(parentType);
                    annotations.push(...parentAnnotations);
                }
            }
            if (classMetadata['decorators']) {
                const /** @type {?} */ ownAnnotations = this.simplify(type, classMetadata['decorators']);
                annotations.push(...ownAnnotations);
            }
            this.annotationCache.set(type, annotations.filter(ann => !!ann));
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
            if (classMetadata['extends']) {
                const /** @type {?} */ parentType = this.simplify(type, classMetadata['extends']);
                if (parentType instanceof StaticSymbol) {
                    const /** @type {?} */ parentPropMetadata = this.propMetadata(parentType);
                    Object.keys(parentPropMetadata).forEach((parentProp) => {
                        propMetadata[parentProp] = parentPropMetadata[parentProp];
                    });
                }
            }
            const /** @type {?} */ members = classMetadata['members'] || {};
            Object.keys(members).forEach((propName) => {
                const /** @type {?} */ propData = members[propName];
                const /** @type {?} */ prop = ((propData))
                    .find(a => a['__symbolic'] == 'property' || a['__symbolic'] == 'method');
                const /** @type {?} */ decorators = [];
                if (propMetadata[propName]) {
                    decorators.push(...propMetadata[propName]);
                }
                propMetadata[propName] = decorators;
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
                const /** @type {?} */ members = classMetadata ? classMetadata['members'] : null;
                const /** @type {?} */ ctorData = members ? members['__ctor__'] : null;
                if (ctorData) {
                    const /** @type {?} */ ctor = ((ctorData)).find(a => a['__symbolic'] == 'constructor');
                    const /** @type {?} */ parameterTypes = (this.simplify(type, ctor['parameters'] || []));
                    const /** @type {?} */ parameterDecorators = (this.simplify(type, ctor['parameterDecorators'] || []));
                    parameters = [];
                    parameterTypes.forEach((paramType, index) => {
                        const /** @type {?} */ nestedResult = [];
                        if (paramType) {
                            nestedResult.push(paramType);
                        }
                        const /** @type {?} */ decorators = parameterDecorators ? parameterDecorators[index] : null;
                        if (decorators) {
                            nestedResult.push(...decorators);
                        }
                        parameters.push(nestedResult);
                    });
                }
                else if (classMetadata['extends']) {
                    const /** @type {?} */ parentType = this.simplify(type, classMetadata['extends']);
                    if (parentType instanceof StaticSymbol) {
                        parameters = this.parameters(parentType);
                    }
                }
                if (!parameters) {
                    parameters = [];
                }
                this.parameterCache.set(type, parameters);
            }
            return parameters;
        }
        catch (e) {
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
            if (classMetadata['extends']) {
                const /** @type {?} */ parentType = this.simplify(type, classMetadata['extends']);
                if (parentType instanceof StaticSymbol) {
                    const /** @type {?} */ parentMethodNames = this._methodNames(parentType);
                    Object.keys(parentMethodNames).forEach((parentProp) => {
                        methodNames[parentProp] = parentMethodNames[parentProp];
                    });
                }
            }
            const /** @type {?} */ members = classMetadata['members'] || {};
            Object.keys(members).forEach((propName) => {
                const /** @type {?} */ propData = members[propName];
                const /** @type {?} */ isMethod = ((propData)).some(a => a['__symbolic'] == 'method');
                methodNames[propName] = methodNames[propName] || isMethod;
            });
            this.methodCache.set(type, methodNames);
        }
        return methodNames;
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
        catch (e) {
            console.error(`Failed on type ${JSON.stringify(type)} with error ${e}`);
            throw e;
        }
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
        const { coreDecorators, diDecorators, diMetadata, diInjectionToken, diOpaqueToken, animationMetadata, provider } = ANGULAR_IMPORT_LOCATIONS;
        this.injectionToken = this.findDeclaration(diInjectionToken, 'InjectionToken');
        this.opaqueToken = this.findDeclaration(diInjectionToken, 'OpaqueToken');
        this._registerDecoratorOrConstructor(this.findDeclaration(diDecorators, 'Host'), Host);
        this._registerDecoratorOrConstructor(this.findDeclaration(diDecorators, 'Injectable'), Injectable);
        this._registerDecoratorOrConstructor(this.findDeclaration(diDecorators, 'Self'), Self);
        this._registerDecoratorOrConstructor(this.findDeclaration(diDecorators, 'SkipSelf'), SkipSelf);
        this._registerDecoratorOrConstructor(this.findDeclaration(diDecorators, 'Inject'), Inject);
        this._registerDecoratorOrConstructor(this.findDeclaration(diDecorators, 'Optional'), Optional);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'Attribute'), Attribute);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'ContentChild'), ContentChild);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'ContentChildren'), ContentChildren);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'ViewChild'), ViewChild);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'ViewChildren'), ViewChildren);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'Input'), Input);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'Output'), Output);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'Pipe'), Pipe);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'HostBinding'), HostBinding);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'HostListener'), HostListener);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'Directive'), Directive);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'Component'), Component);
        this._registerDecoratorOrConstructor(this.findDeclaration(coreDecorators, 'NgModule'), NgModule);
        // Note: Some metadata classes can be used directly with Provider.deps.
        this._registerDecoratorOrConstructor(this.findDeclaration(diMetadata, 'Host'), Host);
        this._registerDecoratorOrConstructor(this.findDeclaration(diMetadata, 'Self'), Self);
        this._registerDecoratorOrConstructor(this.findDeclaration(diMetadata, 'SkipSelf'), SkipSelf);
        this._registerDecoratorOrConstructor(this.findDeclaration(diMetadata, 'Optional'), Optional);
        this._registerFunction(this.findDeclaration(animationMetadata, 'trigger'), trigger);
        this._registerFunction(this.findDeclaration(animationMetadata, 'state'), state);
        this._registerFunction(this.findDeclaration(animationMetadata, 'transition'), transition);
        this._registerFunction(this.findDeclaration(animationMetadata, 'style'), style);
        this._registerFunction(this.findDeclaration(animationMetadata, 'animate'), animate);
        this._registerFunction(this.findDeclaration(animationMetadata, 'keyframes'), keyframes);
        this._registerFunction(this.findDeclaration(animationMetadata, 'sequence'), sequence);
        this._registerFunction(this.findDeclaration(animationMetadata, 'group'), group);
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
     * @param {?} error
     * @param {?} context
     * @param {?=} path
     * @return {?}
     */
    reportError(error, context, path) {
        if (this.errorRecorder) {
            this.errorRecorder(error, (context && context.filePath) || path);
        }
        else {
            throw error;
        }
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
     * @return {?}
     */
    simplify(context, value) {
        const /** @type {?} */ self = this;
        let /** @type {?} */ scope = BindingScope.empty;
        const /** @type {?} */ calling = new Map();
        /**
         * @param {?} context
         * @param {?} value
         * @param {?} depth
         * @return {?}
         */
        function simplifyInContext(context, value, depth) {
            /**
             * @param {?} staticSymbol
             * @return {?}
             */
            function resolveReferenceValue(staticSymbol) {
                const /** @type {?} */ resolvedSymbol = self.symbolResolver.resolveSymbol(staticSymbol);
                return resolvedSymbol ? resolvedSymbol.metadata : null;
            }
            /**
             * @param {?} functionSymbol
             * @param {?} targetFunction
             * @param {?} args
             * @return {?}
             */
            function simplifyCall(functionSymbol, targetFunction, args) {
                if (targetFunction && targetFunction['__symbolic'] == 'function') {
                    if (calling.get(functionSymbol)) {
                        throw new Error('Recursion not supported');
                    }
                    calling.set(functionSymbol, true);
                    try {
                        const /** @type {?} */ value = targetFunction['value'];
                        if (value && (depth != 0 || value.__symbolic != 'error')) {
                            const /** @type {?} */ parameters = targetFunction['parameters'];
                            const /** @type {?} */ defaults = targetFunction.defaults;
                            args = args.map(arg => simplifyInContext(context, arg, depth + 1));
                            if (defaults && defaults.length > args.length) {
                                args.push(...defaults.slice(args.length).map((value) => simplify(value)));
                            }
                            const /** @type {?} */ functionScope = BindingScope.build();
                            for (let /** @type {?} */ i = 0; i < parameters.length; i++) {
                                functionScope.define(parameters[i], args[i]);
                            }
                            const /** @type {?} */ oldScope = scope;
                            let /** @type {?} */ result;
                            try {
                                scope = functionScope.done();
                                result = simplifyInContext(functionSymbol, value, depth + 1);
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
                    return { __symbolic: 'ignore' };
                }
                return simplify({ __symbolic: 'error', message: 'Function call not supported', context: functionSymbol });
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
                    for (const /** @type {?} */ item of ((expression))) {
                        // Check for a spread expression
                        if (item && item.__symbolic === 'spread') {
                            const /** @type {?} */ spreadArray = simplify(item.expression);
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
                    // Stop simplification at builtin symbols
                    if (expression === self.injectionToken || expression === self.opaqueToken ||
                        self.conversionMap.has(expression)) {
                        return expression;
                    }
                    else {
                        const /** @type {?} */ staticSymbol = expression;
                        const /** @type {?} */ declarationValue = resolveReferenceValue(staticSymbol);
                        if (declarationValue) {
                            return simplifyInContext(staticSymbol, declarationValue, depth + 1);
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
                                let /** @type {?} */ indexTarget = simplify(expression['expression']);
                                let /** @type {?} */ index = simplify(expression['index']);
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
                                    if (declarationValue) {
                                        return simplifyInContext(selectContext, declarationValue, depth + 1);
                                    }
                                    else {
                                        return selectContext;
                                    }
                                }
                                if (selectTarget && isPrimitive(member))
                                    return simplifyInContext(selectContext, selectTarget[member], depth + 1);
                                return null;
                            case 'reference':
                                // Note: This only has to deal with variable references,
                                // as symbol references have been converted into StaticSymbols already
                                // in the StaticSymbolResolver!
                                const /** @type {?} */ name = expression['name'];
                                const /** @type {?} */ localValue = scope.resolve(name);
                                if (localValue != BindingScope.missing) {
                                    return localValue;
                                }
                                break;
                            case 'class':
                                return context;
                            case 'function':
                                return context;
                            case 'new':
                            case 'call':
                                // Determine if the function is a built-in conversion
                                staticSymbol = simplifyInContext(context, expression['expression'], depth + 1);
                                if (staticSymbol instanceof StaticSymbol) {
                                    if (staticSymbol === self.injectionToken || staticSymbol === self.opaqueToken) {
                                        // if somebody calls new InjectionToken, don't create an InjectionToken,
                                        // but rather return the symbol to which the InjectionToken is assigned to.
                                        return context;
                                    }
                                    const /** @type {?} */ argExpressions = expression['arguments'] || [];
                                    let /** @type {?} */ converter = self.conversionMap.get(staticSymbol);
                                    if (converter) {
                                        const /** @type {?} */ args = argExpressions.map(arg => simplifyInContext(context, arg, depth + 1));
                                        return converter(context, args);
                                    }
                                    else {
                                        // Determine if the function is one we can simplify.
                                        const /** @type {?} */ targetFunction = resolveReferenceValue(staticSymbol);
                                        return simplifyCall(staticSymbol, targetFunction, argExpressions);
                                    }
                                }
                                break;
                            case 'error':
                                let /** @type {?} */ message = produceErrorMessage(expression);
                                if (expression['line']) {
                                    message =
                                        `${message} (position ${expression['line'] + 1}:${expression['character'] + 1} in the original .ts file)`;
                                    throw positionalError(message, context.filePath, expression['line'], expression['character']);
                                }
                                throw new Error(message);
                        }
                        return null;
                    }
                    return mapStringMap(expression, (value, name) => simplify(value));
                }
                return null;
            }
            try {
                return simplify(value);
            }
            catch (e) {
                const /** @type {?} */ members = context.members.length ? `.${context.members.join('.')}` : '';
                const /** @type {?} */ message = `${e.message}, resolving symbol ${context.name}${members} in ${context.filePath}`;
                if (e.fileName) {
                    throw positionalError(message, e.fileName, e.line, e.column);
                }
                throw syntaxError(message);
            }
        }
        const /** @type {?} */ recordedSimplifyInContext = (context, value, depth) => {
            try {
                return simplifyInContext(context, value, depth);
            }
            catch (e) {
                this.reportError(e, context);
            }
        };
        const /** @type {?} */ result = this.errorRecorder ? recordedSimplifyInContext(context, value, 0) :
            simplifyInContext(context, value, 0);
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
}
function StaticReflector_tsickle_Closure_declarations() {
    /** @type {?} */
    StaticReflector.prototype.annotationCache;
    /** @type {?} */
    StaticReflector.prototype.propertyCache;
    /** @type {?} */
    StaticReflector.prototype.parameterCache;
    /** @type {?} */
    StaticReflector.prototype.methodCache;
    /** @type {?} */
    StaticReflector.prototype.conversionMap;
    /** @type {?} */
    StaticReflector.prototype.injectionToken;
    /** @type {?} */
    StaticReflector.prototype.opaqueToken;
    /** @type {?} */
    StaticReflector.prototype.symbolResolver;
    /** @type {?} */
    StaticReflector.prototype.errorRecorder;
}
/**
 * @param {?} error
 * @return {?}
 */
function expandedMessage(error) {
    switch (error.message) {
        case 'Reference to non-exported class':
            if (error.context && error.context.className) {
                return `Reference to a non-exported class ${error.context.className}. Consider exporting the class`;
            }
            break;
        case 'Variable not initialized':
            return 'Only initialized variables and constants can be referenced because the value of this variable is needed by the template compiler';
        case 'Destructuring not supported':
            return 'Referencing an exported destructured variable or constant is not supported by the template compiler. Consider simplifying this to avoid destructuring';
        case 'Could not resolve type':
            if (error.context && error.context.typeName) {
                return `Could not resolve type ${error.context.typeName}`;
            }
            break;
        case 'Function call not supported':
            let /** @type {?} */ prefix = error.context && error.context.name ? `Calling function '${error.context.name}', f` : 'F';
            return prefix +
                'unction calls are not supported. Consider replacing the function or lambda with a reference to an exported function';
        case 'Reference to a local symbol':
            if (error.context && error.context.name) {
                return `Reference to a local (non-exported) symbol '${error.context.name}'. Consider exporting the symbol`;
            }
            break;
    }
    return error.message;
}
/**
 * @param {?} error
 * @return {?}
 */
function produceErrorMessage(error) {
    return `Error encountered resolving symbol values statically. ${expandedMessage(error)}`;
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
 * @abstract
 */
class BindingScope {
    /**
     * @abstract
     * @param {?} name
     * @return {?}
     */
    resolve(name) { }
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
 * @param {?} value
 * @return {?}
 */
function shouldIgnore(value) {
    return value && value.__symbolic == 'ignore';
}
/**
 * @param {?} message
 * @param {?} fileName
 * @param {?} line
 * @param {?} column
 * @return {?}
 */
function positionalError(message, fileName, line, column) {
    const /** @type {?} */ result = new Error(message);
    ((result)).fileName = fileName;
    ((result)).line = line;
    ((result)).column = column;
    return result;
}
//# sourceMappingURL=static_reflector.js.map