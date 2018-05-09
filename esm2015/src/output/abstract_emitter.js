/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from './output_ast';
import { SourceMapGenerator } from './source_map';
const _SINGLE_QUOTE_ESCAPE_STRING_RE = /'|\\|\n|\r|\$/g;
const _LEGAL_IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i;
const _INDENT_WITH = '  ';
export const CATCH_ERROR_VAR = o.variable('error', null, null);
export const CATCH_STACK_VAR = o.variable('stack', null, null);
class _EmittedLine {
    constructor(indent) {
        this.indent = indent;
        this.partsLength = 0;
        this.parts = [];
        this.srcSpans = [];
    }
}
export class EmitterVisitorContext {
    constructor(_indent) {
        this._indent = _indent;
        this._classes = [];
        this._preambleLineCount = 0;
        this._lines = [new _EmittedLine(_indent)];
    }
    static createRoot() { return new EmitterVisitorContext(0); }
    get _currentLine() { return this._lines[this._lines.length - 1]; }
    println(from, lastPart = '') {
        this.print(from || null, lastPart, true);
    }
    lineIsEmpty() { return this._currentLine.parts.length === 0; }
    lineLength() {
        return this._currentLine.indent * _INDENT_WITH.length + this._currentLine.partsLength;
    }
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
    removeEmptyLastLine() {
        if (this.lineIsEmpty()) {
            this._lines.pop();
        }
    }
    incIndent() {
        this._indent++;
        if (this.lineIsEmpty()) {
            this._currentLine.indent = this._indent;
        }
    }
    decIndent() {
        this._indent--;
        if (this.lineIsEmpty()) {
            this._currentLine.indent = this._indent;
        }
    }
    pushClass(clazz) { this._classes.push(clazz); }
    popClass() { return this._classes.pop(); }
    get currentClass() {
        return this._classes.length > 0 ? this._classes[this._classes.length - 1] : null;
    }
    toSource() {
        return this.sourceLines
            .map(l => l.parts.length > 0 ? _createIndent(l.indent) + l.parts.join('') : '')
            .join('\n');
    }
    toSourceMapGenerator(genFilePath, startsAtLine = 0) {
        const map = new SourceMapGenerator(genFilePath);
        let firstOffsetMapped = false;
        const mapFirstOffsetIfNeeded = () => {
            if (!firstOffsetMapped) {
                // Add a single space so that tools won't try to load the file from disk.
                // Note: We are using virtual urls like `ng:///`, so we have to
                // provide a content here.
                map.addSource(genFilePath, ' ').addMapping(0, genFilePath, 0, 0);
                firstOffsetMapped = true;
            }
        };
        for (let i = 0; i < startsAtLine; i++) {
            map.addLine();
            mapFirstOffsetIfNeeded();
        }
        this.sourceLines.forEach((line, lineIdx) => {
            map.addLine();
            const spans = line.srcSpans;
            const parts = line.parts;
            let col0 = line.indent * _INDENT_WITH.length;
            let spanIdx = 0;
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
                const span = spans[spanIdx];
                const source = span.start.file;
                const sourceLine = span.start.line;
                const sourceCol = span.start.col;
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
    setPreambleLineCount(count) { return this._preambleLineCount = count; }
    spanOf(line, column) {
        const emittedLine = this._lines[line - this._preambleLineCount];
        if (emittedLine) {
            let columnsLeft = column - _createIndent(emittedLine.indent).length;
            for (let partIndex = 0; partIndex < emittedLine.parts.length; partIndex++) {
                const part = emittedLine.parts[partIndex];
                if (part.length > columnsLeft) {
                    return emittedLine.srcSpans[partIndex];
                }
                columnsLeft -= part.length;
            }
        }
        return null;
    }
    get sourceLines() {
        if (this._lines.length && this._lines[this._lines.length - 1].parts.length === 0) {
            return this._lines.slice(0, -1);
        }
        return this._lines;
    }
}
export class AbstractEmitterVisitor {
    constructor(_escapeDollarInStrings) {
        this._escapeDollarInStrings = _escapeDollarInStrings;
    }
    visitExpressionStmt(stmt, ctx) {
        stmt.expr.visitExpression(this, ctx);
        ctx.println(stmt, ';');
        return null;
    }
    visitReturnStmt(stmt, ctx) {
        ctx.print(stmt, `return `);
        stmt.value.visitExpression(this, ctx);
        ctx.println(stmt, ';');
        return null;
    }
    visitIfStmt(stmt, ctx) {
        ctx.print(stmt, `if (`);
        stmt.condition.visitExpression(this, ctx);
        ctx.print(stmt, `) {`);
        const hasElseCase = stmt.falseCase != null && stmt.falseCase.length > 0;
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
    visitThrowStmt(stmt, ctx) {
        ctx.print(stmt, `throw `);
        stmt.error.visitExpression(this, ctx);
        ctx.println(stmt, `;`);
        return null;
    }
    visitCommentStmt(stmt, ctx) {
        if (stmt.multiline) {
            ctx.println(stmt, `/* ${stmt.comment} */`);
        }
        else {
            stmt.comment.split('\n').forEach((line) => { ctx.println(stmt, `// ${line}`); });
        }
        return null;
    }
    visitJSDocCommentStmt(stmt, ctx) {
        ctx.println(stmt, `/*${stmt.toString()}*/`);
        return null;
    }
    visitWriteVarExpr(expr, ctx) {
        const lineWasEmpty = ctx.lineIsEmpty();
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
    visitWriteKeyExpr(expr, ctx) {
        const lineWasEmpty = ctx.lineIsEmpty();
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
    visitWritePropExpr(expr, ctx) {
        const lineWasEmpty = ctx.lineIsEmpty();
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
    visitInvokeMethodExpr(expr, ctx) {
        expr.receiver.visitExpression(this, ctx);
        let name = expr.name;
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
    visitInvokeFunctionExpr(expr, ctx) {
        expr.fn.visitExpression(this, ctx);
        ctx.print(expr, `(`);
        this.visitAllExpressions(expr.args, ctx, ',');
        ctx.print(expr, `)`);
        return null;
    }
    visitWrappedNodeExpr(ast, ctx) {
        throw new Error('Abstract emitter cannot visit WrappedNodeExpr.');
    }
    visitReadVarExpr(ast, ctx) {
        let varName = ast.name;
        if (ast.builtin != null) {
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
        ctx.print(ast, varName);
        return null;
    }
    visitInstantiateExpr(ast, ctx) {
        ctx.print(ast, `new `);
        ast.classExpr.visitExpression(this, ctx);
        ctx.print(ast, `(`);
        this.visitAllExpressions(ast.args, ctx, ',');
        ctx.print(ast, `)`);
        return null;
    }
    visitLiteralExpr(ast, ctx) {
        const value = ast.value;
        if (typeof value === 'string') {
            ctx.print(ast, escapeIdentifier(value, this._escapeDollarInStrings));
        }
        else {
            ctx.print(ast, `${value}`);
        }
        return null;
    }
    visitConditionalExpr(ast, ctx) {
        ctx.print(ast, `(`);
        ast.condition.visitExpression(this, ctx);
        ctx.print(ast, '? ');
        ast.trueCase.visitExpression(this, ctx);
        ctx.print(ast, ': ');
        ast.falseCase.visitExpression(this, ctx);
        ctx.print(ast, `)`);
        return null;
    }
    visitNotExpr(ast, ctx) {
        ctx.print(ast, '!');
        ast.condition.visitExpression(this, ctx);
        return null;
    }
    visitAssertNotNullExpr(ast, ctx) {
        ast.condition.visitExpression(this, ctx);
        return null;
    }
    visitBinaryOperatorExpr(ast, ctx) {
        let opStr;
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
            case o.BinaryOperator.BitwiseAnd:
                opStr = '&';
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
        if (ast.parens)
            ctx.print(ast, `(`);
        ast.lhs.visitExpression(this, ctx);
        ctx.print(ast, ` ${opStr} `);
        ast.rhs.visitExpression(this, ctx);
        if (ast.parens)
            ctx.print(ast, `)`);
        return null;
    }
    visitReadPropExpr(ast, ctx) {
        ast.receiver.visitExpression(this, ctx);
        ctx.print(ast, `.`);
        ctx.print(ast, ast.name);
        return null;
    }
    visitReadKeyExpr(ast, ctx) {
        ast.receiver.visitExpression(this, ctx);
        ctx.print(ast, `[`);
        ast.index.visitExpression(this, ctx);
        ctx.print(ast, `]`);
        return null;
    }
    visitLiteralArrayExpr(ast, ctx) {
        ctx.print(ast, `[`);
        this.visitAllExpressions(ast.entries, ctx, ',');
        ctx.print(ast, `]`);
        return null;
    }
    visitLiteralMapExpr(ast, ctx) {
        ctx.print(ast, `{`);
        this.visitAllObjects(entry => {
            ctx.print(ast, `${escapeIdentifier(entry.key, this._escapeDollarInStrings, entry.quoted)}:`);
            entry.value.visitExpression(this, ctx);
        }, ast.entries, ctx, ',');
        ctx.print(ast, `}`);
        return null;
    }
    visitCommaExpr(ast, ctx) {
        ctx.print(ast, '(');
        this.visitAllExpressions(ast.parts, ctx, ',');
        ctx.print(ast, ')');
        return null;
    }
    visitAllExpressions(expressions, ctx, separator) {
        this.visitAllObjects(expr => expr.visitExpression(this, ctx), expressions, ctx, separator);
    }
    visitAllObjects(handler, expressions, ctx, separator) {
        let incrementedIndent = false;
        for (let i = 0; i < expressions.length; i++) {
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
    visitAllStatements(statements, ctx) {
        statements.forEach((stmt) => stmt.visitStatement(this, ctx));
    }
}
export function escapeIdentifier(input, escapeDollar, alwaysQuote = true) {
    if (input == null) {
        return null;
    }
    const body = input.replace(_SINGLE_QUOTE_ESCAPE_STRING_RE, (...match) => {
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
    const requiresQuotes = alwaysQuote || !_LEGAL_IDENTIFIER_RE.test(body);
    return requiresQuotes ? `'${body}'` : body;
}
function _createIndent(count) {
    let res = '';
    for (let i = 0; i < count; i++) {
        res += _INDENT_WITH;
    }
    return res;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvYWJzdHJhY3RfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEtBQUssQ0FBQyxNQUFNLGNBQWMsQ0FBQztBQUNsQyxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFaEQsTUFBTSw4QkFBOEIsR0FBRyxnQkFBZ0IsQ0FBQztBQUN4RCxNQUFNLG9CQUFvQixHQUFHLHVCQUF1QixDQUFDO0FBQ3JELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQztBQUMxQixNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQy9ELE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFNL0Q7SUFJRSxZQUFtQixNQUFjO1FBQWQsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUhqQyxnQkFBVyxHQUFHLENBQUMsQ0FBQztRQUNoQixVQUFLLEdBQWEsRUFBRSxDQUFDO1FBQ3JCLGFBQVEsR0FBNkIsRUFBRSxDQUFDO0lBQ0osQ0FBQztDQUN0QztBQUVELE1BQU07SUFPSixZQUFvQixPQUFlO1FBQWYsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUgzQixhQUFRLEdBQWtCLEVBQUUsQ0FBQztRQUM3Qix1QkFBa0IsR0FBRyxDQUFDLENBQUM7UUFFUSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUFDLENBQUM7SUFObkYsTUFBTSxDQUFDLFVBQVUsS0FBNEIsTUFBTSxDQUFDLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBUW5GLElBQVksWUFBWSxLQUFtQixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFeEYsT0FBTyxDQUFDLElBQWdELEVBQUUsV0FBbUIsRUFBRTtRQUM3RSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFRCxXQUFXLEtBQWMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXZFLFVBQVU7UUFDUixNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQztJQUN4RixDQUFDO0lBRUQsS0FBSyxDQUFDLElBQStDLEVBQUUsSUFBWSxFQUFFLFVBQW1CLEtBQUs7UUFDM0YsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQzdDLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBQ0QsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNaLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDSCxDQUFDO0lBRUQsbUJBQW1CO1FBQ2pCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNwQixDQUFDO0lBQ0gsQ0FBQztJQUVELFNBQVM7UUFDUCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDMUMsQ0FBQztJQUNILENBQUM7SUFFRCxTQUFTO1FBQ1AsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2YsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQzFDLENBQUM7SUFDSCxDQUFDO0lBRUQsU0FBUyxDQUFDLEtBQWtCLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTVELFFBQVEsS0FBa0IsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFJLENBQUMsQ0FBQyxDQUFDO0lBRXpELElBQUksWUFBWTtRQUNkLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUNuRixDQUFDO0lBRUQsUUFBUTtRQUNOLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVzthQUNsQixHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUM5RSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUVELG9CQUFvQixDQUFDLFdBQW1CLEVBQUUsZUFBdUIsQ0FBQztRQUNoRSxNQUFNLEdBQUcsR0FBRyxJQUFJLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRWhELElBQUksaUJBQWlCLEdBQUcsS0FBSyxDQUFDO1FBQzlCLE1BQU0sc0JBQXNCLEdBQUcsR0FBRyxFQUFFO1lBQ2xDLEVBQUUsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO2dCQUN2Qix5RUFBeUU7Z0JBQ3pFLCtEQUErRDtnQkFDL0QsMEJBQTBCO2dCQUMxQixHQUFHLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pFLGlCQUFpQixHQUFHLElBQUksQ0FBQztZQUMzQixDQUFDO1FBQ0gsQ0FBQyxDQUFDO1FBRUYsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN0QyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxzQkFBc0IsRUFBRSxDQUFDO1FBQzNCLENBQUM7UUFFRCxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRTtZQUN6QyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7WUFFZCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQzVCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDekIsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDO1lBQzdDLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztZQUNoQiwwQ0FBMEM7WUFDMUMsT0FBTyxPQUFPLEdBQUcsS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNqRCxJQUFJLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDOUIsT0FBTyxFQUFFLENBQUM7WUFDWixDQUFDO1lBQ0QsRUFBRSxDQUFDLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxNQUFNLElBQUksT0FBTyxLQUFLLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUQsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1lBQzNCLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixzQkFBc0IsRUFBRSxDQUFDO1lBQzNCLENBQUM7WUFFRCxPQUFPLE9BQU8sR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUcsQ0FBQztnQkFDOUIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7Z0JBQy9CLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2dCQUNuQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQztnQkFDakMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUM7cUJBQ3BDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBRXpELElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUM5QixPQUFPLEVBQUUsQ0FBQztnQkFFVixxRUFBcUU7Z0JBQ3JFLE9BQU8sT0FBTyxHQUFHLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDOUUsSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUM7b0JBQzlCLE9BQU8sRUFBRSxDQUFDO2dCQUNaLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLENBQUMsR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELG9CQUFvQixDQUFDLEtBQWEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFFL0UsTUFBTSxDQUFDLElBQVksRUFBRSxNQUFjO1FBQ2pDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2hFLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDaEIsSUFBSSxXQUFXLEdBQUcsTUFBTSxHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ3BFLEdBQUcsQ0FBQyxDQUFDLElBQUksU0FBUyxHQUFHLENBQUMsRUFBRSxTQUFTLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQztnQkFDMUUsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDMUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDO29CQUM5QixNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDekMsQ0FBQztnQkFDRCxXQUFXLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUM3QixDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsSUFBWSxXQUFXO1FBQ3JCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pGLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsQyxDQUFDO1FBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDckIsQ0FBQztDQUNGO0FBRUQsTUFBTTtJQUNKLFlBQW9CLHNCQUErQjtRQUEvQiwyQkFBc0IsR0FBdEIsc0JBQXNCLENBQVM7SUFBRyxDQUFDO0lBRXZELG1CQUFtQixDQUFDLElBQTJCLEVBQUUsR0FBMEI7UUFDekUsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3JDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsZUFBZSxDQUFDLElBQXVCLEVBQUUsR0FBMEI7UUFDakUsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3RDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBTUQsV0FBVyxDQUFDLElBQWMsRUFBRSxHQUEwQjtRQUNwRCxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDMUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdkIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ3hFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDOUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDckIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDNUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDMUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdkIsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2QsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzVDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNoQixFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUNoQixHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDOUIsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNoQixJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDN0MsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2xCLENBQUM7UUFDSCxDQUFDO1FBQ0QsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFJRCxjQUFjLENBQUMsSUFBaUIsRUFBRSxHQUEwQjtRQUMxRCxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxQixJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxJQUFtQixFQUFFLEdBQTBCO1FBQzlELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ25CLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sSUFBSSxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUM7UUFDN0MsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRixDQUFDO1FBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxxQkFBcUIsQ0FBQyxJQUF3QixFQUFFLEdBQTBCO1FBQ3hFLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM1QyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUlELGlCQUFpQixDQUFDLElBQW9CLEVBQUUsR0FBMEI7UUFDaEUsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3ZDLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUNsQixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN2QixDQUFDO1FBQ0QsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ2xCLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELGlCQUFpQixDQUFDLElBQW9CLEVBQUUsR0FBMEI7UUFDaEUsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3ZDLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUNsQixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN2QixDQUFDO1FBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3pDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN0QyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ2xCLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELGtCQUFrQixDQUFDLElBQXFCLEVBQUUsR0FBMEI7UUFDbEUsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3ZDLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUNsQixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN2QixDQUFDO1FBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3pDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUM7UUFDcEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3RDLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUNsQixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN2QixDQUFDO1FBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxxQkFBcUIsQ0FBQyxJQUF3QixFQUFFLEdBQTBCO1FBQ3hFLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN6QyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3JCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN6QixJQUFJLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMvQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDakIsNENBQTRDO2dCQUM1QyxNQUFNLENBQUMsSUFBSSxDQUFDO1lBQ2QsQ0FBQztRQUNILENBQUM7UUFDRCxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzlDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBSUQsdUJBQXVCLENBQUMsSUFBMEIsRUFBRSxHQUEwQjtRQUM1RSxJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDbkMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzlDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0Qsb0JBQW9CLENBQUMsR0FBMkIsRUFBRSxHQUEwQjtRQUMxRSxNQUFNLElBQUksS0FBSyxDQUFDLGdEQUFnRCxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUNELGdCQUFnQixDQUFDLEdBQWtCLEVBQUUsR0FBMEI7UUFDN0QsSUFBSSxPQUFPLEdBQUcsR0FBRyxDQUFDLElBQU0sQ0FBQztRQUN6QixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDeEIsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLO29CQUNyQixPQUFPLEdBQUcsT0FBTyxDQUFDO29CQUNsQixLQUFLLENBQUM7Z0JBQ1IsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUk7b0JBQ3BCLE9BQU8sR0FBRyxNQUFNLENBQUM7b0JBQ2pCLEtBQUssQ0FBQztnQkFDUixLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVTtvQkFDMUIsT0FBTyxHQUFHLGVBQWUsQ0FBQyxJQUFNLENBQUM7b0JBQ2pDLEtBQUssQ0FBQztnQkFDUixLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVTtvQkFDMUIsT0FBTyxHQUFHLGVBQWUsQ0FBQyxJQUFNLENBQUM7b0JBQ2pDLEtBQUssQ0FBQztnQkFDUjtvQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLDRCQUE0QixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUMvRCxDQUFDO1FBQ0gsQ0FBQztRQUNELEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0Qsb0JBQW9CLENBQUMsR0FBc0IsRUFBRSxHQUEwQjtRQUNyRSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2QixHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDekMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzdDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsR0FBa0IsRUFBRSxHQUEwQjtRQUM3RCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDO1FBQ3hCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDOUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQzdCLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUlELG9CQUFvQixDQUFDLEdBQXNCLEVBQUUsR0FBMEI7UUFDckUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDcEIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3pDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3JCLEdBQUcsQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN4QyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNyQixHQUFHLENBQUMsU0FBVyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDM0MsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxZQUFZLENBQUMsR0FBYyxFQUFFLEdBQTBCO1FBQ3JELEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN6QyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELHNCQUFzQixDQUFDLEdBQW9CLEVBQUUsR0FBMEI7UUFDckUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3pDLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBSUQsdUJBQXVCLENBQUMsR0FBeUIsRUFBRSxHQUEwQjtRQUMzRSxJQUFJLEtBQWEsQ0FBQztRQUNsQixNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNyQixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTTtnQkFDMUIsS0FBSyxHQUFHLElBQUksQ0FBQztnQkFDYixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsU0FBUztnQkFDN0IsS0FBSyxHQUFHLEtBQUssQ0FBQztnQkFDZCxLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsU0FBUztnQkFDN0IsS0FBSyxHQUFHLElBQUksQ0FBQztnQkFDYixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsWUFBWTtnQkFDaEMsS0FBSyxHQUFHLEtBQUssQ0FBQztnQkFDZCxLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRztnQkFDdkIsS0FBSyxHQUFHLElBQUksQ0FBQztnQkFDYixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsVUFBVTtnQkFDOUIsS0FBSyxHQUFHLEdBQUcsQ0FBQztnQkFDWixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsRUFBRTtnQkFDdEIsS0FBSyxHQUFHLElBQUksQ0FBQztnQkFDYixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSTtnQkFDeEIsS0FBSyxHQUFHLEdBQUcsQ0FBQztnQkFDWixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSztnQkFDekIsS0FBSyxHQUFHLEdBQUcsQ0FBQztnQkFDWixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTTtnQkFDMUIsS0FBSyxHQUFHLEdBQUcsQ0FBQztnQkFDWixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsUUFBUTtnQkFDNUIsS0FBSyxHQUFHLEdBQUcsQ0FBQztnQkFDWixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTTtnQkFDMUIsS0FBSyxHQUFHLEdBQUcsQ0FBQztnQkFDWixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSztnQkFDekIsS0FBSyxHQUFHLEdBQUcsQ0FBQztnQkFDWixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsV0FBVztnQkFDL0IsS0FBSyxHQUFHLElBQUksQ0FBQztnQkFDYixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTTtnQkFDMUIsS0FBSyxHQUFHLEdBQUcsQ0FBQztnQkFDWixLQUFLLENBQUM7WUFDUixLQUFLLENBQUMsQ0FBQyxjQUFjLENBQUMsWUFBWTtnQkFDaEMsS0FBSyxHQUFHLElBQUksQ0FBQztnQkFDYixLQUFLLENBQUM7WUFDUjtnQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUN4RCxDQUFDO1FBQ0QsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztZQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BDLEdBQUcsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNuQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDN0IsR0FBRyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ25DLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7WUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNwQyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELGlCQUFpQixDQUFDLEdBQW1CLEVBQUUsR0FBMEI7UUFDL0QsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3hDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6QixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELGdCQUFnQixDQUFDLEdBQWtCLEVBQUUsR0FBMEI7UUFDN0QsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3hDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLEdBQUcsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNyQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNwQixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELHFCQUFxQixDQUFDLEdBQXVCLEVBQUUsR0FBMEI7UUFDdkUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ2hELEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsbUJBQW1CLENBQUMsR0FBcUIsRUFBRSxHQUEwQjtRQUNuRSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM3RixLQUFLLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDekMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzFCLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsY0FBYyxDQUFDLEdBQWdCLEVBQUUsR0FBMEI7UUFDekQsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzlDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsbUJBQW1CLENBQUMsV0FBMkIsRUFBRSxHQUEwQixFQUFFLFNBQWlCO1FBRTVGLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzdGLENBQUM7SUFFRCxlQUFlLENBQ1gsT0FBdUIsRUFBRSxXQUFnQixFQUFFLEdBQTBCLEVBQ3JFLFNBQWlCO1FBQ25CLElBQUksaUJBQWlCLEdBQUcsS0FBSyxDQUFDO1FBQzlCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzVDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNWLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUMxQixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQ2pDLEVBQUUsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO3dCQUN2Qiw4Q0FBOEM7d0JBQzlDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDaEIsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDO3dCQUNoQixpQkFBaUIsR0FBRyxJQUFJLENBQUM7b0JBQzNCLENBQUM7Z0JBQ0gsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ3BDLENBQUM7WUFDSCxDQUFDO1lBQ0QsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFCLENBQUM7UUFDRCxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7WUFDdEIsOENBQThDO1lBQzlDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNoQixHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxVQUF5QixFQUFFLEdBQTBCO1FBQ3RFLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDL0QsQ0FBQztDQUNGO0FBRUQsTUFBTSwyQkFDRixLQUFhLEVBQUUsWUFBcUIsRUFBRSxjQUF1QixJQUFJO0lBQ25FLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsRUFBRSxDQUFDLEdBQUcsS0FBZSxFQUFFLEVBQUU7UUFDaEYsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDcEIsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFDcEMsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztZQUM1QixNQUFNLENBQUMsS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztZQUM1QixNQUFNLENBQUMsS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sTUFBTSxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDekIsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxjQUFjLEdBQUcsV0FBVyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUM3QyxDQUFDO0FBRUQsdUJBQXVCLEtBQWE7SUFDbEMsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ2IsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUMvQixHQUFHLElBQUksWUFBWSxDQUFDO0lBQ3RCLENBQUM7SUFDRCxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ2IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0X2FzdCc7XG5pbXBvcnQge1NvdXJjZU1hcEdlbmVyYXRvcn0gZnJvbSAnLi9zb3VyY2VfbWFwJztcblxuY29uc3QgX1NJTkdMRV9RVU9URV9FU0NBUEVfU1RSSU5HX1JFID0gLyd8XFxcXHxcXG58XFxyfFxcJC9nO1xuY29uc3QgX0xFR0FMX0lERU5USUZJRVJfUkUgPSAvXlskQS1aX11bMC05QS1aXyRdKiQvaTtcbmNvbnN0IF9JTkRFTlRfV0lUSCA9ICcgICc7XG5leHBvcnQgY29uc3QgQ0FUQ0hfRVJST1JfVkFSID0gby52YXJpYWJsZSgnZXJyb3InLCBudWxsLCBudWxsKTtcbmV4cG9ydCBjb25zdCBDQVRDSF9TVEFDS19WQVIgPSBvLnZhcmlhYmxlKCdzdGFjaycsIG51bGwsIG51bGwpO1xuXG5leHBvcnQgaW50ZXJmYWNlIE91dHB1dEVtaXR0ZXIge1xuICBlbWl0U3RhdGVtZW50cyhnZW5GaWxlUGF0aDogc3RyaW5nLCBzdG10czogby5TdGF0ZW1lbnRbXSwgcHJlYW1ibGU/OiBzdHJpbmd8bnVsbCk6IHN0cmluZztcbn1cblxuY2xhc3MgX0VtaXR0ZWRMaW5lIHtcbiAgcGFydHNMZW5ndGggPSAwO1xuICBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgc3JjU3BhbnM6IChQYXJzZVNvdXJjZVNwYW58bnVsbClbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgaW5kZW50OiBudW1iZXIpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBFbWl0dGVyVmlzaXRvckNvbnRleHQge1xuICBzdGF0aWMgY3JlYXRlUm9vdCgpOiBFbWl0dGVyVmlzaXRvckNvbnRleHQgeyByZXR1cm4gbmV3IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCgwKTsgfVxuXG4gIHByaXZhdGUgX2xpbmVzOiBfRW1pdHRlZExpbmVbXTtcbiAgcHJpdmF0ZSBfY2xhc3Nlczogby5DbGFzc1N0bXRbXSA9IFtdO1xuICBwcml2YXRlIF9wcmVhbWJsZUxpbmVDb3VudCA9IDA7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfaW5kZW50OiBudW1iZXIpIHsgdGhpcy5fbGluZXMgPSBbbmV3IF9FbWl0dGVkTGluZShfaW5kZW50KV07IH1cblxuICBwcml2YXRlIGdldCBfY3VycmVudExpbmUoKTogX0VtaXR0ZWRMaW5lIHsgcmV0dXJuIHRoaXMuX2xpbmVzW3RoaXMuX2xpbmVzLmxlbmd0aCAtIDFdOyB9XG5cbiAgcHJpbnRsbihmcm9tPzoge3NvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiB8IG51bGx9fG51bGwsIGxhc3RQYXJ0OiBzdHJpbmcgPSAnJyk6IHZvaWQge1xuICAgIHRoaXMucHJpbnQoZnJvbSB8fCBudWxsLCBsYXN0UGFydCwgdHJ1ZSk7XG4gIH1cblxuICBsaW5lSXNFbXB0eSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2N1cnJlbnRMaW5lLnBhcnRzLmxlbmd0aCA9PT0gMDsgfVxuXG4gIGxpbmVMZW5ndGgoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fY3VycmVudExpbmUuaW5kZW50ICogX0lOREVOVF9XSVRILmxlbmd0aCArIHRoaXMuX2N1cnJlbnRMaW5lLnBhcnRzTGVuZ3RoO1xuICB9XG5cbiAgcHJpbnQoZnJvbToge3NvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiB8IG51bGx9fG51bGwsIHBhcnQ6IHN0cmluZywgbmV3TGluZTogYm9vbGVhbiA9IGZhbHNlKSB7XG4gICAgaWYgKHBhcnQubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fY3VycmVudExpbmUucGFydHMucHVzaChwYXJ0KTtcbiAgICAgIHRoaXMuX2N1cnJlbnRMaW5lLnBhcnRzTGVuZ3RoICs9IHBhcnQubGVuZ3RoO1xuICAgICAgdGhpcy5fY3VycmVudExpbmUuc3JjU3BhbnMucHVzaChmcm9tICYmIGZyb20uc291cmNlU3BhbiB8fCBudWxsKTtcbiAgICB9XG4gICAgaWYgKG5ld0xpbmUpIHtcbiAgICAgIHRoaXMuX2xpbmVzLnB1c2gobmV3IF9FbWl0dGVkTGluZSh0aGlzLl9pbmRlbnQpKTtcbiAgICB9XG4gIH1cblxuICByZW1vdmVFbXB0eUxhc3RMaW5lKCkge1xuICAgIGlmICh0aGlzLmxpbmVJc0VtcHR5KCkpIHtcbiAgICAgIHRoaXMuX2xpbmVzLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIGluY0luZGVudCgpIHtcbiAgICB0aGlzLl9pbmRlbnQrKztcbiAgICBpZiAodGhpcy5saW5lSXNFbXB0eSgpKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TGluZS5pbmRlbnQgPSB0aGlzLl9pbmRlbnQ7XG4gICAgfVxuICB9XG5cbiAgZGVjSW5kZW50KCkge1xuICAgIHRoaXMuX2luZGVudC0tO1xuICAgIGlmICh0aGlzLmxpbmVJc0VtcHR5KCkpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRMaW5lLmluZGVudCA9IHRoaXMuX2luZGVudDtcbiAgICB9XG4gIH1cblxuICBwdXNoQ2xhc3MoY2xheno6IG8uQ2xhc3NTdG10KSB7IHRoaXMuX2NsYXNzZXMucHVzaChjbGF6eik7IH1cblxuICBwb3BDbGFzcygpOiBvLkNsYXNzU3RtdCB7IHJldHVybiB0aGlzLl9jbGFzc2VzLnBvcCgpICE7IH1cblxuICBnZXQgY3VycmVudENsYXNzKCk6IG8uQ2xhc3NTdG10fG51bGwge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc2VzLmxlbmd0aCA+IDAgPyB0aGlzLl9jbGFzc2VzW3RoaXMuX2NsYXNzZXMubGVuZ3RoIC0gMV0gOiBudWxsO1xuICB9XG5cbiAgdG9Tb3VyY2UoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5zb3VyY2VMaW5lc1xuICAgICAgICAubWFwKGwgPT4gbC5wYXJ0cy5sZW5ndGggPiAwID8gX2NyZWF0ZUluZGVudChsLmluZGVudCkgKyBsLnBhcnRzLmpvaW4oJycpIDogJycpXG4gICAgICAgIC5qb2luKCdcXG4nKTtcbiAgfVxuXG4gIHRvU291cmNlTWFwR2VuZXJhdG9yKGdlbkZpbGVQYXRoOiBzdHJpbmcsIHN0YXJ0c0F0TGluZTogbnVtYmVyID0gMCk6IFNvdXJjZU1hcEdlbmVyYXRvciB7XG4gICAgY29uc3QgbWFwID0gbmV3IFNvdXJjZU1hcEdlbmVyYXRvcihnZW5GaWxlUGF0aCk7XG5cbiAgICBsZXQgZmlyc3RPZmZzZXRNYXBwZWQgPSBmYWxzZTtcbiAgICBjb25zdCBtYXBGaXJzdE9mZnNldElmTmVlZGVkID0gKCkgPT4ge1xuICAgICAgaWYgKCFmaXJzdE9mZnNldE1hcHBlZCkge1xuICAgICAgICAvLyBBZGQgYSBzaW5nbGUgc3BhY2Ugc28gdGhhdCB0b29scyB3b24ndCB0cnkgdG8gbG9hZCB0aGUgZmlsZSBmcm9tIGRpc2suXG4gICAgICAgIC8vIE5vdGU6IFdlIGFyZSB1c2luZyB2aXJ0dWFsIHVybHMgbGlrZSBgbmc6Ly8vYCwgc28gd2UgaGF2ZSB0b1xuICAgICAgICAvLyBwcm92aWRlIGEgY29udGVudCBoZXJlLlxuICAgICAgICBtYXAuYWRkU291cmNlKGdlbkZpbGVQYXRoLCAnICcpLmFkZE1hcHBpbmcoMCwgZ2VuRmlsZVBhdGgsIDAsIDApO1xuICAgICAgICBmaXJzdE9mZnNldE1hcHBlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhcnRzQXRMaW5lOyBpKyspIHtcbiAgICAgIG1hcC5hZGRMaW5lKCk7XG4gICAgICBtYXBGaXJzdE9mZnNldElmTmVlZGVkKCk7XG4gICAgfVxuXG4gICAgdGhpcy5zb3VyY2VMaW5lcy5mb3JFYWNoKChsaW5lLCBsaW5lSWR4KSA9PiB7XG4gICAgICBtYXAuYWRkTGluZSgpO1xuXG4gICAgICBjb25zdCBzcGFucyA9IGxpbmUuc3JjU3BhbnM7XG4gICAgICBjb25zdCBwYXJ0cyA9IGxpbmUucGFydHM7XG4gICAgICBsZXQgY29sMCA9IGxpbmUuaW5kZW50ICogX0lOREVOVF9XSVRILmxlbmd0aDtcbiAgICAgIGxldCBzcGFuSWR4ID0gMDtcbiAgICAgIC8vIHNraXAgbGVhZGluZyBwYXJ0cyB3aXRob3V0IHNvdXJjZSBzcGFuc1xuICAgICAgd2hpbGUgKHNwYW5JZHggPCBzcGFucy5sZW5ndGggJiYgIXNwYW5zW3NwYW5JZHhdKSB7XG4gICAgICAgIGNvbDAgKz0gcGFydHNbc3BhbklkeF0ubGVuZ3RoO1xuICAgICAgICBzcGFuSWR4Kys7XG4gICAgICB9XG4gICAgICBpZiAoc3BhbklkeCA8IHNwYW5zLmxlbmd0aCAmJiBsaW5lSWR4ID09PSAwICYmIGNvbDAgPT09IDApIHtcbiAgICAgICAgZmlyc3RPZmZzZXRNYXBwZWQgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFwRmlyc3RPZmZzZXRJZk5lZWRlZCgpO1xuICAgICAgfVxuXG4gICAgICB3aGlsZSAoc3BhbklkeCA8IHNwYW5zLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBzcGFuID0gc3BhbnNbc3BhbklkeF0gITtcbiAgICAgICAgY29uc3Qgc291cmNlID0gc3Bhbi5zdGFydC5maWxlO1xuICAgICAgICBjb25zdCBzb3VyY2VMaW5lID0gc3Bhbi5zdGFydC5saW5lO1xuICAgICAgICBjb25zdCBzb3VyY2VDb2wgPSBzcGFuLnN0YXJ0LmNvbDtcbiAgICAgICAgbWFwLmFkZFNvdXJjZShzb3VyY2UudXJsLCBzb3VyY2UuY29udGVudClcbiAgICAgICAgICAgIC5hZGRNYXBwaW5nKGNvbDAsIHNvdXJjZS51cmwsIHNvdXJjZUxpbmUsIHNvdXJjZUNvbCk7XG5cbiAgICAgICAgY29sMCArPSBwYXJ0c1tzcGFuSWR4XS5sZW5ndGg7XG4gICAgICAgIHNwYW5JZHgrKztcblxuICAgICAgICAvLyBhc3NpZ24gcGFydHMgd2l0aG91dCBzcGFuIG9yIHRoZSBzYW1lIHNwYW4gdG8gdGhlIHByZXZpb3VzIHNlZ21lbnRcbiAgICAgICAgd2hpbGUgKHNwYW5JZHggPCBzcGFucy5sZW5ndGggJiYgKHNwYW4gPT09IHNwYW5zW3NwYW5JZHhdIHx8ICFzcGFuc1tzcGFuSWR4XSkpIHtcbiAgICAgICAgICBjb2wwICs9IHBhcnRzW3NwYW5JZHhdLmxlbmd0aDtcbiAgICAgICAgICBzcGFuSWR4Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtYXA7XG4gIH1cblxuICBzZXRQcmVhbWJsZUxpbmVDb3VudChjb3VudDogbnVtYmVyKSB7IHJldHVybiB0aGlzLl9wcmVhbWJsZUxpbmVDb3VudCA9IGNvdW50OyB9XG5cbiAgc3Bhbk9mKGxpbmU6IG51bWJlciwgY29sdW1uOiBudW1iZXIpOiBQYXJzZVNvdXJjZVNwYW58bnVsbCB7XG4gICAgY29uc3QgZW1pdHRlZExpbmUgPSB0aGlzLl9saW5lc1tsaW5lIC0gdGhpcy5fcHJlYW1ibGVMaW5lQ291bnRdO1xuICAgIGlmIChlbWl0dGVkTGluZSkge1xuICAgICAgbGV0IGNvbHVtbnNMZWZ0ID0gY29sdW1uIC0gX2NyZWF0ZUluZGVudChlbWl0dGVkTGluZS5pbmRlbnQpLmxlbmd0aDtcbiAgICAgIGZvciAobGV0IHBhcnRJbmRleCA9IDA7IHBhcnRJbmRleCA8IGVtaXR0ZWRMaW5lLnBhcnRzLmxlbmd0aDsgcGFydEluZGV4KyspIHtcbiAgICAgICAgY29uc3QgcGFydCA9IGVtaXR0ZWRMaW5lLnBhcnRzW3BhcnRJbmRleF07XG4gICAgICAgIGlmIChwYXJ0Lmxlbmd0aCA+IGNvbHVtbnNMZWZ0KSB7XG4gICAgICAgICAgcmV0dXJuIGVtaXR0ZWRMaW5lLnNyY1NwYW5zW3BhcnRJbmRleF07XG4gICAgICAgIH1cbiAgICAgICAgY29sdW1uc0xlZnQgLT0gcGFydC5sZW5ndGg7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXQgc291cmNlTGluZXMoKTogX0VtaXR0ZWRMaW5lW10ge1xuICAgIGlmICh0aGlzLl9saW5lcy5sZW5ndGggJiYgdGhpcy5fbGluZXNbdGhpcy5fbGluZXMubGVuZ3RoIC0gMV0ucGFydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbGluZXMuc2xpY2UoMCwgLTEpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fbGluZXM7XG4gIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RW1pdHRlclZpc2l0b3IgaW1wbGVtZW50cyBvLlN0YXRlbWVudFZpc2l0b3IsIG8uRXhwcmVzc2lvblZpc2l0b3Ige1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9lc2NhcGVEb2xsYXJJblN0cmluZ3M6IGJvb2xlYW4pIHt9XG5cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBzdG10LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgJzsnKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0UmV0dXJuU3RtdChzdG10OiBvLlJldHVyblN0YXRlbWVudCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChzdG10LCBgcmV0dXJuIGApO1xuICAgIHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgJzsnKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFic3RyYWN0IHZpc2l0Q2FzdEV4cHIoYXN0OiBvLkNhc3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgYWJzdHJhY3QgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueTtcblxuICB2aXNpdElmU3RtdChzdG10OiBvLklmU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChzdG10LCBgaWYgKGApO1xuICAgIHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChzdG10LCBgKSB7YCk7XG4gICAgY29uc3QgaGFzRWxzZUNhc2UgPSBzdG10LmZhbHNlQ2FzZSAhPSBudWxsICYmIHN0bXQuZmFsc2VDYXNlLmxlbmd0aCA+IDA7XG4gICAgaWYgKHN0bXQudHJ1ZUNhc2UubGVuZ3RoIDw9IDEgJiYgIWhhc0Vsc2VDYXNlKSB7XG4gICAgICBjdHgucHJpbnQoc3RtdCwgYCBgKTtcbiAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGN0eCk7XG4gICAgICBjdHgucmVtb3ZlRW1wdHlMYXN0TGluZSgpO1xuICAgICAgY3R4LnByaW50KHN0bXQsIGAgYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0eC5wcmludGxuKCk7XG4gICAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjdHgpO1xuICAgICAgY3R4LmRlY0luZGVudCgpO1xuICAgICAgaWYgKGhhc0Vsc2VDYXNlKSB7XG4gICAgICAgIGN0eC5wcmludGxuKHN0bXQsIGB9IGVsc2Uge2ApO1xuICAgICAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjdHgpO1xuICAgICAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgICB9XG4gICAgfVxuICAgIGN0eC5wcmludGxuKHN0bXQsIGB9YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhYnN0cmFjdCB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBvLlRyeUNhdGNoU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnk7XG5cbiAgdmlzaXRUaHJvd1N0bXQoc3RtdDogby5UaHJvd1N0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoc3RtdCwgYHRocm93IGApO1xuICAgIHN0bXQuZXJyb3IudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYDtgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdENvbW1lbnRTdG10KHN0bXQ6IG8uQ29tbWVudFN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBpZiAoc3RtdC5tdWx0aWxpbmUpIHtcbiAgICAgIGN0eC5wcmludGxuKHN0bXQsIGAvKiAke3N0bXQuY29tbWVudH0gKi9gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RtdC5jb21tZW50LnNwbGl0KCdcXG4nKS5mb3JFYWNoKChsaW5lKSA9PiB7IGN0eC5wcmludGxuKHN0bXQsIGAvLyAke2xpbmV9YCk7IH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEpTRG9jQ29tbWVudFN0bXQoc3RtdDogby5KU0RvY0NvbW1lbnRTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCkge1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGAvKiR7c3RtdC50b1N0cmluZygpfSovYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhYnN0cmFjdCB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IG8uRGVjbGFyZVZhclN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55O1xuXG4gIHZpc2l0V3JpdGVWYXJFeHByKGV4cHI6IG8uV3JpdGVWYXJFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbGluZVdhc0VtcHR5ID0gY3R4LmxpbmVJc0VtcHR5KCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKCcpO1xuICAgIH1cbiAgICBjdHgucHJpbnQoZXhwciwgYCR7ZXhwci5uYW1lfSA9IGApO1xuICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKScpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFdyaXRlS2V5RXhwcihleHByOiBvLldyaXRlS2V5RXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGxpbmVXYXNFbXB0eSA9IGN0eC5saW5lSXNFbXB0eSgpO1xuICAgIGlmICghbGluZVdhc0VtcHR5KSB7XG4gICAgICBjdHgucHJpbnQoZXhwciwgJygnKTtcbiAgICB9XG4gICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoZXhwciwgYFtgKTtcbiAgICBleHByLmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChleHByLCBgXSA9IGApO1xuICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKScpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFdyaXRlUHJvcEV4cHIoZXhwcjogby5Xcml0ZVByb3BFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbGluZVdhc0VtcHR5ID0gY3R4LmxpbmVJc0VtcHR5KCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKCcpO1xuICAgIH1cbiAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChleHByLCBgLiR7ZXhwci5uYW1lfSA9IGApO1xuICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKScpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEludm9rZU1ldGhvZEV4cHIoZXhwcjogby5JbnZva2VNZXRob2RFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBsZXQgbmFtZSA9IGV4cHIubmFtZTtcbiAgICBpZiAoZXhwci5idWlsdGluICE9IG51bGwpIHtcbiAgICAgIG5hbWUgPSB0aGlzLmdldEJ1aWx0aW5NZXRob2ROYW1lKGV4cHIuYnVpbHRpbik7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIC8vIHNvbWUgYnVpbHRpbnMganVzdCBtZWFuIHRvIHNraXAgdGhlIGNhbGwuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBjdHgucHJpbnQoZXhwciwgYC4ke25hbWV9KGApO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhleHByLmFyZ3MsIGN0eCwgYCxgKTtcbiAgICBjdHgucHJpbnQoZXhwciwgYClgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFic3RyYWN0IGdldEJ1aWx0aW5NZXRob2ROYW1lKG1ldGhvZDogby5CdWlsdGluTWV0aG9kKTogc3RyaW5nO1xuXG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKGV4cHI6IG8uSW52b2tlRnVuY3Rpb25FeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgZXhwci5mbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoZXhwciwgYChgKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwci5hcmdzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGV4cHIsIGApYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGVtaXR0ZXIgY2Fubm90IHZpc2l0IFdyYXBwZWROb2RlRXhwci4nKTtcbiAgfVxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogby5SZWFkVmFyRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGxldCB2YXJOYW1lID0gYXN0Lm5hbWUgITtcbiAgICBpZiAoYXN0LmJ1aWx0aW4gIT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChhc3QuYnVpbHRpbikge1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5TdXBlcjpcbiAgICAgICAgICB2YXJOYW1lID0gJ3N1cGVyJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuVGhpczpcbiAgICAgICAgICB2YXJOYW1lID0gJ3RoaXMnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaEVycm9yOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9FUlJPUl9WQVIubmFtZSAhO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaFN0YWNrOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9TVEFDS19WQVIubmFtZSAhO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsdGluIHZhcmlhYmxlICR7YXN0LmJ1aWx0aW59YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGN0eC5wcmludChhc3QsIHZhck5hbWUpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogby5JbnN0YW50aWF0ZUV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCBgbmV3IGApO1xuICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgYChgKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGN0eCwgJywnKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IG8uTGl0ZXJhbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgY3R4LnByaW50KGFzdCwgZXNjYXBlSWRlbnRpZmllcih2YWx1ZSwgdGhpcy5fZXNjYXBlRG9sbGFySW5TdHJpbmdzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0eC5wcmludChhc3QsIGAke3ZhbHVlfWApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFic3RyYWN0IHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogby5FeHRlcm5hbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55O1xuXG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByKGFzdDogby5Db25kaXRpb25hbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCBgKGApO1xuICAgIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgJz8gJyk7XG4gICAgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsICc6ICcpO1xuICAgIGFzdC5mYWxzZUNhc2UgIS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0Tm90RXhwcihhc3Q6IG8uTm90RXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChhc3QsICchJyk7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogby5Bc3NlcnROb3ROdWxsLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBhYnN0cmFjdCB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IG8uRnVuY3Rpb25FeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueTtcbiAgYWJzdHJhY3QgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IG8uRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY29udGV4dDogYW55KTogYW55O1xuXG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKGFzdDogby5CaW5hcnlPcGVyYXRvckV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBsZXQgb3BTdHI6IHN0cmluZztcbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkVxdWFsczpcbiAgICAgICAgb3BTdHIgPSAnPT0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5JZGVudGljYWw6XG4gICAgICAgIG9wU3RyID0gJz09PSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk5vdEVxdWFsczpcbiAgICAgICAgb3BTdHIgPSAnIT0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWw6XG4gICAgICAgIG9wU3RyID0gJyE9PSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkFuZDpcbiAgICAgICAgb3BTdHIgPSAnJiYnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5CaXR3aXNlQW5kOlxuICAgICAgICBvcFN0ciA9ICcmJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuT3I6XG4gICAgICAgIG9wU3RyID0gJ3x8JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuUGx1czpcbiAgICAgICAgb3BTdHIgPSAnKyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk1pbnVzOlxuICAgICAgICBvcFN0ciA9ICctJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuRGl2aWRlOlxuICAgICAgICBvcFN0ciA9ICcvJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHk6XG4gICAgICAgIG9wU3RyID0gJyonO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Nb2R1bG86XG4gICAgICAgIG9wU3RyID0gJyUnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Mb3dlcjpcbiAgICAgICAgb3BTdHIgPSAnPCc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzOlxuICAgICAgICBvcFN0ciA9ICc8PSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlcjpcbiAgICAgICAgb3BTdHIgPSAnPic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFsczpcbiAgICAgICAgb3BTdHIgPSAnPj0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBvcGVyYXRvciAke2FzdC5vcGVyYXRvcn1gKTtcbiAgICB9XG4gICAgaWYgKGFzdC5wYXJlbnMpIGN0eC5wcmludChhc3QsIGAoYCk7XG4gICAgYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgICR7b3BTdHJ9IGApO1xuICAgIGFzdC5yaHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKGFzdC5wYXJlbnMpIGN0eC5wcmludChhc3QsIGApYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IG8uUmVhZFByb3BFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGAuYCk7XG4gICAgY3R4LnByaW50KGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBvLlJlYWRLZXlFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGBbYCk7XG4gICAgYXN0LmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGBdYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogby5MaXRlcmFsQXJyYXlFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgYFtgKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGN0eCwgJywnKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgXWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBvLkxpdGVyYWxNYXBFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgYHtgKTtcbiAgICB0aGlzLnZpc2l0QWxsT2JqZWN0cyhlbnRyeSA9PiB7XG4gICAgICBjdHgucHJpbnQoYXN0LCBgJHtlc2NhcGVJZGVudGlmaWVyKGVudHJ5LmtleSwgdGhpcy5fZXNjYXBlRG9sbGFySW5TdHJpbmdzLCBlbnRyeS5xdW90ZWQpfTpgKTtcbiAgICAgIGVudHJ5LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH0sIGFzdC5lbnRyaWVzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGFzdCwgYH1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdENvbW1hRXhwcihhc3Q6IG8uQ29tbWFFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgJygnKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LnBhcnRzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGFzdCwgJyknKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEFsbEV4cHJlc3Npb25zKGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQsIHNlcGFyYXRvcjogc3RyaW5nKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMudmlzaXRBbGxPYmplY3RzKGV4cHIgPT4gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KSwgZXhwcmVzc2lvbnMsIGN0eCwgc2VwYXJhdG9yKTtcbiAgfVxuXG4gIHZpc2l0QWxsT2JqZWN0czxUPihcbiAgICAgIGhhbmRsZXI6ICh0OiBUKSA9PiB2b2lkLCBleHByZXNzaW9uczogVFtdLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCxcbiAgICAgIHNlcGFyYXRvcjogc3RyaW5nKTogdm9pZCB7XG4gICAgbGV0IGluY3JlbWVudGVkSW5kZW50ID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgIGlmIChjdHgubGluZUxlbmd0aCgpID4gODApIHtcbiAgICAgICAgICBjdHgucHJpbnQobnVsbCwgc2VwYXJhdG9yLCB0cnVlKTtcbiAgICAgICAgICBpZiAoIWluY3JlbWVudGVkSW5kZW50KSB7XG4gICAgICAgICAgICAvLyBjb250aW51YXRpb24gYXJlIG1hcmtlZCB3aXRoIGRvdWJsZSBpbmRlbnQuXG4gICAgICAgICAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgICAgICAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgICAgICAgICBpbmNyZW1lbnRlZEluZGVudCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGN0eC5wcmludChudWxsLCBzZXBhcmF0b3IsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaGFuZGxlcihleHByZXNzaW9uc1tpXSk7XG4gICAgfVxuICAgIGlmIChpbmNyZW1lbnRlZEluZGVudCkge1xuICAgICAgLy8gY29udGludWF0aW9uIGFyZSBtYXJrZWQgd2l0aCBkb3VibGUgaW5kZW50LlxuICAgICAgY3R4LmRlY0luZGVudCgpO1xuICAgICAgY3R4LmRlY0luZGVudCgpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0QWxsU3RhdGVtZW50cyhzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IHZvaWQge1xuICAgIHN0YXRlbWVudHMuZm9yRWFjaCgoc3RtdCkgPT4gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjdHgpKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlSWRlbnRpZmllcihcbiAgICBpbnB1dDogc3RyaW5nLCBlc2NhcGVEb2xsYXI6IGJvb2xlYW4sIGFsd2F5c1F1b3RlOiBib29sZWFuID0gdHJ1ZSk6IGFueSB7XG4gIGlmIChpbnB1dCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3QgYm9keSA9IGlucHV0LnJlcGxhY2UoX1NJTkdMRV9RVU9URV9FU0NBUEVfU1RSSU5HX1JFLCAoLi4ubWF0Y2g6IHN0cmluZ1tdKSA9PiB7XG4gICAgaWYgKG1hdGNoWzBdID09ICckJykge1xuICAgICAgcmV0dXJuIGVzY2FwZURvbGxhciA/ICdcXFxcJCcgOiAnJCc7XG4gICAgfSBlbHNlIGlmIChtYXRjaFswXSA9PSAnXFxuJykge1xuICAgICAgcmV0dXJuICdcXFxcbic7XG4gICAgfSBlbHNlIGlmIChtYXRjaFswXSA9PSAnXFxyJykge1xuICAgICAgcmV0dXJuICdcXFxccic7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBgXFxcXCR7bWF0Y2hbMF19YDtcbiAgICB9XG4gIH0pO1xuICBjb25zdCByZXF1aXJlc1F1b3RlcyA9IGFsd2F5c1F1b3RlIHx8ICFfTEVHQUxfSURFTlRJRklFUl9SRS50ZXN0KGJvZHkpO1xuICByZXR1cm4gcmVxdWlyZXNRdW90ZXMgPyBgJyR7Ym9keX0nYCA6IGJvZHk7XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVJbmRlbnQoY291bnQ6IG51bWJlcik6IHN0cmluZyB7XG4gIGxldCByZXMgPSAnJztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgcmVzICs9IF9JTkRFTlRfV0lUSDtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuIl19