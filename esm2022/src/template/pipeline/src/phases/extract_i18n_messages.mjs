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
    // Save the i18n start and i18n context ops for later use.
    const i18nContexts = new Map();
    const i18nBlocks = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nContext:
                    i18nContexts.set(op.xref, op);
                    break;
                case ir.OpKind.I18nStart:
                    i18nBlocks.set(op.xref, op);
                    break;
            }
        }
    }
    // Extract messages from root i18n blocks.
    const i18nBlockMessages = new Map();
    for (const unit of job.units) {
        for (const op of unit.create) {
            if (op.kind === ir.OpKind.I18nStart && op.xref === op.root) {
                if (!op.context) {
                    throw Error('I18n start op should have its context set.');
                }
                const i18nMessageOp = createI18nMessage(job, i18nContexts.get(op.context));
                i18nBlockMessages.set(op.xref, i18nMessageOp);
                unit.create.push(i18nMessageOp);
            }
        }
    }
    // Extract messages from ICUs with their own sub-context.
    for (const unit of job.units) {
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.IcuStart:
                    if (!op.context) {
                        throw Error('ICU op should have its context set.');
                    }
                    const i18nContext = i18nContexts.get(op.context);
                    if (i18nContext.contextKind === ir.I18nContextKind.Icu) {
                        const subMessage = createI18nMessage(job, i18nContext, op.messagePlaceholder);
                        unit.create.push(subMessage);
                        const rootI18nId = i18nBlocks.get(i18nContext.i18nBlock).root;
                        const parentMessage = i18nBlockMessages.get(rootI18nId);
                        parentMessage?.subMessages.push(subMessage.xref);
                    }
                    ir.OpList.remove(op);
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
    let [formattedParams, needsPostprocessing] = formatParams(context.params);
    const [formattedPostprocessingParams] = formatParams(context.postprocessingParams);
    needsPostprocessing ||= formattedPostprocessingParams.size > 0;
    return ir.createI18nMessageOp(job.allocateXrefId(), context.i18nBlock, context.message, messagePlaceholder ?? null, formattedParams, formattedPostprocessingParams, needsPostprocessing);
}
/**
 * Formats a map of `I18nParamValue[]` values into a map of `Expression` values.
 * @return A tuple of the formatted params and a boolean indicating whether postprocessing is needed
 *     for any of the params
 */
function formatParams(params) {
    const formattedParams = new Map();
    let needsPostprocessing = false;
    for (const [placeholder, placeholderValues] of params) {
        const [serializedValues, paramNeedsPostprocessing] = formatParamValues(placeholderValues);
        needsPostprocessing ||= paramNeedsPostprocessing;
        if (serializedValues !== null) {
            formattedParams.set(placeholder, o.literal(serializedValues));
        }
    }
    return [formattedParams, needsPostprocessing];
}
/**
 * Formats an `I18nParamValue[]` into a string (or null for empty array).
 * @return A tuple of the formatted value and a boolean indicating whether postprocessing is needed
 *     for the value
 */
function formatParamValues(values) {
    if (values.length === 0) {
        return [null, false];
    }
    collapseElementTemplatePairs(values);
    const serializedValues = values.map(value => formatValue(value));
    return serializedValues.length === 1 ?
        [serializedValues[0], false] :
        [`${LIST_START_MARKER}${serializedValues.join(LIST_DELIMITER)}${LIST_END_MARKER}`, true];
}
/**
 * Collapses element/template pairs that refer to the same subTemplateIndex, i.e. elements and
 * templates that refer to the same element instance.
 *
 * This accounts for the case of a structural directive inside an i18n block, e.g.:
 * ```
 * <div i18n>
 *   <div *ngIf="condition">
 * </div>
 * ```
 *
 * In this case, both the element start and template start placeholders are the same,
 * and we collapse them down into a single compound placeholder value. Rather than produce
 * `[\uFFFD#1:1\uFFFD|\uFFFD*2:1\uFFFD]`, we want to produce `\uFFFD#1:1\uFFFD\uFFFD*2:1\uFFFD`,
 * likewise for the closing of the element/template.
 */
function collapseElementTemplatePairs(values) {
    // Record the indicies of element and template values in the values array by subTemplateIndex.
    const valueIndiciesBySubTemplateIndex = new Map();
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value.subTemplateIndex !== null &&
            (value.flags & (ir.I18nParamValueFlags.ElementTag | ir.I18nParamValueFlags.TemplateTag))) {
            const valueIndicies = valueIndiciesBySubTemplateIndex.get(value.subTemplateIndex) ?? [];
            valueIndicies.push(i);
            valueIndiciesBySubTemplateIndex.set(value.subTemplateIndex, valueIndicies);
        }
    }
    // For each subTemplateIndex, check if any values can be collapsed.
    for (const [subTemplateIndex, valueIndicies] of valueIndiciesBySubTemplateIndex) {
        if (valueIndicies.length > 1) {
            const elementIndex = valueIndicies.find(index => values[index].flags & ir.I18nParamValueFlags.ElementTag);
            const templateIndex = valueIndicies.find(index => values[index].flags & ir.I18nParamValueFlags.TemplateTag);
            // If the values list contains both an element and template value, we can collapse.
            if (elementIndex !== undefined && templateIndex !== undefined) {
                const elementValue = values[elementIndex];
                const templateValue = values[templateIndex];
                // To match the TemplateDefinitionBuilder output, flip the order depending on whether the
                // values represent a closing or opening tag (or both).
                // TODO(mmalerba): Figure out if this makes a difference in terms of either functionality,
                // or the resulting message ID. If not, we can remove the special-casing in the future.
                let compundValue;
                if ((elementValue.flags & ir.I18nParamValueFlags.OpenTag) &&
                    (elementValue.flags & ir.I18nParamValueFlags.CloseTag)) {
                    // TODO(mmalerba): Is this a TDB bug? I don't understand why it would put the template
                    // value twice.
                    compundValue = `${formatValue(templateValue)}${formatValue(elementValue)}${formatValue(templateValue)}`;
                }
                else if (elementValue.flags & ir.I18nParamValueFlags.OpenTag) {
                    compundValue = `${formatValue(templateValue)}${formatValue(elementValue)}`;
                }
                else {
                    compundValue = `${formatValue(elementValue)}${formatValue(templateValue)}`;
                }
                // Replace the element value with the combined value.
                values.splice(elementIndex, 1, { value: compundValue, subTemplateIndex, flags: ir.I18nParamValueFlags.None });
                // Replace the template value with null to preserve the indicies we calculated earlier.
                values.splice(templateIndex, 1, null);
            }
        }
    }
    // Strip out any nulled out values we introduced above.
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] === null) {
            values.splice(i, 1);
        }
    }
}
/**
 * Formats a single `I18nParamValue` into a string
 */
function formatValue(value) {
    // If there are no special flags, just return the raw value.
    if (value.flags === ir.I18nParamValueFlags.None) {
        return `${value.value}`;
    }
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
    // Self-closing tags use a special form that concatenates the start and close tag values.
    if ((value.flags & ir.I18nParamValueFlags.OpenTag) &&
        (value.flags & ir.I18nParamValueFlags.CloseTag)) {
        return `${ESCAPE}${tagMarker}${value.value}${context}${ESCAPE}${ESCAPE}${closeMarker}${tagMarker}${value.value}${context}${ESCAPE}`;
    }
    return `${ESCAPE}${closeMarker}${tagMarker}${value.value}${context}${ESCAPE}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdF9pMThuX21lc3NhZ2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZXh0cmFjdF9pMThuX21lc3NhZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFFeEI7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFFM0I7O0dBRUc7QUFDSCxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUM7QUFFNUI7O0dBRUc7QUFDSCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUU3Qjs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztBQUUzQjs7R0FFRztBQUNILE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDO0FBRTlCOztHQUVHO0FBQ0gsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDO0FBRTVCOztHQUVHO0FBQ0gsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBRTNCOzs7R0FHRztBQUNILE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFtQjtJQUNyRCwwREFBMEQ7SUFDMUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFDNUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQTZCLENBQUM7SUFDeEQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUU7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QUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgaXIgZnJvbSAnLi4vLi4vaXInO1xuaW1wb3J0IHtDb21waWxhdGlvbkpvYn0gZnJvbSAnLi4vY29tcGlsYXRpb24nO1xuXG4vKipcbiAqIFRoZSBlc2NhcGUgc2VxdWVuY2UgdXNlZCBpbmRpY2F0ZSBtZXNzYWdlIHBhcmFtIHZhbHVlcy5cbiAqL1xuY29uc3QgRVNDQVBFID0gJ1xcdUZGRkQnO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIGFuIGVsZW1lbnQgdGFnLlxuICovXG5jb25zdCBFTEVNRU5UX01BUktFUiA9ICcjJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBhIHRlbXBsYXRlIHRhZy5cbiAqL1xuY29uc3QgVEVNUExBVEVfTUFSS0VSID0gJyonO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIGNsb3Npbmcgb2YgYW4gZWxlbWVudCBvciB0ZW1wbGF0ZSB0YWcuXG4gKi9cbmNvbnN0IFRBR19DTE9TRV9NQVJLRVIgPSAnLyc7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgdGhlIHN1Yi10ZW1wbGF0ZSBjb250ZXh0LlxuICovXG5jb25zdCBDT05URVhUX01BUktFUiA9ICc6JztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSB0aGUgc3RhcnQgb2YgYSBsaXN0IG9mIHZhbHVlcy5cbiAqL1xuY29uc3QgTElTVF9TVEFSVF9NQVJLRVIgPSAnWyc7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgdGhlIGVuZCBvZiBhIGxpc3Qgb2YgdmFsdWVzLlxuICovXG5jb25zdCBMSVNUX0VORF9NQVJLRVIgPSAnXSc7XG5cbi8qKlxuICogRGVsaW1pdGVyIHVzZWQgdG8gc2VwYXJhdGUgbXVsdGlwbGUgdmFsdWVzIGluIGEgbGlzdC5cbiAqL1xuY29uc3QgTElTVF9ERUxJTUlURVIgPSAnfCc7XG5cbi8qKlxuICogRm9ybWF0cyB0aGUgcGFyYW0gbWFwcyBvbiBleHRyYWN0ZWQgbWVzc2FnZSBvcHMgaW50byBhIG1hcHMgb2YgYEV4cHJlc3Npb25gIG9iamVjdHMgdGhhdCBjYW4gYmVcbiAqIHVzZWQgaW4gdGhlIGZpbmFsIG91dHB1dC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RJMThuTWVzc2FnZXMoam9iOiBDb21waWxhdGlvbkpvYik6IHZvaWQge1xuICAvLyBTYXZlIHRoZSBpMThuIHN0YXJ0IGFuZCBpMThuIGNvbnRleHQgb3BzIGZvciBsYXRlciB1c2UuXG4gIGNvbnN0IGkxOG5Db250ZXh0cyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuQ29udGV4dE9wPigpO1xuICBjb25zdCBpMThuQmxvY2tzID0gbmV3IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5TdGFydE9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5Db250ZXh0OlxuICAgICAgICAgIGkxOG5Db250ZXh0cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuU3RhcnQ6XG4gICAgICAgICAgaTE4bkJsb2Nrcy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEV4dHJhY3QgbWVzc2FnZXMgZnJvbSByb290IGkxOG4gYmxvY2tzLlxuICBjb25zdCBpMThuQmxvY2tNZXNzYWdlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuTWVzc2FnZU9wPigpO1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQgJiYgb3AueHJlZiA9PT0gb3Aucm9vdCkge1xuICAgICAgICBpZiAoIW9wLmNvbnRleHQpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignSTE4biBzdGFydCBvcCBzaG91bGQgaGF2ZSBpdHMgY29udGV4dCBzZXQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaTE4bk1lc3NhZ2VPcCA9IGNyZWF0ZUkxOG5NZXNzYWdlKGpvYiwgaTE4bkNvbnRleHRzLmdldChvcC5jb250ZXh0KSEpO1xuICAgICAgICBpMThuQmxvY2tNZXNzYWdlcy5zZXQob3AueHJlZiwgaTE4bk1lc3NhZ2VPcCk7XG4gICAgICAgIHVuaXQuY3JlYXRlLnB1c2goaTE4bk1lc3NhZ2VPcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gRXh0cmFjdCBtZXNzYWdlcyBmcm9tIElDVXMgd2l0aCB0aGVpciBvd24gc3ViLWNvbnRleHQuXG4gIGZvciAoY29uc3QgdW5pdCBvZiBqb2IudW5pdHMpIHtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSWN1U3RhcnQ6XG4gICAgICAgICAgaWYgKCFvcC5jb250ZXh0KSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignSUNVIG9wIHNob3VsZCBoYXZlIGl0cyBjb250ZXh0IHNldC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgaTE4bkNvbnRleHQgPSBpMThuQ29udGV4dHMuZ2V0KG9wLmNvbnRleHQpITtcbiAgICAgICAgICBpZiAoaTE4bkNvbnRleHQuY29udGV4dEtpbmQgPT09IGlyLkkxOG5Db250ZXh0S2luZC5JY3UpIHtcbiAgICAgICAgICAgIGNvbnN0IHN1Yk1lc3NhZ2UgPSBjcmVhdGVJMThuTWVzc2FnZShqb2IsIGkxOG5Db250ZXh0LCBvcC5tZXNzYWdlUGxhY2Vob2xkZXIpO1xuICAgICAgICAgICAgdW5pdC5jcmVhdGUucHVzaChzdWJNZXNzYWdlKTtcbiAgICAgICAgICAgIGNvbnN0IHJvb3RJMThuSWQgPSBpMThuQmxvY2tzLmdldChpMThuQ29udGV4dC5pMThuQmxvY2spIS5yb290O1xuICAgICAgICAgICAgY29uc3QgcGFyZW50TWVzc2FnZSA9IGkxOG5CbG9ja01lc3NhZ2VzLmdldChyb290STE4bklkKTtcbiAgICAgICAgICAgIHBhcmVudE1lc3NhZ2U/LnN1Yk1lc3NhZ2VzLnB1c2goc3ViTWVzc2FnZS54cmVmKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JY3VFbmQ6XG4gICAgICAgICAgaXIuT3BMaXN0LnJlbW92ZTxpci5DcmVhdGVPcD4ob3ApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBpMThuIG1lc3NhZ2Ugb3AgZnJvbSBhbiBpMThuIGNvbnRleHQgb3AuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUkxOG5NZXNzYWdlKFxuICAgIGpvYjogQ29tcGlsYXRpb25Kb2IsIGNvbnRleHQ6IGlyLkkxOG5Db250ZXh0T3AsIG1lc3NhZ2VQbGFjZWhvbGRlcj86IHN0cmluZyk6IGlyLkkxOG5NZXNzYWdlT3Age1xuICBsZXQgW2Zvcm1hdHRlZFBhcmFtcywgbmVlZHNQb3N0cHJvY2Vzc2luZ10gPSBmb3JtYXRQYXJhbXMoY29udGV4dC5wYXJhbXMpO1xuICBjb25zdCBbZm9ybWF0dGVkUG9zdHByb2Nlc3NpbmdQYXJhbXNdID0gZm9ybWF0UGFyYW1zKGNvbnRleHQucG9zdHByb2Nlc3NpbmdQYXJhbXMpO1xuICBuZWVkc1Bvc3Rwcm9jZXNzaW5nIHx8PSBmb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcy5zaXplID4gMDtcbiAgcmV0dXJuIGlyLmNyZWF0ZUkxOG5NZXNzYWdlT3AoXG4gICAgICBqb2IuYWxsb2NhdGVYcmVmSWQoKSwgY29udGV4dC5pMThuQmxvY2ssIGNvbnRleHQubWVzc2FnZSwgbWVzc2FnZVBsYWNlaG9sZGVyID8/IG51bGwsXG4gICAgICBmb3JtYXR0ZWRQYXJhbXMsIGZvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zLCBuZWVkc1Bvc3Rwcm9jZXNzaW5nKTtcbn1cblxuLyoqXG4gKiBGb3JtYXRzIGEgbWFwIG9mIGBJMThuUGFyYW1WYWx1ZVtdYCB2YWx1ZXMgaW50byBhIG1hcCBvZiBgRXhwcmVzc2lvbmAgdmFsdWVzLlxuICogQHJldHVybiBBIHR1cGxlIG9mIHRoZSBmb3JtYXR0ZWQgcGFyYW1zIGFuZCBhIGJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHBvc3Rwcm9jZXNzaW5nIGlzIG5lZWRlZFxuICogICAgIGZvciBhbnkgb2YgdGhlIHBhcmFtc1xuICovXG5mdW5jdGlvbiBmb3JtYXRQYXJhbXMocGFyYW1zOiBNYXA8c3RyaW5nLCBpci5JMThuUGFyYW1WYWx1ZVtdPik6XG4gICAgW01hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sIGJvb2xlYW5dIHtcbiAgY29uc3QgZm9ybWF0dGVkUGFyYW1zID0gbmV3IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4oKTtcbiAgbGV0IG5lZWRzUG9zdHByb2Nlc3NpbmcgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBbcGxhY2Vob2xkZXIsIHBsYWNlaG9sZGVyVmFsdWVzXSBvZiBwYXJhbXMpIHtcbiAgICBjb25zdCBbc2VyaWFsaXplZFZhbHVlcywgcGFyYW1OZWVkc1Bvc3Rwcm9jZXNzaW5nXSA9IGZvcm1hdFBhcmFtVmFsdWVzKHBsYWNlaG9sZGVyVmFsdWVzKTtcbiAgICBuZWVkc1Bvc3Rwcm9jZXNzaW5nIHx8PSBwYXJhbU5lZWRzUG9zdHByb2Nlc3Npbmc7XG4gICAgaWYgKHNlcmlhbGl6ZWRWYWx1ZXMgIT09IG51bGwpIHtcbiAgICAgIGZvcm1hdHRlZFBhcmFtcy5zZXQocGxhY2Vob2xkZXIsIG8ubGl0ZXJhbChzZXJpYWxpemVkVmFsdWVzKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBbZm9ybWF0dGVkUGFyYW1zLCBuZWVkc1Bvc3Rwcm9jZXNzaW5nXTtcbn1cblxuLyoqXG4gKiBGb3JtYXRzIGFuIGBJMThuUGFyYW1WYWx1ZVtdYCBpbnRvIGEgc3RyaW5nIChvciBudWxsIGZvciBlbXB0eSBhcnJheSkuXG4gKiBAcmV0dXJuIEEgdHVwbGUgb2YgdGhlIGZvcm1hdHRlZCB2YWx1ZSBhbmQgYSBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciBwb3N0cHJvY2Vzc2luZyBpcyBuZWVkZWRcbiAqICAgICBmb3IgdGhlIHZhbHVlXG4gKi9cbmZ1bmN0aW9uIGZvcm1hdFBhcmFtVmFsdWVzKHZhbHVlczogaXIuSTE4blBhcmFtVmFsdWVbXSk6IFtzdHJpbmd8bnVsbCwgYm9vbGVhbl0ge1xuICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBbbnVsbCwgZmFsc2VdO1xuICB9XG4gIGNvbGxhcHNlRWxlbWVudFRlbXBsYXRlUGFpcnModmFsdWVzKTtcbiAgY29uc3Qgc2VyaWFsaXplZFZhbHVlcyA9IHZhbHVlcy5tYXAodmFsdWUgPT4gZm9ybWF0VmFsdWUodmFsdWUpKTtcbiAgcmV0dXJuIHNlcmlhbGl6ZWRWYWx1ZXMubGVuZ3RoID09PSAxID9cbiAgICAgIFtzZXJpYWxpemVkVmFsdWVzWzBdLCBmYWxzZV0gOlxuICAgICAgW2Ake0xJU1RfU1RBUlRfTUFSS0VSfSR7c2VyaWFsaXplZFZhbHVlcy5qb2luKExJU1RfREVMSU1JVEVSKX0ke0xJU1RfRU5EX01BUktFUn1gLCB0cnVlXTtcbn1cblxuLyoqXG4gKiBDb2xsYXBzZXMgZWxlbWVudC90ZW1wbGF0ZSBwYWlycyB0aGF0IHJlZmVyIHRvIHRoZSBzYW1lIHN1YlRlbXBsYXRlSW5kZXgsIGkuZS4gZWxlbWVudHMgYW5kXG4gKiB0ZW1wbGF0ZXMgdGhhdCByZWZlciB0byB0aGUgc2FtZSBlbGVtZW50IGluc3RhbmNlLlxuICpcbiAqIFRoaXMgYWNjb3VudHMgZm9yIHRoZSBjYXNlIG9mIGEgc3RydWN0dXJhbCBkaXJlY3RpdmUgaW5zaWRlIGFuIGkxOG4gYmxvY2ssIGUuZy46XG4gKiBgYGBcbiAqIDxkaXYgaTE4bj5cbiAqICAgPGRpdiAqbmdJZj1cImNvbmRpdGlvblwiPlxuICogPC9kaXY+XG4gKiBgYGBcbiAqXG4gKiBJbiB0aGlzIGNhc2UsIGJvdGggdGhlIGVsZW1lbnQgc3RhcnQgYW5kIHRlbXBsYXRlIHN0YXJ0IHBsYWNlaG9sZGVycyBhcmUgdGhlIHNhbWUsXG4gKiBhbmQgd2UgY29sbGFwc2UgdGhlbSBkb3duIGludG8gYSBzaW5nbGUgY29tcG91bmQgcGxhY2Vob2xkZXIgdmFsdWUuIFJhdGhlciB0aGFuIHByb2R1Y2VcbiAqIGBbXFx1RkZGRCMxOjFcXHVGRkZEfFxcdUZGRkQqMjoxXFx1RkZGRF1gLCB3ZSB3YW50IHRvIHByb2R1Y2UgYFxcdUZGRkQjMToxXFx1RkZGRFxcdUZGRkQqMjoxXFx1RkZGRGAsXG4gKiBsaWtld2lzZSBmb3IgdGhlIGNsb3Npbmcgb2YgdGhlIGVsZW1lbnQvdGVtcGxhdGUuXG4gKi9cbmZ1bmN0aW9uIGNvbGxhcHNlRWxlbWVudFRlbXBsYXRlUGFpcnModmFsdWVzOiBpci5JMThuUGFyYW1WYWx1ZVtdKSB7XG4gIC8vIFJlY29yZCB0aGUgaW5kaWNpZXMgb2YgZWxlbWVudCBhbmQgdGVtcGxhdGUgdmFsdWVzIGluIHRoZSB2YWx1ZXMgYXJyYXkgYnkgc3ViVGVtcGxhdGVJbmRleC5cbiAgY29uc3QgdmFsdWVJbmRpY2llc0J5U3ViVGVtcGxhdGVJbmRleCA9IG5ldyBNYXA8bnVtYmVyLCBudW1iZXJbXT4oKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB2YWx1ZSA9IHZhbHVlc1tpXTtcbiAgICBpZiAodmFsdWUuc3ViVGVtcGxhdGVJbmRleCAhPT0gbnVsbCAmJlxuICAgICAgICAodmFsdWUuZmxhZ3MgJiAoaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZykpKSB7XG4gICAgICBjb25zdCB2YWx1ZUluZGljaWVzID0gdmFsdWVJbmRpY2llc0J5U3ViVGVtcGxhdGVJbmRleC5nZXQodmFsdWUuc3ViVGVtcGxhdGVJbmRleCkgPz8gW107XG4gICAgICB2YWx1ZUluZGljaWVzLnB1c2goaSk7XG4gICAgICB2YWx1ZUluZGljaWVzQnlTdWJUZW1wbGF0ZUluZGV4LnNldCh2YWx1ZS5zdWJUZW1wbGF0ZUluZGV4LCB2YWx1ZUluZGljaWVzKTtcbiAgICB9XG4gIH1cblxuICAvLyBGb3IgZWFjaCBzdWJUZW1wbGF0ZUluZGV4LCBjaGVjayBpZiBhbnkgdmFsdWVzIGNhbiBiZSBjb2xsYXBzZWQuXG4gIGZvciAoY29uc3QgW3N1YlRlbXBsYXRlSW5kZXgsIHZhbHVlSW5kaWNpZXNdIG9mIHZhbHVlSW5kaWNpZXNCeVN1YlRlbXBsYXRlSW5kZXgpIHtcbiAgICBpZiAodmFsdWVJbmRpY2llcy5sZW5ndGggPiAxKSB7XG4gICAgICBjb25zdCBlbGVtZW50SW5kZXggPVxuICAgICAgICAgIHZhbHVlSW5kaWNpZXMuZmluZChpbmRleCA9PiB2YWx1ZXNbaW5kZXhdLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPVxuICAgICAgICAgIHZhbHVlSW5kaWNpZXMuZmluZChpbmRleCA9PiB2YWx1ZXNbaW5kZXhdLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZyk7XG4gICAgICAvLyBJZiB0aGUgdmFsdWVzIGxpc3QgY29udGFpbnMgYm90aCBhbiBlbGVtZW50IGFuZCB0ZW1wbGF0ZSB2YWx1ZSwgd2UgY2FuIGNvbGxhcHNlLlxuICAgICAgaWYgKGVsZW1lbnRJbmRleCAhPT0gdW5kZWZpbmVkICYmIHRlbXBsYXRlSW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBlbGVtZW50VmFsdWUgPSB2YWx1ZXNbZWxlbWVudEluZGV4XTtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVWYWx1ZSA9IHZhbHVlc1t0ZW1wbGF0ZUluZGV4XTtcbiAgICAgICAgLy8gVG8gbWF0Y2ggdGhlIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgb3V0cHV0LCBmbGlwIHRoZSBvcmRlciBkZXBlbmRpbmcgb24gd2hldGhlciB0aGVcbiAgICAgICAgLy8gdmFsdWVzIHJlcHJlc2VudCBhIGNsb3Npbmcgb3Igb3BlbmluZyB0YWcgKG9yIGJvdGgpLlxuICAgICAgICAvLyBUT0RPKG1tYWxlcmJhKTogRmlndXJlIG91dCBpZiB0aGlzIG1ha2VzIGEgZGlmZmVyZW5jZSBpbiB0ZXJtcyBvZiBlaXRoZXIgZnVuY3Rpb25hbGl0eSxcbiAgICAgICAgLy8gb3IgdGhlIHJlc3VsdGluZyBtZXNzYWdlIElELiBJZiBub3QsIHdlIGNhbiByZW1vdmUgdGhlIHNwZWNpYWwtY2FzaW5nIGluIHRoZSBmdXR1cmUuXG4gICAgICAgIGxldCBjb21wdW5kVmFsdWU6IHN0cmluZztcbiAgICAgICAgaWYgKChlbGVtZW50VmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWcpICYmXG4gICAgICAgICAgICAoZWxlbWVudFZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZykpIHtcbiAgICAgICAgICAvLyBUT0RPKG1tYWxlcmJhKTogSXMgdGhpcyBhIFREQiBidWc/IEkgZG9uJ3QgdW5kZXJzdGFuZCB3aHkgaXQgd291bGQgcHV0IHRoZSB0ZW1wbGF0ZVxuICAgICAgICAgIC8vIHZhbHVlIHR3aWNlLlxuICAgICAgICAgIGNvbXB1bmRWYWx1ZSA9IGAke2Zvcm1hdFZhbHVlKHRlbXBsYXRlVmFsdWUpfSR7Zm9ybWF0VmFsdWUoZWxlbWVudFZhbHVlKX0ke1xuICAgICAgICAgICAgICBmb3JtYXRWYWx1ZSh0ZW1wbGF0ZVZhbHVlKX1gO1xuICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnRWYWx1ZS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZykge1xuICAgICAgICAgIGNvbXB1bmRWYWx1ZSA9IGAke2Zvcm1hdFZhbHVlKHRlbXBsYXRlVmFsdWUpfSR7Zm9ybWF0VmFsdWUoZWxlbWVudFZhbHVlKX1gO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbXB1bmRWYWx1ZSA9IGAke2Zvcm1hdFZhbHVlKGVsZW1lbnRWYWx1ZSl9JHtmb3JtYXRWYWx1ZSh0ZW1wbGF0ZVZhbHVlKX1gO1xuICAgICAgICB9XG4gICAgICAgIC8vIFJlcGxhY2UgdGhlIGVsZW1lbnQgdmFsdWUgd2l0aCB0aGUgY29tYmluZWQgdmFsdWUuXG4gICAgICAgIHZhbHVlcy5zcGxpY2UoXG4gICAgICAgICAgICBlbGVtZW50SW5kZXgsIDEsXG4gICAgICAgICAgICB7dmFsdWU6IGNvbXB1bmRWYWx1ZSwgc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3M6IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuTm9uZX0pO1xuICAgICAgICAvLyBSZXBsYWNlIHRoZSB0ZW1wbGF0ZSB2YWx1ZSB3aXRoIG51bGwgdG8gcHJlc2VydmUgdGhlIGluZGljaWVzIHdlIGNhbGN1bGF0ZWQgZWFybGllci5cbiAgICAgICAgdmFsdWVzLnNwbGljZSh0ZW1wbGF0ZUluZGV4LCAxLCBudWxsISk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gU3RyaXAgb3V0IGFueSBudWxsZWQgb3V0IHZhbHVlcyB3ZSBpbnRyb2R1Y2VkIGFib3ZlLlxuICBmb3IgKGxldCBpID0gdmFsdWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKHZhbHVlc1tpXSA9PT0gbnVsbCkge1xuICAgICAgdmFsdWVzLnNwbGljZShpLCAxKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBGb3JtYXRzIGEgc2luZ2xlIGBJMThuUGFyYW1WYWx1ZWAgaW50byBhIHN0cmluZ1xuICovXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZSh2YWx1ZTogaXIuSTE4blBhcmFtVmFsdWUpOiBzdHJpbmcge1xuICAvLyBJZiB0aGVyZSBhcmUgbm8gc3BlY2lhbCBmbGFncywganVzdCByZXR1cm4gdGhlIHJhdyB2YWx1ZS5cbiAgaWYgKHZhbHVlLmZsYWdzID09PSBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmUpIHtcbiAgICByZXR1cm4gYCR7dmFsdWUudmFsdWV9YDtcbiAgfVxuXG4gIGxldCB0YWdNYXJrZXIgPSAnJztcbiAgbGV0IGNsb3NlTWFya2VyID0gJyc7XG4gIGlmICh2YWx1ZS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZykge1xuICAgIHRhZ01hcmtlciA9IEVMRU1FTlRfTUFSS0VSO1xuICB9IGVsc2UgaWYgKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5UZW1wbGF0ZVRhZykge1xuICAgIHRhZ01hcmtlciA9IFRFTVBMQVRFX01BUktFUjtcbiAgfVxuICBpZiAodGFnTWFya2VyICE9PSAnJykge1xuICAgIGNsb3NlTWFya2VyID0gdmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnID8gVEFHX0NMT1NFX01BUktFUiA6ICcnO1xuICB9XG4gIGNvbnN0IGNvbnRleHQgPVxuICAgICAgdmFsdWUuc3ViVGVtcGxhdGVJbmRleCA9PT0gbnVsbCA/ICcnIDogYCR7Q09OVEVYVF9NQVJLRVJ9JHt2YWx1ZS5zdWJUZW1wbGF0ZUluZGV4fWA7XG4gIC8vIFNlbGYtY2xvc2luZyB0YWdzIHVzZSBhIHNwZWNpYWwgZm9ybSB0aGF0IGNvbmNhdGVuYXRlcyB0aGUgc3RhcnQgYW5kIGNsb3NlIHRhZyB2YWx1ZXMuXG4gIGlmICgodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWcpICYmXG4gICAgICAodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKSkge1xuICAgIHJldHVybiBgJHtFU0NBUEV9JHt0YWdNYXJrZXJ9JHt2YWx1ZS52YWx1ZX0ke2NvbnRleHR9JHtFU0NBUEV9JHtFU0NBUEV9JHtjbG9zZU1hcmtlcn0ke1xuICAgICAgICB0YWdNYXJrZXJ9JHt2YWx1ZS52YWx1ZX0ke2NvbnRleHR9JHtFU0NBUEV9YDtcbiAgfVxuICByZXR1cm4gYCR7RVNDQVBFfSR7Y2xvc2VNYXJrZXJ9JHt0YWdNYXJrZXJ9JHt2YWx1ZS52YWx1ZX0ke2NvbnRleHR9JHtFU0NBUEV9YDtcbn1cbiJdfQ==