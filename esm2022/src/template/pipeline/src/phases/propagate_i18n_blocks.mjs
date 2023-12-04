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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLG1CQUFtQixDQUFDLEdBQTRCO0lBQzlELDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyw4QkFBOEIsQ0FDbkMsSUFBeUIsRUFBRSxnQkFBd0I7SUFDckQsSUFBSSxTQUFTLEdBQXdCLElBQUksQ0FBQztJQUMxQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoQixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztnQkFDdEIsRUFBRSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDdkUsU0FBUyxHQUFHLEVBQUUsQ0FBQztnQkFDZixNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87Z0JBQ3BCLDhFQUE4RTtnQkFDOUUsSUFBSSxTQUFVLENBQUMsZ0JBQWdCLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQ3pDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztnQkFDdkIsQ0FBQztnQkFDRCxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUM7Z0JBRWxELHlGQUF5RjtnQkFDekYsa0RBQWtEO2dCQUNsRCxJQUFJLEVBQUUsQ0FBQyxlQUFlLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3JDLElBQUksU0FBUyxLQUFLLElBQUksRUFBRSxDQUFDO3dCQUN2QixNQUFNLEtBQUssQ0FBQyxpRUFBaUUsQ0FBQyxDQUFDO29CQUNqRixDQUFDO29CQUNELGdCQUFnQixFQUFFLENBQUM7b0JBQ25CLG9CQUFvQixDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDaEQsQ0FBQztnQkFFRCxrREFBa0Q7Z0JBQ2xELGdCQUFnQixHQUFHLDhCQUE4QixDQUFDLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3RGLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxnQkFBZ0IsQ0FBQztBQUMxQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLG9CQUFvQixDQUFDLElBQXlCLEVBQUUsVUFBMEI7SUFDakYsK0VBQStFO0lBQy9FLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ3hELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDckMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQ2pCLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyRixFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkUsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUHJvcGFnYXRlIGkxOG4gYmxvY2tzIGRvd24gdGhyb3VnaCBjaGlsZCB0ZW1wbGF0ZXMgdGhhdCBhY3QgYXMgcGxhY2Vob2xkZXJzIGluIHRoZSByb290IGkxOG5cbiAqIG1lc3NhZ2UuIFNwZWNpZmljYWxseSwgcGVyZm9ybSBhbiBpbi1vcmRlciB0cmF2ZXJzYWwgb2YgYWxsIHRoZSB2aWV3cywgYW5kIGFkZCBpMThuU3RhcnQvaTE4bkVuZFxuICogb3AgcGFpcnMgaW50byBkZXNjZW5kaW5nIHZpZXdzLiBBbHNvLCBhc3NpZ24gYW4gaW5jcmVhc2luZyBzdWItdGVtcGxhdGUgaW5kZXggdG8gZWFjaFxuICogZGVzY2VuZGluZyB2aWV3LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvcGFnYXRlSTE4bkJsb2Nrcyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIHByb3BhZ2F0ZUkxOG5CbG9ja3NUb1RlbXBsYXRlcyhqb2Iucm9vdCwgMCk7XG59XG5cbi8qKlxuICogUHJvcGFnYXRlcyBpMThuIG9wcyBpbiB0aGUgZ2l2ZW4gdmlldyB0aHJvdWdoIHRvIGFueSBjaGlsZCB2aWV3cyByZWN1cnNpdmVseS5cbiAqL1xuZnVuY3Rpb24gcHJvcGFnYXRlSTE4bkJsb2Nrc1RvVGVtcGxhdGVzKFxuICAgIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHN1YlRlbXBsYXRlSW5kZXg6IG51bWJlcik6IG51bWJlciB7XG4gIGxldCBpMThuQmxvY2s6IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgIG9wLnN1YlRlbXBsYXRlSW5kZXggPSBzdWJUZW1wbGF0ZUluZGV4ID09PSAwID8gbnVsbCA6IHN1YlRlbXBsYXRlSW5kZXg7XG4gICAgICAgIGkxOG5CbG9jayA9IG9wO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgIC8vIFdoZW4gd2UgZXhpdCBhIHJvb3QtbGV2ZWwgaTE4biBibG9jaywgcmVzZXQgdGhlIHN1Yi10ZW1wbGF0ZSBpbmRleCBjb3VudGVyLlxuICAgICAgICBpZiAoaTE4bkJsb2NrIS5zdWJUZW1wbGF0ZUluZGV4ID09PSBudWxsKSB7XG4gICAgICAgICAgc3ViVGVtcGxhdGVJbmRleCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaTE4bkJsb2NrID0gbnVsbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgY29uc3QgdGVtcGxhdGVWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcblxuICAgICAgICAvLyBXZSBmb3VuZCBhbiA8bmctdGVtcGxhdGU+IGluc2lkZSBhbiBpMThuIGJsb2NrOyBpbmNyZW1lbnQgdGhlIHN1Yi10ZW1wbGF0ZSBjb3VudGVyIGFuZFxuICAgICAgICAvLyB3cmFwIHRoZSB0ZW1wbGF0ZSdzIHZpZXcgaW4gYSBjaGlsZCBpMThuIGJsb2NrLlxuICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAoaTE4bkJsb2NrID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignRXhwZWN0ZWQgdGVtcGxhdGUgd2l0aCBpMThuIHBsYWNlaG9sZGVyIHRvIGJlIGluIGFuIGkxOG4gYmxvY2suJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXgrKztcbiAgICAgICAgICB3cmFwVGVtcGxhdGVXaXRoSTE4bih0ZW1wbGF0ZVZpZXcsIGkxOG5CbG9jayk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb250aW51ZSB0cmF2ZXJzaW5nIGluc2lkZSB0aGUgdGVtcGxhdGUncyB2aWV3LlxuICAgICAgICBzdWJUZW1wbGF0ZUluZGV4ID0gcHJvcGFnYXRlSTE4bkJsb2Nrc1RvVGVtcGxhdGVzKHRlbXBsYXRlVmlldywgc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKipcbiAqIFdyYXBzIGEgdGVtcGxhdGUgdmlldyB3aXRoIGkxOG4gc3RhcnQgYW5kIGVuZCBvcHMuXG4gKi9cbmZ1bmN0aW9uIHdyYXBUZW1wbGF0ZVdpdGhJMThuKHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsIHBhcmVudEkxOG46IGlyLkkxOG5TdGFydE9wKSB7XG4gIC8vIE9ubHkgYWRkIGkxOG4gb3BzIGlmIHRoZXkgaGF2ZSBub3QgYWxyZWFkeSBiZWVuIHByb3BhZ2F0ZWQgdG8gdGhpcyB0ZW1wbGF0ZS5cbiAgaWYgKHVuaXQuY3JlYXRlLmhlYWQubmV4dD8ua2luZCAhPT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgIGNvbnN0IGlkID0gdW5pdC5qb2IuYWxsb2NhdGVYcmVmSWQoKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QWZ0ZXIoXG4gICAgICAgIGlyLmNyZWF0ZUkxOG5TdGFydE9wKGlkLCBwYXJlbnRJMThuLm1lc3NhZ2UsIHBhcmVudEkxOG4ucm9vdCksIHVuaXQuY3JlYXRlLmhlYWQpO1xuICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmUoaXIuY3JlYXRlSTE4bkVuZE9wKGlkKSwgdW5pdC5jcmVhdGUudGFpbCk7XG4gIH1cbn1cbiJdfQ==