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
 * Marker used to indicate an element tag.
 */
const ELEMENT_MARKER = '#';
/**
 * Marker used to indicate a template tag.
 */
const TEMPLATE_MARKER = '*';
/**
 * Marker used to indicate closing of an element or template tag.
 */
const TAG_CLOSE_MARKER = '/';
/**
 * Marker used to indicate the sub-template context.
 */
const CONTEXT_MARKER = ':';
/**
 * Marker used to indicate the start of a list of values.
 */
const LIST_START_MARKER = '[';
/**
 * Marker used to indicate the end of a list of values.
 */
const LIST_END_MARKER = ']';
/**
 * Delimiter used to separate multiple values in a list.
 */
const LIST_DELIMITER = '|';
/**
 * Formats the param maps on extracted message ops into a maps of `Expression` objects that can be
 * used in the final output.
 */
export function extractI18nMessages(job) {
    // Create an i18n message for each context.
    // TODO: Merge the context op with the message op since they're 1:1 anyways.
    const i18nMessagesByContext = new Map();
    const i18nBlocks = new Map();
    const i18nContexts = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nContext:
                    const i18nMessageOp = createI18nMessage(job, op);
                    unit.create.push(i18nMessageOp);
                    i18nMessagesByContext.set(op.xref, i18nMessageOp);
                    i18nContexts.set(op.xref, op);
                    break;
                case ir.OpKind.I18nStart:
                    i18nBlocks.set(op.xref, op);
                    break;
            }
        }
    }
    // Associate sub-messages for ICUs with their root message. At this point we can also remove the
    // ICU start/end ops, as they are no longer needed.
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.IcuStart:
                    ir.OpList.remove(op);
                    // Skip any contexts not associated with an ICU.
                    const icuContext = i18nContexts.get(op.context);
                    if (icuContext.contextKind !== ir.I18nContextKind.Icu) {
                        continue;
                    }
                    // Skip ICUs that share a context with their i18n message. These represent root-level
                    // ICUs, not sub-messages.
                    const i18nBlock = i18nBlocks.get(icuContext.i18nBlock);
                    if (i18nBlock.context === icuContext.xref) {
                        continue;
                    }
                    // Find the root message and push this ICUs message as a sub-message.
                    const rootI18nBlock = i18nBlocks.get(i18nBlock.root);
                    const rootMessage = i18nMessagesByContext.get(rootI18nBlock.context);
                    if (rootMessage === undefined) {
                        throw Error('AssertionError: ICU sub-message should belong to a root message.');
                    }
                    const subMessage = i18nMessagesByContext.get(icuContext.xref);
                    subMessage.messagePlaceholder = op.messagePlaceholder;
                    rootMessage.subMessages.push(subMessage.xref);
                    break;
                case ir.OpKind.IcuEnd:
                    ir.OpList.remove(op);
                    break;
            }
        }
    }
}
/**
 * Create an i18n message op from an i18n context op.
 */
function createI18nMessage(job, context, messagePlaceholder) {
    let formattedParams = formatParams(context.params);
    const formattedPostprocessingParams = formatParams(context.postprocessingParams);
    let needsPostprocessing = formattedPostprocessingParams.size > 0;
    for (const values of context.params.values()) {
        if (values.length > 1) {
            needsPostprocessing = true;
        }
    }
    return ir.createI18nMessageOp(job.allocateXrefId(), context.xref, context.i18nBlock, context.message, messagePlaceholder ?? null, formattedParams, formattedPostprocessingParams, needsPostprocessing);
}
/**
 * Formats a map of `I18nParamValue[]` values into a map of `Expression` values.
 */
function formatParams(params) {
    const formattedParams = new Map();
    for (const [placeholder, placeholderValues] of params) {
        const serializedValues = formatParamValues(placeholderValues);
        if (serializedValues !== null) {
            formattedParams.set(placeholder, o.literal(serializedValues));
        }
    }
    return formattedParams;
}
/**
 * Formats an `I18nParamValue[]` into a string (or null for empty array).
 */
function formatParamValues(values) {
    if (values.length === 0) {
        return null;
    }
    const serializedValues = values.map(value => formatValue(value));
    return serializedValues.length === 1 ?
        serializedValues[0] :
        `${LIST_START_MARKER}${serializedValues.join(LIST_DELIMITER)}${LIST_END_MARKER}`;
}
/**
 * Formats a single `I18nParamValue` into a string
 */
function formatValue(value) {
    // Element tags with a structural directive use a special form that concatenates the element and
    // template values.
    if ((value.flags & ir.I18nParamValueFlags.ElementTag) &&
        (value.flags & ir.I18nParamValueFlags.TemplateTag)) {
        if (typeof value.value !== 'object') {
            throw Error('AssertionError: Expected i18n param value to have an element and template slot');
        }
        const elementValue = formatValue({
            ...value,
            value: value.value.element,
            flags: value.flags & ~ir.I18nParamValueFlags.TemplateTag
        });
        const templateValue = formatValue({
            ...value,
            value: value.value.template,
            flags: value.flags & ~ir.I18nParamValueFlags.ElementTag
        });
        // TODO(mmalerba): This is likely a bug in TemplateDefinitionBuilder, we should not need to
        // record the template value twice. For now I'm re-implementing the behavior here to keep the
        // output consistent with TemplateDefinitionBuilder.
        if ((value.flags & ir.I18nParamValueFlags.OpenTag) &&
            (value.flags & ir.I18nParamValueFlags.CloseTag)) {
            return `${templateValue}${elementValue}${templateValue}`;
        }
        // To match the TemplateDefinitionBuilder output, flip the order depending on whether the
        // values represent a closing or opening tag (or both).
        // TODO(mmalerba): Figure out if this makes a difference in terms of either functionality,
        // or the resulting message ID. If not, we can remove the special-casing in the future.
        return value.flags & ir.I18nParamValueFlags.CloseTag ? `${elementValue}${templateValue}` :
            `${templateValue}${elementValue}`;
    }
    // Self-closing tags use a special form that concatenates the start and close tag values.
    if ((value.flags & ir.I18nParamValueFlags.OpenTag) &&
        (value.flags & ir.I18nParamValueFlags.CloseTag)) {
        return `${formatValue({ ...value, flags: value.flags & ~ir.I18nParamValueFlags.CloseTag })}${formatValue({ ...value, flags: value.flags & ~ir.I18nParamValueFlags.OpenTag })}`;
    }
    // If there are no special flags, just return the raw value.
    if (value.flags === ir.I18nParamValueFlags.None) {
        return `${value.value}`;
    }
    // Encode the remaining flags as part of the value.
    let tagMarker = '';
    let closeMarker = '';
    if (value.flags & ir.I18nParamValueFlags.ElementTag) {
        tagMarker = ELEMENT_MARKER;
    }
    else if (value.flags & ir.I18nParamValueFlags.TemplateTag) {
        tagMarker = TEMPLATE_MARKER;
    }
    if (tagMarker !== '') {
        closeMarker = value.flags & ir.I18nParamValueFlags.CloseTag ? TAG_CLOSE_MARKER : '';
    }
    const context = value.subTemplateIndex === null ? '' : `${CONTEXT_MARKER}${value.subTemplateIndex}`;
    return `${ESCAPE}${closeMarker}${tagMarker}${value.value}${context}${ESCAPE}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdF9pMThuX21lc3NhZ2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZXh0cmFjdF9pMThuX21lc3NhZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFFeEI7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFFM0I7O0dBRUc7QUFDSCxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUM7QUFFNUI7O0dBRUc7QUFDSCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUU3Qjs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztBQUUzQjs7R0FFRztBQUNILE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDO0FBRTlCOztHQUVHO0FBQ0gsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDO0FBRTVCOztHQUVHO0FBQ0gsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBRTNCOzs7R0FHRztBQUNILE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFtQjtJQUNyRCwyQ0FBMkM7SUFDM0MsNEVBQTRFO0lBQzVFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFDckUsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQTZCLENBQUM7SUFDeEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFF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QUNyQixJQUFJLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsRUFBRTtRQUNuRCxTQUFTLEdBQUcsY0FBYyxDQUFDO0tBQzVCO1NBQU0sSUFBSSxLQUFLLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEVBQUU7UUFDM0QsU0FBUyxHQUFHLGVBQWUsQ0FBQztLQUM3QjtJQUNELElBQUksU0FBUyxLQUFLLEVBQUUsRUFBRTtRQUNwQixXQUFXLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0tBQ3JGO0lBQ0QsTUFBTSxPQUFPLEdBQ1QsS0FBSyxDQUFDLGdCQUFnQixLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLGNBQWMsR0FBRyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUN4RixPQUFPLEdBQUcsTUFBTSxHQUFHLFdBQVcsR0FBRyxTQUFTLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLEdBQUcsTUFBTSxFQUFFLENBQUM7QUFDaEYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBUaGUgZXNjYXBlIHNlcXVlbmNlIHVzZWQgaW5kaWNhdGUgbWVzc2FnZSBwYXJhbSB2YWx1ZXMuXG4gKi9cbmNvbnN0IEVTQ0FQRSA9ICdcXHVGRkZEJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBhbiBlbGVtZW50IHRhZy5cbiAqL1xuY29uc3QgRUxFTUVOVF9NQVJLRVIgPSAnIyc7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgYSB0ZW1wbGF0ZSB0YWcuXG4gKi9cbmNvbnN0IFRFTVBMQVRFX01BUktFUiA9ICcqJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBjbG9zaW5nIG9mIGFuIGVsZW1lbnQgb3IgdGVtcGxhdGUgdGFnLlxuICovXG5jb25zdCBUQUdfQ0xPU0VfTUFSS0VSID0gJy8nO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIHRoZSBzdWItdGVtcGxhdGUgY29udGV4dC5cbiAqL1xuY29uc3QgQ09OVEVYVF9NQVJLRVIgPSAnOic7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgdGhlIHN0YXJ0IG9mIGEgbGlzdCBvZiB2YWx1ZXMuXG4gKi9cbmNvbnN0IExJU1RfU1RBUlRfTUFSS0VSID0gJ1snO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIHRoZSBlbmQgb2YgYSBsaXN0IG9mIHZhbHVlcy5cbiAqL1xuY29uc3QgTElTVF9FTkRfTUFSS0VSID0gJ10nO1xuXG4vKipcbiAqIERlbGltaXRlciB1c2VkIHRvIHNlcGFyYXRlIG11bHRpcGxlIHZhbHVlcyBpbiBhIGxpc3QuXG4gKi9cbmNvbnN0IExJU1RfREVMSU1JVEVSID0gJ3wnO1xuXG4vKipcbiAqIEZvcm1hdHMgdGhlIHBhcmFtIG1hcHMgb24gZXh0cmFjdGVkIG1lc3NhZ2Ugb3BzIGludG8gYSBtYXBzIG9mIGBFeHByZXNzaW9uYCBvYmplY3RzIHRoYXQgY2FuIGJlXG4gKiB1c2VkIGluIHRoZSBmaW5hbCBvdXRwdXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0STE4bk1lc3NhZ2VzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgLy8gQ3JlYXRlIGFuIGkxOG4gbWVzc2FnZSBmb3IgZWFjaCBjb250ZXh0LlxuICAvLyBUT0RPOiBNZXJnZSB0aGUgY29udGV4dCBvcCB3aXRoIHRoZSBtZXNzYWdlIG9wIHNpbmNlIHRoZXkncmUgMToxIGFueXdheXMuXG4gIGNvbnN0IGkxOG5NZXNzYWdlc0J5Q29udGV4dCA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuTWVzc2FnZU9wPigpO1xuICBjb25zdCBpMThuQmxvY2tzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5TdGFydE9wPigpO1xuICBjb25zdCBpMThuQ29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuQ29udGV4dDpcbiAgICAgICAgICBjb25zdCBpMThuTWVzc2FnZU9wID0gY3JlYXRlSTE4bk1lc3NhZ2Uoam9iLCBvcCk7XG4gICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChpMThuTWVzc2FnZU9wKTtcbiAgICAgICAgICBpMThuTWVzc2FnZXNCeUNvbnRleHQuc2V0KG9wLnhyZWYsIGkxOG5NZXNzYWdlT3ApO1xuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgaTE4bkJsb2Nrcy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEFzc29jaWF0ZSBzdWItbWVzc2FnZXMgZm9yIElDVXMgd2l0aCB0aGVpciByb290IG1lc3NhZ2UuIEF0IHRoaXMgcG9pbnQgd2UgY2FuIGFsc28gcmVtb3ZlIHRoZVxuICAvLyBJQ1Ugc3RhcnQvZW5kIG9wcywgYXMgdGhleSBhcmUgbm8gbG9uZ2VyIG5lZWRlZC5cbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3VTdGFydDpcbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgICAgLy8gU2tpcCBhbnkgY29udGV4dHMgbm90IGFzc29jaWF0ZWQgd2l0aCBhbiBJQ1UuXG4gICAgICAgICAgY29uc3QgaWN1Q29udGV4dCA9IGkxOG5Db250ZXh0cy5nZXQob3AuY29udGV4dCEpITtcbiAgICAgICAgICBpZiAoaWN1Q29udGV4dC5jb250ZXh0S2luZCAhPT0gaXIuSTE4bkNvbnRleHRLaW5kLkljdSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFNraXAgSUNVcyB0aGF0IHNoYXJlIGEgY29udGV4dCB3aXRoIHRoZWlyIGkxOG4gbWVzc2FnZS4gVGhlc2UgcmVwcmVzZW50IHJvb3QtbGV2ZWxcbiAgICAgICAgICAvLyBJQ1VzLCBub3Qgc3ViLW1lc3NhZ2VzLlxuICAgICAgICAgIGNvbnN0IGkxOG5CbG9jayA9IGkxOG5CbG9ja3MuZ2V0KGljdUNvbnRleHQuaTE4bkJsb2NrISkhO1xuICAgICAgICAgIGlmIChpMThuQmxvY2suY29udGV4dCA9PT0gaWN1Q29udGV4dC54cmVmKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gRmluZCB0aGUgcm9vdCBtZXNzYWdlIGFuZCBwdXNoIHRoaXMgSUNVcyBtZXNzYWdlIGFzIGEgc3ViLW1lc3NhZ2UuXG4gICAgICAgICAgY29uc3Qgcm9vdEkxOG5CbG9jayA9IGkxOG5CbG9ja3MuZ2V0KGkxOG5CbG9jay5yb290KSE7XG4gICAgICAgICAgY29uc3Qgcm9vdE1lc3NhZ2UgPSBpMThuTWVzc2FnZXNCeUNvbnRleHQuZ2V0KHJvb3RJMThuQmxvY2suY29udGV4dCEpO1xuICAgICAgICAgIGlmIChyb290TWVzc2FnZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IElDVSBzdWItbWVzc2FnZSBzaG91bGQgYmVsb25nIHRvIGEgcm9vdCBtZXNzYWdlLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBzdWJNZXNzYWdlID0gaTE4bk1lc3NhZ2VzQnlDb250ZXh0LmdldChpY3VDb250ZXh0LnhyZWYpITtcbiAgICAgICAgICBzdWJNZXNzYWdlLm1lc3NhZ2VQbGFjZWhvbGRlciA9IG9wLm1lc3NhZ2VQbGFjZWhvbGRlcjtcbiAgICAgICAgICByb290TWVzc2FnZS5zdWJNZXNzYWdlcy5wdXNoKHN1Yk1lc3NhZ2UueHJlZik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdUVuZDpcbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGkxOG4gbWVzc2FnZSBvcCBmcm9tIGFuIGkxOG4gY29udGV4dCBvcC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlSTE4bk1lc3NhZ2UoXG4gICAgam9iOiBDb21waWxhdGlvbkpvYiwgY29udGV4dDogaXIuSTE4bkNvbnRleHRPcCwgbWVzc2FnZVBsYWNlaG9sZGVyPzogc3RyaW5nKTogaXIuSTE4bk1lc3NhZ2VPcCB7XG4gIGxldCBmb3JtYXR0ZWRQYXJhbXMgPSBmb3JtYXRQYXJhbXMoY29udGV4dC5wYXJhbXMpO1xuICBjb25zdCBmb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcyA9IGZvcm1hdFBhcmFtcyhjb250ZXh0LnBvc3Rwcm9jZXNzaW5nUGFyYW1zKTtcbiAgbGV0IG5lZWRzUG9zdHByb2Nlc3NpbmcgPSBmb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcy5zaXplID4gMDtcbiAgZm9yIChjb25zdCB2YWx1ZXMgb2YgY29udGV4dC5wYXJhbXMudmFsdWVzKCkpIHtcbiAgICBpZiAodmFsdWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgIG5lZWRzUG9zdHByb2Nlc3NpbmcgPSB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gaXIuY3JlYXRlSTE4bk1lc3NhZ2VPcChcbiAgICAgIGpvYi5hbGxvY2F0ZVhyZWZJZCgpLCBjb250ZXh0LnhyZWYsIGNvbnRleHQuaTE4bkJsb2NrLCBjb250ZXh0Lm1lc3NhZ2UsXG4gICAgICBtZXNzYWdlUGxhY2Vob2xkZXIgPz8gbnVsbCwgZm9ybWF0dGVkUGFyYW1zLCBmb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcyxcbiAgICAgIG5lZWRzUG9zdHByb2Nlc3NpbmcpO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgYSBtYXAgb2YgYEkxOG5QYXJhbVZhbHVlW11gIHZhbHVlcyBpbnRvIGEgbWFwIG9mIGBFeHByZXNzaW9uYCB2YWx1ZXMuXG4gKi9cbmZ1bmN0aW9uIGZvcm1hdFBhcmFtcyhwYXJhbXM6IE1hcDxzdHJpbmcsIGlyLkkxOG5QYXJhbVZhbHVlW10+KSB7XG4gIGNvbnN0IGZvcm1hdHRlZFBhcmFtcyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+KCk7XG4gIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCBwbGFjZWhvbGRlclZhbHVlc10gb2YgcGFyYW1zKSB7XG4gICAgY29uc3Qgc2VyaWFsaXplZFZhbHVlcyA9IGZvcm1hdFBhcmFtVmFsdWVzKHBsYWNlaG9sZGVyVmFsdWVzKTtcbiAgICBpZiAoc2VyaWFsaXplZFZhbHVlcyAhPT0gbnVsbCkge1xuICAgICAgZm9ybWF0dGVkUGFyYW1zLnNldChwbGFjZWhvbGRlciwgby5saXRlcmFsKHNlcmlhbGl6ZWRWYWx1ZXMpKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZvcm1hdHRlZFBhcmFtcztcbn1cblxuLyoqXG4gKiBGb3JtYXRzIGFuIGBJMThuUGFyYW1WYWx1ZVtdYCBpbnRvIGEgc3RyaW5nIChvciBudWxsIGZvciBlbXB0eSBhcnJheSkuXG4gKi9cbmZ1bmN0aW9uIGZvcm1hdFBhcmFtVmFsdWVzKHZhbHVlczogaXIuSTE4blBhcmFtVmFsdWVbXSk6IHN0cmluZ3xudWxsIHtcbiAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBzZXJpYWxpemVkVmFsdWVzID0gdmFsdWVzLm1hcCh2YWx1ZSA9PiBmb3JtYXRWYWx1ZSh2YWx1ZSkpO1xuICByZXR1cm4gc2VyaWFsaXplZFZhbHVlcy5sZW5ndGggPT09IDEgP1xuICAgICAgc2VyaWFsaXplZFZhbHVlc1swXSA6XG4gICAgICBgJHtMSVNUX1NUQVJUX01BUktFUn0ke3NlcmlhbGl6ZWRWYWx1ZXMuam9pbihMSVNUX0RFTElNSVRFUil9JHtMSVNUX0VORF9NQVJLRVJ9YDtcbn1cblxuLyoqXG4gKiBGb3JtYXRzIGEgc2luZ2xlIGBJMThuUGFyYW1WYWx1ZWAgaW50byBhIHN0cmluZ1xuICovXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZSh2YWx1ZTogaXIuSTE4blBhcmFtVmFsdWUpOiBzdHJpbmcge1xuICAvLyBFbGVtZW50IHRhZ3Mgd2l0aCBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIHVzZSBhIHNwZWNpYWwgZm9ybSB0aGF0IGNvbmNhdGVuYXRlcyB0aGUgZWxlbWVudCBhbmRcbiAgLy8gdGVtcGxhdGUgdmFsdWVzLlxuICBpZiAoKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnKSAmJlxuICAgICAgKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZykpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlLnZhbHVlICE9PSAnb2JqZWN0Jykge1xuICAgICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBFeHBlY3RlZCBpMThuIHBhcmFtIHZhbHVlIHRvIGhhdmUgYW4gZWxlbWVudCBhbmQgdGVtcGxhdGUgc2xvdCcpO1xuICAgIH1cbiAgICBjb25zdCBlbGVtZW50VmFsdWUgPSBmb3JtYXRWYWx1ZSh7XG4gICAgICAuLi52YWx1ZSxcbiAgICAgIHZhbHVlOiB2YWx1ZS52YWx1ZS5lbGVtZW50LFxuICAgICAgZmxhZ3M6IHZhbHVlLmZsYWdzICYgfmlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWdcbiAgICB9KTtcbiAgICBjb25zdCB0ZW1wbGF0ZVZhbHVlID0gZm9ybWF0VmFsdWUoe1xuICAgICAgLi4udmFsdWUsXG4gICAgICB2YWx1ZTogdmFsdWUudmFsdWUudGVtcGxhdGUsXG4gICAgICBmbGFnczogdmFsdWUuZmxhZ3MgJiB+aXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnXG4gICAgfSk7XG4gICAgLy8gVE9ETyhtbWFsZXJiYSk6IFRoaXMgaXMgbGlrZWx5IGEgYnVnIGluIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIHdlIHNob3VsZCBub3QgbmVlZCB0b1xuICAgIC8vIHJlY29yZCB0aGUgdGVtcGxhdGUgdmFsdWUgdHdpY2UuIEZvciBub3cgSSdtIHJlLWltcGxlbWVudGluZyB0aGUgYmVoYXZpb3IgaGVyZSB0byBrZWVwIHRoZVxuICAgIC8vIG91dHB1dCBjb25zaXN0ZW50IHdpdGggVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlci5cbiAgICBpZiAoKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnKSAmJlxuICAgICAgICAodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKSkge1xuICAgICAgcmV0dXJuIGAke3RlbXBsYXRlVmFsdWV9JHtlbGVtZW50VmFsdWV9JHt0ZW1wbGF0ZVZhbHVlfWA7XG4gICAgfVxuICAgIC8vIFRvIG1hdGNoIHRoZSBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIG91dHB1dCwgZmxpcCB0aGUgb3JkZXIgZGVwZW5kaW5nIG9uIHdoZXRoZXIgdGhlXG4gICAgLy8gdmFsdWVzIHJlcHJlc2VudCBhIGNsb3Npbmcgb3Igb3BlbmluZyB0YWcgKG9yIGJvdGgpLlxuICAgIC8vIFRPRE8obW1hbGVyYmEpOiBGaWd1cmUgb3V0IGlmIHRoaXMgbWFrZXMgYSBkaWZmZXJlbmNlIGluIHRlcm1zIG9mIGVpdGhlciBmdW5jdGlvbmFsaXR5LFxuICAgIC8vIG9yIHRoZSByZXN1bHRpbmcgbWVzc2FnZSBJRC4gSWYgbm90LCB3ZSBjYW4gcmVtb3ZlIHRoZSBzcGVjaWFsLWNhc2luZyBpbiB0aGUgZnV0dXJlLlxuICAgIHJldHVybiB2YWx1ZS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWcgPyBgJHtlbGVtZW50VmFsdWV9JHt0ZW1wbGF0ZVZhbHVlfWAgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHt0ZW1wbGF0ZVZhbHVlfSR7ZWxlbWVudFZhbHVlfWA7XG4gIH1cblxuICAvLyBTZWxmLWNsb3NpbmcgdGFncyB1c2UgYSBzcGVjaWFsIGZvcm0gdGhhdCBjb25jYXRlbmF0ZXMgdGhlIHN0YXJ0IGFuZCBjbG9zZSB0YWcgdmFsdWVzLlxuICBpZiAoKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnKSAmJlxuICAgICAgKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZykpIHtcbiAgICByZXR1cm4gYCR7Zm9ybWF0VmFsdWUoey4uLnZhbHVlLCBmbGFnczogdmFsdWUuZmxhZ3MgJiB+aXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZ30pfSR7XG4gICAgICAgIGZvcm1hdFZhbHVlKHsuLi52YWx1ZSwgZmxhZ3M6IHZhbHVlLmZsYWdzICYgfmlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZ30pfWA7XG4gIH1cblxuICAvLyBJZiB0aGVyZSBhcmUgbm8gc3BlY2lhbCBmbGFncywganVzdCByZXR1cm4gdGhlIHJhdyB2YWx1ZS5cbiAgaWYgKHZhbHVlLmZsYWdzID09PSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmUpIHtcbiAgICByZXR1cm4gYCR7dmFsdWUudmFsdWV9YDtcbiAgfVxuXG4gIC8vIEVuY29kZSB0aGUgcmVtYWluaW5nIGZsYWdzIGFzIHBhcnQgb2YgdGhlIHZhbHVlLlxuICBsZXQgdGFnTWFya2VyID0gJyc7XG4gIGxldCBjbG9zZU1hcmtlciA9ICcnO1xuICBpZiAodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkVsZW1lbnRUYWcpIHtcbiAgICB0YWdNYXJrZXIgPSBFTEVNRU5UX01BUktFUjtcbiAgfSBlbHNlIGlmICh2YWx1ZS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpIHtcbiAgICB0YWdNYXJrZXIgPSBURU1QTEFURV9NQVJLRVI7XG4gIH1cbiAgaWYgKHRhZ01hcmtlciAhPT0gJycpIHtcbiAgICBjbG9zZU1hcmtlciA9IHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyA/IFRBR19DTE9TRV9NQVJLRVIgOiAnJztcbiAgfVxuICBjb25zdCBjb250ZXh0ID1cbiAgICAgIHZhbHVlLnN1YlRlbXBsYXRlSW5kZXggPT09IG51bGwgPyAnJyA6IGAke0NPTlRFWFRfTUFSS0VSfSR7dmFsdWUuc3ViVGVtcGxhdGVJbmRleH1gO1xuICByZXR1cm4gYCR7RVNDQVBFfSR7Y2xvc2VNYXJrZXJ9JHt0YWdNYXJrZXJ9JHt2YWx1ZS52YWx1ZX0ke2NvbnRleHR9JHtFU0NBUEV9YDtcbn1cbiJdfQ==