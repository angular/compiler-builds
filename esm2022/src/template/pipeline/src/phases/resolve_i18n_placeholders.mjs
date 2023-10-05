/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../../output/output_ast';
import * as ir from '../../ir';
/**
 * The escape sequence used indicate message param values.
 */
const ESCAPE = '\uFFFD';
/**
 * Resolve the placeholders in i18n messages.
 */
export function phaseResolveI18nPlaceholders(job) {
    for (const unit of job.units) {
        const i18nOps = new Map();
        let startTagSlots = new Map();
        let closeTagSlots = new Map();
        let currentI18nOp = null;
        // Record slots for tag name placeholders.
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                case ir.OpKind.I18n:
                    // Initialize collected slots for a new i18n block.
                    i18nOps.set(op.xref, op);
                    currentI18nOp = op.kind === ir.OpKind.I18nStart ? op : null;
                    startTagSlots = new Map();
                    closeTagSlots = new Map();
                    break;
                case ir.OpKind.I18nEnd:
                    // Add values for tag placeholders.
                    if (currentI18nOp === null) {
                        throw Error('Missing corresponding i18n start op for i18n end op');
                    }
                    for (const [placeholder, slots] of startTagSlots) {
                        currentI18nOp.params.set(placeholder, serializeSlots(slots, true));
                    }
                    for (const [placeholder, slots] of closeTagSlots) {
                        currentI18nOp.params.set(placeholder, serializeSlots(slots, false));
                    }
                    currentI18nOp = null;
                    break;
                case ir.OpKind.Element:
                case ir.OpKind.ElementStart:
                    // Record slots for tag placeholders.
                    if (op.i18nPlaceholder != undefined) {
                        if (currentI18nOp === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        if (!op.slot) {
                            throw Error('Slots should be allocated before i18n placeholder resolution');
                        }
                        const { startName, closeName } = op.i18nPlaceholder;
                        addTagSlot(startTagSlots, startName, op.slot);
                        addTagSlot(closeTagSlots, closeName, op.slot);
                    }
                    break;
            }
        }
        // Fill in values for each of the expression placeholders applied in i18nApply operations.
        const i18nBlockPlaceholderIndices = new Map();
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                const i18nOp = i18nOps.get(op.target);
                let index = i18nBlockPlaceholderIndices.get(op.target) || 0;
                if (!i18nOp) {
                    throw Error('Cannot find corresponding i18nStart for i18nExpr');
                }
                i18nOp.params.set(op.i18nPlaceholder.name, o.literal(`${ESCAPE}${index++}${ESCAPE}`));
                i18nBlockPlaceholderIndices.set(op.target, index);
            }
        }
        // Verify that all placeholders have been resolved.
        for (const op of i18nOps.values()) {
            for (const placeholder in op.message.placeholders) {
                if (!op.params.has(placeholder)) {
                    throw Error(`Failed to resolve i18n placeholder: ${placeholder}`);
                }
            }
        }
    }
}
/**
 * Updates the given slots map with the specified slot.
 */
function addTagSlot(tagSlots, placeholder, slot) {
    const slots = tagSlots.get(placeholder) || [];
    slots.push(slot);
    tagSlots.set(placeholder, slots);
}
/**
 * Serializes a list of slots to a string literal expression.
 */
function serializeSlots(slots, start) {
    const slotStrings = slots.map(slot => `${ESCAPE}${start ? '' : '/'}#${slot}${ESCAPE}`);
    if (slotStrings.length === 1) {
        return o.literal(slotStrings[0]);
    }
    return o.literal(`[${slotStrings.join('|')}]`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX3BsYWNlaG9sZGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfaTE4bl9wbGFjZWhvbGRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUV4Qjs7R0FFRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxHQUFtQjtJQUM5RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQXVDLENBQUM7UUFDL0QsSUFBSSxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQW9CLENBQUM7UUFDaEQsSUFBSSxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQW9CLENBQUM7UUFDaEQsSUFBSSxhQUFhLEdBQXdCLElBQUksQ0FBQztRQUU5QywwQ0FBMEM7UUFDMUMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO2dCQUN6QixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSTtvQkFDakIsbURBQW1EO29CQUNuRCxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3pCLGFBQWEsR0FBRyxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxD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QU8sQ0FBQyxZQUFZLEVBQUU7Z0JBQ2pELElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtvQkFDL0IsTUFBTSxLQUFLLENBQUMsdUNBQXVDLFdBQVcsRUFBRSxDQUFDLENBQUM7aUJBQ25FO2FBQ0Y7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxVQUFVLENBQUMsUUFBK0IsRUFBRSxXQUFtQixFQUFFLElBQVk7SUFDcEYsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDOUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqQixRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNuQyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGNBQWMsQ0FBQyxLQUFlLEVBQUUsS0FBYztJQUNyRCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLEdBQUcsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUN2RixJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQzVCLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNsQztJQUNELE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogVGhlIGVzY2FwZSBzZXF1ZW5jZSB1c2VkIGluZGljYXRlIG1lc3NhZ2UgcGFyYW0gdmFsdWVzLlxuICovXG5jb25zdCBFU0NBUEUgPSAnXFx1RkZGRCc7XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVJlc29sdmVJMThuUGxhY2Vob2xkZXJzKGpvYjogQ29tcGlsYXRpb25Kb2IpIHtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGNvbnN0IGkxOG5PcHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bk9wfGlyLkkxOG5TdGFydE9wPigpO1xuICAgIGxldCBzdGFydFRhZ1Nsb3RzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcltdPigpO1xuICAgIGxldCBjbG9zZVRhZ1Nsb3RzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcltdPigpO1xuICAgIGxldCBjdXJyZW50STE4bk9wOiBpci5JMThuU3RhcnRPcHxudWxsID0gbnVsbDtcblxuICAgIC8vIFJlY29yZCBzbG90cyBmb3IgdGFnIG5hbWUgcGxhY2Vob2xkZXJzLlxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG46XG4gICAgICAgICAgLy8gSW5pdGlhbGl6ZSBjb2xsZWN0ZWQgc2xvdHMgZm9yIGEgbmV3IGkxOG4gYmxvY2suXG4gICAgICAgICAgaTE4bk9wcy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBvcC5raW5kID09PSBpci5PcEtpbmQuSTE4blN0YXJ0ID8gb3AgOiBudWxsO1xuICAgICAgICAgIHN0YXJ0VGFnU2xvdHMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgY2xvc2VUYWdTbG90cyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICAvLyBBZGQgdmFsdWVzIGZvciB0YWcgcGxhY2Vob2xkZXJzLlxuICAgICAgICAgIGlmIChjdXJyZW50STE4bk9wID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignTWlzc2luZyBjb3JyZXNwb25kaW5nIGkxOG4gc3RhcnQgb3AgZm9yIGkxOG4gZW5kIG9wJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCBzbG90c10gb2Ygc3RhcnRUYWdTbG90cykge1xuICAgICAgICAgICAgY3VycmVudEkxOG5PcC5wYXJhbXMuc2V0KHBsYWNlaG9sZGVyLCBzZXJpYWxpemVTbG90cyhzbG90cywgdHJ1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgc2xvdHNdIG9mIGNsb3NlVGFnU2xvdHMpIHtcbiAgICAgICAgICAgIGN1cnJlbnRJMThuT3AucGFyYW1zLnNldChwbGFjZWhvbGRlciwgc2VyaWFsaXplU2xvdHMoc2xvdHMsIGZhbHNlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRJMThuT3AgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50OlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgICAgLy8gUmVjb3JkIHNsb3RzIGZvciB0YWcgcGxhY2Vob2xkZXJzLlxuICAgICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudEkxOG5PcCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghb3Auc2xvdCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignU2xvdHMgc2hvdWxkIGJlIGFsbG9jYXRlZCBiZWZvcmUgaTE4biBwbGFjZWhvbGRlciByZXNvbHV0aW9uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7c3RhcnROYW1lLCBjbG9zZU5hbWV9ID0gb3AuaTE4blBsYWNlaG9sZGVyO1xuICAgICAgICAgICAgYWRkVGFnU2xvdChzdGFydFRhZ1Nsb3RzLCBzdGFydE5hbWUsIG9wLnNsb3QpO1xuICAgICAgICAgICAgYWRkVGFnU2xvdChjbG9zZVRhZ1Nsb3RzLCBjbG9zZU5hbWUsIG9wLnNsb3QpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGaWxsIGluIHZhbHVlcyBmb3IgZWFjaCBvZiB0aGUgZXhwcmVzc2lvbiBwbGFjZWhvbGRlcnMgYXBwbGllZCBpbiBpMThuQXBwbHkgb3BlcmF0aW9ucy5cbiAgICBjb25zdCBpMThuQmxvY2tQbGFjZWhvbGRlckluZGljZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgbnVtYmVyPigpO1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC51cGRhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4bkV4cHJlc3Npb24pIHtcbiAgICAgICAgY29uc3QgaTE4bk9wID0gaTE4bk9wcy5nZXQob3AudGFyZ2V0KTtcbiAgICAgICAgbGV0IGluZGV4ID0gaTE4bkJsb2NrUGxhY2Vob2xkZXJJbmRpY2VzLmdldChvcC50YXJnZXQpIHx8IDA7XG4gICAgICAgIGlmICghaTE4bk9wKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ0Nhbm5vdCBmaW5kIGNvcnJlc3BvbmRpbmcgaTE4blN0YXJ0IGZvciBpMThuRXhwcicpO1xuICAgICAgICB9XG4gICAgICAgIGkxOG5PcC5wYXJhbXMuc2V0KG9wLmkxOG5QbGFjZWhvbGRlci5uYW1lLCBvLmxpdGVyYWwoYCR7RVNDQVBFfSR7aW5kZXgrK30ke0VTQ0FQRX1gKSk7XG4gICAgICAgIGkxOG5CbG9ja1BsYWNlaG9sZGVySW5kaWNlcy5zZXQob3AudGFyZ2V0LCBpbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVmVyaWZ5IHRoYXQgYWxsIHBsYWNlaG9sZGVycyBoYXZlIGJlZW4gcmVzb2x2ZWQuXG4gICAgZm9yIChjb25zdCBvcCBvZiBpMThuT3BzLnZhbHVlcygpKSB7XG4gICAgICBmb3IgKGNvbnN0IHBsYWNlaG9sZGVyIGluIG9wLm1lc3NhZ2UucGxhY2Vob2xkZXJzKSB7XG4gICAgICAgIGlmICghb3AucGFyYW1zLmhhcyhwbGFjZWhvbGRlcikpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcihgRmFpbGVkIHRvIHJlc29sdmUgaTE4biBwbGFjZWhvbGRlcjogJHtwbGFjZWhvbGRlcn1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFVwZGF0ZXMgdGhlIGdpdmVuIHNsb3RzIG1hcCB3aXRoIHRoZSBzcGVjaWZpZWQgc2xvdC5cbiAqL1xuZnVuY3Rpb24gYWRkVGFnU2xvdCh0YWdTbG90czogTWFwPHN0cmluZywgbnVtYmVyW10+LCBwbGFjZWhvbGRlcjogc3RyaW5nLCBzbG90OiBudW1iZXIpIHtcbiAgY29uc3Qgc2xvdHMgPSB0YWdTbG90cy5nZXQocGxhY2Vob2xkZXIpIHx8IFtdO1xuICBzbG90cy5wdXNoKHNsb3QpO1xuICB0YWdTbG90cy5zZXQocGxhY2Vob2xkZXIsIHNsb3RzKTtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemVzIGEgbGlzdCBvZiBzbG90cyB0byBhIHN0cmluZyBsaXRlcmFsIGV4cHJlc3Npb24uXG4gKi9cbmZ1bmN0aW9uIHNlcmlhbGl6ZVNsb3RzKHNsb3RzOiBudW1iZXJbXSwgc3RhcnQ6IGJvb2xlYW4pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBzbG90U3RyaW5ncyA9IHNsb3RzLm1hcChzbG90ID0+IGAke0VTQ0FQRX0ke3N0YXJ0ID8gJycgOiAnLyd9IyR7c2xvdH0ke0VTQ0FQRX1gKTtcbiAgaWYgKHNsb3RTdHJpbmdzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBvLmxpdGVyYWwoc2xvdFN0cmluZ3NbMF0pO1xuICB9XG4gIHJldHVybiBvLmxpdGVyYWwoYFske3Nsb3RTdHJpbmdzLmpvaW4oJ3wnKX1dYCk7XG59XG4iXX0=