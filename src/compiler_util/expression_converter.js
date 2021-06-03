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
        _AstToIrVisitor.prototype.visitMethodCall = function (ast, mode) {
            if (ast.receiver instanceof cdAst.ImplicitReceiver &&
                !(ast.receiver instanceof cdAst.ThisReceiver) && ast.name === '$any') {
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
                    var varExpr = this._getLocal(ast.name, ast.receiver);
                    if (varExpr) {
                        // Restore the previous "usesImplicitReceiver" state since the implicit
                        // receiver has been replaced with a resolved local expression.
                        this.usesImplicitReceiver = prevUsesImplicitReceiver;
                        result = varExpr.callFn(args);
                        this.addImplicitReceiverAccess(ast.name);
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
            if (leftMostSafe instanceof cdAst.SafeMethodCall) {
                this._nodeMap.set(leftMostSafe, new cdAst.MethodCall(leftMostSafe.span, leftMostSafe.sourceSpan, leftMostSafe.nameSpan, leftMostSafe.receiver, leftMostSafe.name, leftMostSafe.args, leftMostSafe.argumentSpan));
            }
            else if (leftMostSafe instanceof cdAst.SafeKeyedRead) {
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
                visitFunctionCall: function (ast) {
                    return null;
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
                visitFunctionCall: function (ast) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbl9jb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbUVBQWtEO0lBQ2xELGlFQUEyQztJQUMzQywyREFBMEM7SUFDMUMsK0RBQThDO0lBRTlDO1FBQUE7UUFFQSxDQUFDO1FBRFEsc0JBQUssR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3RDLHVCQUFDO0tBQUEsQUFGRCxJQUVDO0lBRlksNENBQWdCO0lBVTdCO1FBS0U7UUFDSTs7V0FFRztRQUNJLEtBQW9CO1FBQzNCOztXQUVHO1FBQ0ksWUFBMkI7WUFKM0IsVUFBSyxHQUFMLEtBQUssQ0FBZTtZQUlwQixpQkFBWSxHQUFaLFlBQVksQ0FBZTtZQUNwQzs7Ozs7Ozs7Ozs7Ozs7OztlQWdCRztZQUNILHNFQUFzRTtZQUN0RSxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxTQUFzQjtnQkFDbkQsSUFBSSxTQUFTLFlBQVksQ0FBQyxDQUFDLGNBQWMsSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLFlBQVksQ0FBQyxJQUFJO29CQUM1RSxTQUFTLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsRUFBRTtvQkFDbkQsSUFBTSxHQUFHLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFpQixDQUFDO29CQUM5QyxPQUFPLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3pDO2dCQUNELE9BQU8sU0FBUyxDQUFDO1lBQ25CLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNILGlDQUFDO0lBQUQsQ0FBQyxBQXpD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LENBQUMsQ0FBQyxtQkFBbUIsRUFBRTtZQUN6QyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7U0FDbEI7YUFBTSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsZUFBZSxFQUFFO1lBQzVDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztTQUNuQjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEO1FBQXlDLCtDQUFrQjtRQUN6RCw2QkFDSSxJQUFxQixFQUFFLFVBQW9DLEVBQVMsSUFBaUIsRUFDOUUsU0FBMkI7WUFGdEMsWUFHRSxrQkFBTSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FDcEM7WUFIdUUsVUFBSSxHQUFKLElBQUksQ0FBYTtZQUM5RSxlQUFTLEdBQVQsU0FBUyxDQUFrQjs7UUFFdEMsQ0FBQztRQUNILDBCQUFDO0lBQUQsQ0FBQyxBQU5ELENBQXlDLEtBQUssQ0FBQyxZQUFZLEdBTTFEO0lBTlksa0RBQW1CIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNkQXN0IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGNsYXNzIEV2ZW50SGFuZGxlclZhcnMge1xuICBzdGF0aWMgZXZlbnQgPSBvLnZhcmlhYmxlKCckZXZlbnQnKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMb2NhbFJlc29sdmVyIHtcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGw7XG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZDtcbiAgZ2xvYmFscz86IFNldDxzdHJpbmc+O1xufVxuXG5leHBvcnQgY2xhc3MgQ29udmVydEFjdGlvbkJpbmRpbmdSZXN1bHQge1xuICAvKipcbiAgICogU3RvcmUgc3RhdGVtZW50cyB3aGljaCBhcmUgcmVuZGVyMyBjb21wYXRpYmxlLlxuICAgKi9cbiAgcmVuZGVyM1N0bXRzOiBvLlN0YXRlbWVudFtdO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIC8qKlxuICAgICAgICogUmVuZGVyMiBjb21wYXRpYmxlIHN0YXRlbWVudHMsXG4gICAgICAgKi9cbiAgICAgIHB1YmxpYyBzdG10czogby5TdGF0ZW1lbnRbXSxcbiAgICAgIC8qKlxuICAgICAgICogVmFyaWFibGUgbmFtZSB1c2VkIHdpdGggcmVuZGVyMiBjb21wYXRpYmxlIHN0YXRlbWVudHMuXG4gICAgICAgKi9cbiAgICAgIHB1YmxpYyBhbGxvd0RlZmF1bHQ6IG8uUmVhZFZhckV4cHIpIHtcbiAgICAvKipcbiAgICAgKiBUaGlzIGlzIGJpdCBvZiBhIGhhY2suIEl0IGNvbnZlcnRzIHN0YXRlbWVudHMgd2hpY2ggcmVuZGVyMiBleHBlY3RzIHRvIHN0YXRlbWVudHMgd2hpY2ggYXJlXG4gICAgICogZXhwZWN0ZWQgYnkgcmVuZGVyMy5cbiAgICAgKlxuICAgICAqIEV4YW1wbGU6IGA8ZGl2IGNsaWNrPVwiZG9Tb21ldGhpbmcoJGV2ZW50KVwiPmAgd2lsbCBnZW5lcmF0ZTpcbiAgICAgKlxuICAgICAqIFJlbmRlcjM6XG4gICAgICogYGBgXG4gICAgICogY29uc3QgcGRfYjphbnkgPSAoKDxhbnk+Y3R4LmRvU29tZXRoaW5nKCRldmVudCkpICE9PSBmYWxzZSk7XG4gICAgICogcmV0dXJuIHBkX2I7XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBidXQgcmVuZGVyMiBleHBlY3RzOlxuICAgICAqIGBgYFxuICAgICAqIHJldHVybiBjdHguZG9Tb21ldGhpbmcoJGV2ZW50KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICAvLyBUT0RPKG1pc2tvKTogcmVtb3ZlIHRoaXMgaGFjayBvbmNlIHdlIG5vIGxvbmdlciBzdXBwb3J0IFZpZXdFbmdpbmUuXG4gICAgdGhpcy5yZW5kZXIzU3RtdHMgPSBzdG10cy5tYXAoKHN0YXRlbWVudDogby5TdGF0ZW1lbnQpID0+IHtcbiAgICAgIGlmIChzdGF0ZW1lbnQgaW5zdGFuY2VvZiBvLkRlY2xhcmVWYXJTdG10ICYmIHN0YXRlbWVudC5uYW1lID09IGFsbG93RGVmYXVsdC5uYW1lICYmXG4gICAgICAgICAgc3RhdGVtZW50LnZhbHVlIGluc3RhbmNlb2Ygby5CaW5hcnlPcGVyYXRvckV4cHIpIHtcbiAgICAgICAgY29uc3QgbGhzID0gc3RhdGVtZW50LnZhbHVlLmxocyBhcyBvLkNhc3RFeHByO1xuICAgICAgICByZXR1cm4gbmV3IG8uUmV0dXJuU3RhdGVtZW50KGxocy52YWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RhdGVtZW50O1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIEludGVycG9sYXRpb25GdW5jdGlvbiA9IChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4gby5FeHByZXNzaW9uO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBnaXZlbiBleHByZXNzaW9uIEFTVCBpbnRvIGFuIGV4ZWN1dGFibGUgb3V0cHV0IEFTVCwgYXNzdW1pbmcgdGhlIGV4cHJlc3Npb24gaXNcbiAqIHVzZWQgaW4gYW4gYWN0aW9uIGJpbmRpbmcgKGUuZy4gYW4gZXZlbnQgaGFuZGxlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICBsb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyfG51bGwsIGltcGxpY2l0UmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiwgYWN0aW9uOiBjZEFzdC5BU1QsXG4gICAgYmluZGluZ0lkOiBzdHJpbmcsIGludGVycG9sYXRpb25GdW5jdGlvbj86IEludGVycG9sYXRpb25GdW5jdGlvbixcbiAgICBiYXNlU291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiwgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzPzogU2V0PHN0cmluZz4sXG4gICAgZ2xvYmFscz86IFNldDxzdHJpbmc+KTogQ29udmVydEFjdGlvbkJpbmRpbmdSZXN1bHQge1xuICBpZiAoIWxvY2FsUmVzb2x2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyID0gbmV3IERlZmF1bHRMb2NhbFJlc29sdmVyKGdsb2JhbHMpO1xuICB9XG4gIGNvbnN0IGFjdGlvbldpdGhvdXRCdWlsdGlucyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGlucyhcbiAgICAgIHtcbiAgICAgICAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyOiAoYXJnQ291bnQ6IG51bWJlcikgPT4ge1xuICAgICAgICAgIC8vIE5vdGU6IG5vIGNhY2hpbmcgZm9yIGxpdGVyYWwgYXJyYXlzIGluIGFjdGlvbnMuXG4gICAgICAgICAgcmV0dXJuIChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4gby5saXRlcmFsQXJyKGFyZ3MpO1xuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyOiAoa2V5czoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW59W10pID0+IHtcbiAgICAgICAgICAvLyBOb3RlOiBubyBjYWNoaW5nIGZvciBsaXRlcmFsIG1hcHMgaW4gYWN0aW9ucy5cbiAgICAgICAgICByZXR1cm4gKHZhbHVlczogby5FeHByZXNzaW9uW10pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSBrZXlzLm1hcCgoaywgaSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleTogay5rZXksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVzW2ldLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcXVvdGVkOiBrLnF1b3RlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICByZXR1cm4gby5saXRlcmFsTWFwKGVudHJpZXMpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZVBpcGVDb252ZXJ0ZXI6IChuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IEFjdGlvbnMgYXJlIG5vdCBhbGxvd2VkIHRvIGNvbnRhaW4gcGlwZXMuIFBpcGU6ICR7bmFtZX1gKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGFjdGlvbik7XG5cbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfQXN0VG9JclZpc2l0b3IoXG4gICAgICBsb2NhbFJlc29sdmVyLCBpbXBsaWNpdFJlY2VpdmVyLCBiaW5kaW5nSWQsIGludGVycG9sYXRpb25GdW5jdGlvbiwgYmFzZVNvdXJjZVNwYW4sXG4gICAgICBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMpO1xuICBjb25zdCBhY3Rpb25TdG10czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBmbGF0dGVuU3RhdGVtZW50cyhhY3Rpb25XaXRob3V0QnVpbHRpbnMudmlzaXQodmlzaXRvciwgX01vZGUuU3RhdGVtZW50KSwgYWN0aW9uU3RtdHMpO1xuICBwcmVwZW5kVGVtcG9yYXJ5RGVjbHModmlzaXRvci50ZW1wb3JhcnlDb3VudCwgYmluZGluZ0lkLCBhY3Rpb25TdG10cyk7XG5cbiAgaWYgKHZpc2l0b3IudXNlc0ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTtcbiAgfVxuXG4gIGNvbnN0IGxhc3RJbmRleCA9IGFjdGlvblN0bXRzLmxlbmd0aCAtIDE7XG4gIGxldCBwcmV2ZW50RGVmYXVsdFZhcjogby5SZWFkVmFyRXhwciA9IG51bGwhO1xuICBpZiAobGFzdEluZGV4ID49IDApIHtcbiAgICBjb25zdCBsYXN0U3RhdGVtZW50ID0gYWN0aW9uU3RtdHNbbGFzdEluZGV4XTtcbiAgICBjb25zdCByZXR1cm5FeHByID0gY29udmVydFN0bXRJbnRvRXhwcmVzc2lvbihsYXN0U3RhdGVtZW50KTtcbiAgICBpZiAocmV0dXJuRXhwcikge1xuICAgICAgLy8gTm90ZTogV2UgbmVlZCB0byBjYXN0IHRoZSByZXN1bHQgb2YgdGhlIG1ldGhvZCBjYWxsIHRvIGR5bmFtaWMsXG4gICAgICAvLyBhcyBpdCBtaWdodCBiZSBhIHZvaWQgbWV0aG9kIVxuICAgICAgcHJldmVudERlZmF1bHRWYXIgPSBjcmVhdGVQcmV2ZW50RGVmYXVsdFZhcihiaW5kaW5nSWQpO1xuICAgICAgYWN0aW9uU3RtdHNbbGFzdEluZGV4XSA9XG4gICAgICAgICAgcHJldmVudERlZmF1bHRWYXIuc2V0KHJldHVybkV4cHIuY2FzdChvLkRZTkFNSUNfVFlQRSkubm90SWRlbnRpY2FsKG8ubGl0ZXJhbChmYWxzZSkpKVxuICAgICAgICAgICAgICAudG9EZWNsU3RtdChudWxsLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5ldyBDb252ZXJ0QWN0aW9uQmluZGluZ1Jlc3VsdChhY3Rpb25TdG10cywgcHJldmVudERlZmF1bHRWYXIpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0aW5Db252ZXJ0ZXIge1xuICAoYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbHRpbkNvbnZlcnRlckZhY3Rvcnkge1xuICBjcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXIoYXJnQ291bnQ6IG51bWJlcik6IEJ1aWx0aW5Db252ZXJ0ZXI7XG4gIGNyZWF0ZUxpdGVyYWxNYXBDb252ZXJ0ZXIoa2V5czoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW59W10pOiBCdWlsdGluQ29udmVydGVyO1xuICBjcmVhdGVQaXBlQ29udmVydGVyKG5hbWU6IHN0cmluZywgYXJnQ291bnQ6IG51bWJlcik6IEJ1aWx0aW5Db252ZXJ0ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnMoXG4gICAgY29udmVydGVyRmFjdG9yeTogQnVpbHRpbkNvbnZlcnRlckZhY3RvcnksIGFzdDogY2RBc3QuQVNUKTogY2RBc3QuQVNUIHtcbiAgcmV0dXJuIGNvbnZlcnRCdWlsdGlucyhjb252ZXJ0ZXJGYWN0b3J5LCBhc3QpO1xufVxuXG5leHBvcnQgY2xhc3MgQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzdG10czogby5TdGF0ZW1lbnRbXSwgcHVibGljIGN1cnJWYWxFeHByOiBvLkV4cHJlc3Npb24pIHt9XG59XG5cbmV4cG9ydCBlbnVtIEJpbmRpbmdGb3JtIHtcbiAgLy8gVGhlIGdlbmVyYWwgZm9ybSBvZiBiaW5kaW5nIGV4cHJlc3Npb24sIHN1cHBvcnRzIGFsbCBleHByZXNzaW9ucy5cbiAgR2VuZXJhbCxcblxuICAvLyBUcnkgdG8gZ2VuZXJhdGUgYSBzaW1wbGUgYmluZGluZyAobm8gdGVtcG9yYXJpZXMgb3Igc3RhdGVtZW50cylcbiAgLy8gb3RoZXJ3aXNlIGdlbmVyYXRlIGEgZ2VuZXJhbCBiaW5kaW5nXG4gIFRyeVNpbXBsZSxcblxuICAvLyBJbmxpbmVzIGFzc2lnbm1lbnQgb2YgdGVtcG9yYXJpZXMgaW50byB0aGUgZ2VuZXJhdGVkIGV4cHJlc3Npb24uIFRoZSByZXN1bHQgbWF5IHN0aWxsXG4gIC8vIGhhdmUgc3RhdGVtZW50cyBhdHRhY2hlZCBmb3IgZGVjbGFyYXRpb25zIG9mIHRlbXBvcmFyeSB2YXJpYWJsZXMuXG4gIC8vIFRoaXMgaXMgdGhlIG9ubHkgcmVsZXZhbnQgZm9ybSBmb3IgSXZ5LCB0aGUgb3RoZXIgZm9ybXMgYXJlIG9ubHkgdXNlZCBpbiBWaWV3RW5naW5lLlxuICBFeHByZXNzaW9uLFxufVxuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBnaXZlbiBleHByZXNzaW9uIEFTVCBpbnRvIGFuIGV4ZWN1dGFibGUgb3V0cHV0IEFTVCwgYXNzdW1pbmcgdGhlIGV4cHJlc3Npb25cbiAqIGlzIHVzZWQgaW4gcHJvcGVydHkgYmluZGluZy4gVGhlIGV4cHJlc3Npb24gaGFzIHRvIGJlIHByZXByb2Nlc3NlZCB2aWFcbiAqIGBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnNgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICBsb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyfG51bGwsIGltcGxpY2l0UmVjZWl2ZXI6IG8uRXhwcmVzc2lvbixcbiAgICBleHByZXNzaW9uV2l0aG91dEJ1aWx0aW5zOiBjZEFzdC5BU1QsIGJpbmRpbmdJZDogc3RyaW5nLCBmb3JtOiBCaW5kaW5nRm9ybSxcbiAgICBpbnRlcnBvbGF0aW9uRnVuY3Rpb24/OiBJbnRlcnBvbGF0aW9uRnVuY3Rpb24pOiBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0IHtcbiAgaWYgKCFsb2NhbFJlc29sdmVyKSB7XG4gICAgbG9jYWxSZXNvbHZlciA9IG5ldyBEZWZhdWx0TG9jYWxSZXNvbHZlcigpO1xuICB9XG4gIGNvbnN0IHZpc2l0b3IgPVxuICAgICAgbmV3IF9Bc3RUb0lyVmlzaXRvcihsb2NhbFJlc29sdmVyLCBpbXBsaWNpdFJlY2VpdmVyLCBiaW5kaW5nSWQsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gIGNvbnN0IG91dHB1dEV4cHI6IG8uRXhwcmVzc2lvbiA9IGV4cHJlc3Npb25XaXRob3V0QnVpbHRpbnMudmlzaXQodmlzaXRvciwgX01vZGUuRXhwcmVzc2lvbik7XG4gIGNvbnN0IHN0bXRzOiBvLlN0YXRlbWVudFtdID0gZ2V0U3RhdGVtZW50c0Zyb21WaXNpdG9yKHZpc2l0b3IsIGJpbmRpbmdJZCk7XG5cbiAgaWYgKHZpc2l0b3IudXNlc0ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTtcbiAgfVxuXG4gIGlmICh2aXNpdG9yLnRlbXBvcmFyeUNvdW50ID09PSAwICYmIGZvcm0gPT0gQmluZGluZ0Zvcm0uVHJ5U2ltcGxlKSB7XG4gICAgcmV0dXJuIG5ldyBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0KFtdLCBvdXRwdXRFeHByKTtcbiAgfSBlbHNlIGlmIChmb3JtID09PSBCaW5kaW5nRm9ybS5FeHByZXNzaW9uKSB7XG4gICAgcmV0dXJuIG5ldyBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0KHN0bXRzLCBvdXRwdXRFeHByKTtcbiAgfVxuXG4gIGNvbnN0IGN1cnJWYWxFeHByID0gY3JlYXRlQ3VyclZhbHVlRXhwcihiaW5kaW5nSWQpO1xuICBzdG10cy5wdXNoKGN1cnJWYWxFeHByLnNldChvdXRwdXRFeHByKS50b0RlY2xTdG10KG8uRFlOQU1JQ19UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gIHJldHVybiBuZXcgQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdChzdG10cywgY3VyclZhbEV4cHIpO1xufVxuXG4vKipcbiAqIEdpdmVuIHNvbWUgZXhwcmVzc2lvbiwgc3VjaCBhcyBhIGJpbmRpbmcgb3IgaW50ZXJwb2xhdGlvbiBleHByZXNzaW9uLCBhbmQgYSBjb250ZXh0IGV4cHJlc3Npb24gdG9cbiAqIGxvb2sgdmFsdWVzIHVwIG9uLCB2aXNpdCBlYWNoIGZhY2V0IG9mIHRoZSBnaXZlbiBleHByZXNzaW9uIHJlc29sdmluZyB2YWx1ZXMgZnJvbSB0aGUgY29udGV4dFxuICogZXhwcmVzc2lvbiBzdWNoIHRoYXQgYSBsaXN0IG9mIGFyZ3VtZW50cyBjYW4gYmUgZGVyaXZlZCBmcm9tIHRoZSBmb3VuZCB2YWx1ZXMgdGhhdCBjYW4gYmUgdXNlZCBhc1xuICogYXJndW1lbnRzIHRvIGFuIGV4dGVybmFsIHVwZGF0ZSBpbnN0cnVjdGlvbi5cbiAqXG4gKiBAcGFyYW0gbG9jYWxSZXNvbHZlciBUaGUgcmVzb2x2ZXIgdG8gdXNlIHRvIGxvb2sgdXAgZXhwcmVzc2lvbnMgYnkgbmFtZSBhcHByb3ByaWF0ZWx5XG4gKiBAcGFyYW0gY29udGV4dFZhcmlhYmxlRXhwcmVzc2lvbiBUaGUgZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIGNvbnRleHQgdmFyaWFibGUgdXNlZCB0byBjcmVhdGVcbiAqIHRoZSBmaW5hbCBhcmd1bWVudCBleHByZXNzaW9uc1xuICogQHBhcmFtIGV4cHJlc3Npb25XaXRoQXJndW1lbnRzVG9FeHRyYWN0IFRoZSBleHByZXNzaW9uIHRvIHZpc2l0IHRvIGZpZ3VyZSBvdXQgd2hhdCB2YWx1ZXMgbmVlZCB0b1xuICogYmUgcmVzb2x2ZWQgYW5kIHdoYXQgYXJndW1lbnRzIGxpc3QgdG8gYnVpbGQuXG4gKiBAcGFyYW0gYmluZGluZ0lkIEEgbmFtZSBwcmVmaXggdXNlZCB0byBjcmVhdGUgdGVtcG9yYXJ5IHZhcmlhYmxlIG5hbWVzIGlmIHRoZXkncmUgbmVlZGVkIGZvciB0aGVcbiAqIGFyZ3VtZW50cyBnZW5lcmF0ZWRcbiAqIEByZXR1cm5zIEFuIGFycmF5IG9mIGV4cHJlc3Npb25zIHRoYXQgY2FuIGJlIHBhc3NlZCBhcyBhcmd1bWVudHMgdG8gaW5zdHJ1Y3Rpb24gZXhwcmVzc2lvbnMgbGlrZVxuICogYG8uaW1wb3J0RXhwcihSMy5wcm9wZXJ0eUludGVycG9sYXRlKS5jYWxsRm4ocmVzdWx0KWBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRVcGRhdGVBcmd1bWVudHMoXG4gICAgbG9jYWxSZXNvbHZlcjogTG9jYWxSZXNvbHZlciwgY29udGV4dFZhcmlhYmxlRXhwcmVzc2lvbjogby5FeHByZXNzaW9uLFxuICAgIGV4cHJlc3Npb25XaXRoQXJndW1lbnRzVG9FeHRyYWN0OiBjZEFzdC5BU1QsIGJpbmRpbmdJZDogc3RyaW5nKSB7XG4gIGNvbnN0IHZpc2l0b3IgPVxuICAgICAgbmV3IF9Bc3RUb0lyVmlzaXRvcihsb2NhbFJlc29sdmVyLCBjb250ZXh0VmFyaWFibGVFeHByZXNzaW9uLCBiaW5kaW5nSWQsIHVuZGVmaW5lZCk7XG4gIGNvbnN0IG91dHB1dEV4cHI6IG8uSW52b2tlRnVuY3Rpb25FeHByID1cbiAgICAgIGV4cHJlc3Npb25XaXRoQXJndW1lbnRzVG9FeHRyYWN0LnZpc2l0KHZpc2l0b3IsIF9Nb2RlLkV4cHJlc3Npb24pO1xuXG4gIGlmICh2aXNpdG9yLnVzZXNJbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgbG9jYWxSZXNvbHZlci5ub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk7XG4gIH1cblxuICBjb25zdCBzdG10cyA9IGdldFN0YXRlbWVudHNGcm9tVmlzaXRvcih2aXNpdG9yLCBiaW5kaW5nSWQpO1xuXG4gIC8vIFJlbW92aW5nIHRoZSBmaXJzdCBhcmd1bWVudCwgYmVjYXVzZSBpdCB3YXMgYSBsZW5ndGggZm9yIFZpZXdFbmdpbmUsIG5vdCBJdnkuXG4gIGxldCBhcmdzID0gb3V0cHV0RXhwci5hcmdzLnNsaWNlKDEpO1xuICBpZiAoZXhwcmVzc2lvbldpdGhBcmd1bWVudHNUb0V4dHJhY3QgaW5zdGFuY2VvZiBjZEFzdC5JbnRlcnBvbGF0aW9uKSB7XG4gICAgLy8gSWYgd2UncmUgZGVhbGluZyB3aXRoIGFuIGludGVycG9sYXRpb24gb2YgMSB2YWx1ZSB3aXRoIGFuIGVtcHR5IHByZWZpeCBhbmQgc3VmZml4LCByZWR1Y2UgdGhlXG4gICAgLy8gYXJncyByZXR1cm5lZCB0byBqdXN0IHRoZSB2YWx1ZSwgYmVjYXVzZSB3ZSdyZSBnb2luZyB0byBwYXNzIGl0IHRvIGEgc3BlY2lhbCBpbnN0cnVjdGlvbi5cbiAgICBjb25zdCBzdHJpbmdzID0gZXhwcmVzc2lvbldpdGhBcmd1bWVudHNUb0V4dHJhY3Quc3RyaW5ncztcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IDMgJiYgc3RyaW5nc1swXSA9PT0gJycgJiYgc3RyaW5nc1sxXSA9PT0gJycpIHtcbiAgICAgIC8vIFNpbmdsZSBhcmd1bWVudCBpbnRlcnBvbGF0ZSBpbnN0cnVjdGlvbnMuXG4gICAgICBhcmdzID0gW2FyZ3NbMV1dO1xuICAgIH0gZWxzZSBpZiAoYXJncy5sZW5ndGggPj0gMTkpIHtcbiAgICAgIC8vIDE5IG9yIG1vcmUgYXJndW1lbnRzIG11c3QgYmUgcGFzc2VkIHRvIHRoZSBgaW50ZXJwb2xhdGVWYC1zdHlsZSBpbnN0cnVjdGlvbnMsIHdoaWNoIGFjY2VwdFxuICAgICAgLy8gYW4gYXJyYXkgb2YgYXJndW1lbnRzXG4gICAgICBhcmdzID0gW28ubGl0ZXJhbEFycihhcmdzKV07XG4gICAgfVxuICB9XG4gIHJldHVybiB7c3RtdHMsIGFyZ3N9O1xufVxuXG5mdW5jdGlvbiBnZXRTdGF0ZW1lbnRzRnJvbVZpc2l0b3IodmlzaXRvcjogX0FzdFRvSXJWaXNpdG9yLCBiaW5kaW5nSWQ6IHN0cmluZykge1xuICBjb25zdCBzdG10czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHZpc2l0b3IudGVtcG9yYXJ5Q291bnQ7IGkrKykge1xuICAgIHN0bXRzLnB1c2godGVtcG9yYXJ5RGVjbGFyYXRpb24oYmluZGluZ0lkLCBpKSk7XG4gIH1cbiAgcmV0dXJuIHN0bXRzO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QnVpbHRpbnMoY29udmVydGVyRmFjdG9yeTogQnVpbHRpbkNvbnZlcnRlckZhY3RvcnksIGFzdDogY2RBc3QuQVNUKTogY2RBc3QuQVNUIHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfQnVpbHRpbkFzdENvbnZlcnRlcihjb252ZXJ0ZXJGYWN0b3J5KTtcbiAgcmV0dXJuIGFzdC52aXNpdCh2aXNpdG9yKTtcbn1cblxuZnVuY3Rpb24gdGVtcG9yYXJ5TmFtZShiaW5kaW5nSWQ6IHN0cmluZywgdGVtcG9yYXJ5TnVtYmVyOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYHRtcF8ke2JpbmRpbmdJZH1fJHt0ZW1wb3JhcnlOdW1iZXJ9YDtcbn1cblxuZnVuY3Rpb24gdGVtcG9yYXJ5RGVjbGFyYXRpb24oYmluZGluZ0lkOiBzdHJpbmcsIHRlbXBvcmFyeU51bWJlcjogbnVtYmVyKTogby5TdGF0ZW1lbnQge1xuICByZXR1cm4gbmV3IG8uRGVjbGFyZVZhclN0bXQodGVtcG9yYXJ5TmFtZShiaW5kaW5nSWQsIHRlbXBvcmFyeU51bWJlcikpO1xufVxuXG5mdW5jdGlvbiBwcmVwZW5kVGVtcG9yYXJ5RGVjbHMoXG4gICAgdGVtcG9yYXJ5Q291bnQ6IG51bWJlciwgYmluZGluZ0lkOiBzdHJpbmcsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pIHtcbiAgZm9yIChsZXQgaSA9IHRlbXBvcmFyeUNvdW50IC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBzdGF0ZW1lbnRzLnVuc2hpZnQodGVtcG9yYXJ5RGVjbGFyYXRpb24oYmluZGluZ0lkLCBpKSk7XG4gIH1cbn1cblxuZW51bSBfTW9kZSB7XG4gIFN0YXRlbWVudCxcbiAgRXhwcmVzc2lvblxufVxuXG5mdW5jdGlvbiBlbnN1cmVTdGF0ZW1lbnRNb2RlKG1vZGU6IF9Nb2RlLCBhc3Q6IGNkQXN0LkFTVCkge1xuICBpZiAobW9kZSAhPT0gX01vZGUuU3RhdGVtZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhIHN0YXRlbWVudCwgYnV0IHNhdyAke2FzdH1gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbnN1cmVFeHByZXNzaW9uTW9kZShtb2RlOiBfTW9kZSwgYXN0OiBjZEFzdC5BU1QpIHtcbiAgaWYgKG1vZGUgIT09IF9Nb2RlLkV4cHJlc3Npb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGFuIGV4cHJlc3Npb24sIGJ1dCBzYXcgJHthc3R9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZTogX01vZGUsIGV4cHI6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbnxvLlN0YXRlbWVudCB7XG4gIGlmIChtb2RlID09PSBfTW9kZS5TdGF0ZW1lbnQpIHtcbiAgICByZXR1cm4gZXhwci50b1N0bXQoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxufVxuXG5jbGFzcyBfQnVpbHRpbkFzdENvbnZlcnRlciBleHRlbmRzIGNkQXN0LkFzdFRyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfY29udmVydGVyRmFjdG9yeTogQnVpbHRpbkNvbnZlcnRlckZhY3RvcnkpIHtcbiAgICBzdXBlcigpO1xuICB9XG4gIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSBbYXN0LmV4cCwgLi4uYXN0LmFyZ3NdLm1hcChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXJncyxcbiAgICAgICAgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVQaXBlQ29udmVydGVyKGFzdC5uYW1lLCBhcmdzLmxlbmd0aCkpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSBhc3QuZXhwcmVzc2lvbnMubWFwKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhcmdzLFxuICAgICAgICB0aGlzLl9jb252ZXJ0ZXJGYWN0b3J5LmNyZWF0ZUxpdGVyYWxBcnJheUNvbnZlcnRlcihhc3QuZXhwcmVzc2lvbnMubGVuZ3RoKSk7XG4gIH1cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogY2RBc3QuTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gYXN0LnZhbHVlcy5tYXAoYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG5cbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXJncywgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKGFzdC5rZXlzKSk7XG4gIH1cbn1cblxuY2xhc3MgX0FzdFRvSXJWaXNpdG9yIGltcGxlbWVudHMgY2RBc3QuQXN0VmlzaXRvciB7XG4gIHByaXZhdGUgX25vZGVNYXAgPSBuZXcgTWFwPGNkQXN0LkFTVCwgY2RBc3QuQVNUPigpO1xuICBwcml2YXRlIF9yZXN1bHRNYXAgPSBuZXcgTWFwPGNkQXN0LkFTVCwgby5FeHByZXNzaW9uPigpO1xuICBwcml2YXRlIF9jdXJyZW50VGVtcG9yYXJ5OiBudW1iZXIgPSAwO1xuICBwdWJsaWMgdGVtcG9yYXJ5Q291bnQ6IG51bWJlciA9IDA7XG4gIHB1YmxpYyB1c2VzSW1wbGljaXRSZWNlaXZlcjogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfbG9jYWxSZXNvbHZlcjogTG9jYWxSZXNvbHZlciwgcHJpdmF0ZSBfaW1wbGljaXRSZWNlaXZlcjogby5FeHByZXNzaW9uLFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nSWQ6IHN0cmluZywgcHJpdmF0ZSBpbnRlcnBvbGF0aW9uRnVuY3Rpb246IEludGVycG9sYXRpb25GdW5jdGlvbnx1bmRlZmluZWQsXG4gICAgICBwcml2YXRlIGJhc2VTb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuLCBwcml2YXRlIGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcz86IFNldDxzdHJpbmc+KSB7fVxuXG4gIHZpc2l0VW5hcnkoYXN0OiBjZEFzdC5VbmFyeSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGxldCBvcDogby5VbmFyeU9wZXJhdG9yO1xuICAgIHN3aXRjaCAoYXN0Lm9wZXJhdG9yKSB7XG4gICAgICBjYXNlICcrJzpcbiAgICAgICAgb3AgPSBvLlVuYXJ5T3BlcmF0b3IuUGx1cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICctJzpcbiAgICAgICAgb3AgPSBvLlVuYXJ5T3BlcmF0b3IuTWludXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBvcGVyYXRvciAke2FzdC5vcGVyYXRvcn1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIG5ldyBvLlVuYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgb3AsIHRoaXMuX3Zpc2l0KGFzdC5leHByLCBfTW9kZS5FeHByZXNzaW9uKSwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpKTtcbiAgfVxuXG4gIHZpc2l0QmluYXJ5KGFzdDogY2RBc3QuQmluYXJ5LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgbGV0IG9wOiBvLkJpbmFyeU9wZXJhdG9yO1xuICAgIHN3aXRjaCAoYXN0Lm9wZXJhdGlvbikge1xuICAgICAgY2FzZSAnKyc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5QbHVzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTWludXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnKic6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5NdWx0aXBseTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcvJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkRpdmlkZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICclJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk1vZHVsbztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcmJic6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5BbmQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnfHwnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuT3I7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuRXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyE9JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk5vdEVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc9PT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuSWRlbnRpY2FsO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyE9PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPCc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Mb3dlcjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc+JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlcjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc8PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Mb3dlckVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc+PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPz8nOlxuICAgICAgICByZXR1cm4gdGhpcy5jb252ZXJ0TnVsbGlzaENvYWxlc2NlKGFzdCwgbW9kZSk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIG9wZXJhdGlvbiAke2FzdC5vcGVyYXRpb259YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICBtb2RlLFxuICAgICAgICBuZXcgby5CaW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICBvcCwgdGhpcy5fdmlzaXQoYXN0LmxlZnQsIF9Nb2RlLkV4cHJlc3Npb24pLCB0aGlzLl92aXNpdChhc3QucmlnaHQsIF9Nb2RlLkV4cHJlc3Npb24pLFxuICAgICAgICAgICAgdW5kZWZpbmVkLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSkpO1xuICB9XG5cbiAgdmlzaXRDaGFpbihhc3Q6IGNkQXN0LkNoYWluLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgZW5zdXJlU3RhdGVtZW50TW9kZShtb2RlLCBhc3QpO1xuICAgIHJldHVybiB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgbW9kZSk7XG4gIH1cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogY2RBc3QuQ29uZGl0aW9uYWwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCB2YWx1ZTogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LmNvbmRpdGlvbiwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICBtb2RlLFxuICAgICAgICB2YWx1ZS5jb25kaXRpb25hbChcbiAgICAgICAgICAgIHRoaXMuX3Zpc2l0KGFzdC50cnVlRXhwLCBfTW9kZS5FeHByZXNzaW9uKSwgdGhpcy5fdmlzaXQoYXN0LmZhbHNlRXhwLCBfTW9kZS5FeHByZXNzaW9uKSxcbiAgICAgICAgICAgIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYElsbGVnYWwgc3RhdGU6IFBpcGVzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zLiBQaXBlOiAke2FzdC5uYW1lfWApO1xuICB9XG5cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBjZEFzdC5GdW5jdGlvbkNhbGwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgbGV0IGZuUmVzdWx0OiBvLkV4cHJlc3Npb247XG4gICAgaWYgKGFzdCBpbnN0YW5jZW9mIEJ1aWx0aW5GdW5jdGlvbkNhbGwpIHtcbiAgICAgIGZuUmVzdWx0ID0gYXN0LmNvbnZlcnRlcihjb252ZXJ0ZWRBcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm5SZXN1bHQgPSB0aGlzLl92aXNpdChhc3QudGFyZ2V0ISwgX01vZGUuRXhwcmVzc2lvbilcbiAgICAgICAgICAgICAgICAgICAgIC5jYWxsRm4oY29udmVydGVkQXJncywgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpO1xuICAgIH1cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgZm5SZXN1bHQpO1xuICB9XG5cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogY2RBc3QuSW1wbGljaXRSZWNlaXZlciwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGUsIGFzdCk7XG4gICAgdGhpcy51c2VzSW1wbGljaXRSZWNlaXZlciA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXI7XG4gIH1cblxuICB2aXNpdFRoaXNSZWNlaXZlcihhc3Q6IGNkQXN0LlRoaXNSZWNlaXZlciwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3QsIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogY2RBc3QuSW50ZXJwb2xhdGlvbiwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGUsIGFzdCk7XG4gICAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoYXN0LmV4cHJlc3Npb25zLmxlbmd0aCldO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXN0LnN0cmluZ3MubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBhcmdzLnB1c2goby5saXRlcmFsKGFzdC5zdHJpbmdzW2ldKSk7XG4gICAgICBhcmdzLnB1c2godGhpcy5fdmlzaXQoYXN0LmV4cHJlc3Npb25zW2ldLCBfTW9kZS5FeHByZXNzaW9uKSk7XG4gICAgfVxuICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoYXN0LnN0cmluZ3NbYXN0LnN0cmluZ3MubGVuZ3RoIC0gMV0pKTtcblxuICAgIGlmICh0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0LmV4cHJlc3Npb25zLmxlbmd0aCA8PSA5ID9cbiAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmlubGluZUludGVycG9sYXRlKS5jYWxsRm4oYXJncykgOlxuICAgICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW50ZXJwb2xhdGUpLmNhbGxGbihbXG4gICAgICAgICAgYXJnc1swXSwgby5saXRlcmFsQXJyKGFyZ3Muc2xpY2UoMSksIHVuZGVmaW5lZCwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpXG4gICAgICAgIF0pO1xuICB9XG5cbiAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgICBtb2RlLFxuICAgICAgICAgIHRoaXMuX3Zpc2l0KGFzdC5yZWNlaXZlciwgX01vZGUuRXhwcmVzc2lvbikua2V5KHRoaXMuX3Zpc2l0KGFzdC5rZXksIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IG9iajogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCBrZXk6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5rZXksIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGNvbnN0IHZhbHVlOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QudmFsdWUsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCBvYmoua2V5KGtleSkuc2V0KHZhbHVlKSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBTdGF0ZTogbGl0ZXJhbCBhcnJheXMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnNgKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXAsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IGxpdGVyYWwgbWFwcyBzaG91bGQgaGF2ZSBiZWVuIGNvbnZlcnRlZCBpbnRvIGZ1bmN0aW9uc2ApO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogY2RBc3QuTGl0ZXJhbFByaW1pdGl2ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIC8vIEZvciBsaXRlcmFsIHZhbHVlcyBvZiBudWxsLCB1bmRlZmluZWQsIHRydWUsIG9yIGZhbHNlIGFsbG93IHR5cGUgaW50ZXJmZXJlbmNlXG4gICAgLy8gdG8gaW5mZXIgdGhlIHR5cGUuXG4gICAgY29uc3QgdHlwZSA9XG4gICAgICAgIGFzdC52YWx1ZSA9PT0gbnVsbCB8fCBhc3QudmFsdWUgPT09IHVuZGVmaW5lZCB8fCBhc3QudmFsdWUgPT09IHRydWUgfHwgYXN0LnZhbHVlID09PSB0cnVlID9cbiAgICAgICAgby5JTkZFUlJFRF9UWVBFIDpcbiAgICAgICAgdW5kZWZpbmVkO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgby5saXRlcmFsKGFzdC52YWx1ZSwgdHlwZSwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldExvY2FsKG5hbWU6IHN0cmluZywgcmVjZWl2ZXI6IGNkQXN0LkFTVCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBpZiAodGhpcy5fbG9jYWxSZXNvbHZlci5nbG9iYWxzPy5oYXMobmFtZSkgJiYgcmVjZWl2ZXIgaW5zdGFuY2VvZiBjZEFzdC5UaGlzUmVjZWl2ZXIpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9sb2NhbFJlc29sdmVyLmdldExvY2FsKG5hbWUpO1xuICB9XG5cbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogY2RBc3QuTWV0aG9kQ2FsbCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyICYmXG4gICAgICAgICEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgY2RBc3QuVGhpc1JlY2VpdmVyKSAmJiBhc3QubmFtZSA9PT0gJyRhbnknKSB7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbikgYXMgYW55W107XG4gICAgICBpZiAoYXJncy5sZW5ndGggIT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgSW52YWxpZCBjYWxsIHRvICRhbnksIGV4cGVjdGVkIDEgYXJndW1lbnQgYnV0IHJlY2VpdmVkICR7YXJncy5sZW5ndGggfHwgJ25vbmUnfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChhcmdzWzBdIGFzIG8uRXhwcmVzc2lvbikuY2FzdChvLkRZTkFNSUNfVFlQRSwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpO1xuICAgIH1cblxuICAgIGNvbnN0IGxlZnRNb3N0U2FmZSA9IHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpO1xuICAgIGlmIChsZWZ0TW9zdFNhZmUpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgbGVmdE1vc3RTYWZlLCBtb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgICAgY29uc3QgcHJldlVzZXNJbXBsaWNpdFJlY2VpdmVyID0gdGhpcy51c2VzSW1wbGljaXRSZWNlaXZlcjtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCByZWNlaXZlciA9IHRoaXMuX3Zpc2l0KGFzdC5yZWNlaXZlciwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgICBpZiAocmVjZWl2ZXIgPT09IHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgICAgY29uc3QgdmFyRXhwciA9IHRoaXMuX2dldExvY2FsKGFzdC5uYW1lLCBhc3QucmVjZWl2ZXIpO1xuICAgICAgICBpZiAodmFyRXhwcikge1xuICAgICAgICAgIC8vIFJlc3RvcmUgdGhlIHByZXZpb3VzIFwidXNlc0ltcGxpY2l0UmVjZWl2ZXJcIiBzdGF0ZSBzaW5jZSB0aGUgaW1wbGljaXRcbiAgICAgICAgICAvLyByZWNlaXZlciBoYXMgYmVlbiByZXBsYWNlZCB3aXRoIGEgcmVzb2x2ZWQgbG9jYWwgZXhwcmVzc2lvbi5cbiAgICAgICAgICB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyID0gcHJldlVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuICAgICAgICAgIHJlc3VsdCA9IHZhckV4cHIuY2FsbEZuKGFyZ3MpO1xuICAgICAgICAgIHRoaXMuYWRkSW1wbGljaXRSZWNlaXZlckFjY2Vzcyhhc3QubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQgPT0gbnVsbCkge1xuICAgICAgICByZXN1bHQgPSByZWNlaXZlci5jYWxsTWV0aG9kKGFzdC5uYW1lLCBhcmdzLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgcmVzdWx0KTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IGNkQXN0LlByZWZpeE5vdCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCBvLm5vdCh0aGlzLl92aXNpdChhc3QuZXhwcmVzc2lvbiwgX01vZGUuRXhwcmVzc2lvbikpKTtcbiAgfVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0Lk5vbk51bGxBc3NlcnQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsIG8uYXNzZXJ0Tm90TnVsbCh0aGlzLl92aXNpdChhc3QuZXhwcmVzc2lvbiwgX01vZGUuRXhwcmVzc2lvbikpKTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogY2RBc3QuUHJvcGVydHlSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgbGVmdE1vc3RTYWZlID0gdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCk7XG4gICAgaWYgKGxlZnRNb3N0U2FmZSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCBsZWZ0TW9zdFNhZmUsIG1vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcmVzdWx0OiBhbnkgPSBudWxsO1xuICAgICAgY29uc3QgcHJldlVzZXNJbXBsaWNpdFJlY2VpdmVyID0gdGhpcy51c2VzSW1wbGljaXRSZWNlaXZlcjtcbiAgICAgIGNvbnN0IHJlY2VpdmVyID0gdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgICByZXN1bHQgPSB0aGlzLl9nZXRMb2NhbChhc3QubmFtZSwgYXN0LnJlY2VpdmVyKTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgIC8vIFJlc3RvcmUgdGhlIHByZXZpb3VzIFwidXNlc0ltcGxpY2l0UmVjZWl2ZXJcIiBzdGF0ZSBzaW5jZSB0aGUgaW1wbGljaXRcbiAgICAgICAgICAvLyByZWNlaXZlciBoYXMgYmVlbiByZXBsYWNlZCB3aXRoIGEgcmVzb2x2ZWQgbG9jYWwgZXhwcmVzc2lvbi5cbiAgICAgICAgICB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyID0gcHJldlVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuICAgICAgICAgIHRoaXMuYWRkSW1wbGljaXRSZWNlaXZlckFjY2Vzcyhhc3QubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQgPT0gbnVsbCkge1xuICAgICAgICByZXN1bHQgPSByZWNlaXZlci5wcm9wKGFzdC5uYW1lKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCByZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCByZWNlaXZlcjogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuXG4gICAgbGV0IHZhckV4cHI6IG8uUmVhZFByb3BFeHByfG51bGwgPSBudWxsO1xuICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgY29uc3QgbG9jYWxFeHByID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUsIGFzdC5yZWNlaXZlcik7XG4gICAgICBpZiAobG9jYWxFeHByKSB7XG4gICAgICAgIGlmIChsb2NhbEV4cHIgaW5zdGFuY2VvZiBvLlJlYWRQcm9wRXhwcikge1xuICAgICAgICAgIC8vIElmIHRoZSBsb2NhbCB2YXJpYWJsZSBpcyBhIHByb3BlcnR5IHJlYWQgZXhwcmVzc2lvbiwgaXQncyBhIHJlZmVyZW5jZVxuICAgICAgICAgIC8vIHRvIGEgJ2NvbnRleHQucHJvcGVydHknIHZhbHVlIGFuZCB3aWxsIGJlIHVzZWQgYXMgdGhlIHRhcmdldCBvZiB0aGVcbiAgICAgICAgICAvLyB3cml0ZSBleHByZXNzaW9uLlxuICAgICAgICAgIHZhckV4cHIgPSBsb2NhbEV4cHI7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgXCJ1c2VzSW1wbGljaXRSZWNlaXZlclwiIHN0YXRlIHNpbmNlIHRoZSBpbXBsaWNpdFxuICAgICAgICAgIC8vIHJlY2VpdmVyIGhhcyBiZWVuIHJlcGxhY2VkIHdpdGggYSByZXNvbHZlZCBsb2NhbCBleHByZXNzaW9uLlxuICAgICAgICAgIHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXI7XG4gICAgICAgICAgdGhpcy5hZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKGFzdC5uYW1lKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBPdGhlcndpc2UgaXQncyBhbiBlcnJvci5cbiAgICAgICAgICBjb25zdCByZWNlaXZlciA9IGFzdC5uYW1lO1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gKGFzdC52YWx1ZSBpbnN0YW5jZW9mIGNkQXN0LlByb3BlcnR5UmVhZCkgPyBhc3QudmFsdWUubmFtZSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBhc3NpZ24gdmFsdWUgXCIke3ZhbHVlfVwiIHRvIHRlbXBsYXRlIHZhcmlhYmxlIFwiJHtcbiAgICAgICAgICAgICAgcmVjZWl2ZXJ9XCIuIFRlbXBsYXRlIHZhcmlhYmxlcyBhcmUgcmVhZC1vbmx5LmApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIElmIG5vIGxvY2FsIGV4cHJlc3Npb24gY291bGQgYmUgcHJvZHVjZWQsIHVzZSB0aGUgb3JpZ2luYWwgcmVjZWl2ZXInc1xuICAgIC8vIHByb3BlcnR5IGFzIHRoZSB0YXJnZXQuXG4gICAgaWYgKHZhckV4cHIgPT09IG51bGwpIHtcbiAgICAgIHZhckV4cHIgPSByZWNlaXZlci5wcm9wKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIHZhckV4cHIuc2V0KHRoaXMuX3Zpc2l0KGFzdC52YWx1ZSwgX01vZGUuRXhwcmVzc2lvbikpKTtcbiAgfVxuXG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpLCBtb2RlKTtcbiAgfVxuXG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCksIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRTYWZlS2V5ZWRSZWFkKGFzdDogY2RBc3QuU2FmZUtleWVkUmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCksIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRBbGwoYXN0czogY2RBc3QuQVNUW10sIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gYXN0cy5tYXAoYXN0ID0+IHRoaXMuX3Zpc2l0KGFzdCwgbW9kZSkpO1xuICB9XG5cbiAgdmlzaXRRdW90ZShhc3Q6IGNkQXN0LlF1b3RlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBRdW90ZXMgYXJlIG5vdCBzdXBwb3J0ZWQgZm9yIGV2YWx1YXRpb24hXG4gICAgICAgIFN0YXRlbWVudDogJHthc3QudW5pbnRlcnByZXRlZEV4cHJlc3Npb259IGxvY2F0ZWQgYXQgJHthc3QubG9jYXRpb259YCk7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdChhc3Q6IGNkQXN0LkFTVCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX3Jlc3VsdE1hcC5nZXQoYXN0KTtcbiAgICBpZiAocmVzdWx0KSByZXR1cm4gcmVzdWx0O1xuICAgIHJldHVybiAodGhpcy5fbm9kZU1hcC5nZXQoYXN0KSB8fCBhc3QpLnZpc2l0KHRoaXMsIG1vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0U2FmZUFjY2VzcyhcbiAgICAgIGFzdDogY2RBc3QuQVNULCBsZWZ0TW9zdFNhZmU6IGNkQXN0LlNhZmVNZXRob2RDYWxsfGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWR8Y2RBc3QuU2FmZUtleWVkUmVhZCxcbiAgICAgIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICAvLyBJZiB0aGUgZXhwcmVzc2lvbiBjb250YWlucyBhIHNhZmUgYWNjZXNzIG5vZGUgb24gdGhlIGxlZnQgaXQgbmVlZHMgdG8gYmUgY29udmVydGVkIHRvXG4gICAgLy8gYW4gZXhwcmVzc2lvbiB0aGF0IGd1YXJkcyB0aGUgYWNjZXNzIHRvIHRoZSBtZW1iZXIgYnkgY2hlY2tpbmcgdGhlIHJlY2VpdmVyIGZvciBibGFuay4gQXNcbiAgICAvLyBleGVjdXRpb24gcHJvY2VlZHMgZnJvbSBsZWZ0IHRvIHJpZ2h0LCB0aGUgbGVmdCBtb3N0IHBhcnQgb2YgdGhlIGV4cHJlc3Npb24gbXVzdCBiZSBndWFyZGVkXG4gICAgLy8gZmlyc3QgYnV0LCBiZWNhdXNlIG1lbWJlciBhY2Nlc3MgaXMgbGVmdCBhc3NvY2lhdGl2ZSwgdGhlIHJpZ2h0IHNpZGUgb2YgdGhlIGV4cHJlc3Npb24gaXMgYXRcbiAgICAvLyB0aGUgdG9wIG9mIHRoZSBBU1QuIFRoZSBkZXNpcmVkIHJlc3VsdCByZXF1aXJlcyBsaWZ0aW5nIGEgY29weSBvZiB0aGUgbGVmdCBwYXJ0IG9mIHRoZVxuICAgIC8vIGV4cHJlc3Npb24gdXAgdG8gdGVzdCBpdCBmb3IgYmxhbmsgYmVmb3JlIGdlbmVyYXRpbmcgdGhlIHVuZ3VhcmRlZCB2ZXJzaW9uLlxuXG4gICAgLy8gQ29uc2lkZXIsIGZvciBleGFtcGxlIHRoZSBmb2xsb3dpbmcgZXhwcmVzc2lvbjogYT8uYi5jPy5kLmVcblxuICAgIC8vIFRoaXMgcmVzdWx0cyBpbiB0aGUgYXN0OlxuICAgIC8vICAgICAgICAgLlxuICAgIC8vICAgICAgICAvIFxcXG4gICAgLy8gICAgICAgPy4gICBlXG4gICAgLy8gICAgICAvICBcXFxuICAgIC8vICAgICAuICAgIGRcbiAgICAvLyAgICAvIFxcXG4gICAgLy8gICA/LiAgY1xuICAgIC8vICAvICBcXFxuICAgIC8vIGEgICAgYlxuXG4gICAgLy8gVGhlIGZvbGxvd2luZyB0cmVlIHNob3VsZCBiZSBnZW5lcmF0ZWQ6XG4gICAgLy9cbiAgICAvLyAgICAgICAgLy0tLS0gPyAtLS0tXFxcbiAgICAvLyAgICAgICAvICAgICAgfCAgICAgIFxcXG4gICAgLy8gICAgIGEgICAvLS0tID8gLS0tXFwgIG51bGxcbiAgICAvLyAgICAgICAgLyAgICAgfCAgICAgXFxcbiAgICAvLyAgICAgICAuICAgICAgLiAgICAgbnVsbFxuICAgIC8vICAgICAgLyBcXCAgICAvIFxcXG4gICAgLy8gICAgIC4gIGMgICAuICAgZVxuICAgIC8vICAgIC8gXFwgICAgLyBcXFxuICAgIC8vICAgYSAgIGIgIC4gICBkXG4gICAgLy8gICAgICAgICAvIFxcXG4gICAgLy8gICAgICAgIC4gICBjXG4gICAgLy8gICAgICAgLyBcXFxuICAgIC8vICAgICAgYSAgIGJcbiAgICAvL1xuICAgIC8vIE5vdGljZSB0aGF0IHRoZSBmaXJzdCBndWFyZCBjb25kaXRpb24gaXMgdGhlIGxlZnQgaGFuZCBvZiB0aGUgbGVmdCBtb3N0IHNhZmUgYWNjZXNzIG5vZGVcbiAgICAvLyB3aGljaCBjb21lcyBpbiBhcyBsZWZ0TW9zdFNhZmUgdG8gdGhpcyByb3V0aW5lLlxuXG4gICAgbGV0IGd1YXJkZWRFeHByZXNzaW9uID0gdGhpcy5fdmlzaXQobGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBsZXQgdGVtcG9yYXJ5OiBvLlJlYWRWYXJFeHByID0gdW5kZWZpbmVkITtcbiAgICBpZiAodGhpcy5uZWVkc1RlbXBvcmFyeUluU2FmZUFjY2VzcyhsZWZ0TW9zdFNhZmUucmVjZWl2ZXIpKSB7XG4gICAgICAvLyBJZiB0aGUgZXhwcmVzc2lvbiBoYXMgbWV0aG9kIGNhbGxzIG9yIHBpcGVzIHRoZW4gd2UgbmVlZCB0byBzYXZlIHRoZSByZXN1bHQgaW50byBhXG4gICAgICAvLyB0ZW1wb3JhcnkgdmFyaWFibGUgdG8gYXZvaWQgY2FsbGluZyBzdGF0ZWZ1bCBvciBpbXB1cmUgY29kZSBtb3JlIHRoYW4gb25jZS5cbiAgICAgIHRlbXBvcmFyeSA9IHRoaXMuYWxsb2NhdGVUZW1wb3JhcnkoKTtcblxuICAgICAgLy8gUHJlc2VydmUgdGhlIHJlc3VsdCBpbiB0aGUgdGVtcG9yYXJ5IHZhcmlhYmxlXG4gICAgICBndWFyZGVkRXhwcmVzc2lvbiA9IHRlbXBvcmFyeS5zZXQoZ3VhcmRlZEV4cHJlc3Npb24pO1xuXG4gICAgICAvLyBFbnN1cmUgYWxsIGZ1cnRoZXIgcmVmZXJlbmNlcyB0byB0aGUgZ3VhcmRlZCBleHByZXNzaW9uIHJlZmVyIHRvIHRoZSB0ZW1wb3JhcnkgaW5zdGVhZC5cbiAgICAgIHRoaXMuX3Jlc3VsdE1hcC5zZXQobGVmdE1vc3RTYWZlLnJlY2VpdmVyLCB0ZW1wb3JhcnkpO1xuICAgIH1cbiAgICBjb25zdCBjb25kaXRpb24gPSBndWFyZGVkRXhwcmVzc2lvbi5pc0JsYW5rKCk7XG5cbiAgICAvLyBDb252ZXJ0IHRoZSBhc3QgdG8gYW4gdW5ndWFyZGVkIGFjY2VzcyB0byB0aGUgcmVjZWl2ZXIncyBtZW1iZXIuIFRoZSBtYXAgd2lsbCBzdWJzdGl0dXRlXG4gICAgLy8gbGVmdE1vc3ROb2RlIHdpdGggaXRzIHVuZ3VhcmRlZCB2ZXJzaW9uIGluIHRoZSBjYWxsIHRvIGB0aGlzLnZpc2l0KClgLlxuICAgIGlmIChsZWZ0TW9zdFNhZmUgaW5zdGFuY2VvZiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCkge1xuICAgICAgdGhpcy5fbm9kZU1hcC5zZXQoXG4gICAgICAgICAgbGVmdE1vc3RTYWZlLFxuICAgICAgICAgIG5ldyBjZEFzdC5NZXRob2RDYWxsKFxuICAgICAgICAgICAgICBsZWZ0TW9zdFNhZmUuc3BhbiwgbGVmdE1vc3RTYWZlLnNvdXJjZVNwYW4sIGxlZnRNb3N0U2FmZS5uYW1lU3BhbixcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBsZWZ0TW9zdFNhZmUubmFtZSwgbGVmdE1vc3RTYWZlLmFyZ3MsXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5hcmd1bWVudFNwYW4pKTtcbiAgICB9IGVsc2UgaWYgKGxlZnRNb3N0U2FmZSBpbnN0YW5jZW9mIGNkQXN0LlNhZmVLZXllZFJlYWQpIHtcbiAgICAgIHRoaXMuX25vZGVNYXAuc2V0KFxuICAgICAgICAgIGxlZnRNb3N0U2FmZSxcbiAgICAgICAgICBuZXcgY2RBc3QuS2V5ZWRSZWFkKFxuICAgICAgICAgICAgICBsZWZ0TW9zdFNhZmUuc3BhbiwgbGVmdE1vc3RTYWZlLnNvdXJjZVNwYW4sIGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgbGVmdE1vc3RTYWZlLmtleSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ub2RlTWFwLnNldChcbiAgICAgICAgICBsZWZ0TW9zdFNhZmUsXG4gICAgICAgICAgbmV3IGNkQXN0LlByb3BlcnR5UmVhZChcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLnNwYW4sIGxlZnRNb3N0U2FmZS5zb3VyY2VTcGFuLCBsZWZ0TW9zdFNhZmUubmFtZVNwYW4sXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgbGVmdE1vc3RTYWZlLm5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBSZWN1cnNpdmVseSBjb252ZXJ0IHRoZSBub2RlIG5vdyB3aXRob3V0IHRoZSBndWFyZGVkIG1lbWJlciBhY2Nlc3MuXG4gICAgY29uc3QgYWNjZXNzID0gdGhpcy5fdmlzaXQoYXN0LCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICAgIC8vIFJlbW92ZSB0aGUgbWFwcGluZy4gVGhpcyBpcyBub3Qgc3RyaWN0bHkgcmVxdWlyZWQgYXMgdGhlIGNvbnZlcnRlciBvbmx5IHRyYXZlcnNlcyBlYWNoIG5vZGVcbiAgICAvLyBvbmNlIGJ1dCBpcyBzYWZlciBpZiB0aGUgY29udmVyc2lvbiBpcyBjaGFuZ2VkIHRvIHRyYXZlcnNlIHRoZSBub2RlcyBtb3JlIHRoYW4gb25jZS5cbiAgICB0aGlzLl9ub2RlTWFwLmRlbGV0ZShsZWZ0TW9zdFNhZmUpO1xuXG4gICAgLy8gSWYgd2UgYWxsb2NhdGVkIGEgdGVtcG9yYXJ5LCByZWxlYXNlIGl0LlxuICAgIGlmICh0ZW1wb3JhcnkpIHtcbiAgICAgIHRoaXMucmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3JhcnkpO1xuICAgIH1cblxuICAgIC8vIFByb2R1Y2UgdGhlIGNvbmRpdGlvbmFsXG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGNvbmRpdGlvbi5jb25kaXRpb25hbChvLk5VTExfRVhQUiwgYWNjZXNzKSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnROdWxsaXNoQ29hbGVzY2UoYXN0OiBjZEFzdC5CaW5hcnksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0OiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QubGVmdCwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3QgcmlnaHQ6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5yaWdodCwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGhpcy5hbGxvY2F0ZVRlbXBvcmFyeSgpO1xuICAgIHRoaXMucmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3JhcnkpO1xuXG4gICAgLy8gR2VuZXJhdGUgdGhlIGZvbGxvd2luZyBleHByZXNzaW9uLiBJdCBpcyBpZGVudGljYWwgdG8gaG93IFRTXG4gICAgLy8gdHJhbnNwaWxlcyBiaW5hcnkgZXhwcmVzc2lvbnMgd2l0aCBhIG51bGxpc2ggY29hbGVzY2luZyBvcGVyYXRvci5cbiAgICAvLyBsZXQgdGVtcDtcbiAgICAvLyAodGVtcCA9IGEpICE9PSBudWxsICYmIHRlbXAgIT09IHVuZGVmaW5lZCA/IHRlbXAgOiBiO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSxcbiAgICAgICAgdGVtcG9yYXJ5LnNldChsZWZ0KVxuICAgICAgICAgICAgLm5vdElkZW50aWNhbChvLk5VTExfRVhQUilcbiAgICAgICAgICAgIC5hbmQodGVtcG9yYXJ5Lm5vdElkZW50aWNhbChvLmxpdGVyYWwodW5kZWZpbmVkKSkpXG4gICAgICAgICAgICAuY29uZGl0aW9uYWwodGVtcG9yYXJ5LCByaWdodCkpO1xuICB9XG5cbiAgLy8gR2l2ZW4gYW4gZXhwcmVzc2lvbiBvZiB0aGUgZm9ybSBhPy5iLmM/LmQuZSB0aGVuIHRoZSBsZWZ0IG1vc3Qgc2FmZSBub2RlIGlzXG4gIC8vIHRoZSAoYT8uYikuIFRoZSAuIGFuZCA/LiBhcmUgbGVmdCBhc3NvY2lhdGl2ZSB0aHVzIGNhbiBiZSByZXdyaXR0ZW4gYXM6XG4gIC8vICgoKChhPy5jKS5iKS5jKT8uZCkuZS4gVGhpcyByZXR1cm5zIHRoZSBtb3N0IGRlZXBseSBuZXN0ZWQgc2FmZSByZWFkIG9yXG4gIC8vIHNhZmUgbWV0aG9kIGNhbGwgYXMgdGhpcyBuZWVkcyB0byBiZSB0cmFuc2Zvcm1lZCBpbml0aWFsbHkgdG86XG4gIC8vICAgYSA9PSBudWxsID8gbnVsbCA6IGEuYy5iLmM/LmQuZVxuICAvLyB0aGVuIHRvOlxuICAvLyAgIGEgPT0gbnVsbCA/IG51bGwgOiBhLmIuYyA9PSBudWxsID8gbnVsbCA6IGEuYi5jLmQuZVxuICBwcml2YXRlIGxlZnRNb3N0U2FmZU5vZGUoYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkfGNkQXN0LlNhZmVNZXRob2RDYWxsXG4gICAgICB8Y2RBc3QuU2FmZUtleWVkUmVhZCB7XG4gICAgY29uc3QgdmlzaXQgPSAodmlzaXRvcjogY2RBc3QuQXN0VmlzaXRvciwgYXN0OiBjZEFzdC5BU1QpOiBhbnkgPT4ge1xuICAgICAgcmV0dXJuICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodmlzaXRvcik7XG4gICAgfTtcbiAgICByZXR1cm4gYXN0LnZpc2l0KHtcbiAgICAgIHZpc2l0VW5hcnkoYXN0OiBjZEFzdC5VbmFyeSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdEJpbmFyeShhc3Q6IGNkQXN0LkJpbmFyeSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4pIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogY2RBc3QuRnVuY3Rpb25DYWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRUaGlzUmVjZWl2ZXIoYXN0OiBjZEFzdC5UaGlzUmVjZWl2ZXIpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogY2RBc3QuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdEtleWVkUmVhZChhc3Q6IGNkQXN0LktleWVkUmVhZCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXApIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogY2RBc3QuTGl0ZXJhbFByaW1pdGl2ZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdE1ldGhvZENhbGwoYXN0OiBjZEFzdC5NZXRob2RDYWxsKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0Lk5vbk51bGxBc3NlcnQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogY2RBc3QuUHJvcGVydHlXcml0ZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IGNkQXN0LlNhZmVNZXRob2RDYWxsKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVLZXllZFJlYWQoYXN0OiBjZEFzdC5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBvZiB0aGUgQVNUIGluY2x1ZGVzIGEgbWV0aG9kIG9yIGEgcGlwZSBpbmRpY2F0aW5nIHRoYXQsIGlmIHRoZVxuICAvLyBleHByZXNzaW9uIGlzIHVzZWQgYXMgdGhlIHRhcmdldCBvZiBhIHNhZmUgcHJvcGVydHkgb3IgbWV0aG9kIGFjY2VzcyB0aGVuXG4gIC8vIHRoZSBleHByZXNzaW9uIHNob3VsZCBiZSBzdG9yZWQgaW50byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgcHJpdmF0ZSBuZWVkc1RlbXBvcmFyeUluU2FmZUFjY2Vzcyhhc3Q6IGNkQXN0LkFTVCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHZpc2l0ID0gKHZpc2l0b3I6IGNkQXN0LkFzdFZpc2l0b3IsIGFzdDogY2RBc3QuQVNUKTogYm9vbGVhbiA9PiB7XG4gICAgICByZXR1cm4gYXN0ICYmICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodmlzaXRvcik7XG4gICAgfTtcbiAgICBjb25zdCB2aXNpdFNvbWUgPSAodmlzaXRvcjogY2RBc3QuQXN0VmlzaXRvciwgYXN0OiBjZEFzdC5BU1RbXSk6IGJvb2xlYW4gPT4ge1xuICAgICAgcmV0dXJuIGFzdC5zb21lKGFzdCA9PiB2aXNpdCh2aXNpdG9yLCBhc3QpKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRVbmFyeShhc3Q6IGNkQXN0LlVuYXJ5KTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QuZXhwcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnkpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5sZWZ0KSB8fCB2aXNpdCh0aGlzLCBhc3QucmlnaHQpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QuY29uZGl0aW9uKSB8fCB2aXNpdCh0aGlzLCBhc3QudHJ1ZUV4cCkgfHwgdmlzaXQodGhpcywgYXN0LmZhbHNlRXhwKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IGNkQXN0LkZ1bmN0aW9uQ2FsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFRoaXNSZWNlaXZlcihhc3Q6IGNkQXN0LlRoaXNSZWNlaXZlcikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogY2RBc3QuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICByZXR1cm4gdmlzaXRTb21lKHRoaXMsIGFzdC5leHByZXNzaW9ucyk7XG4gICAgICB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IGNkQXN0LktleWVkV3JpdGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXApIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogY2RBc3QuTGl0ZXJhbFByaW1pdGl2ZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRNZXRob2RDYWxsKGFzdDogY2RBc3QuTWV0aG9kQ2FsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByZWZpeE5vdChhc3Q6IGNkQXN0LlByZWZpeE5vdCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHJlc3Npb24pO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0LlByZWZpeE5vdCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHJlc3Npb24pO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogY2RBc3QuUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBjZEFzdC5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVLZXllZFJlYWQoYXN0OiBjZEFzdC5TYWZlS2V5ZWRSZWFkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVUZW1wb3JhcnkoKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgdGVtcE51bWJlciA9IHRoaXMuX2N1cnJlbnRUZW1wb3JhcnkrKztcbiAgICB0aGlzLnRlbXBvcmFyeUNvdW50ID0gTWF0aC5tYXgodGhpcy5fY3VycmVudFRlbXBvcmFyeSwgdGhpcy50ZW1wb3JhcnlDb3VudCk7XG4gICAgcmV0dXJuIG5ldyBvLlJlYWRWYXJFeHByKHRlbXBvcmFyeU5hbWUodGhpcy5iaW5kaW5nSWQsIHRlbXBOdW1iZXIpKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3Jhcnk6IG8uUmVhZFZhckV4cHIpIHtcbiAgICB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5LS07XG4gICAgaWYgKHRlbXBvcmFyeS5uYW1lICE9IHRlbXBvcmFyeU5hbWUodGhpcy5iaW5kaW5nSWQsIHRoaXMuX2N1cnJlbnRUZW1wb3JhcnkpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRlbXBvcmFyeSAke3RlbXBvcmFyeS5uYW1lfSByZWxlYXNlZCBvdXQgb2Ygb3JkZXJgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhYnNvbHV0ZSBgUGFyc2VTb3VyY2VTcGFuYCBmcm9tIHRoZSByZWxhdGl2ZSBgUGFyc2VTcGFuYC5cbiAgICpcbiAgICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICAgKiBUaGlzIG1ldGhvZCBjb252ZXJ0cyB0aGVzZSB0byBmdWxsIGBQYXJzZVNvdXJjZVNwYW5gIG9iamVjdHMgdGhhdFxuICAgKiBzaG93IHdoZXJlIHRoZSBzcGFuIGlzIHdpdGhpbiB0aGUgb3ZlcmFsbCBzb3VyY2UgZmlsZS5cbiAgICpcbiAgICogQHBhcmFtIHNwYW4gdGhlIHJlbGF0aXZlIHNwYW4gdG8gY29udmVydC5cbiAgICogQHJldHVybnMgYSBgUGFyc2VTb3VyY2VTcGFuYCBmb3IgdGhlIGdpdmVuIHNwYW4gb3IgbnVsbCBpZiBub1xuICAgKiBgYmFzZVNvdXJjZVNwYW5gIHdhcyBwcm92aWRlZCB0byB0aGlzIGNsYXNzLlxuICAgKi9cbiAgcHJpdmF0ZSBjb252ZXJ0U291cmNlU3BhbihzcGFuOiBjZEFzdC5QYXJzZVNwYW4pIHtcbiAgICBpZiAodGhpcy5iYXNlU291cmNlU3Bhbikge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLnN0YXJ0KTtcbiAgICAgIGNvbnN0IGVuZCA9IHRoaXMuYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uZW5kKTtcbiAgICAgIGNvbnN0IGZ1bGxTdGFydCA9IHRoaXMuYmFzZVNvdXJjZVNwYW4uZnVsbFN0YXJ0Lm1vdmVCeShzcGFuLnN0YXJ0KTtcbiAgICAgIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LCBlbmQsIGZ1bGxTdGFydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBBZGRzIHRoZSBuYW1lIG9mIGFuIEFTVCB0byB0aGUgbGlzdCBvZiBpbXBsaWNpdCByZWNlaXZlciBhY2Nlc3Nlcy4gKi9cbiAgcHJpdmF0ZSBhZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKG5hbWU6IHN0cmluZykge1xuICAgIGlmICh0aGlzLmltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcykge1xuICAgICAgdGhpcy5pbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMuYWRkKG5hbWUpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmbGF0dGVuU3RhdGVtZW50cyhhcmc6IGFueSwgb3V0cHV0OiBvLlN0YXRlbWVudFtdKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAoPGFueVtdPmFyZykuZm9yRWFjaCgoZW50cnkpID0+IGZsYXR0ZW5TdGF0ZW1lbnRzKGVudHJ5LCBvdXRwdXQpKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQucHVzaChhcmcpO1xuICB9XG59XG5cbmNsYXNzIERlZmF1bHRMb2NhbFJlc29sdmVyIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBnbG9iYWxzPzogU2V0PHN0cmluZz4pIHt9XG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZCB7fVxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKG5hbWUgPT09IEV2ZW50SGFuZGxlclZhcnMuZXZlbnQubmFtZSkge1xuICAgICAgcmV0dXJuIEV2ZW50SGFuZGxlclZhcnMuZXZlbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUN1cnJWYWx1ZUV4cHIoYmluZGluZ0lkOiBzdHJpbmcpOiBvLlJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG8udmFyaWFibGUoYGN1cnJWYWxfJHtiaW5kaW5nSWR9YCk7ICAvLyBmaXggc3ludGF4IGhpZ2hsaWdodGluZzogYFxufVxuXG5mdW5jdGlvbiBjcmVhdGVQcmV2ZW50RGVmYXVsdFZhcihiaW5kaW5nSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICByZXR1cm4gby52YXJpYWJsZShgcGRfJHtiaW5kaW5nSWR9YCk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRTdG10SW50b0V4cHJlc3Npb24oc3RtdDogby5TdGF0ZW1lbnQpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGlmIChzdG10IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIHN0bXQuZXhwcjtcbiAgfSBlbHNlIGlmIChzdG10IGluc3RhbmNlb2Ygby5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICByZXR1cm4gc3RtdC52YWx1ZTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGNsYXNzIEJ1aWx0aW5GdW5jdGlvbkNhbGwgZXh0ZW5kcyBjZEFzdC5GdW5jdGlvbkNhbGwge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHNwYW46IGNkQXN0LlBhcnNlU3Bhbiwgc291cmNlU3BhbjogY2RBc3QuQWJzb2x1dGVTb3VyY2VTcGFuLCBwdWJsaWMgYXJnczogY2RBc3QuQVNUW10sXG4gICAgICBwdWJsaWMgY29udmVydGVyOiBCdWlsdGluQ29udmVydGVyKSB7XG4gICAgc3VwZXIoc3Bhbiwgc291cmNlU3BhbiwgbnVsbCwgYXJncyk7XG4gIH1cbn1cbiJdfQ==