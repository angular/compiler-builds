/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as cdAst from '../expression_parser/ast';
import * as o from '../output/output_ast';
import { ParseSourceSpan } from '../parse_util';
export class EventHandlerVars {
    static { this.event = o.variable('$event'); }
}
/**
 * Converts the given expression AST into an executable output AST, assuming the expression is
 * used in an action binding (e.g. an event handler).
 */
export function convertActionBinding(localResolver, implicitReceiver, action, bindingId, baseSourceSpan, implicitReceiverAccesses, globals) {
    if (!localResolver) {
        localResolver = new DefaultLocalResolver(globals);
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
    const visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, /* supportsInterpolation */ false, baseSourceSpan, implicitReceiverAccesses);
    const actionStmts = [];
    flattenStatements(actionWithoutBuiltins.visit(visitor, _Mode.Statement), actionStmts);
    prependTemporaryDecls(visitor.temporaryCount, bindingId, actionStmts);
    if (visitor.usesImplicitReceiver) {
        localResolver.notifyImplicitReceiverUse();
    }
    const lastIndex = actionStmts.length - 1;
    if (lastIndex >= 0) {
        const lastStatement = actionStmts[lastIndex];
        // Ensure that the value of the last expression statement is returned
        if (lastStatement instanceof o.ExpressionStatement) {
            actionStmts[lastIndex] = new o.ReturnStatement(lastStatement.expr);
        }
    }
    return actionStmts;
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
/**
 * Converts the given expression AST into an executable output AST, assuming the expression
 * is used in property binding. The expression has to be preprocessed via
 * `convertPropertyBindingBuiltins`.
 */
export function convertPropertyBinding(localResolver, implicitReceiver, expressionWithoutBuiltins, bindingId) {
    if (!localResolver) {
        localResolver = new DefaultLocalResolver();
    }
    const visitor = new _AstToIrVisitor(localResolver, implicitReceiver, bindingId, /* supportsInterpolation */ false);
    const outputExpr = expressionWithoutBuiltins.visit(visitor, _Mode.Expression);
    const stmts = getStatementsFromVisitor(visitor, bindingId);
    if (visitor.usesImplicitReceiver) {
        localResolver.notifyImplicitReceiverUse();
    }
    return new ConvertPropertyBindingResult(stmts, outputExpr);
}
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
export function convertUpdateArguments(localResolver, contextVariableExpression, expressionWithArgumentsToExtract, bindingId) {
    const visitor = new _AstToIrVisitor(localResolver, contextVariableExpression, bindingId, /* supportsInterpolation */ true);
    const outputExpr = visitor.visitInterpolation(expressionWithArgumentsToExtract, _Mode.Expression);
    if (visitor.usesImplicitReceiver) {
        localResolver.notifyImplicitReceiverUse();
    }
    const stmts = getStatementsFromVisitor(visitor, bindingId);
    const args = outputExpr.args;
    return { stmts, args };
}
function getStatementsFromVisitor(visitor, bindingId) {
    const stmts = [];
    for (let i = 0; i < visitor.temporaryCount; i++) {
        stmts.push(temporaryDeclaration(bindingId, i));
    }
    return stmts;
}
function convertBuiltins(converterFactory, ast) {
    const visitor = new _BuiltinAstConverter(converterFactory);
    return ast.visit(visitor);
}
function temporaryName(bindingId, temporaryNumber) {
    return `tmp_${bindingId}_${temporaryNumber}`;
}
function temporaryDeclaration(bindingId, temporaryNumber) {
    return new o.DeclareVarStmt(temporaryName(bindingId, temporaryNumber));
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
        return new BuiltinFunctionCall(ast.span, ast.sourceSpan, args, this._converterFactory.createPipeConverter(ast.name, args.length));
    }
    visitLiteralArray(ast, context) {
        const args = ast.expressions.map(ast => ast.visit(this, context));
        return new BuiltinFunctionCall(ast.span, ast.sourceSpan, args, this._converterFactory.createLiteralArrayConverter(ast.expressions.length));
    }
    visitLiteralMap(ast, context) {
        const args = ast.values.map(ast => ast.visit(this, context));
        return new BuiltinFunctionCall(ast.span, ast.sourceSpan, args, this._converterFactory.createLiteralMapConverter(ast.keys));
    }
}
class _AstToIrVisitor {
    constructor(_localResolver, _implicitReceiver, bindingId, supportsInterpolation, baseSourceSpan, implicitReceiverAccesses) {
        this._localResolver = _localResolver;
        this._implicitReceiver = _implicitReceiver;
        this.bindingId = bindingId;
        this.supportsInterpolation = supportsInterpolation;
        this.baseSourceSpan = baseSourceSpan;
        this.implicitReceiverAccesses = implicitReceiverAccesses;
        this._nodeMap = new Map();
        this._resultMap = new Map();
        this._currentTemporary = 0;
        this.temporaryCount = 0;
        this.usesImplicitReceiver = false;
    }
    visitUnary(ast, mode) {
        let op;
        switch (ast.operator) {
            case '+':
                op = o.UnaryOperator.Plus;
                break;
            case '-':
                op = o.UnaryOperator.Minus;
                break;
            default:
                throw new Error(`Unsupported operator ${ast.operator}`);
        }
        return convertToStatementIfNeeded(mode, new o.UnaryOperatorExpr(op, this._visit(ast.expr, _Mode.Expression), undefined, this.convertSourceSpan(ast.span)));
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
            case '??':
                return this.convertNullishCoalesce(ast, mode);
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
    visitImplicitReceiver(ast, mode) {
        ensureExpressionMode(mode, ast);
        this.usesImplicitReceiver = true;
        return this._implicitReceiver;
    }
    visitThisReceiver(ast, mode) {
        return this.visitImplicitReceiver(ast, mode);
    }
    visitInterpolation(ast, mode) {
        if (!this.supportsInterpolation) {
            throw new Error('Unexpected interpolation');
        }
        ensureExpressionMode(mode, ast);
        let args = [];
        for (let i = 0; i < ast.strings.length - 1; i++) {
            args.push(o.literal(ast.strings[i]));
            args.push(this._visit(ast.expressions[i], _Mode.Expression));
        }
        args.push(o.literal(ast.strings[ast.strings.length - 1]));
        // If we're dealing with an interpolation of 1 value with an empty prefix and suffix, reduce the
        // args returned to just the value, because we're going to pass it to a special instruction.
        const strings = ast.strings;
        if (strings.length === 2 && strings[0] === '' && strings[1] === '') {
            // Single argument interpolate instructions.
            args = [args[1]];
        }
        else if (ast.expressions.length >= 9) {
            // 9 or more arguments must be passed to the `interpolateV`-style instructions, which accept
            // an array of arguments
            args = [o.literalArr(args)];
        }
        return new InterpolationExpression(args);
    }
    visitKeyedRead(ast, mode) {
        const leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            return convertToStatementIfNeeded(mode, this._visit(ast.receiver, _Mode.Expression).key(this._visit(ast.key, _Mode.Expression)));
        }
    }
    visitKeyedWrite(ast, mode) {
        const obj = this._visit(ast.receiver, _Mode.Expression);
        const key = this._visit(ast.key, _Mode.Expression);
        const value = this._visit(ast.value, _Mode.Expression);
        if (obj === this._implicitReceiver) {
            this._localResolver.maybeRestoreView();
        }
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
    _getLocal(name, receiver) {
        if (this._localResolver.globals?.has(name) && receiver instanceof cdAst.ThisReceiver) {
            return null;
        }
        return this._localResolver.getLocal(name);
    }
    visitPrefixNot(ast, mode) {
        return convertToStatementIfNeeded(mode, o.not(this._visit(ast.expression, _Mode.Expression)));
    }
    visitNonNullAssert(ast, mode) {
        return convertToStatementIfNeeded(mode, this._visit(ast.expression, _Mode.Expression));
    }
    visitPropertyRead(ast, mode) {
        const leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        else {
            let result = null;
            const prevUsesImplicitReceiver = this.usesImplicitReceiver;
            const receiver = this._visit(ast.receiver, _Mode.Expression);
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
    }
    visitPropertyWrite(ast, mode) {
        const receiver = this._visit(ast.receiver, _Mode.Expression);
        const prevUsesImplicitReceiver = this.usesImplicitReceiver;
        let varExpr = null;
        if (receiver === this._implicitReceiver) {
            const localExpr = this._getLocal(ast.name, ast.receiver);
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
                    const receiver = ast.name;
                    const value = (ast.value instanceof cdAst.PropertyRead) ? ast.value.name : undefined;
                    throw new Error(`Cannot assign value "${value}" to template variable "${receiver}". Template variables are read-only.`);
                }
            }
        }
        // If no local expression could be produced, use the original receiver's
        // property as the target.
        if (varExpr === null) {
            varExpr = receiver.prop(ast.name, this.convertSourceSpan(ast.span));
        }
        return convertToStatementIfNeeded(mode, varExpr.set(this._visit(ast.value, _Mode.Expression)));
    }
    visitSafePropertyRead(ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
    }
    visitSafeKeyedRead(ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
    }
    visitAll(asts, mode) {
        return asts.map(ast => this._visit(ast, mode));
    }
    visitCall(ast, mode) {
        const leftMostSafe = this.leftMostSafeNode(ast);
        if (leftMostSafe) {
            return this.convertSafeAccess(ast, leftMostSafe, mode);
        }
        const convertedArgs = this.visitAll(ast.args, _Mode.Expression);
        if (ast instanceof BuiltinFunctionCall) {
            return convertToStatementIfNeeded(mode, ast.converter(convertedArgs));
        }
        const receiver = ast.receiver;
        if (receiver instanceof cdAst.PropertyRead &&
            receiver.receiver instanceof cdAst.ImplicitReceiver &&
            !(receiver.receiver instanceof cdAst.ThisReceiver) && receiver.name === '$any') {
            if (convertedArgs.length !== 1) {
                throw new Error(`Invalid call to $any, expected 1 argument but received ${convertedArgs.length || 'none'}`);
            }
            return convertToStatementIfNeeded(mode, convertedArgs[0]);
        }
        const call = this._visit(receiver, _Mode.Expression)
            .callFn(convertedArgs, this.convertSourceSpan(ast.span));
        return convertToStatementIfNeeded(mode, call);
    }
    visitSafeCall(ast, mode) {
        return this.convertSafeAccess(ast, this.leftMostSafeNode(ast), mode);
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
        let guardedExpression = this._visit(leftMostSafe.receiver, _Mode.Expression);
        let temporary = undefined;
        if (this.needsTemporaryInSafeAccess(leftMostSafe.receiver)) {
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
        if (leftMostSafe instanceof cdAst.SafeCall) {
            this._nodeMap.set(leftMostSafe, new cdAst.Call(leftMostSafe.span, leftMostSafe.sourceSpan, leftMostSafe.receiver, leftMostSafe.args, leftMostSafe.argumentSpan));
        }
        else if (leftMostSafe instanceof cdAst.SafeKeyedRead) {
            this._nodeMap.set(leftMostSafe, new cdAst.KeyedRead(leftMostSafe.span, leftMostSafe.sourceSpan, leftMostSafe.receiver, leftMostSafe.key));
        }
        else {
            this._nodeMap.set(leftMostSafe, new cdAst.PropertyRead(leftMostSafe.span, leftMostSafe.sourceSpan, leftMostSafe.nameSpan, leftMostSafe.receiver, leftMostSafe.name));
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
        return convertToStatementIfNeeded(mode, condition.conditional(o.NULL_EXPR, access));
    }
    convertNullishCoalesce(ast, mode) {
        const left = this._visit(ast.left, _Mode.Expression);
        const right = this._visit(ast.right, _Mode.Expression);
        const temporary = this.allocateTemporary();
        this.releaseTemporary(temporary);
        // Generate the following expression. It is identical to how TS
        // transpiles binary expressions with a nullish coalescing operator.
        // let temp;
        // (temp = a) !== null && temp !== undefined ? temp : b;
        return convertToStatementIfNeeded(mode, temporary.set(left)
            .notIdentical(o.NULL_EXPR)
            .and(temporary.notIdentical(o.literal(undefined)))
            .conditional(temporary, right));
    }
    // Given an expression of the form a?.b.c?.d.e then the left most safe node is
    // the (a?.b). The . and ?. are left associative thus can be rewritten as:
    // ((((a?.c).b).c)?.d).e. This returns the most deeply nested safe read or
    // safe method call as this needs to be transformed initially to:
    //   a == null ? null : a.c.b.c?.d.e
    // then to:
    //   a == null ? null : a.b.c == null ? null : a.b.c.d.e
    leftMostSafeNode(ast) {
        const visit = (visitor, ast) => {
            return (this._nodeMap.get(ast) || ast).visit(visitor);
        };
        return ast.visit({
            visitUnary(ast) {
                return null;
            },
            visitBinary(ast) {
                return null;
            },
            visitChain(ast) {
                return null;
            },
            visitConditional(ast) {
                return null;
            },
            visitCall(ast) {
                return visit(this, ast.receiver);
            },
            visitSafeCall(ast) {
                return visit(this, ast.receiver) || ast;
            },
            visitImplicitReceiver(ast) {
                return null;
            },
            visitThisReceiver(ast) {
                return null;
            },
            visitInterpolation(ast) {
                return null;
            },
            visitKeyedRead(ast) {
                return visit(this, ast.receiver);
            },
            visitKeyedWrite(ast) {
                return null;
            },
            visitLiteralArray(ast) {
                return null;
            },
            visitLiteralMap(ast) {
                return null;
            },
            visitLiteralPrimitive(ast) {
                return null;
            },
            visitPipe(ast) {
                return null;
            },
            visitPrefixNot(ast) {
                return null;
            },
            visitNonNullAssert(ast) {
                return visit(this, ast.expression);
            },
            visitPropertyRead(ast) {
                return visit(this, ast.receiver);
            },
            visitPropertyWrite(ast) {
                return null;
            },
            visitSafePropertyRead(ast) {
                return visit(this, ast.receiver) || ast;
            },
            visitSafeKeyedRead(ast) {
                return visit(this, ast.receiver) || ast;
            }
        });
    }
    // Returns true of the AST includes a method or a pipe indicating that, if the
    // expression is used as the target of a safe property or method access then
    // the expression should be stored into a temporary variable.
    needsTemporaryInSafeAccess(ast) {
        const visit = (visitor, ast) => {
            return ast && (this._nodeMap.get(ast) || ast).visit(visitor);
        };
        const visitSome = (visitor, ast) => {
            return ast.some(ast => visit(visitor, ast));
        };
        return ast.visit({
            visitUnary(ast) {
                return visit(this, ast.expr);
            },
            visitBinary(ast) {
                return visit(this, ast.left) || visit(this, ast.right);
            },
            visitChain(ast) {
                return false;
            },
            visitConditional(ast) {
                return visit(this, ast.condition) || visit(this, ast.trueExp) || visit(this, ast.falseExp);
            },
            visitCall(ast) {
                return true;
            },
            visitSafeCall(ast) {
                return true;
            },
            visitImplicitReceiver(ast) {
                return false;
            },
            visitThisReceiver(ast) {
                return false;
            },
            visitInterpolation(ast) {
                return visitSome(this, ast.expressions);
            },
            visitKeyedRead(ast) {
                return false;
            },
            visitKeyedWrite(ast) {
                return false;
            },
            visitLiteralArray(ast) {
                return true;
            },
            visitLiteralMap(ast) {
                return true;
            },
            visitLiteralPrimitive(ast) {
                return false;
            },
            visitPipe(ast) {
                return true;
            },
            visitPrefixNot(ast) {
                return visit(this, ast.expression);
            },
            visitNonNullAssert(ast) {
                return visit(this, ast.expression);
            },
            visitPropertyRead(ast) {
                return false;
            },
            visitPropertyWrite(ast) {
                return false;
            },
            visitSafePropertyRead(ast) {
                return false;
            },
            visitSafeKeyedRead(ast) {
                return false;
            }
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
     * @returns a `ParseSourceSpan` for the given span or null if no
     * `baseSourceSpan` was provided to this class.
     */
    convertSourceSpan(span) {
        if (this.baseSourceSpan) {
            const start = this.baseSourceSpan.start.moveBy(span.start);
            const end = this.baseSourceSpan.start.moveBy(span.end);
            const fullStart = this.baseSourceSpan.fullStart.moveBy(span.start);
            return new ParseSourceSpan(start, end, fullStart);
        }
        else {
            return null;
        }
    }
    /** Adds the name of an AST to the list of implicit receiver accesses. */
    addImplicitReceiverAccess(name) {
        if (this.implicitReceiverAccesses) {
            this.implicitReceiverAccesses.add(name);
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
function unsupported() {
    throw new Error('Unsupported operation');
}
class InterpolationExpression extends o.Expression {
    constructor(args) {
        super(null, null);
        this.args = args;
        this.isConstant = unsupported;
        this.isEquivalent = unsupported;
        this.visitExpression = unsupported;
    }
}
class DefaultLocalResolver {
    constructor(globals) {
        this.globals = globals;
    }
    notifyImplicitReceiverUse() { }
    maybeRestoreView() { }
    getLocal(name) {
        if (name === EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        return null;
    }
}
export class BuiltinFunctionCall extends cdAst.Call {
    constructor(span, sourceSpan, args, converter) {
        super(span, sourceSpan, new cdAst.EmptyExpr(span, sourceSpan), args, null);
        this.converter = converter;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbl9jb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLDBCQUEwQixDQUFDO0FBQ2xELE9BQU8sS0FBSyxDQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDMUMsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUU5QyxNQUFNLE9BQU8sZ0JBQWdCO2FBQ3BCLFVBQUssR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDOztBQVV0Qzs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQ2hDLGFBQWlDLEVBQUUsZ0JBQThCLEVBQUUsTUFBaUIsRUFDcEYsU0FBaUIsRUFBRSxjQUFnQyxFQUFFLHdCQUFzQyxFQUMzRixPQUFxQjtJQUN2QixJQUFJLENBQUMsYUFBYSxFQUFFO1FBQ2xCLGFBQWEsR0FBRyxJQUFJLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQ25EO0lBQ0QsTUFBTSxxQkFBcUIsR0FBRyw4QkFBOEIsQ0FDeEQ7UUFDRSwyQkFBMkIsRUFBRSxDQUFDLFFBQWdCLEVBQUUsRUFBRTtZQUNoRCxrREFBa0Q7WUFDbEQsT0FBTyxDQUFDLElBQW9CLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsQ0FBQztRQUNELHlCQUF5QixFQUFFLENBQUMsSUFBc0MsRUFBRSxFQUFFO1lBQ3BFLGdEQUFnRDtZQUNoRCxPQUFPLENBQUMsTUFBc0IsRUFBRSxFQUFFO2dCQUNoQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFB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Q29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNkQXN0IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuZXhwb3J0IGNsYXNzIEV2ZW50SGFuZGxlclZhcnMge1xuICBzdGF0aWMgZXZlbnQgPSBvLnZhcmlhYmxlKCckZXZlbnQnKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMb2NhbFJlc29sdmVyIHtcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGw7XG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZDtcbiAgZ2xvYmFscz86IFNldDxzdHJpbmc+O1xuICBtYXliZVJlc3RvcmVWaWV3KCk6IHZvaWQ7XG59XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIGV4cHJlc3Npb24gQVNUIGludG8gYW4gZXhlY3V0YWJsZSBvdXRwdXQgQVNULCBhc3N1bWluZyB0aGUgZXhwcmVzc2lvbiBpc1xuICogdXNlZCBpbiBhbiBhY3Rpb24gYmluZGluZyAoZS5nLiBhbiBldmVudCBoYW5kbGVyKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXJ8bnVsbCwgaW1wbGljaXRSZWNlaXZlcjogby5FeHByZXNzaW9uLCBhY3Rpb246IGNkQXN0LkFTVCxcbiAgICBiaW5kaW5nSWQ6IHN0cmluZywgYmFzZVNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4sIGltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcz86IFNldDxzdHJpbmc+LFxuICAgIGdsb2JhbHM/OiBTZXQ8c3RyaW5nPik6IG8uU3RhdGVtZW50W10ge1xuICBpZiAoIWxvY2FsUmVzb2x2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyID0gbmV3IERlZmF1bHRMb2NhbFJlc29sdmVyKGdsb2JhbHMpO1xuICB9XG4gIGNvbnN0IGFjdGlvbldpdGhvdXRCdWlsdGlucyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmdCdWlsdGlucyhcbiAgICAgIHtcbiAgICAgICAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyOiAoYXJnQ291bnQ6IG51bWJlcikgPT4ge1xuICAgICAgICAgIC8vIE5vdGU6IG5vIGNhY2hpbmcgZm9yIGxpdGVyYWwgYXJyYXlzIGluIGFjdGlvbnMuXG4gICAgICAgICAgcmV0dXJuIChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4gby5saXRlcmFsQXJyKGFyZ3MpO1xuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyOiAoa2V5czoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW59W10pID0+IHtcbiAgICAgICAgICAvLyBOb3RlOiBubyBjYWNoaW5nIGZvciBsaXRlcmFsIG1hcHMgaW4gYWN0aW9ucy5cbiAgICAgICAgICByZXR1cm4gKHZhbHVlczogby5FeHByZXNzaW9uW10pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSBrZXlzLm1hcCgoaywgaSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleTogay5rZXksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVzW2ldLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcXVvdGVkOiBrLnF1b3RlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICByZXR1cm4gby5saXRlcmFsTWFwKGVudHJpZXMpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZVBpcGVDb252ZXJ0ZXI6IChuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IEFjdGlvbnMgYXJlIG5vdCBhbGxvd2VkIHRvIGNvbnRhaW4gcGlwZXMuIFBpcGU6ICR7bmFtZX1gKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGFjdGlvbik7XG5cbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfQXN0VG9JclZpc2l0b3IoXG4gICAgICBsb2NhbFJlc29sdmVyLCBpbXBsaWNpdFJlY2VpdmVyLCBiaW5kaW5nSWQsIC8qIHN1cHBvcnRzSW50ZXJwb2xhdGlvbiAqLyBmYWxzZSwgYmFzZVNvdXJjZVNwYW4sXG4gICAgICBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMpO1xuICBjb25zdCBhY3Rpb25TdG10czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBmbGF0dGVuU3RhdGVtZW50cyhhY3Rpb25XaXRob3V0QnVpbHRpbnMudmlzaXQodmlzaXRvciwgX01vZGUuU3RhdGVtZW50KSwgYWN0aW9uU3RtdHMpO1xuICBwcmVwZW5kVGVtcG9yYXJ5RGVjbHModmlzaXRvci50ZW1wb3JhcnlDb3VudCwgYmluZGluZ0lkLCBhY3Rpb25TdG10cyk7XG5cbiAgaWYgKHZpc2l0b3IudXNlc0ltcGxpY2l0UmVjZWl2ZXIpIHtcbiAgICBsb2NhbFJlc29sdmVyLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTtcbiAgfVxuXG4gIGNvbnN0IGxhc3RJbmRleCA9IGFjdGlvblN0bXRzLmxlbmd0aCAtIDE7XG4gIGlmIChsYXN0SW5kZXggPj0gMCkge1xuICAgIGNvbnN0IGxhc3RTdGF0ZW1lbnQgPSBhY3Rpb25TdG10c1tsYXN0SW5kZXhdO1xuICAgIC8vIEVuc3VyZSB0aGF0IHRoZSB2YWx1ZSBvZiB0aGUgbGFzdCBleHByZXNzaW9uIHN0YXRlbWVudCBpcyByZXR1cm5lZFxuICAgIGlmIChsYXN0U3RhdGVtZW50IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgICBhY3Rpb25TdG10c1tsYXN0SW5kZXhdID0gbmV3IG8uUmV0dXJuU3RhdGVtZW50KGxhc3RTdGF0ZW1lbnQuZXhwcik7XG4gICAgfVxuICB9XG4gIHJldHVybiBhY3Rpb25TdG10cztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsdGluQ29udmVydGVyIHtcbiAgKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5IHtcbiAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyKGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xuICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKGtleXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFufVtdKTogQnVpbHRpbkNvbnZlcnRlcjtcbiAgY3JlYXRlUGlwZUNvbnZlcnRlcihuYW1lOiBzdHJpbmcsIGFyZ0NvdW50OiBudW1iZXIpOiBCdWlsdGluQ29udmVydGVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zKFxuICAgIGNvbnZlcnRlckZhY3Rvcnk6IEJ1aWx0aW5Db252ZXJ0ZXJGYWN0b3J5LCBhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LkFTVCB7XG4gIHJldHVybiBjb252ZXJ0QnVpbHRpbnMoY29udmVydGVyRmFjdG9yeSwgYXN0KTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbnZlcnRQcm9wZXJ0eUJpbmRpbmdSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RtdHM6IG8uU3RhdGVtZW50W10sIHB1YmxpYyBjdXJyVmFsRXhwcjogby5FeHByZXNzaW9uKSB7fVxufVxuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBnaXZlbiBleHByZXNzaW9uIEFTVCBpbnRvIGFuIGV4ZWN1dGFibGUgb3V0cHV0IEFTVCwgYXNzdW1pbmcgdGhlIGV4cHJlc3Npb25cbiAqIGlzIHVzZWQgaW4gcHJvcGVydHkgYmluZGluZy4gVGhlIGV4cHJlc3Npb24gaGFzIHRvIGJlIHByZXByb2Nlc3NlZCB2aWFcbiAqIGBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnNgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICBsb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyfG51bGwsIGltcGxpY2l0UmVjZWl2ZXI6IG8uRXhwcmVzc2lvbixcbiAgICBleHByZXNzaW9uV2l0aG91dEJ1aWx0aW5zOiBjZEFzdC5BU1QsIGJpbmRpbmdJZDogc3RyaW5nKTogQ29udmVydFByb3BlcnR5QmluZGluZ1Jlc3VsdCB7XG4gIGlmICghbG9jYWxSZXNvbHZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIgPSBuZXcgRGVmYXVsdExvY2FsUmVzb2x2ZXIoKTtcbiAgfVxuICBjb25zdCB2aXNpdG9yID0gbmV3IF9Bc3RUb0lyVmlzaXRvcihcbiAgICAgIGxvY2FsUmVzb2x2ZXIsIGltcGxpY2l0UmVjZWl2ZXIsIGJpbmRpbmdJZCwgLyogc3VwcG9ydHNJbnRlcnBvbGF0aW9uICovIGZhbHNlKTtcbiAgY29uc3Qgb3V0cHV0RXhwcjogby5FeHByZXNzaW9uID0gZXhwcmVzc2lvbldpdGhvdXRCdWlsdGlucy52aXNpdCh2aXNpdG9yLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgY29uc3Qgc3RtdHM6IG8uU3RhdGVtZW50W10gPSBnZXRTdGF0ZW1lbnRzRnJvbVZpc2l0b3IodmlzaXRvciwgYmluZGluZ0lkKTtcblxuICBpZiAodmlzaXRvci51c2VzSW1wbGljaXRSZWNlaXZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIubm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBDb252ZXJ0UHJvcGVydHlCaW5kaW5nUmVzdWx0KHN0bXRzLCBvdXRwdXRFeHByKTtcbn1cblxuLyoqXG4gKiBHaXZlbiBzb21lIGV4cHJlc3Npb24sIHN1Y2ggYXMgYSBiaW5kaW5nIG9yIGludGVycG9sYXRpb24gZXhwcmVzc2lvbiwgYW5kIGEgY29udGV4dCBleHByZXNzaW9uIHRvXG4gKiBsb29rIHZhbHVlcyB1cCBvbiwgdmlzaXQgZWFjaCBmYWNldCBvZiB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiByZXNvbHZpbmcgdmFsdWVzIGZyb20gdGhlIGNvbnRleHRcbiAqIGV4cHJlc3Npb24gc3VjaCB0aGF0IGEgbGlzdCBvZiBhcmd1bWVudHMgY2FuIGJlIGRlcml2ZWQgZnJvbSB0aGUgZm91bmQgdmFsdWVzIHRoYXQgY2FuIGJlIHVzZWQgYXNcbiAqIGFyZ3VtZW50cyB0byBhbiBleHRlcm5hbCB1cGRhdGUgaW5zdHJ1Y3Rpb24uXG4gKlxuICogQHBhcmFtIGxvY2FsUmVzb2x2ZXIgVGhlIHJlc29sdmVyIHRvIHVzZSB0byBsb29rIHVwIGV4cHJlc3Npb25zIGJ5IG5hbWUgYXBwcm9wcmlhdGVseVxuICogQHBhcmFtIGNvbnRleHRWYXJpYWJsZUV4cHJlc3Npb24gVGhlIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIHRoZSBjb250ZXh0IHZhcmlhYmxlIHVzZWQgdG8gY3JlYXRlXG4gKiB0aGUgZmluYWwgYXJndW1lbnQgZXhwcmVzc2lvbnNcbiAqIEBwYXJhbSBleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdCBUaGUgZXhwcmVzc2lvbiB0byB2aXNpdCB0byBmaWd1cmUgb3V0IHdoYXQgdmFsdWVzIG5lZWQgdG9cbiAqIGJlIHJlc29sdmVkIGFuZCB3aGF0IGFyZ3VtZW50cyBsaXN0IHRvIGJ1aWxkLlxuICogQHBhcmFtIGJpbmRpbmdJZCBBIG5hbWUgcHJlZml4IHVzZWQgdG8gY3JlYXRlIHRlbXBvcmFyeSB2YXJpYWJsZSBuYW1lcyBpZiB0aGV5J3JlIG5lZWRlZCBmb3IgdGhlXG4gKiBhcmd1bWVudHMgZ2VuZXJhdGVkXG4gKiBAcmV0dXJucyBBbiBhcnJheSBvZiBleHByZXNzaW9ucyB0aGF0IGNhbiBiZSBwYXNzZWQgYXMgYXJndW1lbnRzIHRvIGluc3RydWN0aW9uIGV4cHJlc3Npb25zIGxpa2VcbiAqIGBvLmltcG9ydEV4cHIoUjMucHJvcGVydHlJbnRlcnBvbGF0ZSkuY2FsbEZuKHJlc3VsdClgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0VXBkYXRlQXJndW1lbnRzKFxuICAgIGxvY2FsUmVzb2x2ZXI6IExvY2FsUmVzb2x2ZXIsIGNvbnRleHRWYXJpYWJsZUV4cHJlc3Npb246IG8uRXhwcmVzc2lvbixcbiAgICBleHByZXNzaW9uV2l0aEFyZ3VtZW50c1RvRXh0cmFjdDogY2RBc3QuSW50ZXJwb2xhdGlvbiwgYmluZGluZ0lkOiBzdHJpbmcpIHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfQXN0VG9JclZpc2l0b3IoXG4gICAgICBsb2NhbFJlc29sdmVyLCBjb250ZXh0VmFyaWFibGVFeHByZXNzaW9uLCBiaW5kaW5nSWQsIC8qIHN1cHBvcnRzSW50ZXJwb2xhdGlvbiAqLyB0cnVlKTtcbiAgY29uc3Qgb3V0cHV0RXhwciA9IHZpc2l0b3IudmlzaXRJbnRlcnBvbGF0aW9uKGV4cHJlc3Npb25XaXRoQXJndW1lbnRzVG9FeHRyYWN0LCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICBpZiAodmlzaXRvci51c2VzSW1wbGljaXRSZWNlaXZlcikge1xuICAgIGxvY2FsUmVzb2x2ZXIubm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpO1xuICB9XG5cbiAgY29uc3Qgc3RtdHMgPSBnZXRTdGF0ZW1lbnRzRnJvbVZpc2l0b3IodmlzaXRvciwgYmluZGluZ0lkKTtcbiAgY29uc3QgYXJncyA9IG91dHB1dEV4cHIuYXJncztcbiAgcmV0dXJuIHtzdG10cywgYXJnc307XG59XG5cbmZ1bmN0aW9uIGdldFN0YXRlbWVudHNGcm9tVmlzaXRvcih2aXNpdG9yOiBfQXN0VG9JclZpc2l0b3IsIGJpbmRpbmdJZDogc3RyaW5nKSB7XG4gIGNvbnN0IHN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmlzaXRvci50ZW1wb3JhcnlDb3VudDsgaSsrKSB7XG4gICAgc3RtdHMucHVzaCh0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQsIGkpKTtcbiAgfVxuICByZXR1cm4gc3RtdHM7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRCdWlsdGlucyhjb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSwgYXN0OiBjZEFzdC5BU1QpOiBjZEFzdC5BU1Qge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9CdWlsdGluQXN0Q29udmVydGVyKGNvbnZlcnRlckZhY3RvcnkpO1xuICByZXR1cm4gYXN0LnZpc2l0KHZpc2l0b3IpO1xufVxuXG5mdW5jdGlvbiB0ZW1wb3JhcnlOYW1lKGJpbmRpbmdJZDogc3RyaW5nLCB0ZW1wb3JhcnlOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBgdG1wXyR7YmluZGluZ0lkfV8ke3RlbXBvcmFyeU51bWJlcn1gO1xufVxuXG5mdW5jdGlvbiB0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQ6IHN0cmluZywgdGVtcG9yYXJ5TnVtYmVyOiBudW1iZXIpOiBvLlN0YXRlbWVudCB7XG4gIHJldHVybiBuZXcgby5EZWNsYXJlVmFyU3RtdCh0ZW1wb3JhcnlOYW1lKGJpbmRpbmdJZCwgdGVtcG9yYXJ5TnVtYmVyKSk7XG59XG5cbmZ1bmN0aW9uIHByZXBlbmRUZW1wb3JhcnlEZWNscyhcbiAgICB0ZW1wb3JhcnlDb3VudDogbnVtYmVyLCBiaW5kaW5nSWQ6IHN0cmluZywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSkge1xuICBmb3IgKGxldCBpID0gdGVtcG9yYXJ5Q291bnQgLSAxOyBpID49IDA7IGktLSkge1xuICAgIHN0YXRlbWVudHMudW5zaGlmdCh0ZW1wb3JhcnlEZWNsYXJhdGlvbihiaW5kaW5nSWQsIGkpKTtcbiAgfVxufVxuXG5lbnVtIF9Nb2RlIHtcbiAgU3RhdGVtZW50LFxuICBFeHByZXNzaW9uXG59XG5cbmZ1bmN0aW9uIGVuc3VyZVN0YXRlbWVudE1vZGUobW9kZTogX01vZGUsIGFzdDogY2RBc3QuQVNUKSB7XG4gIGlmIChtb2RlICE9PSBfTW9kZS5TdGF0ZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGEgc3RhdGVtZW50LCBidXQgc2F3ICR7YXN0fWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGU6IF9Nb2RlLCBhc3Q6IGNkQXN0LkFTVCkge1xuICBpZiAobW9kZSAhPT0gX01vZGUuRXhwcmVzc2lvbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYW4gZXhwcmVzc2lvbiwgYnV0IHNhdyAke2FzdH1gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlOiBfTW9kZSwgZXhwcjogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9ufG8uU3RhdGVtZW50IHtcbiAgaWYgKG1vZGUgPT09IF9Nb2RlLlN0YXRlbWVudCkge1xuICAgIHJldHVybiBleHByLnRvU3RtdCgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbmNsYXNzIF9CdWlsdGluQXN0Q29udmVydGVyIGV4dGVuZHMgY2RBc3QuQXN0VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9jb252ZXJ0ZXJGYWN0b3J5OiBCdWlsdGluQ29udmVydGVyRmFjdG9yeSkge1xuICAgIHN1cGVyKCk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IFthc3QuZXhwLCAuLi5hc3QuYXJnc10ubWFwKGFzdCA9PiBhc3QudmlzaXQodGhpcywgY29udGV4dCkpO1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhcmdzLFxuICAgICAgICB0aGlzLl9jb252ZXJ0ZXJGYWN0b3J5LmNyZWF0ZVBpcGVDb252ZXJ0ZXIoYXN0Lm5hbWUsIGFyZ3MubGVuZ3RoKSk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3QgYXJncyA9IGFzdC5leHByZXNzaW9ucy5tYXAoYXN0ID0+IGFzdC52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhc3Quc3BhbiwgYXN0LnNvdXJjZVNwYW4sIGFyZ3MsXG4gICAgICAgIHRoaXMuX2NvbnZlcnRlckZhY3RvcnkuY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyKGFzdC5leHByZXNzaW9ucy5sZW5ndGgpKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFyZ3MgPSBhc3QudmFsdWVzLm1hcChhc3QgPT4gYXN0LnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcblxuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChcbiAgICAgICAgYXN0LnNwYW4sIGFzdC5zb3VyY2VTcGFuLCBhcmdzLCB0aGlzLl9jb252ZXJ0ZXJGYWN0b3J5LmNyZWF0ZUxpdGVyYWxNYXBDb252ZXJ0ZXIoYXN0LmtleXMpKTtcbiAgfVxufVxuXG5jbGFzcyBfQXN0VG9JclZpc2l0b3IgaW1wbGVtZW50cyBjZEFzdC5Bc3RWaXNpdG9yIHtcbiAgcHJpdmF0ZSBfbm9kZU1hcCA9IG5ldyBNYXA8Y2RBc3QuQVNULCBjZEFzdC5BU1Q+KCk7XG4gIHByaXZhdGUgX3Jlc3VsdE1hcCA9IG5ldyBNYXA8Y2RBc3QuQVNULCBvLkV4cHJlc3Npb24+KCk7XG4gIHByaXZhdGUgX2N1cnJlbnRUZW1wb3Jhcnk6IG51bWJlciA9IDA7XG4gIHB1YmxpYyB0ZW1wb3JhcnlDb3VudDogbnVtYmVyID0gMDtcbiAgcHVibGljIHVzZXNJbXBsaWNpdFJlY2VpdmVyOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9sb2NhbFJlc29sdmVyOiBMb2NhbFJlc29sdmVyLCBwcml2YXRlIF9pbXBsaWNpdFJlY2VpdmVyOiBvLkV4cHJlc3Npb24sXG4gICAgICBwcml2YXRlIGJpbmRpbmdJZDogc3RyaW5nLCBwcml2YXRlIHN1cHBvcnRzSW50ZXJwb2xhdGlvbjogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgYmFzZVNvdXJjZVNwYW4/OiBQYXJzZVNvdXJjZVNwYW4sIHByaXZhdGUgaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzPzogU2V0PHN0cmluZz4pIHt9XG5cbiAgdmlzaXRVbmFyeShhc3Q6IGNkQXN0LlVuYXJ5LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgbGV0IG9wOiBvLlVuYXJ5T3BlcmF0b3I7XG4gICAgc3dpdGNoIChhc3Qub3BlcmF0b3IpIHtcbiAgICAgIGNhc2UgJysnOlxuICAgICAgICBvcCA9IG8uVW5hcnlPcGVyYXRvci5QbHVzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy0nOlxuICAgICAgICBvcCA9IG8uVW5hcnlPcGVyYXRvci5NaW51cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIG9wZXJhdG9yICR7YXN0Lm9wZXJhdG9yfWApO1xuICAgIH1cblxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChcbiAgICAgICAgbW9kZSxcbiAgICAgICAgbmV3IG8uVW5hcnlPcGVyYXRvckV4cHIoXG4gICAgICAgICAgICBvcCwgdGhpcy5fdmlzaXQoYXN0LmV4cHIsIF9Nb2RlLkV4cHJlc3Npb24pLCB1bmRlZmluZWQsXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSkpO1xuICB9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBjZEFzdC5CaW5hcnksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBsZXQgb3A6IG8uQmluYXJ5T3BlcmF0b3I7XG4gICAgc3dpdGNoIChhc3Qub3BlcmF0aW9uKSB7XG4gICAgICBjYXNlICcrJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLlBsdXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5NaW51cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcqJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk11bHRpcGx5O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy8nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuRGl2aWRlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyUnOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTW9kdWxvO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyYmJzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkFuZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd8fCc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5PcjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc9PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5FcXVhbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnIT0nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz09PSc6XG4gICAgICAgIG9wID0gby5CaW5hcnlPcGVyYXRvci5JZGVudGljYWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnIT09JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLk5vdElkZW50aWNhbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc8JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz4nOlxuICAgICAgICBvcCA9IG8uQmluYXJ5T3BlcmF0b3IuQmlnZ2VyO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyRXF1YWxzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJz49JzpcbiAgICAgICAgb3AgPSBvLkJpbmFyeU9wZXJhdG9yLkJpZ2dlckVxdWFscztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICc/Pyc6XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnZlcnROdWxsaXNoQ29hbGVzY2UoYXN0LCBtb2RlKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgb3BlcmF0aW9uICR7YXN0Lm9wZXJhdGlvbn1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIG5ldyBvLkJpbmFyeU9wZXJhdG9yRXhwcihcbiAgICAgICAgICAgIG9wLCB0aGlzLl92aXNpdChhc3QubGVmdCwgX01vZGUuRXhwcmVzc2lvbiksIHRoaXMuX3Zpc2l0KGFzdC5yaWdodCwgX01vZGUuRXhwcmVzc2lvbiksXG4gICAgICAgICAgICB1bmRlZmluZWQsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4sIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBlbnN1cmVTdGF0ZW1lbnRNb2RlKG1vZGUsIGFzdCk7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zLCBtb2RlKTtcbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBjZEFzdC5Db25kaXRpb25hbCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IHZhbHVlOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QuY29uZGl0aW9uLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsXG4gICAgICAgIHZhbHVlLmNvbmRpdGlvbmFsKFxuICAgICAgICAgICAgdGhpcy5fdmlzaXQoYXN0LnRydWVFeHAsIF9Nb2RlLkV4cHJlc3Npb24pLCB0aGlzLl92aXNpdChhc3QuZmFsc2VFeHAsIF9Nb2RlLkV4cHJlc3Npb24pLFxuICAgICAgICAgICAgdGhpcy5jb252ZXJ0U291cmNlU3Bhbihhc3Quc3BhbikpKTtcbiAgfVxuXG4gIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgSWxsZWdhbCBzdGF0ZTogUGlwZXMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnMuIFBpcGU6ICR7YXN0Lm5hbWV9YCk7XG4gIH1cblxuICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgZW5zdXJlRXhwcmVzc2lvbk1vZGUobW9kZSwgYXN0KTtcbiAgICB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlcjtcbiAgfVxuXG4gIHZpc2l0VGhpc1JlY2VpdmVyKGFzdDogY2RBc3QuVGhpc1JlY2VpdmVyLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdCwgbW9kZSk7XG4gIH1cblxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBjZEFzdC5JbnRlcnBvbGF0aW9uLCBtb2RlOiBfTW9kZSk6IEludGVycG9sYXRpb25FeHByZXNzaW9uIHtcbiAgICBpZiAoIXRoaXMuc3VwcG9ydHNJbnRlcnBvbGF0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpO1xuICAgIH1cblxuICAgIGVuc3VyZUV4cHJlc3Npb25Nb2RlKG1vZGUsIGFzdCk7XG4gICAgbGV0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3Quc3RyaW5ncy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGFyZ3MucHVzaChvLmxpdGVyYWwoYXN0LnN0cmluZ3NbaV0pKTtcbiAgICAgIGFyZ3MucHVzaCh0aGlzLl92aXNpdChhc3QuZXhwcmVzc2lvbnNbaV0sIF9Nb2RlLkV4cHJlc3Npb24pKTtcbiAgICB9XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbChhc3Quc3RyaW5nc1thc3Quc3RyaW5ncy5sZW5ndGggLSAxXSkpO1xuXG4gICAgLy8gSWYgd2UncmUgZGVhbGluZyB3aXRoIGFuIGludGVycG9sYXRpb24gb2YgMSB2YWx1ZSB3aXRoIGFuIGVtcHR5IHByZWZpeCBhbmQgc3VmZml4LCByZWR1Y2UgdGhlXG4gICAgLy8gYXJncyByZXR1cm5lZCB0byBqdXN0IHRoZSB2YWx1ZSwgYmVjYXVzZSB3ZSdyZSBnb2luZyB0byBwYXNzIGl0IHRvIGEgc3BlY2lhbCBpbnN0cnVjdGlvbi5cbiAgICBjb25zdCBzdHJpbmdzID0gYXN0LnN0cmluZ3M7XG4gICAgaWYgKHN0cmluZ3MubGVuZ3RoID09PSAyICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgICAvLyBTaW5nbGUgYXJndW1lbnQgaW50ZXJwb2xhdGUgaW5zdHJ1Y3Rpb25zLlxuICAgICAgYXJncyA9IFthcmdzWzFdXTtcbiAgICB9IGVsc2UgaWYgKGFzdC5leHByZXNzaW9ucy5sZW5ndGggPj0gOSkge1xuICAgICAgLy8gOSBvciBtb3JlIGFyZ3VtZW50cyBtdXN0IGJlIHBhc3NlZCB0byB0aGUgYGludGVycG9sYXRlVmAtc3R5bGUgaW5zdHJ1Y3Rpb25zLCB3aGljaCBhY2NlcHRcbiAgICAgIC8vIGFuIGFycmF5IG9mIGFyZ3VtZW50c1xuICAgICAgYXJncyA9IFtvLmxpdGVyYWxBcnIoYXJncyldO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oYXJncyk7XG4gIH1cblxuICB2aXNpdEtleWVkUmVhZChhc3Q6IGNkQXN0LktleWVkUmVhZCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IGxlZnRNb3N0U2FmZSA9IHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpO1xuICAgIGlmIChsZWZ0TW9zdFNhZmUpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnZlcnRTYWZlQWNjZXNzKGFzdCwgbGVmdE1vc3RTYWZlLCBtb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICAgIG1vZGUsXG4gICAgICAgICAgdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKS5rZXkodGhpcy5fdmlzaXQoYXN0LmtleSwgX01vZGUuRXhwcmVzc2lvbikpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3Qgb2JqOiBvLkV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGNvbnN0IGtleTogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LmtleSwgX01vZGUuRXhwcmVzc2lvbik7XG4gICAgY29uc3QgdmFsdWU6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC52YWx1ZSwgX01vZGUuRXhwcmVzc2lvbik7XG5cbiAgICBpZiAob2JqID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICB0aGlzLl9sb2NhbFJlc29sdmVyLm1heWJlUmVzdG9yZVZpZXcoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgb2JqLmtleShrZXkpLnNldCh2YWx1ZSkpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBjZEFzdC5MaXRlcmFsQXJyYXksIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgU3RhdGU6IGxpdGVyYWwgYXJyYXlzIHNob3VsZCBoYXZlIGJlZW4gY29udmVydGVkIGludG8gZnVuY3Rpb25zYCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbGxlZ2FsIFN0YXRlOiBsaXRlcmFsIG1hcHMgc2hvdWxkIGhhdmUgYmVlbiBjb252ZXJ0ZWQgaW50byBmdW5jdGlvbnNgKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICAvLyBGb3IgbGl0ZXJhbCB2YWx1ZXMgb2YgbnVsbCwgdW5kZWZpbmVkLCB0cnVlLCBvciBmYWxzZSBhbGxvdyB0eXBlIGludGVyZmVyZW5jZVxuICAgIC8vIHRvIGluZmVyIHRoZSB0eXBlLlxuICAgIGNvbnN0IHR5cGUgPVxuICAgICAgICBhc3QudmFsdWUgPT09IG51bGwgfHwgYXN0LnZhbHVlID09PSB1bmRlZmluZWQgfHwgYXN0LnZhbHVlID09PSB0cnVlIHx8IGFzdC52YWx1ZSA9PT0gdHJ1ZSA/XG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSA6XG4gICAgICAgIHVuZGVmaW5lZDtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgIG1vZGUsIG8ubGl0ZXJhbChhc3QudmFsdWUsIHR5cGUsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKSk7XG4gIH1cblxuICBwcml2YXRlIF9nZXRMb2NhbChuYW1lOiBzdHJpbmcsIHJlY2VpdmVyOiBjZEFzdC5BU1QpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKHRoaXMuX2xvY2FsUmVzb2x2ZXIuZ2xvYmFscz8uaGFzKG5hbWUpICYmIHJlY2VpdmVyIGluc3RhbmNlb2YgY2RBc3QuVGhpc1JlY2VpdmVyKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fbG9jYWxSZXNvbHZlci5nZXRMb2NhbChuYW1lKTtcbiAgfVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90LCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIG8ubm90KHRoaXMuX3Zpc2l0KGFzdC5leHByZXNzaW9uLCBfTW9kZS5FeHByZXNzaW9uKSkpO1xuICB9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCB0aGlzLl92aXNpdChhc3QuZXhwcmVzc2lvbiwgX01vZGUuRXhwcmVzc2lvbikpO1xuICB9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCBsZWZ0TW9zdFNhZmUgPSB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KTtcbiAgICBpZiAobGVmdE1vc3RTYWZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIGxlZnRNb3N0U2FmZSwgbW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICBjb25zdCBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuICAgICAgY29uc3QgcmVjZWl2ZXIgPSB0aGlzLl92aXNpdChhc3QucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgICAgaWYgKHJlY2VpdmVyID09PSB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMuX2dldExvY2FsKGFzdC5uYW1lLCBhc3QucmVjZWl2ZXIpO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgXCJ1c2VzSW1wbGljaXRSZWNlaXZlclwiIHN0YXRlIHNpbmNlIHRoZSBpbXBsaWNpdFxuICAgICAgICAgIC8vIHJlY2VpdmVyIGhhcyBiZWVuIHJlcGxhY2VkIHdpdGggYSByZXNvbHZlZCBsb2NhbCBleHByZXNzaW9uLlxuICAgICAgICAgIHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXI7XG4gICAgICAgICAgdGhpcy5hZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKGFzdC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdCA9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdCA9IHJlY2VpdmVyLnByb3AoYXN0Lm5hbWUsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCByZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICBjb25zdCByZWNlaXZlcjogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LnJlY2VpdmVyLCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSB0aGlzLnVzZXNJbXBsaWNpdFJlY2VpdmVyO1xuXG4gICAgbGV0IHZhckV4cHI6IG8uUmVhZFByb3BFeHByfG51bGwgPSBudWxsO1xuICAgIGlmIChyZWNlaXZlciA9PT0gdGhpcy5faW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgY29uc3QgbG9jYWxFeHByID0gdGhpcy5fZ2V0TG9jYWwoYXN0Lm5hbWUsIGFzdC5yZWNlaXZlcik7XG4gICAgICBpZiAobG9jYWxFeHByKSB7XG4gICAgICAgIGlmIChsb2NhbEV4cHIgaW5zdGFuY2VvZiBvLlJlYWRQcm9wRXhwcikge1xuICAgICAgICAgIC8vIElmIHRoZSBsb2NhbCB2YXJpYWJsZSBpcyBhIHByb3BlcnR5IHJlYWQgZXhwcmVzc2lvbiwgaXQncyBhIHJlZmVyZW5jZVxuICAgICAgICAgIC8vIHRvIGEgJ2NvbnRleHQucHJvcGVydHknIHZhbHVlIGFuZCB3aWxsIGJlIHVzZWQgYXMgdGhlIHRhcmdldCBvZiB0aGVcbiAgICAgICAgICAvLyB3cml0ZSBleHByZXNzaW9uLlxuICAgICAgICAgIHZhckV4cHIgPSBsb2NhbEV4cHI7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgcHJldmlvdXMgXCJ1c2VzSW1wbGljaXRSZWNlaXZlclwiIHN0YXRlIHNpbmNlIHRoZSBpbXBsaWNpdFxuICAgICAgICAgIC8vIHJlY2VpdmVyIGhhcyBiZWVuIHJlcGxhY2VkIHdpdGggYSByZXNvbHZlZCBsb2NhbCBleHByZXNzaW9uLlxuICAgICAgICAgIHRoaXMudXNlc0ltcGxpY2l0UmVjZWl2ZXIgPSBwcmV2VXNlc0ltcGxpY2l0UmVjZWl2ZXI7XG4gICAgICAgICAgdGhpcy5hZGRJbXBsaWNpdFJlY2VpdmVyQWNjZXNzKGFzdC5uYW1lKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBPdGhlcndpc2UgaXQncyBhbiBlcnJvci5cbiAgICAgICAgICBjb25zdCByZWNlaXZlciA9IGFzdC5uYW1lO1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gKGFzdC52YWx1ZSBpbnN0YW5jZW9mIGNkQXN0LlByb3BlcnR5UmVhZCkgPyBhc3QudmFsdWUubmFtZSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBhc3NpZ24gdmFsdWUgXCIke3ZhbHVlfVwiIHRvIHRlbXBsYXRlIHZhcmlhYmxlIFwiJHtcbiAgICAgICAgICAgICAgcmVjZWl2ZXJ9XCIuIFRlbXBsYXRlIHZhcmlhYmxlcyBhcmUgcmVhZC1vbmx5LmApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIElmIG5vIGxvY2FsIGV4cHJlc3Npb24gY291bGQgYmUgcHJvZHVjZWQsIHVzZSB0aGUgb3JpZ2luYWwgcmVjZWl2ZXInc1xuICAgIC8vIHByb3BlcnR5IGFzIHRoZSB0YXJnZXQuXG4gICAgaWYgKHZhckV4cHIgPT09IG51bGwpIHtcbiAgICAgIHZhckV4cHIgPSByZWNlaXZlci5wcm9wKGFzdC5uYW1lLCB0aGlzLmNvbnZlcnRTb3VyY2VTcGFuKGFzdC5zcGFuKSk7XG4gICAgfVxuICAgIHJldHVybiBjb252ZXJ0VG9TdGF0ZW1lbnRJZk5lZWRlZChtb2RlLCB2YXJFeHByLnNldCh0aGlzLl92aXNpdChhc3QudmFsdWUsIF9Nb2RlLkV4cHJlc3Npb24pKSk7XG4gIH1cblxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5TYWZlUHJvcGVydHlSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KSwgbW9kZSk7XG4gIH1cblxuICB2aXNpdFNhZmVLZXllZFJlYWQoYXN0OiBjZEFzdC5TYWZlS2V5ZWRSZWFkLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCB0aGlzLmxlZnRNb3N0U2FmZU5vZGUoYXN0KSwgbW9kZSk7XG4gIH1cblxuICB2aXNpdEFsbChhc3RzOiBjZEFzdC5BU1RbXSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIHJldHVybiBhc3RzLm1hcChhc3QgPT4gdGhpcy5fdmlzaXQoYXN0LCBtb2RlKSk7XG4gIH1cblxuICB2aXNpdENhbGwoYXN0OiBjZEFzdC5DYWxsLCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgbGVmdE1vc3RTYWZlID0gdGhpcy5sZWZ0TW9zdFNhZmVOb2RlKGFzdCk7XG4gICAgaWYgKGxlZnRNb3N0U2FmZSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29udmVydFNhZmVBY2Nlc3MoYXN0LCBsZWZ0TW9zdFNhZmUsIG1vZGUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3MgPSB0aGlzLnZpc2l0QWxsKGFzdC5hcmdzLCBfTW9kZS5FeHByZXNzaW9uKTtcblxuICAgIGlmIChhc3QgaW5zdGFuY2VvZiBCdWlsdGluRnVuY3Rpb25DYWxsKSB7XG4gICAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgYXN0LmNvbnZlcnRlcihjb252ZXJ0ZWRBcmdzKSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVjZWl2ZXIgPSBhc3QucmVjZWl2ZXI7XG4gICAgaWYgKHJlY2VpdmVyIGluc3RhbmNlb2YgY2RBc3QuUHJvcGVydHlSZWFkICYmXG4gICAgICAgIHJlY2VpdmVyLnJlY2VpdmVyIGluc3RhbmNlb2YgY2RBc3QuSW1wbGljaXRSZWNlaXZlciAmJlxuICAgICAgICAhKHJlY2VpdmVyLnJlY2VpdmVyIGluc3RhbmNlb2YgY2RBc3QuVGhpc1JlY2VpdmVyKSAmJiByZWNlaXZlci5uYW1lID09PSAnJGFueScpIHtcbiAgICAgIGlmIChjb252ZXJ0ZWRBcmdzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2FsbCB0byAkYW55LCBleHBlY3RlZCAxIGFyZ3VtZW50IGJ1dCByZWNlaXZlZCAke1xuICAgICAgICAgICAgY29udmVydGVkQXJncy5sZW5ndGggfHwgJ25vbmUnfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKG1vZGUsIGNvbnZlcnRlZEFyZ3NbMF0gYXMgby5FeHByZXNzaW9uKTtcbiAgICB9XG5cbiAgICBjb25zdCBjYWxsID0gdGhpcy5fdmlzaXQocmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pXG4gICAgICAgICAgICAgICAgICAgICAuY2FsbEZuKGNvbnZlcnRlZEFyZ3MsIHRoaXMuY29udmVydFNvdXJjZVNwYW4oYXN0LnNwYW4pKTtcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgY2FsbCk7XG4gIH1cblxuICB2aXNpdFNhZmVDYWxsKGFzdDogY2RBc3QuU2FmZUNhbGwsIG1vZGU6IF9Nb2RlKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5jb252ZXJ0U2FmZUFjY2Vzcyhhc3QsIHRoaXMubGVmdE1vc3RTYWZlTm9kZShhc3QpLCBtb2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0KGFzdDogY2RBc3QuQVNULCBtb2RlOiBfTW9kZSk6IGFueSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fcmVzdWx0TWFwLmdldChhc3QpO1xuICAgIGlmIChyZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgcmV0dXJuICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodGhpcywgbW9kZSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRTYWZlQWNjZXNzKFxuICAgICAgYXN0OiBjZEFzdC5BU1QsIGxlZnRNb3N0U2FmZTogY2RBc3QuU2FmZVByb3BlcnR5UmVhZHxjZEFzdC5TYWZlS2V5ZWRSZWFkfGNkQXN0LlNhZmVDYWxsLFxuICAgICAgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGNvbnRhaW5zIGEgc2FmZSBhY2Nlc3Mgbm9kZSBvbiB0aGUgbGVmdCBpdCBuZWVkcyB0byBiZSBjb252ZXJ0ZWQgdG9cbiAgICAvLyBhbiBleHByZXNzaW9uIHRoYXQgZ3VhcmRzIHRoZSBhY2Nlc3MgdG8gdGhlIG1lbWJlciBieSBjaGVja2luZyB0aGUgcmVjZWl2ZXIgZm9yIGJsYW5rLiBBc1xuICAgIC8vIGV4ZWN1dGlvbiBwcm9jZWVkcyBmcm9tIGxlZnQgdG8gcmlnaHQsIHRoZSBsZWZ0IG1vc3QgcGFydCBvZiB0aGUgZXhwcmVzc2lvbiBtdXN0IGJlIGd1YXJkZWRcbiAgICAvLyBmaXJzdCBidXQsIGJlY2F1c2UgbWVtYmVyIGFjY2VzcyBpcyBsZWZ0IGFzc29jaWF0aXZlLCB0aGUgcmlnaHQgc2lkZSBvZiB0aGUgZXhwcmVzc2lvbiBpcyBhdFxuICAgIC8vIHRoZSB0b3Agb2YgdGhlIEFTVC4gVGhlIGRlc2lyZWQgcmVzdWx0IHJlcXVpcmVzIGxpZnRpbmcgYSBjb3B5IG9mIHRoZSBsZWZ0IHBhcnQgb2YgdGhlXG4gICAgLy8gZXhwcmVzc2lvbiB1cCB0byB0ZXN0IGl0IGZvciBibGFuayBiZWZvcmUgZ2VuZXJhdGluZyB0aGUgdW5ndWFyZGVkIHZlcnNpb24uXG5cbiAgICAvLyBDb25zaWRlciwgZm9yIGV4YW1wbGUgdGhlIGZvbGxvd2luZyBleHByZXNzaW9uOiBhPy5iLmM/LmQuZVxuXG4gICAgLy8gVGhpcyByZXN1bHRzIGluIHRoZSBhc3Q6XG4gICAgLy8gICAgICAgICAuXG4gICAgLy8gICAgICAgIC8gXFxcbiAgICAvLyAgICAgICA/LiAgIGVcbiAgICAvLyAgICAgIC8gIFxcXG4gICAgLy8gICAgIC4gICAgZFxuICAgIC8vICAgIC8gXFxcbiAgICAvLyAgID8uICBjXG4gICAgLy8gIC8gIFxcXG4gICAgLy8gYSAgICBiXG5cbiAgICAvLyBUaGUgZm9sbG93aW5nIHRyZWUgc2hvdWxkIGJlIGdlbmVyYXRlZDpcbiAgICAvL1xuICAgIC8vICAgICAgICAvLS0tLSA/IC0tLS1cXFxuICAgIC8vICAgICAgIC8gICAgICB8ICAgICAgXFxcbiAgICAvLyAgICAgYSAgIC8tLS0gPyAtLS1cXCAgbnVsbFxuICAgIC8vICAgICAgICAvICAgICB8ICAgICBcXFxuICAgIC8vICAgICAgIC4gICAgICAuICAgICBudWxsXG4gICAgLy8gICAgICAvIFxcICAgIC8gXFxcbiAgICAvLyAgICAgLiAgYyAgIC4gICBlXG4gICAgLy8gICAgLyBcXCAgICAvIFxcXG4gICAgLy8gICBhICAgYiAgLiAgIGRcbiAgICAvLyAgICAgICAgIC8gXFxcbiAgICAvLyAgICAgICAgLiAgIGNcbiAgICAvLyAgICAgICAvIFxcXG4gICAgLy8gICAgICBhICAgYlxuICAgIC8vXG4gICAgLy8gTm90aWNlIHRoYXQgdGhlIGZpcnN0IGd1YXJkIGNvbmRpdGlvbiBpcyB0aGUgbGVmdCBoYW5kIG9mIHRoZSBsZWZ0IG1vc3Qgc2FmZSBhY2Nlc3Mgbm9kZVxuICAgIC8vIHdoaWNoIGNvbWVzIGluIGFzIGxlZnRNb3N0U2FmZSB0byB0aGlzIHJvdXRpbmUuXG5cbiAgICBsZXQgZ3VhcmRlZEV4cHJlc3Npb24gPSB0aGlzLl92aXNpdChsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIF9Nb2RlLkV4cHJlc3Npb24pO1xuICAgIGxldCB0ZW1wb3Jhcnk6IG8uUmVhZFZhckV4cHJ8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmICh0aGlzLm5lZWRzVGVtcG9yYXJ5SW5TYWZlQWNjZXNzKGxlZnRNb3N0U2FmZS5yZWNlaXZlcikpIHtcbiAgICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGhhcyBtZXRob2QgY2FsbHMgb3IgcGlwZXMgdGhlbiB3ZSBuZWVkIHRvIHNhdmUgdGhlIHJlc3VsdCBpbnRvIGFcbiAgICAgIC8vIHRlbXBvcmFyeSB2YXJpYWJsZSB0byBhdm9pZCBjYWxsaW5nIHN0YXRlZnVsIG9yIGltcHVyZSBjb2RlIG1vcmUgdGhhbiBvbmNlLlxuICAgICAgdGVtcG9yYXJ5ID0gdGhpcy5hbGxvY2F0ZVRlbXBvcmFyeSgpO1xuXG4gICAgICAvLyBQcmVzZXJ2ZSB0aGUgcmVzdWx0IGluIHRoZSB0ZW1wb3JhcnkgdmFyaWFibGVcbiAgICAgIGd1YXJkZWRFeHByZXNzaW9uID0gdGVtcG9yYXJ5LnNldChndWFyZGVkRXhwcmVzc2lvbik7XG5cbiAgICAgIC8vIEVuc3VyZSBhbGwgZnVydGhlciByZWZlcmVuY2VzIHRvIHRoZSBndWFyZGVkIGV4cHJlc3Npb24gcmVmZXIgdG8gdGhlIHRlbXBvcmFyeSBpbnN0ZWFkLlxuICAgICAgdGhpcy5fcmVzdWx0TWFwLnNldChsZWZ0TW9zdFNhZmUucmVjZWl2ZXIsIHRlbXBvcmFyeSk7XG4gICAgfVxuICAgIGNvbnN0IGNvbmRpdGlvbiA9IGd1YXJkZWRFeHByZXNzaW9uLmlzQmxhbmsoKTtcblxuICAgIC8vIENvbnZlcnQgdGhlIGFzdCB0byBhbiB1bmd1YXJkZWQgYWNjZXNzIHRvIHRoZSByZWNlaXZlcidzIG1lbWJlci4gVGhlIG1hcCB3aWxsIHN1YnN0aXR1dGVcbiAgICAvLyBsZWZ0TW9zdE5vZGUgd2l0aCBpdHMgdW5ndWFyZGVkIHZlcnNpb24gaW4gdGhlIGNhbGwgdG8gYHRoaXMudmlzaXQoKWAuXG4gICAgaWYgKGxlZnRNb3N0U2FmZSBpbnN0YW5jZW9mIGNkQXN0LlNhZmVDYWxsKSB7XG4gICAgICB0aGlzLl9ub2RlTWFwLnNldChcbiAgICAgICAgICBsZWZ0TW9zdFNhZmUsXG4gICAgICAgICAgbmV3IGNkQXN0LkNhbGwoXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5zcGFuLCBsZWZ0TW9zdFNhZmUuc291cmNlU3BhbiwgbGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBsZWZ0TW9zdFNhZmUuYXJncyxcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLmFyZ3VtZW50U3BhbikpO1xuICAgIH0gZWxzZSBpZiAobGVmdE1vc3RTYWZlIGluc3RhbmNlb2YgY2RBc3QuU2FmZUtleWVkUmVhZCkge1xuICAgICAgdGhpcy5fbm9kZU1hcC5zZXQoXG4gICAgICAgICAgbGVmdE1vc3RTYWZlLFxuICAgICAgICAgIG5ldyBjZEFzdC5LZXllZFJlYWQoXG4gICAgICAgICAgICAgIGxlZnRNb3N0U2FmZS5zcGFuLCBsZWZ0TW9zdFNhZmUuc291cmNlU3BhbiwgbGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBsZWZ0TW9zdFNhZmUua2V5KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX25vZGVNYXAuc2V0KFxuICAgICAgICAgIGxlZnRNb3N0U2FmZSxcbiAgICAgICAgICBuZXcgY2RBc3QuUHJvcGVydHlSZWFkKFxuICAgICAgICAgICAgICBsZWZ0TW9zdFNhZmUuc3BhbiwgbGVmdE1vc3RTYWZlLnNvdXJjZVNwYW4sIGxlZnRNb3N0U2FmZS5uYW1lU3BhbixcbiAgICAgICAgICAgICAgbGVmdE1vc3RTYWZlLnJlY2VpdmVyLCBsZWZ0TW9zdFNhZmUubmFtZSkpO1xuICAgIH1cblxuICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbnZlcnQgdGhlIG5vZGUgbm93IHdpdGhvdXQgdGhlIGd1YXJkZWQgbWVtYmVyIGFjY2Vzcy5cbiAgICBjb25zdCBhY2Nlc3MgPSB0aGlzLl92aXNpdChhc3QsIF9Nb2RlLkV4cHJlc3Npb24pO1xuXG4gICAgLy8gUmVtb3ZlIHRoZSBtYXBwaW5nLiBUaGlzIGlzIG5vdCBzdHJpY3RseSByZXF1aXJlZCBhcyB0aGUgY29udmVydGVyIG9ubHkgdHJhdmVyc2VzIGVhY2ggbm9kZVxuICAgIC8vIG9uY2UgYnV0IGlzIHNhZmVyIGlmIHRoZSBjb252ZXJzaW9uIGlzIGNoYW5nZWQgdG8gdHJhdmVyc2UgdGhlIG5vZGVzIG1vcmUgdGhhbiBvbmNlLlxuICAgIHRoaXMuX25vZGVNYXAuZGVsZXRlKGxlZnRNb3N0U2FmZSk7XG5cbiAgICAvLyBJZiB3ZSBhbGxvY2F0ZWQgYSB0ZW1wb3JhcnksIHJlbGVhc2UgaXQuXG4gICAgaWYgKHRlbXBvcmFyeSkge1xuICAgICAgdGhpcy5yZWxlYXNlVGVtcG9yYXJ5KHRlbXBvcmFyeSk7XG4gICAgfVxuXG4gICAgLy8gUHJvZHVjZSB0aGUgY29uZGl0aW9uYWxcbiAgICByZXR1cm4gY29udmVydFRvU3RhdGVtZW50SWZOZWVkZWQobW9kZSwgY29uZGl0aW9uLmNvbmRpdGlvbmFsKG8uTlVMTF9FWFBSLCBhY2Nlc3MpKTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydE51bGxpc2hDb2FsZXNjZShhc3Q6IGNkQXN0LkJpbmFyeSwgbW9kZTogX01vZGUpOiBhbnkge1xuICAgIGNvbnN0IGxlZnQ6IG8uRXhwcmVzc2lvbiA9IHRoaXMuX3Zpc2l0KGFzdC5sZWZ0LCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCByaWdodDogby5FeHByZXNzaW9uID0gdGhpcy5fdmlzaXQoYXN0LnJpZ2h0LCBfTW9kZS5FeHByZXNzaW9uKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0aGlzLmFsbG9jYXRlVGVtcG9yYXJ5KCk7XG4gICAgdGhpcy5yZWxlYXNlVGVtcG9yYXJ5KHRlbXBvcmFyeSk7XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgZm9sbG93aW5nIGV4cHJlc3Npb24uIEl0IGlzIGlkZW50aWNhbCB0byBob3cgVFNcbiAgICAvLyB0cmFuc3BpbGVzIGJpbmFyeSBleHByZXNzaW9ucyB3aXRoIGEgbnVsbGlzaCBjb2FsZXNjaW5nIG9wZXJhdG9yLlxuICAgIC8vIGxldCB0ZW1wO1xuICAgIC8vICh0ZW1wID0gYSkgIT09IG51bGwgJiYgdGVtcCAhPT0gdW5kZWZpbmVkID8gdGVtcCA6IGI7XG4gICAgcmV0dXJuIGNvbnZlcnRUb1N0YXRlbWVudElmTmVlZGVkKFxuICAgICAgICBtb2RlLFxuICAgICAgICB0ZW1wb3Jhcnkuc2V0KGxlZnQpXG4gICAgICAgICAgICAubm90SWRlbnRpY2FsKG8uTlVMTF9FWFBSKVxuICAgICAgICAgICAgLmFuZCh0ZW1wb3Jhcnkubm90SWRlbnRpY2FsKG8ubGl0ZXJhbCh1bmRlZmluZWQpKSlcbiAgICAgICAgICAgIC5jb25kaXRpb25hbCh0ZW1wb3JhcnksIHJpZ2h0KSk7XG4gIH1cblxuICAvLyBHaXZlbiBhbiBleHByZXNzaW9uIG9mIHRoZSBmb3JtIGE/LmIuYz8uZC5lIHRoZW4gdGhlIGxlZnQgbW9zdCBzYWZlIG5vZGUgaXNcbiAgLy8gdGhlIChhPy5iKS4gVGhlIC4gYW5kID8uIGFyZSBsZWZ0IGFzc29jaWF0aXZlIHRodXMgY2FuIGJlIHJld3JpdHRlbiBhczpcbiAgLy8gKCgoKGE/LmMpLmIpLmMpPy5kKS5lLiBUaGlzIHJldHVybnMgdGhlIG1vc3QgZGVlcGx5IG5lc3RlZCBzYWZlIHJlYWQgb3JcbiAgLy8gc2FmZSBtZXRob2QgY2FsbCBhcyB0aGlzIG5lZWRzIHRvIGJlIHRyYW5zZm9ybWVkIGluaXRpYWxseSB0bzpcbiAgLy8gICBhID09IG51bGwgPyBudWxsIDogYS5jLmIuYz8uZC5lXG4gIC8vIHRoZW4gdG86XG4gIC8vICAgYSA9PSBudWxsID8gbnVsbCA6IGEuYi5jID09IG51bGwgPyBudWxsIDogYS5iLmMuZC5lXG4gIHByaXZhdGUgbGVmdE1vc3RTYWZlTm9kZShhc3Q6IGNkQXN0LkFTVCk6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWR8Y2RBc3QuU2FmZUtleWVkUmVhZCB7XG4gICAgY29uc3QgdmlzaXQgPSAodmlzaXRvcjogY2RBc3QuQXN0VmlzaXRvciwgYXN0OiBjZEFzdC5BU1QpOiBhbnkgPT4ge1xuICAgICAgcmV0dXJuICh0aGlzLl9ub2RlTWFwLmdldChhc3QpIHx8IGFzdCkudmlzaXQodmlzaXRvcik7XG4gICAgfTtcbiAgICByZXR1cm4gYXN0LnZpc2l0KHtcbiAgICAgIHZpc2l0VW5hcnkoYXN0OiBjZEFzdC5VbmFyeSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdEJpbmFyeShhc3Q6IGNkQXN0LkJpbmFyeSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4pIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRDb25kaXRpb25hbChhc3Q6IGNkQXN0LkNvbmRpdGlvbmFsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Q2FsbChhc3Q6IGNkQXN0LkNhbGwpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRTYWZlQ2FsbChhc3Q6IGNkQXN0LlNhZmVDYWxsKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpIHx8IGFzdDtcbiAgICAgIH0sXG4gICAgICB2aXNpdEltcGxpY2l0UmVjZWl2ZXIoYXN0OiBjZEFzdC5JbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0VGhpc1JlY2VpdmVyKGFzdDogY2RBc3QuVGhpc1JlY2VpdmVyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRLZXllZFJlYWQoYXN0OiBjZEFzdC5LZXllZFJlYWQpIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0KHRoaXMsIGFzdC5yZWNlaXZlcik7XG4gICAgICB9LFxuICAgICAgdmlzaXRLZXllZFdyaXRlKGFzdDogY2RBc3QuS2V5ZWRXcml0ZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRQaXBlKGFzdDogY2RBc3QuQmluZGluZ1BpcGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcmVmaXhOb3QoYXN0OiBjZEFzdC5QcmVmaXhOb3QpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuTm9uTnVsbEFzc2VydCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHJlc3Npb24pO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogY2RBc3QuUHJvcGVydHlSZWFkKSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QucmVjZWl2ZXIpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogY2RBc3QuU2FmZVByb3BlcnR5UmVhZCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKSB8fCBhc3Q7XG4gICAgICB9LFxuICAgICAgdmlzaXRTYWZlS2V5ZWRSZWFkKGFzdDogY2RBc3QuU2FmZUtleWVkUmVhZCkge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LnJlY2VpdmVyKSB8fCBhc3Q7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRydWUgb2YgdGhlIEFTVCBpbmNsdWRlcyBhIG1ldGhvZCBvciBhIHBpcGUgaW5kaWNhdGluZyB0aGF0LCBpZiB0aGVcbiAgLy8gZXhwcmVzc2lvbiBpcyB1c2VkIGFzIHRoZSB0YXJnZXQgb2YgYSBzYWZlIHByb3BlcnR5IG9yIG1ldGhvZCBhY2Nlc3MgdGhlblxuICAvLyB0aGUgZXhwcmVzc2lvbiBzaG91bGQgYmUgc3RvcmVkIGludG8gYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gIHByaXZhdGUgbmVlZHNUZW1wb3JhcnlJblNhZmVBY2Nlc3MoYXN0OiBjZEFzdC5BU1QpOiBib29sZWFuIHtcbiAgICBjb25zdCB2aXNpdCA9ICh2aXNpdG9yOiBjZEFzdC5Bc3RWaXNpdG9yLCBhc3Q6IGNkQXN0LkFTVCk6IGJvb2xlYW4gPT4ge1xuICAgICAgcmV0dXJuIGFzdCAmJiAodGhpcy5fbm9kZU1hcC5nZXQoYXN0KSB8fCBhc3QpLnZpc2l0KHZpc2l0b3IpO1xuICAgIH07XG4gICAgY29uc3QgdmlzaXRTb21lID0gKHZpc2l0b3I6IGNkQXN0LkFzdFZpc2l0b3IsIGFzdDogY2RBc3QuQVNUW10pOiBib29sZWFuID0+IHtcbiAgICAgIHJldHVybiBhc3Quc29tZShhc3QgPT4gdmlzaXQodmlzaXRvciwgYXN0KSk7XG4gICAgfTtcbiAgICByZXR1cm4gYXN0LnZpc2l0KHtcbiAgICAgIHZpc2l0VW5hcnkoYXN0OiBjZEFzdC5VbmFyeSk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmV4cHIpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0QmluYXJ5KGFzdDogY2RBc3QuQmluYXJ5KTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QubGVmdCkgfHwgdmlzaXQodGhpcywgYXN0LnJpZ2h0KTtcbiAgICAgIH0sXG4gICAgICB2aXNpdENoYWluKGFzdDogY2RBc3QuQ2hhaW4pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBjZEFzdC5Db25kaXRpb25hbCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdmlzaXQodGhpcywgYXN0LmNvbmRpdGlvbikgfHwgdmlzaXQodGhpcywgYXN0LnRydWVFeHApIHx8IHZpc2l0KHRoaXMsIGFzdC5mYWxzZUV4cCk7XG4gICAgICB9LFxuICAgICAgdmlzaXRDYWxsKGFzdDogY2RBc3QuQ2FsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdFNhZmVDYWxsKGFzdDogY2RBc3QuU2FmZUNhbGwpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9LFxuICAgICAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogY2RBc3QuSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgdmlzaXRUaGlzUmVjZWl2ZXIoYXN0OiBjZEFzdC5UaGlzUmVjZWl2ZXIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IGNkQXN0LkludGVycG9sYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHZpc2l0U29tZSh0aGlzLCBhc3QuZXhwcmVzc2lvbnMpO1xuICAgICAgfSxcbiAgICAgIHZpc2l0S2V5ZWRSZWFkKGFzdDogY2RBc3QuS2V5ZWRSZWFkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdEtleWVkV3JpdGUoYXN0OiBjZEFzdC5LZXllZFdyaXRlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IGNkQXN0LkxpdGVyYWxBcnJheSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICB2aXNpdExpdGVyYWxNYXAoYXN0OiBjZEFzdC5MaXRlcmFsTWFwKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IGNkQXN0LkxpdGVyYWxQcmltaXRpdmUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UGlwZShhc3Q6IGNkQXN0LkJpbmRpbmdQaXBlKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJlZml4Tm90KGFzdDogY2RBc3QuUHJlZml4Tm90KSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QuZXhwcmVzc2lvbik7XG4gICAgICB9LFxuICAgICAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogY2RBc3QuUHJlZml4Tm90KSB7XG4gICAgICAgIHJldHVybiB2aXNpdCh0aGlzLCBhc3QuZXhwcmVzc2lvbik7XG4gICAgICB9LFxuICAgICAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBjZEFzdC5Qcm9wZXJ0eVJlYWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IGNkQXN0LlByb3BlcnR5V3JpdGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IGNkQXN0LlNhZmVQcm9wZXJ0eVJlYWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIHZpc2l0U2FmZUtleWVkUmVhZChhc3Q6IGNkQXN0LlNhZmVLZXllZFJlYWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZVRlbXBvcmFyeSgpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCB0ZW1wTnVtYmVyID0gdGhpcy5fY3VycmVudFRlbXBvcmFyeSsrO1xuICAgIHRoaXMudGVtcG9yYXJ5Q291bnQgPSBNYXRoLm1heCh0aGlzLl9jdXJyZW50VGVtcG9yYXJ5LCB0aGlzLnRlbXBvcmFyeUNvdW50KTtcbiAgICByZXR1cm4gbmV3IG8uUmVhZFZhckV4cHIodGVtcG9yYXJ5TmFtZSh0aGlzLmJpbmRpbmdJZCwgdGVtcE51bWJlcikpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWxlYXNlVGVtcG9yYXJ5KHRlbXBvcmFyeTogby5SZWFkVmFyRXhwcikge1xuICAgIHRoaXMuX2N1cnJlbnRUZW1wb3JhcnktLTtcbiAgICBpZiAodGVtcG9yYXJ5Lm5hbWUgIT0gdGVtcG9yYXJ5TmFtZSh0aGlzLmJpbmRpbmdJZCwgdGhpcy5fY3VycmVudFRlbXBvcmFyeSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGVtcG9yYXJ5ICR7dGVtcG9yYXJ5Lm5hbWV9IHJlbGVhc2VkIG91dCBvZiBvcmRlcmApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFic29sdXRlIGBQYXJzZVNvdXJjZVNwYW5gIGZyb20gdGhlIHJlbGF0aXZlIGBQYXJzZVNwYW5gLlxuICAgKlxuICAgKiBgUGFyc2VTcGFuYCBvYmplY3RzIGFyZSByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIGV4cHJlc3Npb24uXG4gICAqIFRoaXMgbWV0aG9kIGNvbnZlcnRzIHRoZXNlIHRvIGZ1bGwgYFBhcnNlU291cmNlU3BhbmAgb2JqZWN0cyB0aGF0XG4gICAqIHNob3cgd2hlcmUgdGhlIHNwYW4gaXMgd2l0aGluIHRoZSBvdmVyYWxsIHNvdXJjZSBmaWxlLlxuICAgKlxuICAgKiBAcGFyYW0gc3BhbiB0aGUgcmVsYXRpdmUgc3BhbiB0byBjb252ZXJ0LlxuICAgKiBAcmV0dXJucyBhIGBQYXJzZVNvdXJjZVNwYW5gIGZvciB0aGUgZ2l2ZW4gc3BhbiBvciBudWxsIGlmIG5vXG4gICAqIGBiYXNlU291cmNlU3BhbmAgd2FzIHByb3ZpZGVkIHRvIHRoaXMgY2xhc3MuXG4gICAqL1xuICBwcml2YXRlIGNvbnZlcnRTb3VyY2VTcGFuKHNwYW46IGNkQXN0LlBhcnNlU3Bhbikge1xuICAgIGlmICh0aGlzLmJhc2VTb3VyY2VTcGFuKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuYmFzZVNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICAgICAgY29uc3QgZW5kID0gdGhpcy5iYXNlU291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoc3Bhbi5lbmQpO1xuICAgICAgY29uc3QgZnVsbFN0YXJ0ID0gdGhpcy5iYXNlU291cmNlU3Bhbi5mdWxsU3RhcnQubW92ZUJ5KHNwYW4uc3RhcnQpO1xuICAgICAgcmV0dXJuIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCwgZnVsbFN0YXJ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqIEFkZHMgdGhlIG5hbWUgb2YgYW4gQVNUIHRvIHRoZSBsaXN0IG9mIGltcGxpY2l0IHJlY2VpdmVyIGFjY2Vzc2VzLiAqL1xuICBwcml2YXRlIGFkZEltcGxpY2l0UmVjZWl2ZXJBY2Nlc3MobmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzKSB7XG4gICAgICB0aGlzLmltcGxpY2l0UmVjZWl2ZXJBY2Nlc3Nlcy5hZGQobmFtZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZsYXR0ZW5TdGF0ZW1lbnRzKGFyZzogYW55LCBvdXRwdXQ6IG8uU3RhdGVtZW50W10pIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICg8YW55W10+YXJnKS5mb3JFYWNoKChlbnRyeSkgPT4gZmxhdHRlblN0YXRlbWVudHMoZW50cnksIG91dHB1dCkpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dC5wdXNoKGFyZyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdW5zdXBwb3J0ZWQoKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpO1xufVxuXG5jbGFzcyBJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbiBleHRlbmRzIG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICAgIHN1cGVyKG51bGwsIG51bGwpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCA9IHVuc3VwcG9ydGVkO1xuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQgPSB1bnN1cHBvcnRlZDtcbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uID0gdW5zdXBwb3J0ZWQ7XG59XG5cbmNsYXNzIERlZmF1bHRMb2NhbFJlc29sdmVyIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBnbG9iYWxzPzogU2V0PHN0cmluZz4pIHt9XG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZCB7fVxuICBtYXliZVJlc3RvcmVWaWV3KCk6IHZvaWQge31cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChuYW1lID09PSBFdmVudEhhbmRsZXJWYXJzLmV2ZW50Lm5hbWUpIHtcbiAgICAgIHJldHVybiBFdmVudEhhbmRsZXJWYXJzLmV2ZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVpbHRpbkZ1bmN0aW9uQ2FsbCBleHRlbmRzIGNkQXN0LkNhbGwge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHNwYW46IGNkQXN0LlBhcnNlU3Bhbiwgc291cmNlU3BhbjogY2RBc3QuQWJzb2x1dGVTb3VyY2VTcGFuLCBhcmdzOiBjZEFzdC5BU1RbXSxcbiAgICAgIHB1YmxpYyBjb252ZXJ0ZXI6IEJ1aWx0aW5Db252ZXJ0ZXIpIHtcbiAgICBzdXBlcihzcGFuLCBzb3VyY2VTcGFuLCBuZXcgY2RBc3QuRW1wdHlFeHByKHNwYW4sIHNvdXJjZVNwYW4pLCBhcmdzLCBudWxsISk7XG4gIH1cbn1cbiJdfQ==