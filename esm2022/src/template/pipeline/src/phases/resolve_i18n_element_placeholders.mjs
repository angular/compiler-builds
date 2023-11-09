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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQTRCO0lBQ3pFLGdFQUFnRTtJQUNoRSxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM1RCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7b0JBQ3hCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWTtvQkFDekIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUMxQixNQUFNO1lBQ1YsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsOEZBQThGO1FBQzlGLE1BQU07UUFDTixJQUFJLFVBQVUs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d0MsRUFBRSxXQUFtQixFQUFFLEtBQW9CLEVBQ25GLGdCQUE2QixFQUFFLEtBQUssR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSTtJQUNwRSxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUM3QyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7SUFDOUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgZWxlbWVudCBwbGFjZWhvbGRlcnMgaW4gaTE4biBtZXNzYWdlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVJMThuRWxlbWVudFBsYWNlaG9sZGVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gIC8vIFJlY29yZCBhbGwgb2YgdGhlIGVsZW1lbnQgYW5kIGkxOG4gY29udGV4dCBvcHMgZm9yIHVzZSBsYXRlci5cbiAgY29uc3QgaTE4bkNvbnRleHRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5Db250ZXh0T3A+KCk7XG4gIGNvbnN0IGVsZW1lbnRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRTdGFydE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgICAgZWxlbWVudHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgLy8gVHJhY2sgdGhlIGN1cnJlbnQgaTE4biBvcCBhbmQgY29ycmVzcG9uZGluZyBpMThuIGNvbnRleHQgb3AgYXMgd2Ugc3RlcCB0aHJvdWdoIHRoZSBjcmVhdGlvblxuICAgIC8vIElSLlxuICAgIGxldCBjdXJyZW50T3BzOiB7aTE4bkJsb2NrOiBpci5JMThuU3RhcnRPcCwgaTE4bkNvbnRleHQ6IGlyLkkxOG5Db250ZXh0T3B9fG51bGwgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBpZiAoIW9wLmNvbnRleHQpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdDb3VsZCBub3QgZmluZCBpMThuIGNvbnRleHQgZm9yIGkxOG4gb3AnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3VycmVudE9wcyA9IHtpMThuQmxvY2s6IG9wLCBpMThuQ29udGV4dDogaTE4bkNvbnRleHRzLmdldChvcC5jb250ZXh0KSF9O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuRW5kOlxuICAgICAgICAgIGN1cnJlbnRPcHMgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgICAgLy8gRm9yIGVsZW1lbnRzIHdpdGggaTE4biBwbGFjZWhvbGRlcnMsIHJlY29yZCBpdHMgc2xvdCB2YWx1ZSBpbiB0aGUgcGFyYW1zIG1hcCB1bmRlciB0aGVcbiAgICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRhZyBzdGFydCBwbGFjZWhvbGRlci5cbiAgICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qge3N0YXJ0TmFtZSwgY2xvc2VOYW1lfSA9IG9wLmkxOG5QbGFjZWhvbGRlcjtcbiAgICAgICAgICAgIGxldCBmbGFncyA9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZztcbiAgICAgICAgICAgIC8vIEZvciBzZWxmLWNsb3NpbmcgdGFncywgdGhlcmUgaXMgbm8gY2xvc2UgdGFnIHBsYWNlaG9sZGVyLiBJbnN0ZWFkLCB0aGUgc3RhcnQgdGFnXG4gICAgICAgICAgICAvLyBwbGFjZWhvbGRlciBhY2NvdW50cyBmb3IgdGhlIHN0YXJ0IGFuZCBjbG9zZSBvZiB0aGUgZWxlbWVudC5cbiAgICAgICAgICAgIGlmIChjbG9zZU5hbWUgPT09ICcnKSB7XG4gICAgICAgICAgICAgIGZsYWdzIHw9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG5Db250ZXh0LnBhcmFtcywgc3RhcnROYW1lLCBvcC5oYW5kbGUuc2xvdCEsXG4gICAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQmxvY2suc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGFnIGNsb3NlIHBsYWNlaG9sZGVyLlxuICAgICAgICAgIGNvbnN0IHN0YXJ0T3AgPSBlbGVtZW50cy5nZXQob3AueHJlZik7XG4gICAgICAgICAgaWYgKHN0YXJ0T3AgJiYgc3RhcnRPcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7Y2xvc2VOYW1lfSA9IHN0YXJ0T3AuaTE4blBsYWNlaG9sZGVyO1xuICAgICAgICAgICAgLy8gU2VsZi1jbG9zaW5nIHRhZ3MgZG9uJ3QgaGF2ZSBhIGNsb3NpbmcgdGFnIHBsYWNlaG9sZGVyLlxuICAgICAgICAgICAgaWYgKGNsb3NlTmFtZSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG5Db250ZXh0LnBhcmFtcywgY2xvc2VOYW1lLCBzdGFydE9wLmhhbmRsZS5zbG90ISxcbiAgICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkJsb2NrLnN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgICAgICAgICBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkVsZW1lbnRUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICAgIC8vIEZvciB0ZW1wbGF0ZXMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGVtcGxhdGUgc3RhcnQgYW5kIGNsb3NlIHBsYWNlaG9sZGVycy5cbiAgICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3ViVGVtcGxhdGVJbmRleCA9XG4gICAgICAgICAgICAgICAgZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKGpvYiwgY3VycmVudE9wcy5pMThuQmxvY2ssIG9wKTtcbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQucGFyYW1zLCBvcC5pMThuUGxhY2Vob2xkZXIuc3RhcnROYW1lLCBvcC5oYW5kbGUuc2xvdCEsXG4gICAgICAgICAgICAgICAgc3ViVGVtcGxhdGVJbmRleCwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZyk7XG4gICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzLmkxOG5Db250ZXh0LnBhcmFtcywgb3AuaTE4blBsYWNlaG9sZGVyLmNsb3NlTmFtZSwgb3AuaGFuZGxlLnNsb3QhLFxuICAgICAgICAgICAgICAgIHN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgICAgICAgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBHZXQgdGhlIHN1YlRlbXBsYXRlSW5kZXggZm9yIHRoZSBnaXZlbiB0ZW1wbGF0ZSBvcC4gRm9yIHRlbXBsYXRlIG9wcywgdXNlIHRoZSBzdWJUZW1wbGF0ZUluZGV4IG9mXG4gKiB0aGUgY2hpbGQgaTE4biBibG9jayBpbnNpZGUgdGhlIHRlbXBsYXRlLlxuICovXG5mdW5jdGlvbiBnZXRTdWJUZW1wbGF0ZUluZGV4Rm9yVGVtcGxhdGVUYWcoXG4gICAgam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgaTE4bk9wOiBpci5JMThuU3RhcnRPcCwgb3A6IGlyLlRlbXBsYXRlT3ApOiBudW1iZXJ8bnVsbCB7XG4gIGZvciAoY29uc3QgY2hpbGRPcCBvZiBqb2Iudmlld3MuZ2V0KG9wLnhyZWYpIS5jcmVhdGUpIHtcbiAgICBpZiAoY2hpbGRPcC5raW5kID09PSBpci5PcEtpbmQuSTE4blN0YXJ0KSB7XG4gICAgICByZXR1cm4gY2hpbGRPcC5zdWJUZW1wbGF0ZUluZGV4O1xuICAgIH1cbiAgfVxuICByZXR1cm4gaTE4bk9wLnN1YlRlbXBsYXRlSW5kZXg7XG59XG5cbi8qKiBBZGQgYSBwYXJhbSB2YWx1ZSB0byB0aGUgZ2l2ZW4gcGFyYW1zIG1hcC4gKi9cbmZ1bmN0aW9uIGFkZFBhcmFtKFxuICAgIHBhcmFtczogTWFwPHN0cmluZywgaXIuSTE4blBhcmFtVmFsdWVbXT4sIHBsYWNlaG9sZGVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmd8bnVtYmVyLFxuICAgIHN1YlRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBmbGFncyA9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuTm9uZSkge1xuICBjb25zdCB2YWx1ZXMgPSBwYXJhbXMuZ2V0KHBsYWNlaG9sZGVyKSA/PyBbXTtcbiAgdmFsdWVzLnB1c2goe3ZhbHVlLCBzdWJUZW1wbGF0ZUluZGV4LCBmbGFnc30pO1xuICBwYXJhbXMuc2V0KHBsYWNlaG9sZGVyLCB2YWx1ZXMpO1xufVxuIl19