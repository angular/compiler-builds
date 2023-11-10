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
export function resolveI18nElementPlaceholders(job) {
    // Record all of the element and i18n context ops for use later.
    const i18nContexts = new Map();
    const elements = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nContext:
                    i18nContexts.set(op.xref, op);
                    break;
                case ir.OpKind.ElementStart:
                    elements.set(op.xref, op);
                    break;
            }
        }
    }
    for (const unit of job.units) {
        // Track the current i18n op and corresponding i18n context op as we step through the creation
        // IR.
        let currentOps = null;
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    if (!op.context) {
                        throw Error('Could not find i18n context for i18n op');
                    }
                    currentOps = { i18nBlock: op, i18nContext: i18nContexts.get(op.context) };
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
                        addParam(currentOps.i18nContext.params, startName, op.handle.slot, currentOps.i18nBlock.subTemplateIndex, flags);
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
                            addParam(currentOps.i18nContext.params, closeName, startOp.handle.slot, currentOps.i18nBlock.subTemplateIndex, ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.CloseTag);
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
                        const subTemplateIndex = getSubTemplateIndexForTemplateTag(job, currentOps.i18nBlock, op);
                        addParam(currentOps.i18nContext.params, op.i18nPlaceholder.startName, op.handle.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag);
                        addParam(currentOps.i18nContext.params, op.i18nPlaceholder.closeName, op.handle.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.CloseTag);
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
function addParam(params, placeholder, value, subTemplateIndex, flags) {
    const values = params.get(placeholder) ?? [];
    values.push({ value, subTemplateIndex, flags });
    params.set(placeholder, values);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQTRCO0lBQ3pFLGdFQUFnRTtJQUNoRSxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM1RCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7b0JBQ3hCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWTtvQkFDekIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUMxQixNQUFNO1lBQ1YsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsOEZBQThGO1FBQzlGLE1BQU07UUFDTixJQUFJLFVBQVUs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d0MsRUFBRSxXQUFtQixFQUFFLEtBQW9CLEVBQ25GLGdCQUE2QixFQUFFLEtBQTZCO0lBQzlELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzdDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFDLENBQUMsQ0FBQztJQUM5QyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNsQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBlbGVtZW50IHBsYWNlaG9sZGVycyBpbiBpMThuIG1lc3NhZ2VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUkxOG5FbGVtZW50UGxhY2Vob2xkZXJzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgLy8gUmVjb3JkIGFsbCBvZiB0aGUgZWxlbWVudCBhbmQgaTE4biBjb250ZXh0IG9wcyBmb3IgdXNlIGxhdGVyLlxuICBjb25zdCBpMThuQ29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4oKTtcbiAgY29uc3QgZWxlbWVudHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudFN0YXJ0T3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkNvbnRleHQ6XG4gICAgICAgICAgaTE4bkNvbnRleHRzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgICAgICBlbGVtZW50cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICAvLyBUcmFjayB0aGUgY3VycmVudCBpMThuIG9wIGFuZCBjb3JyZXNwb25kaW5nIGkxOG4gY29udGV4dCBvcCBhcyB3ZSBzdGVwIHRocm91Z2ggdGhlIGNyZWF0aW9uXG4gICAgLy8gSVIuXG4gICAgbGV0IGN1cnJlbnRPcHM6IHtpMThuQmxvY2s6IGlyLkkxOG5TdGFydE9wLCBpMThuQ29udGV4dDogaXIuSTE4bkNvbnRleHRPcH18bnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGlmICghb3AuY29udGV4dCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGkxOG4gY29udGV4dCBmb3IgaTE4biBvcCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjdXJyZW50T3BzID0ge2kxOG5CbG9jazogb3AsIGkxOG5Db250ZXh0OiBpMThuQ29udGV4dHMuZ2V0KG9wLmNvbnRleHQpIX07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudE9wcyA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGFnIHN0YXJ0IHBsYWNlaG9sZGVyLlxuICAgICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7c3RhcnROYW1lLCBjbG9zZU5hbWV9ID0gb3AuaTE4blBsYWNlaG9sZGVyO1xuICAgICAgICAgICAgbGV0IGZsYWdzID0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnO1xuICAgICAgICAgICAgLy8gRm9yIHNlbGYtY2xvc2luZyB0YWdzLCB0aGVyZSBpcyBubyBjbG9zZSB0YWcgcGxhY2Vob2xkZXIuIEluc3RlYWQsIHRoZSBzdGFydCB0YWdcbiAgICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIGFjY291bnRzIGZvciB0aGUgc3RhcnQgYW5kIGNsb3NlIG9mIHRoZSBlbGVtZW50LlxuICAgICAgICAgICAgaWYgKGNsb3NlTmFtZSA9PT0gJycpIHtcbiAgICAgICAgICAgICAgZmxhZ3MgfD0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQucGFyYW1zLCBzdGFydE5hbWUsIG9wLmhhbmRsZS5zbG90ISxcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG5CbG9jay5zdWJUZW1wbGF0ZUluZGV4LCBmbGFncyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50RW5kOlxuICAgICAgICAgIC8vIEZvciBlbGVtZW50cyB3aXRoIGkxOG4gcGxhY2Vob2xkZXJzLCByZWNvcmQgaXRzIHNsb3QgdmFsdWUgaW4gdGhlIHBhcmFtcyBtYXAgdW5kZXIgdGhlXG4gICAgICAgICAgLy8gY29ycmVzcG9uZGluZyB0YWcgY2xvc2UgcGxhY2Vob2xkZXIuXG4gICAgICAgICAgY29uc3Qgc3RhcnRPcCA9IGVsZW1lbnRzLmdldChvcC54cmVmKTtcbiAgICAgICAgICBpZiAoc3RhcnRPcCAmJiBzdGFydE9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudE9wcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHtjbG9zZU5hbWV9ID0gc3RhcnRPcC5pMThuUGxhY2Vob2xkZXI7XG4gICAgICAgICAgICAvLyBTZWxmLWNsb3NpbmcgdGFncyBkb24ndCBoYXZlIGEgY2xvc2luZyB0YWcgcGxhY2Vob2xkZXIuXG4gICAgICAgICAgICBpZiAoY2xvc2VOYW1lICE9PSAnJykge1xuICAgICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQucGFyYW1zLCBjbG9zZU5hbWUsIHN0YXJ0T3AuaGFuZGxlLnNsb3QhLFxuICAgICAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQmxvY2suc3ViVGVtcGxhdGVJbmRleCxcbiAgICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuVGVtcGxhdGU6XG4gICAgICAgICAgLy8gRm9yIHRlbXBsYXRlcyB3aXRoIGkxOG4gcGxhY2Vob2xkZXJzLCByZWNvcmQgaXRzIHNsb3QgdmFsdWUgaW4gdGhlIHBhcmFtcyBtYXAgdW5kZXIgdGhlXG4gICAgICAgICAgLy8gY29ycmVzcG9uZGluZyB0ZW1wbGF0ZSBzdGFydCBhbmQgY2xvc2UgcGxhY2Vob2xkZXJzLlxuICAgICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzdWJUZW1wbGF0ZUluZGV4ID1cbiAgICAgICAgICAgICAgICBnZXRTdWJUZW1wbGF0ZUluZGV4Rm9yVGVtcGxhdGVUYWcoam9iLCBjdXJyZW50T3BzLmkxOG5CbG9jaywgb3ApO1xuICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQ29udGV4dC5wYXJhbXMsIG9wLmkxOG5QbGFjZWhvbGRlci5zdGFydE5hbWUsIG9wLmhhbmRsZS5zbG90ISxcbiAgICAgICAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4LCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnKTtcbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQucGFyYW1zLCBvcC5pMThuUGxhY2Vob2xkZXIuY2xvc2VOYW1lLCBvcC5oYW5kbGUuc2xvdCEsXG4gICAgICAgICAgICAgICAgc3ViVGVtcGxhdGVJbmRleCxcbiAgICAgICAgICAgICAgICBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdldCB0aGUgc3ViVGVtcGxhdGVJbmRleCBmb3IgdGhlIGdpdmVuIHRlbXBsYXRlIG9wLiBGb3IgdGVtcGxhdGUgb3BzLCB1c2UgdGhlIHN1YlRlbXBsYXRlSW5kZXggb2ZcbiAqIHRoZSBjaGlsZCBpMThuIGJsb2NrIGluc2lkZSB0aGUgdGVtcGxhdGUuXG4gKi9cbmZ1bmN0aW9uIGdldFN1YlRlbXBsYXRlSW5kZXhGb3JUZW1wbGF0ZVRhZyhcbiAgICBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBpMThuT3A6IGlyLkkxOG5TdGFydE9wLCBvcDogaXIuVGVtcGxhdGVPcCk6IG51bWJlcnxudWxsIHtcbiAgZm9yIChjb25zdCBjaGlsZE9wIG9mIGpvYi52aWV3cy5nZXQob3AueHJlZikhLmNyZWF0ZSkge1xuICAgIGlmIChjaGlsZE9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQpIHtcbiAgICAgIHJldHVybiBjaGlsZE9wLnN1YlRlbXBsYXRlSW5kZXg7XG4gICAgfVxuICB9XG4gIHJldHVybiBpMThuT3Auc3ViVGVtcGxhdGVJbmRleDtcbn1cblxuLyoqIEFkZCBhIHBhcmFtIHZhbHVlIHRvIHRoZSBnaXZlbiBwYXJhbXMgbWFwLiAqL1xuZnVuY3Rpb24gYWRkUGFyYW0oXG4gICAgcGFyYW1zOiBNYXA8c3RyaW5nLCBpci5JMThuUGFyYW1WYWx1ZVtdPiwgcGxhY2Vob2xkZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZ3xudW1iZXIsXG4gICAgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGwsIGZsYWdzOiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzKSB7XG4gIGNvbnN0IHZhbHVlcyA9IHBhcmFtcy5nZXQocGxhY2Vob2xkZXIpID8/IFtdO1xuICB2YWx1ZXMucHVzaCh7dmFsdWUsIHN1YlRlbXBsYXRlSW5kZXgsIGZsYWdzfSk7XG4gIHBhcmFtcy5zZXQocGxhY2Vob2xkZXIsIHZhbHVlcyk7XG59XG4iXX0=