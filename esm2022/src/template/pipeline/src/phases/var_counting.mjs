/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Counts the number of variable slots used within each view, and stores that on the view itself, as
 * well as propagates it to the `ir.TemplateOp` for embedded views.
 */
export function phaseVarCounting(cpl) {
    // First, count the vars used in each view, and update the view-level counter.
    for (const [_, view] of cpl.views) {
        let varCount = 0;
        for (const op of view.ops()) {
            if (ir.hasConsumesVarsTrait(op)) {
                varCount += varsUsedByOp(op);
            }
            ir.visitExpressionsInOp(op, expr => {
                if (!ir.isIrExpression(expr)) {
                    return;
                }
                // Some expressions require knowledge of the number of variable slots consumed.
                if (ir.hasUsesVarOffsetTrait(expr)) {
                    expr.varOffset = varCount;
                }
                if (ir.hasConsumesVarsTrait(expr)) {
                    varCount += varsUsedByIrExpression(expr);
                }
            });
        }
        view.vars = varCount;
    }
    // Add var counts for each view to the `ir.TemplateOp` which declares that view (if the view is an
    // embedded view).
    for (const [_, view] of cpl.views) {
        for (const op of view.create) {
            if (op.kind !== ir.OpKind.Template) {
                continue;
            }
            const childView = cpl.views.get(op.xref);
            op.vars = childView.vars;
        }
    }
}
/**
 * Different operations that implement `ir.UsesVarsTrait` use different numbers of variables, so
 * count the variables used by any particular `op`.
 */
function varsUsedByOp(op) {
    switch (op.kind) {
        case ir.OpKind.Property:
            // Property bindings use 1 variable slot.
            return 1;
        case ir.OpKind.InterpolateText:
            // `ir.InterpolateTextOp`s use a variable slot for each dynamic expression.
            return op.expressions.length;
        case ir.OpKind.InterpolateProperty:
            // `ir.InterpolatePropertyOp`s use a variable slot for each dynamic expression, plus one for
            // the result.
            return 1 + op.expressions.length;
        default:
            throw new Error(`Unhandled op: ${ir.OpKind[op.kind]}`);
    }
}
export function varsUsedByIrExpression(expr) {
    switch (expr.kind) {
        case ir.ExpressionKind.PureFunctionExpr:
            return 1 + expr.args.length;
        case ir.ExpressionKind.PipeBinding:
            return 1 + expr.args.length;
        case ir.ExpressionKind.PipeBindingVariadic:
            return 1 + expr.numArgs;
        default:
            throw new Error(`AssertionError: unhandled ConsumesVarsTrait expression ${expr.constructor.name}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyX2NvdW50aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdmFyX2NvdW50aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxHQUF5QjtJQUN4RCw4RUFBOEU7SUFDOUUsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDakMsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUMvQixRQUFRLElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQzlCO1lBRUQsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDakMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzVCLE9BQU87aUJBQ1I7Z0JBRUQsK0VBQStFO2dCQUMvRSxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDbEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7aUJBQzNCO2dCQUVELElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNqQyxRQUFRLElBQUksc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQzFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELElBQUksQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDO0tBQ3RCO0lBRUQsa0dBQWtHO0lBQ2xHLGtCQUFrQjtJQUNsQixLQUFLLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUNqQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO2dCQUNsQyxTQUFTO2FBQ1Y7WUFFRCxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUM7WUFDMUMsRUFBRSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO1NBQzFCO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyxZQUFZLENBQUMsRUFBa0Q7SUFDdEUsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1FBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7WUFDckIseUNBQXlDO1lBQ3pDLE9BQU8sQ0FBQyxDQUFDO1FBQ1gsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWU7WUFDNUIsMkVBQTJFO1lBQzNFLE9BQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7UUFDL0IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLG1CQUFtQjtZQUNoQyw0RkFBNEY7WUFDNUYsY0FBYztZQUNkLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO1FBQ25DO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQzFEO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxJQUF3QztJQUM3RSxRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDakIsS0FBSyxFQUFFLENBQUMsY0FBYyxDQUFDLGdCQUFnQjtZQUNyQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUM5QixLQUFLLEVBQUUsQ0FBQyxjQUFjLENBQUMsV0FBVztZQUNoQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUM5QixLQUFLLEVBQUUsQ0FBQyxjQUFjLENBQUMsbUJBQW1CO1lBQ3hDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDMUI7WUFDRSxNQUFNLElBQUksS0FBSyxDQUNYLDBEQUEwRCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7S0FDMUY7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb259IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBDb3VudHMgdGhlIG51bWJlciBvZiB2YXJpYWJsZSBzbG90cyB1c2VkIHdpdGhpbiBlYWNoIHZpZXcsIGFuZCBzdG9yZXMgdGhhdCBvbiB0aGUgdmlldyBpdHNlbGYsIGFzXG4gKiB3ZWxsIGFzIHByb3BhZ2F0ZXMgaXQgdG8gdGhlIGBpci5UZW1wbGF0ZU9wYCBmb3IgZW1iZWRkZWQgdmlld3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVZhckNvdW50aW5nKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24pOiB2b2lkIHtcbiAgLy8gRmlyc3QsIGNvdW50IHRoZSB2YXJzIHVzZWQgaW4gZWFjaCB2aWV3LCBhbmQgdXBkYXRlIHRoZSB2aWV3LWxldmVsIGNvdW50ZXIuXG4gIGZvciAoY29uc3QgW18sIHZpZXddIG9mIGNwbC52aWV3cykge1xuICAgIGxldCB2YXJDb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBvcCBvZiB2aWV3Lm9wcygpKSB7XG4gICAgICBpZiAoaXIuaGFzQ29uc3VtZXNWYXJzVHJhaXQob3ApKSB7XG4gICAgICAgIHZhckNvdW50ICs9IHZhcnNVc2VkQnlPcChvcCk7XG4gICAgICB9XG5cbiAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvbWUgZXhwcmVzc2lvbnMgcmVxdWlyZSBrbm93bGVkZ2Ugb2YgdGhlIG51bWJlciBvZiB2YXJpYWJsZSBzbG90cyBjb25zdW1lZC5cbiAgICAgICAgaWYgKGlyLmhhc1VzZXNWYXJPZmZzZXRUcmFpdChleHByKSkge1xuICAgICAgICAgIGV4cHIudmFyT2Zmc2V0ID0gdmFyQ291bnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXIuaGFzQ29uc3VtZXNWYXJzVHJhaXQoZXhwcikpIHtcbiAgICAgICAgICB2YXJDb3VudCArPSB2YXJzVXNlZEJ5SXJFeHByZXNzaW9uKGV4cHIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2aWV3LnZhcnMgPSB2YXJDb3VudDtcbiAgfVxuXG4gIC8vIEFkZCB2YXIgY291bnRzIGZvciBlYWNoIHZpZXcgdG8gdGhlIGBpci5UZW1wbGF0ZU9wYCB3aGljaCBkZWNsYXJlcyB0aGF0IHZpZXcgKGlmIHRoZSB2aWV3IGlzIGFuXG4gIC8vIGVtYmVkZGVkIHZpZXcpLlxuICBmb3IgKGNvbnN0IFtfLCB2aWV3XSBvZiBjcGwudmlld3MpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlRlbXBsYXRlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjaGlsZFZpZXcgPSBjcGwudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgIG9wLnZhcnMgPSBjaGlsZFZpZXcudmFycztcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaWZmZXJlbnQgb3BlcmF0aW9ucyB0aGF0IGltcGxlbWVudCBgaXIuVXNlc1ZhcnNUcmFpdGAgdXNlIGRpZmZlcmVudCBudW1iZXJzIG9mIHZhcmlhYmxlcywgc29cbiAqIGNvdW50IHRoZSB2YXJpYWJsZXMgdXNlZCBieSBhbnkgcGFydGljdWxhciBgb3BgLlxuICovXG5mdW5jdGlvbiB2YXJzVXNlZEJ5T3Aob3A6IChpci5DcmVhdGVPcHxpci5VcGRhdGVPcCkmaXIuQ29uc3VtZXNWYXJzVHJhaXQpOiBudW1iZXIge1xuICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgIC8vIFByb3BlcnR5IGJpbmRpbmdzIHVzZSAxIHZhcmlhYmxlIHNsb3QuXG4gICAgICByZXR1cm4gMTtcbiAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICAvLyBgaXIuSW50ZXJwb2xhdGVUZXh0T3BgcyB1c2UgYSB2YXJpYWJsZSBzbG90IGZvciBlYWNoIGR5bmFtaWMgZXhwcmVzc2lvbi5cbiAgICAgIHJldHVybiBvcC5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVQcm9wZXJ0eTpcbiAgICAgIC8vIGBpci5JbnRlcnBvbGF0ZVByb3BlcnR5T3BgcyB1c2UgYSB2YXJpYWJsZSBzbG90IGZvciBlYWNoIGR5bmFtaWMgZXhwcmVzc2lvbiwgcGx1cyBvbmUgZm9yXG4gICAgICAvLyB0aGUgcmVzdWx0LlxuICAgICAgcmV0dXJuIDEgKyBvcC5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIG9wOiAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByOiBpci5FeHByZXNzaW9uJmlyLkNvbnN1bWVzVmFyc1RyYWl0KTogbnVtYmVyIHtcbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI6XG4gICAgICByZXR1cm4gMSArIGV4cHIuYXJncy5sZW5ndGg7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZzpcbiAgICAgIHJldHVybiAxICsgZXhwci5hcmdzLmxlbmd0aDtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nVmFyaWFkaWM6XG4gICAgICByZXR1cm4gMSArIGV4cHIubnVtQXJncztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogdW5oYW5kbGVkIENvbnN1bWVzVmFyc1RyYWl0IGV4cHJlc3Npb24gJHtleHByLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cbiJdfQ==