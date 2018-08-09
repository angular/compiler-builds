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
        define("@angular/compiler/src/compiler_util/expression_converter", ["require", "exports", "tslib", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var cdAst = require("@angular/compiler/src/expression_parser/ast");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var o = require("@angular/compiler/src/output/output_ast");
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
    function convertActionBinding(localResolver, implicitReceiver, action, bindingId, interpolationFunction) {
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
        var visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, interpolationFunction);
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
        function _AstToIrVisitor(_localResolver, _implicitReceiver, bindingId, interpolationFunction) {
            this._localResolver = _localResolver;
            this._implicitReceiver = _implicitReceiver;
            this.bindingId = bindingId;
            this.interpolationFunction = interpolationFunction;
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
            return convertToStatementIfNeeded(mode, new o.BinaryOperatorExpr(op, this._visit(ast.left, _Mode.Expression), this._visit(ast.right, _Mode.Expression)));
        };
        _AstToIrVisitor.prototype.visitChain = function (ast, mode) {
            ensureStatementMode(mode, ast);
            return this.visitAll(ast.expressions, mode);
        };
        _AstToIrVisitor.prototype.visitConditional = function (ast, mode) {
            var value = this._visit(ast.condition, _Mode.Expression);
            return convertToStatementIfNeeded(mode, value.conditional(this._visit(ast.trueExp, _Mode.Expression), this._visit(ast.falseExp, _Mode.Expression)));
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
                fnResult = this._visit(ast.target, _Mode.Expression).callFn(convertedArgs);
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
                o.importExpr(identifiers_1.Identifiers.interpolate).callFn([args[0], o.literalArr(args.slice(1))]);
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
            return convertToStatementIfNeeded(mode, o.literal(ast.value, type));
        };
        _AstToIrVisitor.prototype._getLocal = function (name) { return this._localResolver.getLocal(name); };
        _AstToIrVisitor.prototype.visitMethodCall = function (ast, mode) {
            if (ast.receiver instanceof cdAst.ImplicitReceiver && ast.name == '$any') {
                var args = this.visitAll(ast.args, _Mode.Expression);
                if (args.length != 1) {
                    throw new Error("Invalid call to $any, expected 1 argument but received " + (args.length || 'none'));
                }
                return args[0].cast(o.DYNAMIC_TYPE);
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
                    result = receiver.callMethod(ast.name, args);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbl9jb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCxtRUFBa0Q7SUFDbEQsaUVBQTJDO0lBQzNDLDJEQUEwQztJQUUxQztRQUFBO1FBQXFFLENBQUM7UUFBL0Isc0JBQUssR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQUMsdUJBQUM7S0FBQSxBQUF0RSxJQUFzRTtJQUF6RCw0Q0FBZ0I7SUFJN0I7UUFLRTtRQUNJOztXQUVHO1FBQ0ksS0FBb0I7UUFDM0I7O1dBRUc7UUFDSSxZQUEyQjtZQUozQixVQUFLLEdBQUwsS0FBSyxDQUFlO1lBSXBCLGlCQUFZLEdBQVosWUFBWSxDQUFlO1lBQ3BDOzs7Ozs7Ozs7Ozs7Ozs7O2VBZ0JHO1lBQ0gsc0VBQXNFO1lBQ3RFLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFDLFNBQXNCO2dCQUNuRCxJQUFJLFNBQVMsWUFBWSxDQUFDLENBQUMsY0FBYyxJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksWUFBWSxDQUFDLElBQUk7b0JBQzVFLFNBQVMsQ0FBQyxLQUFLLFlBQVksQ0FBQyxDQUFDLGtCQUFrQixFQUFFO29CQUNuRCxJQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQWlCLENBQUM7b0JBQzlDLE9BQU8sSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDekM7Z0JBQ0QsT0FBTyxTQUFTLENBQUM7WUFDbkIsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0gsaUNBQUM7SUFBRCxDQUFDLEFBekNELElBeUNDO0lB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QU8sSUFBSSxDQUFDLElBQUksQ0FBQztTQUNsQjthQUFNLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxlQUFlLEVBQUU7WUFDNUMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO1NBQ25CO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7UUFBeUMsK0NBQWtCO1FBQ3pELDZCQUFZLElBQXFCLEVBQVMsSUFBaUIsRUFBUyxTQUEyQjtZQUEvRixZQUNFLGtCQUFNLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQ3hCO1lBRnlDLFVBQUksR0FBSixJQUFJLENBQWE7WUFBUyxlQUFTLEdBQVQsU0FBUyxDQUFrQjs7UUFFL0YsQ0FBQztRQUNILDBCQUFDO0lBQUQsQ0FBQyxBQUpELENBQXlDLEtBQUssQ0FBQyxZQUFZLEdBSTFEO0lBSlksa0RBQW1CIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZEFzdCBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbmV4cG9ydCBjbGFzcyBFdmVudEhhbmRsZXJWYXJzIHsgc3RhdGljIGV2ZW50ID0gby52YXJpYWJsZSgnJGV2ZW50Jyk7IH1cblxuZXhwb3J0IGludGVyZmFjZSBMb2NhbFJlc29sdmVyIHsgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGw7IH1cblxuZXhwb3J0IGNsYXNzIENvbnZlcnRBY3Rpb25CaW5kaW5nUmVzdWx0IHtcbiAgLyoqXG4gICAqIFN0b3JlIHN0YXRlbWVudHMgd2hpY2ggYXJlIHJlbmRlcjMgY29tcGF0aWJsZS5cbiAgICovXG4gIHJlbmRlcjNTdG10czogby5TdGF0ZW1lbnRbXTtcbiAgY29uc3RydWN0b3IoXG4gICAgICAvKipcbiAgICAgICAqIFJlbmRlcjIgY29tcGF0aWJsZSBzdGF0ZW1lbnRzLFxuICAgICAgICovXG4gICAgICBwdWJsaWMgc3RtdHM6IG8uU3RhdGVtZW50W10sXG4gICAgICAvKipcbiAgICAgICAqIFZhcmlhYmxlIG5hbWUgdXNlZCB3aXRoIHJlbmRlcjIgY29tcGF0aWJsZSBzdGF0ZW1lbnRzLlxuICAgICAgICovXG4gICAgICBwdWJsaWMgYWxsb3dEZWZhdWx0OiBvLlJlYWRWYXJFeHByKSB7XG4gICAgLyoqXG4gICAgICogVGhpcyBpcyBiaXQgb2YgYSBoYWNrLiBJdCBjb252ZXJ0cyBzdGF0ZW1lbnRzIHdoaWNoIHJlbmRlcjIgZXhwZWN0cyB0byBzdGF0ZW1lbnRzIHdoaWNoIGFyZVxuICAgICAqIGV4cGVjdGVkIGJ5IHJlbmRlcjMuXG4gICAgICpcbiAgICAgKiBFeGFtcGxlOiBgPGRpdiBjbGljaz1cImRvU29tZXRoaW5nKCRldmVudClcIj5gIHdpbGwgZ2VuZXJhdGU6XG4gICAgICpcbiAgICAgKiBSZW5kZXIzOlxuICAgICAqIGBgYFxuICAgICAqIGNvbnN0IHBkX2I6YW55ID0gKCg8YW55PmN0eC5kb1NvbWV0aGluZygkZXZlbnQpKSAhPT0gZmFsc2UpO1xuICAgICAqIHJldHVybiBwZF9iO1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogYnV0IHJlbmRlcjIgZXhwZWN0czpcbiAgICAgKiBgYGBcbiAgICAgKiByZXR1cm4gY3R4LmRvU29tZXRoaW5nKCRldmVudCk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgLy8gVE9ETyhtaXNrbyk6IHJlbW92ZSB0aGlzIGhhY2sgb25jZSB3ZSBubyBsb25nZXIgc3VwcG9ydCBWaWV3RW5naW5lLlxuICAgIHRoaXMucmVuZGVyM1N0bXRzID0gc3RtdHMubWFwKChzdGF0ZW1lbnQ6IG8uU3RhdGVtZW50KSA9PiB7XG4gICAgICBpZiAoc3RhdGVtZW50IGluc3RhbmNlb2Ygby5EZWNsYXJlVmFyU3RtdCAmJiBzdGF0ZW1lbnQubmFtZSA9PSBhbGxvd0RlZmF1bHQubmFtZSAmJlxuICAgICAgICAgIHN0YXRlbWVudC52YWx1ZSBpbnN0YW5jZW9mIG8uQmluYXJ5T3BlcmF0b3JFeHByKSB7XG4gICAgICAgIGNvbnN0IGxocyA9IHN0YXRlbWVudC52YWx1ZS5saHMgYXMgby5DYXN0RXhwcjtcbiAgICAgICAgcmV0dXJuIG5ldyBvLlJldHVyblN0YXRlbWVudChsaHMudmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXRlbWVudDtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBJbnRlcnBvbGF0aW9uRnVuY3Rpb24gPSAoYXJnczogby5FeHByZXNzaW9uW10pID0+IG8uRXhwcmVzc2lvbjtcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBBU1QgaW50byBhbiBleGVjdXRhYmxlIG91dHB1dCBBU1QsIGFzc3VtaW5nIHRoZSBleHByZXNzaW9uIGlzXG4gKiB1c2VkIGluIGFuIGFjdGlvbiBiaW5kaW5nIChlLmcuIGFuIGV2ZW50IGhhbmRsZXIpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgbG9jYWxSZXNvbHZlcjogTG9jYWxSZXNvbHZlciB8IG51bGwsIGltcGxpY2l0UmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiwgYWN0aW9uOiBjZEFzdC5BU1QsXG4gICAgYmluZGluZ0lkOiBzdHJpbmcsIGludGVycG9sYXRpb25GdW5jdGlvbj86IEludGVycG9sYXRpb25GdW5jdGlvbik6IENvbnZlcnRBY3Rpb25CaW5kaW5nUmVzdWx0IHtcbiAgaWYgKCFsb2NhbFJlc29sdmVyKSB7XG4gICAgbG9jYWxSZXNvbHZlciA9IG5ldyBEZWZhdWx0TG9jYWxSZXNvbHZlcigpO1xuICB9XG4gIGNvbnN0IGFjdGlvbldpdGhvdXRCdWlsdGlucyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGlucyhcbiAgICAgIHtcbiAgICAgICAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyOiAoYXJnQ291bnQ6IG51bWJlcikgPT4ge1xuICAgICAgICAgIC8vIE5vdGU6IG5vIGNhY2hpbmcgZm9yIGxpdGVyYWwgYXJyYXlzIGluIGFjdGlvbnMuXG4gICAgICAgICAgcmV0dXJuIChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4gby5saXRlcmFsQXJyKGFyZ3MpO1xuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyOiAoa2V5czoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW59W10pID0+IHtcbiAgICAgICAgICAvLyBOb3RlOiBubyBjYWNoaW5nIGZvciBsaXRlcmFsIG1hcHMgaW4gYWN0aW9ucy5cbiAgICAgICAgICByZXR1cm4gKHZhbHVlczogby5FeHByZXNzaW9uW10pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSBrZXlzLm1hcCgoaywgaSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleTogay5rZXksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVzW2ldLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcXVvdGVkOiBrLnF1b3RlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICByZXR1cm4gby5saXRlcmFsTWFwKGVudHJpZXMpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZVBpcGVDb252ZXJ0ZXI6IChuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IEFjdGlvbnMgYXJlIG5vdCBhbGxvd2VkIHRvIGNvbnRhaW4gcGlwZXMuIFBpcGU6ICR7bmFtZX1gKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGFjdGlvbik7XG5cbiAgY29uc3QgdmlzaXRvciA9XG4gICAgICBuZXcgX0FzdFRvSXJWaXNpdG9yKGxvY2FsUmVzb2x2ZXIsIGltcGxpY2l0UmVjZWl2ZXIsIGJpbmRpbmdJZCwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgY29uc3QgYWN0aW9uU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgZmxhdHRlblN0YXRlbWVudHMoYWN0aW9uV2l0aG91dEJ1aWx0aW5zLnZpc2l0KHZpc2l0b3IsIF9Nb2RlLlN0YXRlbWVudCksIGFjdGlvblN0bXRzKTtcbiAgcHJlcGVuZFRlbXBvcmFyeURlY2xzKHZpc2l0b3IudGVtcG9yYXJ5Q291bnQsIGJpbmRpbmdJZCwgYWN0aW9uU3RtdHMpO1xuICBjb25zdCBsYXN0SW5kZXggPSBhY3Rpb25TdG10cy5sZW5ndGggLSAxO1xuICBsZXQgcHJldmVudERlZmF1bHRWYXI6IG8uUmVhZFZhckV4cHIgPSBudWxsICE7XG4gIGlmIChsYXN0SW5kZXggPj0gMCkge1xuICAgIGNvbnN0IGxhc3RTdGF0ZW1lbnQgPSBhY3Rpb25TdG10c1tsYXN0SW5kZXhdO1xuICAgIGNvbnN0IHJldHVybkV4cHIgPSBjb252ZXJ0U3RtdEludG9FeHByZXNzaW9uKGxhc3RTdGF0ZW1lbnQpO1xuICAgIGlmIChyZXR1cm5FeHByKSB7XG4gICAgICAvLyBOb3RlOiBXZSBuZWVkIHRvIGNhc3QgdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIGNhbGwgdG8gZHluYW1pYyxcbiAgICAgIC8vIGFzIGl0IG1pZ2h0IGJlIGEgdm9pZCBtZXRob2QhXG4gICAgICBwcmV2ZW50RGVmYXVsdFZhciA9IGNyZWF0ZVByZXZlbnREZWZhdWx0VmFyKGJpbmRpbmdJZCk7XG4gICAgICBhY3Rpb25TdG10c1tsYXN0SW5kZXhdID1cbiAgICAgICAgICBwcmV2ZW50RGVmYXVsdFZhci5zZXQocmV0dXJuRXhwci5jYXN0KG8uRFlOQU1JQ19UWVBFKS5ub3RJZGVudGljYWwoby5saXRlcmFsKGZhbHNlKSkpXG4gICAgICAgICAgICAgIC50b0RlY2xTdG10KG51bGwsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmV3IENvbnZlcnRBY3Rpb25CaW5kaW5nUmVzdWx0KGFjdGlvblN0bXRzLCBwcmV2ZW50RGVmYXVsdFZhcik7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbHRpbkNvbnZlcnRlciB7IChhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbjsgfVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5IHtcbiAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyKGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xuICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKTogQnVpbHRpbkNvbnZlcnRlcjtcbiAgY3JlYXRlUGlwZUNvbnZlcnRlcihuYW1lOiBzdHJpbmcsIGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgIGNvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5LCBhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LkFTVCB7XG4gIHJldHVybiBjb252ZXJ0QnVpbHRpbnMoY29udmVydGVyRmFjdG9yeSwgYXN0KTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RtdHM6IG8uU3RhdGVtZW50W10sIHB1YmxpYyBjdXJyVmFsRXhwcjogby5FeHByZXNzaW9uKSB7fVxufVxuXG5leHBvcnQgZW51bSBCaW5kaW5nRm9ybSB7XG4gIC8vIFRoZSBnZW5lcmFsIGZvcm0gb2YgYmluZGluZyBleHByZXNzaW9uLCBzdXBwb3J0cyBhbGwgZXhwcmVzc2lvbnMuXG4gIEdlbmVyYWwsXG5cbiAgLy8gVHJ5IHRvIGdlbmVyYXRlIGEgc2ltcGxlIGJpbmRpbmcgKG5vIHRlbXBvcmFyaWVzIG9yIHN0YXRlbWVudHMpXG4gIC8vIG90aGVyd2lzZSBnZW5lcmF0ZSBhIGdlbmVyYWwgYmluZGluZ1xuICBUcnlTaW1wbGUsXG59XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIGV4cHJlc3Npb24gQVNUIGludG8gYW4gZXhlY3V0YWJsZSBvdXRwdXQgQVNULCBhc3N1bWluZyB0aGUgZXhwcmVzc2lvblxuICogaXMgdXNlZCBpbiBwcm9wZXJ0eSBiaW5kaW5nLiBUaGUgZXhwcmVzc2lvbiBoYXMgdG8gYmUgcHJlcHJvY2Vzc2VkIHZpYVxuICogYGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGluc2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXIgfCBudWxsLCBpbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sXG4gICAgZXhwcmVzc2lvbldpdGhvdXRCdWlsdGluczogY2RBc3QuQVNULCBiaW5kaW5nSWQ6IHN0cmluZywgZm9ybTogQmluZGluZ0Zvcm0sXG4gICAgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uPzogSW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTogQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdCB7XG4gIGlmICghbG9jYWxSZXNvbHZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIgPSBuZXcgRGVmYXVsdExvY2FsUmVzb2x2ZXIoKTtcbiAgfVxuICBjb25zdCBjdXJyVmFsRXhwciA9IGNyZWF0ZUN1cnJWYWx1ZUV4cHIoYmluZGluZ0lkKTtcbiAgY29uc3Qgc3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdmlzaXRvciA9XG4gICAgICBuZXcgX0FzdFRvSXJWaXNpdG9yKGxvY2FsUmVzb2x2ZXIsIGltcGxpY2l0UmVjZWl2ZXIsIGJpbmRpbmdJZCwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgY29uc3Qgb3V0cHV0RXhwcjogby5FeHByZXNzaW9uID0gZXhwcmVzc2lvbldpdGhvdXRCdWlsdGlucy52aXNpdCh2aXNpdG9yLCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICBpZiAodmlzaXRvci50ZW1wb3JhcnlDb3VudCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmlzaXRvci50ZW1wb3JhcnlDb3VudDsgaSsrKSB7XG4gICAgICBzdG10cy5wdXNoKHRlbXBvcmFyeURlY2xhcmF0aW9uKGJpbmRpbmdJZCwgaSkpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChmb3JtID09IEJpbmRpbmdGb3JtLlRyeVNpbXBsZSkge1xuICAgIHJldHVybiBuZXcgQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdChbXSwgb3V0cHV0RXhwcik7XG4gIH1cblxuICBzdG10cy5wdXNoKGN1cnJWYWxFeHByLnNldChvdXRwdXRFeHByKS50b0RlY2xTdG10KG8uRFlOQU1JQ19UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gIHJldHVybiBuZXcgQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdChzdG10cywgY3VyclZhbEV4cHIpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QnVpbHRpbnMoY29udmVydGVyRmFjdG9yeTogQnVpbHRpbkNvbnZlcnRlckZhY3RvcnksIGFzdDogY2RBc3QuQVNUKTogY2RBc3QuQVNUIHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfQnVpbHRpbkFzdENvbnZlcnRlcihjb252ZXJ0ZXJGYWN0b3J5KTtcbiAgcmV0dXJuIGFzdC52aXNpdCh2aXNpdG9yKTtcbn1cblxuZnVuY3Rpb24gdGVtcG9yYXJ5TmFtZShiaW5kaW5nSWQ6IHN0cmluZywgdGVtcG9yYXJ5TnVtYmVyOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYHRtcF8ke2JpbmRpbmdJZH1fJHt0ZW1wb3JhcnlOdW1iZXJ9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRlbXBvcmFyeURlY2xhcmF0aW9uKGJpbmRpbmdJZDogc3RyaW5nLCB0ZW1wb3JhcnlOdW1iZXI6IG51bWJlcik6IG8uU3RhdGVtZW50IHtcbiAgcmV0dXJuIG5ldyBvLkRlY2xhcmVWYXJTdG10KHRlbXBvcmFyeU5hbWUoYmluZGluZ0lkLCB0ZW1wb3JhcnlOdW1iZXIpLCBvLk5VTExfRVhQUik7XG59XG5cbmZ1bmN0aW9uIHByZXBlbmRUZW1wb3JhcnlEZWNscyhcbiAgICB0ZW1wb3JhcnlDb3VudDogbnVtYmVyLCBiaW5kaW5nSWQ6IHN0cmluZywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSkge1xuICBmb3IgKGxldCBpID0gdGVtcG9yYXJ5Q291bnQgLSAxOyBpID49IDA7IGktLSkge1xuICAgIHN0YXRlbWVudHMudW5zaGlmdCh0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQsIGkpKTtcbiAgfVxufVxuXG5lbnVtIF9Nb2RlIHtcbiAgU3RhdGVtZW50LFxuICBFeHByZXNzaW9uXG59XG5cbmZ1bmN0aW9uIGVuc3VyZVN0YXRlbWVudE1vZGUobW9kZTogX01vZGUsIGFzdDogY2RBc3QuQVNUKSB7XG4gIGlmIChtb2RlICE9PSBfTW9kZS5TdGF0ZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGEgc3RhdGVtZW50LCBidXQgc2F3ICR7YXN0fWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGU6IF9Nb2RlLCBhc3Q6IGNkQXN0LkFTVCkge1xuICBpZiAobW9kZSAhPT0gX01vZGUuRXhwcmVzc2lvbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYW4gZXhwcmVzc2lvbiwgYnV0IHNhdyAke2FzdH1gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlOiBfTW9kZSwgZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50IHtcbiAgaWYgKG1vZGUgPT09IF9Nb2RlLlN0YXRlbWVudCkge1xuICAgIHJldHVybiBleHByLnRvU3RtdCgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbmNsYXNzIF9CdWlsdGluQXN0Q29udmVydGVyIGV4dGVuZHMgY2RBc3QuQXN0VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9jb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSkgeyBzdXBlcigpOyB9XG4gIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSBbYXN0LmV4cCwgLi4uYXN0LmFyZ3NdLm1hcChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFzdC5zcGFuLCBhcmdzLCB0aGlzLl9jb252ZXJ0ZXJGYWN0b3J5LmNyZWF0ZVBpcGVDb252ZXJ0ZXIoYXN0Lm5hbWUsIGFyZ3MubGVuZ3RoKSk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IGFzdC5leHByZXNzaW9ucy5tYXAoYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXJncywgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXIoYXN0LmV4cHJlc3Npb25zLmxlbmd0aCkpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IGFzdC52YWx1ZXMubWFwKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuXG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXJncywgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKGFzdC5rZXlzKSk7XG4gIH1cbn1cblxuY2xhc3MgX0FzdFRvSXJWaXNpdG9yIGltcGxlbWVudHMgY2RBc3QuQXN0VmlzaXRvciB7XG4gIHByaXZhdGUgX25vZGVNYXAgPSBuZXcgTWFwPGNkQXN0LkFTVCwgY2RBc3QuQVNUPigpO1xuICBwcml2YXRlIF9yZXN1bHRNYXAgPSBuZXcgTWFwPGNkQXN0LkFTVCwgby5FeHByZXNzaW9uPigpO1xuICBwcml2YXRlIF9jdXJyZW50VGVtcG9yYXJ5OiBudW1iZXIgPSAwO1xuICBwdWJsaWMgdGVtcG9yYXJ5Q291bnQ6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9sb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyLCBwcml2YXRlIF9pbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sXG4gICAgICBwcml2YXRlIGJpbmRpbmdJZDogc3RyaW5nLCBwcml2YXRlIGludGVycG9sYXRpb25GdW5jdGlvbjogSW50ZXJwb2xhdGlvbkZ1bmN0aW9ufHVuZGVmaW5lZCkge31cblxuICB2aXNpdEJpbmFyeShhc3Q6IGNkQXN0LkJpbmFyeSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGxldCBvcDogby5CaW5hcnlPcGVyYXRvcjtcbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRpb24pIHtcbiAgICAgIGNhc2UgJysnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuUGx1cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICctJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk1pbnVzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyonOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLyc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5EaXZpZGU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnJSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Nb2R1bG87XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnJiYnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQW5kO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3x8JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk9yO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICchPSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICchPT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJzwnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTG93ZXI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPic6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5CaWdnZXI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPD0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPj0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyRXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgb3BlcmF0aW9uICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIG9wLCB0aGlzLl92aXNpdChhc3QubGVmdCwgX01vZGUuRXhwcmVzc2lvbiksIHRoaXMuX3Zpc2l0KGFzdC5yaWdodCwgX01vZGUuRXhwcmVzc2lvbikpKTtcbiAgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbiwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGVuc3VyZVN0YXRlbWVudE1vZGUobW9kZSwgYXN0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMsIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgdmFsdWU6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5jb25kaXRpb24sIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgdmFsdWUuY29uZGl0aW9uYWwoXG4gICAgICAgICAgICAgICAgICB0aGlzLl92aXNpdChhc3QudHJ1ZUV4cCwgX01vZGUuRXhwcmVzc2lvbiksXG4gICAgICAgICAgICAgICAgICB0aGlzLl92aXNpdChhc3QuZmFsc2VFeHAsIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gIH1cblxuICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYElsbGVnYWwgc3RhdGU6IFBpcGVzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zLiBQaXBlOiAke2FzdC5uYW1lfWApO1xuICB9XG5cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBjZEFzdC5GdW5jdGlvbkNhbGwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgbGV0IGZuUmVzdWx0OiBvLkV4cHJlc3Npb247XG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIEJ1aWx0aW5GdW5jdGlvbkNhbGwpIHtcbiAgICAgIGZuUmVzdWx0ID0gYXN0LmNvbnZlcnRlcihjb252ZXJ0ZWRBcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm5SZXN1bHQgPSB0aGlzLl92aXNpdChhc3QudGFyZ2V0ICEsIF9Nb2RlLkV4cHJlc3Npb24pLmNhbGxGbihjb252ZXJ0ZWRBcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGZuUmVzdWx0KTtcbiAgfVxuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVFeHByZXNzaW9uTW9kZShtb2RlLCBhc3QpO1xuICAgIHJldHVybiB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyO1xuICB9XG5cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogY2RBc3QuSW50ZXJwb2xhdGlvbiwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGUsIGFzdCk7XG4gICAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoYXN0LmV4cHJlc3Npb25zLmxlbmd0aCldO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXN0LnN0cmluZ3MubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBhcmdzLnB1c2goby5saXRlcmFsKGFzdC5zdHJpbmdzW2ldKSk7XG4gICAgICBhcmdzLnB1c2godGhpcy5fdmlzaXQoYXN0LmV4cHJlc3Npb25zW2ldLCBfTW9kZS5FeHByZXNzaW9uKSk7XG4gICAgfVxuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoYXN0LnN0cmluZ3NbYXN0LnN0cmluZ3MubGVuZ3RoIC0gMV0pKTtcblxuICAgIGlmICh0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0LmV4cHJlc3Npb25zLmxlbmd0aCA8PSA5ID9cbiAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmlubGluZUludGVycG9sYXRlKS5jYWxsRm4oYXJncykgOlxuICAgICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW50ZXJwb2xhdGUpLmNhbGxGbihbYXJnc1swXSwgby5saXRlcmFsQXJyKGFyZ3Muc2xpY2UoMSkpXSk7XG4gIH1cblxuICB2aXNpdEtleWVkUmVhZChhc3Q6IGNkQXN0LktleWVkUmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IGxlZnRNb3N0U2FmZSA9IHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpO1xuICAgIGlmIChsZWZ0TW9zdFNhZmUpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgbGVmdE1vc3RTYWZlLCBtb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICAgIG1vZGUsIHRoaXMuX3Zpc2l0KGFzdC5vYmosIF9Nb2RlLkV4cHJlc3Npb24pLmtleSh0aGlzLl92aXNpdChhc3Qua2V5LCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IGNkQXN0LktleWVkV3JpdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBvYmo6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5vYmosIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGNvbnN0IGtleTogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LmtleSwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3QgdmFsdWU6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC52YWx1ZSwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG9iai5rZXkoa2V5KS5zZXQodmFsdWUpKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBsaXRlcmFsIGFycmF5cyBzaG91bGQgaGF2ZSBiZWVuIGNvbnZlcnRlZCBpbnRvIGZ1bmN0aW9uc2ApO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogY2RBc3QuTGl0ZXJhbE1hcCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBTdGF0ZTogbGl0ZXJhbCBtYXBzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zYCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBjZEFzdC5MaXRlcmFsUHJpbWl0aXZlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgLy8gRm9yIGxpdGVyYWwgdmFsdWVzIG9mIG51bGwsIHVuZGVmaW5lZCwgdHJ1ZSwgb3IgZmFsc2UgYWxsb3cgdHlwZSBpbnRlcmZlcmVuY2VcbiAgICAvLyB0byBpbmZlciB0aGUgdHlwZS5cbiAgICBjb25zdCB0eXBlID1cbiAgICAgICAgYXN0LnZhbHVlID09PSBudWxsIHx8IGFzdC52YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IGFzdC52YWx1ZSA9PT0gdHJ1ZSB8fCBhc3QudmFsdWUgPT09IHRydWUgP1xuICAgICAgICBvLklORkVSUkVEX1RZUEUgOlxuICAgICAgICB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG8ubGl0ZXJhbChhc3QudmFsdWUsIHR5cGUpKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHsgcmV0dXJuIHRoaXMuX2xvY2FsUmVzb2x2ZXIuZ2V0TG9jYWwobmFtZSk7IH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBjZEFzdC5NZXRob2RDYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIgJiYgYXN0Lm5hbWUgPT0gJyRhbnknKSB7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbikgYXMgYW55W107XG4gICAgICBpZiAoYXJncy5sZW5ndGggIT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgSW52YWxpZCBjYWxsIHRvICRhbnksIGV4cGVjdGVkIDEgYXJndW1lbnQgYnV0IHJlY2VpdmVkICR7YXJncy5sZW5ndGggfHwgJ25vbmUnfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChhcmdzWzBdIGFzIG8uRXhwcmVzc2lvbikuY2FzdChvLkRZTkFNSUNfVFlQRSk7XG4gICAgfVxuXG4gICAgY29uc3QgbGVmdE1vc3RTYWZlID0gdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCk7XG4gICAgaWYgKGxlZnRNb3N0U2FmZSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCBsZWZ0TW9zdFNhZmUsIG1vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgICBsZXQgcmVzdWx0OiBhbnkgPSBudWxsO1xuICAgICAgY29uc3QgcmVjZWl2ZXIgPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgICAgaWYgKHJlY2VpdmVyID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIGNvbnN0IHZhckV4cHIgPSB0aGlzLl9nZXRMb2NhbChhc3QubmFtZSk7XG4gICAgICAgIGlmICh2YXJFeHByKSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFyRXhwci5jYWxsRm4oYXJncyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQgPT0gbnVsbCkge1xuICAgICAgICByZXN1bHQgPSByZWNlaXZlci5jYWxsTWV0aG9kKGFzdC5uYW1lLCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCByZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG8ubm90KHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgby5hc3NlcnROb3ROdWxsKHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCByZWNlaXZlciA9IHRoaXMuX3Zpc2l0KGFzdC5yZWNlaXZlciwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgICBpZiAocmVjZWl2ZXIgPT09IHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUpO1xuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCA9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLnByb3AoYXN0Lm5hbWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIHJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogY2RBc3QuUHJvcGVydHlXcml0ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IHJlY2VpdmVyOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuXG4gICAgbGV0IHZhckV4cHI6IG8uUmVhZFByb3BFeHByfG51bGwgPSBudWxsO1xuICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgY29uc3QgbG9jYWxFeHByID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUpO1xuICAgICAgaWYgKGxvY2FsRXhwcikge1xuICAgICAgICBpZiAobG9jYWxFeHByIGluc3RhbmNlb2Ygby5SZWFkUHJvcEV4cHIpIHtcbiAgICAgICAgICAvLyBJZiB0aGUgbG9jYWwgdmFyaWFibGUgaXMgYSBwcm9wZXJ0eSByZWFkIGV4cHJlc3Npb24sIGl0J3MgYSByZWZlcmVuY2VcbiAgICAgICAgICAvLyB0byBhICdjb250ZXh0LnByb3BlcnR5JyB2YWx1ZSBhbmQgd2lsbCBiZSB1c2VkIGFzIHRoZSB0YXJnZXQgb2YgdGhlXG4gICAgICAgICAgLy8gd3JpdGUgZXhwcmVzc2lvbi5cbiAgICAgICAgICB2YXJFeHByID0gbG9jYWxFeHByO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSBpdCdzIGFuIGVycm9yLlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGFzc2lnbiB0byBhIHJlZmVyZW5jZSBvciB2YXJpYWJsZSEnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBJZiBubyBsb2NhbCBleHByZXNzaW9uIGNvdWxkIGJlIHByb2R1Y2VkLCB1c2UgdGhlIG9yaWdpbmFsIHJlY2VpdmVyJ3NcbiAgICAvLyBwcm9wZXJ0eSBhcyB0aGUgdGFyZ2V0LlxuICAgIGlmICh2YXJFeHByID09PSBudWxsKSB7XG4gICAgICB2YXJFeHByID0gcmVjZWl2ZXIucHJvcChhc3QubmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCB2YXJFeHByLnNldCh0aGlzLl92aXNpdChhc3QudmFsdWUsIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gIH1cblxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KSwgbW9kZSk7XG4gIH1cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogY2RBc3QuU2FmZU1ldGhvZENhbGwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpLCBtb2RlKTtcbiAgfVxuXG4gIHZpc2l0QWxsKGFzdHM6IGNkQXN0LkFTVFtdLCBtb2RlOiBfTW9kZSk6IGFueSB7IHJldHVybiBhc3RzLm1hcChhc3QgPT4gdGhpcy5fdmlzaXQoYXN0LCBtb2RlKSk7IH1cblxuICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFF1b3RlcyBhcmUgbm90IHN1cHBvcnRlZCBmb3IgZXZhbHVhdGlvbiFcbiAgICAgICAgU3RhdGVtZW50OiAke2FzdC51bmludGVycHJldGVkRXhwcmVzc2lvbn0gbG9jYXRlZCBhdCAke2FzdC5sb2NhdGlvbn1gKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0KGFzdDogY2RBc3QuQVNULCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fcmVzdWx0TWFwLmdldChhc3QpO1xuICAgIGlmIChyZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgcmV0dXJuICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodGhpcywgbW9kZSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRTYWZlQWNjZXNzKFxuICAgICAgYXN0OiBjZEFzdC5BU1QsIGxlZnRNb3N0U2FmZTogY2RBc3QuU2FmZU1ldGhvZENhbGx8Y2RBc3QuU2FmZVByb3BlcnR5UmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGNvbnRhaW5zIGEgc2FmZSBhY2Nlc3Mgbm9kZSBvbiB0aGUgbGVmdCBpdCBuZWVkcyB0byBiZSBjb252ZXJ0ZWQgdG9cbiAgICAvLyBhbiBleHByZXNzaW9uIHRoYXQgZ3VhcmRzIHRoZSBhY2Nlc3MgdG8gdGhlIG1lbWJlciBieSBjaGVja2luZyB0aGUgcmVjZWl2ZXIgZm9yIGJsYW5rLiBBc1xuICAgIC8vIGV4ZWN1dGlvbiBwcm9jZWVkcyBmcm9tIGxlZnQgdG8gcmlnaHQsIHRoZSBsZWZ0IG1vc3QgcGFydCBvZiB0aGUgZXhwcmVzc2lvbiBtdXN0IGJlIGd1YXJkZWRcbiAgICAvLyBmaXJzdCBidXQsIGJlY2F1c2UgbWVtYmVyIGFjY2VzcyBpcyBsZWZ0IGFzc29jaWF0aXZlLCB0aGUgcmlnaHQgc2lkZSBvZiB0aGUgZXhwcmVzc2lvbiBpcyBhdFxuICAgIC8vIHRoZSB0b3Agb2YgdGhlIEFTVC4gVGhlIGRlc2lyZWQgcmVzdWx0IHJlcXVpcmVzIGxpZnRpbmcgYSBjb3B5IG9mIHRoZSB0aGUgbGVmdCBwYXJ0IG9mIHRoZVxuICAgIC8vIGV4cHJlc3Npb24gdXAgdG8gdGVzdCBpdCBmb3IgYmxhbmsgYmVmb3JlIGdlbmVyYXRpbmcgdGhlIHVuZ3VhcmRlZCB2ZXJzaW9uLlxuXG4gICAgLy8gQ29uc2lkZXIsIGZvciBleGFtcGxlIHRoZSBmb2xsb3dpbmcgZXhwcmVzc2lvbjogYT8uYi5jPy5kLmVcblxuICAgIC8vIFRoaXMgcmVzdWx0cyBpbiB0aGUgYXN0OlxuICAgIC8vICAgICAgICAgLlxuICAgIC8vICAgICAgICAvIFxcXG4gICAgLy8gICAgICAgPy4gICBlXG4gICAgLy8gICAgICAvICBcXFxuICAgIC8vICAgICAuICAgIGRcbiAgICAvLyAgICAvIFxcXG4gICAgLy8gICA/LiAgY1xuICAgIC8vICAvICBcXFxuICAgIC8vIGEgICAgYlxuXG4gICAgLy8gVGhlIGZvbGxvd2luZyB0cmVlIHNob3VsZCBiZSBnZW5lcmF0ZWQ6XG4gICAgLy9cbiAgICAvLyAgICAgICAgLy0tLS0gPyAtLS0tXFxcbiAgICAvLyAgICAgICAvICAgICAgfCAgICAgIFxcXG4gICAgLy8gICAgIGEgICAvLS0tID8gLS0tXFwgIG51bGxcbiAgICAvLyAgICAgICAgLyAgICAgfCAgICAgXFxcbiAgICAvLyAgICAgICAuICAgICAgLiAgICAgbnVsbFxuICAgIC8vICAgICAgLyBcXCAgICAvIFxcXG4gICAgLy8gICAgIC4gIGMgICAuICAgZVxuICAgIC8vICAgIC8gXFwgICAgLyBcXFxuICAgIC8vICAgYSAgIGIgICwgICBkXG4gICAgLy8gICAgICAgICAvIFxcXG4gICAgLy8gICAgICAgIC4gICBjXG4gICAgLy8gICAgICAgLyBcXFxuICAgIC8vICAgICAgYSAgIGJcbiAgICAvL1xuICAgIC8vIE5vdGljZSB0aGF0IHRoZSBmaXJzdCBndWFyZCBjb25kaXRpb24gaXMgdGhlIGxlZnQgaGFuZCBvZiB0aGUgbGVmdCBtb3N0IHNhZmUgYWNjZXNzIG5vZGVcbiAgICAvLyB3aGljaCBjb21lcyBpbiBhcyBsZWZ0TW9zdFNhZmUgdG8gdGhpcyByb3V0aW5lLlxuXG4gICAgbGV0IGd1YXJkZWRFeHByZXNzaW9uID0gdGhpcy5fdmlzaXQobGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBsZXQgdGVtcG9yYXJ5OiBvLlJlYWRWYXJFeHByID0gdW5kZWZpbmVkICE7XG4gICAgaWYgKHRoaXMubmVlZHNUZW1wb3JhcnkobGVmdE1vc3RTYWZlLnJlY2VpdmVyKSkge1xuICAgICAgLy8gSWYgdGhlIGV4cHJlc3Npb24gaGFzIG1ldGhvZCBjYWxscyBvciBwaXBlcyB0aGVuIHdlIG5lZWQgdG8gc2F2ZSB0aGUgcmVzdWx0IGludG8gYVxuICAgICAgLy8gdGVtcG9yYXJ5IHZhcmlhYmxlIHRvIGF2b2lkIGNhbGxpbmcgc3RhdGVmdWwgb3IgaW1wdXJlIGNvZGUgbW9yZSB0aGFuIG9uY2UuXG4gICAgICB0ZW1wb3JhcnkgPSB0aGlzLmFsbG9jYXRlVGVtcG9yYXJ5KCk7XG5cbiAgICAgIC8vIFByZXNlcnZlIHRoZSByZXN1bHQgaW4gdGhlIHRlbXBvcmFyeSB2YXJpYWJsZVxuICAgICAgZ3VhcmRlZEV4cHJlc3Npb24gPSB0ZW1wb3Jhcnkuc2V0KGd1YXJkZWRFeHByZXNzaW9uKTtcblxuICAgICAgLy8gRW5zdXJlIGFsbCBmdXJ0aGVyIHJlZmVyZW5jZXMgdG8gdGhlIGd1YXJkZWQgZXhwcmVzc2lvbiByZWZlciB0byB0aGUgdGVtcG9yYXJ5IGluc3RlYWQuXG4gICAgICB0aGlzLl9yZXN1bHRNYXAuc2V0KGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgdGVtcG9yYXJ5KTtcbiAgICB9XG4gICAgY29uc3QgY29uZGl0aW9uID0gZ3VhcmRlZEV4cHJlc3Npb24uaXNCbGFuaygpO1xuXG4gICAgLy8gQ29udmVydCB0aGUgYXN0IHRvIGFuIHVuZ3VhcmRlZCBhY2Nlc3MgdG8gdGhlIHJlY2VpdmVyJ3MgbWVtYmVyLiBUaGUgbWFwIHdpbGwgc3Vic3RpdHV0ZVxuICAgIC8vIGxlZnRNb3N0Tm9kZSB3aXRoIGl0cyB1bmd1YXJkZWQgdmVyc2lvbiBpbiB0aGUgY2FsbCB0byBgdGhpcy52aXNpdCgpYC5cbiAgICBpZiAobGVmdE1vc3RTYWZlIGluc3RhbmNlb2YgY2RBc3QuU2FmZU1ldGhvZENhbGwpIHtcbiAgICAgIHRoaXMuX25vZGVNYXAuc2V0KFxuICAgICAgICAgIGxlZnRNb3N0U2FmZSxcbiAgICAgICAgICBuZXcgY2RBc3QuTWV0aG9kQ2FsbChcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLnNwYW4sIGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgbGVmdE1vc3RTYWZlLm5hbWUsIGxlZnRNb3N0U2FmZS5hcmdzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX25vZGVNYXAuc2V0KFxuICAgICAgICAgIGxlZnRNb3N0U2FmZSxcbiAgICAgICAgICBuZXcgY2RBc3QuUHJvcGVydHlSZWFkKGxlZnRNb3N0U2FmZS5zcGFuLCBsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIGxlZnRNb3N0U2FmZS5uYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gUmVjdXJzaXZlbHkgY29udmVydCB0aGUgbm9kZSBub3cgd2l0aG91dCB0aGUgZ3VhcmRlZCBtZW1iZXIgYWNjZXNzLlxuICAgIGNvbnN0IGFjY2VzcyA9IHRoaXMuX3Zpc2l0KGFzdCwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgICAvLyBSZW1vdmUgdGhlIG1hcHBpbmcuIFRoaXMgaXMgbm90IHN0cmljdGx5IHJlcXVpcmVkIGFzIHRoZSBjb252ZXJ0ZXIgb25seSB0cmF2ZXJzZXMgZWFjaCBub2RlXG4gICAgLy8gb25jZSBidXQgaXMgc2FmZXIgaWYgdGhlIGNvbnZlcnNpb24gaXMgY2hhbmdlZCB0byB0cmF2ZXJzZSB0aGUgbm9kZXMgbW9yZSB0aGFuIG9uY2UuXG4gICAgdGhpcy5fbm9kZU1hcC5kZWxldGUobGVmdE1vc3RTYWZlKTtcblxuICAgIC8vIElmIHdlIGFsbG9jYXRlZCBhIHRlbXBvcmFyeSwgcmVsZWFzZSBpdC5cbiAgICBpZiAodGVtcG9yYXJ5KSB7XG4gICAgICB0aGlzLnJlbGVhc2VUZW1wb3JhcnkodGVtcG9yYXJ5KTtcbiAgICB9XG5cbiAgICAvLyBQcm9kdWNlIHRoZSBjb25kaXRpb25hbFxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCBjb25kaXRpb24uY29uZGl0aW9uYWwoby5saXRlcmFsKG51bGwpLCBhY2Nlc3MpKTtcbiAgfVxuXG4gIC8vIEdpdmVuIGEgZXhwcmVzc2lvbiBvZiB0aGUgZm9ybSBhPy5iLmM/LmQuZSB0aGUgdGhlIGxlZnQgbW9zdCBzYWZlIG5vZGUgaXNcbiAgLy8gdGhlIChhPy5iKS4gVGhlIC4gYW5kID8uIGFyZSBsZWZ0IGFzc29jaWF0aXZlIHRodXMgY2FuIGJlIHJld3JpdHRlbiBhczpcbiAgLy8gKCgoKGE/LmMpLmIpLmMpPy5kKS5lLiBUaGlzIHJldHVybnMgdGhlIG1vc3QgZGVlcGx5IG5lc3RlZCBzYWZlIHJlYWQgb3JcbiAgLy8gc2FmZSBtZXRob2QgY2FsbCBhcyB0aGlzIG5lZWRzIGJlIHRyYW5zZm9ybSBpbml0aWFsbHkgdG86XG4gIC8vICAgYSA9PSBudWxsID8gbnVsbCA6IGEuYy5iLmM/LmQuZVxuICAvLyB0aGVuIHRvOlxuICAvLyAgIGEgPT0gbnVsbCA/IG51bGwgOiBhLmIuYyA9PSBudWxsID8gbnVsbCA6IGEuYi5jLmQuZVxuICBwcml2YXRlIGxlZnRNb3N0U2FmZU5vZGUoYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkfGNkQXN0LlNhZmVNZXRob2RDYWxsIHtcbiAgICBjb25zdCB2aXNpdCA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVCk6IGFueSA9PiB7XG4gICAgICByZXR1cm4gKHRoaXMuX25vZGVNYXAuZ2V0KGFzdCkgfHwgYXN0KS52aXNpdCh2aXNpdG9yKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnkpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4pIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdENvbmRpdGlvbmFsKGFzdDogY2RBc3QuQ29uZGl0aW9uYWwpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IGNkQXN0LkZ1bmN0aW9uQ2FsbCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBjZEFzdC5JbnRlcnBvbGF0aW9uKSB7IHJldHVybiBudWxsOyB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHsgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5vYmopOyB9LFxuICAgICAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5KSB7IHJldHVybiBudWxsOyB9LFxuICAgICAgdmlzaXRMaXRlcmFsTWFwKGFzdDogY2RBc3QuTGl0ZXJhbE1hcCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdE1ldGhvZENhbGwoYXN0OiBjZEFzdC5NZXRob2RDYWxsKSB7IHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpOyB9LFxuICAgICAgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdFByZWZpeE5vdChhc3Q6IGNkQXN0LlByZWZpeE5vdCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0Lk5vbk51bGxBc3NlcnQpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlByb3BlcnR5UmVhZCkgeyByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKTsgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogY2RBc3QuU2FmZU1ldGhvZENhbGwpIHsgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcikgfHwgYXN0OyB9LFxuICAgICAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogY2RBc3QuU2FmZVByb3BlcnR5UmVhZCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKSB8fCBhc3Q7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRydWUgb2YgdGhlIEFTVCBpbmNsdWRlcyBhIG1ldGhvZCBvciBhIHBpcGUgaW5kaWNhdGluZyB0aGF0LCBpZiB0aGVcbiAgLy8gZXhwcmVzc2lvbiBpcyB1c2VkIGFzIHRoZSB0YXJnZXQgb2YgYSBzYWZlIHByb3BlcnR5IG9yIG1ldGhvZCBhY2Nlc3MgdGhlblxuICAvLyB0aGUgZXhwcmVzc2lvbiBzaG91bGQgYmUgc3RvcmVkIGludG8gYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gIHByaXZhdGUgbmVlZHNUZW1wb3JhcnkoYXN0OiBjZEFzdC5BU1QpOiBib29sZWFuIHtcbiAgICBjb25zdCB2aXNpdCA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVCk6IGJvb2xlYW4gPT4ge1xuICAgICAgcmV0dXJuIGFzdCAmJiAodGhpcy5fbm9kZU1hcC5nZXQoYXN0KSB8fCBhc3QpLnZpc2l0KHZpc2l0b3IpO1xuICAgIH07XG4gICAgY29uc3QgdmlzaXRTb21lID0gKHZpc2l0b3I6IGNkQXN0LkFzdFZpc2l0b3IsIGFzdDogY2RBc3QuQVNUW10pOiBib29sZWFuID0+IHtcbiAgICAgIHJldHVybiBhc3Quc29tZShhc3QgPT4gdmlzaXQodmlzaXRvciwgYXN0KSk7XG4gICAgfTtcbiAgICByZXR1cm4gYXN0LnZpc2l0KHtcbiAgICAgIHZpc2l0QmluYXJ5KGFzdDogY2RBc3QuQmluYXJ5KTpcbiAgICAgICAgICBib29sZWFue3JldHVybiB2aXNpdCh0aGlzLCBhc3QubGVmdCkgfHwgdmlzaXQodGhpcywgYXN0LnJpZ2h0KTt9LFxuICAgICAgdmlzaXRDaGFpbihhc3Q6IGNkQXN0LkNoYWluKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBjZEFzdC5Db25kaXRpb25hbCk6XG4gICAgICAgICAgYm9vbGVhbntyZXR1cm4gdmlzaXQodGhpcywgYXN0LmNvbmRpdGlvbikgfHwgdmlzaXQodGhpcywgYXN0LnRydWVFeHApIHx8XG4gICAgICAgICAgICAgICAgICAgICAgdmlzaXQodGhpcywgYXN0LmZhbHNlRXhwKTt9LFxuICAgICAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBjZEFzdC5GdW5jdGlvbkNhbGwpIHsgcmV0dXJuIHRydWU7IH0sXG4gICAgICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24pIHsgcmV0dXJuIHZpc2l0U29tZSh0aGlzLCBhc3QuZXhwcmVzc2lvbnMpOyB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSkgeyByZXR1cm4gZmFsc2U7IH0sXG4gICAgICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXApIHsgcmV0dXJuIHRydWU7IH0sXG4gICAgICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBjZEFzdC5MaXRlcmFsUHJpbWl0aXZlKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IGNkQXN0Lk1ldGhvZENhbGwpIHsgcmV0dXJuIHRydWU7IH0sXG4gICAgICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90KSB7IHJldHVybiB2aXNpdCh0aGlzLCBhc3QuZXhwcmVzc2lvbik7IH0sXG4gICAgICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBjZEFzdC5QcmVmaXhOb3QpIHsgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5leHByZXNzaW9uKTsgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogY2RBc3QuUHJvcGVydHlSZWFkKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUpIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRRdW90ZShhc3Q6IGNkQXN0LlF1b3RlKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWQpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlVGVtcG9yYXJ5KCk6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IHRlbXBOdW1iZXIgPSB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5Kys7XG4gICAgdGhpcy50ZW1wb3JhcnlDb3VudCA9IE1hdGgubWF4KHRoaXMuX2N1cnJlbnRUZW1wb3JhcnksIHRoaXMudGVtcG9yYXJ5Q291bnQpO1xuICAgIHJldHVybiBuZXcgby5SZWFkVmFyRXhwcih0ZW1wb3JhcnlOYW1lKHRoaXMuYmluZGluZ0lkLCB0ZW1wTnVtYmVyKSk7XG4gIH1cblxuICBwcml2YXRlIHJlbGVhc2VUZW1wb3JhcnkodGVtcG9yYXJ5OiBvLlJlYWRWYXJFeHByKSB7XG4gICAgdGhpcy5fY3VycmVudFRlbXBvcmFyeS0tO1xuICAgIGlmICh0ZW1wb3JhcnkubmFtZSAhPSB0ZW1wb3JhcnlOYW1lKHRoaXMuYmluZGluZ0lkLCB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUZW1wb3JhcnkgJHt0ZW1wb3JhcnkubmFtZX0gcmVsZWFzZWQgb3V0IG9mIG9yZGVyYCk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZsYXR0ZW5TdGF0ZW1lbnRzKGFyZzogYW55LCBvdXRwdXQ6IG8uU3RhdGVtZW50W10pIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICg8YW55W10+YXJnKS5mb3JFYWNoKChlbnRyeSkgPT4gZmxhdHRlblN0YXRlbWVudHMoZW50cnksIG91dHB1dCkpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dC5wdXNoKGFyZyk7XG4gIH1cbn1cblxuY2xhc3MgRGVmYXVsdExvY2FsUmVzb2x2ZXIgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChuYW1lID09PSBFdmVudEhhbmRsZXJWYXJzLmV2ZW50Lm5hbWUpIHtcbiAgICAgIHJldHVybiBFdmVudEhhbmRsZXJWYXJzLmV2ZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVDdXJyVmFsdWVFeHByKGJpbmRpbmdJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gIHJldHVybiBvLnZhcmlhYmxlKGBjdXJyVmFsXyR7YmluZGluZ0lkfWApOyAgLy8gZml4IHN5bnRheCBoaWdobGlnaHRpbmc6IGBcbn1cblxuZnVuY3Rpb24gY3JlYXRlUHJldmVudERlZmF1bHRWYXIoYmluZGluZ0lkOiBzdHJpbmcpOiBvLlJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG8udmFyaWFibGUoYHBkXyR7YmluZGluZ0lkfWApO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0U3RtdEludG9FeHByZXNzaW9uKHN0bXQ6IG8uU3RhdGVtZW50KTogby5FeHByZXNzaW9ufG51bGwge1xuICBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvblN0YXRlbWVudCkge1xuICAgIHJldHVybiBzdG10LmV4cHI7XG4gIH0gZWxzZSBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uUmV0dXJuU3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIHN0bXQudmFsdWU7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBCdWlsdGluRnVuY3Rpb25DYWxsIGV4dGVuZHMgY2RBc3QuRnVuY3Rpb25DYWxsIHtcbiAgY29uc3RydWN0b3Ioc3BhbjogY2RBc3QuUGFyc2VTcGFuLCBwdWJsaWMgYXJnczogY2RBc3QuQVNUW10sIHB1YmxpYyBjb252ZXJ0ZXI6IEJ1aWx0aW5Db252ZXJ0ZXIpIHtcbiAgICBzdXBlcihzcGFuLCBudWxsLCBhcmdzKTtcbiAgfVxufVxuIl19