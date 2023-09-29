/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
import { ComponentCompilationJob } from '../compilation';
/**
 * Counts the number of variable slots used within each view, and stores that on the view itself, as
 * well as propagates it to the `ir.TemplateOp` for embedded views.
 */
export function phaseVarCounting(job) {
    // First, count the vars used in each view, and update the view-level counter.
    for (const unit of job.units) {
        let varCount = 0;
        for (const op of unit.ops()) {
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
        unit.vars = varCount;
    }
    if (job instanceof ComponentCompilationJob) {
        // Add var counts for each view to the `ir.TemplateOp` which declares that view (if the view is
        // an embedded view).
        for (const unit of job.units) {
            for (const op of unit.create) {
                if (op.kind !== ir.OpKind.Template) {
                    continue;
                }
                const childView = job.views.get(op.xref);
                op.vars = childView.vars;
            }
        }
    }
}
/**
 * Different operations that implement `ir.UsesVarsTrait` use different numbers of variables, so
 * count the variables used by any particular `op`.
 */
function varsUsedByOp(op) {
    let slots;
    switch (op.kind) {
        case ir.OpKind.Property:
        case ir.OpKind.HostProperty:
        case ir.OpKind.Attribute:
            // All of these bindings use 1 variable slot, plus 1 slot for every interpolated expression,
            // if any.
            slots = 1;
            if (op.expression instanceof ir.Interpolation) {
                slots += op.expression.expressions.length;
            }
            return slots;
        case ir.OpKind.StyleProp:
        case ir.OpKind.ClassProp:
        case ir.OpKind.StyleMap:
        case ir.OpKind.ClassMap:
            // Style & class bindings use 2 variable slots, plus 1 slot for every interpolated expression,
            // if any.
            slots = 2;
            if (op.expression instanceof ir.Interpolation) {
                slots += op.expression.expressions.length;
            }
            return slots;
        case ir.OpKind.InterpolateText:
            // `ir.InterpolateTextOp`s use a variable slot for each dynamic expression.
            return op.interpolation.expressions.length;
        case ir.OpKind.I18nExpression:
        case ir.OpKind.Conditional:
            return 1;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyX2NvdW50aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdmFyX2NvdW50aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9CLE9BQU8sRUFBaUIsdUJBQXVCLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV2RTs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsR0FBbUI7SUFDbEQsOEVBQThFO0lBQzlFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFDakIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDM0IsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQy9CLFFBQVEsSUFBSSxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDOUI7WUFFRCxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNqQyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDNUIsT0FBTztpQkFDUjtnQkFFRCwrRUFBK0U7Z0JBQy9FLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNsQyxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztpQkFDM0I7Z0JBRUQsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ2pDLFFBQVEsSUFBSSxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDMUM7WUFDSCxD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Q0UsTUFBTSxJQUFJLEtBQUssQ0FDWCwwREFBMEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0tBQzFGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9iLCBDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIENvdW50cyB0aGUgbnVtYmVyIG9mIHZhcmlhYmxlIHNsb3RzIHVzZWQgd2l0aGluIGVhY2ggdmlldywgYW5kIHN0b3JlcyB0aGF0IG9uIHRoZSB2aWV3IGl0c2VsZiwgYXNcbiAqIHdlbGwgYXMgcHJvcGFnYXRlcyBpdCB0byB0aGUgYGlyLlRlbXBsYXRlT3BgIGZvciBlbWJlZGRlZCB2aWV3cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlVmFyQ291bnRpbmcoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICAvLyBGaXJzdCwgY291bnQgdGhlIHZhcnMgdXNlZCBpbiBlYWNoIHZpZXcsIGFuZCB1cGRhdGUgdGhlIHZpZXctbGV2ZWwgY291bnRlci5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGxldCB2YXJDb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBpZiAoaXIuaGFzQ29uc3VtZXNWYXJzVHJhaXQob3ApKSB7XG4gICAgICAgIHZhckNvdW50ICs9IHZhcnNVc2VkQnlPcChvcCk7XG4gICAgICB9XG5cbiAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvbWUgZXhwcmVzc2lvbnMgcmVxdWlyZSBrbm93bGVkZ2Ugb2YgdGhlIG51bWJlciBvZiB2YXJpYWJsZSBzbG90cyBjb25zdW1lZC5cbiAgICAgICAgaWYgKGlyLmhhc1VzZXNWYXJPZmZzZXRUcmFpdChleHByKSkge1xuICAgICAgICAgIGV4cHIudmFyT2Zmc2V0ID0gdmFyQ291bnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXIuaGFzQ29uc3VtZXNWYXJzVHJhaXQoZXhwcikpIHtcbiAgICAgICAgICB2YXJDb3VudCArPSB2YXJzVXNlZEJ5SXJFeHByZXNzaW9uKGV4cHIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB1bml0LnZhcnMgPSB2YXJDb3VudDtcbiAgfVxuXG4gIGlmIChqb2IgaW5zdGFuY2VvZiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAgIC8vIEFkZCB2YXIgY291bnRzIGZvciBlYWNoIHZpZXcgdG8gdGhlIGBpci5UZW1wbGF0ZU9wYCB3aGljaCBkZWNsYXJlcyB0aGF0IHZpZXcgKGlmIHRoZSB2aWV3IGlzXG4gICAgLy8gYW4gZW1iZWRkZWQgdmlldykuXG4gICAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlRlbXBsYXRlKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSBqb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgb3AudmFycyA9IGNoaWxkVmlldy52YXJzO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpZmZlcmVudCBvcGVyYXRpb25zIHRoYXQgaW1wbGVtZW50IGBpci5Vc2VzVmFyc1RyYWl0YCB1c2UgZGlmZmVyZW50IG51bWJlcnMgb2YgdmFyaWFibGVzLCBzb1xuICogY291bnQgdGhlIHZhcmlhYmxlcyB1c2VkIGJ5IGFueSBwYXJ0aWN1bGFyIGBvcGAuXG4gKi9cbmZ1bmN0aW9uIHZhcnNVc2VkQnlPcChvcDogKGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wKSZpci5Db25zdW1lc1ZhcnNUcmFpdCk6IG51bWJlciB7XG4gIGxldCBzbG90czogbnVtYmVyO1xuICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgLy8gQWxsIG9mIHRoZXNlIGJpbmRpbmdzIHVzZSAxIHZhcmlhYmxlIHNsb3QsIHBsdXMgMSBzbG90IGZvciBldmVyeSBpbnRlcnBvbGF0ZWQgZXhwcmVzc2lvbixcbiAgICAgIC8vIGlmIGFueS5cbiAgICAgIHNsb3RzID0gMTtcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICBzbG90cyArPSBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzbG90cztcbiAgICBjYXNlIGlyLk9wS2luZC5TdHlsZVByb3A6XG4gICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlTWFwOlxuICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzTWFwOlxuICAgICAgLy8gU3R5bGUgJiBjbGFzcyBiaW5kaW5ncyB1c2UgMiB2YXJpYWJsZSBzbG90cywgcGx1cyAxIHNsb3QgZm9yIGV2ZXJ5IGludGVycG9sYXRlZCBleHByZXNzaW9uLFxuICAgICAgLy8gaWYgYW55LlxuICAgICAgc2xvdHMgPSAyO1xuICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHNsb3RzICs9IG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNsb3RzO1xuICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgIC8vIGBpci5JbnRlcnBvbGF0ZVRleHRPcGBzIHVzZSBhIHZhcmlhYmxlIHNsb3QgZm9yIGVhY2ggZHluYW1pYyBleHByZXNzaW9uLlxuICAgICAgcmV0dXJuIG9wLmludGVycG9sYXRpb24uZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uOlxuICAgIGNhc2UgaXIuT3BLaW5kLkNvbmRpdGlvbmFsOlxuICAgICAgcmV0dXJuIDE7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIG9wOiAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByOiBpci5FeHByZXNzaW9uJmlyLkNvbnN1bWVzVmFyc1RyYWl0KTogbnVtYmVyIHtcbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI6XG4gICAgICByZXR1cm4gMSArIGV4cHIuYXJncy5sZW5ndGg7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZzpcbiAgICAgIHJldHVybiAxICsgZXhwci5hcmdzLmxlbmd0aDtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nVmFyaWFkaWM6XG4gICAgICByZXR1cm4gMSArIGV4cHIubnVtQXJncztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogdW5oYW5kbGVkIENvbnN1bWVzVmFyc1RyYWl0IGV4cHJlc3Npb24gJHtleHByLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cbiJdfQ==