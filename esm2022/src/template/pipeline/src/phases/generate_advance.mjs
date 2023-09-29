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
export function phaseGenerateAdvance(job) {
    for (const unit of job.units) {
        // First build a map of all of the declarations in the view that have assigned slots.
        const slotMap = new Map();
        let lastSlotOp = null;
        for (const op of unit.create) {
            // For i18n blocks, we want to advance to the last element index in the block before invoking
            // `i18nExp` instructions, to make sure the necessary lifecycle hooks of components/directives
            // are properly flushed.
            if (op.kind === ir.OpKind.I18nEnd) {
                if (lastSlotOp === null) {
                    throw Error('Expected to have encountered an op prior to i18nEnd that consumes a slot');
                }
                // TODO(mmalerba): For empty i18n blocks, we move to the next slot to match
                // TemplateDefinitionBuilder. This seems like just a quirk resulting from the special
                // handling of i18n blocks that can be removed when compatibility is no longer required.
                let lastSlot = lastSlotOp.slot;
                if (lastSlotOp.kind === ir.OpKind.I18nStart && job.compatibility) {
                    lastSlot++;
                }
                slotMap.set(op.xref, lastSlot);
            }
            if (!ir.hasConsumesSlotTrait(op)) {
                continue;
            }
            else if (op.slot === null) {
                throw new Error(`AssertionError: expected slots to have been allocated before generating advance() calls`);
            }
            lastSlotOp = op;
            slotMap.set(op.xref, op.slot);
        }
        // Next, step through the update operations and generate `ir.AdvanceOp`s as required to ensure
        // the runtime's implicit slot counter will be set to the correct slot before executing each
        // update operation which depends on it.
        //
        // To do that, we track what the runtime's slot counter will be through the update operations.
        let slotContext = 0;
        for (const op of unit.update) {
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
                ir.OpList.insertBefore(ir.createAdvanceOp(delta, op.sourceSpan), op);
                slotContext = slot;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVfYWR2YW5jZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL2dlbmVyYXRlX2FkdmFuY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLEdBQW1CO0lBQ3RELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixxRkFBcUY7UUFDckYsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7UUFDN0MsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO1FBQ3RCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1Qiw2RkFBNkY7WUFDN0YsOEZBQThGO1lBQzlGLHdCQUF3QjtZQUN4QixJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Z0JBQ2pDLElBQUksVUFBVSxLQUFLLElBQUksRUFBRTtvQkFDdkIsTUFBTSxLQUFLLENBQUMsMEVBQTBFLENBQUMsQ0FBQztpQkFDekY7Z0JBQ0QsMkVBQTJFO2dCQUMzRSxxRkFBcUY7Z0JBQ3JGLHdGQUF3RjtnQkFDeEYsSUFBSSxRQUFRLEdBQUcsVUFBVSxDQUFDLElBQUssQ0FBQztnQkFDaEMsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLEdBQUcsQ0FBQyxhQUFhLEVBQUU7b0JBQ2hFLFFBQVEsRUFBRSxDQUFDO2lCQUNaO2dCQUNELE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQzthQUNoQztZQUVELElBQUksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtpQkFBTSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO2dCQUMzQixNQUFNLElBQUksS0FBSyxDQUNYLHlGQUF5RixDQUFDLENBQUM7YUFDaEc7WUFFRCxVQUFVLEdBQUcsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDL0I7UUFFRCw4RkFBOEY7UUFDOUYsNEZBQTRGO1FBQzVGLHdDQUF3QztRQUN4QyxFQUFFO1FBQ0YsOEZBQThGO1FBQzlGLElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztRQUNwQixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDeEMsaUVBQWlFO2dCQUNqRSxTQUFTO2FBQ1Y7aUJBQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUNsQyw0RkFBNEY7Z0JBQzVGLGlCQUFpQjtnQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7YUFDbkY7WUFFRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUUsQ0FBQztZQUVyQyw2Q0FBNkM7WUFDN0MsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFO2dCQUN4Qiw0REFBNEQ7Z0JBQzVELE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxXQUFXLENBQUM7Z0JBQ2pDLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtvQkFDYixNQUFNLElBQUksS0FBSyxDQUFDLGtFQUFrRSxDQUFDLENBQUM7aUJBQ3JGO2dCQUVELEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUNsQixFQUFFLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRyxFQUFxQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUN0RixXQUFXLEdBQUcsSUFBSSxDQUFDO2FBQ3BCO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHR5cGUge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogR2VuZXJhdGUgYGlyLkFkdmFuY2VPcGBzIGluIGJldHdlZW4gYGlyLlVwZGF0ZU9wYHMgdGhhdCBlbnN1cmUgdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90XG4gKiBjb250ZXh0IHdpbGwgYmUgYWR2YW5jZWQgY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGhhc2VHZW5lcmF0ZUFkdmFuY2Uoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgLy8gRmlyc3QgYnVpbGQgYSBtYXAgb2YgYWxsIG9mIHRoZSBkZWNsYXJhdGlvbnMgaW4gdGhlIHZpZXcgdGhhdCBoYXZlIGFzc2lnbmVkIHNsb3RzLlxuICAgIGNvbnN0IHNsb3RNYXAgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyPigpO1xuICAgIGxldCBsYXN0U2xvdE9wID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICAvLyBGb3IgaTE4biBibG9ja3MsIHdlIHdhbnQgdG8gYWR2YW5jZSB0byB0aGUgbGFzdCBlbGVtZW50IGluZGV4IGluIHRoZSBibG9jayBiZWZvcmUgaW52b2tpbmdcbiAgICAgIC8vIGBpMThuRXhwYCBpbnN0cnVjdGlvbnMsIHRvIG1ha2Ugc3VyZSB0aGUgbmVjZXNzYXJ5IGxpZmVjeWNsZSBob29rcyBvZiBjb21wb25lbnRzL2RpcmVjdGl2ZXNcbiAgICAgIC8vIGFyZSBwcm9wZXJseSBmbHVzaGVkLlxuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRW5kKSB7XG4gICAgICAgIGlmIChsYXN0U2xvdE9wID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ0V4cGVjdGVkIHRvIGhhdmUgZW5jb3VudGVyZWQgYW4gb3AgcHJpb3IgdG8gaTE4bkVuZCB0aGF0IGNvbnN1bWVzIGEgc2xvdCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRPRE8obW1hbGVyYmEpOiBGb3IgZW1wdHkgaTE4biBibG9ja3MsIHdlIG1vdmUgdG8gdGhlIG5leHQgc2xvdCB0byBtYXRjaFxuICAgICAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLiBUaGlzIHNlZW1zIGxpa2UganVzdCBhIHF1aXJrIHJlc3VsdGluZyBmcm9tIHRoZSBzcGVjaWFsXG4gICAgICAgIC8vIGhhbmRsaW5nIG9mIGkxOG4gYmxvY2tzIHRoYXQgY2FuIGJlIHJlbW92ZWQgd2hlbiBjb21wYXRpYmlsaXR5IGlzIG5vIGxvbmdlciByZXF1aXJlZC5cbiAgICAgICAgbGV0IGxhc3RTbG90ID0gbGFzdFNsb3RPcC5zbG90ITtcbiAgICAgICAgaWYgKGxhc3RTbG90T3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCAmJiBqb2IuY29tcGF0aWJpbGl0eSkge1xuICAgICAgICAgIGxhc3RTbG90Kys7XG4gICAgICAgIH1cbiAgICAgICAgc2xvdE1hcC5zZXQob3AueHJlZiwgbGFzdFNsb3QpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlyLmhhc0NvbnN1bWVzU2xvdFRyYWl0KG9wKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH0gZWxzZSBpZiAob3Auc2xvdCA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQXNzZXJ0aW9uRXJyb3I6IGV4cGVjdGVkIHNsb3RzIHRvIGhhdmUgYmVlbiBhbGxvY2F0ZWQgYmVmb3JlIGdlbmVyYXRpbmcgYWR2YW5jZSgpIGNhbGxzYCk7XG4gICAgICB9XG5cbiAgICAgIGxhc3RTbG90T3AgPSBvcDtcbiAgICAgIHNsb3RNYXAuc2V0KG9wLnhyZWYsIG9wLnNsb3QpO1xuICAgIH1cblxuICAgIC8vIE5leHQsIHN0ZXAgdGhyb3VnaCB0aGUgdXBkYXRlIG9wZXJhdGlvbnMgYW5kIGdlbmVyYXRlIGBpci5BZHZhbmNlT3BgcyBhcyByZXF1aXJlZCB0byBlbnN1cmVcbiAgICAvLyB0aGUgcnVudGltZSdzIGltcGxpY2l0IHNsb3QgY291bnRlciB3aWxsIGJlIHNldCB0byB0aGUgY29ycmVjdCBzbG90IGJlZm9yZSBleGVjdXRpbmcgZWFjaFxuICAgIC8vIHVwZGF0ZSBvcGVyYXRpb24gd2hpY2ggZGVwZW5kcyBvbiBpdC5cbiAgICAvL1xuICAgIC8vIFRvIGRvIHRoYXQsIHdlIHRyYWNrIHdoYXQgdGhlIHJ1bnRpbWUncyBzbG90IGNvdW50ZXIgd2lsbCBiZSB0aHJvdWdoIHRoZSB1cGRhdGUgb3BlcmF0aW9ucy5cbiAgICBsZXQgc2xvdENvbnRleHQgPSAwO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlmICghaXIuaGFzRGVwZW5kc09uU2xvdENvbnRleHRUcmFpdChvcCkpIHtcbiAgICAgICAgLy8gYG9wYCBkb2Vzbid0IGRlcGVuZCBvbiB0aGUgc2xvdCBjb3VudGVyLCBzbyBpdCBjYW4gYmUgc2tpcHBlZC5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9IGVsc2UgaWYgKCFzbG90TWFwLmhhcyhvcC50YXJnZXQpKSB7XG4gICAgICAgIC8vIFdlIGV4cGVjdCBvcHMgdGhhdCBfZG9fIGRlcGVuZCBvbiB0aGUgc2xvdCBjb3VudGVyIHRvIHBvaW50IGF0IGRlY2xhcmF0aW9ucyB0aGF0IGV4aXN0IGluXG4gICAgICAgIC8vIHRoZSBgc2xvdE1hcGAuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uRXJyb3I6IHJlZmVyZW5jZSB0byB1bmtub3duIHNsb3QgZm9yIHZhciAke29wLnRhcmdldH1gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2xvdCA9IHNsb3RNYXAuZ2V0KG9wLnRhcmdldCkhO1xuXG4gICAgICAvLyBEb2VzIHRoZSBzbG90IGNvdW50ZXIgbmVlZCB0byBiZSBhZGp1c3RlZD9cbiAgICAgIGlmIChzbG90Q29udGV4dCAhPT0gc2xvdCkge1xuICAgICAgICAvLyBJZiBzbywgZ2VuZXJhdGUgYW4gYGlyLkFkdmFuY2VPcGAgdG8gYWR2YW5jZSB0aGUgY291bnRlci5cbiAgICAgICAgY29uc3QgZGVsdGEgPSBzbG90IC0gc2xvdENvbnRleHQ7XG4gICAgICAgIGlmIChkZWx0YSA8IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBzbG90IGNvdW50ZXIgc2hvdWxkIG5ldmVyIG5lZWQgdG8gbW92ZSBiYWNrd2FyZHNgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlyLk9wTGlzdC5pbnNlcnRCZWZvcmU8aXIuVXBkYXRlT3A+KFxuICAgICAgICAgICAgaXIuY3JlYXRlQWR2YW5jZU9wKGRlbHRhLCAob3AgYXMgaXIuRGVwZW5kc09uU2xvdENvbnRleHRPcFRyYWl0KS5zb3VyY2VTcGFuKSwgb3ApO1xuICAgICAgICBzbG90Q29udGV4dCA9IHNsb3Q7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=