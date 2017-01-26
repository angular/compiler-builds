/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isPresent } from '../facade/lang';
import * as o from './output_ast';
import { debugOutputAstAsTypeScript } from './ts_emitter';
/**
 * @param {?} statements
 * @param {?} resultVar
 * @return {?}
 */
export function interpretStatements(statements, resultVar) {
    const /** @type {?} */ stmtsWithReturn = statements.concat([new o.ReturnStatement(o.variable(resultVar))]);
    const /** @type {?} */ ctx = new _ExecutionContext(null, null, null, new Map());
    const /** @type {?} */ visitor = new StatementInterpreter();
    const /** @type {?} */ result = visitor.visitAllStatements(stmtsWithReturn, ctx);
    return isPresent(result) ? result.value : null;
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
    const /** @type {?} */ childCtx = ctx.createChildWihtLocalVars();
    for (let /** @type {?} */ i = 0; i < varNames.length; i++) {
        childCtx.vars.set(varNames[i], varValues[i]);
    }
    const /** @type {?} */ result = visitor.visitAllStatements(statements, childCtx);
    return isPresent(result) ? result.value : null;
}
class _ExecutionContext {
    /**
     * @param {?} parent
     * @param {?} instance
     * @param {?} className
     * @param {?} vars
     */
    constructor(parent, instance, className, vars) {
        this.parent = parent;
        this.instance = instance;
        this.className = className;
        this.vars = vars;
    }
    /**
     * @return {?}
     */
    createChildWihtLocalVars() {
        return new _ExecutionContext(this, this.instance, this.className, new Map());
    }
}
function _ExecutionContext_tsickle_Closure_declarations() {
    /** @type {?} */
    _ExecutionContext.prototype.parent;
    /** @type {?} */
    _ExecutionContext.prototype.instance;
    /** @type {?} */
    _ExecutionContext.prototype.className;
    /** @type {?} */
    _ExecutionContext.prototype.vars;
}
class ReturnValue {
    /**
     * @param {?} value
     */
    constructor(value) {
        this.value = value;
    }
}
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
    const /** @type {?} */ propertyDescriptors = {};
    _classStmt.getters.forEach((getter) => {
        // Note: use `function` instead of arrow function to capture `this`
        propertyDescriptors[getter.name] = {
            configurable: false,
            get: function () {
                const /** @type {?} */ instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
                return _executeFunctionStatements([], [], getter.body, instanceCtx, _visitor);
            }
        };
    });
    _classStmt.methods.forEach(function (method) {
        const /** @type {?} */ paramNames = method.params.map(param => param.name);
        // Note: use `function` instead of arrow function to capture `this`
        propertyDescriptors[method.name] = {
            writable: false,
            configurable: false,
            value: function (...args) {
                const /** @type {?} */ instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
                return _executeFunctionStatements(paramNames, args, method.body, instanceCtx, _visitor);
            }
        };
    });
    const /** @type {?} */ ctorParamNames = _classStmt.constructorMethod.params.map(param => param.name);
    // Note: use `function` instead of arrow function to capture `this`
    const /** @type {?} */ ctor = function (...args) {
        const /** @type {?} */ instanceCtx = new _ExecutionContext(_ctx, this, _classStmt.name, _ctx.vars);
        _classStmt.fields.forEach((field) => { this[field.name] = undefined; });
        _executeFunctionStatements(ctorParamNames, args, _classStmt.constructorMethod.body, instanceCtx, _visitor);
    };
    const /** @type {?} */ superClass = _classStmt.parent ? _classStmt.parent.visitExpression(_visitor, _ctx) : Object;
    ctor.prototype = Object.create(superClass.prototype, propertyDescriptors);
    return ctor;
}
class StatementInterpreter {
    /**
     * @param {?} ast
     * @return {?}
     */
    debugAst(ast) { return debugOutputAstAsTypeScript(ast); }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitDeclareVarStmt(stmt, ctx) {
        ctx.vars.set(stmt.name, stmt.value.visitExpression(this, ctx));
        return null;
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitWriteVarExpr(expr, ctx) {
        const /** @type {?} */ value = expr.value.visitExpression(this, ctx);
        let /** @type {?} */ currCtx = ctx;
        while (currCtx != null) {
            if (currCtx.vars.has(expr.name)) {
                currCtx.vars.set(expr.name, value);
                return value;
            }
            currCtx = currCtx.parent;
        }
        throw new Error(`Not declared variable ${expr.name}`);
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReadVarExpr(ast, ctx) {
        let /** @type {?} */ varName = ast.name;
        if (isPresent(ast.builtin)) {
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
                    throw new Error(`Unknown builtin variable ${ast.builtin}`);
            }
        }
        let /** @type {?} */ currCtx = ctx;
        while (currCtx != null) {
            if (currCtx.vars.has(varName)) {
                return currCtx.vars.get(varName);
            }
            currCtx = currCtx.parent;
        }
        throw new Error(`Not declared variable ${varName}`);
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitWriteKeyExpr(expr, ctx) {
        const /** @type {?} */ receiver = expr.receiver.visitExpression(this, ctx);
        const /** @type {?} */ index = expr.index.visitExpression(this, ctx);
        const /** @type {?} */ value = expr.value.visitExpression(this, ctx);
        receiver[index] = value;
        return value;
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitWritePropExpr(expr, ctx) {
        const /** @type {?} */ receiver = expr.receiver.visitExpression(this, ctx);
        const /** @type {?} */ value = expr.value.visitExpression(this, ctx);
        receiver[expr.name] = value;
        return value;
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitInvokeMethodExpr(expr, ctx) {
        const /** @type {?} */ receiver = expr.receiver.visitExpression(this, ctx);
        const /** @type {?} */ args = this.visitAllExpressions(expr.args, ctx);
        let /** @type {?} */ result;
        if (isPresent(expr.builtin)) {
            switch (expr.builtin) {
                case o.BuiltinMethod.ConcatArray:
                    result = receiver.concat(...args);
                    break;
                case o.BuiltinMethod.SubscribeObservable:
                    result = receiver.subscribe({ next: args[0] });
                    break;
                case o.BuiltinMethod.Bind:
                    result = receiver.bind(...args);
                    break;
                default:
                    throw new Error(`Unknown builtin method ${expr.builtin}`);
            }
        }
        else {
            result = receiver[expr.name].apply(receiver, args);
        }
        return result;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitInvokeFunctionExpr(stmt, ctx) {
        const /** @type {?} */ args = this.visitAllExpressions(stmt.args, ctx);
        const /** @type {?} */ fnExpr = stmt.fn;
        if (fnExpr instanceof o.ReadVarExpr && fnExpr.builtin === o.BuiltinVar.Super) {
            ctx.instance.constructor.prototype.constructor.apply(ctx.instance, args);
            return null;
        }
        else {
            const /** @type {?} */ fn = stmt.fn.visitExpression(this, ctx);
            return fn.apply(null, args);
        }
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitReturnStmt(stmt, ctx) {
        return new ReturnValue(stmt.value.visitExpression(this, ctx));
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitDeclareClassStmt(stmt, ctx) {
        const /** @type {?} */ clazz = createDynamicClass(stmt, ctx, this);
        ctx.vars.set(stmt.name, clazz);
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitExpressionStmt(stmt, ctx) {
        return stmt.expr.visitExpression(this, ctx);
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitIfStmt(stmt, ctx) {
        const /** @type {?} */ condition = stmt.condition.visitExpression(this, ctx);
        if (condition) {
            return this.visitAllStatements(stmt.trueCase, ctx);
        }
        else if (isPresent(stmt.falseCase)) {
            return this.visitAllStatements(stmt.falseCase, ctx);
        }
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitTryCatchStmt(stmt, ctx) {
        try {
            return this.visitAllStatements(stmt.bodyStmts, ctx);
        }
        catch (e) {
            const /** @type {?} */ childCtx = ctx.createChildWihtLocalVars();
            childCtx.vars.set(CATCH_ERROR_VAR, e);
            childCtx.vars.set(CATCH_STACK_VAR, e.stack);
            return this.visitAllStatements(stmt.catchStmts, childCtx);
        }
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitThrowStmt(stmt, ctx) {
        throw stmt.error.visitExpression(this, ctx);
    }
    /**
     * @param {?} stmt
     * @param {?=} context
     * @return {?}
     */
    visitCommentStmt(stmt, context) { return null; }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitInstantiateExpr(ast, ctx) {
        const /** @type {?} */ args = this.visitAllExpressions(ast.args, ctx);
        const /** @type {?} */ clazz = ast.classExpr.visitExpression(this, ctx);
        return new clazz(...args);
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralExpr(ast, ctx) { return ast.value; }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitExternalExpr(ast, ctx) {
        return ast.value.reference;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitConditionalExpr(ast, ctx) {
        if (ast.condition.visitExpression(this, ctx)) {
            return ast.trueCase.visitExpression(this, ctx);
        }
        else if (isPresent(ast.falseCase)) {
            return ast.falseCase.visitExpression(this, ctx);
        }
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitNotExpr(ast, ctx) {
        return !ast.condition.visitExpression(this, ctx);
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitCastExpr(ast, ctx) {
        return ast.value.visitExpression(this, ctx);
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitFunctionExpr(ast, ctx) {
        const /** @type {?} */ paramNames = ast.params.map((param) => param.name);
        return _declareFn(paramNames, ast.statements, ctx, this);
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitDeclareFunctionStmt(stmt, ctx) {
        const /** @type {?} */ paramNames = stmt.params.map((param) => param.name);
        ctx.vars.set(stmt.name, _declareFn(paramNames, stmt.statements, ctx, this));
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitBinaryOperatorExpr(ast, ctx) {
        const /** @type {?} */ lhs = () => ast.lhs.visitExpression(this, ctx);
        const /** @type {?} */ rhs = () => ast.rhs.visitExpression(this, ctx);
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
                throw new Error(`Unknown operator ${ast.operator}`);
        }
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReadPropExpr(ast, ctx) {
        let /** @type {?} */ result;
        const /** @type {?} */ receiver = ast.receiver.visitExpression(this, ctx);
        result = receiver[ast.name];
        return result;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReadKeyExpr(ast, ctx) {
        const /** @type {?} */ receiver = ast.receiver.visitExpression(this, ctx);
        const /** @type {?} */ prop = ast.index.visitExpression(this, ctx);
        return receiver[prop];
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralArrayExpr(ast, ctx) {
        return this.visitAllExpressions(ast.entries, ctx);
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralMapExpr(ast, ctx) {
        const /** @type {?} */ result = {};
        ast.entries.forEach((entry) => ((result))[entry.key] = entry.value.visitExpression(this, ctx));
        return result;
    }
    /**
     * @param {?} expressions
     * @param {?} ctx
     * @return {?}
     */
    visitAllExpressions(expressions, ctx) {
        return expressions.map((expr) => expr.visitExpression(this, ctx));
    }
    /**
     * @param {?} statements
     * @param {?} ctx
     * @return {?}
     */
    visitAllStatements(statements, ctx) {
        for (let /** @type {?} */ i = 0; i < statements.length; i++) {
            const /** @type {?} */ stmt = statements[i];
            const /** @type {?} */ val = stmt.visitStatement(this, ctx);
            if (val instanceof ReturnValue) {
                return val;
            }
        }
        return null;
    }
}
/**
 * @param {?} varNames
 * @param {?} statements
 * @param {?} ctx
 * @param {?} visitor
 * @return {?}
 */
function _declareFn(varNames, statements, ctx, visitor) {
    return (...args) => _executeFunctionStatements(varNames, args, statements, ctx, visitor);
}
const /** @type {?} */ CATCH_ERROR_VAR = 'error';
const /** @type {?} */ CATCH_STACK_VAR = 'stack';
//# sourceMappingURL=output_interpreter.js.map