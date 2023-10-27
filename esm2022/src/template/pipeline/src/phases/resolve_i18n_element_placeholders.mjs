/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ir from '../../ir';
/**
 * Resolve the element placeholders in i18n messages.
 */
export function phaseResolveI18nElementPlaceholders(job) {
    // Record all of the element and extracted message ops for use later.
    const extractedMessageOps = new Map();
    const elements = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.ExtractedMessage:
                    extractedMessageOps.set(op.owner, op);
                    break;
                case ir.OpKind.ElementStart:
                    elements.set(op.xref, op);
                    break;
            }
        }
    }
    for (const unit of job.units) {
        // Track the current i18n op and corresponding extracted message op as we step through the
        // creation IR.
        let currentOps = null;
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    if (!extractedMessageOps.has(op.xref)) {
                        throw Error('Could not find extracted message for i18n op');
                    }
                    currentOps = { i18n: op, extractedMessage: extractedMessageOps.get(op.xref) };
                    break;
                case ir.OpKind.I18nEnd:
                    currentOps = null;
                    break;
                case ir.OpKind.ElementStart:
                    // For elements with i18n placeholders, record its slot value in the params map under the
                    // corresponding tag start placeholder.
                    if (op.i18nPlaceholder !== undefined) {
                        if (currentOps === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        const { startName, closeName } = op.i18nPlaceholder;
                        let flags = ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.OpenTag;
                        // For self-closing tags, there is no close tag placeholder. Instead, the start tag
                        // placeholder accounts for the start and close of the element.
                        if (closeName === '') {
                            flags |= ir.I18nParamValueFlags.CloseTag;
                        }
                        addParam(currentOps.extractedMessage.params, startName, op.slot, currentOps.i18n.subTemplateIndex, flags);
                    }
                    break;
                case ir.OpKind.ElementEnd:
                    // For elements with i18n placeholders, record its slot value in the params map under the
                    // corresponding tag close placeholder.
                    const startOp = elements.get(op.xref);
                    if (startOp && startOp.i18nPlaceholder !== undefined) {
                        if (currentOps === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        const { closeName } = startOp.i18nPlaceholder;
                        // Self-closing tags don't have a closing tag placeholder.
                        if (closeName !== '') {
                            addParam(currentOps.extractedMessage.params, closeName, startOp.slot, currentOps.i18n.subTemplateIndex, ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.CloseTag);
                        }
                    }
                    break;
                case ir.OpKind.Template:
                    // For templates with i18n placeholders, record its slot value in the params map under the
                    // corresponding template start and close placeholders.
                    if (op.i18nPlaceholder !== undefined) {
                        if (currentOps === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        const subTemplateIndex = getSubTemplateIndexForTemplateTag(job, currentOps.i18n, op);
                        addParam(currentOps.extractedMessage.params, op.i18nPlaceholder.startName, op.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag);
                        addParam(currentOps.extractedMessage.params, op.i18nPlaceholder.closeName, op.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.CloseTag);
                    }
                    break;
            }
        }
    }
}
/**
 * Get the subTemplateIndex for the given template op. For template ops, use the subTemplateIndex of
 * the child i18n block inside the template.
 */
function getSubTemplateIndexForTemplateTag(job, i18nOp, op) {
    for (const childOp of job.views.get(op.xref).create) {
        if (childOp.kind === ir.OpKind.I18nStart) {
            return childOp.subTemplateIndex;
        }
    }
    return i18nOp.subTemplateIndex;
}
/** Add a param value to the given params map. */
function addParam(params, placeholder, value, subTemplateIndex, flags = ir.I18nParamValueFlags.None) {
    const values = params.get(placeholder) ?? [];
    values.push({ value, subTemplateIndex, flags });
    params.set(placeholder, values);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUFDLEdBQTRCO0lBQzlFLHFFQUFxRTtJQUNyRSxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO0lBQ3hFLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxFQUFnQyxDQUFDO0lBQ3pELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0I7b0JBQzdCLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUN0QyxNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZO29CQUN6QixRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzFCLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsMEZBQTBGO1FBQzFGLGVBQWU7UUFDZixJQUFJLFVBQVUsR0FBeUUsSUFBSSxDQUFDO1FBRTVGLEtBQUssTUFB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QUFDLEVBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7SUFDOUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgZWxlbWVudCBwbGFjZWhvbGRlcnMgaW4gaTE4biBtZXNzYWdlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVzb2x2ZUkxOG5FbGVtZW50UGxhY2Vob2xkZXJzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgLy8gUmVjb3JkIGFsbCBvZiB0aGUgZWxlbWVudCBhbmQgZXh0cmFjdGVkIG1lc3NhZ2Ugb3BzIGZvciB1c2UgbGF0ZXIuXG4gIGNvbnN0IGV4dHJhY3RlZE1lc3NhZ2VPcHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRXh0cmFjdGVkTWVzc2FnZU9wPigpO1xuICBjb25zdCBlbGVtZW50cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5FbGVtZW50U3RhcnRPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FeHRyYWN0ZWRNZXNzYWdlOlxuICAgICAgICAgIGV4dHJhY3RlZE1lc3NhZ2VPcHMuc2V0KG9wLm93bmVyLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgICAgICBlbGVtZW50cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBUcmFjayB0aGUgY3VycmVudCBpMThuIG9wIGFuZCBjb3JyZXNwb25kaW5nIGV4dHJhY3RlZCBtZXNzYWdlIG9wIGFzIHdlIHN0ZXAgdGhyb3VnaCB0aGVcbiAgICAvLyBjcmVhdGlvbiBJUi5cbiAgICBsZXQgY3VycmVudE9wczoge2kxOG46IGlyLkkxOG5TdGFydE9wLCBleHRyYWN0ZWRNZXNzYWdlOiBpci5FeHRyYWN0ZWRNZXNzYWdlT3B9fG51bGwgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBpZiAoIWV4dHJhY3RlZE1lc3NhZ2VPcHMuaGFzKG9wLnhyZWYpKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignQ291bGQgbm90IGZpbmQgZXh0cmFjdGVkIG1lc3NhZ2UgZm9yIGkxOG4gb3AnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3VycmVudE9wcyA9IHtpMThuOiBvcCwgZXh0cmFjdGVkTWVzc2FnZTogZXh0cmFjdGVkTWVzc2FnZU9wcy5nZXQob3AueHJlZikhfTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBjdXJyZW50T3BzID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICAgIC8vIEZvciBlbGVtZW50cyB3aXRoIGkxOG4gcGxhY2Vob2xkZXJzLCByZWNvcmQgaXRzIHNsb3QgdmFsdWUgaW4gdGhlIHBhcmFtcyBtYXAgdW5kZXIgdGhlXG4gICAgICAgICAgLy8gY29ycmVzcG9uZGluZyB0YWcgc3RhcnQgcGxhY2Vob2xkZXIuXG4gICAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudE9wcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHtzdGFydE5hbWUsIGNsb3NlTmFtZX0gPSBvcC5pMThuUGxhY2Vob2xkZXI7XG4gICAgICAgICAgICBsZXQgZmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkVsZW1lbnRUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWc7XG4gICAgICAgICAgICAvLyBGb3Igc2VsZi1jbG9zaW5nIHRhZ3MsIHRoZXJlIGlzIG5vIGNsb3NlIHRhZyBwbGFjZWhvbGRlci4gSW5zdGVhZCwgdGhlIHN0YXJ0IHRhZ1xuICAgICAgICAgICAgLy8gcGxhY2Vob2xkZXIgYWNjb3VudHMgZm9yIHRoZSBzdGFydCBhbmQgY2xvc2Ugb2YgdGhlIGVsZW1lbnQuXG4gICAgICAgICAgICBpZiAoY2xvc2VOYW1lID09PSAnJykge1xuICAgICAgICAgICAgICBmbGFncyB8PSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgY3VycmVudE9wcy5leHRyYWN0ZWRNZXNzYWdlLnBhcmFtcywgc3RhcnROYW1lLCBvcC5zbG90ISxcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG4uc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGFnIGNsb3NlIHBsYWNlaG9sZGVyLlxuICAgICAgICAgIGNvbnN0IHN0YXJ0T3AgPSBlbGVtZW50cy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKHN0YXJ0T3AgJiYgc3RhcnRPcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7Y2xvc2VOYW1lfSA9IHN0YXJ0T3AuaTE4blBsYWNlaG9sZGVyO1xuICAgICAgICAgICAgLy8gU2VsZi1jbG9zaW5nIHRhZ3MgZG9uJ3QgaGF2ZSBhIGNsb3NpbmcgdGFnIHBsYWNlaG9sZGVyLlxuICAgICAgICAgICAgaWYgKGNsb3NlTmFtZSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmV4dHJhY3RlZE1lc3NhZ2UhLnBhcmFtcywgY2xvc2VOYW1lLCBzdGFydE9wLnNsb3QhLFxuICAgICAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuLnN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgICAgICAgICBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkVsZW1lbnRUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICAgIC8vIEZvciB0ZW1wbGF0ZXMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGVtcGxhdGUgc3RhcnQgYW5kIGNsb3NlIHBsYWNlaG9sZGVycy5cbiAgICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3ViVGVtcGxhdGVJbmRleCA9IGdldFN1YlRlbXBsYXRlSW5kZXhGb3JUZW1wbGF0ZVRhZyhqb2IsIGN1cnJlbnRPcHMuaTE4biwgb3ApO1xuICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgY3VycmVudE9wcy5leHRyYWN0ZWRNZXNzYWdlLnBhcmFtcywgb3AuaTE4blBsYWNlaG9sZGVyLnN0YXJ0TmFtZSwgb3Auc2xvdCEsXG4gICAgICAgICAgICAgICAgc3ViVGVtcGxhdGVJbmRleCwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZyk7XG4gICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmV4dHJhY3RlZE1lc3NhZ2UucGFyYW1zLCBvcC5pMThuUGxhY2Vob2xkZXIuY2xvc2VOYW1lLCBvcC5zbG90ISxcbiAgICAgICAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4LFxuICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2V0IHRoZSBzdWJUZW1wbGF0ZUluZGV4IGZvciB0aGUgZ2l2ZW4gdGVtcGxhdGUgb3AuIEZvciB0ZW1wbGF0ZSBvcHMsIHVzZSB0aGUgc3ViVGVtcGxhdGVJbmRleCBvZlxuICogdGhlIGNoaWxkIGkxOG4gYmxvY2sgaW5zaWRlIHRoZSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGkxOG5PcDogaXIuSTE4blN0YXJ0T3AsIG9wOiBpci5UZW1wbGF0ZU9wKTogbnVtYmVyfG51bGwge1xuICBmb3IgKGNvbnN0IGNoaWxkT3Agb2Ygam9iLnZpZXdzLmdldChvcC54cmVmKSEuY3JlYXRlKSB7XG4gICAgaWYgKGNoaWxkT3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgcmV0dXJuIGNoaWxkT3Auc3ViVGVtcGxhdGVJbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkxOG5PcC5zdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKiogQWRkIGEgcGFyYW0gdmFsdWUgdG8gdGhlIGdpdmVuIHBhcmFtcyBtYXAuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+LCBwbGFjZWhvbGRlcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bWJlcixcbiAgICBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCwgZmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmUpIHtcbiAgY29uc3QgdmFsdWVzID0gcGFyYW1zLmdldChwbGFjZWhvbGRlcikgPz8gW107XG4gIHZhbHVlcy5wdXNoKHt2YWx1ZSwgc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3N9KTtcbiAgcGFyYW1zLnNldChwbGFjZWhvbGRlciwgdmFsdWVzKTtcbn1cbiJdfQ==