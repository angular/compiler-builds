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
                ownerOp = lookupElement(elements, op.target);
                ir.assertIsElementAttributes(ownerOp.attributes);
                ownerOp.attributes.add(ir.BindingKind.Property, op.name, null);
                break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRlX2V4dHJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvc3JjL3BoYXNlcy9hdHRyaWJ1dGVfZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxHQUE0QjtJQUNuRSxLQUFLLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUNqQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNqQztBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsYUFBYSxDQUNsQixRQUFrRCxFQUFFLElBQWU7SUFDckUsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUU7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0QsT0FBTyxFQUFFLENBQUM7QUFDWixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyx5QkFBeUIsQ0FBQyxJQUF5QjtJQUMxRCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztJQUNoRSxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUNsQyxTQUFTO1NBQ1Y7UUFDRCxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJ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LENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzdDLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBRWpELE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQy9ELE1BQU07U0FDVDtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBGaW5kIGFsbCBhdHRyaWJ1dGUgYW5kIGJpbmRpbmcgb3BzLCBhbmQgY29sbGVjdCB0aGVtIGludG8gdGhlIEVsZW1lbnRBdHRyaWJ1dGUgc3RydWN0dXJlcy5cbiAqIEluIGNhc2VzIHdoZXJlIG5vIGluc3RydWN0aW9uIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCBmb3IgdGhlIGF0dHJpYnV0ZSBvciBiaW5kaW5nLCBpdCBpcyByZW1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VBdHRyaWJ1dGVFeHRyYWN0aW9uKGNwbDogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgZm9yIChjb25zdCBbXywgdmlld10gb2YgY3BsLnZpZXdzKSB7XG4gICAgcG9wdWxhdGVFbGVtZW50QXR0cmlidXRlcyh2aWV3KTtcbiAgfVxufVxuXG4vKipcbiAqIExvb2tzIHVwIGFuIGVsZW1lbnQgaW4gdGhlIGdpdmVuIG1hcCBieSB4cmVmIElELlxuICovXG5mdW5jdGlvbiBsb29rdXBFbGVtZW50KFxuICAgIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5FbGVtZW50T3JDb250YWluZXJPcHM+LCB4cmVmOiBpci5YcmVmSWQpOiBpci5FbGVtZW50T3JDb250YWluZXJPcHMge1xuICBjb25zdCBlbCA9IGVsZW1lbnRzLmdldCh4cmVmKTtcbiAgaWYgKGVsID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FsbCBhdHRyaWJ1dGVzIHNob3VsZCBoYXZlIGFuIGVsZW1lbnQtbGlrZSB0YXJnZXQuJyk7XG4gIH1cbiAgcmV0dXJuIGVsO1xufVxuXG4vKipcbiAqIFBvcHVsYXRlcyB0aGUgRWxlbWVudEF0dHJpYnV0ZXMgbWFwIGZvciB0aGUgZ2l2ZW4gdmlldywgYW5kIHJlbW92ZXMgb3BzIGZvciBhbnkgYmluZGluZ3MgdGhhdCBkb1xuICogbm90IG5lZWQgZnVydGhlciBwcm9jZXNzaW5nLlxuICovXG5mdW5jdGlvbiBwb3B1bGF0ZUVsZW1lbnRBdHRyaWJ1dGVzKHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQpIHtcbiAgY29uc3QgZWxlbWVudHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudE9yQ29udGFpbmVyT3BzPigpO1xuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcuY3JlYXRlKSB7XG4gICAgaWYgKCFpci5pc0VsZW1lbnRPckNvbnRhaW5lck9wKG9wKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGVsZW1lbnRzLnNldChvcC54cmVmLCBvcCk7XG4gIH1cblxuICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcub3BzKCkpIHtcbiAgICBsZXQgb3duZXJPcDogUmV0dXJuVHlwZTx0eXBlb2YgbG9va3VwRWxlbWVudD47XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5BdHRyaWJ1dGU6XG4gICAgICAgIG93bmVyT3AgPSBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpO1xuICAgICAgICBpci5hc3NlcnRJc0VsZW1lbnRBdHRyaWJ1dGVzKG93bmVyT3AuYXR0cmlidXRlcyk7XG5cbiAgICAgICAgaWYgKG9wLmV4cHJlc3Npb24gaW5zdGFuY2VvZiBpci5JbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgb2xkIGNvbXBpbGVyIG9ubHkgZXh0cmFjdGVkIHN0cmluZyBjb25zdGFudHMsIHNvIHdlIGVtdWxhdGUgdGhhdCBiZWhhdmlvciBpblxuICAgICAgICAvLyBjb21wYWl0aWJsaXR5IG1vZGUsIG90aGVyd2lzZSB3ZSBvcHRpbWl6ZSBtb3JlIGFnZ3Jlc3NpdmVseS5cbiAgICAgICAgbGV0IGV4dHJhY3RhYmxlID0gdmlldy5jb21wYXRpYmlsaXR5ID09PSBpci5Db21wYXRpYmlsaXR5TW9kZS5UZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyID9cbiAgICAgICAgICAgIChvcC5leHByZXNzaW9uIGluc3RhbmNlb2Ygby5MaXRlcmFsRXhwciAmJiB0eXBlb2Ygb3AuZXhwcmVzc2lvbi52YWx1ZSA9PT0gJ3N0cmluZycpIDpcbiAgICAgICAgICAgIG9wLmV4cHJlc3Npb24uaXNDb25zdGFudCgpO1xuXG4gICAgICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZ2VuZXJhdGUgaW5zdHJ1Y3Rpb25zIGZvciBhdHRyaWJ1dGVzIHRoYXQgY2FuIGJlIGV4dHJhY3RlZCBhcyBjb25zdHMuXG4gICAgICAgIGlmIChleHRyYWN0YWJsZSkge1xuICAgICAgICAgIG93bmVyT3AuYXR0cmlidXRlcy5hZGQoXG4gICAgICAgICAgICAgIG9wLmlzVGVtcGxhdGUgPyBpci5CaW5kaW5nS2luZC5UZW1wbGF0ZSA6IGlyLkJpbmRpbmdLaW5kLkF0dHJpYnV0ZSwgb3AubmFtZSxcbiAgICAgICAgICAgICAgb3AuZXhwcmVzc2lvbik7XG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZShvcCBhcyBpci5VcGRhdGVPcCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5Qcm9wZXJ0eTpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICBvd25lck9wLmF0dHJpYnV0ZXMuYWRkKFxuICAgICAgICAgICAgb3AuaXNUZW1wbGF0ZSA/IGlyLkJpbmRpbmdLaW5kLlRlbXBsYXRlIDogaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG9wLm5hbWUsIG51bGwpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlN0eWxlUHJvcDpcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkNsYXNzUHJvcDpcbiAgICAgICAgb3duZXJPcCA9IGxvb2t1cEVsZW1lbnQoZWxlbWVudHMsIG9wLnRhcmdldCk7XG4gICAgICAgIGlyLmFzc2VydElzRWxlbWVudEF0dHJpYnV0ZXMob3duZXJPcC5hdHRyaWJ1dGVzKTtcblxuICAgICAgICAvLyBFbXB0eSBTdHlsZVByb3BlcnR5IGFuZCBDbGFzc05hbWUgZXhwcmVzc2lvbnMgYXJlIHRyZWF0ZWQgZGlmZmVyZW50bHkgZGVwZW5kaW5nIG9uXG4gICAgICAgIC8vIGNvbXBhdGliaWxpdHkgbW9kZS5cbiAgICAgICAgaWYgKHZpZXcuY29tcGF0aWJpbGl0eSA9PT0gaXIuQ29tcGF0aWJpbGl0eU1vZGUuVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciAmJlxuICAgICAgICAgICAgb3AuZXhwcmVzc2lvbiBpbnN0YW5jZW9mIGlyLkVtcHR5RXhwcikge1xuICAgICAgICAgIC8vIFRoZSBvbGQgY29tcGlsZXIgdHJlYXRlZCBlbXB0eSBzdHlsZSBiaW5kaW5ncyBhcyByZWd1bGFyIGJpbmRpbmdzIGZvciB0aGUgcHVycG9zZSBvZlxuICAgICAgICAgIC8vIGRpcmVjdGl2ZSBtYXRjaGluZy4gVGhhdCBiZWhhdmlvciBpcyBpbmNvcnJlY3QsIGJ1dCB3ZSBlbXVsYXRlIGl0IGluIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAvLyBtb2RlLlxuICAgICAgICAgIG93bmVyT3AuYXR0cmlidXRlcy5hZGQoaXIuQmluZGluZ0tpbmQuUHJvcGVydHksIG9wLm5hbWUsIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuTGlzdGVuZXI6XG4gICAgICAgIG93bmVyT3AgPSBsb29rdXBFbGVtZW50KGVsZW1lbnRzLCBvcC50YXJnZXQpO1xuICAgICAgICBpci5hc3NlcnRJc0VsZW1lbnRBdHRyaWJ1dGVzKG93bmVyT3AuYXR0cmlidXRlcyk7XG5cbiAgICAgICAgb3duZXJPcC5hdHRyaWJ1dGVzLmFkZChpci5CaW5kaW5nS2luZC5Qcm9wZXJ0eSwgb3AubmFtZSwgbnVsbCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuIl19