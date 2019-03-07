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
        define("@angular/compiler/src/compiler_util/expression_converter", ["require", "exports", "tslib", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var cdAst = require("@angular/compiler/src/expression_parser/ast");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var o = require("@angular/compiler/src/output/output_ast");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var EventHandlerVars = /** @class */ (function () {
        function EventHandlerVars() {
        }
        EventHandlerVars.event = o.variable('$event');
        return EventHandlerVars;
    }());
    exports.EventHandlerVars = EventHandlerVars;
    var ConvertActionBindingResult = /** @class */ (function () {
        function ConvertActionBindingResult(
        /**
         * Render2 compatible statements,
         */
        stmts, 
        /**
         * Variable name used with render2 compatible statements.
         */
        allowDefault) {
            this.stmts = stmts;
            this.allowDefault = allowDefault;
            /**
             * This is bit of a hack. It converts statements which render2 expects to statements which are
             * expected by render3.
             *
             * Example: `<div click="doSomething($event)">` will generate:
             *
             * Render3:
             * ```
             * const pd_b:any = ((<any>ctx.doSomething($event)) !== false);
             * return pd_b;
             * ```
             *
             * but render2 expects:
             * ```
             * return ctx.doSomething($event);
             * ```
             */
            // TODO(misko): remove this hack once we no longer support ViewEngine.
            this.render3Stmts = stmts.map(function (statement) {
                if (statement instanceof o.DeclareVarStmt && statement.name == allowDefault.name &&
                    statement.value instanceof o.BinaryOperatorExpr) {
                    var lhs = statement.value.lhs;
                    return new o.ReturnStatement(lhs.value);
                }
                return statement;
            });
        }
        return ConvertActionBindingResult;
    }());
    exports.ConvertActionBindingResult = ConvertActionBindingResult;
    /**
     * Converts the given expression AST into an executable output AST, assuming the expression is
     * used in an action binding (e.g. an event handler).
     */
    function convertActionBinding(localResolver, implicitReceiver, action, bindingId, interpolationFunction, baseSourceSpan) {
        if (!localResolver) {
            localResolver = new DefaultLocalResolver();
        }
        var actionWithoutBuiltins = convertPropertyBindingBuiltins({
            createLiteralArrayConverter: function (argCount) {
                // Note: no caching for literal arrays in actions.
                return function (args) { return o.literalArr(args); };
            },
            createLiteralMapConverter: function (keys) {
                // Note: no caching for literal maps in actions.
                return function (values) {
                    var entries = keys.map(function (k, i) { return ({
                        key: k.key,
                        value: values[i],
                        quoted: k.quoted,
                    }); });
                    return o.literalMap(entries);
                };
            },
            createPipeConverter: function (name) {
                throw new Error("Illegal State: Actions are not allowed to contain pipes. Pipe: " + name);
            }
        }, action);
        var visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, interpolationFunction, baseSourceSpan);
        var actionStmts = [];
        flattenStatements(actionWithoutBuiltins.visit(visitor, _Mode.Statement), actionStmts);
        prependTemporaryDecls(visitor.temporaryCount, bindingId, actionStmts);
        var lastIndex = actionStmts.length - 1;
        var preventDefaultVar = null;
        if (lastIndex >= 0) {
            var lastStatement = actionStmts[lastIndex];
            var returnExpr = convertStmtIntoExpression(lastStatement);
            if (returnExpr) {
                // Note: We need to cast the result of the method call to dynamic,
                // as it might be a void method!
                preventDefaultVar = createPreventDefaultVar(bindingId);
                actionStmts[lastIndex] =
                    preventDefaultVar.set(returnExpr.cast(o.DYNAMIC_TYPE).notIdentical(o.literal(false)))
                        .toDeclStmt(null, [o.StmtModifier.Final]);
            }
        }
        return new ConvertActionBindingResult(actionStmts, preventDefaultVar);
    }
    exports.convertActionBinding = convertActionBinding;
    function convertPropertyBindingBuiltins(converterFactory, ast) {
        return convertBuiltins(converterFactory, ast);
    }
    exports.convertPropertyBindingBuiltins = convertPropertyBindingBuiltins;
    var ConvertPropertyBindingResult = /** @class */ (function () {
        function ConvertPropertyBindingResult(stmts, currValExpr) {
            this.stmts = stmts;
            this.currValExpr = currValExpr;
        }
        return ConvertPropertyBindingResult;
    }());
    exports.ConvertPropertyBindingResult = ConvertPropertyBindingResult;
    var BindingForm;
    (function (BindingForm) {
        // The general form of binding expression, supports all expressions.
        BindingForm[BindingForm["General"] = 0] = "General";
        // Try to generate a simple binding (no temporaries or statements)
        // otherwise generate a general binding
        BindingForm[BindingForm["TrySimple"] = 1] = "TrySimple";
    })(BindingForm = exports.BindingForm || (exports.BindingForm = {}));
    /**
     * Converts the given expression AST into an executable output AST, assuming the expression
     * is used in property binding. The expression has to be preprocessed via
     * `convertPropertyBindingBuiltins`.
     */
    function convertPropertyBinding(localResolver, implicitReceiver, expressionWithoutBuiltins, bindingId, form, interpolationFunction) {
        if (!localResolver) {
            localResolver = new DefaultLocalResolver();
        }
        var currValExpr = createCurrValueExpr(bindingId);
        var stmts = [];
        var visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, interpolationFunction);
        var outputExpr = expressionWithoutBuiltins.visit(visitor, _Mode.Expression);
        if (visitor.temporaryCount) {
            for (var i = 0; i < visitor.temporaryCount; i++) {
                stmts.push(temporaryDeclaration(bindingId, i));
            }
        }
        else if (form == BindingForm.TrySimple) {
            return new ConvertPropertyBindingResult([], outputExpr);
        }
        stmts.push(currValExpr.set(outputExpr).toDeclStmt(o.DYNAMIC_TYPE, [o.StmtModifier.Final]));
        return new ConvertPropertyBindingResult(stmts, currValExpr);
    }
    exports.convertPropertyBinding = convertPropertyBinding;
    function convertBuiltins(converterFactory, ast) {
        var visitor = new _BuiltinAstConverter(converterFactory);
        return ast.visit(visitor);
    }
    function temporaryName(bindingId, temporaryNumber) {
        return "tmp_" + bindingId + "_" + temporaryNumber;
    }
    function temporaryDeclaration(bindingId, temporaryNumber) {
        return new o.DeclareVarStmt(temporaryName(bindingId, temporaryNumber), o.NULL_EXPR);
    }
    exports.temporaryDeclaration = temporaryDeclaration;
    function prependTemporaryDecls(temporaryCount, bindingId, statements) {
        for (var i = temporaryCount - 1; i >= 0; i--) {
            statements.unshift(temporaryDeclaration(bindingId, i));
        }
    }
    var _Mode;
    (function (_Mode) {
        _Mode[_Mode["Statement"] = 0] = "Statement";
        _Mode[_Mode["Expression"] = 1] = "Expression";
    })(_Mode || (_Mode = {}));
    function ensureStatementMode(mode, ast) {
        if (mode !== _Mode.Statement) {
            throw new Error("Expected a statement, but saw " + ast);
        }
    }
    function ensureExpressionMode(mode, ast) {
        if (mode !== _Mode.Expression) {
            throw new Error("Expected an expression, but saw " + ast);
        }
    }
    function convertToStatementIfNeeded(mode, expr) {
        if (mode === _Mode.Statement) {
            return expr.toStmt();
        }
        else {
            return expr;
        }
    }
    var _BuiltinAstConverter = /** @class */ (function (_super) {
        tslib_1.__extends(_BuiltinAstConverter, _super);
        function _BuiltinAstConverter(_converterFactory) {
            var _this = _super.call(this) || this;
            _this._converterFactory = _converterFactory;
            return _this;
        }
        _BuiltinAstConverter.prototype.visitPipe = function (ast, context) {
            var _this = this;
            var args = tslib_1.__spread([ast.exp], ast.args).map(function (ast) { return ast.visit(_this, context); });
            return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createPipeConverter(ast.name, args.length));
        };
        _BuiltinAstConverter.prototype.visitLiteralArray = function (ast, context) {
            var _this = this;
            var args = ast.expressions.map(function (ast) { return ast.visit(_this, context); });
            return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createLiteralArrayConverter(ast.expressions.length));
        };
        _BuiltinAstConverter.prototype.visitLiteralMap = function (ast, context) {
            var _this = this;
            var args = ast.values.map(function (ast) { return ast.visit(_this, context); });
            return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createLiteralMapConverter(ast.keys));
        };
        return _BuiltinAstConverter;
    }(cdAst.AstTransformer));
    var _AstToIrVisitor = /** @class */ (function () {
        function _AstToIrVisitor(_localResolver, _implicitReceiver, bindingId, interpolationFunction, baseSourceSpan) {
            this._localResolver = _localResolver;
            this._implicitReceiver = _implicitReceiver;
            this.bindingId = bindingId;
            this.interpolationFunction = interpolationFunction;
            this.baseSourceSpan = baseSourceSpan;
            this._nodeMap = new Map();
            this._resultMap = new Map();
            this._currentTemporary = 0;
            this.temporaryCount = 0;
        }
        _AstToIrVisitor.prototype.visitBinary = function (ast, mode) {
            var op;
            switch (ast.operation) {
                case '+':
                    op = o.BinaryOperator.Plus;
                    break;
                case '-':
                    op = o.BinaryOperator.Minus;
                    break;
                case '*':
                    op = o.BinaryOperator.Multiply;
                    break;
                case '/':
                    op = o.BinaryOperator.Divide;
                    break;
                case '%':
                    op = o.BinaryOperator.Modulo;
                    break;
                case '&&':
                    op = o.BinaryOperator.And;
                    break;
                case '||':
                    op = o.BinaryOperator.Or;
                    break;
                case '==':
                    op = o.BinaryOperator.Equals;
                    break;
                case '!=':
                    op = o.BinaryOperator.NotEquals;
                    break;
                case '===':
                    op = o.BinaryOperator.Identical;
                    break;
                case '!==':
                    op = o.BinaryOperator.NotIdentical;
                    break;
                case '<':
                    op = o.BinaryOperator.Lower;
                    break;
                case '>':
                    op = o.BinaryOperator.Bigger;
                    break;
                case '<=':
                    op = o.BinaryOperator.LowerEquals;
                    break;
                case '>=':
                    op = o.BinaryOperator.BiggerEquals;
                    break;
                default:
                    throw new Error("Unsupported operation " + ast.operation);
            }
            return convertToStatementIfNeeded(mode, new o.BinaryOperatorExpr(op, this._visit(ast.left, _Mode.Expression), this._visit(ast.right, _Mode.Expression), undefined, this.convertSourceSpan(ast.span)));
        };
        _AstToIrVisitor.prototype.visitChain = function (ast, mode) {
            ensureStatementMode(mode, ast);
            return this.visitAll(ast.expressions, mode);
        };
        _AstToIrVisitor.prototype.visitConditional = function (ast, mode) {
            var value = this._visit(ast.condition, _Mode.Expression);
            return convertToStatementIfNeeded(mode, value.conditional(this._visit(ast.trueExp, _Mode.Expression), this._visit(ast.falseExp, _Mode.Expression), this.convertSourceSpan(ast.span)));
        };
        _AstToIrVisitor.prototype.visitPipe = function (ast, mode) {
            throw new Error("Illegal state: Pipes should have been converted into functions. Pipe: " + ast.name);
        };
        _AstToIrVisitor.prototype.visitFunctionCall = function (ast, mode) {
            var convertedArgs = this.visitAll(ast.args, _Mode.Expression);
            var fnResult;
            if (ast instanceof BuiltinFunctionCall) {
                fnResult = ast.converter(convertedArgs);
            }
            else {
                fnResult = this._visit(ast.target, _Mode.Expression)
                    .callFn(convertedArgs, this.convertSourceSpan(ast.span));
            }
            return convertToStatementIfNeeded(mode, fnResult);
        };
        _AstToIrVisitor.prototype.visitImplicitReceiver = function (ast, mode) {
            ensureExpressionMode(mode, ast);
            return this._implicitReceiver;
        };
        _AstToIrVisitor.prototype.visitInterpolation = function (ast, mode) {
            ensureExpressionMode(mode, ast);
            var args = [o.literal(ast.expressions.length)];
            for (var i = 0; i < ast.strings.length - 1; i++) {
                args.push(o.literal(ast.strings[i]));
                args.push(this._visit(ast.expressions[i], _Mode.Expression));
            }
            args.push(o.literal(ast.strings[ast.strings.length - 1]));
            if (this.interpolationFunction) {
                return this.interpolationFunction(args);
            }
            return ast.expressions.length <= 9 ?
                o.importExpr(identifiers_1.Identifiers.inlineInterpolate).callFn(args) :
                o.importExpr(identifiers_1.Identifiers.interpolate).callFn([
                    args[0], o.literalArr(args.slice(1), undefined, this.convertSourceSpan(ast.span))
                ]);
        };
        _AstToIrVisitor.prototype.visitKeyedRead = function (ast, mode) {
            var leftMostSafe = this.leftMostSafeNode(ast);
            if (leftMostSafe) {
                return this.convertSafeAccess(ast, leftMostSafe, mode);
            }
            else {
                return convertToStatementIfNeeded(mode, this._visit(ast.obj, _Mode.Expression).key(this._visit(ast.key, _Mode.Expression)));
            }
        };
        _AstToIrVisitor.prototype.visitKeyedWrite = function (ast, mode) {
            var obj = this._visit(ast.obj, _Mode.Expression);
            var key = this._visit(ast.key, _Mode.Expression);
            var value = this._visit(ast.value, _Mode.Expression);
            return convertToStatementIfNeeded(mode, obj.key(key).set(value));
        };
        _AstToIrVisitor.prototype.visitLiteralArray = function (ast, mode) {
            throw new Error("Illegal State: literal arrays should have been converted into functions");
        };
        _AstToIrVisitor.prototype.visitLiteralMap = function (ast, mode) {
            throw new Error("Illegal State: literal maps should have been converted into functions");
        };
        _AstToIrVisitor.prototype.visitLiteralPrimitive = function (ast, mode) {
            // For literal values of null, undefined, true, or false allow type interference
            // to infer the type.
            var type = ast.value === null || ast.value === undefined || ast.value === true || ast.value === true ?
                o.INFERRED_TYPE :
                undefined;
            return convertToStatementIfNeeded(mode, o.literal(ast.value, type, this.convertSourceSpan(ast.span)));
        };
        _AstToIrVisitor.prototype._getLocal = function (name) { return this._localResolver.getLocal(name); };
        _AstToIrVisitor.prototype.visitMethodCall = function (ast, mode) {
            if (ast.receiver instanceof cdAst.ImplicitReceiver && ast.name == '$any') {
                var args = this.visitAll(ast.args, _Mode.Expression);
                if (args.length != 1) {
                    throw new Error("Invalid call to $any, expected 1 argument but received " + (args.length || 'none'));
                }
                return args[0].cast(o.DYNAMIC_TYPE, this.convertSourceSpan(ast.span));
            }
            var leftMostSafe = this.leftMostSafeNode(ast);
            if (leftMostSafe) {
                return this.convertSafeAccess(ast, leftMostSafe, mode);
            }
            else {
                var args = this.visitAll(ast.args, _Mode.Expression);
                var result = null;
                var receiver = this._visit(ast.receiver, _Mode.Expression);
                if (receiver === this._implicitReceiver) {
                    var varExpr = this._getLocal(ast.name);
                    if (varExpr) {
                        result = varExpr.callFn(args);
                    }
                }
                if (result == null) {
                    result = receiver.callMethod(ast.name, args, this.convertSourceSpan(ast.span));
                }
                return convertToStatementIfNeeded(mode, result);
            }
        };
        _AstToIrVisitor.prototype.visitPrefixNot = function (ast, mode) {
            return convertToStatementIfNeeded(mode, o.not(this._visit(ast.expression, _Mode.Expression)));
        };
        _AstToIrVisitor.prototype.visitNonNullAssert = function (ast, mode) {
            return convertToStatementIfNeeded(mode, o.assertNotNull(this._visit(ast.expression, _Mode.Expression)));
        };
        _AstToIrVisitor.prototype.visitPropertyRead = function (ast, mode) {
            var leftMostSafe = this.leftMostSafeNode(ast);
            if (leftMostSafe) {
                return this.convertSafeAccess(ast, leftMostSafe, mode);
            }
            else {
                var result = null;
                var receiver = this._visit(ast.receiver, _Mode.Expression);
                if (receiver === this._implicitReceiver) {
                    result = this._getLocal(ast.name);
                }
                if (result == null) {
                    result = receiver.prop(ast.name);
                }
                return convertToStatementIfNeeded(mode, result);
            }
        };
        _AstToIrVisitor.prototype.visitPropertyWrite = function (ast, mode) {
            var receiver = this._visit(ast.receiver, _Mode.Expression);
            var varExpr = null;
            if (receiver === this._implicitReceiver) {
                var localExpr = this._getLocal(ast.name);
                if (localExpr) {
                    if (localExpr instanceof o.ReadPropExpr) {
                        // If the local variable is a property read expression, it's a reference
                        // to a 'context.property' value and will be used as the target of the
                        // write expression.
                        varExpr = localExpr;
                    }
                    else {
                        // Otherwise it's an error.
                        throw new Error('Cannot assign to a reference or variable!');
                    }
                }
            }
            // If no local expression could be produced, use the original receiver's
            // property as the target.
            if (varExpr === null) {
                varExpr = receiver.prop(ast.name);
            }
            return convertToStatementIfNeeded(mode, varExpr.set(this._visit(ast.value, _Mode.Expression)));
        };
        _AstToIrVisitor.prototype.visitSafePropertyRead = function (ast, mode) {
            return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
        };
        _AstToIrVisitor.prototype.visitSafeMethodCall = function (ast, mode) {
            return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
        };
        _AstToIrVisitor.prototype.visitAll = function (asts, mode) {
            var _this = this;
            return asts.map(function (ast) { return _this._visit(ast, mode); });
        };
        _AstToIrVisitor.prototype.visitQuote = function (ast, mode) {
            throw new Error("Quotes are not supported for evaluation!\n        Statement: " + ast.uninterpretedExpression + " located at " + ast.location);
        };
        _AstToIrVisitor.prototype._visit = function (ast, mode) {
            var result = this._resultMap.get(ast);
            if (result)
                return result;
            return (this._nodeMap.get(ast) || ast).visit(this, mode);
        };
        _AstToIrVisitor.prototype.convertSafeAccess = function (ast, leftMostSafe, mode) {
            // If the expression contains a safe access node on the left it needs to be converted to
            // an expression that guards the access to the member by checking the receiver for blank. As
            // execution proceeds from left to right, the left most part of the expression must be guarded
            // first but, because member access is left associative, the right side of the expression is at
            // the top of the AST. The desired result requires lifting a copy of the the left part of the
            // expression up to test it for blank before generating the unguarded version.
            // Consider, for example the following expression: a?.b.c?.d.e
            // This results in the ast:
            //         .
            //        / \
            //       ?.   e
            //      /  \
            //     .    d
            //    / \
            //   ?.  c
            //  /  \
            // a    b
            // The following tree should be generated:
            //
            //        /---- ? ----\
            //       /      |      \
            //     a   /--- ? ---\  null
            //        /     |     \
            //       .      .     null
            //      / \    / \
            //     .  c   .   e
            //    / \    / \
            //   a   b  ,   d
            //         / \
            //        .   c
            //       / \
            //      a   b
            //
            // Notice that the first guard condition is the left hand of the left most safe access node
            // which comes in as leftMostSafe to this routine.
            var guardedExpression = this._visit(leftMostSafe.receiver, _Mode.Expression);
            var temporary = undefined;
            if (this.needsTemporary(leftMostSafe.receiver)) {
                // If the expression has method calls or pipes then we need to save the result into a
                // temporary variable to avoid calling stateful or impure code more than once.
                temporary = this.allocateTemporary();
                // Preserve the result in the temporary variable
                guardedExpression = temporary.set(guardedExpression);
                // Ensure all further references to the guarded expression refer to the temporary instead.
                this._resultMap.set(leftMostSafe.receiver, temporary);
            }
            var condition = guardedExpression.isBlank();
            // Convert the ast to an unguarded access to the receiver's member. The map will substitute
            // leftMostNode with its unguarded version in the call to `this.visit()`.
            if (leftMostSafe instanceof cdAst.SafeMethodCall) {
                this._nodeMap.set(leftMostSafe, new cdAst.MethodCall(leftMostSafe.span, leftMostSafe.receiver, leftMostSafe.name, leftMostSafe.args));
            }
            else {
                this._nodeMap.set(leftMostSafe, new cdAst.PropertyRead(leftMostSafe.span, leftMostSafe.receiver, leftMostSafe.name));
            }
            // Recursively convert the node now without the guarded member access.
            var access = this._visit(ast, _Mode.Expression);
            // Remove the mapping. This is not strictly required as the converter only traverses each node
            // once but is safer if the conversion is changed to traverse the nodes more than once.
            this._nodeMap.delete(leftMostSafe);
            // If we allocated a temporary, release it.
            if (temporary) {
                this.releaseTemporary(temporary);
            }
            // Produce the conditional
            return convertToStatementIfNeeded(mode, condition.conditional(o.literal(null), access));
        };
        // Given a expression of the form a?.b.c?.d.e the the left most safe node is
        // the (a?.b). The . and ?. are left associative thus can be rewritten as:
        // ((((a?.c).b).c)?.d).e. This returns the most deeply nested safe read or
        // safe method call as this needs be transform initially to:
        //   a == null ? null : a.c.b.c?.d.e
        // then to:
        //   a == null ? null : a.b.c == null ? null : a.b.c.d.e
        _AstToIrVisitor.prototype.leftMostSafeNode = function (ast) {
            var _this = this;
            var visit = function (visitor, ast) {
                return (_this._nodeMap.get(ast) || ast).visit(visitor);
            };
            return ast.visit({
                visitBinary: function (ast) { return null; },
                visitChain: function (ast) { return null; },
                visitConditional: function (ast) { return null; },
                visitFunctionCall: function (ast) { return null; },
                visitImplicitReceiver: function (ast) { return null; },
                visitInterpolation: function (ast) { return null; },
                visitKeyedRead: function (ast) { return visit(this, ast.obj); },
                visitKeyedWrite: function (ast) { return null; },
                visitLiteralArray: function (ast) { return null; },
                visitLiteralMap: function (ast) { return null; },
                visitLiteralPrimitive: function (ast) { return null; },
                visitMethodCall: function (ast) { return visit(this, ast.receiver); },
                visitPipe: function (ast) { return null; },
                visitPrefixNot: function (ast) { return null; },
                visitNonNullAssert: function (ast) { return null; },
                visitPropertyRead: function (ast) { return visit(this, ast.receiver); },
                visitPropertyWrite: function (ast) { return null; },
                visitQuote: function (ast) { return null; },
                visitSafeMethodCall: function (ast) { return visit(this, ast.receiver) || ast; },
                visitSafePropertyRead: function (ast) {
                    return visit(this, ast.receiver) || ast;
                }
            });
        };
        // Returns true of the AST includes a method or a pipe indicating that, if the
        // expression is used as the target of a safe property or method access then
        // the expression should be stored into a temporary variable.
        _AstToIrVisitor.prototype.needsTemporary = function (ast) {
            var _this = this;
            var visit = function (visitor, ast) {
                return ast && (_this._nodeMap.get(ast) || ast).visit(visitor);
            };
            var visitSome = function (visitor, ast) {
                return ast.some(function (ast) { return visit(visitor, ast); });
            };
            return ast.visit({
                visitBinary: function (ast) { return visit(this, ast.left) || visit(this, ast.right); },
                visitChain: function (ast) { return false; },
                visitConditional: function (ast) {
                    return visit(this, ast.condition) || visit(this, ast.trueExp) ||
                        visit(this, ast.falseExp);
                },
                visitFunctionCall: function (ast) { return true; },
                visitImplicitReceiver: function (ast) { return false; },
                visitInterpolation: function (ast) { return visitSome(this, ast.expressions); },
                visitKeyedRead: function (ast) { return false; },
                visitKeyedWrite: function (ast) { return false; },
                visitLiteralArray: function (ast) { return true; },
                visitLiteralMap: function (ast) { return true; },
                visitLiteralPrimitive: function (ast) { return false; },
                visitMethodCall: function (ast) { return true; },
                visitPipe: function (ast) { return true; },
                visitPrefixNot: function (ast) { return visit(this, ast.expression); },
                visitNonNullAssert: function (ast) { return visit(this, ast.expression); },
                visitPropertyRead: function (ast) { return false; },
                visitPropertyWrite: function (ast) { return false; },
                visitQuote: function (ast) { return false; },
                visitSafeMethodCall: function (ast) { return true; },
                visitSafePropertyRead: function (ast) { return false; }
            });
        };
        _AstToIrVisitor.prototype.allocateTemporary = function () {
            var tempNumber = this._currentTemporary++;
            this.temporaryCount = Math.max(this._currentTemporary, this.temporaryCount);
            return new o.ReadVarExpr(temporaryName(this.bindingId, tempNumber));
        };
        _AstToIrVisitor.prototype.releaseTemporary = function (temporary) {
            this._currentTemporary--;
            if (temporary.name != temporaryName(this.bindingId, this._currentTemporary)) {
                throw new Error("Temporary " + temporary.name + " released out of order");
            }
        };
        /**
         * Creates an absolute `ParseSourceSpan` from the relative `ParseSpan`.
         *
         * `ParseSpan` objects are relative to the start of the expression.
         * This method converts these to full `ParseSourceSpan` objects that
         * show where the span is within the overall source file.
         *
         * @param span the relative span to convert.
         * @returns a `ParseSourceSpan` for the the given span or null if no
         * `baseSourceSpan` was provided to this class.
         */
        _AstToIrVisitor.prototype.convertSourceSpan = function (span) {
            if (this.baseSourceSpan) {
                var start = this.baseSourceSpan.start.moveBy(span.start);
                var end = this.baseSourceSpan.start.moveBy(span.end);
                return new parse_util_1.ParseSourceSpan(start, end);
            }
            else {
                return null;
            }
        };
        return _AstToIrVisitor;
    }());
    function flattenStatements(arg, output) {
        if (Array.isArray(arg)) {
            arg.forEach(function (entry) { return flattenStatements(entry, output); });
        }
        else {
            output.push(arg);
        }
    }
    var DefaultLocalResolver = /** @class */ (function () {
        function DefaultLocalResolver() {
        }
        DefaultLocalResolver.prototype.getLocal = function (name) {
            if (name === EventHandlerVars.event.name) {
                return EventHandlerVars.event;
            }
            return null;
        };
        return DefaultLocalResolver;
    }());
    function createCurrValueExpr(bindingId) {
        return o.variable("currVal_" + bindingId); // fix syntax highlighting: `
    }
    function createPreventDefaultVar(bindingId) {
        return o.variable("pd_" + bindingId);
    }
    function convertStmtIntoExpression(stmt) {
        if (stmt instanceof o.ExpressionStatement) {
            return stmt.expr;
        }
        else if (stmt instanceof o.ReturnStatement) {
            return stmt.value;
        }
        return null;
    }
    var BuiltinFunctionCall = /** @class */ (function (_super) {
        tslib_1.__extends(BuiltinFunctionCall, _super);
        function BuiltinFunctionCall(span, args, converter) {
            var _this = _super.call(this, span, null, args) || this;
            _this.args = args;
            _this.converter = converter;
            return _this;
        }
        return BuiltinFunctionCall;
    }(cdAst.FunctionCall));
    exports.BuiltinFunctionCall = BuiltinFunctionCall;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbl9jb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCxtRUFBa0Q7SUFDbEQsaUVBQTJDO0lBQzNDLDJEQUEwQztJQUMxQywrREFBOEM7SUFFOUM7UUFBQTtRQUFxRSxDQUFDO1FBQS9CLHNCQUFLLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUFDLHVCQUFDO0tBQUEsQUFBdEUsSUFBc0U7SUFBekQsNENBQWdCO0lBSTdCO1FBS0U7UUFDSTs7V0FFRztRQUNJLEtBQW9CO1FBQzNCOztXQUVHO1FBQ0ksWUFBMkI7WUFKM0IsVUFBSyxHQUFMLEtBQUssQ0FBZTtZQUlwQixpQkFBWSxHQUFaLFlBQVksQ0FBZTtZQUNwQzs7Ozs7Ozs7Ozs7Ozs7OztlQWdCRztZQUNILHNFQUFzRTtZQUN0RSxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxTQUFzQjtnQkFDbkQsSUFBSSxTQUFTLFlBQVksQ0FBQyxDQUFDLGNBQWMsSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLFlBQVksQ0FBQyxJQUFJO29CQUM1RSxTQUFTLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsRUFBRTtvQkFDbkQsSUFBTSxHQUFHLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFpQixDQUFDO29CQUM5QyxPQUFPLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3pDO2dCQUNELE9BQU8sU0FBUyxDQUFDO1lBQ25CLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNILGlDQUFDO0lBQUQsQ0FBQyxB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QUFZLENBQUMsQ0FBQyxtQkFBbUIsRUFBRTtZQUN6QyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7U0FDbEI7YUFBTSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsZUFBZSxFQUFFO1lBQzVDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztTQUNuQjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEO1FBQXlDLCtDQUFrQjtRQUN6RCw2QkFBWSxJQUFxQixFQUFTLElBQWlCLEVBQVMsU0FBMkI7WUFBL0YsWUFDRSxrQkFBTSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUN4QjtZQUZ5QyxVQUFJLEdBQUosSUFBSSxDQUFhO1lBQVMsZUFBUyxHQUFULFNBQVMsQ0FBa0I7O1FBRS9GLENBQUM7UUFDSCwwQkFBQztJQUFELENBQUMsQUFKRCxDQUF5QyxLQUFLLENBQUMsWUFBWSxHQUkxRDtJQUpZLGtEQUFtQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2RBc3QgZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5leHBvcnQgY2xhc3MgRXZlbnRIYW5kbGVyVmFycyB7IHN0YXRpYyBldmVudCA9IG8udmFyaWFibGUoJyRldmVudCcpOyB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9jYWxSZXNvbHZlciB7IGdldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsOyB9XG5cbmV4cG9ydCBjbGFzcyBDb252ZXJ0QWN0aW9uQmluZGluZ1Jlc3VsdCB7XG4gIC8qKlxuICAgKiBTdG9yZSBzdGF0ZW1lbnRzIHdoaWNoIGFyZSByZW5kZXIzIGNvbXBhdGlibGUuXG4gICAqL1xuICByZW5kZXIzU3RtdHM6IG8uU3RhdGVtZW50W107XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgLyoqXG4gICAgICAgKiBSZW5kZXIyIGNvbXBhdGlibGUgc3RhdGVtZW50cyxcbiAgICAgICAqL1xuICAgICAgcHVibGljIHN0bXRzOiBvLlN0YXRlbWVudFtdLFxuICAgICAgLyoqXG4gICAgICAgKiBWYXJpYWJsZSBuYW1lIHVzZWQgd2l0aCByZW5kZXIyIGNvbXBhdGlibGUgc3RhdGVtZW50cy5cbiAgICAgICAqL1xuICAgICAgcHVibGljIGFsbG93RGVmYXVsdDogby5SZWFkVmFyRXhwcikge1xuICAgIC8qKlxuICAgICAqIFRoaXMgaXMgYml0IG9mIGEgaGFjay4gSXQgY29udmVydHMgc3RhdGVtZW50cyB3aGljaCByZW5kZXIyIGV4cGVjdHMgdG8gc3RhdGVtZW50cyB3aGljaCBhcmVcbiAgICAgKiBleHBlY3RlZCBieSByZW5kZXIzLlxuICAgICAqXG4gICAgICogRXhhbXBsZTogYDxkaXYgY2xpY2s9XCJkb1NvbWV0aGluZygkZXZlbnQpXCI+YCB3aWxsIGdlbmVyYXRlOlxuICAgICAqXG4gICAgICogUmVuZGVyMzpcbiAgICAgKiBgYGBcbiAgICAgKiBjb25zdCBwZF9iOmFueSA9ICgoPGFueT5jdHguZG9Tb21ldGhpbmcoJGV2ZW50KSkgIT09IGZhbHNlKTtcbiAgICAgKiByZXR1cm4gcGRfYjtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIGJ1dCByZW5kZXIyIGV4cGVjdHM6XG4gICAgICogYGBgXG4gICAgICogcmV0dXJuIGN0eC5kb1NvbWV0aGluZygkZXZlbnQpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIC8vIFRPRE8obWlza28pOiByZW1vdmUgdGhpcyBoYWNrIG9uY2Ugd2Ugbm8gbG9uZ2VyIHN1cHBvcnQgVmlld0VuZ2luZS5cbiAgICB0aGlzLnJlbmRlcjNTdG10cyA9IHN0bXRzLm1hcCgoc3RhdGVtZW50OiBvLlN0YXRlbWVudCkgPT4ge1xuICAgICAgaWYgKHN0YXRlbWVudCBpbnN0YW5jZW9mIG8uRGVjbGFyZVZhclN0bXQgJiYgc3RhdGVtZW50Lm5hbWUgPT0gYWxsb3dEZWZhdWx0Lm5hbWUgJiZcbiAgICAgICAgICBzdGF0ZW1lbnQudmFsdWUgaW5zdGFuY2VvZiBvLkJpbmFyeU9wZXJhdG9yRXhwcikge1xuICAgICAgICBjb25zdCBsaHMgPSBzdGF0ZW1lbnQudmFsdWUubGhzIGFzIG8uQ2FzdEV4cHI7XG4gICAgICAgIHJldHVybiBuZXcgby5SZXR1cm5TdGF0ZW1lbnQobGhzLnZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdGF0ZW1lbnQ7XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgSW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiBvLkV4cHJlc3Npb247XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIGV4cHJlc3Npb24gQVNUIGludG8gYW4gZXhlY3V0YWJsZSBvdXRwdXQgQVNULCBhc3N1bWluZyB0aGUgZXhwcmVzc2lvbiBpc1xuICogdXNlZCBpbiBhbiBhY3Rpb24gYmluZGluZyAoZS5nLiBhbiBldmVudCBoYW5kbGVyKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXIgfCBudWxsLCBpbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sIGFjdGlvbjogY2RBc3QuQVNULFxuICAgIGJpbmRpbmdJZDogc3RyaW5nLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24/OiBJbnRlcnBvbGF0aW9uRnVuY3Rpb24sXG4gICAgYmFzZVNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pOiBDb252ZXJ0QWN0aW9uQmluZGluZ1Jlc3VsdCB7XG4gIGlmICghbG9jYWxSZXNvbHZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIgPSBuZXcgRGVmYXVsdExvY2FsUmVzb2x2ZXIoKTtcbiAgfVxuICBjb25zdCBhY3Rpb25XaXRob3V0QnVpbHRpbnMgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnMoXG4gICAgICB7XG4gICAgICAgIGNyZWF0ZUxpdGVyYWxBcnJheUNvbnZlcnRlcjogKGFyZ0NvdW50OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAvLyBOb3RlOiBubyBjYWNoaW5nIGZvciBsaXRlcmFsIGFycmF5cyBpbiBhY3Rpb25zLlxuICAgICAgICAgIHJldHVybiAoYXJnczogby5FeHByZXNzaW9uW10pID0+IG8ubGl0ZXJhbEFycihhcmdzKTtcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcjogKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKSA9PiB7XG4gICAgICAgICAgLy8gTm90ZTogbm8gY2FjaGluZyBmb3IgbGl0ZXJhbCBtYXBzIGluIGFjdGlvbnMuXG4gICAgICAgICAgcmV0dXJuICh2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBlbnRyaWVzID0ga2V5cy5tYXAoKGssIGkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGsua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogay5xdW90ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVQaXBlQ29udmVydGVyOiAobmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBBY3Rpb25zIGFyZSBub3QgYWxsb3dlZCB0byBjb250YWluIHBpcGVzLiBQaXBlOiAke25hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBhY3Rpb24pO1xuXG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX0FzdFRvSXJWaXNpdG9yKFxuICAgICAgbG9jYWxSZXNvbHZlciwgaW1wbGljaXRSZWNlaXZlciwgYmluZGluZ0lkLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24sIGJhc2VTb3VyY2VTcGFuKTtcbiAgY29uc3QgYWN0aW9uU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgZmxhdHRlblN0YXRlbWVudHMoYWN0aW9uV2l0aG91dEJ1aWx0aW5zLnZpc2l0KHZpc2l0b3IsIF9Nb2RlLlN0YXRlbWVudCksIGFjdGlvblN0bXRzKTtcbiAgcHJlcGVuZFRlbXBvcmFyeURlY2xzKHZpc2l0b3IudGVtcG9yYXJ5Q291bnQsIGJpbmRpbmdJZCwgYWN0aW9uU3RtdHMpO1xuICBjb25zdCBsYXN0SW5kZXggPSBhY3Rpb25TdG10cy5sZW5ndGggLSAxO1xuICBsZXQgcHJldmVudERlZmF1bHRWYXI6IG8uUmVhZFZhckV4cHIgPSBudWxsICE7XG4gIGlmIChsYXN0SW5kZXggPj0gMCkge1xuICAgIGNvbnN0IGxhc3RTdGF0ZW1lbnQgPSBhY3Rpb25TdG10c1tsYXN0SW5kZXhdO1xuICAgIGNvbnN0IHJldHVybkV4cHIgPSBjb252ZXJ0U3RtdEludG9FeHByZXNzaW9uKGxhc3RTdGF0ZW1lbnQpO1xuICAgIGlmIChyZXR1cm5FeHByKSB7XG4gICAgICAvLyBOb3RlOiBXZSBuZWVkIHRvIGNhc3QgdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIGNhbGwgdG8gZHluYW1pYyxcbiAgICAgIC8vIGFzIGl0IG1pZ2h0IGJlIGEgdm9pZCBtZXRob2QhXG4gICAgICBwcmV2ZW50RGVmYXVsdFZhciA9IGNyZWF0ZVByZXZlbnREZWZhdWx0VmFyKGJpbmRpbmdJZCk7XG4gICAgICBhY3Rpb25TdG10c1tsYXN0SW5kZXhdID1cbiAgICAgICAgICBwcmV2ZW50RGVmYXVsdFZhci5zZXQocmV0dXJuRXhwci5jYXN0KG8uRFlOQU1JQ19UWVBFKS5ub3RJZGVudGljYWwoby5saXRlcmFsKGZhbHNlKSkpXG4gICAgICAgICAgICAgIC50b0RlY2xTdG10KG51bGwsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmV3IENvbnZlcnRBY3Rpb25CaW5kaW5nUmVzdWx0KGFjdGlvblN0bXRzLCBwcmV2ZW50RGVmYXVsdFZhcik7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbHRpbkNvbnZlcnRlciB7IChhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbjsgfVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5IHtcbiAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyKGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xuICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKTogQnVpbHRpbkNvbnZlcnRlcjtcbiAgY3JlYXRlUGlwZUNvbnZlcnRlcihuYW1lOiBzdHJpbmcsIGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgIGNvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5LCBhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LkFTVCB7XG4gIHJldHVybiBjb252ZXJ0QnVpbHRpbnMoY29udmVydGVyRmFjdG9yeSwgYXN0KTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RtdHM6IG8uU3RhdGVtZW50W10sIHB1YmxpYyBjdXJyVmFsRXhwcjogby5FeHByZXNzaW9uKSB7fVxufVxuXG5leHBvcnQgZW51bSBCaW5kaW5nRm9ybSB7XG4gIC8vIFRoZSBnZW5lcmFsIGZvcm0gb2YgYmluZGluZyBleHByZXNzaW9uLCBzdXBwb3J0cyBhbGwgZXhwcmVzc2lvbnMuXG4gIEdlbmVyYWwsXG5cbiAgLy8gVHJ5IHRvIGdlbmVyYXRlIGEgc2ltcGxlIGJpbmRpbmcgKG5vIHRlbXBvcmFyaWVzIG9yIHN0YXRlbWVudHMpXG4gIC8vIG90aGVyd2lzZSBnZW5lcmF0ZSBhIGdlbmVyYWwgYmluZGluZ1xuICBUcnlTaW1wbGUsXG59XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIGV4cHJlc3Npb24gQVNUIGludG8gYW4gZXhlY3V0YWJsZSBvdXRwdXQgQVNULCBhc3N1bWluZyB0aGUgZXhwcmVzc2lvblxuICogaXMgdXNlZCBpbiBwcm9wZXJ0eSBiaW5kaW5nLiBUaGUgZXhwcmVzc2lvbiBoYXMgdG8gYmUgcHJlcHJvY2Vzc2VkIHZpYVxuICogYGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGluc2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXIgfCBudWxsLCBpbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sXG4gICAgZXhwcmVzc2lvbldpdGhvdXRCdWlsdGluczogY2RBc3QuQVNULCBiaW5kaW5nSWQ6IHN0cmluZywgZm9ybTogQmluZGluZ0Zvcm0sXG4gICAgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uPzogSW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTogQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdCB7XG4gIGlmICghbG9jYWxSZXNvbHZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIgPSBuZXcgRGVmYXVsdExvY2FsUmVzb2x2ZXIoKTtcbiAgfVxuICBjb25zdCBjdXJyVmFsRXhwciA9IGNyZWF0ZUN1cnJWYWx1ZUV4cHIoYmluZGluZ0lkKTtcbiAgY29uc3Qgc3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdmlzaXRvciA9XG4gICAgICBuZXcgX0FzdFRvSXJWaXNpdG9yKGxvY2FsUmVzb2x2ZXIsIGltcGxpY2l0UmVjZWl2ZXIsIGJpbmRpbmdJZCwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgY29uc3Qgb3V0cHV0RXhwcjogby5FeHByZXNzaW9uID0gZXhwcmVzc2lvbldpdGhvdXRCdWlsdGlucy52aXNpdCh2aXNpdG9yLCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICBpZiAodmlzaXRvci50ZW1wb3JhcnlDb3VudCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmlzaXRvci50ZW1wb3JhcnlDb3VudDsgaSsrKSB7XG4gICAgICBzdG10cy5wdXNoKHRlbXBvcmFyeURlY2xhcmF0aW9uKGJpbmRpbmdJZCwgaSkpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChmb3JtID09IEJpbmRpbmdGb3JtLlRyeVNpbXBsZSkge1xuICAgIHJldHVybiBuZXcgQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdChbXSwgb3V0cHV0RXhwcik7XG4gIH1cblxuICBzdG10cy5wdXNoKGN1cnJWYWxFeHByLnNldChvdXRwdXRFeHByKS50b0RlY2xTdG10KG8uRFlOQU1JQ19UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gIHJldHVybiBuZXcgQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdChzdG10cywgY3VyclZhbEV4cHIpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QnVpbHRpbnMoY29udmVydGVyRmFjdG9yeTogQnVpbHRpbkNvbnZlcnRlckZhY3RvcnksIGFzdDogY2RBc3QuQVNUKTogY2RBc3QuQVNUIHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfQnVpbHRpbkFzdENvbnZlcnRlcihjb252ZXJ0ZXJGYWN0b3J5KTtcbiAgcmV0dXJuIGFzdC52aXNpdCh2aXNpdG9yKTtcbn1cblxuZnVuY3Rpb24gdGVtcG9yYXJ5TmFtZShiaW5kaW5nSWQ6IHN0cmluZywgdGVtcG9yYXJ5TnVtYmVyOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYHRtcF8ke2JpbmRpbmdJZH1fJHt0ZW1wb3JhcnlOdW1iZXJ9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRlbXBvcmFyeURlY2xhcmF0aW9uKGJpbmRpbmdJZDogc3RyaW5nLCB0ZW1wb3JhcnlOdW1iZXI6IG51bWJlcik6IG8uU3RhdGVtZW50IHtcbiAgcmV0dXJuIG5ldyBvLkRlY2xhcmVWYXJTdG10KHRlbXBvcmFyeU5hbWUoYmluZGluZ0lkLCB0ZW1wb3JhcnlOdW1iZXIpLCBvLk5VTExfRVhQUik7XG59XG5cbmZ1bmN0aW9uIHByZXBlbmRUZW1wb3JhcnlEZWNscyhcbiAgICB0ZW1wb3JhcnlDb3VudDogbnVtYmVyLCBiaW5kaW5nSWQ6IHN0cmluZywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSkge1xuICBmb3IgKGxldCBpID0gdGVtcG9yYXJ5Q291bnQgLSAxOyBpID49IDA7IGktLSkge1xuICAgIHN0YXRlbWVudHMudW5zaGlmdCh0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQsIGkpKTtcbiAgfVxufVxuXG5lbnVtIF9Nb2RlIHtcbiAgU3RhdGVtZW50LFxuICBFeHByZXNzaW9uXG59XG5cbmZ1bmN0aW9uIGVuc3VyZVN0YXRlbWVudE1vZGUobW9kZTogX01vZGUsIGFzdDogY2RBc3QuQVNUKSB7XG4gIGlmIChtb2RlICE9PSBfTW9kZS5TdGF0ZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGEgc3RhdGVtZW50LCBidXQgc2F3ICR7YXN0fWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGU6IF9Nb2RlLCBhc3Q6IGNkQXN0LkFTVCkge1xuICBpZiAobW9kZSAhPT0gX01vZGUuRXhwcmVzc2lvbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYW4gZXhwcmVzc2lvbiwgYnV0IHNhdyAke2FzdH1gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlOiBfTW9kZSwgZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50IHtcbiAgaWYgKG1vZGUgPT09IF9Nb2RlLlN0YXRlbWVudCkge1xuICAgIHJldHVybiBleHByLnRvU3RtdCgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbmNsYXNzIF9CdWlsdGluQXN0Q29udmVydGVyIGV4dGVuZHMgY2RBc3QuQXN0VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9jb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSkgeyBzdXBlcigpOyB9XG4gIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSBbYXN0LmV4cCwgLi4uYXN0LmFyZ3NdLm1hcChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFzdC5zcGFuLCBhcmdzLCB0aGlzLl9jb252ZXJ0ZXJGYWN0b3J5LmNyZWF0ZVBpcGVDb252ZXJ0ZXIoYXN0Lm5hbWUsIGFyZ3MubGVuZ3RoKSk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IGFzdC5leHByZXNzaW9ucy5tYXAoYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXJncywgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXIoYXN0LmV4cHJlc3Npb25zLmxlbmd0aCkpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IGFzdC52YWx1ZXMubWFwKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuXG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXJncywgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKGFzdC5rZXlzKSk7XG4gIH1cbn1cblxuY2xhc3MgX0FzdFRvSXJWaXNpdG9yIGltcGxlbWVudHMgY2RBc3QuQXN0VmlzaXRvciB7XG4gIHByaXZhdGUgX25vZGVNYXAgPSBuZXcgTWFwPGNkQXN0LkFTVCwgY2RBc3QuQVNUPigpO1xuICBwcml2YXRlIF9yZXN1bHRNYXAgPSBuZXcgTWFwPGNkQXN0LkFTVCwgby5FeHByZXNzaW9uPigpO1xuICBwcml2YXRlIF9jdXJyZW50VGVtcG9yYXJ5OiBudW1iZXIgPSAwO1xuICBwdWJsaWMgdGVtcG9yYXJ5Q291bnQ6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9sb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyLCBwcml2YXRlIF9pbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sXG4gICAgICBwcml2YXRlIGJpbmRpbmdJZDogc3RyaW5nLCBwcml2YXRlIGludGVycG9sYXRpb25GdW5jdGlvbjogSW50ZXJwb2xhdGlvbkZ1bmN0aW9ufHVuZGVmaW5lZCxcbiAgICAgIHByaXZhdGUgYmFzZVNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4pIHt9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBsZXQgb3A6IG8uQmluYXJ5T3BlcmF0b3I7XG4gICAgc3dpdGNoIChhc3Qub3BlcmF0aW9uKSB7XG4gICAgICBjYXNlICcrJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLlBsdXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5NaW51cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcqJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk11bHRpcGx5O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy8nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuRGl2aWRlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyUnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTW9kdWxvO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyYmJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkFuZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd8fCc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5PcjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc9PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5FcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnIT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz09PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5JZGVudGljYWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnIT09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk5vdElkZW50aWNhbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc8JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz4nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz49JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIG9wZXJhdGlvbiAke2FzdC5vcGVyYXRpb259YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICBtb2RlLFxuICAgICAgICBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICBvcCwgdGhpcy5fdmlzaXQoYXN0LmxlZnQsIF9Nb2RlLkV4cHJlc3Npb24pLCB0aGlzLl92aXNpdChhc3QucmlnaHQsIF9Nb2RlLkV4cHJlc3Npb24pLFxuICAgICAgICAgICAgdW5kZWZpbmVkLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSkpO1xuICB9XG5cbiAgdmlzaXRDaGFpbihhc3Q6IGNkQXN0LkNoYWluLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgZW5zdXJlU3RhdGVtZW50TW9kZShtb2RlLCBhc3QpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgbW9kZSk7XG4gIH1cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogY2RBc3QuQ29uZGl0aW9uYWwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCB2YWx1ZTogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LmNvbmRpdGlvbiwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICBtb2RlLCB2YWx1ZS5jb25kaXRpb25hbChcbiAgICAgICAgICAgICAgICAgIHRoaXMuX3Zpc2l0KGFzdC50cnVlRXhwLCBfTW9kZS5FeHByZXNzaW9uKSxcbiAgICAgICAgICAgICAgICAgIHRoaXMuX3Zpc2l0KGFzdC5mYWxzZUV4cCwgX01vZGUuRXhwcmVzc2lvbiksIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYElsbGVnYWwgc3RhdGU6IFBpcGVzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zLiBQaXBlOiAke2FzdC5uYW1lfWApO1xuICB9XG5cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBjZEFzdC5GdW5jdGlvbkNhbGwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgbGV0IGZuUmVzdWx0OiBvLkV4cHJlc3Npb247XG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIEJ1aWx0aW5GdW5jdGlvbkNhbGwpIHtcbiAgICAgIGZuUmVzdWx0ID0gYXN0LmNvbnZlcnRlcihjb252ZXJ0ZWRBcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm5SZXN1bHQgPSB0aGlzLl92aXNpdChhc3QudGFyZ2V0ICEsIF9Nb2RlLkV4cHJlc3Npb24pXG4gICAgICAgICAgICAgICAgICAgICAuY2FsbEZuKGNvbnZlcnRlZEFyZ3MsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGZuUmVzdWx0KTtcbiAgfVxuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVFeHByZXNzaW9uTW9kZShtb2RlLCBhc3QpO1xuICAgIHJldHVybiB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyO1xuICB9XG5cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogY2RBc3QuSW50ZXJwb2xhdGlvbiwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGUsIGFzdCk7XG4gICAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoYXN0LmV4cHJlc3Npb25zLmxlbmd0aCldO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXN0LnN0cmluZ3MubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBhcmdzLnB1c2goby5saXRlcmFsKGFzdC5zdHJpbmdzW2ldKSk7XG4gICAgICBhcmdzLnB1c2godGhpcy5fdmlzaXQoYXN0LmV4cHJlc3Npb25zW2ldLCBfTW9kZS5FeHByZXNzaW9uKSk7XG4gICAgfVxuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoYXN0LnN0cmluZ3NbYXN0LnN0cmluZ3MubGVuZ3RoIC0gMV0pKTtcblxuICAgIGlmICh0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0LmV4cHJlc3Npb25zLmxlbmd0aCA8PSA5ID9cbiAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmlubGluZUludGVycG9sYXRlKS5jYWxsRm4oYXJncykgOlxuICAgICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW50ZXJwb2xhdGUpLmNhbGxGbihbXG4gICAgICAgICAgYXJnc1swXSwgby5saXRlcmFsQXJyKGFyZ3Muc2xpY2UoMSksIHVuZGVmaW5lZCwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpXG4gICAgICAgIF0pO1xuICB9XG5cbiAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgICBtb2RlLCB0aGlzLl92aXNpdChhc3Qub2JqLCBfTW9kZS5FeHByZXNzaW9uKS5rZXkodGhpcy5fdmlzaXQoYXN0LmtleSwgX01vZGUuRXhwcmVzc2lvbikpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3Qgb2JqOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3Qub2JqLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCBrZXk6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5rZXksIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGNvbnN0IHZhbHVlOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QudmFsdWUsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCBvYmoua2V5KGtleSkuc2V0KHZhbHVlKSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBTdGF0ZTogbGl0ZXJhbCBhcnJheXMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnNgKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXAsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IGxpdGVyYWwgbWFwcyBzaG91bGQgaGF2ZSBiZWVuIGNvbnZlcnRlZCBpbnRvIGZ1bmN0aW9uc2ApO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogY2RBc3QuTGl0ZXJhbFByaW1pdGl2ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIC8vIEZvciBsaXRlcmFsIHZhbHVlcyBvZiBudWxsLCB1bmRlZmluZWQsIHRydWUsIG9yIGZhbHNlIGFsbG93IHR5cGUgaW50ZXJmZXJlbmNlXG4gICAgLy8gdG8gaW5mZXIgdGhlIHR5cGUuXG4gICAgY29uc3QgdHlwZSA9XG4gICAgICAgIGFzdC52YWx1ZSA9PT0gbnVsbCB8fCBhc3QudmFsdWUgPT09IHVuZGVmaW5lZCB8fCBhc3QudmFsdWUgPT09IHRydWUgfHwgYXN0LnZhbHVlID09PSB0cnVlID9cbiAgICAgICAgby5JTkZFUlJFRF9UWVBFIDpcbiAgICAgICAgdW5kZWZpbmVkO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgby5saXRlcmFsKGFzdC52YWx1ZSwgdHlwZSwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHsgcmV0dXJuIHRoaXMuX2xvY2FsUmVzb2x2ZXIuZ2V0TG9jYWwobmFtZSk7IH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBjZEFzdC5NZXRob2RDYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIgJiYgYXN0Lm5hbWUgPT0gJyRhbnknKSB7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbikgYXMgYW55W107XG4gICAgICBpZiAoYXJncy5sZW5ndGggIT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgSW52YWxpZCBjYWxsIHRvICRhbnksIGV4cGVjdGVkIDEgYXJndW1lbnQgYnV0IHJlY2VpdmVkICR7YXJncy5sZW5ndGggfHwgJ25vbmUnfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChhcmdzWzBdIGFzIG8uRXhwcmVzc2lvbikuY2FzdChvLkRZTkFNSUNfVFlQRSwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpO1xuICAgIH1cblxuICAgIGNvbnN0IGxlZnRNb3N0U2FmZSA9IHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpO1xuICAgIGlmIChsZWZ0TW9zdFNhZmUpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgbGVmdE1vc3RTYWZlLCBtb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgICAgbGV0IHJlc3VsdDogYW55ID0gbnVsbDtcbiAgICAgIGNvbnN0IHJlY2VpdmVyID0gdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgICBjb25zdCB2YXJFeHByID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUpO1xuICAgICAgICBpZiAodmFyRXhwcikge1xuICAgICAgICAgIHJlc3VsdCA9IHZhckV4cHIuY2FsbEZuKGFyZ3MpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0ID09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0ID0gcmVjZWl2ZXIuY2FsbE1ldGhvZChhc3QubmFtZSwgYXJncywgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIHJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRQcmVmaXhOb3QoYXN0OiBjZEFzdC5QcmVmaXhOb3QsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgby5ub3QodGhpcy5fdmlzaXQoYXN0LmV4cHJlc3Npb24sIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gIH1cblxuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBjZEFzdC5Ob25OdWxsQXNzZXJ0LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICBtb2RlLCBvLmFzc2VydE5vdE51bGwodGhpcy5fdmlzaXQoYXN0LmV4cHJlc3Npb24sIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gIH1cblxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlByb3BlcnR5UmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IGxlZnRNb3N0U2FmZSA9IHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpO1xuICAgIGlmIChsZWZ0TW9zdFNhZmUpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgbGVmdE1vc3RTYWZlLCBtb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHJlc3VsdDogYW55ID0gbnVsbDtcbiAgICAgIGNvbnN0IHJlY2VpdmVyID0gdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgICByZXN1bHQgPSB0aGlzLl9nZXRMb2NhbChhc3QubmFtZSk7XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0ID09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0ID0gcmVjZWl2ZXIucHJvcChhc3QubmFtZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgcmVzdWx0KTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBjZEFzdC5Qcm9wZXJ0eVdyaXRlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgcmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5yZWNlaXZlciwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgICBsZXQgdmFyRXhwcjogby5SZWFkUHJvcEV4cHJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHJlY2VpdmVyID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICBjb25zdCBsb2NhbEV4cHIgPSB0aGlzLl9nZXRMb2NhbChhc3QubmFtZSk7XG4gICAgICBpZiAobG9jYWxFeHByKSB7XG4gICAgICAgIGlmIChsb2NhbEV4cHIgaW5zdGFuY2VvZiBvLlJlYWRQcm9wRXhwcikge1xuICAgICAgICAgIC8vIElmIHRoZSBsb2NhbCB2YXJpYWJsZSBpcyBhIHByb3BlcnR5IHJlYWQgZXhwcmVzc2lvbiwgaXQncyBhIHJlZmVyZW5jZVxuICAgICAgICAgIC8vIHRvIGEgJ2NvbnRleHQucHJvcGVydHknIHZhbHVlIGFuZCB3aWxsIGJlIHVzZWQgYXMgdGhlIHRhcmdldCBvZiB0aGVcbiAgICAgICAgICAvLyB3cml0ZSBleHByZXNzaW9uLlxuICAgICAgICAgIHZhckV4cHIgPSBsb2NhbEV4cHI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIGl0J3MgYW4gZXJyb3IuXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYXNzaWduIHRvIGEgcmVmZXJlbmNlIG9yIHZhcmlhYmxlIScpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIElmIG5vIGxvY2FsIGV4cHJlc3Npb24gY291bGQgYmUgcHJvZHVjZWQsIHVzZSB0aGUgb3JpZ2luYWwgcmVjZWl2ZXInc1xuICAgIC8vIHByb3BlcnR5IGFzIHRoZSB0YXJnZXQuXG4gICAgaWYgKHZhckV4cHIgPT09IG51bGwpIHtcbiAgICAgIHZhckV4cHIgPSByZWNlaXZlci5wcm9wKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIHZhckV4cHIuc2V0KHRoaXMuX3Zpc2l0KGFzdC52YWx1ZSwgX01vZGUuRXhwcmVzc2lvbikpKTtcbiAgfVxuXG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpLCBtb2RlKTtcbiAgfVxuXG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCksIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRBbGwoYXN0czogY2RBc3QuQVNUW10sIG1vZGU6IF9Nb2RlKTogYW55IHsgcmV0dXJuIGFzdHMubWFwKGFzdCA9PiB0aGlzLl92aXNpdChhc3QsIG1vZGUpKTsgfVxuXG4gIHZpc2l0UXVvdGUoYXN0OiBjZEFzdC5RdW90ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcihgUXVvdGVzIGFyZSBub3Qgc3VwcG9ydGVkIGZvciBldmFsdWF0aW9uIVxuICAgICAgICBTdGF0ZW1lbnQ6ICR7YXN0LnVuaW50ZXJwcmV0ZWRFeHByZXNzaW9ufSBsb2NhdGVkIGF0ICR7YXN0LmxvY2F0aW9ufWApO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXQoYXN0OiBjZEFzdC5BU1QsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9yZXN1bHRNYXAuZ2V0KGFzdCk7XG4gICAgaWYgKHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICByZXR1cm4gKHRoaXMuX25vZGVNYXAuZ2V0KGFzdCkgfHwgYXN0KS52aXNpdCh0aGlzLCBtb2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydFNhZmVBY2Nlc3MoXG4gICAgICBhc3Q6IGNkQXN0LkFTVCwgbGVmdE1vc3RTYWZlOiBjZEFzdC5TYWZlTWV0aG9kQ2FsbHxjZEFzdC5TYWZlUHJvcGVydHlSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgLy8gSWYgdGhlIGV4cHJlc3Npb24gY29udGFpbnMgYSBzYWZlIGFjY2VzcyBub2RlIG9uIHRoZSBsZWZ0IGl0IG5lZWRzIHRvIGJlIGNvbnZlcnRlZCB0b1xuICAgIC8vIGFuIGV4cHJlc3Npb24gdGhhdCBndWFyZHMgdGhlIGFjY2VzcyB0byB0aGUgbWVtYmVyIGJ5IGNoZWNraW5nIHRoZSByZWNlaXZlciBmb3IgYmxhbmsuIEFzXG4gICAgLy8gZXhlY3V0aW9uIHByb2NlZWRzIGZyb20gbGVmdCB0byByaWdodCwgdGhlIGxlZnQgbW9zdCBwYXJ0IG9mIHRoZSBleHByZXNzaW9uIG11c3QgYmUgZ3VhcmRlZFxuICAgIC8vIGZpcnN0IGJ1dCwgYmVjYXVzZSBtZW1iZXIgYWNjZXNzIGlzIGxlZnQgYXNzb2NpYXRpdmUsIHRoZSByaWdodCBzaWRlIG9mIHRoZSBleHByZXNzaW9uIGlzIGF0XG4gICAgLy8gdGhlIHRvcCBvZiB0aGUgQVNULiBUaGUgZGVzaXJlZCByZXN1bHQgcmVxdWlyZXMgbGlmdGluZyBhIGNvcHkgb2YgdGhlIHRoZSBsZWZ0IHBhcnQgb2YgdGhlXG4gICAgLy8gZXhwcmVzc2lvbiB1cCB0byB0ZXN0IGl0IGZvciBibGFuayBiZWZvcmUgZ2VuZXJhdGluZyB0aGUgdW5ndWFyZGVkIHZlcnNpb24uXG5cbiAgICAvLyBDb25zaWRlciwgZm9yIGV4YW1wbGUgdGhlIGZvbGxvd2luZyBleHByZXNzaW9uOiBhPy5iLmM/LmQuZVxuXG4gICAgLy8gVGhpcyByZXN1bHRzIGluIHRoZSBhc3Q6XG4gICAgLy8gICAgICAgICAuXG4gICAgLy8gICAgICAgIC8gXFxcbiAgICAvLyAgICAgICA/LiAgIGVcbiAgICAvLyAgICAgIC8gIFxcXG4gICAgLy8gICAgIC4gICAgZFxuICAgIC8vICAgIC8gXFxcbiAgICAvLyAgID8uICBjXG4gICAgLy8gIC8gIFxcXG4gICAgLy8gYSAgICBiXG5cbiAgICAvLyBUaGUgZm9sbG93aW5nIHRyZWUgc2hvdWxkIGJlIGdlbmVyYXRlZDpcbiAgICAvL1xuICAgIC8vICAgICAgICAvLS0tLSA/IC0tLS1cXFxuICAgIC8vICAgICAgIC8gICAgICB8ICAgICAgXFxcbiAgICAvLyAgICAgYSAgIC8tLS0gPyAtLS1cXCAgbnVsbFxuICAgIC8vICAgICAgICAvICAgICB8ICAgICBcXFxuICAgIC8vICAgICAgIC4gICAgICAuICAgICBudWxsXG4gICAgLy8gICAgICAvIFxcICAgIC8gXFxcbiAgICAvLyAgICAgLiAgYyAgIC4gICBlXG4gICAgLy8gICAgLyBcXCAgICAvIFxcXG4gICAgLy8gICBhICAgYiAgLCAgIGRcbiAgICAvLyAgICAgICAgIC8gXFxcbiAgICAvLyAgICAgICAgLiAgIGNcbiAgICAvLyAgICAgICAvIFxcXG4gICAgLy8gICAgICBhICAgYlxuICAgIC8vXG4gICAgLy8gTm90aWNlIHRoYXQgdGhlIGZpcnN0IGd1YXJkIGNvbmRpdGlvbiBpcyB0aGUgbGVmdCBoYW5kIG9mIHRoZSBsZWZ0IG1vc3Qgc2FmZSBhY2Nlc3Mgbm9kZVxuICAgIC8vIHdoaWNoIGNvbWVzIGluIGFzIGxlZnRNb3N0U2FmZSB0byB0aGlzIHJvdXRpbmUuXG5cbiAgICBsZXQgZ3VhcmRlZEV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGxldCB0ZW1wb3Jhcnk6IG8uUmVhZFZhckV4cHIgPSB1bmRlZmluZWQgITtcbiAgICBpZiAodGhpcy5uZWVkc1RlbXBvcmFyeShsZWZ0TW9zdFNhZmUucmVjZWl2ZXIpKSB7XG4gICAgICAvLyBJZiB0aGUgZXhwcmVzc2lvbiBoYXMgbWV0aG9kIGNhbGxzIG9yIHBpcGVzIHRoZW4gd2UgbmVlZCB0byBzYXZlIHRoZSByZXN1bHQgaW50byBhXG4gICAgICAvLyB0ZW1wb3JhcnkgdmFyaWFibGUgdG8gYXZvaWQgY2FsbGluZyBzdGF0ZWZ1bCBvciBpbXB1cmUgY29kZSBtb3JlIHRoYW4gb25jZS5cbiAgICAgIHRlbXBvcmFyeSA9IHRoaXMuYWxsb2NhdGVUZW1wb3JhcnkoKTtcblxuICAgICAgLy8gUHJlc2VydmUgdGhlIHJlc3VsdCBpbiB0aGUgdGVtcG9yYXJ5IHZhcmlhYmxlXG4gICAgICBndWFyZGVkRXhwcmVzc2lvbiA9IHRlbXBvcmFyeS5zZXQoZ3VhcmRlZEV4cHJlc3Npb24pO1xuXG4gICAgICAvLyBFbnN1cmUgYWxsIGZ1cnRoZXIgcmVmZXJlbmNlcyB0byB0aGUgZ3VhcmRlZCBleHByZXNzaW9uIHJlZmVyIHRvIHRoZSB0ZW1wb3JhcnkgaW5zdGVhZC5cbiAgICAgIHRoaXMuX3Jlc3VsdE1hcC5zZXQobGVmdE1vc3RTYWZlLnJlY2VpdmVyLCB0ZW1wb3JhcnkpO1xuICAgIH1cbiAgICBjb25zdCBjb25kaXRpb24gPSBndWFyZGVkRXhwcmVzc2lvbi5pc0JsYW5rKCk7XG5cbiAgICAvLyBDb252ZXJ0IHRoZSBhc3QgdG8gYW4gdW5ndWFyZGVkIGFjY2VzcyB0byB0aGUgcmVjZWl2ZXIncyBtZW1iZXIuIFRoZSBtYXAgd2lsbCBzdWJzdGl0dXRlXG4gICAgLy8gbGVmdE1vc3ROb2RlIHdpdGggaXRzIHVuZ3VhcmRlZCB2ZXJzaW9uIGluIHRoZSBjYWxsIHRvIGB0aGlzLnZpc2l0KClgLlxuICAgIGlmIChsZWZ0TW9zdFNhZmUgaW5zdGFuY2VvZiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCkge1xuICAgICAgdGhpcy5fbm9kZU1hcC5zZXQoXG4gICAgICAgICAgbGVmdE1vc3RTYWZlLFxuICAgICAgICAgIG5ldyBjZEFzdC5NZXRob2RDYWxsKFxuICAgICAgICAgICAgICBsZWZ0TW9zdFNhZmUuc3BhbiwgbGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBsZWZ0TW9zdFNhZmUubmFtZSwgbGVmdE1vc3RTYWZlLmFyZ3MpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbm9kZU1hcC5zZXQoXG4gICAgICAgICAgbGVmdE1vc3RTYWZlLFxuICAgICAgICAgIG5ldyBjZEFzdC5Qcm9wZXJ0eVJlYWQobGVmdE1vc3RTYWZlLnNwYW4sIGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgbGVmdE1vc3RTYWZlLm5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBSZWN1cnNpdmVseSBjb252ZXJ0IHRoZSBub2RlIG5vdyB3aXRob3V0IHRoZSBndWFyZGVkIG1lbWJlciBhY2Nlc3MuXG4gICAgY29uc3QgYWNjZXNzID0gdGhpcy5fdmlzaXQoYXN0LCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICAgIC8vIFJlbW92ZSB0aGUgbWFwcGluZy4gVGhpcyBpcyBub3Qgc3RyaWN0bHkgcmVxdWlyZWQgYXMgdGhlIGNvbnZlcnRlciBvbmx5IHRyYXZlcnNlcyBlYWNoIG5vZGVcbiAgICAvLyBvbmNlIGJ1dCBpcyBzYWZlciBpZiB0aGUgY29udmVyc2lvbiBpcyBjaGFuZ2VkIHRvIHRyYXZlcnNlIHRoZSBub2RlcyBtb3JlIHRoYW4gb25jZS5cbiAgICB0aGlzLl9ub2RlTWFwLmRlbGV0ZShsZWZ0TW9zdFNhZmUpO1xuXG4gICAgLy8gSWYgd2UgYWxsb2NhdGVkIGEgdGVtcG9yYXJ5LCByZWxlYXNlIGl0LlxuICAgIGlmICh0ZW1wb3JhcnkpIHtcbiAgICAgIHRoaXMucmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3JhcnkpO1xuICAgIH1cblxuICAgIC8vIFByb2R1Y2UgdGhlIGNvbmRpdGlvbmFsXG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGNvbmRpdGlvbi5jb25kaXRpb25hbChvLmxpdGVyYWwobnVsbCksIGFjY2VzcykpO1xuICB9XG5cbiAgLy8gR2l2ZW4gYSBleHByZXNzaW9uIG9mIHRoZSBmb3JtIGE/LmIuYz8uZC5lIHRoZSB0aGUgbGVmdCBtb3N0IHNhZmUgbm9kZSBpc1xuICAvLyB0aGUgKGE/LmIpLiBUaGUgLiBhbmQgPy4gYXJlIGxlZnQgYXNzb2NpYXRpdmUgdGh1cyBjYW4gYmUgcmV3cml0dGVuIGFzOlxuICAvLyAoKCgoYT8uYykuYikuYyk/LmQpLmUuIFRoaXMgcmV0dXJucyB0aGUgbW9zdCBkZWVwbHkgbmVzdGVkIHNhZmUgcmVhZCBvclxuICAvLyBzYWZlIG1ldGhvZCBjYWxsIGFzIHRoaXMgbmVlZHMgYmUgdHJhbnNmb3JtIGluaXRpYWxseSB0bzpcbiAgLy8gICBhID09IG51bGwgPyBudWxsIDogYS5jLmIuYz8uZC5lXG4gIC8vIHRoZW4gdG86XG4gIC8vICAgYSA9PSBudWxsID8gbnVsbCA6IGEuYi5jID09IG51bGwgPyBudWxsIDogYS5iLmMuZC5lXG4gIHByaXZhdGUgbGVmdE1vc3RTYWZlTm9kZShhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWR8Y2RBc3QuU2FmZU1ldGhvZENhbGwge1xuICAgIGNvbnN0IHZpc2l0ID0gKHZpc2l0b3I6IGNkQXN0LkFzdFZpc2l0b3IsIGFzdDogY2RBc3QuQVNUKTogYW55ID0+IHtcbiAgICAgIHJldHVybiAodGhpcy5fbm9kZU1hcC5nZXQoYXN0KSB8fCBhc3QpLnZpc2l0KHZpc2l0b3IpO1xuICAgIH07XG4gICAgcmV0dXJuIGFzdC52aXNpdCh7XG4gICAgICB2aXNpdEJpbmFyeShhc3Q6IGNkQXN0LkJpbmFyeSkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbikgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBjZEFzdC5Db25kaXRpb25hbCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogY2RBc3QuRnVuY3Rpb25DYWxsKSB7IHJldHVybiBudWxsOyB9LFxuICAgICAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogY2RBc3QuSW1wbGljaXRSZWNlaXZlcikgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24pIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdEtleWVkUmVhZChhc3Q6IGNkQXN0LktleWVkUmVhZCkgeyByZXR1cm4gdmlzaXQodGhpcywgYXN0Lm9iaik7IH0sXG4gICAgICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlKSB7IHJldHVybiBudWxsOyB9LFxuICAgICAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXkpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwKSB7IHJldHVybiBudWxsOyB9LFxuICAgICAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogY2RBc3QuTGl0ZXJhbFByaW1pdGl2ZSkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IGNkQXN0Lk1ldGhvZENhbGwpIHsgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcik7IH0sXG4gICAgICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90KSB7IHJldHVybiBudWxsOyB9LFxuICAgICAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogY2RBc3QuUHJvcGVydHlSZWFkKSB7IHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpOyB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogY2RBc3QuUHJvcGVydHlXcml0ZSkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0UXVvdGUoYXN0OiBjZEFzdC5RdW90ZSkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCkgeyByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKSB8fCBhc3Q7IH0sXG4gICAgICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBvZiB0aGUgQVNUIGluY2x1ZGVzIGEgbWV0aG9kIG9yIGEgcGlwZSBpbmRpY2F0aW5nIHRoYXQsIGlmIHRoZVxuICAvLyBleHByZXNzaW9uIGlzIHVzZWQgYXMgdGhlIHRhcmdldCBvZiBhIHNhZmUgcHJvcGVydHkgb3IgbWV0aG9kIGFjY2VzcyB0aGVuXG4gIC8vIHRoZSBleHByZXNzaW9uIHNob3VsZCBiZSBzdG9yZWQgaW50byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgcHJpdmF0ZSBuZWVkc1RlbXBvcmFyeShhc3Q6IGNkQXN0LkFTVCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHZpc2l0ID0gKHZpc2l0b3I6IGNkQXN0LkFzdFZpc2l0b3IsIGFzdDogY2RBc3QuQVNUKTogYm9vbGVhbiA9PiB7XG4gICAgICByZXR1cm4gYXN0ICYmICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodmlzaXRvcik7XG4gICAgfTtcbiAgICBjb25zdCB2aXNpdFNvbWUgPSAodmlzaXRvcjogY2RBc3QuQXN0VmlzaXRvciwgYXN0OiBjZEFzdC5BU1RbXSk6IGJvb2xlYW4gPT4ge1xuICAgICAgcmV0dXJuIGFzdC5zb21lKGFzdCA9PiB2aXNpdCh2aXNpdG9yLCBhc3QpKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnkpOlxuICAgICAgICAgIGJvb2xlYW57cmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5sZWZ0KSB8fCB2aXNpdCh0aGlzLCBhc3QucmlnaHQpO30sXG4gICAgICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4pIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsKTpcbiAgICAgICAgICBib29sZWFue3JldHVybiB2aXNpdCh0aGlzLCBhc3QuY29uZGl0aW9uKSB8fCB2aXNpdCh0aGlzLCBhc3QudHJ1ZUV4cCkgfHxcbiAgICAgICAgICAgICAgICAgICAgICB2aXNpdCh0aGlzLCBhc3QuZmFsc2VFeHApO30sXG4gICAgICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IGNkQXN0LkZ1bmN0aW9uQ2FsbCkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIpIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogY2RBc3QuSW50ZXJwb2xhdGlvbikgeyByZXR1cm4gdmlzaXRTb21lKHRoaXMsIGFzdC5leHByZXNzaW9ucyk7IH0sXG4gICAgICB2aXNpdEtleWVkUmVhZChhc3Q6IGNkQXN0LktleWVkUmVhZCkgeyByZXR1cm4gZmFsc2U7IH0sXG4gICAgICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5KSB7IHJldHVybiB0cnVlOyB9LFxuICAgICAgdmlzaXRMaXRlcmFsTWFwKGFzdDogY2RBc3QuTGl0ZXJhbE1hcCkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUpIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRNZXRob2RDYWxsKGFzdDogY2RBc3QuTWV0aG9kQ2FsbCkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlKSB7IHJldHVybiB0cnVlOyB9LFxuICAgICAgdmlzaXRQcmVmaXhOb3QoYXN0OiBjZEFzdC5QcmVmaXhOb3QpIHsgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5leHByZXNzaW9uKTsgfSxcbiAgICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0LlByZWZpeE5vdCkgeyByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHJlc3Npb24pOyB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQpIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogY2RBc3QuUHJvcGVydHlXcml0ZSkgeyByZXR1cm4gZmFsc2U7IH0sXG4gICAgICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUpIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IGNkQXN0LlNhZmVNZXRob2RDYWxsKSB7IHJldHVybiB0cnVlOyB9LFxuICAgICAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogY2RBc3QuU2FmZVByb3BlcnR5UmVhZCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVUZW1wb3JhcnkoKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgdGVtcE51bWJlciA9IHRoaXMuX2N1cnJlbnRUZW1wb3JhcnkrKztcbiAgICB0aGlzLnRlbXBvcmFyeUNvdW50ID0gTWF0aC5tYXgodGhpcy5fY3VycmVudFRlbXBvcmFyeSwgdGhpcy50ZW1wb3JhcnlDb3VudCk7XG4gICAgcmV0dXJuIG5ldyBvLlJlYWRWYXJFeHByKHRlbXBvcmFyeU5hbWUodGhpcy5iaW5kaW5nSWQsIHRlbXBOdW1iZXIpKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3Jhcnk6IG8uUmVhZFZhckV4cHIpIHtcbiAgICB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5LS07XG4gICAgaWYgKHRlbXBvcmFyeS5uYW1lICE9IHRlbXBvcmFyeU5hbWUodGhpcy5iaW5kaW5nSWQsIHRoaXMuX2N1cnJlbnRUZW1wb3JhcnkpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRlbXBvcmFyeSAke3RlbXBvcmFyeS5uYW1lfSByZWxlYXNlZCBvdXQgb2Ygb3JkZXJgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhYnNvbHV0ZSBgUGFyc2VTb3VyY2VTcGFuYCBmcm9tIHRoZSByZWxhdGl2ZSBgUGFyc2VTcGFuYC5cbiAgICpcbiAgICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICAgKiBUaGlzIG1ldGhvZCBjb252ZXJ0cyB0aGVzZSB0byBmdWxsIGBQYXJzZVNvdXJjZVNwYW5gIG9iamVjdHMgdGhhdFxuICAgKiBzaG93IHdoZXJlIHRoZSBzcGFuIGlzIHdpdGhpbiB0aGUgb3ZlcmFsbCBzb3VyY2UgZmlsZS5cbiAgICpcbiAgICogQHBhcmFtIHNwYW4gdGhlIHJlbGF0aXZlIHNwYW4gdG8gY29udmVydC5cbiAgICogQHJldHVybnMgYSBgUGFyc2VTb3VyY2VTcGFuYCBmb3IgdGhlIHRoZSBnaXZlbiBzcGFuIG9yIG51bGwgaWYgbm9cbiAgICogYGJhc2VTb3VyY2VTcGFuYCB3YXMgcHJvdmlkZWQgdG8gdGhpcyBjbGFzcy5cbiAgICovXG4gIHByaXZhdGUgY29udmVydFNvdXJjZVNwYW4oc3BhbjogY2RBc3QuUGFyc2VTcGFuKSB7XG4gICAgaWYgKHRoaXMuYmFzZVNvdXJjZVNwYW4pIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5iYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5zdGFydCk7XG4gICAgICBjb25zdCBlbmQgPSB0aGlzLmJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLmVuZCk7XG4gICAgICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZsYXR0ZW5TdGF0ZW1lbnRzKGFyZzogYW55LCBvdXRwdXQ6IG8uU3RhdGVtZW50W10pIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICg8YW55W10+YXJnKS5mb3JFYWNoKChlbnRyeSkgPT4gZmxhdHRlblN0YXRlbWVudHMoZW50cnksIG91dHB1dCkpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dC5wdXNoKGFyZyk7XG4gIH1cbn1cblxuY2xhc3MgRGVmYXVsdExvY2FsUmVzb2x2ZXIgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChuYW1lID09PSBFdmVudEhhbmRsZXJWYXJzLmV2ZW50Lm5hbWUpIHtcbiAgICAgIHJldHVybiBFdmVudEhhbmRsZXJWYXJzLmV2ZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVDdXJyVmFsdWVFeHByKGJpbmRpbmdJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gIHJldHVybiBvLnZhcmlhYmxlKGBjdXJyVmFsXyR7YmluZGluZ0lkfWApOyAgLy8gZml4IHN5bnRheCBoaWdobGlnaHRpbmc6IGBcbn1cblxuZnVuY3Rpb24gY3JlYXRlUHJldmVudERlZmF1bHRWYXIoYmluZGluZ0lkOiBzdHJpbmcpOiBvLlJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG8udmFyaWFibGUoYHBkXyR7YmluZGluZ0lkfWApO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0U3RtdEludG9FeHByZXNzaW9uKHN0bXQ6IG8uU3RhdGVtZW50KTogby5FeHByZXNzaW9ufG51bGwge1xuICBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvblN0YXRlbWVudCkge1xuICAgIHJldHVybiBzdG10LmV4cHI7XG4gIH0gZWxzZSBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uUmV0dXJuU3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIHN0bXQudmFsdWU7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBCdWlsdGluRnVuY3Rpb25DYWxsIGV4dGVuZHMgY2RBc3QuRnVuY3Rpb25DYWxsIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogY2RBc3QuUGFyc2VTcGFuLCBwdWJsaWMgYXJnczogY2RBc3QuQVNUW10sIHB1YmxpYyBjb252ZXJ0ZXI6IEJ1aWx0aW5Db252ZXJ0ZXIpIHtcbiAgICBzdXBlcihzcGFuLCBudWxsLCBhcmdzKTtcbiAgfVxufVxuIl19