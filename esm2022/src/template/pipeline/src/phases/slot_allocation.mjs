/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Assign data slots for all operations which implement `ConsumesSlotOpTrait`, and propagate the
 * assigned data slots of those operations to any expressions which reference them via
 * `UsesSlotIndexTrait`.
 *
 * This phase is also responsible for counting the number of slots used for each view (its `decls`)
 * and propagating that number into the `Template` operations which declare embedded views.
 */
export function phaseSlotAllocation(job) {
    // Map of all declarations in all views within the component which require an assigned slot index.
    // This map needs to be global (across all views within the component) since it's possible to
    // reference a slot from one view from an expression within another (e.g. local references work
    // this way).
    const slotMap = new Map();
    // Process all views in the component and assign slot indexes.
    for (const unit of job.units) {
        // Slot indices start at 0 for each view (and are not unique between views).
        let slotCount = 0;
        for (const op of unit.create) {
            // Only consider declarations which consume data slots.
            if (!ir.hasConsumesSlotTrait(op)) {
                continue;
            }
            // Assign slots to this declaration starting at the current `slotCount`.
            op.slot = slotCount;
            // And track its assigned slot in the `slotMap`.
            slotMap.set(op.xref, op.slot);
            // Each declaration may use more than 1 slot, so increment `slotCount` to reserve the number
            // of slots required.
            slotCount += op.numSlotsUsed;
        }
        // Record the total number of slots used on the view itself. This will later be propagated into
        // `ir.TemplateOp`s which declare those views (except for the root view).
        unit.decls = slotCount;
    }
    // After slot assignment, `slotMap` now contains slot assignments for every declaration in the
    // whole template, across all views. Next, look for expressions which implement
    // `UsesSlotIndexExprTrait` and propagate the assigned slot indexes into them.
    // Additionally, this second scan allows us to find `ir.TemplateOp`s which declare views and
    // propagate the number of slots used for each view into the operation which declares it.
    for (const unit of job.units) {
        for (const op of unit.ops()) {
            if (op.kind === ir.OpKind.Template) {
                // Record the number of slots used by the view this `ir.TemplateOp` declares in the
                // operation itself, so it can be emitted later.
                const childView = job.views.get(op.xref);
                op.decls = childView.decls;
            }
            if (ir.hasUsesSlotIndexTrait(op) && op.slot === null) {
                if (!slotMap.has(op.target)) {
                    // We do expect to find a slot allocated for everything which might be referenced.
                    throw new Error(`AssertionError: no slot allocated for ${ir.OpKind[op.kind]} target ${op.target}`);
                }
                op.slot = slotMap.get(op.target);
            }
            // Process all `ir.Expression`s within this view, and look for `usesSlotIndexExprTrait`.
            ir.visitExpressionsInOp(op, expr => {
                if (!ir.isIrExpression(expr)) {
                    return;
                }
                if (!ir.hasUsesSlotIndexTrait(expr) || expr.slot !== null) {
                    return;
                }
                // The `UsesSlotIndexExprTrait` indicates that this expression references something declared
                // in this component template by its slot index. Use the `target` `ir.XrefId` to find the
                // allocated slot for that declaration in `slotMap`.
                if (!slotMap.has(expr.target)) {
                    // We do expect to find a slot allocated for everything which might be referenced.
                    throw new Error(`AssertionError: no slot allocated for ${expr.constructor.name} target ${expr.target}`);
                }
                // Record the allocated slot on the expression.
                expr.slot = slotMap.get(expr.target);
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xvdF9hbGxvY2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvc2xvdF9hbGxvY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsR0FBNEI7SUFDOUQsa0dBQWtHO0lBQ2xHLDZGQUE2RjtJQUM3RiwrRkFBK0Y7SUFDL0YsYUFBYTtJQUNiLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRTdDLDhEQUE4RDtJQUM5RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsNEVBQTRFO1FBQzVFLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztRQUVsQixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsdURBQXVEO1lBQ3ZELElBQUksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtZQUVELHdFQUF3RTtZQUN4RSxFQUFFLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQztZQUVwQixnREFBZ0Q7WUFDaEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU5Qiw0RkFBNEY7WUFDNUYscUJBQXFCO1lBQ3JCLFNBQVMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDO1NBQzlCO1FBRUQsK0ZBQStGO1FBQy9GLHlFQUF5RTtRQUN6RSxJQUFJLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQztLQUN4QjtJQUVELDhGQUE4RjtJQUM5RiwrRUFBK0U7SUFDL0UsOEVBQThFO0lBQzlFLDRGQUE0RjtJQUM1Rix5RkFBeUY7SUFDekYsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtnQkFDbEMsbUZBQW1GO2dCQUNuRixnREFBZ0Q7Z0JBQ2hELE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsQ0FBQztnQkFDMUMsRUFBRSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDO2FBQzVCO1lBRUQsSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7Z0JBQ3BELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDM0Isa0ZBQWtGO29CQUNsRixNQUFNLElBQUksS0FBSyxDQUNYLHlDQUF5QyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztpQkFDeEY7Z0JBRUQsRUFBRSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUUsQ0FBQzthQUNuQztZQUVELHdGQUF3RjtZQUN4RixFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNqQyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDNUIsT0FBTztpQkFDUjtnQkFFRCxJQUFJLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO29CQUN6RCxPQUFPO2lCQUNSO2dCQUVELDRGQUE0RjtnQkFDNUYseUZBQXlGO2dCQUN6RixvREFBb0Q7Z0JBRXBELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDN0Isa0ZBQWtGO29CQUNsRixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksV0FDMUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7aUJBQ3BCO2dCQUVELCtDQUErQztnQkFDL0MsSUFBSSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUUsQ0FBQztZQUN4QyxDQUFDLENBQUMsQ0FBQztTQUNKO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEFzc2lnbiBkYXRhIHNsb3RzIGZvciBhbGwgb3BlcmF0aW9ucyB3aGljaCBpbXBsZW1lbnQgYENvbnN1bWVzU2xvdE9wVHJhaXRgLCBhbmQgcHJvcGFnYXRlIHRoZVxuICogYXNzaWduZWQgZGF0YSBzbG90cyBvZiB0aG9zZSBvcGVyYXRpb25zIHRvIGFueSBleHByZXNzaW9ucyB3aGljaCByZWZlcmVuY2UgdGhlbSB2aWFcbiAqIGBVc2VzU2xvdEluZGV4VHJhaXRgLlxuICpcbiAqIFRoaXMgcGhhc2UgaXMgYWxzbyByZXNwb25zaWJsZSBmb3IgY291bnRpbmcgdGhlIG51bWJlciBvZiBzbG90cyB1c2VkIGZvciBlYWNoIHZpZXcgKGl0cyBgZGVjbHNgKVxuICogYW5kIHByb3BhZ2F0aW5nIHRoYXQgbnVtYmVyIGludG8gdGhlIGBUZW1wbGF0ZWAgb3BlcmF0aW9ucyB3aGljaCBkZWNsYXJlIGVtYmVkZGVkIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VTbG90QWxsb2NhdGlvbihqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIE1hcCBvZiBhbGwgZGVjbGFyYXRpb25zIGluIGFsbCB2aWV3cyB3aXRoaW4gdGhlIGNvbXBvbmVudCB3aGljaCByZXF1aXJlIGFuIGFzc2lnbmVkIHNsb3QgaW5kZXguXG4gIC8vIFRoaXMgbWFwIG5lZWRzIHRvIGJlIGdsb2JhbCAoYWNyb3NzIGFsbCB2aWV3cyB3aXRoaW4gdGhlIGNvbXBvbmVudCkgc2luY2UgaXQncyBwb3NzaWJsZSB0b1xuICAvLyByZWZlcmVuY2UgYSBzbG90IGZyb20gb25lIHZpZXcgZnJvbSBhbiBleHByZXNzaW9uIHdpdGhpbiBhbm90aGVyIChlLmcuIGxvY2FsIHJlZmVyZW5jZXMgd29ya1xuICAvLyB0aGlzIHdheSkuXG4gIGNvbnN0IHNsb3RNYXAgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyPigpO1xuXG4gIC8vIFByb2Nlc3MgYWxsIHZpZXdzIGluIHRoZSBjb21wb25lbnQgYW5kIGFzc2lnbiBzbG90IGluZGV4ZXMuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBTbG90IGluZGljZXMgc3RhcnQgYXQgMCBmb3IgZWFjaCB2aWV3IChhbmQgYXJlIG5vdCB1bmlxdWUgYmV0d2VlbiB2aWV3cykuXG4gICAgbGV0IHNsb3RDb3VudCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAvLyBPbmx5IGNvbnNpZGVyIGRlY2xhcmF0aW9ucyB3aGljaCBjb25zdW1lIGRhdGEgc2xvdHMuXG4gICAgICBpZiAoIWlyLmhhc0NvbnN1bWVzU2xvdFRyYWl0KG9wKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQXNzaWduIHNsb3RzIHRvIHRoaXMgZGVjbGFyYXRpb24gc3RhcnRpbmcgYXQgdGhlIGN1cnJlbnQgYHNsb3RDb3VudGAuXG4gICAgICBvcC5zbG90ID0gc2xvdENvdW50O1xuXG4gICAgICAvLyBBbmQgdHJhY2sgaXRzIGFzc2lnbmVkIHNsb3QgaW4gdGhlIGBzbG90TWFwYC5cbiAgICAgIHNsb3RNYXAuc2V0KG9wLnhyZWYsIG9wLnNsb3QpO1xuXG4gICAgICAvLyBFYWNoIGRlY2xhcmF0aW9uIG1heSB1c2UgbW9yZSB0aGFuIDEgc2xvdCwgc28gaW5jcmVtZW50IGBzbG90Q291bnRgIHRvIHJlc2VydmUgdGhlIG51bWJlclxuICAgICAgLy8gb2Ygc2xvdHMgcmVxdWlyZWQuXG4gICAgICBzbG90Q291bnQgKz0gb3AubnVtU2xvdHNVc2VkO1xuICAgIH1cblxuICAgIC8vIFJlY29yZCB0aGUgdG90YWwgbnVtYmVyIG9mIHNsb3RzIHVzZWQgb24gdGhlIHZpZXcgaXRzZWxmLiBUaGlzIHdpbGwgbGF0ZXIgYmUgcHJvcGFnYXRlZCBpbnRvXG4gICAgLy8gYGlyLlRlbXBsYXRlT3BgcyB3aGljaCBkZWNsYXJlIHRob3NlIHZpZXdzIChleGNlcHQgZm9yIHRoZSByb290IHZpZXcpLlxuICAgIHVuaXQuZGVjbHMgPSBzbG90Q291bnQ7XG4gIH1cblxuICAvLyBBZnRlciBzbG90IGFzc2lnbm1lbnQsIGBzbG90TWFwYCBub3cgY29udGFpbnMgc2xvdCBhc3NpZ25tZW50cyBmb3IgZXZlcnkgZGVjbGFyYXRpb24gaW4gdGhlXG4gIC8vIHdob2xlIHRlbXBsYXRlLCBhY3Jvc3MgYWxsIHZpZXdzLiBOZXh0LCBsb29rIGZvciBleHByZXNzaW9ucyB3aGljaCBpbXBsZW1lbnRcbiAgLy8gYFVzZXNTbG90SW5kZXhFeHByVHJhaXRgIGFuZCBwcm9wYWdhdGUgdGhlIGFzc2lnbmVkIHNsb3QgaW5kZXhlcyBpbnRvIHRoZW0uXG4gIC8vIEFkZGl0aW9uYWxseSwgdGhpcyBzZWNvbmQgc2NhbiBhbGxvd3MgdXMgdG8gZmluZCBgaXIuVGVtcGxhdGVPcGBzIHdoaWNoIGRlY2xhcmUgdmlld3MgYW5kXG4gIC8vIHByb3BhZ2F0ZSB0aGUgbnVtYmVyIG9mIHNsb3RzIHVzZWQgZm9yIGVhY2ggdmlldyBpbnRvIHRoZSBvcGVyYXRpb24gd2hpY2ggZGVjbGFyZXMgaXQuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQub3BzKCkpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuVGVtcGxhdGUpIHtcbiAgICAgICAgLy8gUmVjb3JkIHRoZSBudW1iZXIgb2Ygc2xvdHMgdXNlZCBieSB0aGUgdmlldyB0aGlzIGBpci5UZW1wbGF0ZU9wYCBkZWNsYXJlcyBpbiB0aGVcbiAgICAgICAgLy8gb3BlcmF0aW9uIGl0c2VsZiwgc28gaXQgY2FuIGJlIGVtaXR0ZWQgbGF0ZXIuXG4gICAgICAgIGNvbnN0IGNoaWxkVmlldyA9IGpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBvcC5kZWNscyA9IGNoaWxkVmlldy5kZWNscztcbiAgICAgIH1cblxuICAgICAgaWYgKGlyLmhhc1VzZXNTbG90SW5kZXhUcmFpdChvcCkgJiYgb3Auc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICBpZiAoIXNsb3RNYXAuaGFzKG9wLnRhcmdldCkpIHtcbiAgICAgICAgICAvLyBXZSBkbyBleHBlY3QgdG8gZmluZCBhIHNsb3QgYWxsb2NhdGVkIGZvciBldmVyeXRoaW5nIHdoaWNoIG1pZ2h0IGJlIHJlZmVyZW5jZWQuXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IG5vIHNsb3QgYWxsb2NhdGVkIGZvciAke2lyLk9wS2luZFtvcC5raW5kXX0gdGFyZ2V0ICR7b3AudGFyZ2V0fWApO1xuICAgICAgICB9XG5cbiAgICAgICAgb3Auc2xvdCA9IHNsb3RNYXAuZ2V0KG9wLnRhcmdldCkhO1xuICAgICAgfVxuXG4gICAgICAvLyBQcm9jZXNzIGFsbCBgaXIuRXhwcmVzc2lvbmBzIHdpdGhpbiB0aGlzIHZpZXcsIGFuZCBsb29rIGZvciBgdXNlc1Nsb3RJbmRleEV4cHJUcmFpdGAuXG4gICAgICBpci52aXNpdEV4cHJlc3Npb25zSW5PcChvcCwgZXhwciA9PiB7XG4gICAgICAgIGlmICghaXIuaXNJckV4cHJlc3Npb24oZXhwcikpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlyLmhhc1VzZXNTbG90SW5kZXhUcmFpdChleHByKSB8fCBleHByLnNsb3QgIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgYFVzZXNTbG90SW5kZXhFeHByVHJhaXRgIGluZGljYXRlcyB0aGF0IHRoaXMgZXhwcmVzc2lvbiByZWZlcmVuY2VzIHNvbWV0aGluZyBkZWNsYXJlZFxuICAgICAgICAvLyBpbiB0aGlzIGNvbXBvbmVudCB0ZW1wbGF0ZSBieSBpdHMgc2xvdCBpbmRleC4gVXNlIHRoZSBgdGFyZ2V0YCBgaXIuWHJlZklkYCB0byBmaW5kIHRoZVxuICAgICAgICAvLyBhbGxvY2F0ZWQgc2xvdCBmb3IgdGhhdCBkZWNsYXJhdGlvbiBpbiBgc2xvdE1hcGAuXG5cbiAgICAgICAgaWYgKCFzbG90TWFwLmhhcyhleHByLnRhcmdldCkpIHtcbiAgICAgICAgICAvLyBXZSBkbyBleHBlY3QgdG8gZmluZCBhIHNsb3QgYWxsb2NhdGVkIGZvciBldmVyeXRoaW5nIHdoaWNoIG1pZ2h0IGJlIHJlZmVyZW5jZWQuXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogbm8gc2xvdCBhbGxvY2F0ZWQgZm9yICR7ZXhwci5jb25zdHJ1Y3Rvci5uYW1lfSB0YXJnZXQgJHtcbiAgICAgICAgICAgICAgZXhwci50YXJnZXR9YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNvcmQgdGhlIGFsbG9jYXRlZCBzbG90IG9uIHRoZSBleHByZXNzaW9uLlxuICAgICAgICBleHByLnNsb3QgPSBzbG90TWFwLmdldChleHByLnRhcmdldCkhO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iXX0=