/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from './output_ast';
import { debugOutputAstAsTypeScript } from './ts_emitter';
/**
 * @param {?} statements
 * @param {?} reflector
 * @return {?}
 */
export function interpretStatements(statements, reflector) {
    var /** @type {?} */ ctx = new _ExecutionContext(null, null, null, new Map());
    var /** @type {?} */ visitor = new StatementInterpreter(reflector);
    visitor.visitAllStatements(statements, ctx);
    var /** @type {?} */ result = {};
    ctx.exports.forEach(function (exportName) { result[exportName] = ctx.vars.get(exportName); });
    return result;
}
/**
 * @param {?} varNames
 * @param {?} varValues
 * @param {?} statements
 * @param {?} ctx
 * @param {?} visitor
 * @return {?}
 */
function _executeFunctionStatements(varNames, varValues, statements, ctx, visitor) {
    var /** @type {?} */ childCtx = ctx.createChildWihtLocalVars();
    for (var /** @type {?} */ i = 0; i < varNames.length; i++) {
        childCtx.vars.set(varNames[i], varValues[i]);
    }
    var /** @type {?} */ result = visitor.visitAllStatements(statements, childCtx);
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
    /**
     * @return {?}
     */
    _ExecutionContext.prototype.createChildWihtLocalVars = /**
     * @return {?}
     */
    function () {
        return new _ExecutionContext(this, this.instance, this.className, new Map());
    };
    return _ExecutionContext;
}());
function _ExecutionContext_tsickle_Closure_declarations() {
    /** @type {?} */
    _ExecutionContext.prototype.exports;
    /** @type {?} */
    _ExecutionContext.prototype.parent;
    /** @type {?} */
    _ExecutionContext.prototype.instance;
    /** @type {?} */
    _ExecutionContext.prototype.className;
    /** @type {?} */
    _ExecutionContext.prototype.vars;
}
var ReturnValue = /** @class */ (function () {
    function ReturnValue(value) {
        this.value = value;
    }
    return ReturnValue;
}());
function ReturnValue_tsickle_Closure_declarations() {
    /** @type {?} */
    ReturnValue.prototype.value;
}
/**
 * @param {?} _classStmt
 * @param {?} _ctx
 * @param {?} _visitor
 * @return {?}
 */
function createDynamicClass(_classStmt, _ctx, _visitor) {
    var /** @type {?} */ propertyDescriptors = {};
    _classStmt.getters.forEach(function (getter) {
        // Note: use `function` instead of arrow function to capture `this`
        propertyDescriptors[getter.name] = {
            configurable: false,
            get: function () {
                var /** @type {?} */ instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
                return _executeFunctionStatements([], [], getter.body, instanceCtx, _visitor);
            }
        };
    });
    _classStmt.methods.forEach(function (method) {
        var /** @type {?} */ paramNames = method.params.map(function (param) { return param.name; });
        // Note: use `function` instead of arrow function to capture `this`
        propertyDescriptors[/** @type {?} */ ((method.name))] = {
            writable: false,
            configurable: false,
            value: function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var /** @type {?} */ instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
                return _executeFunctionStatements(paramNames, args, method.body, instanceCtx, _visitor);
            }
        };
    });
    var /** @type {?} */ ctorParamNames = _classStmt.constructorMethod.params.map(function (param) { return param.name; });
    // Note: use `function` instead of arrow function to capture `this`
    var /** @type {?} */ ctor = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var /** @type {?} */ instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
        _classStmt.fields.forEach(function (field) { _this[field.name] = undefined; });
        _executeFunctionStatements(ctorParamNames, args, _classStmt.constructorMethod.body, instanceCtx, _visitor);
    };
    var /** @type {?} */ superClass = _classStmt.parent ? _classStmt.parent.visitExpression(_visitor, _ctx) : Object;
    ctor.prototype = Object.create(superClass.prototype, propertyDescriptors);
    return ctor;
}
var StatementInterpreter = /** @class */ (function () {
    function StatementInterpreter(reflector) {
        this.reflector = reflector;
    }
    /**
     * @param {?} ast
     * @return {?}
     */
    StatementInterpreter.prototype.debugAst = /**
     * @param {?} ast
     * @return {?}
     */
    function (ast) { return debugOutputAstAsTypeScript(ast); };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitDeclareVarStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        var /** @type {?} */ initialValue = stmt.value ? stmt.value.visitExpression(this, ctx) : undefined;
        ctx.vars.set(stmt.name, initialValue);
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            ctx.exports.push(stmt.name);
        }
        return null;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitWriteVarExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        var /** @type {?} */ value = expr.value.visitExpression(this, ctx);
        var /** @type {?} */ currCtx = ctx;
        while (currCtx != null) {
            if (currCtx.vars.has(expr.name)) {
                currCtx.vars.set(expr.name, value);
                return value;
            }
            currCtx = /** @type {?} */ ((currCtx.parent));
        }
        throw new Error("Not declared variable " + expr.name);
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitReadVarExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var /** @type {?} */ varName = /** @type {?} */ ((ast.name));
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
        var /** @type {?} */ currCtx = ctx;
        while (currCtx != null) {
            if (currCtx.vars.has(varName)) {
                return currCtx.vars.get(varName);
            }
            currCtx = /** @type {?} */ ((currCtx.parent));
        }
        throw new Error("Not declared variable " + varName);
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitWriteKeyExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        var /** @type {?} */ receiver = expr.receiver.visitExpression(this, ctx);
        var /** @type {?} */ index = expr.index.visitExpression(this, ctx);
        var /** @type {?} */ value = expr.value.visitExpression(this, ctx);
        receiver[index] = value;
        return value;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitWritePropExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        var /** @type {?} */ receiver = expr.receiver.visitExpression(this, ctx);
        var /** @type {?} */ value = expr.value.visitExpression(this, ctx);
        receiver[expr.name] = value;
        return value;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitInvokeMethodExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        var /** @type {?} */ receiver = expr.receiver.visitExpression(this, ctx);
        var /** @type {?} */ args = this.visitAllExpressions(expr.args, ctx);
        var /** @type {?} */ result;
        if (expr.builtin != null) {
            switch (expr.builtin) {
                case o.BuiltinMethod.ConcatArray:
                    result = receiver.concat.apply(receiver, args);
                    break;
                case o.BuiltinMethod.SubscribeObservable:
                    result = receiver.subscribe({ next: args[0] });
                    break;
                case o.BuiltinMethod.Bind:
                    result = receiver.bind.apply(receiver, args);
                    break;
                default:
                    throw new Error("Unknown builtin method " + expr.builtin);
            }
        }
        else {
            result = receiver[/** @type {?} */ ((expr.name))].apply(receiver, args);
        }
        return result;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitInvokeFunctionExpr = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        var /** @type {?} */ args = this.visitAllExpressions(stmt.args, ctx);
        var /** @type {?} */ fnExpr = stmt.fn;
        if (fnExpr instanceof o.ReadVarExpr && fnExpr.builtin === o.BuiltinVar.Super) {
            ctx.instance.constructor.prototype.constructor.apply(ctx.instance, args);
            return null;
        }
        else {
            var /** @type {?} */ fn = stmt.fn.visitExpression(this, ctx);
            return fn.apply(null, args);
        }
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitReturnStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        return new ReturnValue(stmt.value.visitExpression(this, ctx));
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitDeclareClassStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        var /** @type {?} */ clazz = createDynamicClass(stmt, ctx, this);
        ctx.vars.set(stmt.name, clazz);
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            ctx.exports.push(stmt.name);
        }
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitExpressionStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        return stmt.expr.visitExpression(this, ctx);
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitIfStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        var /** @type {?} */ condition = stmt.condition.visitExpression(this, ctx);
        if (condition) {
            return this.visitAllStatements(stmt.trueCase, ctx);
        }
        else if (stmt.falseCase != null) {
            return this.visitAllStatements(stmt.falseCase, ctx);
        }
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitTryCatchStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        try {
            return this.visitAllStatements(stmt.bodyStmts, ctx);
        }
        catch (/** @type {?} */ e) {
            var /** @type {?} */ childCtx = ctx.createChildWihtLocalVars();
            childCtx.vars.set(CATCH_ERROR_VAR, e);
            childCtx.vars.set(CATCH_STACK_VAR, e.stack);
            return this.visitAllStatements(stmt.catchStmts, childCtx);
        }
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitThrowStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        throw stmt.error.visitExpression(this, ctx);
    };
    /**
     * @param {?} stmt
     * @param {?=} context
     * @return {?}
     */
    StatementInterpreter.prototype.visitCommentStmt = /**
     * @param {?} stmt
     * @param {?=} context
     * @return {?}
     */
    function (stmt, context) { return null; };
    /**
     * @param {?} stmt
     * @param {?=} context
     * @return {?}
     */
    StatementInterpreter.prototype.visitJSDocCommentStmt = /**
     * @param {?} stmt
     * @param {?=} context
     * @return {?}
     */
    function (stmt, context) { return null; };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitInstantiateExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var /** @type {?} */ args = this.visitAllExpressions(ast.args, ctx);
        var /** @type {?} */ clazz = ast.classExpr.visitExpression(this, ctx);
        return new (clazz.bind.apply(clazz, [void 0].concat(args)))();
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitLiteralExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) { return ast.value; };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitExternalExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        return this.reflector.resolveExternalReference(ast.value);
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitConditionalExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        if (ast.condition.visitExpression(this, ctx)) {
            return ast.trueCase.visitExpression(this, ctx);
        }
        else if (ast.falseCase != null) {
            return ast.falseCase.visitExpression(this, ctx);
        }
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitNotExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        return !ast.condition.visitExpression(this, ctx);
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitAssertNotNullExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        return ast.condition.visitExpression(this, ctx);
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitCastExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        return ast.value.visitExpression(this, ctx);
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitFunctionExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var /** @type {?} */ paramNames = ast.params.map(function (param) { return param.name; });
        return _declareFn(paramNames, ast.statements, ctx, this);
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitDeclareFunctionStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        var /** @type {?} */ paramNames = stmt.params.map(function (param) { return param.name; });
        ctx.vars.set(stmt.name, _declareFn(paramNames, stmt.statements, ctx, this));
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            ctx.exports.push(stmt.name);
        }
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitBinaryOperatorExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var _this = this;
        var /** @type {?} */ lhs = function () { return ast.lhs.visitExpression(_this, ctx); };
        var /** @type {?} */ rhs = function () { return ast.rhs.visitExpression(_this, ctx); };
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
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitReadPropExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var /** @type {?} */ result;
        var /** @type {?} */ receiver = ast.receiver.visitExpression(this, ctx);
        result = receiver[ast.name];
        return result;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitReadKeyExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var /** @type {?} */ receiver = ast.receiver.visitExpression(this, ctx);
        var /** @type {?} */ prop = ast.index.visitExpression(this, ctx);
        return receiver[prop];
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitLiteralArrayExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        return this.visitAllExpressions(ast.entries, ctx);
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitLiteralMapExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var _this = this;
        var /** @type {?} */ result = {};
        ast.entries.forEach(function (entry) { return result[entry.key] = entry.value.visitExpression(_this, ctx); });
        return result;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    StatementInterpreter.prototype.visitCommaExpr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var /** @type {?} */ values = this.visitAllExpressions(ast.parts, context);
        return values[values.length - 1];
    };
    /**
     * @param {?} expressions
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitAllExpressions = /**
     * @param {?} expressions
     * @param {?} ctx
     * @return {?}
     */
    function (expressions, ctx) {
        var _this = this;
        return expressions.map(function (expr) { return expr.visitExpression(_this, ctx); });
    };
    /**
     * @param {?} statements
     * @param {?} ctx
     * @return {?}
     */
    StatementInterpreter.prototype.visitAllStatements = /**
     * @param {?} statements
     * @param {?} ctx
     * @return {?}
     */
    function (statements, ctx) {
        for (var /** @type {?} */ i = 0; i < statements.length; i++) {
            var /** @type {?} */ stmt = statements[i];
            var /** @type {?} */ val = stmt.visitStatement(this, ctx);
            if (val instanceof ReturnValue) {
                return val;
            }
        }
        return null;
    };
    return StatementInterpreter;
}());
function StatementInterpreter_tsickle_Closure_declarations() {
    /** @type {?} */
    StatementInterpreter.prototype.reflector;
}
/**
 * @param {?} varNames
 * @param {?} statements
 * @param {?} ctx
 * @param {?} visitor
 * @return {?}
 */
function _declareFn(varNames, statements, ctx, visitor) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return _executeFunctionStatements(varNames, args, statements, ctx, visitor);
    };
}
var /** @type {?} */ CATCH_ERROR_VAR = 'error';
var /** @type {?} */ CATCH_STACK_VAR = 'stack';
//# sourceMappingURL=output_interpreter.js.map