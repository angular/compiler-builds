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
import * as tslib_1 from "tslib";
import { AbstractEmitterVisitor, CATCH_ERROR_VAR, CATCH_STACK_VAR } from './abstract_emitter';
import * as o from './output_ast';
/**
 * @abstract
 */
var /**
 * @abstract
 */
AbstractJsEmitterVisitor = /** @class */ (function (_super) {
    tslib_1.__extends(AbstractJsEmitterVisitor, _super);
    function AbstractJsEmitterVisitor() {
        return _super.call(this, false) || this;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.visitDeclareClassStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        var _this = this;
        ctx.pushClass(stmt);
        this._visitClassConstructor(stmt, ctx);
        if (stmt.parent != null) {
            ctx.print(stmt, stmt.name + ".prototype = Object.create(");
            stmt.parent.visitExpression(this, ctx);
            ctx.println(stmt, ".prototype);");
        }
        stmt.getters.forEach(function (getter) { return _this._visitClassGetter(stmt, getter, ctx); });
        stmt.methods.forEach(function (method) { return _this._visitClassMethod(stmt, method, ctx); });
        ctx.popClass();
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype._visitClassConstructor = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        ctx.print(stmt, "function " + stmt.name + "(");
        if (stmt.constructorMethod != null) {
            this._visitParams(stmt.constructorMethod.params, ctx);
        }
        ctx.println(stmt, ") {");
        ctx.incIndent();
        if (stmt.constructorMethod != null) {
            if (stmt.constructorMethod.body.length > 0) {
                ctx.println(stmt, "var self = this;");
                this.visitAllStatements(stmt.constructorMethod.body, ctx);
            }
        }
        ctx.decIndent();
        ctx.println(stmt, "}");
    };
    /**
     * @param {?} stmt
     * @param {?} getter
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype._visitClassGetter = /**
     * @param {?} stmt
     * @param {?} getter
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, getter, ctx) {
        ctx.println(stmt, "Object.defineProperty(" + stmt.name + ".prototype, '" + getter.name + "', { get: function() {");
        ctx.incIndent();
        if (getter.body.length > 0) {
            ctx.println(stmt, "var self = this;");
            this.visitAllStatements(getter.body, ctx);
        }
        ctx.decIndent();
        ctx.println(stmt, "}});");
    };
    /**
     * @param {?} stmt
     * @param {?} method
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype._visitClassMethod = /**
     * @param {?} stmt
     * @param {?} method
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, method, ctx) {
        ctx.print(stmt, stmt.name + ".prototype." + method.name + " = function(");
        this._visitParams(method.params, ctx);
        ctx.println(stmt, ") {");
        ctx.incIndent();
        if (method.body.length > 0) {
            ctx.println(stmt, "var self = this;");
            this.visitAllStatements(method.body, ctx);
        }
        ctx.decIndent();
        ctx.println(stmt, "};");
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.visitReadVarExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        if (ast.builtin === o.BuiltinVar.This) {
            ctx.print(ast, 'self');
        }
        else if (ast.builtin === o.BuiltinVar.Super) {
            throw new Error("'super' needs to be handled at a parent ast node, not at the variable level!");
        }
        else {
            _super.prototype.visitReadVarExpr.call(this, ast, ctx);
        }
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.visitDeclareVarStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        ctx.print(stmt, "var " + stmt.name);
        if (stmt.value) {
            ctx.print(stmt, ' = ');
            stmt.value.visitExpression(this, ctx);
        }
        ctx.println(stmt, ";");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.visitCastExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ast.value.visitExpression(this, ctx);
        return null;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.visitInvokeFunctionExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        var /** @type {?} */ fnExpr = expr.fn;
        if (fnExpr instanceof o.ReadVarExpr && fnExpr.builtin === o.BuiltinVar.Super) {
            /** @type {?} */ ((/** @type {?} */ ((ctx.currentClass)).parent)).visitExpression(this, ctx);
            ctx.print(expr, ".call(this");
            if (expr.args.length > 0) {
                ctx.print(expr, ", ");
                this.visitAllExpressions(expr.args, ctx, ',');
            }
            ctx.print(expr, ")");
        }
        else {
            _super.prototype.visitInvokeFunctionExpr.call(this, expr, ctx);
        }
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.visitFunctionExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ctx.print(ast, "function" + (ast.name ? ' ' + ast.name : '') + "(");
        this._visitParams(ast.params, ctx);
        ctx.println(ast, ") {");
        ctx.incIndent();
        this.visitAllStatements(ast.statements, ctx);
        ctx.decIndent();
        ctx.print(ast, "}");
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.visitDeclareFunctionStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        ctx.print(stmt, "function " + stmt.name + "(");
        this._visitParams(stmt.params, ctx);
        ctx.println(stmt, ") {");
        ctx.incIndent();
        this.visitAllStatements(stmt.statements, ctx);
        ctx.decIndent();
        ctx.println(stmt, "}");
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.visitTryCatchStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        ctx.println(stmt, "try {");
        ctx.incIndent();
        this.visitAllStatements(stmt.bodyStmts, ctx);
        ctx.decIndent();
        ctx.println(stmt, "} catch (" + CATCH_ERROR_VAR.name + ") {");
        ctx.incIndent();
        var /** @type {?} */ catchStmts = [/** @type {?} */ (CATCH_STACK_VAR.set(CATCH_ERROR_VAR.prop('stack')).toDeclStmt(null, [
                o.StmtModifier.Final
            ]))].concat(stmt.catchStmts);
        this.visitAllStatements(catchStmts, ctx);
        ctx.decIndent();
        ctx.println(stmt, "}");
        return null;
    };
    /**
     * @param {?} params
     * @param {?} ctx
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype._visitParams = /**
     * @param {?} params
     * @param {?} ctx
     * @return {?}
     */
    function (params, ctx) {
        this.visitAllObjects(function (param) { return ctx.print(null, param.name); }, params, ctx, ',');
    };
    /**
     * @param {?} method
     * @return {?}
     */
    AbstractJsEmitterVisitor.prototype.getBuiltinMethodName = /**
     * @param {?} method
     * @return {?}
     */
    function (method) {
        var /** @type {?} */ name;
        switch (method) {
            case o.BuiltinMethod.ConcatArray:
                name = 'concat';
                break;
            case o.BuiltinMethod.SubscribeObservable:
                name = 'subscribe';
                break;
            case o.BuiltinMethod.Bind:
                name = 'bind';
                break;
            default:
                throw new Error("Unknown builtin method: " + method);
        }
        return name;
    };
    return AbstractJsEmitterVisitor;
}(AbstractEmitterVisitor));
/**
 * @abstract
 */
export { AbstractJsEmitterVisitor };
//# sourceMappingURL=abstract_js_emitter.js.map