/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var _a;
import * as o from '../../../../output/output_ast';
import { ExpressionKind, OpKind } from './enums';
import { UsesSlotIndex } from './traits';
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
}
/**
 * Runtime operation to navigate to the next view context in the view hierarchy.
 */
export class NextContextExpr extends ExpressionBase {
    constructor() {
        super();
        this.kind = ExpressionKind.NextContext;
    }
    visitExpression() { }
    isEquivalent(e) {
        return e instanceof NextContextExpr;
    }
    isConstant() {
        return false;
    }
    transformInternalExpressions() { }
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
    transformInternalExpressions(transform) {
        if (typeof this.view !== 'number') {
            this.view = transformExpressionsInExpression(this.view, transform);
        }
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
    transformInternalExpressions(transform) {
        this.expr = transformExpressionsInExpression(this.expr, transform);
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
}
/**
 * Visits all `Expression`s in the AST of `op` with the `visitor` function.
 */
export function visitExpressionsInOp(op, visitor) {
    transformExpressionsInOp(op, (expr) => {
        visitor(expr);
        return expr;
    });
}
/**
 * Transform all `Expression`s in the AST of `op` with the `transform` function.
 *
 * All such operations will be replaced with the result of applying `transform`, which may be an
 * identity transformation.
 */
export function transformExpressionsInOp(op, transform) {
    switch (op.kind) {
        case OpKind.Property:
            op.expression = transformExpressionsInExpression(op.expression, transform);
            break;
        case OpKind.Statement:
            transformExpressionsInStatement(op.statement, transform);
            break;
        case OpKind.Variable:
            op.initializer = transformExpressionsInExpression(op.initializer, transform);
            break;
        case OpKind.InterpolateText:
            for (let i = 0; i < op.expressions.length; i++) {
                op.expressions[i] = transformExpressionsInExpression(op.expressions[i], transform);
            }
            break;
        case OpKind.Listener:
            for (const innerOp of op.handlerOps) {
                transformExpressionsInOp(innerOp, transform);
            }
            break;
        case OpKind.Element:
        case OpKind.ElementStart:
        case OpKind.ElementEnd:
        case OpKind.Template:
        case OpKind.Text:
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
export function transformExpressionsInExpression(expr, transform) {
    if (expr instanceof ExpressionBase) {
        expr.transformInternalExpressions(transform);
        return transform(expr);
    }
    else if (expr instanceof o.BinaryOperatorExpr) {
        expr.lhs = transformExpressionsInExpression(expr.lhs, transform);
        expr.rhs = transformExpressionsInExpression(expr.rhs, transform);
    }
    else if (expr instanceof o.ReadPropExpr) {
        expr.receiver = transformExpressionsInExpression(expr.receiver, transform);
    }
    else if (expr instanceof o.InvokeFunctionExpr) {
        expr.fn = transformExpressionsInExpression(expr.fn, transform);
        for (let i = 0; i < expr.args.length; i++) {
            expr.args[i] = transformExpressionsInExpression(expr.args[i], transform);
        }
    }
    else if (expr instanceof o.ReadVarExpr || expr instanceof o.ExternalExpr ||
        expr instanceof o.LiteralExpr) {
        // No action for these types.
    }
    else {
        throw new Error(`Unhandled expression kind: ${expr.constructor.name}`);
    }
    return expr;
}
/**
 * Transform all `Expression`s in the AST of `stmt` with the `transform` function.
 *
 * All such operations will be replaced with the result of applying `transform`, which may be an
 * identity transformation.
 */
export function transformExpressionsInStatement(stmt, transform) {
    if (stmt instanceof o.ExpressionStatement) {
        stmt.expr = transformExpressionsInExpression(stmt.expr, transform);
    }
    else if (stmt instanceof o.ReturnStatement) {
        stmt.value = transformExpressionsInExpression(stmt.value, transform);
    }
    else {
        throw new Error(`Unhandled statement kind: ${stmt.constructor.name}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9pci9zcmMvZXhwcmVzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUduRCxPQUFPLEVBQUMsY0FBYyxFQUFFLE1BQU0sRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUMvQyxPQUFPLEVBQUMsYUFBYSxFQUF5QixNQUFNLFVBQVUsQ0FBQztBQWtCL0Q7O0dBRUc7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUFDLElBQWtCO0lBQy9DLE9BQU8sSUFBSSxZQUFZLGNBQWMsQ0FBQztBQUN4QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQWdCLGNBQWUsU0FBUSxDQUFDLENBQUMsVUFBVTtJQUd2RCxZQUFZLGFBQW1DLElBQUk7UUFDakQsS0FBSyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMxQixDQUFDO0NBT0Y7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyxlQUFnQixTQUFRLGNBQWM7SUFHakQsWUFBcUIsSUFBWTtRQUMvQixLQUFLLEVBQUUsQ0FBQztRQURXLFNBQUksR0FBSixJQUFJLENBQVE7UUFGZixTQUFJLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQztJQUlwRCxDQUFDO0lBRVEsZUFBZSxDQUFDLE9BQTRCLEVBQUUsT0FBWSxJQUFTLENBQUM7SUFFcEUsWUFBWTtRQUNuQixPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFUSxVQUFVO1FBQ2pCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVRLDRCQUE0QixLQUFVLENBQUM7Q0FDakQ7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyxhQUFjLFNBQVEsY0FBYztrQkFHdEMsYUFBYTtJ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Z0NBQWdDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztLQUNwRTtTQUFNLElBQUksSUFBSSxZQUFZLENBQUMsQ0FBQyxlQUFlLEVBQUU7UUFDNUMsSUFBSSxDQUFDLEtBQUssR0FBRyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQ3RFO1NBQU07UUFDTCxNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7S0FDdkU7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHR5cGUge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vLi4vLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCB7RXhwcmVzc2lvbktpbmQsIE9wS2luZH0gZnJvbSAnLi9lbnVtcyc7XG5pbXBvcnQge1VzZXNTbG90SW5kZXgsIFVzZXNTbG90SW5kZXhFeHByVHJhaXR9IGZyb20gJy4vdHJhaXRzJztcblxuaW1wb3J0IHR5cGUge1hyZWZJZH0gZnJvbSAnLi9vcGVyYXRpb25zJztcbmltcG9ydCB0eXBlIHtDcmVhdGVPcH0gZnJvbSAnLi9vcHMvY3JlYXRlJztcbmltcG9ydCB0eXBlIHtVcGRhdGVPcH0gZnJvbSAnLi9vcHMvdXBkYXRlJztcblxuLyoqXG4gKiBBbiBgby5FeHByZXNzaW9uYCBzdWJ0eXBlIHJlcHJlc2VudGluZyBhIGxvZ2ljYWwgZXhwcmVzc2lvbiBpbiB0aGUgaW50ZXJtZWRpYXRlIHJlcHJlc2VudGF0aW9uLlxuICovXG5leHBvcnQgdHlwZSBFeHByZXNzaW9uID0gTGV4aWNhbFJlYWRFeHByfFJlZmVyZW5jZUV4cHJ8Q29udGV4dEV4cHJ8TmV4dENvbnRleHRFeHByfFxuICAgIEdldEN1cnJlbnRWaWV3RXhwcnxSZXN0b3JlVmlld0V4cHJ8UmVzZXRWaWV3RXhwcnxSZWFkVmFyaWFibGVFeHByO1xuXG4vKipcbiAqIFRyYW5zZm9ybWVyIHR5cGUgd2hpY2ggY29udmVydHMgSVIgZXhwcmVzc2lvbnMgaW50byBnZW5lcmFsIGBvLkV4cHJlc3Npb25gcyAod2hpY2ggbWF5IGJlIGFuXG4gKiBpZGVudGl0eSB0cmFuc2Zvcm1hdGlvbikuXG4gKi9cbmV4cG9ydCB0eXBlIEV4cHJlc3Npb25UcmFuc2Zvcm0gPSAoZXhwcjogRXhwcmVzc2lvbikgPT4gby5FeHByZXNzaW9uO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgYSBnaXZlbiBgby5FeHByZXNzaW9uYCBpcyBhIGxvZ2ljYWwgSVIgZXhwcmVzc2lvbiB0eXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNJckV4cHJlc3Npb24oZXhwcjogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiBleHByIGluc3RhbmNlb2YgRXhwcmVzc2lvbkJhc2U7XG59XG5cbi8qKlxuICogQmFzZSB0eXBlIHVzZWQgZm9yIGFsbCBsb2dpY2FsIElSIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXhwcmVzc2lvbkJhc2UgZXh0ZW5kcyBvLkV4cHJlc3Npb24ge1xuICBhYnN0cmFjdCByZWFkb25seSBraW5kOiBFeHByZXNzaW9uS2luZDtcblxuICBjb25zdHJ1Y3Rvcihzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwpIHtcbiAgICBzdXBlcihudWxsLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSdW4gdGhlIHRyYW5zZm9ybWVyIGFnYWluc3QgYW55IG5lc3RlZCBleHByZXNzaW9ucyB3aGljaCBtYXkgYmUgcHJlc2VudCBpbiB0aGlzIElSIGV4cHJlc3Npb25cbiAgICogc3VidHlwZS5cbiAgICovXG4gIGFic3RyYWN0IHRyYW5zZm9ybUludGVybmFsRXhwcmVzc2lvbnModHJhbnNmb3JtOiBFeHByZXNzaW9uVHJhbnNmb3JtKTogdm9pZDtcbn1cblxuLyoqXG4gKiBMb2dpY2FsIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgbGV4aWNhbCByZWFkIG9mIGEgdmFyaWFibGUgbmFtZS5cbiAqL1xuZXhwb3J0IGNsYXNzIExleGljYWxSZWFkRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLkxleGljYWxSZWFkO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IG5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24odmlzaXRvcjogby5FeHByZXNzaW9uVmlzaXRvciwgY29udGV4dDogYW55KTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlwqBpc0VxdWl2YWxlbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXRyaWV2ZSB0aGUgdmFsdWUgb2YgYSBsb2NhbCByZWZlcmVuY2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2VFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2UgaW1wbGVtZW50cyBVc2VzU2xvdEluZGV4RXhwclRyYWl0IHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlZmVyZW5jZTtcblxuICByZWFkb25seVtVc2VzU2xvdEluZGV4XSA9IHRydWU7XG5cbiAgc2xvdDogbnVtYmVyfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHRhcmdldDogWHJlZklkLCByZWFkb25seSBvZmZzZXQ6IG51bWJlcikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24oKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIFJlZmVyZW5jZUV4cHIgJiYgZS50YXJnZXQgPT09IHRoaXMudGFyZ2V0O1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQgKHVzdWFsbHkgdGhlIGBjdHhgIHZhcmlhYmxlIGluIGEgdGVtcGxhdGUgZnVuY3Rpb24pLlxuICovXG5leHBvcnQgY2xhc3MgQ29udGV4dEV4cHIgZXh0ZW5kcyBFeHByZXNzaW9uQmFzZSB7XG4gIG92ZXJyaWRlIHJlYWRvbmx5IGtpbmQgPSBFeHByZXNzaW9uS2luZC5Db250ZXh0O1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHZpZXc6IFhyZWZJZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdEV4cHJlc3Npb24oKTogdm9pZCB7fVxuXG4gIG92ZXJyaWRlIGlzRXF1aXZhbGVudChlOiBvLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZSBpbnN0YW5jZW9mIENvbnRleHRFeHByICYmIGUudmlldyA9PT0gdGhpcy52aWV3O1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byBuYXZpZ2F0ZSB0byB0aGUgbmV4dCB2aWV3IGNvbnRleHQgaW4gdGhlIHZpZXcgaGllcmFyY2h5LlxuICovXG5leHBvcnQgY2xhc3MgTmV4dENvbnRleHRFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuTmV4dENvbnRleHQ7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgTmV4dENvbnRleHRFeHByO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byBzbmFwc2hvdCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuXG4gKlxuICogVGhlIHJlc3VsdCBvZiB0aGlzIG9wZXJhdGlvbiBjYW4gYmUgc3RvcmVkIGluIGEgdmFyaWFibGUgYW5kIGxhdGVyIHVzZWQgd2l0aCB0aGUgYFJlc3RvcmVWaWV3YFxuICogb3BlcmF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgR2V0Q3VycmVudFZpZXdFeHByIGV4dGVuZHMgRXhwcmVzc2lvbkJhc2Uge1xuICBvdmVycmlkZSByZWFkb25seSBraW5kID0gRXhwcmVzc2lvbktpbmQuR2V0Q3VycmVudFZpZXc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbigpOiB2b2lkIHt9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgR2V0Q3VycmVudFZpZXdFeHByO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXN0b3JlIGEgc25hcHNob3R0ZWQgdmlldy5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlc3RvcmVWaWV3RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlc3RvcmVWaWV3O1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB2aWV3OiBYcmVmSWR8by5FeHByZXNzaW9uKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiB2b2lkIHtcbiAgICBpZiAodHlwZW9mIHRoaXMudmlldyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRoaXMudmlldy52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNFcXVpdmFsZW50KGU6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmICghKGUgaW5zdGFuY2VvZiBSZXN0b3JlVmlld0V4cHIpIHx8IHR5cGVvZiBlLnZpZXcgIT09IHR5cGVvZiB0aGlzLnZpZXcpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRoaXMudmlldyA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiB0aGlzLnZpZXcgPT09IGUudmlldztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMudmlldy5pc0VxdWl2YWxlbnQoZS52aWV3IGFzIG8uRXhwcmVzc2lvbik7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSk6IHZvaWQge1xuICAgIGlmICh0eXBlb2YgdGhpcy52aWV3ICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhpcy52aWV3ID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24odGhpcy52aWV3LCB0cmFuc2Zvcm0pO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc2V0IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCBhZnRlciBgUmVzdG9yZVZpZXdgLlxuICovXG5leHBvcnQgY2xhc3MgUmVzZXRWaWV3RXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlc2V0VmlldztcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXhwcjogby5FeHByZXNzaW9uKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0RXhwcmVzc2lvbih2aXNpdG9yOiBvLkV4cHJlc3Npb25WaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMuZXhwci52aXNpdEV4cHJlc3Npb24odmlzaXRvciwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQoZTogby5FeHByZXNzaW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBSZXNldFZpZXdFeHByICYmIHRoaXMuZXhwci5pc0VxdWl2YWxlbnQoZS5leHByKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGlzQ29uc3RhbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgb3ZlcnJpZGUgdHJhbnNmb3JtSW50ZXJuYWxFeHByZXNzaW9ucyh0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0pOiB2b2lkIHtcbiAgICB0aGlzLmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbih0aGlzLmV4cHIsIHRyYW5zZm9ybSk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZWFkIG9mIGEgdmFyaWFibGUgZGVjbGFyZWQgYXMgYW4gYGlyLlZhcmlhYmxlT3BgIGFuZCByZWZlcmVuY2VkIHRocm91Z2ggaXRzIGBpci5YcmVmSWRgLlxuICovXG5leHBvcnQgY2xhc3MgUmVhZFZhcmlhYmxlRXhwciBleHRlbmRzIEV4cHJlc3Npb25CYXNlIHtcbiAgb3ZlcnJpZGUgcmVhZG9ubHkga2luZCA9IEV4cHJlc3Npb25LaW5kLlJlYWRWYXJpYWJsZTtcbiAgbmFtZTogc3RyaW5nfG51bGwgPSBudWxsO1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSB4cmVmOiBYcmVmSWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRFeHByZXNzaW9uKCk6IHZvaWQge31cblxuICBvdmVycmlkZSBpc0VxdWl2YWxlbnQob3RoZXI6IG8uRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBvdGhlciBpbnN0YW5jZW9mIFJlYWRWYXJpYWJsZUV4cHIgJiYgb3RoZXIueHJlZiA9PT0gdGhpcy54cmVmO1xuICB9XG5cbiAgb3ZlcnJpZGUgaXNDb25zdGFudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBvdmVycmlkZSB0cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKCk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBWaXNpdHMgYWxsIGBFeHByZXNzaW9uYHMgaW4gdGhlIEFTVCBvZiBgb3BgIHdpdGggdGhlIGB2aXNpdG9yYCBmdW5jdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZpc2l0RXhwcmVzc2lvbnNJbk9wKFxuICAgIG9wOiBDcmVhdGVPcHxVcGRhdGVPcCwgdmlzaXRvcjogKGV4cHI6IEV4cHJlc3Npb24pID0+IHZvaWQpOiB2b2lkIHtcbiAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJbk9wKG9wLCAoZXhwcikgPT4ge1xuICAgIHZpc2l0b3IoZXhwcik7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH0pO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbGwgYEV4cHJlc3Npb25gcyBpbiB0aGUgQVNUIG9mIGBvcGAgd2l0aCB0aGUgYHRyYW5zZm9ybWAgZnVuY3Rpb24uXG4gKlxuICogQWxsIHN1Y2ggb3BlcmF0aW9ucyB3aWxsIGJlIHJlcGxhY2VkIHdpdGggdGhlIHJlc3VsdCBvZiBhcHBseWluZyBgdHJhbnNmb3JtYCwgd2hpY2ggbWF5IGJlIGFuXG4gKiBpZGVudGl0eSB0cmFuc2Zvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChcbiAgICBvcDogQ3JlYXRlT3B8VXBkYXRlT3AsIHRyYW5zZm9ybTogRXhwcmVzc2lvblRyYW5zZm9ybSk6IHZvaWQge1xuICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICBjYXNlIE9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgIG9wLmV4cHJlc3Npb24gPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihvcC5leHByZXNzaW9uLCB0cmFuc2Zvcm0pO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuU3RhdGVtZW50OlxuICAgICAgdHJhbnNmb3JtRXhwcmVzc2lvbnNJblN0YXRlbWVudChvcC5zdGF0ZW1lbnQsIHRyYW5zZm9ybSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5WYXJpYWJsZTpcbiAgICAgIG9wLmluaXRpYWxpemVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AuaW5pdGlhbGl6ZXIsIHRyYW5zZm9ybSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wLmV4cHJlc3Npb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9wLmV4cHJlc3Npb25zW2ldID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24ob3AuZXhwcmVzc2lvbnNbaV0sIHRyYW5zZm9ybSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIE9wS2luZC5MaXN0ZW5lcjpcbiAgICAgIGZvciAoY29uc3QgaW5uZXJPcCBvZiBvcC5oYW5kbGVyT3BzKSB7XG4gICAgICAgIHRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcChpbm5lck9wLCB0cmFuc2Zvcm0pO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBPcEtpbmQuRWxlbWVudDpcbiAgICBjYXNlIE9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgY2FzZSBPcEtpbmQuRWxlbWVudEVuZDpcbiAgICBjYXNlIE9wS2luZC5UZW1wbGF0ZTpcbiAgICBjYXNlIE9wS2luZC5UZXh0OlxuICAgICAgLy8gVGhlc2Ugb3BlcmF0aW9ucyBjb250YWluIG5vIGV4cHJlc3Npb25zLlxuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5PcCBkb2Vzbid0IGhhbmRsZSAke09wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbGwgYEV4cHJlc3Npb25gcyBpbiB0aGUgQVNUIG9mIGBleHByYCB3aXRoIHRoZSBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBBbGwgc3VjaCBvcGVyYXRpb25zIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGUgcmVzdWx0IG9mIGFwcGx5aW5nIGB0cmFuc2Zvcm1gLCB3aGljaCBtYXkgYmUgYW5cbiAqIGlkZW50aXR5IHRyYW5zZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oXG4gICAgZXhwcjogby5FeHByZXNzaW9uLCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0pOiBvLkV4cHJlc3Npb24ge1xuICBpZiAoZXhwciBpbnN0YW5jZW9mIEV4cHJlc3Npb25CYXNlKSB7XG4gICAgZXhwci50cmFuc2Zvcm1JbnRlcm5hbEV4cHJlc3Npb25zKHRyYW5zZm9ybSk7XG4gICAgcmV0dXJuIHRyYW5zZm9ybShleHByIGFzIEV4cHJlc3Npb24pO1xuICB9IGVsc2UgaWYgKGV4cHIgaW5zdGFuY2VvZiBvLkJpbmFyeU9wZXJhdG9yRXhwcikge1xuICAgIGV4cHIubGhzID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5saHMsIHRyYW5zZm9ybSk7XG4gICAgZXhwci5yaHMgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihleHByLnJocywgdHJhbnNmb3JtKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5SZWFkUHJvcEV4cHIpIHtcbiAgICBleHByLnJlY2VpdmVyID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5yZWNlaXZlciwgdHJhbnNmb3JtKTtcbiAgfSBlbHNlIGlmIChleHByIGluc3RhbmNlb2Ygby5JbnZva2VGdW5jdGlvbkV4cHIpIHtcbiAgICBleHByLmZuID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5mbiwgdHJhbnNmb3JtKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHIuYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgZXhwci5hcmdzW2ldID0gdHJhbnNmb3JtRXhwcmVzc2lvbnNJbkV4cHJlc3Npb24oZXhwci5hcmdzW2ldLCB0cmFuc2Zvcm0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChcbiAgICAgIGV4cHIgaW5zdGFuY2VvZiBvLlJlYWRWYXJFeHByIHx8IGV4cHIgaW5zdGFuY2VvZiBvLkV4dGVybmFsRXhwciB8fFxuICAgICAgZXhwciBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIpIHtcbiAgICAvLyBObyBhY3Rpb24gZm9yIHRoZXNlIHR5cGVzLlxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIGV4cHJlc3Npb24ga2luZDogJHtleHByLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbiAgcmV0dXJuIGV4cHI7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIGFsbCBgRXhwcmVzc2lvbmBzIGluIHRoZSBBU1Qgb2YgYHN0bXRgIHdpdGggdGhlIGB0cmFuc2Zvcm1gIGZ1bmN0aW9uLlxuICpcbiAqIEFsbCBzdWNoIG9wZXJhdGlvbnMgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZSByZXN1bHQgb2YgYXBwbHlpbmcgYHRyYW5zZm9ybWAsIHdoaWNoIG1heSBiZSBhblxuICogaWRlbnRpdHkgdHJhbnNmb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1FeHByZXNzaW9uc0luU3RhdGVtZW50KFxuICAgIHN0bXQ6IG8uU3RhdGVtZW50LCB0cmFuc2Zvcm06IEV4cHJlc3Npb25UcmFuc2Zvcm0pOiB2b2lkIHtcbiAgaWYgKHN0bXQgaW5zdGFuY2VvZiBvLkV4cHJlc3Npb25TdGF0ZW1lbnQpIHtcbiAgICBzdG10LmV4cHIgPSB0cmFuc2Zvcm1FeHByZXNzaW9uc0luRXhwcmVzc2lvbihzdG10LmV4cHIsIHRyYW5zZm9ybSk7XG4gIH0gZWxzZSBpZiAoc3RtdCBpbnN0YW5jZW9mIG8uUmV0dXJuU3RhdGVtZW50KSB7XG4gICAgc3RtdC52YWx1ZSA9IHRyYW5zZm9ybUV4cHJlc3Npb25zSW5FeHByZXNzaW9uKHN0bXQudmFsdWUsIHRyYW5zZm9ybSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmhhbmRsZWQgc3RhdGVtZW50IGtpbmQ6ICR7c3RtdC5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG4iXX0=