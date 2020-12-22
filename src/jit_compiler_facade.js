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
        define("@angular/compiler/src/jit_compiler_facade", ["require", "exports", "tslib", "@angular/compiler/src/constant_pool", "@angular/compiler/src/identifiers", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/output_jit", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_jit", "@angular/compiler/src/render3/r3_module_compiler", "@angular/compiler/src/render3/r3_pipe_compiler", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/resource_loader", "@angular/compiler/src/schema/dom_element_schema_registry"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.publishFacade = exports.CompilerFacadeImpl = void 0;
    var tslib_1 = require("tslib");
    var constant_pool_1 = require("@angular/compiler/src/constant_pool");
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
            // The ConstantPool is a requirement of the JIT'er.
            var constantPool = new constant_pool_1.ConstantPool();
            var interpolationConfig = facade.interpolation ?
                interpolation_config_1.InterpolationConfig.fromArray(facade.interpolation) :
                interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG;
            // Parse the template and check for errors.
            var template = template_1.parseTemplate(facade.template, sourceMapUrl, { preserveWhitespaces: facade.preserveWhitespaces, interpolationConfig: interpolationConfig });
            if (template.errors !== null) {
                var errors = template.errors.map(function (err) { return err.toString(); }).join(', ');
                throw new Error("Errors during JIT compilation of template for " + facade.name + ": " + errors);
            }
            // Compile the component metadata, including template, into an expression.
            // TODO(alxhub): implement inputs, outputs, queries, etc.
            var metadata = tslib_1.__assign(tslib_1.__assign(tslib_1.__assign({}, facade), convertDirectiveFacadeToMetadata(facade)), { selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(), template: template, wrapDirectivesAndPipesInClosure: false, styles: tslib_1.__spread(facade.styles, template.styles), encapsulation: facade.encapsulation, interpolation: interpolationConfig, changeDetection: facade.changeDetection, animations: facade.animations != null ? new output_ast_1.WrappedNodeExpr(facade.animations) : null, viewProviders: facade.viewProviders != null ? new output_ast_1.WrappedNodeExpr(facade.viewProviders) :
                    null, relativeContextFilePath: '', i18nUseExternalIds: true });
            var res = compiler_1.compileComponentFromMetadata(metadata, constantPool, template_1.makeBindingParser(interpolationConfig));
            var jitExpressionSourceMap = "ng:///" + facade.name + ".js";
            return this.jitExpression(res.expression, angularCoreEnv, jitExpressionSourceMap, constantPool.statements);
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
                        bindings.properties[ann.hostPropertyName || field] = field;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFJSCxxRUFBNkM7SUFFN0MsaUVBQTBDO0lBQzFDLHFGQUEwRDtJQUMxRCw2RkFBbUc7SUFDbkcsc0VBQXNIO0lBQ3RILHNFQUFpRDtJQUNqRCwrREFBOEU7SUFDOUUsdUVBQTZIO0lBQzdILCtEQUFnRDtJQUNoRCx1RkFBc0g7SUFDdEgsbUZBQW1GO0lBR25GLHdFQUE4SjtJQUM5Six3RUFBeUU7SUFDekUseUVBQWlEO0lBQ2pELHdHQUE4RTtJQUU5RTtRQU1FLDRCQUFvQixZQUFpQztZQUFqQyw2QkFBQSxFQUFBLG1CQUFtQix5QkFBWSxFQUFFO1lBQWpDLGlCQUFZLEdBQVosWUFBWSxDQUFxQjtZQUxyRCw2QkFBd0IsR0FBRyxxQ0FBK0IsQ0FBQztZQUMzRCxvQkFBZSxHQUFHLDRCQUFzQixDQUFDO1lBQ3pDLG1CQUFjLEdBQUcsZ0NBQWMsQ0FBQztZQUN4QiwwQkFBcUIsR0FBRyxJQUFJLHNEQUF3QixFQUFFLENBQUM7UUFFUCxDQUFDO1FBRXpELHdDQUFXLEdBQVgsVUFBWSxjQUErQixFQUFFLFlBQW9CLEVBQUUsTUFBNEI7WUFFN0YsSUFBTSxRQUFRLEdBQW1CO2dCQUMvQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7Z0JBQ2pCLElBQUksRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDaEMsWUFBWSxFQUFFLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUM5QyxpQkFBaUIsRUFBRSxNQUFNLENBQUMsaUJBQWlCO2dCQUMzQyxJQUFJLEVBQUUsZ0NBQWdDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFD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QUcsRUFBRSxDQUFDLENBQUM7UUFDakUsRUFBRSxDQUFDLGVBQWUsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7SUFDaEQsQ0FBQztJQUhELHNDQUdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtDb21waWxlckZhY2FkZSwgQ29yZUVudmlyb25tZW50LCBFeHBvcnRlZENvbXBpbGVyRmFjYWRlLCBPcGFxdWVWYWx1ZSwgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlLCBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhRmFjYWRlLCBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSwgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUsIFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlLCBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUsIFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSwgUjNQaXBlTWV0YWRhdGFGYWNhZGUsIFIzUXVlcnlNZXRhZGF0YUZhY2FkZSwgU3RyaW5nTWFwLCBTdHJpbmdNYXBXaXRoUmVuYW1lfSBmcm9tICcuL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UnO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0hvc3RCaW5kaW5nLCBIb3N0TGlzdGVuZXIsIElucHV0LCBPdXRwdXQsIFR5cGV9IGZyb20gJy4vY29yZSc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmltcG9ydCB7Y29tcGlsZUluamVjdGFibGV9IGZyb20gJy4vaW5qZWN0YWJsZV9jb21waWxlcl8yJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtEZWNsYXJlVmFyU3RtdCwgRXhwcmVzc2lvbiwgTGl0ZXJhbEV4cHIsIFN0YXRlbWVudCwgU3RtdE1vZGlmaWVyLCBXcmFwcGVkTm9kZUV4cHJ9IGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtKaXRFdmFsdWF0b3J9IGZyb20gJy4vb3V0cHV0L291dHB1dF9qaXQnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW4sIHIzSml0VHlwZVNvdXJjZVNwYW59IGZyb20gJy4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2NvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIFIzRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0ZhY3RvcnlUYXJnZXQsIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZX0gZnJvbSAnLi9yZW5kZXIzL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtSM0ppdFJlZmxlY3Rvcn0gZnJvbSAnLi9yZW5kZXIzL3IzX2ppdCc7XG5pbXBvcnQge2NvbXBpbGVJbmplY3RvciwgY29tcGlsZU5nTW9kdWxlLCBSM0luamVjdG9yTWV0YWRhdGEsIFIzTmdNb2R1bGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhLCBSM1BpcGVNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXInO1xuaW1wb3J0IHtSM1JlZmVyZW5jZX0gZnJvbSAnLi9yZW5kZXIzL3V0aWwnO1xuaW1wb3J0IHtSM0NvbXBvbmVudE1ldGFkYXRhLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvdmlldy9hcGknO1xuaW1wb3J0IHtjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhLCBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBQYXJzZWRIb3N0QmluZGluZ3MsIHBhcnNlSG9zdEJpbmRpbmdzLCB2ZXJpZnlIb3N0QmluZGluZ3N9IGZyb20gJy4vcmVuZGVyMy92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7bWFrZUJpbmRpbmdQYXJzZXIsIHBhcnNlVGVtcGxhdGV9IGZyb20gJy4vcmVuZGVyMy92aWV3L3RlbXBsYXRlJztcbmltcG9ydCB7UmVzb3VyY2VMb2FkZXJ9IGZyb20gJy4vcmVzb3VyY2VfbG9hZGVyJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuXG5leHBvcnQgY2xhc3MgQ29tcGlsZXJGYWNhZGVJbXBsIGltcGxlbWVudHMgQ29tcGlsZXJGYWNhZGUge1xuICBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUgPSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUgYXMgYW55O1xuICBSM0ZhY3RvcnlUYXJnZXQgPSBSM0ZhY3RvcnlUYXJnZXQgYXMgYW55O1xuICBSZXNvdXJjZUxvYWRlciA9IFJlc291cmNlTG9hZGVyO1xuICBwcml2YXRlIGVsZW1lbnRTY2hlbWFSZWdpc3RyeSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGppdEV2YWx1YXRvciA9IG5ldyBKaXRFdmFsdWF0b3IoKSkge31cblxuICBjb21waWxlUGlwZShhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgZmFjYWRlOiBSM1BpcGVNZXRhZGF0YUZhY2FkZSk6XG4gICAgICBhbnkge1xuICAgIGNvbnN0IG1ldGFkYXRhOiBSM1BpcGVNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogd3JhcFJlZmVyZW5jZShmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IGZhY2FkZS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgIGRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS5kZXBzKSxcbiAgICAgIHBpcGVOYW1lOiBmYWNhZGUucGlwZU5hbWUsXG4gICAgICBwdXJlOiBmYWNhZGUucHVyZSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVQaXBlRnJvbU1ldGFkYXRhKG1ldGFkYXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3Qge2V4cHJlc3Npb24sIHN0YXRlbWVudHN9ID0gY29tcGlsZUluamVjdGFibGUoe1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICB0eXBlQXJndW1lbnRDb3VudDogZmFjYWRlLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgcHJvdmlkZWRJbjogY29tcHV0ZVByb3ZpZGVkSW4oZmFjYWRlLnByb3ZpZGVkSW4pLFxuICAgICAgdXNlQ2xhc3M6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgVVNFX0NMQVNTKSxcbiAgICAgIHVzZUZhY3Rvcnk6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgVVNFX0ZBQ1RPUlkpLFxuICAgICAgdXNlVmFsdWU6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgVVNFX1ZBTFVFKSxcbiAgICAgIHVzZUV4aXN0aW5nOiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9FWElTVElORyksXG4gICAgICB1c2VyRGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLnVzZXJEZXBzKSB8fCB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKGV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIHN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUluamVjdG9yKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzSW5qZWN0b3JNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNJbmplY3Rvck1ldGFkYXRhID0ge1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBkZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGUuZGVwcyksXG4gICAgICBwcm92aWRlcnM6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnByb3ZpZGVycyksXG4gICAgICBpbXBvcnRzOiBmYWNhZGUuaW1wb3J0cy5tYXAoaSA9PiBuZXcgV3JhcHBlZE5vZGVFeHByKGkpKSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVJbmplY3RvcihtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCByZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlTmdNb2R1bGUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM05nTW9kdWxlTWV0YWRhdGEgPSB7XG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKGZhY2FkZS50eXBlKSxcbiAgICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBhZGphY2VudFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgYm9vdHN0cmFwOiBmYWNhZGUuYm9vdHN0cmFwLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGRlY2xhcmF0aW9uczogZmFjYWRlLmRlY2xhcmF0aW9ucy5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBpbXBvcnRzOiBmYWNhZGUuaW1wb3J0cy5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBleHBvcnRzOiBmYWNhZGUuZXhwb3J0cy5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBlbWl0SW5saW5lOiB0cnVlLFxuICAgICAgY29udGFpbnNGb3J3YXJkRGVjbHM6IGZhbHNlLFxuICAgICAgc2NoZW1hczogZmFjYWRlLnNjaGVtYXMgPyBmYWNhZGUuc2NoZW1hcy5tYXAod3JhcFJlZmVyZW5jZSkgOiBudWxsLFxuICAgICAgaWQ6IGZhY2FkZS5pZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmlkKSA6IG51bGwsXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlTmdNb2R1bGUobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZURpcmVjdGl2ZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhID0gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKTtcbiAgICByZXR1cm4gdGhpcy5jb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgbWV0YSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlRGVjbGFyYXRpb24oXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVEaXJlY3RpdmVGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHR5cGVTb3VyY2VTcGFuID1cbiAgICAgICAgdGhpcy5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0RpcmVjdGl2ZScsIGRlY2xhcmF0aW9uLnR5cGUubmFtZSwgc291cmNlTWFwVXJsKTtcbiAgICBjb25zdCBtZXRhID0gY29udmVydERlY2xhcmVEaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGRlY2xhcmF0aW9uLCB0eXBlU291cmNlU3Bhbik7XG4gICAgcmV0dXJuIHRoaXMuY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhKGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIG1ldGEpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGEoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IGFueSB7XG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuICAgIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICAvLyBUaGUgQ29uc3RhbnRQb29sIGlzIGEgcmVxdWlyZW1lbnQgb2YgdGhlIEpJVCdlci5cbiAgICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKCk7XG5cbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uQ29uZmlnID0gZmFjYWRlLmludGVycG9sYXRpb24gP1xuICAgICAgICBJbnRlcnBvbGF0aW9uQ29uZmlnLmZyb21BcnJheShmYWNhZGUuaW50ZXJwb2xhdGlvbikgOlxuICAgICAgICBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHO1xuICAgIC8vIFBhcnNlIHRoZSB0ZW1wbGF0ZSBhbmQgY2hlY2sgZm9yIGVycm9ycy5cbiAgICBjb25zdCB0ZW1wbGF0ZSA9IHBhcnNlVGVtcGxhdGUoXG4gICAgICAgIGZhY2FkZS50ZW1wbGF0ZSwgc291cmNlTWFwVXJsLFxuICAgICAgICB7cHJlc2VydmVXaGl0ZXNwYWNlczogZmFjYWRlLnByZXNlcnZlV2hpdGVzcGFjZXMsIGludGVycG9sYXRpb25Db25maWd9KTtcbiAgICBpZiAodGVtcGxhdGUuZXJyb3JzICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBlcnJvcnMgPSB0ZW1wbGF0ZS5lcnJvcnMubWFwKGVyciA9PiBlcnIudG9TdHJpbmcoKSkuam9pbignLCAnKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3JzIGR1cmluZyBKSVQgY29tcGlsYXRpb24gb2YgdGVtcGxhdGUgZm9yICR7ZmFjYWRlLm5hbWV9OiAke2Vycm9yc31gKTtcbiAgICB9XG5cbiAgICAvLyBDb21waWxlIHRoZSBjb21wb25lbnQgbWV0YWRhdGEsIGluY2x1ZGluZyB0ZW1wbGF0ZSwgaW50byBhbiBleHByZXNzaW9uLlxuICAgIC8vIFRPRE8oYWx4aHViKTogaW1wbGVtZW50IGlucHV0cywgb3V0cHV0cywgcXVlcmllcywgZXRjLlxuICAgIGNvbnN0IG1ldGFkYXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhID0ge1xuICAgICAgLi4uZmFjYWRlIGFzIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlLFxuICAgICAgLi4uY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKSxcbiAgICAgIHNlbGVjdG9yOiBmYWNhZGUuc2VsZWN0b3IgfHwgdGhpcy5lbGVtZW50U2NoZW1hUmVnaXN0cnkuZ2V0RGVmYXVsdENvbXBvbmVudEVsZW1lbnROYW1lKCksXG4gICAgICB0ZW1wbGF0ZSxcbiAgICAgIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGZhbHNlLFxuICAgICAgc3R5bGVzOiBbLi4uZmFjYWRlLnN0eWxlcywgLi4udGVtcGxhdGUuc3R5bGVzXSxcbiAgICAgIGVuY2Fwc3VsYXRpb246IGZhY2FkZS5lbmNhcHN1bGF0aW9uIGFzIGFueSxcbiAgICAgIGludGVycG9sYXRpb246IGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBjaGFuZ2VEZXRlY3Rpb246IGZhY2FkZS5jaGFuZ2VEZXRlY3Rpb24sXG4gICAgICBhbmltYXRpb25zOiBmYWNhZGUuYW5pbWF0aW9ucyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuYW5pbWF0aW9ucykgOiBudWxsLFxuICAgICAgdmlld1Byb3ZpZGVyczogZmFjYWRlLnZpZXdQcm92aWRlcnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnZpZXdQcm92aWRlcnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICAgICAgbWV0YWRhdGEsIGNvbnN0YW50UG9vbCwgbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZykpO1xuICAgIGNvbnN0IGppdEV4cHJlc3Npb25Tb3VyY2VNYXAgPSBgbmc6Ly8vJHtmYWNhZGUubmFtZX0uanNgO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgaml0RXhwcmVzc2lvblNvdXJjZU1hcCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUZhY3RvcnkoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUpIHtcbiAgICBjb25zdCBmYWN0b3J5UmVzID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgICB0eXBlOiB3cmFwUmVmZXJlbmNlKG1ldGEudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIobWV0YS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkobWV0YS5kZXBzKSxcbiAgICAgIGluamVjdEZuOiBtZXRhLmluamVjdEZuID09PSAnZGlyZWN0aXZlSW5qZWN0JyA/IElkZW50aWZpZXJzLmRpcmVjdGl2ZUluamVjdCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJZGVudGlmaWVycy5pbmplY3QsXG4gICAgICB0YXJnZXQ6IG1ldGEudGFyZ2V0LFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIGZhY3RvcnlSZXMuZmFjdG9yeSwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgZmFjdG9yeVJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNyZWF0ZVBhcnNlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gcjNKaXRUeXBlU291cmNlU3BhbihraW5kLCB0eXBlTmFtZSwgc291cmNlVXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBKSVQgY29tcGlsZXMgYW4gZXhwcmVzc2lvbiBhbmQgcmV0dXJucyB0aGUgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGF0IGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBwYXJhbSBkZWYgdGhlIGRlZmluaXRpb24gd2hpY2ggd2lsbCBiZSBjb21waWxlZCBhbmQgZXhlY3V0ZWQgdG8gZ2V0IHRoZSB2YWx1ZSB0byBwYXRjaFxuICAgKiBAcGFyYW0gY29udGV4dCBhbiBvYmplY3QgbWFwIG9mIEBhbmd1bGFyL2NvcmUgc3ltYm9sIG5hbWVzIHRvIHN5bWJvbHMgd2hpY2ggd2lsbCBiZSBhdmFpbGFibGVcbiAgICogaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHNvdXJjZVVybCBhIFVSTCB0byB1c2UgZm9yIHRoZSBzb3VyY2UgbWFwIG9mIHRoZSBjb21waWxlZCBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBwcmVTdGF0ZW1lbnRzIGEgY29sbGVjdGlvbiBvZiBzdGF0ZW1lbnRzIHRoYXQgc2hvdWxkIGJlIGV2YWx1YXRlZCBiZWZvcmUgdGhlIGV4cHJlc3Npb24uXG4gICAqL1xuICBwcml2YXRlIGppdEV4cHJlc3Npb24oXG4gICAgICBkZWY6IEV4cHJlc3Npb24sIGNvbnRleHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBzb3VyY2VVcmw6IHN0cmluZyxcbiAgICAgIHByZVN0YXRlbWVudHM6IFN0YXRlbWVudFtdKTogYW55IHtcbiAgICAvLyBUaGUgQ29uc3RhbnRQb29sIG1heSBjb250YWluIFN0YXRlbWVudHMgd2hpY2ggZGVjbGFyZSB2YXJpYWJsZXMgdXNlZCBpbiB0aGUgZmluYWwgZXhwcmVzc2lvbi5cbiAgICAvLyBUaGVyZWZvcmUsIGl0cyBzdGF0ZW1lbnRzIG5lZWQgdG8gcHJlY2VkZSB0aGUgYWN0dWFsIEpJVCBvcGVyYXRpb24uIFRoZSBmaW5hbCBzdGF0ZW1lbnQgaXMgYVxuICAgIC8vIGRlY2xhcmF0aW9uIG9mICRkZWYgd2hpY2ggaXMgc2V0IHRvIHRoZSBleHByZXNzaW9uIGJlaW5nIGNvbXBpbGVkLlxuICAgIGNvbnN0IHN0YXRlbWVudHM6IFN0YXRlbWVudFtdID0gW1xuICAgICAgLi4ucHJlU3RhdGVtZW50cyxcbiAgICAgIG5ldyBEZWNsYXJlVmFyU3RtdCgnJGRlZicsIGRlZiwgdW5kZWZpbmVkLCBbU3RtdE1vZGlmaWVyLkV4cG9ydGVkXSksXG4gICAgXTtcblxuICAgIGNvbnN0IHJlcyA9IHRoaXMuaml0RXZhbHVhdG9yLmV2YWx1YXRlU3RhdGVtZW50cyhcbiAgICAgICAgc291cmNlVXJsLCBzdGF0ZW1lbnRzLCBuZXcgUjNKaXRSZWZsZWN0b3IoY29udGV4dCksIC8qIGVuYWJsZVNvdXJjZU1hcHMgKi8gdHJ1ZSk7XG4gICAgcmV0dXJuIHJlc1snJGRlZiddO1xuICB9XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID0gUGljazxcbiAgICBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLFxuICAgIEV4Y2x1ZGU8RXhjbHVkZTxrZXlvZiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLCAncHJlc2VydmVXaGl0ZXNwYWNlcyc+LCAncHJvcE1ldGFkYXRhJz4+O1xuXG5jb25zdCBVU0VfQ0xBU1MgPSBPYmplY3Qua2V5cyh7dXNlQ2xhc3M6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9GQUNUT1JZID0gT2JqZWN0LmtleXMoe3VzZUZhY3Rvcnk6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9WQUxVRSA9IE9iamVjdC5rZXlzKHt1c2VWYWx1ZTogbnVsbH0pWzBdO1xuY29uc3QgVVNFX0VYSVNUSU5HID0gT2JqZWN0LmtleXMoe3VzZUV4aXN0aW5nOiBudWxsfSlbMF07XG5cbmNvbnN0IHdyYXBSZWZlcmVuY2UgPSBmdW5jdGlvbih2YWx1ZTogYW55KTogUjNSZWZlcmVuY2Uge1xuICBjb25zdCB3cmFwcGVkID0gbmV3IFdyYXBwZWROb2RlRXhwcih2YWx1ZSk7XG4gIHJldHVybiB7dmFsdWU6IHdyYXBwZWQsIHR5cGU6IHdyYXBwZWR9O1xufTtcblxuZnVuY3Rpb24gY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKGZhY2FkZTogUjNRdWVyeU1ldGFkYXRhRmFjYWRlKTogUjNRdWVyeU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5mYWNhZGUsXG4gICAgcHJlZGljYXRlOiBBcnJheS5pc0FycmF5KGZhY2FkZS5wcmVkaWNhdGUpID8gZmFjYWRlLnByZWRpY2F0ZSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJlZGljYXRlKSxcbiAgICByZWFkOiBmYWNhZGUucmVhZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGZhY2FkZS5zdGF0aWNcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFF1ZXJ5RGVjbGFyYXRpb25Ub01ldGFkYXRhKGRlY2xhcmF0aW9uOiBSM0RlY2xhcmVRdWVyeU1ldGFkYXRhRmFjYWRlKTpcbiAgICBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIHByb3BlcnR5TmFtZTogZGVjbGFyYXRpb24ucHJvcGVydHlOYW1lLFxuICAgIGZpcnN0OiBkZWNsYXJhdGlvbi5maXJzdCA/PyBmYWxzZSxcbiAgICBwcmVkaWNhdGU6IEFycmF5LmlzQXJyYXkoZGVjbGFyYXRpb24ucHJlZGljYXRlKSA/IGRlY2xhcmF0aW9uLnByZWRpY2F0ZSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByZWRpY2F0ZSksXG4gICAgZGVzY2VuZGFudHM6IGRlY2xhcmF0aW9uLmRlc2NlbmRhbnRzID8/IGZhbHNlLFxuICAgIHJlYWQ6IGRlY2xhcmF0aW9uLnJlYWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGRlY2xhcmF0aW9uLnN0YXRpYyA/PyBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IGlucHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlSW5wdXRPdXRwdXRzKGZhY2FkZS5pbnB1dHMgfHwgW10pO1xuICBjb25zdCBvdXRwdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dE91dHB1dHMoZmFjYWRlLm91dHB1dHMgfHwgW10pO1xuICBjb25zdCBwcm9wTWV0YWRhdGEgPSBmYWNhZGUucHJvcE1ldGFkYXRhO1xuICBjb25zdCBpbnB1dHNGcm9tVHlwZTogU3RyaW5nTWFwV2l0aFJlbmFtZSA9IHt9O1xuICBjb25zdCBvdXRwdXRzRnJvbVR5cGU6IFN0cmluZ01hcCA9IHt9O1xuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSW5wdXQoYW5uKSkge1xuICAgICAgICAgIGlucHV0c0Zyb21UeXBlW2ZpZWxkXSA9XG4gICAgICAgICAgICAgIGFubi5iaW5kaW5nUHJvcGVydHlOYW1lID8gW2Fubi5iaW5kaW5nUHJvcGVydHlOYW1lLCBmaWVsZF0gOiBmaWVsZDtcbiAgICAgICAgfSBlbHNlIGlmIChpc091dHB1dChhbm4pKSB7XG4gICAgICAgICAgb3V0cHV0c0Zyb21UeXBlW2ZpZWxkXSA9IGFubi5iaW5kaW5nUHJvcGVydHlOYW1lIHx8IGZpZWxkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSBhcyBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICB0eXBlU291cmNlU3BhbjogZmFjYWRlLnR5cGVTb3VyY2VTcGFuLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZmFjYWRlLnR5cGUpLFxuICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgIGhvc3Q6IGV4dHJhY3RIb3N0QmluZGluZ3MoZmFjYWRlLnByb3BNZXRhZGF0YSwgZmFjYWRlLnR5cGVTb3VyY2VTcGFuLCBmYWNhZGUuaG9zdCksXG4gICAgaW5wdXRzOiB7Li4uaW5wdXRzRnJvbU1ldGFkYXRhLCAuLi5pbnB1dHNGcm9tVHlwZX0sXG4gICAgb3V0cHV0czogey4uLm91dHB1dHNGcm9tTWV0YWRhdGEsIC4uLm91dHB1dHNGcm9tVHlwZX0sXG4gICAgcXVlcmllczogZmFjYWRlLnF1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBmYWNhZGUucHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpIDogbnVsbCxcbiAgICB2aWV3UXVlcmllczogZmFjYWRlLnZpZXdRdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIGZ1bGxJbmhlcml0YW5jZTogZmFsc2UsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnREZWNsYXJlRGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShcbiAgICBkZWNsYXJhdGlvbjogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogZGVjbGFyYXRpb24udHlwZS5uYW1lLFxuICAgIHR5cGU6IHdyYXBSZWZlcmVuY2UoZGVjbGFyYXRpb24udHlwZSksXG4gICAgdHlwZVNvdXJjZVNwYW4sXG4gICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnR5cGUpLFxuICAgIHNlbGVjdG9yOiBkZWNsYXJhdGlvbi5zZWxlY3RvciA/PyBudWxsLFxuICAgIGlucHV0czogZGVjbGFyYXRpb24uaW5wdXRzID8/IHt9LFxuICAgIG91dHB1dHM6IGRlY2xhcmF0aW9uLm91dHB1dHMgPz8ge30sXG4gICAgaG9zdDogY29udmVydEhvc3REZWNsYXJhdGlvblRvTWV0YWRhdGEoZGVjbGFyYXRpb24uaG9zdCksXG4gICAgcXVlcmllczogKGRlY2xhcmF0aW9uLnF1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHZpZXdRdWVyaWVzOiAoZGVjbGFyYXRpb24udmlld1F1ZXJpZXMgPz8gW10pLm1hcChjb252ZXJ0UXVlcnlEZWNsYXJhdGlvblRvTWV0YWRhdGEpLFxuICAgIHByb3ZpZGVyczogZGVjbGFyYXRpb24ucHJvdmlkZXJzICE9PSB1bmRlZmluZWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGRlY2xhcmF0aW9uLnByb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgIGV4cG9ydEFzOiBkZWNsYXJhdGlvbi5leHBvcnRBcyA/PyBudWxsLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZGVjbGFyYXRpb24udXNlc0luaGVyaXRhbmNlID8/IGZhbHNlLFxuICAgIGxpZmVjeWNsZToge3VzZXNPbkNoYW5nZXM6IGRlY2xhcmF0aW9uLnVzZXNPbkNoYW5nZXMgPz8gZmFsc2V9LFxuICAgIGRlcHM6IG51bGwsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgZnVsbEluaGVyaXRhbmNlOiBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydEhvc3REZWNsYXJhdGlvblRvTWV0YWRhdGEoaG9zdDogUjNEZWNsYXJlRGlyZWN0aXZlRmFjYWRlWydob3N0J10gPSB7fSk6XG4gICAgUjNIb3N0TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIGF0dHJpYnV0ZXM6IGNvbnZlcnRPcGFxdWVWYWx1ZXNUb0V4cHJlc3Npb25zKGhvc3QuYXR0cmlidXRlcyA/PyB7fSksXG4gICAgbGlzdGVuZXJzOiBob3N0Lmxpc3RlbmVycyA/PyB7fSxcbiAgICBwcm9wZXJ0aWVzOiBob3N0LnByb3BlcnRpZXMgPz8ge30sXG4gICAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtcbiAgICAgIGNsYXNzQXR0cjogaG9zdC5jbGFzc0F0dHJpYnV0ZSxcbiAgICAgIHN0eWxlQXR0cjogaG9zdC5zdHlsZUF0dHJpYnV0ZSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0T3BhcXVlVmFsdWVzVG9FeHByZXNzaW9ucyhvYmo6IHtba2V5OiBzdHJpbmddOiBPcGFxdWVWYWx1ZX0pOlxuICAgIHtba2V5OiBzdHJpbmddOiBXcmFwcGVkTm9kZUV4cHI8dW5rbm93bj59IHtcbiAgY29uc3QgcmVzdWx0OiB7W2tleTogc3RyaW5nXTogV3JhcHBlZE5vZGVFeHByPHVua25vd24+fSA9IHt9O1xuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XG4gICAgcmVzdWx0W2tleV0gPSBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtrZXldKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBUaGlzIHNlZW1zIHRvIGJlIG5lZWRlZCB0byBwbGFjYXRlIFRTIHYzLjAgb25seVxudHlwZSBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSA9XG4gICAgUGljazxSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlLCBFeGNsdWRlPGtleW9mIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsICdwcm9wTWV0YWRhdGEnPj47XG5cbmZ1bmN0aW9uIHdyYXBFeHByZXNzaW9uKG9iajogYW55LCBwcm9wZXJ0eTogc3RyaW5nKTogV3JhcHBlZE5vZGVFeHByPGFueT58dW5kZWZpbmVkIHtcbiAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICByZXR1cm4gbmV3IFdyYXBwZWROb2RlRXhwcihvYmpbcHJvcGVydHldKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVQcm92aWRlZEluKHByb3ZpZGVkSW46IFR5cGV8c3RyaW5nfG51bGx8dW5kZWZpbmVkKTogRXhwcmVzc2lvbiB7XG4gIGlmIChwcm92aWRlZEluID09IG51bGwgfHwgdHlwZW9mIHByb3ZpZGVkSW4gPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsRXhwcihwcm92aWRlZEluKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IFdyYXBwZWROb2RlRXhwcihwcm92aWRlZEluKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEoZmFjYWRlOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZSk6IFIzRGVwZW5kZW5jeU1ldGFkYXRhIHtcbiAgbGV0IHRva2VuRXhwcjtcbiAgaWYgKGZhY2FkZS50b2tlbiA9PT0gbnVsbCkge1xuICAgIHRva2VuRXhwciA9IG5ldyBMaXRlcmFsRXhwcihudWxsKTtcbiAgfSBlbHNlIGlmIChmYWNhZGUucmVzb2x2ZWQgPT09IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZS5BdHRyaWJ1dGUpIHtcbiAgICB0b2tlbkV4cHIgPSBuZXcgTGl0ZXJhbEV4cHIoZmFjYWRlLnRva2VuKTtcbiAgfSBlbHNlIHtcbiAgICB0b2tlbkV4cHIgPSBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50b2tlbik7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB0b2tlbjogdG9rZW5FeHByLFxuICAgIGF0dHJpYnV0ZTogbnVsbCxcbiAgICByZXNvbHZlZDogZmFjYWRlLnJlc29sdmVkLFxuICAgIGhvc3Q6IGZhY2FkZS5ob3N0LFxuICAgIG9wdGlvbmFsOiBmYWNhZGUub3B0aW9uYWwsXG4gICAgc2VsZjogZmFjYWRlLnNlbGYsXG4gICAgc2tpcFNlbGY6IGZhY2FkZS5za2lwU2VsZixcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlczogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGVbXXxudWxsfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkKTogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXxudWxsIHtcbiAgcmV0dXJuIGZhY2FkZXMgPT0gbnVsbCA/IG51bGwgOiBmYWNhZGVzLm1hcChjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEpO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0SG9zdEJpbmRpbmdzKFxuICAgIHByb3BNZXRhZGF0YToge1trZXk6IHN0cmluZ106IGFueVtdfSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIGhvc3Q/OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSk6IFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIC8vIEZpcnN0IHBhcnNlIHRoZSBkZWNsYXJhdGlvbnMgZnJvbSB0aGUgbWV0YWRhdGEuXG4gIGNvbnN0IGJpbmRpbmdzID0gcGFyc2VIb3N0QmluZGluZ3MoaG9zdCB8fCB7fSk7XG5cbiAgLy8gQWZ0ZXIgdGhhdCBjaGVjayBob3N0IGJpbmRpbmdzIGZvciBlcnJvcnNcbiAgY29uc3QgZXJyb3JzID0gdmVyaWZ5SG9zdEJpbmRpbmdzKGJpbmRpbmdzLCBzb3VyY2VTcGFuKTtcbiAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm1hcCgoZXJyb3I6IFBhcnNlRXJyb3IpID0+IGVycm9yLm1zZykuam9pbignXFxuJykpO1xuICB9XG5cbiAgLy8gTmV4dCwgbG9vcCBvdmVyIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBvYmplY3QsIGxvb2tpbmcgZm9yIEBIb3N0QmluZGluZyBhbmQgQEhvc3RMaXN0ZW5lci5cbiAgZm9yIChjb25zdCBmaWVsZCBpbiBwcm9wTWV0YWRhdGEpIHtcbiAgICBpZiAocHJvcE1ldGFkYXRhLmhhc093blByb3BlcnR5KGZpZWxkKSkge1xuICAgICAgcHJvcE1ldGFkYXRhW2ZpZWxkXS5mb3JFYWNoKGFubiA9PiB7XG4gICAgICAgIGlmIChpc0hvc3RCaW5kaW5nKGFubikpIHtcbiAgICAgICAgICBiaW5kaW5ncy5wcm9wZXJ0aWVzW2Fubi5ob3N0UHJvcGVydHlOYW1lIHx8IGZpZWxkXSA9IGZpZWxkO1xuICAgICAgICB9IGVsc2UgaWYgKGlzSG9zdExpc3RlbmVyKGFubikpIHtcbiAgICAgICAgICBiaW5kaW5ncy5saXN0ZW5lcnNbYW5uLmV2ZW50TmFtZSB8fCBmaWVsZF0gPSBgJHtmaWVsZH0oJHsoYW5uLmFyZ3MgfHwgW10pLmpvaW4oJywnKX0pYDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJpbmRpbmdzO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RCaW5kaW5nKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBIb3N0QmluZGluZyB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RCaW5kaW5nJztcbn1cblxuZnVuY3Rpb24gaXNIb3N0TGlzdGVuZXIodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RMaXN0ZW5lciB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RMaXN0ZW5lcic7XG59XG5cblxuZnVuY3Rpb24gaXNJbnB1dCh2YWx1ZTogYW55KTogdmFsdWUgaXMgSW5wdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdJbnB1dCc7XG59XG5cbmZ1bmN0aW9uIGlzT3V0cHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBPdXRwdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdPdXRwdXQnO1xufVxuXG5mdW5jdGlvbiBwYXJzZUlucHV0T3V0cHV0cyh2YWx1ZXM6IHN0cmluZ1tdKTogU3RyaW5nTWFwIHtcbiAgcmV0dXJuIHZhbHVlcy5yZWR1Y2UoKG1hcCwgdmFsdWUpID0+IHtcbiAgICBjb25zdCBbZmllbGQsIHByb3BlcnR5XSA9IHZhbHVlLnNwbGl0KCcsJykubWFwKHBpZWNlID0+IHBpZWNlLnRyaW0oKSk7XG4gICAgbWFwW2ZpZWxkXSA9IHByb3BlcnR5IHx8IGZpZWxkO1xuICAgIHJldHVybiBtYXA7XG4gIH0sIHt9IGFzIFN0cmluZ01hcCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdWJsaXNoRmFjYWRlKGdsb2JhbDogYW55KSB7XG4gIGNvbnN0IG5nOiBFeHBvcnRlZENvbXBpbGVyRmFjYWRlID0gZ2xvYmFsLm5nIHx8IChnbG9iYWwubmcgPSB7fSk7XG4gIG5nLsm1Y29tcGlsZXJGYWNhZGUgPSBuZXcgQ29tcGlsZXJGYWNhZGVJbXBsKCk7XG59XG4iXX0=