/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
        define("@angular/compiler/src/constant_pool", ["require", "exports", "tslib", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ConstantPool = void 0;
    var tslib_1 = require("tslib");
    var o = require("@angular/compiler/src/output/output_ast");
    var util_1 = require("@angular/compiler/src/util");
    var CONSTANT_PREFIX = '_c';
    /**
     * `ConstantPool` tries to reuse literal factories when two or more literals are identical.
     * We determine whether literals are identical by creating a key out of their AST using the
     * `KeyVisitor`. This constant is used to replace dynamic expressions which can't be safely
     * converted into a key. E.g. given an expression `{foo: bar()}`, since we don't know what
     * the result of `bar` will be, we create a key that looks like `{foo: <unknown>}`. Note
     * that we use a variable, rather than something like `null` in order to avoid collisions.
     */
    var UNKNOWN_VALUE_KEY = o.variable('<unknown>');
    /**
     * Context to use when producing a key.
     *
     * This ensures we see the constant not the reference variable when producing
     * a key.
     */
    var KEY_CONTEXT = {};
    /**
     * Generally all primitive values are excluded from the `ConstantPool`, but there is an exclusion
     * for strings that reach a certain length threshold. This constant defines the length threshold for
     * strings.
     */
    var POOL_INCLUSION_LENGTH_THRESHOLD_FOR_STRINGS = 50;
    /**
     * A node that is a place-holder that allows the node to be replaced when the actual
     * node is known.
     *
     * This allows the constant pool to change an expression from a direct reference to
     * a constant to a shared constant. It returns a fix-up node that is later allowed to
     * change the referenced expression.
     */
    var FixupExpression = /** @class */ (function (_super) {
        tslib_1.__extends(FixupExpression, _super);
        function FixupExpression(resolved) {
            var _this = _super.call(this, resolved.type) || this;
            _this.resolved = resolved;
            _this.original = resolved;
            return _this;
        }
        FixupExpression.prototype.visitExpression = function (visitor, context) {
            if (context === KEY_CONTEXT) {
                // When producing a key we want to traverse the constant not the
                // variable used to refer to it.
                return this.original.visitExpression(visitor, context);
            }
            else {
                return this.resolved.visitExpression(visitor, context);
            }
        };
        FixupExpression.prototype.isEquivalent = function (e) {
            return e instanceof FixupExpression && this.resolved.isEquivalent(e.resolved);
        };
        FixupExpression.prototype.isConstant = function () {
            return true;
        };
        FixupExpression.prototype.fixup = function (expression) {
            this.resolved = expression;
            this.shared = true;
        };
        return FixupExpression;
    }(o.Expression));
    /**
     * A constant pool allows a code emitter to share constant in an output context.
     *
     * The constant pool also supports sharing access to ivy definitions references.
     */
    var ConstantPool = /** @class */ (function () {
        function ConstantPool() {
            this.statements = [];
            this.literals = new Map();
            this.literalFactories = new Map();
            this.injectorDefinitions = new Map();
            this.directiveDefinitions = new Map();
            this.componentDefinitions = new Map();
            this.pipeDefinitions = new Map();
            this.nextNameIndex = 0;
        }
        ConstantPool.prototype.getConstLiteral = function (literal, forceShared) {
            if ((literal instanceof o.LiteralExpr && !isLongStringExpr(literal)) ||
                literal instanceof FixupExpression) {
                // Do no put simple literals into the constant pool or try to produce a constant for a
                // reference to a constant.
                return literal;
            }
            var key = this.keyOf(literal);
            var fixup = this.literals.get(key);
            var newValue = false;
            if (!fixup) {
                fixup = new FixupExpression(literal);
                this.literals.set(key, fixup);
                newValue = true;
            }
            if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
                // Replace the expression with a variable
                var name_1 = this.freshName();
                this.statements.push(o.variable(name_1).set(literal).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
                fixup.fixup(o.variable(name_1));
            }
            return fixup;
        };
        ConstantPool.prototype.getDefinition = function (type, kind, ctx, forceShared) {
            if (forceShared === void 0) { forceShared = false; }
            var definitions = this.definitionsOf(kind);
            var fixup = definitions.get(type);
            var newValue = false;
            if (!fixup) {
                var property = this.propertyNameOf(kind);
                fixup = new FixupExpression(ctx.importExpr(type).prop(property));
                definitions.set(type, fixup);
                newValue = true;
            }
            if ((!newValue && !fixup.shared) || (newValue && forceShared)) {
                var name_2 = this.freshName();
                this.statements.push(o.variable(name_2).set(fixup.resolved).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
                fixup.fixup(o.variable(name_2));
            }
            return fixup;
        };
        ConstantPool.prototype.getLiteralFactory = function (literal) {
            // Create a pure function that builds an array of a mix of constant and variable expressions
            if (literal instanceof o.LiteralArrayExpr) {
                var argumentsForKey = literal.entries.map(function (e) { return e.isConstant() ? e : UNKNOWN_VALUE_KEY; });
                var key = this.keyOf(o.literalArr(argumentsForKey));
                return this._getLiteralFactory(key, literal.entries, function (entries) { return o.literalArr(entries); });
            }
            else {
                var expressionForKey = o.literalMap(literal.entries.map(function (e) { return ({
                    key: e.key,
                    value: e.value.isConstant() ? e.value : UNKNOWN_VALUE_KEY,
                    quoted: e.quoted
                }); }));
                var key = this.keyOf(expressionForKey);
                return this._getLiteralFactory(key, literal.entries.map(function (e) { return e.value; }), function (entries) { return o.literalMap(entries.map(function (value, index) { return ({
                    key: literal.entries[index].key,
                    value: value,
                    quoted: literal.entries[index].quoted
                }); })); });
            }
        };
        ConstantPool.prototype._getLiteralFactory = function (key, values, resultMap) {
            var _this = this;
            var literalFactory = this.literalFactories.get(key);
            var literalFactoryArguments = values.filter((function (e) { return !e.isConstant(); }));
            if (!literalFactory) {
                var resultExpressions = values.map(function (e, index) { return e.isConstant() ? _this.getConstLiteral(e, true) : o.variable("a" + index); });
                var parameters = resultExpressions.filter(isVariable).map(function (e) { return new o.FnParam(e.name, o.DYNAMIC_TYPE); });
                var pureFunctionDeclaration = o.fn(parameters, [new o.ReturnStatement(resultMap(resultExpressions))], o.INFERRED_TYPE);
                var name_3 = this.freshName();
                this.statements.push(o.variable(name_3).set(pureFunctionDeclaration).toDeclStmt(o.INFERRED_TYPE, [
                    o.StmtModifier.Final
                ]));
                literalFactory = o.variable(name_3);
                this.literalFactories.set(key, literalFactory);
            }
            return { literalFactory: literalFactory, literalFactoryArguments: literalFactoryArguments };
        };
        /**
         * Produce a unique name.
         *
         * The name might be unique among different prefixes if any of the prefixes end in
         * a digit so the prefix should be a constant string (not based on user input) and
         * must not end in a digit.
         */
        ConstantPool.prototype.uniqueName = function (prefix) {
            return "" + prefix + this.nextNameIndex++;
        };
        ConstantPool.prototype.definitionsOf = function (kind) {
            switch (kind) {
                case 2 /* Component */:
                    return this.componentDefinitions;
                case 1 /* Directive */:
                    return this.directiveDefinitions;
                case 0 /* Injector */:
                    return this.injectorDefinitions;
                case 3 /* Pipe */:
                    return this.pipeDefinitions;
            }
            util_1.error("Unknown definition kind " + kind);
            return this.componentDefinitions;
        };
        ConstantPool.prototype.propertyNameOf = function (kind) {
            switch (kind) {
                case 2 /* Component */:
                    return 'ɵcmp';
                case 1 /* Directive */:
                    return 'ɵdir';
                case 0 /* Injector */:
                    return 'ɵinj';
                case 3 /* Pipe */:
                    return 'ɵpipe';
            }
            util_1.error("Unknown definition kind " + kind);
            return '<unknown>';
        };
        ConstantPool.prototype.freshName = function () {
            return this.uniqueName(CONSTANT_PREFIX);
        };
        ConstantPool.prototype.keyOf = function (expression) {
            return expression.visitExpression(new KeyVisitor(), KEY_CONTEXT);
        };
        return ConstantPool;
    }());
    exports.ConstantPool = ConstantPool;
    /**
     * Visitor used to determine if 2 expressions are equivalent and can be shared in the
     * `ConstantPool`.
     *
     * When the id (string) generated by the visitor is equal, expressions are considered equivalent.
     */
    var KeyVisitor = /** @class */ (function () {
        function KeyVisitor() {
            this.visitWrappedNodeExpr = invalid;
            this.visitWriteVarExpr = invalid;
            this.visitWriteKeyExpr = invalid;
            this.visitWritePropExpr = invalid;
            this.visitInvokeMethodExpr = invalid;
            this.visitInvokeFunctionExpr = invalid;
            this.visitInstantiateExpr = invalid;
            this.visitConditionalExpr = invalid;
            this.visitNotExpr = invalid;
            this.visitAssertNotNullExpr = invalid;
            this.visitCastExpr = invalid;
            this.visitFunctionExpr = invalid;
            this.visitBinaryOperatorExpr = invalid;
            this.visitReadPropExpr = invalid;
            this.visitReadKeyExpr = invalid;
            this.visitCommaExpr = invalid;
            this.visitLocalizedString = invalid;
        }
        KeyVisitor.prototype.visitLiteralExpr = function (ast) {
            return "" + (typeof ast.value === 'string' ? '"' + ast.value + '"' : ast.value);
        };
        KeyVisitor.prototype.visitLiteralArrayExpr = function (ast, context) {
            var _this = this;
            return "[" + ast.entries.map(function (entry) { return entry.visitExpression(_this, context); }).join(',') + "]";
        };
        KeyVisitor.prototype.visitLiteralMapExpr = function (ast, context) {
            var _this = this;
            var mapKey = function (entry) {
                var quote = entry.quoted ? '"' : '';
                return "" + quote + entry.key + quote;
            };
            var mapEntry = function (entry) {
                return mapKey(entry) + ":" + entry.value.visitExpression(_this, context);
            };
            return "{" + ast.entries.map(mapEntry).join(',');
        };
        KeyVisitor.prototype.visitExternalExpr = function (ast) {
            return ast.value.moduleName ? "EX:" + ast.value.moduleName + ":" + ast.value.name :
                "EX:" + ast.value.runtime.name;
        };
        KeyVisitor.prototype.visitReadVarExpr = function (node) {
            return "VAR:" + node.name;
        };
        KeyVisitor.prototype.visitTypeofExpr = function (node, context) {
            return "TYPEOF:" + node.expr.visitExpression(this, context);
        };
        return KeyVisitor;
    }());
    function invalid(arg) {
        throw new Error("Invalid state: Visitor " + this.constructor.name + " doesn't handle " + arg.constructor.name);
    }
    function isVariable(e) {
        return e instanceof o.ReadVarExpr;
    }
    function isLongStringExpr(expr) {
        return typeof expr.value === 'string' &&
            expr.value.length >= POOL_INCLUSION_LENGTH_THRESHOLD_FOR_STRINGS;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRfcG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jb25zdGFudF9wb29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCwyREFBeUM7SUFDekMsbURBQTRDO0lBRTVDLElBQU0sZUFBZSxHQUFHLElBQUksQ0FBQztJQUU3Qjs7Ozs7OztPQU9HO0lBQ0gsSUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBU2xEOzs7OztPQUtHO0lBQ0gsSUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0lBRXZCOzs7O09BSUc7SUFDSCxJQUFNLDJDQUEyQyxHQUFHLEVBQUUsQ0FBQztJQUV2RDs7Ozs7OztPQU9HO0lBQ0g7UUFBOEIsMkNBQVk7UUFNeEMseUJBQW1CLFFBQXNCO1lBQXpDLFlBQ0Usa0JBQU0sUUFBUSxDQUFDLElBQUksQ0FBQyxTQUVyQjtZQUhrQixjQUFRLEdBQVIsUUFBUSxDQUFjO1lBRXZDLEtBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDOztRQUMzQixDQUFDO1FBRUQseUNBQWUsR0FBZixVQUFnQixPQUE0QixFQUFFLE9BQVk7WUFDeEQsSUFBSSxPQUFPLEtBQUssV0FBVyxFQUFFO2dCQUMzQixnRUFBZ0U7Z0JBQ2hFLGdDQUFnQztnQkFDaEMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDeEQ7aUJBQU07Z0JBQ0wsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDeEQ7UUFDSCxDQUFDO1FBRUQsc0NBQVksR0FBWixVQUFhLENBQWU7WUFDMUIsT0FBTyxDQUFDLFlBQVksZUFBZSxJQUFJLElBQUksQ0FBQyxRQUFRLENB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QUFtQjtZQUNuQyxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxRQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxTQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBTSxDQUFDLENBQUM7Z0JBQ2hELFFBQU0sR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBTSxDQUFDO1FBQy9ELENBQUM7UUFFRCxxQ0FBZ0IsR0FBaEIsVUFBaUIsSUFBbUI7WUFDbEMsT0FBTyxTQUFPLElBQUksQ0FBQyxJQUFNLENBQUM7UUFDNUIsQ0FBQztRQUVELG9DQUFlLEdBQWYsVUFBZ0IsSUFBa0IsRUFBRSxPQUFZO1lBQzlDLE9BQU8sWUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFHLENBQUM7UUFDOUQsQ0FBQztRQW1CSCxpQkFBQztJQUFELENBQUMsQUFqREQsSUFpREM7SUFFRCxTQUFTLE9BQU8sQ0FBK0IsR0FBNkI7UUFDMUUsTUFBTSxJQUFJLEtBQUssQ0FDWCw0QkFBMEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLHdCQUFtQixHQUFHLENBQUMsV0FBVyxDQUFDLElBQU0sQ0FBQyxDQUFDO0lBQ2hHLENBQUM7SUFFRCxTQUFTLFVBQVUsQ0FBQyxDQUFlO1FBQ2pDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLENBQUM7SUFDcEMsQ0FBQztJQUVELFNBQVMsZ0JBQWdCLENBQUMsSUFBbUI7UUFDM0MsT0FBTyxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssUUFBUTtZQUNqQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sSUFBSSwyQ0FBMkMsQ0FBQztJQUN2RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2Vycm9yLCBPdXRwdXRDb250ZXh0fSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBDT05TVEFOVF9QUkVGSVggPSAnX2MnO1xuXG4vKipcbiAqIGBDb25zdGFudFBvb2xgIHRyaWVzIHRvIHJldXNlIGxpdGVyYWwgZmFjdG9yaWVzIHdoZW4gdHdvIG9yIG1vcmUgbGl0ZXJhbHMgYXJlIGlkZW50aWNhbC5cbiAqIFdlIGRldGVybWluZSB3aGV0aGVyIGxpdGVyYWxzIGFyZSBpZGVudGljYWwgYnkgY3JlYXRpbmcgYSBrZXkgb3V0IG9mIHRoZWlyIEFTVCB1c2luZyB0aGVcbiAqIGBLZXlWaXNpdG9yYC4gVGhpcyBjb25zdGFudCBpcyB1c2VkIHRvIHJlcGxhY2UgZHluYW1pYyBleHByZXNzaW9ucyB3aGljaCBjYW4ndCBiZSBzYWZlbHlcbiAqIGNvbnZlcnRlZCBpbnRvIGEga2V5LiBFLmcuIGdpdmVuIGFuIGV4cHJlc3Npb24gYHtmb286IGJhcigpfWAsIHNpbmNlIHdlIGRvbid0IGtub3cgd2hhdFxuICogdGhlIHJlc3VsdCBvZiBgYmFyYCB3aWxsIGJlLCB3ZSBjcmVhdGUgYSBrZXkgdGhhdCBsb29rcyBsaWtlIGB7Zm9vOiA8dW5rbm93bj59YC4gTm90ZVxuICogdGhhdCB3ZSB1c2UgYSB2YXJpYWJsZSwgcmF0aGVyIHRoYW4gc29tZXRoaW5nIGxpa2UgYG51bGxgIGluIG9yZGVyIHRvIGF2b2lkIGNvbGxpc2lvbnMuXG4gKi9cbmNvbnN0IFVOS05PV05fVkFMVUVfS0VZID0gby52YXJpYWJsZSgnPHVua25vd24+Jyk7XG5cbmV4cG9ydCBjb25zdCBlbnVtIERlZmluaXRpb25LaW5kIHtcbiAgSW5qZWN0b3IsXG4gIERpcmVjdGl2ZSxcbiAgQ29tcG9uZW50LFxuICBQaXBlXG59XG5cbi8qKlxuICogQ29udGV4dCB0byB1c2Ugd2hlbiBwcm9kdWNpbmcgYSBrZXkuXG4gKlxuICogVGhpcyBlbnN1cmVzIHdlIHNlZSB0aGUgY29uc3RhbnQgbm90IHRoZSByZWZlcmVuY2UgdmFyaWFibGUgd2hlbiBwcm9kdWNpbmdcbiAqIGEga2V5LlxuICovXG5jb25zdCBLRVlfQ09OVEVYVCA9IHt9O1xuXG4vKipcbiAqIEdlbmVyYWxseSBhbGwgcHJpbWl0aXZlIHZhbHVlcyBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgYENvbnN0YW50UG9vbGAsIGJ1dCB0aGVyZSBpcyBhbiBleGNsdXNpb25cbiAqIGZvciBzdHJpbmdzIHRoYXQgcmVhY2ggYSBjZXJ0YWluIGxlbmd0aCB0aHJlc2hvbGQuIFRoaXMgY29uc3RhbnQgZGVmaW5lcyB0aGUgbGVuZ3RoIHRocmVzaG9sZCBmb3JcbiAqIHN0cmluZ3MuXG4gKi9cbmNvbnN0IFBPT0xfSU5DTFVTSU9OX0xFTkdUSF9USFJFU0hPTERfRk9SX1NUUklOR1MgPSA1MDtcblxuLyoqXG4gKiBBIG5vZGUgdGhhdCBpcyBhIHBsYWNlLWhvbGRlciB0aGF0IGFsbG93cyB0aGUgbm9kZSB0byBiZSByZXBsYWNlZCB3aGVuIHRoZSBhY3R1YWxcbiAqIG5vZGUgaXMga25vd24uXG4gKlxuICogVGhpcyBhbGxvd3MgdGhlIGNvbnN0YW50IHBvb2wgdG8gY2hhbmdlIGFuIGV4cHJlc3Npb24gZnJvbSBhIGRpcmVjdCByZWZlcmVuY2UgdG9cbiAqIGEgY29uc3RhbnQgdG8gYSBzaGFyZWQgY29uc3RhbnQuIEl0IHJldHVybnMgYSBmaXgtdXAgbm9kZSB0aGF0IGlzIGxhdGVyIGFsbG93ZWQgdG9cbiAqIGNoYW5nZSB0aGUgcmVmZXJlbmNlZCBleHByZXNzaW9uLlxuICovXG5jbGFzcyBGaXh1cEV4cHJlc3Npb24gZXh0ZW5kcyBvLkV4cHJlc3Npb24ge1xuICBwcml2YXRlIG9yaWdpbmFsOiBvLkV4cHJlc3Npb247XG5cbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHNoYXJlZCE6IGJvb2xlYW47XG5cbiAgY29uc3RydWN0b3IocHVibGljIHJlc29sdmVkOiBvLkV4cHJlc3Npb24pIHtcbiAgICBzdXBlcihyZXNvbHZlZC50eXBlKTtcbiAgICB0aGlzLm9yaWdpbmFsID0gcmVzb2x2ZWQ7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoY29udGV4dCA9PT0gS0VZX0NPTlRFWFQpIHtcbiAgICAgIC8vIFdoZW4gcHJvZHVjaW5nIGEga2V5IHdlIHdhbnQgdG8gdHJhdmVyc2UgdGhlIGNvbnN0YW50IG5vdCB0aGVcbiAgICAgIC8vIHZhcmlhYmxlIHVzZWQgdG8gcmVmZXIgdG8gaXQuXG4gICAgICByZXR1cm4gdGhpcy5vcmlnaW5hbC52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnJlc29sdmVkLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBGaXh1cEV4cHJlc3Npb24gJiYgdGhpcy5yZXNvbHZlZC5pc0VxdWl2YWxlbnQoZS5yZXNvbHZlZCk7XG4gIH1cblxuICBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZml4dXAoZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSB7XG4gICAgdGhpcy5yZXNvbHZlZCA9IGV4cHJlc3Npb247XG4gICAgdGhpcy5zaGFyZWQgPSB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogQSBjb25zdGFudCBwb29sIGFsbG93cyBhIGNvZGUgZW1pdHRlciB0byBzaGFyZSBjb25zdGFudCBpbiBhbiBvdXRwdXQgY29udGV4dC5cbiAqXG4gKiBUaGUgY29uc3RhbnQgcG9vbCBhbHNvIHN1cHBvcnRzIHNoYXJpbmcgYWNjZXNzIHRvIGl2eSBkZWZpbml0aW9ucyByZWZlcmVuY2VzLlxuICovXG5leHBvcnQgY2xhc3MgQ29uc3RhbnRQb29sIHtcbiAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIGxpdGVyYWxzID0gbmV3IE1hcDxzdHJpbmcsIEZpeHVwRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBsaXRlcmFsRmFjdG9yaWVzID0gbmV3IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBpbmplY3RvckRlZmluaXRpb25zID0gbmV3IE1hcDxhbnksIEZpeHVwRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBkaXJlY3RpdmVEZWZpbml0aW9ucyA9IG5ldyBNYXA8YW55LCBGaXh1cEV4cHJlc3Npb24+KCk7XG4gIHByaXZhdGUgY29tcG9uZW50RGVmaW5pdGlvbnMgPSBuZXcgTWFwPGFueSwgRml4dXBFeHByZXNzaW9uPigpO1xuICBwcml2YXRlIHBpcGVEZWZpbml0aW9ucyA9IG5ldyBNYXA8YW55LCBGaXh1cEV4cHJlc3Npb24+KCk7XG5cbiAgcHJpdmF0ZSBuZXh0TmFtZUluZGV4ID0gMDtcblxuICBnZXRDb25zdExpdGVyYWwobGl0ZXJhbDogby5FeHByZXNzaW9uLCBmb3JjZVNoYXJlZD86IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICgobGl0ZXJhbCBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIgJiYgIWlzTG9uZ1N0cmluZ0V4cHIobGl0ZXJhbCkpIHx8XG4gICAgICAgIGxpdGVyYWwgaW5zdGFuY2VvZiBGaXh1cEV4cHJlc3Npb24pIHtcbiAgICAgIC8vIERvIG5vIHB1dCBzaW1wbGUgbGl0ZXJhbHMgaW50byB0aGUgY29uc3RhbnQgcG9vbCBvciB0cnkgdG8gcHJvZHVjZSBhIGNvbnN0YW50IGZvciBhXG4gICAgICAvLyByZWZlcmVuY2UgdG8gYSBjb25zdGFudC5cbiAgICAgIHJldHVybiBsaXRlcmFsO1xuICAgIH1cbiAgICBjb25zdCBrZXkgPSB0aGlzLmtleU9mKGxpdGVyYWwpO1xuICAgIGxldCBmaXh1cCA9IHRoaXMubGl0ZXJhbHMuZ2V0KGtleSk7XG4gICAgbGV0IG5ld1ZhbHVlID0gZmFsc2U7XG4gICAgaWYgKCFmaXh1cCkge1xuICAgICAgZml4dXAgPSBuZXcgRml4dXBFeHByZXNzaW9uKGxpdGVyYWwpO1xuICAgICAgdGhpcy5saXRlcmFscy5zZXQoa2V5LCBmaXh1cCk7XG4gICAgICBuZXdWYWx1ZSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCghbmV3VmFsdWUgJiYgIWZpeHVwLnNoYXJlZCkgfHwgKG5ld1ZhbHVlICYmIGZvcmNlU2hhcmVkKSkge1xuICAgICAgLy8gUmVwbGFjZSB0aGUgZXhwcmVzc2lvbiB3aXRoIGEgdmFyaWFibGVcbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmZyZXNoTmFtZSgpO1xuICAgICAgdGhpcy5zdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICAgby52YXJpYWJsZShuYW1lKS5zZXQobGl0ZXJhbCkudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgICAgIGZpeHVwLmZpeHVwKG8udmFyaWFibGUobmFtZSkpO1xuICAgIH1cblxuICAgIHJldHVybiBmaXh1cDtcbiAgfVxuXG4gIGdldERlZmluaXRpb24odHlwZTogYW55LCBraW5kOiBEZWZpbml0aW9uS2luZCwgY3R4OiBPdXRwdXRDb250ZXh0LCBmb3JjZVNoYXJlZDogYm9vbGVhbiA9IGZhbHNlKTpcbiAgICAgIG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgZGVmaW5pdGlvbnMgPSB0aGlzLmRlZmluaXRpb25zT2Yoa2luZCk7XG4gICAgbGV0IGZpeHVwID0gZGVmaW5pdGlvbnMuZ2V0KHR5cGUpO1xuICAgIGxldCBuZXdWYWx1ZSA9IGZhbHNlO1xuICAgIGlmICghZml4dXApIHtcbiAgICAgIGNvbnN0IHByb3BlcnR5ID0gdGhpcy5wcm9wZXJ0eU5hbWVPZihraW5kKTtcbiAgICAgIGZpeHVwID0gbmV3IEZpeHVwRXhwcmVzc2lvbihjdHguaW1wb3J0RXhwcih0eXBlKS5wcm9wKHByb3BlcnR5KSk7XG4gICAgICBkZWZpbml0aW9ucy5zZXQodHlwZSwgZml4dXApO1xuICAgICAgbmV3VmFsdWUgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmICgoIW5ld1ZhbHVlICYmICFmaXh1cC5zaGFyZWQpIHx8IChuZXdWYWx1ZSAmJiBmb3JjZVNoYXJlZCkpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmZyZXNoTmFtZSgpO1xuICAgICAgdGhpcy5zdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICAgby52YXJpYWJsZShuYW1lKS5zZXQoZml4dXAucmVzb2x2ZWQpLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gICAgICBmaXh1cC5maXh1cChvLnZhcmlhYmxlKG5hbWUpKTtcbiAgICB9XG4gICAgcmV0dXJuIGZpeHVwO1xuICB9XG5cbiAgZ2V0TGl0ZXJhbEZhY3RvcnkobGl0ZXJhbDogby5MaXRlcmFsQXJyYXlFeHByfG8uTGl0ZXJhbE1hcEV4cHIpOlxuICAgICAge2xpdGVyYWxGYWN0b3J5OiBvLkV4cHJlc3Npb24sIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzOiBvLkV4cHJlc3Npb25bXX0ge1xuICAgIC8vIENyZWF0ZSBhIHB1cmUgZnVuY3Rpb24gdGhhdCBidWlsZHMgYW4gYXJyYXkgb2YgYSBtaXggb2YgY29uc3RhbnQgYW5kIHZhcmlhYmxlIGV4cHJlc3Npb25zXG4gICAgaWYgKGxpdGVyYWwgaW5zdGFuY2VvZiBvLkxpdGVyYWxBcnJheUV4cHIpIHtcbiAgICAgIGNvbnN0IGFyZ3VtZW50c0ZvcktleSA9IGxpdGVyYWwuZW50cmllcy5tYXAoZSA9PiBlLmlzQ29uc3RhbnQoKSA/IGUgOiBVTktOT1dOX1ZBTFVFX0tFWSk7XG4gICAgICBjb25zdCBrZXkgPSB0aGlzLmtleU9mKG8ubGl0ZXJhbEFycihhcmd1bWVudHNGb3JLZXkpKTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRMaXRlcmFsRmFjdG9yeShrZXksIGxpdGVyYWwuZW50cmllcywgZW50cmllcyA9PiBvLmxpdGVyYWxBcnIoZW50cmllcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBleHByZXNzaW9uRm9yS2V5ID0gby5saXRlcmFsTWFwKFxuICAgICAgICAgIGxpdGVyYWwuZW50cmllcy5tYXAoZSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGUua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZS52YWx1ZS5pc0NvbnN0YW50KCkgPyBlLnZhbHVlIDogVU5LTk9XTl9WQUxVRV9LRVksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogZS5xdW90ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKSk7XG4gICAgICBjb25zdCBrZXkgPSB0aGlzLmtleU9mKGV4cHJlc3Npb25Gb3JLZXkpO1xuICAgICAgcmV0dXJuIHRoaXMuX2dldExpdGVyYWxGYWN0b3J5KFxuICAgICAgICAgIGtleSwgbGl0ZXJhbC5lbnRyaWVzLm1hcChlID0+IGUudmFsdWUpLFxuICAgICAgICAgIGVudHJpZXMgPT4gby5saXRlcmFsTWFwKGVudHJpZXMubWFwKCh2YWx1ZSwgaW5kZXgpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGxpdGVyYWwuZW50cmllc1tpbmRleF0ua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdW90ZWQ6IGxpdGVyYWwuZW50cmllc1tpbmRleF0ucXVvdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgICBrZXk6IHN0cmluZywgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSwgcmVzdWx0TWFwOiAocGFyYW1ldGVyczogby5FeHByZXNzaW9uW10pID0+IG8uRXhwcmVzc2lvbik6XG4gICAgICB7bGl0ZXJhbEZhY3Rvcnk6IG8uRXhwcmVzc2lvbiwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHM6IG8uRXhwcmVzc2lvbltdfSB7XG4gICAgbGV0IGxpdGVyYWxGYWN0b3J5ID0gdGhpcy5saXRlcmFsRmFjdG9yaWVzLmdldChrZXkpO1xuICAgIGNvbnN0IGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzID0gdmFsdWVzLmZpbHRlcigoZSA9PiAhZS5pc0NvbnN0YW50KCkpKTtcbiAgICBpZiAoIWxpdGVyYWxGYWN0b3J5KSB7XG4gICAgICBjb25zdCByZXN1bHRFeHByZXNzaW9ucyA9IHZhbHVlcy5tYXAoXG4gICAgICAgICAgKGUsIGluZGV4KSA9PiBlLmlzQ29uc3RhbnQoKSA/IHRoaXMuZ2V0Q29uc3RMaXRlcmFsKGUsIHRydWUpIDogby52YXJpYWJsZShgYSR7aW5kZXh9YCkpO1xuICAgICAgY29uc3QgcGFyYW1ldGVycyA9XG4gICAgICAgICAgcmVzdWx0RXhwcmVzc2lvbnMuZmlsdGVyKGlzVmFyaWFibGUpLm1hcChlID0+IG5ldyBvLkZuUGFyYW0oZS5uYW1lISwgby5EWU5BTUlDX1RZUEUpKTtcbiAgICAgIGNvbnN0IHB1cmVGdW5jdGlvbkRlY2xhcmF0aW9uID1cbiAgICAgICAgICBvLmZuKHBhcmFtZXRlcnMsIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQocmVzdWx0TWFwKHJlc3VsdEV4cHJlc3Npb25zKSldLCBvLklORkVSUkVEX1RZUEUpO1xuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuZnJlc2hOYW1lKCk7XG4gICAgICB0aGlzLnN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICBvLnZhcmlhYmxlKG5hbWUpLnNldChwdXJlRnVuY3Rpb25EZWNsYXJhdGlvbikudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtcbiAgICAgICAgICAgIG8uU3RtdE1vZGlmaWVyLkZpbmFsXG4gICAgICAgICAgXSkpO1xuICAgICAgbGl0ZXJhbEZhY3RvcnkgPSBvLnZhcmlhYmxlKG5hbWUpO1xuICAgICAgdGhpcy5saXRlcmFsRmFjdG9yaWVzLnNldChrZXksIGxpdGVyYWxGYWN0b3J5KTtcbiAgICB9XG4gICAgcmV0dXJuIHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9O1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2R1Y2UgYSB1bmlxdWUgbmFtZS5cbiAgICpcbiAgICogVGhlIG5hbWUgbWlnaHQgYmUgdW5pcXVlIGFtb25nIGRpZmZlcmVudCBwcmVmaXhlcyBpZiBhbnkgb2YgdGhlIHByZWZpeGVzIGVuZCBpblxuICAgKiBhIGRpZ2l0IHNvIHRoZSBwcmVmaXggc2hvdWxkIGJlIGEgY29uc3RhbnQgc3RyaW5nIChub3QgYmFzZWQgb24gdXNlciBpbnB1dCkgYW5kXG4gICAqIG11c3Qgbm90IGVuZCBpbiBhIGRpZ2l0LlxuICAgKi9cbiAgdW5pcXVlTmFtZShwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3ByZWZpeH0ke3RoaXMubmV4dE5hbWVJbmRleCsrfWA7XG4gIH1cblxuICBwcml2YXRlIGRlZmluaXRpb25zT2Yoa2luZDogRGVmaW5pdGlvbktpbmQpOiBNYXA8YW55LCBGaXh1cEV4cHJlc3Npb24+IHtcbiAgICBzd2l0Y2ggKGtpbmQpIHtcbiAgICAgIGNhc2UgRGVmaW5pdGlvbktpbmQuQ29tcG9uZW50OlxuICAgICAgICByZXR1cm4gdGhpcy5jb21wb25lbnREZWZpbml0aW9ucztcbiAgICAgIGNhc2UgRGVmaW5pdGlvbktpbmQuRGlyZWN0aXZlOlxuICAgICAgICByZXR1cm4gdGhpcy5kaXJlY3RpdmVEZWZpbml0aW9ucztcbiAgICAgIGNhc2UgRGVmaW5pdGlvbktpbmQuSW5qZWN0b3I6XG4gICAgICAgIHJldHVybiB0aGlzLmluamVjdG9yRGVmaW5pdGlvbnM7XG4gICAgICBjYXNlIERlZmluaXRpb25LaW5kLlBpcGU6XG4gICAgICAgIHJldHVybiB0aGlzLnBpcGVEZWZpbml0aW9ucztcbiAgICB9XG4gICAgZXJyb3IoYFVua25vd24gZGVmaW5pdGlvbiBraW5kICR7a2luZH1gKTtcbiAgICByZXR1cm4gdGhpcy5jb21wb25lbnREZWZpbml0aW9ucztcbiAgfVxuXG4gIHB1YmxpYyBwcm9wZXJ0eU5hbWVPZihraW5kOiBEZWZpbml0aW9uS2luZCk6IHN0cmluZyB7XG4gICAgc3dpdGNoIChraW5kKSB7XG4gICAgICBjYXNlIERlZmluaXRpb25LaW5kLkNvbXBvbmVudDpcbiAgICAgICAgcmV0dXJuICfJtWNtcCc7XG4gICAgICBjYXNlIERlZmluaXRpb25LaW5kLkRpcmVjdGl2ZTpcbiAgICAgICAgcmV0dXJuICfJtWRpcic7XG4gICAgICBjYXNlIERlZmluaXRpb25LaW5kLkluamVjdG9yOlxuICAgICAgICByZXR1cm4gJ8m1aW5qJztcbiAgICAgIGNhc2UgRGVmaW5pdGlvbktpbmQuUGlwZTpcbiAgICAgICAgcmV0dXJuICfJtXBpcGUnO1xuICAgIH1cbiAgICBlcnJvcihgVW5rbm93biBkZWZpbml0aW9uIGtpbmQgJHtraW5kfWApO1xuICAgIHJldHVybiAnPHVua25vd24+JztcbiAgfVxuXG4gIHByaXZhdGUgZnJlc2hOYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMudW5pcXVlTmFtZShDT05TVEFOVF9QUkVGSVgpO1xuICB9XG5cbiAgcHJpdmF0ZSBrZXlPZihleHByZXNzaW9uOiBvLkV4cHJlc3Npb24pIHtcbiAgICByZXR1cm4gZXhwcmVzc2lvbi52aXNpdEV4cHJlc3Npb24obmV3IEtleVZpc2l0b3IoKSwgS0VZX0NPTlRFWFQpO1xuICB9XG59XG5cbi8qKlxuICogVmlzaXRvciB1c2VkIHRvIGRldGVybWluZSBpZiAyIGV4cHJlc3Npb25zIGFyZSBlcXVpdmFsZW50IGFuZCBjYW4gYmUgc2hhcmVkIGluIHRoZVxuICogYENvbnN0YW50UG9vbGAuXG4gKlxuICogV2hlbiB0aGUgaWQgKHN0cmluZykgZ2VuZXJhdGVkIGJ5IHRoZSB2aXNpdG9yIGlzIGVxdWFsLCBleHByZXNzaW9ucyBhcmUgY29uc2lkZXJlZCBlcXVpdmFsZW50LlxuICovXG5jbGFzcyBLZXlWaXNpdG9yIGltcGxlbWVudHMgby5FeHByZXNzaW9uVmlzaXRvciB7XG4gIHZpc2l0TGl0ZXJhbEV4cHIoYXN0OiBvLkxpdGVyYWxFeHByKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYCR7dHlwZW9mIGFzdC52YWx1ZSA9PT0gJ3N0cmluZycgPyAnXCInICsgYXN0LnZhbHVlICsgJ1wiJyA6IGFzdC52YWx1ZX1gO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogby5MaXRlcmFsQXJyYXlFeHByLCBjb250ZXh0OiBvYmplY3QpOiBzdHJpbmcge1xuICAgIHJldHVybiBgWyR7YXN0LmVudHJpZXMubWFwKGVudHJ5ID0+IGVudHJ5LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSkuam9pbignLCcpfV1gO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwRXhwcihhc3Q6IG8uTGl0ZXJhbE1hcEV4cHIsIGNvbnRleHQ6IG9iamVjdCk6IHN0cmluZyB7XG4gICAgY29uc3QgbWFwS2V5ID0gKGVudHJ5OiBvLkxpdGVyYWxNYXBFbnRyeSkgPT4ge1xuICAgICAgY29uc3QgcXVvdGUgPSBlbnRyeS5xdW90ZWQgPyAnXCInIDogJyc7XG4gICAgICByZXR1cm4gYCR7cXVvdGV9JHtlbnRyeS5rZXl9JHtxdW90ZX1gO1xuICAgIH07XG4gICAgY29uc3QgbWFwRW50cnkgPSAoZW50cnk6IG8uTGl0ZXJhbE1hcEVudHJ5KSA9PlxuICAgICAgICBgJHttYXBLZXkoZW50cnkpfToke2VudHJ5LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KX1gO1xuICAgIHJldHVybiBgeyR7YXN0LmVudHJpZXMubWFwKG1hcEVudHJ5KS5qb2luKCcsJyl9YDtcbiAgfVxuXG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogby5FeHRlcm5hbEV4cHIpOiBzdHJpbmcge1xuICAgIHJldHVybiBhc3QudmFsdWUubW9kdWxlTmFtZSA/IGBFWDoke2FzdC52YWx1ZS5tb2R1bGVOYW1lfToke2FzdC52YWx1ZS5uYW1lfWAgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBFWDoke2FzdC52YWx1ZS5ydW50aW1lLm5hbWV9YDtcbiAgfVxuXG4gIHZpc2l0UmVhZFZhckV4cHIobm9kZTogby5SZWFkVmFyRXhwcikge1xuICAgIHJldHVybiBgVkFSOiR7bm9kZS5uYW1lfWA7XG4gIH1cblxuICB2aXNpdFR5cGVvZkV4cHIobm9kZTogby5UeXBlb2ZFeHByLCBjb250ZXh0OiBhbnkpOiBzdHJpbmcge1xuICAgIHJldHVybiBgVFlQRU9GOiR7bm9kZS5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KX1gO1xuICB9XG5cbiAgdmlzaXRXcmFwcGVkTm9kZUV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdFdyaXRlVmFyRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0V3JpdGVLZXlFeHByID0gaW52YWxpZDtcbiAgdmlzaXRXcml0ZVByb3BFeHByID0gaW52YWxpZDtcbiAgdmlzaXRJbnZva2VNZXRob2RFeHByID0gaW52YWxpZDtcbiAgdmlzaXRJbnZva2VGdW5jdGlvbkV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdEluc3RhbnRpYXRlRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByID0gaW52YWxpZDtcbiAgdmlzaXROb3RFeHByID0gaW52YWxpZDtcbiAgdmlzaXRBc3NlcnROb3ROdWxsRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0Q2FzdEV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdEZ1bmN0aW9uRXhwciA9IGludmFsaWQ7XG4gIHZpc2l0QmluYXJ5T3BlcmF0b3JFeHByID0gaW52YWxpZDtcbiAgdmlzaXRSZWFkUHJvcEV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdFJlYWRLZXlFeHByID0gaW52YWxpZDtcbiAgdmlzaXRDb21tYUV4cHIgPSBpbnZhbGlkO1xuICB2aXNpdExvY2FsaXplZFN0cmluZyA9IGludmFsaWQ7XG59XG5cbmZ1bmN0aW9uIGludmFsaWQ8VD4odGhpczogby5FeHByZXNzaW9uVmlzaXRvciwgYXJnOiBvLkV4cHJlc3Npb258by5TdGF0ZW1lbnQpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbnZhbGlkIHN0YXRlOiBWaXNpdG9yICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2Vzbid0IGhhbmRsZSAke2FyZy5jb25zdHJ1Y3Rvci5uYW1lfWApO1xufVxuXG5mdW5jdGlvbiBpc1ZhcmlhYmxlKGU6IG8uRXhwcmVzc2lvbik6IGUgaXMgby5SZWFkVmFyRXhwciB7XG4gIHJldHVybiBlIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwcjtcbn1cblxuZnVuY3Rpb24gaXNMb25nU3RyaW5nRXhwcihleHByOiBvLkxpdGVyYWxFeHByKTogYm9vbGVhbiB7XG4gIHJldHVybiB0eXBlb2YgZXhwci52YWx1ZSA9PT0gJ3N0cmluZycgJiZcbiAgICAgIGV4cHIudmFsdWUubGVuZ3RoID49IFBPT0xfSU5DTFVTSU9OX0xFTkdUSF9USFJFU0hPTERfRk9SX1NUUklOR1M7XG59Il19