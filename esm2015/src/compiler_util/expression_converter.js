/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as cdAst from '../expression_parser/ast';
import { Identifiers } from '../identifiers';
import * as o from '../output/output_ast';
import { ParseSourceSpan } from '../parse_util';
export class EventHandlerVars {
}
EventHandlerVars.event = o.variable('$event');
export class ConvertActionBindingResult {
    constructor(
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
        this.render3Stmts = stmts.map((statement) => {
            if (statement instanceof o.DeclareVarStmt && statement.name == allowDefault.name &&
                statement.value instanceof o.BinaryOperatorExpr) {
                const lhs = statement.value.lhs;
                return new o.ReturnStatement(lhs.value);
            }
            return statement;
        });
    }
}
/**
 * Converts the given expression AST into an executable output AST, assuming the expression is
 * used in an action binding (e.g. an event handler).
 */
export function convertActionBinding(localResolver, implicitReceiver, action, bindingId, interpolationFunction, baseSourceSpan) {
    if (!localResolver) {
        localResolver = new DefaultLocalResolver();
    }
    const actionWithoutBuiltins = convertPropertyBindingBuiltins({
        createLiteralArrayConverter: (argCount) => {
            // Note: no caching for literal arrays in actions.
            return (args) => o.literalArr(args);
        },
        createLiteralMapConverter: (keys) => {
            // Note: no caching for literal maps in actions.
            return (values) => {
                const entries = keys.map((k, i) => ({
                    key: k.key,
                    value: values[i],
                    quoted: k.quoted,
                }));
                return o.literalMap(entries);
            };
        },
        createPipeConverter: (name) => {
            throw new Error(`Illegal State: Actions are not allowed to contain pipes. Pipe: ${name}`);
        }
    }, action);
    const visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, interpolationFunction, baseSourceSpan);
    const actionStmts = [];
    flattenStatements(actionWithoutBuiltins.visit(visitor, _Mode.Statement), actionStmts);
    prependTemporaryDecls(visitor.temporaryCount, bindingId, actionStmts);
    const lastIndex = actionStmts.length - 1;
    let preventDefaultVar = null;
    if (lastIndex >= 0) {
        const lastStatement = actionStmts[lastIndex];
        const returnExpr = convertStmtIntoExpression(lastStatement);
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
export function convertPropertyBindingBuiltins(converterFactory, ast) {
    return convertBuiltins(converterFactory, ast);
}
export class ConvertPropertyBindingResult {
    constructor(stmts, currValExpr) {
        this.stmts = stmts;
        this.currValExpr = currValExpr;
    }
}
export var BindingForm;
(function (BindingForm) {
    // The general form of binding expression, supports all expressions.
    BindingForm[BindingForm["General"] = 0] = "General";
    // Try to generate a simple binding (no temporaries or statements)
    // otherwise generate a general binding
    BindingForm[BindingForm["TrySimple"] = 1] = "TrySimple";
})(BindingForm || (BindingForm = {}));
/**
 * Converts the given expression AST into an executable output AST, assuming the expression
 * is used in property binding. The expression has to be preprocessed via
 * `convertPropertyBindingBuiltins`.
 */
export function convertPropertyBinding(localResolver, implicitReceiver, expressionWithoutBuiltins, bindingId, form, interpolationFunction) {
    if (!localResolver) {
        localResolver = new DefaultLocalResolver();
    }
    const currValExpr = createCurrValueExpr(bindingId);
    const stmts = [];
    const visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, interpolationFunction);
    const outputExpr = expressionWithoutBuiltins.visit(visitor, _Mode.Expression);
    if (visitor.temporaryCount) {
        for (let i = 0; i < visitor.temporaryCount; i++) {
            stmts.push(temporaryDeclaration(bindingId, i));
        }
    }
    else if (form == BindingForm.TrySimple) {
        return new ConvertPropertyBindingResult([], outputExpr);
    }
    stmts.push(currValExpr.set(outputExpr).toDeclStmt(o.DYNAMIC_TYPE, [o.StmtModifier.Final]));
    return new ConvertPropertyBindingResult(stmts, currValExpr);
}
function convertBuiltins(converterFactory, ast) {
    const visitor = new _BuiltinAstConverter(converterFactory);
    return ast.visit(visitor);
}
function temporaryName(bindingId, temporaryNumber) {
    return `tmp_${bindingId}_${temporaryNumber}`;
}
export function temporaryDeclaration(bindingId, temporaryNumber) {
    return new o.DeclareVarStmt(temporaryName(bindingId, temporaryNumber), o.NULL_EXPR);
}
function prependTemporaryDecls(temporaryCount, bindingId, statements) {
    for (let i = temporaryCount - 1; i >= 0; i--) {
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
        throw new Error(`Expected a statement, but saw ${ast}`);
    }
}
function ensureExpressionMode(mode, ast) {
    if (mode !== _Mode.Expression) {
        throw new Error(`Expected an expression, but saw ${ast}`);
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
class _BuiltinAstConverter extends cdAst.AstTransformer {
    constructor(_converterFactory) {
        super();
        this._converterFactory = _converterFactory;
    }
    visitPipe(ast, context) {
        const args = [ast.exp, ...ast.args].map(ast => ast.visit(this, context));
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createPipeConverter(ast.name, args.length));
    }
    visitLiteralArray(ast, context) {
        const args = ast.expressions.map(ast => ast.visit(this, context));
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createLiteralArrayConverter(ast.expressions.length));
    }
    visitLiteralMap(ast, context) {
        const args = ast.values.map(ast => ast.visit(this, context));
        return new BuiltinFunctionCall(ast.span, args, this._converterFactory.createLiteralMapConverter(ast.keys));
    }
}
class _AstToIrVisitor {
    constructor(_localResolver, _implicitReceiver, bindingId, interpolationFunction, baseSourceSpan) {
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
    visitBinary(ast, mode) {
        let op;
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
        return convertToStatementIfNeeded(mode, new o.BinaryOperatorExpr(op, this._visit(ast.left, _Mode.Expression), this._visit(ast.right, _Mode.Expression), undefined, this.convertSourceSpan(ast.span)));
    }
    visitChain(ast, mode) {
        ensureStatementMode(mode, ast);
        return this.visitAll(ast.expressions, mode);
    }
    visitConditional(ast, mode) {
        const value = this._visit(ast.condition, _Mode.Expression);
        return convertToStatementIfNeeded(mode, value.conditional(this._visit(ast.trueExp, _Mode.Expression), this._visit(ast.falseExp, _Mode.Expression), this.convertSourceSpan(ast.span)));
    }
    visitPipe(ast, mode) {
        throw new Error(`Illegal state: Pipes should have been converted into functions. Pipe: ${ast.name}`);
    }
    visitFunctionCall(ast, mode) {
        const convertedArgs = this.visitAll(ast.args, _Mode.Expression);
        let fnResult;
        if (ast instanceof BuiltinFunctionCall) {
            fnResult = ast.converter(convertedArgs);
        }
        else {
            fnResult = this._visit(ast.target, _Mode.Expression)
                .callFn(convertedArgs, this.convertSourceSpan(ast.span));
        }
        return convertToStatementIfNeeded(mode, fnResult);
    }
    visitImplicitReceiver(ast, mode) {
        ensureExpressionMode(mode, ast);
        return this._implicitReceiver;
    }
    visitInterpolation(ast, mode) {
        ensureExpressionMode(mode, ast);
        const args = [o.literal(ast.expressions.length)];
        for (let i = 0; i < ast.strings.length - 1; i++) {
            args.push(o.literal(ast.strings[i]));
            args.push(this._visit(ast.expressions[i], _Mode.Expression));
        }
        args.push(o.literal(ast.strings[ast.strings.length - 1]));
        if (this.interpolationFunction) {
            return this.interpolationFunction(args);
        }
        return ast.expressions.length <= 9 ?
            o.importExpr(Identifiers.inlineInterpolate).callFn(args) :
            o.importExpr(Identifiers.interpolate).callFn([
                args[0], o.literalArr(args.slice(1), undefined, this.convertSourceSpan(ast.span))
            ]);
    }
    visitKeyedRead(ast, mode) {
        const leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            return convertToStatementIfNeeded(mode, this._visit(ast.obj, _Mode.Expression).key(this._visit(ast.key, _Mode.Expression)));
        }
    }
    visitKeyedWrite(ast, mode) {
        const obj = this._visit(ast.obj, _Mode.Expression);
        const key = this._visit(ast.key, _Mode.Expression);
        const value = this._visit(ast.value, _Mode.Expression);
        return convertToStatementIfNeeded(mode, obj.key(key).set(value));
    }
    visitLiteralArray(ast, mode) {
        throw new Error(`Illegal State: literal arrays should have been converted into functions`);
    }
    visitLiteralMap(ast, mode) {
        throw new Error(`Illegal State: literal maps should have been converted into functions`);
    }
    visitLiteralPrimitive(ast, mode) {
        // For literal values of null, undefined, true, or false allow type interference
        // to infer the type.
        const type = ast.value === null || ast.value === undefined || ast.value === true || ast.value === true ?
            o.INFERRED_TYPE :
            undefined;
        return convertToStatementIfNeeded(mode, o.literal(ast.value, type, this.convertSourceSpan(ast.span)));
    }
    _getLocal(name) { return this._localResolver.getLocal(name); }
    visitMethodCall(ast, mode) {
        if (ast.receiver instanceof cdAst.ImplicitReceiver && ast.name == '$any') {
            const args = this.visitAll(ast.args, _Mode.Expression);
            if (args.length != 1) {
                throw new Error(`Invalid call to $any, expected 1 argument but received ${args.length || 'none'}`);
            }
            return args[0].cast(o.DYNAMIC_TYPE, this.convertSourceSpan(ast.span));
        }
        const leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            const args = this.visitAll(ast.args, _Mode.Expression);
            let result = null;
            const receiver = this._visit(ast.receiver, _Mode.Expression);
            if (receiver === this._implicitReceiver) {
                const varExpr = this._getLocal(ast.name);
                if (varExpr) {
                    result = varExpr.callFn(args);
                }
            }
            if (result == null) {
                result = receiver.callMethod(ast.name, args, this.convertSourceSpan(ast.span));
            }
            return convertToStatementIfNeeded(mode, result);
        }
    }
    visitPrefixNot(ast, mode) {
        return convertToStatementIfNeeded(mode, o.not(this._visit(ast.expression, _Mode.Expression)));
    }
    visitNonNullAssert(ast, mode) {
        return convertToStatementIfNeeded(mode, o.assertNotNull(this._visit(ast.expression, _Mode.Expression)));
    }
    visitPropertyRead(ast, mode) {
        const leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            let result = null;
            const receiver = this._visit(ast.receiver, _Mode.Expression);
            if (receiver === this._implicitReceiver) {
                result = this._getLocal(ast.name);
            }
            if (result == null) {
                result = receiver.prop(ast.name);
            }
            return convertToStatementIfNeeded(mode, result);
        }
    }
    visitPropertyWrite(ast, mode) {
        const receiver = this._visit(ast.receiver, _Mode.Expression);
        let varExpr = null;
        if (receiver === this._implicitReceiver) {
            const localExpr = this._getLocal(ast.name);
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
    }
    visitSafePropertyRead(ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
    }
    visitSafeMethodCall(ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
    }
    visitAll(asts, mode) { return asts.map(ast => this._visit(ast, mode)); }
    visitQuote(ast, mode) {
        throw new Error(`Quotes are not supported for evaluation!
        Statement: ${ast.uninterpretedExpression} located at ${ast.location}`);
    }
    _visit(ast, mode) {
        const result = this._resultMap.get(ast);
        if (result)
            return result;
        return (this._nodeMap.get(ast) || ast).visit(this, mode);
    }
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
        let guardedExpression = this._visit(leftMostSafe.receiver, _Mode.Expression);
        let temporary = undefined;
        if (this.needsTemporary(leftMostSafe.receiver)) {
            // If the expression has method calls or pipes then we need to save the result into a
            // temporary variable to avoid calling stateful or impure code more than once.
            temporary = this.allocateTemporary();
            // Preserve the result in the temporary variable
            guardedExpression = temporary.set(guardedExpression);
            // Ensure all further references to the guarded expression refer to the temporary instead.
            this._resultMap.set(leftMostSafe.receiver, temporary);
        }
        const condition = guardedExpression.isBlank();
        // Convert the ast to an unguarded access to the receiver's member. The map will substitute
        // leftMostNode with its unguarded version in the call to `this.visit()`.
        if (leftMostSafe instanceof cdAst.SafeMethodCall) {
            this._nodeMap.set(leftMostSafe, new cdAst.MethodCall(leftMostSafe.span, leftMostSafe.receiver, leftMostSafe.name, leftMostSafe.args));
        }
        else {
            this._nodeMap.set(leftMostSafe, new cdAst.PropertyRead(leftMostSafe.span, leftMostSafe.receiver, leftMostSafe.name));
        }
        // Recursively convert the node now without the guarded member access.
        const access = this._visit(ast, _Mode.Expression);
        // Remove the mapping. This is not strictly required as the converter only traverses each node
        // once but is safer if the conversion is changed to traverse the nodes more than once.
        this._nodeMap.delete(leftMostSafe);
        // If we allocated a temporary, release it.
        if (temporary) {
            this.releaseTemporary(temporary);
        }
        // Produce the conditional
        return convertToStatementIfNeeded(mode, condition.conditional(o.literal(null), access));
    }
    // Given a expression of the form a?.b.c?.d.e the the left most safe node is
    // the (a?.b). The . and ?. are left associative thus can be rewritten as:
    // ((((a?.c).b).c)?.d).e. This returns the most deeply nested safe read or
    // safe method call as this needs be transform initially to:
    //   a == null ? null : a.c.b.c?.d.e
    // then to:
    //   a == null ? null : a.b.c == null ? null : a.b.c.d.e
    leftMostSafeNode(ast) {
        const visit = (visitor, ast) => {
            return (this._nodeMap.get(ast) || ast).visit(visitor);
        };
        return ast.visit({
            visitBinary(ast) { return null; },
            visitChain(ast) { return null; },
            visitConditional(ast) { return null; },
            visitFunctionCall(ast) { return null; },
            visitImplicitReceiver(ast) { return null; },
            visitInterpolation(ast) { return null; },
            visitKeyedRead(ast) { return visit(this, ast.obj); },
            visitKeyedWrite(ast) { return null; },
            visitLiteralArray(ast) { return null; },
            visitLiteralMap(ast) { return null; },
            visitLiteralPrimitive(ast) { return null; },
            visitMethodCall(ast) { return visit(this, ast.receiver); },
            visitPipe(ast) { return null; },
            visitPrefixNot(ast) { return null; },
            visitNonNullAssert(ast) { return null; },
            visitPropertyRead(ast) { return visit(this, ast.receiver); },
            visitPropertyWrite(ast) { return null; },
            visitQuote(ast) { return null; },
            visitSafeMethodCall(ast) { return visit(this, ast.receiver) || ast; },
            visitSafePropertyRead(ast) {
                return visit(this, ast.receiver) || ast;
            }
        });
    }
    // Returns true of the AST includes a method or a pipe indicating that, if the
    // expression is used as the target of a safe property or method access then
    // the expression should be stored into a temporary variable.
    needsTemporary(ast) {
        const visit = (visitor, ast) => {
            return ast && (this._nodeMap.get(ast) || ast).visit(visitor);
        };
        const visitSome = (visitor, ast) => {
            return ast.some(ast => visit(visitor, ast));
        };
        return ast.visit({
            visitBinary(ast) { return visit(this, ast.left) || visit(this, ast.right); },
            visitChain(ast) { return false; },
            visitConditional(ast) {
                return visit(this, ast.condition) || visit(this, ast.trueExp) ||
                    visit(this, ast.falseExp);
            },
            visitFunctionCall(ast) { return true; },
            visitImplicitReceiver(ast) { return false; },
            visitInterpolation(ast) { return visitSome(this, ast.expressions); },
            visitKeyedRead(ast) { return false; },
            visitKeyedWrite(ast) { return false; },
            visitLiteralArray(ast) { return true; },
            visitLiteralMap(ast) { return true; },
            visitLiteralPrimitive(ast) { return false; },
            visitMethodCall(ast) { return true; },
            visitPipe(ast) { return true; },
            visitPrefixNot(ast) { return visit(this, ast.expression); },
            visitNonNullAssert(ast) { return visit(this, ast.expression); },
            visitPropertyRead(ast) { return false; },
            visitPropertyWrite(ast) { return false; },
            visitQuote(ast) { return false; },
            visitSafeMethodCall(ast) { return true; },
            visitSafePropertyRead(ast) { return false; }
        });
    }
    allocateTemporary() {
        const tempNumber = this._currentTemporary++;
        this.temporaryCount = Math.max(this._currentTemporary, this.temporaryCount);
        return new o.ReadVarExpr(temporaryName(this.bindingId, tempNumber));
    }
    releaseTemporary(temporary) {
        this._currentTemporary--;
        if (temporary.name != temporaryName(this.bindingId, this._currentTemporary)) {
            throw new Error(`Temporary ${temporary.name} released out of order`);
        }
    }
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
    convertSourceSpan(span) {
        if (this.baseSourceSpan) {
            const start = this.baseSourceSpan.start.moveBy(span.start);
            const end = this.baseSourceSpan.start.moveBy(span.end);
            return new ParseSourceSpan(start, end);
        }
        else {
            return null;
        }
    }
}
function flattenStatements(arg, output) {
    if (Array.isArray(arg)) {
        arg.forEach((entry) => flattenStatements(entry, output));
    }
    else {
        output.push(arg);
    }
}
class DefaultLocalResolver {
    getLocal(name) {
        if (name === EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        return null;
    }
}
function createCurrValueExpr(bindingId) {
    return o.variable(`currVal_${bindingId}`); // fix syntax highlighting: `
}
function createPreventDefaultVar(bindingId) {
    return o.variable(`pd_${bindingId}`);
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
export class BuiltinFunctionCall extends cdAst.FunctionCall {
    constructor(span, args, converter) {
        super(span, null, args);
        this.args = args;
        this.converter = converter;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbl9jb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLDBCQUEwQixDQUFDO0FBQ2xELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEtBQUssQ0FBQyxNQUFNLHNCQUFzQixDQUFDO0FBQzFDLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFOUMsTUFBTSxPQUFPLGdCQUFnQjs7QUFBVSxzQkFBSyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7QUFJcEUsTUFBTSxPQUFPLDBCQUEwQjtJQUtyQztJQUNJOztPQUVHO0lBQ0ksS0FBb0I7SUFDM0I7O09BRUc7SUFDSSxZQUEyQjtRQUozQixVQUFLLEdBQUwsS0FBSyxDQUFlO1FBSXBCLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQ3BDOzs7Ozs7Ozs7Ozs7Ozs7O1dBZ0JHO1FBQ0gsc0VBQXNFO1FBQ3RFLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQXNCLEVBQUUsRUFBRTtZQUN2RCxJQUFJLFNBQVMsWUFBWSxDQUFDLENBQUMsY0FBYyxJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksWUFBWSxDQUFDLElBQUk7Z0JBQzVFLFNBQVMsQ0FBQyxLQUFLLFlBQVksQ0FBQyxDQUFDLGtCQUFrQixFQUFFO2dCQUNuRCxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQWlCLENBQUM7Z0JBQzlDLE9BQU8sSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FB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TSxvQkFBb0I7SUFDeEIsUUFBUSxDQUFDLElBQVk7UUFDbkIsSUFBSSxJQUFJLEtBQUssZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRTtZQUN4QyxPQUFPLGdCQUFnQixDQUFDLEtBQUssQ0FBQztTQUMvQjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxTQUFpQjtJQUM1QyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUUsNkJBQTZCO0FBQzNFLENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLFNBQWlCO0lBQ2hELE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLFNBQVMsRUFBRSxDQUFDLENBQUM7QUFDdkMsQ0FBQztBQUVELFNBQVMseUJBQXlCLENBQUMsSUFBaUI7SUFDbEQsSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLG1CQUFtQixFQUFFO1FBQ3pDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztLQUNsQjtTQUFNLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxlQUFlLEVBQUU7UUFDNUMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO0tBQ25CO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsTUFBTSxPQUFPLG1CQUFvQixTQUFRLEtBQUssQ0FBQyxZQUFZO0lBQ3pELFlBQVksSUFBcUIsRUFBUyxJQUFpQixFQUFTLFNBQTJCO1FBQzdGLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRGdCLFNBQUksR0FBSixJQUFJLENBQWE7UUFBUyxjQUFTLEdBQVQsU0FBUyxDQUFrQjtJQUUvRixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNkQXN0IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGNsYXNzIEV2ZW50SGFuZGxlclZhcnMgeyBzdGF0aWMgZXZlbnQgPSBvLnZhcmlhYmxlKCckZXZlbnQnKTsgfVxuXG5leHBvcnQgaW50ZXJmYWNlIExvY2FsUmVzb2x2ZXIgeyBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbDsgfVxuXG5leHBvcnQgY2xhc3MgQ29udmVydEFjdGlvbkJpbmRpbmdSZXN1bHQge1xuICAvKipcbiAgICogU3RvcmUgc3RhdGVtZW50cyB3aGljaCBhcmUgcmVuZGVyMyBjb21wYXRpYmxlLlxuICAgKi9cbiAgcmVuZGVyM1N0bXRzOiBvLlN0YXRlbWVudFtdO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIC8qKlxuICAgICAgICogUmVuZGVyMiBjb21wYXRpYmxlIHN0YXRlbWVudHMsXG4gICAgICAgKi9cbiAgICAgIHB1YmxpYyBzdG10czogby5TdGF0ZW1lbnRbXSxcbiAgICAgIC8qKlxuICAgICAgICogVmFyaWFibGUgbmFtZSB1c2VkIHdpdGggcmVuZGVyMiBjb21wYXRpYmxlIHN0YXRlbWVudHMuXG4gICAgICAgKi9cbiAgICAgIHB1YmxpYyBhbGxvd0RlZmF1bHQ6IG8uUmVhZFZhckV4cHIpIHtcbiAgICAvKipcbiAgICAgKiBUaGlzIGlzIGJpdCBvZiBhIGhhY2suIEl0IGNvbnZlcnRzIHN0YXRlbWVudHMgd2hpY2ggcmVuZGVyMiBleHBlY3RzIHRvIHN0YXRlbWVudHMgd2hpY2ggYXJlXG4gICAgICogZXhwZWN0ZWQgYnkgcmVuZGVyMy5cbiAgICAgKlxuICAgICAqIEV4YW1wbGU6IGA8ZGl2IGNsaWNrPVwiZG9Tb21ldGhpbmcoJGV2ZW50KVwiPmAgd2lsbCBnZW5lcmF0ZTpcbiAgICAgKlxuICAgICAqIFJlbmRlcjM6XG4gICAgICogYGBgXG4gICAgICogY29uc3QgcGRfYjphbnkgPSAoKDxhbnk+Y3R4LmRvU29tZXRoaW5nKCRldmVudCkpICE9PSBmYWxzZSk7XG4gICAgICogcmV0dXJuIHBkX2I7XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBidXQgcmVuZGVyMiBleHBlY3RzOlxuICAgICAqIGBgYFxuICAgICAqIHJldHVybiBjdHguZG9Tb21ldGhpbmcoJGV2ZW50KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICAvLyBUT0RPKG1pc2tvKTogcmVtb3ZlIHRoaXMgaGFjayBvbmNlIHdlIG5vIGxvbmdlciBzdXBwb3J0IFZpZXdFbmdpbmUuXG4gICAgdGhpcy5yZW5kZXIzU3RtdHMgPSBzdG10cy5tYXAoKHN0YXRlbWVudDogby5TdGF0ZW1lbnQpID0+IHtcbiAgICAgIGlmIChzdGF0ZW1lbnQgaW5zdGFuY2VvZiBvLkRlY2xhcmVWYXJTdG10ICYmIHN0YXRlbWVudC5uYW1lID09IGFsbG93RGVmYXVsdC5uYW1lICYmXG4gICAgICAgICAgc3RhdGVtZW50LnZhbHVlIGluc3RhbmNlb2Ygby5CaW5hcnlPcGVyYXRvckV4cHIpIHtcbiAgICAgICAgY29uc3QgbGhzID0gc3RhdGVtZW50LnZhbHVlLmxocyBhcyBvLkNhc3RFeHByO1xuICAgICAgICByZXR1cm4gbmV3IG8uUmV0dXJuU3RhdGVtZW50KGxocy52YWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RhdGVtZW50O1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIEludGVycG9sYXRpb25GdW5jdGlvbiA9IChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4gby5FeHByZXNzaW9uO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBnaXZlbiBleHByZXNzaW9uIEFTVCBpbnRvIGFuIGV4ZWN1dGFibGUgb3V0cHV0IEFTVCwgYXNzdW1pbmcgdGhlIGV4cHJlc3Npb24gaXNcbiAqIHVzZWQgaW4gYW4gYWN0aW9uIGJpbmRpbmcgKGUuZy4gYW4gZXZlbnQgaGFuZGxlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICBsb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyIHwgbnVsbCwgaW1wbGljaXRSZWNlaXZlcjogby5FeHByZXNzaW9uLCBhY3Rpb246IGNkQXN0LkFTVCxcbiAgICBiaW5kaW5nSWQ6IHN0cmluZywgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uPzogSW50ZXJwb2xhdGlvbkZ1bmN0aW9uLFxuICAgIGJhc2VTb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuKTogQ29udmVydEFjdGlvbkJpbmRpbmdSZXN1bHQge1xuICBpZiAoIWxvY2FsUmVzb2x2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyID0gbmV3IERlZmF1bHRMb2NhbFJlc29sdmVyKCk7XG4gIH1cbiAgY29uc3QgYWN0aW9uV2l0aG91dEJ1aWx0aW5zID0gY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgICAge1xuICAgICAgICBjcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXI6IChhcmdDb3VudDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgLy8gTm90ZTogbm8gY2FjaGluZyBmb3IgbGl0ZXJhbCBhcnJheXMgaW4gYWN0aW9ucy5cbiAgICAgICAgICByZXR1cm4gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiBvLmxpdGVyYWxBcnIoYXJncyk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZUxpdGVyYWxNYXBDb252ZXJ0ZXI6IChrZXlzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbn1bXSkgPT4ge1xuICAgICAgICAgIC8vIE5vdGU6IG5vIGNhY2hpbmcgZm9yIGxpdGVyYWwgbWFwcyBpbiBhY3Rpb25zLlxuICAgICAgICAgIHJldHVybiAodmFsdWVzOiBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZW50cmllcyA9IGtleXMubWFwKChrLCBpKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrLmtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZXNbaV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdW90ZWQ6IGsucXVvdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHJldHVybiBvLmxpdGVyYWxNYXAoZW50cmllcyk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlUGlwZUNvbnZlcnRlcjogKG5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSWxsZWdhbCBTdGF0ZTogQWN0aW9ucyBhcmUgbm90IGFsbG93ZWQgdG8gY29udGFpbiBwaXBlcy4gUGlwZTogJHtuYW1lfWApO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYWN0aW9uKTtcblxuICBjb25zdCB2aXNpdG9yID0gbmV3IF9Bc3RUb0lyVmlzaXRvcihcbiAgICAgIGxvY2FsUmVzb2x2ZXIsIGltcGxpY2l0UmVjZWl2ZXIsIGJpbmRpbmdJZCwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uLCBiYXNlU291cmNlU3Bhbik7XG4gIGNvbnN0IGFjdGlvblN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZsYXR0ZW5TdGF0ZW1lbnRzKGFjdGlvbldpdGhvdXRCdWlsdGlucy52aXNpdCh2aXNpdG9yLCBfTW9kZS5TdGF0ZW1lbnQpLCBhY3Rpb25TdG10cyk7XG4gIHByZXBlbmRUZW1wb3JhcnlEZWNscyh2aXNpdG9yLnRlbXBvcmFyeUNvdW50LCBiaW5kaW5nSWQsIGFjdGlvblN0bXRzKTtcbiAgY29uc3QgbGFzdEluZGV4ID0gYWN0aW9uU3RtdHMubGVuZ3RoIC0gMTtcbiAgbGV0IHByZXZlbnREZWZhdWx0VmFyOiBvLlJlYWRWYXJFeHByID0gbnVsbCAhO1xuICBpZiAobGFzdEluZGV4ID49IDApIHtcbiAgICBjb25zdCBsYXN0U3RhdGVtZW50ID0gYWN0aW9uU3RtdHNbbGFzdEluZGV4XTtcbiAgICBjb25zdCByZXR1cm5FeHByID0gY29udmVydFN0bXRJbnRvRXhwcmVzc2lvbihsYXN0U3RhdGVtZW50KTtcbiAgICBpZiAocmV0dXJuRXhwcikge1xuICAgICAgLy8gTm90ZTogV2UgbmVlZCB0byBjYXN0IHRoZSByZXN1bHQgb2YgdGhlIG1ldGhvZCBjYWxsIHRvIGR5bmFtaWMsXG4gICAgICAvLyBhcyBpdCBtaWdodCBiZSBhIHZvaWQgbWV0aG9kIVxuICAgICAgcHJldmVudERlZmF1bHRWYXIgPSBjcmVhdGVQcmV2ZW50RGVmYXVsdFZhcihiaW5kaW5nSWQpO1xuICAgICAgYWN0aW9uU3RtdHNbbGFzdEluZGV4XSA9XG4gICAgICAgICAgcHJldmVudERlZmF1bHRWYXIuc2V0KHJldHVybkV4cHIuY2FzdChvLkRZTkFNSUNfVFlQRSkubm90SWRlbnRpY2FsKG8ubGl0ZXJhbChmYWxzZSkpKVxuICAgICAgICAgICAgICAudG9EZWNsU3RtdChudWxsLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5ldyBDb252ZXJ0QWN0aW9uQmluZGluZ1Jlc3VsdChhY3Rpb25TdG10cywgcHJldmVudERlZmF1bHRWYXIpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0aW5Db252ZXJ0ZXIgeyAoYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb247IH1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsdGluQ29udmVydGVyRmFjdG9yeSB7XG4gIGNyZWF0ZUxpdGVyYWxBcnJheUNvbnZlcnRlcihhcmdDb3VudDogbnVtYmVyKTogQnVpbHRpbkNvbnZlcnRlcjtcbiAgY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcihrZXlzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbn1bXSk6IEJ1aWx0aW5Db252ZXJ0ZXI7XG4gIGNyZWF0ZVBpcGVDb252ZXJ0ZXIobmFtZTogc3RyaW5nLCBhcmdDb3VudDogbnVtYmVyKTogQnVpbHRpbkNvbnZlcnRlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGlucyhcbiAgICBjb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSwgYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5BU1Qge1xuICByZXR1cm4gY29udmVydEJ1aWx0aW5zKGNvbnZlcnRlckZhY3RvcnksIGFzdCk7XG59XG5cbmV4cG9ydCBjbGFzcyBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHN0bXRzOiBvLlN0YXRlbWVudFtdLCBwdWJsaWMgY3VyclZhbEV4cHI6IG8uRXhwcmVzc2lvbikge31cbn1cblxuZXhwb3J0IGVudW0gQmluZGluZ0Zvcm0ge1xuICAvLyBUaGUgZ2VuZXJhbCBmb3JtIG9mIGJpbmRpbmcgZXhwcmVzc2lvbiwgc3VwcG9ydHMgYWxsIGV4cHJlc3Npb25zLlxuICBHZW5lcmFsLFxuXG4gIC8vIFRyeSB0byBnZW5lcmF0ZSBhIHNpbXBsZSBiaW5kaW5nIChubyB0ZW1wb3JhcmllcyBvciBzdGF0ZW1lbnRzKVxuICAvLyBvdGhlcndpc2UgZ2VuZXJhdGUgYSBnZW5lcmFsIGJpbmRpbmdcbiAgVHJ5U2ltcGxlLFxufVxuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBnaXZlbiBleHByZXNzaW9uIEFTVCBpbnRvIGFuIGV4ZWN1dGFibGUgb3V0cHV0IEFTVCwgYXNzdW1pbmcgdGhlIGV4cHJlc3Npb25cbiAqIGlzIHVzZWQgaW4gcHJvcGVydHkgYmluZGluZy4gVGhlIGV4cHJlc3Npb24gaGFzIHRvIGJlIHByZXByb2Nlc3NlZCB2aWFcbiAqIGBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnNgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICBsb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyIHwgbnVsbCwgaW1wbGljaXRSZWNlaXZlcjogby5FeHByZXNzaW9uLFxuICAgIGV4cHJlc3Npb25XaXRob3V0QnVpbHRpbnM6IGNkQXN0LkFTVCwgYmluZGluZ0lkOiBzdHJpbmcsIGZvcm06IEJpbmRpbmdGb3JtLFxuICAgIGludGVycG9sYXRpb25GdW5jdGlvbj86IEludGVycG9sYXRpb25GdW5jdGlvbik6IENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQge1xuICBpZiAoIWxvY2FsUmVzb2x2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyID0gbmV3IERlZmF1bHRMb2NhbFJlc29sdmVyKCk7XG4gIH1cbiAgY29uc3QgY3VyclZhbEV4cHIgPSBjcmVhdGVDdXJyVmFsdWVFeHByKGJpbmRpbmdJZCk7XG4gIGNvbnN0IHN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHZpc2l0b3IgPVxuICAgICAgbmV3IF9Bc3RUb0lyVmlzaXRvcihsb2NhbFJlc29sdmVyLCBpbXBsaWNpdFJlY2VpdmVyLCBiaW5kaW5nSWQsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gIGNvbnN0IG91dHB1dEV4cHI6IG8uRXhwcmVzc2lvbiA9IGV4cHJlc3Npb25XaXRob3V0QnVpbHRpbnMudmlzaXQodmlzaXRvciwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgaWYgKHZpc2l0b3IudGVtcG9yYXJ5Q291bnQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZpc2l0b3IudGVtcG9yYXJ5Q291bnQ7IGkrKykge1xuICAgICAgc3RtdHMucHVzaCh0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQsIGkpKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoZm9ybSA9PSBCaW5kaW5nRm9ybS5UcnlTaW1wbGUpIHtcbiAgICByZXR1cm4gbmV3IENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQoW10sIG91dHB1dEV4cHIpO1xuICB9XG5cbiAgc3RtdHMucHVzaChjdXJyVmFsRXhwci5zZXQob3V0cHV0RXhwcikudG9EZWNsU3RtdChvLkRZTkFNSUNfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSkpO1xuICByZXR1cm4gbmV3IENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQoc3RtdHMsIGN1cnJWYWxFeHByKTtcbn1cblxuZnVuY3Rpb24gY29udmVydEJ1aWx0aW5zKGNvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5LCBhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LkFTVCB7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX0J1aWx0aW5Bc3RDb252ZXJ0ZXIoY29udmVydGVyRmFjdG9yeSk7XG4gIHJldHVybiBhc3QudmlzaXQodmlzaXRvcik7XG59XG5cbmZ1bmN0aW9uIHRlbXBvcmFyeU5hbWUoYmluZGluZ0lkOiBzdHJpbmcsIHRlbXBvcmFyeU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGB0bXBfJHtiaW5kaW5nSWR9XyR7dGVtcG9yYXJ5TnVtYmVyfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQ6IHN0cmluZywgdGVtcG9yYXJ5TnVtYmVyOiBudW1iZXIpOiBvLlN0YXRlbWVudCB7XG4gIHJldHVybiBuZXcgby5EZWNsYXJlVmFyU3RtdCh0ZW1wb3JhcnlOYW1lKGJpbmRpbmdJZCwgdGVtcG9yYXJ5TnVtYmVyKSwgby5OVUxMX0VYUFIpO1xufVxuXG5mdW5jdGlvbiBwcmVwZW5kVGVtcG9yYXJ5RGVjbHMoXG4gICAgdGVtcG9yYXJ5Q291bnQ6IG51bWJlciwgYmluZGluZ0lkOiBzdHJpbmcsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pIHtcbiAgZm9yIChsZXQgaSA9IHRlbXBvcmFyeUNvdW50IC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBzdGF0ZW1lbnRzLnVuc2hpZnQodGVtcG9yYXJ5RGVjbGFyYXRpb24oYmluZGluZ0lkLCBpKSk7XG4gIH1cbn1cblxuZW51bSBfTW9kZSB7XG4gIFN0YXRlbWVudCxcbiAgRXhwcmVzc2lvblxufVxuXG5mdW5jdGlvbiBlbnN1cmVTdGF0ZW1lbnRNb2RlKG1vZGU6IF9Nb2RlLCBhc3Q6IGNkQXN0LkFTVCkge1xuICBpZiAobW9kZSAhPT0gX01vZGUuU3RhdGVtZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhIHN0YXRlbWVudCwgYnV0IHNhdyAke2FzdH1gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbnN1cmVFeHByZXNzaW9uTW9kZShtb2RlOiBfTW9kZSwgYXN0OiBjZEFzdC5BU1QpIHtcbiAgaWYgKG1vZGUgIT09IF9Nb2RlLkV4cHJlc3Npb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGFuIGV4cHJlc3Npb24sIGJ1dCBzYXcgJHthc3R9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZTogX01vZGUsIGV4cHI6IG8uRXhwcmVzc2lvbik6IG8uRXhwcmVzc2lvbnxvLlN0YXRlbWVudCB7XG4gIGlmIChtb2RlID09PSBfTW9kZS5TdGF0ZW1lbnQpIHtcbiAgICByZXR1cm4gZXhwci50b1N0bXQoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxufVxuXG5jbGFzcyBfQnVpbHRpbkFzdENvbnZlcnRlciBleHRlbmRzIGNkQXN0LkFzdFRyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfY29udmVydGVyRmFjdG9yeTogQnVpbHRpbkNvbnZlcnRlckZhY3RvcnkpIHsgc3VwZXIoKTsgfVxuICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBhcmdzID0gW2FzdC5leHAsIC4uLmFzdC5hcmdzXS5tYXAoYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXJncywgdGhpcy5fY29udmVydGVyRmFjdG9yeS5jcmVhdGVQaXBlQ29udmVydGVyKGFzdC5uYW1lLCBhcmdzLmxlbmd0aCkpO1xuICB9XG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSBhc3QuZXhwcmVzc2lvbnMubWFwKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChcbiAgICAgICAgYXN0LnNwYW4sIGFyZ3MsIHRoaXMuX2NvbnZlcnRlckZhY3RvcnkuY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyKGFzdC5leHByZXNzaW9ucy5sZW5ndGgpKTtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSBhc3QudmFsdWVzLm1hcChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcblxuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChcbiAgICAgICAgYXN0LnNwYW4sIGFyZ3MsIHRoaXMuX2NvbnZlcnRlckZhY3RvcnkuY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcihhc3Qua2V5cykpO1xuICB9XG59XG5cbmNsYXNzIF9Bc3RUb0lyVmlzaXRvciBpbXBsZW1lbnRzIGNkQXN0LkFzdFZpc2l0b3Ige1xuICBwcml2YXRlIF9ub2RlTWFwID0gbmV3IE1hcDxjZEFzdC5BU1QsIGNkQXN0LkFTVD4oKTtcbiAgcHJpdmF0ZSBfcmVzdWx0TWFwID0gbmV3IE1hcDxjZEFzdC5BU1QsIG8uRXhwcmVzc2lvbj4oKTtcbiAgcHJpdmF0ZSBfY3VycmVudFRlbXBvcmFyeTogbnVtYmVyID0gMDtcbiAgcHVibGljIHRlbXBvcmFyeUNvdW50OiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfbG9jYWxSZXNvbHZlcjogTG9jYWxSZXNvbHZlciwgcHJpdmF0ZSBfaW1wbGljaXRSZWNlaXZlcjogby5FeHByZXNzaW9uLFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nSWQ6IHN0cmluZywgcHJpdmF0ZSBpbnRlcnBvbGF0aW9uRnVuY3Rpb246IEludGVycG9sYXRpb25GdW5jdGlvbnx1bmRlZmluZWQsXG4gICAgICBwcml2YXRlIGJhc2VTb3VyY2VTcGFuPzogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIHZpc2l0QmluYXJ5KGFzdDogY2RBc3QuQmluYXJ5LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgbGV0IG9wOiBvLkJpbmFyeU9wZXJhdG9yO1xuICAgIHN3aXRjaCAoYXN0Lm9wZXJhdGlvbikge1xuICAgICAgY2FzZSAnKyc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5QbHVzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTWludXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnKic6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5NdWx0aXBseTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcvJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkRpdmlkZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICclJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk1vZHVsbztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcmJic6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5BbmQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnfHwnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuT3I7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuRXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyE9JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk5vdEVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc9PT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuSWRlbnRpY2FsO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyE9PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnPCc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Mb3dlcjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc+JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlcjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc8PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5Mb3dlckVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc+PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBvcGVyYXRpb24gJHthc3Qub3BlcmF0aW9ufWApO1xuICAgIH1cblxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSxcbiAgICAgICAgbmV3IG8uQmluYXJ5T3BlcmF0b3JFeHByKFxuICAgICAgICAgICAgb3AsIHRoaXMuX3Zpc2l0KGFzdC5sZWZ0LCBfTW9kZS5FeHByZXNzaW9uKSwgdGhpcy5fdmlzaXQoYXN0LnJpZ2h0LCBfTW9kZS5FeHByZXNzaW9uKSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCwgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpKTtcbiAgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBjZEFzdC5DaGFpbiwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGVuc3VyZVN0YXRlbWVudE1vZGUobW9kZSwgYXN0KTtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMsIG1vZGUpO1xuICB9XG5cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgdmFsdWU6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5jb25kaXRpb24sIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgdmFsdWUuY29uZGl0aW9uYWwoXG4gICAgICAgICAgICAgICAgICB0aGlzLl92aXNpdChhc3QudHJ1ZUV4cCwgX01vZGUuRXhwcmVzc2lvbiksXG4gICAgICAgICAgICAgICAgICB0aGlzLl92aXNpdChhc3QuZmFsc2VFeHAsIF9Nb2RlLkV4cHJlc3Npb24pLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSkpO1xuICB9XG5cbiAgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBJbGxlZ2FsIHN0YXRlOiBQaXBlcyBzaG91bGQgaGF2ZSBiZWVuIGNvbnZlcnRlZCBpbnRvIGZ1bmN0aW9ucy4gUGlwZTogJHthc3QubmFtZX1gKTtcbiAgfVxuXG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogY2RBc3QuRnVuY3Rpb25DYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgY29udmVydGVkQXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGxldCBmblJlc3VsdDogby5FeHByZXNzaW9uO1xuICAgIGlmIChhc3QgaW5zdGFuY2VvZiBCdWlsdGluRnVuY3Rpb25DYWxsKSB7XG4gICAgICBmblJlc3VsdCA9IGFzdC5jb252ZXJ0ZXIoY29udmVydGVkQXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZuUmVzdWx0ID0gdGhpcy5fdmlzaXQoYXN0LnRhcmdldCAhLCBfTW9kZS5FeHByZXNzaW9uKVxuICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihjb252ZXJ0ZWRBcmdzLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSk7XG4gICAgfVxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCBmblJlc3VsdCk7XG4gIH1cblxuICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgZW5zdXJlRXhwcmVzc2lvbk1vZGUobW9kZSwgYXN0KTtcbiAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlcjtcbiAgfVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24sIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVFeHByZXNzaW9uTW9kZShtb2RlLCBhc3QpO1xuICAgIGNvbnN0IGFyZ3MgPSBbby5saXRlcmFsKGFzdC5leHByZXNzaW9ucy5sZW5ndGgpXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzdC5zdHJpbmdzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgYXJncy5wdXNoKG8ubGl0ZXJhbChhc3Quc3RyaW5nc1tpXSkpO1xuICAgICAgYXJncy5wdXNoKHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uc1tpXSwgX01vZGUuRXhwcmVzc2lvbikpO1xuICAgIH1cbiAgICBhcmdzLnB1c2goby5saXRlcmFsKGFzdC5zdHJpbmdzW2FzdC5zdHJpbmdzLmxlbmd0aCAtIDFdKSk7XG5cbiAgICBpZiAodGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGFzdC5leHByZXNzaW9ucy5sZW5ndGggPD0gOSA/XG4gICAgICAgIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5pbmxpbmVJbnRlcnBvbGF0ZSkuY2FsbEZuKGFyZ3MpIDpcbiAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmludGVycG9sYXRlKS5jYWxsRm4oW1xuICAgICAgICAgIGFyZ3NbMF0sIG8ubGl0ZXJhbEFycihhcmdzLnNsaWNlKDEpLCB1bmRlZmluZWQsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKVxuICAgICAgICBdKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogY2RBc3QuS2V5ZWRSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgbGVmdE1vc3RTYWZlID0gdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCk7XG4gICAgaWYgKGxlZnRNb3N0U2FmZSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCBsZWZ0TW9zdFNhZmUsIG1vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgICAgbW9kZSwgdGhpcy5fdmlzaXQoYXN0Lm9iaiwgX01vZGUuRXhwcmVzc2lvbikua2V5KHRoaXMuX3Zpc2l0KGFzdC5rZXksIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IG9iajogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0Lm9iaiwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3Qga2V5OiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3Qua2V5LCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCB2YWx1ZTogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LnZhbHVlLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgb2JqLmtleShrZXkpLnNldCh2YWx1ZSkpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IGxpdGVyYWwgYXJyYXlzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zYCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBsaXRlcmFsIG1hcHMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnNgKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICAvLyBGb3IgbGl0ZXJhbCB2YWx1ZXMgb2YgbnVsbCwgdW5kZWZpbmVkLCB0cnVlLCBvciBmYWxzZSBhbGxvdyB0eXBlIGludGVyZmVyZW5jZVxuICAgIC8vIHRvIGluZmVyIHRoZSB0eXBlLlxuICAgIGNvbnN0IHR5cGUgPVxuICAgICAgICBhc3QudmFsdWUgPT09IG51bGwgfHwgYXN0LnZhbHVlID09PSB1bmRlZmluZWQgfHwgYXN0LnZhbHVlID09PSB0cnVlIHx8IGFzdC52YWx1ZSA9PT0gdHJ1ZSA/XG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSA6XG4gICAgICAgIHVuZGVmaW5lZDtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsIG8ubGl0ZXJhbChhc3QudmFsdWUsIHR5cGUsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICBwcml2YXRlIF9nZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7IHJldHVybiB0aGlzLl9sb2NhbFJlc29sdmVyLmdldExvY2FsKG5hbWUpOyB9XG5cbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogY2RBc3QuTWV0aG9kQ2FsbCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGlmIChhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyICYmIGFzdC5uYW1lID09ICckYW55Jykge1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwoYXN0LmFyZ3MsIF9Nb2RlLkV4cHJlc3Npb24pIGFzIGFueVtdO1xuICAgICAgaWYgKGFyZ3MubGVuZ3RoICE9IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEludmFsaWQgY2FsbCB0byAkYW55LCBleHBlY3RlZCAxIGFyZ3VtZW50IGJ1dCByZWNlaXZlZCAke2FyZ3MubGVuZ3RoIHx8ICdub25lJ31gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAoYXJnc1swXSBhcyBvLkV4cHJlc3Npb24pLmNhc3Qoby5EWU5BTUlDX1RZUEUsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICB9XG5cbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCByZWNlaXZlciA9IHRoaXMuX3Zpc2l0KGFzdC5yZWNlaXZlciwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgICBpZiAocmVjZWl2ZXIgPT09IHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgICAgY29uc3QgdmFyRXhwciA9IHRoaXMuX2dldExvY2FsKGFzdC5uYW1lKTtcbiAgICAgICAgaWYgKHZhckV4cHIpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YXJFeHByLmNhbGxGbihhcmdzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCA9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLmNhbGxNZXRob2QoYXN0Lm5hbWUsIGFyZ3MsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCByZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG8ubm90KHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSwgby5hc3NlcnROb3ROdWxsKHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCByZWNlaXZlciA9IHRoaXMuX3Zpc2l0KGFzdC5yZWNlaXZlciwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgICBpZiAocmVjZWl2ZXIgPT09IHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUpO1xuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCA9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLnByb3AoYXN0Lm5hbWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIHJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogY2RBc3QuUHJvcGVydHlXcml0ZSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IHJlY2VpdmVyOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuXG4gICAgbGV0IHZhckV4cHI6IG8uUmVhZFByb3BFeHByfG51bGwgPSBudWxsO1xuICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgY29uc3QgbG9jYWxFeHByID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUpO1xuICAgICAgaWYgKGxvY2FsRXhwcikge1xuICAgICAgICBpZiAobG9jYWxFeHByIGluc3RhbmNlb2Ygby5SZWFkUHJvcEV4cHIpIHtcbiAgICAgICAgICAvLyBJZiB0aGUgbG9jYWwgdmFyaWFibGUgaXMgYSBwcm9wZXJ0eSByZWFkIGV4cHJlc3Npb24sIGl0J3MgYSByZWZlcmVuY2VcbiAgICAgICAgICAvLyB0byBhICdjb250ZXh0LnByb3BlcnR5JyB2YWx1ZSBhbmQgd2lsbCBiZSB1c2VkIGFzIHRoZSB0YXJnZXQgb2YgdGhlXG4gICAgICAgICAgLy8gd3JpdGUgZXhwcmVzc2lvbi5cbiAgICAgICAgICB2YXJFeHByID0gbG9jYWxFeHByO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSBpdCdzIGFuIGVycm9yLlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGFzc2lnbiB0byBhIHJlZmVyZW5jZSBvciB2YXJpYWJsZSEnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBJZiBubyBsb2NhbCBleHByZXNzaW9uIGNvdWxkIGJlIHByb2R1Y2VkLCB1c2UgdGhlIG9yaWdpbmFsIHJlY2VpdmVyJ3NcbiAgICAvLyBwcm9wZXJ0eSBhcyB0aGUgdGFyZ2V0LlxuICAgIGlmICh2YXJFeHByID09PSBudWxsKSB7XG4gICAgICB2YXJFeHByID0gcmVjZWl2ZXIucHJvcChhc3QubmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCB2YXJFeHByLnNldCh0aGlzLl92aXNpdChhc3QudmFsdWUsIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gIH1cblxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KSwgbW9kZSk7XG4gIH1cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogY2RBc3QuU2FmZU1ldGhvZENhbGwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpLCBtb2RlKTtcbiAgfVxuXG4gIHZpc2l0QWxsKGFzdHM6IGNkQXN0LkFTVFtdLCBtb2RlOiBfTW9kZSk6IGFueSB7IHJldHVybiBhc3RzLm1hcChhc3QgPT4gdGhpcy5fdmlzaXQoYXN0LCBtb2RlKSk7IH1cblxuICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFF1b3RlcyBhcmUgbm90IHN1cHBvcnRlZCBmb3IgZXZhbHVhdGlvbiFcbiAgICAgICAgU3RhdGVtZW50OiAke2FzdC51bmludGVycHJldGVkRXhwcmVzc2lvbn0gbG9jYXRlZCBhdCAke2FzdC5sb2NhdGlvbn1gKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0KGFzdDogY2RBc3QuQVNULCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fcmVzdWx0TWFwLmdldChhc3QpO1xuICAgIGlmIChyZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgcmV0dXJuICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodGhpcywgbW9kZSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRTYWZlQWNjZXNzKFxuICAgICAgYXN0OiBjZEFzdC5BU1QsIGxlZnRNb3N0U2FmZTogY2RBc3QuU2FmZU1ldGhvZENhbGx8Y2RBc3QuU2FmZVByb3BlcnR5UmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGNvbnRhaW5zIGEgc2FmZSBhY2Nlc3Mgbm9kZSBvbiB0aGUgbGVmdCBpdCBuZWVkcyB0byBiZSBjb252ZXJ0ZWQgdG9cbiAgICAvLyBhbiBleHByZXNzaW9uIHRoYXQgZ3VhcmRzIHRoZSBhY2Nlc3MgdG8gdGhlIG1lbWJlciBieSBjaGVja2luZyB0aGUgcmVjZWl2ZXIgZm9yIGJsYW5rLiBBc1xuICAgIC8vIGV4ZWN1dGlvbiBwcm9jZWVkcyBmcm9tIGxlZnQgdG8gcmlnaHQsIHRoZSBsZWZ0IG1vc3QgcGFydCBvZiB0aGUgZXhwcmVzc2lvbiBtdXN0IGJlIGd1YXJkZWRcbiAgICAvLyBmaXJzdCBidXQsIGJlY2F1c2UgbWVtYmVyIGFjY2VzcyBpcyBsZWZ0IGFzc29jaWF0aXZlLCB0aGUgcmlnaHQgc2lkZSBvZiB0aGUgZXhwcmVzc2lvbiBpcyBhdFxuICAgIC8vIHRoZSB0b3Agb2YgdGhlIEFTVC4gVGhlIGRlc2lyZWQgcmVzdWx0IHJlcXVpcmVzIGxpZnRpbmcgYSBjb3B5IG9mIHRoZSB0aGUgbGVmdCBwYXJ0IG9mIHRoZVxuICAgIC8vIGV4cHJlc3Npb24gdXAgdG8gdGVzdCBpdCBmb3IgYmxhbmsgYmVmb3JlIGdlbmVyYXRpbmcgdGhlIHVuZ3VhcmRlZCB2ZXJzaW9uLlxuXG4gICAgLy8gQ29uc2lkZXIsIGZvciBleGFtcGxlIHRoZSBmb2xsb3dpbmcgZXhwcmVzc2lvbjogYT8uYi5jPy5kLmVcblxuICAgIC8vIFRoaXMgcmVzdWx0cyBpbiB0aGUgYXN0OlxuICAgIC8vICAgICAgICAgLlxuICAgIC8vICAgICAgICAvIFxcXG4gICAgLy8gICAgICAgPy4gICBlXG4gICAgLy8gICAgICAvICBcXFxuICAgIC8vICAgICAuICAgIGRcbiAgICAvLyAgICAvIFxcXG4gICAgLy8gICA/LiAgY1xuICAgIC8vICAvICBcXFxuICAgIC8vIGEgICAgYlxuXG4gICAgLy8gVGhlIGZvbGxvd2luZyB0cmVlIHNob3VsZCBiZSBnZW5lcmF0ZWQ6XG4gICAgLy9cbiAgICAvLyAgICAgICAgLy0tLS0gPyAtLS0tXFxcbiAgICAvLyAgICAgICAvICAgICAgfCAgICAgIFxcXG4gICAgLy8gICAgIGEgICAvLS0tID8gLS0tXFwgIG51bGxcbiAgICAvLyAgICAgICAgLyAgICAgfCAgICAgXFxcbiAgICAvLyAgICAgICAuICAgICAgLiAgICAgbnVsbFxuICAgIC8vICAgICAgLyBcXCAgICAvIFxcXG4gICAgLy8gICAgIC4gIGMgICAuICAgZVxuICAgIC8vICAgIC8gXFwgICAgLyBcXFxuICAgIC8vICAgYSAgIGIgICwgICBkXG4gICAgLy8gICAgICAgICAvIFxcXG4gICAgLy8gICAgICAgIC4gICBjXG4gICAgLy8gICAgICAgLyBcXFxuICAgIC8vICAgICAgYSAgIGJcbiAgICAvL1xuICAgIC8vIE5vdGljZSB0aGF0IHRoZSBmaXJzdCBndWFyZCBjb25kaXRpb24gaXMgdGhlIGxlZnQgaGFuZCBvZiB0aGUgbGVmdCBtb3N0IHNhZmUgYWNjZXNzIG5vZGVcbiAgICAvLyB3aGljaCBjb21lcyBpbiBhcyBsZWZ0TW9zdFNhZmUgdG8gdGhpcyByb3V0aW5lLlxuXG4gICAgbGV0IGd1YXJkZWRFeHByZXNzaW9uID0gdGhpcy5fdmlzaXQobGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBsZXQgdGVtcG9yYXJ5OiBvLlJlYWRWYXJFeHByID0gdW5kZWZpbmVkICE7XG4gICAgaWYgKHRoaXMubmVlZHNUZW1wb3JhcnkobGVmdE1vc3RTYWZlLnJlY2VpdmVyKSkge1xuICAgICAgLy8gSWYgdGhlIGV4cHJlc3Npb24gaGFzIG1ldGhvZCBjYWxscyBvciBwaXBlcyB0aGVuIHdlIG5lZWQgdG8gc2F2ZSB0aGUgcmVzdWx0IGludG8gYVxuICAgICAgLy8gdGVtcG9yYXJ5IHZhcmlhYmxlIHRvIGF2b2lkIGNhbGxpbmcgc3RhdGVmdWwgb3IgaW1wdXJlIGNvZGUgbW9yZSB0aGFuIG9uY2UuXG4gICAgICB0ZW1wb3JhcnkgPSB0aGlzLmFsbG9jYXRlVGVtcG9yYXJ5KCk7XG5cbiAgICAgIC8vIFByZXNlcnZlIHRoZSByZXN1bHQgaW4gdGhlIHRlbXBvcmFyeSB2YXJpYWJsZVxuICAgICAgZ3VhcmRlZEV4cHJlc3Npb24gPSB0ZW1wb3Jhcnkuc2V0KGd1YXJkZWRFeHByZXNzaW9uKTtcblxuICAgICAgLy8gRW5zdXJlIGFsbCBmdXJ0aGVyIHJlZmVyZW5jZXMgdG8gdGhlIGd1YXJkZWQgZXhwcmVzc2lvbiByZWZlciB0byB0aGUgdGVtcG9yYXJ5IGluc3RlYWQuXG4gICAgICB0aGlzLl9yZXN1bHRNYXAuc2V0KGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgdGVtcG9yYXJ5KTtcbiAgICB9XG4gICAgY29uc3QgY29uZGl0aW9uID0gZ3VhcmRlZEV4cHJlc3Npb24uaXNCbGFuaygpO1xuXG4gICAgLy8gQ29udmVydCB0aGUgYXN0IHRvIGFuIHVuZ3VhcmRlZCBhY2Nlc3MgdG8gdGhlIHJlY2VpdmVyJ3MgbWVtYmVyLiBUaGUgbWFwIHdpbGwgc3Vic3RpdHV0ZVxuICAgIC8vIGxlZnRNb3N0Tm9kZSB3aXRoIGl0cyB1bmd1YXJkZWQgdmVyc2lvbiBpbiB0aGUgY2FsbCB0byBgdGhpcy52aXNpdCgpYC5cbiAgICBpZiAobGVmdE1vc3RTYWZlIGluc3RhbmNlb2YgY2RBc3QuU2FmZU1ldGhvZENhbGwpIHtcbiAgICAgIHRoaXMuX25vZGVNYXAuc2V0KFxuICAgICAgICAgIGxlZnRNb3N0U2FmZSxcbiAgICAgICAgICBuZXcgY2RBc3QuTWV0aG9kQ2FsbChcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLnNwYW4sIGxlZnRNb3N0U2FmZS5yZWNlaXZlciwgbGVmdE1vc3RTYWZlLm5hbWUsIGxlZnRNb3N0U2FmZS5hcmdzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX25vZGVNYXAuc2V0KFxuICAgICAgICAgIGxlZnRNb3N0U2FmZSxcbiAgICAgICAgICBuZXcgY2RBc3QuUHJvcGVydHlSZWFkKGxlZnRNb3N0U2FmZS5zcGFuLCBsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIGxlZnRNb3N0U2FmZS5uYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gUmVjdXJzaXZlbHkgY29udmVydCB0aGUgbm9kZSBub3cgd2l0aG91dCB0aGUgZ3VhcmRlZCBtZW1iZXIgYWNjZXNzLlxuICAgIGNvbnN0IGFjY2VzcyA9IHRoaXMuX3Zpc2l0KGFzdCwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgICAvLyBSZW1vdmUgdGhlIG1hcHBpbmcuIFRoaXMgaXMgbm90IHN0cmljdGx5IHJlcXVpcmVkIGFzIHRoZSBjb252ZXJ0ZXIgb25seSB0cmF2ZXJzZXMgZWFjaCBub2RlXG4gICAgLy8gb25jZSBidXQgaXMgc2FmZXIgaWYgdGhlIGNvbnZlcnNpb24gaXMgY2hhbmdlZCB0byB0cmF2ZXJzZSB0aGUgbm9kZXMgbW9yZSB0aGFuIG9uY2UuXG4gICAgdGhpcy5fbm9kZU1hcC5kZWxldGUobGVmdE1vc3RTYWZlKTtcblxuICAgIC8vIElmIHdlIGFsbG9jYXRlZCBhIHRlbXBvcmFyeSwgcmVsZWFzZSBpdC5cbiAgICBpZiAodGVtcG9yYXJ5KSB7XG4gICAgICB0aGlzLnJlbGVhc2VUZW1wb3JhcnkodGVtcG9yYXJ5KTtcbiAgICB9XG5cbiAgICAvLyBQcm9kdWNlIHRoZSBjb25kaXRpb25hbFxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCBjb25kaXRpb24uY29uZGl0aW9uYWwoby5saXRlcmFsKG51bGwpLCBhY2Nlc3MpKTtcbiAgfVxuXG4gIC8vIEdpdmVuIGEgZXhwcmVzc2lvbiBvZiB0aGUgZm9ybSBhPy5iLmM/LmQuZSB0aGUgdGhlIGxlZnQgbW9zdCBzYWZlIG5vZGUgaXNcbiAgLy8gdGhlIChhPy5iKS4gVGhlIC4gYW5kID8uIGFyZSBsZWZ0IGFzc29jaWF0aXZlIHRodXMgY2FuIGJlIHJld3JpdHRlbiBhczpcbiAgLy8gKCgoKGE/LmMpLmIpLmMpPy5kKS5lLiBUaGlzIHJldHVybnMgdGhlIG1vc3QgZGVlcGx5IG5lc3RlZCBzYWZlIHJlYWQgb3JcbiAgLy8gc2FmZSBtZXRob2QgY2FsbCBhcyB0aGlzIG5lZWRzIGJlIHRyYW5zZm9ybSBpbml0aWFsbHkgdG86XG4gIC8vICAgYSA9PSBudWxsID8gbnVsbCA6IGEuYy5iLmM/LmQuZVxuICAvLyB0aGVuIHRvOlxuICAvLyAgIGEgPT0gbnVsbCA/IG51bGwgOiBhLmIuYyA9PSBudWxsID8gbnVsbCA6IGEuYi5jLmQuZVxuICBwcml2YXRlIGxlZnRNb3N0U2FmZU5vZGUoYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkfGNkQXN0LlNhZmVNZXRob2RDYWxsIHtcbiAgICBjb25zdCB2aXNpdCA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVCk6IGFueSA9PiB7XG4gICAgICByZXR1cm4gKHRoaXMuX25vZGVNYXAuZ2V0KGFzdCkgfHwgYXN0KS52aXNpdCh2aXNpdG9yKTtcbiAgICB9O1xuICAgIHJldHVybiBhc3QudmlzaXQoe1xuICAgICAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnkpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4pIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdENvbmRpdGlvbmFsKGFzdDogY2RBc3QuQ29uZGl0aW9uYWwpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IGNkQXN0LkZ1bmN0aW9uQ2FsbCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IGNkQXN0LkltcGxpY2l0UmVjZWl2ZXIpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBjZEFzdC5JbnRlcnBvbGF0aW9uKSB7IHJldHVybiBudWxsOyB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHsgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5vYmopOyB9LFxuICAgICAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogY2RBc3QuTGl0ZXJhbEFycmF5KSB7IHJldHVybiBudWxsOyB9LFxuICAgICAgdmlzaXRMaXRlcmFsTWFwKGFzdDogY2RBc3QuTGl0ZXJhbE1hcCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdE1ldGhvZENhbGwoYXN0OiBjZEFzdC5NZXRob2RDYWxsKSB7IHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpOyB9LFxuICAgICAgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdFByZWZpeE5vdChhc3Q6IGNkQXN0LlByZWZpeE5vdCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IGNkQXN0Lk5vbk51bGxBc3NlcnQpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlByb3BlcnR5UmVhZCkgeyByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKTsgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdFF1b3RlKGFzdDogY2RBc3QuUXVvdGUpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogY2RBc3QuU2FmZU1ldGhvZENhbGwpIHsgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcikgfHwgYXN0OyB9LFxuICAgICAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogY2RBc3QuU2FmZVByb3BlcnR5UmVhZCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKSB8fCBhc3Q7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRydWUgb2YgdGhlIEFTVCBpbmNsdWRlcyBhIG1ldGhvZCBvciBhIHBpcGUgaW5kaWNhdGluZyB0aGF0LCBpZiB0aGVcbiAgLy8gZXhwcmVzc2lvbiBpcyB1c2VkIGFzIHRoZSB0YXJnZXQgb2YgYSBzYWZlIHByb3BlcnR5IG9yIG1ldGhvZCBhY2Nlc3MgdGhlblxuICAvLyB0aGUgZXhwcmVzc2lvbiBzaG91bGQgYmUgc3RvcmVkIGludG8gYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gIHByaXZhdGUgbmVlZHNUZW1wb3JhcnkoYXN0OiBjZEFzdC5BU1QpOiBib29sZWFuIHtcbiAgICBjb25zdCB2aXNpdCA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVCk6IGJvb2xlYW4gPT4ge1xuICAgICAgcmV0dXJuIGFzdCAmJiAodGhpcy5fbm9kZU1hcC5nZXQoYXN0KSB8fCBhc3QpLnZpc2l0KHZpc2l0b3IpO1xuICAgIH07XG4gICAgY29uc3QgdmlzaXRTb21lID0gKHZpc2l0b3I6IGNkQXN0LkFzdFZpc2l0b3IsIGFzdDogY2RBc3QuQVNUW10pOiBib29sZWFuID0+IHtcbiAgICAgIHJldHVybiBhc3Quc29tZShhc3QgPT4gdmlzaXQodmlzaXRvciwgYXN0KSk7XG4gICAgfTtcbiAgICByZXR1cm4gYXN0LnZpc2l0KHtcbiAgICAgIHZpc2l0QmluYXJ5KGFzdDogY2RBc3QuQmluYXJ5KTpcbiAgICAgICAgICBib29sZWFue3JldHVybiB2aXNpdCh0aGlzLCBhc3QubGVmdCkgfHwgdmlzaXQodGhpcywgYXN0LnJpZ2h0KTt9LFxuICAgICAgdmlzaXRDaGFpbihhc3Q6IGNkQXN0LkNoYWluKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBjZEFzdC5Db25kaXRpb25hbCk6XG4gICAgICAgICAgYm9vbGVhbntyZXR1cm4gdmlzaXQodGhpcywgYXN0LmNvbmRpdGlvbikgfHwgdmlzaXQodGhpcywgYXN0LnRydWVFeHApIHx8XG4gICAgICAgICAgICAgICAgICAgICAgdmlzaXQodGhpcywgYXN0LmZhbHNlRXhwKTt9LFxuICAgICAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBjZEFzdC5GdW5jdGlvbkNhbGwpIHsgcmV0dXJuIHRydWU7IH0sXG4gICAgICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24pIHsgcmV0dXJuIHZpc2l0U29tZSh0aGlzLCBhc3QuZXhwcmVzc2lvbnMpOyB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSkgeyByZXR1cm4gZmFsc2U7IH0sXG4gICAgICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IGNkQXN0LkxpdGVyYWxNYXApIHsgcmV0dXJuIHRydWU7IH0sXG4gICAgICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBjZEFzdC5MaXRlcmFsUHJpbWl0aXZlKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IGNkQXN0Lk1ldGhvZENhbGwpIHsgcmV0dXJuIHRydWU7IH0sXG4gICAgICB2aXNpdFBpcGUoYXN0OiBjZEFzdC5CaW5kaW5nUGlwZSkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90KSB7IHJldHVybiB2aXNpdCh0aGlzLCBhc3QuZXhwcmVzc2lvbik7IH0sXG4gICAgICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBjZEFzdC5QcmVmaXhOb3QpIHsgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5leHByZXNzaW9uKTsgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogY2RBc3QuUHJvcGVydHlSZWFkKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUpIHsgcmV0dXJuIGZhbHNlOyB9LFxuICAgICAgdmlzaXRRdW90ZShhc3Q6IGNkQXN0LlF1b3RlKSB7IHJldHVybiBmYWxzZTsgfSxcbiAgICAgIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBjZEFzdC5TYWZlTWV0aG9kQ2FsbCkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWQpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlVGVtcG9yYXJ5KCk6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IHRlbXBOdW1iZXIgPSB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5Kys7XG4gICAgdGhpcy50ZW1wb3JhcnlDb3VudCA9IE1hdGgubWF4KHRoaXMuX2N1cnJlbnRUZW1wb3JhcnksIHRoaXMudGVtcG9yYXJ5Q291bnQpO1xuICAgIHJldHVybiBuZXcgby5SZWFkVmFyRXhwcih0ZW1wb3JhcnlOYW1lKHRoaXMuYmluZGluZ0lkLCB0ZW1wTnVtYmVyKSk7XG4gIH1cblxuICBwcml2YXRlIHJlbGVhc2VUZW1wb3JhcnkodGVtcG9yYXJ5OiBvLlJlYWRWYXJFeHByKSB7XG4gICAgdGhpcy5fY3VycmVudFRlbXBvcmFyeS0tO1xuICAgIGlmICh0ZW1wb3JhcnkubmFtZSAhPSB0ZW1wb3JhcnlOYW1lKHRoaXMuYmluZGluZ0lkLCB0aGlzLl9jdXJyZW50VGVtcG9yYXJ5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUZW1wb3JhcnkgJHt0ZW1wb3JhcnkubmFtZX0gcmVsZWFzZWQgb3V0IG9mIG9yZGVyYCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYWJzb2x1dGUgYFBhcnNlU291cmNlU3BhbmAgZnJvbSB0aGUgcmVsYXRpdmUgYFBhcnNlU3BhbmAuXG4gICAqXG4gICAqIGBQYXJzZVNwYW5gIG9iamVjdHMgYXJlIHJlbGF0aXZlIHRvIHRoZSBzdGFydCBvZiB0aGUgZXhwcmVzc2lvbi5cbiAgICogVGhpcyBtZXRob2QgY29udmVydHMgdGhlc2UgdG8gZnVsbCBgUGFyc2VTb3VyY2VTcGFuYCBvYmplY3RzIHRoYXRcbiAgICogc2hvdyB3aGVyZSB0aGUgc3BhbiBpcyB3aXRoaW4gdGhlIG92ZXJhbGwgc291cmNlIGZpbGUuXG4gICAqXG4gICAqIEBwYXJhbSBzcGFuIHRoZSByZWxhdGl2ZSBzcGFuIHRvIGNvbnZlcnQuXG4gICAqIEByZXR1cm5zIGEgYFBhcnNlU291cmNlU3BhbmAgZm9yIHRoZSB0aGUgZ2l2ZW4gc3BhbiBvciBudWxsIGlmIG5vXG4gICAqIGBiYXNlU291cmNlU3BhbmAgd2FzIHByb3ZpZGVkIHRvIHRoaXMgY2xhc3MuXG4gICAqL1xuICBwcml2YXRlIGNvbnZlcnRTb3VyY2VTcGFuKHNwYW46IGNkQXN0LlBhcnNlU3Bhbikge1xuICAgIGlmICh0aGlzLmJhc2VTb3VyY2VTcGFuKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICAgICAgY29uc3QgZW5kID0gdGhpcy5iYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5lbmQpO1xuICAgICAgcmV0dXJuIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmbGF0dGVuU3RhdGVtZW50cyhhcmc6IGFueSwgb3V0cHV0OiBvLlN0YXRlbWVudFtdKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAoPGFueVtdPmFyZykuZm9yRWFjaCgoZW50cnkpID0+IGZsYXR0ZW5TdGF0ZW1lbnRzKGVudHJ5LCBvdXRwdXQpKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQucHVzaChhcmcpO1xuICB9XG59XG5cbmNsYXNzIERlZmF1bHRMb2NhbFJlc29sdmVyIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBpZiAobmFtZSA9PT0gRXZlbnRIYW5kbGVyVmFycy5ldmVudC5uYW1lKSB7XG4gICAgICByZXR1cm4gRXZlbnRIYW5kbGVyVmFycy5ldmVudDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQ3VyclZhbHVlRXhwcihiaW5kaW5nSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICByZXR1cm4gby52YXJpYWJsZShgY3VyclZhbF8ke2JpbmRpbmdJZH1gKTsgIC8vIGZpeCBzeW50YXggaGlnaGxpZ2h0aW5nOiBgXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVByZXZlbnREZWZhdWx0VmFyKGJpbmRpbmdJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gIHJldHVybiBvLnZhcmlhYmxlKGBwZF8ke2JpbmRpbmdJZH1gKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFN0bXRJbnRvRXhwcmVzc2lvbihzdG10OiBvLlN0YXRlbWVudCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQpIHtcbiAgICByZXR1cm4gc3RtdC5leHByO1xuICB9IGVsc2UgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLlJldHVyblN0YXRlbWVudCkge1xuICAgIHJldHVybiBzdG10LnZhbHVlO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgQnVpbHRpbkZ1bmN0aW9uQ2FsbCBleHRlbmRzIGNkQXN0LkZ1bmN0aW9uQ2FsbCB7XG4gIGNvbnN0cnVjdG9yKHNwYW46IGNkQXN0LlBhcnNlU3BhbiwgcHVibGljIGFyZ3M6IGNkQXN0LkFTVFtdLCBwdWJsaWMgY29udmVydGVyOiBCdWlsdGluQ29udmVydGVyKSB7XG4gICAgc3VwZXIoc3BhbiwgbnVsbCwgYXJncyk7XG4gIH1cbn1cbiJdfQ==