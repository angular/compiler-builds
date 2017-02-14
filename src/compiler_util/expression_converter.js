/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import * as cdAst from '../expression_parser/ast';
import { isBlank } from '../facade/lang';
import { Identifiers, createIdentifier } from '../identifiers';
import * as o from '../output/output_ast';
import { createPureProxy } from './identifier_util';
var /** @type {?} */ VAL_UNWRAPPER_VAR = o.variable("valUnwrapper");
var EventHandlerVars = (function () {
    function EventHandlerVars() {
    }
    return EventHandlerVars;
}());
export { EventHandlerVars };
EventHandlerVars.event = o.variable('$event');
function EventHandlerVars_tsickle_Closure_declarations() {
    /** @type {?} */
    EventHandlerVars.event;
}
var ConvertActionBindingResult = (function () {
    /**
     * @param {?} stmts
     * @param {?} allowDefault
     */
    function ConvertActionBindingResult(stmts, allowDefault) {
        this.stmts = stmts;
        this.allowDefault = allowDefault;
    }
    return ConvertActionBindingResult;
}());
export { ConvertActionBindingResult };
function ConvertActionBindingResult_tsickle_Closure_declarations() {
    /** @type {?} */
    ConvertActionBindingResult.prototype.stmts;
    /** @type {?} */
    ConvertActionBindingResult.prototype.allowDefault;
}
/**
 * Converts the given expression AST into an executable output AST, assuming the expression is
 * used in an action binding (e.g. an event handler).
 * @param {?} localResolver
 * @param {?} implicitReceiver
 * @param {?} action
 * @param {?} bindingId
 * @return {?}
 */
export function convertActionBinding(localResolver, implicitReceiver, action, bindingId) {
    if (!localResolver) {
        localResolver = new DefaultLocalResolver();
    }
    var /** @type {?} */ actionWithoutBuiltins = convertPropertyBindingBuiltins({
        createLiteralArrayConverter: function (argCount) {
            // Note: no caching for literal arrays in actions.
            return function (args) { return o.literalArr(args); };
        },
        createLiteralMapConverter: function (keys) {
            // Note: no caching for literal maps in actions.
            return function (args) {
                return o.literalMap(/** @type {?} */ (keys.map(function (key, i) { return [key, args[i]]; })));
            };
        },
        createPipeConverter: function (name) {
            throw new Error("Illegal State: Actions are not allowed to contain pipes. Pipe: " + name);
        }
    }, action);
    var /** @type {?} */ visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId);
    var /** @type {?} */ actionStmts = [];
    flattenStatements(actionWithoutBuiltins.visit(visitor, _Mode.Statement), actionStmts);
    prependTemporaryDecls(visitor.temporaryCount, bindingId, actionStmts);
    var /** @type {?} */ lastIndex = actionStmts.length - 1;
    var /** @type {?} */ preventDefaultVar = null;
    if (lastIndex >= 0) {
        var /** @type {?} */ lastStatement = actionStmts[lastIndex];
        var /** @type {?} */ returnExpr = convertStmtIntoExpression(lastStatement);
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
/**
 * @param {?} converterFactory
 * @param {?} ast
 * @return {?}
 */
export function convertPropertyBindingBuiltins(converterFactory, ast) {
    return convertBuiltins(converterFactory, ast);
}
var ConvertPropertyBindingResult = (function () {
    /**
     * @param {?} stmts
     * @param {?} currValExpr
     */
    function ConvertPropertyBindingResult(stmts, currValExpr) {
        this.stmts = stmts;
        this.currValExpr = currValExpr;
    }
    return ConvertPropertyBindingResult;
}());
export { ConvertPropertyBindingResult };
function ConvertPropertyBindingResult_tsickle_Closure_declarations() {
    /** @type {?} */
    ConvertPropertyBindingResult.prototype.stmts;
    /** @type {?} */
    ConvertPropertyBindingResult.prototype.currValExpr;
}
/**
 * Converts the given expression AST into an executable output AST, assuming the expression
 * is used in property binding. The expression has to be preprocessed via
 * `convertPropertyBindingBuiltins`.
 * @param {?} localResolver
 * @param {?} implicitReceiver
 * @param {?} expressionWithoutBuiltins
 * @param {?} bindingId
 * @return {?}
 */
export function convertPropertyBinding(localResolver, implicitReceiver, expressionWithoutBuiltins, bindingId) {
    if (!localResolver) {
        localResolver = new DefaultLocalResolver();
    }
    var /** @type {?} */ currValExpr = createCurrValueExpr(bindingId);
    var /** @type {?} */ stmts = [];
    var /** @type {?} */ visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId);
    var /** @type {?} */ outputExpr = expressionWithoutBuiltins.visit(visitor, _Mode.Expression);
    if (visitor.temporaryCount) {
        for (var /** @type {?} */ i = 0; i < visitor.temporaryCount; i++) {
            stmts.push(temporaryDeclaration(bindingId, i));
        }
    }
    stmts.push(currValExpr.set(outputExpr).toDeclStmt(null, [o.StmtModifier.Final]));
    return new ConvertPropertyBindingResult(stmts, currValExpr);
}
var LegacyConvertPropertyBindingResult = (function () {
    /**
     * @param {?} stmts
     * @param {?} currValExpr
     * @param {?} forceUpdate
     */
    function LegacyConvertPropertyBindingResult(stmts, currValExpr, forceUpdate) {
        this.stmts = stmts;
        this.currValExpr = currValExpr;
        this.forceUpdate = forceUpdate;
    }
    return LegacyConvertPropertyBindingResult;
}());
export { LegacyConvertPropertyBindingResult };
function LegacyConvertPropertyBindingResult_tsickle_Closure_declarations() {
    /** @type {?} */
    LegacyConvertPropertyBindingResult.prototype.stmts;
    /** @type {?} */
    LegacyConvertPropertyBindingResult.prototype.currValExpr;
    /** @type {?} */
    LegacyConvertPropertyBindingResult.prototype.forceUpdate;
}
/**
 * Converts the given expression AST into an executable output AST, assuming the expression is
 * used in a property binding.
 * @param {?} builder
 * @param {?} nameResolver
 * @param {?} implicitReceiver
 * @param {?} expression
 * @param {?} bindingId
 * @return {?}
 */
export function legacyConvertPropertyBinding(builder, nameResolver, implicitReceiver, expression, bindingId) {
    if (!nameResolver) {
        nameResolver = new LegacyDefaultNameResolver();
    }
    var /** @type {?} */ needsValueUnwrapper = false;
    var /** @type {?} */ expressionWithoutBuiltins = convertBuiltins({
        createLiteralArrayConverter: function (argCount) {
            return function (args) { return legacyCreateCachedLiteralArray(builder, args); };
        },
        createLiteralMapConverter: function (keys) {
            return function (args) { return legacyCreateCachedLiteralMap(builder, /** @type {?} */ (keys.map(function (key, i) { return [key, args[i]]; }))); };
        },
        createPipeConverter: function (name) {
            needsValueUnwrapper = true;
            return function (args) { return VAL_UNWRAPPER_VAR.callMethod('unwrap', [nameResolver.callPipe(name, args[0], args.slice(1))]); };
        }
    }, expression);
    var _a = convertPropertyBinding(nameResolver, implicitReceiver, expressionWithoutBuiltins, bindingId), stmts = _a.stmts, currValExpr = _a.currValExpr;
    var /** @type {?} */ forceUpdate = null;
    if (needsValueUnwrapper) {
        var /** @type {?} */ initValueUnwrapperStmt = VAL_UNWRAPPER_VAR.callMethod('reset', []).toStmt();
        stmts.unshift(initValueUnwrapperStmt);
        forceUpdate = VAL_UNWRAPPER_VAR.prop('hasWrappedValue');
    }
    return new LegacyConvertPropertyBindingResult(stmts, currValExpr, forceUpdate);
}
/**
 * Creates variables that are shared by multiple calls to `convertActionBinding` /
 * `convertPropertyBinding`
 * @param {?} stmts
 * @return {?}
 */
export function legacyCreateSharedBindingVariablesIfNeeded(stmts) {
    var /** @type {?} */ unwrapperStmts = [];
    var /** @type {?} */ readVars = o.findReadVarNames(stmts);
    if (readVars.has(VAL_UNWRAPPER_VAR.name)) {
        unwrapperStmts.push(VAL_UNWRAPPER_VAR
            .set(o.importExpr(createIdentifier(Identifiers.ValueUnwrapper)).instantiate([]))
            .toDeclStmt(null, [o.StmtModifier.Final]));
    }
    return unwrapperStmts;
}
/**
 * @param {?} converterFactory
 * @param {?} ast
 * @return {?}
 */
function convertBuiltins(converterFactory, ast) {
    var /** @type {?} */ visitor = new _BuiltinAstConverter(converterFactory);
    return ast.visit(visitor);
}
/**
 * @param {?} bindingId
 * @param {?} temporaryNumber
 * @return {?}
 */
function temporaryName(bindingId, temporaryNumber) {
    return "tmp_" + bindingId + "_" + temporaryNumber;
}
/**
 * @param {?} bindingId
 * @param {?} temporaryNumber
 * @return {?}
 */
export function temporaryDeclaration(bindingId, temporaryNumber) {
    return new o.DeclareVarStmt(temporaryName(bindingId, temporaryNumber), o.NULL_EXPR);
}
/**
 * @param {?} temporaryCount
 * @param {?} bindingId
 * @param {?} statements
 * @return {?}
 */
function prependTemporaryDecls(temporaryCount, bindingId, statements) {
    for (var /** @type {?} */ i = temporaryCount - 1; i >= 0; i--) {
        statements.unshift(temporaryDeclaration(bindingId, i));
    }
}
var _Mode = {};
_Mode.Statement = 0;
_Mode.Expression = 1;
_Mode[_Mode.Statement] = "Statement";
_Mode[_Mode.Expression] = "Expression";
/**
 * @param {?} mode
 * @param {?} ast
 * @return {?}
 */
function ensureStatementMode(mode, ast) {
    if (mode !== _Mode.Statement) {
        throw new Error("Expected a statement, but saw " + ast);
    }
}
/**
 * @param {?} mode
 * @param {?} ast
 * @return {?}
 */
function ensureExpressionMode(mode, ast) {
    if (mode !== _Mode.Expression) {
        throw new Error("Expected an expression, but saw " + ast);
    }
}
/**
 * @param {?} mode
 * @param {?} expr
 * @return {?}
 */
function convertToStatementIfNeeded(mode, expr) {
    if (mode === _Mode.Statement) {
        return expr.toStmt();
    }
    else {
        return expr;
    }
}
var _BuiltinAstConverter = (function (_super) {
    __extends(_BuiltinAstConverter, _super);
    /**
     * @param {?} _converterFactory
     */
    function _BuiltinAstConverter(_converterFactory) {
        var _this = _super.call(this) || this;
        _this._converterFactory = _converterFactory;
        return _this;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    _BuiltinAstConverter.prototype.visitPipe = function (ast, context) {
        var _this = this;
        var /** @type {?} */ args = [ast.exp].concat(ast.args).map(function (ast) { return ast.visit(_this, context); });
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createPipeConverter(ast.name, args.length));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    _BuiltinAstConverter.prototype.visitLiteralArray = function (ast, context) {
        var _this = this;
        var /** @type {?} */ args = ast.expressions.map(function (ast) { return ast.visit(_this, context); });
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createLiteralArrayConverter(ast.expressions.length));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    _BuiltinAstConverter.prototype.visitLiteralMap = function (ast, context) {
        var _this = this;
        var /** @type {?} */ args = ast.values.map(function (ast) { return ast.visit(_this, context); });
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createLiteralMapConverter(ast.keys));
    };
    return _BuiltinAstConverter;
}(cdAst.AstTransformer));
function _BuiltinAstConverter_tsickle_Closure_declarations() {
    /** @type {?} */
    _BuiltinAstConverter.prototype._converterFactory;
}
var _AstToIrVisitor = (function () {
    /**
     * @param {?} _localResolver
     * @param {?} _implicitReceiver
     * @param {?} bindingId
     */
    function _AstToIrVisitor(_localResolver, _implicitReceiver, bindingId) {
        this._localResolver = _localResolver;
        this._implicitReceiver = _implicitReceiver;
        this.bindingId = bindingId;
        this._nodeMap = new Map();
        this._resultMap = new Map();
        this._currentTemporary = 0;
        this.temporaryCount = 0;
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitBinary = function (ast, mode) {
        var /** @type {?} */ op;
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
        return convertToStatementIfNeeded(mode, new o.BinaryOperatorExpr(op, this.visit(ast.left, _Mode.Expression), this.visit(ast.right, _Mode.Expression)));
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitChain = function (ast, mode) {
        ensureStatementMode(mode, ast);
        return this.visitAll(ast.expressions, mode);
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitConditional = function (ast, mode) {
        var /** @type {?} */ value = this.visit(ast.condition, _Mode.Expression);
        return convertToStatementIfNeeded(mode, value.conditional(this.visit(ast.trueExp, _Mode.Expression), this.visit(ast.falseExp, _Mode.Expression)));
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitPipe = function (ast, mode) {
        throw new Error("Illegal state: Pipes should have been converted into functions. Pipe: " + ast.name);
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitFunctionCall = function (ast, mode) {
        var /** @type {?} */ convertedArgs = this.visitAll(ast.args, _Mode.Expression);
        var /** @type {?} */ fnResult;
        if (ast instanceof BuiltinFunctionCall) {
            fnResult = ast.converter(convertedArgs);
        }
        else {
            fnResult = this.visit(ast.target, _Mode.Expression).callFn(convertedArgs);
        }
        return convertToStatementIfNeeded(mode, fnResult);
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitImplicitReceiver = function (ast, mode) {
        ensureExpressionMode(mode, ast);
        return this._implicitReceiver;
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitInterpolation = function (ast, mode) {
        ensureExpressionMode(mode, ast);
        var /** @type {?} */ args = [o.literal(ast.expressions.length)];
        for (var /** @type {?} */ i = 0; i < ast.strings.length - 1; i++) {
            args.push(o.literal(ast.strings[i]));
            args.push(this.visit(ast.expressions[i], _Mode.Expression));
        }
        args.push(o.literal(ast.strings[ast.strings.length - 1]));
        return ast.expressions.length <= 9 ?
            o.importExpr(createIdentifier(Identifiers.inlineInterpolate)).callFn(args) :
            o.importExpr(createIdentifier(Identifiers.interpolate)).callFn([
                args[0], o.literalArr(args.slice(1))
            ]);
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitKeyedRead = function (ast, mode) {
        var /** @type {?} */ leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            return convertToStatementIfNeeded(mode, this.visit(ast.obj, _Mode.Expression).key(this.visit(ast.key, _Mode.Expression)));
        }
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitKeyedWrite = function (ast, mode) {
        var /** @type {?} */ obj = this.visit(ast.obj, _Mode.Expression);
        var /** @type {?} */ key = this.visit(ast.key, _Mode.Expression);
        var /** @type {?} */ value = this.visit(ast.value, _Mode.Expression);
        return convertToStatementIfNeeded(mode, obj.key(key).set(value));
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitLiteralArray = function (ast, mode) {
        throw new Error("Illegal State: literal arrays should have been converted into functions");
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitLiteralMap = function (ast, mode) {
        throw new Error("Illegal State: literal maps should have been converted into functions");
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitLiteralPrimitive = function (ast, mode) {
        return convertToStatementIfNeeded(mode, o.literal(ast.value));
    };
    /**
     * @param {?} name
     * @return {?}
     */
    _AstToIrVisitor.prototype._getLocal = function (name) { return this._localResolver.getLocal(name); };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitMethodCall = function (ast, mode) {
        var /** @type {?} */ leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            var /** @type {?} */ args = this.visitAll(ast.args, _Mode.Expression);
            var /** @type {?} */ result = null;
            var /** @type {?} */ receiver = this.visit(ast.receiver, _Mode.Expression);
            if (receiver === this._implicitReceiver) {
                var /** @type {?} */ varExpr = this._getLocal(ast.name);
                if (varExpr) {
                    result = varExpr.callFn(args);
                }
            }
            if (isBlank(result)) {
                result = receiver.callMethod(ast.name, args);
            }
            return convertToStatementIfNeeded(mode, result);
        }
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitPrefixNot = function (ast, mode) {
        return convertToStatementIfNeeded(mode, o.not(this.visit(ast.expression, _Mode.Expression)));
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitPropertyRead = function (ast, mode) {
        var /** @type {?} */ leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            var /** @type {?} */ result = null;
            var /** @type {?} */ receiver = this.visit(ast.receiver, _Mode.Expression);
            if (receiver === this._implicitReceiver) {
                result = this._getLocal(ast.name);
            }
            if (isBlank(result)) {
                result = receiver.prop(ast.name);
            }
            return convertToStatementIfNeeded(mode, result);
        }
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitPropertyWrite = function (ast, mode) {
        var /** @type {?} */ receiver = this.visit(ast.receiver, _Mode.Expression);
        if (receiver === this._implicitReceiver) {
            var /** @type {?} */ varExpr = this._getLocal(ast.name);
            if (varExpr) {
                throw new Error('Cannot assign to a reference or variable!');
            }
        }
        return convertToStatementIfNeeded(mode, receiver.prop(ast.name).set(this.visit(ast.value, _Mode.Expression)));
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitSafePropertyRead = function (ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitSafeMethodCall = function (ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
    };
    /**
     * @param {?} asts
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitAll = function (asts, mode) {
        var _this = this;
        return asts.map(function (ast) { return _this.visit(ast, mode); });
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visitQuote = function (ast, mode) {
        throw new Error('Quotes are not supported for evaluation!');
    };
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    _AstToIrVisitor.prototype.visit = function (ast, mode) {
        var /** @type {?} */ result = this._resultMap.get(ast);
        if (result)
            return result;
        return (this._nodeMap.get(ast) || ast).visit(this, mode);
    };
    /**
     * @param {?} ast
     * @param {?} leftMostSafe
     * @param {?} mode
     * @return {?}
     */
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
        var /** @type {?} */ guardedExpression = this.visit(leftMostSafe.receiver, _Mode.Expression);
        var /** @type {?} */ temporary;
        if (this.needsTemporary(leftMostSafe.receiver)) {
            // If the expression has method calls or pipes then we need to save the result into a
            // temporary variable to avoid calling stateful or impure code more than once.
            temporary = this.allocateTemporary();
            // Preserve the result in the temporary variable
            guardedExpression = temporary.set(guardedExpression);
            // Ensure all further references to the guarded expression refer to the temporary instead.
            this._resultMap.set(leftMostSafe.receiver, temporary);
        }
        var /** @type {?} */ condition = guardedExpression.isBlank();
        // Convert the ast to an unguarded access to the receiver's member. The map will substitute
        // leftMostNode with its unguarded version in the call to `this.visit()`.
        if (leftMostSafe instanceof cdAst.SafeMethodCall) {
            this._nodeMap.set(leftMostSafe, new cdAst.MethodCall(leftMostSafe.span, leftMostSafe.receiver, leftMostSafe.name, leftMostSafe.args));
        }
        else {
            this._nodeMap.set(leftMostSafe, new cdAst.PropertyRead(leftMostSafe.span, leftMostSafe.receiver, leftMostSafe.name));
        }
        // Recursively convert the node now without the guarded member access.
        var /** @type {?} */ access = this.visit(ast, _Mode.Expression);
        // Remove the mapping. This is not strictly required as the converter only traverses each node
        // once but is safer if the conversion is changed to traverse the nodes more than once.
        this._nodeMap.delete(leftMostSafe);
        // If we allcoated a temporary, release it.
        if (temporary) {
            this.releaseTemporary(temporary);
        }
        // Produce the conditional
        return convertToStatementIfNeeded(mode, condition.conditional(o.literal(null), access));
    };
    /**
     * @param {?} ast
     * @return {?}
     */
    _AstToIrVisitor.prototype.leftMostSafeNode = function (ast) {
        var _this = this;
        var /** @type {?} */ visit = function (visitor, ast) {
            return (_this._nodeMap.get(ast) || ast).visit(visitor);
        };
        return ast.visit({
            /**
             * @param {?} ast
             * @return {?}
             */
            visitBinary: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitChain: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitConditional: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitFunctionCall: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitImplicitReceiver: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitInterpolation: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitKeyedRead: function (ast) { return visit(this, ast.obj); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitKeyedWrite: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralArray: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralMap: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralPrimitive: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitMethodCall: function (ast) { return visit(this, ast.receiver); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPipe: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPrefixNot: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPropertyRead: function (ast) { return visit(this, ast.receiver); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPropertyWrite: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitQuote: function (ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitSafeMethodCall: function (ast) { return visit(this, ast.receiver) || ast; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitSafePropertyRead: function (ast) {
                return visit(this, ast.receiver) || ast;
            }
        });
    };
    /**
     * @param {?} ast
     * @return {?}
     */
    _AstToIrVisitor.prototype.needsTemporary = function (ast) {
        var _this = this;
        var /** @type {?} */ visit = function (visitor, ast) {
            return ast && (_this._nodeMap.get(ast) || ast).visit(visitor);
        };
        var /** @type {?} */ visitSome = function (visitor, ast) {
            return ast.some(function (ast) { return visit(visitor, ast); });
        };
        return ast.visit({
            /**
             * @param {?} ast
             * @return {?}
             */
            visitBinary: function (ast) { return visit(this, ast.left) || visit(this, ast.right); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitChain: function (ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitConditional: function (ast) {
                return visit(this, ast.condition) || visit(this, ast.trueExp) ||
                    visit(this, ast.falseExp);
            },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitFunctionCall: function (ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitImplicitReceiver: function (ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitInterpolation: function (ast) { return visitSome(this, ast.expressions); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitKeyedRead: function (ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitKeyedWrite: function (ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralArray: function (ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralMap: function (ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralPrimitive: function (ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitMethodCall: function (ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPipe: function (ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPrefixNot: function (ast) { return visit(this, ast.expression); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPropertyRead: function (ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPropertyWrite: function (ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitQuote: function (ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitSafeMethodCall: function (ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitSafePropertyRead: function (ast) { return false; }
        });
    };
    /**
     * @return {?}
     */
    _AstToIrVisitor.prototype.allocateTemporary = function () {
        var /** @type {?} */ tempNumber = this._currentTemporary++;
        this.temporaryCount = Math.max(this._currentTemporary, this.temporaryCount);
        return new o.ReadVarExpr(temporaryName(this.bindingId, tempNumber));
    };
    /**
     * @param {?} temporary
     * @return {?}
     */
    _AstToIrVisitor.prototype.releaseTemporary = function (temporary) {
        this._currentTemporary--;
        if (temporary.name != temporaryName(this.bindingId, this._currentTemporary)) {
            throw new Error("Temporary " + temporary.name + " released out of order");
        }
    };
    return _AstToIrVisitor;
}());
function _AstToIrVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _AstToIrVisitor.prototype._nodeMap;
    /** @type {?} */
    _AstToIrVisitor.prototype._resultMap;
    /** @type {?} */
    _AstToIrVisitor.prototype._currentTemporary;
    /** @type {?} */
    _AstToIrVisitor.prototype.temporaryCount;
    /** @type {?} */
    _AstToIrVisitor.prototype._localResolver;
    /** @type {?} */
    _AstToIrVisitor.prototype._implicitReceiver;
    /** @type {?} */
    _AstToIrVisitor.prototype.bindingId;
}
/**
 * @param {?} arg
 * @param {?} output
 * @return {?}
 */
function flattenStatements(arg, output) {
    if (Array.isArray(arg)) {
        ((arg)).forEach(function (entry) { return flattenStatements(entry, output); });
    }
    else {
        output.push(arg);
    }
}
/**
 * @param {?} builder
 * @param {?} values
 * @return {?}
 */
function legacyCreateCachedLiteralArray(builder, values) {
    if (values.length === 0) {
        return o.importExpr(createIdentifier(Identifiers.EMPTY_ARRAY));
    }
    var /** @type {?} */ proxyExpr = o.THIS_EXPR.prop("_arr_" + builder.fields.length);
    var /** @type {?} */ proxyParams = [];
    var /** @type {?} */ proxyReturnEntries = [];
    for (var /** @type {?} */ i = 0; i < values.length; i++) {
        var /** @type {?} */ paramName = "p" + i;
        proxyParams.push(new o.FnParam(paramName));
        proxyReturnEntries.push(o.variable(paramName));
    }
    createPureProxy(o.fn(proxyParams, [new o.ReturnStatement(o.literalArr(proxyReturnEntries))], new o.ArrayType(o.DYNAMIC_TYPE)), values.length, proxyExpr, builder);
    return proxyExpr.callFn(values);
}
/**
 * @param {?} builder
 * @param {?} entries
 * @return {?}
 */
function legacyCreateCachedLiteralMap(builder, entries) {
    if (entries.length === 0) {
        return o.importExpr(createIdentifier(Identifiers.EMPTY_MAP));
    }
    var /** @type {?} */ proxyExpr = o.THIS_EXPR.prop("_map_" + builder.fields.length);
    var /** @type {?} */ proxyParams = [];
    var /** @type {?} */ proxyReturnEntries = [];
    var /** @type {?} */ values = [];
    for (var /** @type {?} */ i = 0; i < entries.length; i++) {
        var /** @type {?} */ paramName = "p" + i;
        proxyParams.push(new o.FnParam(paramName));
        proxyReturnEntries.push([entries[i][0], o.variable(paramName)]);
        values.push(/** @type {?} */ (entries[i][1]));
    }
    createPureProxy(o.fn(proxyParams, [new o.ReturnStatement(o.literalMap(proxyReturnEntries))], new o.MapType(o.DYNAMIC_TYPE)), entries.length, proxyExpr, builder);
    return proxyExpr.callFn(values);
}
var DefaultLocalResolver = (function () {
    function DefaultLocalResolver() {
    }
    /**
     * @param {?} name
     * @return {?}
     */
    DefaultLocalResolver.prototype.getLocal = function (name) {
        if (name === EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        return null;
    };
    return DefaultLocalResolver;
}());
var LegacyDefaultNameResolver = (function () {
    function LegacyDefaultNameResolver() {
    }
    /**
     * @param {?} name
     * @param {?} input
     * @param {?} args
     * @return {?}
     */
    LegacyDefaultNameResolver.prototype.callPipe = function (name, input, args) { return null; };
    /**
     * @param {?} name
     * @return {?}
     */
    LegacyDefaultNameResolver.prototype.getLocal = function (name) {
        if (name === EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        return null;
    };
    return LegacyDefaultNameResolver;
}());
/**
 * @param {?} bindingId
 * @return {?}
 */
function createCurrValueExpr(bindingId) {
    return o.variable("currVal_" + bindingId); // fix syntax highlighting: `
}
/**
 * @param {?} bindingId
 * @return {?}
 */
function createPreventDefaultVar(bindingId) {
    return o.variable("pd_" + bindingId);
}
/**
 * @param {?} stmt
 * @return {?}
 */
function convertStmtIntoExpression(stmt) {
    if (stmt instanceof o.ExpressionStatement) {
        return stmt.expr;
    }
    else if (stmt instanceof o.ReturnStatement) {
        return stmt.value;
    }
    return null;
}
var BuiltinFunctionCall = (function (_super) {
    __extends(BuiltinFunctionCall, _super);
    /**
     * @param {?} span
     * @param {?} args
     * @param {?} converter
     */
    function BuiltinFunctionCall(span, args, converter) {
        var _this = _super.call(this, span, null, args) || this;
        _this.args = args;
        _this.converter = converter;
        return _this;
    }
    return BuiltinFunctionCall;
}(cdAst.FunctionCall));
function BuiltinFunctionCall_tsickle_Closure_declarations() {
    /** @type {?} */
    BuiltinFunctionCall.prototype.args;
    /** @type {?} */
    BuiltinFunctionCall.prototype.converter;
}
//# sourceMappingURL=expression_converter.js.map