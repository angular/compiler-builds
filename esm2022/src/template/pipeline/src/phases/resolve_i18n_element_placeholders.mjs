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
function addParam(params, placeholder, value, subTemplateIndex, flags = ir.I18nParamValueFlags.None) {
    const values = params.get(placeholder) ?? [];
    values.push({ value, subTemplateIndex, flags });
    params.set(placeholder, values);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQTRCO0lBQ3pFLGdFQUFnRTtJQUNoRSxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM1RCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVztvQkFDeEIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUM5QixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZO29CQUN6QixRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzFCLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsOEZBQThGO1FBQzlGLE1BQU07UUFDTixJQUFJLFVBQVUsR0FBb0UsSUFBSSxDQUFDO1FBRXZGLEtBQUssTUFBTSxFQUFF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QUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO0lBQzlDLE1BQU0sQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21wb25lbnRDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIGVsZW1lbnQgcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSTE4bkVsZW1lbnRQbGFjZWhvbGRlcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICAvLyBSZWNvcmQgYWxsIG9mIHRoZSBlbGVtZW50IGFuZCBpMThuIGNvbnRleHQgb3BzIGZvciB1c2UgbGF0ZXIuXG4gIGNvbnN0IGkxOG5Db250ZXh0cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPigpO1xuICBjb25zdCBlbGVtZW50cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5FbGVtZW50U3RhcnRPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuQ29udGV4dDpcbiAgICAgICAgICBpMThuQ29udGV4dHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICAgIGVsZW1lbnRzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIC8vIFRyYWNrIHRoZSBjdXJyZW50IGkxOG4gb3AgYW5kIGNvcnJlc3BvbmRpbmcgaTE4biBjb250ZXh0IG9wIGFzIHdlIHN0ZXAgdGhyb3VnaCB0aGUgY3JlYXRpb25cbiAgICAvLyBJUi5cbiAgICBsZXQgY3VycmVudE9wczoge2kxOG5CbG9jazogaXIuSTE4blN0YXJ0T3AsIGkxOG5Db250ZXh0OiBpci5JMThuQ29udGV4dE9wfXxudWxsID0gbnVsbDtcblxuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgaWYgKCFvcC5jb250ZXh0KSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignQ291bGQgbm90IGZpbmQgaTE4biBjb250ZXh0IGZvciBpMThuIG9wJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRPcHMgPSB7aTE4bkJsb2NrOiBvcCwgaTE4bkNvbnRleHQ6IGkxOG5Db250ZXh0cy5nZXQob3AuY29udGV4dCkhfTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBjdXJyZW50T3BzID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICAgIC8vIEZvciBlbGVtZW50cyB3aXRoIGkxOG4gcGxhY2Vob2xkZXJzLCByZWNvcmQgaXRzIHNsb3QgdmFsdWUgaW4gdGhlIHBhcmFtcyBtYXAgdW5kZXIgdGhlXG4gICAgICAgICAgLy8gY29ycmVzcG9uZGluZyB0YWcgc3RhcnQgcGxhY2Vob2xkZXIuXG4gICAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudE9wcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHtzdGFydE5hbWUsIGNsb3NlTmFtZX0gPSBvcC5pMThuUGxhY2Vob2xkZXI7XG4gICAgICAgICAgICBsZXQgZmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkVsZW1lbnRUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWc7XG4gICAgICAgICAgICAvLyBGb3Igc2VsZi1jbG9zaW5nIHRhZ3MsIHRoZXJlIGlzIG5vIGNsb3NlIHRhZyBwbGFjZWhvbGRlci4gSW5zdGVhZCwgdGhlIHN0YXJ0IHRhZ1xuICAgICAgICAgICAgLy8gcGxhY2Vob2xkZXIgYWNjb3VudHMgZm9yIHRoZSBzdGFydCBhbmQgY2xvc2Ugb2YgdGhlIGVsZW1lbnQuXG4gICAgICAgICAgICBpZiAoY2xvc2VOYW1lID09PSAnJykge1xuICAgICAgICAgICAgICBmbGFncyB8PSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQ29udGV4dC5wYXJhbXMsIHN0YXJ0TmFtZSwgb3AuaGFuZGxlLnNsb3QhLFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkJsb2NrLnN1YlRlbXBsYXRlSW5kZXgsIGZsYWdzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRFbmQ6XG4gICAgICAgICAgLy8gRm9yIGVsZW1lbnRzIHdpdGggaTE4biBwbGFjZWhvbGRlcnMsIHJlY29yZCBpdHMgc2xvdCB2YWx1ZSBpbiB0aGUgcGFyYW1zIG1hcCB1bmRlciB0aGVcbiAgICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRhZyBjbG9zZSBwbGFjZWhvbGRlci5cbiAgICAgICAgICBjb25zdCBzdGFydE9wID0gZWxlbWVudHMuZ2V0KG9wLnhyZWYpO1xuICAgICAgICAgIGlmIChzdGFydE9wICYmIHN0YXJ0T3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qge2Nsb3NlTmFtZX0gPSBzdGFydE9wLmkxOG5QbGFjZWhvbGRlcjtcbiAgICAgICAgICAgIC8vIFNlbGYtY2xvc2luZyB0YWdzIGRvbid0IGhhdmUgYSBjbG9zaW5nIHRhZyBwbGFjZWhvbGRlci5cbiAgICAgICAgICAgIGlmIChjbG9zZU5hbWUgIT09ICcnKSB7XG4gICAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQ29udGV4dC5wYXJhbXMsIGNsb3NlTmFtZSwgc3RhcnRPcC5oYW5kbGUuc2xvdCEsXG4gICAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG5CbG9jay5zdWJUZW1wbGF0ZUluZGV4LFxuICAgICAgICAgICAgICAgICAgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgICAvLyBGb3IgdGVtcGxhdGVzIHdpdGggaTE4biBwbGFjZWhvbGRlcnMsIHJlY29yZCBpdHMgc2xvdCB2YWx1ZSBpbiB0aGUgcGFyYW1zIG1hcCB1bmRlciB0aGVcbiAgICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRlbXBsYXRlIHN0YXJ0IGFuZCBjbG9zZSBwbGFjZWhvbGRlcnMuXG4gICAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudE9wcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHN1YlRlbXBsYXRlSW5kZXggPVxuICAgICAgICAgICAgICAgIGdldFN1YlRlbXBsYXRlSW5kZXhGb3JUZW1wbGF0ZVRhZyhqb2IsIGN1cnJlbnRPcHMuaTE4bkJsb2NrLCBvcCk7XG4gICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG5Db250ZXh0LnBhcmFtcywgb3AuaTE4blBsYWNlaG9sZGVyLnN0YXJ0TmFtZSwgb3AuaGFuZGxlLnNsb3QhLFxuICAgICAgICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXgsIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpO1xuICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQ29udGV4dC5wYXJhbXMsIG9wLmkxOG5QbGFjZWhvbGRlci5jbG9zZU5hbWUsIG9wLmhhbmRsZS5zbG90ISxcbiAgICAgICAgICAgICAgICBzdWJUZW1wbGF0ZUluZGV4LFxuICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2V0IHRoZSBzdWJUZW1wbGF0ZUluZGV4IGZvciB0aGUgZ2l2ZW4gdGVtcGxhdGUgb3AuIEZvciB0ZW1wbGF0ZSBvcHMsIHVzZSB0aGUgc3ViVGVtcGxhdGVJbmRleCBvZlxuICogdGhlIGNoaWxkIGkxOG4gYmxvY2sgaW5zaWRlIHRoZSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGkxOG5PcDogaXIuSTE4blN0YXJ0T3AsIG9wOiBpci5UZW1wbGF0ZU9wKTogbnVtYmVyfG51bGwge1xuICBmb3IgKGNvbnN0IGNoaWxkT3Agb2Ygam9iLnZpZXdzLmdldChvcC54cmVmKSEuY3JlYXRlKSB7XG4gICAgaWYgKGNoaWxkT3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgcmV0dXJuIGNoaWxkT3Auc3ViVGVtcGxhdGVJbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkxOG5PcC5zdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKiogQWRkIGEgcGFyYW0gdmFsdWUgdG8gdGhlIGdpdmVuIHBhcmFtcyBtYXAuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+LCBwbGFjZWhvbGRlcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bWJlcixcbiAgICBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCwgZmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmUpIHtcbiAgY29uc3QgdmFsdWVzID0gcGFyYW1zLmdldChwbGFjZWhvbGRlcikgPz8gW107XG4gIHZhbHVlcy5wdXNoKHt2YWx1ZSwgc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3N9KTtcbiAgcGFyYW1zLnNldChwbGFjZWhvbGRlciwgdmFsdWVzKTtcbn1cbiJdfQ==