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
import { SourceMapGenerator } from './source_map';
const /** @type {?} */ _SINGLE_QUOTE_ESCAPE_STRING_RE = /'|\\|\n|\r|\$/g;
const /** @type {?} */ _LEGAL_IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i;
const /** @type {?} */ _INDENT_WITH = '  ';
export const /** @type {?} */ CATCH_ERROR_VAR = o.variable('error', null, null);
export const /** @type {?} */ CATCH_STACK_VAR = o.variable('stack', null, null);
/**
 * @record
 */
export function OutputEmitter() { }
function OutputEmitter_tsickle_Closure_declarations() {
    /** @type {?} */
    OutputEmitter.prototype.emitStatements;
}
class _EmittedLine {
    /**
     * @param {?} indent
     */
    constructor(indent) {
        this.indent = indent;
        this.partsLength = 0;
        this.parts = [];
        this.srcSpans = [];
    }
}
function _EmittedLine_tsickle_Closure_declarations() {
    /** @type {?} */
    _EmittedLine.prototype.partsLength;
    /** @type {?} */
    _EmittedLine.prototype.parts;
    /** @type {?} */
    _EmittedLine.prototype.srcSpans;
    /** @type {?} */
    _EmittedLine.prototype.indent;
}
export class EmitterVisitorContext {
    /**
     * @param {?} _indent
     */
    constructor(_indent) {
        this._indent = _indent;
        this._classes = [];
        this._preambleLineCount = 0;
        this._lines = [new _EmittedLine(_indent)];
    }
    /**
     * @return {?}
     */
    static createRoot() { return new EmitterVisitorContext(0); }
    /**
     * @return {?}
     */
    get _currentLine() { return this._lines[this._lines.length - 1]; }
    /**
     * @param {?=} from
     * @param {?=} lastPart
     * @return {?}
     */
    println(from, lastPart = '') {
        this.print(from || null, lastPart, true);
    }
    /**
     * @return {?}
     */
    lineIsEmpty() { return this._currentLine.parts.length === 0; }
    /**
     * @return {?}
     */
    lineLength() {
        return this._currentLine.indent * _INDENT_WITH.length + this._currentLine.partsLength;
    }
    /**
     * @param {?} from
     * @param {?} part
     * @param {?=} newLine
     * @return {?}
     */
    print(from, part, newLine = false) {
        if (part.length > 0) {
            this._currentLine.parts.push(part);
            this._currentLine.partsLength += part.length;
            this._currentLine.srcSpans.push(from && from.sourceSpan || null);
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
        if (this.lineIsEmpty()) {
            this._currentLine.indent = this._indent;
        }
    }
    /**
     * @return {?}
     */
    decIndent() {
        this._indent--;
        if (this.lineIsEmpty()) {
            this._currentLine.indent = this._indent;
        }
    }
    /**
     * @param {?} clazz
     * @return {?}
     */
    pushClass(clazz) { this._classes.push(clazz); }
    /**
     * @return {?}
     */
    popClass() { return /** @type {?} */ ((this._classes.pop())); }
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
        return this.sourceLines
            .map(l => l.parts.length > 0 ? _createIndent(l.indent) + l.parts.join('') : '')
            .join('\n');
    }
    /**
     * @param {?} genFilePath
     * @param {?=} startsAtLine
     * @return {?}
     */
    toSourceMapGenerator(genFilePath, startsAtLine = 0) {
        const /** @type {?} */ map = new SourceMapGenerator(genFilePath);
        let /** @type {?} */ firstOffsetMapped = false;
        const /** @type {?} */ mapFirstOffsetIfNeeded = () => {
            if (!firstOffsetMapped) {
                // Add a single space so that tools won't try to load the file from disk.
                // Note: We are using virtual urls like `ng:///`, so we have to
                // provide a content here.
                map.addSource(genFilePath, ' ').addMapping(0, genFilePath, 0, 0);
                firstOffsetMapped = true;
            }
        };
        for (let /** @type {?} */ i = 0; i < startsAtLine; i++) {
            map.addLine();
            mapFirstOffsetIfNeeded();
        }
        this.sourceLines.forEach((line, lineIdx) => {
            map.addLine();
            const /** @type {?} */ spans = line.srcSpans;
            const /** @type {?} */ parts = line.parts;
            let /** @type {?} */ col0 = line.indent * _INDENT_WITH.length;
            let /** @type {?} */ spanIdx = 0;
            // skip leading parts without source spans
            while (spanIdx < spans.length && !spans[spanIdx]) {
                col0 += parts[spanIdx].length;
                spanIdx++;
            }
            if (spanIdx < spans.length && lineIdx === 0 && col0 === 0) {
                firstOffsetMapped = true;
            }
            else {
                mapFirstOffsetIfNeeded();
            }
            while (spanIdx < spans.length) {
                const /** @type {?} */ span = /** @type {?} */ ((spans[spanIdx]));
                const /** @type {?} */ source = span.start.file;
                const /** @type {?} */ sourceLine = span.start.line;
                const /** @type {?} */ sourceCol = span.start.col;
                map.addSource(source.url, source.content)
                    .addMapping(col0, source.url, sourceLine, sourceCol);
                col0 += parts[spanIdx].length;
                spanIdx++;
                // assign parts without span or the same span to the previous segment
                while (spanIdx < spans.length && (span === spans[spanIdx] || !spans[spanIdx])) {
                    col0 += parts[spanIdx].length;
                    spanIdx++;
                }
            }
        });
        return map;
    }
    /**
     * @param {?} count
     * @return {?}
     */
    setPreambleLineCount(count) { return this._preambleLineCount = count; }
    /**
     * @param {?} line
     * @param {?} column
     * @return {?}
     */
    spanOf(line, column) {
        const /** @type {?} */ emittedLine = this._lines[line - this._preambleLineCount];
        if (emittedLine) {
            let /** @type {?} */ columnsLeft = column - _createIndent(emittedLine.indent).length;
            for (let /** @type {?} */ partIndex = 0; partIndex < emittedLine.parts.length; partIndex++) {
                const /** @type {?} */ part = emittedLine.parts[partIndex];
                if (part.length > columnsLeft) {
                    return emittedLine.srcSpans[partIndex];
                }
                columnsLeft -= part.length;
            }
        }
        return null;
    }
    /**
     * @return {?}
     */
    get sourceLines() {
        if (this._lines.length && this._lines[this._lines.length - 1].parts.length === 0) {
            return this._lines.slice(0, -1);
        }
        return this._lines;
    }
}
function EmitterVisitorContext_tsickle_Closure_declarations() {
    /** @type {?} */
    EmitterVisitorContext.prototype._lines;
    /** @type {?} */
    EmitterVisitorContext.prototype._classes;
    /** @type {?} */
    EmitterVisitorContext.prototype._preambleLineCount;
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
        ctx.println(stmt, ';');
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitReturnStmt(stmt, ctx) {
        ctx.print(stmt, `return `);
        stmt.value.visitExpression(this, ctx);
        ctx.println(stmt, ';');
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitIfStmt(stmt, ctx) {
        ctx.print(stmt, `if (`);
        stmt.condition.visitExpression(this, ctx);
        ctx.print(stmt, `) {`);
        const /** @type {?} */ hasElseCase = stmt.falseCase != null && stmt.falseCase.length > 0;
        if (stmt.trueCase.length <= 1 && !hasElseCase) {
            ctx.print(stmt, ` `);
            this.visitAllStatements(stmt.trueCase, ctx);
            ctx.removeEmptyLastLine();
            ctx.print(stmt, ` `);
        }
        else {
            ctx.println();
            ctx.incIndent();
            this.visitAllStatements(stmt.trueCase, ctx);
            ctx.decIndent();
            if (hasElseCase) {
                ctx.println(stmt, `} else {`);
                ctx.incIndent();
                this.visitAllStatements(stmt.falseCase, ctx);
                ctx.decIndent();
            }
        }
        ctx.println(stmt, `}`);
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitThrowStmt(stmt, ctx) {
        ctx.print(stmt, `throw `);
        stmt.error.visitExpression(this, ctx);
        ctx.println(stmt, `;`);
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitCommentStmt(stmt, ctx) {
        if (stmt.multiline) {
            ctx.println(stmt, `/* ${stmt.comment} */`);
        }
        else {
            stmt.comment.split('\n').forEach((line) => { ctx.println(stmt, `// ${line}`); });
        }
        return null;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    visitJSDocCommentStmt(stmt, ctx) {
        ctx.println(stmt, `/*${stmt.toString()}*/`);
        return null;
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitWriteVarExpr(expr, ctx) {
        const /** @type {?} */ lineWasEmpty = ctx.lineIsEmpty();
        if (!lineWasEmpty) {
            ctx.print(expr, '(');
        }
        ctx.print(expr, `${expr.name} = `);
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(expr, ')');
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
            ctx.print(expr, '(');
        }
        expr.receiver.visitExpression(this, ctx);
        ctx.print(expr, `[`);
        expr.index.visitExpression(this, ctx);
        ctx.print(expr, `] = `);
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(expr, ')');
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
            ctx.print(expr, '(');
        }
        expr.receiver.visitExpression(this, ctx);
        ctx.print(expr, `.${expr.name} = `);
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(expr, ')');
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
        if (expr.builtin != null) {
            name = this.getBuiltinMethodName(expr.builtin);
            if (name == null) {
                // some builtins just mean to skip the call.
                return null;
            }
        }
        ctx.print(expr, `.${name}(`);
        this.visitAllExpressions(expr.args, ctx, `,`);
        ctx.print(expr, `)`);
        return null;
    }
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    visitInvokeFunctionExpr(expr, ctx) {
        expr.fn.visitExpression(this, ctx);
        ctx.print(expr, `(`);
        this.visitAllExpressions(expr.args, ctx, ',');
        ctx.print(expr, `)`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReadVarExpr(ast, ctx) {
        let /** @type {?} */ varName = /** @type {?} */ ((ast.name));
        if (ast.builtin != null) {
            switch (ast.builtin) {
                case o.BuiltinVar.Super:
                    varName = 'super';
                    break;
                case o.BuiltinVar.This:
                    varName = 'this';
                    break;
                case o.BuiltinVar.CatchError:
                    varName = /** @type {?} */ ((CATCH_ERROR_VAR.name));
                    break;
                case o.BuiltinVar.CatchStack:
                    varName = /** @type {?} */ ((CATCH_STACK_VAR.name));
                    break;
                default:
                    throw new Error(`Unknown builtin variable ${ast.builtin}`);
            }
        }
        ctx.print(ast, varName);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitInstantiateExpr(ast, ctx) {
        ctx.print(ast, `new `);
        ast.classExpr.visitExpression(this, ctx);
        ctx.print(ast, `(`);
        this.visitAllExpressions(ast.args, ctx, ',');
        ctx.print(ast, `)`);
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
            ctx.print(ast, escapeIdentifier(value, this._escapeDollarInStrings));
        }
        else {
            ctx.print(ast, `${value}`);
        }
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitConditionalExpr(ast, ctx) {
        ctx.print(ast, `(`);
        ast.condition.visitExpression(this, ctx);
        ctx.print(ast, '? ');
        ast.trueCase.visitExpression(this, ctx);
        ctx.print(ast, ': '); /** @type {?} */
        ((ast.falseCase)).visitExpression(this, ctx);
        ctx.print(ast, `)`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitNotExpr(ast, ctx) {
        ctx.print(ast, '!');
        ast.condition.visitExpression(this, ctx);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitAssertNotNullExpr(ast, ctx) {
        ast.condition.visitExpression(this, ctx);
        return null;
    }
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
        ctx.print(ast, `(`);
        ast.lhs.visitExpression(this, ctx);
        ctx.print(ast, ` ${opStr} `);
        ast.rhs.visitExpression(this, ctx);
        ctx.print(ast, `)`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReadPropExpr(ast, ctx) {
        ast.receiver.visitExpression(this, ctx);
        ctx.print(ast, `.`);
        ctx.print(ast, ast.name);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitReadKeyExpr(ast, ctx) {
        ast.receiver.visitExpression(this, ctx);
        ctx.print(ast, `[`);
        ast.index.visitExpression(this, ctx);
        ctx.print(ast, `]`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralArrayExpr(ast, ctx) {
        ctx.print(ast, `[`);
        this.visitAllExpressions(ast.entries, ctx, ',');
        ctx.print(ast, `]`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitLiteralMapExpr(ast, ctx) {
        ctx.print(ast, `{`);
        this.visitAllObjects(entry => {
            ctx.print(ast, `${escapeIdentifier(entry.key, this._escapeDollarInStrings, entry.quoted)}:`);
            entry.value.visitExpression(this, ctx);
        }, ast.entries, ctx, ',');
        ctx.print(ast, `}`);
        return null;
    }
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    visitCommaExpr(ast, ctx) {
        ctx.print(ast, '(');
        this.visitAllExpressions(ast.parts, ctx, ',');
        ctx.print(ast, ')');
        return null;
    }
    /**
     * @param {?} expressions
     * @param {?} ctx
     * @param {?} separator
     * @return {?}
     */
    visitAllExpressions(expressions, ctx, separator) {
        this.visitAllObjects(expr => expr.visitExpression(this, ctx), expressions, ctx, separator);
    }
    /**
     * @template T
     * @param {?} handler
     * @param {?} expressions
     * @param {?} ctx
     * @param {?} separator
     * @return {?}
     */
    visitAllObjects(handler, expressions, ctx, separator) {
        let /** @type {?} */ incrementedIndent = false;
        for (let /** @type {?} */ i = 0; i < expressions.length; i++) {
            if (i > 0) {
                if (ctx.lineLength() > 80) {
                    ctx.print(null, separator, true);
                    if (!incrementedIndent) {
                        // continuation are marked with double indent.
                        ctx.incIndent();
                        ctx.incIndent();
                        incrementedIndent = true;
                    }
                }
                else {
                    ctx.print(null, separator, false);
                }
            }
            handler(expressions[i]);
        }
        if (incrementedIndent) {
            // continuation are marked with double indent.
            ctx.decIndent();
            ctx.decIndent();
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
    /**
     * @abstract
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitCastExpr = function (ast, context) { };
    /**
     * @abstract
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitDeclareClassStmt = function (stmt, ctx) { };
    /**
     * @abstract
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitTryCatchStmt = function (stmt, ctx) { };
    /**
     * @abstract
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitDeclareVarStmt = function (stmt, ctx) { };
    /**
     * @abstract
     * @param {?} method
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.getBuiltinMethodName = function (method) { };
    /**
     * @abstract
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitExternalExpr = function (ast, ctx) { };
    /**
     * @abstract
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitFunctionExpr = function (ast, ctx) { };
    /**
     * @abstract
     * @param {?} stmt
     * @param {?} context
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitDeclareFunctionStmt = function (stmt, context) { };
}
/**
 * @param {?} input
 * @param {?} escapeDollar
 * @param {?=} alwaysQuote
 * @return {?}
 */
export function escapeIdentifier(input, escapeDollar, alwaysQuote = true) {
    if (input == null) {
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
        res += _INDENT_WITH;
    }
    return res;
}
//# sourceMappingURL=abstract_emitter.js.map