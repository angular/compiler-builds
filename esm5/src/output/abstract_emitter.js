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
var /** @type {?} */ _SINGLE_QUOTE_ESCAPE_STRING_RE = /'|\\|\n|\r|\$/g;
var /** @type {?} */ _LEGAL_IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i;
var /** @type {?} */ _INDENT_WITH = '  ';
export var /** @type {?} */ CATCH_ERROR_VAR = o.variable('error', null, null);
export var /** @type {?} */ CATCH_STACK_VAR = o.variable('stack', null, null);
/**
 * @record
 */
export function OutputEmitter() { }
function OutputEmitter_tsickle_Closure_declarations() {
    /** @type {?} */
    OutputEmitter.prototype.emitStatements;
}
var _EmittedLine = /** @class */ (function () {
    function _EmittedLine(indent) {
        this.indent = indent;
        this.partsLength = 0;
        this.parts = [];
        this.srcSpans = [];
    }
    return _EmittedLine;
}());
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
var EmitterVisitorContext = /** @class */ (function () {
    function EmitterVisitorContext(_indent) {
        this._indent = _indent;
        this._classes = [];
        this._preambleLineCount = 0;
        this._lines = [new _EmittedLine(_indent)];
    }
    /**
     * @return {?}
     */
    EmitterVisitorContext.createRoot = /**
     * @return {?}
     */
    function () { return new EmitterVisitorContext(0); };
    Object.defineProperty(EmitterVisitorContext.prototype, "_currentLine", {
        get: /**
         * @return {?}
         */
        function () { return this._lines[this._lines.length - 1]; },
        enumerable: true,
        configurable: true
    });
    /**
     * @param {?=} from
     * @param {?=} lastPart
     * @return {?}
     */
    EmitterVisitorContext.prototype.println = /**
     * @param {?=} from
     * @param {?=} lastPart
     * @return {?}
     */
    function (from, lastPart) {
        if (lastPart === void 0) { lastPart = ''; }
        this.print(from || null, lastPart, true);
    };
    /**
     * @return {?}
     */
    EmitterVisitorContext.prototype.lineIsEmpty = /**
     * @return {?}
     */
    function () { return this._currentLine.parts.length === 0; };
    /**
     * @return {?}
     */
    EmitterVisitorContext.prototype.lineLength = /**
     * @return {?}
     */
    function () {
        return this._currentLine.indent * _INDENT_WITH.length + this._currentLine.partsLength;
    };
    /**
     * @param {?} from
     * @param {?} part
     * @param {?=} newLine
     * @return {?}
     */
    EmitterVisitorContext.prototype.print = /**
     * @param {?} from
     * @param {?} part
     * @param {?=} newLine
     * @return {?}
     */
    function (from, part, newLine) {
        if (newLine === void 0) { newLine = false; }
        if (part.length > 0) {
            this._currentLine.parts.push(part);
            this._currentLine.partsLength += part.length;
            this._currentLine.srcSpans.push(from && from.sourceSpan || null);
        }
        if (newLine) {
            this._lines.push(new _EmittedLine(this._indent));
        }
    };
    /**
     * @return {?}
     */
    EmitterVisitorContext.prototype.removeEmptyLastLine = /**
     * @return {?}
     */
    function () {
        if (this.lineIsEmpty()) {
            this._lines.pop();
        }
    };
    /**
     * @return {?}
     */
    EmitterVisitorContext.prototype.incIndent = /**
     * @return {?}
     */
    function () {
        this._indent++;
        if (this.lineIsEmpty()) {
            this._currentLine.indent = this._indent;
        }
    };
    /**
     * @return {?}
     */
    EmitterVisitorContext.prototype.decIndent = /**
     * @return {?}
     */
    function () {
        this._indent--;
        if (this.lineIsEmpty()) {
            this._currentLine.indent = this._indent;
        }
    };
    /**
     * @param {?} clazz
     * @return {?}
     */
    EmitterVisitorContext.prototype.pushClass = /**
     * @param {?} clazz
     * @return {?}
     */
    function (clazz) { this._classes.push(clazz); };
    /**
     * @return {?}
     */
    EmitterVisitorContext.prototype.popClass = /**
     * @return {?}
     */
    function () { return /** @type {?} */ ((this._classes.pop())); };
    Object.defineProperty(EmitterVisitorContext.prototype, "currentClass", {
        get: /**
         * @return {?}
         */
        function () {
            return this._classes.length > 0 ? this._classes[this._classes.length - 1] : null;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @return {?}
     */
    EmitterVisitorContext.prototype.toSource = /**
     * @return {?}
     */
    function () {
        return this.sourceLines
            .map(function (l) { return l.parts.length > 0 ? _createIndent(l.indent) + l.parts.join('') : ''; })
            .join('\n');
    };
    /**
     * @param {?} genFilePath
     * @param {?=} startsAtLine
     * @return {?}
     */
    EmitterVisitorContext.prototype.toSourceMapGenerator = /**
     * @param {?} genFilePath
     * @param {?=} startsAtLine
     * @return {?}
     */
    function (genFilePath, startsAtLine) {
        if (startsAtLine === void 0) { startsAtLine = 0; }
        var /** @type {?} */ map = new SourceMapGenerator(genFilePath);
        var /** @type {?} */ firstOffsetMapped = false;
        var /** @type {?} */ mapFirstOffsetIfNeeded = function () {
            if (!firstOffsetMapped) {
                // Add a single space so that tools won't try to load the file from disk.
                // Note: We are using virtual urls like `ng:///`, so we have to
                // provide a content here.
                map.addSource(genFilePath, ' ').addMapping(0, genFilePath, 0, 0);
                firstOffsetMapped = true;
            }
        };
        for (var /** @type {?} */ i = 0; i < startsAtLine; i++) {
            map.addLine();
            mapFirstOffsetIfNeeded();
        }
        this.sourceLines.forEach(function (line, lineIdx) {
            map.addLine();
            var /** @type {?} */ spans = line.srcSpans;
            var /** @type {?} */ parts = line.parts;
            var /** @type {?} */ col0 = line.indent * _INDENT_WITH.length;
            var /** @type {?} */ spanIdx = 0;
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
                var /** @type {?} */ span = /** @type {?} */ ((spans[spanIdx]));
                var /** @type {?} */ source = span.start.file;
                var /** @type {?} */ sourceLine = span.start.line;
                var /** @type {?} */ sourceCol = span.start.col;
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
    };
    /**
     * @param {?} count
     * @return {?}
     */
    EmitterVisitorContext.prototype.setPreambleLineCount = /**
     * @param {?} count
     * @return {?}
     */
    function (count) { return this._preambleLineCount = count; };
    /**
     * @param {?} line
     * @param {?} column
     * @return {?}
     */
    EmitterVisitorContext.prototype.spanOf = /**
     * @param {?} line
     * @param {?} column
     * @return {?}
     */
    function (line, column) {
        var /** @type {?} */ emittedLine = this._lines[line - this._preambleLineCount];
        if (emittedLine) {
            var /** @type {?} */ columnsLeft = column - _createIndent(emittedLine.indent).length;
            for (var /** @type {?} */ partIndex = 0; partIndex < emittedLine.parts.length; partIndex++) {
                var /** @type {?} */ part = emittedLine.parts[partIndex];
                if (part.length > columnsLeft) {
                    return emittedLine.srcSpans[partIndex];
                }
                columnsLeft -= part.length;
            }
        }
        return null;
    };
    Object.defineProperty(EmitterVisitorContext.prototype, "sourceLines", {
        get: /**
         * @return {?}
         */
        function () {
            if (this._lines.length && this._lines[this._lines.length - 1].parts.length === 0) {
                return this._lines.slice(0, -1);
            }
            return this._lines;
        },
        enumerable: true,
        configurable: true
    });
    return EmitterVisitorContext;
}());
export { EmitterVisitorContext };
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
var /**
 * @abstract
 */
AbstractEmitterVisitor = /** @class */ (function () {
    function AbstractEmitterVisitor(_escapeDollarInStrings) {
        this._escapeDollarInStrings = _escapeDollarInStrings;
    }
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitExpressionStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        stmt.expr.visitExpression(this, ctx);
        ctx.println(stmt, ';');
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitReturnStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        ctx.print(stmt, "return ");
        stmt.value.visitExpression(this, ctx);
        ctx.println(stmt, ';');
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitIfStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        ctx.print(stmt, "if (");
        stmt.condition.visitExpression(this, ctx);
        ctx.print(stmt, ") {");
        var /** @type {?} */ hasElseCase = stmt.falseCase != null && stmt.falseCase.length > 0;
        if (stmt.trueCase.length <= 1 && !hasElseCase) {
            ctx.print(stmt, " ");
            this.visitAllStatements(stmt.trueCase, ctx);
            ctx.removeEmptyLastLine();
            ctx.print(stmt, " ");
        }
        else {
            ctx.println();
            ctx.incIndent();
            this.visitAllStatements(stmt.trueCase, ctx);
            ctx.decIndent();
            if (hasElseCase) {
                ctx.println(stmt, "} else {");
                ctx.incIndent();
                this.visitAllStatements(stmt.falseCase, ctx);
                ctx.decIndent();
            }
        }
        ctx.println(stmt, "}");
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitThrowStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        ctx.print(stmt, "throw ");
        stmt.error.visitExpression(this, ctx);
        ctx.println(stmt, ";");
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitCommentStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        if (stmt.multiline) {
            ctx.println(stmt, "/* " + stmt.comment + " */");
        }
        else {
            stmt.comment.split('\n').forEach(function (line) { ctx.println(stmt, "// " + line); });
        }
        return null;
    };
    /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitJSDocCommentStmt = /**
     * @param {?} stmt
     * @param {?} ctx
     * @return {?}
     */
    function (stmt, ctx) {
        ctx.println(stmt, "/*" + stmt.toString() + "*/");
        return null;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitWriteVarExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        var /** @type {?} */ lineWasEmpty = ctx.lineIsEmpty();
        if (!lineWasEmpty) {
            ctx.print(expr, '(');
        }
        ctx.print(expr, expr.name + " = ");
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(expr, ')');
        }
        return null;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitWriteKeyExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        var /** @type {?} */ lineWasEmpty = ctx.lineIsEmpty();
        if (!lineWasEmpty) {
            ctx.print(expr, '(');
        }
        expr.receiver.visitExpression(this, ctx);
        ctx.print(expr, "[");
        expr.index.visitExpression(this, ctx);
        ctx.print(expr, "] = ");
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(expr, ')');
        }
        return null;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitWritePropExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        var /** @type {?} */ lineWasEmpty = ctx.lineIsEmpty();
        if (!lineWasEmpty) {
            ctx.print(expr, '(');
        }
        expr.receiver.visitExpression(this, ctx);
        ctx.print(expr, "." + expr.name + " = ");
        expr.value.visitExpression(this, ctx);
        if (!lineWasEmpty) {
            ctx.print(expr, ')');
        }
        return null;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitInvokeMethodExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        expr.receiver.visitExpression(this, ctx);
        var /** @type {?} */ name = expr.name;
        if (expr.builtin != null) {
            name = this.getBuiltinMethodName(expr.builtin);
            if (name == null) {
                // some builtins just mean to skip the call.
                return null;
            }
        }
        ctx.print(expr, "." + name + "(");
        this.visitAllExpressions(expr.args, ctx, ",");
        ctx.print(expr, ")");
        return null;
    };
    /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitInvokeFunctionExpr = /**
     * @param {?} expr
     * @param {?} ctx
     * @return {?}
     */
    function (expr, ctx) {
        expr.fn.visitExpression(this, ctx);
        ctx.print(expr, "(");
        this.visitAllExpressions(expr.args, ctx, ',');
        ctx.print(expr, ")");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitReadVarExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var /** @type {?} */ varName = /** @type {?} */ ((ast.name));
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
                    throw new Error("Unknown builtin variable " + ast.builtin);
            }
        }
        ctx.print(ast, varName);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitInstantiateExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ctx.print(ast, "new ");
        ast.classExpr.visitExpression(this, ctx);
        ctx.print(ast, "(");
        this.visitAllExpressions(ast.args, ctx, ',');
        ctx.print(ast, ")");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitLiteralExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var /** @type {?} */ value = ast.value;
        if (typeof value === 'string') {
            ctx.print(ast, escapeIdentifier(value, this._escapeDollarInStrings));
        }
        else {
            ctx.print(ast, "" + value);
        }
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitConditionalExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ctx.print(ast, "(");
        ast.condition.visitExpression(this, ctx);
        ctx.print(ast, '? ');
        ast.trueCase.visitExpression(this, ctx);
        ctx.print(ast, ': '); /** @type {?} */
        ((ast.falseCase)).visitExpression(this, ctx);
        ctx.print(ast, ")");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitNotExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ctx.print(ast, '!');
        ast.condition.visitExpression(this, ctx);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitAssertNotNullExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ast.condition.visitExpression(this, ctx);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitBinaryOperatorExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var /** @type {?} */ opStr;
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
                throw new Error("Unknown operator " + ast.operator);
        }
        ctx.print(ast, "(");
        ast.lhs.visitExpression(this, ctx);
        ctx.print(ast, " " + opStr + " ");
        ast.rhs.visitExpression(this, ctx);
        ctx.print(ast, ")");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitReadPropExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ast.receiver.visitExpression(this, ctx);
        ctx.print(ast, ".");
        ctx.print(ast, ast.name);
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitReadKeyExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ast.receiver.visitExpression(this, ctx);
        ctx.print(ast, "[");
        ast.index.visitExpression(this, ctx);
        ctx.print(ast, "]");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitLiteralArrayExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ctx.print(ast, "[");
        this.visitAllExpressions(ast.entries, ctx, ',');
        ctx.print(ast, "]");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitLiteralMapExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        var _this = this;
        ctx.print(ast, "{");
        this.visitAllObjects(function (entry) {
            ctx.print(ast, escapeIdentifier(entry.key, _this._escapeDollarInStrings, entry.quoted) + ":");
            entry.value.visitExpression(_this, ctx);
        }, ast.entries, ctx, ',');
        ctx.print(ast, "}");
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitCommaExpr = /**
     * @param {?} ast
     * @param {?} ctx
     * @return {?}
     */
    function (ast, ctx) {
        ctx.print(ast, '(');
        this.visitAllExpressions(ast.parts, ctx, ',');
        ctx.print(ast, ')');
        return null;
    };
    /**
     * @param {?} expressions
     * @param {?} ctx
     * @param {?} separator
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitAllExpressions = /**
     * @param {?} expressions
     * @param {?} ctx
     * @param {?} separator
     * @return {?}
     */
    function (expressions, ctx, separator) {
        var _this = this;
        this.visitAllObjects(function (expr) { return expr.visitExpression(_this, ctx); }, expressions, ctx, separator);
    };
    /**
     * @template T
     * @param {?} handler
     * @param {?} expressions
     * @param {?} ctx
     * @param {?} separator
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitAllObjects = /**
     * @template T
     * @param {?} handler
     * @param {?} expressions
     * @param {?} ctx
     * @param {?} separator
     * @return {?}
     */
    function (handler, expressions, ctx, separator) {
        var /** @type {?} */ incrementedIndent = false;
        for (var /** @type {?} */ i = 0; i < expressions.length; i++) {
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
    };
    /**
     * @param {?} statements
     * @param {?} ctx
     * @return {?}
     */
    AbstractEmitterVisitor.prototype.visitAllStatements = /**
     * @param {?} statements
     * @param {?} ctx
     * @return {?}
     */
    function (statements, ctx) {
        var _this = this;
        statements.forEach(function (stmt) { return stmt.visitStatement(_this, ctx); });
    };
    return AbstractEmitterVisitor;
}());
/**
 * @abstract
 */
export { AbstractEmitterVisitor };
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
export function escapeIdentifier(input, escapeDollar, alwaysQuote) {
    if (alwaysQuote === void 0) { alwaysQuote = true; }
    if (input == null) {
        return null;
    }
    var /** @type {?} */ body = input.replace(_SINGLE_QUOTE_ESCAPE_STRING_RE, function () {
        var match = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            match[_i] = arguments[_i];
        }
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
            return "\\" + match[0];
        }
    });
    var /** @type {?} */ requiresQuotes = alwaysQuote || !_LEGAL_IDENTIFIER_RE.test(body);
    return requiresQuotes ? "'" + body + "'" : body;
}
/**
 * @param {?} count
 * @return {?}
 */
function _createIndent(count) {
    var /** @type {?} */ res = '';
    for (var /** @type {?} */ i = 0; i < count; i++) {
        res += _INDENT_WITH;
    }
    return res;
}
//# sourceMappingURL=abstract_emitter.js.map