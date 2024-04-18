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
import { DEFAULT_CONTAINER_BLOCKS, DEFAULT_INTERPOLATION_CONFIG, } from '../../../ml_parser/defaults';
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
    constructor(interpolationConfig = DEFAULT_INTERPOLATION_CONFIG, keepI18nAttrs = false, enableI18nLegacyMessageIdFormat = false, containerBlocks = DEFAULT_CONTAINER_BLOCKS) {
        this.interpolationConfig = interpolationConfig;
        this.keepI18nAttrs = keepI18nAttrs;
        this.enableI18nLegacyMessageIdFormat = enableI18nLegacyMessageIdFormat;
        this.containerBlocks = containerBlocks;
        // whether visited nodes contain i18n information
        this.hasI18nMeta = false;
        this._errors = [];
    }
    _generateI18nMessage(nodes, meta = '', visitNodeFn) {
        const { meaning, description, customId } = this._parseMetadata(meta);
        const createI18nMessage = createI18nMessageFactory(this.interpolationConfig, this.containerBlocks);
        const message = createI18nMessage(nodes, meaning, description, customId, visitNodeFn);
        this._setMessageId(message, meta);
        this._setLegacyIds(message, meta);
        return message;
    }
    visitAllWithErrors(nodes) {
        const result = nodes.map((node) => node.visit(this, null));
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
        return typeof meta === 'string'
            ? parseI18nMeta(meta)
            : meta instanceof i18n.Message
                ? meta
                : {};
    }
    /**
     * Generate (or restore) message id if not specified already.
     */
    _setMessageId(message, meta) {
        if (!message.id) {
            message.id = (meta instanceof i18n.Message && meta.id) || decimalDigest(message);
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
            const previousMessage = meta instanceof i18n.Message
                ? meta
                : meta instanceof i18n.IcuPlaceholder
                    ? meta.previousMessage
                    : undefined;
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
            idIndex > -1 ? [meta.slice(0, idIndex), meta.slice(idIndex + 2)] : [meta, ''];
        [meaning, description] =
            descIndex > -1
                ? [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)]
                : ['', meaningAndDesc];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDeEYsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsd0JBQXdCLEVBQWMsTUFBTSwyQkFBMkIsQ0FBQztBQUNoRixPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDbkQsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQ0wsd0JBQXdCLEVBQ3hCLDRCQUE0QixHQUU3QixNQUFNLDZCQUE2QixDQUFDO0FBQ3JDLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMxRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ2hELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBRXZFLE9BQU8sRUFBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBVXJGLE1BQU0sV0FBVyxHQUFnQixDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsRUFBRTtJQUN0RCxJQUFJLFFBQVEsWUFBWSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDMUMsSUFBSSxRQUFRLFlBQVksSUFBSSxDQUFDLGNBQWMsSUFBSSxRQUFRLENBQUMsSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNyRiwyRkFBMkY7WUFDM0Ysb0ZBQW9GO1lBQ3BGLDJGQUEyRjtZQUMzRiwyRUFBMkU7WUFD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QzNFLENBQUM7SUFDRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUMsT0FBTyx3Q0FBd0IsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y29tcHV0ZURlY2ltYWxEaWdlc3QsIGNvbXB1dGVEaWdlc3QsIGRlY2ltYWxEaWdlc3R9IGZyb20gJy4uLy4uLy4uL2kxOG4vZGlnZXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge2NyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeSwgVmlzaXROb2RlRm59IGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9wYXJzZXInO1xuaW1wb3J0IHtJMThuRXJyb3J9IGZyb20gJy4uLy4uLy4uL2kxOG4vcGFyc2VfdXRpbCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtcbiAgREVGQVVMVF9DT05UQUlORVJfQkxPQ0tTLFxuICBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICBJbnRlcnBvbGF0aW9uQ29uZmlnLFxufSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvZGVmYXVsdHMnO1xuaW1wb3J0IHtQYXJzZVRyZWVSZXN1bHR9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2lzVHJ1c3RlZFR5cGVzU2lua30gZnJvbSAnLi4vLi4vLi4vc2NoZW1hL3RydXN0ZWRfdHlwZXNfc2lua3MnO1xuXG5pbXBvcnQge2hhc0kxOG5BdHRycywgSTE4Tl9BVFRSLCBJMThOX0FUVFJfUFJFRklYLCBpY3VGcm9tSTE4bk1lc3NhZ2V9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCB0eXBlIEkxOG5NZXRhID0ge1xuICBpZD86IHN0cmluZztcbiAgY3VzdG9tSWQ/OiBzdHJpbmc7XG4gIGxlZ2FjeUlkcz86IHN0cmluZ1tdO1xuICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgbWVhbmluZz86IHN0cmluZztcbn07XG5cbmNvbnN0IHNldEkxOG5SZWZzOiBWaXNpdE5vZGVGbiA9IChodG1sTm9kZSwgaTE4bk5vZGUpID0+IHtcbiAgaWYgKGh0bWxOb2RlIGluc3RhbmNlb2YgaHRtbC5Ob2RlV2l0aEkxOG4pIHtcbiAgICBpZiAoaTE4bk5vZGUgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyICYmIGh0bWxOb2RlLmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICAgIC8vIFRoaXMgaHRtbCBub2RlIHJlcHJlc2VudHMgYW4gSUNVIGJ1dCB0aGlzIGlzIGEgc2Vjb25kIHByb2Nlc3NpbmcgcGFzcywgYW5kIHRoZSBsZWdhY3kgaWRcbiAgICAgIC8vIHdhcyBjb21wdXRlZCBpbiB0aGUgcHJldmlvdXMgcGFzcyBhbmQgc3RvcmVkIGluIHRoZSBgaTE4bmAgcHJvcGVydHkgYXMgYSBtZXNzYWdlLlxuICAgICAgLy8gV2UgYXJlIGFib3V0IHRvIHdpcGUgb3V0IHRoYXQgcHJvcGVydHkgc28gY2FwdHVyZSB0aGUgcHJldmlvdXMgbWVzc2FnZSB0byBiZSByZXVzZWQgd2hlblxuICAgICAgLy8gZ2VuZXJhdGluZyB0aGUgbWVzc2FnZSBmb3IgdGhpcyBJQ1UgbGF0ZXIuIFNlZSBgX2dlbmVyYXRlSTE4bk1lc3NhZ2UoKWAuXG4gICAgICBpMThuTm9kZS5wcmV2aW91c01lc3NhZ2UgPSBodG1sTm9kZS5pMThuO1xuICAgIH1cbiAgICBodG1sTm9kZS5pMThuID0gaTE4bk5vZGU7XG4gIH1cbiAgcmV0dXJuIGkxOG5Ob2RlO1xufTtcblxuLyoqXG4gKiBUaGlzIHZpc2l0b3Igd2Fsa3Mgb3ZlciBIVE1MIHBhcnNlIHRyZWUgYW5kIGNvbnZlcnRzIGluZm9ybWF0aW9uIHN0b3JlZCBpblxuICogaTE4bi1yZWxhdGVkIGF0dHJpYnV0ZXMgKFwiaTE4blwiIGFuZCBcImkxOG4tKlwiKSBpbnRvIGkxOG4gbWV0YSBvYmplY3QgdGhhdCBpc1xuICogc3RvcmVkIHdpdGggb3RoZXIgZWxlbWVudCdzIGFuZCBhdHRyaWJ1dGUncyBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIEkxOG5NZXRhVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIC8vIHdoZXRoZXIgdmlzaXRlZCBub2RlcyBjb250YWluIGkxOG4gaW5mb3JtYXRpb25cbiAgcHVibGljIGhhc0kxOG5NZXRhOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgX2Vycm9yczogSTE4bkVycm9yW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgIHByaXZhdGUga2VlcEkxOG5BdHRycyA9IGZhbHNlLFxuICAgIHByaXZhdGUgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9IGZhbHNlLFxuICAgIHByaXZhdGUgY29udGFpbmVyQmxvY2tzOiBTZXQ8c3RyaW5nPiA9IERFRkFVTFRfQ09OVEFJTkVSX0JMT0NLUyxcbiAgKSB7fVxuXG4gIHByaXZhdGUgX2dlbmVyYXRlSTE4bk1lc3NhZ2UoXG4gICAgbm9kZXM6IGh0bWwuTm9kZVtdLFxuICAgIG1ldGE6IHN0cmluZyB8IGkxOG4uSTE4bk1ldGEgPSAnJyxcbiAgICB2aXNpdE5vZGVGbj86IFZpc2l0Tm9kZUZuLFxuICApOiBpMThuLk1lc3NhZ2Uge1xuICAgIGNvbnN0IHttZWFuaW5nLCBkZXNjcmlwdGlvbiwgY3VzdG9tSWR9ID0gdGhpcy5fcGFyc2VNZXRhZGF0YShtZXRhKTtcbiAgICBjb25zdCBjcmVhdGVJMThuTWVzc2FnZSA9IGNyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeShcbiAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkNvbmZpZyxcbiAgICAgIHRoaXMuY29udGFpbmVyQmxvY2tzLFxuICAgICk7XG4gICAgY29uc3QgbWVzc2FnZSA9IGNyZWF0ZUkxOG5NZXNzYWdlKG5vZGVzLCBtZWFuaW5nLCBkZXNjcmlwdGlvbiwgY3VzdG9tSWQsIHZpc2l0Tm9kZUZuKTtcbiAgICB0aGlzLl9zZXRNZXNzYWdlSWQobWVzc2FnZSwgbWV0YSk7XG4gICAgdGhpcy5fc2V0TGVnYWN5SWRzKG1lc3NhZ2UsIG1ldGEpO1xuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgdmlzaXRBbGxXaXRoRXJyb3JzKG5vZGVzOiBodG1sLk5vZGVbXSk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gICAgY29uc3QgcmVzdWx0ID0gbm9kZXMubWFwKChub2RlKSA9PiBub2RlLnZpc2l0KHRoaXMsIG51bGwpKTtcbiAgICByZXR1cm4gbmV3IFBhcnNlVHJlZVJlc3VsdChyZXN1bHQsIHRoaXMuX2Vycm9ycyk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogaHRtbC5FbGVtZW50KTogYW55IHtcbiAgICBsZXQgbWVzc2FnZTogaTE4bi5NZXNzYWdlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKGhhc0kxOG5BdHRycyhlbGVtZW50KSkge1xuICAgICAgdGhpcy5oYXNJMThuTWV0YSA9IHRydWU7XG4gICAgICBjb25zdCBhdHRyczogaHRtbC5BdHRyaWJ1dGVbXSA9IFtdO1xuICAgICAgY29uc3QgYXR0cnNNZXRhOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRycykge1xuICAgICAgICBpZiAoYXR0ci5uYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgICAvLyByb290ICdpMThuJyBub2RlIGF0dHJpYnV0ZVxuICAgICAgICAgIGNvbnN0IGkxOG4gPSBlbGVtZW50LmkxOG4gfHwgYXR0ci52YWx1ZTtcbiAgICAgICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShlbGVtZW50LmNoaWxkcmVuLCBpMThuLCBzZXRJMThuUmVmcyk7XG4gICAgICAgICAgaWYgKG1lc3NhZ2Uubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvLyBJZ25vcmUgdGhlIG1lc3NhZ2UgaWYgaXQgaXMgZW1wdHkuXG4gICAgICAgICAgICBtZXNzYWdlID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTdG9yZSB0aGUgbWVzc2FnZSBvbiB0aGUgZWxlbWVudFxuICAgICAgICAgIGVsZW1lbnQuaTE4biA9IG1lc3NhZ2U7XG4gICAgICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgICAvLyAnaTE4bi0qJyBhdHRyaWJ1dGVzXG4gICAgICAgICAgY29uc3QgbmFtZSA9IGF0dHIubmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICAgICAgaWYgKGlzVHJ1c3RlZFR5cGVzU2luayhlbGVtZW50Lm5hbWUsIG5hbWUpKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYXR0cixcbiAgICAgICAgICAgICAgYFRyYW5zbGF0aW5nIGF0dHJpYnV0ZSAnJHtuYW1lfScgaXMgZGlzYWxsb3dlZCBmb3Igc2VjdXJpdHkgcmVhc29ucy5gLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cnNNZXRhW25hbWVdID0gYXR0ci52YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbm9uLWkxOG4gYXR0cmlidXRlc1xuICAgICAgICAgIGF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc2V0IGkxOG4gbWV0YSBmb3IgYXR0cmlidXRlc1xuICAgICAgaWYgKE9iamVjdC5rZXlzKGF0dHJzTWV0YSkubGVuZ3RoKSB7XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBhdHRycykge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBhdHRyc01ldGFbYXR0ci5uYW1lXTtcbiAgICAgICAgICAvLyBkbyBub3QgY3JlYXRlIHRyYW5zbGF0aW9uIGZvciBlbXB0eSBhdHRyaWJ1dGVzXG4gICAgICAgICAgaWYgKG1ldGEgIT09IHVuZGVmaW5lZCAmJiBhdHRyLnZhbHVlKSB7XG4gICAgICAgICAgICBhdHRyLmkxOG4gPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFthdHRyXSwgYXR0ci5pMThuIHx8IG1ldGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMua2VlcEkxOG5BdHRycykge1xuICAgICAgICAvLyB1cGRhdGUgZWxlbWVudCdzIGF0dHJpYnV0ZXMsXG4gICAgICAgIC8vIGtlZXBpbmcgb25seSBub24taTE4biByZWxhdGVkIG9uZXNcbiAgICAgICAgZWxlbWVudC5hdHRycyA9IGF0dHJzO1xuICAgICAgfVxuICAgIH1cbiAgICBodG1sLnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4sIG1lc3NhZ2UpO1xuICAgIHJldHVybiBlbGVtZW50O1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbiwgY3VycmVudE1lc3NhZ2U6IGkxOG4uTWVzc2FnZSB8IG51bGwpOiBhbnkge1xuICAgIGxldCBtZXNzYWdlO1xuICAgIGNvbnN0IG1ldGEgPSBleHBhbnNpb24uaTE4bjtcbiAgICB0aGlzLmhhc0kxOG5NZXRhID0gdHJ1ZTtcbiAgICBpZiAobWV0YSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXIpIHtcbiAgICAgIC8vIHNldCBJQ1UgcGxhY2Vob2xkZXIgbmFtZSAoZS5nLiBcIklDVV8xXCIpLFxuICAgICAgLy8gZ2VuZXJhdGVkIHdoaWxlIHByb2Nlc3Npbmcgcm9vdCBlbGVtZW50IGNvbnRlbnRzLFxuICAgICAgLy8gc28gd2UgY2FuIHJlZmVyZW5jZSBpdCB3aGVuIHdlIG91dHB1dCB0cmFuc2xhdGlvblxuICAgICAgY29uc3QgbmFtZSA9IG1ldGEubmFtZTtcbiAgICAgIG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFtleHBhbnNpb25dLCBtZXRhKTtcbiAgICAgIGNvbnN0IGljdSA9IGljdUZyb21JMThuTWVzc2FnZShtZXNzYWdlKTtcbiAgICAgIGljdS5uYW1lID0gbmFtZTtcbiAgICAgIGlmIChjdXJyZW50TWVzc2FnZSAhPT0gbnVsbCkge1xuICAgICAgICAvLyBBbHNvIHVwZGF0ZSB0aGUgcGxhY2Vob2xkZXJUb01lc3NhZ2UgbWFwIHdpdGggdGhpcyBuZXcgbWVzc2FnZVxuICAgICAgICBjdXJyZW50TWVzc2FnZS5wbGFjZWhvbGRlclRvTWVzc2FnZVtuYW1lXSA9IG1lc3NhZ2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElDVSBpcyBhIHRvcCBsZXZlbCBtZXNzYWdlLCB0cnkgdG8gdXNlIG1ldGFkYXRhIGZyb20gY29udGFpbmVyIGVsZW1lbnQgaWYgcHJvdmlkZWQgdmlhXG4gICAgICAvLyBgY29udGV4dGAgYXJndW1lbnQuIE5vdGU6IGNvbnRleHQgbWF5IG5vdCBiZSBhdmFpbGFibGUgZm9yIHN0YW5kYWxvbmUgSUNVcyAod2l0aG91dFxuICAgICAgLy8gd3JhcHBpbmcgZWxlbWVudCksIHNvIGZhbGxiYWNrIHRvIElDVSBtZXRhZGF0YSBpbiB0aGlzIGNhc2UuXG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgY3VycmVudE1lc3NhZ2UgfHwgbWV0YSk7XG4gICAgfVxuICAgIGV4cGFuc2lvbi5pMThuID0gbWVzc2FnZTtcbiAgICByZXR1cm4gZXhwYW5zaW9uO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIHRleHQ7XG4gIH1cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSk6IGFueSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZTtcbiAgfVxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogYW55IHtcbiAgICByZXR1cm4gY29tbWVudDtcbiAgfVxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlKTogYW55IHtcbiAgICByZXR1cm4gZXhwYW5zaW9uQ2FzZTtcbiAgfVxuXG4gIHZpc2l0QmxvY2soYmxvY2s6IGh0bWwuQmxvY2ssIGNvbnRleHQ6IGFueSkge1xuICAgIGh0bWwudmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4sIGNvbnRleHQpO1xuICAgIHJldHVybiBibG9jaztcbiAgfVxuXG4gIHZpc2l0QmxvY2tQYXJhbWV0ZXIocGFyYW1ldGVyOiBodG1sLkJsb2NrUGFyYW1ldGVyLCBjb250ZXh0OiBhbnkpIHtcbiAgICByZXR1cm4gcGFyYW1ldGVyO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHRoZSBnZW5lcmFsIGZvcm0gYG1ldGFgIHBhc3NlZCBpbnRvIGV4dHJhY3QgdGhlIGV4cGxpY2l0IG1ldGFkYXRhIG5lZWRlZCB0byBjcmVhdGUgYVxuICAgKiBgTWVzc2FnZWAuXG4gICAqXG4gICAqIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJpbGl0aWVzIGZvciB0aGUgYG1ldGFgIHZhcmlhYmxlXG4gICAqIDEpIGEgc3RyaW5nIGZyb20gYW4gYGkxOG5gIHRlbXBsYXRlIGF0dHJpYnV0ZTogcGFyc2UgaXQgdG8gZXh0cmFjdCB0aGUgbWV0YWRhdGEgdmFsdWVzLlxuICAgKiAyKSBhIGBNZXNzYWdlYCBmcm9tIGEgcHJldmlvdXMgcHJvY2Vzc2luZyBwYXNzOiByZXVzZSB0aGUgbWV0YWRhdGEgdmFsdWVzIGluIHRoZSBtZXNzYWdlLlxuICAgKiA0KSBvdGhlcjogaWdub3JlIHRoaXMgYW5kIGp1c3QgcHJvY2VzcyB0aGUgbWVzc2FnZSBtZXRhZGF0YSBhcyBub3JtYWxcbiAgICpcbiAgICogQHBhcmFtIG1ldGEgdGhlIGJ1Y2tldCB0aGF0IGhvbGRzIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtZXNzYWdlXG4gICAqIEByZXR1cm5zIHRoZSBwYXJzZWQgbWV0YWRhdGEuXG4gICAqL1xuICBwcml2YXRlIF9wYXJzZU1ldGFkYXRhKG1ldGE6IHN0cmluZyB8IGkxOG4uSTE4bk1ldGEpOiBJMThuTWV0YSB7XG4gICAgcmV0dXJuIHR5cGVvZiBtZXRhID09PSAnc3RyaW5nJ1xuICAgICAgPyBwYXJzZUkxOG5NZXRhKG1ldGEpXG4gICAgICA6IG1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2VcbiAgICAgICAgPyBtZXRhXG4gICAgICAgIDoge307XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgKG9yIHJlc3RvcmUpIG1lc3NhZ2UgaWQgaWYgbm90IHNwZWNpZmllZCBhbHJlYWR5LlxuICAgKi9cbiAgcHJpdmF0ZSBfc2V0TWVzc2FnZUlkKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgbWV0YTogc3RyaW5nIHwgaTE4bi5JMThuTWV0YSk6IHZvaWQge1xuICAgIGlmICghbWVzc2FnZS5pZCkge1xuICAgICAgbWVzc2FnZS5pZCA9IChtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlICYmIG1ldGEuaWQpIHx8IGRlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgYG1lc3NhZ2VgIHdpdGggYSBgbGVnYWN5SWRgIGlmIG5lY2Vzc2FyeS5cbiAgICpcbiAgICogQHBhcmFtIG1lc3NhZ2UgdGhlIG1lc3NhZ2Ugd2hvc2UgbGVnYWN5IGlkIHNob3VsZCBiZSBzZXRcbiAgICogQHBhcmFtIG1ldGEgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1lc3NhZ2UgYmVpbmcgcHJvY2Vzc2VkXG4gICAqL1xuICBwcml2YXRlIF9zZXRMZWdhY3lJZHMobWVzc2FnZTogaTE4bi5NZXNzYWdlLCBtZXRhOiBzdHJpbmcgfCBpMThuLkkxOG5NZXRhKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCkge1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZHMgPSBbY29tcHV0ZURpZ2VzdChtZXNzYWdlKSwgY29tcHV0ZURlY2ltYWxEaWdlc3QobWVzc2FnZSldO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1ldGEgIT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBUaGlzIG9jY3VycyBpZiB3ZSBhcmUgZG9pbmcgdGhlIDJuZCBwYXNzIGFmdGVyIHdoaXRlc3BhY2UgcmVtb3ZhbCAoc2VlIGBwYXJzZVRlbXBsYXRlKClgIGluXG4gICAgICAvLyBgcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90ZW1wbGF0ZS50c2ApLlxuICAgICAgLy8gSW4gdGhhdCBjYXNlIHdlIHdhbnQgdG8gcmV1c2UgdGhlIGxlZ2FjeSBtZXNzYWdlIGdlbmVyYXRlZCBpbiB0aGUgMXN0IHBhc3MgKHNlZVxuICAgICAgLy8gYHNldEkxOG5SZWZzKClgKS5cbiAgICAgIGNvbnN0IHByZXZpb3VzTWVzc2FnZSA9XG4gICAgICAgIG1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2VcbiAgICAgICAgICA/IG1ldGFcbiAgICAgICAgICA6IG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyXG4gICAgICAgICAgICA/IG1ldGEucHJldmlvdXNNZXNzYWdlXG4gICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWRzID0gcHJldmlvdXNNZXNzYWdlID8gcHJldmlvdXNNZXNzYWdlLmxlZ2FjeUlkcyA6IFtdO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3JlcG9ydEVycm9yKG5vZGU6IGh0bWwuTm9kZSwgbXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLl9lcnJvcnMucHVzaChuZXcgSTE4bkVycm9yKG5vZGUuc291cmNlU3BhbiwgbXNnKSk7XG4gIH1cbn1cblxuLyoqIEkxOG4gc2VwYXJhdG9ycyBmb3IgbWV0YWRhdGEgKiovXG5jb25zdCBJMThOX01FQU5JTkdfU0VQQVJBVE9SID0gJ3wnO1xuY29uc3QgSTE4Tl9JRF9TRVBBUkFUT1IgPSAnQEAnO1xuXG4vKipcbiAqIFBhcnNlcyBpMThuIG1ldGFzIGxpa2U6XG4gKiAgLSBcIkBAaWRcIixcbiAqICAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbiAqICAtIFwibWVhbmluZ3xkZXNjcmlwdGlvbltAQGlkXVwiXG4gKiBhbmQgcmV0dXJucyBhbiBvYmplY3Qgd2l0aCBwYXJzZWQgb3V0cHV0LlxuICpcbiAqIEBwYXJhbSBtZXRhIFN0cmluZyB0aGF0IHJlcHJlc2VudHMgaTE4biBtZXRhXG4gKiBAcmV0dXJucyBPYmplY3Qgd2l0aCBpZCwgbWVhbmluZyBhbmQgZGVzY3JpcHRpb24gZmllbGRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUkxOG5NZXRhKG1ldGE6IHN0cmluZyA9ICcnKTogSTE4bk1ldGEge1xuICBsZXQgY3VzdG9tSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgbWV0YSA9IG1ldGEudHJpbSgpO1xuICBpZiAobWV0YSkge1xuICAgIGNvbnN0IGlkSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9JRF9TRVBBUkFUT1IpO1xuICAgIGNvbnN0IGRlc2NJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX01FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGN1c3RvbUlkXSA9XG4gICAgICBpZEluZGV4ID4gLTEgPyBbbWV0YS5zbGljZSgwLCBpZEluZGV4KSwgbWV0YS5zbGljZShpZEluZGV4ICsgMildIDogW21ldGEsICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID1cbiAgICAgIGRlc2NJbmRleCA+IC0xXG4gICAgICAgID8gW21lYW5pbmdBbmREZXNjLnNsaWNlKDAsIGRlc2NJbmRleCksIG1lYW5pbmdBbmREZXNjLnNsaWNlKGRlc2NJbmRleCArIDEpXVxuICAgICAgICA6IFsnJywgbWVhbmluZ0FuZERlc2NdO1xuICB9XG5cbiAgcmV0dXJuIHtjdXN0b21JZCwgbWVhbmluZywgZGVzY3JpcHRpb259O1xufVxuXG4vLyBDb252ZXJ0cyBpMThuIG1ldGEgaW5mb3JtYXRpb24gZm9yIGEgbWVzc2FnZSAoaWQsIGRlc2NyaXB0aW9uLCBtZWFuaW5nKVxuLy8gdG8gYSBKc0RvYyBzdGF0ZW1lbnQgZm9ybWF0dGVkIGFzIGV4cGVjdGVkIGJ5IHRoZSBDbG9zdXJlIGNvbXBpbGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGkxOG5NZXRhVG9KU0RvYyhtZXRhOiBJMThuTWV0YSk6IG8uSlNEb2NDb21tZW50IHtcbiAgY29uc3QgdGFnczogby5KU0RvY1RhZ1tdID0gW107XG4gIGlmIChtZXRhLmRlc2NyaXB0aW9uKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5EZXNjLCB0ZXh0OiBtZXRhLmRlc2NyaXB0aW9ufSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gU3VwcHJlc3MgdGhlIEpTQ29tcGlsZXIgd2FybmluZyB0aGF0IGEgYEBkZXNjYCB3YXMgbm90IGdpdmVuIGZvciB0aGlzIG1lc3NhZ2UuXG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5TdXBwcmVzcywgdGV4dDogJ3ttc2dEZXNjcmlwdGlvbnN9J30pO1xuICB9XG4gIGlmIChtZXRhLm1lYW5pbmcpIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLk1lYW5pbmcsIHRleHQ6IG1ldGEubWVhbmluZ30pO1xuICB9XG4gIHJldHVybiBvLmpzRG9jQ29tbWVudCh0YWdzKTtcbn1cbiJdfQ==