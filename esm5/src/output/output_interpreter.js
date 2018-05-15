/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import * as o from './output_ast';
import { debugOutputAstAsTypeScript } from './ts_emitter';
export function interpretStatements(statements, reflector) {
    var ctx = new _ExecutionContext(null, null, null, new Map());
    var visitor = new StatementInterpreter(reflector);
    visitor.visitAllStatements(statements, ctx);
    var result = {};
    ctx.exports.forEach(function (exportName) { result[exportName] = ctx.vars.get(exportName); });
    return result;
}
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
        _classStmt.fields.forEach(function (field) { _this[field.name] = undefined; });
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
    StatementInterpreter.prototype.debugAst = function (ast) { return debugOutputAstAsTypeScript(ast); };
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
    StatementInterpreter.prototype.visitReadVarExpr = function (ast, ctx) {
        var varName = ast.name;
        if (ast.builtin != null) {
            switch (ast.builtin) {
                case o.BuiltinVar.Super:
                    return ctx.instance.__proto__;
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
    StatementInterpreter.prototype.visitCommentStmt = function (stmt, context) { return null; };
    StatementInterpreter.prototype.visitJSDocCommentStmt = function (stmt, context) { return null; };
    StatementInterpreter.prototype.visitInstantiateExpr = function (ast, ctx) {
        var args = this.visitAllExpressions(ast.args, ctx);
        var clazz = ast.classExpr.visitExpression(this, ctx);
        return new (clazz.bind.apply(clazz, tslib_1.__spread([void 0], args)))();
    };
    StatementInterpreter.prototype.visitLiteralExpr = function (ast, ctx) { return ast.value; };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2ludGVycHJldGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL291dHB1dC9vdXRwdXRfaW50ZXJwcmV0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQU1ILE9BQU8sS0FBSyxDQUFDLE1BQU0sY0FBYyxDQUFDO0FBQ2xDLE9BQU8sRUFBQywwQkFBMEIsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUV4RCxNQUFNLDhCQUNGLFVBQXlCLEVBQUUsU0FBMkI7SUFDeEQsSUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEdBQUcsRUFBZSxDQUFDLENBQUM7SUFDNUUsSUFBTSxPQUFPLEdBQUcsSUFBSSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNwRCxPQUFPLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzVDLElBQU0sTUFBTSxHQUF5QixFQUFFLENBQUM7SUFDeEMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxVQUFVLElBQU8sTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEYsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUVELG9DQUNJLFFBQWtCLEVBQUUsU0FBZ0IsRUFBRSxVQUF5QixFQUFFLEdBQXNCLEVBQ3ZGLE9BQTZCO0lBQy9CLElBQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO0lBQ2hELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFF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Q0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDMUMsSUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNCLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzNDLElBQUksR0FBRyxZQUFZLFdBQVcsRUFBRTtnQkFDOUIsT0FBTyxHQUFHLENBQUM7YUFDWjtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0gsMkJBQUM7QUFBRCxDQUFDLEFBOVBELElBOFBDO0FBRUQsb0JBQ0ksUUFBa0IsRUFBRSxVQUF5QixFQUFFLEdBQXNCLEVBQ3JFLE9BQTZCO0lBQy9CLE9BQU87UUFBQyxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUFLLE9BQUEsMEJBQTBCLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQztJQUFwRSxDQUFvRSxDQUFDO0FBQ2xHLENBQUM7QUFFRCxJQUFNLGVBQWUsR0FBRyxPQUFPLENBQUM7QUFDaEMsSUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cblxuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXRfYXN0JztcbmltcG9ydCB7ZGVidWdPdXRwdXRBc3RBc1R5cGVTY3JpcHR9IGZyb20gJy4vdHNfZW1pdHRlcic7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnByZXRTdGF0ZW1lbnRzKFxuICAgIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcik6IHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgY29uc3QgY3R4ID0gbmV3IF9FeGVjdXRpb25Db250ZXh0KG51bGwsIG51bGwsIG51bGwsIG5ldyBNYXA8c3RyaW5nLCBhbnk+KCkpO1xuICBjb25zdCB2aXNpdG9yID0gbmV3IFN0YXRlbWVudEludGVycHJldGVyKHJlZmxlY3Rvcik7XG4gIHZpc2l0b3IudmlzaXRBbGxTdGF0ZW1lbnRzKHN0YXRlbWVudHMsIGN0eCk7XG4gIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgY3R4LmV4cG9ydHMuZm9yRWFjaCgoZXhwb3J0TmFtZSkgPT4geyByZXN1bHRbZXhwb3J0TmFtZV0gPSBjdHgudmFycy5nZXQoZXhwb3J0TmFtZSk7IH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBfZXhlY3V0ZUZ1bmN0aW9uU3RhdGVtZW50cyhcbiAgICB2YXJOYW1lczogc3RyaW5nW10sIHZhclZhbHVlczogYW55W10sIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQsXG4gICAgdmlzaXRvcjogU3RhdGVtZW50SW50ZXJwcmV0ZXIpOiBhbnkge1xuICBjb25zdCBjaGlsZEN0eCA9IGN0eC5jcmVhdGVDaGlsZFdpaHRMb2NhbFZhcnMoKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YXJOYW1lcy5sZW5ndGg7IGkrKykge1xuICAgIGNoaWxkQ3R4LnZhcnMuc2V0KHZhck5hbWVzW2ldLCB2YXJWYWx1ZXNbaV0pO1xuICB9XG4gIGNvbnN0IHJlc3VsdCA9IHZpc2l0b3IudmlzaXRBbGxTdGF0ZW1lbnRzKHN0YXRlbWVudHMsIGNoaWxkQ3R4KTtcbiAgcmV0dXJuIHJlc3VsdCA/IHJlc3VsdC52YWx1ZSA6IG51bGw7XG59XG5cbmNsYXNzIF9FeGVjdXRpb25Db250ZXh0IHtcbiAgZXhwb3J0czogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBwYXJlbnQ6IF9FeGVjdXRpb25Db250ZXh0fG51bGwsIHB1YmxpYyBpbnN0YW5jZTogYW55LCBwdWJsaWMgY2xhc3NOYW1lOiBzdHJpbmd8bnVsbCxcbiAgICAgIHB1YmxpYyB2YXJzOiBNYXA8c3RyaW5nLCBhbnk+KSB7fVxuXG4gIGNyZWF0ZUNoaWxkV2lodExvY2FsVmFycygpOiBfRXhlY3V0aW9uQ29udGV4dCB7XG4gICAgcmV0dXJuIG5ldyBfRXhlY3V0aW9uQ29udGV4dCh0aGlzLCB0aGlzLmluc3RhbmNlLCB0aGlzLmNsYXNzTmFtZSwgbmV3IE1hcDxzdHJpbmcsIGFueT4oKSk7XG4gIH1cbn1cblxuY2xhc3MgUmV0dXJuVmFsdWUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IGFueSkge31cbn1cblxuZnVuY3Rpb24gY3JlYXRlRHluYW1pY0NsYXNzKFxuICAgIF9jbGFzc1N0bXQ6IG8uQ2xhc3NTdG10LCBfY3R4OiBfRXhlY3V0aW9uQ29udGV4dCwgX3Zpc2l0b3I6IFN0YXRlbWVudEludGVycHJldGVyKTogRnVuY3Rpb24ge1xuICBjb25zdCBwcm9wZXJ0eURlc2NyaXB0b3JzOiB7W2tleTogc3RyaW5nXTogYW55fSA9IHt9O1xuXG4gIF9jbGFzc1N0bXQuZ2V0dGVycy5mb3JFYWNoKChnZXR0ZXI6IG8uQ2xhc3NHZXR0ZXIpID0+IHtcbiAgICAvLyBOb3RlOiB1c2UgYGZ1bmN0aW9uYCBpbnN0ZWFkIG9mIGFycm93IGZ1bmN0aW9uIHRvIGNhcHR1cmUgYHRoaXNgXG4gICAgcHJvcGVydHlEZXNjcmlwdG9yc1tnZXR0ZXIubmFtZV0gPSB7XG4gICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VDdHggPSBuZXcgX0V4ZWN1dGlvbkNvbnRleHQoX2N0eCwgdGhpcywgX2NsYXNzU3RtdC5uYW1lLCBfY3R4LnZhcnMpO1xuICAgICAgICByZXR1cm4gX2V4ZWN1dGVGdW5jdGlvblN0YXRlbWVudHMoW10sIFtdLCBnZXR0ZXIuYm9keSwgaW5zdGFuY2VDdHgsIF92aXNpdG9yKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KTtcbiAgX2NsYXNzU3RtdC5tZXRob2RzLmZvckVhY2goZnVuY3Rpb24obWV0aG9kOiBvLkNsYXNzTWV0aG9kKSB7XG4gICAgY29uc3QgcGFyYW1OYW1lcyA9IG1ldGhvZC5wYXJhbXMubWFwKHBhcmFtID0+IHBhcmFtLm5hbWUpO1xuICAgIC8vIE5vdGU6IHVzZSBgZnVuY3Rpb25gIGluc3RlYWQgb2YgYXJyb3cgZnVuY3Rpb24gdG8gY2FwdHVyZSBgdGhpc2BcbiAgICBwcm9wZXJ0eURlc2NyaXB0b3JzW21ldGhvZC5uYW1lICFdID0ge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiBmdW5jdGlvbiguLi5hcmdzOiBhbnlbXSkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZUN0eCA9IG5ldyBfRXhlY3V0aW9uQ29udGV4dChfY3R4LCB0aGlzLCBfY2xhc3NTdG10Lm5hbWUsIF9jdHgudmFycyk7XG4gICAgICAgIHJldHVybiBfZXhlY3V0ZUZ1bmN0aW9uU3RhdGVtZW50cyhwYXJhbU5hbWVzLCBhcmdzLCBtZXRob2QuYm9keSwgaW5zdGFuY2VDdHgsIF92aXNpdG9yKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KTtcblxuICBjb25zdCBjdG9yUGFyYW1OYW1lcyA9IF9jbGFzc1N0bXQuY29uc3RydWN0b3JNZXRob2QucGFyYW1zLm1hcChwYXJhbSA9PiBwYXJhbS5uYW1lKTtcbiAgLy8gTm90ZTogdXNlIGBmdW5jdGlvbmAgaW5zdGVhZCBvZiBhcnJvdyBmdW5jdGlvbiB0byBjYXB0dXJlIGB0aGlzYFxuICBjb25zdCBjdG9yID0gZnVuY3Rpb24oLi4uYXJnczogYW55W10pIHtcbiAgICBjb25zdCBpbnN0YW5jZUN0eCA9IG5ldyBfRXhlY3V0aW9uQ29udGV4dChfY3R4LCB0aGlzLCBfY2xhc3NTdG10Lm5hbWUsIF9jdHgudmFycyk7XG4gICAgX2NsYXNzU3RtdC5maWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHsgdGhpc1tmaWVsZC5uYW1lXSA9IHVuZGVmaW5lZDsgfSk7XG4gICAgX2V4ZWN1dGVGdW5jdGlvblN0YXRlbWVudHMoXG4gICAgICAgIGN0b3JQYXJhbU5hbWVzLCBhcmdzLCBfY2xhc3NTdG10LmNvbnN0cnVjdG9yTWV0aG9kLmJvZHksIGluc3RhbmNlQ3R4LCBfdmlzaXRvcik7XG4gIH07XG4gIGNvbnN0IHN1cGVyQ2xhc3MgPSBfY2xhc3NTdG10LnBhcmVudCA/IF9jbGFzc1N0bXQucGFyZW50LnZpc2l0RXhwcmVzc2lvbihfdmlzaXRvciwgX2N0eCkgOiBPYmplY3Q7XG4gIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzLnByb3RvdHlwZSwgcHJvcGVydHlEZXNjcmlwdG9ycyk7XG4gIHJldHVybiBjdG9yO1xufVxuXG5jbGFzcyBTdGF0ZW1lbnRJbnRlcnByZXRlciBpbXBsZW1lbnRzIG8uU3RhdGVtZW50VmlzaXRvciwgby5FeHByZXNzaW9uVmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKSB7fVxuICBkZWJ1Z0FzdChhc3Q6IG8uRXhwcmVzc2lvbnxvLlN0YXRlbWVudHxvLlR5cGUpOiBzdHJpbmcgeyByZXR1cm4gZGVidWdPdXRwdXRBc3RBc1R5cGVTY3JpcHQoYXN0KTsgfVxuXG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogby5EZWNsYXJlVmFyU3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgaW5pdGlhbFZhbHVlID0gc3RtdC52YWx1ZSA/IHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCkgOiB1bmRlZmluZWQ7XG4gICAgY3R4LnZhcnMuc2V0KHN0bXQubmFtZSwgaW5pdGlhbFZhbHVlKTtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIGN0eC5leHBvcnRzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRXcml0ZVZhckV4cHIoZXhwcjogby5Xcml0ZVZhckV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHZhbHVlID0gZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBsZXQgY3VyckN0eCA9IGN0eDtcbiAgICB3aGlsZSAoY3VyckN0eCAhPSBudWxsKSB7XG4gICAgICBpZiAoY3VyckN0eC52YXJzLmhhcyhleHByLm5hbWUpKSB7XG4gICAgICAgIGN1cnJDdHgudmFycy5zZXQoZXhwci5uYW1lLCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGN1cnJDdHggPSBjdXJyQ3R4LnBhcmVudCAhO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYE5vdCBkZWNsYXJlZCB2YXJpYWJsZSAke2V4cHIubmFtZX1gKTtcbiAgfVxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IG8uV3JhcHBlZE5vZGVFeHByPGFueT4sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgaW50ZXJwcmV0IGEgV3JhcHBlZE5vZGVFeHByLicpO1xuICB9XG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBvLlJlYWRWYXJFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBsZXQgdmFyTmFtZSA9IGFzdC5uYW1lICE7XG4gICAgaWYgKGFzdC5idWlsdGluICE9IG51bGwpIHtcbiAgICAgIHN3aXRjaCAoYXN0LmJ1aWx0aW4pIHtcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuU3VwZXI6XG4gICAgICAgICAgcmV0dXJuIGN0eC5pbnN0YW5jZS5fX3Byb3RvX187XG4gICAgICAgIGNhc2Ugby5CdWlsdGluVmFyLlRoaXM6XG4gICAgICAgICAgcmV0dXJuIGN0eC5pbnN0YW5jZTtcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuQ2F0Y2hFcnJvcjpcbiAgICAgICAgICB2YXJOYW1lID0gQ0FUQ0hfRVJST1JfVkFSO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaFN0YWNrOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9TVEFDS19WQVI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGJ1aWx0aW4gdmFyaWFibGUgJHthc3QuYnVpbHRpbn1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IGN1cnJDdHggPSBjdHg7XG4gICAgd2hpbGUgKGN1cnJDdHggIT0gbnVsbCkge1xuICAgICAgaWYgKGN1cnJDdHgudmFycy5oYXModmFyTmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJDdHgudmFycy5nZXQodmFyTmFtZSk7XG4gICAgICB9XG4gICAgICBjdXJyQ3R4ID0gY3VyckN0eC5wYXJlbnQgITtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBOb3QgZGVjbGFyZWQgdmFyaWFibGUgJHt2YXJOYW1lfWApO1xuICB9XG4gIHZpc2l0V3JpdGVLZXlFeHByKGV4cHI6IG8uV3JpdGVLZXlFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCByZWNlaXZlciA9IGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY29uc3QgaW5kZXggPSBleHByLmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IHZhbHVlID0gZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZWNlaXZlcltpbmRleF0gPSB2YWx1ZTtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgdmlzaXRXcml0ZVByb3BFeHByKGV4cHI6IG8uV3JpdGVQcm9wRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IHZhbHVlID0gZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZWNlaXZlcltleHByLm5hbWVdID0gdmFsdWU7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgdmlzaXRJbnZva2VNZXRob2RFeHByKGV4cHI6IG8uSW52b2tlTWV0aG9kRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwci5hcmdzLCBjdHgpO1xuICAgIGxldCByZXN1bHQ6IGFueTtcbiAgICBpZiAoZXhwci5idWlsdGluICE9IG51bGwpIHtcbiAgICAgIHN3aXRjaCAoZXhwci5idWlsdGluKSB7XG4gICAgICAgIGNhc2Ugby5CdWlsdGluTWV0aG9kLkNvbmNhdEFycmF5OlxuICAgICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLmNvbmNhdCguLi5hcmdzKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5NZXRob2QuU3Vic2NyaWJlT2JzZXJ2YWJsZTpcbiAgICAgICAgICByZXN1bHQgPSByZWNlaXZlci5zdWJzY3JpYmUoe25leHQ6IGFyZ3NbMF19KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5NZXRob2QuQmluZDpcbiAgICAgICAgICByZXN1bHQgPSByZWNlaXZlci5iaW5kKC4uLmFyZ3MpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsdGluIG1ldGhvZCAke2V4cHIuYnVpbHRpbn1gKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gcmVjZWl2ZXJbZXhwci5uYW1lICFdLmFwcGx5KHJlY2VpdmVyLCBhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihzdG10OiBvLkludm9rZUZ1bmN0aW9uRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhzdG10LmFyZ3MsIGN0eCk7XG4gICAgY29uc3QgZm5FeHByID0gc3RtdC5mbjtcbiAgICBpZiAoZm5FeHByIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwciAmJiBmbkV4cHIuYnVpbHRpbiA9PT0gby5CdWlsdGluVmFyLlN1cGVyKSB7XG4gICAgICBjdHguaW5zdGFuY2UuY29uc3RydWN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yLmFwcGx5KGN0eC5pbnN0YW5jZSwgYXJncyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZm4gPSBzdG10LmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH1cbiAgfVxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogby5SZXR1cm5TdGF0ZW1lbnQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBuZXcgUmV0dXJuVmFsdWUoc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KSk7XG4gIH1cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCBjbGF6eiA9IGNyZWF0ZUR5bmFtaWNDbGFzcyhzdG10LCBjdHgsIHRoaXMpO1xuICAgIGN0eC52YXJzLnNldChzdG10Lm5hbWUsIGNsYXp6KTtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIGN0eC5leHBvcnRzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBzdG10LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRJZlN0bXQoc3RtdDogby5JZlN0bXQsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGNvbmRpdGlvbiA9IHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGlmIChjb25kaXRpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjdHgpO1xuICAgIH0gZWxzZSBpZiAoc3RtdC5mYWxzZUNhc2UgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjdHgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBvLlRyeUNhdGNoU3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmJvZHlTdG10cywgY3R4KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zdCBjaGlsZEN0eCA9IGN0eC5jcmVhdGVDaGlsZFdpaHRMb2NhbFZhcnMoKTtcbiAgICAgIGNoaWxkQ3R4LnZhcnMuc2V0KENBVENIX0VSUk9SX1ZBUiwgZSk7XG4gICAgICBjaGlsZEN0eC52YXJzLnNldChDQVRDSF9TVEFDS19WQVIsIGUuc3RhY2spO1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuY2F0Y2hTdG10cywgY2hpbGRDdHgpO1xuICAgIH1cbiAgfVxuICB2aXNpdFRocm93U3RtdChzdG10OiBvLlRocm93U3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgdGhyb3cgc3RtdC5lcnJvci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdENvbW1lbnRTdG10KHN0bXQ6IG8uQ29tbWVudFN0bXQsIGNvbnRleHQ/OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuICB2aXNpdEpTRG9jQ29tbWVudFN0bXQoc3RtdDogby5KU0RvY0NvbW1lbnRTdG10LCBjb250ZXh0PzogYW55KTogYW55IHsgcmV0dXJuIG51bGw7IH1cbiAgdmlzaXRJbnN0YW50aWF0ZUV4cHIoYXN0OiBvLkluc3RhbnRpYXRlRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuYXJncywgY3R4KTtcbiAgICBjb25zdCBjbGF6eiA9IGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmV0dXJuIG5ldyBjbGF6eiguLi5hcmdzKTtcbiAgfVxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogby5MaXRlcmFsRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7IHJldHVybiBhc3QudmFsdWU7IH1cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBvLkV4dGVybmFsRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShhc3QudmFsdWUpO1xuICB9XG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByKGFzdDogby5Db25kaXRpb25hbEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGlmIChhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpKSB7XG4gICAgICByZXR1cm4gYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH0gZWxzZSBpZiAoYXN0LmZhbHNlQ2FzZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gYXN0LmZhbHNlQ2FzZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXROb3RFeHByKGFzdDogby5Ob3RFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICByZXR1cm4gIWFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRBc3NlcnROb3ROdWxsRXhwcihhc3Q6IG8uQXNzZXJ0Tm90TnVsbCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRDYXN0RXhwcihhc3Q6IG8uQ2FzdEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBhc3QudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRGdW5jdGlvbkV4cHIoYXN0OiBvLkZ1bmN0aW9uRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcGFyYW1OYW1lcyA9IGFzdC5wYXJhbXMubWFwKChwYXJhbSkgPT4gcGFyYW0ubmFtZSk7XG4gICAgcmV0dXJuIF9kZWNsYXJlRm4ocGFyYW1OYW1lcywgYXN0LnN0YXRlbWVudHMsIGN0eCwgdGhpcyk7XG4gIH1cbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IG8uRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcGFyYW1OYW1lcyA9IHN0bXQucGFyYW1zLm1hcCgocGFyYW0pID0+IHBhcmFtLm5hbWUpO1xuICAgIGN0eC52YXJzLnNldChzdG10Lm5hbWUsIF9kZWNsYXJlRm4ocGFyYW1OYW1lcywgc3RtdC5zdGF0ZW1lbnRzLCBjdHgsIHRoaXMpKTtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIGN0eC5leHBvcnRzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBvLkJpbmFyeU9wZXJhdG9yRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbGhzID0gKCkgPT4gYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjb25zdCByaHMgPSAoKSA9PiBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuXG4gICAgc3dpdGNoIChhc3Qub3BlcmF0b3IpIHtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5FcXVhbHM6XG4gICAgICAgIHJldHVybiBsaHMoKSA9PSByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5JZGVudGljYWw6XG4gICAgICAgIHJldHVybiBsaHMoKSA9PT0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzOlxuICAgICAgICByZXR1cm4gbGhzKCkgIT0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsOlxuICAgICAgICByZXR1cm4gbGhzKCkgIT09IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkFuZDpcbiAgICAgICAgcmV0dXJuIGxocygpICYmIHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk9yOlxuICAgICAgICByZXR1cm4gbGhzKCkgfHwgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuUGx1czpcbiAgICAgICAgcmV0dXJuIGxocygpICsgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTWludXM6XG4gICAgICAgIHJldHVybiBsaHMoKSAtIHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkRpdmlkZTpcbiAgICAgICAgcmV0dXJuIGxocygpIC8gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHk6XG4gICAgICAgIHJldHVybiBsaHMoKSAqIHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk1vZHVsbzpcbiAgICAgICAgcmV0dXJuIGxocygpICUgcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTG93ZXI6XG4gICAgICAgIHJldHVybiBsaHMoKSA8IHJocygpO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzOlxuICAgICAgICByZXR1cm4gbGhzKCkgPD0gcmhzKCk7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyOlxuICAgICAgICByZXR1cm4gbGhzKCkgPiByaHMoKTtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHM6XG4gICAgICAgIHJldHVybiBsaHMoKSA+PSByaHMoKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBvcGVyYXRvciAke2FzdC5vcGVyYXRvcn1gKTtcbiAgICB9XG4gIH1cbiAgdmlzaXRSZWFkUHJvcEV4cHIoYXN0OiBvLlJlYWRQcm9wRXhwciwgY3R4OiBfRXhlY3V0aW9uQ29udGV4dCk6IGFueSB7XG4gICAgbGV0IHJlc3VsdDogYW55O1xuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJlc3VsdCA9IHJlY2VpdmVyW2FzdC5uYW1lXTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBvLlJlYWRLZXlFeHByLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0KTogYW55IHtcbiAgICBjb25zdCByZWNlaXZlciA9IGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjb25zdCBwcm9wID0gYXN0LmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJldHVybiByZWNlaXZlcltwcm9wXTtcbiAgfVxuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBvLkxpdGVyYWxBcnJheUV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGN0eCk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsTWFwRXhwcihhc3Q6IG8uTGl0ZXJhbE1hcEV4cHIsIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHJlc3VsdDoge1trOiBzdHJpbmddOiBhbnl9ID0ge307XG4gICAgYXN0LmVudHJpZXMuZm9yRWFjaChlbnRyeSA9PiByZXN1bHRbZW50cnkua2V5XSA9IGVudHJ5LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHZpc2l0Q29tbWFFeHByKGFzdDogby5Db21tYUV4cHIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgdmFsdWVzID0gdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5wYXJ0cywgY29udGV4dCk7XG4gICAgcmV0dXJuIHZhbHVlc1t2YWx1ZXMubGVuZ3RoIC0gMV07XG4gIH1cbiAgdmlzaXRBbGxFeHByZXNzaW9ucyhleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBhbnkge1xuICAgIHJldHVybiBleHByZXNzaW9ucy5tYXAoKGV4cHIpID0+IGV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCkpO1xuICB9XG5cbiAgdmlzaXRBbGxTdGF0ZW1lbnRzKHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIGN0eDogX0V4ZWN1dGlvbkNvbnRleHQpOiBSZXR1cm5WYWx1ZXxudWxsIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHN0bXQgPSBzdGF0ZW1lbnRzW2ldO1xuICAgICAgY29uc3QgdmFsID0gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjdHgpO1xuICAgICAgaWYgKHZhbCBpbnN0YW5jZW9mIFJldHVyblZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9kZWNsYXJlRm4oXG4gICAgdmFyTmFtZXM6IHN0cmluZ1tdLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBjdHg6IF9FeGVjdXRpb25Db250ZXh0LFxuICAgIHZpc2l0b3I6IFN0YXRlbWVudEludGVycHJldGVyKTogRnVuY3Rpb24ge1xuICByZXR1cm4gKC4uLmFyZ3M6IGFueVtdKSA9PiBfZXhlY3V0ZUZ1bmN0aW9uU3RhdGVtZW50cyh2YXJOYW1lcywgYXJncywgc3RhdGVtZW50cywgY3R4LCB2aXNpdG9yKTtcbn1cblxuY29uc3QgQ0FUQ0hfRVJST1JfVkFSID0gJ2Vycm9yJztcbmNvbnN0IENBVENIX1NUQUNLX1ZBUiA9ICdzdGFjayc7XG4iXX0=