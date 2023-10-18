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
 * Flags that describe what an i18n param value. These determine how the value is serialized into
 * the final map.
 */
var I18nParamValueFlags;
(function (I18nParamValueFlags) {
    I18nParamValueFlags[I18nParamValueFlags["None"] = 0] = "None";
    /**
     *  This value represtents an element tag.
     */
    I18nParamValueFlags[I18nParamValueFlags["ElementTag"] = 1] = "ElementTag";
    /**
     * This value represents a template tag.
     */
    I18nParamValueFlags[I18nParamValueFlags["TemplateTag"] = 2] = "TemplateTag";
    /**
     * This value represents the opening of a tag.
     */
    I18nParamValueFlags[I18nParamValueFlags["OpenTag"] = 4] = "OpenTag";
    /**
     * This value represents the closing of a tag.
     */
    I18nParamValueFlags[I18nParamValueFlags["CloseTag"] = 8] = "CloseTag";
})(I18nParamValueFlags || (I18nParamValueFlags = {}));
/**
 * Represents the complete i18n params map for an i18n op.
 */
class I18nPlaceholderParams {
    constructor() {
        this.values = new Map();
    }
    /**
     * Adds a new value to the params map.
     */
    addValue(placeholder, value, subTemplateIndex, resolutionTime, flags) {
        const placeholderValues = this.values.get(placeholder) ?? [];
        placeholderValues.push({ value, subTemplateIndex, resolutionTime, flags });
        this.values.set(placeholder, placeholderValues);
    }
    /**
     * Saves the params map, in serialized form, into the given i18n op.
     */
    saveToOp(op) {
        for (const [placeholder, placeholderValues] of this.values) {
            // We need to run post-processing for any 1i8n ops that contain parameters with more than
            // one value, even if there are no parameters resolved at post-processing time.
            const creationValues = placeholderValues.filter(({ resolutionTime }) => resolutionTime === ir.I18nParamResolutionTime.Creation);
            if (creationValues.length > 1) {
                op.needsPostprocessing = true;
            }
            // Save creation time params to op.
            const serializedCreationValues = this.serializeValues(creationValues);
            if (serializedCreationValues !== null) {
                op.params.set(placeholder, o.literal(serializedCreationValues));
            }
            // Save post-processing time params to op.
            const serializedPostprocessingValues = this.serializeValues(placeholderValues.filter(({ resolutionTime }) => resolutionTime === ir.I18nParamResolutionTime.Postproccessing));
            if (serializedPostprocessingValues !== null) {
                op.needsPostprocessing = true;
                op.postprocessingParams.set(placeholder, o.literal(serializedPostprocessingValues));
            }
        }
    }
    /**
     * Merges another param map into this one.
     */
    merge(other) {
        for (const [placeholder, otherValues] of other.values) {
            const currentValues = this.values.get(placeholder) || [];
            // Child element close tag params should be prepended to maintain the same order as
            // TemplateDefinitionBuilder.
            const flags = otherValues[0].flags;
            if ((flags & I18nParamValueFlags.CloseTag) && !(flags & I18nParamValueFlags.OpenTag)) {
                this.values.set(placeholder, [...otherValues, ...currentValues]);
            }
            else {
                this.values.set(placeholder, [...currentValues, ...otherValues]);
            }
        }
    }
    /**
     * Serializes a list of i18n placeholder values.
     */
    serializeValues(values) {
        if (values.length === 0) {
            return null;
        }
        const serializedValues = values.map(value => this.serializeValue(value));
        return serializedValues.length === 1 ?
            serializedValues[0] :
            `${LIST_START_MARKER}${serializedValues.join(LIST_DELIMITER)}${LIST_END_MARKER}`;
    }
    /**
     * Serializes a single i18n placeholder value.
     */
    serializeValue(value) {
        let tagMarker = '';
        let closeMarker = '';
        if (value.flags & I18nParamValueFlags.ElementTag) {
            tagMarker = ELEMENT_MARKER;
        }
        else if (value.flags & I18nParamValueFlags.TemplateTag) {
            tagMarker = TEMPLATE_MARKER;
        }
        if (tagMarker !== '') {
            closeMarker = value.flags & I18nParamValueFlags.CloseTag ? TAG_CLOSE_MARKER : '';
        }
        const context = value.subTemplateIndex === null ? '' : `${CONTEXT_MARKER}${value.subTemplateIndex}`;
        // Self-closing tags use a special form that concatenates the start and close tag values.
        if ((value.flags & I18nParamValueFlags.OpenTag) &&
            (value.flags & I18nParamValueFlags.CloseTag)) {
            return `${ESCAPE}${tagMarker}${value.value}${context}${ESCAPE}${ESCAPE}${closeMarker}${tagMarker}${value.value}${context}${ESCAPE}`;
        }
        return `${ESCAPE}${closeMarker}${tagMarker}${value.value}${context}${ESCAPE}`;
    }
}
/**
 * Resolve the placeholders in i18n messages.
 */
export function phaseResolveI18nPlaceholders(job) {
    const params = new Map();
    const i18nOps = new Map();
    resolvePlaceholders(job, params, i18nOps);
    propagatePlaceholders(params, i18nOps);
    // After colleccting all params, save them to the i18n ops.
    for (const [xref, i18nOpParams] of params) {
        i18nOpParams.saveToOp(i18nOps.get(xref));
    }
    // Validate the root i18n ops have all placeholders filled in.
    for (const op of i18nOps.values()) {
        if (op.xref === op.root) {
            for (const placeholder in op.message.placeholders) {
                if (!op.params.has(placeholder) && !op.postprocessingParams.has(placeholder)) {
                    throw Error(`Failed to resolve i18n placeholder: ${placeholder}`);
                }
            }
        }
    }
}
/**
 * Resolve placeholders for each i18n op.
 */
function resolvePlaceholders(job, params, i18nOps) {
    for (const unit of job.units) {
        const elements = new Map();
        let currentI18nOp = null;
        // Record slots for tag name placeholders.
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                    i18nOps.set(op.xref, op);
                    currentI18nOp = op.kind === ir.OpKind.I18nStart ? op : null;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nOp = null;
                    break;
                case ir.OpKind.ElementStart:
                    // For elements with i18n placeholders, record its slot value in the params map under the
                    // corresponding tag start placeholder.
                    if (op.i18nPlaceholder !== undefined) {
                        if (currentI18nOp === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        elements.set(op.xref, op);
                        const { startName, closeName } = op.i18nPlaceholder;
                        let flags = I18nParamValueFlags.ElementTag | I18nParamValueFlags.OpenTag;
                        // For self-closing tags, there is no close tag placeholder. Instead, the start tag
                        // placeholder accounts for the start and close of the element.
                        if (closeName === '') {
                            flags |= I18nParamValueFlags.CloseTag;
                        }
                        addParam(params, currentI18nOp, startName, op.slot, currentI18nOp.subTemplateIndex, ir.I18nParamResolutionTime.Creation, flags);
                    }
                    break;
                case ir.OpKind.ElementEnd:
                    const startOp = elements.get(op.xref);
                    if (startOp && startOp.i18nPlaceholder !== undefined) {
                        if (currentI18nOp === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        const { closeName } = startOp.i18nPlaceholder;
                        // Self-closing tags don't have a closing tag placeholder.
                        if (closeName !== '') {
                            addParam(params, currentI18nOp, closeName, startOp.slot, currentI18nOp.subTemplateIndex, ir.I18nParamResolutionTime.Creation, I18nParamValueFlags.ElementTag | I18nParamValueFlags.CloseTag);
                        }
                    }
                    break;
                case ir.OpKind.Template:
                    if (op.i18nPlaceholder !== undefined) {
                        if (currentI18nOp === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        const subTemplateIndex = getSubTemplateIndexForTemplateTag(job, currentI18nOp, op);
                        addParam(params, currentI18nOp, op.i18nPlaceholder.startName, op.slot, subTemplateIndex, ir.I18nParamResolutionTime.Creation, I18nParamValueFlags.TemplateTag);
                        addParam(params, currentI18nOp, op.i18nPlaceholder.closeName, op.slot, subTemplateIndex, ir.I18nParamResolutionTime.Creation, I18nParamValueFlags.TemplateTag | I18nParamValueFlags.CloseTag);
                    }
                    break;
            }
        }
        // Fill in values for each of the i18n expression placeholders.
        const i18nBlockPlaceholderIndices = new Map();
        for (const op of unit.update) {
            if (op.kind === ir.OpKind.I18nExpression) {
                const i18nOp = i18nOps.get(op.owner);
                let index = i18nBlockPlaceholderIndices.get(op.owner) || 0;
                if (!i18nOp) {
                    throw Error('Cannot find corresponding i18nStart for i18nExpr');
                }
                addParam(params, i18nOp, op.i18nPlaceholder, index++, i18nOp.subTemplateIndex, op.resolutionTime);
                i18nBlockPlaceholderIndices.set(op.owner, index);
            }
        }
    }
}
/**
 * Add a param to the params map for the given i18n op.
 */
function addParam(params, i18nOp, placeholder, value, subTemplateIndex, resolutionTime, flags = I18nParamValueFlags.None) {
    const i18nOpParams = params.get(i18nOp.xref) || new I18nPlaceholderParams();
    i18nOpParams.addValue(placeholder, value, subTemplateIndex, resolutionTime, flags);
    params.set(i18nOp.xref, i18nOpParams);
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
 * Propagate placeholders up to their root i18n op.
 */
function propagatePlaceholders(params, i18nOps) {
    for (const [xref, opParams] of params) {
        const op = i18nOps.get(xref);
        if (op.xref !== op.root) {
            const rootParams = params.get(op.root) || new I18nPlaceholderParams();
            rootParams.merge(opParams);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX3BsYWNlaG9sZGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfaTE4bl9wbGFjZWhvbGRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUV4Qjs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztBQUUzQjs7R0FFRztBQUNILE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQztBQUU1Qjs7R0FFRztBQUNILE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0FBRTdCOztHQUVHO0FBQ0gsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBRTNCOztHQUVHO0FBQ0gsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUM7QUFFOUI7O0dBRUc7QUFDSCxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUM7QUFFNUI7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFFM0I7OztHQUdHO0FBQ0gsSUFBSyxtQkFzQko7QUF0QkQsV0FBSyxtQkFBbUI7SUFDdEIsNkRBQWEsQ0FBQTtJQUViOztPQUVHO0lBQ0gseUVBQWtCLENBQUE7SUFFbEI7O09BRUc7SUFDSCwyRUFBb0IsQ0FBQTtJQUVwQjs7T0FFRztJQUNILG1FQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gscUVBQWlCLENBQUE7QUFDbkIsQ0FBQyxFQXRCSSxtQkFBbUIsS0FBbkIsbUJBQW1CLFFBc0J2QjtBQTRCRDs7R0FFRztBQUNILE1BQU0scUJBQXFCO0lBQTNC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SUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUMsTUFBTSxFQUFFO1FBQ3BELElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRTtZQUN4QyxPQUFPLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztTQUNqQztLQUNGO0lBQ0QsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7QUFDakMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxxQkFBcUIsQ0FDMUIsTUFBNkMsRUFBRSxPQUF1QztJQUN4RixLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUksTUFBTSxFQUFFO1FBQ3JDLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUM7UUFDOUIsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUU7WUFDdkIsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxxQkFBcUIsRUFBRSxDQUFDO1lBQ3RFLFVBQVUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDNUI7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQgKiBhcyBpciBmcm9tICcuLi8uLi9pcic7XG5pbXBvcnQge0NvbXBvbmVudENvbXBpbGF0aW9uSm9ifSBmcm9tICcuLi9jb21waWxhdGlvbic7XG5cbi8qKlxuICogVGhlIGVzY2FwZSBzZXF1ZW5jZSB1c2VkIGluZGljYXRlIG1lc3NhZ2UgcGFyYW0gdmFsdWVzLlxuICovXG5jb25zdCBFU0NBUEUgPSAnXFx1RkZGRCc7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgYW4gZWxlbWVudCB0YWcuXG4gKi9cbmNvbnN0IEVMRU1FTlRfTUFSS0VSID0gJyMnO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIGEgdGVtcGxhdGUgdGFnLlxuICovXG5jb25zdCBURU1QTEFURV9NQVJLRVIgPSAnKic7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgY2xvc2luZyBvZiBhbiBlbGVtZW50IG9yIHRlbXBsYXRlIHRhZy5cbiAqL1xuY29uc3QgVEFHX0NMT1NFX01BUktFUiA9ICcvJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSB0aGUgc3ViLXRlbXBsYXRlIGNvbnRleHQuXG4gKi9cbmNvbnN0IENPTlRFWFRfTUFSS0VSID0gJzonO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIHRoZSBzdGFydCBvZiBhIGxpc3Qgb2YgdmFsdWVzLlxuICovXG5jb25zdCBMSVNUX1NUQVJUX01BUktFUiA9ICdbJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSB0aGUgZW5kIG9mIGEgbGlzdCBvZiB2YWx1ZXMuXG4gKi9cbmNvbnN0IExJU1RfRU5EX01BUktFUiA9ICddJztcblxuLyoqXG4gKiBEZWxpbWl0ZXIgdXNlZCB0byBzZXBhcmF0ZSBtdWx0aXBsZSB2YWx1ZXMgaW4gYSBsaXN0LlxuICovXG5jb25zdCBMSVNUX0RFTElNSVRFUiA9ICd8JztcblxuLyoqXG4gKiBGbGFncyB0aGF0IGRlc2NyaWJlIHdoYXQgYW4gaTE4biBwYXJhbSB2YWx1ZS4gVGhlc2UgZGV0ZXJtaW5lIGhvdyB0aGUgdmFsdWUgaXMgc2VyaWFsaXplZCBpbnRvXG4gKiB0aGUgZmluYWwgbWFwLlxuICovXG5lbnVtIEkxOG5QYXJhbVZhbHVlRmxhZ3Mge1xuICBOb25lID0gMGIwMDAwLFxuXG4gIC8qKlxuICAgKiAgVGhpcyB2YWx1ZSByZXByZXN0ZW50cyBhbiBlbGVtZW50IHRhZy5cbiAgICovXG4gIEVsZW1lbnRUYWcgPSAwYjAwMSxcblxuICAvKipcbiAgICogVGhpcyB2YWx1ZSByZXByZXNlbnRzIGEgdGVtcGxhdGUgdGFnLlxuICAgKi9cbiAgVGVtcGxhdGVUYWcgPSAwYjAwMTAsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyB0aGUgb3BlbmluZyBvZiBhIHRhZy5cbiAgICovXG4gIE9wZW5UYWcgPSAwYjAxMDAsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyB0aGUgY2xvc2luZyBvZiBhIHRhZy5cbiAgICovXG4gIENsb3NlVGFnID0gMGIxMDAwLFxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBzaW5nbGUgcGxhY2Vob2xkZXIgdmFsdWUgaW4gdGhlIGkxOG4gcGFyYW1zIG1hcC4gVGhlIG1hcCBtYXkgY29udGFpbiBtdWx0aXBsZVxuICogSTE4blBsYWNlaG9sZGVyVmFsdWUgcGVyIHBsYWNlaG9sZGVyLlxuICovXG5pbnRlcmZhY2UgSTE4blBsYWNlaG9sZGVyVmFsdWUge1xuICAvKipcbiAgICogVGhlIHZhbHVlLlxuICAgKi9cbiAgdmFsdWU6IHN0cmluZ3xudW1iZXI7XG5cbiAgLyoqXG4gICAqIFRoZSBzdWItdGVtcGxhdGUgaW5kZXggYXNzb2NpYXRlZCB3aXRoIHRoZSB2YWx1ZS5cbiAgICovXG4gIHN1YlRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsO1xuXG4gIC8qKlxuICAgKiBGbGFncyBhc3NvY2lhdGVkIHdpdGggdGhlIHZhbHVlLlxuICAgKi9cbiAgZmxhZ3M6IEkxOG5QYXJhbVZhbHVlRmxhZ3M7XG5cbiAgLyoqXG4gICAqIFRoZSB0aW1lIHdoZW4gdGhlIHBsYWNlaG9sZGVyIHZhbHVlIGlzIHJlc29sdmVkLlxuICAgKi9cbiAgcmVzb2x1dGlvblRpbWU6IGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIGNvbXBsZXRlIGkxOG4gcGFyYW1zIG1hcCBmb3IgYW4gaTE4biBvcC5cbiAqL1xuY2xhc3MgSTE4blBsYWNlaG9sZGVyUGFyYW1zIHtcbiAgdmFsdWVzID0gbmV3IE1hcDxzdHJpbmcsIEkxOG5QbGFjZWhvbGRlclZhbHVlW10+KCk7XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBuZXcgdmFsdWUgdG8gdGhlIHBhcmFtcyBtYXAuXG4gICAqL1xuICBhZGRWYWx1ZShcbiAgICAgIHBsYWNlaG9sZGVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmd8bnVtYmVyLCBzdWJUZW1wbGF0ZUluZGV4OiBudW1iZXJ8bnVsbCxcbiAgICAgIHJlc29sdXRpb25UaW1lOiBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZSwgZmxhZ3M6IEkxOG5QYXJhbVZhbHVlRmxhZ3MpIHtcbiAgICBjb25zdCBwbGFjZWhvbGRlclZhbHVlcyA9IHRoaXMudmFsdWVzLmdldChwbGFjZWhvbGRlcikgPz8gW107XG4gICAgcGxhY2Vob2xkZXJWYWx1ZXMucHVzaCh7dmFsdWUsIHN1YlRlbXBsYXRlSW5kZXgsIHJlc29sdXRpb25UaW1lLCBmbGFnc30pO1xuICAgIHRoaXMudmFsdWVzLnNldChwbGFjZWhvbGRlciwgcGxhY2Vob2xkZXJWYWx1ZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNhdmVzIHRoZSBwYXJhbXMgbWFwLCBpbiBzZXJpYWxpemVkIGZvcm0sIGludG8gdGhlIGdpdmVuIGkxOG4gb3AuXG4gICAqL1xuICBzYXZlVG9PcChvcDogaXIuSTE4blN0YXJ0T3ApIHtcbiAgICBmb3IgKGNvbnN0IFtwbGFjZWhvbGRlciwgcGxhY2Vob2xkZXJWYWx1ZXNdIG9mIHRoaXMudmFsdWVzKSB7XG4gICAgICAvLyBXZSBuZWVkIHRvIHJ1biBwb3N0LXByb2Nlc3NpbmcgZm9yIGFueSAxaThuIG9wcyB0aGF0IGNvbnRhaW4gcGFyYW1ldGVycyB3aXRoIG1vcmUgdGhhblxuICAgICAgLy8gb25lIHZhbHVlLCBldmVuIGlmIHRoZXJlIGFyZSBubyBwYXJhbWV0ZXJzIHJlc29sdmVkIGF0IHBvc3QtcHJvY2Vzc2luZyB0aW1lLlxuICAgICAgY29uc3QgY3JlYXRpb25WYWx1ZXMgPSBwbGFjZWhvbGRlclZhbHVlcy5maWx0ZXIoXG4gICAgICAgICAgKHtyZXNvbHV0aW9uVGltZX0pID0+IHJlc29sdXRpb25UaW1lID09PSBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZS5DcmVhdGlvbik7XG4gICAgICBpZiAoY3JlYXRpb25WYWx1ZXMubGVuZ3RoID4gMSkge1xuICAgICAgICBvcC5uZWVkc1Bvc3Rwcm9jZXNzaW5nID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gU2F2ZSBjcmVhdGlvbiB0aW1lIHBhcmFtcyB0byBvcC5cbiAgICAgIGNvbnN0IHNlcmlhbGl6ZWRDcmVhdGlvblZhbHVlcyA9IHRoaXMuc2VyaWFsaXplVmFsdWVzKGNyZWF0aW9uVmFsdWVzKTtcbiAgICAgIGlmIChzZXJpYWxpemVkQ3JlYXRpb25WYWx1ZXMgIT09IG51bGwpIHtcbiAgICAgICAgb3AucGFyYW1zLnNldChwbGFjZWhvbGRlciwgby5saXRlcmFsKHNlcmlhbGl6ZWRDcmVhdGlvblZhbHVlcykpO1xuICAgICAgfVxuXG4gICAgICAvLyBTYXZlIHBvc3QtcHJvY2Vzc2luZyB0aW1lIHBhcmFtcyB0byBvcC5cbiAgICAgIGNvbnN0IHNlcmlhbGl6ZWRQb3N0cHJvY2Vzc2luZ1ZhbHVlcyA9IHRoaXMuc2VyaWFsaXplVmFsdWVzKHBsYWNlaG9sZGVyVmFsdWVzLmZpbHRlcihcbiAgICAgICAgICAoe3Jlc29sdXRpb25UaW1lfSkgPT4gcmVzb2x1dGlvblRpbWUgPT09IGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLlBvc3Rwcm9jY2Vzc2luZykpO1xuICAgICAgaWYgKHNlcmlhbGl6ZWRQb3N0cHJvY2Vzc2luZ1ZhbHVlcyAhPT0gbnVsbCkge1xuICAgICAgICBvcC5uZWVkc1Bvc3Rwcm9jZXNzaW5nID0gdHJ1ZTtcbiAgICAgICAgb3AucG9zdHByb2Nlc3NpbmdQYXJhbXMuc2V0KHBsYWNlaG9sZGVyLCBvLmxpdGVyYWwoc2VyaWFsaXplZFBvc3Rwcm9jZXNzaW5nVmFsdWVzKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1lcmdlcyBhbm90aGVyIHBhcmFtIG1hcCBpbnRvIHRoaXMgb25lLlxuICAgKi9cbiAgbWVyZ2Uob3RoZXI6IEkxOG5QbGFjZWhvbGRlclBhcmFtcykge1xuICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCBvdGhlclZhbHVlc10gb2Ygb3RoZXIudmFsdWVzKSB7XG4gICAgICBjb25zdCBjdXJyZW50VmFsdWVzID0gdGhpcy52YWx1ZXMuZ2V0KHBsYWNlaG9sZGVyKSB8fCBbXTtcbiAgICAgIC8vIENoaWxkIGVsZW1lbnQgY2xvc2UgdGFnIHBhcmFtcyBzaG91bGQgYmUgcHJlcGVuZGVkIHRvIG1haW50YWluIHRoZSBzYW1lIG9yZGVyIGFzXG4gICAgICAvLyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLlxuICAgICAgY29uc3QgZmxhZ3MgPSBvdGhlclZhbHVlc1swXSEuZmxhZ3M7XG4gICAgICBpZiAoKGZsYWdzICYgSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZykgJiYgIShmbGFncyAmIEkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZykpIHtcbiAgICAgICAgdGhpcy52YWx1ZXMuc2V0KHBsYWNlaG9sZGVyLCBbLi4ub3RoZXJWYWx1ZXMsIC4uLmN1cnJlbnRWYWx1ZXNdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudmFsdWVzLnNldChwbGFjZWhvbGRlciwgWy4uLmN1cnJlbnRWYWx1ZXMsIC4uLm90aGVyVmFsdWVzXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZXMgYSBsaXN0IG9mIGkxOG4gcGxhY2Vob2xkZXIgdmFsdWVzLlxuICAgKi9cbiAgcHJpdmF0ZSBzZXJpYWxpemVWYWx1ZXModmFsdWVzOiBJMThuUGxhY2Vob2xkZXJWYWx1ZVtdKSB7XG4gICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzZXJpYWxpemVkVmFsdWVzID0gdmFsdWVzLm1hcCh2YWx1ZSA9PiB0aGlzLnNlcmlhbGl6ZVZhbHVlKHZhbHVlKSk7XG4gICAgcmV0dXJuIHNlcmlhbGl6ZWRWYWx1ZXMubGVuZ3RoID09PSAxID9cbiAgICAgICAgc2VyaWFsaXplZFZhbHVlc1swXSA6XG4gICAgICAgIGAke0xJU1RfU1RBUlRfTUFSS0VSfSR7c2VyaWFsaXplZFZhbHVlcy5qb2luKExJU1RfREVMSU1JVEVSKX0ke0xJU1RfRU5EX01BUktFUn1gO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZXMgYSBzaW5nbGUgaTE4biBwbGFjZWhvbGRlciB2YWx1ZS5cbiAgICovXG4gIHByaXZhdGUgc2VyaWFsaXplVmFsdWUodmFsdWU6IEkxOG5QbGFjZWhvbGRlclZhbHVlKSB7XG4gICAgbGV0IHRhZ01hcmtlciA9ICcnO1xuICAgIGxldCBjbG9zZU1hcmtlciA9ICcnO1xuICAgIGlmICh2YWx1ZS5mbGFncyAmIEkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZykge1xuICAgICAgdGFnTWFya2VyID0gRUxFTUVOVF9NQVJLRVI7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS5mbGFncyAmIEkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpIHtcbiAgICAgIHRhZ01hcmtlciA9IFRFTVBMQVRFX01BUktFUjtcbiAgICB9XG4gICAgaWYgKHRhZ01hcmtlciAhPT0gJycpIHtcbiAgICAgIGNsb3NlTWFya2VyID0gdmFsdWUuZmxhZ3MgJiBJMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnID8gVEFHX0NMT1NFX01BUktFUiA6ICcnO1xuICAgIH1cbiAgICBjb25zdCBjb250ZXh0ID1cbiAgICAgICAgdmFsdWUuc3ViVGVtcGxhdGVJbmRleCA9PT0gbnVsbCA/ICcnIDogYCR7Q09OVEVYVF9NQVJLRVJ9JHt2YWx1ZS5zdWJUZW1wbGF0ZUluZGV4fWA7XG4gICAgLy8gU2VsZi1jbG9zaW5nIHRhZ3MgdXNlIGEgc3BlY2lhbCBmb3JtIHRoYXQgY29uY2F0ZW5hdGVzIHRoZSBzdGFydCBhbmQgY2xvc2UgdGFnIHZhbHVlcy5cbiAgICBpZiAoKHZhbHVlLmZsYWdzICYgSTE4blBhcmFtVmFsdWVGbGFncy5PcGVuVGFnKSAmJlxuICAgICAgICAodmFsdWUuZmxhZ3MgJiBJMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKSkge1xuICAgICAgcmV0dXJuIGAke0VTQ0FQRX0ke3RhZ01hcmtlcn0ke3ZhbHVlLnZhbHVlfSR7Y29udGV4dH0ke0VTQ0FQRX0ke0VTQ0FQRX0ke2Nsb3NlTWFya2VyfSR7XG4gICAgICAgICAgdGFnTWFya2VyfSR7dmFsdWUudmFsdWV9JHtjb250ZXh0fSR7RVNDQVBFfWA7XG4gICAgfVxuICAgIHJldHVybiBgJHtFU0NBUEV9JHtjbG9zZU1hcmtlcn0ke3RhZ01hcmtlcn0ke3ZhbHVlLnZhbHVlfSR7Y29udGV4dH0ke0VTQ0FQRX1gO1xuICB9XG59XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgcGxhY2Vob2xkZXJzIGluIGkxOG4gbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwaGFzZVJlc29sdmVJMThuUGxhY2Vob2xkZXJzKGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IpIHtcbiAgY29uc3QgcGFyYW1zID0gbmV3IE1hcDxpci5YcmVmSWQsIEkxOG5QbGFjZWhvbGRlclBhcmFtcz4oKTtcbiAgY29uc3QgaTE4bk9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuU3RhcnRPcD4oKTtcblxuICByZXNvbHZlUGxhY2Vob2xkZXJzKGpvYiwgcGFyYW1zLCBpMThuT3BzKTtcbiAgcHJvcGFnYXRlUGxhY2Vob2xkZXJzKHBhcmFtcywgaTE4bk9wcyk7XG5cbiAgLy8gQWZ0ZXIgY29sbGVjY3RpbmcgYWxsIHBhcmFtcywgc2F2ZSB0aGVtIHRvIHRoZSBpMThuIG9wcy5cbiAgZm9yIChjb25zdCBbeHJlZiwgaTE4bk9wUGFyYW1zXSBvZiBwYXJhbXMpIHtcbiAgICBpMThuT3BQYXJhbXMuc2F2ZVRvT3AoaTE4bk9wcy5nZXQoeHJlZikhKTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlIHRoZSByb290IGkxOG4gb3BzIGhhdmUgYWxsIHBsYWNlaG9sZGVycyBmaWxsZWQgaW4uXG4gIGZvciAoY29uc3Qgb3Agb2YgaTE4bk9wcy52YWx1ZXMoKSkge1xuICAgIGlmIChvcC54cmVmID09PSBvcC5yb290KSB7XG4gICAgICBmb3IgKGNvbnN0IHBsYWNlaG9sZGVyIGluIG9wLm1lc3NhZ2UucGxhY2Vob2xkZXJzKSB7XG4gICAgICAgIGlmICghb3AucGFyYW1zLmhhcyhwbGFjZWhvbGRlcikgJiYgIW9wLnBvc3Rwcm9jZXNzaW5nUGFyYW1zLmhhcyhwbGFjZWhvbGRlcikpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcihgRmFpbGVkIHRvIHJlc29sdmUgaTE4biBwbGFjZWhvbGRlcjogJHtwbGFjZWhvbGRlcn1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlc29sdmUgcGxhY2Vob2xkZXJzIGZvciBlYWNoIGkxOG4gb3AuXG4gKi9cbmZ1bmN0aW9uIHJlc29sdmVQbGFjZWhvbGRlcnMoXG4gICAgam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYiwgcGFyYW1zOiBNYXA8aXIuWHJlZklkLCBJMThuUGxhY2Vob2xkZXJQYXJhbXM+LFxuICAgIGkxOG5PcHM6IE1hcDxpci5YcmVmSWQsIGlyLkkxOG5TdGFydE9wPikge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY29uc3QgZWxlbWVudHMgPSBuZXcgTWFwPGlyLlhyZWZJZCwgaXIuRWxlbWVudFN0YXJ0T3A+KCk7XG4gICAgbGV0IGN1cnJlbnRJMThuT3A6IGlyLkkxOG5TdGFydE9wfG51bGwgPSBudWxsO1xuXG4gICAgLy8gUmVjb3JkIHNsb3RzIGZvciB0YWcgbmFtZSBwbGFjZWhvbGRlcnMuXG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LmNyZWF0ZSkge1xuICAgICAgc3dpdGNoIChvcC5raW5kKSB7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5TdGFydDpcbiAgICAgICAgICBpMThuT3BzLnNldChvcC54cmVmLCBvcCk7XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQgPyBvcCA6IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkkxOG5FbmQ6XG4gICAgICAgICAgY3VycmVudEkxOG5PcCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaXIuT3BLaW5kLkVsZW1lbnRTdGFydDpcbiAgICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIHRoZVxuICAgICAgICAgIC8vIGNvcnJlc3BvbmRpbmcgdGFnIHN0YXJ0IHBsYWNlaG9sZGVyLlxuICAgICAgICAgIGlmIChvcC5pMThuUGxhY2Vob2xkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRJMThuT3AgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ2kxOG4gdGFnIHBsYWNlaG9sZGVyIHNob3VsZCBvbmx5IG9jY3VyIGluc2lkZSBhbiBpMThuIGJsb2NrJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbGVtZW50cy5zZXQob3AueHJlZiwgb3ApO1xuICAgICAgICAgICAgY29uc3Qge3N0YXJ0TmFtZSwgY2xvc2VOYW1lfSA9IG9wLmkxOG5QbGFjZWhvbGRlcjtcbiAgICAgICAgICAgIGxldCBmbGFncyA9IEkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZyB8IEkxOG5QYXJhbVZhbHVlRmxhZ3MuT3BlblRhZztcbiAgICAgICAgICAgIC8vIEZvciBzZWxmLWNsb3NpbmcgdGFncywgdGhlcmUgaXMgbm8gY2xvc2UgdGFnIHBsYWNlaG9sZGVyLiBJbnN0ZWFkLCB0aGUgc3RhcnQgdGFnXG4gICAgICAgICAgICAvLyBwbGFjZWhvbGRlciBhY2NvdW50cyBmb3IgdGhlIHN0YXJ0IGFuZCBjbG9zZSBvZiB0aGUgZWxlbWVudC5cbiAgICAgICAgICAgIGlmIChjbG9zZU5hbWUgPT09ICcnKSB7XG4gICAgICAgICAgICAgIGZsYWdzIHw9IEkxOG5QYXJhbVZhbHVlRmxhZ3MuQ2xvc2VUYWc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICBwYXJhbXMsIGN1cnJlbnRJMThuT3AsIHN0YXJ0TmFtZSwgb3Auc2xvdCEsIGN1cnJlbnRJMThuT3Auc3ViVGVtcGxhdGVJbmRleCxcbiAgICAgICAgICAgICAgICBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZS5DcmVhdGlvbiwgZmxhZ3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudEVuZDpcbiAgICAgICAgICBjb25zdCBzdGFydE9wID0gZWxlbWVudHMuZ2V0KG9wLnhyZWYpO1xuICAgICAgICAgIGlmIChzdGFydE9wICYmIHN0YXJ0T3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50STE4bk9wID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qge2Nsb3NlTmFtZX0gPSBzdGFydE9wLmkxOG5QbGFjZWhvbGRlcjtcbiAgICAgICAgICAgIC8vIFNlbGYtY2xvc2luZyB0YWdzIGRvbid0IGhhdmUgYSBjbG9zaW5nIHRhZyBwbGFjZWhvbGRlci5cbiAgICAgICAgICAgIGlmIChjbG9zZU5hbWUgIT09ICcnKSB7XG4gICAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgICAgcGFyYW1zLCBjdXJyZW50STE4bk9wLCBjbG9zZU5hbWUsIHN0YXJ0T3Auc2xvdCEsIGN1cnJlbnRJMThuT3Auc3ViVGVtcGxhdGVJbmRleCxcbiAgICAgICAgICAgICAgICAgIGlyLkkxOG5QYXJhbVJlc29sdXRpb25UaW1lLkNyZWF0aW9uLFxuICAgICAgICAgICAgICAgICAgSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnIHwgSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50STE4bk9wID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3ViVGVtcGxhdGVJbmRleCA9IGdldFN1YlRlbXBsYXRlSW5kZXhGb3JUZW1wbGF0ZVRhZyhqb2IsIGN1cnJlbnRJMThuT3AsIG9wKTtcbiAgICAgICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgICAgIHBhcmFtcywgY3VycmVudEkxOG5PcCwgb3AuaTE4blBsYWNlaG9sZGVyLnN0YXJ0TmFtZSwgb3Auc2xvdCEsIHN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgICAgICAgaXIuSTE4blBhcmFtUmVzb2x1dGlvblRpbWUuQ3JlYXRpb24sIEkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpO1xuICAgICAgICAgICAgYWRkUGFyYW0oXG4gICAgICAgICAgICAgICAgcGFyYW1zLCBjdXJyZW50STE4bk9wLCBvcC5pMThuUGxhY2Vob2xkZXIuY2xvc2VOYW1lLCBvcC5zbG90ISwgc3ViVGVtcGxhdGVJbmRleCxcbiAgICAgICAgICAgICAgICBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZS5DcmVhdGlvbixcbiAgICAgICAgICAgICAgICBJMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnIHwgSTE4blBhcmFtVmFsdWVGbGFncy5DbG9zZVRhZyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZpbGwgaW4gdmFsdWVzIGZvciBlYWNoIG9mIHRoZSBpMThuIGV4cHJlc3Npb24gcGxhY2Vob2xkZXJzLlxuICAgIGNvbnN0IGkxOG5CbG9ja1BsYWNlaG9sZGVySW5kaWNlcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBvcCBvZiB1bml0LnVwZGF0ZSkge1xuICAgICAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuRXhwcmVzc2lvbikge1xuICAgICAgICBjb25zdCBpMThuT3AgPSBpMThuT3BzLmdldChvcC5vd25lcik7XG4gICAgICAgIGxldCBpbmRleCA9IGkxOG5CbG9ja1BsYWNlaG9sZGVySW5kaWNlcy5nZXQob3Aub3duZXIpIHx8IDA7XG4gICAgICAgIGlmICghaTE4bk9wKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ0Nhbm5vdCBmaW5kIGNvcnJlc3BvbmRpbmcgaTE4blN0YXJ0IGZvciBpMThuRXhwcicpO1xuICAgICAgICB9XG4gICAgICAgIGFkZFBhcmFtKFxuICAgICAgICAgICAgcGFyYW1zLCBpMThuT3AsIG9wLmkxOG5QbGFjZWhvbGRlciwgaW5kZXgrKywgaTE4bk9wLnN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgICBvcC5yZXNvbHV0aW9uVGltZSk7XG4gICAgICAgIGkxOG5CbG9ja1BsYWNlaG9sZGVySW5kaWNlcy5zZXQob3Aub3duZXIsIGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBZGQgYSBwYXJhbSB0byB0aGUgcGFyYW1zIG1hcCBmb3IgdGhlIGdpdmVuIGkxOG4gb3AuXG4gKi9cbmZ1bmN0aW9uIGFkZFBhcmFtKFxuICAgIHBhcmFtczogTWFwPGlyLlhyZWZJZCwgSTE4blBsYWNlaG9sZGVyUGFyYW1zPiwgaTE4bk9wOiBpci5JMThuU3RhcnRPcCwgcGxhY2Vob2xkZXI6IHN0cmluZyxcbiAgICB2YWx1ZTogc3RyaW5nfG51bWJlciwgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGwsIHJlc29sdXRpb25UaW1lOiBpci5JMThuUGFyYW1SZXNvbHV0aW9uVGltZSxcbiAgICBmbGFnczogSTE4blBhcmFtVmFsdWVGbGFncyA9IEkxOG5QYXJhbVZhbHVlRmxhZ3MuTm9uZSkge1xuICBjb25zdCBpMThuT3BQYXJhbXMgPSBwYXJhbXMuZ2V0KGkxOG5PcC54cmVmKSB8fCBuZXcgSTE4blBsYWNlaG9sZGVyUGFyYW1zKCk7XG4gIGkxOG5PcFBhcmFtcy5hZGRWYWx1ZShwbGFjZWhvbGRlciwgdmFsdWUsIHN1YlRlbXBsYXRlSW5kZXgsIHJlc29sdXRpb25UaW1lLCBmbGFncyk7XG4gIHBhcmFtcy5zZXQoaTE4bk9wLnhyZWYsIGkxOG5PcFBhcmFtcyk7XG59XG5cbi8qKlxuICogR2V0IHRoZSBzdWJUZW1wbGF0ZUluZGV4IGZvciB0aGUgZ2l2ZW4gdGVtcGxhdGUgb3AuIEZvciB0ZW1wbGF0ZSBvcHMsIHVzZSB0aGUgc3ViVGVtcGxhdGVJbmRleCBvZlxuICogdGhlIGNoaWxkIGkxOG4gYmxvY2sgaW5zaWRlIHRoZSB0ZW1wbGF0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0U3ViVGVtcGxhdGVJbmRleEZvclRlbXBsYXRlVGFnKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGkxOG5PcDogaXIuSTE4blN0YXJ0T3AsIG9wOiBpci5UZW1wbGF0ZU9wKTogbnVtYmVyfG51bGwge1xuICBmb3IgKGNvbnN0IGNoaWxkT3Agb2Ygam9iLnZpZXdzLmdldChvcC54cmVmKSEuY3JlYXRlKSB7XG4gICAgaWYgKGNoaWxkT3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCkge1xuICAgICAgcmV0dXJuIGNoaWxkT3Auc3ViVGVtcGxhdGVJbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkxOG5PcC5zdWJUZW1wbGF0ZUluZGV4O1xufVxuXG4vKipcbiAqIFByb3BhZ2F0ZSBwbGFjZWhvbGRlcnMgdXAgdG8gdGhlaXIgcm9vdCBpMThuIG9wLlxuICovXG5mdW5jdGlvbiBwcm9wYWdhdGVQbGFjZWhvbGRlcnMoXG4gICAgcGFyYW1zOiBNYXA8aXIuWHJlZklkLCBJMThuUGxhY2Vob2xkZXJQYXJhbXM+LCBpMThuT3BzOiBNYXA8aXIuWHJlZklkLCBpci5JMThuU3RhcnRPcD4pIHtcbiAgZm9yIChjb25zdCBbeHJlZiwgb3BQYXJhbXNdIG9mIHBhcmFtcykge1xuICAgIGNvbnN0IG9wID0gaTE4bk9wcy5nZXQoeHJlZikhO1xuICAgIGlmIChvcC54cmVmICE9PSBvcC5yb290KSB7XG4gICAgICBjb25zdCByb290UGFyYW1zID0gcGFyYW1zLmdldChvcC5yb290KSB8fCBuZXcgSTE4blBsYWNlaG9sZGVyUGFyYW1zKCk7XG4gICAgICByb290UGFyYW1zLm1lcmdlKG9wUGFyYW1zKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==