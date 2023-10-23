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
        // Count variables on top-level ops first. Don't explore nested expressions just yet.
        for (const op of unit.ops()) {
            if (ir.hasConsumesVarsTrait(op)) {
                varCount += varsUsedByOp(op);
            }
        }
        // Count variables on expressions inside ops. We do this later because some of these expressions
        // might be conditional (e.g. `pipeBinding` inside of a ternary), and we don't want to interfere
        // with indices for top-level binding slots (e.g. `property`).
        for (const op of unit.ops()) {
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
                if (op.kind !== ir.OpKind.Template && op.kind !== ir.OpKind.RepeaterCreate) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyX2NvdW50aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdmFyX2NvdW50aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9CLE9BQU8sRUFBaUIsdUJBQXVCLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV2RTs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsR0FBbUI7SUFDbEQsOEVBQThFO0lBQzlFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFFakIscUZBQXFGO1FBQ3JGLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUMvQixRQUFRLElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQzlCO1NBQ0Y7UUFFRCxnR0FBZ0c7UUFDaEcsZ0dBQWdHO1FBQ2hHLDhEQUE4RDtRQUM5RCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNqQyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDNUIsT0FBTztpQkFDUjtnQkFFRCwrRUFBK0U7Z0JBQy9FLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNsQyxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztpQkFD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Q0FBQyxjQUFjLENBQUMsV0FBVztZQUNoQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUM5QixLQUFLLEVBQUUsQ0FBQyxjQUFjLENBQUMsbUJBQW1CO1lBQ3hDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDMUI7WUFDRSxNQUFNLElBQUksS0FBSyxDQUNYLDBEQUEwRCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7S0FDMUY7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2IsIENvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ291bnRzIHRoZSBudW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgdXNlZCB3aXRoaW4gZWFjaCB2aWV3LCBhbmQgc3RvcmVzIHRoYXQgb24gdGhlIHZpZXcgaXRzZWxmLCBhc1xuICogd2VsbCBhcyBwcm9wYWdhdGVzIGl0IHRvIHRoZSBgaXIuVGVtcGxhdGVPcGAgZm9yIGVtYmVkZGVkIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VWYXJDb3VudGluZyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIEZpcnN0LCBjb3VudCB0aGUgdmFycyB1c2VkIGluIGVhY2ggdmlldywgYW5kIHVwZGF0ZSB0aGUgdmlldy1sZXZlbCBjb3VudGVyLlxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgbGV0IHZhckNvdW50ID0gMDtcblxuICAgIC8vIENvdW50IHZhcmlhYmxlcyBvbiB0b3AtbGV2ZWwgb3BzIGZpcnN0LiBEb24ndCBleHBsb3JlIG5lc3RlZCBleHByZXNzaW9ucyBqdXN0IHlldC5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgIGlmIChpci5oYXNDb25zdW1lc1ZhcnNUcmFpdChvcCkpIHtcbiAgICAgICAgdmFyQ291bnQgKz0gdmFyc1VzZWRCeU9wKG9wKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb3VudCB2YXJpYWJsZXMgb24gZXhwcmVzc2lvbnMgaW5zaWRlIG9wcy4gV2UgZG8gdGhpcyBsYXRlciBiZWNhdXNlIHNvbWUgb2YgdGhlc2UgZXhwcmVzc2lvbnNcbiAgICAvLyBtaWdodCBiZSBjb25kaXRpb25hbCAoZS5nLiBgcGlwZUJpbmRpbmdgIGluc2lkZSBvZiBhIHRlcm5hcnkpLCBhbmQgd2UgZG9uJ3Qgd2FudCB0byBpbnRlcmZlcmVcbiAgICAvLyB3aXRoIGluZGljZXMgZm9yIHRvcC1sZXZlbCBiaW5kaW5nIHNsb3RzIChlLmcuIGBwcm9wZXJ0eWApLlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgICBpZiAoIWlyLmlzSXJFeHByZXNzaW9uKGV4cHIpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29tZSBleHByZXNzaW9ucyByZXF1aXJlIGtub3dsZWRnZSBvZiB0aGUgbnVtYmVyIG9mIHZhcmlhYmxlIHNsb3RzIGNvbnN1bWVkLlxuICAgICAgICBpZiAoaXIuaGFzVXNlc1Zhck9mZnNldFRyYWl0KGV4cHIpKSB7XG4gICAgICAgICAgZXhwci52YXJPZmZzZXQgPSB2YXJDb3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpci5oYXNDb25zdW1lc1ZhcnNUcmFpdChleHByKSkge1xuICAgICAgICAgIHZhckNvdW50ICs9IHZhcnNVc2VkQnlJckV4cHJlc3Npb24oZXhwcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHVuaXQudmFycyA9IHZhckNvdW50O1xuICB9XG5cbiAgaWYgKGpvYiBpbnN0YW5jZW9mIENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gICAgLy8gQWRkIHZhciBjb3VudHMgZm9yIGVhY2ggdmlldyB0byB0aGUgYGlyLlRlbXBsYXRlT3BgIHdoaWNoIGRlY2xhcmVzIHRoYXQgdmlldyAoaWYgdGhlIHZpZXcgaXNcbiAgICAvLyBhbiBlbWJlZGRlZCB2aWV3KS5cbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuVGVtcGxhdGUgJiYgb3Aua2luZCAhPT0gaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSBqb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgb3AudmFycyA9IGNoaWxkVmlldy52YXJzO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpZmZlcmVudCBvcGVyYXRpb25zIHRoYXQgaW1wbGVtZW50IGBpci5Vc2VzVmFyc1RyYWl0YCB1c2UgZGlmZmVyZW50IG51bWJlcnMgb2YgdmFyaWFibGVzLCBzb1xuICogY291bnQgdGhlIHZhcmlhYmxlcyB1c2VkIGJ5IGFueSBwYXJ0aWN1bGFyIGBvcGAuXG4gKi9cbmZ1bmN0aW9uIHZhcnNVc2VkQnlPcChvcDogKGlyLkNyZWF0ZU9wfGlyLlVwZGF0ZU9wKSZpci5Db25zdW1lc1ZhcnNUcmFpdCk6IG51bWJlciB7XG4gIGxldCBzbG90czogbnVtYmVyO1xuICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICBjYXNlIGlyLk9wS2luZC5Ib3N0UHJvcGVydHk6XG4gICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgLy8gQWxsIG9mIHRoZXNlIGJpbmRpbmdzIHVzZSAxIHZhcmlhYmxlIHNsb3QsIHBsdXMgMSBzbG90IGZvciBldmVyeSBpbnRlcnBvbGF0ZWQgZXhwcmVzc2lvbixcbiAgICAgIC8vIGlmIGFueS5cbiAgICAgIHNsb3RzID0gMTtcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICBzbG90cyArPSBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzbG90cztcbiAgICBjYXNlIGlyLk9wS2luZC5TdHlsZVByb3A6XG4gICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlTWFwOlxuICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzTWFwOlxuICAgICAgLy8gU3R5bGUgJiBjbGFzcyBiaW5kaW5ncyB1c2UgMiB2YXJpYWJsZSBzbG90cywgcGx1cyAxIHNsb3QgZm9yIGV2ZXJ5IGludGVycG9sYXRlZCBleHByZXNzaW9uLFxuICAgICAgLy8gaWYgYW55LlxuICAgICAgc2xvdHMgPSAyO1xuICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHNsb3RzICs9IG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNsb3RzO1xuICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgIC8vIGBpci5JbnRlcnBvbGF0ZVRleHRPcGBzIHVzZSBhIHZhcmlhYmxlIHNsb3QgZm9yIGVhY2ggZHluYW1pYyBleHByZXNzaW9uLlxuICAgICAgcmV0dXJuIG9wLmludGVycG9sYXRpb24uZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uOlxuICAgIGNhc2UgaXIuT3BLaW5kLkNvbmRpdGlvbmFsOlxuICAgICAgcmV0dXJuIDE7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIG9wOiAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByOiBpci5FeHByZXNzaW9uJmlyLkNvbnN1bWVzVmFyc1RyYWl0KTogbnVtYmVyIHtcbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI6XG4gICAgICByZXR1cm4gMSArIGV4cHIuYXJncy5sZW5ndGg7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZzpcbiAgICAgIHJldHVybiAxICsgZXhwci5hcmdzLmxlbmd0aDtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nVmFyaWFkaWM6XG4gICAgICByZXR1cm4gMSArIGV4cHIubnVtQXJncztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogdW5oYW5kbGVkIENvbnN1bWVzVmFyc1RyYWl0IGV4cHJlc3Npb24gJHtleHByLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cbiJdfQ==