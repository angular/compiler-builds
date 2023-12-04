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
    resolvePlaceholdersForView(job, job.root, i18nContexts, elements);
}
/**
 * Recursively resolves element and template tag placeholders in the given view.
 */
function resolvePlaceholdersForView(job, unit, i18nContexts, elements, pendingStructuralDirective) {
    // Track the current i18n op and corresponding i18n context op as we step through the creation
    // IR.
    let currentOps = null;
    let pendingStructuralDirectiveCloses = new Map();
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
                    recordElementStart(op, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                    // If there is a separate close tag placeholder for this element, save the pending
                    // structural directive so we can pass it to the closing tag as well.
                    if (pendingStructuralDirective && op.i18nPlaceholder.closeName) {
                        pendingStructuralDirectiveCloses.set(op.xref, pendingStructuralDirective);
                    }
                    // Clear out the pending structural directive now that its been accounted for.
                    pendingStructuralDirective = undefined;
                }
                break;
            case ir.OpKind.ElementEnd:
                // For elements with i18n placeholders, record its slot value in the params map under the
                // corresponding tag close placeholder.
                const startOp = elements.get(op.xref);
                if (startOp && startOp.i18nPlaceholder !== undefined) {
                    if (currentOps === null) {
                        throw Error('AssertionError: i18n tag placeholder should only occur inside an i18n block');
                    }
                    recordElementClose(startOp, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirectiveCloses.get(op.xref));
                    // Clear out the pending structural directive close that was accounted for.
                    pendingStructuralDirectiveCloses.delete(op.xref);
                }
                break;
            case ir.OpKind.Projection:
                // For content projections with i18n placeholders, record its slot value in the params map
                // under the corresponding tag start and close placeholders.
                if (op.i18nPlaceholder !== undefined) {
                    if (currentOps === null) {
                        throw Error('i18n tag placeholder should only occur inside an i18n block');
                    }
                    recordElementStart(op, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                    recordElementClose(op, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                    // Clear out the pending structural directive now that its been accounted for.
                    pendingStructuralDirective = undefined;
                }
                break;
            case ir.OpKind.Template:
                if (op.i18nPlaceholder === undefined) {
                    // If there is no i18n placeholder, just recurse into the view in case it contains i18n
                    // blocks.
                    resolvePlaceholdersForView(job, job.views.get(op.xref), i18nContexts, elements);
                }
                else {
                    if (currentOps === null) {
                        throw Error('i18n tag placeholder should only occur inside an i18n block');
                    }
                    if (op.templateKind === ir.TemplateKind.Structural) {
                        // If this is a structural directive template, don't record anything yet. Instead pass
                        // the current template as a pending structural directive to be recorded when we find
                        // the element, content, or template it belongs to. This allows us to create combined
                        // values that represent, e.g. the start of a template and element at the same time.
                        resolvePlaceholdersForView(job, job.views.get(op.xref), i18nContexts, elements, op);
                    }
                    else {
                        // If this is some other kind of template, we can record its start, recurse into its
                        // view, and then record its end.
                        recordTemplateStart(job, op, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                        resolvePlaceholdersForView(job, job.views.get(op.xref), i18nContexts, elements);
                        recordTemplateClose(job, op, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                        pendingStructuralDirective = undefined;
                    }
                }
                break;
        }
    }
}
/**
 * Records an i18n param value for the start of an element.
 */
function recordElementStart(op, i18nContext, i18nBlock, structuralDirective) {
    const { startName, closeName } = op.i18nPlaceholder;
    let flags = ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.OpenTag;
    let value = op.handle.slot;
    // If the element is associated with a structural directive, start it as well.
    if (structuralDirective !== undefined) {
        flags |= ir.I18nParamValueFlags.TemplateTag;
        value = { element: value, template: structuralDirective.handle.slot };
    }
    // For self-closing tags, there is no close tag placeholder. Instead, the start tag
    // placeholder accounts for the start and close of the element.
    if (!closeName) {
        flags |= ir.I18nParamValueFlags.CloseTag;
    }
    addParam(i18nContext.params, startName, value, i18nBlock.subTemplateIndex, flags);
}
/**
 * Records an i18n param value for the closing of an element.
 */
function recordElementClose(op, i18nContext, i18nBlock, structuralDirective) {
    const { closeName } = op.i18nPlaceholder;
    // Self-closing tags don't have a closing tag placeholder, instead the element closing is
    // recorded via an additional flag on the element start value.
    if (closeName) {
        let flags = ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.CloseTag;
        let value = op.handle.slot;
        // If the element is associated with a structural directive, close it as well.
        if (structuralDirective !== undefined) {
            flags |= ir.I18nParamValueFlags.TemplateTag;
            value = { element: value, template: structuralDirective.handle.slot };
        }
        addParam(i18nContext.params, closeName, value, i18nBlock.subTemplateIndex, flags);
    }
}
/**
 * Records an i18n param value for the start of a template.
 */
function recordTemplateStart(job, op, i18nContext, i18nBlock, structuralDirective) {
    let { startName, closeName } = op.i18nPlaceholder;
    let flags = ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.OpenTag;
    // For self-closing tags, there is no close tag placeholder. Instead, the start tag
    // placeholder accounts for the start and close of the element.
    if (!closeName) {
        flags |= ir.I18nParamValueFlags.CloseTag;
    }
    // If the template is associated with a structural directive, record the structural directive's
    // start first. Since this template must be in the structural directive's view, we can just
    // directly use the current i18n block's sub-template index.
    if (structuralDirective !== undefined) {
        addParam(i18nContext.params, startName, structuralDirective.handle.slot, i18nBlock.subTemplateIndex, flags);
    }
    // Record the start of the template. For the sub-template index, pass the index for the template's
    // view, rather than the current i18n block's index.
    addParam(i18nContext.params, startName, op.handle.slot, getSubTemplateIndexForTemplateTag(job, i18nBlock, op), flags);
}
/**
 * Records an i18n param value for the closing of a template.
 */
function recordTemplateClose(job, op, i18nContext, i18nBlock, structuralDirective) {
    const { startName, closeName } = op.i18nPlaceholder;
    const flags = ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.CloseTag;
    // Self-closing tags don't have a closing tag placeholder, instead the template's closing is
    // recorded via an additional flag on the template start value.
    if (closeName) {
        // Record the closing of the template. For the sub-template index, pass the index for the
        // template's view, rather than the current i18n block's index.
        addParam(i18nContext.params, closeName, op.handle.slot, getSubTemplateIndexForTemplateTag(job, i18nBlock, op), flags);
        // If the template is associated with a structural directive, record the structural directive's
        // closing after. Since this template must be in the structural directive's view, we can just
        // directly use the current i18n block's sub-template index.
        if (structuralDirective !== undefined) {
            addParam(i18nContext.params, closeName, structuralDirective.handle.slot, i18nBlock.subTemplateIndex, flags);
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
/**
 * Add a param value to the given params map.
 */
function addParam(params, placeholder, value, subTemplateIndex, flags) {
    const values = params.get(placeholder) ?? [];
    values.push({ value, subTemplateIndex, flags });
    params.set(placeholder, values);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQTRCO0lBQ3pFLGdFQUFnRTtJQUNoRSxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM1RCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVc7b0JBQ3hCLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsTUFBTTtnQkFDUixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWTtvQkFDekIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUMxQixNQUFNO1lBQ1YsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsMEJBQTBCLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3BFLENBQUM7QUFFRDs7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QUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9iLCBWaWV3Q29tcGlsYXRpb25Vbml0fSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgZWxlbWVudCBwbGFjZWhvbGRlcnMgaW4gaTE4biBtZXNzYWdlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVJMThuRWxlbWVudFBsYWNlaG9sZGVycyhqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iKSB7XG4gIC8vIFJlY29yZCBhbGwgb2YgdGhlIGVsZW1lbnQgYW5kIGkxOG4gY29udGV4dCBvcHMgZm9yIHVzZSBsYXRlci5cbiAgY29uc3QgaTE4bkNvbnRleHRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5Db250ZXh0T3A+KCk7XG4gIGNvbnN0IGVsZW1lbnRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRTdGFydE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50U3RhcnQ6XG4gICAgICAgICAgZWxlbWVudHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXNvbHZlUGxhY2Vob2xkZXJzRm9yVmlldyhqb2IsIGpvYi5yb290LCBpMThuQ29udGV4dHMsIGVsZW1lbnRzKTtcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSByZXNvbHZlcyBlbGVtZW50IGFuZCB0ZW1wbGF0ZSB0YWcgcGxhY2Vob2xkZXJzIGluIHRoZSBnaXZlbiB2aWV3LlxuICovXG5mdW5jdGlvbiByZXNvbHZlUGxhY2Vob2xkZXJzRm9yVmlldyhcbiAgICBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCB1bml0OiBWaWV3Q29tcGlsYXRpb25Vbml0LFxuICAgIGkxOG5Db250ZXh0czogTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4sIGVsZW1lbnRzOiBNYXA8aXIuWHJlZklkLCBpci5FbGVtZW50U3RhcnRPcD4sXG4gICAgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmU/OiBpci5UZW1wbGF0ZU9wKSB7XG4gIC8vIFRyYWNrIHRoZSBjdXJyZW50IGkxOG4gb3AgYW5kIGNvcnJlc3BvbmRpbmcgaTE4biBjb250ZXh0IG9wIGFzIHdlIHN0ZXAgdGhyb3VnaCB0aGUgY3JlYXRpb25cbiAgLy8gSVIuXG4gIGxldCBjdXJyZW50T3BzOiB7aTE4bkJsb2NrOiBpci5JMThuU3RhcnRPcCwgaTE4bkNvbnRleHQ6IGlyLkkxOG5Db250ZXh0T3B9fG51bGwgPSBudWxsO1xuICBsZXQgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmVDbG9zZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuVGVtcGxhdGVPcD4oKTtcbiAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICBpZiAoIW9wLmNvbnRleHQpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignQ291bGQgbm90IGZpbmQgaTE4biBjb250ZXh0IGZvciBpMThuIG9wJyk7XG4gICAgICAgIH1cbiAgICAgICAgY3VycmVudE9wcyA9IHtpMThuQmxvY2s6IG9wLCBpMThuQ29udGV4dDogaTE4bkNvbnRleHRzLmdldChvcC5jb250ZXh0KSF9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgIGN1cnJlbnRPcHMgPSBudWxsO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgICAgLy8gRm9yIGVsZW1lbnRzIHdpdGggaTE4biBwbGFjZWhvbGRlcnMsIHJlY29yZCBpdHMgc2xvdCB2YWx1ZSBpbiB0aGUgcGFyYW1zIG1hcCB1bmRlciB0aGVcbiAgICAgICAgLy8gY29ycmVzcG9uZGluZyB0YWcgc3RhcnQgcGxhY2Vob2xkZXIuXG4gICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVjb3JkRWxlbWVudFN0YXJ0KFxuICAgICAgICAgICAgICBvcCwgY3VycmVudE9wcy5pMThuQ29udGV4dCwgY3VycmVudE9wcy5pMThuQmxvY2ssIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlKTtcbiAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBhIHNlcGFyYXRlIGNsb3NlIHRhZyBwbGFjZWhvbGRlciBmb3IgdGhpcyBlbGVtZW50LCBzYXZlIHRoZSBwZW5kaW5nXG4gICAgICAgICAgLy8gc3RydWN0dXJhbCBkaXJlY3RpdmUgc28gd2UgY2FuIHBhc3MgaXQgdG8gdGhlIGNsb3NpbmcgdGFnIGFzIHdlbGwuXG4gICAgICAgICAgaWYgKHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlICYmIG9wLmkxOG5QbGFjZWhvbGRlci5jbG9zZU5hbWUpIHtcbiAgICAgICAgICAgIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlQ2xvc2VzLnNldChvcC54cmVmLCBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIENsZWFyIG91dCB0aGUgcGVuZGluZyBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSBub3cgdGhhdCBpdHMgYmVlbiBhY2NvdW50ZWQgZm9yLlxuICAgICAgICAgIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgLy8gRm9yIGVsZW1lbnRzIHdpdGggaTE4biBwbGFjZWhvbGRlcnMsIHJlY29yZCBpdHMgc2xvdCB2YWx1ZSBpbiB0aGUgcGFyYW1zIG1hcCB1bmRlciB0aGVcbiAgICAgICAgLy8gY29ycmVzcG9uZGluZyB0YWcgY2xvc2UgcGxhY2Vob2xkZXIuXG4gICAgICAgIGNvbnN0IHN0YXJ0T3AgPSBlbGVtZW50cy5nZXQob3AueHJlZik7XG4gICAgICAgIGlmIChzdGFydE9wICYmIHN0YXJ0T3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAoY3VycmVudE9wcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICAgICAgJ0Fzc2VydGlvbkVycm9yOiBpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZWNvcmRFbGVtZW50Q2xvc2UoXG4gICAgICAgICAgICAgIHN0YXJ0T3AsIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQsIGN1cnJlbnRPcHMuaTE4bkJsb2NrLFxuICAgICAgICAgICAgICBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZUNsb3Nlcy5nZXQob3AueHJlZikpO1xuICAgICAgICAgIC8vIENsZWFyIG91dCB0aGUgcGVuZGluZyBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSBjbG9zZSB0aGF0IHdhcyBhY2NvdW50ZWQgZm9yLlxuICAgICAgICAgIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlQ2xvc2VzLmRlbGV0ZShvcC54cmVmKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlByb2plY3Rpb246XG4gICAgICAgIC8vIEZvciBjb250ZW50IHByb2plY3Rpb25zIHdpdGggaTE4biBwbGFjZWhvbGRlcnMsIHJlY29yZCBpdHMgc2xvdCB2YWx1ZSBpbiB0aGUgcGFyYW1zIG1hcFxuICAgICAgICAvLyB1bmRlciB0aGUgY29ycmVzcG9uZGluZyB0YWcgc3RhcnQgYW5kIGNsb3NlIHBsYWNlaG9sZGVycy5cbiAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZWNvcmRFbGVtZW50U3RhcnQoXG4gICAgICAgICAgICAgIG9wLCBjdXJyZW50T3BzLmkxOG5Db250ZXh0LCBjdXJyZW50T3BzLmkxOG5CbG9jaywgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUpO1xuICAgICAgICAgIHJlY29yZEVsZW1lbnRDbG9zZShcbiAgICAgICAgICAgICAgb3AsIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQsIGN1cnJlbnRPcHMuaTE4bkJsb2NrLCBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZSk7XG4gICAgICAgICAgLy8gQ2xlYXIgb3V0IHRoZSBwZW5kaW5nIHN0cnVjdHVyYWwgZGlyZWN0aXZlIG5vdyB0aGF0IGl0cyBiZWVuIGFjY291bnRlZCBmb3IuXG4gICAgICAgICAgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgaXMgbm8gaTE4biBwbGFjZWhvbGRlciwganVzdCByZWN1cnNlIGludG8gdGhlIHZpZXcgaW4gY2FzZSBpdCBjb250YWlucyBpMThuXG4gICAgICAgICAgLy8gYmxvY2tzLlxuICAgICAgICAgIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KGpvYiwgam9iLnZpZXdzLmdldChvcC54cmVmKSEsIGkxOG5Db250ZXh0cywgZWxlbWVudHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wLnRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLlN0cnVjdHVyYWwpIHtcbiAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZSwgZG9uJ3QgcmVjb3JkIGFueXRoaW5nIHlldC4gSW5zdGVhZCBwYXNzXG4gICAgICAgICAgICAvLyB0aGUgY3VycmVudCB0ZW1wbGF0ZSBhcyBhIHBlbmRpbmcgc3RydWN0dXJhbCBkaXJlY3RpdmUgdG8gYmUgcmVjb3JkZWQgd2hlbiB3ZSBmaW5kXG4gICAgICAgICAgICAvLyB0aGUgZWxlbWVudCwgY29udGVudCwgb3IgdGVtcGxhdGUgaXQgYmVsb25ncyB0by4gVGhpcyBhbGxvd3MgdXMgdG8gY3JlYXRlIGNvbWJpbmVkXG4gICAgICAgICAgICAvLyB2YWx1ZXMgdGhhdCByZXByZXNlbnQsIGUuZy4gdGhlIHN0YXJ0IG9mIGEgdGVtcGxhdGUgYW5kIGVsZW1lbnQgYXQgdGhlIHNhbWUgdGltZS5cbiAgICAgICAgICAgIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KGpvYiwgam9iLnZpZXdzLmdldChvcC54cmVmKSEsIGkxOG5Db250ZXh0cywgZWxlbWVudHMsIG9wKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSWYgdGhpcyBpcyBzb21lIG90aGVyIGtpbmQgb2YgdGVtcGxhdGUsIHdlIGNhbiByZWNvcmQgaXRzIHN0YXJ0LCByZWN1cnNlIGludG8gaXRzXG4gICAgICAgICAgICAvLyB2aWV3LCBhbmQgdGhlbiByZWNvcmQgaXRzIGVuZC5cbiAgICAgICAgICAgIHJlY29yZFRlbXBsYXRlU3RhcnQoXG4gICAgICAgICAgICAgICAgam9iLCBvcCwgY3VycmVudE9wcy5pMThuQ29udGV4dCwgY3VycmVudE9wcy5pMThuQmxvY2ssIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlKTtcbiAgICAgICAgICAgIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KGpvYiwgam9iLnZpZXdzLmdldChvcC54cmVmKSEsIGkxOG5Db250ZXh0cywgZWxlbWVudHMpO1xuICAgICAgICAgICAgcmVjb3JkVGVtcGxhdGVDbG9zZShcbiAgICAgICAgICAgICAgICBqb2IsIG9wLCBjdXJyZW50T3BzIS5pMThuQ29udGV4dCwgY3VycmVudE9wcyEuaTE4bkJsb2NrLFxuICAgICAgICAgICAgICAgIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlKTtcbiAgICAgICAgICAgIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBSZWNvcmRzIGFuIGkxOG4gcGFyYW0gdmFsdWUgZm9yIHRoZSBzdGFydCBvZiBhbiBlbGVtZW50LlxuICovXG5mdW5jdGlvbiByZWNvcmRFbGVtZW50U3RhcnQoXG4gICAgb3A6IGlyLkVsZW1lbnRTdGFydE9wfGlyLlByb2plY3Rpb25PcCwgaTE4bkNvbnRleHQ6IGlyLkkxOG5Db250ZXh0T3AsIGkxOG5CbG9jazogaXIuSTE4blN0YXJ0T3AsXG4gICAgc3RydWN0dXJhbERpcmVjdGl2ZT86IGlyLlRlbXBsYXRlT3ApIHtcbiAgY29uc3Qge3N0YXJ0TmFtZSwgY2xvc2VOYW1lfSA9IG9wLmkxOG5QbGFjZWhvbGRlciE7XG4gIGxldCBmbGFncyA9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZztcbiAgbGV0IHZhbHVlOiBpci5JMThuUGFyYW1WYWx1ZVsndmFsdWUnXSA9IG9wLmhhbmRsZS5zbG90ITtcbiAgLy8gSWYgdGhlIGVsZW1lbnQgaXMgYXNzb2NpYXRlZCB3aXRoIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUsIHN0YXJ0IGl0IGFzIHdlbGwuXG4gIGlmIChzdHJ1Y3R1cmFsRGlyZWN0aXZlICE9PSB1bmRlZmluZWQpIHtcbiAgICBmbGFncyB8PSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnO1xuICAgIHZhbHVlID0ge2VsZW1lbnQ6IHZhbHVlLCB0ZW1wbGF0ZTogc3RydWN0dXJhbERpcmVjdGl2ZS5oYW5kbGUuc2xvdCF9O1xuICB9XG4gIC8vIEZvciBzZWxmLWNsb3NpbmcgdGFncywgdGhlcmUgaXMgbm8gY2xvc2UgdGFnIHBsYWNlaG9sZGVyLiBJbnN0ZWFkLCB0aGUgc3RhcnQgdGFnXG4gIC8vIHBsYWNlaG9sZGVyIGFjY291bnRzIGZvciB0aGUgc3RhcnQgYW5kIGNsb3NlIG9mIHRoZSBlbGVtZW50LlxuICBpZiAoIWNsb3NlTmFtZSkge1xuICAgIGZsYWdzIHw9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWc7XG4gIH1cbiAgYWRkUGFyYW0oaTE4bkNvbnRleHQucGFyYW1zLCBzdGFydE5hbWUsIHZhbHVlLCBpMThuQmxvY2suc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3MpO1xufVxuXG4vKipcbiAqIFJlY29yZHMgYW4gaTE4biBwYXJhbSB2YWx1ZSBmb3IgdGhlIGNsb3Npbmcgb2YgYW4gZWxlbWVudC5cbiAqL1xuZnVuY3Rpb24gcmVjb3JkRWxlbWVudENsb3NlKFxuICAgIG9wOiBpci5FbGVtZW50U3RhcnRPcHxpci5Qcm9qZWN0aW9uT3AsIGkxOG5Db250ZXh0OiBpci5JMThuQ29udGV4dE9wLCBpMThuQmxvY2s6IGlyLkkxOG5TdGFydE9wLFxuICAgIHN0cnVjdHVyYWxEaXJlY3RpdmU/OiBpci5UZW1wbGF0ZU9wKSB7XG4gIGNvbnN0IHtjbG9zZU5hbWV9ID0gb3AuaTE4blBsYWNlaG9sZGVyITtcbiAgLy8gU2VsZi1jbG9zaW5nIHRhZ3MgZG9uJ3QgaGF2ZSBhIGNsb3NpbmcgdGFnIHBsYWNlaG9sZGVyLCBpbnN0ZWFkIHRoZSBlbGVtZW50IGNsb3NpbmcgaXNcbiAgLy8gcmVjb3JkZWQgdmlhIGFuIGFkZGl0aW9uYWwgZmxhZyBvbiB0aGUgZWxlbWVudCBzdGFydCB2YWx1ZS5cbiAgaWYgKGNsb3NlTmFtZSkge1xuICAgIGxldCBmbGFncyA9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWc7XG4gICAgbGV0IHZhbHVlOiBpci5JMThuUGFyYW1WYWx1ZVsndmFsdWUnXSA9IG9wLmhhbmRsZS5zbG90ITtcbiAgICAvLyBJZiB0aGUgZWxlbWVudCBpcyBhc3NvY2lhdGVkIHdpdGggYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSwgY2xvc2UgaXQgYXMgd2VsbC5cbiAgICBpZiAoc3RydWN0dXJhbERpcmVjdGl2ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBmbGFncyB8PSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnO1xuICAgICAgdmFsdWUgPSB7ZWxlbWVudDogdmFsdWUsIHRlbXBsYXRlOiBzdHJ1Y3R1cmFsRGlyZWN0aXZlLmhhbmRsZS5zbG90IX07XG4gICAgfVxuICAgIGFkZFBhcmFtKGkxOG5Db250ZXh0LnBhcmFtcywgY2xvc2VOYW1lLCB2YWx1ZSwgaTE4bkJsb2NrLnN1YlRlbXBsYXRlSW5kZXgsIGZsYWdzKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlY29yZHMgYW4gaTE4biBwYXJhbSB2YWx1ZSBmb3IgdGhlIHN0YXJ0IG9mIGEgdGVtcGxhdGUuXG4gKi9cbmZ1bmN0aW9uIHJlY29yZFRlbXBsYXRlU3RhcnQoXG4gICAgam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgb3A6IGlyLlRlbXBsYXRlT3AsIGkxOG5Db250ZXh0OiBpci5JMThuQ29udGV4dE9wLFxuICAgIGkxOG5CbG9jazogaXIuSTE4blN0YXJ0T3AsIHN0cnVjdHVyYWxEaXJlY3RpdmU/OiBpci5UZW1wbGF0ZU9wKSB7XG4gIGxldCB7c3RhcnROYW1lLCBjbG9zZU5hbWV9ID0gb3AuaTE4blBsYWNlaG9sZGVyITtcbiAgbGV0IGZsYWdzID0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZztcbiAgLy8gRm9yIHNlbGYtY2xvc2luZyB0YWdzLCB0aGVyZSBpcyBubyBjbG9zZSB0YWcgcGxhY2Vob2xkZXIuIEluc3RlYWQsIHRoZSBzdGFydCB0YWdcbiAgLy8gcGxhY2Vob2xkZXIgYWNjb3VudHMgZm9yIHRoZSBzdGFydCBhbmQgY2xvc2Ugb2YgdGhlIGVsZW1lbnQuXG4gIGlmICghY2xvc2VOYW1lKSB7XG4gICAgZmxhZ3MgfD0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZztcbiAgfVxuICAvLyBJZiB0aGUgdGVtcGxhdGUgaXMgYXNzb2NpYXRlZCB3aXRoIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUsIHJlY29yZCB0aGUgc3RydWN0dXJhbCBkaXJlY3RpdmUnc1xuICAvLyBzdGFydCBmaXJzdC4gU2luY2UgdGhpcyB0ZW1wbGF0ZSBtdXN0IGJlIGluIHRoZSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSdzIHZpZXcsIHdlIGNhbiBqdXN0XG4gIC8vIGRpcmVjdGx5IHVzZSB0aGUgY3VycmVudCBpMThuIGJsb2NrJ3Mgc3ViLXRlbXBsYXRlIGluZGV4LlxuICBpZiAoc3RydWN0dXJhbERpcmVjdGl2ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgYWRkUGFyYW0oXG4gICAgICAgIGkxOG5Db250ZXh0LnBhcmFtcywgc3RhcnROYW1lLCBzdHJ1Y3R1cmFsRGlyZWN0aXZlLmhhbmRsZS5zbG90ISwgaTE4bkJsb2NrLnN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgIGZsYWdzKTtcbiAgfVxuICAvLyBSZWNvcmQgdGhlIHN0YXJ0IG9mIHRoZSB0ZW1wbGF0ZS4gRm9yIHRoZSBzdWItdGVtcGxhdGUgaW5kZXgsIHBhc3MgdGhlIGluZGV4IGZvciB0aGUgdGVtcGxhdGUnc1xuICAvLyB2aWV3LCByYXRoZXIgdGhhbiB0aGUgY3VycmVudCBpMThuIGJsb2NrJ3MgaW5kZXguXG4gIGFkZFBhcmFtKFxuICAgICAgaTE4bkNvbnRleHQucGFyYW1zLCBzdGFydE5hbWUsIG9wLmhhbmRsZS5zbG90ISxcbiAgICAgIGdldFN1YlRlbXBsYXRlSW5kZXhGb3JUZW1wbGF0ZVRhZyhqb2IsIGkxOG5CbG9jaywgb3ApLCBmbGFncyk7XG59XG5cbi8qKlxuICogUmVjb3JkcyBhbiBpMThuIHBhcmFtIHZhbHVlIGZvciB0aGUgY2xvc2luZyBvZiBhIHRlbXBsYXRlLlxuICovXG5mdW5jdGlvbiByZWNvcmRUZW1wbGF0ZUNsb3NlKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIG9wOiBpci5UZW1wbGF0ZU9wLCBpMThuQ29udGV4dDogaXIuSTE4bkNvbnRleHRPcCxcbiAgICBpMThuQmxvY2s6IGlyLkkxOG5TdGFydE9wLCBzdHJ1Y3R1cmFsRGlyZWN0aXZlPzogaXIuVGVtcGxhdGVPcCkge1xuICBjb25zdCB7c3RhcnROYW1lLCBjbG9zZU5hbWV9ID0gb3AuaTE4blBsYWNlaG9sZGVyITtcbiAgY29uc3QgZmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZztcbiAgLy8gU2VsZi1jbG9zaW5nIHRhZ3MgZG9uJ3QgaGF2ZSBhIGNsb3NpbmcgdGFnIHBsYWNlaG9sZGVyLCBpbnN0ZWFkIHRoZSB0ZW1wbGF0ZSdzIGNsb3NpbmcgaXNcbiAgLy8gcmVjb3JkZWQgdmlhIGFuIGFkZGl0aW9uYWwgZmxhZyBvbiB0aGUgdGVtcGxhdGUgc3RhcnQgdmFsdWUuXG4gIGlmIChjbG9zZU5hbWUpIHtcbiAgICAvLyBSZWNvcmQgdGhlIGNsb3Npbmcgb2YgdGhlIHRlbXBsYXRlLiBGb3IgdGhlIHN1Yi10ZW1wbGF0ZSBpbmRleCwgcGFzcyB0aGUgaW5kZXggZm9yIHRoZVxuICAgIC8vIHRlbXBsYXRlJ3MgdmlldywgcmF0aGVyIHRoYW4gdGhlIGN1cnJlbnQgaTE4biBibG9jaydzIGluZGV4LlxuICAgIGFkZFBhcmFtKFxuICAgICAgICBpMThuQ29udGV4dC5wYXJhbXMsIGNsb3NlTmFtZSwgb3AuaGFuZGxlLnNsb3QhLFxuICAgICAgICBnZXRTdWJUZW1wbGF0ZUluZGV4Rm9yVGVtcGxhdGVUYWcoam9iLCBpMThuQmxvY2ssIG9wKSwgZmxhZ3MpO1xuICAgIC8vIElmIHRoZSB0ZW1wbGF0ZSBpcyBhc3NvY2lhdGVkIHdpdGggYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSwgcmVjb3JkIHRoZSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSdzXG4gICAgLy8gY2xvc2luZyBhZnRlci4gU2luY2UgdGhpcyB0ZW1wbGF0ZSBtdXN0IGJlIGluIHRoZSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSdzIHZpZXcsIHdlIGNhbiBqdXN0XG4gICAgLy8gZGlyZWN0bHkgdXNlIHRoZSBjdXJyZW50IGkxOG4gYmxvY2sncyBzdWItdGVtcGxhdGUgaW5kZXguXG4gICAgaWYgKHN0cnVjdHVyYWxEaXJlY3RpdmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgaTE4bkNvbnRleHQucGFyYW1zLCBjbG9zZU5hbWUsIHN0cnVjdHVyYWxEaXJlY3RpdmUuaGFuZGxlLnNsb3QhLFxuICAgICAgICAgIGkxOG5CbG9jay5zdWJUZW1wbGF0ZUluZGV4LCBmbGFncyk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2V0IHRoZSBzdWJUZW1wbGF0ZUluZGV4IGZvciB0aGUgZ2l2ZW4gdGVtcGxhdGUgb3AuIEZvciB0ZW1wbGF0ZSBvcHMsIHVzZSB0aGUgc3ViVGVtcGxhdGVJbmRleCBvZlxuICogdGhlIGNoaWxkIGkxOG4gYmxvY2sgaW5zaWRlIHRoZSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGkxOG5PcDogaXIuSTE4blN0YXJ0T3AsIG9wOiBpci5UZW1wbGF0ZU9wKTogbnVtYmVyfG51bGwge1xuICBmb3IgKGNvbnN0IGNoaWxkT3Agb2Ygam9iLnZpZXdzLmdldChvcC54cmVmKSEuY3JlYXRlKSB7XG4gICAgaWYgKGNoaWxkT3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgcmV0dXJuIGNoaWxkT3Auc3ViVGVtcGxhdGVJbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkxOG5PcC5zdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKipcbiAqIEFkZCBhIHBhcmFtIHZhbHVlIHRvIHRoZSBnaXZlbiBwYXJhbXMgbWFwLlxuICovXG5mdW5jdGlvbiBhZGRQYXJhbShcbiAgICBwYXJhbXM6IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+LCBwbGFjZWhvbGRlcjogc3RyaW5nLFxuICAgIHZhbHVlOiBzdHJpbmd8bnVtYmVyfHtlbGVtZW50OiBudW1iZXIsIHRlbXBsYXRlOiBudW1iZXJ9LCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICBmbGFnczogaXIuSTE4blBhcmFtVmFsdWVGbGFncykge1xuICBjb25zdCB2YWx1ZXMgPSBwYXJhbXMuZ2V0KHBsYWNlaG9sZGVyKSA/PyBbXTtcbiAgdmFsdWVzLnB1c2goe3ZhbHVlLCBzdWJUZW1wbGF0ZUluZGV4LCBmbGFnc30pO1xuICBwYXJhbXMuc2V0KHBsYWNlaG9sZGVyLCB2YWx1ZXMpO1xufVxuIl19