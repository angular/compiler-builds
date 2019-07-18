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
        var e_1, _a;
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
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (staticMembers_1_1 && !staticMembers_1_1.done && (_a = staticMembers_1.return)) _a.call(staticMembers_1);
            }
            finally { if (e_1) throw e_1.error; }
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
                var e_2, _a, e_3, _b;
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
                                        for (var spreadArray_1 = tslib_1.__values(spreadArray), spreadArray_1_1 = spreadArray_1.next(); !spreadArray_1_1.done; spreadArray_1_1 = spreadArray_1.next()) {
                                            var spreadItem = spreadArray_1_1.value;
                                            result_2.push(spreadItem);
                                        }
                                    }
                                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                                    finally {
                                        try {
                                            if (spreadArray_1_1 && !spreadArray_1_1.done && (_b = spreadArray_1.return)) _b.call(spreadArray_1);
                                        }
                                        finally { if (e_3) throw e_3.error; }
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
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                        }
                        finally { if (e_2) throw e_2.error; }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3JlZmxlY3Rvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3Qvc3RhdGljX3JlZmxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFFdkQsT0FBTyxFQUFrQixlQUFlLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFHalcsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVwQyxPQUFPLEVBQXdCLGNBQWMsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3hFLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUc3QyxJQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7QUFDckMsSUFBTSxjQUFjLEdBQUcsaUJBQWlCLENBQUM7QUFFekMsSUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDO0FBRTlCLElBQU0sTUFBTSxHQUFHO0lBQ2IsVUFBVSxFQUFFLFFBQVE7Q0FDckIsQ0FBQztBQUVGLElBQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQztBQUM3QixJQUFNLE9BQU8sR0FBRyxTQUFTLENBQUM7QUFDMUIsSUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FB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QUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQztRQUM1QixJQUFNLEtBQUssR0FBeUI7WUFDbEMsT0FBTyxFQUFFLHVDQUFxQyxPQUFPLENBQUMsSUFBSSxNQUFHO1lBQzdELFFBQVEsRUFBRSxRQUFRO1lBQ2xCLElBQUksRUFBRSxFQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFDO1NBQ2hGLENBQUM7UUFDRixJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMvRCxPQUFPLGNBQWMsQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztLQUNsRTtJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlU3VtbWFyeUtpbmR9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge01ldGFkYXRhRmFjdG9yeSwgY3JlYXRlQXR0cmlidXRlLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZUNvbnRlbnRDaGlsZCwgY3JlYXRlQ29udGVudENoaWxkcmVuLCBjcmVhdGVEaXJlY3RpdmUsIGNyZWF0ZUhvc3QsIGNyZWF0ZUhvc3RCaW5kaW5nLCBjcmVhdGVIb3N0TGlzdGVuZXIsIGNyZWF0ZUluamVjdCwgY3JlYXRlSW5qZWN0YWJsZSwgY3JlYXRlSW5wdXQsIGNyZWF0ZU5nTW9kdWxlLCBjcmVhdGVPcHRpb25hbCwgY3JlYXRlT3V0cHV0LCBjcmVhdGVQaXBlLCBjcmVhdGVTZWxmLCBjcmVhdGVTa2lwU2VsZiwgY3JlYXRlVmlld0NoaWxkLCBjcmVhdGVWaWV3Q2hpbGRyZW59IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1N1bW1hcnlSZXNvbHZlcn0gZnJvbSAnLi4vc3VtbWFyeV9yZXNvbHZlcic7XG5pbXBvcnQge3N5bnRheEVycm9yfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtGb3JtYXR0ZWRNZXNzYWdlQ2hhaW4sIGZvcm1hdHRlZEVycm9yfSBmcm9tICcuL2Zvcm1hdHRlZF9lcnJvcic7XG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7U3RhdGljU3ltYm9sUmVzb2x2ZXJ9IGZyb20gJy4vc3RhdGljX3N5bWJvbF9yZXNvbHZlcic7XG5cbmNvbnN0IEFOR1VMQVJfQ09SRSA9ICdAYW5ndWxhci9jb3JlJztcbmNvbnN0IEFOR1VMQVJfUk9VVEVSID0gJ0Bhbmd1bGFyL3JvdXRlcic7XG5cbmNvbnN0IEhJRERFTl9LRVkgPSAvXlxcJC4qXFwkJC87XG5cbmNvbnN0IElHTk9SRSA9IHtcbiAgX19zeW1ib2xpYzogJ2lnbm9yZSdcbn07XG5cbmNvbnN0IFVTRV9WQUxVRSA9ICd1c2VWYWx1ZSc7XG5jb25zdCBQUk9WSURFID0gJ3Byb3ZpZGUnO1xuY29uc3QgUkVGRVJFTkNFX1NFVCA9IG5ldyBTZXQoW1VTRV9WQUxVRSwgJ3VzZUZhY3RvcnknLCAnZGF0YScsICdpZCcsICdsb2FkQ2hpbGRyZW4nXSk7XG5jb25zdCBUWVBFR1VBUkRfUE9TVEZJWCA9ICdUeXBlR3VhcmQnO1xuY29uc3QgVVNFX0lGID0gJ1VzZUlmJztcblxuZnVuY3Rpb24gc2hvdWxkSWdub3JlKHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZhbHVlICYmIHZhbHVlLl9fc3ltYm9saWMgPT0gJ2lnbm9yZSc7XG59XG5cbi8qKlxuICogQSBzdGF0aWMgcmVmbGVjdG9yIGltcGxlbWVudHMgZW5vdWdoIG9mIHRoZSBSZWZsZWN0b3IgQVBJIHRoYXQgaXMgbmVjZXNzYXJ5IHRvIGNvbXBpbGVcbiAqIHRlbXBsYXRlcyBzdGF0aWNhbGx5LlxuICovXG5leHBvcnQgY2xhc3MgU3RhdGljUmVmbGVjdG9yIGltcGxlbWVudHMgQ29tcGlsZVJlZmxlY3RvciB7XG4gIHByaXZhdGUgYW5ub3RhdGlvbkNhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIGFueVtdPigpO1xuICBwcml2YXRlIHNoYWxsb3dBbm5vdGF0aW9uQ2FjaGUgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwgYW55W10+KCk7XG4gIHByaXZhdGUgcHJvcGVydHlDYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCB7W2tleTogc3RyaW5nXTogYW55W119PigpO1xuICBwcml2YXRlIHBhcmFtZXRlckNhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIGFueVtdPigpO1xuICBwcml2YXRlIG1ldGhvZENhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIHtba2V5OiBzdHJpbmddOiBib29sZWFufT4oKTtcbiAgcHJpdmF0ZSBzdGF0aWNDYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBzdHJpbmdbXT4oKTtcbiAgcHJpdmF0ZSBjb252ZXJzaW9uTWFwID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIChjb250ZXh0OiBTdGF0aWNTeW1ib2wsIGFyZ3M6IGFueVtdKSA9PiBhbnk+KCk7XG4gIHByaXZhdGUgcmVzb2x2ZWRFeHRlcm5hbFJlZmVyZW5jZXMgPSBuZXcgTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPigpO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBpbmplY3Rpb25Ub2tlbiAhOiBTdGF0aWNTeW1ib2w7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwcml2YXRlIG9wYXF1ZVRva2VuICE6IFN0YXRpY1N5bWJvbDtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIFJPVVRFUyAhOiBTdGF0aWNTeW1ib2w7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwcml2YXRlIEFOQUxZWkVfRk9SX0VOVFJZX0NPTVBPTkVOVFMgITogU3RhdGljU3ltYm9sO1xuICBwcml2YXRlIGFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZCA9XG4gICAgICBuZXcgTWFwPENvbXBpbGVTdW1tYXJ5S2luZCwgTWV0YWRhdGFGYWN0b3J5PGFueT5bXT4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgc3VtbWFyeVJlc29sdmVyOiBTdW1tYXJ5UmVzb2x2ZXI8U3RhdGljU3ltYm9sPixcbiAgICAgIHByaXZhdGUgc3ltYm9sUmVzb2x2ZXI6IFN0YXRpY1N5bWJvbFJlc29sdmVyLFxuICAgICAga25vd25NZXRhZGF0YUNsYXNzZXM6IHtuYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcsIGN0b3I6IGFueX1bXSA9IFtdLFxuICAgICAga25vd25NZXRhZGF0YUZ1bmN0aW9uczoge25hbWU6IHN0cmluZywgZmlsZVBhdGg6IHN0cmluZywgZm46IGFueX1bXSA9IFtdLFxuICAgICAgcHJpdmF0ZSBlcnJvclJlY29yZGVyPzogKGVycm9yOiBhbnksIGZpbGVOYW1lPzogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgdGhpcy5pbml0aWFsaXplQ29udmVyc2lvbk1hcCgpO1xuICAgIGtub3duTWV0YWRhdGFDbGFzc2VzLmZvckVhY2goXG4gICAgICAgIChrYykgPT4gdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgdGhpcy5nZXRTdGF0aWNTeW1ib2woa2MuZmlsZVBhdGgsIGtjLm5hbWUpLCBrYy5jdG9yKSk7XG4gICAga25vd25NZXRhZGF0YUZ1bmN0aW9ucy5mb3JFYWNoKFxuICAgICAgICAoa2YpID0+IHRoaXMuX3JlZ2lzdGVyRnVuY3Rpb24odGhpcy5nZXRTdGF0aWNTeW1ib2woa2YuZmlsZVBhdGgsIGtmLm5hbWUpLCBrZi5mbikpO1xuICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLnNldChcbiAgICAgICAgQ29tcGlsZVN1bW1hcnlLaW5kLkRpcmVjdGl2ZSwgW2NyZWF0ZURpcmVjdGl2ZSwgY3JlYXRlQ29tcG9uZW50XSk7XG4gICAgdGhpcy5hbm5vdGF0aW9uRm9yUGFyZW50Q2xhc3NXaXRoU3VtbWFyeUtpbmQuc2V0KENvbXBpbGVTdW1tYXJ5S2luZC5QaXBlLCBbY3JlYXRlUGlwZV0pO1xuICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLnNldChDb21waWxlU3VtbWFyeUtpbmQuTmdNb2R1bGUsIFtjcmVhdGVOZ01vZHVsZV0pO1xuICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLnNldChcbiAgICAgICAgQ29tcGlsZVN1bW1hcnlLaW5kLkluamVjdGFibGUsXG4gICAgICAgIFtjcmVhdGVJbmplY3RhYmxlLCBjcmVhdGVQaXBlLCBjcmVhdGVEaXJlY3RpdmUsIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlTmdNb2R1bGVdKTtcbiAgfVxuXG4gIGNvbXBvbmVudE1vZHVsZVVybCh0eXBlT3JGdW5jOiBTdGF0aWNTeW1ib2wpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YXRpY1N5bWJvbCA9IHRoaXMuZmluZFN5bWJvbERlY2xhcmF0aW9uKHR5cGVPckZ1bmMpO1xuICAgIHJldHVybiB0aGlzLnN5bWJvbFJlc29sdmVyLmdldFJlc291cmNlUGF0aChzdGF0aWNTeW1ib2wpO1xuICB9XG5cbiAgcmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKHJlZjogby5FeHRlcm5hbFJlZmVyZW5jZSwgY29udGFpbmluZ0ZpbGU/OiBzdHJpbmcpOiBTdGF0aWNTeW1ib2wge1xuICAgIGxldCBrZXk6IHN0cmluZ3x1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKCFjb250YWluaW5nRmlsZSkge1xuICAgICAga2V5ID0gYCR7cmVmLm1vZHVsZU5hbWV9OiR7cmVmLm5hbWV9YDtcbiAgICAgIGNvbnN0IGRlY2xhcmF0aW9uU3ltYm9sID0gdGhpcy5yZXNvbHZlZEV4dGVybmFsUmVmZXJlbmNlcy5nZXQoa2V5KTtcbiAgICAgIGlmIChkZWNsYXJhdGlvblN5bWJvbCkgcmV0dXJuIGRlY2xhcmF0aW9uU3ltYm9sO1xuICAgIH1cbiAgICBjb25zdCByZWZTeW1ib2wgPVxuICAgICAgICB0aGlzLnN5bWJvbFJlc29sdmVyLmdldFN5bWJvbEJ5TW9kdWxlKHJlZi5tb2R1bGVOYW1lICEsIHJlZi5uYW1lICEsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICBjb25zdCBkZWNsYXJhdGlvblN5bWJvbCA9IHRoaXMuZmluZFN5bWJvbERlY2xhcmF0aW9uKHJlZlN5bWJvbCk7XG4gICAgaWYgKCFjb250YWluaW5nRmlsZSkge1xuICAgICAgdGhpcy5zeW1ib2xSZXNvbHZlci5yZWNvcmRNb2R1bGVOYW1lRm9yRmlsZU5hbWUocmVmU3ltYm9sLmZpbGVQYXRoLCByZWYubW9kdWxlTmFtZSAhKTtcbiAgICAgIHRoaXMuc3ltYm9sUmVzb2x2ZXIucmVjb3JkSW1wb3J0QXMoZGVjbGFyYXRpb25TeW1ib2wsIHJlZlN5bWJvbCk7XG4gICAgfVxuICAgIGlmIChrZXkpIHtcbiAgICAgIHRoaXMucmVzb2x2ZWRFeHRlcm5hbFJlZmVyZW5jZXMuc2V0KGtleSwgZGVjbGFyYXRpb25TeW1ib2wpO1xuICAgIH1cbiAgICByZXR1cm4gZGVjbGFyYXRpb25TeW1ib2w7XG4gIH1cblxuICBmaW5kRGVjbGFyYXRpb24obW9kdWxlVXJsOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgY29udGFpbmluZ0ZpbGU/OiBzdHJpbmcpOiBTdGF0aWNTeW1ib2wge1xuICAgIHJldHVybiB0aGlzLmZpbmRTeW1ib2xEZWNsYXJhdGlvbihcbiAgICAgICAgdGhpcy5zeW1ib2xSZXNvbHZlci5nZXRTeW1ib2xCeU1vZHVsZShtb2R1bGVVcmwsIG5hbWUsIGNvbnRhaW5pbmdGaWxlKSk7XG4gIH1cblxuICB0cnlGaW5kRGVjbGFyYXRpb24obW9kdWxlVXJsOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgY29udGFpbmluZ0ZpbGU/OiBzdHJpbmcpOiBTdGF0aWNTeW1ib2wge1xuICAgIHJldHVybiB0aGlzLnN5bWJvbFJlc29sdmVyLmlnbm9yZUVycm9yc0ZvcihcbiAgICAgICAgKCkgPT4gdGhpcy5maW5kRGVjbGFyYXRpb24obW9kdWxlVXJsLCBuYW1lLCBjb250YWluaW5nRmlsZSkpO1xuICB9XG5cbiAgZmluZFN5bWJvbERlY2xhcmF0aW9uKHN5bWJvbDogU3RhdGljU3ltYm9sKTogU3RhdGljU3ltYm9sIHtcbiAgICBjb25zdCByZXNvbHZlZFN5bWJvbCA9IHRoaXMuc3ltYm9sUmVzb2x2ZXIucmVzb2x2ZVN5bWJvbChzeW1ib2wpO1xuICAgIGlmIChyZXNvbHZlZFN5bWJvbCkge1xuICAgICAgbGV0IHJlc29sdmVkTWV0YWRhdGEgPSByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YTtcbiAgICAgIGlmIChyZXNvbHZlZE1ldGFkYXRhICYmIHJlc29sdmVkTWV0YWRhdGEuX19zeW1ib2xpYyA9PT0gJ3Jlc29sdmVkJykge1xuICAgICAgICByZXNvbHZlZE1ldGFkYXRhID0gcmVzb2x2ZWRNZXRhZGF0YS5zeW1ib2w7XG4gICAgICB9XG4gICAgICBpZiAocmVzb2x2ZWRNZXRhZGF0YSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5maW5kU3ltYm9sRGVjbGFyYXRpb24ocmVzb2x2ZWRTeW1ib2wubWV0YWRhdGEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3ltYm9sO1xuICB9XG5cbiAgcHVibGljIHRyeUFubm90YXRpb25zKHR5cGU6IFN0YXRpY1N5bWJvbCk6IGFueVtdIHtcbiAgICBjb25zdCBvcmlnaW5hbFJlY29yZGVyID0gdGhpcy5lcnJvclJlY29yZGVyO1xuICAgIHRoaXMuZXJyb3JSZWNvcmRlciA9IChlcnJvcjogYW55LCBmaWxlTmFtZT86IHN0cmluZykgPT4ge307XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLmFubm90YXRpb25zKHR5cGUpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLmVycm9yUmVjb3JkZXIgPSBvcmlnaW5hbFJlY29yZGVyO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhbm5vdGF0aW9ucyh0eXBlOiBTdGF0aWNTeW1ib2wpOiBhbnlbXSB7XG4gICAgcmV0dXJuIHRoaXMuX2Fubm90YXRpb25zKFxuICAgICAgICB0eXBlLCAodHlwZTogU3RhdGljU3ltYm9sLCBkZWNvcmF0b3JzOiBhbnkpID0+IHRoaXMuc2ltcGxpZnkodHlwZSwgZGVjb3JhdG9ycyksXG4gICAgICAgIHRoaXMuYW5ub3RhdGlvbkNhY2hlKTtcbiAgfVxuXG4gIHB1YmxpYyBzaGFsbG93QW5ub3RhdGlvbnModHlwZTogU3RhdGljU3ltYm9sKTogYW55W10ge1xuICAgIHJldHVybiB0aGlzLl9hbm5vdGF0aW9ucyhcbiAgICAgICAgdHlwZSwgKHR5cGU6IFN0YXRpY1N5bWJvbCwgZGVjb3JhdG9yczogYW55KSA9PiB0aGlzLnNpbXBsaWZ5KHR5cGUsIGRlY29yYXRvcnMsIHRydWUpLFxuICAgICAgICB0aGlzLnNoYWxsb3dBbm5vdGF0aW9uQ2FjaGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBfYW5ub3RhdGlvbnMoXG4gICAgICB0eXBlOiBTdGF0aWNTeW1ib2wsIHNpbXBsaWZ5OiAodHlwZTogU3RhdGljU3ltYm9sLCBkZWNvcmF0b3JzOiBhbnkpID0+IGFueSxcbiAgICAgIGFubm90YXRpb25DYWNoZTogTWFwPFN0YXRpY1N5bWJvbCwgYW55W10+KTogYW55W10ge1xuICAgIGxldCBhbm5vdGF0aW9ucyA9IGFubm90YXRpb25DYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFhbm5vdGF0aW9ucykge1xuICAgICAgYW5ub3RhdGlvbnMgPSBbXTtcbiAgICAgIGNvbnN0IGNsYXNzTWV0YWRhdGEgPSB0aGlzLmdldFR5cGVNZXRhZGF0YSh0eXBlKTtcbiAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0aGlzLmZpbmRQYXJlbnRUeXBlKHR5cGUsIGNsYXNzTWV0YWRhdGEpO1xuICAgICAgaWYgKHBhcmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgcGFyZW50QW5ub3RhdGlvbnMgPSB0aGlzLmFubm90YXRpb25zKHBhcmVudFR5cGUpO1xuICAgICAgICBhbm5vdGF0aW9ucy5wdXNoKC4uLnBhcmVudEFubm90YXRpb25zKTtcbiAgICAgIH1cbiAgICAgIGxldCBvd25Bbm5vdGF0aW9uczogYW55W10gPSBbXTtcbiAgICAgIGlmIChjbGFzc01ldGFkYXRhWydkZWNvcmF0b3JzJ10pIHtcbiAgICAgICAgb3duQW5ub3RhdGlvbnMgPSBzaW1wbGlmeSh0eXBlLCBjbGFzc01ldGFkYXRhWydkZWNvcmF0b3JzJ10pO1xuICAgICAgICBpZiAob3duQW5ub3RhdGlvbnMpIHtcbiAgICAgICAgICBhbm5vdGF0aW9ucy5wdXNoKC4uLm93bkFubm90YXRpb25zKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHBhcmVudFR5cGUgJiYgIXRoaXMuc3VtbWFyeVJlc29sdmVyLmlzTGlicmFyeUZpbGUodHlwZS5maWxlUGF0aCkgJiZcbiAgICAgICAgICB0aGlzLnN1bW1hcnlSZXNvbHZlci5pc0xpYnJhcnlGaWxlKHBhcmVudFR5cGUuZmlsZVBhdGgpKSB7XG4gICAgICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLnN1bW1hcnlSZXNvbHZlci5yZXNvbHZlU3VtbWFyeShwYXJlbnRUeXBlKTtcbiAgICAgICAgaWYgKHN1bW1hcnkgJiYgc3VtbWFyeS50eXBlKSB7XG4gICAgICAgICAgY29uc3QgcmVxdWlyZWRBbm5vdGF0aW9uVHlwZXMgPVxuICAgICAgICAgICAgICB0aGlzLmFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZC5nZXQoc3VtbWFyeS50eXBlLnN1bW1hcnlLaW5kICEpICE7XG4gICAgICAgICAgY29uc3QgdHlwZUhhc1JlcXVpcmVkQW5ub3RhdGlvbiA9IHJlcXVpcmVkQW5ub3RhdGlvblR5cGVzLnNvbWUoXG4gICAgICAgICAgICAgIChyZXF1aXJlZFR5cGUpID0+IG93bkFubm90YXRpb25zLnNvbWUoYW5uID0+IHJlcXVpcmVkVHlwZS5pc1R5cGVPZihhbm4pKSk7XG4gICAgICAgICAgaWYgKCF0eXBlSGFzUmVxdWlyZWRBbm5vdGF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAgIGZvcm1hdE1ldGFkYXRhRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgIG1ldGFkYXRhRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICBgQ2xhc3MgJHt0eXBlLm5hbWV9IGluICR7dHlwZS5maWxlUGF0aH0gZXh0ZW5kcyBmcm9tIGEgJHtDb21waWxlU3VtbWFyeUtpbmRbc3VtbWFyeS50eXBlLnN1bW1hcnlLaW5kIV19IGluIGFub3RoZXIgY29tcGlsYXRpb24gdW5pdCB3aXRob3V0IGR1cGxpY2F0aW5nIHRoZSBkZWNvcmF0b3JgLFxuICAgICAgICAgICAgICAgICAgICAgICAgLyogc3VtbWFyeSAqLyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBgUGxlYXNlIGFkZCBhICR7cmVxdWlyZWRBbm5vdGF0aW9uVHlwZXMubWFwKCh0eXBlKSA9PiB0eXBlLm5nTWV0YWRhdGFOYW1lKS5qb2luKCcgb3IgJyl9IGRlY29yYXRvciB0byB0aGUgY2xhc3NgKSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZSksXG4gICAgICAgICAgICAgICAgdHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBhbm5vdGF0aW9uQ2FjaGUuc2V0KHR5cGUsIGFubm90YXRpb25zLmZpbHRlcihhbm4gPT4gISFhbm4pKTtcbiAgICB9XG4gICAgcmV0dXJuIGFubm90YXRpb25zO1xuICB9XG5cbiAgcHVibGljIHByb3BNZXRhZGF0YSh0eXBlOiBTdGF0aWNTeW1ib2wpOiB7W2tleTogc3RyaW5nXTogYW55W119IHtcbiAgICBsZXQgcHJvcE1ldGFkYXRhID0gdGhpcy5wcm9wZXJ0eUNhY2hlLmdldCh0eXBlKTtcbiAgICBpZiAoIXByb3BNZXRhZGF0YSkge1xuICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgcHJvcE1ldGFkYXRhID0ge307XG4gICAgICBjb25zdCBwYXJlbnRUeXBlID0gdGhpcy5maW5kUGFyZW50VHlwZSh0eXBlLCBjbGFzc01ldGFkYXRhKTtcbiAgICAgIGlmIChwYXJlbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudFByb3BNZXRhZGF0YSA9IHRoaXMucHJvcE1ldGFkYXRhKHBhcmVudFR5cGUpO1xuICAgICAgICBPYmplY3Qua2V5cyhwYXJlbnRQcm9wTWV0YWRhdGEpLmZvckVhY2goKHBhcmVudFByb3ApID0+IHtcbiAgICAgICAgICBwcm9wTWV0YWRhdGEgIVtwYXJlbnRQcm9wXSA9IHBhcmVudFByb3BNZXRhZGF0YVtwYXJlbnRQcm9wXTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1lbWJlcnMgPSBjbGFzc01ldGFkYXRhWydtZW1iZXJzJ10gfHwge307XG4gICAgICBPYmplY3Qua2V5cyhtZW1iZXJzKS5mb3JFYWNoKChwcm9wTmFtZSkgPT4ge1xuICAgICAgICBjb25zdCBwcm9wRGF0YSA9IG1lbWJlcnNbcHJvcE5hbWVdO1xuICAgICAgICBjb25zdCBwcm9wID0gKDxhbnlbXT5wcm9wRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAuZmluZChhID0+IGFbJ19fc3ltYm9saWMnXSA9PSAncHJvcGVydHknIHx8IGFbJ19fc3ltYm9saWMnXSA9PSAnbWV0aG9kJyk7XG4gICAgICAgIGNvbnN0IGRlY29yYXRvcnM6IGFueVtdID0gW107XG4gICAgICAgIGlmIChwcm9wTWV0YWRhdGEgIVtwcm9wTmFtZV0pIHtcbiAgICAgICAgICBkZWNvcmF0b3JzLnB1c2goLi4ucHJvcE1ldGFkYXRhICFbcHJvcE5hbWVdKTtcbiAgICAgICAgfVxuICAgICAgICBwcm9wTWV0YWRhdGEgIVtwcm9wTmFtZV0gPSBkZWNvcmF0b3JzO1xuICAgICAgICBpZiAocHJvcCAmJiBwcm9wWydkZWNvcmF0b3JzJ10pIHtcbiAgICAgICAgICBkZWNvcmF0b3JzLnB1c2goLi4udGhpcy5zaW1wbGlmeSh0eXBlLCBwcm9wWydkZWNvcmF0b3JzJ10pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLnByb3BlcnR5Q2FjaGUuc2V0KHR5cGUsIHByb3BNZXRhZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBwcm9wTWV0YWRhdGE7XG4gIH1cblxuICBwdWJsaWMgcGFyYW1ldGVycyh0eXBlOiBTdGF0aWNTeW1ib2wpOiBhbnlbXSB7XG4gICAgaWYgKCEodHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKGBwYXJhbWV0ZXJzIHJlY2VpdmVkICR7SlNPTi5zdHJpbmdpZnkodHlwZSl9IHdoaWNoIGlzIG5vdCBhIFN0YXRpY1N5bWJvbGApLFxuICAgICAgICAgIHR5cGUpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgbGV0IHBhcmFtZXRlcnMgPSB0aGlzLnBhcmFtZXRlckNhY2hlLmdldCh0eXBlKTtcbiAgICAgIGlmICghcGFyYW1ldGVycykge1xuICAgICAgICBjb25zdCBjbGFzc01ldGFkYXRhID0gdGhpcy5nZXRUeXBlTWV0YWRhdGEodHlwZSk7XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0aGlzLmZpbmRQYXJlbnRUeXBlKHR5cGUsIGNsYXNzTWV0YWRhdGEpO1xuICAgICAgICBjb25zdCBtZW1iZXJzID0gY2xhc3NNZXRhZGF0YSA/IGNsYXNzTWV0YWRhdGFbJ21lbWJlcnMnXSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGN0b3JEYXRhID0gbWVtYmVycyA/IG1lbWJlcnNbJ19fY3Rvcl9fJ10gOiBudWxsO1xuICAgICAgICBpZiAoY3RvckRhdGEpIHtcbiAgICAgICAgICBjb25zdCBjdG9yID0gKDxhbnlbXT5jdG9yRGF0YSkuZmluZChhID0+IGFbJ19fc3ltYm9saWMnXSA9PSAnY29uc3RydWN0b3InKTtcbiAgICAgICAgICBjb25zdCByYXdQYXJhbWV0ZXJUeXBlcyA9IDxhbnlbXT5jdG9yWydwYXJhbWV0ZXJzJ10gfHwgW107XG4gICAgICAgICAgY29uc3QgcGFyYW1ldGVyRGVjb3JhdG9ycyA9IDxhbnlbXT50aGlzLnNpbXBsaWZ5KHR5cGUsIGN0b3JbJ3BhcmFtZXRlckRlY29yYXRvcnMnXSB8fCBbXSk7XG4gICAgICAgICAgcGFyYW1ldGVycyA9IFtdO1xuICAgICAgICAgIHJhd1BhcmFtZXRlclR5cGVzLmZvckVhY2goKHJhd1BhcmFtVHlwZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5lc3RlZFJlc3VsdDogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtVHlwZSA9IHRoaXMudHJ5U2ltcGxpZnkodHlwZSwgcmF3UGFyYW1UeXBlKTtcbiAgICAgICAgICAgIGlmIChwYXJhbVR5cGUpIG5lc3RlZFJlc3VsdC5wdXNoKHBhcmFtVHlwZSk7XG4gICAgICAgICAgICBjb25zdCBkZWNvcmF0b3JzID0gcGFyYW1ldGVyRGVjb3JhdG9ycyA/IHBhcmFtZXRlckRlY29yYXRvcnNbaW5kZXhdIDogbnVsbDtcbiAgICAgICAgICAgIGlmIChkZWNvcmF0b3JzKSB7XG4gICAgICAgICAgICAgIG5lc3RlZFJlc3VsdC5wdXNoKC4uLmRlY29yYXRvcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGFyYW1ldGVycyAhLnB1c2gobmVzdGVkUmVzdWx0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChwYXJlbnRUeXBlKSB7XG4gICAgICAgICAgcGFyYW1ldGVycyA9IHRoaXMucGFyYW1ldGVycyhwYXJlbnRUeXBlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXBhcmFtZXRlcnMpIHtcbiAgICAgICAgICBwYXJhbWV0ZXJzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wYXJhbWV0ZXJDYWNoZS5zZXQodHlwZSwgcGFyYW1ldGVycyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyYW1ldGVycztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgb24gdHlwZSAke0pTT04uc3RyaW5naWZ5KHR5cGUpfSB3aXRoIGVycm9yICR7ZX1gKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfbWV0aG9kTmFtZXModHlwZTogYW55KToge1trZXk6IHN0cmluZ106IGJvb2xlYW59IHtcbiAgICBsZXQgbWV0aG9kTmFtZXMgPSB0aGlzLm1ldGhvZENhY2hlLmdldCh0eXBlKTtcbiAgICBpZiAoIW1ldGhvZE5hbWVzKSB7XG4gICAgICBjb25zdCBjbGFzc01ldGFkYXRhID0gdGhpcy5nZXRUeXBlTWV0YWRhdGEodHlwZSk7XG4gICAgICBtZXRob2ROYW1lcyA9IHt9O1xuICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHRoaXMuZmluZFBhcmVudFR5cGUodHlwZSwgY2xhc3NNZXRhZGF0YSk7XG4gICAgICBpZiAocGFyZW50VHlwZSkge1xuICAgICAgICBjb25zdCBwYXJlbnRNZXRob2ROYW1lcyA9IHRoaXMuX21ldGhvZE5hbWVzKHBhcmVudFR5cGUpO1xuICAgICAgICBPYmplY3Qua2V5cyhwYXJlbnRNZXRob2ROYW1lcykuZm9yRWFjaCgocGFyZW50UHJvcCkgPT4ge1xuICAgICAgICAgIG1ldGhvZE5hbWVzICFbcGFyZW50UHJvcF0gPSBwYXJlbnRNZXRob2ROYW1lc1twYXJlbnRQcm9wXTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1lbWJlcnMgPSBjbGFzc01ldGFkYXRhWydtZW1iZXJzJ10gfHwge307XG4gICAgICBPYmplY3Qua2V5cyhtZW1iZXJzKS5mb3JFYWNoKChwcm9wTmFtZSkgPT4ge1xuICAgICAgICBjb25zdCBwcm9wRGF0YSA9IG1lbWJlcnNbcHJvcE5hbWVdO1xuICAgICAgICBjb25zdCBpc01ldGhvZCA9ICg8YW55W10+cHJvcERhdGEpLnNvbWUoYSA9PiBhWydfX3N5bWJvbGljJ10gPT0gJ21ldGhvZCcpO1xuICAgICAgICBtZXRob2ROYW1lcyAhW3Byb3BOYW1lXSA9IG1ldGhvZE5hbWVzICFbcHJvcE5hbWVdIHx8IGlzTWV0aG9kO1xuICAgICAgfSk7XG4gICAgICB0aGlzLm1ldGhvZENhY2hlLnNldCh0eXBlLCBtZXRob2ROYW1lcyk7XG4gICAgfVxuICAgIHJldHVybiBtZXRob2ROYW1lcztcbiAgfVxuXG4gIHByaXZhdGUgX3N0YXRpY01lbWJlcnModHlwZTogU3RhdGljU3ltYm9sKTogc3RyaW5nW10ge1xuICAgIGxldCBzdGF0aWNNZW1iZXJzID0gdGhpcy5zdGF0aWNDYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFzdGF0aWNNZW1iZXJzKSB7XG4gICAgICBjb25zdCBjbGFzc01ldGFkYXRhID0gdGhpcy5nZXRUeXBlTWV0YWRhdGEodHlwZSk7XG4gICAgICBjb25zdCBzdGF0aWNNZW1iZXJEYXRhID0gY2xhc3NNZXRhZGF0YVsnc3RhdGljcyddIHx8IHt9O1xuICAgICAgc3RhdGljTWVtYmVycyA9IE9iamVjdC5rZXlzKHN0YXRpY01lbWJlckRhdGEpO1xuICAgICAgdGhpcy5zdGF0aWNDYWNoZS5zZXQodHlwZSwgc3RhdGljTWVtYmVycyk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0aWNNZW1iZXJzO1xuICB9XG5cblxuICBwcml2YXRlIGZpbmRQYXJlbnRUeXBlKHR5cGU6IFN0YXRpY1N5bWJvbCwgY2xhc3NNZXRhZGF0YTogYW55KTogU3RhdGljU3ltYm9sfHVuZGVmaW5lZCB7XG4gICAgY29uc3QgcGFyZW50VHlwZSA9IHRoaXMudHJ5U2ltcGxpZnkodHlwZSwgY2xhc3NNZXRhZGF0YVsnZXh0ZW5kcyddKTtcbiAgICBpZiAocGFyZW50VHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgcmV0dXJuIHBhcmVudFR5cGU7XG4gICAgfVxuICB9XG5cbiAgaGFzTGlmZWN5Y2xlSG9vayh0eXBlOiBhbnksIGxjUHJvcGVydHk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICghKHR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYGhhc0xpZmVjeWNsZUhvb2sgcmVjZWl2ZWQgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0gd2hpY2ggaXMgbm90IGEgU3RhdGljU3ltYm9sYCksXG4gICAgICAgICAgdHlwZSk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gISF0aGlzLl9tZXRob2ROYW1lcyh0eXBlKVtsY1Byb3BlcnR5XTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgb24gdHlwZSAke0pTT04uc3RyaW5naWZ5KHR5cGUpfSB3aXRoIGVycm9yICR7ZX1gKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgZ3VhcmRzKHR5cGU6IGFueSk6IHtba2V5OiBzdHJpbmddOiBTdGF0aWNTeW1ib2x9IHtcbiAgICBpZiAoISh0eXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihcbiAgICAgICAgICBuZXcgRXJyb3IoYGd1YXJkcyByZWNlaXZlZCAke0pTT04uc3RyaW5naWZ5KHR5cGUpfSB3aGljaCBpcyBub3QgYSBTdGF0aWNTeW1ib2xgKSwgdHlwZSk7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuICAgIGNvbnN0IHN0YXRpY01lbWJlcnMgPSB0aGlzLl9zdGF0aWNNZW1iZXJzKHR5cGUpO1xuICAgIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IFN0YXRpY1N5bWJvbH0gPSB7fTtcbiAgICBmb3IgKGxldCBuYW1lIG9mIHN0YXRpY01lbWJlcnMpIHtcbiAgICAgIGlmIChuYW1lLmVuZHNXaXRoKFRZUEVHVUFSRF9QT1NURklYKSkge1xuICAgICAgICBsZXQgcHJvcGVydHkgPSBuYW1lLnN1YnN0cigwLCBuYW1lLmxlbmd0aCAtIFRZUEVHVUFSRF9QT1NURklYLmxlbmd0aCk7XG4gICAgICAgIGxldCB2YWx1ZTogYW55O1xuICAgICAgICBpZiAocHJvcGVydHkuZW5kc1dpdGgoVVNFX0lGKSkge1xuICAgICAgICAgIHByb3BlcnR5ID0gbmFtZS5zdWJzdHIoMCwgcHJvcGVydHkubGVuZ3RoIC0gVVNFX0lGLmxlbmd0aCk7XG4gICAgICAgICAgdmFsdWUgPSBVU0VfSUY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSB0aGlzLmdldFN0YXRpY1N5bWJvbCh0eXBlLmZpbGVQYXRoLCB0eXBlLm5hbWUsIFtuYW1lXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHR5cGU6IFN0YXRpY1N5bWJvbCwgY3RvcjogYW55KTogdm9pZCB7XG4gICAgdGhpcy5jb252ZXJzaW9uTWFwLnNldCh0eXBlLCAoY29udGV4dDogU3RhdGljU3ltYm9sLCBhcmdzOiBhbnlbXSkgPT4gbmV3IGN0b3IoLi4uYXJncykpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVnaXN0ZXJGdW5jdGlvbih0eXBlOiBTdGF0aWNTeW1ib2wsIGZuOiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnZlcnNpb25NYXAuc2V0KHR5cGUsIChjb250ZXh0OiBTdGF0aWNTeW1ib2wsIGFyZ3M6IGFueVtdKSA9PiBmbi5hcHBseSh1bmRlZmluZWQsIGFyZ3MpKTtcbiAgfVxuXG4gIHByaXZhdGUgaW5pdGlhbGl6ZUNvbnZlcnNpb25NYXAoKTogdm9pZCB7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdJbmplY3RhYmxlJyksIGNyZWF0ZUluamVjdGFibGUpO1xuICAgIHRoaXMuaW5qZWN0aW9uVG9rZW4gPSB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdJbmplY3Rpb25Ub2tlbicpO1xuICAgIHRoaXMub3BhcXVlVG9rZW4gPSB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdPcGFxdWVUb2tlbicpO1xuICAgIHRoaXMuUk9VVEVTID0gdGhpcy50cnlGaW5kRGVjbGFyYXRpb24oQU5HVUxBUl9ST1VURVIsICdST1VURVMnKTtcbiAgICB0aGlzLkFOQUxZWkVfRk9SX0VOVFJZX0NPTVBPTkVOVFMgPVxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdBTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTJyk7XG5cbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSG9zdCcpLCBjcmVhdGVIb3N0KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnU2VsZicpLCBjcmVhdGVTZWxmKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1NraXBTZWxmJyksIGNyZWF0ZVNraXBTZWxmKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0luamVjdCcpLCBjcmVhdGVJbmplY3QpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnT3B0aW9uYWwnKSwgY3JlYXRlT3B0aW9uYWwpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnQXR0cmlidXRlJyksIGNyZWF0ZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdDb250ZW50Q2hpbGQnKSwgY3JlYXRlQ29udGVudENoaWxkKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0NvbnRlbnRDaGlsZHJlbicpLCBjcmVhdGVDb250ZW50Q2hpbGRyZW4pO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnVmlld0NoaWxkJyksIGNyZWF0ZVZpZXdDaGlsZCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdWaWV3Q2hpbGRyZW4nKSwgY3JlYXRlVmlld0NoaWxkcmVuKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSW5wdXQnKSwgY3JlYXRlSW5wdXQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnT3V0cHV0JyksIGNyZWF0ZU91dHB1dCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1BpcGUnKSwgY3JlYXRlUGlwZSk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdIb3N0QmluZGluZycpLCBjcmVhdGVIb3N0QmluZGluZyk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdIb3N0TGlzdGVuZXInKSwgY3JlYXRlSG9zdExpc3RlbmVyKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0RpcmVjdGl2ZScpLCBjcmVhdGVEaXJlY3RpdmUpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnQ29tcG9uZW50JyksIGNyZWF0ZUNvbXBvbmVudCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdOZ01vZHVsZScpLCBjcmVhdGVOZ01vZHVsZSk7XG5cbiAgICAvLyBOb3RlOiBTb21lIG1ldGFkYXRhIGNsYXNzZXMgY2FuIGJlIHVzZWQgZGlyZWN0bHkgd2l0aCBQcm92aWRlci5kZXBzLlxuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdIb3N0JyksIGNyZWF0ZUhvc3QpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdTZWxmJyksIGNyZWF0ZVNlbGYpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnU2tpcFNlbGYnKSwgY3JlYXRlU2tpcFNlbGYpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnT3B0aW9uYWwnKSwgY3JlYXRlT3B0aW9uYWwpO1xuICB9XG5cbiAgLyoqXG4gICAqIGdldFN0YXRpY1N5bWJvbCBwcm9kdWNlcyBhIFR5cGUgd2hvc2UgbWV0YWRhdGEgaXMga25vd24gYnV0IHdob3NlIGltcGxlbWVudGF0aW9uIGlzIG5vdCBsb2FkZWQuXG4gICAqIEFsbCB0eXBlcyBwYXNzZWQgdG8gdGhlIFN0YXRpY1Jlc29sdmVyIHNob3VsZCBiZSBwc2V1ZG8tdHlwZXMgcmV0dXJuZWQgYnkgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSBkZWNsYXJhdGlvbkZpbGUgdGhlIGFic29sdXRlIHBhdGggb2YgdGhlIGZpbGUgd2hlcmUgdGhlIHN5bWJvbCBpcyBkZWNsYXJlZFxuICAgKiBAcGFyYW0gbmFtZSB0aGUgbmFtZSBvZiB0aGUgdHlwZS5cbiAgICovXG4gIGdldFN0YXRpY1N5bWJvbChkZWNsYXJhdGlvbkZpbGU6IHN0cmluZywgbmFtZTogc3RyaW5nLCBtZW1iZXJzPzogc3RyaW5nW10pOiBTdGF0aWNTeW1ib2wge1xuICAgIHJldHVybiB0aGlzLnN5bWJvbFJlc29sdmVyLmdldFN0YXRpY1N5bWJvbChkZWNsYXJhdGlvbkZpbGUsIG5hbWUsIG1lbWJlcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNpbXBsaWZ5IGJ1dCBkaXNjYXJkIGFueSBlcnJvcnNcbiAgICovXG4gIHByaXZhdGUgdHJ5U2ltcGxpZnkoY29udGV4dDogU3RhdGljU3ltYm9sLCB2YWx1ZTogYW55KTogYW55IHtcbiAgICBjb25zdCBvcmlnaW5hbFJlY29yZGVyID0gdGhpcy5lcnJvclJlY29yZGVyO1xuICAgIHRoaXMuZXJyb3JSZWNvcmRlciA9IChlcnJvcjogYW55LCBmaWxlTmFtZT86IHN0cmluZykgPT4ge307XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5zaW1wbGlmeShjb250ZXh0LCB2YWx1ZSk7XG4gICAgdGhpcy5lcnJvclJlY29yZGVyID0gb3JpZ2luYWxSZWNvcmRlcjtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwdWJsaWMgc2ltcGxpZnkoY29udGV4dDogU3RhdGljU3ltYm9sLCB2YWx1ZTogYW55LCBsYXp5OiBib29sZWFuID0gZmFsc2UpOiBhbnkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGxldCBzY29wZSA9IEJpbmRpbmdTY29wZS5lbXB0eTtcbiAgICBjb25zdCBjYWxsaW5nID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIGJvb2xlYW4+KCk7XG4gICAgY29uc3Qgcm9vdENvbnRleHQgPSBjb250ZXh0O1xuXG4gICAgZnVuY3Rpb24gc2ltcGxpZnlJbkNvbnRleHQoXG4gICAgICAgIGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgdmFsdWU6IGFueSwgZGVwdGg6IG51bWJlciwgcmVmZXJlbmNlczogbnVtYmVyKTogYW55IHtcbiAgICAgIGZ1bmN0aW9uIHJlc29sdmVSZWZlcmVuY2VWYWx1ZShzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbCk6IGFueSB7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkU3ltYm9sID0gc2VsZi5zeW1ib2xSZXNvbHZlci5yZXNvbHZlU3ltYm9sKHN0YXRpY1N5bWJvbCk7XG4gICAgICAgIHJldHVybiByZXNvbHZlZFN5bWJvbCA/IHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhIDogbnVsbDtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc2ltcGxpZnlFYWdlcmx5KHZhbHVlOiBhbnkpOiBhbnkge1xuICAgICAgICByZXR1cm4gc2ltcGxpZnlJbkNvbnRleHQoY29udGV4dCwgdmFsdWUsIGRlcHRoLCAwKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc2ltcGxpZnlMYXppbHkodmFsdWU6IGFueSk6IGFueSB7XG4gICAgICAgIHJldHVybiBzaW1wbGlmeUluQ29udGV4dChjb250ZXh0LCB2YWx1ZSwgZGVwdGgsIHJlZmVyZW5jZXMgKyAxKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc2ltcGxpZnlOZXN0ZWQobmVzdGVkQ29udGV4dDogU3RhdGljU3ltYm9sLCB2YWx1ZTogYW55KTogYW55IHtcbiAgICAgICAgaWYgKG5lc3RlZENvbnRleHQgPT09IGNvbnRleHQpIHtcbiAgICAgICAgICAvLyBJZiB0aGUgY29udGV4dCBoYXNuJ3QgY2hhbmdlZCBsZXQgdGhlIGV4Y2VwdGlvbiBwcm9wYWdhdGUgdW5tb2RpZmllZC5cbiAgICAgICAgICByZXR1cm4gc2ltcGxpZnlJbkNvbnRleHQobmVzdGVkQ29udGV4dCwgdmFsdWUsIGRlcHRoICsgMSwgcmVmZXJlbmNlcyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gc2ltcGxpZnlJbkNvbnRleHQobmVzdGVkQ29udGV4dCwgdmFsdWUsIGRlcHRoICsgMSwgcmVmZXJlbmNlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBpZiAoaXNNZXRhZGF0YUVycm9yKGUpKSB7XG4gICAgICAgICAgICAvLyBQcm9wYWdhdGUgdGhlIG1lc3NhZ2UgdGV4dCB1cCBidXQgYWRkIGEgbWVzc2FnZSB0byB0aGUgY2hhaW4gdGhhdCBleHBsYWlucyBob3cgd2UgZ290XG4gICAgICAgICAgICAvLyBoZXJlLlxuICAgICAgICAgICAgLy8gZS5jaGFpbiBpbXBsaWVzIGUuc3ltYm9sXG4gICAgICAgICAgICBjb25zdCBzdW1tYXJ5TXNnID0gZS5jaGFpbiA/ICdyZWZlcmVuY2VzIFxcJycgKyBlLnN5bWJvbCAhLm5hbWUgKyAnXFwnJyA6IGVycm9yU3VtbWFyeShlKTtcbiAgICAgICAgICAgIGNvbnN0IHN1bW1hcnkgPSBgJyR7bmVzdGVkQ29udGV4dC5uYW1lfScgJHtzdW1tYXJ5TXNnfWA7XG4gICAgICAgICAgICBjb25zdCBjaGFpbiA9IHttZXNzYWdlOiBzdW1tYXJ5LCBwb3NpdGlvbjogZS5wb3NpdGlvbiwgbmV4dDogZS5jaGFpbn07XG4gICAgICAgICAgICAvLyBUT0RPKGNodWNraik6IHJldHJpZXZlIHRoZSBwb3NpdGlvbiBpbmZvcm1hdGlvbiBpbmRpcmVjdGx5IGZyb20gdGhlIGNvbGxlY3RvcnMgbm9kZVxuICAgICAgICAgICAgLy8gbWFwIGlmIHRoZSBtZXRhZGF0YSBpcyBmcm9tIGEgLnRzIGZpbGUuXG4gICAgICAgICAgICBzZWxmLmVycm9yKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGUubWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgIGFkdmlzZTogZS5hZHZpc2UsXG4gICAgICAgICAgICAgICAgICBjb250ZXh0OiBlLmNvbnRleHQsIGNoYWluLFxuICAgICAgICAgICAgICAgICAgc3ltYm9sOiBuZXN0ZWRDb250ZXh0XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBjb250ZXh0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSXQgaXMgcHJvYmFibHkgYW4gaW50ZXJuYWwgZXJyb3IuXG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBzaW1wbGlmeUNhbGwoXG4gICAgICAgICAgZnVuY3Rpb25TeW1ib2w6IFN0YXRpY1N5bWJvbCwgdGFyZ2V0RnVuY3Rpb246IGFueSwgYXJnczogYW55W10sIHRhcmdldEV4cHJlc3Npb246IGFueSkge1xuICAgICAgICBpZiAodGFyZ2V0RnVuY3Rpb24gJiYgdGFyZ2V0RnVuY3Rpb25bJ19fc3ltYm9saWMnXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgaWYgKGNhbGxpbmcuZ2V0KGZ1bmN0aW9uU3ltYm9sKSkge1xuICAgICAgICAgICAgc2VsZi5lcnJvcihcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUmVjdXJzaW9uIGlzIG5vdCBzdXBwb3J0ZWQnLFxuICAgICAgICAgICAgICAgICAgc3VtbWFyeTogYGNhbGxlZCAnJHtmdW5jdGlvblN5bWJvbC5uYW1lfScgcmVjdXJzaXZlbHlgLFxuICAgICAgICAgICAgICAgICAgdmFsdWU6IHRhcmdldEZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvblN5bWJvbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHRhcmdldEZ1bmN0aW9uWyd2YWx1ZSddO1xuICAgICAgICAgICAgaWYgKHZhbHVlICYmIChkZXB0aCAhPSAwIHx8IHZhbHVlLl9fc3ltYm9saWMgIT0gJ2Vycm9yJykpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyczogc3RyaW5nW10gPSB0YXJnZXRGdW5jdGlvblsncGFyYW1ldGVycyddO1xuICAgICAgICAgICAgICBjb25zdCBkZWZhdWx0czogYW55W10gPSB0YXJnZXRGdW5jdGlvbi5kZWZhdWx0cztcbiAgICAgICAgICAgICAgYXJncyA9IGFyZ3MubWFwKGFyZyA9PiBzaW1wbGlmeU5lc3RlZChjb250ZXh0LCBhcmcpKVxuICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoYXJnID0+IHNob3VsZElnbm9yZShhcmcpID8gdW5kZWZpbmVkIDogYXJnKTtcbiAgICAgICAgICAgICAgaWYgKGRlZmF1bHRzICYmIGRlZmF1bHRzLmxlbmd0aCA+IGFyZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYXJncy5wdXNoKC4uLmRlZmF1bHRzLnNsaWNlKGFyZ3MubGVuZ3RoKS5tYXAoKHZhbHVlOiBhbnkpID0+IHNpbXBsaWZ5KHZhbHVlKSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNhbGxpbmcuc2V0KGZ1bmN0aW9uU3ltYm9sLCB0cnVlKTtcbiAgICAgICAgICAgICAgY29uc3QgZnVuY3Rpb25TY29wZSA9IEJpbmRpbmdTY29wZS5idWlsZCgpO1xuICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcmFtZXRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBmdW5jdGlvblNjb3BlLmRlZmluZShwYXJhbWV0ZXJzW2ldLCBhcmdzW2ldKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zdCBvbGRTY29wZSA9IHNjb3BlO1xuICAgICAgICAgICAgICBsZXQgcmVzdWx0OiBhbnk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgc2NvcGUgPSBmdW5jdGlvblNjb3BlLmRvbmUoKTtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBzaW1wbGlmeU5lc3RlZChmdW5jdGlvblN5bWJvbCwgdmFsdWUpO1xuICAgICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICAgIHNjb3BlID0gb2xkU2NvcGU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgY2FsbGluZy5kZWxldGUoZnVuY3Rpb25TeW1ib2wpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXB0aCA9PT0gMCkge1xuICAgICAgICAgIC8vIElmIGRlcHRoIGlzIDAgd2UgYXJlIGV2YWx1YXRpbmcgdGhlIHRvcCBsZXZlbCBleHByZXNzaW9uIHRoYXQgaXMgZGVzY3JpYmluZyBlbGVtZW50XG4gICAgICAgICAgLy8gZGVjb3JhdG9yLiBJbiB0aGlzIGNhc2UsIGl0IGlzIGEgZGVjb3JhdG9yIHdlIGRvbid0IHVuZGVyc3RhbmQsIHN1Y2ggYXMgYSBjdXN0b21cbiAgICAgICAgICAvLyBub24tYW5ndWxhciBkZWNvcmF0b3IsIGFuZCB3ZSBzaG91bGQganVzdCBpZ25vcmUgaXQuXG4gICAgICAgICAgcmV0dXJuIElHTk9SRTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcG9zaXRpb246IFBvc2l0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKHRhcmdldEV4cHJlc3Npb24gJiYgdGFyZ2V0RXhwcmVzc2lvbi5fX3N5bWJvbGljID09ICdyZXNvbHZlZCcpIHtcbiAgICAgICAgICBjb25zdCBsaW5lID0gdGFyZ2V0RXhwcmVzc2lvbi5saW5lO1xuICAgICAgICAgIGNvbnN0IGNoYXJhY3RlciA9IHRhcmdldEV4cHJlc3Npb24uY2hhcmFjdGVyO1xuICAgICAgICAgIGNvbnN0IGZpbGVOYW1lID0gdGFyZ2V0RXhwcmVzc2lvbi5maWxlTmFtZTtcbiAgICAgICAgICBpZiAoZmlsZU5hbWUgIT0gbnVsbCAmJiBsaW5lICE9IG51bGwgJiYgY2hhcmFjdGVyICE9IG51bGwpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uID0ge2ZpbGVOYW1lLCBsaW5lLCBjb2x1bW46IGNoYXJhY3Rlcn07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNlbGYuZXJyb3IoXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIG1lc3NhZ2U6IEZVTkNUSU9OX0NBTExfTk9UX1NVUFBPUlRFRCxcbiAgICAgICAgICAgICAgY29udGV4dDogZnVuY3Rpb25TeW1ib2wsXG4gICAgICAgICAgICAgIHZhbHVlOiB0YXJnZXRGdW5jdGlvbiwgcG9zaXRpb25cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb250ZXh0KTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc2ltcGxpZnkoZXhwcmVzc2lvbjogYW55KTogYW55IHtcbiAgICAgICAgaWYgKGlzUHJpbWl0aXZlKGV4cHJlc3Npb24pKSB7XG4gICAgICAgICAgcmV0dXJuIGV4cHJlc3Npb247XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4cHJlc3Npb24gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55W10gPSBbXTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgKDxhbnk+ZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBhIHNwcmVhZCBleHByZXNzaW9uXG4gICAgICAgICAgICBpZiAoaXRlbSAmJiBpdGVtLl9fc3ltYm9saWMgPT09ICdzcHJlYWQnKSB7XG4gICAgICAgICAgICAgIC8vIFdlIGNhbGwgd2l0aCByZWZlcmVuY2VzIGFzIDAgYmVjYXVzZSB3ZSByZXF1aXJlIHRoZSBhY3R1YWwgdmFsdWUgYW5kIGNhbm5vdFxuICAgICAgICAgICAgICAvLyB0b2xlcmF0ZSBhIHJlZmVyZW5jZSBoZXJlLlxuICAgICAgICAgICAgICBjb25zdCBzcHJlYWRBcnJheSA9IHNpbXBsaWZ5RWFnZXJseShpdGVtLmV4cHJlc3Npb24pO1xuICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShzcHJlYWRBcnJheSkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHNwcmVhZEl0ZW0gb2Ygc3ByZWFkQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHNwcmVhZEl0ZW0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBzaW1wbGlmeShpdGVtKTtcbiAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUodmFsdWUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChleHByZXNzaW9uIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICAgICAgLy8gU3RvcCBzaW1wbGlmaWNhdGlvbiBhdCBidWlsdGluIHN5bWJvbHMgb3IgaWYgd2UgYXJlIGluIGEgcmVmZXJlbmNlIGNvbnRleHQgYW5kXG4gICAgICAgICAgLy8gdGhlIHN5bWJvbCBkb2Vzbid0IGhhdmUgbWVtYmVycy5cbiAgICAgICAgICBpZiAoZXhwcmVzc2lvbiA9PT0gc2VsZi5pbmplY3Rpb25Ub2tlbiB8fCBzZWxmLmNvbnZlcnNpb25NYXAuaGFzKGV4cHJlc3Npb24pIHx8XG4gICAgICAgICAgICAgIChyZWZlcmVuY2VzID4gMCAmJiAhZXhwcmVzc2lvbi5tZW1iZXJzLmxlbmd0aCkpIHtcbiAgICAgICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0aWNTeW1ib2wgPSBleHByZXNzaW9uO1xuICAgICAgICAgICAgY29uc3QgZGVjbGFyYXRpb25WYWx1ZSA9IHJlc29sdmVSZWZlcmVuY2VWYWx1ZShzdGF0aWNTeW1ib2wpO1xuICAgICAgICAgICAgaWYgKGRlY2xhcmF0aW9uVmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnlOZXN0ZWQoc3RhdGljU3ltYm9sLCBkZWNsYXJhdGlvblZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBzdGF0aWNTeW1ib2w7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChleHByZXNzaW9uKSB7XG4gICAgICAgICAgaWYgKGV4cHJlc3Npb25bJ19fc3ltYm9saWMnXSkge1xuICAgICAgICAgICAgbGV0IHN0YXRpY1N5bWJvbDogU3RhdGljU3ltYm9sO1xuICAgICAgICAgICAgc3dpdGNoIChleHByZXNzaW9uWydfX3N5bWJvbGljJ10pIHtcbiAgICAgICAgICAgICAgY2FzZSAnYmlub3AnOlxuICAgICAgICAgICAgICAgIGxldCBsZWZ0ID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnbGVmdCddKTtcbiAgICAgICAgICAgICAgICBpZiAoc2hvdWxkSWdub3JlKGxlZnQpKSByZXR1cm4gbGVmdDtcbiAgICAgICAgICAgICAgICBsZXQgcmlnaHQgPSBzaW1wbGlmeShleHByZXNzaW9uWydyaWdodCddKTtcbiAgICAgICAgICAgICAgICBpZiAoc2hvdWxkSWdub3JlKHJpZ2h0KSkgcmV0dXJuIHJpZ2h0O1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoZXhwcmVzc2lvblsnb3BlcmF0b3InXSkge1xuICAgICAgICAgICAgICAgICAgY2FzZSAnJiYnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAmJiByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ3x8JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgfHwgcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICd8JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgfCByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ14nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCBeIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnJic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICYgcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc9PSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ID09IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnIT0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAhPSByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJz09PSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ID09PSByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyE9PSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICE9PSByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJzwnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA8IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ID4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc8PSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IDw9IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPj0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA+PSByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJzw8JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPDwgcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc+Pic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ID4+IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICsgcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgLSByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyonOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAqIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IC8gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICclJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgJSByaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIGNhc2UgJ2lmJzpcbiAgICAgICAgICAgICAgICBsZXQgY29uZGl0aW9uID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnY29uZGl0aW9uJ10pO1xuICAgICAgICAgICAgICAgIHJldHVybiBjb25kaXRpb24gPyBzaW1wbGlmeShleHByZXNzaW9uWyd0aGVuRXhwcmVzc2lvbiddKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpbXBsaWZ5KGV4cHJlc3Npb25bJ2Vsc2VFeHByZXNzaW9uJ10pO1xuICAgICAgICAgICAgICBjYXNlICdwcmUnOlxuICAgICAgICAgICAgICAgIGxldCBvcGVyYW5kID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnb3BlcmFuZCddKTtcbiAgICAgICAgICAgICAgICBpZiAoc2hvdWxkSWdub3JlKG9wZXJhbmQpKSByZXR1cm4gb3BlcmFuZDtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGV4cHJlc3Npb25bJ29wZXJhdG9yJ10pIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJysnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gLW9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICchJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICFvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgY2FzZSAnfic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB+b3BlcmFuZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIGNhc2UgJ2luZGV4JzpcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhUYXJnZXQgPSBzaW1wbGlmeUVhZ2VybHkoZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddKTtcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXggPSBzaW1wbGlmeUVhZ2VybHkoZXhwcmVzc2lvblsnaW5kZXgnXSk7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4VGFyZ2V0ICYmIGlzUHJpbWl0aXZlKGluZGV4KSkgcmV0dXJuIGluZGV4VGFyZ2V0W2luZGV4XTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgY2FzZSAnc2VsZWN0JzpcbiAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXIgPSBleHByZXNzaW9uWydtZW1iZXInXTtcbiAgICAgICAgICAgICAgICBsZXQgc2VsZWN0Q29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgICAgICAgICAgbGV0IHNlbGVjdFRhcmdldCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ2V4cHJlc3Npb24nXSk7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGVjdFRhcmdldCBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgbWVtYmVycyA9IHNlbGVjdFRhcmdldC5tZW1iZXJzLmNvbmNhdChtZW1iZXIpO1xuICAgICAgICAgICAgICAgICAgc2VsZWN0Q29udGV4dCA9XG4gICAgICAgICAgICAgICAgICAgICAgc2VsZi5nZXRTdGF0aWNTeW1ib2woc2VsZWN0VGFyZ2V0LmZpbGVQYXRoLCBzZWxlY3RUYXJnZXQubmFtZSwgbWVtYmVycyk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBkZWNsYXJhdGlvblZhbHVlID0gcmVzb2x2ZVJlZmVyZW5jZVZhbHVlKHNlbGVjdENvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgaWYgKGRlY2xhcmF0aW9uVmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnlOZXN0ZWQoc2VsZWN0Q29udGV4dCwgZGVjbGFyYXRpb25WYWx1ZSk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZWN0Q29udGV4dDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNlbGVjdFRhcmdldCAmJiBpc1ByaW1pdGl2ZShtZW1iZXIpKVxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5TmVzdGVkKHNlbGVjdENvbnRleHQsIHNlbGVjdFRhcmdldFttZW1iZXJdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgY2FzZSAncmVmZXJlbmNlJzpcbiAgICAgICAgICAgICAgICAvLyBOb3RlOiBUaGlzIG9ubHkgaGFzIHRvIGRlYWwgd2l0aCB2YXJpYWJsZSByZWZlcmVuY2VzLCBhcyBzeW1ib2wgcmVmZXJlbmNlcyBoYXZlXG4gICAgICAgICAgICAgICAgLy8gYmVlbiBjb252ZXJ0ZWQgaW50byAncmVzb2x2ZWQnXG4gICAgICAgICAgICAgICAgLy8gaW4gdGhlIFN0YXRpY1N5bWJvbFJlc29sdmVyLlxuICAgICAgICAgICAgICAgIGNvbnN0IG5hbWU6IHN0cmluZyA9IGV4cHJlc3Npb25bJ25hbWUnXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsb2NhbFZhbHVlID0gc2NvcGUucmVzb2x2ZShuYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAobG9jYWxWYWx1ZSAhPSBCaW5kaW5nU2NvcGUubWlzc2luZykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxvY2FsVmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlICdyZXNvbHZlZCc6XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeShleHByZXNzaW9uLnN5bWJvbCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgLy8gSWYgYW4gZXJyb3IgaXMgcmVwb3J0ZWQgZXZhbHVhdGluZyB0aGUgc3ltYm9sIHJlY29yZCB0aGUgcG9zaXRpb24gb2YgdGhlXG4gICAgICAgICAgICAgICAgICAvLyByZWZlcmVuY2UgaW4gdGhlIGVycm9yIHNvIGl0IGNhblxuICAgICAgICAgICAgICAgICAgLy8gYmUgcmVwb3J0ZWQgaW4gdGhlIGVycm9yIG1lc3NhZ2UgZ2VuZXJhdGVkIGZyb20gdGhlIGV4Y2VwdGlvbi5cbiAgICAgICAgICAgICAgICAgIGlmIChpc01ldGFkYXRhRXJyb3IoZSkgJiYgZXhwcmVzc2lvbi5maWxlTmFtZSAhPSBudWxsICYmXG4gICAgICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbi5saW5lICE9IG51bGwgJiYgZXhwcmVzc2lvbi5jaGFyYWN0ZXIgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBlLnBvc2l0aW9uID0ge1xuICAgICAgICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBleHByZXNzaW9uLmZpbGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgIGxpbmU6IGV4cHJlc3Npb24ubGluZSxcbiAgICAgICAgICAgICAgICAgICAgICBjb2x1bW46IGV4cHJlc3Npb24uY2hhcmFjdGVyXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY2FzZSAnY2xhc3MnOlxuICAgICAgICAgICAgICAgIHJldHVybiBjb250ZXh0O1xuICAgICAgICAgICAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgICAgICAgICAgIGNhc2UgJ25ldyc6XG4gICAgICAgICAgICAgIGNhc2UgJ2NhbGwnOlxuICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpZiB0aGUgZnVuY3Rpb24gaXMgYSBidWlsdC1pbiBjb252ZXJzaW9uXG4gICAgICAgICAgICAgICAgc3RhdGljU3ltYm9sID0gc2ltcGxpZnlJbkNvbnRleHQoXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQsIGV4cHJlc3Npb25bJ2V4cHJlc3Npb24nXSwgZGVwdGggKyAxLCAvKiByZWZlcmVuY2VzICovIDApO1xuICAgICAgICAgICAgICAgIGlmIChzdGF0aWNTeW1ib2wgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChzdGF0aWNTeW1ib2wgPT09IHNlbGYuaW5qZWN0aW9uVG9rZW4gfHwgc3RhdGljU3ltYm9sID09PSBzZWxmLm9wYXF1ZVRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHNvbWVib2R5IGNhbGxzIG5ldyBJbmplY3Rpb25Ub2tlbiwgZG9uJ3QgY3JlYXRlIGFuIEluamVjdGlvblRva2VuLFxuICAgICAgICAgICAgICAgICAgICAvLyBidXQgcmF0aGVyIHJldHVybiB0aGUgc3ltYm9sIHRvIHdoaWNoIHRoZSBJbmplY3Rpb25Ub2tlbiBpcyBhc3NpZ25lZCB0by5cblxuICAgICAgICAgICAgICAgICAgICAvLyBPcGFxdWVUb2tlbiBpcyBzdXBwb3J0ZWQgdG9vIGFzIGl0IGlzIHJlcXVpcmVkIGJ5IHRoZSBsYW5ndWFnZSBzZXJ2aWNlIHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIHN1cHBvcnQgdjQgYW5kIHByaW9yIHZlcnNpb25zIG9mIEFuZ3VsYXIuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb250ZXh0O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgY29uc3QgYXJnRXhwcmVzc2lvbnM6IGFueVtdID0gZXhwcmVzc2lvblsnYXJndW1lbnRzJ10gfHwgW107XG4gICAgICAgICAgICAgICAgICBsZXQgY29udmVydGVyID0gc2VsZi5jb252ZXJzaW9uTWFwLmdldChzdGF0aWNTeW1ib2wpO1xuICAgICAgICAgICAgICAgICAgaWYgKGNvbnZlcnRlcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhcmdzID0gYXJnRXhwcmVzc2lvbnMubWFwKGFyZyA9PiBzaW1wbGlmeU5lc3RlZChjb250ZXh0LCBhcmcpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoYXJnID0+IHNob3VsZElnbm9yZShhcmcpID8gdW5kZWZpbmVkIDogYXJnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnZlcnRlcihjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpZiB0aGUgZnVuY3Rpb24gaXMgb25lIHdlIGNhbiBzaW1wbGlmeS5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0RnVuY3Rpb24gPSByZXNvbHZlUmVmZXJlbmNlVmFsdWUoc3RhdGljU3ltYm9sKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5Q2FsbChcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRpY1N5bWJvbCwgdGFyZ2V0RnVuY3Rpb24sIGFyZ0V4cHJlc3Npb25zLCBleHByZXNzaW9uWydleHByZXNzaW9uJ10pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gSUdOT1JFO1xuICAgICAgICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgICAgICAgbGV0IG1lc3NhZ2UgPSBleHByZXNzaW9uLm1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGV4cHJlc3Npb25bJ2xpbmUnXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICBzZWxmLmVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0OiBleHByZXNzaW9uLmNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBleHByZXNzaW9uWydmaWxlTmFtZSddLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lOiBleHByZXNzaW9uWydsaW5lJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogZXhwcmVzc2lvblsnY2hhcmFjdGVyJ11cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzZWxmLmVycm9yKHttZXNzYWdlLCBjb250ZXh0OiBleHByZXNzaW9uLmNvbnRleHR9LCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIElHTk9SRTtcbiAgICAgICAgICAgICAgY2FzZSAnaWdub3JlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbWFwU3RyaW5nTWFwKGV4cHJlc3Npb24sICh2YWx1ZSwgbmFtZSkgPT4ge1xuICAgICAgICAgICAgaWYgKFJFRkVSRU5DRV9TRVQuaGFzKG5hbWUpKSB7XG4gICAgICAgICAgICAgIGlmIChuYW1lID09PSBVU0VfVkFMVUUgJiYgUFJPVklERSBpbiBleHByZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhpcyBpcyBhIHByb3ZpZGVyIGV4cHJlc3Npb24sIGNoZWNrIGZvciBzcGVjaWFsIHRva2VucyB0aGF0IG5lZWQgdGhlIHZhbHVlXG4gICAgICAgICAgICAgICAgLy8gZHVyaW5nIGFuYWx5c2lzLlxuICAgICAgICAgICAgICAgIGNvbnN0IHByb3ZpZGUgPSBzaW1wbGlmeShleHByZXNzaW9uLnByb3ZpZGUpO1xuICAgICAgICAgICAgICAgIGlmIChwcm92aWRlID09PSBzZWxmLlJPVVRFUyB8fCBwcm92aWRlID09IHNlbGYuQU5BTFlaRV9GT1JfRU5UUllfQ09NUE9ORU5UUykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5KHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5TGF6aWx5KHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeSh2YWx1ZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIElHTk9SRTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHNpbXBsaWZ5KHZhbHVlKTtcbiAgICB9XG5cbiAgICBsZXQgcmVzdWx0OiBhbnk7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IHNpbXBsaWZ5SW5Db250ZXh0KGNvbnRleHQsIHZhbHVlLCAwLCBsYXp5ID8gMSA6IDApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmICh0aGlzLmVycm9yUmVjb3JkZXIpIHtcbiAgICAgICAgdGhpcy5yZXBvcnRFcnJvcihlLCBjb250ZXh0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGZvcm1hdE1ldGFkYXRhRXJyb3IoZSwgY29udGV4dCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChzaG91bGRJZ25vcmUocmVzdWx0KSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VHlwZU1ldGFkYXRhKHR5cGU6IFN0YXRpY1N5bWJvbCk6IHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgICBjb25zdCByZXNvbHZlZFN5bWJvbCA9IHRoaXMuc3ltYm9sUmVzb2x2ZXIucmVzb2x2ZVN5bWJvbCh0eXBlKTtcbiAgICByZXR1cm4gcmVzb2x2ZWRTeW1ib2wgJiYgcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGEgPyByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge19fc3ltYm9saWM6ICdjbGFzcyd9O1xuICB9XG5cbiAgcHJpdmF0ZSByZXBvcnRFcnJvcihlcnJvcjogRXJyb3IsIGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgcGF0aD86IHN0cmluZykge1xuICAgIGlmICh0aGlzLmVycm9yUmVjb3JkZXIpIHtcbiAgICAgIHRoaXMuZXJyb3JSZWNvcmRlcihcbiAgICAgICAgICBmb3JtYXRNZXRhZGF0YUVycm9yKGVycm9yLCBjb250ZXh0KSwgKGNvbnRleHQgJiYgY29udGV4dC5maWxlUGF0aCkgfHwgcGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZXJyb3IoXG4gICAgICB7bWVzc2FnZSwgc3VtbWFyeSwgYWR2aXNlLCBwb3NpdGlvbiwgY29udGV4dCwgdmFsdWUsIHN5bWJvbCwgY2hhaW59OiB7XG4gICAgICAgIG1lc3NhZ2U6IHN0cmluZyxcbiAgICAgICAgc3VtbWFyeT86IHN0cmluZyxcbiAgICAgICAgYWR2aXNlPzogc3RyaW5nLFxuICAgICAgICBwb3NpdGlvbj86IFBvc2l0aW9uLFxuICAgICAgICBjb250ZXh0PzogYW55LFxuICAgICAgICB2YWx1ZT86IGFueSxcbiAgICAgICAgc3ltYm9sPzogU3RhdGljU3ltYm9sLFxuICAgICAgICBjaGFpbj86IE1ldGFkYXRhTWVzc2FnZUNoYWluXG4gICAgICB9LFxuICAgICAgcmVwb3J0aW5nQ29udGV4dDogU3RhdGljU3ltYm9sKSB7XG4gICAgdGhpcy5yZXBvcnRFcnJvcihcbiAgICAgICAgbWV0YWRhdGFFcnJvcihtZXNzYWdlLCBzdW1tYXJ5LCBhZHZpc2UsIHBvc2l0aW9uLCBzeW1ib2wsIGNvbnRleHQsIGNoYWluKSxcbiAgICAgICAgcmVwb3J0aW5nQ29udGV4dCk7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFBvc2l0aW9uIHtcbiAgZmlsZU5hbWU6IHN0cmluZztcbiAgbGluZTogbnVtYmVyO1xuICBjb2x1bW46IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIE1ldGFkYXRhTWVzc2FnZUNoYWluIHtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBzdW1tYXJ5Pzogc3RyaW5nO1xuICBwb3NpdGlvbj86IFBvc2l0aW9uO1xuICBjb250ZXh0PzogYW55O1xuICBzeW1ib2w/OiBTdGF0aWNTeW1ib2w7XG4gIG5leHQ/OiBNZXRhZGF0YU1lc3NhZ2VDaGFpbjtcbn1cblxudHlwZSBNZXRhZGF0YUVycm9yID0gRXJyb3IgJiB7XG4gIHBvc2l0aW9uPzogUG9zaXRpb247XG4gIGFkdmlzZT86IHN0cmluZztcbiAgc3VtbWFyeT86IHN0cmluZztcbiAgY29udGV4dD86IGFueTtcbiAgc3ltYm9sPzogU3RhdGljU3ltYm9sO1xuICBjaGFpbj86IE1ldGFkYXRhTWVzc2FnZUNoYWluO1xufTtcblxuY29uc3QgTUVUQURBVEFfRVJST1IgPSAnbmdNZXRhZGF0YUVycm9yJztcblxuZnVuY3Rpb24gbWV0YWRhdGFFcnJvcihcbiAgICBtZXNzYWdlOiBzdHJpbmcsIHN1bW1hcnk/OiBzdHJpbmcsIGFkdmlzZT86IHN0cmluZywgcG9zaXRpb24/OiBQb3NpdGlvbiwgc3ltYm9sPzogU3RhdGljU3ltYm9sLFxuICAgIGNvbnRleHQ/OiBhbnksIGNoYWluPzogTWV0YWRhdGFNZXNzYWdlQ2hhaW4pOiBNZXRhZGF0YUVycm9yIHtcbiAgY29uc3QgZXJyb3IgPSBzeW50YXhFcnJvcihtZXNzYWdlKSBhcyBNZXRhZGF0YUVycm9yO1xuICAoZXJyb3IgYXMgYW55KVtNRVRBREFUQV9FUlJPUl0gPSB0cnVlO1xuICBpZiAoYWR2aXNlKSBlcnJvci5hZHZpc2UgPSBhZHZpc2U7XG4gIGlmIChwb3NpdGlvbikgZXJyb3IucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgaWYgKHN1bW1hcnkpIGVycm9yLnN1bW1hcnkgPSBzdW1tYXJ5O1xuICBpZiAoY29udGV4dCkgZXJyb3IuY29udGV4dCA9IGNvbnRleHQ7XG4gIGlmIChjaGFpbikgZXJyb3IuY2hhaW4gPSBjaGFpbjtcbiAgaWYgKHN5bWJvbCkgZXJyb3Iuc3ltYm9sID0gc3ltYm9sO1xuICByZXR1cm4gZXJyb3I7XG59XG5cbmZ1bmN0aW9uIGlzTWV0YWRhdGFFcnJvcihlcnJvcjogRXJyb3IpOiBlcnJvciBpcyBNZXRhZGF0YUVycm9yIHtcbiAgcmV0dXJuICEhKGVycm9yIGFzIGFueSlbTUVUQURBVEFfRVJST1JdO1xufVxuXG5jb25zdCBSRUZFUkVOQ0VfVE9fTk9ORVhQT1JURURfQ0xBU1MgPSAnUmVmZXJlbmNlIHRvIG5vbi1leHBvcnRlZCBjbGFzcyc7XG5jb25zdCBWQVJJQUJMRV9OT1RfSU5JVElBTElaRUQgPSAnVmFyaWFibGUgbm90IGluaXRpYWxpemVkJztcbmNvbnN0IERFU1RSVUNUVVJFX05PVF9TVVBQT1JURUQgPSAnRGVzdHJ1Y3R1cmluZyBub3Qgc3VwcG9ydGVkJztcbmNvbnN0IENPVUxEX05PVF9SRVNPTFZFX1RZUEUgPSAnQ291bGQgbm90IHJlc29sdmUgdHlwZSc7XG5jb25zdCBGVU5DVElPTl9DQUxMX05PVF9TVVBQT1JURUQgPSAnRnVuY3Rpb24gY2FsbCBub3Qgc3VwcG9ydGVkJztcbmNvbnN0IFJFRkVSRU5DRV9UT19MT0NBTF9TWU1CT0wgPSAnUmVmZXJlbmNlIHRvIGEgbG9jYWwgc3ltYm9sJztcbmNvbnN0IExBTUJEQV9OT1RfU1VQUE9SVEVEID0gJ0xhbWJkYSBub3Qgc3VwcG9ydGVkJztcblxuZnVuY3Rpb24gZXhwYW5kZWRNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZywgY29udGV4dDogYW55KTogc3RyaW5nIHtcbiAgc3dpdGNoIChtZXNzYWdlKSB7XG4gICAgY2FzZSBSRUZFUkVOQ0VfVE9fTk9ORVhQT1JURURfQ0xBU1M6XG4gICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0LmNsYXNzTmFtZSkge1xuICAgICAgICByZXR1cm4gYFJlZmVyZW5jZXMgdG8gYSBub24tZXhwb3J0ZWQgY2xhc3MgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gZGVjb3JhdG9ycyBidXQgJHtjb250ZXh0LmNsYXNzTmFtZX0gd2FzIHJlZmVyZW5jZWQuYDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgVkFSSUFCTEVfTk9UX0lOSVRJQUxJWkVEOlxuICAgICAgcmV0dXJuICdPbmx5IGluaXRpYWxpemVkIHZhcmlhYmxlcyBhbmQgY29uc3RhbnRzIGNhbiBiZSByZWZlcmVuY2VkIGluIGRlY29yYXRvcnMgYmVjYXVzZSB0aGUgdmFsdWUgb2YgdGhpcyB2YXJpYWJsZSBpcyBuZWVkZWQgYnkgdGhlIHRlbXBsYXRlIGNvbXBpbGVyJztcbiAgICBjYXNlIERFU1RSVUNUVVJFX05PVF9TVVBQT1JURUQ6XG4gICAgICByZXR1cm4gJ1JlZmVyZW5jaW5nIGFuIGV4cG9ydGVkIGRlc3RydWN0dXJlZCB2YXJpYWJsZSBvciBjb25zdGFudCBpcyBub3Qgc3VwcG9ydGVkIGluIGRlY29yYXRvcnMgYW5kIHRoaXMgdmFsdWUgaXMgbmVlZGVkIGJ5IHRoZSB0ZW1wbGF0ZSBjb21waWxlcic7XG4gICAgY2FzZSBDT1VMRF9OT1RfUkVTT0xWRV9UWVBFOlxuICAgICAgaWYgKGNvbnRleHQgJiYgY29udGV4dC50eXBlTmFtZSkge1xuICAgICAgICByZXR1cm4gYENvdWxkIG5vdCByZXNvbHZlIHR5cGUgJHtjb250ZXh0LnR5cGVOYW1lfWA7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIEZVTkNUSU9OX0NBTExfTk9UX1NVUFBPUlRFRDpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQubmFtZSkge1xuICAgICAgICByZXR1cm4gYEZ1bmN0aW9uIGNhbGxzIGFyZSBub3Qgc3VwcG9ydGVkIGluIGRlY29yYXRvcnMgYnV0ICcke2NvbnRleHQubmFtZX0nIHdhcyBjYWxsZWRgO1xuICAgICAgfVxuICAgICAgcmV0dXJuICdGdW5jdGlvbiBjYWxscyBhcmUgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzJztcbiAgICBjYXNlIFJFRkVSRU5DRV9UT19MT0NBTF9TWU1CT0w6XG4gICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0Lm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBSZWZlcmVuY2UgdG8gYSBsb2NhbCAobm9uLWV4cG9ydGVkKSBzeW1ib2xzIGFyZSBub3Qgc3VwcG9ydGVkIGluIGRlY29yYXRvcnMgYnV0ICcke2NvbnRleHQubmFtZX0nIHdhcyByZWZlcmVuY2VkYDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgTEFNQkRBX05PVF9TVVBQT1JURUQ6XG4gICAgICByZXR1cm4gYEZ1bmN0aW9uIGV4cHJlc3Npb25zIGFyZSBub3Qgc3VwcG9ydGVkIGluIGRlY29yYXRvcnNgO1xuICB9XG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG5mdW5jdGlvbiBtZXNzYWdlQWR2aXNlKG1lc3NhZ2U6IHN0cmluZywgY29udGV4dDogYW55KTogc3RyaW5nfHVuZGVmaW5lZCB7XG4gIHN3aXRjaCAobWVzc2FnZSkge1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX05PTkVYUE9SVEVEX0NMQVNTOlxuICAgICAgaWYgKGNvbnRleHQgJiYgY29udGV4dC5jbGFzc05hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBDb25zaWRlciBleHBvcnRpbmcgJyR7Y29udGV4dC5jbGFzc05hbWV9J2A7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIERFU1RSVUNUVVJFX05PVF9TVVBQT1JURUQ6XG4gICAgICByZXR1cm4gJ0NvbnNpZGVyIHNpbXBsaWZ5aW5nIHRvIGF2b2lkIGRlc3RydWN0dXJpbmcnO1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX0xPQ0FMX1NZTUJPTDpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQubmFtZSkge1xuICAgICAgICByZXR1cm4gYENvbnNpZGVyIGV4cG9ydGluZyAnJHtjb250ZXh0Lm5hbWV9J2A7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIExBTUJEQV9OT1RfU1VQUE9SVEVEOlxuICAgICAgcmV0dXJuIGBDb25zaWRlciBjaGFuZ2luZyB0aGUgZnVuY3Rpb24gZXhwcmVzc2lvbiBpbnRvIGFuIGV4cG9ydGVkIGZ1bmN0aW9uYDtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBlcnJvclN1bW1hcnkoZXJyb3I6IE1ldGFkYXRhRXJyb3IpOiBzdHJpbmcge1xuICBpZiAoZXJyb3Iuc3VtbWFyeSkge1xuICAgIHJldHVybiBlcnJvci5zdW1tYXJ5O1xuICB9XG4gIHN3aXRjaCAoZXJyb3IubWVzc2FnZSkge1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX05PTkVYUE9SVEVEX0NMQVNTOlxuICAgICAgaWYgKGVycm9yLmNvbnRleHQgJiYgZXJyb3IuY29udGV4dC5jbGFzc05hbWUpIHtcbiAgICAgICAgcmV0dXJuIGByZWZlcmVuY2VzIG5vbi1leHBvcnRlZCBjbGFzcyAke2Vycm9yLmNvbnRleHQuY2xhc3NOYW1lfWA7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIFZBUklBQkxFX05PVF9JTklUSUFMSVpFRDpcbiAgICAgIHJldHVybiAnaXMgbm90IGluaXRpYWxpemVkJztcbiAgICBjYXNlIERFU1RSVUNUVVJFX05PVF9TVVBQT1JURUQ6XG4gICAgICByZXR1cm4gJ2lzIGEgZGVzdHJ1Y3R1cmVkIHZhcmlhYmxlJztcbiAgICBjYXNlIENPVUxEX05PVF9SRVNPTFZFX1RZUEU6XG4gICAgICByZXR1cm4gJ2NvdWxkIG5vdCBiZSByZXNvbHZlZCc7XG4gICAgY2FzZSBGVU5DVElPTl9DQUxMX05PVF9TVVBQT1JURUQ6XG4gICAgICBpZiAoZXJyb3IuY29udGV4dCAmJiBlcnJvci5jb250ZXh0Lm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBjYWxscyAnJHtlcnJvci5jb250ZXh0Lm5hbWV9J2A7XG4gICAgICB9XG4gICAgICByZXR1cm4gYGNhbGxzIGEgZnVuY3Rpb25gO1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX0xPQ0FMX1NZTUJPTDpcbiAgICAgIGlmIChlcnJvci5jb250ZXh0ICYmIGVycm9yLmNvbnRleHQubmFtZSkge1xuICAgICAgICByZXR1cm4gYHJlZmVyZW5jZXMgbG9jYWwgdmFyaWFibGUgJHtlcnJvci5jb250ZXh0Lm5hbWV9YDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBgcmVmZXJlbmNlcyBhIGxvY2FsIHZhcmlhYmxlYDtcbiAgfVxuICByZXR1cm4gJ2NvbnRhaW5zIHRoZSBlcnJvcic7XG59XG5cbmZ1bmN0aW9uIG1hcFN0cmluZ01hcChpbnB1dDoge1trZXk6IHN0cmluZ106IGFueX0sIHRyYW5zZm9ybTogKHZhbHVlOiBhbnksIGtleTogc3RyaW5nKSA9PiBhbnkpOlxuICAgIHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgaWYgKCFpbnB1dCkgcmV0dXJuIHt9O1xuICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge307XG4gIE9iamVjdC5rZXlzKGlucHV0KS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IHRyYW5zZm9ybShpbnB1dFtrZXldLCBrZXkpO1xuICAgIGlmICghc2hvdWxkSWdub3JlKHZhbHVlKSkge1xuICAgICAgaWYgKEhJRERFTl9LRVkudGVzdChrZXkpKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXN1bHQsIGtleSwge2VudW1lcmFibGU6IGZhbHNlLCBjb25maWd1cmFibGU6IHRydWUsIHZhbHVlOiB2YWx1ZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShvOiBhbnkpOiBib29sZWFuIHtcbiAgcmV0dXJuIG8gPT09IG51bGwgfHwgKHR5cGVvZiBvICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBvICE9PSAnb2JqZWN0Jyk7XG59XG5cbmludGVyZmFjZSBCaW5kaW5nU2NvcGVCdWlsZGVyIHtcbiAgZGVmaW5lKG5hbWU6IHN0cmluZywgdmFsdWU6IGFueSk6IEJpbmRpbmdTY29wZUJ1aWxkZXI7XG4gIGRvbmUoKTogQmluZGluZ1Njb3BlO1xufVxuXG5hYnN0cmFjdCBjbGFzcyBCaW5kaW5nU2NvcGUge1xuICBhYnN0cmFjdCByZXNvbHZlKG5hbWU6IHN0cmluZyk6IGFueTtcbiAgcHVibGljIHN0YXRpYyBtaXNzaW5nID0ge307XG4gIHB1YmxpYyBzdGF0aWMgZW1wdHk6IEJpbmRpbmdTY29wZSA9IHtyZXNvbHZlOiBuYW1lID0+IEJpbmRpbmdTY29wZS5taXNzaW5nfTtcblxuICBwdWJsaWMgc3RhdGljIGJ1aWxkKCk6IEJpbmRpbmdTY29wZUJ1aWxkZXIge1xuICAgIGNvbnN0IGN1cnJlbnQgPSBuZXcgTWFwPHN0cmluZywgYW55PigpO1xuICAgIHJldHVybiB7XG4gICAgICBkZWZpbmU6IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIGN1cnJlbnQuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuICAgICAgZG9uZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBjdXJyZW50LnNpemUgPiAwID8gbmV3IFBvcHVsYXRlZFNjb3BlKGN1cnJlbnQpIDogQmluZGluZ1Njb3BlLmVtcHR5O1xuICAgICAgfVxuICAgIH07XG4gIH1cbn1cblxuY2xhc3MgUG9wdWxhdGVkU2NvcGUgZXh0ZW5kcyBCaW5kaW5nU2NvcGUge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGJpbmRpbmdzOiBNYXA8c3RyaW5nLCBhbnk+KSB7IHN1cGVyKCk7IH1cblxuICByZXNvbHZlKG5hbWU6IHN0cmluZyk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ3MuaGFzKG5hbWUpID8gdGhpcy5iaW5kaW5ncy5nZXQobmFtZSkgOiBCaW5kaW5nU2NvcGUubWlzc2luZztcbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JtYXRNZXRhZGF0YU1lc3NhZ2VDaGFpbihcbiAgICBjaGFpbjogTWV0YWRhdGFNZXNzYWdlQ2hhaW4sIGFkdmlzZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogRm9ybWF0dGVkTWVzc2FnZUNoYWluIHtcbiAgY29uc3QgZXhwYW5kZWQgPSBleHBhbmRlZE1lc3NhZ2UoY2hhaW4ubWVzc2FnZSwgY2hhaW4uY29udGV4dCk7XG4gIGNvbnN0IG5lc3RpbmcgPSBjaGFpbi5zeW1ib2wgPyBgIGluICcke2NoYWluLnN5bWJvbC5uYW1lfSdgIDogJyc7XG4gIGNvbnN0IG1lc3NhZ2UgPSBgJHtleHBhbmRlZH0ke25lc3Rpbmd9YDtcbiAgY29uc3QgcG9zaXRpb24gPSBjaGFpbi5wb3NpdGlvbjtcbiAgY29uc3QgbmV4dDogRm9ybWF0dGVkTWVzc2FnZUNoYWlufHVuZGVmaW5lZCA9IGNoYWluLm5leHQgP1xuICAgICAgZm9ybWF0TWV0YWRhdGFNZXNzYWdlQ2hhaW4oY2hhaW4ubmV4dCwgYWR2aXNlKSA6XG4gICAgICBhZHZpc2UgPyB7bWVzc2FnZTogYWR2aXNlfSA6IHVuZGVmaW5lZDtcbiAgcmV0dXJuIHttZXNzYWdlLCBwb3NpdGlvbiwgbmV4dH07XG59XG5cbmZ1bmN0aW9uIGZvcm1hdE1ldGFkYXRhRXJyb3IoZTogRXJyb3IsIGNvbnRleHQ6IFN0YXRpY1N5bWJvbCk6IEVycm9yIHtcbiAgaWYgKGlzTWV0YWRhdGFFcnJvcihlKSkge1xuICAgIC8vIFByb2R1Y2UgYSBmb3JtYXR0ZWQgdmVyc2lvbiBvZiB0aGUgYW5kIGxlYXZpbmcgZW5vdWdoIGluZm9ybWF0aW9uIGluIHRoZSBvcmlnaW5hbCBlcnJvclxuICAgIC8vIHRvIHJlY292ZXIgdGhlIGZvcm1hdHRpbmcgaW5mb3JtYXRpb24gdG8gZXZlbnR1YWxseSBwcm9kdWNlIGEgZGlhZ25vc3RpYyBlcnJvciBtZXNzYWdlLlxuICAgIGNvbnN0IHBvc2l0aW9uID0gZS5wb3NpdGlvbjtcbiAgICBjb25zdCBjaGFpbjogTWV0YWRhdGFNZXNzYWdlQ2hhaW4gPSB7XG4gICAgICBtZXNzYWdlOiBgRXJyb3IgZHVyaW5nIHRlbXBsYXRlIGNvbXBpbGUgb2YgJyR7Y29udGV4dC5uYW1lfSdgLFxuICAgICAgcG9zaXRpb246IHBvc2l0aW9uLFxuICAgICAgbmV4dDoge21lc3NhZ2U6IGUubWVzc2FnZSwgbmV4dDogZS5jaGFpbiwgY29udGV4dDogZS5jb250ZXh0LCBzeW1ib2w6IGUuc3ltYm9sfVxuICAgIH07XG4gICAgY29uc3QgYWR2aXNlID0gZS5hZHZpc2UgfHwgbWVzc2FnZUFkdmlzZShlLm1lc3NhZ2UsIGUuY29udGV4dCk7XG4gICAgcmV0dXJuIGZvcm1hdHRlZEVycm9yKGZvcm1hdE1ldGFkYXRhTWVzc2FnZUNoYWluKGNoYWluLCBhZHZpc2UpKTtcbiAgfVxuICByZXR1cm4gZTtcbn1cbiJdfQ==