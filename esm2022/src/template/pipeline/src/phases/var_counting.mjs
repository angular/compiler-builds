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
        case ir.OpKind.TwoWayProperty:
            // Two-way properties can only have expressions so they only need one variable slot.
            return 1;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyX2NvdW50aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdmFyX2NvdW50aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQy9CLE9BQU8sRUFBaUIsdUJBQXVCLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV2RTs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUFDLEdBQW1CO0lBQ2hELDhFQUE4RTtJQUM5RSxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFFakIscUZBQXFGO1FBQ3JGLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDNUIsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDaEMsUUFBUSxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMvQixDQUFDO1FBQ0gsQ0FBQztRQUVELGdHQUFnRztRQUNoRyxnR0FBZ0c7UUFDaEcsOERBQThEO1FBQzlELEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDNUIsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDakMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDN0IsT0FBTztnQkFDVCxDQUFDO2dCQUVELHVGQUF1RjtnQkFDdkYsd0ZBQXdGO2dCQUN4Riw4RUFBOEU7Z0JBQzlFLElBQUksR0FBRyxDQUFDLGFB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ZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2IsIENvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ291bnRzIHRoZSBudW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgdXNlZCB3aXRoaW4gZWFjaCB2aWV3LCBhbmQgc3RvcmVzIHRoYXQgb24gdGhlIHZpZXcgaXRzZWxmLCBhc1xuICogd2VsbCBhcyBwcm9wYWdhdGVzIGl0IHRvIHRoZSBgaXIuVGVtcGxhdGVPcGAgZm9yIGVtYmVkZGVkIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY291bnRWYXJpYWJsZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICAvLyBGaXJzdCwgY291bnQgdGhlIHZhcnMgdXNlZCBpbiBlYWNoIHZpZXcsIGFuZCB1cGRhdGUgdGhlIHZpZXctbGV2ZWwgY291bnRlci5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGxldCB2YXJDb3VudCA9IDA7XG5cbiAgICAvLyBDb3VudCB2YXJpYWJsZXMgb24gdG9wLWxldmVsIG9wcyBmaXJzdC4gRG9uJ3QgZXhwbG9yZSBuZXN0ZWQgZXhwcmVzc2lvbnMganVzdCB5ZXQuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBpZiAoaXIuaGFzQ29uc3VtZXNWYXJzVHJhaXQob3ApKSB7XG4gICAgICAgIHZhckNvdW50ICs9IHZhcnNVc2VkQnlPcChvcCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ291bnQgdmFyaWFibGVzIG9uIGV4cHJlc3Npb25zIGluc2lkZSBvcHMuIFdlIGRvIHRoaXMgbGF0ZXIgYmVjYXVzZSBzb21lIG9mIHRoZXNlIGV4cHJlc3Npb25zXG4gICAgLy8gbWlnaHQgYmUgY29uZGl0aW9uYWwgKGUuZy4gYHBpcGVCaW5kaW5nYCBpbnNpZGUgb2YgYSB0ZXJuYXJ5KSwgYW5kIHdlIGRvbid0IHdhbnQgdG8gaW50ZXJmZXJlXG4gICAgLy8gd2l0aCBpbmRpY2VzIGZvciB0b3AtbGV2ZWwgYmluZGluZyBzbG90cyAoZS5nLiBgcHJvcGVydHlgKS5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgIGlyLnZpc2l0RXhwcmVzc2lvbnNJbk9wKG9wLCBleHByID0+IHtcbiAgICAgICAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgYXNzaWducyB2YXJpYWJsZSBvZmZzZXRzIGZvciBldmVyeXRoaW5nIGJ1dCBwdXJlIGZ1bmN0aW9uc1xuICAgICAgICAvLyBmaXJzdCwgYW5kIHRoZW4gYXNzaWducyBvZmZzZXRzIHRvIHB1cmUgZnVuY3Rpb25zIGxhemlseS4gV2UgZW11bGF0ZSB0aGF0IGJlaGF2aW9yIGJ5XG4gICAgICAgIC8vIGFzc2lnbmluZyBvZmZzZXRzIGluIHR3byBwYXNzZXMgaW5zdGVhZCBvZiBvbmUsIG9ubHkgaW4gY29tcGF0aWJpbGl0eSBtb2RlLlxuICAgICAgICBpZiAoam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgJiZcbiAgICAgICAgICAgIGV4cHIgaW5zdGFuY2VvZiBpci5QdXJlRnVuY3Rpb25FeHByKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29tZSBleHByZXNzaW9ucyByZXF1aXJlIGtub3dsZWRnZSBvZiB0aGUgbnVtYmVyIG9mIHZhcmlhYmxlIHNsb3RzIGNvbnN1bWVkLlxuICAgICAgICBpZiAoaXIuaGFzVXNlc1Zhck9mZnNldFRyYWl0KGV4cHIpKSB7XG4gICAgICAgICAgZXhwci52YXJPZmZzZXQgPSB2YXJDb3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpci5oYXNDb25zdW1lc1ZhcnNUcmFpdChleHByKSkge1xuICAgICAgICAgIHZhckNvdW50ICs9IHZhcnNVc2VkQnlJckV4cHJlc3Npb24oZXhwcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENvbXBhdGlibGl0eSBtb2RlIHBhc3MgZm9yIHB1cmUgZnVuY3Rpb24gb2Zmc2V0cyAoYXMgZXhwbGFpbmVkIGFib3ZlKS5cbiAgICBpZiAoam9iLmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIpIHtcbiAgICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgICAgaWYgKCFpci5pc0lyRXhwcmVzc2lvbihleHByKSB8fCAhKGV4cHIgaW5zdGFuY2VvZiBpci5QdXJlRnVuY3Rpb25FeHByKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFNvbWUgZXhwcmVzc2lvbnMgcmVxdWlyZSBrbm93bGVkZ2Ugb2YgdGhlIG51bWJlciBvZiB2YXJpYWJsZSBzbG90cyBjb25zdW1lZC5cbiAgICAgICAgICBpZiAoaXIuaGFzVXNlc1Zhck9mZnNldFRyYWl0KGV4cHIpKSB7XG4gICAgICAgICAgICBleHByLnZhck9mZnNldCA9IHZhckNvdW50O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChpci5oYXNDb25zdW1lc1ZhcnNUcmFpdChleHByKSkge1xuICAgICAgICAgICAgdmFyQ291bnQgKz0gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHVuaXQudmFycyA9IHZhckNvdW50O1xuICB9XG5cbiAgaWYgKGpvYiBpbnN0YW5jZW9mIENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gICAgLy8gQWRkIHZhciBjb3VudHMgZm9yIGVhY2ggdmlldyB0byB0aGUgYGlyLlRlbXBsYXRlT3BgIHdoaWNoIGRlY2xhcmVzIHRoYXQgdmlldyAoaWYgdGhlIHZpZXcgaXNcbiAgICAvLyBhbiBlbWJlZGRlZCB2aWV3KS5cbiAgICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAgIGlmIChvcC5raW5kICE9PSBpci5PcEtpbmQuVGVtcGxhdGUgJiYgb3Aua2luZCAhPT0gaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZFZpZXcgPSBqb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgb3AudmFycyA9IGNoaWxkVmlldy52YXJzO1xuXG4gICAgICAgIC8vIFRPRE86IGN1cnJlbnRseSB3ZSBoYW5kbGUgdGhlIHZhcnMgZm9yIHRoZSBSZXBlYXRlckNyZWF0ZSBlbXB0eSB0ZW1wbGF0ZSBpbiB0aGUgcmVpZnlcbiAgICAgICAgLy8gcGhhc2UuIFdlIHNob3VsZCBoYW5kbGUgdGhhdCBoZXJlIGluc3RlYWQuXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGlmZmVyZW50IG9wZXJhdGlvbnMgdGhhdCBpbXBsZW1lbnQgYGlyLlVzZXNWYXJzVHJhaXRgIHVzZSBkaWZmZXJlbnQgbnVtYmVycyBvZiB2YXJpYWJsZXMsIHNvXG4gKiBjb3VudCB0aGUgdmFyaWFibGVzIHVzZWQgYnkgYW55IHBhcnRpY3VsYXIgYG9wYC5cbiAqL1xuZnVuY3Rpb24gdmFyc1VzZWRCeU9wKG9wOiAoaXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3ApJmlyLkNvbnN1bWVzVmFyc1RyYWl0KTogbnVtYmVyIHtcbiAgbGV0IHNsb3RzOiBudW1iZXI7XG4gIHN3aXRjaCAob3Aua2luZCkge1xuICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgIGNhc2UgaXIuT3BLaW5kLkhvc3RQcm9wZXJ0eTpcbiAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAvLyBBbGwgb2YgdGhlc2UgYmluZGluZ3MgdXNlIDEgdmFyaWFibGUgc2xvdCwgcGx1cyAxIHNsb3QgZm9yIGV2ZXJ5IGludGVycG9sYXRlZCBleHByZXNzaW9uLFxuICAgICAgLy8gaWYgYW55LlxuICAgICAgc2xvdHMgPSAxO1xuICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uICYmICFpc1NpbmdsZXRvbkludGVycG9sYXRpb24ob3AuZXhwcmVzc2lvbikpIHtcbiAgICAgICAgc2xvdHMgKz0gb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xvdHM7XG4gICAgY2FzZSBpci5PcEtpbmQuVHdvV2F5UHJvcGVydHk6XG4gICAgICAvLyBUd28td2F5IHByb3BlcnRpZXMgY2FuIG9ubHkgaGF2ZSBleHByZXNzaW9ucyBzbyB0aGV5IG9ubHkgbmVlZCBvbmUgdmFyaWFibGUgc2xvdC5cbiAgICAgIHJldHVybiAxO1xuICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgY2FzZSBpci5PcEtpbmQuU3R5bGVNYXA6XG4gICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NNYXA6XG4gICAgICAvLyBTdHlsZSAmIGNsYXNzIGJpbmRpbmdzIHVzZSAyIHZhcmlhYmxlIHNsb3RzLCBwbHVzIDEgc2xvdCBmb3IgZXZlcnkgaW50ZXJwb2xhdGVkIGV4cHJlc3Npb24sXG4gICAgICAvLyBpZiBhbnkuXG4gICAgICBzbG90cyA9IDI7XG4gICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgc2xvdHMgKz0gb3AuZXhwcmVzc2lvbi5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xvdHM7XG4gICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVUZXh0OlxuICAgICAgLy8gYGlyLkludGVycG9sYXRlVGV4dE9wYHMgdXNlIGEgdmFyaWFibGUgc2xvdCBmb3IgZWFjaCBkeW5hbWljIGV4cHJlc3Npb24uXG4gICAgICByZXR1cm4gb3AuaW50ZXJwb2xhdGlvbi5leHByZXNzaW9ucy5sZW5ndGg7XG4gICAgY2FzZSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb246XG4gICAgY2FzZSBpci5PcEtpbmQuQ29uZGl0aW9uYWw6XG4gICAgY2FzZSBpci5PcEtpbmQuRGVmZXJXaGVuOlxuICAgICAgcmV0dXJuIDE7XG4gICAgY2FzZSBpci5PcEtpbmQuUmVwZWF0ZXJDcmVhdGU6XG4gICAgICAvLyBSZXBlYXRlcnMgbWF5IHJlcXVpcmUgYW4gZXh0cmEgdmFyaWFibGUgYmluZGluZyBzbG90LCBpZiB0aGV5IGhhdmUgYW4gZW1wdHkgdmlldywgZm9yIHRoZVxuICAgICAgLy8gZW1wdHkgYmxvY2sgdHJhY2tpbmcuXG4gICAgICAvLyBUT0RPOiBJdCdzIGEgYml0IG9kZCB0byBoYXZlIGEgY3JlYXRlIG1vZGUgaW5zdHJ1Y3Rpb24gY29uc3VtZSB2YXJpYWJsZSBzbG90cy4gTWF5YmUgd2UgY2FuXG4gICAgICAvLyBmaW5kIGEgd2F5IHRvIHVzZSB0aGUgUmVwZWF0ZXIgdXBkYXRlIG9wIGluc3RlYWQuXG4gICAgICByZXR1cm4gb3AuZW1wdHlWaWV3ID8gMSA6IDA7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5oYW5kbGVkIG9wOiAke2lyLk9wS2luZFtvcC5raW5kXX1gKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByOiBpci5FeHByZXNzaW9uJmlyLkNvbnN1bWVzVmFyc1RyYWl0KTogbnVtYmVyIHtcbiAgc3dpdGNoIChleHByLmtpbmQpIHtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlB1cmVGdW5jdGlvbkV4cHI6XG4gICAgICByZXR1cm4gMSArIGV4cHIuYXJncy5sZW5ndGg7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZzpcbiAgICAgIHJldHVybiAxICsgZXhwci5hcmdzLmxlbmd0aDtcbiAgICBjYXNlIGlyLkV4cHJlc3Npb25LaW5kLlBpcGVCaW5kaW5nVmFyaWFkaWM6XG4gICAgICByZXR1cm4gMSArIGV4cHIubnVtQXJncztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBc3NlcnRpb25FcnJvcjogdW5oYW5kbGVkIENvbnN1bWVzVmFyc1RyYWl0IGV4cHJlc3Npb24gJHtleHByLmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTaW5nbGV0b25JbnRlcnBvbGF0aW9uKGV4cHI6IGlyLkludGVycG9sYXRpb24pOiBib29sZWFuIHtcbiAgaWYgKGV4cHIuZXhwcmVzc2lvbnMubGVuZ3RoICE9PSAxIHx8IGV4cHIuc3RyaW5ncy5sZW5ndGggIT09IDIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGV4cHIuc3RyaW5nc1swXSAhPT0gJycgfHwgZXhwci5zdHJpbmdzWzFdICE9PSAnJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cbiJdfQ==