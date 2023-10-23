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
            if (op.kind === ir.OpKind.Template || op.kind === ir.OpKind.RepeaterCreate) {
                // Record the number of slots used by the view this `ir.TemplateOp` declares in the
                // operation itself, so it can be emitted later.
                const childView = job.views.get(op.xref);
                op.decls = childView.decls;
            }
            if (ir.hasUsesSlotIndexTrait(op) && op.target !== null && op.targetSlot === null) {
                if (!slotMap.has(op.target)) {
                    // We do expect to find a slot allocated for everything which might be referenced.
                    throw new Error(`AssertionError: no slot allocated for ${ir.OpKind[op.kind]} target ${op.target}`);
                }
                op.targetSlot = slotMap.get(op.target);
            }
            // Process all `ir.Expression`s within this view, and look for `usesSlotIndexExprTrait`.
            ir.visitExpressionsInOp(op, expr => {
                if (!ir.isIrExpression(expr)) {
                    return;
                }
                if (!ir.hasUsesSlotIndexTrait(expr) || expr.targetSlot !== null) {
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
                expr.targetSlot = slotMap.get(expr.target);
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xvdF9hbGxvY2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvc2xvdF9hbGxvY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsR0FBNEI7SUFDOUQsa0dBQWtHO0lBQ2xHLDZGQUE2RjtJQUM3RiwrRkFBK0Y7SUFDL0YsYUFBYTtJQUNiLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO0lBRTdDLDhEQUE4RDtJQUM5RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsNEVBQTRFO1FBQzVFLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztRQUVsQixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsdURBQXVEO1lBQ3ZELElBQUksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtZQUVELHdFQUF3RTtZQUN4RSxFQUFFLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQztZQUVwQixnREFBZ0Q7WUFDaEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU5Qiw0RkFBNEY7WUFDNUYscUJBQXFCO1lBQ3JCLFNBQVMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDO1NBQzlCO1FBRUQsK0ZBQStGO1FBQy9GLHlFQUF5RTtRQUN6RSxJQUFJLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQztLQUN4QjtJQUVELDhGQUE4RjtJQUM5RiwrRUFBK0U7SUFDL0UsOEVBQThFO0lBQzlFLDRGQUE0RjtJQUM1Rix5RkFBeUY7SUFDekYsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzNCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO2dCQUMxRSxtRkFBbUY7Z0JBQ25GLGdEQUFnRDtnQkFDaEQsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxDQUFDO2dCQUMxQyxFQUFFLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUM7YUFDNUI7WUFFRCxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxLQUFLLElBQUksSUFBSSxFQUFFLENBQUMsVUFBVSxLQUFLLElBQUksRUFBRTtnQkFDaEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFO29CQUMzQixrRkFBa0Y7b0JBQ2xGLE1BQU0sSUFBSSxLQUFLLENBQ1gseUNBQXlDLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2lCQUN4RjtnQkFFRCxFQUFFLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBRSxDQUFDO2FBQ3pDO1lBRUQsd0ZBQXdGO1lBQ3hGLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pDLElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUM1QixPQUFPO2lCQUNSO2dCQUVELElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUU7b0JBQy9ELE9BQU87aUJBQ1I7Z0JBRUQsNEZBQTRGO2dCQUM1Rix5RkFBeUY7Z0JBQ3pGLG9EQUFvRDtnQkFFcEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO29CQUM3QixrRkFBa0Y7b0JBQ2xGLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxXQUMxRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztpQkFDcEI7Z0JBRUQsK0NBQStDO2dCQUMvQyxJQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBRSxDQUFDO1lBQzlDLENBQUMsQ0FBQyxDQUFDO1NBQ0o7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogQXNzaWduIGRhdGEgc2xvdHMgZm9yIGFsbCBvcGVyYXRpb25zIHdoaWNoIGltcGxlbWVudCBgQ29uc3VtZXNTbG90T3BUcmFpdGAsIGFuZCBwcm9wYWdhdGUgdGhlXG4gKiBhc3NpZ25lZCBkYXRhIHNsb3RzIG9mIHRob3NlIG9wZXJhdGlvbnMgdG8gYW55IGV4cHJlc3Npb25zIHdoaWNoIHJlZmVyZW5jZSB0aGVtIHZpYVxuICogYFVzZXNTbG90SW5kZXhUcmFpdGAuXG4gKlxuICogVGhpcyBwaGFzZSBpcyBhbHNvIHJlc3BvbnNpYmxlIGZvciBjb3VudGluZyB0aGUgbnVtYmVyIG9mIHNsb3RzIHVzZWQgZm9yIGVhY2ggdmlldyAoaXRzIGBkZWNsc2ApXG4gKiBhbmQgcHJvcGFnYXRpbmcgdGhhdCBudW1iZXIgaW50byB0aGUgYFRlbXBsYXRlYCBvcGVyYXRpb25zIHdoaWNoIGRlY2xhcmUgZW1iZWRkZWQgdmlld3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVNsb3RBbGxvY2F0aW9uKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgLy8gTWFwIG9mIGFsbCBkZWNsYXJhdGlvbnMgaW4gYWxsIHZpZXdzIHdpdGhpbiB0aGUgY29tcG9uZW50IHdoaWNoIHJlcXVpcmUgYW4gYXNzaWduZWQgc2xvdCBpbmRleC5cbiAgLy8gVGhpcyBtYXAgbmVlZHMgdG8gYmUgZ2xvYmFsIChhY3Jvc3MgYWxsIHZpZXdzIHdpdGhpbiB0aGUgY29tcG9uZW50KSBzaW5jZSBpdCdzIHBvc3NpYmxlIHRvXG4gIC8vIHJlZmVyZW5jZSBhIHNsb3QgZnJvbSBvbmUgdmlldyBmcm9tIGFuIGV4cHJlc3Npb24gd2l0aGluIGFub3RoZXIgKGUuZy4gbG9jYWwgcmVmZXJlbmNlcyB3b3JrXG4gIC8vIHRoaXMgd2F5KS5cbiAgY29uc3Qgc2xvdE1hcCA9IG5ldyBNYXA8aXIuWHJlZklkLCBudW1iZXI+KCk7XG5cbiAgLy8gUHJvY2VzcyBhbGwgdmlld3MgaW4gdGhlIGNvbXBvbmVudCBhbmQgYXNzaWduIHNsb3QgaW5kZXhlcy5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFNsb3QgaW5kaWNlcyBzdGFydCBhdCAwIGZvciBlYWNoIHZpZXcgKGFuZCBhcmUgbm90IHVuaXF1ZSBiZXR3ZWVuIHZpZXdzKS5cbiAgICBsZXQgc2xvdENvdW50ID0gMDtcblxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIC8vIE9ubHkgY29uc2lkZXIgZGVjbGFyYXRpb25zIHdoaWNoIGNvbnN1bWUgZGF0YSBzbG90cy5cbiAgICAgIGlmICghaXIuaGFzQ29uc3VtZXNTbG90VHJhaXQob3ApKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBc3NpZ24gc2xvdHMgdG8gdGhpcyBkZWNsYXJhdGlvbiBzdGFydGluZyBhdCB0aGUgY3VycmVudCBgc2xvdENvdW50YC5cbiAgICAgIG9wLnNsb3QgPSBzbG90Q291bnQ7XG5cbiAgICAgIC8vIEFuZCB0cmFjayBpdHMgYXNzaWduZWQgc2xvdCBpbiB0aGUgYHNsb3RNYXBgLlxuICAgICAgc2xvdE1hcC5zZXQob3AueHJlZiwgb3Auc2xvdCk7XG5cbiAgICAgIC8vIEVhY2ggZGVjbGFyYXRpb24gbWF5IHVzZSBtb3JlIHRoYW4gMSBzbG90LCBzbyBpbmNyZW1lbnQgYHNsb3RDb3VudGAgdG8gcmVzZXJ2ZSB0aGUgbnVtYmVyXG4gICAgICAvLyBvZiBzbG90cyByZXF1aXJlZC5cbiAgICAgIHNsb3RDb3VudCArPSBvcC5udW1TbG90c1VzZWQ7XG4gICAgfVxuXG4gICAgLy8gUmVjb3JkIHRoZSB0b3RhbCBudW1iZXIgb2Ygc2xvdHMgdXNlZCBvbiB0aGUgdmlldyBpdHNlbGYuIFRoaXMgd2lsbCBsYXRlciBiZSBwcm9wYWdhdGVkIGludG9cbiAgICAvLyBgaXIuVGVtcGxhdGVPcGBzIHdoaWNoIGRlY2xhcmUgdGhvc2Ugdmlld3MgKGV4Y2VwdCBmb3IgdGhlIHJvb3QgdmlldykuXG4gICAgdW5pdC5kZWNscyA9IHNsb3RDb3VudDtcbiAgfVxuXG4gIC8vIEFmdGVyIHNsb3QgYXNzaWdubWVudCwgYHNsb3RNYXBgIG5vdyBjb250YWlucyBzbG90IGFzc2lnbm1lbnRzIGZvciBldmVyeSBkZWNsYXJhdGlvbiBpbiB0aGVcbiAgLy8gd2hvbGUgdGVtcGxhdGUsIGFjcm9zcyBhbGwgdmlld3MuIE5leHQsIGxvb2sgZm9yIGV4cHJlc3Npb25zIHdoaWNoIGltcGxlbWVudFxuICAvLyBgVXNlc1Nsb3RJbmRleEV4cHJUcmFpdGAgYW5kIHByb3BhZ2F0ZSB0aGUgYXNzaWduZWQgc2xvdCBpbmRleGVzIGludG8gdGhlbS5cbiAgLy8gQWRkaXRpb25hbGx5LCB0aGlzIHNlY29uZCBzY2FuIGFsbG93cyB1cyB0byBmaW5kIGBpci5UZW1wbGF0ZU9wYHMgd2hpY2ggZGVjbGFyZSB2aWV3cyBhbmRcbiAgLy8gcHJvcGFnYXRlIHRoZSBudW1iZXIgb2Ygc2xvdHMgdXNlZCBmb3IgZWFjaCB2aWV3IGludG8gdGhlIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBpdC5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5vcHMoKSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5UZW1wbGF0ZSB8fCBvcC5raW5kID09PSBpci5PcEtpbmQuUmVwZWF0ZXJDcmVhdGUpIHtcbiAgICAgICAgLy8gUmVjb3JkIHRoZSBudW1iZXIgb2Ygc2xvdHMgdXNlZCBieSB0aGUgdmlldyB0aGlzIGBpci5UZW1wbGF0ZU9wYCBkZWNsYXJlcyBpbiB0aGVcbiAgICAgICAgLy8gb3BlcmF0aW9uIGl0c2VsZiwgc28gaXQgY2FuIGJlIGVtaXR0ZWQgbGF0ZXIuXG4gICAgICAgIGNvbnN0IGNoaWxkVmlldyA9IGpvYi52aWV3cy5nZXQob3AueHJlZikhO1xuICAgICAgICBvcC5kZWNscyA9IGNoaWxkVmlldy5kZWNscztcbiAgICAgIH1cblxuICAgICAgaWYgKGlyLmhhc1VzZXNTbG90SW5kZXhUcmFpdChvcCkgJiYgb3AudGFyZ2V0ICE9PSBudWxsICYmIG9wLnRhcmdldFNsb3QgPT09IG51bGwpIHtcbiAgICAgICAgaWYgKCFzbG90TWFwLmhhcyhvcC50YXJnZXQpKSB7XG4gICAgICAgICAgLy8gV2UgZG8gZXhwZWN0IHRvIGZpbmQgYSBzbG90IGFsbG9jYXRlZCBmb3IgZXZlcnl0aGluZyB3aGljaCBtaWdodCBiZSByZWZlcmVuY2VkLlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYEFzc2VydGlvbkVycm9yOiBubyBzbG90IGFsbG9jYXRlZCBmb3IgJHtpci5PcEtpbmRbb3Aua2luZF19IHRhcmdldCAke29wLnRhcmdldH1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9wLnRhcmdldFNsb3QgPSBzbG90TWFwLmdldChvcC50YXJnZXQpITtcbiAgICAgIH1cblxuICAgICAgLy8gUHJvY2VzcyBhbGwgYGlyLkV4cHJlc3Npb25gcyB3aXRoaW4gdGhpcyB2aWV3LCBhbmQgbG9vayBmb3IgYHVzZXNTbG90SW5kZXhFeHByVHJhaXRgLlxuICAgICAgaXIudmlzaXRFeHByZXNzaW9uc0luT3Aob3AsIGV4cHIgPT4ge1xuICAgICAgICBpZiAoIWlyLmlzSXJFeHByZXNzaW9uKGV4cHIpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpci5oYXNVc2VzU2xvdEluZGV4VHJhaXQoZXhwcikgfHwgZXhwci50YXJnZXRTbG90ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGBVc2VzU2xvdEluZGV4RXhwclRyYWl0YCBpbmRpY2F0ZXMgdGhhdCB0aGlzIGV4cHJlc3Npb24gcmVmZXJlbmNlcyBzb21ldGhpbmcgZGVjbGFyZWRcbiAgICAgICAgLy8gaW4gdGhpcyBjb21wb25lbnQgdGVtcGxhdGUgYnkgaXRzIHNsb3QgaW5kZXguIFVzZSB0aGUgYHRhcmdldGAgYGlyLlhyZWZJZGAgdG8gZmluZCB0aGVcbiAgICAgICAgLy8gYWxsb2NhdGVkIHNsb3QgZm9yIHRoYXQgZGVjbGFyYXRpb24gaW4gYHNsb3RNYXBgLlxuXG4gICAgICAgIGlmICghc2xvdE1hcC5oYXMoZXhwci50YXJnZXQpKSB7XG4gICAgICAgICAgLy8gV2UgZG8gZXhwZWN0IHRvIGZpbmQgYSBzbG90IGFsbG9jYXRlZCBmb3IgZXZlcnl0aGluZyB3aGljaCBtaWdodCBiZSByZWZlcmVuY2VkLlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IG5vIHNsb3QgYWxsb2NhdGVkIGZvciAke2V4cHIuY29uc3RydWN0b3IubmFtZX0gdGFyZ2V0ICR7XG4gICAgICAgICAgICAgIGV4cHIudGFyZ2V0fWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIHRoZSBhbGxvY2F0ZWQgc2xvdCBvbiB0aGUgZXhwcmVzc2lvbi5cbiAgICAgICAgZXhwci50YXJnZXRTbG90ID0gc2xvdE1hcC5nZXQoZXhwci50YXJnZXQpITtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19