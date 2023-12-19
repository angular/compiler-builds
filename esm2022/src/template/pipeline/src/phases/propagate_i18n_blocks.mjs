/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Propagate i18n blocks down through child templates that act as placeholders in the root i18n
 * message. Specifically, perform an in-order traversal of all the views, and add i18nStart/i18nEnd
 * op pairs into descending views. Also, assign an increasing sub-template index to each
 * descending view.
 */
export function propagateI18nBlocks(job) {
    propagateI18nBlocksToTemplates(job.root, 0);
}
/**
 * Propagates i18n ops in the given view through to any child views recursively.
 */
function propagateI18nBlocksToTemplates(unit, subTemplateIndex) {
    let i18nBlock = null;
    for (const op of unit.create) {
        switch (op.kind) {
            case ir.OpKind.I18nStart:
                op.subTemplateIndex = subTemplateIndex === 0 ? null : subTemplateIndex;
                i18nBlock = op;
                break;
            case ir.OpKind.I18nEnd:
                // When we exit a root-level i18n block, reset the sub-template index counter.
                if (i18nBlock.subTemplateIndex === null) {
                    subTemplateIndex = 0;
                }
                i18nBlock = null;
                break;
            case ir.OpKind.Template:
                subTemplateIndex = propagateI18nBlocksForView(unit.job.views.get(op.xref), i18nBlock, op.i18nPlaceholder, subTemplateIndex);
                break;
            case ir.OpKind.RepeaterCreate:
                // Propagate i18n blocks to the @for template.
                const forView = unit.job.views.get(op.xref);
                subTemplateIndex = propagateI18nBlocksForView(unit.job.views.get(op.xref), i18nBlock, op.i18nPlaceholder, subTemplateIndex);
                // Then if there's an @empty template, propagate the i18n blocks for it as well.
                if (op.emptyView !== null) {
                    subTemplateIndex = propagateI18nBlocksForView(unit.job.views.get(op.emptyView), i18nBlock, op.emptyI18nPlaceholder, subTemplateIndex);
                }
                break;
        }
    }
    return subTemplateIndex;
}
/**
 * Propagate i18n blocks for a view.
 */
function propagateI18nBlocksForView(view, i18nBlock, i18nPlaceholder, subTemplateIndex) {
    // We found an <ng-template> inside an i18n block; increment the sub-template counter and
    // wrap the template's view in a child i18n block.
    if (i18nPlaceholder !== undefined) {
        if (i18nBlock === null) {
            throw Error('Expected template with i18n placeholder to be in an i18n block.');
        }
        subTemplateIndex++;
        wrapTemplateWithI18n(view, i18nBlock);
    }
    // Continue traversing inside the template's view.
    return propagateI18nBlocksToTemplates(view, subTemplateIndex);
}
/**
 * Wraps a template view with i18n start and end ops.
 */
function wrapTemplateWithI18n(unit, parentI18n) {
    // Only add i18n ops if they have not already been propagated to this template.
    if (unit.create.head.next?.kind !== ir.OpKind.I18nStart) {
        const id = unit.job.allocateXrefId();
        ir.OpList.insertAfter(
        // Nested ng-template i18n start/end ops should not recieve source spans.
        ir.createI18nStartOp(id, parentI18n.message, parentI18n.root, null), unit.create.head);
        ir.OpList.insertBefore(ir.createI18nEndOp(id, null), unit.create.tail);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLG1CQUFtQixDQUFDLEdBQTRCO0lBQzlELDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyw4QkFBOEIsQ0FDbkMsSUFBeUIsRUFBRSxnQkFBd0I7SUFDckQsSUFBSSxTQUFTLEdBQXdCLElBQUksQ0FBQztJQUMxQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoQixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztnQkFDdEIsRUFBRSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDdkUsU0FBUyxHQUFHLEVBQUUsQ0FBQztnQkFDZixNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87Z0JBQ3BCLDhFQUE4RTtnQkFDOUUsSUFBSSxTQUFVLENBQUMsZ0JBQWdCLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQ3pDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztnQkFDdkIsQ0FBQztnQkFDRCxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLGdCQUFnQixHQUFHLDBCQUEwQixDQUN6QyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsZUFBZSxFQUFFLGdCQUFnQixDQUFDLENBQUM7Z0JBQ25GLE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYztnQkFDM0IsOENBQThDO2dCQUM5QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxDQUFDO2dCQUM3QyxnQkFBZ0IsR0FBRywwQkFBMEIsQ0FDekMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUNuRixnRkFBZ0Y7Z0JBQ2hGLElBQUksRUFBRSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDMUIsZ0JBQWdCLEdBQUcsMEJBQTBCLENBQ3pDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsRUFDckUsZ0JBQWdCLENBQUMsQ0FBQztnQkFDeEIsQ0FBQztnQkFDRCxNQUFNO1FBQ1YsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLGdCQUFnQixDQUFDO0FBQzFCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsMEJBQTBCLENBQy9CLElBQXlCLEVBQUUsU0FBOEIsRUFDekQsZUFBb0UsRUFDcEUsZ0JBQXdCO0lBQzFCLHlGQUF5RjtJQUN6RixrREFBa0Q7SUFDbEQsSUFBSSxlQUFlLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDbEMsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDdkIsTUFBTSxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQztRQUNqRixDQUFDO1FBQ0QsZ0JBQWdCLEVBQUUsQ0FBQztRQUNuQixvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVELGtEQUFrRDtJQUNsRCxPQUFPLDhCQUE4QixDQUFDLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQ2hFLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsb0JBQW9CLENBQUMsSUFBeUIsRUFBRSxVQUEwQjtJQUNqRiwrRUFBK0U7SUFDL0UsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDeEQsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNyQyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7UUFDakIseUVBQXlFO1FBQ3pFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0YsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6RSxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUHJvcGFnYXRlIGkxOG4gYmxvY2tzIGRvd24gdGhyb3VnaCBjaGlsZCB0ZW1wbGF0ZXMgdGhhdCBhY3QgYXMgcGxhY2Vob2xkZXJzIGluIHRoZSByb290IGkxOG5cbiAqIG1lc3NhZ2UuIFNwZWNpZmljYWxseSwgcGVyZm9ybSBhbiBpbi1vcmRlciB0cmF2ZXJzYWwgb2YgYWxsIHRoZSB2aWV3cywgYW5kIGFkZCBpMThuU3RhcnQvaTE4bkVuZFxuICogb3AgcGFpcnMgaW50byBkZXNjZW5kaW5nIHZpZXdzLiBBbHNvLCBhc3NpZ24gYW4gaW5jcmVhc2luZyBzdWItdGVtcGxhdGUgaW5kZXggdG8gZWFjaFxuICogZGVzY2VuZGluZyB2aWV3LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvcGFnYXRlSTE4bkJsb2Nrcyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIHByb3BhZ2F0ZUkxOG5CbG9ja3NUb1RlbXBsYXRlcyhqb2Iucm9vdCwgMCk7XG59XG5cbi8qKlxuICogUHJvcGFnYXRlcyBpMThuIG9wcyBpbiB0aGUgZ2l2ZW4gdmlldyB0aHJvdWdoIHRvIGFueSBjaGlsZCB2aWV3cyByZWN1cnNpdmVseS5cbiAqL1xuZnVuY3Rpb24gcHJvcGFnYXRlSTE4bkJsb2Nrc1RvVGVtcGxhdGVzKFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN1YlRlbXBsYXRlSW5kZXg6IG51bWJlcik6IG51bWJlciB7XG4gIGxldCBpMThuQmxvY2s6IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgIG9wLnN1YlRlbXBsYXRlSW5kZXggPSBzdWJUZW1wbGF0ZUluZGV4ID09PSAwID8gbnVsbCA6IHN1YlRlbXBsYXRlSW5kZXg7XG4gICAgICAgIGkxOG5CbG9jayA9IG9wO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgIC8vIFdoZW4gd2UgZXhpdCBhIHJvb3QtbGV2ZWwgaTE4biBibG9jaywgcmVzZXQgdGhlIHN1Yi10ZW1wbGF0ZSBpbmRleCBjb3VudGVyLlxuICAgICAgICBpZiAoaTE4bkJsb2NrIS5zdWJUZW1wbGF0ZUluZGV4ID09PSBudWxsKSB7XG4gICAgICAgICAgc3ViVGVtcGxhdGVJbmRleCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaTE4bkJsb2NrID0gbnVsbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgc3ViVGVtcGxhdGVJbmRleCA9IHByb3BhZ2F0ZUkxOG5CbG9ja3NGb3JWaWV3KFxuICAgICAgICAgICAgdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpISwgaTE4bkJsb2NrLCBvcC5pMThuUGxhY2Vob2xkZXIsIHN1YlRlbXBsYXRlSW5kZXgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICAvLyBQcm9wYWdhdGUgaTE4biBibG9ja3MgdG8gdGhlIEBmb3IgdGVtcGxhdGUuXG4gICAgICAgIGNvbnN0IGZvclZpZXcgPSB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBzdWJUZW1wbGF0ZUluZGV4ID0gcHJvcGFnYXRlSTE4bkJsb2Nrc0ZvclZpZXcoXG4gICAgICAgICAgICB1bml0LmpvYi52aWV3cy5nZXQob3AueHJlZikhLCBpMThuQmxvY2ssIG9wLmkxOG5QbGFjZWhvbGRlciwgc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgICAgIC8vIFRoZW4gaWYgdGhlcmUncyBhbiBAZW1wdHkgdGVtcGxhdGUsIHByb3BhZ2F0ZSB0aGUgaTE4biBibG9ja3MgZm9yIGl0IGFzIHdlbGwuXG4gICAgICAgIGlmIChvcC5lbXB0eVZpZXcgIT09IG51bGwpIHtcbiAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4ID0gcHJvcGFnYXRlSTE4bkJsb2Nrc0ZvclZpZXcoXG4gICAgICAgICAgICAgIHVuaXQuam9iLnZpZXdzLmdldChvcC5lbXB0eVZpZXcpISwgaTE4bkJsb2NrLCBvcC5lbXB0eUkxOG5QbGFjZWhvbGRlcixcbiAgICAgICAgICAgICAgc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKipcbiAqIFByb3BhZ2F0ZSBpMThuIGJsb2NrcyBmb3IgYSB2aWV3LlxuICovXG5mdW5jdGlvbiBwcm9wYWdhdGVJMThuQmxvY2tzRm9yVmlldyhcbiAgICB2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBpMThuQmxvY2s6IGlyLkkxOG5TdGFydE9wfG51bGwsXG4gICAgaTE4blBsYWNlaG9sZGVyOiBpMThuLlRhZ1BsYWNlaG9sZGVyfGkxOG4uQmxvY2tQbGFjZWhvbGRlcnx1bmRlZmluZWQsXG4gICAgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyKSB7XG4gIC8vIFdlIGZvdW5kIGFuIDxuZy10ZW1wbGF0ZT4gaW5zaWRlIGFuIGkxOG4gYmxvY2s7IGluY3JlbWVudCB0aGUgc3ViLXRlbXBsYXRlIGNvdW50ZXIgYW5kXG4gIC8vIHdyYXAgdGhlIHRlbXBsYXRlJ3MgdmlldyBpbiBhIGNoaWxkIGkxOG4gYmxvY2suXG4gIGlmIChpMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmIChpMThuQmxvY2sgPT09IG51bGwpIHtcbiAgICAgIHRocm93IEVycm9yKCdFeHBlY3RlZCB0ZW1wbGF0ZSB3aXRoIGkxOG4gcGxhY2Vob2xkZXIgdG8gYmUgaW4gYW4gaTE4biBibG9jay4nKTtcbiAgICB9XG4gICAgc3ViVGVtcGxhdGVJbmRleCsrO1xuICAgIHdyYXBUZW1wbGF0ZVdpdGhJMThuKHZpZXcsIGkxOG5CbG9jayk7XG4gIH1cblxuICAvLyBDb250aW51ZSB0cmF2ZXJzaW5nIGluc2lkZSB0aGUgdGVtcGxhdGUncyB2aWV3LlxuICByZXR1cm4gcHJvcGFnYXRlSTE4bkJsb2Nrc1RvVGVtcGxhdGVzKHZpZXcsIHN1YlRlbXBsYXRlSW5kZXgpO1xufVxuXG4vKipcbiAqIFdyYXBzIGEgdGVtcGxhdGUgdmlldyB3aXRoIGkxOG4gc3RhcnQgYW5kIGVuZCBvcHMuXG4gKi9cbmZ1bmN0aW9uIHdyYXBUZW1wbGF0ZVdpdGhJMThuKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHBhcmVudEkxOG46IGlyLkkxOG5TdGFydE9wKSB7XG4gIC8vIE9ubHkgYWRkIGkxOG4gb3BzIGlmIHRoZXkgaGF2ZSBub3QgYWxyZWFkeSBiZWVuIHByb3BhZ2F0ZWQgdG8gdGhpcyB0ZW1wbGF0ZS5cbiAgaWYgKHVuaXQuY3JlYXRlLmhlYWQubmV4dD8ua2luZCAhPT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXIoXG4gICAgICAgIC8vIE5lc3RlZCBuZy10ZW1wbGF0ZSBpMThuIHN0YXJ0L2VuZCBvcHMgc2hvdWxkIG5vdCByZWNpZXZlIHNvdXJjZSBzcGFucy5cbiAgICAgICAgaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHBhcmVudEkxOG4ubWVzc2FnZSwgcGFyZW50STE4bi5yb290LCBudWxsKSwgdW5pdC5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShpci5jcmVhdGVJMThuRW5kT3AoaWQsIG51bGwpLCB1bml0LmNyZWF0ZS50YWlsKTtcbiAgfVxufVxuIl19