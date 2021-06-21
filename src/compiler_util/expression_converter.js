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
                return convertToStatementIfNeeded(mode, this._visit(ast.obj, _Mode.Expression).key(this._visit(ast.key, _Mode.Expression)));
            }
        };
        _AstToIrVisitor.prototype.visitKeyedWrite = function (ast, mode) {
            var obj = this._visit(ast.obj, _Mode.Expression);
            var key = this._visit(ast.key, _Mode.Expression);
            var value = this._visit(ast.value, _Mode.Expression);
            if (obj === this._implicitReceiver) {
                this._localResolver.maybeRestoreView(0, false);
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
            var _this = _super.call(this, span, sourceSpan, null, args) || this;
            _this.args = args;
            _this.converter = converter;
            return _this;
        }
        return BuiltinFunctionCall;
    }(cdAst.FunctionCall));
    exports.BuiltinFunctionCall = BuiltinFunctionCall;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbl9jb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbUVBQWtEO0lBQ2xELGlFQUEyQztJQUMzQywyREFBMEM7SUFDMUMsK0RBQThDO0lBRTlDO1FBQUE7UUFFQSxDQUFDO1FBRFEsc0JBQUssR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3RDLHVCQUFDO0tBQUEsQUFGRCxJQUVDO0lBRlksNENBQWdCO0lBVzdCO1FBS0U7UUFDSTs7V0FFRztRQUNJLEtBQW9CO1FBQzNCOztXQUVHO1FBQ0ksWUFBMkI7WUFKM0IsVUFBSyxHQUFMLEtBQUssQ0FBZTtZQUlwQixpQkFBWSxHQUFaLFlBQVksQ0FBZTtZQUNwQzs7Ozs7Ozs7Ozs7Ozs7OztlQWdCRztZQUNILHNFQUFzRTtZQUN0RSxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxTQUFzQjtnQkFDbkQsSUFBSSxTQUFTLFlBQVksQ0FBQyxDQUFDLGNBQWMsSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLFlBQVksQ0FBQyxJQUFJO29CQUM1RSxTQUFTLENBQUMsS0FBSyxZQUFZLENBQUMsQ0FBQyxrQkFBa0IsRUFBRTtvQkFDbkQsSUFBTSxHQUFHLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFpQixDQUFDO29CQUM5QyxPQUFPLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3pDO2dCQUNELE9BQU8sU0FBUyxDQUFDO1lBQ25CLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNILGlDQUFDO0lBQUQsQ0FBQyxBQXpD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QU5ELENBQXlDLEtBQUssQ0FBQyxZQUFZLEdBTTFEO0lBTlksa0RBQW1CIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNkQXN0IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGNsYXNzIEV2ZW50SGFuZGxlclZhcnMge1xuICBzdGF0aWMgZXZlbnQgPSBvLnZhcmlhYmxlKCckZXZlbnQnKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMb2NhbFJlc29sdmVyIHtcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGw7XG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZDtcbiAgZ2xvYmFscz86IFNldDxzdHJpbmc+O1xuICBtYXliZVJlc3RvcmVWaWV3KHJldHJpZXZhbExldmVsOiBudW1iZXIsIGxvY2FsUmVmTG9va3VwOiBib29sZWFuKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIENvbnZlcnRBY3Rpb25CaW5kaW5nUmVzdWx0IHtcbiAgLyoqXG4gICAqIFN0b3JlIHN0YXRlbWVudHMgd2hpY2ggYXJlIHJlbmRlcjMgY29tcGF0aWJsZS5cbiAgICovXG4gIHJlbmRlcjNTdG10czogby5TdGF0ZW1lbnRbXTtcbiAgY29uc3RydWN0b3IoXG4gICAgICAvKipcbiAgICAgICAqIFJlbmRlcjIgY29tcGF0aWJsZSBzdGF0ZW1lbnRzLFxuICAgICAgICovXG4gICAgICBwdWJsaWMgc3RtdHM6IG8uU3RhdGVtZW50W10sXG4gICAgICAvKipcbiAgICAgICAqIFZhcmlhYmxlIG5hbWUgdXNlZCB3aXRoIHJlbmRlcjIgY29tcGF0aWJsZSBzdGF0ZW1lbnRzLlxuICAgICAgICovXG4gICAgICBwdWJsaWMgYWxsb3dEZWZhdWx0OiBvLlJlYWRWYXJFeHByKSB7XG4gICAgLyoqXG4gICAgICogVGhpcyBpcyBiaXQgb2YgYSBoYWNrLiBJdCBjb252ZXJ0cyBzdGF0ZW1lbnRzIHdoaWNoIHJlbmRlcjIgZXhwZWN0cyB0byBzdGF0ZW1lbnRzIHdoaWNoIGFyZVxuICAgICAqIGV4cGVjdGVkIGJ5IHJlbmRlcjMuXG4gICAgICpcbiAgICAgKiBFeGFtcGxlOiBgPGRpdiBjbGljaz1cImRvU29tZXRoaW5nKCRldmVudClcIj5gIHdpbGwgZ2VuZXJhdGU6XG4gICAgICpcbiAgICAgKiBSZW5kZXIzOlxuICAgICAqIGBgYFxuICAgICAqIGNvbnN0IHBkX2I6YW55ID0gKCg8YW55PmN0eC5kb1NvbWV0aGluZygkZXZlbnQpKSAhPT0gZmFsc2UpO1xuICAgICAqIHJldHVybiBwZF9iO1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogYnV0IHJlbmRlcjIgZXhwZWN0czpcbiAgICAgKiBgYGBcbiAgICAgKiByZXR1cm4gY3R4LmRvU29tZXRoaW5nKCRldmVudCk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgLy8gVE9ETyhtaXNrbyk6IHJlbW92ZSB0aGlzIGhhY2sgb25jZSB3ZSBubyBsb25nZXIgc3VwcG9ydCBWaWV3RW5naW5lLlxuICAgIHRoaXMucmVuZGVyM1N0bXRzID0gc3RtdHMubWFwKChzdGF0ZW1lbnQ6IG8uU3RhdGVtZW50KSA9PiB7XG4gICAgICBpZiAoc3RhdGVtZW50IGluc3RhbmNlb2Ygby5EZWNsYXJlVmFyU3RtdCAmJiBzdGF0ZW1lbnQubmFtZSA9PSBhbGxvd0RlZmF1bHQubmFtZSAmJlxuICAgICAgICAgIHN0YXRlbWVudC52YWx1ZSBpbnN0YW5jZW9mIG8uQmluYXJ5T3BlcmF0b3JFeHByKSB7XG4gICAgICAgIGNvbnN0IGxocyA9IHN0YXRlbWVudC52YWx1ZS5saHMgYXMgby5DYXN0RXhwcjtcbiAgICAgICAgcmV0dXJuIG5ldyBvLlJldHVyblN0YXRlbWVudChsaHMudmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXRlbWVudDtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBJbnRlcnBvbGF0aW9uRnVuY3Rpb24gPSAoYXJnczogby5FeHByZXNzaW9uW10pID0+IG8uRXhwcmVzc2lvbjtcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBBU1QgaW50byBhbiBleGVjdXRhYmxlIG91dHB1dCBBU1QsIGFzc3VtaW5nIHRoZSBleHByZXNzaW9uIGlzXG4gKiB1c2VkIGluIGFuIGFjdGlvbiBiaW5kaW5nIChlLmcuIGFuIGV2ZW50IGhhbmRsZXIpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgbG9jYWxSZXNvbHZlcjogTG9jYWxSZXNvbHZlcnxudWxsLCBpbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sIGFjdGlvbjogY2RBc3QuQVNULFxuICAgIGJpbmRpbmdJZDogc3RyaW5nLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24/OiBJbnRlcnBvbGF0aW9uRnVuY3Rpb24sXG4gICAgYmFzZVNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4sIGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcz86IFNldDxzdHJpbmc+LFxuICAgIGdsb2JhbHM/OiBTZXQ8c3RyaW5nPik6IENvbnZlcnRBY3Rpb25CaW5kaW5nUmVzdWx0IHtcbiAgaWYgKCFsb2NhbFJlc29sdmVyKSB7XG4gICAgbG9jYWxSZXNvbHZlciA9IG5ldyBEZWZhdWx0TG9jYWxSZXNvbHZlcihnbG9iYWxzKTtcbiAgfVxuICBjb25zdCBhY3Rpb25XaXRob3V0QnVpbHRpbnMgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnMoXG4gICAgICB7XG4gICAgICAgIGNyZWF0ZUxpdGVyYWxBcnJheUNvbnZlcnRlcjogKGFyZ0NvdW50OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAvLyBOb3RlOiBubyBjYWNoaW5nIGZvciBsaXRlcmFsIGFycmF5cyBpbiBhY3Rpb25zLlxuICAgICAgICAgIHJldHVybiAoYXJnczogby5FeHByZXNzaW9uW10pID0+IG8ubGl0ZXJhbEFycihhcmdzKTtcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcjogKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKSA9PiB7XG4gICAgICAgICAgLy8gTm90ZTogbm8gY2FjaGluZyBmb3IgbGl0ZXJhbCBtYXBzIGluIGFjdGlvbnMuXG4gICAgICAgICAgcmV0dXJuICh2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBlbnRyaWVzID0ga2V5cy5tYXAoKGssIGkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGsua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogay5xdW90ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbE1hcChlbnRyaWVzKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVQaXBlQ29udmVydGVyOiAobmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBBY3Rpb25zIGFyZSBub3QgYWxsb3dlZCB0byBjb250YWluIHBpcGVzLiBQaXBlOiAke25hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBhY3Rpb24pO1xuXG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX0FzdFRvSXJWaXNpdG9yKFxuICAgICAgbG9jYWxSZXNvbHZlciwgaW1wbGljaXRSZWNlaXZlciwgYmluZGluZ0lkLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24sIGJhc2VTb3VyY2VTcGFuLFxuICAgICAgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzKTtcbiAgY29uc3QgYWN0aW9uU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgZmxhdHRlblN0YXRlbWVudHMoYWN0aW9uV2l0aG91dEJ1aWx0aW5zLnZpc2l0KHZpc2l0b3IsIF9Nb2RlLlN0YXRlbWVudCksIGFjdGlvblN0bXRzKTtcbiAgcHJlcGVuZFRlbXBvcmFyeURlY2xzKHZpc2l0b3IudGVtcG9yYXJ5Q291bnQsIGJpbmRpbmdJZCwgYWN0aW9uU3RtdHMpO1xuXG4gIGlmICh2aXNpdG9yLnVzZXNJbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgbG9jYWxSZXNvbHZlci5ub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk7XG4gIH1cblxuICBjb25zdCBsYXN0SW5kZXggPSBhY3Rpb25TdG10cy5sZW5ndGggLSAxO1xuICBsZXQgcHJldmVudERlZmF1bHRWYXI6IG8uUmVhZFZhckV4cHIgPSBudWxsITtcbiAgaWYgKGxhc3RJbmRleCA+PSAwKSB7XG4gICAgY29uc3QgbGFzdFN0YXRlbWVudCA9IGFjdGlvblN0bXRzW2xhc3RJbmRleF07XG4gICAgY29uc3QgcmV0dXJuRXhwciA9IGNvbnZlcnRTdG10SW50b0V4cHJlc3Npb24obGFzdFN0YXRlbWVudCk7XG4gICAgaWYgKHJldHVybkV4cHIpIHtcbiAgICAgIC8vIE5vdGU6IFdlIG5lZWQgdG8gY2FzdCB0aGUgcmVzdWx0IG9mIHRoZSBtZXRob2QgY2FsbCB0byBkeW5hbWljLFxuICAgICAgLy8gYXMgaXQgbWlnaHQgYmUgYSB2b2lkIG1ldGhvZCFcbiAgICAgIHByZXZlbnREZWZhdWx0VmFyID0gY3JlYXRlUHJldmVudERlZmF1bHRWYXIoYmluZGluZ0lkKTtcbiAgICAgIGFjdGlvblN0bXRzW2xhc3RJbmRleF0gPVxuICAgICAgICAgIHByZXZlbnREZWZhdWx0VmFyLnNldChyZXR1cm5FeHByLmNhc3Qoby5EWU5BTUlDX1RZUEUpLm5vdElkZW50aWNhbChvLmxpdGVyYWwoZmFsc2UpKSlcbiAgICAgICAgICAgICAgLnRvRGVjbFN0bXQobnVsbCwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgQ29udmVydEFjdGlvbkJpbmRpbmdSZXN1bHQoYWN0aW9uU3RtdHMsIHByZXZlbnREZWZhdWx0VmFyKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsdGluQ29udmVydGVyIHtcbiAgKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5IHtcbiAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyKGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xuICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKTogQnVpbHRpbkNvbnZlcnRlcjtcbiAgY3JlYXRlUGlwZUNvbnZlcnRlcihuYW1lOiBzdHJpbmcsIGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgIGNvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5LCBhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LkFTVCB7XG4gIHJldHVybiBjb252ZXJ0QnVpbHRpbnMoY29udmVydGVyRmFjdG9yeSwgYXN0KTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RtdHM6IG8uU3RhdGVtZW50W10sIHB1YmxpYyBjdXJyVmFsRXhwcjogby5FeHByZXNzaW9uKSB7fVxufVxuXG5leHBvcnQgZW51bSBCaW5kaW5nRm9ybSB7XG4gIC8vIFRoZSBnZW5lcmFsIGZvcm0gb2YgYmluZGluZyBleHByZXNzaW9uLCBzdXBwb3J0cyBhbGwgZXhwcmVzc2lvbnMuXG4gIEdlbmVyYWwsXG5cbiAgLy8gVHJ5IHRvIGdlbmVyYXRlIGEgc2ltcGxlIGJpbmRpbmcgKG5vIHRlbXBvcmFyaWVzIG9yIHN0YXRlbWVudHMpXG4gIC8vIG90aGVyd2lzZSBnZW5lcmF0ZSBhIGdlbmVyYWwgYmluZGluZ1xuICBUcnlTaW1wbGUsXG5cbiAgLy8gSW5saW5lcyBhc3NpZ25tZW50IG9mIHRlbXBvcmFyaWVzIGludG8gdGhlIGdlbmVyYXRlZCBleHByZXNzaW9uLiBUaGUgcmVzdWx0IG1heSBzdGlsbFxuICAvLyBoYXZlIHN0YXRlbWVudHMgYXR0YWNoZWQgZm9yIGRlY2xhcmF0aW9ucyBvZiB0ZW1wb3JhcnkgdmFyaWFibGVzLlxuICAvLyBUaGlzIGlzIHRoZSBvbmx5IHJlbGV2YW50IGZvcm0gZm9yIEl2eSwgdGhlIG90aGVyIGZvcm1zIGFyZSBvbmx5IHVzZWQgaW4gVmlld0VuZ2luZS5cbiAgRXhwcmVzc2lvbixcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBBU1QgaW50byBhbiBleGVjdXRhYmxlIG91dHB1dCBBU1QsIGFzc3VtaW5nIHRoZSBleHByZXNzaW9uXG4gKiBpcyB1c2VkIGluIHByb3BlcnR5IGJpbmRpbmcuIFRoZSBleHByZXNzaW9uIGhhcyB0byBiZSBwcmVwcm9jZXNzZWQgdmlhXG4gKiBgY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgbG9jYWxSZXNvbHZlcjogTG9jYWxSZXNvbHZlcnxudWxsLCBpbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sXG4gICAgZXhwcmVzc2lvbldpdGhvdXRCdWlsdGluczogY2RBc3QuQVNULCBiaW5kaW5nSWQ6IHN0cmluZywgZm9ybTogQmluZGluZ0Zvcm0sXG4gICAgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uPzogSW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTogQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdCB7XG4gIGlmICghbG9jYWxSZXNvbHZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIgPSBuZXcgRGVmYXVsdExvY2FsUmVzb2x2ZXIoKTtcbiAgfVxuICBjb25zdCB2aXNpdG9yID1cbiAgICAgIG5ldyBfQXN0VG9JclZpc2l0b3IobG9jYWxSZXNvbHZlciwgaW1wbGljaXRSZWNlaXZlciwgYmluZGluZ0lkLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICBjb25zdCBvdXRwdXRFeHByOiBvLkV4cHJlc3Npb24gPSBleHByZXNzaW9uV2l0aG91dEJ1aWx0aW5zLnZpc2l0KHZpc2l0b3IsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICBjb25zdCBzdG10czogby5TdGF0ZW1lbnRbXSA9IGdldFN0YXRlbWVudHNGcm9tVmlzaXRvcih2aXNpdG9yLCBiaW5kaW5nSWQpO1xuXG4gIGlmICh2aXNpdG9yLnVzZXNJbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgbG9jYWxSZXNvbHZlci5ub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk7XG4gIH1cblxuICBpZiAodmlzaXRvci50ZW1wb3JhcnlDb3VudCA9PT0gMCAmJiBmb3JtID09IEJpbmRpbmdGb3JtLlRyeVNpbXBsZSkge1xuICAgIHJldHVybiBuZXcgQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdChbXSwgb3V0cHV0RXhwcik7XG4gIH0gZWxzZSBpZiAoZm9ybSA9PT0gQmluZGluZ0Zvcm0uRXhwcmVzc2lvbikge1xuICAgIHJldHVybiBuZXcgQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdChzdG10cywgb3V0cHV0RXhwcik7XG4gIH1cblxuICBjb25zdCBjdXJyVmFsRXhwciA9IGNyZWF0ZUN1cnJWYWx1ZUV4cHIoYmluZGluZ0lkKTtcbiAgc3RtdHMucHVzaChjdXJyVmFsRXhwci5zZXQob3V0cHV0RXhwcikudG9EZWNsU3RtdChvLkRZTkFNSUNfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSkpO1xuICByZXR1cm4gbmV3IENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQoc3RtdHMsIGN1cnJWYWxFeHByKTtcbn1cblxuLyoqXG4gKiBHaXZlbiBzb21lIGV4cHJlc3Npb24sIHN1Y2ggYXMgYSBiaW5kaW5nIG9yIGludGVycG9sYXRpb24gZXhwcmVzc2lvbiwgYW5kIGEgY29udGV4dCBleHByZXNzaW9uIHRvXG4gKiBsb29rIHZhbHVlcyB1cCBvbiwgdmlzaXQgZWFjaCBmYWNldCBvZiB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiByZXNvbHZpbmcgdmFsdWVzIGZyb20gdGhlIGNvbnRleHRcbiAqIGV4cHJlc3Npb24gc3VjaCB0aGF0IGEgbGlzdCBvZiBhcmd1bWVudHMgY2FuIGJlIGRlcml2ZWQgZnJvbSB0aGUgZm91bmQgdmFsdWVzIHRoYXQgY2FuIGJlIHVzZWQgYXNcbiAqIGFyZ3VtZW50cyB0byBhbiBleHRlcm5hbCB1cGRhdGUgaW5zdHJ1Y3Rpb24uXG4gKlxuICogQHBhcmFtIGxvY2FsUmVzb2x2ZXIgVGhlIHJlc29sdmVyIHRvIHVzZSB0byBsb29rIHVwIGV4cHJlc3Npb25zIGJ5IG5hbWUgYXBwcm9wcmlhdGVseVxuICogQHBhcmFtIGNvbnRleHRWYXJpYWJsZUV4cHJlc3Npb24gVGhlIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBjb250ZXh0IHZhcmlhYmxlIHVzZWQgdG8gY3JlYXRlXG4gKiB0aGUgZmluYWwgYXJndW1lbnQgZXhwcmVzc2lvbnNcbiAqIEBwYXJhbSBleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdCBUaGUgZXhwcmVzc2lvbiB0byB2aXNpdCB0byBmaWd1cmUgb3V0IHdoYXQgdmFsdWVzIG5lZWQgdG9cbiAqIGJlIHJlc29sdmVkIGFuZCB3aGF0IGFyZ3VtZW50cyBsaXN0IHRvIGJ1aWxkLlxuICogQHBhcmFtIGJpbmRpbmdJZCBBIG5hbWUgcHJlZml4IHVzZWQgdG8gY3JlYXRlIHRlbXBvcmFyeSB2YXJpYWJsZSBuYW1lcyBpZiB0aGV5J3JlIG5lZWRlZCBmb3IgdGhlXG4gKiBhcmd1bWVudHMgZ2VuZXJhdGVkXG4gKiBAcmV0dXJucyBBbiBhcnJheSBvZiBleHByZXNzaW9ucyB0aGF0IGNhbiBiZSBwYXNzZWQgYXMgYXJndW1lbnRzIHRvIGluc3RydWN0aW9uIGV4cHJlc3Npb25zIGxpa2VcbiAqIGBvLmltcG9ydEV4cHIoUjMucHJvcGVydHlJbnRlcnBvbGF0ZSkuY2FsbEZuKHJlc3VsdClgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0VXBkYXRlQXJndW1lbnRzKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXIsIGNvbnRleHRWYXJpYWJsZUV4cHJlc3Npb246IG8uRXhwcmVzc2lvbixcbiAgICBleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdDogY2RBc3QuQVNULCBiaW5kaW5nSWQ6IHN0cmluZykge1xuICBjb25zdCB2aXNpdG9yID1cbiAgICAgIG5ldyBfQXN0VG9JclZpc2l0b3IobG9jYWxSZXNvbHZlciwgY29udGV4dFZhcmlhYmxlRXhwcmVzc2lvbiwgYmluZGluZ0lkLCB1bmRlZmluZWQpO1xuICBjb25zdCBvdXRwdXRFeHByOiBvLkludm9rZUZ1bmN0aW9uRXhwciA9XG4gICAgICBleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdC52aXNpdCh2aXNpdG9yLCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICBpZiAodmlzaXRvci51c2VzSW1wbGljaXRSZWNlaXZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIubm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpO1xuICB9XG5cbiAgY29uc3Qgc3RtdHMgPSBnZXRTdGF0ZW1lbnRzRnJvbVZpc2l0b3IodmlzaXRvciwgYmluZGluZ0lkKTtcblxuICAvLyBSZW1vdmluZyB0aGUgZmlyc3QgYXJndW1lbnQsIGJlY2F1c2UgaXQgd2FzIGEgbGVuZ3RoIGZvciBWaWV3RW5naW5lLCBub3QgSXZ5LlxuICBsZXQgYXJncyA9IG91dHB1dEV4cHIuYXJncy5zbGljZSgxKTtcbiAgaWYgKGV4cHJlc3Npb25XaXRoQXJndW1lbnRzVG9FeHRyYWN0IGluc3RhbmNlb2YgY2RBc3QuSW50ZXJwb2xhdGlvbikge1xuICAgIC8vIElmIHdlJ3JlIGRlYWxpbmcgd2l0aCBhbiBpbnRlcnBvbGF0aW9uIG9mIDEgdmFsdWUgd2l0aCBhbiBlbXB0eSBwcmVmaXggYW5kIHN1ZmZpeCwgcmVkdWNlIHRoZVxuICAgIC8vIGFyZ3MgcmV0dXJuZWQgdG8ganVzdCB0aGUgdmFsdWUsIGJlY2F1c2Ugd2UncmUgZ29pbmcgdG8gcGFzcyBpdCB0byBhIHNwZWNpYWwgaW5zdHJ1Y3Rpb24uXG4gICAgY29uc3Qgc3RyaW5ncyA9IGV4cHJlc3Npb25XaXRoQXJndW1lbnRzVG9FeHRyYWN0LnN0cmluZ3M7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09PSAzICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgICAvLyBTaW5nbGUgYXJndW1lbnQgaW50ZXJwb2xhdGUgaW5zdHJ1Y3Rpb25zLlxuICAgICAgYXJncyA9IFthcmdzWzFdXTtcbiAgICB9IGVsc2UgaWYgKGFyZ3MubGVuZ3RoID49IDE5KSB7XG4gICAgICAvLyAxOSBvciBtb3JlIGFyZ3VtZW50cyBtdXN0IGJlIHBhc3NlZCB0byB0aGUgYGludGVycG9sYXRlVmAtc3R5bGUgaW5zdHJ1Y3Rpb25zLCB3aGljaCBhY2NlcHRcbiAgICAgIC8vIGFuIGFycmF5IG9mIGFyZ3VtZW50c1xuICAgICAgYXJncyA9IFtvLmxpdGVyYWxBcnIoYXJncyldO1xuICAgIH1cbiAgfVxuICByZXR1cm4ge3N0bXRzLCBhcmdzfTtcbn1cblxuZnVuY3Rpb24gZ2V0U3RhdGVtZW50c0Zyb21WaXNpdG9yKHZpc2l0b3I6IF9Bc3RUb0lyVmlzaXRvciwgYmluZGluZ0lkOiBzdHJpbmcpIHtcbiAgY29uc3Qgc3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2aXNpdG9yLnRlbXBvcmFyeUNvdW50OyBpKyspIHtcbiAgICBzdG10cy5wdXNoKHRlbXBvcmFyeURlY2xhcmF0aW9uKGJpbmRpbmdJZCwgaSkpO1xuICB9XG4gIHJldHVybiBzdG10cztcbn1cblxuZnVuY3Rpb24gY29udmVydEJ1aWx0aW5zKGNvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5LCBhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LkFTVCB7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX0J1aWx0aW5Bc3RDb252ZXJ0ZXIoY29udmVydGVyRmFjdG9yeSk7XG4gIHJldHVybiBhc3QudmlzaXQodmlzaXRvcik7XG59XG5cbmZ1bmN0aW9uIHRlbXBvcmFyeU5hbWUoYmluZGluZ0lkOiBzdHJpbmcsIHRlbXBvcmFyeU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGB0bXBfJHtiaW5kaW5nSWR9XyR7dGVtcG9yYXJ5TnVtYmVyfWA7XG59XG5cbmZ1bmN0aW9uIHRlbXBvcmFyeURlY2xhcmF0aW9uKGJpbmRpbmdJZDogc3RyaW5nLCB0ZW1wb3JhcnlOdW1iZXI6IG51bWJlcik6IG8uU3RhdGVtZW50IHtcbiAgcmV0dXJuIG5ldyBvLkRlY2xhcmVWYXJTdG10KHRlbXBvcmFyeU5hbWUoYmluZGluZ0lkLCB0ZW1wb3JhcnlOdW1iZXIpKTtcbn1cblxuZnVuY3Rpb24gcHJlcGVuZFRlbXBvcmFyeURlY2xzKFxuICAgIHRlbXBvcmFyeUNvdW50OiBudW1iZXIsIGJpbmRpbmdJZDogc3RyaW5nLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKSB7XG4gIGZvciAobGV0IGkgPSB0ZW1wb3JhcnlDb3VudCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgc3RhdGVtZW50cy51bnNoaWZ0KHRlbXBvcmFyeURlY2xhcmF0aW9uKGJpbmRpbmdJZCwgaSkpO1xuICB9XG59XG5cbmVudW0gX01vZGUge1xuICBTdGF0ZW1lbnQsXG4gIEV4cHJlc3Npb25cbn1cblxuZnVuY3Rpb24gZW5zdXJlU3RhdGVtZW50TW9kZShtb2RlOiBfTW9kZSwgYXN0OiBjZEFzdC5BU1QpIHtcbiAgaWYgKG1vZGUgIT09IF9Nb2RlLlN0YXRlbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYSBzdGF0ZW1lbnQsIGJ1dCBzYXcgJHthc3R9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW5zdXJlRXhwcmVzc2lvbk1vZGUobW9kZTogX01vZGUsIGFzdDogY2RBc3QuQVNUKSB7XG4gIGlmIChtb2RlICE9PSBfTW9kZS5FeHByZXNzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhbiBleHByZXNzaW9uLCBidXQgc2F3ICR7YXN0fWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGU6IF9Nb2RlLCBleHByOiBvLkV4cHJlc3Npb24pOiBvLkV4cHJlc3Npb258by5TdGF0ZW1lbnQge1xuICBpZiAobW9kZSA9PT0gX01vZGUuU3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIGV4cHIudG9TdG10KCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cbn1cblxuY2xhc3MgX0J1aWx0aW5Bc3RDb252ZXJ0ZXIgZXh0ZW5kcyBjZEFzdC5Bc3RUcmFuc2Zvcm1lciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2NvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5KSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gW2FzdC5leHAsIC4uLmFzdC5hcmdzXS5tYXAoYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFyZ3MsXG4gICAgICAgIHRoaXMuX2NvbnZlcnRlckZhY3RvcnkuY3JlYXRlUGlwZUNvbnZlcnRlcihhc3QubmFtZSwgYXJncy5sZW5ndGgpKTtcbiAgfVxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gYXN0LmV4cHJlc3Npb25zLm1hcChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFzdC5zcGFuLCBhc3Quc291cmNlU3BhbiwgYXJncyxcbiAgICAgICAgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXIoYXN0LmV4cHJlc3Npb25zLmxlbmd0aCkpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IGFzdC52YWx1ZXMubWFwKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuXG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFyZ3MsIHRoaXMuX2NvbnZlcnRlckZhY3RvcnkuY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcihhc3Qua2V5cykpO1xuICB9XG59XG5cbmNsYXNzIF9Bc3RUb0lyVmlzaXRvciBpbXBsZW1lbnRzIGNkQXN0LkFzdFZpc2l0b3Ige1xuICBwcml2YXRlIF9ub2RlTWFwID0gbmV3IE1hcDxjZEFzdC5BU1QsIGNkQXN0LkFTVD4oKTtcbiAgcHJpdmF0ZSBfcmVzdWx0TWFwID0gbmV3IE1hcDxjZEFzdC5BU1QsIG8uRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBfY3VycmVudFRlbXBvcmFyeTogbnVtYmVyID0gMDtcbiAgcHVibGljIHRlbXBvcmFyeUNvdW50OiBudW1iZXIgPSAwO1xuICBwdWJsaWMgdXNlc0ltcGxpY2l0UmVjZWl2ZXI6IGJvb2xlYW4gPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2xvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXIsIHByaXZhdGUgX2ltcGxpY2l0UmVjZWl2ZXI6IG8uRXhwcmVzc2lvbixcbiAgICAgIHByaXZhdGUgYmluZGluZ0lkOiBzdHJpbmcsIHByaXZhdGUgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uOiBJbnRlcnBvbGF0aW9uRnVuY3Rpb258dW5kZWZpbmVkLFxuICAgICAgcHJpdmF0ZSBiYXNlU291cmNlU3Bhbj86IFBhcnNlU291cmNlU3BhbiwgcHJpdmF0ZSBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXM/OiBTZXQ8c3RyaW5nPikge31cblxuICB2aXNpdFVuYXJ5KGFzdDogY2RBc3QuVW5hcnksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBsZXQgb3A6IG8uVW5hcnlPcGVyYXRvcjtcbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRvcikge1xuICAgICAgY2FzZSAnKyc6XG4gICAgICAgIG9wID0gby5VbmFyeU9wZXJhdG9yLlBsdXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLSc6XG4gICAgICAgIG9wID0gby5VbmFyeU9wZXJhdG9yLk1pbnVzO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgb3BlcmF0b3IgJHthc3Qub3BlcmF0b3J9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICBtb2RlLFxuICAgICAgICBuZXcgby5VbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIG9wLCB0aGlzLl92aXNpdChhc3QuZXhwciwgX01vZGUuRXhwcmVzc2lvbiksIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICB2aXNpdEJpbmFyeShhc3Q6IGNkQXN0LkJpbmFyeSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGxldCBvcDogby5CaW5hcnlPcGVyYXRvcjtcbiAgICBzd2l0Y2ggKGFzdC5vcGVyYXRpb24pIHtcbiAgICAgIGNhc2UgJysnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuUGx1cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICctJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk1pbnVzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyonOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLyc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5EaXZpZGU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnJSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Nb2R1bG87XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnJiYnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQW5kO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3x8JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk9yO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICchPSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLklkZW50aWNhbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICchPT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTm90SWRlbnRpY2FsO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJzwnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTG93ZXI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPic6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5CaWdnZXI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPD0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPj0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyRXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz8/JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udmVydE51bGxpc2hDb2FsZXNjZShhc3QsIG1vZGUpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBvcGVyYXRpb24gJHthc3Qub3BlcmF0aW9ufWApO1xuICAgIH1cblxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSxcbiAgICAgICAgbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgb3AsIHRoaXMuX3Zpc2l0KGFzdC5sZWZ0LCBfTW9kZS5FeHByZXNzaW9uKSwgdGhpcy5fdmlzaXQoYXN0LnJpZ2h0LCBfTW9kZS5FeHByZXNzaW9uKSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpKTtcbiAgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbiwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGVuc3VyZVN0YXRlbWVudE1vZGUobW9kZSwgYXN0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMsIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgdmFsdWU6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5jb25kaXRpb24sIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSxcbiAgICAgICAgdmFsdWUuY29uZGl0aW9uYWwoXG4gICAgICAgICAgICB0aGlzLl92aXNpdChhc3QudHJ1ZUV4cCwgX01vZGUuRXhwcmVzc2lvbiksIHRoaXMuX3Zpc2l0KGFzdC5mYWxzZUV4cCwgX01vZGUuRXhwcmVzc2lvbiksXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSkpO1xuICB9XG5cbiAgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBQaXBlcyBzaG91bGQgaGF2ZSBiZWVuIGNvbnZlcnRlZCBpbnRvIGZ1bmN0aW9ucy4gUGlwZTogJHthc3QubmFtZX1gKTtcbiAgfVxuXG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogY2RBc3QuRnVuY3Rpb25DYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgY29udmVydGVkQXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGxldCBmblJlc3VsdDogby5FeHByZXNzaW9uO1xuICAgIGlmIChhc3QgaW5zdGFuY2VvZiBCdWlsdGluRnVuY3Rpb25DYWxsKSB7XG4gICAgICBmblJlc3VsdCA9IGFzdC5jb252ZXJ0ZXIoY29udmVydGVkQXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZuUmVzdWx0ID0gdGhpcy5fdmlzaXQoYXN0LnRhcmdldCEsIF9Nb2RlLkV4cHJlc3Npb24pXG4gICAgICAgICAgICAgICAgICAgICAuY2FsbEZuKGNvbnZlcnRlZEFyZ3MsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGZuUmVzdWx0KTtcbiAgfVxuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVFeHByZXNzaW9uTW9kZShtb2RlLCBhc3QpO1xuICAgIHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyO1xuICB9XG5cbiAgdmlzaXRUaGlzUmVjZWl2ZXIoYXN0OiBjZEFzdC5UaGlzUmVjZWl2ZXIsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy52aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0LCBtb2RlKTtcbiAgfVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24sIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVFeHByZXNzaW9uTW9kZShtb2RlLCBhc3QpO1xuICAgIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKGFzdC5leHByZXNzaW9ucy5sZW5ndGgpXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzdC5zdHJpbmdzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgYXJncy5wdXNoKG8ubGl0ZXJhbChhc3Quc3RyaW5nc1tpXSkpO1xuICAgICAgYXJncy5wdXNoKHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uc1tpXSwgX01vZGUuRXhwcmVzc2lvbikpO1xuICAgIH1cbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGFzdC5zdHJpbmdzW2FzdC5zdHJpbmdzLmxlbmd0aCAtIDFdKSk7XG5cbiAgICBpZiAodGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdC5leHByZXNzaW9ucy5sZW5ndGggPD0gOSA/XG4gICAgICAgIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5pbmxpbmVJbnRlcnBvbGF0ZSkuY2FsbEZuKGFyZ3MpIDpcbiAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmludGVycG9sYXRlKS5jYWxsRm4oW1xuICAgICAgICAgIGFyZ3NbMF0sIG8ubGl0ZXJhbEFycihhcmdzLnNsaWNlKDEpLCB1bmRlZmluZWQsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKVxuICAgICAgICBdKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogY2RBc3QuS2V5ZWRSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgbGVmdE1vc3RTYWZlID0gdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCk7XG4gICAgaWYgKGxlZnRNb3N0U2FmZSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCBsZWZ0TW9zdFNhZmUsIG1vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgICAgbW9kZSwgdGhpcy5fdmlzaXQoYXN0Lm9iaiwgX01vZGUuRXhwcmVzc2lvbikua2V5KHRoaXMuX3Zpc2l0KGFzdC5rZXksIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IG9iajogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0Lm9iaiwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3Qga2V5OiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3Qua2V5LCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCB2YWx1ZTogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LnZhbHVlLCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICAgIGlmIChvYmogPT09IHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgIHRoaXMuX2xvY2FsUmVzb2x2ZXIubWF5YmVSZXN0b3JlVmlldygwLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG9iai5rZXkoa2V5KS5zZXQodmFsdWUpKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBsaXRlcmFsIGFycmF5cyBzaG91bGQgaGF2ZSBiZWVuIGNvbnZlcnRlZCBpbnRvIGZ1bmN0aW9uc2ApO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogY2RBc3QuTGl0ZXJhbE1hcCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBTdGF0ZTogbGl0ZXJhbCBtYXBzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zYCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBjZEFzdC5MaXRlcmFsUHJpbWl0aXZlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgLy8gRm9yIGxpdGVyYWwgdmFsdWVzIG9mIG51bGwsIHVuZGVmaW5lZCwgdHJ1ZSwgb3IgZmFsc2UgYWxsb3cgdHlwZSBpbnRlcmZlcmVuY2VcbiAgICAvLyB0byBpbmZlciB0aGUgdHlwZS5cbiAgICBjb25zdCB0eXBlID1cbiAgICAgICAgYXN0LnZhbHVlID09PSBudWxsIHx8IGFzdC52YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IGFzdC52YWx1ZSA9PT0gdHJ1ZSB8fCBhc3QudmFsdWUgPT09IHRydWUgP1xuICAgICAgICBvLklORkVSUkVEX1RZUEUgOlxuICAgICAgICB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICBtb2RlLCBvLmxpdGVyYWwoYXN0LnZhbHVlLCB0eXBlLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0TG9jYWwobmFtZTogc3RyaW5nLCByZWNlaXZlcjogY2RBc3QuQVNUKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmICh0aGlzLl9sb2NhbFJlc29sdmVyLmdsb2JhbHM/LmhhcyhuYW1lKSAmJiByZWNlaXZlciBpbnN0YW5jZW9mIGNkQXN0LlRoaXNSZWNlaXZlcikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2xvY2FsUmVzb2x2ZXIuZ2V0TG9jYWwobmFtZSk7XG4gIH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBjZEFzdC5NZXRob2RDYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgaWYgKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIgJiZcbiAgICAgICAgIShhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBjZEFzdC5UaGlzUmVjZWl2ZXIpICYmIGFzdC5uYW1lID09PSAnJGFueScpIHtcbiAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBfTW9kZS5FeHByZXNzaW9uKSBhcyBhbnlbXTtcbiAgICAgIGlmIChhcmdzLmxlbmd0aCAhPSAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBJbnZhbGlkIGNhbGwgdG8gJGFueSwgZXhwZWN0ZWQgMSBhcmd1bWVudCBidXQgcmVjZWl2ZWQgJHthcmdzLmxlbmd0aCB8fCAnbm9uZSd9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gKGFyZ3NbMF0gYXMgby5FeHByZXNzaW9uKS5jYXN0KG8uRFlOQU1JQ19UWVBFLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSk7XG4gICAgfVxuXG4gICAgY29uc3QgbGVmdE1vc3RTYWZlID0gdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCk7XG4gICAgaWYgKGxlZnRNb3N0U2FmZSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCBsZWZ0TW9zdFNhZmUsIG1vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChhc3QuYXJncywgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgICBjb25zdCBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuICAgICAgbGV0IHJlc3VsdDogYW55ID0gbnVsbDtcbiAgICAgIGNvbnN0IHJlY2VpdmVyID0gdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgICBjb25zdCB2YXJFeHByID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUsIGFzdC5yZWNlaXZlcik7XG4gICAgICAgIGlmICh2YXJFeHByKSB7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgXCJ1c2VzSW1wbGljaXRSZWNlaXZlclwiIHN0YXRlIHNpbmNlIHRoZSBpbXBsaWNpdFxuICAgICAgICAgIC8vIHJlY2VpdmVyIGhhcyBiZWVuIHJlcGxhY2VkIHdpdGggYSByZXNvbHZlZCBsb2NhbCBleHByZXNzaW9uLlxuICAgICAgICAgIHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXI7XG4gICAgICAgICAgcmVzdWx0ID0gdmFyRXhwci5jYWxsRm4oYXJncyk7XG4gICAgICAgICAgdGhpcy5hZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKGFzdC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCA9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLmNhbGxNZXRob2QoYXN0Lm5hbWUsIGFyZ3MsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCByZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG8ubm90KHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgby5hc3NlcnROb3ROdWxsKHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuICAgICAgY29uc3QgcmVjZWl2ZXIgPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgICAgaWYgKHJlY2VpdmVyID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMuX2dldExvY2FsKGFzdC5uYW1lLCBhc3QucmVjZWl2ZXIpO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgXCJ1c2VzSW1wbGljaXRSZWNlaXZlclwiIHN0YXRlIHNpbmNlIHRoZSBpbXBsaWNpdFxuICAgICAgICAgIC8vIHJlY2VpdmVyIGhhcyBiZWVuIHJlcGxhY2VkIHdpdGggYSByZXNvbHZlZCBsb2NhbCBleHByZXNzaW9uLlxuICAgICAgICAgIHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXI7XG4gICAgICAgICAgdGhpcy5hZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKGFzdC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCA9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLnByb3AoYXN0Lm5hbWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIHJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogY2RBc3QuUHJvcGVydHlXcml0ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IHJlY2VpdmVyOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGNvbnN0IHByZXZVc2VzSW1wbGljaXRSZWNlaXZlciA9IHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXI7XG5cbiAgICBsZXQgdmFyRXhwcjogby5SZWFkUHJvcEV4cHJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHJlY2VpdmVyID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICBjb25zdCBsb2NhbEV4cHIgPSB0aGlzLl9nZXRMb2NhbChhc3QubmFtZSwgYXN0LnJlY2VpdmVyKTtcbiAgICAgIGlmIChsb2NhbEV4cHIpIHtcbiAgICAgICAgaWYgKGxvY2FsRXhwciBpbnN0YW5jZW9mIG8uUmVhZFByb3BFeHByKSB7XG4gICAgICAgICAgLy8gSWYgdGhlIGxvY2FsIHZhcmlhYmxlIGlzIGEgcHJvcGVydHkgcmVhZCBleHByZXNzaW9uLCBpdCdzIGEgcmVmZXJlbmNlXG4gICAgICAgICAgLy8gdG8gYSAnY29udGV4dC5wcm9wZXJ0eScgdmFsdWUgYW5kIHdpbGwgYmUgdXNlZCBhcyB0aGUgdGFyZ2V0IG9mIHRoZVxuICAgICAgICAgIC8vIHdyaXRlIGV4cHJlc3Npb24uXG4gICAgICAgICAgdmFyRXhwciA9IGxvY2FsRXhwcjtcbiAgICAgICAgICAvLyBSZXN0b3JlIHRoZSBwcmV2aW91cyBcInVzZXNJbXBsaWNpdFJlY2VpdmVyXCIgc3RhdGUgc2luY2UgdGhlIGltcGxpY2l0XG4gICAgICAgICAgLy8gcmVjZWl2ZXIgaGFzIGJlZW4gcmVwbGFjZWQgd2l0aCBhIHJlc29sdmVkIGxvY2FsIGV4cHJlc3Npb24uXG4gICAgICAgICAgdGhpcy51c2VzSW1wbGljaXRSZWNlaXZlciA9IHByZXZVc2VzSW1wbGljaXRSZWNlaXZlcjtcbiAgICAgICAgICB0aGlzLmFkZEltcGxpY2l0UmVjZWl2ZXJBY2Nlc3MoYXN0Lm5hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSBpdCdzIGFuIGVycm9yLlxuICAgICAgICAgIGNvbnN0IHJlY2VpdmVyID0gYXN0Lm5hbWU7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSAoYXN0LnZhbHVlIGluc3RhbmNlb2YgY2RBc3QuUHJvcGVydHlSZWFkKSA/IGFzdC52YWx1ZS5uYW1lIDogdW5kZWZpbmVkO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGFzc2lnbiB2YWx1ZSBcIiR7dmFsdWV9XCIgdG8gdGVtcGxhdGUgdmFyaWFibGUgXCIke1xuICAgICAgICAgICAgICByZWNlaXZlcn1cIi4gVGVtcGxhdGUgdmFyaWFibGVzIGFyZSByZWFkLW9ubHkuYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gSWYgbm8gbG9jYWwgZXhwcmVzc2lvbiBjb3VsZCBiZSBwcm9kdWNlZCwgdXNlIHRoZSBvcmlnaW5hbCByZWNlaXZlcidzXG4gICAgLy8gcHJvcGVydHkgYXMgdGhlIHRhcmdldC5cbiAgICBpZiAodmFyRXhwciA9PT0gbnVsbCkge1xuICAgICAgdmFyRXhwciA9IHJlY2VpdmVyLnByb3AoYXN0Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgdmFyRXhwci5zZXQodGhpcy5fdmlzaXQoYXN0LnZhbHVlLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogY2RBc3QuU2FmZVByb3BlcnR5UmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCksIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IGNkQXN0LlNhZmVNZXRob2RDYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KSwgbW9kZSk7XG4gIH1cblxuICB2aXNpdEFsbChhc3RzOiBjZEFzdC5BU1RbXSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBhc3RzLm1hcChhc3QgPT4gdGhpcy5fdmlzaXQoYXN0LCBtb2RlKSk7XG4gIH1cblxuICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFF1b3RlcyBhcmUgbm90IHN1cHBvcnRlZCBmb3IgZXZhbHVhdGlvbiFcbiAgICAgICAgU3RhdGVtZW50OiAke2FzdC51bmludGVycHJldGVkRXhwcmVzc2lvbn0gbG9jYXRlZCBhdCAke2FzdC5sb2NhdGlvbn1gKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0KGFzdDogY2RBc3QuQVNULCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fcmVzdWx0TWFwLmdldChhc3QpO1xuICAgIGlmIChyZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgcmV0dXJuICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodGhpcywgbW9kZSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRTYWZlQWNjZXNzKFxuICAgICAgYXN0OiBjZEFzdC5BU1QsIGxlZnRNb3N0U2FmZTogY2RBc3QuU2FmZU1ldGhvZENhbGx8Y2RBc3QuU2FmZVByb3BlcnR5UmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGNvbnRhaW5zIGEgc2FmZSBhY2Nlc3Mgbm9kZSBvbiB0aGUgbGVmdCBpdCBuZWVkcyB0byBiZSBjb252ZXJ0ZWQgdG9cbiAgICAvLyBhbiBleHByZXNzaW9uIHRoYXQgZ3VhcmRzIHRoZSBhY2Nlc3MgdG8gdGhlIG1lbWJlciBieSBjaGVja2luZyB0aGUgcmVjZWl2ZXIgZm9yIGJsYW5rLiBBc1xuICAgIC8vIGV4ZWN1dGlvbiBwcm9jZWVkcyBmcm9tIGxlZnQgdG8gcmlnaHQsIHRoZSBsZWZ0IG1vc3QgcGFydCBvZiB0aGUgZXhwcmVzc2lvbiBtdXN0IGJlIGd1YXJkZWRcbiAgICAvLyBmaXJzdCBidXQsIGJlY2F1c2UgbWVtYmVyIGFjY2VzcyBpcyBsZWZ0IGFzc29jaWF0aXZlLCB0aGUgcmlnaHQgc2lkZSBvZiB0aGUgZXhwcmVzc2lvbiBpcyBhdFxuICAgIC8vIHRoZSB0b3Agb2YgdGhlIEFTVC4gVGhlIGRlc2lyZWQgcmVzdWx0IHJlcXVpcmVzIGxpZnRpbmcgYSBjb3B5IG9mIHRoZSBsZWZ0IHBhcnQgb2YgdGhlXG4gICAgLy8gZXhwcmVzc2lvbiB1cCB0byB0ZXN0IGl0IGZvciBibGFuayBiZWZvcmUgZ2VuZXJhdGluZyB0aGUgdW5ndWFyZGVkIHZlcnNpb24uXG5cbiAgICAvLyBDb25zaWRlciwgZm9yIGV4YW1wbGUgdGhlIGZvbGxvd2luZyBleHByZXNzaW9uOiBhPy5iLmM/LmQuZVxuXG4gICAgLy8gVGhpcyByZXN1bHRzIGluIHRoZSBhc3Q6XG4gICAgLy8gICAgICAgICAuXG4gICAgLy8gICAgICAgIC8gXFxcbiAgICAvLyAgICAgICA/LiAgIGVcbiAgICAvLyAgICAgIC8gIFxcXG4gICAgLy8gICAgIC4gICAgZFxuICAgIC8vICAgIC8gXFxcbiAgICAvLyAgID8uICBjXG4gICAgLy8gIC8gIFxcXG4gICAgLy8gYSAgICBiXG5cbiAgICAvLyBUaGUgZm9sbG93aW5nIHRyZWUgc2hvdWxkIGJlIGdlbmVyYXRlZDpcbiAgICAvL1xuICAgIC8vICAgICAgICAvLS0tLSA/IC0tLS1cXFxuICAgIC8vICAgICAgIC8gICAgICB8ICAgICAgXFxcbiAgICAvLyAgICAgYSAgIC8tLS0gPyAtLS1cXCAgbnVsbFxuICAgIC8vICAgICAgICAvICAgICB8ICAgICBcXFxuICAgIC8vICAgICAgIC4gICAgICAuICAgICBudWxsXG4gICAgLy8gICAgICAvIFxcICAgIC8gXFxcbiAgICAvLyAgICAgLiAgYyAgIC4gICBlXG4gICAgLy8gICAgLyBcXCAgICAvIFxcXG4gICAgLy8gICBhICAgYiAgLiAgIGRcbiAgICAvLyAgICAgICAgIC8gXFxcbiAgICAvLyAgICAgICAgLiAgIGNcbiAgICAvLyAgICAgICAvIFxcXG4gICAgLy8gICAgICBhICAgYlxuICAgIC8vXG4gICAgLy8gTm90aWNlIHRoYXQgdGhlIGZpcnN0IGd1YXJkIGNvbmRpdGlvbiBpcyB0aGUgbGVmdCBoYW5kIG9mIHRoZSBsZWZ0IG1vc3Qgc2FmZSBhY2Nlc3Mgbm9kZVxuICAgIC8vIHdoaWNoIGNvbWVzIGluIGFzIGxlZnRNb3N0U2FmZSB0byB0aGlzIHJvdXRpbmUuXG5cbiAgICBsZXQgZ3VhcmRlZEV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGxldCB0ZW1wb3Jhcnk6IG8uUmVhZFZhckV4cHIgPSB1bmRlZmluZWQhO1xuICAgIGlmICh0aGlzLm5lZWRzVGVtcG9yYXJ5SW5TYWZlQWNjZXNzKGxlZnRNb3N0U2FmZS5yZWNlaXZlcikpIHtcbiAgICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGhhcyBtZXRob2QgY2FsbHMgb3IgcGlwZXMgdGhlbiB3ZSBuZWVkIHRvIHNhdmUgdGhlIHJlc3VsdCBpbnRvIGFcbiAgICAgIC8vIHRlbXBvcmFyeSB2YXJpYWJsZSB0byBhdm9pZCBjYWxsaW5nIHN0YXRlZnVsIG9yIGltcHVyZSBjb2RlIG1vcmUgdGhhbiBvbmNlLlxuICAgICAgdGVtcG9yYXJ5ID0gdGhpcy5hbGxvY2F0ZVRlbXBvcmFyeSgpO1xuXG4gICAgICAvLyBQcmVzZXJ2ZSB0aGUgcmVzdWx0IGluIHRoZSB0ZW1wb3JhcnkgdmFyaWFibGVcbiAgICAgIGd1YXJkZWRFeHByZXNzaW9uID0gdGVtcG9yYXJ5LnNldChndWFyZGVkRXhwcmVzc2lvbik7XG5cbiAgICAgIC8vIEVuc3VyZSBhbGwgZnVydGhlciByZWZlcmVuY2VzIHRvIHRoZSBndWFyZGVkIGV4cHJlc3Npb24gcmVmZXIgdG8gdGhlIHRlbXBvcmFyeSBpbnN0ZWFkLlxuICAgICAgdGhpcy5fcmVzdWx0TWFwLnNldChsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIHRlbXBvcmFyeSk7XG4gICAgfVxuICAgIGNvbnN0IGNvbmRpdGlvbiA9IGd1YXJkZWRFeHByZXNzaW9uLmlzQmxhbmsoKTtcblxuICAgIC8vIENvbnZlcnQgdGhlIGFzdCB0byBhbiB1bmd1YXJkZWQgYWNjZXNzIHRvIHRoZSByZWNlaXZlcidzIG1lbWJlci4gVGhlIG1hcCB3aWxsIHN1YnN0aXR1dGVcbiAgICAvLyBsZWZ0TW9zdE5vZGUgd2l0aCBpdHMgdW5ndWFyZGVkIHZlcnNpb24gaW4gdGhlIGNhbGwgdG8gYHRoaXMudmlzaXQoKWAuXG4gICAgaWYgKGxlZnRNb3N0U2FmZSBpbnN0YW5jZW9mIGNkQXN0LlNhZmVNZXRob2RDYWxsKSB7XG4gICAgICB0aGlzLl9ub2RlTWFwLnNldChcbiAgICAgICAgICBsZWZ0TW9zdFNhZmUsXG4gICAgICAgICAgbmV3IGNkQXN0Lk1ldGhvZENhbGwoXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5zcGFuLCBsZWZ0TW9zdFNhZmUuc291cmNlU3BhbiwgbGVmdE1vc3RTYWZlLm5hbWVTcGFuLFxuICAgICAgICAgICAgICBsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIGxlZnRNb3N0U2FmZS5uYW1lLCBsZWZ0TW9zdFNhZmUuYXJncyxcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLmFyZ3VtZW50U3BhbikpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ub2RlTWFwLnNldChcbiAgICAgICAgICBsZWZ0TW9zdFNhZmUsXG4gICAgICAgICAgbmV3IGNkQXN0LlByb3BlcnR5UmVhZChcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLnNwYW4sIGxlZnRNb3N0U2FmZS5zb3VyY2VTcGFuLCBsZWZ0TW9zdFNhZmUubmFtZVNwYW4sXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgbGVmdE1vc3RTYWZlLm5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBSZWN1cnNpdmVseSBjb252ZXJ0IHRoZSBub2RlIG5vdyB3aXRob3V0IHRoZSBndWFyZGVkIG1lbWJlciBhY2Nlc3MuXG4gICAgY29uc3QgYWNjZXNzID0gdGhpcy5fdmlzaXQoYXN0LCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICAgIC8vIFJlbW92ZSB0aGUgbWFwcGluZy4gVGhpcyBpcyBub3Qgc3RyaWN0bHkgcmVxdWlyZWQgYXMgdGhlIGNvbnZlcnRlciBvbmx5IHRyYXZlcnNlcyBlYWNoIG5vZGVcbiAgICAvLyBvbmNlIGJ1dCBpcyBzYWZlciBpZiB0aGUgY29udmVyc2lvbiBpcyBjaGFuZ2VkIHRvIHRyYXZlcnNlIHRoZSBub2RlcyBtb3JlIHRoYW4gb25jZS5cbiAgICB0aGlzLl9ub2RlTWFwLmRlbGV0ZShsZWZ0TW9zdFNhZmUpO1xuXG4gICAgLy8gSWYgd2UgYWxsb2NhdGVkIGEgdGVtcG9yYXJ5LCByZWxlYXNlIGl0LlxuICAgIGlmICh0ZW1wb3JhcnkpIHtcbiAgICAgIHRoaXMucmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3JhcnkpO1xuICAgIH1cblxuICAgIC8vIFByb2R1Y2UgdGhlIGNvbmRpdGlvbmFsXG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGNvbmRpdGlvbi5jb25kaXRpb25hbChvLk5VTExfRVhQUiwgYWNjZXNzKSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnROdWxsaXNoQ29hbGVzY2UoYXN0OiBjZEFzdC5CaW5hcnksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0OiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QubGVmdCwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3QgcmlnaHQ6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5yaWdodCwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGhpcy5hbGxvY2F0ZVRlbXBvcmFyeSgpO1xuICAgIHRoaXMucmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3JhcnkpO1xuXG4gICAgLy8gR2VuZXJhdGUgdGhlIGZvbGxvd2luZyBleHByZXNzaW9uLiBJdCBpcyBpZGVudGljYWwgdG8gaG93IFRTXG4gICAgLy8gdHJhbnNwaWxlcyBiaW5hcnkgZXhwcmVzc2lvbnMgd2l0aCBhIG51bGxpc2ggY29hbGVzY2luZyBvcGVyYXRvci5cbiAgICAvLyBsZXQgdGVtcDtcbiAgICAvLyAodGVtcCA9IGEpICE9PSBudWxsICYmIHRlbXAgIT09IHVuZGVmaW5lZCA/IHRlbXAgOiBiO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSxcbiAgICAgICAgdGVtcG9yYXJ5LnNldChsZWZ0KVxuICAgICAgICAgICAgLm5vdElkZW50aWNhbChvLk5VTExfRVhQUilcbiAgICAgICAgICAgIC5hbmQodGVtcG9yYXJ5Lm5vdElkZW50aWNhbChvLmxpdGVyYWwodW5kZWZpbmVkKSkpXG4gICAgICAgICAgICAuY29uZGl0aW9uYWwodGVtcG9yYXJ5LCByaWdodCkpO1xuICB9XG5cbiAgLy8gR2l2ZW4gYW4gZXhwcmVzc2lvbiBvZiB0aGUgZm9ybSBhPy5iLmM/LmQuZSB0aGVuIHRoZSBsZWZ0IG1vc3Qgc2FmZSBub2RlIGlzXG4gIC8vIHRoZSAoYT8uYikuIFRoZSAuIGFuZCA/LiBhcmUgbGVmdCBhc3NvY2lhdGl2ZSB0aHVzIGNhbiBiZSByZXdyaXR0ZW4gYXM6XG4gIC8vICgoKChhPy5jKS5iKS5jKT8uZCkuZS4gVGhpcyByZXR1cm5zIHRoZSBtb3N0IGRlZXBseSBuZXN0ZWQgc2FmZSByZWFkIG9yXG4gIC8vIHNhZmUgbWV0aG9kIGNhbGwgYXMgdGhpcyBuZWVkcyB0byBiZSB0cmFuc2Zvcm1lZCBpbml0aWFsbHkgdG86XG4gIC8vICAgYSA9PSBudWxsID8gbnVsbCA6IGEuYy5iLmM/LmQuZVxuICAvLyB0aGVuIHRvOlxuICAvLyAgIGEgPT0gbnVsbCA/IG51bGwgOiBhLmIuYyA9PSBudWxsID8gbnVsbCA6IGEuYi5jLmQuZVxuICBwcml2YXRlIGxlZnRNb3N0U2FmZU5vZGUoYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkfGNkQXN0LlNhZmVNZXRob2RDYWxsIHtcbiAgICBjb25zdCB2aXNpdCA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVCk6IGFueSA9PiB7XG4gICAgICByZXR1cm4gKHRoaXMuX25vZGVNYXAuZ2V0KGFzdCkgfHwgYXN0KS52aXNpdCh2aXNpdG9yKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRVbmFyeShhc3Q6IGNkQXN0LlVuYXJ5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0QmluYXJ5KGFzdDogY2RBc3QuQmluYXJ5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdENvbmRpdGlvbmFsKGFzdDogY2RBc3QuQ29uZGl0aW9uYWwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBjZEFzdC5GdW5jdGlvbkNhbGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogY2RBc3QuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFRoaXNSZWNlaXZlcihhc3Q6IGNkQXN0LlRoaXNSZWNlaXZlcikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBjZEFzdC5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0S2V5ZWRSZWFkKGFzdDogY2RBc3QuS2V5ZWRSZWFkKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3Qub2JqKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXApIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogY2RBc3QuTGl0ZXJhbFByaW1pdGl2ZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdE1ldGhvZENhbGwoYXN0OiBjZEFzdC5NZXRob2RDYWxsKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0Lk5vbk51bGxBc3NlcnQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogY2RBc3QuUHJvcGVydHlXcml0ZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IGNkQXN0LlNhZmVNZXRob2RDYWxsKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBvZiB0aGUgQVNUIGluY2x1ZGVzIGEgbWV0aG9kIG9yIGEgcGlwZSBpbmRpY2F0aW5nIHRoYXQsIGlmIHRoZVxuICAvLyBleHByZXNzaW9uIGlzIHVzZWQgYXMgdGhlIHRhcmdldCBvZiBhIHNhZmUgcHJvcGVydHkgb3IgbWV0aG9kIGFjY2VzcyB0aGVuXG4gIC8vIHRoZSBleHByZXNzaW9uIHNob3VsZCBiZSBzdG9yZWQgaW50byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgcHJpdmF0ZSBuZWVkc1RlbXBvcmFyeUluU2FmZUFjY2Vzcyhhc3Q6IGNkQXN0LkFTVCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHZpc2l0ID0gKHZpc2l0b3I6IGNkQXN0LkFzdFZpc2l0b3IsIGFzdDogY2RBc3QuQVNUKTogYm9vbGVhbiA9PiB7XG4gICAgICByZXR1cm4gYXN0ICYmICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodmlzaXRvcik7XG4gICAgfTtcbiAgICBjb25zdCB2aXNpdFNvbWUgPSAodmlzaXRvcjogY2RBc3QuQXN0VmlzaXRvciwgYXN0OiBjZEFzdC5BU1RbXSk6IGJvb2xlYW4gPT4ge1xuICAgICAgcmV0dXJuIGFzdC5zb21lKGFzdCA9PiB2aXNpdCh2aXNpdG9yLCBhc3QpKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRVbmFyeShhc3Q6IGNkQXN0LlVuYXJ5KTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QuZXhwcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnkpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5sZWZ0KSB8fCB2aXNpdCh0aGlzLCBhc3QucmlnaHQpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QuY29uZGl0aW9uKSB8fCB2aXNpdCh0aGlzLCBhc3QudHJ1ZUV4cCkgfHwgdmlzaXQodGhpcywgYXN0LmZhbHNlRXhwKTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IGNkQXN0LkZ1bmN0aW9uQ2FsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFRoaXNSZWNlaXZlcihhc3Q6IGNkQXN0LlRoaXNSZWNlaXZlcikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogY2RBc3QuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICByZXR1cm4gdmlzaXRTb21lKHRoaXMsIGFzdC5leHByZXNzaW9ucyk7XG4gICAgICB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IGNkQXN0LktleWVkV3JpdGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXApIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogY2RBc3QuTGl0ZXJhbFByaW1pdGl2ZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRNZXRob2RDYWxsKGFzdDogY2RBc3QuTWV0aG9kQ2FsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByZWZpeE5vdChhc3Q6IGNkQXN0LlByZWZpeE5vdCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHJlc3Npb24pO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0LlByZWZpeE5vdCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHJlc3Npb24pO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogY2RBc3QuUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBjZEFzdC5Qcm9wZXJ0eVdyaXRlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVUZW1wb3JhcnkoKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgdGVtcE51bWJlciA9IHRoaXMuX2N1cnJlbnRUZW1wb3JhcnkrKztcbiAgICB0aGlzLnRlbXBvcmFyeUNvdW50ID0gTWF0aC5tYXgodGhpcy5fY3VycmVudFRlbXBvcmFyeSwgdGhpcy50ZW1wb3JhcnlDb3VudCk7XG4gICAgcmV0dXJuIG5ldyBvLlJlYWRWYXJFeHByKHRlbXBvcmFyeU5hbWUodGhpcy5iaW5kaW5nSWQsIHRlbXBOdW1iZXIpKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVsZWFzZVRlbXBvcmFyeSh0ZW1wb3Jhcnk6IG8uUmVhZFZhckV4cHIpIHtcbiAgICB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5LS07XG4gICAgaWYgKHRlbXBvcmFyeS5uYW1lICE9IHRlbXBvcmFyeU5hbWUodGhpcy5iaW5kaW5nSWQsIHRoaXMuX2N1cnJlbnRUZW1wb3JhcnkpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRlbXBvcmFyeSAke3RlbXBvcmFyeS5uYW1lfSByZWxlYXNlZCBvdXQgb2Ygb3JkZXJgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhYnNvbHV0ZSBgUGFyc2VTb3VyY2VTcGFuYCBmcm9tIHRoZSByZWxhdGl2ZSBgUGFyc2VTcGFuYC5cbiAgICpcbiAgICogYFBhcnNlU3BhbmAgb2JqZWN0cyBhcmUgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBleHByZXNzaW9uLlxuICAgKiBUaGlzIG1ldGhvZCBjb252ZXJ0cyB0aGVzZSB0byBmdWxsIGBQYXJzZVNvdXJjZVNwYW5gIG9iamVjdHMgdGhhdFxuICAgKiBzaG93IHdoZXJlIHRoZSBzcGFuIGlzIHdpdGhpbiB0aGUgb3ZlcmFsbCBzb3VyY2UgZmlsZS5cbiAgICpcbiAgICogQHBhcmFtIHNwYW4gdGhlIHJlbGF0aXZlIHNwYW4gdG8gY29udmVydC5cbiAgICogQHJldHVybnMgYSBgUGFyc2VTb3VyY2VTcGFuYCBmb3IgdGhlIGdpdmVuIHNwYW4gb3IgbnVsbCBpZiBub1xuICAgKiBgYmFzZVNvdXJjZVNwYW5gIHdhcyBwcm92aWRlZCB0byB0aGlzIGNsYXNzLlxuICAgKi9cbiAgcHJpdmF0ZSBjb252ZXJ0U291cmNlU3BhbihzcGFuOiBjZEFzdC5QYXJzZVNwYW4pIHtcbiAgICBpZiAodGhpcy5iYXNlU291cmNlU3Bhbikge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmJhc2VTb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShzcGFuLnN0YXJ0KTtcbiAgICAgIGNvbnN0IGVuZCA9IHRoaXMuYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uZW5kKTtcbiAgICAgIGNvbnN0IGZ1bGxTdGFydCA9IHRoaXMuYmFzZVNvdXJjZVNwYW4uZnVsbFN0YXJ0Lm1vdmVCeShzcGFuLnN0YXJ0KTtcbiAgICAgIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LCBlbmQsIGZ1bGxTdGFydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBBZGRzIHRoZSBuYW1lIG9mIGFuIEFTVCB0byB0aGUgbGlzdCBvZiBpbXBsaWNpdCByZWNlaXZlciBhY2Nlc3Nlcy4gKi9cbiAgcHJpdmF0ZSBhZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKG5hbWU6IHN0cmluZykge1xuICAgIGlmICh0aGlzLmltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcykge1xuICAgICAgdGhpcy5pbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMuYWRkKG5hbWUpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmbGF0dGVuU3RhdGVtZW50cyhhcmc6IGFueSwgb3V0cHV0OiBvLlN0YXRlbWVudFtdKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAoPGFueVtdPmFyZykuZm9yRWFjaCgoZW50cnkpID0+IGZsYXR0ZW5TdGF0ZW1lbnRzKGVudHJ5LCBvdXRwdXQpKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQucHVzaChhcmcpO1xuICB9XG59XG5cbmNsYXNzIERlZmF1bHRMb2NhbFJlc29sdmVyIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBnbG9iYWxzPzogU2V0PHN0cmluZz4pIHt9XG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZCB7fVxuICBtYXliZVJlc3RvcmVWaWV3KCk6IHZvaWQge31cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChuYW1lID09PSBFdmVudEhhbmRsZXJWYXJzLmV2ZW50Lm5hbWUpIHtcbiAgICAgIHJldHVybiBFdmVudEhhbmRsZXJWYXJzLmV2ZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVDdXJyVmFsdWVFeHByKGJpbmRpbmdJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gIHJldHVybiBvLnZhcmlhYmxlKGBjdXJyVmFsXyR7YmluZGluZ0lkfWApOyAgLy8gZml4IHN5bnRheCBoaWdobGlnaHRpbmc6IGBcbn1cblxuZnVuY3Rpb24gY3JlYXRlUHJldmVudERlZmF1bHRWYXIoYmluZGluZ0lkOiBzdHJpbmcpOiBvLlJlYWRWYXJFeHByIHtcbiAgcmV0dXJuIG8udmFyaWFibGUoYHBkXyR7YmluZGluZ0lkfWApO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0U3RtdEludG9FeHByZXNzaW9uKHN0bXQ6IG8uU3RhdGVtZW50KTogby5FeHByZXNzaW9ufG51bGwge1xuICBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvblN0YXRlbWVudCkge1xuICAgIHJldHVybiBzdG10LmV4cHI7XG4gIH0gZWxzZSBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uUmV0dXJuU3RhdGVtZW50KSB7XG4gICAgcmV0dXJuIHN0bXQudmFsdWU7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBCdWlsdGluRnVuY3Rpb25DYWxsIGV4dGVuZHMgY2RBc3QuRnVuY3Rpb25DYWxsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBzcGFuOiBjZEFzdC5QYXJzZVNwYW4sIHNvdXJjZVNwYW46IGNkQXN0LkFic29sdXRlU291cmNlU3BhbiwgcHVibGljIGFyZ3M6IGNkQXN0LkFTVFtdLFxuICAgICAgcHVibGljIGNvbnZlcnRlcjogQnVpbHRpbkNvbnZlcnRlcikge1xuICAgIHN1cGVyKHNwYW4sIHNvdXJjZVNwYW4sIG51bGwsIGFyZ3MpO1xuICB9XG59XG4iXX0=