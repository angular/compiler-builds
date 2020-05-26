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
    exports.i18nMetaToDocStmt = exports.parseI18nMeta = exports.I18nMetaVisitor = void 0;
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
        function I18nMetaVisitor(interpolationConfig, keepI18nAttrs, enableI18nLegacyMessageIdFormat) {
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
            if (keepI18nAttrs === void 0) { keepI18nAttrs = false; }
            if (enableI18nLegacyMessageIdFormat === void 0) { enableI18nLegacyMessageIdFormat = false; }
            this.interpolationConfig = interpolationConfig;
            this.keepI18nAttrs = keepI18nAttrs;
            this.enableI18nLegacyMessageIdFormat = enableI18nLegacyMessageIdFormat;
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
            this._setLegacyIds(message, meta);
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
        I18nMetaVisitor.prototype.visitText = function (text) {
            return text;
        };
        I18nMetaVisitor.prototype.visitAttribute = function (attribute) {
            return attribute;
        };
        I18nMetaVisitor.prototype.visitComment = function (comment) {
            return comment;
        };
        I18nMetaVisitor.prototype.visitExpansionCase = function (expansionCase) {
            return expansionCase;
        };
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
                meta instanceof i18n.Message ? meta : {};
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
        I18nMetaVisitor.prototype._setLegacyIds = function (message, meta) {
            if (this.enableI18nLegacyMessageIdFormat) {
                message.legacyIds = [digest_1.computeDigest(message), digest_1.computeDecimalDigest(message)];
            }
            else if (typeof meta !== 'string') {
                // This occurs if we are doing the 2nd pass after whitespace removal (see `parseTemplate()` in
                // `packages/compiler/src/render3/view/template.ts`).
                // In that case we want to reuse the legacy message generated in the 1st pass (see
                // `setI18nRefs()`).
                var previousMessage = meta instanceof i18n.Message ?
                    meta :
                    meta instanceof i18n.IcuPlaceholder ? meta.previousMessage : undefined;
                message.legacyIds = previousMessage ? previousMessage.legacyIds : [];
            }
        };
        return I18nMetaVisitor;
    }());
    exports.I18nMetaVisitor = I18nMetaVisitor;
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
        if (meta === void 0) { meta = ''; }
        var customId;
        var meaning;
        var description;
        meta = meta.trim();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw0REFBd0Y7SUFDeEYsMERBQStDO0lBQy9DLHNFQUFnRjtJQUNoRiwwREFBK0M7SUFDL0MsNkZBQTBHO0lBQzFHLDJEQUFnRDtJQUVoRCxxRUFBcUY7SUFXckYsSUFBTSxXQUFXLEdBQWdCLFVBQUMsUUFBUSxFQUFFLFFBQVE7UUFDbEQsSUFBSSxRQUFRLFlBQVksSUFBSSxDQUFDLFlBQVksRUFBRTtZQUN6QyxJQUFJLFFBQVEsWUFBWSxJQUFJLENBQUMsY0FBYyxJQUFJLFFBQVEsQ0FBQyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDcEYsMkZBQTJGO2dCQUMzRixvRkFBb0Y7Z0JBQ3BGLDJGQUEyRjtnQkFDM0YsMkVBQTJFO2dCQUMzRSxRQUFRLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7YUFDMUM7WUFDRCxRQUFRLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQztTQUMxQjtRQUNELE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUMsQ0FBQztJQUVGOzs7O09BSUc7SUFDSDtRQU9FLHlCQUNZLG1CQUF1RSxFQUN2RSxhQUFxQixFQUFVLCtCQUF1QztZQUR0RSxvQ0FBQSxFQUFBLHNCQUEyQyxtREFBNEI7WUFDdkUsOEJBQUEsRUFBQSxxQkFBcUI7WUFBVSxnREFBQSxFQUFBLHVDQUF1QztZQUR0RSx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQW9EO1lBQ3ZFLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1lBQVUsb0NBQStCLEdBQS9CLCtCQUErQixDQUFRO1lBUmxGLGlEQUFpRDtZQUMxQyxnQkFBVyxHQUFZLEtBQUssQ0FBQztZQUVwQyxr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LGVBQXlCLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsRUFBRSxjQUFjLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNFLENBQUMsRUFBRSxFQUFFLGNBQWMsQ0FBQyxJQUFBLEVBRnZCLE9BQU8sUUFBQSxFQUFFLFdBQVcsUUFBQSxDQUVJO1NBQzFCO1FBRUQsT0FBTyxFQUFDLFFBQVEsVUFBQSxFQUFFLE9BQU8sU0FBQSxFQUFFLFdBQVcsYUFBQSxFQUFDLENBQUM7SUFDMUMsQ0FBQztJQWxCRCxzQ0FrQkM7SUFFRCwwRUFBMEU7SUFDMUUsc0VBQXNFO0lBQ3RFLFNBQWdCLGlCQUFpQixDQUFDLElBQWM7UUFDOUMsSUFBTSxJQUFJLEdBQWlCLEVBQUUsQ0FBQztRQUM5QixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sbUJBQXFCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUMsQ0FBQyxDQUFDO1NBQ25FO1FBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLHlCQUF3QixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQztTQUNsRTtRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQVRELDhDQVNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NvbXB1dGVEZWNpbWFsRGlnZXN0LCBjb21wdXRlRGlnZXN0LCBkZWNpbWFsRGlnZXN0fSBmcm9tICcuLi8uLi8uLi9pMThuL2RpZ2VzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnksIFZpc2l0Tm9kZUZufSBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHtoYXNJMThuQXR0cnMsIEkxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgaWN1RnJvbUkxOG5NZXNzYWdlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBJMThuTWV0YSA9IHtcbiAgaWQ/OiBzdHJpbmcsXG4gIGN1c3RvbUlkPzogc3RyaW5nLFxuICBsZWdhY3lJZHM/OiBzdHJpbmdbXSxcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG4gIG1lYW5pbmc/OiBzdHJpbmdcbn07XG5cblxuY29uc3Qgc2V0STE4blJlZnM6IFZpc2l0Tm9kZUZuID0gKGh0bWxOb2RlLCBpMThuTm9kZSkgPT4ge1xuICBpZiAoaHRtbE5vZGUgaW5zdGFuY2VvZiBodG1sLk5vZGVXaXRoSTE4bikge1xuICAgIGlmIChpMThuTm9kZSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXIgJiYgaHRtbE5vZGUuaTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgICAgLy8gVGhpcyBodG1sIG5vZGUgcmVwcmVzZW50cyBhbiBJQ1UgYnV0IHRoaXMgaXMgYSBzZWNvbmQgcHJvY2Vzc2luZyBwYXNzLCBhbmQgdGhlIGxlZ2FjeSBpZFxuICAgICAgLy8gd2FzIGNvbXB1dGVkIGluIHRoZSBwcmV2aW91cyBwYXNzIGFuZCBzdG9yZWQgaW4gdGhlIGBpMThuYCBwcm9wZXJ0eSBhcyBhIG1lc3NhZ2UuXG4gICAgICAvLyBXZSBhcmUgYWJvdXQgdG8gd2lwZSBvdXQgdGhhdCBwcm9wZXJ0eSBzbyBjYXB0dXJlIHRoZSBwcmV2aW91cyBtZXNzYWdlIHRvIGJlIHJldXNlZCB3aGVuXG4gICAgICAvLyBnZW5lcmF0aW5nIHRoZSBtZXNzYWdlIGZvciB0aGlzIElDVSBsYXRlci4gU2VlIGBfZ2VuZXJhdGVJMThuTWVzc2FnZSgpYC5cbiAgICAgIGkxOG5Ob2RlLnByZXZpb3VzTWVzc2FnZSA9IGh0bWxOb2RlLmkxOG47XG4gICAgfVxuICAgIGh0bWxOb2RlLmkxOG4gPSBpMThuTm9kZTtcbiAgfVxuICByZXR1cm4gaTE4bk5vZGU7XG59O1xuXG4vKipcbiAqIFRoaXMgdmlzaXRvciB3YWxrcyBvdmVyIEhUTUwgcGFyc2UgdHJlZSBhbmQgY29udmVydHMgaW5mb3JtYXRpb24gc3RvcmVkIGluXG4gKiBpMThuLXJlbGF0ZWQgYXR0cmlidXRlcyAoXCJpMThuXCIgYW5kIFwiaTE4bi0qXCIpIGludG8gaTE4biBtZXRhIG9iamVjdCB0aGF0IGlzXG4gKiBzdG9yZWQgd2l0aCBvdGhlciBlbGVtZW50J3MgYW5kIGF0dHJpYnV0ZSdzIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgSTE4bk1ldGFWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgLy8gd2hldGhlciB2aXNpdGVkIG5vZGVzIGNvbnRhaW4gaTE4biBpbmZvcm1hdGlvblxuICBwdWJsaWMgaGFzSTE4bk1ldGE6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAvLyBpMThuIG1lc3NhZ2UgZ2VuZXJhdGlvbiBmYWN0b3J5XG4gIHByaXZhdGUgX2NyZWF0ZUkxOG5NZXNzYWdlID0gY3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5KHRoaXMuaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgICAgcHJpdmF0ZSBrZWVwSTE4bkF0dHJzID0gZmFsc2UsIHByaXZhdGUgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9IGZhbHNlKSB7fVxuXG4gIHByaXZhdGUgX2dlbmVyYXRlSTE4bk1lc3NhZ2UoXG4gICAgICBub2RlczogaHRtbC5Ob2RlW10sIG1ldGE6IHN0cmluZ3xpMThuLkkxOG5NZXRhID0gJycsXG4gICAgICB2aXNpdE5vZGVGbj86IFZpc2l0Tm9kZUZuKTogaTE4bi5NZXNzYWdlIHtcbiAgICBjb25zdCB7bWVhbmluZywgZGVzY3JpcHRpb24sIGN1c3RvbUlkfSA9IHRoaXMuX3BhcnNlTWV0YWRhdGEobWV0YSk7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2NyZWF0ZUkxOG5NZXNzYWdlKG5vZGVzLCBtZWFuaW5nLCBkZXNjcmlwdGlvbiwgY3VzdG9tSWQsIHZpc2l0Tm9kZUZuKTtcbiAgICB0aGlzLl9zZXRNZXNzYWdlSWQobWVzc2FnZSwgbWV0YSk7XG4gICAgdGhpcy5fc2V0TGVnYWN5SWRzKG1lc3NhZ2UsIG1ldGEpO1xuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCk6IGFueSB7XG4gICAgaWYgKGhhc0kxOG5BdHRycyhlbGVtZW50KSkge1xuICAgICAgdGhpcy5oYXNJMThuTWV0YSA9IHRydWU7XG4gICAgICBjb25zdCBhdHRyczogaHRtbC5BdHRyaWJ1dGVbXSA9IFtdO1xuICAgICAgY29uc3QgYXR0cnNNZXRhOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRycykge1xuICAgICAgICBpZiAoYXR0ci5uYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgICAvLyByb290ICdpMThuJyBub2RlIGF0dHJpYnV0ZVxuICAgICAgICAgIGNvbnN0IGkxOG4gPSBlbGVtZW50LmkxOG4gfHwgYXR0ci52YWx1ZTtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShlbGVtZW50LmNoaWxkcmVuLCBpMThuLCBzZXRJMThuUmVmcyk7XG4gICAgICAgICAgLy8gZG8gbm90IGFzc2lnbiBlbXB0eSBpMThuIG1ldGFcbiAgICAgICAgICBpZiAobWVzc2FnZS5ub2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuaTE4biA9IG1lc3NhZ2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgICAvLyAnaTE4bi0qJyBhdHRyaWJ1dGVzXG4gICAgICAgICAgY29uc3Qga2V5ID0gYXR0ci5uYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKTtcbiAgICAgICAgICBhdHRyc01ldGFba2V5XSA9IGF0dHIudmFsdWU7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBub24taTE4biBhdHRyaWJ1dGVzXG4gICAgICAgICAgYXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBzZXQgaTE4biBtZXRhIGZvciBhdHRyaWJ1dGVzXG4gICAgICBpZiAoT2JqZWN0LmtleXMoYXR0cnNNZXRhKS5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJzKSB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IGF0dHJzTWV0YVthdHRyLm5hbWVdO1xuICAgICAgICAgIC8vIGRvIG5vdCBjcmVhdGUgdHJhbnNsYXRpb24gZm9yIGVtcHR5IGF0dHJpYnV0ZXNcbiAgICAgICAgICBpZiAobWV0YSAhPT0gdW5kZWZpbmVkICYmIGF0dHIudmFsdWUpIHtcbiAgICAgICAgICAgIGF0dHIuaTE4biA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2F0dHJdLCBhdHRyLmkxOG4gfHwgbWV0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5rZWVwSTE4bkF0dHJzKSB7XG4gICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50J3MgYXR0cmlidXRlcyxcbiAgICAgICAgLy8ga2VlcGluZyBvbmx5IG5vbi1pMThuIHJlbGF0ZWQgb25lc1xuICAgICAgICBlbGVtZW50LmF0dHJzID0gYXR0cnM7XG4gICAgICB9XG4gICAgfVxuICAgIGh0bWwudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbiwgZWxlbWVudC5pMThuKTtcbiAgICByZXR1cm4gZWxlbWVudDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24sIGN1cnJlbnRNZXNzYWdlOiBpMThuLk1lc3NhZ2V8dW5kZWZpbmVkKTogYW55IHtcbiAgICBsZXQgbWVzc2FnZTtcbiAgICBjb25zdCBtZXRhID0gZXhwYW5zaW9uLmkxOG47XG4gICAgdGhpcy5oYXNJMThuTWV0YSA9IHRydWU7XG4gICAgaWYgKG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyKSB7XG4gICAgICAvLyBzZXQgSUNVIHBsYWNlaG9sZGVyIG5hbWUgKGUuZy4gXCJJQ1VfMVwiKSxcbiAgICAgIC8vIGdlbmVyYXRlZCB3aGlsZSBwcm9jZXNzaW5nIHJvb3QgZWxlbWVudCBjb250ZW50cyxcbiAgICAgIC8vIHNvIHdlIGNhbiByZWZlcmVuY2UgaXQgd2hlbiB3ZSBvdXRwdXQgdHJhbnNsYXRpb25cbiAgICAgIGNvbnN0IG5hbWUgPSBtZXRhLm5hbWU7XG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgICBjb25zdCBpY3UgPSBpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICBpY3UubmFtZSA9IG5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElDVSBpcyBhIHRvcCBsZXZlbCBtZXNzYWdlLCB0cnkgdG8gdXNlIG1ldGFkYXRhIGZyb20gY29udGFpbmVyIGVsZW1lbnQgaWYgcHJvdmlkZWQgdmlhXG4gICAgICAvLyBgY29udGV4dGAgYXJndW1lbnQuIE5vdGU6IGNvbnRleHQgbWF5IG5vdCBiZSBhdmFpbGFibGUgZm9yIHN0YW5kYWxvbmUgSUNVcyAod2l0aG91dFxuICAgICAgLy8gd3JhcHBpbmcgZWxlbWVudCksIHNvIGZhbGxiYWNrIHRvIElDVSBtZXRhZGF0YSBpbiB0aGlzIGNhc2UuXG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgY3VycmVudE1lc3NhZ2UgfHwgbWV0YSk7XG4gICAgfVxuICAgIGV4cGFuc2lvbi5pMThuID0gbWVzc2FnZTtcbiAgICByZXR1cm4gZXhwYW5zaW9uO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IGFueSB7XG4gICAgcmV0dXJuIHRleHQ7XG4gIH1cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSk6IGFueSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZTtcbiAgfVxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogYW55IHtcbiAgICByZXR1cm4gY29tbWVudDtcbiAgfVxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlKTogYW55IHtcbiAgICByZXR1cm4gZXhwYW5zaW9uQ2FzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSB0aGUgZ2VuZXJhbCBmb3JtIGBtZXRhYCBwYXNzZWQgaW50byBleHRyYWN0IHRoZSBleHBsaWNpdCBtZXRhZGF0YSBuZWVkZWQgdG8gY3JlYXRlIGFcbiAgICogYE1lc3NhZ2VgLlxuICAgKlxuICAgKiBUaGVyZSBhcmUgdGhyZWUgcG9zc2liaWxpdGllcyBmb3IgdGhlIGBtZXRhYCB2YXJpYWJsZVxuICAgKiAxKSBhIHN0cmluZyBmcm9tIGFuIGBpMThuYCB0ZW1wbGF0ZSBhdHRyaWJ1dGU6IHBhcnNlIGl0IHRvIGV4dHJhY3QgdGhlIG1ldGFkYXRhIHZhbHVlcy5cbiAgICogMikgYSBgTWVzc2FnZWAgZnJvbSBhIHByZXZpb3VzIHByb2Nlc3NpbmcgcGFzczogcmV1c2UgdGhlIG1ldGFkYXRhIHZhbHVlcyBpbiB0aGUgbWVzc2FnZS5cbiAgICogNCkgb3RoZXI6IGlnbm9yZSB0aGlzIGFuZCBqdXN0IHByb2Nlc3MgdGhlIG1lc3NhZ2UgbWV0YWRhdGEgYXMgbm9ybWFsXG4gICAqXG4gICAqIEBwYXJhbSBtZXRhIHRoZSBidWNrZXQgdGhhdCBob2xkcyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbWVzc2FnZVxuICAgKiBAcmV0dXJucyB0aGUgcGFyc2VkIG1ldGFkYXRhLlxuICAgKi9cbiAgcHJpdmF0ZSBfcGFyc2VNZXRhZGF0YShtZXRhOiBzdHJpbmd8aTE4bi5JMThuTWV0YSk6IEkxOG5NZXRhIHtcbiAgICByZXR1cm4gdHlwZW9mIG1ldGEgPT09ICdzdHJpbmcnID8gcGFyc2VJMThuTWV0YShtZXRhKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgPyBtZXRhIDoge307XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgKG9yIHJlc3RvcmUpIG1lc3NhZ2UgaWQgaWYgbm90IHNwZWNpZmllZCBhbHJlYWR5LlxuICAgKi9cbiAgcHJpdmF0ZSBfc2V0TWVzc2FnZUlkKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgbWV0YTogc3RyaW5nfGkxOG4uSTE4bk1ldGEpOiB2b2lkIHtcbiAgICBpZiAoIW1lc3NhZ2UuaWQpIHtcbiAgICAgIG1lc3NhZ2UuaWQgPSBtZXRhIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlICYmIG1ldGEuaWQgfHwgZGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBgbWVzc2FnZWAgd2l0aCBhIGBsZWdhY3lJZGAgaWYgbmVjZXNzYXJ5LlxuICAgKlxuICAgKiBAcGFyYW0gbWVzc2FnZSB0aGUgbWVzc2FnZSB3aG9zZSBsZWdhY3kgaWQgc2hvdWxkIGJlIHNldFxuICAgKiBAcGFyYW0gbWV0YSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbWVzc2FnZSBiZWluZyBwcm9jZXNzZWRcbiAgICovXG4gIHByaXZhdGUgX3NldExlZ2FjeUlkcyhtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIG1ldGE6IHN0cmluZ3xpMThuLkkxOG5NZXRhKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCkge1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZHMgPSBbY29tcHV0ZURpZ2VzdChtZXNzYWdlKSwgY29tcHV0ZURlY2ltYWxEaWdlc3QobWVzc2FnZSldO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1ldGEgIT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBUaGlzIG9jY3VycyBpZiB3ZSBhcmUgZG9pbmcgdGhlIDJuZCBwYXNzIGFmdGVyIHdoaXRlc3BhY2UgcmVtb3ZhbCAoc2VlIGBwYXJzZVRlbXBsYXRlKClgIGluXG4gICAgICAvLyBgcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90ZW1wbGF0ZS50c2ApLlxuICAgICAgLy8gSW4gdGhhdCBjYXNlIHdlIHdhbnQgdG8gcmV1c2UgdGhlIGxlZ2FjeSBtZXNzYWdlIGdlbmVyYXRlZCBpbiB0aGUgMXN0IHBhc3MgKHNlZVxuICAgICAgLy8gYHNldEkxOG5SZWZzKClgKS5cbiAgICAgIGNvbnN0IHByZXZpb3VzTWVzc2FnZSA9IG1ldGEgaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UgP1xuICAgICAgICAgIG1ldGEgOlxuICAgICAgICAgIG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyID8gbWV0YS5wcmV2aW91c01lc3NhZ2UgOiB1bmRlZmluZWQ7XG4gICAgICBtZXNzYWdlLmxlZ2FjeUlkcyA9IHByZXZpb3VzTWVzc2FnZSA/IHByZXZpb3VzTWVzc2FnZS5sZWdhY3lJZHMgOiBbXTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIEkxOG4gc2VwYXJhdG9ycyBmb3IgbWV0YWRhdGEgKiovXG5jb25zdCBJMThOX01FQU5JTkdfU0VQQVJBVE9SID0gJ3wnO1xuY29uc3QgSTE4Tl9JRF9TRVBBUkFUT1IgPSAnQEAnO1xuXG4vKipcbiAqIFBhcnNlcyBpMThuIG1ldGFzIGxpa2U6XG4gKiAgLSBcIkBAaWRcIixcbiAqICAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbiAqICAtIFwibWVhbmluZ3xkZXNjcmlwdGlvbltAQGlkXVwiXG4gKiBhbmQgcmV0dXJucyBhbiBvYmplY3Qgd2l0aCBwYXJzZWQgb3V0cHV0LlxuICpcbiAqIEBwYXJhbSBtZXRhIFN0cmluZyB0aGF0IHJlcHJlc2VudHMgaTE4biBtZXRhXG4gKiBAcmV0dXJucyBPYmplY3Qgd2l0aCBpZCwgbWVhbmluZyBhbmQgZGVzY3JpcHRpb24gZmllbGRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUkxOG5NZXRhKG1ldGE6IHN0cmluZyA9ICcnKTogSTE4bk1ldGEge1xuICBsZXQgY3VzdG9tSWQ6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgbWV0YSA9IG1ldGEudHJpbSgpO1xuICBpZiAobWV0YSkge1xuICAgIGNvbnN0IGlkSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9JRF9TRVBBUkFUT1IpO1xuICAgIGNvbnN0IGRlc2NJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX01FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGN1c3RvbUlkXSA9XG4gICAgICAgIChpZEluZGV4ID4gLTEpID8gW21ldGEuc2xpY2UoMCwgaWRJbmRleCksIG1ldGEuc2xpY2UoaWRJbmRleCArIDIpXSA6IFttZXRhLCAnJ107XG4gICAgW21lYW5pbmcsIGRlc2NyaXB0aW9uXSA9IChkZXNjSW5kZXggPiAtMSkgP1xuICAgICAgICBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldIDpcbiAgICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2N1c3RvbUlkLCBtZWFuaW5nLCBkZXNjcmlwdGlvbn07XG59XG5cbi8vIENvbnZlcnRzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiBmb3IgYSBtZXNzYWdlIChpZCwgZGVzY3JpcHRpb24sIG1lYW5pbmcpXG4vLyB0byBhIEpzRG9jIHN0YXRlbWVudCBmb3JtYXR0ZWQgYXMgZXhwZWN0ZWQgYnkgdGhlIENsb3N1cmUgY29tcGlsZXIuXG5leHBvcnQgZnVuY3Rpb24gaTE4bk1ldGFUb0RvY1N0bXQobWV0YTogSTE4bk1ldGEpOiBvLkpTRG9jQ29tbWVudFN0bXR8bnVsbCB7XG4gIGNvbnN0IHRhZ3M6IG8uSlNEb2NUYWdbXSA9IFtdO1xuICBpZiAobWV0YS5kZXNjcmlwdGlvbikge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuRGVzYywgdGV4dDogbWV0YS5kZXNjcmlwdGlvbn0pO1xuICB9XG4gIGlmIChtZXRhLm1lYW5pbmcpIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLk1lYW5pbmcsIHRleHQ6IG1ldGEubWVhbmluZ30pO1xuICB9XG4gIHJldHVybiB0YWdzLmxlbmd0aCA9PSAwID8gbnVsbCA6IG5ldyBvLkpTRG9jQ29tbWVudFN0bXQodGFncyk7XG59XG4iXX0=