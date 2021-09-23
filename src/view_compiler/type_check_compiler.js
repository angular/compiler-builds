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
        define("@angular/compiler/src/view_compiler/type_check_compiler", ["require", "exports", "tslib", "@angular/compiler/src/aot/static_symbol", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/template_parser/template_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeCheckCompiler = void 0;
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
        TypeCheckLocalResolver.prototype.maybeRestoreView = function () { };
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
            var result = (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(this.guards), false);
            try {
                for (var _c = (0, tslib_1.__values)(ast.directives), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var directive = _d.value;
                    try {
                        for (var _e = (e_2 = void 0, (0, tslib_1.__values)(directive.inputs)), _f = _e.next(); !_f.done; _f = _e.next()) {
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
            (0, template_ast_1.templateVisitAll)(this, astNodes);
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
                var _b = (0, expression_converter_1.convertPropertyBinding)(nameResolver, o.variable(_this.getOutputVar(context)), value, bindingId, expression_converter_1.BindingForm.General), stmts = _b.stmts, currValExpr = _b.currValExpr;
                stmts.push(new o.ExpressionStatement(currValExpr));
                viewStmts.push.apply(viewStmts, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(stmts.map(function (stmt) { return o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan); })), false));
            });
            this.actions.forEach(function (_a) {
                var sourceSpan = _a.sourceSpan, context = _a.context, value = _a.value;
                var bindingId = "" + bindingCount++;
                var nameResolver = context === _this.component ? _this : defaultResolver;
                var stmts = (0, expression_converter_1.convertActionBinding)(nameResolver, o.variable(_this.getOutputVar(context)), value, bindingId).stmts;
                viewStmts.push.apply(viewStmts, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(stmts.map(function (stmt) { return o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan); })), false));
            });
            if (this.guards.length) {
                var guardExpression = undefined;
                try {
                    for (var _b = (0, tslib_1.__values)(this.guards), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var guard = _c.value;
                        var _d = this.preprocessUpdateExpression(guard.expression), context = _d.context, value = _d.value;
                        var bindingId = "" + bindingCount++;
                        var nameResolver = context === this.component ? this : defaultResolver;
                        // We only support support simple expressions and ignore others as they
                        // are unlikely to affect type narrowing.
                        var _e = (0, expression_converter_1.convertPropertyBinding)(nameResolver, o.variable(this.getOutputVar(context)), value, bindingId, expression_converter_1.BindingForm.TrySimple), stmts = _e.stmts, currValExpr = _e.currValExpr;
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
            (0, template_ast_1.templateVisitAll)(this, ast.children);
        };
        ViewBuilder.prototype.visitElementOrTemplate = function (ast) {
            var _this = this;
            ast.directives.forEach(function (dirAst) {
                _this.visitDirective(dirAst);
            });
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
        ViewBuilder.prototype.maybeRestoreView = function () { };
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
                value: (0, expression_converter_1.convertPropertyBindingBuiltins)({
                    createLiteralArrayConverter: function (argCount) { return function (args) {
                        var arr = o.literalArr(args);
                        // Note: The old view compiler used to use an `any` type
                        // for arrays.
                        return _this.options.fullTemplateTypeCheck ? arr : arr.cast(o.DYNAMIC_TYPE);
                    }; },
                    createLiteralMapConverter: function (keys) {
                        return function (values) {
                            var entries = keys.map(function (k, i) { return ({
                                key: k.key,
                                value: values[i],
                                quoted: k.quoted,
                            }); });
                            var map = o.literalMap(entries);
                            // Note: The old view compiler used to use an `any` type
                            // for maps.
                            return _this.options.fullTemplateTypeCheck ? map : map.cast(o.DYNAMIC_TYPE);
                        };
                    },
                    createPipeConverter: function (name, argCount) { return function (args) {
                        // Note: The old view compiler used to use an `any` type
                        // for pipes.
                        var pipeExpr = _this.options.fullTemplateTypeCheck ?
                            o.variable(_this.pipeOutputVar(name)) :
                            o.variable(_this.getOutputVar(o.BuiltinTypeName.Dynamic));
                        return pipeExpr.prop('transform').callFn(args);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9jaGVja19jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy92aWV3X2NvbXBpbGVyL3R5cGVfY2hlY2tfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUlILHlFQUFrRDtJQUVsRCxpR0FBaUw7SUFHakwsMkRBQTBDO0lBRTFDLG1GQUE2UjtJQUc3Ujs7T0FFRztJQUNIO1FBQ0UsMkJBQW9CLE9BQTJCLEVBQVUsU0FBMEI7WUFBL0QsWUFBTyxHQUFQLE9BQU8sQ0FBb0I7WUFBVSxjQUFTLEdBQVQsU0FBUyxDQUFpQjtRQUFHLENBQUM7UUFFdkY7Ozs7Ozs7V0FPRztRQUNILDRDQUFnQixHQUFoQixVQUNJLFdBQW1CLEVBQUUsU0FBbUMsRUFBRSxRQUF1QixFQUNqRixTQUErQixFQUFFLHFCQUFnRCxFQUNqRixHQUFrQjtZQUh0QixpQkFtQkM7WUFmQyxJQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBd0IsQ0FBQztZQUM5QyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQW5DLENBQW1DLENBQUMsQ0FBQztZQUM1RCxJQUFJLGlCQUFpQixHQUFHLENBQUMsQ0FBQztZQUMxQixJQUFNLGtCQUFrQixHQUNwQixVQUFDLE1BQXdCLEVBQUUsTUFBeUI7Z0JBQ2xELElBQU0saUJBQWlCLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztnQkFDOUMsT0FBTyxJQUFJLFdBQVcsQ0FDbEIsS0FBSSxDQUFDLE9BQU8sRUFBRSxLQUFJLENBQUMsU0FBUyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFD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dUIsR0FBOEIsRUFBRSxPQUFZLElBQVEsQ0FBQztRQUM1RSxvQ0FBYyxHQUFkLFVBQWUsR0FBaUIsRUFBRSxPQUFZLElBQVEsQ0FBQztRQUN2RCxtQ0FBYSxHQUFiLFVBQWMsR0FBZ0IsRUFBRSxPQUFZLElBQVEsQ0FBQztRQUNyRCxnQ0FBVSxHQUFWLFVBQVcsR0FBa0IsRUFBRSxPQUFZLElBQVEsQ0FBQztRQUNwRCwwQ0FBb0IsR0FBcEIsVUFBcUIsR0FBNEIsRUFBRSxPQUFZLElBQVEsQ0FBQztRQUN4RSwrQkFBUyxHQUFULFVBQVUsR0FBWSxFQUFFLE9BQVksSUFBUSxDQUFDO1FBQy9DLGtCQUFDO0lBQUQsQ0FBQyxBQXRSRCxJQXNSQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FvdENvbXBpbGVyT3B0aW9uc30gZnJvbSAnLi4vYW90L2NvbXBpbGVyX29wdGlvbnMnO1xuaW1wb3J0IHtTdGF0aWNSZWZsZWN0b3J9IGZyb20gJy4uL2FvdC9zdGF0aWNfcmVmbGVjdG9yJztcbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgQ29tcGlsZVBpcGVTdW1tYXJ5fSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnMsIEV2ZW50SGFuZGxlclZhcnMsIExvY2FsUmVzb2x2ZXJ9IGZyb20gJy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0F0dHJBc3QsIEJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QsIEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LCBCb3VuZEV2ZW50QXN0LCBCb3VuZFRleHRBc3QsIERpcmVjdGl2ZUFzdCwgRWxlbWVudEFzdCwgRW1iZWRkZWRUZW1wbGF0ZUFzdCwgTmdDb250ZW50QXN0LCBSZWZlcmVuY2VBc3QsIFRlbXBsYXRlQXN0LCBUZW1wbGF0ZUFzdFZpc2l0b3IsIHRlbXBsYXRlVmlzaXRBbGwsIFRleHRBc3QsIFZhcmlhYmxlQXN0fSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfYXN0JztcblxuXG4vKipcbiAqIEdlbmVyYXRlcyBjb2RlIHRoYXQgaXMgdXNlZCB0byB0eXBlIGNoZWNrIHRlbXBsYXRlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFR5cGVDaGVja0NvbXBpbGVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBBb3RDb21waWxlck9wdGlvbnMsIHByaXZhdGUgcmVmbGVjdG9yOiBTdGF0aWNSZWZsZWN0b3IpIHt9XG5cbiAgLyoqXG4gICAqIEltcG9ydGFudCBub3RlczpcbiAgICogLSBUaGlzIG11c3Qgbm90IHByb2R1Y2UgbmV3IGBpbXBvcnRgIHN0YXRlbWVudHMsIGJ1dCBvbmx5IHJlZmVyIHRvIHR5cGVzIG91dHNpZGVcbiAgICogICBvZiB0aGUgZmlsZSB2aWEgdGhlIHZhcmlhYmxlcyBwcm92aWRlZCB2aWEgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzLlxuICAgKiAgIFRoaXMgYWxsb3dzIFR5cGVzY3JpcHQgdG8gcmV1c2UgdGhlIG9sZCBwcm9ncmFtJ3Mgc3RydWN0dXJlIGFzIG5vIGltcG9ydHMgaGF2ZSBjaGFuZ2VkLlxuICAgKiAtIFRoaXMgbXVzdCBub3QgcHJvZHVjZSBhbnkgZXhwb3J0cywgYXMgdGhpcyB3b3VsZCBwb2xsdXRlIHRoZSAuZC50cyBmaWxlXG4gICAqICAgYW5kIGFsc28gdmlvbGF0ZSB0aGUgcG9pbnQgYWJvdmUuXG4gICAqL1xuICBjb21waWxlQ29tcG9uZW50KFxuICAgICAgY29tcG9uZW50SWQ6IHN0cmluZywgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHRlbXBsYXRlOiBUZW1wbGF0ZUFzdFtdLFxuICAgICAgdXNlZFBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSwgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzOiBNYXA8U3RhdGljU3ltYm9sLCBzdHJpbmc+LFxuICAgICAgY3R4OiBPdXRwdXRDb250ZXh0KTogby5TdGF0ZW1lbnRbXSB7XG4gICAgY29uc3QgcGlwZXMgPSBuZXcgTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPigpO1xuICAgIHVzZWRQaXBlcy5mb3JFYWNoKHAgPT4gcGlwZXMuc2V0KHAubmFtZSwgcC50eXBlLnJlZmVyZW5jZSkpO1xuICAgIGxldCBlbWJlZGRlZFZpZXdDb3VudCA9IDA7XG4gICAgY29uc3Qgdmlld0J1aWxkZXJGYWN0b3J5ID1cbiAgICAgICAgKHBhcmVudDogVmlld0J1aWxkZXJ8bnVsbCwgZ3VhcmRzOiBHdWFyZEV4cHJlc3Npb25bXSk6IFZpZXdCdWlsZGVyID0+IHtcbiAgICAgICAgICBjb25zdCBlbWJlZGRlZFZpZXdJbmRleCA9IGVtYmVkZGVkVmlld0NvdW50Kys7XG4gICAgICAgICAgcmV0dXJuIG5ldyBWaWV3QnVpbGRlcihcbiAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLCB0aGlzLnJlZmxlY3RvciwgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzLCBwYXJlbnQsIGNvbXBvbmVudC50eXBlLnJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgY29tcG9uZW50LmlzSG9zdCwgZW1iZWRkZWRWaWV3SW5kZXgsIHBpcGVzLCBndWFyZHMsIGN0eCwgdmlld0J1aWxkZXJGYWN0b3J5KTtcbiAgICAgICAgfTtcblxuICAgIGNvbnN0IHZpc2l0b3IgPSB2aWV3QnVpbGRlckZhY3RvcnkobnVsbCwgW10pO1xuICAgIHZpc2l0b3IudmlzaXRBbGwoW10sIHRlbXBsYXRlKTtcblxuICAgIHJldHVybiB2aXNpdG9yLmJ1aWxkKGNvbXBvbmVudElkKTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgR3VhcmRFeHByZXNzaW9uIHtcbiAgZ3VhcmQ6IFN0YXRpY1N5bWJvbDtcbiAgdXNlSWY6IGJvb2xlYW47XG4gIGV4cHJlc3Npb246IEV4cHJlc3Npb247XG59XG5cbmludGVyZmFjZSBWaWV3QnVpbGRlckZhY3Rvcnkge1xuICAocGFyZW50OiBWaWV3QnVpbGRlciwgZ3VhcmRzOiBHdWFyZEV4cHJlc3Npb25bXSk6IFZpZXdCdWlsZGVyO1xufVxuXG4vLyBOb3RlOiBUaGlzIGlzIHVzZWQgYXMga2V5IGluIE1hcCBhbmQgc2hvdWxkIHRoZXJlZm9yZSBiZVxuLy8gdW5pcXVlIHBlciB2YWx1ZS5cbnR5cGUgT3V0cHV0VmFyVHlwZSA9IG8uQnVpbHRpblR5cGVOYW1lfFN0YXRpY1N5bWJvbDtcblxuaW50ZXJmYWNlIEV4cHJlc3Npb24ge1xuICBjb250ZXh0OiBPdXRwdXRWYXJUeXBlO1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gIHZhbHVlOiBBU1Q7XG59XG5cbmNvbnN0IERZTkFNSUNfVkFSX05BTUUgPSAnX2FueSc7XG5cbmNsYXNzIFR5cGVDaGVja0xvY2FsUmVzb2x2ZXIgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHt9XG4gIG1heWJlUmVzdG9yZVZpZXcoKTogdm9pZCB7fVxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKG5hbWUgPT09IEV2ZW50SGFuZGxlclZhcnMuZXZlbnQubmFtZSkge1xuICAgICAgLy8gUmVmZXJlbmNlcyB0byB0aGUgZXZlbnQgc2hvdWxkIG5vdCBiZSB0eXBlLWNoZWNrZWQuXG4gICAgICAvLyBUT0RPKGNodWNraik6IGRldGVybWluZSBhIGJldHRlciB0eXBlIGZvciB0aGUgZXZlbnQuXG4gICAgICByZXR1cm4gby52YXJpYWJsZShEWU5BTUlDX1ZBUl9OQU1FKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuY29uc3QgZGVmYXVsdFJlc29sdmVyID0gbmV3IFR5cGVDaGVja0xvY2FsUmVzb2x2ZXIoKTtcblxuY2xhc3MgVmlld0J1aWxkZXIgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdFZpc2l0b3IsIExvY2FsUmVzb2x2ZXIge1xuICBwcml2YXRlIHJlZk91dHB1dFZhcnMgPSBuZXcgTWFwPHN0cmluZywgT3V0cHV0VmFyVHlwZT4oKTtcbiAgcHJpdmF0ZSB2YXJpYWJsZXM6IFZhcmlhYmxlQXN0W10gPSBbXTtcbiAgcHJpdmF0ZSBjaGlsZHJlbjogVmlld0J1aWxkZXJbXSA9IFtdO1xuICBwcml2YXRlIHVwZGF0ZXM6IEV4cHJlc3Npb25bXSA9IFtdO1xuICBwcml2YXRlIGFjdGlvbnM6IEV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBvcHRpb25zOiBBb3RDb21waWxlck9wdGlvbnMsIHByaXZhdGUgcmVmbGVjdG9yOiBTdGF0aWNSZWZsZWN0b3IsXG4gICAgICBwcml2YXRlIGV4dGVybmFsUmVmZXJlbmNlVmFyczogTWFwPFN0YXRpY1N5bWJvbCwgc3RyaW5nPiwgcHJpdmF0ZSBwYXJlbnQ6IFZpZXdCdWlsZGVyfG51bGwsXG4gICAgICBwcml2YXRlIGNvbXBvbmVudDogU3RhdGljU3ltYm9sLCBwcml2YXRlIGlzSG9zdENvbXBvbmVudDogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgZW1iZWRkZWRWaWV3SW5kZXg6IG51bWJlciwgcHJpdmF0ZSBwaXBlczogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPixcbiAgICAgIHByaXZhdGUgZ3VhcmRzOiBHdWFyZEV4cHJlc3Npb25bXSwgcHJpdmF0ZSBjdHg6IE91dHB1dENvbnRleHQsXG4gICAgICBwcml2YXRlIHZpZXdCdWlsZGVyRmFjdG9yeTogVmlld0J1aWxkZXJGYWN0b3J5KSB7fVxuXG4gIHByaXZhdGUgZ2V0T3V0cHV0VmFyKHR5cGU6IG8uQnVpbHRpblR5cGVOYW1lfFN0YXRpY1N5bWJvbCk6IHN0cmluZyB7XG4gICAgbGV0IHZhck5hbWU6IHN0cmluZ3x1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGUgPT09IHRoaXMuY29tcG9uZW50ICYmIHRoaXMuaXNIb3N0Q29tcG9uZW50KSB7XG4gICAgICB2YXJOYW1lID0gRFlOQU1JQ19WQVJfTkFNRTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICAgIHZhck5hbWUgPSB0aGlzLmV4dGVybmFsUmVmZXJlbmNlVmFycy5nZXQodHlwZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhck5hbWUgPSBEWU5BTUlDX1ZBUl9OQU1FO1xuICAgIH1cbiAgICBpZiAoIXZhck5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgSWxsZWdhbCBTdGF0ZTogcmVmZXJyaW5nIHRvIGEgdHlwZSB3aXRob3V0IGEgdmFyaWFibGUgJHtKU09OLnN0cmluZ2lmeSh0eXBlKX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhck5hbWU7XG4gIH1cblxuICBwcml2YXRlIGdldFR5cGVHdWFyZEV4cHJlc3Npb25zKGFzdDogRW1iZWRkZWRUZW1wbGF0ZUFzdCk6IEd1YXJkRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCByZXN1bHQgPSBbLi4udGhpcy5ndWFyZHNdO1xuICAgIGZvciAobGV0IGRpcmVjdGl2ZSBvZiBhc3QuZGlyZWN0aXZlcykge1xuICAgICAgZm9yIChsZXQgaW5wdXQgb2YgZGlyZWN0aXZlLmlucHV0cykge1xuICAgICAgICBjb25zdCBndWFyZCA9IGRpcmVjdGl2ZS5kaXJlY3RpdmUuZ3VhcmRzW2lucHV0LmRpcmVjdGl2ZU5hbWVdO1xuICAgICAgICBpZiAoZ3VhcmQpIHtcbiAgICAgICAgICBjb25zdCB1c2VJZiA9IGd1YXJkID09PSAnVXNlSWYnO1xuICAgICAgICAgIHJlc3VsdC5wdXNoKHtcbiAgICAgICAgICAgIGd1YXJkLFxuICAgICAgICAgICAgdXNlSWYsXG4gICAgICAgICAgICBleHByZXNzaW9uOiB7XG4gICAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuY29tcG9uZW50LFxuICAgICAgICAgICAgICB2YWx1ZTogaW5wdXQudmFsdWUsXG4gICAgICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICB2aXNpdEFsbCh2YXJpYWJsZXM6IFZhcmlhYmxlQXN0W10sIGFzdE5vZGVzOiBUZW1wbGF0ZUFzdFtdKSB7XG4gICAgdGhpcy52YXJpYWJsZXMgPSB2YXJpYWJsZXM7XG4gICAgdGVtcGxhdGVWaXNpdEFsbCh0aGlzLCBhc3ROb2Rlcyk7XG4gIH1cblxuICBidWlsZChjb21wb25lbnRJZDogc3RyaW5nLCB0YXJnZXRTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW10pOiBvLlN0YXRlbWVudFtdIHtcbiAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goKGNoaWxkKSA9PiBjaGlsZC5idWlsZChjb21wb25lbnRJZCwgdGFyZ2V0U3RhdGVtZW50cykpO1xuICAgIGxldCB2aWV3U3RtdHM6IG8uU3RhdGVtZW50W10gPVxuICAgICAgICBbby52YXJpYWJsZShEWU5BTUlDX1ZBUl9OQU1FKS5zZXQoby5OVUxMX0VYUFIpLnRvRGVjbFN0bXQoby5EWU5BTUlDX1RZUEUpXTtcbiAgICBsZXQgYmluZGluZ0NvdW50ID0gMDtcbiAgICB0aGlzLnVwZGF0ZXMuZm9yRWFjaCgoZXhwcmVzc2lvbikgPT4ge1xuICAgICAgY29uc3Qge3NvdXJjZVNwYW4sIGNvbnRleHQsIHZhbHVlfSA9IHRoaXMucHJlcHJvY2Vzc1VwZGF0ZUV4cHJlc3Npb24oZXhwcmVzc2lvbik7XG4gICAgICBjb25zdCBiaW5kaW5nSWQgPSBgJHtiaW5kaW5nQ291bnQrK31gO1xuICAgICAgY29uc3QgbmFtZVJlc29sdmVyID0gY29udGV4dCA9PT0gdGhpcy5jb21wb25lbnQgPyB0aGlzIDogZGVmYXVsdFJlc29sdmVyO1xuICAgICAgY29uc3Qge3N0bXRzLCBjdXJyVmFsRXhwcn0gPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgIG5hbWVSZXNvbHZlciwgby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihjb250ZXh0KSksIHZhbHVlLCBiaW5kaW5nSWQsXG4gICAgICAgICAgQmluZGluZ0Zvcm0uR2VuZXJhbCk7XG4gICAgICBzdG10cy5wdXNoKG5ldyBvLkV4cHJlc3Npb25TdGF0ZW1lbnQoY3VyclZhbEV4cHIpKTtcbiAgICAgIHZpZXdTdG10cy5wdXNoKC4uLnN0bXRzLm1hcChcbiAgICAgICAgICAoc3RtdDogby5TdGF0ZW1lbnQpID0+IG8uYXBwbHlTb3VyY2VTcGFuVG9TdGF0ZW1lbnRJZk5lZWRlZChzdG10LCBzb3VyY2VTcGFuKSkpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5hY3Rpb25zLmZvckVhY2goKHtzb3VyY2VTcGFuLCBjb250ZXh0LCB2YWx1ZX0pID0+IHtcbiAgICAgIGNvbnN0IGJpbmRpbmdJZCA9IGAke2JpbmRpbmdDb3VudCsrfWA7XG4gICAgICBjb25zdCBuYW1lUmVzb2x2ZXIgPSBjb250ZXh0ID09PSB0aGlzLmNvbXBvbmVudCA/IHRoaXMgOiBkZWZhdWx0UmVzb2x2ZXI7XG4gICAgICBjb25zdCB7c3RtdHN9ID0gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgICAgICAgbmFtZVJlc29sdmVyLCBvLnZhcmlhYmxlKHRoaXMuZ2V0T3V0cHV0VmFyKGNvbnRleHQpKSwgdmFsdWUsIGJpbmRpbmdJZCk7XG4gICAgICB2aWV3U3RtdHMucHVzaCguLi5zdG10cy5tYXAoXG4gICAgICAgICAgKHN0bXQ6IG8uU3RhdGVtZW50KSA9PiBvLmFwcGx5U291cmNlU3BhblRvU3RhdGVtZW50SWZOZWVkZWQoc3RtdCwgc291cmNlU3BhbikpKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmd1YXJkcy5sZW5ndGgpIHtcbiAgICAgIGxldCBndWFyZEV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICBmb3IgKGNvbnN0IGd1YXJkIG9mIHRoaXMuZ3VhcmRzKSB7XG4gICAgICAgIGNvbnN0IHtjb250ZXh0LCB2YWx1ZX0gPSB0aGlzLnByZXByb2Nlc3NVcGRhdGVFeHByZXNzaW9uKGd1YXJkLmV4cHJlc3Npb24pO1xuICAgICAgICBjb25zdCBiaW5kaW5nSWQgPSBgJHtiaW5kaW5nQ291bnQrK31gO1xuICAgICAgICBjb25zdCBuYW1lUmVzb2x2ZXIgPSBjb250ZXh0ID09PSB0aGlzLmNvbXBvbmVudCA/IHRoaXMgOiBkZWZhdWx0UmVzb2x2ZXI7XG4gICAgICAgIC8vIFdlIG9ubHkgc3VwcG9ydCBzdXBwb3J0IHNpbXBsZSBleHByZXNzaW9ucyBhbmQgaWdub3JlIG90aGVycyBhcyB0aGV5XG4gICAgICAgIC8vIGFyZSB1bmxpa2VseSB0byBhZmZlY3QgdHlwZSBuYXJyb3dpbmcuXG4gICAgICAgIGNvbnN0IHtzdG10cywgY3VyclZhbEV4cHJ9ID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIG5hbWVSZXNvbHZlciwgby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihjb250ZXh0KSksIHZhbHVlLCBiaW5kaW5nSWQsXG4gICAgICAgICAgICBCaW5kaW5nRm9ybS5UcnlTaW1wbGUpO1xuICAgICAgICBpZiAoc3RtdHMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICBjb25zdCBndWFyZENsYXVzZSA9XG4gICAgICAgICAgICAgIGd1YXJkLnVzZUlmID8gY3VyclZhbEV4cHIgOiB0aGlzLmN0eC5pbXBvcnRFeHByKGd1YXJkLmd1YXJkKS5jYWxsRm4oW2N1cnJWYWxFeHByXSk7XG4gICAgICAgICAgZ3VhcmRFeHByZXNzaW9uID0gZ3VhcmRFeHByZXNzaW9uID8gZ3VhcmRFeHByZXNzaW9uLmFuZChndWFyZENsYXVzZSkgOiBndWFyZENsYXVzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGd1YXJkRXhwcmVzc2lvbikge1xuICAgICAgICB2aWV3U3RtdHMgPSBbbmV3IG8uSWZTdG10KGd1YXJkRXhwcmVzc2lvbiwgdmlld1N0bXRzKV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgdmlld05hbWUgPSBgX1ZpZXdfJHtjb21wb25lbnRJZH1fJHt0aGlzLmVtYmVkZGVkVmlld0luZGV4fWA7XG4gICAgY29uc3Qgdmlld0ZhY3RvcnkgPSBuZXcgby5EZWNsYXJlRnVuY3Rpb25TdG10KHZpZXdOYW1lLCBbXSwgdmlld1N0bXRzKTtcbiAgICB0YXJnZXRTdGF0ZW1lbnRzLnB1c2godmlld0ZhY3RvcnkpO1xuICAgIHJldHVybiB0YXJnZXRTdGF0ZW1lbnRzO1xuICB9XG5cbiAgdmlzaXRCb3VuZFRleHQoYXN0OiBCb3VuZFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXN0V2l0aFNvdXJjZSA9IDxBU1RXaXRoU291cmNlPmFzdC52YWx1ZTtcbiAgICBjb25zdCBpbnRlciA9IDxJbnRlcnBvbGF0aW9uPmFzdFdpdGhTb3VyY2UuYXN0O1xuXG4gICAgaW50ZXIuZXhwcmVzc2lvbnMuZm9yRWFjaChcbiAgICAgICAgKGV4cHIpID0+XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZXMucHVzaCh7Y29udGV4dDogdGhpcy5jb21wb25lbnQsIHZhbHVlOiBleHByLCBzb3VyY2VTcGFuOiBhc3Quc291cmNlU3Bhbn0pKTtcbiAgfVxuXG4gIHZpc2l0RW1iZWRkZWRUZW1wbGF0ZShhc3Q6IEVtYmVkZGVkVGVtcGxhdGVBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEVsZW1lbnRPclRlbXBsYXRlKGFzdCk7XG4gICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAvLyBmb3IgdGhlIGNvbnRleHQgaW4gYW55IGVtYmVkZGVkIHZpZXcuXG4gICAgLy8gV2Uga2VlcCB0aGlzIGJlaGFpdm9yIGJlaGluZCBhIGZsYWcgZm9yIG5vdy5cbiAgICBpZiAodGhpcy5vcHRpb25zLmZ1bGxUZW1wbGF0ZVR5cGVDaGVjaykge1xuICAgICAgLy8gRmluZCBhbnkgYXBwbGljYWJsZSB0eXBlIGd1YXJkcy4gRm9yIGV4YW1wbGUsIE5nSWYgaGFzIGEgdHlwZSBndWFyZCBvbiBuZ0lmXG4gICAgICAvLyAoc2VlIE5nSWYubmdJZlR5cGVHdWFyZCkgdGhhdCBjYW4gYmUgdXNlZCB0byBpbmRpY2F0ZSB0aGF0IGEgdGVtcGxhdGUgaXMgb25seVxuICAgICAgLy8gc3RhbXBlZCBvdXQgaWYgbmdJZiBpcyB0cnV0aHkgc28gYW55IGJpbmRpbmdzIGluIHRoZSB0ZW1wbGF0ZSBjYW4gYXNzdW1lIHRoYXQsXG4gICAgICAvLyBpZiBhIG51bGxhYmxlIHR5cGUgaXMgdXNlZCBmb3IgbmdJZiwgdGhhdCBleHByZXNzaW9uIGlzIG5vdCBudWxsIG9yIHVuZGVmaW5lZC5cbiAgICAgIGNvbnN0IGd1YXJkcyA9IHRoaXMuZ2V0VHlwZUd1YXJkRXhwcmVzc2lvbnMoYXN0KTtcbiAgICAgIGNvbnN0IGNoaWxkVmlzaXRvciA9IHRoaXMudmlld0J1aWxkZXJGYWN0b3J5KHRoaXMsIGd1YXJkcyk7XG4gICAgICB0aGlzLmNoaWxkcmVuLnB1c2goY2hpbGRWaXNpdG9yKTtcbiAgICAgIGNoaWxkVmlzaXRvci52aXNpdEFsbChhc3QudmFyaWFibGVzLCBhc3QuY2hpbGRyZW4pO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0RWxlbWVudChhc3Q6IEVsZW1lbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdEVsZW1lbnRPclRlbXBsYXRlKGFzdCk7XG5cbiAgICBsZXQgaW5wdXREZWZzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGxldCB1cGRhdGVSZW5kZXJlckV4cHJlc3Npb25zOiBFeHByZXNzaW9uW10gPSBbXTtcbiAgICBsZXQgb3V0cHV0RGVmczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBhc3QuaW5wdXRzLmZvckVhY2goKGlucHV0QXN0KSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZXMucHVzaChcbiAgICAgICAgICB7Y29udGV4dDogdGhpcy5jb21wb25lbnQsIHZhbHVlOiBpbnB1dEFzdC52YWx1ZSwgc291cmNlU3BhbjogaW5wdXRBc3Quc291cmNlU3Bhbn0pO1xuICAgIH0pO1xuXG4gICAgdGVtcGxhdGVWaXNpdEFsbCh0aGlzLCBhc3QuY2hpbGRyZW4pO1xuICB9XG5cbiAgcHJpdmF0ZSB2aXNpdEVsZW1lbnRPclRlbXBsYXRlKGFzdDoge1xuICAgIG91dHB1dHM6IEJvdW5kRXZlbnRBc3RbXSxcbiAgICBkaXJlY3RpdmVzOiBEaXJlY3RpdmVBc3RbXSxcbiAgICByZWZlcmVuY2VzOiBSZWZlcmVuY2VBc3RbXSxcbiAgfSkge1xuICAgIGFzdC5kaXJlY3RpdmVzLmZvckVhY2goKGRpckFzdCkgPT4ge1xuICAgICAgdGhpcy52aXNpdERpcmVjdGl2ZShkaXJBc3QpO1xuICAgIH0pO1xuXG4gICAgYXN0LnJlZmVyZW5jZXMuZm9yRWFjaCgocmVmKSA9PiB7XG4gICAgICBsZXQgb3V0cHV0VmFyVHlwZTogT3V0cHV0VmFyVHlwZSA9IG51bGwhO1xuICAgICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAgIC8vIGZvciBkaXJlY3RpdmVzIGV4cG9zZWQgdmlhIGBleHBvcnRBc2AuXG4gICAgICAvLyBXZSBrZWVwIHRoaXMgYmVoYWl2b3IgYmVoaW5kIGEgZmxhZyBmb3Igbm93LlxuICAgICAgaWYgKHJlZi52YWx1ZSAmJiByZWYudmFsdWUuaWRlbnRpZmllciAmJiB0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrKSB7XG4gICAgICAgIG91dHB1dFZhclR5cGUgPSByZWYudmFsdWUuaWRlbnRpZmllci5yZWZlcmVuY2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRWYXJUeXBlID0gby5CdWlsdGluVHlwZU5hbWUuRHluYW1pYztcbiAgICAgIH1cbiAgICAgIHRoaXMucmVmT3V0cHV0VmFycy5zZXQocmVmLm5hbWUsIG91dHB1dFZhclR5cGUpO1xuICAgIH0pO1xuICAgIGFzdC5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdCkgPT4ge1xuICAgICAgdGhpcy5hY3Rpb25zLnB1c2goXG4gICAgICAgICAge2NvbnRleHQ6IHRoaXMuY29tcG9uZW50LCB2YWx1ZTogb3V0cHV0QXN0LmhhbmRsZXIsIHNvdXJjZVNwYW46IG91dHB1dEFzdC5zb3VyY2VTcGFufSk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdERpcmVjdGl2ZShkaXJBc3Q6IERpcmVjdGl2ZUFzdCkge1xuICAgIGNvbnN0IGRpclR5cGUgPSBkaXJBc3QuZGlyZWN0aXZlLnR5cGUucmVmZXJlbmNlO1xuICAgIGRpckFzdC5pbnB1dHMuZm9yRWFjaChcbiAgICAgICAgKGlucHV0KSA9PiB0aGlzLnVwZGF0ZXMucHVzaChcbiAgICAgICAgICAgIHtjb250ZXh0OiB0aGlzLmNvbXBvbmVudCwgdmFsdWU6IGlucHV0LnZhbHVlLCBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFufSkpO1xuICAgIC8vIE5vdGU6IFRoZSBvbGQgdmlldyBjb21waWxlciB1c2VkIHRvIHVzZSBhbiBgYW55YCB0eXBlXG4gICAgLy8gZm9yIGV4cHJlc3Npb25zIGluIGhvc3QgcHJvcGVydGllcyAvIGV2ZW50cy5cbiAgICAvLyBXZSBrZWVwIHRoaXMgYmVoYWl2b3IgYmVoaW5kIGEgZmxhZyBmb3Igbm93LlxuICAgIGlmICh0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrKSB7XG4gICAgICBkaXJBc3QuaG9zdFByb3BlcnRpZXMuZm9yRWFjaChcbiAgICAgICAgICAoaW5wdXRBc3QpID0+IHRoaXMudXBkYXRlcy5wdXNoKFxuICAgICAgICAgICAgICB7Y29udGV4dDogZGlyVHlwZSwgdmFsdWU6IGlucHV0QXN0LnZhbHVlLCBzb3VyY2VTcGFuOiBpbnB1dEFzdC5zb3VyY2VTcGFufSkpO1xuICAgICAgZGlyQXN0Lmhvc3RFdmVudHMuZm9yRWFjaCgoaG9zdEV2ZW50QXN0KSA9PiB0aGlzLmFjdGlvbnMucHVzaCh7XG4gICAgICAgIGNvbnRleHQ6IGRpclR5cGUsXG4gICAgICAgIHZhbHVlOiBob3N0RXZlbnRBc3QuaGFuZGxlcixcbiAgICAgICAgc291cmNlU3BhbjogaG9zdEV2ZW50QXN0LnNvdXJjZVNwYW5cbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cblxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge31cbiAgbWF5YmVSZXN0b3JlVmlldygpOiB2b2lkIHt9XG5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChuYW1lID09IEV2ZW50SGFuZGxlclZhcnMuZXZlbnQubmFtZSkge1xuICAgICAgcmV0dXJuIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoby5CdWlsdGluVHlwZU5hbWUuRHluYW1pYykpO1xuICAgIH1cbiAgICBmb3IgKGxldCBjdXJyQnVpbGRlcjogVmlld0J1aWxkZXJ8bnVsbCA9IHRoaXM7IGN1cnJCdWlsZGVyOyBjdXJyQnVpbGRlciA9IGN1cnJCdWlsZGVyLnBhcmVudCkge1xuICAgICAgbGV0IG91dHB1dFZhclR5cGU6IE91dHB1dFZhclR5cGV8dW5kZWZpbmVkO1xuICAgICAgLy8gY2hlY2sgcmVmZXJlbmNlc1xuICAgICAgb3V0cHV0VmFyVHlwZSA9IGN1cnJCdWlsZGVyLnJlZk91dHB1dFZhcnMuZ2V0KG5hbWUpO1xuICAgICAgaWYgKG91dHB1dFZhclR5cGUgPT0gbnVsbCkge1xuICAgICAgICAvLyBjaGVjayB2YXJpYWJsZXNcbiAgICAgICAgY29uc3QgdmFyQXN0ID0gY3VyckJ1aWxkZXIudmFyaWFibGVzLmZpbmQoKHZhckFzdCkgPT4gdmFyQXN0Lm5hbWUgPT09IG5hbWUpO1xuICAgICAgICBpZiAodmFyQXN0KSB7XG4gICAgICAgICAgb3V0cHV0VmFyVHlwZSA9IG8uQnVpbHRpblR5cGVOYW1lLkR5bmFtaWM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChvdXRwdXRWYXJUeXBlICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIob3V0cHV0VmFyVHlwZSkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgcGlwZU91dHB1dFZhcihuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHBpcGUgPSB0aGlzLnBpcGVzLmdldChuYW1lKTtcbiAgICBpZiAoIXBpcGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgSWxsZWdhbCBTdGF0ZTogQ291bGQgbm90IGZpbmQgcGlwZSAke25hbWV9IGluIHRlbXBsYXRlIG9mICR7dGhpcy5jb21wb25lbnR9YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmdldE91dHB1dFZhcihwaXBlKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcHJvY2Vzc1VwZGF0ZUV4cHJlc3Npb24oZXhwcmVzc2lvbjogRXhwcmVzc2lvbik6IEV4cHJlc3Npb24ge1xuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2VTcGFuOiBleHByZXNzaW9uLnNvdXJjZVNwYW4sXG4gICAgICBjb250ZXh0OiBleHByZXNzaW9uLmNvbnRleHQsXG4gICAgICB2YWx1ZTogY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNyZWF0ZUxpdGVyYWxBcnJheUNvbnZlcnRlcjogKGFyZ0NvdW50OiBudW1iZXIpID0+IChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBhcnIgPSBvLmxpdGVyYWxBcnIoYXJncyk7XG4gICAgICAgICAgICAgIC8vIE5vdGU6IFRoZSBvbGQgdmlldyBjb21waWxlciB1c2VkIHRvIHVzZSBhbiBgYW55YCB0eXBlXG4gICAgICAgICAgICAgIC8vIGZvciBhcnJheXMuXG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrID8gYXJyIDogYXJyLmNhc3Qoby5EWU5BTUlDX1RZUEUpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNyZWF0ZUxpdGVyYWxNYXBDb252ZXJ0ZXI6IChrZXlzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbn1bXSkgPT5cbiAgICAgICAgICAgICAgICAodmFsdWVzOiBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgZW50cmllcyA9IGtleXMubWFwKChrLCBpKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrLmtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZXNbaV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdW90ZWQ6IGsucXVvdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG1hcCA9IG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbiAgICAgICAgICAgICAgICAgIC8vIE5vdGU6IFRoZSBvbGQgdmlldyBjb21waWxlciB1c2VkIHRvIHVzZSBhbiBgYW55YCB0eXBlXG4gICAgICAgICAgICAgICAgICAvLyBmb3IgbWFwcy5cbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuZnVsbFRlbXBsYXRlVHlwZUNoZWNrID8gbWFwIDogbWFwLmNhc3Qoby5EWU5BTUlDX1RZUEUpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjcmVhdGVQaXBlQ29udmVydGVyOiAobmFtZTogc3RyaW5nLCBhcmdDb3VudDogbnVtYmVyKSA9PiAoYXJnczogby5FeHByZXNzaW9uW10pID0+IHtcbiAgICAgICAgICAgICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAgICAgICAgICAgLy8gZm9yIHBpcGVzLlxuICAgICAgICAgICAgICBjb25zdCBwaXBlRXhwciA9IHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2sgP1xuICAgICAgICAgICAgICAgICAgby52YXJpYWJsZSh0aGlzLnBpcGVPdXRwdXRWYXIobmFtZSkpIDpcbiAgICAgICAgICAgICAgICAgIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoby5CdWlsdGluVHlwZU5hbWUuRHluYW1pYykpO1xuICAgICAgICAgICAgICByZXR1cm4gcGlwZUV4cHIucHJvcCgndHJhbnNmb3JtJykuY2FsbEZuKGFyZ3MpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGV4cHJlc3Npb24udmFsdWUpXG4gICAgfTtcbiAgfVxuXG4gIHZpc2l0TmdDb250ZW50KGFzdDogTmdDb250ZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRUZXh0KGFzdDogVGV4dEFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0RGlyZWN0aXZlUHJvcGVydHkoYXN0OiBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRSZWZlcmVuY2UoYXN0OiBSZWZlcmVuY2VBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFZhcmlhYmxlKGFzdDogVmFyaWFibGVBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEV2ZW50KGFzdDogQm91bmRFdmVudEFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0RWxlbWVudFByb3BlcnR5KGFzdDogQm91bmRFbGVtZW50UHJvcGVydHlBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEF0dHIoYXN0OiBBdHRyQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbn1cbiJdfQ==