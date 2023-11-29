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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdF9pMThuX21lc3NhZ2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9waGFzZXMvZXh0cmFjdF9pMThuX21lc3NhZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxDQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDbkQsT0FBTyxLQUFLLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0I7O0dBRUc7QUFDSCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFFeEI7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFFM0I7O0dBRUc7QUFDSCxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUM7QUFFNUI7O0dBRUc7QUFDSCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUU3Qjs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztBQUUzQjs7R0FFRztBQUNILE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDO0FBRTlCOztHQUVHO0FBQ0gsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDO0FBRTVCOztHQUVHO0FBQ0gsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBRTNCOzs7R0FHRztBQUNILE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFtQjtJQUNyRCwwREFBMEQ7SUFDMUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFDNUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQTZCLENBQUM7SUFDeEQsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDN0IsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsUUFBUSxFQUFFLENBQUMs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RyxFQUFFLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztRQUNwRCxPQUFPLEdBQUcsTUFBTSxHQUFHLFNBQVMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLE9BQU8sR0FBRyxNQUFNLEdBQUcsTUFBTSxHQUFHLFdBQVcsR0FDaEYsU0FBUyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsT0FBTyxHQUFHLE1BQU0sRUFBRSxDQUFDO0lBQ25ELENBQUM7SUFDRCxPQUFPLEdBQUcsTUFBTSxHQUFHLFdBQVcsR0FBRyxTQUFTLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLEdBQUcsTUFBTSxFQUFFLENBQUM7QUFDaEYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBUaGUgZXNjYXBlIHNlcXVlbmNlIHVzZWQgaW5kaWNhdGUgbWVzc2FnZSBwYXJhbSB2YWx1ZXMuXG4gKi9cbmNvbnN0IEVTQ0FQRSA9ICdcXHVGRkZEJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBhbiBlbGVtZW50IHRhZy5cbiAqL1xuY29uc3QgRUxFTUVOVF9NQVJLRVIgPSAnIyc7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgYSB0ZW1wbGF0ZSB0YWcuXG4gKi9cbmNvbnN0IFRFTVBMQVRFX01BUktFUiA9ICcqJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBjbG9zaW5nIG9mIGFuIGVsZW1lbnQgb3IgdGVtcGxhdGUgdGFnLlxuICovXG5jb25zdCBUQUdfQ0xPU0VfTUFSS0VSID0gJy8nO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIHRoZSBzdWItdGVtcGxhdGUgY29udGV4dC5cbiAqL1xuY29uc3QgQ09OVEVYVF9NQVJLRVIgPSAnOic7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgdGhlIHN0YXJ0IG9mIGEgbGlzdCBvZiB2YWx1ZXMuXG4gKi9cbmNvbnN0IExJU1RfU1RBUlRfTUFSS0VSID0gJ1snO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIHRoZSBlbmQgb2YgYSBsaXN0IG9mIHZhbHVlcy5cbiAqL1xuY29uc3QgTElTVF9FTkRfTUFSS0VSID0gJ10nO1xuXG4vKipcbiAqIERlbGltaXRlciB1c2VkIHRvIHNlcGFyYXRlIG11bHRpcGxlIHZhbHVlcyBpbiBhIGxpc3QuXG4gKi9cbmNvbnN0IExJU1RfREVMSU1JVEVSID0gJ3wnO1xuXG4vKipcbiAqIEZvcm1hdHMgdGhlIHBhcmFtIG1hcHMgb24gZXh0cmFjdGVkIG1lc3NhZ2Ugb3BzIGludG8gYSBtYXBzIG9mIGBFeHByZXNzaW9uYCBvYmplY3RzIHRoYXQgY2FuIGJlXG4gKiB1c2VkIGluIHRoZSBmaW5hbCBvdXRwdXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0STE4bk1lc3NhZ2VzKGpvYjogQ29tcGlsYXRpb25Kb2IpOiB2b2lkIHtcbiAgLy8gU2F2ZSB0aGUgaTE4biBzdGFydCBhbmQgaTE4biBjb250ZXh0IG9wcyBmb3IgbGF0ZXIgdXNlLlxuICBjb25zdCBpMThuQ29udGV4dHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bkNvbnRleHRPcD4oKTtcbiAgY29uc3QgaTE4bkJsb2NrcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuU3RhcnRPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIHN3aXRjaCAob3Aua2luZCkge1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuQ29udGV4dDpcbiAgICAgICAgICBpMThuQ29udGV4dHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICAgIGkxOG5CbG9ja3Muc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBFeHRyYWN0IG1lc3NhZ2VzIGZyb20gcm9vdCBpMThuIGJsb2Nrcy5cbiAgY29uc3QgaTE4bkJsb2NrTWVzc2FnZXMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuSTE4bk1lc3NhZ2VPcD4oKTtcbiAgZm9yIChjb25zdCB1bml0IG9mIGpvYi51bml0cykge1xuICAgIGZvciAoY29uc3Qgb3Agb2YgdW5pdC5jcmVhdGUpIHtcbiAgICAgIGlmIChvcC5raW5kID09PSBpci5PcEtpbmQuSTE4blN0YXJ0ICYmIG9wLnhyZWYgPT09IG9wLnJvb3QpIHtcbiAgICAgICAgaWYgKCFvcC5jb250ZXh0KSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ0kxOG4gc3RhcnQgb3Agc2hvdWxkIGhhdmUgaXRzIGNvbnRleHQgc2V0LicpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGkxOG5NZXNzYWdlT3AgPSBjcmVhdGVJMThuTWVzc2FnZShqb2IsIGkxOG5Db250ZXh0cy5nZXQob3AuY29udGV4dCkhKTtcbiAgICAgICAgaTE4bkJsb2NrTWVzc2FnZXMuc2V0KG9wLnhyZWYsIGkxOG5NZXNzYWdlT3ApO1xuICAgICAgICB1bml0LmNyZWF0ZS5wdXNoKGkxOG5NZXNzYWdlT3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEV4dHJhY3QgbWVzc2FnZXMgZnJvbSBJQ1VzIHdpdGggdGhlaXIgb3duIHN1Yi1jb250ZXh0LlxuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkljdVN0YXJ0OlxuICAgICAgICAgIGlmICghb3AuY29udGV4dCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0lDVSBvcCBzaG91bGQgaGF2ZSBpdHMgY29udGV4dCBzZXQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGkxOG5Db250ZXh0ID0gaTE4bkNvbnRleHRzLmdldChvcC5jb250ZXh0KSE7XG4gICAgICAgICAgaWYgKGkxOG5Db250ZXh0LmNvbnRleHRLaW5kID09PSBpci5JMThuQ29udGV4dEtpbmQuSWN1KSB7XG4gICAgICAgICAgICBjb25zdCBzdWJNZXNzYWdlID0gY3JlYXRlSTE4bk1lc3NhZ2Uoam9iLCBpMThuQ29udGV4dCwgb3AubWVzc2FnZVBsYWNlaG9sZGVyKTtcbiAgICAgICAgICAgIHVuaXQuY3JlYXRlLnB1c2goc3ViTWVzc2FnZSk7XG4gICAgICAgICAgICBjb25zdCByb290STE4bklkID0gaTE4bkJsb2Nrcy5nZXQoaTE4bkNvbnRleHQuaTE4bkJsb2NrKSEucm9vdDtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudE1lc3NhZ2UgPSBpMThuQmxvY2tNZXNzYWdlcy5nZXQocm9vdEkxOG5JZCk7XG4gICAgICAgICAgICBwYXJlbnRNZXNzYWdlPy5zdWJNZXNzYWdlcy5wdXNoKHN1Yk1lc3NhZ2UueHJlZik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSWN1RW5kOlxuICAgICAgICAgIGlyLk9wTGlzdC5yZW1vdmU8aXIuQ3JlYXRlT3A+KG9wKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gaTE4biBtZXNzYWdlIG9wIGZyb20gYW4gaTE4biBjb250ZXh0IG9wLlxuICovXG5mdW5jdGlvbiBjcmVhdGVJMThuTWVzc2FnZShcbiAgICBqb2I6IENvbXBpbGF0aW9uSm9iLCBjb250ZXh0OiBpci5JMThuQ29udGV4dE9wLCBtZXNzYWdlUGxhY2Vob2xkZXI/OiBzdHJpbmcpOiBpci5JMThuTWVzc2FnZU9wIHtcbiAgbGV0IFtmb3JtYXR0ZWRQYXJhbXMsIG5lZWRzUG9zdHByb2Nlc3NpbmddID0gZm9ybWF0UGFyYW1zKGNvbnRleHQucGFyYW1zKTtcbiAgY29uc3QgW2Zvcm1hdHRlZFBvc3Rwcm9jZXNzaW5nUGFyYW1zXSA9IGZvcm1hdFBhcmFtcyhjb250ZXh0LnBvc3Rwcm9jZXNzaW5nUGFyYW1zKTtcbiAgbmVlZHNQb3N0cHJvY2Vzc2luZyB8fD0gZm9ybWF0dGVkUG9zdHByb2Nlc3NpbmdQYXJhbXMuc2l6ZSA+IDA7XG4gIHJldHVybiBpci5jcmVhdGVJMThuTWVzc2FnZU9wKFxuICAgICAgam9iLmFsbG9jYXRlWHJlZklkKCksIGNvbnRleHQuaTE4bkJsb2NrLCBjb250ZXh0Lm1lc3NhZ2UsIG1lc3NhZ2VQbGFjZWhvbGRlciA/PyBudWxsLFxuICAgICAgZm9ybWF0dGVkUGFyYW1zLCBmb3JtYXR0ZWRQb3N0cHJvY2Vzc2luZ1BhcmFtcywgbmVlZHNQb3N0cHJvY2Vzc2luZyk7XG59XG5cbi8qKlxuICogRm9ybWF0cyBhIG1hcCBvZiBgSTE4blBhcmFtVmFsdWVbXWAgdmFsdWVzIGludG8gYSBtYXAgb2YgYEV4cHJlc3Npb25gIHZhbHVlcy5cbiAqIEByZXR1cm4gQSB0dXBsZSBvZiB0aGUgZm9ybWF0dGVkIHBhcmFtcyBhbmQgYSBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciBwb3N0cHJvY2Vzc2luZyBpcyBuZWVkZWRcbiAqICAgICBmb3IgYW55IG9mIHRoZSBwYXJhbXNcbiAqL1xuZnVuY3Rpb24gZm9ybWF0UGFyYW1zKHBhcmFtczogTWFwPHN0cmluZywgaXIuSTE4blBhcmFtVmFsdWVbXT4pOlxuICAgIFtNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LCBib29sZWFuXSB7XG4gIGNvbnN0IGZvcm1hdHRlZFBhcmFtcyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+KCk7XG4gIGxldCBuZWVkc1Bvc3Rwcm9jZXNzaW5nID0gZmFsc2U7XG4gIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCBwbGFjZWhvbGRlclZhbHVlc10gb2YgcGFyYW1zKSB7XG4gICAgY29uc3QgW3NlcmlhbGl6ZWRWYWx1ZXMsIHBhcmFtTmVlZHNQb3N0cHJvY2Vzc2luZ10gPSBmb3JtYXRQYXJhbVZhbHVlcyhwbGFjZWhvbGRlclZhbHVlcyk7XG4gICAgbmVlZHNQb3N0cHJvY2Vzc2luZyB8fD0gcGFyYW1OZWVkc1Bvc3Rwcm9jZXNzaW5nO1xuICAgIGlmIChzZXJpYWxpemVkVmFsdWVzICE9PSBudWxsKSB7XG4gICAgICBmb3JtYXR0ZWRQYXJhbXMuc2V0KHBsYWNlaG9sZGVyLCBvLmxpdGVyYWwoc2VyaWFsaXplZFZhbHVlcykpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gW2Zvcm1hdHRlZFBhcmFtcywgbmVlZHNQb3N0cHJvY2Vzc2luZ107XG59XG5cbi8qKlxuICogRm9ybWF0cyBhbiBgSTE4blBhcmFtVmFsdWVbXWAgaW50byBhIHN0cmluZyAob3IgbnVsbCBmb3IgZW1wdHkgYXJyYXkpLlxuICogQHJldHVybiBBIHR1cGxlIG9mIHRoZSBmb3JtYXR0ZWQgdmFsdWUgYW5kIGEgYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgcG9zdHByb2Nlc3NpbmcgaXMgbmVlZGVkXG4gKiAgICAgZm9yIHRoZSB2YWx1ZVxuICovXG5mdW5jdGlvbiBmb3JtYXRQYXJhbVZhbHVlcyh2YWx1ZXM6IGlyLkkxOG5QYXJhbVZhbHVlW10pOiBbc3RyaW5nfG51bGwsIGJvb2xlYW5dIHtcbiAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gW251bGwsIGZhbHNlXTtcbiAgfVxuICBjb2xsYXBzZUVsZW1lbnRUZW1wbGF0ZVBhaXJzKHZhbHVlcyk7XG4gIGNvbnN0IHNlcmlhbGl6ZWRWYWx1ZXMgPSB2YWx1ZXMubWFwKHZhbHVlID0+IGZvcm1hdFZhbHVlKHZhbHVlKSk7XG4gIHJldHVybiBzZXJpYWxpemVkVmFsdWVzLmxlbmd0aCA9PT0gMSA/XG4gICAgICBbc2VyaWFsaXplZFZhbHVlc1swXSwgZmFsc2VdIDpcbiAgICAgIFtgJHtMSVNUX1NUQVJUX01BUktFUn0ke3NlcmlhbGl6ZWRWYWx1ZXMuam9pbihMSVNUX0RFTElNSVRFUil9JHtMSVNUX0VORF9NQVJLRVJ9YCwgdHJ1ZV07XG59XG5cbi8qKlxuICogQ29sbGFwc2VzIGVsZW1lbnQvdGVtcGxhdGUgcGFpcnMgdGhhdCByZWZlciB0byB0aGUgc2FtZSBzdWJUZW1wbGF0ZUluZGV4LCBpLmUuIGVsZW1lbnRzIGFuZFxuICogdGVtcGxhdGVzIHRoYXQgcmVmZXIgdG8gdGhlIHNhbWUgZWxlbWVudCBpbnN0YW5jZS5cbiAqXG4gKiBUaGlzIGFjY291bnRzIGZvciB0aGUgY2FzZSBvZiBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIGluc2lkZSBhbiBpMThuIGJsb2NrLCBlLmcuOlxuICogYGBgXG4gKiA8ZGl2IGkxOG4+XG4gKiAgIDxkaXYgKm5nSWY9XCJjb25kaXRpb25cIj5cbiAqIDwvZGl2PlxuICogYGBgXG4gKlxuICogSW4gdGhpcyBjYXNlLCBib3RoIHRoZSBlbGVtZW50IHN0YXJ0IGFuZCB0ZW1wbGF0ZSBzdGFydCBwbGFjZWhvbGRlcnMgYXJlIHRoZSBzYW1lLFxuICogYW5kIHdlIGNvbGxhcHNlIHRoZW0gZG93biBpbnRvIGEgc2luZ2xlIGNvbXBvdW5kIHBsYWNlaG9sZGVyIHZhbHVlLiBSYXRoZXIgdGhhbiBwcm9kdWNlXG4gKiBgW1xcdUZGRkQjMToxXFx1RkZGRHxcXHVGRkZEKjI6MVxcdUZGRkRdYCwgd2Ugd2FudCB0byBwcm9kdWNlIGBcXHVGRkZEIzE6MVxcdUZGRkRcXHVGRkZEKjI6MVxcdUZGRkRgLFxuICogbGlrZXdpc2UgZm9yIHRoZSBjbG9zaW5nIG9mIHRoZSBlbGVtZW50L3RlbXBsYXRlLlxuICovXG5mdW5jdGlvbiBjb2xsYXBzZUVsZW1lbnRUZW1wbGF0ZVBhaXJzKHZhbHVlczogaXIuSTE4blBhcmFtVmFsdWVbXSkge1xuICAvLyBSZWNvcmQgdGhlIGluZGljaWVzIG9mIGVsZW1lbnQgYW5kIHRlbXBsYXRlIHZhbHVlcyBpbiB0aGUgdmFsdWVzIGFycmF5IGJ5IHN1YlRlbXBsYXRlSW5kZXguXG4gIGNvbnN0IHZhbHVlSW5kaWNpZXNCeVN1YlRlbXBsYXRlSW5kZXggPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyW10+KCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgdmFsdWUgPSB2YWx1ZXNbaV07XG4gICAgaWYgKHZhbHVlLnN1YlRlbXBsYXRlSW5kZXggIT09IG51bGwgJiZcbiAgICAgICAgKHZhbHVlLmZsYWdzICYgKGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpKSkge1xuICAgICAgY29uc3QgdmFsdWVJbmRpY2llcyA9IHZhbHVlSW5kaWNpZXNCeVN1YlRlbXBsYXRlSW5kZXguZ2V0KHZhbHVlLnN1YlRlbXBsYXRlSW5kZXgpID8/IFtdO1xuICAgICAgdmFsdWVJbmRpY2llcy5wdXNoKGkpO1xuICAgICAgdmFsdWVJbmRpY2llc0J5U3ViVGVtcGxhdGVJbmRleC5zZXQodmFsdWUuc3ViVGVtcGxhdGVJbmRleCwgdmFsdWVJbmRpY2llcyk7XG4gICAgfVxuICB9XG5cbiAgLy8gRm9yIGVhY2ggc3ViVGVtcGxhdGVJbmRleCwgY2hlY2sgaWYgYW55IHZhbHVlcyBjYW4gYmUgY29sbGFwc2VkLlxuICBmb3IgKGNvbnN0IFtzdWJUZW1wbGF0ZUluZGV4LCB2YWx1ZUluZGljaWVzXSBvZiB2YWx1ZUluZGljaWVzQnlTdWJUZW1wbGF0ZUluZGV4KSB7XG4gICAgaWYgKHZhbHVlSW5kaWNpZXMubGVuZ3RoID4gMSkge1xuICAgICAgY29uc3QgZWxlbWVudEluZGV4ID1cbiAgICAgICAgICB2YWx1ZUluZGljaWVzLmZpbmQoaW5kZXggPT4gdmFsdWVzW2luZGV4XS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyk7XG4gICAgICBjb25zdCB0ZW1wbGF0ZUluZGV4ID1cbiAgICAgICAgICB2YWx1ZUluZGljaWVzLmZpbmQoaW5kZXggPT4gdmFsdWVzW2luZGV4XS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpO1xuICAgICAgLy8gSWYgdGhlIHZhbHVlcyBsaXN0IGNvbnRhaW5zIGJvdGggYW4gZWxlbWVudCBhbmQgdGVtcGxhdGUgdmFsdWUsIHdlIGNhbiBjb2xsYXBzZS5cbiAgICAgIGlmIChlbGVtZW50SW5kZXggIT09IHVuZGVmaW5lZCAmJiB0ZW1wbGF0ZUluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudFZhbHVlID0gdmFsdWVzW2VsZW1lbnRJbmRleF07XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlVmFsdWUgPSB2YWx1ZXNbdGVtcGxhdGVJbmRleF07XG4gICAgICAgIC8vIFRvIG1hdGNoIHRoZSBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIG91dHB1dCwgZmxpcCB0aGUgb3JkZXIgZGVwZW5kaW5nIG9uIHdoZXRoZXIgdGhlXG4gICAgICAgIC8vIHZhbHVlcyByZXByZXNlbnQgYSBjbG9zaW5nIG9yIG9wZW5pbmcgdGFnIChvciBib3RoKS5cbiAgICAgICAgLy8gVE9ETyhtbWFsZXJiYSk6IEZpZ3VyZSBvdXQgaWYgdGhpcyBtYWtlcyBhIGRpZmZlcmVuY2UgaW4gdGVybXMgb2YgZWl0aGVyIGZ1bmN0aW9uYWxpdHksXG4gICAgICAgIC8vIG9yIHRoZSByZXN1bHRpbmcgbWVzc2FnZSBJRC4gSWYgbm90LCB3ZSBjYW4gcmVtb3ZlIHRoZSBzcGVjaWFsLWNhc2luZyBpbiB0aGUgZnV0dXJlLlxuICAgICAgICBsZXQgY29tcHVuZFZhbHVlOiBzdHJpbmc7XG4gICAgICAgIGlmICgoZWxlbWVudFZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnKSAmJlxuICAgICAgICAgICAgKGVsZW1lbnRWYWx1ZS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWcpKSB7XG4gICAgICAgICAgLy8gVE9ETyhtbWFsZXJiYSk6IElzIHRoaXMgYSBUREIgYnVnPyBJIGRvbid0IHVuZGVyc3RhbmQgd2h5IGl0IHdvdWxkIHB1dCB0aGUgdGVtcGxhdGVcbiAgICAgICAgICAvLyB2YWx1ZSB0d2ljZS5cbiAgICAgICAgICBjb21wdW5kVmFsdWUgPSBgJHtmb3JtYXRWYWx1ZSh0ZW1wbGF0ZVZhbHVlKX0ke2Zvcm1hdFZhbHVlKGVsZW1lbnRWYWx1ZSl9JHtcbiAgICAgICAgICAgICAgZm9ybWF0VmFsdWUodGVtcGxhdGVWYWx1ZSl9YDtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50VmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk9wZW5UYWcpIHtcbiAgICAgICAgICBjb21wdW5kVmFsdWUgPSBgJHtmb3JtYXRWYWx1ZSh0ZW1wbGF0ZVZhbHVlKX0ke2Zvcm1hdFZhbHVlKGVsZW1lbnRWYWx1ZSl9YDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb21wdW5kVmFsdWUgPSBgJHtmb3JtYXRWYWx1ZShlbGVtZW50VmFsdWUpfSR7Zm9ybWF0VmFsdWUodGVtcGxhdGVWYWx1ZSl9YDtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZXBsYWNlIHRoZSBlbGVtZW50IHZhbHVlIHdpdGggdGhlIGNvbWJpbmVkIHZhbHVlLlxuICAgICAgICB2YWx1ZXMuc3BsaWNlKFxuICAgICAgICAgICAgZWxlbWVudEluZGV4LCAxLFxuICAgICAgICAgICAge3ZhbHVlOiBjb21wdW5kVmFsdWUsIHN1YlRlbXBsYXRlSW5kZXgsIGZsYWdzOiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLk5vbmV9KTtcbiAgICAgICAgLy8gUmVwbGFjZSB0aGUgdGVtcGxhdGUgdmFsdWUgd2l0aCBudWxsIHRvIHByZXNlcnZlIHRoZSBpbmRpY2llcyB3ZSBjYWxjdWxhdGVkIGVhcmxpZXIuXG4gICAgICAgIHZhbHVlcy5zcGxpY2UodGVtcGxhdGVJbmRleCwgMSwgbnVsbCEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFN0cmlwIG91dCBhbnkgbnVsbGVkIG91dCB2YWx1ZXMgd2UgaW50cm9kdWNlZCBhYm92ZS5cbiAgZm9yIChsZXQgaSA9IHZhbHVlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmICh2YWx1ZXNbaV0gPT09IG51bGwpIHtcbiAgICAgIHZhbHVlcy5zcGxpY2UoaSwgMSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRm9ybWF0cyBhIHNpbmdsZSBgSTE4blBhcmFtVmFsdWVgIGludG8gYSBzdHJpbmdcbiAqL1xuZnVuY3Rpb24gZm9ybWF0VmFsdWUodmFsdWU6IGlyLkkxOG5QYXJhbVZhbHVlKTogc3RyaW5nIHtcbiAgLy8gSWYgdGhlcmUgYXJlIG5vIHNwZWNpYWwgZmxhZ3MsIGp1c3QgcmV0dXJuIHRoZSByYXcgdmFsdWUuXG4gIGlmICh2YWx1ZS5mbGFncyA9PT0gaXIuSTE4blBhcmFtVmFsdWVGbGFncy5Ob25lKSB7XG4gICAgcmV0dXJuIGAke3ZhbHVlLnZhbHVlfWA7XG4gIH1cblxuICBsZXQgdGFnTWFya2VyID0gJyc7XG4gIGxldCBjbG9zZU1hcmtlciA9ICcnO1xuICBpZiAodmFsdWUuZmxhZ3MgJiBpci5JMThuUGFyYW1WYWx1ZUZsYWdzLkVsZW1lbnRUYWcpIHtcbiAgICB0YWdNYXJrZXIgPSBFTEVNRU5UX01BUktFUjtcbiAgfSBlbHNlIGlmICh2YWx1ZS5mbGFncyAmIGlyLkkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpIHtcbiAgICB0YWdNYXJrZXIgPSBURU1QTEFURV9NQVJLRVI7XG4gIH1cbiAgaWYgKHRhZ01hcmtlciAhPT0gJycpIHtcbiAgICBjbG9zZU1hcmtlciA9IHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyA/IFRBR19DTE9TRV9NQVJLRVIgOiAnJztcbiAgfVxuICBjb25zdCBjb250ZXh0ID1cbiAgICAgIHZhbHVlLnN1YlRlbXBsYXRlSW5kZXggPT09IG51bGwgPyAnJyA6IGAke0NPTlRFWFRfTUFSS0VSfSR7dmFsdWUuc3ViVGVtcGxhdGVJbmRleH1gO1xuICAvLyBTZWxmLWNsb3NpbmcgdGFncyB1c2UgYSBzcGVjaWFsIGZvcm0gdGhhdCBjb25jYXRlbmF0ZXMgdGhlIHN0YXJ0IGFuZCBjbG9zZSB0YWcgdmFsdWVzLlxuICBpZiAoKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnKSAmJlxuICAgICAgKHZhbHVlLmZsYWdzICYgaXIuSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZykpIHtcbiAgICByZXR1cm4gYCR7RVNDQVBFfSR7dGFnTWFya2VyfSR7dmFsdWUudmFsdWV9JHtjb250ZXh0fSR7RVNDQVBFfSR7RVNDQVBFfSR7Y2xvc2VNYXJrZXJ9JHtcbiAgICAgICAgdGFnTWFya2VyfSR7dmFsdWUudmFsdWV9JHtjb250ZXh0fSR7RVNDQVBFfWA7XG4gIH1cbiAgcmV0dXJuIGAke0VTQ0FQRX0ke2Nsb3NlTWFya2VyfSR7dGFnTWFya2VyfSR7dmFsdWUudmFsdWV9JHtjb250ZXh0fSR7RVNDQVBFfWA7XG59XG4iXX0=