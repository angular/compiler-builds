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
        if (this.i18nLegacyMessageIdFormat === 'xlf') {
            message.legacyId = computeDigest(message);
        }
        else if (this.i18nLegacyMessageIdFormat === 'xlf2' || this.i18nLegacyMessageIdFormat === 'xmb') {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDeEYsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNuRSxPQUFPLEtBQUssSUFBSSxNQUFNLHdCQUF3QixDQUFDO0FBQy9DLE9BQU8sRUFBQyw0QkFBNEIsRUFBc0IsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRyxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBRWhELE9BQU8sRUFBQyxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBVXJGLFNBQVMsV0FBVyxDQUFDLElBQW1DLEVBQUUsSUFBZTtJQUN2RSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUNuQixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxlQUFlO0lBSTFCLFlBQ1ksc0JBQTJDLDRCQUE0QixFQUN2RSxnQkFBeUIsS0FBSyxFQUFVLDRCQUFvQyxFQUFFO1FBRDlFLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0Q7UUFDdkUsa0JBQWEsR0FBYixhQUFhLENBQWlCO1FBQVUsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFhO1FBTDFGLGtDQUFrQztRQUMxQix1QkFBa0IsR0FBRyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUlhLENBQUM7SUFFdEYsb0JBQW9CLENBQ3hCLEtBQWtCLEVBQUUsT0FBd0Is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QUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxHQUFXO0lBQ3RDLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjb21wdXRlRGVjaW1hbERpZ2VzdCwgY29tcHV0ZURpZ2VzdCwgZGVjaW1hbERpZ2VzdH0gZnJvbSAnLi4vLi4vLi4vaTE4bi9kaWdlc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7Y3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5fSBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHtJMThOX0FUVFIsIEkxOE5fQVRUUl9QUkVGSVgsIGhhc0kxOG5BdHRycywgaWN1RnJvbUkxOG5NZXNzYWdlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBJMThuTWV0YSA9IHtcbiAgaWQ/OiBzdHJpbmcsXG4gIGN1c3RvbUlkPzogc3RyaW5nLFxuICBsZWdhY3lJZD86IHN0cmluZyxcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG4gIG1lYW5pbmc/OiBzdHJpbmdcbn07XG5cbmZ1bmN0aW9uIHNldEkxOG5SZWZzKGh0bWw6IGh0bWwuTm9kZSAmIHtpMThuPzogaTE4bi5BU1R9LCBpMThuOiBpMThuLk5vZGUpIHtcbiAgaHRtbC5pMThuID0gaTE4bjtcbn1cblxuLyoqXG4gKiBUaGlzIHZpc2l0b3Igd2Fsa3Mgb3ZlciBIVE1MIHBhcnNlIHRyZWUgYW5kIGNvbnZlcnRzIGluZm9ybWF0aW9uIHN0b3JlZCBpblxuICogaTE4bi1yZWxhdGVkIGF0dHJpYnV0ZXMgKFwiaTE4blwiIGFuZCBcImkxOG4tKlwiKSBpbnRvIGkxOG4gbWV0YSBvYmplY3QgdGhhdCBpc1xuICogc3RvcmVkIHdpdGggb3RoZXIgZWxlbWVudCdzIGFuZCBhdHRyaWJ1dGUncyBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIEkxOG5NZXRhVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIC8vIGkxOG4gbWVzc2FnZSBnZW5lcmF0aW9uIGZhY3RvcnlcbiAgcHJpdmF0ZSBfY3JlYXRlSTE4bk1lc3NhZ2UgPSBjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnkodGhpcy5pbnRlcnBvbGF0aW9uQ29uZmlnKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgICBwcml2YXRlIGtlZXBJMThuQXR0cnM6IGJvb2xlYW4gPSBmYWxzZSwgcHJpdmF0ZSBpMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0OiBzdHJpbmcgPSAnJykge31cblxuICBwcml2YXRlIF9nZW5lcmF0ZUkxOG5NZXNzYWdlKFxuICAgICAgbm9kZXM6IGh0bWwuTm9kZVtdLCBtZXRhOiBzdHJpbmd8aTE4bi5BU1QgPSAnJyxcbiAgICAgIHZpc2l0Tm9kZUZuPzogKGh0bWw6IGh0bWwuTm9kZSwgaTE4bjogaTE4bi5Ob2RlKSA9PiB2b2lkKTogaTE4bi5NZXNzYWdlIHtcbiAgICBjb25zdCBwYXJzZWQ6IEkxOG5NZXRhID1cbiAgICAgICAgdHlwZW9mIG1ldGEgPT09ICdzdHJpbmcnID8gcGFyc2VJMThuTWV0YShtZXRhKSA6IG1ldGFGcm9tSTE4bk1lc3NhZ2UobWV0YSBhcyBpMThuLk1lc3NhZ2UpO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9jcmVhdGVJMThuTWVzc2FnZShcbiAgICAgICAgbm9kZXMsIHBhcnNlZC5tZWFuaW5nIHx8ICcnLCBwYXJzZWQuZGVzY3JpcHRpb24gfHwgJycsIHBhcnNlZC5jdXN0b21JZCB8fCAnJywgdmlzaXROb2RlRm4pO1xuICAgIGlmICghbWVzc2FnZS5pZCkge1xuICAgICAgLy8gZ2VuZXJhdGUgKG9yIHJlc3RvcmUpIG1lc3NhZ2UgaWQgaWYgbm90IHNwZWNpZmllZCBpbiB0ZW1wbGF0ZVxuICAgICAgbWVzc2FnZS5pZCA9IHR5cGVvZiBtZXRhICE9PSAnc3RyaW5nJyAmJiAobWV0YSBhcyBpMThuLk1lc3NhZ2UpLmlkIHx8IGRlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsZicpIHtcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWQgPSBjb21wdXRlRGlnZXN0KG1lc3NhZ2UpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsZjInIHx8IHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3htYicpIHtcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWQgPSBjb21wdXRlRGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtZXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgLy8gVGhpcyBvY2N1cnMgaWYgd2UgYXJlIGRvaW5nIHRoZSAybmQgcGFzcyBhZnRlciB3aGl0ZXNwYWNlIHJlbW92YWxcbiAgICAgIC8vIEluIHRoYXQgY2FzZSB3ZSB3YW50IHRvIHJldXNlIHRoZSBsZWdhY3kgbWVzc2FnZSBnZW5lcmF0ZWQgaW4gdGhlIDFzdCBwYXNzXG4gICAgICAvLyBTZWUgYHBhcnNlVGVtcGxhdGUoKWAgaW4gYHBhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUudHNgXG4gICAgICBtZXNzYWdlLmxlZ2FjeUlkID0gKG1ldGEgYXMgaTE4bi5NZXNzYWdlKS5sZWdhY3lJZDtcbiAgICB9XG5cbiAgICByZXR1cm4gbWVzc2FnZTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBodG1sLkVsZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGhhc0kxOG5BdHRycyhlbGVtZW50KSkge1xuICAgICAgY29uc3QgYXR0cnM6IGh0bWwuQXR0cmlidXRlW10gPSBbXTtcbiAgICAgIGNvbnN0IGF0dHJzTWV0YToge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cnMpIHtcbiAgICAgICAgaWYgKGF0dHIubmFtZSA9PT0gSTE4Tl9BVFRSKSB7XG4gICAgICAgICAgLy8gcm9vdCAnaTE4bicgbm9kZSBhdHRyaWJ1dGVcbiAgICAgICAgICBjb25zdCBpMThuID0gZWxlbWVudC5pMThuIHx8IGF0dHIudmFsdWU7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoZWxlbWVudC5jaGlsZHJlbiwgaTE4biwgc2V0STE4blJlZnMpO1xuICAgICAgICAgIC8vIGRvIG5vdCBhc3NpZ24gZW1wdHkgaTE4biBtZXRhXG4gICAgICAgICAgaWYgKG1lc3NhZ2Uubm9kZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBlbGVtZW50LmkxOG4gPSBtZXNzYWdlO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHIubmFtZS5zdGFydHNXaXRoKEkxOE5fQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgICAgLy8gJ2kxOG4tKicgYXR0cmlidXRlc1xuICAgICAgICAgIGNvbnN0IGtleSA9IGF0dHIubmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICAgICAgYXR0cnNNZXRhW2tleV0gPSBhdHRyLnZhbHVlO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbm9uLWkxOG4gYXR0cmlidXRlc1xuICAgICAgICAgIGF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc2V0IGkxOG4gbWV0YSBmb3IgYXR0cmlidXRlc1xuICAgICAgaWYgKE9iamVjdC5rZXlzKGF0dHJzTWV0YSkubGVuZ3RoKSB7XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBhdHRycykge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBhdHRyc01ldGFbYXR0ci5uYW1lXTtcbiAgICAgICAgICAvLyBkbyBub3QgY3JlYXRlIHRyYW5zbGF0aW9uIGZvciBlbXB0eSBhdHRyaWJ1dGVzXG4gICAgICAgICAgaWYgKG1ldGEgIT09IHVuZGVmaW5lZCAmJiBhdHRyLnZhbHVlKSB7XG4gICAgICAgICAgICBhdHRyLmkxOG4gPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFthdHRyXSwgYXR0ci5pMThuIHx8IG1ldGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMua2VlcEkxOG5BdHRycykge1xuICAgICAgICAvLyB1cGRhdGUgZWxlbWVudCdzIGF0dHJpYnV0ZXMsXG4gICAgICAgIC8vIGtlZXBpbmcgb25seSBub24taTE4biByZWxhdGVkIG9uZXNcbiAgICAgICAgZWxlbWVudC5hdHRycyA9IGF0dHJzO1xuICAgICAgfVxuICAgIH1cbiAgICBodG1sLnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIHJldHVybiBlbGVtZW50O1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBsZXQgbWVzc2FnZTtcbiAgICBjb25zdCBtZXRhID0gZXhwYW5zaW9uLmkxOG47XG4gICAgaWYgKG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyKSB7XG4gICAgICAvLyBzZXQgSUNVIHBsYWNlaG9sZGVyIG5hbWUgKGUuZy4gXCJJQ1VfMVwiKSxcbiAgICAgIC8vIGdlbmVyYXRlZCB3aGlsZSBwcm9jZXNzaW5nIHJvb3QgZWxlbWVudCBjb250ZW50cyxcbiAgICAgIC8vIHNvIHdlIGNhbiByZWZlcmVuY2UgaXQgd2hlbiB3ZSBvdXRwdXQgdHJhbnNsYXRpb25cbiAgICAgIGNvbnN0IG5hbWUgPSBtZXRhLm5hbWU7XG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgICBjb25zdCBpY3UgPSBpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICBpY3UubmFtZSA9IG5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHdoZW4gSUNVIGlzIGEgcm9vdCBsZXZlbCB0cmFuc2xhdGlvblxuICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2V4cGFuc2lvbl0sIG1ldGEpO1xuICAgIH1cbiAgICBleHBhbnNpb24uaTE4biA9IG1lc3NhZ2U7XG4gICAgcmV0dXJuIGV4cGFuc2lvbjtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB0ZXh0OyB9XG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBhdHRyaWJ1dGU7IH1cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGNvbW1lbnQ7IH1cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGV4cGFuc2lvbkNhc2U7IH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ldGFGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZTogaTE4bi5NZXNzYWdlLCBpZDogc3RyaW5nIHwgbnVsbCA9IG51bGwpOiBJMThuTWV0YSB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHR5cGVvZiBpZCA9PT0gJ3N0cmluZycgPyBpZCA6IG1lc3NhZ2UuaWQgfHwgJycsXG4gICAgY3VzdG9tSWQ6IG1lc3NhZ2UuY3VzdG9tSWQsXG4gICAgbGVnYWN5SWQ6IG1lc3NhZ2UubGVnYWN5SWQsXG4gICAgbWVhbmluZzogbWVzc2FnZS5tZWFuaW5nIHx8ICcnLFxuICAgIGRlc2NyaXB0aW9uOiBtZXNzYWdlLmRlc2NyaXB0aW9uIHx8ICcnXG4gIH07XG59XG5cbi8qKiBJMThuIHNlcGFyYXRvcnMgZm9yIG1ldGFkYXRhICoqL1xuY29uc3QgSTE4Tl9NRUFOSU5HX1NFUEFSQVRPUiA9ICd8JztcbmNvbnN0IEkxOE5fSURfU0VQQVJBVE9SID0gJ0BAJztcblxuLyoqXG4gKiBQYXJzZXMgaTE4biBtZXRhcyBsaWtlOlxuICogIC0gXCJAQGlkXCIsXG4gKiAgLSBcImRlc2NyaXB0aW9uW0BAaWRdXCIsXG4gKiAgLSBcIm1lYW5pbmd8ZGVzY3JpcHRpb25bQEBpZF1cIlxuICogYW5kIHJldHVybnMgYW4gb2JqZWN0IHdpdGggcGFyc2VkIG91dHB1dC5cbiAqXG4gKiBAcGFyYW0gbWV0YSBTdHJpbmcgdGhhdCByZXByZXNlbnRzIGkxOG4gbWV0YVxuICogQHJldHVybnMgT2JqZWN0IHdpdGggaWQsIG1lYW5pbmcgYW5kIGRlc2NyaXB0aW9uIGZpZWxkc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VJMThuTWV0YShtZXRhPzogc3RyaW5nKTogSTE4bk1ldGEge1xuICBsZXQgY3VzdG9tSWQ6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgaWYgKG1ldGEpIHtcbiAgICBjb25zdCBpZEluZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fSURfU0VQQVJBVE9SKTtcbiAgICBjb25zdCBkZXNjSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9NRUFOSU5HX1NFUEFSQVRPUik7XG4gICAgbGV0IG1lYW5pbmdBbmREZXNjOiBzdHJpbmc7XG4gICAgW21lYW5pbmdBbmREZXNjLCBjdXN0b21JZF0gPVxuICAgICAgICAoaWRJbmRleCA+IC0xKSA/IFttZXRhLnNsaWNlKDAsIGlkSW5kZXgpLCBtZXRhLnNsaWNlKGlkSW5kZXggKyAyKV0gOiBbbWV0YSwgJyddO1xuICAgIFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPSAoZGVzY0luZGV4ID4gLTEpID9cbiAgICAgICAgW21lYW5pbmdBbmREZXNjLnNsaWNlKDAsIGRlc2NJbmRleCksIG1lYW5pbmdBbmREZXNjLnNsaWNlKGRlc2NJbmRleCArIDEpXSA6XG4gICAgICAgIFsnJywgbWVhbmluZ0FuZERlc2NdO1xuICB9XG5cbiAgcmV0dXJuIHtjdXN0b21JZCwgbWVhbmluZywgZGVzY3JpcHRpb259O1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYG1ldGFgIGFuZCBgbWVzc2FnZVBhcnRgIGEgc3RyaW5nIHRoYXQgY2FuIGJlIHVzZWQgaW4gYSBgJGxvY2FsaXplYFxuICogdGFnZ2VkIHN0cmluZy4gVGhlIGZvcm1hdCBvZiB0aGUgbWV0YWRhdGEgaXMgdGhlIHNhbWUgYXMgdGhhdCBwYXJzZWQgYnkgYHBhcnNlSTE4bk1ldGEoKWAuXG4gKlxuICogQHBhcmFtIG1ldGEgVGhlIG1ldGFkYXRhIHRvIHNlcmlhbGl6ZVxuICogQHBhcmFtIG1lc3NhZ2VQYXJ0IFRoZSBmaXJzdCBwYXJ0IG9mIHRoZSB0YWdnZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVJMThuSGVhZChtZXRhOiBJMThuTWV0YSwgbWVzc2FnZVBhcnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBtZXRhQmxvY2sgPSBtZXRhLmRlc2NyaXB0aW9uIHx8ICcnO1xuICBpZiAobWV0YS5tZWFuaW5nKSB7XG4gICAgbWV0YUJsb2NrID0gYCR7bWV0YS5tZWFuaW5nfXwke21ldGFCbG9ja31gO1xuICB9XG4gIGlmIChtZXRhLmN1c3RvbUlkIHx8IG1ldGEubGVnYWN5SWQpIHtcbiAgICBtZXRhQmxvY2sgPSBgJHttZXRhQmxvY2t9QEAke21ldGEuY3VzdG9tSWQgfHwgbWV0YS5sZWdhY3lJZH1gO1xuICB9XG4gIGlmIChtZXRhQmxvY2sgPT09ICcnKSB7XG4gICAgLy8gVGhlcmUgaXMgbm8gbWV0YUJsb2NrLCBzbyB3ZSBtdXN0IGVuc3VyZSB0aGF0IGFueSBzdGFydGluZyBjb2xvbiBpcyBlc2NhcGVkLlxuICAgIHJldHVybiBlc2NhcGVTdGFydGluZ0NvbG9uKG1lc3NhZ2VQYXJ0KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYDoke2VzY2FwZUNvbG9ucyhtZXRhQmxvY2spfToke21lc3NhZ2VQYXJ0fWA7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBwbGFjZWhvbGRlck5hbWVgIGFuZCBgbWVzc2FnZVBhcnRgIGludG8gc3RyaW5ncyB0aGF0IGNhbiBiZSB1c2VkIGluIGFcbiAqIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHBsYWNlaG9sZGVyTmFtZSBUaGUgcGxhY2Vob2xkZXIgbmFtZSB0byBzZXJpYWxpemVcbiAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZm9sbG93aW5nIG1lc3NhZ2Ugc3RyaW5nIGFmdGVyIHRoaXMgcGxhY2Vob2xkZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUkxOG5UZW1wbGF0ZVBhcnQocGxhY2Vob2xkZXJOYW1lOiBzdHJpbmcsIG1lc3NhZ2VQYXJ0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAocGxhY2Vob2xkZXJOYW1lID09PSAnJykge1xuICAgIC8vIFRoZXJlIGlzIG5vIHBsYWNlaG9sZGVyIG5hbWUgYmxvY2ssIHNvIHdlIG11c3QgZW5zdXJlIHRoYXQgYW55IHN0YXJ0aW5nIGNvbG9uIGlzIGVzY2FwZWQuXG4gICAgcmV0dXJuIGVzY2FwZVN0YXJ0aW5nQ29sb24obWVzc2FnZVBhcnQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBgOiR7cGxhY2Vob2xkZXJOYW1lfToke21lc3NhZ2VQYXJ0fWA7XG4gIH1cbn1cblxuLy8gQ29udmVydHMgaTE4biBtZXRhIGluZm9ybWF0aW9uIGZvciBhIG1lc3NhZ2UgKGlkLCBkZXNjcmlwdGlvbiwgbWVhbmluZylcbi8vIHRvIGEgSnNEb2Mgc3RhdGVtZW50IGZvcm1hdHRlZCBhcyBleHBlY3RlZCBieSB0aGUgQ2xvc3VyZSBjb21waWxlci5cbmV4cG9ydCBmdW5jdGlvbiBpMThuTWV0YVRvRG9jU3RtdChtZXRhOiBJMThuTWV0YSk6IG8uSlNEb2NDb21tZW50U3RtdHxudWxsIHtcbiAgY29uc3QgdGFnczogby5KU0RvY1RhZ1tdID0gW107XG4gIGlmIChtZXRhLmRlc2NyaXB0aW9uKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5EZXNjLCB0ZXh0OiBtZXRhLmRlc2NyaXB0aW9ufSk7XG4gIH1cbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuTWVhbmluZywgdGV4dDogbWV0YS5tZWFuaW5nfSk7XG4gIH1cbiAgcmV0dXJuIHRhZ3MubGVuZ3RoID09IDAgPyBudWxsIDogbmV3IG8uSlNEb2NDb21tZW50U3RtdCh0YWdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZVN0YXJ0aW5nQ29sb24oc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL146LywgJ1xcXFw6Jyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVDb2xvbnMoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoLzovZywgJ1xcXFw6Jyk7XG59Il19