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
                i18nBlock = null;
                break;
            case ir.OpKind.Template:
                const templateView = unit.job.views.get(op.xref);
                // We found an <ng-template> inside an i18n block; increment the sub-template counter and
                // wrap the template's view in a child i18n block.
                if (op.i18nPlaceholder !== undefined) {
                    if (i18nBlock === null) {
                        throw Error('Expected template with i18n placeholder to be in an i18n block.');
                    }
                    subTemplateIndex++;
                    wrapTemplateWithI18n(templateView, i18nBlock);
                }
                // Continue traversing inside the template's view.
                subTemplateIndex = propagateI18nBlocksToTemplates(templateView, subTemplateIndex);
        }
    }
    return subTemplateIndex;
}
/**
 * Wraps a template view with i18n start and end ops.
 */
function wrapTemplateWithI18n(unit, parentI18n) {
    // Only add i18n ops if they have not already been propagated to this template.
    if (unit.create.head.next?.kind !== ir.OpKind.I18nStart) {
        const id = unit.job.allocateXrefId();
        ir.OpList.insertAfter(ir.createI18nStartOp(id, parentI18n.message, parentI18n.root), unit.create.head);
        ir.OpList.insertBefore(ir.createI18nEndOp(id), unit.create.tail);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLG1CQUFtQixDQUFDLEdBQTRCO0lBQzlELDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyw4QkFBOEIsQ0FDbkMsSUFBeUIsRUFBRSxnQkFBd0I7SUFDckQsSUFBSSxTQUFTLEdBQXdCLElBQUksQ0FBQztJQUMxQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7Z0JBQ3RCLEVBQUUsQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ3ZFLFNBQVMsR0FBRyxFQUFFLENBQUM7Z0JBQ2YsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO2dCQUNwQixTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUM7Z0JBRWxELHlGQUF5RjtnQkFDekYsa0RBQWtEO2dCQUNsRCxJQUFJLEVBQUUsQ0FBQyxlQUFlLEtBQUssU0FBUyxFQUFFO29CQUNwQyxJQUFJLFNBQVMsS0FBSyxJQUFJLEVBQUU7d0JBQ3RCLE1BQU0sS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7cUJBQ2hGO29CQUNELGdCQUFnQixFQUFFLENBQUM7b0JBQ25CLG9CQUFvQixDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztpQkFDL0M7Z0JBRUQsa0RBQWtEO2dCQUNsRCxnQkFBZ0IsR0FBRyw4QkFBOEIsQ0FBQyxZQUFZLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztTQUNyRjtLQUNGO0lBQ0QsT0FBTyxnQkFBZ0IsQ0FBQztBQUMxQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLG9CQUFvQixDQUFDLElBQXlCLEVBQUUsVUFBMEI7SUFDakYsK0VBQStFO0lBQy9FLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRTtRQUN2RCxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3JDLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUNqQixFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLFVBQVUsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckYsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ2xFO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBQcm9wYWdhdGUgaTE4biBibG9ja3MgZG93biB0aHJvdWdoIGNoaWxkIHRlbXBsYXRlcyB0aGF0IGFjdCBhcyBwbGFjZWhvbGRlcnMgaW4gdGhlIHJvb3QgaTE4blxuICogbWVzc2FnZS4gU3BlY2lmaWNhbGx5LCBwZXJmb3JtIGFuIGluLW9yZGVyIHRyYXZlcnNhbCBvZiBhbGwgdGhlIHZpZXdzLCBhbmQgYWRkIGkxOG5TdGFydC9pMThuRW5kXG4gKiBvcCBwYWlycyBpbnRvIGRlc2NlbmRpbmcgdmlld3MuIEFsc28sIGFzc2lnbiBhbiBpbmNyZWFzaW5nIHN1Yi10ZW1wbGF0ZSBpbmRleCB0byBlYWNoXG4gKiBkZXNjZW5kaW5nIHZpZXcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm9wYWdhdGVJMThuQmxvY2tzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgcHJvcGFnYXRlSTE4bkJsb2Nrc1RvVGVtcGxhdGVzKGpvYi5yb290LCAwKTtcbn1cblxuLyoqXG4gKiBQcm9wYWdhdGVzIGkxOG4gb3BzIGluIHRoZSBnaXZlbiB2aWV3IHRocm91Z2ggdG8gYW55IGNoaWxkIHZpZXdzIHJlY3Vyc2l2ZWx5LlxuICovXG5mdW5jdGlvbiBwcm9wYWdhdGVJMThuQmxvY2tzVG9UZW1wbGF0ZXMoXG4gICAgdW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcbiAgbGV0IGkxOG5CbG9jazogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgb3Auc3ViVGVtcGxhdGVJbmRleCA9IHN1YlRlbXBsYXRlSW5kZXggPT09IDAgPyBudWxsIDogc3ViVGVtcGxhdGVJbmRleDtcbiAgICAgICAgaTE4bkJsb2NrID0gb3A7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgaTE4bkJsb2NrID0gbnVsbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgY29uc3QgdGVtcGxhdGVWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcblxuICAgICAgICAvLyBXZSBmb3VuZCBhbiA8bmctdGVtcGxhdGU+IGluc2lkZSBhbiBpMThuIGJsb2NrOyBpbmNyZW1lbnQgdGhlIHN1Yi10ZW1wbGF0ZSBjb3VudGVyIGFuZFxuICAgICAgICAvLyB3cmFwIHRoZSB0ZW1wbGF0ZSdzIHZpZXcgaW4gYSBjaGlsZCBpMThuIGJsb2NrLlxuICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAoaTE4bkJsb2NrID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignRXhwZWN0ZWQgdGVtcGxhdGUgd2l0aCBpMThuIHBsYWNlaG9sZGVyIHRvIGJlIGluIGFuIGkxOG4gYmxvY2suJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXgrKztcbiAgICAgICAgICB3cmFwVGVtcGxhdGVXaXRoSTE4bih0ZW1wbGF0ZVZpZXcsIGkxOG5CbG9jayk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb250aW51ZSB0cmF2ZXJzaW5nIGluc2lkZSB0aGUgdGVtcGxhdGUncyB2aWV3LlxuICAgICAgICBzdWJUZW1wbGF0ZUluZGV4ID0gcHJvcGFnYXRlSTE4bkJsb2Nrc1RvVGVtcGxhdGVzKHRlbXBsYXRlVmlldywgc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKipcbiAqIFdyYXBzIGEgdGVtcGxhdGUgdmlldyB3aXRoIGkxOG4gc3RhcnQgYW5kIGVuZCBvcHMuXG4gKi9cbmZ1bmN0aW9uIHdyYXBUZW1wbGF0ZVdpdGhJMThuKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHBhcmVudEkxOG46IGlyLkkxOG5TdGFydE9wKSB7XG4gIC8vIE9ubHkgYWRkIGkxOG4gb3BzIGlmIHRoZXkgaGF2ZSBub3QgYWxyZWFkeSBiZWVuIHByb3BhZ2F0ZWQgdG8gdGhpcyB0ZW1wbGF0ZS5cbiAgaWYgKHVuaXQuY3JlYXRlLmhlYWQubmV4dD8ua2luZCAhPT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXIoXG4gICAgICAgIGlyLmNyZWF0ZUkxOG5TdGFydE9wKGlkLCBwYXJlbnRJMThuLm1lc3NhZ2UsIHBhcmVudEkxOG4ucm9vdCksIHVuaXQuY3JlYXRlLmhlYWQpO1xuICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmUoaXIuY3JlYXRlSTE4bkVuZE9wKGlkKSwgdW5pdC5jcmVhdGUudGFpbCk7XG4gIH1cbn1cbiJdfQ==