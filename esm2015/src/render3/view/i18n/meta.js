/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { computeDecimalDigest, computeDigest, decimalDigest } from '../../../i18n/digest';
import * as i18n from '../../../i18n/i18n_ast';
import { createI18nMessageFactory } from '../../../i18n/i18n_parser';
import * as html from '../../../ml_parser/ast';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../../ml_parser/interpolation_config';
import * as o from '../../../output/output_ast';
import { I18N_ATTR, I18N_ATTR_PREFIX, hasI18nAttrs, icuFromI18nMessage } from './util';
function setI18nRefs(html, i18n) {
    html.i18n = i18n;
}
/**
 * This visitor walks over HTML parse tree and converts information stored in
 * i18n-related attributes ("i18n" and "i18n-*") into i18n meta object that is
 * stored with other element's and attribute's information.
 */
export class I18nMetaVisitor {
    constructor(interpolationConfig = DEFAULT_INTERPOLATION_CONFIG, keepI18nAttrs = false, i18nLegacyMessageIdFormat = '') {
        this.interpolationConfig = interpolationConfig;
        this.keepI18nAttrs = keepI18nAttrs;
        this.i18nLegacyMessageIdFormat = i18nLegacyMessageIdFormat;
        // i18n message generation factory
        this._createI18nMessage = createI18nMessageFactory(this.interpolationConfig);
    }
    _generateI18nMessage(nodes, meta = '', visitNodeFn) {
        const parsed = typeof meta === 'string' ? parseI18nMeta(meta) : metaFromI18nMessage(meta);
        const message = this._createI18nMessage(nodes, parsed.meaning || '', parsed.description || '', parsed.customId || '', visitNodeFn);
        if (!message.id) {
            // generate (or restore) message id if not specified in template
            message.id = typeof meta !== 'string' && meta.id || decimalDigest(message);
        }
        if (this.i18nLegacyMessageIdFormat === 'xlf' || this.i18nLegacyMessageIdFormat === 'xliff') {
            message.legacyId = computeDigest(message);
        }
        else if (this.i18nLegacyMessageIdFormat === 'xlf2' || this.i18nLegacyMessageIdFormat === 'xliff2' ||
            this.i18nLegacyMessageIdFormat === 'xmb') {
            message.legacyId = computeDecimalDigest(message);
        }
        else if (typeof meta !== 'string') {
            // This occurs if we are doing the 2nd pass after whitespace removal
            // In that case we want to reuse the legacy message generated in the 1st pass
            // See `parseTemplate()` in `packages/compiler/src/render3/view/template.ts`
            message.legacyId = meta.legacyId;
        }
        return message;
    }
    visitElement(element, context) {
        if (hasI18nAttrs(element)) {
            const attrs = [];
            const attrsMeta = {};
            for (const attr of element.attrs) {
                if (attr.name === I18N_ATTR) {
                    // root 'i18n' node attribute
                    const i18n = element.i18n || attr.value;
                    const message = this._generateI18nMessage(element.children, i18n, setI18nRefs);
                    // do not assign empty i18n meta
                    if (message.nodes.length) {
                        element.i18n = message;
                    }
                }
                else if (attr.name.startsWith(I18N_ATTR_PREFIX)) {
                    // 'i18n-*' attributes
                    const key = attr.name.slice(I18N_ATTR_PREFIX.length);
                    attrsMeta[key] = attr.value;
                }
                else {
                    // non-i18n attributes
                    attrs.push(attr);
                }
            }
            // set i18n meta for attributes
            if (Object.keys(attrsMeta).length) {
                for (const attr of attrs) {
                    const meta = attrsMeta[attr.name];
                    // do not create translation for empty attributes
                    if (meta !== undefined && attr.value) {
                        attr.i18n = this._generateI18nMessage([attr], attr.i18n || meta);
                    }
                }
            }
            if (!this.keepI18nAttrs) {
                // update element's attributes,
                // keeping only non-i18n related ones
                element.attrs = attrs;
            }
        }
        html.visitAll(this, element.children);
        return element;
    }
    visitExpansion(expansion, context) {
        let message;
        const meta = expansion.i18n;
        if (meta instanceof i18n.IcuPlaceholder) {
            // set ICU placeholder name (e.g. "ICU_1"),
            // generated while processing root element contents,
            // so we can reference it when we output translation
            const name = meta.name;
            message = this._generateI18nMessage([expansion], meta);
            const icu = icuFromI18nMessage(message);
            icu.name = name;
        }
        else {
            // when ICU is a root level translation
            message = this._generateI18nMessage([expansion], meta);
        }
        expansion.i18n = message;
        return expansion;
    }
    visitText(text, context) { return text; }
    visitAttribute(attribute, context) { return attribute; }
    visitComment(comment, context) { return comment; }
    visitExpansionCase(expansionCase, context) { return expansionCase; }
}
export function metaFromI18nMessage(message, id = null) {
    return {
        id: typeof id === 'string' ? id : message.id || '',
        customId: message.customId,
        legacyId: message.legacyId,
        meaning: message.meaning || '',
        description: message.description || ''
    };
}
/** I18n separators for metadata **/
const I18N_MEANING_SEPARATOR = '|';
const I18N_ID_SEPARATOR = '@@';
/**
 * Parses i18n metas like:
 *  - "@@id",
 *  - "description[@@id]",
 *  - "meaning|description[@@id]"
 * and returns an object with parsed output.
 *
 * @param meta String that represents i18n meta
 * @returns Object with id, meaning and description fields
 */
export function parseI18nMeta(meta) {
    let customId;
    let meaning;
    let description;
    if (meta) {
        const idIndex = meta.indexOf(I18N_ID_SEPARATOR);
        const descIndex = meta.indexOf(I18N_MEANING_SEPARATOR);
        let meaningAndDesc;
        [meaningAndDesc, customId] =
            (idIndex > -1) ? [meta.slice(0, idIndex), meta.slice(idIndex + 2)] : [meta, ''];
        [meaning, description] = (descIndex > -1) ?
            [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
            ['', meaningAndDesc];
    }
    return { customId, meaning, description };
}
/**
 * Serialize the given `meta` and `messagePart` a string that can be used in a `$localize`
 * tagged string. The format of the metadata is the same as that parsed by `parseI18nMeta()`.
 *
 * @param meta The metadata to serialize
 * @param messagePart The first part of the tagged string
 */
export function serializeI18nHead(meta, messagePart) {
    let metaBlock = meta.description || '';
    if (meta.meaning) {
        metaBlock = `${meta.meaning}|${metaBlock}`;
    }
    if (meta.customId || meta.legacyId) {
        metaBlock = `${metaBlock}@@${meta.customId || meta.legacyId}`;
    }
    if (metaBlock === '') {
        // There is no metaBlock, so we must ensure that any starting colon is escaped.
        return escapeStartingColon(messagePart);
    }
    else {
        return `:${escapeColons(metaBlock)}:${messagePart}`;
    }
}
/**
 * Serialize the given `placeholderName` and `messagePart` into strings that can be used in a
 * `$localize` tagged string.
 *
 * @param placeholderName The placeholder name to serialize
 * @param messagePart The following message string after this placeholder
 */
export function serializeI18nTemplatePart(placeholderName, messagePart) {
    if (placeholderName === '') {
        // There is no placeholder name block, so we must ensure that any starting colon is escaped.
        return escapeStartingColon(messagePart);
    }
    else {
        return `:${placeholderName}:${messagePart}`;
    }
}
// Converts i18n meta information for a message (id, description, meaning)
// to a JsDoc statement formatted as expected by the Closure compiler.
export function i18nMetaToDocStmt(meta) {
    const tags = [];
    if (meta.description) {
        tags.push({ tagName: "desc" /* Desc */, text: meta.description });
    }
    if (meta.meaning) {
        tags.push({ tagName: "meaning" /* Meaning */, text: meta.meaning });
    }
    return tags.length == 0 ? null : new o.JSDocCommentStmt(tags);
}
export function escapeStartingColon(str) {
    return str.replace(/^:/, '\\:');
}
export function escapeColons(str) {
    return str.replace(/:/g, '\\:');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDeEYsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNuRSxPQUFPLEtBQUssSUFBSSxNQUFNLHdCQUF3QixDQUFDO0FBQy9DLE9BQU8sRUFBQyw0QkFBNEIsRUFBc0IsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRyxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBRWhELE9BQU8sRUFBQyxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBVXJGLFNBQVMsV0FBVyxDQUFDLElBQW1DLEVBQUUsSUFBZTtJQUN2RSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUNuQixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxlQUFlO0lBSTFCLFlBQ1ksc0JBQTJDLDRCQUE0QixFQUN2RSxnQkFBeUIsS0FBSyxFQUFVLDRCQUFvQyxFQUFFO1FBRDlFLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0Q7UUFDdkUsa0JBQWEsR0FBYixhQUFhLENBQWlCO1FBQVUsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFhO1FBTDFGLGtDQUFrQztRQUMxQix1QkFBa0IsR0FBRyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUlhLENBQUM7SUFFdEYsb0JBQW9CLENBQ3hCLEtBQWtCLEVBQUUsT0FBd0Is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VztJQUM3QyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFFRCxNQUFNLFVBQVUsWUFBWSxDQUFDLEdBQVc7SUFDdEMsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNsQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NvbXB1dGVEZWNpbWFsRGlnZXN0LCBjb21wdXRlRGlnZXN0LCBkZWNpbWFsRGlnZXN0fSBmcm9tICcuLi8uLi8uLi9pMThuL2RpZ2VzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtjcmVhdGVJMThuTWVzc2FnZUZhY3Rvcnl9IGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge0kxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgaGFzSTE4bkF0dHJzLCBpY3VGcm9tSTE4bk1lc3NhZ2V9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCB0eXBlIEkxOG5NZXRhID0ge1xuICBpZD86IHN0cmluZyxcbiAgY3VzdG9tSWQ/OiBzdHJpbmcsXG4gIGxlZ2FjeUlkPzogc3RyaW5nLFxuICBkZXNjcmlwdGlvbj86IHN0cmluZyxcbiAgbWVhbmluZz86IHN0cmluZ1xufTtcblxuZnVuY3Rpb24gc2V0STE4blJlZnMoaHRtbDogaHRtbC5Ob2RlICYge2kxOG4/OiBpMThuLkFTVH0sIGkxOG46IGkxOG4uTm9kZSkge1xuICBodG1sLmkxOG4gPSBpMThuO1xufVxuXG4vKipcbiAqIFRoaXMgdmlzaXRvciB3YWxrcyBvdmVyIEhUTUwgcGFyc2UgdHJlZSBhbmQgY29udmVydHMgaW5mb3JtYXRpb24gc3RvcmVkIGluXG4gKiBpMThuLXJlbGF0ZWQgYXR0cmlidXRlcyAoXCJpMThuXCIgYW5kIFwiaTE4bi0qXCIpIGludG8gaTE4biBtZXRhIG9iamVjdCB0aGF0IGlzXG4gKiBzdG9yZWQgd2l0aCBvdGhlciBlbGVtZW50J3MgYW5kIGF0dHJpYnV0ZSdzIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgSTE4bk1ldGFWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgLy8gaTE4biBtZXNzYWdlIGdlbmVyYXRpb24gZmFjdG9yeVxuICBwcml2YXRlIF9jcmVhdGVJMThuTWVzc2FnZSA9IGNyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeSh0aGlzLmludGVycG9sYXRpb25Db25maWcpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyxcbiAgICAgIHByaXZhdGUga2VlcEkxOG5BdHRyczogYm9vbGVhbiA9IGZhbHNlLCBwcml2YXRlIGkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQ6IHN0cmluZyA9ICcnKSB7fVxuXG4gIHByaXZhdGUgX2dlbmVyYXRlSTE4bk1lc3NhZ2UoXG4gICAgICBub2RlczogaHRtbC5Ob2RlW10sIG1ldGE6IHN0cmluZ3xpMThuLkFTVCA9ICcnLFxuICAgICAgdmlzaXROb2RlRm4/OiAoaHRtbDogaHRtbC5Ob2RlLCBpMThuOiBpMThuLk5vZGUpID0+IHZvaWQpOiBpMThuLk1lc3NhZ2Uge1xuICAgIGNvbnN0IHBhcnNlZDogSTE4bk1ldGEgPVxuICAgICAgICB0eXBlb2YgbWV0YSA9PT0gJ3N0cmluZycgPyBwYXJzZUkxOG5NZXRhKG1ldGEpIDogbWV0YUZyb21JMThuTWVzc2FnZShtZXRhIGFzIGkxOG4uTWVzc2FnZSk7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2NyZWF0ZUkxOG5NZXNzYWdlKFxuICAgICAgICBub2RlcywgcGFyc2VkLm1lYW5pbmcgfHwgJycsIHBhcnNlZC5kZXNjcmlwdGlvbiB8fCAnJywgcGFyc2VkLmN1c3RvbUlkIHx8ICcnLCB2aXNpdE5vZGVGbik7XG4gICAgaWYgKCFtZXNzYWdlLmlkKSB7XG4gICAgICAvLyBnZW5lcmF0ZSAob3IgcmVzdG9yZSkgbWVzc2FnZSBpZCBpZiBub3Qgc3BlY2lmaWVkIGluIHRlbXBsYXRlXG4gICAgICBtZXNzYWdlLmlkID0gdHlwZW9mIG1ldGEgIT09ICdzdHJpbmcnICYmIChtZXRhIGFzIGkxOG4uTWVzc2FnZSkuaWQgfHwgZGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneGxmJyB8fCB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGlmZicpIHtcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWQgPSBjb21wdXRlRGlnZXN0KG1lc3NhZ2UpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsZjInIHx8IHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsaWZmMicgfHxcbiAgICAgICAgdGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneG1iJykge1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZCA9IGNvbXB1dGVEZWNpbWFsRGlnZXN0KG1lc3NhZ2UpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1ldGEgIT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBUaGlzIG9jY3VycyBpZiB3ZSBhcmUgZG9pbmcgdGhlIDJuZCBwYXNzIGFmdGVyIHdoaXRlc3BhY2UgcmVtb3ZhbFxuICAgICAgLy8gSW4gdGhhdCBjYXNlIHdlIHdhbnQgdG8gcmV1c2UgdGhlIGxlZ2FjeSBtZXNzYWdlIGdlbmVyYXRlZCBpbiB0aGUgMXN0IHBhc3NcbiAgICAgIC8vIFNlZSBgcGFyc2VUZW1wbGF0ZSgpYCBpbiBgcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90ZW1wbGF0ZS50c2BcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWQgPSAobWV0YSBhcyBpMThuLk1lc3NhZ2UpLmxlZ2FjeUlkO1xuICAgIH1cblxuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoaGFzSTE4bkF0dHJzKGVsZW1lbnQpKSB7XG4gICAgICBjb25zdCBhdHRyczogaHRtbC5BdHRyaWJ1dGVbXSA9IFtdO1xuICAgICAgY29uc3QgYXR0cnNNZXRhOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRycykge1xuICAgICAgICBpZiAoYXR0ci5uYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgICAvLyByb290ICdpMThuJyBub2RlIGF0dHJpYnV0ZVxuICAgICAgICAgIGNvbnN0IGkxOG4gPSBlbGVtZW50LmkxOG4gfHwgYXR0ci52YWx1ZTtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShlbGVtZW50LmNoaWxkcmVuLCBpMThuLCBzZXRJMThuUmVmcyk7XG4gICAgICAgICAgLy8gZG8gbm90IGFzc2lnbiBlbXB0eSBpMThuIG1ldGFcbiAgICAgICAgICBpZiAobWVzc2FnZS5ub2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuaTE4biA9IG1lc3NhZ2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgICAvLyAnaTE4bi0qJyBhdHRyaWJ1dGVzXG4gICAgICAgICAgY29uc3Qga2V5ID0gYXR0ci5uYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKTtcbiAgICAgICAgICBhdHRyc01ldGFba2V5XSA9IGF0dHIudmFsdWU7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBub24taTE4biBhdHRyaWJ1dGVzXG4gICAgICAgICAgYXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBzZXQgaTE4biBtZXRhIGZvciBhdHRyaWJ1dGVzXG4gICAgICBpZiAoT2JqZWN0LmtleXMoYXR0cnNNZXRhKS5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJzKSB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IGF0dHJzTWV0YVthdHRyLm5hbWVdO1xuICAgICAgICAgIC8vIGRvIG5vdCBjcmVhdGUgdHJhbnNsYXRpb24gZm9yIGVtcHR5IGF0dHJpYnV0ZXNcbiAgICAgICAgICBpZiAobWV0YSAhPT0gdW5kZWZpbmVkICYmIGF0dHIudmFsdWUpIHtcbiAgICAgICAgICAgIGF0dHIuaTE4biA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2F0dHJdLCBhdHRyLmkxOG4gfHwgbWV0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5rZWVwSTE4bkF0dHJzKSB7XG4gICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50J3MgYXR0cmlidXRlcyxcbiAgICAgICAgLy8ga2VlcGluZyBvbmx5IG5vbi1pMThuIHJlbGF0ZWQgb25lc1xuICAgICAgICBlbGVtZW50LmF0dHJzID0gYXR0cnM7XG4gICAgICB9XG4gICAgfVxuICAgIGh0bWwudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGxldCBtZXNzYWdlO1xuICAgIGNvbnN0IG1ldGEgPSBleHBhbnNpb24uaTE4bjtcbiAgICBpZiAobWV0YSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXIpIHtcbiAgICAgIC8vIHNldCBJQ1UgcGxhY2Vob2xkZXIgbmFtZSAoZS5nLiBcIklDVV8xXCIpLFxuICAgICAgLy8gZ2VuZXJhdGVkIHdoaWxlIHByb2Nlc3Npbmcgcm9vdCBlbGVtZW50IGNvbnRlbnRzLFxuICAgICAgLy8gc28gd2UgY2FuIHJlZmVyZW5jZSBpdCB3aGVuIHdlIG91dHB1dCB0cmFuc2xhdGlvblxuICAgICAgY29uc3QgbmFtZSA9IG1ldGEubmFtZTtcbiAgICAgIG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFtleHBhbnNpb25dLCBtZXRhKTtcbiAgICAgIGNvbnN0IGljdSA9IGljdUZyb21JMThuTWVzc2FnZShtZXNzYWdlKTtcbiAgICAgIGljdS5uYW1lID0gbmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gd2hlbiBJQ1UgaXMgYSByb290IGxldmVsIHRyYW5zbGF0aW9uXG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgfVxuICAgIGV4cGFuc2lvbi5pMThuID0gbWVzc2FnZTtcbiAgICByZXR1cm4gZXhwYW5zaW9uO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRleHQ7IH1cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGF0dHJpYnV0ZTsgfVxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gY29tbWVudDsgfVxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gZXhwYW5zaW9uQ2FzZTsgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbWV0YUZyb21JMThuTWVzc2FnZShtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIGlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IEkxOG5NZXRhIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdHlwZW9mIGlkID09PSAnc3RyaW5nJyA/IGlkIDogbWVzc2FnZS5pZCB8fCAnJyxcbiAgICBjdXN0b21JZDogbWVzc2FnZS5jdXN0b21JZCxcbiAgICBsZWdhY3lJZDogbWVzc2FnZS5sZWdhY3lJZCxcbiAgICBtZWFuaW5nOiBtZXNzYWdlLm1lYW5pbmcgfHwgJycsXG4gICAgZGVzY3JpcHRpb246IG1lc3NhZ2UuZGVzY3JpcHRpb24gfHwgJydcbiAgfTtcbn1cblxuLyoqIEkxOG4gc2VwYXJhdG9ycyBmb3IgbWV0YWRhdGEgKiovXG5jb25zdCBJMThOX01FQU5JTkdfU0VQQVJBVE9SID0gJ3wnO1xuY29uc3QgSTE4Tl9JRF9TRVBBUkFUT1IgPSAnQEAnO1xuXG4vKipcbiAqIFBhcnNlcyBpMThuIG1ldGFzIGxpa2U6XG4gKiAgLSBcIkBAaWRcIixcbiAqICAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbiAqICAtIFwibWVhbmluZ3xkZXNjcmlwdGlvbltAQGlkXVwiXG4gKiBhbmQgcmV0dXJucyBhbiBvYmplY3Qgd2l0aCBwYXJzZWQgb3V0cHV0LlxuICpcbiAqIEBwYXJhbSBtZXRhIFN0cmluZyB0aGF0IHJlcHJlc2VudHMgaTE4biBtZXRhXG4gKiBAcmV0dXJucyBPYmplY3Qgd2l0aCBpZCwgbWVhbmluZyBhbmQgZGVzY3JpcHRpb24gZmllbGRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUkxOG5NZXRhKG1ldGE/OiBzdHJpbmcpOiBJMThuTWV0YSB7XG4gIGxldCBjdXN0b21JZDogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZDtcblxuICBpZiAobWV0YSkge1xuICAgIGNvbnN0IGlkSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9JRF9TRVBBUkFUT1IpO1xuICAgIGNvbnN0IGRlc2NJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX01FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGN1c3RvbUlkXSA9XG4gICAgICAgIChpZEluZGV4ID4gLTEpID8gW21ldGEuc2xpY2UoMCwgaWRJbmRleCksIG1ldGEuc2xpY2UoaWRJbmRleCArIDIpXSA6IFttZXRhLCAnJ107XG4gICAgW21lYW5pbmcsIGRlc2NyaXB0aW9uXSA9IChkZXNjSW5kZXggPiAtMSkgP1xuICAgICAgICBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldIDpcbiAgICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2N1c3RvbUlkLCBtZWFuaW5nLCBkZXNjcmlwdGlvbn07XG59XG5cbi8qKlxuICogU2VyaWFsaXplIHRoZSBnaXZlbiBgbWV0YWAgYW5kIGBtZXNzYWdlUGFydGAgYSBzdHJpbmcgdGhhdCBjYW4gYmUgdXNlZCBpbiBhIGAkbG9jYWxpemVgXG4gKiB0YWdnZWQgc3RyaW5nLiBUaGUgZm9ybWF0IG9mIHRoZSBtZXRhZGF0YSBpcyB0aGUgc2FtZSBhcyB0aGF0IHBhcnNlZCBieSBgcGFyc2VJMThuTWV0YSgpYC5cbiAqXG4gKiBAcGFyYW0gbWV0YSBUaGUgbWV0YWRhdGEgdG8gc2VyaWFsaXplXG4gKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIGZpcnN0IHBhcnQgb2YgdGhlIHRhZ2dlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUkxOG5IZWFkKG1ldGE6IEkxOG5NZXRhLCBtZXNzYWdlUGFydDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IG1ldGFCbG9jayA9IG1ldGEuZGVzY3JpcHRpb24gfHwgJyc7XG4gIGlmIChtZXRhLm1lYW5pbmcpIHtcbiAgICBtZXRhQmxvY2sgPSBgJHttZXRhLm1lYW5pbmd9fCR7bWV0YUJsb2NrfWA7XG4gIH1cbiAgaWYgKG1ldGEuY3VzdG9tSWQgfHwgbWV0YS5sZWdhY3lJZCkge1xuICAgIG1ldGFCbG9jayA9IGAke21ldGFCbG9ja31AQCR7bWV0YS5jdXN0b21JZCB8fCBtZXRhLmxlZ2FjeUlkfWA7XG4gIH1cbiAgaWYgKG1ldGFCbG9jayA9PT0gJycpIHtcbiAgICAvLyBUaGVyZSBpcyBubyBtZXRhQmxvY2ssIHNvIHdlIG11c3QgZW5zdXJlIHRoYXQgYW55IHN0YXJ0aW5nIGNvbG9uIGlzIGVzY2FwZWQuXG4gICAgcmV0dXJuIGVzY2FwZVN0YXJ0aW5nQ29sb24obWVzc2FnZVBhcnQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBgOiR7ZXNjYXBlQ29sb25zKG1ldGFCbG9jayl9OiR7bWVzc2FnZVBhcnR9YDtcbiAgfVxufVxuXG4vKipcbiAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYHBsYWNlaG9sZGVyTmFtZWAgYW5kIGBtZXNzYWdlUGFydGAgaW50byBzdHJpbmdzIHRoYXQgY2FuIGJlIHVzZWQgaW4gYVxuICogYCRsb2NhbGl6ZWAgdGFnZ2VkIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0gcGxhY2Vob2xkZXJOYW1lIFRoZSBwbGFjZWhvbGRlciBuYW1lIHRvIHNlcmlhbGl6ZVxuICogQHBhcmFtIG1lc3NhZ2VQYXJ0IFRoZSBmb2xsb3dpbmcgbWVzc2FnZSBzdHJpbmcgYWZ0ZXIgdGhpcyBwbGFjZWhvbGRlclxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSTE4blRlbXBsYXRlUGFydChwbGFjZWhvbGRlck5hbWU6IHN0cmluZywgbWVzc2FnZVBhcnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChwbGFjZWhvbGRlck5hbWUgPT09ICcnKSB7XG4gICAgLy8gVGhlcmUgaXMgbm8gcGxhY2Vob2xkZXIgbmFtZSBibG9jaywgc28gd2UgbXVzdCBlbnN1cmUgdGhhdCBhbnkgc3RhcnRpbmcgY29sb24gaXMgZXNjYXBlZC5cbiAgICByZXR1cm4gZXNjYXBlU3RhcnRpbmdDb2xvbihtZXNzYWdlUGFydCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGA6JHtwbGFjZWhvbGRlck5hbWV9OiR7bWVzc2FnZVBhcnR9YDtcbiAgfVxufVxuXG4vLyBDb252ZXJ0cyBpMThuIG1ldGEgaW5mb3JtYXRpb24gZm9yIGEgbWVzc2FnZSAoaWQsIGRlc2NyaXB0aW9uLCBtZWFuaW5nKVxuLy8gdG8gYSBKc0RvYyBzdGF0ZW1lbnQgZm9ybWF0dGVkIGFzIGV4cGVjdGVkIGJ5IHRoZSBDbG9zdXJlIGNvbXBpbGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGkxOG5NZXRhVG9Eb2NTdG10KG1ldGE6IEkxOG5NZXRhKTogby5KU0RvY0NvbW1lbnRTdG10fG51bGwge1xuICBjb25zdCB0YWdzOiBvLkpTRG9jVGFnW10gPSBbXTtcbiAgaWYgKG1ldGEuZGVzY3JpcHRpb24pIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLkRlc2MsIHRleHQ6IG1ldGEuZGVzY3JpcHRpb259KTtcbiAgfVxuICBpZiAobWV0YS5tZWFuaW5nKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5NZWFuaW5nLCB0ZXh0OiBtZXRhLm1lYW5pbmd9KTtcbiAgfVxuICByZXR1cm4gdGFncy5sZW5ndGggPT0gMCA/IG51bGwgOiBuZXcgby5KU0RvY0NvbW1lbnRTdG10KHRhZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlU3RhcnRpbmdDb2xvbihzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXjovLCAnXFxcXDonKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUNvbG9ucyhzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvOi9nLCAnXFxcXDonKTtcbn0iXX0=