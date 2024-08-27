/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { WhitespaceVisitor, visitAllWithSiblings } from '../../../ml_parser/html_whitespaces';
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
const setI18nRefs = (originalNodeMap) => {
    return (trimmedNode, i18nNode) => {
        // We need to set i18n properties on the original, untrimmed AST nodes. The i18n nodes needs to
        // use the trimmed content for message IDs to make messages more stable to whitespace changes.
        // But we don't want to actually trim the content, so we can't use the trimmed HTML AST for
        // general code gen. Instead we map the trimmed HTML AST back to the original AST and then
        // attach the i18n nodes so we get trimmed i18n nodes on the original (untrimmed) HTML AST.
        const originalNode = originalNodeMap.get(trimmedNode) ?? trimmedNode;
        if (originalNode instanceof html.NodeWithI18n) {
            if (i18nNode instanceof i18n.IcuPlaceholder && originalNode.i18n instanceof i18n.Message) {
                // This html node represents an ICU but this is a second processing pass, and the legacy id
                // was computed in the previous pass and stored in the `i18n` property as a message.
                // We are about to wipe out that property so capture the previous message to be reused when
                // generating the message for this ICU later. See `_generateI18nMessage()`.
                i18nNode.previousMessage = originalNode.i18n;
            }
            originalNode.i18n = i18nNode;
        }
        return i18nNode;
    };
};
/**
 * This visitor walks over HTML parse tree and converts information stored in
 * i18n-related attributes ("i18n" and "i18n-*") into i18n meta object that is
 * stored with other element's and attribute's information.
 */
export class I18nMetaVisitor {
    constructor(interpolationConfig = DEFAULT_INTERPOLATION_CONFIG, keepI18nAttrs = false, enableI18nLegacyMessageIdFormat = false, containerBlocks = DEFAULT_CONTAINER_BLOCKS, preserveSignificantWhitespace = true, 
    // When dropping significant whitespace we need to retain empty tokens or
    // else we won't be able to reuse source spans because empty tokens would be
    // removed and cause a mismatch. Unfortunately this still needs to be
    // configurable and sometimes needs to be set independently in order to make
    // sure the number of nodes don't change between parses, even when
    // `preserveSignificantWhitespace` changes.
    retainEmptyTokens = !preserveSignificantWhitespace) {
        this.interpolationConfig = interpolationConfig;
        this.keepI18nAttrs = keepI18nAttrs;
        this.enableI18nLegacyMessageIdFormat = enableI18nLegacyMessageIdFormat;
        this.containerBlocks = containerBlocks;
        this.preserveSignificantWhitespace = preserveSignificantWhitespace;
        this.retainEmptyTokens = retainEmptyTokens;
        // whether visited nodes contain i18n information
        this.hasI18nMeta = false;
        this._errors = [];
    }
    _generateI18nMessage(nodes, meta = '', visitNodeFn) {
        const { meaning, description, customId } = this._parseMetadata(meta);
        const createI18nMessage = createI18nMessageFactory(this.interpolationConfig, this.containerBlocks, this.retainEmptyTokens);
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
                    // Generate a new AST with whitespace trimmed, but also generate a map
                    // to correlate each new node to its original so we can apply i18n
                    // information to the original node based on the trimmed content.
                    //
                    // `WhitespaceVisitor` removes *insignificant* whitespace as well as
                    // significant whitespace. Enabling this visitor should be conditional
                    // on `preserveWhitespace` rather than `preserveSignificantWhitespace`,
                    // however this would be a breaking change for existing behavior where
                    // `preserveWhitespace` was not respected correctly when generating
                    // message IDs. This is really a bug but one we need to keep to maintain
                    // backwards compatibility.
                    const originalNodeMap = new Map();
                    const trimmedNodes = this.preserveSignificantWhitespace
                        ? element.children
                        : visitAllWithSiblings(new WhitespaceVisitor(false /* preserveSignificantWhitespace */, originalNodeMap), element.children);
                    message = this._generateI18nMessage(trimmedNodes, i18n, setI18nRefs(originalNodeMap));
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
    visitLetDeclaration(decl, context) {
        return decl;
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
            message.id =
                (meta instanceof i18n.Message && meta.id) ||
                    decimalDigest(message, /* preservePlaceholders */ this.preserveSignificantWhitespace);
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
            message.legacyIds = [
                computeDigest(message),
                computeDecimalDigest(message, 
                /* preservePlaceholders */ this.preserveSignificantWhitespace),
            ];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxvQkFBb0IsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBQzVGLE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDeEYsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsd0JBQXdCLEVBQWMsTUFBTSwyQkFBMkIsQ0FBQztBQUNoRixPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDbkQsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQ0wsd0JBQXdCLEVBQ3hCLDRCQUE0QixHQUU3QixNQUFNLDZCQUE2QixDQUFDO0FBQ3JDLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMxRCxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ2hELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBRXZFLE9BQU8sRUFBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBVXJGLE1BQU0sV0FBVyxHQUFHLENBQUMsZUFBMEMsRUFBZSxFQUFFO0lBQzlFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLEVBQUU7UUFDL0IsK0ZBQStGO1FBQy9GLDhGQUE4RjtRQUM5RiwyRkFBMkY7UUFDM0YsMEZBQTBGO1FBQzFGLDJGQUEyRjtRQUMzRixNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsR0FB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QUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sMENBQXlCLEVBQUUsSUFBSSxFQUFFLG1CQUFtQixFQUFDLENBQUMsQ0FBQztJQUMzRSxDQUFDO0lBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDakIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sd0NBQXdCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDOUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1doaXRlc3BhY2VWaXNpdG9yLCB2aXNpdEFsbFdpdGhTaWJsaW5nc30gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtjb21wdXRlRGVjaW1hbERpZ2VzdCwgY29tcHV0ZURpZ2VzdCwgZGVjaW1hbERpZ2VzdH0gZnJvbSAnLi4vLi4vLi4vaTE4bi9kaWdlc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7Y3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5LCBWaXNpdE5vZGVGbn0gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX3BhcnNlcic7XG5pbXBvcnQge0kxOG5FcnJvcn0gZnJvbSAnLi4vLi4vLi4vaTE4bi9wYXJzZV91dGlsJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge1xuICBERUZBVUxUX0NPTlRBSU5FUl9CTE9DS1MsXG4gIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gIEludGVycG9sYXRpb25Db25maWcsXG59IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9kZWZhdWx0cyc7XG5pbXBvcnQge1BhcnNlVHJlZVJlc3VsdH0gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7aXNUcnVzdGVkVHlwZXNTaW5rfSBmcm9tICcuLi8uLi8uLi9zY2hlbWEvdHJ1c3RlZF90eXBlc19zaW5rcyc7XG5cbmltcG9ydCB7aGFzSTE4bkF0dHJzLCBJMThOX0FUVFIsIEkxOE5fQVRUUl9QUkVGSVgsIGljdUZyb21JMThuTWVzc2FnZX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IHR5cGUgSTE4bk1ldGEgPSB7XG4gIGlkPzogc3RyaW5nO1xuICBjdXN0b21JZD86IHN0cmluZztcbiAgbGVnYWN5SWRzPzogc3RyaW5nW107XG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICBtZWFuaW5nPzogc3RyaW5nO1xufTtcblxuY29uc3Qgc2V0STE4blJlZnMgPSAob3JpZ2luYWxOb2RlTWFwOiBNYXA8aHRtbC5Ob2RlLCBodG1sLk5vZGU+KTogVmlzaXROb2RlRm4gPT4ge1xuICByZXR1cm4gKHRyaW1tZWROb2RlLCBpMThuTm9kZSkgPT4ge1xuICAgIC8vIFdlIG5lZWQgdG8gc2V0IGkxOG4gcHJvcGVydGllcyBvbiB0aGUgb3JpZ2luYWwsIHVudHJpbW1lZCBBU1Qgbm9kZXMuIFRoZSBpMThuIG5vZGVzIG5lZWRzIHRvXG4gICAgLy8gdXNlIHRoZSB0cmltbWVkIGNvbnRlbnQgZm9yIG1lc3NhZ2UgSURzIHRvIG1ha2UgbWVzc2FnZXMgbW9yZSBzdGFibGUgdG8gd2hpdGVzcGFjZSBjaGFuZ2VzLlxuICAgIC8vIEJ1dCB3ZSBkb24ndCB3YW50IHRvIGFjdHVhbGx5IHRyaW0gdGhlIGNvbnRlbnQsIHNvIHdlIGNhbid0IHVzZSB0aGUgdHJpbW1lZCBIVE1MIEFTVCBmb3JcbiAgICAvLyBnZW5lcmFsIGNvZGUgZ2VuLiBJbnN0ZWFkIHdlIG1hcCB0aGUgdHJpbW1lZCBIVE1MIEFTVCBiYWNrIHRvIHRoZSBvcmlnaW5hbCBBU1QgYW5kIHRoZW5cbiAgICAvLyBhdHRhY2ggdGhlIGkxOG4gbm9kZXMgc28gd2UgZ2V0IHRyaW1tZWQgaTE4biBub2RlcyBvbiB0aGUgb3JpZ2luYWwgKHVudHJpbW1lZCkgSFRNTCBBU1QuXG4gICAgY29uc3Qgb3JpZ2luYWxOb2RlID0gb3JpZ2luYWxOb2RlTWFwLmdldCh0cmltbWVkTm9kZSkgPz8gdHJpbW1lZE5vZGU7XG5cbiAgICBpZiAob3JpZ2luYWxOb2RlIGluc3RhbmNlb2YgaHRtbC5Ob2RlV2l0aEkxOG4pIHtcbiAgICAgIGlmIChpMThuTm9kZSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXIgJiYgb3JpZ2luYWxOb2RlLmkxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICAgICAgLy8gVGhpcyBodG1sIG5vZGUgcmVwcmVzZW50cyBhbiBJQ1UgYnV0IHRoaXMgaXMgYSBzZWNvbmQgcHJvY2Vzc2luZyBwYXNzLCBhbmQgdGhlIGxlZ2FjeSBpZFxuICAgICAgICAvLyB3YXMgY29tcHV0ZWQgaW4gdGhlIHByZXZpb3VzIHBhc3MgYW5kIHN0b3JlZCBpbiB0aGUgYGkxOG5gIHByb3BlcnR5IGFzIGEgbWVzc2FnZS5cbiAgICAgICAgLy8gV2UgYXJlIGFib3V0IHRvIHdpcGUgb3V0IHRoYXQgcHJvcGVydHkgc28gY2FwdHVyZSB0aGUgcHJldmlvdXMgbWVzc2FnZSB0byBiZSByZXVzZWQgd2hlblxuICAgICAgICAvLyBnZW5lcmF0aW5nIHRoZSBtZXNzYWdlIGZvciB0aGlzIElDVSBsYXRlci4gU2VlIGBfZ2VuZXJhdGVJMThuTWVzc2FnZSgpYC5cbiAgICAgICAgaTE4bk5vZGUucHJldmlvdXNNZXNzYWdlID0gb3JpZ2luYWxOb2RlLmkxOG47XG4gICAgICB9XG4gICAgICBvcmlnaW5hbE5vZGUuaTE4biA9IGkxOG5Ob2RlO1xuICAgIH1cbiAgICByZXR1cm4gaTE4bk5vZGU7XG4gIH07XG59O1xuXG4vKipcbiAqIFRoaXMgdmlzaXRvciB3YWxrcyBvdmVyIEhUTUwgcGFyc2UgdHJlZSBhbmQgY29udmVydHMgaW5mb3JtYXRpb24gc3RvcmVkIGluXG4gKiBpMThuLXJlbGF0ZWQgYXR0cmlidXRlcyAoXCJpMThuXCIgYW5kIFwiaTE4bi0qXCIpIGludG8gaTE4biBtZXRhIG9iamVjdCB0aGF0IGlzXG4gKiBzdG9yZWQgd2l0aCBvdGhlciBlbGVtZW50J3MgYW5kIGF0dHJpYnV0ZSdzIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgSTE4bk1ldGFWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgLy8gd2hldGhlciB2aXNpdGVkIG5vZGVzIGNvbnRhaW4gaTE4biBpbmZvcm1hdGlvblxuICBwdWJsaWMgaGFzSTE4bk1ldGE6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfZXJyb3JzOiBJMThuRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgcHJpdmF0ZSBrZWVwSTE4bkF0dHJzID0gZmFsc2UsXG4gICAgcHJpdmF0ZSBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID0gZmFsc2UsXG4gICAgcHJpdmF0ZSBjb250YWluZXJCbG9ja3M6IFNldDxzdHJpbmc+ID0gREVGQVVMVF9DT05UQUlORVJfQkxPQ0tTLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcHJlc2VydmVTaWduaWZpY2FudFdoaXRlc3BhY2U6IGJvb2xlYW4gPSB0cnVlLFxuXG4gICAgLy8gV2hlbiBkcm9wcGluZyBzaWduaWZpY2FudCB3aGl0ZXNwYWNlIHdlIG5lZWQgdG8gcmV0YWluIGVtcHR5IHRva2VucyBvclxuICAgIC8vIGVsc2Ugd2Ugd29uJ3QgYmUgYWJsZSB0byByZXVzZSBzb3VyY2Ugc3BhbnMgYmVjYXVzZSBlbXB0eSB0b2tlbnMgd291bGQgYmVcbiAgICAvLyByZW1vdmVkIGFuZCBjYXVzZSBhIG1pc21hdGNoLiBVbmZvcnR1bmF0ZWx5IHRoaXMgc3RpbGwgbmVlZHMgdG8gYmVcbiAgICAvLyBjb25maWd1cmFibGUgYW5kIHNvbWV0aW1lcyBuZWVkcyB0byBiZSBzZXQgaW5kZXBlbmRlbnRseSBpbiBvcmRlciB0byBtYWtlXG4gICAgLy8gc3VyZSB0aGUgbnVtYmVyIG9mIG5vZGVzIGRvbid0IGNoYW5nZSBiZXR3ZWVuIHBhcnNlcywgZXZlbiB3aGVuXG4gICAgLy8gYHByZXNlcnZlU2lnbmlmaWNhbnRXaGl0ZXNwYWNlYCBjaGFuZ2VzLlxuICAgIHByaXZhdGUgcmVhZG9ubHkgcmV0YWluRW1wdHlUb2tlbnM6IGJvb2xlYW4gPSAhcHJlc2VydmVTaWduaWZpY2FudFdoaXRlc3BhY2UsXG4gICkge31cblxuICBwcml2YXRlIF9nZW5lcmF0ZUkxOG5NZXNzYWdlKFxuICAgIG5vZGVzOiBodG1sLk5vZGVbXSxcbiAgICBtZXRhOiBzdHJpbmcgfCBpMThuLkkxOG5NZXRhID0gJycsXG4gICAgdmlzaXROb2RlRm4/OiBWaXNpdE5vZGVGbixcbiAgKTogaTE4bi5NZXNzYWdlIHtcbiAgICBjb25zdCB7bWVhbmluZywgZGVzY3JpcHRpb24sIGN1c3RvbUlkfSA9IHRoaXMuX3BhcnNlTWV0YWRhdGEobWV0YSk7XG4gICAgY29uc3QgY3JlYXRlSTE4bk1lc3NhZ2UgPSBjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnkoXG4gICAgICB0aGlzLmludGVycG9sYXRpb25Db25maWcsXG4gICAgICB0aGlzLmNvbnRhaW5lckJsb2NrcyxcbiAgICAgIHRoaXMucmV0YWluRW1wdHlUb2tlbnMsXG4gICAgKTtcbiAgICBjb25zdCBtZXNzYWdlID0gY3JlYXRlSTE4bk1lc3NhZ2Uobm9kZXMsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZCwgdmlzaXROb2RlRm4pO1xuICAgIHRoaXMuX3NldE1lc3NhZ2VJZChtZXNzYWdlLCBtZXRhKTtcbiAgICB0aGlzLl9zZXRMZWdhY3lJZHMobWVzc2FnZSwgbWV0YSk7XG4gICAgcmV0dXJuIG1lc3NhZ2U7XG4gIH1cblxuICB2aXNpdEFsbFdpdGhFcnJvcnMobm9kZXM6IGh0bWwuTm9kZVtdKTogUGFyc2VUcmVlUmVzdWx0IHtcbiAgICBjb25zdCByZXN1bHQgPSBub2Rlcy5tYXAoKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcywgbnVsbCkpO1xuICAgIHJldHVybiBuZXcgUGFyc2VUcmVlUmVzdWx0KHJlc3VsdCwgdGhpcy5fZXJyb3JzKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBodG1sLkVsZW1lbnQpOiBhbnkge1xuICAgIGxldCBtZXNzYWdlOiBpMThuLk1lc3NhZ2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoaGFzSTE4bkF0dHJzKGVsZW1lbnQpKSB7XG4gICAgICB0aGlzLmhhc0kxOG5NZXRhID0gdHJ1ZTtcbiAgICAgIGNvbnN0IGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdID0gW107XG4gICAgICBjb25zdCBhdHRyc01ldGE6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cbiAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJzKSB7XG4gICAgICAgIGlmIChhdHRyLm5hbWUgPT09IEkxOE5fQVRUUikge1xuICAgICAgICAgIC8vIHJvb3QgJ2kxOG4nIG5vZGUgYXR0cmlidXRlXG4gICAgICAgICAgY29uc3QgaTE4biA9IGVsZW1lbnQuaTE4biB8fCBhdHRyLnZhbHVlO1xuXG4gICAgICAgICAgLy8gR2VuZXJhdGUgYSBuZXcgQVNUIHdpdGggd2hpdGVzcGFjZSB0cmltbWVkLCBidXQgYWxzbyBnZW5lcmF0ZSBhIG1hcFxuICAgICAgICAgIC8vIHRvIGNvcnJlbGF0ZSBlYWNoIG5ldyBub2RlIHRvIGl0cyBvcmlnaW5hbCBzbyB3ZSBjYW4gYXBwbHkgaTE4blxuICAgICAgICAgIC8vIGluZm9ybWF0aW9uIHRvIHRoZSBvcmlnaW5hbCBub2RlIGJhc2VkIG9uIHRoZSB0cmltbWVkIGNvbnRlbnQuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBgV2hpdGVzcGFjZVZpc2l0b3JgIHJlbW92ZXMgKmluc2lnbmlmaWNhbnQqIHdoaXRlc3BhY2UgYXMgd2VsbCBhc1xuICAgICAgICAgIC8vIHNpZ25pZmljYW50IHdoaXRlc3BhY2UuIEVuYWJsaW5nIHRoaXMgdmlzaXRvciBzaG91bGQgYmUgY29uZGl0aW9uYWxcbiAgICAgICAgICAvLyBvbiBgcHJlc2VydmVXaGl0ZXNwYWNlYCByYXRoZXIgdGhhbiBgcHJlc2VydmVTaWduaWZpY2FudFdoaXRlc3BhY2VgLFxuICAgICAgICAgIC8vIGhvd2V2ZXIgdGhpcyB3b3VsZCBiZSBhIGJyZWFraW5nIGNoYW5nZSBmb3IgZXhpc3RpbmcgYmVoYXZpb3Igd2hlcmVcbiAgICAgICAgICAvLyBgcHJlc2VydmVXaGl0ZXNwYWNlYCB3YXMgbm90IHJlc3BlY3RlZCBjb3JyZWN0bHkgd2hlbiBnZW5lcmF0aW5nXG4gICAgICAgICAgLy8gbWVzc2FnZSBJRHMuIFRoaXMgaXMgcmVhbGx5IGEgYnVnIGJ1dCBvbmUgd2UgbmVlZCB0byBrZWVwIHRvIG1haW50YWluXG4gICAgICAgICAgLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG4gICAgICAgICAgY29uc3Qgb3JpZ2luYWxOb2RlTWFwID0gbmV3IE1hcDxodG1sLk5vZGUsIGh0bWwuTm9kZT4oKTtcbiAgICAgICAgICBjb25zdCB0cmltbWVkTm9kZXMgPSB0aGlzLnByZXNlcnZlU2lnbmlmaWNhbnRXaGl0ZXNwYWNlXG4gICAgICAgICAgICA/IGVsZW1lbnQuY2hpbGRyZW5cbiAgICAgICAgICAgIDogdmlzaXRBbGxXaXRoU2libGluZ3MoXG4gICAgICAgICAgICAgICAgbmV3IFdoaXRlc3BhY2VWaXNpdG9yKGZhbHNlIC8qIHByZXNlcnZlU2lnbmlmaWNhbnRXaGl0ZXNwYWNlICovLCBvcmlnaW5hbE5vZGVNYXApLFxuICAgICAgICAgICAgICAgIGVsZW1lbnQuY2hpbGRyZW4sXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UodHJpbW1lZE5vZGVzLCBpMThuLCBzZXRJMThuUmVmcyhvcmlnaW5hbE5vZGVNYXApKTtcbiAgICAgICAgICBpZiAobWVzc2FnZS5ub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8vIElnbm9yZSB0aGUgbWVzc2FnZSBpZiBpdCBpcyBlbXB0eS5cbiAgICAgICAgICAgIG1lc3NhZ2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFN0b3JlIHRoZSBtZXNzYWdlIG9uIHRoZSBlbGVtZW50XG4gICAgICAgICAgZWxlbWVudC5pMThuID0gbWVzc2FnZTtcbiAgICAgICAgfSBlbHNlIGlmIChhdHRyLm5hbWUuc3RhcnRzV2l0aChJMThOX0FUVFJfUFJFRklYKSkge1xuICAgICAgICAgIC8vICdpMThuLSonIGF0dHJpYnV0ZXNcbiAgICAgICAgICBjb25zdCBuYW1lID0gYXR0ci5uYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKTtcbiAgICAgICAgICBpZiAoaXNUcnVzdGVkVHlwZXNTaW5rKGVsZW1lbnQubmFtZSwgbmFtZSkpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBhdHRyLFxuICAgICAgICAgICAgICBgVHJhbnNsYXRpbmcgYXR0cmlidXRlICcke25hbWV9JyBpcyBkaXNhbGxvd2VkIGZvciBzZWN1cml0eSByZWFzb25zLmAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyc01ldGFbbmFtZV0gPSBhdHRyLnZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBub24taTE4biBhdHRyaWJ1dGVzXG4gICAgICAgICAgYXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBzZXQgaTE4biBtZXRhIGZvciBhdHRyaWJ1dGVzXG4gICAgICBpZiAoT2JqZWN0LmtleXMoYXR0cnNNZXRhKS5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJzKSB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IGF0dHJzTWV0YVthdHRyLm5hbWVdO1xuICAgICAgICAgIC8vIGRvIG5vdCBjcmVhdGUgdHJhbnNsYXRpb24gZm9yIGVtcHR5IGF0dHJpYnV0ZXNcbiAgICAgICAgICBpZiAobWV0YSAhPT0gdW5kZWZpbmVkICYmIGF0dHIudmFsdWUpIHtcbiAgICAgICAgICAgIGF0dHIuaTE4biA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2F0dHJdLCBhdHRyLmkxOG4gfHwgbWV0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5rZWVwSTE4bkF0dHJzKSB7XG4gICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50J3MgYXR0cmlidXRlcyxcbiAgICAgICAgLy8ga2VlcGluZyBvbmx5IG5vbi1pMThuIHJlbGF0ZWQgb25lc1xuICAgICAgICBlbGVtZW50LmF0dHJzID0gYXR0cnM7XG4gICAgICB9XG4gICAgfVxuICAgIGh0bWwudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbiwgbWVzc2FnZSk7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjdXJyZW50TWVzc2FnZTogaTE4bi5NZXNzYWdlIHwgbnVsbCk6IGFueSB7XG4gICAgbGV0IG1lc3NhZ2U7XG4gICAgY29uc3QgbWV0YSA9IGV4cGFuc2lvbi5pMThuO1xuICAgIHRoaXMuaGFzSTE4bk1ldGEgPSB0cnVlO1xuICAgIGlmIChtZXRhIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlcikge1xuICAgICAgLy8gc2V0IElDVSBwbGFjZWhvbGRlciBuYW1lIChlLmcuIFwiSUNVXzFcIiksXG4gICAgICAvLyBnZW5lcmF0ZWQgd2hpbGUgcHJvY2Vzc2luZyByb290IGVsZW1lbnQgY29udGVudHMsXG4gICAgICAvLyBzbyB3ZSBjYW4gcmVmZXJlbmNlIGl0IHdoZW4gd2Ugb3V0cHV0IHRyYW5zbGF0aW9uXG4gICAgICBjb25zdCBuYW1lID0gbWV0YS5uYW1lO1xuICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2V4cGFuc2lvbl0sIG1ldGEpO1xuICAgICAgY29uc3QgaWN1ID0gaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgaWN1Lm5hbWUgPSBuYW1lO1xuICAgICAgaWYgKGN1cnJlbnRNZXNzYWdlICE9PSBudWxsKSB7XG4gICAgICAgIC8vIEFsc28gdXBkYXRlIHRoZSBwbGFjZWhvbGRlclRvTWVzc2FnZSBtYXAgd2l0aCB0aGlzIG5ldyBtZXNzYWdlXG4gICAgICAgIGN1cnJlbnRNZXNzYWdlLnBsYWNlaG9sZGVyVG9NZXNzYWdlW25hbWVdID0gbWVzc2FnZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSUNVIGlzIGEgdG9wIGxldmVsIG1lc3NhZ2UsIHRyeSB0byB1c2UgbWV0YWRhdGEgZnJvbSBjb250YWluZXIgZWxlbWVudCBpZiBwcm92aWRlZCB2aWFcbiAgICAgIC8vIGBjb250ZXh0YCBhcmd1bWVudC4gTm90ZTogY29udGV4dCBtYXkgbm90IGJlIGF2YWlsYWJsZSBmb3Igc3RhbmRhbG9uZSBJQ1VzICh3aXRob3V0XG4gICAgICAvLyB3cmFwcGluZyBlbGVtZW50KSwgc28gZmFsbGJhY2sgdG8gSUNVIG1ldGFkYXRhIGluIHRoaXMgY2FzZS5cbiAgICAgIG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFtleHBhbnNpb25dLCBjdXJyZW50TWVzc2FnZSB8fCBtZXRhKTtcbiAgICB9XG4gICAgZXhwYW5zaW9uLmkxOG4gPSBtZXNzYWdlO1xuICAgIHJldHVybiBleHBhbnNpb247XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0KTogYW55IHtcbiAgICByZXR1cm4gdGV4dDtcbiAgfVxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogYW55IHtcbiAgICByZXR1cm4gYXR0cmlidXRlO1xuICB9XG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBhbnkge1xuICAgIHJldHVybiBjb21tZW50O1xuICB9XG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UpOiBhbnkge1xuICAgIHJldHVybiBleHBhbnNpb25DYXNlO1xuICB9XG5cbiAgdmlzaXRCbG9jayhibG9jazogaHRtbC5CbG9jaywgY29udGV4dDogYW55KSB7XG4gICAgaHRtbC52aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbiwgY29udGV4dCk7XG4gICAgcmV0dXJuIGJsb2NrO1xuICB9XG5cbiAgdmlzaXRCbG9ja1BhcmFtZXRlcihwYXJhbWV0ZXI6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGNvbnRleHQ6IGFueSkge1xuICAgIHJldHVybiBwYXJhbWV0ZXI7XG4gIH1cblxuICB2aXNpdExldERlY2xhcmF0aW9uKGRlY2w6IGh0bWwuTGV0RGVjbGFyYXRpb24sIGNvbnRleHQ6IGFueSkge1xuICAgIHJldHVybiBkZWNsO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHRoZSBnZW5lcmFsIGZvcm0gYG1ldGFgIHBhc3NlZCBpbnRvIGV4dHJhY3QgdGhlIGV4cGxpY2l0IG1ldGFkYXRhIG5lZWRlZCB0byBjcmVhdGUgYVxuICAgKiBgTWVzc2FnZWAuXG4gICAqXG4gICAqIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJpbGl0aWVzIGZvciB0aGUgYG1ldGFgIHZhcmlhYmxlXG4gICAqIDEpIGEgc3RyaW5nIGZyb20gYW4gYGkxOG5gIHRlbXBsYXRlIGF0dHJpYnV0ZTogcGFyc2UgaXQgdG8gZXh0cmFjdCB0aGUgbWV0YWRhdGEgdmFsdWVzLlxuICAgKiAyKSBhIGBNZXNzYWdlYCBmcm9tIGEgcHJldmlvdXMgcHJvY2Vzc2luZyBwYXNzOiByZXVzZSB0aGUgbWV0YWRhdGEgdmFsdWVzIGluIHRoZSBtZXNzYWdlLlxuICAgKiA0KSBvdGhlcjogaWdub3JlIHRoaXMgYW5kIGp1c3QgcHJvY2VzcyB0aGUgbWVzc2FnZSBtZXRhZGF0YSBhcyBub3JtYWxcbiAgICpcbiAgICogQHBhcmFtIG1ldGEgdGhlIGJ1Y2tldCB0aGF0IGhvbGRzIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtZXNzYWdlXG4gICAqIEByZXR1cm5zIHRoZSBwYXJzZWQgbWV0YWRhdGEuXG4gICAqL1xuICBwcml2YXRlIF9wYXJzZU1ldGFkYXRhKG1ldGE6IHN0cmluZyB8IGkxOG4uSTE4bk1ldGEpOiBJMThuTWV0YSB7XG4gICAgcmV0dXJuIHR5cGVvZiBtZXRhID09PSAnc3RyaW5nJ1xuICAgICAgPyBwYXJzZUkxOG5NZXRhKG1ldGEpXG4gICAgICA6IG1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2VcbiAgICAgICAgPyBtZXRhXG4gICAgICAgIDoge307XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgKG9yIHJlc3RvcmUpIG1lc3NhZ2UgaWQgaWYgbm90IHNwZWNpZmllZCBhbHJlYWR5LlxuICAgKi9cbiAgcHJpdmF0ZSBfc2V0TWVzc2FnZUlkKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgbWV0YTogc3RyaW5nIHwgaTE4bi5JMThuTWV0YSk6IHZvaWQge1xuICAgIGlmICghbWVzc2FnZS5pZCkge1xuICAgICAgbWVzc2FnZS5pZCA9XG4gICAgICAgIChtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlICYmIG1ldGEuaWQpIHx8XG4gICAgICAgIGRlY2ltYWxEaWdlc3QobWVzc2FnZSwgLyogcHJlc2VydmVQbGFjZWhvbGRlcnMgKi8gdGhpcy5wcmVzZXJ2ZVNpZ25pZmljYW50V2hpdGVzcGFjZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgYG1lc3NhZ2VgIHdpdGggYSBgbGVnYWN5SWRgIGlmIG5lY2Vzc2FyeS5cbiAgICpcbiAgICogQHBhcmFtIG1lc3NhZ2UgdGhlIG1lc3NhZ2Ugd2hvc2UgbGVnYWN5IGlkIHNob3VsZCBiZSBzZXRcbiAgICogQHBhcmFtIG1ldGEgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1lc3NhZ2UgYmVpbmcgcHJvY2Vzc2VkXG4gICAqL1xuICBwcml2YXRlIF9zZXRMZWdhY3lJZHMobWVzc2FnZTogaTE4bi5NZXNzYWdlLCBtZXRhOiBzdHJpbmcgfCBpMThuLkkxOG5NZXRhKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCkge1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZHMgPSBbXG4gICAgICAgIGNvbXB1dGVEaWdlc3QobWVzc2FnZSksXG4gICAgICAgIGNvbXB1dGVEZWNpbWFsRGlnZXN0KFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgLyogcHJlc2VydmVQbGFjZWhvbGRlcnMgKi8gdGhpcy5wcmVzZXJ2ZVNpZ25pZmljYW50V2hpdGVzcGFjZSxcbiAgICAgICAgKSxcbiAgICAgIF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWV0YSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFRoaXMgb2NjdXJzIGlmIHdlIGFyZSBkb2luZyB0aGUgMm5kIHBhc3MgYWZ0ZXIgd2hpdGVzcGFjZSByZW1vdmFsIChzZWUgYHBhcnNlVGVtcGxhdGUoKWAgaW5cbiAgICAgIC8vIGBwYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzYCkuXG4gICAgICAvLyBJbiB0aGF0IGNhc2Ugd2Ugd2FudCB0byByZXVzZSB0aGUgbGVnYWN5IG1lc3NhZ2UgZ2VuZXJhdGVkIGluIHRoZSAxc3QgcGFzcyAoc2VlXG4gICAgICAvLyBgc2V0STE4blJlZnMoKWApLlxuICAgICAgY29uc3QgcHJldmlvdXNNZXNzYWdlID1cbiAgICAgICAgbWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZVxuICAgICAgICAgID8gbWV0YVxuICAgICAgICAgIDogbWV0YSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXJcbiAgICAgICAgICAgID8gbWV0YS5wcmV2aW91c01lc3NhZ2VcbiAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZHMgPSBwcmV2aW91c01lc3NhZ2UgPyBwcmV2aW91c01lc3NhZ2UubGVnYWN5SWRzIDogW107XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3Iobm9kZTogaHRtbC5Ob2RlLCBtc2c6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuX2Vycm9ycy5wdXNoKG5ldyBJMThuRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCBtc2cpKTtcbiAgfVxufVxuXG4vKiogSTE4biBzZXBhcmF0b3JzIGZvciBtZXRhZGF0YSAqKi9cbmNvbnN0IEkxOE5fTUVBTklOR19TRVBBUkFUT1IgPSAnfCc7XG5jb25zdCBJMThOX0lEX1NFUEFSQVRPUiA9ICdAQCc7XG5cbi8qKlxuICogUGFyc2VzIGkxOG4gbWV0YXMgbGlrZTpcbiAqICAtIFwiQEBpZFwiLFxuICogIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuICogIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbiAqIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHBhcnNlZCBvdXRwdXQuXG4gKlxuICogQHBhcmFtIG1ldGEgU3RyaW5nIHRoYXQgcmVwcmVzZW50cyBpMThuIG1ldGFcbiAqIEByZXR1cm5zIE9iamVjdCB3aXRoIGlkLCBtZWFuaW5nIGFuZCBkZXNjcmlwdGlvbiBmaWVsZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEobWV0YTogc3RyaW5nID0gJycpOiBJMThuTWV0YSB7XG4gIGxldCBjdXN0b21JZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBsZXQgbWVhbmluZzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICBtZXRhID0gbWV0YS50cmltKCk7XG4gIGlmIChtZXRhKSB7XG4gICAgY29uc3QgaWRJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX0lEX1NFUEFSQVRPUik7XG4gICAgY29uc3QgZGVzY0luZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgY3VzdG9tSWRdID1cbiAgICAgIGlkSW5kZXggPiAtMSA/IFttZXRhLnNsaWNlKDAsIGlkSW5kZXgpLCBtZXRhLnNsaWNlKGlkSW5kZXggKyAyKV0gOiBbbWV0YSwgJyddO1xuICAgIFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPVxuICAgICAgZGVzY0luZGV4ID4gLTFcbiAgICAgICAgPyBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldXG4gICAgICAgIDogWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2N1c3RvbUlkLCBtZWFuaW5nLCBkZXNjcmlwdGlvbn07XG59XG5cbi8vIENvbnZlcnRzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiBmb3IgYSBtZXNzYWdlIChpZCwgZGVzY3JpcHRpb24sIG1lYW5pbmcpXG4vLyB0byBhIEpzRG9jIHN0YXRlbWVudCBmb3JtYXR0ZWQgYXMgZXhwZWN0ZWQgYnkgdGhlIENsb3N1cmUgY29tcGlsZXIuXG5leHBvcnQgZnVuY3Rpb24gaTE4bk1ldGFUb0pTRG9jKG1ldGE6IEkxOG5NZXRhKTogby5KU0RvY0NvbW1lbnQge1xuICBjb25zdCB0YWdzOiBvLkpTRG9jVGFnW10gPSBbXTtcbiAgaWYgKG1ldGEuZGVzY3JpcHRpb24pIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLkRlc2MsIHRleHQ6IG1ldGEuZGVzY3JpcHRpb259KTtcbiAgfSBlbHNlIHtcbiAgICAvLyBTdXBwcmVzcyB0aGUgSlNDb21waWxlciB3YXJuaW5nIHRoYXQgYSBgQGRlc2NgIHdhcyBub3QgZ2l2ZW4gZm9yIHRoaXMgbWVzc2FnZS5cbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLlN1cHByZXNzLCB0ZXh0OiAne21zZ0Rlc2NyaXB0aW9uc30nfSk7XG4gIH1cbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuTWVhbmluZywgdGV4dDogbWV0YS5tZWFuaW5nfSk7XG4gIH1cbiAgcmV0dXJuIG8uanNEb2NDb21tZW50KHRhZ3MpO1xufVxuIl19