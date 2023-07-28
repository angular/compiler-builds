/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
/**
 * Find all attribute and binding ops, and collect them into the ElementAttribute structures.
 * In cases where no instruction needs to be generated for the attribute or binding, it is removed.
 */
export function phaseAttributeExtraction(cpl) {
    for (const [_, view] of cpl.views) {
        populateElementAttributes(view);
    }
}
/**
 * Looks up an element in the given map by xref ID.
 */
function lookupElement(elements, xref) {
    const el = elements.get(xref);
    if (el === undefined) {
        throw new Error('All attributes should have an element-like target.');
    }
    return el;
}
/**
 * Populates the ElementAttributes map for the given view, and removes ops for any bindings that do
 * not need further processing.
 */
function populateElementAttributes(view) {
    const elements = new Map();
    for (const op of view.create) {
        if (!ir.isElementOrContainerOp(op)) {
            continue;
        }
        elements.set(op.xref, op);
    }
    for (const op of view.ops()) {
        let ownerOp;
        switch (op.kind) {
            case ir.OpKind.Attribute:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                if (op.expression instanceof ir.Interpolation) {
                    continue;
                }
                // The old compiler only extracted string constants, so we emulate that behavior in
                // compaitiblity mode, otherwise we optimize more aggressively.
                let extractable = view.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder ?
                    (op.expression instanceof o.LiteralExpr && typeof op.expression.value === 'string') :
                    op.expression.isConstant();
                // We don't need to generate instructions for attributes that can be extracted as consts.
                if (extractable) {
                    ownerOp.attributes.add(op.isTemplate ? ir.BindingKind.Template : ir.BindingKind.Attribute, op.name, op.expression);
                    ir.OpList.remove(op);
                }
                break;
            case ir.OpKind.Property:
                if (op.isAnimationTrigger) {
                    continue; // Don't extract animation properties.
                }
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                ownerOp.attributes.add(op.isTemplate ? ir.BindingKind.Template : ir.BindingKind.Property, op.name, null);
                break;
            case ir.OpKind.StyleProp:
            case ir.OpKind.ClassProp:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                // Empty StyleProperty and ClassName expressions are treated differently depending on
                // compatibility mode.
                if (view.compatibility === ir.CompatibilityMode.TemplateDefinitionBuilder &&
                    op.expression instanceof ir.EmptyExpr) {
                    // The old compiler treated empty style bindings as regular bindings for the purpose of
                    // directive matching. That behavior is incorrect, but we emulate it in compatibility
                    // mode.
                    ownerOp.attributes.add(ir.BindingKind.Property, op.name, null);
                }
                break;
            case ir.OpKind.Listener:
                if (op.isAnimationListener) {
                    continue; // Don't extract animation listeners.
                }
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                ownerOp.attributes.add(ir.BindingKind.Property, op.name, null);
                break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxHQUE0QjtJQUNuRSxLQUFLLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUNqQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNqQztBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUNsQixRQUFrRCxFQUFFLElBQWU7SUFDckUsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUU7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0QsT0FBTyxFQUFFLENBQUM7QUFDWixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyx5QkFBeUIsQ0FBQyxJQUF5QjtJQUMxRCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztJQUNoRSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUNsQyxTQUFTO1NBQ1Y7UUFDRCxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJ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QUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIsSUFBSSxFQUFFLENBQUMsbUJBQW1CLEVBQUU7b0JBQzFCLFNBQVMsQ0FBRSxxQ0FBcUM7aUJBQ2pEO2dCQUNELE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDN0MsRUFBRSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFFakQsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDL0QsTUFBTTtTQUNUO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEZpbmQgYWxsIGF0dHJpYnV0ZSBhbmQgYmluZGluZyBvcHMsIGFuZCBjb2xsZWN0IHRoZW0gaW50byB0aGUgRWxlbWVudEF0dHJpYnV0ZSBzdHJ1Y3R1cmVzLlxuICogSW4gY2FzZXMgd2hlcmUgbm8gaW5zdHJ1Y3Rpb24gbmVlZHMgdG8gYmUgZ2VuZXJhdGVkIGZvciB0aGUgYXR0cmlidXRlIG9yIGJpbmRpbmcsIGl0IGlzIHJlbW92ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZUF0dHJpYnV0ZUV4dHJhY3Rpb24oY3BsOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IFtfLCB2aWV3XSBvZiBjcGwudmlld3MpIHtcbiAgICBwb3B1bGF0ZUVsZW1lbnRBdHRyaWJ1dGVzKHZpZXcpO1xuICB9XG59XG5cbi8qKlxuICogTG9va3MgdXAgYW4gZWxlbWVudCBpbiB0aGUgZ2l2ZW4gbWFwIGJ5IHhyZWYgSUQuXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cEVsZW1lbnQoXG4gICAgZWxlbWVudHM6IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRPckNvbnRhaW5lck9wcz4sIHhyZWY6IGlyLlhyZWZJZCk6IGlyLkVsZW1lbnRPckNvbnRhaW5lck9wcyB7XG4gIGNvbnN0IGVsID0gZWxlbWVudHMuZ2V0KHhyZWYpO1xuICBpZiAoZWwgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQWxsIGF0dHJpYnV0ZXMgc2hvdWxkIGhhdmUgYW4gZWxlbWVudC1saWtlIHRhcmdldC4nKTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbi8qKlxuICogUG9wdWxhdGVzIHRoZSBFbGVtZW50QXR0cmlidXRlcyBtYXAgZm9yIHRoZSBnaXZlbiB2aWV3LCBhbmQgcmVtb3ZlcyBvcHMgZm9yIGFueSBiaW5kaW5ncyB0aGF0IGRvXG4gKiBub3QgbmVlZCBmdXJ0aGVyIHByb2Nlc3NpbmcuXG4gKi9cbmZ1bmN0aW9uIHBvcHVsYXRlRWxlbWVudEF0dHJpYnV0ZXModmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCkge1xuICBjb25zdCBlbGVtZW50cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5FbGVtZW50T3JDb250YWluZXJPcHM+KCk7XG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBpZiAoIWlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3ApKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgZWxlbWVudHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5vcHMoKSkge1xuICAgIGxldCBvd25lck9wOiBSZXR1cm5UeXBlPHR5cGVvZiBsb29rdXBFbGVtZW50PjtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICBpZiAob3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBvbGQgY29tcGlsZXIgb25seSBleHRyYWN0ZWQgc3RyaW5nIGNvbnN0YW50cywgc28gd2UgZW11bGF0ZSB0aGF0IGJlaGF2aW9yIGluXG4gICAgICAgIC8vIGNvbXBhaXRpYmxpdHkgbW9kZSwgb3RoZXJ3aXNlIHdlIG9wdGltaXplIG1vcmUgYWdncmVzc2l2ZWx5LlxuICAgICAgICBsZXQgZXh0cmFjdGFibGUgPSB2aWV3LmNvbXBhdGliaWxpdHkgPT09IGlyLkNvbXBhdGliaWxpdHlNb2RlLlRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgP1xuICAgICAgICAgICAgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByICYmIHR5cGVvZiBvcC5leHByZXNzaW9uLnZhbHVlID09PSAnc3RyaW5nJykgOlxuICAgICAgICAgICAgb3AuZXhwcmVzc2lvbi5pc0NvbnN0YW50KCk7XG5cbiAgICAgICAgLy8gV2UgZG9uJ3QgbmVlZCB0byBnZW5lcmF0ZSBpbnN0cnVjdGlvbnMgZm9yIGF0dHJpYnV0ZXMgdGhhdCBjYW4gYmUgZXh0cmFjdGVkIGFzIGNvbnN0cy5cbiAgICAgICAgaWYgKGV4dHJhY3RhYmxlKSB7XG4gICAgICAgICAgb3duZXJPcC5hdHRyaWJ1dGVzLmFkZChcbiAgICAgICAgICAgICAgb3AuaXNUZW1wbGF0ZSA/IGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlIDogaXIuQmluZGluZ0tpbmQuQXR0cmlidXRlLCBvcC5uYW1lLFxuICAgICAgICAgICAgICBvcC5leHByZXNzaW9uKTtcbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlKG9wIGFzIGlyLlVwZGF0ZU9wKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgICBpZiAob3AuaXNBbmltYXRpb25UcmlnZ2VyKSB7XG4gICAgICAgICAgY29udGludWU7ICAvLyBEb24ndCBleHRyYWN0IGFuaW1hdGlvbiBwcm9wZXJ0aWVzLlxuICAgICAgICB9XG5cbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICBvd25lck9wLmF0dHJpYnV0ZXMuYWRkKFxuICAgICAgICAgICAgb3AuaXNUZW1wbGF0ZSA/IGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlIDogaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG9wLm5hbWUsIG51bGwpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICAvLyBFbXB0eSBTdHlsZVByb3BlcnR5IGFuZCBDbGFzc05hbWUgZXhwcmVzc2lvbnMgYXJlIHRyZWF0ZWQgZGlmZmVyZW50bHkgZGVwZW5kaW5nIG9uXG4gICAgICAgIC8vIGNvbXBhdGliaWxpdHkgbW9kZS5cbiAgICAgICAgaWYgKHZpZXcuY29tcGF0aWJpbGl0eSA9PT0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciAmJlxuICAgICAgICAgICAgb3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkVtcHR5RXhwcikge1xuICAgICAgICAgIC8vIFRoZSBvbGQgY29tcGlsZXIgdHJlYXRlZCBlbXB0eSBzdHlsZSBiaW5kaW5ncyBhcyByZWd1bGFyIGJpbmRpbmdzIGZvciB0aGUgcHVycG9zZSBvZlxuICAgICAgICAgIC8vIGRpcmVjdGl2ZSBtYXRjaGluZy4gVGhhdCBiZWhhdmlvciBpcyBpbmNvcnJlY3QsIGJ1dCB3ZSBlbXVsYXRlIGl0IGluIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAvLyBtb2RlLlxuICAgICAgICAgIG93bmVyT3AuYXR0cmlidXRlcy5hZGQoaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG9wLm5hbWUsIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIGlmIChvcC5pc0FuaW1hdGlvbkxpc3RlbmVyKSB7XG4gICAgICAgICAgY29udGludWU7ICAvLyBEb24ndCBleHRyYWN0IGFuaW1hdGlvbiBsaXN0ZW5lcnMuXG4gICAgICAgIH1cbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICBvd25lck9wLmF0dHJpYnV0ZXMuYWRkKGlyLkJpbmRpbmdLaW5kLlByb3BlcnR5LCBvcC5uYW1lLCBudWxsKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG4iXX0=