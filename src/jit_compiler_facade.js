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
        define("@angular/compiler/src/jit_compiler_facade", ["require", "exports", "tslib", "@angular/compiler/src/constant_pool", "@angular/compiler/src/core", "@angular/compiler/src/identifiers", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/output_jit", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_jit", "@angular/compiler/src/render3/r3_module_compiler", "@angular/compiler/src/render3/r3_pipe_compiler", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/resource_loader", "@angular/compiler/src/schema/dom_element_schema_registry"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publishFacade = exports.CompilerFacadeImpl = void 0;
    var tslib_1 = require("tslib");
    var constant_pool_1 = require("@angular/compiler/src/constant_pool");
    var core_1 = require("@angular/compiler/src/core");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var injectable_compiler_2_1 = require("@angular/compiler/src/injectable_compiler_2");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var output_ast_1 = require("@angular/compiler/src/output/output_ast");
    var output_jit_1 = require("@angular/compiler/src/output/output_jit");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
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
            this.R3ResolvedDependencyType = r3_factory_1.R3ResolvedDependencyType;
            this.R3FactoryTarget = r3_factory_1.R3FactoryTarget;
            this.ResourceLoader = resource_loader_1.ResourceLoader;
            this.elementSchemaRegistry = new dom_element_schema_registry_1.DomElementSchemaRegistry();
        }
        CompilerFacadeImpl.prototype.compilePipe = function (angularCoreEnv, sourceMapUrl, facade) {
            var metadata = {
                name: facade.name,
                type: wrapReference(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                typeArgumentCount: facade.typeArgumentCount,
                deps: convertR3DependencyMetadataArray(facade.deps),
                pipeName: facade.pipeName,
                pure: facade.pure,
            };
            var res = r3_pipe_compiler_1.compilePipeFromMetadata(metadata);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileInjectable = function (angularCoreEnv, sourceMapUrl, facade) {
            var _a = injectable_compiler_2_1.compileInjectable({
                name: facade.name,
                type: wrapReference(facade.type),
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
                type: wrapReference(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                deps: convertR3DependencyMetadataArray(facade.deps),
                providers: new output_ast_1.WrappedNodeExpr(facade.providers),
                imports: facade.imports.map(function (i) { return new output_ast_1.WrappedNodeExpr(i); }),
            };
            var res = r3_module_compiler_1.compileInjector(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, res.statements);
        };
        CompilerFacadeImpl.prototype.compileNgModule = function (angularCoreEnv, sourceMapUrl, facade) {
            var meta = {
                type: wrapReference(facade.type),
                internalType: new output_ast_1.WrappedNodeExpr(facade.type),
                adjacentType: new output_ast_1.WrappedNodeExpr(facade.type),
                bootstrap: facade.bootstrap.map(wrapReference),
                declarations: facade.declarations.map(wrapReference),
                imports: facade.imports.map(wrapReference),
                exports: facade.exports.map(wrapReference),
                emitInline: true,
                containsForwardDecls: false,
                schemas: facade.schemas ? facade.schemas.map(wrapReference) : null,
                id: facade.id ? new output_ast_1.WrappedNodeExpr(facade.id) : null,
            };
            var res = r3_module_compiler_1.compileNgModule(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
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
            var meta = tslib_1.__assign(tslib_1.__assign(tslib_1.__assign({}, facade), convertDirectiveFacadeToMetadata(facade)), { selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(), template: template, declarationListEmitMode: 0 /* Direct */, styles: tslib_1.__spread(facade.styles, template.styles), encapsulation: facade.encapsulation, interpolation: interpolation, changeDetection: facade.changeDetection, animations: facade.animations != null ? new output_ast_1.WrappedNodeExpr(facade.animations) : null, viewProviders: facade.viewProviders != null ? new output_ast_1.WrappedNodeExpr(facade.viewProviders) :
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
                type: wrapReference(meta.type),
                internalType: new output_ast_1.WrappedNodeExpr(meta.type),
                typeArgumentCount: meta.typeArgumentCount,
                deps: convertR3DependencyMetadataArray(meta.deps),
                injectFn: meta.injectFn === 'directiveInject' ? identifiers_1.Identifiers.directiveInject :
                    identifiers_1.Identifiers.inject,
                target: meta.target,
            });
            return this.jitExpression(factoryRes.factory, angularCoreEnv, sourceMapUrl, factoryRes.statements);
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
            var statements = tslib_1.__spread(preStatements, [
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
    var wrapReference = function (value) {
        var wrapped = new output_ast_1.WrappedNodeExpr(value);
        return { value: wrapped, type: wrapped };
    };
    function convertToR3QueryMetadata(facade) {
        return tslib_1.__assign(tslib_1.__assign({}, facade), { predicate: Array.isArray(facade.predicate) ? facade.predicate :
                new output_ast_1.WrappedNodeExpr(facade.predicate), read: facade.read ? new output_ast_1.WrappedNodeExpr(facade.read) : null, static: facade.static });
    }
    function convertQueryDeclarationToMetadata(declaration) {
        var _a, _b, _c;
        return {
            propertyName: declaration.propertyName,
            first: (_a = declaration.first) !== null && _a !== void 0 ? _a : false,
            predicate: Array.isArray(declaration.predicate) ? declaration.predicate :
                new output_ast_1.WrappedNodeExpr(declaration.predicate),
            descendants: (_b = declaration.descendants) !== null && _b !== void 0 ? _b : false,
            read: declaration.read ? new output_ast_1.WrappedNodeExpr(declaration.read) : null,
            static: (_c = declaration.static) !== null && _c !== void 0 ? _c : false,
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
        return tslib_1.__assign(tslib_1.__assign({}, facade), { typeSourceSpan: facade.typeSourceSpan, type: wrapReference(facade.type), internalType: new output_ast_1.WrappedNodeExpr(facade.type), deps: convertR3DependencyMetadataArray(facade.deps), host: extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host), inputs: tslib_1.__assign(tslib_1.__assign({}, inputsFromMetadata), inputsFromType), outputs: tslib_1.__assign(tslib_1.__assign({}, outputsFromMetadata), outputsFromType), queries: facade.queries.map(convertToR3QueryMetadata), providers: facade.providers != null ? new output_ast_1.WrappedNodeExpr(facade.providers) : null, viewQueries: facade.viewQueries.map(convertToR3QueryMetadata), fullInheritance: false });
    }
    function convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return {
            name: declaration.type.name,
            type: wrapReference(declaration.type),
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
        var _a, _b, _c, _d, _e;
        var _f = parseJitTemplate(declaration.template.source, declaration.type.name, sourceMapUrl, (_a = declaration.preserveWhitespaces) !== null && _a !== void 0 ? _a : false, declaration.interpolation), template = _f.template, interpolation = _f.interpolation;
        return tslib_1.__assign(tslib_1.__assign({}, convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan)), { template: template, styles: (_b = declaration.styles) !== null && _b !== void 0 ? _b : [], directives: ((_c = declaration.directives) !== null && _c !== void 0 ? _c : []).map(convertUsedDirectiveDeclarationToMetadata), pipes: convertUsedPipesToMetadata(declaration.pipes), viewProviders: declaration.viewProviders !== undefined ?
                new output_ast_1.WrappedNodeExpr(declaration.viewProviders) :
                null, animations: declaration.animations !== undefined ? new output_ast_1.WrappedNodeExpr(declaration.animations) :
                null, changeDetection: (_d = declaration.changeDetection) !== null && _d !== void 0 ? _d : core_1.ChangeDetectionStrategy.Default, encapsulation: (_e = declaration.encapsulation) !== null && _e !== void 0 ? _e : core_1.ViewEncapsulation.Emulated, interpolation: interpolation, declarationListEmitMode: 2 /* ClosureResolved */, relativeContextFilePath: '', i18nUseExternalIds: true });
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
    function convertR3DependencyMetadata(facade) {
        var tokenExpr;
        if (facade.token === null) {
            tokenExpr = new output_ast_1.LiteralExpr(null);
        }
        else if (facade.resolved === r3_factory_1.R3ResolvedDependencyType.Attribute) {
            tokenExpr = new output_ast_1.LiteralExpr(facade.token);
        }
        else {
            tokenExpr = new output_ast_1.WrappedNodeExpr(facade.token);
        }
        return {
            token: tokenExpr,
            attribute: null,
            resolved: facade.resolved,
            host: facade.host,
            optional: facade.optional,
            self: facade.self,
            skipSelf: facade.skipSelf,
        };
    }
    function convertR3DependencyMetadataArray(facades) {
        return facades == null ? null : facades.map(convertR3DependencyMetadata);
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
    function publishFacade(global) {
        var ng = global.ng || (global.ng = {});
        ng.ɵcompilerFacade = new CompilerFacadeImpl();
    }
    exports.publishFacade = publishFacade;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFJSCxxRUFBNkM7SUFDN0MsbURBQWtIO0lBQ2xILGlFQUEwQztJQUMxQyxxRkFBMEQ7SUFDMUQsNkZBQW1HO0lBQ25HLHNFQUFzSDtJQUN0SCxzRUFBaUQ7SUFDakQsK0RBQThFO0lBQzlFLHVFQUE2SDtJQUM3SCwrREFBZ0Q7SUFDaEQsdUZBQXNIO0lBQ3RILG1GQUFtRjtJQUNuRiwyREFBd0U7SUFFeEUsd0VBQThKO0lBQzlKLHdFQUF5RTtJQUN6RSx5RUFBaUQ7SUFDakQsd0dBQThFO0lBRTlFO1FBTUUsNEJBQW9CLFlBQWlDO1lBQWpDLDZCQUFBLEVBQUEsbUJBQW1CLHlCQUFZLEVBQUU7WUFBakMsaUJBQVksR0FBWixZQUFZLENBQXFCO1lBTHJELDZCQUF3QixHQUFHLHFDQUErQixDQUFDO1lBQzNELG9CQUFlLEdBQUcsNEJBQXNCLENBQUM7WUFDekMsbUJBQWMsR0FBRyxnQ0FBYyxDQUFDO1lBQ3hCLDBCQUFxQixHQUFHLElBQUksc0RBQXdCLEVBQUUsQ0FBQztRQUVQLENBQUM7UUFFekQsd0NBQVcsR0FBWCxVQUFZLGNBQStCLEVBQUUsWUFBb0IsRUFBRSxNQUE0QjtZQUU3RixJQUFNLFFBQVEsR0FBbUI7Z0JBQy9CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtnQkFDakIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNoQyxZQUFZLEVBQUUsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7Z0JBQzlDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxpQkFBaUI7Z0JBQzNDLElBQUksRUFBRSxnQ0FBZ0MsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNuRCxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7Z0JBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTthQUNsQixDQUFDO1lBQ0YsSUFBTSxHQUFHLEdBQUcsMENBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDOUMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBRUQsOENBQWlCLEdBQWpCLFVBQ0ksY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxNQUFrQztZQUM5QixJQUFBLEtBQTJCLHlDQUFpQixDQUFDO2dCQUNqRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7Z0JBQ2pCLElBQUksRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDaEMsWUFBWSxFQUFFLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUM5QyxpQkFBaUIsRUFBRSxNQUFNLENBQUMsaUJBQWlCO2dCQUMzQyxVQUFVLEVBQUUsaUJBQWlCLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztnQkFDaEQsUUFBUSxFQUFFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDO2dCQUMzQyxVQUFVLEVBQUUsY0FBYyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUM7Z0JBQy9DLFFBQVEsRUFBRSxjQUFjLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQztnQkFDM0MsV0FBVyxFQUFFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDO2dCQUNqRCxRQUFRLEVBQUUsZ0NBQWdDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFNBQVM7YUFDekUsQ0FBQyxFQVhLLFVBQVUsZ0JBQUEsRUFBRSxVQUFVLGdCQVczQixDQUFDO1lBRUgsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2xGLENBQUM7UUFFRCw0Q0FBZSxHQUFmLFVBQ0ksY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxNQUFnQztZQUNsQyxJQUFNLElBQUksR0FBdUI7Z0JBQy9CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtnQkFDakIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNoQyxZQUFZLEVBQUUsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7Z0JBQzlDLElBQUksRUFBRSxnQ0FBZ0MsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNuRCxTQUFTLEVBQUUsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7Z0JBQ2hELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLElBQUksNEJBQWUsQ0FBQyxDQUFDLENBQUMsRUFBdEIsQ0FBc0IsQ0FBQzthQUN6RCxDQUFDO1lBQ0YsSUFBTSxHQUFHLEdBQUcsb0NBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMxRixDQUFDO1FBRUQsNENBQWUsR0FBZixVQUNJLGNBQStCLEVBQUUsWUFBb0IsRUFDckQsTUFBZ0M7WUFDbEMsSUFBTSxJQUFJLEdBQXVCO2dCQUMvQixJQUFJLEVBQUUsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7Z0JBQ2hDLFlBQVksRUFBRSxJQUFJLDRCQUFlLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDOUMsWUFBWSxFQUFFLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUM5QyxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO2dCQUM5QyxZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO2dCQUNwRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO2dCQUMxQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO2dCQUMxQyxVQUFVLEVBQUUsSUFBSTtnQkFDaEIsb0JBQW9CLEVBQUUsS0FBSztnQkFDM0IsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO2dCQUNsRSxFQUFFLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTthQUN0RCxDQUFDO1lBQ0YsSUFBTSxHQUFHLEdBQUcsb0NBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzlFLENBQUM7UUFFRCw2Q0FBZ0IsR0FBaEIsVUFDSSxjQUErQixFQUFFLFlBQW9CLEVBQ3JELE1BQWlDO1lBQ25DLElBQU0sSUFBSSxHQUF3QixnQ0FBZ0MsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzRSxPQUFPLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzNFLENBQUM7UUFFRCx3REFBMkIsR0FBM0IsVUFDSSxjQUErQixFQUFFLFlBQW9CLEVBQ3JELFdBQXFDO1lBQ3ZDLElBQU0sY0FBYyxHQUNoQixJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ2pGLElBQU0sSUFBSSxHQUFHLHVDQUF1QyxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUNsRixPQUFPLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzNFLENBQUM7UUFFTyxxREFBd0IsR0FBaEMsVUFDSSxjQUErQixFQUFFLFlBQW9CLEVBQUUsSUFBeUI7WUFDbEYsSUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxFQUFFLENBQUM7WUFDeEMsSUFBTSxhQUFhLEdBQUcsNEJBQWlCLEVBQUUsQ0FBQztZQUMxQyxJQUFNLEdBQUcsR0FBRyx1Q0FBNEIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQzVFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM3RSxDQUFDO1FBRUQsNkNBQWdCLEdBQWhCLFVBQ0ksY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxNQUFpQztZQUNuQywyQ0FBMkM7WUFDckMsSUFBQSxLQUE0QixnQkFBZ0IsQ0FDOUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsbUJBQW1CLEVBQ3RFLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFGbEIsUUFBUSxjQUFBLEVBQUUsYUFBYSxtQkFFTCxDQUFDO1lBRTFCLDBFQUEwRTtZQUMxRSxJQUFNLElBQUksMERBQ0wsTUFBc0QsR0FDdEQsZ0NBQWdDLENBQUMsTUFBTSxDQUFDLEtBQzNDLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyw4QkFBOEIsRUFBRSxFQUN4RixRQUFRLFVBQUEsRUFDUix1QkFBdUIsa0JBQ3ZCLE1BQU0sbUJBQU0sTUFBTSxDQUFDLE1BQU0sRUFBSyxRQUFRLENBQUMsTUFBTSxHQUM3QyxhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQW9CLEVBQzFDLGFBQWEsZUFBQSxFQUNiLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxFQUN2QyxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFDckYsYUFBYSxFQUFFLE1BQU0sQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLDRCQUFlLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7b0JBQzNDLElBQUksRUFDbEQsdUJBQXVCLEVBQUUsRUFBRSxFQUMzQixrQkFBa0IsRUFBRSxJQUFJLEdBQ3pCLENBQUM7WUFDRixJQUFNLHNCQUFzQixHQUFHLFdBQVMsTUFBTSxDQUFDLElBQUksUUFBSyxDQUFDO1lBQ3pELE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxzQkFBc0IsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNyRixDQUFDO1FBRUQsd0RBQTJCLEdBQTNCLFVBQ0ksY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxXQUFxQztZQUN2QyxJQUFNLGNBQWMsR0FDaEIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztZQUNqRixJQUFNLElBQUksR0FBRyx1Q0FBdUMsQ0FBQyxXQUFXLEVBQUUsY0FBYyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ2hHLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDM0UsQ0FBQztRQUVPLHFEQUF3QixHQUFoQyxVQUNJLGNBQStCLEVBQUUsWUFBb0IsRUFBRSxJQUF5QjtZQUNsRixJQUFNLFlBQVksR0FBRyxJQUFJLDRCQUFZLEVBQUUsQ0FBQztZQUN4QyxJQUFNLGFBQWEsR0FBRyw0QkFBaUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDNUQsSUFBTSxHQUFHLEdBQUcsdUNBQTRCLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztZQUM1RSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQ3JCLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUVELDJDQUFjLEdBQWQsVUFDSSxjQUErQixFQUFFLFlBQW9CLEVBQUUsSUFBZ0M7WUFDekYsSUFBTSxVQUFVLEdBQUcsbUNBQXNCLENBQUM7Z0JBQ3hDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtnQkFDZixJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQzlCLFlBQVksRUFBRSxJQUFJLDRCQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDNUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtnQkFDekMsSUFBSSxFQUFFLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQ2pELFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxLQUFLLGlCQUFpQixDQUFDLENBQUMsQ0FBQyx5QkFBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO29CQUM3Qix5QkFBVyxDQUFDLE1BQU07Z0JBQ2xFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTthQUNwQixDQUFDLENBQUM7WUFDSCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQ3JCLFVBQVUsQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0UsQ0FBQztRQUVELGtEQUFxQixHQUFyQixVQUFzQixJQUFZLEVBQUUsUUFBZ0IsRUFBRSxTQUFpQjtZQUNyRSxPQUFPLGdDQUFtQixDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUVEOzs7Ozs7OztXQVFHO1FBQ0ssMENBQWEsR0FBckIsVUFDSSxHQUFlLEVBQUUsT0FBNkIsRUFBRSxTQUFpQixFQUNqRSxhQUEwQjtZQUM1QixnR0FBZ0c7WUFDaEcsK0ZBQStGO1lBQy9GLHFFQUFxRTtZQUNyRSxJQUFNLFVBQVUsb0JBQ1gsYUFBYTtnQkFDaEIsSUFBSSwyQkFBYyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLENBQUMseUJBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztjQUNwRSxDQUFDO1lBRUYsSUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsQ0FDNUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxJQUFJLHVCQUFjLENBQUMsT0FBTyxDQUFDLEVBQUUsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckYsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDckIsQ0FBQztRQUNILHlCQUFDO0lBQUQsQ0FBQyxBQWpNRCxJQWlNQztJQWpNWSxnREFBa0I7SUF3TS9CLElBQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBQyxRQUFRLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuRCxJQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkQsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25ELElBQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBQyxXQUFXLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUV6RCxJQUFNLGFBQWEsR0FBRyxVQUFTLEtBQVU7UUFDdkMsSUFBTSxPQUFPLEdBQUcsSUFBSSw0QkFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzNDLE9BQU8sRUFBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUMsQ0FBQztJQUN6QyxDQUFDLENBQUM7SUFFRixTQUFTLHdCQUF3QixDQUFDLE1BQTZCO1FBQzdELDZDQUNLLE1BQU0sS0FDVCxTQUFTLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDbEIsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFDbEYsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFDM0QsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNLElBQ3JCO0lBQ0osQ0FBQztJQUVELFNBQVMsaUNBQWlDLENBQUMsV0FBeUM7O1FBRWxGLE9BQU87WUFDTCxZQUFZLEVBQUUsV0FBVyxDQUFDLFlBQVk7WUFDdEMsS0FBSyxRQUFFLFdBQVcsQ0FBQyxLQUFLLG1DQUFJLEtBQUs7WUFDakMsU0FBUyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3ZCLElBQUksNEJBQWUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDO1lBQzVGLFdBQVcsUUFBRSxXQUFXLENBQUMsV0FBVyxtQ0FBSSxLQUFLO1lBQzdDLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLDRCQUFlLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO1lBQ3JFLE1BQU0sUUFBRSxXQUFXLENBQUMsTUFBTSxtQ0FBSSxLQUFLO1NBQ3BDLENBQUM7SUFDSixDQUFDO0lBRUQsU0FBUyxnQ0FBZ0MsQ0FBQyxNQUFpQztRQUN6RSxJQUFNLGtCQUFrQixHQUFHLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksRUFBRSxDQUFDLENBQUM7UUFDbEUsSUFBTSxtQkFBbUIsR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3BFLElBQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUM7UUFDekMsSUFBTSxjQUFjLEdBQXdCLEVBQUUsQ0FBQztRQUMvQyxJQUFNLGVBQWUsR0FBYyxFQUFFLENBQUM7Z0NBQzNCLEtBQUs7WUFDZCxJQUFJLFlBQVksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3RDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxHQUFHO29CQUM3QixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTt3QkFDaEIsY0FBYyxDQUFDLEtBQUssQ0FBQzs0QkFDakIsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO3FCQUN4RTt5QkFBTSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTt3QkFDeEIsZUFBZSxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxLQUFLLENBQUM7cUJBQzNEO2dCQUNILENBQUMsQ0FBQyxDQUFDO2FBQ0o7O1FBVkgsS0FBSyxJQUFNLEtBQUssSUFBSSxZQUFZO29CQUFyQixLQUFLO1NBV2Y7UUFFRCw2Q0FDSyxNQUFzRCxLQUN6RCxjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWMsRUFDckMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQ2hDLFlBQVksRUFBRSxJQUFJLDRCQUFlLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUM5QyxJQUFJLEVBQUUsZ0NBQWdDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUNuRCxJQUFJLEVBQUUsbUJBQW1CLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFDbEYsTUFBTSx3Q0FBTSxrQkFBa0IsR0FBSyxjQUFjLEdBQ2pELE9BQU8sd0NBQU0sbUJBQW1CLEdBQUssZUFBZSxHQUNwRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsRUFDckQsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLDRCQUFlLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQ2xGLFdBQVcsRUFBRSxNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxFQUM3RCxlQUFlLEVBQUUsS0FBSyxJQUN0QjtJQUNKLENBQUM7SUFFRCxTQUFTLHVDQUF1QyxDQUM1QyxXQUFxQyxFQUFFLGNBQStCOztRQUN4RSxPQUFPO1lBQ0wsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUMzQixJQUFJLEVBQUUsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7WUFDckMsY0FBYyxnQkFBQTtZQUNkLFlBQVksRUFBRSxJQUFJLDRCQUFlLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztZQUNuRCxRQUFRLFFBQUUsV0FBVyxDQUFDLFFBQVEsbUNBQUksSUFBSTtZQUN0QyxNQUFNLFFBQUUsV0FBVyxDQUFDLE1BQU0sbUNBQUksRUFBRTtZQUNoQyxPQUFPLFFBQUUsV0FBVyxDQUFDLE9BQU8sbUNBQUksRUFBRTtZQUNsQyxJQUFJLEVBQUUsZ0NBQWdDLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztZQUN4RCxPQUFPLEVBQUUsT0FBQyxXQUFXLENBQUMsT0FBTyxtQ0FBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsaUNBQWlDLENBQUM7WUFDM0UsV0FBVyxFQUFFLE9BQUMsV0FBVyxDQUFDLFdBQVcsbUNBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLGlDQUFpQyxDQUFDO1lBQ25GLFNBQVMsRUFBRSxXQUFXLENBQUMsU0FBUyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSw0QkFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUM1QyxJQUFJO1lBQ3JELFFBQVEsUUFBRSxXQUFXLENBQUMsUUFBUSxtQ0FBSSxJQUFJO1lBQ3RDLGVBQWUsUUFBRSxXQUFXLENBQUMsZUFBZSxtQ0FBSSxLQUFLO1lBQ3JELFNBQVMsRUFBRSxFQUFDLGFBQWEsUUFBRSxXQUFXLENBQUMsYUFBYSxtQ0FBSSxLQUFLLEVBQUM7WUFDOUQsSUFBSSxFQUFFLElBQUk7WUFDVixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGVBQWUsRUFBRSxLQUFLO1NBQ3ZCLENBQUM7SUFDSixDQUFDO0lBRUQsU0FBUyxnQ0FBZ0MsQ0FBQyxJQUEyQzs7UUFBM0MscUJBQUEsRUFBQSxTQUEyQztRQUVuRixPQUFPO1lBQ0wsVUFBVSxFQUFFLGdDQUFnQyxPQUFDLElBQUksQ0FBQyxVQUFVLG1DQUFJLEVBQUUsQ0FBQztZQUNuRSxTQUFTLFFBQUUsSUFBSSxDQUFDLFNBQVMsbUNBQUksRUFBRTtZQUMvQixVQUFVLFFBQUUsSUFBSSxDQUFDLFVBQVUsbUNBQUksRUFBRTtZQUNqQyxpQkFBaUIsRUFBRTtnQkFDakIsU0FBUyxFQUFFLElBQUksQ0FBQyxjQUFjO2dCQUM5QixTQUFTLEVBQUUsSUFBSSxDQUFDLGNBQWM7YUFDL0I7U0FDRixDQUFDO0lBQ0osQ0FBQztJQUVELFNBQVMsZ0NBQWdDLENBQUMsR0FBaUM7O1FBRXpFLElBQU0sTUFBTSxHQUE4QyxFQUFFLENBQUM7O1lBQzdELEtBQWtCLElBQUEsS0FBQSxpQkFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBLGdCQUFBLDRCQUFFO2dCQUEvQixJQUFNLEdBQUcsV0FBQTtnQkFDWixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSw0QkFBZSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2FBQzdDOzs7Ozs7Ozs7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRUQsU0FBUyx1Q0FBdUMsQ0FDNUMsV0FBcUMsRUFBRSxjQUErQixFQUN0RSxZQUFvQjs7UUFDaEIsSUFBQSxLQUE0QixnQkFBZ0IsQ0FDOUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsWUFBWSxRQUNoRSxXQUFXLENBQUMsbUJBQW1CLG1DQUFJLEtBQUssRUFBRSxXQUFXLENBQUMsYUFBYSxDQUFDLEVBRmpFLFFBQVEsY0FBQSxFQUFFLGFBQWEsbUJBRTBDLENBQUM7UUFFekUsNkNBQ0ssdUNBQXVDLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxLQUN2RSxRQUFRLFVBQUEsRUFDUixNQUFNLFFBQUUsV0FBVyxDQUFDLE1BQU0sbUNBQUksRUFBRSxFQUNoQyxVQUFVLEVBQUUsT0FBQyxXQUFXLENBQUMsVUFBVSxtQ0FBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMseUNBQXlDLENBQUMsRUFDekYsS0FBSyxFQUFFLDBCQUEwQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsRUFDcEQsYUFBYSxFQUFFLFdBQVcsQ0FBQyxhQUFhLEtBQUssU0FBUyxDQUFDLENBQUM7Z0JBQ3BELElBQUksNEJBQWUsQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztnQkFDaEQsSUFBSSxFQUNSLFVBQVUsRUFBRSxXQUFXLENBQUMsVUFBVSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSw0QkFBZSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUM3QyxJQUFJLEVBQ3ZELGVBQWUsUUFBRSxXQUFXLENBQUMsZUFBZSxtQ0FBSSw4QkFBdUIsQ0FBQyxPQUFPLEVBQy9FLGFBQWEsUUFBRSxXQUFXLENBQUMsYUFBYSxtQ0FBSSx3QkFBaUIsQ0FBQyxRQUFRLEVBQ3RFLGFBQWEsZUFBQSxFQUNiLHVCQUF1QiwyQkFDdkIsdUJBQXVCLEVBQUUsRUFBRSxFQUMzQixrQkFBa0IsRUFBRSxJQUFJLElBQ3hCO0lBQ0osQ0FBQztJQUVELFNBQVMseUNBQXlDLENBQzlDLFdBQXdFOztRQUUxRSxPQUFPO1lBQ0wsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRO1lBQzlCLElBQUksRUFBRSxJQUFJLDRCQUFlLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztZQUMzQyxNQUFNLFFBQUUsV0FBVyxDQUFDLE1BQU0sbUNBQUksRUFBRTtZQUNoQyxPQUFPLFFBQUUsV0FBVyxDQUFDLE9BQU8sbUNBQUksRUFBRTtZQUNsQyxRQUFRLFFBQUUsV0FBVyxDQUFDLFFBQVEsbUNBQUksSUFBSTtTQUN2QyxDQUFDO0lBQ0osQ0FBQztJQUVELFNBQVMsMEJBQTBCLENBQUMsYUFBZ0Q7O1FBRWxGLElBQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO1FBQzVDLElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRTtZQUMvQixPQUFPLEtBQUssQ0FBQztTQUNkOztZQUVELEtBQXVCLElBQUEsS0FBQSxpQkFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFBLGdCQUFBLDRCQUFFO2dCQUE5QyxJQUFNLFFBQVEsV0FBQTtnQkFDakIsSUFBTSxRQUFRLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN6QyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLDRCQUFlLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzthQUNwRDs7Ozs7Ozs7O1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsU0FBUyxnQkFBZ0IsQ0FDckIsUUFBZ0IsRUFBRSxRQUFnQixFQUFFLFlBQW9CLEVBQUUsbUJBQTRCLEVBQ3RGLGFBQXlDO1FBQzNDLElBQU0sbUJBQW1CLEdBQ3JCLGFBQWEsQ0FBQyxDQUFDLENBQUMsMENBQW1CLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxtREFBNEIsQ0FBQztRQUNoRywyQ0FBMkM7UUFDM0MsSUFBTSxNQUFNLEdBQUcsd0JBQWEsQ0FDeEIsUUFBUSxFQUFFLFlBQVksRUFBRSxFQUFDLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixxQkFBQSxFQUFDLENBQUMsQ0FBQztRQUM3RixJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO1lBQzFCLElBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUFkLENBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuRSxNQUFNLElBQUksS0FBSyxDQUFDLG1EQUFpRCxRQUFRLFVBQUssTUFBUSxDQUFDLENBQUM7U0FDekY7UUFDRCxPQUFPLEVBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsbUJBQW1CLEVBQUMsQ0FBQztJQUNoRSxDQUFDO0lBTUQsU0FBUyxjQUFjLENBQUMsR0FBUSxFQUFFLFFBQWdCO1FBQ2hELElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNoQyxPQUFPLElBQUksNEJBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztTQUMzQzthQUFNO1lBQ0wsT0FBTyxTQUFTLENBQUM7U0FDbEI7SUFDSCxDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxVQUFzQztRQUMvRCxJQUFJLFVBQVUsSUFBSSxJQUFJLElBQUksT0FBTyxVQUFVLEtBQUssUUFBUSxFQUFFO1lBQ3hELE9BQU8sSUFBSSx3QkFBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ3BDO2FBQU07WUFDTCxPQUFPLElBQUksNEJBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUN4QztJQUNILENBQUM7SUFFRCxTQUFTLDJCQUEyQixDQUFDLE1BQWtDO1FBQ3JFLElBQUksU0FBUyxDQUFDO1FBQ2QsSUFBSSxNQUFNLENBQUMsS0FBSyxLQUFLLElBQUksRUFBRTtZQUN6QixTQUFTLEdBQUcsSUFBSSx3QkFBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ25DO2FBQU0sSUFBSSxNQUFNLENBQUMsUUFBUSxLQUFLLHFDQUF3QixDQUFDLFNBQVMsRUFBRTtZQUNqRSxTQUFTLEdBQUcsSUFBSSx3QkFBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMzQzthQUFNO1lBQ0wsU0FBUyxHQUFHLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDL0M7UUFDRCxPQUFPO1lBQ0wsS0FBSyxFQUFFLFNBQVM7WUFDaEIsU0FBUyxFQUFFLElBQUk7WUFDZixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7WUFDekIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO1lBQ2pCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtZQUN6QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7WUFDakIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1NBQzFCLENBQUM7SUFDSixDQUFDO0lBRUQsU0FBUyxnQ0FBZ0MsQ0FBQyxPQUNTO1FBQ2pELE9BQU8sT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVELFNBQVMsbUJBQW1CLENBQ3hCLFlBQW9DLEVBQUUsVUFBMkIsRUFDakUsSUFBOEI7UUFDaEMsa0RBQWtEO1FBQ2xELElBQU0sUUFBUSxHQUFHLDRCQUFpQixDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQztRQUUvQyw0Q0FBNEM7UUFDNUMsSUFBTSxNQUFNLEdBQUcsNkJBQWtCLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3hELElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQyxLQUFpQixJQUFLLE9BQUEsS0FBSyxDQUFDLEdBQUcsRUFBVCxDQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUMxRTtnQ0FHVSxLQUFLO1lBQ2QsSUFBSSxZQUFZLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUN0QyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsR0FBRztvQkFDN0IsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ3RCLHdGQUF3Rjt3QkFDeEYsd0ZBQXdGO3dCQUN4Riw4Q0FBOEM7d0JBQzlDLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLGdCQUFnQixJQUFJLEtBQUssQ0FBQzs0QkFDOUMsa0NBQTJCLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO3FCQUNoRDt5QkFBTSxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRTt3QkFDOUIsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsU0FBUyxJQUFJLEtBQUssQ0FBQyxHQUFNLEtBQUssU0FBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFHLENBQUM7cUJBQ3hGO2dCQUNILENBQUMsQ0FBQyxDQUFDO2FBQ0o7O1FBZEgsNEZBQTRGO1FBQzVGLEtBQUssSUFBTSxLQUFLLElBQUksWUFBWTtvQkFBckIsS0FBSztTQWNmO1FBRUQsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztJQUVELFNBQVMsYUFBYSxDQUFDLEtBQVU7UUFDL0IsT0FBTyxLQUFLLENBQUMsY0FBYyxLQUFLLGFBQWEsQ0FBQztJQUNoRCxDQUFDO0lBRUQsU0FBUyxjQUFjLENBQUMsS0FBVTtRQUNoQyxPQUFPLEtBQUssQ0FBQyxjQUFjLEtBQUssY0FBYyxDQUFDO0lBQ2pELENBQUM7SUFHRCxTQUFTLE9BQU8sQ0FBQyxLQUFVO1FBQ3pCLE9BQU8sS0FBSyxDQUFDLGNBQWMsS0FBSyxPQUFPLENBQUM7SUFDMUMsQ0FBQztJQUVELFNBQVMsUUFBUSxDQUFDLEtBQVU7UUFDMUIsT0FBTyxLQUFLLENBQUMsY0FBYyxLQUFLLFFBQVEsQ0FBQztJQUMzQyxDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxNQUFnQjtRQUN6QyxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBQyxHQUFHLEVBQUUsS0FBSztZQUN4QixJQUFBLEtBQUEsZUFBb0IsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQVosQ0FBWSxDQUFDLElBQUEsRUFBOUQsS0FBSyxRQUFBLEVBQUUsUUFBUSxRQUErQyxDQUFDO1lBQ3RFLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxRQUFRLElBQUksS0FBSyxDQUFDO1lBQy9CLE9BQU8sR0FBRyxDQUFDO1FBQ2IsQ0FBQyxFQUFFLEVBQWUsQ0FBQyxDQUFDO0lBQ3RCLENBQUM7SUFFRCxTQUFnQixhQUFhLENBQUMsTUFBVztRQUN2QyxJQUFNLEVBQUUsR0FBMkIsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDakUsRUFBRSxDQUFDLGVBQWUsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7SUFDaEQsQ0FBQztJQUhELHNDQUdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtDb21waWxlckZhY2FkZSwgQ29yZUVudmlyb25tZW50LCBFeHBvcnRlZENvbXBpbGVyRmFjYWRlLCBPcGFxdWVWYWx1ZSwgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlLCBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUsIFIzRGVjbGFyZVF1ZXJ5TWV0YWRhdGFGYWNhZGUsIFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlLCBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlLCBSM0ZhY3RvcnlEZWZNZXRhZGF0YUZhY2FkZSwgUjNJbmplY3RhYmxlTWV0YWRhdGFGYWNhZGUsIFIzSW5qZWN0b3JNZXRhZGF0YUZhY2FkZSwgUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlLCBSM1BpcGVNZXRhZGF0YUZhY2FkZSwgUjNRdWVyeU1ldGFkYXRhRmFjYWRlLCBTdHJpbmdNYXAsIFN0cmluZ01hcFdpdGhSZW5hbWV9IGZyb20gJy4vY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZSc7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7Q2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIEhvc3RCaW5kaW5nLCBIb3N0TGlzdGVuZXIsIElucHV0LCBPdXRwdXQsIFR5cGUsIFZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi9pZGVudGlmaWVycyc7XG5pbXBvcnQge2NvbXBpbGVJbmplY3RhYmxlfSBmcm9tICcuL2luamVjdGFibGVfY29tcGlsZXJfMic7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7RGVjbGFyZVZhclN0bXQsIEV4cHJlc3Npb24sIExpdGVyYWxFeHByLCBTdGF0ZW1lbnQsIFN0bXRNb2RpZmllciwgV3JhcHBlZE5vZGVFeHByfSBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7Sml0RXZhbHVhdG9yfSBmcm9tICcuL291dHB1dC9vdXRwdXRfaml0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFuLCByM0ppdFR5cGVTb3VyY2VTcGFufSBmcm9tICcuL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtjb21waWxlRmFjdG9yeUZ1bmN0aW9uLCBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNGYWN0b3J5VGFyZ2V0LCBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGV9IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmltcG9ydCB7UjNKaXRSZWZsZWN0b3J9IGZyb20gJy4vcmVuZGVyMy9yM19qaXQnO1xuaW1wb3J0IHtjb21waWxlSW5qZWN0b3IsIGNvbXBpbGVOZ01vZHVsZSwgUjNJbmplY3Rvck1ldGFkYXRhLCBSM05nTW9kdWxlTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19tb2R1bGVfY29tcGlsZXInO1xuaW1wb3J0IHtjb21waWxlUGlwZUZyb21NZXRhZGF0YSwgUjNQaXBlTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy9yM19waXBlX2NvbXBpbGVyJztcbmltcG9ydCB7Z2V0U2FmZVByb3BlcnR5QWNjZXNzU3RyaW5nLCBSM1JlZmVyZW5jZX0gZnJvbSAnLi9yZW5kZXIzL3V0aWwnO1xuaW1wb3J0IHtEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0TWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YSwgUjNVc2VkRGlyZWN0aXZlTWV0YWRhdGF9IGZyb20gJy4vcmVuZGVyMy92aWV3L2FwaSc7XG5pbXBvcnQge2NvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEsIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEsIFBhcnNlZEhvc3RCaW5kaW5ncywgcGFyc2VIb3N0QmluZGluZ3MsIHZlcmlmeUhvc3RCaW5kaW5nc30gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHttYWtlQmluZGluZ1BhcnNlciwgcGFyc2VUZW1wbGF0ZX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtSZXNvdXJjZUxvYWRlcn0gZnJvbSAnLi9yZXNvdXJjZV9sb2FkZXInO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlckZhY2FkZUltcGwgaW1wbGVtZW50cyBDb21waWxlckZhY2FkZSB7XG4gIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSA9IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSBhcyBhbnk7XG4gIFIzRmFjdG9yeVRhcmdldCA9IFIzRmFjdG9yeVRhcmdldCBhcyBhbnk7XG4gIFJlc291cmNlTG9hZGVyID0gUmVzb3VyY2VMb2FkZXI7XG4gIHByaXZhdGUgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgaml0RXZhbHVhdG9yID0gbmV3IEppdEV2YWx1YXRvcigpKSB7fVxuXG4gIGNvbXBpbGVQaXBlKGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBmYWNhZGU6IFIzUGlwZU1ldGFkYXRhRmFjYWRlKTpcbiAgICAgIGFueSB7XG4gICAgY29uc3QgbWV0YWRhdGE6IFIzUGlwZU1ldGFkYXRhID0ge1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogZmFjYWRlLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgICAgcGlwZU5hbWU6IGZhY2FkZS5waXBlTmFtZSxcbiAgICAgIHB1cmU6IGZhY2FkZS5wdXJlLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZVBpcGVGcm9tTWV0YWRhdGEobWV0YWRhdGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RhYmxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB7ZXhwcmVzc2lvbiwgc3RhdGVtZW50c30gPSBjb21waWxlSW5qZWN0YWJsZSh7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBmYWNhZGUudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICBwcm92aWRlZEluOiBjb21wdXRlUHJvdmlkZWRJbihmYWNhZGUucHJvdmlkZWRJbiksXG4gICAgICB1c2VDbGFzczogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfQ0xBU1MpLFxuICAgICAgdXNlRmFjdG9yeTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRkFDVE9SWSksXG4gICAgICB1c2VWYWx1ZTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfVkFMVUUpLFxuICAgICAgdXNlRXhpc3Rpbmc6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgVVNFX0VYSVNUSU5HKSxcbiAgICAgIHVzZXJEZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGUudXNlckRlcHMpIHx8IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0b3IoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEgPSB7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS5kZXBzKSxcbiAgICAgIHByb3ZpZGVyczogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJvdmlkZXJzKSxcbiAgICAgIGltcG9ydHM6IGZhY2FkZS5pbXBvcnRzLm1hcChpID0+IG5ldyBXcmFwcGVkTm9kZUV4cHIoaSkpLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUluamVjdG9yKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIHJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVOZ01vZHVsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSA9IHtcbiAgICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGFkamFjZW50VHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBib290c3RyYXA6IGZhY2FkZS5ib290c3RyYXAubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZGVjbGFyYXRpb25zOiBmYWNhZGUuZGVjbGFyYXRpb25zLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGltcG9ydHM6IGZhY2FkZS5pbXBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGV4cG9ydHM6IGZhY2FkZS5leHBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGVtaXRJbmxpbmU6IHRydWUsXG4gICAgICBjb250YWluc0ZvcndhcmREZWNsczogZmFsc2UsXG4gICAgICBzY2hlbWFzOiBmYWNhZGUuc2NoZW1hcyA/IGZhY2FkZS5zY2hlbWFzLm1hcCh3cmFwUmVmZXJlbmNlKSA6IG51bGwsXG4gICAgICBpZDogZmFjYWRlLmlkID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuaWQpIDogbnVsbCxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVOZ01vZHVsZShtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEgPSBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGUpO1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YShhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBtZXRhKTtcbiAgfVxuXG4gIGNvbXBpbGVEaXJlY3RpdmVEZWNsYXJhdGlvbihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZURpcmVjdGl2ZUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgdHlwZVNvdXJjZVNwYW4gPVxuICAgICAgICB0aGlzLmNyZWF0ZVBhcnNlU291cmNlU3BhbignRGlyZWN0aXZlJywgZGVjbGFyYXRpb24udHlwZS5uYW1lLCBzb3VyY2VNYXBVcmwpO1xuICAgIGNvbnN0IG1ldGEgPSBjb252ZXJ0RGVjbGFyZURpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZGVjbGFyYXRpb24sIHR5cGVTb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBwcml2YXRlIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogYW55IHtcbiAgICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKCk7XG4gICAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKCk7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBjb25zdGFudFBvb2wuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlQ29tcG9uZW50KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIC8vIFBhcnNlIHRoZSB0ZW1wbGF0ZSBhbmQgY2hlY2sgZm9yIGVycm9ycy5cbiAgICBjb25zdCB7dGVtcGxhdGUsIGludGVycG9sYXRpb259ID0gcGFyc2VKaXRUZW1wbGF0ZShcbiAgICAgICAgZmFjYWRlLnRlbXBsYXRlLCBmYWNhZGUubmFtZSwgc291cmNlTWFwVXJsLCBmYWNhZGUucHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgICAgZmFjYWRlLmludGVycG9sYXRpb24pO1xuXG4gICAgLy8gQ29tcGlsZSB0aGUgY29tcG9uZW50IG1ldGFkYXRhLCBpbmNsdWRpbmcgdGVtcGxhdGUsIGludG8gYW4gZXhwcmVzc2lvbi5cbiAgICBjb25zdCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhID0ge1xuICAgICAgLi4uZmFjYWRlIGFzIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlLFxuICAgICAgLi4uY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKSxcbiAgICAgIHNlbGVjdG9yOiBmYWNhZGUuc2VsZWN0b3IgfHwgdGhpcy5lbGVtZW50U2NoZW1hUmVnaXN0cnkuZ2V0RGVmYXVsdENvbXBvbmVudEVsZW1lbnROYW1lKCksXG4gICAgICB0ZW1wbGF0ZSxcbiAgICAgIGRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlOiBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3QsXG4gICAgICBzdHlsZXM6IFsuLi5mYWNhZGUuc3R5bGVzLCAuLi50ZW1wbGF0ZS5zdHlsZXNdLFxuICAgICAgZW5jYXBzdWxhdGlvbjogZmFjYWRlLmVuY2Fwc3VsYXRpb24gYXMgYW55LFxuICAgICAgaW50ZXJwb2xhdGlvbixcbiAgICAgIGNoYW5nZURldGVjdGlvbjogZmFjYWRlLmNoYW5nZURldGVjdGlvbixcbiAgICAgIGFuaW1hdGlvbnM6IGZhY2FkZS5hbmltYXRpb25zICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5hbmltYXRpb25zKSA6IG51bGwsXG4gICAgICB2aWV3UHJvdmlkZXJzOiBmYWNhZGUudmlld1Byb3ZpZGVycyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudmlld1Byb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogJycsXG4gICAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gICAgfTtcbiAgICBjb25zdCBqaXRFeHByZXNzaW9uU291cmNlTWFwID0gYG5nOi8vLyR7ZmFjYWRlLm5hbWV9LmpzYDtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlQ29tcG9uZW50RnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIGppdEV4cHJlc3Npb25Tb3VyY2VNYXAsIG1ldGEpO1xuICB9XG5cbiAgY29tcGlsZUNvbXBvbmVudERlY2xhcmF0aW9uKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlQ29tcG9uZW50RmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB0eXBlU291cmNlU3BhbiA9XG4gICAgICAgIHRoaXMuY3JlYXRlUGFyc2VTb3VyY2VTcGFuKCdDb21wb25lbnQnLCBkZWNsYXJhdGlvbi50eXBlLm5hbWUsIHNvdXJjZU1hcFVybCk7XG4gICAgY29uc3QgbWV0YSA9IGNvbnZlcnREZWNsYXJlQ29tcG9uZW50RmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbiwgdHlwZVNvdXJjZVNwYW4sIHNvdXJjZU1hcFVybCk7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZUNvbXBvbmVudEZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIG1ldGEpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGEoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSk6IGFueSB7XG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuICAgIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcihtZXRhLmludGVycG9sYXRpb24pO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUZhY3RvcnkoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUpIHtcbiAgICBjb25zdCBmYWN0b3J5UmVzID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKG1ldGEudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIobWV0YS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkobWV0YS5kZXBzKSxcbiAgICAgIGluamVjdEZuOiBtZXRhLmluamVjdEZuID09PSAnZGlyZWN0aXZlSW5qZWN0JyA/IElkZW50aWZpZXJzLmRpcmVjdGl2ZUluamVjdCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJZGVudGlmaWVycy5pbmplY3QsXG4gICAgICB0YXJnZXQ6IG1ldGEudGFyZ2V0LFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIGZhY3RvcnlSZXMuZmFjdG9yeSwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgZmFjdG9yeVJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNyZWF0ZVBhcnNlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gcjNKaXRUeXBlU291cmNlU3BhbihraW5kLCB0eXBlTmFtZSwgc291cmNlVXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBKSVQgY29tcGlsZXMgYW4gZXhwcmVzc2lvbiBhbmQgcmV0dXJucyB0aGUgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGF0IGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBwYXJhbSBkZWYgdGhlIGRlZmluaXRpb24gd2hpY2ggd2lsbCBiZSBjb21waWxlZCBhbmQgZXhlY3V0ZWQgdG8gZ2V0IHRoZSB2YWx1ZSB0byBwYXRjaFxuICAgKiBAcGFyYW0gY29udGV4dCBhbiBvYmplY3QgbWFwIG9mIEBhbmd1bGFyL2NvcmUgc3ltYm9sIG5hbWVzIHRvIHN5bWJvbHMgd2hpY2ggd2lsbCBiZSBhdmFpbGFibGVcbiAgICogaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHNvdXJjZVVybCBhIFVSTCB0byB1c2UgZm9yIHRoZSBzb3VyY2UgbWFwIG9mIHRoZSBjb21waWxlZCBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBwcmVTdGF0ZW1lbnRzIGEgY29sbGVjdGlvbiBvZiBzdGF0ZW1lbnRzIHRoYXQgc2hvdWxkIGJlIGV2YWx1YXRlZCBiZWZvcmUgdGhlIGV4cHJlc3Npb24uXG4gICAqL1xuICBwcml2YXRlIGppdEV4cHJlc3Npb24oXG4gICAgICBkZWY6IEV4cHJlc3Npb24sIGNvbnRleHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBzb3VyY2VVcmw6IHN0cmluZyxcbiAgICAgIHByZVN0YXRlbWVudHM6IFN0YXRlbWVudFtdKTogYW55IHtcbiAgICAvLyBUaGUgQ29uc3RhbnRQb29sIG1heSBjb250YWluIFN0YXRlbWVudHMgd2hpY2ggZGVjbGFyZSB2YXJpYWJsZXMgdXNlZCBpbiB0aGUgZmluYWwgZXhwcmVzc2lvbi5cbiAgICAvLyBUaGVyZWZvcmUsIGl0cyBzdGF0ZW1lbnRzIG5lZWQgdG8gcHJlY2VkZSB0aGUgYWN0dWFsIEpJVCBvcGVyYXRpb24uIFRoZSBmaW5hbCBzdGF0ZW1lbnQgaXMgYVxuICAgIC8vIGRlY2xhcmF0aW9uIG9mICRkZWYgd2hpY2ggaXMgc2V0IHRvIHRoZSBleHByZXNzaW9uIGJlaW5nIGNvbXBpbGVkLlxuICAgIGNvbnN0IHN0YXRlbWVudHM6IFN0YXRlbWVudFtdID0gW1xuICAgICAgLi4ucHJlU3RhdGVtZW50cyxcbiAgICAgIG5ldyBEZWNsYXJlVmFyU3RtdCgnJGRlZicsIGRlZiwgdW5kZWZpbmVkLCBbU3RtdE1vZGlmaWVyLkV4cG9ydGVkXSksXG4gICAgXTtcblxuICAgIGNvbnN0IHJlcyA9IHRoaXMuaml0RXZhbHVhdG9yLmV2YWx1YXRlU3RhdGVtZW50cyhcbiAgICAgICAgc291cmNlVXJsLCBzdGF0ZW1lbnRzLCBuZXcgUjNKaXRSZWZsZWN0b3IoY29udGV4dCksIC8qIGVuYWJsZVNvdXJjZU1hcHMgKi8gdHJ1ZSk7XG4gICAgcmV0dXJuIHJlc1snJGRlZiddO1xuICB9XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID0gUGljazxcbiAgICBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLFxuICAgIEV4Y2x1ZGU8RXhjbHVkZTxrZXlvZiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLCAncHJlc2VydmVXaGl0ZXNwYWNlcyc+LCAncHJvcE1ldGFkYXRhJz4+O1xuXG5jb25zdCBVU0VfQ0xBU1MgPSBPYmplY3Qua2V5cyh7dXNlQ2xhc3M6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9GQUNUT1JZID0gT2JqZWN0LmtleXMoe3VzZUZhY3Rvcnk6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9WQUxVRSA9IE9iamVjdC5rZXlzKHt1c2VWYWx1ZTogbnVsbH0pWzBdO1xuY29uc3QgVVNFX0VYSVNUSU5HID0gT2JqZWN0LmtleXMoe3VzZUV4aXN0aW5nOiBudWxsfSlbMF07XG5cbmNvbnN0IHdyYXBSZWZlcmVuY2UgPSBmdW5jdGlvbih2YWx1ZTogYW55KTogUjNSZWZlcmVuY2Uge1xuICBjb25zdCB3cmFwcGVkID0gbmV3IFdyYXBwZWROb2RlRXhwcih2YWx1ZSk7XG4gIHJldHVybiB7dmFsdWU6IHdyYXBwZWQsIHR5cGU6IHdyYXBwZWR9O1xufTtcblxuZnVuY3Rpb24gY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKGZhY2FkZTogUjNRdWVyeU1ldGFkYXRhRmFjYWRlKTogUjNRdWVyeU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5mYWNhZGUsXG4gICAgcHJlZGljYXRlOiBBcnJheS5pc0FycmF5KGZhY2FkZS5wcmVkaWNhdGUpID8gZmFjYWRlLnByZWRpY2F0ZSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJlZGljYXRlKSxcbiAgICByZWFkOiBmYWNhZGUucmVhZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGZhY2FkZS5zdGF0aWNcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFF1ZXJ5RGVjbGFyYXRpb25Ub01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhRmFjYWRlKTpcbiAgICBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIHByb3BlcnR5TmFtZTogZGVjbGFyYXRpb24ucHJvcGVydHlOYW1lLFxuICAgIGZpcnN0OiBkZWNsYXJhdGlvbi5maXJzdCA/PyBmYWxzZSxcbiAgICBwcmVkaWNhdGU6IEFycmF5LmlzQXJyYXkoZGVjbGFyYXRpb24ucHJlZGljYXRlKSA/IGRlY2xhcmF0aW9uLnByZWRpY2F0ZSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByZWRpY2F0ZSksXG4gICAgZGVzY2VuZGFudHM6IGRlY2xhcmF0aW9uLmRlc2NlbmRhbnRzID8/IGZhbHNlLFxuICAgIHJlYWQ6IGRlY2xhcmF0aW9uLnJlYWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGRlY2xhcmF0aW9uLnN0YXRpYyA/PyBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IGlucHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlSW5wdXRPdXRwdXRzKGZhY2FkZS5pbnB1dHMgfHwgW10pO1xuICBjb25zdCBvdXRwdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dE91dHB1dHMoZmFjYWRlLm91dHB1dHMgfHwgW10pO1xuICBjb25zdCBwcm9wTWV0YWRhdGEgPSBmYWNhZGUucHJvcE1ldGFkYXRhO1xuICBjb25zdCBpbnB1dHNGcm9tVHlwZTogU3RyaW5nTWFwV2l0aFJlbmFtZSA9IHt9O1xuICBjb25zdCBvdXRwdXRzRnJvbVR5cGU6IFN0cmluZ01hcCA9IHt9O1xuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSW5wdXQoYW5uKSkge1xuICAgICAgICAgIGlucHV0c0Zyb21UeXBlW2ZpZWxkXSA9XG4gICAgICAgICAgICAgIGFubi5iaW5kaW5nUHJvcGVydHlOYW1lID8gW2Fubi5iaW5kaW5nUHJvcGVydHlOYW1lLCBmaWVsZF0gOiBmaWVsZDtcbiAgICAgICAgfSBlbHNlIGlmIChpc091dHB1dChhbm4pKSB7XG4gICAgICAgICAgb3V0cHV0c0Zyb21UeXBlW2ZpZWxkXSA9IGFubi5iaW5kaW5nUHJvcGVydHlOYW1lIHx8IGZpZWxkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSBhcyBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICB0eXBlU291cmNlU3BhbjogZmFjYWRlLnR5cGVTb3VyY2VTcGFuLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgIGhvc3Q6IGV4dHJhY3RIb3N0QmluZGluZ3MoZmFjYWRlLnByb3BNZXRhZGF0YSwgZmFjYWRlLnR5cGVTb3VyY2VTcGFuLCBmYWNhZGUuaG9zdCksXG4gICAgaW5wdXRzOiB7Li4uaW5wdXRzRnJvbU1ldGFkYXRhLCAuLi5pbnB1dHNGcm9tVHlwZX0sXG4gICAgb3V0cHV0czogey4uLm91dHB1dHNGcm9tTWV0YWRhdGEsIC4uLm91dHB1dHNGcm9tVHlwZX0sXG4gICAgcXVlcmllczogZmFjYWRlLnF1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBmYWNhZGUucHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpIDogbnVsbCxcbiAgICB2aWV3UXVlcmllczogZmFjYWRlLnZpZXdRdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIGZ1bGxJbmhlcml0YW5jZTogZmFsc2UsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShcbiAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogZGVjbGFyYXRpb24udHlwZS5uYW1lLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZGVjbGFyYXRpb24udHlwZSksXG4gICAgdHlwZVNvdXJjZVNwYW4sXG4gICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIHNlbGVjdG9yOiBkZWNsYXJhdGlvbi5zZWxlY3RvciA/PyBudWxsLFxuICAgIGlucHV0czogZGVjbGFyYXRpb24uaW5wdXRzID8/IHt9LFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8ge30sXG4gICAgaG9zdDogY29udmVydEhvc3REZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb24uaG9zdCksXG4gICAgcXVlcmllczogKGRlY2xhcmF0aW9uLnF1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHZpZXdRdWVyaWVzOiAoZGVjbGFyYXRpb24udmlld1F1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHByb3ZpZGVyczogZGVjbGFyYXRpb24ucHJvdmlkZXJzICE9PSB1bmRlZmluZWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgIGV4cG9ydEFzOiBkZWNsYXJhdGlvbi5leHBvcnRBcyA/PyBudWxsLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZGVjbGFyYXRpb24udXNlc0luaGVyaXRhbmNlID8/IGZhbHNlLFxuICAgIGxpZmVjeWNsZToge3VzZXNPbkNoYW5nZXM6IGRlY2xhcmF0aW9uLnVzZXNPbkNoYW5nZXMgPz8gZmFsc2V9LFxuICAgIGRlcHM6IG51bGwsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgZnVsbEluaGVyaXRhbmNlOiBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydEhvc3REZWNsYXJhdGlvblRvTWV0YWRhdGEoaG9zdDogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlWydob3N0J10gPSB7fSk6XG4gICAgUjNIb3N0TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIGF0dHJpYnV0ZXM6IGNvbnZlcnRPcGFxdWVWYWx1ZXNUb0V4cHJlc3Npb25zKGhvc3QuYXR0cmlidXRlcyA/PyB7fSksXG4gICAgbGlzdGVuZXJzOiBob3N0Lmxpc3RlbmVycyA/PyB7fSxcbiAgICBwcm9wZXJ0aWVzOiBob3N0LnByb3BlcnRpZXMgPz8ge30sXG4gICAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtcbiAgICAgIGNsYXNzQXR0cjogaG9zdC5jbGFzc0F0dHJpYnV0ZSxcbiAgICAgIHN0eWxlQXR0cjogaG9zdC5zdHlsZUF0dHJpYnV0ZSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0T3BhcXVlVmFsdWVzVG9FeHByZXNzaW9ucyhvYmo6IHtba2V5OiBzdHJpbmddOiBPcGFxdWVWYWx1ZX0pOlxuICAgIHtba2V5OiBzdHJpbmddOiBXcmFwcGVkTm9kZUV4cHI8dW5rbm93bj59IHtcbiAgY29uc3QgcmVzdWx0OiB7W2tleTogc3RyaW5nXTogV3JhcHBlZE5vZGVFeHByPHVua25vd24+fSA9IHt9O1xuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XG4gICAgcmVzdWx0W2tleV0gPSBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtrZXldKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGVjbGFyZUNvbXBvbmVudEZhY2FkZVRvTWV0YWRhdGEoXG4gICAgZGVjbGFyYXRpb246IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZSwgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBzb3VyY2VNYXBVcmw6IHN0cmluZyk6IFIzQ29tcG9uZW50TWV0YWRhdGEge1xuICBjb25zdCB7dGVtcGxhdGUsIGludGVycG9sYXRpb259ID0gcGFyc2VKaXRUZW1wbGF0ZShcbiAgICAgIGRlY2xhcmF0aW9uLnRlbXBsYXRlLnNvdXJjZSwgZGVjbGFyYXRpb24udHlwZS5uYW1lLCBzb3VyY2VNYXBVcmwsXG4gICAgICBkZWNsYXJhdGlvbi5wcmVzZXJ2ZVdoaXRlc3BhY2VzID8/IGZhbHNlLCBkZWNsYXJhdGlvbi5pbnRlcnBvbGF0aW9uKTtcblxuICByZXR1cm4ge1xuICAgIC4uLmNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShkZWNsYXJhdGlvbiwgdHlwZVNvdXJjZVNwYW4pLFxuICAgIHRlbXBsYXRlLFxuICAgIHN0eWxlczogZGVjbGFyYXRpb24uc3R5bGVzID8/IFtdLFxuICAgIGRpcmVjdGl2ZXM6IChkZWNsYXJhdGlvbi5kaXJlY3RpdmVzID8/IFtdKS5tYXAoY29udmVydFVzZWREaXJlY3RpdmVEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHBpcGVzOiBjb252ZXJ0VXNlZFBpcGVzVG9NZXRhZGF0YShkZWNsYXJhdGlvbi5waXBlcyksXG4gICAgdmlld1Byb3ZpZGVyczogZGVjbGFyYXRpb24udmlld1Byb3ZpZGVycyAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi52aWV3UHJvdmlkZXJzKSA6XG4gICAgICAgIG51bGwsXG4gICAgYW5pbWF0aW9uczogZGVjbGFyYXRpb24uYW5pbWF0aW9ucyAhPT0gdW5kZWZpbmVkID8gbmV3IFdyYXBwZWROb2RlRXhwcihkZWNsYXJhdGlvbi5hbmltYXRpb25zKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICBjaGFuZ2VEZXRlY3Rpb246IGRlY2xhcmF0aW9uLmNoYW5nZURldGVjdGlvbiA/PyBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0LFxuICAgIGVuY2Fwc3VsYXRpb246IGRlY2xhcmF0aW9uLmVuY2Fwc3VsYXRpb24gPz8gVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsXG4gICAgaW50ZXJwb2xhdGlvbixcbiAgICBkZWNsYXJhdGlvbkxpc3RFbWl0TW9kZTogRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuQ2xvc3VyZVJlc29sdmVkLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRVc2VkRGlyZWN0aXZlRGVjbGFyYXRpb25Ub01ldGFkYXRhKFxuICAgIGRlY2xhcmF0aW9uOiBOb25OdWxsYWJsZTxSM0RlY2xhcmVDb21wb25lbnRGYWNhZGVbJ2RpcmVjdGl2ZXMnXT5bbnVtYmVyXSk6XG4gICAgUjNVc2VkRGlyZWN0aXZlTWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIHNlbGVjdG9yOiBkZWNsYXJhdGlvbi5zZWxlY3RvcixcbiAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIGlucHV0czogZGVjbGFyYXRpb24uaW5wdXRzID8/IFtdLFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8gW10sXG4gICAgZXhwb3J0QXM6IGRlY2xhcmF0aW9uLmV4cG9ydEFzID8/IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRVc2VkUGlwZXNUb01ldGFkYXRhKGRlY2xhcmVkUGlwZXM6IFIzRGVjbGFyZUNvbXBvbmVudEZhY2FkZVsncGlwZXMnXSk6XG4gICAgTWFwPHN0cmluZywgRXhwcmVzc2lvbj4ge1xuICBjb25zdCBwaXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBFeHByZXNzaW9uPigpO1xuICBpZiAoZGVjbGFyZWRQaXBlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHBpcGVzO1xuICB9XG5cbiAgZm9yIChjb25zdCBwaXBlTmFtZSBvZiBPYmplY3Qua2V5cyhkZWNsYXJlZFBpcGVzKSkge1xuICAgIGNvbnN0IHBpcGVUeXBlID0gZGVjbGFyZWRQaXBlc1twaXBlTmFtZV07XG4gICAgcGlwZXMuc2V0KHBpcGVOYW1lLCBuZXcgV3JhcHBlZE5vZGVFeHByKHBpcGVUeXBlKSk7XG4gIH1cbiAgcmV0dXJuIHBpcGVzO1xufVxuXG5mdW5jdGlvbiBwYXJzZUppdFRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuLFxuICAgIGludGVycG9sYXRpb246IFtzdHJpbmcsIHN0cmluZ118dW5kZWZpbmVkKSB7XG4gIGNvbnN0IGludGVycG9sYXRpb25Db25maWcgPVxuICAgICAgaW50ZXJwb2xhdGlvbiA/IEludGVycG9sYXRpb25Db25maWcuZnJvbUFycmF5KGludGVycG9sYXRpb24pIDogREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRztcbiAgLy8gUGFyc2UgdGhlIHRlbXBsYXRlIGFuZCBjaGVjayBmb3IgZXJyb3JzLlxuICBjb25zdCBwYXJzZWQgPSBwYXJzZVRlbXBsYXRlKFxuICAgICAgdGVtcGxhdGUsIHNvdXJjZU1hcFVybCwge3ByZXNlcnZlV2hpdGVzcGFjZXM6IHByZXNlcnZlV2hpdGVzcGFjZXMsIGludGVycG9sYXRpb25Db25maWd9KTtcbiAgaWYgKHBhcnNlZC5lcnJvcnMgIT09IG51bGwpIHtcbiAgICBjb25zdCBlcnJvcnMgPSBwYXJzZWQuZXJyb3JzLm1hcChlcnIgPT4gZXJyLnRvU3RyaW5nKCkpLmpvaW4oJywgJyk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvcnMgZHVyaW5nIEpJVCBjb21waWxhdGlvbiBvZiB0ZW1wbGF0ZSBmb3IgJHt0eXBlTmFtZX06ICR7ZXJyb3JzfWApO1xuICB9XG4gIHJldHVybiB7dGVtcGxhdGU6IHBhcnNlZCwgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvbkNvbmZpZ307XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID1cbiAgICBQaWNrPFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIEV4Y2x1ZGU8a2V5b2YgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuZnVuY3Rpb24gd3JhcEV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBXcmFwcGVkTm9kZUV4cHI8YW55Pnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb3ZpZGVkSW4ocHJvdmlkZWRJbjogVHlwZXxzdHJpbmd8bnVsbHx1bmRlZmluZWQpOiBFeHByZXNzaW9uIHtcbiAgaWYgKHByb3ZpZGVkSW4gPT0gbnVsbCB8fCB0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gbmV3IExpdGVyYWxFeHByKHByb3ZpZGVkSW4pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKHByb3ZpZGVkSW4pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBsZXQgdG9rZW5FeHByO1xuICBpZiAoZmFjYWRlLnRva2VuID09PSBudWxsKSB7XG4gICAgdG9rZW5FeHByID0gbmV3IExpdGVyYWxFeHByKG51bGwpO1xuICB9IGVsc2UgaWYgKGZhY2FkZS5yZXNvbHZlZCA9PT0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZSkge1xuICAgIHRva2VuRXhwciA9IG5ldyBMaXRlcmFsRXhwcihmYWNhZGUudG9rZW4pO1xuICB9IGVsc2Uge1xuICAgIHRva2VuRXhwciA9IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnRva2VuKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHRva2VuOiB0b2tlbkV4cHIsXG4gICAgYXR0cmlidXRlOiBudWxsLFxuICAgIHJlc29sdmVkOiBmYWNhZGUucmVzb2x2ZWQsXG4gICAgaG9zdDogZmFjYWRlLmhvc3QsXG4gICAgb3B0aW9uYWw6IGZhY2FkZS5vcHRpb25hbCxcbiAgICBzZWxmOiBmYWNhZGUuc2VsZixcbiAgICBza2lwU2VsZjogZmFjYWRlLnNraXBTZWxmLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGVzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdfG51bGx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfG51bGwge1xuICByZXR1cm4gZmFjYWRlcyA9PSBudWxsID8gbnVsbCA6IGZhY2FkZXMubWFwKGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YSk7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RIb3N0QmluZGluZ3MoXG4gICAgcHJvcE1ldGFkYXRhOiB7W2tleTogc3RyaW5nXTogYW55W119LCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgaG9zdD86IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgLy8gRmlyc3QgcGFyc2UgdGhlIGRlY2xhcmF0aW9ucyBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgY29uc3QgYmluZGluZ3MgPSBwYXJzZUhvc3RCaW5kaW5ncyhob3N0IHx8IHt9KTtcblxuICAvLyBBZnRlciB0aGF0IGNoZWNrIGhvc3QgYmluZGluZ3MgZm9yIGVycm9yc1xuICBjb25zdCBlcnJvcnMgPSB2ZXJpZnlIb3N0QmluZGluZ3MoYmluZGluZ3MsIHNvdXJjZVNwYW4pO1xuICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMubWFwKChlcnJvcjogUGFyc2VFcnJvcikgPT4gZXJyb3IubXNnKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICAvLyBOZXh0LCBsb29wIG92ZXIgdGhlIHByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCwgbG9va2luZyBmb3IgQEhvc3RCaW5kaW5nIGFuZCBASG9zdExpc3RlbmVyLlxuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSG9zdEJpbmRpbmcoYW5uKSkge1xuICAgICAgICAgIC8vIFNpbmNlIHRoaXMgaXMgYSBkZWNvcmF0b3IsIHdlIGtub3cgdGhhdCB0aGUgdmFsdWUgaXMgYSBjbGFzcyBtZW1iZXIuIEFsd2F5cyBhY2Nlc3MgaXRcbiAgICAgICAgICAvLyB0aHJvdWdoIGB0aGlzYCBzbyB0aGF0IGZ1cnRoZXIgZG93biB0aGUgbGluZSBpdCBjYW4ndCBiZSBjb25mdXNlZCBmb3IgYSBsaXRlcmFsIHZhbHVlXG4gICAgICAgICAgLy8gKGUuZy4gaWYgdGhlcmUncyBhIHByb3BlcnR5IGNhbGxlZCBgdHJ1ZWApLlxuICAgICAgICAgIGJpbmRpbmdzLnByb3BlcnRpZXNbYW5uLmhvc3RQcm9wZXJ0eU5hbWUgfHwgZmllbGRdID1cbiAgICAgICAgICAgICAgZ2V0U2FmZVByb3BlcnR5QWNjZXNzU3RyaW5nKCd0aGlzJywgZmllbGQpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzSG9zdExpc3RlbmVyKGFubikpIHtcbiAgICAgICAgICBiaW5kaW5ncy5saXN0ZW5lcnNbYW5uLmV2ZW50TmFtZSB8fCBmaWVsZF0gPSBgJHtmaWVsZH0oJHsoYW5uLmFyZ3MgfHwgW10pLmpvaW4oJywnKX0pYDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJpbmRpbmdzO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RCaW5kaW5nKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBIb3N0QmluZGluZyB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RCaW5kaW5nJztcbn1cblxuZnVuY3Rpb24gaXNIb3N0TGlzdGVuZXIodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RMaXN0ZW5lciB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RMaXN0ZW5lcic7XG59XG5cblxuZnVuY3Rpb24gaXNJbnB1dCh2YWx1ZTogYW55KTogdmFsdWUgaXMgSW5wdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdJbnB1dCc7XG59XG5cbmZ1bmN0aW9uIGlzT3V0cHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBPdXRwdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdPdXRwdXQnO1xufVxuXG5mdW5jdGlvbiBwYXJzZUlucHV0T3V0cHV0cyh2YWx1ZXM6IHN0cmluZ1tdKTogU3RyaW5nTWFwIHtcbiAgcmV0dXJuIHZhbHVlcy5yZWR1Y2UoKG1hcCwgdmFsdWUpID0+IHtcbiAgICBjb25zdCBbZmllbGQsIHByb3BlcnR5XSA9IHZhbHVlLnNwbGl0KCcsJykubWFwKHBpZWNlID0+IHBpZWNlLnRyaW0oKSk7XG4gICAgbWFwW2ZpZWxkXSA9IHByb3BlcnR5IHx8IGZpZWxkO1xuICAgIHJldHVybiBtYXA7XG4gIH0sIHt9IGFzIFN0cmluZ01hcCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdWJsaXNoRmFjYWRlKGdsb2JhbDogYW55KSB7XG4gIGNvbnN0IG5nOiBFeHBvcnRlZENvbXBpbGVyRmFjYWRlID0gZ2xvYmFsLm5nIHx8IChnbG9iYWwubmcgPSB7fSk7XG4gIG5nLsm1Y29tcGlsZXJGYWNhZGUgPSBuZXcgQ29tcGlsZXJGYWNhZGVJbXBsKCk7XG59XG4iXX0=