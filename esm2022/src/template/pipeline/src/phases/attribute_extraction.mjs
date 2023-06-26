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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxHQUF5QixFQUFFLGFBQXNCO0lBQ3hGLEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQ2pDLHlCQUF5QixDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztLQUNoRDtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUNsQixRQUFrRCxFQUFFLElBQWU7SUFDckUsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUU7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0QsT0FBTyxFQUFFLENBQUM7QUFDWixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLHlCQUF5QixDQUFDLEVBQTJCLEVBQUUsVUFBd0I7SUFDdEYsSUFBSSxVQUFVLFlBQVksRUFBRSxDQUFDLFNBQVMsRUFBRTtRQUN0QyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFpQixDQUFDLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVEOzs7R0FHRztB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QUUsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFDeEU7Z0JBQ0QsTUFBTTtZQUVSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRO2dCQUNyQixPQUFPLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzdDLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBRWpELE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFFdkUscUVBQXFFO2dCQUNyRSxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7b0JBQ3ZDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQWlCLENBQUMsQ0FBQztpQkFDckM7Z0JBQ0QsTUFBTTtTQUNUO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbiwgVmlld0NvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogRmluZCBhbGwgYXR0cmlidXRlIGFuZCBiaW5kaW5nIG9wcywgYW5kIGNvbGxlY3QgdGhlbSBpbnRvIHRoZSBFbGVtZW50QXR0cmlidXRlIHN0cnVjdHVyZXMuXG4gKiBJbiBjYXNlcyB3aGVyZSBubyBpbnN0cnVjdGlvbiBuZWVkcyB0byBiZSBnZW5lcmF0ZWQgZm9yIHRoZSBhdHRyaWJ1dGUgb3IgYmluZGluZywgaXQgaXMgcmVtb3ZlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlQXR0cmlidXRlRXh0cmFjdGlvbihjcGw6IENvbXBvbmVudENvbXBpbGF0aW9uLCBjb21wYXRpYmlsaXR5OiBib29sZWFuKTogdm9pZCB7XG4gIGZvciAoY29uc3QgW18sIHZpZXddIG9mIGNwbC52aWV3cykge1xuICAgIHBvcHVsYXRlRWxlbWVudEF0dHJpYnV0ZXModmlldywgY29tcGF0aWJpbGl0eSk7XG4gIH1cbn1cblxuLyoqXG4gKiBMb29rcyB1cCBhbiBlbGVtZW50IGluIHRoZSBnaXZlbiBtYXAgYnkgeHJlZiBJRC5cbiAqL1xuZnVuY3Rpb24gbG9va3VwRWxlbWVudChcbiAgICBlbGVtZW50czogTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzPiwgeHJlZjogaXIuWHJlZklkKTogaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzIHtcbiAgY29uc3QgZWwgPSBlbGVtZW50cy5nZXQoeHJlZik7XG4gIGlmIChlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgYXR0cmlidXRlcyBzaG91bGQgaGF2ZSBhbiBlbGVtZW50LWxpa2UgdGFyZ2V0LicpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBSZW1vdmVzIHRoZSBvcCBpZiBpdHMgZXhwcmVzc2lvbiBpcyBlbXB0eS5cbiAqL1xuZnVuY3Rpb24gcmVtb3ZlSWZFeHByZXNzaW9uSXNFbXB0eShvcDogaXIuVXBkYXRlT3B8aXIuQ3JlYXRlT3AsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbikge1xuICBpZiAoZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkVtcHR5RXhwcikge1xuICAgIGlyLk9wTGlzdC5yZW1vdmUob3AgYXMgaXIuVXBkYXRlT3ApO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBQb3B1bGF0ZXMgdGhlIEVsZW1lbnRBdHRyaWJ1dGVzIG1hcCBmb3IgdGhlIGdpdmVuIHZpZXcsIGFuZCByZW1vdmVzIG9wcyBmb3IgYW55IGJpbmRpbmdzIHRoYXQgZG9cbiAqIG5vdCBuZWVkIGZ1cnRoZXIgcHJvY2Vzc2luZy5cbiAqL1xuZnVuY3Rpb24gcG9wdWxhdGVFbGVtZW50QXR0cmlidXRlcyh2aWV3OiBWaWV3Q29tcGlsYXRpb24sIGNvbXBhdGliaWxpdHk6IGJvb2xlYW4pIHtcbiAgY29uc3QgZWxlbWVudHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzPigpO1xuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgaWYgKCFpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG9wKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGVsZW1lbnRzLnNldChvcC54cmVmLCBvcCk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcub3BzKCkpIHtcbiAgICBsZXQgb3duZXJPcDogaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzfHVuZGVmaW5lZDtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkF0dHJpYnV0ZTpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICAvLyBUaGUgb2xkIGNvbXBpbGVyIG9ubHkgZXh0cmFjdGVkIHN0cmluZyBjb25zdGFudHMsIHNvIHdlIGVtdWxhdGUgdGhhdCBiZWhhdmlvciBpblxuICAgICAgICAvLyBjb21wYWl0aWJsaXR5IG1vZGUsIG90aGVyd2lzZSB3ZSBvcHRpbWl6ZSBtb3JlIGFnZ3Jlc3NpdmVseS5cbiAgICAgICAgbGV0IGV4dHJhY3RhYmxlID0gY29tcGF0aWJpbGl0eSA/XG4gICAgICAgICAgICAob3AudmFsdWUgaW5zdGFuY2VvZiBvLkxpdGVyYWxFeHByICYmIHR5cGVvZiBvcC52YWx1ZS52YWx1ZSA9PT0gJ3N0cmluZycpIDpcbiAgICAgICAgICAgIChvcC52YWx1ZS5pc0NvbnN0YW50KCkpO1xuXG4gICAgICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZ2VuZXJhdGUgaW5zdHJ1Y3Rpb25zIGZvciBhdHRyaWJ1dGVzIHRoYXQgY2FuIGJlIGV4dHJhY3RlZCBhcyBjb25zdHMuXG4gICAgICAgIGlmIChleHRyYWN0YWJsZSkge1xuICAgICAgICAgIG93bmVyT3AuYXR0cmlidXRlcy5hZGQob3AuYXR0cmlidXRlS2luZCwgb3AubmFtZSwgb3AudmFsdWUpO1xuICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmUob3AgYXMgaXIuVXBkYXRlT3ApO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcbiAgICAgICAgcmVtb3ZlSWZFeHByZXNzaW9uSXNFbXB0eShvcCwgb3AuZXhwcmVzc2lvbik7XG4gICAgICAgIG93bmVyT3AuYXR0cmlidXRlcy5hZGQob3AuYmluZGluZ0tpbmQsIG9wLm5hbWUsIG51bGwpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBpci5PcEtpbmQuSW50ZXJwb2xhdGVQcm9wZXJ0eTpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcbiAgICAgICAgb3duZXJPcC5hdHRyaWJ1dGVzLmFkZChvcC5iaW5kaW5nS2luZCwgb3AubmFtZSwgbnVsbCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIGlyLk9wS2luZC5TdHlsZVByb3A6XG4gICAgICAgIG93bmVyT3AgPSBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpO1xuICAgICAgICBpci5hc3NlcnRJc0VsZW1lbnRBdHRyaWJ1dGVzKG93bmVyT3AuYXR0cmlidXRlcyk7XG5cbiAgICAgICAgLy8gVGhlIG9sZCBjb21waWxlciB0cmVhdGVkIGVtcHR5IHN0eWxlIGJpbmRpbmdzIGFzIHJlZ3VsYXIgYmluZGluZ3MgZm9yIHRoZSBwdXJwb3NlIG9mXG4gICAgICAgIC8vIGRpcmVjdGl2ZSBtYXRjaGluZy4gVGhhdCBiZWhhdmlvciBpcyBpbmNvcnJlY3QsIGJ1dCB3ZSBlbXVsYXRlIGl0IGluIGNvbXBhdGliaWxpdHkgbW9kZS5cbiAgICAgICAgaWYgKHJlbW92ZUlmRXhwcmVzc2lvbklzRW1wdHkob3AsIG9wLmV4cHJlc3Npb24pICYmIGNvbXBhdGliaWxpdHkpIHtcbiAgICAgICAgICBvd25lck9wLmF0dHJpYnV0ZXMuYWRkKGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLkJpbmRpbmcsIG9wLm5hbWUsIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIGlyLk9wS2luZC5MaXN0ZW5lcjpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICBvd25lck9wLmF0dHJpYnV0ZXMuYWRkKGlyLkVsZW1lbnRBdHRyaWJ1dGVLaW5kLkJpbmRpbmcsIG9wLm5hbWUsIG51bGwpO1xuXG4gICAgICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZ2VuZXJhdGUgaW5zdHJ1Y3Rpb25zIGZvciBsaXN0ZW5lcnMgb24gdGVtcGxhdGVzLlxuICAgICAgICBpZiAob3duZXJPcC5raW5kID09PSBpci5PcEtpbmQuVGVtcGxhdGUpIHtcbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlKG9wIGFzIGlyLkNyZWF0ZU9wKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cbiJdfQ==