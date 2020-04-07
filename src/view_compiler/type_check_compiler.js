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
        define("@angular/compiler/src/view_compiler/type_check_compiler", ["require", "exports", "tslib", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/template_parser/template_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var static_symbol_1 = require("@angular/compiler/src/aot/static_symbol");
    var expression_converter_1 = require("@angular/compiler/src/compiler_util/expression_converter");
    var o = require("@angular/compiler/src/output/output_ast");
    var template_ast_1 = require("@angular/compiler/src/template_parser/template_ast");
    /**
     * Generates code that is used to type check templates.
     */
    var TypeCheckCompiler = /** @class */ (function () {
        function TypeCheckCompiler(options, reflector) {
            this.options = options;
            this.reflector = reflector;
        }
        /**
         * Important notes:
         * - This must not produce new `import` statements, but only refer to types outside
         *   of the file via the variables provided via externalReferenceVars.
         *   This allows Typescript to reuse the old program's structure as no imports have changed.
         * - This must not produce any exports, as this would pollute the .d.ts file
         *   and also violate the point above.
         */
        TypeCheckCompiler.prototype.compileComponent = function (componentId, component, template, usedPipes, externalReferenceVars, ctx) {
            var _this = this;
            var pipes = new Map();
            usedPipes.forEach(function (p) { return pipes.set(p.name, p.type.reference); });
            var embeddedViewCount = 0;
            var viewBuilderFactory = function (parent, guards) {
                var embeddedViewIndex = embeddedViewCount++;
                return new ViewBuilder(_this.options, _this.reflector, externalReferenceVars, parent, component.type.reference, component.isHost, embeddedViewIndex, pipes, guards, ctx, viewBuilderFactory);
            };
            var visitor = viewBuilderFactory(null, []);
            visitor.visitAll([], template);
            return visitor.build(componentId);
        };
        return TypeCheckCompiler;
    }());
    exports.TypeCheckCompiler = TypeCheckCompiler;
    var DYNAMIC_VAR_NAME = '_any';
    var TypeCheckLocalResolver = /** @class */ (function () {
        function TypeCheckLocalResolver() {
        }
        TypeCheckLocalResolver.prototype.notifyImplicitReceiverUse = function () { };
        TypeCheckLocalResolver.prototype.getLocal = function (name) {
            if (name === expression_converter_1.EventHandlerVars.event.name) {
                // References to the event should not be type-checked.
                // TODO(chuckj): determine a better type for the event.
                return o.variable(DYNAMIC_VAR_NAME);
            }
            return null;
        };
        return TypeCheckLocalResolver;
    }());
    var defaultResolver = new TypeCheckLocalResolver();
    var ViewBuilder = /** @class */ (function () {
        function ViewBuilder(options, reflector, externalReferenceVars, parent, component, isHostComponent, embeddedViewIndex, pipes, guards, ctx, viewBuilderFactory) {
            this.options = options;
            this.reflector = reflector;
            this.externalReferenceVars = externalReferenceVars;
            this.parent = parent;
            this.component = component;
            this.isHostComponent = isHostComponent;
            this.embeddedViewIndex = embeddedViewIndex;
            this.pipes = pipes;
            this.guards = guards;
            this.ctx = ctx;
            this.viewBuilderFactory = viewBuilderFactory;
            this.refOutputVars = new Map();
            this.variables = [];
            this.children = [];
            this.updates = [];
            this.actions = [];
        }
        ViewBuilder.prototype.getOutputVar = function (type) {
            var varName;
            if (type === this.component && this.isHostComponent) {
                varName = DYNAMIC_VAR_NAME;
            }
            else if (type instanceof static_symbol_1.StaticSymbol) {
                varName = this.externalReferenceVars.get(type);
            }
            else {
                varName = DYNAMIC_VAR_NAME;
            }
            if (!varName) {
                throw new Error("Illegal State: referring to a type without a variable " + JSON.stringify(type));
            }
            return varName;
        };
        ViewBuilder.prototype.getTypeGuardExpressions = function (ast) {
            var e_1, _a, e_2, _b;
            var result = tslib_1.__spread(this.guards);
            try {
                for (var _c = tslib_1.__values(ast.directives), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var directive = _d.value;
                    try {
                        for (var _e = (e_2 = void 0, tslib_1.__values(directive.inputs)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var input = _f.value;
                            var guard = directive.directive.guards[input.directiveName];
                            if (guard) {
                                var useIf = guard === 'UseIf';
                                result.push({
                                    guard: guard,
                                    useIf: useIf,
                                    expression: {
                                        context: this.component,
                                        value: input.value,
                                        sourceSpan: input.sourceSpan,
                                    },
                                });
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return result;
        };
        ViewBuilder.prototype.visitAll = function (variables, astNodes) {
            this.variables = variables;
            template_ast_1.templateVisitAll(this, astNodes);
        };
        ViewBuilder.prototype.build = function (componentId, targetStatements) {
            var e_3, _a;
            var _this = this;
            if (targetStatements === void 0) { targetStatements = []; }
            this.children.forEach(function (child) { return child.build(componentId, targetStatements); });
            var viewStmts = [o.variable(DYNAMIC_VAR_NAME).set(o.NULL_EXPR).toDeclStmt(o.DYNAMIC_TYPE)];
            var bindingCount = 0;
            this.updates.forEach(function (expression) {
                var _a = _this.preprocessUpdateExpression(expression), sourceSpan = _a.sourceSpan, context = _a.context, value = _a.value;
                var bindingId = "" + bindingCount++;
                var nameResolver = context === _this.component ? _this : defaultResolver;
                var _b = expression_converter_1.convertPropertyBinding(nameResolver, o.variable(_this.getOutputVar(context)), value, bindingId, expression_converter_1.BindingForm.General), stmts = _b.stmts, currValExpr = _b.currValExpr;
                stmts.push(new o.ExpressionStatement(currValExpr));
                viewStmts.push.apply(viewStmts, tslib_1.__spread(stmts.map(function (stmt) { return o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan); })));
            });
            this.actions.forEach(function (_a) {
                var sourceSpan = _a.sourceSpan, context = _a.context, value = _a.value;
                var bindingId = "" + bindingCount++;
                var nameResolver = context === _this.component ? _this : defaultResolver;
                var stmts = expression_converter_1.convertActionBinding(nameResolver, o.variable(_this.getOutputVar(context)), value, bindingId).stmts;
                viewStmts.push.apply(viewStmts, tslib_1.__spread(stmts.map(function (stmt) { return o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan); })));
            });
            if (this.guards.length) {
                var guardExpression = undefined;
                try {
                    for (var _b = tslib_1.__values(this.guards), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var guard = _c.value;
                        var _d = this.preprocessUpdateExpression(guard.expression), context = _d.context, value = _d.value;
                        var bindingId = "" + bindingCount++;
                        var nameResolver = context === this.component ? this : defaultResolver;
                        // We only support support simple expressions and ignore others as they
                        // are unlikely to affect type narrowing.
                        var _e = expression_converter_1.convertPropertyBinding(nameResolver, o.variable(this.getOutputVar(context)), value, bindingId, expression_converter_1.BindingForm.TrySimple), stmts = _e.stmts, currValExpr = _e.currValExpr;
                        if (stmts.length == 0) {
                            var guardClause = guard.useIf ? currValExpr : this.ctx.importExpr(guard.guard).callFn([currValExpr]);
                            guardExpression = guardExpression ? guardExpression.and(guardClause) : guardClause;
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                if (guardExpression) {
                    viewStmts = [new o.IfStmt(guardExpression, viewStmts)];
                }
            }
            var viewName = "_View_" + componentId + "_" + this.embeddedViewIndex;
            var viewFactory = new o.DeclareFunctionStmt(viewName, [], viewStmts);
            targetStatements.push(viewFactory);
            return targetStatements;
        };
        ViewBuilder.prototype.visitBoundText = function (ast, context) {
            var _this = this;
            var astWithSource = ast.value;
            var inter = astWithSource.ast;
            inter.expressions.forEach(function (expr) {
                return _this.updates.push({ context: _this.component, value: expr, sourceSpan: ast.sourceSpan });
            });
        };
        ViewBuilder.prototype.visitEmbeddedTemplate = function (ast, context) {
            this.visitElementOrTemplate(ast);
            // Note: The old view compiler used to use an `any` type
            // for the context in any embedded view.
            // We keep this behaivor behind a flag for now.
            if (this.options.fullTemplateTypeCheck) {
                // Find any applicable type guards. For example, NgIf has a type guard on ngIf
                // (see NgIf.ngIfTypeGuard) that can be used to indicate that a template is only
                // stamped out if ngIf is truthy so any bindings in the template can assume that,
                // if a nullable type is used for ngIf, that expression is not null or undefined.
                var guards = this.getTypeGuardExpressions(ast);
                var childVisitor = this.viewBuilderFactory(this, guards);
                this.children.push(childVisitor);
                childVisitor.visitAll(ast.variables, ast.children);
            }
        };
        ViewBuilder.prototype.visitElement = function (ast, context) {
            var _this = this;
            this.visitElementOrTemplate(ast);
            var inputDefs = [];
            var updateRendererExpressions = [];
            var outputDefs = [];
            ast.inputs.forEach(function (inputAst) {
                _this.updates.push({ context: _this.component, value: inputAst.value, sourceSpan: inputAst.sourceSpan });
            });
            template_ast_1.templateVisitAll(this, ast.children);
        };
        ViewBuilder.prototype.visitElementOrTemplate = function (ast) {
            var _this = this;
            ast.directives.forEach(function (dirAst) { _this.visitDirective(dirAst); });
            ast.references.forEach(function (ref) {
                var outputVarType = null;
                // Note: The old view compiler used to use an `any` type
                // for directives exposed via `exportAs`.
                // We keep this behaivor behind a flag for now.
                if (ref.value && ref.value.identifier && _this.options.fullTemplateTypeCheck) {
                    outputVarType = ref.value.identifier.reference;
                }
                else {
                    outputVarType = o.BuiltinTypeName.Dynamic;
                }
                _this.refOutputVars.set(ref.name, outputVarType);
            });
            ast.outputs.forEach(function (outputAst) {
                _this.actions.push({ context: _this.component, value: outputAst.handler, sourceSpan: outputAst.sourceSpan });
            });
        };
        ViewBuilder.prototype.visitDirective = function (dirAst) {
            var _this = this;
            var dirType = dirAst.directive.type.reference;
            dirAst.inputs.forEach(function (input) { return _this.updates.push({ context: _this.component, value: input.value, sourceSpan: input.sourceSpan }); });
            // Note: The old view compiler used to use an `any` type
            // for expressions in host properties / events.
            // We keep this behaivor behind a flag for now.
            if (this.options.fullTemplateTypeCheck) {
                dirAst.hostProperties.forEach(function (inputAst) { return _this.updates.push({ context: dirType, value: inputAst.value, sourceSpan: inputAst.sourceSpan }); });
                dirAst.hostEvents.forEach(function (hostEventAst) { return _this.actions.push({
                    context: dirType,
                    value: hostEventAst.handler,
                    sourceSpan: hostEventAst.sourceSpan
                }); });
            }
        };
        ViewBuilder.prototype.notifyImplicitReceiverUse = function () { };
        ViewBuilder.prototype.getLocal = function (name) {
            if (name == expression_converter_1.EventHandlerVars.event.name) {
                return o.variable(this.getOutputVar(o.BuiltinTypeName.Dynamic));
            }
            for (var currBuilder = this; currBuilder; currBuilder = currBuilder.parent) {
                var outputVarType = void 0;
                // check references
                outputVarType = currBuilder.refOutputVars.get(name);
                if (outputVarType == null) {
                    // check variables
                    var varAst = currBuilder.variables.find(function (varAst) { return varAst.name === name; });
                    if (varAst) {
                        outputVarType = o.BuiltinTypeName.Dynamic;
                    }
                }
                if (outputVarType != null) {
                    return o.variable(this.getOutputVar(outputVarType));
                }
            }
            return null;
        };
        ViewBuilder.prototype.pipeOutputVar = function (name) {
            var pipe = this.pipes.get(name);
            if (!pipe) {
                throw new Error("Illegal State: Could not find pipe " + name + " in template of " + this.component);
            }
            return this.getOutputVar(pipe);
        };
        ViewBuilder.prototype.preprocessUpdateExpression = function (expression) {
            var _this = this;
            return {
                sourceSpan: expression.sourceSpan,
                context: expression.context,
                value: expression_converter_1.convertPropertyBindingBuiltins({
                    createLiteralArrayConverter: function (argCount) { return function (args) {
                        var arr = o.literalArr(args);
                        // Note: The old view compiler used to use an `any` type
                        // for arrays.
                        return _this.options.fullTemplateTypeCheck ? arr : arr.cast(o.DYNAMIC_TYPE);
                    }; },
                    createLiteralMapConverter: function (keys) { return function (values) {
                        var entries = keys.map(function (k, i) { return ({
                            key: k.key,
                            value: values[i],
                            quoted: k.quoted,
                        }); });
                        var map = o.literalMap(entries);
                        // Note: The old view compiler used to use an `any` type
                        // for maps.
                        return _this.options.fullTemplateTypeCheck ? map : map.cast(o.DYNAMIC_TYPE);
                    }; },
                    createPipeConverter: function (name, argCount) { return function (args) {
                        // Note: The old view compiler used to use an `any` type
                        // for pipes.
                        var pipeExpr = _this.options.fullTemplateTypeCheck ?
                            o.variable(_this.pipeOutputVar(name)) :
                            o.variable(_this.getOutputVar(o.BuiltinTypeName.Dynamic));
                        return pipeExpr.callMethod('transform', args);
                    }; },
                }, expression.value)
            };
        };
        ViewBuilder.prototype.visitNgContent = function (ast, context) { };
        ViewBuilder.prototype.visitText = function (ast, context) { };
        ViewBuilder.prototype.visitDirectiveProperty = function (ast, context) { };
        ViewBuilder.prototype.visitReference = function (ast, context) { };
        ViewBuilder.prototype.visitVariable = function (ast, context) { };
        ViewBuilder.prototype.visitEvent = function (ast, context) { };
        ViewBuilder.prototype.visitElementProperty = function (ast, context) { };
        ViewBuilder.prototype.visitAttr = function (ast, context) { };
        return ViewBuilder;
    }());
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9jaGVja19jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy92aWV3X2NvbXBpbGVyL3R5cGVfY2hlY2tfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBSUgseUVBQWtEO0lBRWxELGlHQUFpTDtJQUVqTCwyREFBMEM7SUFFMUMsbUZBQTZSO0lBSTdSOztPQUVHO0lBQ0g7UUFDRSwyQkFBb0IsT0FBMkIsRUFBVSxTQUEwQjtZQUEvRCxZQUFPLEdBQVAsT0FBTyxDQUFvQjtZQUFVLGNBQVMsR0FBVCxTQUFTLENBQWlCO1FBQUcsQ0FBQztRQUV2Rjs7Ozs7OztXQU9HO1FBQ0gsNENBQWdCLEdBQWhCLFVBQ0ksV0FBbUIsRUFBRSxTQUFtQyxFQUFFLFFBQXVCLEVBQ2pGLFNBQStCLEVBQUUscUJBQWdELEVBQ2pGLEdBQWtCO1lBSHRCLGlCQW1CQztZQWZDLElBQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO1lBQzlDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBbkMsQ0FBbUMsQ0FBQyxDQUFDO1lBQzVELElBQUksaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO1lBQzFCLElBQU0sa0JBQWtCLEdBQ3BCLFVBQUMsTUFBMEIsRUFBRSxNQUF5QjtnQkFDcEQsSUFBTSxpQkFBaUIsR0FBRyxpQkFBaUIsRUFBRSxDQUFDO2dCQUM5QyxPQUFPLElBQUksV0FBVyxDQUNsQixLQUFJLENBQUMsT0FBTyxFQUFFLEtBQUksQ0FBQyxTQUFTLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUNyRixTQUFTLENBQUMsTUFBTSxFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDbkYsQ0FBQyxDQUFDO1lBRU4sSUFBTSxPQUFPLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBRS9CLE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBQ0gsd0JBQUM7SUFBRCxDQUFDLEFBL0JELElBK0JDO0lBL0JZLDhDQUFpQjtJQXFEOUIsSUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUM7SUFFaEM7UUFBQTtRQVVBLENBQUM7UUFUQywwREFBeUIsR0FBekIsY0FBbUMsQ0FBQztRQUNwQyx5Q0FBUSxHQUFSLFVBQVMsSUFBWTtZQUNuQixJQUFJLElBQUksS0FBSyx1Q0FBZ0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO2dCQUN4QyxzREFBc0Q7Z0JBQ3RELHVEQUF1RDtnQkFDdkQsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLENBQUM7YUFDckM7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDSCw2QkFBQztJQUFELENBQUMsQUFWRCxJQVVDO0lBRUQsSUFBTSxlQUFlLEdBQUcsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO0lBRXJEO1FBT0UscUJBQ1ksT0FBMkIsRUFBVSxTQUEwQixFQUMvRCxxQkFBZ0QsRUFBVSxNQUF3QixFQUNsRixTQUF1QixFQUFVLGVBQXdCLEVBQ3pELGlCQUF5QixFQUFVLEtBQWdDLEVBQ25FLE1BQXlCLEVBQVUsR0FBa0IsRUFDckQsa0JBQXNDO1lBTHRDLFlBQU8sR0FBUCxPQUFPLENBQW9CO1lBQVUsY0FBUyxHQUFULFNBQVMsQ0FBaUI7WUFDL0QsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUEyQjtZQUFVLFdBQU0sR0FBTixNQUFNLENBQWtCO1lBQ2xGLGNBQVMsR0FBVCxTQUFTLENBQWM7WUFBVSxvQkFBZSxHQUFmLGVBQWUsQ0FBUztZQUN6RCxzQkFBaUIsR0FBakIsaUJBQWlCLENBQVE7WUFBVSxVQUFLLEdBQUwsS0FBSyxDQUEyQjtZQUNuRSxXQUFNLEdBQU4sTUFBTSxDQUFtQjtZQUFVLFFBQUcsR0FBSCxHQUFHLENBQWU7WUFDckQsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtZQVoxQyxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUF5QixDQUFDO1lBQ2pELGNBQVMsR0FBa0IsRUFBRSxDQUFDO1lBQzlCLGFBQVEsR0FBa0IsRUFBRSxDQUFDO1lBQzdCLFlBQU8sR0FBaUIsRUFBRSxDQUFDO1lBQzNCLFlBQU8sR0FBaUIsRUFBRSxDQUFDO1FBUWtCLENBQUM7UUFFOUMsa0NBQVksR0FBcEIsVUFBcUIsSUFBb0M7WUFDdkQsSUFBSSxPQUF5QixDQUFDO1lBQzlCLElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtnQkFDbkQsT0FBTyxHQUFHLGdCQUFnQixDQUFDO2FBQzVCO2lCQUFNLElBQUksSUFBSSxZQUFZLDRCQUFZLEVBQUU7Z0JBQ3ZDLE9BQU8sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2hEO2lCQUFNO2dCQUNMLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQzthQUM1QjtZQUNELElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLEtBQUssQ0FDWCwyREFBeUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUcsQ0FBQyxDQUFDO2FBQ3RGO1lBQ0QsT0FBTyxPQUFPLENBQUM7UUFDakIsQ0FBQztRQUVPLDZDQUF1QixHQUEvQixVQUFnQyxHQUF3Qjs7WUFDdEQsSUFBTSxNQUFNLG9CQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQzs7Z0JBQ2hDLEtBQXNCLElBQUEsS0FBQSxpQkFBQSxHQUFHLENBQUMsVUFBVSxDQUFBLGdCQUFBLDRCQUFFO29CQUFqQyxJQUFJLFNBQVMsV0FBQTs7d0JBQ2hCLEtBQWtCLElBQUEsb0JBQUEsaUJBQUEsU0FBUyxDQUFDLE1BQU0sQ0FBQSxDQUFBLGdCQUFBLDRCQUFFOzRCQUEvQixJQUFJLEtBQUssV0FBQTs0QkFDWixJQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7NEJBQzlELElBQUksS0FBSyxFQUFFO2dDQUNULElBQU0sS0FBSyxHQUFHLEtBQUssS0FBSyxPQUFPLENBQUM7Z0NBQ2hDLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0NBQ1YsS0FBSyxPQUFBO29DQUNMLEtBQUssT0FBQTtvQ0FDTCxVQUFVLEVBQUU7d0NBQ1YsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTO3dDQUN2QixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7d0NBQ2xCLFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVTtxQ0FDN0I7aUNBQ0YsQ0FBQyxDQUFDOzZCQUNKO3lCQUNGOzs7Ozs7Ozs7aUJBQ0Y7Ozs7Ozs7OztZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCw4QkFBUSxHQUFSLFVBQVMsU0FBd0IsRUFBRSxRQUF1QjtZQUN4RCxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztZQUMzQiwrQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUVELDJCQUFLLEdBQUwsVUFBTSxXQUFtQixFQUFFLGdCQUFvQzs7WUFBL0QsaUJBb0RDO1lBcEQwQixpQ0FBQSxFQUFBLHFCQUFvQztZQUM3RCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFDLEtBQUssSUFBSyxPQUFBLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLEVBQTFDLENBQTBDLENBQUMsQ0FBQztZQUM3RSxJQUFJLFNBQVMsR0FDVCxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUMvRSxJQUFJLFlBQVksR0FBRyxDQUFDLENBQUM7WUFDckIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxVQUFVO2dCQUN4QixJQUFBLGlEQUEwRSxFQUF6RSwwQkFBVSxFQUFFLG9CQUFPLEVBQUUsZ0JBQW9ELENBQUM7Z0JBQ2pGLElBQU0sU0FBUyxHQUFHLEtBQUcsWUFBWSxFQUFJLENBQUM7Z0JBQ3RDLElBQU0sWUFBWSxHQUFHLE9BQU8sS0FBSyxLQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFJLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztnQkFDbkUsSUFBQSx1S0FFa0IsRUFGakIsZ0JBQUssRUFBRSw0QkFFVSxDQUFDO2dCQUN6QixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7Z0JBQ25ELFNBQVMsQ0FBQyxJQUFJLE9BQWQsU0FBUyxtQkFBUyxLQUFLLENBQUMsR0FBRyxDQUN2QixVQUFDLElBQWlCLElBQUssT0FBQSxDQUFDLENBQUMsa0NBQWtDLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxFQUF0RCxDQUFzRCxDQUFDLEdBQUU7WUFDdEYsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFDLEVBQTRCO29CQUEzQiwwQkFBVSxFQUFFLG9CQUFPLEVBQUUsZ0JBQUs7Z0JBQy9DLElBQU0sU0FBUyxHQUFHLEtBQUcsWUFBWSxFQUFJLENBQUM7Z0JBQ3RDLElBQU0sWUFBWSxHQUFHLE9BQU8sS0FBSyxLQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFJLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztnQkFDbEUsSUFBQSxrSUFBSyxDQUNnRTtnQkFDNUUsU0FBUyxDQUFDLElBQUksT0FBZCxTQUFTLG1CQUFTLEtBQUssQ0FBQyxHQUFHLENBQ3ZCLFVBQUMsSUFBaUIsSUFBSyxPQUFBLENBQUMsQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQXRELENBQXNELENBQUMsR0FBRTtZQUN0RixDQUFDLENBQUMsQ0FBQztZQUVILElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Z0JBQ3RCLElBQUksZUFBZSxHQUEyQixTQUFTLENBQUM7O29CQUN4RCxLQUFvQixJQUFBLEtBQUEsaUJBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQSxnQkFBQSw0QkFBRTt3QkFBNUIsSUFBTSxLQUFLLFdBQUE7d0JBQ1IsSUFBQSxzREFBb0UsRUFBbkUsb0JBQU8sRUFBRSxnQkFBMEQsQ0FBQzt3QkFDM0UsSUFBTSxTQUFTLEdBQUcsS0FBRyxZQUFZLEVBQUksQ0FBQzt3QkFDdEMsSUFBTSxZQUFZLEdBQUcsT0FBTyxLQUFLLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDO3dCQUN6RSx1RUFBdUU7d0JBQ3ZFLHlDQUF5Qzt3QkFDbkMsSUFBQSx3S0FFb0IsRUFGbkIsZ0JBQUssRUFBRSw0QkFFWSxDQUFDO3dCQUMzQixJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFOzRCQUNyQixJQUFNLFdBQVcsR0FDYixLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDOzRCQUN2RixlQUFlLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUM7eUJBQ3BGO3FCQUNGOzs7Ozs7Ozs7Z0JBQ0QsSUFBSSxlQUFlLEVBQUU7b0JBQ25CLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztpQkFDeEQ7YUFDRjtZQUVELElBQU0sUUFBUSxHQUFHLFdBQVMsV0FBVyxTQUFJLElBQUksQ0FBQyxpQkFBbUIsQ0FBQztZQUNsRSxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3ZFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNuQyxPQUFPLGdCQUFnQixDQUFDO1FBQzFCLENBQUM7UUFFRCxvQ0FBYyxHQUFkLFVBQWUsR0FBaUIsRUFBRSxPQUFZO1lBQTlDLGlCQU9DO1lBTkMsSUFBTSxhQUFhLEdBQWtCLEdBQUcsQ0FBQyxLQUFLLENBQUM7WUFDL0MsSUFBTSxLQUFLLEdBQWtCLGFBQWEsQ0FBQyxHQUFHLENBQUM7WUFFL0MsS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQ3JCLFVBQUMsSUFBSTtnQkFDRCxPQUFBLEtBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUMsT0FBTyxFQUFFLEtBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsRUFBQyxDQUFDO1lBQXJGLENBQXFGLENBQUMsQ0FBQztRQUNqRyxDQUFDO1FBRUQsMkNBQXFCLEdBQXJCLFVBQXNCLEdBQXdCLEVBQUUsT0FBWTtZQUMxRCxJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDakMsd0RBQXdEO1lBQ3hELHdDQUF3QztZQUN4QywrQ0FBK0M7WUFDL0MsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixFQUFFO2dCQUN0Qyw4RUFBOEU7Z0JBQzlFLGdGQUFnRjtnQkFDaEYsaUZBQWlGO2dCQUNqRixpRkFBaUY7Z0JBQ2pGLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDakQsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDM0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ2pDLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDcEQ7UUFDSCxDQUFDO1FBRUQsa0NBQVksR0FBWixVQUFhLEdBQWUsRUFBRSxPQUFZO1lBQTFDLGlCQVlDO1lBWEMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRWpDLElBQUksU0FBUyxHQUFtQixFQUFFLENBQUM7WUFDbkMsSUFBSSx5QkFBeUIsR0FBaUIsRUFBRSxDQUFDO1lBQ2pELElBQUksVUFBVSxHQUFtQixFQUFFLENBQUM7WUFDcEMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFRO2dCQUMxQixLQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FDYixFQUFDLE9BQU8sRUFBRSxLQUFJLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFDLENBQUMsQ0FBQztZQUN6RixDQUFDLENBQUMsQ0FBQztZQUVILCtCQUFnQixDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdkMsQ0FBQztRQUVPLDRDQUFzQixHQUE5QixVQUErQixHQUk5QjtZQUpELGlCQXVCQztZQWxCQyxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFDLE1BQU0sSUFBTyxLQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFckUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQyxHQUFHO2dCQUN6QixJQUFJLGFBQWEsR0FBa0IsSUFBTSxDQUFDO2dCQUMxQyx3REFBd0Q7Z0JBQ3hELHlDQUF5QztnQkFDekMsK0NBQStDO2dCQUMvQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVLElBQUksS0FBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRTtvQkFDM0UsYUFBYSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQztpQkFDaEQ7cUJBQU07b0JBQ0wsYUFBYSxHQUFHLENBQUMsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDO2lCQUMzQztnQkFDRCxLQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQ2xELENBQUMsQ0FBQyxDQUFDO1lBQ0gsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxTQUFTO2dCQUM1QixLQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FDYixFQUFDLE9BQU8sRUFBRSxLQUFJLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxTQUFTLENBQUMsVUFBVSxFQUFDLENBQUMsQ0FBQztZQUM3RixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxvQ0FBYyxHQUFkLFVBQWUsTUFBb0I7WUFBbkMsaUJBa0JDO1lBakJDLElBQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNoRCxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FDakIsVUFBQyxLQUFLLElBQUssT0FBQSxLQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FDeEIsRUFBQyxPQUFPLEVBQUUsS0FBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFBQyxDQUFDLEVBRHJFLENBQ3FFLENBQUMsQ0FBQztZQUN0Rix3REFBd0Q7WUFDeEQsK0NBQStDO1lBQy9DLCtDQUErQztZQUMvQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUU7Z0JBQ3RDLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUN6QixVQUFDLFFBQVEsSUFBSyxPQUFBLEtBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUMzQixFQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVLEVBQUMsQ0FBQyxFQURqRSxDQUNpRSxDQUFDLENBQUM7Z0JBQ3JGLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUMsWUFBWSxJQUFLLE9BQUEsS0FBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7b0JBQzVELE9BQU8sRUFBRSxPQUFPO29CQUNoQixLQUFLLEVBQUUsWUFBWSxDQUFDLE9BQU87b0JBQzNCLFVBQVUsRUFBRSxZQUFZLENBQUMsVUFBVTtpQkFDcEMsQ0FBQyxFQUowQyxDQUkxQyxDQUFDLENBQUM7YUFDTDtRQUNILENBQUM7UUFFRCwrQ0FBeUIsR0FBekIsY0FBbUMsQ0FBQztRQUNwQyw4QkFBUSxHQUFSLFVBQVMsSUFBWTtZQUNuQixJQUFJLElBQUksSUFBSSx1Q0FBZ0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO2dCQUN2QyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDakU7WUFDRCxLQUFLLElBQUksV0FBVyxHQUFxQixJQUFJLEVBQUUsV0FBVyxFQUFFLFdBQVcsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFO2dCQUM1RixJQUFJLGFBQWEsU0FBeUIsQ0FBQztnQkFDM0MsbUJBQW1CO2dCQUNuQixhQUFhLEdBQUcsV0FBVyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3BELElBQUksYUFBYSxJQUFJLElBQUksRUFBRTtvQkFDekIsa0JBQWtCO29CQUNsQixJQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFDLE1BQU0sSUFBSyxPQUFBLE1BQU0sQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFwQixDQUFvQixDQUFDLENBQUM7b0JBQzVFLElBQUksTUFBTSxFQUFFO3dCQUNWLGFBQWEsR0FBRyxDQUFDLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQztxQkFDM0M7aUJBQ0Y7Z0JBQ0QsSUFBSSxhQUFhLElBQUksSUFBSSxFQUFFO29CQUN6QixPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2lCQUNyRDthQUNGO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRU8sbUNBQWEsR0FBckIsVUFBc0IsSUFBWTtZQUNoQyxJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE1BQU0sSUFBSSxLQUFLLENBQ1gsd0NBQXNDLElBQUksd0JBQW1CLElBQUksQ0FBQyxTQUFXLENBQUMsQ0FBQzthQUNwRjtZQUNELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBRU8sZ0RBQTBCLEdBQWxDLFVBQW1DLFVBQXNCO1lBQXpELGlCQW1DQztZQWxDQyxPQUFPO2dCQUNMLFVBQVUsRUFBRSxVQUFVLENBQUMsVUFBVTtnQkFDakMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPO2dCQUMzQixLQUFLLEVBQUUscURBQThCLENBQ2pDO29CQUNFLDJCQUEyQixFQUFFLFVBQUMsUUFBZ0IsSUFBSyxPQUFBLFVBQUMsSUFBb0I7d0JBQ3RFLElBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQy9CLHdEQUF3RDt3QkFDeEQsY0FBYzt3QkFDZCxPQUFPLEtBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7b0JBQzdFLENBQUMsRUFMa0QsQ0FLbEQ7b0JBQ0QseUJBQXlCLEVBQ3JCLFVBQUMsSUFBc0MsSUFBSyxPQUFBLFVBQUMsTUFBc0I7d0JBQ2pFLElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBQyxDQUFDLEVBQUUsQ0FBQyxJQUFLLE9BQUEsQ0FBQzs0QkFDVCxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUc7NEJBQ1YsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7NEJBQ2hCLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTTt5QkFDakIsQ0FBQyxFQUpRLENBSVIsQ0FBQyxDQUFDO3dCQUM3QixJQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO3dCQUNsQyx3REFBd0Q7d0JBQ3hELFlBQVk7d0JBQ1osT0FBTyxLQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO29CQUM3RSxDQUFDLEVBVjJDLENBVTNDO29CQUNMLG1CQUFtQixFQUFFLFVBQUMsSUFBWSxFQUFFLFFBQWdCLElBQUssT0FBQSxVQUFDLElBQW9CO3dCQUM1RSx3REFBd0Q7d0JBQ3hELGFBQWE7d0JBQ2IsSUFBTSxRQUFRLEdBQUcsS0FBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDOzRCQUNqRCxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUN0QyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO3dCQUM3RCxPQUFPLFFBQVEsQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUNoRCxDQUFDLEVBUHdELENBT3hEO2lCQUNGLEVBQ0QsVUFBVSxDQUFDLEtBQUssQ0FBQzthQUN0QixDQUFDO1FBQ0osQ0FBQztRQUVELG9DQUFjLEdBQWQsVUFBZSxHQUFpQixFQUFFLE9BQVksSUFBUSxDQUFDO1FBQ3ZELCtCQUFTLEdBQVQsVUFBVSxHQUFZLEVBQUUsT0FBWSxJQUFRLENBQUM7UUFDN0MsNENBQXNCLEdBQXRCLFVBQXVCLEdBQThCLEVBQUUsT0FBWSxJQUFRLENBQUM7UUFDNUUsb0NBQWMsR0FBZCxVQUFlLEdBQWlCLEVBQUUsT0FBWSxJQUFRLENBQUM7UUFDdkQsbUNBQWEsR0FBYixVQUFjLEdBQWdCLEVBQUUsT0FBWSxJQUFRLENBQUM7UUFDckQsZ0NBQVUsR0FBVixVQUFXLEdBQWtCLEVBQUUsT0FBWSxJQUFRLENBQUM7UUFDcEQsMENBQW9CLEdBQXBCLFVBQXFCLEdBQTRCLEVBQUUsT0FBWSxJQUFRLENBQUM7UUFDeEUsK0JBQVMsR0FBVCxVQUFVLEdBQVksRUFBRSxPQUFZLElBQVEsQ0FBQztRQUMvQyxrQkFBQztJQUFELENBQUMsQUFsUkQsSUFrUkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QW90Q29tcGlsZXJPcHRpb25zfSBmcm9tICcuLi9hb3QvY29tcGlsZXJfb3B0aW9ucyc7XG5pbXBvcnQge1N0YXRpY1JlZmxlY3Rvcn0gZnJvbSAnLi4vYW90L3N0YXRpY19yZWZsZWN0b3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlUGlwZVN1bW1hcnl9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgRXZlbnRIYW5kbGVyVmFycywgTG9jYWxSZXNvbHZlciwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGluc30gZnJvbSAnLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0FTVCwgQVNUV2l0aFNvdXJjZSwgSW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtBdHRyQXN0LCBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0LCBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCwgQm91bmRFdmVudEFzdCwgQm91bmRUZXh0QXN0LCBEaXJlY3RpdmVBc3QsIEVsZW1lbnRBc3QsIEVtYmVkZGVkVGVtcGxhdGVBc3QsIE5nQ29udGVudEFzdCwgUmVmZXJlbmNlQXN0LCBUZW1wbGF0ZUFzdCwgVGVtcGxhdGVBc3RWaXNpdG9yLCBUZXh0QXN0LCBWYXJpYWJsZUFzdCwgdGVtcGxhdGVWaXNpdEFsbH0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX2FzdCc7XG5pbXBvcnQge091dHB1dENvbnRleHR9IGZyb20gJy4uL3V0aWwnO1xuXG5cbi8qKlxuICogR2VuZXJhdGVzIGNvZGUgdGhhdCBpcyB1c2VkIHRvIHR5cGUgY2hlY2sgdGVtcGxhdGVzLlxuICovXG5leHBvcnQgY2xhc3MgVHlwZUNoZWNrQ29tcGlsZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIG9wdGlvbnM6IEFvdENvbXBpbGVyT3B0aW9ucywgcHJpdmF0ZSByZWZsZWN0b3I6IFN0YXRpY1JlZmxlY3Rvcikge31cblxuICAvKipcbiAgICogSW1wb3J0YW50IG5vdGVzOlxuICAgKiAtIFRoaXMgbXVzdCBub3QgcHJvZHVjZSBuZXcgYGltcG9ydGAgc3RhdGVtZW50cywgYnV0IG9ubHkgcmVmZXIgdG8gdHlwZXMgb3V0c2lkZVxuICAgKiAgIG9mIHRoZSBmaWxlIHZpYSB0aGUgdmFyaWFibGVzIHByb3ZpZGVkIHZpYSBleHRlcm5hbFJlZmVyZW5jZVZhcnMuXG4gICAqICAgVGhpcyBhbGxvd3MgVHlwZXNjcmlwdCB0byByZXVzZSB0aGUgb2xkIHByb2dyYW0ncyBzdHJ1Y3R1cmUgYXMgbm8gaW1wb3J0cyBoYXZlIGNoYW5nZWQuXG4gICAqIC0gVGhpcyBtdXN0IG5vdCBwcm9kdWNlIGFueSBleHBvcnRzLCBhcyB0aGlzIHdvdWxkIHBvbGx1dGUgdGhlIC5kLnRzIGZpbGVcbiAgICogICBhbmQgYWxzbyB2aW9sYXRlIHRoZSBwb2ludCBhYm92ZS5cbiAgICovXG4gIGNvbXBpbGVDb21wb25lbnQoXG4gICAgICBjb21wb25lbnRJZDogc3RyaW5nLCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgdGVtcGxhdGU6IFRlbXBsYXRlQXN0W10sXG4gICAgICB1c2VkUGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdLCBleHRlcm5hbFJlZmVyZW5jZVZhcnM6IE1hcDxTdGF0aWNTeW1ib2wsIHN0cmluZz4sXG4gICAgICBjdHg6IE91dHB1dENvbnRleHQpOiBvLlN0YXRlbWVudFtdIHtcbiAgICBjb25zdCBwaXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBTdGF0aWNTeW1ib2w+KCk7XG4gICAgdXNlZFBpcGVzLmZvckVhY2gocCA9PiBwaXBlcy5zZXQocC5uYW1lLCBwLnR5cGUucmVmZXJlbmNlKSk7XG4gICAgbGV0IGVtYmVkZGVkVmlld0NvdW50ID0gMDtcbiAgICBjb25zdCB2aWV3QnVpbGRlckZhY3RvcnkgPVxuICAgICAgICAocGFyZW50OiBWaWV3QnVpbGRlciB8IG51bGwsIGd1YXJkczogR3VhcmRFeHByZXNzaW9uW10pOiBWaWV3QnVpbGRlciA9PiB7XG4gICAgICAgICAgY29uc3QgZW1iZWRkZWRWaWV3SW5kZXggPSBlbWJlZGRlZFZpZXdDb3VudCsrO1xuICAgICAgICAgIHJldHVybiBuZXcgVmlld0J1aWxkZXIoXG4gICAgICAgICAgICAgIHRoaXMub3B0aW9ucywgdGhpcy5yZWZsZWN0b3IsIGV4dGVybmFsUmVmZXJlbmNlVmFycywgcGFyZW50LCBjb21wb25lbnQudHlwZS5yZWZlcmVuY2UsXG4gICAgICAgICAgICAgIGNvbXBvbmVudC5pc0hvc3QsIGVtYmVkZGVkVmlld0luZGV4LCBwaXBlcywgZ3VhcmRzLCBjdHgsIHZpZXdCdWlsZGVyRmFjdG9yeSk7XG4gICAgICAgIH07XG5cbiAgICBjb25zdCB2aXNpdG9yID0gdmlld0J1aWxkZXJGYWN0b3J5KG51bGwsIFtdKTtcbiAgICB2aXNpdG9yLnZpc2l0QWxsKFtdLCB0ZW1wbGF0ZSk7XG5cbiAgICByZXR1cm4gdmlzaXRvci5idWlsZChjb21wb25lbnRJZCk7XG4gIH1cbn1cblxuaW50ZXJmYWNlIEd1YXJkRXhwcmVzc2lvbiB7XG4gIGd1YXJkOiBTdGF0aWNTeW1ib2w7XG4gIHVzZUlmOiBib29sZWFuO1xuICBleHByZXNzaW9uOiBFeHByZXNzaW9uO1xufVxuXG5pbnRlcmZhY2UgVmlld0J1aWxkZXJGYWN0b3J5IHtcbiAgKHBhcmVudDogVmlld0J1aWxkZXIsIGd1YXJkczogR3VhcmRFeHByZXNzaW9uW10pOiBWaWV3QnVpbGRlcjtcbn1cblxuLy8gTm90ZTogVGhpcyBpcyB1c2VkIGFzIGtleSBpbiBNYXAgYW5kIHNob3VsZCB0aGVyZWZvcmUgYmVcbi8vIHVuaXF1ZSBwZXIgdmFsdWUuXG50eXBlIE91dHB1dFZhclR5cGUgPSBvLkJ1aWx0aW5UeXBlTmFtZSB8IFN0YXRpY1N5bWJvbDtcblxuaW50ZXJmYWNlIEV4cHJlc3Npb24ge1xuICBjb250ZXh0OiBPdXRwdXRWYXJUeXBlO1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gIHZhbHVlOiBBU1Q7XG59XG5cbmNvbnN0IERZTkFNSUNfVkFSX05BTUUgPSAnX2FueSc7XG5cbmNsYXNzIFR5cGVDaGVja0xvY2FsUmVzb2x2ZXIgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHt9XG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBpZiAobmFtZSA9PT0gRXZlbnRIYW5kbGVyVmFycy5ldmVudC5uYW1lKSB7XG4gICAgICAvLyBSZWZlcmVuY2VzIHRvIHRoZSBldmVudCBzaG91bGQgbm90IGJlIHR5cGUtY2hlY2tlZC5cbiAgICAgIC8vIFRPRE8oY2h1Y2tqKTogZGV0ZXJtaW5lIGEgYmV0dGVyIHR5cGUgZm9yIHRoZSBldmVudC5cbiAgICAgIHJldHVybiBvLnZhcmlhYmxlKERZTkFNSUNfVkFSX05BTUUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5jb25zdCBkZWZhdWx0UmVzb2x2ZXIgPSBuZXcgVHlwZUNoZWNrTG9jYWxSZXNvbHZlcigpO1xuXG5jbGFzcyBWaWV3QnVpbGRlciBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0VmlzaXRvciwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgcmVmT3V0cHV0VmFycyA9IG5ldyBNYXA8c3RyaW5nLCBPdXRwdXRWYXJUeXBlPigpO1xuICBwcml2YXRlIHZhcmlhYmxlczogVmFyaWFibGVBc3RbXSA9IFtdO1xuICBwcml2YXRlIGNoaWxkcmVuOiBWaWV3QnVpbGRlcltdID0gW107XG4gIHByaXZhdGUgdXBkYXRlczogRXhwcmVzc2lvbltdID0gW107XG4gIHByaXZhdGUgYWN0aW9uczogRXhwcmVzc2lvbltdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIG9wdGlvbnM6IEFvdENvbXBpbGVyT3B0aW9ucywgcHJpdmF0ZSByZWZsZWN0b3I6IFN0YXRpY1JlZmxlY3RvcixcbiAgICAgIHByaXZhdGUgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzOiBNYXA8U3RhdGljU3ltYm9sLCBzdHJpbmc+LCBwcml2YXRlIHBhcmVudDogVmlld0J1aWxkZXJ8bnVsbCxcbiAgICAgIHByaXZhdGUgY29tcG9uZW50OiBTdGF0aWNTeW1ib2wsIHByaXZhdGUgaXNIb3N0Q29tcG9uZW50OiBib29sZWFuLFxuICAgICAgcHJpdmF0ZSBlbWJlZGRlZFZpZXdJbmRleDogbnVtYmVyLCBwcml2YXRlIHBpcGVzOiBNYXA8c3RyaW5nLCBTdGF0aWNTeW1ib2w+LFxuICAgICAgcHJpdmF0ZSBndWFyZHM6IEd1YXJkRXhwcmVzc2lvbltdLCBwcml2YXRlIGN0eDogT3V0cHV0Q29udGV4dCxcbiAgICAgIHByaXZhdGUgdmlld0J1aWxkZXJGYWN0b3J5OiBWaWV3QnVpbGRlckZhY3RvcnkpIHt9XG5cbiAgcHJpdmF0ZSBnZXRPdXRwdXRWYXIodHlwZTogby5CdWlsdGluVHlwZU5hbWV8U3RhdGljU3ltYm9sKTogc3RyaW5nIHtcbiAgICBsZXQgdmFyTmFtZTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICBpZiAodHlwZSA9PT0gdGhpcy5jb21wb25lbnQgJiYgdGhpcy5pc0hvc3RDb21wb25lbnQpIHtcbiAgICAgIHZhck5hbWUgPSBEWU5BTUlDX1ZBUl9OQU1FO1xuICAgIH0gZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgdmFyTmFtZSA9IHRoaXMuZXh0ZXJuYWxSZWZlcmVuY2VWYXJzLmdldCh0eXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyTmFtZSA9IERZTkFNSUNfVkFSX05BTUU7XG4gICAgfVxuICAgIGlmICghdmFyTmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBJbGxlZ2FsIFN0YXRlOiByZWZlcnJpbmcgdG8gYSB0eXBlIHdpdGhvdXQgYSB2YXJpYWJsZSAke0pTT04uc3RyaW5naWZ5KHR5cGUpfWApO1xuICAgIH1cbiAgICByZXR1cm4gdmFyTmFtZTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VHlwZUd1YXJkRXhwcmVzc2lvbnMoYXN0OiBFbWJlZGRlZFRlbXBsYXRlQXN0KTogR3VhcmRFeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IHJlc3VsdCA9IFsuLi50aGlzLmd1YXJkc107XG4gICAgZm9yIChsZXQgZGlyZWN0aXZlIG9mIGFzdC5kaXJlY3RpdmVzKSB7XG4gICAgICBmb3IgKGxldCBpbnB1dCBvZiBkaXJlY3RpdmUuaW5wdXRzKSB7XG4gICAgICAgIGNvbnN0IGd1YXJkID0gZGlyZWN0aXZlLmRpcmVjdGl2ZS5ndWFyZHNbaW5wdXQuZGlyZWN0aXZlTmFtZV07XG4gICAgICAgIGlmIChndWFyZCkge1xuICAgICAgICAgIGNvbnN0IHVzZUlmID0gZ3VhcmQgPT09ICdVc2VJZic7XG4gICAgICAgICAgcmVzdWx0LnB1c2goe1xuICAgICAgICAgICAgZ3VhcmQsXG4gICAgICAgICAgICB1c2VJZixcbiAgICAgICAgICAgIGV4cHJlc3Npb246IHtcbiAgICAgICAgICAgICAgY29udGV4dDogdGhpcy5jb21wb25lbnQsXG4gICAgICAgICAgICAgIHZhbHVlOiBpbnB1dC52YWx1ZSxcbiAgICAgICAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHZpc2l0QWxsKHZhcmlhYmxlczogVmFyaWFibGVBc3RbXSwgYXN0Tm9kZXM6IFRlbXBsYXRlQXN0W10pIHtcbiAgICB0aGlzLnZhcmlhYmxlcyA9IHZhcmlhYmxlcztcbiAgICB0ZW1wbGF0ZVZpc2l0QWxsKHRoaXMsIGFzdE5vZGVzKTtcbiAgfVxuXG4gIGJ1aWxkKGNvbXBvbmVudElkOiBzdHJpbmcsIHRhcmdldFN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXSk6IG8uU3RhdGVtZW50W10ge1xuICAgIHRoaXMuY2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQpID0+IGNoaWxkLmJ1aWxkKGNvbXBvbmVudElkLCB0YXJnZXRTdGF0ZW1lbnRzKSk7XG4gICAgbGV0IHZpZXdTdG10czogby5TdGF0ZW1lbnRbXSA9XG4gICAgICAgIFtvLnZhcmlhYmxlKERZTkFNSUNfVkFSX05BTUUpLnNldChvLk5VTExfRVhQUikudG9EZWNsU3RtdChvLkRZTkFNSUNfVFlQRSldO1xuICAgIGxldCBiaW5kaW5nQ291bnQgPSAwO1xuICAgIHRoaXMudXBkYXRlcy5mb3JFYWNoKChleHByZXNzaW9uKSA9PiB7XG4gICAgICBjb25zdCB7c291cmNlU3BhbiwgY29udGV4dCwgdmFsdWV9ID0gdGhpcy5wcmVwcm9jZXNzVXBkYXRlRXhwcmVzc2lvbihleHByZXNzaW9uKTtcbiAgICAgIGNvbnN0IGJpbmRpbmdJZCA9IGAke2JpbmRpbmdDb3VudCsrfWA7XG4gICAgICBjb25zdCBuYW1lUmVzb2x2ZXIgPSBjb250ZXh0ID09PSB0aGlzLmNvbXBvbmVudCA/IHRoaXMgOiBkZWZhdWx0UmVzb2x2ZXI7XG4gICAgICBjb25zdCB7c3RtdHMsIGN1cnJWYWxFeHByfSA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgbmFtZVJlc29sdmVyLCBvLnZhcmlhYmxlKHRoaXMuZ2V0T3V0cHV0VmFyKGNvbnRleHQpKSwgdmFsdWUsIGJpbmRpbmdJZCxcbiAgICAgICAgICBCaW5kaW5nRm9ybS5HZW5lcmFsKTtcbiAgICAgIHN0bXRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudChjdXJyVmFsRXhwcikpO1xuICAgICAgdmlld1N0bXRzLnB1c2goLi4uc3RtdHMubWFwKFxuICAgICAgICAgIChzdG10OiBvLlN0YXRlbWVudCkgPT4gby5hcHBseVNvdXJjZVNwYW5Ub1N0YXRlbWVudElmTmVlZGVkKHN0bXQsIHNvdXJjZVNwYW4pKSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmFjdGlvbnMuZm9yRWFjaCgoe3NvdXJjZVNwYW4sIGNvbnRleHQsIHZhbHVlfSkgPT4ge1xuICAgICAgY29uc3QgYmluZGluZ0lkID0gYCR7YmluZGluZ0NvdW50Kyt9YDtcbiAgICAgIGNvbnN0IG5hbWVSZXNvbHZlciA9IGNvbnRleHQgPT09IHRoaXMuY29tcG9uZW50ID8gdGhpcyA6IGRlZmF1bHRSZXNvbHZlcjtcbiAgICAgIGNvbnN0IHtzdG10c30gPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgICAgICBuYW1lUmVzb2x2ZXIsIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoY29udGV4dCkpLCB2YWx1ZSwgYmluZGluZ0lkKTtcbiAgICAgIHZpZXdTdG10cy5wdXNoKC4uLnN0bXRzLm1hcChcbiAgICAgICAgICAoc3RtdDogby5TdGF0ZW1lbnQpID0+IG8uYXBwbHlTb3VyY2VTcGFuVG9TdGF0ZW1lbnRJZk5lZWRlZChzdG10LCBzb3VyY2VTcGFuKSkpO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuZ3VhcmRzLmxlbmd0aCkge1xuICAgICAgbGV0IGd1YXJkRXhwcmVzc2lvbjogby5FeHByZXNzaW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgIGZvciAoY29uc3QgZ3VhcmQgb2YgdGhpcy5ndWFyZHMpIHtcbiAgICAgICAgY29uc3Qge2NvbnRleHQsIHZhbHVlfSA9IHRoaXMucHJlcHJvY2Vzc1VwZGF0ZUV4cHJlc3Npb24oZ3VhcmQuZXhwcmVzc2lvbik7XG4gICAgICAgIGNvbnN0IGJpbmRpbmdJZCA9IGAke2JpbmRpbmdDb3VudCsrfWA7XG4gICAgICAgIGNvbnN0IG5hbWVSZXNvbHZlciA9IGNvbnRleHQgPT09IHRoaXMuY29tcG9uZW50ID8gdGhpcyA6IGRlZmF1bHRSZXNvbHZlcjtcbiAgICAgICAgLy8gV2Ugb25seSBzdXBwb3J0IHN1cHBvcnQgc2ltcGxlIGV4cHJlc3Npb25zIGFuZCBpZ25vcmUgb3RoZXJzIGFzIHRoZXlcbiAgICAgICAgLy8gYXJlIHVubGlrZWx5IHRvIGFmZmVjdCB0eXBlIG5hcnJvd2luZy5cbiAgICAgICAgY29uc3Qge3N0bXRzLCBjdXJyVmFsRXhwcn0gPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgbmFtZVJlc29sdmVyLCBvLnZhcmlhYmxlKHRoaXMuZ2V0T3V0cHV0VmFyKGNvbnRleHQpKSwgdmFsdWUsIGJpbmRpbmdJZCxcbiAgICAgICAgICAgIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSk7XG4gICAgICAgIGlmIChzdG10cy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgIGNvbnN0IGd1YXJkQ2xhdXNlID1cbiAgICAgICAgICAgICAgZ3VhcmQudXNlSWYgPyBjdXJyVmFsRXhwciA6IHRoaXMuY3R4LmltcG9ydEV4cHIoZ3VhcmQuZ3VhcmQpLmNhbGxGbihbY3VyclZhbEV4cHJdKTtcbiAgICAgICAgICBndWFyZEV4cHJlc3Npb24gPSBndWFyZEV4cHJlc3Npb24gPyBndWFyZEV4cHJlc3Npb24uYW5kKGd1YXJkQ2xhdXNlKSA6IGd1YXJkQ2xhdXNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZ3VhcmRFeHByZXNzaW9uKSB7XG4gICAgICAgIHZpZXdTdG10cyA9IFtuZXcgby5JZlN0bXQoZ3VhcmRFeHByZXNzaW9uLCB2aWV3U3RtdHMpXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB2aWV3TmFtZSA9IGBfVmlld18ke2NvbXBvbmVudElkfV8ke3RoaXMuZW1iZWRkZWRWaWV3SW5kZXh9YDtcbiAgICBjb25zdCB2aWV3RmFjdG9yeSA9IG5ldyBvLkRlY2xhcmVGdW5jdGlvblN0bXQodmlld05hbWUsIFtdLCB2aWV3U3RtdHMpO1xuICAgIHRhcmdldFN0YXRlbWVudHMucHVzaCh2aWV3RmFjdG9yeSk7XG4gICAgcmV0dXJuIHRhcmdldFN0YXRlbWVudHM7XG4gIH1cblxuICB2aXNpdEJvdW5kVGV4dChhc3Q6IEJvdW5kVGV4dEFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBhc3RXaXRoU291cmNlID0gPEFTVFdpdGhTb3VyY2U+YXN0LnZhbHVlO1xuICAgIGNvbnN0IGludGVyID0gPEludGVycG9sYXRpb24+YXN0V2l0aFNvdXJjZS5hc3Q7XG5cbiAgICBpbnRlci5leHByZXNzaW9ucy5mb3JFYWNoKFxuICAgICAgICAoZXhwcikgPT5cbiAgICAgICAgICAgIHRoaXMudXBkYXRlcy5wdXNoKHtjb250ZXh0OiB0aGlzLmNvbXBvbmVudCwgdmFsdWU6IGV4cHIsIHNvdXJjZVNwYW46IGFzdC5zb3VyY2VTcGFufSkpO1xuICB9XG5cbiAgdmlzaXRFbWJlZGRlZFRlbXBsYXRlKGFzdDogRW1iZWRkZWRUZW1wbGF0ZUFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0RWxlbWVudE9yVGVtcGxhdGUoYXN0KTtcbiAgICAvLyBOb3RlOiBUaGUgb2xkIHZpZXcgY29tcGlsZXIgdXNlZCB0byB1c2UgYW4gYGFueWAgdHlwZVxuICAgIC8vIGZvciB0aGUgY29udGV4dCBpbiBhbnkgZW1iZWRkZWQgdmlldy5cbiAgICAvLyBXZSBrZWVwIHRoaXMgYmVoYWl2b3IgYmVoaW5kIGEgZmxhZyBmb3Igbm93LlxuICAgIGlmICh0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrKSB7XG4gICAgICAvLyBGaW5kIGFueSBhcHBsaWNhYmxlIHR5cGUgZ3VhcmRzLiBGb3IgZXhhbXBsZSwgTmdJZiBoYXMgYSB0eXBlIGd1YXJkIG9uIG5nSWZcbiAgICAgIC8vIChzZWUgTmdJZi5uZ0lmVHlwZUd1YXJkKSB0aGF0IGNhbiBiZSB1c2VkIHRvIGluZGljYXRlIHRoYXQgYSB0ZW1wbGF0ZSBpcyBvbmx5XG4gICAgICAvLyBzdGFtcGVkIG91dCBpZiBuZ0lmIGlzIHRydXRoeSBzbyBhbnkgYmluZGluZ3MgaW4gdGhlIHRlbXBsYXRlIGNhbiBhc3N1bWUgdGhhdCxcbiAgICAgIC8vIGlmIGEgbnVsbGFibGUgdHlwZSBpcyB1c2VkIGZvciBuZ0lmLCB0aGF0IGV4cHJlc3Npb24gaXMgbm90IG51bGwgb3IgdW5kZWZpbmVkLlxuICAgICAgY29uc3QgZ3VhcmRzID0gdGhpcy5nZXRUeXBlR3VhcmRFeHByZXNzaW9ucyhhc3QpO1xuICAgICAgY29uc3QgY2hpbGRWaXNpdG9yID0gdGhpcy52aWV3QnVpbGRlckZhY3RvcnkodGhpcywgZ3VhcmRzKTtcbiAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChjaGlsZFZpc2l0b3IpO1xuICAgICAgY2hpbGRWaXNpdG9yLnZpc2l0QWxsKGFzdC52YXJpYWJsZXMsIGFzdC5jaGlsZHJlbik7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGFzdDogRWxlbWVudEFzdCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0RWxlbWVudE9yVGVtcGxhdGUoYXN0KTtcblxuICAgIGxldCBpbnB1dERlZnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgbGV0IHVwZGF0ZVJlbmRlcmVyRXhwcmVzc2lvbnM6IEV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGxldCBvdXRwdXREZWZzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGFzdC5pbnB1dHMuZm9yRWFjaCgoaW5wdXRBc3QpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlcy5wdXNoKFxuICAgICAgICAgIHtjb250ZXh0OiB0aGlzLmNvbXBvbmVudCwgdmFsdWU6IGlucHV0QXN0LnZhbHVlLCBzb3VyY2VTcGFuOiBpbnB1dEFzdC5zb3VyY2VTcGFufSk7XG4gICAgfSk7XG5cbiAgICB0ZW1wbGF0ZVZpc2l0QWxsKHRoaXMsIGFzdC5jaGlsZHJlbik7XG4gIH1cblxuICBwcml2YXRlIHZpc2l0RWxlbWVudE9yVGVtcGxhdGUoYXN0OiB7XG4gICAgb3V0cHV0czogQm91bmRFdmVudEFzdFtdLFxuICAgIGRpcmVjdGl2ZXM6IERpcmVjdGl2ZUFzdFtdLFxuICAgIHJlZmVyZW5jZXM6IFJlZmVyZW5jZUFzdFtdLFxuICB9KSB7XG4gICAgYXN0LmRpcmVjdGl2ZXMuZm9yRWFjaCgoZGlyQXN0KSA9PiB7IHRoaXMudmlzaXREaXJlY3RpdmUoZGlyQXN0KTsgfSk7XG5cbiAgICBhc3QucmVmZXJlbmNlcy5mb3JFYWNoKChyZWYpID0+IHtcbiAgICAgIGxldCBvdXRwdXRWYXJUeXBlOiBPdXRwdXRWYXJUeXBlID0gbnVsbCAhO1xuICAgICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAgIC8vIGZvciBkaXJlY3RpdmVzIGV4cG9zZWQgdmlhIGBleHBvcnRBc2AuXG4gICAgICAvLyBXZSBrZWVwIHRoaXMgYmVoYWl2b3IgYmVoaW5kIGEgZmxhZyBmb3Igbm93LlxuICAgICAgaWYgKHJlZi52YWx1ZSAmJiByZWYudmFsdWUuaWRlbnRpZmllciAmJiB0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrKSB7XG4gICAgICAgIG91dHB1dFZhclR5cGUgPSByZWYudmFsdWUuaWRlbnRpZmllci5yZWZlcmVuY2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRWYXJUeXBlID0gby5CdWlsdGluVHlwZU5hbWUuRHluYW1pYztcbiAgICAgIH1cbiAgICAgIHRoaXMucmVmT3V0cHV0VmFycy5zZXQocmVmLm5hbWUsIG91dHB1dFZhclR5cGUpO1xuICAgIH0pO1xuICAgIGFzdC5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdCkgPT4ge1xuICAgICAgdGhpcy5hY3Rpb25zLnB1c2goXG4gICAgICAgICAge2NvbnRleHQ6IHRoaXMuY29tcG9uZW50LCB2YWx1ZTogb3V0cHV0QXN0LmhhbmRsZXIsIHNvdXJjZVNwYW46IG91dHB1dEFzdC5zb3VyY2VTcGFufSk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdERpcmVjdGl2ZShkaXJBc3Q6IERpcmVjdGl2ZUFzdCkge1xuICAgIGNvbnN0IGRpclR5cGUgPSBkaXJBc3QuZGlyZWN0aXZlLnR5cGUucmVmZXJlbmNlO1xuICAgIGRpckFzdC5pbnB1dHMuZm9yRWFjaChcbiAgICAgICAgKGlucHV0KSA9PiB0aGlzLnVwZGF0ZXMucHVzaChcbiAgICAgICAgICAgIHtjb250ZXh0OiB0aGlzLmNvbXBvbmVudCwgdmFsdWU6IGlucHV0LnZhbHVlLCBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFufSkpO1xuICAgIC8vIE5vdGU6IFRoZSBvbGQgdmlldyBjb21waWxlciB1c2VkIHRvIHVzZSBhbiBgYW55YCB0eXBlXG4gICAgLy8gZm9yIGV4cHJlc3Npb25zIGluIGhvc3QgcHJvcGVydGllcyAvIGV2ZW50cy5cbiAgICAvLyBXZSBrZWVwIHRoaXMgYmVoYWl2b3IgYmVoaW5kIGEgZmxhZyBmb3Igbm93LlxuICAgIGlmICh0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrKSB7XG4gICAgICBkaXJBc3QuaG9zdFByb3BlcnRpZXMuZm9yRWFjaChcbiAgICAgICAgICAoaW5wdXRBc3QpID0+IHRoaXMudXBkYXRlcy5wdXNoKFxuICAgICAgICAgICAgICB7Y29udGV4dDogZGlyVHlwZSwgdmFsdWU6IGlucHV0QXN0LnZhbHVlLCBzb3VyY2VTcGFuOiBpbnB1dEFzdC5zb3VyY2VTcGFufSkpO1xuICAgICAgZGlyQXN0Lmhvc3RFdmVudHMuZm9yRWFjaCgoaG9zdEV2ZW50QXN0KSA9PiB0aGlzLmFjdGlvbnMucHVzaCh7XG4gICAgICAgIGNvbnRleHQ6IGRpclR5cGUsXG4gICAgICAgIHZhbHVlOiBob3N0RXZlbnRBc3QuaGFuZGxlcixcbiAgICAgICAgc291cmNlU3BhbjogaG9zdEV2ZW50QXN0LnNvdXJjZVNwYW5cbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cblxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge31cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChuYW1lID09IEV2ZW50SGFuZGxlclZhcnMuZXZlbnQubmFtZSkge1xuICAgICAgcmV0dXJuIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoby5CdWlsdGluVHlwZU5hbWUuRHluYW1pYykpO1xuICAgIH1cbiAgICBmb3IgKGxldCBjdXJyQnVpbGRlcjogVmlld0J1aWxkZXJ8bnVsbCA9IHRoaXM7IGN1cnJCdWlsZGVyOyBjdXJyQnVpbGRlciA9IGN1cnJCdWlsZGVyLnBhcmVudCkge1xuICAgICAgbGV0IG91dHB1dFZhclR5cGU6IE91dHB1dFZhclR5cGV8dW5kZWZpbmVkO1xuICAgICAgLy8gY2hlY2sgcmVmZXJlbmNlc1xuICAgICAgb3V0cHV0VmFyVHlwZSA9IGN1cnJCdWlsZGVyLnJlZk91dHB1dFZhcnMuZ2V0KG5hbWUpO1xuICAgICAgaWYgKG91dHB1dFZhclR5cGUgPT0gbnVsbCkge1xuICAgICAgICAvLyBjaGVjayB2YXJpYWJsZXNcbiAgICAgICAgY29uc3QgdmFyQXN0ID0gY3VyckJ1aWxkZXIudmFyaWFibGVzLmZpbmQoKHZhckFzdCkgPT4gdmFyQXN0Lm5hbWUgPT09IG5hbWUpO1xuICAgICAgICBpZiAodmFyQXN0KSB7XG4gICAgICAgICAgb3V0cHV0VmFyVHlwZSA9IG8uQnVpbHRpblR5cGVOYW1lLkR5bmFtaWM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChvdXRwdXRWYXJUeXBlICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIob3V0cHV0VmFyVHlwZSkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgcGlwZU91dHB1dFZhcihuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHBpcGUgPSB0aGlzLnBpcGVzLmdldChuYW1lKTtcbiAgICBpZiAoIXBpcGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgSWxsZWdhbCBTdGF0ZTogQ291bGQgbm90IGZpbmQgcGlwZSAke25hbWV9IGluIHRlbXBsYXRlIG9mICR7dGhpcy5jb21wb25lbnR9YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmdldE91dHB1dFZhcihwaXBlKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcHJvY2Vzc1VwZGF0ZUV4cHJlc3Npb24oZXhwcmVzc2lvbjogRXhwcmVzc2lvbik6IEV4cHJlc3Npb24ge1xuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VTcGFuOiBleHByZXNzaW9uLnNvdXJjZVNwYW4sXG4gICAgICBjb250ZXh0OiBleHByZXNzaW9uLmNvbnRleHQsXG4gICAgICB2YWx1ZTogY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNyZWF0ZUxpdGVyYWxBcnJheUNvbnZlcnRlcjogKGFyZ0NvdW50OiBudW1iZXIpID0+IChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBhcnIgPSBvLmxpdGVyYWxBcnIoYXJncyk7XG4gICAgICAgICAgICAgIC8vIE5vdGU6IFRoZSBvbGQgdmlldyBjb21waWxlciB1c2VkIHRvIHVzZSBhbiBgYW55YCB0eXBlXG4gICAgICAgICAgICAgIC8vIGZvciBhcnJheXMuXG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrID8gYXJyIDogYXJyLmNhc3Qoby5EWU5BTUlDX1RZUEUpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNyZWF0ZUxpdGVyYWxNYXBDb252ZXJ0ZXI6XG4gICAgICAgICAgICAgICAgKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKSA9PiAodmFsdWVzOiBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgZW50cmllcyA9IGtleXMubWFwKChrLCBpKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrLmtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZXNbaV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdW90ZWQ6IGsucXVvdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG1hcCA9IG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbiAgICAgICAgICAgICAgICAgIC8vIE5vdGU6IFRoZSBvbGQgdmlldyBjb21waWxlciB1c2VkIHRvIHVzZSBhbiBgYW55YCB0eXBlXG4gICAgICAgICAgICAgICAgICAvLyBmb3IgbWFwcy5cbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrID8gbWFwIDogbWFwLmNhc3Qoby5EWU5BTUlDX1RZUEUpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjcmVhdGVQaXBlQ29udmVydGVyOiAobmFtZTogc3RyaW5nLCBhcmdDb3VudDogbnVtYmVyKSA9PiAoYXJnczogby5FeHByZXNzaW9uW10pID0+IHtcbiAgICAgICAgICAgICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAgICAgICAgICAgLy8gZm9yIHBpcGVzLlxuICAgICAgICAgICAgICBjb25zdCBwaXBlRXhwciA9IHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2sgP1xuICAgICAgICAgICAgICAgICAgby52YXJpYWJsZSh0aGlzLnBpcGVPdXRwdXRWYXIobmFtZSkpIDpcbiAgICAgICAgICAgICAgICAgIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoby5CdWlsdGluVHlwZU5hbWUuRHluYW1pYykpO1xuICAgICAgICAgICAgICByZXR1cm4gcGlwZUV4cHIuY2FsbE1ldGhvZCgndHJhbnNmb3JtJywgYXJncyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZXhwcmVzc2lvbi52YWx1ZSlcbiAgICB9O1xuICB9XG5cbiAgdmlzaXROZ0NvbnRlbnQoYXN0OiBOZ0NvbnRlbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFRleHQoYXN0OiBUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXREaXJlY3RpdmVQcm9wZXJ0eShhc3Q6IEJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFJlZmVyZW5jZShhc3Q6IFJlZmVyZW5jZUFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0VmFyaWFibGUoYXN0OiBWYXJpYWJsZUFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0RXZlbnQoYXN0OiBCb3VuZEV2ZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRFbGVtZW50UHJvcGVydHkoYXN0OiBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0QXR0cihhc3Q6IEF0dHJBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxufVxuIl19