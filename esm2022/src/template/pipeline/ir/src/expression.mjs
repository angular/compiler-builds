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
export class DerivedRepeaterVarExpr extends ExpressionBase {
    constructor(xref, identity) {
        super();
        this.xref = xref;
        this.identity = identity;
        this.kind = ExpressionKind.DerivedRepeaterVar;
    }
    transformInternalExpressions(transform, flags) { }
    visitExpression(visitor, context) { }
    isEquivalent(e) {
        return e instanceof DerivedRepeaterVarExpr && e.identity === this.identity &&
            e.xref === this.xref;
    }
    isConstant() {
        return false;
    }
    clone() {
        return new DerivedRepeaterVarExpr(this.xref, this.identity);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvZXhwcmVzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUluRCxPQUFPLEVBQTZCLGNBQWMsRUFBRSxNQUFNLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFJM0UsT0FBTyxFQUFDLGFBQWEsRUFBZ0IsTUFBTSxjQUFjLENBQUM7QUFDMUQsT0FBTyxFQUFDLGlCQUFpQixFQUFFLGFBQWEsRUFBcUIsTUFBTSxVQUFVLENBQUM7QUFpQjlFOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGNBQWMsQ0FBQyxJQUFrQjtJQUMvQyxPQUFPLElBQUksWUFBWSxjQUFjLENBQUM7QUFDeEMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxPQUFnQixjQUFlLFNBQVEsQ0FBQyxDQUFDLFVBQVU7SUFHdkQsWUFBWSxhQUFtQyxJQUFJO1FBQ2pELEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDMUIsQ0FBQztDQVFGO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sZUFBZ0IsU0FBUSxjQUFjO0lBR2pELFlBQXFCLElBQVk7UUFDL0IsS0FBSyxFQUFFLENBQUM7UUFEVyxTQUFJLEdBQUosSUFBSSxDQUFRO1FBRmYsU0FBSSxHQUFHLGNBQWMsQ0FBQyxXQUFXLENBQUM7SUFJcEQsQ0FBQztJQUVRLGVBQWUsQ0FBQyxPQUE0QixFQUFFLE9BQVksSUFBUyxDQUFDO0lBRXBFLFlBQVksQ0FBQyxLQUFzQjtRQUMxQywwRkFBMEY7UUFDMUYsZ0NBQWdDO1FBQ2hDLGdDQUFnQztRQUNoQyxPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLElBQUksQ0FB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QUFVLGVBQWUsQ0FBQyxJQUFrQjtJQUNoRCxPQUFPLElBQUksWUFBWSxDQUFDLENBQUMsV0FBVyxJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxRQUFRLENBQUM7QUFDekUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB0eXBlIHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uLy4uLy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uLy4uLy4uLy4uL3JlbmRlcjMvcjNfYXN0JztcbmltcG9ydCB7RGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHksIEV4cHJlc3Npb25LaW5kLCBPcEtpbmR9IGZyb20gJy4vZW51bXMnO1xuaW1wb3J0IHtTbG90SGFuZGxlfSBmcm9tICcuL2hhbmRsZSc7XG5pbXBvcnQgdHlwZSB7WHJlZklkfSBmcm9tICcuL29wZXJhdGlvbnMnO1xuaW1wb3J0IHR5cGUge0NyZWF0ZU9wfSBmcm9tICcuL29wcy9jcmVhdGUnO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uLCB0eXBlIFVwZGF0ZU9wfSBmcm9tICcuL29wcy91cGRhdGUnO1xuaW1wb3J0IHtDb25zdW1lc1ZhcnNUcmFpdCwgVXNlc1Zhck9mZnNldCwgVXNlc1Zhck9mZnNldFRyYWl0fSBmcm9tICcuL3RyYWl0cyc7XG5cbi8qKlxuICogQW4gYG8uRXhwcmVzc2lvbmAgc3VidHlwZSByZXByZXNlbnRpbmcgYSBsb2dpY2FsIGV4cHJlc3Npb24gaW4gdGhlIGludGVybWVkaWF0ZSByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IHR5cGUgRXhwcmVzc2lvbiA9IExleGljYWxSZWFkRXhwcnxSZWZlcmVuY2VFeHByfENvbnRleHRFeHByfE5leHRDb250ZXh0RXhwcnxcbiAgICBHZXRDdXJyZW50Vmlld0V4cHJ8UmVzdG9yZVZpZXdFeHByfFJlc2V0Vmlld0V4cHJ8UmVhZFZhcmlhYmxlRXhwcnxQdXJlRnVuY3Rpb25FeHByfFxuICAgIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHJ8UGlwZUJpbmRpbmdFeHByfFBpcGVCaW5kaW5nVmFyaWFkaWNFeHByfFNhZmVQcm9wZXJ0eVJlYWRFeHByfFxuICAgIFNhZmVLZXllZFJlYWRFeHByfFNhZmVJbnZva2VGdW5jdGlvbkV4cHJ8RW1wdHlFeHByfEFzc2lnblRlbXBvcmFyeUV4cHJ8UmVhZFRlbXBvcmFyeUV4cHJ8XG4gICAgU2xvdExpdGVyYWxFeHByfENvbmRpdGlvbmFsQ2FzZUV4cHJ8RGVyaXZlZFJlcGVhdGVyVmFyRXhwcnxDb25zdENvbGxlY3RlZEV4cHI7XG5cbi8qKlxuICogVHJhbnNmb3JtZXIgdHlwZSB3aGljaCBjb252ZXJ0cyBleHByZXNzaW9ucyBpbnRvIGdlbmVyYWwgYG8uRXhwcmVzc2lvbmBzICh3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uKS5cbiAqL1xuZXhwb3J0IHR5cGUgRXhwcmVzc2lvblRyYW5zZm9ybSA9IChleHByOiBvLkV4cHJlc3Npb24sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpID0+IG8uRXhwcmVzc2lvbjtcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIGEgZ2l2ZW4gYG8uRXhwcmVzc2lvbmAgaXMgYSBsb2dpY2FsIElSIGV4cHJlc3Npb24gdHlwZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzSXJFeHByZXNzaW9uKGV4cHI6IG8uRXhwcmVzc2lvbik6IGV4cHIgaXMgRXhwcmVzc2lvbiB7XG4gIHJldHVybiBleHByIGluc3RhbmNlb2YgRXhwcmVzc2lvbkJhc2U7XG59XG5cbi8qKlxuICogQmFzZSB0eXBlIHVzZWQgZm9yIGFsbCBsb2dpY2FsIElSIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXhwcmVzc2lvbkJhc2UgZXh0ZW5kcyBvLkV4cHJlc3Npb24ge1xuICBhYnN0cmFjdCByZWFkb25seSBraW5kOiBFeHByZXNzaW9uS2luZDtcblxuICBjb25zdHJ1Y3Rvcihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcihudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSdW4gdGhlIHRyYW5zZm9ybWVyIGFnYWluc3QgYW55IG5lc3RlZCBleHByZXNzaW9ucyB3aGljaCBtYXkgYmUgcHJlc2VudCBpbiB0aGlzIElSIGV4cHJlc3Npb25cbiAgICogc3VidHlwZS5cbiAgICovXG4gIGFic3RyYWN0IHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQ7XG59XG5cbi8qKlxuICogTG9naWNhbCBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIGxleGljYWwgcmVhZCBvZiBhIHZhcmlhYmxlIG5hbWUuXG4gKi9cbmV4cG9ydCBjbGFzcyBMZXhpY2FsUmVhZEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5MZXhpY2FsUmVhZDtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSBuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IHZvaWQge31cblxuICBvdmVycmlkZcKgaXNFcXVpdmFsZW50KG90aGVyOiBMZXhpY2FsUmVhZEV4cHIpOiBib29sZWFuIHtcbiAgICAvLyBXZSBhc3N1bWUgdGhhdCB0aGUgbGV4aWNhbCByZWFkcyBhcmUgaW4gdGhlIHNhbWUgY29udGV4dCwgd2hpY2ggbXVzdCBiZSB0cnVlIGZvciBwYXJlbnRcbiAgICAvLyBleHByZXNzaW9ucyB0byBiZSBlcXVpdmFsZW50LlxuICAgIC8vIFRPRE86IGlzIHRoaXMgZ2VuZXJhbGx5IHNhZmU/XG4gICAgcmV0dXJuIHRoaXMubmFtZSA9PT0gb3RoZXIubmFtZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogTGV4aWNhbFJlYWRFeHByIHtcbiAgICByZXR1cm4gbmV3IExleGljYWxSZWFkRXhwcih0aGlzLm5hbWUpO1xuICB9XG59XG5cbi8qKlxuICogUnVudGltZSBvcGVyYXRpb24gdG8gcmV0cmlldmUgdGhlIHZhbHVlIG9mIGEgbG9jYWwgcmVmZXJlbmNlLlxuICovXG5leHBvcnQgY2xhc3MgUmVmZXJlbmNlRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlZmVyZW5jZTtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSB0YXJnZXQ6IFhyZWZJZCwgcmVhZG9ubHkgdGFyZ2V0U2xvdDogU2xvdEhhbmRsZSwgcmVhZG9ubHkgb2Zmc2V0OiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZWZlcmVuY2VFeHByICYmIGUudGFyZ2V0ID09PSB0aGlzLnRhcmdldDtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVmZXJlbmNlRXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZWZlcmVuY2VFeHByKHRoaXMudGFyZ2V0LCB0aGlzLnRhcmdldFNsb3QsIHRoaXMub2Zmc2V0KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCAodXN1YWxseSB0aGUgYGN0eGAgdmFyaWFibGUgaW4gYSB0ZW1wbGF0ZSBmdW5jdGlvbikuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb250ZXh0RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkNvbnRleHQ7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdmlldzogWHJlZklkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQ29udGV4dEV4cHIgJiYgZS52aWV3ID09PSB0aGlzLnZpZXc7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IENvbnRleHRFeHByIHtcbiAgICByZXR1cm4gbmV3IENvbnRleHRFeHByKHRoaXMudmlldyk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQgaW5zaWRlIGEgdHJhY2sgZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBUcmFja0NvbnRleHRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuVHJhY2tDb250ZXh0O1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHZpZXc6IFhyZWZJZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24oKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFRyYWNrQ29udGV4dEV4cHIgJiYgZS52aWV3ID09PSB0aGlzLnZpZXc7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFRyYWNrQ29udGV4dEV4cHIge1xuICAgIHJldHVybiBuZXcgVHJhY2tDb250ZXh0RXhwcih0aGlzLnZpZXcpO1xuICB9XG59XG5cbi8qKlxuICogUnVudGltZSBvcGVyYXRpb24gdG8gbmF2aWdhdGUgdG8gdGhlIG5leHQgdmlldyBjb250ZXh0IGluIHRoZSB2aWV3IGhpZXJhcmNoeS5cbiAqL1xuZXhwb3J0IGNsYXNzIE5leHRDb250ZXh0RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLk5leHRDb250ZXh0O1xuXG4gIHN0ZXBzID0gMTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBOZXh0Q29udGV4dEV4cHIgJiYgZS5zdGVwcyA9PT0gdGhpcy5zdGVwcztcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogTmV4dENvbnRleHRFeHByIHtcbiAgICBjb25zdCBleHByID0gbmV3IE5leHRDb250ZXh0RXhwcigpO1xuICAgIGV4cHIuc3RlcHMgPSB0aGlzLnN0ZXBzO1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbi8qKlxuICogUnVudGltZSBvcGVyYXRpb24gdG8gc25hcHNob3QgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICpcbiAqIFRoZSByZXN1bHQgb2YgdGhpcyBvcGVyYXRpb24gY2FuIGJlIHN0b3JlZCBpbiBhIHZhcmlhYmxlIGFuZCBsYXRlciB1c2VkIHdpdGggdGhlIGBSZXN0b3JlVmlld2BcbiAqIG9wZXJhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIEdldEN1cnJlbnRWaWV3RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkdldEN1cnJlbnRWaWV3O1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24oKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEdldEN1cnJlbnRWaWV3RXhwcjtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogR2V0Q3VycmVudFZpZXdFeHByIHtcbiAgICByZXR1cm4gbmV3IEdldEN1cnJlbnRWaWV3RXhwcigpO1xuICB9XG59XG5cbi8qKlxuICogUnVudGltZSBvcGVyYXRpb24gdG8gcmVzdG9yZSBhIHNuYXBzaG90dGVkIHZpZXcuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXN0b3JlVmlld0V4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5SZXN0b3JlVmlldztcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmlldzogWHJlZklkfG8uRXhwcmVzc2lvbikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogdm9pZCB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLnZpZXcgIT09ICdudW1iZXInKSB7XG4gICAgICB0aGlzLnZpZXcudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICBpZiAoIShlIGluc3RhbmNlb2YgUmVzdG9yZVZpZXdFeHByKSB8fCB0eXBlb2YgZS52aWV3ICE9PSB0eXBlb2YgdGhpcy52aWV3KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0aGlzLnZpZXcgPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gdGhpcy52aWV3ID09PSBlLnZpZXc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnZpZXcuaXNFcXVpdmFsZW50KGUudmlldyBhcyBvLkV4cHJlc3Npb24pO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLnZpZXcgIT09ICdudW1iZXInKSB7XG4gICAgICB0aGlzLnZpZXcgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLnZpZXcsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFJlc3RvcmVWaWV3RXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZXN0b3JlVmlld0V4cHIodGhpcy52aWV3IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uID8gdGhpcy52aWV3LmNsb25lKCkgOiB0aGlzLnZpZXcpO1xuICB9XG59XG5cbi8qKlxuICogUnVudGltZSBvcGVyYXRpb24gdG8gcmVzZXQgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0IGFmdGVyIGBSZXN0b3JlVmlld2AuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXNldFZpZXdFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUmVzZXRWaWV3O1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBleHByOiBvLkV4cHJlc3Npb24pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5leHByLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFJlc2V0Vmlld0V4cHIgJiYgdGhpcy5leHByLmlzRXF1aXZhbGVudChlLmV4cHIpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVzZXRWaWV3RXhwciB7XG4gICAgcmV0dXJuIG5ldyBSZXNldFZpZXdFeHByKHRoaXMuZXhwci5jbG9uZSgpKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlYWQgb2YgYSB2YXJpYWJsZSBkZWNsYXJlZCBhcyBhbiBgaXIuVmFyaWFibGVPcGAgYW5kIHJlZmVyZW5jZWQgdGhyb3VnaCBpdHMgYGlyLlhyZWZJZGAuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWFkVmFyaWFibGVFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUmVhZFZhcmlhYmxlO1xuICBuYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHhyZWY6IFhyZWZJZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24oKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChvdGhlcjogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIG90aGVyIGluc3RhbmNlb2YgUmVhZFZhcmlhYmxlRXhwciAmJiBvdGhlci54cmVmID09PSB0aGlzLnhyZWY7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFJlYWRWYXJpYWJsZUV4cHIge1xuICAgIGNvbnN0IGV4cHIgPSBuZXcgUmVhZFZhcmlhYmxlRXhwcih0aGlzLnhyZWYpO1xuICAgIGV4cHIubmFtZSA9IHRoaXMubmFtZTtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHVyZUZ1bmN0aW9uRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIGltcGxlbWVudHMgQ29uc3VtZXNWYXJzVHJhaXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVXNlc1Zhck9mZnNldFRyYWl0IHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI7XG4gIHJlYWRvbmx5W0NvbnN1bWVzVmFyc1RyYWl0XSA9IHRydWU7XG4gIHJlYWRvbmx5W1VzZXNWYXJPZmZzZXRdID0gdHJ1ZTtcblxuICB2YXJPZmZzZXQ6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogVGhlIGV4cHJlc3Npb24gd2hpY2ggc2hvdWxkIGJlIG1lbW9pemVkIGFzIGEgcHVyZSBjb21wdXRhdGlvbi5cbiAgICpcbiAgICogVGhpcyBleHByZXNzaW9uIGNvbnRhaW5zIGludGVybmFsIGBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByYHMsIHdoaWNoIGFyZSBwbGFjZWhvbGRlcnMgZm9yIHRoZVxuICAgKiBwb3NpdGlvbmFsIGFyZ3VtZW50IGV4cHJlc3Npb25zIGluIGBhcmdzLlxuICAgKi9cbiAgYm9keTogby5FeHByZXNzaW9ufG51bGw7XG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uYWwgYXJndW1lbnRzIHRvIHRoZSBwdXJlIGZ1bmN0aW9uIHdoaWNoIHdpbGwgbWVtb2l6ZSB0aGUgYGJvZHlgIGV4cHJlc3Npb24sIHdoaWNoIGFjdFxuICAgKiBhcyBtZW1vaXphdGlvbiBrZXlzLlxuICAgKi9cbiAgYXJnczogby5FeHByZXNzaW9uW107XG5cbiAgLyoqXG4gICAqIE9uY2UgZXh0cmFjdGVkIHRvIHRoZSBgQ29uc3RhbnRQb29sYCwgYSByZWZlcmVuY2UgdG8gdGhlIGZ1bmN0aW9uIHdoaWNoIGRlZmluZXMgdGhlIGNvbXB1dGF0aW9uXG4gICAqIG9mIGBib2R5YC5cbiAgICovXG4gIGZuOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoZXhwcmVzc2lvbjogby5FeHByZXNzaW9ufG51bGwsIGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmJvZHkgPSBleHByZXNzaW9uO1xuICAgIHRoaXMuYXJncyA9IGFyZ3M7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy5ib2R5Py52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgZm9yIChjb25zdCBhcmcgb2YgdGhpcy5hcmdzKSB7XG4gICAgICBhcmcudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChvdGhlcjogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKCEob3RoZXIgaW5zdGFuY2VvZiBQdXJlRnVuY3Rpb25FeHByKSB8fCBvdGhlci5hcmdzLmxlbmd0aCAhPT0gdGhpcy5hcmdzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBvdGhlci5ib2R5ICE9PSBudWxsICYmIHRoaXMuYm9keSAhPT0gbnVsbCAmJiBvdGhlci5ib2R5LmlzRXF1aXZhbGVudCh0aGlzLmJvZHkpICYmXG4gICAgICAgIG90aGVyLmFyZ3MuZXZlcnkoKGFyZywgaWR4KSA9PiBhcmcuaXNFcXVpdmFsZW50KHRoaXMuYXJnc1tpZHhdKSk7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIGlmICh0aGlzLmJvZHkgIT09IG51bGwpIHtcbiAgICAgIC8vIFRPRE86IGZpZ3VyZSBvdXQgaWYgdGhpcyBpcyB0aGUgcmlnaHQgZmxhZyB0byBwYXNzIGhlcmUuXG4gICAgICB0aGlzLmJvZHkgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihcbiAgICAgICAgICB0aGlzLmJvZHksIHRyYW5zZm9ybSwgZmxhZ3MgfCBWaXNpdG9yQ29udGV4dEZsYWcuSW5DaGlsZE9wZXJhdGlvbik7XG4gICAgfSBlbHNlIGlmICh0aGlzLmZuICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmZuID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5mbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuYXJnc1tpXSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuYXJnc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUHVyZUZ1bmN0aW9uRXhwciB7XG4gICAgY29uc3QgZXhwciA9XG4gICAgICAgIG5ldyBQdXJlRnVuY3Rpb25FeHByKHRoaXMuYm9keT8uY2xvbmUoKSA/PyBudWxsLCB0aGlzLmFyZ3MubWFwKGFyZyA9PiBhcmcuY2xvbmUoKSkpO1xuICAgIGV4cHIuZm4gPSB0aGlzLmZuPy5jbG9uZSgpID8/IG51bGw7XG4gICAgZXhwci52YXJPZmZzZXQgPSB0aGlzLnZhck9mZnNldDtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHI7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGluZGV4OiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQob3RoZXI6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBvdGhlciBpbnN0YW5jZW9mIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIgJiYgb3RoZXIuaW5kZXggPT09IHRoaXMuaW5kZXg7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwciB7XG4gICAgcmV0dXJuIG5ldyBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByKHRoaXMuaW5kZXgpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlQmluZGluZ0V4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSBpbXBsZW1lbnRzIENvbnN1bWVzVmFyc1RyYWl0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVXNlc1Zhck9mZnNldFRyYWl0IHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nO1xuICByZWFkb25seVtDb25zdW1lc1ZhcnNUcmFpdF0gPSB0cnVlO1xuICByZWFkb25seVtVc2VzVmFyT2Zmc2V0XSA9IHRydWU7XG5cbiAgdmFyT2Zmc2V0OiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSB0YXJnZXQ6IFhyZWZJZCwgcmVhZG9ubHkgdGFyZ2V0U2xvdDogU2xvdEhhbmRsZSwgcmVhZG9ubHkgbmFtZTogc3RyaW5nLFxuICAgICAgcmVhZG9ubHkgYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgYXJnIG9mIHRoaXMuYXJncykge1xuICAgICAgYXJnLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICBmb3IgKGxldCBpZHggPSAwOyBpZHggPCB0aGlzLmFyZ3MubGVuZ3RoOyBpZHgrKykge1xuICAgICAgdGhpcy5hcmdzW2lkeF0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmFyZ3NbaWR4XSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKSB7XG4gICAgY29uc3QgciA9XG4gICAgICAgIG5ldyBQaXBlQmluZGluZ0V4cHIodGhpcy50YXJnZXQsIHRoaXMudGFyZ2V0U2xvdCwgdGhpcy5uYW1lLCB0aGlzLmFyZ3MubWFwKGEgPT4gYS5jbG9uZSgpKSk7XG4gICAgci52YXJPZmZzZXQgPSB0aGlzLnZhck9mZnNldDtcbiAgICByZXR1cm4gcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGlwZUJpbmRpbmdWYXJpYWRpY0V4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSBpbXBsZW1lbnRzIENvbnN1bWVzVmFyc1RyYWl0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBVc2VzVmFyT2Zmc2V0VHJhaXQge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmdWYXJpYWRpYztcbiAgcmVhZG9ubHlbQ29uc3VtZXNWYXJzVHJhaXRdID0gdHJ1ZTtcbiAgcmVhZG9ubHlbVXNlc1Zhck9mZnNldF0gPSB0cnVlO1xuXG4gIHZhck9mZnNldDogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgdGFyZ2V0OiBYcmVmSWQsIHJlYWRvbmx5IHRhcmdldFNsb3Q6IFNsb3RIYW5kbGUsIHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBhcmdzOiBvLkV4cHJlc3Npb24sIHB1YmxpYyBudW1BcmdzOiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIHRoaXMuYXJncy52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLmFyZ3MgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmFyZ3MsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUGlwZUJpbmRpbmdWYXJpYWRpY0V4cHIge1xuICAgIGNvbnN0IHIgPSBuZXcgUGlwZUJpbmRpbmdWYXJpYWRpY0V4cHIoXG4gICAgICAgIHRoaXMudGFyZ2V0LCB0aGlzLnRhcmdldFNsb3QsIHRoaXMubmFtZSwgdGhpcy5hcmdzLmNsb25lKCksIHRoaXMubnVtQXJncyk7XG4gICAgci52YXJPZmZzZXQgPSB0aGlzLnZhck9mZnNldDtcbiAgICByZXR1cm4gcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2FmZVByb3BlcnR5UmVhZEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5TYWZlUHJvcGVydHlSZWFkO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWNlaXZlcjogby5FeHByZXNzaW9uLCBwdWJsaWMgbmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFuIGFsaWFzIGZvciBuYW1lLCB3aGljaCBhbGxvd3Mgb3RoZXIgbG9naWMgdG8gaGFuZGxlIHByb3BlcnR5IHJlYWRzIGFuZCBrZXllZCByZWFkcyB0b2dldGhlci5cbiAgZ2V0IGluZGV4KCkge1xuICAgIHJldHVybiB0aGlzLm5hbWU7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBTYWZlUHJvcGVydHlSZWFkRXhwciB7XG4gICAgcmV0dXJuIG5ldyBTYWZlUHJvcGVydHlSZWFkRXhwcih0aGlzLnJlY2VpdmVyLmNsb25lKCksIHRoaXMubmFtZSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNhZmVLZXllZFJlYWRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuU2FmZUtleWVkUmVhZDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogby5FeHByZXNzaW9uLCBwdWJsaWMgaW5kZXg6IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIHRoaXMuaW5kZXgudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB0aGlzLmluZGV4ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5pbmRleCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBTYWZlS2V5ZWRSZWFkRXhwciB7XG4gICAgcmV0dXJuIG5ldyBTYWZlS2V5ZWRSZWFkRXhwcih0aGlzLnJlY2VpdmVyLmNsb25lKCksIHRoaXMuaW5kZXguY2xvbmUoKSwgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2FmZUludm9rZUZ1bmN0aW9uRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlNhZmVJbnZva2VGdW5jdGlvbjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiwgcHVibGljIGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIGZvciAoY29uc3QgYSBvZiB0aGlzLmFyZ3MpIHtcbiAgICAgIGEudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuYXJnc1tpXSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuYXJnc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogU2FmZUludm9rZUZ1bmN0aW9uRXhwciB7XG4gICAgcmV0dXJuIG5ldyBTYWZlSW52b2tlRnVuY3Rpb25FeHByKHRoaXMucmVjZWl2ZXIuY2xvbmUoKSwgdGhpcy5hcmdzLm1hcChhID0+IGEuY2xvbmUoKSkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTYWZlVGVybmFyeUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5TYWZlVGVybmFyeUV4cHI7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGd1YXJkOiBvLkV4cHJlc3Npb24sIHB1YmxpYyBleHByOiBvLkV4cHJlc3Npb24pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5ndWFyZC52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgdGhpcy5leHByLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLmd1YXJkID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5ndWFyZCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgdGhpcy5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFNhZmVUZXJuYXJ5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBTYWZlVGVybmFyeUV4cHIodGhpcy5ndWFyZC5jbG9uZSgpLCB0aGlzLmV4cHIuY2xvbmUoKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVtcHR5RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkVtcHR5RXhwcjtcblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEVtcHR5RXhwcjtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBFbXB0eUV4cHIge1xuICAgIHJldHVybiBuZXcgRW1wdHlFeHByKCk7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuZXhwb3J0IGNsYXNzIEFzc2lnblRlbXBvcmFyeUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5Bc3NpZ25UZW1wb3JhcnlFeHByO1xuXG4gIHB1YmxpYyBuYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGV4cHI6IG8uRXhwcmVzc2lvbiwgcHVibGljIHhyZWY6IFhyZWZJZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLmV4cHIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMuZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuZXhwciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBBc3NpZ25UZW1wb3JhcnlFeHByIHtcbiAgICBjb25zdCBhID0gbmV3IEFzc2lnblRlbXBvcmFyeUV4cHIodGhpcy5leHByLmNsb25lKCksIHRoaXMueHJlZik7XG4gICAgYS5uYW1lID0gdGhpcy5uYW1lO1xuICAgIHJldHVybiBhO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBSZWFkVGVtcG9yYXJ5RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlYWRUZW1wb3JhcnlFeHByO1xuXG4gIHB1YmxpYyBuYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHVibGljIHhyZWY6IFhyZWZJZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy54cmVmID09PSB0aGlzLnhyZWY7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBSZWFkVGVtcG9yYXJ5RXhwciB7XG4gICAgY29uc3QgciA9IG5ldyBSZWFkVGVtcG9yYXJ5RXhwcih0aGlzLnhyZWYpO1xuICAgIHIubmFtZSA9IHRoaXMubmFtZTtcbiAgICByZXR1cm4gcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2xvdExpdGVyYWxFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuU2xvdExpdGVyYWxFeHByO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHNsb3Q6IFNsb3RIYW5kbGUpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBTbG90TGl0ZXJhbEV4cHIgJiYgZS5zbG90ID09PSB0aGlzLnNsb3Q7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogU2xvdExpdGVyYWxFeHByIHtcbiAgICByZXR1cm4gbmV3IFNsb3RMaXRlcmFsRXhwcih0aGlzLnNsb3QpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBDb25kaXRpb25hbENhc2VFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuQ29uZGl0aW9uYWxDYXNlO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW4gZXhwcmVzc2lvbiBmb3Igb25lIGJyYW5jaCBvZiBhIGNvbmRpdGlvbmFsLlxuICAgKiBAcGFyYW0gZXhwciBUaGUgZXhwcmVzc2lvbiB0byBiZSB0ZXN0ZWQgZm9yIHRoaXMgY2FzZS4gTWlnaHQgYmUgbnVsbCwgYXMgaW4gYW4gYGVsc2VgIGNhc2UuXG4gICAqIEBwYXJhbSB0YXJnZXQgVGhlIFhyZWYgb2YgdGhlIHZpZXcgdG8gYmUgZGlzcGxheWVkIGlmIHRoaXMgY29uZGl0aW9uIGlzIHRydWUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleHByOiBvLkV4cHJlc3Npb258bnVsbCwgcmVhZG9ubHkgdGFyZ2V0OiBYcmVmSWQsIHJlYWRvbmx5IHRhcmdldFNsb3Q6IFNsb3RIYW5kbGUsXG4gICAgICByZWFkb25seSBhbGlhczogdC5WYXJpYWJsZXxudWxsID0gbnVsbCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAodGhpcy5leHByICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmV4cHIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBFeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBDb25kaXRpb25hbENhc2VFeHByICYmIGUuZXhwciA9PT0gdGhpcy5leHByO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IENvbmRpdGlvbmFsQ2FzZUV4cHIge1xuICAgIHJldHVybiBuZXcgQ29uZGl0aW9uYWxDYXNlRXhwcih0aGlzLmV4cHIsIHRoaXMudGFyZ2V0LCB0aGlzLnRhcmdldFNsb3QpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgaWYgKHRoaXMuZXhwciAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERlcml2ZWRSZXBlYXRlclZhckV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5EZXJpdmVkUmVwZWF0ZXJWYXI7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgeHJlZjogWHJlZklkLCByZWFkb25seSBpZGVudGl0eTogRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7fVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgRGVyaXZlZFJlcGVhdGVyVmFyRXhwciAmJiBlLmlkZW50aXR5ID09PSB0aGlzLmlkZW50aXR5ICYmXG4gICAgICAgIGUueHJlZiA9PT0gdGhpcy54cmVmO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBvLkV4cHJlc3Npb24ge1xuICAgIHJldHVybiBuZXcgRGVyaXZlZFJlcGVhdGVyVmFyRXhwcih0aGlzLnhyZWYsIHRoaXMuaWRlbnRpdHkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb25zdENvbGxlY3RlZEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5Db25zdENvbGxlY3RlZDtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXhwcjogby5FeHByZXNzaW9uKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMuZXhwciA9IHRyYW5zZm9ybSh0aGlzLmV4cHIsIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLmV4cHIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmICghKGUgaW5zdGFuY2VvZiBDb25zdENvbGxlY3RlZEV4cHIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4cHIuaXNFcXVpdmFsZW50KGUuZXhwcik7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmV4cHIuaXNDb25zdGFudCgpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogQ29uc3RDb2xsZWN0ZWRFeHByIHtcbiAgICByZXR1cm4gbmV3IENvbnN0Q29sbGVjdGVkRXhwcih0aGlzLmV4cHIpO1xuICB9XG59XG5cbi8qKlxuICogVmlzaXRzIGFsbCBgRXhwcmVzc2lvbmBzIGluIHRoZSBBU1Qgb2YgYG9wYCB3aXRoIHRoZSBgdmlzaXRvcmAgZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2aXNpdEV4cHJlc3Npb25zSW5PcChcbiAgICBvcDogQ3JlYXRlT3B8VXBkYXRlT3AsIHZpc2l0b3I6IChleHByOiBvLkV4cHJlc3Npb24sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpID0+IHZvaWQpOiB2b2lkIHtcbiAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCAoZXhwciwgZmxhZ3MpID0+IHtcbiAgICB2aXNpdG9yKGV4cHIsIGZsYWdzKTtcbiAgICByZXR1cm4gZXhwcjtcbiAgfSwgVmlzaXRvckNvbnRleHRGbGFnLk5vbmUpO1xufVxuXG5leHBvcnQgZW51bSBWaXNpdG9yQ29udGV4dEZsYWcge1xuICBOb25lID0gMGIwMDAwLFxuICBJbkNoaWxkT3BlcmF0aW9uID0gMGIwMDAxLFxufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihcbiAgICBpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uLCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgaW50ZXJwb2xhdGlvbi5leHByZXNzaW9uc1tpXSA9XG4gICAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGludGVycG9sYXRpb24uZXhwcmVzc2lvbnNbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIGFsbCBgRXhwcmVzc2lvbmBzIGluIHRoZSBBU1Qgb2YgYG9wYCB3aXRoIHRoZSBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBBbGwgc3VjaCBvcGVyYXRpb25zIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGUgcmVzdWx0IG9mIGFwcGx5aW5nIGB0cmFuc2Zvcm1gLCB3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKFxuICAgIG9wOiBDcmVhdGVPcHxVcGRhdGVPcCwgdHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTogdm9pZCB7XG4gIHN3aXRjaCAob3Aua2luZCkge1xuICAgIGNhc2UgT3BLaW5kLlN0eWxlUHJvcDpcbiAgICBjYXNlIE9wS2luZC5TdHlsZU1hcDpcbiAgICBjYXNlIE9wS2luZC5DbGFzc1Byb3A6XG4gICAgY2FzZSBPcEtpbmQuQ2xhc3NNYXA6XG4gICAgY2FzZSBPcEtpbmQuQmluZGluZzpcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlByb3BlcnR5OlxuICAgIGNhc2UgT3BLaW5kLkhvc3RQcm9wZXJ0eTpcbiAgICBjYXNlIE9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkludGVycG9sYXRpb24ob3AuZXhwcmVzc2lvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcC5leHByZXNzaW9uID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AuZXhwcmVzc2lvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBvcC5zYW5pdGl6ZXIgPVxuICAgICAgICAgIG9wLnNhbml0aXplciAmJiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5zYW5pdGl6ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuSTE4bkV4cHJlc3Npb246XG4gICAgICBvcC5leHByZXNzaW9uID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AuZXhwcmVzc2lvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihvcC5pbnRlcnBvbGF0aW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlN0YXRlbWVudDpcbiAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5TdGF0ZW1lbnQob3Auc3RhdGVtZW50LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgb3AuaW5pdGlhbGl6ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5pbml0aWFsaXplciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5Db25kaXRpb25hbDpcbiAgICAgIGZvciAoY29uc3QgY29uZGl0aW9uIG9mIG9wLmNvbmRpdGlvbnMpIHtcbiAgICAgICAgaWYgKGNvbmRpdGlvbi5leHByID09PSBudWxsKSB7XG4gICAgICAgICAgLy8gVGhpcyBpcyBhIGRlZmF1bHQgY2FzZS5cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25kaXRpb24uZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGNvbmRpdGlvbi5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcC5wcm9jZXNzZWQgIT09IG51bGwpIHtcbiAgICAgICAgb3AucHJvY2Vzc2VkID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AucHJvY2Vzc2VkLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcC5jb250ZXh0VmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgb3AuY29udGV4dFZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AuY29udGV4dFZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgZm9yIChjb25zdCBpbm5lck9wIG9mIG9wLmhhbmRsZXJPcHMpIHtcbiAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKGlubmVyT3AsIHRyYW5zZm9ybSwgZmxhZ3MgfCBWaXNpdG9yQ29udGV4dEZsYWcuSW5DaGlsZE9wZXJhdGlvbik7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5FeHRyYWN0ZWRBdHRyaWJ1dGU6XG4gICAgICBvcC5leHByZXNzaW9uID1cbiAgICAgICAgICBvcC5leHByZXNzaW9uICYmIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLmV4cHJlc3Npb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgb3AudHJ1c3RlZFZhbHVlRm4gPSBvcC50cnVzdGVkVmFsdWVGbiAmJlxuICAgICAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnRydXN0ZWRWYWx1ZUZuLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgb3AudHJhY2sgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC50cmFjaywgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBpZiAob3AudHJhY2tCeUZuICE9PSBudWxsKSB7XG4gICAgICAgIG9wLnRyYWNrQnlGbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnRyYWNrQnlGbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5SZXBlYXRlcjpcbiAgICAgIG9wLmNvbGxlY3Rpb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5jb2xsZWN0aW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkRlZmVyOlxuICAgICAgaWYgKG9wLmxvYWRpbmdDb25maWcgIT09IG51bGwpIHtcbiAgICAgICAgb3AubG9hZGluZ0NvbmZpZyA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLmxvYWRpbmdDb25maWcsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgICAgaWYgKG9wLnBsYWNlaG9sZGVyQ29uZmlnICE9PSBudWxsKSB7XG4gICAgICAgIG9wLnBsYWNlaG9sZGVyQ29uZmlnID1cbiAgICAgICAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnBsYWNlaG9sZGVyQ29uZmlnLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcC5yZXNvbHZlckZuICE9PSBudWxsKSB7XG4gICAgICAgIG9wLnJlc29sdmVyRm4gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5yZXNvbHZlckZuLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkkxOG5NZXNzYWdlOlxuICAgICAgZm9yIChjb25zdCBbcGxhY2Vob2xkZXIsIGV4cHJdIG9mIG9wLnBhcmFtcykge1xuICAgICAgICBvcC5wYXJhbXMuc2V0KHBsYWNlaG9sZGVyLCB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLCB0cmFuc2Zvcm0sIGZsYWdzKSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgZXhwcl0gb2Ygb3AucG9zdHByb2Nlc3NpbmdQYXJhbXMpIHtcbiAgICAgICAgb3AucG9zdHByb2Nlc3NpbmdQYXJhbXMuc2V0KFxuICAgICAgICAgICAgcGxhY2Vob2xkZXIsIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkRlZmVyV2hlbjpcbiAgICAgIG9wLmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkFkdmFuY2U6XG4gICAgY2FzZSBPcEtpbmQuQ29udGFpbmVyOlxuICAgIGNhc2UgT3BLaW5kLkNvbnRhaW5lckVuZDpcbiAgICBjYXNlIE9wS2luZC5Db250YWluZXJTdGFydDpcbiAgICBjYXNlIE9wS2luZC5EZWZlck9uOlxuICAgIGNhc2UgT3BLaW5kLkRpc2FibGVCaW5kaW5nczpcbiAgICBjYXNlIE9wS2luZC5FbGVtZW50OlxuICAgIGNhc2UgT3BLaW5kLkVsZW1lbnRFbmQ6XG4gICAgY2FzZSBPcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgIGNhc2UgT3BLaW5kLkVuYWJsZUJpbmRpbmdzOlxuICAgIGNhc2UgT3BLaW5kLkkxOG46XG4gICAgY2FzZSBPcEtpbmQuSTE4bkFwcGx5OlxuICAgIGNhc2UgT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgIGNhc2UgT3BLaW5kLkkxOG5FbmQ6XG4gICAgY2FzZSBPcEtpbmQuSTE4blN0YXJ0OlxuICAgIGNhc2UgT3BLaW5kLkljdUVuZDpcbiAgICBjYXNlIE9wS2luZC5JY3VTdGFydDpcbiAgICBjYXNlIE9wS2luZC5OYW1lc3BhY2U6XG4gICAgY2FzZSBPcEtpbmQuUGlwZTpcbiAgICBjYXNlIE9wS2luZC5Qcm9qZWN0aW9uOlxuICAgIGNhc2UgT3BLaW5kLlByb2plY3Rpb25EZWY6XG4gICAgY2FzZSBPcEtpbmQuVGVtcGxhdGU6XG4gICAgY2FzZSBPcEtpbmQuVGV4dDpcbiAgICBjYXNlIE9wS2luZC5JMThuQXR0cmlidXRlczpcbiAgICBjYXNlIE9wS2luZC5JY3VQbGFjZWhvbGRlcjpcbiAgICAgIC8vIFRoZXNlIG9wZXJhdGlvbnMgY29udGFpbiBubyBleHByZXNzaW9ucy5cbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3AgZG9lc24ndCBoYW5kbGUgJHtPcEtpbmRbb3Aua2luZF19YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYWxsIGBFeHByZXNzaW9uYHMgaW4gdGhlIEFTVCBvZiBgZXhwcmAgd2l0aCB0aGUgYHRyYW5zZm9ybWAgZnVuY3Rpb24uXG4gKlxuICogQWxsIHN1Y2ggb3BlcmF0aW9ucyB3aWxsIGJlIHJlcGxhY2VkIHdpdGggdGhlIHJlc3VsdCBvZiBhcHBseWluZyBgdHJhbnNmb3JtYCwgd2hpY2ggbWF5IGJlIGFuXG4gKiBpZGVudGl0eSB0cmFuc2Zvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKFxuICAgIGV4cHI6IG8uRXhwcmVzc2lvbiwgdHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGV4cHIgaW5zdGFuY2VvZiBFeHByZXNzaW9uQmFzZSkge1xuICAgIGV4cHIudHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5CaW5hcnlPcGVyYXRvckV4cHIpIHtcbiAgICBleHByLmxocyA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIubGhzLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLnJocyA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIucmhzLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5VbmFyeU9wZXJhdG9yRXhwcikge1xuICAgIGV4cHIuZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZXhwciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uUmVhZFByb3BFeHByKSB7XG4gICAgZXhwci5yZWNlaXZlciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIucmVjZWl2ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLlJlYWRLZXlFeHByKSB7XG4gICAgZXhwci5yZWNlaXZlciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIucmVjZWl2ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIuaW5kZXggPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmluZGV4LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5Xcml0ZVByb3BFeHByKSB7XG4gICAgZXhwci5yZWNlaXZlciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIucmVjZWl2ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIudmFsdWUgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5Xcml0ZUtleUV4cHIpIHtcbiAgICBleHByLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZXhwci5pbmRleCA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuaW5kZXgsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIudmFsdWUgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5JbnZva2VGdW5jdGlvbkV4cHIpIHtcbiAgICBleHByLmZuID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5mbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByLmFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHIuYXJnc1tpXSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuYXJnc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxBcnJheUV4cHIpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHIuZW50cmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgZXhwci5lbnRyaWVzW2ldID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5lbnRyaWVzW2ldLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbE1hcEV4cHIpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHIuZW50cmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgZXhwci5lbnRyaWVzW2ldLnZhbHVlID1cbiAgICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmVudHJpZXNbaV0udmFsdWUsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5Db25kaXRpb25hbEV4cHIpIHtcbiAgICBleHByLmNvbmRpdGlvbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuY29uZGl0aW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLnRydWVDYXNlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci50cnVlQ2FzZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgaWYgKGV4cHIuZmFsc2VDYXNlICE9PSBudWxsKSB7XG4gICAgICBleHByLmZhbHNlQ2FzZSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZmFsc2VDYXNlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uVHlwZW9mRXhwcikge1xuICAgIGV4cHIuZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZXhwciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uV3JpdGVWYXJFeHByKSB7XG4gICAgZXhwci52YWx1ZSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIudmFsdWUsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkxvY2FsaXplZFN0cmluZykge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwci5leHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgZXhwci5leHByZXNzaW9uc1tpXSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZXhwcmVzc2lvbnNbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5Ob3RFeHByKSB7XG4gICAgZXhwci5jb25kaXRpb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmNvbmRpdGlvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uVGFnZ2VkVGVtcGxhdGVFeHByKSB7XG4gICAgZXhwci50YWcgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnRhZywgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZXhwci50ZW1wbGF0ZS5leHByZXNzaW9ucyA9XG4gICAgICAgIGV4cHIudGVtcGxhdGUuZXhwcmVzc2lvbnMubWFwKGUgPT4gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZSwgdHJhbnNmb3JtLCBmbGFncykpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkFycm93RnVuY3Rpb25FeHByKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZXhwci5ib2R5KSkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByLmJvZHkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJblN0YXRlbWVudChleHByLmJvZHlbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBleHByLmJvZHkgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmJvZHksIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5XcmFwcGVkTm9kZUV4cHIpIHtcbiAgICAvLyBUT0RPOiBEbyB3ZSBuZWVkIHRvIHRyYW5zZm9ybSBhbnkgVFMgbm9kZXMgbmVzdGVkIGluc2lkZSBvZiB0aGlzIGV4cHJlc3Npb24/XG4gIH0gZWxzZSBpZiAoXG4gICAgICBleHByIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwciB8fCBleHByIGluc3RhbmNlb2Ygby5FeHRlcm5hbEV4cHIgfHxcbiAgICAgIGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByKSB7XG4gICAgLy8gTm8gYWN0aW9uIGZvciB0aGVzZSB0eXBlcy5cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBleHByZXNzaW9uIGtpbmQ6ICR7ZXhwci5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIHJldHVybiB0cmFuc2Zvcm0oZXhwciwgZmxhZ3MpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbGwgYEV4cHJlc3Npb25gcyBpbiB0aGUgQVNUIG9mIGBzdG10YCB3aXRoIHRoZSBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBBbGwgc3VjaCBvcGVyYXRpb25zIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGUgcmVzdWx0IG9mIGFwcGx5aW5nIGB0cmFuc2Zvcm1gLCB3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvbnNJblN0YXRlbWVudChcbiAgICBzdG10OiBvLlN0YXRlbWVudCwgdHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTogdm9pZCB7XG4gIGlmIChzdG10IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgc3RtdC5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChzdG10IGluc3RhbmNlb2Ygby5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICBzdG10LnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uRGVjbGFyZVZhclN0bXQpIHtcbiAgICBpZiAoc3RtdC52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBzdG10LnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLklmU3RtdCkge1xuICAgIHN0bXQuY29uZGl0aW9uID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC5jb25kaXRpb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGZvciAoY29uc3QgY2FzZVN0YXRlbWVudCBvZiBzdG10LnRydWVDYXNlKSB7XG4gICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luU3RhdGVtZW50KGNhc2VTdGF0ZW1lbnQsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNhc2VTdGF0ZW1lbnQgb2Ygc3RtdC5mYWxzZUNhc2UpIHtcbiAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5TdGF0ZW1lbnQoY2FzZVN0YXRlbWVudCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIHN0YXRlbWVudCBraW5kOiAke3N0bXQuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGEgc3RyaW5nIGxpdGVyYWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N0cmluZ0xpdGVyYWwoZXhwcjogby5FeHByZXNzaW9uKTogZXhwciBpcyBvLkxpdGVyYWxFeHByJnt2YWx1ZTogc3RyaW5nfSB7XG4gIHJldHVybiBleHByIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwciAmJiB0eXBlb2YgZXhwci52YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG4iXX0=