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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGFnYXRlX2kxOG5fYmxvY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcHJvcGFnYXRlX2kxOG5fYmxvY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLG1CQUFtQixDQUFDLEdBQTRCO0lBQzlELDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyw4QkFBOEIsQ0FBQyxJQUF5QixFQUFFLGdCQUF3QjtJQUN6RixJQUFJLFNBQVMsR0FBd0IsSUFBSSxDQUFDO0lBQzFDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUztnQkFDdEIsRUFBRSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDdkUsU0FBUyxHQUFHLEVBQUUsQ0FBQztnQkFDZixNQUFNO1lBQ1IsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87Z0JBQ3BCLFNBQVMsR0FBRyxJQUFJLENBQUM7Z0JBQ2pCLE1BQU07WUFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUTtnQkFDckIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsQ0FBQztnQkFFbEQseUZBQXlGO2dCQUN6RixrREFBa0Q7Z0JBQ2xELElBQUksRUFBRSxDQUFDLGVBQWUsS0FBSyxTQUFTLEVBQUU7b0JBQ3BDLElBQUksU0FBUyxLQUFLLElBQUksRUFBRTt3QkFDdEIsTUFBTSxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQztxQkFDaEY7b0JBQ0QsZ0JBQWdCLEVBQUUsQ0FBQztvQkFDbkIsb0JBQW9CLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO2lCQUMvQztnQkFFRCxrREFBa0Q7Z0JBQ2xELDhCQUE4QixDQUFDLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1NBQ2xFO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLG9CQUFvQixDQUFDLElBQXlCLEVBQUUsVUFBMEI7SUFDakYsK0VBQStFO0lBQy9FLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRTtRQUN2RCxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3JDLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUNqQixFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLFVBQVUsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckYsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ2xFO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBQcm9wYWdhdGUgaTE4biBibG9ja3MgZG93biB0aHJvdWdoIGNoaWxkIHRlbXBsYXRlcyB0aGF0IGFjdCBhcyBwbGFjZWhvbGRlcnMgaW4gdGhlIHJvb3QgaTE4blxuICogbWVzc2FnZS4gU3BlY2lmaWNhbGx5LCBwZXJmb3JtIGFuIGluLW9yZGVyIHRyYXZlcnNhbCBvZiBhbGwgdGhlIHZpZXdzLCBhbmQgYWRkIGkxOG5TdGFydC9pMThuRW5kXG4gKiBvcCBwYWlycyBpbnRvIGRlc2NlbmRpbmcgdmlld3MuIEFsc28sIGFzc2lnbiBhbiBpbmNyZWFzaW5nIHN1Yi10ZW1wbGF0ZSBpbmRleCB0byBlYWNoXG4gKiBkZXNjZW5kaW5nIHZpZXcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm9wYWdhdGVJMThuQmxvY2tzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgcHJvcGFnYXRlSTE4bkJsb2Nrc1RvVGVtcGxhdGVzKGpvYi5yb290LCAwKTtcbn1cblxuLyoqXG4gKiBQcm9wYWdhdGVzIGkxOG4gb3BzIGluIHRoZSBnaXZlbiB2aWV3IHRocm91Z2ggdG8gYW55IGNoaWxkIHZpZXdzIHJlY3Vyc2l2ZWx5LlxuICovXG5mdW5jdGlvbiBwcm9wYWdhdGVJMThuQmxvY2tzVG9UZW1wbGF0ZXModW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyKSB7XG4gIGxldCBpMThuQmxvY2s6IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgIG9wLnN1YlRlbXBsYXRlSW5kZXggPSBzdWJUZW1wbGF0ZUluZGV4ID09PSAwID8gbnVsbCA6IHN1YlRlbXBsYXRlSW5kZXg7XG4gICAgICAgIGkxOG5CbG9jayA9IG9wO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgIGkxOG5CbG9jayA9IG51bGw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlVmlldyA9IHVuaXQuam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG5cbiAgICAgICAgLy8gV2UgZm91bmQgYW4gPG5nLXRlbXBsYXRlPiBpbnNpZGUgYW4gaTE4biBibG9jazsgaW5jcmVtZW50IHRoZSBzdWItdGVtcGxhdGUgY291bnRlciBhbmRcbiAgICAgICAgLy8gd3JhcCB0aGUgdGVtcGxhdGUncyB2aWV3IGluIGEgY2hpbGQgaTE4biBibG9jay5cbiAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaWYgKGkxOG5CbG9jayA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0V4cGVjdGVkIHRlbXBsYXRlIHdpdGggaTE4biBwbGFjZWhvbGRlciB0byBiZSBpbiBhbiBpMThuIGJsb2NrLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4Kys7XG4gICAgICAgICAgd3JhcFRlbXBsYXRlV2l0aEkxOG4odGVtcGxhdGVWaWV3LCBpMThuQmxvY2spO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29udGludWUgdHJhdmVyc2luZyBpbnNpZGUgdGhlIHRlbXBsYXRlJ3Mgdmlldy5cbiAgICAgICAgcHJvcGFnYXRlSTE4bkJsb2Nrc1RvVGVtcGxhdGVzKHRlbXBsYXRlVmlldywgc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogV3JhcHMgYSB0ZW1wbGF0ZSB2aWV3IHdpdGggaTE4biBzdGFydCBhbmQgZW5kIG9wcy5cbiAqL1xuZnVuY3Rpb24gd3JhcFRlbXBsYXRlV2l0aEkxOG4odW5pdDogVmlld0NvbXBpbGF0aW9uVW5pdCwgcGFyZW50STE4bjogaXIuSTE4blN0YXJ0T3ApIHtcbiAgLy8gT25seSBhZGQgaTE4biBvcHMgaWYgdGhleSBoYXZlIG5vdCBhbHJlYWR5IGJlZW4gcHJvcGFnYXRlZCB0byB0aGlzIHRlbXBsYXRlLlxuICBpZiAodW5pdC5jcmVhdGUuaGVhZC5uZXh0Py5raW5kICE9PSBpci5PcEtpbmQuSTE4blN0YXJ0KSB7XG4gICAgY29uc3QgaWQgPSB1bml0LmpvYi5hbGxvY2F0ZVhyZWZJZCgpO1xuICAgIGlyLk9wTGlzdC5pbnNlcnRBZnRlcihcbiAgICAgICAgaXIuY3JlYXRlSTE4blN0YXJ0T3AoaWQsIHBhcmVudEkxOG4ubWVzc2FnZSwgcGFyZW50STE4bi5yb290KSwgdW5pdC5jcmVhdGUuaGVhZCk7XG4gICAgaXIuT3BMaXN0Lmluc2VydEJlZm9yZShpci5jcmVhdGVJMThuRW5kT3AoaWQpLCB1bml0LmNyZWF0ZS50YWlsKTtcbiAgfVxufVxuIl19