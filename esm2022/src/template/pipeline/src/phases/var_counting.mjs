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
                // TemplateDefinitionBuilder assigns variable offsets for everything but pure functions
                // first, and then assigns offsets to pure functions lazily. We emulate that behavior by
                // assigning offsets in two passes instead of one, only in compatibility mode.
                if (job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder &&
                    expr instanceof ir.PureFunctionExpr) {
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
        // Compatiblity mode pass for pure function offsets (as explained above).
        if (job.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder) {
            for (const op of unit.ops()) {
                ir.visitExpressionsInOp(op, expr => {
                    if (!ir.isIrExpression(expr) || !(expr instanceof ir.PureFunctionExpr)) {
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
            if (op.expression instanceof ir.Interpolation && !isSingletonInterpolation(op.expression)) {
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
function isSingletonInterpolation(expr) {
    if (expr.expressions.length !== 1 || expr.strings.length !== 2) {
        return false;
    }
    if (expr.strings[0] !== '' || expr.strings[1] !== '') {
        return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyX2NvdW50aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdmFyX2NvdW50aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9CLE9BQU8sRUFBaUIsdUJBQXVCLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV2RTs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsR0FBbUI7SUFDbEQsOEVBQThFO0lBQzlFLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFFakIscUZBQXFGO1FBQ3JGLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUMvQixRQUFRLElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQzlCO1NBQ0Y7UUFFRCxnR0FBZ0c7UUFDaEcsZ0dBQWdHO1FBQ2hHLDhEQUE4RDtRQUM5RCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNqQyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDNUIsT0FBTztpQkFDUjtnQkFFRCx1RkFBdUY7Z0JBQ3ZGLHdGQUF3RjtnQkFDeEYsOEVBQThFO2dCQUM5RSxJQUFJLEdBQUcsQ0FBQyxhQUFhLEtBQUssRUFBRSxDQUFDLGlCQUFpQixDQUFDLHlCQUF5Qjtv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TSxJQUFJLEtBQUssQ0FDWCwwREFBMEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0tBQzFGO0FBQ0gsQ0FBQztBQUVELFNBQVMsd0JBQXdCLENBQUMsSUFBc0I7SUFDdEQsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQzlELE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFDRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1FBQ3BELE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYiwgQ29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBDb3VudHMgdGhlIG51bWJlciBvZiB2YXJpYWJsZSBzbG90cyB1c2VkIHdpdGhpbiBlYWNoIHZpZXcsIGFuZCBzdG9yZXMgdGhhdCBvbiB0aGUgdmlldyBpdHNlbGYsIGFzXG4gKiB3ZWxsIGFzIHByb3BhZ2F0ZXMgaXQgdG8gdGhlIGBpci5UZW1wbGF0ZU9wYCBmb3IgZW1iZWRkZWQgdmlld3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVZhckNvdW50aW5nKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgLy8gRmlyc3QsIGNvdW50IHRoZSB2YXJzIHVzZWQgaW4gZWFjaCB2aWV3LCBhbmQgdXBkYXRlIHRoZSB2aWV3LWxldmVsIGNvdW50ZXIuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBsZXQgdmFyQ291bnQgPSAwO1xuXG4gICAgLy8gQ291bnQgdmFyaWFibGVzIG9uIHRvcC1sZXZlbCBvcHMgZmlyc3QuIERvbid0IGV4cGxvcmUgbmVzdGVkIGV4cHJlc3Npb25zIGp1c3QgeWV0LlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaWYgKGlyLmhhc0NvbnN1bWVzVmFyc1RyYWl0KG9wKSkge1xuICAgICAgICB2YXJDb3VudCArPSB2YXJzVXNlZEJ5T3Aob3ApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvdW50IHZhcmlhYmxlcyBvbiBleHByZXNzaW9ucyBpbnNpZGUgb3BzLiBXZSBkbyB0aGlzIGxhdGVyIGJlY2F1c2Ugc29tZSBvZiB0aGVzZSBleHByZXNzaW9uc1xuICAgIC8vIG1pZ2h0IGJlIGNvbmRpdGlvbmFsIChlLmcuIGBwaXBlQmluZGluZ2AgaW5zaWRlIG9mIGEgdGVybmFyeSksIGFuZCB3ZSBkb24ndCB3YW50IHRvIGludGVyZmVyZVxuICAgIC8vIHdpdGggaW5kaWNlcyBmb3IgdG9wLWxldmVsIGJpbmRpbmcgc2xvdHMgKGUuZy4gYHByb3BlcnR5YCkuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgIGlmICghaXIuaXNJckV4cHJlc3Npb24oZXhwcikpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGFzc2lnbnMgdmFyaWFibGUgb2Zmc2V0cyBmb3IgZXZlcnl0aGluZyBidXQgcHVyZSBmdW5jdGlvbnNcbiAgICAgICAgLy8gZmlyc3QsIGFuZCB0aGVuIGFzc2lnbnMgb2Zmc2V0cyB0byBwdXJlIGZ1bmN0aW9ucyBsYXppbHkuIFdlIGVtdWxhdGUgdGhhdCBiZWhhdmlvciBieVxuICAgICAgICAvLyBhc3NpZ25pbmcgb2Zmc2V0cyBpbiB0d28gcGFzc2VzIGluc3RlYWQgb2Ygb25lLCBvbmx5IGluIGNvbXBhdGliaWxpdHkgbW9kZS5cbiAgICAgICAgaWYgKGpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyICYmXG4gICAgICAgICAgICBleHByIGluc3RhbmNlb2YgaXIuUHVyZUZ1bmN0aW9uRXhwcikge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvbWUgZXhwcmVzc2lvbnMgcmVxdWlyZSBrbm93bGVkZ2Ugb2YgdGhlIG51bWJlciBvZiB2YXJpYWJsZSBzbG90cyBjb25zdW1lZC5cbiAgICAgICAgaWYgKGlyLmhhc1VzZXNWYXJPZmZzZXRUcmFpdChleHByKSkge1xuICAgICAgICAgIGV4cHIudmFyT2Zmc2V0ID0gdmFyQ291bnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXIuaGFzQ29uc3VtZXNWYXJzVHJhaXQoZXhwcikpIHtcbiAgICAgICAgICB2YXJDb3VudCArPSB2YXJzVXNlZEJ5SXJFeHByZXNzaW9uKGV4cHIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDb21wYXRpYmxpdHkgbW9kZSBwYXNzIGZvciBwdXJlIGZ1bmN0aW9uIG9mZnNldHMgKGFzIGV4cGxhaW5lZCBhYm92ZSkuXG4gICAgaWYgKGpvYi5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgICAgIGlmICghaXIuaXNJckV4cHJlc3Npb24oZXhwcikgfHwgIShleHByIGluc3RhbmNlb2YgaXIuUHVyZUZ1bmN0aW9uRXhwcikpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTb21lIGV4cHJlc3Npb25zIHJlcXVpcmUga25vd2xlZGdlIG9mIHRoZSBudW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgY29uc3VtZWQuXG4gICAgICAgICAgaWYgKGlyLmhhc1VzZXNWYXJPZmZzZXRUcmFpdChleHByKSkge1xuICAgICAgICAgICAgZXhwci52YXJPZmZzZXQgPSB2YXJDb3VudDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaXIuaGFzQ29uc3VtZXNWYXJzVHJhaXQoZXhwcikpIHtcbiAgICAgICAgICAgIHZhckNvdW50ICs9IHZhcnNVc2VkQnlJckV4cHJlc3Npb24oZXhwcik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB1bml0LnZhcnMgPSB2YXJDb3VudDtcbiAgfVxuXG4gIGlmIChqb2IgaW5zdGFuY2VvZiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAgIC8vIEFkZCB2YXIgY291bnRzIGZvciBlYWNoIHZpZXcgdG8gdGhlIGBpci5UZW1wbGF0ZU9wYCB3aGljaCBkZWNsYXJlcyB0aGF0IHZpZXcgKGlmIHRoZSB2aWV3IGlzXG4gICAgLy8gYW4gZW1iZWRkZWQgdmlldykuXG4gICAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgICBpZiAob3Aua2luZCAhPT0gaXIuT3BLaW5kLlRlbXBsYXRlICYmIG9wLmtpbmQgIT09IGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2hpbGRWaWV3ID0gam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIG9wLnZhcnMgPSBjaGlsZFZpZXcudmFycztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaWZmZXJlbnQgb3BlcmF0aW9ucyB0aGF0IGltcGxlbWVudCBgaXIuVXNlc1ZhcnNUcmFpdGAgdXNlIGRpZmZlcmVudCBudW1iZXJzIG9mIHZhcmlhYmxlcywgc29cbiAqIGNvdW50IHRoZSB2YXJpYWJsZXMgdXNlZCBieSBhbnkgcGFydGljdWxhciBgb3BgLlxuICovXG5mdW5jdGlvbiB2YXJzVXNlZEJ5T3Aob3A6IChpci5DcmVhdGVPcHxpci5VcGRhdGVPcCkmaXIuQ29uc3VtZXNWYXJzVHJhaXQpOiBudW1iZXIge1xuICBsZXQgc2xvdHM6IG51bWJlcjtcbiAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgY2FzZSBpci5PcEtpbmQuSG9zdFByb3BlcnR5OlxuICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgIC8vIEFsbCBvZiB0aGVzZSBiaW5kaW5ncyB1c2UgMSB2YXJpYWJsZSBzbG90LCBwbHVzIDEgc2xvdCBmb3IgZXZlcnkgaW50ZXJwb2xhdGVkIGV4cHJlc3Npb24sXG4gICAgICAvLyBpZiBhbnkuXG4gICAgICBzbG90cyA9IDE7XG4gICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24gJiYgIWlzU2luZ2xldG9uSW50ZXJwb2xhdGlvbihvcC5leHByZXNzaW9uKSkge1xuICAgICAgICBzbG90cyArPSBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzbG90cztcbiAgICBjYXNlIGlyLk9wS2luZC5TdHlsZVByb3A6XG4gICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NQcm9wOlxuICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlTWFwOlxuICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzTWFwOlxuICAgICAgLy8gU3R5bGUgJiBjbGFzcyBiaW5kaW5ncyB1c2UgMiB2YXJpYWJsZSBzbG90cywgcGx1cyAxIHNsb3QgZm9yIGV2ZXJ5IGludGVycG9sYXRlZCBleHByZXNzaW9uLFxuICAgICAgLy8gaWYgYW55LlxuICAgICAgc2xvdHMgPSAyO1xuICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHNsb3RzICs9IG9wLmV4cHJlc3Npb24uZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNsb3RzO1xuICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlVGV4dDpcbiAgICAgIC8vIGBpci5JbnRlcnBvbGF0ZVRleHRPcGBzIHVzZSBhIHZhcmlhYmxlIHNsb3QgZm9yIGVhY2ggZHluYW1pYyBleHByZXNzaW9uLlxuICAgICAgcmV0dXJuIG9wLmludGVycG9sYXRpb24uZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uOlxuICAgIGNhc2UgaXIuT3BLaW5kLkNvbmRpdGlvbmFsOlxuICAgICAgcmV0dXJuIDE7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIG9wOiAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByOiBpci5FeHByZXNzaW9uJmlyLkNvbnN1bWVzVmFyc1RyYWl0KTogbnVtYmVyIHtcbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI6XG4gICAgICByZXR1cm4gMSArIGV4cHIuYXJncy5sZW5ndGg7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZzpcbiAgICAgIHJldHVybiAxICsgZXhwci5hcmdzLmxlbmd0aDtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nVmFyaWFkaWM6XG4gICAgICByZXR1cm4gMSArIGV4cHIubnVtQXJncztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogdW5oYW5kbGVkIENvbnN1bWVzVmFyc1RyYWl0IGV4cHJlc3Npb24gJHtleHByLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTaW5nbGV0b25JbnRlcnBvbGF0aW9uKGV4cHI6IGlyLkludGVycG9sYXRpb24pOiBib29sZWFuIHtcbiAgaWYgKGV4cHIuZXhwcmVzc2lvbnMubGVuZ3RoICE9PSAxIHx8IGV4cHIuc3RyaW5ncy5sZW5ndGggIT09IDIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGV4cHIuc3RyaW5nc1swXSAhPT0gJycgfHwgZXhwci5zdHJpbmdzWzFdICE9PSAnJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cbiJdfQ==