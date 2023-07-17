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
export function phaseAttributeExtraction(cpl, compatibility) {
    for (const [_, view] of cpl.views) {
        populateElementAttributes(view, compatibility);
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
 * Removes the op if its expression is empty.
 */
function removeIfExpressionIsEmpty(op, expression) {
    if (expression instanceof ir.EmptyExpr) {
        ir.OpList.remove(op);
        return true;
    }
    return false;
}
/**
 * Populates the ElementAttributes map for the given view, and removes ops for any bindings that do
 * not need further processing.
 */
function populateElementAttributes(view, compatibility) {
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
                // The old compiler only extracted string constants, so we emulate that behavior in
                // compaitiblity mode, otherwise we optimize more aggressively.
                let extractable = compatibility ?
                    (op.value instanceof o.LiteralExpr && typeof op.value.value === 'string') :
                    (op.value.isConstant());
                // We don't need to generate instructions for attributes that can be extracted as consts.
                if (extractable) {
                    ownerOp.attributes.add(op.attributeKind, op.name, op.value);
                    ir.OpList.remove(op);
                }
                break;
            case ir.OpKind.Property:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                removeIfExpressionIsEmpty(op, op.expression);
                ownerOp.attributes.add(op.bindingKind, op.name, null);
                break;
            case ir.OpKind.InterpolateProperty:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                ownerOp.attributes.add(op.bindingKind, op.name, null);
                break;
            case ir.OpKind.StyleProp:
            case ir.OpKind.ClassProp:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                // The old compiler treated empty style bindings as regular bindings for the purpose of
                // directive matching. That behavior is incorrect, but we emulate it in compatibility mode.
                if (removeIfExpressionIsEmpty(op, op.expression) && compatibility) {
                    ownerOp.attributes.add(ir.ElementAttributeKind.Binding, op.name, null);
                }
                break;
            case ir.OpKind.Listener:
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                ownerOp.attributes.add(ir.ElementAttributeKind.Binding, op.name, null);
                // We don't need to generate instructions for listeners on templates.
                if (ownerOp.kind === ir.OpKind.Template) {
                    ir.OpList.remove(op);
                }
                break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxHQUF5QixFQUFFLGFBQXNCO0lBQ3hGLEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQ2pDLHlCQUF5QixDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztLQUNoRDtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUNsQixRQUFrRCxFQUFFLElBQWU7SUFDckUsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUU7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0QsT0FBTyxFQUFFLENBQUM7QUFDWixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLHlCQUF5QixDQUFDLEVBQTJCLEVBQUUsVUFBd0I7SUFDdEYsSUFBSSxVQUFVLFlBQVksRUFBRSxDQUFDLFNBQVMsRUFBRTtRQUN0QyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFpQixDQUFDLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQVMseUJBQXlCLENBQUMsSUFBcUIsRUFBRSxhQUFzQjtJQUM5RSxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztJQUNoRSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUNsQyxTQUFTO1NBQ1Y7UUFDRCxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7S0FDM0I7SUFFRCxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUMzQixJQUFJLE9BQTJDLENBQUM7UUFDaEQsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7Z0JBQ3RCLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDN0MsRUFBRSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFFakQsbUZBQW1GO2dCQUNuRiwrREFBK0Q7Z0JBQy9ELElBQUksV0FBVyxHQUFHLGFBQWEsQ0FBQyxDQUFDO29CQUM3QixDQUFDLEVBQUUsQ0FBQyxLQUFLLFlBQVksQ0FBQyxDQUFDLFdBQVcsSUFBSSxPQUFPLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQzNFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO2dCQUU1Qix5RkFBeUY7Z0JBQ3pGLElBQUksV0FBVyxFQUFFO29CQUNmLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzVELEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQWlCLENBQUMsQ0FBQztpQkFDckM7Z0JBQ0QsTUFBTTtZQUVSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixPQUFPLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzdDLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ2pELHlCQUF5QixDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQzdDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDdEQsTUFBTTtZQUVSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUI7Z0JBQ2hDLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDN0MsRUFBRSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDakQsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN0RCxNQUFNO1lBRVIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztZQUN6QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztnQkFDdEIsT0FBTyxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM3QyxFQUFFLENBQUMseUJBQXlCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUVqRCx1RkFBdUY7Z0JBQ3ZGLDJGQUEyRjtnQkFDM0YsSUFBSSx5QkFBeUIsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLGFBQWEsRUFBRTtvQkFDakUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2lCQUN4RTtnQkFDRCxNQUFNO1lBRVIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLE9BQU8sR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDN0MsRUFBRSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFFakQsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUV2RSxxRUFBcUU7Z0JBQ3JFLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtvQkFDdkMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBaUIsQ0FBQyxDQUFDO2lCQUNyQztnQkFDRCxNQUFNO1NBQ1Q7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uLCBWaWV3Q29tcGlsYXRpb259IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBGaW5kIGFsbCBhdHRyaWJ1dGUgYW5kIGJpbmRpbmcgb3BzLCBhbmQgY29sbGVjdCB0aGVtIGludG8gdGhlIEVsZW1lbnRBdHRyaWJ1dGUgc3RydWN0dXJlcy5cbiAqIEluIGNhc2VzIHdoZXJlIG5vIGluc3RydWN0aW9uIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCBmb3IgdGhlIGF0dHJpYnV0ZSBvciBiaW5kaW5nLCBpdCBpcyByZW1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VBdHRyaWJ1dGVFeHRyYWN0aW9uKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb24sIGNvbXBhdGliaWxpdHk6IGJvb2xlYW4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBbXywgdmlld10gb2YgY3BsLnZpZXdzKSB7XG4gICAgcG9wdWxhdGVFbGVtZW50QXR0cmlidXRlcyh2aWV3LCBjb21wYXRpYmlsaXR5KTtcbiAgfVxufVxuXG4vKipcbiAqIExvb2tzIHVwIGFuIGVsZW1lbnQgaW4gdGhlIGdpdmVuIG1hcCBieSB4cmVmIElELlxuICovXG5mdW5jdGlvbiBsb29rdXBFbGVtZW50KFxuICAgIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5FbGVtZW50T3JDb250YWluZXJPcHM+LCB4cmVmOiBpci5YcmVmSWQpOiBpci5FbGVtZW50T3JDb250YWluZXJPcHMge1xuICBjb25zdCBlbCA9IGVsZW1lbnRzLmdldCh4cmVmKTtcbiAgaWYgKGVsID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FsbCBhdHRyaWJ1dGVzIHNob3VsZCBoYXZlIGFuIGVsZW1lbnQtbGlrZSB0YXJnZXQuJyk7XG4gIH1cbiAgcmV0dXJuIGVsO1xufVxuXG4vKipcbiAqIFJlbW92ZXMgdGhlIG9wIGlmIGl0cyBleHByZXNzaW9uIGlzIGVtcHR5LlxuICovXG5mdW5jdGlvbiByZW1vdmVJZkV4cHJlc3Npb25Jc0VtcHR5KG9wOiBpci5VcGRhdGVPcHxpci5DcmVhdGVPcCwgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSB7XG4gIGlmIChleHByZXNzaW9uIGluc3RhbmNlb2YgaXIuRW1wdHlFeHByKSB7XG4gICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5VcGRhdGVPcCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIFBvcHVsYXRlcyB0aGUgRWxlbWVudEF0dHJpYnV0ZXMgbWFwIGZvciB0aGUgZ2l2ZW4gdmlldywgYW5kIHJlbW92ZXMgb3BzIGZvciBhbnkgYmluZGluZ3MgdGhhdCBkb1xuICogbm90IG5lZWQgZnVydGhlciBwcm9jZXNzaW5nLlxuICovXG5mdW5jdGlvbiBwb3B1bGF0ZUVsZW1lbnRBdHRyaWJ1dGVzKHZpZXc6IFZpZXdDb21waWxhdGlvbiwgY29tcGF0aWJpbGl0eTogYm9vbGVhbikge1xuICBjb25zdCBlbGVtZW50cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5FbGVtZW50T3JDb250YWluZXJPcHM+KCk7XG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5jcmVhdGUpIHtcbiAgICBpZiAoIWlyLmlzRWxlbWVudE9yQ29udGFpbmVyT3Aob3ApKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgZWxlbWVudHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgb3Agb2Ygdmlldy5vcHMoKSkge1xuICAgIGxldCBvd25lck9wOiBpci5FbGVtZW50T3JDb250YWluZXJPcHN8dW5kZWZpbmVkO1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuQXR0cmlidXRlOlxuICAgICAgICBvd25lck9wID0gbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgICAgaXIuYXNzZXJ0SXNFbGVtZW50QXR0cmlidXRlcyhvd25lck9wLmF0dHJpYnV0ZXMpO1xuXG4gICAgICAgIC8vIFRoZSBvbGQgY29tcGlsZXIgb25seSBleHRyYWN0ZWQgc3RyaW5nIGNvbnN0YW50cywgc28gd2UgZW11bGF0ZSB0aGF0IGJlaGF2aW9yIGluXG4gICAgICAgIC8vIGNvbXBhaXRpYmxpdHkgbW9kZSwgb3RoZXJ3aXNlIHdlIG9wdGltaXplIG1vcmUgYWdncmVzc2l2ZWx5LlxuICAgICAgICBsZXQgZXh0cmFjdGFibGUgPSBjb21wYXRpYmlsaXR5ID9cbiAgICAgICAgICAgIChvcC52YWx1ZSBpbnN0YW5jZW9mIG8uTGl0ZXJhbEV4cHIgJiYgdHlwZW9mIG9wLnZhbHVlLnZhbHVlID09PSAnc3RyaW5nJykgOlxuICAgICAgICAgICAgKG9wLnZhbHVlLmlzQ29uc3RhbnQoKSk7XG5cbiAgICAgICAgLy8gV2UgZG9uJ3QgbmVlZCB0byBnZW5lcmF0ZSBpbnN0cnVjdGlvbnMgZm9yIGF0dHJpYnV0ZXMgdGhhdCBjYW4gYmUgZXh0cmFjdGVkIGFzIGNvbnN0cy5cbiAgICAgICAgaWYgKGV4dHJhY3RhYmxlKSB7XG4gICAgICAgICAgb3duZXJPcC5hdHRyaWJ1dGVzLmFkZChvcC5hdHRyaWJ1dGVLaW5kLCBvcC5uYW1lLCBvcC52YWx1ZSk7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5VcGRhdGVPcCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb3BlcnR5OlxuICAgICAgICBvd25lck9wID0gbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgICAgaXIuYXNzZXJ0SXNFbGVtZW50QXR0cmlidXRlcyhvd25lck9wLmF0dHJpYnV0ZXMpO1xuICAgICAgICByZW1vdmVJZkV4cHJlc3Npb25Jc0VtcHR5KG9wLCBvcC5leHByZXNzaW9uKTtcbiAgICAgICAgb3duZXJPcC5hdHRyaWJ1dGVzLmFkZChvcC5iaW5kaW5nS2luZCwgb3AubmFtZSwgbnVsbCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIGlyLk9wS2luZC5JbnRlcnBvbGF0ZVByb3BlcnR5OlxuICAgICAgICBvd25lck9wID0gbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgICAgaXIuYXNzZXJ0SXNFbGVtZW50QXR0cmlidXRlcyhvd25lck9wLmF0dHJpYnV0ZXMpO1xuICAgICAgICBvd25lck9wLmF0dHJpYnV0ZXMuYWRkKG9wLmJpbmRpbmdLaW5kLCBvcC5uYW1lLCBudWxsKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICAvLyBUaGUgb2xkIGNvbXBpbGVyIHRyZWF0ZWQgZW1wdHkgc3R5bGUgYmluZGluZ3MgYXMgcmVndWxhciBiaW5kaW5ncyBmb3IgdGhlIHB1cnBvc2Ugb2ZcbiAgICAgICAgLy8gZGlyZWN0aXZlIG1hdGNoaW5nLiBUaGF0IGJlaGF2aW9yIGlzIGluY29ycmVjdCwgYnV0IHdlIGVtdWxhdGUgaXQgaW4gY29tcGF0aWJpbGl0eSBtb2RlLlxuICAgICAgICBpZiAocmVtb3ZlSWZFeHByZXNzaW9uSXNFbXB0eShvcCwgb3AuZXhwcmVzc2lvbikgJiYgY29tcGF0aWJpbGl0eSkge1xuICAgICAgICAgIG93bmVyT3AuYXR0cmlidXRlcy5hZGQoaXIuRWxlbWVudEF0dHJpYnV0ZUtpbmQuQmluZGluZywgb3AubmFtZSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgaXIuT3BLaW5kLkxpc3RlbmVyOlxuICAgICAgICBvd25lck9wID0gbG9va3VwRWxlbWVudChlbGVtZW50cywgb3AudGFyZ2V0KTtcbiAgICAgICAgaXIuYXNzZXJ0SXNFbGVtZW50QXR0cmlidXRlcyhvd25lck9wLmF0dHJpYnV0ZXMpO1xuXG4gICAgICAgIG93bmVyT3AuYXR0cmlidXRlcy5hZGQoaXIuRWxlbWVudEF0dHJpYnV0ZUtpbmQuQmluZGluZywgb3AubmFtZSwgbnVsbCk7XG5cbiAgICAgICAgLy8gV2UgZG9uJ3QgbmVlZCB0byBnZW5lcmF0ZSBpbnN0cnVjdGlvbnMgZm9yIGxpc3RlbmVycyBvbiB0ZW1wbGF0ZXMuXG4gICAgICAgIGlmIChvd25lck9wLmtpbmQgPT09IGlyLk9wS2luZC5UZW1wbGF0ZSkge1xuICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmUob3AgYXMgaXIuQ3JlYXRlT3ApO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuIl19