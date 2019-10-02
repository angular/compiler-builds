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
        define("@angular/compiler/src/render3/view/i18n/meta", ["require", "exports", "tslib", "@angular/compiler/src/i18n/digest", "@angular/compiler/src/i18n/i18n_ast", "@angular/compiler/src/i18n/i18n_parser", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/parser", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/view/i18n/util"], factory);
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
    var parser_1 = require("@angular/compiler/src/ml_parser/parser");
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
        function I18nMetaVisitor(interpolationConfig, keepI18nAttrs) {
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
            if (keepI18nAttrs === void 0) { keepI18nAttrs = false; }
            this.interpolationConfig = interpolationConfig;
            this.keepI18nAttrs = keepI18nAttrs;
            // i18n message generation factory
            this._createI18nMessage = i18n_parser_1.createI18nMessageFactory(interpolationConfig);
        }
        I18nMetaVisitor.prototype._generateI18nMessage = function (nodes, meta, visitNodeFn) {
            if (meta === void 0) { meta = ''; }
            var parsed = typeof meta === 'string' ? parseI18nMeta(meta) : metaFromI18nMessage(meta);
            var message = this._createI18nMessage(nodes, parsed.meaning || '', parsed.description || '', parsed.customId || '', visitNodeFn);
            if (!message.id) {
                // generate (or restore) message id if not specified in template
                message.id = typeof meta !== 'string' && meta.id || digest_1.decimalDigest(message);
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
    function processI18nMeta(htmlAstWithErrors, interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
        return new parser_1.ParseTreeResult(html.visitAll(new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), htmlAstWithErrors.rootNodes), htmlAstWithErrors.errors);
    }
    exports.processI18nMeta = processI18nMeta;
    function metaFromI18nMessage(message, id) {
        if (id === void 0) { id = null; }
        return {
            id: typeof id === 'string' ? id : message.id || '',
            customId: message.customId,
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
        if (meta.customId) {
            metaBlock = metaBlock + "@@" + meta.customId;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDREQUFtRDtJQUNuRCwwREFBK0M7SUFDL0Msc0VBQW1FO0lBQ25FLDBEQUErQztJQUMvQyw2RkFBMEc7SUFDMUcsaUVBQTBEO0lBQzFELDJEQUFnRDtJQUVoRCxxRUFBcUY7SUFTckYsU0FBUyxXQUFXLENBQUMsSUFBbUMsRUFBRSxJQUFlO1FBQ3ZFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFFRDs7OztPQUlHO0lBQ0g7UUFHRSx5QkFDWSxtQkFBdUUsRUFDdkUsYUFBOEI7WUFEOUIsb0NBQUEsRUFBQSxzQkFBMkMsbURBQTRCO1lBQ3ZFLDhCQUFBLEVBQUEscUJBQThCO1lBRDlCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0Q7WUFDdkUsa0JBQWEsR0FBYixhQUFhLENBQWlCO1lBQ3hDLGtDQUFrQztZQUNsQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsc0NBQXdCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRU8sOENBQW9CLEdBQTVCLFVBQ0ksS0FBa0IsRUFBRSxJQUEwQixFQUM5QyxXQUF3RDtZQURwQyxxQkFBQSxFQUFBLFNBQTBCO1lBRWhELElBQU0sTUFBTSxHQUNSLE9BQU8sSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFvQixDQUFDLENBQUM7WUFDL0YsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUNuQyxLQUFLLEVBQUUsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLEVBQUUsTUFBTSxD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QUFDLENBQUMsQ0FBQztTQUNuRTtRQUNELElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUMsT0FBTyx5QkFBd0IsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDLENBQUM7U0FDbEU7UUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFURCw4Q0FTQztJQUVELFNBQWdCLG1CQUFtQixDQUFDLEdBQVc7UUFDN0MsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRkQsa0RBRUM7SUFFRCxTQUFnQixZQUFZLENBQUMsR0FBVztRQUN0QyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFGRCxvQ0FFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtkZWNpbWFsRGlnZXN0fSBmcm9tICcuLi8uLi8uLi9pMThuL2RpZ2VzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtjcmVhdGVJMThuTWVzc2FnZUZhY3Rvcnl9IGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7UGFyc2VUcmVlUmVzdWx0fSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge0kxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgaGFzSTE4bkF0dHJzLCBpY3VGcm9tSTE4bk1lc3NhZ2V9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCB0eXBlIEkxOG5NZXRhID0ge1xuICBpZD86IHN0cmluZyxcbiAgY3VzdG9tSWQ/OiBzdHJpbmcsXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nLFxuICBtZWFuaW5nPzogc3RyaW5nXG59O1xuXG5mdW5jdGlvbiBzZXRJMThuUmVmcyhodG1sOiBodG1sLk5vZGUgJiB7aTE4bj86IGkxOG4uQVNUfSwgaTE4bjogaTE4bi5Ob2RlKSB7XG4gIGh0bWwuaTE4biA9IGkxOG47XG59XG5cbi8qKlxuICogVGhpcyB2aXNpdG9yIHdhbGtzIG92ZXIgSFRNTCBwYXJzZSB0cmVlIGFuZCBjb252ZXJ0cyBpbmZvcm1hdGlvbiBzdG9yZWQgaW5cbiAqIGkxOG4tcmVsYXRlZCBhdHRyaWJ1dGVzIChcImkxOG5cIiBhbmQgXCJpMThuLSpcIikgaW50byBpMThuIG1ldGEgb2JqZWN0IHRoYXQgaXNcbiAqIHN0b3JlZCB3aXRoIG90aGVyIGVsZW1lbnQncyBhbmQgYXR0cmlidXRlJ3MgaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBJMThuTWV0YVZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICBwcml2YXRlIF9jcmVhdGVJMThuTWVzc2FnZTogYW55O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyxcbiAgICAgIHByaXZhdGUga2VlcEkxOG5BdHRyczogYm9vbGVhbiA9IGZhbHNlKSB7XG4gICAgLy8gaTE4biBtZXNzYWdlIGdlbmVyYXRpb24gZmFjdG9yeVxuICAgIHRoaXMuX2NyZWF0ZUkxOG5NZXNzYWdlID0gY3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5KGludGVycG9sYXRpb25Db25maWcpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2VuZXJhdGVJMThuTWVzc2FnZShcbiAgICAgIG5vZGVzOiBodG1sLk5vZGVbXSwgbWV0YTogc3RyaW5nfGkxOG4uQVNUID0gJycsXG4gICAgICB2aXNpdE5vZGVGbj86IChodG1sOiBodG1sLk5vZGUsIGkxOG46IGkxOG4uTm9kZSkgPT4gdm9pZCk6IGkxOG4uTWVzc2FnZSB7XG4gICAgY29uc3QgcGFyc2VkOiBJMThuTWV0YSA9XG4gICAgICAgIHR5cGVvZiBtZXRhID09PSAnc3RyaW5nJyA/IHBhcnNlSTE4bk1ldGEobWV0YSkgOiBtZXRhRnJvbUkxOG5NZXNzYWdlKG1ldGEgYXMgaTE4bi5NZXNzYWdlKTtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fY3JlYXRlSTE4bk1lc3NhZ2UoXG4gICAgICAgIG5vZGVzLCBwYXJzZWQubWVhbmluZyB8fCAnJywgcGFyc2VkLmRlc2NyaXB0aW9uIHx8ICcnLCBwYXJzZWQuY3VzdG9tSWQgfHwgJycsIHZpc2l0Tm9kZUZuKTtcbiAgICBpZiAoIW1lc3NhZ2UuaWQpIHtcbiAgICAgIC8vIGdlbmVyYXRlIChvciByZXN0b3JlKSBtZXNzYWdlIGlkIGlmIG5vdCBzcGVjaWZpZWQgaW4gdGVtcGxhdGVcbiAgICAgIG1lc3NhZ2UuaWQgPSB0eXBlb2YgbWV0YSAhPT0gJ3N0cmluZycgJiYgKG1ldGEgYXMgaTE4bi5NZXNzYWdlKS5pZCB8fCBkZWNpbWFsRGlnZXN0KG1lc3NhZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbWVzc2FnZTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBodG1sLkVsZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKGhhc0kxOG5BdHRycyhlbGVtZW50KSkge1xuICAgICAgY29uc3QgYXR0cnM6IGh0bWwuQXR0cmlidXRlW10gPSBbXTtcbiAgICAgIGNvbnN0IGF0dHJzTWV0YToge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cnMpIHtcbiAgICAgICAgaWYgKGF0dHIubmFtZSA9PT0gSTE4Tl9BVFRSKSB7XG4gICAgICAgICAgLy8gcm9vdCAnaTE4bicgbm9kZSBhdHRyaWJ1dGVcbiAgICAgICAgICBjb25zdCBpMThuID0gZWxlbWVudC5pMThuIHx8IGF0dHIudmFsdWU7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoZWxlbWVudC5jaGlsZHJlbiwgaTE4biwgc2V0STE4blJlZnMpO1xuICAgICAgICAgIC8vIGRvIG5vdCBhc3NpZ24gZW1wdHkgaTE4biBtZXRhXG4gICAgICAgICAgaWYgKG1lc3NhZ2Uubm9kZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBlbGVtZW50LmkxOG4gPSBtZXNzYWdlO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHIubmFtZS5zdGFydHNXaXRoKEkxOE5fQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgICAgLy8gJ2kxOG4tKicgYXR0cmlidXRlc1xuICAgICAgICAgIGNvbnN0IGtleSA9IGF0dHIubmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICAgICAgYXR0cnNNZXRhW2tleV0gPSBhdHRyLnZhbHVlO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbm9uLWkxOG4gYXR0cmlidXRlc1xuICAgICAgICAgIGF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc2V0IGkxOG4gbWV0YSBmb3IgYXR0cmlidXRlc1xuICAgICAgaWYgKE9iamVjdC5rZXlzKGF0dHJzTWV0YSkubGVuZ3RoKSB7XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBhdHRycykge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBhdHRyc01ldGFbYXR0ci5uYW1lXTtcbiAgICAgICAgICAvLyBkbyBub3QgY3JlYXRlIHRyYW5zbGF0aW9uIGZvciBlbXB0eSBhdHRyaWJ1dGVzXG4gICAgICAgICAgaWYgKG1ldGEgIT09IHVuZGVmaW5lZCAmJiBhdHRyLnZhbHVlKSB7XG4gICAgICAgICAgICBhdHRyLmkxOG4gPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFthdHRyXSwgYXR0ci5pMThuIHx8IG1ldGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMua2VlcEkxOG5BdHRycykge1xuICAgICAgICAvLyB1cGRhdGUgZWxlbWVudCdzIGF0dHJpYnV0ZXMsXG4gICAgICAgIC8vIGtlZXBpbmcgb25seSBub24taTE4biByZWxhdGVkIG9uZXNcbiAgICAgICAgZWxlbWVudC5hdHRycyA9IGF0dHJzO1xuICAgICAgfVxuICAgIH1cbiAgICBodG1sLnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIHJldHVybiBlbGVtZW50O1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBsZXQgbWVzc2FnZTtcbiAgICBjb25zdCBtZXRhID0gZXhwYW5zaW9uLmkxOG47XG4gICAgaWYgKG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyKSB7XG4gICAgICAvLyBzZXQgSUNVIHBsYWNlaG9sZGVyIG5hbWUgKGUuZy4gXCJJQ1VfMVwiKSxcbiAgICAgIC8vIGdlbmVyYXRlZCB3aGlsZSBwcm9jZXNzaW5nIHJvb3QgZWxlbWVudCBjb250ZW50cyxcbiAgICAgIC8vIHNvIHdlIGNhbiByZWZlcmVuY2UgaXQgd2hlbiB3ZSBvdXRwdXQgdHJhbnNsYXRpb25cbiAgICAgIGNvbnN0IG5hbWUgPSBtZXRhLm5hbWU7XG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgICBjb25zdCBpY3UgPSBpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICBpY3UubmFtZSA9IG5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHdoZW4gSUNVIGlzIGEgcm9vdCBsZXZlbCB0cmFuc2xhdGlvblxuICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2V4cGFuc2lvbl0sIG1ldGEpO1xuICAgIH1cbiAgICBleHBhbnNpb24uaTE4biA9IG1lc3NhZ2U7XG4gICAgcmV0dXJuIGV4cGFuc2lvbjtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB0ZXh0OyB9XG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBhdHRyaWJ1dGU7IH1cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGNvbW1lbnQ7IH1cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGV4cGFuc2lvbkNhc2U7IH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb2Nlc3NJMThuTWV0YShcbiAgICBodG1sQXN0V2l0aEVycm9yczogUGFyc2VUcmVlUmVzdWx0LFxuICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogUGFyc2VUcmVlUmVzdWx0IHtcbiAgcmV0dXJuIG5ldyBQYXJzZVRyZWVSZXN1bHQoXG4gICAgICBodG1sLnZpc2l0QWxsKFxuICAgICAgICAgIG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgLyoga2VlcEkxOG5BdHRycyAqLyBmYWxzZSksXG4gICAgICAgICAgaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzKSxcbiAgICAgIGh0bWxBc3RXaXRoRXJyb3JzLmVycm9ycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXRhRnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgaWQ6IHN0cmluZyB8IG51bGwgPSBudWxsKTogSTE4bk1ldGEge1xuICByZXR1cm4ge1xuICAgIGlkOiB0eXBlb2YgaWQgPT09ICdzdHJpbmcnID8gaWQgOiBtZXNzYWdlLmlkIHx8ICcnLFxuICAgIGN1c3RvbUlkOiBtZXNzYWdlLmN1c3RvbUlkLFxuICAgIG1lYW5pbmc6IG1lc3NhZ2UubWVhbmluZyB8fCAnJyxcbiAgICBkZXNjcmlwdGlvbjogbWVzc2FnZS5kZXNjcmlwdGlvbiB8fCAnJ1xuICB9O1xufVxuXG4vKiogSTE4biBzZXBhcmF0b3JzIGZvciBtZXRhZGF0YSAqKi9cbmNvbnN0IEkxOE5fTUVBTklOR19TRVBBUkFUT1IgPSAnfCc7XG5jb25zdCBJMThOX0lEX1NFUEFSQVRPUiA9ICdAQCc7XG5cbi8qKlxuICogUGFyc2VzIGkxOG4gbWV0YXMgbGlrZTpcbiAqICAtIFwiQEBpZFwiLFxuICogIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuICogIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbiAqIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHBhcnNlZCBvdXRwdXQuXG4gKlxuICogQHBhcmFtIG1ldGEgU3RyaW5nIHRoYXQgcmVwcmVzZW50cyBpMThuIG1ldGFcbiAqIEByZXR1cm5zIE9iamVjdCB3aXRoIGlkLCBtZWFuaW5nIGFuZCBkZXNjcmlwdGlvbiBmaWVsZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEobWV0YT86IHN0cmluZyk6IEkxOG5NZXRhIHtcbiAgbGV0IGN1c3RvbUlkOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGlmIChtZXRhKSB7XG4gICAgY29uc3QgaWRJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX0lEX1NFUEFSQVRPUik7XG4gICAgY29uc3QgZGVzY0luZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgY3VzdG9tSWRdID1cbiAgICAgICAgKGlkSW5kZXggPiAtMSkgPyBbbWV0YS5zbGljZSgwLCBpZEluZGV4KSwgbWV0YS5zbGljZShpZEluZGV4ICsgMildIDogW21ldGEsICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID0gKGRlc2NJbmRleCA+IC0xKSA/XG4gICAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgICBbJycsIG1lYW5pbmdBbmREZXNjXTtcbiAgfVxuXG4gIHJldHVybiB7Y3VzdG9tSWQsIG1lYW5pbmcsIGRlc2NyaXB0aW9ufTtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBtZXRhYCBhbmQgYG1lc3NhZ2VQYXJ0YCBhIHN0cmluZyB0aGF0IGNhbiBiZSB1c2VkIGluIGEgYCRsb2NhbGl6ZWBcbiAqIHRhZ2dlZCBzdHJpbmcuIFRoZSBmb3JtYXQgb2YgdGhlIG1ldGFkYXRhIGlzIHRoZSBzYW1lIGFzIHRoYXQgcGFyc2VkIGJ5IGBwYXJzZUkxOG5NZXRhKClgLlxuICpcbiAqIEBwYXJhbSBtZXRhIFRoZSBtZXRhZGF0YSB0byBzZXJpYWxpemVcbiAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZmlyc3QgcGFydCBvZiB0aGUgdGFnZ2VkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSTE4bkhlYWQobWV0YTogSTE4bk1ldGEsIG1lc3NhZ2VQYXJ0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgbWV0YUJsb2NrID0gbWV0YS5kZXNjcmlwdGlvbiB8fCAnJztcbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIG1ldGFCbG9jayA9IGAke21ldGEubWVhbmluZ318JHttZXRhQmxvY2t9YDtcbiAgfVxuICBpZiAobWV0YS5jdXN0b21JZCkge1xuICAgIG1ldGFCbG9jayA9IGAke21ldGFCbG9ja31AQCR7bWV0YS5jdXN0b21JZH1gO1xuICB9XG4gIGlmIChtZXRhQmxvY2sgPT09ICcnKSB7XG4gICAgLy8gVGhlcmUgaXMgbm8gbWV0YUJsb2NrLCBzbyB3ZSBtdXN0IGVuc3VyZSB0aGF0IGFueSBzdGFydGluZyBjb2xvbiBpcyBlc2NhcGVkLlxuICAgIHJldHVybiBlc2NhcGVTdGFydGluZ0NvbG9uKG1lc3NhZ2VQYXJ0KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYDoke2VzY2FwZUNvbG9ucyhtZXRhQmxvY2spfToke21lc3NhZ2VQYXJ0fWA7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBwbGFjZWhvbGRlck5hbWVgIGFuZCBgbWVzc2FnZVBhcnRgIGludG8gc3RyaW5ncyB0aGF0IGNhbiBiZSB1c2VkIGluIGFcbiAqIGAkbG9jYWxpemVgIHRhZ2dlZCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHBsYWNlaG9sZGVyTmFtZSBUaGUgcGxhY2Vob2xkZXIgbmFtZSB0byBzZXJpYWxpemVcbiAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZm9sbG93aW5nIG1lc3NhZ2Ugc3RyaW5nIGFmdGVyIHRoaXMgcGxhY2Vob2xkZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUkxOG5UZW1wbGF0ZVBhcnQocGxhY2Vob2xkZXJOYW1lOiBzdHJpbmcsIG1lc3NhZ2VQYXJ0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAocGxhY2Vob2xkZXJOYW1lID09PSAnJykge1xuICAgIC8vIFRoZXJlIGlzIG5vIHBsYWNlaG9sZGVyIG5hbWUgYmxvY2ssIHNvIHdlIG11c3QgZW5zdXJlIHRoYXQgYW55IHN0YXJ0aW5nIGNvbG9uIGlzIGVzY2FwZWQuXG4gICAgcmV0dXJuIGVzY2FwZVN0YXJ0aW5nQ29sb24obWVzc2FnZVBhcnQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBgOiR7cGxhY2Vob2xkZXJOYW1lfToke21lc3NhZ2VQYXJ0fWA7XG4gIH1cbn1cblxuLy8gQ29udmVydHMgaTE4biBtZXRhIGluZm9ybWF0aW9uIGZvciBhIG1lc3NhZ2UgKGlkLCBkZXNjcmlwdGlvbiwgbWVhbmluZylcbi8vIHRvIGEgSnNEb2Mgc3RhdGVtZW50IGZvcm1hdHRlZCBhcyBleHBlY3RlZCBieSB0aGUgQ2xvc3VyZSBjb21waWxlci5cbmV4cG9ydCBmdW5jdGlvbiBpMThuTWV0YVRvRG9jU3RtdChtZXRhOiBJMThuTWV0YSk6IG8uSlNEb2NDb21tZW50U3RtdHxudWxsIHtcbiAgY29uc3QgdGFnczogby5KU0RvY1RhZ1tdID0gW107XG4gIGlmIChtZXRhLmRlc2NyaXB0aW9uKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5EZXNjLCB0ZXh0OiBtZXRhLmRlc2NyaXB0aW9ufSk7XG4gIH1cbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuTWVhbmluZywgdGV4dDogbWV0YS5tZWFuaW5nfSk7XG4gIH1cbiAgcmV0dXJuIHRhZ3MubGVuZ3RoID09IDAgPyBudWxsIDogbmV3IG8uSlNEb2NDb21tZW50U3RtdCh0YWdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZVN0YXJ0aW5nQ29sb24oc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL146LywgJ1xcXFw6Jyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVDb2xvbnMoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoLzovZywgJ1xcXFw6Jyk7XG59Il19