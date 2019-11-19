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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDREQUF3RjtJQUN4RiwwREFBK0M7SUFDL0Msc0VBQWdGO0lBQ2hGLDBEQUErQztJQUMvQyw2RkFBMEc7SUFDMUcsMkRBQWdEO0lBRWhELHFFQUFxRjtJQVdyRixJQUFNLFdBQVcsR0FBZ0IsVUFBQyxRQUFRLEVBQUUsUUFBUTtRQUNsRCxJQUFJLFFBQVEsWUFBWSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3pDLElBQUksUUFBUSxZQUFZLElBQUksQ0FBQyxjQUFjLElBQUksUUFBUSxDQUFDLElBQUksWUFBWSxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUNwRiwyRkFBMkY7Z0JBQzNGLG9GQUFvRjtnQkFDcEYsMkZBQTJGO2dCQUMzRiwyRUFBMkU7Z0JBQzNFLFFBQVEsQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQzthQUMxQztZQUNELFFBQVEsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDO1NBQzFCO1FBQ0QsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQyxDQUFDO0lBRUY7Ozs7T0FJRztJQUNIO1FBT0UseUJBQ1ksbUJBQXVFLEVBQ3ZFLGFBQThCLEVBQVUseUJBQXNDO1lBRDlFLG9DQUFBLEVBQUEsc0JBQTJDLG1EQUE0QjtZQUN2RSw4QkFBQSxFQUFBLHFCQUE4QjtZQUFVLDBDQUFBLEVBQUEsOEJBQXNDO1lBRDlFLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0Q7WUFDdkUsa0JBQWEsR0FBYixhQUFhLENBQWlCO1lBQVUsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFhO1lBUjFGLGlEQUFpRDtZQUMxQyxnQkFBVyxHQUFZLEtBQUssQ0FBQztZQUVwQyxr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SSxFQUFFO1lBQ1IsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ2hELElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQztZQUN2RCxJQUFJLGNBQWMsU0FBUSxDQUFDO1lBQzNCLHVHQUNtRixFQURsRixzQkFBYyxFQUFFLGdCQUFRLENBQzJEO1lBQ3BGOzt3Q0FFd0IsRUFGdkIsZUFBTyxFQUFFLG1CQUFXLENBRUk7U0FDMUI7UUFFRCxPQUFPLEVBQUMsUUFBUSxVQUFBLEVBQUUsT0FBTyxTQUFBLEVBQUUsV0FBVyxhQUFBLEVBQUMsQ0FBQztJQUMxQyxDQUFDO0lBakJELHNDQWlCQztJQUVELDBFQUEwRTtJQUMxRSxzRUFBc0U7SUFDdEUsU0FBZ0IsaUJBQWlCLENBQUMsSUFBYztRQUM5QyxJQUFNLElBQUksR0FBaUIsRUFBRSxDQUFDO1FBQzlCLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUMsT0FBTyxtQkFBcUIsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBQyxDQUFDLENBQUM7U0FDbkU7UUFDRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8seUJBQXdCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQyxDQUFDO1NBQ2xFO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBVEQsOENBU0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y29tcHV0ZURlY2ltYWxEaWdlc3QsIGNvbXB1dGVEaWdlc3QsIGRlY2ltYWxEaWdlc3R9IGZyb20gJy4uLy4uLy4uL2kxOG4vZGlnZXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge1Zpc2l0Tm9kZUZuLCBjcmVhdGVJMThuTWVzc2FnZUZhY3Rvcnl9IGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge0kxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgaGFzSTE4bkF0dHJzLCBpY3VGcm9tSTE4bk1lc3NhZ2V9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCB0eXBlIEkxOG5NZXRhID0ge1xuICBpZD86IHN0cmluZyxcbiAgY3VzdG9tSWQ/OiBzdHJpbmcsXG4gIGxlZ2FjeUlkPzogc3RyaW5nLFxuICBkZXNjcmlwdGlvbj86IHN0cmluZyxcbiAgbWVhbmluZz86IHN0cmluZ1xufTtcblxuXG5jb25zdCBzZXRJMThuUmVmczogVmlzaXROb2RlRm4gPSAoaHRtbE5vZGUsIGkxOG5Ob2RlKSA9PiB7XG4gIGlmIChodG1sTm9kZSBpbnN0YW5jZW9mIGh0bWwuTm9kZVdpdGhJMThuKSB7XG4gICAgaWYgKGkxOG5Ob2RlIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlciAmJiBodG1sTm9kZS5pMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgICAvLyBUaGlzIGh0bWwgbm9kZSByZXByZXNlbnRzIGFuIElDVSBidXQgdGhpcyBpcyBhIHNlY29uZCBwcm9jZXNzaW5nIHBhc3MsIGFuZCB0aGUgbGVnYWN5IGlkXG4gICAgICAvLyB3YXMgY29tcHV0ZWQgaW4gdGhlIHByZXZpb3VzIHBhc3MgYW5kIHN0b3JlZCBpbiB0aGUgYGkxOG5gIHByb3BlcnR5IGFzIGEgbWVzc2FnZS5cbiAgICAgIC8vIFdlIGFyZSBhYm91dCB0byB3aXBlIG91dCB0aGF0IHByb3BlcnR5IHNvIGNhcHR1cmUgdGhlIHByZXZpb3VzIG1lc3NhZ2UgdG8gYmUgcmV1c2VkIHdoZW5cbiAgICAgIC8vIGdlbmVyYXRpbmcgdGhlIG1lc3NhZ2UgZm9yIHRoaXMgSUNVIGxhdGVyLiBTZWUgYF9nZW5lcmF0ZUkxOG5NZXNzYWdlKClgLlxuICAgICAgaTE4bk5vZGUucHJldmlvdXNNZXNzYWdlID0gaHRtbE5vZGUuaTE4bjtcbiAgICB9XG4gICAgaHRtbE5vZGUuaTE4biA9IGkxOG5Ob2RlO1xuICB9XG4gIHJldHVybiBpMThuTm9kZTtcbn07XG5cbi8qKlxuICogVGhpcyB2aXNpdG9yIHdhbGtzIG92ZXIgSFRNTCBwYXJzZSB0cmVlIGFuZCBjb252ZXJ0cyBpbmZvcm1hdGlvbiBzdG9yZWQgaW5cbiAqIGkxOG4tcmVsYXRlZCBhdHRyaWJ1dGVzIChcImkxOG5cIiBhbmQgXCJpMThuLSpcIikgaW50byBpMThuIG1ldGEgb2JqZWN0IHRoYXQgaXNcbiAqIHN0b3JlZCB3aXRoIG90aGVyIGVsZW1lbnQncyBhbmQgYXR0cmlidXRlJ3MgaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBJMThuTWV0YVZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICAvLyB3aGV0aGVyIHZpc2l0ZWQgbm9kZXMgY29udGFpbiBpMThuIGluZm9ybWF0aW9uXG4gIHB1YmxpYyBoYXNJMThuTWV0YTogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIC8vIGkxOG4gbWVzc2FnZSBnZW5lcmF0aW9uIGZhY3RvcnlcbiAgcHJpdmF0ZSBfY3JlYXRlSTE4bk1lc3NhZ2UgPSBjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnkodGhpcy5pbnRlcnBvbGF0aW9uQ29uZmlnKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgICBwcml2YXRlIGtlZXBJMThuQXR0cnM6IGJvb2xlYW4gPSBmYWxzZSwgcHJpdmF0ZSBpMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0OiBzdHJpbmcgPSAnJykge31cblxuICBwcml2YXRlIF9nZW5lcmF0ZUkxOG5NZXNzYWdlKFxuICAgICAgbm9kZXM6IGh0bWwuTm9kZVtdLCBtZXRhOiBzdHJpbmd8aTE4bi5JMThuTWV0YSA9ICcnLFxuICAgICAgdmlzaXROb2RlRm4/OiBWaXNpdE5vZGVGbik6IGkxOG4uTWVzc2FnZSB7XG4gICAgY29uc3Qge21lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZH0gPSB0aGlzLl9wYXJzZU1ldGFkYXRhKG1ldGEpO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9jcmVhdGVJMThuTWVzc2FnZShub2RlcywgbWVhbmluZywgZGVzY3JpcHRpb24sIGN1c3RvbUlkLCB2aXNpdE5vZGVGbik7XG4gICAgdGhpcy5fc2V0TWVzc2FnZUlkKG1lc3NhZ2UsIG1ldGEpO1xuICAgIHRoaXMuX3NldExlZ2FjeUlkKG1lc3NhZ2UsIG1ldGEpO1xuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCk6IGFueSB7XG4gICAgaWYgKGhhc0kxOG5BdHRycyhlbGVtZW50KSkge1xuICAgICAgdGhpcy5oYXNJMThuTWV0YSA9IHRydWU7XG4gICAgICBjb25zdCBhdHRyczogaHRtbC5BdHRyaWJ1dGVbXSA9IFtdO1xuICAgICAgY29uc3QgYXR0cnNNZXRhOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRycykge1xuICAgICAgICBpZiAoYXR0ci5uYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgICAvLyByb290ICdpMThuJyBub2RlIGF0dHJpYnV0ZVxuICAgICAgICAgIGNvbnN0IGkxOG4gPSBlbGVtZW50LmkxOG4gfHwgYXR0ci52YWx1ZTtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShlbGVtZW50LmNoaWxkcmVuLCBpMThuLCBzZXRJMThuUmVmcyk7XG4gICAgICAgICAgLy8gZG8gbm90IGFzc2lnbiBlbXB0eSBpMThuIG1ldGFcbiAgICAgICAgICBpZiAobWVzc2FnZS5ub2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuaTE4biA9IG1lc3NhZ2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgICAvLyAnaTE4bi0qJyBhdHRyaWJ1dGVzXG4gICAgICAgICAgY29uc3Qga2V5ID0gYXR0ci5uYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKTtcbiAgICAgICAgICBhdHRyc01ldGFba2V5XSA9IGF0dHIudmFsdWU7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBub24taTE4biBhdHRyaWJ1dGVzXG4gICAgICAgICAgYXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBzZXQgaTE4biBtZXRhIGZvciBhdHRyaWJ1dGVzXG4gICAgICBpZiAoT2JqZWN0LmtleXMoYXR0cnNNZXRhKS5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJzKSB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IGF0dHJzTWV0YVthdHRyLm5hbWVdO1xuICAgICAgICAgIC8vIGRvIG5vdCBjcmVhdGUgdHJhbnNsYXRpb24gZm9yIGVtcHR5IGF0dHJpYnV0ZXNcbiAgICAgICAgICBpZiAobWV0YSAhPT0gdW5kZWZpbmVkICYmIGF0dHIudmFsdWUpIHtcbiAgICAgICAgICAgIGF0dHIuaTE4biA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2F0dHJdLCBhdHRyLmkxOG4gfHwgbWV0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5rZWVwSTE4bkF0dHJzKSB7XG4gICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50J3MgYXR0cmlidXRlcyxcbiAgICAgICAgLy8ga2VlcGluZyBvbmx5IG5vbi1pMThuIHJlbGF0ZWQgb25lc1xuICAgICAgICBlbGVtZW50LmF0dHJzID0gYXR0cnM7XG4gICAgICB9XG4gICAgfVxuICAgIGh0bWwudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbiwgZWxlbWVudC5pMThuKTtcbiAgICByZXR1cm4gZWxlbWVudDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24sIGN1cnJlbnRNZXNzYWdlOiBpMThuLk1lc3NhZ2V8dW5kZWZpbmVkKTogYW55IHtcbiAgICBsZXQgbWVzc2FnZTtcbiAgICBjb25zdCBtZXRhID0gZXhwYW5zaW9uLmkxOG47XG4gICAgdGhpcy5oYXNJMThuTWV0YSA9IHRydWU7XG4gICAgaWYgKG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyKSB7XG4gICAgICAvLyBzZXQgSUNVIHBsYWNlaG9sZGVyIG5hbWUgKGUuZy4gXCJJQ1VfMVwiKSxcbiAgICAgIC8vIGdlbmVyYXRlZCB3aGlsZSBwcm9jZXNzaW5nIHJvb3QgZWxlbWVudCBjb250ZW50cyxcbiAgICAgIC8vIHNvIHdlIGNhbiByZWZlcmVuY2UgaXQgd2hlbiB3ZSBvdXRwdXQgdHJhbnNsYXRpb25cbiAgICAgIGNvbnN0IG5hbWUgPSBtZXRhLm5hbWU7XG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgICBjb25zdCBpY3UgPSBpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICBpY3UubmFtZSA9IG5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElDVSBpcyBhIHRvcCBsZXZlbCBtZXNzYWdlLCB0cnkgdG8gdXNlIG1ldGFkYXRhIGZyb20gY29udGFpbmVyIGVsZW1lbnQgaWYgcHJvdmlkZWQgdmlhXG4gICAgICAvLyBgY29udGV4dGAgYXJndW1lbnQuIE5vdGU6IGNvbnRleHQgbWF5IG5vdCBiZSBhdmFpbGFibGUgZm9yIHN0YW5kYWxvbmUgSUNVcyAod2l0aG91dFxuICAgICAgLy8gd3JhcHBpbmcgZWxlbWVudCksIHNvIGZhbGxiYWNrIHRvIElDVSBtZXRhZGF0YSBpbiB0aGlzIGNhc2UuXG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgY3VycmVudE1lc3NhZ2UgfHwgbWV0YSk7XG4gICAgfVxuICAgIGV4cGFuc2lvbi5pMThuID0gbWVzc2FnZTtcbiAgICByZXR1cm4gZXhwYW5zaW9uO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IGFueSB7IHJldHVybiB0ZXh0OyB9XG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUpOiBhbnkgeyByZXR1cm4gYXR0cmlidXRlOyB9XG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBhbnkgeyByZXR1cm4gY29tbWVudDsgfVxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlKTogYW55IHsgcmV0dXJuIGV4cGFuc2lvbkNhc2U7IH1cblxuICAvKipcbiAgICogUGFyc2UgdGhlIGdlbmVyYWwgZm9ybSBgbWV0YWAgcGFzc2VkIGludG8gZXh0cmFjdCB0aGUgZXhwbGljaXQgbWV0YWRhdGEgbmVlZGVkIHRvIGNyZWF0ZSBhXG4gICAqIGBNZXNzYWdlYC5cbiAgICpcbiAgICogVGhlcmUgYXJlIHRocmVlIHBvc3NpYmlsaXRpZXMgZm9yIHRoZSBgbWV0YWAgdmFyaWFibGVcbiAgICogMSkgYSBzdHJpbmcgZnJvbSBhbiBgaTE4bmAgdGVtcGxhdGUgYXR0cmlidXRlOiBwYXJzZSBpdCB0byBleHRyYWN0IHRoZSBtZXRhZGF0YSB2YWx1ZXMuXG4gICAqIDIpIGEgYE1lc3NhZ2VgIGZyb20gYSBwcmV2aW91cyBwcm9jZXNzaW5nIHBhc3M6IHJldXNlIHRoZSBtZXRhZGF0YSB2YWx1ZXMgaW4gdGhlIG1lc3NhZ2UuXG4gICAqIDQpIG90aGVyOiBpZ25vcmUgdGhpcyBhbmQganVzdCBwcm9jZXNzIHRoZSBtZXNzYWdlIG1ldGFkYXRhIGFzIG5vcm1hbFxuICAgKlxuICAgKiBAcGFyYW0gbWV0YSB0aGUgYnVja2V0IHRoYXQgaG9sZHMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1lc3NhZ2VcbiAgICogQHJldHVybnMgdGhlIHBhcnNlZCBtZXRhZGF0YS5cbiAgICovXG4gIHByaXZhdGUgX3BhcnNlTWV0YWRhdGEobWV0YTogc3RyaW5nfGkxOG4uSTE4bk1ldGEpOiBJMThuTWV0YSB7XG4gICAgcmV0dXJuIHR5cGVvZiBtZXRhID09PSAnc3RyaW5nJyA/IHBhcnNlSTE4bk1ldGEobWV0YSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlID8gbWV0YUZyb21JMThuTWVzc2FnZShtZXRhKSA6IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIChvciByZXN0b3JlKSBtZXNzYWdlIGlkIGlmIG5vdCBzcGVjaWZpZWQgYWxyZWFkeS5cbiAgICovXG4gIHByaXZhdGUgX3NldE1lc3NhZ2VJZChtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIG1ldGE6IHN0cmluZ3xpMThuLkkxOG5NZXRhKTogdm9pZCB7XG4gICAgaWYgKCFtZXNzYWdlLmlkKSB7XG4gICAgICBtZXNzYWdlLmlkID0gbWV0YSBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSAmJiBtZXRhLmlkIHx8IGRlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgYG1lc3NhZ2VgIHdpdGggYSBgbGVnYWN5SWRgIGlmIG5lY2Vzc2FyeS5cbiAgICpcbiAgICogQHBhcmFtIG1lc3NhZ2UgdGhlIG1lc3NhZ2Ugd2hvc2UgbGVnYWN5IGlkIHNob3VsZCBiZSBzZXRcbiAgICogQHBhcmFtIG1ldGEgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1lc3NhZ2UgYmVpbmcgcHJvY2Vzc2VkXG4gICAqL1xuICBwcml2YXRlIF9zZXRMZWdhY3lJZChtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIG1ldGE6IHN0cmluZ3xpMThuLkkxOG5NZXRhKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsZicgfHwgdGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneGxpZmYnKSB7XG4gICAgICBtZXNzYWdlLmxlZ2FjeUlkID0gY29tcHV0ZURpZ2VzdChtZXNzYWdlKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGYyJyB8fCB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGlmZjInIHx8XG4gICAgICAgIHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3htYicpIHtcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWQgPSBjb21wdXRlRGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtZXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgLy8gVGhpcyBvY2N1cnMgaWYgd2UgYXJlIGRvaW5nIHRoZSAybmQgcGFzcyBhZnRlciB3aGl0ZXNwYWNlIHJlbW92YWwgKHNlZSBgcGFyc2VUZW1wbGF0ZSgpYCBpblxuICAgICAgLy8gYHBhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUudHNgKS5cbiAgICAgIC8vIEluIHRoYXQgY2FzZSB3ZSB3YW50IHRvIHJldXNlIHRoZSBsZWdhY3kgbWVzc2FnZSBnZW5lcmF0ZWQgaW4gdGhlIDFzdCBwYXNzIChzZWVcbiAgICAgIC8vIGBzZXRJMThuUmVmcygpYCkuXG4gICAgICBjb25zdCBwcmV2aW91c01lc3NhZ2UgPSBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlID9cbiAgICAgICAgICBtZXRhIDpcbiAgICAgICAgICBtZXRhIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlciA/IG1ldGEucHJldmlvdXNNZXNzYWdlIDogdW5kZWZpbmVkO1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZCA9IHByZXZpb3VzTWVzc2FnZSAmJiBwcmV2aW91c01lc3NhZ2UubGVnYWN5SWQ7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXRhRnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgaWQ6IHN0cmluZyB8IG51bGwgPSBudWxsKTogSTE4bk1ldGEge1xuICByZXR1cm4ge1xuICAgIGlkOiB0eXBlb2YgaWQgPT09ICdzdHJpbmcnID8gaWQgOiBtZXNzYWdlLmlkIHx8ICcnLFxuICAgIGN1c3RvbUlkOiBtZXNzYWdlLmN1c3RvbUlkLFxuICAgIGxlZ2FjeUlkOiBtZXNzYWdlLmxlZ2FjeUlkLFxuICAgIG1lYW5pbmc6IG1lc3NhZ2UubWVhbmluZyB8fCAnJyxcbiAgICBkZXNjcmlwdGlvbjogbWVzc2FnZS5kZXNjcmlwdGlvbiB8fCAnJ1xuICB9O1xufVxuXG4vKiogSTE4biBzZXBhcmF0b3JzIGZvciBtZXRhZGF0YSAqKi9cbmNvbnN0IEkxOE5fTUVBTklOR19TRVBBUkFUT1IgPSAnfCc7XG5jb25zdCBJMThOX0lEX1NFUEFSQVRPUiA9ICdAQCc7XG5cbi8qKlxuICogUGFyc2VzIGkxOG4gbWV0YXMgbGlrZTpcbiAqICAtIFwiQEBpZFwiLFxuICogIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuICogIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbiAqIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHBhcnNlZCBvdXRwdXQuXG4gKlxuICogQHBhcmFtIG1ldGEgU3RyaW5nIHRoYXQgcmVwcmVzZW50cyBpMThuIG1ldGFcbiAqIEByZXR1cm5zIE9iamVjdCB3aXRoIGlkLCBtZWFuaW5nIGFuZCBkZXNjcmlwdGlvbiBmaWVsZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEobWV0YT86IHN0cmluZyk6IEkxOG5NZXRhIHtcbiAgbGV0IGN1c3RvbUlkOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGlmIChtZXRhKSB7XG4gICAgY29uc3QgaWRJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX0lEX1NFUEFSQVRPUik7XG4gICAgY29uc3QgZGVzY0luZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgY3VzdG9tSWRdID1cbiAgICAgICAgKGlkSW5kZXggPiAtMSkgPyBbbWV0YS5zbGljZSgwLCBpZEluZGV4KSwgbWV0YS5zbGljZShpZEluZGV4ICsgMildIDogW21ldGEsICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID0gKGRlc2NJbmRleCA+IC0xKSA/XG4gICAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgICBbJycsIG1lYW5pbmdBbmREZXNjXTtcbiAgfVxuXG4gIHJldHVybiB7Y3VzdG9tSWQsIG1lYW5pbmcsIGRlc2NyaXB0aW9ufTtcbn1cblxuLy8gQ29udmVydHMgaTE4biBtZXRhIGluZm9ybWF0aW9uIGZvciBhIG1lc3NhZ2UgKGlkLCBkZXNjcmlwdGlvbiwgbWVhbmluZylcbi8vIHRvIGEgSnNEb2Mgc3RhdGVtZW50IGZvcm1hdHRlZCBhcyBleHBlY3RlZCBieSB0aGUgQ2xvc3VyZSBjb21waWxlci5cbmV4cG9ydCBmdW5jdGlvbiBpMThuTWV0YVRvRG9jU3RtdChtZXRhOiBJMThuTWV0YSk6IG8uSlNEb2NDb21tZW50U3RtdHxudWxsIHtcbiAgY29uc3QgdGFnczogby5KU0RvY1RhZ1tdID0gW107XG4gIGlmIChtZXRhLmRlc2NyaXB0aW9uKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5EZXNjLCB0ZXh0OiBtZXRhLmRlc2NyaXB0aW9ufSk7XG4gIH1cbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuTWVhbmluZywgdGV4dDogbWV0YS5tZWFuaW5nfSk7XG4gIH1cbiAgcmV0dXJuIHRhZ3MubGVuZ3RoID09IDAgPyBudWxsIDogbmV3IG8uSlNEb2NDb21tZW50U3RtdCh0YWdzKTtcbn1cbiJdfQ==