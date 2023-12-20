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
    let currentIcu = null;
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.IcuStart:
                    currentIcu = op;
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
                    currentIcu = null;
                    ir.OpList.remove(op);
                    break;
                case ir.OpKind.IcuPlaceholder:
                    // Add ICU placeholders to the message, then remove the ICU placeholder ops.
                    if (currentIcu === null || currentIcu.context == null) {
                        throw Error('AssertionError: Unexpected ICU placeholder outside of i18n context');
                    }
                    const msg = i18nMessagesByContext.get(currentIcu.context);
                    msg.postprocessingParams.set(op.name, o.literal(formatIcuPlaceholder(op)));
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
    let needsPostprocessing = [...context.params.values()].some(v => v.length > 1);
    return ir.createI18nMessageOp(job.allocateXrefId(), context.xref, context.i18nBlock, context.message, messagePlaceholder ?? null, formattedParams, formattedPostprocessingParams, needsPostprocessing);
}
/**
 * Formats an ICU placeholder into a single string with expression placeholders.
 */
function formatIcuPlaceholder(op) {
    if (op.strings.length !== op.expressionPlaceholders.length + 1) {
        throw Error(`AsserionError: Invalid ICU placeholder with ${op.strings.length} strings and ${op.expressionPlaceholders.length} expressions`);
    }
    const values = op.expressionPlaceholders.map(formatValue);
    return op.strings.flatMap((str, i) => [str, values[i] || '']).join('');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdF9pMThuX21lc3NhZ2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZXh0cmFjdF9pMThuX21lc3NhZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFFeEI7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFFM0I7O0dBRUc7QUFDSCxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUM7QUFFNUI7O0dBRUc7QUFDSCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUU3Qjs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztBQUUzQjs7R0FFRztBQUNILE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDO0FBRTlCOztHQUVHO0FBQ0gsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDO0FBRTVCOztHQUVHO0FBQ0gsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBRTNCOzs7R0FHRztBQUNILE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFtQjtJQUNyRCwyQ0FBMkM7SUFDM0MsNEVBQTRFO0lBQzVFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFDckUsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQTZCLENBQUM7SUFDeEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFF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QUM7SUFDckIsSUFBSSxLQUFLLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLEVBQUU7UUFDbkQsU0FBUyxHQUFHLGNBQWMsQ0FBQztLQUM1QjtTQUFNLElBQUksS0FBSyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsV0FBVyxFQUFFO1FBQzNELFNBQVMsR0FBRyxlQUFlLENBQUM7S0FDN0I7SUFDRCxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUU7UUFDcEIsV0FBVyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztLQUNyRjtJQUNELE1BQU0sT0FBTyxHQUNULEtBQUssQ0FBQyxnQkFBZ0IsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxjQUFjLEdBQUcsS0FBSyxDQUFDLGdCQUFnQixFQUFFLENBQUM7SUFDeEYsT0FBTyxHQUFHLE1BQU0sR0FBRyxXQUFXLEdBQUcsU0FBUyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsT0FBTyxHQUFHLE1BQU0sRUFBRSxDQUFDO0FBQ2hGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogVGhlIGVzY2FwZSBzZXF1ZW5jZSB1c2VkIGluZGljYXRlIG1lc3NhZ2UgcGFyYW0gdmFsdWVzLlxuICovXG5jb25zdCBFU0NBUEUgPSAnXFx1RkZGRCc7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgYW4gZWxlbWVudCB0YWcuXG4gKi9cbmNvbnN0IEVMRU1FTlRfTUFSS0VSID0gJyMnO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIGEgdGVtcGxhdGUgdGFnLlxuICovXG5jb25zdCBURU1QTEFURV9NQVJLRVIgPSAnKic7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgY2xvc2luZyBvZiBhbiBlbGVtZW50IG9yIHRlbXBsYXRlIHRhZy5cbiAqL1xuY29uc3QgVEFHX0NMT1NFX01BUktFUiA9ICcvJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSB0aGUgc3ViLXRlbXBsYXRlIGNvbnRleHQuXG4gKi9cbmNvbnN0IENPTlRFWFRfTUFSS0VSID0gJzonO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIHRoZSBzdGFydCBvZiBhIGxpc3Qgb2YgdmFsdWVzLlxuICovXG5jb25zdCBMSVNUX1NUQVJUX01BUktFUiA9ICdbJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSB0aGUgZW5kIG9mIGEgbGlzdCBvZiB2YWx1ZXMuXG4gKi9cbmNvbnN0IExJU1RfRU5EX01BUktFUiA9ICddJztcblxuLyoqXG4gKiBEZWxpbWl0ZXIgdXNlZCB0byBzZXBhcmF0ZSBtdWx0aXBsZSB2YWx1ZXMgaW4gYSBsaXN0LlxuICovXG5jb25zdCBMSVNUX0RFTElNSVRFUiA9ICd8JztcblxuLyoqXG4gKiBGb3JtYXRzIHRoZSBwYXJhbSBtYXBzIG9uIGV4dHJhY3RlZCBtZXNzYWdlIG9wcyBpbnRvIGEgbWFwcyBvZiBgRXhwcmVzc2lvbmAgb2JqZWN0cyB0aGF0IGNhbiBiZVxuICogdXNlZCBpbiB0aGUgZmluYWwgb3V0cHV0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEkxOG5NZXNzYWdlcyhqb2I6IENvbXBpbGF0aW9uSm9iKTogdm9pZCB7XG4gIC8vIENyZWF0ZSBhbiBpMThuIG1lc3NhZ2UgZm9yIGVhY2ggY29udGV4dC5cbiAgLy8gVE9ETzogTWVyZ2UgdGhlIGNvbnRleHQgb3Agd2l0aCB0aGUgbWVzc2FnZSBvcCBzaW5jZSB0aGV5J3JlIDE6MSBhbnl3YXlzLlxuICBjb25zdCBpMThuTWVzc2FnZXNCeUNvbnRleHQgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bk1lc3NhZ2VPcD4oKTtcbiAgY29uc3QgaTE4bkJsb2NrcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuU3RhcnRPcD4oKTtcbiAgY29uc3QgaTE4bkNvbnRleHRzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5Db250ZXh0T3A+KCk7XG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkNvbnRleHQ6XG4gICAgICAgICAgY29uc3QgaTE4bk1lc3NhZ2VPcCA9IGNyZWF0ZUkxOG5NZXNzYWdlKGpvYiwgb3ApO1xuICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaTE4bk1lc3NhZ2VPcCk7XG4gICAgICAgICAgaTE4bk1lc3NhZ2VzQnlDb250ZXh0LnNldChvcC54cmVmLCBpMThuTWVzc2FnZU9wKTtcbiAgICAgICAgICBpMThuQ29udGV4dHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGkxOG5CbG9ja3Muc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBBc3NvY2lhdGUgc3ViLW1lc3NhZ2VzIGZvciBJQ1VzIHdpdGggdGhlaXIgcm9vdCBtZXNzYWdlLiBBdCB0aGlzIHBvaW50IHdlIGNhbiBhbHNvIHJlbW92ZSB0aGVcbiAgLy8gSUNVIHN0YXJ0L2VuZCBvcHMsIGFzIHRoZXkgYXJlIG5vIGxvbmdlciBuZWVkZWQuXG4gIGxldCBjdXJyZW50SWN1OiBpci5JY3VTdGFydE9wfG51bGwgPSBudWxsO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdVN0YXJ0OlxuICAgICAgICAgIGN1cnJlbnRJY3UgPSBvcDtcbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgICAgLy8gU2tpcCBhbnkgY29udGV4dHMgbm90IGFzc29jaWF0ZWQgd2l0aCBhbiBJQ1UuXG4gICAgICAgICAgY29uc3QgaWN1Q29udGV4dCA9IGkxOG5Db250ZXh0cy5nZXQob3AuY29udGV4dCEpITtcbiAgICAgICAgICBpZiAoaWN1Q29udGV4dC5jb250ZXh0S2luZCAhPT0gaXIuSTE4bkNvbnRleHRLaW5kLkljdSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFNraXAgSUNVcyB0aGF0IHNoYXJlIGEgY29udGV4dCB3aXRoIHRoZWlyIGkxOG4gbWVzc2FnZS4gVGhlc2UgcmVwcmVzZW50IHJvb3QtbGV2ZWxcbiAgICAgICAgICAvLyBJQ1VzLCBub3Qgc3ViLW1lc3NhZ2VzLlxuICAgICAgICAgIGNvbnN0IGkxOG5CbG9jayA9IGkxOG5CbG9ja3MuZ2V0KGljdUNvbnRleHQuaTE4bkJsb2NrISkhO1xuICAgICAgICAgIGlmIChpMThuQmxvY2suY29udGV4dCA9PT0gaWN1Q29udGV4dC54cmVmKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gRmluZCB0aGUgcm9vdCBtZXNzYWdlIGFuZCBwdXNoIHRoaXMgSUNVcyBtZXNzYWdlIGFzIGEgc3ViLW1lc3NhZ2UuXG4gICAgICAgICAgY29uc3Qgcm9vdEkxOG5CbG9jayA9IGkxOG5CbG9ja3MuZ2V0KGkxOG5CbG9jay5yb290KSE7XG4gICAgICAgICAgY29uc3Qgcm9vdE1lc3NhZ2UgPSBpMThuTWVzc2FnZXNCeUNvbnRleHQuZ2V0KHJvb3RJMThuQmxvY2suY29udGV4dCEpO1xuICAgICAgICAgIGlmIChyb290TWVzc2FnZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IElDVSBzdWItbWVzc2FnZSBzaG91bGQgYmVsb25nIHRvIGEgcm9vdCBtZXNzYWdlLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBzdWJNZXNzYWdlID0gaTE4bk1lc3NhZ2VzQnlDb250ZXh0LmdldChpY3VDb250ZXh0LnhyZWYpITtcbiAgICAgICAgICBzdWJNZXNzYWdlLm1lc3NhZ2VQbGFjZWhvbGRlciA9IG9wLm1lc3NhZ2VQbGFjZWhvbGRlcjtcbiAgICAgICAgICByb290TWVzc2FnZS5zdWJNZXNzYWdlcy5wdXNoKHN1Yk1lc3NhZ2UueHJlZik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdUVuZDpcbiAgICAgICAgICBjdXJyZW50SWN1ID0gbnVsbDtcbiAgICAgICAgICBpci5PcExpc3QucmVtb3ZlPGlyLkNyZWF0ZU9wPihvcCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdVBsYWNlaG9sZGVyOlxuICAgICAgICAgIC8vIEFkZCBJQ1UgcGxhY2Vob2xkZXJzIHRvIHRoZSBtZXNzYWdlLCB0aGVuIHJlbW92ZSB0aGUgSUNVIHBsYWNlaG9sZGVyIG9wcy5cbiAgICAgICAgICBpZiAoY3VycmVudEljdSA9PT0gbnVsbCB8fCBjdXJyZW50SWN1LmNvbnRleHQgPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0Fzc2VydGlvbkVycm9yOiBVbmV4cGVjdGVkIElDVSBwbGFjZWhvbGRlciBvdXRzaWRlIG9mIGkxOG4gY29udGV4dCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBtc2cgPSBpMThuTWVzc2FnZXNCeUNvbnRleHQuZ2V0KGN1cnJlbnRJY3UuY29udGV4dCkhO1xuICAgICAgICAgIG1zZy5wb3N0cHJvY2Vzc2luZ1BhcmFtcy5zZXQob3AubmFtZSwgby5saXRlcmFsKGZvcm1hdEljdVBsYWNlaG9sZGVyKG9wKSkpO1xuICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gaTE4biBtZXNzYWdlIG9wIGZyb20gYW4gaTE4biBjb250ZXh0IG9wLlxuICovXG5mdW5jdGlvbiBjcmVhdGVJMThuTWVzc2FnZShcbiAgICBqb2I6IENvbXBpbGF0aW9uSm9iLCBjb250ZXh0OiBpci5JMThuQ29udGV4dE9wLCBtZXNzYWdlUGxhY2Vob2xkZXI/OiBzdHJpbmcpOiBpci5JMThuTWVzc2FnZU9wIHtcbiAgbGV0IGZvcm1hdHRlZFBhcmFtcyA9IGZvcm1hdFBhcmFtcyhjb250ZXh0LnBhcmFtcyk7XG4gIGNvbnN0IGZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zID0gZm9ybWF0UGFyYW1zKGNvbnRleHQucG9zdHByb2Nlc3NpbmdQYXJhbXMpO1xuICBsZXQgbmVlZHNQb3N0cHJvY2Vzc2luZyA9IFsuLi5jb250ZXh0LnBhcmFtcy52YWx1ZXMoKV0uc29tZSh2ID0+IHYubGVuZ3RoID4gMSk7XG4gIHJldHVybiBpci5jcmVhdGVJMThuTWVzc2FnZU9wKFxuICAgICAgam9iLmFsbG9jYXRlWHJlZklkKCksIGNvbnRleHQueHJlZiwgY29udGV4dC5pMThuQmxvY2ssIGNvbnRleHQubWVzc2FnZSxcbiAgICAgIG1lc3NhZ2VQbGFjZWhvbGRlciA/PyBudWxsLCBmb3JtYXR0ZWRQYXJhbXMsIGZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zLFxuICAgICAgbmVlZHNQb3N0cHJvY2Vzc2luZyk7XG59XG5cbi8qKlxuICogRm9ybWF0cyBhbiBJQ1UgcGxhY2Vob2xkZXIgaW50byBhIHNpbmdsZSBzdHJpbmcgd2l0aCBleHByZXNzaW9uIHBsYWNlaG9sZGVycy5cbiAqL1xuZnVuY3Rpb24gZm9ybWF0SWN1UGxhY2Vob2xkZXIob3A6IGlyLkljdVBsYWNlaG9sZGVyT3ApIHtcbiAgaWYgKG9wLnN0cmluZ3MubGVuZ3RoICE9PSBvcC5leHByZXNzaW9uUGxhY2Vob2xkZXJzLmxlbmd0aCArIDEpIHtcbiAgICB0aHJvdyBFcnJvcihgQXNzZXJpb25FcnJvcjogSW52YWxpZCBJQ1UgcGxhY2Vob2xkZXIgd2l0aCAke29wLnN0cmluZ3MubGVuZ3RofSBzdHJpbmdzIGFuZCAke1xuICAgICAgICBvcC5leHByZXNzaW9uUGxhY2Vob2xkZXJzLmxlbmd0aH0gZXhwcmVzc2lvbnNgKTtcbiAgfVxuICBjb25zdCB2YWx1ZXMgPSBvcC5leHByZXNzaW9uUGxhY2Vob2xkZXJzLm1hcChmb3JtYXRWYWx1ZSk7XG4gIHJldHVybiBvcC5zdHJpbmdzLmZsYXRNYXAoKHN0ciwgaSkgPT4gW3N0ciwgdmFsdWVzW2ldIHx8ICcnXSkuam9pbignJyk7XG59XG5cbi8qKlxuICogRm9ybWF0cyBhIG1hcCBvZiBgSTE4blBhcmFtVmFsdWVbXWAgdmFsdWVzIGludG8gYSBtYXAgb2YgYEV4cHJlc3Npb25gIHZhbHVlcy5cbiAqL1xuZnVuY3Rpb24gZm9ybWF0UGFyYW1zKHBhcmFtczogTWFwPHN0cmluZywgaXIuSTE4blBhcmFtVmFsdWVbXT4pIHtcbiAgY29uc3QgZm9ybWF0dGVkUGFyYW1zID0gbmV3IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4oKTtcbiAgZm9yIChjb25zdCBbcGxhY2Vob2xkZXIsIHBsYWNlaG9sZGVyVmFsdWVzXSBvZiBwYXJhbXMpIHtcbiAgICBjb25zdCBzZXJpYWxpemVkVmFsdWVzID0gZm9ybWF0UGFyYW1WYWx1ZXMocGxhY2Vob2xkZXJWYWx1ZXMpO1xuICAgIGlmIChzZXJpYWxpemVkVmFsdWVzICE9PSBudWxsKSB7XG4gICAgICBmb3JtYXR0ZWRQYXJhbXMuc2V0KHBsYWNlaG9sZGVyLCBvLmxpdGVyYWwoc2VyaWFsaXplZFZhbHVlcykpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZm9ybWF0dGVkUGFyYW1zO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgYW4gYEkxOG5QYXJhbVZhbHVlW11gIGludG8gYSBzdHJpbmcgKG9yIG51bGwgZm9yIGVtcHR5IGFycmF5KS5cbiAqL1xuZnVuY3Rpb24gZm9ybWF0UGFyYW1WYWx1ZXModmFsdWVzOiBpci5JMThuUGFyYW1WYWx1ZVtdKTogc3RyaW5nfG51bGwge1xuICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHNlcmlhbGl6ZWRWYWx1ZXMgPSB2YWx1ZXMubWFwKHZhbHVlID0+IGZvcm1hdFZhbHVlKHZhbHVlKSk7XG4gIHJldHVybiBzZXJpYWxpemVkVmFsdWVzLmxlbmd0aCA9PT0gMSA/XG4gICAgICBzZXJpYWxpemVkVmFsdWVzWzBdIDpcbiAgICAgIGAke0xJU1RfU1RBUlRfTUFSS0VSfSR7c2VyaWFsaXplZFZhbHVlcy5qb2luKExJU1RfREVMSU1JVEVSKX0ke0xJU1RfRU5EX01BUktFUn1gO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgYSBzaW5nbGUgYEkxOG5QYXJhbVZhbHVlYCBpbnRvIGEgc3RyaW5nXG4gKi9cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKHZhbHVlOiBpci5JMThuUGFyYW1WYWx1ZSk6IHN0cmluZyB7XG4gIC8vIEVsZW1lbnQgdGFncyB3aXRoIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUgdXNlIGEgc3BlY2lhbCBmb3JtIHRoYXQgY29uY2F0ZW5hdGVzIHRoZSBlbGVtZW50IGFuZFxuICAvLyB0ZW1wbGF0ZSB2YWx1ZXMuXG4gIGlmICgodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkVsZW1lbnRUYWcpICYmXG4gICAgICAodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnKSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUudmFsdWUgIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBFcnJvcignQXNzZXJ0aW9uRXJyb3I6IEV4cGVjdGVkIGkxOG4gcGFyYW0gdmFsdWUgdG8gaGF2ZSBhbiBlbGVtZW50IGFuZCB0ZW1wbGF0ZSBzbG90Jyk7XG4gICAgfVxuICAgIGNvbnN0IGVsZW1lbnRWYWx1ZSA9IGZvcm1hdFZhbHVlKHtcbiAgICAgIC4uLnZhbHVlLFxuICAgICAgdmFsdWU6IHZhbHVlLnZhbHVlLmVsZW1lbnQsXG4gICAgICBmbGFnczogdmFsdWUuZmxhZ3MgJiB+aXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZ1xuICAgIH0pO1xuICAgIGNvbnN0IHRlbXBsYXRlVmFsdWUgPSBmb3JtYXRWYWx1ZSh7XG4gICAgICAuLi52YWx1ZSxcbiAgICAgIHZhbHVlOiB2YWx1ZS52YWx1ZS50ZW1wbGF0ZSxcbiAgICAgIGZsYWdzOiB2YWx1ZS5mbGFncyAmIH5pci5JMThuUGFyYW1WYWx1ZUZsYWdzLkVsZW1lbnRUYWdcbiAgICB9KTtcbiAgICAvLyBUT0RPKG1tYWxlcmJhKTogVGhpcyBpcyBsaWtlbHkgYSBidWcgaW4gVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciwgd2Ugc2hvdWxkIG5vdCBuZWVkIHRvXG4gICAgLy8gcmVjb3JkIHRoZSB0ZW1wbGF0ZSB2YWx1ZSB0d2ljZS4gRm9yIG5vdyBJJ20gcmUtaW1wbGVtZW50aW5nIHRoZSBiZWhhdmlvciBoZXJlIHRvIGtlZXAgdGhlXG4gICAgLy8gb3V0cHV0IGNvbnNpc3RlbnQgd2l0aCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLlxuICAgIGlmICgodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWcpICYmXG4gICAgICAgICh2YWx1ZS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWcpKSB7XG4gICAgICByZXR1cm4gYCR7dGVtcGxhdGVWYWx1ZX0ke2VsZW1lbnRWYWx1ZX0ke3RlbXBsYXRlVmFsdWV9YDtcbiAgICB9XG4gICAgLy8gVG8gbWF0Y2ggdGhlIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgb3V0cHV0LCBmbGlwIHRoZSBvcmRlciBkZXBlbmRpbmcgb24gd2hldGhlciB0aGVcbiAgICAvLyB2YWx1ZXMgcmVwcmVzZW50IGEgY2xvc2luZyBvciBvcGVuaW5nIHRhZyAob3IgYm90aCkuXG4gICAgLy8gVE9ETyhtbWFsZXJiYSk6IEZpZ3VyZSBvdXQgaWYgdGhpcyBtYWtlcyBhIGRpZmZlcmVuY2UgaW4gdGVybXMgb2YgZWl0aGVyIGZ1bmN0aW9uYWxpdHksXG4gICAgLy8gb3IgdGhlIHJlc3VsdGluZyBtZXNzYWdlIElELiBJZiBub3QsIHdlIGNhbiByZW1vdmUgdGhlIHNwZWNpYWwtY2FzaW5nIGluIHRoZSBmdXR1cmUuXG4gICAgcmV0dXJuIHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyA/IGAke2VsZW1lbnRWYWx1ZX0ke3RlbXBsYXRlVmFsdWV9YCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAke3RlbXBsYXRlVmFsdWV9JHtlbGVtZW50VmFsdWV9YDtcbiAgfVxuXG4gIC8vIFNlbGYtY2xvc2luZyB0YWdzIHVzZSBhIHNwZWNpYWwgZm9ybSB0aGF0IGNvbmNhdGVuYXRlcyB0aGUgc3RhcnQgYW5kIGNsb3NlIHRhZyB2YWx1ZXMuXG4gIGlmICgodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWcpICYmXG4gICAgICAodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKSkge1xuICAgIHJldHVybiBgJHtmb3JtYXRWYWx1ZSh7Li4udmFsdWUsIGZsYWdzOiB2YWx1ZS5mbGFncyAmIH5pci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnfSl9JHtcbiAgICAgICAgZm9ybWF0VmFsdWUoey4uLnZhbHVlLCBmbGFnczogdmFsdWUuZmxhZ3MgJiB+aXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnfSl9YDtcbiAgfVxuXG4gIC8vIElmIHRoZXJlIGFyZSBubyBzcGVjaWFsIGZsYWdzLCBqdXN0IHJldHVybiB0aGUgcmF3IHZhbHVlLlxuICBpZiAodmFsdWUuZmxhZ3MgPT09IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuTm9uZSkge1xuICAgIHJldHVybiBgJHt2YWx1ZS52YWx1ZX1gO1xuICB9XG5cbiAgLy8gRW5jb2RlIHRoZSByZW1haW5pbmcgZmxhZ3MgYXMgcGFydCBvZiB0aGUgdmFsdWUuXG4gIGxldCB0YWdNYXJrZXIgPSAnJztcbiAgbGV0IGNsb3NlTWFya2VyID0gJyc7XG4gIGlmICh2YWx1ZS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZykge1xuICAgIHRhZ01hcmtlciA9IEVMRU1FTlRfTUFSS0VSO1xuICB9IGVsc2UgaWYgKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZykge1xuICAgIHRhZ01hcmtlciA9IFRFTVBMQVRFX01BUktFUjtcbiAgfVxuICBpZiAodGFnTWFya2VyICE9PSAnJykge1xuICAgIGNsb3NlTWFya2VyID0gdmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnID8gVEFHX0NMT1NFX01BUktFUiA6ICcnO1xuICB9XG4gIGNvbnN0IGNvbnRleHQgPVxuICAgICAgdmFsdWUuc3ViVGVtcGxhdGVJbmRleCA9PT0gbnVsbCA/ICcnIDogYCR7Q09OVEVYVF9NQVJLRVJ9JHt2YWx1ZS5zdWJUZW1wbGF0ZUluZGV4fWA7XG4gIHJldHVybiBgJHtFU0NBUEV9JHtjbG9zZU1hcmtlcn0ke3RhZ01hcmtlcn0ke3ZhbHVlLnZhbHVlfSR7Y29udGV4dH0ke0VTQ0FQRX1gO1xufVxuIl19