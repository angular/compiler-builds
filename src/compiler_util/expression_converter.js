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
        define("@angular/compiler/src/compiler_util/expression_converter", ["require", "exports", "tslib", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BuiltinFunctionCall = exports.convertUpdateArguments = exports.convertPropertyBinding = exports.BindingForm = exports.ConvertPropertyBindingResult = exports.convertPropertyBindingBuiltins = exports.convertActionBinding = exports.ConvertActionBindingResult = exports.EventHandlerVars = void 0;
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
    function convertActionBinding(localResolver, implicitReceiver, action, bindingId, interpolationFunction, baseSourceSpan, implicitReceiverAccesses, globals) {
        if (!localResolver) {
            localResolver = new DefaultLocalResolver(globals);
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
        // Inlines assignment of temporaries into the generated expression. The result may still
        // have statements attached for declarations of temporary variables.
        // This is the only relevant form for Ivy, the other forms are only used in ViewEngine.
        BindingForm[BindingForm["Expression"] = 2] = "Expression";
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
        var visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, interpolationFunction);
        var outputExpr = expressionWithoutBuiltins.visit(visitor, _Mode.Expression);
        var stmts = getStatementsFromVisitor(visitor, bindingId);
        if (visitor.usesImplicitReceiver) {
            localResolver.notifyImplicitReceiverUse();
        }
        if (visitor.temporaryCount === 0 && form == BindingForm.TrySimple) {
            return new ConvertPropertyBindingResult([], outputExpr);
        }
        else if (form === BindingForm.Expression) {
            return new ConvertPropertyBindingResult(stmts, outputExpr);
        }
        var currValExpr = createCurrValueExpr(bindingId);
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
        return new o.DeclareVarStmt(temporaryName(bindingId, temporaryNumber));
    }
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
            var args = tslib_1.__spreadArray([ast.exp], tslib_1.__read(ast.args)).map(function (ast) { return ast.visit(_this, context); });
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
        _AstToIrVisitor.prototype.visitUnary = function (ast, mode) {
            var op;
            switch (ast.operator) {
                case '+':
                    op = o.UnaryOperator.Plus;
                    break;
                case '-':
                    op = o.UnaryOperator.Minus;
                    break;
                default:
                    throw new Error("Unsupported operator " + ast.operator);
            }
            return convertToStatementIfNeeded(mode, new o.UnaryOperatorExpr(op, this._visit(ast.expr, _Mode.Expression), undefined, this.convertSourceSpan(ast.span)));
        };
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
                case '??':
                    return this.convertNullishCoalesce(ast, mode);
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
        _AstToIrVisitor.prototype.visitImplicitReceiver = function (ast, mode) {
            ensureExpressionMode(mode, ast);
            this.usesImplicitReceiver = true;
            return this._implicitReceiver;
        };
        _AstToIrVisitor.prototype.visitThisReceiver = function (ast, mode) {
            return this.visitImplicitReceiver(ast, mode);
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
                return convertToStatementIfNeeded(mode, this._visit(ast.receiver, _Mode.Expression).key(this._visit(ast.key, _Mode.Expression)));
            }
        };
        _AstToIrVisitor.prototype.visitKeyedWrite = function (ast, mode) {
            var obj = this._visit(ast.receiver, _Mode.Expression);
            var key = this._visit(ast.key, _Mode.Expression);
            var value = this._visit(ast.value, _Mode.Expression);
            if (obj === this._implicitReceiver) {
                this._localResolver.maybeRestoreView();
            }
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
        _AstToIrVisitor.prototype._getLocal = function (name, receiver) {
            var _a;
            if (((_a = this._localResolver.globals) === null || _a === void 0 ? void 0 : _a.has(name)) && receiver instanceof cdAst.ThisReceiver) {
                return null;
            }
            return this._localResolver.getLocal(name);
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
                    result = this._getLocal(ast.name, ast.receiver);
                    if (result) {
                        // Restore the previous "usesImplicitReceiver" state since the implicit
                        // receiver has been replaced with a resolved local expression.
                        this.usesImplicitReceiver = prevUsesImplicitReceiver;
                        this.addImplicitReceiverAccess(ast.name);
                    }
                }
                if (result == null) {
                    result = receiver.prop(ast.name, this.convertSourceSpan(ast.span));
                }
                return convertToStatementIfNeeded(mode, result);
            }
        };
        _AstToIrVisitor.prototype.visitPropertyWrite = function (ast, mode) {
            var receiver = this._visit(ast.receiver, _Mode.Expression);
            var prevUsesImplicitReceiver = this.usesImplicitReceiver;
            var varExpr = null;
            if (receiver === this._implicitReceiver) {
                var localExpr = this._getLocal(ast.name, ast.receiver);
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
                varExpr = receiver.prop(ast.name, this.convertSourceSpan(ast.span));
            }
            return convertToStatementIfNeeded(mode, varExpr.set(this._visit(ast.value, _Mode.Expression)));
        };
        _AstToIrVisitor.prototype.visitSafePropertyRead = function (ast, mode) {
            return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
        };
        _AstToIrVisitor.prototype.visitSafeKeyedRead = function (ast, mode) {
            return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
        };
        _AstToIrVisitor.prototype.visitAll = function (asts, mode) {
            var _this = this;
            return asts.map(function (ast) { return _this._visit(ast, mode); });
        };
        _AstToIrVisitor.prototype.visitQuote = function (ast, mode) {
            throw new Error("Quotes are not supported for evaluation!\n        Statement: " + ast.uninterpretedExpression + " located at " + ast.location);
        };
        _AstToIrVisitor.prototype.visitCall = function (ast, mode) {
            var convertedArgs = this.visitAll(ast.args, _Mode.Expression);
            if (ast instanceof BuiltinFunctionCall) {
                return convertToStatementIfNeeded(mode, ast.converter(convertedArgs));
            }
            var receiver = ast.receiver;
            if (receiver instanceof cdAst.PropertyRead &&
                receiver.receiver instanceof cdAst.ImplicitReceiver &&
                !(receiver.receiver instanceof cdAst.ThisReceiver) && receiver.name === '$any') {
                if (convertedArgs.length !== 1) {
                    throw new Error("Invalid call to $any, expected 1 argument but received " + (convertedArgs.length || 'none'));
                }
                return convertedArgs[0]
                    .cast(o.DYNAMIC_TYPE, this.convertSourceSpan(ast.span));
            }
            var leftMostSafe = this.leftMostSafeNode(ast);
            if (leftMostSafe) {
                return this.convertSafeAccess(ast, leftMostSafe, mode);
            }
            var call = this._visit(receiver, _Mode.Expression)
                .callFn(convertedArgs, this.convertSourceSpan(ast.span));
            return convertToStatementIfNeeded(mode, call);
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
            if (this.needsTemporaryInSafeAccess(leftMostSafe.receiver)) {
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
            if (leftMostSafe instanceof cdAst.SafeKeyedRead) {
                this._nodeMap.set(leftMostSafe, new cdAst.KeyedRead(leftMostSafe.span, leftMostSafe.sourceSpan, leftMostSafe.receiver, leftMostSafe.key));
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
            return convertToStatementIfNeeded(mode, condition.conditional(o.NULL_EXPR, access));
        };
        _AstToIrVisitor.prototype.convertNullishCoalesce = function (ast, mode) {
            var left = this._visit(ast.left, _Mode.Expression);
            var right = this._visit(ast.right, _Mode.Expression);
            var temporary = this.allocateTemporary();
            this.releaseTemporary(temporary);
            // Generate the following expression. It is identical to how TS
            // transpiles binary expressions with a nullish coalescing operator.
            // let temp;
            // (temp = a) !== null && temp !== undefined ? temp : b;
            return convertToStatementIfNeeded(mode, temporary.set(left)
                .notIdentical(o.NULL_EXPR)
                .and(temporary.notIdentical(o.literal(undefined)))
                .conditional(temporary, right));
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
                visitUnary: function (ast) {
                    return null;
                },
                visitBinary: function (ast) {
                    return null;
                },
                visitChain: function (ast) {
                    return null;
                },
                visitConditional: function (ast) {
                    return null;
                },
                visitCall: function (ast) {
                    return visit(this, ast.receiver);
                },
                visitImplicitReceiver: function (ast) {
                    return null;
                },
                visitThisReceiver: function (ast) {
                    return null;
                },
                visitInterpolation: function (ast) {
                    return null;
                },
                visitKeyedRead: function (ast) {
                    return visit(this, ast.receiver);
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
                visitSafePropertyRead: function (ast) {
                    return visit(this, ast.receiver) || ast;
                },
                visitSafeKeyedRead: function (ast) {
                    return visit(this, ast.receiver) || ast;
                }
            });
        };
        // Returns true of the AST includes a method or a pipe indicating that, if the
        // expression is used as the target of a safe property or method access then
        // the expression should be stored into a temporary variable.
        _AstToIrVisitor.prototype.needsTemporaryInSafeAccess = function (ast) {
            var _this = this;
            var visit = function (visitor, ast) {
                return ast && (_this._nodeMap.get(ast) || ast).visit(visitor);
            };
            var visitSome = function (visitor, ast) {
                return ast.some(function (ast) { return visit(visitor, ast); });
            };
            return ast.visit({
                visitUnary: function (ast) {
                    return visit(this, ast.expr);
                },
                visitBinary: function (ast) {
                    return visit(this, ast.left) || visit(this, ast.right);
                },
                visitChain: function (ast) {
                    return false;
                },
                visitConditional: function (ast) {
                    return visit(this, ast.condition) || visit(this, ast.trueExp) || visit(this, ast.falseExp);
                },
                visitCall: function (ast) {
                    return true;
                },
                visitImplicitReceiver: function (ast) {
                    return false;
                },
                visitThisReceiver: function (ast) {
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
                visitSafePropertyRead: function (ast) {
                    return false;
                },
                visitSafeKeyedRead: function (ast) {
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
                var fullStart = this.baseSourceSpan.fullStart.moveBy(span.start);
                return new parse_util_1.ParseSourceSpan(start, end, fullStart);
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
        function DefaultLocalResolver(globals) {
            this.globals = globals;
        }
        DefaultLocalResolver.prototype.notifyImplicitReceiverUse = function () { };
        DefaultLocalResolver.prototype.maybeRestoreView = function () { };
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
            var _this = _super.call(this, span, sourceSpan, new cdAst.EmptyExpr(span, sourceSpan), args, null) || this;
            _this.converter = converter;
            return _this;
        }
        return BuiltinFunctionCall;
    }(cdAst.Call));
    exports.BuiltinFunctionCall = BuiltinFunctionCall;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbl9jb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbUVBQWtEO0lBQ2xELGlFQUEyQztJQUMzQywyREFBMEM7SUFDMUMsK0RBQThDO0lBRTlDO1FBQUE7UUFFQSxDQUFDO1FBRFEsc0JBQUssR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3RDLHVCQUFDO0tBQUEsQUFGRCxJQUVDO0lBRlksNENBQWdCO0lBVzdCO1FBS0U7UUFDSTs7V0FFRztRQUNJLEtBQW9CO1FBQzNCOztXQUVHO1FBQ0ksWUFBMkI7WUFKM0IsVUFBSyxHQUFMLEtBQUssQ0FBZTtZQUlwQixpQkFBWSxHQUFaLFlBQVksQ0FBZTtZQUNwQzs7Ozs7Ozs7Ozs7Ozs7OztlQWdCRztZQUNILHNFQUFzRTtZQUN0RSxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxTQUFzQjtnQkFDbkQsSUFBSSxTQUFTLFlBQVksQ0FBQyxDQUFDLGNBQWMsSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLFlBQVksQ0FBQyxJQUFJO29CQUM1RSxTQUFTLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsRUFBRTtvQkFDbkQsSUFBTSxHQUFHLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFpQixDQUFDO29CQUM5QyxPQUFPLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3pDO2dCQUNELE9BQU8sU0FBUyxDQUFDO1lBQ25CLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNILGlDQUFDO0lBQUQsQ0FBQyxBQXpD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eXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNkQXN0IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGNsYXNzIEV2ZW50SGFuZGxlclZhcnMge1xuICBzdGF0aWMgZXZlbnQgPSBvLnZhcmlhYmxlKCckZXZlbnQnKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMb2NhbFJlc29sdmVyIHtcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGw7XG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZDtcbiAgZ2xvYmFscz86IFNldDxzdHJpbmc+O1xuICBtYXliZVJlc3RvcmVWaWV3KCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBDb252ZXJ0QWN0aW9uQmluZGluZ1Jlc3VsdCB7XG4gIC8qKlxuICAgKiBTdG9yZSBzdGF0ZW1lbnRzIHdoaWNoIGFyZSByZW5kZXIzIGNvbXBhdGlibGUuXG4gICAqL1xuICByZW5kZXIzU3RtdHM6IG8uU3RhdGVtZW50W107XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgLyoqXG4gICAgICAgKiBSZW5kZXIyIGNvbXBhdGlibGUgc3RhdGVtZW50cyxcbiAgICAgICAqL1xuICAgICAgcHVibGljIHN0bXRzOiBvLlN0YXRlbWVudFtdLFxuICAgICAgLyoqXG4gICAgICAgKiBWYXJpYWJsZSBuYW1lIHVzZWQgd2l0aCByZW5kZXIyIGNvbXBhdGlibGUgc3RhdGVtZW50cy5cbiAgICAgICAqL1xuICAgICAgcHVibGljIGFsbG93RGVmYXVsdDogby5SZWFkVmFyRXhwcikge1xuICAgIC8qKlxuICAgICAqIFRoaXMgaXMgYml0IG9mIGEgaGFjay4gSXQgY29udmVydHMgc3RhdGVtZW50cyB3aGljaCByZW5kZXIyIGV4cGVjdHMgdG8gc3RhdGVtZW50cyB3aGljaCBhcmVcbiAgICAgKiBleHBlY3RlZCBieSByZW5kZXIzLlxuICAgICAqXG4gICAgICogRXhhbXBsZTogYDxkaXYgY2xpY2s9XCJkb1NvbWV0aGluZygkZXZlbnQpXCI+YCB3aWxsIGdlbmVyYXRlOlxuICAgICAqXG4gICAgICogUmVuZGVyMzpcbiAgICAgKiBgYGBcbiAgICAgKiBjb25zdCBwZF9iOmFueSA9ICgoPGFueT5jdHguZG9Tb21ldGhpbmcoJGV2ZW50KSkgIT09IGZhbHNlKTtcbiAgICAgKiByZXR1cm4gcGRfYjtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIGJ1dCByZW5kZXIyIGV4cGVjdHM6XG4gICAgICogYGBgXG4gICAgICogcmV0dXJuIGN0eC5kb1NvbWV0aGluZygkZXZlbnQpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIC8vIFRPRE8obWlza28pOiByZW1vdmUgdGhpcyBoYWNrIG9uY2Ugd2Ugbm8gbG9uZ2VyIHN1cHBvcnQgVmlld0VuZ2luZS5cbiAgICB0aGlzLnJlbmRlcjNTdG10cyA9IHN0bXRzLm1hcCgoc3RhdGVtZW50OiBvLlN0YXRlbWVudCkgPT4ge1xuICAgICAgaWYgKHN0YXRlbWVudCBpbnN0YW5jZW9mIG8uRGVjbGFyZVZhclN0bXQgJiYgc3RhdGVtZW50Lm5hbWUgPT0gYWxsb3dEZWZhdWx0Lm5hbWUgJiZcbiAgICAgICAgICBzdGF0ZW1lbnQudmFsdWUgaW5zdGFuY2VvZiBvLkJpbmFyeU9wZXJhdG9yRXhwcikge1xuICAgICAgICBjb25zdCBsaHMgPSBzdGF0ZW1lbnQudmFsdWUubGhzIGFzIG8uQ2FzdEV4cHI7XG4gICAgICAgIHJldHVybiBuZXcgby5SZXR1cm5TdGF0ZW1lbnQobGhzLnZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdGF0ZW1lbnQ7XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgSW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiBvLkV4cHJlc3Npb247XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIGV4cHJlc3Npb24gQVNUIGludG8gYW4gZXhlY3V0YWJsZSBvdXRwdXQgQVNULCBhc3N1bWluZyB0aGUgZXhwcmVzc2lvbiBpc1xuICogdXNlZCBpbiBhbiBhY3Rpb24gYmluZGluZyAoZS5nLiBhbiBldmVudCBoYW5kbGVyKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXJ8bnVsbCwgaW1wbGljaXRSZWNlaXZlcjogby5FeHByZXNzaW9uLCBhY3Rpb246IGNkQXN0LkFTVCxcbiAgICBiaW5kaW5nSWQ6IHN0cmluZywgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uPzogSW50ZXJwb2xhdGlvbkZ1bmN0aW9uLFxuICAgIGJhc2VTb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuLCBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXM/OiBTZXQ8c3RyaW5nPixcbiAgICBnbG9iYWxzPzogU2V0PHN0cmluZz4pOiBDb252ZXJ0QWN0aW9uQmluZGluZ1Jlc3VsdCB7XG4gIGlmICghbG9jYWxSZXNvbHZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIgPSBuZXcgRGVmYXVsdExvY2FsUmVzb2x2ZXIoZ2xvYmFscyk7XG4gIH1cbiAgY29uc3QgYWN0aW9uV2l0aG91dEJ1aWx0aW5zID0gY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgICAge1xuICAgICAgICBjcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXI6IChhcmdDb3VudDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgLy8gTm90ZTogbm8gY2FjaGluZyBmb3IgbGl0ZXJhbCBhcnJheXMgaW4gYWN0aW9ucy5cbiAgICAgICAgICByZXR1cm4gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiBvLmxpdGVyYWxBcnIoYXJncyk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZUxpdGVyYWxNYXBDb252ZXJ0ZXI6IChrZXlzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbn1bXSkgPT4ge1xuICAgICAgICAgIC8vIE5vdGU6IG5vIGNhY2hpbmcgZm9yIGxpdGVyYWwgbWFwcyBpbiBhY3Rpb25zLlxuICAgICAgICAgIHJldHVybiAodmFsdWVzOiBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZW50cmllcyA9IGtleXMubWFwKChrLCBpKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrLmtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZXNbaV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdW90ZWQ6IGsucXVvdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHJldHVybiBvLmxpdGVyYWxNYXAoZW50cmllcyk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlUGlwZUNvbnZlcnRlcjogKG5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBTdGF0ZTogQWN0aW9ucyBhcmUgbm90IGFsbG93ZWQgdG8gY29udGFpbiBwaXBlcy4gUGlwZTogJHtuYW1lfWApO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYWN0aW9uKTtcblxuICBjb25zdCB2aXNpdG9yID0gbmV3IF9Bc3RUb0lyVmlzaXRvcihcbiAgICAgIGxvY2FsUmVzb2x2ZXIsIGltcGxpY2l0UmVjZWl2ZXIsIGJpbmRpbmdJZCwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uLCBiYXNlU291cmNlU3BhbixcbiAgICAgIGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcyk7XG4gIGNvbnN0IGFjdGlvblN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZsYXR0ZW5TdGF0ZW1lbnRzKGFjdGlvbldpdGhvdXRCdWlsdGlucy52aXNpdCh2aXNpdG9yLCBfTW9kZS5TdGF0ZW1lbnQpLCBhY3Rpb25TdG10cyk7XG4gIHByZXBlbmRUZW1wb3JhcnlEZWNscyh2aXNpdG9yLnRlbXBvcmFyeUNvdW50LCBiaW5kaW5nSWQsIGFjdGlvblN0bXRzKTtcblxuICBpZiAodmlzaXRvci51c2VzSW1wbGljaXRSZWNlaXZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIubm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpO1xuICB9XG5cbiAgY29uc3QgbGFzdEluZGV4ID0gYWN0aW9uU3RtdHMubGVuZ3RoIC0gMTtcbiAgbGV0IHByZXZlbnREZWZhdWx0VmFyOiBvLlJlYWRWYXJFeHByID0gbnVsbCE7XG4gIGlmIChsYXN0SW5kZXggPj0gMCkge1xuICAgIGNvbnN0IGxhc3RTdGF0ZW1lbnQgPSBhY3Rpb25TdG10c1tsYXN0SW5kZXhdO1xuICAgIGNvbnN0IHJldHVybkV4cHIgPSBjb252ZXJ0U3RtdEludG9FeHByZXNzaW9uKGxhc3RTdGF0ZW1lbnQpO1xuICAgIGlmIChyZXR1cm5FeHByKSB7XG4gICAgICAvLyBOb3RlOiBXZSBuZWVkIHRvIGNhc3QgdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIGNhbGwgdG8gZHluYW1pYyxcbiAgICAgIC8vIGFzIGl0IG1pZ2h0IGJlIGEgdm9pZCBtZXRob2QhXG4gICAgICBwcmV2ZW50RGVmYXVsdFZhciA9IGNyZWF0ZVByZXZlbnREZWZhdWx0VmFyKGJpbmRpbmdJZCk7XG4gICAgICBhY3Rpb25TdG10c1tsYXN0SW5kZXhdID1cbiAgICAgICAgICBwcmV2ZW50RGVmYXVsdFZhci5zZXQocmV0dXJuRXhwci5jYXN0KG8uRFlOQU1JQ19UWVBFKS5ub3RJZGVudGljYWwoby5saXRlcmFsKGZhbHNlKSkpXG4gICAgICAgICAgICAgIC50b0RlY2xTdG10KG51bGwsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmV3IENvbnZlcnRBY3Rpb25CaW5kaW5nUmVzdWx0KGFjdGlvblN0bXRzLCBwcmV2ZW50RGVmYXVsdFZhcik7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbHRpbkNvbnZlcnRlciB7XG4gIChhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsdGluQ29udmVydGVyRmFjdG9yeSB7XG4gIGNyZWF0ZUxpdGVyYWxBcnJheUNvbnZlcnRlcihhcmdDb3VudDogbnVtYmVyKTogQnVpbHRpbkNvbnZlcnRlcjtcbiAgY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcihrZXlzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbn1bXSk6IEJ1aWx0aW5Db252ZXJ0ZXI7XG4gIGNyZWF0ZVBpcGVDb252ZXJ0ZXIobmFtZTogc3RyaW5nLCBhcmdDb3VudDogbnVtYmVyKTogQnVpbHRpbkNvbnZlcnRlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGlucyhcbiAgICBjb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSwgYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5BU1Qge1xuICByZXR1cm4gY29udmVydEJ1aWx0aW5zKGNvbnZlcnRlckZhY3RvcnksIGFzdCk7XG59XG5cbmV4cG9ydCBjbGFzcyBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHN0bXRzOiBvLlN0YXRlbWVudFtdLCBwdWJsaWMgY3VyclZhbEV4cHI6IG8uRXhwcmVzc2lvbikge31cbn1cblxuZXhwb3J0IGVudW0gQmluZGluZ0Zvcm0ge1xuICAvLyBUaGUgZ2VuZXJhbCBmb3JtIG9mIGJpbmRpbmcgZXhwcmVzc2lvbiwgc3VwcG9ydHMgYWxsIGV4cHJlc3Npb25zLlxuICBHZW5lcmFsLFxuXG4gIC8vIFRyeSB0byBnZW5lcmF0ZSBhIHNpbXBsZSBiaW5kaW5nIChubyB0ZW1wb3JhcmllcyBvciBzdGF0ZW1lbnRzKVxuICAvLyBvdGhlcndpc2UgZ2VuZXJhdGUgYSBnZW5lcmFsIGJpbmRpbmdcbiAgVHJ5U2ltcGxlLFxuXG4gIC8vIElubGluZXMgYXNzaWdubWVudCBvZiB0ZW1wb3JhcmllcyBpbnRvIHRoZSBnZW5lcmF0ZWQgZXhwcmVzc2lvbi4gVGhlIHJlc3VsdCBtYXkgc3RpbGxcbiAgLy8gaGF2ZSBzdGF0ZW1lbnRzIGF0dGFjaGVkIGZvciBkZWNsYXJhdGlvbnMgb2YgdGVtcG9yYXJ5IHZhcmlhYmxlcy5cbiAgLy8gVGhpcyBpcyB0aGUgb25seSByZWxldmFudCBmb3JtIGZvciBJdnksIHRoZSBvdGhlciBmb3JtcyBhcmUgb25seSB1c2VkIGluIFZpZXdFbmdpbmUuXG4gIEV4cHJlc3Npb24sXG59XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIGV4cHJlc3Npb24gQVNUIGludG8gYW4gZXhlY3V0YWJsZSBvdXRwdXQgQVNULCBhc3N1bWluZyB0aGUgZXhwcmVzc2lvblxuICogaXMgdXNlZCBpbiBwcm9wZXJ0eSBiaW5kaW5nLiBUaGUgZXhwcmVzc2lvbiBoYXMgdG8gYmUgcHJlcHJvY2Vzc2VkIHZpYVxuICogYGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGluc2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXJ8bnVsbCwgaW1wbGljaXRSZWNlaXZlcjogby5FeHByZXNzaW9uLFxuICAgIGV4cHJlc3Npb25XaXRob3V0QnVpbHRpbnM6IGNkQXN0LkFTVCwgYmluZGluZ0lkOiBzdHJpbmcsIGZvcm06IEJpbmRpbmdGb3JtLFxuICAgIGludGVycG9sYXRpb25GdW5jdGlvbj86IEludGVycG9sYXRpb25GdW5jdGlvbik6IENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQge1xuICBpZiAoIWxvY2FsUmVzb2x2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyID0gbmV3IERlZmF1bHRMb2NhbFJlc29sdmVyKCk7XG4gIH1cbiAgY29uc3QgdmlzaXRvciA9XG4gICAgICBuZXcgX0FzdFRvSXJWaXNpdG9yKGxvY2FsUmVzb2x2ZXIsIGltcGxpY2l0UmVjZWl2ZXIsIGJpbmRpbmdJZCwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgY29uc3Qgb3V0cHV0RXhwcjogby5FeHByZXNzaW9uID0gZXhwcmVzc2lvbldpdGhvdXRCdWlsdGlucy52aXNpdCh2aXNpdG9yLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgY29uc3Qgc3RtdHM6IG8uU3RhdGVtZW50W10gPSBnZXRTdGF0ZW1lbnRzRnJvbVZpc2l0b3IodmlzaXRvciwgYmluZGluZ0lkKTtcblxuICBpZiAodmlzaXRvci51c2VzSW1wbGljaXRSZWNlaXZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIubm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpO1xuICB9XG5cbiAgaWYgKHZpc2l0b3IudGVtcG9yYXJ5Q291bnQgPT09IDAgJiYgZm9ybSA9PSBCaW5kaW5nRm9ybS5UcnlTaW1wbGUpIHtcbiAgICByZXR1cm4gbmV3IENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQoW10sIG91dHB1dEV4cHIpO1xuICB9IGVsc2UgaWYgKGZvcm0gPT09IEJpbmRpbmdGb3JtLkV4cHJlc3Npb24pIHtcbiAgICByZXR1cm4gbmV3IENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQoc3RtdHMsIG91dHB1dEV4cHIpO1xuICB9XG5cbiAgY29uc3QgY3VyclZhbEV4cHIgPSBjcmVhdGVDdXJyVmFsdWVFeHByKGJpbmRpbmdJZCk7XG4gIHN0bXRzLnB1c2goY3VyclZhbEV4cHIuc2V0KG91dHB1dEV4cHIpLnRvRGVjbFN0bXQoby5EWU5BTUlDX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgcmV0dXJuIG5ldyBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0KHN0bXRzLCBjdXJyVmFsRXhwcik7XG59XG5cbi8qKlxuICogR2l2ZW4gc29tZSBleHByZXNzaW9uLCBzdWNoIGFzIGEgYmluZGluZyBvciBpbnRlcnBvbGF0aW9uIGV4cHJlc3Npb24sIGFuZCBhIGNvbnRleHQgZXhwcmVzc2lvbiB0b1xuICogbG9vayB2YWx1ZXMgdXAgb24sIHZpc2l0IGVhY2ggZmFjZXQgb2YgdGhlIGdpdmVuIGV4cHJlc3Npb24gcmVzb2x2aW5nIHZhbHVlcyBmcm9tIHRoZSBjb250ZXh0XG4gKiBleHByZXNzaW9uIHN1Y2ggdGhhdCBhIGxpc3Qgb2YgYXJndW1lbnRzIGNhbiBiZSBkZXJpdmVkIGZyb20gdGhlIGZvdW5kIHZhbHVlcyB0aGF0IGNhbiBiZSB1c2VkIGFzXG4gKiBhcmd1bWVudHMgdG8gYW4gZXh0ZXJuYWwgdXBkYXRlIGluc3RydWN0aW9uLlxuICpcbiAqIEBwYXJhbSBsb2NhbFJlc29sdmVyIFRoZSByZXNvbHZlciB0byB1c2UgdG8gbG9vayB1cCBleHByZXNzaW9ucyBieSBuYW1lIGFwcHJvcHJpYXRlbHlcbiAqIEBwYXJhbSBjb250ZXh0VmFyaWFibGVFeHByZXNzaW9uIFRoZSBleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGUgY29udGV4dCB2YXJpYWJsZSB1c2VkIHRvIGNyZWF0ZVxuICogdGhlIGZpbmFsIGFyZ3VtZW50IGV4cHJlc3Npb25zXG4gKiBAcGFyYW0gZXhwcmVzc2lvbldpdGhBcmd1bWVudHNUb0V4dHJhY3QgVGhlIGV4cHJlc3Npb24gdG8gdmlzaXQgdG8gZmlndXJlIG91dCB3aGF0IHZhbHVlcyBuZWVkIHRvXG4gKiBiZSByZXNvbHZlZCBhbmQgd2hhdCBhcmd1bWVudHMgbGlzdCB0byBidWlsZC5cbiAqIEBwYXJhbSBiaW5kaW5nSWQgQSBuYW1lIHByZWZpeCB1c2VkIHRvIGNyZWF0ZSB0ZW1wb3JhcnkgdmFyaWFibGUgbmFtZXMgaWYgdGhleSdyZSBuZWVkZWQgZm9yIHRoZVxuICogYXJndW1lbnRzIGdlbmVyYXRlZFxuICogQHJldHVybnMgQW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgdGhhdCBjYW4gYmUgcGFzc2VkIGFzIGFyZ3VtZW50cyB0byBpbnN0cnVjdGlvbiBleHByZXNzaW9ucyBsaWtlXG4gKiBgby5pbXBvcnRFeHByKFIzLnByb3BlcnR5SW50ZXJwb2xhdGUpLmNhbGxGbihyZXN1bHQpYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFVwZGF0ZUFyZ3VtZW50cyhcbiAgICBsb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyLCBjb250ZXh0VmFyaWFibGVFeHByZXNzaW9uOiBvLkV4cHJlc3Npb24sXG4gICAgZXhwcmVzc2lvbldpdGhBcmd1bWVudHNUb0V4dHJhY3Q6IGNkQXN0LkFTVCwgYmluZGluZ0lkOiBzdHJpbmcpIHtcbiAgY29uc3QgdmlzaXRvciA9XG4gICAgICBuZXcgX0FzdFRvSXJWaXNpdG9yKGxvY2FsUmVzb2x2ZXIsIGNvbnRleHRWYXJpYWJsZUV4cHJlc3Npb24sIGJpbmRpbmdJZCwgdW5kZWZpbmVkKTtcbiAgY29uc3Qgb3V0cHV0RXhwcjogby5JbnZva2VGdW5jdGlvbkV4cHIgPVxuICAgICAgZXhwcmVzc2lvbldpdGhBcmd1bWVudHNUb0V4dHJhY3QudmlzaXQodmlzaXRvciwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgaWYgKHZpc2l0b3IudXNlc0ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTtcbiAgfVxuXG4gIGNvbnN0IHN0bXRzID0gZ2V0U3RhdGVtZW50c0Zyb21WaXNpdG9yKHZpc2l0b3IsIGJpbmRpbmdJZCk7XG5cbiAgLy8gUmVtb3ZpbmcgdGhlIGZpcnN0IGFyZ3VtZW50LCBiZWNhdXNlIGl0IHdhcyBhIGxlbmd0aCBmb3IgVmlld0VuZ2luZSwgbm90IEl2eS5cbiAgbGV0IGFyZ3MgPSBvdXRwdXRFeHByLmFyZ3Muc2xpY2UoMSk7XG4gIGlmIChleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdCBpbnN0YW5jZW9mIGNkQXN0LkludGVycG9sYXRpb24pIHtcbiAgICAvLyBJZiB3ZSdyZSBkZWFsaW5nIHdpdGggYW4gaW50ZXJwb2xhdGlvbiBvZiAxIHZhbHVlIHdpdGggYW4gZW1wdHkgcHJlZml4IGFuZCBzdWZmaXgsIHJlZHVjZSB0aGVcbiAgICAvLyBhcmdzIHJldHVybmVkIHRvIGp1c3QgdGhlIHZhbHVlLCBiZWNhdXNlIHdlJ3JlIGdvaW5nIHRvIHBhc3MgaXQgdG8gYSBzcGVjaWFsIGluc3RydWN0aW9uLlxuICAgIGNvbnN0IHN0cmluZ3MgPSBleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdC5zdHJpbmdzO1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMyAmJiBzdHJpbmdzWzBdID09PSAnJyAmJiBzdHJpbmdzWzFdID09PSAnJykge1xuICAgICAgLy8gU2luZ2xlIGFyZ3VtZW50IGludGVycG9sYXRlIGluc3RydWN0aW9ucy5cbiAgICAgIGFyZ3MgPSBbYXJnc1sxXV07XG4gICAgfSBlbHNlIGlmIChhcmdzLmxlbmd0aCA+PSAxOSkge1xuICAgICAgLy8gMTkgb3IgbW9yZSBhcmd1bWVudHMgbXVzdCBiZSBwYXNzZWQgdG8gdGhlIGBpbnRlcnBvbGF0ZVZgLXN0eWxlIGluc3RydWN0aW9ucywgd2hpY2ggYWNjZXB0XG4gICAgICAvLyBhbiBhcnJheSBvZiBhcmd1bWVudHNcbiAgICAgIGFyZ3MgPSBbby5saXRlcmFsQXJyKGFyZ3MpXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHtzdG10cywgYXJnc307XG59XG5cbmZ1bmN0aW9uIGdldFN0YXRlbWVudHNGcm9tVmlzaXRvcih2aXNpdG9yOiBfQXN0VG9JclZpc2l0b3IsIGJpbmRpbmdJZDogc3RyaW5nKSB7XG4gIGNvbnN0IHN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmlzaXRvci50ZW1wb3JhcnlDb3VudDsgaSsrKSB7XG4gICAgc3RtdHMucHVzaCh0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQsIGkpKTtcbiAgfVxuICByZXR1cm4gc3RtdHM7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRCdWlsdGlucyhjb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSwgYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5BU1Qge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9CdWlsdGluQXN0Q29udmVydGVyKGNvbnZlcnRlckZhY3RvcnkpO1xuICByZXR1cm4gYXN0LnZpc2l0KHZpc2l0b3IpO1xufVxuXG5mdW5jdGlvbiB0ZW1wb3JhcnlOYW1lKGJpbmRpbmdJZDogc3RyaW5nLCB0ZW1wb3JhcnlOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBgdG1wXyR7YmluZGluZ0lkfV8ke3RlbXBvcmFyeU51bWJlcn1gO1xufVxuXG5mdW5jdGlvbiB0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQ6IHN0cmluZywgdGVtcG9yYXJ5TnVtYmVyOiBudW1iZXIpOiBvLlN0YXRlbWVudCB7XG4gIHJldHVybiBuZXcgby5EZWNsYXJlVmFyU3RtdCh0ZW1wb3JhcnlOYW1lKGJpbmRpbmdJZCwgdGVtcG9yYXJ5TnVtYmVyKSk7XG59XG5cbmZ1bmN0aW9uIHByZXBlbmRUZW1wb3JhcnlEZWNscyhcbiAgICB0ZW1wb3JhcnlDb3VudDogbnVtYmVyLCBiaW5kaW5nSWQ6IHN0cmluZywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSkge1xuICBmb3IgKGxldCBpID0gdGVtcG9yYXJ5Q291bnQgLSAxOyBpID49IDA7IGktLSkge1xuICAgIHN0YXRlbWVudHMudW5zaGlmdCh0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQsIGkpKTtcbiAgfVxufVxuXG5lbnVtIF9Nb2RlIHtcbiAgU3RhdGVtZW50LFxuICBFeHByZXNzaW9uXG59XG5cbmZ1bmN0aW9uIGVuc3VyZVN0YXRlbWVudE1vZGUobW9kZTogX01vZGUsIGFzdDogY2RBc3QuQVNUKSB7XG4gIGlmIChtb2RlICE9PSBfTW9kZS5TdGF0ZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGEgc3RhdGVtZW50LCBidXQgc2F3ICR7YXN0fWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGU6IF9Nb2RlLCBhc3Q6IGNkQXN0LkFTVCkge1xuICBpZiAobW9kZSAhPT0gX01vZGUuRXhwcmVzc2lvbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYW4gZXhwcmVzc2lvbiwgYnV0IHNhdyAke2FzdH1gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlOiBfTW9kZSwgZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50IHtcbiAgaWYgKG1vZGUgPT09IF9Nb2RlLlN0YXRlbWVudCkge1xuICAgIHJldHVybiBleHByLnRvU3RtdCgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbmNsYXNzIF9CdWlsdGluQXN0Q29udmVydGVyIGV4dGVuZHMgY2RBc3QuQXN0VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9jb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSkge1xuICAgIHN1cGVyKCk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IFthc3QuZXhwLCAuLi5hc3QuYXJnc10ubWFwKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhcmdzLFxuICAgICAgICB0aGlzLl9jb252ZXJ0ZXJGYWN0b3J5LmNyZWF0ZVBpcGVDb252ZXJ0ZXIoYXN0Lm5hbWUsIGFyZ3MubGVuZ3RoKSk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IGFzdC5leHByZXNzaW9ucy5tYXAoYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFyZ3MsXG4gICAgICAgIHRoaXMuX2NvbnZlcnRlckZhY3RvcnkuY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyKGFzdC5leHByZXNzaW9ucy5sZW5ndGgpKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSBhc3QudmFsdWVzLm1hcChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcblxuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhcmdzLCB0aGlzLl9jb252ZXJ0ZXJGYWN0b3J5LmNyZWF0ZUxpdGVyYWxNYXBDb252ZXJ0ZXIoYXN0LmtleXMpKTtcbiAgfVxufVxuXG5jbGFzcyBfQXN0VG9JclZpc2l0b3IgaW1wbGVtZW50cyBjZEFzdC5Bc3RWaXNpdG9yIHtcbiAgcHJpdmF0ZSBfbm9kZU1hcCA9IG5ldyBNYXA8Y2RBc3QuQVNULCBjZEFzdC5BU1Q+KCk7XG4gIHByaXZhdGUgX3Jlc3VsdE1hcCA9IG5ldyBNYXA8Y2RBc3QuQVNULCBvLkV4cHJlc3Npb24+KCk7XG4gIHByaXZhdGUgX2N1cnJlbnRUZW1wb3Jhcnk6IG51bWJlciA9IDA7XG4gIHB1YmxpYyB0ZW1wb3JhcnlDb3VudDogbnVtYmVyID0gMDtcbiAgcHVibGljIHVzZXNJbXBsaWNpdFJlY2VpdmVyOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9sb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyLCBwcml2YXRlIF9pbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sXG4gICAgICBwcml2YXRlIGJpbmRpbmdJZDogc3RyaW5nLCBwcml2YXRlIGludGVycG9sYXRpb25GdW5jdGlvbjogSW50ZXJwb2xhdGlvbkZ1bmN0aW9ufHVuZGVmaW5lZCxcbiAgICAgIHByaXZhdGUgYmFzZVNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4sIHByaXZhdGUgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzPzogU2V0PHN0cmluZz4pIHt9XG5cbiAgdmlzaXRVbmFyeShhc3Q6IGNkQXN0LlVuYXJ5LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgbGV0IG9wOiBvLlVuYXJ5T3BlcmF0b3I7XG4gICAgc3dpdGNoIChhc3Qub3BlcmF0b3IpIHtcbiAgICAgIGNhc2UgJysnOlxuICAgICAgICBvcCA9IG8uVW5hcnlPcGVyYXRvci5QbHVzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy0nOlxuICAgICAgICBvcCA9IG8uVW5hcnlPcGVyYXRvci5NaW51cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cblxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSxcbiAgICAgICAgbmV3IG8uVW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICBvcCwgdGhpcy5fdmlzaXQoYXN0LmV4cHIsIF9Nb2RlLkV4cHJlc3Npb24pLCB1bmRlZmluZWQsXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSkpO1xuICB9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBsZXQgb3A6IG8uQmluYXJ5T3BlcmF0b3I7XG4gICAgc3dpdGNoIChhc3Qub3BlcmF0aW9uKSB7XG4gICAgICBjYXNlICcrJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLlBsdXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5NaW51cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcqJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk11bHRpcGx5O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy8nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuRGl2aWRlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyUnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTW9kdWxvO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyYmJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkFuZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd8fCc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5PcjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc9PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5FcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnIT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz09PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5JZGVudGljYWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnIT09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk5vdElkZW50aWNhbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc8JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz4nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz49JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc/Pyc6XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnZlcnROdWxsaXNoQ29hbGVzY2UoYXN0LCBtb2RlKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgb3BlcmF0aW9uICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIG9wLCB0aGlzLl92aXNpdChhc3QubGVmdCwgX01vZGUuRXhwcmVzc2lvbiksIHRoaXMuX3Zpc2l0KGFzdC5yaWdodCwgX01vZGUuRXhwcmVzc2lvbiksXG4gICAgICAgICAgICB1bmRlZmluZWQsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4sIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVTdGF0ZW1lbnRNb2RlKG1vZGUsIGFzdCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zLCBtb2RlKTtcbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBjZEFzdC5Db25kaXRpb25hbCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IHZhbHVlOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QuY29uZGl0aW9uLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIHZhbHVlLmNvbmRpdGlvbmFsKFxuICAgICAgICAgICAgdGhpcy5fdmlzaXQoYXN0LnRydWVFeHAsIF9Nb2RlLkV4cHJlc3Npb24pLCB0aGlzLl92aXNpdChhc3QuZmFsc2VFeHAsIF9Nb2RlLkV4cHJlc3Npb24pLFxuICAgICAgICAgICAgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpKTtcbiAgfVxuXG4gIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgSWxsZWdhbCBzdGF0ZTogUGlwZXMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnMuIFBpcGU6ICR7YXN0Lm5hbWV9YCk7XG4gIH1cblxuICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgZW5zdXJlRXhwcmVzc2lvbk1vZGUobW9kZSwgYXN0KTtcbiAgICB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlcjtcbiAgfVxuXG4gIHZpc2l0VGhpc1JlY2VpdmVyKGFzdDogY2RBc3QuVGhpc1JlY2VpdmVyLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdCwgbW9kZSk7XG4gIH1cblxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBjZEFzdC5JbnRlcnBvbGF0aW9uLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgZW5zdXJlRXhwcmVzc2lvbk1vZGUobW9kZSwgYXN0KTtcbiAgICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChhc3QuZXhwcmVzc2lvbnMubGVuZ3RoKV07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3Quc3RyaW5ncy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoYXN0LnN0cmluZ3NbaV0pKTtcbiAgICAgIGFyZ3MucHVzaCh0aGlzLl92aXNpdChhc3QuZXhwcmVzc2lvbnNbaV0sIF9Nb2RlLkV4cHJlc3Npb24pKTtcbiAgICB9XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChhc3Quc3RyaW5nc1thc3Quc3RyaW5ncy5sZW5ndGggLSAxXSkpO1xuXG4gICAgaWYgKHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24oYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBhc3QuZXhwcmVzc2lvbnMubGVuZ3RoIDw9IDkgP1xuICAgICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW5saW5lSW50ZXJwb2xhdGUpLmNhbGxGbihhcmdzKSA6XG4gICAgICAgIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5pbnRlcnBvbGF0ZSkuY2FsbEZuKFtcbiAgICAgICAgICBhcmdzWzBdLCBvLmxpdGVyYWxBcnIoYXJncy5zbGljZSgxKSwgdW5kZWZpbmVkLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSlcbiAgICAgICAgXSk7XG4gIH1cblxuICB2aXNpdEtleWVkUmVhZChhc3Q6IGNkQXN0LktleWVkUmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IGxlZnRNb3N0U2FmZSA9IHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpO1xuICAgIGlmIChsZWZ0TW9zdFNhZmUpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgbGVmdE1vc3RTYWZlLCBtb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICAgIG1vZGUsXG4gICAgICAgICAgdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKS5rZXkodGhpcy5fdmlzaXQoYXN0LmtleSwgX01vZGUuRXhwcmVzc2lvbikpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3Qgb2JqOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGNvbnN0IGtleTogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LmtleSwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3QgdmFsdWU6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC52YWx1ZSwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgICBpZiAob2JqID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICB0aGlzLl9sb2NhbFJlc29sdmVyLm1heWJlUmVzdG9yZVZpZXcoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgb2JqLmtleShrZXkpLnNldCh2YWx1ZSkpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IGxpdGVyYWwgYXJyYXlzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zYCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBsaXRlcmFsIG1hcHMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnNgKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICAvLyBGb3IgbGl0ZXJhbCB2YWx1ZXMgb2YgbnVsbCwgdW5kZWZpbmVkLCB0cnVlLCBvciBmYWxzZSBhbGxvdyB0eXBlIGludGVyZmVyZW5jZVxuICAgIC8vIHRvIGluZmVyIHRoZSB0eXBlLlxuICAgIGNvbnN0IHR5cGUgPVxuICAgICAgICBhc3QudmFsdWUgPT09IG51bGwgfHwgYXN0LnZhbHVlID09PSB1bmRlZmluZWQgfHwgYXN0LnZhbHVlID09PSB0cnVlIHx8IGFzdC52YWx1ZSA9PT0gdHJ1ZSA/XG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSA6XG4gICAgICAgIHVuZGVmaW5lZDtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsIG8ubGl0ZXJhbChhc3QudmFsdWUsIHR5cGUsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICBwcml2YXRlIF9nZXRMb2NhbChuYW1lOiBzdHJpbmcsIHJlY2VpdmVyOiBjZEFzdC5BU1QpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX2xvY2FsUmVzb2x2ZXIuZ2xvYmFscz8uaGFzKG5hbWUpICYmIHJlY2VpdmVyIGluc3RhbmNlb2YgY2RBc3QuVGhpc1JlY2VpdmVyKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fbG9jYWxSZXNvbHZlci5nZXRMb2NhbChuYW1lKTtcbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG8ubm90KHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgby5hc3NlcnROb3ROdWxsKHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuICAgICAgY29uc3QgcmVjZWl2ZXIgPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgICAgaWYgKHJlY2VpdmVyID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMuX2dldExvY2FsKGFzdC5uYW1lLCBhc3QucmVjZWl2ZXIpO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgXCJ1c2VzSW1wbGljaXRSZWNlaXZlclwiIHN0YXRlIHNpbmNlIHRoZSBpbXBsaWNpdFxuICAgICAgICAgIC8vIHJlY2VpdmVyIGhhcyBiZWVuIHJlcGxhY2VkIHdpdGggYSByZXNvbHZlZCBsb2NhbCBleHByZXNzaW9uLlxuICAgICAgICAgIHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXI7XG4gICAgICAgICAgdGhpcy5hZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKGFzdC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCA9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLnByb3AoYXN0Lm5hbWUsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCByZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCByZWNlaXZlcjogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuXG4gICAgbGV0IHZhckV4cHI6IG8uUmVhZFByb3BFeHByfG51bGwgPSBudWxsO1xuICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgY29uc3QgbG9jYWxFeHByID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUsIGFzdC5yZWNlaXZlcik7XG4gICAgICBpZiAobG9jYWxFeHByKSB7XG4gICAgICAgIGlmIChsb2NhbEV4cHIgaW5zdGFuY2VvZiBvLlJlYWRQcm9wRXhwcikge1xuICAgICAgICAgIC8vIElmIHRoZSBsb2NhbCB2YXJpYWJsZSBpcyBhIHByb3BlcnR5IHJlYWQgZXhwcmVzc2lvbiwgaXQncyBhIHJlZmVyZW5jZVxuICAgICAgICAgIC8vIHRvIGEgJ2NvbnRleHQucHJvcGVydHknIHZhbHVlIGFuZCB3aWxsIGJlIHVzZWQgYXMgdGhlIHRhcmdldCBvZiB0aGVcbiAgICAgICAgICAvLyB3cml0ZSBleHByZXNzaW9uLlxuICAgICAgICAgIHZhckV4cHIgPSBsb2NhbEV4cHI7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgXCJ1c2VzSW1wbGljaXRSZWNlaXZlclwiIHN0YXRlIHNpbmNlIHRoZSBpbXBsaWNpdFxuICAgICAgICAgIC8vIHJlY2VpdmVyIGhhcyBiZWVuIHJlcGxhY2VkIHdpdGggYSByZXNvbHZlZCBsb2NhbCBleHByZXNzaW9uLlxuICAgICAgICAgIHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXI7XG4gICAgICAgICAgdGhpcy5hZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKGFzdC5uYW1lKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBPdGhlcndpc2UgaXQncyBhbiBlcnJvci5cbiAgICAgICAgICBjb25zdCByZWNlaXZlciA9IGFzdC5uYW1lO1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gKGFzdC52YWx1ZSBpbnN0YW5jZW9mIGNkQXN0LlByb3BlcnR5UmVhZCkgPyBhc3QudmFsdWUubmFtZSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBhc3NpZ24gdmFsdWUgXCIke3ZhbHVlfVwiIHRvIHRlbXBsYXRlIHZhcmlhYmxlIFwiJHtcbiAgICAgICAgICAgICAgcmVjZWl2ZXJ9XCIuIFRlbXBsYXRlIHZhcmlhYmxlcyBhcmUgcmVhZC1vbmx5LmApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIElmIG5vIGxvY2FsIGV4cHJlc3Npb24gY291bGQgYmUgcHJvZHVjZWQsIHVzZSB0aGUgb3JpZ2luYWwgcmVjZWl2ZXInc1xuICAgIC8vIHByb3BlcnR5IGFzIHRoZSB0YXJnZXQuXG4gICAgaWYgKHZhckV4cHIgPT09IG51bGwpIHtcbiAgICAgIHZhckV4cHIgPSByZWNlaXZlci5wcm9wKGFzdC5uYW1lLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSk7XG4gICAgfVxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCB2YXJFeHByLnNldCh0aGlzLl92aXNpdChhc3QudmFsdWUsIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gIH1cblxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KSwgbW9kZSk7XG4gIH1cblxuICB2aXNpdFNhZmVLZXllZFJlYWQoYXN0OiBjZEFzdC5TYWZlS2V5ZWRSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KSwgbW9kZSk7XG4gIH1cblxuICB2aXNpdEFsbChhc3RzOiBjZEFzdC5BU1RbXSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBhc3RzLm1hcChhc3QgPT4gdGhpcy5fdmlzaXQoYXN0LCBtb2RlKSk7XG4gIH1cblxuICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFF1b3RlcyBhcmUgbm90IHN1cHBvcnRlZCBmb3IgZXZhbHVhdGlvbiFcbiAgICAgICAgU3RhdGVtZW50OiAke2FzdC51bmludGVycHJldGVkRXhwcmVzc2lvbn0gbG9jYXRlZCBhdCAke2FzdC5sb2NhdGlvbn1gKTtcbiAgfVxuXG4gIHZpc2l0Q2FsbChhc3Q6IGNkQXN0LkNhbGwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgQnVpbHRpbkZ1bmN0aW9uQ2FsbCkge1xuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGFzdC5jb252ZXJ0ZXIoY29udmVydGVkQXJncykpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0LnJlY2VpdmVyO1xuICAgIGlmIChyZWNlaXZlciBpbnN0YW5jZW9mIGNkQXN0LlByb3BlcnR5UmVhZCAmJlxuICAgICAgICByZWNlaXZlci5yZWNlaXZlciBpbnN0YW5jZW9mIGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIgJiZcbiAgICAgICAgIShyZWNlaXZlci5yZWNlaXZlciBpbnN0YW5jZW9mIGNkQXN0LlRoaXNSZWNlaXZlcikgJiYgcmVjZWl2ZXIubmFtZSA9PT0gJyRhbnknKSB7XG4gICAgICBpZiAoY29udmVydGVkQXJncy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNhbGwgdG8gJGFueSwgZXhwZWN0ZWQgMSBhcmd1bWVudCBidXQgcmVjZWl2ZWQgJHtcbiAgICAgICAgICAgIGNvbnZlcnRlZEFyZ3MubGVuZ3RoIHx8ICdub25lJ31gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAoY29udmVydGVkQXJnc1swXSBhcyBvLkV4cHJlc3Npb24pXG4gICAgICAgICAgLmNhc3Qoby5EWU5BTUlDX1RZUEUsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICB9XG5cbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2FsbCA9IHRoaXMuX3Zpc2l0KHJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKVxuICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihjb252ZXJ0ZWRBcmdzLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSk7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGNhbGwpO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXQoYXN0OiBjZEFzdC5BU1QsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9yZXN1bHRNYXAuZ2V0KGFzdCk7XG4gICAgaWYgKHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICByZXR1cm4gKHRoaXMuX25vZGVNYXAuZ2V0KGFzdCkgfHwgYXN0KS52aXNpdCh0aGlzLCBtb2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydFNhZmVBY2Nlc3MoXG4gICAgICBhc3Q6IGNkQXN0LkFTVCwgbGVmdE1vc3RTYWZlOiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkfGNkQXN0LlNhZmVLZXllZFJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICAvLyBJZiB0aGUgZXhwcmVzc2lvbiBjb250YWlucyBhIHNhZmUgYWNjZXNzIG5vZGUgb24gdGhlIGxlZnQgaXQgbmVlZHMgdG8gYmUgY29udmVydGVkIHRvXG4gICAgLy8gYW4gZXhwcmVzc2lvbiB0aGF0IGd1YXJkcyB0aGUgYWNjZXNzIHRvIHRoZSBtZW1iZXIgYnkgY2hlY2tpbmcgdGhlIHJlY2VpdmVyIGZvciBibGFuay4gQXNcbiAgICAvLyBleGVjdXRpb24gcHJvY2VlZHMgZnJvbSBsZWZ0IHRvIHJpZ2h0LCB0aGUgbGVmdCBtb3N0IHBhcnQgb2YgdGhlIGV4cHJlc3Npb24gbXVzdCBiZSBndWFyZGVkXG4gICAgLy8gZmlyc3QgYnV0LCBiZWNhdXNlIG1lbWJlciBhY2Nlc3MgaXMgbGVmdCBhc3NvY2lhdGl2ZSwgdGhlIHJpZ2h0IHNpZGUgb2YgdGhlIGV4cHJlc3Npb24gaXMgYXRcbiAgICAvLyB0aGUgdG9wIG9mIHRoZSBBU1QuIFRoZSBkZXNpcmVkIHJlc3VsdCByZXF1aXJlcyBsaWZ0aW5nIGEgY29weSBvZiB0aGUgbGVmdCBwYXJ0IG9mIHRoZVxuICAgIC8vIGV4cHJlc3Npb24gdXAgdG8gdGVzdCBpdCBmb3IgYmxhbmsgYmVmb3JlIGdlbmVyYXRpbmcgdGhlIHVuZ3VhcmRlZCB2ZXJzaW9uLlxuXG4gICAgLy8gQ29uc2lkZXIsIGZvciBleGFtcGxlIHRoZSBmb2xsb3dpbmcgZXhwcmVzc2lvbjogYT8uYi5jPy5kLmVcblxuICAgIC8vIFRoaXMgcmVzdWx0cyBpbiB0aGUgYXN0OlxuICAgIC8vICAgICAgICAgLlxuICAgIC8vICAgICAgICAvIFxcXG4gICAgLy8gICAgICAgPy4gICBlXG4gICAgLy8gICAgICAvICBcXFxuICAgIC8vICAgICAuICAgIGRcbiAgICAvLyAgICAvIFxcXG4gICAgLy8gICA/LiAgY1xuICAgIC8vICAvICBcXFxuICAgIC8vIGEgICAgYlxuXG4gICAgLy8gVGhlIGZvbGxvd2luZyB0cmVlIHNob3VsZCBiZSBnZW5lcmF0ZWQ6XG4gICAgLy9cbiAgICAvLyAgICAgICAgLy0tLS0gPyAtLS0tXFxcbiAgICAvLyAgICAgICAvICAgICAgfCAgICAgIFxcXG4gICAgLy8gICAgIGEgICAvLS0tID8gLS0tXFwgIG51bGxcbiAgICAvLyAgICAgICAgLyAgICAgfCAgICAgXFxcbiAgICAvLyAgICAgICAuICAgICAgLiAgICAgbnVsbFxuICAgIC8vICAgICAgLyBcXCAgICAvIFxcXG4gICAgLy8gICAgIC4gIGMgICAuICAgZVxuICAgIC8vICAgIC8gXFwgICAgLyBcXFxuICAgIC8vICAgYSAgIGIgIC4gICBkXG4gICAgLy8gICAgICAgICAvIFxcXG4gICAgLy8gICAgICAgIC4gICBjXG4gICAgLy8gICAgICAgLyBcXFxuICAgIC8vICAgICAgYSAgIGJcbiAgICAvL1xuICAgIC8vIE5vdGljZSB0aGF0IHRoZSBmaXJzdCBndWFyZCBjb25kaXRpb24gaXMgdGhlIGxlZnQgaGFuZCBvZiB0aGUgbGVmdCBtb3N0IHNhZmUgYWNjZXNzIG5vZGVcbiAgICAvLyB3aGljaCBjb21lcyBpbiBhcyBsZWZ0TW9zdFNhZmUgdG8gdGhpcyByb3V0aW5lLlxuXG4gICAgbGV0IGd1YXJkZWRFeHByZXNzaW9uID0gdGhpcy5fdmlzaXQobGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBsZXQgdGVtcG9yYXJ5OiBvLlJlYWRWYXJFeHByID0gdW5kZWZpbmVkITtcbiAgICBpZiAodGhpcy5uZWVkc1RlbXBvcmFyeUluU2FmZUFjY2VzcyhsZWZ0TW9zdFNhZmUucmVjZWl2ZXIpKSB7XG4gICAgICAvLyBJZiB0aGUgZXhwcmVzc2lvbiBoYXMgbWV0aG9kIGNhbGxzIG9yIHBpcGVzIHRoZW4gd2UgbmVlZCB0byBzYXZlIHRoZSByZXN1bHQgaW50byBhXG4gICAgICAvLyB0ZW1wb3JhcnkgdmFyaWFibGUgdG8gYXZvaWQgY2FsbGluZyBzdGF0ZWZ1bCBvciBpbXB1cmUgY29kZSBtb3JlIHRoYW4gb25jZS5cbiAgICAgIHRlbXBvcmFyeSA9IHRoaXMuYWxsb2NhdGVUZW1wb3JhcnkoKTtcblxuICAgICAgLy8gUHJlc2VydmUgdGhlIHJlc3VsdCBpbiB0aGUgdGVtcG9yYXJ5IHZhcmlhYmxlXG4gICAgICBndWFyZGVkRXhwcmVzc2lvbiA9IHRlbXBvcmFyeS5zZXQoZ3VhcmRlZEV4cHJlc3Npb24pO1xuXG4gICAgICAvLyBFbnN1cmUgYWxsIGZ1cnRoZXIgcmVmZXJlbmNlcyB0byB0aGUgZ3VhcmRlZCBleHByZXNzaW9uIHJlZmVyIHRvIHRoZSB0ZW1wb3JhcnkgaW5zdGVhZC5cbiAgICAgIHRoaXMuX3Jlc3VsdE1hcC5zZXQobGVmdE1vc3RTYWZlLnJlY2VpdmVyLCB0ZW1wb3JhcnkpO1xuICAgIH1cbiAgICBjb25zdCBjb25kaXRpb24gPSBndWFyZGVkRXhwcmVzc2lvbi5pc0JsYW5rKCk7XG5cbiAgICAvLyBDb252ZXJ0IHRoZSBhc3QgdG8gYW4gdW5ndWFyZGVkIGFjY2VzcyB0byB0aGUgcmVjZWl2ZXIncyBtZW1iZXIuIFRoZSBtYXAgd2lsbCBzdWJzdGl0dXRlXG4gICAgLy8gbGVmdE1vc3ROb2RlIHdpdGggaXRzIHVuZ3VhcmRlZCB2ZXJzaW9uIGluIHRoZSBjYWxsIHRvIGB0aGlzLnZpc2l0KClgLlxuICAgIGlmIChsZWZ0TW9zdFNhZmUgaW5zdGFuY2VvZiBjZEFzdC5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgICB0aGlzLl9ub2RlTWFwLnNldChcbiAgICAgICAgICBsZWZ0TW9zdFNhZmUsXG4gICAgICAgICAgbmV3IGNkQXN0LktleWVkUmVhZChcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLnNwYW4sIGxlZnRNb3N0U2FmZS5zb3VyY2VTcGFuLCBsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIGxlZnRNb3N0U2FmZS5rZXkpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbm9kZU1hcC5zZXQoXG4gICAgICAgICAgbGVmdE1vc3RTYWZlLFxuICAgICAgICAgIG5ldyBjZEFzdC5Qcm9wZXJ0eVJlYWQoXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5zcGFuLCBsZWZ0TW9zdFNhZmUuc291cmNlU3BhbiwgbGVmdE1vc3RTYWZlLm5hbWVTcGFuLFxuICAgICAgICAgICAgICBsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIGxlZnRNb3N0U2FmZS5uYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gUmVjdXJzaXZlbHkgY29udmVydCB0aGUgbm9kZSBub3cgd2l0aG91dCB0aGUgZ3VhcmRlZCBtZW1iZXIgYWNjZXNzLlxuICAgIGNvbnN0IGFjY2VzcyA9IHRoaXMuX3Zpc2l0KGFzdCwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgICAvLyBSZW1vdmUgdGhlIG1hcHBpbmcuIFRoaXMgaXMgbm90IHN0cmljdGx5IHJlcXVpcmVkIGFzIHRoZSBjb252ZXJ0ZXIgb25seSB0cmF2ZXJzZXMgZWFjaCBub2RlXG4gICAgLy8gb25jZSBidXQgaXMgc2FmZXIgaWYgdGhlIGNvbnZlcnNpb24gaXMgY2hhbmdlZCB0byB0cmF2ZXJzZSB0aGUgbm9kZXMgbW9yZSB0aGFuIG9uY2UuXG4gICAgdGhpcy5fbm9kZU1hcC5kZWxldGUobGVmdE1vc3RTYWZlKTtcblxuICAgIC8vIElmIHdlIGFsbG9jYXRlZCBhIHRlbXBvcmFyeSwgcmVsZWFzZSBpdC5cbiAgICBpZiAodGVtcG9yYXJ5KSB7XG4gICAgICB0aGlzLnJlbGVhc2VUZW1wb3JhcnkodGVtcG9yYXJ5KTtcbiAgICB9XG5cbiAgICAvLyBQcm9kdWNlIHRoZSBjb25kaXRpb25hbFxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCBjb25kaXRpb24uY29uZGl0aW9uYWwoby5OVUxMX0VYUFIsIGFjY2VzcykpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0TnVsbGlzaENvYWxlc2NlKGFzdDogY2RBc3QuQmluYXJ5LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgbGVmdDogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LmxlZnQsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGNvbnN0IHJpZ2h0OiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QucmlnaHQsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRoaXMuYWxsb2NhdGVUZW1wb3JhcnkoKTtcbiAgICB0aGlzLnJlbGVhc2VUZW1wb3JhcnkodGVtcG9yYXJ5KTtcblxuICAgIC8vIEdlbmVyYXRlIHRoZSBmb2xsb3dpbmcgZXhwcmVzc2lvbi4gSXQgaXMgaWRlbnRpY2FsIHRvIGhvdyBUU1xuICAgIC8vIHRyYW5zcGlsZXMgYmluYXJ5IGV4cHJlc3Npb25zIHdpdGggYSBudWxsaXNoIGNvYWxlc2Npbmcgb3BlcmF0b3IuXG4gICAgLy8gbGV0IHRlbXA7XG4gICAgLy8gKHRlbXAgPSBhKSAhPT0gbnVsbCAmJiB0ZW1wICE9PSB1bmRlZmluZWQgPyB0ZW1wIDogYjtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIHRlbXBvcmFyeS5zZXQobGVmdClcbiAgICAgICAgICAgIC5ub3RJZGVudGljYWwoby5OVUxMX0VYUFIpXG4gICAgICAgICAgICAuYW5kKHRlbXBvcmFyeS5ub3RJZGVudGljYWwoby5saXRlcmFsKHVuZGVmaW5lZCkpKVxuICAgICAgICAgICAgLmNvbmRpdGlvbmFsKHRlbXBvcmFyeSwgcmlnaHQpKTtcbiAgfVxuXG4gIC8vIEdpdmVuIGFuIGV4cHJlc3Npb24gb2YgdGhlIGZvcm0gYT8uYi5jPy5kLmUgdGhlbiB0aGUgbGVmdCBtb3N0IHNhZmUgbm9kZSBpc1xuICAvLyB0aGUgKGE/LmIpLiBUaGUgLiBhbmQgPy4gYXJlIGxlZnQgYXNzb2NpYXRpdmUgdGh1cyBjYW4gYmUgcmV3cml0dGVuIGFzOlxuICAvLyAoKCgoYT8uYykuYikuYyk/LmQpLmUuIFRoaXMgcmV0dXJucyB0aGUgbW9zdCBkZWVwbHkgbmVzdGVkIHNhZmUgcmVhZCBvclxuICAvLyBzYWZlIG1ldGhvZCBjYWxsIGFzIHRoaXMgbmVlZHMgdG8gYmUgdHJhbnNmb3JtZWQgaW5pdGlhbGx5IHRvOlxuICAvLyAgIGEgPT0gbnVsbCA/IG51bGwgOiBhLmMuYi5jPy5kLmVcbiAgLy8gdGhlbiB0bzpcbiAgLy8gICBhID09IG51bGwgPyBudWxsIDogYS5iLmMgPT0gbnVsbCA/IG51bGwgOiBhLmIuYy5kLmVcbiAgcHJpdmF0ZSBsZWZ0TW9zdFNhZmVOb2RlKGFzdDogY2RBc3QuQVNUKTogY2RBc3QuU2FmZVByb3BlcnR5UmVhZHxjZEFzdC5TYWZlS2V5ZWRSZWFkIHtcbiAgICBjb25zdCB2aXNpdCA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVCk6IGFueSA9PiB7XG4gICAgICByZXR1cm4gKHRoaXMuX25vZGVNYXAuZ2V0KGFzdCkgfHwgYXN0KS52aXNpdCh2aXNpdG9yKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRVbmFyeShhc3Q6IGNkQXN0LlVuYXJ5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0QmluYXJ5KGFzdDogY2RBc3QuQmluYXJ5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdENvbmRpdGlvbmFsKGFzdDogY2RBc3QuQ29uZGl0aW9uYWwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRDYWxsKGFzdDogY2RBc3QuQ2FsbCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0VGhpc1JlY2VpdmVyKGFzdDogY2RBc3QuVGhpc1JlY2VpdmVyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcmVmaXhOb3QoYXN0OiBjZEFzdC5QcmVmaXhOb3QpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlByb3BlcnR5UmVhZCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBjZEFzdC5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UXVvdGUoYXN0OiBjZEFzdC5RdW90ZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVLZXllZFJlYWQoYXN0OiBjZEFzdC5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBvZiB0aGUgQVNUIGluY2x1ZGVzIGEgbWV0aG9kIG9yIGEgcGlwZSBpbmRpY2F0aW5nIHRoYXQsIGlmIHRoZVxuICAvLyBleHByZXNzaW9uIGlzIHVzZWQgYXMgdGhlIHRhcmdldCBvZiBhIHNhZmUgcHJvcGVydHkgb3IgbWV0aG9kIGFjY2VzcyB0aGVuXG4gIC8vIHRoZSBleHByZXNzaW9uIHNob3VsZCBiZSBzdG9yZWQgaW50byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgcHJpdmF0ZSBuZWVkc1RlbXBvcmFyeUluU2FmZUFjY2Vzcyhhc3Q6IGNkQXN0LkFTVCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHZpc2l0ID0gKHZpc2l0b3I6IGNkQXN0LkFzdFZpc2l0b3IsIGFzdDogY2RBc3QuQVNUKTogYm9vbGVhbiA9PiB7XG4gICAgICByZXR1cm4gYXN0ICYmICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodmlzaXRvcik7XG4gICAgfTtcbiAgICBjb25zdCB2aXNpdFNvbWUgPSAodmlzaXRvcjogY2RBc3QuQXN0VmlzaXRvciwgYXN0OiBjZEFzdC5BU1RbXSk6IGJvb2xlYW4gPT4ge1xuICAgICAgcmV0dXJuIGFzdC5zb21lKGFzdCA9PiB2aXNpdCh2aXNpdG9yLCBhc3QpKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRVbmFyeShhc3Q6IGNkQXN0LlVuYXJ5KTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QuZXhwcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnkpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5sZWZ0KSB8fCB2aXNpdCh0aGlzLCBhc3QucmlnaHQpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QuY29uZGl0aW9uKSB8fCB2aXNpdCh0aGlzLCBhc3QudHJ1ZUV4cCkgfHwgdmlzaXQodGhpcywgYXN0LmZhbHNlRXhwKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdENhbGwoYXN0OiBjZEFzdC5DYWxsKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0VGhpc1JlY2VpdmVyKGFzdDogY2RBc3QuVGhpc1JlY2VpdmVyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBjZEFzdC5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHJldHVybiB2aXNpdFNvbWUodGhpcywgYXN0LmV4cHJlc3Npb25zKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEtleWVkUmVhZChhc3Q6IGNkQXN0LktleWVkUmVhZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICAgdmlzaXRMaXRlcmFsTWFwKGFzdDogY2RBc3QuTGl0ZXJhbE1hcCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBjZEFzdC5MaXRlcmFsUHJpbWl0aXZlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByZWZpeE5vdChhc3Q6IGNkQXN0LlByZWZpeE5vdCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHJlc3Npb24pO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0LlByZWZpeE5vdCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHJlc3Npb24pO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogY2RBc3QuUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBjZEFzdC5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0U2FmZUtleWVkUmVhZChhc3Q6IGNkQXN0LlNhZmVLZXllZFJlYWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZVRlbXBvcmFyeSgpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCB0ZW1wTnVtYmVyID0gdGhpcy5fY3VycmVudFRlbXBvcmFyeSsrO1xuICAgIHRoaXMudGVtcG9yYXJ5Q291bnQgPSBNYXRoLm1heCh0aGlzLl9jdXJyZW50VGVtcG9yYXJ5LCB0aGlzLnRlbXBvcmFyeUNvdW50KTtcbiAgICByZXR1cm4gbmV3IG8uUmVhZFZhckV4cHIodGVtcG9yYXJ5TmFtZSh0aGlzLmJpbmRpbmdJZCwgdGVtcE51bWJlcikpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWxlYXNlVGVtcG9yYXJ5KHRlbXBvcmFyeTogby5SZWFkVmFyRXhwcikge1xuICAgIHRoaXMuX2N1cnJlbnRUZW1wb3JhcnktLTtcbiAgICBpZiAodGVtcG9yYXJ5Lm5hbWUgIT0gdGVtcG9yYXJ5TmFtZSh0aGlzLmJpbmRpbmdJZCwgdGhpcy5fY3VycmVudFRlbXBvcmFyeSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGVtcG9yYXJ5ICR7dGVtcG9yYXJ5Lm5hbWV9IHJlbGVhc2VkIG91dCBvZiBvcmRlcmApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFic29sdXRlIGBQYXJzZVNvdXJjZVNwYW5gIGZyb20gdGhlIHJlbGF0aXZlIGBQYXJzZVNwYW5gLlxuICAgKlxuICAgKiBgUGFyc2VTcGFuYCBvYmplY3RzIGFyZSByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIGV4cHJlc3Npb24uXG4gICAqIFRoaXMgbWV0aG9kIGNvbnZlcnRzIHRoZXNlIHRvIGZ1bGwgYFBhcnNlU291cmNlU3BhbmAgb2JqZWN0cyB0aGF0XG4gICAqIHNob3cgd2hlcmUgdGhlIHNwYW4gaXMgd2l0aGluIHRoZSBvdmVyYWxsIHNvdXJjZSBmaWxlLlxuICAgKlxuICAgKiBAcGFyYW0gc3BhbiB0aGUgcmVsYXRpdmUgc3BhbiB0byBjb252ZXJ0LlxuICAgKiBAcmV0dXJucyBhIGBQYXJzZVNvdXJjZVNwYW5gIGZvciB0aGUgZ2l2ZW4gc3BhbiBvciBudWxsIGlmIG5vXG4gICAqIGBiYXNlU291cmNlU3BhbmAgd2FzIHByb3ZpZGVkIHRvIHRoaXMgY2xhc3MuXG4gICAqL1xuICBwcml2YXRlIGNvbnZlcnRTb3VyY2VTcGFuKHNwYW46IGNkQXN0LlBhcnNlU3Bhbikge1xuICAgIGlmICh0aGlzLmJhc2VTb3VyY2VTcGFuKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICAgICAgY29uc3QgZW5kID0gdGhpcy5iYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5lbmQpO1xuICAgICAgY29uc3QgZnVsbFN0YXJ0ID0gdGhpcy5iYXNlU291cmNlU3Bhbi5mdWxsU3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICAgICAgcmV0dXJuIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCwgZnVsbFN0YXJ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqIEFkZHMgdGhlIG5hbWUgb2YgYW4gQVNUIHRvIHRoZSBsaXN0IG9mIGltcGxpY2l0IHJlY2VpdmVyIGFjY2Vzc2VzLiAqL1xuICBwcml2YXRlIGFkZEltcGxpY2l0UmVjZWl2ZXJBY2Nlc3MobmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzKSB7XG4gICAgICB0aGlzLmltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcy5hZGQobmFtZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZsYXR0ZW5TdGF0ZW1lbnRzKGFyZzogYW55LCBvdXRwdXQ6IG8uU3RhdGVtZW50W10pIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICg8YW55W10+YXJnKS5mb3JFYWNoKChlbnRyeSkgPT4gZmxhdHRlblN0YXRlbWVudHMoZW50cnksIG91dHB1dCkpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dC5wdXNoKGFyZyk7XG4gIH1cbn1cblxuY2xhc3MgRGVmYXVsdExvY2FsUmVzb2x2ZXIgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgY29uc3RydWN0b3IocHVibGljIGdsb2JhbHM/OiBTZXQ8c3RyaW5nPikge31cbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHt9XG4gIG1heWJlUmVzdG9yZVZpZXcoKTogdm9pZCB7fVxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKG5hbWUgPT09IEV2ZW50SGFuZGxlclZhcnMuZXZlbnQubmFtZSkge1xuICAgICAgcmV0dXJuIEV2ZW50SGFuZGxlclZhcnMuZXZlbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUN1cnJWYWx1ZUV4cHIoYmluZGluZ0lkOiBzdHJpbmcpOiBvLlJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG8udmFyaWFibGUoYGN1cnJWYWxfJHtiaW5kaW5nSWR9YCk7ICAvLyBmaXggc3ludGF4IGhpZ2hsaWdodGluZzogYFxufVxuXG5mdW5jdGlvbiBjcmVhdGVQcmV2ZW50RGVmYXVsdFZhcihiaW5kaW5nSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICByZXR1cm4gby52YXJpYWJsZShgcGRfJHtiaW5kaW5nSWR9YCk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRTdG10SW50b0V4cHJlc3Npb24oc3RtdDogby5TdGF0ZW1lbnQpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGlmIChzdG10IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIHN0bXQuZXhwcjtcbiAgfSBlbHNlIGlmIChzdG10IGluc3RhbmNlb2Ygby5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICByZXR1cm4gc3RtdC52YWx1ZTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGNsYXNzIEJ1aWx0aW5GdW5jdGlvbkNhbGwgZXh0ZW5kcyBjZEFzdC5DYWxsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBjZEFzdC5QYXJzZVNwYW4sIHNvdXJjZVNwYW46IGNkQXN0LkFic29sdXRlU291cmNlU3BhbiwgYXJnczogY2RBc3QuQVNUW10sXG4gICAgICBwdWJsaWMgY29udmVydGVyOiBCdWlsdGluQ29udmVydGVyKSB7XG4gICAgc3VwZXIoc3Bhbiwgc291cmNlU3BhbiwgbmV3IGNkQXN0LkVtcHR5RXhwcihzcGFuLCBzb3VyY2VTcGFuKSwgYXJncywgbnVsbCEpO1xuICB9XG59XG4iXX0=