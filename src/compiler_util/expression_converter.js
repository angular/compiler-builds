/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as cdAst from '../expression_parser/ast';
import { isBlank } from '../facade/lang';
import { Identifiers, createIdentifier } from '../identifiers';
import * as o from '../output/output_ast';
import { createPureProxy } from './identifier_util';
const /** @type {?} */ VAL_UNWRAPPER_VAR = o.variable(`valUnwrapper`);
export class EventHandlerVars {
}
EventHandlerVars.event = o.variable('$event');
function EventHandlerVars_tsickle_Closure_declarations() {
    /** @type {?} */
    EventHandlerVars.event;
}
export class ConvertActionBindingResult {
    /**
     * @param {?} stmts
     * @param {?} allowDefault
     */
    constructor(stmts, allowDefault) {
        this.stmts = stmts;
        this.allowDefault = allowDefault;
    }
}
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
    const /** @type {?} */ actionWithoutBuiltins = convertPropertyBindingBuiltins({
        createLiteralArrayConverter: (argCount) => {
            // Note: no caching for literal arrays in actions.
            return (args) => o.literalArr(args);
        },
        createLiteralMapConverter: (keys) => {
            // Note: no caching for literal maps in actions.
            return (args) => o.literalMap(/** @type {?} */ (keys.map((key, i) => [key, args[i]])));
        },
        createPipeConverter: (name) => {
            throw new Error(`Illegal State: Actions are not allowed to contain pipes. Pipe: ${name}`);
        }
    }, action);
    const /** @type {?} */ visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId);
    const /** @type {?} */ actionStmts = [];
    flattenStatements(actionWithoutBuiltins.visit(visitor, _Mode.Statement), actionStmts);
    prependTemporaryDecls(visitor.temporaryCount, bindingId, actionStmts);
    const /** @type {?} */ lastIndex = actionStmts.length - 1;
    let /** @type {?} */ preventDefaultVar = null;
    if (lastIndex >= 0) {
        const /** @type {?} */ lastStatement = actionStmts[lastIndex];
        const /** @type {?} */ returnExpr = convertStmtIntoExpression(lastStatement);
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
export class ConvertPropertyBindingResult {
    /**
     * @param {?} stmts
     * @param {?} currValExpr
     */
    constructor(stmts, currValExpr) {
        this.stmts = stmts;
        this.currValExpr = currValExpr;
    }
}
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
    const /** @type {?} */ currValExpr = createCurrValueExpr(bindingId);
    const /** @type {?} */ stmts = [];
    const /** @type {?} */ visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId);
    const /** @type {?} */ outputExpr = expressionWithoutBuiltins.visit(visitor, _Mode.Expression);
    if (visitor.temporaryCount) {
        for (let /** @type {?} */ i = 0; i < visitor.temporaryCount; i++) {
            stmts.push(temporaryDeclaration(bindingId, i));
        }
    }
    stmts.push(currValExpr.set(outputExpr).toDeclStmt(null, [o.StmtModifier.Final]));
    return new ConvertPropertyBindingResult(stmts, currValExpr);
}
export class LegacyConvertPropertyBindingResult {
    /**
     * @param {?} stmts
     * @param {?} currValExpr
     * @param {?} forceUpdate
     */
    constructor(stmts, currValExpr, forceUpdate) {
        this.stmts = stmts;
        this.currValExpr = currValExpr;
        this.forceUpdate = forceUpdate;
    }
}
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
    let /** @type {?} */ needsValueUnwrapper = false;
    const /** @type {?} */ expressionWithoutBuiltins = convertBuiltins({
        createLiteralArrayConverter: (argCount) => {
            return (args) => legacyCreateCachedLiteralArray(builder, args);
        },
        createLiteralMapConverter: (keys) => {
            return (args) => legacyCreateCachedLiteralMap(builder, /** @type {?} */ (keys.map((key, i) => [key, args[i]])));
        },
        createPipeConverter: (name) => {
            needsValueUnwrapper = true;
            return (args) => VAL_UNWRAPPER_VAR.callMethod('unwrap', [nameResolver.callPipe(name, args[0], args.slice(1))]);
        }
    }, expression);
    const { stmts, currValExpr } = convertPropertyBinding(nameResolver, implicitReceiver, expressionWithoutBuiltins, bindingId);
    let /** @type {?} */ forceUpdate = null;
    if (needsValueUnwrapper) {
        const /** @type {?} */ initValueUnwrapperStmt = VAL_UNWRAPPER_VAR.callMethod('reset', []).toStmt();
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
    const /** @type {?} */ unwrapperStmts = [];
    const /** @type {?} */ readVars = o.findReadVarNames(stmts);
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
    const /** @type {?} */ visitor = new _BuiltinAstConverter(converterFactory);
    return ast.visit(visitor);
}
/**
 * @param {?} bindingId
 * @param {?} temporaryNumber
 * @return {?}
 */
function temporaryName(bindingId, temporaryNumber) {
    return `tmp_${bindingId}_${temporaryNumber}`;
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
    for (let /** @type {?} */ i = temporaryCount - 1; i >= 0; i--) {
        statements.unshift(temporaryDeclaration(bindingId, i));
    }
}
let _Mode = {};
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
        throw new Error(`Expected a statement, but saw ${ast}`);
    }
}
/**
 * @param {?} mode
 * @param {?} ast
 * @return {?}
 */
function ensureExpressionMode(mode, ast) {
    if (mode !== _Mode.Expression) {
        throw new Error(`Expected an expression, but saw ${ast}`);
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
class _BuiltinAstConverter extends cdAst.AstTransformer {
    /**
     * @param {?} _converterFactory
     */
    constructor(_converterFactory) {
        super();
        this._converterFactory = _converterFactory;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitPipe(ast, context) {
        const /** @type {?} */ args = [ast.exp, ...ast.args].map(ast => ast.visit(this, context));
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createPipeConverter(ast.name, args.length));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralArray(ast, context) {
        const /** @type {?} */ args = ast.expressions.map(ast => ast.visit(this, context));
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createLiteralArrayConverter(ast.expressions.length));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitLiteralMap(ast, context) {
        const /** @type {?} */ args = ast.values.map(ast => ast.visit(this, context));
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createLiteralMapConverter(ast.keys));
    }
}
function _BuiltinAstConverter_tsickle_Closure_declarations() {
    /** @type {?} */
    _BuiltinAstConverter.prototype._converterFactory;
}
class _AstToIrVisitor {
    /**
     * @param {?} _localResolver
     * @param {?} _implicitReceiver
     * @param {?} bindingId
     */
    constructor(_localResolver, _implicitReceiver, bindingId) {
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
    visitBinary(ast, mode) {
        let /** @type {?} */ op;
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
                throw new Error(`Unsupported operation ${ast.operation}`);
        }
        return convertToStatementIfNeeded(mode, new o.BinaryOperatorExpr(op, this.visit(ast.left, _Mode.Expression), this.visit(ast.right, _Mode.Expression)));
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitChain(ast, mode) {
        ensureStatementMode(mode, ast);
        return this.visitAll(ast.expressions, mode);
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitConditional(ast, mode) {
        const /** @type {?} */ value = this.visit(ast.condition, _Mode.Expression);
        return convertToStatementIfNeeded(mode, value.conditional(this.visit(ast.trueExp, _Mode.Expression), this.visit(ast.falseExp, _Mode.Expression)));
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitPipe(ast, mode) {
        throw new Error(`Illegal state: Pipes should have been converted into functions. Pipe: ${ast.name}`);
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitFunctionCall(ast, mode) {
        const /** @type {?} */ convertedArgs = this.visitAll(ast.args, _Mode.Expression);
        let /** @type {?} */ fnResult;
        if (ast instanceof BuiltinFunctionCall) {
            fnResult = ast.converter(convertedArgs);
        }
        else {
            fnResult = this.visit(ast.target, _Mode.Expression).callFn(convertedArgs);
        }
        return convertToStatementIfNeeded(mode, fnResult);
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitImplicitReceiver(ast, mode) {
        ensureExpressionMode(mode, ast);
        return this._implicitReceiver;
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitInterpolation(ast, mode) {
        ensureExpressionMode(mode, ast);
        const /** @type {?} */ args = [o.literal(ast.expressions.length)];
        for (let /** @type {?} */ i = 0; i < ast.strings.length - 1; i++) {
            args.push(o.literal(ast.strings[i]));
            args.push(this.visit(ast.expressions[i], _Mode.Expression));
        }
        args.push(o.literal(ast.strings[ast.strings.length - 1]));
        return ast.expressions.length <= 9 ?
            o.importExpr(createIdentifier(Identifiers.inlineInterpolate)).callFn(args) :
            o.importExpr(createIdentifier(Identifiers.interpolate)).callFn([
                args[0], o.literalArr(args.slice(1))
            ]);
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitKeyedRead(ast, mode) {
        const /** @type {?} */ leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            return convertToStatementIfNeeded(mode, this.visit(ast.obj, _Mode.Expression).key(this.visit(ast.key, _Mode.Expression)));
        }
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitKeyedWrite(ast, mode) {
        const /** @type {?} */ obj = this.visit(ast.obj, _Mode.Expression);
        const /** @type {?} */ key = this.visit(ast.key, _Mode.Expression);
        const /** @type {?} */ value = this.visit(ast.value, _Mode.Expression);
        return convertToStatementIfNeeded(mode, obj.key(key).set(value));
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitLiteralArray(ast, mode) {
        throw new Error(`Illegal State: literal arrays should have been converted into functions`);
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitLiteralMap(ast, mode) {
        throw new Error(`Illegal State: literal maps should have been converted into functions`);
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitLiteralPrimitive(ast, mode) {
        return convertToStatementIfNeeded(mode, o.literal(ast.value));
    }
    /**
     * @param {?} name
     * @return {?}
     */
    _getLocal(name) { return this._localResolver.getLocal(name); }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitMethodCall(ast, mode) {
        const /** @type {?} */ leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            const /** @type {?} */ args = this.visitAll(ast.args, _Mode.Expression);
            let /** @type {?} */ result = null;
            const /** @type {?} */ receiver = this.visit(ast.receiver, _Mode.Expression);
            if (receiver === this._implicitReceiver) {
                const /** @type {?} */ varExpr = this._getLocal(ast.name);
                if (varExpr) {
                    result = varExpr.callFn(args);
                }
            }
            if (isBlank(result)) {
                result = receiver.callMethod(ast.name, args);
            }
            return convertToStatementIfNeeded(mode, result);
        }
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitPrefixNot(ast, mode) {
        return convertToStatementIfNeeded(mode, o.not(this.visit(ast.expression, _Mode.Expression)));
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitPropertyRead(ast, mode) {
        const /** @type {?} */ leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            let /** @type {?} */ result = null;
            const /** @type {?} */ receiver = this.visit(ast.receiver, _Mode.Expression);
            if (receiver === this._implicitReceiver) {
                result = this._getLocal(ast.name);
            }
            if (isBlank(result)) {
                result = receiver.prop(ast.name);
            }
            return convertToStatementIfNeeded(mode, result);
        }
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitPropertyWrite(ast, mode) {
        const /** @type {?} */ receiver = this.visit(ast.receiver, _Mode.Expression);
        if (receiver === this._implicitReceiver) {
            const /** @type {?} */ varExpr = this._getLocal(ast.name);
            if (varExpr) {
                throw new Error('Cannot assign to a reference or variable!');
            }
        }
        return convertToStatementIfNeeded(mode, receiver.prop(ast.name).set(this.visit(ast.value, _Mode.Expression)));
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitSafePropertyRead(ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitSafeMethodCall(ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
    }
    /**
     * @param {?} asts
     * @param {?} mode
     * @return {?}
     */
    visitAll(asts, mode) { return asts.map(ast => this.visit(ast, mode)); }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitQuote(ast, mode) {
        throw new Error('Quotes are not supported for evaluation!');
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visit(ast, mode) {
        const /** @type {?} */ result = this._resultMap.get(ast);
        if (result)
            return result;
        return (this._nodeMap.get(ast) || ast).visit(this, mode);
    }
    /**
     * @param {?} ast
     * @param {?} leftMostSafe
     * @param {?} mode
     * @return {?}
     */
    convertSafeAccess(ast, leftMostSafe, mode) {
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
        let /** @type {?} */ guardedExpression = this.visit(leftMostSafe.receiver, _Mode.Expression);
        let /** @type {?} */ temporary;
        if (this.needsTemporary(leftMostSafe.receiver)) {
            // If the expression has method calls or pipes then we need to save the result into a
            // temporary variable to avoid calling stateful or impure code more than once.
            temporary = this.allocateTemporary();
            // Preserve the result in the temporary variable
            guardedExpression = temporary.set(guardedExpression);
            // Ensure all further references to the guarded expression refer to the temporary instead.
            this._resultMap.set(leftMostSafe.receiver, temporary);
        }
        const /** @type {?} */ condition = guardedExpression.isBlank();
        // Convert the ast to an unguarded access to the receiver's member. The map will substitute
        // leftMostNode with its unguarded version in the call to `this.visit()`.
        if (leftMostSafe instanceof cdAst.SafeMethodCall) {
            this._nodeMap.set(leftMostSafe, new cdAst.MethodCall(leftMostSafe.span, leftMostSafe.receiver, leftMostSafe.name, leftMostSafe.args));
        }
        else {
            this._nodeMap.set(leftMostSafe, new cdAst.PropertyRead(leftMostSafe.span, leftMostSafe.receiver, leftMostSafe.name));
        }
        // Recursively convert the node now without the guarded member access.
        const /** @type {?} */ access = this.visit(ast, _Mode.Expression);
        // Remove the mapping. This is not strictly required as the converter only traverses each node
        // once but is safer if the conversion is changed to traverse the nodes more than once.
        this._nodeMap.delete(leftMostSafe);
        // If we allcoated a temporary, release it.
        if (temporary) {
            this.releaseTemporary(temporary);
        }
        // Produce the conditional
        return convertToStatementIfNeeded(mode, condition.conditional(o.literal(null), access));
    }
    /**
     * @param {?} ast
     * @return {?}
     */
    leftMostSafeNode(ast) {
        const /** @type {?} */ visit = (visitor, ast) => {
            return (this._nodeMap.get(ast) || ast).visit(visitor);
        };
        return ast.visit({
            /**
             * @param {?} ast
             * @return {?}
             */
            visitBinary(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitChain(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitConditional(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitFunctionCall(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitImplicitReceiver(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitInterpolation(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitKeyedRead(ast) { return visit(this, ast.obj); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitKeyedWrite(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralArray(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralMap(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralPrimitive(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitMethodCall(ast) { return visit(this, ast.receiver); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPipe(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPrefixNot(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPropertyRead(ast) { return visit(this, ast.receiver); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPropertyWrite(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitQuote(ast) { return null; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitSafeMethodCall(ast) { return visit(this, ast.receiver) || ast; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitSafePropertyRead(ast) {
                return visit(this, ast.receiver) || ast;
            }
        });
    }
    /**
     * @param {?} ast
     * @return {?}
     */
    needsTemporary(ast) {
        const /** @type {?} */ visit = (visitor, ast) => {
            return ast && (this._nodeMap.get(ast) || ast).visit(visitor);
        };
        const /** @type {?} */ visitSome = (visitor, ast) => {
            return ast.some(ast => visit(visitor, ast));
        };
        return ast.visit({
            /**
             * @param {?} ast
             * @return {?}
             */
            visitBinary(ast) { return visit(this, ast.left) || visit(this, ast.right); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitChain(ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitConditional(ast) {
                return visit(this, ast.condition) || visit(this, ast.trueExp) ||
                    visit(this, ast.falseExp);
            },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitFunctionCall(ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitImplicitReceiver(ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitInterpolation(ast) { return visitSome(this, ast.expressions); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitKeyedRead(ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitKeyedWrite(ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralArray(ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralMap(ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitLiteralPrimitive(ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitMethodCall(ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPipe(ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPrefixNot(ast) { return visit(this, ast.expression); },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPropertyRead(ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitPropertyWrite(ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitQuote(ast) { return false; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitSafeMethodCall(ast) { return true; },
            /**
             * @param {?} ast
             * @return {?}
             */
            visitSafePropertyRead(ast) { return false; }
        });
    }
    /**
     * @return {?}
     */
    allocateTemporary() {
        const /** @type {?} */ tempNumber = this._currentTemporary++;
        this.temporaryCount = Math.max(this._currentTemporary, this.temporaryCount);
        return new o.ReadVarExpr(temporaryName(this.bindingId, tempNumber));
    }
    /**
     * @param {?} temporary
     * @return {?}
     */
    releaseTemporary(temporary) {
        this._currentTemporary--;
        if (temporary.name != temporaryName(this.bindingId, this._currentTemporary)) {
            throw new Error(`Temporary ${temporary.name} released out of order`);
        }
    }
}
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
        ((arg)).forEach((entry) => flattenStatements(entry, output));
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
    const /** @type {?} */ proxyExpr = o.THIS_EXPR.prop(`_arr_${builder.fields.length}`);
    const /** @type {?} */ proxyParams = [];
    const /** @type {?} */ proxyReturnEntries = [];
    for (let /** @type {?} */ i = 0; i < values.length; i++) {
        const /** @type {?} */ paramName = `p${i}`;
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
    const /** @type {?} */ proxyExpr = o.THIS_EXPR.prop(`_map_${builder.fields.length}`);
    const /** @type {?} */ proxyParams = [];
    const /** @type {?} */ proxyReturnEntries = [];
    const /** @type {?} */ values = [];
    for (let /** @type {?} */ i = 0; i < entries.length; i++) {
        const /** @type {?} */ paramName = `p${i}`;
        proxyParams.push(new o.FnParam(paramName));
        proxyReturnEntries.push([entries[i][0], o.variable(paramName)]);
        values.push(/** @type {?} */ (entries[i][1]));
    }
    createPureProxy(o.fn(proxyParams, [new o.ReturnStatement(o.literalMap(proxyReturnEntries))], new o.MapType(o.DYNAMIC_TYPE)), entries.length, proxyExpr, builder);
    return proxyExpr.callFn(values);
}
class DefaultLocalResolver {
    /**
     * @param {?} name
     * @return {?}
     */
    getLocal(name) {
        if (name === EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        return null;
    }
}
class LegacyDefaultNameResolver {
    /**
     * @param {?} name
     * @param {?} input
     * @param {?} args
     * @return {?}
     */
    callPipe(name, input, args) { return null; }
    /**
     * @param {?} name
     * @return {?}
     */
    getLocal(name) {
        if (name === EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        return null;
    }
}
/**
 * @param {?} bindingId
 * @return {?}
 */
function createCurrValueExpr(bindingId) {
    return o.variable(`currVal_${bindingId}`); // fix syntax highlighting: `
}
/**
 * @param {?} bindingId
 * @return {?}
 */
function createPreventDefaultVar(bindingId) {
    return o.variable(`pd_${bindingId}`);
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
class BuiltinFunctionCall extends cdAst.FunctionCall {
    /**
     * @param {?} span
     * @param {?} args
     * @param {?} converter
     */
    constructor(span, args, converter) {
        super(span, null, args);
        this.args = args;
        this.converter = converter;
    }
}
function BuiltinFunctionCall_tsickle_Closure_declarations() {
    /** @type {?} */
    BuiltinFunctionCall.prototype.args;
    /** @type {?} */
    BuiltinFunctionCall.prototype.converter;
}
//# sourceMappingURL=expression_converter.js.map