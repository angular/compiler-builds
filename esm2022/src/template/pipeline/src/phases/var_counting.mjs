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
        case ir.OpKind.Attribute:
            // Property & attribute bindings use 1 variable slot.
            return 1;
        case ir.OpKind.StyleProp:
        case ir.OpKind.ClassProp:
        case ir.OpKind.StyleMap:
        case ir.OpKind.ClassMap:
            // Style & class bindings use 2 variable slots.
            return 2;
        case ir.OpKind.InterpolateText:
            // `ir.InterpolateTextOp`s use a variable slot for each dynamic expression.
            return op.expressions.length;
        case ir.OpKind.InterpolateProperty:
            // `ir.InterpolatePropertyOp`s use a variable slot for each dynamic expression, plus one for
            // the result.
            return 1 + op.expressions.length;
        case ir.OpKind.InterpolateAttribute:
            // One variable slot for each dynamic expression, plus one for the result.
            return 1 + op.expressions.length;
        case ir.OpKind.InterpolateStyleProp:
        case ir.OpKind.InterpolateStyleMap:
        case ir.OpKind.InterpolateClassMap:
            // One variable slot for each dynamic expression, plus two for binding the result.
            return 2 + op.expressions.length;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyX2NvdW50aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvdmFyX2NvdW50aW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxHQUF5QjtJQUN4RCw4RUFBOEU7SUFDOUUsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDakMsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUMvQixRQUFRLElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQzlCO1lBRUQsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDakMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzVCLE9BQU87aUJBQ1I7Z0JBRUQsK0VBQStFO2dCQUMvRSxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDbEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7aUJBQzNCO2dCQUVELElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNqQyxRQUFRLElBQUksc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQzFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELElB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ICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ291bnRzIHRoZSBudW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgdXNlZCB3aXRoaW4gZWFjaCB2aWV3LCBhbmQgc3RvcmVzIHRoYXQgb24gdGhlIHZpZXcgaXRzZWxmLCBhc1xuICogd2VsbCBhcyBwcm9wYWdhdGVzIGl0IHRvIHRoZSBgaXIuVGVtcGxhdGVPcGAgZm9yIGVtYmVkZGVkIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VWYXJDb3VudGluZyhjcGw6IENvbXBvbmVudENvbXBpbGF0aW9uKTogdm9pZCB7XG4gIC8vIEZpcnN0LCBjb3VudCB0aGUgdmFycyB1c2VkIGluIGVhY2ggdmlldywgYW5kIHVwZGF0ZSB0aGUgdmlldy1sZXZlbCBjb3VudGVyLlxuICBmb3IgKGNvbnN0IFtfLCB2aWV3XSBvZiBjcGwudmlld3MpIHtcbiAgICBsZXQgdmFyQ291bnQgPSAwO1xuICAgIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5vcHMoKSkge1xuICAgICAgaWYgKGlyLmhhc0NvbnN1bWVzVmFyc1RyYWl0KG9wKSkge1xuICAgICAgICB2YXJDb3VudCArPSB2YXJzVXNlZEJ5T3Aob3ApO1xuICAgICAgfVxuXG4gICAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgIGlmICghaXIuaXNJckV4cHJlc3Npb24oZXhwcikpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTb21lIGV4cHJlc3Npb25zIHJlcXVpcmUga25vd2xlZGdlIG9mIHRoZSBudW1iZXIgb2YgdmFyaWFibGUgc2xvdHMgY29uc3VtZWQuXG4gICAgICAgIGlmIChpci5oYXNVc2VzVmFyT2Zmc2V0VHJhaXQoZXhwcikpIHtcbiAgICAgICAgICBleHByLnZhck9mZnNldCA9IHZhckNvdW50O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlyLmhhc0NvbnN1bWVzVmFyc1RyYWl0KGV4cHIpKSB7XG4gICAgICAgICAgdmFyQ291bnQgKz0gdmFyc1VzZWRCeUlyRXhwcmVzc2lvbihleHByKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdmlldy52YXJzID0gdmFyQ291bnQ7XG4gIH1cblxuICAvLyBBZGQgdmFyIGNvdW50cyBmb3IgZWFjaCB2aWV3IHRvIHRoZSBgaXIuVGVtcGxhdGVPcGAgd2hpY2ggZGVjbGFyZXMgdGhhdCB2aWV3IChpZiB0aGUgdmlldyBpcyBhblxuICAvLyBlbWJlZGRlZCB2aWV3KS5cbiAgZm9yIChjb25zdCBbXywgdmlld10gb2YgY3BsLnZpZXdzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgIT09IGlyLk9wS2luZC5UZW1wbGF0ZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY2hpbGRWaWV3ID0gY3BsLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICBvcC52YXJzID0gY2hpbGRWaWV3LnZhcnM7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGlmZmVyZW50IG9wZXJhdGlvbnMgdGhhdCBpbXBsZW1lbnQgYGlyLlVzZXNWYXJzVHJhaXRgIHVzZSBkaWZmZXJlbnQgbnVtYmVycyBvZiB2YXJpYWJsZXMsIHNvXG4gKiBjb3VudCB0aGUgdmFyaWFibGVzIHVzZWQgYnkgYW55IHBhcnRpY3VsYXIgYG9wYC5cbiAqL1xuZnVuY3Rpb24gdmFyc1VzZWRCeU9wKG9wOiAoaXIuQ3JlYXRlT3B8aXIuVXBkYXRlT3ApJmlyLkNvbnN1bWVzVmFyc1RyYWl0KTogbnVtYmVyIHtcbiAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgY2FzZSBpci5PcEtpbmQuUHJvcGVydHk6XG4gICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgLy8gUHJvcGVydHkgJiBhdHRyaWJ1dGUgYmluZGluZ3MgdXNlIDEgdmFyaWFibGUgc2xvdC5cbiAgICAgIHJldHVybiAxO1xuICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICBjYXNlIGlyLk9wS2luZC5DbGFzc1Byb3A6XG4gICAgY2FzZSBpci5PcEtpbmQuU3R5bGVNYXA6XG4gICAgY2FzZSBpci5PcEtpbmQuQ2xhc3NNYXA6XG4gICAgICAvLyBTdHlsZSAmIGNsYXNzIGJpbmRpbmdzIHVzZSAyIHZhcmlhYmxlIHNsb3RzLlxuICAgICAgcmV0dXJuIDI7XG4gICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVUZXh0OlxuICAgICAgLy8gYGlyLkludGVycG9sYXRlVGV4dE9wYHMgdXNlIGEgdmFyaWFibGUgc2xvdCBmb3IgZWFjaCBkeW5hbWljIGV4cHJlc3Npb24uXG4gICAgICByZXR1cm4gb3AuZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlUHJvcGVydHk6XG4gICAgICAvLyBgaXIuSW50ZXJwb2xhdGVQcm9wZXJ0eU9wYHMgdXNlIGEgdmFyaWFibGUgc2xvdCBmb3IgZWFjaCBkeW5hbWljIGV4cHJlc3Npb24sIHBsdXMgb25lIGZvclxuICAgICAgLy8gdGhlIHJlc3VsdC5cbiAgICAgIHJldHVybiAxICsgb3AuZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlQXR0cmlidXRlOlxuICAgICAgLy8gT25lIHZhcmlhYmxlIHNsb3QgZm9yIGVhY2ggZHluYW1pYyBleHByZXNzaW9uLCBwbHVzIG9uZSBmb3IgdGhlIHJlc3VsdC5cbiAgICAgIHJldHVybiAxICsgb3AuZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlU3R5bGVQcm9wOlxuICAgIGNhc2UgaXIuT3BLaW5kLkludGVycG9sYXRlU3R5bGVNYXA6XG4gICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVDbGFzc01hcDpcbiAgICAgIC8vIE9uZSB2YXJpYWJsZSBzbG90IGZvciBlYWNoIGR5bmFtaWMgZXhwcmVzc2lvbiwgcGx1cyB0d28gZm9yIGJpbmRpbmcgdGhlIHJlc3VsdC5cbiAgICAgIHJldHVybiAyICsgb3AuZXhwcmVzc2lvbnMubGVuZ3RoO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaGFuZGxlZCBvcDogJHtpci5PcEtpbmRbb3Aua2luZF19YCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhcnNVc2VkQnlJckV4cHJlc3Npb24oZXhwcjogaXIuRXhwcmVzc2lvbiZpci5Db25zdW1lc1ZhcnNUcmFpdCk6IG51bWJlciB7XG4gIHN3aXRjaCAoZXhwci5raW5kKSB7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QdXJlRnVuY3Rpb25FeHByOlxuICAgICAgcmV0dXJuIDEgKyBleHByLmFyZ3MubGVuZ3RoO1xuICAgIGNhc2UgaXIuRXhwcmVzc2lvbktpbmQuUGlwZUJpbmRpbmc6XG4gICAgICByZXR1cm4gMSArIGV4cHIuYXJncy5sZW5ndGg7XG4gICAgY2FzZSBpci5FeHByZXNzaW9uS2luZC5QaXBlQmluZGluZ1ZhcmlhZGljOlxuICAgICAgcmV0dXJuIDEgKyBleHByLm51bUFyZ3M7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IHVuaGFuZGxlZCBDb25zdW1lc1ZhcnNUcmFpdCBleHByZXNzaW9uICR7ZXhwci5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG4iXX0=