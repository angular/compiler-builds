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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvYWJzdHJhY3RfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUlILDJEQUFrQztJQUNsQyxzRUFBZ0Q7SUFFaEQsSUFBTSw4QkFBOEIsR0FBRyxnQkFBZ0IsQ0FBQztJQUN4RCxJQUFNLG9CQUFvQixHQUFHLHVCQUF1QixDQUFDO0lBQ3JELElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQztJQUNiLFFBQUEsZUFBZSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNsRCxRQUFBLGVBQWUsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFNL0Q7UUFJRSxzQkFBbUIsTUFBYztZQUFkLFdBQU0sR0FBTixNQUFNLENBQVE7WUFIakMsZ0JBQVcsR0FBRyxDQUFDLENBQUM7WUFDaEIsVUFBSyxHQUFhLEVBQUUsQ0FBQztZQUNyQixhQUFRLEdBQTZCLEVBQUUsQ0FBQztRQUNKLENBQUM7UUFDdkMsbUJBQUM7SUFBRCxDQUFDLEFBTEQsSUFLQztJQUVEO1FBT0UsK0JBQW9CLE9BQWU7WUFBZixZQUFPLEdBQVAsT0FBTyxDQUFRO1lBSDNCLGFBQVEsR0FBa0IsRUFBRSxDQUFDO1lBQzdCLHVCQUFrQixHQUFHLENBQUMsQ0FBQztZQUVRLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQUMsQ0FBQztRQU41RSxnQ0FBVSxHQUFqQixjQUE2QyxNQUFNLENBQUMsSUFBSSxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFRbkYsc0JB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QyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDL0IsR0FBRyxJQUFJLFlBQVksQ0FBQztRQUN0QixDQUFDO1FBQ0QsTUFBTSxDQUFDLEdBQUcsQ0FBQztJQUNiLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dF9hc3QnO1xuaW1wb3J0IHtTb3VyY2VNYXBHZW5lcmF0b3J9IGZyb20gJy4vc291cmNlX21hcCc7XG5cbmNvbnN0IF9TSU5HTEVfUVVPVEVfRVNDQVBFX1NUUklOR19SRSA9IC8nfFxcXFx8XFxufFxccnxcXCQvZztcbmNvbnN0IF9MRUdBTF9JREVOVElGSUVSX1JFID0gL15bJEEtWl9dWzAtOUEtWl8kXSokL2k7XG5jb25zdCBfSU5ERU5UX1dJVEggPSAnICAnO1xuZXhwb3J0IGNvbnN0IENBVENIX0VSUk9SX1ZBUiA9IG8udmFyaWFibGUoJ2Vycm9yJywgbnVsbCwgbnVsbCk7XG5leHBvcnQgY29uc3QgQ0FUQ0hfU1RBQ0tfVkFSID0gby52YXJpYWJsZSgnc3RhY2snLCBudWxsLCBudWxsKTtcblxuZXhwb3J0IGludGVyZmFjZSBPdXRwdXRFbWl0dGVyIHtcbiAgZW1pdFN0YXRlbWVudHMoZ2VuRmlsZVBhdGg6IHN0cmluZywgc3RtdHM6IG8uU3RhdGVtZW50W10sIHByZWFtYmxlPzogc3RyaW5nfG51bGwpOiBzdHJpbmc7XG59XG5cbmNsYXNzIF9FbWl0dGVkTGluZSB7XG4gIHBhcnRzTGVuZ3RoID0gMDtcbiAgcGFydHM6IHN0cmluZ1tdID0gW107XG4gIHNyY1NwYW5zOiAoUGFyc2VTb3VyY2VTcGFufG51bGwpW10gPSBbXTtcbiAgY29uc3RydWN0b3IocHVibGljIGluZGVudDogbnVtYmVyKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgRW1pdHRlclZpc2l0b3JDb250ZXh0IHtcbiAgc3RhdGljIGNyZWF0ZVJvb3QoKTogRW1pdHRlclZpc2l0b3JDb250ZXh0IHsgcmV0dXJuIG5ldyBFbWl0dGVyVmlzaXRvckNvbnRleHQoMCk7IH1cblxuICBwcml2YXRlIF9saW5lczogX0VtaXR0ZWRMaW5lW107XG4gIHByaXZhdGUgX2NsYXNzZXM6IG8uQ2xhc3NTdG10W10gPSBbXTtcbiAgcHJpdmF0ZSBfcHJlYW1ibGVMaW5lQ291bnQgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2luZGVudDogbnVtYmVyKSB7IHRoaXMuX2xpbmVzID0gW25ldyBfRW1pdHRlZExpbmUoX2luZGVudCldOyB9XG5cbiAgcHJpdmF0ZSBnZXQgX2N1cnJlbnRMaW5lKCk6IF9FbWl0dGVkTGluZSB7IHJldHVybiB0aGlzLl9saW5lc1t0aGlzLl9saW5lcy5sZW5ndGggLSAxXTsgfVxuXG4gIHByaW50bG4oZnJvbT86IHtzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsfXxudWxsLCBsYXN0UGFydDogc3RyaW5nID0gJycpOiB2b2lkIHtcbiAgICB0aGlzLnByaW50KGZyb20gfHwgbnVsbCwgbGFzdFBhcnQsIHRydWUpO1xuICB9XG5cbiAgbGluZUlzRW1wdHkoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9jdXJyZW50TGluZS5wYXJ0cy5sZW5ndGggPT09IDA7IH1cblxuICBsaW5lTGVuZ3RoKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRMaW5lLmluZGVudCAqIF9JTkRFTlRfV0lUSC5sZW5ndGggKyB0aGlzLl9jdXJyZW50TGluZS5wYXJ0c0xlbmd0aDtcbiAgfVxuXG4gIHByaW50KGZyb206IHtzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsfXxudWxsLCBwYXJ0OiBzdHJpbmcsIG5ld0xpbmU6IGJvb2xlYW4gPSBmYWxzZSkge1xuICAgIGlmIChwYXJ0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRMaW5lLnBhcnRzLnB1c2gocGFydCk7XG4gICAgICB0aGlzLl9jdXJyZW50TGluZS5wYXJ0c0xlbmd0aCArPSBwYXJ0Lmxlbmd0aDtcbiAgICAgIHRoaXMuX2N1cnJlbnRMaW5lLnNyY1NwYW5zLnB1c2goZnJvbSAmJiBmcm9tLnNvdXJjZVNwYW4gfHwgbnVsbCk7XG4gICAgfVxuICAgIGlmIChuZXdMaW5lKSB7XG4gICAgICB0aGlzLl9saW5lcy5wdXNoKG5ldyBfRW1pdHRlZExpbmUodGhpcy5faW5kZW50KSk7XG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlRW1wdHlMYXN0TGluZSgpIHtcbiAgICBpZiAodGhpcy5saW5lSXNFbXB0eSgpKSB7XG4gICAgICB0aGlzLl9saW5lcy5wb3AoKTtcbiAgICB9XG4gIH1cblxuICBpbmNJbmRlbnQoKSB7XG4gICAgdGhpcy5faW5kZW50Kys7XG4gICAgaWYgKHRoaXMubGluZUlzRW1wdHkoKSkge1xuICAgICAgdGhpcy5fY3VycmVudExpbmUuaW5kZW50ID0gdGhpcy5faW5kZW50O1xuICAgIH1cbiAgfVxuXG4gIGRlY0luZGVudCgpIHtcbiAgICB0aGlzLl9pbmRlbnQtLTtcbiAgICBpZiAodGhpcy5saW5lSXNFbXB0eSgpKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TGluZS5pbmRlbnQgPSB0aGlzLl9pbmRlbnQ7XG4gICAgfVxuICB9XG5cbiAgcHVzaENsYXNzKGNsYXp6OiBvLkNsYXNzU3RtdCkgeyB0aGlzLl9jbGFzc2VzLnB1c2goY2xhenopOyB9XG5cbiAgcG9wQ2xhc3MoKTogby5DbGFzc1N0bXQgeyByZXR1cm4gdGhpcy5fY2xhc3Nlcy5wb3AoKSAhOyB9XG5cbiAgZ2V0IGN1cnJlbnRDbGFzcygpOiBvLkNsYXNzU3RtdHxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3Nlcy5sZW5ndGggPiAwID8gdGhpcy5fY2xhc3Nlc1t0aGlzLl9jbGFzc2VzLmxlbmd0aCAtIDFdIDogbnVsbDtcbiAgfVxuXG4gIHRvU291cmNlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc291cmNlTGluZXNcbiAgICAgICAgLm1hcChsID0+IGwucGFydHMubGVuZ3RoID4gMCA/IF9jcmVhdGVJbmRlbnQobC5pbmRlbnQpICsgbC5wYXJ0cy5qb2luKCcnKSA6ICcnKVxuICAgICAgICAuam9pbignXFxuJyk7XG4gIH1cblxuICB0b1NvdXJjZU1hcEdlbmVyYXRvcihnZW5GaWxlUGF0aDogc3RyaW5nLCBzdGFydHNBdExpbmU6IG51bWJlciA9IDApOiBTb3VyY2VNYXBHZW5lcmF0b3Ige1xuICAgIGNvbnN0IG1hcCA9IG5ldyBTb3VyY2VNYXBHZW5lcmF0b3IoZ2VuRmlsZVBhdGgpO1xuXG4gICAgbGV0IGZpcnN0T2Zmc2V0TWFwcGVkID0gZmFsc2U7XG4gICAgY29uc3QgbWFwRmlyc3RPZmZzZXRJZk5lZWRlZCA9ICgpID0+IHtcbiAgICAgIGlmICghZmlyc3RPZmZzZXRNYXBwZWQpIHtcbiAgICAgICAgLy8gQWRkIGEgc2luZ2xlIHNwYWNlIHNvIHRoYXQgdG9vbHMgd29uJ3QgdHJ5IHRvIGxvYWQgdGhlIGZpbGUgZnJvbSBkaXNrLlxuICAgICAgICAvLyBOb3RlOiBXZSBhcmUgdXNpbmcgdmlydHVhbCB1cmxzIGxpa2UgYG5nOi8vL2AsIHNvIHdlIGhhdmUgdG9cbiAgICAgICAgLy8gcHJvdmlkZSBhIGNvbnRlbnQgaGVyZS5cbiAgICAgICAgbWFwLmFkZFNvdXJjZShnZW5GaWxlUGF0aCwgJyAnKS5hZGRNYXBwaW5nKDAsIGdlbkZpbGVQYXRoLCAwLCAwKTtcbiAgICAgICAgZmlyc3RPZmZzZXRNYXBwZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXJ0c0F0TGluZTsgaSsrKSB7XG4gICAgICBtYXAuYWRkTGluZSgpO1xuICAgICAgbWFwRmlyc3RPZmZzZXRJZk5lZWRlZCgpO1xuICAgIH1cblxuICAgIHRoaXMuc291cmNlTGluZXMuZm9yRWFjaCgobGluZSwgbGluZUlkeCkgPT4ge1xuICAgICAgbWFwLmFkZExpbmUoKTtcblxuICAgICAgY29uc3Qgc3BhbnMgPSBsaW5lLnNyY1NwYW5zO1xuICAgICAgY29uc3QgcGFydHMgPSBsaW5lLnBhcnRzO1xuICAgICAgbGV0IGNvbDAgPSBsaW5lLmluZGVudCAqIF9JTkRFTlRfV0lUSC5sZW5ndGg7XG4gICAgICBsZXQgc3BhbklkeCA9IDA7XG4gICAgICAvLyBza2lwIGxlYWRpbmcgcGFydHMgd2l0aG91dCBzb3VyY2Ugc3BhbnNcbiAgICAgIHdoaWxlIChzcGFuSWR4IDwgc3BhbnMubGVuZ3RoICYmICFzcGFuc1tzcGFuSWR4XSkge1xuICAgICAgICBjb2wwICs9IHBhcnRzW3NwYW5JZHhdLmxlbmd0aDtcbiAgICAgICAgc3BhbklkeCsrO1xuICAgICAgfVxuICAgICAgaWYgKHNwYW5JZHggPCBzcGFucy5sZW5ndGggJiYgbGluZUlkeCA9PT0gMCAmJiBjb2wwID09PSAwKSB7XG4gICAgICAgIGZpcnN0T2Zmc2V0TWFwcGVkID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1hcEZpcnN0T2Zmc2V0SWZOZWVkZWQoKTtcbiAgICAgIH1cblxuICAgICAgd2hpbGUgKHNwYW5JZHggPCBzcGFucy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3Qgc3BhbiA9IHNwYW5zW3NwYW5JZHhdICE7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IHNwYW4uc3RhcnQuZmlsZTtcbiAgICAgICAgY29uc3Qgc291cmNlTGluZSA9IHNwYW4uc3RhcnQubGluZTtcbiAgICAgICAgY29uc3Qgc291cmNlQ29sID0gc3Bhbi5zdGFydC5jb2w7XG4gICAgICAgIG1hcC5hZGRTb3VyY2Uoc291cmNlLnVybCwgc291cmNlLmNvbnRlbnQpXG4gICAgICAgICAgICAuYWRkTWFwcGluZyhjb2wwLCBzb3VyY2UudXJsLCBzb3VyY2VMaW5lLCBzb3VyY2VDb2wpO1xuXG4gICAgICAgIGNvbDAgKz0gcGFydHNbc3BhbklkeF0ubGVuZ3RoO1xuICAgICAgICBzcGFuSWR4Kys7XG5cbiAgICAgICAgLy8gYXNzaWduIHBhcnRzIHdpdGhvdXQgc3BhbiBvciB0aGUgc2FtZSBzcGFuIHRvIHRoZSBwcmV2aW91cyBzZWdtZW50XG4gICAgICAgIHdoaWxlIChzcGFuSWR4IDwgc3BhbnMubGVuZ3RoICYmIChzcGFuID09PSBzcGFuc1tzcGFuSWR4XSB8fCAhc3BhbnNbc3BhbklkeF0pKSB7XG4gICAgICAgICAgY29sMCArPSBwYXJ0c1tzcGFuSWR4XS5sZW5ndGg7XG4gICAgICAgICAgc3BhbklkeCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWFwO1xuICB9XG5cbiAgc2V0UHJlYW1ibGVMaW5lQ291bnQoY291bnQ6IG51bWJlcikgeyByZXR1cm4gdGhpcy5fcHJlYW1ibGVMaW5lQ291bnQgPSBjb3VudDsgfVxuXG4gIHNwYW5PZihsaW5lOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKTogUGFyc2VTb3VyY2VTcGFufG51bGwge1xuICAgIGNvbnN0IGVtaXR0ZWRMaW5lID0gdGhpcy5fbGluZXNbbGluZSAtIHRoaXMuX3ByZWFtYmxlTGluZUNvdW50XTtcbiAgICBpZiAoZW1pdHRlZExpbmUpIHtcbiAgICAgIGxldCBjb2x1bW5zTGVmdCA9IGNvbHVtbiAtIF9jcmVhdGVJbmRlbnQoZW1pdHRlZExpbmUuaW5kZW50KS5sZW5ndGg7XG4gICAgICBmb3IgKGxldCBwYXJ0SW5kZXggPSAwOyBwYXJ0SW5kZXggPCBlbWl0dGVkTGluZS5wYXJ0cy5sZW5ndGg7IHBhcnRJbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IHBhcnQgPSBlbWl0dGVkTGluZS5wYXJ0c1twYXJ0SW5kZXhdO1xuICAgICAgICBpZiAocGFydC5sZW5ndGggPiBjb2x1bW5zTGVmdCkge1xuICAgICAgICAgIHJldHVybiBlbWl0dGVkTGluZS5zcmNTcGFuc1twYXJ0SW5kZXhdO1xuICAgICAgICB9XG4gICAgICAgIGNvbHVtbnNMZWZ0IC09IHBhcnQubGVuZ3RoO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0IHNvdXJjZUxpbmVzKCk6IF9FbWl0dGVkTGluZVtdIHtcbiAgICBpZiAodGhpcy5fbGluZXMubGVuZ3RoICYmIHRoaXMuX2xpbmVzW3RoaXMuX2xpbmVzLmxlbmd0aCAtIDFdLnBhcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2xpbmVzLnNsaWNlKDAsIC0xKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2xpbmVzO1xuICB9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdEVtaXR0ZXJWaXNpdG9yIGltcGxlbWVudHMgby5TdGF0ZW1lbnRWaXNpdG9yLCBvLkV4cHJlc3Npb25WaXNpdG9yIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfZXNjYXBlRG9sbGFySW5TdHJpbmdzOiBib29sZWFuKSB7fVxuXG4gIHZpc2l0RXhwcmVzc2lvblN0bXQoc3RtdDogby5FeHByZXNzaW9uU3RhdGVtZW50LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgc3RtdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsICc7Jyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdFJldHVyblN0bXQoc3RtdDogby5SZXR1cm5TdGF0ZW1lbnQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoc3RtdCwgYHJldHVybiBgKTtcbiAgICBzdG10LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsICc7Jyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhYnN0cmFjdCB2aXNpdENhc3RFeHByKGFzdDogby5DYXN0RXhwciwgY29udGV4dDogYW55KTogYW55O1xuXG4gIGFic3RyYWN0IHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBvLkNsYXNzU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnk7XG5cbiAgdmlzaXRJZlN0bXQoc3RtdDogby5JZlN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoc3RtdCwgYGlmIChgKTtcbiAgICBzdG10LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoc3RtdCwgYCkge2ApO1xuICAgIGNvbnN0IGhhc0Vsc2VDYXNlID0gc3RtdC5mYWxzZUNhc2UgIT0gbnVsbCAmJiBzdG10LmZhbHNlQ2FzZS5sZW5ndGggPiAwO1xuICAgIGlmIChzdG10LnRydWVDYXNlLmxlbmd0aCA8PSAxICYmICFoYXNFbHNlQ2FzZSkge1xuICAgICAgY3R4LnByaW50KHN0bXQsIGAgYCk7XG4gICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjdHgpO1xuICAgICAgY3R4LnJlbW92ZUVtcHR5TGFzdExpbmUoKTtcbiAgICAgIGN0eC5wcmludChzdG10LCBgIGApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdHgucHJpbnRsbigpO1xuICAgICAgY3R4LmluY0luZGVudCgpO1xuICAgICAgdGhpcy52aXNpdEFsbFN0YXRlbWVudHMoc3RtdC50cnVlQ2FzZSwgY3R4KTtcbiAgICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICAgIGlmIChoYXNFbHNlQ2FzZSkge1xuICAgICAgICBjdHgucHJpbnRsbihzdG10LCBgfSBlbHNlIHtgKTtcbiAgICAgICAgY3R4LmluY0luZGVudCgpO1xuICAgICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LmZhbHNlQ2FzZSwgY3R4KTtcbiAgICAgICAgY3R4LmRlY0luZGVudCgpO1xuICAgICAgfVxuICAgIH1cbiAgICBjdHgucHJpbnRsbihzdG10LCBgfWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXRUcnlDYXRjaFN0bXQoc3RtdDogby5UcnlDYXRjaFN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55O1xuXG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IG8uVGhyb3dTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KHN0bXQsIGB0aHJvdyBgKTtcbiAgICBzdG10LmVycm9yLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGA7YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRDb21tZW50U3RtdChzdG10OiBvLkNvbW1lbnRTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKHN0bXQubXVsdGlsaW5lKSB7XG4gICAgICBjdHgucHJpbnRsbihzdG10LCBgLyogJHtzdG10LmNvbW1lbnR9ICovYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0bXQuY29tbWVudC5zcGxpdCgnXFxuJykuZm9yRWFjaCgobGluZSkgPT4geyBjdHgucHJpbnRsbihzdG10LCBgLy8gJHtsaW5lfWApOyB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRKU0RvY0NvbW1lbnRTdG10KHN0bXQ6IG8uSlNEb2NDb21tZW50U3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpIHtcbiAgICBjdHgucHJpbnRsbihzdG10LCBgLyoke3N0bXQudG9TdHJpbmcoKX0qL2ApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBvLkRlY2xhcmVWYXJTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueTtcblxuICB2aXNpdFdyaXRlVmFyRXhwcihleHByOiBvLldyaXRlVmFyRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGxpbmVXYXNFbXB0eSA9IGN0eC5saW5lSXNFbXB0eSgpO1xuICAgIGlmICghbGluZVdhc0VtcHR5KSB7XG4gICAgICBjdHgucHJpbnQoZXhwciwgJygnKTtcbiAgICB9XG4gICAgY3R4LnByaW50KGV4cHIsIGAke2V4cHIubmFtZX0gPSBgKTtcbiAgICBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGlmICghbGluZVdhc0VtcHR5KSB7XG4gICAgICBjdHgucHJpbnQoZXhwciwgJyknKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRXcml0ZUtleUV4cHIoZXhwcjogby5Xcml0ZUtleUV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCBsaW5lV2FzRW1wdHkgPSBjdHgubGluZUlzRW1wdHkoKTtcbiAgICBpZiAoIWxpbmVXYXNFbXB0eSkge1xuICAgICAgY3R4LnByaW50KGV4cHIsICcoJyk7XG4gICAgfVxuICAgIGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGV4cHIsIGBbYCk7XG4gICAgZXhwci5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoZXhwciwgYF0gPSBgKTtcbiAgICBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGlmICghbGluZVdhc0VtcHR5KSB7XG4gICAgICBjdHgucHJpbnQoZXhwciwgJyknKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRXcml0ZVByb3BFeHByKGV4cHI6IG8uV3JpdGVQcm9wRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGxpbmVXYXNFbXB0eSA9IGN0eC5saW5lSXNFbXB0eSgpO1xuICAgIGlmICghbGluZVdhc0VtcHR5KSB7XG4gICAgICBjdHgucHJpbnQoZXhwciwgJygnKTtcbiAgICB9XG4gICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoZXhwciwgYC4ke2V4cHIubmFtZX0gPSBgKTtcbiAgICBleHByLnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGlmICghbGluZVdhc0VtcHR5KSB7XG4gICAgICBjdHgucHJpbnQoZXhwciwgJyknKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRJbnZva2VNZXRob2RFeHByKGV4cHI6IG8uSW52b2tlTWV0aG9kRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGV4cHIucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgbGV0IG5hbWUgPSBleHByLm5hbWU7XG4gICAgaWYgKGV4cHIuYnVpbHRpbiAhPSBudWxsKSB7XG4gICAgICBuYW1lID0gdGhpcy5nZXRCdWlsdGluTWV0aG9kTmFtZShleHByLmJ1aWx0aW4pO1xuICAgICAgaWYgKG5hbWUgPT0gbnVsbCkge1xuICAgICAgICAvLyBzb21lIGJ1aWx0aW5zIGp1c3QgbWVhbiB0byBza2lwIHRoZSBjYWxsLlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgY3R4LnByaW50KGV4cHIsIGAuJHtuYW1lfShgKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwci5hcmdzLCBjdHgsIGAsYCk7XG4gICAgY3R4LnByaW50KGV4cHIsIGApYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhYnN0cmFjdCBnZXRCdWlsdGluTWV0aG9kTmFtZShtZXRob2Q6IG8uQnVpbHRpbk1ldGhvZCk6IHN0cmluZztcblxuICB2aXNpdEludm9rZUZ1bmN0aW9uRXhwcihleHByOiBvLkludm9rZUZ1bmN0aW9uRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGV4cHIuZm4udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGV4cHIsIGAoYCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGV4cHIuYXJncywgY3R4LCAnLCcpO1xuICAgIGN0eC5wcmludChleHByLCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0V3JhcHBlZE5vZGVFeHByKGFzdDogby5XcmFwcGVkTm9kZUV4cHI8YW55PiwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBYnN0cmFjdCBlbWl0dGVyIGNhbm5vdCB2aXNpdCBXcmFwcGVkTm9kZUV4cHIuJyk7XG4gIH1cbiAgdmlzaXRSZWFkVmFyRXhwcihhc3Q6IG8uUmVhZFZhckV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBsZXQgdmFyTmFtZSA9IGFzdC5uYW1lICE7XG4gICAgaWYgKGFzdC5idWlsdGluICE9IG51bGwpIHtcbiAgICAgIHN3aXRjaCAoYXN0LmJ1aWx0aW4pIHtcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuU3VwZXI6XG4gICAgICAgICAgdmFyTmFtZSA9ICdzdXBlcic7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2Ugby5CdWlsdGluVmFyLlRoaXM6XG4gICAgICAgICAgdmFyTmFtZSA9ICd0aGlzJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuQ2F0Y2hFcnJvcjpcbiAgICAgICAgICB2YXJOYW1lID0gQ0FUQ0hfRVJST1JfVkFSLm5hbWUgITtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuQ2F0Y2hTdGFjazpcbiAgICAgICAgICB2YXJOYW1lID0gQ0FUQ0hfU1RBQ0tfVkFSLm5hbWUgITtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYnVpbHRpbiB2YXJpYWJsZSAke2FzdC5idWlsdGlufWApO1xuICAgICAgfVxuICAgIH1cbiAgICBjdHgucHJpbnQoYXN0LCB2YXJOYW1lKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEluc3RhbnRpYXRlRXhwcihhc3Q6IG8uSW5zdGFudGlhdGVFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgYG5ldyBgKTtcbiAgICBhc3QuY2xhc3NFeHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGAoYCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5hcmdzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGFzdCwgYClgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEV4cHIoYXN0OiBvLkxpdGVyYWxFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgdmFsdWUgPSBhc3QudmFsdWU7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGN0eC5wcmludChhc3QsIGVzY2FwZUlkZW50aWZpZXIodmFsdWUsIHRoaXMuX2VzY2FwZURvbGxhckluU3RyaW5ncykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdHgucHJpbnQoYXN0LCBgJHt2YWx1ZX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhYnN0cmFjdCB2aXNpdEV4dGVybmFsRXhwcihhc3Q6IG8uRXh0ZXJuYWxFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueTtcblxuICB2aXNpdENvbmRpdGlvbmFsRXhwcihhc3Q6IG8uQ29uZGl0aW9uYWxFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgYChgKTtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsICc/ICcpO1xuICAgIGFzdC50cnVlQ2FzZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCAnOiAnKTtcbiAgICBhc3QuZmFsc2VDYXNlICEudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgYClgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdE5vdEV4cHIoYXN0OiBvLk5vdEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCAnIScpO1xuICAgIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRBc3NlcnROb3ROdWxsRXhwcihhc3Q6IG8uQXNzZXJ0Tm90TnVsbCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGFzdC5jb25kaXRpb24udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYWJzdHJhY3QgdmlzaXRGdW5jdGlvbkV4cHIoYXN0OiBvLkZ1bmN0aW9uRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnk7XG4gIGFic3RyYWN0IHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBvLkRlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IGFueSk6IGFueTtcblxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IG8uQmluYXJ5T3BlcmF0b3JFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgbGV0IG9wU3RyOiBzdHJpbmc7XG4gICAgc3dpdGNoIChhc3Qub3BlcmF0b3IpIHtcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5FcXVhbHM6XG4gICAgICAgIG9wU3RyID0gJz09JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuSWRlbnRpY2FsOlxuICAgICAgICBvcFN0ciA9ICc9PT0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHM6XG4gICAgICAgIG9wU3RyID0gJyE9JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsOlxuICAgICAgICBvcFN0ciA9ICchPT0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5BbmQ6XG4gICAgICAgIG9wU3RyID0gJyYmJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuQml0d2lzZUFuZDpcbiAgICAgICAgb3BTdHIgPSAnJic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk9yOlxuICAgICAgICBvcFN0ciA9ICd8fCc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLlBsdXM6XG4gICAgICAgIG9wU3RyID0gJysnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5NaW51czpcbiAgICAgICAgb3BTdHIgPSAnLSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkRpdmlkZTpcbiAgICAgICAgb3BTdHIgPSAnLyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk11bHRpcGx5OlxuICAgICAgICBvcFN0ciA9ICcqJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTW9kdWxvOlxuICAgICAgICBvcFN0ciA9ICclJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTG93ZXI6XG4gICAgICAgIG9wU3RyID0gJzwnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5Mb3dlckVxdWFsczpcbiAgICAgICAgb3BTdHIgPSAnPD0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5CaWdnZXI6XG4gICAgICAgIG9wU3RyID0gJz4nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHM6XG4gICAgICAgIG9wU3RyID0gJz49JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gb3BlcmF0b3IgJHthc3Qub3BlcmF0b3J9YCk7XG4gICAgfVxuICAgIGlmIChhc3QucGFyZW5zKSBjdHgucHJpbnQoYXN0LCBgKGApO1xuICAgIGFzdC5saHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgYCAke29wU3RyfSBgKTtcbiAgICBhc3QucmhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGlmIChhc3QucGFyZW5zKSBjdHgucHJpbnQoYXN0LCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRSZWFkUHJvcEV4cHIoYXN0OiBvLlJlYWRQcm9wRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgLmApO1xuICAgIGN0eC5wcmludChhc3QsIGFzdC5uYW1lKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFJlYWRLZXlFeHByKGFzdDogby5SZWFkS2V5RXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGFzdC5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgW2ApO1xuICAgIGFzdC5pbmRleC52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCBgXWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IG8uTGl0ZXJhbEFycmF5RXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChhc3QsIGBbYCk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5lbnRyaWVzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGFzdCwgYF1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXBFeHByKGFzdDogby5MaXRlcmFsTWFwRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChhc3QsIGB7YCk7XG4gICAgdGhpcy52aXNpdEFsbE9iamVjdHMoZW50cnkgPT4ge1xuICAgICAgY3R4LnByaW50KGFzdCwgYCR7ZXNjYXBlSWRlbnRpZmllcihlbnRyeS5rZXksIHRoaXMuX2VzY2FwZURvbGxhckluU3RyaW5ncywgZW50cnkucXVvdGVkKX06YCk7XG4gICAgICBlbnRyeS52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICB9LCBhc3QuZW50cmllcywgY3R4LCAnLCcpO1xuICAgIGN0eC5wcmludChhc3QsIGB9YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRDb21tYUV4cHIoYXN0OiBvLkNvbW1hRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChhc3QsICcoJyk7XG4gICAgdGhpcy52aXNpdEFsbEV4cHJlc3Npb25zKGFzdC5wYXJ0cywgY3R4LCAnLCcpO1xuICAgIGN0eC5wcmludChhc3QsICcpJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRBbGxFeHByZXNzaW9ucyhleHByZXNzaW9uczogby5FeHByZXNzaW9uW10sIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0LCBzZXBhcmF0b3I6IHN0cmluZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLnZpc2l0QWxsT2JqZWN0cyhleHByID0+IGV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCksIGV4cHJlc3Npb25zLCBjdHgsIHNlcGFyYXRvcik7XG4gIH1cblxuICB2aXNpdEFsbE9iamVjdHM8VD4oXG4gICAgICBoYW5kbGVyOiAodDogVCkgPT4gdm9pZCwgZXhwcmVzc2lvbnM6IFRbXSwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQsXG4gICAgICBzZXBhcmF0b3I6IHN0cmluZyk6IHZvaWQge1xuICAgIGxldCBpbmNyZW1lbnRlZEluZGVudCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwcmVzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpID4gMCkge1xuICAgICAgICBpZiAoY3R4LmxpbmVMZW5ndGgoKSA+IDgwKSB7XG4gICAgICAgICAgY3R4LnByaW50KG51bGwsIHNlcGFyYXRvciwgdHJ1ZSk7XG4gICAgICAgICAgaWYgKCFpbmNyZW1lbnRlZEluZGVudCkge1xuICAgICAgICAgICAgLy8gY29udGludWF0aW9uIGFyZSBtYXJrZWQgd2l0aCBkb3VibGUgaW5kZW50LlxuICAgICAgICAgICAgY3R4LmluY0luZGVudCgpO1xuICAgICAgICAgICAgY3R4LmluY0luZGVudCgpO1xuICAgICAgICAgICAgaW5jcmVtZW50ZWRJbmRlbnQgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdHgucHJpbnQobnVsbCwgc2VwYXJhdG9yLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGhhbmRsZXIoZXhwcmVzc2lvbnNbaV0pO1xuICAgIH1cbiAgICBpZiAoaW5jcmVtZW50ZWRJbmRlbnQpIHtcbiAgICAgIC8vIGNvbnRpbnVhdGlvbiBhcmUgbWFya2VkIHdpdGggZG91YmxlIGluZGVudC5cbiAgICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICAgIGN0eC5kZWNJbmRlbnQoKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEFsbFN0YXRlbWVudHMoc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiB2b2lkIHtcbiAgICBzdGF0ZW1lbnRzLmZvckVhY2goKHN0bXQpID0+IHN0bXQudmlzaXRTdGF0ZW1lbnQodGhpcywgY3R4KSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUlkZW50aWZpZXIoXG4gICAgaW5wdXQ6IHN0cmluZywgZXNjYXBlRG9sbGFyOiBib29sZWFuLCBhbHdheXNRdW90ZTogYm9vbGVhbiA9IHRydWUpOiBhbnkge1xuICBpZiAoaW5wdXQgPT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IGJvZHkgPSBpbnB1dC5yZXBsYWNlKF9TSU5HTEVfUVVPVEVfRVNDQVBFX1NUUklOR19SRSwgKC4uLm1hdGNoOiBzdHJpbmdbXSkgPT4ge1xuICAgIGlmIChtYXRjaFswXSA9PSAnJCcpIHtcbiAgICAgIHJldHVybiBlc2NhcGVEb2xsYXIgPyAnXFxcXCQnIDogJyQnO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hbMF0gPT0gJ1xcbicpIHtcbiAgICAgIHJldHVybiAnXFxcXG4nO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hbMF0gPT0gJ1xccicpIHtcbiAgICAgIHJldHVybiAnXFxcXHInO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYFxcXFwke21hdGNoWzBdfWA7XG4gICAgfVxuICB9KTtcbiAgY29uc3QgcmVxdWlyZXNRdW90ZXMgPSBhbHdheXNRdW90ZSB8fCAhX0xFR0FMX0lERU5USUZJRVJfUkUudGVzdChib2R5KTtcbiAgcmV0dXJuIHJlcXVpcmVzUXVvdGVzID8gYCcke2JvZHl9J2AgOiBib2R5O1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlSW5kZW50KGNvdW50OiBudW1iZXIpOiBzdHJpbmcge1xuICBsZXQgcmVzID0gJyc7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgIHJlcyArPSBfSU5ERU5UX1dJVEg7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cbiJdfQ==