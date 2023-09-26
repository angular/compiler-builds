/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { computeDecimalDigest, computeDigest, decimalDigest } from '../../../i18n/digest';
import * as i18n from '../../../i18n/i18n_ast';
import { createI18nMessageFactory } from '../../../i18n/i18n_parser';
import { I18nError } from '../../../i18n/parse_util';
import * as html from '../../../ml_parser/ast';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../../ml_parser/interpolation_config';
import { ParseTreeResult } from '../../../ml_parser/parser';
import * as o from '../../../output/output_ast';
import { isTrustedTypesSink } from '../../../schema/trusted_types_sinks';
import { hasI18nAttrs, I18N_ATTR, I18N_ATTR_PREFIX, icuFromI18nMessage } from './util';
const setI18nRefs = (htmlNode, i18nNode) => {
    if (htmlNode instanceof html.NodeWithI18n) {
        if (i18nNode instanceof i18n.IcuPlaceholder && htmlNode.i18n instanceof i18n.Message) {
            // This html node represents an ICU but this is a second processing pass, and the legacy id
            // was computed in the previous pass and stored in the `i18n` property as a message.
            // We are about to wipe out that property so capture the previous message to be reused when
            // generating the message for this ICU later. See `_generateI18nMessage()`.
            i18nNode.previousMessage = htmlNode.i18n;
        }
        htmlNode.i18n = i18nNode;
    }
    return i18nNode;
};
/**
 * This visitor walks over HTML parse tree and converts information stored in
 * i18n-related attributes ("i18n" and "i18n-*") into i18n meta object that is
 * stored with other element's and attribute's information.
 */
export class I18nMetaVisitor {
    constructor(interpolationConfig = DEFAULT_INTERPOLATION_CONFIG, keepI18nAttrs = false, enableI18nLegacyMessageIdFormat = false) {
        this.interpolationConfig = interpolationConfig;
        this.keepI18nAttrs = keepI18nAttrs;
        this.enableI18nLegacyMessageIdFormat = enableI18nLegacyMessageIdFormat;
        // whether visited nodes contain i18n information
        this.hasI18nMeta = false;
        this._errors = [];
    }
    _generateI18nMessage(nodes, meta = '', visitNodeFn) {
        const { meaning, description, customId } = this._parseMetadata(meta);
        const createI18nMessage = createI18nMessageFactory(this.interpolationConfig);
        const message = createI18nMessage(nodes, meaning, description, customId, visitNodeFn);
        this._setMessageId(message, meta);
        this._setLegacyIds(message, meta);
        return message;
    }
    visitAllWithErrors(nodes) {
        const result = nodes.map(node => node.visit(this, null));
        return new ParseTreeResult(result, this._errors);
    }
    visitElement(element) {
        let message = undefined;
        if (hasI18nAttrs(element)) {
            this.hasI18nMeta = true;
            const attrs = [];
            const attrsMeta = {};
            for (const attr of element.attrs) {
                if (attr.name === I18N_ATTR) {
                    // root 'i18n' node attribute
                    const i18n = element.i18n || attr.value;
                    message = this._generateI18nMessage(element.children, i18n, setI18nRefs);
                    if (message.nodes.length === 0) {
                        // Ignore the message if it is empty.
                        message = undefined;
                    }
                    // Store the message on the element
                    element.i18n = message;
                }
                else if (attr.name.startsWith(I18N_ATTR_PREFIX)) {
                    // 'i18n-*' attributes
                    const name = attr.name.slice(I18N_ATTR_PREFIX.length);
                    if (isTrustedTypesSink(element.name, name)) {
                        this._reportError(attr, `Translating attribute '${name}' is disallowed for security reasons.`);
                    }
                    else {
                        attrsMeta[name] = attr.value;
                    }
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
        html.visitAll(this, element.children, message);
        return element;
    }
    visitExpansion(expansion, currentMessage) {
        let message;
        const meta = expansion.i18n;
        this.hasI18nMeta = true;
        if (meta instanceof i18n.IcuPlaceholder) {
            // set ICU placeholder name (e.g. "ICU_1"),
            // generated while processing root element contents,
            // so we can reference it when we output translation
            const name = meta.name;
            message = this._generateI18nMessage([expansion], meta);
            const icu = icuFromI18nMessage(message);
            icu.name = name;
            if (currentMessage !== null) {
                // Also update the placeholderToMessage map with this new message
                currentMessage.placeholderToMessage[name] = message;
            }
        }
        else {
            // ICU is a top level message, try to use metadata from container element if provided via
            // `context` argument. Note: context may not be available for standalone ICUs (without
            // wrapping element), so fallback to ICU metadata in this case.
            message = this._generateI18nMessage([expansion], currentMessage || meta);
        }
        expansion.i18n = message;
        return expansion;
    }
    visitText(text) {
        return text;
    }
    visitAttribute(attribute) {
        return attribute;
    }
    visitComment(comment) {
        return comment;
    }
    visitExpansionCase(expansionCase) {
        return expansionCase;
    }
    visitBlock(block, context) {
        html.visitAll(this, block.children, context);
        return block;
    }
    visitBlockParameter(parameter, context) {
        return parameter;
    }
    /**
     * Parse the general form `meta` passed into extract the explicit metadata needed to create a
     * `Message`.
     *
     * There are three possibilities for the `meta` variable
     * 1) a string from an `i18n` template attribute: parse it to extract the metadata values.
     * 2) a `Message` from a previous processing pass: reuse the metadata values in the message.
     * 4) other: ignore this and just process the message metadata as normal
     *
     * @param meta the bucket that holds information about the message
     * @returns the parsed metadata.
     */
    _parseMetadata(meta) {
        return typeof meta === 'string' ? parseI18nMeta(meta) :
            meta instanceof i18n.Message ? meta :
                {};
    }
    /**
     * Generate (or restore) message id if not specified already.
     */
    _setMessageId(message, meta) {
        if (!message.id) {
            message.id = meta instanceof i18n.Message && meta.id || decimalDigest(message);
        }
    }
    /**
     * Update the `message` with a `legacyId` if necessary.
     *
     * @param message the message whose legacy id should be set
     * @param meta information about the message being processed
     */
    _setLegacyIds(message, meta) {
        if (this.enableI18nLegacyMessageIdFormat) {
            message.legacyIds = [computeDigest(message), computeDecimalDigest(message)];
        }
        else if (typeof meta !== 'string') {
            // This occurs if we are doing the 2nd pass after whitespace removal (see `parseTemplate()` in
            // `packages/compiler/src/render3/view/template.ts`).
            // In that case we want to reuse the legacy message generated in the 1st pass (see
            // `setI18nRefs()`).
            const previousMessage = meta instanceof i18n.Message ? meta :
                meta instanceof i18n.IcuPlaceholder ? meta.previousMessage :
                    undefined;
            message.legacyIds = previousMessage ? previousMessage.legacyIds : [];
        }
    }
    _reportError(node, msg) {
        this._errors.push(new I18nError(node.sourceSpan, msg));
    }
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
export function parseI18nMeta(meta = '') {
    let customId;
    let meaning;
    let description;
    meta = meta.trim();
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
// Converts i18n meta information for a message (id, description, meaning)
// to a JsDoc statement formatted as expected by the Closure compiler.
export function i18nMetaToJSDoc(meta) {
    const tags = [];
    if (meta.description) {
        tags.push({ tagName: "desc" /* o.JSDocTagName.Desc */, text: meta.description });
    }
    else {
        // Suppress the JSCompiler warning that a `@desc` was not given for this message.
        tags.push({ tagName: "suppress" /* o.JSDocTagName.Suppress */, text: '{msgDescriptions}' });
    }
    if (meta.meaning) {
        tags.push({ tagName: "meaning" /* o.JSDocTagName.Meaning */, text: meta.meaning });
    }
    return o.jsDocComment(tags);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDeEYsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsd0JBQXdCLEVBQWtDLE1BQU0sMkJBQTJCLENBQUM7QUFDcEcsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ25ELE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLDRCQUE0QixFQUFzQixNQUFNLHlDQUF5QyxDQUFDO0FBQzFHLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMxRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ2hELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBRXZFLE9BQU8sRUFBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBV3JGLE1BQU0sV0FBVyxHQUFnQixDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsRUFBRTtJQUN0RCxJQUFJLFFBQVEsWUFBWSxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ3pDLElBQUksUUFBUSxZQUFZLElBQUksQ0FBQyxjQUFjLElBQUksUUFBUSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ3BGLDJGQUEyRjtZQUMzRixvRkFBb0Y7WUFDcEYsMkZBQTJGO1lBQzNGLDJFQUEyRTtZQUMzRSxRQUFRLENBQUMsZUFBZSxHQUFH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LEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLEVBQUUsY0FBYyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNFLENBQUMsRUFBRSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0tBQzFCO0lBRUQsT0FBTyxFQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFDLENBQUM7QUFDMUMsQ0FBQztBQUVELDBFQUEwRTtBQUMxRSxzRUFBc0U7QUFDdEUsTUFBTSxVQUFVLGVBQWUsQ0FBQyxJQUFjO0lBQzVDLE1BQU0sSUFBSSxHQUFpQixFQUFFLENBQUM7SUFDOUIsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLGtDQUFxQixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFDLENBQUMsQ0FBQztLQUNuRTtTQUFNO1FBQ0wsaUZBQWlGO1FBQ2pGLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLDBDQUF5QixFQUFFLElBQUksRUFBRSxtQkFBbUIsRUFBQyxDQUFDLENBQUM7S0FDMUU7SUFDRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sd0NBQXdCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQyxDQUFDO0tBQ2xFO0lBQ0QsT0FBTyxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjb21wdXRlRGVjaW1hbERpZ2VzdCwgY29tcHV0ZURpZ2VzdCwgZGVjaW1hbERpZ2VzdH0gZnJvbSAnLi4vLi4vLi4vaTE4bi9kaWdlc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7Y3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5LCBJMThuTWVzc2FnZUZhY3RvcnksIFZpc2l0Tm9kZUZufSBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fcGFyc2VyJztcbmltcG9ydCB7STE4bkVycm9yfSBmcm9tICcuLi8uLi8uLi9pMThuL3BhcnNlX3V0aWwnO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7UGFyc2VUcmVlUmVzdWx0fSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtpc1RydXN0ZWRUeXBlc1Npbmt9IGZyb20gJy4uLy4uLy4uL3NjaGVtYS90cnVzdGVkX3R5cGVzX3NpbmtzJztcblxuaW1wb3J0IHtoYXNJMThuQXR0cnMsIEkxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgaWN1RnJvbUkxOG5NZXNzYWdlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBJMThuTWV0YSA9IHtcbiAgaWQ/OiBzdHJpbmcsXG4gIGN1c3RvbUlkPzogc3RyaW5nLFxuICBsZWdhY3lJZHM/OiBzdHJpbmdbXSxcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG4gIG1lYW5pbmc/OiBzdHJpbmdcbn07XG5cblxuY29uc3Qgc2V0STE4blJlZnM6IFZpc2l0Tm9kZUZuID0gKGh0bWxOb2RlLCBpMThuTm9kZSkgPT4ge1xuICBpZiAoaHRtbE5vZGUgaW5zdGFuY2VvZiBodG1sLk5vZGVXaXRoSTE4bikge1xuICAgIGlmIChpMThuTm9kZSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXIgJiYgaHRtbE5vZGUuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgICAgLy8gVGhpcyBodG1sIG5vZGUgcmVwcmVzZW50cyBhbiBJQ1UgYnV0IHRoaXMgaXMgYSBzZWNvbmQgcHJvY2Vzc2luZyBwYXNzLCBhbmQgdGhlIGxlZ2FjeSBpZFxuICAgICAgLy8gd2FzIGNvbXB1dGVkIGluIHRoZSBwcmV2aW91cyBwYXNzIGFuZCBzdG9yZWQgaW4gdGhlIGBpMThuYCBwcm9wZXJ0eSBhcyBhIG1lc3NhZ2UuXG4gICAgICAvLyBXZSBhcmUgYWJvdXQgdG8gd2lwZSBvdXQgdGhhdCBwcm9wZXJ0eSBzbyBjYXB0dXJlIHRoZSBwcmV2aW91cyBtZXNzYWdlIHRvIGJlIHJldXNlZCB3aGVuXG4gICAgICAvLyBnZW5lcmF0aW5nIHRoZSBtZXNzYWdlIGZvciB0aGlzIElDVSBsYXRlci4gU2VlIGBfZ2VuZXJhdGVJMThuTWVzc2FnZSgpYC5cbiAgICAgIGkxOG5Ob2RlLnByZXZpb3VzTWVzc2FnZSA9IGh0bWxOb2RlLmkxOG47XG4gICAgfVxuICAgIGh0bWxOb2RlLmkxOG4gPSBpMThuTm9kZTtcbiAgfVxuICByZXR1cm4gaTE4bk5vZGU7XG59O1xuXG4vKipcbiAqIFRoaXMgdmlzaXRvciB3YWxrcyBvdmVyIEhUTUwgcGFyc2UgdHJlZSBhbmQgY29udmVydHMgaW5mb3JtYXRpb24gc3RvcmVkIGluXG4gKiBpMThuLXJlbGF0ZWQgYXR0cmlidXRlcyAoXCJpMThuXCIgYW5kIFwiaTE4bi0qXCIpIGludG8gaTE4biBtZXRhIG9iamVjdCB0aGF0IGlzXG4gKiBzdG9yZWQgd2l0aCBvdGhlciBlbGVtZW50J3MgYW5kIGF0dHJpYnV0ZSdzIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgSTE4bk1ldGFWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgLy8gd2hldGhlciB2aXNpdGVkIG5vZGVzIGNvbnRhaW4gaTE4biBpbmZvcm1hdGlvblxuICBwdWJsaWMgaGFzSTE4bk1ldGE6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfZXJyb3JzOiBJMThuRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyxcbiAgICAgIHByaXZhdGUga2VlcEkxOG5BdHRycyA9IGZhbHNlLCBwcml2YXRlIGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPSBmYWxzZSkge31cblxuICBwcml2YXRlIF9nZW5lcmF0ZUkxOG5NZXNzYWdlKFxuICAgICAgbm9kZXM6IGh0bWwuTm9kZVtdLCBtZXRhOiBzdHJpbmd8aTE4bi5JMThuTWV0YSA9ICcnLFxuICAgICAgdmlzaXROb2RlRm4/OiBWaXNpdE5vZGVGbik6IGkxOG4uTWVzc2FnZSB7XG4gICAgY29uc3Qge21lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZH0gPSB0aGlzLl9wYXJzZU1ldGFkYXRhKG1ldGEpO1xuICAgIGNvbnN0IGNyZWF0ZUkxOG5NZXNzYWdlID0gY3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5KHRoaXMuaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3QgbWVzc2FnZSA9IGNyZWF0ZUkxOG5NZXNzYWdlKG5vZGVzLCBtZWFuaW5nLCBkZXNjcmlwdGlvbiwgY3VzdG9tSWQsIHZpc2l0Tm9kZUZuKTtcbiAgICB0aGlzLl9zZXRNZXNzYWdlSWQobWVzc2FnZSwgbWV0YSk7XG4gICAgdGhpcy5fc2V0TGVnYWN5SWRzKG1lc3NhZ2UsIG1ldGEpO1xuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgdmlzaXRBbGxXaXRoRXJyb3JzKG5vZGVzOiBodG1sLk5vZGVbXSk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gICAgY29uc3QgcmVzdWx0ID0gbm9kZXMubWFwKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzLCBudWxsKSk7XG4gICAgcmV0dXJuIG5ldyBQYXJzZVRyZWVSZXN1bHQocmVzdWx0LCB0aGlzLl9lcnJvcnMpO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCk6IGFueSB7XG4gICAgbGV0IG1lc3NhZ2U6IGkxOG4uTWVzc2FnZXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoaGFzSTE4bkF0dHJzKGVsZW1lbnQpKSB7XG4gICAgICB0aGlzLmhhc0kxOG5NZXRhID0gdHJ1ZTtcbiAgICAgIGNvbnN0IGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdID0gW107XG4gICAgICBjb25zdCBhdHRyc01ldGE6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cbiAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJzKSB7XG4gICAgICAgIGlmIChhdHRyLm5hbWUgPT09IEkxOE5fQVRUUikge1xuICAgICAgICAgIC8vIHJvb3QgJ2kxOG4nIG5vZGUgYXR0cmlidXRlXG4gICAgICAgICAgY29uc3QgaTE4biA9IGVsZW1lbnQuaTE4biB8fCBhdHRyLnZhbHVlO1xuICAgICAgICAgIG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKGVsZW1lbnQuY2hpbGRyZW4sIGkxOG4sIHNldEkxOG5SZWZzKTtcbiAgICAgICAgICBpZiAobWVzc2FnZS5ub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8vIElnbm9yZSB0aGUgbWVzc2FnZSBpZiBpdCBpcyBlbXB0eS5cbiAgICAgICAgICAgIG1lc3NhZ2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFN0b3JlIHRoZSBtZXNzYWdlIG9uIHRoZSBlbGVtZW50XG4gICAgICAgICAgZWxlbWVudC5pMThuID0gbWVzc2FnZTtcbiAgICAgICAgfSBlbHNlIGlmIChhdHRyLm5hbWUuc3RhcnRzV2l0aChJMThOX0FUVFJfUFJFRklYKSkge1xuICAgICAgICAgIC8vICdpMThuLSonIGF0dHJpYnV0ZXNcbiAgICAgICAgICBjb25zdCBuYW1lID0gYXR0ci5uYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKTtcbiAgICAgICAgICBpZiAoaXNUcnVzdGVkVHlwZXNTaW5rKGVsZW1lbnQubmFtZSwgbmFtZSkpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAgIGF0dHIsIGBUcmFuc2xhdGluZyBhdHRyaWJ1dGUgJyR7bmFtZX0nIGlzIGRpc2FsbG93ZWQgZm9yIHNlY3VyaXR5IHJlYXNvbnMuYCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJzTWV0YVtuYW1lXSA9IGF0dHIudmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vbi1pMThuIGF0dHJpYnV0ZXNcbiAgICAgICAgICBhdHRycy5wdXNoKGF0dHIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHNldCBpMThuIG1ldGEgZm9yIGF0dHJpYnV0ZXNcbiAgICAgIGlmIChPYmplY3Qua2V5cyhhdHRyc01ldGEpLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgYXR0cnMpIHtcbiAgICAgICAgICBjb25zdCBtZXRhID0gYXR0cnNNZXRhW2F0dHIubmFtZV07XG4gICAgICAgICAgLy8gZG8gbm90IGNyZWF0ZSB0cmFuc2xhdGlvbiBmb3IgZW1wdHkgYXR0cmlidXRlc1xuICAgICAgICAgIGlmIChtZXRhICE9PSB1bmRlZmluZWQgJiYgYXR0ci52YWx1ZSkge1xuICAgICAgICAgICAgYXR0ci5pMThuID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbYXR0cl0sIGF0dHIuaTE4biB8fCBtZXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmtlZXBJMThuQXR0cnMpIHtcbiAgICAgICAgLy8gdXBkYXRlIGVsZW1lbnQncyBhdHRyaWJ1dGVzLFxuICAgICAgICAvLyBrZWVwaW5nIG9ubHkgbm9uLWkxOG4gcmVsYXRlZCBvbmVzXG4gICAgICAgIGVsZW1lbnQuYXR0cnMgPSBhdHRycztcbiAgICAgIH1cbiAgICB9XG4gICAgaHRtbC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuLCBtZXNzYWdlKTtcbiAgICByZXR1cm4gZWxlbWVudDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24sIGN1cnJlbnRNZXNzYWdlOiBpMThuLk1lc3NhZ2V8bnVsbCk6IGFueSB7XG4gICAgbGV0IG1lc3NhZ2U7XG4gICAgY29uc3QgbWV0YSA9IGV4cGFuc2lvbi5pMThuO1xuICAgIHRoaXMuaGFzSTE4bk1ldGEgPSB0cnVlO1xuICAgIGlmIChtZXRhIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlcikge1xuICAgICAgLy8gc2V0IElDVSBwbGFjZWhvbGRlciBuYW1lIChlLmcuIFwiSUNVXzFcIiksXG4gICAgICAvLyBnZW5lcmF0ZWQgd2hpbGUgcHJvY2Vzc2luZyByb290IGVsZW1lbnQgY29udGVudHMsXG4gICAgICAvLyBzbyB3ZSBjYW4gcmVmZXJlbmNlIGl0IHdoZW4gd2Ugb3V0cHV0IHRyYW5zbGF0aW9uXG4gICAgICBjb25zdCBuYW1lID0gbWV0YS5uYW1lO1xuICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2V4cGFuc2lvbl0sIG1ldGEpO1xuICAgICAgY29uc3QgaWN1ID0gaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgaWN1Lm5hbWUgPSBuYW1lO1xuICAgICAgaWYgKGN1cnJlbnRNZXNzYWdlICE9PSBudWxsKSB7XG4gICAgICAgIC8vIEFsc28gdXBkYXRlIHRoZSBwbGFjZWhvbGRlclRvTWVzc2FnZSBtYXAgd2l0aCB0aGlzIG5ldyBtZXNzYWdlXG4gICAgICAgIGN1cnJlbnRNZXNzYWdlLnBsYWNlaG9sZGVyVG9NZXNzYWdlW25hbWVdID0gbWVzc2FnZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSUNVIGlzIGEgdG9wIGxldmVsIG1lc3NhZ2UsIHRyeSB0byB1c2UgbWV0YWRhdGEgZnJvbSBjb250YWluZXIgZWxlbWVudCBpZiBwcm92aWRlZCB2aWFcbiAgICAgIC8vIGBjb250ZXh0YCBhcmd1bWVudC4gTm90ZTogY29udGV4dCBtYXkgbm90IGJlIGF2YWlsYWJsZSBmb3Igc3RhbmRhbG9uZSBJQ1VzICh3aXRob3V0XG4gICAgICAvLyB3cmFwcGluZyBlbGVtZW50KSwgc28gZmFsbGJhY2sgdG8gSUNVIG1ldGFkYXRhIGluIHRoaXMgY2FzZS5cbiAgICAgIG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFtleHBhbnNpb25dLCBjdXJyZW50TWVzc2FnZSB8fCBtZXRhKTtcbiAgICB9XG4gICAgZXhwYW5zaW9uLmkxOG4gPSBtZXNzYWdlO1xuICAgIHJldHVybiBleHBhbnNpb247XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0KTogYW55IHtcbiAgICByZXR1cm4gdGV4dDtcbiAgfVxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogYW55IHtcbiAgICByZXR1cm4gYXR0cmlidXRlO1xuICB9XG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBhbnkge1xuICAgIHJldHVybiBjb21tZW50O1xuICB9XG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UpOiBhbnkge1xuICAgIHJldHVybiBleHBhbnNpb25DYXNlO1xuICB9XG5cbiAgdmlzaXRCbG9jayhibG9jazogaHRtbC5CbG9jaywgY29udGV4dDogYW55KSB7XG4gICAgaHRtbC52aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbiwgY29udGV4dCk7XG4gICAgcmV0dXJuIGJsb2NrO1xuICB9XG5cbiAgdmlzaXRCbG9ja1BhcmFtZXRlcihwYXJhbWV0ZXI6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGNvbnRleHQ6IGFueSkge1xuICAgIHJldHVybiBwYXJhbWV0ZXI7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgdGhlIGdlbmVyYWwgZm9ybSBgbWV0YWAgcGFzc2VkIGludG8gZXh0cmFjdCB0aGUgZXhwbGljaXQgbWV0YWRhdGEgbmVlZGVkIHRvIGNyZWF0ZSBhXG4gICAqIGBNZXNzYWdlYC5cbiAgICpcbiAgICogVGhlcmUgYXJlIHRocmVlIHBvc3NpYmlsaXRpZXMgZm9yIHRoZSBgbWV0YWAgdmFyaWFibGVcbiAgICogMSkgYSBzdHJpbmcgZnJvbSBhbiBgaTE4bmAgdGVtcGxhdGUgYXR0cmlidXRlOiBwYXJzZSBpdCB0byBleHRyYWN0IHRoZSBtZXRhZGF0YSB2YWx1ZXMuXG4gICAqIDIpIGEgYE1lc3NhZ2VgIGZyb20gYSBwcmV2aW91cyBwcm9jZXNzaW5nIHBhc3M6IHJldXNlIHRoZSBtZXRhZGF0YSB2YWx1ZXMgaW4gdGhlIG1lc3NhZ2UuXG4gICAqIDQpIG90aGVyOiBpZ25vcmUgdGhpcyBhbmQganVzdCBwcm9jZXNzIHRoZSBtZXNzYWdlIG1ldGFkYXRhIGFzIG5vcm1hbFxuICAgKlxuICAgKiBAcGFyYW0gbWV0YSB0aGUgYnVja2V0IHRoYXQgaG9sZHMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1lc3NhZ2VcbiAgICogQHJldHVybnMgdGhlIHBhcnNlZCBtZXRhZGF0YS5cbiAgICovXG4gIHByaXZhdGUgX3BhcnNlTWV0YWRhdGEobWV0YTogc3RyaW5nfGkxOG4uSTE4bk1ldGEpOiBJMThuTWV0YSB7XG4gICAgcmV0dXJuIHR5cGVvZiBtZXRhID09PSAnc3RyaW5nJyAgPyBwYXJzZUkxOG5NZXRhKG1ldGEpIDpcbiAgICAgICAgbWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSA/IG1ldGEgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge307XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgKG9yIHJlc3RvcmUpIG1lc3NhZ2UgaWQgaWYgbm90IHNwZWNpZmllZCBhbHJlYWR5LlxuICAgKi9cbiAgcHJpdmF0ZSBfc2V0TWVzc2FnZUlkKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgbWV0YTogc3RyaW5nfGkxOG4uSTE4bk1ldGEpOiB2b2lkIHtcbiAgICBpZiAoIW1lc3NhZ2UuaWQpIHtcbiAgICAgIG1lc3NhZ2UuaWQgPSBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlICYmIG1ldGEuaWQgfHwgZGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBgbWVzc2FnZWAgd2l0aCBhIGBsZWdhY3lJZGAgaWYgbmVjZXNzYXJ5LlxuICAgKlxuICAgKiBAcGFyYW0gbWVzc2FnZSB0aGUgbWVzc2FnZSB3aG9zZSBsZWdhY3kgaWQgc2hvdWxkIGJlIHNldFxuICAgKiBAcGFyYW0gbWV0YSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbWVzc2FnZSBiZWluZyBwcm9jZXNzZWRcbiAgICovXG4gIHByaXZhdGUgX3NldExlZ2FjeUlkcyhtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIG1ldGE6IHN0cmluZ3xpMThuLkkxOG5NZXRhKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCkge1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZHMgPSBbY29tcHV0ZURpZ2VzdChtZXNzYWdlKSwgY29tcHV0ZURlY2ltYWxEaWdlc3QobWVzc2FnZSldO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1ldGEgIT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBUaGlzIG9jY3VycyBpZiB3ZSBhcmUgZG9pbmcgdGhlIDJuZCBwYXNzIGFmdGVyIHdoaXRlc3BhY2UgcmVtb3ZhbCAoc2VlIGBwYXJzZVRlbXBsYXRlKClgIGluXG4gICAgICAvLyBgcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90ZW1wbGF0ZS50c2ApLlxuICAgICAgLy8gSW4gdGhhdCBjYXNlIHdlIHdhbnQgdG8gcmV1c2UgdGhlIGxlZ2FjeSBtZXNzYWdlIGdlbmVyYXRlZCBpbiB0aGUgMXN0IHBhc3MgKHNlZVxuICAgICAgLy8gYHNldEkxOG5SZWZzKClgKS5cbiAgICAgIGNvbnN0IHByZXZpb3VzTWVzc2FnZSA9IG1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgPyBtZXRhIDpcbiAgICAgICAgICBtZXRhIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlciAgICAgICAgICAgICAgPyBtZXRhLnByZXZpb3VzTWVzc2FnZSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkO1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZHMgPSBwcmV2aW91c01lc3NhZ2UgPyBwcmV2aW91c01lc3NhZ2UubGVnYWN5SWRzIDogW107XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3Iobm9kZTogaHRtbC5Ob2RlLCBtc2c6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuX2Vycm9ycy5wdXNoKG5ldyBJMThuRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCBtc2cpKTtcbiAgfVxufVxuXG4vKiogSTE4biBzZXBhcmF0b3JzIGZvciBtZXRhZGF0YSAqKi9cbmNvbnN0IEkxOE5fTUVBTklOR19TRVBBUkFUT1IgPSAnfCc7XG5jb25zdCBJMThOX0lEX1NFUEFSQVRPUiA9ICdAQCc7XG5cbi8qKlxuICogUGFyc2VzIGkxOG4gbWV0YXMgbGlrZTpcbiAqICAtIFwiQEBpZFwiLFxuICogIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuICogIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbiAqIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHBhcnNlZCBvdXRwdXQuXG4gKlxuICogQHBhcmFtIG1ldGEgU3RyaW5nIHRoYXQgcmVwcmVzZW50cyBpMThuIG1ldGFcbiAqIEByZXR1cm5zIE9iamVjdCB3aXRoIGlkLCBtZWFuaW5nIGFuZCBkZXNjcmlwdGlvbiBmaWVsZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEobWV0YTogc3RyaW5nID0gJycpOiBJMThuTWV0YSB7XG4gIGxldCBjdXN0b21JZDogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZDtcblxuICBtZXRhID0gbWV0YS50cmltKCk7XG4gIGlmIChtZXRhKSB7XG4gICAgY29uc3QgaWRJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX0lEX1NFUEFSQVRPUik7XG4gICAgY29uc3QgZGVzY0luZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgY3VzdG9tSWRdID1cbiAgICAgICAgKGlkSW5kZXggPiAtMSkgPyBbbWV0YS5zbGljZSgwLCBpZEluZGV4KSwgbWV0YS5zbGljZShpZEluZGV4ICsgMildIDogW21ldGEsICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID0gKGRlc2NJbmRleCA+IC0xKSA/XG4gICAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgICBbJycsIG1lYW5pbmdBbmREZXNjXTtcbiAgfVxuXG4gIHJldHVybiB7Y3VzdG9tSWQsIG1lYW5pbmcsIGRlc2NyaXB0aW9ufTtcbn1cblxuLy8gQ29udmVydHMgaTE4biBtZXRhIGluZm9ybWF0aW9uIGZvciBhIG1lc3NhZ2UgKGlkLCBkZXNjcmlwdGlvbiwgbWVhbmluZylcbi8vIHRvIGEgSnNEb2Mgc3RhdGVtZW50IGZvcm1hdHRlZCBhcyBleHBlY3RlZCBieSB0aGUgQ2xvc3VyZSBjb21waWxlci5cbmV4cG9ydCBmdW5jdGlvbiBpMThuTWV0YVRvSlNEb2MobWV0YTogSTE4bk1ldGEpOiBvLkpTRG9jQ29tbWVudCB7XG4gIGNvbnN0IHRhZ3M6IG8uSlNEb2NUYWdbXSA9IFtdO1xuICBpZiAobWV0YS5kZXNjcmlwdGlvbikge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuRGVzYywgdGV4dDogbWV0YS5kZXNjcmlwdGlvbn0pO1xuICB9IGVsc2Uge1xuICAgIC8vIFN1cHByZXNzIHRoZSBKU0NvbXBpbGVyIHdhcm5pbmcgdGhhdCBhIGBAZGVzY2Agd2FzIG5vdCBnaXZlbiBmb3IgdGhpcyBtZXNzYWdlLlxuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuU3VwcHJlc3MsIHRleHQ6ICd7bXNnRGVzY3JpcHRpb25zfSd9KTtcbiAgfVxuICBpZiAobWV0YS5tZWFuaW5nKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5NZWFuaW5nLCB0ZXh0OiBtZXRhLm1lYW5pbmd9KTtcbiAgfVxuICByZXR1cm4gby5qc0RvY0NvbW1lbnQodGFncyk7XG59XG4iXX0=