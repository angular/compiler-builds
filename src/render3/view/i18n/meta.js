/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/view/i18n/meta", ["require", "exports", "tslib", "@angular/compiler/src/i18n/digest", "@angular/compiler/src/i18n/i18n_ast", "@angular/compiler/src/i18n/i18n_parser", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var digest_1 = require("@angular/compiler/src/i18n/digest");
    var i18n = require("@angular/compiler/src/i18n/i18n_ast");
    var i18n_parser_1 = require("@angular/compiler/src/i18n/i18n_parser");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var o = require("@angular/compiler/src/output/output_ast");
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
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
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
            if (keepI18nAttrs === void 0) { keepI18nAttrs = false; }
            if (i18nLegacyMessageIdFormat === void 0) { i18nLegacyMessageIdFormat = ''; }
            this.interpolationConfig = interpolationConfig;
            this.keepI18nAttrs = keepI18nAttrs;
            this.i18nLegacyMessageIdFormat = i18nLegacyMessageIdFormat;
            // whether visited nodes contain i18n information
            this.hasI18nMeta = false;
            // i18n message generation factory
            this._createI18nMessage = i18n_parser_1.createI18nMessageFactory(this.interpolationConfig);
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
            if (util_1.hasI18nAttrs(element)) {
                this.hasI18nMeta = true;
                var attrs = [];
                var attrsMeta = {};
                try {
                    for (var _c = tslib_1.__values(element.attrs), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var attr = _d.value;
                        if (attr.name === util_1.I18N_ATTR) {
                            // root 'i18n' node attribute
                            var i18n_1 = element.i18n || attr.value;
                            var message = this._generateI18nMessage(element.children, i18n_1, setI18nRefs);
                            // do not assign empty i18n meta
                            if (message.nodes.length) {
                                element.i18n = message;
                            }
                        }
                        else if (attr.name.startsWith(util_1.I18N_ATTR_PREFIX)) {
                            // 'i18n-*' attributes
                            var key = attr.name.slice(util_1.I18N_ATTR_PREFIX.length);
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
                        for (var attrs_1 = tslib_1.__values(attrs), attrs_1_1 = attrs_1.next(); !attrs_1_1.done; attrs_1_1 = attrs_1.next()) {
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
                var icu = util_1.icuFromI18nMessage(message);
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
                message.id = meta instanceof i18n.Message && meta.id || digest_1.decimalDigest(message);
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
                message.legacyId = digest_1.computeDigest(message);
            }
            else if (this.i18nLegacyMessageIdFormat === 'xlf2' || this.i18nLegacyMessageIdFormat === 'xliff2' ||
                this.i18nLegacyMessageIdFormat === 'xmb') {
                message.legacyId = digest_1.computeDecimalDigest(message);
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
    exports.I18nMetaVisitor = I18nMetaVisitor;
    function metaFromI18nMessage(message, id) {
        if (id === void 0) { id = null; }
        return {
            id: typeof id === 'string' ? id : message.id || '',
            customId: message.customId,
            legacyId: message.legacyId,
            meaning: message.meaning || '',
            description: message.description || ''
        };
    }
    exports.metaFromI18nMessage = metaFromI18nMessage;
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
    function parseI18nMeta(meta) {
        var _a, _b;
        var customId;
        var meaning;
        var description;
        if (meta) {
            var idIndex = meta.indexOf(I18N_ID_SEPARATOR);
            var descIndex = meta.indexOf(I18N_MEANING_SEPARATOR);
            var meaningAndDesc = void 0;
            _a = tslib_1.__read((idIndex > -1) ? [meta.slice(0, idIndex), meta.slice(idIndex + 2)] : [meta, ''], 2), meaningAndDesc = _a[0], customId = _a[1];
            _b = tslib_1.__read((descIndex > -1) ?
                [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
                ['', meaningAndDesc], 2), meaning = _b[0], description = _b[1];
        }
        return { customId: customId, meaning: meaning, description: description };
    }
    exports.parseI18nMeta = parseI18nMeta;
    /**
     * Serialize the given `meta` and `messagePart` a string that can be used in a `$localize`
     * tagged string. The format of the metadata is the same as that parsed by `parseI18nMeta()`.
     *
     * @param meta The metadata to serialize
     * @param messagePart The first part of the tagged string
     */
    function serializeI18nHead(meta, messagePart) {
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
    exports.serializeI18nHead = serializeI18nHead;
    /**
     * Serialize the given `placeholderName` and `messagePart` into strings that can be used in a
     * `$localize` tagged string.
     *
     * @param placeholderName The placeholder name to serialize
     * @param messagePart The following message string after this placeholder
     */
    function serializeI18nTemplatePart(placeholderName, messagePart) {
        if (placeholderName === '') {
            // There is no placeholder name block, so we must ensure that any starting colon is escaped.
            return escapeStartingColon(messagePart);
        }
        else {
            return ":" + placeholderName + ":" + messagePart;
        }
    }
    exports.serializeI18nTemplatePart = serializeI18nTemplatePart;
    // Converts i18n meta information for a message (id, description, meaning)
    // to a JsDoc statement formatted as expected by the Closure compiler.
    function i18nMetaToDocStmt(meta) {
        var tags = [];
        if (meta.description) {
            tags.push({ tagName: "desc" /* Desc */, text: meta.description });
        }
        if (meta.meaning) {
            tags.push({ tagName: "meaning" /* Meaning */, text: meta.meaning });
        }
        return tags.length == 0 ? null : new o.JSDocCommentStmt(tags);
    }
    exports.i18nMetaToDocStmt = i18nMetaToDocStmt;
    function escapeStartingColon(str) {
        return str.replace(/^:/, '\\:');
    }
    exports.escapeStartingColon = escapeStartingColon;
    function escapeColons(str) {
        return str.replace(/:/g, '\\:');
    }
    exports.escapeColons = escapeColons;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDREQUF3RjtJQUN4RiwwREFBK0M7SUFDL0Msc0VBQWdGO0lBQ2hGLDBEQUErQztJQUMvQyw2RkFBMEc7SUFDMUcsMkRBQWdEO0lBRWhELHFFQUFxRjtJQVdyRixJQUFNLFdBQVcsR0FBZ0IsVUFBQyxRQUFRLEVBQUUsUUFBUTtRQUNsRCxJQUFJLFFBQVEsWUFBWSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3pDLElBQUksUUFBUSxZQUFZLElBQUksQ0FBQyxjQUFjLElBQUksUUFBUSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUNwRiwyRkFBMkY7Z0JBQzNGLG9GQUFvRjtnQkFDcEYsMkZBQTJGO2dCQUMzRiwyRUFBMkU7Z0JBQzNFLFFBQVEsQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQzthQUMxQztZQUNELFFBQVEsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDO1NBQzFCO1FBQ0QsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQyxDQUFDO0lBRUY7Ozs7T0FJRztJQUNIO1FBT0UseUJBQ1ksbUJBQXVFLEVBQ3ZFLGFBQThCLEVBQVUseUJBQXNDO1lBRDlFLG9DQUFBLEVBQUEsc0JBQTJDLG1EQUE0QjtZQUN2RSw4QkFBQSxFQUFBLHFCQUE4QjtZQUFVLDBDQUFBLEVBQUEsOEJBQXNDO1lBRDlFLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0Q7WUFDdkUsa0JBQWEsR0FBYixhQUFhLENBQWlCO1lBQVUsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFhO1lBUjFGLGlEQUFpRDtZQUMxQyxnQkFBVyxHQUFZLEtBQUssQ0FBQztZQUVwQyxr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Qiw0RkFBNEY7WUFDNUYsT0FBTyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUN6QzthQUFNO1lBQ0wsT0FBTyxNQUFJLGVBQWUsU0FBSSxXQUFhLENBQUM7U0FDN0M7SUFDSCxDQUFDO0lBUEQsOERBT0M7SUFFRCwwRUFBMEU7SUFDMUUsc0VBQXNFO0lBQ3RFLFNBQWdCLGlCQUFpQixDQUFDLElBQWM7UUFDOUMsSUFBTSxJQUFJLEdBQWlCLEVBQUUsQ0FBQztRQUM5QixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sbUJBQXFCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUMsQ0FBQyxDQUFDO1NBQ25FO1FBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLHlCQUF3QixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQztTQUNsRTtRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQVRELDhDQVNDO0lBRUQsU0FBZ0IsbUJBQW1CLENBQUMsR0FBVztRQUM3QyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFGRCxrREFFQztJQUVELFNBQWdCLFlBQVksQ0FBQyxHQUFXO1FBQ3RDLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUZELG9DQUVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NvbXB1dGVEZWNpbWFsRGlnZXN0LCBjb21wdXRlRGlnZXN0LCBkZWNpbWFsRGlnZXN0fSBmcm9tICcuLi8uLi8uLi9pMThuL2RpZ2VzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtWaXNpdE5vZGVGbiwgY3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5fSBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHtJMThOX0FUVFIsIEkxOE5fQVRUUl9QUkVGSVgsIGhhc0kxOG5BdHRycywgaWN1RnJvbUkxOG5NZXNzYWdlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBJMThuTWV0YSA9IHtcbiAgaWQ/OiBzdHJpbmcsXG4gIGN1c3RvbUlkPzogc3RyaW5nLFxuICBsZWdhY3lJZD86IHN0cmluZyxcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG4gIG1lYW5pbmc/OiBzdHJpbmdcbn07XG5cblxuY29uc3Qgc2V0STE4blJlZnM6IFZpc2l0Tm9kZUZuID0gKGh0bWxOb2RlLCBpMThuTm9kZSkgPT4ge1xuICBpZiAoaHRtbE5vZGUgaW5zdGFuY2VvZiBodG1sLk5vZGVXaXRoSTE4bikge1xuICAgIGlmIChpMThuTm9kZSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXIgJiYgaHRtbE5vZGUuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgICAgLy8gVGhpcyBodG1sIG5vZGUgcmVwcmVzZW50cyBhbiBJQ1UgYnV0IHRoaXMgaXMgYSBzZWNvbmQgcHJvY2Vzc2luZyBwYXNzLCBhbmQgdGhlIGxlZ2FjeSBpZFxuICAgICAgLy8gd2FzIGNvbXB1dGVkIGluIHRoZSBwcmV2aW91cyBwYXNzIGFuZCBzdG9yZWQgaW4gdGhlIGBpMThuYCBwcm9wZXJ0eSBhcyBhIG1lc3NhZ2UuXG4gICAgICAvLyBXZSBhcmUgYWJvdXQgdG8gd2lwZSBvdXQgdGhhdCBwcm9wZXJ0eSBzbyBjYXB0dXJlIHRoZSBwcmV2aW91cyBtZXNzYWdlIHRvIGJlIHJldXNlZCB3aGVuXG4gICAgICAvLyBnZW5lcmF0aW5nIHRoZSBtZXNzYWdlIGZvciB0aGlzIElDVSBsYXRlci4gU2VlIGBfZ2VuZXJhdGVJMThuTWVzc2FnZSgpYC5cbiAgICAgIGkxOG5Ob2RlLnByZXZpb3VzTWVzc2FnZSA9IGh0bWxOb2RlLmkxOG47XG4gICAgfVxuICAgIGh0bWxOb2RlLmkxOG4gPSBpMThuTm9kZTtcbiAgfVxuICByZXR1cm4gaTE4bk5vZGU7XG59O1xuXG4vKipcbiAqIFRoaXMgdmlzaXRvciB3YWxrcyBvdmVyIEhUTUwgcGFyc2UgdHJlZSBhbmQgY29udmVydHMgaW5mb3JtYXRpb24gc3RvcmVkIGluXG4gKiBpMThuLXJlbGF0ZWQgYXR0cmlidXRlcyAoXCJpMThuXCIgYW5kIFwiaTE4bi0qXCIpIGludG8gaTE4biBtZXRhIG9iamVjdCB0aGF0IGlzXG4gKiBzdG9yZWQgd2l0aCBvdGhlciBlbGVtZW50J3MgYW5kIGF0dHJpYnV0ZSdzIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgSTE4bk1ldGFWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgLy8gd2hldGhlciB2aXNpdGVkIG5vZGVzIGNvbnRhaW4gaTE4biBpbmZvcm1hdGlvblxuICBwdWJsaWMgaGFzSTE4bk1ldGE6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAvLyBpMThuIG1lc3NhZ2UgZ2VuZXJhdGlvbiBmYWN0b3J5XG4gIHByaXZhdGUgX2NyZWF0ZUkxOG5NZXNzYWdlID0gY3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5KHRoaXMuaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgICAgcHJpdmF0ZSBrZWVwSTE4bkF0dHJzOiBib29sZWFuID0gZmFsc2UsIHByaXZhdGUgaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdDogc3RyaW5nID0gJycpIHt9XG5cbiAgcHJpdmF0ZSBfZ2VuZXJhdGVJMThuTWVzc2FnZShcbiAgICAgIG5vZGVzOiBodG1sLk5vZGVbXSwgbWV0YTogc3RyaW5nfGkxOG4uSTE4bk1ldGEgPSAnJyxcbiAgICAgIHZpc2l0Tm9kZUZuPzogVmlzaXROb2RlRm4pOiBpMThuLk1lc3NhZ2Uge1xuICAgIGNvbnN0IHttZWFuaW5nLCBkZXNjcmlwdGlvbiwgY3VzdG9tSWR9ID0gdGhpcy5fcGFyc2VNZXRhZGF0YShtZXRhKTtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fY3JlYXRlSTE4bk1lc3NhZ2Uobm9kZXMsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZCwgdmlzaXROb2RlRm4pO1xuICAgIHRoaXMuX3NldE1lc3NhZ2VJZChtZXNzYWdlLCBtZXRhKTtcbiAgICB0aGlzLl9zZXRMZWdhY3lJZChtZXNzYWdlLCBtZXRhKTtcbiAgICByZXR1cm4gbWVzc2FnZTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBodG1sLkVsZW1lbnQpOiBhbnkge1xuICAgIGlmIChoYXNJMThuQXR0cnMoZWxlbWVudCkpIHtcbiAgICAgIHRoaXMuaGFzSTE4bk1ldGEgPSB0cnVlO1xuICAgICAgY29uc3QgYXR0cnM6IGh0bWwuQXR0cmlidXRlW10gPSBbXTtcbiAgICAgIGNvbnN0IGF0dHJzTWV0YToge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cnMpIHtcbiAgICAgICAgaWYgKGF0dHIubmFtZSA9PT0gSTE4Tl9BVFRSKSB7XG4gICAgICAgICAgLy8gcm9vdCAnaTE4bicgbm9kZSBhdHRyaWJ1dGVcbiAgICAgICAgICBjb25zdCBpMThuID0gZWxlbWVudC5pMThuIHx8IGF0dHIudmFsdWU7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoZWxlbWVudC5jaGlsZHJlbiwgaTE4biwgc2V0STE4blJlZnMpO1xuICAgICAgICAgIC8vIGRvIG5vdCBhc3NpZ24gZW1wdHkgaTE4biBtZXRhXG4gICAgICAgICAgaWYgKG1lc3NhZ2Uubm9kZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBlbGVtZW50LmkxOG4gPSBtZXNzYWdlO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHIubmFtZS5zdGFydHNXaXRoKEkxOE5fQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgICAgLy8gJ2kxOG4tKicgYXR0cmlidXRlc1xuICAgICAgICAgIGNvbnN0IGtleSA9IGF0dHIubmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICAgICAgYXR0cnNNZXRhW2tleV0gPSBhdHRyLnZhbHVlO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbm9uLWkxOG4gYXR0cmlidXRlc1xuICAgICAgICAgIGF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc2V0IGkxOG4gbWV0YSBmb3IgYXR0cmlidXRlc1xuICAgICAgaWYgKE9iamVjdC5rZXlzKGF0dHJzTWV0YSkubGVuZ3RoKSB7XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBhdHRycykge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBhdHRyc01ldGFbYXR0ci5uYW1lXTtcbiAgICAgICAgICAvLyBkbyBub3QgY3JlYXRlIHRyYW5zbGF0aW9uIGZvciBlbXB0eSBhdHRyaWJ1dGVzXG4gICAgICAgICAgaWYgKG1ldGEgIT09IHVuZGVmaW5lZCAmJiBhdHRyLnZhbHVlKSB7XG4gICAgICAgICAgICBhdHRyLmkxOG4gPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFthdHRyXSwgYXR0ci5pMThuIHx8IG1ldGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMua2VlcEkxOG5BdHRycykge1xuICAgICAgICAvLyB1cGRhdGUgZWxlbWVudCdzIGF0dHJpYnV0ZXMsXG4gICAgICAgIC8vIGtlZXBpbmcgb25seSBub24taTE4biByZWxhdGVkIG9uZXNcbiAgICAgICAgZWxlbWVudC5hdHRycyA9IGF0dHJzO1xuICAgICAgfVxuICAgIH1cbiAgICBodG1sLnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4sIGVsZW1lbnQuaTE4bik7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjdXJyZW50TWVzc2FnZTogaTE4bi5NZXNzYWdlfHVuZGVmaW5lZCk6IGFueSB7XG4gICAgbGV0IG1lc3NhZ2U7XG4gICAgY29uc3QgbWV0YSA9IGV4cGFuc2lvbi5pMThuO1xuICAgIHRoaXMuaGFzSTE4bk1ldGEgPSB0cnVlO1xuICAgIGlmIChtZXRhIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlcikge1xuICAgICAgLy8gc2V0IElDVSBwbGFjZWhvbGRlciBuYW1lIChlLmcuIFwiSUNVXzFcIiksXG4gICAgICAvLyBnZW5lcmF0ZWQgd2hpbGUgcHJvY2Vzc2luZyByb290IGVsZW1lbnQgY29udGVudHMsXG4gICAgICAvLyBzbyB3ZSBjYW4gcmVmZXJlbmNlIGl0IHdoZW4gd2Ugb3V0cHV0IHRyYW5zbGF0aW9uXG4gICAgICBjb25zdCBuYW1lID0gbWV0YS5uYW1lO1xuICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2V4cGFuc2lvbl0sIG1ldGEpO1xuICAgICAgY29uc3QgaWN1ID0gaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgaWN1Lm5hbWUgPSBuYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJQ1UgaXMgYSB0b3AgbGV2ZWwgbWVzc2FnZSwgdHJ5IHRvIHVzZSBtZXRhZGF0YSBmcm9tIGNvbnRhaW5lciBlbGVtZW50IGlmIHByb3ZpZGVkIHZpYVxuICAgICAgLy8gYGNvbnRleHRgIGFyZ3VtZW50LiBOb3RlOiBjb250ZXh0IG1heSBub3QgYmUgYXZhaWxhYmxlIGZvciBzdGFuZGFsb25lIElDVXMgKHdpdGhvdXRcbiAgICAgIC8vIHdyYXBwaW5nIGVsZW1lbnQpLCBzbyBmYWxsYmFjayB0byBJQ1UgbWV0YWRhdGEgaW4gdGhpcyBjYXNlLlxuICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2V4cGFuc2lvbl0sIGN1cnJlbnRNZXNzYWdlIHx8IG1ldGEpO1xuICAgIH1cbiAgICBleHBhbnNpb24uaTE4biA9IG1lc3NhZ2U7XG4gICAgcmV0dXJuIGV4cGFuc2lvbjtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQpOiBhbnkgeyByZXR1cm4gdGV4dDsgfVxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogYW55IHsgcmV0dXJuIGF0dHJpYnV0ZTsgfVxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogYW55IHsgcmV0dXJuIGNvbW1lbnQ7IH1cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSk6IGFueSB7IHJldHVybiBleHBhbnNpb25DYXNlOyB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHRoZSBnZW5lcmFsIGZvcm0gYG1ldGFgIHBhc3NlZCBpbnRvIGV4dHJhY3QgdGhlIGV4cGxpY2l0IG1ldGFkYXRhIG5lZWRlZCB0byBjcmVhdGUgYVxuICAgKiBgTWVzc2FnZWAuXG4gICAqXG4gICAqIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJpbGl0aWVzIGZvciB0aGUgYG1ldGFgIHZhcmlhYmxlXG4gICAqIDEpIGEgc3RyaW5nIGZyb20gYW4gYGkxOG5gIHRlbXBsYXRlIGF0dHJpYnV0ZTogcGFyc2UgaXQgdG8gZXh0cmFjdCB0aGUgbWV0YWRhdGEgdmFsdWVzLlxuICAgKiAyKSBhIGBNZXNzYWdlYCBmcm9tIGEgcHJldmlvdXMgcHJvY2Vzc2luZyBwYXNzOiByZXVzZSB0aGUgbWV0YWRhdGEgdmFsdWVzIGluIHRoZSBtZXNzYWdlLlxuICAgKiA0KSBvdGhlcjogaWdub3JlIHRoaXMgYW5kIGp1c3QgcHJvY2VzcyB0aGUgbWVzc2FnZSBtZXRhZGF0YSBhcyBub3JtYWxcbiAgICpcbiAgICogQHBhcmFtIG1ldGEgdGhlIGJ1Y2tldCB0aGF0IGhvbGRzIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtZXNzYWdlXG4gICAqIEByZXR1cm5zIHRoZSBwYXJzZWQgbWV0YWRhdGEuXG4gICAqL1xuICBwcml2YXRlIF9wYXJzZU1ldGFkYXRhKG1ldGE6IHN0cmluZ3xpMThuLkkxOG5NZXRhKTogSTE4bk1ldGEge1xuICAgIHJldHVybiB0eXBlb2YgbWV0YSA9PT0gJ3N0cmluZycgPyBwYXJzZUkxOG5NZXRhKG1ldGEpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSA/IG1ldGFGcm9tSTE4bk1lc3NhZ2UobWV0YSkgOiB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSAob3IgcmVzdG9yZSkgbWVzc2FnZSBpZCBpZiBub3Qgc3BlY2lmaWVkIGFscmVhZHkuXG4gICAqL1xuICBwcml2YXRlIF9zZXRNZXNzYWdlSWQobWVzc2FnZTogaTE4bi5NZXNzYWdlLCBtZXRhOiBzdHJpbmd8aTE4bi5JMThuTWV0YSk6IHZvaWQge1xuICAgIGlmICghbWVzc2FnZS5pZCkge1xuICAgICAgbWVzc2FnZS5pZCA9IG1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgJiYgbWV0YS5pZCB8fCBkZWNpbWFsRGlnZXN0KG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIGBtZXNzYWdlYCB3aXRoIGEgYGxlZ2FjeUlkYCBpZiBuZWNlc3NhcnkuXG4gICAqXG4gICAqIEBwYXJhbSBtZXNzYWdlIHRoZSBtZXNzYWdlIHdob3NlIGxlZ2FjeSBpZCBzaG91bGQgYmUgc2V0XG4gICAqIEBwYXJhbSBtZXRhIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtZXNzYWdlIGJlaW5nIHByb2Nlc3NlZFxuICAgKi9cbiAgcHJpdmF0ZSBfc2V0TGVnYWN5SWQobWVzc2FnZTogaTE4bi5NZXNzYWdlLCBtZXRhOiBzdHJpbmd8aTE4bi5JMThuTWV0YSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGYnIHx8IHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsaWZmJykge1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZCA9IGNvbXB1dGVEaWdlc3QobWVzc2FnZSk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgdGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneGxmMicgfHwgdGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneGxpZmYyJyB8fFxuICAgICAgICB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bWInKSB7XG4gICAgICBtZXNzYWdlLmxlZ2FjeUlkID0gY29tcHV0ZURlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWV0YSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFRoaXMgb2NjdXJzIGlmIHdlIGFyZSBkb2luZyB0aGUgMm5kIHBhc3MgYWZ0ZXIgd2hpdGVzcGFjZSByZW1vdmFsIChzZWUgYHBhcnNlVGVtcGxhdGUoKWAgaW5cbiAgICAgIC8vIGBwYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzYCkuXG4gICAgICAvLyBJbiB0aGF0IGNhc2Ugd2Ugd2FudCB0byByZXVzZSB0aGUgbGVnYWN5IG1lc3NhZ2UgZ2VuZXJhdGVkIGluIHRoZSAxc3QgcGFzcyAoc2VlXG4gICAgICAvLyBgc2V0STE4blJlZnMoKWApLlxuICAgICAgY29uc3QgcHJldmlvdXNNZXNzYWdlID0gbWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSA/XG4gICAgICAgICAgbWV0YSA6XG4gICAgICAgICAgbWV0YSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXIgPyBtZXRhLnByZXZpb3VzTWVzc2FnZSA6IHVuZGVmaW5lZDtcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWQgPSBwcmV2aW91c01lc3NhZ2UgJiYgcHJldmlvdXNNZXNzYWdlLmxlZ2FjeUlkO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbWV0YUZyb21JMThuTWVzc2FnZShtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIGlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IEkxOG5NZXRhIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdHlwZW9mIGlkID09PSAnc3RyaW5nJyA/IGlkIDogbWVzc2FnZS5pZCB8fCAnJyxcbiAgICBjdXN0b21JZDogbWVzc2FnZS5jdXN0b21JZCxcbiAgICBsZWdhY3lJZDogbWVzc2FnZS5sZWdhY3lJZCxcbiAgICBtZWFuaW5nOiBtZXNzYWdlLm1lYW5pbmcgfHwgJycsXG4gICAgZGVzY3JpcHRpb246IG1lc3NhZ2UuZGVzY3JpcHRpb24gfHwgJydcbiAgfTtcbn1cblxuLyoqIEkxOG4gc2VwYXJhdG9ycyBmb3IgbWV0YWRhdGEgKiovXG5jb25zdCBJMThOX01FQU5JTkdfU0VQQVJBVE9SID0gJ3wnO1xuY29uc3QgSTE4Tl9JRF9TRVBBUkFUT1IgPSAnQEAnO1xuXG4vKipcbiAqIFBhcnNlcyBpMThuIG1ldGFzIGxpa2U6XG4gKiAgLSBcIkBAaWRcIixcbiAqICAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbiAqICAtIFwibWVhbmluZ3xkZXNjcmlwdGlvbltAQGlkXVwiXG4gKiBhbmQgcmV0dXJucyBhbiBvYmplY3Qgd2l0aCBwYXJzZWQgb3V0cHV0LlxuICpcbiAqIEBwYXJhbSBtZXRhIFN0cmluZyB0aGF0IHJlcHJlc2VudHMgaTE4biBtZXRhXG4gKiBAcmV0dXJucyBPYmplY3Qgd2l0aCBpZCwgbWVhbmluZyBhbmQgZGVzY3JpcHRpb24gZmllbGRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUkxOG5NZXRhKG1ldGE/OiBzdHJpbmcpOiBJMThuTWV0YSB7XG4gIGxldCBjdXN0b21JZDogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZDtcblxuICBpZiAobWV0YSkge1xuICAgIGNvbnN0IGlkSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9JRF9TRVBBUkFUT1IpO1xuICAgIGNvbnN0IGRlc2NJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX01FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGN1c3RvbUlkXSA9XG4gICAgICAgIChpZEluZGV4ID4gLTEpID8gW21ldGEuc2xpY2UoMCwgaWRJbmRleCksIG1ldGEuc2xpY2UoaWRJbmRleCArIDIpXSA6IFttZXRhLCAnJ107XG4gICAgW21lYW5pbmcsIGRlc2NyaXB0aW9uXSA9IChkZXNjSW5kZXggPiAtMSkgP1xuICAgICAgICBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldIDpcbiAgICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2N1c3RvbUlkLCBtZWFuaW5nLCBkZXNjcmlwdGlvbn07XG59XG5cbi8qKlxuICogU2VyaWFsaXplIHRoZSBnaXZlbiBgbWV0YWAgYW5kIGBtZXNzYWdlUGFydGAgYSBzdHJpbmcgdGhhdCBjYW4gYmUgdXNlZCBpbiBhIGAkbG9jYWxpemVgXG4gKiB0YWdnZWQgc3RyaW5nLiBUaGUgZm9ybWF0IG9mIHRoZSBtZXRhZGF0YSBpcyB0aGUgc2FtZSBhcyB0aGF0IHBhcnNlZCBieSBgcGFyc2VJMThuTWV0YSgpYC5cbiAqXG4gKiBAcGFyYW0gbWV0YSBUaGUgbWV0YWRhdGEgdG8gc2VyaWFsaXplXG4gKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIGZpcnN0IHBhcnQgb2YgdGhlIHRhZ2dlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUkxOG5IZWFkKG1ldGE6IEkxOG5NZXRhLCBtZXNzYWdlUGFydDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IG1ldGFCbG9jayA9IG1ldGEuZGVzY3JpcHRpb24gfHwgJyc7XG4gIGlmIChtZXRhLm1lYW5pbmcpIHtcbiAgICBtZXRhQmxvY2sgPSBgJHttZXRhLm1lYW5pbmd9fCR7bWV0YUJsb2NrfWA7XG4gIH1cbiAgaWYgKG1ldGEuY3VzdG9tSWQgfHwgbWV0YS5sZWdhY3lJZCkge1xuICAgIG1ldGFCbG9jayA9IGAke21ldGFCbG9ja31AQCR7bWV0YS5jdXN0b21JZCB8fCBtZXRhLmxlZ2FjeUlkfWA7XG4gIH1cbiAgaWYgKG1ldGFCbG9jayA9PT0gJycpIHtcbiAgICAvLyBUaGVyZSBpcyBubyBtZXRhQmxvY2ssIHNvIHdlIG11c3QgZW5zdXJlIHRoYXQgYW55IHN0YXJ0aW5nIGNvbG9uIGlzIGVzY2FwZWQuXG4gICAgcmV0dXJuIGVzY2FwZVN0YXJ0aW5nQ29sb24obWVzc2FnZVBhcnQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBgOiR7ZXNjYXBlQ29sb25zKG1ldGFCbG9jayl9OiR7bWVzc2FnZVBhcnR9YDtcbiAgfVxufVxuXG4vKipcbiAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYHBsYWNlaG9sZGVyTmFtZWAgYW5kIGBtZXNzYWdlUGFydGAgaW50byBzdHJpbmdzIHRoYXQgY2FuIGJlIHVzZWQgaW4gYVxuICogYCRsb2NhbGl6ZWAgdGFnZ2VkIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0gcGxhY2Vob2xkZXJOYW1lIFRoZSBwbGFjZWhvbGRlciBuYW1lIHRvIHNlcmlhbGl6ZVxuICogQHBhcmFtIG1lc3NhZ2VQYXJ0IFRoZSBmb2xsb3dpbmcgbWVzc2FnZSBzdHJpbmcgYWZ0ZXIgdGhpcyBwbGFjZWhvbGRlclxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSTE4blRlbXBsYXRlUGFydChwbGFjZWhvbGRlck5hbWU6IHN0cmluZywgbWVzc2FnZVBhcnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChwbGFjZWhvbGRlck5hbWUgPT09ICcnKSB7XG4gICAgLy8gVGhlcmUgaXMgbm8gcGxhY2Vob2xkZXIgbmFtZSBibG9jaywgc28gd2UgbXVzdCBlbnN1cmUgdGhhdCBhbnkgc3RhcnRpbmcgY29sb24gaXMgZXNjYXBlZC5cbiAgICByZXR1cm4gZXNjYXBlU3RhcnRpbmdDb2xvbihtZXNzYWdlUGFydCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGA6JHtwbGFjZWhvbGRlck5hbWV9OiR7bWVzc2FnZVBhcnR9YDtcbiAgfVxufVxuXG4vLyBDb252ZXJ0cyBpMThuIG1ldGEgaW5mb3JtYXRpb24gZm9yIGEgbWVzc2FnZSAoaWQsIGRlc2NyaXB0aW9uLCBtZWFuaW5nKVxuLy8gdG8gYSBKc0RvYyBzdGF0ZW1lbnQgZm9ybWF0dGVkIGFzIGV4cGVjdGVkIGJ5IHRoZSBDbG9zdXJlIGNvbXBpbGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGkxOG5NZXRhVG9Eb2NTdG10KG1ldGE6IEkxOG5NZXRhKTogby5KU0RvY0NvbW1lbnRTdG10fG51bGwge1xuICBjb25zdCB0YWdzOiBvLkpTRG9jVGFnW10gPSBbXTtcbiAgaWYgKG1ldGEuZGVzY3JpcHRpb24pIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLkRlc2MsIHRleHQ6IG1ldGEuZGVzY3JpcHRpb259KTtcbiAgfVxuICBpZiAobWV0YS5tZWFuaW5nKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5NZWFuaW5nLCB0ZXh0OiBtZXRhLm1lYW5pbmd9KTtcbiAgfVxuICByZXR1cm4gdGFncy5sZW5ndGggPT0gMCA/IG51bGwgOiBuZXcgby5KU0RvY0NvbW1lbnRTdG10KHRhZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlU3RhcnRpbmdDb2xvbihzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXjovLCAnXFxcXDonKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUNvbG9ucyhzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvOi9nLCAnXFxcXDonKTtcbn0iXX0=