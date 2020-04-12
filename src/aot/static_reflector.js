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
                            /* summary */ undefined, "Please add a " + requiredAnnotationTypes.map(function (type) { return type.ngMetadataName; })
                                .join(' or ') + " decorator to the class"), type), type);
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
                    if (Array.isArray(expression)) {
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
        return { message: message, position: position, next: next ? [next] : undefined };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3JlZmxlY3Rvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9hb3Qvc3RhdGljX3JlZmxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCwyRUFBdUQ7SUFFdkQsbURBQWlXO0lBR2pXLG1EQUFvQztJQUVwQyw2RUFBd0U7SUFDeEUseUVBQTZDO0lBRzdDLElBQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQztJQUNyQyxJQUFNLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQztJQUV6QyxJQUFNLFVBQVUsR0FBRyxVQUFVLENBQUM7SUFFOUIsSUFBTSxNQUFNLEdBQUc7UUFDYixVQUFVLEVBQUUsUUFBUTtLQUNyQixDQUFDO0lBRUYsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDO0lBQzdCLElBQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQztJQUMxQixJQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFNBQVMsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLElBQU0saUJBQWlCLEdBQUcsV0FBVyxDQUFDO0lBQ3RDLElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQztJQUV2QixTQUFTLFlBQVksQ0FBQyxLQUFVO1FBQzlCLE9BQU8sS0FBSyxJQUFJLEtBQUssQ0FBQyxVQUFVLElBQUksUUFBUSxDQUFDO0lBQy9DLENBQUM7SUFFRDs7O09BR0c7SUFDSDtRQW9CRSx5QkFDWSxlQUE4QyxFQUM5QyxjQUFvQyxFQUM1QyxvQkFBd0UsRUFDeEUsc0JBQXdFLEVBQ2hFLGFBQXVEO1lBTG5FLGlCQW1CQztZQWhCRyxxQ0FBQSxFQUFBLHlCQUF3RTtZQUN4RSx1Q0FBQSxFQUFBLDJCQUF3RTtZQUhoRSxvQkFBZSxHQUFmLGVBQWUsQ0FBK0I7WUFDOUMsbUJBQWMsR0FBZCxjQUFjLENBQXNCO1lBR3BDLGtCQUFhLEdBQWIsYUFBYSxDQUEwQztZQXhCM0Qsb0JBQWUsR0FBRyxJQUFJLEdBQUcsRUFBdUIsQ0FBQztZQUNqRCwyQkFBc0IsR0FBRyxJQUFJLEdBQUcsRUFBdUIsQ0FBQztZQUN4RCxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUF3QyxDQUFDO1lBQ2hFLG1CQUFjLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7WUFDaEQsZ0JBQVcsR0FBRyxJQUFJLEdBQUcsRUFBMEMsQ0FBQztZQUNoRSxnQkFBVyxHQUFHLElBQUksR0FBRyxFQUEwQixDQUFDO1lBQ2hELGtCQUFhLEdBQUcsSUFBSSxHQUFHLEVBQTZELENBQUM7WUFDckYsK0JBQTBCLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7WUFTN0QsNENBQXVDLEdBQzNDLElBQUksR0FBRyxFQUE4QyxDQUFDO1lBUXhELElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQy9CLG9CQUFvQixDQUFDLE9BQU8sQ0FDeEIsVUFBQyxFQUFFLElBQUssT0FBQSxLQUFJLENBQUMsK0JBQStCLENBQ3hDLEtBQUksQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQURoRCxDQUNnRCxDQUFDLENBQUM7WUFDOUQsc0JBQXNCLENBQUMsT0FBTyxDQUMxQixVQUFDLEVBQUUsSUFBSyxPQUFBLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFJLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBekUsQ0FBeUUsQ0FBQyxDQUFDO1lBQ3ZGLElBQUksQ0FBQyx1Q0FBdUMsQ0FBQyxHQUFHLENBQzVDLHFDQUFrQixDQUFDLFNBQVMsRUFBRSxDQUFDLHNCQUFlLEVBQUUsc0JBQWUsQ0FBQyxDQUFDLENBQUM7WUFDdEUsSUFBSSxDQUFDLHVDQUF1QyxDQUFDLEdBQUcsQ0FBQyxxQ0FBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxpQkFBVSxDQUFDLENBQUMsQ0FBQztZQUN4RixJQUFJLENBQUMsdUNBQXVDLENBQUMsR0FBRyxDQUFDLHFDQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFDLHFCQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ2hHLElBQUksQ0FBQyx1Q0FBdUMsQ0FBQyxHQUFHLENBQzVDLHFDQUFrQixDQUFDLFVBQVUsRUFDN0IsQ0FBQyx1QkFBZ0IsRUFBRSxpQkFBVSxFQUFFLHNCQUFlLEVBQUUsc0JBQWUsRUFBRSxxQkFBYyxDQUFDLENBQUMsQ0FBQztRQUN4RixDQUFDO1FBRUQsNENBQWtCLEdBQWxCLFVBQW1CLFVBQXdCO1lBQ3pDLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM1RCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzNELENBQUM7UUFFRDs7O1dBR0c7UUFDSCwyQ0FBaUIsR0FBakIsVUFBa0IsT0FBdUI7OztnQkFDdkMsS0FBcUIsSUFBQSxZQUFBLGlCQUFBLE9BQU8sQ0FBQSxnQ0FBQSxxREFBRTtvQkFBekIsSUFBTSxNQUFNLG9CQUFBO29CQUNmLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNwQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUMzQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDbEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ25DLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNoQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDaEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7aUJBQ25DOzs7Ozs7Ozs7UUFDSCxDQUFDO1FBRUQsa0RBQXdCLEdBQXhCLFVBQXlCLEdBQXdCLEVBQUUsY0FBdUI7WUFDeEUsSUFBSSxHQUFHLEdBQXFCLFNBQVMsQ0FBQztZQUN0QyxJQUFJLENBQUMsY0FBYyxFQUFFO2dCQUNuQixHQUFHLEdBQU0sR0FBRyxDQUFDLFVBQVUsU0FBSSxHQUFHLENBQUMsSUFBTSxDQUFDO2dCQUN0QyxJQUFNLG1CQUFpQixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ25FLElBQUksbUJBQWlCO29CQUFFLE9BQU8sbUJBQWlCLENBQUM7YUFDakQ7WUFDRCxJQUFNLFNBQVMsR0FDWCxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxVQUFZLEVBQUUsR0FBRyxDQUFDLElBQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztZQUN4RixJQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNoRSxJQUFJLENBQUMsY0FBYyxFQUFFO2dCQUNuQixJQUFJLENBQUMsY0FBYyxDQUFDLDJCQUEyQixDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLFVBQVksQ0FBQyxDQUFDO2dCQUN0RixJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsRUFBRSxTQUFTLENBQUMsQ0FBQzthQUNsRTtZQUNELElBQUksR0FBRyxFQUFFO2dCQUNQLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLGlCQUFpQixDQUFDLENBQUM7YUFDN0Q7WUFDRCxPQUFPLGlCQUFpQixDQUFDO1FBQzNCLENBQUM7UUFFRCx5Q0FBZSxHQUFmLFVBQWdCLFNBQWlCLEVBQUUsSUFBWSxFQUFFLGNBQXVCO1lBQ3RFLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUM3QixJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBRUQsNENBQWtCLEdBQWxCLFVBQW1CLFNBQWlCLEVBQUUsSUFBWSxFQUFFLGNBQXVCO1lBQTNFLGlCQUdDO1lBRkMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FDdEMsY0FBTSxPQUFBLEtBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxjQUFjLENBQUMsRUFBckQsQ0FBcUQsQ0FBQyxDQUFDO1FBQ25FLENBQUM7UUFFRCwrQ0FBcUIsR0FBckIsVUFBc0IsTUFBb0I7WUFDeEMsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDakUsSUFBSSxjQUFjLEVBQUU7Z0JBQ2xCLElBQUksZ0JBQWdCLEdBQUcsY0FBYyxDQUFDLFFBQVEsQ0FBQztnQkFDL0MsSUFBSSxnQkFBZ0IsSUFBSSxnQkFBZ0IsQ0FBQyxVQUFVLEtBQUssVUFBVSxFQUFFO29CQUNsRSxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUM7aUJBQzVDO2dCQUNELElBQUksZ0JBQWdCLFlBQVksNEJBQVksRUFBRTtvQkFDNUMsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2lCQUM1RDthQUNGO1lBQ0QsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVNLHdDQUFjLEdBQXJCLFVBQXNCLElBQWtCO1lBQ3RDLElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUM1QyxJQUFJLENBQUMsYUFBYSxHQUFHLFVBQUMsS0FBVSxFQUFFLFFBQWlCLElBQU0sQ0FBQyxDQUFDO1lBQzNELElBQUk7Z0JBQ0YsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQy9CO29CQUFTO2dCQUNSLElBQUksQ0FBQyxhQUFhLEdBQUcsZ0JBQWdCLENBQUM7YUFDdkM7UUFDSCxDQUFDO1FBRU0scUNBQVcsR0FBbEIsVUFBbUIsSUFBa0I7WUFBckMsaUJBSUM7WUFIQyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQ3BCLElBQUksRUFBRSxVQUFDLElBQWtCLEVBQUUsVUFBZSxJQUFLLE9BQUEsS0FBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQS9CLENBQStCLEVBQzlFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUM1QixDQUFDO1FBRU0sNENBQWtCLEdBQXpCLFVBQTBCLElBQWtCO1lBQTVDLGlCQUlDO1lBSEMsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUNwQixJQUFJLEVBQUUsVUFBQyxJQUFrQixFQUFFLFVBQWUsSUFBSyxPQUFBLEtBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsRUFBckMsQ0FBcUMsRUFDcEYsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUVPLHNDQUFZLEdBQXBCLFVBQ0ksSUFBa0IsRUFBRSxRQUFzRCxFQUMxRSxlQUF5QztZQUMzQyxJQUFJLFdBQVcsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7Z0JBQ2hCLFdBQVcsR0FBRyxFQUFFLENBQUM7Z0JBQ2pCLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2pELElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO2dCQUM1RCxJQUFJLFVBQVUsRUFBRTtvQkFDZCxJQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQ3ZELFdBQVcsQ0FBQyxJQUFJLE9BQWhCLFdBQVcsbUJBQVMsaUJBQWlCLEdBQUU7aUJBQ3hDO2dCQUNELElBQUksZ0JBQWMsR0FBVSxFQUFFLENBQUM7Z0JBQy9CLElBQUksYUFBYSxDQUFDLFlBQVksQ0FBQyxFQUFFO29CQUMvQixnQkFBYyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7b0JBQzdELElBQUksZ0JBQWMsRUFBRTt3QkFDbEIsV0FBVyxDQUFDLElBQUksT0FBaEIsV0FBVyxtQkFBUyxnQkFBYyxHQUFFO3FCQUNyQztpQkFDRjtnQkFDRCxJQUFJLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7b0JBQ2hFLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtvQkFDM0QsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQ2hFLElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUU7d0JBQzNCLElBQU0sdUJBQXVCLEdBQ3pCLElBQUksQ0FBQyx1Q0FBdUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFhLENBQUcsQ0FBQzt3QkFDbkYsSUFBTSx5QkFBeUIsR0FBRyx1QkFBdUIsQ0FBQyxJQUFJLENBQzFELFVBQUMsWUFBWSxJQUFLLE9BQUEsZ0JBQWMsQ0FBQyxJQUFJLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxZQUFZLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUExQixDQUEwQixDQUFDLEVBQXRELENBQXNELENBQUMsQ0FBQzt3QkFDOUUsSUFBSSxDQUFDLHlCQUF5QixFQUFFOzRCQUM5QixJQUFJLENBQUMsV0FBVyxDQUNaLG1CQUFtQixDQUNmLGFBQWEsQ0FDVCxXQUFTLElBQUksQ0FBQyxJQUFJLFlBQU8sSUFBSSxDQUFDLFFBQVEsd0JBQ2xDLHFDQUFrQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBWSxDQUMzRCxtRUFBZ0U7NEJBQ3JELGFBQWEsQ0FBQyxTQUFTLEVBQUUsa0JBQ3JCLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxVQUFDLElBQUksSUFBSyxPQUFBLElBQUksQ0FBQyxjQUFjLEVBQW5CLENBQW1CLENBQUM7aUNBQ3JELElBQUksQ0FBQyxNQUFNLENBQUMsNEJBQXlCLENBQUMsRUFDbkQsSUFBSSxDQUFDLEVBQ1QsSUFBSSxDQUFDLENBQUM7eUJBQ1g7cUJBQ0Y7aUJBQ0Y7Z0JBQ0QsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLENBQUMsQ0FBQyxHQUFHLEVBQUwsQ0FBSyxDQUFDLENBQUMsQ0FBQzthQUM3RDtZQUNELE9BQU8sV0FBVyxDQUFDO1FBQ3JCLENBQUM7UUFFTSxzQ0FBWSxHQUFuQixVQUFvQixJQUFrQjtZQUF0QyxpQkE4QkM7WUE3QkMsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEQsSUFBSSxDQUFDLFlBQVksRUFBRTtnQkFDakIsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDakQsWUFBWSxHQUFHLEVBQUUsQ0FBQztnQkFDbEIsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7Z0JBQzVELElBQUksVUFBVSxFQUFFO29CQUNkLElBQU0sb0JBQWtCLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDekQsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBa0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLFVBQVU7d0JBQ2pELFlBQWMsQ0FBQyxVQUFVLENBQUMsR0FBRyxvQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDOUQsQ0FBQyxDQUFDLENBQUM7aUJBQ0o7Z0JBRUQsSUFBTSxTQUFPLEdBQUcsYUFBYSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFRO29CQUNwQyxJQUFNLFFBQVEsR0FBRyxTQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ25DLElBQU0sSUFBSSxHQUFXLFFBQVM7eUJBQ1osSUFBSSxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLFVBQVUsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksUUFBUSxFQUE1RCxDQUE0RCxDQUFDLENBQUM7b0JBQzFGLElBQU0sVUFBVSxHQUFVLEVBQUUsQ0FBQztvQkFDN0IsSUFBSSxZQUFjLENBQUMsUUFBUSxDQUFDLEVBQUU7d0JBQzVCLFVBQVUsQ0FBQyxJQUFJLE9BQWYsVUFBVSxtQkFBUyxZQUFjLENBQUMsUUFBUSxDQUFDLEdBQUU7cUJBQzlDO29CQUNELFlBQWMsQ0FBQyxRQUFRLENBQUMsR0FBRyxVQUFVLENBQUM7b0JBQ3RDLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRTt3QkFDOUIsVUFBVSxDQUFDLElBQUksT0FBZixVQUFVLG1CQUFTLEtBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFFO3FCQUM3RDtnQkFDSCxDQUFDLENBQUMsQ0FBQztnQkFDSCxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7YUFDNUM7WUFDRCxPQUFPLFlBQVksQ0FBQztRQUN0QixDQUFDO1FBRU0sb0NBQVUsR0FBakIsVUFBa0IsSUFBa0I7WUFBcEMsaUJBMENDO1lBekNDLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSw0QkFBWSxDQUFDLEVBQUU7Z0JBQ25DLElBQUksQ0FBQyxXQUFXLENBQ1osSUFBSSxLQUFLLENBQUMseUJBQXVCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlDQUE4QixDQUFDLEVBQ3BGLElBQUksQ0FBQyxDQUFDO2dCQUNWLE9BQU8sRUFBRSxDQUFDO2FBQ1g7WUFDRCxJQUFJO2dCQUNGLElBQUksWUFBVSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMvQyxJQUFJLENBQUMsWUFBVSxFQUFFO29CQUNmLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2pELElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO29CQUM1RCxJQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUNoRSxJQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUN0RCxJQUFJLFFBQVEsRUFBRTt3QkFDWixJQUFNLElBQUksR0FBVyxRQUFTLENBQUMsSUFBSSxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLGFBQWEsRUFBaEMsQ0FBZ0MsQ0FBQyxDQUFDO3dCQUMzRSxJQUFNLGlCQUFpQixHQUFVLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUM7d0JBQzFELElBQU0scUJBQW1CLEdBQVUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7d0JBQzFGLFlBQVUsR0FBRyxFQUFFLENBQUM7d0JBQ2hCLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxVQUFDLFlBQVksRUFBRSxLQUFLOzRCQUM1QyxJQUFNLFlBQVksR0FBVSxFQUFFLENBQUM7NEJBQy9CLElBQU0sU0FBUyxHQUFHLEtBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDOzRCQUN2RCxJQUFJLFNBQVM7Z0NBQUUsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzs0QkFDNUMsSUFBTSxVQUFVLEdBQUcscUJBQW1CLENBQUMsQ0FBQyxDQUFDLHFCQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7NEJBQzNFLElBQUksVUFBVSxFQUFFO2dDQUNkLFlBQVksQ0FBQyxJQUFJLE9BQWpCLFlBQVksbUJBQVMsVUFBVSxHQUFFOzZCQUNsQzs0QkFDRCxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO3dCQUNsQyxDQUFDLENBQUMsQ0FBQztxQkFDSjt5QkFBTSxJQUFJLFVBQVUsRUFBRTt3QkFDckIsWUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7cUJBQzFDO29CQUNELElBQUksQ0FBQyxZQUFVLEVBQUU7d0JBQ2YsWUFBVSxHQUFHLEVBQUUsQ0FBQztxQkFDakI7b0JBQ0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFlBQVUsQ0FBQyxDQUFDO2lCQUMzQztnQkFDRCxPQUFPLFlBQVUsQ0FBQzthQUNuQjtZQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNWLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0JBQWtCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFlLENBQUcsQ0FBQyxDQUFDO2dCQUN4RSxNQUFNLENBQUMsQ0FBQzthQUNUO1FBQ0gsQ0FBQztRQUVPLHNDQUFZLEdBQXBCLFVBQXFCLElBQVM7WUFDNUIsSUFBSSxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDakQsV0FBVyxHQUFHLEVBQUUsQ0FBQztnQkFDakIsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7Z0JBQzVELElBQUksVUFBVSxFQUFFO29CQUNkLElBQU0sbUJBQWlCLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLElBQUksQ0FBQyxtQkFBaUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLFVBQVU7d0JBQ2hELFdBQWEsQ0FBQyxVQUFVLENBQUMsR0FBRyxtQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDNUQsQ0FBQyxDQUFDLENBQUM7aUJBQ0o7Z0JBRUQsSUFBTSxTQUFPLEdBQUcsYUFBYSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFRO29CQUNwQyxJQUFNLFFBQVEsR0FBRyxTQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ25DLElBQU0sUUFBUSxHQUFXLFFBQVMsQ0FBQyxJQUFJLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksUUFBUSxFQUEzQixDQUEyQixDQUFDLENBQUM7b0JBQzFFLFdBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxXQUFhLENBQUMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDO2dCQUNoRSxDQUFDLENBQUMsQ0FBQztnQkFDSCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7YUFDekM7WUFDRCxPQUFPLFdBQVcsQ0FBQztRQUNyQixDQUFDO1FBRU8sd0NBQWMsR0FBdEIsVUFBdUIsSUFBa0I7WUFDdkMsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0MsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDbEIsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDakQsSUFBTSxnQkFBZ0IsR0FBRyxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN4RCxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7YUFDM0M7WUFDRCxPQUFPLGFBQWEsQ0FBQztRQUN2QixDQUFDO1FBR08sd0NBQWMsR0FBdEIsVUFBdUIsSUFBa0IsRUFBRSxhQUFrQjtZQUMzRCxJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNwRSxJQUFJLFVBQVUsWUFBWSw0QkFBWSxFQUFFO2dCQUN0QyxPQUFPLFVBQVUsQ0FBQzthQUNuQjtRQUNILENBQUM7UUFFRCwwQ0FBZ0IsR0FBaEIsVUFBaUIsSUFBUyxFQUFFLFVBQWtCO1lBQzVDLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSw0QkFBWSxDQUFDLEVBQUU7Z0JBQ25DLElBQUksQ0FBQyxXQUFXLENBQ1osSUFBSSxLQUFLLENBQ0wsK0JBQTZCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlDQUE4QixDQUFDLEVBQ3BGLElBQUksQ0FBQyxDQUFDO2FBQ1g7WUFDRCxJQUFJO2dCQUNGLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7YUFDOUM7WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDVixPQUFPLENBQUMsS0FBSyxDQUFDLG9CQUFrQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBZSxDQUFHLENBQUMsQ0FBQztnQkFDeEUsTUFBTSxDQUFDLENBQUM7YUFDVDtRQUNILENBQUM7UUFFRCxnQ0FBTSxHQUFOLFVBQU8sSUFBUzs7WUFDZCxJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksNEJBQVksQ0FBQyxFQUFFO2dCQUNuQyxJQUFJLENBQUMsV0FBVyxDQUNaLElBQUksS0FBSyxDQUFDLHFCQUFtQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxpQ0FBOEIsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUM1RixPQUFPLEVBQUUsQ0FBQzthQUNYO1lBQ0QsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxJQUFNLE1BQU0sR0FBa0MsRUFBRSxDQUFDOztnQkFDakQsS0FBaUIsSUFBQSxrQkFBQSxpQkFBQSxhQUFhLENBQUEsNENBQUEsdUVBQUU7b0JBQTNCLElBQUksTUFBSSwwQkFBQTtvQkFDWCxJQUFJLE1BQUksQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsRUFBRTt3QkFDcEMsSUFBSSxRQUFRLEdBQUcsTUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBSSxDQUFDLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDdEUsSUFBSSxLQUFLLFNBQUssQ0FBQzt3QkFDZixJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7NEJBQzdCLFFBQVEsR0FBRyxNQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQzs0QkFDM0QsS0FBSyxHQUFHLE1BQU0sQ0FBQzt5QkFDaEI7NkJBQU07NEJBQ0wsS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBSSxDQUFDLENBQUMsQ0FBQzt5QkFDaEU7d0JBQ0QsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQztxQkFDMUI7aUJBQ0Y7Ozs7Ozs7OztZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFTyx5REFBK0IsR0FBdkMsVUFBd0MsSUFBa0IsRUFBRSxJQUFTO1lBQ25FLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxVQUFDLE9BQXFCLEVBQUUsSUFBVyxJQUFLLFlBQUksSUFBSSxZQUFKLElBQUksNkJBQUksSUFBSSxPQUFoQixDQUFpQixDQUFDLENBQUM7UUFDMUYsQ0FBQztRQUVPLDJDQUFpQixHQUF6QixVQUEwQixJQUFrQixFQUFFLEVBQU87WUFDbkQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFVBQUMsT0FBcUIsRUFBRSxJQUFXLElBQUssT0FBQSxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBekIsQ0FBeUIsQ0FBQyxDQUFDO1FBQ2xHLENBQUM7UUFFTyxpREFBdUIsR0FBL0I7WUFDRSxJQUFJLENBQUMsK0JBQStCLENBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFlBQVksQ0FBQyxFQUFFLHVCQUFnQixDQUFDLENBQUM7WUFDeEUsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQzNFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDckUsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ2hFLElBQUksQ0FBQyw0QkFBNEI7Z0JBQzdCLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLDhCQUE4QixDQUFDLENBQUM7WUFFdkUsSUFBSSxDQUFDLCtCQUErQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxFQUFFLGlCQUFVLENBQUMsQ0FBQztZQUM3RixJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLEVBQUUsaUJBQVUsQ0FBQyxDQUFDO1lBQzdGLElBQUksQ0FBQywrQkFBK0IsQ0FDaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsVUFBVSxDQUFDLEVBQUUscUJBQWMsQ0FBQyxDQUFDO1lBQ3BFLElBQUksQ0FBQywrQkFBK0IsQ0FDaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLEVBQUUsbUJBQVksQ0FBQyxDQUFDO1lBQ2hFLElBQUksQ0FBQywrQkFBK0IsQ0FDaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsVUFBVSxDQUFDLEVBQUUscUJBQWMsQ0FBQyxDQUFDO1lBQ3BFLElBQUksQ0FBQywrQkFBK0IsQ0FDaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLEVBQUUsc0JBQWUsQ0FBQyxDQUFDO1lBQ3RFLElBQUksQ0FBQywrQkFBK0IsQ0FDaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsY0FBYyxDQUFDLEVBQUUseUJBQWtCLENBQUMsQ0FBQztZQUM1RSxJQUFJLENBQUMsK0JBQStCLENBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLGlCQUFpQixDQUFDLEVBQUUsNEJBQXFCLENBQUMsQ0FBQztZQUNsRixJQUFJLENBQUMsK0JBQStCLENBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxFQUFFLHNCQUFlLENBQUMsQ0FBQztZQUN0RSxJQUFJLENBQUMsK0JBQStCLENBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLGNBQWMsQ0FBQyxFQUFFLHlCQUFrQixDQUFDLENBQUM7WUFDNUUsSUFBSSxDQUFDLCtCQUErQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxFQUFFLGtCQUFXLENBQUMsQ0FBQztZQUMvRixJQUFJLENBQUMsK0JBQStCLENBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQyxFQUFFLG1CQUFZLENBQUMsQ0FBQztZQUNoRSxJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLEVBQUUsaUJBQVUsQ0FBQyxDQUFDO1lBQzdGLElBQUksQ0FBQywrQkFBK0IsQ0FDaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDLEVBQUUsd0JBQWlCLENBQUMsQ0FBQztZQUMxRSxJQUFJLENBQUMsK0JBQStCLENBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLGNBQWMsQ0FBQyxFQUFFLHlCQUFrQixDQUFDLENBQUM7WUFDNUUsSUFBSSxDQUFDLCtCQUErQixDQUNoQyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsRUFBRSxzQkFBZSxDQUFDLENBQUM7WUFDdEUsSUFBSSxDQUFDLCtCQUErQixDQUNoQyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsRUFBRSxzQkFBZSxDQUFDLENBQUM7WUFDdEUsSUFBSSxDQUFDLCtCQUErQixDQUNoQyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsRUFBRSxxQkFBYyxDQUFDLENBQUM7WUFFcEUsdUVBQXVFO1lBQ3ZFLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsRUFBRSxpQkFBVSxDQUFDLENBQUM7WUFDN0YsSUFBSSxDQUFDLCtCQUErQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxFQUFFLGlCQUFVLENBQUMsQ0FBQztZQUM3RixJQUFJLENBQUMsK0JBQStCLENBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxFQUFFLHFCQUFjLENBQUMsQ0FBQztZQUNwRSxJQUFJLENBQUMsK0JBQStCLENBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxFQUFFLHFCQUFjLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBRUQ7Ozs7OztXQU1HO1FBQ0gseUNBQWUsR0FBZixVQUFnQixlQUF1QixFQUFFLElBQVksRUFBRSxPQUFrQjtZQUN2RSxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLGVBQWUsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUVEOztXQUVHO1FBQ0sscUNBQVcsR0FBbkIsVUFBb0IsT0FBcUIsRUFBRSxLQUFVO1lBQ25ELElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUM1QyxJQUFJLENBQUMsYUFBYSxHQUFHLFVBQUMsS0FBVSxFQUFFLFFBQWlCLElBQU0sQ0FBQyxDQUFDO1lBQzNELElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzdDLElBQUksQ0FBQyxhQUFhLEdBQUcsZ0JBQWdCLENBQUM7WUFDdEMsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELGdCQUFnQjtRQUNULGtDQUFRLEdBQWYsVUFBZ0IsT0FBcUIsRUFBRSxLQUFVLEVBQUUsSUFBcUI7WUFBckIscUJBQUEsRUFBQSxZQUFxQjtZQUN0RSxJQUFNLElBQUksR0FBRyxJQUFJLENBQUM7WUFDbEIsSUFBSSxLQUFLLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQztZQUMvQixJQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBeUIsQ0FBQztZQUNqRCxJQUFNLFdBQVcsR0FBRyxPQUFPLENBQUM7WUFFNUIsU0FBUyxpQkFBaUIsQ0FDdEIsT0FBcUIsRUFBRSxLQUFVLEVBQUUsS0FBYSxFQUFFLFVBQWtCO2dCQUN0RSxTQUFTLHFCQUFxQixDQUFDLFlBQTBCO29CQUN2RCxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztvQkFDdkUsT0FBTyxjQUFjLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDekQsQ0FBQztnQkFFRCxTQUFTLGVBQWUsQ0FBQyxLQUFVO29CQUNqQyxPQUFPLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNyRCxDQUFDO2dCQUVELFNBQVMsY0FBYyxDQUFDLEtBQVU7b0JBQ2hDLE9BQU8saUJBQWlCLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNsRSxDQUFDO2dCQUVELFNBQVMsY0FBYyxDQUFDLGFBQTJCLEVBQUUsS0FBVTtvQkFDN0QsSUFBSSxhQUFhLEtBQUssT0FBTyxFQUFFO3dCQUM3Qix3RUFBd0U7d0JBQ3hFLE9BQU8saUJBQWlCLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO3FCQUN2RTtvQkFDRCxJQUFJO3dCQUNGLE9BQU8saUJBQWlCLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO3FCQUN2RTtvQkFBQyxPQUFPLENBQUMsRUFBRTt3QkFDVixJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRTs0QkFDdEIsd0ZBQXdGOzRCQUN4RixRQUFROzRCQUNSLDJCQUEyQjs0QkFDM0IsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxNQUFRLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUN4RixJQUFNLE9BQU8sR0FBRyxNQUFJLGFBQWEsQ0FBQyxJQUFJLFVBQUssVUFBWSxDQUFDOzRCQUN4RCxJQUFNLEtBQUssR0FBRyxFQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUMsQ0FBQzs0QkFDdEUsc0ZBQXNGOzRCQUN0RiwwQ0FBMEM7NEJBQzFDLElBQUksQ0FBQyxLQUFLLENBQ047Z0NBQ0UsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPO2dDQUNsQixNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU07Z0NBQ2hCLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLEtBQUssT0FBQTtnQ0FDekIsTUFBTSxFQUFFLGFBQWE7NkJBQ3RCLEVBQ0QsT0FBTyxDQUFDLENBQUM7eUJBQ2Q7NkJBQU07NEJBQ0wsb0NBQW9DOzRCQUNwQyxNQUFNLENBQUMsQ0FBQzt5QkFDVDtxQkFDRjtnQkFDSCxDQUFDO2dCQUVELFNBQVMsWUFBWSxDQUNqQixjQUE0QixFQUFFLGNBQW1CLEVBQUUsSUFBVyxFQUFFLGdCQUFxQjtvQkFDdkYsSUFBSSxjQUFjLElBQUksY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLFVBQVUsRUFBRTt3QkFDaEUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxFQUFFOzRCQUMvQixJQUFJLENBQUMsS0FBSyxDQUNOO2dDQUNFLE9BQU8sRUFBRSw0QkFBNEI7Z0NBQ3JDLE9BQU8sRUFBRSxhQUFXLGNBQWMsQ0FBQyxJQUFJLGtCQUFlO2dDQUN0RCxLQUFLLEVBQUUsY0FBYzs2QkFDdEIsRUFDRCxjQUFjLENBQUMsQ0FBQzt5QkFDckI7d0JBQ0QsSUFBSTs0QkFDRixJQUFNLE9BQUssR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7NEJBQ3RDLElBQUksT0FBSyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsSUFBSSxPQUFLLENBQUMsVUFBVSxJQUFJLE9BQU8sQ0FBQyxFQUFFO2dDQUN4RCxJQUFNLFVBQVUsR0FBYSxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUM7Z0NBQzFELElBQU0sUUFBUSxHQUFVLGNBQWMsQ0FBQyxRQUFRLENBQUM7Z0NBQ2hELElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsY0FBYyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBNUIsQ0FBNEIsQ0FBQztxQ0FDeEMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBbkMsQ0FBbUMsQ0FBQyxDQUFDO2dDQUM1RCxJQUFJLFFBQVEsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUU7b0NBQzdDLElBQUksQ0FBQyxJQUFJLE9BQVQsSUFBSSxtQkFBUyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQyxLQUFVLElBQUssT0FBQSxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQWYsQ0FBZSxDQUFDLEdBQUU7aUNBQ2hGO2dDQUNELE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDO2dDQUNsQyxJQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUM7Z0NBQzNDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO29DQUMxQyxhQUFhLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQ0FDOUM7Z0NBQ0QsSUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDO2dDQUN2QixJQUFJLFFBQVcsQ0FBQztnQ0FDaEIsSUFBSTtvQ0FDRixLQUFLLEdBQUcsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDO29DQUM3QixRQUFNLEdBQUcsY0FBYyxDQUFDLGNBQWMsRUFBRSxPQUFLLENBQUMsQ0FBQztpQ0FDaEQ7d0NBQVM7b0NBQ1IsS0FBSyxHQUFHLFFBQVEsQ0FBQztpQ0FDbEI7Z0NBQ0QsT0FBTyxRQUFNLENBQUM7NkJBQ2Y7eUJBQ0Y7Z0NBQVM7NEJBQ1IsT0FBTyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQzt5QkFDaEM7cUJBQ0Y7b0JBRUQsSUFBSSxLQUFLLEtBQUssQ0FBQyxFQUFFO3dCQUNmLHNGQUFzRjt3QkFDdEYsbUZBQW1GO3dCQUNuRix1REFBdUQ7d0JBQ3ZELE9BQU8sTUFBTSxDQUFDO3FCQUNmO29CQUNELElBQUksUUFBUSxHQUF1QixTQUFTLENBQUM7b0JBQzdDLElBQUksZ0JBQWdCLElBQUksZ0JBQWdCLENBQUMsVUFBVSxJQUFJLFVBQVUsRUFBRTt3QkFDakUsSUFBTSxJQUFJLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDO3dCQUNuQyxJQUFNLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUM7d0JBQzdDLElBQU0sUUFBUSxHQUFHLGdCQUFnQixDQUFDLFFBQVEsQ0FBQzt3QkFDM0MsSUFBSSxRQUFRLElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksU0FBUyxJQUFJLElBQUksRUFBRTs0QkFDekQsUUFBUSxHQUFHLEVBQUMsUUFBUSxVQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBQyxDQUFDO3lCQUNoRDtxQkFDRjtvQkFDRCxJQUFJLENBQUMsS0FBSyxDQUNOO3dCQUNFLE9BQU8sRUFBRSwyQkFBMkI7d0JBQ3BDLE9BQU8sRUFBRSxjQUFjO3dCQUN2QixLQUFLLEVBQUUsY0FBYyxFQUFFLFFBQVEsVUFBQTtxQkFDaEMsRUFDRCxPQUFPLENBQUMsQ0FBQztnQkFDZixDQUFDO2dCQUVELFNBQVMsUUFBUSxDQUFDLFVBQWU7O29CQUMvQixJQUFJLFdBQVcsQ0FBQyxVQUFVLENBQUMsRUFBRTt3QkFDM0IsT0FBTyxVQUFVLENBQUM7cUJBQ25CO29CQUNELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRTt3QkFDN0IsSUFBTSxRQUFNLEdBQVUsRUFBRSxDQUFDOzs0QkFDekIsS0FBbUIsSUFBQSxLQUFBLGlCQUFNLFVBQVcsQ0FBQSxnQkFBQSw0QkFBRTtnQ0FBakMsSUFBTSxJQUFJLFdBQUE7Z0NBQ2IsZ0NBQWdDO2dDQUNoQyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFFBQVEsRUFBRTtvQ0FDeEMsOEVBQThFO29DQUM5RSw2QkFBNkI7b0NBQzdCLElBQU0sV0FBVyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7b0NBQ3JELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRTs7NENBQzlCLEtBQXlCLElBQUEsK0JBQUEsaUJBQUEsV0FBVyxDQUFBLENBQUEsd0NBQUEsaUVBQUU7Z0RBQWpDLElBQU0sVUFBVSx3QkFBQTtnREFDbkIsUUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQzs2Q0FDekI7Ozs7Ozs7Ozt3Q0FDRCxTQUFTO3FDQUNWO2lDQUNGO2dDQUNELElBQU0sT0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQ0FDN0IsSUFBSSxZQUFZLENBQUMsT0FBSyxDQUFDLEVBQUU7b0NBQ3ZCLFNBQVM7aUNBQ1Y7Z0NBQ0QsUUFBTSxDQUFDLElBQUksQ0FBQyxPQUFLLENBQUMsQ0FBQzs2QkFDcEI7Ozs7Ozs7Ozt3QkFDRCxPQUFPLFFBQU0sQ0FBQztxQkFDZjtvQkFDRCxJQUFJLFVBQVUsWUFBWSw0QkFBWSxFQUFFO3dCQUN0QyxpRkFBaUY7d0JBQ2pGLG1DQUFtQzt3QkFDbkMsSUFBSSxVQUFVLEtBQUssSUFBSSxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUM7NEJBQ3hFLENBQUMsVUFBVSxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7NEJBQ2xELE9BQU8sVUFBVSxDQUFDO3lCQUNuQjs2QkFBTTs0QkFDTCxJQUFNLFlBQVksR0FBRyxVQUFVLENBQUM7NEJBQ2hDLElBQU0sZ0JBQWdCLEdBQUcscUJBQXFCLENBQUMsWUFBWSxDQUFDLENBQUM7NEJBQzdELElBQUksZ0JBQWdCLElBQUksSUFBSSxFQUFFO2dDQUM1QixPQUFPLGNBQWMsQ0FBQyxZQUFZLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQzs2QkFDdkQ7aUNBQU07Z0NBQ0wsT0FBTyxZQUFZLENBQUM7NkJBQ3JCO3lCQUNGO3FCQUNGO29CQUNELElBQUksVUFBVSxFQUFFO3dCQUNkLElBQUksVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFOzRCQUM1QixJQUFJLFlBQVksU0FBYyxDQUFDOzRCQUMvQixRQUFRLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtnQ0FDaEMsS0FBSyxPQUFPO29DQUNWLElBQUksSUFBSSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztvQ0FDeEMsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDO3dDQUFFLE9BQU8sSUFBSSxDQUFDO29DQUNwQyxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0NBQzFDLElBQUksWUFBWSxDQUFDLEtBQUssQ0FBQzt3Q0FBRSxPQUFPLEtBQUssQ0FBQztvQ0FDdEMsUUFBUSxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7d0NBQzlCLEtBQUssSUFBSTs0Q0FDUCxPQUFPLElBQUksSUFBSSxLQUFLLENBQUM7d0NBQ3ZCLEtBQUssSUFBSTs0Q0FDUCxPQUFPLElBQUksSUFBSSxLQUFLLENBQUM7d0NBQ3ZCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssSUFBSTs0Q0FDUCxPQUFPLElBQUksSUFBSSxLQUFLLENBQUM7d0NBQ3ZCLEtBQUssSUFBSTs0Q0FDUCxPQUFPLElBQUksSUFBSSxLQUFLLENBQUM7d0NBQ3ZCLEtBQUssS0FBSzs0Q0FDUixPQUFPLElBQUksS0FBSyxLQUFLLENBQUM7d0NBQ3hCLEtBQUssS0FBSzs0Q0FDUixPQUFPLElBQUksS0FBSyxLQUFLLENBQUM7d0NBQ3hCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssSUFBSTs0Q0FDUCxPQUFPLElBQUksSUFBSSxLQUFLLENBQUM7d0NBQ3ZCLEtBQUssSUFBSTs0Q0FDUCxPQUFPLElBQUksSUFBSSxLQUFLLENBQUM7d0NBQ3ZCLEtBQUssSUFBSTs0Q0FDUCxPQUFPLElBQUksSUFBSSxLQUFLLENBQUM7d0NBQ3ZCLEtBQUssSUFBSTs0Q0FDUCxPQUFPLElBQUksSUFBSSxLQUFLLENBQUM7d0NBQ3ZCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7d0NBQ3RCLEtBQUssR0FBRzs0Q0FDTixPQUFPLElBQUksR0FBRyxLQUFLLENBQUM7cUNBQ3ZCO29DQUNELE9BQU8sSUFBSSxDQUFDO2dDQUNkLEtBQUssSUFBSTtvQ0FDUCxJQUFJLFNBQVMsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7b0NBQ2xELE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDO3dDQUN4QyxRQUFRLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztnQ0FDNUQsS0FBSyxLQUFLO29DQUNSLElBQUksT0FBTyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztvQ0FDOUMsSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDO3dDQUFFLE9BQU8sT0FBTyxDQUFDO29DQUMxQyxRQUFRLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTt3Q0FDOUIsS0FBSyxHQUFHOzRDQUNOLE9BQU8sT0FBTyxDQUFDO3dDQUNqQixLQUFLLEdBQUc7NENBQ04sT0FBTyxDQUFDLE9BQU8sQ0FBQzt3Q0FDbEIsS0FBSyxHQUFHOzRDQUNOLE9BQU8sQ0FBQyxPQUFPLENBQUM7d0NBQ2xCLEtBQUssR0FBRzs0Q0FDTixPQUFPLENBQUMsT0FBTyxDQUFDO3FDQUNuQjtvQ0FDRCxPQUFPLElBQUksQ0FBQztnQ0FDZCxLQUFLLE9BQU87b0NBQ1YsSUFBSSxXQUFXLEdBQUcsZUFBZSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29DQUM1RCxJQUFJLEtBQUssR0FBRyxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0NBQ2pELElBQUksV0FBVyxJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUM7d0NBQUUsT0FBTyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7b0NBQ2pFLE9BQU8sSUFBSSxDQUFDO2dDQUNkLEtBQUssUUFBUTtvQ0FDWCxJQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7b0NBQ3BDLElBQUksYUFBYSxHQUFHLE9BQU8sQ0FBQztvQ0FDNUIsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29DQUN0RCxJQUFJLFlBQVksWUFBWSw0QkFBWSxFQUFFO3dDQUN4QyxJQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQzt3Q0FDcEQsYUFBYTs0Q0FDVCxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQzt3Q0FDNUUsSUFBTSxnQkFBZ0IsR0FBRyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQzt3Q0FDOUQsSUFBSSxnQkFBZ0IsSUFBSSxJQUFJLEVBQUU7NENBQzVCLE9BQU8sY0FBYyxDQUFDLGFBQWEsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO3lDQUN4RDs2Q0FBTTs0Q0FDTCxPQUFPLGFBQWEsQ0FBQzt5Q0FDdEI7cUNBQ0Y7b0NBQ0QsSUFBSSxZQUFZLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQzt3Q0FDckMsT0FBTyxjQUFjLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO29DQUM3RCxPQUFPLElBQUksQ0FBQztnQ0FDZCxLQUFLLFdBQVc7b0NBQ2Qsa0ZBQWtGO29DQUNsRixpQ0FBaUM7b0NBQ2pDLCtCQUErQjtvQ0FDL0IsSUFBTSxNQUFJLEdBQVcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29DQUN4QyxJQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQUksQ0FBQyxDQUFDO29DQUN2QyxJQUFJLFVBQVUsSUFBSSxZQUFZLENBQUMsT0FBTyxFQUFFO3dDQUN0QyxPQUFPLFVBQVUsQ0FBQztxQ0FDbkI7b0NBQ0QsTUFBTTtnQ0FDUixLQUFLLFVBQVU7b0NBQ2IsSUFBSTt3Q0FDRixPQUFPLFFBQVEsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7cUNBQ3BDO29DQUFDLE9BQU8sQ0FBQyxFQUFFO3dDQUNWLDJFQUEyRTt3Q0FDM0UsbUNBQW1DO3dDQUNuQyxpRUFBaUU7d0NBQ2pFLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxRQUFRLElBQUksSUFBSTs0Q0FDakQsVUFBVSxDQUFDLElBQUksSUFBSSxJQUFJLElBQUksVUFBVSxDQUFDLFNBQVMsSUFBSSxJQUFJLEVBQUU7NENBQzNELENBQUMsQ0FBQyxRQUFRLEdBQUc7Z0RBQ1gsUUFBUSxFQUFFLFVBQVUsQ0FBQyxRQUFRO2dEQUM3QixJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUk7Z0RBQ3JCLE1BQU0sRUFBRSxVQUFVLENBQUMsU0FBUzs2Q0FDN0IsQ0FBQzt5Q0FDSDt3Q0FDRCxNQUFNLENBQUMsQ0FBQztxQ0FDVDtnQ0FDSCxLQUFLLE9BQU87b0NBQ1YsT0FBTyxPQUFPLENBQUM7Z0NBQ2pCLEtBQUssVUFBVTtvQ0FDYixPQUFPLE9BQU8sQ0FBQztnQ0FDakIsS0FBSyxLQUFLLENBQUM7Z0NBQ1gsS0FBSyxNQUFNO29DQUNULHFEQUFxRDtvQ0FDckQsWUFBWSxHQUFHLGlCQUFpQixDQUM1QixPQUFPLEVBQUUsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7b0NBQ3RFLElBQUksWUFBWSxZQUFZLDRCQUFZLEVBQUU7d0NBQ3hDLElBQUksWUFBWSxLQUFLLElBQUksQ0FBQyxjQUFjLElBQUksWUFBWSxLQUFLLElBQUksQ0FBQyxXQUFXLEVBQUU7NENBQzdFLHdFQUF3RTs0Q0FDeEUsMkVBQTJFOzRDQUUzRSw0RUFBNEU7NENBQzVFLDRDQUE0Qzs0Q0FDNUMsT0FBTyxPQUFPLENBQUM7eUNBQ2hCO3dDQUNELElBQU0sY0FBYyxHQUFVLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7d0NBQzVELElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO3dDQUNyRCxJQUFJLFNBQVMsRUFBRTs0Q0FDYixJQUFNLElBQUksR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsY0FBYyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBNUIsQ0FBNEIsQ0FBQztpREFDbEQsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBbkMsQ0FBbUMsQ0FBQyxDQUFDOzRDQUNsRSxPQUFPLFNBQVMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7eUNBQ2pDOzZDQUFNOzRDQUNMLG9EQUFvRDs0Q0FDcEQsSUFBTSxjQUFjLEdBQUcscUJBQXFCLENBQUMsWUFBWSxDQUFDLENBQUM7NENBQzNELE9BQU8sWUFBWSxDQUNmLFlBQVksRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO3lDQUM3RTtxQ0FDRjtvQ0FDRCxPQUFPLE1BQU0sQ0FBQztnQ0FDaEIsS0FBSyxPQUFPO29DQUNWLElBQUksT0FBTyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUM7b0NBQ2pDLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksRUFBRTt3Q0FDOUIsSUFBSSxDQUFDLEtBQUssQ0FDTjs0Q0FDRSxPQUFPLFNBQUE7NENBQ1AsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPOzRDQUMzQixLQUFLLEVBQUUsVUFBVTs0Q0FDakIsUUFBUSxFQUFFO2dEQUNSLFFBQVEsRUFBRSxVQUFVLENBQUMsVUFBVSxDQUFDO2dEQUNoQyxJQUFJLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQztnREFDeEIsTUFBTSxFQUFFLFVBQVUsQ0FBQyxXQUFXLENBQUM7NkNBQ2hDO3lDQUNGLEVBQ0QsT0FBTyxDQUFDLENBQUM7cUNBQ2Q7eUNBQU07d0NBQ0wsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFDLE9BQU8sU0FBQSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUMsT0FBTyxFQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7cUNBQzdEO29DQUNELE9BQU8sTUFBTSxDQUFDO2dDQUNoQixLQUFLLFFBQVE7b0NBQ1gsT0FBTyxVQUFVLENBQUM7NkJBQ3JCOzRCQUNELE9BQU8sSUFBSSxDQUFDO3lCQUNiO3dCQUNELE9BQU8sWUFBWSxDQUFDLFVBQVUsRUFBRSxVQUFDLEtBQUssRUFBRSxJQUFJOzRCQUMxQyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0NBQzNCLElBQUksSUFBSSxLQUFLLFNBQVMsSUFBSSxPQUFPLElBQUksVUFBVSxFQUFFO29DQUMvQyxpRkFBaUY7b0NBQ2pGLG1CQUFtQjtvQ0FDbkIsSUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQ0FDN0MsSUFBSSxPQUFPLEtBQUssSUFBSSxDQUFDLE1BQU0sSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLDRCQUE0QixFQUFFO3dDQUMzRSxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztxQ0FDeEI7aUNBQ0Y7Z0NBQ0QsT0FBTyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7NkJBQzlCOzRCQUNELE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN6QixDQUFDLENBQUMsQ0FBQztxQkFDSjtvQkFDRCxPQUFPLE1BQU0sQ0FBQztnQkFDaEIsQ0FBQztnQkFFRCxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN6QixDQUFDO1lBRUQsSUFBSSxNQUFXLENBQUM7WUFDaEIsSUFBSTtnQkFDRixNQUFNLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzdEO1lBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ1YsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFO29CQUN0QixJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztpQkFDOUI7cUJBQU07b0JBQ0wsTUFBTSxtQkFBbUIsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7aUJBQ3ZDO2FBQ0Y7WUFDRCxJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDeEIsT0FBTyxTQUFTLENBQUM7YUFDbEI7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRU8seUNBQWUsR0FBdkIsVUFBd0IsSUFBa0I7WUFDeEMsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0QsT0FBTyxjQUFjLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN6QixFQUFDLFVBQVUsRUFBRSxPQUFPLEVBQUMsQ0FBQztRQUMzRSxDQUFDO1FBRU8scUNBQVcsR0FBbkIsVUFBb0IsS0FBWSxFQUFFLE9BQXFCLEVBQUUsSUFBYTtZQUNwRSxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUU7Z0JBQ3RCLElBQUksQ0FBQyxhQUFhLENBQ2QsbUJBQW1CLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQzthQUNqRjtpQkFBTTtnQkFDTCxNQUFNLEtBQUssQ0FBQzthQUNiO1FBQ0gsQ0FBQztRQUVPLCtCQUFLLEdBQWIsVUFDSSxFQVNDLEVBQ0QsZ0JBQThCO2dCQVY3QixvQkFBTyxFQUFFLG9CQUFPLEVBQUUsa0JBQU0sRUFBRSxzQkFBUSxFQUFFLG9CQUFPLEVBQUUsZ0JBQUssRUFBRSxrQkFBTSxFQUFFLGdCQUFLO1lBV3BFLElBQUksQ0FBQyxXQUFXLENBQ1osYUFBYSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxFQUN6RSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3hCLENBQUM7UUFDSCxzQkFBQztJQUFELENBQUMsQUFyekJELElBcXpCQztJQXJ6QlksMENBQWU7SUErMEI1QixJQUFNLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQztJQUV6QyxTQUFTLGFBQWEsQ0FDbEIsT0FBZSxFQUFFLE9BQWdCLEVBQUUsTUFBZSxFQUFFLFFBQW1CLEVBQUUsTUFBcUIsRUFDOUYsT0FBYSxFQUFFLEtBQTRCO1FBQzdDLElBQU0sS0FBSyxHQUFHLGtCQUFXLENBQUMsT0FBTyxDQUFrQixDQUFDO1FBQ25ELEtBQWEsQ0FBQyxjQUFjLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDdEMsSUFBSSxNQUFNO1lBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDbEMsSUFBSSxRQUFRO1lBQUUsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDeEMsSUFBSSxPQUFPO1lBQUUsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDckMsSUFBSSxPQUFPO1lBQUUsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDckMsSUFBSSxLQUFLO1lBQUUsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDL0IsSUFBSSxNQUFNO1lBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDbEMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsU0FBUyxlQUFlLENBQUMsS0FBWTtRQUNuQyxPQUFPLENBQUMsQ0FBRSxLQUFhLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVELElBQU0sOEJBQThCLEdBQUcsaUNBQWlDLENBQUM7SUFDekUsSUFBTSx3QkFBd0IsR0FBRywwQkFBMEIsQ0FBQztJQUM1RCxJQUFNLHlCQUF5QixHQUFHLDZCQUE2QixDQUFDO0lBQ2hFLElBQU0sc0JBQXNCLEdBQUcsd0JBQXdCLENBQUM7SUFDeEQsSUFBTSwyQkFBMkIsR0FBRyw2QkFBNkIsQ0FBQztJQUNsRSxJQUFNLHlCQUF5QixHQUFHLDZCQUE2QixDQUFDO0lBQ2hFLElBQU0sb0JBQW9CLEdBQUcsc0JBQXNCLENBQUM7SUFFcEQsU0FBUyxlQUFlLENBQUMsT0FBZSxFQUFFLE9BQVk7UUFDcEQsUUFBUSxPQUFPLEVBQUU7WUFDZixLQUFLLDhCQUE4QjtnQkFDakMsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRTtvQkFDaEMsT0FBTyw0RUFDSCxPQUFPLENBQUMsU0FBUyxxQkFBa0IsQ0FBQztpQkFDekM7Z0JBQ0QsTUFBTTtZQUNSLEtBQUssd0JBQXdCO2dCQUMzQixPQUFPLGdKQUFnSixDQUFDO1lBQzFKLEtBQUsseUJBQXlCO2dCQUM1QixPQUFPLDRJQUE0SSxDQUFDO1lBQ3RKLEtBQUssc0JBQXNCO2dCQUN6QixJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFO29CQUMvQixPQUFPLDRCQUEwQixPQUFPLENBQUMsUUFBVSxDQUFDO2lCQUNyRDtnQkFDRCxNQUFNO1lBQ1IsS0FBSywyQkFBMkI7Z0JBQzlCLElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUU7b0JBQzNCLE9BQU8seURBQXVELE9BQU8sQ0FBQyxJQUFJLGlCQUFjLENBQUM7aUJBQzFGO2dCQUNELE9BQU8sZ0RBQWdELENBQUM7WUFDMUQsS0FBSyx5QkFBeUI7Z0JBQzVCLElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUU7b0JBQzNCLE9BQU8sc0ZBQ0gsT0FBTyxDQUFDLElBQUkscUJBQWtCLENBQUM7aUJBQ3BDO2dCQUNELE1BQU07WUFDUixLQUFLLG9CQUFvQjtnQkFDdkIsT0FBTyxzREFBc0QsQ0FBQztTQUNqRTtRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRCxTQUFTLGFBQWEsQ0FBQyxPQUFlLEVBQUUsT0FBWTtRQUNsRCxRQUFRLE9BQU8sRUFBRTtZQUNmLEtBQUssOEJBQThCO2dCQUNqQyxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsU0FBUyxFQUFFO29CQUNoQyxPQUFPLHlCQUF1QixPQUFPLENBQUMsU0FBUyxNQUFHLENBQUM7aUJBQ3BEO2dCQUNELE1BQU07WUFDUixLQUFLLHlCQUF5QjtnQkFDNUIsT0FBTyw2Q0FBNkMsQ0FBQztZQUN2RCxLQUFLLHlCQUF5QjtnQkFDNUIsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLElBQUksRUFBRTtvQkFDM0IsT0FBTyx5QkFBdUIsT0FBTyxDQUFDLElBQUksTUFBRyxDQUFDO2lCQUMvQztnQkFDRCxNQUFNO1lBQ1IsS0FBSyxvQkFBb0I7Z0JBQ3ZCLE9BQU8scUVBQXFFLENBQUM7U0FDaEY7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBRUQsU0FBUyxZQUFZLENBQUMsS0FBb0I7UUFDeEMsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFO1lBQ2pCLE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQztTQUN0QjtRQUNELFFBQVEsS0FBSyxDQUFDLE9BQU8sRUFBRTtZQUNyQixLQUFLLDhCQUE4QjtnQkFDakMsSUFBSSxLQUFLLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFO29CQUM1QyxPQUFPLG1DQUFpQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVcsQ0FBQztpQkFDbkU7Z0JBQ0QsTUFBTTtZQUNSLEtBQUssd0JBQXdCO2dCQUMzQixPQUFPLG9CQUFvQixDQUFDO1lBQzlCLEtBQUsseUJBQXlCO2dCQUM1QixPQUFPLDRCQUE0QixDQUFDO1lBQ3RDLEtBQUssc0JBQXNCO2dCQUN6QixPQUFPLHVCQUF1QixDQUFDO1lBQ2pDLEtBQUssMkJBQTJCO2dCQUM5QixJQUFJLEtBQUssQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7b0JBQ3ZDLE9BQU8sWUFBVSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksTUFBRyxDQUFDO2lCQUN4QztnQkFDRCxPQUFPLGtCQUFrQixDQUFDO1lBQzVCLEtBQUsseUJBQXlCO2dCQUM1QixJQUFJLEtBQUssQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7b0JBQ3ZDLE9BQU8sK0JBQTZCLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBTSxDQUFDO2lCQUMxRDtnQkFDRCxPQUFPLDZCQUE2QixDQUFDO1NBQ3hDO1FBQ0QsT0FBTyxvQkFBb0IsQ0FBQztJQUM5QixDQUFDO0lBRUQsU0FBUyxZQUFZLENBQUMsS0FBMkIsRUFBRSxTQUEyQztRQUU1RixJQUFJLENBQUMsS0FBSztZQUFFLE9BQU8sRUFBRSxDQUFDO1FBQ3RCLElBQU0sTUFBTSxHQUF5QixFQUFFLENBQUM7UUFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxHQUFHO1lBQzdCLElBQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDekMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDeEIsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO29CQUN4QixNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7aUJBQzNGO3FCQUFNO29CQUNMLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7aUJBQ3JCO2FBQ0Y7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxTQUFTLFdBQVcsQ0FBQyxDQUFNO1FBQ3pCLE9BQU8sQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFVBQVUsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQztJQUMxRSxDQUFDO0lBT0Q7UUFBQTtRQWlCQSxDQUFDO1FBWmUsa0JBQUssR0FBbkI7WUFDRSxJQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBZSxDQUFDO1lBQ3ZDLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLFVBQVMsSUFBSSxFQUFFLEtBQUs7b0JBQzFCLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUN6QixPQUFPLElBQUksQ0FBQztnQkFDZCxDQUFDO2dCQUNELElBQUksRUFBRTtvQkFDSixPQUFPLE9BQU8sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQztnQkFDN0UsQ0FBQzthQUNGLENBQUM7UUFDSixDQUFDO1FBZGEsb0JBQU8sR0FBRyxFQUFFLENBQUM7UUFDYixrQkFBSyxHQUFpQixFQUFDLE9BQU8sRUFBRSxVQUFBLElBQUksSUFBSSxPQUFBLFlBQVksQ0FBQyxPQUFPLEVBQXBCLENBQW9CLEVBQUMsQ0FBQztRQWM5RSxtQkFBQztLQUFBLEFBakJELElBaUJDO0lBRUQ7UUFBNkIsMENBQVk7UUFDdkMsd0JBQW9CLFFBQTBCO1lBQTlDLFlBQWtELGlCQUFPLFNBQUc7WUFBeEMsY0FBUSxHQUFSLFFBQVEsQ0FBa0I7O1FBQWEsQ0FBQztRQUU1RCxnQ0FBTyxHQUFQLFVBQVEsSUFBWTtZQUNsQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztRQUNsRixDQUFDO1FBQ0gscUJBQUM7SUFBRCxDQUFDLEFBTkQsQ0FBNkIsWUFBWSxHQU14QztJQUVELFNBQVMsMEJBQTBCLENBQy9CLEtBQTJCLEVBQUUsTUFBMEI7UUFDekQsSUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQy9ELElBQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVEsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ2pFLElBQU0sT0FBTyxHQUFHLEtBQUcsUUFBUSxHQUFHLE9BQVMsQ0FBQztRQUN4QyxJQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDO1FBQ2hDLElBQU0sSUFBSSxHQUFvQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEQsMEJBQTBCLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ2hELE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQyxPQUFPLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUMzQyxPQUFPLEVBQUMsT0FBTyxTQUFBLEVBQUUsUUFBUSxVQUFBLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVELFNBQVMsbUJBQW1CLENBQUMsQ0FBUSxFQUFFLE9BQXFCO1FBQzFELElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3RCLDBGQUEwRjtZQUMxRiwwRkFBMEY7WUFDMUYsSUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUM1QixJQUFNLEtBQUssR0FBeUI7Z0JBQ2xDLE9BQU8sRUFBRSx1Q0FBcUMsT0FBTyxDQUFDLElBQUksTUFBRztnQkFDN0QsUUFBUSxFQUFFLFFBQVE7Z0JBQ2xCLElBQUksRUFBRSxFQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFDO2FBQ2hGLENBQUM7WUFDRixJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMvRCxPQUFPLGdDQUFjLENBQUMsMEJBQTBCLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7U0FDbEU7UUFDRCxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZVN1bW1hcnlLaW5kfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtNZXRhZGF0YUZhY3RvcnksIGNyZWF0ZUF0dHJpYnV0ZSwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVDb250ZW50Q2hpbGQsIGNyZWF0ZUNvbnRlbnRDaGlsZHJlbiwgY3JlYXRlRGlyZWN0aXZlLCBjcmVhdGVIb3N0LCBjcmVhdGVIb3N0QmluZGluZywgY3JlYXRlSG9zdExpc3RlbmVyLCBjcmVhdGVJbmplY3QsIGNyZWF0ZUluamVjdGFibGUsIGNyZWF0ZUlucHV0LCBjcmVhdGVOZ01vZHVsZSwgY3JlYXRlT3B0aW9uYWwsIGNyZWF0ZU91dHB1dCwgY3JlYXRlUGlwZSwgY3JlYXRlU2VsZiwgY3JlYXRlU2tpcFNlbGYsIGNyZWF0ZVZpZXdDaGlsZCwgY3JlYXRlVmlld0NoaWxkcmVufSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtTdW1tYXJ5UmVzb2x2ZXJ9IGZyb20gJy4uL3N1bW1hcnlfcmVzb2x2ZXInO1xuaW1wb3J0IHtzeW50YXhFcnJvcn0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7Rm9ybWF0dGVkTWVzc2FnZUNoYWluLCBmb3JtYXR0ZWRFcnJvcn0gZnJvbSAnLi9mb3JtYXR0ZWRfZXJyb3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4vc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge1N0YXRpY1N5bWJvbFJlc29sdmVyfSBmcm9tICcuL3N0YXRpY19zeW1ib2xfcmVzb2x2ZXInO1xuXG5jb25zdCBBTkdVTEFSX0NPUkUgPSAnQGFuZ3VsYXIvY29yZSc7XG5jb25zdCBBTkdVTEFSX1JPVVRFUiA9ICdAYW5ndWxhci9yb3V0ZXInO1xuXG5jb25zdCBISURERU5fS0VZID0gL15cXCQuKlxcJCQvO1xuXG5jb25zdCBJR05PUkUgPSB7XG4gIF9fc3ltYm9saWM6ICdpZ25vcmUnXG59O1xuXG5jb25zdCBVU0VfVkFMVUUgPSAndXNlVmFsdWUnO1xuY29uc3QgUFJPVklERSA9ICdwcm92aWRlJztcbmNvbnN0IFJFRkVSRU5DRV9TRVQgPSBuZXcgU2V0KFtVU0VfVkFMVUUsICd1c2VGYWN0b3J5JywgJ2RhdGEnLCAnaWQnLCAnbG9hZENoaWxkcmVuJ10pO1xuY29uc3QgVFlQRUdVQVJEX1BPU1RGSVggPSAnVHlwZUd1YXJkJztcbmNvbnN0IFVTRV9JRiA9ICdVc2VJZic7XG5cbmZ1bmN0aW9uIHNob3VsZElnbm9yZSh2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiB2YWx1ZSAmJiB2YWx1ZS5fX3N5bWJvbGljID09ICdpZ25vcmUnO1xufVxuXG4vKipcbiAqIEEgc3RhdGljIHJlZmxlY3RvciBpbXBsZW1lbnRzIGVub3VnaCBvZiB0aGUgUmVmbGVjdG9yIEFQSSB0aGF0IGlzIG5lY2Vzc2FyeSB0byBjb21waWxlXG4gKiB0ZW1wbGF0ZXMgc3RhdGljYWxseS5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0YXRpY1JlZmxlY3RvciBpbXBsZW1lbnRzIENvbXBpbGVSZWZsZWN0b3Ige1xuICBwcml2YXRlIGFubm90YXRpb25DYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBhbnlbXT4oKTtcbiAgcHJpdmF0ZSBzaGFsbG93QW5ub3RhdGlvbkNhY2hlID0gbmV3IE1hcDxTdGF0aWNTeW1ib2wsIGFueVtdPigpO1xuICBwcml2YXRlIHByb3BlcnR5Q2FjaGUgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwge1trZXk6IHN0cmluZ106IGFueVtdfT4oKTtcbiAgcHJpdmF0ZSBwYXJhbWV0ZXJDYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBhbnlbXT4oKTtcbiAgcHJpdmF0ZSBtZXRob2RDYWNoZSA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCB7W2tleTogc3RyaW5nXTogYm9vbGVhbn0+KCk7XG4gIHByaXZhdGUgc3RhdGljQ2FjaGUgPSBuZXcgTWFwPFN0YXRpY1N5bWJvbCwgc3RyaW5nW10+KCk7XG4gIHByaXZhdGUgY29udmVyc2lvbk1hcCA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCAoY29udGV4dDogU3RhdGljU3ltYm9sLCBhcmdzOiBhbnlbXSkgPT4gYW55PigpO1xuICBwcml2YXRlIHJlc29sdmVkRXh0ZXJuYWxSZWZlcmVuY2VzID0gbmV3IE1hcDxzdHJpbmcsIFN0YXRpY1N5bWJvbD4oKTtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgaW5qZWN0aW9uVG9rZW4gITogU3RhdGljU3ltYm9sO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBvcGFxdWVUb2tlbiAhOiBTdGF0aWNTeW1ib2w7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBST1VURVMgITogU3RhdGljU3ltYm9sO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBBTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTICE6IFN0YXRpY1N5bWJvbDtcbiAgcHJpdmF0ZSBhbm5vdGF0aW9uRm9yUGFyZW50Q2xhc3NXaXRoU3VtbWFyeUtpbmQgPVxuICAgICAgbmV3IE1hcDxDb21waWxlU3VtbWFyeUtpbmQsIE1ldGFkYXRhRmFjdG9yeTxhbnk+W10+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHN1bW1hcnlSZXNvbHZlcjogU3VtbWFyeVJlc29sdmVyPFN0YXRpY1N5bWJvbD4sXG4gICAgICBwcml2YXRlIHN5bWJvbFJlc29sdmVyOiBTdGF0aWNTeW1ib2xSZXNvbHZlcixcbiAgICAgIGtub3duTWV0YWRhdGFDbGFzc2VzOiB7bmFtZTogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nLCBjdG9yOiBhbnl9W10gPSBbXSxcbiAgICAgIGtub3duTWV0YWRhdGFGdW5jdGlvbnM6IHtuYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcsIGZuOiBhbnl9W10gPSBbXSxcbiAgICAgIHByaXZhdGUgZXJyb3JSZWNvcmRlcj86IChlcnJvcjogYW55LCBmaWxlTmFtZT86IHN0cmluZykgPT4gdm9pZCkge1xuICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnZlcnNpb25NYXAoKTtcbiAgICBrbm93bk1ldGFkYXRhQ2xhc3Nlcy5mb3JFYWNoKFxuICAgICAgICAoa2MpID0+IHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHRoaXMuZ2V0U3RhdGljU3ltYm9sKGtjLmZpbGVQYXRoLCBrYy5uYW1lKSwga2MuY3RvcikpO1xuICAgIGtub3duTWV0YWRhdGFGdW5jdGlvbnMuZm9yRWFjaChcbiAgICAgICAgKGtmKSA9PiB0aGlzLl9yZWdpc3RlckZ1bmN0aW9uKHRoaXMuZ2V0U3RhdGljU3ltYm9sKGtmLmZpbGVQYXRoLCBrZi5uYW1lKSwga2YuZm4pKTtcbiAgICB0aGlzLmFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZC5zZXQoXG4gICAgICAgIENvbXBpbGVTdW1tYXJ5S2luZC5EaXJlY3RpdmUsIFtjcmVhdGVEaXJlY3RpdmUsIGNyZWF0ZUNvbXBvbmVudF0pO1xuICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLnNldChDb21waWxlU3VtbWFyeUtpbmQuUGlwZSwgW2NyZWF0ZVBpcGVdKTtcbiAgICB0aGlzLmFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZC5zZXQoQ29tcGlsZVN1bW1hcnlLaW5kLk5nTW9kdWxlLCBbY3JlYXRlTmdNb2R1bGVdKTtcbiAgICB0aGlzLmFubm90YXRpb25Gb3JQYXJlbnRDbGFzc1dpdGhTdW1tYXJ5S2luZC5zZXQoXG4gICAgICAgIENvbXBpbGVTdW1tYXJ5S2luZC5JbmplY3RhYmxlLFxuICAgICAgICBbY3JlYXRlSW5qZWN0YWJsZSwgY3JlYXRlUGlwZSwgY3JlYXRlRGlyZWN0aXZlLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZU5nTW9kdWxlXSk7XG4gIH1cblxuICBjb21wb25lbnRNb2R1bGVVcmwodHlwZU9yRnVuYzogU3RhdGljU3ltYm9sKTogc3RyaW5nIHtcbiAgICBjb25zdCBzdGF0aWNTeW1ib2wgPSB0aGlzLmZpbmRTeW1ib2xEZWNsYXJhdGlvbih0eXBlT3JGdW5jKTtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xSZXNvbHZlci5nZXRSZXNvdXJjZVBhdGgoc3RhdGljU3ltYm9sKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZhbGlkYXRlIHRoZSBzcGVjaWZpZWQgYHN5bWJvbHNgIG9uIHByb2dyYW0gY2hhbmdlLlxuICAgKiBAcGFyYW0gc3ltYm9sc1xuICAgKi9cbiAgaW52YWxpZGF0ZVN5bWJvbHMoc3ltYm9sczogU3RhdGljU3ltYm9sW10pIHtcbiAgICBmb3IgKGNvbnN0IHN5bWJvbCBvZiBzeW1ib2xzKSB7XG4gICAgICB0aGlzLmFubm90YXRpb25DYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMuc2hhbGxvd0Fubm90YXRpb25DYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMucHJvcGVydHlDYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMucGFyYW1ldGVyQ2FjaGUuZGVsZXRlKHN5bWJvbCk7XG4gICAgICB0aGlzLm1ldGhvZENhY2hlLmRlbGV0ZShzeW1ib2wpO1xuICAgICAgdGhpcy5zdGF0aWNDYWNoZS5kZWxldGUoc3ltYm9sKTtcbiAgICAgIHRoaXMuY29udmVyc2lvbk1hcC5kZWxldGUoc3ltYm9sKTtcbiAgICB9XG4gIH1cblxuICByZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UocmVmOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IFN0YXRpY1N5bWJvbCB7XG4gICAgbGV0IGtleTogc3RyaW5nfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAoIWNvbnRhaW5pbmdGaWxlKSB7XG4gICAgICBrZXkgPSBgJHtyZWYubW9kdWxlTmFtZX06JHtyZWYubmFtZX1gO1xuICAgICAgY29uc3QgZGVjbGFyYXRpb25TeW1ib2wgPSB0aGlzLnJlc29sdmVkRXh0ZXJuYWxSZWZlcmVuY2VzLmdldChrZXkpO1xuICAgICAgaWYgKGRlY2xhcmF0aW9uU3ltYm9sKSByZXR1cm4gZGVjbGFyYXRpb25TeW1ib2w7XG4gICAgfVxuICAgIGNvbnN0IHJlZlN5bWJvbCA9XG4gICAgICAgIHRoaXMuc3ltYm9sUmVzb2x2ZXIuZ2V0U3ltYm9sQnlNb2R1bGUocmVmLm1vZHVsZU5hbWUgISwgcmVmLm5hbWUgISwgY29udGFpbmluZ0ZpbGUpO1xuICAgIGNvbnN0IGRlY2xhcmF0aW9uU3ltYm9sID0gdGhpcy5maW5kU3ltYm9sRGVjbGFyYXRpb24ocmVmU3ltYm9sKTtcbiAgICBpZiAoIWNvbnRhaW5pbmdGaWxlKSB7XG4gICAgICB0aGlzLnN5bWJvbFJlc29sdmVyLnJlY29yZE1vZHVsZU5hbWVGb3JGaWxlTmFtZShyZWZTeW1ib2wuZmlsZVBhdGgsIHJlZi5tb2R1bGVOYW1lICEpO1xuICAgICAgdGhpcy5zeW1ib2xSZXNvbHZlci5yZWNvcmRJbXBvcnRBcyhkZWNsYXJhdGlvblN5bWJvbCwgcmVmU3ltYm9sKTtcbiAgICB9XG4gICAgaWYgKGtleSkge1xuICAgICAgdGhpcy5yZXNvbHZlZEV4dGVybmFsUmVmZXJlbmNlcy5zZXQoa2V5LCBkZWNsYXJhdGlvblN5bWJvbCk7XG4gICAgfVxuICAgIHJldHVybiBkZWNsYXJhdGlvblN5bWJvbDtcbiAgfVxuXG4gIGZpbmREZWNsYXJhdGlvbihtb2R1bGVVcmw6IHN0cmluZywgbmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IFN0YXRpY1N5bWJvbCB7XG4gICAgcmV0dXJuIHRoaXMuZmluZFN5bWJvbERlY2xhcmF0aW9uKFxuICAgICAgICB0aGlzLnN5bWJvbFJlc29sdmVyLmdldFN5bWJvbEJ5TW9kdWxlKG1vZHVsZVVybCwgbmFtZSwgY29udGFpbmluZ0ZpbGUpKTtcbiAgfVxuXG4gIHRyeUZpbmREZWNsYXJhdGlvbihtb2R1bGVVcmw6IHN0cmluZywgbmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZT86IHN0cmluZyk6IFN0YXRpY1N5bWJvbCB7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9sUmVzb2x2ZXIuaWdub3JlRXJyb3JzRm9yKFxuICAgICAgICAoKSA9PiB0aGlzLmZpbmREZWNsYXJhdGlvbihtb2R1bGVVcmwsIG5hbWUsIGNvbnRhaW5pbmdGaWxlKSk7XG4gIH1cblxuICBmaW5kU3ltYm9sRGVjbGFyYXRpb24oc3ltYm9sOiBTdGF0aWNTeW1ib2wpOiBTdGF0aWNTeW1ib2wge1xuICAgIGNvbnN0IHJlc29sdmVkU3ltYm9sID0gdGhpcy5zeW1ib2xSZXNvbHZlci5yZXNvbHZlU3ltYm9sKHN5bWJvbCk7XG4gICAgaWYgKHJlc29sdmVkU3ltYm9sKSB7XG4gICAgICBsZXQgcmVzb2x2ZWRNZXRhZGF0YSA9IHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhO1xuICAgICAgaWYgKHJlc29sdmVkTWV0YWRhdGEgJiYgcmVzb2x2ZWRNZXRhZGF0YS5fX3N5bWJvbGljID09PSAncmVzb2x2ZWQnKSB7XG4gICAgICAgIHJlc29sdmVkTWV0YWRhdGEgPSByZXNvbHZlZE1ldGFkYXRhLnN5bWJvbDtcbiAgICAgIH1cbiAgICAgIGlmIChyZXNvbHZlZE1ldGFkYXRhIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbmRTeW1ib2xEZWNsYXJhdGlvbihyZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzeW1ib2w7XG4gIH1cblxuICBwdWJsaWMgdHJ5QW5ub3RhdGlvbnModHlwZTogU3RhdGljU3ltYm9sKTogYW55W10ge1xuICAgIGNvbnN0IG9yaWdpbmFsUmVjb3JkZXIgPSB0aGlzLmVycm9yUmVjb3JkZXI7XG4gICAgdGhpcy5lcnJvclJlY29yZGVyID0gKGVycm9yOiBhbnksIGZpbGVOYW1lPzogc3RyaW5nKSA9PiB7fTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMuYW5ub3RhdGlvbnModHlwZSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuZXJyb3JSZWNvcmRlciA9IG9yaWdpbmFsUmVjb3JkZXI7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFubm90YXRpb25zKHR5cGU6IFN0YXRpY1N5bWJvbCk6IGFueVtdIHtcbiAgICByZXR1cm4gdGhpcy5fYW5ub3RhdGlvbnMoXG4gICAgICAgIHR5cGUsICh0eXBlOiBTdGF0aWNTeW1ib2wsIGRlY29yYXRvcnM6IGFueSkgPT4gdGhpcy5zaW1wbGlmeSh0eXBlLCBkZWNvcmF0b3JzKSxcbiAgICAgICAgdGhpcy5hbm5vdGF0aW9uQ2FjaGUpO1xuICB9XG5cbiAgcHVibGljIHNoYWxsb3dBbm5vdGF0aW9ucyh0eXBlOiBTdGF0aWNTeW1ib2wpOiBhbnlbXSB7XG4gICAgcmV0dXJuIHRoaXMuX2Fubm90YXRpb25zKFxuICAgICAgICB0eXBlLCAodHlwZTogU3RhdGljU3ltYm9sLCBkZWNvcmF0b3JzOiBhbnkpID0+IHRoaXMuc2ltcGxpZnkodHlwZSwgZGVjb3JhdG9ycywgdHJ1ZSksXG4gICAgICAgIHRoaXMuc2hhbGxvd0Fubm90YXRpb25DYWNoZSk7XG4gIH1cblxuICBwcml2YXRlIF9hbm5vdGF0aW9ucyhcbiAgICAgIHR5cGU6IFN0YXRpY1N5bWJvbCwgc2ltcGxpZnk6ICh0eXBlOiBTdGF0aWNTeW1ib2wsIGRlY29yYXRvcnM6IGFueSkgPT4gYW55LFxuICAgICAgYW5ub3RhdGlvbkNhY2hlOiBNYXA8U3RhdGljU3ltYm9sLCBhbnlbXT4pOiBhbnlbXSB7XG4gICAgbGV0IGFubm90YXRpb25zID0gYW5ub3RhdGlvbkNhY2hlLmdldCh0eXBlKTtcbiAgICBpZiAoIWFubm90YXRpb25zKSB7XG4gICAgICBhbm5vdGF0aW9ucyA9IFtdO1xuICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHRoaXMuZmluZFBhcmVudFR5cGUodHlwZSwgY2xhc3NNZXRhZGF0YSk7XG4gICAgICBpZiAocGFyZW50VHlwZSkge1xuICAgICAgICBjb25zdCBwYXJlbnRBbm5vdGF0aW9ucyA9IHRoaXMuYW5ub3RhdGlvbnMocGFyZW50VHlwZSk7XG4gICAgICAgIGFubm90YXRpb25zLnB1c2goLi4ucGFyZW50QW5ub3RhdGlvbnMpO1xuICAgICAgfVxuICAgICAgbGV0IG93bkFubm90YXRpb25zOiBhbnlbXSA9IFtdO1xuICAgICAgaWYgKGNsYXNzTWV0YWRhdGFbJ2RlY29yYXRvcnMnXSkge1xuICAgICAgICBvd25Bbm5vdGF0aW9ucyA9IHNpbXBsaWZ5KHR5cGUsIGNsYXNzTWV0YWRhdGFbJ2RlY29yYXRvcnMnXSk7XG4gICAgICAgIGlmIChvd25Bbm5vdGF0aW9ucykge1xuICAgICAgICAgIGFubm90YXRpb25zLnB1c2goLi4ub3duQW5ub3RhdGlvbnMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocGFyZW50VHlwZSAmJiAhdGhpcy5zdW1tYXJ5UmVzb2x2ZXIuaXNMaWJyYXJ5RmlsZSh0eXBlLmZpbGVQYXRoKSAmJlxuICAgICAgICAgIHRoaXMuc3VtbWFyeVJlc29sdmVyLmlzTGlicmFyeUZpbGUocGFyZW50VHlwZS5maWxlUGF0aCkpIHtcbiAgICAgICAgY29uc3Qgc3VtbWFyeSA9IHRoaXMuc3VtbWFyeVJlc29sdmVyLnJlc29sdmVTdW1tYXJ5KHBhcmVudFR5cGUpO1xuICAgICAgICBpZiAoc3VtbWFyeSAmJiBzdW1tYXJ5LnR5cGUpIHtcbiAgICAgICAgICBjb25zdCByZXF1aXJlZEFubm90YXRpb25UeXBlcyA9XG4gICAgICAgICAgICAgIHRoaXMuYW5ub3RhdGlvbkZvclBhcmVudENsYXNzV2l0aFN1bW1hcnlLaW5kLmdldChzdW1tYXJ5LnR5cGUuc3VtbWFyeUtpbmQgISkgITtcbiAgICAgICAgICBjb25zdCB0eXBlSGFzUmVxdWlyZWRBbm5vdGF0aW9uID0gcmVxdWlyZWRBbm5vdGF0aW9uVHlwZXMuc29tZShcbiAgICAgICAgICAgICAgKHJlcXVpcmVkVHlwZSkgPT4gb3duQW5ub3RhdGlvbnMuc29tZShhbm4gPT4gcmVxdWlyZWRUeXBlLmlzVHlwZU9mKGFubikpKTtcbiAgICAgICAgICBpZiAoIXR5cGVIYXNSZXF1aXJlZEFubm90YXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgICAgZm9ybWF0TWV0YWRhdGFFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgbWV0YWRhdGFFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgIGBDbGFzcyAke3R5cGUubmFtZX0gaW4gJHt0eXBlLmZpbGVQYXRofSBleHRlbmRzIGZyb20gYSAke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIENvbXBpbGVTdW1tYXJ5S2luZFtzdW1tYXJ5LnR5cGUuc3VtbWFyeUtpbmQhXG4gICAgICAgICAgICBdfSBpbiBhbm90aGVyIGNvbXBpbGF0aW9uIHVuaXQgd2l0aG91dCBkdXBsaWNhdGluZyB0aGUgZGVjb3JhdG9yYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIHN1bW1hcnkgKi8gdW5kZWZpbmVkLCBgUGxlYXNlIGFkZCBhICR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRBbm5vdGF0aW9uVHlwZXMubWFwKCh0eXBlKSA9PiB0eXBlLm5nTWV0YWRhdGFOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuam9pbignIG9yICcpfSBkZWNvcmF0b3IgdG8gdGhlIGNsYXNzYCksXG4gICAgICAgICAgICAgICAgICAgIHR5cGUpLFxuICAgICAgICAgICAgICAgIHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYW5ub3RhdGlvbkNhY2hlLnNldCh0eXBlLCBhbm5vdGF0aW9ucy5maWx0ZXIoYW5uID0+ICEhYW5uKSk7XG4gICAgfVxuICAgIHJldHVybiBhbm5vdGF0aW9ucztcbiAgfVxuXG4gIHB1YmxpYyBwcm9wTWV0YWRhdGEodHlwZTogU3RhdGljU3ltYm9sKToge1trZXk6IHN0cmluZ106IGFueVtdfSB7XG4gICAgbGV0IHByb3BNZXRhZGF0YSA9IHRoaXMucHJvcGVydHlDYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFwcm9wTWV0YWRhdGEpIHtcbiAgICAgIGNvbnN0IGNsYXNzTWV0YWRhdGEgPSB0aGlzLmdldFR5cGVNZXRhZGF0YSh0eXBlKTtcbiAgICAgIHByb3BNZXRhZGF0YSA9IHt9O1xuICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHRoaXMuZmluZFBhcmVudFR5cGUodHlwZSwgY2xhc3NNZXRhZGF0YSk7XG4gICAgICBpZiAocGFyZW50VHlwZSkge1xuICAgICAgICBjb25zdCBwYXJlbnRQcm9wTWV0YWRhdGEgPSB0aGlzLnByb3BNZXRhZGF0YShwYXJlbnRUeXBlKTtcbiAgICAgICAgT2JqZWN0LmtleXMocGFyZW50UHJvcE1ldGFkYXRhKS5mb3JFYWNoKChwYXJlbnRQcm9wKSA9PiB7XG4gICAgICAgICAgcHJvcE1ldGFkYXRhICFbcGFyZW50UHJvcF0gPSBwYXJlbnRQcm9wTWV0YWRhdGFbcGFyZW50UHJvcF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtZW1iZXJzID0gY2xhc3NNZXRhZGF0YVsnbWVtYmVycyddIHx8IHt9O1xuICAgICAgT2JqZWN0LmtleXMobWVtYmVycykuZm9yRWFjaCgocHJvcE5hbWUpID0+IHtcbiAgICAgICAgY29uc3QgcHJvcERhdGEgPSBtZW1iZXJzW3Byb3BOYW1lXTtcbiAgICAgICAgY29uc3QgcHJvcCA9ICg8YW55W10+cHJvcERhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLmZpbmQoYSA9PiBhWydfX3N5bWJvbGljJ10gPT0gJ3Byb3BlcnR5JyB8fCBhWydfX3N5bWJvbGljJ10gPT0gJ21ldGhvZCcpO1xuICAgICAgICBjb25zdCBkZWNvcmF0b3JzOiBhbnlbXSA9IFtdO1xuICAgICAgICBpZiAocHJvcE1ldGFkYXRhICFbcHJvcE5hbWVdKSB7XG4gICAgICAgICAgZGVjb3JhdG9ycy5wdXNoKC4uLnByb3BNZXRhZGF0YSAhW3Byb3BOYW1lXSk7XG4gICAgICAgIH1cbiAgICAgICAgcHJvcE1ldGFkYXRhICFbcHJvcE5hbWVdID0gZGVjb3JhdG9ycztcbiAgICAgICAgaWYgKHByb3AgJiYgcHJvcFsnZGVjb3JhdG9ycyddKSB7XG4gICAgICAgICAgZGVjb3JhdG9ycy5wdXNoKC4uLnRoaXMuc2ltcGxpZnkodHlwZSwgcHJvcFsnZGVjb3JhdG9ycyddKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgdGhpcy5wcm9wZXJ0eUNhY2hlLnNldCh0eXBlLCBwcm9wTWV0YWRhdGEpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcE1ldGFkYXRhO1xuICB9XG5cbiAgcHVibGljIHBhcmFtZXRlcnModHlwZTogU3RhdGljU3ltYm9sKTogYW55W10ge1xuICAgIGlmICghKHR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgIG5ldyBFcnJvcihgcGFyYW1ldGVycyByZWNlaXZlZCAke0pTT04uc3RyaW5naWZ5KHR5cGUpfSB3aGljaCBpcyBub3QgYSBTdGF0aWNTeW1ib2xgKSxcbiAgICAgICAgICB0eXBlKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwYXJhbWV0ZXJzID0gdGhpcy5wYXJhbWV0ZXJDYWNoZS5nZXQodHlwZSk7XG4gICAgICBpZiAoIXBhcmFtZXRlcnMpIHtcbiAgICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdGhpcy5maW5kUGFyZW50VHlwZSh0eXBlLCBjbGFzc01ldGFkYXRhKTtcbiAgICAgICAgY29uc3QgbWVtYmVycyA9IGNsYXNzTWV0YWRhdGEgPyBjbGFzc01ldGFkYXRhWydtZW1iZXJzJ10gOiBudWxsO1xuICAgICAgICBjb25zdCBjdG9yRGF0YSA9IG1lbWJlcnMgPyBtZW1iZXJzWydfX2N0b3JfXyddIDogbnVsbDtcbiAgICAgICAgaWYgKGN0b3JEYXRhKSB7XG4gICAgICAgICAgY29uc3QgY3RvciA9ICg8YW55W10+Y3RvckRhdGEpLmZpbmQoYSA9PiBhWydfX3N5bWJvbGljJ10gPT0gJ2NvbnN0cnVjdG9yJyk7XG4gICAgICAgICAgY29uc3QgcmF3UGFyYW1ldGVyVHlwZXMgPSA8YW55W10+Y3RvclsncGFyYW1ldGVycyddIHx8IFtdO1xuICAgICAgICAgIGNvbnN0IHBhcmFtZXRlckRlY29yYXRvcnMgPSA8YW55W10+dGhpcy5zaW1wbGlmeSh0eXBlLCBjdG9yWydwYXJhbWV0ZXJEZWNvcmF0b3JzJ10gfHwgW10pO1xuICAgICAgICAgIHBhcmFtZXRlcnMgPSBbXTtcbiAgICAgICAgICByYXdQYXJhbWV0ZXJUeXBlcy5mb3JFYWNoKChyYXdQYXJhbVR5cGUsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXN0ZWRSZXN1bHQ6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCBwYXJhbVR5cGUgPSB0aGlzLnRyeVNpbXBsaWZ5KHR5cGUsIHJhd1BhcmFtVHlwZSk7XG4gICAgICAgICAgICBpZiAocGFyYW1UeXBlKSBuZXN0ZWRSZXN1bHQucHVzaChwYXJhbVR5cGUpO1xuICAgICAgICAgICAgY29uc3QgZGVjb3JhdG9ycyA9IHBhcmFtZXRlckRlY29yYXRvcnMgPyBwYXJhbWV0ZXJEZWNvcmF0b3JzW2luZGV4XSA6IG51bGw7XG4gICAgICAgICAgICBpZiAoZGVjb3JhdG9ycykge1xuICAgICAgICAgICAgICBuZXN0ZWRSZXN1bHQucHVzaCguLi5kZWNvcmF0b3JzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhcmFtZXRlcnMgIS5wdXNoKG5lc3RlZFJlc3VsdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAocGFyZW50VHlwZSkge1xuICAgICAgICAgIHBhcmFtZXRlcnMgPSB0aGlzLnBhcmFtZXRlcnMocGFyZW50VHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgcGFyYW1ldGVycyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucGFyYW1ldGVyQ2FjaGUuc2V0KHR5cGUsIHBhcmFtZXRlcnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmFtZXRlcnM7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIG9uIHR5cGUgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0gd2l0aCBlcnJvciAke2V9YCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX21ldGhvZE5hbWVzKHR5cGU6IGFueSk6IHtba2V5OiBzdHJpbmddOiBib29sZWFufSB7XG4gICAgbGV0IG1ldGhvZE5hbWVzID0gdGhpcy5tZXRob2RDYWNoZS5nZXQodHlwZSk7XG4gICAgaWYgKCFtZXRob2ROYW1lcykge1xuICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgbWV0aG9kTmFtZXMgPSB7fTtcbiAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0aGlzLmZpbmRQYXJlbnRUeXBlKHR5cGUsIGNsYXNzTWV0YWRhdGEpO1xuICAgICAgaWYgKHBhcmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TWV0aG9kTmFtZXMgPSB0aGlzLl9tZXRob2ROYW1lcyhwYXJlbnRUeXBlKTtcbiAgICAgICAgT2JqZWN0LmtleXMocGFyZW50TWV0aG9kTmFtZXMpLmZvckVhY2goKHBhcmVudFByb3ApID0+IHtcbiAgICAgICAgICBtZXRob2ROYW1lcyAhW3BhcmVudFByb3BdID0gcGFyZW50TWV0aG9kTmFtZXNbcGFyZW50UHJvcF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtZW1iZXJzID0gY2xhc3NNZXRhZGF0YVsnbWVtYmVycyddIHx8IHt9O1xuICAgICAgT2JqZWN0LmtleXMobWVtYmVycykuZm9yRWFjaCgocHJvcE5hbWUpID0+IHtcbiAgICAgICAgY29uc3QgcHJvcERhdGEgPSBtZW1iZXJzW3Byb3BOYW1lXTtcbiAgICAgICAgY29uc3QgaXNNZXRob2QgPSAoPGFueVtdPnByb3BEYXRhKS5zb21lKGEgPT4gYVsnX19zeW1ib2xpYyddID09ICdtZXRob2QnKTtcbiAgICAgICAgbWV0aG9kTmFtZXMgIVtwcm9wTmFtZV0gPSBtZXRob2ROYW1lcyAhW3Byb3BOYW1lXSB8fCBpc01ldGhvZDtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5tZXRob2RDYWNoZS5zZXQodHlwZSwgbWV0aG9kTmFtZXMpO1xuICAgIH1cbiAgICByZXR1cm4gbWV0aG9kTmFtZXM7XG4gIH1cblxuICBwcml2YXRlIF9zdGF0aWNNZW1iZXJzKHR5cGU6IFN0YXRpY1N5bWJvbCk6IHN0cmluZ1tdIHtcbiAgICBsZXQgc3RhdGljTWVtYmVycyA9IHRoaXMuc3RhdGljQ2FjaGUuZ2V0KHR5cGUpO1xuICAgIGlmICghc3RhdGljTWVtYmVycykge1xuICAgICAgY29uc3QgY2xhc3NNZXRhZGF0YSA9IHRoaXMuZ2V0VHlwZU1ldGFkYXRhKHR5cGUpO1xuICAgICAgY29uc3Qgc3RhdGljTWVtYmVyRGF0YSA9IGNsYXNzTWV0YWRhdGFbJ3N0YXRpY3MnXSB8fCB7fTtcbiAgICAgIHN0YXRpY01lbWJlcnMgPSBPYmplY3Qua2V5cyhzdGF0aWNNZW1iZXJEYXRhKTtcbiAgICAgIHRoaXMuc3RhdGljQ2FjaGUuc2V0KHR5cGUsIHN0YXRpY01lbWJlcnMpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGljTWVtYmVycztcbiAgfVxuXG5cbiAgcHJpdmF0ZSBmaW5kUGFyZW50VHlwZSh0eXBlOiBTdGF0aWNTeW1ib2wsIGNsYXNzTWV0YWRhdGE6IGFueSk6IFN0YXRpY1N5bWJvbHx1bmRlZmluZWQge1xuICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0aGlzLnRyeVNpbXBsaWZ5KHR5cGUsIGNsYXNzTWV0YWRhdGFbJ2V4dGVuZHMnXSk7XG4gICAgaWYgKHBhcmVudFR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgIHJldHVybiBwYXJlbnRUeXBlO1xuICAgIH1cbiAgfVxuXG4gIGhhc0xpZmVjeWNsZUhvb2sodHlwZTogYW55LCBsY1Byb3BlcnR5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAoISh0eXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihcbiAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBoYXNMaWZlY3ljbGVIb29rIHJlY2VpdmVkICR7SlNPTi5zdHJpbmdpZnkodHlwZSl9IHdoaWNoIGlzIG5vdCBhIFN0YXRpY1N5bWJvbGApLFxuICAgICAgICAgIHR5cGUpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgcmV0dXJuICEhdGhpcy5fbWV0aG9kTmFtZXModHlwZSlbbGNQcm9wZXJ0eV07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIG9uIHR5cGUgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0gd2l0aCBlcnJvciAke2V9YCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIGd1YXJkcyh0eXBlOiBhbnkpOiB7W2tleTogc3RyaW5nXTogU3RhdGljU3ltYm9sfSB7XG4gICAgaWYgKCEodHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKGBndWFyZHMgcmVjZWl2ZWQgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0gd2hpY2ggaXMgbm90IGEgU3RhdGljU3ltYm9sYCksIHR5cGUpO1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cbiAgICBjb25zdCBzdGF0aWNNZW1iZXJzID0gdGhpcy5fc3RhdGljTWVtYmVycyh0eXBlKTtcbiAgICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBTdGF0aWNTeW1ib2x9ID0ge307XG4gICAgZm9yIChsZXQgbmFtZSBvZiBzdGF0aWNNZW1iZXJzKSB7XG4gICAgICBpZiAobmFtZS5lbmRzV2l0aChUWVBFR1VBUkRfUE9TVEZJWCkpIHtcbiAgICAgICAgbGV0IHByb3BlcnR5ID0gbmFtZS5zdWJzdHIoMCwgbmFtZS5sZW5ndGggLSBUWVBFR1VBUkRfUE9TVEZJWC5sZW5ndGgpO1xuICAgICAgICBsZXQgdmFsdWU6IGFueTtcbiAgICAgICAgaWYgKHByb3BlcnR5LmVuZHNXaXRoKFVTRV9JRikpIHtcbiAgICAgICAgICBwcm9wZXJ0eSA9IG5hbWUuc3Vic3RyKDAsIHByb3BlcnR5Lmxlbmd0aCAtIFVTRV9JRi5sZW5ndGgpO1xuICAgICAgICAgIHZhbHVlID0gVVNFX0lGO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gdGhpcy5nZXRTdGF0aWNTeW1ib2wodHlwZS5maWxlUGF0aCwgdHlwZS5uYW1lLCBbbmFtZV0pO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0eXBlOiBTdGF0aWNTeW1ib2wsIGN0b3I6IGFueSk6IHZvaWQge1xuICAgIHRoaXMuY29udmVyc2lvbk1hcC5zZXQodHlwZSwgKGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgYXJnczogYW55W10pID0+IG5ldyBjdG9yKC4uLmFyZ3MpKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlZ2lzdGVyRnVuY3Rpb24odHlwZTogU3RhdGljU3ltYm9sLCBmbjogYW55KTogdm9pZCB7XG4gICAgdGhpcy5jb252ZXJzaW9uTWFwLnNldCh0eXBlLCAoY29udGV4dDogU3RhdGljU3ltYm9sLCBhcmdzOiBhbnlbXSkgPT4gZm4uYXBwbHkodW5kZWZpbmVkLCBhcmdzKSk7XG4gIH1cblxuICBwcml2YXRlIGluaXRpYWxpemVDb252ZXJzaW9uTWFwKCk6IHZvaWQge1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSW5qZWN0YWJsZScpLCBjcmVhdGVJbmplY3RhYmxlKTtcbiAgICB0aGlzLmluamVjdGlvblRva2VuID0gdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSW5qZWN0aW9uVG9rZW4nKTtcbiAgICB0aGlzLm9wYXF1ZVRva2VuID0gdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnT3BhcXVlVG9rZW4nKTtcbiAgICB0aGlzLlJPVVRFUyA9IHRoaXMudHJ5RmluZERlY2xhcmF0aW9uKEFOR1VMQVJfUk9VVEVSLCAnUk9VVEVTJyk7XG4gICAgdGhpcy5BTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTID1cbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnQU5BTFlaRV9GT1JfRU5UUllfQ09NUE9ORU5UUycpO1xuXG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0hvc3QnKSwgY3JlYXRlSG9zdCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1NlbGYnKSwgY3JlYXRlU2VsZik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdTa2lwU2VsZicpLCBjcmVhdGVTa2lwU2VsZik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdJbmplY3QnKSwgY3JlYXRlSW5qZWN0KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ09wdGlvbmFsJyksIGNyZWF0ZU9wdGlvbmFsKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0F0dHJpYnV0ZScpLCBjcmVhdGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnQ29udGVudENoaWxkJyksIGNyZWF0ZUNvbnRlbnRDaGlsZCk7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdDb250ZW50Q2hpbGRyZW4nKSwgY3JlYXRlQ29udGVudENoaWxkcmVuKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1ZpZXdDaGlsZCcpLCBjcmVhdGVWaWV3Q2hpbGQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnVmlld0NoaWxkcmVuJyksIGNyZWF0ZVZpZXdDaGlsZHJlbik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0lucHV0JyksIGNyZWF0ZUlucHV0KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ091dHB1dCcpLCBjcmVhdGVPdXRwdXQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3Rvcih0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdQaXBlJyksIGNyZWF0ZVBpcGUpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSG9zdEJpbmRpbmcnKSwgY3JlYXRlSG9zdEJpbmRpbmcpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSG9zdExpc3RlbmVyJyksIGNyZWF0ZUhvc3RMaXN0ZW5lcik7XG4gICAgdGhpcy5fcmVnaXN0ZXJEZWNvcmF0b3JPckNvbnN0cnVjdG9yKFxuICAgICAgICB0aGlzLmZpbmREZWNsYXJhdGlvbihBTkdVTEFSX0NPUkUsICdEaXJlY3RpdmUnKSwgY3JlYXRlRGlyZWN0aXZlKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ0NvbXBvbmVudCcpLCBjcmVhdGVDb21wb25lbnQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyRGVjb3JhdG9yT3JDb25zdHJ1Y3RvcihcbiAgICAgICAgdGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnTmdNb2R1bGUnKSwgY3JlYXRlTmdNb2R1bGUpO1xuXG4gICAgLy8gTm90ZTogU29tZSBtZXRhZGF0YSBjbGFzc2VzIGNhbiBiZSB1c2VkIGRpcmVjdGx5IHdpdGggUHJvdmlkZXIuZGVwcy5cbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnSG9zdCcpLCBjcmVhdGVIb3N0KTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IodGhpcy5maW5kRGVjbGFyYXRpb24oQU5HVUxBUl9DT1JFLCAnU2VsZicpLCBjcmVhdGVTZWxmKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ1NraXBTZWxmJyksIGNyZWF0ZVNraXBTZWxmKTtcbiAgICB0aGlzLl9yZWdpc3RlckRlY29yYXRvck9yQ29uc3RydWN0b3IoXG4gICAgICAgIHRoaXMuZmluZERlY2xhcmF0aW9uKEFOR1VMQVJfQ09SRSwgJ09wdGlvbmFsJyksIGNyZWF0ZU9wdGlvbmFsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBnZXRTdGF0aWNTeW1ib2wgcHJvZHVjZXMgYSBUeXBlIHdob3NlIG1ldGFkYXRhIGlzIGtub3duIGJ1dCB3aG9zZSBpbXBsZW1lbnRhdGlvbiBpcyBub3QgbG9hZGVkLlxuICAgKiBBbGwgdHlwZXMgcGFzc2VkIHRvIHRoZSBTdGF0aWNSZXNvbHZlciBzaG91bGQgYmUgcHNldWRvLXR5cGVzIHJldHVybmVkIGJ5IHRoaXMgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0gZGVjbGFyYXRpb25GaWxlIHRoZSBhYnNvbHV0ZSBwYXRoIG9mIHRoZSBmaWxlIHdoZXJlIHRoZSBzeW1ib2wgaXMgZGVjbGFyZWRcbiAgICogQHBhcmFtIG5hbWUgdGhlIG5hbWUgb2YgdGhlIHR5cGUuXG4gICAqL1xuICBnZXRTdGF0aWNTeW1ib2woZGVjbGFyYXRpb25GaWxlOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgbWVtYmVycz86IHN0cmluZ1tdKTogU3RhdGljU3ltYm9sIHtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xSZXNvbHZlci5nZXRTdGF0aWNTeW1ib2woZGVjbGFyYXRpb25GaWxlLCBuYW1lLCBtZW1iZXJzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTaW1wbGlmeSBidXQgZGlzY2FyZCBhbnkgZXJyb3JzXG4gICAqL1xuICBwcml2YXRlIHRyeVNpbXBsaWZ5KGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgdmFsdWU6IGFueSk6IGFueSB7XG4gICAgY29uc3Qgb3JpZ2luYWxSZWNvcmRlciA9IHRoaXMuZXJyb3JSZWNvcmRlcjtcbiAgICB0aGlzLmVycm9yUmVjb3JkZXIgPSAoZXJyb3I6IGFueSwgZmlsZU5hbWU/OiBzdHJpbmcpID0+IHt9O1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuc2ltcGxpZnkoY29udGV4dCwgdmFsdWUpO1xuICAgIHRoaXMuZXJyb3JSZWNvcmRlciA9IG9yaWdpbmFsUmVjb3JkZXI7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHVibGljIHNpbXBsaWZ5KGNvbnRleHQ6IFN0YXRpY1N5bWJvbCwgdmFsdWU6IGFueSwgbGF6eTogYm9vbGVhbiA9IGZhbHNlKTogYW55IHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBsZXQgc2NvcGUgPSBCaW5kaW5nU2NvcGUuZW1wdHk7XG4gICAgY29uc3QgY2FsbGluZyA9IG5ldyBNYXA8U3RhdGljU3ltYm9sLCBib29sZWFuPigpO1xuICAgIGNvbnN0IHJvb3RDb250ZXh0ID0gY29udGV4dDtcblxuICAgIGZ1bmN0aW9uIHNpbXBsaWZ5SW5Db250ZXh0KFxuICAgICAgICBjb250ZXh0OiBTdGF0aWNTeW1ib2wsIHZhbHVlOiBhbnksIGRlcHRoOiBudW1iZXIsIHJlZmVyZW5jZXM6IG51bWJlcik6IGFueSB7XG4gICAgICBmdW5jdGlvbiByZXNvbHZlUmVmZXJlbmNlVmFsdWUoc3RhdGljU3ltYm9sOiBTdGF0aWNTeW1ib2wpOiBhbnkge1xuICAgICAgICBjb25zdCByZXNvbHZlZFN5bWJvbCA9IHNlbGYuc3ltYm9sUmVzb2x2ZXIucmVzb2x2ZVN5bWJvbChzdGF0aWNTeW1ib2wpO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZWRTeW1ib2wgPyByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSA6IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5RWFnZXJseSh2YWx1ZTogYW55KTogYW55IHtcbiAgICAgICAgcmV0dXJuIHNpbXBsaWZ5SW5Db250ZXh0KGNvbnRleHQsIHZhbHVlLCBkZXB0aCwgMCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5TGF6aWx5KHZhbHVlOiBhbnkpOiBhbnkge1xuICAgICAgICByZXR1cm4gc2ltcGxpZnlJbkNvbnRleHQoY29udGV4dCwgdmFsdWUsIGRlcHRoLCByZWZlcmVuY2VzICsgMSk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5TmVzdGVkKG5lc3RlZENvbnRleHQ6IFN0YXRpY1N5bWJvbCwgdmFsdWU6IGFueSk6IGFueSB7XG4gICAgICAgIGlmIChuZXN0ZWRDb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgICAgLy8gSWYgdGhlIGNvbnRleHQgaGFzbid0IGNoYW5nZWQgbGV0IHRoZSBleGNlcHRpb24gcHJvcGFnYXRlIHVubW9kaWZpZWQuXG4gICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5SW5Db250ZXh0KG5lc3RlZENvbnRleHQsIHZhbHVlLCBkZXB0aCArIDEsIHJlZmVyZW5jZXMpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5SW5Db250ZXh0KG5lc3RlZENvbnRleHQsIHZhbHVlLCBkZXB0aCArIDEsIHJlZmVyZW5jZXMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgaWYgKGlzTWV0YWRhdGFFcnJvcihlKSkge1xuICAgICAgICAgICAgLy8gUHJvcGFnYXRlIHRoZSBtZXNzYWdlIHRleHQgdXAgYnV0IGFkZCBhIG1lc3NhZ2UgdG8gdGhlIGNoYWluIHRoYXQgZXhwbGFpbnMgaG93IHdlIGdvdFxuICAgICAgICAgICAgLy8gaGVyZS5cbiAgICAgICAgICAgIC8vIGUuY2hhaW4gaW1wbGllcyBlLnN5bWJvbFxuICAgICAgICAgICAgY29uc3Qgc3VtbWFyeU1zZyA9IGUuY2hhaW4gPyAncmVmZXJlbmNlcyBcXCcnICsgZS5zeW1ib2wgIS5uYW1lICsgJ1xcJycgOiBlcnJvclN1bW1hcnkoZSk7XG4gICAgICAgICAgICBjb25zdCBzdW1tYXJ5ID0gYCcke25lc3RlZENvbnRleHQubmFtZX0nICR7c3VtbWFyeU1zZ31gO1xuICAgICAgICAgICAgY29uc3QgY2hhaW4gPSB7bWVzc2FnZTogc3VtbWFyeSwgcG9zaXRpb246IGUucG9zaXRpb24sIG5leHQ6IGUuY2hhaW59O1xuICAgICAgICAgICAgLy8gVE9ETyhjaHVja2opOiByZXRyaWV2ZSB0aGUgcG9zaXRpb24gaW5mb3JtYXRpb24gaW5kaXJlY3RseSBmcm9tIHRoZSBjb2xsZWN0b3JzIG5vZGVcbiAgICAgICAgICAgIC8vIG1hcCBpZiB0aGUgbWV0YWRhdGEgaXMgZnJvbSBhIC50cyBmaWxlLlxuICAgICAgICAgICAgc2VsZi5lcnJvcihcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOiBlLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICBhZHZpc2U6IGUuYWR2aXNlLFxuICAgICAgICAgICAgICAgICAgY29udGV4dDogZS5jb250ZXh0LCBjaGFpbixcbiAgICAgICAgICAgICAgICAgIHN5bWJvbDogbmVzdGVkQ29udGV4dFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgY29udGV4dCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEl0IGlzIHByb2JhYmx5IGFuIGludGVybmFsIGVycm9yLlxuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc2ltcGxpZnlDYWxsKFxuICAgICAgICAgIGZ1bmN0aW9uU3ltYm9sOiBTdGF0aWNTeW1ib2wsIHRhcmdldEZ1bmN0aW9uOiBhbnksIGFyZ3M6IGFueVtdLCB0YXJnZXRFeHByZXNzaW9uOiBhbnkpIHtcbiAgICAgICAgaWYgKHRhcmdldEZ1bmN0aW9uICYmIHRhcmdldEZ1bmN0aW9uWydfX3N5bWJvbGljJ10gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGlmIChjYWxsaW5nLmdldChmdW5jdGlvblN5bWJvbCkpIHtcbiAgICAgICAgICAgIHNlbGYuZXJyb3IoXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1JlY3Vyc2lvbiBpcyBub3Qgc3VwcG9ydGVkJyxcbiAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IGBjYWxsZWQgJyR7ZnVuY3Rpb25TeW1ib2wubmFtZX0nIHJlY3Vyc2l2ZWx5YCxcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiB0YXJnZXRGdW5jdGlvblxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TeW1ib2wpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB0YXJnZXRGdW5jdGlvblsndmFsdWUnXTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAmJiAoZGVwdGggIT0gMCB8fCB2YWx1ZS5fX3N5bWJvbGljICE9ICdlcnJvcicpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IHN0cmluZ1tdID0gdGFyZ2V0RnVuY3Rpb25bJ3BhcmFtZXRlcnMnXTtcbiAgICAgICAgICAgICAgY29uc3QgZGVmYXVsdHM6IGFueVtdID0gdGFyZ2V0RnVuY3Rpb24uZGVmYXVsdHM7XG4gICAgICAgICAgICAgIGFyZ3MgPSBhcmdzLm1hcChhcmcgPT4gc2ltcGxpZnlOZXN0ZWQoY29udGV4dCwgYXJnKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGFyZyA9PiBzaG91bGRJZ25vcmUoYXJnKSA/IHVuZGVmaW5lZCA6IGFyZyk7XG4gICAgICAgICAgICAgIGlmIChkZWZhdWx0cyAmJiBkZWZhdWx0cy5sZW5ndGggPiBhcmdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFyZ3MucHVzaCguLi5kZWZhdWx0cy5zbGljZShhcmdzLmxlbmd0aCkubWFwKCh2YWx1ZTogYW55KSA9PiBzaW1wbGlmeSh2YWx1ZSkpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjYWxsaW5nLnNldChmdW5jdGlvblN5bWJvbCwgdHJ1ZSk7XG4gICAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uU2NvcGUgPSBCaW5kaW5nU2NvcGUuYnVpbGQoKTtcbiAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJhbWV0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TY29wZS5kZWZpbmUocGFyYW1ldGVyc1tpXSwgYXJnc1tpXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3Qgb2xkU2NvcGUgPSBzY29wZTtcbiAgICAgICAgICAgICAgbGV0IHJlc3VsdDogYW55O1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHNjb3BlID0gZnVuY3Rpb25TY29wZS5kb25lKCk7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gc2ltcGxpZnlOZXN0ZWQoZnVuY3Rpb25TeW1ib2wsIHZhbHVlKTtcbiAgICAgICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgICAgICBzY29wZSA9IG9sZFNjb3BlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIGNhbGxpbmcuZGVsZXRlKGZ1bmN0aW9uU3ltYm9sKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAvLyBJZiBkZXB0aCBpcyAwIHdlIGFyZSBldmFsdWF0aW5nIHRoZSB0b3AgbGV2ZWwgZXhwcmVzc2lvbiB0aGF0IGlzIGRlc2NyaWJpbmcgZWxlbWVudFxuICAgICAgICAgIC8vIGRlY29yYXRvci4gSW4gdGhpcyBjYXNlLCBpdCBpcyBhIGRlY29yYXRvciB3ZSBkb24ndCB1bmRlcnN0YW5kLCBzdWNoIGFzIGEgY3VzdG9tXG4gICAgICAgICAgLy8gbm9uLWFuZ3VsYXIgZGVjb3JhdG9yLCBhbmQgd2Ugc2hvdWxkIGp1c3QgaWdub3JlIGl0LlxuICAgICAgICAgIHJldHVybiBJR05PUkU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHBvc2l0aW9uOiBQb3NpdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmICh0YXJnZXRFeHByZXNzaW9uICYmIHRhcmdldEV4cHJlc3Npb24uX19zeW1ib2xpYyA9PSAncmVzb2x2ZWQnKSB7XG4gICAgICAgICAgY29uc3QgbGluZSA9IHRhcmdldEV4cHJlc3Npb24ubGluZTtcbiAgICAgICAgICBjb25zdCBjaGFyYWN0ZXIgPSB0YXJnZXRFeHByZXNzaW9uLmNoYXJhY3RlcjtcbiAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHRhcmdldEV4cHJlc3Npb24uZmlsZU5hbWU7XG4gICAgICAgICAgaWYgKGZpbGVOYW1lICE9IG51bGwgJiYgbGluZSAhPSBudWxsICYmIGNoYXJhY3RlciAhPSBudWxsKSB7XG4gICAgICAgICAgICBwb3NpdGlvbiA9IHtmaWxlTmFtZSwgbGluZSwgY29sdW1uOiBjaGFyYWN0ZXJ9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzZWxmLmVycm9yKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBtZXNzYWdlOiBGVU5DVElPTl9DQUxMX05PVF9TVVBQT1JURUQsXG4gICAgICAgICAgICAgIGNvbnRleHQ6IGZ1bmN0aW9uU3ltYm9sLFxuICAgICAgICAgICAgICB2YWx1ZTogdGFyZ2V0RnVuY3Rpb24sIHBvc2l0aW9uXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29udGV4dCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNpbXBsaWZ5KGV4cHJlc3Npb246IGFueSk6IGFueSB7XG4gICAgICAgIGlmIChpc1ByaW1pdGl2ZShleHByZXNzaW9uKSkge1xuICAgICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgICAgICB9XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGV4cHJlc3Npb24pKSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnlbXSA9IFtdO1xuICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiAoPGFueT5leHByZXNzaW9uKSkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGEgc3ByZWFkIGV4cHJlc3Npb25cbiAgICAgICAgICAgIGlmIChpdGVtICYmIGl0ZW0uX19zeW1ib2xpYyA9PT0gJ3NwcmVhZCcpIHtcbiAgICAgICAgICAgICAgLy8gV2UgY2FsbCB3aXRoIHJlZmVyZW5jZXMgYXMgMCBiZWNhdXNlIHdlIHJlcXVpcmUgdGhlIGFjdHVhbCB2YWx1ZSBhbmQgY2Fubm90XG4gICAgICAgICAgICAgIC8vIHRvbGVyYXRlIGEgcmVmZXJlbmNlIGhlcmUuXG4gICAgICAgICAgICAgIGNvbnN0IHNwcmVhZEFycmF5ID0gc2ltcGxpZnlFYWdlcmx5KGl0ZW0uZXhwcmVzc2lvbik7XG4gICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHNwcmVhZEFycmF5KSkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3ByZWFkSXRlbSBvZiBzcHJlYWRBcnJheSkge1xuICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goc3ByZWFkSXRlbSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHNpbXBsaWZ5KGl0ZW0pO1xuICAgICAgICAgICAgaWYgKHNob3VsZElnbm9yZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4cHJlc3Npb24gaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgICAgICAvLyBTdG9wIHNpbXBsaWZpY2F0aW9uIGF0IGJ1aWx0aW4gc3ltYm9scyBvciBpZiB3ZSBhcmUgaW4gYSByZWZlcmVuY2UgY29udGV4dCBhbmRcbiAgICAgICAgICAvLyB0aGUgc3ltYm9sIGRvZXNuJ3QgaGF2ZSBtZW1iZXJzLlxuICAgICAgICAgIGlmIChleHByZXNzaW9uID09PSBzZWxmLmluamVjdGlvblRva2VuIHx8IHNlbGYuY29udmVyc2lvbk1hcC5oYXMoZXhwcmVzc2lvbikgfHxcbiAgICAgICAgICAgICAgKHJlZmVyZW5jZXMgPiAwICYmICFleHByZXNzaW9uLm1lbWJlcnMubGVuZ3RoKSkge1xuICAgICAgICAgICAgcmV0dXJuIGV4cHJlc3Npb247XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRpY1N5bWJvbCA9IGV4cHJlc3Npb247XG4gICAgICAgICAgICBjb25zdCBkZWNsYXJhdGlvblZhbHVlID0gcmVzb2x2ZVJlZmVyZW5jZVZhbHVlKHN0YXRpY1N5bWJvbCk7XG4gICAgICAgICAgICBpZiAoZGVjbGFyYXRpb25WYWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeU5lc3RlZChzdGF0aWNTeW1ib2wsIGRlY2xhcmF0aW9uVmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN0YXRpY1N5bWJvbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4cHJlc3Npb24pIHtcbiAgICAgICAgICBpZiAoZXhwcmVzc2lvblsnX19zeW1ib2xpYyddKSB7XG4gICAgICAgICAgICBsZXQgc3RhdGljU3ltYm9sOiBTdGF0aWNTeW1ib2w7XG4gICAgICAgICAgICBzd2l0Y2ggKGV4cHJlc3Npb25bJ19fc3ltYm9saWMnXSkge1xuICAgICAgICAgICAgICBjYXNlICdiaW5vcCc6XG4gICAgICAgICAgICAgICAgbGV0IGxlZnQgPSBzaW1wbGlmeShleHByZXNzaW9uWydsZWZ0J10pO1xuICAgICAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUobGVmdCkpIHJldHVybiBsZWZ0O1xuICAgICAgICAgICAgICAgIGxldCByaWdodCA9IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ3JpZ2h0J10pO1xuICAgICAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUocmlnaHQpKSByZXR1cm4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChleHByZXNzaW9uWydvcGVyYXRvciddKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlICcmJic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICYmIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnfHwnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCB8fCByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ3wnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCB8IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnXic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IF4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICcmJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgJiByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPT0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICchPSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICE9IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPT09IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnIT09JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgIT09IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0IDwgcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc+JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPiByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPD0gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICc+PSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ID49IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnPDwnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCA8PCByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJz4+JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgPj4gcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgKyByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAtIHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgY2FzZSAnKic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsZWZ0ICogcmlnaHQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxlZnQgLyByaWdodDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyUnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGVmdCAlIHJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgY2FzZSAnaWYnOlxuICAgICAgICAgICAgICAgIGxldCBjb25kaXRpb24gPSBzaW1wbGlmeShleHByZXNzaW9uWydjb25kaXRpb24nXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbmRpdGlvbiA/IHNpbXBsaWZ5KGV4cHJlc3Npb25bJ3RoZW5FeHByZXNzaW9uJ10pIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2ltcGxpZnkoZXhwcmVzc2lvblsnZWxzZUV4cHJlc3Npb24nXSk7XG4gICAgICAgICAgICAgIGNhc2UgJ3ByZSc6XG4gICAgICAgICAgICAgICAgbGV0IG9wZXJhbmQgPSBzaW1wbGlmeShleHByZXNzaW9uWydvcGVyYW5kJ10pO1xuICAgICAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUob3BlcmFuZCkpIHJldHVybiBvcGVyYW5kO1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoZXhwcmVzc2lvblsnb3BlcmF0b3InXSkge1xuICAgICAgICAgICAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAtb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIW9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgICBjYXNlICd+JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIH5vcGVyYW5kO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgY2FzZSAnaW5kZXgnOlxuICAgICAgICAgICAgICAgIGxldCBpbmRleFRhcmdldCA9IHNpbXBsaWZ5RWFnZXJseShleHByZXNzaW9uWydleHByZXNzaW9uJ10pO1xuICAgICAgICAgICAgICAgIGxldCBpbmRleCA9IHNpbXBsaWZ5RWFnZXJseShleHByZXNzaW9uWydpbmRleCddKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhUYXJnZXQgJiYgaXNQcmltaXRpdmUoaW5kZXgpKSByZXR1cm4gaW5kZXhUYXJnZXRbaW5kZXhdO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICBjYXNlICdzZWxlY3QnOlxuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlciA9IGV4cHJlc3Npb25bJ21lbWJlciddO1xuICAgICAgICAgICAgICAgIGxldCBzZWxlY3RDb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgICAgICAgICBsZXQgc2VsZWN0VGFyZ2V0ID0gc2ltcGxpZnkoZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0VGFyZ2V0IGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJzID0gc2VsZWN0VGFyZ2V0Lm1lbWJlcnMuY29uY2F0KG1lbWJlcik7XG4gICAgICAgICAgICAgICAgICBzZWxlY3RDb250ZXh0ID1cbiAgICAgICAgICAgICAgICAgICAgICBzZWxmLmdldFN0YXRpY1N5bWJvbChzZWxlY3RUYXJnZXQuZmlsZVBhdGgsIHNlbGVjdFRhcmdldC5uYW1lLCBtZW1iZXJzKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uVmFsdWUgPSByZXNvbHZlUmVmZXJlbmNlVmFsdWUoc2VsZWN0Q29udGV4dCk7XG4gICAgICAgICAgICAgICAgICBpZiAoZGVjbGFyYXRpb25WYWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzaW1wbGlmeU5lc3RlZChzZWxlY3RDb250ZXh0LCBkZWNsYXJhdGlvblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxlY3RDb250ZXh0O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0VGFyZ2V0ICYmIGlzUHJpbWl0aXZlKG1lbWJlcikpXG4gICAgICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnlOZXN0ZWQoc2VsZWN0Q29udGV4dCwgc2VsZWN0VGFyZ2V0W21lbWJlcl0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICBjYXNlICdyZWZlcmVuY2UnOlxuICAgICAgICAgICAgICAgIC8vIE5vdGU6IFRoaXMgb25seSBoYXMgdG8gZGVhbCB3aXRoIHZhcmlhYmxlIHJlZmVyZW5jZXMsIGFzIHN5bWJvbCByZWZlcmVuY2VzIGhhdmVcbiAgICAgICAgICAgICAgICAvLyBiZWVuIGNvbnZlcnRlZCBpbnRvICdyZXNvbHZlZCdcbiAgICAgICAgICAgICAgICAvLyBpbiB0aGUgU3RhdGljU3ltYm9sUmVzb2x2ZXIuXG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZTogc3RyaW5nID0gZXhwcmVzc2lvblsnbmFtZSddO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2FsVmFsdWUgPSBzY29wZS5yZXNvbHZlKG5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChsb2NhbFZhbHVlICE9IEJpbmRpbmdTY29wZS5taXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbG9jYWxWYWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJ3Jlc29sdmVkJzpcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5KGV4cHJlc3Npb24uc3ltYm9sKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAvLyBJZiBhbiBlcnJvciBpcyByZXBvcnRlZCBldmFsdWF0aW5nIHRoZSBzeW1ib2wgcmVjb3JkIHRoZSBwb3NpdGlvbiBvZiB0aGVcbiAgICAgICAgICAgICAgICAgIC8vIHJlZmVyZW5jZSBpbiB0aGUgZXJyb3Igc28gaXQgY2FuXG4gICAgICAgICAgICAgICAgICAvLyBiZSByZXBvcnRlZCBpbiB0aGUgZXJyb3IgbWVzc2FnZSBnZW5lcmF0ZWQgZnJvbSB0aGUgZXhjZXB0aW9uLlxuICAgICAgICAgICAgICAgICAgaWYgKGlzTWV0YWRhdGFFcnJvcihlKSAmJiBleHByZXNzaW9uLmZpbGVOYW1lICE9IG51bGwgJiZcbiAgICAgICAgICAgICAgICAgICAgICBleHByZXNzaW9uLmxpbmUgIT0gbnVsbCAmJiBleHByZXNzaW9uLmNoYXJhY3RlciAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGUucG9zaXRpb24gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgZmlsZU5hbWU6IGV4cHJlc3Npb24uZmlsZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgbGluZTogZXhwcmVzc2lvbi5saW5lLFxuICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogZXhwcmVzc2lvbi5jaGFyYWN0ZXJcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgICAgICAgICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICAgICAgICAgICAgY2FzZSAnbmV3JzpcbiAgICAgICAgICAgICAgY2FzZSAnY2FsbCc6XG4gICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBmdW5jdGlvbiBpcyBhIGJ1aWx0LWluIGNvbnZlcnNpb25cbiAgICAgICAgICAgICAgICBzdGF0aWNTeW1ib2wgPSBzaW1wbGlmeUluQ29udGV4dChcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dCwgZXhwcmVzc2lvblsnZXhwcmVzc2lvbiddLCBkZXB0aCArIDEsIC8qIHJlZmVyZW5jZXMgKi8gMCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRpY1N5bWJvbCBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgICAgICAgICAgICAgaWYgKHN0YXRpY1N5bWJvbCA9PT0gc2VsZi5pbmplY3Rpb25Ub2tlbiB8fCBzdGF0aWNTeW1ib2wgPT09IHNlbGYub3BhcXVlVG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgc29tZWJvZHkgY2FsbHMgbmV3IEluamVjdGlvblRva2VuLCBkb24ndCBjcmVhdGUgYW4gSW5qZWN0aW9uVG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIC8vIGJ1dCByYXRoZXIgcmV0dXJuIHRoZSBzeW1ib2wgdG8gd2hpY2ggdGhlIEluamVjdGlvblRva2VuIGlzIGFzc2lnbmVkIHRvLlxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE9wYXF1ZVRva2VuIGlzIHN1cHBvcnRlZCB0b28gYXMgaXQgaXMgcmVxdWlyZWQgYnkgdGhlIGxhbmd1YWdlIHNlcnZpY2UgdG9cbiAgICAgICAgICAgICAgICAgICAgLy8gc3VwcG9ydCB2NCBhbmQgcHJpb3IgdmVyc2lvbnMgb2YgQW5ndWxhci5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBjb25zdCBhcmdFeHByZXNzaW9uczogYW55W10gPSBleHByZXNzaW9uWydhcmd1bWVudHMnXSB8fCBbXTtcbiAgICAgICAgICAgICAgICAgIGxldCBjb252ZXJ0ZXIgPSBzZWxmLmNvbnZlcnNpb25NYXAuZ2V0KHN0YXRpY1N5bWJvbCk7XG4gICAgICAgICAgICAgICAgICBpZiAoY29udmVydGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBhcmdFeHByZXNzaW9ucy5tYXAoYXJnID0+IHNpbXBsaWZ5TmVzdGVkKGNvbnRleHQsIGFyZykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChhcmcgPT4gc2hvdWxkSWdub3JlKGFyZykgPyB1bmRlZmluZWQgOiBhcmcpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29udmVydGVyKGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBmdW5jdGlvbiBpcyBvbmUgd2UgY2FuIHNpbXBsaWZ5LlxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRGdW5jdGlvbiA9IHJlc29sdmVSZWZlcmVuY2VWYWx1ZShzdGF0aWNTeW1ib2wpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnlDYWxsKFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGljU3ltYm9sLCB0YXJnZXRGdW5jdGlvbiwgYXJnRXhwcmVzc2lvbnMsIGV4cHJlc3Npb25bJ2V4cHJlc3Npb24nXSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBJR05PUkU7XG4gICAgICAgICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICAgICAgICBsZXQgbWVzc2FnZSA9IGV4cHJlc3Npb24ubWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXhwcmVzc2lvblsnbGluZSddICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQ6IGV4cHJlc3Npb24uY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBleHByZXNzaW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZU5hbWU6IGV4cHJlc3Npb25bJ2ZpbGVOYW1lJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmU6IGV4cHJlc3Npb25bJ2xpbmUnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBleHByZXNzaW9uWydjaGFyYWN0ZXInXVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3Ioe21lc3NhZ2UsIGNvbnRleHQ6IGV4cHJlc3Npb24uY29udGV4dH0sIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gSUdOT1JFO1xuICAgICAgICAgICAgICBjYXNlICdpZ25vcmUnOlxuICAgICAgICAgICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBtYXBTdHJpbmdNYXAoZXhwcmVzc2lvbiwgKHZhbHVlLCBuYW1lKSA9PiB7XG4gICAgICAgICAgICBpZiAoUkVGRVJFTkNFX1NFVC5oYXMobmFtZSkpIHtcbiAgICAgICAgICAgICAgaWYgKG5hbWUgPT09IFVTRV9WQUxVRSAmJiBQUk9WSURFIGluIGV4cHJlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGlzIGlzIGEgcHJvdmlkZXIgZXhwcmVzc2lvbiwgY2hlY2sgZm9yIHNwZWNpYWwgdG9rZW5zIHRoYXQgbmVlZCB0aGUgdmFsdWVcbiAgICAgICAgICAgICAgICAvLyBkdXJpbmcgYW5hbHlzaXMuXG4gICAgICAgICAgICAgICAgY29uc3QgcHJvdmlkZSA9IHNpbXBsaWZ5KGV4cHJlc3Npb24ucHJvdmlkZSk7XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGUgPT09IHNlbGYuUk9VVEVTIHx8IHByb3ZpZGUgPT0gc2VsZi5BTkFMWVpFX0ZPUl9FTlRSWV9DT01QT05FTlRTKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnkodmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gc2ltcGxpZnlMYXppbHkodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNpbXBsaWZ5KHZhbHVlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gSUdOT1JFO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2ltcGxpZnkodmFsdWUpO1xuICAgIH1cblxuICAgIGxldCByZXN1bHQ6IGFueTtcbiAgICB0cnkge1xuICAgICAgcmVzdWx0ID0gc2ltcGxpZnlJbkNvbnRleHQoY29udGV4dCwgdmFsdWUsIDAsIGxhenkgPyAxIDogMCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKHRoaXMuZXJyb3JSZWNvcmRlcikge1xuICAgICAgICB0aGlzLnJlcG9ydEVycm9yKGUsIGNvbnRleHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZm9ybWF0TWV0YWRhdGFFcnJvcihlLCBjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHNob3VsZElnbm9yZShyZXN1bHQpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRUeXBlTWV0YWRhdGEodHlwZTogU3RhdGljU3ltYm9sKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGNvbnN0IHJlc29sdmVkU3ltYm9sID0gdGhpcy5zeW1ib2xSZXNvbHZlci5yZXNvbHZlU3ltYm9sKHR5cGUpO1xuICAgIHJldHVybiByZXNvbHZlZFN5bWJvbCAmJiByZXNvbHZlZFN5bWJvbC5tZXRhZGF0YSA/IHJlc29sdmVkU3ltYm9sLm1ldGFkYXRhIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7X19zeW1ib2xpYzogJ2NsYXNzJ307XG4gIH1cblxuICBwcml2YXRlIHJlcG9ydEVycm9yKGVycm9yOiBFcnJvciwgY29udGV4dDogU3RhdGljU3ltYm9sLCBwYXRoPzogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuZXJyb3JSZWNvcmRlcikge1xuICAgICAgdGhpcy5lcnJvclJlY29yZGVyKFxuICAgICAgICAgIGZvcm1hdE1ldGFkYXRhRXJyb3IoZXJyb3IsIGNvbnRleHQpLCAoY29udGV4dCAmJiBjb250ZXh0LmZpbGVQYXRoKSB8fCBwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBlcnJvcihcbiAgICAgIHttZXNzYWdlLCBzdW1tYXJ5LCBhZHZpc2UsIHBvc2l0aW9uLCBjb250ZXh0LCB2YWx1ZSwgc3ltYm9sLCBjaGFpbn06IHtcbiAgICAgICAgbWVzc2FnZTogc3RyaW5nLFxuICAgICAgICBzdW1tYXJ5Pzogc3RyaW5nLFxuICAgICAgICBhZHZpc2U/OiBzdHJpbmcsXG4gICAgICAgIHBvc2l0aW9uPzogUG9zaXRpb24sXG4gICAgICAgIGNvbnRleHQ/OiBhbnksXG4gICAgICAgIHZhbHVlPzogYW55LFxuICAgICAgICBzeW1ib2w/OiBTdGF0aWNTeW1ib2wsXG4gICAgICAgIGNoYWluPzogTWV0YWRhdGFNZXNzYWdlQ2hhaW5cbiAgICAgIH0sXG4gICAgICByZXBvcnRpbmdDb250ZXh0OiBTdGF0aWNTeW1ib2wpIHtcbiAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICBtZXRhZGF0YUVycm9yKG1lc3NhZ2UsIHN1bW1hcnksIGFkdmlzZSwgcG9zaXRpb24sIHN5bWJvbCwgY29udGV4dCwgY2hhaW4pLFxuICAgICAgICByZXBvcnRpbmdDb250ZXh0KTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgUG9zaXRpb24ge1xuICBmaWxlTmFtZTogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbHVtbjogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgTWV0YWRhdGFNZXNzYWdlQ2hhaW4ge1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIHN1bW1hcnk/OiBzdHJpbmc7XG4gIHBvc2l0aW9uPzogUG9zaXRpb247XG4gIGNvbnRleHQ/OiBhbnk7XG4gIHN5bWJvbD86IFN0YXRpY1N5bWJvbDtcbiAgbmV4dD86IE1ldGFkYXRhTWVzc2FnZUNoYWluO1xufVxuXG50eXBlIE1ldGFkYXRhRXJyb3IgPSBFcnJvciAmIHtcbiAgcG9zaXRpb24/OiBQb3NpdGlvbjtcbiAgYWR2aXNlPzogc3RyaW5nO1xuICBzdW1tYXJ5Pzogc3RyaW5nO1xuICBjb250ZXh0PzogYW55O1xuICBzeW1ib2w/OiBTdGF0aWNTeW1ib2w7XG4gIGNoYWluPzogTWV0YWRhdGFNZXNzYWdlQ2hhaW47XG59O1xuXG5jb25zdCBNRVRBREFUQV9FUlJPUiA9ICduZ01ldGFkYXRhRXJyb3InO1xuXG5mdW5jdGlvbiBtZXRhZGF0YUVycm9yKFxuICAgIG1lc3NhZ2U6IHN0cmluZywgc3VtbWFyeT86IHN0cmluZywgYWR2aXNlPzogc3RyaW5nLCBwb3NpdGlvbj86IFBvc2l0aW9uLCBzeW1ib2w/OiBTdGF0aWNTeW1ib2wsXG4gICAgY29udGV4dD86IGFueSwgY2hhaW4/OiBNZXRhZGF0YU1lc3NhZ2VDaGFpbik6IE1ldGFkYXRhRXJyb3Ige1xuICBjb25zdCBlcnJvciA9IHN5bnRheEVycm9yKG1lc3NhZ2UpIGFzIE1ldGFkYXRhRXJyb3I7XG4gIChlcnJvciBhcyBhbnkpW01FVEFEQVRBX0VSUk9SXSA9IHRydWU7XG4gIGlmIChhZHZpc2UpIGVycm9yLmFkdmlzZSA9IGFkdmlzZTtcbiAgaWYgKHBvc2l0aW9uKSBlcnJvci5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICBpZiAoc3VtbWFyeSkgZXJyb3Iuc3VtbWFyeSA9IHN1bW1hcnk7XG4gIGlmIChjb250ZXh0KSBlcnJvci5jb250ZXh0ID0gY29udGV4dDtcbiAgaWYgKGNoYWluKSBlcnJvci5jaGFpbiA9IGNoYWluO1xuICBpZiAoc3ltYm9sKSBlcnJvci5zeW1ib2wgPSBzeW1ib2w7XG4gIHJldHVybiBlcnJvcjtcbn1cblxuZnVuY3Rpb24gaXNNZXRhZGF0YUVycm9yKGVycm9yOiBFcnJvcik6IGVycm9yIGlzIE1ldGFkYXRhRXJyb3Ige1xuICByZXR1cm4gISEoZXJyb3IgYXMgYW55KVtNRVRBREFUQV9FUlJPUl07XG59XG5cbmNvbnN0IFJFRkVSRU5DRV9UT19OT05FWFBPUlRFRF9DTEFTUyA9ICdSZWZlcmVuY2UgdG8gbm9uLWV4cG9ydGVkIGNsYXNzJztcbmNvbnN0IFZBUklBQkxFX05PVF9JTklUSUFMSVpFRCA9ICdWYXJpYWJsZSBub3QgaW5pdGlhbGl6ZWQnO1xuY29uc3QgREVTVFJVQ1RVUkVfTk9UX1NVUFBPUlRFRCA9ICdEZXN0cnVjdHVyaW5nIG5vdCBzdXBwb3J0ZWQnO1xuY29uc3QgQ09VTERfTk9UX1JFU09MVkVfVFlQRSA9ICdDb3VsZCBub3QgcmVzb2x2ZSB0eXBlJztcbmNvbnN0IEZVTkNUSU9OX0NBTExfTk9UX1NVUFBPUlRFRCA9ICdGdW5jdGlvbiBjYWxsIG5vdCBzdXBwb3J0ZWQnO1xuY29uc3QgUkVGRVJFTkNFX1RPX0xPQ0FMX1NZTUJPTCA9ICdSZWZlcmVuY2UgdG8gYSBsb2NhbCBzeW1ib2wnO1xuY29uc3QgTEFNQkRBX05PVF9TVVBQT1JURUQgPSAnTGFtYmRhIG5vdCBzdXBwb3J0ZWQnO1xuXG5mdW5jdGlvbiBleHBhbmRlZE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nLCBjb250ZXh0OiBhbnkpOiBzdHJpbmcge1xuICBzd2l0Y2ggKG1lc3NhZ2UpIHtcbiAgICBjYXNlIFJFRkVSRU5DRV9UT19OT05FWFBPUlRFRF9DTEFTUzpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQuY2xhc3NOYW1lKSB7XG4gICAgICAgIHJldHVybiBgUmVmZXJlbmNlcyB0byBhIG5vbi1leHBvcnRlZCBjbGFzcyBhcmUgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzIGJ1dCAke1xuICAgICAgICAgICAgY29udGV4dC5jbGFzc05hbWV9IHdhcyByZWZlcmVuY2VkLmA7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIFZBUklBQkxFX05PVF9JTklUSUFMSVpFRDpcbiAgICAgIHJldHVybiAnT25seSBpbml0aWFsaXplZCB2YXJpYWJsZXMgYW5kIGNvbnN0YW50cyBjYW4gYmUgcmVmZXJlbmNlZCBpbiBkZWNvcmF0b3JzIGJlY2F1c2UgdGhlIHZhbHVlIG9mIHRoaXMgdmFyaWFibGUgaXMgbmVlZGVkIGJ5IHRoZSB0ZW1wbGF0ZSBjb21waWxlcic7XG4gICAgY2FzZSBERVNUUlVDVFVSRV9OT1RfU1VQUE9SVEVEOlxuICAgICAgcmV0dXJuICdSZWZlcmVuY2luZyBhbiBleHBvcnRlZCBkZXN0cnVjdHVyZWQgdmFyaWFibGUgb3IgY29uc3RhbnQgaXMgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzIGFuZCB0aGlzIHZhbHVlIGlzIG5lZWRlZCBieSB0aGUgdGVtcGxhdGUgY29tcGlsZXInO1xuICAgIGNhc2UgQ09VTERfTk9UX1JFU09MVkVfVFlQRTpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQudHlwZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBDb3VsZCBub3QgcmVzb2x2ZSB0eXBlICR7Y29udGV4dC50eXBlTmFtZX1gO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBGVU5DVElPTl9DQUxMX05PVF9TVVBQT1JURUQ6XG4gICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0Lm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBGdW5jdGlvbiBjYWxscyBhcmUgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzIGJ1dCAnJHtjb250ZXh0Lm5hbWV9JyB3YXMgY2FsbGVkYDtcbiAgICAgIH1cbiAgICAgIHJldHVybiAnRnVuY3Rpb24gY2FsbHMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gZGVjb3JhdG9ycyc7XG4gICAgY2FzZSBSRUZFUkVOQ0VfVE9fTE9DQUxfU1lNQk9MOlxuICAgICAgaWYgKGNvbnRleHQgJiYgY29udGV4dC5uYW1lKSB7XG4gICAgICAgIHJldHVybiBgUmVmZXJlbmNlIHRvIGEgbG9jYWwgKG5vbi1leHBvcnRlZCkgc3ltYm9scyBhcmUgbm90IHN1cHBvcnRlZCBpbiBkZWNvcmF0b3JzIGJ1dCAnJHtcbiAgICAgICAgICAgIGNvbnRleHQubmFtZX0nIHdhcyByZWZlcmVuY2VkYDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgTEFNQkRBX05PVF9TVVBQT1JURUQ6XG4gICAgICByZXR1cm4gYEZ1bmN0aW9uIGV4cHJlc3Npb25zIGFyZSBub3Qgc3VwcG9ydGVkIGluIGRlY29yYXRvcnNgO1xuICB9XG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG5mdW5jdGlvbiBtZXNzYWdlQWR2aXNlKG1lc3NhZ2U6IHN0cmluZywgY29udGV4dDogYW55KTogc3RyaW5nfHVuZGVmaW5lZCB7XG4gIHN3aXRjaCAobWVzc2FnZSkge1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX05PTkVYUE9SVEVEX0NMQVNTOlxuICAgICAgaWYgKGNvbnRleHQgJiYgY29udGV4dC5jbGFzc05hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBDb25zaWRlciBleHBvcnRpbmcgJyR7Y29udGV4dC5jbGFzc05hbWV9J2A7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIERFU1RSVUNUVVJFX05PVF9TVVBQT1JURUQ6XG4gICAgICByZXR1cm4gJ0NvbnNpZGVyIHNpbXBsaWZ5aW5nIHRvIGF2b2lkIGRlc3RydWN0dXJpbmcnO1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX0xPQ0FMX1NZTUJPTDpcbiAgICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHQubmFtZSkge1xuICAgICAgICByZXR1cm4gYENvbnNpZGVyIGV4cG9ydGluZyAnJHtjb250ZXh0Lm5hbWV9J2A7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIExBTUJEQV9OT1RfU1VQUE9SVEVEOlxuICAgICAgcmV0dXJuIGBDb25zaWRlciBjaGFuZ2luZyB0aGUgZnVuY3Rpb24gZXhwcmVzc2lvbiBpbnRvIGFuIGV4cG9ydGVkIGZ1bmN0aW9uYDtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBlcnJvclN1bW1hcnkoZXJyb3I6IE1ldGFkYXRhRXJyb3IpOiBzdHJpbmcge1xuICBpZiAoZXJyb3Iuc3VtbWFyeSkge1xuICAgIHJldHVybiBlcnJvci5zdW1tYXJ5O1xuICB9XG4gIHN3aXRjaCAoZXJyb3IubWVzc2FnZSkge1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX05PTkVYUE9SVEVEX0NMQVNTOlxuICAgICAgaWYgKGVycm9yLmNvbnRleHQgJiYgZXJyb3IuY29udGV4dC5jbGFzc05hbWUpIHtcbiAgICAgICAgcmV0dXJuIGByZWZlcmVuY2VzIG5vbi1leHBvcnRlZCBjbGFzcyAke2Vycm9yLmNvbnRleHQuY2xhc3NOYW1lfWA7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIFZBUklBQkxFX05PVF9JTklUSUFMSVpFRDpcbiAgICAgIHJldHVybiAnaXMgbm90IGluaXRpYWxpemVkJztcbiAgICBjYXNlIERFU1RSVUNUVVJFX05PVF9TVVBQT1JURUQ6XG4gICAgICByZXR1cm4gJ2lzIGEgZGVzdHJ1Y3R1cmVkIHZhcmlhYmxlJztcbiAgICBjYXNlIENPVUxEX05PVF9SRVNPTFZFX1RZUEU6XG4gICAgICByZXR1cm4gJ2NvdWxkIG5vdCBiZSByZXNvbHZlZCc7XG4gICAgY2FzZSBGVU5DVElPTl9DQUxMX05PVF9TVVBQT1JURUQ6XG4gICAgICBpZiAoZXJyb3IuY29udGV4dCAmJiBlcnJvci5jb250ZXh0Lm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGBjYWxscyAnJHtlcnJvci5jb250ZXh0Lm5hbWV9J2A7XG4gICAgICB9XG4gICAgICByZXR1cm4gYGNhbGxzIGEgZnVuY3Rpb25gO1xuICAgIGNhc2UgUkVGRVJFTkNFX1RPX0xPQ0FMX1NZTUJPTDpcbiAgICAgIGlmIChlcnJvci5jb250ZXh0ICYmIGVycm9yLmNvbnRleHQubmFtZSkge1xuICAgICAgICByZXR1cm4gYHJlZmVyZW5jZXMgbG9jYWwgdmFyaWFibGUgJHtlcnJvci5jb250ZXh0Lm5hbWV9YDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBgcmVmZXJlbmNlcyBhIGxvY2FsIHZhcmlhYmxlYDtcbiAgfVxuICByZXR1cm4gJ2NvbnRhaW5zIHRoZSBlcnJvcic7XG59XG5cbmZ1bmN0aW9uIG1hcFN0cmluZ01hcChpbnB1dDoge1trZXk6IHN0cmluZ106IGFueX0sIHRyYW5zZm9ybTogKHZhbHVlOiBhbnksIGtleTogc3RyaW5nKSA9PiBhbnkpOlxuICAgIHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgaWYgKCFpbnB1dCkgcmV0dXJuIHt9O1xuICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge307XG4gIE9iamVjdC5rZXlzKGlucHV0KS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IHRyYW5zZm9ybShpbnB1dFtrZXldLCBrZXkpO1xuICAgIGlmICghc2hvdWxkSWdub3JlKHZhbHVlKSkge1xuICAgICAgaWYgKEhJRERFTl9LRVkudGVzdChrZXkpKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXN1bHQsIGtleSwge2VudW1lcmFibGU6IGZhbHNlLCBjb25maWd1cmFibGU6IHRydWUsIHZhbHVlOiB2YWx1ZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShvOiBhbnkpOiBib29sZWFuIHtcbiAgcmV0dXJuIG8gPT09IG51bGwgfHwgKHR5cGVvZiBvICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBvICE9PSAnb2JqZWN0Jyk7XG59XG5cbmludGVyZmFjZSBCaW5kaW5nU2NvcGVCdWlsZGVyIHtcbiAgZGVmaW5lKG5hbWU6IHN0cmluZywgdmFsdWU6IGFueSk6IEJpbmRpbmdTY29wZUJ1aWxkZXI7XG4gIGRvbmUoKTogQmluZGluZ1Njb3BlO1xufVxuXG5hYnN0cmFjdCBjbGFzcyBCaW5kaW5nU2NvcGUge1xuICBhYnN0cmFjdCByZXNvbHZlKG5hbWU6IHN0cmluZyk6IGFueTtcbiAgcHVibGljIHN0YXRpYyBtaXNzaW5nID0ge307XG4gIHB1YmxpYyBzdGF0aWMgZW1wdHk6IEJpbmRpbmdTY29wZSA9IHtyZXNvbHZlOiBuYW1lID0+IEJpbmRpbmdTY29wZS5taXNzaW5nfTtcblxuICBwdWJsaWMgc3RhdGljIGJ1aWxkKCk6IEJpbmRpbmdTY29wZUJ1aWxkZXIge1xuICAgIGNvbnN0IGN1cnJlbnQgPSBuZXcgTWFwPHN0cmluZywgYW55PigpO1xuICAgIHJldHVybiB7XG4gICAgICBkZWZpbmU6IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIGN1cnJlbnQuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9LFxuICAgICAgZG9uZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBjdXJyZW50LnNpemUgPiAwID8gbmV3IFBvcHVsYXRlZFNjb3BlKGN1cnJlbnQpIDogQmluZGluZ1Njb3BlLmVtcHR5O1xuICAgICAgfVxuICAgIH07XG4gIH1cbn1cblxuY2xhc3MgUG9wdWxhdGVkU2NvcGUgZXh0ZW5kcyBCaW5kaW5nU2NvcGUge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGJpbmRpbmdzOiBNYXA8c3RyaW5nLCBhbnk+KSB7IHN1cGVyKCk7IH1cblxuICByZXNvbHZlKG5hbWU6IHN0cmluZyk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ3MuaGFzKG5hbWUpID8gdGhpcy5iaW5kaW5ncy5nZXQobmFtZSkgOiBCaW5kaW5nU2NvcGUubWlzc2luZztcbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JtYXRNZXRhZGF0YU1lc3NhZ2VDaGFpbihcbiAgICBjaGFpbjogTWV0YWRhdGFNZXNzYWdlQ2hhaW4sIGFkdmlzZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogRm9ybWF0dGVkTWVzc2FnZUNoYWluIHtcbiAgY29uc3QgZXhwYW5kZWQgPSBleHBhbmRlZE1lc3NhZ2UoY2hhaW4ubWVzc2FnZSwgY2hhaW4uY29udGV4dCk7XG4gIGNvbnN0IG5lc3RpbmcgPSBjaGFpbi5zeW1ib2wgPyBgIGluICcke2NoYWluLnN5bWJvbC5uYW1lfSdgIDogJyc7XG4gIGNvbnN0IG1lc3NhZ2UgPSBgJHtleHBhbmRlZH0ke25lc3Rpbmd9YDtcbiAgY29uc3QgcG9zaXRpb24gPSBjaGFpbi5wb3NpdGlvbjtcbiAgY29uc3QgbmV4dDogRm9ybWF0dGVkTWVzc2FnZUNoYWlufHVuZGVmaW5lZCA9IGNoYWluLm5leHQgP1xuICAgICAgZm9ybWF0TWV0YWRhdGFNZXNzYWdlQ2hhaW4oY2hhaW4ubmV4dCwgYWR2aXNlKSA6XG4gICAgICBhZHZpc2UgPyB7bWVzc2FnZTogYWR2aXNlfSA6IHVuZGVmaW5lZDtcbiAgcmV0dXJuIHttZXNzYWdlLCBwb3NpdGlvbiwgbmV4dDogbmV4dCA/IFtuZXh0XSA6IHVuZGVmaW5lZH07XG59XG5cbmZ1bmN0aW9uIGZvcm1hdE1ldGFkYXRhRXJyb3IoZTogRXJyb3IsIGNvbnRleHQ6IFN0YXRpY1N5bWJvbCk6IEVycm9yIHtcbiAgaWYgKGlzTWV0YWRhdGFFcnJvcihlKSkge1xuICAgIC8vIFByb2R1Y2UgYSBmb3JtYXR0ZWQgdmVyc2lvbiBvZiB0aGUgYW5kIGxlYXZpbmcgZW5vdWdoIGluZm9ybWF0aW9uIGluIHRoZSBvcmlnaW5hbCBlcnJvclxuICAgIC8vIHRvIHJlY292ZXIgdGhlIGZvcm1hdHRpbmcgaW5mb3JtYXRpb24gdG8gZXZlbnR1YWxseSBwcm9kdWNlIGEgZGlhZ25vc3RpYyBlcnJvciBtZXNzYWdlLlxuICAgIGNvbnN0IHBvc2l0aW9uID0gZS5wb3NpdGlvbjtcbiAgICBjb25zdCBjaGFpbjogTWV0YWRhdGFNZXNzYWdlQ2hhaW4gPSB7XG4gICAgICBtZXNzYWdlOiBgRXJyb3IgZHVyaW5nIHRlbXBsYXRlIGNvbXBpbGUgb2YgJyR7Y29udGV4dC5uYW1lfSdgLFxuICAgICAgcG9zaXRpb246IHBvc2l0aW9uLFxuICAgICAgbmV4dDoge21lc3NhZ2U6IGUubWVzc2FnZSwgbmV4dDogZS5jaGFpbiwgY29udGV4dDogZS5jb250ZXh0LCBzeW1ib2w6IGUuc3ltYm9sfVxuICAgIH07XG4gICAgY29uc3QgYWR2aXNlID0gZS5hZHZpc2UgfHwgbWVzc2FnZUFkdmlzZShlLm1lc3NhZ2UsIGUuY29udGV4dCk7XG4gICAgcmV0dXJuIGZvcm1hdHRlZEVycm9yKGZvcm1hdE1ldGFkYXRhTWVzc2FnZUNoYWluKGNoYWluLCBhZHZpc2UpKTtcbiAgfVxuICByZXR1cm4gZTtcbn1cbiJdfQ==