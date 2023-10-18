/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
import * as o from '../../../../output/output_ast';
import { ExpressionKind, OpKind } from './enums';
import { ConsumesVarsTrait, UsesSlotIndex, UsesVarOffset } from './traits';
import { Interpolation } from './ops/update';
/**
 * Check whether a given `o.Expression` is a logical IR expression type.
 */
export function isIrExpression(expr) {
    return expr instanceof ExpressionBase;
}
/**
 * Base type used for all logical IR expressions.
 */
export class ExpressionBase extends o.Expression {
    constructor(sourceSpan = null) {
        super(null, sourceSpan);
    }
}
/**
 * Logical expression representing a lexical read of a variable name.
 */
export class LexicalReadExpr extends ExpressionBase {
    constructor(name) {
        super();
        this.name = name;
        this.kind = ExpressionKind.LexicalRead;
    }
    visitExpression(visitor, context) { }
    isEquivalent() {
        return false;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions() { }
    clone() {
        return new LexicalReadExpr(this.name);
    }
}
/**
 * Runtime operation to retrieve the value of a local reference.
 */
export class ReferenceExpr extends ExpressionBase {
    static { _a = UsesSlotIndex; }
    constructor(target, offset) {
        super();
        this.target = target;
        this.offset = offset;
        this.kind = ExpressionKind.Reference;
        this[_a] = true;
        this.targetSlot = null;
    }
    visitExpression() { }
    isEquivalent(e) {
        return e instanceof ReferenceExpr && e.target === this.target;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions() { }
    clone() {
        const expr = new ReferenceExpr(this.target, this.offset);
        expr.targetSlot = this.targetSlot;
        return expr;
    }
}
/**
 * A reference to the current view context (usually the `ctx` variable in a template function).
 */
export class ContextExpr extends ExpressionBase {
    constructor(view) {
        super();
        this.view = view;
        this.kind = ExpressionKind.Context;
    }
    visitExpression() { }
    isEquivalent(e) {
        return e instanceof ContextExpr && e.view === this.view;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions() { }
    clone() {
        return new ContextExpr(this.view);
    }
}
/**
 * Runtime operation to navigate to the next view context in the view hierarchy.
 */
export class NextContextExpr extends ExpressionBase {
    constructor() {
        super();
        this.kind = ExpressionKind.NextContext;
        this.steps = 1;
    }
    visitExpression() { }
    isEquivalent(e) {
        return e instanceof NextContextExpr && e.steps === this.steps;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions() { }
    clone() {
        const expr = new NextContextExpr();
        expr.steps = this.steps;
        return expr;
    }
}
/**
 * Runtime operation to snapshot the current view context.
 *
 * The result of this operation can be stored in a variable and later used with the `RestoreView`
 * operation.
 */
export class GetCurrentViewExpr extends ExpressionBase {
    constructor() {
        super();
        this.kind = ExpressionKind.GetCurrentView;
    }
    visitExpression() { }
    isEquivalent(e) {
        return e instanceof GetCurrentViewExpr;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions() { }
    clone() {
        return new GetCurrentViewExpr();
    }
}
/**
 * Runtime operation to restore a snapshotted view.
 */
export class RestoreViewExpr extends ExpressionBase {
    constructor(view) {
        super();
        this.view = view;
        this.kind = ExpressionKind.RestoreView;
    }
    visitExpression(visitor, context) {
        if (typeof this.view !== 'number') {
            this.view.visitExpression(visitor, context);
        }
    }
    isEquivalent(e) {
        if (!(e instanceof RestoreViewExpr) || typeof e.view !== typeof this.view) {
            return false;
        }
        if (typeof this.view === 'number') {
            return this.view === e.view;
        }
        else {
            return this.view.isEquivalent(e.view);
        }
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        if (typeof this.view !== 'number') {
            this.view = transformExpressionsInExpression(this.view, transform, flags);
        }
    }
    clone() {
        return new RestoreViewExpr(this.view instanceof o.Expression ? this.view.clone() : this.view);
    }
}
/**
 * Runtime operation to reset the current view context after `RestoreView`.
 */
export class ResetViewExpr extends ExpressionBase {
    constructor(expr) {
        super();
        this.expr = expr;
        this.kind = ExpressionKind.ResetView;
    }
    visitExpression(visitor, context) {
        this.expr.visitExpression(visitor, context);
    }
    isEquivalent(e) {
        return e instanceof ResetViewExpr && this.expr.isEquivalent(e.expr);
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        this.expr = transformExpressionsInExpression(this.expr, transform, flags);
    }
    clone() {
        return new ResetViewExpr(this.expr.clone());
    }
}
/**
 * Read of a variable declared as an `ir.VariableOp` and referenced through its `ir.XrefId`.
 */
export class ReadVariableExpr extends ExpressionBase {
    constructor(xref) {
        super();
        this.xref = xref;
        this.kind = ExpressionKind.ReadVariable;
        this.name = null;
    }
    visitExpression() { }
    isEquivalent(other) {
        return other instanceof ReadVariableExpr && other.xref === this.xref;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions() { }
    clone() {
        const expr = new ReadVariableExpr(this.xref);
        expr.name = this.name;
        return expr;
    }
}
export class PureFunctionExpr extends ExpressionBase {
    static { _b = ConsumesVarsTrait, _c = UsesVarOffset; }
    constructor(expression, args) {
        super();
        this.kind = ExpressionKind.PureFunctionExpr;
        this[_b] = true;
        this[_c] = true;
        this.varOffset = null;
        /**
         * Once extracted to the `ConstantPool`, a reference to the function which defines the computation
         * of `body`.
         */
        this.fn = null;
        this.body = expression;
        this.args = args;
    }
    visitExpression(visitor, context) {
        this.body?.visitExpression(visitor, context);
        for (const arg of this.args) {
            arg.visitExpression(visitor, context);
        }
    }
    isEquivalent(other) {
        if (!(other instanceof PureFunctionExpr) || other.args.length !== this.args.length) {
            return false;
        }
        return other.body !== null && this.body !== null && other.body.isEquivalent(this.body) &&
            other.args.every((arg, idx) => arg.isEquivalent(this.args[idx]));
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        if (this.body !== null) {
            // TODO: figure out if this is the right flag to pass here.
            this.body = transformExpressionsInExpression(this.body, transform, flags | VisitorContextFlag.InChildOperation);
        }
        else if (this.fn !== null) {
            this.fn = transformExpressionsInExpression(this.fn, transform, flags);
        }
        for (let i = 0; i < this.args.length; i++) {
            this.args[i] = transformExpressionsInExpression(this.args[i], transform, flags);
        }
    }
    clone() {
        const expr = new PureFunctionExpr(this.body?.clone() ?? null, this.args.map(arg => arg.clone()));
        expr.fn = this.fn?.clone() ?? null;
        expr.varOffset = this.varOffset;
        return expr;
    }
}
export class PureFunctionParameterExpr extends ExpressionBase {
    constructor(index) {
        super();
        this.index = index;
        this.kind = ExpressionKind.PureFunctionParameterExpr;
    }
    visitExpression() { }
    isEquivalent(other) {
        return other instanceof PureFunctionParameterExpr && other.index === this.index;
    }
    isConstant() {
        return true;
    }
    transformInternalExpressions() { }
    clone() {
        return new PureFunctionParameterExpr(this.index);
    }
}
export class PipeBindingExpr extends ExpressionBase {
    static { _d = UsesSlotIndex, _e = ConsumesVarsTrait, _f = UsesVarOffset; }
    constructor(target, name, args) {
        super();
        this.target = target;
        this.name = name;
        this.args = args;
        this.kind = ExpressionKind.PipeBinding;
        this[_d] = true;
        this[_e] = true;
        this[_f] = true;
        this.targetSlot = null;
        this.varOffset = null;
    }
    visitExpression(visitor, context) {
        for (const arg of this.args) {
            arg.visitExpression(visitor, context);
        }
    }
    isEquivalent() {
        return false;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        for (let idx = 0; idx < this.args.length; idx++) {
            this.args[idx] = transformExpressionsInExpression(this.args[idx], transform, flags);
        }
    }
    clone() {
        const r = new PipeBindingExpr(this.target, this.name, this.args.map(a => a.clone()));
        r.targetSlot = this.targetSlot;
        r.varOffset = this.varOffset;
        return r;
    }
}
export class PipeBindingVariadicExpr extends ExpressionBase {
    static { _g = UsesSlotIndex, _h = ConsumesVarsTrait, _j = UsesVarOffset; }
    constructor(target, name, args, numArgs) {
        super();
        this.target = target;
        this.name = name;
        this.args = args;
        this.numArgs = numArgs;
        this.kind = ExpressionKind.PipeBindingVariadic;
        this[_g] = true;
        this[_h] = true;
        this[_j] = true;
        this.targetSlot = null;
        this.varOffset = null;
    }
    visitExpression(visitor, context) {
        this.args.visitExpression(visitor, context);
    }
    isEquivalent() {
        return false;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        this.args = transformExpressionsInExpression(this.args, transform, flags);
    }
    clone() {
        const r = new PipeBindingVariadicExpr(this.target, this.name, this.args.clone(), this.numArgs);
        r.targetSlot = this.targetSlot;
        r.varOffset = this.varOffset;
        return r;
    }
}
export class SafePropertyReadExpr extends ExpressionBase {
    constructor(receiver, name) {
        super();
        this.receiver = receiver;
        this.name = name;
        this.kind = ExpressionKind.SafePropertyRead;
    }
    // An alias for name, which allows other logic to handle property reads and keyed reads together.
    get index() {
        return this.name;
    }
    visitExpression(visitor, context) {
        this.receiver.visitExpression(visitor, context);
    }
    isEquivalent() {
        return false;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        this.receiver = transformExpressionsInExpression(this.receiver, transform, flags);
    }
    clone() {
        return new SafePropertyReadExpr(this.receiver.clone(), this.name);
    }
}
export class SafeKeyedReadExpr extends ExpressionBase {
    constructor(receiver, index, sourceSpan) {
        super(sourceSpan);
        this.receiver = receiver;
        this.index = index;
        this.kind = ExpressionKind.SafeKeyedRead;
    }
    visitExpression(visitor, context) {
        this.receiver.visitExpression(visitor, context);
        this.index.visitExpression(visitor, context);
    }
    isEquivalent() {
        return false;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        this.receiver = transformExpressionsInExpression(this.receiver, transform, flags);
        this.index = transformExpressionsInExpression(this.index, transform, flags);
    }
    clone() {
        return new SafeKeyedReadExpr(this.receiver.clone(), this.index.clone(), this.sourceSpan);
    }
}
export class SafeInvokeFunctionExpr extends ExpressionBase {
    constructor(receiver, args) {
        super();
        this.receiver = receiver;
        this.args = args;
        this.kind = ExpressionKind.SafeInvokeFunction;
    }
    visitExpression(visitor, context) {
        this.receiver.visitExpression(visitor, context);
        for (const a of this.args) {
            a.visitExpression(visitor, context);
        }
    }
    isEquivalent() {
        return false;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        this.receiver = transformExpressionsInExpression(this.receiver, transform, flags);
        for (let i = 0; i < this.args.length; i++) {
            this.args[i] = transformExpressionsInExpression(this.args[i], transform, flags);
        }
    }
    clone() {
        return new SafeInvokeFunctionExpr(this.receiver.clone(), this.args.map(a => a.clone()));
    }
}
export class SafeTernaryExpr extends ExpressionBase {
    constructor(guard, expr) {
        super();
        this.guard = guard;
        this.expr = expr;
        this.kind = ExpressionKind.SafeTernaryExpr;
    }
    visitExpression(visitor, context) {
        this.guard.visitExpression(visitor, context);
        this.expr.visitExpression(visitor, context);
    }
    isEquivalent() {
        return false;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        this.guard = transformExpressionsInExpression(this.guard, transform, flags);
        this.expr = transformExpressionsInExpression(this.expr, transform, flags);
    }
    clone() {
        return new SafeTernaryExpr(this.guard.clone(), this.expr.clone());
    }
}
export class EmptyExpr extends ExpressionBase {
    constructor() {
        super(...arguments);
        this.kind = ExpressionKind.EmptyExpr;
    }
    visitExpression(visitor, context) { }
    isEquivalent(e) {
        return e instanceof EmptyExpr;
    }
    isConstant() {
        return true;
    }
    clone() {
        return new EmptyExpr();
    }
    transformInternalExpressions() { }
}
export class AssignTemporaryExpr extends ExpressionBase {
    constructor(expr, xref) {
        super();
        this.expr = expr;
        this.xref = xref;
        this.kind = ExpressionKind.AssignTemporaryExpr;
        this.name = null;
    }
    visitExpression(visitor, context) {
        this.expr.visitExpression(visitor, context);
    }
    isEquivalent() {
        return false;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) {
        this.expr = transformExpressionsInExpression(this.expr, transform, flags);
    }
    clone() {
        const a = new AssignTemporaryExpr(this.expr.clone(), this.xref);
        a.name = this.name;
        return a;
    }
}
export class ReadTemporaryExpr extends ExpressionBase {
    constructor(xref) {
        super();
        this.xref = xref;
        this.kind = ExpressionKind.ReadTemporaryExpr;
        this.name = null;
    }
    visitExpression(visitor, context) { }
    isEquivalent() {
        return this.xref === this.xref;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions(transform, flags) { }
    clone() {
        const r = new ReadTemporaryExpr(this.xref);
        r.name = this.name;
        return r;
    }
}
export class SanitizerExpr extends ExpressionBase {
    constructor(fn) {
        super();
        this.fn = fn;
        this.kind = ExpressionKind.SanitizerExpr;
    }
    visitExpression(visitor, context) { }
    isEquivalent(e) {
        return e instanceof SanitizerExpr && e.fn === this.fn;
    }
    isConstant() {
        return true;
    }
    clone() {
        return new SanitizerExpr(this.fn);
    }
    transformInternalExpressions() { }
}
export class SlotLiteralExpr extends ExpressionBase {
    static { _k = UsesSlotIndex; }
    constructor(target) {
        super();
        this.target = target;
        this.kind = ExpressionKind.SlotLiteralExpr;
        this[_k] = true;
        this.targetSlot = null;
    }
    visitExpression(visitor, context) { }
    isEquivalent(e) {
        return e instanceof SlotLiteralExpr && e.target === this.target &&
            e.targetSlot === this.targetSlot;
    }
    isConstant() {
        return true;
    }
    clone() {
        const copy = new SlotLiteralExpr(this.target);
        copy.targetSlot = this.targetSlot;
        return copy;
    }
    transformInternalExpressions() { }
}
export class ConditionalCaseExpr extends ExpressionBase {
    /**
     * Create an expression for one branch of a conditional.
     * @param expr The expression to be tested for this case. Might be null, as in an `else` case.
     * @param target The Xref of the view to be displayed if this condition is true.
     */
    constructor(expr, target, alias = null) {
        super();
        this.expr = expr;
        this.target = target;
        this.alias = alias;
        this.kind = ExpressionKind.ConditionalCase;
    }
    visitExpression(visitor, context) {
        if (this.expr !== null) {
            this.expr.visitExpression(visitor, context);
        }
    }
    isEquivalent(e) {
        return e instanceof ConditionalCaseExpr && e.expr === this.expr;
    }
    isConstant() {
        return true;
    }
    clone() {
        return new ConditionalCaseExpr(this.expr, this.target);
    }
    transformInternalExpressions(transform, flags) {
        if (this.expr !== null) {
            this.expr = transformExpressionsInExpression(this.expr, transform, flags);
        }
    }
}
/**
 * Visits all `Expression`s in the AST of `op` with the `visitor` function.
 */
export function visitExpressionsInOp(op, visitor) {
    transformExpressionsInOp(op, (expr, flags) => {
        visitor(expr, flags);
        return expr;
    }, VisitorContextFlag.None);
}
export var VisitorContextFlag;
(function (VisitorContextFlag) {
    VisitorContextFlag[VisitorContextFlag["None"] = 0] = "None";
    VisitorContextFlag[VisitorContextFlag["InChildOperation"] = 1] = "InChildOperation";
})(VisitorContextFlag || (VisitorContextFlag = {}));
function transformExpressionsInInterpolation(interpolation, transform, flags) {
    for (let i = 0; i < interpolation.expressions.length; i++) {
        interpolation.expressions[i] =
            transformExpressionsInExpression(interpolation.expressions[i], transform, flags);
    }
}
/**
 * Transform all `Expression`s in the AST of `op` with the `transform` function.
 *
 * All such operations will be replaced with the result of applying `transform`, which may be an
 * identity transformation.
 */
export function transformExpressionsInOp(op, transform, flags) {
    switch (op.kind) {
        case OpKind.StyleProp:
        case OpKind.StyleMap:
        case OpKind.ClassProp:
        case OpKind.ClassMap:
        case OpKind.Binding:
        case OpKind.HostProperty:
            if (op.expression instanceof Interpolation) {
                transformExpressionsInInterpolation(op.expression, transform, flags);
            }
            else {
                op.expression = transformExpressionsInExpression(op.expression, transform, flags);
            }
            break;
        case OpKind.Property:
        case OpKind.Attribute:
            if (op.expression instanceof Interpolation) {
                transformExpressionsInInterpolation(op.expression, transform, flags);
            }
            else {
                op.expression = transformExpressionsInExpression(op.expression, transform, flags);
            }
            op.sanitizer =
                op.sanitizer && transformExpressionsInExpression(op.sanitizer, transform, flags);
            break;
        case OpKind.I18nExpression:
            op.expression = transformExpressionsInExpression(op.expression, transform, flags);
            break;
        case OpKind.InterpolateText:
            transformExpressionsInInterpolation(op.interpolation, transform, flags);
            break;
        case OpKind.Statement:
            transformExpressionsInStatement(op.statement, transform, flags);
            break;
        case OpKind.Variable:
            op.initializer = transformExpressionsInExpression(op.initializer, transform, flags);
            break;
        case OpKind.Conditional:
            for (const condition of op.conditions) {
                if (condition.expr === null) {
                    // This is a default case.
                    continue;
                }
                condition.expr = transformExpressionsInExpression(condition.expr, transform, flags);
            }
            if (op.processed !== null) {
                op.processed = transformExpressionsInExpression(op.processed, transform, flags);
            }
            if (op.contextValue !== null) {
                op.contextValue = transformExpressionsInExpression(op.contextValue, transform, flags);
            }
            break;
        case OpKind.Listener:
            for (const innerOp of op.handlerOps) {
                transformExpressionsInOp(innerOp, transform, flags | VisitorContextFlag.InChildOperation);
            }
            break;
        case OpKind.ExtractedAttribute:
            op.expression =
                op.expression && transformExpressionsInExpression(op.expression, transform, flags);
            break;
        case OpKind.ExtractedMessage:
            op.expression = transformExpressionsInExpression(op.expression, transform, flags);
            for (const statement of op.statements) {
                transformExpressionsInStatement(statement, transform, flags);
            }
            break;
        case OpKind.I18n:
        case OpKind.I18nStart:
            for (const [placeholder, expression] of op.params) {
                op.params.set(placeholder, transformExpressionsInExpression(expression, transform, flags));
            }
            break;
        case OpKind.Defer:
        case OpKind.DeferSecondaryBlock:
        case OpKind.DeferOn:
        case OpKind.Projection:
        case OpKind.ProjectionDef:
        case OpKind.Element:
        case OpKind.ElementStart:
        case OpKind.ElementEnd:
        case OpKind.I18nEnd:
        case OpKind.Container:
        case OpKind.ContainerStart:
        case OpKind.ContainerEnd:
        case OpKind.Template:
        case OpKind.DisableBindings:
        case OpKind.EnableBindings:
        case OpKind.Text:
        case OpKind.Pipe:
        case OpKind.Advance:
        case OpKind.Namespace:
        case OpKind.I18nApply:
        case OpKind.Icu:
        case OpKind.IcuUpdate:
            // These operations contain no expressions.
            break;
        default:
            throw new Error(`AssertionError: transformExpressionsInOp doesn't handle ${OpKind[op.kind]}`);
    }
}
/**
 * Transform all `Expression`s in the AST of `expr` with the `transform` function.
 *
 * All such operations will be replaced with the result of applying `transform`, which may be an
 * identity transformation.
 */
export function transformExpressionsInExpression(expr, transform, flags) {
    if (expr instanceof ExpressionBase) {
        expr.transformInternalExpressions(transform, flags);
    }
    else if (expr instanceof o.BinaryOperatorExpr) {
        expr.lhs = transformExpressionsInExpression(expr.lhs, transform, flags);
        expr.rhs = transformExpressionsInExpression(expr.rhs, transform, flags);
    }
    else if (expr instanceof o.ReadPropExpr) {
        expr.receiver = transformExpressionsInExpression(expr.receiver, transform, flags);
    }
    else if (expr instanceof o.ReadKeyExpr) {
        expr.receiver = transformExpressionsInExpression(expr.receiver, transform, flags);
        expr.index = transformExpressionsInExpression(expr.index, transform, flags);
    }
    else if (expr instanceof o.WritePropExpr) {
        expr.receiver = transformExpressionsInExpression(expr.receiver, transform, flags);
        expr.value = transformExpressionsInExpression(expr.value, transform, flags);
    }
    else if (expr instanceof o.WriteKeyExpr) {
        expr.receiver = transformExpressionsInExpression(expr.receiver, transform, flags);
        expr.index = transformExpressionsInExpression(expr.index, transform, flags);
        expr.value = transformExpressionsInExpression(expr.value, transform, flags);
    }
    else if (expr instanceof o.InvokeFunctionExpr) {
        expr.fn = transformExpressionsInExpression(expr.fn, transform, flags);
        for (let i = 0; i < expr.args.length; i++) {
            expr.args[i] = transformExpressionsInExpression(expr.args[i], transform, flags);
        }
    }
    else if (expr instanceof o.LiteralArrayExpr) {
        for (let i = 0; i < expr.entries.length; i++) {
            expr.entries[i] = transformExpressionsInExpression(expr.entries[i], transform, flags);
        }
    }
    else if (expr instanceof o.LiteralMapExpr) {
        for (let i = 0; i < expr.entries.length; i++) {
            expr.entries[i].value =
                transformExpressionsInExpression(expr.entries[i].value, transform, flags);
        }
    }
    else if (expr instanceof o.ConditionalExpr) {
        expr.condition = transformExpressionsInExpression(expr.condition, transform, flags);
        expr.trueCase = transformExpressionsInExpression(expr.trueCase, transform, flags);
        if (expr.falseCase !== null) {
            expr.falseCase = transformExpressionsInExpression(expr.falseCase, transform, flags);
        }
    }
    else if (expr instanceof o.TypeofExpr) {
        expr.expr = transformExpressionsInExpression(expr.expr, transform, flags);
    }
    else if (expr instanceof o.WriteVarExpr) {
        expr.value = transformExpressionsInExpression(expr.value, transform, flags);
    }
    else if (expr instanceof o.LocalizedString) {
        for (let i = 0; i < expr.expressions.length; i++) {
            expr.expressions[i] = transformExpressionsInExpression(expr.expressions[i], transform, flags);
        }
    }
    else if (expr instanceof o.ReadVarExpr || expr instanceof o.ExternalExpr ||
        expr instanceof o.LiteralExpr) {
        // No action for these types.
    }
    else {
        throw new Error(`Unhandled expression kind: ${expr.constructor.name}`);
    }
    return transform(expr, flags);
}
/**
 * Transform all `Expression`s in the AST of `stmt` with the `transform` function.
 *
 * All such operations will be replaced with the result of applying `transform`, which may be an
 * identity transformation.
 */
export function transformExpressionsInStatement(stmt, transform, flags) {
    if (stmt instanceof o.ExpressionStatement) {
        stmt.expr = transformExpressionsInExpression(stmt.expr, transform, flags);
    }
    else if (stmt instanceof o.ReturnStatement) {
        stmt.value = transformExpressionsInExpression(stmt.value, transform, flags);
    }
    else if (stmt instanceof o.DeclareVarStmt) {
        if (stmt.value !== undefined) {
            stmt.value = transformExpressionsInExpression(stmt.value, transform, flags);
        }
    }
    else if (stmt instanceof o.IfStmt) {
        stmt.condition = transformExpressionsInExpression(stmt.condition, transform, flags);
        for (const caseStatement of stmt.trueCase) {
            transformExpressionsInStatement(caseStatement, transform, flags);
        }
        for (const caseStatement of stmt.falseCase) {
            transformExpressionsInStatement(caseStatement, transform, flags);
        }
    }
    else {
        throw new Error(`Unhandled statement kind: ${stmt.constructor.name}`);
    }
}
/**
 * Checks whether the given expression is a string literal.
 */
export function isStringLiteral(expr) {
    return expr instanceof o.LiteralExpr && typeof expr.value === 'string';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvZXhwcmVzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUluRCxPQUFPLEVBQUMsY0FBYyxFQUFFLE1BQU0sRUFBYyxNQUFNLFNBQVMsQ0FBQztBQUM1RCxPQUFPLEVBQUMsaUJBQWlCLEVBQUUsYUFBYSxFQUFzQixhQUFhLEVBQXFCLE1BQU0sVUFBVSxDQUFDO0FBSWpILE9BQU8sRUFBQyxhQUFhLEVBQWdCLE1BQU0sY0FBYyxDQUFDO0FBaUIxRDs7R0FFRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUMsSUFBa0I7SUFDL0MsT0FBTyxJQUFJLFlBQVksY0FBYyxDQUFDO0FBQ3hDLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBZ0IsY0FBZSxTQUFRLENBQUMsQ0FBQyxVQUFVO0lBR3ZELFlBQVksYUFBbUMsSUFBSTtRQUNqRCxLQUFLLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzFCLENBQUM7Q0FRRjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGVBQWdCLFNBQVEsY0FBYztJQUdqRCxZQUFxQixJQUFZO1FBQy9CLEtBQUssRUFBRSxDQUFDO1FBRFcsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUZmLFNBQUksR0FBRyxjQUFjLENBQUMsV0FBVyxDQUFDO0lBSXBELENBQUM7SUFFUSxlQUFlLENBQUMsT0FBNEIsRUFBRSxPQUFZLElBQVMsQ0FBQztJQUVwRSxZQUFZO1FBQ25CLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVRLFVBQVU7UUFDakIsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRVEsNEJBQTRCLEtBQVUs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QUFDO0FBQ3pFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgdHlwZSB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcblxuaW1wb3J0ICogYXMgdCBmcm9tICcuLi8uLi8uLi8uLi9yZW5kZXIzL3IzX2FzdCc7XG5pbXBvcnQge0V4cHJlc3Npb25LaW5kLCBPcEtpbmQsIFNhbml0aXplckZufSBmcm9tICcuL2VudW1zJztcbmltcG9ydCB7Q29uc3VtZXNWYXJzVHJhaXQsIFVzZXNTbG90SW5kZXgsIFVzZXNTbG90SW5kZXhUcmFpdCwgVXNlc1Zhck9mZnNldCwgVXNlc1Zhck9mZnNldFRyYWl0fSBmcm9tICcuL3RyYWl0cyc7XG5cbmltcG9ydCB0eXBlIHtYcmVmSWR9IGZyb20gJy4vb3BlcmF0aW9ucyc7XG5pbXBvcnQgdHlwZSB7Q3JlYXRlT3B9IGZyb20gJy4vb3BzL2NyZWF0ZSc7XG5pbXBvcnQge0ludGVycG9sYXRpb24sIHR5cGUgVXBkYXRlT3B9IGZyb20gJy4vb3BzL3VwZGF0ZSc7XG5cbi8qKlxuICogQW4gYG8uRXhwcmVzc2lvbmAgc3VidHlwZSByZXByZXNlbnRpbmcgYSBsb2dpY2FsIGV4cHJlc3Npb24gaW4gdGhlIGludGVybWVkaWF0ZSByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IHR5cGUgRXhwcmVzc2lvbiA9XG4gICAgTGV4aWNhbFJlYWRFeHByfFJlZmVyZW5jZUV4cHJ8Q29udGV4dEV4cHJ8TmV4dENvbnRleHRFeHByfEdldEN1cnJlbnRWaWV3RXhwcnxSZXN0b3JlVmlld0V4cHJ8XG4gICAgUmVzZXRWaWV3RXhwcnxSZWFkVmFyaWFibGVFeHByfFB1cmVGdW5jdGlvbkV4cHJ8UHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcnxQaXBlQmluZGluZ0V4cHJ8XG4gICAgUGlwZUJpbmRpbmdWYXJpYWRpY0V4cHJ8U2FmZVByb3BlcnR5UmVhZEV4cHJ8U2FmZUtleWVkUmVhZEV4cHJ8U2FmZUludm9rZUZ1bmN0aW9uRXhwcnxFbXB0eUV4cHJ8XG4gICAgQXNzaWduVGVtcG9yYXJ5RXhwcnxSZWFkVGVtcG9yYXJ5RXhwcnxTYW5pdGl6ZXJFeHByfFNsb3RMaXRlcmFsRXhwcnxDb25kaXRpb25hbENhc2VFeHByO1xuXG4vKipcbiAqIFRyYW5zZm9ybWVyIHR5cGUgd2hpY2ggY29udmVydHMgZXhwcmVzc2lvbnMgaW50byBnZW5lcmFsIGBvLkV4cHJlc3Npb25gcyAod2hpY2ggbWF5IGJlIGFuXG4gKiBpZGVudGl0eSB0cmFuc2Zvcm1hdGlvbikuXG4gKi9cbmV4cG9ydCB0eXBlIEV4cHJlc3Npb25UcmFuc2Zvcm0gPSAoZXhwcjogby5FeHByZXNzaW9uLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKSA9PiBvLkV4cHJlc3Npb247XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciBhIGdpdmVuIGBvLkV4cHJlc3Npb25gIGlzIGEgbG9naWNhbCBJUiBleHByZXNzaW9uIHR5cGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0lyRXhwcmVzc2lvbihleHByOiBvLkV4cHJlc3Npb24pOiBleHByIGlzIEV4cHJlc3Npb24ge1xuICByZXR1cm4gZXhwciBpbnN0YW5jZW9mIEV4cHJlc3Npb25CYXNlO1xufVxuXG4vKipcbiAqIEJhc2UgdHlwZSB1c2VkIGZvciBhbGwgbG9naWNhbCBJUiBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEV4cHJlc3Npb25CYXNlIGV4dGVuZHMgby5FeHByZXNzaW9uIHtcbiAgYWJzdHJhY3QgcmVhZG9ubHkga2luZDogRXhwcmVzc2lvbktpbmQ7XG5cbiAgY29uc3RydWN0b3Ioc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICAvKipcbiAgICogUnVuIHRoZSB0cmFuc2Zvcm1lciBhZ2FpbnN0IGFueSBuZXN0ZWQgZXhwcmVzc2lvbnMgd2hpY2ggbWF5IGJlIHByZXNlbnQgaW4gdGhpcyBJUiBleHByZXNzaW9uXG4gICAqIHN1YnR5cGUuXG4gICAqL1xuICBhYnN0cmFjdCB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkO1xufVxuXG4vKipcbiAqIExvZ2ljYWwgZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSBsZXhpY2FsIHJlYWQgb2YgYSB2YXJpYWJsZSBuYW1lLlxuICovXG5leHBvcnQgY2xhc3MgTGV4aWNhbFJlYWRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuTGV4aWNhbFJlYWQ7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgbmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IExleGljYWxSZWFkRXhwciB7XG4gICAgcmV0dXJuIG5ldyBMZXhpY2FsUmVhZEV4cHIodGhpcy5uYW1lKTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJldHJpZXZlIHRoZSB2YWx1ZSBvZiBhIGxvY2FsIHJlZmVyZW5jZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlZmVyZW5jZUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSBpbXBsZW1lbnRzIFVzZXNTbG90SW5kZXhUcmFpdCB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5SZWZlcmVuY2U7XG5cbiAgcmVhZG9ubHlbVXNlc1Nsb3RJbmRleF0gPSB0cnVlO1xuXG4gIHRhcmdldFNsb3Q6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSB0YXJnZXQ6IFhyZWZJZCwgcmVhZG9ubHkgb2Zmc2V0OiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWZlcmVuY2VFeHByICYmIGUudGFyZ2V0ID09PSB0aGlzLnRhcmdldDtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVmZXJlbmNlRXhwciB7XG4gICAgY29uc3QgZXhwciA9IG5ldyBSZWZlcmVuY2VFeHByKHRoaXMudGFyZ2V0LCB0aGlzLm9mZnNldCk7XG4gICAgZXhwci50YXJnZXRTbG90ID0gdGhpcy50YXJnZXRTbG90O1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbi8qKlxuICogQSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0ICh1c3VhbGx5IHRoZSBgY3R4YCB2YXJpYWJsZSBpbiBhIHRlbXBsYXRlIGZ1bmN0aW9uKS5cbiAqL1xuZXhwb3J0IGNsYXNzIENvbnRleHRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuQ29udGV4dDtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSB2aWV3OiBYcmVmSWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBDb250ZXh0RXhwciAmJiBlLnZpZXcgPT09IHRoaXMudmlldztcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogQ29udGV4dEV4cHIge1xuICAgIHJldHVybiBuZXcgQ29udGV4dEV4cHIodGhpcy52aWV3KTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIG5hdmlnYXRlIHRvIHRoZSBuZXh0IHZpZXcgY29udGV4dCBpbiB0aGUgdmlldyBoaWVyYXJjaHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZXh0Q29udGV4dEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5OZXh0Q29udGV4dDtcblxuICBzdGVwcyA9IDE7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTmV4dENvbnRleHRFeHByICYmIGUuc3RlcHMgPT09IHRoaXMuc3RlcHM7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IE5leHRDb250ZXh0RXhwciB7XG4gICAgY29uc3QgZXhwciA9IG5ldyBOZXh0Q29udGV4dEV4cHIoKTtcbiAgICBleHByLnN0ZXBzID0gdGhpcy5zdGVwcztcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHNuYXBzaG90IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dC5cbiAqXG4gKiBUaGUgcmVzdWx0IG9mIHRoaXMgb3BlcmF0aW9uIGNhbiBiZSBzdG9yZWQgaW4gYSB2YXJpYWJsZSBhbmQgbGF0ZXIgdXNlZCB3aXRoIHRoZSBgUmVzdG9yZVZpZXdgXG4gKiBvcGVyYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBHZXRDdXJyZW50Vmlld0V4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5HZXRDdXJyZW50VmlldztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBHZXRDdXJyZW50Vmlld0V4cHI7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IEdldEN1cnJlbnRWaWV3RXhwciB7XG4gICAgcmV0dXJuIG5ldyBHZXRDdXJyZW50Vmlld0V4cHIoKTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc3RvcmUgYSBzbmFwc2hvdHRlZCB2aWV3LlxuICovXG5leHBvcnQgY2xhc3MgUmVzdG9yZVZpZXdFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUmVzdG9yZVZpZXc7XG5cbiAgY29uc3RydWN0b3IocHVibGljIHZpZXc6IFhyZWZJZHxvLkV4cHJlc3Npb24pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIGlmICh0eXBlb2YgdGhpcy52aWV3ICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhpcy52aWV3LnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKCEoZSBpbnN0YW5jZW9mIFJlc3RvcmVWaWV3RXhwcikgfHwgdHlwZW9mIGUudmlldyAhPT0gdHlwZW9mIHRoaXMudmlldykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy52aWV3ID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuIHRoaXMudmlldyA9PT0gZS52aWV3O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy52aWV3LmlzRXF1aXZhbGVudChlLnZpZXcgYXMgby5FeHByZXNzaW9uKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIGlmICh0eXBlb2YgdGhpcy52aWV3ICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhpcy52aWV3ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy52aWV3LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBSZXN0b3JlVmlld0V4cHIge1xuICAgIHJldHVybiBuZXcgUmVzdG9yZVZpZXdFeHByKHRoaXMudmlldyBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvbiA/IHRoaXMudmlldy5jbG9uZSgpIDogdGhpcy52aWV3KTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc2V0IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCBhZnRlciBgUmVzdG9yZVZpZXdgLlxuICovXG5leHBvcnQgY2xhc3MgUmVzZXRWaWV3RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlc2V0VmlldztcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXhwcjogby5FeHByZXNzaW9uKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMuZXhwci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZXNldFZpZXdFeHByICYmIHRoaXMuZXhwci5pc0VxdWl2YWxlbnQoZS5leHByKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFJlc2V0Vmlld0V4cHIge1xuICAgIHJldHVybiBuZXcgUmVzZXRWaWV3RXhwcih0aGlzLmV4cHIuY2xvbmUoKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZWFkIG9mIGEgdmFyaWFibGUgZGVjbGFyZWQgYXMgYW4gYGlyLlZhcmlhYmxlT3BgIGFuZCByZWZlcmVuY2VkIHRocm91Z2ggaXRzIGBpci5YcmVmSWRgLlxuICovXG5leHBvcnQgY2xhc3MgUmVhZFZhcmlhYmxlRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlYWRWYXJpYWJsZTtcbiAgbmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSB4cmVmOiBYcmVmSWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQob3RoZXI6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBvdGhlciBpbnN0YW5jZW9mIFJlYWRWYXJpYWJsZUV4cHIgJiYgb3RoZXIueHJlZiA9PT0gdGhpcy54cmVmO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBSZWFkVmFyaWFibGVFeHByIHtcbiAgICBjb25zdCBleHByID0gbmV3IFJlYWRWYXJpYWJsZUV4cHIodGhpcy54cmVmKTtcbiAgICBleHByLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFB1cmVGdW5jdGlvbkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSBpbXBsZW1lbnRzIENvbnN1bWVzVmFyc1RyYWl0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFVzZXNWYXJPZmZzZXRUcmFpdCB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5QdXJlRnVuY3Rpb25FeHByO1xuICByZWFkb25seVtDb25zdW1lc1ZhcnNUcmFpdF0gPSB0cnVlO1xuICByZWFkb25seVtVc2VzVmFyT2Zmc2V0XSA9IHRydWU7XG5cbiAgdmFyT2Zmc2V0OiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBleHByZXNzaW9uIHdoaWNoIHNob3VsZCBiZSBtZW1vaXplZCBhcyBhIHB1cmUgY29tcHV0YXRpb24uXG4gICAqXG4gICAqIFRoaXMgZXhwcmVzc2lvbiBjb250YWlucyBpbnRlcm5hbCBgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcmBzLCB3aGljaCBhcmUgcGxhY2Vob2xkZXJzIGZvciB0aGVcbiAgICogcG9zaXRpb25hbCBhcmd1bWVudCBleHByZXNzaW9ucyBpbiBgYXJncy5cbiAgICovXG4gIGJvZHk6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBQb3NpdGlvbmFsIGFyZ3VtZW50cyB0byB0aGUgcHVyZSBmdW5jdGlvbiB3aGljaCB3aWxsIG1lbW9pemUgdGhlIGBib2R5YCBleHByZXNzaW9uLCB3aGljaCBhY3RcbiAgICogYXMgbWVtb2l6YXRpb24ga2V5cy5cbiAgICovXG4gIGFyZ3M6IG8uRXhwcmVzc2lvbltdO1xuXG4gIC8qKlxuICAgKiBPbmNlIGV4dHJhY3RlZCB0byB0aGUgYENvbnN0YW50UG9vbGAsIGEgcmVmZXJlbmNlIHRvIHRoZSBmdW5jdGlvbiB3aGljaCBkZWZpbmVzIHRoZSBjb21wdXRhdGlvblxuICAgKiBvZiBgYm9keWAuXG4gICAqL1xuICBmbjogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxudWxsLCBhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5ib2R5ID0gZXhwcmVzc2lvbjtcbiAgICB0aGlzLmFyZ3MgPSBhcmdzO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSkge1xuICAgIHRoaXMuYm9keT8udmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIGZvciAoY29uc3QgYXJnIG9mIHRoaXMuYXJncykge1xuICAgICAgYXJnLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQob3RoZXI6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmICghKG90aGVyIGluc3RhbmNlb2YgUHVyZUZ1bmN0aW9uRXhwcikgfHwgb3RoZXIuYXJncy5sZW5ndGggIT09IHRoaXMuYXJncy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gb3RoZXIuYm9keSAhPT0gbnVsbCAmJiB0aGlzLmJvZHkgIT09IG51bGwgJiYgb3RoZXIuYm9keS5pc0VxdWl2YWxlbnQodGhpcy5ib2R5KSAmJlxuICAgICAgICBvdGhlci5hcmdzLmV2ZXJ5KChhcmcsIGlkeCkgPT4gYXJnLmlzRXF1aXZhbGVudCh0aGlzLmFyZ3NbaWR4XSkpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICBpZiAodGhpcy5ib2R5ICE9PSBudWxsKSB7XG4gICAgICAvLyBUT0RPOiBmaWd1cmUgb3V0IGlmIHRoaXMgaXMgdGhlIHJpZ2h0IGZsYWcgdG8gcGFzcyBoZXJlLlxuICAgICAgdGhpcy5ib2R5ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oXG4gICAgICAgICAgdGhpcy5ib2R5LCB0cmFuc2Zvcm0sIGZsYWdzIHwgVmlzaXRvckNvbnRleHRGbGFnLkluQ2hpbGRPcGVyYXRpb24pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5mbiAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5mbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuZm4sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLmFyZ3NbaV0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmFyZ3NbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFB1cmVGdW5jdGlvbkV4cHIge1xuICAgIGNvbnN0IGV4cHIgPVxuICAgICAgICBuZXcgUHVyZUZ1bmN0aW9uRXhwcih0aGlzLmJvZHk/LmNsb25lKCkgPz8gbnVsbCwgdGhpcy5hcmdzLm1hcChhcmcgPT4gYXJnLmNsb25lKCkpKTtcbiAgICBleHByLmZuID0gdGhpcy5mbj8uY2xvbmUoKSA/PyBudWxsO1xuICAgIGV4cHIudmFyT2Zmc2V0ID0gdGhpcy52YXJPZmZzZXQ7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5QdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBpbmRleDogbnVtYmVyKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KG90aGVyOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gb3RoZXIgaW5zdGFuY2VvZiBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByICYmIG90aGVyLmluZGV4ID09PSB0aGlzLmluZGV4O1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIge1xuICAgIHJldHVybiBuZXcgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcih0aGlzLmluZGV4KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGlwZUJpbmRpbmdFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2UgaW1wbGVtZW50cyBVc2VzU2xvdEluZGV4VHJhaXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDb25zdW1lc1ZhcnNUcmFpdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFVzZXNWYXJPZmZzZXRUcmFpdCB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5QaXBlQmluZGluZztcbiAgcmVhZG9ubHlbVXNlc1Nsb3RJbmRleF0gPSB0cnVlO1xuICByZWFkb25seVtDb25zdW1lc1ZhcnNUcmFpdF0gPSB0cnVlO1xuICByZWFkb25seVtVc2VzVmFyT2Zmc2V0XSA9IHRydWU7XG5cbiAgdGFyZ2V0U2xvdDogbnVtYmVyfG51bGwgPSBudWxsO1xuICB2YXJPZmZzZXQ6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSB0YXJnZXQ6IFhyZWZJZCwgcmVhZG9ubHkgbmFtZTogc3RyaW5nLCByZWFkb25seSBhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBhcmcgb2YgdGhpcy5hcmdzKSB7XG4gICAgICBhcmcudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHRoaXMuYXJncy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICB0aGlzLmFyZ3NbaWR4XSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuYXJnc1tpZHhdLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpIHtcbiAgICBjb25zdCByID0gbmV3IFBpcGVCaW5kaW5nRXhwcih0aGlzLnRhcmdldCwgdGhpcy5uYW1lLCB0aGlzLmFyZ3MubWFwKGEgPT4gYS5jbG9uZSgpKSk7XG4gICAgci50YXJnZXRTbG90ID0gdGhpcy50YXJnZXRTbG90O1xuICAgIHIudmFyT2Zmc2V0ID0gdGhpcy52YXJPZmZzZXQ7XG4gICAgcmV0dXJuIHI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBpcGVCaW5kaW5nVmFyaWFkaWNFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2UgaW1wbGVtZW50cyBVc2VzU2xvdEluZGV4VHJhaXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENvbnN1bWVzVmFyc1RyYWl0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBVc2VzVmFyT2Zmc2V0VHJhaXQge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmdWYXJpYWRpYztcbiAgcmVhZG9ubHlbVXNlc1Nsb3RJbmRleF0gPSB0cnVlO1xuICByZWFkb25seVtDb25zdW1lc1ZhcnNUcmFpdF0gPSB0cnVlO1xuICByZWFkb25seVtVc2VzVmFyT2Zmc2V0XSA9IHRydWU7XG5cbiAgdGFyZ2V0U2xvdDogbnVtYmVyfG51bGwgPSBudWxsO1xuICB2YXJPZmZzZXQ6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IHRhcmdldDogWHJlZklkLCByZWFkb25seSBuYW1lOiBzdHJpbmcsIHB1YmxpYyBhcmdzOiBvLkV4cHJlc3Npb24sXG4gICAgICBwdWJsaWMgbnVtQXJnczogbnVtYmVyKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLmFyZ3MudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5hcmdzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5hcmdzLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFBpcGVCaW5kaW5nVmFyaWFkaWNFeHByIHtcbiAgICBjb25zdCByID0gbmV3IFBpcGVCaW5kaW5nVmFyaWFkaWNFeHByKHRoaXMudGFyZ2V0LCB0aGlzLm5hbWUsIHRoaXMuYXJncy5jbG9uZSgpLCB0aGlzLm51bUFyZ3MpO1xuICAgIHIudGFyZ2V0U2xvdCA9IHRoaXMudGFyZ2V0U2xvdDtcbiAgICByLnZhck9mZnNldCA9IHRoaXMudmFyT2Zmc2V0O1xuICAgIHJldHVybiByO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTYWZlUHJvcGVydHlSZWFkRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlNhZmVQcm9wZXJ0eVJlYWQ7XG5cbiAgY29uc3RydWN0b3IocHVibGljIHJlY2VpdmVyOiBvLkV4cHJlc3Npb24sIHB1YmxpYyBuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLy8gQW4gYWxpYXMgZm9yIG5hbWUsIHdoaWNoIGFsbG93cyBvdGhlciBsb2dpYyB0byBoYW5kbGUgcHJvcGVydHkgcmVhZHMgYW5kIGtleWVkIHJlYWRzIHRvZ2V0aGVyLlxuICBnZXQgaW5kZXgoKSB7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFNhZmVQcm9wZXJ0eVJlYWRFeHByIHtcbiAgICByZXR1cm4gbmV3IFNhZmVQcm9wZXJ0eVJlYWRFeHByKHRoaXMucmVjZWl2ZXIuY2xvbmUoKSwgdGhpcy5uYW1lKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2FmZUtleWVkUmVhZEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5TYWZlS2V5ZWRSZWFkO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHJlY2VpdmVyOiBvLkV4cHJlc3Npb24sIHB1YmxpYyBpbmRleDogby5FeHByZXNzaW9uLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIHN1cGVyKHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgdGhpcy5pbmRleC52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZcKgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5yZWNlaXZlciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMucmVjZWl2ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIHRoaXMuaW5kZXggPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmluZGV4LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFNhZmVLZXllZFJlYWRFeHByIHtcbiAgICByZXR1cm4gbmV3IFNhZmVLZXllZFJlYWRFeHByKHRoaXMucmVjZWl2ZXIuY2xvbmUoKSwgdGhpcy5pbmRleC5jbG9uZSgpLCB0aGlzLnNvdXJjZVNwYW4pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTYWZlSW52b2tlRnVuY3Rpb25FeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuU2FmZUludm9rZUZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWNlaXZlcjogby5FeHByZXNzaW9uLCBwdWJsaWMgYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgZm9yIChjb25zdCBhIG9mIHRoaXMuYXJncykge1xuICAgICAgYS52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5hcmdzW2ldID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5hcmdzW2ldLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBTYWZlSW52b2tlRnVuY3Rpb25FeHByIHtcbiAgICByZXR1cm4gbmV3IFNhZmVJbnZva2VGdW5jdGlvbkV4cHIodGhpcy5yZWNlaXZlci5jbG9uZSgpLCB0aGlzLmFyZ3MubWFwKGEgPT4gYS5jbG9uZSgpKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNhZmVUZXJuYXJ5RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlNhZmVUZXJuYXJ5RXhwcjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZ3VhcmQ6IG8uRXhwcmVzc2lvbiwgcHVibGljIGV4cHI6IG8uRXhwcmVzc2lvbikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLmd1YXJkLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB0aGlzLmV4cHIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMuZ3VhcmQgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmd1YXJkLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB0aGlzLmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogU2FmZVRlcm5hcnlFeHByIHtcbiAgICByZXR1cm4gbmV3IFNhZmVUZXJuYXJ5RXhwcih0aGlzLmd1YXJkLmNsb25lKCksIHRoaXMuZXhwci5jbG9uZSgpKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRW1wdHlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuRW1wdHlFeHByO1xuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgRW1wdHlFeHByO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IEVtcHR5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxufVxuXG5leHBvcnQgY2xhc3MgQXNzaWduVGVtcG9yYXJ5RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkFzc2lnblRlbXBvcmFyeUV4cHI7XG5cbiAgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXhwcjogby5FeHByZXNzaW9uLCBwdWJsaWMgeHJlZjogWHJlZklkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMuZXhwci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZcKgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IEFzc2lnblRlbXBvcmFyeUV4cHIge1xuICAgIGNvbnN0IGEgPSBuZXcgQXNzaWduVGVtcG9yYXJ5RXhwcih0aGlzLmV4cHIuY2xvbmUoKSwgdGhpcy54cmVmKTtcbiAgICBhLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgcmV0dXJuIGE7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlYWRUZW1wb3JhcnlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUmVhZFRlbXBvcmFyeUV4cHI7XG5cbiAgcHVibGljIG5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgeHJlZjogWHJlZklkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge31cblxuICBvdmVycmlkZcKgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnhyZWYgPT09IHRoaXMueHJlZjtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFJlYWRUZW1wb3JhcnlFeHByIHtcbiAgICBjb25zdCByID0gbmV3IFJlYWRUZW1wb3JhcnlFeHByKHRoaXMueHJlZik7XG4gICAgci5uYW1lID0gdGhpcy5uYW1lO1xuICAgIHJldHVybiByO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTYW5pdGl6ZXJFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuU2FuaXRpemVyRXhwcjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZm46IFNhbml0aXplckZuKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgU2FuaXRpemVyRXhwciAmJiBlLmZuID09PSB0aGlzLmZuO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFNhbml0aXplckV4cHIge1xuICAgIHJldHVybiBuZXcgU2FuaXRpemVyRXhwcih0aGlzLmZuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxufVxuXG5leHBvcnQgY2xhc3MgU2xvdExpdGVyYWxFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2UgaW1wbGVtZW50cyBVc2VzU2xvdEluZGV4VHJhaXQge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuU2xvdExpdGVyYWxFeHByO1xuICByZWFkb25seVtVc2VzU2xvdEluZGV4XSA9IHRydWU7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdGFyZ2V0OiBYcmVmSWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgdGFyZ2V0U2xvdDogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgU2xvdExpdGVyYWxFeHByICYmIGUudGFyZ2V0ID09PSB0aGlzLnRhcmdldCAmJlxuICAgICAgICBlLnRhcmdldFNsb3QgPT09IHRoaXMudGFyZ2V0U2xvdDtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBTbG90TGl0ZXJhbEV4cHIge1xuICAgIGNvbnN0IGNvcHkgPSBuZXcgU2xvdExpdGVyYWxFeHByKHRoaXMudGFyZ2V0KTtcbiAgICBjb3B5LnRhcmdldFNsb3QgPSB0aGlzLnRhcmdldFNsb3Q7XG4gICAgcmV0dXJuIGNvcHk7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuZXhwb3J0IGNsYXNzIENvbmRpdGlvbmFsQ2FzZUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5Db25kaXRpb25hbENhc2U7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbiBleHByZXNzaW9uIGZvciBvbmUgYnJhbmNoIG9mIGEgY29uZGl0aW9uYWwuXG4gICAqIEBwYXJhbSBleHByIFRoZSBleHByZXNzaW9uIHRvIGJlIHRlc3RlZCBmb3IgdGhpcyBjYXNlLiBNaWdodCBiZSBudWxsLCBhcyBpbiBhbiBgZWxzZWAgY2FzZS5cbiAgICogQHBhcmFtIHRhcmdldCBUaGUgWHJlZiBvZiB0aGUgdmlldyB0byBiZSBkaXNwbGF5ZWQgaWYgdGhpcyBjb25kaXRpb24gaXMgdHJ1ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGV4cHI6IG8uRXhwcmVzc2lvbnxudWxsLCByZWFkb25seSB0YXJnZXQ6IFhyZWZJZCxcbiAgICAgIHJlYWRvbmx5IGFsaWFzOiB0LlZhcmlhYmxlfG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmICh0aGlzLmV4cHIgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuZXhwci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENvbmRpdGlvbmFsQ2FzZUV4cHIgJiYgZS5leHByID09PSB0aGlzLmV4cHI7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogQ29uZGl0aW9uYWxDYXNlRXhwciB7XG4gICAgcmV0dXJuIG5ldyBDb25kaXRpb25hbENhc2VFeHByKHRoaXMuZXhwciwgdGhpcy50YXJnZXQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgaWYgKHRoaXMuZXhwciAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBWaXNpdHMgYWxsIGBFeHByZXNzaW9uYHMgaW4gdGhlIEFTVCBvZiBgb3BgIHdpdGggdGhlIGB2aXNpdG9yYCBmdW5jdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0RXhwcmVzc2lvbnNJbk9wKFxuICAgIG9wOiBDcmVhdGVPcHxVcGRhdGVPcCwgdmlzaXRvcjogKGV4cHI6IG8uRXhwcmVzc2lvbiwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZykgPT4gdm9pZCk6IHZvaWQge1xuICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIChleHByLCBmbGFncykgPT4ge1xuICAgIHZpc2l0b3IoZXhwciwgZmxhZ3MpO1xuICAgIHJldHVybiBleHByO1xuICB9LCBWaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG59XG5cbmV4cG9ydCBlbnVtIFZpc2l0b3JDb250ZXh0RmxhZyB7XG4gIE5vbmUgPSAwYjAwMDAsXG4gIEluQ2hpbGRPcGVyYXRpb24gPSAwYjAwMDEsXG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5JbnRlcnBvbGF0aW9uKFxuICAgIGludGVycG9sYXRpb246IEludGVycG9sYXRpb24sIHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZykge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGludGVycG9sYXRpb24uZXhwcmVzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zW2ldID1cbiAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbi5leHByZXNzaW9uc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYWxsIGBFeHByZXNzaW9uYHMgaW4gdGhlIEFTVCBvZiBgb3BgIHdpdGggdGhlIGB0cmFuc2Zvcm1gIGZ1bmN0aW9uLlxuICpcbiAqIEFsbCBzdWNoIG9wZXJhdGlvbnMgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZSByZXN1bHQgb2YgYXBwbHlpbmcgYHRyYW5zZm9ybWAsIHdoaWNoIG1heSBiZSBhblxuICogaWRlbnRpdHkgdHJhbnNmb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3AoXG4gICAgb3A6IENyZWF0ZU9wfFVwZGF0ZU9wLCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOiB2b2lkIHtcbiAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgY2FzZSBPcEtpbmQuU3R5bGVQcm9wOlxuICAgIGNhc2UgT3BLaW5kLlN0eWxlTWFwOlxuICAgIGNhc2UgT3BLaW5kLkNsYXNzUHJvcDpcbiAgICBjYXNlIE9wS2luZC5DbGFzc01hcDpcbiAgICBjYXNlIE9wS2luZC5CaW5kaW5nOlxuICAgIGNhc2UgT3BLaW5kLkhvc3RQcm9wZXJ0eTpcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlByb3BlcnR5OlxuICAgIGNhc2UgT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIG9wLnNhbml0aXplciA9XG4gICAgICAgICAgb3Auc2FuaXRpemVyICYmIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnNhbml0aXplciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5JMThuRXhwcmVzc2lvbjpcbiAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5JbnRlcnBvbGF0aW9uKG9wLmludGVycG9sYXRpb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuU3RhdGVtZW50OlxuICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJblN0YXRlbWVudChvcC5zdGF0ZW1lbnQsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuVmFyaWFibGU6XG4gICAgICBvcC5pbml0aWFsaXplciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLmluaXRpYWxpemVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkNvbmRpdGlvbmFsOlxuICAgICAgZm9yIChjb25zdCBjb25kaXRpb24gb2Ygb3AuY29uZGl0aW9ucykge1xuICAgICAgICBpZiAoY29uZGl0aW9uLmV4cHIgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZGVmYXVsdCBjYXNlLlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbmRpdGlvbi5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oY29uZGl0aW9uLmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgaWYgKG9wLnByb2Nlc3NlZCAhPT0gbnVsbCkge1xuICAgICAgICBvcC5wcm9jZXNzZWQgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5wcm9jZXNzZWQsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgaWYgKG9wLmNvbnRleHRWYWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICBvcC5jb250ZXh0VmFsdWUgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5jb250ZXh0VmFsdWUsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuTGlzdGVuZXI6XG4gICAgICBmb3IgKGNvbnN0IGlubmVyT3Agb2Ygb3AuaGFuZGxlck9wcykge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3AoaW5uZXJPcCwgdHJhbnNmb3JtLCBmbGFncyB8IFZpc2l0b3JDb250ZXh0RmxhZy5JbkNoaWxkT3BlcmF0aW9uKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZTpcbiAgICAgIG9wLmV4cHJlc3Npb24gPVxuICAgICAgICAgIG9wLmV4cHJlc3Npb24gJiYgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AuZXhwcmVzc2lvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5FeHRyYWN0ZWRNZXNzYWdlOlxuICAgICAgb3AuZXhwcmVzc2lvbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLmV4cHJlc3Npb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgZm9yIChjb25zdCBzdGF0ZW1lbnQgb2Ygb3Auc3RhdGVtZW50cykge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luU3RhdGVtZW50KHN0YXRlbWVudCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5JMThuOlxuICAgIGNhc2UgT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCBleHByZXNzaW9uXSBvZiBvcC5wYXJhbXMpIHtcbiAgICAgICAgb3AucGFyYW1zLnNldChwbGFjZWhvbGRlciwgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwcmVzc2lvbiwgdHJhbnNmb3JtLCBmbGFncykpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuRGVmZXI6XG4gICAgY2FzZSBPcEtpbmQuRGVmZXJTZWNvbmRhcnlCbG9jazpcbiAgICBjYXNlIE9wS2luZC5EZWZlck9uOlxuICAgIGNhc2UgT3BLaW5kLlByb2plY3Rpb246XG4gICAgY2FzZSBPcEtpbmQuUHJvamVjdGlvbkRlZjpcbiAgICBjYXNlIE9wS2luZC5FbGVtZW50OlxuICAgIGNhc2UgT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICBjYXNlIE9wS2luZC5FbGVtZW50RW5kOlxuICAgIGNhc2UgT3BLaW5kLkkxOG5FbmQ6XG4gICAgY2FzZSBPcEtpbmQuQ29udGFpbmVyOlxuICAgIGNhc2UgT3BLaW5kLkNvbnRhaW5lclN0YXJ0OlxuICAgIGNhc2UgT3BLaW5kLkNvbnRhaW5lckVuZDpcbiAgICBjYXNlIE9wS2luZC5UZW1wbGF0ZTpcbiAgICBjYXNlIE9wS2luZC5EaXNhYmxlQmluZGluZ3M6XG4gICAgY2FzZSBPcEtpbmQuRW5hYmxlQmluZGluZ3M6XG4gICAgY2FzZSBPcEtpbmQuVGV4dDpcbiAgICBjYXNlIE9wS2luZC5QaXBlOlxuICAgIGNhc2UgT3BLaW5kLkFkdmFuY2U6XG4gICAgY2FzZSBPcEtpbmQuTmFtZXNwYWNlOlxuICAgIGNhc2UgT3BLaW5kLkkxOG5BcHBseTpcbiAgICBjYXNlIE9wS2luZC5JY3U6XG4gICAgY2FzZSBPcEtpbmQuSWN1VXBkYXRlOlxuICAgICAgLy8gVGhlc2Ugb3BlcmF0aW9ucyBjb250YWluIG5vIGV4cHJlc3Npb25zLlxuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcCBkb2Vzbid0IGhhbmRsZSAke09wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbGwgYEV4cHJlc3Npb25gcyBpbiB0aGUgQVNUIG9mIGBleHByYCB3aXRoIHRoZSBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBBbGwgc3VjaCBvcGVyYXRpb25zIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGUgcmVzdWx0IG9mIGFwcGx5aW5nIGB0cmFuc2Zvcm1gLCB3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oXG4gICAgZXhwcjogby5FeHByZXNzaW9uLCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoZXhwciBpbnN0YW5jZW9mIEV4cHJlc3Npb25CYXNlKSB7XG4gICAgZXhwci50cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkJpbmFyeU9wZXJhdG9yRXhwcikge1xuICAgIGV4cHIubGhzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5saHMsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIucmhzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5yaHMsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLlJlYWRQcm9wRXhwcikge1xuICAgIGV4cHIucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5SZWFkS2V5RXhwcikge1xuICAgIGV4cHIucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLmluZGV4ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5pbmRleCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uV3JpdGVQcm9wRXhwcikge1xuICAgIGV4cHIucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uV3JpdGVLZXlFeHByKSB7XG4gICAgZXhwci5yZWNlaXZlciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIucmVjZWl2ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIuaW5kZXggPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmluZGV4LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uSW52b2tlRnVuY3Rpb25FeHByKSB7XG4gICAgZXhwci5mbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZm4sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwci5hcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBleHByLmFyZ3NbaV0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmFyZ3NbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5MaXRlcmFsQXJyYXlFeHByKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByLmVudHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHIuZW50cmllc1tpXSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZW50cmllc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxNYXBFeHByKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByLmVudHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHIuZW50cmllc1tpXS52YWx1ZSA9XG4gICAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5lbnRyaWVzW2ldLnZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uQ29uZGl0aW9uYWxFeHByKSB7XG4gICAgZXhwci5jb25kaXRpb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmNvbmRpdGlvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZXhwci50cnVlQ2FzZSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIudHJ1ZUNhc2UsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGlmIChleHByLmZhbHNlQ2FzZSAhPT0gbnVsbCkge1xuICAgICAgZXhwci5mYWxzZUNhc2UgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmZhbHNlQ2FzZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLlR5cGVvZkV4cHIpIHtcbiAgICBleHByLmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLldyaXRlVmFyRXhwcikge1xuICAgIGV4cHIudmFsdWUgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5Mb2NhbGl6ZWRTdHJpbmcpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHIuZXhwcmVzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHIuZXhwcmVzc2lvbnNbaV0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmV4cHJlc3Npb25zW2ldLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoXG4gICAgICBleHByIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwciB8fCBleHByIGluc3RhbmNlb2Ygby5FeHRlcm5hbEV4cHIgfHxcbiAgICAgIGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByKSB7XG4gICAgLy8gTm8gYWN0aW9uIGZvciB0aGVzZSB0eXBlcy5cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBleHByZXNzaW9uIGtpbmQ6ICR7ZXhwci5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIHJldHVybiB0cmFuc2Zvcm0oZXhwciwgZmxhZ3MpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbGwgYEV4cHJlc3Npb25gcyBpbiB0aGUgQVNUIG9mIGBzdG10YCB3aXRoIHRoZSBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBBbGwgc3VjaCBvcGVyYXRpb25zIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGUgcmVzdWx0IG9mIGFwcGx5aW5nIGB0cmFuc2Zvcm1gLCB3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvbnNJblN0YXRlbWVudChcbiAgICBzdG10OiBvLlN0YXRlbWVudCwgdHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTogdm9pZCB7XG4gIGlmIChzdG10IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgc3RtdC5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChzdG10IGluc3RhbmNlb2Ygby5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICBzdG10LnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uRGVjbGFyZVZhclN0bXQpIHtcbiAgICBpZiAoc3RtdC52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBzdG10LnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLklmU3RtdCkge1xuICAgIHN0bXQuY29uZGl0aW9uID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC5jb25kaXRpb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGZvciAoY29uc3QgY2FzZVN0YXRlbWVudCBvZiBzdG10LnRydWVDYXNlKSB7XG4gICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luU3RhdGVtZW50KGNhc2VTdGF0ZW1lbnQsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNhc2VTdGF0ZW1lbnQgb2Ygc3RtdC5mYWxzZUNhc2UpIHtcbiAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5TdGF0ZW1lbnQoY2FzZVN0YXRlbWVudCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIHN0YXRlbWVudCBraW5kOiAke3N0bXQuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGEgc3RyaW5nIGxpdGVyYWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N0cmluZ0xpdGVyYWwoZXhwcjogby5FeHByZXNzaW9uKTogZXhwciBpcyBvLkxpdGVyYWxFeHByJnt2YWx1ZTogc3RyaW5nfSB7XG4gIHJldHVybiBleHByIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwciAmJiB0eXBlb2YgZXhwci52YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG4iXX0=