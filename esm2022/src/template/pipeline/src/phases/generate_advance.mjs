/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Generate `ir.AdvanceOp`s in between `ir.UpdateOp`s that ensure the runtime's implicit slot
 * context will be advanced correctly.
 */
export function phaseGenerateAdvance(cpl) {
    for (const [_, view] of cpl.views) {
        // First build a map of all of the declarations in the view that have assigned slots.
        const slotMap = new Map();
        for (const op of view.create) {
            if (!ir.hasConsumesSlotTrait(op)) {
                continue;
            }
            else if (op.slot === null) {
                throw new Error(`AssertionError: expected slots to have been allocated before generating advance() calls`);
            }
            slotMap.set(op.xref, op.slot);
        }
        // Next, step through the update operations and generate `ir.AdvanceOp`s as required to ensure
        // the runtime's implicit slot counter will be set to the correct slot before executing each
        // update operation which depends on it.
        //
        // To do that, we track what the runtime's slot counter will be through the update operations.
        let slotContext = 0;
        for (const op of view.update) {
            if (!ir.hasDependsOnSlotContextTrait(op)) {
                // `op` doesn't depend on the slot counter, so it can be skipped.
                continue;
            }
            else if (!slotMap.has(op.target)) {
                // We expect ops that _do_ depend on the slot counter to point at declarations that exist in
                // the `slotMap`.
                throw new Error(`AssertionError: reference to unknown slot for var ${op.target}`);
            }
            const slot = slotMap.get(op.target);
            // Does the slot counter need to be adjusted?
            if (slotContext !== slot) {
                // If so, generate an `ir.AdvanceOp` to advance the counter.
                const delta = slot - slotContext;
                if (delta < 0) {
                    throw new Error(`AssertionError: slot counter should never need to move backwards`);
                }
                ir.OpList.insertBefore(ir.createAdvanceOp(delta), op);
                slotContext = slot;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfYWR2YW5jZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2dlbmVyYXRlX2FkdmFuY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLEdBQXlCO0lBQzVELEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQ2pDLHFGQUFxRjtRQUNyRixNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBcUIsQ0FBQztRQUM3QyxLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDaEMsU0FBUzthQUNWO2lCQUFNLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7Z0JBQzNCLE1BQU0sSUFBSSxLQUFLLENBQ1gseUZBQXlGLENBQUMsQ0FBQzthQUNoRztZQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDL0I7UUFFRCw4RkFBOEY7UUFDOUYsNEZBQTRGO1FBQzVGLHdDQUF3QztRQUN4QyxFQUFFO1FBQ0YsOEZBQThGO1FBQzlGLElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztRQUNwQixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDeEMsaUVBQWlFO2dCQUNqRSxTQUFTO2FBQ1Y7aUJBQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUNsQyw0RkFBNEY7Z0JBQzVGLGlCQUFpQjtnQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7YUFDbkY7WUFFRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUUsQ0FBQztZQUVyQyw2Q0FBNkM7WUFDN0MsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFO2dCQUN4Qiw0REFBNEQ7Z0JBQzVELE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxXQUFXLENBQUM7Z0JBQ2pDLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtvQkFDYixNQUFNLElBQUksS0FBSyxDQUFDLGtFQUFrRSxDQUFDLENBQUM7aUJBQ3JGO2dCQUVELEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFjLEVBQUUsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ25FLFdBQVcsR0FBRyxJQUFJLENBQUM7YUFDcEI7U0FDRjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9ufSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgYGlyLkFkdmFuY2VPcGBzIGluIGJldHdlZW4gYGlyLlVwZGF0ZU9wYHMgdGhhdCBlbnN1cmUgdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90XG4gKiBjb250ZXh0IHdpbGwgYmUgYWR2YW5jZWQgY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VHZW5lcmF0ZUFkdmFuY2UoY3BsOiBDb21wb25lbnRDb21waWxhdGlvbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IFtfLCB2aWV3XSBvZiBjcGwudmlld3MpIHtcbiAgICAvLyBGaXJzdCBidWlsZCBhIG1hcCBvZiBhbGwgb2YgdGhlIGRlY2xhcmF0aW9ucyBpbiB0aGUgdmlldyB0aGF0IGhhdmUgYXNzaWduZWQgc2xvdHMuXG4gICAgY29uc3Qgc2xvdE1hcCA9IG5ldyBNYXA8aXIuWHJlZklkLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBvcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgICAgaWYgKCFpci5oYXNDb25zdW1lc1Nsb3RUcmFpdChvcCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9IGVsc2UgaWYgKG9wLnNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBleHBlY3RlZCBzbG90cyB0byBoYXZlIGJlZW4gYWxsb2NhdGVkIGJlZm9yZSBnZW5lcmF0aW5nIGFkdmFuY2UoKSBjYWxsc2ApO1xuICAgICAgfVxuXG4gICAgICBzbG90TWFwLnNldChvcC54cmVmLCBvcC5zbG90KTtcbiAgICB9XG5cbiAgICAvLyBOZXh0LCBzdGVwIHRocm91Z2ggdGhlIHVwZGF0ZSBvcGVyYXRpb25zIGFuZCBnZW5lcmF0ZSBgaXIuQWR2YW5jZU9wYHMgYXMgcmVxdWlyZWQgdG8gZW5zdXJlXG4gICAgLy8gdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90IGNvdW50ZXIgd2lsbCBiZSBzZXQgdG8gdGhlIGNvcnJlY3Qgc2xvdCBiZWZvcmUgZXhlY3V0aW5nIGVhY2hcbiAgICAvLyB1cGRhdGUgb3BlcmF0aW9uIHdoaWNoIGRlcGVuZHMgb24gaXQuXG4gICAgLy9cbiAgICAvLyBUbyBkbyB0aGF0LCB3ZSB0cmFjayB3aGF0IHRoZSBydW50aW1lJ3Mgc2xvdCBjb3VudGVyIHdpbGwgYmUgdGhyb3VnaCB0aGUgdXBkYXRlIG9wZXJhdGlvbnMuXG4gICAgbGV0IHNsb3RDb250ZXh0ID0gMDtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHZpZXcudXBkYXRlKSB7XG4gICAgICBpZiAoIWlyLmhhc0RlcGVuZHNPblNsb3RDb250ZXh0VHJhaXQob3ApKSB7XG4gICAgICAgIC8vIGBvcGAgZG9lc24ndCBkZXBlbmQgb24gdGhlIHNsb3QgY291bnRlciwgc28gaXQgY2FuIGJlIHNraXBwZWQuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfSBlbHNlIGlmICghc2xvdE1hcC5oYXMob3AudGFyZ2V0KSkge1xuICAgICAgICAvLyBXZSBleHBlY3Qgb3BzIHRoYXQgX2RvXyBkZXBlbmQgb24gdGhlIHNsb3QgY291bnRlciB0byBwb2ludCBhdCBkZWNsYXJhdGlvbnMgdGhhdCBleGlzdCBpblxuICAgICAgICAvLyB0aGUgYHNsb3RNYXBgLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiByZWZlcmVuY2UgdG8gdW5rbm93biBzbG90IGZvciB2YXIgJHtvcC50YXJnZXR9YCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNsb3QgPSBzbG90TWFwLmdldChvcC50YXJnZXQpITtcblxuICAgICAgLy8gRG9lcyB0aGUgc2xvdCBjb3VudGVyIG5lZWQgdG8gYmUgYWRqdXN0ZWQ/XG4gICAgICBpZiAoc2xvdENvbnRleHQgIT09IHNsb3QpIHtcbiAgICAgICAgLy8gSWYgc28sIGdlbmVyYXRlIGFuIGBpci5BZHZhbmNlT3BgIHRvIGFkdmFuY2UgdGhlIGNvdW50ZXIuXG4gICAgICAgIGNvbnN0IGRlbHRhID0gc2xvdCAtIHNsb3RDb250ZXh0O1xuICAgICAgICBpZiAoZGVsdGEgPCAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb25FcnJvcjogc2xvdCBjb3VudGVyIHNob3VsZCBuZXZlciBuZWVkIHRvIG1vdmUgYmFja3dhcmRzYCk7XG4gICAgICAgIH1cblxuICAgICAgICBpci5PcExpc3QuaW5zZXJ0QmVmb3JlPGlyLlVwZGF0ZU9wPihpci5jcmVhdGVBZHZhbmNlT3AoZGVsdGEpLCBvcCk7XG4gICAgICAgIHNsb3RDb250ZXh0ID0gc2xvdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==