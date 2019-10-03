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
        define("@angular/compiler/src/aot/static_reflector", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/core", "@angular/compiler/src/util", "@angular/compiler/src/aot/formatted_error", "@angular/compiler/src/aot/static_symbol"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var core_1 = require("@angular/compiler/src/core");
    var util_1 = require("@angular/compiler/src/util");
    var formatted_error_1 = require("@angular/compiler/src/aot/formatted_error");
    var static_symbol_1 = require("@angular/compiler/src/aot/static_symbol");
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
            this.annotationForParentClassWithSummaryKind.set(compile_metadata_1.CompileSummaryKind.Directive, [core_1.createDirective, core_1.createComponent]);
            this.annotationForParentClassWithSummaryKind.set(compile_metadata_1.CompileSummaryKind.Pipe, [core_1.createPipe]);
            this.annotationForParentClassWithSummaryKind.set(compile_metadata_1.CompileSummaryKind.NgModule, [core_1.createNgModule]);
            this.annotationForParentClassWithSummaryKind.set(compile_metadata_1.CompileSummaryKind.Injectable, [core_1.createInjectable, core_1.createPipe, core_1.createDirective, core_1.createComponent, core_1.createNgModule]);
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
                if (resolvedMetadata instanceof static_symbol_1.StaticSymbol) {
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
                            this.reportError(formatMetadataError(metadataError("Class " + type.name + " in " + type.filePath + " extends from a " + compile_metadata_1.CompileSummaryKind[summary.type.summaryKind] + " in another compilation unit without duplicating the decorator", 
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
            if (!(type instanceof static_symbol_1.StaticSymbol)) {
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
            if (parentType instanceof static_symbol_1.StaticSymbol) {
                return parentType;
            }
        };
        StaticReflector.prototype.hasLifecycleHook = function (type, lcProperty) {
            if (!(type instanceof static_symbol_1.StaticSymbol)) {
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
            if (!(type instanceof static_symbol_1.StaticSymbol)) {
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
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Injectable'), core_1.createInjectable);
            this.injectionToken = this.findDeclaration(ANGULAR_CORE, 'InjectionToken');
            this.opaqueToken = this.findDeclaration(ANGULAR_CORE, 'OpaqueToken');
            this.ROUTES = this.tryFindDeclaration(ANGULAR_ROUTER, 'ROUTES');
            this.ANALYZE_FOR_ENTRY_COMPONENTS =
                this.findDeclaration(ANGULAR_CORE, 'ANALYZE_FOR_ENTRY_COMPONENTS');
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Host'), core_1.createHost);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Self'), core_1.createSelf);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'SkipSelf'), core_1.createSkipSelf);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Inject'), core_1.createInject);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Optional'), core_1.createOptional);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Attribute'), core_1.createAttribute);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'ContentChild'), core_1.createContentChild);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'ContentChildren'), core_1.createContentChildren);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'ViewChild'), core_1.createViewChild);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'ViewChildren'), core_1.createViewChildren);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Input'), core_1.createInput);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Output'), core_1.createOutput);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Pipe'), core_1.createPipe);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'HostBinding'), core_1.createHostBinding);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'HostListener'), core_1.createHostListener);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Directive'), core_1.createDirective);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Component'), core_1.createComponent);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'NgModule'), core_1.createNgModule);
            // Note: Some metadata classes can be used directly with Provider.deps.
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Host'), core_1.createHost);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Self'), core_1.createSelf);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'SkipSelf'), core_1.createSkipSelf);
            this._registerDecoratorOrConstructor(this.findDeclaration(ANGULAR_CORE, 'Optional'), core_1.createOptional);
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
                    if (expression instanceof static_symbol_1.StaticSymbol) {
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
                                    if (selectTarget instanceof static_symbol_1.StaticSymbol) {
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
                                    if (staticSymbol instanceof static_symbol_1.StaticSymbol) {
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
    exports.StaticReflector = StaticReflector;
    var METADATA_ERROR = 'ngMetadataError';
    function metadataError(message, summary, advise, position, symbol, context, chain) {
        var error = util_1.syntaxError(message);
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
            return formatted_error_1.formattedError(formatMetadataMessageChain(chain, advise));
        }
        return e;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3JlZmxlY3Rvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3Qvc3RhdGljX3JlZmxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCwyRUFBdUQ7SUFFdkQsbURBQWlXO0lBR2pXLG1EQUFvQztJQUVwQyw2RUFBd0U7SUFDeEUseUVBQTZDO0lBRzdDLElBQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQztJQUNyQyxJQUFNLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQztJQUV6QyxJQUFNLFVBQVUsR0FBRyxVQUFVLENBQUM7SUFFOUIsSUFBTSxNQUFNLEdBQUc7UUFDYixVQUFVLEVBQUUsUUFBUTtLQUNyQixDQUFDO0lBRUYsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDO0lBQzdCLElBQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQztJQUMxQixJQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFNBQVMsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLElBQU0saUJBQWlCLEdBQUcsV0FBVyxDQUFDO0lBQ3RDLElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQztJQUV2QixTQUFTLFlBQVksQ0FBQyxLQUFVO1FBQzlCLE9BQU8sS0FBSyxJQUFJLEtBQUssQ0FBQyxVQUFVLElBQUksUUFBUSxDQUFDO0lBQy9DLENBQUM7SUFFRDs7O09BR0c7SUFDSDtRQW9CRSx5QkFDWSxlQUE4QyxFQUM5QyxjQUFvQyxFQUM1QyxvQkFBd0UsRUFDeEUsc0JBQXdFLEVBQ2hFLGFBQXVEO1lBTG5FLGlCQW1CQztZQWhCRyxxQ0FBQSxFQUFBLHlCQUF3RTtZQUN4RSx1Q0FBQSxFQUFBLDJCQUF3RTtZQUhoRSxvQkFBZSxHQUFmLGVBQWUsQ0FBK0I7WUFDOUMsbUJBQWMs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LENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEQsMEJBQTBCLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ2hELE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQyxPQUFPLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUMzQyxPQUFPLEVBQUMsT0FBTyxTQUFBLEVBQUUsUUFBUSxVQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsU0FBUyxtQkFBbUIsQ0FBQyxDQUFRLEVBQUUsT0FBcUI7UUFDMUQsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDdEIsMEZBQTBGO1lBQzFGLDBGQUEwRjtZQUMxRixJQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDO1lBQzVCLElBQU0sS0FBSyxHQUF5QjtnQkFDbEMsT0FBTyxFQUFFLHVDQUFxQyxPQUFPLENBQUMsSUFBSSxNQUFHO2dCQUM3RCxRQUFRLEVBQUUsUUFBUTtnQkFDbEIsSUFBSSxFQUFFLEVBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUM7YUFDaEYsQ0FBQztZQUNGLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQy9ELE9BQU8sZ0NBQWMsQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztTQUNsRTtRQUNELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlU3VtbWFyeUtpbmR9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge01ldGFkYXRhRmFjdG9yeSwgY3JlYXRlQXR0cmlidXRlLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZUNvbnRlbnRDaGlsZCwgY3JlYXRlQ29udGVudENoaWxkcmVuLCBjcmVhdGVEaXJlY3RpdmUsIGNyZWF0ZUhvc3QsIGNyZWF0ZUhvc3RCaW5kaW5nLCBjcmVhdGVIb3N0TGlzdGVuZXIsIGNyZWF0ZUluamVjdCwgY3JlYXRlSW5qZWN0YWJsZSwgY3JlYXRlSW5wdXQsIGNyZWF0ZU5nTW9kdWxlLCBjcmVhdGVPcHRpb25hbCwgY3JlYXRlT3V0cHV0LCBjcmVhdGVQaXBlLCBjcmVhdGVTZWxmLCBjcmVhdGVTa2lwU2VsZiwgY3JlYXRlVmlld0NoaWxkLCBjcmVhdGVWaWV3Q2hpbGRyZW59IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1N1bW1hcnlSZXNvbHZlcn0gZnJvbSAnLi4vc3VtbWFyeV9yZXNvbHZlcic7XG5pbXBvcnQge3N5bnRheEVycm9yfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtGb3JtYXR0ZWRNZXNzYWdlQ2hhaW4sIGZvcm1hdHRlZEVycm9yfSBmcm9tICcuL2Zvcm1hdHRlZF9lcnJvcic7XG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7U3RhdGljU3ltYm9sUmVzb2x2ZXJ9IGZyb20gJy4vc3RhdGljX3N5bWJvbF9yZXNvbHZlcic7XG5cbmNvbnN0IEFOR1VMQVJfQ09SRSA9ICdAYW5ndWxhci9jb3JlJztcbmNvbnN0IEFOR1VMQVJfUk9VVEVSID0gJ0Bhbmd1bGFyL3JvdXRlcic7XG5cbmNvbnN0IEhJRERFTl9LRVkgPSAvXlxcJC4qXFwkJC87XG5cbmNvbnN0IElHTk9SRSA9IHtcbiAgX19zeW1ib2xpYzogJ2lnbm9yZSdcbn07XG5cbmNvbnN0IFVTRV9WQUxVRSA9ICd1c2VWYWx1ZSc7XG5jb25zdCBQUk9WSURFID0gJ3Byb3ZpZGUnO1xuY29uc3QgUkVGRVJFTkNFX1NFVCA9IG5ldyBTZXQoW1VTRV9WQUxVRSwgJ3VzZUZhY3RvcnknLCAnZGF0YScsICdpZCcsICdsb2FkQ2hpbGRyZW4nXSk7XG5jb25zdCBUWVBFR1VBUkRfUE9TVEZJWCA9ICdUeXBlR3VhcmQnO1xuY29uc3QgVVNFX0lGID0gJ1VzZUlmJztcblxuZnVuY3Rpb24gc2hvdWxkSWdub3JlKHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZhbHVlICYmIHZhbHVlLl9fc3ltYm9saWMgPT0gJ2lnbm9yZSc7XG59XG5cbi8qKlxuICogQSBzdGF0aWMgcmVmbGVjdG9yIGltcGxlbWVudHMgZW5vdWdoIG9mIHRoZSBSZWZsZWN0b3IgQVBJIHRoYXQgaXMgbmVjZXNzYXJ5IHRvIGNvbXBpbGVcbiAqIHRlbXBsYXRlcyBzdGF0aWNhbGx5LlxuICovXG5leHBvcnQgY2xhc3MgU3RhdGljUmVmbGVjdG9yIGltcGxlbWVudHMgQ29tcGlsZVJlZmxlY3RvciB7XG4gIHByaXZhdGUgYW5ub3RhdGlvbkNhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIGFueVtdPigpO1xuICBwcml2YXRlIHNoYWxsb3dBbm5vdGF0aW9uQ2FjaGUgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwgYW55W10+KCk7XG4gIHByaXZhdGUgcHJvcGVydHlDYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCB7W2tleTogc3RyaW5nXTogYW55W119PigpO1xuICBwcml2YXRlIHBhcmFtZXRlckNhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIGFueVtdPigpO1xuICBwcml2YXRlIG1ldGhvZENhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIHtba2V5OiBzdHJpbmddOiBib29sZWFufT4oKTtcbiAgcHJpdmF0ZSBzdGF0aWNDYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBzdHJpbmdbXT4oKTtcbiAgcHJpdmF0ZSBjb252ZXJzaW9uTWFwID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIChjb250ZXh0OiBTdGF0aWNTeW1ib2wsIGFyZ3M6IGFueVtdKSA9PiBhbnk+KCk7XG4gIHByaXZhdGUgcmVzb2x2ZWRFeHRlcm5hbFJlZmVyZW5jZXMgPSBuZXcgTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPigpO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBpbmplY3Rpb25Ub2tlbiAhOiBTdGF0aWNTeW1ib2w7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwcml2YXRlIG9wYXF1ZVRva2VuICE6IFN0YXRpY1N5bWJvbDtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIFJPVVRFUyAhOiBTdGF0aWNTeW1ib2w7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwcml2YXRlIEFOQUxZWkVfRk9SX0VOVFJZX0NPTVBPTkVOVFMgITogU3RhdGljU3ltYm9sO1xuICBwcml2YXRlIGFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZCA9XG4gICAgICBuZXcgTWFwPENvbXBpbGVTdW1tYXJ5S2luZCwgTWV0YWRhdGFGYWN0b3J5PGFueT5bXT4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgc3VtbWFyeVJlc29sdmVyOiBTdW1tYXJ5UmVzb2x2ZXI8U3RhdGljU3ltYm9sPixcbiAgICAgIHByaXZhdGUgc3ltYm9sUmVzb2x2ZXI6IFN0YXRpY1N5bWJvbFJlc29sdmVyLFxuICAgICAga25vd25NZXRhZGF0YUNsYXNzZXM6IHtuYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcsIGN0b3I6IGFueX1bXSA9IFtdLFxuICAgICAga25vd25NZXRhZGF0YUZ1bmN0aW9uczoge25hbWU6IHN0cmluZywgZmlsZVBhdGg6IHN0cmluZywgZm46IGFueX1bXSA9IFtdLFxuICAgICAgcHJpdmF0ZSBlcnJvclJlY29yZGVyPzogKGVycm9yOiBhbnksIGZpbGVOYW1lPzogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgdGhpcy5pbml0aWFsaXplQ29udmVyc2lvbk1hcCgpO1xuICAgIGtub3duTWV0YWRhdGFDbGFzc2VzLmZvckVhY2goXG4gICAgICAgIChrYykgPT4gdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgdGhpcy5nZXRTdGF0aWNTeW1ib2woa2MuZmlsZVBhdGgsIGtjLm5hbWUpLCBrYy5jdG9yKSk7XG4gICAga25vd25NZXRhZGF0YUZ1bmN0aW9ucy5mb3JFYWNoKFxuICAgICAgICAoa2YpID0+IHRoaXMuX3JlZ2lzdGVyRnVuY3Rpb24odGhpcy5nZXRTdGF0aWNTeW1ib2woa2YuZmlsZVBhdGgsIGtmLm5hbWUpLCBrZi5mbikpO1xuICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLnNldChcbiAgICAgICAgQ29tcGlsZVN1bW1hcnlLaW5kLkRpcmVjdGl2ZSwgW2NyZWF0ZURpcmVjdGl2ZSwgY3JlYXRlQ29tcG9uZW50XSk7XG4gICAgdGhpcy5hbm5vdGF0aW9uRm9yUGFyZW50Q2xhc3NXaXRoU3VtbWFyeUtpbmQuc2V0KENvbXBpbGVTdW1tYXJ5S2luZC5QaXBlLCBbY3JlYXRlUGlwZV0pO1xuICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLnNldChDb21waWxlU3VtbWFyeUtpbmQuTmdNb2R1bGUsIFtjcmVhdGVOZ01vZHVsZV0pO1xuICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLnNldChcbiAgICAgICAgQ29tcGlsZVN1bW1hcnlLaW5kLkluamVjdGFibGUsXG4gICAgICAgIFtjcmVhdGVJbmplY3RhYmxlLCBjcmVhdGVQaXBlLCBjcmVhdGVEaXJlY3RpdmUsIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlTmdNb2R1bGVdKTtcbiAgfVxuXG4gIGNvbXBvbmVudE1vZHVsZVVybCh0eXBlT3JGdW5jOiBTdGF0aWNTeW1ib2wpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YXRpY1N5bWJvbCA9IHRoaXMuZmluZFN5bWJvbERlY2xhcmF0aW9uKHR5cGVPckZ1bmMpO1xuICAgIHJldHVybiB0aGlzLnN5bWJvbFJlc29sdmVyLmdldFJlc291cmNlUGF0aChzdGF0aWNTeW1ib2wpO1xuICB9XG5cbiAgLyoqXG4gICAqIEludmFsaWRhdGUgdGhlIHNwZWNpZmllZCBgc3ltYm9sc2Agb24gcHJvZ3JhbSBjaGFuZ2UuXG4gICAqIEBwYXJhbSBzeW1ib2xzXG4gICAqL1xuICBpbnZhbGlkYXRlU3ltYm9scyhzeW1ib2xzOiBTdGF0aWNTeW1ib2xbXSkge1xuICAgIGZvciAoY29uc3Qgc3ltYm9sIG9mIHN5bWJvbHMpIHtcbiAgICAgIHRoaXMuYW5ub3RhdGlvbkNhY2hlLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgdGhpcy5zaGFsbG93QW5ub3RhdGlvbkNhY2hlLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgdGhpcy5wcm9wZXJ0eUNhY2hlLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgdGhpcy5wYXJhbWV0ZXJDYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMubWV0aG9kQ2FjaGUuZGVsZXRlKHN5bWJvbCk7XG4gICAgICB0aGlzLnN0YXRpY0NhY2hlLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgdGhpcy5jb252ZXJzaW9uTWFwLmRlbGV0ZShzeW1ib2wpO1xuICAgIH1cbiAgfVxuXG4gIHJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShyZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGNvbnRhaW5pbmdGaWxlPzogc3RyaW5nKTogU3RhdGljU3ltYm9sIHtcbiAgICBsZXQga2V5OiBzdHJpbmd8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmICghY29udGFpbmluZ0ZpbGUpIHtcbiAgICAgIGtleSA9IGAke3JlZi5tb2R1bGVOYW1lfToke3JlZi5uYW1lfWA7XG4gICAgICBjb25zdCBkZWNsYXJhdGlvblN5bWJvbCA9IHRoaXMucmVzb2x2ZWRFeHRlcm5hbFJlZmVyZW5jZXMuZ2V0KGtleSk7XG4gICAgICBpZiAoZGVjbGFyYXRpb25TeW1ib2wpIHJldHVybiBkZWNsYXJhdGlvblN5bWJvbDtcbiAgICB9XG4gICAgY29uc3QgcmVmU3ltYm9sID1cbiAgICAgICAgdGhpcy5zeW1ib2xSZXNvbHZlci5nZXRTeW1ib2xCeU1vZHVsZShyZWYubW9kdWxlTmFtZSAhLCByZWYubmFtZSAhLCBjb250YWluaW5nRmlsZSk7XG4gICAgY29uc3QgZGVjbGFyYXRpb25TeW1ib2wgPSB0aGlzLmZpbmRTeW1ib2xEZWNsYXJhdGlvbihyZWZTeW1ib2wpO1xuICAgIGlmICghY29udGFpbmluZ0ZpbGUpIHtcbiAgICAgIHRoaXMuc3ltYm9sUmVzb2x2ZXIucmVjb3JkTW9kdWxlTmFtZUZvckZpbGVOYW1lKHJlZlN5bWJvbC5maWxlUGF0aCwgcmVmLm1vZHVsZU5hbWUgISk7XG4gICAgICB0aGlzLnN5bWJvbFJlc29sdmVyLnJlY29yZEltcG9ydEFzKGRlY2xhcmF0aW9uU3ltYm9sLCByZWZTeW1ib2wpO1xuICAgIH1cbiAgICBpZiAoa2V5KSB7XG4gICAgICB0aGlzLnJlc29sdmVkRXh0ZXJuYWxSZWZlcmVuY2VzLnNldChrZXksIGRlY2xhcmF0aW9uU3ltYm9sKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlY2xhcmF0aW9uU3ltYm9sO1xuICB9XG5cbiAgZmluZERlY2xhcmF0aW9uKG1vZHVsZVVybDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlPzogc3RyaW5nKTogU3RhdGljU3ltYm9sIHtcbiAgICByZXR1cm4gdGhpcy5maW5kU3ltYm9sRGVjbGFyYXRpb24oXG4gICAgICAgIHRoaXMuc3ltYm9sUmVzb2x2ZXIuZ2V0U3ltYm9sQnlNb2R1bGUobW9kdWxlVXJsLCBuYW1lLCBjb250YWluaW5nRmlsZSkpO1xuICB9XG5cbiAgdHJ5RmluZERlY2xhcmF0aW9uKG1vZHVsZVVybDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlPzogc3RyaW5nKTogU3RhdGljU3ltYm9sIHtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xSZXNvbHZlci5pZ25vcmVFcnJvcnNGb3IoXG4gICAgICAgICgpID0+IHRoaXMuZmluZERlY2xhcmF0aW9uKG1vZHVsZVVybCwgbmFtZSwgY29udGFpbmluZ0ZpbGUpKTtcbiAgfVxuXG4gIGZpbmRTeW1ib2xEZWNsYXJhdGlvbihzeW1ib2w6IFN0YXRpY1N5bWJvbCk6IFN0YXRpY1N5bWJvbCB7XG4gICAgY29uc3QgcmVzb2x2ZWRTeW1ib2wgPSB0aGlzLnN5bWJvbFJlc29sdmVyLnJlc29sdmVTeW1ib2woc3ltYm9sKTtcbiAgICBpZiAocmVzb2x2ZWRTeW1ib2wpIHtcbiAgICAgIGxldCByZXNvbHZlZE1ldGFkYXRhID0gcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGE7XG4gICAgICBpZiAocmVzb2x2ZWRNZXRhZGF0YSAmJiByZXNvbHZlZE1ldGFkYXRhLl9fc3ltYm9saWMgPT09ICdyZXNvbHZlZCcpIHtcbiAgICAgICAgcmVzb2x2ZWRNZXRhZGF0YSA9IHJlc29sdmVkTWV0YWRhdGEuc3ltYm9sO1xuICAgICAgfVxuICAgICAgaWYgKHJlc29sdmVkTWV0YWRhdGEgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmluZFN5bWJvbERlY2xhcmF0aW9uKHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHN5bWJvbDtcbiAgfVxuXG4gIHB1YmxpYyB0cnlBbm5vdGF0aW9ucyh0eXBlOiBTdGF0aWNTeW1ib2wpOiBhbnlbXSB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZWNvcmRlciA9IHRoaXMuZXJyb3JSZWNvcmRlcjtcbiAgICB0aGlzLmVycm9yUmVjb3JkZXIgPSAoZXJyb3I6IGFueSwgZmlsZU5hbWU/OiBzdHJpbmcpID0+IHt9O1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5hbm5vdGF0aW9ucyh0eXBlKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy5lcnJvclJlY29yZGVyID0gb3JpZ2luYWxSZWNvcmRlcjtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYW5ub3RhdGlvbnModHlwZTogU3RhdGljU3ltYm9sKTogYW55W10ge1xuICAgIHJldHVybiB0aGlzLl9hbm5vdGF0aW9ucyhcbiAgICAgICAgdHlwZSwgKHR5cGU6IFN0YXRpY1N5bWJvbCwgZGVjb3JhdG9yczogYW55KSA9PiB0aGlzLnNpbXBsaWZ5KHR5cGUsIGRlY29yYXRvcnMpLFxuICAgICAgICB0aGlzLmFubm90YXRpb25DYWNoZSk7XG4gIH1cblxuICBwdWJsaWMgc2hhbGxvd0Fubm90YXRpb25zKHR5cGU6IFN0YXRpY1N5bWJvbCk6IGFueVtdIHtcbiAgICByZXR1cm4gdGhpcy5fYW5ub3RhdGlvbnMoXG4gICAgICAgIHR5cGUsICh0eXBlOiBTdGF0aWNTeW1ib2wsIGRlY29yYXRvcnM6IGFueSkgPT4gdGhpcy5zaW1wbGlmeSh0eXBlLCBkZWNvcmF0b3JzLCB0cnVlKSxcbiAgICAgICAgdGhpcy5zaGFsbG93QW5ub3RhdGlvbkNhY2hlKTtcbiAgfVxuXG4gIHByaXZhdGUgX2Fubm90YXRpb25zKFxuICAgICAgdHlwZTogU3RhdGljU3ltYm9sLCBzaW1wbGlmeTogKHR5cGU6IFN0YXRpY1N5bWJvbCwgZGVjb3JhdG9yczogYW55KSA9PiBhbnksXG4gICAgICBhbm5vdGF0aW9uQ2FjaGU6IE1hcDxTdGF0aWNTeW1ib2wsIGFueVtdPik6IGFueVtdIHtcbiAgICBsZXQgYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9uQ2FjaGUuZ2V0KHR5cGUpO1xuICAgIGlmICghYW5ub3RhdGlvbnMpIHtcbiAgICAgIGFubm90YXRpb25zID0gW107XG4gICAgICBjb25zdCBjbGFzc01ldGFkYXRhID0gdGhpcy5nZXRUeXBlTWV0YWRhdGEodHlwZSk7XG4gICAgICBjb25zdCBwYXJlbnRUeXBlID0gdGhpcy5maW5kUGFyZW50VHlwZSh0eXBlLCBjbGFzc01ldGFkYXRhKTtcbiAgICAgIGlmIChwYXJlbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudEFubm90YXRpb25zID0gdGhpcy5hbm5vdGF0aW9ucyhwYXJlbnRUeXBlKTtcbiAgICAgICAgYW5ub3RhdGlvbnMucHVzaCguLi5wYXJlbnRBbm5vdGF0aW9ucyk7XG4gICAgICB9XG4gICAgICBsZXQgb3duQW5ub3RhdGlvbnM6IGFueVtdID0gW107XG4gICAgICBpZiAoY2xhc3NNZXRhZGF0YVsnZGVjb3JhdG9ycyddKSB7XG4gICAgICAgIG93bkFubm90YXRpb25zID0gc2ltcGxpZnkodHlwZSwgY2xhc3NNZXRhZGF0YVsnZGVjb3JhdG9ycyddKTtcbiAgICAgICAgaWYgKG93bkFubm90YXRpb25zKSB7XG4gICAgICAgICAgYW5ub3RhdGlvbnMucHVzaCguLi5vd25Bbm5vdGF0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChwYXJlbnRUeXBlICYmICF0aGlzLnN1bW1hcnlSZXNvbHZlci5pc0xpYnJhcnlGaWxlKHR5cGUuZmlsZVBhdGgpICYmXG4gICAgICAgICAgdGhpcy5zdW1tYXJ5UmVzb2x2ZXIuaXNMaWJyYXJ5RmlsZShwYXJlbnRUeXBlLmZpbGVQYXRoKSkge1xuICAgICAgICBjb25zdCBzdW1tYXJ5ID0gdGhpcy5zdW1tYXJ5UmVzb2x2ZXIucmVzb2x2ZVN1bW1hcnkocGFyZW50VHlwZSk7XG4gICAgICAgIGlmIChzdW1tYXJ5ICYmIHN1bW1hcnkudHlwZSkge1xuICAgICAgICAgIGNvbnN0IHJlcXVpcmVkQW5ub3RhdGlvblR5cGVzID1cbiAgICAgICAgICAgICAgdGhpcy5hbm5vdGF0aW9uRm9yUGFyZW50Q2xhc3NXaXRoU3VtbWFyeUtpbmQuZ2V0KHN1bW1hcnkudHlwZS5zdW1tYXJ5S2luZCAhKSAhO1xuICAgICAgICAgIGNvbnN0IHR5cGVIYXNSZXF1aXJlZEFubm90YXRpb24gPSByZXF1aXJlZEFubm90YXRpb25UeXBlcy5zb21lKFxuICAgICAgICAgICAgICAocmVxdWlyZWRUeXBlKSA9PiBvd25Bbm5vdGF0aW9ucy5zb21lKGFubiA9PiByZXF1aXJlZFR5cGUuaXNUeXBlT2YoYW5uKSkpO1xuICAgICAgICAgIGlmICghdHlwZUhhc1JlcXVpcmVkQW5ub3RhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgICBmb3JtYXRNZXRhZGF0YUVycm9yKFxuICAgICAgICAgICAgICAgICAgICBtZXRhZGF0YUVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgYENsYXNzICR7dHlwZS5uYW1lfSBpbiAke3R5cGUuZmlsZVBhdGh9IGV4dGVuZHMgZnJvbSBhICR7Q29tcGlsZVN1bW1hcnlLaW5kW3N1bW1hcnkudHlwZS5zdW1tYXJ5S2luZCFdfSBpbiBhbm90aGVyIGNvbXBpbGF0aW9uIHVuaXQgd2l0aG91dCBkdXBsaWNhdGluZyB0aGUgZGVjb3JhdG9yYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIHN1bW1hcnkgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYFBsZWFzZSBhZGQgYSAke3JlcXVpcmVkQW5ub3RhdGlvblR5cGVzLm1hcCgodHlwZSkgPT4gdHlwZS5uZ01ldGFkYXRhTmFtZSkuam9pbignIG9yICcpfSBkZWNvcmF0b3IgdG8gdGhlIGNsYXNzYCksXG4gICAgICAgICAgICAgICAgICAgIHR5cGUpLFxuICAgICAgICAgICAgICAgIHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYW5ub3RhdGlvbkNhY2hlLnNldCh0eXBlLCBhbm5vdGF0aW9ucy5maWx0ZXIoYW5uID0+ICEhYW5uKSk7XG4gICAgfVxuICAgIHJldHVybiBhbm5vdGF0aW9ucztcbiAgfVxuXG4gIHB1YmxpYyBwcm9wTWV0YWRhdGEodHlwZTogU3RhdGljU3ltYm9sKToge1trZXk6IHN0cmluZ106IGFueVtdfSB7XG4gICAgbGV0IHByb3BNZXRhZGF0YSA9IHRoaXMucHJvcGVydHlDYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFwcm9wTWV0YWRhdGEpIHtcbiAgICAgIGNvbnN0IGNsYXNzTWV0YWRhdGEgPSB0aGlzLmdldFR5cGVNZXRhZGF0YSh0eXBlKTtcbiAgICAgIHByb3BNZXRhZGF0YSA9IHt9O1xuICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHRoaXMuZmluZFBhcmVudFR5cGUodHlwZSwgY2xhc3NNZXRhZGF0YSk7XG4gICAgICBpZiAocGFyZW50VHlwZSkge1xuICAgICAgICBjb25zdCBwYXJlbnRQcm9wTWV0YWRhdGEgPSB0aGlzLnByb3BNZXRhZGF0YShwYXJlbnRUeXBlKTtcbiAgICAgICAgT2JqZWN0LmtleXMocGFyZW50UHJvcE1ldGFkYXRhKS5mb3JFYWNoKChwYXJlbnRQcm9wKSA9PiB7XG4gICAgICAgICAgcHJvcE1ldGFkYXRhICFbcGFyZW50UHJvcF0gPSBwYXJlbnRQcm9wTWV0YWRhdGFbcGFyZW50UHJvcF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtZW1iZXJzID0gY2xhc3NNZXRhZGF0YVsnbWVtYmVycyddIHx8IHt9O1xuICAgICAgT2JqZWN0LmtleXMobWVtYmVycykuZm9yRWFjaCgocHJvcE5hbWUpID0+IHtcbiAgICAgICAgY29uc3QgcHJvcERhdGEgPSBtZW1iZXJzW3Byb3BOYW1lXTtcbiAgICAgICAgY29uc3QgcHJvcCA9ICg8YW55W10+cHJvcERhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLmZpbmQoYSA9PiBhWydfX3N5bWJvbGljJ10gPT0gJ3Byb3BlcnR5JyB8fCBhWydfX3N5bWJvbGljJ10gPT0gJ21ldGhvZCcpO1xuICAgICAgICBjb25zdCBkZWNvcmF0b3JzOiBhbnlbXSA9IFtdO1xuICAgICAgICBpZiAocHJvcE1ldGFkYXRhICFbcHJvcE5hbWVdKSB7XG4gICAgICAgICAgZGVjb3JhdG9ycy5wdXNoKC4uLnByb3BNZXRhZGF0YSAhW3Byb3BOYW1lXSk7XG4gICAgICAgIH1cbiAgICAgICAgcHJvcE1ldGFkYXRhICFbcHJvcE5hbWVdID0gZGVjb3JhdG9ycztcbiAgICAgICAgaWYgKHByb3AgJiYgcHJvcFsnZGVjb3JhdG9ycyddKSB7XG4gICAgICAgICAgZGVjb3JhdG9ycy5wdXNoKC4uLnRoaXMuc2ltcGxpZnkodHlwZSwgcHJvcFsnZGVjb3JhdG9ycyddKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgdGhpcy5wcm9wZXJ0eUNhY2hlLnNldCh0eXBlLCBwcm9wTWV0YWRhdGEpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcE1ldGFkYXRhO1xuICB9XG5cbiAgcHVibGljIHBhcmFtZXRlcnModHlwZTogU3RhdGljU3ltYm9sKTogYW55W10ge1xuICAgIGlmICghKHR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgIG5ldyBFcnJvcihgcGFyYW1ldGVycyByZWNlaXZlZCAke0pTT04uc3RyaW5naWZ5KHR5cGUpfSB3aGljaCBpcyBub3QgYSBTdGF0aWNTeW1ib2xgKSxcbiAgICAgICAgICB0eXBlKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwYXJhbWV0ZXJzID0gdGhpcy5wYXJhbWV0ZXJDYWNoZS5nZXQodHlwZSk7XG4gICAgICBpZiAoIXBhcmFtZXRlcnMpIHtcbiAgICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdGhpcy5maW5kUGFyZW50VHlwZSh0eXBlLCBjbGFzc01ldGFkYXRhKTtcbiAgICAgICAgY29uc3QgbWVtYmVycyA9IGNsYXNzTWV0YWRhdGEgPyBjbGFzc01ldGFkYXRhWydtZW1iZXJzJ10gOiBudWxsO1xuICAgICAgICBjb25zdCBjdG9yRGF0YSA9IG1lbWJlcnMgPyBtZW1iZXJzWydfX2N0b3JfXyddIDogbnVsbDtcbiAgICAgICAgaWYgKGN0b3JEYXRhKSB7XG4gICAgICAgICAgY29uc3QgY3RvciA9ICg8YW55W10+Y3RvckRhdGEpLmZpbmQoYSA9PiBhWydfX3N5bWJvbGljJ10gPT0gJ2NvbnN0cnVjdG9yJyk7XG4gICAgICAgICAgY29uc3QgcmF3UGFyYW1ldGVyVHlwZXMgPSA8YW55W10+Y3RvclsncGFyYW1ldGVycyddIHx8IFtdO1xuICAgICAgICAgIGNvbnN0IHBhcmFtZXRlckRlY29yYXRvcnMgPSA8YW55W10+dGhpcy5zaW1wbGlmeSh0eXBlLCBjdG9yWydwYXJhbWV0ZXJEZWNvcmF0b3JzJ10gfHwgW10pO1xuICAgICAgICAgIHBhcmFtZXRlcnMgPSBbXTtcbiAgICAgICAgICByYXdQYXJhbWV0ZXJUeXBlcy5mb3JFYWNoKChyYXdQYXJhbVR5cGUsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXN0ZWRSZXN1bHQ6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCBwYXJhbVR5cGUgPSB0aGlzLnRyeVNpbXBsaWZ5KHR5cGUsIHJhd1BhcmFtVHlwZSk7XG4gICAgICAgICAgICBpZiAocGFyYW1UeXBlKSBuZXN0ZWRSZXN1bHQucHVzaChwYXJhbVR5cGUpO1xuICAgICAgICAgICAgY29uc3QgZGVjb3JhdG9ycyA9IHBhcmFtZXRlckRlY29yYXRvcnMgPyBwYXJhbWV0ZXJEZWNvcmF0b3JzW2luZGV4XSA6IG51bGw7XG4gICAgICAgICAgICBpZiAoZGVjb3JhdG9ycykge1xuICAgICAgICAgICAgICBuZXN0ZWRSZXN1bHQucHVzaCguLi5kZWNvcmF0b3JzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhcmFtZXRlcnMgIS5wdXNoKG5lc3RlZFJlc3VsdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAocGFyZW50VHlwZSkge1xuICAgICAgICAgIHBhcmFtZXRlcnMgPSB0aGlzLnBhcmFtZXRlcnMocGFyZW50VHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgcGFyYW1ldGVycyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucGFyYW1ldGVyQ2FjaGUuc2V0KHR5cGUsIHBhcmFtZXRlcnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmFtZXRlcnM7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIG9uIHR5cGUgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0gd2l0aCBlcnJvciAke2V9YCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX21ldGhvZE5hbWVzKHR5cGU6IGFueSk6IHtba2V5OiBzdHJpbmddOiBib29sZWFufSB7XG4gICAgbGV0IG1ldGhvZE5hbWVzID0gdGhpcy5tZXRob2RDYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFtZXRob2ROYW1lcykge1xuICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgbWV0aG9kTmFtZXMgPSB7fTtcbiAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0aGlzLmZpbmRQYXJlbnRUeXBlKHR5cGUsIGNsYXNzTWV0YWRhdGEpO1xuICAgICAgaWYgKHBhcmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TWV0aG9kTmFtZXMgPSB0aGlzLl9tZXRob2ROYW1lcyhwYXJlbnRUeXBlKTtcbiAgICAgICAgT2JqZWN0LmtleXMocGFyZW50TWV0aG9kTmFtZXMpLmZvckVhY2goKHBhcmVudFByb3ApID0+IHtcbiAgICAgICAgICBtZXRob2ROYW1lcyAhW3BhcmVudFByb3BdID0gcGFyZW50TWV0aG9kTmFtZXNbcGFyZW50UHJvcF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtZW1iZXJzID0gY2xhc3NNZXRhZGF0YVsnbWVtYmVycyddIHx8IHt9O1xuICAgICAgT2JqZWN0LmtleXMobWVtYmVycykuZm9yRWFjaCgocHJvcE5hbWUpID0+IHtcbiAgICAgICAgY29uc3QgcHJvcERhdGEgPSBtZW1iZXJzW3Byb3BOYW1lXTtcbiAgICAgICAgY29uc3QgaXNNZXRob2QgPSAoPGFueVtdPnByb3BEYXRhKS5zb21lKGEgPT4gYVsnX19zeW1ib2xpYyddID09ICdtZXRob2QnKTtcbiAgICAgICAgbWV0aG9kTmFtZXMgIVtwcm9wTmFtZV0gPSBtZXRob2ROYW1lcyAhW3Byb3BOYW1lXSB8fCBpc01ldGhvZDtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5tZXRob2RDYWNoZS5zZXQodHlwZSwgbWV0aG9kTmFtZXMpO1xuICAgIH1cbiAgICByZXR1cm4gbWV0aG9kTmFtZXM7XG4gIH1cblxuICBwcml2YXRlIF9zdGF0aWNNZW1iZXJzKHR5cGU6IFN0YXRpY1N5bWJvbCk6IHN0cmluZ1tdIHtcbiAgICBsZXQgc3RhdGljTWVtYmVycyA9IHRoaXMuc3RhdGljQ2FjaGUuZ2V0KHR5cGUpO1xuICAgIGlmICghc3RhdGljTWVtYmVycykge1xuICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgY29uc3Qgc3RhdGljTWVtYmVyRGF0YSA9IGNsYXNzTWV0YWRhdGFbJ3N0YXRpY3MnXSB8fCB7fTtcbiAgICAgIHN0YXRpY01lbWJlcnMgPSBPYmplY3Qua2V5cyhzdGF0aWNNZW1iZXJEYXRhKTtcbiAgICAgIHRoaXMuc3RhdGljQ2FjaGUuc2V0KHR5cGUsIHN0YXRpY01lbWJlcnMpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGljTWVtYmVycztcbiAgfVxuXG5cbiAgcHJpdmF0ZSBmaW5kUGFyZW50VHlwZSh0eXBlOiBTdGF0aWNTeW1ib2wsIGNsYXNzTWV0YWRhdGE6IGFueSk6IFN0YXRpY1N5bWJvbHx1bmRlZmluZWQge1xuICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0aGlzLnRyeVNpbXBsaWZ5KHR5cGUsIGNsYXNzTWV0YWRhdGFbJ2V4dGVuZHMnXSk7XG4gICAgaWYgKHBhcmVudFR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgIHJldHVybiBwYXJlbnRUeXBlO1xuICAgIH1cbiAgfVxuXG4gIGhhc0xpZmVjeWNsZUhvb2sodHlwZTogYW55LCBsY1Byb3BlcnR5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAoISh0eXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihcbiAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBoYXNMaWZlY3ljbGVIb29rIHJlY2VpdmVkICR7SlNPTi5zdHJpbmdpZnkodHlwZSl9IHdoaWNoIGlzIG5vdCBhIFN0YXRpY1N5bWJvbGApLFxuICAgICAgICAgIHR5cGUpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgcmV0dXJuICEhdGhpcy5fbWV0aG9kTmFtZXModHlwZSlbbGNQcm9wZXJ0eV07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIG9uIHR5cGUgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0gd2l0aCBlcnJvciAke2V9YCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIGd1YXJkcyh0eXBlOiBhbnkpOiB7W2tleTogc3RyaW5nXTogU3RhdGljU3ltYm9sfSB7XG4gICAgaWYgKCEodHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKGBndWFyZHMgcmVjZWl2ZWQgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0gd2hpY2ggaXMgbm90IGEgU3RhdGljU3ltYm9sYCksIHR5cGUpO1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cbiAgICBjb25zdCBzdGF0aWNNZW1iZXJzID0gdGhpcy5fc3RhdGljTWVtYmVycyh0eXBlKTtcbiAgICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBTdGF0aWNTeW1ib2x9ID0ge307XG4gICAgZm9yIChsZXQgbmFtZSBvZiBzdGF0aWNNZW1iZXJzKSB7XG4gICAgICBpZiAobmFtZS5lbmRzV2l0aChUWVBFR1VBUkRfUE9TVEZJWCkpIHtcbiAgICAgICAgbGV0IHByb3BlcnR5ID0gbmFtZS5zdWJzdHIoMCwgbmFtZS5sZW5ndGggLSBUWVBFR1VBUkRfUE9TVEZJWC5sZW5ndGgpO1xuICAgICAgICBsZXQgdmFsdWU6IGFueTtcbiAgICAgICAgaWYgKHByb3BlcnR5LmVuZHNXaXRoKFVTRV9JRikpIHtcbiAgICAgICAgICBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyKDAsIHByb3BlcnR5Lmxlbmd0aCAtIFVTRV9JRi5sZW5ndGgpO1xuICAgICAgICAgIHZhbHVlID0gVVNFX0lGO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gdGhpcy5nZXRTdGF0aWNTeW1ib2wodHlwZS5maWxlUGF0aCwgdHlwZS5uYW1lLCBbbmFtZV0pO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0eXBlOiBTdGF0aWNTeW1ib2wsIGN0b3I6IGFueSk6IHZvaWQge1xuICAgIHRoaXMuY29udmVyc2lvbk1hcC5zZXQodHlwZSwgKGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgYXJnczogYW55W10pID0+IG5ldyBjdG9yKC4uLmFyZ3MpKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlZ2lzdGVyRnVuY3Rpb24odHlwZTogU3RhdGljU3ltYm9sLCBmbjogYW55KTogdm9pZCB7XG4gICAgdGhpcy5jb252ZXJzaW9uTWFwLnNldCh0eXBlLCAoY29udGV4dDogU3RhdGljU3ltYm9sLCBhcmdzOiBhbnlbXSkgPT4gZm4uYXBwbHkodW5kZWZpbmVkLCBhcmdzKSk7XG4gIH1cblxuICBwcml2YXRlIGluaXRpYWxpemVDb252ZXJzaW9uTWFwKCk6IHZvaWQge1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSW5qZWN0YWJsZScpLCBjcmVhdGVJbmplY3RhYmxlKTtcbiAgICB0aGlzLmluamVjdGlvblRva2VuID0gdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSW5qZWN0aW9uVG9rZW4nKTtcbiAgICB0aGlzLm9wYXF1ZVRva2VuID0gdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnT3BhcXVlVG9rZW4nKTtcbiAgICB0aGlzLlJPVVRFUyA9IHRoaXMudHJ5RmluZERlY2xhcmF0aW9uKEFOR1VMQVJfUk9VVEVSLCAnUk9VVEVTJyk7XG4gICAgdGhpcy5BTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTID1cbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnQU5BTFlaRV9GT1JfRU5UUllfQ09NUE9ORU5UUycpO1xuXG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0hvc3QnKSwgY3JlYXRlSG9zdCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1NlbGYnKSwgY3JlYXRlU2VsZik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdTa2lwU2VsZicpLCBjcmVhdGVTa2lwU2VsZik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdJbmplY3QnKSwgY3JlYXRlSW5qZWN0KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ09wdGlvbmFsJyksIGNyZWF0ZU9wdGlvbmFsKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0F0dHJpYnV0ZScpLCBjcmVhdGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnQ29udGVudENoaWxkJyksIGNyZWF0ZUNvbnRlbnRDaGlsZCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdDb250ZW50Q2hpbGRyZW4nKSwgY3JlYXRlQ29udGVudENoaWxkcmVuKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1ZpZXdDaGlsZCcpLCBjcmVhdGVWaWV3Q2hpbGQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnVmlld0NoaWxkcmVuJyksIGNyZWF0ZVZpZXdDaGlsZHJlbik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0lucHV0JyksIGNyZWF0ZUlucHV0KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ091dHB1dCcpLCBjcmVhdGVPdXRwdXQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdQaXBlJyksIGNyZWF0ZVBpcGUpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSG9zdEJpbmRpbmcnKSwgY3JlYXRlSG9zdEJpbmRpbmcpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSG9zdExpc3RlbmVyJyksIGNyZWF0ZUhvc3RMaXN0ZW5lcik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdEaXJlY3RpdmUnKSwgY3JlYXRlRGlyZWN0aXZlKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0NvbXBvbmVudCcpLCBjcmVhdGVDb21wb25lbnQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnTmdNb2R1bGUnKSwgY3JlYXRlTmdNb2R1bGUpO1xuXG4gICAgLy8gTm90ZTogU29tZSBtZXRhZGF0YSBjbGFzc2VzIGNhbiBiZSB1c2VkIGRpcmVjdGx5IHdpdGggUHJvdmlkZXIuZGVwcy5cbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSG9zdCcpLCBjcmVhdGVIb3N0KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnU2VsZicpLCBjcmVhdGVTZWxmKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1NraXBTZWxmJyksIGNyZWF0ZVNraXBTZWxmKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ09wdGlvbmFsJyksIGNyZWF0ZU9wdGlvbmFsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBnZXRTdGF0aWNTeW1ib2wgcHJvZHVjZXMgYSBUeXBlIHdob3NlIG1ldGFkYXRhIGlzIGtub3duIGJ1dCB3aG9zZSBpbXBsZW1lbnRhdGlvbiBpcyBub3QgbG9hZGVkLlxuICAgKiBBbGwgdHlwZXMgcGFzc2VkIHRvIHRoZSBTdGF0aWNSZXNvbHZlciBzaG91bGQgYmUgcHNldWRvLXR5cGVzIHJldHVybmVkIGJ5IHRoaXMgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjbGFyYXRpb25GaWxlIHRoZSBhYnNvbHV0ZSBwYXRoIG9mIHRoZSBmaWxlIHdoZXJlIHRoZSBzeW1ib2wgaXMgZGVjbGFyZWRcbiAgICogQHBhcmFtIG5hbWUgdGhlIG5hbWUgb2YgdGhlIHR5cGUuXG4gICAqL1xuICBnZXRTdGF0aWNTeW1ib2woZGVjbGFyYXRpb25GaWxlOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgbWVtYmVycz86IHN0cmluZ1tdKTogU3RhdGljU3ltYm9sIHtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xSZXNvbHZlci5nZXRTdGF0aWNTeW1ib2woZGVjbGFyYXRpb25GaWxlLCBuYW1lLCBtZW1iZXJzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTaW1wbGlmeSBidXQgZGlzY2FyZCBhbnkgZXJyb3JzXG4gICAqL1xuICBwcml2YXRlIHRyeVNpbXBsaWZ5KGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgdmFsdWU6IGFueSk6IGFueSB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZWNvcmRlciA9IHRoaXMuZXJyb3JSZWNvcmRlcjtcbiAgICB0aGlzLmVycm9yUmVjb3JkZXIgPSAoZXJyb3I6IGFueSwgZmlsZU5hbWU/OiBzdHJpbmcpID0+IHt9O1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuc2ltcGxpZnkoY29udGV4dCwgdmFsdWUpO1xuICAgIHRoaXMuZXJyb3JSZWNvcmRlciA9IG9yaWdpbmFsUmVjb3JkZXI7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHVibGljIHNpbXBsaWZ5KGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgdmFsdWU6IGFueSwgbGF6eTogYm9vbGVhbiA9IGZhbHNlKTogYW55IHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBsZXQgc2NvcGUgPSBCaW5kaW5nU2NvcGUuZW1wdHk7XG4gICAgY29uc3QgY2FsbGluZyA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBib29sZWFuPigpO1xuICAgIGNvbnN0IHJvb3RDb250ZXh0ID0gY29udGV4dDtcblxuICAgIGZ1bmN0aW9uIHNpbXBsaWZ5SW5Db250ZXh0KFxuICAgICAgICBjb250ZXh0OiBTdGF0aWNTeW1ib2wsIHZhbHVlOiBhbnksIGRlcHRoOiBudW1iZXIsIHJlZmVyZW5jZXM6IG51bWJlcik6IGFueSB7XG4gICAgICBmdW5jdGlvbiByZXNvbHZlUmVmZXJlbmNlVmFsdWUoc3RhdGljU3ltYm9sOiBTdGF0aWNTeW1ib2wpOiBhbnkge1xuICAgICAgICBjb25zdCByZXNvbHZlZFN5bWJvbCA9IHNlbGYuc3ltYm9sUmVzb2x2ZXIucmVzb2x2ZVN5bWJvbChzdGF0aWNTeW1ib2wpO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZWRTeW1ib2wgPyByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSA6IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5RWFnZXJseSh2YWx1ZTogYW55KTogYW55IHtcbiAgICAgICAgcmV0dXJuIHNpbXBsaWZ5SW5Db250ZXh0KGNvbnRleHQsIHZhbHVlLCBkZXB0aCwgMCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5TGF6aWx5KHZhbHVlOiBhbnkpOiBhbnkge1xuICAgICAgICByZXR1cm4gc2ltcGxpZnlJbkNvbnRleHQoY29udGV4dCwgdmFsdWUsIGRlcHRoLCByZWZlcmVuY2VzICsgMSk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5TmVzdGVkKG5lc3RlZENvbnRleHQ6IFN0YXRpY1N5bWJvbCwgdmFsdWU6IGFueSk6IGFueSB7XG4gICAgICAgIGlmIChuZXN0ZWRDb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgICAgLy8gSWYgdGhlIGNvbnRleHQgaGFzbid0IGNoYW5nZWQgbGV0IHRoZSBleGNlcHRpb24gcHJvcGFnYXRlIHVubW9kaWZpZWQuXG4gICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5SW5Db250ZXh0KG5lc3RlZENvbnRleHQsIHZhbHVlLCBkZXB0aCArIDEsIHJlZmVyZW5jZXMpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5SW5Db250ZXh0KG5lc3RlZENvbnRleHQsIHZhbHVlLCBkZXB0aCArIDEsIHJlZmVyZW5jZXMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgaWYgKGlzTWV0YWRhdGFFcnJvcihlKSkge1xuICAgICAgICAgICAgLy8gUHJvcGFnYXRlIHRoZSBtZXNzYWdlIHRleHQgdXAgYnV0IGFkZCBhIG1lc3NhZ2UgdG8gdGhlIGNoYWluIHRoYXQgZXhwbGFpbnMgaG93IHdlIGdvdFxuICAgICAgICAgICAgLy8gaGVyZS5cbiAgICAgICAgICAgIC8vIGUuY2hhaW4gaW1wbGllcyBlLnN5bWJvbFxuICAgICAgICAgICAgY29uc3Qgc3VtbWFyeU1zZyA9IGUuY2hhaW4gPyAncmVmZXJlbmNlcyBcXCcnICsgZS5zeW1ib2wgIS5uYW1lICsgJ1xcJycgOiBlcnJvclN1bW1hcnkoZSk7XG4gICAgICAgICAgICBjb25zdCBzdW1tYXJ5ID0gYCcke25lc3RlZENvbnRleHQubmFtZX0nICR7c3VtbWFyeU1zZ31gO1xuICAgICAgICAgICAgY29uc3QgY2hhaW4gPSB7bWVzc2FnZTogc3VtbWFyeSwgcG9zaXRpb246IGUucG9zaXRpb24sIG5leHQ6IGUuY2hhaW59O1xuICAgICAgICAgICAgLy8gVE9ETyhjaHVja2opOiByZXRyaWV2ZSB0aGUgcG9zaXRpb24gaW5mb3JtYXRpb24gaW5kaXJlY3RseSBmcm9tIHRoZSBjb2xsZWN0b3JzIG5vZGVcbiAgICAgICAgICAgIC8vIG1hcCBpZiB0aGUgbWV0YWRhdGEgaXMgZnJvbSBhIC50cyBmaWxlLlxuICAgICAgICAgICAgc2VsZi5lcnJvcihcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOiBlLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICBhZHZpc2U6IGUuYWR2aXNlLFxuICAgICAgICAgICAgICAgICAgY29udGV4dDogZS5jb250ZXh0LCBjaGFpbixcbiAgICAgICAgICAgICAgICAgIHN5bWJvbDogbmVzdGVkQ29udGV4dFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgY29udGV4dCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEl0IGlzIHByb2JhYmx5IGFuIGludGVybmFsIGVycm9yLlxuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc2ltcGxpZnlDYWxsKFxuICAgICAgICAgIGZ1bmN0aW9uU3ltYm9sOiBTdGF0aWNTeW1ib2wsIHRhcmdldEZ1bmN0aW9uOiBhbnksIGFyZ3M6IGFueVtdLCB0YXJnZXRFeHByZXNzaW9uOiBhbnkpIHtcbiAgICAgICAgaWYgKHRhcmdldEZ1bmN0aW9uICYmIHRhcmdldEZ1bmN0aW9uWydfX3N5bWJvbGljJ10gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGlmIChjYWxsaW5nLmdldChmdW5jdGlvblN5bWJvbCkpIHtcbiAgICAgICAgICAgIHNlbGYuZXJyb3IoXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1JlY3Vyc2lvbiBpcyBub3Qgc3VwcG9ydGVkJyxcbiAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IGBjYWxsZWQgJyR7ZnVuY3Rpb25TeW1ib2wubmFtZX0nIHJlY3Vyc2l2ZWx5YCxcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiB0YXJnZXRGdW5jdGlvblxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TeW1ib2wpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB0YXJnZXRGdW5jdGlvblsndmFsdWUnXTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAmJiAoZGVwdGggIT0gMCB8fCB2YWx1ZS5fX3N5bWJvbGljICE9ICdlcnJvcicpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IHN0cmluZ1tdID0gdGFyZ2V0RnVuY3Rpb25bJ3BhcmFtZXRlcnMnXTtcbiAgICAgICAgICAgICAgY29uc3QgZGVmYXVsdHM6IGFueVtdID0gdGFyZ2V0RnVuY3Rpb24uZGVmYXVsdHM7XG4gICAgICAgICAgICAgIGFyZ3MgPSBhcmdzLm1hcChhcmcgPT4gc2ltcGxpZnlOZXN0ZWQoY29udGV4dCwgYXJnKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGFyZyA9PiBzaG91bGRJZ25vcmUoYXJnKSA/IHVuZGVmaW5lZCA6IGFyZyk7XG4gICAgICAgICAgICAgIGlmIChkZWZhdWx0cyAmJiBkZWZhdWx0cy5sZW5ndGggPiBhcmdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFyZ3MucHVzaCguLi5kZWZhdWx0cy5zbGljZShhcmdzLmxlbmd0aCkubWFwKCh2YWx1ZTogYW55KSA9PiBzaW1wbGlmeSh2YWx1ZSkpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjYWxsaW5nLnNldChmdW5jdGlvblN5bWJvbCwgdHJ1ZSk7XG4gICAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uU2NvcGUgPSBCaW5kaW5nU2NvcGUuYnVpbGQoKTtcbiAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJhbWV0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TY29wZS5kZWZpbmUocGFyYW1ldGVyc1tpXSwgYXJnc1tpXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3Qgb2xkU2NvcGUgPSBzY29wZTtcbiAgICAgICAgICAgICAgbGV0IHJlc3VsdDogYW55O1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHNjb3BlID0gZnVuY3Rpb25TY29wZS5kb25lKCk7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gc2ltcGxpZnlOZXN0ZWQoZnVuY3Rpb25TeW1ib2wsIHZhbHVlKTtcbiAgICAgICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgICAgICBzY29wZSA9IG9sZFNjb3BlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIGNhbGxpbmcuZGVsZXRlKGZ1bmN0aW9uU3ltYm9sKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAvLyBJZiBkZXB0aCBpcyAwIHdlIGFyZSBldmFsdWF0aW5nIHRoZSB0b3AgbGV2ZWwgZXhwcmVzc2lvbiB0aGF0IGlzIGRlc2NyaWJpbmcgZWxlbWVudFxuICAgICAgICAgIC8vIGRlY29yYXRvci4gSW4gdGhpcyBjYXNlLCBpdCBpcyBhIGRlY29yYXRvciB3ZSBkb24ndCB1bmRlcnN0YW5kLCBzdWNoIGFzIGEgY3VzdG9tXG4gICAgICAgICAgLy8gbm9uLWFuZ3VsYXIgZGVjb3JhdG9yLCBhbmQgd2Ugc2hvdWxkIGp1c3QgaWdub3JlIGl0LlxuICAgICAgICAgIHJldHVybiBJR05PUkU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHBvc2l0aW9uOiBQb3NpdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmICh0YXJnZXRFeHByZXNzaW9uICYmIHRhcmdldEV4cHJlc3Npb24uX19zeW1ib2xpYyA9PSAncmVzb2x2ZWQnKSB7XG4gICAgICAgICAgY29uc3QgbGluZSA9IHRhcmdldEV4cHJlc3Npb24ubGluZTtcbiAgICAgICAgICBjb25zdCBjaGFyYWN0ZXIgPSB0YXJnZXRFeHByZXNzaW9uLmNoYXJhY3RlcjtcbiAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHRhcmdldEV4cHJlc3Npb24uZmlsZU5hbWU7XG4gICAgICAgICAgaWYgKGZpbGVOYW1lICE9IG51bGwgJiYgbGluZSAhPSBudWxsICYmIGNoYXJhY3RlciAhPSBudWxsKSB7XG4gICAgICAgICAgICBwb3NpdGlvbiA9IHtmaWxlTmFtZSwgbGluZSwgY29sdW1uOiBjaGFyYWN0ZXJ9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzZWxmLmVycm9yKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBtZXNzYWdlOiBGVU5DVElPTl9DQUxMX05PVF9TVVBQT1JURUQsXG4gICAgICAgICAgICAgIGNvbnRleHQ6IGZ1bmN0aW9uU3ltYm9sLFxuICAgICAgICAgICAgICB2YWx1ZTogdGFyZ2V0RnVuY3Rpb24sIHBvc2l0aW9uXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29udGV4dCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5KGV4cHJlc3Npb246IGFueSk6IGFueSB7XG4gICAgICAgIGlmIChpc1ByaW1pdGl2ZShleHByZXNzaW9uKSkge1xuICAgICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgICAgICB9XG4gICAgICAgIGlmIChleHByZXNzaW9uIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueVtdID0gW107XG4gICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mICg8YW55PmV4cHJlc3Npb24pKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgYSBzcHJlYWQgZXhwcmVzc2lvblxuICAgICAgICAgICAgaWYgKGl0ZW0gJiYgaXRlbS5fX3N5bWJvbGljID09PSAnc3ByZWFkJykge1xuICAgICAgICAgICAgICAvLyBXZSBjYWxsIHdpdGggcmVmZXJlbmNlcyBhcyAwIGJlY2F1c2Ugd2UgcmVxdWlyZSB0aGUgYWN0dWFsIHZhbHVlIGFuZCBjYW5ub3RcbiAgICAgICAgICAgICAgLy8gdG9sZXJhdGUgYSByZWZlcmVuY2UgaGVyZS5cbiAgICAgICAgICAgICAgY29uc3Qgc3ByZWFkQXJyYXkgPSBzaW1wbGlmeUVhZ2VybHkoaXRlbS5leHByZXNzaW9uKTtcbiAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoc3ByZWFkQXJyYXkpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBzcHJlYWRJdGVtIG9mIHNwcmVhZEFycmF5KSB7XG4gICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChzcHJlYWRJdGVtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gc2ltcGxpZnkoaXRlbSk7XG4gICAgICAgICAgICBpZiAoc2hvdWxkSWdub3JlKHZhbHVlKSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXhwcmVzc2lvbiBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgICAgIC8vIFN0b3Agc2ltcGxpZmljYXRpb24gYXQgYnVpbHRpbiBzeW1ib2xzIG9yIGlmIHdlIGFyZSBpbiBhIHJlZmVyZW5jZSBjb250ZXh0IGFuZFxuICAgICAgICAgIC8vIHRoZSBzeW1ib2wgZG9lc24ndCBoYXZlIG1lbWJlcnMuXG4gICAgICAgICAgaWYgKGV4cHJlc3Npb24gPT09IHNlbGYuaW5qZWN0aW9uVG9rZW4gfHwgc2VsZi5jb252ZXJzaW9uTWFwLmhhcyhleHByZXNzaW9uKSB8fFxuICAgICAgICAgICAgICAocmVmZXJlbmNlcyA+IDAgJiYgIWV4cHJlc3Npb24ubWVtYmVycy5sZW5ndGgpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc3RhdGljU3ltYm9sID0gZXhwcmVzc2lvbjtcbiAgICAgICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uVmFsdWUgPSByZXNvbHZlUmVmZXJlbmNlVmFsdWUoc3RhdGljU3ltYm9sKTtcbiAgICAgICAgICAgIGlmIChkZWNsYXJhdGlvblZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5TmVzdGVkKHN0YXRpY1N5bWJvbCwgZGVjbGFyYXRpb25WYWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gc3RhdGljU3ltYm9sO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZXhwcmVzc2lvbikge1xuICAgICAgICAgIGlmIChleHByZXNzaW9uWydfX3N5bWJvbGljJ10pIHtcbiAgICAgICAgICAgIGxldCBzdGF0aWNTeW1ib2w6IFN0YXRpY1N5bWJvbDtcbiAgICAgICAgICAgIHN3aXRjaCAoZXhwcmVzc2lvblsnX19zeW1ib2xpYyddKSB7XG4gICAgICAgICAgICAgIGNhc2UgJ2Jpbm9wJzpcbiAgICAgICAgICAgICAgICBsZXQgbGVmdCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ2xlZnQnXSk7XG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZElnbm9yZShsZWZ0KSkgcmV0dXJuIGxlZnQ7XG4gICAgICAgICAgICAgICAgbGV0IHJpZ2h0ID0gc2ltcGxpZnkoZXhwcmVzc2lvblsncmlnaHQnXSk7XG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZElnbm9yZShyaWdodCkpIHJldHVybiByaWdodDtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGV4cHJlc3Npb25bJ29wZXJhdG9yJ10pIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyYmJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgJiYgcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICd8fCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IHx8IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnfCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IHwgcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICdeJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgXiByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyYnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAmIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPT0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA9PSByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyE9JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgIT0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc9PT0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA9PT0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICchPT0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAhPT0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPCByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJz4nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA+IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPD0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA8PSByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJz49JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPj0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc8PCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IDw8IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPj4nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA+PiByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJysnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCArIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IC0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICcqJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgKiByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJy8nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAvIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnJSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICUgcmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICBjYXNlICdpZic6XG4gICAgICAgICAgICAgICAgbGV0IGNvbmRpdGlvbiA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ2NvbmRpdGlvbiddKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uZGl0aW9uID8gc2ltcGxpZnkoZXhwcmVzc2lvblsndGhlbkV4cHJlc3Npb24nXSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaW1wbGlmeShleHByZXNzaW9uWydlbHNlRXhwcmVzc2lvbiddKTtcbiAgICAgICAgICAgICAgY2FzZSAncHJlJzpcbiAgICAgICAgICAgICAgICBsZXQgb3BlcmFuZCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ29wZXJhbmQnXSk7XG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZElnbm9yZShvcGVyYW5kKSkgcmV0dXJuIG9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChleHByZXNzaW9uWydvcGVyYXRvciddKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIC1vcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgY2FzZSAnISc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ34nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gfm9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICBjYXNlICdpbmRleCc6XG4gICAgICAgICAgICAgICAgbGV0IGluZGV4VGFyZ2V0ID0gc2ltcGxpZnlFYWdlcmx5KGV4cHJlc3Npb25bJ2V4cHJlc3Npb24nXSk7XG4gICAgICAgICAgICAgICAgbGV0IGluZGV4ID0gc2ltcGxpZnlFYWdlcmx5KGV4cHJlc3Npb25bJ2luZGV4J10pO1xuICAgICAgICAgICAgICAgIGlmIChpbmRleFRhcmdldCAmJiBpc1ByaW1pdGl2ZShpbmRleCkpIHJldHVybiBpbmRleFRhcmdldFtpbmRleF07XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIGNhc2UgJ3NlbGVjdCc6XG4gICAgICAgICAgICAgICAgY29uc3QgbWVtYmVyID0gZXhwcmVzc2lvblsnbWVtYmVyJ107XG4gICAgICAgICAgICAgICAgbGV0IHNlbGVjdENvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICAgICAgICAgIGxldCBzZWxlY3RUYXJnZXQgPSBzaW1wbGlmeShleHByZXNzaW9uWydleHByZXNzaW9uJ10pO1xuICAgICAgICAgICAgICAgIGlmIChzZWxlY3RUYXJnZXQgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlcnMgPSBzZWxlY3RUYXJnZXQubWVtYmVycy5jb25jYXQobWVtYmVyKTtcbiAgICAgICAgICAgICAgICAgIHNlbGVjdENvbnRleHQgPVxuICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZ2V0U3RhdGljU3ltYm9sKHNlbGVjdFRhcmdldC5maWxlUGF0aCwgc2VsZWN0VGFyZ2V0Lm5hbWUsIG1lbWJlcnMpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZGVjbGFyYXRpb25WYWx1ZSA9IHJlc29sdmVSZWZlcmVuY2VWYWx1ZShzZWxlY3RDb250ZXh0KTtcbiAgICAgICAgICAgICAgICAgIGlmIChkZWNsYXJhdGlvblZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5TmVzdGVkKHNlbGVjdENvbnRleHQsIGRlY2xhcmF0aW9uVmFsdWUpO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGVjdENvbnRleHQ7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzZWxlY3RUYXJnZXQgJiYgaXNQcmltaXRpdmUobWVtYmVyKSlcbiAgICAgICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeU5lc3RlZChzZWxlY3RDb250ZXh0LCBzZWxlY3RUYXJnZXRbbWVtYmVyXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIGNhc2UgJ3JlZmVyZW5jZSc6XG4gICAgICAgICAgICAgICAgLy8gTm90ZTogVGhpcyBvbmx5IGhhcyB0byBkZWFsIHdpdGggdmFyaWFibGUgcmVmZXJlbmNlcywgYXMgc3ltYm9sIHJlZmVyZW5jZXMgaGF2ZVxuICAgICAgICAgICAgICAgIC8vIGJlZW4gY29udmVydGVkIGludG8gJ3Jlc29sdmVkJ1xuICAgICAgICAgICAgICAgIC8vIGluIHRoZSBTdGF0aWNTeW1ib2xSZXNvbHZlci5cbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lOiBzdHJpbmcgPSBleHByZXNzaW9uWyduYW1lJ107XG4gICAgICAgICAgICAgICAgY29uc3QgbG9jYWxWYWx1ZSA9IHNjb3BlLnJlc29sdmUobmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKGxvY2FsVmFsdWUgIT0gQmluZGluZ1Njb3BlLm1pc3NpbmcpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBsb2NhbFZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAncmVzb2x2ZWQnOlxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnkoZXhwcmVzc2lvbi5zeW1ib2wpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgIC8vIElmIGFuIGVycm9yIGlzIHJlcG9ydGVkIGV2YWx1YXRpbmcgdGhlIHN5bWJvbCByZWNvcmQgdGhlIHBvc2l0aW9uIG9mIHRoZVxuICAgICAgICAgICAgICAgICAgLy8gcmVmZXJlbmNlIGluIHRoZSBlcnJvciBzbyBpdCBjYW5cbiAgICAgICAgICAgICAgICAgIC8vIGJlIHJlcG9ydGVkIGluIHRoZSBlcnJvciBtZXNzYWdlIGdlbmVyYXRlZCBmcm9tIHRoZSBleGNlcHRpb24uXG4gICAgICAgICAgICAgICAgICBpZiAoaXNNZXRhZGF0YUVycm9yKGUpICYmIGV4cHJlc3Npb24uZmlsZU5hbWUgIT0gbnVsbCAmJlxuICAgICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb24ubGluZSAhPSBudWxsICYmIGV4cHJlc3Npb24uY2hhcmFjdGVyICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZS5wb3NpdGlvbiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICBmaWxlTmFtZTogZXhwcmVzc2lvbi5maWxlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICBsaW5lOiBleHByZXNzaW9uLmxpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBleHByZXNzaW9uLmNoYXJhY3RlclxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNhc2UgJ2NsYXNzJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICAgICAgICAgICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgICAgICAgICAgIHJldHVybiBjb250ZXh0O1xuICAgICAgICAgICAgICBjYXNlICduZXcnOlxuICAgICAgICAgICAgICBjYXNlICdjYWxsJzpcbiAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgaWYgdGhlIGZ1bmN0aW9uIGlzIGEgYnVpbHQtaW4gY29udmVyc2lvblxuICAgICAgICAgICAgICAgIHN0YXRpY1N5bWJvbCA9IHNpbXBsaWZ5SW5Db250ZXh0KFxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LCBleHByZXNzaW9uWydleHByZXNzaW9uJ10sIGRlcHRoICsgMSwgLyogcmVmZXJlbmNlcyAqLyAwKTtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdGljU3ltYm9sIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoc3RhdGljU3ltYm9sID09PSBzZWxmLmluamVjdGlvblRva2VuIHx8IHN0YXRpY1N5bWJvbCA9PT0gc2VsZi5vcGFxdWVUb2tlbikge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBzb21lYm9keSBjYWxscyBuZXcgSW5qZWN0aW9uVG9rZW4sIGRvbid0IGNyZWF0ZSBhbiBJbmplY3Rpb25Ub2tlbixcbiAgICAgICAgICAgICAgICAgICAgLy8gYnV0IHJhdGhlciByZXR1cm4gdGhlIHN5bWJvbCB0byB3aGljaCB0aGUgSW5qZWN0aW9uVG9rZW4gaXMgYXNzaWduZWQgdG8uXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gT3BhcXVlVG9rZW4gaXMgc3VwcG9ydGVkIHRvbyBhcyBpdCBpcyByZXF1aXJlZCBieSB0aGUgbGFuZ3VhZ2Ugc2VydmljZSB0b1xuICAgICAgICAgICAgICAgICAgICAvLyBzdXBwb3J0IHY0IGFuZCBwcmlvciB2ZXJzaW9ucyBvZiBBbmd1bGFyLlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFyZ0V4cHJlc3Npb25zOiBhbnlbXSA9IGV4cHJlc3Npb25bJ2FyZ3VtZW50cyddIHx8IFtdO1xuICAgICAgICAgICAgICAgICAgbGV0IGNvbnZlcnRlciA9IHNlbGYuY29udmVyc2lvbk1hcC5nZXQoc3RhdGljU3ltYm9sKTtcbiAgICAgICAgICAgICAgICAgIGlmIChjb252ZXJ0ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXJncyA9IGFyZ0V4cHJlc3Npb25zLm1hcChhcmcgPT4gc2ltcGxpZnlOZXN0ZWQoY29udGV4dCwgYXJnKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGFyZyA9PiBzaG91bGRJZ25vcmUoYXJnKSA/IHVuZGVmaW5lZCA6IGFyZyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb252ZXJ0ZXIoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgaWYgdGhlIGZ1bmN0aW9uIGlzIG9uZSB3ZSBjYW4gc2ltcGxpZnkuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldEZ1bmN0aW9uID0gcmVzb2x2ZVJlZmVyZW5jZVZhbHVlKHN0YXRpY1N5bWJvbCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeUNhbGwoXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0aWNTeW1ib2wsIHRhcmdldEZ1bmN0aW9uLCBhcmdFeHByZXNzaW9ucywgZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIElHTk9SRTtcbiAgICAgICAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgICAgICAgIGxldCBtZXNzYWdlID0gZXhwcmVzc2lvbi5tZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChleHByZXNzaW9uWydsaW5lJ10gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgc2VsZi5lcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dDogZXhwcmVzc2lvbi5jb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlTmFtZTogZXhwcmVzc2lvblsnZmlsZU5hbWUnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZTogZXhwcmVzc2lvblsnbGluZSddLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW46IGV4cHJlc3Npb25bJ2NoYXJhY3RlciddXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgc2VsZi5lcnJvcih7bWVzc2FnZSwgY29udGV4dDogZXhwcmVzc2lvbi5jb250ZXh0fSwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBJR05PUkU7XG4gICAgICAgICAgICAgIGNhc2UgJ2lnbm9yZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cHJlc3Npb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG1hcFN0cmluZ01hcChleHByZXNzaW9uLCAodmFsdWUsIG5hbWUpID0+IHtcbiAgICAgICAgICAgIGlmIChSRUZFUkVOQ0VfU0VULmhhcyhuYW1lKSkge1xuICAgICAgICAgICAgICBpZiAobmFtZSA9PT0gVVNFX1ZBTFVFICYmIFBST1ZJREUgaW4gZXhwcmVzc2lvbikge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSBwcm92aWRlciBleHByZXNzaW9uLCBjaGVjayBmb3Igc3BlY2lhbCB0b2tlbnMgdGhhdCBuZWVkIHRoZSB2YWx1ZVxuICAgICAgICAgICAgICAgIC8vIGR1cmluZyBhbmFseXNpcy5cbiAgICAgICAgICAgICAgICBjb25zdCBwcm92aWRlID0gc2ltcGxpZnkoZXhwcmVzc2lvbi5wcm92aWRlKTtcbiAgICAgICAgICAgICAgICBpZiAocHJvdmlkZSA9PT0gc2VsZi5ST1VURVMgfHwgcHJvdmlkZSA9PSBzZWxmLkFOQUxZWkVfRk9SX0VOVFJZX0NPTVBPTkVOVFMpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeUxhemlseSh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc2ltcGxpZnkodmFsdWUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBJR05PUkU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzaW1wbGlmeSh2YWx1ZSk7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDogYW55O1xuICAgIHRyeSB7XG4gICAgICByZXN1bHQgPSBzaW1wbGlmeUluQ29udGV4dChjb250ZXh0LCB2YWx1ZSwgMCwgbGF6eSA/IDEgOiAwKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAodGhpcy5lcnJvclJlY29yZGVyKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoZSwgY29udGV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBmb3JtYXRNZXRhZGF0YUVycm9yKGUsIGNvbnRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoc2hvdWxkSWdub3JlKHJlc3VsdCkpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwcml2YXRlIGdldFR5cGVNZXRhZGF0YSh0eXBlOiBTdGF0aWNTeW1ib2wpOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gICAgY29uc3QgcmVzb2x2ZWRTeW1ib2wgPSB0aGlzLnN5bWJvbFJlc29sdmVyLnJlc29sdmVTeW1ib2wodHlwZSk7XG4gICAgcmV0dXJuIHJlc29sdmVkU3ltYm9sICYmIHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhID8gcmVzb2x2ZWRTeW1ib2wubWV0YWRhdGEgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtfX3N5bWJvbGljOiAnY2xhc3MnfTtcbiAgfVxuXG4gIHByaXZhdGUgcmVwb3J0RXJyb3IoZXJyb3I6IEVycm9yLCBjb250ZXh0OiBTdGF0aWNTeW1ib2wsIHBhdGg/OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5lcnJvclJlY29yZGVyKSB7XG4gICAgICB0aGlzLmVycm9yUmVjb3JkZXIoXG4gICAgICAgICAgZm9ybWF0TWV0YWRhdGFFcnJvcihlcnJvciwgY29udGV4dCksIChjb250ZXh0ICYmIGNvbnRleHQuZmlsZVBhdGgpIHx8IHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGVycm9yKFxuICAgICAge21lc3NhZ2UsIHN1bW1hcnksIGFkdmlzZSwgcG9zaXRpb24sIGNvbnRleHQsIHZhbHVlLCBzeW1ib2wsIGNoYWlufToge1xuICAgICAgICBtZXNzYWdlOiBzdHJpbmcsXG4gICAgICAgIHN1bW1hcnk/OiBzdHJpbmcsXG4gICAgICAgIGFkdmlzZT86IHN0cmluZyxcbiAgICAgICAgcG9zaXRpb24/OiBQb3NpdGlvbixcbiAgICAgICAgY29udGV4dD86IGFueSxcbiAgICAgICAgdmFsdWU/OiBhbnksXG4gICAgICAgIHN5bWJvbD86IFN0YXRpY1N5bWJvbCxcbiAgICAgICAgY2hhaW4/OiBNZXRhZGF0YU1lc3NhZ2VDaGFpblxuICAgICAgfSxcbiAgICAgIHJlcG9ydGluZ0NvbnRleHQ6IFN0YXRpY1N5bWJvbCkge1xuICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgIG1ldGFkYXRhRXJyb3IobWVzc2FnZSwgc3VtbWFyeSwgYWR2aXNlLCBwb3NpdGlvbiwgc3ltYm9sLCBjb250ZXh0LCBjaGFpbiksXG4gICAgICAgIHJlcG9ydGluZ0NvbnRleHQpO1xuICB9XG59XG5cbmludGVyZmFjZSBQb3NpdGlvbiB7XG4gIGZpbGVOYW1lOiBzdHJpbmc7XG4gIGxpbmU6IG51bWJlcjtcbiAgY29sdW1uOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBNZXRhZGF0YU1lc3NhZ2VDaGFpbiB7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgc3VtbWFyeT86IHN0cmluZztcbiAgcG9zaXRpb24/OiBQb3NpdGlvbjtcbiAgY29udGV4dD86IGFueTtcbiAgc3ltYm9sPzogU3RhdGljU3ltYm9sO1xuICBuZXh0PzogTWV0YWRhdGFNZXNzYWdlQ2hhaW47XG59XG5cbnR5cGUgTWV0YWRhdGFFcnJvciA9IEVycm9yICYge1xuICBwb3NpdGlvbj86IFBvc2l0aW9uO1xuICBhZHZpc2U/OiBzdHJpbmc7XG4gIHN1bW1hcnk/OiBzdHJpbmc7XG4gIGNvbnRleHQ/OiBhbnk7XG4gIHN5bWJvbD86IFN0YXRpY1N5bWJvbDtcbiAgY2hhaW4/OiBNZXRhZGF0YU1lc3NhZ2VDaGFpbjtcbn07XG5cbmNvbnN0IE1FVEFEQVRBX0VSUk9SID0gJ25nTWV0YWRhdGFFcnJvcic7XG5cbmZ1bmN0aW9uIG1ldGFkYXRhRXJyb3IoXG4gICAgbWVzc2FnZTogc3RyaW5nLCBzdW1tYXJ5Pzogc3RyaW5nLCBhZHZpc2U/OiBzdHJpbmcsIHBvc2l0aW9uPzogUG9zaXRpb24sIHN5bWJvbD86IFN0YXRpY1N5bWJvbCxcbiAgICBjb250ZXh0PzogYW55LCBjaGFpbj86IE1ldGFkYXRhTWVzc2FnZUNoYWluKTogTWV0YWRhdGFFcnJvciB7XG4gIGNvbnN0IGVycm9yID0gc3ludGF4RXJyb3IobWVzc2FnZSkgYXMgTWV0YWRhdGFFcnJvcjtcbiAgKGVycm9yIGFzIGFueSlbTUVUQURBVEFfRVJST1JdID0gdHJ1ZTtcbiAgaWYgKGFkdmlzZSkgZXJyb3IuYWR2aXNlID0gYWR2aXNlO1xuICBpZiAocG9zaXRpb24pIGVycm9yLnBvc2l0aW9uID0gcG9zaXRpb247XG4gIGlmIChzdW1tYXJ5KSBlcnJvci5zdW1tYXJ5ID0gc3VtbWFyeTtcbiAgaWYgKGNvbnRleHQpIGVycm9yLmNvbnRleHQgPSBjb250ZXh0O1xuICBpZiAoY2hhaW4pIGVycm9yLmNoYWluID0gY2hhaW47XG4gIGlmIChzeW1ib2wpIGVycm9yLnN5bWJvbCA9IHN5bWJvbDtcbiAgcmV0dXJuIGVycm9yO1xufVxuXG5mdW5jdGlvbiBpc01ldGFkYXRhRXJyb3IoZXJyb3I6IEVycm9yKTogZXJyb3IgaXMgTWV0YWRhdGFFcnJvciB7XG4gIHJldHVybiAhIShlcnJvciBhcyBhbnkpW01FVEFEQVRBX0VSUk9SXTtcbn1cblxuY29uc3QgUkVGRVJFTkNFX1RPX05PTkVYUE9SVEVEX0NMQVNTID0gJ1JlZmVyZW5jZSB0byBub24tZXhwb3J0ZWQgY2xhc3MnO1xuY29uc3QgVkFSSUFCTEVfTk9UX0lOSVRJQUxJWkVEID0gJ1ZhcmlhYmxlIG5vdCBpbml0aWFsaXplZCc7XG5jb25zdCBERVNUUlVDVFVSRV9OT1RfU1VQUE9SVEVEID0gJ0Rlc3RydWN0dXJpbmcgbm90IHN1cHBvcnRlZCc7XG5jb25zdCBDT1VMRF9OT1RfUkVTT0xWRV9UWVBFID0gJ0NvdWxkIG5vdCByZXNvbHZlIHR5cGUnO1xuY29uc3QgRlVOQ1RJT05fQ0FMTF9OT1RfU1VQUE9SVEVEID0gJ0Z1bmN0aW9uIGNhbGwgbm90IHN1cHBvcnRlZCc7XG5jb25zdCBSRUZFUkVOQ0VfVE9fTE9DQUxfU1lNQk9MID0gJ1JlZmVyZW5jZSB0byBhIGxvY2FsIHN5bWJvbCc7XG5jb25zdCBMQU1CREFfTk9UX1NVUFBPUlRFRCA9ICdMYW1iZGEgbm90IHN1cHBvcnRlZCc7XG5cbmZ1bmN0aW9uIGV4cGFuZGVkTWVzc2FnZShtZXNzYWdlOiBzdHJpbmcsIGNvbnRleHQ6IGFueSk6IHN0cmluZyB7XG4gIHN3aXRjaCAobWVzc2FnZSkge1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX05PTkVYUE9SVEVEX0NMQVNTOlxuICAgICAgaWYgKGNvbnRleHQgJiYgY29udGV4dC5jbGFzc05hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBSZWZlcmVuY2VzIHRvIGEgbm9uLWV4cG9ydGVkIGNsYXNzIGFyZSBub3Qgc3VwcG9ydGVkIGluIGRlY29yYXRvcnMgYnV0ICR7Y29udGV4dC5jbGFzc05hbWV9IHdhcyByZWZlcmVuY2VkLmA7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIFZBUklBQkxFX05PVF9JTklUSUFMSVpFRDpcbiAgICAgIHJldHVybiAnT25seSBpbml0aWFsaXplZCB2YXJpYWJsZXMgYW5kIGNvbnN0YW50cyBjYW4gYmUgcmVmZXJlbmNlZCBpbiBkZWNvcmF0b3JzIGJlY2F1c2UgdGhlIHZhbHVlIG9mIHRoaXMgdmFyaWFibGUgaXMgbmVlZGVkIGJ5IHRoZSB0ZW1wbGF0ZSBjb21waWxlcic7XG4gICAgY2FzZSBERVNUUlVDVFVSRV9OT1RfU1VQUE9SVEVEOlxuICAgICAgcmV0dXJuICdSZWZlcmVuY2luZyBhbiBleHBvcnRlZCBkZXN0cnVjdHVyZWQgdmFyaWFibGUgb3IgY29uc3RhbnQgaXMgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzIGFuZCB0aGlzIHZhbHVlIGlzIG5lZWRlZCBieSB0aGUgdGVtcGxhdGUgY29tcGlsZXInO1xuICAgIGNhc2UgQ09VTERfTk9UX1JFU09MVkVfVFlQRTpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQudHlwZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBDb3VsZCBub3QgcmVzb2x2ZSB0eXBlICR7Y29udGV4dC50eXBlTmFtZX1gO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBGVU5DVElPTl9DQUxMX05PVF9TVVBQT1JURUQ6XG4gICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0Lm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBGdW5jdGlvbiBjYWxscyBhcmUgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzIGJ1dCAnJHtjb250ZXh0Lm5hbWV9JyB3YXMgY2FsbGVkYDtcbiAgICAgIH1cbiAgICAgIHJldHVybiAnRnVuY3Rpb24gY2FsbHMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gZGVjb3JhdG9ycyc7XG4gICAgY2FzZSBSRUZFUkVOQ0VfVE9fTE9DQUxfU1lNQk9MOlxuICAgICAgaWYgKGNvbnRleHQgJiYgY29udGV4dC5uYW1lKSB7XG4gICAgICAgIHJldHVybiBgUmVmZXJlbmNlIHRvIGEgbG9jYWwgKG5vbi1leHBvcnRlZCkgc3ltYm9scyBhcmUgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzIGJ1dCAnJHtjb250ZXh0Lm5hbWV9JyB3YXMgcmVmZXJlbmNlZGA7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIExBTUJEQV9OT1RfU1VQUE9SVEVEOlxuICAgICAgcmV0dXJuIGBGdW5jdGlvbiBleHByZXNzaW9ucyBhcmUgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzYDtcbiAgfVxuICByZXR1cm4gbWVzc2FnZTtcbn1cblxuZnVuY3Rpb24gbWVzc2FnZUFkdmlzZShtZXNzYWdlOiBzdHJpbmcsIGNvbnRleHQ6IGFueSk6IHN0cmluZ3x1bmRlZmluZWQge1xuICBzd2l0Y2ggKG1lc3NhZ2UpIHtcbiAgICBjYXNlIFJFRkVSRU5DRV9UT19OT05FWFBPUlRFRF9DTEFTUzpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQuY2xhc3NOYW1lKSB7XG4gICAgICAgIHJldHVybiBgQ29uc2lkZXIgZXhwb3J0aW5nICcke2NvbnRleHQuY2xhc3NOYW1lfSdgO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBERVNUUlVDVFVSRV9OT1RfU1VQUE9SVEVEOlxuICAgICAgcmV0dXJuICdDb25zaWRlciBzaW1wbGlmeWluZyB0byBhdm9pZCBkZXN0cnVjdHVyaW5nJztcbiAgICBjYXNlIFJFRkVSRU5DRV9UT19MT0NBTF9TWU1CT0w6XG4gICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0Lm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBDb25zaWRlciBleHBvcnRpbmcgJyR7Y29udGV4dC5uYW1lfSdgO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBMQU1CREFfTk9UX1NVUFBPUlRFRDpcbiAgICAgIHJldHVybiBgQ29uc2lkZXIgY2hhbmdpbmcgdGhlIGZ1bmN0aW9uIGV4cHJlc3Npb24gaW50byBhbiBleHBvcnRlZCBmdW5jdGlvbmA7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZXJyb3JTdW1tYXJ5KGVycm9yOiBNZXRhZGF0YUVycm9yKTogc3RyaW5nIHtcbiAgaWYgKGVycm9yLnN1bW1hcnkpIHtcbiAgICByZXR1cm4gZXJyb3Iuc3VtbWFyeTtcbiAgfVxuICBzd2l0Y2ggKGVycm9yLm1lc3NhZ2UpIHtcbiAgICBjYXNlIFJFRkVSRU5DRV9UT19OT05FWFBPUlRFRF9DTEFTUzpcbiAgICAgIGlmIChlcnJvci5jb250ZXh0ICYmIGVycm9yLmNvbnRleHQuY2xhc3NOYW1lKSB7XG4gICAgICAgIHJldHVybiBgcmVmZXJlbmNlcyBub24tZXhwb3J0ZWQgY2xhc3MgJHtlcnJvci5jb250ZXh0LmNsYXNzTmFtZX1gO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBWQVJJQUJMRV9OT1RfSU5JVElBTElaRUQ6XG4gICAgICByZXR1cm4gJ2lzIG5vdCBpbml0aWFsaXplZCc7XG4gICAgY2FzZSBERVNUUlVDVFVSRV9OT1RfU1VQUE9SVEVEOlxuICAgICAgcmV0dXJuICdpcyBhIGRlc3RydWN0dXJlZCB2YXJpYWJsZSc7XG4gICAgY2FzZSBDT1VMRF9OT1RfUkVTT0xWRV9UWVBFOlxuICAgICAgcmV0dXJuICdjb3VsZCBub3QgYmUgcmVzb2x2ZWQnO1xuICAgIGNhc2UgRlVOQ1RJT05fQ0FMTF9OT1RfU1VQUE9SVEVEOlxuICAgICAgaWYgKGVycm9yLmNvbnRleHQgJiYgZXJyb3IuY29udGV4dC5uYW1lKSB7XG4gICAgICAgIHJldHVybiBgY2FsbHMgJyR7ZXJyb3IuY29udGV4dC5uYW1lfSdgO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGBjYWxscyBhIGZ1bmN0aW9uYDtcbiAgICBjYXNlIFJFRkVSRU5DRV9UT19MT0NBTF9TWU1CT0w6XG4gICAgICBpZiAoZXJyb3IuY29udGV4dCAmJiBlcnJvci5jb250ZXh0Lm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGByZWZlcmVuY2VzIGxvY2FsIHZhcmlhYmxlICR7ZXJyb3IuY29udGV4dC5uYW1lfWA7XG4gICAgICB9XG4gICAgICByZXR1cm4gYHJlZmVyZW5jZXMgYSBsb2NhbCB2YXJpYWJsZWA7XG4gIH1cbiAgcmV0dXJuICdjb250YWlucyB0aGUgZXJyb3InO1xufVxuXG5mdW5jdGlvbiBtYXBTdHJpbmdNYXAoaW5wdXQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LCB0cmFuc2Zvcm06ICh2YWx1ZTogYW55LCBrZXk6IHN0cmluZykgPT4gYW55KTpcbiAgICB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gIGlmICghaW5wdXQpIHJldHVybiB7fTtcbiAgY29uc3QgcmVzdWx0OiB7W2tleTogc3RyaW5nXTogYW55fSA9IHt9O1xuICBPYmplY3Qua2V5cyhpbnB1dCkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSB0cmFuc2Zvcm0oaW5wdXRba2V5XSwga2V5KTtcbiAgICBpZiAoIXNob3VsZElnbm9yZSh2YWx1ZSkpIHtcbiAgICAgIGlmIChISURERU5fS0VZLnRlc3Qoa2V5KSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVzdWx0LCBrZXksIHtlbnVtZXJhYmxlOiBmYWxzZSwgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogdmFsdWV9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gaXNQcmltaXRpdmUobzogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBvID09PSBudWxsIHx8ICh0eXBlb2YgbyAhPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgbyAhPT0gJ29iamVjdCcpO1xufVxuXG5pbnRlcmZhY2UgQmluZGluZ1Njb3BlQnVpbGRlciB7XG4gIGRlZmluZShuYW1lOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBCaW5kaW5nU2NvcGVCdWlsZGVyO1xuICBkb25lKCk6IEJpbmRpbmdTY29wZTtcbn1cblxuYWJzdHJhY3QgY2xhc3MgQmluZGluZ1Njb3BlIHtcbiAgYWJzdHJhY3QgcmVzb2x2ZShuYW1lOiBzdHJpbmcpOiBhbnk7XG4gIHB1YmxpYyBzdGF0aWMgbWlzc2luZyA9IHt9O1xuICBwdWJsaWMgc3RhdGljIGVtcHR5OiBCaW5kaW5nU2NvcGUgPSB7cmVzb2x2ZTogbmFtZSA9PiBCaW5kaW5nU2NvcGUubWlzc2luZ307XG5cbiAgcHVibGljIHN0YXRpYyBidWlsZCgpOiBCaW5kaW5nU2NvcGVCdWlsZGVyIHtcbiAgICBjb25zdCBjdXJyZW50ID0gbmV3IE1hcDxzdHJpbmcsIGFueT4oKTtcbiAgICByZXR1cm4ge1xuICAgICAgZGVmaW5lOiBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgICAgICBjdXJyZW50LnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSxcbiAgICAgIGRvbmU6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gY3VycmVudC5zaXplID4gMCA/IG5ldyBQb3B1bGF0ZWRTY29wZShjdXJyZW50KSA6IEJpbmRpbmdTY29wZS5lbXB0eTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG59XG5cbmNsYXNzIFBvcHVsYXRlZFNjb3BlIGV4dGVuZHMgQmluZGluZ1Njb3BlIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiaW5kaW5nczogTWFwPHN0cmluZywgYW55PikgeyBzdXBlcigpOyB9XG5cbiAgcmVzb2x2ZShuYW1lOiBzdHJpbmcpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdzLmhhcyhuYW1lKSA/IHRoaXMuYmluZGluZ3MuZ2V0KG5hbWUpIDogQmluZGluZ1Njb3BlLm1pc3Npbmc7XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9ybWF0TWV0YWRhdGFNZXNzYWdlQ2hhaW4oXG4gICAgY2hhaW46IE1ldGFkYXRhTWVzc2FnZUNoYWluLCBhZHZpc2U6IHN0cmluZyB8IHVuZGVmaW5lZCk6IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbiB7XG4gIGNvbnN0IGV4cGFuZGVkID0gZXhwYW5kZWRNZXNzYWdlKGNoYWluLm1lc3NhZ2UsIGNoYWluLmNvbnRleHQpO1xuICBjb25zdCBuZXN0aW5nID0gY2hhaW4uc3ltYm9sID8gYCBpbiAnJHtjaGFpbi5zeW1ib2wubmFtZX0nYCA6ICcnO1xuICBjb25zdCBtZXNzYWdlID0gYCR7ZXhwYW5kZWR9JHtuZXN0aW5nfWA7XG4gIGNvbnN0IHBvc2l0aW9uID0gY2hhaW4ucG9zaXRpb247XG4gIGNvbnN0IG5leHQ6IEZvcm1hdHRlZE1lc3NhZ2VDaGFpbnx1bmRlZmluZWQgPSBjaGFpbi5uZXh0ID9cbiAgICAgIGZvcm1hdE1ldGFkYXRhTWVzc2FnZUNoYWluKGNoYWluLm5leHQsIGFkdmlzZSkgOlxuICAgICAgYWR2aXNlID8ge21lc3NhZ2U6IGFkdmlzZX0gOiB1bmRlZmluZWQ7XG4gIHJldHVybiB7bWVzc2FnZSwgcG9zaXRpb24sIG5leHR9O1xufVxuXG5mdW5jdGlvbiBmb3JtYXRNZXRhZGF0YUVycm9yKGU6IEVycm9yLCBjb250ZXh0OiBTdGF0aWNTeW1ib2wpOiBFcnJvciB7XG4gIGlmIChpc01ldGFkYXRhRXJyb3IoZSkpIHtcbiAgICAvLyBQcm9kdWNlIGEgZm9ybWF0dGVkIHZlcnNpb24gb2YgdGhlIGFuZCBsZWF2aW5nIGVub3VnaCBpbmZvcm1hdGlvbiBpbiB0aGUgb3JpZ2luYWwgZXJyb3JcbiAgICAvLyB0byByZWNvdmVyIHRoZSBmb3JtYXR0aW5nIGluZm9ybWF0aW9uIHRvIGV2ZW50dWFsbHkgcHJvZHVjZSBhIGRpYWdub3N0aWMgZXJyb3IgbWVzc2FnZS5cbiAgICBjb25zdCBwb3NpdGlvbiA9IGUucG9zaXRpb247XG4gICAgY29uc3QgY2hhaW46IE1ldGFkYXRhTWVzc2FnZUNoYWluID0ge1xuICAgICAgbWVzc2FnZTogYEVycm9yIGR1cmluZyB0ZW1wbGF0ZSBjb21waWxlIG9mICcke2NvbnRleHQubmFtZX0nYCxcbiAgICAgIHBvc2l0aW9uOiBwb3NpdGlvbixcbiAgICAgIG5leHQ6IHttZXNzYWdlOiBlLm1lc3NhZ2UsIG5leHQ6IGUuY2hhaW4sIGNvbnRleHQ6IGUuY29udGV4dCwgc3ltYm9sOiBlLnN5bWJvbH1cbiAgICB9O1xuICAgIGNvbnN0IGFkdmlzZSA9IGUuYWR2aXNlIHx8IG1lc3NhZ2VBZHZpc2UoZS5tZXNzYWdlLCBlLmNvbnRleHQpO1xuICAgIHJldHVybiBmb3JtYXR0ZWRFcnJvcihmb3JtYXRNZXRhZGF0YU1lc3NhZ2VDaGFpbihjaGFpbiwgYWR2aXNlKSk7XG4gIH1cbiAgcmV0dXJuIGU7XG59XG4iXX0=