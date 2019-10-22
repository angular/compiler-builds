/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __read, __values } from "tslib";
import { computeDecimalDigest, computeDigest, decimalDigest } from '../../../i18n/digest';
import * as i18n from '../../../i18n/i18n_ast';
import { createI18nMessageFactory } from '../../../i18n/i18n_parser';
import * as html from '../../../ml_parser/ast';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../../ml_parser/interpolation_config';
import * as o from '../../../output/output_ast';
import { I18N_ATTR, I18N_ATTR_PREFIX, hasI18nAttrs, icuFromI18nMessage } from './util';
var setI18nRefs = function (htmlNode, i18nNode) {
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
var I18nMetaVisitor = /** @class */ (function () {
    function I18nMetaVisitor(interpolationConfig, keepI18nAttrs, i18nLegacyMessageIdFormat) {
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        if (keepI18nAttrs === void 0) { keepI18nAttrs = false; }
        if (i18nLegacyMessageIdFormat === void 0) { i18nLegacyMessageIdFormat = ''; }
        this.interpolationConfig = interpolationConfig;
        this.keepI18nAttrs = keepI18nAttrs;
        this.i18nLegacyMessageIdFormat = i18nLegacyMessageIdFormat;
        // whether visited nodes contain i18n information
        this.hasI18nMeta = false;
        // i18n message generation factory
        this._createI18nMessage = createI18nMessageFactory(this.interpolationConfig);
    }
    I18nMetaVisitor.prototype._generateI18nMessage = function (nodes, meta, visitNodeFn) {
        if (meta === void 0) { meta = ''; }
        var _a = this._parseMetadata(meta), meaning = _a.meaning, description = _a.description, customId = _a.customId;
        var message = this._createI18nMessage(nodes, meaning, description, customId, visitNodeFn);
        this._setMessageId(message, meta);
        this._setLegacyId(message, meta);
        return message;
    };
    I18nMetaVisitor.prototype.visitElement = function (element) {
        var e_1, _a, e_2, _b;
        if (hasI18nAttrs(element)) {
            this.hasI18nMeta = true;
            var attrs = [];
            var attrsMeta = {};
            try {
                for (var _c = __values(element.attrs), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var attr = _d.value;
                    if (attr.name === I18N_ATTR) {
                        // root 'i18n' node attribute
                        var i18n_1 = element.i18n || attr.value;
                        var message = this._generateI18nMessage(element.children, i18n_1, setI18nRefs);
                        // do not assign empty i18n meta
                        if (message.nodes.length) {
                            element.i18n = message;
                        }
                    }
                    else if (attr.name.startsWith(I18N_ATTR_PREFIX)) {
                        // 'i18n-*' attributes
                        var key = attr.name.slice(I18N_ATTR_PREFIX.length);
                        attrsMeta[key] = attr.value;
                    }
                    else {
                        // non-i18n attributes
                        attrs.push(attr);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            // set i18n meta for attributes
            if (Object.keys(attrsMeta).length) {
                try {
                    for (var attrs_1 = __values(attrs), attrs_1_1 = attrs_1.next(); !attrs_1_1.done; attrs_1_1 = attrs_1.next()) {
                        var attr = attrs_1_1.value;
                        var meta = attrsMeta[attr.name];
                        // do not create translation for empty attributes
                        if (meta !== undefined && attr.value) {
                            attr.i18n = this._generateI18nMessage([attr], attr.i18n || meta);
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (attrs_1_1 && !attrs_1_1.done && (_b = attrs_1.return)) _b.call(attrs_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            if (!this.keepI18nAttrs) {
                // update element's attributes,
                // keeping only non-i18n related ones
                element.attrs = attrs;
            }
        }
        html.visitAll(this, element.children, element.i18n);
        return element;
    };
    I18nMetaVisitor.prototype.visitExpansion = function (expansion, currentMessage) {
        var message;
        var meta = expansion.i18n;
        this.hasI18nMeta = true;
        if (meta instanceof i18n.IcuPlaceholder) {
            // set ICU placeholder name (e.g. "ICU_1"),
            // generated while processing root element contents,
            // so we can reference it when we output translation
            var name_1 = meta.name;
            message = this._generateI18nMessage([expansion], meta);
            var icu = icuFromI18nMessage(message);
            icu.name = name_1;
        }
        else {
            // ICU is a top level message, try to use metadata from container element if provided via
            // `context` argument. Note: context may not be available for standalone ICUs (without
            // wrapping element), so fallback to ICU metadata in this case.
            message = this._generateI18nMessage([expansion], currentMessage || meta);
        }
        expansion.i18n = message;
        return expansion;
    };
    I18nMetaVisitor.prototype.visitText = function (text) { return text; };
    I18nMetaVisitor.prototype.visitAttribute = function (attribute) { return attribute; };
    I18nMetaVisitor.prototype.visitComment = function (comment) { return comment; };
    I18nMetaVisitor.prototype.visitExpansionCase = function (expansionCase) { return expansionCase; };
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
    I18nMetaVisitor.prototype._parseMetadata = function (meta) {
        return typeof meta === 'string' ? parseI18nMeta(meta) :
            meta instanceof i18n.Message ? metaFromI18nMessage(meta) : {};
    };
    /**
     * Generate (or restore) message id if not specified already.
     */
    I18nMetaVisitor.prototype._setMessageId = function (message, meta) {
        if (!message.id) {
            message.id = meta instanceof i18n.Message && meta.id || decimalDigest(message);
        }
    };
    /**
     * Update the `message` with a `legacyId` if necessary.
     *
     * @param message the message whose legacy id should be set
     * @param meta information about the message being processed
     */
    I18nMetaVisitor.prototype._setLegacyId = function (message, meta) {
        if (this.i18nLegacyMessageIdFormat === 'xlf' || this.i18nLegacyMessageIdFormat === 'xliff') {
            message.legacyId = computeDigest(message);
        }
        else if (this.i18nLegacyMessageIdFormat === 'xlf2' || this.i18nLegacyMessageIdFormat === 'xliff2' ||
            this.i18nLegacyMessageIdFormat === 'xmb') {
            message.legacyId = computeDecimalDigest(message);
        }
        else if (typeof meta !== 'string') {
            // This occurs if we are doing the 2nd pass after whitespace removal (see `parseTemplate()` in
            // `packages/compiler/src/render3/view/template.ts`).
            // In that case we want to reuse the legacy message generated in the 1st pass (see
            // `setI18nRefs()`).
            var previousMessage = meta instanceof i18n.Message ?
                meta :
                meta instanceof i18n.IcuPlaceholder ? meta.previousMessage : undefined;
            message.legacyId = previousMessage && previousMessage.legacyId;
        }
    };
    return I18nMetaVisitor;
}());
export { I18nMetaVisitor };
export function metaFromI18nMessage(message, id) {
    if (id === void 0) { id = null; }
    return {
        id: typeof id === 'string' ? id : message.id || '',
        customId: message.customId,
        legacyId: message.legacyId,
        meaning: message.meaning || '',
        description: message.description || ''
    };
}
/** I18n separators for metadata **/
var I18N_MEANING_SEPARATOR = '|';
var I18N_ID_SEPARATOR = '@@';
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
    var _a, _b;
    var customId;
    var meaning;
    var description;
    if (meta) {
        var idIndex = meta.indexOf(I18N_ID_SEPARATOR);
        var descIndex = meta.indexOf(I18N_MEANING_SEPARATOR);
        var meaningAndDesc = void 0;
        _a = __read((idIndex > -1) ? [meta.slice(0, idIndex), meta.slice(idIndex + 2)] : [meta, ''], 2), meaningAndDesc = _a[0], customId = _a[1];
        _b = __read((descIndex > -1) ?
            [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
            ['', meaningAndDesc], 2), meaning = _b[0], description = _b[1];
    }
    return { customId: customId, meaning: meaning, description: description };
}
/**
 * Serialize the given `meta` and `messagePart` a string that can be used in a `$localize`
 * tagged string. The format of the metadata is the same as that parsed by `parseI18nMeta()`.
 *
 * @param meta The metadata to serialize
 * @param messagePart The first part of the tagged string
 */
export function serializeI18nHead(meta, messagePart) {
    var metaBlock = meta.description || '';
    if (meta.meaning) {
        metaBlock = meta.meaning + "|" + metaBlock;
    }
    if (meta.customId || meta.legacyId) {
        metaBlock = metaBlock + "@@" + (meta.customId || meta.legacyId);
    }
    if (metaBlock === '') {
        // There is no metaBlock, so we must ensure that any starting colon is escaped.
        return escapeStartingColon(messagePart);
    }
    else {
        return ":" + escapeColons(metaBlock) + ":" + messagePart;
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
        return ":" + placeholderName + ":" + messagePart;
    }
}
// Converts i18n meta information for a message (id, description, meaning)
// to a JsDoc statement formatted as expected by the Closure compiler.
export function i18nMetaToDocStmt(meta) {
    var tags = [];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsb0JBQW9CLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3hGLE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFjLHdCQUF3QixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDaEYsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0seUNBQXlDLENBQUM7QUFDMUcsT0FBTyxLQUFLLENBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUVoRCxPQUFPLEVBQUMsU0FBUyxFQUFFLGdCQUFnQixFQUFFLFlBQVksRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQVdyRixJQUFNLFdBQVcsR0FBZ0IsVUFBQyxRQUFRLEVBQUUsUUFBUTtJQUNsRCxJQUFJLFFBQVEsWUFBWSxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ3pDLElBQUksUUFBUSxZQUFZLElBQUksQ0FBQyxjQUFjLElBQUksUUFBUSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ3BGLDJGQUEyRjtZQUMzRixvRkFBb0Y7WUFDcEYsMkZBQTJGO1lBQzNGLDJFQUEyRTtZQUMzRSxRQUFRLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7U0FDMUM7UUFDRCxRQUFRLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQztLQUMxQjtJQUNELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUMsQ0FBQztBQUVGOzs7O0dBSUc7QUFDSDtJQU9FLHlCQUNZLG1CQUF1RSxFQUN2RSxhQUE4QixFQUFVLHlCQUFzQztRQUQ5RSxvQ0FBQSxFQUFBLGtEQUF1RTtRQUN2RSw4QkFBQSxFQUFBLHFCQUE4QjtRQUFVLDBDQUFBLEVBQUEsOEJBQXNDO1FBRDlFLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0Q7UUFDdkUsa0JBQWEsR0FBYixhQUFhLENBQWlCO1FBQVUsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFhO1FBUjFGLGlEQUFpRDtRQUMxQyxnQkFBVyxHQUFZLEtBQUssQ0FBQztRQUVwQyxrQ0FBa0M7UUFDMUIsdUJBQWtCLEdBQUcsd0JBQXdCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFJYSxDQUFDO0lBRXRGLDhDQUFvQixHQUE1QixVQUNJLEtBQWtCLEVBQUUsSUFBK0IsRUFDbkQsV0FBeUI7UUFETCxxQkFBQSxFQUFBLFNBQStCO1FBRS9DLElBQUEsOEJBQTRELEVBQTNELG9CQUFPLEVBQUUsNEJBQVcsRUFBRSxzQkFBcUMsQ0FBQztRQUNuRSxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQzVGLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pDLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRCxzQ0FBWSxHQUFaLFVBQWEsT0FBcUI7O1FBQ2hDLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ3pCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1lBQ3hCLElBQU0sS0FBSyxHQUFxQixFQUFFLENBQUM7WUFDbkMsSUFBTSxTQUFTLEdBQTRCLEVBQUUsQ0FBQzs7Z0JBRTlDLEtBQW1CLElBQUEsS0FBQSxTQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUEsZ0JBQUEsNEJBQUU7b0JBQTdCLElBQU0sSUFBSSxXQUFBO29CQUNiLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7d0JBQzNCLDZCQUE2Qjt3QkFDN0IsSUFBTSxNQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDO3dCQUN4QyxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxNQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7d0JBQy9FLGdDQUFnQzt3QkFDaEMsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRTs0QkFDeEIsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUM7eUJBQ3hCO3FCQUVGO3lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRTt3QkFDakQsc0JBQXNCO3dCQUN0QixJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDckQsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7cUJBRTdCO3lCQUFNO3dCQUNMLHNCQUFzQjt3QkFDdEIsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDbEI7aUJBQ0Y7Ozs7Ozs7OztZQUVELCtCQUErQjtZQUMvQixJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFOztvQkFDakMsS0FBbUIsSUFBQSxVQUFBLFNBQUEsS0FBSyxDQUFBLDRCQUFBLCtDQUFFO3dCQUFyQixJQUFNLElBQUksa0JBQUE7d0JBQ2IsSUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDbEMsaURBQWlEO3dCQUNqRCxJQUFJLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTs0QkFDcEMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDO3lCQUNsRTtxQkFDRjs7Ozs7Ozs7O2FBQ0Y7WUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDdkIsK0JBQStCO2dCQUMvQixxQ0FBcUM7Z0JBQ3JDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO2FBQ3ZCO1NBQ0Y7UUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsd0NBQWMsR0FBZCxVQUFlLFNBQXlCLEVBQUUsY0FBc0M7UUFDOUUsSUFBSSxPQUFPLENBQUM7UUFDWixJQUFNLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQzVCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLElBQUksSUFBSSxZQUFZLElBQUksQ0FBQyxjQUFjLEVBQUU7WUFDdkMsMkNBQTJDO1lBQzNDLG9EQUFvRDtZQUNwRCxvREFBb0Q7WUFDcEQsSUFBTSxNQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztZQUN2QixPQUFPLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdkQsSUFBTSxHQUFHLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDeEMsR0FBRyxDQUFDLElBQUksR0FBRyxNQUFJLENBQUM7U0FDakI7YUFBTTtZQUNMLHlGQUF5RjtZQUN6RixzRkFBc0Y7WUFDdEYsK0RBQStEO1lBQy9ELE9BQU8sR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRSxjQUFjLElBQUksSUFBSSxDQUFDLENBQUM7U0FDMUU7UUFDRCxTQUFTLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQztRQUN6QixPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBRUQsbUNBQVMsR0FBVCxVQUFVLElBQWUsSUFBUyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDaEQsd0NBQWMsR0FBZCxVQUFlLFNBQXlCLElBQVMsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLHNDQUFZLEdBQVosVUFBYSxPQUFxQixJQUFTLE9BQU8sT0FBTyxDQUFDLENBQUMsQ0FBQztJQUM1RCw0Q0FBa0IsR0FBbEIsVUFBbUIsYUFBaUMsSUFBUyxPQUFPLGFBQWEsQ0FBQyxDQUFDLENBQUM7SUFFcEY7Ozs7Ozs7Ozs7O09BV0c7SUFDSyx3Q0FBYyxHQUF0QixVQUF1QixJQUEwQjtRQUMvQyxPQUFPLE9BQU8sSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDckIsSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDbEcsQ0FBQztJQUVEOztPQUVHO0lBQ0ssdUNBQWEsR0FBckIsVUFBc0IsT0FBcUIsRUFBRSxJQUEwQjtRQUNyRSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtZQUNmLE9BQU8sQ0FBQyxFQUFFLEdBQUcsSUFBSSxZQUFZLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLEVBQUUsSUFBSSxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDaEY7SUFDSCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSyxzQ0FBWSxHQUFwQixVQUFxQixPQUFxQixFQUFFLElBQTBCO1FBQ3BFLElBQUksSUFBSSxDQUFDLHlCQUF5QixLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMseUJBQXlCLEtBQUssT0FBTyxFQUFFO1lBQzFGLE9BQU8sQ0FBQyxRQUFRLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQzNDO2FBQU0sSUFDSCxJQUFJLENBQUMseUJBQXlCLEtBQUssTUFBTSxJQUFJLElBQUksQ0FBQyx5QkFBeUIsS0FBSyxRQUFRO1lBQ3hGLElBQUksQ0FBQyx5QkFBeUIsS0FBSyxLQUFLLEVBQUU7WUFDNUMsT0FBTyxDQUFDLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUNsRDthQUFNLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQ25DLDhGQUE4RjtZQUM5RixxREFBcUQ7WUFDckQsa0ZBQWtGO1lBQ2xGLG9CQUFvQjtZQUNwQixJQUFNLGVBQWUsR0FBRyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNsRCxJQUFJLENBQUMsQ0FBQztnQkFDTixJQUFJLFlBQVksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQzNFLE9BQU8sQ0FBQyxRQUFRLEdBQUcsZUFBZSxJQUFJLGVBQWUsQ0FBQyxRQUFRLENBQUM7U0FDaEU7SUFDSCxDQUFDO0lBQ0gsc0JBQUM7QUFBRCxDQUFDLEFBbEpELElBa0pDOztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxPQUFxQixFQUFFLEVBQXdCO0lBQXhCLG1CQUFBLEVBQUEsU0FBd0I7SUFDakYsT0FBTztRQUNMLEVBQUUsRUFBRSxPQUFPLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFO1FBQ2xELFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtRQUMxQixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7UUFDMUIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPLElBQUksRUFBRTtRQUM5QixXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVcsSUFBSSxFQUFFO0tBQ3ZDLENBQUM7QUFDSixDQUFDO0FBRUQsb0NBQW9DO0FBQ3BDLElBQU0sc0JBQXNCLEdBQUcsR0FBRyxDQUFDO0FBQ25DLElBQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDO0FBRS9COzs7Ozs7Ozs7R0FTRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUMsSUFBYTs7SUFDekMsSUFBSSxRQUEwQixDQUFDO0lBQy9CLElBQUksT0FBeUIsQ0FBQztJQUM5QixJQUFJLFdBQTZCLENBQUM7SUFFbEMsSUFBSSxJQUFJLEVBQUU7UUFDUixJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDaEQsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3ZELElBQUksY0FBYyxTQUFRLENBQUM7UUFDM0IsK0ZBQ21GLEVBRGxGLHNCQUFjLEVBQUUsZ0JBQVEsQ0FDMkQ7UUFDcEY7O29DQUV3QixFQUZ2QixlQUFPLEVBQUUsbUJBQVcsQ0FFSTtLQUMxQjtJQUVELE9BQU8sRUFBQyxRQUFRLFVBQUEsRUFBRSxPQUFPLFNBQUEsRUFBRSxXQUFXLGFBQUEsRUFBQyxDQUFDO0FBQzFDLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsSUFBYyxFQUFFLFdBQW1CO0lBQ25FLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDO0lBQ3ZDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNoQixTQUFTLEdBQU0sSUFBSSxDQUFDLE9BQU8sU0FBSSxTQUFXLENBQUM7S0FDNUM7SUFDRCxJQUFJLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUNsQyxTQUFTLEdBQU0sU0FBUyxXQUFLLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBRSxDQUFDO0tBQy9EO0lBQ0QsSUFBSSxTQUFTLEtBQUssRUFBRSxFQUFFO1FBQ3BCLCtFQUErRTtRQUMvRSxPQUFPLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0tBQ3pDO1NBQU07UUFDTCxPQUFPLE1BQUksWUFBWSxDQUFDLFNBQVMsQ0FBQyxTQUFJLFdBQWEsQ0FBQztLQUNyRDtBQUNILENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsZUFBdUIsRUFBRSxXQUFtQjtJQUNwRixJQUFJLGVBQWUsS0FBSyxFQUFFLEVBQUU7UUFDMUIsNEZBQTRGO1FBQzVGLE9BQU8sbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDekM7U0FBTTtRQUNMLE9BQU8sTUFBSSxlQUFlLFNBQUksV0FBYSxDQUFDO0tBQzdDO0FBQ0gsQ0FBQztBQUVELDBFQUEwRTtBQUMxRSxzRUFBc0U7QUFDdEUsTUFBTSxVQUFVLGlCQUFpQixDQUFDLElBQWM7SUFDOUMsSUFBTSxJQUFJLEdBQWlCLEVBQUUsQ0FBQztJQUM5QixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sbUJBQXFCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUMsQ0FBQyxDQUFDO0tBQ25FO0lBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLHlCQUF3QixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQztLQUNsRTtJQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEUsQ0FBQztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFXO0lBQzdDLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDbEMsQ0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQUMsR0FBVztJQUN0QyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y29tcHV0ZURlY2ltYWxEaWdlc3QsIGNvbXB1dGVEaWdlc3QsIGRlY2ltYWxEaWdlc3R9IGZyb20gJy4uLy4uLy4uL2kxOG4vZGlnZXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge1Zpc2l0Tm9kZUZuLCBjcmVhdGVJMThuTWVzc2FnZUZhY3Rvcnl9IGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge0kxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgaGFzSTE4bkF0dHJzLCBpY3VGcm9tSTE4bk1lc3NhZ2V9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCB0eXBlIEkxOG5NZXRhID0ge1xuICBpZD86IHN0cmluZyxcbiAgY3VzdG9tSWQ/OiBzdHJpbmcsXG4gIGxlZ2FjeUlkPzogc3RyaW5nLFxuICBkZXNjcmlwdGlvbj86IHN0cmluZyxcbiAgbWVhbmluZz86IHN0cmluZ1xufTtcblxuXG5jb25zdCBzZXRJMThuUmVmczogVmlzaXROb2RlRm4gPSAoaHRtbE5vZGUsIGkxOG5Ob2RlKSA9PiB7XG4gIGlmIChodG1sTm9kZSBpbnN0YW5jZW9mIGh0bWwuTm9kZVdpdGhJMThuKSB7XG4gICAgaWYgKGkxOG5Ob2RlIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlciAmJiBodG1sTm9kZS5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgICAvLyBUaGlzIGh0bWwgbm9kZSByZXByZXNlbnRzIGFuIElDVSBidXQgdGhpcyBpcyBhIHNlY29uZCBwcm9jZXNzaW5nIHBhc3MsIGFuZCB0aGUgbGVnYWN5IGlkXG4gICAgICAvLyB3YXMgY29tcHV0ZWQgaW4gdGhlIHByZXZpb3VzIHBhc3MgYW5kIHN0b3JlZCBpbiB0aGUgYGkxOG5gIHByb3BlcnR5IGFzIGEgbWVzc2FnZS5cbiAgICAgIC8vIFdlIGFyZSBhYm91dCB0byB3aXBlIG91dCB0aGF0IHByb3BlcnR5IHNvIGNhcHR1cmUgdGhlIHByZXZpb3VzIG1lc3NhZ2UgdG8gYmUgcmV1c2VkIHdoZW5cbiAgICAgIC8vIGdlbmVyYXRpbmcgdGhlIG1lc3NhZ2UgZm9yIHRoaXMgSUNVIGxhdGVyLiBTZWUgYF9nZW5lcmF0ZUkxOG5NZXNzYWdlKClgLlxuICAgICAgaTE4bk5vZGUucHJldmlvdXNNZXNzYWdlID0gaHRtbE5vZGUuaTE4bjtcbiAgICB9XG4gICAgaHRtbE5vZGUuaTE4biA9IGkxOG5Ob2RlO1xuICB9XG4gIHJldHVybiBpMThuTm9kZTtcbn07XG5cbi8qKlxuICogVGhpcyB2aXNpdG9yIHdhbGtzIG92ZXIgSFRNTCBwYXJzZSB0cmVlIGFuZCBjb252ZXJ0cyBpbmZvcm1hdGlvbiBzdG9yZWQgaW5cbiAqIGkxOG4tcmVsYXRlZCBhdHRyaWJ1dGVzIChcImkxOG5cIiBhbmQgXCJpMThuLSpcIikgaW50byBpMThuIG1ldGEgb2JqZWN0IHRoYXQgaXNcbiAqIHN0b3JlZCB3aXRoIG90aGVyIGVsZW1lbnQncyBhbmQgYXR0cmlidXRlJ3MgaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBJMThuTWV0YVZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICAvLyB3aGV0aGVyIHZpc2l0ZWQgbm9kZXMgY29udGFpbiBpMThuIGluZm9ybWF0aW9uXG4gIHB1YmxpYyBoYXNJMThuTWV0YTogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIC8vIGkxOG4gbWVzc2FnZSBnZW5lcmF0aW9uIGZhY3RvcnlcbiAgcHJpdmF0ZSBfY3JlYXRlSTE4bk1lc3NhZ2UgPSBjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnkodGhpcy5pbnRlcnBvbGF0aW9uQ29uZmlnKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgICBwcml2YXRlIGtlZXBJMThuQXR0cnM6IGJvb2xlYW4gPSBmYWxzZSwgcHJpdmF0ZSBpMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0OiBzdHJpbmcgPSAnJykge31cblxuICBwcml2YXRlIF9nZW5lcmF0ZUkxOG5NZXNzYWdlKFxuICAgICAgbm9kZXM6IGh0bWwuTm9kZVtdLCBtZXRhOiBzdHJpbmd8aTE4bi5JMThuTWV0YSA9ICcnLFxuICAgICAgdmlzaXROb2RlRm4/OiBWaXNpdE5vZGVGbik6IGkxOG4uTWVzc2FnZSB7XG4gICAgY29uc3Qge21lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZH0gPSB0aGlzLl9wYXJzZU1ldGFkYXRhKG1ldGEpO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9jcmVhdGVJMThuTWVzc2FnZShub2RlcywgbWVhbmluZywgZGVzY3JpcHRpb24sIGN1c3RvbUlkLCB2aXNpdE5vZGVGbik7XG4gICAgdGhpcy5fc2V0TWVzc2FnZUlkKG1lc3NhZ2UsIG1ldGEpO1xuICAgIHRoaXMuX3NldExlZ2FjeUlkKG1lc3NhZ2UsIG1ldGEpO1xuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCk6IGFueSB7XG4gICAgaWYgKGhhc0kxOG5BdHRycyhlbGVtZW50KSkge1xuICAgICAgdGhpcy5oYXNJMThuTWV0YSA9IHRydWU7XG4gICAgICBjb25zdCBhdHRyczogaHRtbC5BdHRyaWJ1dGVbXSA9IFtdO1xuICAgICAgY29uc3QgYXR0cnNNZXRhOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRycykge1xuICAgICAgICBpZiAoYXR0ci5uYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgICAvLyByb290ICdpMThuJyBub2RlIGF0dHJpYnV0ZVxuICAgICAgICAgIGNvbnN0IGkxOG4gPSBlbGVtZW50LmkxOG4gfHwgYXR0ci52YWx1ZTtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShlbGVtZW50LmNoaWxkcmVuLCBpMThuLCBzZXRJMThuUmVmcyk7XG4gICAgICAgICAgLy8gZG8gbm90IGFzc2lnbiBlbXB0eSBpMThuIG1ldGFcbiAgICAgICAgICBpZiAobWVzc2FnZS5ub2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuaTE4biA9IG1lc3NhZ2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgICAvLyAnaTE4bi0qJyBhdHRyaWJ1dGVzXG4gICAgICAgICAgY29uc3Qga2V5ID0gYXR0ci5uYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKTtcbiAgICAgICAgICBhdHRyc01ldGFba2V5XSA9IGF0dHIudmFsdWU7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBub24taTE4biBhdHRyaWJ1dGVzXG4gICAgICAgICAgYXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBzZXQgaTE4biBtZXRhIGZvciBhdHRyaWJ1dGVzXG4gICAgICBpZiAoT2JqZWN0LmtleXMoYXR0cnNNZXRhKS5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJzKSB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IGF0dHJzTWV0YVthdHRyLm5hbWVdO1xuICAgICAgICAgIC8vIGRvIG5vdCBjcmVhdGUgdHJhbnNsYXRpb24gZm9yIGVtcHR5IGF0dHJpYnV0ZXNcbiAgICAgICAgICBpZiAobWV0YSAhPT0gdW5kZWZpbmVkICYmIGF0dHIudmFsdWUpIHtcbiAgICAgICAgICAgIGF0dHIuaTE4biA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2F0dHJdLCBhdHRyLmkxOG4gfHwgbWV0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5rZWVwSTE4bkF0dHJzKSB7XG4gICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50J3MgYXR0cmlidXRlcyxcbiAgICAgICAgLy8ga2VlcGluZyBvbmx5IG5vbi1pMThuIHJlbGF0ZWQgb25lc1xuICAgICAgICBlbGVtZW50LmF0dHJzID0gYXR0cnM7XG4gICAgICB9XG4gICAgfVxuICAgIGh0bWwudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbiwgZWxlbWVudC5pMThuKTtcbiAgICByZXR1cm4gZWxlbWVudDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24sIGN1cnJlbnRNZXNzYWdlOiBpMThuLk1lc3NhZ2V8dW5kZWZpbmVkKTogYW55IHtcbiAgICBsZXQgbWVzc2FnZTtcbiAgICBjb25zdCBtZXRhID0gZXhwYW5zaW9uLmkxOG47XG4gICAgdGhpcy5oYXNJMThuTWV0YSA9IHRydWU7XG4gICAgaWYgKG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyKSB7XG4gICAgICAvLyBzZXQgSUNVIHBsYWNlaG9sZGVyIG5hbWUgKGUuZy4gXCJJQ1VfMVwiKSxcbiAgICAgIC8vIGdlbmVyYXRlZCB3aGlsZSBwcm9jZXNzaW5nIHJvb3QgZWxlbWVudCBjb250ZW50cyxcbiAgICAgIC8vIHNvIHdlIGNhbiByZWZlcmVuY2UgaXQgd2hlbiB3ZSBvdXRwdXQgdHJhbnNsYXRpb25cbiAgICAgIGNvbnN0IG5hbWUgPSBtZXRhLm5hbWU7XG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgICBjb25zdCBpY3UgPSBpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICBpY3UubmFtZSA9IG5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElDVSBpcyBhIHRvcCBsZXZlbCBtZXNzYWdlLCB0cnkgdG8gdXNlIG1ldGFkYXRhIGZyb20gY29udGFpbmVyIGVsZW1lbnQgaWYgcHJvdmlkZWQgdmlhXG4gICAgICAvLyBgY29udGV4dGAgYXJndW1lbnQuIE5vdGU6IGNvbnRleHQgbWF5IG5vdCBiZSBhdmFpbGFibGUgZm9yIHN0YW5kYWxvbmUgSUNVcyAod2l0aG91dFxuICAgICAgLy8gd3JhcHBpbmcgZWxlbWVudCksIHNvIGZhbGxiYWNrIHRvIElDVSBtZXRhZGF0YSBpbiB0aGlzIGNhc2UuXG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgY3VycmVudE1lc3NhZ2UgfHwgbWV0YSk7XG4gICAgfVxuICAgIGV4cGFuc2lvbi5pMThuID0gbWVzc2FnZTtcbiAgICByZXR1cm4gZXhwYW5zaW9uO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IGFueSB7IHJldHVybiB0ZXh0OyB9XG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUpOiBhbnkgeyByZXR1cm4gYXR0cmlidXRlOyB9XG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBhbnkgeyByZXR1cm4gY29tbWVudDsgfVxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlKTogYW55IHsgcmV0dXJuIGV4cGFuc2lvbkNhc2U7IH1cblxuICAvKipcbiAgICogUGFyc2UgdGhlIGdlbmVyYWwgZm9ybSBgbWV0YWAgcGFzc2VkIGludG8gZXh0cmFjdCB0aGUgZXhwbGljaXQgbWV0YWRhdGEgbmVlZGVkIHRvIGNyZWF0ZSBhXG4gICAqIGBNZXNzYWdlYC5cbiAgICpcbiAgICogVGhlcmUgYXJlIHRocmVlIHBvc3NpYmlsaXRpZXMgZm9yIHRoZSBgbWV0YWAgdmFyaWFibGVcbiAgICogMSkgYSBzdHJpbmcgZnJvbSBhbiBgaTE4bmAgdGVtcGxhdGUgYXR0cmlidXRlOiBwYXJzZSBpdCB0byBleHRyYWN0IHRoZSBtZXRhZGF0YSB2YWx1ZXMuXG4gICAqIDIpIGEgYE1lc3NhZ2VgIGZyb20gYSBwcmV2aW91cyBwcm9jZXNzaW5nIHBhc3M6IHJldXNlIHRoZSBtZXRhZGF0YSB2YWx1ZXMgaW4gdGhlIG1lc3NhZ2UuXG4gICAqIDQpIG90aGVyOiBpZ25vcmUgdGhpcyBhbmQganVzdCBwcm9jZXNzIHRoZSBtZXNzYWdlIG1ldGFkYXRhIGFzIG5vcm1hbFxuICAgKlxuICAgKiBAcGFyYW0gbWV0YSB0aGUgYnVja2V0IHRoYXQgaG9sZHMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1lc3NhZ2VcbiAgICogQHJldHVybnMgdGhlIHBhcnNlZCBtZXRhZGF0YS5cbiAgICovXG4gIHByaXZhdGUgX3BhcnNlTWV0YWRhdGEobWV0YTogc3RyaW5nfGkxOG4uSTE4bk1ldGEpOiBJMThuTWV0YSB7XG4gICAgcmV0dXJuIHR5cGVvZiBtZXRhID09PSAnc3RyaW5nJyA/IHBhcnNlSTE4bk1ldGEobWV0YSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlID8gbWV0YUZyb21JMThuTWVzc2FnZShtZXRhKSA6IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIChvciByZXN0b3JlKSBtZXNzYWdlIGlkIGlmIG5vdCBzcGVjaWZpZWQgYWxyZWFkeS5cbiAgICovXG4gIHByaXZhdGUgX3NldE1lc3NhZ2VJZChtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIG1ldGE6IHN0cmluZ3xpMThuLkkxOG5NZXRhKTogdm9pZCB7XG4gICAgaWYgKCFtZXNzYWdlLmlkKSB7XG4gICAgICBtZXNzYWdlLmlkID0gbWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSAmJiBtZXRhLmlkIHx8IGRlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgYG1lc3NhZ2VgIHdpdGggYSBgbGVnYWN5SWRgIGlmIG5lY2Vzc2FyeS5cbiAgICpcbiAgICogQHBhcmFtIG1lc3NhZ2UgdGhlIG1lc3NhZ2Ugd2hvc2UgbGVnYWN5IGlkIHNob3VsZCBiZSBzZXRcbiAgICogQHBhcmFtIG1ldGEgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1lc3NhZ2UgYmVpbmcgcHJvY2Vzc2VkXG4gICAqL1xuICBwcml2YXRlIF9zZXRMZWdhY3lJZChtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIG1ldGE6IHN0cmluZ3xpMThuLkkxOG5NZXRhKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsZicgfHwgdGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneGxpZmYnKSB7XG4gICAgICBtZXNzYWdlLmxlZ2FjeUlkID0gY29tcHV0ZURpZ2VzdChtZXNzYWdlKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGYyJyB8fCB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGlmZjInIHx8XG4gICAgICAgIHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3htYicpIHtcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWQgPSBjb21wdXRlRGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtZXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgLy8gVGhpcyBvY2N1cnMgaWYgd2UgYXJlIGRvaW5nIHRoZSAybmQgcGFzcyBhZnRlciB3aGl0ZXNwYWNlIHJlbW92YWwgKHNlZSBgcGFyc2VUZW1wbGF0ZSgpYCBpblxuICAgICAgLy8gYHBhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUudHNgKS5cbiAgICAgIC8vIEluIHRoYXQgY2FzZSB3ZSB3YW50IHRvIHJldXNlIHRoZSBsZWdhY3kgbWVzc2FnZSBnZW5lcmF0ZWQgaW4gdGhlIDFzdCBwYXNzIChzZWVcbiAgICAgIC8vIGBzZXRJMThuUmVmcygpYCkuXG4gICAgICBjb25zdCBwcmV2aW91c01lc3NhZ2UgPSBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlID9cbiAgICAgICAgICBtZXRhIDpcbiAgICAgICAgICBtZXRhIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlciA/IG1ldGEucHJldmlvdXNNZXNzYWdlIDogdW5kZWZpbmVkO1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZCA9IHByZXZpb3VzTWVzc2FnZSAmJiBwcmV2aW91c01lc3NhZ2UubGVnYWN5SWQ7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXRhRnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgaWQ6IHN0cmluZyB8IG51bGwgPSBudWxsKTogSTE4bk1ldGEge1xuICByZXR1cm4ge1xuICAgIGlkOiB0eXBlb2YgaWQgPT09ICdzdHJpbmcnID8gaWQgOiBtZXNzYWdlLmlkIHx8ICcnLFxuICAgIGN1c3RvbUlkOiBtZXNzYWdlLmN1c3RvbUlkLFxuICAgIGxlZ2FjeUlkOiBtZXNzYWdlLmxlZ2FjeUlkLFxuICAgIG1lYW5pbmc6IG1lc3NhZ2UubWVhbmluZyB8fCAnJyxcbiAgICBkZXNjcmlwdGlvbjogbWVzc2FnZS5kZXNjcmlwdGlvbiB8fCAnJ1xuICB9O1xufVxuXG4vKiogSTE4biBzZXBhcmF0b3JzIGZvciBtZXRhZGF0YSAqKi9cbmNvbnN0IEkxOE5fTUVBTklOR19TRVBBUkFUT1IgPSAnfCc7XG5jb25zdCBJMThOX0lEX1NFUEFSQVRPUiA9ICdAQCc7XG5cbi8qKlxuICogUGFyc2VzIGkxOG4gbWV0YXMgbGlrZTpcbiAqICAtIFwiQEBpZFwiLFxuICogIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuICogIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbiAqIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHBhcnNlZCBvdXRwdXQuXG4gKlxuICogQHBhcmFtIG1ldGEgU3RyaW5nIHRoYXQgcmVwcmVzZW50cyBpMThuIG1ldGFcbiAqIEByZXR1cm5zIE9iamVjdCB3aXRoIGlkLCBtZWFuaW5nIGFuZCBkZXNjcmlwdGlvbiBmaWVsZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEobWV0YT86IHN0cmluZyk6IEkxOG5NZXRhIHtcbiAgbGV0IGN1c3RvbUlkOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGlmIChtZXRhKSB7XG4gICAgY29uc3QgaWRJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX0lEX1NFUEFSQVRPUik7XG4gICAgY29uc3QgZGVzY0luZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgY3VzdG9tSWRdID1cbiAgICAgICAgKGlkSW5kZXggPiAtMSkgPyBbbWV0YS5zbGljZSgwLCBpZEluZGV4KSwgbWV0YS5zbGljZShpZEluZGV4ICsgMildIDogW21ldGEsICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID0gKGRlc2NJbmRleCA+IC0xKSA/XG4gICAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgICBbJycsIG1lYW5pbmdBbmREZXNjXTtcbiAgfVxuXG4gIHJldHVybiB7Y3VzdG9tSWQsIG1lYW5pbmcsIGRlc2NyaXB0aW9ufTtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBtZXRhYCBhbmQgYG1lc3NhZ2VQYXJ0YCBhIHN0cmluZyB0aGF0IGNhbiBiZSB1c2VkIGluIGEgYCRsb2NhbGl6ZWBcbiAqIHRhZ2dlZCBzdHJpbmcuIFRoZSBmb3JtYXQgb2YgdGhlIG1ldGFkYXRhIGlzIHRoZSBzYW1lIGFzIHRoYXQgcGFyc2VkIGJ5IGBwYXJzZUkxOG5NZXRhKClgLlxuICpcbiAqIEBwYXJhbSBtZXRhIFRoZSBtZXRhZGF0YSB0byBzZXJpYWxpemVcbiAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZmlyc3QgcGFydCBvZiB0aGUgdGFnZ2VkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSTE4bkhlYWQobWV0YTogSTE4bk1ldGEsIG1lc3NhZ2VQYXJ0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgbWV0YUJsb2NrID0gbWV0YS5kZXNjcmlwdGlvbiB8fCAnJztcbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIG1ldGFCbG9jayA9IGAke21ldGEubWVhbmluZ318JHttZXRhQmxvY2t9YDtcbiAgfVxuICBpZiAobWV0YS5jdXN0b21JZCB8fCBtZXRhLmxlZ2FjeUlkKSB7XG4gICAgbWV0YUJsb2NrID0gYCR7bWV0YUJsb2NrfUBAJHttZXRhLmN1c3RvbUlkIHx8IG1ldGEubGVnYWN5SWR9YDtcbiAgfVxuICBpZiAobWV0YUJsb2NrID09PSAnJykge1xuICAgIC8vIFRoZXJlIGlzIG5vIG1ldGFCbG9jaywgc28gd2UgbXVzdCBlbnN1cmUgdGhhdCBhbnkgc3RhcnRpbmcgY29sb24gaXMgZXNjYXBlZC5cbiAgICByZXR1cm4gZXNjYXBlU3RhcnRpbmdDb2xvbihtZXNzYWdlUGFydCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGA6JHtlc2NhcGVDb2xvbnMobWV0YUJsb2NrKX06JHttZXNzYWdlUGFydH1gO1xuICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXplIHRoZSBnaXZlbiBgcGxhY2Vob2xkZXJOYW1lYCBhbmQgYG1lc3NhZ2VQYXJ0YCBpbnRvIHN0cmluZ3MgdGhhdCBjYW4gYmUgdXNlZCBpbiBhXG4gKiBgJGxvY2FsaXplYCB0YWdnZWQgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSBwbGFjZWhvbGRlck5hbWUgVGhlIHBsYWNlaG9sZGVyIG5hbWUgdG8gc2VyaWFsaXplXG4gKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIGZvbGxvd2luZyBtZXNzYWdlIHN0cmluZyBhZnRlciB0aGlzIHBsYWNlaG9sZGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KHBsYWNlaG9sZGVyTmFtZTogc3RyaW5nLCBtZXNzYWdlUGFydDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHBsYWNlaG9sZGVyTmFtZSA9PT0gJycpIHtcbiAgICAvLyBUaGVyZSBpcyBubyBwbGFjZWhvbGRlciBuYW1lIGJsb2NrLCBzbyB3ZSBtdXN0IGVuc3VyZSB0aGF0IGFueSBzdGFydGluZyBjb2xvbiBpcyBlc2NhcGVkLlxuICAgIHJldHVybiBlc2NhcGVTdGFydGluZ0NvbG9uKG1lc3NhZ2VQYXJ0KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYDoke3BsYWNlaG9sZGVyTmFtZX06JHttZXNzYWdlUGFydH1gO1xuICB9XG59XG5cbi8vIENvbnZlcnRzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiBmb3IgYSBtZXNzYWdlIChpZCwgZGVzY3JpcHRpb24sIG1lYW5pbmcpXG4vLyB0byBhIEpzRG9jIHN0YXRlbWVudCBmb3JtYXR0ZWQgYXMgZXhwZWN0ZWQgYnkgdGhlIENsb3N1cmUgY29tcGlsZXIuXG5leHBvcnQgZnVuY3Rpb24gaTE4bk1ldGFUb0RvY1N0bXQobWV0YTogSTE4bk1ldGEpOiBvLkpTRG9jQ29tbWVudFN0bXR8bnVsbCB7XG4gIGNvbnN0IHRhZ3M6IG8uSlNEb2NUYWdbXSA9IFtdO1xuICBpZiAobWV0YS5kZXNjcmlwdGlvbikge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuRGVzYywgdGV4dDogbWV0YS5kZXNjcmlwdGlvbn0pO1xuICB9XG4gIGlmIChtZXRhLm1lYW5pbmcpIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLk1lYW5pbmcsIHRleHQ6IG1ldGEubWVhbmluZ30pO1xuICB9XG4gIHJldHVybiB0YWdzLmxlbmd0aCA9PSAwID8gbnVsbCA6IG5ldyBvLkpTRG9jQ29tbWVudFN0bXQodGFncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVTdGFydGluZ0NvbG9uKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eOi8sICdcXFxcOicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlQ29sb25zKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC86L2csICdcXFxcOicpO1xufSJdfQ==