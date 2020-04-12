/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __read, __spread, __values } from "tslib";
import { StaticSymbol } from '../aot/static_symbol';
import { BindingForm, EventHandlerVars, convertActionBinding, convertPropertyBinding, convertPropertyBindingBuiltins } from '../compiler_util/expression_converter';
import * as o from '../output/output_ast';
import { templateVisitAll } from '../template_parser/template_ast';
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
export { TypeCheckCompiler };
var DYNAMIC_VAR_NAME = '_any';
var TypeCheckLocalResolver = /** @class */ (function () {
    function TypeCheckLocalResolver() {
    }
    TypeCheckLocalResolver.prototype.notifyImplicitReceiverUse = function () { };
    TypeCheckLocalResolver.prototype.getLocal = function (name) {
        if (name === EventHandlerVars.event.name) {
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
        else if (type instanceof StaticSymbol) {
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
        var result = __spread(this.guards);
        try {
            for (var _c = __values(ast.directives), _d = _c.next(); !_d.done; _d = _c.next()) {
                var directive = _d.value;
                try {
                    for (var _e = (e_2 = void 0, __values(directive.inputs)), _f = _e.next(); !_f.done; _f = _e.next()) {
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
        templateVisitAll(this, astNodes);
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
            var _b = convertPropertyBinding(nameResolver, o.variable(_this.getOutputVar(context)), value, bindingId, BindingForm.General), stmts = _b.stmts, currValExpr = _b.currValExpr;
            stmts.push(new o.ExpressionStatement(currValExpr));
            viewStmts.push.apply(viewStmts, __spread(stmts.map(function (stmt) { return o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan); })));
        });
        this.actions.forEach(function (_a) {
            var sourceSpan = _a.sourceSpan, context = _a.context, value = _a.value;
            var bindingId = "" + bindingCount++;
            var nameResolver = context === _this.component ? _this : defaultResolver;
            var stmts = convertActionBinding(nameResolver, o.variable(_this.getOutputVar(context)), value, bindingId).stmts;
            viewStmts.push.apply(viewStmts, __spread(stmts.map(function (stmt) { return o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan); })));
        });
        if (this.guards.length) {
            var guardExpression = undefined;
            try {
                for (var _b = __values(this.guards), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var guard = _c.value;
                    var _d = this.preprocessUpdateExpression(guard.expression), context = _d.context, value = _d.value;
                    var bindingId = "" + bindingCount++;
                    var nameResolver = context === this.component ? this : defaultResolver;
                    // We only support support simple expressions and ignore others as they
                    // are unlikely to affect type narrowing.
                    var _e = convertPropertyBinding(nameResolver, o.variable(this.getOutputVar(context)), value, bindingId, BindingForm.TrySimple), stmts = _e.stmts, currValExpr = _e.currValExpr;
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
        templateVisitAll(this, ast.children);
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
        if (name == EventHandlerVars.event.name) {
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
            value: convertPropertyBindingBuiltins({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9jaGVja19jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy92aWV3X2NvbXBpbGVyL3R5cGVfY2hlY2tfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUVsRCxPQUFPLEVBQUMsV0FBVyxFQUFFLGdCQUFnQixFQUFpQixvQkFBb0IsRUFBRSxzQkFBc0IsRUFBRSw4QkFBOEIsRUFBQyxNQUFNLHVDQUF1QyxDQUFDO0FBRWpMLE9BQU8sS0FBSyxDQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFMUMsT0FBTyxFQUE2TixnQkFBZ0IsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBSzdSOztHQUVHO0FBQ0g7SUFDRSwyQkFBb0IsT0FBMkIsRUFBVSxTQUEwQjtRQUEvRCxZQUFPLEdBQVAsT0FBTyxDQUFvQjtRQUFVLGNBQVMsR0FBVCxTQUFTLENBQWlCO0lBQUcsQ0FBQztJQUV2Rjs7Ozs7OztPQU9HO0lBQ0gsNENBQWdCLEdBQWhCLFVBQ0ksV0FBbUIsRUFBRSxTQUFtQyxFQUFFLFFBQXVCLEVBQ2pGLFNBQStCLEVBQUUscUJBQWdELEVBQ2pGLEdBQWtCO1FBSHRCLGlCQW1CQztRQWZDLElBQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO1FBQzlDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBbkMsQ0FBbUMsQ0FBQyxDQUFDO1FBQzVELElBQUksaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO1FBQzFCLElBQU0sa0JBQWtCLEdBQ3BCLFVBQUMsTUFBMEIsRUFBRSxN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LFFBQVEsQ0FBQyxLQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDdEMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDN0QsT0FBTyxRQUFRLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDaEQsQ0FBQyxFQVB3RCxDQU94RDthQUNGLEVBQ0QsVUFBVSxDQUFDLEtBQUssQ0FBQztTQUN0QixDQUFDO0lBQ0osQ0FBQztJQUVELG9DQUFjLEdBQWQsVUFBZSxHQUFpQixFQUFFLE9BQVksSUFBUSxDQUFDO0lBQ3ZELCtCQUFTLEdBQVQsVUFBVSxHQUFZLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDN0MsNENBQXNCLEdBQXRCLFVBQXVCLEdBQThCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDNUUsb0NBQWMsR0FBZCxVQUFlLEdBQWlCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDdkQsbUNBQWEsR0FBYixVQUFjLEdBQWdCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDckQsZ0NBQVUsR0FBVixVQUFXLEdBQWtCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDcEQsMENBQW9CLEdBQXBCLFVBQXFCLEdBQTRCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDeEUsK0JBQVMsR0FBVCxVQUFVLEdBQVksRUFBRSxPQUFZLElBQVEsQ0FBQztJQUMvQyxrQkFBQztBQUFELENBQUMsQUFsUkQsSUFrUkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QW90Q29tcGlsZXJPcHRpb25zfSBmcm9tICcuLi9hb3QvY29tcGlsZXJfb3B0aW9ucyc7XG5pbXBvcnQge1N0YXRpY1JlZmxlY3Rvcn0gZnJvbSAnLi4vYW90L3N0YXRpY19yZWZsZWN0b3InO1xuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlUGlwZVN1bW1hcnl9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgRXZlbnRIYW5kbGVyVmFycywgTG9jYWxSZXNvbHZlciwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGluc30gZnJvbSAnLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0FTVCwgQVNUV2l0aFNvdXJjZSwgSW50ZXJwb2xhdGlvbn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtBdHRyQXN0LCBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0LCBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCwgQm91bmRFdmVudEFzdCwgQm91bmRUZXh0QXN0LCBEaXJlY3RpdmVBc3QsIEVsZW1lbnRBc3QsIEVtYmVkZGVkVGVtcGxhdGVBc3QsIE5nQ29udGVudEFzdCwgUmVmZXJlbmNlQXN0LCBUZW1wbGF0ZUFzdCwgVGVtcGxhdGVBc3RWaXNpdG9yLCBUZXh0QXN0LCBWYXJpYWJsZUFzdCwgdGVtcGxhdGVWaXNpdEFsbH0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX2FzdCc7XG5pbXBvcnQge091dHB1dENvbnRleHR9IGZyb20gJy4uL3V0aWwnO1xuXG5cblxuLyoqXG4gKiBHZW5lcmF0ZXMgY29kZSB0aGF0IGlzIHVzZWQgdG8gdHlwZSBjaGVjayB0ZW1wbGF0ZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBUeXBlQ2hlY2tDb21waWxlciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3B0aW9uczogQW90Q29tcGlsZXJPcHRpb25zLCBwcml2YXRlIHJlZmxlY3RvcjogU3RhdGljUmVmbGVjdG9yKSB7fVxuXG4gIC8qKlxuICAgKiBJbXBvcnRhbnQgbm90ZXM6XG4gICAqIC0gVGhpcyBtdXN0IG5vdCBwcm9kdWNlIG5ldyBgaW1wb3J0YCBzdGF0ZW1lbnRzLCBidXQgb25seSByZWZlciB0byB0eXBlcyBvdXRzaWRlXG4gICAqICAgb2YgdGhlIGZpbGUgdmlhIHRoZSB2YXJpYWJsZXMgcHJvdmlkZWQgdmlhIGV4dGVybmFsUmVmZXJlbmNlVmFycy5cbiAgICogICBUaGlzIGFsbG93cyBUeXBlc2NyaXB0IHRvIHJldXNlIHRoZSBvbGQgcHJvZ3JhbSdzIHN0cnVjdHVyZSBhcyBubyBpbXBvcnRzIGhhdmUgY2hhbmdlZC5cbiAgICogLSBUaGlzIG11c3Qgbm90IHByb2R1Y2UgYW55IGV4cG9ydHMsIGFzIHRoaXMgd291bGQgcG9sbHV0ZSB0aGUgLmQudHMgZmlsZVxuICAgKiAgIGFuZCBhbHNvIHZpb2xhdGUgdGhlIHBvaW50IGFib3ZlLlxuICAgKi9cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGNvbXBvbmVudElkOiBzdHJpbmcsIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCB0ZW1wbGF0ZTogVGVtcGxhdGVBc3RbXSxcbiAgICAgIHVzZWRQaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10sIGV4dGVybmFsUmVmZXJlbmNlVmFyczogTWFwPFN0YXRpY1N5bWJvbCwgc3RyaW5nPixcbiAgICAgIGN0eDogT3V0cHV0Q29udGV4dCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGNvbnN0IHBpcGVzID0gbmV3IE1hcDxzdHJpbmcsIFN0YXRpY1N5bWJvbD4oKTtcbiAgICB1c2VkUGlwZXMuZm9yRWFjaChwID0+IHBpcGVzLnNldChwLm5hbWUsIHAudHlwZS5yZWZlcmVuY2UpKTtcbiAgICBsZXQgZW1iZWRkZWRWaWV3Q291bnQgPSAwO1xuICAgIGNvbnN0IHZpZXdCdWlsZGVyRmFjdG9yeSA9XG4gICAgICAgIChwYXJlbnQ6IFZpZXdCdWlsZGVyIHwgbnVsbCwgZ3VhcmRzOiBHdWFyZEV4cHJlc3Npb25bXSk6IFZpZXdCdWlsZGVyID0+IHtcbiAgICAgICAgICBjb25zdCBlbWJlZGRlZFZpZXdJbmRleCA9IGVtYmVkZGVkVmlld0NvdW50Kys7XG4gICAgICAgICAgcmV0dXJuIG5ldyBWaWV3QnVpbGRlcihcbiAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLCB0aGlzLnJlZmxlY3RvciwgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzLCBwYXJlbnQsIGNvbXBvbmVudC50eXBlLnJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgY29tcG9uZW50LmlzSG9zdCwgZW1iZWRkZWRWaWV3SW5kZXgsIHBpcGVzLCBndWFyZHMsIGN0eCwgdmlld0J1aWxkZXJGYWN0b3J5KTtcbiAgICAgICAgfTtcblxuICAgIGNvbnN0IHZpc2l0b3IgPSB2aWV3QnVpbGRlckZhY3RvcnkobnVsbCwgW10pO1xuICAgIHZpc2l0b3IudmlzaXRBbGwoW10sIHRlbXBsYXRlKTtcblxuICAgIHJldHVybiB2aXNpdG9yLmJ1aWxkKGNvbXBvbmVudElkKTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgR3VhcmRFeHByZXNzaW9uIHtcbiAgZ3VhcmQ6IFN0YXRpY1N5bWJvbDtcbiAgdXNlSWY6IGJvb2xlYW47XG4gIGV4cHJlc3Npb246IEV4cHJlc3Npb247XG59XG5cbmludGVyZmFjZSBWaWV3QnVpbGRlckZhY3Rvcnkge1xuICAocGFyZW50OiBWaWV3QnVpbGRlciwgZ3VhcmRzOiBHdWFyZEV4cHJlc3Npb25bXSk6IFZpZXdCdWlsZGVyO1xufVxuXG4vLyBOb3RlOiBUaGlzIGlzIHVzZWQgYXMga2V5IGluIE1hcCBhbmQgc2hvdWxkIHRoZXJlZm9yZSBiZVxuLy8gdW5pcXVlIHBlciB2YWx1ZS5cbnR5cGUgT3V0cHV0VmFyVHlwZSA9IG8uQnVpbHRpblR5cGVOYW1lIHwgU3RhdGljU3ltYm9sO1xuXG5pbnRlcmZhY2UgRXhwcmVzc2lvbiB7XG4gIGNvbnRleHQ6IE91dHB1dFZhclR5cGU7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmFsdWU6IEFTVDtcbn1cblxuY29uc3QgRFlOQU1JQ19WQVJfTkFNRSA9ICdfYW55JztcblxuY2xhc3MgVHlwZUNoZWNrTG9jYWxSZXNvbHZlciBpbXBsZW1lbnRzIExvY2FsUmVzb2x2ZXIge1xuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge31cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChuYW1lID09PSBFdmVudEhhbmRsZXJWYXJzLmV2ZW50Lm5hbWUpIHtcbiAgICAgIC8vIFJlZmVyZW5jZXMgdG8gdGhlIGV2ZW50IHNob3VsZCBub3QgYmUgdHlwZS1jaGVja2VkLlxuICAgICAgLy8gVE9ETyhjaHVja2opOiBkZXRlcm1pbmUgYSBiZXR0ZXIgdHlwZSBmb3IgdGhlIGV2ZW50LlxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoRFlOQU1JQ19WQVJfTkFNRSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmNvbnN0IGRlZmF1bHRSZXNvbHZlciA9IG5ldyBUeXBlQ2hlY2tMb2NhbFJlc29sdmVyKCk7XG5cbmNsYXNzIFZpZXdCdWlsZGVyIGltcGxlbWVudHMgVGVtcGxhdGVBc3RWaXNpdG9yLCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSByZWZPdXRwdXRWYXJzID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dFZhclR5cGU+KCk7XG4gIHByaXZhdGUgdmFyaWFibGVzOiBWYXJpYWJsZUFzdFtdID0gW107XG4gIHByaXZhdGUgY2hpbGRyZW46IFZpZXdCdWlsZGVyW10gPSBbXTtcbiAgcHJpdmF0ZSB1cGRhdGVzOiBFeHByZXNzaW9uW10gPSBbXTtcbiAgcHJpdmF0ZSBhY3Rpb25zOiBFeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgb3B0aW9uczogQW90Q29tcGlsZXJPcHRpb25zLCBwcml2YXRlIHJlZmxlY3RvcjogU3RhdGljUmVmbGVjdG9yLFxuICAgICAgcHJpdmF0ZSBleHRlcm5hbFJlZmVyZW5jZVZhcnM6IE1hcDxTdGF0aWNTeW1ib2wsIHN0cmluZz4sIHByaXZhdGUgcGFyZW50OiBWaWV3QnVpbGRlcnxudWxsLFxuICAgICAgcHJpdmF0ZSBjb21wb25lbnQ6IFN0YXRpY1N5bWJvbCwgcHJpdmF0ZSBpc0hvc3RDb21wb25lbnQ6IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGVtYmVkZGVkVmlld0luZGV4OiBudW1iZXIsIHByaXZhdGUgcGlwZXM6IE1hcDxzdHJpbmcsIFN0YXRpY1N5bWJvbD4sXG4gICAgICBwcml2YXRlIGd1YXJkczogR3VhcmRFeHByZXNzaW9uW10sIHByaXZhdGUgY3R4OiBPdXRwdXRDb250ZXh0LFxuICAgICAgcHJpdmF0ZSB2aWV3QnVpbGRlckZhY3Rvcnk6IFZpZXdCdWlsZGVyRmFjdG9yeSkge31cblxuICBwcml2YXRlIGdldE91dHB1dFZhcih0eXBlOiBvLkJ1aWx0aW5UeXBlTmFtZXxTdGF0aWNTeW1ib2wpOiBzdHJpbmcge1xuICAgIGxldCB2YXJOYW1lOiBzdHJpbmd8dW5kZWZpbmVkO1xuICAgIGlmICh0eXBlID09PSB0aGlzLmNvbXBvbmVudCAmJiB0aGlzLmlzSG9zdENvbXBvbmVudCkge1xuICAgICAgdmFyTmFtZSA9IERZTkFNSUNfVkFSX05BTUU7XG4gICAgfSBlbHNlIGlmICh0eXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICB2YXJOYW1lID0gdGhpcy5leHRlcm5hbFJlZmVyZW5jZVZhcnMuZ2V0KHR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXJOYW1lID0gRFlOQU1JQ19WQVJfTkFNRTtcbiAgICB9XG4gICAgaWYgKCF2YXJOYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYElsbGVnYWwgU3RhdGU6IHJlZmVycmluZyB0byBhIHR5cGUgd2l0aG91dCBhIHZhcmlhYmxlICR7SlNPTi5zdHJpbmdpZnkodHlwZSl9YCk7XG4gICAgfVxuICAgIHJldHVybiB2YXJOYW1lO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRUeXBlR3VhcmRFeHByZXNzaW9ucyhhc3Q6IEVtYmVkZGVkVGVtcGxhdGVBc3QpOiBHdWFyZEV4cHJlc3Npb25bXSB7XG4gICAgY29uc3QgcmVzdWx0ID0gWy4uLnRoaXMuZ3VhcmRzXTtcbiAgICBmb3IgKGxldCBkaXJlY3RpdmUgb2YgYXN0LmRpcmVjdGl2ZXMpIHtcbiAgICAgIGZvciAobGV0IGlucHV0IG9mIGRpcmVjdGl2ZS5pbnB1dHMpIHtcbiAgICAgICAgY29uc3QgZ3VhcmQgPSBkaXJlY3RpdmUuZGlyZWN0aXZlLmd1YXJkc1tpbnB1dC5kaXJlY3RpdmVOYW1lXTtcbiAgICAgICAgaWYgKGd1YXJkKSB7XG4gICAgICAgICAgY29uc3QgdXNlSWYgPSBndWFyZCA9PT0gJ1VzZUlmJztcbiAgICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICBndWFyZCxcbiAgICAgICAgICAgIHVzZUlmLFxuICAgICAgICAgICAgZXhwcmVzc2lvbjoge1xuICAgICAgICAgICAgICBjb250ZXh0OiB0aGlzLmNvbXBvbmVudCxcbiAgICAgICAgICAgICAgdmFsdWU6IGlucHV0LnZhbHVlLFxuICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdmlzaXRBbGwodmFyaWFibGVzOiBWYXJpYWJsZUFzdFtdLCBhc3ROb2RlczogVGVtcGxhdGVBc3RbXSkge1xuICAgIHRoaXMudmFyaWFibGVzID0gdmFyaWFibGVzO1xuICAgIHRlbXBsYXRlVmlzaXRBbGwodGhpcywgYXN0Tm9kZXMpO1xuICB9XG5cbiAgYnVpbGQoY29tcG9uZW50SWQ6IHN0cmluZywgdGFyZ2V0U3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgdGhpcy5jaGlsZHJlbi5mb3JFYWNoKChjaGlsZCkgPT4gY2hpbGQuYnVpbGQoY29tcG9uZW50SWQsIHRhcmdldFN0YXRlbWVudHMpKTtcbiAgICBsZXQgdmlld1N0bXRzOiBvLlN0YXRlbWVudFtdID1cbiAgICAgICAgW28udmFyaWFibGUoRFlOQU1JQ19WQVJfTkFNRSkuc2V0KG8uTlVMTF9FWFBSKS50b0RlY2xTdG10KG8uRFlOQU1JQ19UWVBFKV07XG4gICAgbGV0IGJpbmRpbmdDb3VudCA9IDA7XG4gICAgdGhpcy51cGRhdGVzLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcbiAgICAgIGNvbnN0IHtzb3VyY2VTcGFuLCBjb250ZXh0LCB2YWx1ZX0gPSB0aGlzLnByZXByb2Nlc3NVcGRhdGVFeHByZXNzaW9uKGV4cHJlc3Npb24pO1xuICAgICAgY29uc3QgYmluZGluZ0lkID0gYCR7YmluZGluZ0NvdW50Kyt9YDtcbiAgICAgIGNvbnN0IG5hbWVSZXNvbHZlciA9IGNvbnRleHQgPT09IHRoaXMuY29tcG9uZW50ID8gdGhpcyA6IGRlZmF1bHRSZXNvbHZlcjtcbiAgICAgIGNvbnN0IHtzdG10cywgY3VyclZhbEV4cHJ9ID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICBuYW1lUmVzb2x2ZXIsIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoY29udGV4dCkpLCB2YWx1ZSwgYmluZGluZ0lkLFxuICAgICAgICAgIEJpbmRpbmdGb3JtLkdlbmVyYWwpO1xuICAgICAgc3RtdHMucHVzaChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGN1cnJWYWxFeHByKSk7XG4gICAgICB2aWV3U3RtdHMucHVzaCguLi5zdG10cy5tYXAoXG4gICAgICAgICAgKHN0bXQ6IG8uU3RhdGVtZW50KSA9PiBvLmFwcGx5U291cmNlU3BhblRvU3RhdGVtZW50SWZOZWVkZWQoc3RtdCwgc291cmNlU3BhbikpKTtcbiAgICB9KTtcblxuICAgIHRoaXMuYWN0aW9ucy5mb3JFYWNoKCh7c291cmNlU3BhbiwgY29udGV4dCwgdmFsdWV9KSA9PiB7XG4gICAgICBjb25zdCBiaW5kaW5nSWQgPSBgJHtiaW5kaW5nQ291bnQrK31gO1xuICAgICAgY29uc3QgbmFtZVJlc29sdmVyID0gY29udGV4dCA9PT0gdGhpcy5jb21wb25lbnQgPyB0aGlzIDogZGVmYXVsdFJlc29sdmVyO1xuICAgICAgY29uc3Qge3N0bXRzfSA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgIG5hbWVSZXNvbHZlciwgby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihjb250ZXh0KSksIHZhbHVlLCBiaW5kaW5nSWQpO1xuICAgICAgdmlld1N0bXRzLnB1c2goLi4uc3RtdHMubWFwKFxuICAgICAgICAgIChzdG10OiBvLlN0YXRlbWVudCkgPT4gby5hcHBseVNvdXJjZVNwYW5Ub1N0YXRlbWVudElmTmVlZGVkKHN0bXQsIHNvdXJjZVNwYW4pKSk7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5ndWFyZHMubGVuZ3RoKSB7XG4gICAgICBsZXQgZ3VhcmRFeHByZXNzaW9uOiBvLkV4cHJlc3Npb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgZm9yIChjb25zdCBndWFyZCBvZiB0aGlzLmd1YXJkcykge1xuICAgICAgICBjb25zdCB7Y29udGV4dCwgdmFsdWV9ID0gdGhpcy5wcmVwcm9jZXNzVXBkYXRlRXhwcmVzc2lvbihndWFyZC5leHByZXNzaW9uKTtcbiAgICAgICAgY29uc3QgYmluZGluZ0lkID0gYCR7YmluZGluZ0NvdW50Kyt9YDtcbiAgICAgICAgY29uc3QgbmFtZVJlc29sdmVyID0gY29udGV4dCA9PT0gdGhpcy5jb21wb25lbnQgPyB0aGlzIDogZGVmYXVsdFJlc29sdmVyO1xuICAgICAgICAvLyBXZSBvbmx5IHN1cHBvcnQgc3VwcG9ydCBzaW1wbGUgZXhwcmVzc2lvbnMgYW5kIGlnbm9yZSBvdGhlcnMgYXMgdGhleVxuICAgICAgICAvLyBhcmUgdW5saWtlbHkgdG8gYWZmZWN0IHR5cGUgbmFycm93aW5nLlxuICAgICAgICBjb25zdCB7c3RtdHMsIGN1cnJWYWxFeHByfSA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBuYW1lUmVzb2x2ZXIsIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoY29udGV4dCkpLCB2YWx1ZSwgYmluZGluZ0lkLFxuICAgICAgICAgICAgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlKTtcbiAgICAgICAgaWYgKHN0bXRzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgY29uc3QgZ3VhcmRDbGF1c2UgPVxuICAgICAgICAgICAgICBndWFyZC51c2VJZiA/IGN1cnJWYWxFeHByIDogdGhpcy5jdHguaW1wb3J0RXhwcihndWFyZC5ndWFyZCkuY2FsbEZuKFtjdXJyVmFsRXhwcl0pO1xuICAgICAgICAgIGd1YXJkRXhwcmVzc2lvbiA9IGd1YXJkRXhwcmVzc2lvbiA/IGd1YXJkRXhwcmVzc2lvbi5hbmQoZ3VhcmRDbGF1c2UpIDogZ3VhcmRDbGF1c2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChndWFyZEV4cHJlc3Npb24pIHtcbiAgICAgICAgdmlld1N0bXRzID0gW25ldyBvLklmU3RtdChndWFyZEV4cHJlc3Npb24sIHZpZXdTdG10cyldO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHZpZXdOYW1lID0gYF9WaWV3XyR7Y29tcG9uZW50SWR9XyR7dGhpcy5lbWJlZGRlZFZpZXdJbmRleH1gO1xuICAgIGNvbnN0IHZpZXdGYWN0b3J5ID0gbmV3IG8uRGVjbGFyZUZ1bmN0aW9uU3RtdCh2aWV3TmFtZSwgW10sIHZpZXdTdG10cyk7XG4gICAgdGFyZ2V0U3RhdGVtZW50cy5wdXNoKHZpZXdGYWN0b3J5KTtcbiAgICByZXR1cm4gdGFyZ2V0U3RhdGVtZW50cztcbiAgfVxuXG4gIHZpc2l0Qm91bmRUZXh0KGFzdDogQm91bmRUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFzdFdpdGhTb3VyY2UgPSA8QVNUV2l0aFNvdXJjZT5hc3QudmFsdWU7XG4gICAgY29uc3QgaW50ZXIgPSA8SW50ZXJwb2xhdGlvbj5hc3RXaXRoU291cmNlLmFzdDtcblxuICAgIGludGVyLmV4cHJlc3Npb25zLmZvckVhY2goXG4gICAgICAgIChleHByKSA9PlxuICAgICAgICAgICAgdGhpcy51cGRhdGVzLnB1c2goe2NvbnRleHQ6IHRoaXMuY29tcG9uZW50LCB2YWx1ZTogZXhwciwgc291cmNlU3BhbjogYXN0LnNvdXJjZVNwYW59KSk7XG4gIH1cblxuICB2aXNpdEVtYmVkZGVkVGVtcGxhdGUoYXN0OiBFbWJlZGRlZFRlbXBsYXRlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZShhc3QpO1xuICAgIC8vIE5vdGU6IFRoZSBvbGQgdmlldyBjb21waWxlciB1c2VkIHRvIHVzZSBhbiBgYW55YCB0eXBlXG4gICAgLy8gZm9yIHRoZSBjb250ZXh0IGluIGFueSBlbWJlZGRlZCB2aWV3LlxuICAgIC8vIFdlIGtlZXAgdGhpcyBiZWhhaXZvciBiZWhpbmQgYSBmbGFnIGZvciBub3cuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2spIHtcbiAgICAgIC8vIEZpbmQgYW55IGFwcGxpY2FibGUgdHlwZSBndWFyZHMuIEZvciBleGFtcGxlLCBOZ0lmIGhhcyBhIHR5cGUgZ3VhcmQgb24gbmdJZlxuICAgICAgLy8gKHNlZSBOZ0lmLm5nSWZUeXBlR3VhcmQpIHRoYXQgY2FuIGJlIHVzZWQgdG8gaW5kaWNhdGUgdGhhdCBhIHRlbXBsYXRlIGlzIG9ubHlcbiAgICAgIC8vIHN0YW1wZWQgb3V0IGlmIG5nSWYgaXMgdHJ1dGh5IHNvIGFueSBiaW5kaW5ncyBpbiB0aGUgdGVtcGxhdGUgY2FuIGFzc3VtZSB0aGF0LFxuICAgICAgLy8gaWYgYSBudWxsYWJsZSB0eXBlIGlzIHVzZWQgZm9yIG5nSWYsIHRoYXQgZXhwcmVzc2lvbiBpcyBub3QgbnVsbCBvciB1bmRlZmluZWQuXG4gICAgICBjb25zdCBndWFyZHMgPSB0aGlzLmdldFR5cGVHdWFyZEV4cHJlc3Npb25zKGFzdCk7XG4gICAgICBjb25zdCBjaGlsZFZpc2l0b3IgPSB0aGlzLnZpZXdCdWlsZGVyRmFjdG9yeSh0aGlzLCBndWFyZHMpO1xuICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKGNoaWxkVmlzaXRvcik7XG4gICAgICBjaGlsZFZpc2l0b3IudmlzaXRBbGwoYXN0LnZhcmlhYmxlcywgYXN0LmNoaWxkcmVuKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoYXN0OiBFbGVtZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZShhc3QpO1xuXG4gICAgbGV0IGlucHV0RGVmczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBsZXQgdXBkYXRlUmVuZGVyZXJFeHByZXNzaW9uczogRXhwcmVzc2lvbltdID0gW107XG4gICAgbGV0IG91dHB1dERlZnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgYXN0LmlucHV0cy5mb3JFYWNoKChpbnB1dEFzdCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVzLnB1c2goXG4gICAgICAgICAge2NvbnRleHQ6IHRoaXMuY29tcG9uZW50LCB2YWx1ZTogaW5wdXRBc3QudmFsdWUsIHNvdXJjZVNwYW46IGlucHV0QXN0LnNvdXJjZVNwYW59KTtcbiAgICB9KTtcblxuICAgIHRlbXBsYXRlVmlzaXRBbGwodGhpcywgYXN0LmNoaWxkcmVuKTtcbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRFbGVtZW50T3JUZW1wbGF0ZShhc3Q6IHtcbiAgICBvdXRwdXRzOiBCb3VuZEV2ZW50QXN0W10sXG4gICAgZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10sXG4gICAgcmVmZXJlbmNlczogUmVmZXJlbmNlQXN0W10sXG4gIH0pIHtcbiAgICBhc3QuZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJBc3QpID0+IHsgdGhpcy52aXNpdERpcmVjdGl2ZShkaXJBc3QpOyB9KTtcblxuICAgIGFzdC5yZWZlcmVuY2VzLmZvckVhY2goKHJlZikgPT4ge1xuICAgICAgbGV0IG91dHB1dFZhclR5cGU6IE91dHB1dFZhclR5cGUgPSBudWxsICE7XG4gICAgICAvLyBOb3RlOiBUaGUgb2xkIHZpZXcgY29tcGlsZXIgdXNlZCB0byB1c2UgYW4gYGFueWAgdHlwZVxuICAgICAgLy8gZm9yIGRpcmVjdGl2ZXMgZXhwb3NlZCB2aWEgYGV4cG9ydEFzYC5cbiAgICAgIC8vIFdlIGtlZXAgdGhpcyBiZWhhaXZvciBiZWhpbmQgYSBmbGFnIGZvciBub3cuXG4gICAgICBpZiAocmVmLnZhbHVlICYmIHJlZi52YWx1ZS5pZGVudGlmaWVyICYmIHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2spIHtcbiAgICAgICAgb3V0cHV0VmFyVHlwZSA9IHJlZi52YWx1ZS5pZGVudGlmaWVyLnJlZmVyZW5jZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dFZhclR5cGUgPSBvLkJ1aWx0aW5UeXBlTmFtZS5EeW5hbWljO1xuICAgICAgfVxuICAgICAgdGhpcy5yZWZPdXRwdXRWYXJzLnNldChyZWYubmFtZSwgb3V0cHV0VmFyVHlwZSk7XG4gICAgfSk7XG4gICAgYXN0Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0KSA9PiB7XG4gICAgICB0aGlzLmFjdGlvbnMucHVzaChcbiAgICAgICAgICB7Y29udGV4dDogdGhpcy5jb21wb25lbnQsIHZhbHVlOiBvdXRwdXRBc3QuaGFuZGxlciwgc291cmNlU3Bhbjogb3V0cHV0QXN0LnNvdXJjZVNwYW59KTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RGlyZWN0aXZlKGRpckFzdDogRGlyZWN0aXZlQXN0KSB7XG4gICAgY29uc3QgZGlyVHlwZSA9IGRpckFzdC5kaXJlY3RpdmUudHlwZS5yZWZlcmVuY2U7XG4gICAgZGlyQXN0LmlucHV0cy5mb3JFYWNoKFxuICAgICAgICAoaW5wdXQpID0+IHRoaXMudXBkYXRlcy5wdXNoKFxuICAgICAgICAgICAge2NvbnRleHQ6IHRoaXMuY29tcG9uZW50LCB2YWx1ZTogaW5wdXQudmFsdWUsIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW59KSk7XG4gICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAvLyBmb3IgZXhwcmVzc2lvbnMgaW4gaG9zdCBwcm9wZXJ0aWVzIC8gZXZlbnRzLlxuICAgIC8vIFdlIGtlZXAgdGhpcyBiZWhhaXZvciBiZWhpbmQgYSBmbGFnIGZvciBub3cuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2spIHtcbiAgICAgIGRpckFzdC5ob3N0UHJvcGVydGllcy5mb3JFYWNoKFxuICAgICAgICAgIChpbnB1dEFzdCkgPT4gdGhpcy51cGRhdGVzLnB1c2goXG4gICAgICAgICAgICAgIHtjb250ZXh0OiBkaXJUeXBlLCB2YWx1ZTogaW5wdXRBc3QudmFsdWUsIHNvdXJjZVNwYW46IGlucHV0QXN0LnNvdXJjZVNwYW59KSk7XG4gICAgICBkaXJBc3QuaG9zdEV2ZW50cy5mb3JFYWNoKChob3N0RXZlbnRBc3QpID0+IHRoaXMuYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgY29udGV4dDogZGlyVHlwZSxcbiAgICAgICAgdmFsdWU6IGhvc3RFdmVudEFzdC5oYW5kbGVyLFxuICAgICAgICBzb3VyY2VTcGFuOiBob3N0RXZlbnRBc3Quc291cmNlU3BhblxuICAgICAgfSkpO1xuICAgIH1cbiAgfVxuXG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZCB7fVxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKG5hbWUgPT0gRXZlbnRIYW5kbGVyVmFycy5ldmVudC5uYW1lKSB7XG4gICAgICByZXR1cm4gby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihvLkJ1aWx0aW5UeXBlTmFtZS5EeW5hbWljKSk7XG4gICAgfVxuICAgIGZvciAobGV0IGN1cnJCdWlsZGVyOiBWaWV3QnVpbGRlcnxudWxsID0gdGhpczsgY3VyckJ1aWxkZXI7IGN1cnJCdWlsZGVyID0gY3VyckJ1aWxkZXIucGFyZW50KSB7XG4gICAgICBsZXQgb3V0cHV0VmFyVHlwZTogT3V0cHV0VmFyVHlwZXx1bmRlZmluZWQ7XG4gICAgICAvLyBjaGVjayByZWZlcmVuY2VzXG4gICAgICBvdXRwdXRWYXJUeXBlID0gY3VyckJ1aWxkZXIucmVmT3V0cHV0VmFycy5nZXQobmFtZSk7XG4gICAgICBpZiAob3V0cHV0VmFyVHlwZSA9PSBudWxsKSB7XG4gICAgICAgIC8vIGNoZWNrIHZhcmlhYmxlc1xuICAgICAgICBjb25zdCB2YXJBc3QgPSBjdXJyQnVpbGRlci52YXJpYWJsZXMuZmluZCgodmFyQXN0KSA9PiB2YXJBc3QubmFtZSA9PT0gbmFtZSk7XG4gICAgICAgIGlmICh2YXJBc3QpIHtcbiAgICAgICAgICBvdXRwdXRWYXJUeXBlID0gby5CdWlsdGluVHlwZU5hbWUuRHluYW1pYztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKG91dHB1dFZhclR5cGUgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihvdXRwdXRWYXJUeXBlKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBwaXBlT3V0cHV0VmFyKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcGlwZSA9IHRoaXMucGlwZXMuZ2V0KG5hbWUpO1xuICAgIGlmICghcGlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBJbGxlZ2FsIFN0YXRlOiBDb3VsZCBub3QgZmluZCBwaXBlICR7bmFtZX0gaW4gdGVtcGxhdGUgb2YgJHt0aGlzLmNvbXBvbmVudH1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZ2V0T3V0cHV0VmFyKHBpcGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwcm9jZXNzVXBkYXRlRXhwcmVzc2lvbihleHByZXNzaW9uOiBFeHByZXNzaW9uKTogRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IGV4cHJlc3Npb24uc291cmNlU3BhbixcbiAgICAgIGNvbnRleHQ6IGV4cHJlc3Npb24uY29udGV4dCxcbiAgICAgIHZhbHVlOiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnMoXG4gICAgICAgICAge1xuICAgICAgICAgICAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyOiAoYXJnQ291bnQ6IG51bWJlcikgPT4gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGFyciA9IG8ubGl0ZXJhbEFycihhcmdzKTtcbiAgICAgICAgICAgICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAgICAgICAgICAgLy8gZm9yIGFycmF5cy5cbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2sgPyBhcnIgOiBhcnIuY2FzdChvLkRZTkFNSUNfVFlQRSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcjpcbiAgICAgICAgICAgICAgICAoa2V5czoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW59W10pID0+ICh2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyaWVzID0ga2V5cy5tYXAoKGssIGkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGsua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogay5xdW90ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgbWFwID0gby5saXRlcmFsTWFwKGVudHJpZXMpO1xuICAgICAgICAgICAgICAgICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAgICAgICAgICAgICAgIC8vIGZvciBtYXBzLlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2sgPyBtYXAgOiBtYXAuY2FzdChvLkRZTkFNSUNfVFlQRSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNyZWF0ZVBpcGVDb252ZXJ0ZXI6IChuYW1lOiBzdHJpbmcsIGFyZ0NvdW50OiBudW1iZXIpID0+IChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgICAgICAvLyBOb3RlOiBUaGUgb2xkIHZpZXcgY29tcGlsZXIgdXNlZCB0byB1c2UgYW4gYGFueWAgdHlwZVxuICAgICAgICAgICAgICAvLyBmb3IgcGlwZXMuXG4gICAgICAgICAgICAgIGNvbnN0IHBpcGVFeHByID0gdGhpcy5vcHRpb25zLmZ1bGxUZW1wbGF0ZVR5cGVDaGVjayA/XG4gICAgICAgICAgICAgICAgICBvLnZhcmlhYmxlKHRoaXMucGlwZU91dHB1dFZhcihuYW1lKSkgOlxuICAgICAgICAgICAgICAgICAgby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihvLkJ1aWx0aW5UeXBlTmFtZS5EeW5hbWljKSk7XG4gICAgICAgICAgICAgIHJldHVybiBwaXBlRXhwci5jYWxsTWV0aG9kKCd0cmFuc2Zvcm0nLCBhcmdzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBleHByZXNzaW9uLnZhbHVlKVxuICAgIH07XG4gIH1cblxuICB2aXNpdE5nQ29udGVudChhc3Q6IE5nQ29udGVudEFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0VGV4dChhc3Q6IFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdERpcmVjdGl2ZVByb3BlcnR5KGFzdDogQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0UmVmZXJlbmNlKGFzdDogUmVmZXJlbmNlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRWYXJpYWJsZShhc3Q6IFZhcmlhYmxlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRFdmVudChhc3Q6IEJvdW5kRXZlbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEVsZW1lbnRQcm9wZXJ0eShhc3Q6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRBdHRyKGFzdDogQXR0ckFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG59XG4iXX0=