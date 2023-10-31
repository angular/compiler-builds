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
                        addParam(currentOps.extractedMessage.params, startName, op.slot.slot, currentOps.i18n.subTemplateIndex, flags);
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
                            addParam(currentOps.extractedMessage.params, closeName, startOp.slot.slot, currentOps.i18n.subTemplateIndex, ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.CloseTag);
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
                        addParam(currentOps.extractedMessage.params, op.i18nPlaceholder.startName, op.slot.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag);
                        addParam(currentOps.extractedMessage.params, op.i18nPlaceholder.closeName, op.slot.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.CloseTag);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUFDLEdBQTRCO0lBQzlFLHFFQUFxRTtJQUNyRSxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO0lBQ3hFLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxFQUFnQyxDQUFDO0lBQ3pELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0I7b0JBQzdCLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUN0QyxNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZO29CQUN6QixRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzFCLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsMEZBQTBGO1FBQzFGLGVBQWU7UUFDZixJQUFJLFVBQVUsR0FBeUUsSUFBSSxDQUFDO1FBRTVGLEtBQUssTUFB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QUMsSUFBSSxFQUFFLENBQUM7SUFDN0MsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO0lBQzlDLE1BQU0sQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIGVsZW1lbnQgcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVJlc29sdmVJMThuRWxlbWVudFBsYWNlaG9sZGVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gIC8vIFJlY29yZCBhbGwgb2YgdGhlIGVsZW1lbnQgYW5kIGV4dHJhY3RlZCBtZXNzYWdlIG9wcyBmb3IgdXNlIGxhdGVyLlxuICBjb25zdCBleHRyYWN0ZWRNZXNzYWdlT3BzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkV4dHJhY3RlZE1lc3NhZ2VPcD4oKTtcbiAgY29uc3QgZWxlbWVudHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudFN0YXJ0T3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRXh0cmFjdGVkTWVzc2FnZTpcbiAgICAgICAgICBleHRyYWN0ZWRNZXNzYWdlT3BzLnNldChvcC5vd25lciwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgICAgZWxlbWVudHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgLy8gVHJhY2sgdGhlIGN1cnJlbnQgaTE4biBvcCBhbmQgY29ycmVzcG9uZGluZyBleHRyYWN0ZWQgbWVzc2FnZSBvcCBhcyB3ZSBzdGVwIHRocm91Z2ggdGhlXG4gICAgLy8gY3JlYXRpb24gSVIuXG4gICAgbGV0IGN1cnJlbnRPcHM6IHtpMThuOiBpci5JMThuU3RhcnRPcCwgZXh0cmFjdGVkTWVzc2FnZTogaXIuRXh0cmFjdGVkTWVzc2FnZU9wfXxudWxsID0gbnVsbDtcblxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgaWYgKCFleHRyYWN0ZWRNZXNzYWdlT3BzLmhhcyhvcC54cmVmKSkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGV4dHJhY3RlZCBtZXNzYWdlIGZvciBpMThuIG9wJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRPcHMgPSB7aTE4bjogb3AsIGV4dHJhY3RlZE1lc3NhZ2U6IGV4dHJhY3RlZE1lc3NhZ2VPcHMuZ2V0KG9wLnhyZWYpIX07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudE9wcyA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGFnIHN0YXJ0IHBsYWNlaG9sZGVyLlxuICAgICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7c3RhcnROYW1lLCBjbG9zZU5hbWV9ID0gb3AuaTE4blBsYWNlaG9sZGVyO1xuICAgICAgICAgICAgbGV0IGZsYWdzID0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnO1xuICAgICAgICAgICAgLy8gRm9yIHNlbGYtY2xvc2luZyB0YWdzLCB0aGVyZSBpcyBubyBjbG9zZSB0YWcgcGxhY2Vob2xkZXIuIEluc3RlYWQsIHRoZSBzdGFydCB0YWdcbiAgICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIGFjY291bnRzIGZvciB0aGUgc3RhcnQgYW5kIGNsb3NlIG9mIHRoZSBlbGVtZW50LlxuICAgICAgICAgICAgaWYgKGNsb3NlTmFtZSA9PT0gJycpIHtcbiAgICAgICAgICAgICAgZmxhZ3MgfD0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuZXh0cmFjdGVkTWVzc2FnZS5wYXJhbXMsIHN0YXJ0TmFtZSwgb3Auc2xvdC5zbG90ISxcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG4uc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGFnIGNsb3NlIHBsYWNlaG9sZGVyLlxuICAgICAgICAgIGNvbnN0IHN0YXJ0T3AgPSBlbGVtZW50cy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKHN0YXJ0T3AgJiYgc3RhcnRPcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7Y2xvc2VOYW1lfSA9IHN0YXJ0T3AuaTE4blBsYWNlaG9sZGVyO1xuICAgICAgICAgICAgLy8gU2VsZi1jbG9zaW5nIHRhZ3MgZG9uJ3QgaGF2ZSBhIGNsb3NpbmcgdGFnIHBsYWNlaG9sZGVyLlxuICAgICAgICAgICAgaWYgKGNsb3NlTmFtZSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmV4dHJhY3RlZE1lc3NhZ2UhLnBhcmFtcywgY2xvc2VOYW1lLCBzdGFydE9wLnNsb3Quc2xvdCEsXG4gICAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG4uc3ViVGVtcGxhdGVJbmRleCxcbiAgICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgICAgLy8gRm9yIHRlbXBsYXRlcyB3aXRoIGkxOG4gcGxhY2Vob2xkZXJzLCByZWNvcmQgaXRzIHNsb3QgdmFsdWUgaW4gdGhlIHBhcmFtcyBtYXAgdW5kZXIgdGhlXG4gICAgICAgICAgLy8gY29ycmVzcG9uZGluZyB0ZW1wbGF0ZSBzdGFydCBhbmQgY2xvc2UgcGxhY2Vob2xkZXJzLlxuICAgICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzdWJUZW1wbGF0ZUluZGV4ID0gZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKGpvYiwgY3VycmVudE9wcy5pMThuLCBvcCk7XG4gICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmV4dHJhY3RlZE1lc3NhZ2UucGFyYW1zLCBvcC5pMThuUGxhY2Vob2xkZXIuc3RhcnROYW1lLCBvcC5zbG90LnNsb3QhLFxuICAgICAgICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXgsIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpO1xuICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgY3VycmVudE9wcy5leHRyYWN0ZWRNZXNzYWdlLnBhcmFtcywgb3AuaTE4blBsYWNlaG9sZGVyLmNsb3NlTmFtZSwgb3Auc2xvdC5zbG90ISxcbiAgICAgICAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4LFxuICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2V0IHRoZSBzdWJUZW1wbGF0ZUluZGV4IGZvciB0aGUgZ2l2ZW4gdGVtcGxhdGUgb3AuIEZvciB0ZW1wbGF0ZSBvcHMsIHVzZSB0aGUgc3ViVGVtcGxhdGVJbmRleCBvZlxuICogdGhlIGNoaWxkIGkxOG4gYmxvY2sgaW5zaWRlIHRoZSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGkxOG5PcDogaXIuSTE4blN0YXJ0T3AsIG9wOiBpci5UZW1wbGF0ZU9wKTogbnVtYmVyfG51bGwge1xuICBmb3IgKGNvbnN0IGNoaWxkT3Agb2Ygam9iLnZpZXdzLmdldChvcC54cmVmKSEuY3JlYXRlKSB7XG4gICAgaWYgKGNoaWxkT3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgcmV0dXJuIGNoaWxkT3Auc3ViVGVtcGxhdGVJbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkxOG5PcC5zdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKiogQWRkIGEgcGFyYW0gdmFsdWUgdG8gdGhlIGdpdmVuIHBhcmFtcyBtYXAuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+LCBwbGFjZWhvbGRlcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bWJlcixcbiAgICBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCwgZmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmUpIHtcbiAgY29uc3QgdmFsdWVzID0gcGFyYW1zLmdldChwbGFjZWhvbGRlcikgPz8gW107XG4gIHZhbHVlcy5wdXNoKHt2YWx1ZSwgc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3N9KTtcbiAgcGFyYW1zLnNldChwbGFjZWhvbGRlciwgdmFsdWVzKTtcbn1cbiJdfQ==