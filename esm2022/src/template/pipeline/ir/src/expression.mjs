/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var _a, _b, _c, _d, _e, _f;
import * as o from '../../../../output/output_ast';
import { ExpressionKind, OpKind } from './enums';
import { Interpolation } from './ops/update';
import { ConsumesVarsTrait, UsesVarOffset } from './traits';
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
    isEquivalent(other) {
        // We assume that the lexical reads are in the same context, which must be true for parent
        // expressions to be equivalent.
        // TODO: is this generally safe?
        return this.name === other.name;
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
    constructor(target, targetSlot, offset) {
        super();
        this.target = target;
        this.targetSlot = targetSlot;
        this.offset = offset;
        this.kind = ExpressionKind.Reference;
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
        return new ReferenceExpr(this.target, this.targetSlot, this.offset);
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
 * A reference to the current view context inside a track function.
 */
export class TrackContextExpr extends ExpressionBase {
    constructor(view) {
        super();
        this.view = view;
        this.kind = ExpressionKind.TrackContext;
    }
    visitExpression() { }
    isEquivalent(e) {
        return e instanceof TrackContextExpr && e.view === this.view;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions() { }
    clone() {
        return new TrackContextExpr(this.view);
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
    static { _a = ConsumesVarsTrait, _b = UsesVarOffset; }
    constructor(expression, args) {
        super();
        this.kind = ExpressionKind.PureFunctionExpr;
        this[_a] = true;
        this[_b] = true;
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
    static { _c = ConsumesVarsTrait, _d = UsesVarOffset; }
    constructor(target, targetSlot, name, args) {
        super();
        this.target = target;
        this.targetSlot = targetSlot;
        this.name = name;
        this.args = args;
        this.kind = ExpressionKind.PipeBinding;
        this[_c] = true;
        this[_d] = true;
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
        const r = new PipeBindingExpr(this.target, this.targetSlot, this.name, this.args.map(a => a.clone()));
        r.varOffset = this.varOffset;
        return r;
    }
}
export class PipeBindingVariadicExpr extends ExpressionBase {
    static { _e = ConsumesVarsTrait, _f = UsesVarOffset; }
    constructor(target, targetSlot, name, args, numArgs) {
        super();
        this.target = target;
        this.targetSlot = targetSlot;
        this.name = name;
        this.args = args;
        this.numArgs = numArgs;
        this.kind = ExpressionKind.PipeBindingVariadic;
        this[_e] = true;
        this[_f] = true;
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
        const r = new PipeBindingVariadicExpr(this.target, this.targetSlot, this.name, this.args.clone(), this.numArgs);
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
export class SlotLiteralExpr extends ExpressionBase {
    constructor(slot) {
        super();
        this.slot = slot;
        this.kind = ExpressionKind.SlotLiteralExpr;
    }
    visitExpression(visitor, context) { }
    isEquivalent(e) {
        return e instanceof SlotLiteralExpr && e.slot === this.slot;
    }
    isConstant() {
        return true;
    }
    clone() {
        return new SlotLiteralExpr(this.slot);
    }
    transformInternalExpressions() { }
}
export class ConditionalCaseExpr extends ExpressionBase {
    /**
     * Create an expression for one branch of a conditional.
     * @param expr The expression to be tested for this case. Might be null, as in an `else` case.
     * @param target The Xref of the view to be displayed if this condition is true.
     */
    constructor(expr, target, targetSlot, alias = null) {
        super();
        this.expr = expr;
        this.target = target;
        this.targetSlot = targetSlot;
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
        return new ConditionalCaseExpr(this.expr, this.target, this.targetSlot);
    }
    transformInternalExpressions(transform, flags) {
        if (this.expr !== null) {
            this.expr = transformExpressionsInExpression(this.expr, transform, flags);
        }
    }
}
export class ConstCollectedExpr extends ExpressionBase {
    constructor(expr) {
        super();
        this.expr = expr;
        this.kind = ExpressionKind.ConstCollected;
    }
    transformInternalExpressions(transform, flags) {
        this.expr = transform(this.expr, flags);
    }
    visitExpression(visitor, context) {
        this.expr.visitExpression(visitor, context);
    }
    isEquivalent(e) {
        if (!(e instanceof ConstCollectedExpr)) {
            return false;
        }
        return this.expr.isEquivalent(e.expr);
    }
    isConstant() {
        return this.expr.isConstant();
    }
    clone() {
        return new ConstCollectedExpr(this.expr);
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
            if (op.expression instanceof Interpolation) {
                transformExpressionsInInterpolation(op.expression, transform, flags);
            }
            else {
                op.expression = transformExpressionsInExpression(op.expression, transform, flags);
            }
            break;
        case OpKind.Property:
        case OpKind.HostProperty:
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
            op.trustedValueFn = op.trustedValueFn &&
                transformExpressionsInExpression(op.trustedValueFn, transform, flags);
            break;
        case OpKind.RepeaterCreate:
            op.track = transformExpressionsInExpression(op.track, transform, flags);
            if (op.trackByFn !== null) {
                op.trackByFn = transformExpressionsInExpression(op.trackByFn, transform, flags);
            }
            break;
        case OpKind.Repeater:
            op.collection = transformExpressionsInExpression(op.collection, transform, flags);
            break;
        case OpKind.Defer:
            if (op.loadingConfig !== null) {
                op.loadingConfig = transformExpressionsInExpression(op.loadingConfig, transform, flags);
            }
            if (op.placeholderConfig !== null) {
                op.placeholderConfig =
                    transformExpressionsInExpression(op.placeholderConfig, transform, flags);
            }
            if (op.resolverFn !== null) {
                op.resolverFn = transformExpressionsInExpression(op.resolverFn, transform, flags);
            }
            break;
        case OpKind.I18nMessage:
            for (const [placeholder, expr] of op.params) {
                op.params.set(placeholder, transformExpressionsInExpression(expr, transform, flags));
            }
            for (const [placeholder, expr] of op.postprocessingParams) {
                op.postprocessingParams.set(placeholder, transformExpressionsInExpression(expr, transform, flags));
            }
            break;
        case OpKind.DeferWhen:
            op.expr = transformExpressionsInExpression(op.expr, transform, flags);
            break;
        case OpKind.Advance:
        case OpKind.Container:
        case OpKind.ContainerEnd:
        case OpKind.ContainerStart:
        case OpKind.DeferOn:
        case OpKind.DisableBindings:
        case OpKind.Element:
        case OpKind.ElementEnd:
        case OpKind.ElementStart:
        case OpKind.EnableBindings:
        case OpKind.I18n:
        case OpKind.I18nApply:
        case OpKind.I18nContext:
        case OpKind.I18nEnd:
        case OpKind.I18nStart:
        case OpKind.IcuEnd:
        case OpKind.IcuStart:
        case OpKind.Namespace:
        case OpKind.Pipe:
        case OpKind.Projection:
        case OpKind.ProjectionDef:
        case OpKind.Template:
        case OpKind.Text:
        case OpKind.I18nAttributes:
        case OpKind.IcuPlaceholder:
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
    else if (expr instanceof o.UnaryOperatorExpr) {
        expr.expr = transformExpressionsInExpression(expr.expr, transform, flags);
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
    else if (expr instanceof o.NotExpr) {
        expr.condition = transformExpressionsInExpression(expr.condition, transform, flags);
    }
    else if (expr instanceof o.TaggedTemplateExpr) {
        expr.tag = transformExpressionsInExpression(expr.tag, transform, flags);
        expr.template.expressions =
            expr.template.expressions.map(e => transformExpressionsInExpression(e, transform, flags));
    }
    else if (expr instanceof o.ArrowFunctionExpr) {
        if (Array.isArray(expr.body)) {
            for (let i = 0; i < expr.body.length; i++) {
                transformExpressionsInStatement(expr.body[i], transform, flags);
            }
        }
        else {
            expr.body = transformExpressionsInExpression(expr.body, transform, flags);
        }
    }
    else if (expr instanceof o.WrappedNodeExpr) {
        // TODO: Do we need to transform any TS nodes nested inside of this expression?
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvZXhwcmVzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUluRCxPQUFPLEVBQUMsY0FBYyxFQUFFLE1BQU0sRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUkvQyxPQUFPLEVBQUMsYUFBYSxFQUFnQixNQUFNLGNBQWMsQ0FBQztBQUMxRCxPQUFPLEVBQUMsaUJBQWlCLEVBQUUsYUFBYSxFQUFxQixNQUFNLFVBQVUsQ0FBQztBQWlCOUU7O0dBRUc7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUFDLElBQWtCO0lBQy9DLE9BQU8sSUFBSSxZQUFZLGNBQWMsQ0FBQztBQUN4QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQWdCLGNBQWUsU0FBUSxDQUFDLENBQUMsVUFBVTtJQUd2RCxZQUFZLGFBQW1DLElBQUk7UUFDakQsS0FBSyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMxQixDQUFDO0NBUUY7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyxlQUFnQixTQUFRLGNBQWM7SUFHakQsWUFBcUIsSUFBWTtRQUMvQixLQUFLLEVBQUUsQ0FBQztRQURXLFNBQUksR0FBSixJQUFJLENBQVE7UUFGZixTQUFJLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQztJQUlwRCxDQUFDO0lBRVEsZUFBZSxDQUFDLE9BQTRCLEVBQUUsT0FBWSxJQUFTLENBQUM7SUFFcEUsWUFBWSxDQUFDLEtBQXNCO1FBQzFDLDBGQUEwRjtRQUMxRixnQ0FBZ0M7UUFDaEMsZ0NBQWdDO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFD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QUFhLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzFDLCtCQUErQixDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUNELEtBQUssTUFBTSxhQUFhLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQzNDLCtCQUErQixDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDbkUsQ0FBQztJQUNILENBQUM7U0FBTSxDQUFDO1FBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBNkIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUFDLElBQWtCO0lBQ2hELE9BQU8sSUFBSSxZQUFZLENBQUMsQ0FBQyxXQUFXLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQztBQUN6RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHR5cGUge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vLi4vLi4vLi4vcmVuZGVyMy9yM19hc3QnO1xuaW1wb3J0IHtFeHByZXNzaW9uS2luZCwgT3BLaW5kfSBmcm9tICcuL2VudW1zJztcbmltcG9ydCB7U2xvdEhhbmRsZX0gZnJvbSAnLi9oYW5kbGUnO1xuaW1wb3J0IHR5cGUge1hyZWZJZH0gZnJvbSAnLi9vcGVyYXRpb25zJztcbmltcG9ydCB0eXBlIHtDcmVhdGVPcH0gZnJvbSAnLi9vcHMvY3JlYXRlJztcbmltcG9ydCB7SW50ZXJwb2xhdGlvbiwgdHlwZSBVcGRhdGVPcH0gZnJvbSAnLi9vcHMvdXBkYXRlJztcbmltcG9ydCB7Q29uc3VtZXNWYXJzVHJhaXQsIFVzZXNWYXJPZmZzZXQsIFVzZXNWYXJPZmZzZXRUcmFpdH0gZnJvbSAnLi90cmFpdHMnO1xuXG4vKipcbiAqIEFuIGBvLkV4cHJlc3Npb25gIHN1YnR5cGUgcmVwcmVzZW50aW5nIGEgbG9naWNhbCBleHByZXNzaW9uIGluIHRoZSBpbnRlcm1lZGlhdGUgcmVwcmVzZW50YXRpb24uXG4gKi9cbmV4cG9ydCB0eXBlIEV4cHJlc3Npb24gPVxuICAgIExleGljYWxSZWFkRXhwcnxSZWZlcmVuY2VFeHByfENvbnRleHRFeHByfE5leHRDb250ZXh0RXhwcnxHZXRDdXJyZW50Vmlld0V4cHJ8UmVzdG9yZVZpZXdFeHByfFxuICAgIFJlc2V0Vmlld0V4cHJ8UmVhZFZhcmlhYmxlRXhwcnxQdXJlRnVuY3Rpb25FeHByfFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHJ8UGlwZUJpbmRpbmdFeHByfFxuICAgIFBpcGVCaW5kaW5nVmFyaWFkaWNFeHByfFNhZmVQcm9wZXJ0eVJlYWRFeHByfFNhZmVLZXllZFJlYWRFeHByfFNhZmVJbnZva2VGdW5jdGlvbkV4cHJ8RW1wdHlFeHByfFxuICAgIEFzc2lnblRlbXBvcmFyeUV4cHJ8UmVhZFRlbXBvcmFyeUV4cHJ8U2xvdExpdGVyYWxFeHByfENvbmRpdGlvbmFsQ2FzZUV4cHJ8Q29uc3RDb2xsZWN0ZWRFeHByO1xuXG4vKipcbiAqIFRyYW5zZm9ybWVyIHR5cGUgd2hpY2ggY29udmVydHMgZXhwcmVzc2lvbnMgaW50byBnZW5lcmFsIGBvLkV4cHJlc3Npb25gcyAod2hpY2ggbWF5IGJlIGFuXG4gKiBpZGVudGl0eSB0cmFuc2Zvcm1hdGlvbikuXG4gKi9cbmV4cG9ydCB0eXBlIEV4cHJlc3Npb25UcmFuc2Zvcm0gPSAoZXhwcjogby5FeHByZXNzaW9uLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKSA9PiBvLkV4cHJlc3Npb247XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciBhIGdpdmVuIGBvLkV4cHJlc3Npb25gIGlzIGEgbG9naWNhbCBJUiBleHByZXNzaW9uIHR5cGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0lyRXhwcmVzc2lvbihleHByOiBvLkV4cHJlc3Npb24pOiBleHByIGlzIEV4cHJlc3Npb24ge1xuICByZXR1cm4gZXhwciBpbnN0YW5jZW9mIEV4cHJlc3Npb25CYXNlO1xufVxuXG4vKipcbiAqIEJhc2UgdHlwZSB1c2VkIGZvciBhbGwgbG9naWNhbCBJUiBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEV4cHJlc3Npb25CYXNlIGV4dGVuZHMgby5FeHByZXNzaW9uIHtcbiAgYWJzdHJhY3QgcmVhZG9ubHkga2luZDogRXhwcmVzc2lvbktpbmQ7XG5cbiAgY29uc3RydWN0b3Ioc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsKSB7XG4gICAgc3VwZXIobnVsbCwgc291cmNlU3Bhbik7XG4gIH1cblxuICAvKipcbiAgICogUnVuIHRoZSB0cmFuc2Zvcm1lciBhZ2FpbnN0IGFueSBuZXN0ZWQgZXhwcmVzc2lvbnMgd2hpY2ggbWF5IGJlIHByZXNlbnQgaW4gdGhpcyBJUiBleHByZXNzaW9uXG4gICAqIHN1YnR5cGUuXG4gICAqL1xuICBhYnN0cmFjdCB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkO1xufVxuXG4vKipcbiAqIExvZ2ljYWwgZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSBsZXhpY2FsIHJlYWQgb2YgYSB2YXJpYWJsZSBuYW1lLlxuICovXG5leHBvcnQgY2xhc3MgTGV4aWNhbFJlYWRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuTGV4aWNhbFJlYWQ7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgbmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudChvdGhlcjogTGV4aWNhbFJlYWRFeHByKTogYm9vbGVhbiB7XG4gICAgLy8gV2UgYXNzdW1lIHRoYXQgdGhlIGxleGljYWwgcmVhZHMgYXJlIGluIHRoZSBzYW1lIGNvbnRleHQsIHdoaWNoIG11c3QgYmUgdHJ1ZSBmb3IgcGFyZW50XG4gICAgLy8gZXhwcmVzc2lvbnMgdG8gYmUgZXF1aXZhbGVudC5cbiAgICAvLyBUT0RPOiBpcyB0aGlzIGdlbmVyYWxseSBzYWZlP1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09IG90aGVyLm5hbWU7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IExleGljYWxSZWFkRXhwciB7XG4gICAgcmV0dXJuIG5ldyBMZXhpY2FsUmVhZEV4cHIodGhpcy5uYW1lKTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJldHJpZXZlIHRoZSB2YWx1ZSBvZiBhIGxvY2FsIHJlZmVyZW5jZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlZmVyZW5jZUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5SZWZlcmVuY2U7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdGFyZ2V0OiBYcmVmSWQsIHJlYWRvbmx5IHRhcmdldFNsb3Q6IFNsb3RIYW5kbGUsIHJlYWRvbmx5IG9mZnNldDogbnVtYmVyKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgUmVmZXJlbmNlRXhwciAmJiBlLnRhcmdldCA9PT0gdGhpcy50YXJnZXQ7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFJlZmVyZW5jZUV4cHIge1xuICAgIHJldHVybiBuZXcgUmVmZXJlbmNlRXhwcih0aGlzLnRhcmdldCwgdGhpcy50YXJnZXRTbG90LCB0aGlzLm9mZnNldCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQgKHVzdWFsbHkgdGhlIGBjdHhgIHZhcmlhYmxlIGluIGEgdGVtcGxhdGUgZnVuY3Rpb24pLlxuICovXG5leHBvcnQgY2xhc3MgQ29udGV4dEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5Db250ZXh0O1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHZpZXc6IFhyZWZJZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24oKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENvbnRleHRFeHByICYmIGUudmlldyA9PT0gdGhpcy52aWV3O1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBDb250ZXh0RXhwciB7XG4gICAgcmV0dXJuIG5ldyBDb250ZXh0RXhwcih0aGlzLnZpZXcpO1xuICB9XG59XG5cbi8qKlxuICogQSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0IGluc2lkZSBhIHRyYWNrIGZ1bmN0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgVHJhY2tDb250ZXh0RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlRyYWNrQ29udGV4dDtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSB2aWV3OiBYcmVmSWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBUcmFja0NvbnRleHRFeHByICYmIGUudmlldyA9PT0gdGhpcy52aWV3O1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBUcmFja0NvbnRleHRFeHByIHtcbiAgICByZXR1cm4gbmV3IFRyYWNrQ29udGV4dEV4cHIodGhpcy52aWV3KTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIG5hdmlnYXRlIHRvIHRoZSBuZXh0IHZpZXcgY29udGV4dCBpbiB0aGUgdmlldyBoaWVyYXJjaHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZXh0Q29udGV4dEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5OZXh0Q29udGV4dDtcblxuICBzdGVwcyA9IDE7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTmV4dENvbnRleHRFeHByICYmIGUuc3RlcHMgPT09IHRoaXMuc3RlcHM7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IE5leHRDb250ZXh0RXhwciB7XG4gICAgY29uc3QgZXhwciA9IG5ldyBOZXh0Q29udGV4dEV4cHIoKTtcbiAgICBleHByLnN0ZXBzID0gdGhpcy5zdGVwcztcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHNuYXBzaG90IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dC5cbiAqXG4gKiBUaGUgcmVzdWx0IG9mIHRoaXMgb3BlcmF0aW9uIGNhbiBiZSBzdG9yZWQgaW4gYSB2YXJpYWJsZSBhbmQgbGF0ZXIgdXNlZCB3aXRoIHRoZSBgUmVzdG9yZVZpZXdgXG4gKiBvcGVyYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBHZXRDdXJyZW50Vmlld0V4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5HZXRDdXJyZW50VmlldztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBHZXRDdXJyZW50Vmlld0V4cHI7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IEdldEN1cnJlbnRWaWV3RXhwciB7XG4gICAgcmV0dXJuIG5ldyBHZXRDdXJyZW50Vmlld0V4cHIoKTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc3RvcmUgYSBzbmFwc2hvdHRlZCB2aWV3LlxuICovXG5leHBvcnQgY2xhc3MgUmVzdG9yZVZpZXdFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUmVzdG9yZVZpZXc7XG5cbiAgY29uc3RydWN0b3IocHVibGljIHZpZXc6IFhyZWZJZHxvLkV4cHJlc3Npb24pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIGlmICh0eXBlb2YgdGhpcy52aWV3ICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhpcy52aWV3LnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKCEoZSBpbnN0YW5jZW9mIFJlc3RvcmVWaWV3RXhwcikgfHwgdHlwZW9mIGUudmlldyAhPT0gdHlwZW9mIHRoaXMudmlldykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy52aWV3ID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuIHRoaXMudmlldyA9PT0gZS52aWV3O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy52aWV3LmlzRXF1aXZhbGVudChlLnZpZXcgYXMgby5FeHByZXNzaW9uKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIGlmICh0eXBlb2YgdGhpcy52aWV3ICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhpcy52aWV3ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy52aWV3LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBSZXN0b3JlVmlld0V4cHIge1xuICAgIHJldHVybiBuZXcgUmVzdG9yZVZpZXdFeHByKHRoaXMudmlldyBpbnN0YW5jZW9mIG8uRXhwcmVzc2lvbiA/IHRoaXMudmlldy5jbG9uZSgpIDogdGhpcy52aWV3KTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc2V0IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCBhZnRlciBgUmVzdG9yZVZpZXdgLlxuICovXG5leHBvcnQgY2xhc3MgUmVzZXRWaWV3RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlc2V0VmlldztcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXhwcjogby5FeHByZXNzaW9uKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMuZXhwci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZXNldFZpZXdFeHByICYmIHRoaXMuZXhwci5pc0VxdWl2YWxlbnQoZS5leHByKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFJlc2V0Vmlld0V4cHIge1xuICAgIHJldHVybiBuZXcgUmVzZXRWaWV3RXhwcih0aGlzLmV4cHIuY2xvbmUoKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZWFkIG9mIGEgdmFyaWFibGUgZGVjbGFyZWQgYXMgYW4gYGlyLlZhcmlhYmxlT3BgIGFuZCByZWZlcmVuY2VkIHRocm91Z2ggaXRzIGBpci5YcmVmSWRgLlxuICovXG5leHBvcnQgY2xhc3MgUmVhZFZhcmlhYmxlRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlYWRWYXJpYWJsZTtcbiAgbmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSB4cmVmOiBYcmVmSWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQob3RoZXI6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBvdGhlciBpbnN0YW5jZW9mIFJlYWRWYXJpYWJsZUV4cHIgJiYgb3RoZXIueHJlZiA9PT0gdGhpcy54cmVmO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBSZWFkVmFyaWFibGVFeHByIHtcbiAgICBjb25zdCBleHByID0gbmV3IFJlYWRWYXJpYWJsZUV4cHIodGhpcy54cmVmKTtcbiAgICBleHByLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFB1cmVGdW5jdGlvbkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSBpbXBsZW1lbnRzIENvbnN1bWVzVmFyc1RyYWl0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFVzZXNWYXJPZmZzZXRUcmFpdCB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5QdXJlRnVuY3Rpb25FeHByO1xuICByZWFkb25seVtDb25zdW1lc1ZhcnNUcmFpdF0gPSB0cnVlO1xuICByZWFkb25seVtVc2VzVmFyT2Zmc2V0XSA9IHRydWU7XG5cbiAgdmFyT2Zmc2V0OiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBleHByZXNzaW9uIHdoaWNoIHNob3VsZCBiZSBtZW1vaXplZCBhcyBhIHB1cmUgY29tcHV0YXRpb24uXG4gICAqXG4gICAqIFRoaXMgZXhwcmVzc2lvbiBjb250YWlucyBpbnRlcm5hbCBgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcmBzLCB3aGljaCBhcmUgcGxhY2Vob2xkZXJzIGZvciB0aGVcbiAgICogcG9zaXRpb25hbCBhcmd1bWVudCBleHByZXNzaW9ucyBpbiBgYXJncy5cbiAgICovXG4gIGJvZHk6IG8uRXhwcmVzc2lvbnxudWxsO1xuXG4gIC8qKlxuICAgKiBQb3NpdGlvbmFsIGFyZ3VtZW50cyB0byB0aGUgcHVyZSBmdW5jdGlvbiB3aGljaCB3aWxsIG1lbW9pemUgdGhlIGBib2R5YCBleHByZXNzaW9uLCB3aGljaCBhY3RcbiAgICogYXMgbWVtb2l6YXRpb24ga2V5cy5cbiAgICovXG4gIGFyZ3M6IG8uRXhwcmVzc2lvbltdO1xuXG4gIC8qKlxuICAgKiBPbmNlIGV4dHJhY3RlZCB0byB0aGUgYENvbnN0YW50UG9vbGAsIGEgcmVmZXJlbmNlIHRvIHRoZSBmdW5jdGlvbiB3aGljaCBkZWZpbmVzIHRoZSBjb21wdXRhdGlvblxuICAgKiBvZiBgYm9keWAuXG4gICAqL1xuICBmbjogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxudWxsLCBhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5ib2R5ID0gZXhwcmVzc2lvbjtcbiAgICB0aGlzLmFyZ3MgPSBhcmdzO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSkge1xuICAgIHRoaXMuYm9keT8udmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIGZvciAoY29uc3QgYXJnIG9mIHRoaXMuYXJncykge1xuICAgICAgYXJnLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQob3RoZXI6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmICghKG90aGVyIGluc3RhbmNlb2YgUHVyZUZ1bmN0aW9uRXhwcikgfHwgb3RoZXIuYXJncy5sZW5ndGggIT09IHRoaXMuYXJncy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gb3RoZXIuYm9keSAhPT0gbnVsbCAmJiB0aGlzLmJvZHkgIT09IG51bGwgJiYgb3RoZXIuYm9keS5pc0VxdWl2YWxlbnQodGhpcy5ib2R5KSAmJlxuICAgICAgICBvdGhlci5hcmdzLmV2ZXJ5KChhcmcsIGlkeCkgPT4gYXJnLmlzRXF1aXZhbGVudCh0aGlzLmFyZ3NbaWR4XSkpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICBpZiAodGhpcy5ib2R5ICE9PSBudWxsKSB7XG4gICAgICAvLyBUT0RPOiBmaWd1cmUgb3V0IGlmIHRoaXMgaXMgdGhlIHJpZ2h0IGZsYWcgdG8gcGFzcyBoZXJlLlxuICAgICAgdGhpcy5ib2R5ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oXG4gICAgICAgICAgdGhpcy5ib2R5LCB0cmFuc2Zvcm0sIGZsYWdzIHwgVmlzaXRvckNvbnRleHRGbGFnLkluQ2hpbGRPcGVyYXRpb24pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5mbiAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5mbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuZm4sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLmFyZ3NbaV0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmFyZ3NbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFB1cmVGdW5jdGlvbkV4cHIge1xuICAgIGNvbnN0IGV4cHIgPVxuICAgICAgICBuZXcgUHVyZUZ1bmN0aW9uRXhwcih0aGlzLmJvZHk/LmNsb25lKCkgPz8gbnVsbCwgdGhpcy5hcmdzLm1hcChhcmcgPT4gYXJnLmNsb25lKCkpKTtcbiAgICBleHByLmZuID0gdGhpcy5mbj8uY2xvbmUoKSA/PyBudWxsO1xuICAgIGV4cHIudmFyT2Zmc2V0ID0gdGhpcy52YXJPZmZzZXQ7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5QdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBpbmRleDogbnVtYmVyKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KG90aGVyOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gb3RoZXIgaW5zdGFuY2VvZiBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByICYmIG90aGVyLmluZGV4ID09PSB0aGlzLmluZGV4O1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIge1xuICAgIHJldHVybiBuZXcgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcih0aGlzLmluZGV4KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGlwZUJpbmRpbmdFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2UgaW1wbGVtZW50cyBDb25zdW1lc1ZhcnNUcmFpdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFVzZXNWYXJPZmZzZXRUcmFpdCB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5QaXBlQmluZGluZztcbiAgcmVhZG9ubHlbQ29uc3VtZXNWYXJzVHJhaXRdID0gdHJ1ZTtcbiAgcmVhZG9ubHlbVXNlc1Zhck9mZnNldF0gPSB0cnVlO1xuXG4gIHZhck9mZnNldDogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgdGFyZ2V0OiBYcmVmSWQsIHJlYWRvbmx5IHRhcmdldFNsb3Q6IFNsb3RIYW5kbGUsIHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcbiAgICAgIHJlYWRvbmx5IGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGFyZyBvZiB0aGlzLmFyZ3MpIHtcbiAgICAgIGFyZy52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgdGhpcy5hcmdzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIHRoaXMuYXJnc1tpZHhdID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5hcmdzW2lkeF0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCkge1xuICAgIGNvbnN0IHIgPVxuICAgICAgICBuZXcgUGlwZUJpbmRpbmdFeHByKHRoaXMudGFyZ2V0LCB0aGlzLnRhcmdldFNsb3QsIHRoaXMubmFtZSwgdGhpcy5hcmdzLm1hcChhID0+IGEuY2xvbmUoKSkpO1xuICAgIHIudmFyT2Zmc2V0ID0gdGhpcy52YXJPZmZzZXQ7XG4gICAgcmV0dXJuIHI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBpcGVCaW5kaW5nVmFyaWFkaWNFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2UgaW1wbGVtZW50cyBDb25zdW1lc1ZhcnNUcmFpdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVXNlc1Zhck9mZnNldFRyYWl0IHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nVmFyaWFkaWM7XG4gIHJlYWRvbmx5W0NvbnN1bWVzVmFyc1RyYWl0XSA9IHRydWU7XG4gIHJlYWRvbmx5W1VzZXNWYXJPZmZzZXRdID0gdHJ1ZTtcblxuICB2YXJPZmZzZXQ6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IHRhcmdldDogWHJlZklkLCByZWFkb25seSB0YXJnZXRTbG90OiBTbG90SGFuZGxlLCByZWFkb25seSBuYW1lOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgYXJnczogby5FeHByZXNzaW9uLCBwdWJsaWMgbnVtQXJnczogbnVtYmVyKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLmFyZ3MudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5hcmdzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5hcmdzLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFBpcGVCaW5kaW5nVmFyaWFkaWNFeHByIHtcbiAgICBjb25zdCByID0gbmV3IFBpcGVCaW5kaW5nVmFyaWFkaWNFeHByKFxuICAgICAgICB0aGlzLnRhcmdldCwgdGhpcy50YXJnZXRTbG90LCB0aGlzLm5hbWUsIHRoaXMuYXJncy5jbG9uZSgpLCB0aGlzLm51bUFyZ3MpO1xuICAgIHIudmFyT2Zmc2V0ID0gdGhpcy52YXJPZmZzZXQ7XG4gICAgcmV0dXJuIHI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNhZmVQcm9wZXJ0eVJlYWRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuU2FmZVByb3BlcnR5UmVhZDtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiwgcHVibGljIG5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBbiBhbGlhcyBmb3IgbmFtZSwgd2hpY2ggYWxsb3dzIG90aGVyIGxvZ2ljIHRvIGhhbmRsZSBwcm9wZXJ0eSByZWFkcyBhbmQga2V5ZWQgcmVhZHMgdG9nZXRoZXIuXG4gIGdldCBpbmRleCgpIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZcKgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5yZWNlaXZlciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMucmVjZWl2ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogU2FmZVByb3BlcnR5UmVhZEV4cHIge1xuICAgIHJldHVybiBuZXcgU2FmZVByb3BlcnR5UmVhZEV4cHIodGhpcy5yZWNlaXZlci5jbG9uZSgpLCB0aGlzLm5hbWUpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTYWZlS2V5ZWRSZWFkRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlNhZmVLZXllZFJlYWQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgcmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiwgcHVibGljIGluZGV4OiBvLkV4cHJlc3Npb24sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgc3VwZXIoc291cmNlU3Bhbik7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB0aGlzLmluZGV4LnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgdGhpcy5pbmRleCA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuaW5kZXgsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogU2FmZUtleWVkUmVhZEV4cHIge1xuICAgIHJldHVybiBuZXcgU2FmZUtleWVkUmVhZEV4cHIodGhpcy5yZWNlaXZlci5jbG9uZSgpLCB0aGlzLmluZGV4LmNsb25lKCksIHRoaXMuc291cmNlU3Bhbik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNhZmVJbnZva2VGdW5jdGlvbkV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5TYWZlSW52b2tlRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3IocHVibGljIHJlY2VpdmVyOiBvLkV4cHJlc3Npb24sIHB1YmxpYyBhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICBmb3IgKGNvbnN0IGEgb2YgdGhpcy5hcmdzKSB7XG4gICAgICBhLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZcKgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5yZWNlaXZlciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMucmVjZWl2ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLmFyZ3NbaV0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmFyZ3NbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFNhZmVJbnZva2VGdW5jdGlvbkV4cHIge1xuICAgIHJldHVybiBuZXcgU2FmZUludm9rZUZ1bmN0aW9uRXhwcih0aGlzLnJlY2VpdmVyLmNsb25lKCksIHRoaXMuYXJncy5tYXAoYSA9PiBhLmNsb25lKCkpKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2FmZVRlcm5hcnlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuU2FmZVRlcm5hcnlFeHByO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBndWFyZDogby5FeHByZXNzaW9uLCBwdWJsaWMgZXhwcjogby5FeHByZXNzaW9uKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMuZ3VhcmQudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIHRoaXMuZXhwci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZcKgaXNFcXVpdmFsZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5ndWFyZCA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuZ3VhcmQsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIHRoaXMuZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuZXhwciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBTYWZlVGVybmFyeUV4cHIge1xuICAgIHJldHVybiBuZXcgU2FmZVRlcm5hcnlFeHByKHRoaXMuZ3VhcmQuY2xvbmUoKSwgdGhpcy5leHByLmNsb25lKCkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbXB0eUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5FbXB0eUV4cHI7XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBFbXB0eUV4cHI7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogRW1wdHlFeHByIHtcbiAgICByZXR1cm4gbmV3IEVtcHR5RXhwcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBBc3NpZ25UZW1wb3JhcnlFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuQXNzaWduVGVtcG9yYXJ5RXhwcjtcblxuICBwdWJsaWMgbmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBleHByOiBvLkV4cHJlc3Npb24sIHB1YmxpYyB4cmVmOiBYcmVmSWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5leHByLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogQXNzaWduVGVtcG9yYXJ5RXhwciB7XG4gICAgY29uc3QgYSA9IG5ldyBBc3NpZ25UZW1wb3JhcnlFeHByKHRoaXMuZXhwci5jbG9uZSgpLCB0aGlzLnhyZWYpO1xuICAgIGEubmFtZSA9IHRoaXMubmFtZTtcbiAgICByZXR1cm4gYTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVhZFRlbXBvcmFyeUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5SZWFkVGVtcG9yYXJ5RXhwcjtcblxuICBwdWJsaWMgbmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB4cmVmOiBYcmVmSWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMueHJlZiA9PT0gdGhpcy54cmVmO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVhZFRlbXBvcmFyeUV4cHIge1xuICAgIGNvbnN0IHIgPSBuZXcgUmVhZFRlbXBvcmFyeUV4cHIodGhpcy54cmVmKTtcbiAgICByLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgcmV0dXJuIHI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNsb3RMaXRlcmFsRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlNsb3RMaXRlcmFsRXhwcjtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSBzbG90OiBTbG90SGFuZGxlKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgU2xvdExpdGVyYWxFeHByICYmIGUuc2xvdCA9PT0gdGhpcy5zbG90O1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFNsb3RMaXRlcmFsRXhwciB7XG4gICAgcmV0dXJuIG5ldyBTbG90TGl0ZXJhbEV4cHIodGhpcy5zbG90KTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxufVxuXG5leHBvcnQgY2xhc3MgQ29uZGl0aW9uYWxDYXNlRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkNvbmRpdGlvbmFsQ2FzZTtcblxuICAvKipcbiAgICogQ3JlYXRlIGFuIGV4cHJlc3Npb24gZm9yIG9uZSBicmFuY2ggb2YgYSBjb25kaXRpb25hbC5cbiAgICogQHBhcmFtIGV4cHIgVGhlIGV4cHJlc3Npb24gdG8gYmUgdGVzdGVkIGZvciB0aGlzIGNhc2UuIE1pZ2h0IGJlIG51bGwsIGFzIGluIGFuIGBlbHNlYCBjYXNlLlxuICAgKiBAcGFyYW0gdGFyZ2V0IFRoZSBYcmVmIG9mIHRoZSB2aWV3IHRvIGJlIGRpc3BsYXllZCBpZiB0aGlzIGNvbmRpdGlvbiBpcyB0cnVlLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgZXhwcjogby5FeHByZXNzaW9ufG51bGwsIHJlYWRvbmx5IHRhcmdldDogWHJlZklkLCByZWFkb25seSB0YXJnZXRTbG90OiBTbG90SGFuZGxlLFxuICAgICAgcmVhZG9ubHkgYWxpYXM6IHQuVmFyaWFibGV8bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKHRoaXMuZXhwciAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5leHByLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQ29uZGl0aW9uYWxDYXNlRXhwciAmJiBlLmV4cHIgPT09IHRoaXMuZXhwcjtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBDb25kaXRpb25hbENhc2VFeHByIHtcbiAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsQ2FzZUV4cHIodGhpcy5leHByLCB0aGlzLnRhcmdldCwgdGhpcy50YXJnZXRTbG90KTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIGlmICh0aGlzLmV4cHIgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuZXhwciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIENvbnN0Q29sbGVjdGVkRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkNvbnN0Q29sbGVjdGVkO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBleHByOiBvLkV4cHJlc3Npb24pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgdGhpcy5leHByID0gdHJhbnNmb3JtKHRoaXMuZXhwciwgZmxhZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSkge1xuICAgIHRoaXMuZXhwci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKCEoZSBpbnN0YW5jZW9mIENvbnN0Q29sbGVjdGVkRXhwcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhwci5pc0VxdWl2YWxlbnQoZS5leHByKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuZXhwci5pc0NvbnN0YW50KCk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBDb25zdENvbGxlY3RlZEV4cHIge1xuICAgIHJldHVybiBuZXcgQ29uc3RDb2xsZWN0ZWRFeHByKHRoaXMuZXhwcik7XG4gIH1cbn1cblxuLyoqXG4gKiBWaXNpdHMgYWxsIGBFeHByZXNzaW9uYHMgaW4gdGhlIEFTVCBvZiBgb3BgIHdpdGggdGhlIGB2aXNpdG9yYCBmdW5jdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0RXhwcmVzc2lvbnNJbk9wKFxuICAgIG9wOiBDcmVhdGVPcHxVcGRhdGVPcCwgdmlzaXRvcjogKGV4cHI6IG8uRXhwcmVzc2lvbiwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZykgPT4gdm9pZCk6IHZvaWQge1xuICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIChleHByLCBmbGFncykgPT4ge1xuICAgIHZpc2l0b3IoZXhwciwgZmxhZ3MpO1xuICAgIHJldHVybiBleHByO1xuICB9LCBWaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG59XG5cbmV4cG9ydCBlbnVtIFZpc2l0b3JDb250ZXh0RmxhZyB7XG4gIE5vbmUgPSAwYjAwMDAsXG4gIEluQ2hpbGRPcGVyYXRpb24gPSAwYjAwMDEsXG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5JbnRlcnBvbGF0aW9uKFxuICAgIGludGVycG9sYXRpb246IEludGVycG9sYXRpb24sIHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZykge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGludGVycG9sYXRpb24uZXhwcmVzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zW2ldID1cbiAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbi5leHByZXNzaW9uc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYWxsIGBFeHByZXNzaW9uYHMgaW4gdGhlIEFTVCBvZiBgb3BgIHdpdGggdGhlIGB0cmFuc2Zvcm1gIGZ1bmN0aW9uLlxuICpcbiAqIEFsbCBzdWNoIG9wZXJhdGlvbnMgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZSByZXN1bHQgb2YgYXBwbHlpbmcgYHRyYW5zZm9ybWAsIHdoaWNoIG1heSBiZSBhblxuICogaWRlbnRpdHkgdHJhbnNmb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3AoXG4gICAgb3A6IENyZWF0ZU9wfFVwZGF0ZU9wLCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOiB2b2lkIHtcbiAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgY2FzZSBPcEtpbmQuU3R5bGVQcm9wOlxuICAgIGNhc2UgT3BLaW5kLlN0eWxlTWFwOlxuICAgIGNhc2UgT3BLaW5kLkNsYXNzUHJvcDpcbiAgICBjYXNlIE9wS2luZC5DbGFzc01hcDpcbiAgICBjYXNlIE9wS2luZC5CaW5kaW5nOlxuICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5JbnRlcnBvbGF0aW9uKG9wLmV4cHJlc3Npb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3AuZXhwcmVzc2lvbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLmV4cHJlc3Npb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuUHJvcGVydHk6XG4gICAgY2FzZSBPcEtpbmQuSG9zdFByb3BlcnR5OlxuICAgIGNhc2UgT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIG9wLnNhbml0aXplciA9XG4gICAgICAgICAgb3Auc2FuaXRpemVyICYmIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnNhbml0aXplciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5JMThuRXhwcmVzc2lvbjpcbiAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5JbnRlcnBvbGF0aW9uKG9wLmludGVycG9sYXRpb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuU3RhdGVtZW50OlxuICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJblN0YXRlbWVudChvcC5zdGF0ZW1lbnQsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuVmFyaWFibGU6XG4gICAgICBvcC5pbml0aWFsaXplciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLmluaXRpYWxpemVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkNvbmRpdGlvbmFsOlxuICAgICAgZm9yIChjb25zdCBjb25kaXRpb24gb2Ygb3AuY29uZGl0aW9ucykge1xuICAgICAgICBpZiAoY29uZGl0aW9uLmV4cHIgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZGVmYXVsdCBjYXNlLlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbmRpdGlvbi5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oY29uZGl0aW9uLmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgaWYgKG9wLnByb2Nlc3NlZCAhPT0gbnVsbCkge1xuICAgICAgICBvcC5wcm9jZXNzZWQgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5wcm9jZXNzZWQsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgaWYgKG9wLmNvbnRleHRWYWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICBvcC5jb250ZXh0VmFsdWUgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5jb250ZXh0VmFsdWUsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuTGlzdGVuZXI6XG4gICAgICBmb3IgKGNvbnN0IGlubmVyT3Agb2Ygb3AuaGFuZGxlck9wcykge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3AoaW5uZXJPcCwgdHJhbnNmb3JtLCBmbGFncyB8IFZpc2l0b3JDb250ZXh0RmxhZy5JbkNoaWxkT3BlcmF0aW9uKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkV4dHJhY3RlZEF0dHJpYnV0ZTpcbiAgICAgIG9wLmV4cHJlc3Npb24gPVxuICAgICAgICAgIG9wLmV4cHJlc3Npb24gJiYgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AuZXhwcmVzc2lvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBvcC50cnVzdGVkVmFsdWVGbiA9IG9wLnRydXN0ZWRWYWx1ZUZuICYmXG4gICAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AudHJ1c3RlZFZhbHVlRm4sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuUmVwZWF0ZXJDcmVhdGU6XG4gICAgICBvcC50cmFjayA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnRyYWNrLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGlmIChvcC50cmFja0J5Rm4gIT09IG51bGwpIHtcbiAgICAgICAgb3AudHJhY2tCeUZuID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AudHJhY2tCeUZuLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlJlcGVhdGVyOlxuICAgICAgb3AuY29sbGVjdGlvbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLmNvbGxlY3Rpb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuRGVmZXI6XG4gICAgICBpZiAob3AubG9hZGluZ0NvbmZpZyAhPT0gbnVsbCkge1xuICAgICAgICBvcC5sb2FkaW5nQ29uZmlnID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AubG9hZGluZ0NvbmZpZywgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBpZiAob3AucGxhY2Vob2xkZXJDb25maWcgIT09IG51bGwpIHtcbiAgICAgICAgb3AucGxhY2Vob2xkZXJDb25maWcgPVxuICAgICAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AucGxhY2Vob2xkZXJDb25maWcsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgaWYgKG9wLnJlc29sdmVyRm4gIT09IG51bGwpIHtcbiAgICAgICAgb3AucmVzb2x2ZXJGbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnJlc29sdmVyRm4sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuSTE4bk1lc3NhZ2U6XG4gICAgICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgZXhwcl0gb2Ygb3AucGFyYW1zKSB7XG4gICAgICAgIG9wLnBhcmFtcy5zZXQocGxhY2Vob2xkZXIsIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCBleHByXSBvZiBvcC5wb3N0cHJvY2Vzc2luZ1BhcmFtcykge1xuICAgICAgICBvcC5wb3N0cHJvY2Vzc2luZ1BhcmFtcy5zZXQoXG4gICAgICAgICAgICBwbGFjZWhvbGRlciwgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwciwgdHJhbnNmb3JtLCBmbGFncykpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuRGVmZXJXaGVuOlxuICAgICAgb3AuZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuQWR2YW5jZTpcbiAgICBjYXNlIE9wS2luZC5Db250YWluZXI6XG4gICAgY2FzZSBPcEtpbmQuQ29udGFpbmVyRW5kOlxuICAgIGNhc2UgT3BLaW5kLkNvbnRhaW5lclN0YXJ0OlxuICAgIGNhc2UgT3BLaW5kLkRlZmVyT246XG4gICAgY2FzZSBPcEtpbmQuRGlzYWJsZUJpbmRpbmdzOlxuICAgIGNhc2UgT3BLaW5kLkVsZW1lbnQ6XG4gICAgY2FzZSBPcEtpbmQuRWxlbWVudEVuZDpcbiAgICBjYXNlIE9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgY2FzZSBPcEtpbmQuRW5hYmxlQmluZGluZ3M6XG4gICAgY2FzZSBPcEtpbmQuSTE4bjpcbiAgICBjYXNlIE9wS2luZC5JMThuQXBwbHk6XG4gICAgY2FzZSBPcEtpbmQuSTE4bkNvbnRleHQ6XG4gICAgY2FzZSBPcEtpbmQuSTE4bkVuZDpcbiAgICBjYXNlIE9wS2luZC5JMThuU3RhcnQ6XG4gICAgY2FzZSBPcEtpbmQuSWN1RW5kOlxuICAgIGNhc2UgT3BLaW5kLkljdVN0YXJ0OlxuICAgIGNhc2UgT3BLaW5kLk5hbWVzcGFjZTpcbiAgICBjYXNlIE9wS2luZC5QaXBlOlxuICAgIGNhc2UgT3BLaW5kLlByb2plY3Rpb246XG4gICAgY2FzZSBPcEtpbmQuUHJvamVjdGlvbkRlZjpcbiAgICBjYXNlIE9wS2luZC5UZW1wbGF0ZTpcbiAgICBjYXNlIE9wS2luZC5UZXh0OlxuICAgIGNhc2UgT3BLaW5kLkkxOG5BdHRyaWJ1dGVzOlxuICAgIGNhc2UgT3BLaW5kLkljdVBsYWNlaG9sZGVyOlxuICAgICAgLy8gVGhlc2Ugb3BlcmF0aW9ucyBjb250YWluIG5vIGV4cHJlc3Npb25zLlxuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcCBkb2Vzbid0IGhhbmRsZSAke09wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbGwgYEV4cHJlc3Npb25gcyBpbiB0aGUgQVNUIG9mIGBleHByYCB3aXRoIHRoZSBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBBbGwgc3VjaCBvcGVyYXRpb25zIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGUgcmVzdWx0IG9mIGFwcGx5aW5nIGB0cmFuc2Zvcm1gLCB3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oXG4gICAgZXhwcjogby5FeHByZXNzaW9uLCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoZXhwciBpbnN0YW5jZW9mIEV4cHJlc3Npb25CYXNlKSB7XG4gICAgZXhwci50cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkJpbmFyeU9wZXJhdG9yRXhwcikge1xuICAgIGV4cHIubGhzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5saHMsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIucmhzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5yaHMsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLlVuYXJ5T3BlcmF0b3JFeHByKSB7XG4gICAgZXhwci5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5SZWFkUHJvcEV4cHIpIHtcbiAgICBleHByLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uUmVhZEtleUV4cHIpIHtcbiAgICBleHByLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZXhwci5pbmRleCA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuaW5kZXgsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLldyaXRlUHJvcEV4cHIpIHtcbiAgICBleHByLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZXhwci52YWx1ZSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIudmFsdWUsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLldyaXRlS2V5RXhwcikge1xuICAgIGV4cHIucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLmluZGV4ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5pbmRleCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZXhwci52YWx1ZSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIudmFsdWUsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkludm9rZUZ1bmN0aW9uRXhwcikge1xuICAgIGV4cHIuZm4gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmZuLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHIuYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgZXhwci5hcmdzW2ldID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5hcmdzW2ldLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbEFycmF5RXhwcikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwci5lbnRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBleHByLmVudHJpZXNbaV0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmVudHJpZXNbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5MaXRlcmFsTWFwRXhwcikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwci5lbnRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBleHByLmVudHJpZXNbaV0udmFsdWUgPVxuICAgICAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZW50cmllc1tpXS52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkNvbmRpdGlvbmFsRXhwcikge1xuICAgIGV4cHIuY29uZGl0aW9uID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5jb25kaXRpb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIudHJ1ZUNhc2UgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnRydWVDYXNlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBpZiAoZXhwci5mYWxzZUNhc2UgIT09IG51bGwpIHtcbiAgICAgIGV4cHIuZmFsc2VDYXNlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5mYWxzZUNhc2UsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5UeXBlb2ZFeHByKSB7XG4gICAgZXhwci5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5Xcml0ZVZhckV4cHIpIHtcbiAgICBleHByLnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uTG9jYWxpemVkU3RyaW5nKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByLmV4cHJlc3Npb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBleHByLmV4cHJlc3Npb25zW2ldID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5leHByZXNzaW9uc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLk5vdEV4cHIpIHtcbiAgICBleHByLmNvbmRpdGlvbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuY29uZGl0aW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5UYWdnZWRUZW1wbGF0ZUV4cHIpIHtcbiAgICBleHByLnRhZyA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIudGFnLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLnRlbXBsYXRlLmV4cHJlc3Npb25zID1cbiAgICAgICAgZXhwci50ZW1wbGF0ZS5leHByZXNzaW9ucy5tYXAoZSA9PiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihlLCB0cmFuc2Zvcm0sIGZsYWdzKSk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uQXJyb3dGdW5jdGlvbkV4cHIpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShleHByLmJvZHkpKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHIuYm9keS5sZW5ndGg7IGkrKykge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luU3RhdGVtZW50KGV4cHIuYm9keVtpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cHIuYm9keSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuYm9keSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLldyYXBwZWROb2RlRXhwcikge1xuICAgIC8vIFRPRE86IERvIHdlIG5lZWQgdG8gdHJhbnNmb3JtIGFueSBUUyBub2RlcyBuZXN0ZWQgaW5zaWRlIG9mIHRoaXMgZXhwcmVzc2lvbj9cbiAgfSBlbHNlIGlmIChcbiAgICAgIGV4cHIgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByIHx8IGV4cHIgaW5zdGFuY2VvZiBvLkV4dGVybmFsRXhwciB8fFxuICAgICAgZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIpIHtcbiAgICAvLyBObyBhY3Rpb24gZm9yIHRoZXNlIHR5cGVzLlxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIGV4cHJlc3Npb24ga2luZDogJHtleHByLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbiAgcmV0dXJuIHRyYW5zZm9ybShleHByLCBmbGFncyk7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIGFsbCBgRXhwcmVzc2lvbmBzIGluIHRoZSBBU1Qgb2YgYHN0bXRgIHdpdGggdGhlIGB0cmFuc2Zvcm1gIGZ1bmN0aW9uLlxuICpcbiAqIEFsbCBzdWNoIG9wZXJhdGlvbnMgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZSByZXN1bHQgb2YgYXBwbHlpbmcgYHRyYW5zZm9ybWAsIHdoaWNoIG1heSBiZSBhblxuICogaWRlbnRpdHkgdHJhbnNmb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luU3RhdGVtZW50KFxuICAgIHN0bXQ6IG8uU3RhdGVtZW50LCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOiB2b2lkIHtcbiAgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQpIHtcbiAgICBzdG10LmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihzdG10LmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLlJldHVyblN0YXRlbWVudCkge1xuICAgIHN0bXQudmFsdWUgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihzdG10LnZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChzdG10IGluc3RhbmNlb2Ygby5EZWNsYXJlVmFyU3RtdCkge1xuICAgIGlmIChzdG10LnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHN0bXQudmFsdWUgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihzdG10LnZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uSWZTdG10KSB7XG4gICAgc3RtdC5jb25kaXRpb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihzdG10LmNvbmRpdGlvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZm9yIChjb25zdCBjYXNlU3RhdGVtZW50IG9mIHN0bXQudHJ1ZUNhc2UpIHtcbiAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5TdGF0ZW1lbnQoY2FzZVN0YXRlbWVudCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgY2FzZVN0YXRlbWVudCBvZiBzdG10LmZhbHNlQ2FzZSkge1xuICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJblN0YXRlbWVudChjYXNlU3RhdGVtZW50LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmhhbmRsZWQgc3RhdGVtZW50IGtpbmQ6ICR7c3RtdC5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIGV4cHJlc3Npb24gaXMgYSBzdHJpbmcgbGl0ZXJhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU3RyaW5nTGl0ZXJhbChleHByOiBvLkV4cHJlc3Npb24pOiBleHByIGlzIG8uTGl0ZXJhbEV4cHIme3ZhbHVlOiBzdHJpbmd9IHtcbiAgcmV0dXJuIGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByICYmIHR5cGVvZiBleHByLnZhbHVlID09PSAnc3RyaW5nJztcbn1cbiJdfQ==