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
        define("@angular/compiler/src/jit_compiler_facade", ["require", "exports", "tslib", "@angular/compiler/src/constant_pool", "@angular/compiler/src/injectable_compiler_2", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/output_jit", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_jit", "@angular/compiler/src/render3/r3_module_compiler", "@angular/compiler/src/render3/r3_pipe_compiler", "@angular/compiler/src/render3/view/compiler", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/schema/dom_element_schema_registry"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var constant_pool_1 = require("@angular/compiler/src/constant_pool");
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
    var dom_element_schema_registry_1 = require("@angular/compiler/src/schema/dom_element_schema_registry");
    var CompilerFacadeImpl = /** @class */ (function () {
        function CompilerFacadeImpl(jitEvaluator) {
            if (jitEvaluator === void 0) { jitEvaluator = new output_jit_1.JitEvaluator(); }
            this.jitEvaluator = jitEvaluator;
            this.R3ResolvedDependencyType = r3_factory_1.R3ResolvedDependencyType;
            this.elementSchemaRegistry = new dom_element_schema_registry_1.DomElementSchemaRegistry();
        }
        CompilerFacadeImpl.prototype.compilePipe = function (angularCoreEnv, sourceMapUrl, facade) {
            var res = r3_pipe_compiler_1.compilePipeFromMetadata({
                name: facade.name,
                type: new output_ast_1.WrappedNodeExpr(facade.type),
                deps: convertR3DependencyMetadataArray(facade.deps),
                pipeName: facade.pipeName,
                pure: facade.pure,
            });
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, res.statements);
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
                ctorDeps: convertR3DependencyMetadataArray(facade.ctorDeps),
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
                imports: new output_ast_1.WrappedNodeExpr(facade.imports),
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
                schemas: facade.schemas ? facade.schemas.map(wrapReference) : null,
            };
            var res = r3_module_compiler_1.compileNgModule(meta);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
        };
        CompilerFacadeImpl.prototype.compileDirective = function (angularCoreEnv, sourceMapUrl, facade) {
            var constantPool = new constant_pool_1.ConstantPool();
            var bindingParser = template_1.makeBindingParser();
            var meta = convertDirectiveFacadeToMetadata(facade);
            var res = compiler_1.compileDirectiveFromMetadata(meta, constantPool, bindingParser);
            var preStatements = tslib_1.__spread(constantPool.statements, res.statements);
            return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, preStatements);
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
            var res = compiler_1.compileComponentFromMetadata(tslib_1.__assign({}, facade, convertDirectiveFacadeToMetadata(facade), { selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(), template: template, viewQueries: facade.viewQueries.map(convertToR3QueryMetadata), wrapDirectivesAndPipesInClosure: false, styles: facade.styles || [], encapsulation: facade.encapsulation, interpolation: interpolationConfig, changeDetection: facade.changeDetection, animations: facade.animations != null ? new output_ast_1.WrappedNodeExpr(facade.animations) : null, viewProviders: facade.viewProviders != null ? new output_ast_1.WrappedNodeExpr(facade.viewProviders) :
                    null, relativeContextFilePath: '', i18nUseExternalIds: true }), constantPool, template_1.makeBindingParser(interpolationConfig));
            var preStatements = tslib_1.__spread(constantPool.statements, res.statements);
            return this.jitExpression(res.expression, angularCoreEnv, "ng:///" + facade.name + ".js", preStatements);
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
        return tslib_1.__assign({}, facade, { predicate: Array.isArray(facade.predicate) ? facade.predicate :
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
        return tslib_1.__assign({}, facade, { typeSourceSpan: facade.typeSourceSpan, type: new output_ast_1.WrappedNodeExpr(facade.type), deps: convertR3DependencyMetadataArray(facade.deps), host: extractHostBindings(facade.host, facade.propMetadata, facade.typeSourceSpan), inputs: tslib_1.__assign({}, inputsFromMetadata, inputsFromType), outputs: tslib_1.__assign({}, outputsFromMetadata, outputsFromType), queries: facade.queries.map(convertToR3QueryMetadata), providers: facade.providers != null ? new output_ast_1.WrappedNodeExpr(facade.providers) : null });
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
    function extractHostBindings(host, propMetadata, sourceSpan) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUlILHFFQUE2QztJQUU3QyxxRkFBMEQ7SUFDMUQsNkZBQW1HO0lBQ25HLHNFQUFzSDtJQUN0SCxzRUFBaUQ7SUFDakQsK0RBQThFO0lBQzlFLHVFQUFvRjtJQUNwRiwrREFBZ0Q7SUFDaEQsdUZBQXNIO0lBQ3RILG1GQUFtRTtJQUduRSx3RUFBOEo7SUFDOUosd0VBQXlFO0lBQ3pFLHdHQUE4RTtJQUU5RTtRQUlFLDRCQUFvQixZQUFpQztZQUFqQyw2QkFBQSxFQUFBLG1CQUFtQix5QkFBWSxFQUFFO1lBQWpDLGlCQUFZLEdBQVosWUFBWSxDQUFxQjtZQUhyRCw2QkFBd0IsR0FBRyxxQ0FBK0IsQ0FBQztZQUNuRCwwQkFBcUIsR0FBRyxJQUFJLHNEQUF3QixFQUFFLENBQUM7UUFFUCxDQUFDO1FBRXpELHdDQUFXLEdBQVgsVUFBWSxjQUErQixFQUFFLFlBQW9CLEVBQUUsTUFBNEI7WUFFN0YsSUFBTSxHQUFHLEdBQUcsMENBQXVCLENBQUM7Z0JBQ2xDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtnQkFDakIsSUFBSSxFQUFFLElBQUksNEJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUN0QyxJQUFJLEVBQUUsZ0NBQWdDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDbkQsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO2dCQUN6QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7YUFDbEIsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMs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O0lBRUQsU0FBUyxRQUFRLENBQUMsS0FBVTtRQUMxQixPQUFPLEtBQUssQ0FBQyxjQUFjLEtBQUssUUFBUSxDQUFDO0lBQzNDLENBQUM7SUFFRCxTQUFTLGlCQUFpQixDQUFDLE1BQWdCO1FBQ3pDLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FDaEIsVUFBQyxHQUFHLEVBQUUsS0FBSztZQUNILElBQUEsdUZBQStELEVBQTlELGFBQUssRUFBRSxnQkFBdUQsQ0FBQztZQUN0RSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsUUFBUSxJQUFJLEtBQUssQ0FBQztZQUMvQixPQUFPLEdBQUcsQ0FBQztRQUNiLENBQUMsRUFDRCxFQUFlLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBRUQsU0FBZ0IsYUFBYSxDQUFDLE1BQVc7UUFDdkMsSUFBTSxFQUFFLEdBQTJCLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLEVBQUUsQ0FBQyxlQUFlLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO0lBQ2hELENBQUM7SUFIRCxzQ0FHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge0NvbXBpbGVyRmFjYWRlLCBDb3JlRW52aXJvbm1lbnQsIEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUsIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUsIFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlLCBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlLCBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSwgUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlLCBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUsIFIzUGlwZU1ldGFkYXRhRmFjYWRlLCBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUsIFN0cmluZ01hcCwgU3RyaW5nTWFwV2l0aFJlbmFtZX0gZnJvbSAnLi9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtIb3N0QmluZGluZywgSG9zdExpc3RlbmVyLCBJbnB1dCwgT3V0cHV0LCBUeXBlfSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtjb21waWxlSW5qZWN0YWJsZX0gZnJvbSAnLi9pbmplY3RhYmxlX2NvbXBpbGVyXzInO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge0RlY2xhcmVWYXJTdG10LCBFeHByZXNzaW9uLCBMaXRlcmFsRXhwciwgU3RhdGVtZW50LCBTdG10TW9kaWZpZXIsIFdyYXBwZWROb2RlRXhwcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0ppdEV2YWx1YXRvcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2ppdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3BhbiwgcjNKaXRUeXBlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZX0gZnJvbSAnLi9yZW5kZXIzL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtSM0ppdFJlZmxlY3Rvcn0gZnJvbSAnLi9yZW5kZXIzL3IzX2ppdCc7XG5pbXBvcnQge1IzSW5qZWN0b3JNZXRhZGF0YSwgUjNOZ01vZHVsZU1ldGFkYXRhLCBjb21waWxlSW5qZWN0b3IsIGNvbXBpbGVOZ01vZHVsZX0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfcGlwZV9jb21waWxlcic7XG5pbXBvcnQge1IzUmVmZXJlbmNlfSBmcm9tICcuL3JlbmRlcjMvdXRpbCc7XG5pbXBvcnQge1IzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmltcG9ydCB7UGFyc2VkSG9zdEJpbmRpbmdzLCBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhLCBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBwYXJzZUhvc3RCaW5kaW5ncywgdmVyaWZ5SG9zdEJpbmRpbmdzfSBmcm9tICcuL3JlbmRlcjMvdmlldy9jb21waWxlcic7XG5pbXBvcnQge21ha2VCaW5kaW5nUGFyc2VyLCBwYXJzZVRlbXBsYXRlfSBmcm9tICcuL3JlbmRlcjMvdmlldy90ZW1wbGF0ZSc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcblxuZXhwb3J0IGNsYXNzIENvbXBpbGVyRmFjYWRlSW1wbCBpbXBsZW1lbnRzIENvbXBpbGVyRmFjYWRlIHtcbiAgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlID0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlIGFzIGFueTtcbiAgcHJpdmF0ZSBlbGVtZW50U2NoZW1hUmVnaXN0cnkgPSBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBqaXRFdmFsdWF0b3IgPSBuZXcgSml0RXZhbHVhdG9yKCkpIHt9XG5cbiAgY29tcGlsZVBpcGUoYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIGZhY2FkZTogUjNQaXBlTWV0YWRhdGFGYWNhZGUpOlxuICAgICAgYW55IHtcbiAgICBjb25zdCByZXMgPSBjb21waWxlUGlwZUZyb21NZXRhZGF0YSh7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgICAgcGlwZU5hbWU6IGZhY2FkZS5waXBlTmFtZSxcbiAgICAgIHB1cmU6IGZhY2FkZS5wdXJlLFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIHJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RhYmxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzSW5qZWN0YWJsZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCB7ZXhwcmVzc2lvbiwgc3RhdGVtZW50c30gPSBjb21waWxlSW5qZWN0YWJsZSh7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IGZhY2FkZS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgIHByb3ZpZGVkSW46IGNvbXB1dGVQcm92aWRlZEluKGZhY2FkZS5wcm92aWRlZEluKSxcbiAgICAgIHVzZUNsYXNzOiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9DTEFTUyksXG4gICAgICB1c2VGYWN0b3J5OiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9GQUNUT1JZKSxcbiAgICAgIHVzZVZhbHVlOiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9WQUxVRSksXG4gICAgICB1c2VFeGlzdGluZzogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRVhJU1RJTkcpLFxuICAgICAgY3RvckRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS5jdG9yRGVwcyksXG4gICAgICB1c2VyRGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLnVzZXJEZXBzKSB8fCB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKGV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIHN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUluamVjdG9yKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzSW5qZWN0b3JNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNJbmplY3Rvck1ldGFkYXRhID0ge1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS5kZXBzKSxcbiAgICAgIHByb3ZpZGVyczogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJvdmlkZXJzKSxcbiAgICAgIGltcG9ydHM6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmltcG9ydHMpLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUluamVjdG9yKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIHJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVOZ01vZHVsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzTmdNb2R1bGVNZXRhZGF0YSA9IHtcbiAgICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgYm9vdHN0cmFwOiBmYWNhZGUuYm9vdHN0cmFwLm1hcCh3cmFwUmVmZXJlbmNlKSxcbiAgICAgIGRlY2xhcmF0aW9uczogZmFjYWRlLmRlY2xhcmF0aW9ucy5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBpbXBvcnRzOiBmYWNhZGUuaW1wb3J0cy5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBleHBvcnRzOiBmYWNhZGUuZXhwb3J0cy5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBlbWl0SW5saW5lOiB0cnVlLFxuICAgICAgc2NoZW1hczogZmFjYWRlLnNjaGVtYXMgPyBmYWNhZGUuc2NoZW1hcy5tYXAod3JhcFJlZmVyZW5jZSkgOiBudWxsLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZU5nTW9kdWxlKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVEaXJlY3RpdmUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuICAgIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuXG4gICAgY29uc3QgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSA9IGNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZSk7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICAgIGNvbnN0IHByZVN0YXRlbWVudHMgPSBbLi4uY29uc3RhbnRQb29sLnN0YXRlbWVudHMsIC4uLnJlcy5zdGF0ZW1lbnRzXTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBwcmVTdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVDb21wb25lbnQoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgLy8gVGhlIENvbnN0YW50UG9vbCBpcyBhIHJlcXVpcmVtZW50IG9mIHRoZSBKSVQnZXIuXG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuXG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbkNvbmZpZyA9IGZhY2FkZS5pbnRlcnBvbGF0aW9uID9cbiAgICAgICAgSW50ZXJwb2xhdGlvbkNvbmZpZy5mcm9tQXJyYXkoZmFjYWRlLmludGVycG9sYXRpb24pIDpcbiAgICAgICAgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRztcbiAgICAvLyBQYXJzZSB0aGUgdGVtcGxhdGUgYW5kIGNoZWNrIGZvciBlcnJvcnMuXG4gICAgY29uc3QgdGVtcGxhdGUgPSBwYXJzZVRlbXBsYXRlKFxuICAgICAgICBmYWNhZGUudGVtcGxhdGUsIHNvdXJjZU1hcFVybCxcbiAgICAgICAge3ByZXNlcnZlV2hpdGVzcGFjZXM6IGZhY2FkZS5wcmVzZXJ2ZVdoaXRlc3BhY2VzLCBpbnRlcnBvbGF0aW9uQ29uZmlnfSk7XG4gICAgaWYgKHRlbXBsYXRlLmVycm9ycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBlcnJvcnMgPSB0ZW1wbGF0ZS5lcnJvcnMubWFwKGVyciA9PiBlcnIudG9TdHJpbmcoKSkuam9pbignLCAnKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3JzIGR1cmluZyBKSVQgY29tcGlsYXRpb24gb2YgdGVtcGxhdGUgZm9yICR7ZmFjYWRlLm5hbWV9OiAke2Vycm9yc31gKTtcbiAgICB9XG5cbiAgICAvLyBDb21waWxlIHRoZSBjb21wb25lbnQgbWV0YWRhdGEsIGluY2x1ZGluZyB0ZW1wbGF0ZSwgaW50byBhbiBleHByZXNzaW9uLlxuICAgIC8vIFRPRE8oYWx4aHViKTogaW1wbGVtZW50IGlucHV0cywgb3V0cHV0cywgcXVlcmllcywgZXRjLlxuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgICAgIHtcbiAgICAgICAgICAuLi5mYWNhZGUgYXMgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZU5vUHJvcEFuZFdoaXRlc3BhY2UsXG4gICAgICAgICAgLi4uY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlKSxcbiAgICAgICAgICBzZWxlY3RvcjogZmFjYWRlLnNlbGVjdG9yIHx8IHRoaXMuZWxlbWVudFNjaGVtYVJlZ2lzdHJ5LmdldERlZmF1bHRDb21wb25lbnRFbGVtZW50TmFtZSgpLFxuICAgICAgICAgIHRlbXBsYXRlLFxuICAgICAgICAgIHZpZXdRdWVyaWVzOiBmYWNhZGUudmlld1F1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgICAgICAgd3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZTogZmFsc2UsXG4gICAgICAgICAgc3R5bGVzOiBmYWNhZGUuc3R5bGVzIHx8IFtdLFxuICAgICAgICAgIGVuY2Fwc3VsYXRpb246IGZhY2FkZS5lbmNhcHN1bGF0aW9uIGFzIGFueSxcbiAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgICAgICAgIGNoYW5nZURldGVjdGlvbjogZmFjYWRlLmNoYW5nZURldGVjdGlvbixcbiAgICAgICAgICBhbmltYXRpb25zOiBmYWNhZGUuYW5pbWF0aW9ucyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuYW5pbWF0aW9ucykgOiBudWxsLFxuICAgICAgICAgIHZpZXdQcm92aWRlcnM6IGZhY2FkZS52aWV3UHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS52aWV3UHJvdmlkZXJzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgICAgICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgY29uc3RhbnRQb29sLCBtYWtlQmluZGluZ1BhcnNlcihpbnRlcnBvbGF0aW9uQ29uZmlnKSk7XG4gICAgY29uc3QgcHJlU3RhdGVtZW50cyA9IFsuLi5jb25zdGFudFBvb2wuc3RhdGVtZW50cywgLi4ucmVzLnN0YXRlbWVudHNdO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgYG5nOi8vLyR7ZmFjYWRlLm5hbWV9LmpzYCwgcHJlU3RhdGVtZW50cyk7XG4gIH1cblxuICBjcmVhdGVQYXJzZVNvdXJjZVNwYW4oa2luZDogc3RyaW5nLCB0eXBlTmFtZTogc3RyaW5nLCBzb3VyY2VVcmw6IHN0cmluZyk6IFBhcnNlU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIHIzSml0VHlwZVNvdXJjZVNwYW4oa2luZCwgdHlwZU5hbWUsIHNvdXJjZVVybCk7XG4gIH1cblxuICAvKipcbiAgICogSklUIGNvbXBpbGVzIGFuIGV4cHJlc3Npb24gYW5kIHJldHVybnMgdGhlIHJlc3VsdCBvZiBleGVjdXRpbmcgdGhhdCBleHByZXNzaW9uLlxuICAgKlxuICAgKiBAcGFyYW0gZGVmIHRoZSBkZWZpbml0aW9uIHdoaWNoIHdpbGwgYmUgY29tcGlsZWQgYW5kIGV4ZWN1dGVkIHRvIGdldCB0aGUgdmFsdWUgdG8gcGF0Y2hcbiAgICogQHBhcmFtIGNvbnRleHQgYW4gb2JqZWN0IG1hcCBvZiBAYW5ndWxhci9jb3JlIHN5bWJvbCBuYW1lcyB0byBzeW1ib2xzIHdoaWNoIHdpbGwgYmUgYXZhaWxhYmxlXG4gICAqIGluIHRoZSBjb250ZXh0IG9mIHRoZSBjb21waWxlZCBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBzb3VyY2VVcmwgYSBVUkwgdG8gdXNlIGZvciB0aGUgc291cmNlIG1hcCBvZiB0aGUgY29tcGlsZWQgZXhwcmVzc2lvblxuICAgKiBAcGFyYW0gcHJlU3RhdGVtZW50cyBhIGNvbGxlY3Rpb24gb2Ygc3RhdGVtZW50cyB0aGF0IHNob3VsZCBiZSBldmFsdWF0ZWQgYmVmb3JlIHRoZSBleHByZXNzaW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBqaXRFeHByZXNzaW9uKFxuICAgICAgZGVmOiBFeHByZXNzaW9uLCBjb250ZXh0OiB7W2tleTogc3RyaW5nXTogYW55fSwgc291cmNlVXJsOiBzdHJpbmcsXG4gICAgICBwcmVTdGF0ZW1lbnRzOiBTdGF0ZW1lbnRbXSk6IGFueSB7XG4gICAgLy8gVGhlIENvbnN0YW50UG9vbCBtYXkgY29udGFpbiBTdGF0ZW1lbnRzIHdoaWNoIGRlY2xhcmUgdmFyaWFibGVzIHVzZWQgaW4gdGhlIGZpbmFsIGV4cHJlc3Npb24uXG4gICAgLy8gVGhlcmVmb3JlLCBpdHMgc3RhdGVtZW50cyBuZWVkIHRvIHByZWNlZGUgdGhlIGFjdHVhbCBKSVQgb3BlcmF0aW9uLiBUaGUgZmluYWwgc3RhdGVtZW50IGlzIGFcbiAgICAvLyBkZWNsYXJhdGlvbiBvZiAkZGVmIHdoaWNoIGlzIHNldCB0byB0aGUgZXhwcmVzc2lvbiBiZWluZyBjb21waWxlZC5cbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBTdGF0ZW1lbnRbXSA9IFtcbiAgICAgIC4uLnByZVN0YXRlbWVudHMsXG4gICAgICBuZXcgRGVjbGFyZVZhclN0bXQoJyRkZWYnLCBkZWYsIHVuZGVmaW5lZCwgW1N0bXRNb2RpZmllci5FeHBvcnRlZF0pLFxuICAgIF07XG5cbiAgICBjb25zdCByZXMgPSB0aGlzLmppdEV2YWx1YXRvci5ldmFsdWF0ZVN0YXRlbWVudHMoXG4gICAgICAgIHNvdXJjZVVybCwgc3RhdGVtZW50cywgbmV3IFIzSml0UmVmbGVjdG9yKGNvbnRleHQpLCAvKiBlbmFibGVTb3VyY2VNYXBzICovIHRydWUpO1xuICAgIHJldHVybiByZXNbJyRkZWYnXTtcbiAgfVxufVxuXG4vLyBUaGlzIHNlZW1zIHRvIGJlIG5lZWRlZCB0byBwbGFjYXRlIFRTIHYzLjAgb25seVxudHlwZSBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSA9IFBpY2s8XG4gICAgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSxcbiAgICBFeGNsdWRlPEV4Y2x1ZGU8a2V5b2YgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZSwgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnPiwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuY29uc3QgVVNFX0NMQVNTID0gT2JqZWN0LmtleXMoe3VzZUNsYXNzOiBudWxsfSlbMF07XG5jb25zdCBVU0VfRkFDVE9SWSA9IE9iamVjdC5rZXlzKHt1c2VGYWN0b3J5OiBudWxsfSlbMF07XG5jb25zdCBVU0VfVkFMVUUgPSBPYmplY3Qua2V5cyh7dXNlVmFsdWU6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9FWElTVElORyA9IE9iamVjdC5rZXlzKHt1c2VFeGlzdGluZzogbnVsbH0pWzBdO1xuXG5jb25zdCB3cmFwUmVmZXJlbmNlID0gZnVuY3Rpb24odmFsdWU6IFR5cGUpOiBSM1JlZmVyZW5jZSB7XG4gIGNvbnN0IHdyYXBwZWQgPSBuZXcgV3JhcHBlZE5vZGVFeHByKHZhbHVlKTtcbiAgcmV0dXJuIHt2YWx1ZTogd3JhcHBlZCwgdHlwZTogd3JhcHBlZH07XG59O1xuXG5mdW5jdGlvbiBjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEoZmFjYWRlOiBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUpOiBSM1F1ZXJ5TWV0YWRhdGEge1xuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSxcbiAgICBwcmVkaWNhdGU6IEFycmF5LmlzQXJyYXkoZmFjYWRlLnByZWRpY2F0ZSkgPyBmYWNhZGUucHJlZGljYXRlIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcmVkaWNhdGUpLFxuICAgIHJlYWQ6IGZhY2FkZS5yZWFkID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucmVhZCkgOiBudWxsLFxuICAgIHN0YXRpYzogZmFjYWRlLnN0YXRpY1xuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgY29uc3QgaW5wdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dE91dHB1dHMoZmFjYWRlLmlucHV0cyB8fCBbXSk7XG4gIGNvbnN0IG91dHB1dHNGcm9tTWV0YWRhdGEgPSBwYXJzZUlucHV0T3V0cHV0cyhmYWNhZGUub3V0cHV0cyB8fCBbXSk7XG4gIGNvbnN0IHByb3BNZXRhZGF0YSA9IGZhY2FkZS5wcm9wTWV0YWRhdGE7XG4gIGNvbnN0IGlucHV0c0Zyb21UeXBlOiBTdHJpbmdNYXBXaXRoUmVuYW1lID0ge307XG4gIGNvbnN0IG91dHB1dHNGcm9tVHlwZTogU3RyaW5nTWFwID0ge307XG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNJbnB1dChhbm4pKSB7XG4gICAgICAgICAgaW5wdXRzRnJvbVR5cGVbZmllbGRdID1cbiAgICAgICAgICAgICAgYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUgPyBbYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUsIGZpZWxkXSA6IGZpZWxkO1xuICAgICAgICB9IGVsc2UgaWYgKGlzT3V0cHV0KGFubikpIHtcbiAgICAgICAgICBvdXRwdXRzRnJvbVR5cGVbZmllbGRdID0gYW5uLmJpbmRpbmdQcm9wZXJ0eU5hbWUgfHwgZmllbGQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgLi4uZmFjYWRlIGFzIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlLFxuICAgIHR5cGVTb3VyY2VTcGFuOiBmYWNhZGUudHlwZVNvdXJjZVNwYW4sXG4gICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgIGhvc3Q6IGV4dHJhY3RIb3N0QmluZGluZ3MoZmFjYWRlLmhvc3QsIGZhY2FkZS5wcm9wTWV0YWRhdGEsIGZhY2FkZS50eXBlU291cmNlU3BhbiksXG4gICAgaW5wdXRzOiB7Li4uaW5wdXRzRnJvbU1ldGFkYXRhLCAuLi5pbnB1dHNGcm9tVHlwZX0sXG4gICAgb3V0cHV0czogey4uLm91dHB1dHNGcm9tTWV0YWRhdGEsIC4uLm91dHB1dHNGcm9tVHlwZX0sXG4gICAgcXVlcmllczogZmFjYWRlLnF1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBmYWNhZGUucHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpIDogbnVsbCxcbiAgfTtcbn1cblxuLy8gVGhpcyBzZWVtcyB0byBiZSBuZWVkZWQgdG8gcGxhY2F0ZSBUUyB2My4wIG9ubHlcbnR5cGUgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZU5vUHJvcEFuZFdoaXRlc3BhY2UgPVxuICAgIFBpY2s8UjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgRXhjbHVkZTxrZXlvZiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlLCAncHJvcE1ldGFkYXRhJz4+O1xuXG5mdW5jdGlvbiB3cmFwRXhwcmVzc2lvbihvYmo6IGFueSwgcHJvcGVydHk6IHN0cmluZyk6IFdyYXBwZWROb2RlRXhwcjxhbnk+fHVuZGVmaW5lZCB7XG4gIGlmIChvYmouaGFzT3duUHJvcGVydHkocHJvcGVydHkpKSB7XG4gICAgcmV0dXJuIG5ldyBXcmFwcGVkTm9kZUV4cHIob2JqW3Byb3BlcnR5XSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb21wdXRlUHJvdmlkZWRJbihwcm92aWRlZEluOiBUeXBlIHwgc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IEV4cHJlc3Npb24ge1xuICBpZiAocHJvdmlkZWRJbiA9PSBudWxsIHx8IHR5cGVvZiBwcm92aWRlZEluID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBuZXcgTGl0ZXJhbEV4cHIocHJvdmlkZWRJbik7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBXcmFwcGVkTm9kZUV4cHIocHJvdmlkZWRJbik7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhKGZhY2FkZTogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGUpOiBSM0RlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIGxldCB0b2tlbkV4cHI7XG4gIGlmIChmYWNhZGUudG9rZW4gPT09IG51bGwpIHtcbiAgICB0b2tlbkV4cHIgPSBuZXcgTGl0ZXJhbEV4cHIobnVsbCk7XG4gIH0gZWxzZSBpZiAoZmFjYWRlLnJlc29sdmVkID09PSBSM1Jlc29sdmVkRGVwZW5kZW5jeVR5cGUuQXR0cmlidXRlKSB7XG4gICAgdG9rZW5FeHByID0gbmV3IExpdGVyYWxFeHByKGZhY2FkZS50b2tlbik7XG4gIH0gZWxzZSB7XG4gICAgdG9rZW5FeHByID0gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudG9rZW4pO1xuICB9XG4gIHJldHVybiB7XG4gICAgdG9rZW46IHRva2VuRXhwcixcbiAgICByZXNvbHZlZDogZmFjYWRlLnJlc29sdmVkLFxuICAgIGhvc3Q6IGZhY2FkZS5ob3N0LFxuICAgIG9wdGlvbmFsOiBmYWNhZGUub3B0aW9uYWwsXG4gICAgc2VsZjogZmFjYWRlLnNlbGYsXG4gICAgc2tpcFNlbGY6IGZhY2FkZS5za2lwU2VsZlxuICB9O1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGVzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YUZhY2FkZVtdIHwgbnVsbCB8IHVuZGVmaW5lZCk6XG4gICAgUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXxudWxsIHtcbiAgcmV0dXJuIGZhY2FkZXMgPT0gbnVsbCA/IG51bGwgOiBmYWNhZGVzLm1hcChjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGEpO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0SG9zdEJpbmRpbmdzKFxuICAgIGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LCBwcm9wTWV0YWRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnlbXX0sXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgLy8gRmlyc3QgcGFyc2UgdGhlIGRlY2xhcmF0aW9ucyBmcm9tIHRoZSBtZXRhZGF0YS5cbiAgY29uc3QgYmluZGluZ3MgPSBwYXJzZUhvc3RCaW5kaW5ncyhob3N0IHx8IHt9KTtcblxuICAvLyBBZnRlciB0aGF0IGNoZWNrIGhvc3QgYmluZGluZ3MgZm9yIGVycm9yc1xuICBjb25zdCBlcnJvcnMgPSB2ZXJpZnlIb3N0QmluZGluZ3MoYmluZGluZ3MsIHNvdXJjZVNwYW4pO1xuICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMubWFwKChlcnJvcjogUGFyc2VFcnJvcikgPT4gZXJyb3IubXNnKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICAvLyBOZXh0LCBsb29wIG92ZXIgdGhlIHByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCwgbG9va2luZyBmb3IgQEhvc3RCaW5kaW5nIGFuZCBASG9zdExpc3RlbmVyLlxuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSG9zdEJpbmRpbmcoYW5uKSkge1xuICAgICAgICAgIGJpbmRpbmdzLnByb3BlcnRpZXNbYW5uLmhvc3RQcm9wZXJ0eU5hbWUgfHwgZmllbGRdID0gZmllbGQ7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNIb3N0TGlzdGVuZXIoYW5uKSkge1xuICAgICAgICAgIGJpbmRpbmdzLmxpc3RlbmVyc1thbm4uZXZlbnROYW1lIHx8IGZpZWxkXSA9IGAke2ZpZWxkfSgkeyhhbm4uYXJncyB8fCBbXSkuam9pbignLCcpfSlgO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmluZGluZ3M7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdEJpbmRpbmcodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RCaW5kaW5nIHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSG9zdEJpbmRpbmcnO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RMaXN0ZW5lcih2YWx1ZTogYW55KTogdmFsdWUgaXMgSG9zdExpc3RlbmVyIHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSG9zdExpc3RlbmVyJztcbn1cblxuXG5mdW5jdGlvbiBpc0lucHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBJbnB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0lucHV0Jztcbn1cblxuZnVuY3Rpb24gaXNPdXRwdXQodmFsdWU6IGFueSk6IHZhbHVlIGlzIE91dHB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ091dHB1dCc7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSW5wdXRPdXRwdXRzKHZhbHVlczogc3RyaW5nW10pOiBTdHJpbmdNYXAge1xuICByZXR1cm4gdmFsdWVzLnJlZHVjZShcbiAgICAgIChtYXAsIHZhbHVlKSA9PiB7XG4gICAgICAgIGNvbnN0IFtmaWVsZCwgcHJvcGVydHldID0gdmFsdWUuc3BsaXQoJywnKS5tYXAocGllY2UgPT4gcGllY2UudHJpbSgpKTtcbiAgICAgICAgbWFwW2ZpZWxkXSA9IHByb3BlcnR5IHx8IGZpZWxkO1xuICAgICAgICByZXR1cm4gbWFwO1xuICAgICAgfSxcbiAgICAgIHt9IGFzIFN0cmluZ01hcCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdWJsaXNoRmFjYWRlKGdsb2JhbDogYW55KSB7XG4gIGNvbnN0IG5nOiBFeHBvcnRlZENvbXBpbGVyRmFjYWRlID0gZ2xvYmFsLm5nIHx8IChnbG9iYWwubmcgPSB7fSk7XG4gIG5nLsm1Y29tcGlsZXJGYWNhZGUgPSBuZXcgQ29tcGlsZXJGYWNhZGVJbXBsKCk7XG59XG4iXX0=