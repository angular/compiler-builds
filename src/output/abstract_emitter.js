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
        AbstractEmitterVisitor.prototype.visitTypeofExpr = function (expr, ctx) {
            ctx.print(expr, 'typeof ');
            expr.expr.visitExpression(this, ctx);
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
        AbstractEmitterVisitor.prototype.visitLocalizedString = function (ast, ctx) {
            ctx.print(ast, '$localize `' + ast.messageParts[0]);
            for (var i = 1; i < ast.messageParts.length; i++) {
                ctx.print(ast, '${');
                ast.expressions[i - 1].visitExpression(this, ctx);
                // Add the placeholder name annotation to support runtime inlining
                ctx.print(ast, "}:" + ast.placeHolderNames[i - 1] + ":");
                ctx.print(ast, ast.messageParts[i]);
            }
            ctx.print(ast, '`');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvYWJzdHJhY3RfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUlILDJEQUFrQztJQUNsQyxzRUFBZ0Q7SUFFaEQsSUFBTSw4QkFBOEIsR0FBRyxnQkFBZ0IsQ0FBQztJQUN4RCxJQUFNLG9CQUFvQixHQUFHLHVCQUF1QixDQUFDO0lBQ3JELElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQztJQUNiLFFBQUEsZUFBZSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNsRCxRQUFBLGVBQWUsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFNL0Q7UUFJRSxzQkFBbUIsTUFBYztZQUFkLFdBQU0sR0FBTixNQUFNLENBQVE7WUFIakMsZ0JBQVcsR0FBRyxDQUFDLENBQUM7WUFDaEIsVUFBSyxHQUFhLEVBQUUsQ0FBQztZQUNyQixhQUFRLEdBQTZCLEVBQUUsQ0FBQztRQUNKLENBQUM7UUFDdkMsbUJBQUM7SUFBRCxDQUFDLEFBTEQsSUFLQztJQUVEO1FBT0UsK0JBQW9CLE9BQWU7WUFBZixZQUFPLEdBQVAsT0FBTyxDQUFRO1lBSDNCLGFBQVEsR0FBa0IsRUFBRSxDQUFDO1lBQzdCLHVCQUFrQixHQUFHLENBQUMsQ0FBQztZQUVRLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQUMsQ0FBQztRQU41RSxnQ0FBVSxHQUFqQixjQUE2QyxPQUFPLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBUW5GLHNCQUFZLCtD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SyxDQUFDO2FBQ2Q7aUJBQU07Z0JBQ0wsT0FBTyxPQUFLLEtBQUssQ0FBQyxDQUFDLENBQUcsQ0FBQzthQUN4QjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBTSxjQUFjLEdBQUcsV0FBVyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZFLE9BQU8sY0FBYyxDQUFDLENBQUMsQ0FBQyxNQUFJLElBQUksTUFBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDN0MsQ0FBQztJQWxCRCw0Q0FrQkM7SUFFRCxTQUFTLGFBQWEsQ0FBQyxLQUFhO1FBQ2xDLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUNiLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDOUIsR0FBRyxJQUFJLFlBQVksQ0FBQztTQUNyQjtRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0X2FzdCc7XG5pbXBvcnQge1NvdXJjZU1hcEdlbmVyYXRvcn0gZnJvbSAnLi9zb3VyY2VfbWFwJztcblxuY29uc3QgX1NJTkdMRV9RVU9URV9FU0NBUEVfU1RSSU5HX1JFID0gLyd8XFxcXHxcXG58XFxyfFxcJC9nO1xuY29uc3QgX0xFR0FMX0lERU5USUZJRVJfUkUgPSAvXlskQS1aX11bMC05QS1aXyRdKiQvaTtcbmNvbnN0IF9JTkRFTlRfV0lUSCA9ICcgICc7XG5leHBvcnQgY29uc3QgQ0FUQ0hfRVJST1JfVkFSID0gby52YXJpYWJsZSgnZXJyb3InLCBudWxsLCBudWxsKTtcbmV4cG9ydCBjb25zdCBDQVRDSF9TVEFDS19WQVIgPSBvLnZhcmlhYmxlKCdzdGFjaycsIG51bGwsIG51bGwpO1xuXG5leHBvcnQgaW50ZXJmYWNlIE91dHB1dEVtaXR0ZXIge1xuICBlbWl0U3RhdGVtZW50cyhnZW5GaWxlUGF0aDogc3RyaW5nLCBzdG10czogby5TdGF0ZW1lbnRbXSwgcHJlYW1ibGU/OiBzdHJpbmd8bnVsbCk6IHN0cmluZztcbn1cblxuY2xhc3MgX0VtaXR0ZWRMaW5lIHtcbiAgcGFydHNMZW5ndGggPSAwO1xuICBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgc3JjU3BhbnM6IChQYXJzZVNvdXJjZVNwYW58bnVsbClbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgaW5kZW50OiBudW1iZXIpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBFbWl0dGVyVmlzaXRvckNvbnRleHQge1xuICBzdGF0aWMgY3JlYXRlUm9vdCgpOiBFbWl0dGVyVmlzaXRvckNvbnRleHQgeyByZXR1cm4gbmV3IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCgwKTsgfVxuXG4gIHByaXZhdGUgX2xpbmVzOiBfRW1pdHRlZExpbmVbXTtcbiAgcHJpdmF0ZSBfY2xhc3Nlczogby5DbGFzc1N0bXRbXSA9IFtdO1xuICBwcml2YXRlIF9wcmVhbWJsZUxpbmVDb3VudCA9IDA7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfaW5kZW50OiBudW1iZXIpIHsgdGhpcy5fbGluZXMgPSBbbmV3IF9FbWl0dGVkTGluZShfaW5kZW50KV07IH1cblxuICBwcml2YXRlIGdldCBfY3VycmVudExpbmUoKTogX0VtaXR0ZWRMaW5lIHsgcmV0dXJuIHRoaXMuX2xpbmVzW3RoaXMuX2xpbmVzLmxlbmd0aCAtIDFdOyB9XG5cbiAgcHJpbnRsbihmcm9tPzoge3NvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiB8IG51bGx9fG51bGwsIGxhc3RQYXJ0OiBzdHJpbmcgPSAnJyk6IHZvaWQge1xuICAgIHRoaXMucHJpbnQoZnJvbSB8fCBudWxsLCBsYXN0UGFydCwgdHJ1ZSk7XG4gIH1cblxuICBsaW5lSXNFbXB0eSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2N1cnJlbnRMaW5lLnBhcnRzLmxlbmd0aCA9PT0gMDsgfVxuXG4gIGxpbmVMZW5ndGgoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fY3VycmVudExpbmUuaW5kZW50ICogX0lOREVOVF9XSVRILmxlbmd0aCArIHRoaXMuX2N1cnJlbnRMaW5lLnBhcnRzTGVuZ3RoO1xuICB9XG5cbiAgcHJpbnQoZnJvbToge3NvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiB8IG51bGx9fG51bGwsIHBhcnQ6IHN0cmluZywgbmV3TGluZTogYm9vbGVhbiA9IGZhbHNlKSB7XG4gICAgaWYgKHBhcnQubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fY3VycmVudExpbmUucGFydHMucHVzaChwYXJ0KTtcbiAgICAgIHRoaXMuX2N1cnJlbnRMaW5lLnBhcnRzTGVuZ3RoICs9IHBhcnQubGVuZ3RoO1xuICAgICAgdGhpcy5fY3VycmVudExpbmUuc3JjU3BhbnMucHVzaChmcm9tICYmIGZyb20uc291cmNlU3BhbiB8fCBudWxsKTtcbiAgICB9XG4gICAgaWYgKG5ld0xpbmUpIHtcbiAgICAgIHRoaXMuX2xpbmVzLnB1c2gobmV3IF9FbWl0dGVkTGluZSh0aGlzLl9pbmRlbnQpKTtcbiAgICB9XG4gIH1cblxuICByZW1vdmVFbXB0eUxhc3RMaW5lKCkge1xuICAgIGlmICh0aGlzLmxpbmVJc0VtcHR5KCkpIHtcbiAgICAgIHRoaXMuX2xpbmVzLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIGluY0luZGVudCgpIHtcbiAgICB0aGlzLl9pbmRlbnQrKztcbiAgICBpZiAodGhpcy5saW5lSXNFbXB0eSgpKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TGluZS5pbmRlbnQgPSB0aGlzLl9pbmRlbnQ7XG4gICAgfVxuICB9XG5cbiAgZGVjSW5kZW50KCkge1xuICAgIHRoaXMuX2luZGVudC0tO1xuICAgIGlmICh0aGlzLmxpbmVJc0VtcHR5KCkpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRMaW5lLmluZGVudCA9IHRoaXMuX2luZGVudDtcbiAgICB9XG4gIH1cblxuICBwdXNoQ2xhc3MoY2xheno6IG8uQ2xhc3NTdG10KSB7IHRoaXMuX2NsYXNzZXMucHVzaChjbGF6eik7IH1cblxuICBwb3BDbGFzcygpOiBvLkNsYXNzU3RtdCB7IHJldHVybiB0aGlzLl9jbGFzc2VzLnBvcCgpICE7IH1cblxuICBnZXQgY3VycmVudENsYXNzKCk6IG8uQ2xhc3NTdG10fG51bGwge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc2VzLmxlbmd0aCA+IDAgPyB0aGlzLl9jbGFzc2VzW3RoaXMuX2NsYXNzZXMubGVuZ3RoIC0gMV0gOiBudWxsO1xuICB9XG5cbiAgdG9Tb3VyY2UoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5zb3VyY2VMaW5lc1xuICAgICAgICAubWFwKGwgPT4gbC5wYXJ0cy5sZW5ndGggPiAwID8gX2NyZWF0ZUluZGVudChsLmluZGVudCkgKyBsLnBhcnRzLmpvaW4oJycpIDogJycpXG4gICAgICAgIC5qb2luKCdcXG4nKTtcbiAgfVxuXG4gIHRvU291cmNlTWFwR2VuZXJhdG9yKGdlbkZpbGVQYXRoOiBzdHJpbmcsIHN0YXJ0c0F0TGluZTogbnVtYmVyID0gMCk6IFNvdXJjZU1hcEdlbmVyYXRvciB7XG4gICAgY29uc3QgbWFwID0gbmV3IFNvdXJjZU1hcEdlbmVyYXRvcihnZW5GaWxlUGF0aCk7XG5cbiAgICBsZXQgZmlyc3RPZmZzZXRNYXBwZWQgPSBmYWxzZTtcbiAgICBjb25zdCBtYXBGaXJzdE9mZnNldElmTmVlZGVkID0gKCkgPT4ge1xuICAgICAgaWYgKCFmaXJzdE9mZnNldE1hcHBlZCkge1xuICAgICAgICAvLyBBZGQgYSBzaW5nbGUgc3BhY2Ugc28gdGhhdCB0b29scyB3b24ndCB0cnkgdG8gbG9hZCB0aGUgZmlsZSBmcm9tIGRpc2suXG4gICAgICAgIC8vIE5vdGU6IFdlIGFyZSB1c2luZyB2aXJ0dWFsIHVybHMgbGlrZSBgbmc6Ly8vYCwgc28gd2UgaGF2ZSB0b1xuICAgICAgICAvLyBwcm92aWRlIGEgY29udGVudCBoZXJlLlxuICAgICAgICBtYXAuYWRkU291cmNlKGdlbkZpbGVQYXRoLCAnICcpLmFkZE1hcHBpbmcoMCwgZ2VuRmlsZVBhdGgsIDAsIDApO1xuICAgICAgICBmaXJzdE9mZnNldE1hcHBlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhcnRzQXRMaW5lOyBpKyspIHtcbiAgICAgIG1hcC5hZGRMaW5lKCk7XG4gICAgICBtYXBGaXJzdE9mZnNldElmTmVlZGVkKCk7XG4gICAgfVxuXG4gICAgdGhpcy5zb3VyY2VMaW5lcy5mb3JFYWNoKChsaW5lLCBsaW5lSWR4KSA9PiB7XG4gICAgICBtYXAuYWRkTGluZSgpO1xuXG4gICAgICBjb25zdCBzcGFucyA9IGxpbmUuc3JjU3BhbnM7XG4gICAgICBjb25zdCBwYXJ0cyA9IGxpbmUucGFydHM7XG4gICAgICBsZXQgY29sMCA9IGxpbmUuaW5kZW50ICogX0lOREVOVF9XSVRILmxlbmd0aDtcbiAgICAgIGxldCBzcGFuSWR4ID0gMDtcbiAgICAgIC8vIHNraXAgbGVhZGluZyBwYXJ0cyB3aXRob3V0IHNvdXJjZSBzcGFuc1xuICAgICAgd2hpbGUgKHNwYW5JZHggPCBzcGFucy5sZW5ndGggJiYgIXNwYW5zW3NwYW5JZHhdKSB7XG4gICAgICAgIGNvbDAgKz0gcGFydHNbc3BhbklkeF0ubGVuZ3RoO1xuICAgICAgICBzcGFuSWR4Kys7XG4gICAgICB9XG4gICAgICBpZiAoc3BhbklkeCA8IHNwYW5zLmxlbmd0aCAmJiBsaW5lSWR4ID09PSAwICYmIGNvbDAgPT09IDApIHtcbiAgICAgICAgZmlyc3RPZmZzZXRNYXBwZWQgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFwRmlyc3RPZmZzZXRJZk5lZWRlZCgpO1xuICAgICAgfVxuXG4gICAgICB3aGlsZSAoc3BhbklkeCA8IHNwYW5zLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBzcGFuID0gc3BhbnNbc3BhbklkeF0gITtcbiAgICAgICAgY29uc3Qgc291cmNlID0gc3Bhbi5zdGFydC5maWxlO1xuICAgICAgICBjb25zdCBzb3VyY2VMaW5lID0gc3Bhbi5zdGFydC5saW5lO1xuICAgICAgICBjb25zdCBzb3VyY2VDb2wgPSBzcGFuLnN0YXJ0LmNvbDtcbiAgICAgICAgbWFwLmFkZFNvdXJjZShzb3VyY2UudXJsLCBzb3VyY2UuY29udGVudClcbiAgICAgICAgICAgIC5hZGRNYXBwaW5nKGNvbDAsIHNvdXJjZS51cmwsIHNvdXJjZUxpbmUsIHNvdXJjZUNvbCk7XG5cbiAgICAgICAgY29sMCArPSBwYXJ0c1tzcGFuSWR4XS5sZW5ndGg7XG4gICAgICAgIHNwYW5JZHgrKztcblxuICAgICAgICAvLyBhc3NpZ24gcGFydHMgd2l0aG91dCBzcGFuIG9yIHRoZSBzYW1lIHNwYW4gdG8gdGhlIHByZXZpb3VzIHNlZ21lbnRcbiAgICAgICAgd2hpbGUgKHNwYW5JZHggPCBzcGFucy5sZW5ndGggJiYgKHNwYW4gPT09IHNwYW5zW3NwYW5JZHhdIHx8ICFzcGFuc1tzcGFuSWR4XSkpIHtcbiAgICAgICAgICBjb2wwICs9IHBhcnRzW3NwYW5JZHhdLmxlbmd0aDtcbiAgICAgICAgICBzcGFuSWR4Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtYXA7XG4gIH1cblxuICBzZXRQcmVhbWJsZUxpbmVDb3VudChjb3VudDogbnVtYmVyKSB7IHJldHVybiB0aGlzLl9wcmVhbWJsZUxpbmVDb3VudCA9IGNvdW50OyB9XG5cbiAgc3Bhbk9mKGxpbmU6IG51bWJlciwgY29sdW1uOiBudW1iZXIpOiBQYXJzZVNvdXJjZVNwYW58bnVsbCB7XG4gICAgY29uc3QgZW1pdHRlZExpbmUgPSB0aGlzLl9saW5lc1tsaW5lIC0gdGhpcy5fcHJlYW1ibGVMaW5lQ291bnRdO1xuICAgIGlmIChlbWl0dGVkTGluZSkge1xuICAgICAgbGV0IGNvbHVtbnNMZWZ0ID0gY29sdW1uIC0gX2NyZWF0ZUluZGVudChlbWl0dGVkTGluZS5pbmRlbnQpLmxlbmd0aDtcbiAgICAgIGZvciAobGV0IHBhcnRJbmRleCA9IDA7IHBhcnRJbmRleCA8IGVtaXR0ZWRMaW5lLnBhcnRzLmxlbmd0aDsgcGFydEluZGV4KyspIHtcbiAgICAgICAgY29uc3QgcGFydCA9IGVtaXR0ZWRMaW5lLnBhcnRzW3BhcnRJbmRleF07XG4gICAgICAgIGlmIChwYXJ0Lmxlbmd0aCA+IGNvbHVtbnNMZWZ0KSB7XG4gICAgICAgICAgcmV0dXJuIGVtaXR0ZWRMaW5lLnNyY1NwYW5zW3BhcnRJbmRleF07XG4gICAgICAgIH1cbiAgICAgICAgY29sdW1uc0xlZnQgLT0gcGFydC5sZW5ndGg7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXQgc291cmNlTGluZXMoKTogX0VtaXR0ZWRMaW5lW10ge1xuICAgIGlmICh0aGlzLl9saW5lcy5sZW5ndGggJiYgdGhpcy5fbGluZXNbdGhpcy5fbGluZXMubGVuZ3RoIC0gMV0ucGFydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbGluZXMuc2xpY2UoMCwgLTEpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fbGluZXM7XG4gIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RW1pdHRlclZpc2l0b3IgaW1wbGVtZW50cyBvLlN0YXRlbWVudFZpc2l0b3IsIG8uRXhwcmVzc2lvblZpc2l0b3Ige1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9lc2NhcGVEb2xsYXJJblN0cmluZ3M6IGJvb2xlYW4pIHt9XG5cbiAgdmlzaXRFeHByZXNzaW9uU3RtdChzdG10OiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBzdG10LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgJzsnKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0UmV0dXJuU3RtdChzdG10OiBvLlJldHVyblN0YXRlbWVudCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChzdG10LCBgcmV0dXJuIGApO1xuICAgIHN0bXQudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgJzsnKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFic3RyYWN0IHZpc2l0Q2FzdEV4cHIoYXN0OiBvLkNhc3RFeHByLCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgYWJzdHJhY3QgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueTtcblxuICB2aXNpdElmU3RtdChzdG10OiBvLklmU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChzdG10LCBgaWYgKGApO1xuICAgIHN0bXQuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChzdG10LCBgKSB7YCk7XG4gICAgY29uc3QgaGFzRWxzZUNhc2UgPSBzdG10LmZhbHNlQ2FzZSAhPSBudWxsICYmIHN0bXQuZmFsc2VDYXNlLmxlbmd0aCA+IDA7XG4gICAgaWYgKHN0bXQudHJ1ZUNhc2UubGVuZ3RoIDw9IDEgJiYgIWhhc0Vsc2VDYXNlKSB7XG4gICAgICBjdHgucHJpbnQoc3RtdCwgYCBgKTtcbiAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQudHJ1ZUNhc2UsIGN0eCk7XG4gICAgICBjdHgucmVtb3ZlRW1wdHlMYXN0TGluZSgpO1xuICAgICAgY3R4LnByaW50KHN0bXQsIGAgYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0eC5wcmludGxuKCk7XG4gICAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgICB0aGlzLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10LnRydWVDYXNlLCBjdHgpO1xuICAgICAgY3R4LmRlY0luZGVudCgpO1xuICAgICAgaWYgKGhhc0Vsc2VDYXNlKSB7XG4gICAgICAgIGN0eC5wcmludGxuKHN0bXQsIGB9IGVsc2Uge2ApO1xuICAgICAgICBjdHguaW5jSW5kZW50KCk7XG4gICAgICAgIHRoaXMudmlzaXRBbGxTdGF0ZW1lbnRzKHN0bXQuZmFsc2VDYXNlLCBjdHgpO1xuICAgICAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgICB9XG4gICAgfVxuICAgIGN0eC5wcmludGxuKHN0bXQsIGB9YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhYnN0cmFjdCB2aXNpdFRyeUNhdGNoU3RtdChzdG10OiBvLlRyeUNhdGNoU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnk7XG5cbiAgdmlzaXRUaHJvd1N0bXQoc3RtdDogby5UaHJvd1N0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoc3RtdCwgYHRocm93IGApO1xuICAgIHN0bXQuZXJyb3IudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50bG4oc3RtdCwgYDtgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdENvbW1lbnRTdG10KHN0bXQ6IG8uQ29tbWVudFN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBpZiAoc3RtdC5tdWx0aWxpbmUpIHtcbiAgICAgIGN0eC5wcmludGxuKHN0bXQsIGAvKiAke3N0bXQuY29tbWVudH0gKi9gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RtdC5jb21tZW50LnNwbGl0KCdcXG4nKS5mb3JFYWNoKChsaW5lKSA9PiB7IGN0eC5wcmludGxuKHN0bXQsIGAvLyAke2xpbmV9YCk7IH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEpTRG9jQ29tbWVudFN0bXQoc3RtdDogby5KU0RvY0NvbW1lbnRTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCkge1xuICAgIGN0eC5wcmludGxuKHN0bXQsIGAvKiR7c3RtdC50b1N0cmluZygpfSovYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBhYnN0cmFjdCB2aXNpdERlY2xhcmVWYXJTdG10KHN0bXQ6IG8uRGVjbGFyZVZhclN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55O1xuXG4gIHZpc2l0V3JpdGVWYXJFeHByKGV4cHI6IG8uV3JpdGVWYXJFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbGluZVdhc0VtcHR5ID0gY3R4LmxpbmVJc0VtcHR5KCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKCcpO1xuICAgIH1cbiAgICBjdHgucHJpbnQoZXhwciwgYCR7ZXhwci5uYW1lfSA9IGApO1xuICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKScpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFdyaXRlS2V5RXhwcihleHByOiBvLldyaXRlS2V5RXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGxpbmVXYXNFbXB0eSA9IGN0eC5saW5lSXNFbXB0eSgpO1xuICAgIGlmICghbGluZVdhc0VtcHR5KSB7XG4gICAgICBjdHgucHJpbnQoZXhwciwgJygnKTtcbiAgICB9XG4gICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoZXhwciwgYFtgKTtcbiAgICBleHByLmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChleHByLCBgXSA9IGApO1xuICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKScpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdFdyaXRlUHJvcEV4cHIoZXhwcjogby5Xcml0ZVByb3BFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbGluZVdhc0VtcHR5ID0gY3R4LmxpbmVJc0VtcHR5KCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKCcpO1xuICAgIH1cbiAgICBleHByLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChleHByLCBgLiR7ZXhwci5uYW1lfSA9IGApO1xuICAgIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgaWYgKCFsaW5lV2FzRW1wdHkpIHtcbiAgICAgIGN0eC5wcmludChleHByLCAnKScpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdEludm9rZU1ldGhvZEV4cHIoZXhwcjogby5JbnZva2VNZXRob2RFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBsZXQgbmFtZSA9IGV4cHIubmFtZTtcbiAgICBpZiAoZXhwci5idWlsdGluICE9IG51bGwpIHtcbiAgICAgIG5hbWUgPSB0aGlzLmdldEJ1aWx0aW5NZXRob2ROYW1lKGV4cHIuYnVpbHRpbik7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIC8vIHNvbWUgYnVpbHRpbnMganVzdCBtZWFuIHRvIHNraXAgdGhlIGNhbGwuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBjdHgucHJpbnQoZXhwciwgYC4ke25hbWV9KGApO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhleHByLmFyZ3MsIGN0eCwgYCxgKTtcbiAgICBjdHgucHJpbnQoZXhwciwgYClgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGFic3RyYWN0IGdldEJ1aWx0aW5NZXRob2ROYW1lKG1ldGhvZDogby5CdWlsdGluTWV0aG9kKTogc3RyaW5nO1xuXG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKGV4cHI6IG8uSW52b2tlRnVuY3Rpb25FeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgZXhwci5mbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoZXhwciwgYChgKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwci5hcmdzLCBjdHgsICcsJyk7XG4gICAgY3R4LnByaW50KGV4cHIsIGApYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIoYXN0OiBvLldyYXBwZWROb2RlRXhwcjxhbnk+LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBYnN0cmFjdCBlbWl0dGVyIGNhbm5vdCB2aXNpdCBXcmFwcGVkTm9kZUV4cHIuJyk7XG4gIH1cbiAgdmlzaXRUeXBlb2ZFeHByKGV4cHI6IG8uVHlwZW9mRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChleHByLCAndHlwZW9mICcpO1xuICAgIGV4cHIuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgfVxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogby5SZWFkVmFyRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGxldCB2YXJOYW1lID0gYXN0Lm5hbWUgITtcbiAgICBpZiAoYXN0LmJ1aWx0aW4gIT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChhc3QuYnVpbHRpbikge1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5TdXBlcjpcbiAgICAgICAgICB2YXJOYW1lID0gJ3N1cGVyJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBvLkJ1aWx0aW5WYXIuVGhpczpcbiAgICAgICAgICB2YXJOYW1lID0gJ3RoaXMnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaEVycm9yOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9FUlJPUl9WQVIubmFtZSAhO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIG8uQnVpbHRpblZhci5DYXRjaFN0YWNrOlxuICAgICAgICAgIHZhck5hbWUgPSBDQVRDSF9TVEFDS19WQVIubmFtZSAhO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsdGluIHZhcmlhYmxlICR7YXN0LmJ1aWx0aW59YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGN0eC5wcmludChhc3QsIHZhck5hbWUpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogby5JbnN0YW50aWF0ZUV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCBgbmV3IGApO1xuICAgIGFzdC5jbGFzc0V4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgYChgKTtcbiAgICB0aGlzLnZpc2l0QWxsRXhwcmVzc2lvbnMoYXN0LmFyZ3MsIGN0eCwgJywnKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgKWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsRXhwcihhc3Q6IG8uTGl0ZXJhbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZSA9IGFzdC52YWx1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgY3R4LnByaW50KGFzdCwgZXNjYXBlSWRlbnRpZmllcih2YWx1ZSwgdGhpcy5fZXNjYXBlRG9sbGFySW5TdHJpbmdzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0eC5wcmludChhc3QsIGAke3ZhbHVlfWApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogby5Mb2NhbGl6ZWRTdHJpbmcsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCAnJGxvY2FsaXplIGAnICsgYXN0Lm1lc3NhZ2VQYXJ0c1swXSk7XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBhc3QubWVzc2FnZVBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjdHgucHJpbnQoYXN0LCAnJHsnKTtcbiAgICAgIGFzdC5leHByZXNzaW9uc1tpIC0gMV0udmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgICAvLyBBZGQgdGhlIHBsYWNlaG9sZGVyIG5hbWUgYW5ub3RhdGlvbiB0byBzdXBwb3J0IHJ1bnRpbWUgaW5saW5pbmdcbiAgICAgIGN0eC5wcmludChhc3QsIGB9OiR7YXN0LnBsYWNlSG9sZGVyTmFtZXNbaSAtIDFdfTpgKTtcbiAgICAgIGN0eC5wcmludChhc3QsIGFzdC5tZXNzYWdlUGFydHNbaV0pO1xuICAgIH1cbiAgICBjdHgucHJpbnQoYXN0LCAnYCcpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgYWJzdHJhY3QgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBvLkV4dGVybmFsRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnk7XG5cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBvLkNvbmRpdGlvbmFsRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGN0eC5wcmludChhc3QsIGAoYCk7XG4gICAgYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBjdHgucHJpbnQoYXN0LCAnPyAnKTtcbiAgICBhc3QudHJ1ZUNhc2UudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgJzogJyk7XG4gICAgYXN0LmZhbHNlQ2FzZSAhLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGApYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXROb3RFeHByKGFzdDogby5Ob3RFeHByLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgY3R4LnByaW50KGFzdCwgJyEnKTtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0QXNzZXJ0Tm90TnVsbEV4cHIoYXN0OiBvLkFzc2VydE5vdE51bGwsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGFic3RyYWN0IHZpc2l0RnVuY3Rpb25FeHByKGFzdDogby5GdW5jdGlvbkV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55O1xuICBhYnN0cmFjdCB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogby5EZWNsYXJlRnVuY3Rpb25TdG10LCBjb250ZXh0OiBhbnkpOiBhbnk7XG5cbiAgdmlzaXRCaW5hcnlPcGVyYXRvckV4cHIoYXN0OiBvLkJpbmFyeU9wZXJhdG9yRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGxldCBvcFN0cjogc3RyaW5nO1xuICAgIHN3aXRjaCAoYXN0Lm9wZXJhdG9yKSB7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuRXF1YWxzOlxuICAgICAgICBvcFN0ciA9ICc9PSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbDpcbiAgICAgICAgb3BTdHIgPSAnPT09JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzOlxuICAgICAgICBvcFN0ciA9ICchPSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk5vdElkZW50aWNhbDpcbiAgICAgICAgb3BTdHIgPSAnIT09JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuQW5kOlxuICAgICAgICBvcFN0ciA9ICcmJic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkJpdHdpc2VBbmQ6XG4gICAgICAgIG9wU3RyID0gJyYnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5PcjpcbiAgICAgICAgb3BTdHIgPSAnfHwnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5QbHVzOlxuICAgICAgICBvcFN0ciA9ICcrJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTWludXM6XG4gICAgICAgIG9wU3RyID0gJy0nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5EaXZpZGU6XG4gICAgICAgIG9wU3RyID0gJy8nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2Ugby5CaW5hcnlPcGVyYXRvci5NdWx0aXBseTpcbiAgICAgICAgb3BTdHIgPSAnKic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLk1vZHVsbzpcbiAgICAgICAgb3BTdHIgPSAnJSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyOlxuICAgICAgICBvcFN0ciA9ICc8JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHM6XG4gICAgICAgIG9wU3RyID0gJzw9JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyOlxuICAgICAgICBvcFN0ciA9ICc+JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyRXF1YWxzOlxuICAgICAgICBvcFN0ciA9ICc+PSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cbiAgICBpZiAoYXN0LnBhcmVucykgY3R4LnByaW50KGFzdCwgYChgKTtcbiAgICBhc3QubGhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpO1xuICAgIGN0eC5wcmludChhc3QsIGAgJHtvcFN0cn0gYCk7XG4gICAgYXN0LnJocy52aXNpdEV4cHJlc3Npb24odGhpcywgY3R4KTtcbiAgICBpZiAoYXN0LnBhcmVucykgY3R4LnByaW50KGFzdCwgYClgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogby5SZWFkUHJvcEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgYC5gKTtcbiAgICBjdHgucHJpbnQoYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IG8uUmVhZEtleUV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgYFtgKTtcbiAgICBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgY3R4LnByaW50KGFzdCwgYF1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdExpdGVyYWxBcnJheUV4cHIoYXN0OiBvLkxpdGVyYWxBcnJheUV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCBgW2ApO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QuZW50cmllcywgY3R4LCAnLCcpO1xuICAgIGN0eC5wcmludChhc3QsIGBdYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXRMaXRlcmFsTWFwRXhwcihhc3Q6IG8uTGl0ZXJhbE1hcEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCBge2ApO1xuICAgIHRoaXMudmlzaXRBbGxPYmplY3RzKGVudHJ5ID0+IHtcbiAgICAgIGN0eC5wcmludChhc3QsIGAke2VzY2FwZUlkZW50aWZpZXIoZW50cnkua2V5LCB0aGlzLl9lc2NhcGVEb2xsYXJJblN0cmluZ3MsIGVudHJ5LnF1b3RlZCl9OmApO1xuICAgICAgZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGN0eCk7XG4gICAgfSwgYXN0LmVudHJpZXMsIGN0eCwgJywnKTtcbiAgICBjdHgucHJpbnQoYXN0LCBgfWApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0Q29tbWFFeHByKGFzdDogby5Db21tYUV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjdHgucHJpbnQoYXN0LCAnKCcpO1xuICAgIHRoaXMudmlzaXRBbGxFeHByZXNzaW9ucyhhc3QucGFydHMsIGN0eCwgJywnKTtcbiAgICBjdHgucHJpbnQoYXN0LCAnKScpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0QWxsRXhwcmVzc2lvbnMoZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdLCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCwgc2VwYXJhdG9yOiBzdHJpbmcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy52aXNpdEFsbE9iamVjdHMoZXhwciA9PiBleHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjdHgpLCBleHByZXNzaW9ucywgY3R4LCBzZXBhcmF0b3IpO1xuICB9XG5cbiAgdmlzaXRBbGxPYmplY3RzPFQ+KFxuICAgICAgaGFuZGxlcjogKHQ6IFQpID0+IHZvaWQsIGV4cHJlc3Npb25zOiBUW10sIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0LFxuICAgICAgc2VwYXJhdG9yOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBsZXQgaW5jcmVtZW50ZWRJbmRlbnQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHJlc3Npb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgaWYgKGN0eC5saW5lTGVuZ3RoKCkgPiA4MCkge1xuICAgICAgICAgIGN0eC5wcmludChudWxsLCBzZXBhcmF0b3IsIHRydWUpO1xuICAgICAgICAgIGlmICghaW5jcmVtZW50ZWRJbmRlbnQpIHtcbiAgICAgICAgICAgIC8vIGNvbnRpbnVhdGlvbiBhcmUgbWFya2VkIHdpdGggZG91YmxlIGluZGVudC5cbiAgICAgICAgICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICAgICAgICAgIGN0eC5pbmNJbmRlbnQoKTtcbiAgICAgICAgICAgIGluY3JlbWVudGVkSW5kZW50ID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3R4LnByaW50KG51bGwsIHNlcGFyYXRvciwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBoYW5kbGVyKGV4cHJlc3Npb25zW2ldKTtcbiAgICB9XG4gICAgaWYgKGluY3JlbWVudGVkSW5kZW50KSB7XG4gICAgICAvLyBjb250aW51YXRpb24gYXJlIG1hcmtlZCB3aXRoIGRvdWJsZSBpbmRlbnQuXG4gICAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgICBjdHguZGVjSW5kZW50KCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRBbGxTdGF0ZW1lbnRzKHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogdm9pZCB7XG4gICAgc3RhdGVtZW50cy5mb3JFYWNoKChzdG10KSA9PiBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGN0eCkpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVJZGVudGlmaWVyKFxuICAgIGlucHV0OiBzdHJpbmcsIGVzY2FwZURvbGxhcjogYm9vbGVhbiwgYWx3YXlzUXVvdGU6IGJvb2xlYW4gPSB0cnVlKTogYW55IHtcbiAgaWYgKGlucHV0ID09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBib2R5ID0gaW5wdXQucmVwbGFjZShfU0lOR0xFX1FVT1RFX0VTQ0FQRV9TVFJJTkdfUkUsICguLi5tYXRjaDogc3RyaW5nW10pID0+IHtcbiAgICBpZiAobWF0Y2hbMF0gPT0gJyQnKSB7XG4gICAgICByZXR1cm4gZXNjYXBlRG9sbGFyID8gJ1xcXFwkJyA6ICckJztcbiAgICB9IGVsc2UgaWYgKG1hdGNoWzBdID09ICdcXG4nKSB7XG4gICAgICByZXR1cm4gJ1xcXFxuJztcbiAgICB9IGVsc2UgaWYgKG1hdGNoWzBdID09ICdcXHInKSB7XG4gICAgICByZXR1cm4gJ1xcXFxyJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGBcXFxcJHttYXRjaFswXX1gO1xuICAgIH1cbiAgfSk7XG4gIGNvbnN0IHJlcXVpcmVzUXVvdGVzID0gYWx3YXlzUXVvdGUgfHwgIV9MRUdBTF9JREVOVElGSUVSX1JFLnRlc3QoYm9keSk7XG4gIHJldHVybiByZXF1aXJlc1F1b3RlcyA/IGAnJHtib2R5fSdgIDogYm9keTtcbn1cblxuZnVuY3Rpb24gX2NyZWF0ZUluZGVudChjb3VudDogbnVtYmVyKTogc3RyaW5nIHtcbiAgbGV0IHJlcyA9ICcnO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICByZXMgKz0gX0lOREVOVF9XSVRIO1xuICB9XG4gIHJldHVybiByZXM7XG59XG4iXX0=