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
            op.slot.slot = slotCount;
            // And track its assigned slot in the `slotMap`.
            slotMap.set(op.xref, op.slot.slot);
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
            if (op.kind === ir.OpKind.Template || op.kind === ir.OpKind.RepeaterCreate) {
                // Record the number of slots used by the view this `ir.TemplateOp` declares in the
                // operation itself, so it can be emitted later.
                const childView = job.views.get(op.xref);
                op.decls = childView.decls;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xvdF9hbGxvY2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvc2xvdF9hbGxvY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsR0FBNEI7SUFDOUQsa0dBQWtHO0lBQ2xHLDZGQUE2RjtJQUM3RiwrRkFBK0Y7SUFDL0YsYUFBYTtJQUNiLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRTdDLDhEQUE4RDtJQUM5RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsNEVBQTRFO1FBQzVFLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztRQUVsQixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsdURBQXVEO1lBQ3ZELElBQUksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtZQUVELHdFQUF3RTtZQUN4RSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUM7WUFFekIsZ0RBQWdEO1lBQ2hELE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRW5DLDRGQUE0RjtZQUM1RixxQkFBcUI7WUFDckIsU0FBUyxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUM7U0FDOUI7UUFFRCwrRkFBK0Y7UUFDL0YseUVBQXlFO1FBQ3pFLElBQUksQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDO0tBQ3hCO0lBRUQsOEZBQThGO0lBQzlGLCtFQUErRTtJQUMvRSw4RUFBOEU7SUFDOUUsNEZBQTRGO0lBQzVGLHlGQUF5RjtJQUN6RixLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDM0IsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUU7Z0JBQzFFLG1GQUFtRjtnQkFDbkYsZ0RBQWdEO2dCQUNoRCxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUM7Z0JBQzFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQzthQUM1QjtTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB0eXBlIHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIEFzc2lnbiBkYXRhIHNsb3RzIGZvciBhbGwgb3BlcmF0aW9ucyB3aGljaCBpbXBsZW1lbnQgYENvbnN1bWVzU2xvdE9wVHJhaXRgLCBhbmQgcHJvcGFnYXRlIHRoZVxuICogYXNzaWduZWQgZGF0YSBzbG90cyBvZiB0aG9zZSBvcGVyYXRpb25zIHRvIGFueSBleHByZXNzaW9ucyB3aGljaCByZWZlcmVuY2UgdGhlbSB2aWFcbiAqIGBVc2VzU2xvdEluZGV4VHJhaXRgLlxuICpcbiAqIFRoaXMgcGhhc2UgaXMgYWxzbyByZXNwb25zaWJsZSBmb3IgY291bnRpbmcgdGhlIG51bWJlciBvZiBzbG90cyB1c2VkIGZvciBlYWNoIHZpZXcgKGl0cyBgZGVjbHNgKVxuICogYW5kIHByb3BhZ2F0aW5nIHRoYXQgbnVtYmVyIGludG8gdGhlIGBUZW1wbGF0ZWAgb3BlcmF0aW9ucyB3aGljaCBkZWNsYXJlIGVtYmVkZGVkIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VTbG90QWxsb2NhdGlvbihqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIE1hcCBvZiBhbGwgZGVjbGFyYXRpb25zIGluIGFsbCB2aWV3cyB3aXRoaW4gdGhlIGNvbXBvbmVudCB3aGljaCByZXF1aXJlIGFuIGFzc2lnbmVkIHNsb3QgaW5kZXguXG4gIC8vIFRoaXMgbWFwIG5lZWRzIHRvIGJlIGdsb2JhbCAoYWNyb3NzIGFsbCB2aWV3cyB3aXRoaW4gdGhlIGNvbXBvbmVudCkgc2luY2UgaXQncyBwb3NzaWJsZSB0b1xuICAvLyByZWZlcmVuY2UgYSBzbG90IGZyb20gb25lIHZpZXcgZnJvbSBhbiBleHByZXNzaW9uIHdpdGhpbiBhbm90aGVyIChlLmcuIGxvY2FsIHJlZmVyZW5jZXMgd29ya1xuICAvLyB0aGlzIHdheSkuXG4gIGNvbnN0IHNsb3RNYXAgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyPigpO1xuXG4gIC8vIFByb2Nlc3MgYWxsIHZpZXdzIGluIHRoZSBjb21wb25lbnQgYW5kIGFzc2lnbiBzbG90IGluZGV4ZXMuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBTbG90IGluZGljZXMgc3RhcnQgYXQgMCBmb3IgZWFjaCB2aWV3IChhbmQgYXJlIG5vdCB1bmlxdWUgYmV0d2VlbiB2aWV3cykuXG4gICAgbGV0IHNsb3RDb3VudCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAvLyBPbmx5IGNvbnNpZGVyIGRlY2xhcmF0aW9ucyB3aGljaCBjb25zdW1lIGRhdGEgc2xvdHMuXG4gICAgICBpZiAoIWlyLmhhc0NvbnN1bWVzU2xvdFRyYWl0KG9wKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQXNzaWduIHNsb3RzIHRvIHRoaXMgZGVjbGFyYXRpb24gc3RhcnRpbmcgYXQgdGhlIGN1cnJlbnQgYHNsb3RDb3VudGAuXG4gICAgICBvcC5zbG90LnNsb3QgPSBzbG90Q291bnQ7XG5cbiAgICAgIC8vIEFuZCB0cmFjayBpdHMgYXNzaWduZWQgc2xvdCBpbiB0aGUgYHNsb3RNYXBgLlxuICAgICAgc2xvdE1hcC5zZXQob3AueHJlZiwgb3Auc2xvdC5zbG90KTtcblxuICAgICAgLy8gRWFjaCBkZWNsYXJhdGlvbiBtYXkgdXNlIG1vcmUgdGhhbiAxIHNsb3QsIHNvIGluY3JlbWVudCBgc2xvdENvdW50YCB0byByZXNlcnZlIHRoZSBudW1iZXJcbiAgICAgIC8vIG9mIHNsb3RzIHJlcXVpcmVkLlxuICAgICAgc2xvdENvdW50ICs9IG9wLm51bVNsb3RzVXNlZDtcbiAgICB9XG5cbiAgICAvLyBSZWNvcmQgdGhlIHRvdGFsIG51bWJlciBvZiBzbG90cyB1c2VkIG9uIHRoZSB2aWV3IGl0c2VsZi4gVGhpcyB3aWxsIGxhdGVyIGJlIHByb3BhZ2F0ZWQgaW50b1xuICAgIC8vIGBpci5UZW1wbGF0ZU9wYHMgd2hpY2ggZGVjbGFyZSB0aG9zZSB2aWV3cyAoZXhjZXB0IGZvciB0aGUgcm9vdCB2aWV3KS5cbiAgICB1bml0LmRlY2xzID0gc2xvdENvdW50O1xuICB9XG5cbiAgLy8gQWZ0ZXIgc2xvdCBhc3NpZ25tZW50LCBgc2xvdE1hcGAgbm93IGNvbnRhaW5zIHNsb3QgYXNzaWdubWVudHMgZm9yIGV2ZXJ5IGRlY2xhcmF0aW9uIGluIHRoZVxuICAvLyB3aG9sZSB0ZW1wbGF0ZSwgYWNyb3NzIGFsbCB2aWV3cy4gTmV4dCwgbG9vayBmb3IgZXhwcmVzc2lvbnMgd2hpY2ggaW1wbGVtZW50XG4gIC8vIGBVc2VzU2xvdEluZGV4RXhwclRyYWl0YCBhbmQgcHJvcGFnYXRlIHRoZSBhc3NpZ25lZCBzbG90IGluZGV4ZXMgaW50byB0aGVtLlxuICAvLyBBZGRpdGlvbmFsbHksIHRoaXMgc2Vjb25kIHNjYW4gYWxsb3dzIHVzIHRvIGZpbmQgYGlyLlRlbXBsYXRlT3BgcyB3aGljaCBkZWNsYXJlIHZpZXdzIGFuZFxuICAvLyBwcm9wYWdhdGUgdGhlIG51bWJlciBvZiBzbG90cyB1c2VkIGZvciBlYWNoIHZpZXcgaW50byB0aGUgb3BlcmF0aW9uIHdoaWNoIGRlY2xhcmVzIGl0LlxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0Lm9wcygpKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLlRlbXBsYXRlIHx8IG9wLmtpbmQgPT09IGlyLk9wS2luZC5SZXBlYXRlckNyZWF0ZSkge1xuICAgICAgICAvLyBSZWNvcmQgdGhlIG51bWJlciBvZiBzbG90cyB1c2VkIGJ5IHRoZSB2aWV3IHRoaXMgYGlyLlRlbXBsYXRlT3BgIGRlY2xhcmVzIGluIHRoZVxuICAgICAgICAvLyBvcGVyYXRpb24gaXRzZWxmLCBzbyBpdCBjYW4gYmUgZW1pdHRlZCBsYXRlci5cbiAgICAgICAgY29uc3QgY2hpbGRWaWV3ID0gam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIG9wLmRlY2xzID0gY2hpbGRWaWV3LmRlY2xzO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19