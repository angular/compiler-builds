/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
        define("@angular/compiler/src/jit_compiler_facade", ["require", "exports", "tslib", "@angular/compiler/src/constant_pool", "@angular/compiler/src/core", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/output_jit", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_injector_compiler", "@angular/compiler/src/render3/r3_jit", "@angular/compiler/src/render3/r3_module_compiler", "@angular/compiler/src/render3/r3_pipe_compiler", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/resource_loader", "@angular/compiler/src/schema/dom_element_schema_registry"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publishFacade = exports.CompilerFacadeImpl = void 0;
    var tslib_1 = require("tslib");
    var constant_pool_1 = require("@angular/compiler/src/constant_pool");
    var core_1 = require("@angular/compiler/src/core");
    var injectable_compiler_2_1 = require("@angular/compiler/src/injectable_compiler_2");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var output_ast_1 = require("@angular/compiler/src/output/output_ast");
    var output_jit_1 = require("@angular/compiler/src/output/output_jit");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_injector_compiler_1 = require("@angular/compiler/src/render3/r3_injector_compiler");
    var r3_jit_1 = require("@angular/compiler/src/render3/r3_jit");
    var r3_module_compiler_1 = require("@angular/compiler/src/render3/r3_module_compiler");
    var r3_pipe_compiler_1 = require("@angular/compiler/src/render3/r3_pipe_compiler");
    var util_1 = require("@angular/compiler/src/render3/util");
    var compiler_1 = require("@angular/compiler/src/render3/view/compiler");
    var template_1 = require("@angular/compiler/src/render3/view/template");
    var resource_loader_1 = require("@angular/compiler/src/resource_loader");
    var dom_element_schema_registry_1 = require("@angular/compiler/src/schema/dom_element_schema_registry");
    var CompilerFacadeImpl = /** @class */ (function () {
        function CompilerFacadeImpl(jitEvaluator) {
            if (jitEvaluator === void 0) { jitEvaluator = new output_jit_1.JitEvaluator(); }
            this.jitEvaluator = jitEvaluator;
            this.FactoryTarget = r3_factory_1.FactoryTarget;
            this.ResourceLoader = resource_loader_1.ResourceLoader;
            this.elementSchemaRegistry = new dom_element_schema_registry_1.DomElementSchemaRegistry();
        }
        CompilerFacadeImpl.prototype.compilePipe = function (angularCoreEnv, sourceMapUrl, facade) {
            var metadata = {
                name: facade.name,
                type: util_1.wrapReference(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                typeArgumentCount: 0,
                deps: null,
                pipeName: facade.pipeName,
                pure: facade.pure,
            };
            var res = r3_pipe_compiler_1.compilePipeFromMetadata(metadata);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compilePipeDeclaration = function (angularCoreEnv, sourceMapUrl, declaration) {
            var meta = convertDeclarePipeFacadeToMetadata(declaration);
            var res = r3_pipe_compiler_1.compilePipeFromMetadata(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileInjectable = function (angularCoreEnv, sourceMapUrl, facade) {
            var _a = injectable_compiler_2_1.compileInjectable({
                name: facade.name,
                type: util_1.wrapReference(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                typeArgumentCount: facade.typeArgumentCount,
                providedIn: computeProvidedIn(facade.providedIn),
                useClass: wrapExpression(facade, USE_CLASS),
                useFactory: wrapExpression(facade, USE_FACTORY),
                useValue: wrapExpression(facade, USE_VALUE),
                useExisting: wrapExpression(facade, USE_EXISTING),
                userDeps: convertR3DependencyMetadataArray(facade.userDeps) || undefined,
            }), expression = _a.expression, statements = _a.statements;
            return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
        };
        CompilerFacadeImpl.prototype.compileInjector = function (angularCoreEnv, sourceMapUrl, facade) {
            var meta = {
                name: facade.name,
                type: util_1.wrapReference(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                providers: new output_ast_1.WrappedNodeExpr(facade.providers),
                imports: facade.imports.map(function (i) { return new output_ast_1.WrappedNodeExpr(i); }),
            };
            var res = r3_injector_compiler_1.compileInjector(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileInjectorDeclaration = function (angularCoreEnv, sourceMapUrl, declaration) {
            var meta = convertDeclareInjectorFacadeToMetadata(declaration);
            var res = r3_injector_compiler_1.compileInjector(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileNgModule = function (angularCoreEnv, sourceMapUrl, facade) {
            var meta = {
                type: util_1.wrapReference(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                adjacentType: new output_ast_1.WrappedNodeExpr(facade.type),
                bootstrap: facade.bootstrap.map(util_1.wrapReference),
                declarations: facade.declarations.map(util_1.wrapReference),
                imports: facade.imports.map(util_1.wrapReference),
                exports: facade.exports.map(util_1.wrapReference),
                emitInline: true,
                containsForwardDecls: false,
                schemas: facade.schemas ? facade.schemas.map(util_1.wrapReference) : null,
                id: facade.id ? new output_ast_1.WrappedNodeExpr(facade.id) : null,
            };
            var res = r3_module_compiler_1.compileNgModule(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileNgModuleDeclaration = function (angularCoreEnv, sourceMapUrl, declaration) {
            var expression = r3_module_compiler_1.compileNgModuleDeclarationExpression(declaration);
            return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileDirective = function (angularCoreEnv, sourceMapUrl, facade) {
            var meta = convertDirectiveFacadeToMetadata(facade);
            return this.compileDirectiveFromMeta(angularCoreEnv, sourceMapUrl, meta);
        };
        CompilerFacadeImpl.prototype.compileDirectiveDeclaration = function (angularCoreEnv, sourceMapUrl, declaration) {
            var typeSourceSpan = this.createParseSourceSpan('Directive', declaration.type.name, sourceMapUrl);
            var meta = convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan);
            return this.compileDirectiveFromMeta(angularCoreEnv, sourceMapUrl, meta);
        };
        CompilerFacadeImpl.prototype.compileDirectiveFromMeta = function (angularCoreEnv, sourceMapUrl, meta) {
            var constantPool = new constant_pool_1.ConstantPool();
            var bindingParser = template_1.makeBindingParser();
            var res = compiler_1.compileDirectiveFromMetadata(meta, constantPool, bindingParser);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
        };
        CompilerFacadeImpl.prototype.compileComponent = function (angularCoreEnv, sourceMapUrl, facade) {
            // Parse the template and check for errors.
            var _a = parseJitTemplate(facade.template, facade.name, sourceMapUrl, facade.preserveWhitespaces, facade.interpolation), template = _a.template, interpolation = _a.interpolation;
            // Compile the component metadata, including template, into an expression.
            var meta = tslib_1.__assign(tslib_1.__assign(tslib_1.__assign({}, facade), convertDirectiveFacadeToMetadata(facade)), { selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(), template: template, declarationListEmitMode: 0 /* Direct */, styles: tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(facade.styles)), tslib_1.__read(template.styles)), encapsulation: facade.encapsulation, interpolation: interpolation, changeDetection: facade.changeDetection, animations: facade.animations != null ? new output_ast_1.WrappedNodeExpr(facade.animations) : null, viewProviders: facade.viewProviders != null ? new output_ast_1.WrappedNodeExpr(facade.viewProviders) :
                    null, relativeContextFilePath: '', i18nUseExternalIds: true });
            var jitExpressionSourceMap = "ng:///" + facade.name + ".js";
            return this.compileComponentFromMeta(angularCoreEnv, jitExpressionSourceMap, meta);
        };
        CompilerFacadeImpl.prototype.compileComponentDeclaration = function (angularCoreEnv, sourceMapUrl, declaration) {
            var typeSourceSpan = this.createParseSourceSpan('Component', declaration.type.name, sourceMapUrl);
            var meta = convertDeclareComponentFacadeToMetadata(declaration, typeSourceSpan, sourceMapUrl);
            return this.compileComponentFromMeta(angularCoreEnv, sourceMapUrl, meta);
        };
        CompilerFacadeImpl.prototype.compileComponentFromMeta = function (angularCoreEnv, sourceMapUrl, meta) {
            var constantPool = new constant_pool_1.ConstantPool();
            var bindingParser = template_1.makeBindingParser(meta.interpolation);
            var res = compiler_1.compileComponentFromMetadata(meta, constantPool, bindingParser);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
        };
        CompilerFacadeImpl.prototype.compileFactory = function (angularCoreEnv, sourceMapUrl, meta) {
            var factoryRes = r3_factory_1.compileFactoryFunction({
                name: meta.name,
                type: util_1.wrapReference(meta.type),
                internalType: new output_ast_1.WrappedNodeExpr(meta.type),
                typeArgumentCount: meta.typeArgumentCount,
                deps: convertR3DependencyMetadataArray(meta.deps),
                target: meta.target,
            });
            return this.jitExpression(factoryRes.expression, angularCoreEnv, sourceMapUrl, factoryRes.statements);
        };
        CompilerFacadeImpl.prototype.compileFactoryDeclaration = function (angularCoreEnv, sourceMapUrl, meta) {
            var factoryRes = r3_factory_1.compileFactoryFunction({
                name: meta.type.name,
                type: util_1.wrapReference(meta.type),
                internalType: new output_ast_1.WrappedNodeExpr(meta.type),
                typeArgumentCount: 0,
                deps: meta.deps && meta.deps.map(convertR3DeclareDependencyMetadata),
                target: meta.target,
            });
            return this.jitExpression(factoryRes.expression, angularCoreEnv, sourceMapUrl, factoryRes.statements);
        };
        CompilerFacadeImpl.prototype.createParseSourceSpan = function (kind, typeName, sourceUrl) {
            return parse_util_1.r3JitTypeSourceSpan(kind, typeName, sourceUrl);
        };
        /**
         * JIT compiles an expression and returns the result of executing that expression.
         *
         * @param def the definition which will be compiled and executed to get the value to patch
         * @param context an object map of @angular/core symbol names to symbols which will be available
         * in the context of the compiled expression
         * @param sourceUrl a URL to use for the source map of the compiled expression
         * @param preStatements a collection of statements that should be evaluated before the expression.
         */
        CompilerFacadeImpl.prototype.jitExpression = function (def, context, sourceUrl, preStatements) {
            // The ConstantPool may contain Statements which declare variables used in the final expression.
            // Therefore, its statements need to precede the actual JIT operation. The final statement is a
            // declaration of $def which is set to the expression being compiled.
            var statements = tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(preStatements)), [
                new output_ast_1.DeclareVarStmt('$def', def, undefined, [output_ast_1.StmtModifier.Exported]),
            ]);
            var res = this.jitEvaluator.evaluateStatements(sourceUrl, statements, new r3_jit_1.R3JitReflector(context), /* enableSourceMaps */ true);
            return res['$def'];
        };
        return CompilerFacadeImpl;
    }());
    exports.CompilerFacadeImpl = CompilerFacadeImpl;
    var USE_CLASS = Object.keys({ useClass: null })[0];
    var USE_FACTORY = Object.keys({ useFactory: null })[0];
    var USE_VALUE = Object.keys({ useValue: null })[0];
    var USE_EXISTING = Object.keys({ useExisting: null })[0];
    function convertToR3QueryMetadata(facade) {
        return tslib_1.__assign(tslib_1.__assign({}, facade), { predicate: Array.isArray(facade.predicate) ? facade.predicate :
                new output_ast_1.WrappedNodeExpr(facade.predicate), read: facade.read ? new output_ast_1.WrappedNodeExpr(facade.read) : null, static: facade.static, emitDistinctChangesOnly: facade.emitDistinctChangesOnly });
    }
    function convertQueryDeclarationToMetadata(declaration) {
        var _a, _b, _c, _d;
        return {
            propertyName: declaration.propertyName,
            first: (_a = declaration.first) !== null && _a !== void 0 ? _a : false,
            predicate: Array.isArray(declaration.predicate) ? declaration.predicate :
                new output_ast_1.WrappedNodeExpr(declaration.predicate),
            descendants: (_b = declaration.descendants) !== null && _b !== void 0 ? _b : false,
            read: declaration.read ? new output_ast_1.WrappedNodeExpr(declaration.read) : null,
            static: (_c = declaration.static) !== null && _c !== void 0 ? _c : false,
            emitDistinctChangesOnly: (_d = declaration.emitDistinctChangesOnly) !== null && _d !== void 0 ? _d : true,
        };
    }
    function convertDirectiveFacadeToMetadata(facade) {
        var inputsFromMetadata = parseInputOutputs(facade.inputs || []);
        var outputsFromMetadata = parseInputOutputs(facade.outputs || []);
        var propMetadata = facade.propMetadata;
        var inputsFromType = {};
        var outputsFromType = {};
        var _loop_1 = function (field) {
            if (propMetadata.hasOwnProperty(field)) {
                propMetadata[field].forEach(function (ann) {
                    if (isInput(ann)) {
                        inputsFromType[field] =
                            ann.bindingPropertyName ? [ann.bindingPropertyName, field] : field;
                    }
                    else if (isOutput(ann)) {
                        outputsFromType[field] = ann.bindingPropertyName || field;
                    }
                });
            }
        };
        for (var field in propMetadata) {
            _loop_1(field);
        }
        return tslib_1.__assign(tslib_1.__assign({}, facade), { typeArgumentCount: 0, typeSourceSpan: facade.typeSourceSpan, type: util_1.wrapReference(facade.type), internalType: new output_ast_1.WrappedNodeExpr(facade.type), deps: null, host: extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host), inputs: tslib_1.__assign(tslib_1.__assign({}, inputsFromMetadata), inputsFromType), outputs: tslib_1.__assign(tslib_1.__assign({}, outputsFromMetadata), outputsFromType), queries: facade.queries.map(convertToR3QueryMetadata), providers: facade.providers != null ? new output_ast_1.WrappedNodeExpr(facade.providers) : null, viewQueries: facade.viewQueries.map(convertToR3QueryMetadata), fullInheritance: false });
    }
    function convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return {
            name: declaration.type.name,
            type: util_1.wrapReference(declaration.type),
            typeSourceSpan: typeSourceSpan,
            internalType: new output_ast_1.WrappedNodeExpr(declaration.type),
            selector: (_a = declaration.selector) !== null && _a !== void 0 ? _a : null,
            inputs: (_b = declaration.inputs) !== null && _b !== void 0 ? _b : {},
            outputs: (_c = declaration.outputs) !== null && _c !== void 0 ? _c : {},
            host: convertHostDeclarationToMetadata(declaration.host),
            queries: ((_d = declaration.queries) !== null && _d !== void 0 ? _d : []).map(convertQueryDeclarationToMetadata),
            viewQueries: ((_e = declaration.viewQueries) !== null && _e !== void 0 ? _e : []).map(convertQueryDeclarationToMetadata),
            providers: declaration.providers !== undefined ? new output_ast_1.WrappedNodeExpr(declaration.providers) :
                null,
            exportAs: (_f = declaration.exportAs) !== null && _f !== void 0 ? _f : null,
            usesInheritance: (_g = declaration.usesInheritance) !== null && _g !== void 0 ? _g : false,
            lifecycle: { usesOnChanges: (_h = declaration.usesOnChanges) !== null && _h !== void 0 ? _h : false },
            deps: null,
            typeArgumentCount: 0,
            fullInheritance: false,
        };
    }
    function convertHostDeclarationToMetadata(host) {
        var _a, _b, _c;
        if (host === void 0) { host = {}; }
        return {
            attributes: convertOpaqueValuesToExpressions((_a = host.attributes) !== null && _a !== void 0 ? _a : {}),
            listeners: (_b = host.listeners) !== null && _b !== void 0 ? _b : {},
            properties: (_c = host.properties) !== null && _c !== void 0 ? _c : {},
            specialAttributes: {
                classAttr: host.classAttribute,
                styleAttr: host.styleAttribute,
            },
        };
    }
    function convertOpaqueValuesToExpressions(obj) {
        var e_1, _a;
        var result = {};
        try {
            for (var _b = tslib_1.__values(Object.keys(obj)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                result[key] = new output_ast_1.WrappedNodeExpr(obj[key]);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return result;
    }
    function convertDeclareComponentFacadeToMetadata(declaration, typeSourceSpan, sourceMapUrl) {
        var _a, _b, _c, _d, _e, _f;
        var _g = parseJitTemplate(declaration.template, declaration.type.name, sourceMapUrl, (_a = declaration.preserveWhitespaces) !== null && _a !== void 0 ? _a : false, declaration.interpolation), template = _g.template, interpolation = _g.interpolation;
        return tslib_1.__assign(tslib_1.__assign({}, convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan)), { template: template, styles: (_b = declaration.styles) !== null && _b !== void 0 ? _b : [], directives: ((_c = declaration.components) !== null && _c !== void 0 ? _c : [])
                .concat((_d = declaration.directives) !== null && _d !== void 0 ? _d : [])
                .map(convertUsedDirectiveDeclarationToMetadata), pipes: convertUsedPipesToMetadata(declaration.pipes), viewProviders: declaration.viewProviders !== undefined ?
                new output_ast_1.WrappedNodeExpr(declaration.viewProviders) :
                null, animations: declaration.animations !== undefined ? new output_ast_1.WrappedNodeExpr(declaration.animations) :
                null, changeDetection: (_e = declaration.changeDetection) !== null && _e !== void 0 ? _e : core_1.ChangeDetectionStrategy.Default, encapsulation: (_f = declaration.encapsulation) !== null && _f !== void 0 ? _f : core_1.ViewEncapsulation.Emulated, interpolation: interpolation, declarationListEmitMode: 2 /* ClosureResolved */, relativeContextFilePath: '', i18nUseExternalIds: true });
    }
    function convertUsedDirectiveDeclarationToMetadata(declaration) {
        var _a, _b, _c;
        return {
            selector: declaration.selector,
            type: new output_ast_1.WrappedNodeExpr(declaration.type),
            inputs: (_a = declaration.inputs) !== null && _a !== void 0 ? _a : [],
            outputs: (_b = declaration.outputs) !== null && _b !== void 0 ? _b : [],
            exportAs: (_c = declaration.exportAs) !== null && _c !== void 0 ? _c : null,
        };
    }
    function convertUsedPipesToMetadata(declaredPipes) {
        var e_2, _a;
        var pipes = new Map();
        if (declaredPipes === undefined) {
            return pipes;
        }
        try {
            for (var _b = tslib_1.__values(Object.keys(declaredPipes)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var pipeName = _c.value;
                var pipeType = declaredPipes[pipeName];
                pipes.set(pipeName, new output_ast_1.WrappedNodeExpr(pipeType));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return pipes;
    }
    function parseJitTemplate(template, typeName, sourceMapUrl, preserveWhitespaces, interpolation) {
        var interpolationConfig = interpolation ? interpolation_config_1.InterpolationConfig.fromArray(interpolation) : interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG;
        // Parse the template and check for errors.
        var parsed = template_1.parseTemplate(template, sourceMapUrl, { preserveWhitespaces: preserveWhitespaces, interpolationConfig: interpolationConfig });
        if (parsed.errors !== null) {
            var errors = parsed.errors.map(function (err) { return err.toString(); }).join(', ');
            throw new Error("Errors during JIT compilation of template for " + typeName + ": " + errors);
        }
        return { template: parsed, interpolation: interpolationConfig };
    }
    function wrapExpression(obj, property) {
        if (obj.hasOwnProperty(property)) {
            return new output_ast_1.WrappedNodeExpr(obj[property]);
        }
        else {
            return undefined;
        }
    }
    function computeProvidedIn(providedIn) {
        if (providedIn == null || typeof providedIn === 'string') {
            return new output_ast_1.LiteralExpr(providedIn);
        }
        else {
            return new output_ast_1.WrappedNodeExpr(providedIn);
        }
    }
    function convertR3DependencyMetadataArray(facades) {
        return facades == null ? null : facades.map(convertR3DependencyMetadata);
    }
    function convertR3DependencyMetadata(facade) {
        var isAttributeDep = facade.attribute != null; // both `null` and `undefined`
        var rawToken = facade.token === null ? null : new output_ast_1.WrappedNodeExpr(facade.token);
        // In JIT mode, if the dep is an `@Attribute()` then we use the attribute name given in
        // `attribute` rather than the `token`.
        var token = isAttributeDep ? new output_ast_1.WrappedNodeExpr(facade.attribute) : rawToken;
        return createR3DependencyMetadata(token, isAttributeDep, facade.host, facade.optional, facade.self, facade.skipSelf);
    }
    function convertR3DeclareDependencyMetadata(facade) {
        var _a, _b, _c, _d, _e;
        var isAttributeDep = (_a = facade.attribute) !== null && _a !== void 0 ? _a : false;
        var token = facade.token === null ? null : new output_ast_1.WrappedNodeExpr(facade.token);
        return createR3DependencyMetadata(token, isAttributeDep, (_b = facade.host) !== null && _b !== void 0 ? _b : false, (_c = facade.optional) !== null && _c !== void 0 ? _c : false, (_d = facade.self) !== null && _d !== void 0 ? _d : false, (_e = facade.skipSelf) !== null && _e !== void 0 ? _e : false);
    }
    function createR3DependencyMetadata(token, isAttributeDep, host, optional, self, skipSelf) {
        // If the dep is an `@Attribute()` the `attributeNameType` ought to be the `unknown` type.
        // But types are not available at runtime so we just use a literal `"<unknown>"` string as a dummy
        // marker.
        var attributeNameType = isAttributeDep ? output_ast_1.literal('unknown') : null;
        return { token: token, attributeNameType: attributeNameType, host: host, optional: optional, self: self, skipSelf: skipSelf };
    }
    function extractHostBindings(propMetadata, sourceSpan, host) {
        // First parse the declarations from the metadata.
        var bindings = compiler_1.parseHostBindings(host || {});
        // After that check host bindings for errors
        var errors = compiler_1.verifyHostBindings(bindings, sourceSpan);
        if (errors.length) {
            throw new Error(errors.map(function (error) { return error.msg; }).join('\n'));
        }
        var _loop_2 = function (field) {
            if (propMetadata.hasOwnProperty(field)) {
                propMetadata[field].forEach(function (ann) {
                    if (isHostBinding(ann)) {
                        // Since this is a decorator, we know that the value is a class member. Always access it
                        // through `this` so that further down the line it can't be confused for a literal value
                        // (e.g. if there's a property called `true`).
                        bindings.properties[ann.hostPropertyName || field] =
                            util_1.getSafePropertyAccessString('this', field);
                    }
                    else if (isHostListener(ann)) {
                        bindings.listeners[ann.eventName || field] = field + "(" + (ann.args || []).join(',') + ")";
                    }
                });
            }
        };
        // Next, loop over the properties of the object, looking for @HostBinding and @HostListener.
        for (var field in propMetadata) {
            _loop_2(field);
        }
        return bindings;
    }
    function isHostBinding(value) {
        return value.ngMetadataName === 'HostBinding';
    }
    function isHostListener(value) {
        return value.ngMetadataName === 'HostListener';
    }
    function isInput(value) {
        return value.ngMetadataName === 'Input';
    }
    function isOutput(value) {
        return value.ngMetadataName === 'Output';
    }
    function parseInputOutputs(values) {
        return values.reduce(function (map, value) {
            var _a = tslib_1.__read(value.split(',').map(function (piece) { return piece.trim(); }), 2), field = _a[0], property = _a[1];
            map[field] = property || field;
            return map;
        }, {});
    }
    function convertDeclarePipeFacadeToMetadata(declaration) {
        var _a;
        return {
            name: declaration.type.name,
            type: util_1.wrapReference(declaration.type),
            internalType: new output_ast_1.WrappedNodeExpr(declaration.type),
            typeArgumentCount: 0,
            pipeName: declaration.name,
            deps: null,
            pure: (_a = declaration.pure) !== null && _a !== void 0 ? _a : true,
        };
    }
    function convertDeclareInjectorFacadeToMetadata(declaration) {
        return {
            name: declaration.type.name,
            type: util_1.wrapReference(declaration.type),
            internalType: new output_ast_1.WrappedNodeExpr(declaration.type),
            providers: declaration.providers !== undefined ? new output_ast_1.WrappedNodeExpr(declaration.providers) :
                null,
            imports: declaration.imports !== undefined ?
                declaration.imports.map(function (i) { return new output_ast_1.WrappedNodeExpr(i); }) :
                [],
        };
    }
    function publishFacade(global) {
        var ng = global.ng || (global.ng = {});
        ng.ɵcompilerFacade = new CompilerFacadeImpl();
    }
    exports.publishFacade = publishFacade;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFJSCxxRUFBNkM7SUFDN0MsbURBQWtIO0lBQ2xILHFGQUEwRDtJQUMxRCw2RkFBbUc7SUFDbkcsc0VBQStIO0lBQy9ILHNFQUFpRDtJQUNqRCwrREFBOEU7SUFDOUUsdUVBQWlHO0lBQ2pHLDJGQUFtRjtJQUNuRiwrREFBZ0Q7SUFDaEQsdUZBQXVIO0lBQ3ZILG1GQUFtRjtJQUNuRiwyREFBMEU7SUFFMUUsd0VBQThKO0lBQzlKLHdFQUF5RTtJQUN6RSx5RUFBaUQ7SUFDakQsd0dBQThFO0lBRTlFO1FBS0UsNEJBQW9CLFlBQWlDO1lBQWpDLDZCQUFBLEVBQUEsbUJBQW1CLHlCQUFZLEVBQUU7WUFBakMsaUJBQVksR0FBWixZQUFZLENBQXFCO1lBSnJELGtCQUFhLEdBQUcsMEJBQW9CLENBQUM7WUFDckMsbUJBQWMsR0FBRyxnQ0FBYyxDQUFDO1lBQ3hCLDBCQUFxQixHQUFHLElBQUksc0RBQXdCLEVBQUUsQ0FBQztRQUVQLENBQUM7UUFFekQsd0NBQVcsR0FBWCxVQUFZLGNBQStCLEVBQUUsWUFBb0IsRUFBRSxNQUE0QjtZQUU3RixJQUFNLFFBQVEsR0FBbUI7Z0JBQy9CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtnQkFDakIsSUFBSSxFQUFFLG9CQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDaEMsWUFBWSxFQUFFLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUM5QyxpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixJQUFJLEVBQUUsSUFBSTtnQkFDVixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7Z0JBQ3pCLElBQUksRUFB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LElBQUksNEJBQWUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDNUMsSUFBSTtZQUNyRCxPQUFPLEVBQUUsV0FBVyxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQztnQkFDeEMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxJQUFJLDRCQUFlLENBQUMsQ0FBQyxDQUFDLEVBQXRCLENBQXNCLENBQUMsQ0FBQyxDQUFDO2dCQUN0RCxFQUFFO1NBQ1AsQ0FBQztJQUNKLENBQUM7SUFFRCxTQUFnQixhQUFhLENBQUMsTUFBVztRQUN2QyxJQUFNLEVBQUUsR0FBMkIsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDakUsRUFBRSxDQUFDLGVBQWUsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7SUFDaEQsQ0FBQztJQUhELHNDQUdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtDb21waWxlckZhY2FkZSwgQ29yZUVudmlyb25tZW50LCBFeHBvcnRlZENvbXBpbGVyRmFjYWRlLCBPcGFxdWVWYWx1ZSwgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlLCBSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUsIFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSwgUjNEZWNsYXJlRmFjdG9yeUZhY2FkZSwgUjNEZWNsYXJlSW5qZWN0b3JGYWNhZGUsIFIzRGVjbGFyZU5nTW9kdWxlRmFjYWRlLCBSM0RlY2xhcmVQaXBlRmFjYWRlLCBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhRmFjYWRlLCBSM0RlY2xhcmVVc2VkRGlyZWN0aXZlRmFjYWRlLCBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSwgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUsIFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlLCBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUsIFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSwgUjNQaXBlTWV0YWRhdGFGYWNhZGUsIFIzUXVlcnlNZXRhZGF0YUZhY2FkZSwgU3RyaW5nTWFwLCBTdHJpbmdNYXBXaXRoUmVuYW1lfSBmcm9tICcuL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UnO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0NoYW5nZURldGVjdGlvblN0cmF0ZWd5LCBIb3N0QmluZGluZywgSG9zdExpc3RlbmVyLCBJbnB1dCwgT3V0cHV0LCBUeXBlLCBWaWV3RW5jYXBzdWxhdGlvbn0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7Y29tcGlsZUluamVjdGFibGV9IGZyb20gJy4vaW5qZWN0YWJsZV9jb21waWxlcl8yJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtEZWNsYXJlVmFyU3RtdCwgRXhwcmVzc2lvbiwgbGl0ZXJhbCwgTGl0ZXJhbEV4cHIsIFN0YXRlbWVudCwgU3RtdE1vZGlmaWVyLCBXcmFwcGVkTm9kZUV4cHJ9IGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtKaXRFdmFsdWF0b3J9IGZyb20gJy4vb3V0cHV0L291dHB1dF9qaXQnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW4sIHIzSml0VHlwZVNvdXJjZVNwYW59IGZyb20gJy4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2NvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIEZhY3RvcnlUYXJnZXQsIFIzRGVwZW5kZW5jeU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfZmFjdG9yeSc7XG5pbXBvcnQge2NvbXBpbGVJbmplY3RvciwgUjNJbmplY3Rvck1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfaW5qZWN0b3JfY29tcGlsZXInO1xuaW1wb3J0IHtSM0ppdFJlZmxlY3Rvcn0gZnJvbSAnLi9yZW5kZXIzL3IzX2ppdCc7XG5pbXBvcnQge2NvbXBpbGVOZ01vZHVsZSwgY29tcGlsZU5nTW9kdWxlRGVjbGFyYXRpb25FeHByZXNzaW9uLCBSM05nTW9kdWxlTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19tb2R1bGVfY29tcGlsZXInO1xuaW1wb3J0IHtjb21waWxlUGlwZUZyb21NZXRhZGF0YSwgUjNQaXBlTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19waXBlX2NvbXBpbGVyJztcbmltcG9ydCB7Z2V0U2FmZVByb3BlcnR5QWNjZXNzU3RyaW5nLCB3cmFwUmVmZXJlbmNlfSBmcm9tICcuL3JlbmRlcjMvdXRpbCc7XG5pbXBvcnQge0RlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhLCBSM1VzZWREaXJlY3RpdmVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmltcG9ydCB7Y29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YSwgUGFyc2VkSG9zdEJpbmRpbmdzLCBwYXJzZUhvc3RCaW5kaW5ncywgdmVyaWZ5SG9zdEJpbmRpbmdzfSBmcm9tICcuL3JlbmRlcjMvdmlldy9jb21waWxlcic7XG5pbXBvcnQge21ha2VCaW5kaW5nUGFyc2VyLCBwYXJzZVRlbXBsYXRlfSBmcm9tICcuL3JlbmRlcjMvdmlldy90ZW1wbGF0ZSc7XG5pbXBvcnQge1Jlc291cmNlTG9hZGVyfSBmcm9tICcuL3Jlc291cmNlX2xvYWRlcic7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcblxuZXhwb3J0IGNsYXNzIENvbXBpbGVyRmFjYWRlSW1wbCBpbXBsZW1lbnRzIENvbXBpbGVyRmFjYWRlIHtcbiAgRmFjdG9yeVRhcmdldCA9IEZhY3RvcnlUYXJnZXQgYXMgYW55O1xuICBSZXNvdXJjZUxvYWRlciA9IFJlc291cmNlTG9hZGVyO1xuICBwcml2YXRlIGVsZW1lbnRTY2hlbWFSZWdpc3RyeSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGppdEV2YWx1YXRvciA9IG5ldyBKaXRFdmFsdWF0b3IoKSkge31cblxuICBjb21waWxlUGlwZShhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgZmFjYWRlOiBSM1BpcGVNZXRhZGF0YUZhY2FkZSk6XG4gICAgICBhbnkge1xuICAgIGNvbnN0IG1ldGFkYXRhOiBSM1BpcGVNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgICBkZXBzOiBudWxsLFxuICAgICAgcGlwZU5hbWU6IGZhY2FkZS5waXBlTmFtZSxcbiAgICAgIHB1cmU6IGZhY2FkZS5wdXJlLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZVBpcGVGcm9tTWV0YWRhdGEobWV0YWRhdGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVQaXBlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVQaXBlRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVQaXBlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbik7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZVBpcGVGcm9tTWV0YWRhdGEobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZUluamVjdGFibGUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNJbmplY3RhYmxlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHtleHByZXNzaW9uLCBzdGF0ZW1lbnRzfSA9IGNvbXBpbGVJbmplY3RhYmxlKHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IGZhY2FkZS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgIHByb3ZpZGVkSW46IGNvbXB1dGVQcm92aWRlZEluKGZhY2FkZS5wcm92aWRlZEluKSxcbiAgICAgIHVzZUNsYXNzOiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9DTEFTUyksXG4gICAgICB1c2VGYWN0b3J5OiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9GQUNUT1JZKSxcbiAgICAgIHVzZVZhbHVlOiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9WQUxVRSksXG4gICAgICB1c2VFeGlzdGluZzogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRVhJU1RJTkcpLFxuICAgICAgdXNlckRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS51c2VyRGVwcykgfHwgdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihleHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBzdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RvcihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzSW5qZWN0b3JNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgcHJvdmlkZXJzOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKGkgPT4gbmV3IFdyYXBwZWROb2RlRXhwcihpKSksXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlSW5qZWN0b3IobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZUluamVjdG9yRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVJbmplY3RvckZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YSA9IGNvbnZlcnREZWNsYXJlSW5qZWN0b3JGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlSW5qZWN0b3IobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZU5nTW9kdWxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhID0ge1xuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgYWRqYWNlbnRUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGJvb3RzdHJhcDogZmFjYWRlLmJvb3RzdHJhcC5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBkZWNsYXJhdGlvbnM6IGZhY2FkZS5kZWNsYXJhdGlvbnMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZXhwb3J0czogZmFjYWRlLmV4cG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZW1pdElubGluZTogdHJ1ZSxcbiAgICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzOiBmYWxzZSxcbiAgICAgIHNjaGVtYXM6IGZhY2FkZS5zY2hlbWFzID8gZmFjYWRlLnNjaGVtYXMubWFwKHdyYXBSZWZlcmVuY2UpIDogbnVsbCxcbiAgICAgIGlkOiBmYWNhZGUuaWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5pZCkgOiBudWxsLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZU5nTW9kdWxlKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVOZ01vZHVsZURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlTmdNb2R1bGVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbkV4cHJlc3Npb24oZGVjbGFyYXRpb24pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZURpcmVjdGl2ZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhID0gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHR5cGVTb3VyY2VTcGFuID1cbiAgICAgICAgdGhpcy5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0RpcmVjdGl2ZScsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsKTtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3Bhbik7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIG1ldGEpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IGFueSB7XG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuICAgIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICAvLyBQYXJzZSB0aGUgdGVtcGxhdGUgYW5kIGNoZWNrIGZvciBlcnJvcnMuXG4gICAgY29uc3Qge3RlbXBsYXRlLCBpbnRlcnBvbGF0aW9ufSA9IHBhcnNlSml0VGVtcGxhdGUoXG4gICAgICAgIGZhY2FkZS50ZW1wbGF0ZSwgZmFjYWRlLm5hbWUsIHNvdXJjZU1hcFVybCwgZmFjYWRlLnByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgICAgIGZhY2FkZS5pbnRlcnBvbGF0aW9uKTtcblxuICAgIC8vIENvbXBpbGUgdGhlIGNvbXBvbmVudCBtZXRhZGF0YSwgaW5jbHVkaW5nIHRlbXBsYXRlLCBpbnRvIGFuIGV4cHJlc3Npb24uXG4gICAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAgIC4uLmZhY2FkZSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICAgIC4uLmNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZSksXG4gICAgICBzZWxlY3RvcjogZmFjYWRlLnNlbGVjdG9yIHx8IHRoaXMuZWxlbWVudFNjaGVtYVJlZ2lzdHJ5LmdldERlZmF1bHRDb21wb25lbnRFbGVtZW50TmFtZSgpLFxuICAgICAgdGVtcGxhdGUsXG4gICAgICBkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTogRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0LFxuICAgICAgc3R5bGVzOiBbLi4uZmFjYWRlLnN0eWxlcywgLi4udGVtcGxhdGUuc3R5bGVzXSxcbiAgICAgIGVuY2Fwc3VsYXRpb246IGZhY2FkZS5lbmNhcHN1bGF0aW9uIGFzIGFueSxcbiAgICAgIGludGVycG9sYXRpb24sXG4gICAgICBjaGFuZ2VEZXRlY3Rpb246IGZhY2FkZS5jaGFuZ2VEZXRlY3Rpb24sXG4gICAgICBhbmltYXRpb25zOiBmYWNhZGUuYW5pbWF0aW9ucyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuYW5pbWF0aW9ucykgOiBudWxsLFxuICAgICAgdmlld1Byb3ZpZGVyczogZmFjYWRlLnZpZXdQcm92aWRlcnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnZpZXdQcm92aWRlcnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICAgIH07XG4gICAgY29uc3Qgaml0RXhwcmVzc2lvblNvdXJjZU1hcCA9IGBuZzovLy8ke2ZhY2FkZS5uYW1lfS5qc2A7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZUNvbXBvbmVudEZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBqaXRFeHByZXNzaW9uU291cmNlTWFwLCBtZXRhKTtcbiAgfVxuXG4gIGNvbXBpbGVDb21wb25lbnREZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgdHlwZVNvdXJjZVNwYW4gPVxuICAgICAgICB0aGlzLmNyZWF0ZVBhcnNlU291cmNlU3BhbignQ29tcG9uZW50JywgZGVjbGFyYXRpb24udHlwZS5uYW1lLCBzb3VyY2VNYXBVcmwpO1xuICAgIGNvbnN0IG1ldGEgPSBjb252ZXJ0RGVjbGFyZUNvbXBvbmVudEZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb24sIHR5cGVTb3VyY2VTcGFuLCBzb3VyY2VNYXBVcmwpO1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVDb21wb25lbnRGcm9tTWV0YShhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBtZXRhKTtcbiAgfVxuXG4gIHByaXZhdGUgY29tcGlsZUNvbXBvbmVudEZyb21NZXRhKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEpOiBhbnkge1xuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcbiAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIobWV0YS5pbnRlcnBvbGF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihcbiAgICAgICAgcmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVGYWN0b3J5KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlKSB7XG4gICAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgbmFtZTogbWV0YS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShtZXRhLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKG1ldGEudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogbWV0YS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgIGRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KG1ldGEuZGVwcyksXG4gICAgICB0YXJnZXQ6IG1ldGEudGFyZ2V0LFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIGZhY3RvcnlSZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgZmFjdG9yeVJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVGYWN0b3J5RGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNEZWNsYXJlRmFjdG9yeUZhY2FkZSkge1xuICAgIGNvbnN0IGZhY3RvcnlSZXMgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgIG5hbWU6IG1ldGEudHlwZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShtZXRhLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKG1ldGEudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICAgIGRlcHM6IG1ldGEuZGVwcyAmJiBtZXRhLmRlcHMubWFwKGNvbnZlcnRSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGEpLFxuICAgICAgdGFyZ2V0OiBtZXRhLnRhcmdldCxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICBmYWN0b3J5UmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGZhY3RvcnlSZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuXG4gIGNyZWF0ZVBhcnNlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gcjNKaXRUeXBlU291cmNlU3BhbihraW5kLCB0eXBlTmFtZSwgc291cmNlVXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBKSVQgY29tcGlsZXMgYW4gZXhwcmVzc2lvbiBhbmQgcmV0dXJucyB0aGUgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGF0IGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBwYXJhbSBkZWYgdGhlIGRlZmluaXRpb24gd2hpY2ggd2lsbCBiZSBjb21waWxlZCBhbmQgZXhlY3V0ZWQgdG8gZ2V0IHRoZSB2YWx1ZSB0byBwYXRjaFxuICAgKiBAcGFyYW0gY29udGV4dCBhbiBvYmplY3QgbWFwIG9mIEBhbmd1bGFyL2NvcmUgc3ltYm9sIG5hbWVzIHRvIHN5bWJvbHMgd2hpY2ggd2lsbCBiZSBhdmFpbGFibGVcbiAgICogaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHNvdXJjZVVybCBhIFVSTCB0byB1c2UgZm9yIHRoZSBzb3VyY2UgbWFwIG9mIHRoZSBjb21waWxlZCBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBwcmVTdGF0ZW1lbnRzIGEgY29sbGVjdGlvbiBvZiBzdGF0ZW1lbnRzIHRoYXQgc2hvdWxkIGJlIGV2YWx1YXRlZCBiZWZvcmUgdGhlIGV4cHJlc3Npb24uXG4gICAqL1xuICBwcml2YXRlIGppdEV4cHJlc3Npb24oXG4gICAgICBkZWY6IEV4cHJlc3Npb24sIGNvbnRleHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBzb3VyY2VVcmw6IHN0cmluZyxcbiAgICAgIHByZVN0YXRlbWVudHM6IFN0YXRlbWVudFtdKTogYW55IHtcbiAgICAvLyBUaGUgQ29uc3RhbnRQb29sIG1heSBjb250YWluIFN0YXRlbWVudHMgd2hpY2ggZGVjbGFyZSB2YXJpYWJsZXMgdXNlZCBpbiB0aGUgZmluYWwgZXhwcmVzc2lvbi5cbiAgICAvLyBUaGVyZWZvcmUsIGl0cyBzdGF0ZW1lbnRzIG5lZWQgdG8gcHJlY2VkZSB0aGUgYWN0dWFsIEpJVCBvcGVyYXRpb24uIFRoZSBmaW5hbCBzdGF0ZW1lbnQgaXMgYVxuICAgIC8vIGRlY2xhcmF0aW9uIG9mICRkZWYgd2hpY2ggaXMgc2V0IHRvIHRoZSBleHByZXNzaW9uIGJlaW5nIGNvbXBpbGVkLlxuICAgIGNvbnN0IHN0YXRlbWVudHM6IFN0YXRlbWVudFtdID0gW1xuICAgICAgLi4ucHJlU3RhdGVtZW50cyxcbiAgICAgIG5ldyBEZWNsYXJlVmFyU3RtdCgnJGRlZicsIGRlZiwgdW5kZWZpbmVkLCBbU3RtdE1vZGlmaWVyLkV4cG9ydGVkXSksXG4gICAgXTtcblxuICAgIGNvbnN0IHJlcyA9IHRoaXMuaml0RXZhbHVhdG9yLmV2YWx1YXRlU3RhdGVtZW50cyhcbiAgICAgICAgc291cmNlVXJsLCBzdGF0ZW1lbnRzLCBuZXcgUjNKaXRSZWZsZWN0b3IoY29udGV4dCksIC8qIGVuYWJsZVNvdXJjZU1hcHMgKi8gdHJ1ZSk7XG4gICAgcmV0dXJuIHJlc1snJGRlZiddO1xuICB9XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID0gUGljazxcbiAgICBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLFxuICAgIEV4Y2x1ZGU8RXhjbHVkZTxrZXlvZiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLCAncHJlc2VydmVXaGl0ZXNwYWNlcyc+LCAncHJvcE1ldGFkYXRhJz4+O1xuXG5jb25zdCBVU0VfQ0xBU1MgPSBPYmplY3Qua2V5cyh7dXNlQ2xhc3M6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9GQUNUT1JZID0gT2JqZWN0LmtleXMoe3VzZUZhY3Rvcnk6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9WQUxVRSA9IE9iamVjdC5rZXlzKHt1c2VWYWx1ZTogbnVsbH0pWzBdO1xuY29uc3QgVVNFX0VYSVNUSU5HID0gT2JqZWN0LmtleXMoe3VzZUV4aXN0aW5nOiBudWxsfSlbMF07XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YShmYWNhZGU6IFIzUXVlcnlNZXRhZGF0YUZhY2FkZSk6IFIzUXVlcnlNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgLi4uZmFjYWRlLFxuICAgIHByZWRpY2F0ZTogQXJyYXkuaXNBcnJheShmYWNhZGUucHJlZGljYXRlKSA/IGZhY2FkZS5wcmVkaWNhdGUgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnByZWRpY2F0ZSksXG4gICAgcmVhZDogZmFjYWRlLnJlYWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5yZWFkKSA6IG51bGwsXG4gICAgc3RhdGljOiBmYWNhZGUuc3RhdGljLFxuICAgIGVtaXREaXN0aW5jdENoYW5nZXNPbmx5OiBmYWNhZGUuZW1pdERpc3RpbmN0Q2hhbmdlc09ubHksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRRdWVyeURlY2xhcmF0aW9uVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNEZWNsYXJlUXVlcnlNZXRhZGF0YUZhY2FkZSk6XG4gICAgUjNRdWVyeU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBwcm9wZXJ0eU5hbWU6IGRlY2xhcmF0aW9uLnByb3BlcnR5TmFtZSxcbiAgICBmaXJzdDogZGVjbGFyYXRpb24uZmlyc3QgPz8gZmFsc2UsXG4gICAgcHJlZGljYXRlOiBBcnJheS5pc0FycmF5KGRlY2xhcmF0aW9uLnByZWRpY2F0ZSkgPyBkZWNsYXJhdGlvbi5wcmVkaWNhdGUgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi5wcmVkaWNhdGUpLFxuICAgIGRlc2NlbmRhbnRzOiBkZWNsYXJhdGlvbi5kZXNjZW5kYW50cyA/PyBmYWxzZSxcbiAgICByZWFkOiBkZWNsYXJhdGlvbi5yZWFkID8gbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi5yZWFkKSA6IG51bGwsXG4gICAgc3RhdGljOiBkZWNsYXJhdGlvbi5zdGF0aWMgPz8gZmFsc2UsXG4gICAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHk6IGRlY2xhcmF0aW9uLmVtaXREaXN0aW5jdENoYW5nZXNPbmx5ID8/IHRydWUsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZTogUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSk6IFIzRGlyZWN0aXZlTWV0YWRhdGEge1xuICBjb25zdCBpbnB1dHNGcm9tTWV0YWRhdGEgPSBwYXJzZUlucHV0T3V0cHV0cyhmYWNhZGUuaW5wdXRzIHx8IFtdKTtcbiAgY29uc3Qgb3V0cHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlSW5wdXRPdXRwdXRzKGZhY2FkZS5vdXRwdXRzIHx8IFtdKTtcbiAgY29uc3QgcHJvcE1ldGFkYXRhID0gZmFjYWRlLnByb3BNZXRhZGF0YTtcbiAgY29uc3QgaW5wdXRzRnJvbVR5cGU6IFN0cmluZ01hcFdpdGhSZW5hbWUgPSB7fTtcbiAgY29uc3Qgb3V0cHV0c0Zyb21UeXBlOiBTdHJpbmdNYXAgPSB7fTtcbiAgZm9yIChjb25zdCBmaWVsZCBpbiBwcm9wTWV0YWRhdGEpIHtcbiAgICBpZiAocHJvcE1ldGFkYXRhLmhhc093blByb3BlcnR5KGZpZWxkKSkge1xuICAgICAgcHJvcE1ldGFkYXRhW2ZpZWxkXS5mb3JFYWNoKGFubiA9PiB7XG4gICAgICAgIGlmIChpc0lucHV0KGFubikpIHtcbiAgICAgICAgICBpbnB1dHNGcm9tVHlwZVtmaWVsZF0gPVxuICAgICAgICAgICAgICBhbm4uYmluZGluZ1Byb3BlcnR5TmFtZSA/IFthbm4uYmluZGluZ1Byb3BlcnR5TmFtZSwgZmllbGRdIDogZmllbGQ7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNPdXRwdXQoYW5uKSkge1xuICAgICAgICAgIG91dHB1dHNGcm9tVHlwZVtmaWVsZF0gPSBhbm4uYmluZGluZ1Byb3BlcnR5TmFtZSB8fCBmaWVsZDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5mYWNhZGUgYXMgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZU5vUHJvcEFuZFdoaXRlc3BhY2UsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgdHlwZVNvdXJjZVNwYW46IGZhY2FkZS50eXBlU291cmNlU3BhbixcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgIGRlcHM6IG51bGwsXG4gICAgaG9zdDogZXh0cmFjdEhvc3RCaW5kaW5ncyhmYWNhZGUucHJvcE1ldGFkYXRhLCBmYWNhZGUudHlwZVNvdXJjZVNwYW4sIGZhY2FkZS5ob3N0KSxcbiAgICBpbnB1dHM6IHsuLi5pbnB1dHNGcm9tTWV0YWRhdGEsIC4uLmlucHV0c0Zyb21UeXBlfSxcbiAgICBvdXRwdXRzOiB7Li4ub3V0cHV0c0Zyb21NZXRhZGF0YSwgLi4ub3V0cHV0c0Zyb21UeXBlfSxcbiAgICBxdWVyaWVzOiBmYWNhZGUucXVlcmllcy5tYXAoY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKSxcbiAgICBwcm92aWRlcnM6IGZhY2FkZS5wcm92aWRlcnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnByb3ZpZGVycykgOiBudWxsLFxuICAgIHZpZXdRdWVyaWVzOiBmYWNhZGUudmlld1F1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgZnVsbEluaGVyaXRhbmNlOiBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKFxuICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUsIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBkZWNsYXJhdGlvbi50eXBlLm5hbWUsXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShkZWNsYXJhdGlvbi50eXBlKSxcbiAgICB0eXBlU291cmNlU3BhbixcbiAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24udHlwZSksXG4gICAgc2VsZWN0b3I6IGRlY2xhcmF0aW9uLnNlbGVjdG9yID8/IG51bGwsXG4gICAgaW5wdXRzOiBkZWNsYXJhdGlvbi5pbnB1dHMgPz8ge30sXG4gICAgb3V0cHV0czogZGVjbGFyYXRpb24ub3V0cHV0cyA/PyB7fSxcbiAgICBob3N0OiBjb252ZXJ0SG9zdERlY2xhcmF0aW9uVG9NZXRhZGF0YShkZWNsYXJhdGlvbi5ob3N0KSxcbiAgICBxdWVyaWVzOiAoZGVjbGFyYXRpb24ucXVlcmllcyA/PyBbXSkubWFwKGNvbnZlcnRRdWVyeURlY2xhcmF0aW9uVG9NZXRhZGF0YSksXG4gICAgdmlld1F1ZXJpZXM6IChkZWNsYXJhdGlvbi52aWV3UXVlcmllcyA/PyBbXSkubWFwKGNvbnZlcnRRdWVyeURlY2xhcmF0aW9uVG9NZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBkZWNsYXJhdGlvbi5wcm92aWRlcnMgIT09IHVuZGVmaW5lZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24ucHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgZXhwb3J0QXM6IGRlY2xhcmF0aW9uLmV4cG9ydEFzID8/IG51bGwsXG4gICAgdXNlc0luaGVyaXRhbmNlOiBkZWNsYXJhdGlvbi51c2VzSW5oZXJpdGFuY2UgPz8gZmFsc2UsXG4gICAgbGlmZWN5Y2xlOiB7dXNlc09uQ2hhbmdlczogZGVjbGFyYXRpb24udXNlc09uQ2hhbmdlcyA/PyBmYWxzZX0sXG4gICAgZGVwczogbnVsbCxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICBmdWxsSW5oZXJpdGFuY2U6IGZhbHNlLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0SG9zdERlY2xhcmF0aW9uVG9NZXRhZGF0YShob3N0OiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGVbJ2hvc3QnXSA9IHt9KTpcbiAgICBSM0hvc3RNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgYXR0cmlidXRlczogY29udmVydE9wYXF1ZVZhbHVlc1RvRXhwcmVzc2lvbnMoaG9zdC5hdHRyaWJ1dGVzID8/IHt9KSxcbiAgICBsaXN0ZW5lcnM6IGhvc3QubGlzdGVuZXJzID8/IHt9LFxuICAgIHByb3BlcnRpZXM6IGhvc3QucHJvcGVydGllcyA/PyB7fSxcbiAgICBzcGVjaWFsQXR0cmlidXRlczoge1xuICAgICAgY2xhc3NBdHRyOiBob3N0LmNsYXNzQXR0cmlidXRlLFxuICAgICAgc3R5bGVBdHRyOiBob3N0LnN0eWxlQXR0cmlidXRlLFxuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRPcGFxdWVWYWx1ZXNUb0V4cHJlc3Npb25zKG9iajoge1trZXk6IHN0cmluZ106IE9wYXF1ZVZhbHVlfSk6XG4gICAge1trZXk6IHN0cmluZ106IFdyYXBwZWROb2RlRXhwcjx1bmtub3duPn0ge1xuICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBXcmFwcGVkTm9kZUV4cHI8dW5rbm93bj59ID0ge307XG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9iaikpIHtcbiAgICByZXN1bHRba2V5XSA9IG5ldyBXcmFwcGVkTm9kZUV4cHIob2JqW2tleV0pO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJlQ29tcG9uZW50RmFjYWRlVG9NZXRhZGF0YShcbiAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIHNvdXJjZU1hcFVybDogc3RyaW5nKTogUjNDb21wb25lbnRNZXRhZGF0YSB7XG4gIGNvbnN0IHt0ZW1wbGF0ZSwgaW50ZXJwb2xhdGlvbn0gPSBwYXJzZUppdFRlbXBsYXRlKFxuICAgICAgZGVjbGFyYXRpb24udGVtcGxhdGUsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsLFxuICAgICAgZGVjbGFyYXRpb24ucHJlc2VydmVXaGl0ZXNwYWNlcyA/PyBmYWxzZSwgZGVjbGFyYXRpb24uaW50ZXJwb2xhdGlvbik7XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5jb252ZXJ0RGVjbGFyZURpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb24sIHR5cGVTb3VyY2VTcGFuKSxcbiAgICB0ZW1wbGF0ZSxcbiAgICBzdHlsZXM6IGRlY2xhcmF0aW9uLnN0eWxlcyA/PyBbXSxcbiAgICBkaXJlY3RpdmVzOiAoZGVjbGFyYXRpb24uY29tcG9uZW50cyA/PyBbXSlcbiAgICAgICAgICAgICAgICAgICAgLmNvbmNhdChkZWNsYXJhdGlvbi5kaXJlY3RpdmVzID8/IFtdKVxuICAgICAgICAgICAgICAgICAgICAubWFwKGNvbnZlcnRVc2VkRGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKSxcbiAgICBwaXBlczogY29udmVydFVzZWRQaXBlc1RvTWV0YWRhdGEoZGVjbGFyYXRpb24ucGlwZXMpLFxuICAgIHZpZXdQcm92aWRlcnM6IGRlY2xhcmF0aW9uLnZpZXdQcm92aWRlcnMgIT09IHVuZGVmaW5lZCA/XG4gICAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24udmlld1Byb3ZpZGVycykgOlxuICAgICAgICBudWxsLFxuICAgIGFuaW1hdGlvbnM6IGRlY2xhcmF0aW9uLmFuaW1hdGlvbnMgIT09IHVuZGVmaW5lZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24uYW5pbWF0aW9ucykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgY2hhbmdlRGV0ZWN0aW9uOiBkZWNsYXJhdGlvbi5jaGFuZ2VEZXRlY3Rpb24gPz8gQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuRGVmYXVsdCxcbiAgICBlbmNhcHN1bGF0aW9uOiBkZWNsYXJhdGlvbi5lbmNhcHN1bGF0aW9uID8/IFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkLFxuICAgIGludGVycG9sYXRpb24sXG4gICAgZGVjbGFyYXRpb25MaXN0RW1pdE1vZGU6IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkNsb3N1cmVSZXNvbHZlZCxcbiAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogJycsXG4gICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0VXNlZERpcmVjdGl2ZURlY2xhcmF0aW9uVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNEZWNsYXJlVXNlZERpcmVjdGl2ZUZhY2FkZSk6XG4gICAgUjNVc2VkRGlyZWN0aXZlTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIHNlbGVjdG9yOiBkZWNsYXJhdGlvbi5zZWxlY3RvcixcbiAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIGlucHV0czogZGVjbGFyYXRpb24uaW5wdXRzID8/IFtdLFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8gW10sXG4gICAgZXhwb3J0QXM6IGRlY2xhcmF0aW9uLmV4cG9ydEFzID8/IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRVc2VkUGlwZXNUb01ldGFkYXRhKGRlY2xhcmVkUGlwZXM6IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZVsncGlwZXMnXSk6XG4gICAgTWFwPHN0cmluZywgRXhwcmVzc2lvbj4ge1xuICBjb25zdCBwaXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBFeHByZXNzaW9uPigpO1xuICBpZiAoZGVjbGFyZWRQaXBlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHBpcGVzO1xuICB9XG5cbiAgZm9yIChjb25zdCBwaXBlTmFtZSBvZiBPYmplY3Qua2V5cyhkZWNsYXJlZFBpcGVzKSkge1xuICAgIGNvbnN0IHBpcGVUeXBlID0gZGVjbGFyZWRQaXBlc1twaXBlTmFtZV07XG4gICAgcGlwZXMuc2V0KHBpcGVOYW1lLCBuZXcgV3JhcHBlZE5vZGVFeHByKHBpcGVUeXBlKSk7XG4gIH1cbiAgcmV0dXJuIHBpcGVzO1xufVxuXG5mdW5jdGlvbiBwYXJzZUppdFRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuLFxuICAgIGludGVycG9sYXRpb246IFtzdHJpbmcsIHN0cmluZ118dW5kZWZpbmVkKSB7XG4gIGNvbnN0IGludGVycG9sYXRpb25Db25maWcgPVxuICAgICAgaW50ZXJwb2xhdGlvbiA/IEludGVycG9sYXRpb25Db25maWcuZnJvbUFycmF5KGludGVycG9sYXRpb24pIDogREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRztcbiAgLy8gUGFyc2UgdGhlIHRlbXBsYXRlIGFuZCBjaGVjayBmb3IgZXJyb3JzLlxuICBjb25zdCBwYXJzZWQgPSBwYXJzZVRlbXBsYXRlKFxuICAgICAgdGVtcGxhdGUsIHNvdXJjZU1hcFVybCwge3ByZXNlcnZlV2hpdGVzcGFjZXM6IHByZXNlcnZlV2hpdGVzcGFjZXMsIGludGVycG9sYXRpb25Db25maWd9KTtcbiAgaWYgKHBhcnNlZC5lcnJvcnMgIT09IG51bGwpIHtcbiAgICBjb25zdCBlcnJvcnMgPSBwYXJzZWQuZXJyb3JzLm1hcChlcnIgPT4gZXJyLnRvU3RyaW5nKCkpLmpvaW4oJywgJyk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvcnMgZHVyaW5nIEpJVCBjb21waWxhdGlvbiBvZiB0ZW1wbGF0ZSBmb3IgJHt0eXBlTmFtZX06ICR7ZXJyb3JzfWApO1xuICB9XG4gIHJldHVybiB7dGVtcGxhdGU6IHBhcnNlZCwgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvbkNvbmZpZ307XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID1cbiAgICBQaWNrPFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIEV4Y2x1ZGU8a2V5b2YgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuZnVuY3Rpb24gd3JhcEV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBXcmFwcGVkTm9kZUV4cHI8YW55Pnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb3ZpZGVkSW4ocHJvdmlkZWRJbjogVHlwZXxzdHJpbmd8bnVsbHx1bmRlZmluZWQpOiBFeHByZXNzaW9uIHtcbiAgaWYgKHByb3ZpZGVkSW4gPT0gbnVsbCB8fCB0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gbmV3IExpdGVyYWxFeHByKHByb3ZpZGVkSW4pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKHByb3ZpZGVkSW4pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZXM6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlW118bnVsbHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZCk6IFIzRGVwZW5kZW5jeU1ldGFkYXRhW118bnVsbCB7XG4gIHJldHVybiBmYWNhZGVzID09IG51bGwgPyBudWxsIDogZmFjYWRlcy5tYXAoY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhKGZhY2FkZTogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIGNvbnN0IGlzQXR0cmlidXRlRGVwID0gZmFjYWRlLmF0dHJpYnV0ZSAhPSBudWxsOyAgLy8gYm90aCBgbnVsbGAgYW5kIGB1bmRlZmluZWRgXG4gIGNvbnN0IHJhd1Rva2VuID0gZmFjYWRlLnRva2VuID09PSBudWxsID8gbnVsbCA6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnRva2VuKTtcbiAgLy8gSW4gSklUIG1vZGUsIGlmIHRoZSBkZXAgaXMgYW4gYEBBdHRyaWJ1dGUoKWAgdGhlbiB3ZSB1c2UgdGhlIGF0dHJpYnV0ZSBuYW1lIGdpdmVuIGluXG4gIC8vIGBhdHRyaWJ1dGVgIHJhdGhlciB0aGFuIHRoZSBgdG9rZW5gLlxuICBjb25zdCB0b2tlbiA9IGlzQXR0cmlidXRlRGVwID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuYXR0cmlidXRlKSA6IHJhd1Rva2VuO1xuICByZXR1cm4gY3JlYXRlUjNEZXBlbmRlbmN5TWV0YWRhdGEoXG4gICAgICB0b2tlbiwgaXNBdHRyaWJ1dGVEZXAsIGZhY2FkZS5ob3N0LCBmYWNhZGUub3B0aW9uYWwsIGZhY2FkZS5zZWxmLCBmYWNhZGUuc2tpcFNlbGYpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhKGZhY2FkZTogUjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlKTpcbiAgICBSM0RlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIGNvbnN0IGlzQXR0cmlidXRlRGVwID0gZmFjYWRlLmF0dHJpYnV0ZSA/PyBmYWxzZTtcbiAgY29uc3QgdG9rZW4gPSBmYWNhZGUudG9rZW4gPT09IG51bGwgPyBudWxsIDogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudG9rZW4pO1xuICByZXR1cm4gY3JlYXRlUjNEZXBlbmRlbmN5TWV0YWRhdGEoXG4gICAgICB0b2tlbiwgaXNBdHRyaWJ1dGVEZXAsIGZhY2FkZS5ob3N0ID8/IGZhbHNlLCBmYWNhZGUub3B0aW9uYWwgPz8gZmFsc2UsIGZhY2FkZS5zZWxmID8/IGZhbHNlLFxuICAgICAgZmFjYWRlLnNraXBTZWxmID8/IGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUjNEZXBlbmRlbmN5TWV0YWRhdGEoXG4gICAgdG9rZW46IFdyYXBwZWROb2RlRXhwcjx1bmtub3duPnxudWxsLCBpc0F0dHJpYnV0ZURlcDogYm9vbGVhbiwgaG9zdDogYm9vbGVhbiwgb3B0aW9uYWw6IGJvb2xlYW4sXG4gICAgc2VsZjogYm9vbGVhbiwgc2tpcFNlbGY6IGJvb2xlYW4pOiBSM0RlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIC8vIElmIHRoZSBkZXAgaXMgYW4gYEBBdHRyaWJ1dGUoKWAgdGhlIGBhdHRyaWJ1dGVOYW1lVHlwZWAgb3VnaHQgdG8gYmUgdGhlIGB1bmtub3duYCB0eXBlLlxuICAvLyBCdXQgdHlwZXMgYXJlIG5vdCBhdmFpbGFibGUgYXQgcnVudGltZSBzbyB3ZSBqdXN0IHVzZSBhIGxpdGVyYWwgYFwiPHVua25vd24+XCJgIHN0cmluZyBhcyBhIGR1bW15XG4gIC8vIG1hcmtlci5cbiAgY29uc3QgYXR0cmlidXRlTmFtZVR5cGUgPSBpc0F0dHJpYnV0ZURlcCA/IGxpdGVyYWwoJ3Vua25vd24nKSA6IG51bGw7XG4gIHJldHVybiB7dG9rZW4sIGF0dHJpYnV0ZU5hbWVUeXBlLCBob3N0LCBvcHRpb25hbCwgc2VsZiwgc2tpcFNlbGZ9O1xufVxuXG5mdW5jdGlvbiBleHRyYWN0SG9zdEJpbmRpbmdzKFxuICAgIHByb3BNZXRhZGF0YToge1trZXk6IHN0cmluZ106IGFueVtdfSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIGhvc3Q/OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSk6IFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIC8vIEZpcnN0IHBhcnNlIHRoZSBkZWNsYXJhdGlvbnMgZnJvbSB0aGUgbWV0YWRhdGEuXG4gIGNvbnN0IGJpbmRpbmdzID0gcGFyc2VIb3N0QmluZGluZ3MoaG9zdCB8fCB7fSk7XG5cbiAgLy8gQWZ0ZXIgdGhhdCBjaGVjayBob3N0IGJpbmRpbmdzIGZvciBlcnJvcnNcbiAgY29uc3QgZXJyb3JzID0gdmVyaWZ5SG9zdEJpbmRpbmdzKGJpbmRpbmdzLCBzb3VyY2VTcGFuKTtcbiAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm1hcCgoZXJyb3I6IFBhcnNlRXJyb3IpID0+IGVycm9yLm1zZykuam9pbignXFxuJykpO1xuICB9XG5cbiAgLy8gTmV4dCwgbG9vcCBvdmVyIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBvYmplY3QsIGxvb2tpbmcgZm9yIEBIb3N0QmluZGluZyBhbmQgQEhvc3RMaXN0ZW5lci5cbiAgZm9yIChjb25zdCBmaWVsZCBpbiBwcm9wTWV0YWRhdGEpIHtcbiAgICBpZiAocHJvcE1ldGFkYXRhLmhhc093blByb3BlcnR5KGZpZWxkKSkge1xuICAgICAgcHJvcE1ldGFkYXRhW2ZpZWxkXS5mb3JFYWNoKGFubiA9PiB7XG4gICAgICAgIGlmIChpc0hvc3RCaW5kaW5nKGFubikpIHtcbiAgICAgICAgICAvLyBTaW5jZSB0aGlzIGlzIGEgZGVjb3JhdG9yLCB3ZSBrbm93IHRoYXQgdGhlIHZhbHVlIGlzIGEgY2xhc3MgbWVtYmVyLiBBbHdheXMgYWNjZXNzIGl0XG4gICAgICAgICAgLy8gdGhyb3VnaCBgdGhpc2Agc28gdGhhdCBmdXJ0aGVyIGRvd24gdGhlIGxpbmUgaXQgY2FuJ3QgYmUgY29uZnVzZWQgZm9yIGEgbGl0ZXJhbCB2YWx1ZVxuICAgICAgICAgIC8vIChlLmcuIGlmIHRoZXJlJ3MgYSBwcm9wZXJ0eSBjYWxsZWQgYHRydWVgKS5cbiAgICAgICAgICBiaW5kaW5ncy5wcm9wZXJ0aWVzW2Fubi5ob3N0UHJvcGVydHlOYW1lIHx8IGZpZWxkXSA9XG4gICAgICAgICAgICAgIGdldFNhZmVQcm9wZXJ0eUFjY2Vzc1N0cmluZygndGhpcycsIGZpZWxkKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0hvc3RMaXN0ZW5lcihhbm4pKSB7XG4gICAgICAgICAgYmluZGluZ3MubGlzdGVuZXJzW2Fubi5ldmVudE5hbWUgfHwgZmllbGRdID0gYCR7ZmllbGR9KCR7KGFubi5hcmdzIHx8IFtdKS5qb2luKCcsJyl9KWA7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBiaW5kaW5ncztcbn1cblxuZnVuY3Rpb24gaXNIb3N0QmluZGluZyh2YWx1ZTogYW55KTogdmFsdWUgaXMgSG9zdEJpbmRpbmcge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdIb3N0QmluZGluZyc7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdExpc3RlbmVyKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBIb3N0TGlzdGVuZXIge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdIb3N0TGlzdGVuZXInO1xufVxuXG5cbmZ1bmN0aW9uIGlzSW5wdXQodmFsdWU6IGFueSk6IHZhbHVlIGlzIElucHV0IHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSW5wdXQnO1xufVxuXG5mdW5jdGlvbiBpc091dHB1dCh2YWx1ZTogYW55KTogdmFsdWUgaXMgT3V0cHV0IHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnT3V0cHV0Jztcbn1cblxuZnVuY3Rpb24gcGFyc2VJbnB1dE91dHB1dHModmFsdWVzOiBzdHJpbmdbXSk6IFN0cmluZ01hcCB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlKChtYXAsIHZhbHVlKSA9PiB7XG4gICAgY29uc3QgW2ZpZWxkLCBwcm9wZXJ0eV0gPSB2YWx1ZS5zcGxpdCgnLCcpLm1hcChwaWVjZSA9PiBwaWVjZS50cmltKCkpO1xuICAgIG1hcFtmaWVsZF0gPSBwcm9wZXJ0eSB8fCBmaWVsZDtcbiAgICByZXR1cm4gbWFwO1xuICB9LCB7fSBhcyBTdHJpbmdNYXApO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGVjbGFyZVBpcGVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVQaXBlRmFjYWRlKTogUjNQaXBlTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGRlY2xhcmF0aW9uLnR5cGUubmFtZSxcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi50eXBlKSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICBwaXBlTmFtZTogZGVjbGFyYXRpb24ubmFtZSxcbiAgICBkZXBzOiBudWxsLFxuICAgIHB1cmU6IGRlY2xhcmF0aW9uLnB1cmUgPz8gdHJ1ZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVJbmplY3RvckZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb246IFIzRGVjbGFyZUluamVjdG9yRmFjYWRlKTpcbiAgICBSM0luamVjdG9yTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGRlY2xhcmF0aW9uLnR5cGUubmFtZSxcbiAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi50eXBlKSxcbiAgICBwcm92aWRlcnM6IGRlY2xhcmF0aW9uLnByb3ZpZGVycyAhPT0gdW5kZWZpbmVkID8gbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi5wcm92aWRlcnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICBpbXBvcnRzOiBkZWNsYXJhdGlvbi5pbXBvcnRzICE9PSB1bmRlZmluZWQgP1xuICAgICAgICBkZWNsYXJhdGlvbi5pbXBvcnRzLm1hcChpID0+IG5ldyBXcmFwcGVkTm9kZUV4cHIoaSkpIDpcbiAgICAgICAgW10sXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdWJsaXNoRmFjYWRlKGdsb2JhbDogYW55KSB7XG4gIGNvbnN0IG5nOiBFeHBvcnRlZENvbXBpbGVyRmFjYWRlID0gZ2xvYmFsLm5nIHx8IChnbG9iYWwubmcgPSB7fSk7XG4gIG5nLsm1Y29tcGlsZXJGYWNhZGUgPSBuZXcgQ29tcGlsZXJGYWNhZGVJbXBsKCk7XG59XG4iXX0=