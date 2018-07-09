/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/output/abstract_emitter", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/source_map"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var o = require("@angular/compiler/src/output/output_ast");
    var source_map_1 = require("@angular/compiler/src/output/source_map");
    var _SINGLE_QUOTE_ESCAPE_STRING_RE = /'|\\|\n|\r|\$/g;
    var _LEGAL_IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i;
    var _INDENT_WITH = '  ';
    exports.CATCH_ERROR_VAR = o.variable('error', null, null);
    exports.CATCH_STACK_VAR = o.variable('stack', null, null);
    var _EmittedLine = /** @class */ (function () {
        function _EmittedLine(indent) {
            this.indent = indent;
            this.partsLength = 0;
            this.parts = [];
            this.srcSpans = [];
        }
        return _EmittedLine;
    }());
    var EmitterVisitorContext = /** @class */ (function () {
        function EmitterVisitorContext(_indent) {
            this._indent = _indent;
            this._classes = [];
            this._preambleLineCount = 0;
            this._lines = [new _EmittedLine(_indent)];
        }
        EmitterVisitorContext.createRoot = function () { return new EmitterVisitorContext(0); };
        Object.defineProperty(EmitterVisitorContext.prototype, "_currentLine", {
            get: function () { return this._lines[this._lines.length - 1]; },
            enumerable: true,
            configurable: true
        });
        EmitterVisitorContext.prototype.println = function (from, lastPart) {
            if (lastPart === void 0) { lastPart = ''; }
            this.print(from || null, lastPart, true);
        };
        EmitterVisitorContext.prototype.lineIsEmpty = function () { return this._currentLine.parts.length === 0; };
        EmitterVisitorContext.prototype.lineLength = function () {
            return this._currentLine.indent * _INDENT_WITH.length + this._currentLine.partsLength;
        };
        EmitterVisitorContext.prototype.print = function (from, part, newLine) {
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
        EmitterVisitorContext.prototype.removeEmptyLastLine = function () {
            if (this.lineIsEmpty()) {
                this._lines.pop();
            }
        };
        EmitterVisitorContext.prototype.incIndent = function () {
            this._indent++;
            if (this.lineIsEmpty()) {
                this._currentLine.indent = this._indent;
            }
        };
        EmitterVisitorContext.prototype.decIndent = function () {
            this._indent--;
            if (this.lineIsEmpty()) {
                this._currentLine.indent = this._indent;
            }
        };
        EmitterVisitorContext.prototype.pushClass = function (clazz) { this._classes.push(clazz); };
        EmitterVisitorContext.prototype.popClass = function () { return this._classes.pop(); };
        Object.defineProperty(EmitterVisitorContext.prototype, "currentClass", {
            get: function () {
                return this._classes.length > 0 ? this._classes[this._classes.length - 1] : null;
            },
            enumerable: true,
            configurable: true
        });
        EmitterVisitorContext.prototype.toSource = function () {
            return this.sourceLines
                .map(function (l) { return l.parts.length > 0 ? _createIndent(l.indent) + l.parts.join('') : ''; })
                .join('\n');
        };
        EmitterVisitorContext.prototype.toSourceMapGenerator = function (genFilePath, startsAtLine) {
            if (startsAtLine === void 0) { startsAtLine = 0; }
            var map = new source_map_1.SourceMapGenerator(genFilePath);
            var firstOffsetMapped = false;
            var mapFirstOffsetIfNeeded = function () {
                if (!firstOffsetMapped) {
                    // Add a single space so that tools won't try to load the file from disk.
                    // Note: We are using virtual urls like `ng:///`, so we have to
                    // provide a content here.
                    map.addSource(genFilePath, ' ').addMapping(0, genFilePath, 0, 0);
                    firstOffsetMapped = true;
                }
            };
            for (var i = 0; i < startsAtLine; i++) {
                map.addLine();
                mapFirstOffsetIfNeeded();
            }
            this.sourceLines.forEach(function (line, lineIdx) {
                map.addLine();
                var spans = line.srcSpans;
                var parts = line.parts;
                var col0 = line.indent * _INDENT_WITH.length;
                var spanIdx = 0;
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
                    var span = spans[spanIdx];
                    var source = span.start.file;
                    var sourceLine = span.start.line;
                    var sourceCol = span.start.col;
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
        EmitterVisitorContext.prototype.setPreambleLineCount = function (count) { return this._preambleLineCount = count; };
        EmitterVisitorContext.prototype.spanOf = function (line, column) {
            var emittedLine = this._lines[line - this._preambleLineCount];
            if (emittedLine) {
                var columnsLeft = column - _createIndent(emittedLine.indent).length;
                for (var partIndex = 0; partIndex < emittedLine.parts.length; partIndex++) {
                    var part = emittedLine.parts[partIndex];
                    if (part.length > columnsLeft) {
                        return emittedLine.srcSpans[partIndex];
                    }
                    columnsLeft -= part.length;
                }
            }
            return null;
        };
        Object.defineProperty(EmitterVisitorContext.prototype, "sourceLines", {
            get: function () {
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
    exports.EmitterVisitorContext = EmitterVisitorContext;
    var AbstractEmitterVisitor = /** @class */ (function () {
        function AbstractEmitterVisitor(_escapeDollarInStrings) {
            this._escapeDollarInStrings = _escapeDollarInStrings;
        }
        AbstractEmitterVisitor.prototype.visitExpressionStmt = function (stmt, ctx) {
            stmt.expr.visitExpression(this, ctx);
            ctx.println(stmt, ';');
            return null;
        };
        AbstractEmitterVisitor.prototype.visitReturnStmt = function (stmt, ctx) {
            ctx.print(stmt, "return ");
            stmt.value.visitExpression(this, ctx);
            ctx.println(stmt, ';');
            return null;
        };
        AbstractEmitterVisitor.prototype.visitIfStmt = function (stmt, ctx) {
            ctx.print(stmt, "if (");
            stmt.condition.visitExpression(this, ctx);
            ctx.print(stmt, ") {");
            var hasElseCase = stmt.falseCase != null && stmt.falseCase.length > 0;
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
        AbstractEmitterVisitor.prototype.visitThrowStmt = function (stmt, ctx) {
            ctx.print(stmt, "throw ");
            stmt.error.visitExpression(this, ctx);
            ctx.println(stmt, ";");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitCommentStmt = function (stmt, ctx) {
            if (stmt.multiline) {
                ctx.println(stmt, "/* " + stmt.comment + " */");
            }
            else {
                stmt.comment.split('\n').forEach(function (line) { ctx.println(stmt, "// " + line); });
            }
            return null;
        };
        AbstractEmitterVisitor.prototype.visitJSDocCommentStmt = function (stmt, ctx) {
            ctx.println(stmt, "/*" + stmt.toString() + "*/");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitWriteVarExpr = function (expr, ctx) {
            var lineWasEmpty = ctx.lineIsEmpty();
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
        AbstractEmitterVisitor.prototype.visitWriteKeyExpr = function (expr, ctx) {
            var lineWasEmpty = ctx.lineIsEmpty();
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
        AbstractEmitterVisitor.prototype.visitWritePropExpr = function (expr, ctx) {
            var lineWasEmpty = ctx.lineIsEmpty();
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
        AbstractEmitterVisitor.prototype.visitInvokeMethodExpr = function (expr, ctx) {
            expr.receiver.visitExpression(this, ctx);
            var name = expr.name;
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
        AbstractEmitterVisitor.prototype.visitInvokeFunctionExpr = function (expr, ctx) {
            expr.fn.visitExpression(this, ctx);
            ctx.print(expr, "(");
            this.visitAllExpressions(expr.args, ctx, ',');
            ctx.print(expr, ")");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitWrappedNodeExpr = function (ast, ctx) {
            throw new Error('Abstract emitter cannot visit WrappedNodeExpr.');
        };
        AbstractEmitterVisitor.prototype.visitReadVarExpr = function (ast, ctx) {
            var varName = ast.name;
            if (ast.builtin != null) {
                switch (ast.builtin) {
                    case o.BuiltinVar.Super:
                        varName = 'super';
                        break;
                    case o.BuiltinVar.This:
                        varName = 'this';
                        break;
                    case o.BuiltinVar.CatchError:
                        varName = exports.CATCH_ERROR_VAR.name;
                        break;
                    case o.BuiltinVar.CatchStack:
                        varName = exports.CATCH_STACK_VAR.name;
                        break;
                    default:
                        throw new Error("Unknown builtin variable " + ast.builtin);
                }
            }
            ctx.print(ast, varName);
            return null;
        };
        AbstractEmitterVisitor.prototype.visitInstantiateExpr = function (ast, ctx) {
            ctx.print(ast, "new ");
            ast.classExpr.visitExpression(this, ctx);
            ctx.print(ast, "(");
            this.visitAllExpressions(ast.args, ctx, ',');
            ctx.print(ast, ")");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitLiteralExpr = function (ast, ctx) {
            var value = ast.value;
            if (typeof value === 'string') {
                ctx.print(ast, escapeIdentifier(value, this._escapeDollarInStrings));
            }
            else {
                ctx.print(ast, "" + value);
            }
            return null;
        };
        AbstractEmitterVisitor.prototype.visitConditionalExpr = function (ast, ctx) {
            ctx.print(ast, "(");
            ast.condition.visitExpression(this, ctx);
            ctx.print(ast, '? ');
            ast.trueCase.visitExpression(this, ctx);
            ctx.print(ast, ': ');
            ast.falseCase.visitExpression(this, ctx);
            ctx.print(ast, ")");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitNotExpr = function (ast, ctx) {
            ctx.print(ast, '!');
            ast.condition.visitExpression(this, ctx);
            return null;
        };
        AbstractEmitterVisitor.prototype.visitAssertNotNullExpr = function (ast, ctx) {
            ast.condition.visitExpression(this, ctx);
            return null;
        };
        AbstractEmitterVisitor.prototype.visitBinaryOperatorExpr = function (ast, ctx) {
            var opStr;
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
                    throw new Error("Unknown operator " + ast.operator);
            }
            if (ast.parens)
                ctx.print(ast, "(");
            ast.lhs.visitExpression(this, ctx);
            ctx.print(ast, " " + opStr + " ");
            ast.rhs.visitExpression(this, ctx);
            if (ast.parens)
                ctx.print(ast, ")");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitReadPropExpr = function (ast, ctx) {
            ast.receiver.visitExpression(this, ctx);
            ctx.print(ast, ".");
            ctx.print(ast, ast.name);
            return null;
        };
        AbstractEmitterVisitor.prototype.visitReadKeyExpr = function (ast, ctx) {
            ast.receiver.visitExpression(this, ctx);
            ctx.print(ast, "[");
            ast.index.visitExpression(this, ctx);
            ctx.print(ast, "]");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitLiteralArrayExpr = function (ast, ctx) {
            ctx.print(ast, "[");
            this.visitAllExpressions(ast.entries, ctx, ',');
            ctx.print(ast, "]");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitLiteralMapExpr = function (ast, ctx) {
            var _this = this;
            ctx.print(ast, "{");
            this.visitAllObjects(function (entry) {
                ctx.print(ast, escapeIdentifier(entry.key, _this._escapeDollarInStrings, entry.quoted) + ":");
                entry.value.visitExpression(_this, ctx);
            }, ast.entries, ctx, ',');
            ctx.print(ast, "}");
            return null;
        };
        AbstractEmitterVisitor.prototype.visitCommaExpr = function (ast, ctx) {
            ctx.print(ast, '(');
            this.visitAllExpressions(ast.parts, ctx, ',');
            ctx.print(ast, ')');
            return null;
        };
        AbstractEmitterVisitor.prototype.visitAllExpressions = function (expressions, ctx, separator) {
            var _this = this;
            this.visitAllObjects(function (expr) { return expr.visitExpression(_this, ctx); }, expressions, ctx, separator);
        };
        AbstractEmitterVisitor.prototype.visitAllObjects = function (handler, expressions, ctx, separator) {
            var incrementedIndent = false;
            for (var i = 0; i < expressions.length; i++) {
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
        AbstractEmitterVisitor.prototype.visitAllStatements = function (statements, ctx) {
            var _this = this;
            statements.forEach(function (stmt) { return stmt.visitStatement(_this, ctx); });
        };
        return AbstractEmitterVisitor;
    }());
    exports.AbstractEmitterVisitor = AbstractEmitterVisitor;
    function escapeIdentifier(input, escapeDollar, alwaysQuote) {
        if (alwaysQuote === void 0) { alwaysQuote = true; }
        if (input == null) {
            return null;
        }
        var body = input.replace(_SINGLE_QUOTE_ESCAPE_STRING_RE, function () {
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
        var requiresQuotes = alwaysQuote || !_LEGAL_IDENTIFIER_RE.test(body);
        return requiresQuotes ? "'" + body + "'" : body;
    }
    exports.escapeIdentifier = escapeIdentifier;
    function _createIndent(count) {
        var res = '';
        for (var i = 0; i < count; i++) {
            res += _INDENT_WITH;
        }
        return res;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvYWJzdHJhY3RfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUlILDJEQUFrQztJQUNsQyxzRUFBZ0Q7SUFFaEQsSUFBTSw4QkFBOEIsR0FBRyxnQkFBZ0IsQ0FBQztJQUN4RCxJQUFNLG9CQUFvQixHQUFHLHVCQUF1QixDQUFDO0lBQ3JELElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQztJQUNiLFFBQUEsZUFBZSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNsRCxRQUFBLGVBQWUsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFNL0Q7UUFJRSxzQkFBbUIsTUFBYztZQUFkLFdBQU0sR0FBTixNQUFNLENBQVE7WUFIakMsZ0JBQVcsR0FBRyxDQUFDLENBQUM7WUFDaEIsVUFBSyxHQUFhLEVBQUUsQ0FBQztZQUNyQixhQUFRLEdBQTZCLEVBQUUsQ0FBQztRQUNKLENBQUM7UUFDdkMsbUJBQUM7SUFBRCxDQUFDLEFBTEQsSUFLQztJQUVEO1FBT0UsK0JBQW9CLE9BQWU7WUFBZixZQUFPLEdBQVAsT0FBTyxDQUFRO1lBSDNCLGFBQVEsR0FBa0IsRUFBRSxDQUFDO1lBQzdCLHVCQUFrQixHQUFHLENBQUMsQ0FBQztZQUVRLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQUMsQ0FBQztRQU41RSxnQ0FBVSxHQUFqQixjQUE2QyxPQUFPLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBUW5GLHNCQUFZLCtD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QUU7Z0JBQzNCLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7aUJBQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxFQUFFO2dCQUMzQixPQUFPLEtBQUssQ0FBQzthQUNkO2lCQUFNO2dCQUNMLE9BQU8sT0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFHLENBQUM7YUFDeEI7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNILElBQU0sY0FBYyxHQUFHLFdBQVcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RSxPQUFPLGNBQWMsQ0FBQyxDQUFDLENBQUMsTUFBSSxJQUFJLE1BQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQzdDLENBQUM7SUFsQkQsNENBa0JDO0lBRUQsdUJBQXVCLEtBQWE7UUFDbEMsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO1FBQ2IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM5QixHQUFHLElBQUksWUFBWSxDQUFDO1NBQ3JCO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXRfYXN0JztcbmltcG9ydCB7U291cmNlTWFwR2VuZXJhdG9yfSBmcm9tICcuL3NvdXJjZV9tYXAnO1xuXG5jb25zdCBfU0lOR0xFX1FVT1RFX0VTQ0FQRV9TVFJJTkdfUkUgPSAvJ3xcXFxcfFxcbnxcXHJ8XFwkL2c7XG5jb25zdCBfTEVHQUxfSURFTlRJRklFUl9SRSA9IC9eWyRBLVpfXVswLTlBLVpfJF0qJC9pO1xuY29uc3QgX0lOREVOVF9XSVRIID0gJyAgJztcbmV4cG9ydCBjb25zdCBDQVRDSF9FUlJPUl9WQVIgPSBvLnZhcmlhYmxlKCdlcnJvcicsIG51bGwsIG51bGwpO1xuZXhwb3J0IGNvbnN0IENBVENIX1NUQUNLX1ZBUiA9IG8udmFyaWFibGUoJ3N0YWNrJywgbnVsbCwgbnVsbCk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3V0cHV0RW1pdHRlciB7XG4gIGVtaXRTdGF0ZW1lbnRzKGdlbkZpbGVQYXRoOiBzdHJpbmcsIHN0bXRzOiBvLlN0YXRlbWVudFtdLCBwcmVhbWJsZT86IHN0cmluZ3xudWxsKTogc3RyaW5nO1xufVxuXG5jbGFzcyBfRW1pdHRlZExpbmUge1xuICBwYXJ0c0xlbmd0aCA9IDA7XG4gIHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICBzcmNTcGFuczogKFBhcnNlU291cmNlU3BhbnxudWxsKVtdID0gW107XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBpbmRlbnQ6IG51bWJlcikge31cbn1cblxuZXhwb3J0IGNsYXNzIEVtaXR0ZXJWaXNpdG9yQ29udGV4dCB7XG4gIHN0YXRpYyBjcmVhdGVSb290KCk6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCB7IHJldHVybiBuZXcgRW1pdHRlclZpc2l0b3JDb250ZXh0KDApOyB9XG5cbiAgcHJpdmF0ZSBfbGluZXM6IF9FbWl0dGVkTGluZVtdO1xuICBwcml2YXRlIF9jbGFzc2VzOiBvLkNsYXNzU3RtdFtdID0gW107XG4gIHByaXZhdGUgX3ByZWFtYmxlTGluZUNvdW50ID0gMDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9pbmRlbnQ6IG51bWJlcikgeyB0aGlzLl9saW5lcyA9IFtuZXcgX0VtaXR0ZWRMaW5lKF9pbmRlbnQpXTsgfVxuXG4gIHByaXZhdGUgZ2V0IF9jdXJyZW50TGluZSgpOiBfRW1pdHRlZExpbmUgeyByZXR1cm4gdGhpcy5fbGluZXNbdGhpcy5fbGluZXMubGVuZ3RoIC0gMV07IH1cblxuICBwcmludGxuKGZyb20/OiB7c291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbH18bnVsbCwgbGFzdFBhcnQ6IHN0cmluZyA9ICcnKTogdm9pZCB7XG4gICAgdGhpcy5wcmludChmcm9tIHx8IG51bGwsIGxhc3RQYXJ0LCB0cnVlKTtcbiAgfVxuXG4gIGxpbmVJc0VtcHR5KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fY3VycmVudExpbmUucGFydHMubGVuZ3RoID09PSAwOyB9XG5cbiAgbGluZUxlbmd0aCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl9jdXJyZW50TGluZS5pbmRlbnQgKiBfSU5ERU5UX1dJVEgubGVuZ3RoICsgdGhpcy5fY3VycmVudExpbmUucGFydHNMZW5ndGg7XG4gIH1cblxuICBwcmludChmcm9tOiB7c291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbH18bnVsbCwgcGFydDogc3RyaW5nLCBuZXdMaW5lOiBib29sZWFuID0gZmFsc2UpIHtcbiAgICBpZiAocGFydC5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TGluZS5wYXJ0cy5wdXNoKHBhcnQpO1xuICAgICAgdGhpcy5fY3VycmVudExpbmUucGFydHNMZW5ndGggKz0gcGFydC5sZW5ndGg7XG4gICAgICB0aGlzLl9jdXJyZW50TGluZS5zcmNTcGFucy5wdXNoKGZyb20gJiYgZnJvbS5zb3VyY2VTcGFuIHx8IG51bGwpO1xuICAgIH1cbiAgICBpZiAobmV3TGluZSkge1xuICAgICAgdGhpcy5fbGluZXMucHVzaChuZXcgX0VtaXR0ZWRMaW5lKHRoaXMuX2luZGVudCkpO1xuICAgIH1cbiAgfVxuXG4gIHJlbW92ZUVtcHR5TGFzdExpbmUoKSB7XG4gICAgaWYgKHRoaXMubGluZUlzRW1wdHkoKSkge1xuICAgICAgdGhpcy5fbGluZXMucG9wKCk7XG4gICAgfVxuICB9XG5cbiAgaW5jSW5kZW50KCkge1xuICAgIHRoaXMuX2luZGVudCsrO1xuICAgIGlmICh0aGlzLmxpbmVJc0VtcHR5KCkpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRMaW5lLmluZGVudCA9IHRoaXMuX2luZGVudDtcbiAgICB9XG4gIH1cblxuICBkZWNJbmRlbnQoKSB7XG4gICAgdGhpcy5faW5kZW50LS07XG4gICAgaWYgKHRoaXMubGluZUlzRW1wdHkoKSkge1xuICAgICAgdGhpcy5fY3VycmVudExpbmUuaW5kZW50ID0gdGhpcy5faW5kZW50O1xuICAgIH1cbiAgfVxuXG4gIHB1c2hDbGFzcyhjbGF6ejogby5DbGFzc1N0bXQpIHsgdGhpcy5fY2xhc3Nlcy5wdXNoKGNsYXp6KTsgfVxuXG4gIHBvcENsYXNzKCk6IG8uQ2xhc3NTdG10IHsgcmV0dXJuIHRoaXMuX2NsYXNzZXMucG9wKCkgITsgfVxuXG4gIGdldCBjdXJyZW50Q2xhc3MoKTogby5DbGFzc1N0bXR8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzZXMubGVuZ3RoID4gMCA/IHRoaXMuX2NsYXNzZXNbdGhpcy5fY2xhc3Nlcy5sZW5ndGggLSAxXSA6IG51bGw7XG4gIH1cblxuICB0b1NvdXJjZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnNvdXJjZUxpbmVzXG4gICAgICAgIC5tYXAobCA9PiBsLnBhcnRzLmxlbmd0aCA+IDAgPyBfY3JlYXRlSW5kZW50KGwuaW5kZW50KSArIGwucGFydHMuam9pbignJykgOiAnJylcbiAgICAgICAgLmpvaW4oJ1xcbicpO1xuICB9XG5cbiAgdG9Tb3VyY2VNYXBHZW5lcmF0b3IoZ2VuRmlsZVBhdGg6IHN0cmluZywgc3RhcnRzQXRMaW5lOiBudW1iZXIgPSAwKTogU291cmNlTWFwR2VuZXJhdG9yIHtcbiAgICBjb25zdCBtYXAgPSBuZXcgU291cmNlTWFwR2VuZXJhdG9yKGdlbkZpbGVQYXRoKTtcblxuICAgIGxldCBmaXJzdE9mZnNldE1hcHBlZCA9IGZhbHNlO1xuICAgIGNvbnN0IG1hcEZpcnN0T2Zmc2V0SWZOZWVkZWQgPSAoKSA9PiB7XG4gICAgICBpZiAoIWZpcnN0T2Zmc2V0TWFwcGVkKSB7XG4gICAgICAgIC8vIEFkZCBhIHNpbmdsZSBzcGFjZSBzbyB0aGF0IHRvb2xzIHdvbid0IHRyeSB0byBsb2FkIHRoZSBmaWxlIGZyb20gZGlzay5cbiAgICAgICAgLy8gTm90ZTogV2UgYXJlIHVzaW5nIHZpcnR1YWwgdXJscyBsaWtlIGBuZzovLy9gLCBzbyB3ZSBoYXZlIHRvXG4gICAgICAgIC8vIHByb3ZpZGUgYSBjb250ZW50IGhlcmUuXG4gICAgICAgIG1hcC5hZGRTb3VyY2UoZ2VuRmlsZVBhdGgsICcgJykuYWRkTWFwcGluZygwLCBnZW5GaWxlUGF0aCwgMCwgMCk7XG4gICAgICAgIGZpcnN0T2Zmc2V0TWFwcGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFydHNBdExpbmU7IGkrKykge1xuICAgICAgbWFwLmFkZExpbmUoKTtcbiAgICAgIG1hcEZpcnN0T2Zmc2V0SWZOZWVkZWQoKTtcbiAgICB9XG5cbiAgICB0aGlzLnNvdXJjZUxpbmVzLmZvckVhY2goKGxpbmUsIGxpbmVJZHgpID0+IHtcbiAgICAgIG1hcC5hZGRMaW5lKCk7XG5cbiAgICAgIGNvbnN0IHNwYW5zID0gbGluZS5zcmNTcGFucztcbiAgICAgIGNvbnN0IHBhcnRzID0gbGluZS5wYXJ0cztcbiAgICAgIGxldCBjb2wwID0gbGluZS5pbmRlbnQgKiBfSU5ERU5UX1dJVEgubGVuZ3RoO1xuICAgICAgbGV0IHNwYW5JZHggPSAwO1xuICAgICAgLy8gc2tpcCBsZWFkaW5nIHBhcnRzIHdpdGhvdXQgc291cmNlIHNwYW5zXG4gICAgICB3aGlsZSAoc3BhbklkeCA8IHNwYW5zLmxlbmd0aCAmJiAhc3BhbnNbc3BhbklkeF0pIHtcbiAgICAgICAgY29sMCArPSBwYXJ0c1tzcGFuSWR4XS5sZW5ndGg7XG4gICAgICAgIHNwYW5JZHgrKztcbiAgICAgIH1cbiAgICAgIGlmIChzcGFuSWR4IDwgc3BhbnMubGVuZ3RoICYmIGxpbmVJZHggPT09IDAgJiYgY29sMCA9PT0gMCkge1xuICAgICAgICBmaXJzdE9mZnNldE1hcHBlZCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtYXBGaXJzdE9mZnNldElmTmVlZGVkKCk7XG4gICAgICB9XG5cbiAgICAgIHdoaWxlIChzcGFuSWR4IDwgc3BhbnMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IHNwYW4gPSBzcGFuc1tzcGFuSWR4XSAhO1xuICAgICAgICBjb25zdCBzb3VyY2UgPSBzcGFuLnN0YXJ0LmZpbGU7XG4gICAgICAgIGNvbnN0IHNvdXJjZUxpbmUgPSBzcGFuLnN0YXJ0LmxpbmU7XG4gICAgICAgIGNvbnN0IHNvdXJjZUNvbCA9IHNwYW4uc3RhcnQuY29sO1xuICAgICAgICBtYXAuYWRkU291cmNlKHNvdXJjZS51cmwsIHNvdXJjZS5jb250ZW50KVxuICAgICAgICAgICAgLmFkZE1hcHBpbmcoY29sMCwgc291cmNlLnVybCwgc291cmNlTGluZSwgc291cmNlQ29sKTtcblxuICAgICAgICBjb2wwICs9IHBhcnRzW3NwYW5JZHhdLmxlbmd0aDtcbiAgICAgICAgc3BhbklkeCsrO1xuXG4gICAgICAgIC8vIGFzc2lnbiBwYXJ0cyB3aXRob3V0IHNwYW4gb3IgdGhlIHNhbWUgc3BhbiB0byB0aGUgcHJldmlvdXMgc2VnbWVudFxuICAgICAgICB3aGlsZSAoc3BhbklkeCA8IHNwYW5zLmxlbmd0aCAmJiAoc3BhbiA9PT0gc3BhbnNbc3BhbklkeF0gfHwgIXNwYW5zW3NwYW5JZHhdKSkge1xuICAgICAgICAgIGNvbDAgKz0gcGFydHNbc3BhbklkeF0ubGVuZ3RoO1xuICAgICAgICAgIHNwYW5JZHgrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1hcDtcbiAgfVxuXG4gIHNldFByZWFtYmxlTGluZUNvdW50KGNvdW50OiBudW1iZXIpIHsgcmV0dXJuIHRoaXMuX3ByZWFtYmxlTGluZUNvdW50ID0gY291bnQ7IH1cblxuICBzcGFuT2YobGluZTogbnVtYmVyLCBjb2x1bW46IG51bWJlcik6IFBhcnNlU291cmNlU3BhbnxudWxsIHtcbiAgICBjb25zdCBlbWl0dGVkTGluZSA9IHRoaXMuX2xpbmVzW2xpbmUgLSB0aGlzLl9wcmVhbWJsZUxpbmVDb3VudF07XG4gICAgaWYgKGVtaXR0ZWRMaW5lKSB7XG4gICAgICBsZXQgY29sdW1uc0xlZnQgPSBjb2x1bW4gLSBfY3JlYXRlSW5kZW50KGVtaXR0ZWRMaW5lLmluZGVudCkubGVuZ3RoO1xuICAgICAgZm9yIChsZXQgcGFydEluZGV4ID0gMDsgcGFydEluZGV4IDwgZW1pdHRlZExpbmUucGFydHMubGVuZ3RoOyBwYXJ0SW5kZXgrKykge1xuICAgICAgICBjb25zdCBwYXJ0ID0gZW1pdHRlZExpbmUucGFydHNbcGFydEluZGV4XTtcbiAgICAgICAgaWYgKHBhcnQubGVuZ3RoID4gY29sdW1uc0xlZnQpIHtcbiAgICAgICAgICByZXR1cm4gZW1pdHRlZExpbmUuc3JjU3BhbnNbcGFydEluZGV4XTtcbiAgICAgICAgfVxuICAgICAgICBjb2x1bW5zTGVmdCAtPSBwYXJ0Lmxlbmd0aDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGdldCBzb3VyY2VMaW5lcygpOiBfRW1pdHRlZExpbmVbXSB7XG4gICAgaWYgKHRoaXMuX2xpbmVzLmxlbmd0aCAmJiB0aGlzLl9saW5lc1t0aGlzLl9saW5lcy5sZW5ndGggLSAxXS5wYXJ0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGlzLl9saW5lcy5zbGljZSgwLCAtMSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9saW5lcztcbiAgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RFbWl0dGVyVmlzaXRvciBpbXBsZW1lbnRzIG8uU3RhdGVtZW50VmlzaXRvciwgby5FeHByZXNzaW9uVmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2VzY2FwZURvbGxhckluU3RyaW5nczogYm9vbGVhbikge31cblxuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IG8uRXhwcmVzc2lvblN0YXRlbWVudCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIHN0bXQuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnRsbihzdG10LCAnOycpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRSZXR1cm5TdG10KHN0bXQ6IG8uUmV0dXJuU3RhdGVtZW50LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KHN0bXQsIGByZXR1cm4gYCk7XG4gICAgc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnRsbihzdG10LCAnOycpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXRDYXN0RXhwcihhc3Q6IG8uQ2FzdEV4cHIsIGNvbnRleHQ6IGFueSk6IGFueTtcblxuICBhYnN0cmFjdCB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogby5DbGFzc1N0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55O1xuXG4gIHZpc2l0SWZTdG10KHN0bXQ6IG8uSWZTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KHN0bXQsIGBpZiAoYCk7XG4gICAgc3RtdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KHN0bXQsIGApIHtgKTtcbiAgICBjb25zdCBoYXNFbHNlQ2FzZSA9IHN0bXQuZmFsc2VDYXNlICE9IG51bGwgJiYgc3RtdC5mYWxzZUNhc2UubGVuZ3RoID4gMDtcbiAgICBpZiAoc3RtdC50cnVlQ2FzZS5sZW5ndGggPD0gMSAmJiAhaGFzRWxzZUNhc2UpIHtcbiAgICAgIGN0eC5wcmludChzdG10LCBgIGApO1xuICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC50cnVlQ2FzZSwgY3R4KTtcbiAgICAgIGN0eC5yZW1vdmVFbXB0eUxhc3RMaW5lKCk7XG4gICAgICBjdHgucHJpbnQoc3RtdCwgYCBgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3R4LnByaW50bG4oKTtcbiAgICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGN0eCk7XG4gICAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgICBpZiAoaGFzRWxzZUNhc2UpIHtcbiAgICAgICAgY3R4LnByaW50bG4oc3RtdCwgYH0gZWxzZSB7YCk7XG4gICAgICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC5mYWxzZUNhc2UsIGN0eCk7XG4gICAgICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYH1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFic3RyYWN0IHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IG8uVHJ5Q2F0Y2hTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueTtcblxuICB2aXNpdFRocm93U3RtdChzdG10OiBvLlRocm93U3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChzdG10LCBgdGhyb3cgYCk7XG4gICAgc3RtdC5lcnJvci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnRsbihzdG10LCBgO2ApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0Q29tbWVudFN0bXQoc3RtdDogby5Db21tZW50U3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGlmIChzdG10Lm11bHRpbGluZSkge1xuICAgICAgY3R4LnByaW50bG4oc3RtdCwgYC8qICR7c3RtdC5jb21tZW50fSAqL2ApO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdG10LmNvbW1lbnQuc3BsaXQoJ1xcbicpLmZvckVhY2goKGxpbmUpID0+IHsgY3R4LnByaW50bG4oc3RtdCwgYC8vICR7bGluZX1gKTsgfSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SlNEb2NDb21tZW50U3RtdChzdG10OiBvLkpTRG9jQ29tbWVudFN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KSB7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYC8qJHtzdG10LnRvU3RyaW5nKCl9Ki9gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFic3RyYWN0IHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogby5EZWNsYXJlVmFyU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnk7XG5cbiAgdmlzaXRXcml0ZVZhckV4cHIoZXhwcjogby5Xcml0ZVZhckV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCBsaW5lV2FzRW1wdHkgPSBjdHgubGluZUlzRW1wdHkoKTtcbiAgICBpZiAoIWxpbmVXYXNFbXB0eSkge1xuICAgICAgY3R4LnByaW50KGV4cHIsICcoJyk7XG4gICAgfVxuICAgIGN0eC5wcmludChleHByLCBgJHtleHByLm5hbWV9ID0gYCk7XG4gICAgZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBpZiAoIWxpbmVXYXNFbXB0eSkge1xuICAgICAgY3R4LnByaW50KGV4cHIsICcpJyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0V3JpdGVLZXlFeHByKGV4cHI6IG8uV3JpdGVLZXlFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbGluZVdhc0VtcHR5ID0gY3R4LmxpbmVJc0VtcHR5KCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKCcpO1xuICAgIH1cbiAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChleHByLCBgW2ApO1xuICAgIGV4cHIuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGV4cHIsIGBdID0gYCk7XG4gICAgZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBpZiAoIWxpbmVXYXNFbXB0eSkge1xuICAgICAgY3R4LnByaW50KGV4cHIsICcpJyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0V3JpdGVQcm9wRXhwcihleHByOiBvLldyaXRlUHJvcEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCBsaW5lV2FzRW1wdHkgPSBjdHgubGluZUlzRW1wdHkoKTtcbiAgICBpZiAoIWxpbmVXYXNFbXB0eSkge1xuICAgICAgY3R4LnByaW50KGV4cHIsICcoJyk7XG4gICAgfVxuICAgIGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGV4cHIsIGAuJHtleHByLm5hbWV9ID0gYCk7XG4gICAgZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBpZiAoIWxpbmVXYXNFbXB0eSkge1xuICAgICAgY3R4LnByaW50KGV4cHIsICcpJyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SW52b2tlTWV0aG9kRXhwcihleHByOiBvLkludm9rZU1ldGhvZEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGxldCBuYW1lID0gZXhwci5uYW1lO1xuICAgIGlmIChleHByLmJ1aWx0aW4gIT0gbnVsbCkge1xuICAgICAgbmFtZSA9IHRoaXMuZ2V0QnVpbHRpbk1ldGhvZE5hbWUoZXhwci5idWlsdGluKTtcbiAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgLy8gc29tZSBidWlsdGlucyBqdXN0IG1lYW4gdG8gc2tpcCB0aGUgY2FsbC5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIGN0eC5wcmludChleHByLCBgLiR7bmFtZX0oYCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGV4cHIuYXJncywgY3R4LCBgLGApO1xuICAgIGN0eC5wcmludChleHByLCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgZ2V0QnVpbHRpbk1ldGhvZE5hbWUobWV0aG9kOiBvLkJ1aWx0aW5NZXRob2QpOiBzdHJpbmc7XG5cbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIoZXhwcjogby5JbnZva2VGdW5jdGlvbkV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBleHByLmZuLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChleHByLCBgKGApO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhleHByLmFyZ3MsIGN0eCwgJywnKTtcbiAgICBjdHgucHJpbnQoZXhwciwgYClgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IG8uV3JhcHBlZE5vZGVFeHByPGFueT4sIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGVtaXR0ZXIgY2Fubm90IHZpc2l0IFdyYXBwZWROb2RlRXhwci4nKTtcbiAgfVxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogby5SZWFkVmFyRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGxldCB2YXJOYW1lID0gYXN0Lm5hbWUgITtcbiAgICBpZiAoYXN0LmJ1aWx0aW4gIT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChhc3QuYnVpbHRpbikge1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5TdXBlcjpcbiAgICAgICAgICB2YXJOYW1lID0gJ3N1cGVyJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuVGhpczpcbiAgICAgICAgICB2YXJOYW1lID0gJ3RoaXMnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaEVycm9yOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9FUlJPUl9WQVIubmFtZSAhO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaFN0YWNrOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9TVEFDS19WQVIubmFtZSAhO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsdGluIHZhcmlhYmxlICR7YXN0LmJ1aWx0aW59YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGN0eC5wcmludChhc3QsIHZhck5hbWUpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogby5JbnN0YW50aWF0ZUV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCBgbmV3IGApO1xuICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgYChgKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGN0eCwgJywnKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IG8uTGl0ZXJhbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgY3R4LnByaW50KGFzdCwgZXNjYXBlSWRlbnRpZmllcih2YWx1ZSwgdGhpcy5fZXNjYXBlRG9sbGFySW5TdHJpbmdzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0eC5wcmludChhc3QsIGAke3ZhbHVlfWApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFic3RyYWN0IHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogby5FeHRlcm5hbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55O1xuXG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByKGFzdDogby5Db25kaXRpb25hbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCBgKGApO1xuICAgIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgJz8gJyk7XG4gICAgYXN0LnRydWVDYXNlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsICc6ICcpO1xuICAgIGFzdC5mYWxzZUNhc2UgIS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0Tm90RXhwcihhc3Q6IG8uTm90RXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChhc3QsICchJyk7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogby5Bc3NlcnROb3ROdWxsLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBhYnN0cmFjdCB2aXNpdEZ1bmN0aW9uRXhwcihhc3Q6IG8uRnVuY3Rpb25FeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueTtcbiAgYWJzdHJhY3QgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IG8uRGVjbGFyZUZ1bmN0aW9uU3RtdCwgY29udGV4dDogYW55KTogYW55O1xuXG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByKGFzdDogby5CaW5hcnlPcGVyYXRvckV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBsZXQgb3BTdHI6IHN0cmluZztcbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkVxdWFsczpcbiAgICAgICAgb3BTdHIgPSAnPT0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5JZGVudGljYWw6XG4gICAgICAgIG9wU3RyID0gJz09PSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk5vdEVxdWFsczpcbiAgICAgICAgb3BTdHIgPSAnIT0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWw6XG4gICAgICAgIG9wU3RyID0gJyE9PSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkFuZDpcbiAgICAgICAgb3BTdHIgPSAnJiYnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5CaXR3aXNlQW5kOlxuICAgICAgICBvcFN0ciA9ICcmJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuT3I6XG4gICAgICAgIG9wU3RyID0gJ3x8JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuUGx1czpcbiAgICAgICAgb3BTdHIgPSAnKyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk1pbnVzOlxuICAgICAgICBvcFN0ciA9ICctJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuRGl2aWRlOlxuICAgICAgICBvcFN0ciA9ICcvJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHk6XG4gICAgICAgIG9wU3RyID0gJyonO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Nb2R1bG86XG4gICAgICAgIG9wU3RyID0gJyUnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Mb3dlcjpcbiAgICAgICAgb3BTdHIgPSAnPCc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzOlxuICAgICAgICBvcFN0ciA9ICc8PSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlcjpcbiAgICAgICAgb3BTdHIgPSAnPic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFsczpcbiAgICAgICAgb3BTdHIgPSAnPj0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBvcGVyYXRvciAke2FzdC5vcGVyYXRvcn1gKTtcbiAgICB9XG4gICAgaWYgKGFzdC5wYXJlbnMpIGN0eC5wcmludChhc3QsIGAoYCk7XG4gICAgYXN0Lmxocy52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgICR7b3BTdHJ9IGApO1xuICAgIGFzdC5yaHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKGFzdC5wYXJlbnMpIGN0eC5wcmludChhc3QsIGApYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdFJlYWRQcm9wRXhwcihhc3Q6IG8uUmVhZFByb3BFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGAuYCk7XG4gICAgY3R4LnByaW50KGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0UmVhZEtleUV4cHIoYXN0OiBvLlJlYWRLZXlFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGBbYCk7XG4gICAgYXN0LmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGBdYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogby5MaXRlcmFsQXJyYXlFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgYFtgKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmVudHJpZXMsIGN0eCwgJywnKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgXWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBvLkxpdGVyYWxNYXBFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgYHtgKTtcbiAgICB0aGlzLnZpc2l0QWxsT2JqZWN0cyhlbnRyeSA9PiB7XG4gICAgICBjdHgucHJpbnQoYXN0LCBgJHtlc2NhcGVJZGVudGlmaWVyKGVudHJ5LmtleSwgdGhpcy5fZXNjYXBlRG9sbGFySW5TdHJpbmdzLCBlbnRyeS5xdW90ZWQpfTpgKTtcbiAgICAgIGVudHJ5LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIH0sIGFzdC5lbnRyaWVzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGFzdCwgYH1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdENvbW1hRXhwcihhc3Q6IG8uQ29tbWFFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgJygnKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LnBhcnRzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGFzdCwgJyknKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEFsbEV4cHJlc3Npb25zKGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQsIHNlcGFyYXRvcjogc3RyaW5nKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMudmlzaXRBbGxPYmplY3RzKGV4cHIgPT4gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KSwgZXhwcmVzc2lvbnMsIGN0eCwgc2VwYXJhdG9yKTtcbiAgfVxuXG4gIHZpc2l0QWxsT2JqZWN0czxUPihcbiAgICAgIGhhbmRsZXI6ICh0OiBUKSA9PiB2b2lkLCBleHByZXNzaW9uczogVFtdLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCxcbiAgICAgIHNlcGFyYXRvcjogc3RyaW5nKTogdm9pZCB7XG4gICAgbGV0IGluY3JlbWVudGVkSW5kZW50ID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgIGlmIChjdHgubGluZUxlbmd0aCgpID4gODApIHtcbiAgICAgICAgICBjdHgucHJpbnQobnVsbCwgc2VwYXJhdG9yLCB0cnVlKTtcbiAgICAgICAgICBpZiAoIWluY3JlbWVudGVkSW5kZW50KSB7XG4gICAgICAgICAgICAvLyBjb250aW51YXRpb24gYXJlIG1hcmtlZCB3aXRoIGRvdWJsZSBpbmRlbnQuXG4gICAgICAgICAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgICAgICAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgICAgICAgICBpbmNyZW1lbnRlZEluZGVudCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGN0eC5wcmludChudWxsLCBzZXBhcmF0b3IsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaGFuZGxlcihleHByZXNzaW9uc1tpXSk7XG4gICAgfVxuICAgIGlmIChpbmNyZW1lbnRlZEluZGVudCkge1xuICAgICAgLy8gY29udGludWF0aW9uIGFyZSBtYXJrZWQgd2l0aCBkb3VibGUgaW5kZW50LlxuICAgICAgY3R4LmRlY0luZGVudCgpO1xuICAgICAgY3R4LmRlY0luZGVudCgpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0QWxsU3RhdGVtZW50cyhzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IHZvaWQge1xuICAgIHN0YXRlbWVudHMuZm9yRWFjaCgoc3RtdCkgPT4gc3RtdC52aXNpdFN0YXRlbWVudCh0aGlzLCBjdHgpKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlSWRlbnRpZmllcihcbiAgICBpbnB1dDogc3RyaW5nLCBlc2NhcGVEb2xsYXI6IGJvb2xlYW4sIGFsd2F5c1F1b3RlOiBib29sZWFuID0gdHJ1ZSk6IGFueSB7XG4gIGlmIChpbnB1dCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3QgYm9keSA9IGlucHV0LnJlcGxhY2UoX1NJTkdMRV9RVU9URV9FU0NBUEVfU1RSSU5HX1JFLCAoLi4ubWF0Y2g6IHN0cmluZ1tdKSA9PiB7XG4gICAgaWYgKG1hdGNoWzBdID09ICckJykge1xuICAgICAgcmV0dXJuIGVzY2FwZURvbGxhciA/ICdcXFxcJCcgOiAnJCc7XG4gICAgfSBlbHNlIGlmIChtYXRjaFswXSA9PSAnXFxuJykge1xuICAgICAgcmV0dXJuICdcXFxcbic7XG4gICAgfSBlbHNlIGlmIChtYXRjaFswXSA9PSAnXFxyJykge1xuICAgICAgcmV0dXJuICdcXFxccic7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBgXFxcXCR7bWF0Y2hbMF19YDtcbiAgICB9XG4gIH0pO1xuICBjb25zdCByZXF1aXJlc1F1b3RlcyA9IGFsd2F5c1F1b3RlIHx8ICFfTEVHQUxfSURFTlRJRklFUl9SRS50ZXN0KGJvZHkpO1xuICByZXR1cm4gcmVxdWlyZXNRdW90ZXMgPyBgJyR7Ym9keX0nYCA6IGJvZHk7XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVJbmRlbnQoY291bnQ6IG51bWJlcik6IHN0cmluZyB7XG4gIGxldCByZXMgPSAnJztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgcmVzICs9IF9JTkRFTlRfV0lUSDtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuIl19