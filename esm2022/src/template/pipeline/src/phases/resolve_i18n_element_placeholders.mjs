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
                const view = job.views.get(op.xref);
                if (op.i18nPlaceholder === undefined) {
                    // If there is no i18n placeholder, just recurse into the view in case it contains i18n
                    // blocks.
                    resolvePlaceholdersForView(job, view, i18nContexts, elements);
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
                        resolvePlaceholdersForView(job, view, i18nContexts, elements, op);
                    }
                    else {
                        // If this is some other kind of template, we can record its start, recurse into its
                        // view, and then record its end.
                        recordTemplateStart(job, view, op.handle.slot, op.i18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                        resolvePlaceholdersForView(job, view, i18nContexts, elements);
                        recordTemplateClose(job, view, op.handle.slot, op.i18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                        pendingStructuralDirective = undefined;
                    }
                }
                break;
            case ir.OpKind.RepeaterCreate:
                if (pendingStructuralDirective !== undefined) {
                    throw Error('AssertionError: Unexpected structural directive associated with @for block');
                }
                // RepeaterCreate has 3 slots: the first is for the op itself, the second is for the @for
                // template and the (optional) third is for the @empty template.
                const forSlot = op.handle.slot + 1;
                const forView = job.views.get(op.xref);
                // First record all of the placeholders for the @for template.
                if (op.i18nPlaceholder === undefined) {
                    // If there is no i18n placeholder, just recurse into the view in case it contains i18n
                    // blocks.
                    resolvePlaceholdersForView(job, forView, i18nContexts, elements);
                }
                else {
                    if (currentOps === null) {
                        throw Error('i18n tag placeholder should only occur inside an i18n block');
                    }
                    recordTemplateStart(job, forView, forSlot, op.i18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                    resolvePlaceholdersForView(job, forView, i18nContexts, elements);
                    recordTemplateClose(job, forView, forSlot, op.i18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                    pendingStructuralDirective = undefined;
                }
                // Then if there's an @empty template, add its placeholders as well.
                if (op.emptyView !== null) {
                    // RepeaterCreate has 3 slots: the first is for the op itself, the second is for the @for
                    // template and the (optional) third is for the @empty template.
                    const emptySlot = op.handle.slot + 2;
                    const emptyView = job.views.get(op.emptyView);
                    if (op.emptyI18nPlaceholder === undefined) {
                        // If there is no i18n placeholder, just recurse into the view in case it contains i18n
                        // blocks.
                        resolvePlaceholdersForView(job, emptyView, i18nContexts, elements);
                    }
                    else {
                        if (currentOps === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        recordTemplateStart(job, emptyView, emptySlot, op.emptyI18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
                        resolvePlaceholdersForView(job, emptyView, i18nContexts, elements);
                        recordTemplateClose(job, emptyView, emptySlot, op.emptyI18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
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
function recordTemplateStart(job, view, slot, i18nPlaceholder, i18nContext, i18nBlock, structuralDirective) {
    let { startName, closeName } = i18nPlaceholder;
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
    addParam(i18nContext.params, startName, slot, getSubTemplateIndexForTemplateTag(job, i18nBlock, view), flags);
}
/**
 * Records an i18n param value for the closing of a template.
 */
function recordTemplateClose(job, view, slot, i18nPlaceholder, i18nContext, i18nBlock, structuralDirective) {
    const { startName, closeName } = i18nPlaceholder;
    const flags = ir.I18nParamValueFlags.TemplateTag | ir.I18nParamValueFlags.CloseTag;
    // Self-closing tags don't have a closing tag placeholder, instead the template's closing is
    // recorded via an additional flag on the template start value.
    if (closeName) {
        // Record the closing of the template. For the sub-template index, pass the index for the
        // template's view, rather than the current i18n block's index.
        addParam(i18nContext.params, closeName, slot, getSubTemplateIndexForTemplateTag(job, i18nBlock, view), flags);
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
function getSubTemplateIndexForTemplateTag(job, i18nOp, view) {
    for (const childOp of view.create) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvcmVzb2x2ZV9pMThuX2VsZW1lbnRfcGxhY2Vob2xkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRy9COztHQUVHO0FBQ0gsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQTRCO0lBQ3pFLGdFQUFnRTtJQUNoRSxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM1RCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUN6RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7UUFDNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQzVCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRTtnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVztvQkFDeEIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUM5QixNQUFNO2dCQUNSLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZO29CQUN6QixRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzFCLE1BQU07YUFDVDtTQUNGO0tBQ0Y7SUFFRCwwQkFBMEIsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDcEUsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUywwQkFBMEIsQ0FDL0IsR0FB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QUdHO0FBQ0gsU0FBUyxpQ0FBaUMsQ0FDdEMsR0FBNEIsRUFBRSxNQUFzQixFQUFFLElBQXlCO0lBQ2pGLEtBQUssTUFBTSxPQUFPLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNqQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7WUFDeEMsT0FBTyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7U0FDakM7S0FDRjtJQUNELE9BQU8sTUFBTSxDQUFDLGdCQUFnQixDQUFDO0FBQ2pDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsUUFBUSxDQUNiLE1BQXdDLEVBQUUsV0FBbUIsRUFDN0QsS0FBd0QsRUFBRSxnQkFBNkIsRUFDdkYsS0FBNkI7SUFDL0IsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDN0MsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO0lBQzlDLE1BQU0sQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIFZpZXdDb21waWxhdGlvblVuaXR9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBlbGVtZW50IHBsYWNlaG9sZGVycyBpbiBpMThuIG1lc3NhZ2VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUkxOG5FbGVtZW50UGxhY2Vob2xkZXJzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgLy8gUmVjb3JkIGFsbCBvZiB0aGUgZWxlbWVudCBhbmQgaTE4biBjb250ZXh0IG9wcyBmb3IgdXNlIGxhdGVyLlxuICBjb25zdCBpMThuQ29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4oKTtcbiAgY29uc3QgZWxlbWVudHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudFN0YXJ0T3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkNvbnRleHQ6XG4gICAgICAgICAgaTE4bkNvbnRleHRzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgICAgICBlbGVtZW50cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KGpvYiwgam9iLnJvb3QsIGkxOG5Db250ZXh0cywgZWxlbWVudHMpO1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IHJlc29sdmVzIGVsZW1lbnQgYW5kIHRlbXBsYXRlIHRhZyBwbGFjZWhvbGRlcnMgaW4gdGhlIGdpdmVuIHZpZXcuXG4gKi9cbmZ1bmN0aW9uIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIHVuaXQ6IFZpZXdDb21waWxhdGlvblVuaXQsXG4gICAgaTE4bkNvbnRleHRzOiBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPiwgZWxlbWVudHM6IE1hcDxpci5YcmVmSWQsIGlyLkVsZW1lbnRTdGFydE9wPixcbiAgICBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZT86IGlyLlRlbXBsYXRlT3ApIHtcbiAgLy8gVHJhY2sgdGhlIGN1cnJlbnQgaTE4biBvcCBhbmQgY29ycmVzcG9uZGluZyBpMThuIGNvbnRleHQgb3AgYXMgd2Ugc3RlcCB0aHJvdWdoIHRoZSBjcmVhdGlvblxuICAvLyBJUi5cbiAgbGV0IGN1cnJlbnRPcHM6IHtpMThuQmxvY2s6IGlyLkkxOG5TdGFydE9wLCBpMThuQ29udGV4dDogaXIuSTE4bkNvbnRleHRPcH18bnVsbCA9IG51bGw7XG4gIGxldCBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZUNsb3NlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5UZW1wbGF0ZU9wPigpO1xuICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgIGlmICghb3AuY29udGV4dCkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdDb3VsZCBub3QgZmluZCBpMThuIGNvbnRleHQgZm9yIGkxOG4gb3AnKTtcbiAgICAgICAgfVxuICAgICAgICBjdXJyZW50T3BzID0ge2kxOG5CbG9jazogb3AsIGkxOG5Db250ZXh0OiBpMThuQ29udGV4dHMuZ2V0KG9wLmNvbnRleHQpIX07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgY3VycmVudE9wcyA9IG51bGw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRhZyBzdGFydCBwbGFjZWhvbGRlci5cbiAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZWNvcmRFbGVtZW50U3RhcnQoXG4gICAgICAgICAgICAgIG9wLCBjdXJyZW50T3BzLmkxOG5Db250ZXh0LCBjdXJyZW50T3BzLmkxOG5CbG9jaywgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUpO1xuICAgICAgICAgIC8vIElmIHRoZXJlIGlzIGEgc2VwYXJhdGUgY2xvc2UgdGFnIHBsYWNlaG9sZGVyIGZvciB0aGlzIGVsZW1lbnQsIHNhdmUgdGhlIHBlbmRpbmdcbiAgICAgICAgICAvLyBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSBzbyB3ZSBjYW4gcGFzcyBpdCB0byB0aGUgY2xvc2luZyB0YWcgYXMgd2VsbC5cbiAgICAgICAgICBpZiAocGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUgJiYgb3AuaTE4blBsYWNlaG9sZGVyLmNsb3NlTmFtZSkge1xuICAgICAgICAgICAgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmVDbG9zZXMuc2V0KG9wLnhyZWYsIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gQ2xlYXIgb3V0IHRoZSBwZW5kaW5nIHN0cnVjdHVyYWwgZGlyZWN0aXZlIG5vdyB0aGF0IGl0cyBiZWVuIGFjY291bnRlZCBmb3IuXG4gICAgICAgICAgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGlyLk9wS2luZC5FbGVtZW50RW5kOlxuICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRhZyBjbG9zZSBwbGFjZWhvbGRlci5cbiAgICAgICAgY29uc3Qgc3RhcnRPcCA9IGVsZW1lbnRzLmdldChvcC54cmVmKTtcbiAgICAgICAgaWYgKHN0YXJ0T3AgJiYgc3RhcnRPcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgICAgICAnQXNzZXJ0aW9uRXJyb3I6IGkxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlY29yZEVsZW1lbnRDbG9zZShcbiAgICAgICAgICAgICAgc3RhcnRPcCwgY3VycmVudE9wcy5pMThuQ29udGV4dCwgY3VycmVudE9wcy5pMThuQmxvY2ssXG4gICAgICAgICAgICAgIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlQ2xvc2VzLmdldChvcC54cmVmKSk7XG4gICAgICAgICAgLy8gQ2xlYXIgb3V0IHRoZSBwZW5kaW5nIHN0cnVjdHVyYWwgZGlyZWN0aXZlIGNsb3NlIHRoYXQgd2FzIGFjY291bnRlZCBmb3IuXG4gICAgICAgICAgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmVDbG9zZXMuZGVsZXRlKG9wLnhyZWYpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBpci5PcEtpbmQuUHJvamVjdGlvbjpcbiAgICAgICAgLy8gRm9yIGNvbnRlbnQgcHJvamVjdGlvbnMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwXG4gICAgICAgIC8vIHVuZGVyIHRoZSBjb3JyZXNwb25kaW5nIHRhZyBzdGFydCBhbmQgY2xvc2UgcGxhY2Vob2xkZXJzLlxuICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAoY3VycmVudE9wcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlY29yZEVsZW1lbnRTdGFydChcbiAgICAgICAgICAgICAgb3AsIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQsIGN1cnJlbnRPcHMuaTE4bkJsb2NrLCBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZSk7XG4gICAgICAgICAgcmVjb3JkRWxlbWVudENsb3NlKFxuICAgICAgICAgICAgICBvcCwgY3VycmVudE9wcy5pMThuQ29udGV4dCwgY3VycmVudE9wcy5pMThuQmxvY2ssIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlKTtcbiAgICAgICAgICAvLyBDbGVhciBvdXQgdGhlIHBlbmRpbmcgc3RydWN0dXJhbCBkaXJlY3RpdmUgbm93IHRoYXQgaXRzIGJlZW4gYWNjb3VudGVkIGZvci5cbiAgICAgICAgICBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlRlbXBsYXRlOlxuICAgICAgICBjb25zdCB2aWV3ID0gam9iLnZpZXdzLmdldChvcC54cmVmKSE7XG4gICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIElmIHRoZXJlIGlzIG5vIGkxOG4gcGxhY2Vob2xkZXIsIGp1c3QgcmVjdXJzZSBpbnRvIHRoZSB2aWV3IGluIGNhc2UgaXQgY29udGFpbnMgaTE4blxuICAgICAgICAgIC8vIGJsb2Nrcy5cbiAgICAgICAgICByZXNvbHZlUGxhY2Vob2xkZXJzRm9yVmlldyhqb2IsIHZpZXcsIGkxOG5Db250ZXh0cywgZWxlbWVudHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChjdXJyZW50T3BzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wLnRlbXBsYXRlS2luZCA9PT0gaXIuVGVtcGxhdGVLaW5kLlN0cnVjdHVyYWwpIHtcbiAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSB0ZW1wbGF0ZSwgZG9uJ3QgcmVjb3JkIGFueXRoaW5nIHlldC4gSW5zdGVhZCBwYXNzXG4gICAgICAgICAgICAvLyB0aGUgY3VycmVudCB0ZW1wbGF0ZSBhcyBhIHBlbmRpbmcgc3RydWN0dXJhbCBkaXJlY3RpdmUgdG8gYmUgcmVjb3JkZWQgd2hlbiB3ZSBmaW5kXG4gICAgICAgICAgICAvLyB0aGUgZWxlbWVudCwgY29udGVudCwgb3IgdGVtcGxhdGUgaXQgYmVsb25ncyB0by4gVGhpcyBhbGxvd3MgdXMgdG8gY3JlYXRlIGNvbWJpbmVkXG4gICAgICAgICAgICAvLyB2YWx1ZXMgdGhhdCByZXByZXNlbnQsIGUuZy4gdGhlIHN0YXJ0IG9mIGEgdGVtcGxhdGUgYW5kIGVsZW1lbnQgYXQgdGhlIHNhbWUgdGltZS5cbiAgICAgICAgICAgIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KGpvYiwgdmlldywgaTE4bkNvbnRleHRzLCBlbGVtZW50cywgb3ApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJZiB0aGlzIGlzIHNvbWUgb3RoZXIga2luZCBvZiB0ZW1wbGF0ZSwgd2UgY2FuIHJlY29yZCBpdHMgc3RhcnQsIHJlY3Vyc2UgaW50byBpdHNcbiAgICAgICAgICAgIC8vIHZpZXcsIGFuZCB0aGVuIHJlY29yZCBpdHMgZW5kLlxuICAgICAgICAgICAgcmVjb3JkVGVtcGxhdGVTdGFydChcbiAgICAgICAgICAgICAgICBqb2IsIHZpZXcsIG9wLmhhbmRsZS5zbG90ISwgb3AuaTE4blBsYWNlaG9sZGVyLCBjdXJyZW50T3BzLmkxOG5Db250ZXh0LFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMuaTE4bkJsb2NrLCBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZSk7XG4gICAgICAgICAgICByZXNvbHZlUGxhY2Vob2xkZXJzRm9yVmlldyhqb2IsIHZpZXcsIGkxOG5Db250ZXh0cywgZWxlbWVudHMpO1xuICAgICAgICAgICAgcmVjb3JkVGVtcGxhdGVDbG9zZShcbiAgICAgICAgICAgICAgICBqb2IsIHZpZXcsIG9wLmhhbmRsZS5zbG90ISwgb3AuaTE4blBsYWNlaG9sZGVyLCBjdXJyZW50T3BzIS5pMThuQ29udGV4dCxcbiAgICAgICAgICAgICAgICBjdXJyZW50T3BzIS5pMThuQmxvY2ssIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlKTtcbiAgICAgICAgICAgIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgaXIuT3BLaW5kLlJlcGVhdGVyQ3JlYXRlOlxuICAgICAgICBpZiAocGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdBc3NlcnRpb25FcnJvcjogVW5leHBlY3RlZCBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSBhc3NvY2lhdGVkIHdpdGggQGZvciBibG9jaycpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFJlcGVhdGVyQ3JlYXRlIGhhcyAzIHNsb3RzOiB0aGUgZmlyc3QgaXMgZm9yIHRoZSBvcCBpdHNlbGYsIHRoZSBzZWNvbmQgaXMgZm9yIHRoZSBAZm9yXG4gICAgICAgIC8vIHRlbXBsYXRlIGFuZCB0aGUgKG9wdGlvbmFsKSB0aGlyZCBpcyBmb3IgdGhlIEBlbXB0eSB0ZW1wbGF0ZS5cbiAgICAgICAgY29uc3QgZm9yU2xvdCA9IG9wLmhhbmRsZS5zbG90ISArIDE7XG4gICAgICAgIGNvbnN0IGZvclZpZXcgPSBqb2Iudmlld3MuZ2V0KG9wLnhyZWYpITtcbiAgICAgICAgLy8gRmlyc3QgcmVjb3JkIGFsbCBvZiB0aGUgcGxhY2Vob2xkZXJzIGZvciB0aGUgQGZvciB0ZW1wbGF0ZS5cbiAgICAgICAgaWYgKG9wLmkxOG5QbGFjZWhvbGRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgaXMgbm8gaTE4biBwbGFjZWhvbGRlciwganVzdCByZWN1cnNlIGludG8gdGhlIHZpZXcgaW4gY2FzZSBpdCBjb250YWlucyBpMThuXG4gICAgICAgICAgLy8gYmxvY2tzLlxuICAgICAgICAgIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KGpvYiwgZm9yVmlldywgaTE4bkNvbnRleHRzLCBlbGVtZW50cyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGN1cnJlbnRPcHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZWNvcmRUZW1wbGF0ZVN0YXJ0KFxuICAgICAgICAgICAgICBqb2IsIGZvclZpZXcsIGZvclNsb3QsIG9wLmkxOG5QbGFjZWhvbGRlciwgY3VycmVudE9wcy5pMThuQ29udGV4dCxcbiAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQmxvY2ssIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlKTtcbiAgICAgICAgICByZXNvbHZlUGxhY2Vob2xkZXJzRm9yVmlldyhqb2IsIGZvclZpZXcsIGkxOG5Db250ZXh0cywgZWxlbWVudHMpO1xuICAgICAgICAgIHJlY29yZFRlbXBsYXRlQ2xvc2UoXG4gICAgICAgICAgICAgIGpvYiwgZm9yVmlldywgZm9yU2xvdCwgb3AuaTE4blBsYWNlaG9sZGVyLCBjdXJyZW50T3BzIS5pMThuQ29udGV4dCxcbiAgICAgICAgICAgICAgY3VycmVudE9wcyEuaTE4bkJsb2NrLCBwZW5kaW5nU3RydWN0dXJhbERpcmVjdGl2ZSk7XG4gICAgICAgICAgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhlbiBpZiB0aGVyZSdzIGFuIEBlbXB0eSB0ZW1wbGF0ZSwgYWRkIGl0cyBwbGFjZWhvbGRlcnMgYXMgd2VsbC5cbiAgICAgICAgaWYgKG9wLmVtcHR5VmlldyAhPT0gbnVsbCkge1xuICAgICAgICAgIC8vIFJlcGVhdGVyQ3JlYXRlIGhhcyAzIHNsb3RzOiB0aGUgZmlyc3QgaXMgZm9yIHRoZSBvcCBpdHNlbGYsIHRoZSBzZWNvbmQgaXMgZm9yIHRoZSBAZm9yXG4gICAgICAgICAgLy8gdGVtcGxhdGUgYW5kIHRoZSAob3B0aW9uYWwpIHRoaXJkIGlzIGZvciB0aGUgQGVtcHR5IHRlbXBsYXRlLlxuICAgICAgICAgIGNvbnN0IGVtcHR5U2xvdCA9IG9wLmhhbmRsZS5zbG90ISArIDI7XG4gICAgICAgICAgY29uc3QgZW1wdHlWaWV3ID0gam9iLnZpZXdzLmdldChvcC5lbXB0eVZpZXchKSE7XG4gICAgICAgICAgaWYgKG9wLmVtcHR5STE4blBsYWNlaG9sZGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGlzIG5vIGkxOG4gcGxhY2Vob2xkZXIsIGp1c3QgcmVjdXJzZSBpbnRvIHRoZSB2aWV3IGluIGNhc2UgaXQgY29udGFpbnMgaTE4blxuICAgICAgICAgICAgLy8gYmxvY2tzLlxuICAgICAgICAgICAgcmVzb2x2ZVBsYWNlaG9sZGVyc0ZvclZpZXcoam9iLCBlbXB0eVZpZXcsIGkxOG5Db250ZXh0cywgZWxlbWVudHMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudE9wcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvcignaTE4biB0YWcgcGxhY2Vob2xkZXIgc2hvdWxkIG9ubHkgb2NjdXIgaW5zaWRlIGFuIGkxOG4gYmxvY2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlY29yZFRlbXBsYXRlU3RhcnQoXG4gICAgICAgICAgICAgICAgam9iLCBlbXB0eVZpZXcsIGVtcHR5U2xvdCwgb3AuZW1wdHlJMThuUGxhY2Vob2xkZXIsIGN1cnJlbnRPcHMuaTE4bkNvbnRleHQsXG4gICAgICAgICAgICAgICAgY3VycmVudE9wcy5pMThuQmxvY2ssIHBlbmRpbmdTdHJ1Y3R1cmFsRGlyZWN0aXZlKTtcbiAgICAgICAgICAgIHJlc29sdmVQbGFjZWhvbGRlcnNGb3JWaWV3KGpvYiwgZW1wdHlWaWV3LCBpMThuQ29udGV4dHMsIGVsZW1lbnRzKTtcbiAgICAgICAgICAgIHJlY29yZFRlbXBsYXRlQ2xvc2UoXG4gICAgICAgICAgICAgICAgam9iLCBlbXB0eVZpZXcsIGVtcHR5U2xvdCwgb3AuZW1wdHlJMThuUGxhY2Vob2xkZXIsIGN1cnJlbnRPcHMhLmkxOG5Db250ZXh0LFxuICAgICAgICAgICAgICAgIGN1cnJlbnRPcHMhLmkxOG5CbG9jaywgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUpO1xuICAgICAgICAgICAgcGVuZGluZ1N0cnVjdHVyYWxEaXJlY3RpdmUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlY29yZHMgYW4gaTE4biBwYXJhbSB2YWx1ZSBmb3IgdGhlIHN0YXJ0IG9mIGFuIGVsZW1lbnQuXG4gKi9cbmZ1bmN0aW9uIHJlY29yZEVsZW1lbnRTdGFydChcbiAgICBvcDogaXIuRWxlbWVudFN0YXJ0T3B8aXIuUHJvamVjdGlvbk9wLCBpMThuQ29udGV4dDogaXIuSTE4bkNvbnRleHRPcCwgaTE4bkJsb2NrOiBpci5JMThuU3RhcnRPcCxcbiAgICBzdHJ1Y3R1cmFsRGlyZWN0aXZlPzogaXIuVGVtcGxhdGVPcCkge1xuICBjb25zdCB7c3RhcnROYW1lLCBjbG9zZU5hbWV9ID0gb3AuaTE4blBsYWNlaG9sZGVyITtcbiAgbGV0IGZsYWdzID0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnO1xuICBsZXQgdmFsdWU6IGlyLkkxOG5QYXJhbVZhbHVlWyd2YWx1ZSddID0gb3AuaGFuZGxlLnNsb3QhO1xuICAvLyBJZiB0aGUgZWxlbWVudCBpcyBhc3NvY2lhdGVkIHdpdGggYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSwgc3RhcnQgaXQgYXMgd2VsbC5cbiAgaWYgKHN0cnVjdHVyYWxEaXJlY3RpdmUgIT09IHVuZGVmaW5lZCkge1xuICAgIGZsYWdzIHw9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWc7XG4gICAgdmFsdWUgPSB7ZWxlbWVudDogdmFsdWUsIHRlbXBsYXRlOiBzdHJ1Y3R1cmFsRGlyZWN0aXZlLmhhbmRsZS5zbG90IX07XG4gIH1cbiAgLy8gRm9yIHNlbGYtY2xvc2luZyB0YWdzLCB0aGVyZSBpcyBubyBjbG9zZSB0YWcgcGxhY2Vob2xkZXIuIEluc3RlYWQsIHRoZSBzdGFydCB0YWdcbiAgLy8gcGxhY2Vob2xkZXIgYWNjb3VudHMgZm9yIHRoZSBzdGFydCBhbmQgY2xvc2Ugb2YgdGhlIGVsZW1lbnQuXG4gIGlmICghY2xvc2VOYW1lKSB7XG4gICAgZmxhZ3MgfD0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZztcbiAgfVxuICBhZGRQYXJhbShpMThuQ29udGV4dC5wYXJhbXMsIHN0YXJ0TmFtZSwgdmFsdWUsIGkxOG5CbG9jay5zdWJUZW1wbGF0ZUluZGV4LCBmbGFncyk7XG59XG5cbi8qKlxuICogUmVjb3JkcyBhbiBpMThuIHBhcmFtIHZhbHVlIGZvciB0aGUgY2xvc2luZyBvZiBhbiBlbGVtZW50LlxuICovXG5mdW5jdGlvbiByZWNvcmRFbGVtZW50Q2xvc2UoXG4gICAgb3A6IGlyLkVsZW1lbnRTdGFydE9wfGlyLlByb2plY3Rpb25PcCwgaTE4bkNvbnRleHQ6IGlyLkkxOG5Db250ZXh0T3AsIGkxOG5CbG9jazogaXIuSTE4blN0YXJ0T3AsXG4gICAgc3RydWN0dXJhbERpcmVjdGl2ZT86IGlyLlRlbXBsYXRlT3ApIHtcbiAgY29uc3Qge2Nsb3NlTmFtZX0gPSBvcC5pMThuUGxhY2Vob2xkZXIhO1xuICAvLyBTZWxmLWNsb3NpbmcgdGFncyBkb24ndCBoYXZlIGEgY2xvc2luZyB0YWcgcGxhY2Vob2xkZXIsIGluc3RlYWQgdGhlIGVsZW1lbnQgY2xvc2luZyBpc1xuICAvLyByZWNvcmRlZCB2aWEgYW4gYWRkaXRpb25hbCBmbGFnIG9uIHRoZSBlbGVtZW50IHN0YXJ0IHZhbHVlLlxuICBpZiAoY2xvc2VOYW1lKSB7XG4gICAgbGV0IGZsYWdzID0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZztcbiAgICBsZXQgdmFsdWU6IGlyLkkxOG5QYXJhbVZhbHVlWyd2YWx1ZSddID0gb3AuaGFuZGxlLnNsb3QhO1xuICAgIC8vIElmIHRoZSBlbGVtZW50IGlzIGFzc29jaWF0ZWQgd2l0aCBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlLCBjbG9zZSBpdCBhcyB3ZWxsLlxuICAgIGlmIChzdHJ1Y3R1cmFsRGlyZWN0aXZlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGZsYWdzIHw9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWc7XG4gICAgICB2YWx1ZSA9IHtlbGVtZW50OiB2YWx1ZSwgdGVtcGxhdGU6IHN0cnVjdHVyYWxEaXJlY3RpdmUuaGFuZGxlLnNsb3QhfTtcbiAgICB9XG4gICAgYWRkUGFyYW0oaTE4bkNvbnRleHQucGFyYW1zLCBjbG9zZU5hbWUsIHZhbHVlLCBpMThuQmxvY2suc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3MpO1xuICB9XG59XG5cbi8qKlxuICogUmVjb3JkcyBhbiBpMThuIHBhcmFtIHZhbHVlIGZvciB0aGUgc3RhcnQgb2YgYSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gcmVjb3JkVGVtcGxhdGVTdGFydChcbiAgICBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCB2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzbG90OiBudW1iZXIsXG4gICAgaTE4blBsYWNlaG9sZGVyOiBpMThuLlRhZ1BsYWNlaG9sZGVyfGkxOG4uQmxvY2tQbGFjZWhvbGRlciwgaTE4bkNvbnRleHQ6IGlyLkkxOG5Db250ZXh0T3AsXG4gICAgaTE4bkJsb2NrOiBpci5JMThuU3RhcnRPcCwgc3RydWN0dXJhbERpcmVjdGl2ZT86IGlyLlRlbXBsYXRlT3ApIHtcbiAgbGV0IHtzdGFydE5hbWUsIGNsb3NlTmFtZX0gPSBpMThuUGxhY2Vob2xkZXI7XG4gIGxldCBmbGFncyA9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcgfCBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWc7XG4gIC8vIEZvciBzZWxmLWNsb3NpbmcgdGFncywgdGhlcmUgaXMgbm8gY2xvc2UgdGFnIHBsYWNlaG9sZGVyLiBJbnN0ZWFkLCB0aGUgc3RhcnQgdGFnXG4gIC8vIHBsYWNlaG9sZGVyIGFjY291bnRzIGZvciB0aGUgc3RhcnQgYW5kIGNsb3NlIG9mIHRoZSBlbGVtZW50LlxuICBpZiAoIWNsb3NlTmFtZSkge1xuICAgIGZsYWdzIHw9IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWc7XG4gIH1cbiAgLy8gSWYgdGhlIHRlbXBsYXRlIGlzIGFzc29jaWF0ZWQgd2l0aCBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlLCByZWNvcmQgdGhlIHN0cnVjdHVyYWwgZGlyZWN0aXZlJ3NcbiAgLy8gc3RhcnQgZmlyc3QuIFNpbmNlIHRoaXMgdGVtcGxhdGUgbXVzdCBiZSBpbiB0aGUgc3RydWN0dXJhbCBkaXJlY3RpdmUncyB2aWV3LCB3ZSBjYW4ganVzdFxuICAvLyBkaXJlY3RseSB1c2UgdGhlIGN1cnJlbnQgaTE4biBibG9jaydzIHN1Yi10ZW1wbGF0ZSBpbmRleC5cbiAgaWYgKHN0cnVjdHVyYWxEaXJlY3RpdmUgIT09IHVuZGVmaW5lZCkge1xuICAgIGFkZFBhcmFtKFxuICAgICAgICBpMThuQ29udGV4dC5wYXJhbXMsIHN0YXJ0TmFtZSwgc3RydWN0dXJhbERpcmVjdGl2ZS5oYW5kbGUuc2xvdCEsIGkxOG5CbG9jay5zdWJUZW1wbGF0ZUluZGV4LFxuICAgICAgICBmbGFncyk7XG4gIH1cbiAgLy8gUmVjb3JkIHRoZSBzdGFydCBvZiB0aGUgdGVtcGxhdGUuIEZvciB0aGUgc3ViLXRlbXBsYXRlIGluZGV4LCBwYXNzIHRoZSBpbmRleCBmb3IgdGhlIHRlbXBsYXRlJ3NcbiAgLy8gdmlldywgcmF0aGVyIHRoYW4gdGhlIGN1cnJlbnQgaTE4biBibG9jaydzIGluZGV4LlxuICBhZGRQYXJhbShcbiAgICAgIGkxOG5Db250ZXh0LnBhcmFtcywgc3RhcnROYW1lLCBzbG90LCBnZXRTdWJUZW1wbGF0ZUluZGV4Rm9yVGVtcGxhdGVUYWcoam9iLCBpMThuQmxvY2ssIHZpZXcpLFxuICAgICAgZmxhZ3MpO1xufVxuXG4vKipcbiAqIFJlY29yZHMgYW4gaTE4biBwYXJhbSB2YWx1ZSBmb3IgdGhlIGNsb3Npbmcgb2YgYSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gcmVjb3JkVGVtcGxhdGVDbG9zZShcbiAgICBqb2I6IENvbXBvbmVudENvbXBpbGF0aW9uSm9iLCB2aWV3OiBWaWV3Q29tcGlsYXRpb25Vbml0LCBzbG90OiBudW1iZXIsXG4gICAgaTE4blBsYWNlaG9sZGVyOiBpMThuLlRhZ1BsYWNlaG9sZGVyfGkxOG4uQmxvY2tQbGFjZWhvbGRlciwgaTE4bkNvbnRleHQ6IGlyLkkxOG5Db250ZXh0T3AsXG4gICAgaTE4bkJsb2NrOiBpci5JMThuU3RhcnRPcCwgc3RydWN0dXJhbERpcmVjdGl2ZT86IGlyLlRlbXBsYXRlT3ApIHtcbiAgY29uc3Qge3N0YXJ0TmFtZSwgY2xvc2VOYW1lfSA9IGkxOG5QbGFjZWhvbGRlcjtcbiAgY29uc3QgZmxhZ3MgPSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZztcbiAgLy8gU2VsZi1jbG9zaW5nIHRhZ3MgZG9uJ3QgaGF2ZSBhIGNsb3NpbmcgdGFnIHBsYWNlaG9sZGVyLCBpbnN0ZWFkIHRoZSB0ZW1wbGF0ZSdzIGNsb3NpbmcgaXNcbiAgLy8gcmVjb3JkZWQgdmlhIGFuIGFkZGl0aW9uYWwgZmxhZyBvbiB0aGUgdGVtcGxhdGUgc3RhcnQgdmFsdWUuXG4gIGlmIChjbG9zZU5hbWUpIHtcbiAgICAvLyBSZWNvcmQgdGhlIGNsb3Npbmcgb2YgdGhlIHRlbXBsYXRlLiBGb3IgdGhlIHN1Yi10ZW1wbGF0ZSBpbmRleCwgcGFzcyB0aGUgaW5kZXggZm9yIHRoZVxuICAgIC8vIHRlbXBsYXRlJ3MgdmlldywgcmF0aGVyIHRoYW4gdGhlIGN1cnJlbnQgaTE4biBibG9jaydzIGluZGV4LlxuICAgIGFkZFBhcmFtKFxuICAgICAgICBpMThuQ29udGV4dC5wYXJhbXMsIGNsb3NlTmFtZSwgc2xvdCxcbiAgICAgICAgZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKGpvYiwgaTE4bkJsb2NrLCB2aWV3KSwgZmxhZ3MpO1xuICAgIC8vIElmIHRoZSB0ZW1wbGF0ZSBpcyBhc3NvY2lhdGVkIHdpdGggYSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSwgcmVjb3JkIHRoZSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSdzXG4gICAgLy8gY2xvc2luZyBhZnRlci4gU2luY2UgdGhpcyB0ZW1wbGF0ZSBtdXN0IGJlIGluIHRoZSBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZSdzIHZpZXcsIHdlIGNhbiBqdXN0XG4gICAgLy8gZGlyZWN0bHkgdXNlIHRoZSBjdXJyZW50IGkxOG4gYmxvY2sncyBzdWItdGVtcGxhdGUgaW5kZXguXG4gICAgaWYgKHN0cnVjdHVyYWxEaXJlY3RpdmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgaTE4bkNvbnRleHQucGFyYW1zLCBjbG9zZU5hbWUsIHN0cnVjdHVyYWxEaXJlY3RpdmUuaGFuZGxlLnNsb3QhLFxuICAgICAgICAgIGkxOG5CbG9jay5zdWJUZW1wbGF0ZUluZGV4LCBmbGFncyk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR2V0IHRoZSBzdWJUZW1wbGF0ZUluZGV4IGZvciB0aGUgZ2l2ZW4gdGVtcGxhdGUgb3AuIEZvciB0ZW1wbGF0ZSBvcHMsIHVzZSB0aGUgc3ViVGVtcGxhdGVJbmRleCBvZlxuICogdGhlIGNoaWxkIGkxOG4gYmxvY2sgaW5zaWRlIHRoZSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGkxOG5PcDogaXIuSTE4blN0YXJ0T3AsIHZpZXc6IFZpZXdDb21waWxhdGlvblVuaXQpOiBudW1iZXJ8bnVsbCB7XG4gIGZvciAoY29uc3QgY2hpbGRPcCBvZiB2aWV3LmNyZWF0ZSkge1xuICAgIGlmIChjaGlsZE9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQpIHtcbiAgICAgIHJldHVybiBjaGlsZE9wLnN1YlRlbXBsYXRlSW5kZXg7XG4gICAgfVxuICB9XG4gIHJldHVybiBpMThuT3Auc3ViVGVtcGxhdGVJbmRleDtcbn1cblxuLyoqXG4gKiBBZGQgYSBwYXJhbSB2YWx1ZSB0byB0aGUgZ2l2ZW4gcGFyYW1zIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkUGFyYW0oXG4gICAgcGFyYW1zOiBNYXA8c3RyaW5nLCBpci5JMThuUGFyYW1WYWx1ZVtdPiwgcGxhY2Vob2xkZXI6IHN0cmluZyxcbiAgICB2YWx1ZTogc3RyaW5nfG51bWJlcnx7ZWxlbWVudDogbnVtYmVyLCB0ZW1wbGF0ZTogbnVtYmVyfSwgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGwsXG4gICAgZmxhZ3M6IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MpIHtcbiAgY29uc3QgdmFsdWVzID0gcGFyYW1zLmdldChwbGFjZWhvbGRlcikgPz8gW107XG4gIHZhbHVlcy5wdXNoKHt2YWx1ZSwgc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3N9KTtcbiAgcGFyYW1zLnNldChwbGFjZWhvbGRlciwgdmFsdWVzKTtcbn1cbiJdfQ==