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
        ir.OpList.insertAfter(ir.createI18nStartOp(id, parentI18n.message, parentI18n.root), unit.create.head);
        ir.OpList.insertBefore(ir.createI18nEndOp(id), unit.create.tail);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLG1CQUFtQixDQUFDLEdBQTRCO0lBQzlELDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyw4QkFBOEIsQ0FDbkMsSUFBeUIsRUFBRSxnQkFBd0I7SUFDckQsSUFBSSxTQUFTLEdBQXdCLElBQUksQ0FBQztJQUMxQyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVM7Z0JBQ3RCLEVBQUUsQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ3ZFLFNBQVMsR0FBRyxFQUFFLENBQUM7Z0JBQ2YsTUFBTTtZQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPO2dCQUNwQiw4RUFBOEU7Z0JBQzlFLElBQUksU0FBVSxDQUFDLGdCQUFnQixLQUFLLElBQUksRUFBRTtvQkFDeEMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO2lCQUN0QjtnQkFDRCxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVE7Z0JBQ3JCLGdCQUFnQixHQUFHLDBCQUEwQixDQUN6QyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsZUFBZSxFQUFFLGdCQUFnQixDQUFDLENBQUM7Z0JBQ25GLE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYztnQkFDM0IsOENBQThDO2dCQUM5QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxDQUFDO2dCQUM3QyxnQkFBZ0IsR0FBRywwQkFBMEIsQ0FDekMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUNuRixnRkFBZ0Y7Z0JBQ2hGLElBQUksRUFBRSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUU7b0JBQ3pCLGdCQUFnQixHQUFHLDBCQUEwQixDQUN6QyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsb0JBQW9CLEVBQ3JFLGdCQUFnQixDQUFDLENBQUM7aUJBQ3ZCO2dCQUNELE1BQU07U0FDVDtLQUNGO0lBQ0QsT0FBTyxnQkFBZ0IsQ0FBQztBQUMxQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLDBCQUEwQixDQUMvQixJQUF5QixFQUFFLFNBQThCLEVBQ3pELGVBQW9FLEVBQ3BFLGdCQUF3QjtJQUMxQix5RkFBeUY7SUFDekYsa0RBQWtEO0lBQ2xELElBQUksZUFBZSxLQUFLLFNBQVMsRUFBRTtRQUNqQyxJQUFJLFNBQVMsS0FBSyxJQUFJLEVBQUU7WUFDdEIsTUFBTSxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQztTQUNoRjtRQUNELGdCQUFnQixFQUFFLENBQUM7UUFDbkIsb0JBQW9CLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQ3ZDO0lBRUQsa0RBQWtEO0lBQ2xELE9BQU8sOEJBQThCLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7QUFDaEUsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxvQkFBb0IsQ0FBQyxJQUF5QixFQUFFLFVBQTBCO0lBQ2pGLCtFQUErRTtJQUMvRSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7UUFDdkQsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNyQyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FDakIsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxVQUFVLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JGLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNsRTtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYiwgVmlld0NvbXBpbGF0aW9uVW5pdH0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFByb3BhZ2F0ZSBpMThuIGJsb2NrcyBkb3duIHRocm91Z2ggY2hpbGQgdGVtcGxhdGVzIHRoYXQgYWN0IGFzIHBsYWNlaG9sZGVycyBpbiB0aGUgcm9vdCBpMThuXG4gKiBtZXNzYWdlLiBTcGVjaWZpY2FsbHksIHBlcmZvcm0gYW4gaW4tb3JkZXIgdHJhdmVyc2FsIG9mIGFsbCB0aGUgdmlld3MsIGFuZCBhZGQgaTE4blN0YXJ0L2kxOG5FbmRcbiAqIG9wIHBhaXJzIGludG8gZGVzY2VuZGluZyB2aWV3cy4gQWxzbywgYXNzaWduIGFuIGluY3JlYXNpbmcgc3ViLXRlbXBsYXRlIGluZGV4IHRvIGVhY2hcbiAqIGRlc2NlbmRpbmcgdmlldy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByb3BhZ2F0ZUkxOG5CbG9ja3Moam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBwcm9wYWdhdGVJMThuQmxvY2tzVG9UZW1wbGF0ZXMoam9iLnJvb3QsIDApO1xufVxuXG4vKipcbiAqIFByb3BhZ2F0ZXMgaTE4biBvcHMgaW4gdGhlIGdpdmVuIHZpZXcgdGhyb3VnaCB0byBhbnkgY2hpbGQgdmlld3MgcmVjdXJzaXZlbHkuXG4gKi9cbmZ1bmN0aW9uIHByb3BhZ2F0ZUkxOG5CbG9ja3NUb1RlbXBsYXRlcyhcbiAgICB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuICBsZXQgaTE4bkJsb2NrOiBpci5JMThuU3RhcnRPcHxudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICBvcC5zdWJUZW1wbGF0ZUluZGV4ID0gc3ViVGVtcGxhdGVJbmRleCA9PT0gMCA/IG51bGwgOiBzdWJUZW1wbGF0ZUluZGV4O1xuICAgICAgICBpMThuQmxvY2sgPSBvcDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAvLyBXaGVuIHdlIGV4aXQgYSByb290LWxldmVsIGkxOG4gYmxvY2ssIHJlc2V0IHRoZSBzdWItdGVtcGxhdGUgaW5kZXggY291bnRlci5cbiAgICAgICAgaWYgKGkxOG5CbG9jayEuc3ViVGVtcGxhdGVJbmRleCA9PT0gbnVsbCkge1xuICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXggPSAwO1xuICAgICAgICB9XG4gICAgICAgIGkxOG5CbG9jayA9IG51bGw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgIHN1YlRlbXBsYXRlSW5kZXggPSBwcm9wYWdhdGVJMThuQmxvY2tzRm9yVmlldyhcbiAgICAgICAgICAgIHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSEsIGkxOG5CbG9jaywgb3AuaTE4blBsYWNlaG9sZGVyLCBzdWJUZW1wbGF0ZUluZGV4KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZTpcbiAgICAgICAgLy8gUHJvcGFnYXRlIGkxOG4gYmxvY2tzIHRvIHRoZSBAZm9yIHRlbXBsYXRlLlxuICAgICAgICBjb25zdCBmb3JWaWV3ID0gdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgc3ViVGVtcGxhdGVJbmRleCA9IHByb3BhZ2F0ZUkxOG5CbG9ja3NGb3JWaWV3KFxuICAgICAgICAgICAgdW5pdC5qb2Iudmlld3MuZ2V0KG9wLnhyZWYpISwgaTE4bkJsb2NrLCBvcC5pMThuUGxhY2Vob2xkZXIsIHN1YlRlbXBsYXRlSW5kZXgpO1xuICAgICAgICAvLyBUaGVuIGlmIHRoZXJlJ3MgYW4gQGVtcHR5IHRlbXBsYXRlLCBwcm9wYWdhdGUgdGhlIGkxOG4gYmxvY2tzIGZvciBpdCBhcyB3ZWxsLlxuICAgICAgICBpZiAob3AuZW1wdHlWaWV3ICE9PSBudWxsKSB7XG4gICAgICAgICAgc3ViVGVtcGxhdGVJbmRleCA9IHByb3BhZ2F0ZUkxOG5CbG9ja3NGb3JWaWV3KFxuICAgICAgICAgICAgICB1bml0LmpvYi52aWV3cy5nZXQob3AuZW1wdHlWaWV3KSEsIGkxOG5CbG9jaywgb3AuZW1wdHlJMThuUGxhY2Vob2xkZXIsXG4gICAgICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXgpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3ViVGVtcGxhdGVJbmRleDtcbn1cblxuLyoqXG4gKiBQcm9wYWdhdGUgaTE4biBibG9ja3MgZm9yIGEgdmlldy5cbiAqL1xuZnVuY3Rpb24gcHJvcGFnYXRlSTE4bkJsb2Nrc0ZvclZpZXcoXG4gICAgdmlldzogVmlld0NvbXBpbGF0aW9uVW5pdCwgaTE4bkJsb2NrOiBpci5JMThuU3RhcnRPcHxudWxsLFxuICAgIGkxOG5QbGFjZWhvbGRlcjogaTE4bi5UYWdQbGFjZWhvbGRlcnxpMThuLkJsb2NrUGxhY2Vob2xkZXJ8dW5kZWZpbmVkLFxuICAgIHN1YlRlbXBsYXRlSW5kZXg6IG51bWJlcikge1xuICAvLyBXZSBmb3VuZCBhbiA8bmctdGVtcGxhdGU+IGluc2lkZSBhbiBpMThuIGJsb2NrOyBpbmNyZW1lbnQgdGhlIHN1Yi10ZW1wbGF0ZSBjb3VudGVyIGFuZFxuICAvLyB3cmFwIHRoZSB0ZW1wbGF0ZSdzIHZpZXcgaW4gYSBjaGlsZCBpMThuIGJsb2NrLlxuICBpZiAoaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoaTE4bkJsb2NrID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBFcnJvcignRXhwZWN0ZWQgdGVtcGxhdGUgd2l0aCBpMThuIHBsYWNlaG9sZGVyIHRvIGJlIGluIGFuIGkxOG4gYmxvY2suJyk7XG4gICAgfVxuICAgIHN1YlRlbXBsYXRlSW5kZXgrKztcbiAgICB3cmFwVGVtcGxhdGVXaXRoSTE4bih2aWV3LCBpMThuQmxvY2spO1xuICB9XG5cbiAgLy8gQ29udGludWUgdHJhdmVyc2luZyBpbnNpZGUgdGhlIHRlbXBsYXRlJ3Mgdmlldy5cbiAgcmV0dXJuIHByb3BhZ2F0ZUkxOG5CbG9ja3NUb1RlbXBsYXRlcyh2aWV3LCBzdWJUZW1wbGF0ZUluZGV4KTtcbn1cblxuLyoqXG4gKiBXcmFwcyBhIHRlbXBsYXRlIHZpZXcgd2l0aCBpMThuIHN0YXJ0IGFuZCBlbmQgb3BzLlxuICovXG5mdW5jdGlvbiB3cmFwVGVtcGxhdGVXaXRoSTE4bih1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBwYXJlbnRJMThuOiBpci5JMThuU3RhcnRPcCkge1xuICAvLyBPbmx5IGFkZCBpMThuIG9wcyBpZiB0aGV5IGhhdmUgbm90IGFscmVhZHkgYmVlbiBwcm9wYWdhdGVkIHRvIHRoaXMgdGVtcGxhdGUuXG4gIGlmICh1bml0LmNyZWF0ZS5oZWFkLm5leHQ/LmtpbmQgIT09IGlyLk9wS2luZC5JMThuU3RhcnQpIHtcbiAgICBjb25zdCBpZCA9IHVuaXQuam9iLmFsbG9jYXRlWHJlZklkKCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEFmdGVyKFxuICAgICAgICBpci5jcmVhdGVJMThuU3RhcnRPcChpZCwgcGFyZW50STE4bi5tZXNzYWdlLCBwYXJlbnRJMThuLnJvb3QpLCB1bml0LmNyZWF0ZS5oZWFkKTtcbiAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlKGlyLmNyZWF0ZUkxOG5FbmRPcChpZCksIHVuaXQuY3JlYXRlLnRhaWwpO1xuICB9XG59XG4iXX0=