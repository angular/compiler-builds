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
     * This value represents the closing of a tag. (Can only be used together with ElementTag or
     * TemplateTag)
     */
    I18nParamValueFlags[I18nParamValueFlags["CloseTag"] = 4] = "CloseTag";
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
    addValue(placeholder, value, subTemplateIndex, flags) {
        const placeholderValues = this.values.get(placeholder) ?? [];
        placeholderValues.push({ value, subTemplateIndex, flags });
        this.values.set(placeholder, placeholderValues);
    }
    /**
     * Saves the params map, in serialized form, into the given i18n op.
     */
    saveToOp(op) {
        for (const [placeholder, placeholderValues] of this.values) {
            op.params.set(placeholder, o.literal(this.serializeValues(placeholderValues)));
        }
    }
    /**
     * Serializes a list of i18n placeholder values.
     */
    serializeValues(values) {
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
        return `${ESCAPE}${closeMarker}${tagMarker}${value.value}${context}${ESCAPE}`;
    }
}
/**
 * Resolve the placeholders in i18n messages.
 */
export function phaseResolveI18nPlaceholders(job) {
    for (const unit of job.units) {
        const i18nOps = new Map();
        const params = new Map();
        let currentI18nOp = null;
        // Record slots for tag name placeholders.
        for (const op of unit.create) {
            switch (op.kind) {
                case ir.OpKind.I18nStart:
                case ir.OpKind.I18n:
                    i18nOps.set(op.xref, op);
                    currentI18nOp = op.kind === ir.OpKind.I18nStart ? op : null;
                    break;
                case ir.OpKind.I18nEnd:
                    currentI18nOp = null;
                    break;
                case ir.OpKind.Element:
                case ir.OpKind.ElementStart:
                case ir.OpKind.Template:
                    // For elements with i18n placeholders, record its slot value in the params map under both
                    // the start and close placeholders.
                    if (op.i18nPlaceholder !== undefined) {
                        if (currentI18nOp === null) {
                            throw Error('i18n tag placeholder should only occur inside an i18n block');
                        }
                        const { startName, closeName } = op.i18nPlaceholder;
                        const subTemplateIndex = getSubTemplateIndexForTag(job, currentI18nOp, op);
                        const flags = op.kind === ir.OpKind.Template ? I18nParamValueFlags.TemplateTag :
                            I18nParamValueFlags.ElementTag;
                        addParam(params, currentI18nOp, startName, op.slot, subTemplateIndex, flags);
                        addParam(params, currentI18nOp, closeName, op.slot, subTemplateIndex, flags | I18nParamValueFlags.CloseTag);
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
                addParam(params, i18nOp, op.i18nPlaceholder.name, index++, i18nOp.subTemplateIndex);
                i18nBlockPlaceholderIndices.set(op.owner, index);
            }
        }
        // After colleccting all params, save them to the i18n ops.
        for (const [xref, i18nOpParams] of params) {
            i18nOpParams.saveToOp(i18nOps.get(xref));
        }
    }
}
/**
 * Add a param to the params map for the given i18n op.
 */
function addParam(params, i18nOp, placeholder, value, subTemplateIndex, flags = I18nParamValueFlags.None) {
    const i18nOpParams = params.get(i18nOp.xref) ?? new I18nPlaceholderParams();
    i18nOpParams.addValue(placeholder, value, subTemplateIndex, flags);
    params.set(i18nOp.xref, i18nOpParams);
}
/**
 * Get the subTemplateIndex for the given op. For template ops, use the subTemplateIndex of the
 * child i18n block inside the template. For all other ops, use the subTemplateIndex of the i18n
 * block the op belongs to.
 */
function getSubTemplateIndexForTag(job, i18nOp, op) {
    if (op.kind === ir.OpKind.Template) {
        for (const childOp of job.views.get(op.xref).create) {
            if (childOp.kind === ir.OpKind.I18nStart) {
                return childOp.subTemplateIndex;
            }
        }
    }
    return i18nOp.subTemplateIndex;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZV9pMThuX3BsYWNlaG9sZGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvcGhhc2VzL3Jlc29sdmVfaTE4bl9wbGFjZWhvbGRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRCxPQUFPLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQjs7R0FFRztBQUNILE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUV4Qjs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztBQUUzQjs7R0FFRztBQUNILE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQztBQUU1Qjs7R0FFRztBQUNILE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0FBRTdCOztHQUVHO0FBQ0gsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0FBRTNCOztHQUVHO0FBQ0gsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUM7QUFFOUI7O0dBRUc7QUFDSCxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUM7QUFFNUI7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFFM0IsSUFBSyxtQkFrQko7QUFsQkQsV0FBSyxtQkFBbUI7SUFDdEIsNkRBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUVBQWtCLENBQUE7SUFFbEI7O09BRUc7SUFDSCwyRUFBbUIsQ0FBQTtJQUVuQjs7O09BR0c7SUFDSCxxRUFBZ0IsQ0FBQTtBQUNsQixDQUFDLEVBbEJJLG1CQUFtQixLQUFuQixtQkFBbUIsUUFrQnZCO0FBdUJEOztHQUVHO0FBQ0gsTUFBTSxxQkFBcUI7SUFBM0I7UUFDRSxXQUFNLEdBQUcsSUFBSSxHQUFHLEVBQWtDLENBQUM7SUFr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OztHQUVHO0FBQ0gsU0FBUyxRQUFRLENBQ2IsTUFBNkMsRUFBRSxNQUFnQyxFQUMvRSxXQUFtQixFQUFFLEtBQW9CLEVBQUUsZ0JBQTZCLEVBQ3hFLFFBQTZCLG1CQUFtQixDQUFDLElBQUk7SUFDdkQsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxxQkFBcUIsRUFBRSxDQUFDO0lBQzVFLFlBQVksQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNuRSxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDeEMsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFTLHlCQUF5QixDQUM5QixHQUE0QixFQUFFLE1BQXNCLEVBQUUsRUFBZTtJQUN2RSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7UUFDbEMsS0FBSyxNQUFNLE9BQU8sSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFFLENBQUMsTUFBTSxFQUFFO1lBQ3BELElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRTtnQkFDeEMsT0FBTyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7YUFDakM7U0FDRjtLQUNGO0lBQ0QsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7QUFDakMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCAqIGFzIGlyIGZyb20gJy4uLy4uL2lyJztcbmltcG9ydCB7Q29tcG9uZW50Q29tcGlsYXRpb25Kb2J9IGZyb20gJy4uL2NvbXBpbGF0aW9uJztcblxuLyoqXG4gKiBUaGUgZXNjYXBlIHNlcXVlbmNlIHVzZWQgaW5kaWNhdGUgbWVzc2FnZSBwYXJhbSB2YWx1ZXMuXG4gKi9cbmNvbnN0IEVTQ0FQRSA9ICdcXHVGRkZEJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBhbiBlbGVtZW50IHRhZy5cbiAqL1xuY29uc3QgRUxFTUVOVF9NQVJLRVIgPSAnIyc7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgYSB0ZW1wbGF0ZSB0YWcuXG4gKi9cbmNvbnN0IFRFTVBMQVRFX01BUktFUiA9ICcqJztcblxuLyoqXG4gKiBNYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBjbG9zaW5nIG9mIGFuIGVsZW1lbnQgb3IgdGVtcGxhdGUgdGFnLlxuICovXG5jb25zdCBUQUdfQ0xPU0VfTUFSS0VSID0gJy8nO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIHRoZSBzdWItdGVtcGxhdGUgY29udGV4dC5cbiAqL1xuY29uc3QgQ09OVEVYVF9NQVJLRVIgPSAnOic7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgdGhlIHN0YXJ0IG9mIGEgbGlzdCBvZiB2YWx1ZXMuXG4gKi9cbmNvbnN0IExJU1RfU1RBUlRfTUFSS0VSID0gJ1snO1xuXG4vKipcbiAqIE1hcmtlciB1c2VkIHRvIGluZGljYXRlIHRoZSBlbmQgb2YgYSBsaXN0IG9mIHZhbHVlcy5cbiAqL1xuY29uc3QgTElTVF9FTkRfTUFSS0VSID0gJ10nO1xuXG4vKipcbiAqIERlbGltaXRlciB1c2VkIHRvIHNlcGFyYXRlIG11bHRpcGxlIHZhbHVlcyBpbiBhIGxpc3QuXG4gKi9cbmNvbnN0IExJU1RfREVMSU1JVEVSID0gJ3wnO1xuXG5lbnVtIEkxOG5QYXJhbVZhbHVlRmxhZ3Mge1xuICBOb25lID0gMGIwMDAsXG5cbiAgLyoqXG4gICAqICBUaGlzIHZhbHVlIHJlcHJlc3RlbnRzIGFuIGVsZW1lbnQgdGFnLlxuICAgKi9cbiAgRWxlbWVudFRhZyA9IDBiMDAxLFxuXG4gIC8qKlxuICAgKiBUaGlzIHZhbHVlIHJlcHJlc2VudHMgYSB0ZW1wbGF0ZSB0YWcuXG4gICAqL1xuICBUZW1wbGF0ZVRhZyA9IDBiMDEwLFxuXG4gIC8qKlxuICAgKiBUaGlzIHZhbHVlIHJlcHJlc2VudHMgdGhlIGNsb3Npbmcgb2YgYSB0YWcuIChDYW4gb25seSBiZSB1c2VkIHRvZ2V0aGVyIHdpdGggRWxlbWVudFRhZyBvclxuICAgKiBUZW1wbGF0ZVRhZylcbiAgICovXG4gIENsb3NlVGFnID0gMGIxMDAsXG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHNpbmdsZSBwbGFjZWhvbGRlciB2YWx1ZSBpbiB0aGUgaTE4biBwYXJhbXMgbWFwLiBUaGUgbWFwIG1heSBjb250YWluIG11bHRpcGxlXG4gKiBJMThuUGxhY2Vob2xkZXJWYWx1ZSBwZXIgcGxhY2Vob2xkZXIuXG4gKi9cbmludGVyZmFjZSBJMThuUGxhY2Vob2xkZXJWYWx1ZSB7XG4gIC8qKlxuICAgKiBUaGUgdmFsdWUuXG4gICAqL1xuICB2YWx1ZTogc3RyaW5nfG51bWJlcjtcblxuICAvKipcbiAgICogVGhlIHN1Yi10ZW1wbGF0ZSBpbmRleCBhc3NvY2lhdGVkIHdpdGggdGhlIHZhbHVlLlxuICAgKi9cbiAgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGw7XG5cbiAgLyoqXG4gICAqIEZsYWdzIGFzc29jaWF0ZWQgd2l0aCB0aGUgdmFsdWUuXG4gICAqL1xuICBmbGFnczogSTE4blBhcmFtVmFsdWVGbGFncztcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSBjb21wbGV0ZSBpMThuIHBhcmFtcyBtYXAgZm9yIGFuIGkxOG4gb3AuXG4gKi9cbmNsYXNzIEkxOG5QbGFjZWhvbGRlclBhcmFtcyB7XG4gIHZhbHVlcyA9IG5ldyBNYXA8c3RyaW5nLCBJMThuUGxhY2Vob2xkZXJWYWx1ZVtdPigpO1xuXG4gIC8qKlxuICAgKiBBZGRzIGEgbmV3IHZhbHVlIHRvIHRoZSBwYXJhbXMgbWFwLlxuICAgKi9cbiAgYWRkVmFsdWUoXG4gICAgICBwbGFjZWhvbGRlcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nfG51bWJlciwgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGwsXG4gICAgICBmbGFnczogSTE4blBhcmFtVmFsdWVGbGFncykge1xuICAgIGNvbnN0IHBsYWNlaG9sZGVyVmFsdWVzID0gdGhpcy52YWx1ZXMuZ2V0KHBsYWNlaG9sZGVyKSA/PyBbXTtcbiAgICBwbGFjZWhvbGRlclZhbHVlcy5wdXNoKHt2YWx1ZSwgc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3N9KTtcbiAgICB0aGlzLnZhbHVlcy5zZXQocGxhY2Vob2xkZXIsIHBsYWNlaG9sZGVyVmFsdWVzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTYXZlcyB0aGUgcGFyYW1zIG1hcCwgaW4gc2VyaWFsaXplZCBmb3JtLCBpbnRvIHRoZSBnaXZlbiBpMThuIG9wLlxuICAgKi9cbiAgc2F2ZVRvT3Aob3A6IGlyLkkxOG5PcHxpci5JMThuU3RhcnRPcCkge1xuICAgIGZvciAoY29uc3QgW3BsYWNlaG9sZGVyLCBwbGFjZWhvbGRlclZhbHVlc10gb2YgdGhpcy52YWx1ZXMpIHtcbiAgICAgIG9wLnBhcmFtcy5zZXQocGxhY2Vob2xkZXIsIG8ubGl0ZXJhbCh0aGlzLnNlcmlhbGl6ZVZhbHVlcyhwbGFjZWhvbGRlclZhbHVlcykpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2VyaWFsaXplcyBhIGxpc3Qgb2YgaTE4biBwbGFjZWhvbGRlciB2YWx1ZXMuXG4gICAqL1xuICBwcml2YXRlIHNlcmlhbGl6ZVZhbHVlcyh2YWx1ZXM6IEkxOG5QbGFjZWhvbGRlclZhbHVlW10pIHtcbiAgICBjb25zdCBzZXJpYWxpemVkVmFsdWVzID0gdmFsdWVzLm1hcCh2YWx1ZSA9PiB0aGlzLnNlcmlhbGl6ZVZhbHVlKHZhbHVlKSk7XG4gICAgcmV0dXJuIHNlcmlhbGl6ZWRWYWx1ZXMubGVuZ3RoID09PSAxID9cbiAgICAgICAgc2VyaWFsaXplZFZhbHVlc1swXSA6XG4gICAgICAgIGAke0xJU1RfU1RBUlRfTUFSS0VSfSR7c2VyaWFsaXplZFZhbHVlcy5qb2luKExJU1RfREVMSU1JVEVSKX0ke0xJU1RfRU5EX01BUktFUn1gO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZXMgYSBzaW5nbGUgaTE4biBwbGFjZWhvbGRlciB2YWx1ZS5cbiAgICovXG4gIHByaXZhdGUgc2VyaWFsaXplVmFsdWUodmFsdWU6IEkxOG5QbGFjZWhvbGRlclZhbHVlKSB7XG4gICAgbGV0IHRhZ01hcmtlciA9ICcnO1xuICAgIGxldCBjbG9zZU1hcmtlciA9ICcnO1xuICAgIGlmICh2YWx1ZS5mbGFncyAmIEkxOG5QYXJhbVZhbHVlRmxhZ3MuRWxlbWVudFRhZykge1xuICAgICAgdGFnTWFya2VyID0gRUxFTUVOVF9NQVJLRVI7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS5mbGFncyAmIEkxOG5QYXJhbVZhbHVlRmxhZ3MuVGVtcGxhdGVUYWcpIHtcbiAgICAgIHRhZ01hcmtlciA9IFRFTVBMQVRFX01BUktFUjtcbiAgICB9XG4gICAgaWYgKHRhZ01hcmtlciAhPT0gJycpIHtcbiAgICAgIGNsb3NlTWFya2VyID0gdmFsdWUuZmxhZ3MgJiBJMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnID8gVEFHX0NMT1NFX01BUktFUiA6ICcnO1xuICAgIH1cbiAgICBjb25zdCBjb250ZXh0ID1cbiAgICAgICAgdmFsdWUuc3ViVGVtcGxhdGVJbmRleCA9PT0gbnVsbCA/ICcnIDogYCR7Q09OVEVYVF9NQVJLRVJ9JHt2YWx1ZS5zdWJUZW1wbGF0ZUluZGV4fWA7XG4gICAgcmV0dXJuIGAke0VTQ0FQRX0ke2Nsb3NlTWFya2VyfSR7dGFnTWFya2VyfSR7dmFsdWUudmFsdWV9JHtjb250ZXh0fSR7RVNDQVBFfWA7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBwbGFjZWhvbGRlcnMgaW4gaTE4biBtZXNzYWdlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBoYXNlUmVzb2x2ZUkxOG5QbGFjZWhvbGRlcnMoam9iOiBDb21wb25lbnRDb21waWxhdGlvbkpvYikge1xuICBmb3IgKGNvbnN0IHVuaXQgb2Ygam9iLnVuaXRzKSB7XG4gICAgY29uc3QgaTE4bk9wcyA9IG5ldyBNYXA8aXIuWHJlZklkLCBpci5JMThuT3B8aXIuSTE4blN0YXJ0T3A+KCk7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IE1hcDxpci5YcmVmSWQsIEkxOG5QbGFjZWhvbGRlclBhcmFtcz4oKTtcbiAgICBsZXQgY3VycmVudEkxOG5PcDogaXIuSTE4blN0YXJ0T3B8bnVsbCA9IG51bGw7XG5cbiAgICAvLyBSZWNvcmQgc2xvdHMgZm9yIHRhZyBuYW1lIHBsYWNlaG9sZGVycy5cbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQuY3JlYXRlKSB7XG4gICAgICBzd2l0Y2ggKG9wLmtpbmQpIHtcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4blN0YXJ0OlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5JMThuOlxuICAgICAgICAgIGkxOG5PcHMuc2V0KG9wLnhyZWYsIG9wKTtcbiAgICAgICAgICBjdXJyZW50STE4bk9wID0gb3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5TdGFydCA/IG9wIDogbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuSTE4bkVuZDpcbiAgICAgICAgICBjdXJyZW50STE4bk9wID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudDpcbiAgICAgICAgY2FzZSBpci5PcEtpbmQuRWxlbWVudFN0YXJ0OlxuICAgICAgICBjYXNlIGlyLk9wS2luZC5UZW1wbGF0ZTpcbiAgICAgICAgICAvLyBGb3IgZWxlbWVudHMgd2l0aCBpMThuIHBsYWNlaG9sZGVycywgcmVjb3JkIGl0cyBzbG90IHZhbHVlIGluIHRoZSBwYXJhbXMgbWFwIHVuZGVyIGJvdGhcbiAgICAgICAgICAvLyB0aGUgc3RhcnQgYW5kIGNsb3NlIHBsYWNlaG9sZGVycy5cbiAgICAgICAgICBpZiAob3AuaTE4blBsYWNlaG9sZGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50STE4bk9wID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRocm93IEVycm9yKCdpMThuIHRhZyBwbGFjZWhvbGRlciBzaG91bGQgb25seSBvY2N1ciBpbnNpZGUgYW4gaTE4biBibG9jaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qge3N0YXJ0TmFtZSwgY2xvc2VOYW1lfSA9IG9wLmkxOG5QbGFjZWhvbGRlcjtcbiAgICAgICAgICAgIGNvbnN0IHN1YlRlbXBsYXRlSW5kZXggPSBnZXRTdWJUZW1wbGF0ZUluZGV4Rm9yVGFnKGpvYiwgY3VycmVudEkxOG5PcCwgb3ApO1xuICAgICAgICAgICAgY29uc3QgZmxhZ3MgPSBvcC5raW5kID09PSBpci5PcEtpbmQuVGVtcGxhdGUgPyBJMThuUGFyYW1WYWx1ZUZsYWdzLlRlbXBsYXRlVGFnIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSTE4blBhcmFtVmFsdWVGbGFncy5FbGVtZW50VGFnO1xuICAgICAgICAgICAgYWRkUGFyYW0ocGFyYW1zLCBjdXJyZW50STE4bk9wLCBzdGFydE5hbWUsIG9wLnNsb3QhLCBzdWJUZW1wbGF0ZUluZGV4LCBmbGFncyk7XG4gICAgICAgICAgICBhZGRQYXJhbShcbiAgICAgICAgICAgICAgICBwYXJhbXMsIGN1cnJlbnRJMThuT3AsIGNsb3NlTmFtZSwgb3Auc2xvdCEsIHN1YlRlbXBsYXRlSW5kZXgsXG4gICAgICAgICAgICAgICAgZmxhZ3MgfCBJMThuUGFyYW1WYWx1ZUZsYWdzLkNsb3NlVGFnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmlsbCBpbiB2YWx1ZXMgZm9yIGVhY2ggb2YgdGhlIGkxOG4gZXhwcmVzc2lvbiBwbGFjZWhvbGRlcnMuXG4gICAgY29uc3QgaTE4bkJsb2NrUGxhY2Vob2xkZXJJbmRpY2VzID0gbmV3IE1hcDxpci5YcmVmSWQsIG51bWJlcj4oKTtcbiAgICBmb3IgKGNvbnN0IG9wIG9mIHVuaXQudXBkYXRlKSB7XG4gICAgICBpZiAob3Aua2luZCA9PT0gaXIuT3BLaW5kLkkxOG5FeHByZXNzaW9uKSB7XG4gICAgICAgIGNvbnN0IGkxOG5PcCA9IGkxOG5PcHMuZ2V0KG9wLm93bmVyKTtcbiAgICAgICAgbGV0IGluZGV4ID0gaTE4bkJsb2NrUGxhY2Vob2xkZXJJbmRpY2VzLmdldChvcC5vd25lcikgfHwgMDtcbiAgICAgICAgaWYgKCFpMThuT3ApIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignQ2Fubm90IGZpbmQgY29ycmVzcG9uZGluZyBpMThuU3RhcnQgZm9yIGkxOG5FeHByJyk7XG4gICAgICAgIH1cbiAgICAgICAgYWRkUGFyYW0ocGFyYW1zLCBpMThuT3AsIG9wLmkxOG5QbGFjZWhvbGRlci5uYW1lLCBpbmRleCsrLCBpMThuT3Auc3ViVGVtcGxhdGVJbmRleCk7XG4gICAgICAgIGkxOG5CbG9ja1BsYWNlaG9sZGVySW5kaWNlcy5zZXQob3Aub3duZXIsIGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZnRlciBjb2xsZWNjdGluZyBhbGwgcGFyYW1zLCBzYXZlIHRoZW0gdG8gdGhlIGkxOG4gb3BzLlxuICAgIGZvciAoY29uc3QgW3hyZWYsIGkxOG5PcFBhcmFtc10gb2YgcGFyYW1zKSB7XG4gICAgICBpMThuT3BQYXJhbXMuc2F2ZVRvT3AoaTE4bk9wcy5nZXQoeHJlZikhKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBZGQgYSBwYXJhbSB0byB0aGUgcGFyYW1zIG1hcCBmb3IgdGhlIGdpdmVuIGkxOG4gb3AuXG4gKi9cbmZ1bmN0aW9uIGFkZFBhcmFtKFxuICAgIHBhcmFtczogTWFwPGlyLlhyZWZJZCwgSTE4blBsYWNlaG9sZGVyUGFyYW1zPiwgaTE4bk9wOiBpci5JMThuT3B8aXIuSTE4blN0YXJ0T3AsXG4gICAgcGxhY2Vob2xkZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZ3xudW1iZXIsIHN1YlRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLFxuICAgIGZsYWdzOiBJMThuUGFyYW1WYWx1ZUZsYWdzID0gSTE4blBhcmFtVmFsdWVGbGFncy5Ob25lKSB7XG4gIGNvbnN0IGkxOG5PcFBhcmFtcyA9IHBhcmFtcy5nZXQoaTE4bk9wLnhyZWYpID8/IG5ldyBJMThuUGxhY2Vob2xkZXJQYXJhbXMoKTtcbiAgaTE4bk9wUGFyYW1zLmFkZFZhbHVlKHBsYWNlaG9sZGVyLCB2YWx1ZSwgc3ViVGVtcGxhdGVJbmRleCwgZmxhZ3MpO1xuICBwYXJhbXMuc2V0KGkxOG5PcC54cmVmLCBpMThuT3BQYXJhbXMpO1xufVxuXG4vKipcbiAqIEdldCB0aGUgc3ViVGVtcGxhdGVJbmRleCBmb3IgdGhlIGdpdmVuIG9wLiBGb3IgdGVtcGxhdGUgb3BzLCB1c2UgdGhlIHN1YlRlbXBsYXRlSW5kZXggb2YgdGhlXG4gKiBjaGlsZCBpMThuIGJsb2NrIGluc2lkZSB0aGUgdGVtcGxhdGUuIEZvciBhbGwgb3RoZXIgb3BzLCB1c2UgdGhlIHN1YlRlbXBsYXRlSW5kZXggb2YgdGhlIGkxOG5cbiAqIGJsb2NrIHRoZSBvcCBiZWxvbmdzIHRvLlxuICovXG5mdW5jdGlvbiBnZXRTdWJUZW1wbGF0ZUluZGV4Rm9yVGFnKFxuICAgIGpvYjogQ29tcG9uZW50Q29tcGlsYXRpb25Kb2IsIGkxOG5PcDogaXIuSTE4blN0YXJ0T3AsIG9wOiBpci5DcmVhdGVPcCk6IG51bWJlcnxudWxsIHtcbiAgaWYgKG9wLmtpbmQgPT09IGlyLk9wS2luZC5UZW1wbGF0ZSkge1xuICAgIGZvciAoY29uc3QgY2hpbGRPcCBvZiBqb2Iudmlld3MuZ2V0KG9wLnhyZWYpIS5jcmVhdGUpIHtcbiAgICAgIGlmIChjaGlsZE9wLmtpbmQgPT09IGlyLk9wS2luZC5JMThuU3RhcnQpIHtcbiAgICAgICAgcmV0dXJuIGNoaWxkT3Auc3ViVGVtcGxhdGVJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkxOG5PcC5zdWJUZW1wbGF0ZUluZGV4O1xufVxuIl19