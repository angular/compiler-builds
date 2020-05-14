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
    exports.BuiltinFunctionCall = exports.temporaryDeclaration = exports.convertUpdateArguments = exports.convertPropertyBinding = exports.BindingForm = exports.ConvertPropertyBindingResult = exports.convertPropertyBindingBuiltins = exports.convertActionBinding = exports.ConvertActionBindingResult = exports.EventHandlerVars = void 0;
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
    function convertActionBinding(localResolver, implicitReceiver, action, bindingId, interpolationFunction, baseSourceSpan, implicitReceiverAccesses) {
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
        var visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, interpolationFunction, baseSourceSpan, implicitReceiverAccesses);
        var actionStmts = [];
        flattenStatements(actionWithoutBuiltins.visit(visitor, _Mode.Statement), actionStmts);
        prependTemporaryDecls(visitor.temporaryCount, bindingId, actionStmts);
        if (visitor.usesImplicitReceiver) {
            localResolver.notifyImplicitReceiverUse();
        }
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
        var visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, interpolationFunction);
        var outputExpr = expressionWithoutBuiltins.visit(visitor, _Mode.Expression);
        var stmts = getStatementsFromVisitor(visitor, bindingId);
        if (visitor.usesImplicitReceiver) {
            localResolver.notifyImplicitReceiverUse();
        }
        if (visitor.temporaryCount === 0 && form == BindingForm.TrySimple) {
            return new ConvertPropertyBindingResult([], outputExpr);
        }
        stmts.push(currValExpr.set(outputExpr).toDeclStmt(o.DYNAMIC_TYPE, [o.StmtModifier.Final]));
        return new ConvertPropertyBindingResult(stmts, currValExpr);
    }
    exports.convertPropertyBinding = convertPropertyBinding;
    /**
     * Given some expression, such as a binding or interpolation expression, and a context expression to
     * look values up on, visit each facet of the given expression resolving values from the context
     * expression such that a list of arguments can be derived from the found values that can be used as
     * arguments to an external update instruction.
     *
     * @param localResolver The resolver to use to look up expressions by name appropriately
     * @param contextVariableExpression The expression representing the context variable used to create
     * the final argument expressions
     * @param expressionWithArgumentsToExtract The expression to visit to figure out what values need to
     * be resolved and what arguments list to build.
     * @param bindingId A name prefix used to create temporary variable names if they're needed for the
     * arguments generated
     * @returns An array of expressions that can be passed as arguments to instruction expressions like
     * `o.importExpr(R3.propertyInterpolate).callFn(result)`
     */
    function convertUpdateArguments(localResolver, contextVariableExpression, expressionWithArgumentsToExtract, bindingId) {
        var visitor = new _AstToIrVisitor(localResolver, contextVariableExpression, bindingId, undefined);
        var outputExpr = expressionWithArgumentsToExtract.visit(visitor, _Mode.Expression);
        if (visitor.usesImplicitReceiver) {
            localResolver.notifyImplicitReceiverUse();
        }
        var stmts = getStatementsFromVisitor(visitor, bindingId);
        // Removing the first argument, because it was a length for ViewEngine, not Ivy.
        var args = outputExpr.args.slice(1);
        if (expressionWithArgumentsToExtract instanceof cdAst.Interpolation) {
            // If we're dealing with an interpolation of 1 value with an empty prefix and suffix, reduce the
            // args returned to just the value, because we're going to pass it to a special instruction.
            var strings = expressionWithArgumentsToExtract.strings;
            if (args.length === 3 && strings[0] === '' && strings[1] === '') {
                // Single argument interpolate instructions.
                args = [args[1]];
            }
            else if (args.length >= 19) {
                // 19 or more arguments must be passed to the `interpolateV`-style instructions, which accept
                // an array of arguments
                args = [o.literalArr(args)];
            }
        }
        return { stmts: stmts, args: args };
    }
    exports.convertUpdateArguments = convertUpdateArguments;
    function getStatementsFromVisitor(visitor, bindingId) {
        var stmts = [];
        for (var i = 0; i < visitor.temporaryCount; i++) {
            stmts.push(temporaryDeclaration(bindingId, i));
        }
        return stmts;
    }
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
            return new BuiltinFunctionCall(ast.span, ast.sourceSpan, args, this._converterFactory.createPipeConverter(ast.name, args.length));
        };
        _BuiltinAstConverter.prototype.visitLiteralArray = function (ast, context) {
            var _this = this;
            var args = ast.expressions.map(function (ast) { return ast.visit(_this, context); });
            return new BuiltinFunctionCall(ast.span, ast.sourceSpan, args, this._converterFactory.createLiteralArrayConverter(ast.expressions.length));
        };
        _BuiltinAstConverter.prototype.visitLiteralMap = function (ast, context) {
            var _this = this;
            var args = ast.values.map(function (ast) { return ast.visit(_this, context); });
            return new BuiltinFunctionCall(ast.span, ast.sourceSpan, args, this._converterFactory.createLiteralMapConverter(ast.keys));
        };
        return _BuiltinAstConverter;
    }(cdAst.AstTransformer));
    var _AstToIrVisitor = /** @class */ (function () {
        function _AstToIrVisitor(_localResolver, _implicitReceiver, bindingId, interpolationFunction, baseSourceSpan, implicitReceiverAccesses) {
            this._localResolver = _localResolver;
            this._implicitReceiver = _implicitReceiver;
            this.bindingId = bindingId;
            this.interpolationFunction = interpolationFunction;
            this.baseSourceSpan = baseSourceSpan;
            this.implicitReceiverAccesses = implicitReceiverAccesses;
            this._nodeMap = new Map();
            this._resultMap = new Map();
            this._currentTemporary = 0;
            this.temporaryCount = 0;
            this.usesImplicitReceiver = false;
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
            this.usesImplicitReceiver = true;
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
        _AstToIrVisitor.prototype._getLocal = function (name) {
            return this._localResolver.getLocal(name);
        };
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
                var prevUsesImplicitReceiver = this.usesImplicitReceiver;
                var result = null;
                var receiver = this._visit(ast.receiver, _Mode.Expression);
                if (receiver === this._implicitReceiver) {
                    var varExpr = this._getLocal(ast.name);
                    if (varExpr) {
                        // Restore the previous "usesImplicitReceiver" state since the implicit
                        // receiver has been replaced with a resolved local expression.
                        this.usesImplicitReceiver = prevUsesImplicitReceiver;
                        result = varExpr.callFn(args);
                    }
                    this.addImplicitReceiverAccess(ast.name);
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
                var prevUsesImplicitReceiver = this.usesImplicitReceiver;
                var receiver = this._visit(ast.receiver, _Mode.Expression);
                if (receiver === this._implicitReceiver) {
                    result = this._getLocal(ast.name);
                    if (result) {
                        // Restore the previous "usesImplicitReceiver" state since the implicit
                        // receiver has been replaced with a resolved local expression.
                        this.usesImplicitReceiver = prevUsesImplicitReceiver;
                    }
                    this.addImplicitReceiverAccess(ast.name);
                }
                if (result == null) {
                    result = receiver.prop(ast.name);
                }
                return convertToStatementIfNeeded(mode, result);
            }
        };
        _AstToIrVisitor.prototype.visitPropertyWrite = function (ast, mode) {
            var receiver = this._visit(ast.receiver, _Mode.Expression);
            var prevUsesImplicitReceiver = this.usesImplicitReceiver;
            var varExpr = null;
            if (receiver === this._implicitReceiver) {
                var localExpr = this._getLocal(ast.name);
                if (localExpr) {
                    if (localExpr instanceof o.ReadPropExpr) {
                        // If the local variable is a property read expression, it's a reference
                        // to a 'context.property' value and will be used as the target of the
                        // write expression.
                        varExpr = localExpr;
                        // Restore the previous "usesImplicitReceiver" state since the implicit
                        // receiver has been replaced with a resolved local expression.
                        this.usesImplicitReceiver = prevUsesImplicitReceiver;
                        this.addImplicitReceiverAccess(ast.name);
                    }
                    else {
                        // Otherwise it's an error.
                        var receiver_1 = ast.name;
                        var value = (ast.value instanceof cdAst.PropertyRead) ? ast.value.name : undefined;
                        throw new Error("Cannot assign value \"" + value + "\" to template variable \"" + receiver_1 + "\". Template variables are read-only.");
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
            // the top of the AST. The desired result requires lifting a copy of the left part of the
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
            //   a   b  .   d
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
                this._nodeMap.set(leftMostSafe, new cdAst.MethodCall(leftMostSafe.span, leftMostSafe.sourceSpan, leftMostSafe.nameSpan, leftMostSafe.receiver, leftMostSafe.name, leftMostSafe.args));
            }
            else {
                this._nodeMap.set(leftMostSafe, new cdAst.PropertyRead(leftMostSafe.span, leftMostSafe.sourceSpan, leftMostSafe.nameSpan, leftMostSafe.receiver, leftMostSafe.name));
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
        // Given an expression of the form a?.b.c?.d.e then the left most safe node is
        // the (a?.b). The . and ?. are left associative thus can be rewritten as:
        // ((((a?.c).b).c)?.d).e. This returns the most deeply nested safe read or
        // safe method call as this needs to be transformed initially to:
        //   a == null ? null : a.c.b.c?.d.e
        // then to:
        //   a == null ? null : a.b.c == null ? null : a.b.c.d.e
        _AstToIrVisitor.prototype.leftMostSafeNode = function (ast) {
            var _this = this;
            var visit = function (visitor, ast) {
                return (_this._nodeMap.get(ast) || ast).visit(visitor);
            };
            return ast.visit({
                visitBinary: function (ast) {
                    return null;
                },
                visitChain: function (ast) {
                    return null;
                },
                visitConditional: function (ast) {
                    return null;
                },
                visitFunctionCall: function (ast) {
                    return null;
                },
                visitImplicitReceiver: function (ast) {
                    return null;
                },
                visitInterpolation: function (ast) {
                    return null;
                },
                visitKeyedRead: function (ast) {
                    return visit(this, ast.obj);
                },
                visitKeyedWrite: function (ast) {
                    return null;
                },
                visitLiteralArray: function (ast) {
                    return null;
                },
                visitLiteralMap: function (ast) {
                    return null;
                },
                visitLiteralPrimitive: function (ast) {
                    return null;
                },
                visitMethodCall: function (ast) {
                    return visit(this, ast.receiver);
                },
                visitPipe: function (ast) {
                    return null;
                },
                visitPrefixNot: function (ast) {
                    return null;
                },
                visitNonNullAssert: function (ast) {
                    return null;
                },
                visitPropertyRead: function (ast) {
                    return visit(this, ast.receiver);
                },
                visitPropertyWrite: function (ast) {
                    return null;
                },
                visitQuote: function (ast) {
                    return null;
                },
                visitSafeMethodCall: function (ast) {
                    return visit(this, ast.receiver) || ast;
                },
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
                visitBinary: function (ast) {
                    return visit(this, ast.left) || visit(this, ast.right);
                },
                visitChain: function (ast) {
                    return false;
                },
                visitConditional: function (ast) {
                    return visit(this, ast.condition) || visit(this, ast.trueExp) || visit(this, ast.falseExp);
                },
                visitFunctionCall: function (ast) {
                    return true;
                },
                visitImplicitReceiver: function (ast) {
                    return false;
                },
                visitInterpolation: function (ast) {
                    return visitSome(this, ast.expressions);
                },
                visitKeyedRead: function (ast) {
                    return false;
                },
                visitKeyedWrite: function (ast) {
                    return false;
                },
                visitLiteralArray: function (ast) {
                    return true;
                },
                visitLiteralMap: function (ast) {
                    return true;
                },
                visitLiteralPrimitive: function (ast) {
                    return false;
                },
                visitMethodCall: function (ast) {
                    return true;
                },
                visitPipe: function (ast) {
                    return true;
                },
                visitPrefixNot: function (ast) {
                    return visit(this, ast.expression);
                },
                visitNonNullAssert: function (ast) {
                    return visit(this, ast.expression);
                },
                visitPropertyRead: function (ast) {
                    return false;
                },
                visitPropertyWrite: function (ast) {
                    return false;
                },
                visitQuote: function (ast) {
                    return false;
                },
                visitSafeMethodCall: function (ast) {
                    return true;
                },
                visitSafePropertyRead: function (ast) {
                    return false;
                }
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
         * @returns a `ParseSourceSpan` for the given span or null if no
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
        /** Adds the name of an AST to the list of implicit receiver accesses. */
        _AstToIrVisitor.prototype.addImplicitReceiverAccess = function (name) {
            if (this.implicitReceiverAccesses) {
                this.implicitReceiverAccesses.add(name);
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
        DefaultLocalResolver.prototype.notifyImplicitReceiverUse = function () { };
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
        function BuiltinFunctionCall(span, sourceSpan, args, converter) {
            var _this = _super.call(this, span, sourceSpan, null, args) || this;
            _this.args = args;
            _this.converter = converter;
            return _this;
        }
        return BuiltinFunctionCall;
    }(cdAst.FunctionCall));
    exports.BuiltinFunctionCall = BuiltinFunctionCall;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbl9jb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbUVBQWtEO0lBQ2xELGlFQUEyQztJQUMzQywyREFBMEM7SUFDMUMsK0RBQThDO0lBRTlDO1FBQUE7UUFFQSxDQUFDO1FBRFEsc0JBQUssR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3RDLHVCQUFDO0tBQUEsQUFGRCxJQUVDO0lBRlksNENBQWdCO0lBUzdCO1FBS0U7UUFDSTs7V0FFRztRQUNJLEtBQW9CO1FBQzNCOztXQUVHO1FBQ0ksWUFBMkI7WUFKM0IsVUFBSyxHQUFMLEtBQUssQ0FBZTtZQUlwQixpQkFBWSxHQUFaLFlBQVksQ0FBZTtZQUNwQzs7Ozs7Ozs7Ozs7Ozs7OztlQWdCRztZQUNILHNFQUFzRTtZQUN0RSxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxTQUFzQjtnQkFDbkQsSUFBSSxTQUFTLFlBQVksQ0FBQyxDQUFDLGNBQWMsSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLFlBQVksQ0FBQyxJQUFJO29CQUM1RSxTQUFTLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsRUFBRTtvQkFDbkQsSUFBTSxHQUFHLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFpQixDQUFDO29CQUM5QyxPQUFPLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3pDO2dCQUNELE9BQU8sU0FBUyxDQUFDO1lBQ25CLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNILGlDQUFDO0lBQUQsQ0FBQyxBQXpD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eUJBQXlCLENBQUMsSUFBaUI7UUFDbEQsSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLG1CQUFtQixFQUFFO1lBQ3pDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztTQUNsQjthQUFNLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxlQUFlLEVBQUU7WUFDNUMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO1NBQ25CO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7UUFBeUMsK0NBQWtCO1FBQ3pELDZCQUNJLElBQXFCLEVBQUUsVUFBb0MsRUFBUyxJQUFpQixFQUM5RSxTQUEyQjtZQUZ0QyxZQUdFLGtCQUFNLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUNwQztZQUh1RSxVQUFJLEdBQUosSUFBSSxDQUFhO1lBQzlFLGVBQVMsR0FBVCxTQUFTLENBQWtCOztRQUV0QyxDQUFDO1FBQ0gsMEJBQUM7SUFBRCxDQUFDLEFBTkQsQ0FBeUMsS0FBSyxDQUFDLFlBQVksR0FNMUQ7SUFOWSxrREFBbUIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNkQXN0IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGNsYXNzIEV2ZW50SGFuZGxlclZhcnMge1xuICBzdGF0aWMgZXZlbnQgPSBvLnZhcmlhYmxlKCckZXZlbnQnKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMb2NhbFJlc29sdmVyIHtcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGw7XG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIENvbnZlcnRBY3Rpb25CaW5kaW5nUmVzdWx0IHtcbiAgLyoqXG4gICAqIFN0b3JlIHN0YXRlbWVudHMgd2hpY2ggYXJlIHJlbmRlcjMgY29tcGF0aWJsZS5cbiAgICovXG4gIHJlbmRlcjNTdG10czogby5TdGF0ZW1lbnRbXTtcbiAgY29uc3RydWN0b3IoXG4gICAgICAvKipcbiAgICAgICAqIFJlbmRlcjIgY29tcGF0aWJsZSBzdGF0ZW1lbnRzLFxuICAgICAgICovXG4gICAgICBwdWJsaWMgc3RtdHM6IG8uU3RhdGVtZW50W10sXG4gICAgICAvKipcbiAgICAgICAqIFZhcmlhYmxlIG5hbWUgdXNlZCB3aXRoIHJlbmRlcjIgY29tcGF0aWJsZSBzdGF0ZW1lbnRzLlxuICAgICAgICovXG4gICAgICBwdWJsaWMgYWxsb3dEZWZhdWx0OiBvLlJlYWRWYXJFeHByKSB7XG4gICAgLyoqXG4gICAgICogVGhpcyBpcyBiaXQgb2YgYSBoYWNrLiBJdCBjb252ZXJ0cyBzdGF0ZW1lbnRzIHdoaWNoIHJlbmRlcjIgZXhwZWN0cyB0byBzdGF0ZW1lbnRzIHdoaWNoIGFyZVxuICAgICAqIGV4cGVjdGVkIGJ5IHJlbmRlcjMuXG4gICAgICpcbiAgICAgKiBFeGFtcGxlOiBgPGRpdiBjbGljaz1cImRvU29tZXRoaW5nKCRldmVudClcIj5gIHdpbGwgZ2VuZXJhdGU6XG4gICAgICpcbiAgICAgKiBSZW5kZXIzOlxuICAgICAqIGBgYFxuICAgICAqIGNvbnN0IHBkX2I6YW55ID0gKCg8YW55PmN0eC5kb1NvbWV0aGluZygkZXZlbnQpKSAhPT0gZmFsc2UpO1xuICAgICAqIHJldHVybiBwZF9iO1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogYnV0IHJlbmRlcjIgZXhwZWN0czpcbiAgICAgKiBgYGBcbiAgICAgKiByZXR1cm4gY3R4LmRvU29tZXRoaW5nKCRldmVudCk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgLy8gVE9ETyhtaXNrbyk6IHJlbW92ZSB0aGlzIGhhY2sgb25jZSB3ZSBubyBsb25nZXIgc3VwcG9ydCBWaWV3RW5naW5lLlxuICAgIHRoaXMucmVuZGVyM1N0bXRzID0gc3RtdHMubWFwKChzdGF0ZW1lbnQ6IG8uU3RhdGVtZW50KSA9PiB7XG4gICAgICBpZiAoc3RhdGVtZW50IGluc3RhbmNlb2Ygby5EZWNsYXJlVmFyU3RtdCAmJiBzdGF0ZW1lbnQubmFtZSA9PSBhbGxvd0RlZmF1bHQubmFtZSAmJlxuICAgICAgICAgIHN0YXRlbWVudC52YWx1ZSBpbnN0YW5jZW9mIG8uQmluYXJ5T3BlcmF0b3JFeHByKSB7XG4gICAgICAgIGNvbnN0IGxocyA9IHN0YXRlbWVudC52YWx1ZS5saHMgYXMgby5DYXN0RXhwcjtcbiAgICAgICAgcmV0dXJuIG5ldyBvLlJldHVyblN0YXRlbWVudChsaHMudmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXRlbWVudDtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBJbnRlcnBvbGF0aW9uRnVuY3Rpb24gPSAoYXJnczogby5FeHByZXNzaW9uW10pID0+IG8uRXhwcmVzc2lvbjtcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBBU1QgaW50byBhbiBleGVjdXRhYmxlIG91dHB1dCBBU1QsIGFzc3VtaW5nIHRoZSBleHByZXNzaW9uIGlzXG4gKiB1c2VkIGluIGFuIGFjdGlvbiBiaW5kaW5nIChlLmcuIGFuIGV2ZW50IGhhbmRsZXIpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgbG9jYWxSZXNvbHZlcjogTG9jYWxSZXNvbHZlcnxudWxsLCBpbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sIGFjdGlvbjogY2RBc3QuQVNULFxuICAgIGJpbmRpbmdJZDogc3RyaW5nLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24/OiBJbnRlcnBvbGF0aW9uRnVuY3Rpb24sXG4gICAgYmFzZVNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzPzogU2V0PHN0cmluZz4pOiBDb252ZXJ0QWN0aW9uQmluZGluZ1Jlc3VsdCB7XG4gIGlmICghbG9jYWxSZXNvbHZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIgPSBuZXcgRGVmYXVsdExvY2FsUmVzb2x2ZXIoKTtcbiAgfVxuICBjb25zdCBhY3Rpb25XaXRob3V0QnVpbHRpbnMgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnMoXG4gICAgICB7XG4gICAgICAgIGNyZWF0ZUxpdGVyYWxBcnJheUNvbnZlcnRlcjogKGFyZ0NvdW50OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAvLyBOb3RlOiBubyBjYWNoaW5nIGZvciBsaXRlcmFsIGFycmF5cyBpbiBhY3Rpb25zLlxuICAgICAgICAgIHJldHVybiAoYXJnczogby5FeHByZXNzaW9uW10pID0+IG8ubGl0ZXJhbEFycihhcmdzKTtcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcjogKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKSA9PiB7XG4gICAgICAgICAgLy8gTm90ZTogbm8gY2FjaGluZyBmb3IgbGl0ZXJhbCBtYXBzIGluIGFjdGlvbnMuXG4gICAgICAgICAgcmV0dXJuICh2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBlbnRyaWVzID0ga2V5cy5tYXAoKGssIGkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGsua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogay5xdW90ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVQaXBlQ29udmVydGVyOiAobmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBBY3Rpb25zIGFyZSBub3QgYWxsb3dlZCB0byBjb250YWluIHBpcGVzLiBQaXBlOiAke25hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBhY3Rpb24pO1xuXG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX0FzdFRvSXJWaXNpdG9yKFxuICAgICAgbG9jYWxSZXNvbHZlciwgaW1wbGljaXRSZWNlaXZlciwgYmluZGluZ0lkLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24sIGJhc2VTb3VyY2VTcGFuLFxuICAgICAgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzKTtcbiAgY29uc3QgYWN0aW9uU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgZmxhdHRlblN0YXRlbWVudHMoYWN0aW9uV2l0aG91dEJ1aWx0aW5zLnZpc2l0KHZpc2l0b3IsIF9Nb2RlLlN0YXRlbWVudCksIGFjdGlvblN0bXRzKTtcbiAgcHJlcGVuZFRlbXBvcmFyeURlY2xzKHZpc2l0b3IudGVtcG9yYXJ5Q291bnQsIGJpbmRpbmdJZCwgYWN0aW9uU3RtdHMpO1xuXG4gIGlmICh2aXNpdG9yLnVzZXNJbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgbG9jYWxSZXNvbHZlci5ub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk7XG4gIH1cblxuICBjb25zdCBsYXN0SW5kZXggPSBhY3Rpb25TdG10cy5sZW5ndGggLSAxO1xuICBsZXQgcHJldmVudERlZmF1bHRWYXI6IG8uUmVhZFZhckV4cHIgPSBudWxsITtcbiAgaWYgKGxhc3RJbmRleCA+PSAwKSB7XG4gICAgY29uc3QgbGFzdFN0YXRlbWVudCA9IGFjdGlvblN0bXRzW2xhc3RJbmRleF07XG4gICAgY29uc3QgcmV0dXJuRXhwciA9IGNvbnZlcnRTdG10SW50b0V4cHJlc3Npb24obGFzdFN0YXRlbWVudCk7XG4gICAgaWYgKHJldHVybkV4cHIpIHtcbiAgICAgIC8vIE5vdGU6IFdlIG5lZWQgdG8gY2FzdCB0aGUgcmVzdWx0IG9mIHRoZSBtZXRob2QgY2FsbCB0byBkeW5hbWljLFxuICAgICAgLy8gYXMgaXQgbWlnaHQgYmUgYSB2b2lkIG1ldGhvZCFcbiAgICAgIHByZXZlbnREZWZhdWx0VmFyID0gY3JlYXRlUHJldmVudERlZmF1bHRWYXIoYmluZGluZ0lkKTtcbiAgICAgIGFjdGlvblN0bXRzW2xhc3RJbmRleF0gPVxuICAgICAgICAgIHByZXZlbnREZWZhdWx0VmFyLnNldChyZXR1cm5FeHByLmNhc3Qoby5EWU5BTUlDX1RZUEUpLm5vdElkZW50aWNhbChvLmxpdGVyYWwoZmFsc2UpKSlcbiAgICAgICAgICAgICAgLnRvRGVjbFN0bXQobnVsbCwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgQ29udmVydEFjdGlvbkJpbmRpbmdSZXN1bHQoYWN0aW9uU3RtdHMsIHByZXZlbnREZWZhdWx0VmFyKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsdGluQ29udmVydGVyIHtcbiAgKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5IHtcbiAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyKGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xuICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKTogQnVpbHRpbkNvbnZlcnRlcjtcbiAgY3JlYXRlUGlwZUNvbnZlcnRlcihuYW1lOiBzdHJpbmcsIGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgIGNvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5LCBhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LkFTVCB7XG4gIHJldHVybiBjb252ZXJ0QnVpbHRpbnMoY29udmVydGVyRmFjdG9yeSwgYXN0KTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RtdHM6IG8uU3RhdGVtZW50W10sIHB1YmxpYyBjdXJyVmFsRXhwcjogby5FeHByZXNzaW9uKSB7fVxufVxuXG5leHBvcnQgZW51bSBCaW5kaW5nRm9ybSB7XG4gIC8vIFRoZSBnZW5lcmFsIGZvcm0gb2YgYmluZGluZyBleHByZXNzaW9uLCBzdXBwb3J0cyBhbGwgZXhwcmVzc2lvbnMuXG4gIEdlbmVyYWwsXG5cbiAgLy8gVHJ5IHRvIGdlbmVyYXRlIGEgc2ltcGxlIGJpbmRpbmcgKG5vIHRlbXBvcmFyaWVzIG9yIHN0YXRlbWVudHMpXG4gIC8vIG90aGVyd2lzZSBnZW5lcmF0ZSBhIGdlbmVyYWwgYmluZGluZ1xuICBUcnlTaW1wbGUsXG59XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIGV4cHJlc3Npb24gQVNUIGludG8gYW4gZXhlY3V0YWJsZSBvdXRwdXQgQVNULCBhc3N1bWluZyB0aGUgZXhwcmVzc2lvblxuICogaXMgdXNlZCBpbiBwcm9wZXJ0eSBiaW5kaW5nLiBUaGUgZXhwcmVzc2lvbiBoYXMgdG8gYmUgcHJlcHJvY2Vzc2VkIHZpYVxuICogYGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGluc2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXJ8bnVsbCwgaW1wbGljaXRSZWNlaXZlcjogby5FeHByZXNzaW9uLFxuICAgIGV4cHJlc3Npb25XaXRob3V0QnVpbHRpbnM6IGNkQXN0LkFTVCwgYmluZGluZ0lkOiBzdHJpbmcsIGZvcm06IEJpbmRpbmdGb3JtLFxuICAgIGludGVycG9sYXRpb25GdW5jdGlvbj86IEludGVycG9sYXRpb25GdW5jdGlvbik6IENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQge1xuICBpZiAoIWxvY2FsUmVzb2x2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyID0gbmV3IERlZmF1bHRMb2NhbFJlc29sdmVyKCk7XG4gIH1cbiAgY29uc3QgY3VyclZhbEV4cHIgPSBjcmVhdGVDdXJyVmFsdWVFeHByKGJpbmRpbmdJZCk7XG4gIGNvbnN0IHZpc2l0b3IgPVxuICAgICAgbmV3IF9Bc3RUb0lyVmlzaXRvcihsb2NhbFJlc29sdmVyLCBpbXBsaWNpdFJlY2VpdmVyLCBiaW5kaW5nSWQsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gIGNvbnN0IG91dHB1dEV4cHI6IG8uRXhwcmVzc2lvbiA9IGV4cHJlc3Npb25XaXRob3V0QnVpbHRpbnMudmlzaXQodmlzaXRvciwgX01vZGUuRXhwcmVzc2lvbik7XG4gIGNvbnN0IHN0bXRzOiBvLlN0YXRlbWVudFtdID0gZ2V0U3RhdGVtZW50c0Zyb21WaXNpdG9yKHZpc2l0b3IsIGJpbmRpbmdJZCk7XG5cbiAgaWYgKHZpc2l0b3IudXNlc0ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTtcbiAgfVxuXG4gIGlmICh2aXNpdG9yLnRlbXBvcmFyeUNvdW50ID09PSAwICYmIGZvcm0gPT0gQmluZGluZ0Zvcm0uVHJ5U2ltcGxlKSB7XG4gICAgcmV0dXJuIG5ldyBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0KFtdLCBvdXRwdXRFeHByKTtcbiAgfVxuXG4gIHN0bXRzLnB1c2goY3VyclZhbEV4cHIuc2V0KG91dHB1dEV4cHIpLnRvRGVjbFN0bXQoby5EWU5BTUlDX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgcmV0dXJuIG5ldyBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0KHN0bXRzLCBjdXJyVmFsRXhwcik7XG59XG5cbi8qKlxuICogR2l2ZW4gc29tZSBleHByZXNzaW9uLCBzdWNoIGFzIGEgYmluZGluZyBvciBpbnRlcnBvbGF0aW9uIGV4cHJlc3Npb24sIGFuZCBhIGNvbnRleHQgZXhwcmVzc2lvbiB0b1xuICogbG9vayB2YWx1ZXMgdXAgb24sIHZpc2l0IGVhY2ggZmFjZXQgb2YgdGhlIGdpdmVuIGV4cHJlc3Npb24gcmVzb2x2aW5nIHZhbHVlcyBmcm9tIHRoZSBjb250ZXh0XG4gKiBleHByZXNzaW9uIHN1Y2ggdGhhdCBhIGxpc3Qgb2YgYXJndW1lbnRzIGNhbiBiZSBkZXJpdmVkIGZyb20gdGhlIGZvdW5kIHZhbHVlcyB0aGF0IGNhbiBiZSB1c2VkIGFzXG4gKiBhcmd1bWVudHMgdG8gYW4gZXh0ZXJuYWwgdXBkYXRlIGluc3RydWN0aW9uLlxuICpcbiAqIEBwYXJhbSBsb2NhbFJlc29sdmVyIFRoZSByZXNvbHZlciB0byB1c2UgdG8gbG9vayB1cCBleHByZXNzaW9ucyBieSBuYW1lIGFwcHJvcHJpYXRlbHlcbiAqIEBwYXJhbSBjb250ZXh0VmFyaWFibGVFeHByZXNzaW9uIFRoZSBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgY29udGV4dCB2YXJpYWJsZSB1c2VkIHRvIGNyZWF0ZVxuICogdGhlIGZpbmFsIGFyZ3VtZW50IGV4cHJlc3Npb25zXG4gKiBAcGFyYW0gZXhwcmVzc2lvbldpdGhBcmd1bWVudHNUb0V4dHJhY3QgVGhlIGV4cHJlc3Npb24gdG8gdmlzaXQgdG8gZmlndXJlIG91dCB3aGF0IHZhbHVlcyBuZWVkIHRvXG4gKiBiZSByZXNvbHZlZCBhbmQgd2hhdCBhcmd1bWVudHMgbGlzdCB0byBidWlsZC5cbiAqIEBwYXJhbSBiaW5kaW5nSWQgQSBuYW1lIHByZWZpeCB1c2VkIHRvIGNyZWF0ZSB0ZW1wb3JhcnkgdmFyaWFibGUgbmFtZXMgaWYgdGhleSdyZSBuZWVkZWQgZm9yIHRoZVxuICogYXJndW1lbnRzIGdlbmVyYXRlZFxuICogQHJldHVybnMgQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgdGhhdCBjYW4gYmUgcGFzc2VkIGFzIGFyZ3VtZW50cyB0byBpbnN0cnVjdGlvbiBleHByZXNzaW9ucyBsaWtlXG4gKiBgby5pbXBvcnRFeHByKFIzLnByb3BlcnR5SW50ZXJwb2xhdGUpLmNhbGxGbihyZXN1bHQpYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFVwZGF0ZUFyZ3VtZW50cyhcbiAgICBsb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyLCBjb250ZXh0VmFyaWFibGVFeHByZXNzaW9uOiBvLkV4cHJlc3Npb24sXG4gICAgZXhwcmVzc2lvbldpdGhBcmd1bWVudHNUb0V4dHJhY3Q6IGNkQXN0LkFTVCwgYmluZGluZ0lkOiBzdHJpbmcpIHtcbiAgY29uc3QgdmlzaXRvciA9XG4gICAgICBuZXcgX0FzdFRvSXJWaXNpdG9yKGxvY2FsUmVzb2x2ZXIsIGNvbnRleHRWYXJpYWJsZUV4cHJlc3Npb24sIGJpbmRpbmdJZCwgdW5kZWZpbmVkKTtcbiAgY29uc3Qgb3V0cHV0RXhwcjogby5JbnZva2VGdW5jdGlvbkV4cHIgPVxuICAgICAgZXhwcmVzc2lvbldpdGhBcmd1bWVudHNUb0V4dHJhY3QudmlzaXQodmlzaXRvciwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgaWYgKHZpc2l0b3IudXNlc0ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTtcbiAgfVxuXG4gIGNvbnN0IHN0bXRzID0gZ2V0U3RhdGVtZW50c0Zyb21WaXNpdG9yKHZpc2l0b3IsIGJpbmRpbmdJZCk7XG5cbiAgLy8gUmVtb3ZpbmcgdGhlIGZpcnN0IGFyZ3VtZW50LCBiZWNhdXNlIGl0IHdhcyBhIGxlbmd0aCBmb3IgVmlld0VuZ2luZSwgbm90IEl2eS5cbiAgbGV0IGFyZ3MgPSBvdXRwdXRFeHByLmFyZ3Muc2xpY2UoMSk7XG4gIGlmIChleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdCBpbnN0YW5jZW9mIGNkQXN0LkludGVycG9sYXRpb24pIHtcbiAgICAvLyBJZiB3ZSdyZSBkZWFsaW5nIHdpdGggYW4gaW50ZXJwb2xhdGlvbiBvZiAxIHZhbHVlIHdpdGggYW4gZW1wdHkgcHJlZml4IGFuZCBzdWZmaXgsIHJlZHVjZSB0aGVcbiAgICAvLyBhcmdzIHJldHVybmVkIHRvIGp1c3QgdGhlIHZhbHVlLCBiZWNhdXNlIHdlJ3JlIGdvaW5nIHRvIHBhc3MgaXQgdG8gYSBzcGVjaWFsIGluc3RydWN0aW9uLlxuICAgIGNvbnN0IHN0cmluZ3MgPSBleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdC5zdHJpbmdzO1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMyAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgICAgLy8gU2luZ2xlIGFyZ3VtZW50IGludGVycG9sYXRlIGluc3RydWN0aW9ucy5cbiAgICAgIGFyZ3MgPSBbYXJnc1sxXV07XG4gICAgfSBlbHNlIGlmIChhcmdzLmxlbmd0aCA+PSAxOSkge1xuICAgICAgLy8gMTkgb3IgbW9yZSBhcmd1bWVudHMgbXVzdCBiZSBwYXNzZWQgdG8gdGhlIGBpbnRlcnBvbGF0ZVZgLXN0eWxlIGluc3RydWN0aW9ucywgd2hpY2ggYWNjZXB0XG4gICAgICAvLyBhbiBhcnJheSBvZiBhcmd1bWVudHNcbiAgICAgIGFyZ3MgPSBbby5saXRlcmFsQXJyKGFyZ3MpXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHtzdG10cywgYXJnc307XG59XG5cbmZ1bmN0aW9uIGdldFN0YXRlbWVudHNGcm9tVmlzaXRvcih2aXNpdG9yOiBfQXN0VG9JclZpc2l0b3IsIGJpbmRpbmdJZDogc3RyaW5nKSB7XG4gIGNvbnN0IHN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmlzaXRvci50ZW1wb3JhcnlDb3VudDsgaSsrKSB7XG4gICAgc3RtdHMucHVzaCh0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQsIGkpKTtcbiAgfVxuICByZXR1cm4gc3RtdHM7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRCdWlsdGlucyhjb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSwgYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5BU1Qge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9CdWlsdGluQXN0Q29udmVydGVyKGNvbnZlcnRlckZhY3RvcnkpO1xuICByZXR1cm4gYXN0LnZpc2l0KHZpc2l0b3IpO1xufVxuXG5mdW5jdGlvbiB0ZW1wb3JhcnlOYW1lKGJpbmRpbmdJZDogc3RyaW5nLCB0ZW1wb3JhcnlOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBgdG1wXyR7YmluZGluZ0lkfV8ke3RlbXBvcmFyeU51bWJlcn1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGVtcG9yYXJ5RGVjbGFyYXRpb24oYmluZGluZ0lkOiBzdHJpbmcsIHRlbXBvcmFyeU51bWJlcjogbnVtYmVyKTogby5TdGF0ZW1lbnQge1xuICByZXR1cm4gbmV3IG8uRGVjbGFyZVZhclN0bXQodGVtcG9yYXJ5TmFtZShiaW5kaW5nSWQsIHRlbXBvcmFyeU51bWJlciksIG8uTlVMTF9FWFBSKTtcbn1cblxuZnVuY3Rpb24gcHJlcGVuZFRlbXBvcmFyeURlY2xzKFxuICAgIHRlbXBvcmFyeUNvdW50OiBudW1iZXIsIGJpbmRpbmdJZDogc3RyaW5nLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKSB7XG4gIGZvciAobGV0IGkgPSB0ZW1wb3JhcnlDb3VudCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgc3RhdGVtZW50cy51bnNoaWZ0KHRlbXBvcmFyeURlY2xhcmF0aW9uKGJpbmRpbmdJZCwgaSkpO1xuICB9XG59XG5cbmVudW0gX01vZGUge1xuICBTdGF0ZW1lbnQsXG4gIEV4cHJlc3Npb25cbn1cblxuZnVuY3Rpb24gZW5zdXJlU3RhdGVtZW50TW9kZShtb2RlOiBfTW9kZSwgYXN0OiBjZEFzdC5BU1QpIHtcbiAgaWYgKG1vZGUgIT09IF9Nb2RlLlN0YXRlbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYSBzdGF0ZW1lbnQsIGJ1dCBzYXcgJHthc3R9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW5zdXJlRXhwcmVzc2lvbk1vZGUobW9kZTogX01vZGUsIGFzdDogY2RBc3QuQVNUKSB7XG4gIGlmIChtb2RlICE9PSBfTW9kZS5FeHByZXNzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhbiBleHByZXNzaW9uLCBidXQgc2F3ICR7YXN0fWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGU6IF9Nb2RlLCBleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb258by5TdGF0ZW1lbnQge1xuICBpZiAobW9kZSA9PT0gX01vZGUuU3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIGV4cHIudG9TdG10KCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cbn1cblxuY2xhc3MgX0J1aWx0aW5Bc3RDb252ZXJ0ZXIgZXh0ZW5kcyBjZEFzdC5Bc3RUcmFuc2Zvcm1lciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2NvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5KSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gW2FzdC5leHAsIC4uLmFzdC5hcmdzXS5tYXAoYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFyZ3MsXG4gICAgICAgIHRoaXMuX2NvbnZlcnRlckZhY3RvcnkuY3JlYXRlUGlwZUNvbnZlcnRlcihhc3QubmFtZSwgYXJncy5sZW5ndGgpKTtcbiAgfVxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gYXN0LmV4cHJlc3Npb25zLm1hcChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXJncyxcbiAgICAgICAgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXIoYXN0LmV4cHJlc3Npb25zLmxlbmd0aCkpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IGFzdC52YWx1ZXMubWFwKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuXG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFyZ3MsIHRoaXMuX2NvbnZlcnRlckZhY3RvcnkuY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcihhc3Qua2V5cykpO1xuICB9XG59XG5cbmNsYXNzIF9Bc3RUb0lyVmlzaXRvciBpbXBsZW1lbnRzIGNkQXN0LkFzdFZpc2l0b3Ige1xuICBwcml2YXRlIF9ub2RlTWFwID0gbmV3IE1hcDxjZEFzdC5BU1QsIGNkQXN0LkFTVD4oKTtcbiAgcHJpdmF0ZSBfcmVzdWx0TWFwID0gbmV3IE1hcDxjZEFzdC5BU1QsIG8uRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBfY3VycmVudFRlbXBvcmFyeTogbnVtYmVyID0gMDtcbiAgcHVibGljIHRlbXBvcmFyeUNvdW50OiBudW1iZXIgPSAwO1xuICBwdWJsaWMgdXNlc0ltcGxpY2l0UmVjZWl2ZXI6IGJvb2xlYW4gPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2xvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXIsIHByaXZhdGUgX2ltcGxpY2l0UmVjZWl2ZXI6IG8uRXhwcmVzc2lvbixcbiAgICAgIHByaXZhdGUgYmluZGluZ0lkOiBzdHJpbmcsIHByaXZhdGUgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uOiBJbnRlcnBvbGF0aW9uRnVuY3Rpb258dW5kZWZpbmVkLFxuICAgICAgcHJpdmF0ZSBiYXNlU291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiwgcHJpdmF0ZSBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXM/OiBTZXQ8c3RyaW5nPikge31cblxuICB2aXNpdEJpbmFyeShhc3Q6IGNkQXN0LkJpbmFyeSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGxldCBvcDogby5CaW5hcnlPcGVyYXRvcjtcbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRpb24pIHtcbiAgICAgIGNhc2UgJysnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuUGx1cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICctJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk1pbnVzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyonOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLyc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5EaXZpZGU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnJSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Nb2R1bG87XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnJiYnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQW5kO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3x8JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk9yO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICchPSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICchPT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJzwnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTG93ZXI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPic6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5CaWdnZXI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPD0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPj0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyRXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgb3BlcmF0aW9uICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIG9wLCB0aGlzLl92aXNpdChhc3QubGVmdCwgX01vZGUuRXhwcmVzc2lvbiksIHRoaXMuX3Zpc2l0KGFzdC5yaWdodCwgX01vZGUuRXhwcmVzc2lvbiksXG4gICAgICAgICAgICB1bmRlZmluZWQsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4sIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVTdGF0ZW1lbnRNb2RlKG1vZGUsIGFzdCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zLCBtb2RlKTtcbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBjZEFzdC5Db25kaXRpb25hbCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IHZhbHVlOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QuY29uZGl0aW9uLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIHZhbHVlLmNvbmRpdGlvbmFsKFxuICAgICAgICAgICAgdGhpcy5fdmlzaXQoYXN0LnRydWVFeHAsIF9Nb2RlLkV4cHJlc3Npb24pLCB0aGlzLl92aXNpdChhc3QuZmFsc2VFeHAsIF9Nb2RlLkV4cHJlc3Npb24pLFxuICAgICAgICAgICAgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpKTtcbiAgfVxuXG4gIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgSWxsZWdhbCBzdGF0ZTogUGlwZXMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnMuIFBpcGU6ICR7YXN0Lm5hbWV9YCk7XG4gIH1cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IGNkQXN0LkZ1bmN0aW9uQ2FsbCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3MgPSB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBsZXQgZm5SZXN1bHQ6IG8uRXhwcmVzc2lvbjtcbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgQnVpbHRpbkZ1bmN0aW9uQ2FsbCkge1xuICAgICAgZm5SZXN1bHQgPSBhc3QuY29udmVydGVyKGNvbnZlcnRlZEFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmblJlc3VsdCA9IHRoaXMuX3Zpc2l0KGFzdC50YXJnZXQhLCBfTW9kZS5FeHByZXNzaW9uKVxuICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihjb252ZXJ0ZWRBcmdzLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSk7XG4gICAgfVxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCBmblJlc3VsdCk7XG4gIH1cblxuICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgZW5zdXJlRXhwcmVzc2lvbk1vZGUobW9kZSwgYXN0KTtcbiAgICB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlcjtcbiAgfVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24sIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVFeHByZXNzaW9uTW9kZShtb2RlLCBhc3QpO1xuICAgIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKGFzdC5leHByZXNzaW9ucy5sZW5ndGgpXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzdC5zdHJpbmdzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgYXJncy5wdXNoKG8ubGl0ZXJhbChhc3Quc3RyaW5nc1tpXSkpO1xuICAgICAgYXJncy5wdXNoKHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uc1tpXSwgX01vZGUuRXhwcmVzc2lvbikpO1xuICAgIH1cbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGFzdC5zdHJpbmdzW2FzdC5zdHJpbmdzLmxlbmd0aCAtIDFdKSk7XG5cbiAgICBpZiAodGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdC5leHByZXNzaW9ucy5sZW5ndGggPD0gOSA/XG4gICAgICAgIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5pbmxpbmVJbnRlcnBvbGF0ZSkuY2FsbEZuKGFyZ3MpIDpcbiAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmludGVycG9sYXRlKS5jYWxsRm4oW1xuICAgICAgICAgIGFyZ3NbMF0sIG8ubGl0ZXJhbEFycihhcmdzLnNsaWNlKDEpLCB1bmRlZmluZWQsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKVxuICAgICAgICBdKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogY2RBc3QuS2V5ZWRSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgbGVmdE1vc3RTYWZlID0gdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCk7XG4gICAgaWYgKGxlZnRNb3N0U2FmZSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCBsZWZ0TW9zdFNhZmUsIG1vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgICAgbW9kZSwgdGhpcy5fdmlzaXQoYXN0Lm9iaiwgX01vZGUuRXhwcmVzc2lvbikua2V5KHRoaXMuX3Zpc2l0KGFzdC5rZXksIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IG9iajogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0Lm9iaiwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3Qga2V5OiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3Qua2V5LCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCB2YWx1ZTogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LnZhbHVlLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgb2JqLmtleShrZXkpLnNldCh2YWx1ZSkpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IGxpdGVyYWwgYXJyYXlzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zYCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBsaXRlcmFsIG1hcHMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnNgKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICAvLyBGb3IgbGl0ZXJhbCB2YWx1ZXMgb2YgbnVsbCwgdW5kZWZpbmVkLCB0cnVlLCBvciBmYWxzZSBhbGxvdyB0eXBlIGludGVyZmVyZW5jZVxuICAgIC8vIHRvIGluZmVyIHRoZSB0eXBlLlxuICAgIGNvbnN0IHR5cGUgPVxuICAgICAgICBhc3QudmFsdWUgPT09IG51bGwgfHwgYXN0LnZhbHVlID09PSB1bmRlZmluZWQgfHwgYXN0LnZhbHVlID09PSB0cnVlIHx8IGFzdC52YWx1ZSA9PT0gdHJ1ZSA/XG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSA6XG4gICAgICAgIHVuZGVmaW5lZDtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsIG8ubGl0ZXJhbChhc3QudmFsdWUsIHR5cGUsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICBwcml2YXRlIF9nZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2xvY2FsUmVzb2x2ZXIuZ2V0TG9jYWwobmFtZSk7XG4gIH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBjZEFzdC5NZXRob2RDYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIgJiYgYXN0Lm5hbWUgPT0gJyRhbnknKSB7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbikgYXMgYW55W107XG4gICAgICBpZiAoYXJncy5sZW5ndGggIT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgSW52YWxpZCBjYWxsIHRvICRhbnksIGV4cGVjdGVkIDEgYXJndW1lbnQgYnV0IHJlY2VpdmVkICR7YXJncy5sZW5ndGggfHwgJ25vbmUnfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChhcmdzWzBdIGFzIG8uRXhwcmVzc2lvbikuY2FzdChvLkRZTkFNSUNfVFlQRSwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpO1xuICAgIH1cblxuICAgIGNvbnN0IGxlZnRNb3N0U2FmZSA9IHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpO1xuICAgIGlmIChsZWZ0TW9zdFNhZmUpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgbGVmdE1vc3RTYWZlLCBtb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgICAgY29uc3QgcHJldlVzZXNJbXBsaWNpdFJlY2VpdmVyID0gdGhpcy51c2VzSW1wbGljaXRSZWNlaXZlcjtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCByZWNlaXZlciA9IHRoaXMuX3Zpc2l0KGFzdC5yZWNlaXZlciwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgICBpZiAocmVjZWl2ZXIgPT09IHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgICAgY29uc3QgdmFyRXhwciA9IHRoaXMuX2dldExvY2FsKGFzdC5uYW1lKTtcbiAgICAgICAgaWYgKHZhckV4cHIpIHtcbiAgICAgICAgICAvLyBSZXN0b3JlIHRoZSBwcmV2aW91cyBcInVzZXNJbXBsaWNpdFJlY2VpdmVyXCIgc3RhdGUgc2luY2UgdGhlIGltcGxpY2l0XG4gICAgICAgICAgLy8gcmVjZWl2ZXIgaGFzIGJlZW4gcmVwbGFjZWQgd2l0aCBhIHJlc29sdmVkIGxvY2FsIGV4cHJlc3Npb24uXG4gICAgICAgICAgdGhpcy51c2VzSW1wbGljaXRSZWNlaXZlciA9IHByZXZVc2VzSW1wbGljaXRSZWNlaXZlcjtcbiAgICAgICAgICByZXN1bHQgPSB2YXJFeHByLmNhbGxGbihhcmdzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFkZEltcGxpY2l0UmVjZWl2ZXJBY2Nlc3MoYXN0Lm5hbWUpO1xuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCA9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLmNhbGxNZXRob2QoYXN0Lm5hbWUsIGFyZ3MsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCByZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG8ubm90KHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgby5hc3NlcnROb3ROdWxsKHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuICAgICAgY29uc3QgcmVjZWl2ZXIgPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgICAgaWYgKHJlY2VpdmVyID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMuX2dldExvY2FsKGFzdC5uYW1lKTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgIC8vIFJlc3RvcmUgdGhlIHByZXZpb3VzIFwidXNlc0ltcGxpY2l0UmVjZWl2ZXJcIiBzdGF0ZSBzaW5jZSB0aGUgaW1wbGljaXRcbiAgICAgICAgICAvLyByZWNlaXZlciBoYXMgYmVlbiByZXBsYWNlZCB3aXRoIGEgcmVzb2x2ZWQgbG9jYWwgZXhwcmVzc2lvbi5cbiAgICAgICAgICB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyID0gcHJldlVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYWRkSW1wbGljaXRSZWNlaXZlckFjY2Vzcyhhc3QubmFtZSk7XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0ID09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0ID0gcmVjZWl2ZXIucHJvcChhc3QubmFtZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgcmVzdWx0KTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBjZEFzdC5Qcm9wZXJ0eVdyaXRlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgcmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5yZWNlaXZlciwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3QgcHJldlVzZXNJbXBsaWNpdFJlY2VpdmVyID0gdGhpcy51c2VzSW1wbGljaXRSZWNlaXZlcjtcblxuICAgIGxldCB2YXJFeHByOiBvLlJlYWRQcm9wRXhwcnxudWxsID0gbnVsbDtcbiAgICBpZiAocmVjZWl2ZXIgPT09IHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIGNvbnN0IGxvY2FsRXhwciA9IHRoaXMuX2dldExvY2FsKGFzdC5uYW1lKTtcbiAgICAgIGlmIChsb2NhbEV4cHIpIHtcbiAgICAgICAgaWYgKGxvY2FsRXhwciBpbnN0YW5jZW9mIG8uUmVhZFByb3BFeHByKSB7XG4gICAgICAgICAgLy8gSWYgdGhlIGxvY2FsIHZhcmlhYmxlIGlzIGEgcHJvcGVydHkgcmVhZCBleHByZXNzaW9uLCBpdCdzIGEgcmVmZXJlbmNlXG4gICAgICAgICAgLy8gdG8gYSAnY29udGV4dC5wcm9wZXJ0eScgdmFsdWUgYW5kIHdpbGwgYmUgdXNlZCBhcyB0aGUgdGFyZ2V0IG9mIHRoZVxuICAgICAgICAgIC8vIHdyaXRlIGV4cHJlc3Npb24uXG4gICAgICAgICAgdmFyRXhwciA9IGxvY2FsRXhwcjtcbiAgICAgICAgICAvLyBSZXN0b3JlIHRoZSBwcmV2aW91cyBcInVzZXNJbXBsaWNpdFJlY2VpdmVyXCIgc3RhdGUgc2luY2UgdGhlIGltcGxpY2l0XG4gICAgICAgICAgLy8gcmVjZWl2ZXIgaGFzIGJlZW4gcmVwbGFjZWQgd2l0aCBhIHJlc29sdmVkIGxvY2FsIGV4cHJlc3Npb24uXG4gICAgICAgICAgdGhpcy51c2VzSW1wbGljaXRSZWNlaXZlciA9IHByZXZVc2VzSW1wbGljaXRSZWNlaXZlcjtcbiAgICAgICAgICB0aGlzLmFkZEltcGxpY2l0UmVjZWl2ZXJBY2Nlc3MoYXN0Lm5hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSBpdCdzIGFuIGVycm9yLlxuICAgICAgICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0Lm5hbWU7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSAoYXN0LnZhbHVlIGluc3RhbmNlb2YgY2RBc3QuUHJvcGVydHlSZWFkKSA/IGFzdC52YWx1ZS5uYW1lIDogdW5kZWZpbmVkO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGFzc2lnbiB2YWx1ZSBcIiR7dmFsdWV9XCIgdG8gdGVtcGxhdGUgdmFyaWFibGUgXCIke1xuICAgICAgICAgICAgICByZWNlaXZlcn1cIi4gVGVtcGxhdGUgdmFyaWFibGVzIGFyZSByZWFkLW9ubHkuYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gSWYgbm8gbG9jYWwgZXhwcmVzc2lvbiBjb3VsZCBiZSBwcm9kdWNlZCwgdXNlIHRoZSBvcmlnaW5hbCByZWNlaXZlcidzXG4gICAgLy8gcHJvcGVydHkgYXMgdGhlIHRhcmdldC5cbiAgICBpZiAodmFyRXhwciA9PT0gbnVsbCkge1xuICAgICAgdmFyRXhwciA9IHJlY2VpdmVyLnByb3AoYXN0Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgdmFyRXhwci5zZXQodGhpcy5fdmlzaXQoYXN0LnZhbHVlLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogY2RBc3QuU2FmZVByb3BlcnR5UmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCksIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IGNkQXN0LlNhZmVNZXRob2RDYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KSwgbW9kZSk7XG4gIH1cblxuICB2aXNpdEFsbChhc3RzOiBjZEFzdC5BU1RbXSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBhc3RzLm1hcChhc3QgPT4gdGhpcy5fdmlzaXQoYXN0LCBtb2RlKSk7XG4gIH1cblxuICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFF1b3RlcyBhcmUgbm90IHN1cHBvcnRlZCBmb3IgZXZhbHVhdGlvbiFcbiAgICAgICAgU3RhdGVtZW50OiAke2FzdC51bmludGVycHJldGVkRXhwcmVzc2lvbn0gbG9jYXRlZCBhdCAke2FzdC5sb2NhdGlvbn1gKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0KGFzdDogY2RBc3QuQVNULCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fcmVzdWx0TWFwLmdldChhc3QpO1xuICAgIGlmIChyZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgcmV0dXJuICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodGhpcywgbW9kZSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRTYWZlQWNjZXNzKFxuICAgICAgYXN0OiBjZEFzdC5BU1QsIGxlZnRNb3N0U2FmZTogY2RBc3QuU2FmZU1ldGhvZENhbGx8Y2RBc3QuU2FmZVByb3BlcnR5UmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGNvbnRhaW5zIGEgc2FmZSBhY2Nlc3Mgbm9kZSBvbiB0aGUgbGVmdCBpdCBuZWVkcyB0byBiZSBjb252ZXJ0ZWQgdG9cbiAgICAvLyBhbiBleHByZXNzaW9uIHRoYXQgZ3VhcmRzIHRoZSBhY2Nlc3MgdG8gdGhlIG1lbWJlciBieSBjaGVja2luZyB0aGUgcmVjZWl2ZXIgZm9yIGJsYW5rLiBBc1xuICAgIC8vIGV4ZWN1dGlvbiBwcm9jZWVkcyBmcm9tIGxlZnQgdG8gcmlnaHQsIHRoZSBsZWZ0IG1vc3QgcGFydCBvZiB0aGUgZXhwcmVzc2lvbiBtdXN0IGJlIGd1YXJkZWRcbiAgICAvLyBmaXJzdCBidXQsIGJlY2F1c2UgbWVtYmVyIGFjY2VzcyBpcyBsZWZ0IGFzc29jaWF0aXZlLCB0aGUgcmlnaHQgc2lkZSBvZiB0aGUgZXhwcmVzc2lvbiBpcyBhdFxuICAgIC8vIHRoZSB0b3Agb2YgdGhlIEFTVC4gVGhlIGRlc2lyZWQgcmVzdWx0IHJlcXVpcmVzIGxpZnRpbmcgYSBjb3B5IG9mIHRoZSBsZWZ0IHBhcnQgb2YgdGhlXG4gICAgLy8gZXhwcmVzc2lvbiB1cCB0byB0ZXN0IGl0IGZvciBibGFuayBiZWZvcmUgZ2VuZXJhdGluZyB0aGUgdW5ndWFyZGVkIHZlcnNpb24uXG5cbiAgICAvLyBDb25zaWRlciwgZm9yIGV4YW1wbGUgdGhlIGZvbGxvd2luZyBleHByZXNzaW9uOiBhPy5iLmM/LmQuZVxuXG4gICAgLy8gVGhpcyByZXN1bHRzIGluIHRoZSBhc3Q6XG4gICAgLy8gICAgICAgICAuXG4gICAgLy8gICAgICAgIC8gXFxcbiAgICAvLyAgICAgICA/LiAgIGVcbiAgICAvLyAgICAgIC8gIFxcXG4gICAgLy8gICAgIC4gICAgZFxuICAgIC8vICAgIC8gXFxcbiAgICAvLyAgID8uICBjXG4gICAgLy8gIC8gIFxcXG4gICAgLy8gYSAgICBiXG5cbiAgICAvLyBUaGUgZm9sbG93aW5nIHRyZWUgc2hvdWxkIGJlIGdlbmVyYXRlZDpcbiAgICAvL1xuICAgIC8vICAgICAgICAvLS0tLSA/IC0tLS1cXFxuICAgIC8vICAgICAgIC8gICAgICB8ICAgICAgXFxcbiAgICAvLyAgICAgYSAgIC8tLS0gPyAtLS1cXCAgbnVsbFxuICAgIC8vICAgICAgICAvICAgICB8ICAgICBcXFxuICAgIC8vICAgICAgIC4gICAgICAuICAgICBudWxsXG4gICAgLy8gICAgICAvIFxcICAgIC8gXFxcbiAgICAvLyAgICAgLiAgYyAgIC4gICBlXG4gICAgLy8gICAgLyBcXCAgICAvIFxcXG4gICAgLy8gICBhICAgYiAgLiAgIGRcbiAgICAvLyAgICAgICAgIC8gXFxcbiAgICAvLyAgICAgICAgLiAgIGNcbiAgICAvLyAgICAgICAvIFxcXG4gICAgLy8gICAgICBhICAgYlxuICAgIC8vXG4gICAgLy8gTm90aWNlIHRoYXQgdGhlIGZpcnN0IGd1YXJkIGNvbmRpdGlvbiBpcyB0aGUgbGVmdCBoYW5kIG9mIHRoZSBsZWZ0IG1vc3Qgc2FmZSBhY2Nlc3Mgbm9kZVxuICAgIC8vIHdoaWNoIGNvbWVzIGluIGFzIGxlZnRNb3N0U2FmZSB0byB0aGlzIHJvdXRpbmUuXG5cbiAgICBsZXQgZ3VhcmRlZEV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGxldCB0ZW1wb3Jhcnk6IG8uUmVhZFZhckV4cHIgPSB1bmRlZmluZWQhO1xuICAgIGlmICh0aGlzLm5lZWRzVGVtcG9yYXJ5KGxlZnRNb3N0U2FmZS5yZWNlaXZlcikpIHtcbiAgICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGhhcyBtZXRob2QgY2FsbHMgb3IgcGlwZXMgdGhlbiB3ZSBuZWVkIHRvIHNhdmUgdGhlIHJlc3VsdCBpbnRvIGFcbiAgICAgIC8vIHRlbXBvcmFyeSB2YXJpYWJsZSB0byBhdm9pZCBjYWxsaW5nIHN0YXRlZnVsIG9yIGltcHVyZSBjb2RlIG1vcmUgdGhhbiBvbmNlLlxuICAgICAgdGVtcG9yYXJ5ID0gdGhpcy5hbGxvY2F0ZVRlbXBvcmFyeSgpO1xuXG4gICAgICAvLyBQcmVzZXJ2ZSB0aGUgcmVzdWx0IGluIHRoZSB0ZW1wb3JhcnkgdmFyaWFibGVcbiAgICAgIGd1YXJkZWRFeHByZXNzaW9uID0gdGVtcG9yYXJ5LnNldChndWFyZGVkRXhwcmVzc2lvbik7XG5cbiAgICAgIC8vIEVuc3VyZSBhbGwgZnVydGhlciByZWZlcmVuY2VzIHRvIHRoZSBndWFyZGVkIGV4cHJlc3Npb24gcmVmZXIgdG8gdGhlIHRlbXBvcmFyeSBpbnN0ZWFkLlxuICAgICAgdGhpcy5fcmVzdWx0TWFwLnNldChsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIHRlbXBvcmFyeSk7XG4gICAgfVxuICAgIGNvbnN0IGNvbmRpdGlvbiA9IGd1YXJkZWRFeHByZXNzaW9uLmlzQmxhbmsoKTtcblxuICAgIC8vIENvbnZlcnQgdGhlIGFzdCB0byBhbiB1bmd1YXJkZWQgYWNjZXNzIHRvIHRoZSByZWNlaXZlcidzIG1lbWJlci4gVGhlIG1hcCB3aWxsIHN1YnN0aXR1dGVcbiAgICAvLyBsZWZ0TW9zdE5vZGUgd2l0aCBpdHMgdW5ndWFyZGVkIHZlcnNpb24gaW4gdGhlIGNhbGwgdG8gYHRoaXMudmlzaXQoKWAuXG4gICAgaWYgKGxlZnRNb3N0U2FmZSBpbnN0YW5jZW9mIGNkQXN0LlNhZmVNZXRob2RDYWxsKSB7XG4gICAgICB0aGlzLl9ub2RlTWFwLnNldChcbiAgICAgICAgICBsZWZ0TW9zdFNhZmUsXG4gICAgICAgICAgbmV3IGNkQXN0Lk1ldGhvZENhbGwoXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5zcGFuLCBsZWZ0TW9zdFNhZmUuc291cmNlU3BhbiwgbGVmdE1vc3RTYWZlLm5hbWVTcGFuLFxuICAgICAgICAgICAgICBsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIGxlZnRNb3N0U2FmZS5uYW1lLCBsZWZ0TW9zdFNhZmUuYXJncykpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ub2RlTWFwLnNldChcbiAgICAgICAgICBsZWZ0TW9zdFNhZmUsXG4gICAgICAgICAgbmV3IGNkQXN0LlByb3BlcnR5UmVhZChcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLnNwYW4sIGxlZnRNb3N0U2FmZS5zb3VyY2VTcGFuLCBsZWZ0TW9zdFNhZmUubmFtZVNwYW4sXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgbGVmdE1vc3RTYWZlLm5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBSZWN1cnNpdmVseSBjb252ZXJ0IHRoZSBub2RlIG5vdyB3aXRob3V0IHRoZSBndWFyZGVkIG1lbWJlciBhY2Nlc3MuXG4gICAgY29uc3QgYWNjZXNzID0gdGhpcy5fdmlzaXQoYXN0LCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICAgIC8vIFJlbW92ZSB0aGUgbWFwcGluZy4gVGhpcyBpcyBub3Qgc3RyaWN0bHkgcmVxdWlyZWQgYXMgdGhlIGNvbnZlcnRlciBvbmx5IHRyYXZlcnNlcyBlYWNoIG5vZGVcbiAgICAvLyBvbmNlIGJ1dCBpcyBzYWZlciBpZiB0aGUgY29udmVyc2lvbiBpcyBjaGFuZ2VkIHRvIHRyYXZlcnNlIHRoZSBub2RlcyBtb3JlIHRoYW4gb25jZS5cbiAgICB0aGlzLl9ub2RlTWFwLmRlbGV0ZShsZWZ0TW9zdFNhZmUpO1xuXG4gICAgLy8gSWYgd2UgYWxsb2NhdGVkIGEgdGVtcG9yYXJ5LCByZWxlYXNlIGl0LlxuICAgIGlmICh0ZW1wb3JhcnkpIHtcbiAgICAgIHRoaXMucmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3JhcnkpO1xuICAgIH1cblxuICAgIC8vIFByb2R1Y2UgdGhlIGNvbmRpdGlvbmFsXG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGNvbmRpdGlvbi5jb25kaXRpb25hbChvLmxpdGVyYWwobnVsbCksIGFjY2VzcykpO1xuICB9XG5cbiAgLy8gR2l2ZW4gYW4gZXhwcmVzc2lvbiBvZiB0aGUgZm9ybSBhPy5iLmM/LmQuZSB0aGVuIHRoZSBsZWZ0IG1vc3Qgc2FmZSBub2RlIGlzXG4gIC8vIHRoZSAoYT8uYikuIFRoZSAuIGFuZCA/LiBhcmUgbGVmdCBhc3NvY2lhdGl2ZSB0aHVzIGNhbiBiZSByZXdyaXR0ZW4gYXM6XG4gIC8vICgoKChhPy5jKS5iKS5jKT8uZCkuZS4gVGhpcyByZXR1cm5zIHRoZSBtb3N0IGRlZXBseSBuZXN0ZWQgc2FmZSByZWFkIG9yXG4gIC8vIHNhZmUgbWV0aG9kIGNhbGwgYXMgdGhpcyBuZWVkcyB0byBiZSB0cmFuc2Zvcm1lZCBpbml0aWFsbHkgdG86XG4gIC8vICAgYSA9PSBudWxsID8gbnVsbCA6IGEuYy5iLmM/LmQuZVxuICAvLyB0aGVuIHRvOlxuICAvLyAgIGEgPT0gbnVsbCA/IG51bGwgOiBhLmIuYyA9PSBudWxsID8gbnVsbCA6IGEuYi5jLmQuZVxuICBwcml2YXRlIGxlZnRNb3N0U2FmZU5vZGUoYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkfGNkQXN0LlNhZmVNZXRob2RDYWxsIHtcbiAgICBjb25zdCB2aXNpdCA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVCk6IGFueSA9PiB7XG4gICAgICByZXR1cm4gKHRoaXMuX25vZGVNYXAuZ2V0KGFzdCkgfHwgYXN0KS52aXNpdCh2aXNpdG9yKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRDaGFpbihhc3Q6IGNkQXN0LkNoYWluKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBjZEFzdC5Db25kaXRpb25hbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IGNkQXN0LkZ1bmN0aW9uQ2FsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5vYmopO1xuICAgICAgfSxcbiAgICAgIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IGNkQXN0LktleWVkV3JpdGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRMaXRlcmFsTWFwKGFzdDogY2RBc3QuTGl0ZXJhbE1hcCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBjZEFzdC5MaXRlcmFsUHJpbWl0aXZlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IGNkQXN0Lk1ldGhvZENhbGwpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcmVmaXhOb3QoYXN0OiBjZEFzdC5QcmVmaXhOb3QpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlByb3BlcnR5UmVhZCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBjZEFzdC5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UXVvdGUoYXN0OiBjZEFzdC5RdW90ZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogY2RBc3QuU2FmZU1ldGhvZENhbGwpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcikgfHwgYXN0O1xuICAgICAgfSxcbiAgICAgIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWQpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcikgfHwgYXN0O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0cnVlIG9mIHRoZSBBU1QgaW5jbHVkZXMgYSBtZXRob2Qgb3IgYSBwaXBlIGluZGljYXRpbmcgdGhhdCwgaWYgdGhlXG4gIC8vIGV4cHJlc3Npb24gaXMgdXNlZCBhcyB0aGUgdGFyZ2V0IG9mIGEgc2FmZSBwcm9wZXJ0eSBvciBtZXRob2QgYWNjZXNzIHRoZW5cbiAgLy8gdGhlIGV4cHJlc3Npb24gc2hvdWxkIGJlIHN0b3JlZCBpbnRvIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICBwcml2YXRlIG5lZWRzVGVtcG9yYXJ5KGFzdDogY2RBc3QuQVNUKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdmlzaXQgPSAodmlzaXRvcjogY2RBc3QuQXN0VmlzaXRvciwgYXN0OiBjZEFzdC5BU1QpOiBib29sZWFuID0+IHtcbiAgICAgIHJldHVybiBhc3QgJiYgKHRoaXMuX25vZGVNYXAuZ2V0KGFzdCkgfHwgYXN0KS52aXNpdCh2aXNpdG9yKTtcbiAgICB9O1xuICAgIGNvbnN0IHZpc2l0U29tZSA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVFtdKTogYm9vbGVhbiA9PiB7XG4gICAgICByZXR1cm4gYXN0LnNvbWUoYXN0ID0+IHZpc2l0KHZpc2l0b3IsIGFzdCkpO1xuICAgIH07XG4gICAgcmV0dXJuIGFzdC52aXNpdCh7XG4gICAgICB2aXNpdEJpbmFyeShhc3Q6IGNkQXN0LkJpbmFyeSk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmxlZnQpIHx8IHZpc2l0KHRoaXMsIGFzdC5yaWdodCk7XG4gICAgICB9LFxuICAgICAgdmlzaXRDaGFpbihhc3Q6IGNkQXN0LkNoYWluKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdENvbmRpdGlvbmFsKGFzdDogY2RBc3QuQ29uZGl0aW9uYWwpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5jb25kaXRpb24pIHx8IHZpc2l0KHRoaXMsIGFzdC50cnVlRXhwKSB8fCB2aXNpdCh0aGlzLCBhc3QuZmFsc2VFeHApO1xuICAgICAgfSxcbiAgICAgIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogY2RBc3QuRnVuY3Rpb25DYWxsKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0U29tZSh0aGlzLCBhc3QuZXhwcmVzc2lvbnMpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0S2V5ZWRSZWFkKGFzdDogY2RBc3QuS2V5ZWRSZWFkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IGNkQXN0Lk1ldGhvZENhbGwpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICAgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcmVmaXhOb3QoYXN0OiBjZEFzdC5QcmVmaXhOb3QpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5leHByZXNzaW9uKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBjZEFzdC5QcmVmaXhOb3QpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5leHByZXNzaW9uKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlByb3BlcnR5UmVhZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogY2RBc3QuUHJvcGVydHlXcml0ZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRRdW90ZShhc3Q6IGNkQXN0LlF1b3RlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogY2RBc3QuU2FmZU1ldGhvZENhbGwpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogY2RBc3QuU2FmZVByb3BlcnR5UmVhZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlVGVtcG9yYXJ5KCk6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IHRlbXBOdW1iZXIgPSB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5Kys7XG4gICAgdGhpcy50ZW1wb3JhcnlDb3VudCA9IE1hdGgubWF4KHRoaXMuX2N1cnJlbnRUZW1wb3JhcnksIHRoaXMudGVtcG9yYXJ5Q291bnQpO1xuICAgIHJldHVybiBuZXcgby5SZWFkVmFyRXhwcih0ZW1wb3JhcnlOYW1lKHRoaXMuYmluZGluZ0lkLCB0ZW1wTnVtYmVyKSk7XG4gIH1cblxuICBwcml2YXRlIHJlbGVhc2VUZW1wb3JhcnkodGVtcG9yYXJ5OiBvLlJlYWRWYXJFeHByKSB7XG4gICAgdGhpcy5fY3VycmVudFRlbXBvcmFyeS0tO1xuICAgIGlmICh0ZW1wb3JhcnkubmFtZSAhPSB0ZW1wb3JhcnlOYW1lKHRoaXMuYmluZGluZ0lkLCB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUZW1wb3JhcnkgJHt0ZW1wb3JhcnkubmFtZX0gcmVsZWFzZWQgb3V0IG9mIG9yZGVyYCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYWJzb2x1dGUgYFBhcnNlU291cmNlU3BhbmAgZnJvbSB0aGUgcmVsYXRpdmUgYFBhcnNlU3BhbmAuXG4gICAqXG4gICAqIGBQYXJzZVNwYW5gIG9iamVjdHMgYXJlIHJlbGF0aXZlIHRvIHRoZSBzdGFydCBvZiB0aGUgZXhwcmVzc2lvbi5cbiAgICogVGhpcyBtZXRob2QgY29udmVydHMgdGhlc2UgdG8gZnVsbCBgUGFyc2VTb3VyY2VTcGFuYCBvYmplY3RzIHRoYXRcbiAgICogc2hvdyB3aGVyZSB0aGUgc3BhbiBpcyB3aXRoaW4gdGhlIG92ZXJhbGwgc291cmNlIGZpbGUuXG4gICAqXG4gICAqIEBwYXJhbSBzcGFuIHRoZSByZWxhdGl2ZSBzcGFuIHRvIGNvbnZlcnQuXG4gICAqIEByZXR1cm5zIGEgYFBhcnNlU291cmNlU3BhbmAgZm9yIHRoZSBnaXZlbiBzcGFuIG9yIG51bGwgaWYgbm9cbiAgICogYGJhc2VTb3VyY2VTcGFuYCB3YXMgcHJvdmlkZWQgdG8gdGhpcyBjbGFzcy5cbiAgICovXG4gIHByaXZhdGUgY29udmVydFNvdXJjZVNwYW4oc3BhbjogY2RBc3QuUGFyc2VTcGFuKSB7XG4gICAgaWYgKHRoaXMuYmFzZVNvdXJjZVNwYW4pIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5iYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5zdGFydCk7XG4gICAgICBjb25zdCBlbmQgPSB0aGlzLmJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLmVuZCk7XG4gICAgICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqIEFkZHMgdGhlIG5hbWUgb2YgYW4gQVNUIHRvIHRoZSBsaXN0IG9mIGltcGxpY2l0IHJlY2VpdmVyIGFjY2Vzc2VzLiAqL1xuICBwcml2YXRlIGFkZEltcGxpY2l0UmVjZWl2ZXJBY2Nlc3MobmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzKSB7XG4gICAgICB0aGlzLmltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcy5hZGQobmFtZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZsYXR0ZW5TdGF0ZW1lbnRzKGFyZzogYW55LCBvdXRwdXQ6IG8uU3RhdGVtZW50W10pIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICg8YW55W10+YXJnKS5mb3JFYWNoKChlbnRyeSkgPT4gZmxhdHRlblN0YXRlbWVudHMoZW50cnksIG91dHB1dCkpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dC5wdXNoKGFyZyk7XG4gIH1cbn1cblxuY2xhc3MgRGVmYXVsdExvY2FsUmVzb2x2ZXIgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHt9XG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBpZiAobmFtZSA9PT0gRXZlbnRIYW5kbGVyVmFycy5ldmVudC5uYW1lKSB7XG4gICAgICByZXR1cm4gRXZlbnRIYW5kbGVyVmFycy5ldmVudDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQ3VyclZhbHVlRXhwcihiaW5kaW5nSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICByZXR1cm4gby52YXJpYWJsZShgY3VyclZhbF8ke2JpbmRpbmdJZH1gKTsgIC8vIGZpeCBzeW50YXggaGlnaGxpZ2h0aW5nOiBgXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVByZXZlbnREZWZhdWx0VmFyKGJpbmRpbmdJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gIHJldHVybiBvLnZhcmlhYmxlKGBwZF8ke2JpbmRpbmdJZH1gKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFN0bXRJbnRvRXhwcmVzc2lvbihzdG10OiBvLlN0YXRlbWVudCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQpIHtcbiAgICByZXR1cm4gc3RtdC5leHByO1xuICB9IGVsc2UgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLlJldHVyblN0YXRlbWVudCkge1xuICAgIHJldHVybiBzdG10LnZhbHVlO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgQnVpbHRpbkZ1bmN0aW9uQ2FsbCBleHRlbmRzIGNkQXN0LkZ1bmN0aW9uQ2FsbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgc3BhbjogY2RBc3QuUGFyc2VTcGFuLCBzb3VyY2VTcGFuOiBjZEFzdC5BYnNvbHV0ZVNvdXJjZVNwYW4sIHB1YmxpYyBhcmdzOiBjZEFzdC5BU1RbXSxcbiAgICAgIHB1YmxpYyBjb252ZXJ0ZXI6IEJ1aWx0aW5Db252ZXJ0ZXIpIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuLCBudWxsLCBhcmdzKTtcbiAgfVxufVxuIl19