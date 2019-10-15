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
    function setI18nRefs(html, i18n) {
        html.i18n = i18n;
    }
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
            // i18n message generation factory
            this._createI18nMessage = i18n_parser_1.createI18nMessageFactory(this.interpolationConfig);
        }
        I18nMetaVisitor.prototype._generateI18nMessage = function (nodes, meta, visitNodeFn) {
            if (meta === void 0) { meta = ''; }
            var parsed = typeof meta === 'string' ? parseI18nMeta(meta) : metaFromI18nMessage(meta);
            var message = this._createI18nMessage(nodes, parsed.meaning || '', parsed.description || '', parsed.customId || '', visitNodeFn);
            if (!message.id) {
                // generate (or restore) message id if not specified in template
                message.id = typeof meta !== 'string' && meta.id || digest_1.decimalDigest(message);
            }
            if (this.i18nLegacyMessageIdFormat === 'xlf' || this.i18nLegacyMessageIdFormat === 'xliff') {
                message.legacyId = digest_1.computeDigest(message);
            }
            else if (this.i18nLegacyMessageIdFormat === 'xlf2' || this.i18nLegacyMessageIdFormat === 'xliff2' ||
                this.i18nLegacyMessageIdFormat === 'xmb') {
                message.legacyId = digest_1.computeDecimalDigest(message);
            }
            else if (typeof meta !== 'string') {
                // This occurs if we are doing the 2nd pass after whitespace removal
                // In that case we want to reuse the legacy message generated in the 1st pass
                // See `parseTemplate()` in `packages/compiler/src/render3/view/template.ts`
                message.legacyId = meta.legacyId;
            }
            return message;
        };
        I18nMetaVisitor.prototype.visitElement = function (element, context) {
            var e_1, _a, e_2, _b;
            if (util_1.hasI18nAttrs(element)) {
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
            html.visitAll(this, element.children);
            return element;
        };
        I18nMetaVisitor.prototype.visitExpansion = function (expansion, context) {
            var message;
            var meta = expansion.i18n;
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
                // when ICU is a root level translation
                message = this._generateI18nMessage([expansion], meta);
            }
            expansion.i18n = message;
            return expansion;
        };
        I18nMetaVisitor.prototype.visitText = function (text, context) { return text; };
        I18nMetaVisitor.prototype.visitAttribute = function (attribute, context) { return attribute; };
        I18nMetaVisitor.prototype.visitComment = function (comment, context) { return comment; };
        I18nMetaVisitor.prototype.visitExpansionCase = function (expansionCase, context) { return expansionCase; };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDREQUF3RjtJQUN4RiwwREFBK0M7SUFDL0Msc0VBQW1FO0lBQ25FLDBEQUErQztJQUMvQyw2RkFBMEc7SUFDMUcsMkRBQWdEO0lBRWhELHFFQUFxRjtJQVVyRixTQUFTLFdBQVcsQ0FBQyxJQUFtQyxFQUFFLElBQWU7UUFDdkUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUVEOzs7O09BSUc7SUFDSDtRQUlFLHlCQUNZLG1CQUF1RSxFQUN2RSxhQUE4QixFQUFVLHlCQUFzQztZQUQ5RSxvQ0FBQSxFQUFBLHNCQUEyQyxtREFBNEI7WUFDdkUsOEJBQUEsRUFBQSxxQkFBOEI7WUFBVSwwQ0FBQSxFQUFBLDhCQUFzQztZQUQ5RSx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQW9EO1lBQ3ZFLGtCQUFhLEdBQWIsYUFBYSxDQUFpQjtZQUFVLDhCQUF5QixHQUF6Qix5QkFBeUIsQ0FBYTtZQUwxRixrQ0FBa0M7WUFDMUIsdUJBQWtCLEdBQUcsc0NBQXdCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFJYSxDQUFDO1FBRXRGLDhDQUFvQixHQUE1QixVQUNJLEtBQWtCLEVBQUUsSUFBMEIsRUFDOUMsV0FBd0Q7WUFEcEMscUJBQUEsRUFBQSxTQUEwQjtZQUVoRCxJQUFNLE1BQU0sR0FDUixPQUFPLElBQUksS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsSUFBb0IsQ0FBQyxDQUFDO1lBQy9GLElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxrQkFBa0Is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NEZBQTRGO1lBQzVGLE9BQU8sbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDekM7YUFBTTtZQUNMLE9BQU8sTUFBSSxlQUFlLFNBQUksV0FBYSxDQUFDO1NBQzdDO0lBQ0gsQ0FBQztJQVBELDhEQU9DO0lBRUQsMEVBQTBFO0lBQzFFLHNFQUFzRTtJQUN0RSxTQUFnQixpQkFBaUIsQ0FBQyxJQUFjO1FBQzlDLElBQU0sSUFBSSxHQUFpQixFQUFFLENBQUM7UUFDOUIsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLG1CQUFxQixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFDLENBQUMsQ0FBQztTQUNuRTtRQUNELElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUMsT0FBTyx5QkFBd0IsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDLENBQUM7U0FDbEU7UUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFURCw4Q0FTQztJQUVELFNBQWdCLG1CQUFtQixDQUFDLEdBQVc7UUFDN0MsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRkQsa0RBRUM7SUFFRCxTQUFnQixZQUFZLENBQUMsR0FBVztRQUN0QyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFGRCxvQ0FFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjb21wdXRlRGVjaW1hbERpZ2VzdCwgY29tcHV0ZURpZ2VzdCwgZGVjaW1hbERpZ2VzdH0gZnJvbSAnLi4vLi4vLi4vaTE4bi9kaWdlc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCB7Y3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5fSBmcm9tICcuLi8uLi8uLi9pMThuL2kxOG5fcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuaW1wb3J0IHtJMThOX0FUVFIsIEkxOE5fQVRUUl9QUkVGSVgsIGhhc0kxOG5BdHRycywgaWN1RnJvbUkxOG5NZXNzYWdlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBJMThuTWV0YSA9IHtcbiAgaWQ/OiBzdHJpbmcsXG4gIGN1c3RvbUlkPzogc3RyaW5nLFxuICBsZWdhY3lJZD86IHN0cmluZyxcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG4gIG1lYW5pbmc/OiBzdHJpbmdcbn07XG5cbmZ1bmN0aW9uIHNldEkxOG5SZWZzKGh0bWw6IGh0bWwuTm9kZSAmIHtpMThuPzogaTE4bi5BU1R9LCBpMThuOiBpMThuLk5vZGUpIHtcbiAgaHRtbC5pMThuID0gaTE4bjtcbn1cblxuLyoqXG4gKiBUaGlzIHZpc2l0b3Igd2Fsa3Mgb3ZlciBIVE1MIHBhcnNlIHRyZWUgYW5kIGNvbnZlcnRzIGluZm9ybWF0aW9uIHN0b3JlZCBpblxuICogaTE4bi1yZWxhdGVkIGF0dHJpYnV0ZXMgKFwiaTE4blwiIGFuZCBcImkxOG4tKlwiKSBpbnRvIGkxOG4gbWV0YSBvYmplY3QgdGhhdCBpc1xuICogc3RvcmVkIHdpdGggb3RoZXIgZWxlbWVudCdzIGFuZCBhdHRyaWJ1dGUncyBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIEkxOG5NZXRhVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIC8vIGkxOG4gbWVzc2FnZSBnZW5lcmF0aW9uIGZhY3RvcnlcbiAgcHJpdmF0ZSBfY3JlYXRlSTE4bk1lc3NhZ2UgPSBjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnkodGhpcy5pbnRlcnBvbGF0aW9uQ29uZmlnKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgICBwcml2YXRlIGtlZXBJMThuQXR0cnM6IGJvb2xlYW4gPSBmYWxzZSwgcHJpdmF0ZSBpMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0OiBzdHJpbmcgPSAnJykge31cblxuICBwcml2YXRlIF9nZW5lcmF0ZUkxOG5NZXNzYWdlKFxuICAgICAgbm9kZXM6IGh0bWwuTm9kZVtdLCBtZXRhOiBzdHJpbmd8aTE4bi5BU1QgPSAnJyxcbiAgICAgIHZpc2l0Tm9kZUZuPzogKGh0bWw6IGh0bWwuTm9kZSwgaTE4bjogaTE4bi5Ob2RlKSA9PiB2b2lkKTogaTE4bi5NZXNzYWdlIHtcbiAgICBjb25zdCBwYXJzZWQ6IEkxOG5NZXRhID1cbiAgICAgICAgdHlwZW9mIG1ldGEgPT09ICdzdHJpbmcnID8gcGFyc2VJMThuTWV0YShtZXRhKSA6IG1ldGFGcm9tSTE4bk1lc3NhZ2UobWV0YSBhcyBpMThuLk1lc3NhZ2UpO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9jcmVhdGVJMThuTWVzc2FnZShcbiAgICAgICAgbm9kZXMsIHBhcnNlZC5tZWFuaW5nIHx8ICcnLCBwYXJzZWQuZGVzY3JpcHRpb24gfHwgJycsIHBhcnNlZC5jdXN0b21JZCB8fCAnJywgdmlzaXROb2RlRm4pO1xuICAgIGlmICghbWVzc2FnZS5pZCkge1xuICAgICAgLy8gZ2VuZXJhdGUgKG9yIHJlc3RvcmUpIG1lc3NhZ2UgaWQgaWYgbm90IHNwZWNpZmllZCBpbiB0ZW1wbGF0ZVxuICAgICAgbWVzc2FnZS5pZCA9IHR5cGVvZiBtZXRhICE9PSAnc3RyaW5nJyAmJiAobWV0YSBhcyBpMThuLk1lc3NhZ2UpLmlkIHx8IGRlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsZicgfHwgdGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneGxpZmYnKSB7XG4gICAgICBtZXNzYWdlLmxlZ2FjeUlkID0gY29tcHV0ZURpZ2VzdChtZXNzYWdlKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGYyJyB8fCB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGlmZjInIHx8XG4gICAgICAgIHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3htYicpIHtcbiAgICAgIG1lc3NhZ2UubGVnYWN5SWQgPSBjb21wdXRlRGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtZXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgLy8gVGhpcyBvY2N1cnMgaWYgd2UgYXJlIGRvaW5nIHRoZSAybmQgcGFzcyBhZnRlciB3aGl0ZXNwYWNlIHJlbW92YWxcbiAgICAgIC8vIEluIHRoYXQgY2FzZSB3ZSB3YW50IHRvIHJldXNlIHRoZSBsZWdhY3kgbWVzc2FnZSBnZW5lcmF0ZWQgaW4gdGhlIDFzdCBwYXNzXG4gICAgICAvLyBTZWUgYHBhcnNlVGVtcGxhdGUoKWAgaW4gYHBhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUudHNgXG4gICAgICBtZXNzYWdlLmxlZ2FjeUlkID0gKG1ldGEgYXMgaTE4bi5NZXNzYWdlKS5sZWdhY3lJZDtcbiAgICB9XG5cbiAgICByZXR1cm4gbWVzc2FnZTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBodG1sLkVsZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGhhc0kxOG5BdHRycyhlbGVtZW50KSkge1xuICAgICAgY29uc3QgYXR0cnM6IGh0bWwuQXR0cmlidXRlW10gPSBbXTtcbiAgICAgIGNvbnN0IGF0dHJzTWV0YToge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cnMpIHtcbiAgICAgICAgaWYgKGF0dHIubmFtZSA9PT0gSTE4Tl9BVFRSKSB7XG4gICAgICAgICAgLy8gcm9vdCAnaTE4bicgbm9kZSBhdHRyaWJ1dGVcbiAgICAgICAgICBjb25zdCBpMThuID0gZWxlbWVudC5pMThuIHx8IGF0dHIudmFsdWU7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoZWxlbWVudC5jaGlsZHJlbiwgaTE4biwgc2V0STE4blJlZnMpO1xuICAgICAgICAgIC8vIGRvIG5vdCBhc3NpZ24gZW1wdHkgaTE4biBtZXRhXG4gICAgICAgICAgaWYgKG1lc3NhZ2Uubm9kZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBlbGVtZW50LmkxOG4gPSBtZXNzYWdlO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHIubmFtZS5zdGFydHNXaXRoKEkxOE5fQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgICAgLy8gJ2kxOG4tKicgYXR0cmlidXRlc1xuICAgICAgICAgIGNvbnN0IGtleSA9IGF0dHIubmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICAgICAgYXR0cnNNZXRhW2tleV0gPSBhdHRyLnZhbHVlO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbm9uLWkxOG4gYXR0cmlidXRlc1xuICAgICAgICAgIGF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc2V0IGkxOG4gbWV0YSBmb3IgYXR0cmlidXRlc1xuICAgICAgaWYgKE9iamVjdC5rZXlzKGF0dHJzTWV0YSkubGVuZ3RoKSB7XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBhdHRycykge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBhdHRyc01ldGFbYXR0ci5uYW1lXTtcbiAgICAgICAgICAvLyBkbyBub3QgY3JlYXRlIHRyYW5zbGF0aW9uIGZvciBlbXB0eSBhdHRyaWJ1dGVzXG4gICAgICAgICAgaWYgKG1ldGEgIT09IHVuZGVmaW5lZCAmJiBhdHRyLnZhbHVlKSB7XG4gICAgICAgICAgICBhdHRyLmkxOG4gPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFthdHRyXSwgYXR0ci5pMThuIHx8IG1ldGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMua2VlcEkxOG5BdHRycykge1xuICAgICAgICAvLyB1cGRhdGUgZWxlbWVudCdzIGF0dHJpYnV0ZXMsXG4gICAgICAgIC8vIGtlZXBpbmcgb25seSBub24taTE4biByZWxhdGVkIG9uZXNcbiAgICAgICAgZWxlbWVudC5hdHRycyA9IGF0dHJzO1xuICAgICAgfVxuICAgIH1cbiAgICBodG1sLnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIHJldHVybiBlbGVtZW50O1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBsZXQgbWVzc2FnZTtcbiAgICBjb25zdCBtZXRhID0gZXhwYW5zaW9uLmkxOG47XG4gICAgaWYgKG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyKSB7XG4gICAgICAvLyBzZXQgSUNVIHBsYWNlaG9sZGVyIG5hbWUgKGUuZy4gXCJJQ1VfMVwiKSxcbiAgICAgIC8vIGdlbmVyYXRlZCB3aGlsZSBwcm9jZXNzaW5nIHJvb3QgZWxlbWVudCBjb250ZW50cyxcbiAgICAgIC8vIHNvIHdlIGNhbiByZWZlcmVuY2UgaXQgd2hlbiB3ZSBvdXRwdXQgdHJhbnNsYXRpb25cbiAgICAgIGNvbnN0IG5hbWUgPSBtZXRhLm5hbWU7XG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgICBjb25zdCBpY3UgPSBpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICBpY3UubmFtZSA9IG5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHdoZW4gSUNVIGlzIGEgcm9vdCBsZXZlbCB0cmFuc2xhdGlvblxuICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2V4cGFuc2lvbl0sIG1ldGEpO1xuICAgIH1cbiAgICBleHBhbnNpb24uaTE4biA9IG1lc3NhZ2U7XG4gICAgcmV0dXJuIGV4cGFuc2lvbjtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB0ZXh0OyB9XG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBhdHRyaWJ1dGU7IH1cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGNvbW1lbnQ7IH1cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGV4cGFuc2lvbkNhc2U7IH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ldGFGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZTogaTE4bi5NZXNzYWdlLCBpZDogc3RyaW5nIHwgbnVsbCA9IG51bGwpOiBJMThuTWV0YSB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHR5cGVvZiBpZCA9PT0gJ3N0cmluZycgPyBpZCA6IG1lc3NhZ2UuaWQgfHwgJycsXG4gICAgY3VzdG9tSWQ6IG1lc3NhZ2UuY3VzdG9tSWQsXG4gICAgbGVnYWN5SWQ6IG1lc3NhZ2UubGVnYWN5SWQsXG4gICAgbWVhbmluZzogbWVzc2FnZS5tZWFuaW5nIHx8ICcnLFxuICAgIGRlc2NyaXB0aW9uOiBtZXNzYWdlLmRlc2NyaXB0aW9uIHx8ICcnXG4gIH07XG59XG5cbi8qKiBJMThuIHNlcGFyYXRvcnMgZm9yIG1ldGFkYXRhICoqL1xuY29uc3QgSTE4Tl9NRUFOSU5HX1NFUEFSQVRPUiA9ICd8JztcbmNvbnN0IEkxOE5fSURfU0VQQVJBVE9SID0gJ0BAJztcblxuLyoqXG4gKiBQYXJzZXMgaTE4biBtZXRhcyBsaWtlOlxuICogIC0gXCJAQGlkXCIsXG4gKiAgLSBcImRlc2NyaXB0aW9uW0BAaWRdXCIsXG4gKiAgLSBcIm1lYW5pbmd8ZGVzY3JpcHRpb25bQEBpZF1cIlxuICogYW5kIHJldHVybnMgYW4gb2JqZWN0IHdpdGggcGFyc2VkIG91dHB1dC5cbiAqXG4gKiBAcGFyYW0gbWV0YSBTdHJpbmcgdGhhdCByZXByZXNlbnRzIGkxOG4gbWV0YVxuICogQHJldHVybnMgT2JqZWN0IHdpdGggaWQsIG1lYW5pbmcgYW5kIGRlc2NyaXB0aW9uIGZpZWxkc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VJMThuTWV0YShtZXRhPzogc3RyaW5nKTogSTE4bk1ldGEge1xuICBsZXQgY3VzdG9tSWQ6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgaWYgKG1ldGEpIHtcbiAgICBjb25zdCBpZEluZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fSURfU0VQQVJBVE9SKTtcbiAgICBjb25zdCBkZXNjSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9NRUFOSU5HX1NFUEFSQVRPUik7XG4gICAgbGV0IG1lYW5pbmdBbmREZXNjOiBzdHJpbmc7XG4gICAgW21lYW5pbmdBbmREZXNjLCBjdXN0b21JZF0gPVxuICAgICAgICAoaWRJbmRleCA+IC0xKSA/IFttZXRhLnNsaWNlKDAsIGlkSW5kZXgpLCBtZXRhLnNsaWNlKGlkSW5kZXggKyAyKV0gOiBbbWV0YSwgJyddO1xuICAgIFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPSAoZGVzY0luZGV4ID4gLTEpID9cbiAgICAgICAgW21lYW5pbmdBbmREZXNjLnNsaWNlKDAsIGRlc2NJbmRleCksIG1lYW5pbmdBbmREZXNjLnNsaWNlKGRlc2NJbmRleCArIDEpXSA6XG4gICAgICAgIFsnJywgbWVhbmluZ0FuZERlc2NdO1xuICB9XG5cbiAgcmV0dXJuIHtjdXN0b21JZCwgbWVhbmluZywgZGVzY3JpcHRpb259O1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZSB0aGUgZ2l2ZW4gYG1ldGFgIGFuZCBgbWVzc2FnZVBhcnRgIGEgc3RyaW5nIHRoYXQgY2FuIGJlIHVzZWQgaW4gYSBgJGxvY2FsaXplYFxuICogdGFnZ2VkIHN0cmluZy4gVGhlIGZvcm1hdCBvZiB0aGUgbWV0YWRhdGEgaXMgdGhlIHNhbWUgYXMgdGhhdCBwYXJzZWQgYnkgYHBhcnNlSTE4bk1ldGEoKWAuXG4gKlxuICogQHBhcmFtIG1ldGEgVGhlIG1ldGFkYXRhIHRvIHNlcmlhbGl6ZVxuICogQHBhcmFtIG1lc3NhZ2VQYXJ0IFRoZSBmaXJzdCBwYXJ0IG9mIHRoZSB0YWdnZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVJMThuSGVhZChtZXRhOiBJMThuTWV0YSwgbWVzc2FnZVBhcnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBtZXRhQmxvY2sgPSBtZXRhLmRlc2NyaXB0aW9uIHx8ICcnO1xuICBpZiAobWV0YS5tZWFuaW5nKSB7XG4gICAgbWV0YUJsb2NrID0gYCR7bWV0YS5tZWFuaW5nfXwke21ldGFCbG9ja31gO1xuICB9XG4gIGlmIChtZXRhLmN1c3RvbUlkIHx8IG1ldGEubGVnYWN5SWQpIHtcbiAgICBtZXRhQmxvY2sgPSBgJHttZXRhQmxvY2t9QEAke21ldGEuY3VzdG9tSWQgfHwgbWV0YS5sZWdhY3lJZH1gO1xuICB9XG4gIGlmIChtZXRhQmxvY2sgPT09ICcnKSB7XG4gICAgLy8gVGhlcmUgaXMgbm8gbWV0YUJsb2NrLCBzbyB3ZSBtdXN0IGVuc3VyZSB0aGF0IGFueSBzdGFydGluZyBjb2xvbiBpcyBlc2NhcGVkLlxuICAgIHJldHVybiBlc2NhcGVTdGFydGluZ0NvbG9uKG1lc3NhZ2VQYXJ0KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYDoke2VzY2FwZUNvbG9ucyhtZXRhQmxvY2spfToke21lc3NhZ2VQYXJ0fWA7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBwbGFjZWhvbGRlck5hbWVgIGFuZCBgbWVzc2FnZVBhcnRgIGludG8gc3RyaW5ncyB0aGF0IGNhbiBiZSB1c2VkIGluIGFcbiAqIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHBsYWNlaG9sZGVyTmFtZSBUaGUgcGxhY2Vob2xkZXIgbmFtZSB0byBzZXJpYWxpemVcbiAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZm9sbG93aW5nIG1lc3NhZ2Ugc3RyaW5nIGFmdGVyIHRoaXMgcGxhY2Vob2xkZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUkxOG5UZW1wbGF0ZVBhcnQocGxhY2Vob2xkZXJOYW1lOiBzdHJpbmcsIG1lc3NhZ2VQYXJ0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAocGxhY2Vob2xkZXJOYW1lID09PSAnJykge1xuICAgIC8vIFRoZXJlIGlzIG5vIHBsYWNlaG9sZGVyIG5hbWUgYmxvY2ssIHNvIHdlIG11c3QgZW5zdXJlIHRoYXQgYW55IHN0YXJ0aW5nIGNvbG9uIGlzIGVzY2FwZWQuXG4gICAgcmV0dXJuIGVzY2FwZVN0YXJ0aW5nQ29sb24obWVzc2FnZVBhcnQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBgOiR7cGxhY2Vob2xkZXJOYW1lfToke21lc3NhZ2VQYXJ0fWA7XG4gIH1cbn1cblxuLy8gQ29udmVydHMgaTE4biBtZXRhIGluZm9ybWF0aW9uIGZvciBhIG1lc3NhZ2UgKGlkLCBkZXNjcmlwdGlvbiwgbWVhbmluZylcbi8vIHRvIGEgSnNEb2Mgc3RhdGVtZW50IGZvcm1hdHRlZCBhcyBleHBlY3RlZCBieSB0aGUgQ2xvc3VyZSBjb21waWxlci5cbmV4cG9ydCBmdW5jdGlvbiBpMThuTWV0YVRvRG9jU3RtdChtZXRhOiBJMThuTWV0YSk6IG8uSlNEb2NDb21tZW50U3RtdHxudWxsIHtcbiAgY29uc3QgdGFnczogby5KU0RvY1RhZ1tdID0gW107XG4gIGlmIChtZXRhLmRlc2NyaXB0aW9uKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5EZXNjLCB0ZXh0OiBtZXRhLmRlc2NyaXB0aW9ufSk7XG4gIH1cbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuTWVhbmluZywgdGV4dDogbWV0YS5tZWFuaW5nfSk7XG4gIH1cbiAgcmV0dXJuIHRhZ3MubGVuZ3RoID09IDAgPyBudWxsIDogbmV3IG8uSlNEb2NDb21tZW50U3RtdCh0YWdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZVN0YXJ0aW5nQ29sb24oc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL146LywgJ1xcXFw6Jyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVDb2xvbnMoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoLzovZywgJ1xcXFw6Jyk7XG59Il19