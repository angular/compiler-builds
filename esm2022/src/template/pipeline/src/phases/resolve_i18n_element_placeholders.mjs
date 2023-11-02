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
                        addParam(currentOps.extractedMessage.params, startName, op.handle.slot, currentOps.i18n.subTemplateIndex, flags);
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
                            addParam(currentOps.extractedMessage.params, closeName, startOp.handle.slot, currentOps.i18n.subTemplateIndex, ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.CloseTag);
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
                        addParam(currentOps.extractedMessage.params, op.i18nPlaceholder.startName, op.handle.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag);
                        addParam(currentOps.extractedMessage.params, op.i18nPlaceholder.closeName, op.handle.slot, subTemplateIndex, ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.CloseTag);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQTRCO0lBQ3pFLHFFQUFxRTtJQUNyRSxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO0lBQ3hFLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxFQUFnQyxDQUFDO0lBQ3pELEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtRQUM1QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDNUIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0I7b0JBQzdCLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUN0QyxNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZO29CQUN6QixRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzFCLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsMEZBQTBGO1FBQzFGLGVBQWU7UUFDZixJQUFJLFVBQVUsR0FBeUUsSUFBSSxDQUFDO1FBRTVGLEtBQUssTUFB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QUMsSUFBSSxFQUFFLENBQUM7SUFDN0MsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO0lBQzlDLE1BQU0sQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIGVsZW1lbnQgcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSTE4bkVsZW1lbnRQbGFjZWhvbGRlcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAvLyBSZWNvcmQgYWxsIG9mIHRoZSBlbGVtZW50IGFuZCBleHRyYWN0ZWQgbWVzc2FnZSBvcHMgZm9yIHVzZSBsYXRlci5cbiAgY29uc3QgZXh0cmFjdGVkTWVzc2FnZU9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5FeHRyYWN0ZWRNZXNzYWdlT3A+KCk7XG4gIGNvbnN0IGVsZW1lbnRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRTdGFydE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkV4dHJhY3RlZE1lc3NhZ2U6XG4gICAgICAgICAgZXh0cmFjdGVkTWVzc2FnZU9wcy5zZXQob3Aub3duZXIsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICAgIGVsZW1lbnRzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFRyYWNrIHRoZSBjdXJyZW50IGkxOG4gb3AgYW5kIGNvcnJlc3BvbmRpbmcgZXh0cmFjdGVkIG1lc3NhZ2Ugb3AgYXMgd2Ugc3RlcCB0aHJvdWdoIHRoZVxuICAgIC8vIGNyZWF0aW9uIElSLlxuICAgIGxldCBjdXJyZW50T3BzOiB7aTE4bjogaXIuSTE4blN0YXJ0T3AsIGV4dHJhY3RlZE1lc3NhZ2U6IGlyLkV4dHJhY3RlZE1lc3NhZ2VPcH18bnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGlmICghZXh0cmFjdGVkTWVzc2FnZU9wcy5oYXMob3AueHJlZikpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdDb3VsZCBub3QgZmluZCBleHRyYWN0ZWQgbWVzc2FnZSBmb3IgaTE4biBvcCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjdXJyZW50T3BzID0ge2kxOG46IG9wLCBleHRyYWN0ZWRNZXNzYWdlOiBleHRyYWN0ZWRNZXNzYWdlT3BzLmdldChvcC54cmVmKSF9O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAgIGN1cnJlbnRPcHMgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgICAgLy8gRm9yIGVsZW1lbnRzIHdpdGggaTE4biBwbGFjZWhvbGRlcnMsIHJlY29yZCBpdHMgc2xvdCB2YWx1ZSBpbiB0aGUgcGFyYW1zIG1hcCB1bmRlciB0aGVcbiAgICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRhZyBzdGFydCBwbGFjZWhvbGRlci5cbiAgICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qge3N0YXJ0TmFtZSwgY2xvc2VOYW1lfSA9IG9wLmkxOG5QbGFjZWhvbGRlcjtcbiAgICAgICAgICAgIGxldCBmbGFncyA9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZztcbiAgICAgICAgICAgIC8vIEZvciBzZWxmLWNsb3NpbmcgdGFncywgdGhlcmUgaXMgbm8gY2xvc2UgdGFnIHBsYWNlaG9sZGVyLiBJbnN0ZWFkLCB0aGUgc3RhcnQgdGFnXG4gICAgICAgICAgICAvLyBwbGFjZWhvbGRlciBhY2NvdW50cyBmb3IgdGhlIHN0YXJ0IGFuZCBjbG9zZSBvZiB0aGUgZWxlbWVudC5cbiAgICAgICAgICAgIGlmIChjbG9zZU5hbWUgPT09ICcnKSB7XG4gICAgICAgICAgICAgIGZsYWdzIHw9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmV4dHJhY3RlZE1lc3NhZ2UucGFyYW1zLCBzdGFydE5hbWUsIG9wLmhhbmRsZS5zbG90ISxcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG4uc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGFnIGNsb3NlIHBsYWNlaG9sZGVyLlxuICAgICAgICAgIGNvbnN0IHN0YXJ0T3AgPSBlbGVtZW50cy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKHN0YXJ0T3AgJiYgc3RhcnRPcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7Y2xvc2VOYW1lfSA9IHN0YXJ0T3AuaTE4blBsYWNlaG9sZGVyO1xuICAgICAgICAgICAgLy8gU2VsZi1jbG9zaW5nIHRhZ3MgZG9uJ3QgaGF2ZSBhIGNsb3NpbmcgdGFnIHBsYWNlaG9sZGVyLlxuICAgICAgICAgICAgaWYgKGNsb3NlTmFtZSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmV4dHJhY3RlZE1lc3NhZ2UhLnBhcmFtcywgY2xvc2VOYW1lLCBzdGFydE9wLmhhbmRsZS5zbG90ISxcbiAgICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bi5zdWJUZW1wbGF0ZUluZGV4LFxuICAgICAgICAgICAgICAgICAgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgICAvLyBGb3IgdGVtcGxhdGVzIHdpdGggaTE4biBwbGFjZWhvbGRlcnMsIHJlY29yZCBpdHMgc2xvdCB2YWx1ZSBpbiB0aGUgcGFyYW1zIG1hcCB1bmRlciB0aGVcbiAgICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRlbXBsYXRlIHN0YXJ0IGFuZCBjbG9zZSBwbGFjZWhvbGRlcnMuXG4gICAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudE9wcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHN1YlRlbXBsYXRlSW5kZXggPSBnZXRTdWJUZW1wbGF0ZUluZGV4Rm9yVGVtcGxhdGVUYWcoam9iLCBjdXJyZW50T3BzLmkxOG4sIG9wKTtcbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuZXh0cmFjdGVkTWVzc2FnZS5wYXJhbXMsIG9wLmkxOG5QbGFjZWhvbGRlci5zdGFydE5hbWUsIG9wLmhhbmRsZS5zbG90ISxcbiAgICAgICAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4LCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnKTtcbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuZXh0cmFjdGVkTWVzc2FnZS5wYXJhbXMsIG9wLmkxOG5QbGFjZWhvbGRlci5jbG9zZU5hbWUsIG9wLmhhbmRsZS5zbG90ISxcbiAgICAgICAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4LFxuICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2V0IHRoZSBzdWJUZW1wbGF0ZUluZGV4IGZvciB0aGUgZ2l2ZW4gdGVtcGxhdGUgb3AuIEZvciB0ZW1wbGF0ZSBvcHMsIHVzZSB0aGUgc3ViVGVtcGxhdGVJbmRleCBvZlxuICogdGhlIGNoaWxkIGkxOG4gYmxvY2sgaW5zaWRlIHRoZSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGkxOG5PcDogaXIuSTE4blN0YXJ0T3AsIG9wOiBpci5UZW1wbGF0ZU9wKTogbnVtYmVyfG51bGwge1xuICBmb3IgKGNvbnN0IGNoaWxkT3Agb2Ygam9iLnZpZXdzLmdldChvcC54cmVmKSEuY3JlYXRlKSB7XG4gICAgaWYgKGNoaWxkT3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgcmV0dXJuIGNoaWxkT3Auc3ViVGVtcGxhdGVJbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkxOG5PcC5zdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKiogQWRkIGEgcGFyYW0gdmFsdWUgdG8gdGhlIGdpdmVuIHBhcmFtcyBtYXAuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+LCBwbGFjZWhvbGRlcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bWJlcixcbiAgICBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCwgZmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmUpIHtcbiAgY29uc3QgdmFsdWVzID0gcGFyYW1zLmdldChwbGFjZWhvbGRlcikgPz8gW107XG4gIHZhbHVlcy5wdXNoKHt2YWx1ZSwgc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3N9KTtcbiAgcGFyYW1zLnNldChwbGFjZWhvbGRlciwgdmFsdWVzKTtcbn1cbiJdfQ==