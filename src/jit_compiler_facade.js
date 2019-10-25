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
        define("@angular/compiler/src/jit_compiler_facade", ["require", "exports", "tslib", "@angular/compiler/src/constant_pool", "@angular/compiler/src/identifiers", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/output_jit", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_jit", "@angular/compiler/src/render3/r3_module_compiler", "@angular/compiler/src/render3/r3_pipe_compiler", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/resource_loader", "@angular/compiler/src/schema/dom_element_schema_registry"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
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
            this.ResourceLoader = resource_loader_1.ResourceLoader;
            this.elementSchemaRegistry = new dom_element_schema_registry_1.DomElementSchemaRegistry();
        }
        CompilerFacadeImpl.prototype.compilePipe = function (angularCoreEnv, sourceMapUrl, facade) {
            var metadata = {
                name: facade.name,
                type: new output_ast_1.WrappedNodeExpr(facade.type),
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
                type: new output_ast_1.WrappedNodeExpr(facade.type),
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
                type: new output_ast_1.WrappedNodeExpr(facade.type),
                deps: convertR3DependencyMetadataArray(facade.deps),
                providers: new output_ast_1.WrappedNodeExpr(facade.providers),
                imports: facade.imports.map(function (i) { return new output_ast_1.WrappedNodeExpr(i); }),
            };
            var res = r3_module_compiler_1.compileInjector(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, res.statements);
        };
        CompilerFacadeImpl.prototype.compileNgModule = function (angularCoreEnv, sourceMapUrl, facade) {
            var meta = {
                type: new output_ast_1.WrappedNodeExpr(facade.type),
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
            var constantPool = new constant_pool_1.ConstantPool();
            var bindingParser = template_1.makeBindingParser();
            var meta = convertDirectiveFacadeToMetadata(facade);
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
            if (template.errors !== undefined) {
                var errors = template.errors.map(function (err) { return err.toString(); }).join(', ');
                throw new Error("Errors during JIT compilation of template for " + facade.name + ": " + errors);
            }
            // Compile the component metadata, including template, into an expression.
            // TODO(alxhub): implement inputs, outputs, queries, etc.
            var metadata = tslib_1.__assign(tslib_1.__assign(tslib_1.__assign({}, facade), convertDirectiveFacadeToMetadata(facade)), { selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(), template: template, wrapDirectivesAndPipesInClosure: false, styles: facade.styles || [], encapsulation: facade.encapsulation, interpolation: interpolationConfig, changeDetection: facade.changeDetection, animations: facade.animations != null ? new output_ast_1.WrappedNodeExpr(facade.animations) : null, viewProviders: facade.viewProviders != null ? new output_ast_1.WrappedNodeExpr(facade.viewProviders) :
                    null, relativeContextFilePath: '', i18nUseExternalIds: true });
            var res = compiler_1.compileComponentFromMetadata(metadata, constantPool, template_1.makeBindingParser(interpolationConfig));
            var jitExpressionSourceMap = "ng:///" + facade.name + ".js";
            return this.jitExpression(res.expression, angularCoreEnv, jitExpressionSourceMap, constantPool.statements);
        };
        CompilerFacadeImpl.prototype.compileFactory = function (angularCoreEnv, sourceMapUrl, meta) {
            var factoryRes = r3_factory_1.compileFactoryFromMetadata({
                name: meta.name,
                type: new output_ast_1.WrappedNodeExpr(meta.type),
                typeArgumentCount: meta.typeArgumentCount,
                deps: convertR3DependencyMetadataArray(meta.deps),
                injectFn: meta.injectFn === 'directiveInject' ? identifiers_1.Identifiers.directiveInject :
                    identifiers_1.Identifiers.inject,
                isPipe: meta.isPipe
            });
            return this.jitExpression(factoryRes.factory, angularCoreEnv, sourceMapUrl, factoryRes.statements);
        };
        CompilerFacadeImpl.prototype.compileBase = function (angularCoreEnv, sourceMapUrl, facade) {
            var constantPool = new constant_pool_1.ConstantPool();
            var typeSourceSpan = this.createParseSourceSpan('Base', facade.name, "ng:///" + facade.name + ".js");
            var meta = tslib_1.__assign(tslib_1.__assign({}, facade), { typeSourceSpan: typeSourceSpan, viewQueries: facade.viewQueries ? facade.viewQueries.map(convertToR3QueryMetadata) :
                    facade.viewQueries, queries: facade.queries ? facade.queries.map(convertToR3QueryMetadata) : facade.queries, host: extractHostBindings(facade.propMetadata, typeSourceSpan) });
            var res = compiler_1.compileBaseDefFromMetadata(meta, constantPool, template_1.makeBindingParser());
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
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
        return tslib_1.__assign(tslib_1.__assign({}, facade), { typeSourceSpan: facade.typeSourceSpan, type: new output_ast_1.WrappedNodeExpr(facade.type), deps: convertR3DependencyMetadataArray(facade.deps), host: extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host), inputs: tslib_1.__assign(tslib_1.__assign({}, inputsFromMetadata), inputsFromType), outputs: tslib_1.__assign(tslib_1.__assign({}, outputsFromMetadata), outputsFromType), queries: facade.queries.map(convertToR3QueryMetadata), providers: facade.providers != null ? new output_ast_1.WrappedNodeExpr(facade.providers) : null, viewQueries: facade.viewQueries.map(convertToR3QueryMetadata), fullInheritance: false });
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
            resolved: facade.resolved,
            host: facade.host,
            optional: facade.optional,
            self: facade.self,
            skipSelf: facade.skipSelf
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUlILHFFQUE2QztJQUU3QyxpRUFBMEM7SUFDMUMscUZBQTBEO0lBQzFELDZGQUFtRztJQUNuRyxzRUFBc0g7SUFDdEgsc0VBQWlEO0lBQ2pELCtEQUE4RTtJQUM5RSx1RUFBZ0g7SUFDaEgsK0RBQWdEO0lBQ2hELHVGQUFzSDtJQUN0SCxtRkFBbUU7SUFHbkUsd0VBQTBMO0lBQzFMLHdFQUF5RTtJQUN6RSx5RUFBaUQ7SUFDakQsd0dBQThFO0lBRTlFO1FBS0UsNEJBQW9CLFlBQWlDO1lBQWpDLDZCQUFBLEVBQUEsbUJBQW1CLHlCQUFZLEVBQUU7WUFBakMsaUJBQVksR0FBWixZQUFZLENBQXFCO1lBSnJELDZCQUF3QixHQUFHLHFDQUErQixDQUFDO1lBQzNELG1CQUFjLEdBQUcsZ0NBQWMsQ0FBQztZQUN4QiwwQkFBcUIsR0FBRyxJQUFJLHNEQUF3QixFQUFFLENBQUM7UUFFUCxDQUFDO1FBRXpELHdDQUFXLEdBQVgsVUFBWSxjQUErQixFQUFFLFlBQW9CLEVBQUUsTUFBNEI7WUFFN0YsSUFBTSxRQUFRLEdBQUc7Z0JBQ2YsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO2dCQUNqQixJQUFJLEVBQUUsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7Z0JBQ3RDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxpQkFBaUI7Z0JBQzNDLElBQUksRUFBRSxnQ0FBZ0MsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNuRCxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7Z0JBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTthQUNsQixDQUFDO1lBQ0YsSUFBTSxHQUFHLEdBQUcsMENBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDOUMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBRUQsOENBQWlCLEdBQWpCLFVBQ0ksY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxNQUFrQztZQUM5QixJQUFBOzs7Ozs7Ozs7O2NBVUosRUFWSywwQkFBVSxFQUFFLDBCQVVqQixDQUFDO1lBRUgsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2xGLENBQUM7UUFFRCw0Q0FBZSxHQUFmLFVBQ0ksY0FBK0IsRUFBRSxZQUFvQixFQUNyRCxNQUFnQztZQUNsQyxJQUFNLElBQUksR0FBdUI7Z0JBQy9CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtnQkFDakIsSUFBSSxFQUFFLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUN0QyxJQUFJLEVBQUUsZ0NBQWdDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDbkQsU0FBUyxFQUFFLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO2dCQUNoRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxJQUFJLDRCQUFlLENBQUMsQ0FBQyxDQUFDLEVBQXRCLENBQXNCLENBQUM7YUFDekQsQ0FBQztZQUNGLElBQU0sR0FBRyxHQUFHLG9DQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDMUYsQ0FBQztRQUVELDRDQUFlLEdBQWYsVUFDSSxjQUErQixFQUFFLFlBQW9CLEVBQ3JELE1BQWdDO1lBQ2xDLElBQU0sSUFBSSxHQUF1QjtnQkFDL0IsSUFBSSxFQUFFLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUN0QyxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO2dCQUM5QyxZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO2dCQUNwRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO2dCQUMxQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO2dCQUMxQyxVQUFVLEVBQUUsSUFBSTtnQkFDaEIsb0JBQW9CLEVBQUUsS0FBSztnQkFDM0IsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO2dCQUNsRSxFQUFFLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTthQUN0RCxDQUFDO1lBQ0YsSUFBTSxHQUFHLEdBQUcsb0NBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzlFLENBQUM7UUFFRCw2Q0FBZ0IsR0FBaEIsVUFDSSxjQUErQixFQUFFLFlBQW9CLEVBQ3JELE1BQWlDO1lBQ25DLElBQU0sWUFBWSxHQUFHLElBQUksNEJBQVksRUFBRSxDQUFDO1lBQ3hDLElBQU0sYUFBYSxHQUFHLDRCQUFpQixFQUFFLENBQUM7WUFFMUMsSUFBTSxJQUFJLEdBQXdCLGdDQUFnQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzNFLElBQU0sR0FBRyxHQUFHLHVDQUE0QixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDNUUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixHQUFHLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdFLENBQUM7UUFFRCw2Q0FBZ0IsR0FBaEIsVUFDSSxjQUErQixFQUFFLFlBQW9CLEVBQ3JELE1BQWlDO1lBQ25DLG1EQUFtRDtZQUNuRCxJQUFNLFlBQVksR0FBRyxJQUFJLDRCQUFZLEVBQUUsQ0FBQztZQUV4QyxJQUFNLG1CQUFtQixHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDOUMsMENBQW1CLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUNyRCxtREFBNEIsQ0FBQztZQUNqQywyQ0FBMkM7WUFDM0MsSUFBTSxRQUFRLEdBQUcsd0JBQWEsQ0FDMUIsTUFBTSxDQUFDLFFBQVEsRUFBRSxZQUFZLEVBQzdCLEVBQUMsbUJBQW1CLEVBQUUsTUFBTSxDQUFDLG1CQUFtQixFQUFFLG1CQUFtQixxQkFBQSxFQUFDLENBQUMsQ0FBQztZQUM1RSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFO2dCQUNqQyxJQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBZCxDQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3JFLE1BQU0sSUFBSSxLQUFLLENBQUMsbURBQWlELE1BQU0sQ0FBQyxJQUFJLFVBQUssTUFBUSxDQUFDLENBQUM7YUFDNUY7WUFFRCwwRUFBMEU7WUFDMUUseURBQXlEO1lBQ3pELElBQU0sUUFBUSwwREFDVCxNQUFzRCxHQUN0RCxnQ0FBZ0MsQ0FBQyxNQUFNLENBQUMsS0FDM0MsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLHFCQUFxQixDQUFDLDhCQUE4QixFQUFFLEVBQ3hGLFFBQVEsVUFBQSxFQUNSLCtCQUErQixFQUFFLEtBQUssRUFDdEMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNLElBQUksRUFBRSxFQUMzQixhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQW9CLEVBQzFDLGFBQWEsRUFBRSxtQkFBbUIsRUFDbEMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQ3ZDLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUNyRixhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztvQkFDM0MsSUFBSSxFQUNsRCx1QkFBdUIsRUFBRSxFQUFFLEVBQzNCLGtCQUFrQixFQUFFLElBQUksR0FDekIsQ0FBQztZQUNGLElBQU0sR0FBRyxHQUFHLHVDQUE0QixDQUNwQyxRQUFRLEVBQUUsWUFBWSxFQUFFLDRCQUFpQixDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztZQUNwRSxJQUFNLHNCQUFzQixHQUFHLFdBQVMsTUFBTSxDQUFDLElBQUksUUFBSyxDQUFDO1lBQ3pELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFFRCwyQ0FBYyxHQUFkLFVBQ0ksY0FBK0IsRUFBRSxZQUFvQixFQUFFLElBQWdDO1lBQ3pGLElBQU0sVUFBVSxHQUFHLHVDQUEwQixDQUFDO2dCQUM1QyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsSUFBSSxFQUFFLElBQUksNEJBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUNwQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCO2dCQUN6QyxJQUFJLEVBQUUsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDakQsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEtBQUssaUJBQWlCLENBQUMsQ0FBQyxDQUFDLHlCQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQzdCLHlCQUFXLENBQUMsTUFBTTtnQkFDbEUsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO2FBQ3BCLENBQUMsQ0FBQztZQUNILE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FDckIsVUFBVSxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMvRSxDQUFDO1FBRUQsd0NBQVcsR0FBWCxVQUFZLGNBQStCLEVBQUUsWUFBb0IsRUFBRSxNQUE0QjtZQUU3RixJQUFNLFlBQVksR0FBRyxJQUFJLDRCQUFZLEVBQUUsQ0FBQztZQUN4QyxJQUFNLGNBQWMsR0FDaEIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLFdBQVMsTUFBTSxDQUFDLElBQUksUUFBSyxDQUFDLENBQUM7WUFDL0UsSUFBTSxJQUFJLHlDQUNMLE1BQU0sS0FDVCxjQUFjLGdCQUFBLEVBQ2QsV0FBVyxFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztvQkFDbEQsTUFBTSxDQUFDLFdBQVcsRUFDcEQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQ3ZGLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLGNBQWMsQ0FBQyxHQUMvRCxDQUFDO1lBQ0YsSUFBTSxHQUFHLEdBQUcscUNBQTBCLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSw0QkFBaUIsRUFBRSxDQUFDLENBQUM7WUFDaEYsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUNyQixHQUFHLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdFLENBQUM7UUFFRCxrREFBcUIsR0FBckIsVUFBc0IsSUFBWSxFQUFFLFFBQWdCLEVBQUUsU0FBaUI7WUFDckUsT0FBTyxnQ0FBbUIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFFRDs7Ozs7Ozs7V0FRRztRQUNLLDBDQUFhLEdBQXJCLFVBQ0ksR0FBZSxFQUFFLE9BQTZCLEVBQUUsU0FBaUIsRUFDakUsYUFBMEI7WUFDNUIsZ0dBQWdHO1lBQ2hHLCtGQUErRjtZQUMvRixxRUFBcUU7WUFDckUsSUFBTSxVQUFVLG9CQUNYLGFBQWE7Z0JBQ2hCLElBQUksMkJBQWMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxDQUFDLHlCQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7Y0FDcEUsQ0FBQztZQUVGLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsa0JBQWtCLENBQzVDLFNBQVMsRUFBRSxVQUFVLEVBQUUsSUFBSSx1QkFBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFLHNCQUFzQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JGLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JCLENBQUM7UUFDSCx5QkFBQztJQUFELENBQUMsQUEzTEQsSUEyTEM7SUEzTFksZ0RBQWtCO0lBa00vQixJQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUMsUUFBUSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkQsSUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELElBQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBQyxRQUFRLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuRCxJQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUMsV0FBVyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFekQsSUFBTSxhQUFhLEdBQUcsVUFBUyxLQUFVO1FBQ3ZDLElBQU0sT0FBTyxHQUFHLElBQUksNEJBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQyxPQUFPLEVBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFDLENBQUM7SUFDekMsQ0FBQyxDQUFDO0lBRUYsU0FBUyx3QkFBd0IsQ0FBQyxNQUE2QjtRQUM3RCw2Q0FDSyxNQUFNLEtBQ1QsU0FBUyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ2xCLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQ2xGLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLDRCQUFlLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQzNELE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxJQUNyQjtJQUNKLENBQUM7SUFFRCxTQUFTLGdDQUFnQyxDQUFDLE1BQWlDO1FBQ3pFLElBQU0sa0JBQWtCLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNsRSxJQUFNLG1CQUFtQixHQUFHLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7UUFDcEUsSUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUN6QyxJQUFNLGNBQWMsR0FBd0IsRUFBRSxDQUFDO1FBQy9DLElBQU0sZUFBZSxHQUFjLEVBQUUsQ0FBQztnQ0FDM0IsS0FBSztZQUNkLElBQUksWUFBWSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDdEMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLEdBQUc7b0JBQzdCLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO3dCQUNoQixjQUFjLENBQUMsS0FBSyxDQUFDOzRCQUNqQixHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7cUJBQ3hFO3lCQUFNLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO3dCQUN4QixlQUFlLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixJQUFJLEtBQUssQ0FBQztxQkFDM0Q7Z0JBQ0gsQ0FBQyxDQUFDLENBQUM7YUFDSjs7UUFWSCxLQUFLLElBQU0sS0FBSyxJQUFJLFlBQVk7b0JBQXJCLEtBQUs7U0FXZjtRQUVELDZDQUNLLE1BQXNELEtBQ3pELGNBQWMsRUFBRSxNQUFNLENBQUMsY0FBYyxFQUNyQyxJQUFJLEVBQUUsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFDdEMsSUFBSSxFQUFFLGdDQUFnQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFDbkQsSUFBSSxFQUFFLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQ2xGLE1BQU0sd0NBQU0sa0JBQWtCLEdBQUssY0FBYyxHQUNqRCxPQUFPLHdDQUFNLG1CQUFtQixHQUFLLGVBQWUsR0FDcEQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLEVBQ3JELFNBQVMsRUFBRSxNQUFNLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSw0QkFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUNsRixXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsRUFDN0QsZUFBZSxFQUFFLEtBQUssSUFDdEI7SUFDSixDQUFDO0lBTUQsU0FBUyxjQUFjLENBQUMsR0FBUSxFQUFFLFFBQWdCO1FBQ2hELElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNoQyxPQUFPLElBQUksNEJBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztTQUMzQzthQUFNO1lBQ0wsT0FBTyxTQUFTLENBQUM7U0FDbEI7SUFDSCxDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxVQUE0QztRQUNyRSxJQUFJLFVBQVUsSUFBSSxJQUFJLElBQUksT0FBTyxVQUFVLEtBQUssUUFBUSxFQUFFO1lBQ3hELE9BQU8sSUFBSSx3QkFBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ3BDO2FBQU07WUFDTCxPQUFPLElBQUksNEJBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUN4QztJQUNILENBQUM7SUFFRCxTQUFTLDJCQUEyQixDQUFDLE1BQWtDO1FBQ3JFLElBQUksU0FBUyxDQUFDO1FBQ2QsSUFBSSxNQUFNLENBQUMsS0FBSyxLQUFLLElBQUksRUFBRTtZQUN6QixTQUFTLEdBQUcsSUFBSSx3QkFBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ25DO2FBQU0sSUFBSSxNQUFNLENBQUMsUUFBUSxLQUFLLHFDQUF3QixDQUFDLFNBQVMsRUFBRTtZQUNqRSxTQUFTLEdBQUcsSUFBSSx3QkFBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMzQzthQUFNO1lBQ0wsU0FBUyxHQUFHLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDL0M7UUFDRCxPQUFPO1lBQ0wsS0FBSyxFQUFFLFNBQVM7WUFDaEIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1lBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtZQUNqQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7WUFDekIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO1lBQ2pCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtTQUMxQixDQUFDO0lBQ0osQ0FBQztJQUVELFNBQVMsZ0NBQWdDLENBQUMsT0FBd0Q7UUFFaEcsT0FBTyxPQUFPLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUMzRSxDQUFDO0lBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsWUFBb0MsRUFBRSxVQUEyQixFQUNqRSxJQUE4QjtRQUNoQyxrREFBa0Q7UUFDbEQsSUFBTSxRQUFRLEdBQUcsNEJBQWlCLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRS9DLDRDQUE0QztRQUM1QyxJQUFNLE1BQU0sR0FBRyw2QkFBa0IsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDeEQsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFDLEtBQWlCLElBQUssT0FBQSxLQUFLLENBQUMsR0FBRyxFQUFULENBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQzFFO2dDQUdVLEtBQUs7WUFDZCxJQUFJLFlBQVksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3RDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxHQUFHO29CQUM3QixJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsRUFBRTt3QkFDdEIsUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLElBQUksS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDO3FCQUM1RDt5QkFBTSxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRTt3QkFDOUIsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsU0FBUyxJQUFJLEtBQUssQ0FBQyxHQUFNLEtBQUssU0FBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFHLENBQUM7cUJBQ3hGO2dCQUNILENBQUMsQ0FBQyxDQUFDO2FBQ0o7O1FBVkgsNEZBQTRGO1FBQzVGLEtBQUssSUFBTSxLQUFLLElBQUksWUFBWTtvQkFBckIsS0FBSztTQVVmO1FBRUQsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztJQUVELFNBQVMsYUFBYSxDQUFDLEtBQVU7UUFDL0IsT0FBTyxLQUFLLENBQUMsY0FBYyxLQUFLLGFBQWEsQ0FBQztJQUNoRCxDQUFDO0lBRUQsU0FBUyxjQUFjLENBQUMsS0FBVTtRQUNoQyxPQUFPLEtBQUssQ0FBQyxjQUFjLEtBQUssY0FBYyxDQUFDO0lBQ2pELENBQUM7SUFHRCxTQUFTLE9BQU8sQ0FBQyxLQUFVO1FBQ3pCLE9BQU8sS0FBSyxDQUFDLGNBQWMsS0FBSyxPQUFPLENBQUM7SUFDMUMsQ0FBQztJQUVELFNBQVMsUUFBUSxDQUFDLEtBQVU7UUFDMUIsT0FBTyxLQUFLLENBQUMsY0FBYyxLQUFLLFFBQVEsQ0FBQztJQUMzQyxDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxNQUFnQjtRQUN6QyxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQ2hCLFVBQUMsR0FBRyxFQUFFLEtBQUs7WUFDSCxJQUFBLHVGQUErRCxFQUE5RCxhQUFLLEVBQUUsZ0JBQXVELENBQUM7WUFDdEUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLFFBQVEsSUFBSSxLQUFLLENBQUM7WUFDL0IsT0FBTyxHQUFHLENBQUM7UUFDYixDQUFDLEVBQ0QsRUFBZSxDQUFDLENBQUM7SUFDdkIsQ0FBQztJQUVELFNBQWdCLGFBQWEsQ0FBQyxNQUFXO1FBQ3ZDLElBQU0sRUFBRSxHQUEyQixNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUNqRSxFQUFFLENBQUMsZUFBZSxHQUFHLElBQUksa0JBQWtCLEVBQUUsQ0FBQztJQUNoRCxDQUFDO0lBSEQsc0NBR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtDb21waWxlckZhY2FkZSwgQ29yZUVudmlyb25tZW50LCBFeHBvcnRlZENvbXBpbGVyRmFjYWRlLCBSM0Jhc2VNZXRhZGF0YUZhY2FkZSwgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUsIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlLCBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSwgUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlLCBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUsIFIzUGlwZU1ldGFkYXRhRmFjYWRlLCBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUsIFN0cmluZ01hcCwgU3RyaW5nTWFwV2l0aFJlbmFtZX0gZnJvbSAnLi9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtIb3N0QmluZGluZywgSG9zdExpc3RlbmVyLCBJbnB1dCwgT3V0cHV0LCBUeXBlfSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi9pZGVudGlmaWVycyc7XG5pbXBvcnQge2NvbXBpbGVJbmplY3RhYmxlfSBmcm9tICcuL2luamVjdGFibGVfY29tcGlsZXJfMic7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7RGVjbGFyZVZhclN0bXQsIEV4cHJlc3Npb24sIExpdGVyYWxFeHByLCBTdGF0ZW1lbnQsIFN0bXRNb2RpZmllciwgV3JhcHBlZE5vZGVFeHByfSBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7Sml0RXZhbHVhdG9yfSBmcm9tICcuL291dHB1dC9vdXRwdXRfaml0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFuLCByM0ppdFR5cGVTb3VyY2VTcGFufSBmcm9tICcuL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLCBjb21waWxlRmFjdG9yeUZyb21NZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtSM0ppdFJlZmxlY3Rvcn0gZnJvbSAnLi9yZW5kZXIzL3IzX2ppdCc7XG5pbXBvcnQge1IzSW5qZWN0b3JNZXRhZGF0YSwgUjNOZ01vZHVsZU1ldGFkYXRhLCBjb21waWxlSW5qZWN0b3IsIGNvbXBpbGVOZ01vZHVsZX0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfcGlwZV9jb21waWxlcic7XG5pbXBvcnQge1IzUmVmZXJlbmNlfSBmcm9tICcuL3JlbmRlcjMvdXRpbCc7XG5pbXBvcnQge1IzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmltcG9ydCB7UGFyc2VkSG9zdEJpbmRpbmdzLCBjb21waWxlQmFzZURlZkZyb21NZXRhZGF0YSwgY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YSwgcGFyc2VIb3N0QmluZGluZ3MsIHZlcmlmeUhvc3RCaW5kaW5nc30gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHttYWtlQmluZGluZ1BhcnNlciwgcGFyc2VUZW1wbGF0ZX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtSZXNvdXJjZUxvYWRlcn0gZnJvbSAnLi9yZXNvdXJjZV9sb2FkZXInO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlckZhY2FkZUltcGwgaW1wbGVtZW50cyBDb21waWxlckZhY2FkZSB7XG4gIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSA9IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSBhcyBhbnk7XG4gIFJlc291cmNlTG9hZGVyID0gUmVzb3VyY2VMb2FkZXI7XG4gIHByaXZhdGUgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgaml0RXZhbHVhdG9yID0gbmV3IEppdEV2YWx1YXRvcigpKSB7fVxuXG4gIGNvbXBpbGVQaXBlKGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBmYWNhZGU6IFIzUGlwZU1ldGFkYXRhRmFjYWRlKTpcbiAgICAgIGFueSB7XG4gICAgY29uc3QgbWV0YWRhdGEgPSB7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IGZhY2FkZS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgIGRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS5kZXBzKSxcbiAgICAgIHBpcGVOYW1lOiBmYWNhZGUucGlwZU5hbWUsXG4gICAgICBwdXJlOiBmYWNhZGUucHVyZSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVQaXBlRnJvbU1ldGFkYXRhKG1ldGFkYXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3Qge2V4cHJlc3Npb24sIHN0YXRlbWVudHN9ID0gY29tcGlsZUluamVjdGFibGUoe1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBmYWNhZGUudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICBwcm92aWRlZEluOiBjb21wdXRlUHJvdmlkZWRJbihmYWNhZGUucHJvdmlkZWRJbiksXG4gICAgICB1c2VDbGFzczogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfQ0xBU1MpLFxuICAgICAgdXNlRmFjdG9yeTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRkFDVE9SWSksXG4gICAgICB1c2VWYWx1ZTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfVkFMVUUpLFxuICAgICAgdXNlRXhpc3Rpbmc6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgVVNFX0VYSVNUSU5HKSxcbiAgICAgIHVzZXJEZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGUudXNlckRlcHMpIHx8IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0b3IoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM0luamVjdG9yTWV0YWRhdGEgPSB7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgICAgcHJvdmlkZXJzOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKGkgPT4gbmV3IFdyYXBwZWROb2RlRXhwcihpKSksXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlSW5qZWN0b3IobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgcmVzLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZU5nTW9kdWxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhID0ge1xuICAgICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBib290c3RyYXA6IGZhY2FkZS5ib290c3RyYXAubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZGVjbGFyYXRpb25zOiBmYWNhZGUuZGVjbGFyYXRpb25zLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGltcG9ydHM6IGZhY2FkZS5pbXBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGV4cG9ydHM6IGZhY2FkZS5leHBvcnRzLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGVtaXRJbmxpbmU6IHRydWUsXG4gICAgICBjb250YWluc0ZvcndhcmREZWNsczogZmFsc2UsXG4gICAgICBzY2hlbWFzOiBmYWNhZGUuc2NoZW1hcyA/IGZhY2FkZS5zY2hlbWFzLm1hcCh3cmFwUmVmZXJlbmNlKSA6IG51bGwsXG4gICAgICBpZDogZmFjYWRlLmlkID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuaWQpIDogbnVsbCxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVOZ01vZHVsZShtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcbiAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcblxuICAgIGNvbnN0IG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEgPSBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGUpO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICAvLyBUaGUgQ29uc3RhbnRQb29sIGlzIGEgcmVxdWlyZW1lbnQgb2YgdGhlIEpJVCdlci5cbiAgICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKCk7XG5cbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uQ29uZmlnID0gZmFjYWRlLmludGVycG9sYXRpb24gP1xuICAgICAgICBJbnRlcnBvbGF0aW9uQ29uZmlnLmZyb21BcnJheShmYWNhZGUuaW50ZXJwb2xhdGlvbikgOlxuICAgICAgICBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHO1xuICAgIC8vIFBhcnNlIHRoZSB0ZW1wbGF0ZSBhbmQgY2hlY2sgZm9yIGVycm9ycy5cbiAgICBjb25zdCB0ZW1wbGF0ZSA9IHBhcnNlVGVtcGxhdGUoXG4gICAgICAgIGZhY2FkZS50ZW1wbGF0ZSwgc291cmNlTWFwVXJsLFxuICAgICAgICB7cHJlc2VydmVXaGl0ZXNwYWNlczogZmFjYWRlLnByZXNlcnZlV2hpdGVzcGFjZXMsIGludGVycG9sYXRpb25Db25maWd9KTtcbiAgICBpZiAodGVtcGxhdGUuZXJyb3JzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGVycm9ycyA9IHRlbXBsYXRlLmVycm9ycy5tYXAoZXJyID0+IGVyci50b1N0cmluZygpKS5qb2luKCcsICcpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvcnMgZHVyaW5nIEpJVCBjb21waWxhdGlvbiBvZiB0ZW1wbGF0ZSBmb3IgJHtmYWNhZGUubmFtZX06ICR7ZXJyb3JzfWApO1xuICAgIH1cblxuICAgIC8vIENvbXBpbGUgdGhlIGNvbXBvbmVudCBtZXRhZGF0YSwgaW5jbHVkaW5nIHRlbXBsYXRlLCBpbnRvIGFuIGV4cHJlc3Npb24uXG4gICAgLy8gVE9ETyhhbHhodWIpOiBpbXBsZW1lbnQgaW5wdXRzLCBvdXRwdXRzLCBxdWVyaWVzLCBldGMuXG4gICAgY29uc3QgbWV0YWRhdGEgPSB7XG4gICAgICAuLi5mYWNhZGUgYXMgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZU5vUHJvcEFuZFdoaXRlc3BhY2UsXG4gICAgICAuLi5jb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGUpLFxuICAgICAgc2VsZWN0b3I6IGZhY2FkZS5zZWxlY3RvciB8fCB0aGlzLmVsZW1lbnRTY2hlbWFSZWdpc3RyeS5nZXREZWZhdWx0Q29tcG9uZW50RWxlbWVudE5hbWUoKSxcbiAgICAgIHRlbXBsYXRlLFxuICAgICAgd3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZTogZmFsc2UsXG4gICAgICBzdHlsZXM6IGZhY2FkZS5zdHlsZXMgfHwgW10sXG4gICAgICBlbmNhcHN1bGF0aW9uOiBmYWNhZGUuZW5jYXBzdWxhdGlvbiBhcyBhbnksXG4gICAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgICAgY2hhbmdlRGV0ZWN0aW9uOiBmYWNhZGUuY2hhbmdlRGV0ZWN0aW9uLFxuICAgICAgYW5pbWF0aW9uczogZmFjYWRlLmFuaW1hdGlvbnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmFuaW1hdGlvbnMpIDogbnVsbCxcbiAgICAgIHZpZXdQcm92aWRlcnM6IGZhY2FkZS52aWV3UHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS52aWV3UHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgICAgIG1ldGFkYXRhLCBjb25zdGFudFBvb2wsIG1ha2VCaW5kaW5nUGFyc2VyKGludGVycG9sYXRpb25Db25maWcpKTtcbiAgICBjb25zdCBqaXRFeHByZXNzaW9uU291cmNlTWFwID0gYG5nOi8vLyR7ZmFjYWRlLm5hbWV9LmpzYDtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIGppdEV4cHJlc3Npb25Tb3VyY2VNYXAsIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVGYWN0b3J5KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIG1ldGE6IFIzRmFjdG9yeURlZk1ldGFkYXRhRmFjYWRlKSB7XG4gICAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnJvbU1ldGFkYXRhKHtcbiAgICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIobWV0YS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkobWV0YS5kZXBzKSxcbiAgICAgIGluamVjdEZuOiBtZXRhLmluamVjdEZuID09PSAnZGlyZWN0aXZlSW5qZWN0JyA/IElkZW50aWZpZXJzLmRpcmVjdGl2ZUluamVjdCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJZGVudGlmaWVycy5pbmplY3QsXG4gICAgICBpc1BpcGU6IG1ldGEuaXNQaXBlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihcbiAgICAgICAgZmFjdG9yeVJlcy5mYWN0b3J5LCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBmYWN0b3J5UmVzLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUJhc2UoYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIGZhY2FkZTogUjNCYXNlTWV0YWRhdGFGYWNhZGUpOlxuICAgICAgYW55IHtcbiAgICBjb25zdCBjb25zdGFudFBvb2wgPSBuZXcgQ29uc3RhbnRQb29sKCk7XG4gICAgY29uc3QgdHlwZVNvdXJjZVNwYW4gPVxuICAgICAgICB0aGlzLmNyZWF0ZVBhcnNlU291cmNlU3BhbignQmFzZScsIGZhY2FkZS5uYW1lLCBgbmc6Ly8vJHtmYWNhZGUubmFtZX0uanNgKTtcbiAgICBjb25zdCBtZXRhID0ge1xuICAgICAgLi4uZmFjYWRlLFxuICAgICAgdHlwZVNvdXJjZVNwYW4sXG4gICAgICB2aWV3UXVlcmllczogZmFjYWRlLnZpZXdRdWVyaWVzID8gZmFjYWRlLnZpZXdRdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWNhZGUudmlld1F1ZXJpZXMsXG4gICAgICBxdWVyaWVzOiBmYWNhZGUucXVlcmllcyA/IGZhY2FkZS5xdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpIDogZmFjYWRlLnF1ZXJpZXMsXG4gICAgICBob3N0OiBleHRyYWN0SG9zdEJpbmRpbmdzKGZhY2FkZS5wcm9wTWV0YWRhdGEsIHR5cGVTb3VyY2VTcGFuKVxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUJhc2VEZWZGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBtYWtlQmluZGluZ1BhcnNlcigpKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY3JlYXRlUGFyc2VTb3VyY2VTcGFuKGtpbmQ6IHN0cmluZywgdHlwZU5hbWU6IHN0cmluZywgc291cmNlVXJsOiBzdHJpbmcpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIHJldHVybiByM0ppdFR5cGVTb3VyY2VTcGFuKGtpbmQsIHR5cGVOYW1lLCBzb3VyY2VVcmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIEpJVCBjb21waWxlcyBhbiBleHByZXNzaW9uIGFuZCByZXR1cm5zIHRoZSByZXN1bHQgb2YgZXhlY3V0aW5nIHRoYXQgZXhwcmVzc2lvbi5cbiAgICpcbiAgICogQHBhcmFtIGRlZiB0aGUgZGVmaW5pdGlvbiB3aGljaCB3aWxsIGJlIGNvbXBpbGVkIGFuZCBleGVjdXRlZCB0byBnZXQgdGhlIHZhbHVlIHRvIHBhdGNoXG4gICAqIEBwYXJhbSBjb250ZXh0IGFuIG9iamVjdCBtYXAgb2YgQGFuZ3VsYXIvY29yZSBzeW1ib2wgbmFtZXMgdG8gc3ltYm9scyB3aGljaCB3aWxsIGJlIGF2YWlsYWJsZVxuICAgKiBpbiB0aGUgY29udGV4dCBvZiB0aGUgY29tcGlsZWQgZXhwcmVzc2lvblxuICAgKiBAcGFyYW0gc291cmNlVXJsIGEgVVJMIHRvIHVzZSBmb3IgdGhlIHNvdXJjZSBtYXAgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHByZVN0YXRlbWVudHMgYSBjb2xsZWN0aW9uIG9mIHN0YXRlbWVudHMgdGhhdCBzaG91bGQgYmUgZXZhbHVhdGVkIGJlZm9yZSB0aGUgZXhwcmVzc2lvbi5cbiAgICovXG4gIHByaXZhdGUgaml0RXhwcmVzc2lvbihcbiAgICAgIGRlZjogRXhwcmVzc2lvbiwgY29udGV4dDoge1trZXk6IHN0cmluZ106IGFueX0sIHNvdXJjZVVybDogc3RyaW5nLFxuICAgICAgcHJlU3RhdGVtZW50czogU3RhdGVtZW50W10pOiBhbnkge1xuICAgIC8vIFRoZSBDb25zdGFudFBvb2wgbWF5IGNvbnRhaW4gU3RhdGVtZW50cyB3aGljaCBkZWNsYXJlIHZhcmlhYmxlcyB1c2VkIGluIHRoZSBmaW5hbCBleHByZXNzaW9uLlxuICAgIC8vIFRoZXJlZm9yZSwgaXRzIHN0YXRlbWVudHMgbmVlZCB0byBwcmVjZWRlIHRoZSBhY3R1YWwgSklUIG9wZXJhdGlvbi4gVGhlIGZpbmFsIHN0YXRlbWVudCBpcyBhXG4gICAgLy8gZGVjbGFyYXRpb24gb2YgJGRlZiB3aGljaCBpcyBzZXQgdG8gdGhlIGV4cHJlc3Npb24gYmVpbmcgY29tcGlsZWQuXG4gICAgY29uc3Qgc3RhdGVtZW50czogU3RhdGVtZW50W10gPSBbXG4gICAgICAuLi5wcmVTdGF0ZW1lbnRzLFxuICAgICAgbmV3IERlY2xhcmVWYXJTdG10KCckZGVmJywgZGVmLCB1bmRlZmluZWQsIFtTdG10TW9kaWZpZXIuRXhwb3J0ZWRdKSxcbiAgICBdO1xuXG4gICAgY29uc3QgcmVzID0gdGhpcy5qaXRFdmFsdWF0b3IuZXZhbHVhdGVTdGF0ZW1lbnRzKFxuICAgICAgICBzb3VyY2VVcmwsIHN0YXRlbWVudHMsIG5ldyBSM0ppdFJlZmxlY3Rvcihjb250ZXh0KSwgLyogZW5hYmxlU291cmNlTWFwcyAqLyB0cnVlKTtcbiAgICByZXR1cm4gcmVzWyckZGVmJ107XG4gIH1cbn1cblxuLy8gVGhpcyBzZWVtcyB0byBiZSBuZWVkZWQgdG8gcGxhY2F0ZSBUUyB2My4wIG9ubHlcbnR5cGUgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZU5vUHJvcEFuZFdoaXRlc3BhY2UgPSBQaWNrPFxuICAgIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUsXG4gICAgRXhjbHVkZTxFeGNsdWRlPGtleW9mIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUsICdwcmVzZXJ2ZVdoaXRlc3BhY2VzJz4sICdwcm9wTWV0YWRhdGEnPj47XG5cbmNvbnN0IFVTRV9DTEFTUyA9IE9iamVjdC5rZXlzKHt1c2VDbGFzczogbnVsbH0pWzBdO1xuY29uc3QgVVNFX0ZBQ1RPUlkgPSBPYmplY3Qua2V5cyh7dXNlRmFjdG9yeTogbnVsbH0pWzBdO1xuY29uc3QgVVNFX1ZBTFVFID0gT2JqZWN0LmtleXMoe3VzZVZhbHVlOiBudWxsfSlbMF07XG5jb25zdCBVU0VfRVhJU1RJTkcgPSBPYmplY3Qua2V5cyh7dXNlRXhpc3Rpbmc6IG51bGx9KVswXTtcblxuY29uc3Qgd3JhcFJlZmVyZW5jZSA9IGZ1bmN0aW9uKHZhbHVlOiBhbnkpOiBSM1JlZmVyZW5jZSB7XG4gIGNvbnN0IHdyYXBwZWQgPSBuZXcgV3JhcHBlZE5vZGVFeHByKHZhbHVlKTtcbiAgcmV0dXJuIHt2YWx1ZTogd3JhcHBlZCwgdHlwZTogd3JhcHBlZH07XG59O1xuXG5mdW5jdGlvbiBjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEoZmFjYWRlOiBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUpOiBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSxcbiAgICBwcmVkaWNhdGU6IEFycmF5LmlzQXJyYXkoZmFjYWRlLnByZWRpY2F0ZSkgPyBmYWNhZGUucHJlZGljYXRlIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcmVkaWNhdGUpLFxuICAgIHJlYWQ6IGZhY2FkZS5yZWFkID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucmVhZCkgOiBudWxsLFxuICAgIHN0YXRpYzogZmFjYWRlLnN0YXRpY1xuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgY29uc3QgaW5wdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dE91dHB1dHMoZmFjYWRlLmlucHV0cyB8fCBbXSk7XG4gIGNvbnN0IG91dHB1dHNGcm9tTWV0YWRhdGEgPSBwYXJzZUlucHV0T3V0cHV0cyhmYWNhZGUub3V0cHV0cyB8fCBbXSk7XG4gIGNvbnN0IHByb3BNZXRhZGF0YSA9IGZhY2FkZS5wcm9wTWV0YWRhdGE7XG4gIGNvbnN0IGlucHV0c0Zyb21UeXBlOiBTdHJpbmdNYXBXaXRoUmVuYW1lID0ge307XG4gIGNvbnN0IG91dHB1dHNGcm9tVHlwZTogU3RyaW5nTWFwID0ge307XG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNJbnB1dChhbm4pKSB7XG4gICAgICAgICAgaW5wdXRzRnJvbVR5cGVbZmllbGRdID1cbiAgICAgICAgICAgICAgYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUgPyBbYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUsIGZpZWxkXSA6IGZpZWxkO1xuICAgICAgICB9IGVsc2UgaWYgKGlzT3V0cHV0KGFubikpIHtcbiAgICAgICAgICBvdXRwdXRzRnJvbVR5cGVbZmllbGRdID0gYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUgfHwgZmllbGQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgLi4uZmFjYWRlIGFzIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlLFxuICAgIHR5cGVTb3VyY2VTcGFuOiBmYWNhZGUudHlwZVNvdXJjZVNwYW4sXG4gICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgIGhvc3Q6IGV4dHJhY3RIb3N0QmluZGluZ3MoZmFjYWRlLnByb3BNZXRhZGF0YSwgZmFjYWRlLnR5cGVTb3VyY2VTcGFuLCBmYWNhZGUuaG9zdCksXG4gICAgaW5wdXRzOiB7Li4uaW5wdXRzRnJvbU1ldGFkYXRhLCAuLi5pbnB1dHNGcm9tVHlwZX0sXG4gICAgb3V0cHV0czogey4uLm91dHB1dHNGcm9tTWV0YWRhdGEsIC4uLm91dHB1dHNGcm9tVHlwZX0sXG4gICAgcXVlcmllczogZmFjYWRlLnF1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBmYWNhZGUucHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpIDogbnVsbCxcbiAgICB2aWV3UXVlcmllczogZmFjYWRlLnZpZXdRdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIGZ1bGxJbmhlcml0YW5jZTogZmFsc2UsXG4gIH07XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID1cbiAgICBQaWNrPFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIEV4Y2x1ZGU8a2V5b2YgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuZnVuY3Rpb24gd3JhcEV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBXcmFwcGVkTm9kZUV4cHI8YW55Pnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb3ZpZGVkSW4ocHJvdmlkZWRJbjogVHlwZSB8IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiBFeHByZXNzaW9uIHtcbiAgaWYgKHByb3ZpZGVkSW4gPT0gbnVsbCB8fCB0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gbmV3IExpdGVyYWxFeHByKHByb3ZpZGVkSW4pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKHByb3ZpZGVkSW4pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBsZXQgdG9rZW5FeHByO1xuICBpZiAoZmFjYWRlLnRva2VuID09PSBudWxsKSB7XG4gICAgdG9rZW5FeHByID0gbmV3IExpdGVyYWxFeHByKG51bGwpO1xuICB9IGVsc2UgaWYgKGZhY2FkZS5yZXNvbHZlZCA9PT0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZSkge1xuICAgIHRva2VuRXhwciA9IG5ldyBMaXRlcmFsRXhwcihmYWNhZGUudG9rZW4pO1xuICB9IGVsc2Uge1xuICAgIHRva2VuRXhwciA9IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnRva2VuKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHRva2VuOiB0b2tlbkV4cHIsXG4gICAgcmVzb2x2ZWQ6IGZhY2FkZS5yZXNvbHZlZCxcbiAgICBob3N0OiBmYWNhZGUuaG9zdCxcbiAgICBvcHRpb25hbDogZmFjYWRlLm9wdGlvbmFsLFxuICAgIHNlbGY6IGZhY2FkZS5zZWxmLFxuICAgIHNraXBTZWxmOiBmYWNhZGUuc2tpcFNlbGZcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlczogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGVbXSB8IG51bGwgfCB1bmRlZmluZWQpOlxuICAgIFIzRGVwZW5kZW5jeU1ldGFkYXRhW118bnVsbCB7XG4gIHJldHVybiBmYWNhZGVzID09IG51bGwgPyBudWxsIDogZmFjYWRlcy5tYXAoY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhKTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEhvc3RCaW5kaW5ncyhcbiAgICBwcm9wTWV0YWRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnlbXX0sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBob3N0Pzoge1trZXk6IHN0cmluZ106IHN0cmluZ30pOiBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICAvLyBGaXJzdCBwYXJzZSB0aGUgZGVjbGFyYXRpb25zIGZyb20gdGhlIG1ldGFkYXRhLlxuICBjb25zdCBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKGhvc3QgfHwge30pO1xuXG4gIC8vIEFmdGVyIHRoYXQgY2hlY2sgaG9zdCBiaW5kaW5ncyBmb3IgZXJyb3JzXG4gIGNvbnN0IGVycm9ycyA9IHZlcmlmeUhvc3RCaW5kaW5ncyhiaW5kaW5ncywgc291cmNlU3Bhbik7XG4gIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5tYXAoKGVycm9yOiBQYXJzZUVycm9yKSA9PiBlcnJvci5tc2cpLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIC8vIE5leHQsIGxvb3Agb3ZlciB0aGUgcHJvcGVydGllcyBvZiB0aGUgb2JqZWN0LCBsb29raW5nIGZvciBASG9zdEJpbmRpbmcgYW5kIEBIb3N0TGlzdGVuZXIuXG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNIb3N0QmluZGluZyhhbm4pKSB7XG4gICAgICAgICAgYmluZGluZ3MucHJvcGVydGllc1thbm4uaG9zdFByb3BlcnR5TmFtZSB8fCBmaWVsZF0gPSBmaWVsZDtcbiAgICAgICAgfSBlbHNlIGlmIChpc0hvc3RMaXN0ZW5lcihhbm4pKSB7XG4gICAgICAgICAgYmluZGluZ3MubGlzdGVuZXJzW2Fubi5ldmVudE5hbWUgfHwgZmllbGRdID0gYCR7ZmllbGR9KCR7KGFubi5hcmdzIHx8IFtdKS5qb2luKCcsJyl9KWA7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBiaW5kaW5ncztcbn1cblxuZnVuY3Rpb24gaXNIb3N0QmluZGluZyh2YWx1ZTogYW55KTogdmFsdWUgaXMgSG9zdEJpbmRpbmcge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdIb3N0QmluZGluZyc7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdExpc3RlbmVyKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBIb3N0TGlzdGVuZXIge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdIb3N0TGlzdGVuZXInO1xufVxuXG5cbmZ1bmN0aW9uIGlzSW5wdXQodmFsdWU6IGFueSk6IHZhbHVlIGlzIElucHV0IHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSW5wdXQnO1xufVxuXG5mdW5jdGlvbiBpc091dHB1dCh2YWx1ZTogYW55KTogdmFsdWUgaXMgT3V0cHV0IHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnT3V0cHV0Jztcbn1cblxuZnVuY3Rpb24gcGFyc2VJbnB1dE91dHB1dHModmFsdWVzOiBzdHJpbmdbXSk6IFN0cmluZ01hcCB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlKFxuICAgICAgKG1hcCwgdmFsdWUpID0+IHtcbiAgICAgICAgY29uc3QgW2ZpZWxkLCBwcm9wZXJ0eV0gPSB2YWx1ZS5zcGxpdCgnLCcpLm1hcChwaWVjZSA9PiBwaWVjZS50cmltKCkpO1xuICAgICAgICBtYXBbZmllbGRdID0gcHJvcGVydHkgfHwgZmllbGQ7XG4gICAgICAgIHJldHVybiBtYXA7XG4gICAgICB9LFxuICAgICAge30gYXMgU3RyaW5nTWFwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHB1Ymxpc2hGYWNhZGUoZ2xvYmFsOiBhbnkpIHtcbiAgY29uc3Qgbmc6IEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUgPSBnbG9iYWwubmcgfHwgKGdsb2JhbC5uZyA9IHt9KTtcbiAgbmcuybVjb21waWxlckZhY2FkZSA9IG5ldyBDb21waWxlckZhY2FkZUltcGwoKTtcbn1cbiJdfQ==