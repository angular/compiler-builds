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
 * message.
 */
export function phasePropagateI18nBlocks(job) {
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
                propagateI18nBlocksToTemplates(templateView, subTemplateIndex);
        }
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7R0FHRztBQUNILE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxHQUE0QjtJQUNuRSw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsOEJBQThCLENBQUMsSUFBeUIsRUFBRSxnQkFBd0I7SUFDekYsSUFBSSxTQUFTLEdBQXdCLElBQUksQ0FBQztJQUMxQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7Z0JBQ3RCLEVBQUUsQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ3ZFLFNBQVMsR0FBRyxFQUFFLENBQUM7Z0JBQ2YsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO2dCQUNwQixTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUM7Z0JBRWxELHlGQUF5RjtnQkFDekYsa0RBQWtEO2dCQUNsRCxJQUFJLEVBQUUsQ0FBQyxlQUFlLEtBQUssU0FBUyxFQUFFO29CQUNwQyxJQUFJLFNBQVMsS0FBSyxJQUFJLEVBQUU7d0JBQ3RCLE1BQU0sS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7cUJBQ2hGO29CQUNELGdCQUFnQixFQUFFLENBQUM7b0JBQ25CLG9CQUFvQixDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztpQkFDL0M7Z0JBRUQsa0RBQWtEO2dCQUNsRCw4QkFBOEIsQ0FBQyxZQUFZLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztTQUNsRTtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxvQkFBb0IsQ0FBQyxJQUF5QixFQUFFLFVBQTBCO0lBQ2pGLCtFQUErRTtJQUMvRSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7UUFDdkQsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNyQyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FDakIsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxVQUFVLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JGLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNsRTtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUHJvcGFnYXRlIGkxOG4gYmxvY2tzIGRvd24gdGhyb3VnaCBjaGlsZCB0ZW1wbGF0ZXMgdGhhdCBhY3QgYXMgcGxhY2Vob2xkZXJzIGluIHRoZSByb290IGkxOG5cbiAqIG1lc3NhZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVByb3BhZ2F0ZUkxOG5CbG9ja3Moam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBwcm9wYWdhdGVJMThuQmxvY2tzVG9UZW1wbGF0ZXMoam9iLnJvb3QsIDApO1xufVxuXG4vKipcbiAqIFByb3BhZ2F0ZXMgaTE4biBvcHMgaW4gdGhlIGdpdmVuIHZpZXcgdGhyb3VnaCB0byBhbnkgY2hpbGQgdmlld3MgcmVjdXJzaXZlbHkuXG4gKi9cbmZ1bmN0aW9uIHByb3BhZ2F0ZUkxOG5CbG9ja3NUb1RlbXBsYXRlcyh1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIpIHtcbiAgbGV0IGkxOG5CbG9jazogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgb3Auc3ViVGVtcGxhdGVJbmRleCA9IHN1YlRlbXBsYXRlSW5kZXggPT09IDAgPyBudWxsIDogc3ViVGVtcGxhdGVJbmRleDtcbiAgICAgICAgaTE4bkJsb2NrID0gb3A7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgaTE4bkJsb2NrID0gbnVsbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgY29uc3QgdGVtcGxhdGVWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcblxuICAgICAgICAvLyBXZSBmb3VuZCBhbiA8bmctdGVtcGxhdGU+IGluc2lkZSBhbiBpMThuIGJsb2NrOyBpbmNyZW1lbnQgdGhlIHN1Yi10ZW1wbGF0ZSBjb3VudGVyIGFuZFxuICAgICAgICAvLyB3cmFwIHRoZSB0ZW1wbGF0ZSdzIHZpZXcgaW4gYSBjaGlsZCBpMThuIGJsb2NrLlxuICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAoaTE4bkJsb2NrID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignRXhwZWN0ZWQgdGVtcGxhdGUgd2l0aCBpMThuIHBsYWNlaG9sZGVyIHRvIGJlIGluIGFuIGkxOG4gYmxvY2suJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXgrKztcbiAgICAgICAgICB3cmFwVGVtcGxhdGVXaXRoSTE4bih0ZW1wbGF0ZVZpZXcsIGkxOG5CbG9jayk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb250aW51ZSB0cmF2ZXJzaW5nIGluc2lkZSB0aGUgdGVtcGxhdGUncyB2aWV3LlxuICAgICAgICBwcm9wYWdhdGVJMThuQmxvY2tzVG9UZW1wbGF0ZXModGVtcGxhdGVWaWV3LCBzdWJUZW1wbGF0ZUluZGV4KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBXcmFwcyBhIHRlbXBsYXRlIHZpZXcgd2l0aCBpMThuIHN0YXJ0IGFuZCBlbmQgb3BzLlxuICovXG5mdW5jdGlvbiB3cmFwVGVtcGxhdGVXaXRoSTE4bih1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBwYXJlbnRJMThuOiBpci5JMThuU3RhcnRPcCkge1xuICAvLyBPbmx5IGFkZCBpMThuIG9wcyBpZiB0aGV5IGhhdmUgbm90IGFscmVhZHkgYmVlbiBwcm9wYWdhdGVkIHRvIHRoaXMgdGVtcGxhdGUuXG4gIGlmICh1bml0LmNyZWF0ZS5oZWFkLm5leHQ/LmtpbmQgIT09IGlyLk9wS2luZC5JMThuU3RhcnQpIHtcbiAgICBjb25zdCBpZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyKFxuICAgICAgICBpci5jcmVhdGVJMThuU3RhcnRPcChpZCwgcGFyZW50STE4bi5tZXNzYWdlLCBwYXJlbnRJMThuLnJvb3QpLCB1bml0LmNyZWF0ZS5oZWFkKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlKGlyLmNyZWF0ZUkxOG5FbmRPcChpZCksIHVuaXQuY3JlYXRlLnRhaWwpO1xuICB9XG59XG4iXX0=