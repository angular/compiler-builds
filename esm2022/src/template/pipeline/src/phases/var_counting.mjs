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
export function countVariables(job) {
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
                // TODO: currently we handle the vars for the RepeaterCreate empty template in the reify
                // phase. We should handle that here instead.
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
        case ir.OpKind.DeferWhen:
            return 1;
        case ir.OpKind.RepeaterCreate:
            // Repeaters may require an extra variable binding slot, if they have an empty view, for the
            // empty block tracking.
            // TODO: It's a bit odd to have a create mode instruction consume variable slots. Maybe we can
            // find a way to use the Repeater update op instead.
            return op.emptyView ? 1 : 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyX2NvdW50aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdmFyX2NvdW50aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9CLE9BQU8sRUFBaUIsdUJBQXVCLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV2RTs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUFDLEdBQW1CO0lBQ2hELDhFQUE4RTtJQUM5RSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBRWpCLHFGQUFxRjtRQUNyRixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQixJQUFJLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDL0IsUUFBUSxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUM5QjtTQUNGO1FBRUQsZ0dBQWdHO1FBQ2hHLGdHQUFnRztRQUNoRyw4REFBOEQ7UUFDOUQsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDM0IsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDakMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzVCLE9BQU87aUJBQ1I7Z0JBRUQsdUZBQXVGO2dCQUN2Rix3RkFBd0Y7Z0JBQ3hGLDhFQUE4RTtnQkFDOUUsSUFBSSxHQUFHLENBQUMsYUFBYSxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUI7b0JB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LE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzlCLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQyxXQUFXO1lBQ2hDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzlCLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUI7WUFDeEMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUMxQjtZQUNFLE1BQU0sSUFBSSxLQUFLLENBQ1gsMERBQTBELElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztLQUMxRjtBQUNILENBQUM7QUFFRCxTQUFTLHdCQUF3QixDQUFDLElBQXNCO0lBQ3RELElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUM5RCxPQUFPLEtBQUssQ0FBQztLQUNkO0lBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtRQUNwRCxPQUFPLEtBQUssQ0FBQztLQUNkO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2IsIENvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ291bnRzIHRoZSBudW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgdXNlZCB3aXRoaW4gZWFjaCB2aWV3LCBhbmQgc3RvcmVzIHRoYXQgb24gdGhlIHZpZXcgaXRzZWxmLCBhc1xuICogd2VsbCBhcyBwcm9wYWdhdGVzIGl0IHRvIHRoZSBgaXIuVGVtcGxhdGVPcGAgZm9yIGVtYmVkZGVkIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY291bnRWYXJpYWJsZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICAvLyBGaXJzdCwgY291bnQgdGhlIHZhcnMgdXNlZCBpbiBlYWNoIHZpZXcsIGFuZCB1cGRhdGUgdGhlIHZpZXctbGV2ZWwgY291bnRlci5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGxldCB2YXJDb3VudCA9IDA7XG5cbiAgICAvLyBDb3VudCB2YXJpYWJsZXMgb24gdG9wLWxldmVsIG9wcyBmaXJzdC4gRG9uJ3QgZXhwbG9yZSBuZXN0ZWQgZXhwcmVzc2lvbnMganVzdCB5ZXQuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBpZiAoaXIuaGFzQ29uc3VtZXNWYXJzVHJhaXQob3ApKSB7XG4gICAgICAgIHZhckNvdW50ICs9IHZhcnNVc2VkQnlPcChvcCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ291bnQgdmFyaWFibGVzIG9uIGV4cHJlc3Npb25zIGluc2lkZSBvcHMuIFdlIGRvIHRoaXMgbGF0ZXIgYmVjYXVzZSBzb21lIG9mIHRoZXNlIGV4cHJlc3Npb25zXG4gICAgLy8gbWlnaHQgYmUgY29uZGl0aW9uYWwgKGUuZy4gYHBpcGVCaW5kaW5nYCBpbnNpZGUgb2YgYSB0ZXJuYXJ5KSwgYW5kIHdlIGRvbid0IHdhbnQgdG8gaW50ZXJmZXJlXG4gICAgLy8gd2l0aCBpbmRpY2VzIGZvciB0b3AtbGV2ZWwgYmluZGluZyBzbG90cyAoZS5nLiBgcHJvcGVydHlgKS5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgYXNzaWducyB2YXJpYWJsZSBvZmZzZXRzIGZvciBldmVyeXRoaW5nIGJ1dCBwdXJlIGZ1bmN0aW9uc1xuICAgICAgICAvLyBmaXJzdCwgYW5kIHRoZW4gYXNzaWducyBvZmZzZXRzIHRvIHB1cmUgZnVuY3Rpb25zIGxhemlseS4gV2UgZW11bGF0ZSB0aGF0IGJlaGF2aW9yIGJ5XG4gICAgICAgIC8vIGFzc2lnbmluZyBvZmZzZXRzIGluIHR3byBwYXNzZXMgaW5zdGVhZCBvZiBvbmUsIG9ubHkgaW4gY29tcGF0aWJpbGl0eSBtb2RlLlxuICAgICAgICBpZiAoam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgJiZcbiAgICAgICAgICAgIGV4cHIgaW5zdGFuY2VvZiBpci5QdXJlRnVuY3Rpb25FeHByKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29tZSBleHByZXNzaW9ucyByZXF1aXJlIGtub3dsZWRnZSBvZiB0aGUgbnVtYmVyIG9mIHZhcmlhYmxlIHNsb3RzIGNvbnN1bWVkLlxuICAgICAgICBpZiAoaXIuaGFzVXNlc1Zhck9mZnNldFRyYWl0KGV4cHIpKSB7XG4gICAgICAgICAgZXhwci52YXJPZmZzZXQgPSB2YXJDb3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpci5oYXNDb25zdW1lc1ZhcnNUcmFpdChleHByKSkge1xuICAgICAgICAgIHZhckNvdW50ICs9IHZhcnNVc2VkQnlJckV4cHJlc3Npb24oZXhwcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENvbXBhdGlibGl0eSBtb2RlIHBhc3MgZm9yIHB1cmUgZnVuY3Rpb24gb2Zmc2V0cyAoYXMgZXhwbGFpbmVkIGFib3ZlKS5cbiAgICBpZiAoam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpIHtcbiAgICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgICAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSB8fCAhKGV4cHIgaW5zdGFuY2VvZiBpci5QdXJlRnVuY3Rpb25FeHByKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFNvbWUgZXhwcmVzc2lvbnMgcmVxdWlyZSBrbm93bGVkZ2Ugb2YgdGhlIG51bWJlciBvZiB2YXJpYWJsZSBzbG90cyBjb25zdW1lZC5cbiAgICAgICAgICBpZiAoaXIuaGFzVXNlc1Zhck9mZnNldFRyYWl0KGV4cHIpKSB7XG4gICAgICAgICAgICBleHByLnZhck9mZnNldCA9IHZhckNvdW50O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChpci5oYXNDb25zdW1lc1ZhcnNUcmFpdChleHByKSkge1xuICAgICAgICAgICAgdmFyQ291bnQgKz0gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHVuaXQudmFycyA9IHZhckNvdW50O1xuICB9XG5cbiAgaWYgKGpvYiBpbnN0YW5jZW9mIENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gICAgLy8gQWRkIHZhciBjb3VudHMgZm9yIGVhY2ggdmlldyB0byB0aGUgYGlyLlRlbXBsYXRlT3BgIHdoaWNoIGRlY2xhcmVzIHRoYXQgdmlldyAoaWYgdGhlIHZpZXcgaXNcbiAgICAvLyBhbiBlbWJlZGRlZCB2aWV3KS5cbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuVGVtcGxhdGUgJiYgb3Aua2luZCAhPT0gaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSBqb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgb3AudmFycyA9IGNoaWxkVmlldy52YXJzO1xuXG4gICAgICAgIC8vIFRPRE86IGN1cnJlbnRseSB3ZSBoYW5kbGUgdGhlIHZhcnMgZm9yIHRoZSBSZXBlYXRlckNyZWF0ZSBlbXB0eSB0ZW1wbGF0ZSBpbiB0aGUgcmVpZnlcbiAgICAgICAgLy8gcGhhc2UuIFdlIHNob3VsZCBoYW5kbGUgdGhhdCBoZXJlIGluc3RlYWQuXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGlmZmVyZW50IG9wZXJhdGlvbnMgdGhhdCBpbXBsZW1lbnQgYGlyLlVzZXNWYXJzVHJhaXRgIHVzZSBkaWZmZXJlbnQgbnVtYmVycyBvZiB2YXJpYWJsZXMsIHNvXG4gKiBjb3VudCB0aGUgdmFyaWFibGVzIHVzZWQgYnkgYW55IHBhcnRpY3VsYXIgYG9wYC5cbiAqL1xuZnVuY3Rpb24gdmFyc1VzZWRCeU9wKG9wOiAoaXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3ApJmlyLkNvbnN1bWVzVmFyc1RyYWl0KTogbnVtYmVyIHtcbiAgbGV0IHNsb3RzOiBudW1iZXI7XG4gIHN3aXRjaCAob3Aua2luZCkge1xuICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgIGNhc2UgaXIuT3BLaW5kLkhvc3RQcm9wZXJ0eTpcbiAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAvLyBBbGwgb2YgdGhlc2UgYmluZGluZ3MgdXNlIDEgdmFyaWFibGUgc2xvdCwgcGx1cyAxIHNsb3QgZm9yIGV2ZXJ5IGludGVycG9sYXRlZCBleHByZXNzaW9uLFxuICAgICAgLy8gaWYgYW55LlxuICAgICAgc2xvdHMgPSAxO1xuICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uICYmICFpc1NpbmdsZXRvbkludGVycG9sYXRpb24ob3AuZXhwcmVzc2lvbikpIHtcbiAgICAgICAgc2xvdHMgKz0gb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xvdHM7XG4gICAgY2FzZSBpci5PcEtpbmQuU3R5bGVQcm9wOlxuICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICBjYXNlIGlyLk9wS2luZC5TdHlsZU1hcDpcbiAgICBjYXNlIGlyLk9wS2luZC5DbGFzc01hcDpcbiAgICAgIC8vIFN0eWxlICYgY2xhc3MgYmluZGluZ3MgdXNlIDIgdmFyaWFibGUgc2xvdHMsIHBsdXMgMSBzbG90IGZvciBldmVyeSBpbnRlcnBvbGF0ZWQgZXhwcmVzc2lvbixcbiAgICAgIC8vIGlmIGFueS5cbiAgICAgIHNsb3RzID0gMjtcbiAgICAgIGlmIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2YgaXIuSW50ZXJwb2xhdGlvbikge1xuICAgICAgICBzbG90cyArPSBvcC5leHByZXNzaW9uLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzbG90cztcbiAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVRleHQ6XG4gICAgICAvLyBgaXIuSW50ZXJwb2xhdGVUZXh0T3BgcyB1c2UgYSB2YXJpYWJsZSBzbG90IGZvciBlYWNoIGR5bmFtaWMgZXhwcmVzc2lvbi5cbiAgICAgIHJldHVybiBvcC5pbnRlcnBvbGF0aW9uLmV4cHJlc3Npb25zLmxlbmd0aDtcbiAgICBjYXNlIGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbjpcbiAgICBjYXNlIGlyLk9wS2luZC5Db25kaXRpb25hbDpcbiAgICBjYXNlIGlyLk9wS2luZC5EZWZlcldoZW46XG4gICAgICByZXR1cm4gMTtcbiAgICBjYXNlIGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZTpcbiAgICAgIC8vIFJlcGVhdGVycyBtYXkgcmVxdWlyZSBhbiBleHRyYSB2YXJpYWJsZSBiaW5kaW5nIHNsb3QsIGlmIHRoZXkgaGF2ZSBhbiBlbXB0eSB2aWV3LCBmb3IgdGhlXG4gICAgICAvLyBlbXB0eSBibG9jayB0cmFja2luZy5cbiAgICAgIC8vIFRPRE86IEl0J3MgYSBiaXQgb2RkIHRvIGhhdmUgYSBjcmVhdGUgbW9kZSBpbnN0cnVjdGlvbiBjb25zdW1lIHZhcmlhYmxlIHNsb3RzLiBNYXliZSB3ZSBjYW5cbiAgICAgIC8vIGZpbmQgYSB3YXkgdG8gdXNlIHRoZSBSZXBlYXRlciB1cGRhdGUgb3AgaW5zdGVhZC5cbiAgICAgIHJldHVybiBvcC5lbXB0eVZpZXcgPyAxIDogMDtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmhhbmRsZWQgb3A6ICR7aXIuT3BLaW5kW29wLmtpbmRdfWApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJzVXNlZEJ5SXJFeHByZXNzaW9uKGV4cHI6IGlyLkV4cHJlc3Npb24maXIuQ29uc3VtZXNWYXJzVHJhaXQpOiBudW1iZXIge1xuICBzd2l0Y2ggKGV4cHIua2luZCkge1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUHVyZUZ1bmN0aW9uRXhwcjpcbiAgICAgIHJldHVybiAxICsgZXhwci5hcmdzLmxlbmd0aDtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nOlxuICAgICAgcmV0dXJuIDEgKyBleHByLmFyZ3MubGVuZ3RoO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmdWYXJpYWRpYzpcbiAgICAgIHJldHVybiAxICsgZXhwci5udW1BcmdzO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYEFzc2VydGlvbkVycm9yOiB1bmhhbmRsZWQgQ29uc3VtZXNWYXJzVHJhaXQgZXhwcmVzc2lvbiAke2V4cHIuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NpbmdsZXRvbkludGVycG9sYXRpb24oZXhwcjogaXIuSW50ZXJwb2xhdGlvbik6IGJvb2xlYW4ge1xuICBpZiAoZXhwci5leHByZXNzaW9ucy5sZW5ndGggIT09IDEgfHwgZXhwci5zdHJpbmdzLmxlbmd0aCAhPT0gMikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoZXhwci5zdHJpbmdzWzBdICE9PSAnJyB8fCBleHByLnN0cmluZ3NbMV0gIT09ICcnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuIl19