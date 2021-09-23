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
                type: (0, util_1.wrapReference)(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                typeArgumentCount: 0,
                deps: null,
                pipeName: facade.pipeName,
                pure: facade.pure,
            };
            var res = (0, r3_pipe_compiler_1.compilePipeFromMetadata)(metadata);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compilePipeDeclaration = function (angularCoreEnv, sourceMapUrl, declaration) {
            var meta = convertDeclarePipeFacadeToMetadata(declaration);
            var res = (0, r3_pipe_compiler_1.compilePipeFromMetadata)(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileInjectable = function (angularCoreEnv, sourceMapUrl, facade) {
            var _a;
            var _b = (0, injectable_compiler_2_1.compileInjectable)({
                name: facade.name,
                type: (0, util_1.wrapReference)(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                typeArgumentCount: facade.typeArgumentCount,
                providedIn: computeProvidedIn(facade.providedIn),
                useClass: convertToProviderExpression(facade, USE_CLASS),
                useFactory: wrapExpression(facade, USE_FACTORY),
                useValue: convertToProviderExpression(facade, USE_VALUE),
                useExisting: convertToProviderExpression(facade, USE_EXISTING),
                deps: (_a = facade.deps) === null || _a === void 0 ? void 0 : _a.map(convertR3DependencyMetadata),
            }, 
            /* resolveForwardRefs */ true), expression = _b.expression, statements = _b.statements;
            return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
        };
        CompilerFacadeImpl.prototype.compileInjectableDeclaration = function (angularCoreEnv, sourceMapUrl, facade) {
            var _a;
            var _b = (0, injectable_compiler_2_1.compileInjectable)({
                name: facade.type.name,
                type: (0, util_1.wrapReference)(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                typeArgumentCount: 0,
                providedIn: computeProvidedIn(facade.providedIn),
                useClass: convertToProviderExpression(facade, USE_CLASS),
                useFactory: wrapExpression(facade, USE_FACTORY),
                useValue: convertToProviderExpression(facade, USE_VALUE),
                useExisting: convertToProviderExpression(facade, USE_EXISTING),
                deps: (_a = facade.deps) === null || _a === void 0 ? void 0 : _a.map(convertR3DeclareDependencyMetadata),
            }, 
            /* resolveForwardRefs */ true), expression = _b.expression, statements = _b.statements;
            return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
        };
        CompilerFacadeImpl.prototype.compileInjector = function (angularCoreEnv, sourceMapUrl, facade) {
            var meta = {
                name: facade.name,
                type: (0, util_1.wrapReference)(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                providers: new output_ast_1.WrappedNodeExpr(facade.providers),
                imports: facade.imports.map(function (i) { return new output_ast_1.WrappedNodeExpr(i); }),
            };
            var res = (0, r3_injector_compiler_1.compileInjector)(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileInjectorDeclaration = function (angularCoreEnv, sourceMapUrl, declaration) {
            var meta = convertDeclareInjectorFacadeToMetadata(declaration);
            var res = (0, r3_injector_compiler_1.compileInjector)(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileNgModule = function (angularCoreEnv, sourceMapUrl, facade) {
            var meta = {
                type: (0, util_1.wrapReference)(facade.type),
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
            var res = (0, r3_module_compiler_1.compileNgModule)(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileNgModuleDeclaration = function (angularCoreEnv, sourceMapUrl, declaration) {
            var expression = (0, r3_module_compiler_1.compileNgModuleDeclarationExpression)(declaration);
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
            var bindingParser = (0, template_1.makeBindingParser)();
            var res = (0, compiler_1.compileDirectiveFromMetadata)(meta, constantPool, bindingParser);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
        };
        CompilerFacadeImpl.prototype.compileComponent = function (angularCoreEnv, sourceMapUrl, facade) {
            // Parse the template and check for errors.
            var _a = parseJitTemplate(facade.template, facade.name, sourceMapUrl, facade.preserveWhitespaces, facade.interpolation), template = _a.template, interpolation = _a.interpolation;
            // Compile the component metadata, including template, into an expression.
            var meta = (0, tslib_1.__assign)((0, tslib_1.__assign)((0, tslib_1.__assign)({}, facade), convertDirectiveFacadeToMetadata(facade)), { selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(), template: template, declarationListEmitMode: 0 /* Direct */, styles: (0, tslib_1.__spreadArray)((0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(facade.styles), false), (0, tslib_1.__read)(template.styles), false), encapsulation: facade.encapsulation, interpolation: interpolation, changeDetection: facade.changeDetection, animations: facade.animations != null ? new output_ast_1.WrappedNodeExpr(facade.animations) : null, viewProviders: facade.viewProviders != null ? new output_ast_1.WrappedNodeExpr(facade.viewProviders) :
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
            var bindingParser = (0, template_1.makeBindingParser)(meta.interpolation);
            var res = (0, compiler_1.compileComponentFromMetadata)(meta, constantPool, bindingParser);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
        };
        CompilerFacadeImpl.prototype.compileFactory = function (angularCoreEnv, sourceMapUrl, meta) {
            var factoryRes = (0, r3_factory_1.compileFactoryFunction)({
                name: meta.name,
                type: (0, util_1.wrapReference)(meta.type),
                internalType: new output_ast_1.WrappedNodeExpr(meta.type),
                typeArgumentCount: meta.typeArgumentCount,
                deps: convertR3DependencyMetadataArray(meta.deps),
                target: meta.target,
            });
            return this.jitExpression(factoryRes.expression, angularCoreEnv, sourceMapUrl, factoryRes.statements);
        };
        CompilerFacadeImpl.prototype.compileFactoryDeclaration = function (angularCoreEnv, sourceMapUrl, meta) {
            var factoryRes = (0, r3_factory_1.compileFactoryFunction)({
                name: meta.type.name,
                type: (0, util_1.wrapReference)(meta.type),
                internalType: new output_ast_1.WrappedNodeExpr(meta.type),
                typeArgumentCount: 0,
                deps: meta.deps && meta.deps.map(convertR3DeclareDependencyMetadata),
                target: meta.target,
            });
            return this.jitExpression(factoryRes.expression, angularCoreEnv, sourceMapUrl, factoryRes.statements);
        };
        CompilerFacadeImpl.prototype.createParseSourceSpan = function (kind, typeName, sourceUrl) {
            return (0, parse_util_1.r3JitTypeSourceSpan)(kind, typeName, sourceUrl);
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
            var statements = (0, tslib_1.__spreadArray)((0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(preStatements), false), [
                new output_ast_1.DeclareVarStmt('$def', def, undefined, [output_ast_1.StmtModifier.Exported]),
            ], false);
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
        return (0, tslib_1.__assign)((0, tslib_1.__assign)({}, facade), { predicate: Array.isArray(facade.predicate) ? facade.predicate :
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
        return (0, tslib_1.__assign)((0, tslib_1.__assign)({}, facade), { typeArgumentCount: 0, typeSourceSpan: facade.typeSourceSpan, type: (0, util_1.wrapReference)(facade.type), internalType: new output_ast_1.WrappedNodeExpr(facade.type), deps: null, host: extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host), inputs: (0, tslib_1.__assign)((0, tslib_1.__assign)({}, inputsFromMetadata), inputsFromType), outputs: (0, tslib_1.__assign)((0, tslib_1.__assign)({}, outputsFromMetadata), outputsFromType), queries: facade.queries.map(convertToR3QueryMetadata), providers: facade.providers != null ? new output_ast_1.WrappedNodeExpr(facade.providers) : null, viewQueries: facade.viewQueries.map(convertToR3QueryMetadata), fullInheritance: false });
    }
    function convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return {
            name: declaration.type.name,
            type: (0, util_1.wrapReference)(declaration.type),
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
            for (var _b = (0, tslib_1.__values)(Object.keys(obj)), _c = _b.next(); !_c.done; _c = _b.next()) {
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
        return (0, tslib_1.__assign)((0, tslib_1.__assign)({}, convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan)), { template: template, styles: (_b = declaration.styles) !== null && _b !== void 0 ? _b : [], directives: ((_c = declaration.components) !== null && _c !== void 0 ? _c : [])
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
            for (var _b = (0, tslib_1.__values)(Object.keys(declaredPipes)), _c = _b.next(); !_c.done; _c = _b.next()) {
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
        var parsed = (0, template_1.parseTemplate)(template, sourceMapUrl, { preserveWhitespaces: preserveWhitespaces, interpolationConfig: interpolationConfig });
        if (parsed.errors !== null) {
            var errors = parsed.errors.map(function (err) { return err.toString(); }).join(', ');
            throw new Error("Errors during JIT compilation of template for " + typeName + ": " + errors);
        }
        return { template: parsed, interpolation: interpolationConfig };
    }
    /**
     * Convert the expression, if present to an `R3ProviderExpression`.
     *
     * In JIT mode we do not want the compiler to wrap the expression in a `forwardRef()` call because,
     * if it is referencing a type that has not yet been defined, it will have already been wrapped in
     * a `forwardRef()` - either by the application developer or during partial-compilation. Thus we can
     * set `isForwardRef` to `false`.
     */
    function convertToProviderExpression(obj, property) {
        if (obj.hasOwnProperty(property)) {
            return (0, injectable_compiler_2_1.createR3ProviderExpression)(new output_ast_1.WrappedNodeExpr(obj[property]), /* isForwardRef */ false);
        }
        else {
            return undefined;
        }
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
        var expression = (providedIn == null || typeof providedIn === 'string') ?
            new output_ast_1.LiteralExpr(providedIn !== null && providedIn !== void 0 ? providedIn : null) :
            new output_ast_1.WrappedNodeExpr(providedIn);
        // See `convertToProviderExpression()` for why `isForwardRef` is false.
        return (0, injectable_compiler_2_1.createR3ProviderExpression)(expression, /* isForwardRef */ false);
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
        var attributeNameType = isAttributeDep ? (0, output_ast_1.literal)('unknown') : null;
        return { token: token, attributeNameType: attributeNameType, host: host, optional: optional, self: self, skipSelf: skipSelf };
    }
    function extractHostBindings(propMetadata, sourceSpan, host) {
        // First parse the declarations from the metadata.
        var bindings = (0, compiler_1.parseHostBindings)(host || {});
        // After that check host bindings for errors
        var errors = (0, compiler_1.verifyHostBindings)(bindings, sourceSpan);
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
                            (0, util_1.getSafePropertyAccessString)('this', field);
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
            var _a = (0, tslib_1.__read)(value.split(',').map(function (piece) { return piece.trim(); }), 2), field = _a[0], property = _a[1];
            map[field] = property || field;
            return map;
        }, {});
    }
    function convertDeclarePipeFacadeToMetadata(declaration) {
        var _a;
        return {
            name: declaration.type.name,
            type: (0, util_1.wrapReference)(declaration.type),
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
            type: (0, util_1.wrapReference)(declaration.type),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFJSCxxRUFBNkM7SUFDN0MsbURBQTRHO0lBQzVHLHFGQUE0RztJQUM1Ryw2RkFBbUc7SUFDbkcsc0VBQStIO0lBQy9ILHNFQUFpRDtJQUNqRCwrREFBOEU7SUFDOUUsdUVBQWlHO0lBQ2pHLDJGQUFtRjtJQUNuRiwrREFBZ0Q7SUFDaEQsdUZBQXVIO0lBQ3ZILG1GQUFtRjtJQUNuRiwyREFBMEU7SUFFMUUsd0VBQThKO0lBQzlKLHdFQUF5RTtJQUN6RSx5RUFBaUQ7SUFDakQsd0dBQThFO0lBRTlFO1FBS0UsNEJBQW9CLFlBQWlDO1lBQWpDLDZCQUFBLEVBQUEsbUJBQW1CLHlCQUFZLEVBQUU7WUFBakMsaUJBQVksR0FBWixZQUFZLENBQXFCO1lBSnJELGtCQUFhLEdBQUcsMEJBQW9CLENBQUM7WUFDckMsbUJBQWMsR0FBRyxnQ0FBYyxDQUFDO1lBQ3hCLDBCQUFxQixHQUFHLElBQUksc0RBQXdCLEVBQUUsQ0FBQztRQUVQLENBQUM7UUFFekQsd0NBQVcsR0FBWCxVQUFZLGNBQStCLEVBQUUsWUFBb0IsRUFBRSxNQUE0QjtZQUU3RixJQUFNLFFBQVEsR0FBbUI7Z0JBQy9CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtnQkFDakIsSUFBSSxFQUFFLElBQUEsb0JBQWEsRUFBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNoQyxZQUFZLEVBQUUsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7Z0JBQzlDLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLElBQUksRUFBRSxJQUFJO2dCQUNWLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtnQkFDekIsSUFB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QixFQUFFLENBQUM7WUFDcEIsUUFBUSxFQUFFLFdBQVcsQ0FBQyxJQUFJO1lBQzFCLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLE1BQUEsV0FBVyxDQUFDLElBQUksbUNBQUksSUFBSTtTQUMvQixDQUFDO0lBQ0osQ0FBQztJQUVELFNBQVMsc0NBQXNDLENBQUMsV0FBb0M7UUFFbEYsT0FBTztZQUNMLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUk7WUFDM0IsSUFBSSxFQUFFLElBQUEsb0JBQWEsRUFBQyxXQUFXLENBQUMsSUFBSSxDQUFDO1lBQ3JDLFlBQVksRUFBRSxJQUFJLDRCQUFlLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztZQUNuRCxTQUFTLEVBQUUsV0FBVyxDQUFDLFNBQVMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksNEJBQWUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDNUMsSUFBSTtZQUNyRCxPQUFPLEVBQUUsV0FBVyxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQztnQkFDeEMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxJQUFJLDRCQUFlLENBQUMsQ0FBQyxDQUFDLEVBQXRCLENBQXNCLENBQUMsQ0FBQyxDQUFDO2dCQUN0RCxFQUFFO1NBQ1AsQ0FBQztJQUNKLENBQUM7SUFFRCxTQUFnQixhQUFhLENBQUMsTUFBVztRQUN2QyxJQUFNLEVBQUUsR0FBMkIsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDakUsRUFBRSxDQUFDLGVBQWUsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7SUFDaEQsQ0FBQztJQUhELHNDQUdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtDb21waWxlckZhY2FkZSwgQ29yZUVudmlyb25tZW50LCBFeHBvcnRlZENvbXBpbGVyRmFjYWRlLCBPcGFxdWVWYWx1ZSwgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlLCBSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUsIFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSwgUjNEZWNsYXJlRmFjdG9yeUZhY2FkZSwgUjNEZWNsYXJlSW5qZWN0YWJsZUZhY2FkZSwgUjNEZWNsYXJlSW5qZWN0b3JGYWNhZGUsIFIzRGVjbGFyZU5nTW9kdWxlRmFjYWRlLCBSM0RlY2xhcmVQaXBlRmFjYWRlLCBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhRmFjYWRlLCBSM0RlY2xhcmVVc2VkRGlyZWN0aXZlRmFjYWRlLCBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSwgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUsIFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlLCBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUsIFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSwgUjNQaXBlTWV0YWRhdGFGYWNhZGUsIFIzUXVlcnlNZXRhZGF0YUZhY2FkZSwgU3RyaW5nTWFwLCBTdHJpbmdNYXBXaXRoUmVuYW1lfSBmcm9tICcuL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UnO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0NoYW5nZURldGVjdGlvblN0cmF0ZWd5LCBIb3N0QmluZGluZywgSG9zdExpc3RlbmVyLCBJbnB1dCwgT3V0cHV0LCBWaWV3RW5jYXBzdWxhdGlvbn0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7Y29tcGlsZUluamVjdGFibGUsIGNyZWF0ZVIzUHJvdmlkZXJFeHByZXNzaW9uLCBSM1Byb3ZpZGVyRXhwcmVzc2lvbn0gZnJvbSAnLi9pbmplY3RhYmxlX2NvbXBpbGVyXzInO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge0RlY2xhcmVWYXJTdG10LCBFeHByZXNzaW9uLCBsaXRlcmFsLCBMaXRlcmFsRXhwciwgU3RhdGVtZW50LCBTdG10TW9kaWZpZXIsIFdyYXBwZWROb2RlRXhwcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0ppdEV2YWx1YXRvcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2ppdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3BhbiwgcjNKaXRUeXBlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgRmFjdG9yeVRhcmdldCwgUjNEZXBlbmRlbmN5TWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmltcG9ydCB7Y29tcGlsZUluamVjdG9yLCBSM0luamVjdG9yTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19pbmplY3Rvcl9jb21waWxlcic7XG5pbXBvcnQge1IzSml0UmVmbGVjdG9yfSBmcm9tICcuL3JlbmRlcjMvcjNfaml0JztcbmltcG9ydCB7Y29tcGlsZU5nTW9kdWxlLCBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbkV4cHJlc3Npb24sIFIzTmdNb2R1bGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhLCBSM1BpcGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXInO1xuaW1wb3J0IHtnZXRTYWZlUHJvcGVydHlBY2Nlc3NTdHJpbmcsIHdyYXBSZWZlcmVuY2V9IGZyb20gJy4vcmVuZGVyMy91dGlsJztcbmltcG9ydCB7RGVjbGFyYXRpb25MaXN0RW1pdE1vZGUsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGEsIFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvdmlldy9hcGknO1xuaW1wb3J0IHtjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhLCBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBQYXJzZWRIb3N0QmluZGluZ3MsIHBhcnNlSG9zdEJpbmRpbmdzLCB2ZXJpZnlIb3N0QmluZGluZ3N9IGZyb20gJy4vcmVuZGVyMy92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7bWFrZUJpbmRpbmdQYXJzZXIsIHBhcnNlVGVtcGxhdGV9IGZyb20gJy4vcmVuZGVyMy92aWV3L3RlbXBsYXRlJztcbmltcG9ydCB7UmVzb3VyY2VMb2FkZXJ9IGZyb20gJy4vcmVzb3VyY2VfbG9hZGVyJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuXG5leHBvcnQgY2xhc3MgQ29tcGlsZXJGYWNhZGVJbXBsIGltcGxlbWVudHMgQ29tcGlsZXJGYWNhZGUge1xuICBGYWN0b3J5VGFyZ2V0ID0gRmFjdG9yeVRhcmdldCBhcyBhbnk7XG4gIFJlc291cmNlTG9hZGVyID0gUmVzb3VyY2VMb2FkZXI7XG4gIHByaXZhdGUgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgaml0RXZhbHVhdG9yID0gbmV3IEppdEV2YWx1YXRvcigpKSB7fVxuXG4gIGNvbXBpbGVQaXBlKGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBmYWNhZGU6IFIzUGlwZU1ldGFkYXRhRmFjYWRlKTpcbiAgICAgIGFueSB7XG4gICAgY29uc3QgbWV0YWRhdGE6IFIzUGlwZU1ldGFkYXRhID0ge1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICAgIGRlcHM6IG51bGwsXG4gICAgICBwaXBlTmFtZTogZmFjYWRlLnBpcGVOYW1lLFxuICAgICAgcHVyZTogZmFjYWRlLnB1cmUsXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlUGlwZUZyb21NZXRhZGF0YShtZXRhZGF0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZVBpcGVEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZVBpcGVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGEgPSBjb252ZXJ0RGVjbGFyZVBpcGVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlUGlwZUZyb21NZXRhZGF0YShtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3Qge2V4cHJlc3Npb24sIHN0YXRlbWVudHN9ID0gY29tcGlsZUluamVjdGFibGUoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgICAgIHR5cGVBcmd1bWVudENvdW50OiBmYWNhZGUudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICAgICAgcHJvdmlkZWRJbjogY29tcHV0ZVByb3ZpZGVkSW4oZmFjYWRlLnByb3ZpZGVkSW4pLFxuICAgICAgICAgIHVzZUNsYXNzOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCBVU0VfQ0xBU1MpLFxuICAgICAgICAgIHVzZUZhY3Rvcnk6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgVVNFX0ZBQ1RPUlkpLFxuICAgICAgICAgIHVzZVZhbHVlOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCBVU0VfVkFMVUUpLFxuICAgICAgICAgIHVzZUV4aXN0aW5nOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRVhJU1RJTkcpLFxuICAgICAgICAgIGRlcHM6IGZhY2FkZS5kZXBzPy5tYXAoY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhKSxcbiAgICAgICAgfSxcbiAgICAgICAgLyogcmVzb2x2ZUZvcndhcmRSZWZzICovIHRydWUpO1xuXG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihleHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBzdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RhYmxlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNEZWNsYXJlSW5qZWN0YWJsZUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3Qge2V4cHJlc3Npb24sIHN0YXRlbWVudHN9ID0gY29tcGlsZUluamVjdGFibGUoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBmYWNhZGUudHlwZS5uYW1lLFxuICAgICAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgICAgICAgcHJvdmlkZWRJbjogY29tcHV0ZVByb3ZpZGVkSW4oZmFjYWRlLnByb3ZpZGVkSW4pLFxuICAgICAgICAgIHVzZUNsYXNzOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCBVU0VfQ0xBU1MpLFxuICAgICAgICAgIHVzZUZhY3Rvcnk6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgVVNFX0ZBQ1RPUlkpLFxuICAgICAgICAgIHVzZVZhbHVlOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCBVU0VfVkFMVUUpLFxuICAgICAgICAgIHVzZUV4aXN0aW5nOiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRVhJU1RJTkcpLFxuICAgICAgICAgIGRlcHM6IGZhY2FkZS5kZXBzPy5tYXAoY29udmVydFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YSksXG4gICAgICAgIH0sXG4gICAgICAgIC8qIHJlc29sdmVGb3J3YXJkUmVmcyAqLyB0cnVlKTtcblxuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0b3IoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEgPSB7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIHByb3ZpZGVyczogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJvdmlkZXJzKSxcbiAgICAgIGltcG9ydHM6IGZhY2FkZS5pbXBvcnRzLm1hcChpID0+IG5ldyBXcmFwcGVkTm9kZUV4cHIoaSkpLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUluamVjdG9yKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RvckRlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlSW5qZWN0b3JGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGEgPSBjb252ZXJ0RGVjbGFyZUluamVjdG9yRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbik7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUluamVjdG9yKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVOZ01vZHVsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSA9IHtcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGFkamFjZW50VHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBib290c3RyYXA6IGZhY2FkZS5ib290c3RyYXAubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZGVjbGFyYXRpb25zOiBmYWNhZGUuZGVjbGFyYXRpb25zLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGltcG9ydHM6IGZhY2FkZS5pbXBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGV4cG9ydHM6IGZhY2FkZS5leHBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGVtaXRJbmxpbmU6IHRydWUsXG4gICAgICBjb250YWluc0ZvcndhcmREZWNsczogZmFsc2UsXG4gICAgICBzY2hlbWFzOiBmYWNhZGUuc2NoZW1hcyA/IGZhY2FkZS5zY2hlbWFzLm1hcCh3cmFwUmVmZXJlbmNlKSA6IG51bGwsXG4gICAgICBpZDogZmFjYWRlLmlkID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuaWQpIDogbnVsbCxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVOZ01vZHVsZShtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlTmdNb2R1bGVEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZU5nTW9kdWxlRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gY29tcGlsZU5nTW9kdWxlRGVjbGFyYXRpb25FeHByZXNzaW9uKGRlY2xhcmF0aW9uKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKGV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVEaXJlY3RpdmUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSA9IGNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZSk7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIG1ldGEpO1xuICB9XG5cbiAgY29tcGlsZURpcmVjdGl2ZURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB0eXBlU291cmNlU3BhbiA9XG4gICAgICAgIHRoaXMuY3JlYXRlUGFyc2VTb3VyY2VTcGFuKCdEaXJlY3RpdmUnLCBkZWNsYXJhdGlvbi50eXBlLm5hbWUsIHNvdXJjZU1hcFVybCk7XG4gICAgY29uc3QgbWV0YSA9IGNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbiwgdHlwZVNvdXJjZVNwYW4pO1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YShhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBtZXRhKTtcbiAgfVxuXG4gIHByaXZhdGUgY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBhbnkge1xuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcbiAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihcbiAgICAgICAgcmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVDb21wb25lbnQoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgLy8gUGFyc2UgdGhlIHRlbXBsYXRlIGFuZCBjaGVjayBmb3IgZXJyb3JzLlxuICAgIGNvbnN0IHt0ZW1wbGF0ZSwgaW50ZXJwb2xhdGlvbn0gPSBwYXJzZUppdFRlbXBsYXRlKFxuICAgICAgICBmYWNhZGUudGVtcGxhdGUsIGZhY2FkZS5uYW1lLCBzb3VyY2VNYXBVcmwsIGZhY2FkZS5wcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgICBmYWNhZGUuaW50ZXJwb2xhdGlvbik7XG5cbiAgICAvLyBDb21waWxlIHRoZSBjb21wb25lbnQgbWV0YWRhdGEsIGluY2x1ZGluZyB0ZW1wbGF0ZSwgaW50byBhbiBleHByZXNzaW9uLlxuICAgIGNvbnN0IG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEgPSB7XG4gICAgICAuLi5mYWNhZGUgYXMgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZU5vUHJvcEFuZFdoaXRlc3BhY2UsXG4gICAgICAuLi5jb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGUpLFxuICAgICAgc2VsZWN0b3I6IGZhY2FkZS5zZWxlY3RvciB8fCB0aGlzLmVsZW1lbnRTY2hlbWFSZWdpc3RyeS5nZXREZWZhdWx0Q29tcG9uZW50RWxlbWVudE5hbWUoKSxcbiAgICAgIHRlbXBsYXRlLFxuICAgICAgZGVjbGFyYXRpb25MaXN0RW1pdE1vZGU6IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkRpcmVjdCxcbiAgICAgIHN0eWxlczogWy4uLmZhY2FkZS5zdHlsZXMsIC4uLnRlbXBsYXRlLnN0eWxlc10sXG4gICAgICBlbmNhcHN1bGF0aW9uOiBmYWNhZGUuZW5jYXBzdWxhdGlvbiBhcyBhbnksXG4gICAgICBpbnRlcnBvbGF0aW9uLFxuICAgICAgY2hhbmdlRGV0ZWN0aW9uOiBmYWNhZGUuY2hhbmdlRGV0ZWN0aW9uLFxuICAgICAgYW5pbWF0aW9uczogZmFjYWRlLmFuaW1hdGlvbnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmFuaW1hdGlvbnMpIDogbnVsbCxcbiAgICAgIHZpZXdQcm92aWRlcnM6IGZhY2FkZS52aWV3UHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS52aWV3UHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgICB9O1xuICAgIGNvbnN0IGppdEV4cHJlc3Npb25Tb3VyY2VNYXAgPSBgbmc6Ly8vJHtmYWNhZGUubmFtZX0uanNgO1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVDb21wb25lbnRGcm9tTWV0YShhbmd1bGFyQ29yZUVudiwgaml0RXhwcmVzc2lvblNvdXJjZU1hcCwgbWV0YSk7XG4gIH1cblxuICBjb21waWxlQ29tcG9uZW50RGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHR5cGVTb3VyY2VTcGFuID1cbiAgICAgICAgdGhpcy5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0NvbXBvbmVudCcsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsKTtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVDb21wb25lbnRGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3Bhbiwgc291cmNlTWFwVXJsKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlQ29tcG9uZW50RnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBwcml2YXRlIGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhKTogYW55IHtcbiAgICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKCk7XG4gICAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKG1ldGEuaW50ZXJwb2xhdGlvbik7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBjb25zdGFudFBvb2wuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlRmFjdG9yeShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0ZhY3RvcnlEZWZNZXRhZGF0YUZhY2FkZSkge1xuICAgIGNvbnN0IGZhY3RvcnlSZXMgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UobWV0YS50eXBlKSxcbiAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihtZXRhLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IG1ldGEudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICBkZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShtZXRhLmRlcHMpLFxuICAgICAgdGFyZ2V0OiBtZXRhLnRhcmdldCxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICBmYWN0b3J5UmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIGZhY3RvcnlSZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlRmFjdG9yeURlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRGVjbGFyZUZhY3RvcnlGYWNhZGUpIHtcbiAgICBjb25zdCBmYWN0b3J5UmVzID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICBuYW1lOiBtZXRhLnR5cGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UobWV0YS50eXBlKSxcbiAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihtZXRhLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgICBkZXBzOiBtZXRhLmRlcHMgJiYgbWV0YS5kZXBzLm1hcChjb252ZXJ0UjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhKSxcbiAgICAgIHRhcmdldDogbWV0YS50YXJnZXQsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihcbiAgICAgICAgZmFjdG9yeVJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBmYWN0b3J5UmVzLnN0YXRlbWVudHMpO1xuICB9XG5cblxuICBjcmVhdGVQYXJzZVNvdXJjZVNwYW4oa2luZDogc3RyaW5nLCB0eXBlTmFtZTogc3RyaW5nLCBzb3VyY2VVcmw6IHN0cmluZyk6IFBhcnNlU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIHIzSml0VHlwZVNvdXJjZVNwYW4oa2luZCwgdHlwZU5hbWUsIHNvdXJjZVVybCk7XG4gIH1cblxuICAvKipcbiAgICogSklUIGNvbXBpbGVzIGFuIGV4cHJlc3Npb24gYW5kIHJldHVybnMgdGhlIHJlc3VsdCBvZiBleGVjdXRpbmcgdGhhdCBleHByZXNzaW9uLlxuICAgKlxuICAgKiBAcGFyYW0gZGVmIHRoZSBkZWZpbml0aW9uIHdoaWNoIHdpbGwgYmUgY29tcGlsZWQgYW5kIGV4ZWN1dGVkIHRvIGdldCB0aGUgdmFsdWUgdG8gcGF0Y2hcbiAgICogQHBhcmFtIGNvbnRleHQgYW4gb2JqZWN0IG1hcCBvZiBAYW5ndWxhci9jb3JlIHN5bWJvbCBuYW1lcyB0byBzeW1ib2xzIHdoaWNoIHdpbGwgYmUgYXZhaWxhYmxlXG4gICAqIGluIHRoZSBjb250ZXh0IG9mIHRoZSBjb21waWxlZCBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBzb3VyY2VVcmwgYSBVUkwgdG8gdXNlIGZvciB0aGUgc291cmNlIG1hcCBvZiB0aGUgY29tcGlsZWQgZXhwcmVzc2lvblxuICAgKiBAcGFyYW0gcHJlU3RhdGVtZW50cyBhIGNvbGxlY3Rpb24gb2Ygc3RhdGVtZW50cyB0aGF0IHNob3VsZCBiZSBldmFsdWF0ZWQgYmVmb3JlIHRoZSBleHByZXNzaW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBqaXRFeHByZXNzaW9uKFxuICAgICAgZGVmOiBFeHByZXNzaW9uLCBjb250ZXh0OiB7W2tleTogc3RyaW5nXTogYW55fSwgc291cmNlVXJsOiBzdHJpbmcsXG4gICAgICBwcmVTdGF0ZW1lbnRzOiBTdGF0ZW1lbnRbXSk6IGFueSB7XG4gICAgLy8gVGhlIENvbnN0YW50UG9vbCBtYXkgY29udGFpbiBTdGF0ZW1lbnRzIHdoaWNoIGRlY2xhcmUgdmFyaWFibGVzIHVzZWQgaW4gdGhlIGZpbmFsIGV4cHJlc3Npb24uXG4gICAgLy8gVGhlcmVmb3JlLCBpdHMgc3RhdGVtZW50cyBuZWVkIHRvIHByZWNlZGUgdGhlIGFjdHVhbCBKSVQgb3BlcmF0aW9uLiBUaGUgZmluYWwgc3RhdGVtZW50IGlzIGFcbiAgICAvLyBkZWNsYXJhdGlvbiBvZiAkZGVmIHdoaWNoIGlzIHNldCB0byB0aGUgZXhwcmVzc2lvbiBiZWluZyBjb21waWxlZC5cbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBTdGF0ZW1lbnRbXSA9IFtcbiAgICAgIC4uLnByZVN0YXRlbWVudHMsXG4gICAgICBuZXcgRGVjbGFyZVZhclN0bXQoJyRkZWYnLCBkZWYsIHVuZGVmaW5lZCwgW1N0bXRNb2RpZmllci5FeHBvcnRlZF0pLFxuICAgIF07XG5cbiAgICBjb25zdCByZXMgPSB0aGlzLmppdEV2YWx1YXRvci5ldmFsdWF0ZVN0YXRlbWVudHMoXG4gICAgICAgIHNvdXJjZVVybCwgc3RhdGVtZW50cywgbmV3IFIzSml0UmVmbGVjdG9yKGNvbnRleHQpLCAvKiBlbmFibGVTb3VyY2VNYXBzICovIHRydWUpO1xuICAgIHJldHVybiByZXNbJyRkZWYnXTtcbiAgfVxufVxuXG4vLyBUaGlzIHNlZW1zIHRvIGJlIG5lZWRlZCB0byBwbGFjYXRlIFRTIHYzLjAgb25seVxudHlwZSBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSA9IFBpY2s8XG4gICAgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSxcbiAgICBFeGNsdWRlPEV4Y2x1ZGU8a2V5b2YgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnPiwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuY29uc3QgVVNFX0NMQVNTID0gT2JqZWN0LmtleXMoe3VzZUNsYXNzOiBudWxsfSlbMF07XG5jb25zdCBVU0VfRkFDVE9SWSA9IE9iamVjdC5rZXlzKHt1c2VGYWN0b3J5OiBudWxsfSlbMF07XG5jb25zdCBVU0VfVkFMVUUgPSBPYmplY3Qua2V5cyh7dXNlVmFsdWU6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9FWElTVElORyA9IE9iamVjdC5rZXlzKHt1c2VFeGlzdGluZzogbnVsbH0pWzBdO1xuXG5mdW5jdGlvbiBjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEoZmFjYWRlOiBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUpOiBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSxcbiAgICBwcmVkaWNhdGU6IEFycmF5LmlzQXJyYXkoZmFjYWRlLnByZWRpY2F0ZSkgPyBmYWNhZGUucHJlZGljYXRlIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcmVkaWNhdGUpLFxuICAgIHJlYWQ6IGZhY2FkZS5yZWFkID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucmVhZCkgOiBudWxsLFxuICAgIHN0YXRpYzogZmFjYWRlLnN0YXRpYyxcbiAgICBlbWl0RGlzdGluY3RDaGFuZ2VzT25seTogZmFjYWRlLmVtaXREaXN0aW5jdENoYW5nZXNPbmx5LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb246IFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFGYWNhZGUpOlxuICAgIFIzUXVlcnlNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgcHJvcGVydHlOYW1lOiBkZWNsYXJhdGlvbi5wcm9wZXJ0eU5hbWUsXG4gICAgZmlyc3Q6IGRlY2xhcmF0aW9uLmZpcnN0ID8/IGZhbHNlLFxuICAgIHByZWRpY2F0ZTogQXJyYXkuaXNBcnJheShkZWNsYXJhdGlvbi5wcmVkaWNhdGUpID8gZGVjbGFyYXRpb24ucHJlZGljYXRlIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24ucHJlZGljYXRlKSxcbiAgICBkZXNjZW5kYW50czogZGVjbGFyYXRpb24uZGVzY2VuZGFudHMgPz8gZmFsc2UsXG4gICAgcmVhZDogZGVjbGFyYXRpb24ucmVhZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24ucmVhZCkgOiBudWxsLFxuICAgIHN0YXRpYzogZGVjbGFyYXRpb24uc3RhdGljID8/IGZhbHNlLFxuICAgIGVtaXREaXN0aW5jdENoYW5nZXNPbmx5OiBkZWNsYXJhdGlvbi5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSA/PyB0cnVlLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgY29uc3QgaW5wdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dE91dHB1dHMoZmFjYWRlLmlucHV0cyB8fCBbXSk7XG4gIGNvbnN0IG91dHB1dHNGcm9tTWV0YWRhdGEgPSBwYXJzZUlucHV0T3V0cHV0cyhmYWNhZGUub3V0cHV0cyB8fCBbXSk7XG4gIGNvbnN0IHByb3BNZXRhZGF0YSA9IGZhY2FkZS5wcm9wTWV0YWRhdGE7XG4gIGNvbnN0IGlucHV0c0Zyb21UeXBlOiBTdHJpbmdNYXBXaXRoUmVuYW1lID0ge307XG4gIGNvbnN0IG91dHB1dHNGcm9tVHlwZTogU3RyaW5nTWFwID0ge307XG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNJbnB1dChhbm4pKSB7XG4gICAgICAgICAgaW5wdXRzRnJvbVR5cGVbZmllbGRdID1cbiAgICAgICAgICAgICAgYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUgPyBbYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUsIGZpZWxkXSA6IGZpZWxkO1xuICAgICAgICB9IGVsc2UgaWYgKGlzT3V0cHV0KGFubikpIHtcbiAgICAgICAgICBvdXRwdXRzRnJvbVR5cGVbZmllbGRdID0gYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUgfHwgZmllbGQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgLi4uZmFjYWRlIGFzIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgIHR5cGVTb3VyY2VTcGFuOiBmYWNhZGUudHlwZVNvdXJjZVNwYW4sXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICBkZXBzOiBudWxsLFxuICAgIGhvc3Q6IGV4dHJhY3RIb3N0QmluZGluZ3MoZmFjYWRlLnByb3BNZXRhZGF0YSwgZmFjYWRlLnR5cGVTb3VyY2VTcGFuLCBmYWNhZGUuaG9zdCksXG4gICAgaW5wdXRzOiB7Li4uaW5wdXRzRnJvbU1ldGFkYXRhLCAuLi5pbnB1dHNGcm9tVHlwZX0sXG4gICAgb3V0cHV0czogey4uLm91dHB1dHNGcm9tTWV0YWRhdGEsIC4uLm91dHB1dHNGcm9tVHlwZX0sXG4gICAgcXVlcmllczogZmFjYWRlLnF1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBmYWNhZGUucHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpIDogbnVsbCxcbiAgICB2aWV3UXVlcmllczogZmFjYWRlLnZpZXdRdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIGZ1bGxJbmhlcml0YW5jZTogZmFsc2UsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShcbiAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogZGVjbGFyYXRpb24udHlwZS5uYW1lLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZGVjbGFyYXRpb24udHlwZSksXG4gICAgdHlwZVNvdXJjZVNwYW4sXG4gICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIHNlbGVjdG9yOiBkZWNsYXJhdGlvbi5zZWxlY3RvciA/PyBudWxsLFxuICAgIGlucHV0czogZGVjbGFyYXRpb24uaW5wdXRzID8/IHt9LFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8ge30sXG4gICAgaG9zdDogY29udmVydEhvc3REZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb24uaG9zdCksXG4gICAgcXVlcmllczogKGRlY2xhcmF0aW9uLnF1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHZpZXdRdWVyaWVzOiAoZGVjbGFyYXRpb24udmlld1F1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHByb3ZpZGVyczogZGVjbGFyYXRpb24ucHJvdmlkZXJzICE9PSB1bmRlZmluZWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgIGV4cG9ydEFzOiBkZWNsYXJhdGlvbi5leHBvcnRBcyA/PyBudWxsLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZGVjbGFyYXRpb24udXNlc0luaGVyaXRhbmNlID8/IGZhbHNlLFxuICAgIGxpZmVjeWNsZToge3VzZXNPbkNoYW5nZXM6IGRlY2xhcmF0aW9uLnVzZXNPbkNoYW5nZXMgPz8gZmFsc2V9LFxuICAgIGRlcHM6IG51bGwsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgZnVsbEluaGVyaXRhbmNlOiBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydEhvc3REZWNsYXJhdGlvblRvTWV0YWRhdGEoaG9zdDogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlWydob3N0J10gPSB7fSk6XG4gICAgUjNIb3N0TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIGF0dHJpYnV0ZXM6IGNvbnZlcnRPcGFxdWVWYWx1ZXNUb0V4cHJlc3Npb25zKGhvc3QuYXR0cmlidXRlcyA/PyB7fSksXG4gICAgbGlzdGVuZXJzOiBob3N0Lmxpc3RlbmVycyA/PyB7fSxcbiAgICBwcm9wZXJ0aWVzOiBob3N0LnByb3BlcnRpZXMgPz8ge30sXG4gICAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtcbiAgICAgIGNsYXNzQXR0cjogaG9zdC5jbGFzc0F0dHJpYnV0ZSxcbiAgICAgIHN0eWxlQXR0cjogaG9zdC5zdHlsZUF0dHJpYnV0ZSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0T3BhcXVlVmFsdWVzVG9FeHByZXNzaW9ucyhvYmo6IHtba2V5OiBzdHJpbmddOiBPcGFxdWVWYWx1ZX0pOlxuICAgIHtba2V5OiBzdHJpbmddOiBXcmFwcGVkTm9kZUV4cHI8dW5rbm93bj59IHtcbiAgY29uc3QgcmVzdWx0OiB7W2tleTogc3RyaW5nXTogV3JhcHBlZE5vZGVFeHByPHVua25vd24+fSA9IHt9O1xuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XG4gICAgcmVzdWx0W2tleV0gPSBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtrZXldKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGVjbGFyZUNvbXBvbmVudEZhY2FkZVRvTWV0YWRhdGEoXG4gICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZSwgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBzb3VyY2VNYXBVcmw6IHN0cmluZyk6IFIzQ29tcG9uZW50TWV0YWRhdGEge1xuICBjb25zdCB7dGVtcGxhdGUsIGludGVycG9sYXRpb259ID0gcGFyc2VKaXRUZW1wbGF0ZShcbiAgICAgIGRlY2xhcmF0aW9uLnRlbXBsYXRlLCBkZWNsYXJhdGlvbi50eXBlLm5hbWUsIHNvdXJjZU1hcFVybCxcbiAgICAgIGRlY2xhcmF0aW9uLnByZXNlcnZlV2hpdGVzcGFjZXMgPz8gZmFsc2UsIGRlY2xhcmF0aW9uLmludGVycG9sYXRpb24pO1xuXG4gIHJldHVybiB7XG4gICAgLi4uY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3BhbiksXG4gICAgdGVtcGxhdGUsXG4gICAgc3R5bGVzOiBkZWNsYXJhdGlvbi5zdHlsZXMgPz8gW10sXG4gICAgZGlyZWN0aXZlczogKGRlY2xhcmF0aW9uLmNvbXBvbmVudHMgPz8gW10pXG4gICAgICAgICAgICAgICAgICAgIC5jb25jYXQoZGVjbGFyYXRpb24uZGlyZWN0aXZlcyA/PyBbXSlcbiAgICAgICAgICAgICAgICAgICAgLm1hcChjb252ZXJ0VXNlZERpcmVjdGl2ZURlY2xhcmF0aW9uVG9NZXRhZGF0YSksXG4gICAgcGlwZXM6IGNvbnZlcnRVc2VkUGlwZXNUb01ldGFkYXRhKGRlY2xhcmF0aW9uLnBpcGVzKSxcbiAgICB2aWV3UHJvdmlkZXJzOiBkZWNsYXJhdGlvbi52aWV3UHJvdmlkZXJzICE9PSB1bmRlZmluZWQgP1xuICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnZpZXdQcm92aWRlcnMpIDpcbiAgICAgICAgbnVsbCxcbiAgICBhbmltYXRpb25zOiBkZWNsYXJhdGlvbi5hbmltYXRpb25zICE9PSB1bmRlZmluZWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLmFuaW1hdGlvbnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgIGNoYW5nZURldGVjdGlvbjogZGVjbGFyYXRpb24uY2hhbmdlRGV0ZWN0aW9uID8/IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHQsXG4gICAgZW5jYXBzdWxhdGlvbjogZGVjbGFyYXRpb24uZW5jYXBzdWxhdGlvbiA/PyBWaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBpbnRlcnBvbGF0aW9uLFxuICAgIGRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlOiBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlUmVzb2x2ZWQsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFVzZWREaXJlY3RpdmVEZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb246IFIzRGVjbGFyZVVzZWREaXJlY3RpdmVGYWNhZGUpOlxuICAgIFIzVXNlZERpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBzZWxlY3RvcjogZGVjbGFyYXRpb24uc2VsZWN0b3IsXG4gICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi50eXBlKSxcbiAgICBpbnB1dHM6IGRlY2xhcmF0aW9uLmlucHV0cyA/PyBbXSxcbiAgICBvdXRwdXRzOiBkZWNsYXJhdGlvbi5vdXRwdXRzID8/IFtdLFxuICAgIGV4cG9ydEFzOiBkZWNsYXJhdGlvbi5leHBvcnRBcyA/PyBudWxsLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0VXNlZFBpcGVzVG9NZXRhZGF0YShkZWNsYXJlZFBpcGVzOiBSM0RlY2xhcmVDb21wb25lbnRGYWNhZGVbJ3BpcGVzJ10pOlxuICAgIE1hcDxzdHJpbmcsIEV4cHJlc3Npb24+IHtcbiAgY29uc3QgcGlwZXMgPSBuZXcgTWFwPHN0cmluZywgRXhwcmVzc2lvbj4oKTtcbiAgaWYgKGRlY2xhcmVkUGlwZXMgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBwaXBlcztcbiAgfVxuXG4gIGZvciAoY29uc3QgcGlwZU5hbWUgb2YgT2JqZWN0LmtleXMoZGVjbGFyZWRQaXBlcykpIHtcbiAgICBjb25zdCBwaXBlVHlwZSA9IGRlY2xhcmVkUGlwZXNbcGlwZU5hbWVdO1xuICAgIHBpcGVzLnNldChwaXBlTmFtZSwgbmV3IFdyYXBwZWROb2RlRXhwcihwaXBlVHlwZSkpO1xuICB9XG4gIHJldHVybiBwaXBlcztcbn1cblxuZnVuY3Rpb24gcGFyc2VKaXRUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0eXBlTmFtZTogc3RyaW5nLCBzb3VyY2VNYXBVcmw6IHN0cmluZywgcHJlc2VydmVXaGl0ZXNwYWNlczogYm9vbGVhbixcbiAgICBpbnRlcnBvbGF0aW9uOiBbc3RyaW5nLCBzdHJpbmddfHVuZGVmaW5lZCkge1xuICBjb25zdCBpbnRlcnBvbGF0aW9uQ29uZmlnID1cbiAgICAgIGludGVycG9sYXRpb24gPyBJbnRlcnBvbGF0aW9uQ29uZmlnLmZyb21BcnJheShpbnRlcnBvbGF0aW9uKSA6IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gIC8vIFBhcnNlIHRoZSB0ZW1wbGF0ZSBhbmQgY2hlY2sgZm9yIGVycm9ycy5cbiAgY29uc3QgcGFyc2VkID0gcGFyc2VUZW1wbGF0ZShcbiAgICAgIHRlbXBsYXRlLCBzb3VyY2VNYXBVcmwsIHtwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBwcmVzZXJ2ZVdoaXRlc3BhY2VzLCBpbnRlcnBvbGF0aW9uQ29uZmlnfSk7XG4gIGlmIChwYXJzZWQuZXJyb3JzICE9PSBudWxsKSB7XG4gICAgY29uc3QgZXJyb3JzID0gcGFyc2VkLmVycm9ycy5tYXAoZXJyID0+IGVyci50b1N0cmluZygpKS5qb2luKCcsICcpO1xuICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3JzIGR1cmluZyBKSVQgY29tcGlsYXRpb24gb2YgdGVtcGxhdGUgZm9yICR7dHlwZU5hbWV9OiAke2Vycm9yc31gKTtcbiAgfVxuICByZXR1cm4ge3RlbXBsYXRlOiBwYXJzZWQsIGludGVycG9sYXRpb246IGludGVycG9sYXRpb25Db25maWd9O1xufVxuXG4vLyBUaGlzIHNlZW1zIHRvIGJlIG5lZWRlZCB0byBwbGFjYXRlIFRTIHYzLjAgb25seVxudHlwZSBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSA9XG4gICAgUGljazxSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlLCBFeGNsdWRlPGtleW9mIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsICdwcm9wTWV0YWRhdGEnPj47XG5cbi8qKlxuICogQ29udmVydCB0aGUgZXhwcmVzc2lvbiwgaWYgcHJlc2VudCB0byBhbiBgUjNQcm92aWRlckV4cHJlc3Npb25gLlxuICpcbiAqIEluIEpJVCBtb2RlIHdlIGRvIG5vdCB3YW50IHRoZSBjb21waWxlciB0byB3cmFwIHRoZSBleHByZXNzaW9uIGluIGEgYGZvcndhcmRSZWYoKWAgY2FsbCBiZWNhdXNlLFxuICogaWYgaXQgaXMgcmVmZXJlbmNpbmcgYSB0eXBlIHRoYXQgaGFzIG5vdCB5ZXQgYmVlbiBkZWZpbmVkLCBpdCB3aWxsIGhhdmUgYWxyZWFkeSBiZWVuIHdyYXBwZWQgaW5cbiAqIGEgYGZvcndhcmRSZWYoKWAgLSBlaXRoZXIgYnkgdGhlIGFwcGxpY2F0aW9uIGRldmVsb3BlciBvciBkdXJpbmcgcGFydGlhbC1jb21waWxhdGlvbi4gVGh1cyB3ZSBjYW5cbiAqIHNldCBgaXNGb3J3YXJkUmVmYCB0byBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBjb252ZXJ0VG9Qcm92aWRlckV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBSM1Byb3ZpZGVyRXhwcmVzc2lvbnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBjcmVhdGVSM1Byb3ZpZGVyRXhwcmVzc2lvbihuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pLCAvKiBpc0ZvcndhcmRSZWYgKi8gZmFsc2UpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JhcEV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBXcmFwcGVkTm9kZUV4cHI8YW55Pnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb3ZpZGVkSW4ocHJvdmlkZWRJbjogRnVuY3Rpb258c3RyaW5nfG51bGx8dW5kZWZpbmVkKTogUjNQcm92aWRlckV4cHJlc3Npb24ge1xuICBjb25zdCBleHByZXNzaW9uID0gKHByb3ZpZGVkSW4gPT0gbnVsbCB8fCB0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ3N0cmluZycpID9cbiAgICAgIG5ldyBMaXRlcmFsRXhwcihwcm92aWRlZEluID8/IG51bGwpIDpcbiAgICAgIG5ldyBXcmFwcGVkTm9kZUV4cHIocHJvdmlkZWRJbik7XG4gIC8vIFNlZSBgY29udmVydFRvUHJvdmlkZXJFeHByZXNzaW9uKClgIGZvciB3aHkgYGlzRm9yd2FyZFJlZmAgaXMgZmFsc2UuXG4gIHJldHVybiBjcmVhdGVSM1Byb3ZpZGVyRXhwcmVzc2lvbihleHByZXNzaW9uLCAvKiBpc0ZvcndhcmRSZWYgKi8gZmFsc2UpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGVzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdfG51bGx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfG51bGwge1xuICByZXR1cm4gZmFjYWRlcyA9PSBudWxsID8gbnVsbCA6IGZhY2FkZXMubWFwKGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBjb25zdCBpc0F0dHJpYnV0ZURlcCA9IGZhY2FkZS5hdHRyaWJ1dGUgIT0gbnVsbDsgIC8vIGJvdGggYG51bGxgIGFuZCBgdW5kZWZpbmVkYFxuICBjb25zdCByYXdUb2tlbiA9IGZhY2FkZS50b2tlbiA9PT0gbnVsbCA/IG51bGwgOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50b2tlbik7XG4gIC8vIEluIEpJVCBtb2RlLCBpZiB0aGUgZGVwIGlzIGFuIGBAQXR0cmlidXRlKClgIHRoZW4gd2UgdXNlIHRoZSBhdHRyaWJ1dGUgbmFtZSBnaXZlbiBpblxuICAvLyBgYXR0cmlidXRlYCByYXRoZXIgdGhhbiB0aGUgYHRva2VuYC5cbiAgY29uc3QgdG9rZW4gPSBpc0F0dHJpYnV0ZURlcCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmF0dHJpYnV0ZSkgOiByYXdUb2tlbjtcbiAgcmV0dXJuIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgICAgdG9rZW4sIGlzQXR0cmlidXRlRGVwLCBmYWNhZGUuaG9zdCwgZmFjYWRlLm9wdGlvbmFsLCBmYWNhZGUuc2VsZiwgZmFjYWRlLnNraXBTZWxmKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSk6XG4gICAgUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBjb25zdCBpc0F0dHJpYnV0ZURlcCA9IGZhY2FkZS5hdHRyaWJ1dGUgPz8gZmFsc2U7XG4gIGNvbnN0IHRva2VuID0gZmFjYWRlLnRva2VuID09PSBudWxsID8gbnVsbCA6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnRva2VuKTtcbiAgcmV0dXJuIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgICAgdG9rZW4sIGlzQXR0cmlidXRlRGVwLCBmYWNhZGUuaG9zdCA/PyBmYWxzZSwgZmFjYWRlLm9wdGlvbmFsID8/IGZhbHNlLCBmYWNhZGUuc2VsZiA/PyBmYWxzZSxcbiAgICAgIGZhY2FkZS5za2lwU2VsZiA/PyBmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVIzRGVwZW5kZW5jeU1ldGFkYXRhKFxuICAgIHRva2VuOiBXcmFwcGVkTm9kZUV4cHI8dW5rbm93bj58bnVsbCwgaXNBdHRyaWJ1dGVEZXA6IGJvb2xlYW4sIGhvc3Q6IGJvb2xlYW4sIG9wdGlvbmFsOiBib29sZWFuLFxuICAgIHNlbGY6IGJvb2xlYW4sIHNraXBTZWxmOiBib29sZWFuKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICAvLyBJZiB0aGUgZGVwIGlzIGFuIGBAQXR0cmlidXRlKClgIHRoZSBgYXR0cmlidXRlTmFtZVR5cGVgIG91Z2h0IHRvIGJlIHRoZSBgdW5rbm93bmAgdHlwZS5cbiAgLy8gQnV0IHR5cGVzIGFyZSBub3QgYXZhaWxhYmxlIGF0IHJ1bnRpbWUgc28gd2UganVzdCB1c2UgYSBsaXRlcmFsIGBcIjx1bmtub3duPlwiYCBzdHJpbmcgYXMgYSBkdW1teVxuICAvLyBtYXJrZXIuXG4gIGNvbnN0IGF0dHJpYnV0ZU5hbWVUeXBlID0gaXNBdHRyaWJ1dGVEZXAgPyBsaXRlcmFsKCd1bmtub3duJykgOiBudWxsO1xuICByZXR1cm4ge3Rva2VuLCBhdHRyaWJ1dGVOYW1lVHlwZSwgaG9zdCwgb3B0aW9uYWwsIHNlbGYsIHNraXBTZWxmfTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEhvc3RCaW5kaW5ncyhcbiAgICBwcm9wTWV0YWRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnlbXX0sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBob3N0Pzoge1trZXk6IHN0cmluZ106IHN0cmluZ30pOiBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICAvLyBGaXJzdCBwYXJzZSB0aGUgZGVjbGFyYXRpb25zIGZyb20gdGhlIG1ldGFkYXRhLlxuICBjb25zdCBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKGhvc3QgfHwge30pO1xuXG4gIC8vIEFmdGVyIHRoYXQgY2hlY2sgaG9zdCBiaW5kaW5ncyBmb3IgZXJyb3JzXG4gIGNvbnN0IGVycm9ycyA9IHZlcmlmeUhvc3RCaW5kaW5ncyhiaW5kaW5ncywgc291cmNlU3Bhbik7XG4gIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5tYXAoKGVycm9yOiBQYXJzZUVycm9yKSA9PiBlcnJvci5tc2cpLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIC8vIE5leHQsIGxvb3Agb3ZlciB0aGUgcHJvcGVydGllcyBvZiB0aGUgb2JqZWN0LCBsb29raW5nIGZvciBASG9zdEJpbmRpbmcgYW5kIEBIb3N0TGlzdGVuZXIuXG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNIb3N0QmluZGluZyhhbm4pKSB7XG4gICAgICAgICAgLy8gU2luY2UgdGhpcyBpcyBhIGRlY29yYXRvciwgd2Uga25vdyB0aGF0IHRoZSB2YWx1ZSBpcyBhIGNsYXNzIG1lbWJlci4gQWx3YXlzIGFjY2VzcyBpdFxuICAgICAgICAgIC8vIHRocm91Z2ggYHRoaXNgIHNvIHRoYXQgZnVydGhlciBkb3duIHRoZSBsaW5lIGl0IGNhbid0IGJlIGNvbmZ1c2VkIGZvciBhIGxpdGVyYWwgdmFsdWVcbiAgICAgICAgICAvLyAoZS5nLiBpZiB0aGVyZSdzIGEgcHJvcGVydHkgY2FsbGVkIGB0cnVlYCkuXG4gICAgICAgICAgYmluZGluZ3MucHJvcGVydGllc1thbm4uaG9zdFByb3BlcnR5TmFtZSB8fCBmaWVsZF0gPVxuICAgICAgICAgICAgICBnZXRTYWZlUHJvcGVydHlBY2Nlc3NTdHJpbmcoJ3RoaXMnLCBmaWVsZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNIb3N0TGlzdGVuZXIoYW5uKSkge1xuICAgICAgICAgIGJpbmRpbmdzLmxpc3RlbmVyc1thbm4uZXZlbnROYW1lIHx8IGZpZWxkXSA9IGAke2ZpZWxkfSgkeyhhbm4uYXJncyB8fCBbXSkuam9pbignLCcpfSlgO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmluZGluZ3M7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdEJpbmRpbmcodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RCaW5kaW5nIHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSG9zdEJpbmRpbmcnO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RMaXN0ZW5lcih2YWx1ZTogYW55KTogdmFsdWUgaXMgSG9zdExpc3RlbmVyIHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSG9zdExpc3RlbmVyJztcbn1cblxuXG5mdW5jdGlvbiBpc0lucHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBJbnB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0lucHV0Jztcbn1cblxuZnVuY3Rpb24gaXNPdXRwdXQodmFsdWU6IGFueSk6IHZhbHVlIGlzIE91dHB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ091dHB1dCc7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSW5wdXRPdXRwdXRzKHZhbHVlczogc3RyaW5nW10pOiBTdHJpbmdNYXAge1xuICByZXR1cm4gdmFsdWVzLnJlZHVjZSgobWFwLCB2YWx1ZSkgPT4ge1xuICAgIGNvbnN0IFtmaWVsZCwgcHJvcGVydHldID0gdmFsdWUuc3BsaXQoJywnKS5tYXAocGllY2UgPT4gcGllY2UudHJpbSgpKTtcbiAgICBtYXBbZmllbGRdID0gcHJvcGVydHkgfHwgZmllbGQ7XG4gICAgcmV0dXJuIG1hcDtcbiAgfSwge30gYXMgU3RyaW5nTWFwKTtcbn1cblxuZnVuY3Rpb24gY29udmVydERlY2xhcmVQaXBlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbjogUjNEZWNsYXJlUGlwZUZhY2FkZSk6IFIzUGlwZU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBkZWNsYXJhdGlvbi50eXBlLm5hbWUsXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShkZWNsYXJhdGlvbi50eXBlKSxcbiAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24udHlwZSksXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgcGlwZU5hbWU6IGRlY2xhcmF0aW9uLm5hbWUsXG4gICAgZGVwczogbnVsbCxcbiAgICBwdXJlOiBkZWNsYXJhdGlvbi5wdXJlID8/IHRydWUsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJlSW5qZWN0b3JGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVJbmplY3RvckZhY2FkZSk6XG4gICAgUjNJbmplY3Rvck1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBkZWNsYXJhdGlvbi50eXBlLm5hbWUsXG4gICAgdHlwZTogd3JhcFJlZmVyZW5jZShkZWNsYXJhdGlvbi50eXBlKSxcbiAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24udHlwZSksXG4gICAgcHJvdmlkZXJzOiBkZWNsYXJhdGlvbi5wcm92aWRlcnMgIT09IHVuZGVmaW5lZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZGVjbGFyYXRpb24ucHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgaW1wb3J0czogZGVjbGFyYXRpb24uaW1wb3J0cyAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgZGVjbGFyYXRpb24uaW1wb3J0cy5tYXAoaSA9PiBuZXcgV3JhcHBlZE5vZGVFeHByKGkpKSA6XG4gICAgICAgIFtdLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHVibGlzaEZhY2FkZShnbG9iYWw6IGFueSkge1xuICBjb25zdCBuZzogRXhwb3J0ZWRDb21waWxlckZhY2FkZSA9IGdsb2JhbC5uZyB8fCAoZ2xvYmFsLm5nID0ge30pO1xuICBuZy7JtWNvbXBpbGVyRmFjYWRlID0gbmV3IENvbXBpbGVyRmFjYWRlSW1wbCgpO1xufVxuIl19