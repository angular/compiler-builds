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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyX2NvdW50aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdmFyX2NvdW50aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9CLE9BQU8sRUFBaUIsdUJBQXVCLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV2RTs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsR0FBbUI7SUFDbEQsOEVBQThFO0lBQzlFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFDakIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDM0IsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQy9CLFFBQVEsSUFBSSxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDOUI7WUFFRCxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNqQyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDNUIsT0FBTztpQkFDUjtnQkFFRCwrRUFBK0U7Z0JBQy9FLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNsQyxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztpQkFDM0I7Z0JBRUQsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ2pDLFFBQVEsSUFBSSxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDMUM7WUFDSCxD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QUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztLQUMxRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYiwgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBDb3VudHMgdGhlIG51bWJlciBvZiB2YXJpYWJsZSBzbG90cyB1c2VkIHdpdGhpbiBlYWNoIHZpZXcsIGFuZCBzdG9yZXMgdGhhdCBvbiB0aGUgdmlldyBpdHNlbGYsIGFzXG4gKiB3ZWxsIGFzIHByb3BhZ2F0ZXMgaXQgdG8gdGhlIGBpci5UZW1wbGF0ZU9wYCBmb3IgZW1iZWRkZWQgdmlld3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVZhckNvdW50aW5nKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgLy8gRmlyc3QsIGNvdW50IHRoZSB2YXJzIHVzZWQgaW4gZWFjaCB2aWV3LCBhbmQgdXBkYXRlIHRoZSB2aWV3LWxldmVsIGNvdW50ZXIuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBsZXQgdmFyQ291bnQgPSAwO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaWYgKGlyLmhhc0NvbnN1bWVzVmFyc1RyYWl0KG9wKSkge1xuICAgICAgICB2YXJDb3VudCArPSB2YXJzVXNlZEJ5T3Aob3ApO1xuICAgICAgfVxuXG4gICAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgIGlmICghaXIuaXNJckV4cHJlc3Npb24oZXhwcikpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTb21lIGV4cHJlc3Npb25zIHJlcXVpcmUga25vd2xlZGdlIG9mIHRoZSBudW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgY29uc3VtZWQuXG4gICAgICAgIGlmIChpci5oYXNVc2VzVmFyT2Zmc2V0VHJhaXQoZXhwcikpIHtcbiAgICAgICAgICBleHByLnZhck9mZnNldCA9IHZhckNvdW50O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlyLmhhc0NvbnN1bWVzVmFyc1RyYWl0KGV4cHIpKSB7XG4gICAgICAgICAgdmFyQ291bnQgKz0gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdW5pdC52YXJzID0gdmFyQ291bnQ7XG4gIH1cblxuICBpZiAoam9iIGluc3RhbmNlb2YgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgICAvLyBBZGQgdmFyIGNvdW50cyBmb3IgZWFjaCB2aWV3IHRvIHRoZSBgaXIuVGVtcGxhdGVPcGAgd2hpY2ggZGVjbGFyZXMgdGhhdCB2aWV3IChpZiB0aGUgdmlldyBpc1xuICAgIC8vIGFuIGVtYmVkZGVkIHZpZXcpLlxuICAgIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5UZW1wbGF0ZSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2hpbGRWaWV3ID0gam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIG9wLnZhcnMgPSBjaGlsZFZpZXcudmFycztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaWZmZXJlbnQgb3BlcmF0aW9ucyB0aGF0IGltcGxlbWVudCBgaXIuVXNlc1ZhcnNUcmFpdGAgdXNlIGRpZmZlcmVudCBudW1iZXJzIG9mIHZhcmlhYmxlcywgc29cbiAqIGNvdW50IHRoZSB2YXJpYWJsZXMgdXNlZCBieSBhbnkgcGFydGljdWxhciBgb3BgLlxuICovXG5mdW5jdGlvbiB2YXJzVXNlZEJ5T3Aob3A6IChpci5DcmVhdGVPcHxpci5VcGRhdGVPcCkmaXIuQ29uc3VtZXNWYXJzVHJhaXQpOiBudW1iZXIge1xuICBsZXQgc2xvdHM6IG51bWJlcjtcbiAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgY2FzZSBpci5PcEtpbmQuSG9zdFByb3BlcnR5OlxuICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgIC8vIEFsbCBvZiB0aGVzZSBiaW5kaW5ncyB1c2UgMSB2YXJpYWJsZSBzbG90LCBwbHVzIDEgc2xvdCBmb3IgZXZlcnkgaW50ZXJwb2xhdGVkIGV4cHJlc3Npb24sXG4gICAgICAvLyBpZiBhbnkuXG4gICAgICBzbG90cyA9IDE7XG4gICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgc2xvdHMgKz0gb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xvdHM7XG4gICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICBjYXNlIGlyLk9wS2luZC5TdHlsZU1hcDpcbiAgICBjYXNlIGlyLk9wS2luZC5DbGFzc01hcDpcbiAgICAgIC8vIFN0eWxlICYgY2xhc3MgYmluZGluZ3MgdXNlIDIgdmFyaWFibGUgc2xvdHMsIHBsdXMgMSBzbG90IGZvciBldmVyeSBpbnRlcnBvbGF0ZWQgZXhwcmVzc2lvbixcbiAgICAgIC8vIGlmIGFueS5cbiAgICAgIHNsb3RzID0gMjtcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICBzbG90cyArPSBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzbG90cztcbiAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICAvLyBgaXIuSW50ZXJwb2xhdGVUZXh0T3BgcyB1c2UgYSB2YXJpYWJsZSBzbG90IGZvciBlYWNoIGR5bmFtaWMgZXhwcmVzc2lvbi5cbiAgICAgIHJldHVybiBvcC5pbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICBjYXNlIGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbjpcbiAgICAgIHJldHVybiAxO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBvcDogJHtpci5PcEtpbmRbb3Aua2luZF19YCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhcnNVc2VkQnlJckV4cHJlc3Npb24oZXhwcjogaXIuRXhwcmVzc2lvbiZpci5Db25zdW1lc1ZhcnNUcmFpdCk6IG51bWJlciB7XG4gIHN3aXRjaCAoZXhwci5raW5kKSB7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QdXJlRnVuY3Rpb25FeHByOlxuICAgICAgcmV0dXJuIDEgKyBleHByLmFyZ3MubGVuZ3RoO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmc6XG4gICAgICByZXR1cm4gMSArIGV4cHIuYXJncy5sZW5ndGg7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZ1ZhcmlhZGljOlxuICAgICAgcmV0dXJuIDEgKyBleHByLm51bUFyZ3M7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IHVuaGFuZGxlZCBDb25zdW1lc1ZhcnNUcmFpdCBleHByZXNzaW9uICR7ZXhwci5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG4iXX0=