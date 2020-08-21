(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/output/output_interpreter", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/ts_emitter"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.interpretStatements = void 0;
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var ts_emitter_1 = require("@angular/compiler/src/output/ts_emitter");
    function interpretStatements(statements, reflector) {
        var ctx = new _ExecutionContext(null, null, null, new Map());
        var visitor = new StatementInterpreter(reflector);
        visitor.visitAllStatements(statements, ctx);
        var result = {};
        ctx.exports.forEach(function (exportName) {
            result[exportName] = ctx.vars.get(exportName);
        });
        return result;
    }
    exports.interpretStatements = interpretStatements;
    function _executeFunctionStatements(varNames, varValues, statements, ctx, visitor) {
        var childCtx = ctx.createChildWihtLocalVars();
        for (var i = 0; i < varNames.length; i++) {
            childCtx.vars.set(varNames[i], varValues[i]);
        }
        var result = visitor.visitAllStatements(statements, childCtx);
        return result ? result.value : null;
    }
    var _ExecutionContext = /** @class */ (function () {
        function _ExecutionContext(parent, instance, className, vars) {
            this.parent = parent;
            this.instance = instance;
            this.className = className;
            this.vars = vars;
            this.exports = [];
        }
        _ExecutionContext.prototype.createChildWihtLocalVars = function () {
            return new _ExecutionContext(this, this.instance, this.className, new Map());
        };
        return _ExecutionContext;
    }());
    var ReturnValue = /** @class */ (function () {
        function ReturnValue(value) {
            this.value = value;
        }
        return ReturnValue;
    }());
    function createDynamicClass(_classStmt, _ctx, _visitor) {
        var propertyDescriptors = {};
        _classStmt.getters.forEach(function (getter) {
            // Note: use `function` instead of arrow function to capture `this`
            propertyDescriptors[getter.name] = {
                configurable: false,
                get: function () {
                    var instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
                    return _executeFunctionStatements([], [], getter.body, instanceCtx, _visitor);
                }
            };
        });
        _classStmt.methods.forEach(function (method) {
            var paramNames = method.params.map(function (param) { return param.name; });
            // Note: use `function` instead of arrow function to capture `this`
            propertyDescriptors[method.name] = {
                writable: false,
                configurable: false,
                value: function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    var instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
                    return _executeFunctionStatements(paramNames, args, method.body, instanceCtx, _visitor);
                }
            };
        });
        var ctorParamNames = _classStmt.constructorMethod.params.map(function (param) { return param.name; });
        // Note: use `function` instead of arrow function to capture `this`
        var ctor = function () {
            var _this = this;
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
            _classStmt.fields.forEach(function (field) {
                _this[field.name] = undefined;
            });
            _executeFunctionStatements(ctorParamNames, args, _classStmt.constructorMethod.body, instanceCtx, _visitor);
        };
        var superClass = _classStmt.parent ? _classStmt.parent.visitExpression(_visitor, _ctx) : Object;
        ctor.prototype = Object.create(superClass.prototype, propertyDescriptors);
        return ctor;
    }
    var StatementInterpreter = /** @class */ (function () {
        function StatementInterpreter(reflector) {
            this.reflector = reflector;
        }
        StatementInterpreter.prototype.debugAst = function (ast) {
            return ts_emitter_1.debugOutputAstAsTypeScript(ast);
        };
        StatementInterpreter.prototype.visitDeclareVarStmt = function (stmt, ctx) {
            var initialValue = stmt.value ? stmt.value.visitExpression(this, ctx) : undefined;
            ctx.vars.set(stmt.name, initialValue);
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.exports.push(stmt.name);
            }
            return null;
        };
        StatementInterpreter.prototype.visitWriteVarExpr = function (expr, ctx) {
            var value = expr.value.visitExpression(this, ctx);
            var currCtx = ctx;
            while (currCtx != null) {
                if (currCtx.vars.has(expr.name)) {
                    currCtx.vars.set(expr.name, value);
                    return value;
                }
                currCtx = currCtx.parent;
            }
            throw new Error("Not declared variable " + expr.name);
        };
        StatementInterpreter.prototype.visitWrappedNodeExpr = function (ast, ctx) {
            throw new Error('Cannot interpret a WrappedNodeExpr.');
        };
        StatementInterpreter.prototype.visitTypeofExpr = function (ast, ctx) {
            throw new Error('Cannot interpret a TypeofExpr');
        };
        StatementInterpreter.prototype.visitReadVarExpr = function (ast, ctx) {
            var varName = ast.name;
            if (ast.builtin != null) {
                switch (ast.builtin) {
                    case o.BuiltinVar.Super:
                        return Object.getPrototypeOf(ctx.instance);
                    case o.BuiltinVar.This:
                        return ctx.instance;
                    case o.BuiltinVar.CatchError:
                        varName = CATCH_ERROR_VAR;
                        break;
                    case o.BuiltinVar.CatchStack:
                        varName = CATCH_STACK_VAR;
                        break;
                    default:
                        throw new Error("Unknown builtin variable " + ast.builtin);
                }
            }
            var currCtx = ctx;
            while (currCtx != null) {
                if (currCtx.vars.has(varName)) {
                    return currCtx.vars.get(varName);
                }
                currCtx = currCtx.parent;
            }
            throw new Error("Not declared variable " + varName);
        };
        StatementInterpreter.prototype.visitWriteKeyExpr = function (expr, ctx) {
            var receiver = expr.receiver.visitExpression(this, ctx);
            var index = expr.index.visitExpression(this, ctx);
            var value = expr.value.visitExpression(this, ctx);
            receiver[index] = value;
            return value;
        };
        StatementInterpreter.prototype.visitWritePropExpr = function (expr, ctx) {
            var receiver = expr.receiver.visitExpression(this, ctx);
            var value = expr.value.visitExpression(this, ctx);
            receiver[expr.name] = value;
            return value;
        };
        StatementInterpreter.prototype.visitInvokeMethodExpr = function (expr, ctx) {
            var receiver = expr.receiver.visitExpression(this, ctx);
            var args = this.visitAllExpressions(expr.args, ctx);
            var result;
            if (expr.builtin != null) {
                switch (expr.builtin) {
                    case o.BuiltinMethod.ConcatArray:
                        result = receiver.concat.apply(receiver, tslib_1.__spread(args));
                        break;
                    case o.BuiltinMethod.SubscribeObservable:
                        result = receiver.subscribe({ next: args[0] });
                        break;
                    case o.BuiltinMethod.Bind:
                        result = receiver.bind.apply(receiver, tslib_1.__spread(args));
                        break;
                    default:
                        throw new Error("Unknown builtin method " + expr.builtin);
                }
            }
            else {
                result = receiver[expr.name].apply(receiver, args);
            }
            return result;
        };
        StatementInterpreter.prototype.visitInvokeFunctionExpr = function (stmt, ctx) {
            var args = this.visitAllExpressions(stmt.args, ctx);
            var fnExpr = stmt.fn;
            if (fnExpr instanceof o.ReadVarExpr && fnExpr.builtin === o.BuiltinVar.Super) {
                ctx.instance.constructor.prototype.constructor.apply(ctx.instance, args);
                return null;
            }
            else {
                var fn = stmt.fn.visitExpression(this, ctx);
                return fn.apply(null, args);
            }
        };
        StatementInterpreter.prototype.visitReturnStmt = function (stmt, ctx) {
            return new ReturnValue(stmt.value.visitExpression(this, ctx));
        };
        StatementInterpreter.prototype.visitDeclareClassStmt = function (stmt, ctx) {
            var clazz = createDynamicClass(stmt, ctx, this);
            ctx.vars.set(stmt.name, clazz);
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.exports.push(stmt.name);
            }
            return null;
        };
        StatementInterpreter.prototype.visitExpressionStmt = function (stmt, ctx) {
            return stmt.expr.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitIfStmt = function (stmt, ctx) {
            var condition = stmt.condition.visitExpression(this, ctx);
            if (condition) {
                return this.visitAllStatements(stmt.trueCase, ctx);
            }
            else if (stmt.falseCase != null) {
                return this.visitAllStatements(stmt.falseCase, ctx);
            }
            return null;
        };
        StatementInterpreter.prototype.visitTryCatchStmt = function (stmt, ctx) {
            try {
                return this.visitAllStatements(stmt.bodyStmts, ctx);
            }
            catch (e) {
                var childCtx = ctx.createChildWihtLocalVars();
                childCtx.vars.set(CATCH_ERROR_VAR, e);
                childCtx.vars.set(CATCH_STACK_VAR, e.stack);
                return this.visitAllStatements(stmt.catchStmts, childCtx);
            }
        };
        StatementInterpreter.prototype.visitThrowStmt = function (stmt, ctx) {
            throw stmt.error.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitCommentStmt = function (stmt, context) {
            return null;
        };
        StatementInterpreter.prototype.visitJSDocCommentStmt = function (stmt, context) {
            return null;
        };
        StatementInterpreter.prototype.visitInstantiateExpr = function (ast, ctx) {
            var args = this.visitAllExpressions(ast.args, ctx);
            var clazz = ast.classExpr.visitExpression(this, ctx);
            return new (clazz.bind.apply(clazz, tslib_1.__spread([void 0], args)))();
        };
        StatementInterpreter.prototype.visitLiteralExpr = function (ast, ctx) {
            return ast.value;
        };
        StatementInterpreter.prototype.visitLocalizedString = function (ast, context) {
            return null;
        };
        StatementInterpreter.prototype.visitExternalExpr = function (ast, ctx) {
            return this.reflector.resolveExternalReference(ast.value);
        };
        StatementInterpreter.prototype.visitConditionalExpr = function (ast, ctx) {
            if (ast.condition.visitExpression(this, ctx)) {
                return ast.trueCase.visitExpression(this, ctx);
            }
            else if (ast.falseCase != null) {
                return ast.falseCase.visitExpression(this, ctx);
            }
            return null;
        };
        StatementInterpreter.prototype.visitNotExpr = function (ast, ctx) {
            return !ast.condition.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitAssertNotNullExpr = function (ast, ctx) {
            return ast.condition.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitCastExpr = function (ast, ctx) {
            return ast.value.visitExpression(this, ctx);
        };
        StatementInterpreter.prototype.visitFunctionExpr = function (ast, ctx) {
            var paramNames = ast.params.map(function (param) { return param.name; });
            return _declareFn(paramNames, ast.statements, ctx, this);
        };
        StatementInterpreter.prototype.visitDeclareFunctionStmt = function (stmt, ctx) {
            var paramNames = stmt.params.map(function (param) { return param.name; });
            ctx.vars.set(stmt.name, _declareFn(paramNames, stmt.statements, ctx, this));
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.exports.push(stmt.name);
            }
            return null;
        };
        StatementInterpreter.prototype.visitUnaryOperatorExpr = function (ast, ctx) {
            var _this = this;
            var rhs = function () { return ast.expr.visitExpression(_this, ctx); };
            switch (ast.operator) {
                case o.UnaryOperator.Plus:
                    return +rhs();
                case o.UnaryOperator.Minus:
                    return -rhs();
                default:
                    throw new Error("Unknown operator " + ast.operator);
            }
        };
        StatementInterpreter.prototype.visitBinaryOperatorExpr = function (ast, ctx) {
            var _this = this;
            var lhs = function () { return ast.lhs.visitExpression(_this, ctx); };
            var rhs = function () { return ast.rhs.visitExpression(_this, ctx); };
            switch (ast.operator) {
                case o.BinaryOperator.Equals:
                    return lhs() == rhs();
                case o.BinaryOperator.Identical:
                    return lhs() === rhs();
                case o.BinaryOperator.NotEquals:
                    return lhs() != rhs();
                case o.BinaryOperator.NotIdentical:
                    return lhs() !== rhs();
                case o.BinaryOperator.And:
                    return lhs() && rhs();
                case o.BinaryOperator.Or:
                    return lhs() || rhs();
                case o.BinaryOperator.Plus:
                    return lhs() + rhs();
                case o.BinaryOperator.Minus:
                    return lhs() - rhs();
                case o.BinaryOperator.Divide:
                    return lhs() / rhs();
                case o.BinaryOperator.Multiply:
                    return lhs() * rhs();
                case o.BinaryOperator.Modulo:
                    return lhs() % rhs();
                case o.BinaryOperator.Lower:
                    return lhs() < rhs();
                case o.BinaryOperator.LowerEquals:
                    return lhs() <= rhs();
                case o.BinaryOperator.Bigger:
                    return lhs() > rhs();
                case o.BinaryOperator.BiggerEquals:
                    return lhs() >= rhs();
                default:
                    throw new Error("Unknown operator " + ast.operator);
            }
        };
        StatementInterpreter.prototype.visitReadPropExpr = function (ast, ctx) {
            var result;
            var receiver = ast.receiver.visitExpression(this, ctx);
            result = receiver[ast.name];
            return result;
        };
        StatementInterpreter.prototype.visitReadKeyExpr = function (ast, ctx) {
            var receiver = ast.receiver.visitExpression(this, ctx);
            var prop = ast.index.visitExpression(this, ctx);
            return receiver[prop];
        };
        StatementInterpreter.prototype.visitLiteralArrayExpr = function (ast, ctx) {
            return this.visitAllExpressions(ast.entries, ctx);
        };
        StatementInterpreter.prototype.visitLiteralMapExpr = function (ast, ctx) {
            var _this = this;
            var result = {};
            ast.entries.forEach(function (entry) { return result[entry.key] = entry.value.visitExpression(_this, ctx); });
            return result;
        };
        StatementInterpreter.prototype.visitCommaExpr = function (ast, context) {
            var values = this.visitAllExpressions(ast.parts, context);
            return values[values.length - 1];
        };
        StatementInterpreter.prototype.visitAllExpressions = function (expressions, ctx) {
            var _this = this;
            return expressions.map(function (expr) { return expr.visitExpression(_this, ctx); });
        };
        StatementInterpreter.prototype.visitAllStatements = function (statements, ctx) {
            for (var i = 0; i < statements.length; i++) {
                var stmt = statements[i];
                var val = stmt.visitStatement(this, ctx);
                if (val instanceof ReturnValue) {
                    return val;
                }
            }
            return null;
        };
        return StatementInterpreter;
    }());
    function _declareFn(varNames, statements, ctx, visitor) {
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return _executeFunctionStatements(varNames, args, statements, ctx, visitor);
        };
    }
    var CATCH_ERROR_VAR = 'error';
    var CATCH_STACK_VAR = 'stack';
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2ludGVycHJldGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL291dHB1dC9vdXRwdXRfaW50ZXJwcmV0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQVFBLDJEQUFrQztJQUNsQyxzRUFBd0Q7SUFFeEQsU0FBZ0IsbUJBQW1CLENBQy9CLFVBQXlCLEVBQUUsU0FBMkI7UUFDeEQsSUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEdBQUcsRUFBZSxDQUFDLENBQUM7UUFDNUUsSUFBTSxPQUFPLEdBQUcsSUFBSSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRCxPQUFPLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzVDLElBQU0sTUFBTSxHQUF5QixFQUFFLENBQUM7UUFDeEMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxVQUFVO1lBQzdCLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFWRCxrREFVQztJQUVELFNBQVMsMEJBQTBCLENBQy9CLFFBQWtCLEVBQUUsU0FBZ0IsRUFBRSxVQUF5QixFQUFFLEdBQXNCLEVBQ3ZGLE9BQTZCO1FBQy9CLElBQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ2hELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxD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LElBd1JDO0lBRUQsU0FBUyxVQUFVLENBQ2YsUUFBa0IsRUFBRSxVQUF5QixFQUFFLEdBQXNCLEVBQ3JFLE9BQTZCO1FBQy9CLE9BQU87WUFBQyxjQUFjO2lCQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7Z0JBQWQseUJBQWM7O1lBQUssT0FBQSwwQkFBMEIsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDO1FBQXBFLENBQW9FLENBQUM7SUFDbEcsQ0FBQztJQUVELElBQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQztJQUNoQyxJQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dF9hc3QnO1xuaW1wb3J0IHtkZWJ1Z091dHB1dEFzdEFzVHlwZVNjcmlwdH0gZnJvbSAnLi90c19lbWl0dGVyJztcblxuZXhwb3J0IGZ1bmN0aW9uIGludGVycHJldFN0YXRlbWVudHMoXG4gICAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICBjb25zdCBjdHggPSBuZXcgX0V4ZWN1dGlvbkNvbnRleHQobnVsbCwgbnVsbCwgbnVsbCwgbmV3IE1hcDxzdHJpbmcsIGFueT4oKSk7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgU3RhdGVtZW50SW50ZXJwcmV0ZXIocmVmbGVjdG9yKTtcbiAgdmlzaXRvci52aXNpdEFsbFN0YXRlbWVudHMoc3RhdGVtZW50cywgY3R4KTtcbiAgY29uc3QgcmVzdWx0OiB7W2tleTogc3RyaW5nXTogYW55fSA9IHt9O1xuICBjdHguZXhwb3J0cy5mb3JFYWNoKChleHBvcnROYW1lKSA9PiB7XG4gICAgcmVzdWx0W2V4cG9ydE5hbWVdID0gY3R4LnZhcnMuZ2V0KGV4cG9ydE5hbWUpO1xuICB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gX2V4ZWN1dGVGdW5jdGlvblN0YXRlbWVudHMoXG4gICAgdmFyTmFtZXM6IHN0cmluZ1tdLCB2YXJWYWx1ZXM6IGFueVtdLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0LFxuICAgIHZpc2l0b3I6IFN0YXRlbWVudEludGVycHJldGVyKTogYW55IHtcbiAgY29uc3QgY2hpbGRDdHggPSBjdHguY3JlYXRlQ2hpbGRXaWh0TG9jYWxWYXJzKCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmFyTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjaGlsZEN0eC52YXJzLnNldCh2YXJOYW1lc1tpXSwgdmFyVmFsdWVzW2ldKTtcbiAgfVxuICBjb25zdCByZXN1bHQgPSB2aXNpdG9yLnZpc2l0QWxsU3RhdGVtZW50cyhzdGF0ZW1lbnRzLCBjaGlsZEN0eCk7XG4gIHJldHVybiByZXN1bHQgPyByZXN1bHQudmFsdWUgOiBudWxsO1xufVxuXG5jbGFzcyBfRXhlY3V0aW9uQ29udGV4dCB7XG4gIGV4cG9ydHM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcGFyZW50OiBfRXhlY3V0aW9uQ29udGV4dHxudWxsLCBwdWJsaWMgaW5zdGFuY2U6IE9iamVjdHxudWxsLFxuICAgICAgcHVibGljIGNsYXNzTmFtZTogc3RyaW5nfG51bGwsIHB1YmxpYyB2YXJzOiBNYXA8c3RyaW5nLCBhbnk+KSB7fVxuXG4gIGNyZWF0ZUNoaWxkV2lodExvY2FsVmFycygpOiBfRXhlY3V0aW9uQ29udGV4dCB7XG4gICAgcmV0dXJuIG5ldyBfRXhlY3V0aW9uQ29udGV4dCh0aGlzLCB0aGlzLmluc3RhbmNlLCB0aGlzLmNsYXNzTmFtZSwgbmV3IE1hcDxzdHJpbmcsIGFueT4oKSk7XG4gIH1cbn1cblxuY2xhc3MgUmV0dXJuVmFsdWUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IGFueSkge31cbn1cblxuZnVuY3Rpb24gY3JlYXRlRHluYW1pY0NsYXNzKFxuICAgIF9jbGFzc1N0bXQ6IG8uQ2xhc3NTdG10LCBfY3R4OiBfRXhlY3V0aW9uQ29udGV4dCwgX3Zpc2l0b3I6IFN0YXRlbWVudEludGVycHJldGVyKTogRnVuY3Rpb24ge1xuICBjb25zdCBwcm9wZXJ0eURlc2NyaXB0b3JzOiB7W2tleTogc3RyaW5nXTogYW55fSA9IHt9O1xuXG4gIF9jbGFzc1N0bXQuZ2V0dGVycy5mb3JFYWNoKChnZXR0ZXI6IG8uQ2xhc3NHZXR0ZXIpID0+IHtcbiAgICAvLyBOb3RlOiB1c2UgYGZ1bmN0aW9uYCBpbnN0ZWFkIG9mIGFycm93IGZ1bmN0aW9uIHRvIGNhcHR1cmUgYHRoaXNgXG4gICAgcHJvcGVydHlEZXNjcmlwdG9yc1tnZXR0ZXIubmFtZV0gPSB7XG4gICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VDdHggPSBuZXcgX0V4ZWN1dGlvbkNvbnRleHQoX2N0eCwgdGhpcywgX2NsYXNzU3RtdC5uYW1lLCBfY3R4LnZhcnMpO1xuICAgICAgICByZXR1cm4gX2V4ZWN1dGVGdW5jdGlvblN0YXRlbWVudHMoW10sIFtdLCBnZXR0ZXIuYm9keSwgaW5zdGFuY2VDdHgsIF92aXNpdG9yKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KTtcbiAgX2NsYXNzU3RtdC5tZXRob2RzLmZvckVhY2goZnVuY3Rpb24obWV0aG9kOiBvLkNsYXNzTWV0aG9kKSB7XG4gICAgY29uc3QgcGFyYW1OYW1lcyA9IG1ldGhvZC5wYXJhbXMubWFwKHBhcmFtID0+IHBhcmFtLm5hbWUpO1xuICAgIC8vIE5vdGU6IHVzZSBgZnVuY3Rpb25gIGluc3RlYWQgb2YgYXJyb3cgZnVuY3Rpb24gdG8gY2FwdHVyZSBgdGhpc2BcbiAgICBwcm9wZXJ0eURlc2NyaXB0b3JzW21ldGhvZC5uYW1lIV0gPSB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IGZ1bmN0aW9uKC4uLmFyZ3M6IGFueVtdKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlQ3R4ID0gbmV3IF9FeGVjdXRpb25Db250ZXh0KF9jdHgsIHRoaXMsIF9jbGFzc1N0bXQubmFtZSwgX2N0eC52YXJzKTtcbiAgICAgICAgcmV0dXJuIF9leGVjdXRlRnVuY3Rpb25TdGF0ZW1lbnRzKHBhcmFtTmFtZXMsIGFyZ3MsIG1ldGhvZC5ib2R5LCBpbnN0YW5jZUN0eCwgX3Zpc2l0b3IpO1xuICAgICAgfVxuICAgIH07XG4gIH0pO1xuXG4gIGNvbnN0IGN0b3JQYXJhbU5hbWVzID0gX2NsYXNzU3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5wYXJhbXMubWFwKHBhcmFtID0+IHBhcmFtLm5hbWUpO1xuICAvLyBOb3RlOiB1c2UgYGZ1bmN0aW9uYCBpbnN0ZWFkIG9mIGFycm93IGZ1bmN0aW9uIHRvIGNhcHR1cmUgYHRoaXNgXG4gIGNvbnN0IGN0b3IgPSBmdW5jdGlvbih0aGlzOiBPYmplY3QsIC4uLmFyZ3M6IGFueVtdKSB7XG4gICAgY29uc3QgaW5zdGFuY2VDdHggPSBuZXcgX0V4ZWN1dGlvbkNvbnRleHQoX2N0eCwgdGhpcywgX2NsYXNzU3RtdC5uYW1lLCBfY3R4LnZhcnMpO1xuICAgIF9jbGFzc1N0bXQuZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XG4gICAgICAodGhpcyBhcyBhbnkpW2ZpZWxkLm5hbWVdID0gdW5kZWZpbmVkO1xuICAgIH0pO1xuICAgIF9leGVjdXRlRnVuY3Rpb25TdGF0ZW1lbnRzKFxuICAgICAgICBjdG9yUGFyYW1OYW1lcywgYXJncywgX2NsYXNzU3RtdC5jb25zdHJ1Y3Rvck1ldGhvZC5ib2R5LCBpbnN0YW5jZUN0eCwgX3Zpc2l0b3IpO1xuICB9O1xuICBjb25zdCBzdXBlckNsYXNzID0gX2NsYXNzU3RtdC5wYXJlbnQgPyBfY2xhc3NTdG10LnBhcmVudC52aXNpdEV4cHJlc3Npb24oX3Zpc2l0b3IsIF9jdHgpIDogT2JqZWN0O1xuICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcy5wcm90b3R5cGUsIHByb3BlcnR5RGVzY3JpcHRvcnMpO1xuICByZXR1cm4gY3Rvcjtcbn1cblxuY2xhc3MgU3RhdGVtZW50SW50ZXJwcmV0ZXIgaW1wbGVtZW50cyBvLlN0YXRlbWVudFZpc2l0b3IsIG8uRXhwcmVzc2lvblZpc2l0b3Ige1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcikge31cbiAgZGVidWdBc3QoYXN0OiBvLkV4cHJlc3Npb258by5TdGF0ZW1lbnR8by5UeXBlKTogc3RyaW5nIHtcbiAgICByZXR1cm4gZGVidWdPdXRwdXRBc3RBc1R5cGVTY3JpcHQoYXN0KTtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogby5EZWNsYXJlVmFyU3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgaW5pdGlhbFZhbHVlID0gc3RtdC52YWx1ZSA/IHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCkgOiB1bmRlZmluZWQ7XG4gICAgY3R4LnZhcnMuc2V0KHN0bXQubmFtZSwgaW5pdGlhbFZhbHVlKTtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIGN0eC5leHBvcnRzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRXcml0ZVZhckV4cHIoZXhwcjogby5Xcml0ZVZhckV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHZhbHVlID0gZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBsZXQgY3VyckN0eCA9IGN0eDtcbiAgICB3aGlsZSAoY3VyckN0eCAhPSBudWxsKSB7XG4gICAgICBpZiAoY3VyckN0eC52YXJzLmhhcyhleHByLm5hbWUpKSB7XG4gICAgICAgIGN1cnJDdHgudmFycy5zZXQoZXhwci5uYW1lLCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGN1cnJDdHggPSBjdXJyQ3R4LnBhcmVudCE7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgTm90IGRlY2xhcmVkIHZhcmlhYmxlICR7ZXhwci5uYW1lfWApO1xuICB9XG4gIHZpc2l0V3JhcHBlZE5vZGVFeHByKGFzdDogby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBpbnRlcnByZXQgYSBXcmFwcGVkTm9kZUV4cHIuJyk7XG4gIH1cbiAgdmlzaXRUeXBlb2ZFeHByKGFzdDogby5UeXBlb2ZFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGludGVycHJldCBhIFR5cGVvZkV4cHInKTtcbiAgfVxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogby5SZWFkVmFyRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgbGV0IHZhck5hbWUgPSBhc3QubmFtZSE7XG4gICAgaWYgKGFzdC5idWlsdGluICE9IG51bGwpIHtcbiAgICAgIHN3aXRjaCAoYXN0LmJ1aWx0aW4pIHtcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuU3VwZXI6XG4gICAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZihjdHguaW5zdGFuY2UpO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5UaGlzOlxuICAgICAgICAgIHJldHVybiBjdHguaW5zdGFuY2U7XG4gICAgICAgIGNhc2Ugby5CdWlsdGluVmFyLkNhdGNoRXJyb3I6XG4gICAgICAgICAgdmFyTmFtZSA9IENBVENIX0VSUk9SX1ZBUjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuQ2F0Y2hTdGFjazpcbiAgICAgICAgICB2YXJOYW1lID0gQ0FUQ0hfU1RBQ0tfVkFSO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsdGluIHZhcmlhYmxlICR7YXN0LmJ1aWx0aW59YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBjdXJyQ3R4ID0gY3R4O1xuICAgIHdoaWxlIChjdXJyQ3R4ICE9IG51bGwpIHtcbiAgICAgIGlmIChjdXJyQ3R4LnZhcnMuaGFzKHZhck5hbWUpKSB7XG4gICAgICAgIHJldHVybiBjdXJyQ3R4LnZhcnMuZ2V0KHZhck5hbWUpO1xuICAgICAgfVxuICAgICAgY3VyckN0eCA9IGN1cnJDdHgucGFyZW50ITtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBOb3QgZGVjbGFyZWQgdmFyaWFibGUgJHt2YXJOYW1lfWApO1xuICB9XG4gIHZpc2l0V3JpdGVLZXlFeHByKGV4cHI6IG8uV3JpdGVLZXlFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCByZWNlaXZlciA9IGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY29uc3QgaW5kZXggPSBleHByLmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IHZhbHVlID0gZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZWNlaXZlcltpbmRleF0gPSB2YWx1ZTtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgdmlzaXRXcml0ZVByb3BFeHByKGV4cHI6IG8uV3JpdGVQcm9wRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IHZhbHVlID0gZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZWNlaXZlcltleHByLm5hbWVdID0gdmFsdWU7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgdmlzaXRJbnZva2VNZXRob2RFeHByKGV4cHI6IG8uSW52b2tlTWV0aG9kRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwci5hcmdzLCBjdHgpO1xuICAgIGxldCByZXN1bHQ6IGFueTtcbiAgICBpZiAoZXhwci5idWlsdGluICE9IG51bGwpIHtcbiAgICAgIHN3aXRjaCAoZXhwci5idWlsdGluKSB7XG4gICAgICAgIGNhc2Ugby5CdWlsdGluTWV0aG9kLkNvbmNhdEFycmF5OlxuICAgICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLmNvbmNhdCguLi5hcmdzKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5NZXRob2QuU3Vic2NyaWJlT2JzZXJ2YWJsZTpcbiAgICAgICAgICByZXN1bHQgPSByZWNlaXZlci5zdWJzY3JpYmUoe25leHQ6IGFyZ3NbMF19KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5NZXRob2QuQmluZDpcbiAgICAgICAgICByZXN1bHQgPSByZWNlaXZlci5iaW5kKC4uLmFyZ3MpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsdGluIG1ldGhvZCAke2V4cHIuYnVpbHRpbn1gKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gcmVjZWl2ZXJbZXhwci5uYW1lIV0uYXBwbHkocmVjZWl2ZXIsIGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKHN0bXQ6IG8uSW52b2tlRnVuY3Rpb25FeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKHN0bXQuYXJncywgY3R4KTtcbiAgICBjb25zdCBmbkV4cHIgPSBzdG10LmZuO1xuICAgIGlmIChmbkV4cHIgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByICYmIGZuRXhwci5idWlsdGluID09PSBvLkJ1aWx0aW5WYXIuU3VwZXIpIHtcbiAgICAgIGN0eC5pbnN0YW5jZSEuY29uc3RydWN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yLmFwcGx5KGN0eC5pbnN0YW5jZSwgYXJncyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZm4gPSBzdG10LmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH1cbiAgfVxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogby5SZXR1cm5TdGF0ZW1lbnQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBuZXcgUmV0dXJuVmFsdWUoc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KSk7XG4gIH1cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBjbGF6eiA9IGNyZWF0ZUR5bmFtaWNDbGFzcyhzdG10LCBjdHgsIHRoaXMpO1xuICAgIGN0eC52YXJzLnNldChzdG10Lm5hbWUsIGNsYXp6KTtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIGN0eC5leHBvcnRzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBzdG10LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRJZlN0bXQoc3RtdDogby5JZlN0bXQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGNvbmRpdGlvbiA9IHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGlmIChjb25kaXRpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjdHgpO1xuICAgIH0gZWxzZSBpZiAoc3RtdC5mYWxzZUNhc2UgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjdHgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBvLlRyeUNhdGNoU3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmJvZHlTdG10cywgY3R4KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zdCBjaGlsZEN0eCA9IGN0eC5jcmVhdGVDaGlsZFdpaHRMb2NhbFZhcnMoKTtcbiAgICAgIGNoaWxkQ3R4LnZhcnMuc2V0KENBVENIX0VSUk9SX1ZBUiwgZSk7XG4gICAgICBjaGlsZEN0eC52YXJzLnNldChDQVRDSF9TVEFDS19WQVIsIGUuc3RhY2spO1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY2F0Y2hTdG10cywgY2hpbGRDdHgpO1xuICAgIH1cbiAgfVxuICB2aXNpdFRocm93U3RtdChzdG10OiBvLlRocm93U3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgdGhyb3cgc3RtdC5lcnJvci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdENvbW1lbnRTdG10KHN0bXQ6IG8uQ29tbWVudFN0bXQsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SlNEb2NDb21tZW50U3RtdChzdG10OiBvLkpTRG9jQ29tbWVudFN0bXQsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogby5JbnN0YW50aWF0ZUV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGN0eCk7XG4gICAgY29uc3QgY2xhenogPSBhc3QuY2xhc3NFeHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJldHVybiBuZXcgY2xhenooLi4uYXJncyk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IG8uTGl0ZXJhbEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBhc3QudmFsdWU7XG4gIH1cbiAgdmlzaXRMb2NhbGl6ZWRTdHJpbmcoYXN0OiBvLkxvY2FsaXplZFN0cmluZywgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IG8uRXh0ZXJuYWxFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKGFzdC52YWx1ZSk7XG4gIH1cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBvLkNvbmRpdGlvbmFsRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCkpIHtcbiAgICAgIHJldHVybiBhc3QudHJ1ZUNhc2UudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgfSBlbHNlIGlmIChhc3QuZmFsc2VDYXNlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiBhc3QuZmFsc2VDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdE5vdEV4cHIoYXN0OiBvLk5vdEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiAhYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogby5Bc3NlcnROb3ROdWxsLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICByZXR1cm4gYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdENhc3RFeHByKGFzdDogby5DYXN0RXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIGFzdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IG8uRnVuY3Rpb25FeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBwYXJhbU5hbWVzID0gYXN0LnBhcmFtcy5tYXAoKHBhcmFtKSA9PiBwYXJhbS5uYW1lKTtcbiAgICByZXR1cm4gX2RlY2xhcmVGbihwYXJhbU5hbWVzLCBhc3Quc3RhdGVtZW50cywgY3R4LCB0aGlzKTtcbiAgfVxuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogby5EZWNsYXJlRnVuY3Rpb25TdG10LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBwYXJhbU5hbWVzID0gc3RtdC5wYXJhbXMubWFwKChwYXJhbSkgPT4gcGFyYW0ubmFtZSk7XG4gICAgY3R4LnZhcnMuc2V0KHN0bXQubmFtZSwgX2RlY2xhcmVGbihwYXJhbU5hbWVzLCBzdG10LnN0YXRlbWVudHMsIGN0eCwgdGhpcykpO1xuICAgIGlmIChzdG10Lmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgY3R4LmV4cG9ydHMucHVzaChzdG10Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFVuYXJ5T3BlcmF0b3JFeHByKGFzdDogby5VbmFyeU9wZXJhdG9yRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmhzID0gKCkgPT4gYXN0LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG5cbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSBvLlVuYXJ5T3BlcmF0b3IuUGx1czpcbiAgICAgICAgcmV0dXJuICtyaHMoKTtcbiAgICAgIGNhc2Ugby5VbmFyeU9wZXJhdG9yLk1pbnVzOlxuICAgICAgICByZXR1cm4gLXJocygpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgfVxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IG8uQmluYXJ5T3BlcmF0b3JFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBsaHMgPSAoKSA9PiBhc3QubGhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IHJocyA9ICgpID0+IGFzdC5yaHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG5cbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkVxdWFsczpcbiAgICAgICAgcmV0dXJuIGxocygpID09IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbDpcbiAgICAgICAgcmV0dXJuIGxocygpID09PSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHM6XG4gICAgICAgIHJldHVybiBsaHMoKSAhPSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWw6XG4gICAgICAgIHJldHVybiBsaHMoKSAhPT0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuQW5kOlxuICAgICAgICByZXR1cm4gbGhzKCkgJiYgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuT3I6XG4gICAgICAgIHJldHVybiBsaHMoKSB8fCByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5QbHVzOlxuICAgICAgICByZXR1cm4gbGhzKCkgKyByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5NaW51czpcbiAgICAgICAgcmV0dXJuIGxocygpIC0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuRGl2aWRlOlxuICAgICAgICByZXR1cm4gbGhzKCkgLyByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5NdWx0aXBseTpcbiAgICAgICAgcmV0dXJuIGxocygpICogcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTW9kdWxvOlxuICAgICAgICByZXR1cm4gbGhzKCkgJSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Mb3dlcjpcbiAgICAgICAgcmV0dXJuIGxocygpIDwgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHM6XG4gICAgICAgIHJldHVybiBsaHMoKSA8PSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5CaWdnZXI6XG4gICAgICAgIHJldHVybiBsaHMoKSA+IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFsczpcbiAgICAgICAgcmV0dXJuIGxocygpID49IHJocygpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgfVxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IG8uUmVhZFByb3BFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBsZXQgcmVzdWx0OiBhbnk7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmVzdWx0ID0gcmVjZWl2ZXJbYXN0Lm5hbWVdO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IG8uUmVhZEtleUV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IHByb3AgPSBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmV0dXJuIHJlY2VpdmVyW3Byb3BdO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IG8uTGl0ZXJhbEFycmF5RXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuZW50cmllcywgY3R4KTtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXBFeHByKGFzdDogby5MaXRlcmFsTWFwRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0OiB7W2s6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgICBhc3QuZW50cmllcy5mb3JFYWNoKGVudHJ5ID0+IHJlc3VsdFtlbnRyeS5rZXldID0gZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgdmlzaXRDb21tYUV4cHIoYXN0OiBvLkNvbW1hRXhwciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZXMgPSB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LnBhcnRzLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdmFsdWVzW3ZhbHVlcy5sZW5ndGggLSAxXTtcbiAgfVxuICB2aXNpdEFsbEV4cHJlc3Npb25zKGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb25zLm1hcCgoZXhwcikgPT4gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KSk7XG4gIH1cblxuICB2aXNpdEFsbFN0YXRlbWVudHMoc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IFJldHVyblZhbHVlfG51bGwge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc3RtdCA9IHN0YXRlbWVudHNbaV07XG4gICAgICBjb25zdCB2YWwgPSBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGN0eCk7XG4gICAgICBpZiAodmFsIGluc3RhbmNlb2YgUmV0dXJuVmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2RlY2xhcmVGbihcbiAgICB2YXJOYW1lczogc3RyaW5nW10sIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQsXG4gICAgdmlzaXRvcjogU3RhdGVtZW50SW50ZXJwcmV0ZXIpOiBGdW5jdGlvbiB7XG4gIHJldHVybiAoLi4uYXJnczogYW55W10pID0+IF9leGVjdXRlRnVuY3Rpb25TdGF0ZW1lbnRzKHZhck5hbWVzLCBhcmdzLCBzdGF0ZW1lbnRzLCBjdHgsIHZpc2l0b3IpO1xufVxuXG5jb25zdCBDQVRDSF9FUlJPUl9WQVIgPSAnZXJyb3InO1xuY29uc3QgQ0FUQ0hfU1RBQ0tfVkFSID0gJ3N0YWNrJztcbiJdfQ==