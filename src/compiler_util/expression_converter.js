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
export class ConvertPropertyBindingResult {
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
function ConvertPropertyBindingResult_tsickle_Closure_declarations() {
    /** @type {?} */
    ConvertPropertyBindingResult.prototype.stmts;
    /** @type {?} */
    ConvertPropertyBindingResult.prototype.currValExpr;
    /** @type {?} */
    ConvertPropertyBindingResult.prototype.forceUpdate;
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
export function convertPropertyBinding(builder, nameResolver, implicitReceiver, expression, bindingId) {
    const /** @type {?} */ currValExpr = createCurrValueExpr(bindingId);
    const /** @type {?} */ stmts = [];
    if (!nameResolver) {
        nameResolver = new DefaultNameResolver();
    }
    const /** @type {?} */ visitor = new _AstToIrVisitor(builder, nameResolver, implicitReceiver, VAL_UNWRAPPER_VAR, bindingId, false);
    const /** @type {?} */ outputExpr = expression.visit(visitor, _Mode.Expression);
    if (!outputExpr) {
        // e.g. an empty expression was given
        return null;
    }
    if (visitor.temporaryCount) {
        for (let /** @type {?} */ i = 0; i < visitor.temporaryCount; i++) {
            stmts.push(temporaryDeclaration(bindingId, i));
        }
    }
    if (visitor.needsValueUnwrapper) {
        const /** @type {?} */ initValueUnwrapperStmt = VAL_UNWRAPPER_VAR.callMethod('reset', []).toStmt();
        stmts.push(initValueUnwrapperStmt);
    }
    stmts.push(currValExpr.set(outputExpr).toDeclStmt(null, [o.StmtModifier.Final]));
    if (visitor.needsValueUnwrapper) {
        return new ConvertPropertyBindingResult(stmts, currValExpr, VAL_UNWRAPPER_VAR.prop('hasWrappedValue'));
    }
    else {
        return new ConvertPropertyBindingResult(stmts, currValExpr, null);
    }
}
export class ConvertActionBindingResult {
    /**
     * @param {?} stmts
     * @param {?} preventDefault
     */
    constructor(stmts, preventDefault) {
        this.stmts = stmts;
        this.preventDefault = preventDefault;
    }
}
function ConvertActionBindingResult_tsickle_Closure_declarations() {
    /** @type {?} */
    ConvertActionBindingResult.prototype.stmts;
    /** @type {?} */
    ConvertActionBindingResult.prototype.preventDefault;
}
/**
 * Converts the given expression AST into an executable output AST, assuming the expression is
 * used in an action binding (e.g. an event handler).
 * @param {?} builder
 * @param {?} nameResolver
 * @param {?} implicitReceiver
 * @param {?} action
 * @param {?} bindingId
 * @return {?}
 */
export function convertActionBinding(builder, nameResolver, implicitReceiver, action, bindingId) {
    if (!nameResolver) {
        nameResolver = new DefaultNameResolver();
    }
    const /** @type {?} */ visitor = new _AstToIrVisitor(builder, nameResolver, implicitReceiver, null, bindingId, true);
    const /** @type {?} */ actionStmts = [];
    flattenStatements(action.visit(visitor, _Mode.Statement), actionStmts);
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
 * Creates variables that are shared by multiple calls to `convertActionBinding` /
 * `convertPropertyBinding`
 * @param {?} stmts
 * @return {?}
 */
export function createSharedBindingVariablesIfNeeded(stmts) {
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
class _AstToIrVisitor {
    /**
     * @param {?} _builder
     * @param {?} _nameResolver
     * @param {?} _implicitReceiver
     * @param {?} _valueUnwrapper
     * @param {?} bindingId
     * @param {?} isAction
     */
    constructor(_builder, _nameResolver, _implicitReceiver, _valueUnwrapper, bindingId, isAction) {
        this._builder = _builder;
        this._nameResolver = _nameResolver;
        this._implicitReceiver = _implicitReceiver;
        this._valueUnwrapper = _valueUnwrapper;
        this.bindingId = bindingId;
        this.isAction = isAction;
        this._nodeMap = new Map();
        this._resultMap = new Map();
        this._currentTemporary = 0;
        this.needsValueUnwrapper = false;
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
        const /** @type {?} */ input = this.visit(ast.exp, _Mode.Expression);
        const /** @type {?} */ args = this.visitAll(ast.args, _Mode.Expression);
        const /** @type {?} */ value = this._nameResolver.callPipe(ast.name, input, args);
        if (!value) {
            throw new Error(`Illegal state: Pipe ${ast.name} is not allowed here!`);
        }
        this.needsValueUnwrapper = true;
        return convertToStatementIfNeeded(mode, this._valueUnwrapper.callMethod('unwrap', [value]));
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitFunctionCall(ast, mode) {
        return convertToStatementIfNeeded(mode, this.visit(ast.target, _Mode.Expression).callFn(this.visitAll(ast.args, _Mode.Expression)));
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
        const /** @type {?} */ parts = this.visitAll(ast.expressions, mode);
        const /** @type {?} */ literalArr = this.isAction ? o.literalArr(parts) : createCachedLiteralArray(this._builder, parts);
        return convertToStatementIfNeeded(mode, literalArr);
    }
    /**
     * @param {?} ast
     * @param {?} mode
     * @return {?}
     */
    visitLiteralMap(ast, mode) {
        const /** @type {?} */ parts = [];
        for (let /** @type {?} */ i = 0; i < ast.keys.length; i++) {
            parts.push([ast.keys[i], this.visit(ast.values[i], _Mode.Expression)]);
        }
        const /** @type {?} */ literalMap = this.isAction ? o.literalMap(parts) : createCachedLiteralMap(this._builder, parts);
        return convertToStatementIfNeeded(mode, literalMap);
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
    _getLocal(name) {
        if (this.isAction && name == EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        return this._nameResolver.getLocal(name);
    }
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
    _AstToIrVisitor.prototype.needsValueUnwrapper;
    /** @type {?} */
    _AstToIrVisitor.prototype.temporaryCount;
    /** @type {?} */
    _AstToIrVisitor.prototype._builder;
    /** @type {?} */
    _AstToIrVisitor.prototype._nameResolver;
    /** @type {?} */
    _AstToIrVisitor.prototype._implicitReceiver;
    /** @type {?} */
    _AstToIrVisitor.prototype._valueUnwrapper;
    /** @type {?} */
    _AstToIrVisitor.prototype.bindingId;
    /** @type {?} */
    _AstToIrVisitor.prototype.isAction;
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
function createCachedLiteralArray(builder, values) {
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
function createCachedLiteralMap(builder, entries) {
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
class DefaultNameResolver {
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
    getLocal(name) { return null; }
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
//# sourceMappingURL=expression_converter.js.map