/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { CompileSummaryKind } from '../compile_metadata';
import { createAttribute, createComponent, createContentChild, createContentChildren, createDirective, createHost, createHostBinding, createHostListener, createInject, createInjectable, createInput, createNgModule, createOptional, createOutput, createPipe, createSelf, createSkipSelf, createViewChild, createViewChildren } from '../core';
import { syntaxError } from '../util';
import { formattedError } from './formatted_error';
import { StaticSymbol } from './static_symbol';
var ANGULAR_CORE = '@angular/core';
var ANGULAR_ROUTER = '@angular/router';
var HIDDEN_KEY = /^\$.*\$$/;
var IGNORE = {
    __symbolic: 'ignore'
};
var USE_VALUE = 'useValue';
var PROVIDE = 'provide';
var REFERENCE_SET = new Set([USE_VALUE, 'useFactory', 'data', 'id', 'loadChildren']);
var TYPEGUARD_POSTFIX = 'TypeGuard';
var USE_IF = 'UseIf';
function shouldIgnore(value) {
    return value && value.__symbolic == 'ignore';
}
/**
 * A static reflector implements enough of the Reflector API that is necessary to compile
 * templates statically.
 */
var StaticReflector = /** @class */ (function () {
    function StaticReflector(summaryResolver, symbolResolver, knownMetadataClasses, knownMetadataFunctions, errorRecorder) {
        var _this = this;
        if (knownMetadataClasses === void 0) { knownMetadataClasses = []; }
        if (knownMetadataFunctions === void 0) { knownMetadataFunctions = []; }
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
        knownMetadataClasses.forEach(function (kc) { return _this._registerDecoratorOrConstructor(_this.getStaticSymbol(kc.filePath, kc.name), kc.ctor); });
        knownMetadataFunctions.forEach(function (kf) { return _this._registerFunction(_this.getStaticSymbol(kf.filePath, kf.name), kf.fn); });
        this.annotationForParentClassWithSummaryKind.set(CompileSummaryKind.Directive, [createDirective, createComponent]);
        this.annotationForParentClassWithSummaryKind.set(CompileSummaryKind.Pipe, [createPipe]);
        this.annotationForParentClassWithSummaryKind.set(CompileSummaryKind.NgModule, [createNgModule]);
        this.annotationForParentClassWithSummaryKind.set(CompileSummaryKind.Injectable, [createInjectable, createPipe, createDirective, createComponent, createNgModule]);
    }
    StaticReflector.prototype.componentModuleUrl = function (typeOrFunc) {
        var staticSymbol = this.findSymbolDeclaration(typeOrFunc);
        return this.symbolResolver.getResourcePath(staticSymbol);
    };
    /**
     * Invalidate the specified `symbols` on program change.
     * @param symbols
     */
    StaticReflector.prototype.invalidateSymbols = function (symbols) {
        var e_1, _a;
        try {
            for (var symbols_1 = tslib_1.__values(symbols), symbols_1_1 = symbols_1.next(); !symbols_1_1.done; symbols_1_1 = symbols_1.next()) {
                var symbol = symbols_1_1.value;
                this.annotationCache.delete(symbol);
                this.shallowAnnotationCache.delete(symbol);
                this.propertyCache.delete(symbol);
                this.parameterCache.delete(symbol);
                this.methodCache.delete(symbol);
                this.staticCache.delete(symbol);
                this.conversionMap.delete(symbol);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (symbols_1_1 && !symbols_1_1.done && (_a = symbols_1.return)) _a.call(symbols_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    StaticReflector.prototype.resolveExternalReference = function (ref, containingFile) {
        var key = undefined;
        if (!containingFile) {
            key = ref.moduleName + ":" + ref.name;
            var declarationSymbol_1 = this.resolvedExternalReferences.get(key);
            if (declarationSymbol_1)
                return declarationSymbol_1;
        }
        var refSymbol = this.symbolResolver.getSymbolByModule(ref.moduleName, ref.name, containingFile);
        var declarationSymbol = this.findSymbolDeclaration(refSymbol);
        if (!containingFile) {
            this.symbolResolver.recordModuleNameForFileName(refSymbol.filePath, ref.moduleName);
            this.symbolResolver.recordImportAs(declarationSymbol, refSymbol);
        }
        if (key) {
            this.resolvedExternalReferences.set(key, declarationSymbol);
        }
        return declarationSymbol;
    };
    StaticReflector.prototype.findDeclaration = function (moduleUrl, name, containingFile) {
        return this.findSymbolDeclaration(this.symbolResolver.getSymbolByModule(moduleUrl, name, containingFile));
    };
    StaticReflector.prototype.tryFindDeclaration = function (moduleUrl, name, containingFile) {
        var _this = this;
        return this.symbolResolver.ignoreErrorsFor(function () { return _this.findDeclaration(moduleUrl, name, containingFile); });
    };
    StaticReflector.prototype.findSymbolDeclaration = function (symbol) {
        var resolvedSymbol = this.symbolResolver.resolveSymbol(symbol);
        if (resolvedSymbol) {
            var resolvedMetadata = resolvedSymbol.metadata;
            if (resolvedMetadata && resolvedMetadata.__symbolic === 'resolved') {
                resolvedMetadata = resolvedMetadata.symbol;
            }
            if (resolvedMetadata instanceof StaticSymbol) {
                return this.findSymbolDeclaration(resolvedSymbol.metadata);
            }
        }
        return symbol;
    };
    StaticReflector.prototype.tryAnnotations = function (type) {
        var originalRecorder = this.errorRecorder;
        this.errorRecorder = function (error, fileName) { };
        try {
            return this.annotations(type);
        }
        finally {
            this.errorRecorder = originalRecorder;
        }
    };
    StaticReflector.prototype.annotations = function (type) {
        var _this = this;
        return this._annotations(type, function (type, decorators) { return _this.simplify(type, decorators); }, this.annotationCache);
    };
    StaticReflector.prototype.shallowAnnotations = function (type) {
        var _this = this;
        return this._annotations(type, function (type, decorators) { return _this.simplify(type, decorators, true); }, this.shallowAnnotationCache);
    };
    StaticReflector.prototype._annotations = function (type, simplify, annotationCache) {
        var annotations = annotationCache.get(type);
        if (!annotations) {
            annotations = [];
            var classMetadata = this.getTypeMetadata(type);
            var parentType = this.findParentType(type, classMetadata);
            if (parentType) {
                var parentAnnotations = this.annotations(parentType);
                annotations.push.apply(annotations, tslib_1.__spread(parentAnnotations));
            }
            var ownAnnotations_1 = [];
            if (classMetadata['decorators']) {
                ownAnnotations_1 = simplify(type, classMetadata['decorators']);
                if (ownAnnotations_1) {
                    annotations.push.apply(annotations, tslib_1.__spread(ownAnnotations_1));
                }
            }
            if (parentType && !this.summaryResolver.isLibraryFile(type.filePath) &&
                this.summaryResolver.isLibraryFile(parentType.filePath)) {
                var summary = this.summaryResolver.resolveSummary(parentType);
                if (summary && summary.type) {
                    var requiredAnnotationTypes = this.annotationForParentClassWithSummaryKind.get(summary.type.summaryKind);
                    var typeHasRequiredAnnotation = requiredAnnotationTypes.some(function (requiredType) { return ownAnnotations_1.some(function (ann) { return requiredType.isTypeOf(ann); }); });
                    if (!typeHasRequiredAnnotation) {
                        this.reportError(formatMetadataError(metadataError("Class " + type.name + " in " + type.filePath + " extends from a " + CompileSummaryKind[summary.type.summaryKind] + " in another compilation unit without duplicating the decorator", 
                        /* summary */ undefined, "Please add a " + requiredAnnotationTypes.map(function (type) { return type.ngMetadataName; }).join(' or ') + " decorator to the class"), type), type);
                    }
                }
            }
            annotationCache.set(type, annotations.filter(function (ann) { return !!ann; }));
        }
        return annotations;
    };
    StaticReflector.prototype.propMetadata = function (type) {
        var _this = this;
        var propMetadata = this.propertyCache.get(type);
        if (!propMetadata) {
            var classMetadata = this.getTypeMetadata(type);
            propMetadata = {};
            var parentType = this.findParentType(type, classMetadata);
            if (parentType) {
                var parentPropMetadata_1 = this.propMetadata(parentType);
                Object.keys(parentPropMetadata_1).forEach(function (parentProp) {
                    propMetadata[parentProp] = parentPropMetadata_1[parentProp];
                });
            }
            var members_1 = classMetadata['members'] || {};
            Object.keys(members_1).forEach(function (propName) {
                var propData = members_1[propName];
                var prop = propData
                    .find(function (a) { return a['__symbolic'] == 'property' || a['__symbolic'] == 'method'; });
                var decorators = [];
                if (propMetadata[propName]) {
                    decorators.push.apply(decorators, tslib_1.__spread(propMetadata[propName]));
                }
                propMetadata[propName] = decorators;
                if (prop && prop['decorators']) {
                    decorators.push.apply(decorators, tslib_1.__spread(_this.simplify(type, prop['decorators'])));
                }
            });
            this.propertyCache.set(type, propMetadata);
        }
        return propMetadata;
    };
    StaticReflector.prototype.parameters = function (type) {
        var _this = this;
        if (!(type instanceof StaticSymbol)) {
            this.reportError(new Error("parameters received " + JSON.stringify(type) + " which is not a StaticSymbol"), type);
            return [];
        }
        try {
            var parameters_1 = this.parameterCache.get(type);
            if (!parameters_1) {
                var classMetadata = this.getTypeMetadata(type);
                var parentType = this.findParentType(type, classMetadata);
                var members = classMetadata ? classMetadata['members'] : null;
                var ctorData = members ? members['__ctor__'] : null;
                if (ctorData) {
                    var ctor = ctorData.find(function (a) { return a['__symbolic'] == 'constructor'; });
                    var rawParameterTypes = ctor['parameters'] || [];
                    var parameterDecorators_1 = this.simplify(type, ctor['parameterDecorators'] || []);
                    parameters_1 = [];
                    rawParameterTypes.forEach(function (rawParamType, index) {
                        var nestedResult = [];
                        var paramType = _this.trySimplify(type, rawParamType);
                        if (paramType)
                            nestedResult.push(paramType);
                        var decorators = parameterDecorators_1 ? parameterDecorators_1[index] : null;
                        if (decorators) {
                            nestedResult.push.apply(nestedResult, tslib_1.__spread(decorators));
                        }
                        parameters_1.push(nestedResult);
                    });
                }
                else if (parentType) {
                    parameters_1 = this.parameters(parentType);
                }
                if (!parameters_1) {
                    parameters_1 = [];
                }
                this.parameterCache.set(type, parameters_1);
            }
            return parameters_1;
        }
        catch (e) {
            console.error("Failed on type " + JSON.stringify(type) + " with error " + e);
            throw e;
        }
    };
    StaticReflector.prototype._methodNames = function (type) {
        var methodNames = this.methodCache.get(type);
        if (!methodNames) {
            var classMetadata = this.getTypeMetadata(type);
            methodNames = {};
            var parentType = this.findParentType(type, classMetadata);
            if (parentType) {
                var parentMethodNames_1 = this._methodNames(parentType);
                Object.keys(parentMethodNames_1).forEach(function (parentProp) {
                    methodNames[parentProp] = parentMethodNames_1[parentProp];
                });
            }
            var members_2 = classMetadata['members'] || {};
            Object.keys(members_2).forEach(function (propName) {
                var propData = members_2[propName];
                var isMethod = propData.some(function (a) { return a['__symbolic'] == 'method'; });
                methodNames[propName] = methodNames[propName] || isMethod;
            });
            this.methodCache.set(type, methodNames);
        }
        return methodNames;
    };
    StaticReflector.prototype._staticMembers = function (type) {
        var staticMembers = this.staticCache.get(type);
        if (!staticMembers) {
            var classMetadata = this.getTypeMetadata(type);
            var staticMemberData = classMetadata['statics'] || {};
            staticMembers = Object.keys(staticMemberData);
            this.staticCache.set(type, staticMembers);
        }
        return staticMembers;
    };
    StaticReflector.prototype.findParentType = function (type, classMetadata) {
        var parentType = this.trySimplify(type, classMetadata['extends']);
        if (parentType instanceof StaticSymbol) {
            return parentType;
        }
    };
    StaticReflector.prototype.hasLifecycleHook = function (type, lcProperty) {
        if (!(type instanceof StaticSymbol)) {
            this.reportError(new Error("hasLifecycleHook received " + JSON.stringify(type) + " which is not a StaticSymbol"), type);
        }
        try {
            return !!this._methodNames(type)[lcProperty];
        }
        catch (e) {
            console.error("Failed on type " + JSON.stringify(type) + " with error " + e);
            throw e;
        }
    };
    StaticReflector.prototype.guards = function (type) {
        var e_2, _a;
        if (!(type instanceof StaticSymbol)) {
            this.reportError(new Error("guards received " + JSON.stringify(type) + " which is not a StaticSymbol"), type);
            return {};
        }
        var staticMembers = this._staticMembers(type);
        var result = {};
        try {
            for (var staticMembers_1 = tslib_1.__values(staticMembers), staticMembers_1_1 = staticMembers_1.next(); !staticMembers_1_1.done; staticMembers_1_1 = staticMembers_1.next()) {
                var name_1 = staticMembers_1_1.value;
                if (name_1.endsWith(TYPEGUARD_POSTFIX)) {
                    var property = name_1.substr(0, name_1.length - TYPEGUARD_POSTFIX.length);
                    var value = void 0;
                    if (property.endsWith(USE_IF)) {
                        property = name_1.substr(0, property.length - USE_IF.length);
                        value = USE_IF;
                    }
                    else {
                        value = this.getStaticSymbol(type.filePath, type.name, [name_1]);
                    }
                    result[property] = value;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (staticMembers_1_1 && !staticMembers_1_1.done && (_a = staticMembers_1.return)) _a.call(staticMembers_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return result;
    };
    StaticReflector.prototype._registerDecoratorOrConstructor = function (type, ctor) {
        this.conversionMap.set(type, function (context, args) { return new (ctor.bind.apply(ctor, tslib_1.__spread([void 0], args)))(); });
    };
    StaticReflector.prototype._registerFunction = function (type, fn) {
        this.conversionMap.set(type, function (context, args) { return fn.apply(undefined, args); });
    };
    StaticReflector.prototype.initializeConversionMap = function () {
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
    };
    /**
     * getStaticSymbol produces a Type whose metadata is known but whose implementation is not loaded.
     * All types passed to the StaticResolver should be pseudo-types returned by this method.
     *
     * @param declarationFile the absolute path of the file where the symbol is declared
     * @param name the name of the type.
     */
    StaticReflector.prototype.getStaticSymbol = function (declarationFile, name, members) {
        return this.symbolResolver.getStaticSymbol(declarationFile, name, members);
    };
    /**
     * Simplify but discard any errors
     */
    StaticReflector.prototype.trySimplify = function (context, value) {
        var originalRecorder = this.errorRecorder;
        this.errorRecorder = function (error, fileName) { };
        var result = this.simplify(context, value);
        this.errorRecorder = originalRecorder;
        return result;
    };
    /** @internal */
    StaticReflector.prototype.simplify = function (context, value, lazy) {
        if (lazy === void 0) { lazy = false; }
        var self = this;
        var scope = BindingScope.empty;
        var calling = new Map();
        var rootContext = context;
        function simplifyInContext(context, value, depth, references) {
            function resolveReferenceValue(staticSymbol) {
                var resolvedSymbol = self.symbolResolver.resolveSymbol(staticSymbol);
                return resolvedSymbol ? resolvedSymbol.metadata : null;
            }
            function simplifyEagerly(value) {
                return simplifyInContext(context, value, depth, 0);
            }
            function simplifyLazily(value) {
                return simplifyInContext(context, value, depth, references + 1);
            }
            function simplifyNested(nestedContext, value) {
                if (nestedContext === context) {
                    // If the context hasn't changed let the exception propagate unmodified.
                    return simplifyInContext(nestedContext, value, depth + 1, references);
                }
                try {
                    return simplifyInContext(nestedContext, value, depth + 1, references);
                }
                catch (e) {
                    if (isMetadataError(e)) {
                        // Propagate the message text up but add a message to the chain that explains how we got
                        // here.
                        // e.chain implies e.symbol
                        var summaryMsg = e.chain ? 'references \'' + e.symbol.name + '\'' : errorSummary(e);
                        var summary = "'" + nestedContext.name + "' " + summaryMsg;
                        var chain = { message: summary, position: e.position, next: e.chain };
                        // TODO(chuckj): retrieve the position information indirectly from the collectors node
                        // map if the metadata is from a .ts file.
                        self.error({
                            message: e.message,
                            advise: e.advise,
                            context: e.context, chain: chain,
                            symbol: nestedContext
                        }, context);
                    }
                    else {
                        // It is probably an internal error.
                        throw e;
                    }
                }
            }
            function simplifyCall(functionSymbol, targetFunction, args, targetExpression) {
                if (targetFunction && targetFunction['__symbolic'] == 'function') {
                    if (calling.get(functionSymbol)) {
                        self.error({
                            message: 'Recursion is not supported',
                            summary: "called '" + functionSymbol.name + "' recursively",
                            value: targetFunction
                        }, functionSymbol);
                    }
                    try {
                        var value_1 = targetFunction['value'];
                        if (value_1 && (depth != 0 || value_1.__symbolic != 'error')) {
                            var parameters = targetFunction['parameters'];
                            var defaults = targetFunction.defaults;
                            args = args.map(function (arg) { return simplifyNested(context, arg); })
                                .map(function (arg) { return shouldIgnore(arg) ? undefined : arg; });
                            if (defaults && defaults.length > args.length) {
                                args.push.apply(args, tslib_1.__spread(defaults.slice(args.length).map(function (value) { return simplify(value); })));
                            }
                            calling.set(functionSymbol, true);
                            var functionScope = BindingScope.build();
                            for (var i = 0; i < parameters.length; i++) {
                                functionScope.define(parameters[i], args[i]);
                            }
                            var oldScope = scope;
                            var result_1;
                            try {
                                scope = functionScope.done();
                                result_1 = simplifyNested(functionSymbol, value_1);
                            }
                            finally {
                                scope = oldScope;
                            }
                            return result_1;
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
                var position = undefined;
                if (targetExpression && targetExpression.__symbolic == 'resolved') {
                    var line = targetExpression.line;
                    var character = targetExpression.character;
                    var fileName = targetExpression.fileName;
                    if (fileName != null && line != null && character != null) {
                        position = { fileName: fileName, line: line, column: character };
                    }
                }
                self.error({
                    message: FUNCTION_CALL_NOT_SUPPORTED,
                    context: functionSymbol,
                    value: targetFunction, position: position
                }, context);
            }
            function simplify(expression) {
                var e_3, _a, e_4, _b;
                if (isPrimitive(expression)) {
                    return expression;
                }
                if (expression instanceof Array) {
                    var result_2 = [];
                    try {
                        for (var _c = tslib_1.__values(expression), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var item = _d.value;
                            // Check for a spread expression
                            if (item && item.__symbolic === 'spread') {
                                // We call with references as 0 because we require the actual value and cannot
                                // tolerate a reference here.
                                var spreadArray = simplifyEagerly(item.expression);
                                if (Array.isArray(spreadArray)) {
                                    try {
                                        for (var spreadArray_1 = (e_4 = void 0, tslib_1.__values(spreadArray)), spreadArray_1_1 = spreadArray_1.next(); !spreadArray_1_1.done; spreadArray_1_1 = spreadArray_1.next()) {
                                            var spreadItem = spreadArray_1_1.value;
                                            result_2.push(spreadItem);
                                        }
                                    }
                                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                                    finally {
                                        try {
                                            if (spreadArray_1_1 && !spreadArray_1_1.done && (_b = spreadArray_1.return)) _b.call(spreadArray_1);
                                        }
                                        finally { if (e_4) throw e_4.error; }
                                    }
                                    continue;
                                }
                            }
                            var value_2 = simplify(item);
                            if (shouldIgnore(value_2)) {
                                continue;
                            }
                            result_2.push(value_2);
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                    return result_2;
                }
                if (expression instanceof StaticSymbol) {
                    // Stop simplification at builtin symbols or if we are in a reference context and
                    // the symbol doesn't have members.
                    if (expression === self.injectionToken || self.conversionMap.has(expression) ||
                        (references > 0 && !expression.members.length)) {
                        return expression;
                    }
                    else {
                        var staticSymbol = expression;
                        var declarationValue = resolveReferenceValue(staticSymbol);
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
                        var staticSymbol = void 0;
                        switch (expression['__symbolic']) {
                            case 'binop':
                                var left = simplify(expression['left']);
                                if (shouldIgnore(left))
                                    return left;
                                var right = simplify(expression['right']);
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
                                var condition = simplify(expression['condition']);
                                return condition ? simplify(expression['thenExpression']) :
                                    simplify(expression['elseExpression']);
                            case 'pre':
                                var operand = simplify(expression['operand']);
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
                                var indexTarget = simplifyEagerly(expression['expression']);
                                var index = simplifyEagerly(expression['index']);
                                if (indexTarget && isPrimitive(index))
                                    return indexTarget[index];
                                return null;
                            case 'select':
                                var member = expression['member'];
                                var selectContext = context;
                                var selectTarget = simplify(expression['expression']);
                                if (selectTarget instanceof StaticSymbol) {
                                    var members = selectTarget.members.concat(member);
                                    selectContext =
                                        self.getStaticSymbol(selectTarget.filePath, selectTarget.name, members);
                                    var declarationValue = resolveReferenceValue(selectContext);
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
                                var name_2 = expression['name'];
                                var localValue = scope.resolve(name_2);
                                if (localValue != BindingScope.missing) {
                                    return localValue;
                                }
                                break;
                            case 'resolved':
                                try {
                                    return simplify(expression.symbol);
                                }
                                catch (e) {
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
                                    var argExpressions = expression['arguments'] || [];
                                    var converter = self.conversionMap.get(staticSymbol);
                                    if (converter) {
                                        var args = argExpressions.map(function (arg) { return simplifyNested(context, arg); })
                                            .map(function (arg) { return shouldIgnore(arg) ? undefined : arg; });
                                        return converter(context, args);
                                    }
                                    else {
                                        // Determine if the function is one we can simplify.
                                        var targetFunction = resolveReferenceValue(staticSymbol);
                                        return simplifyCall(staticSymbol, targetFunction, argExpressions, expression['expression']);
                                    }
                                }
                                return IGNORE;
                            case 'error':
                                var message = expression.message;
                                if (expression['line'] != null) {
                                    self.error({
                                        message: message,
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
                                    self.error({ message: message, context: expression.context }, context);
                                }
                                return IGNORE;
                            case 'ignore':
                                return expression;
                        }
                        return null;
                    }
                    return mapStringMap(expression, function (value, name) {
                        if (REFERENCE_SET.has(name)) {
                            if (name === USE_VALUE && PROVIDE in expression) {
                                // If this is a provider expression, check for special tokens that need the value
                                // during analysis.
                                var provide = simplify(expression.provide);
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
        var result;
        try {
            result = simplifyInContext(context, value, 0, lazy ? 1 : 0);
        }
        catch (e) {
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
    };
    StaticReflector.prototype.getTypeMetadata = function (type) {
        var resolvedSymbol = this.symbolResolver.resolveSymbol(type);
        return resolvedSymbol && resolvedSymbol.metadata ? resolvedSymbol.metadata :
            { __symbolic: 'class' };
    };
    StaticReflector.prototype.reportError = function (error, context, path) {
        if (this.errorRecorder) {
            this.errorRecorder(formatMetadataError(error, context), (context && context.filePath) || path);
        }
        else {
            throw error;
        }
    };
    StaticReflector.prototype.error = function (_a, reportingContext) {
        var message = _a.message, summary = _a.summary, advise = _a.advise, position = _a.position, context = _a.context, value = _a.value, symbol = _a.symbol, chain = _a.chain;
        this.reportError(metadataError(message, summary, advise, position, symbol, context, chain), reportingContext);
    };
    return StaticReflector;
}());
export { StaticReflector };
var METADATA_ERROR = 'ngMetadataError';
function metadataError(message, summary, advise, position, symbol, context, chain) {
    var error = syntaxError(message);
    error[METADATA_ERROR] = true;
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
function isMetadataError(error) {
    return !!error[METADATA_ERROR];
}
var REFERENCE_TO_NONEXPORTED_CLASS = 'Reference to non-exported class';
var VARIABLE_NOT_INITIALIZED = 'Variable not initialized';
var DESTRUCTURE_NOT_SUPPORTED = 'Destructuring not supported';
var COULD_NOT_RESOLVE_TYPE = 'Could not resolve type';
var FUNCTION_CALL_NOT_SUPPORTED = 'Function call not supported';
var REFERENCE_TO_LOCAL_SYMBOL = 'Reference to a local symbol';
var LAMBDA_NOT_SUPPORTED = 'Lambda not supported';
function expandedMessage(message, context) {
    switch (message) {
        case REFERENCE_TO_NONEXPORTED_CLASS:
            if (context && context.className) {
                return "References to a non-exported class are not supported in decorators but " + context.className + " was referenced.";
            }
            break;
        case VARIABLE_NOT_INITIALIZED:
            return 'Only initialized variables and constants can be referenced in decorators because the value of this variable is needed by the template compiler';
        case DESTRUCTURE_NOT_SUPPORTED:
            return 'Referencing an exported destructured variable or constant is not supported in decorators and this value is needed by the template compiler';
        case COULD_NOT_RESOLVE_TYPE:
            if (context && context.typeName) {
                return "Could not resolve type " + context.typeName;
            }
            break;
        case FUNCTION_CALL_NOT_SUPPORTED:
            if (context && context.name) {
                return "Function calls are not supported in decorators but '" + context.name + "' was called";
            }
            return 'Function calls are not supported in decorators';
        case REFERENCE_TO_LOCAL_SYMBOL:
            if (context && context.name) {
                return "Reference to a local (non-exported) symbols are not supported in decorators but '" + context.name + "' was referenced";
            }
            break;
        case LAMBDA_NOT_SUPPORTED:
            return "Function expressions are not supported in decorators";
    }
    return message;
}
function messageAdvise(message, context) {
    switch (message) {
        case REFERENCE_TO_NONEXPORTED_CLASS:
            if (context && context.className) {
                return "Consider exporting '" + context.className + "'";
            }
            break;
        case DESTRUCTURE_NOT_SUPPORTED:
            return 'Consider simplifying to avoid destructuring';
        case REFERENCE_TO_LOCAL_SYMBOL:
            if (context && context.name) {
                return "Consider exporting '" + context.name + "'";
            }
            break;
        case LAMBDA_NOT_SUPPORTED:
            return "Consider changing the function expression into an exported function";
    }
    return undefined;
}
function errorSummary(error) {
    if (error.summary) {
        return error.summary;
    }
    switch (error.message) {
        case REFERENCE_TO_NONEXPORTED_CLASS:
            if (error.context && error.context.className) {
                return "references non-exported class " + error.context.className;
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
                return "calls '" + error.context.name + "'";
            }
            return "calls a function";
        case REFERENCE_TO_LOCAL_SYMBOL:
            if (error.context && error.context.name) {
                return "references local variable " + error.context.name;
            }
            return "references a local variable";
    }
    return 'contains the error';
}
function mapStringMap(input, transform) {
    if (!input)
        return {};
    var result = {};
    Object.keys(input).forEach(function (key) {
        var value = transform(input[key], key);
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
function isPrimitive(o) {
    return o === null || (typeof o !== 'function' && typeof o !== 'object');
}
var BindingScope = /** @class */ (function () {
    function BindingScope() {
    }
    BindingScope.build = function () {
        var current = new Map();
        return {
            define: function (name, value) {
                current.set(name, value);
                return this;
            },
            done: function () {
                return current.size > 0 ? new PopulatedScope(current) : BindingScope.empty;
            }
        };
    };
    BindingScope.missing = {};
    BindingScope.empty = { resolve: function (name) { return BindingScope.missing; } };
    return BindingScope;
}());
var PopulatedScope = /** @class */ (function (_super) {
    tslib_1.__extends(PopulatedScope, _super);
    function PopulatedScope(bindings) {
        var _this = _super.call(this) || this;
        _this.bindings = bindings;
        return _this;
    }
    PopulatedScope.prototype.resolve = function (name) {
        return this.bindings.has(name) ? this.bindings.get(name) : BindingScope.missing;
    };
    return PopulatedScope;
}(BindingScope));
function formatMetadataMessageChain(chain, advise) {
    var expanded = expandedMessage(chain.message, chain.context);
    var nesting = chain.symbol ? " in '" + chain.symbol.name + "'" : '';
    var message = "" + expanded + nesting;
    var position = chain.position;
    var next = chain.next ?
        formatMetadataMessageChain(chain.next, advise) :
        advise ? { message: advise } : undefined;
    return { message: message, position: position, next: next };
}
function formatMetadataError(e, context) {
    if (isMetadataError(e)) {
        // Produce a formatted version of the and leaving enough information in the original error
        // to recover the formatting information to eventually produce a diagnostic error message.
        var position = e.position;
        var chain = {
            message: "Error during template compile of '" + context.name + "'",
            position: position,
            next: { message: e.message, next: e.chain, context: e.context, symbol: e.symbol }
        };
        var advise = e.advise || messageAdvise(e.message, e.context);
        return formattedError(formatMetadataMessageChain(chain, advise));
    }
    return e;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3JlZmxlY3Rvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3Qvc3RhdGljX3JlZmxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFFdkQsT0FBTyxFQUFrQixlQUFlLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFHalcsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVwQyxPQUFPLEVBQXdCLGNBQWMsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3hFLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUc3QyxJQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7QUFDckMsSUFBTSxjQUFjLEdBQUcsaUJBQWlCLENBQUM7QUFFekMsSUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDO0FBRTlCLElBQU0sTUFBTSxHQUFHO0lBQ2IsVUFBVSxFQUFFLFFBQVE7Q0FDckIsQ0FBQztBQUVGLElBQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQztBQUM3QixJQUFNLE9BQU8sR0FBRyxTQUFTLENBQUM7QUFDMUIsSUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FB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Q0FBQztvQ0FDdkIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxJQUFJO3dDQUNQLE9BQU8sSUFBSSxJQUFJLEtBQUssQ0FBQztvQ0FDdkIsS0FBSyxJQUFJO3dDQUNQLE9BQU8sSUFBSSxJQUFJLEtBQUssQ0FBQztvQ0FDdkIsS0FBSyxLQUFLO3dDQUNSLE9BQU8sSUFBSSxLQUFLLEtBQUssQ0FBQztvQ0FDeEIsS0FBSyxLQUFLO3dDQUNSLE9BQU8sSUFBSSxLQUFLLEtBQUssQ0FBQztvQ0FDeEIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxJQUFJO3dDQUNQLE9BQU8sSUFBSSxJQUFJLEtBQUssQ0FBQztvQ0FDdkIsS0FBSyxJQUFJO3dDQUNQLE9BQU8sSUFBSSxJQUFJLEtBQUssQ0FBQztvQ0FDdkIsS0FBSyxJQUFJO3dDQUNQLE9BQU8sSUFBSSxJQUFJLEtBQUssQ0FBQztvQ0FDdkIsS0FBSyxJQUFJO3dDQUNQLE9BQU8sSUFBSSxJQUFJLEtBQUssQ0FBQztvQ0FDdkIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztvQ0FDdEIsS0FBSyxHQUFHO3dDQUNOLE9BQU8sSUFBSSxHQUFHLEtBQUssQ0FBQztpQ0FDdkI7Z0NBQ0QsT0FBTyxJQUFJLENBQUM7NEJB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S0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7S0FDbEU7SUFDRCxPQUFPLENBQUMsQ0FBQztBQUNYLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZVN1bW1hcnlLaW5kfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtNZXRhZGF0YUZhY3RvcnksIGNyZWF0ZUF0dHJpYnV0ZSwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVDb250ZW50Q2hpbGQsIGNyZWF0ZUNvbnRlbnRDaGlsZHJlbiwgY3JlYXRlRGlyZWN0aXZlLCBjcmVhdGVIb3N0LCBjcmVhdGVIb3N0QmluZGluZywgY3JlYXRlSG9zdExpc3RlbmVyLCBjcmVhdGVJbmplY3QsIGNyZWF0ZUluamVjdGFibGUsIGNyZWF0ZUlucHV0LCBjcmVhdGVOZ01vZHVsZSwgY3JlYXRlT3B0aW9uYWwsIGNyZWF0ZU91dHB1dCwgY3JlYXRlUGlwZSwgY3JlYXRlU2VsZiwgY3JlYXRlU2tpcFNlbGYsIGNyZWF0ZVZpZXdDaGlsZCwgY3JlYXRlVmlld0NoaWxkcmVufSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtTdW1tYXJ5UmVzb2x2ZXJ9IGZyb20gJy4uL3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtzeW50YXhFcnJvcn0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7Rm9ybWF0dGVkTWVzc2FnZUNoYWluLCBmb3JtYXR0ZWRFcnJvcn0gZnJvbSAnLi9mb3JtYXR0ZWRfZXJyb3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4vc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge1N0YXRpY1N5bWJvbFJlc29sdmVyfSBmcm9tICcuL3N0YXRpY19zeW1ib2xfcmVzb2x2ZXInO1xuXG5jb25zdCBBTkdVTEFSX0NPUkUgPSAnQGFuZ3VsYXIvY29yZSc7XG5jb25zdCBBTkdVTEFSX1JPVVRFUiA9ICdAYW5ndWxhci9yb3V0ZXInO1xuXG5jb25zdCBISURERU5fS0VZID0gL15cXCQuKlxcJCQvO1xuXG5jb25zdCBJR05PUkUgPSB7XG4gIF9fc3ltYm9saWM6ICdpZ25vcmUnXG59O1xuXG5jb25zdCBVU0VfVkFMVUUgPSAndXNlVmFsdWUnO1xuY29uc3QgUFJPVklERSA9ICdwcm92aWRlJztcbmNvbnN0IFJFRkVSRU5DRV9TRVQgPSBuZXcgU2V0KFtVU0VfVkFMVUUsICd1c2VGYWN0b3J5JywgJ2RhdGEnLCAnaWQnLCAnbG9hZENoaWxkcmVuJ10pO1xuY29uc3QgVFlQRUdVQVJEX1BPU1RGSVggPSAnVHlwZUd1YXJkJztcbmNvbnN0IFVTRV9JRiA9ICdVc2VJZic7XG5cbmZ1bmN0aW9uIHNob3VsZElnbm9yZSh2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiB2YWx1ZSAmJiB2YWx1ZS5fX3N5bWJvbGljID09ICdpZ25vcmUnO1xufVxuXG4vKipcbiAqIEEgc3RhdGljIHJlZmxlY3RvciBpbXBsZW1lbnRzIGVub3VnaCBvZiB0aGUgUmVmbGVjdG9yIEFQSSB0aGF0IGlzIG5lY2Vzc2FyeSB0byBjb21waWxlXG4gKiB0ZW1wbGF0ZXMgc3RhdGljYWxseS5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0YXRpY1JlZmxlY3RvciBpbXBsZW1lbnRzIENvbXBpbGVSZWZsZWN0b3Ige1xuICBwcml2YXRlIGFubm90YXRpb25DYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBhbnlbXT4oKTtcbiAgcHJpdmF0ZSBzaGFsbG93QW5ub3RhdGlvbkNhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIGFueVtdPigpO1xuICBwcml2YXRlIHByb3BlcnR5Q2FjaGUgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwge1trZXk6IHN0cmluZ106IGFueVtdfT4oKTtcbiAgcHJpdmF0ZSBwYXJhbWV0ZXJDYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBhbnlbXT4oKTtcbiAgcHJpdmF0ZSBtZXRob2RDYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCB7W2tleTogc3RyaW5nXTogYm9vbGVhbn0+KCk7XG4gIHByaXZhdGUgc3RhdGljQ2FjaGUgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwgc3RyaW5nW10+KCk7XG4gIHByaXZhdGUgY29udmVyc2lvbk1hcCA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCAoY29udGV4dDogU3RhdGljU3ltYm9sLCBhcmdzOiBhbnlbXSkgPT4gYW55PigpO1xuICBwcml2YXRlIHJlc29sdmVkRXh0ZXJuYWxSZWZlcmVuY2VzID0gbmV3IE1hcDxzdHJpbmcsIFN0YXRpY1N5bWJvbD4oKTtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgaW5qZWN0aW9uVG9rZW4gITogU3RhdGljU3ltYm9sO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBvcGFxdWVUb2tlbiAhOiBTdGF0aWNTeW1ib2w7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBST1VURVMgITogU3RhdGljU3ltYm9sO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBBTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTICE6IFN0YXRpY1N5bWJvbDtcbiAgcHJpdmF0ZSBhbm5vdGF0aW9uRm9yUGFyZW50Q2xhc3NXaXRoU3VtbWFyeUtpbmQgPVxuICAgICAgbmV3IE1hcDxDb21waWxlU3VtbWFyeUtpbmQsIE1ldGFkYXRhRmFjdG9yeTxhbnk+W10+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHN1bW1hcnlSZXNvbHZlcjogU3VtbWFyeVJlc29sdmVyPFN0YXRpY1N5bWJvbD4sXG4gICAgICBwcml2YXRlIHN5bWJvbFJlc29sdmVyOiBTdGF0aWNTeW1ib2xSZXNvbHZlcixcbiAgICAgIGtub3duTWV0YWRhdGFDbGFzc2VzOiB7bmFtZTogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nLCBjdG9yOiBhbnl9W10gPSBbXSxcbiAgICAgIGtub3duTWV0YWRhdGFGdW5jdGlvbnM6IHtuYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcsIGZuOiBhbnl9W10gPSBbXSxcbiAgICAgIHByaXZhdGUgZXJyb3JSZWNvcmRlcj86IChlcnJvcjogYW55LCBmaWxlTmFtZT86IHN0cmluZykgPT4gdm9pZCkge1xuICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnZlcnNpb25NYXAoKTtcbiAgICBrbm93bk1ldGFkYXRhQ2xhc3Nlcy5mb3JFYWNoKFxuICAgICAgICAoa2MpID0+IHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHRoaXMuZ2V0U3RhdGljU3ltYm9sKGtjLmZpbGVQYXRoLCBrYy5uYW1lKSwga2MuY3RvcikpO1xuICAgIGtub3duTWV0YWRhdGFGdW5jdGlvbnMuZm9yRWFjaChcbiAgICAgICAgKGtmKSA9PiB0aGlzLl9yZWdpc3RlckZ1bmN0aW9uKHRoaXMuZ2V0U3RhdGljU3ltYm9sKGtmLmZpbGVQYXRoLCBrZi5uYW1lKSwga2YuZm4pKTtcbiAgICB0aGlzLmFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZC5zZXQoXG4gICAgICAgIENvbXBpbGVTdW1tYXJ5S2luZC5EaXJlY3RpdmUsIFtjcmVhdGVEaXJlY3RpdmUsIGNyZWF0ZUNvbXBvbmVudF0pO1xuICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLnNldChDb21waWxlU3VtbWFyeUtpbmQuUGlwZSwgW2NyZWF0ZVBpcGVdKTtcbiAgICB0aGlzLmFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZC5zZXQoQ29tcGlsZVN1bW1hcnlLaW5kLk5nTW9kdWxlLCBbY3JlYXRlTmdNb2R1bGVdKTtcbiAgICB0aGlzLmFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZC5zZXQoXG4gICAgICAgIENvbXBpbGVTdW1tYXJ5S2luZC5JbmplY3RhYmxlLFxuICAgICAgICBbY3JlYXRlSW5qZWN0YWJsZSwgY3JlYXRlUGlwZSwgY3JlYXRlRGlyZWN0aXZlLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZU5nTW9kdWxlXSk7XG4gIH1cblxuICBjb21wb25lbnRNb2R1bGVVcmwodHlwZU9yRnVuYzogU3RhdGljU3ltYm9sKTogc3RyaW5nIHtcbiAgICBjb25zdCBzdGF0aWNTeW1ib2wgPSB0aGlzLmZpbmRTeW1ib2xEZWNsYXJhdGlvbih0eXBlT3JGdW5jKTtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xSZXNvbHZlci5nZXRSZXNvdXJjZVBhdGgoc3RhdGljU3ltYm9sKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZhbGlkYXRlIHRoZSBzcGVjaWZpZWQgYHN5bWJvbHNgIG9uIHByb2dyYW0gY2hhbmdlLlxuICAgKiBAcGFyYW0gc3ltYm9sc1xuICAgKi9cbiAgaW52YWxpZGF0ZVN5bWJvbHMoc3ltYm9sczogU3RhdGljU3ltYm9sW10pIHtcbiAgICBmb3IgKGNvbnN0IHN5bWJvbCBvZiBzeW1ib2xzKSB7XG4gICAgICB0aGlzLmFubm90YXRpb25DYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMuc2hhbGxvd0Fubm90YXRpb25DYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMucHJvcGVydHlDYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMucGFyYW1ldGVyQ2FjaGUuZGVsZXRlKHN5bWJvbCk7XG4gICAgICB0aGlzLm1ldGhvZENhY2hlLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgdGhpcy5zdGF0aWNDYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMuY29udmVyc2lvbk1hcC5kZWxldGUoc3ltYm9sKTtcbiAgICB9XG4gIH1cblxuICByZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UocmVmOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IFN0YXRpY1N5bWJvbCB7XG4gICAgbGV0IGtleTogc3RyaW5nfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAoIWNvbnRhaW5pbmdGaWxlKSB7XG4gICAgICBrZXkgPSBgJHtyZWYubW9kdWxlTmFtZX06JHtyZWYubmFtZX1gO1xuICAgICAgY29uc3QgZGVjbGFyYXRpb25TeW1ib2wgPSB0aGlzLnJlc29sdmVkRXh0ZXJuYWxSZWZlcmVuY2VzLmdldChrZXkpO1xuICAgICAgaWYgKGRlY2xhcmF0aW9uU3ltYm9sKSByZXR1cm4gZGVjbGFyYXRpb25TeW1ib2w7XG4gICAgfVxuICAgIGNvbnN0IHJlZlN5bWJvbCA9XG4gICAgICAgIHRoaXMuc3ltYm9sUmVzb2x2ZXIuZ2V0U3ltYm9sQnlNb2R1bGUocmVmLm1vZHVsZU5hbWUgISwgcmVmLm5hbWUgISwgY29udGFpbmluZ0ZpbGUpO1xuICAgIGNvbnN0IGRlY2xhcmF0aW9uU3ltYm9sID0gdGhpcy5maW5kU3ltYm9sRGVjbGFyYXRpb24ocmVmU3ltYm9sKTtcbiAgICBpZiAoIWNvbnRhaW5pbmdGaWxlKSB7XG4gICAgICB0aGlzLnN5bWJvbFJlc29sdmVyLnJlY29yZE1vZHVsZU5hbWVGb3JGaWxlTmFtZShyZWZTeW1ib2wuZmlsZVBhdGgsIHJlZi5tb2R1bGVOYW1lICEpO1xuICAgICAgdGhpcy5zeW1ib2xSZXNvbHZlci5yZWNvcmRJbXBvcnRBcyhkZWNsYXJhdGlvblN5bWJvbCwgcmVmU3ltYm9sKTtcbiAgICB9XG4gICAgaWYgKGtleSkge1xuICAgICAgdGhpcy5yZXNvbHZlZEV4dGVybmFsUmVmZXJlbmNlcy5zZXQoa2V5LCBkZWNsYXJhdGlvblN5bWJvbCk7XG4gICAgfVxuICAgIHJldHVybiBkZWNsYXJhdGlvblN5bWJvbDtcbiAgfVxuXG4gIGZpbmREZWNsYXJhdGlvbihtb2R1bGVVcmw6IHN0cmluZywgbmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IFN0YXRpY1N5bWJvbCB7XG4gICAgcmV0dXJuIHRoaXMuZmluZFN5bWJvbERlY2xhcmF0aW9uKFxuICAgICAgICB0aGlzLnN5bWJvbFJlc29sdmVyLmdldFN5bWJvbEJ5TW9kdWxlKG1vZHVsZVVybCwgbmFtZSwgY29udGFpbmluZ0ZpbGUpKTtcbiAgfVxuXG4gIHRyeUZpbmREZWNsYXJhdGlvbihtb2R1bGVVcmw6IHN0cmluZywgbmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IFN0YXRpY1N5bWJvbCB7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9sUmVzb2x2ZXIuaWdub3JlRXJyb3JzRm9yKFxuICAgICAgICAoKSA9PiB0aGlzLmZpbmREZWNsYXJhdGlvbihtb2R1bGVVcmwsIG5hbWUsIGNvbnRhaW5pbmdGaWxlKSk7XG4gIH1cblxuICBmaW5kU3ltYm9sRGVjbGFyYXRpb24oc3ltYm9sOiBTdGF0aWNTeW1ib2wpOiBTdGF0aWNTeW1ib2wge1xuICAgIGNvbnN0IHJlc29sdmVkU3ltYm9sID0gdGhpcy5zeW1ib2xSZXNvbHZlci5yZXNvbHZlU3ltYm9sKHN5bWJvbCk7XG4gICAgaWYgKHJlc29sdmVkU3ltYm9sKSB7XG4gICAgICBsZXQgcmVzb2x2ZWRNZXRhZGF0YSA9IHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhO1xuICAgICAgaWYgKHJlc29sdmVkTWV0YWRhdGEgJiYgcmVzb2x2ZWRNZXRhZGF0YS5fX3N5bWJvbGljID09PSAncmVzb2x2ZWQnKSB7XG4gICAgICAgIHJlc29sdmVkTWV0YWRhdGEgPSByZXNvbHZlZE1ldGFkYXRhLnN5bWJvbDtcbiAgICAgIH1cbiAgICAgIGlmIChyZXNvbHZlZE1ldGFkYXRhIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbmRTeW1ib2xEZWNsYXJhdGlvbihyZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzeW1ib2w7XG4gIH1cblxuICBwdWJsaWMgdHJ5QW5ub3RhdGlvbnModHlwZTogU3RhdGljU3ltYm9sKTogYW55W10ge1xuICAgIGNvbnN0IG9yaWdpbmFsUmVjb3JkZXIgPSB0aGlzLmVycm9yUmVjb3JkZXI7XG4gICAgdGhpcy5lcnJvclJlY29yZGVyID0gKGVycm9yOiBhbnksIGZpbGVOYW1lPzogc3RyaW5nKSA9PiB7fTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMuYW5ub3RhdGlvbnModHlwZSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuZXJyb3JSZWNvcmRlciA9IG9yaWdpbmFsUmVjb3JkZXI7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFubm90YXRpb25zKHR5cGU6IFN0YXRpY1N5bWJvbCk6IGFueVtdIHtcbiAgICByZXR1cm4gdGhpcy5fYW5ub3RhdGlvbnMoXG4gICAgICAgIHR5cGUsICh0eXBlOiBTdGF0aWNTeW1ib2wsIGRlY29yYXRvcnM6IGFueSkgPT4gdGhpcy5zaW1wbGlmeSh0eXBlLCBkZWNvcmF0b3JzKSxcbiAgICAgICAgdGhpcy5hbm5vdGF0aW9uQ2FjaGUpO1xuICB9XG5cbiAgcHVibGljIHNoYWxsb3dBbm5vdGF0aW9ucyh0eXBlOiBTdGF0aWNTeW1ib2wpOiBhbnlbXSB7XG4gICAgcmV0dXJuIHRoaXMuX2Fubm90YXRpb25zKFxuICAgICAgICB0eXBlLCAodHlwZTogU3RhdGljU3ltYm9sLCBkZWNvcmF0b3JzOiBhbnkpID0+IHRoaXMuc2ltcGxpZnkodHlwZSwgZGVjb3JhdG9ycywgdHJ1ZSksXG4gICAgICAgIHRoaXMuc2hhbGxvd0Fubm90YXRpb25DYWNoZSk7XG4gIH1cblxuICBwcml2YXRlIF9hbm5vdGF0aW9ucyhcbiAgICAgIHR5cGU6IFN0YXRpY1N5bWJvbCwgc2ltcGxpZnk6ICh0eXBlOiBTdGF0aWNTeW1ib2wsIGRlY29yYXRvcnM6IGFueSkgPT4gYW55LFxuICAgICAgYW5ub3RhdGlvbkNhY2hlOiBNYXA8U3RhdGljU3ltYm9sLCBhbnlbXT4pOiBhbnlbXSB7XG4gICAgbGV0IGFubm90YXRpb25zID0gYW5ub3RhdGlvbkNhY2hlLmdldCh0eXBlKTtcbiAgICBpZiAoIWFubm90YXRpb25zKSB7XG4gICAgICBhbm5vdGF0aW9ucyA9IFtdO1xuICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHRoaXMuZmluZFBhcmVudFR5cGUodHlwZSwgY2xhc3NNZXRhZGF0YSk7XG4gICAgICBpZiAocGFyZW50VHlwZSkge1xuICAgICAgICBjb25zdCBwYXJlbnRBbm5vdGF0aW9ucyA9IHRoaXMuYW5ub3RhdGlvbnMocGFyZW50VHlwZSk7XG4gICAgICAgIGFubm90YXRpb25zLnB1c2goLi4ucGFyZW50QW5ub3RhdGlvbnMpO1xuICAgICAgfVxuICAgICAgbGV0IG93bkFubm90YXRpb25zOiBhbnlbXSA9IFtdO1xuICAgICAgaWYgKGNsYXNzTWV0YWRhdGFbJ2RlY29yYXRvcnMnXSkge1xuICAgICAgICBvd25Bbm5vdGF0aW9ucyA9IHNpbXBsaWZ5KHR5cGUsIGNsYXNzTWV0YWRhdGFbJ2RlY29yYXRvcnMnXSk7XG4gICAgICAgIGlmIChvd25Bbm5vdGF0aW9ucykge1xuICAgICAgICAgIGFubm90YXRpb25zLnB1c2goLi4ub3duQW5ub3RhdGlvbnMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocGFyZW50VHlwZSAmJiAhdGhpcy5zdW1tYXJ5UmVzb2x2ZXIuaXNMaWJyYXJ5RmlsZSh0eXBlLmZpbGVQYXRoKSAmJlxuICAgICAgICAgIHRoaXMuc3VtbWFyeVJlc29sdmVyLmlzTGlicmFyeUZpbGUocGFyZW50VHlwZS5maWxlUGF0aCkpIHtcbiAgICAgICAgY29uc3Qgc3VtbWFyeSA9IHRoaXMuc3VtbWFyeVJlc29sdmVyLnJlc29sdmVTdW1tYXJ5KHBhcmVudFR5cGUpO1xuICAgICAgICBpZiAoc3VtbWFyeSAmJiBzdW1tYXJ5LnR5cGUpIHtcbiAgICAgICAgICBjb25zdCByZXF1aXJlZEFubm90YXRpb25UeXBlcyA9XG4gICAgICAgICAgICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLmdldChzdW1tYXJ5LnR5cGUuc3VtbWFyeUtpbmQgISkgITtcbiAgICAgICAgICBjb25zdCB0eXBlSGFzUmVxdWlyZWRBbm5vdGF0aW9uID0gcmVxdWlyZWRBbm5vdGF0aW9uVHlwZXMuc29tZShcbiAgICAgICAgICAgICAgKHJlcXVpcmVkVHlwZSkgPT4gb3duQW5ub3RhdGlvbnMuc29tZShhbm4gPT4gcmVxdWlyZWRUeXBlLmlzVHlwZU9mKGFubikpKTtcbiAgICAgICAgICBpZiAoIXR5cGVIYXNSZXF1aXJlZEFubm90YXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgICAgZm9ybWF0TWV0YWRhdGFFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgbWV0YWRhdGFFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgIGBDbGFzcyAke3R5cGUubmFtZX0gaW4gJHt0eXBlLmZpbGVQYXRofSBleHRlbmRzIGZyb20gYSAke0NvbXBpbGVTdW1tYXJ5S2luZFtzdW1tYXJ5LnR5cGUuc3VtbWFyeUtpbmQhXX0gaW4gYW5vdGhlciBjb21waWxhdGlvbiB1bml0IHdpdGhvdXQgZHVwbGljYXRpbmcgdGhlIGRlY29yYXRvcmAsXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBzdW1tYXJ5ICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGBQbGVhc2UgYWRkIGEgJHtyZXF1aXJlZEFubm90YXRpb25UeXBlcy5tYXAoKHR5cGUpID0+IHR5cGUubmdNZXRhZGF0YU5hbWUpLmpvaW4oJyBvciAnKX0gZGVjb3JhdG9yIHRvIHRoZSBjbGFzc2ApLFxuICAgICAgICAgICAgICAgICAgICB0eXBlKSxcbiAgICAgICAgICAgICAgICB0eXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGFubm90YXRpb25DYWNoZS5zZXQodHlwZSwgYW5ub3RhdGlvbnMuZmlsdGVyKGFubiA9PiAhIWFubikpO1xuICAgIH1cbiAgICByZXR1cm4gYW5ub3RhdGlvbnM7XG4gIH1cblxuICBwdWJsaWMgcHJvcE1ldGFkYXRhKHR5cGU6IFN0YXRpY1N5bWJvbCk6IHtba2V5OiBzdHJpbmddOiBhbnlbXX0ge1xuICAgIGxldCBwcm9wTWV0YWRhdGEgPSB0aGlzLnByb3BlcnR5Q2FjaGUuZ2V0KHR5cGUpO1xuICAgIGlmICghcHJvcE1ldGFkYXRhKSB7XG4gICAgICBjb25zdCBjbGFzc01ldGFkYXRhID0gdGhpcy5nZXRUeXBlTWV0YWRhdGEodHlwZSk7XG4gICAgICBwcm9wTWV0YWRhdGEgPSB7fTtcbiAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0aGlzLmZpbmRQYXJlbnRUeXBlKHR5cGUsIGNsYXNzTWV0YWRhdGEpO1xuICAgICAgaWYgKHBhcmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgcGFyZW50UHJvcE1ldGFkYXRhID0gdGhpcy5wcm9wTWV0YWRhdGEocGFyZW50VHlwZSk7XG4gICAgICAgIE9iamVjdC5rZXlzKHBhcmVudFByb3BNZXRhZGF0YSkuZm9yRWFjaCgocGFyZW50UHJvcCkgPT4ge1xuICAgICAgICAgIHByb3BNZXRhZGF0YSAhW3BhcmVudFByb3BdID0gcGFyZW50UHJvcE1ldGFkYXRhW3BhcmVudFByb3BdO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbWVtYmVycyA9IGNsYXNzTWV0YWRhdGFbJ21lbWJlcnMnXSB8fCB7fTtcbiAgICAgIE9iamVjdC5rZXlzKG1lbWJlcnMpLmZvckVhY2goKHByb3BOYW1lKSA9PiB7XG4gICAgICAgIGNvbnN0IHByb3BEYXRhID0gbWVtYmVyc1twcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHByb3AgPSAoPGFueVtdPnByb3BEYXRhKVxuICAgICAgICAgICAgICAgICAgICAgICAgIC5maW5kKGEgPT4gYVsnX19zeW1ib2xpYyddID09ICdwcm9wZXJ0eScgfHwgYVsnX19zeW1ib2xpYyddID09ICdtZXRob2QnKTtcbiAgICAgICAgY29uc3QgZGVjb3JhdG9yczogYW55W10gPSBbXTtcbiAgICAgICAgaWYgKHByb3BNZXRhZGF0YSAhW3Byb3BOYW1lXSkge1xuICAgICAgICAgIGRlY29yYXRvcnMucHVzaCguLi5wcm9wTWV0YWRhdGEgIVtwcm9wTmFtZV0pO1xuICAgICAgICB9XG4gICAgICAgIHByb3BNZXRhZGF0YSAhW3Byb3BOYW1lXSA9IGRlY29yYXRvcnM7XG4gICAgICAgIGlmIChwcm9wICYmIHByb3BbJ2RlY29yYXRvcnMnXSkge1xuICAgICAgICAgIGRlY29yYXRvcnMucHVzaCguLi50aGlzLnNpbXBsaWZ5KHR5cGUsIHByb3BbJ2RlY29yYXRvcnMnXSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMucHJvcGVydHlDYWNoZS5zZXQodHlwZSwgcHJvcE1ldGFkYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb3BNZXRhZGF0YTtcbiAgfVxuXG4gIHB1YmxpYyBwYXJhbWV0ZXJzKHR5cGU6IFN0YXRpY1N5bWJvbCk6IGFueVtdIHtcbiAgICBpZiAoISh0eXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihcbiAgICAgICAgICBuZXcgRXJyb3IoYHBhcmFtZXRlcnMgcmVjZWl2ZWQgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0gd2hpY2ggaXMgbm90IGEgU3RhdGljU3ltYm9sYCksXG4gICAgICAgICAgdHlwZSk7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBsZXQgcGFyYW1ldGVycyA9IHRoaXMucGFyYW1ldGVyQ2FjaGUuZ2V0KHR5cGUpO1xuICAgICAgaWYgKCFwYXJhbWV0ZXJzKSB7XG4gICAgICAgIGNvbnN0IGNsYXNzTWV0YWRhdGEgPSB0aGlzLmdldFR5cGVNZXRhZGF0YSh0eXBlKTtcbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHRoaXMuZmluZFBhcmVudFR5cGUodHlwZSwgY2xhc3NNZXRhZGF0YSk7XG4gICAgICAgIGNvbnN0IG1lbWJlcnMgPSBjbGFzc01ldGFkYXRhID8gY2xhc3NNZXRhZGF0YVsnbWVtYmVycyddIDogbnVsbDtcbiAgICAgICAgY29uc3QgY3RvckRhdGEgPSBtZW1iZXJzID8gbWVtYmVyc1snX19jdG9yX18nXSA6IG51bGw7XG4gICAgICAgIGlmIChjdG9yRGF0YSkge1xuICAgICAgICAgIGNvbnN0IGN0b3IgPSAoPGFueVtdPmN0b3JEYXRhKS5maW5kKGEgPT4gYVsnX19zeW1ib2xpYyddID09ICdjb25zdHJ1Y3RvcicpO1xuICAgICAgICAgIGNvbnN0IHJhd1BhcmFtZXRlclR5cGVzID0gPGFueVtdPmN0b3JbJ3BhcmFtZXRlcnMnXSB8fCBbXTtcbiAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJEZWNvcmF0b3JzID0gPGFueVtdPnRoaXMuc2ltcGxpZnkodHlwZSwgY3RvclsncGFyYW1ldGVyRGVjb3JhdG9ycyddIHx8IFtdKTtcbiAgICAgICAgICBwYXJhbWV0ZXJzID0gW107XG4gICAgICAgICAgcmF3UGFyYW1ldGVyVHlwZXMuZm9yRWFjaCgocmF3UGFyYW1UeXBlLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmVzdGVkUmVzdWx0OiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1UeXBlID0gdGhpcy50cnlTaW1wbGlmeSh0eXBlLCByYXdQYXJhbVR5cGUpO1xuICAgICAgICAgICAgaWYgKHBhcmFtVHlwZSkgbmVzdGVkUmVzdWx0LnB1c2gocGFyYW1UeXBlKTtcbiAgICAgICAgICAgIGNvbnN0IGRlY29yYXRvcnMgPSBwYXJhbWV0ZXJEZWNvcmF0b3JzID8gcGFyYW1ldGVyRGVjb3JhdG9yc1tpbmRleF0gOiBudWxsO1xuICAgICAgICAgICAgaWYgKGRlY29yYXRvcnMpIHtcbiAgICAgICAgICAgICAgbmVzdGVkUmVzdWx0LnB1c2goLi4uZGVjb3JhdG9ycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXJhbWV0ZXJzICEucHVzaChuZXN0ZWRSZXN1bHQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKHBhcmVudFR5cGUpIHtcbiAgICAgICAgICBwYXJhbWV0ZXJzID0gdGhpcy5wYXJhbWV0ZXJzKHBhcmVudFR5cGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcGFyYW1ldGVycykge1xuICAgICAgICAgIHBhcmFtZXRlcnMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBhcmFtZXRlckNhY2hlLnNldCh0eXBlLCBwYXJhbWV0ZXJzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJhbWV0ZXJzO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCBvbiB0eXBlICR7SlNPTi5zdHJpbmdpZnkodHlwZSl9IHdpdGggZXJyb3IgJHtlfWApO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9tZXRob2ROYW1lcyh0eXBlOiBhbnkpOiB7W2tleTogc3RyaW5nXTogYm9vbGVhbn0ge1xuICAgIGxldCBtZXRob2ROYW1lcyA9IHRoaXMubWV0aG9kQ2FjaGUuZ2V0KHR5cGUpO1xuICAgIGlmICghbWV0aG9kTmFtZXMpIHtcbiAgICAgIGNvbnN0IGNsYXNzTWV0YWRhdGEgPSB0aGlzLmdldFR5cGVNZXRhZGF0YSh0eXBlKTtcbiAgICAgIG1ldGhvZE5hbWVzID0ge307XG4gICAgICBjb25zdCBwYXJlbnRUeXBlID0gdGhpcy5maW5kUGFyZW50VHlwZSh0eXBlLCBjbGFzc01ldGFkYXRhKTtcbiAgICAgIGlmIChwYXJlbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudE1ldGhvZE5hbWVzID0gdGhpcy5fbWV0aG9kTmFtZXMocGFyZW50VHlwZSk7XG4gICAgICAgIE9iamVjdC5rZXlzKHBhcmVudE1ldGhvZE5hbWVzKS5mb3JFYWNoKChwYXJlbnRQcm9wKSA9PiB7XG4gICAgICAgICAgbWV0aG9kTmFtZXMgIVtwYXJlbnRQcm9wXSA9IHBhcmVudE1ldGhvZE5hbWVzW3BhcmVudFByb3BdO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbWVtYmVycyA9IGNsYXNzTWV0YWRhdGFbJ21lbWJlcnMnXSB8fCB7fTtcbiAgICAgIE9iamVjdC5rZXlzKG1lbWJlcnMpLmZvckVhY2goKHByb3BOYW1lKSA9PiB7XG4gICAgICAgIGNvbnN0IHByb3BEYXRhID0gbWVtYmVyc1twcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGlzTWV0aG9kID0gKDxhbnlbXT5wcm9wRGF0YSkuc29tZShhID0+IGFbJ19fc3ltYm9saWMnXSA9PSAnbWV0aG9kJyk7XG4gICAgICAgIG1ldGhvZE5hbWVzICFbcHJvcE5hbWVdID0gbWV0aG9kTmFtZXMgIVtwcm9wTmFtZV0gfHwgaXNNZXRob2Q7XG4gICAgICB9KTtcbiAgICAgIHRoaXMubWV0aG9kQ2FjaGUuc2V0KHR5cGUsIG1ldGhvZE5hbWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIG1ldGhvZE5hbWVzO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3RhdGljTWVtYmVycyh0eXBlOiBTdGF0aWNTeW1ib2wpOiBzdHJpbmdbXSB7XG4gICAgbGV0IHN0YXRpY01lbWJlcnMgPSB0aGlzLnN0YXRpY0NhY2hlLmdldCh0eXBlKTtcbiAgICBpZiAoIXN0YXRpY01lbWJlcnMpIHtcbiAgICAgIGNvbnN0IGNsYXNzTWV0YWRhdGEgPSB0aGlzLmdldFR5cGVNZXRhZGF0YSh0eXBlKTtcbiAgICAgIGNvbnN0IHN0YXRpY01lbWJlckRhdGEgPSBjbGFzc01ldGFkYXRhWydzdGF0aWNzJ10gfHwge307XG4gICAgICBzdGF0aWNNZW1iZXJzID0gT2JqZWN0LmtleXMoc3RhdGljTWVtYmVyRGF0YSk7XG4gICAgICB0aGlzLnN0YXRpY0NhY2hlLnNldCh0eXBlLCBzdGF0aWNNZW1iZXJzKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRpY01lbWJlcnM7XG4gIH1cblxuXG4gIHByaXZhdGUgZmluZFBhcmVudFR5cGUodHlwZTogU3RhdGljU3ltYm9sLCBjbGFzc01ldGFkYXRhOiBhbnkpOiBTdGF0aWNTeW1ib2x8dW5kZWZpbmVkIHtcbiAgICBjb25zdCBwYXJlbnRUeXBlID0gdGhpcy50cnlTaW1wbGlmeSh0eXBlLCBjbGFzc01ldGFkYXRhWydleHRlbmRzJ10pO1xuICAgIGlmIChwYXJlbnRUeXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICByZXR1cm4gcGFyZW50VHlwZTtcbiAgICB9XG4gIH1cblxuICBoYXNMaWZlY3ljbGVIb29rKHR5cGU6IGFueSwgbGNQcm9wZXJ0eTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKCEodHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgaGFzTGlmZWN5Y2xlSG9vayByZWNlaXZlZCAke0pTT04uc3RyaW5naWZ5KHR5cGUpfSB3aGljaCBpcyBub3QgYSBTdGF0aWNTeW1ib2xgKSxcbiAgICAgICAgICB0eXBlKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiAhIXRoaXMuX21ldGhvZE5hbWVzKHR5cGUpW2xjUHJvcGVydHldO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCBvbiB0eXBlICR7SlNPTi5zdHJpbmdpZnkodHlwZSl9IHdpdGggZXJyb3IgJHtlfWApO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICBndWFyZHModHlwZTogYW55KToge1trZXk6IHN0cmluZ106IFN0YXRpY1N5bWJvbH0ge1xuICAgIGlmICghKHR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgIG5ldyBFcnJvcihgZ3VhcmRzIHJlY2VpdmVkICR7SlNPTi5zdHJpbmdpZnkodHlwZSl9IHdoaWNoIGlzIG5vdCBhIFN0YXRpY1N5bWJvbGApLCB0eXBlKTtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gICAgY29uc3Qgc3RhdGljTWVtYmVycyA9IHRoaXMuX3N0YXRpY01lbWJlcnModHlwZSk7XG4gICAgY29uc3QgcmVzdWx0OiB7W2tleTogc3RyaW5nXTogU3RhdGljU3ltYm9sfSA9IHt9O1xuICAgIGZvciAobGV0IG5hbWUgb2Ygc3RhdGljTWVtYmVycykge1xuICAgICAgaWYgKG5hbWUuZW5kc1dpdGgoVFlQRUdVQVJEX1BPU1RGSVgpKSB7XG4gICAgICAgIGxldCBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyKDAsIG5hbWUubGVuZ3RoIC0gVFlQRUdVQVJEX1BPU1RGSVgubGVuZ3RoKTtcbiAgICAgICAgbGV0IHZhbHVlOiBhbnk7XG4gICAgICAgIGlmIChwcm9wZXJ0eS5lbmRzV2l0aChVU0VfSUYpKSB7XG4gICAgICAgICAgcHJvcGVydHkgPSBuYW1lLnN1YnN0cigwLCBwcm9wZXJ0eS5sZW5ndGggLSBVU0VfSUYubGVuZ3RoKTtcbiAgICAgICAgICB2YWx1ZSA9IFVTRV9JRjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IHRoaXMuZ2V0U3RhdGljU3ltYm9sKHR5cGUuZmlsZVBhdGgsIHR5cGUubmFtZSwgW25hbWVdKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwcml2YXRlIF9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodHlwZTogU3RhdGljU3ltYm9sLCBjdG9yOiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnZlcnNpb25NYXAuc2V0KHR5cGUsIChjb250ZXh0OiBTdGF0aWNTeW1ib2wsIGFyZ3M6IGFueVtdKSA9PiBuZXcgY3RvciguLi5hcmdzKSk7XG4gIH1cblxuICBwcml2YXRlIF9yZWdpc3RlckZ1bmN0aW9uKHR5cGU6IFN0YXRpY1N5bWJvbCwgZm46IGFueSk6IHZvaWQge1xuICAgIHRoaXMuY29udmVyc2lvbk1hcC5zZXQodHlwZSwgKGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgYXJnczogYW55W10pID0+IGZuLmFwcGx5KHVuZGVmaW5lZCwgYXJncykpO1xuICB9XG5cbiAgcHJpdmF0ZSBpbml0aWFsaXplQ29udmVyc2lvbk1hcCgpOiB2b2lkIHtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0luamVjdGFibGUnKSwgY3JlYXRlSW5qZWN0YWJsZSk7XG4gICAgdGhpcy5pbmplY3Rpb25Ub2tlbiA9IHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0luamVjdGlvblRva2VuJyk7XG4gICAgdGhpcy5vcGFxdWVUb2tlbiA9IHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ09wYXF1ZVRva2VuJyk7XG4gICAgdGhpcy5ST1VURVMgPSB0aGlzLnRyeUZpbmREZWNsYXJhdGlvbihBTkdVTEFSX1JPVVRFUiwgJ1JPVVRFUycpO1xuICAgIHRoaXMuQU5BTFlaRV9GT1JfRU5UUllfQ09NUE9ORU5UUyA9XG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0FOQUxZWkVfRk9SX0VOVFJZX0NPTVBPTkVOVFMnKTtcblxuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdIb3N0JyksIGNyZWF0ZUhvc3QpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdTZWxmJyksIGNyZWF0ZVNlbGYpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnU2tpcFNlbGYnKSwgY3JlYXRlU2tpcFNlbGYpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSW5qZWN0JyksIGNyZWF0ZUluamVjdCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdPcHRpb25hbCcpLCBjcmVhdGVPcHRpb25hbCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdBdHRyaWJ1dGUnKSwgY3JlYXRlQXR0cmlidXRlKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0NvbnRlbnRDaGlsZCcpLCBjcmVhdGVDb250ZW50Q2hpbGQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnQ29udGVudENoaWxkcmVuJyksIGNyZWF0ZUNvbnRlbnRDaGlsZHJlbik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdWaWV3Q2hpbGQnKSwgY3JlYXRlVmlld0NoaWxkKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1ZpZXdDaGlsZHJlbicpLCBjcmVhdGVWaWV3Q2hpbGRyZW4pO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdJbnB1dCcpLCBjcmVhdGVJbnB1dCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdPdXRwdXQnKSwgY3JlYXRlT3V0cHV0KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnUGlwZScpLCBjcmVhdGVQaXBlKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0hvc3RCaW5kaW5nJyksIGNyZWF0ZUhvc3RCaW5kaW5nKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0hvc3RMaXN0ZW5lcicpLCBjcmVhdGVIb3N0TGlzdGVuZXIpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnRGlyZWN0aXZlJyksIGNyZWF0ZURpcmVjdGl2ZSk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdDb21wb25lbnQnKSwgY3JlYXRlQ29tcG9uZW50KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ05nTW9kdWxlJyksIGNyZWF0ZU5nTW9kdWxlKTtcblxuICAgIC8vIE5vdGU6IFNvbWUgbWV0YWRhdGEgY2xhc3NlcyBjYW4gYmUgdXNlZCBkaXJlY3RseSB3aXRoIFByb3ZpZGVyLmRlcHMuXG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0hvc3QnKSwgY3JlYXRlSG9zdCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1NlbGYnKSwgY3JlYXRlU2VsZik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdTa2lwU2VsZicpLCBjcmVhdGVTa2lwU2VsZik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdPcHRpb25hbCcpLCBjcmVhdGVPcHRpb25hbCk7XG4gIH1cblxuICAvKipcbiAgICogZ2V0U3RhdGljU3ltYm9sIHByb2R1Y2VzIGEgVHlwZSB3aG9zZSBtZXRhZGF0YSBpcyBrbm93biBidXQgd2hvc2UgaW1wbGVtZW50YXRpb24gaXMgbm90IGxvYWRlZC5cbiAgICogQWxsIHR5cGVzIHBhc3NlZCB0byB0aGUgU3RhdGljUmVzb2x2ZXIgc2hvdWxkIGJlIHBzZXVkby10eXBlcyByZXR1cm5lZCBieSB0aGlzIG1ldGhvZC5cbiAgICpcbiAgICogQHBhcmFtIGRlY2xhcmF0aW9uRmlsZSB0aGUgYWJzb2x1dGUgcGF0aCBvZiB0aGUgZmlsZSB3aGVyZSB0aGUgc3ltYm9sIGlzIGRlY2xhcmVkXG4gICAqIEBwYXJhbSBuYW1lIHRoZSBuYW1lIG9mIHRoZSB0eXBlLlxuICAgKi9cbiAgZ2V0U3RhdGljU3ltYm9sKGRlY2xhcmF0aW9uRmlsZTogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIG1lbWJlcnM/OiBzdHJpbmdbXSk6IFN0YXRpY1N5bWJvbCB7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9sUmVzb2x2ZXIuZ2V0U3RhdGljU3ltYm9sKGRlY2xhcmF0aW9uRmlsZSwgbmFtZSwgbWVtYmVycyk7XG4gIH1cblxuICAvKipcbiAgICogU2ltcGxpZnkgYnV0IGRpc2NhcmQgYW55IGVycm9yc1xuICAgKi9cbiAgcHJpdmF0ZSB0cnlTaW1wbGlmeShjb250ZXh0OiBTdGF0aWNTeW1ib2wsIHZhbHVlOiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IG9yaWdpbmFsUmVjb3JkZXIgPSB0aGlzLmVycm9yUmVjb3JkZXI7XG4gICAgdGhpcy5lcnJvclJlY29yZGVyID0gKGVycm9yOiBhbnksIGZpbGVOYW1lPzogc3RyaW5nKSA9PiB7fTtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnNpbXBsaWZ5KGNvbnRleHQsIHZhbHVlKTtcbiAgICB0aGlzLmVycm9yUmVjb3JkZXIgPSBvcmlnaW5hbFJlY29yZGVyO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHB1YmxpYyBzaW1wbGlmeShjb250ZXh0OiBTdGF0aWNTeW1ib2wsIHZhbHVlOiBhbnksIGxhenk6IGJvb2xlYW4gPSBmYWxzZSk6IGFueSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgbGV0IHNjb3BlID0gQmluZGluZ1Njb3BlLmVtcHR5O1xuICAgIGNvbnN0IGNhbGxpbmcgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwgYm9vbGVhbj4oKTtcbiAgICBjb25zdCByb290Q29udGV4dCA9IGNvbnRleHQ7XG5cbiAgICBmdW5jdGlvbiBzaW1wbGlmeUluQ29udGV4dChcbiAgICAgICAgY29udGV4dDogU3RhdGljU3ltYm9sLCB2YWx1ZTogYW55LCBkZXB0aDogbnVtYmVyLCByZWZlcmVuY2VzOiBudW1iZXIpOiBhbnkge1xuICAgICAgZnVuY3Rpb24gcmVzb2x2ZVJlZmVyZW5jZVZhbHVlKHN0YXRpY1N5bWJvbDogU3RhdGljU3ltYm9sKTogYW55IHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRTeW1ib2wgPSBzZWxmLnN5bWJvbFJlc29sdmVyLnJlc29sdmVTeW1ib2woc3RhdGljU3ltYm9sKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmVkU3ltYm9sID8gcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGEgOiBudWxsO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBzaW1wbGlmeUVhZ2VybHkodmFsdWU6IGFueSk6IGFueSB7XG4gICAgICAgIHJldHVybiBzaW1wbGlmeUluQ29udGV4dChjb250ZXh0LCB2YWx1ZSwgZGVwdGgsIDApO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBzaW1wbGlmeUxhemlseSh2YWx1ZTogYW55KTogYW55IHtcbiAgICAgICAgcmV0dXJuIHNpbXBsaWZ5SW5Db250ZXh0KGNvbnRleHQsIHZhbHVlLCBkZXB0aCwgcmVmZXJlbmNlcyArIDEpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBzaW1wbGlmeU5lc3RlZChuZXN0ZWRDb250ZXh0OiBTdGF0aWNTeW1ib2wsIHZhbHVlOiBhbnkpOiBhbnkge1xuICAgICAgICBpZiAobmVzdGVkQ29udGV4dCA9PT0gY29udGV4dCkge1xuICAgICAgICAgIC8vIElmIHRoZSBjb250ZXh0IGhhc24ndCBjaGFuZ2VkIGxldCB0aGUgZXhjZXB0aW9uIHByb3BhZ2F0ZSB1bm1vZGlmaWVkLlxuICAgICAgICAgIHJldHVybiBzaW1wbGlmeUluQ29udGV4dChuZXN0ZWRDb250ZXh0LCB2YWx1ZSwgZGVwdGggKyAxLCByZWZlcmVuY2VzKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBzaW1wbGlmeUluQ29udGV4dChuZXN0ZWRDb250ZXh0LCB2YWx1ZSwgZGVwdGggKyAxLCByZWZlcmVuY2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGlmIChpc01ldGFkYXRhRXJyb3IoZSkpIHtcbiAgICAgICAgICAgIC8vIFByb3BhZ2F0ZSB0aGUgbWVzc2FnZSB0ZXh0IHVwIGJ1dCBhZGQgYSBtZXNzYWdlIHRvIHRoZSBjaGFpbiB0aGF0IGV4cGxhaW5zIGhvdyB3ZSBnb3RcbiAgICAgICAgICAgIC8vIGhlcmUuXG4gICAgICAgICAgICAvLyBlLmNoYWluIGltcGxpZXMgZS5zeW1ib2xcbiAgICAgICAgICAgIGNvbnN0IHN1bW1hcnlNc2cgPSBlLmNoYWluID8gJ3JlZmVyZW5jZXMgXFwnJyArIGUuc3ltYm9sICEubmFtZSArICdcXCcnIDogZXJyb3JTdW1tYXJ5KGUpO1xuICAgICAgICAgICAgY29uc3Qgc3VtbWFyeSA9IGAnJHtuZXN0ZWRDb250ZXh0Lm5hbWV9JyAke3N1bW1hcnlNc2d9YDtcbiAgICAgICAgICAgIGNvbnN0IGNoYWluID0ge21lc3NhZ2U6IHN1bW1hcnksIHBvc2l0aW9uOiBlLnBvc2l0aW9uLCBuZXh0OiBlLmNoYWlufTtcbiAgICAgICAgICAgIC8vIFRPRE8oY2h1Y2tqKTogcmV0cmlldmUgdGhlIHBvc2l0aW9uIGluZm9ybWF0aW9uIGluZGlyZWN0bHkgZnJvbSB0aGUgY29sbGVjdG9ycyBub2RlXG4gICAgICAgICAgICAvLyBtYXAgaWYgdGhlIG1ldGFkYXRhIGlzIGZyb20gYSAudHMgZmlsZS5cbiAgICAgICAgICAgIHNlbGYuZXJyb3IoXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZS5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgYWR2aXNlOiBlLmFkdmlzZSxcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQ6IGUuY29udGV4dCwgY2hhaW4sXG4gICAgICAgICAgICAgICAgICBzeW1ib2w6IG5lc3RlZENvbnRleHRcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGNvbnRleHQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJdCBpcyBwcm9iYWJseSBhbiBpbnRlcm5hbCBlcnJvci5cbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5Q2FsbChcbiAgICAgICAgICBmdW5jdGlvblN5bWJvbDogU3RhdGljU3ltYm9sLCB0YXJnZXRGdW5jdGlvbjogYW55LCBhcmdzOiBhbnlbXSwgdGFyZ2V0RXhwcmVzc2lvbjogYW55KSB7XG4gICAgICAgIGlmICh0YXJnZXRGdW5jdGlvbiAmJiB0YXJnZXRGdW5jdGlvblsnX19zeW1ib2xpYyddID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBpZiAoY2FsbGluZy5nZXQoZnVuY3Rpb25TeW1ib2wpKSB7XG4gICAgICAgICAgICBzZWxmLmVycm9yKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdSZWN1cnNpb24gaXMgbm90IHN1cHBvcnRlZCcsXG4gICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBgY2FsbGVkICcke2Z1bmN0aW9uU3ltYm9sLm5hbWV9JyByZWN1cnNpdmVseWAsXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogdGFyZ2V0RnVuY3Rpb25cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uU3ltYm9sKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGFyZ2V0RnVuY3Rpb25bJ3ZhbHVlJ107XG4gICAgICAgICAgICBpZiAodmFsdWUgJiYgKGRlcHRoICE9IDAgfHwgdmFsdWUuX19zeW1ib2xpYyAhPSAnZXJyb3InKSkge1xuICAgICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJzOiBzdHJpbmdbXSA9IHRhcmdldEZ1bmN0aW9uWydwYXJhbWV0ZXJzJ107XG4gICAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRzOiBhbnlbXSA9IHRhcmdldEZ1bmN0aW9uLmRlZmF1bHRzO1xuICAgICAgICAgICAgICBhcmdzID0gYXJncy5tYXAoYXJnID0+IHNpbXBsaWZ5TmVzdGVkKGNvbnRleHQsIGFyZykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChhcmcgPT4gc2hvdWxkSWdub3JlKGFyZykgPyB1bmRlZmluZWQgOiBhcmcpO1xuICAgICAgICAgICAgICBpZiAoZGVmYXVsdHMgJiYgZGVmYXVsdHMubGVuZ3RoID4gYXJncy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBhcmdzLnB1c2goLi4uZGVmYXVsdHMuc2xpY2UoYXJncy5sZW5ndGgpLm1hcCgodmFsdWU6IGFueSkgPT4gc2ltcGxpZnkodmFsdWUpKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY2FsbGluZy5zZXQoZnVuY3Rpb25TeW1ib2wsIHRydWUpO1xuICAgICAgICAgICAgICBjb25zdCBmdW5jdGlvblNjb3BlID0gQmluZGluZ1Njb3BlLmJ1aWxkKCk7XG4gICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFyYW1ldGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uU2NvcGUuZGVmaW5lKHBhcmFtZXRlcnNbaV0sIGFyZ3NbaV0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IG9sZFNjb3BlID0gc2NvcGU7XG4gICAgICAgICAgICAgIGxldCByZXN1bHQ6IGFueTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBzY29wZSA9IGZ1bmN0aW9uU2NvcGUuZG9uZSgpO1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHNpbXBsaWZ5TmVzdGVkKGZ1bmN0aW9uU3ltYm9sLCB2YWx1ZSk7XG4gICAgICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAgICAgc2NvcGUgPSBvbGRTY29wZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBjYWxsaW5nLmRlbGV0ZShmdW5jdGlvblN5bWJvbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlcHRoID09PSAwKSB7XG4gICAgICAgICAgLy8gSWYgZGVwdGggaXMgMCB3ZSBhcmUgZXZhbHVhdGluZyB0aGUgdG9wIGxldmVsIGV4cHJlc3Npb24gdGhhdCBpcyBkZXNjcmliaW5nIGVsZW1lbnRcbiAgICAgICAgICAvLyBkZWNvcmF0b3IuIEluIHRoaXMgY2FzZSwgaXQgaXMgYSBkZWNvcmF0b3Igd2UgZG9uJ3QgdW5kZXJzdGFuZCwgc3VjaCBhcyBhIGN1c3RvbVxuICAgICAgICAgIC8vIG5vbi1hbmd1bGFyIGRlY29yYXRvciwgYW5kIHdlIHNob3VsZCBqdXN0IGlnbm9yZSBpdC5cbiAgICAgICAgICByZXR1cm4gSUdOT1JFO1xuICAgICAgICB9XG4gICAgICAgIGxldCBwb3NpdGlvbjogUG9zaXRpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgICBpZiAodGFyZ2V0RXhwcmVzc2lvbiAmJiB0YXJnZXRFeHByZXNzaW9uLl9fc3ltYm9saWMgPT0gJ3Jlc29sdmVkJykge1xuICAgICAgICAgIGNvbnN0IGxpbmUgPSB0YXJnZXRFeHByZXNzaW9uLmxpbmU7XG4gICAgICAgICAgY29uc3QgY2hhcmFjdGVyID0gdGFyZ2V0RXhwcmVzc2lvbi5jaGFyYWN0ZXI7XG4gICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSB0YXJnZXRFeHByZXNzaW9uLmZpbGVOYW1lO1xuICAgICAgICAgIGlmIChmaWxlTmFtZSAhPSBudWxsICYmIGxpbmUgIT0gbnVsbCAmJiBjaGFyYWN0ZXIgIT0gbnVsbCkge1xuICAgICAgICAgICAgcG9zaXRpb24gPSB7ZmlsZU5hbWUsIGxpbmUsIGNvbHVtbjogY2hhcmFjdGVyfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5lcnJvcihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbWVzc2FnZTogRlVOQ1RJT05fQ0FMTF9OT1RfU1VQUE9SVEVELFxuICAgICAgICAgICAgICBjb250ZXh0OiBmdW5jdGlvblN5bWJvbCxcbiAgICAgICAgICAgICAgdmFsdWU6IHRhcmdldEZ1bmN0aW9uLCBwb3NpdGlvblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbnRleHQpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBzaW1wbGlmeShleHByZXNzaW9uOiBhbnkpOiBhbnkge1xuICAgICAgICBpZiAoaXNQcmltaXRpdmUoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXhwcmVzc2lvbiBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnlbXSA9IFtdO1xuICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiAoPGFueT5leHByZXNzaW9uKSkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGEgc3ByZWFkIGV4cHJlc3Npb25cbiAgICAgICAgICAgIGlmIChpdGVtICYmIGl0ZW0uX19zeW1ib2xpYyA9PT0gJ3NwcmVhZCcpIHtcbiAgICAgICAgICAgICAgLy8gV2UgY2FsbCB3aXRoIHJlZmVyZW5jZXMgYXMgMCBiZWNhdXNlIHdlIHJlcXVpcmUgdGhlIGFjdHVhbCB2YWx1ZSBhbmQgY2Fubm90XG4gICAgICAgICAgICAgIC8vIHRvbGVyYXRlIGEgcmVmZXJlbmNlIGhlcmUuXG4gICAgICAgICAgICAgIGNvbnN0IHNwcmVhZEFycmF5ID0gc2ltcGxpZnlFYWdlcmx5KGl0ZW0uZXhwcmVzc2lvbik7XG4gICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHNwcmVhZEFycmF5KSkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3ByZWFkSXRlbSBvZiBzcHJlYWRBcnJheSkge1xuICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goc3ByZWFkSXRlbSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHNpbXBsaWZ5KGl0ZW0pO1xuICAgICAgICAgICAgaWYgKHNob3VsZElnbm9yZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4cHJlc3Npb24gaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgICAgICAvLyBTdG9wIHNpbXBsaWZpY2F0aW9uIGF0IGJ1aWx0aW4gc3ltYm9scyBvciBpZiB3ZSBhcmUgaW4gYSByZWZlcmVuY2UgY29udGV4dCBhbmRcbiAgICAgICAgICAvLyB0aGUgc3ltYm9sIGRvZXNuJ3QgaGF2ZSBtZW1iZXJzLlxuICAgICAgICAgIGlmIChleHByZXNzaW9uID09PSBzZWxmLmluamVjdGlvblRva2VuIHx8IHNlbGYuY29udmVyc2lvbk1hcC5oYXMoZXhwcmVzc2lvbikgfHxcbiAgICAgICAgICAgICAgKHJlZmVyZW5jZXMgPiAwICYmICFleHByZXNzaW9uLm1lbWJlcnMubGVuZ3RoKSkge1xuICAgICAgICAgICAgcmV0dXJuIGV4cHJlc3Npb247XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRpY1N5bWJvbCA9IGV4cHJlc3Npb247XG4gICAgICAgICAgICBjb25zdCBkZWNsYXJhdGlvblZhbHVlID0gcmVzb2x2ZVJlZmVyZW5jZVZhbHVlKHN0YXRpY1N5bWJvbCk7XG4gICAgICAgICAgICBpZiAoZGVjbGFyYXRpb25WYWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeU5lc3RlZChzdGF0aWNTeW1ib2wsIGRlY2xhcmF0aW9uVmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN0YXRpY1N5bWJvbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4cHJlc3Npb24pIHtcbiAgICAgICAgICBpZiAoZXhwcmVzc2lvblsnX19zeW1ib2xpYyddKSB7XG4gICAgICAgICAgICBsZXQgc3RhdGljU3ltYm9sOiBTdGF0aWNTeW1ib2w7XG4gICAgICAgICAgICBzd2l0Y2ggKGV4cHJlc3Npb25bJ19fc3ltYm9saWMnXSkge1xuICAgICAgICAgICAgICBjYXNlICdiaW5vcCc6XG4gICAgICAgICAgICAgICAgbGV0IGxlZnQgPSBzaW1wbGlmeShleHByZXNzaW9uWydsZWZ0J10pO1xuICAgICAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUobGVmdCkpIHJldHVybiBsZWZ0O1xuICAgICAgICAgICAgICAgIGxldCByaWdodCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ3JpZ2h0J10pO1xuICAgICAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUocmlnaHQpKSByZXR1cm4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChleHByZXNzaW9uWydvcGVyYXRvciddKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlICcmJic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICYmIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnfHwnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCB8fCByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ3wnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCB8IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnXic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IF4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICcmJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgJiByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPT0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICchPSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICE9IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPT09IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnIT09JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgIT09IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IDwgcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc+JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPiByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPD0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc+PSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ID49IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPDwnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA8PCByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJz4+JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPj4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgKyByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAtIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnKic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICogcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgLyByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyUnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAlIHJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgY2FzZSAnaWYnOlxuICAgICAgICAgICAgICAgIGxldCBjb25kaXRpb24gPSBzaW1wbGlmeShleHByZXNzaW9uWydjb25kaXRpb24nXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbmRpdGlvbiA/IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ3RoZW5FeHByZXNzaW9uJ10pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2ltcGxpZnkoZXhwcmVzc2lvblsnZWxzZUV4cHJlc3Npb24nXSk7XG4gICAgICAgICAgICAgIGNhc2UgJ3ByZSc6XG4gICAgICAgICAgICAgICAgbGV0IG9wZXJhbmQgPSBzaW1wbGlmeShleHByZXNzaW9uWydvcGVyYW5kJ10pO1xuICAgICAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUob3BlcmFuZCkpIHJldHVybiBvcGVyYW5kO1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoZXhwcmVzc2lvblsnb3BlcmF0b3InXSkge1xuICAgICAgICAgICAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAtb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIW9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICd+JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIH5vcGVyYW5kO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgY2FzZSAnaW5kZXgnOlxuICAgICAgICAgICAgICAgIGxldCBpbmRleFRhcmdldCA9IHNpbXBsaWZ5RWFnZXJseShleHByZXNzaW9uWydleHByZXNzaW9uJ10pO1xuICAgICAgICAgICAgICAgIGxldCBpbmRleCA9IHNpbXBsaWZ5RWFnZXJseShleHByZXNzaW9uWydpbmRleCddKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhUYXJnZXQgJiYgaXNQcmltaXRpdmUoaW5kZXgpKSByZXR1cm4gaW5kZXhUYXJnZXRbaW5kZXhdO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICBjYXNlICdzZWxlY3QnOlxuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlciA9IGV4cHJlc3Npb25bJ21lbWJlciddO1xuICAgICAgICAgICAgICAgIGxldCBzZWxlY3RDb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgICAgICAgICBsZXQgc2VsZWN0VGFyZ2V0ID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0VGFyZ2V0IGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJzID0gc2VsZWN0VGFyZ2V0Lm1lbWJlcnMuY29uY2F0KG1lbWJlcik7XG4gICAgICAgICAgICAgICAgICBzZWxlY3RDb250ZXh0ID1cbiAgICAgICAgICAgICAgICAgICAgICBzZWxmLmdldFN0YXRpY1N5bWJvbChzZWxlY3RUYXJnZXQuZmlsZVBhdGgsIHNlbGVjdFRhcmdldC5uYW1lLCBtZW1iZXJzKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uVmFsdWUgPSByZXNvbHZlUmVmZXJlbmNlVmFsdWUoc2VsZWN0Q29udGV4dCk7XG4gICAgICAgICAgICAgICAgICBpZiAoZGVjbGFyYXRpb25WYWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeU5lc3RlZChzZWxlY3RDb250ZXh0LCBkZWNsYXJhdGlvblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxlY3RDb250ZXh0O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0VGFyZ2V0ICYmIGlzUHJpbWl0aXZlKG1lbWJlcikpXG4gICAgICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnlOZXN0ZWQoc2VsZWN0Q29udGV4dCwgc2VsZWN0VGFyZ2V0W21lbWJlcl0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICBjYXNlICdyZWZlcmVuY2UnOlxuICAgICAgICAgICAgICAgIC8vIE5vdGU6IFRoaXMgb25seSBoYXMgdG8gZGVhbCB3aXRoIHZhcmlhYmxlIHJlZmVyZW5jZXMsIGFzIHN5bWJvbCByZWZlcmVuY2VzIGhhdmVcbiAgICAgICAgICAgICAgICAvLyBiZWVuIGNvbnZlcnRlZCBpbnRvICdyZXNvbHZlZCdcbiAgICAgICAgICAgICAgICAvLyBpbiB0aGUgU3RhdGljU3ltYm9sUmVzb2x2ZXIuXG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZTogc3RyaW5nID0gZXhwcmVzc2lvblsnbmFtZSddO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2FsVmFsdWUgPSBzY29wZS5yZXNvbHZlKG5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChsb2NhbFZhbHVlICE9IEJpbmRpbmdTY29wZS5taXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbG9jYWxWYWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJ3Jlc29sdmVkJzpcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5KGV4cHJlc3Npb24uc3ltYm9sKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAvLyBJZiBhbiBlcnJvciBpcyByZXBvcnRlZCBldmFsdWF0aW5nIHRoZSBzeW1ib2wgcmVjb3JkIHRoZSBwb3NpdGlvbiBvZiB0aGVcbiAgICAgICAgICAgICAgICAgIC8vIHJlZmVyZW5jZSBpbiB0aGUgZXJyb3Igc28gaXQgY2FuXG4gICAgICAgICAgICAgICAgICAvLyBiZSByZXBvcnRlZCBpbiB0aGUgZXJyb3IgbWVzc2FnZSBnZW5lcmF0ZWQgZnJvbSB0aGUgZXhjZXB0aW9uLlxuICAgICAgICAgICAgICAgICAgaWYgKGlzTWV0YWRhdGFFcnJvcihlKSAmJiBleHByZXNzaW9uLmZpbGVOYW1lICE9IG51bGwgJiZcbiAgICAgICAgICAgICAgICAgICAgICBleHByZXNzaW9uLmxpbmUgIT0gbnVsbCAmJiBleHByZXNzaW9uLmNoYXJhY3RlciAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGUucG9zaXRpb24gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgZmlsZU5hbWU6IGV4cHJlc3Npb24uZmlsZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgbGluZTogZXhwcmVzc2lvbi5saW5lLFxuICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogZXhwcmVzc2lvbi5jaGFyYWN0ZXJcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgICAgICAgICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICAgICAgICAgICAgY2FzZSAnbmV3JzpcbiAgICAgICAgICAgICAgY2FzZSAnY2FsbCc6XG4gICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBmdW5jdGlvbiBpcyBhIGJ1aWx0LWluIGNvbnZlcnNpb25cbiAgICAgICAgICAgICAgICBzdGF0aWNTeW1ib2wgPSBzaW1wbGlmeUluQ29udGV4dChcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dCwgZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddLCBkZXB0aCArIDEsIC8qIHJlZmVyZW5jZXMgKi8gMCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRpY1N5bWJvbCBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgICAgICAgICAgICAgaWYgKHN0YXRpY1N5bWJvbCA9PT0gc2VsZi5pbmplY3Rpb25Ub2tlbiB8fCBzdGF0aWNTeW1ib2wgPT09IHNlbGYub3BhcXVlVG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgc29tZWJvZHkgY2FsbHMgbmV3IEluamVjdGlvblRva2VuLCBkb24ndCBjcmVhdGUgYW4gSW5qZWN0aW9uVG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIC8vIGJ1dCByYXRoZXIgcmV0dXJuIHRoZSBzeW1ib2wgdG8gd2hpY2ggdGhlIEluamVjdGlvblRva2VuIGlzIGFzc2lnbmVkIHRvLlxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE9wYXF1ZVRva2VuIGlzIHN1cHBvcnRlZCB0b28gYXMgaXQgaXMgcmVxdWlyZWQgYnkgdGhlIGxhbmd1YWdlIHNlcnZpY2UgdG9cbiAgICAgICAgICAgICAgICAgICAgLy8gc3VwcG9ydCB2NCBhbmQgcHJpb3IgdmVyc2lvbnMgb2YgQW5ndWxhci5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBjb25zdCBhcmdFeHByZXNzaW9uczogYW55W10gPSBleHByZXNzaW9uWydhcmd1bWVudHMnXSB8fCBbXTtcbiAgICAgICAgICAgICAgICAgIGxldCBjb252ZXJ0ZXIgPSBzZWxmLmNvbnZlcnNpb25NYXAuZ2V0KHN0YXRpY1N5bWJvbCk7XG4gICAgICAgICAgICAgICAgICBpZiAoY29udmVydGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBhcmdFeHByZXNzaW9ucy5tYXAoYXJnID0+IHNpbXBsaWZ5TmVzdGVkKGNvbnRleHQsIGFyZykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChhcmcgPT4gc2hvdWxkSWdub3JlKGFyZykgPyB1bmRlZmluZWQgOiBhcmcpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29udmVydGVyKGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBmdW5jdGlvbiBpcyBvbmUgd2UgY2FuIHNpbXBsaWZ5LlxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRGdW5jdGlvbiA9IHJlc29sdmVSZWZlcmVuY2VWYWx1ZShzdGF0aWNTeW1ib2wpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnlDYWxsKFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGljU3ltYm9sLCB0YXJnZXRGdW5jdGlvbiwgYXJnRXhwcmVzc2lvbnMsIGV4cHJlc3Npb25bJ2V4cHJlc3Npb24nXSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBJR05PUkU7XG4gICAgICAgICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICAgICAgICBsZXQgbWVzc2FnZSA9IGV4cHJlc3Npb24ubWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXhwcmVzc2lvblsnbGluZSddICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQ6IGV4cHJlc3Npb24uY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBleHByZXNzaW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZU5hbWU6IGV4cHJlc3Npb25bJ2ZpbGVOYW1lJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmU6IGV4cHJlc3Npb25bJ2xpbmUnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBleHByZXNzaW9uWydjaGFyYWN0ZXInXVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3Ioe21lc3NhZ2UsIGNvbnRleHQ6IGV4cHJlc3Npb24uY29udGV4dH0sIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gSUdOT1JFO1xuICAgICAgICAgICAgICBjYXNlICdpZ25vcmUnOlxuICAgICAgICAgICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBtYXBTdHJpbmdNYXAoZXhwcmVzc2lvbiwgKHZhbHVlLCBuYW1lKSA9PiB7XG4gICAgICAgICAgICBpZiAoUkVGRVJFTkNFX1NFVC5oYXMobmFtZSkpIHtcbiAgICAgICAgICAgICAgaWYgKG5hbWUgPT09IFVTRV9WQUxVRSAmJiBQUk9WSURFIGluIGV4cHJlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGlzIGlzIGEgcHJvdmlkZXIgZXhwcmVzc2lvbiwgY2hlY2sgZm9yIHNwZWNpYWwgdG9rZW5zIHRoYXQgbmVlZCB0aGUgdmFsdWVcbiAgICAgICAgICAgICAgICAvLyBkdXJpbmcgYW5hbHlzaXMuXG4gICAgICAgICAgICAgICAgY29uc3QgcHJvdmlkZSA9IHNpbXBsaWZ5KGV4cHJlc3Npb24ucHJvdmlkZSk7XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGUgPT09IHNlbGYuUk9VVEVTIHx8IHByb3ZpZGUgPT0gc2VsZi5BTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnkodmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnlMYXppbHkodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5KHZhbHVlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gSUdOT1JFO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2ltcGxpZnkodmFsdWUpO1xuICAgIH1cblxuICAgIGxldCByZXN1bHQ6IGFueTtcbiAgICB0cnkge1xuICAgICAgcmVzdWx0ID0gc2ltcGxpZnlJbkNvbnRleHQoY29udGV4dCwgdmFsdWUsIDAsIGxhenkgPyAxIDogMCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKHRoaXMuZXJyb3JSZWNvcmRlcikge1xuICAgICAgICB0aGlzLnJlcG9ydEVycm9yKGUsIGNvbnRleHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZm9ybWF0TWV0YWRhdGFFcnJvcihlLCBjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHNob3VsZElnbm9yZShyZXN1bHQpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRUeXBlTWV0YWRhdGEodHlwZTogU3RhdGljU3ltYm9sKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGNvbnN0IHJlc29sdmVkU3ltYm9sID0gdGhpcy5zeW1ib2xSZXNvbHZlci5yZXNvbHZlU3ltYm9sKHR5cGUpO1xuICAgIHJldHVybiByZXNvbHZlZFN5bWJvbCAmJiByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSA/IHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7X19zeW1ib2xpYzogJ2NsYXNzJ307XG4gIH1cblxuICBwcml2YXRlIHJlcG9ydEVycm9yKGVycm9yOiBFcnJvciwgY29udGV4dDogU3RhdGljU3ltYm9sLCBwYXRoPzogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuZXJyb3JSZWNvcmRlcikge1xuICAgICAgdGhpcy5lcnJvclJlY29yZGVyKFxuICAgICAgICAgIGZvcm1hdE1ldGFkYXRhRXJyb3IoZXJyb3IsIGNvbnRleHQpLCAoY29udGV4dCAmJiBjb250ZXh0LmZpbGVQYXRoKSB8fCBwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBlcnJvcihcbiAgICAgIHttZXNzYWdlLCBzdW1tYXJ5LCBhZHZpc2UsIHBvc2l0aW9uLCBjb250ZXh0LCB2YWx1ZSwgc3ltYm9sLCBjaGFpbn06IHtcbiAgICAgICAgbWVzc2FnZTogc3RyaW5nLFxuICAgICAgICBzdW1tYXJ5Pzogc3RyaW5nLFxuICAgICAgICBhZHZpc2U/OiBzdHJpbmcsXG4gICAgICAgIHBvc2l0aW9uPzogUG9zaXRpb24sXG4gICAgICAgIGNvbnRleHQ/OiBhbnksXG4gICAgICAgIHZhbHVlPzogYW55LFxuICAgICAgICBzeW1ib2w/OiBTdGF0aWNTeW1ib2wsXG4gICAgICAgIGNoYWluPzogTWV0YWRhdGFNZXNzYWdlQ2hhaW5cbiAgICAgIH0sXG4gICAgICByZXBvcnRpbmdDb250ZXh0OiBTdGF0aWNTeW1ib2wpIHtcbiAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICBtZXRhZGF0YUVycm9yKG1lc3NhZ2UsIHN1bW1hcnksIGFkdmlzZSwgcG9zaXRpb24sIHN5bWJvbCwgY29udGV4dCwgY2hhaW4pLFxuICAgICAgICByZXBvcnRpbmdDb250ZXh0KTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgUG9zaXRpb24ge1xuICBmaWxlTmFtZTogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbHVtbjogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgTWV0YWRhdGFNZXNzYWdlQ2hhaW4ge1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIHN1bW1hcnk/OiBzdHJpbmc7XG4gIHBvc2l0aW9uPzogUG9zaXRpb247XG4gIGNvbnRleHQ/OiBhbnk7XG4gIHN5bWJvbD86IFN0YXRpY1N5bWJvbDtcbiAgbmV4dD86IE1ldGFkYXRhTWVzc2FnZUNoYWluO1xufVxuXG50eXBlIE1ldGFkYXRhRXJyb3IgPSBFcnJvciAmIHtcbiAgcG9zaXRpb24/OiBQb3NpdGlvbjtcbiAgYWR2aXNlPzogc3RyaW5nO1xuICBzdW1tYXJ5Pzogc3RyaW5nO1xuICBjb250ZXh0PzogYW55O1xuICBzeW1ib2w/OiBTdGF0aWNTeW1ib2w7XG4gIGNoYWluPzogTWV0YWRhdGFNZXNzYWdlQ2hhaW47XG59O1xuXG5jb25zdCBNRVRBREFUQV9FUlJPUiA9ICduZ01ldGFkYXRhRXJyb3InO1xuXG5mdW5jdGlvbiBtZXRhZGF0YUVycm9yKFxuICAgIG1lc3NhZ2U6IHN0cmluZywgc3VtbWFyeT86IHN0cmluZywgYWR2aXNlPzogc3RyaW5nLCBwb3NpdGlvbj86IFBvc2l0aW9uLCBzeW1ib2w/OiBTdGF0aWNTeW1ib2wsXG4gICAgY29udGV4dD86IGFueSwgY2hhaW4/OiBNZXRhZGF0YU1lc3NhZ2VDaGFpbik6IE1ldGFkYXRhRXJyb3Ige1xuICBjb25zdCBlcnJvciA9IHN5bnRheEVycm9yKG1lc3NhZ2UpIGFzIE1ldGFkYXRhRXJyb3I7XG4gIChlcnJvciBhcyBhbnkpW01FVEFEQVRBX0VSUk9SXSA9IHRydWU7XG4gIGlmIChhZHZpc2UpIGVycm9yLmFkdmlzZSA9IGFkdmlzZTtcbiAgaWYgKHBvc2l0aW9uKSBlcnJvci5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICBpZiAoc3VtbWFyeSkgZXJyb3Iuc3VtbWFyeSA9IHN1bW1hcnk7XG4gIGlmIChjb250ZXh0KSBlcnJvci5jb250ZXh0ID0gY29udGV4dDtcbiAgaWYgKGNoYWluKSBlcnJvci5jaGFpbiA9IGNoYWluO1xuICBpZiAoc3ltYm9sKSBlcnJvci5zeW1ib2wgPSBzeW1ib2w7XG4gIHJldHVybiBlcnJvcjtcbn1cblxuZnVuY3Rpb24gaXNNZXRhZGF0YUVycm9yKGVycm9yOiBFcnJvcik6IGVycm9yIGlzIE1ldGFkYXRhRXJyb3Ige1xuICByZXR1cm4gISEoZXJyb3IgYXMgYW55KVtNRVRBREFUQV9FUlJPUl07XG59XG5cbmNvbnN0IFJFRkVSRU5DRV9UT19OT05FWFBPUlRFRF9DTEFTUyA9ICdSZWZlcmVuY2UgdG8gbm9uLWV4cG9ydGVkIGNsYXNzJztcbmNvbnN0IFZBUklBQkxFX05PVF9JTklUSUFMSVpFRCA9ICdWYXJpYWJsZSBub3QgaW5pdGlhbGl6ZWQnO1xuY29uc3QgREVTVFJVQ1RVUkVfTk9UX1NVUFBPUlRFRCA9ICdEZXN0cnVjdHVyaW5nIG5vdCBzdXBwb3J0ZWQnO1xuY29uc3QgQ09VTERfTk9UX1JFU09MVkVfVFlQRSA9ICdDb3VsZCBub3QgcmVzb2x2ZSB0eXBlJztcbmNvbnN0IEZVTkNUSU9OX0NBTExfTk9UX1NVUFBPUlRFRCA9ICdGdW5jdGlvbiBjYWxsIG5vdCBzdXBwb3J0ZWQnO1xuY29uc3QgUkVGRVJFTkNFX1RPX0xPQ0FMX1NZTUJPTCA9ICdSZWZlcmVuY2UgdG8gYSBsb2NhbCBzeW1ib2wnO1xuY29uc3QgTEFNQkRBX05PVF9TVVBQT1JURUQgPSAnTGFtYmRhIG5vdCBzdXBwb3J0ZWQnO1xuXG5mdW5jdGlvbiBleHBhbmRlZE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nLCBjb250ZXh0OiBhbnkpOiBzdHJpbmcge1xuICBzd2l0Y2ggKG1lc3NhZ2UpIHtcbiAgICBjYXNlIFJFRkVSRU5DRV9UT19OT05FWFBPUlRFRF9DTEFTUzpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQuY2xhc3NOYW1lKSB7XG4gICAgICAgIHJldHVybiBgUmVmZXJlbmNlcyB0byBhIG5vbi1leHBvcnRlZCBjbGFzcyBhcmUgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzIGJ1dCAke2NvbnRleHQuY2xhc3NOYW1lfSB3YXMgcmVmZXJlbmNlZC5gO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBWQVJJQUJMRV9OT1RfSU5JVElBTElaRUQ6XG4gICAgICByZXR1cm4gJ09ubHkgaW5pdGlhbGl6ZWQgdmFyaWFibGVzIGFuZCBjb25zdGFudHMgY2FuIGJlIHJlZmVyZW5jZWQgaW4gZGVjb3JhdG9ycyBiZWNhdXNlIHRoZSB2YWx1ZSBvZiB0aGlzIHZhcmlhYmxlIGlzIG5lZWRlZCBieSB0aGUgdGVtcGxhdGUgY29tcGlsZXInO1xuICAgIGNhc2UgREVTVFJVQ1RVUkVfTk9UX1NVUFBPUlRFRDpcbiAgICAgIHJldHVybiAnUmVmZXJlbmNpbmcgYW4gZXhwb3J0ZWQgZGVzdHJ1Y3R1cmVkIHZhcmlhYmxlIG9yIGNvbnN0YW50IGlzIG5vdCBzdXBwb3J0ZWQgaW4gZGVjb3JhdG9ycyBhbmQgdGhpcyB2YWx1ZSBpcyBuZWVkZWQgYnkgdGhlIHRlbXBsYXRlIGNvbXBpbGVyJztcbiAgICBjYXNlIENPVUxEX05PVF9SRVNPTFZFX1RZUEU6XG4gICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0LnR5cGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBgQ291bGQgbm90IHJlc29sdmUgdHlwZSAke2NvbnRleHQudHlwZU5hbWV9YDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgRlVOQ1RJT05fQ0FMTF9OT1RfU1VQUE9SVEVEOlxuICAgICAgaWYgKGNvbnRleHQgJiYgY29udGV4dC5uYW1lKSB7XG4gICAgICAgIHJldHVybiBgRnVuY3Rpb24gY2FsbHMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gZGVjb3JhdG9ycyBidXQgJyR7Y29udGV4dC5uYW1lfScgd2FzIGNhbGxlZGA7XG4gICAgICB9XG4gICAgICByZXR1cm4gJ0Z1bmN0aW9uIGNhbGxzIGFyZSBub3Qgc3VwcG9ydGVkIGluIGRlY29yYXRvcnMnO1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX0xPQ0FMX1NZTUJPTDpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQubmFtZSkge1xuICAgICAgICByZXR1cm4gYFJlZmVyZW5jZSB0byBhIGxvY2FsIChub24tZXhwb3J0ZWQpIHN5bWJvbHMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gZGVjb3JhdG9ycyBidXQgJyR7Y29udGV4dC5uYW1lfScgd2FzIHJlZmVyZW5jZWRgO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBMQU1CREFfTk9UX1NVUFBPUlRFRDpcbiAgICAgIHJldHVybiBgRnVuY3Rpb24gZXhwcmVzc2lvbnMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gZGVjb3JhdG9yc2A7XG4gIH1cbiAgcmV0dXJuIG1lc3NhZ2U7XG59XG5cbmZ1bmN0aW9uIG1lc3NhZ2VBZHZpc2UobWVzc2FnZTogc3RyaW5nLCBjb250ZXh0OiBhbnkpOiBzdHJpbmd8dW5kZWZpbmVkIHtcbiAgc3dpdGNoIChtZXNzYWdlKSB7XG4gICAgY2FzZSBSRUZFUkVOQ0VfVE9fTk9ORVhQT1JURURfQ0xBU1M6XG4gICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0LmNsYXNzTmFtZSkge1xuICAgICAgICByZXR1cm4gYENvbnNpZGVyIGV4cG9ydGluZyAnJHtjb250ZXh0LmNsYXNzTmFtZX0nYDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgREVTVFJVQ1RVUkVfTk9UX1NVUFBPUlRFRDpcbiAgICAgIHJldHVybiAnQ29uc2lkZXIgc2ltcGxpZnlpbmcgdG8gYXZvaWQgZGVzdHJ1Y3R1cmluZyc7XG4gICAgY2FzZSBSRUZFUkVOQ0VfVE9fTE9DQUxfU1lNQk9MOlxuICAgICAgaWYgKGNvbnRleHQgJiYgY29udGV4dC5uYW1lKSB7XG4gICAgICAgIHJldHVybiBgQ29uc2lkZXIgZXhwb3J0aW5nICcke2NvbnRleHQubmFtZX0nYDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgTEFNQkRBX05PVF9TVVBQT1JURUQ6XG4gICAgICByZXR1cm4gYENvbnNpZGVyIGNoYW5naW5nIHRoZSBmdW5jdGlvbiBleHByZXNzaW9uIGludG8gYW4gZXhwb3J0ZWQgZnVuY3Rpb25gO1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGVycm9yU3VtbWFyeShlcnJvcjogTWV0YWRhdGFFcnJvcik6IHN0cmluZyB7XG4gIGlmIChlcnJvci5zdW1tYXJ5KSB7XG4gICAgcmV0dXJuIGVycm9yLnN1bW1hcnk7XG4gIH1cbiAgc3dpdGNoIChlcnJvci5tZXNzYWdlKSB7XG4gICAgY2FzZSBSRUZFUkVOQ0VfVE9fTk9ORVhQT1JURURfQ0xBU1M6XG4gICAgICBpZiAoZXJyb3IuY29udGV4dCAmJiBlcnJvci5jb250ZXh0LmNsYXNzTmFtZSkge1xuICAgICAgICByZXR1cm4gYHJlZmVyZW5jZXMgbm9uLWV4cG9ydGVkIGNsYXNzICR7ZXJyb3IuY29udGV4dC5jbGFzc05hbWV9YDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgVkFSSUFCTEVfTk9UX0lOSVRJQUxJWkVEOlxuICAgICAgcmV0dXJuICdpcyBub3QgaW5pdGlhbGl6ZWQnO1xuICAgIGNhc2UgREVTVFJVQ1RVUkVfTk9UX1NVUFBPUlRFRDpcbiAgICAgIHJldHVybiAnaXMgYSBkZXN0cnVjdHVyZWQgdmFyaWFibGUnO1xuICAgIGNhc2UgQ09VTERfTk9UX1JFU09MVkVfVFlQRTpcbiAgICAgIHJldHVybiAnY291bGQgbm90IGJlIHJlc29sdmVkJztcbiAgICBjYXNlIEZVTkNUSU9OX0NBTExfTk9UX1NVUFBPUlRFRDpcbiAgICAgIGlmIChlcnJvci5jb250ZXh0ICYmIGVycm9yLmNvbnRleHQubmFtZSkge1xuICAgICAgICByZXR1cm4gYGNhbGxzICcke2Vycm9yLmNvbnRleHQubmFtZX0nYDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBgY2FsbHMgYSBmdW5jdGlvbmA7XG4gICAgY2FzZSBSRUZFUkVOQ0VfVE9fTE9DQUxfU1lNQk9MOlxuICAgICAgaWYgKGVycm9yLmNvbnRleHQgJiYgZXJyb3IuY29udGV4dC5uYW1lKSB7XG4gICAgICAgIHJldHVybiBgcmVmZXJlbmNlcyBsb2NhbCB2YXJpYWJsZSAke2Vycm9yLmNvbnRleHQubmFtZX1gO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGByZWZlcmVuY2VzIGEgbG9jYWwgdmFyaWFibGVgO1xuICB9XG4gIHJldHVybiAnY29udGFpbnMgdGhlIGVycm9yJztcbn1cblxuZnVuY3Rpb24gbWFwU3RyaW5nTWFwKGlucHV0OiB7W2tleTogc3RyaW5nXTogYW55fSwgdHJhbnNmb3JtOiAodmFsdWU6IGFueSwga2V5OiBzdHJpbmcpID0+IGFueSk6XG4gICAge1trZXk6IHN0cmluZ106IGFueX0ge1xuICBpZiAoIWlucHV0KSByZXR1cm4ge307XG4gIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgT2JqZWN0LmtleXMoaW5wdXQpLmZvckVhY2goKGtleSkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gdHJhbnNmb3JtKGlucHV0W2tleV0sIGtleSk7XG4gICAgaWYgKCFzaG91bGRJZ25vcmUodmFsdWUpKSB7XG4gICAgICBpZiAoSElEREVOX0tFWS50ZXN0KGtleSkpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlc3VsdCwga2V5LCB7ZW51bWVyYWJsZTogZmFsc2UsIGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHZhbHVlfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKG86IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbyA9PT0gbnVsbCB8fCAodHlwZW9mIG8gIT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIG8gIT09ICdvYmplY3QnKTtcbn1cblxuaW50ZXJmYWNlIEJpbmRpbmdTY29wZUJ1aWxkZXIge1xuICBkZWZpbmUobmFtZTogc3RyaW5nLCB2YWx1ZTogYW55KTogQmluZGluZ1Njb3BlQnVpbGRlcjtcbiAgZG9uZSgpOiBCaW5kaW5nU2NvcGU7XG59XG5cbmFic3RyYWN0IGNsYXNzIEJpbmRpbmdTY29wZSB7XG4gIGFic3RyYWN0IHJlc29sdmUobmFtZTogc3RyaW5nKTogYW55O1xuICBwdWJsaWMgc3RhdGljIG1pc3NpbmcgPSB7fTtcbiAgcHVibGljIHN0YXRpYyBlbXB0eTogQmluZGluZ1Njb3BlID0ge3Jlc29sdmU6IG5hbWUgPT4gQmluZGluZ1Njb3BlLm1pc3Npbmd9O1xuXG4gIHB1YmxpYyBzdGF0aWMgYnVpbGQoKTogQmluZGluZ1Njb3BlQnVpbGRlciB7XG4gICAgY29uc3QgY3VycmVudCA9IG5ldyBNYXA8c3RyaW5nLCBhbnk+KCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRlZmluZTogZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICAgICAgY3VycmVudC5zZXQobmFtZSwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0sXG4gICAgICBkb25lOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnQuc2l6ZSA+IDAgPyBuZXcgUG9wdWxhdGVkU2NvcGUoY3VycmVudCkgOiBCaW5kaW5nU2NvcGUuZW1wdHk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxufVxuXG5jbGFzcyBQb3B1bGF0ZWRTY29wZSBleHRlbmRzIEJpbmRpbmdTY29wZSB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYmluZGluZ3M6IE1hcDxzdHJpbmcsIGFueT4pIHsgc3VwZXIoKTsgfVxuXG4gIHJlc29sdmUobmFtZTogc3RyaW5nKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5ncy5oYXMobmFtZSkgPyB0aGlzLmJpbmRpbmdzLmdldChuYW1lKSA6IEJpbmRpbmdTY29wZS5taXNzaW5nO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZvcm1hdE1ldGFkYXRhTWVzc2FnZUNoYWluKFxuICAgIGNoYWluOiBNZXRhZGF0YU1lc3NhZ2VDaGFpbiwgYWR2aXNlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW4ge1xuICBjb25zdCBleHBhbmRlZCA9IGV4cGFuZGVkTWVzc2FnZShjaGFpbi5tZXNzYWdlLCBjaGFpbi5jb250ZXh0KTtcbiAgY29uc3QgbmVzdGluZyA9IGNoYWluLnN5bWJvbCA/IGAgaW4gJyR7Y2hhaW4uc3ltYm9sLm5hbWV9J2AgOiAnJztcbiAgY29uc3QgbWVzc2FnZSA9IGAke2V4cGFuZGVkfSR7bmVzdGluZ31gO1xuICBjb25zdCBwb3NpdGlvbiA9IGNoYWluLnBvc2l0aW9uO1xuICBjb25zdCBuZXh0OiBGb3JtYXR0ZWRNZXNzYWdlQ2hhaW58dW5kZWZpbmVkID0gY2hhaW4ubmV4dCA/XG4gICAgICBmb3JtYXRNZXRhZGF0YU1lc3NhZ2VDaGFpbihjaGFpbi5uZXh0LCBhZHZpc2UpIDpcbiAgICAgIGFkdmlzZSA/IHttZXNzYWdlOiBhZHZpc2V9IDogdW5kZWZpbmVkO1xuICByZXR1cm4ge21lc3NhZ2UsIHBvc2l0aW9uLCBuZXh0fTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0TWV0YWRhdGFFcnJvcihlOiBFcnJvciwgY29udGV4dDogU3RhdGljU3ltYm9sKTogRXJyb3Ige1xuICBpZiAoaXNNZXRhZGF0YUVycm9yKGUpKSB7XG4gICAgLy8gUHJvZHVjZSBhIGZvcm1hdHRlZCB2ZXJzaW9uIG9mIHRoZSBhbmQgbGVhdmluZyBlbm91Z2ggaW5mb3JtYXRpb24gaW4gdGhlIG9yaWdpbmFsIGVycm9yXG4gICAgLy8gdG8gcmVjb3ZlciB0aGUgZm9ybWF0dGluZyBpbmZvcm1hdGlvbiB0byBldmVudHVhbGx5IHByb2R1Y2UgYSBkaWFnbm9zdGljIGVycm9yIG1lc3NhZ2UuXG4gICAgY29uc3QgcG9zaXRpb24gPSBlLnBvc2l0aW9uO1xuICAgIGNvbnN0IGNoYWluOiBNZXRhZGF0YU1lc3NhZ2VDaGFpbiA9IHtcbiAgICAgIG1lc3NhZ2U6IGBFcnJvciBkdXJpbmcgdGVtcGxhdGUgY29tcGlsZSBvZiAnJHtjb250ZXh0Lm5hbWV9J2AsXG4gICAgICBwb3NpdGlvbjogcG9zaXRpb24sXG4gICAgICBuZXh0OiB7bWVzc2FnZTogZS5tZXNzYWdlLCBuZXh0OiBlLmNoYWluLCBjb250ZXh0OiBlLmNvbnRleHQsIHN5bWJvbDogZS5zeW1ib2x9XG4gICAgfTtcbiAgICBjb25zdCBhZHZpc2UgPSBlLmFkdmlzZSB8fCBtZXNzYWdlQWR2aXNlKGUubWVzc2FnZSwgZS5jb250ZXh0KTtcbiAgICByZXR1cm4gZm9ybWF0dGVkRXJyb3IoZm9ybWF0TWV0YWRhdGFNZXNzYWdlQ2hhaW4oY2hhaW4sIGFkdmlzZSkpO1xuICB9XG4gIHJldHVybiBlO1xufVxuIl19