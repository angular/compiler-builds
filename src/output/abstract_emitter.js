/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isBlank, isPresent } from '../facade/lang';
import * as o from './output_ast';
const /** @type {?} */ _SINGLE_QUOTE_ESCAPE_STRING_RE = /'|\\|\n|\r|\$/g;
const /** @type {?} */ _LEGAL_IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i;
export const /** @type {?} */ CATCH_ERROR_VAR = o.variable('error');
export const /** @type {?} */ CATCH_STACK_VAR = o.variable('stack');
/**
 * @abstract
 */
export class OutputEmitter {
    /**
     * @abstract
     * @param {?} moduleUrl
     * @param {?} stmts
     * @param {?} exportedVars
     * @return {?}
     */
    emitStatements(moduleUrl, stmts, exportedVars) { }
}
class _EmittedLine {
    /**
     * @param {?} indent
     */
    constructor(indent) {
        this.indent = indent;
        this.parts = [];
    }
}
function _EmittedLine_tsickle_Closure_declarations() {
    /** @type {?} */
    _EmittedLine.prototype.parts;
    /** @type {?} */
    _EmittedLine.prototype.indent;
}
export class EmitterVisitorContext {
    /**
     * @param {?} _exportedVars
     * @param {?} _indent
     */
    constructor(_exportedVars, _indent) {
        this._exportedVars = _exportedVars;
        this._indent = _indent;
        this._classes = [];
        this._lines = [new _EmittedLine(_indent)];
    }
    /**
     * @param {?} exportedVars
     * @return {?}
     */
    static createRoot(exportedVars) {
        return new EmitterVisitorContext(exportedVars, 0);
    }
    /**
     * @return {?}
     */
    get _currentLine() { return this._lines[this._lines.length - 1]; }
    /**
     * @param {?} varName
     * @return {?}
     */
    isExportedVar(varName) { return this._exportedVars.indexOf(varName) !== -1; }
    /**
     * @param {?=} lastPart
     * @return {?}
     */
    println(lastPart = '') { this.print(lastPart, true); }
    /**
     * @return {?}
     */
    lineIsEmpty() { return this._currentLine.parts.length === 0; }
    /**
     * @param {?} part
     * @param {?=} newLine
     * @return {?}
     */
    print(part, newLine = false) {
        if (part.length > 0) {
            this._currentLine.parts.push(part);
        }
        if (newLine) {
            this._lines.push(new _EmittedLine(this._indent));
        }
    }
    /**
     * @return {?}
     */
    removeEmptyLastLine() {
        if (this.lineIsEmpty()) {
            this._lines.pop();
        }
    }
    /**
     * @return {?}
     */
    incIndent() {
        this._indent++;
        this._currentLine.indent = this._indent;
    }
    /**
     * @return {?}
     */
    decIndent() {
        this._indent--;
        this._currentLine.indent = this._indent;
    }
    /**
     * @param {?} clazz
     * @return {?}
     */
    pushClass(clazz) { this._classes.push(clazz); }
    /**
     * @return {?}
     */
    popClass() { return this._classes.pop(); }
    /**
     * @return {?}
     */
    get currentClass() {
        return this._classes.length > 0 ? this._classes[this._classes.length - 1] : null;
    }
    /**
     * @return {?}
     */
    toSource() {
        let /** @type {?} */ lines = this._lines;
        if (lines[lines.length - 1].parts.length === 0) {
            lines = lines.slice(0, lines.length - 1);
        }
        return lines
            .map((line) => {
            if (line.parts.length > 0) {
                return _createIndent(line.indent) + line.parts.join('');
            }
            else {
                return '';
            }
        })
            .join('\n');
    }
}
function EmitterVisitorContext_tsickle_Closure_declarations() {
    /** @type {?} */
    EmitterVisitorContext.prototype._lines;
    /** @type {?} */
    EmitterVisitorContext.prototype._classes;
    /** @type {?} */
    EmitterVisitorContext.prototype._exportedVars;
    /** @type {?} */
    EmitterVisitorContext.prototype._indent;
}
/**
 * @abstract
 */
export class AbstractEmitterVisitor {
    /**
     * @param {?} _escapeDollarInStrings
     */
    constructor(_escapeDollarInStrings) {
        this._escapeDollarInStrings = _escapeDollarInStrings;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitExpressionStmt(stmt, ctx) {
        stmt.expr.visitExpression(this, ctx);
        ctx.println(';');
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitReturnStmt(stmt, ctx) {
        ctx.print(`return `);
        stmt.value.visitExpression(this, ctx);
        ctx.println(';');
        return null;
    }
    /**
     * @abstract
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitCastExpr(ast, context) { }
    /**
     * @abstract
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitDeclareClassStmt(stmt, ctx) { }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitIfStmt(stmt, ctx) {
        ctx.print(`if (`);
        stmt.condition.visitExpression(this, ctx);
        ctx.print(`) {`);
        const /** @type {?} */ hasElseCase = isPresent(stmt.falseCase) && stmt.falseCase.length > 0;
        if (stmt.trueCase.length <= 1 && !hasElseCase) {
            ctx.print(` `);
            this.visitAllStatements(stmt.trueCase, ctx);
            ctx.removeEmptyLastLine();
            ctx.print(` `);
        }
        else {
            ctx.println();
            ctx.incIndent();
            this.visitAllStatements(stmt.trueCase, ctx);
            ctx.decIndent();
            if (hasElseCase) {
                ctx.println(`} else {`);
                ctx.incIndent();
                this.visitAllStatements(stmt.falseCase, ctx);
                ctx.decIndent();
            }
        }
        ctx.println(`}`);
        return null;
    }
    /**
     * @abstract
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitTryCatchStmt(stmt, ctx) { }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitThrowStmt(stmt, ctx) {
        ctx.print(`throw `);
        stmt.error.visitExpression(this, ctx);
        ctx.println(`;`);
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitCommentStmt(stmt, ctx) {
        const /** @type {?} */ lines = stmt.comment.split('\n');
        lines.forEach((line) => { ctx.println(`// ${line}`); });
        return null;
    }
    /**
     * @abstract
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitDeclareVarStmt(stmt, ctx) { }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitWriteVarExpr(expr, ctx) {
        const /** @type {?} */ lineWasEmpty = ctx.lineIsEmpty();
        if (!lineWasEmpty) {
            ctx.print('(');
        }
        ctx.print(`${expr.name} = `);
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(')');
        }
        return null;
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitWriteKeyExpr(expr, ctx) {
        const /** @type {?} */ lineWasEmpty = ctx.lineIsEmpty();
        if (!lineWasEmpty) {
            ctx.print('(');
        }
        expr.receiver.visitExpression(this, ctx);
        ctx.print(`[`);
        expr.index.visitExpression(this, ctx);
        ctx.print(`] = `);
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(')');
        }
        return null;
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitWritePropExpr(expr, ctx) {
        const /** @type {?} */ lineWasEmpty = ctx.lineIsEmpty();
        if (!lineWasEmpty) {
            ctx.print('(');
        }
        expr.receiver.visitExpression(this, ctx);
        ctx.print(`.${expr.name} = `);
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(')');
        }
        return null;
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitInvokeMethodExpr(expr, ctx) {
        expr.receiver.visitExpression(this, ctx);
        let /** @type {?} */ name = expr.name;
        if (isPresent(expr.builtin)) {
            name = this.getBuiltinMethodName(expr.builtin);
            if (isBlank(name)) {
                // some builtins just mean to skip the call.
                return null;
            }
        }
        ctx.print(`.${name}(`);
        this.visitAllExpressions(expr.args, ctx, `,`);
        ctx.print(`)`);
        return null;
    }
    /**
     * @abstract
     * @param {?} method
     * @return {?}
     */
    getBuiltinMethodName(method) { }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitInvokeFunctionExpr(expr, ctx) {
        expr.fn.visitExpression(this, ctx);
        ctx.print(`(`);
        this.visitAllExpressions(expr.args, ctx, ',');
        ctx.print(`)`);
        return null;
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
                    varName = 'super';
                    break;
                case o.BuiltinVar.This:
                    varName = 'this';
                    break;
                case o.BuiltinVar.CatchError:
                    varName = CATCH_ERROR_VAR.name;
                    break;
                case o.BuiltinVar.CatchStack:
                    varName = CATCH_STACK_VAR.name;
                    break;
                default:
                    throw new Error(`Unknown builtin variable ${ast.builtin}`);
            }
        }
        ctx.print(varName);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitInstantiateExpr(ast, ctx) {
        ctx.print(`new `);
        ast.classExpr.visitExpression(this, ctx);
        ctx.print(`(`);
        this.visitAllExpressions(ast.args, ctx, ',');
        ctx.print(`)`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralExpr(ast, ctx) {
        const /** @type {?} */ value = ast.value;
        if (typeof value === 'string') {
            ctx.print(escapeIdentifier(value, this._escapeDollarInStrings));
        }
        else {
            ctx.print(`${value}`);
        }
        return null;
    }
    /**
     * @abstract
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitExternalExpr(ast, ctx) { }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitConditionalExpr(ast, ctx) {
        ctx.print(`(`);
        ast.condition.visitExpression(this, ctx);
        ctx.print('? ');
        ast.trueCase.visitExpression(this, ctx);
        ctx.print(': ');
        ast.falseCase.visitExpression(this, ctx);
        ctx.print(`)`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitNotExpr(ast, ctx) {
        ctx.print('!');
        ast.condition.visitExpression(this, ctx);
        return null;
    }
    /**
     * @abstract
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitFunctionExpr(ast, ctx) { }
    /**
     * @abstract
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    visitDeclareFunctionStmt(stmt, context) { }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitBinaryOperatorExpr(ast, ctx) {
        let /** @type {?} */ opStr;
        switch (ast.operator) {
            case o.BinaryOperator.Equals:
                opStr = '==';
                break;
            case o.BinaryOperator.Identical:
                opStr = '===';
                break;
            case o.BinaryOperator.NotEquals:
                opStr = '!=';
                break;
            case o.BinaryOperator.NotIdentical:
                opStr = '!==';
                break;
            case o.BinaryOperator.And:
                opStr = '&&';
                break;
            case o.BinaryOperator.Or:
                opStr = '||';
                break;
            case o.BinaryOperator.Plus:
                opStr = '+';
                break;
            case o.BinaryOperator.Minus:
                opStr = '-';
                break;
            case o.BinaryOperator.Divide:
                opStr = '/';
                break;
            case o.BinaryOperator.Multiply:
                opStr = '*';
                break;
            case o.BinaryOperator.Modulo:
                opStr = '%';
                break;
            case o.BinaryOperator.Lower:
                opStr = '<';
                break;
            case o.BinaryOperator.LowerEquals:
                opStr = '<=';
                break;
            case o.BinaryOperator.Bigger:
                opStr = '>';
                break;
            case o.BinaryOperator.BiggerEquals:
                opStr = '>=';
                break;
            default:
                throw new Error(`Unknown operator ${ast.operator}`);
        }
        ctx.print(`(`);
        ast.lhs.visitExpression(this, ctx);
        ctx.print(` ${opStr} `);
        ast.rhs.visitExpression(this, ctx);
        ctx.print(`)`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReadPropExpr(ast, ctx) {
        ast.receiver.visitExpression(this, ctx);
        ctx.print(`.`);
        ctx.print(ast.name);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReadKeyExpr(ast, ctx) {
        ast.receiver.visitExpression(this, ctx);
        ctx.print(`[`);
        ast.index.visitExpression(this, ctx);
        ctx.print(`]`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralArrayExpr(ast, ctx) {
        const /** @type {?} */ useNewLine = ast.entries.length > 1;
        ctx.print(`[`, useNewLine);
        ctx.incIndent();
        this.visitAllExpressions(ast.entries, ctx, ',', useNewLine);
        ctx.decIndent();
        ctx.print(`]`, useNewLine);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralMapExpr(ast, ctx) {
        const /** @type {?} */ useNewLine = ast.entries.length > 1;
        ctx.print(`{`, useNewLine);
        ctx.incIndent();
        this.visitAllObjects(entry => {
            ctx.print(`${escapeIdentifier(entry.key, this._escapeDollarInStrings, entry.quoted)}: `);
            entry.value.visitExpression(this, ctx);
        }, ast.entries, ctx, ',', useNewLine);
        ctx.decIndent();
        ctx.print(`}`, useNewLine);
        return null;
    }
    /**
     * @param {?} expressions
     * @param {?} ctx
     * @param {?} separator
     * @param {?=} newLine
     * @return {?}
     */
    visitAllExpressions(expressions, ctx, separator, newLine = false) {
        this.visitAllObjects(expr => expr.visitExpression(this, ctx), expressions, ctx, separator, newLine);
    }
    /**
     * @param {?} handler
     * @param {?} expressions
     * @param {?} ctx
     * @param {?} separator
     * @param {?=} newLine
     * @return {?}
     */
    visitAllObjects(handler, expressions, ctx, separator, newLine = false) {
        for (let /** @type {?} */ i = 0; i < expressions.length; i++) {
            if (i > 0) {
                ctx.print(separator, newLine);
            }
            handler(expressions[i]);
        }
        if (newLine) {
            ctx.println();
        }
    }
    /**
     * @param {?} statements
     * @param {?} ctx
     * @return {?}
     */
    visitAllStatements(statements, ctx) {
        statements.forEach((stmt) => stmt.visitStatement(this, ctx));
    }
}
function AbstractEmitterVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    AbstractEmitterVisitor.prototype._escapeDollarInStrings;
}
/**
 * @param {?} input
 * @param {?} escapeDollar
 * @param {?=} alwaysQuote
 * @return {?}
 */
export function escapeIdentifier(input, escapeDollar, alwaysQuote = true) {
    if (isBlank(input)) {
        return null;
    }
    const /** @type {?} */ body = input.replace(_SINGLE_QUOTE_ESCAPE_STRING_RE, (...match) => {
        if (match[0] == '$') {
            return escapeDollar ? '\\$' : '$';
        }
        else if (match[0] == '\n') {
            return '\\n';
        }
        else if (match[0] == '\r') {
            return '\\r';
        }
        else {
            return `\\${match[0]}`;
        }
    });
    const /** @type {?} */ requiresQuotes = alwaysQuote || !_LEGAL_IDENTIFIER_RE.test(body);
    return requiresQuotes ? `'${body}'` : body;
}
/**
 * @param {?} count
 * @return {?}
 */
function _createIndent(count) {
    let /** @type {?} */ res = '';
    for (let /** @type {?} */ i = 0; i < count; i++) {
        res += '  ';
    }
    return res;
}
//# sourceMappingURL=abstract_emitter.js.map