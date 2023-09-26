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
        this.slot = null;
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
        expr.slot = this.slot;
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
        this.slot = null;
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
        r.slot = this.slot;
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
        this.slot = null;
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
        r.slot = this.slot;
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
        this.slot = null;
    }
    visitExpression(visitor, context) { }
    isEquivalent(e) {
        return e instanceof SlotLiteralExpr && e.target === this.target && e.slot === this.slot;
    }
    isConstant() {
        return true;
    }
    clone() {
        return new SlotLiteralExpr(this.target);
    }
    transformInternalExpressions() { }
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
                if (condition[1] === null) {
                    // This is a default case.
                    continue;
                }
                condition[1] = transformExpressionsInExpression(condition[1], transform, flags);
            }
            if (op.processed !== null) {
                op.processed = transformExpressionsInExpression(op.processed, transform, flags);
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
        case OpKind.I18nStart:
            for (const placeholder in op.tagNameParams) {
                op.tagNameParams[placeholder] =
                    transformExpressionsInExpression(op.tagNameParams[placeholder], transform, flags);
            }
            break;
        case OpKind.Projection:
        case OpKind.ProjectionDef:
        case OpKind.Element:
        case OpKind.ElementStart:
        case OpKind.ElementEnd:
        case OpKind.I18n:
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvZXhwcmVzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUduRCxPQUFPLEVBQUMsY0FBYyxFQUFFLE1BQU0sRUFBYyxNQUFNLFNBQVMsQ0FBQztBQUM1RCxPQUFPLEVBQUMsaUJBQWlCLEVBQXlCLGFBQWEsRUFBc0IsYUFBYSxFQUFxQixNQUFNLFVBQVUsQ0FBQztBQUl4SSxPQUFPLEVBQUMsYUFBYSxFQUFnQixNQUFNLGNBQWMsQ0FBQztBQWlCMUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUFDLElBQWtCO0lBQy9DLE9BQU8sSUFBSSxZQUFZLGNBQWMsQ0FBQztBQUN4QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQWdCLGNBQWUsU0FBUSxDQUFDLENBQUMsVUFBVTtJQUd2RCxZQUFZLGFBQW1DLElBQUk7UUFDakQsS0FBSyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMxQixDQUFDO0NBUUY7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyxlQUFnQixTQUFRLGNBQWM7SUFHakQsWUFBcUIsSUFBWTtRQUMvQixLQUFLLEVBQUUsQ0FBQztRQURXLFNBQUksR0FBSixJQUFJLENBQVE7UUFGZixTQUFJLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQztJQUlwRCxDQUFDO0lBRVEsZUFBZSxDQUFDLE9BQTRCLEVBQUUsT0FBWSxJQUFTLENBQUM7SUFFcEUsWUFBWTtRQUNuQixPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFUSxVQUFVO1FBQ2pCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVRLDRCQUE0QixLQUFV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SUFBSSxDQUFDLFNBQVMsR0FBRyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwRixLQUFLLE1BQU0sYUFBYSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDekMsK0JBQStCLENBQUMsYUFBYSxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUNsRTtRQUNELEtBQUssTUFBTSxhQUFhLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUMxQywrQkFBK0IsQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ2xFO0tBQ0Y7U0FBTTtRQUNMLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztLQUN2RTtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQUMsSUFBa0I7SUFDaEQsT0FBTyxJQUFJLFlBQVksQ0FBQyxDQUFDLFdBQVcsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssUUFBUSxDQUFDO0FBQ3pFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgdHlwZSB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi8uLi8uLi9wYXJzZV91dGlsJztcblxuaW1wb3J0IHtFeHByZXNzaW9uS2luZCwgT3BLaW5kLCBTYW5pdGl6ZXJGbn0gZnJvbSAnLi9lbnVtcyc7XG5pbXBvcnQge0NvbnN1bWVzVmFyc1RyYWl0LCBUUkFJVF9VU0VTX1NMT1RfSU5ERVgsIFVzZXNTbG90SW5kZXgsIFVzZXNTbG90SW5kZXhUcmFpdCwgVXNlc1Zhck9mZnNldCwgVXNlc1Zhck9mZnNldFRyYWl0fSBmcm9tICcuL3RyYWl0cyc7XG5cbmltcG9ydCB0eXBlIHtYcmVmSWR9IGZyb20gJy4vb3BlcmF0aW9ucyc7XG5pbXBvcnQgdHlwZSB7Q3JlYXRlT3B9IGZyb20gJy4vb3BzL2NyZWF0ZSc7XG5pbXBvcnQge0ludGVycG9sYXRpb24sIHR5cGUgVXBkYXRlT3B9IGZyb20gJy4vb3BzL3VwZGF0ZSc7XG5cbi8qKlxuICogQW4gYG8uRXhwcmVzc2lvbmAgc3VidHlwZSByZXByZXNlbnRpbmcgYSBsb2dpY2FsIGV4cHJlc3Npb24gaW4gdGhlIGludGVybWVkaWF0ZSByZXByZXNlbnRhdGlvbi5cbiAqL1xuZXhwb3J0IHR5cGUgRXhwcmVzc2lvbiA9XG4gICAgTGV4aWNhbFJlYWRFeHByfFJlZmVyZW5jZUV4cHJ8Q29udGV4dEV4cHJ8TmV4dENvbnRleHRFeHByfEdldEN1cnJlbnRWaWV3RXhwcnxSZXN0b3JlVmlld0V4cHJ8XG4gICAgUmVzZXRWaWV3RXhwcnxSZWFkVmFyaWFibGVFeHByfFB1cmVGdW5jdGlvbkV4cHJ8UHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcnxQaXBlQmluZGluZ0V4cHJ8XG4gICAgUGlwZUJpbmRpbmdWYXJpYWRpY0V4cHJ8U2FmZVByb3BlcnR5UmVhZEV4cHJ8U2FmZUtleWVkUmVhZEV4cHJ8U2FmZUludm9rZUZ1bmN0aW9uRXhwcnxFbXB0eUV4cHJ8XG4gICAgQXNzaWduVGVtcG9yYXJ5RXhwcnxSZWFkVGVtcG9yYXJ5RXhwcnxTYW5pdGl6ZXJFeHByfFNsb3RMaXRlcmFsRXhwcjtcblxuLyoqXG4gKiBUcmFuc2Zvcm1lciB0eXBlIHdoaWNoIGNvbnZlcnRzIGV4cHJlc3Npb25zIGludG8gZ2VuZXJhbCBgby5FeHByZXNzaW9uYHMgKHdoaWNoIG1heSBiZSBhblxuICogaWRlbnRpdHkgdHJhbnNmb3JtYXRpb24pLlxuICovXG5leHBvcnQgdHlwZSBFeHByZXNzaW9uVHJhbnNmb3JtID0gKGV4cHI6IG8uRXhwcmVzc2lvbiwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZykgPT4gby5FeHByZXNzaW9uO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgYSBnaXZlbiBgby5FeHByZXNzaW9uYCBpcyBhIGxvZ2ljYWwgSVIgZXhwcmVzc2lvbiB0eXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNJckV4cHJlc3Npb24oZXhwcjogby5FeHByZXNzaW9uKTogZXhwciBpcyBFeHByZXNzaW9uIHtcbiAgcmV0dXJuIGV4cHIgaW5zdGFuY2VvZiBFeHByZXNzaW9uQmFzZTtcbn1cblxuLyoqXG4gKiBCYXNlIHR5cGUgdXNlZCBmb3IgYWxsIGxvZ2ljYWwgSVIgZXhwcmVzc2lvbnMuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBFeHByZXNzaW9uQmFzZSBleHRlbmRzIG8uRXhwcmVzc2lvbiB7XG4gIGFic3RyYWN0IHJlYWRvbmx5IGtpbmQ6IEV4cHJlc3Npb25LaW5kO1xuXG4gIGNvbnN0cnVjdG9yKHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCkge1xuICAgIHN1cGVyKG51bGwsIHNvdXJjZVNwYW4pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJ1biB0aGUgdHJhbnNmb3JtZXIgYWdhaW5zdCBhbnkgbmVzdGVkIGV4cHJlc3Npb25zIHdoaWNoIG1heSBiZSBwcmVzZW50IGluIHRoaXMgSVIgZXhwcmVzc2lvblxuICAgKiBzdWJ0eXBlLlxuICAgKi9cbiAgYWJzdHJhY3QgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZDtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgbGV4aWNhbCByZWFkIG9mIGEgdmFyaWFibGUgbmFtZS5cbiAqL1xuZXhwb3J0IGNsYXNzIExleGljYWxSZWFkRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkxleGljYWxSZWFkO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IG5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBMZXhpY2FsUmVhZEV4cHIge1xuICAgIHJldHVybiBuZXcgTGV4aWNhbFJlYWRFeHByKHRoaXMubmFtZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXRyaWV2ZSB0aGUgdmFsdWUgb2YgYSBsb2NhbCByZWZlcmVuY2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2VFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2UgaW1wbGVtZW50cyBVc2VzU2xvdEluZGV4VHJhaXQge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUmVmZXJlbmNlO1xuXG4gIHJlYWRvbmx5W1VzZXNTbG90SW5kZXhdID0gdHJ1ZTtcblxuICBzbG90OiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdGFyZ2V0OiBYcmVmSWQsIHJlYWRvbmx5IG9mZnNldDogbnVtYmVyKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgUmVmZXJlbmNlRXhwciAmJiBlLnRhcmdldCA9PT0gdGhpcy50YXJnZXQ7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFJlZmVyZW5jZUV4cHIge1xuICAgIGNvbnN0IGV4cHIgPSBuZXcgUmVmZXJlbmNlRXhwcih0aGlzLnRhcmdldCwgdGhpcy5vZmZzZXQpO1xuICAgIGV4cHIuc2xvdCA9IHRoaXMuc2xvdDtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxufVxuXG4vKipcbiAqIEEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCAodXN1YWxseSB0aGUgYGN0eGAgdmFyaWFibGUgaW4gYSB0ZW1wbGF0ZSBmdW5jdGlvbikuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb250ZXh0RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkNvbnRleHQ7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdmlldzogWHJlZklkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgQ29udGV4dEV4cHIgJiYgZS52aWV3ID09PSB0aGlzLnZpZXc7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnMoKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IENvbnRleHRFeHByIHtcbiAgICByZXR1cm4gbmV3IENvbnRleHRFeHByKHRoaXMudmlldyk7XG4gIH1cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byBuYXZpZ2F0ZSB0byB0aGUgbmV4dCB2aWV3IGNvbnRleHQgaW4gdGhlIHZpZXcgaGllcmFyY2h5LlxuICovXG5leHBvcnQgY2xhc3MgTmV4dENvbnRleHRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuTmV4dENvbnRleHQ7XG5cbiAgc3RlcHMgPSAxO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24oKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIE5leHRDb250ZXh0RXhwciAmJiBlLnN0ZXBzID09PSB0aGlzLnN0ZXBzO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBOZXh0Q29udGV4dEV4cHIge1xuICAgIGNvbnN0IGV4cHIgPSBuZXcgTmV4dENvbnRleHRFeHByKCk7XG4gICAgZXhwci5zdGVwcyA9IHRoaXMuc3RlcHM7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byBzbmFwc2hvdCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuXG4gKlxuICogVGhlIHJlc3VsdCBvZiB0aGlzIG9wZXJhdGlvbiBjYW4gYmUgc3RvcmVkIGluIGEgdmFyaWFibGUgYW5kIGxhdGVyIHVzZWQgd2l0aCB0aGUgYFJlc3RvcmVWaWV3YFxuICogb3BlcmF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgR2V0Q3VycmVudFZpZXdFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuR2V0Q3VycmVudFZpZXc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgR2V0Q3VycmVudFZpZXdFeHByO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBHZXRDdXJyZW50Vmlld0V4cHIge1xuICAgIHJldHVybiBuZXcgR2V0Q3VycmVudFZpZXdFeHByKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXN0b3JlIGEgc25hcHNob3R0ZWQgdmlldy5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlc3RvcmVWaWV3RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlc3RvcmVWaWV3O1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2aWV3OiBYcmVmSWR8by5FeHByZXNzaW9uKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICBpZiAodHlwZW9mIHRoaXMudmlldyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRoaXMudmlldy52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmICghKGUgaW5zdGFuY2VvZiBSZXN0b3JlVmlld0V4cHIpIHx8IHR5cGVvZiBlLnZpZXcgIT09IHR5cGVvZiB0aGlzLnZpZXcpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRoaXMudmlldyA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiB0aGlzLnZpZXcgPT09IGUudmlldztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMudmlldy5pc0VxdWl2YWxlbnQoZS52aWV3IGFzIG8uRXhwcmVzc2lvbik7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICBpZiAodHlwZW9mIHRoaXMudmlldyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRoaXMudmlldyA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMudmlldywgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVzdG9yZVZpZXdFeHByIHtcbiAgICByZXR1cm4gbmV3IFJlc3RvcmVWaWV3RXhwcih0aGlzLnZpZXcgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb24gPyB0aGlzLnZpZXcuY2xvbmUoKSA6IHRoaXMudmlldyk7XG4gIH1cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXNldCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQgYWZ0ZXIgYFJlc3RvcmVWaWV3YC5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlc2V0Vmlld0V4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5SZXNldFZpZXc7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGV4cHI6IG8uRXhwcmVzc2lvbikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLmV4cHIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgUmVzZXRWaWV3RXhwciAmJiB0aGlzLmV4cHIuaXNFcXVpdmFsZW50KGUuZXhwcik7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMuZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuZXhwciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBSZXNldFZpZXdFeHByIHtcbiAgICByZXR1cm4gbmV3IFJlc2V0Vmlld0V4cHIodGhpcy5leHByLmNsb25lKCkpO1xuICB9XG59XG5cbi8qKlxuICogUmVhZCBvZiBhIHZhcmlhYmxlIGRlY2xhcmVkIGFzIGFuIGBpci5WYXJpYWJsZU9wYCBhbmQgcmVmZXJlbmNlZCB0aHJvdWdoIGl0cyBgaXIuWHJlZklkYC5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlYWRWYXJpYWJsZUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5SZWFkVmFyaWFibGU7XG4gIG5hbWU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgeHJlZjogWHJlZklkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KG90aGVyOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gb3RoZXIgaW5zdGFuY2VvZiBSZWFkVmFyaWFibGVFeHByICYmIG90aGVyLnhyZWYgPT09IHRoaXMueHJlZjtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucygpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogUmVhZFZhcmlhYmxlRXhwciB7XG4gICAgY29uc3QgZXhwciA9IG5ldyBSZWFkVmFyaWFibGVFeHByKHRoaXMueHJlZik7XG4gICAgZXhwci5uYW1lID0gdGhpcy5uYW1lO1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQdXJlRnVuY3Rpb25FeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2UgaW1wbGVtZW50cyBDb25zdW1lc1ZhcnNUcmFpdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBVc2VzVmFyT2Zmc2V0VHJhaXQge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUHVyZUZ1bmN0aW9uRXhwcjtcbiAgcmVhZG9ubHlbQ29uc3VtZXNWYXJzVHJhaXRdID0gdHJ1ZTtcbiAgcmVhZG9ubHlbVXNlc1Zhck9mZnNldF0gPSB0cnVlO1xuXG4gIHZhck9mZnNldDogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgZXhwcmVzc2lvbiB3aGljaCBzaG91bGQgYmUgbWVtb2l6ZWQgYXMgYSBwdXJlIGNvbXB1dGF0aW9uLlxuICAgKlxuICAgKiBUaGlzIGV4cHJlc3Npb24gY29udGFpbnMgaW50ZXJuYWwgYFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHJgcywgd2hpY2ggYXJlIHBsYWNlaG9sZGVycyBmb3IgdGhlXG4gICAqIHBvc2l0aW9uYWwgYXJndW1lbnQgZXhwcmVzc2lvbnMgaW4gYGFyZ3MuXG4gICAqL1xuICBib2R5OiBvLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogUG9zaXRpb25hbCBhcmd1bWVudHMgdG8gdGhlIHB1cmUgZnVuY3Rpb24gd2hpY2ggd2lsbCBtZW1vaXplIHRoZSBgYm9keWAgZXhwcmVzc2lvbiwgd2hpY2ggYWN0XG4gICAqIGFzIG1lbW9pemF0aW9uIGtleXMuXG4gICAqL1xuICBhcmdzOiBvLkV4cHJlc3Npb25bXTtcblxuICAvKipcbiAgICogT25jZSBleHRyYWN0ZWQgdG8gdGhlIGBDb25zdGFudFBvb2xgLCBhIHJlZmVyZW5jZSB0byB0aGUgZnVuY3Rpb24gd2hpY2ggZGVmaW5lcyB0aGUgY29tcHV0YXRpb25cbiAgICogb2YgYGJvZHlgLlxuICAgKi9cbiAgZm46IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihleHByZXNzaW9uOiBvLkV4cHJlc3Npb258bnVsbCwgYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuYm9keSA9IGV4cHJlc3Npb247XG4gICAgdGhpcy5hcmdzID0gYXJncztcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLmJvZHk/LnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICBmb3IgKGNvbnN0IGFyZyBvZiB0aGlzLmFyZ3MpIHtcbiAgICAgIGFyZy52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KG90aGVyOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICBpZiAoIShvdGhlciBpbnN0YW5jZW9mIFB1cmVGdW5jdGlvbkV4cHIpIHx8IG90aGVyLmFyZ3MubGVuZ3RoICE9PSB0aGlzLmFyZ3MubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIG90aGVyLmJvZHkgIT09IG51bGwgJiYgdGhpcy5ib2R5ICE9PSBudWxsICYmIG90aGVyLmJvZHkuaXNFcXVpdmFsZW50KHRoaXMuYm9keSkgJiZcbiAgICAgICAgb3RoZXIuYXJncy5ldmVyeSgoYXJnLCBpZHgpID0+IGFyZy5pc0VxdWl2YWxlbnQodGhpcy5hcmdzW2lkeF0pKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOlxuICAgICAgdm9pZCB7XG4gICAgaWYgKHRoaXMuYm9keSAhPT0gbnVsbCkge1xuICAgICAgLy8gVE9ETzogZmlndXJlIG91dCBpZiB0aGlzIGlzIHRoZSByaWdodCBmbGFnIHRvIHBhc3MgaGVyZS5cbiAgICAgIHRoaXMuYm9keSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKFxuICAgICAgICAgIHRoaXMuYm9keSwgdHJhbnNmb3JtLCBmbGFncyB8IFZpc2l0b3JDb250ZXh0RmxhZy5JbkNoaWxkT3BlcmF0aW9uKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZm4gIT09IG51bGwpIHtcbiAgICAgIHRoaXMuZm4gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmZuLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5hcmdzW2ldID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5hcmdzW2ldLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBQdXJlRnVuY3Rpb25FeHByIHtcbiAgICBjb25zdCBleHByID1cbiAgICAgICAgbmV3IFB1cmVGdW5jdGlvbkV4cHIodGhpcy5ib2R5Py5jbG9uZSgpID8/IG51bGwsIHRoaXMuYXJncy5tYXAoYXJnID0+IGFyZy5jbG9uZSgpKSk7XG4gICAgZXhwci5mbiA9IHRoaXMuZm4/LmNsb25lKCkgPz8gbnVsbDtcbiAgICBleHByLnZhck9mZnNldCA9IHRoaXMudmFyT2Zmc2V0O1xuICAgIHJldHVybiBleHByO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgaW5kZXg6IG51bWJlcikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24oKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChvdGhlcjogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIG90aGVyIGluc3RhbmNlb2YgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwciAmJiBvdGhlci5pbmRleCA9PT0gdGhpcy5pbmRleDtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByIHtcbiAgICByZXR1cm4gbmV3IFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIodGhpcy5pbmRleCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBpcGVCaW5kaW5nRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIGltcGxlbWVudHMgVXNlc1Nsb3RJbmRleFRyYWl0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ29uc3VtZXNWYXJzVHJhaXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBVc2VzVmFyT2Zmc2V0VHJhaXQge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmc7XG4gIHJlYWRvbmx5W1VzZXNTbG90SW5kZXhdID0gdHJ1ZTtcbiAgcmVhZG9ubHlbQ29uc3VtZXNWYXJzVHJhaXRdID0gdHJ1ZTtcbiAgcmVhZG9ubHlbVXNlc1Zhck9mZnNldF0gPSB0cnVlO1xuXG4gIHNsb3Q6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgdmFyT2Zmc2V0OiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdGFyZ2V0OiBYcmVmSWQsIHJlYWRvbmx5IG5hbWU6IHN0cmluZywgcmVhZG9ubHkgYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgYXJnIG9mIHRoaXMuYXJncykge1xuICAgICAgYXJnLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICBmb3IgKGxldCBpZHggPSAwOyBpZHggPCB0aGlzLmFyZ3MubGVuZ3RoOyBpZHgrKykge1xuICAgICAgdGhpcy5hcmdzW2lkeF0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmFyZ3NbaWR4XSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKSB7XG4gICAgY29uc3QgciA9IG5ldyBQaXBlQmluZGluZ0V4cHIodGhpcy50YXJnZXQsIHRoaXMubmFtZSwgdGhpcy5hcmdzLm1hcChhID0+IGEuY2xvbmUoKSkpO1xuICAgIHIuc2xvdCA9IHRoaXMuc2xvdDtcbiAgICByLnZhck9mZnNldCA9IHRoaXMudmFyT2Zmc2V0O1xuICAgIHJldHVybiByO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlQmluZGluZ1ZhcmlhZGljRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIGltcGxlbWVudHMgVXNlc1Nsb3RJbmRleFRyYWl0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDb25zdW1lc1ZhcnNUcmFpdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVXNlc1Zhck9mZnNldFRyYWl0IHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nVmFyaWFkaWM7XG4gIHJlYWRvbmx5W1VzZXNTbG90SW5kZXhdID0gdHJ1ZTtcbiAgcmVhZG9ubHlbQ29uc3VtZXNWYXJzVHJhaXRdID0gdHJ1ZTtcbiAgcmVhZG9ubHlbVXNlc1Zhck9mZnNldF0gPSB0cnVlO1xuXG4gIHNsb3Q6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgdmFyT2Zmc2V0OiBudW1iZXJ8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSB0YXJnZXQ6IFhyZWZJZCwgcmVhZG9ubHkgbmFtZTogc3RyaW5nLCBwdWJsaWMgYXJnczogby5FeHByZXNzaW9uLFxuICAgICAgcHVibGljIG51bUFyZ3M6IG51bWJlcikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogdm9pZCB7XG4gICAgdGhpcy5hcmdzLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMuYXJncyA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuYXJncywgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBQaXBlQmluZGluZ1ZhcmlhZGljRXhwciB7XG4gICAgY29uc3QgciA9IG5ldyBQaXBlQmluZGluZ1ZhcmlhZGljRXhwcih0aGlzLnRhcmdldCwgdGhpcy5uYW1lLCB0aGlzLmFyZ3MuY2xvbmUoKSwgdGhpcy5udW1BcmdzKTtcbiAgICByLnNsb3QgPSB0aGlzLnNsb3Q7XG4gICAgci52YXJPZmZzZXQgPSB0aGlzLnZhck9mZnNldDtcbiAgICByZXR1cm4gcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2FmZVByb3BlcnR5UmVhZEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5TYWZlUHJvcGVydHlSZWFkO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWNlaXZlcjogby5FeHByZXNzaW9uLCBwdWJsaWMgbmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFuIGFsaWFzIGZvciBuYW1lLCB3aGljaCBhbGxvd3Mgb3RoZXIgbG9naWMgdG8gaGFuZGxlIHByb3BlcnR5IHJlYWRzIGFuZCBrZXllZCByZWFkcyB0b2dldGhlci5cbiAgZ2V0IGluZGV4KCkge1xuICAgIHJldHVybiB0aGlzLm5hbWU7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBTYWZlUHJvcGVydHlSZWFkRXhwciB7XG4gICAgcmV0dXJuIG5ldyBTYWZlUHJvcGVydHlSZWFkRXhwcih0aGlzLnJlY2VpdmVyLmNsb25lKCksIHRoaXMubmFtZSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNhZmVLZXllZFJlYWRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuU2FmZUtleWVkUmVhZDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyByZWNlaXZlcjogby5FeHByZXNzaW9uLCBwdWJsaWMgaW5kZXg6IG8uRXhwcmVzc2lvbiwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBzdXBlcihzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIHRoaXMuaW5kZXgudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB0aGlzLmluZGV4ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5pbmRleCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBTYWZlS2V5ZWRSZWFkRXhwciB7XG4gICAgcmV0dXJuIG5ldyBTYWZlS2V5ZWRSZWFkRXhwcih0aGlzLnJlY2VpdmVyLmNsb25lKCksIHRoaXMuaW5kZXguY2xvbmUoKSwgdGhpcy5zb3VyY2VTcGFuKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2FmZUludm9rZUZ1bmN0aW9uRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlNhZmVJbnZva2VGdW5jdGlvbjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVjZWl2ZXI6IG8uRXhwcmVzc2lvbiwgcHVibGljIGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIGZvciAoY29uc3QgYSBvZiB0aGlzLmFyZ3MpIHtcbiAgICAgIGEudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5yZWNlaXZlciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuYXJnc1tpXSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuYXJnc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogU2FmZUludm9rZUZ1bmN0aW9uRXhwciB7XG4gICAgcmV0dXJuIG5ldyBTYWZlSW52b2tlRnVuY3Rpb25FeHByKHRoaXMucmVjZWl2ZXIuY2xvbmUoKSwgdGhpcy5hcmdzLm1hcChhID0+IGEuY2xvbmUoKSkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTYWZlVGVybmFyeUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5TYWZlVGVybmFyeUV4cHI7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGd1YXJkOiBvLkV4cHJlc3Npb24sIHB1YmxpYyBleHByOiBvLkV4cHJlc3Npb24pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKHZpc2l0b3I6IG8uRXhwcmVzc2lvblZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5ndWFyZC52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgdGhpcy5leHByLnZpc2l0RXhwcmVzc2lvbih2aXNpdG9yLCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZyk6XG4gICAgICB2b2lkIHtcbiAgICB0aGlzLmd1YXJkID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5ndWFyZCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgdGhpcy5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNsb25lKCk6IFNhZmVUZXJuYXJ5RXhwciB7XG4gICAgcmV0dXJuIG5ldyBTYWZlVGVybmFyeUV4cHIodGhpcy5ndWFyZC5jbG9uZSgpLCB0aGlzLmV4cHIuY2xvbmUoKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVtcHR5RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkVtcHR5RXhwcjtcblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIEVtcHR5RXhwcjtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBFbXB0eUV4cHIge1xuICAgIHJldHVybiBuZXcgRW1wdHlFeHByKCk7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuZXhwb3J0IGNsYXNzIEFzc2lnblRlbXBvcmFyeUV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5Bc3NpZ25UZW1wb3JhcnlFeHByO1xuXG4gIHB1YmxpYyBuYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGV4cHI6IG8uRXhwcmVzc2lvbiwgcHVibGljIHhyZWY6IFhyZWZJZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLmV4cHIudmlzaXRFeHByZXNzaW9uKHZpc2l0b3IsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge1xuICAgIHRoaXMuZXhwciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHRoaXMuZXhwciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBBc3NpZ25UZW1wb3JhcnlFeHByIHtcbiAgICBjb25zdCBhID0gbmV3IEFzc2lnblRlbXBvcmFyeUV4cHIodGhpcy5leHByLmNsb25lKCksIHRoaXMueHJlZik7XG4gICAgYS5uYW1lID0gdGhpcy5uYW1lO1xuICAgIHJldHVybiBhO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBSZWFkVGVtcG9yYXJ5RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlYWRUZW1wb3JhcnlFeHByO1xuXG4gIHB1YmxpYyBuYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHVibGljIHhyZWY6IFhyZWZJZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgb3ZlcnJpZGXCoGlzRXF1aXZhbGVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy54cmVmID09PSB0aGlzLnhyZWY7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTpcbiAgICAgIHZvaWQge31cblxuICBvdmVycmlkZSBjbG9uZSgpOiBSZWFkVGVtcG9yYXJ5RXhwciB7XG4gICAgY29uc3QgciA9IG5ldyBSZWFkVGVtcG9yYXJ5RXhwcih0aGlzLnhyZWYpO1xuICAgIHIubmFtZSA9IHRoaXMubmFtZTtcbiAgICByZXR1cm4gcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2FuaXRpemVyRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlNhbml0aXplckV4cHI7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGZuOiBTYW5pdGl6ZXJGbikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFNhbml0aXplckV4cHIgJiYgZS5mbiA9PT0gdGhpcy5mbjtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBvdmVycmlkZSBjbG9uZSgpOiBTYW5pdGl6ZXJFeHByIHtcbiAgICByZXR1cm4gbmV3IFNhbml0aXplckV4cHIodGhpcy5mbik7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuZXhwb3J0IGNsYXNzIFNsb3RMaXRlcmFsRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlNsb3RMaXRlcmFsRXhwcjtcbiAgcmVhZG9ubHlbVXNlc1Nsb3RJbmRleF0gPSB0cnVlO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHRhcmdldDogWHJlZklkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIHNsb3Q6IG51bWJlcnxudWxsID0gbnVsbDtcblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IEV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFNsb3RMaXRlcmFsRXhwciAmJiBlLnRhcmdldCA9PT0gdGhpcy50YXJnZXQgJiYgZS5zbG90ID09PSB0aGlzLnNsb3Q7XG4gIH1cblxuICBvdmVycmlkZSBpc0NvbnN0YW50KCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvbmUoKTogU2xvdExpdGVyYWxFeHByIHtcbiAgICByZXR1cm4gbmV3IFNsb3RMaXRlcmFsRXhwcih0aGlzLnRhcmdldCk7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBWaXNpdHMgYWxsIGBFeHByZXNzaW9uYHMgaW4gdGhlIEFTVCBvZiBgb3BgIHdpdGggdGhlIGB2aXNpdG9yYCBmdW5jdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0RXhwcmVzc2lvbnNJbk9wKFxuICAgIG9wOiBDcmVhdGVPcHxVcGRhdGVPcCwgdmlzaXRvcjogKGV4cHI6IG8uRXhwcmVzc2lvbiwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZykgPT4gdm9pZCk6IHZvaWQge1xuICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3Aob3AsIChleHByLCBmbGFncykgPT4ge1xuICAgIHZpc2l0b3IoZXhwciwgZmxhZ3MpO1xuICAgIHJldHVybiBleHByO1xuICB9LCBWaXNpdG9yQ29udGV4dEZsYWcuTm9uZSk7XG59XG5cbmV4cG9ydCBlbnVtIFZpc2l0b3JDb250ZXh0RmxhZyB7XG4gIE5vbmUgPSAwYjAwMDAsXG4gIEluQ2hpbGRPcGVyYXRpb24gPSAwYjAwMDEsXG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5JbnRlcnBvbGF0aW9uKFxuICAgIGludGVycG9sYXRpb246IEludGVycG9sYXRpb24sIHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSwgZmxhZ3M6IFZpc2l0b3JDb250ZXh0RmxhZykge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGludGVycG9sYXRpb24uZXhwcmVzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zW2ldID1cbiAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbi5leHByZXNzaW9uc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYWxsIGBFeHByZXNzaW9uYHMgaW4gdGhlIEFTVCBvZiBgb3BgIHdpdGggdGhlIGB0cmFuc2Zvcm1gIGZ1bmN0aW9uLlxuICpcbiAqIEFsbCBzdWNoIG9wZXJhdGlvbnMgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZSByZXN1bHQgb2YgYXBwbHlpbmcgYHRyYW5zZm9ybWAsIHdoaWNoIG1heSBiZSBhblxuICogaWRlbnRpdHkgdHJhbnNmb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luT3AoXG4gICAgb3A6IENyZWF0ZU9wfFVwZGF0ZU9wLCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOiB2b2lkIHtcbiAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgY2FzZSBPcEtpbmQuU3R5bGVQcm9wOlxuICAgIGNhc2UgT3BLaW5kLlN0eWxlTWFwOlxuICAgIGNhc2UgT3BLaW5kLkNsYXNzUHJvcDpcbiAgICBjYXNlIE9wS2luZC5DbGFzc01hcDpcbiAgICBjYXNlIE9wS2luZC5CaW5kaW5nOlxuICAgIGNhc2UgT3BLaW5kLkhvc3RQcm9wZXJ0eTpcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlByb3BlcnR5OlxuICAgIGNhc2UgT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIG9wLnNhbml0aXplciA9XG4gICAgICAgICAgb3Auc2FuaXRpemVyICYmIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnNhbml0aXplciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luSW50ZXJwb2xhdGlvbihvcC5pbnRlcnBvbGF0aW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlN0YXRlbWVudDpcbiAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5TdGF0ZW1lbnQob3Auc3RhdGVtZW50LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLlZhcmlhYmxlOlxuICAgICAgb3AuaW5pdGlhbGl6ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5pbml0aWFsaXplciwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5Db25kaXRpb25hbDpcbiAgICAgIGZvciAoY29uc3QgY29uZGl0aW9uIG9mIG9wLmNvbmRpdGlvbnMpIHtcbiAgICAgICAgaWYgKGNvbmRpdGlvblsxXSA9PT0gbnVsbCkge1xuICAgICAgICAgIC8vIFRoaXMgaXMgYSBkZWZhdWx0IGNhc2UuXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uZGl0aW9uWzFdID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oY29uZGl0aW9uWzFdISwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBpZiAob3AucHJvY2Vzc2VkICE9PSBudWxsKSB7XG4gICAgICAgIG9wLnByb2Nlc3NlZCA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKG9wLnByb2Nlc3NlZCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5MaXN0ZW5lcjpcbiAgICAgIGZvciAoY29uc3QgaW5uZXJPcCBvZiBvcC5oYW5kbGVyT3BzKSB7XG4gICAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChpbm5lck9wLCB0cmFuc2Zvcm0sIGZsYWdzIHwgVmlzaXRvckNvbnRleHRGbGFnLkluQ2hpbGRPcGVyYXRpb24pO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuRXh0cmFjdGVkQXR0cmlidXRlOlxuICAgICAgb3AuZXhwcmVzc2lvbiA9XG4gICAgICAgICAgb3AuZXhwcmVzc2lvbiAmJiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkV4dHJhY3RlZE1lc3NhZ2U6XG4gICAgICBvcC5leHByZXNzaW9uID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AuZXhwcmVzc2lvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudCBvZiBvcC5zdGF0ZW1lbnRzKSB7XG4gICAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5TdGF0ZW1lbnQoc3RhdGVtZW50LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgIGZvciAoY29uc3QgcGxhY2Vob2xkZXIgaW4gb3AudGFnTmFtZVBhcmFtcykge1xuICAgICAgICBvcC50YWdOYW1lUGFyYW1zW3BsYWNlaG9sZGVyXSA9XG4gICAgICAgICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC50YWdOYW1lUGFyYW1zW3BsYWNlaG9sZGVyXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5Qcm9qZWN0aW9uOlxuICAgIGNhc2UgT3BLaW5kLlByb2plY3Rpb25EZWY6XG4gICAgY2FzZSBPcEtpbmQuRWxlbWVudDpcbiAgICBjYXNlIE9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgY2FzZSBPcEtpbmQuRWxlbWVudEVuZDpcbiAgICBjYXNlIE9wS2luZC5JMThuOlxuICAgIGNhc2UgT3BLaW5kLkkxOG5FbmQ6XG4gICAgY2FzZSBPcEtpbmQuQ29udGFpbmVyOlxuICAgIGNhc2UgT3BLaW5kLkNvbnRhaW5lclN0YXJ0OlxuICAgIGNhc2UgT3BLaW5kLkNvbnRhaW5lckVuZDpcbiAgICBjYXNlIE9wS2luZC5UZW1wbGF0ZTpcbiAgICBjYXNlIE9wS2luZC5EaXNhYmxlQmluZGluZ3M6XG4gICAgY2FzZSBPcEtpbmQuRW5hYmxlQmluZGluZ3M6XG4gICAgY2FzZSBPcEtpbmQuVGV4dDpcbiAgICBjYXNlIE9wS2luZC5QaXBlOlxuICAgIGNhc2UgT3BLaW5kLkFkdmFuY2U6XG4gICAgY2FzZSBPcEtpbmQuTmFtZXNwYWNlOlxuICAgICAgLy8gVGhlc2Ugb3BlcmF0aW9ucyBjb250YWluIG5vIGV4cHJlc3Npb25zLlxuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcCBkb2Vzbid0IGhhbmRsZSAke09wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbGwgYEV4cHJlc3Npb25gcyBpbiB0aGUgQVNUIG9mIGBleHByYCB3aXRoIHRoZSBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBBbGwgc3VjaCBvcGVyYXRpb25zIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGUgcmVzdWx0IG9mIGFwcGx5aW5nIGB0cmFuc2Zvcm1gLCB3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oXG4gICAgZXhwcjogby5FeHByZXNzaW9uLCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0sIGZsYWdzOiBWaXNpdG9yQ29udGV4dEZsYWcpOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoZXhwciBpbnN0YW5jZW9mIEV4cHJlc3Npb25CYXNlKSB7XG4gICAgZXhwci50cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkJpbmFyeU9wZXJhdG9yRXhwcikge1xuICAgIGV4cHIubGhzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5saHMsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIucmhzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5yaHMsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLlJlYWRQcm9wRXhwcikge1xuICAgIGV4cHIucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5SZWFkS2V5RXhwcikge1xuICAgIGV4cHIucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLmluZGV4ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5pbmRleCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uV3JpdGVQcm9wRXhwcikge1xuICAgIGV4cHIucmVjZWl2ZXIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnJlY2VpdmVyLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uV3JpdGVLZXlFeHByKSB7XG4gICAgZXhwci5yZWNlaXZlciA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIucmVjZWl2ZXIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGV4cHIuaW5kZXggPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmluZGV4LCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICBleHByLnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uSW52b2tlRnVuY3Rpb25FeHByKSB7XG4gICAgZXhwci5mbiA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZm4sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwci5hcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBleHByLmFyZ3NbaV0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmFyZ3NbaV0sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5MaXRlcmFsQXJyYXlFeHByKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByLmVudHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHIuZW50cmllc1tpXSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIuZW50cmllc1tpXSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxNYXBFeHByKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByLmVudHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHIuZW50cmllc1tpXS52YWx1ZSA9XG4gICAgICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5lbnRyaWVzW2ldLnZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoZXhwciBpbnN0YW5jZW9mIG8uQ29uZGl0aW9uYWxFeHByKSB7XG4gICAgZXhwci5jb25kaXRpb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmNvbmRpdGlvbiwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgZXhwci50cnVlQ2FzZSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKGV4cHIudHJ1ZUNhc2UsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGlmIChleHByLmZhbHNlQ2FzZSAhPT0gbnVsbCkge1xuICAgICAgZXhwci5mYWxzZUNhc2UgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmZhbHNlQ2FzZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLlR5cGVvZkV4cHIpIHtcbiAgICBleHByLmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmV4cHIsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLldyaXRlVmFyRXhwcikge1xuICAgIGV4cHIudmFsdWUgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnZhbHVlLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5Mb2NhbGl6ZWRTdHJpbmcpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHIuZXhwcmVzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4cHIuZXhwcmVzc2lvbnNbaV0gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLmV4cHJlc3Npb25zW2ldLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoXG4gICAgICBleHByIGluc3RhbmNlb2Ygby5SZWFkVmFyRXhwciB8fCBleHByIGluc3RhbmNlb2Ygby5FeHRlcm5hbEV4cHIgfHxcbiAgICAgIGV4cHIgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByKSB7XG4gICAgLy8gTm8gYWN0aW9uIGZvciB0aGVzZSB0eXBlcy5cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBleHByZXNzaW9uIGtpbmQ6ICR7ZXhwci5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG4gIHJldHVybiB0cmFuc2Zvcm0oZXhwciwgZmxhZ3MpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbGwgYEV4cHJlc3Npb25gcyBpbiB0aGUgQVNUIG9mIGBzdG10YCB3aXRoIHRoZSBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBBbGwgc3VjaCBvcGVyYXRpb25zIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGUgcmVzdWx0IG9mIGFwcGx5aW5nIGB0cmFuc2Zvcm1gLCB3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvbnNJblN0YXRlbWVudChcbiAgICBzdG10OiBvLlN0YXRlbWVudCwgdHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtLCBmbGFnczogVmlzaXRvckNvbnRleHRGbGFnKTogdm9pZCB7XG4gIGlmIChzdG10IGluc3RhbmNlb2Ygby5FeHByZXNzaW9uU3RhdGVtZW50KSB7XG4gICAgc3RtdC5leHByID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC5leHByLCB0cmFuc2Zvcm0sIGZsYWdzKTtcbiAgfSBlbHNlIGlmIChzdG10IGluc3RhbmNlb2Ygby5SZXR1cm5TdGF0ZW1lbnQpIHtcbiAgICBzdG10LnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gIH0gZWxzZSBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uRGVjbGFyZVZhclN0bXQpIHtcbiAgICBpZiAoc3RtdC52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBzdG10LnZhbHVlID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC52YWx1ZSwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLklmU3RtdCkge1xuICAgIHN0bXQuY29uZGl0aW9uID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oc3RtdC5jb25kaXRpb24sIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIGZvciAoY29uc3QgY2FzZVN0YXRlbWVudCBvZiBzdG10LnRydWVDYXNlKSB7XG4gICAgICB0cmFuc2Zvcm1FeHByZXNzaW9uc0luU3RhdGVtZW50KGNhc2VTdGF0ZW1lbnQsIHRyYW5zZm9ybSwgZmxhZ3MpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNhc2VTdGF0ZW1lbnQgb2Ygc3RtdC5mYWxzZUNhc2UpIHtcbiAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5TdGF0ZW1lbnQoY2FzZVN0YXRlbWVudCwgdHJhbnNmb3JtLCBmbGFncyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIHN0YXRlbWVudCBraW5kOiAke3N0bXQuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGEgc3RyaW5nIGxpdGVyYWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N0cmluZ0xpdGVyYWwoZXhwcjogby5FeHByZXNzaW9uKTogZXhwciBpcyBvLkxpdGVyYWxFeHByJnt2YWx1ZTogc3RyaW5nfSB7XG4gIHJldHVybiBleHByIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwciAmJiB0eXBlb2YgZXhwci52YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG4iXX0=