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
            var message = this._createI18nMessage(nodes, parsed.meaning || '', parsed.description || '', parsed.id || '', visitNodeFn);
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
        var id;
        var meaning;
        var description;
        if (meta) {
            var idIndex = meta.indexOf(I18N_ID_SEPARATOR);
            var descIndex = meta.indexOf(I18N_MEANING_SEPARATOR);
            var meaningAndDesc = void 0;
            _a = tslib_1.__read((idIndex > -1) ? [meta.slice(0, idIndex), meta.slice(idIndex + 2)] : [meta, ''], 2), meaningAndDesc = _a[0], id = _a[1];
            _b = tslib_1.__read((descIndex > -1) ?
                [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
                ['', meaningAndDesc], 2), meaning = _b[0], description = _b[1];
        }
        return { id: id, meaning: meaning, description: description };
    }
    exports.parseI18nMeta = parseI18nMeta;
    /**
     * Serialize the given `meta` into a string that can be used in a `$localize` tagged string metadata
     * block. The format is the same as that parsed by `parseI18nMeta()`.
     *
     * @param meta The metadata to serialize
     */
    function serializeI18nMeta(meta) {
        var metaBlock = meta.description || '';
        if (meta.meaning) {
            metaBlock = meta.meaning + "|" + metaBlock;
        }
        if (meta.id) {
            metaBlock = metaBlock + "@@" + meta.id;
        }
        return metaBlock;
    }
    exports.serializeI18nMeta = serializeI18nMeta;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDREQUFtRDtJQUNuRCwwREFBK0M7SUFDL0Msc0VBQW1FO0lBQ25FLDBEQUErQztJQUMvQyw2RkFBMEc7SUFDMUcsaUVBQTBEO0lBQzFELDJEQUFnRDtJQUVoRCxxRUFBcUY7SUFRckYsU0FBUyxXQUFXLENBQUMsSUFBbUMsRUFBRSxJQUFlO1FBQ3ZFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFFRDs7OztPQUlHO0lBQ0g7UUFHRSx5QkFDWSxtQkFBdUUsRUFDdkUsYUFBOEI7WUFEOUIsb0NBQUEsRUFBQSxzQkFBMkMsbURBQTRCO1lBQ3ZFLDhCQUFBLEVBQUEscUJBQThCO1lBRDlCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0Q7WUFDdkUsa0JBQWEsR0FBYixhQUFhLENBQWlCO1lBQ3hDLGtDQUFrQztZQUNsQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsc0NBQXdCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRU8sOENBQW9CLEdBQTVCLFVBQ0ksS0FBa0IsRUFBRSxJQUEwQixFQUM5QyxXQUF3RDtZQURwQyxxQkFBQSxFQUFBLFNBQTBCO1lBRWhELElBQU0sTUFBTSxHQUNSLE9BQU8sSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFvQixDQUFDLENBQUM7WUFDL0YsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUNuQyxLQUFLLEVBQUUsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLEVBQUUsTUFBTSxD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QUFDO0lBQ3BDLENBQUM7SUFqQkQsc0NBaUJDO0lBRUQ7Ozs7O09BS0c7SUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxJQUFjO1FBQzlDLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDO1FBQ3ZDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNoQixTQUFTLEdBQU0sSUFBSSxDQUFDLE9BQU8sU0FBSSxTQUFXLENBQUM7U0FDNUM7UUFDRCxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUU7WUFDWCxTQUFTLEdBQU0sU0FBUyxVQUFLLElBQUksQ0FBQyxFQUFJLENBQUM7U0FDeEM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBVEQsOENBU0M7SUFFRCwwRUFBMEU7SUFDMUUsc0VBQXNFO0lBQ3RFLFNBQWdCLGlCQUFpQixDQUFDLElBQWM7UUFDOUMsSUFBTSxJQUFJLEdBQWlCLEVBQUUsQ0FBQztRQUM5QixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sbUJBQXFCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUMsQ0FBQyxDQUFDO1NBQ25FO1FBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLHlCQUF3QixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQztTQUNsRTtRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQVRELDhDQVNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2RlY2ltYWxEaWdlc3R9IGZyb20gJy4uLy4uLy4uL2kxOG4vZGlnZXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge2NyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeX0gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX3BhcnNlcic7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtQYXJzZVRyZWVSZXN1bHR9IGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbmltcG9ydCB7STE4Tl9BVFRSLCBJMThOX0FUVFJfUFJFRklYLCBoYXNJMThuQXR0cnMsIGljdUZyb21JMThuTWVzc2FnZX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IHR5cGUgSTE4bk1ldGEgPSB7XG4gIGlkPzogc3RyaW5nLFxuICBkZXNjcmlwdGlvbj86IHN0cmluZyxcbiAgbWVhbmluZz86IHN0cmluZ1xufTtcblxuZnVuY3Rpb24gc2V0STE4blJlZnMoaHRtbDogaHRtbC5Ob2RlICYge2kxOG4/OiBpMThuLkFTVH0sIGkxOG46IGkxOG4uTm9kZSkge1xuICBodG1sLmkxOG4gPSBpMThuO1xufVxuXG4vKipcbiAqIFRoaXMgdmlzaXRvciB3YWxrcyBvdmVyIEhUTUwgcGFyc2UgdHJlZSBhbmQgY29udmVydHMgaW5mb3JtYXRpb24gc3RvcmVkIGluXG4gKiBpMThuLXJlbGF0ZWQgYXR0cmlidXRlcyAoXCJpMThuXCIgYW5kIFwiaTE4bi0qXCIpIGludG8gaTE4biBtZXRhIG9iamVjdCB0aGF0IGlzXG4gKiBzdG9yZWQgd2l0aCBvdGhlciBlbGVtZW50J3MgYW5kIGF0dHJpYnV0ZSdzIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgSTE4bk1ldGFWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgcHJpdmF0ZSBfY3JlYXRlSTE4bk1lc3NhZ2U6IGFueTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgICBwcml2YXRlIGtlZXBJMThuQXR0cnM6IGJvb2xlYW4gPSBmYWxzZSkge1xuICAgIC8vIGkxOG4gbWVzc2FnZSBnZW5lcmF0aW9uIGZhY3RvcnlcbiAgICB0aGlzLl9jcmVhdGVJMThuTWVzc2FnZSA9IGNyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeShpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dlbmVyYXRlSTE4bk1lc3NhZ2UoXG4gICAgICBub2RlczogaHRtbC5Ob2RlW10sIG1ldGE6IHN0cmluZ3xpMThuLkFTVCA9ICcnLFxuICAgICAgdmlzaXROb2RlRm4/OiAoaHRtbDogaHRtbC5Ob2RlLCBpMThuOiBpMThuLk5vZGUpID0+IHZvaWQpOiBpMThuLk1lc3NhZ2Uge1xuICAgIGNvbnN0IHBhcnNlZDogSTE4bk1ldGEgPVxuICAgICAgICB0eXBlb2YgbWV0YSA9PT0gJ3N0cmluZycgPyBwYXJzZUkxOG5NZXRhKG1ldGEpIDogbWV0YUZyb21JMThuTWVzc2FnZShtZXRhIGFzIGkxOG4uTWVzc2FnZSk7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2NyZWF0ZUkxOG5NZXNzYWdlKFxuICAgICAgICBub2RlcywgcGFyc2VkLm1lYW5pbmcgfHwgJycsIHBhcnNlZC5kZXNjcmlwdGlvbiB8fCAnJywgcGFyc2VkLmlkIHx8ICcnLCB2aXNpdE5vZGVGbik7XG4gICAgaWYgKCFtZXNzYWdlLmlkKSB7XG4gICAgICAvLyBnZW5lcmF0ZSAob3IgcmVzdG9yZSkgbWVzc2FnZSBpZCBpZiBub3Qgc3BlY2lmaWVkIGluIHRlbXBsYXRlXG4gICAgICBtZXNzYWdlLmlkID0gdHlwZW9mIG1ldGEgIT09ICdzdHJpbmcnICYmIChtZXRhIGFzIGkxOG4uTWVzc2FnZSkuaWQgfHwgZGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbiAgICB9XG4gICAgcmV0dXJuIG1lc3NhZ2U7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogaHRtbC5FbGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChoYXNJMThuQXR0cnMoZWxlbWVudCkpIHtcbiAgICAgIGNvbnN0IGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdID0gW107XG4gICAgICBjb25zdCBhdHRyc01ldGE6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cbiAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJzKSB7XG4gICAgICAgIGlmIChhdHRyLm5hbWUgPT09IEkxOE5fQVRUUikge1xuICAgICAgICAgIC8vIHJvb3QgJ2kxOG4nIG5vZGUgYXR0cmlidXRlXG4gICAgICAgICAgY29uc3QgaTE4biA9IGVsZW1lbnQuaTE4biB8fCBhdHRyLnZhbHVlO1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKGVsZW1lbnQuY2hpbGRyZW4sIGkxOG4sIHNldEkxOG5SZWZzKTtcbiAgICAgICAgICAvLyBkbyBub3QgYXNzaWduIGVtcHR5IGkxOG4gbWV0YVxuICAgICAgICAgIGlmIChtZXNzYWdlLm5vZGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgZWxlbWVudC5pMThuID0gbWVzc2FnZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmIChhdHRyLm5hbWUuc3RhcnRzV2l0aChJMThOX0FUVFJfUFJFRklYKSkge1xuICAgICAgICAgIC8vICdpMThuLSonIGF0dHJpYnV0ZXNcbiAgICAgICAgICBjb25zdCBrZXkgPSBhdHRyLm5hbWUuc2xpY2UoSTE4Tl9BVFRSX1BSRUZJWC5sZW5ndGgpO1xuICAgICAgICAgIGF0dHJzTWV0YVtrZXldID0gYXR0ci52YWx1ZTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vbi1pMThuIGF0dHJpYnV0ZXNcbiAgICAgICAgICBhdHRycy5wdXNoKGF0dHIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHNldCBpMThuIG1ldGEgZm9yIGF0dHJpYnV0ZXNcbiAgICAgIGlmIChPYmplY3Qua2V5cyhhdHRyc01ldGEpLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgYXR0cnMpIHtcbiAgICAgICAgICBjb25zdCBtZXRhID0gYXR0cnNNZXRhW2F0dHIubmFtZV07XG4gICAgICAgICAgLy8gZG8gbm90IGNyZWF0ZSB0cmFuc2xhdGlvbiBmb3IgZW1wdHkgYXR0cmlidXRlc1xuICAgICAgICAgIGlmIChtZXRhICE9PSB1bmRlZmluZWQgJiYgYXR0ci52YWx1ZSkge1xuICAgICAgICAgICAgYXR0ci5pMThuID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbYXR0cl0sIGF0dHIuaTE4biB8fCBtZXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmtlZXBJMThuQXR0cnMpIHtcbiAgICAgICAgLy8gdXBkYXRlIGVsZW1lbnQncyBhdHRyaWJ1dGVzLFxuICAgICAgICAvLyBrZWVwaW5nIG9ubHkgbm9uLWkxOG4gcmVsYXRlZCBvbmVzXG4gICAgICAgIGVsZW1lbnQuYXR0cnMgPSBhdHRycztcbiAgICAgIH1cbiAgICB9XG4gICAgaHRtbC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKTtcbiAgICByZXR1cm4gZWxlbWVudDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgbGV0IG1lc3NhZ2U7XG4gICAgY29uc3QgbWV0YSA9IGV4cGFuc2lvbi5pMThuO1xuICAgIGlmIChtZXRhIGluc3RhbmNlb2YgaTE4bi5JY3VQbGFjZWhvbGRlcikge1xuICAgICAgLy8gc2V0IElDVSBwbGFjZWhvbGRlciBuYW1lIChlLmcuIFwiSUNVXzFcIiksXG4gICAgICAvLyBnZW5lcmF0ZWQgd2hpbGUgcHJvY2Vzc2luZyByb290IGVsZW1lbnQgY29udGVudHMsXG4gICAgICAvLyBzbyB3ZSBjYW4gcmVmZXJlbmNlIGl0IHdoZW4gd2Ugb3V0cHV0IHRyYW5zbGF0aW9uXG4gICAgICBjb25zdCBuYW1lID0gbWV0YS5uYW1lO1xuICAgICAgbWVzc2FnZSA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2V4cGFuc2lvbl0sIG1ldGEpO1xuICAgICAgY29uc3QgaWN1ID0gaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgaWN1Lm5hbWUgPSBuYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB3aGVuIElDVSBpcyBhIHJvb3QgbGV2ZWwgdHJhbnNsYXRpb25cbiAgICAgIG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFtleHBhbnNpb25dLCBtZXRhKTtcbiAgICB9XG4gICAgZXhwYW5zaW9uLmkxOG4gPSBtZXNzYWdlO1xuICAgIHJldHVybiBleHBhbnNpb247XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGV4dDsgfVxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gYXR0cmlidXRlOyB9XG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBjb21tZW50OyB9XG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBleHBhbnNpb25DYXNlOyB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9jZXNzSTE4bk1ldGEoXG4gICAgaHRtbEFzdFdpdGhFcnJvcnM6IFBhcnNlVHJlZVJlc3VsdCxcbiAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gIHJldHVybiBuZXcgUGFyc2VUcmVlUmVzdWx0KFxuICAgICAgaHRtbC52aXNpdEFsbChcbiAgICAgICAgICBuZXcgSTE4bk1ldGFWaXNpdG9yKGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gZmFsc2UpLFxuICAgICAgICAgIGh0bWxBc3RXaXRoRXJyb3JzLnJvb3ROb2RlcyksXG4gICAgICBodG1sQXN0V2l0aEVycm9ycy5lcnJvcnMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWV0YUZyb21JMThuTWVzc2FnZShtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIGlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IEkxOG5NZXRhIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdHlwZW9mIGlkID09PSAnc3RyaW5nJyA/IGlkIDogbWVzc2FnZS5pZCB8fCAnJyxcbiAgICBtZWFuaW5nOiBtZXNzYWdlLm1lYW5pbmcgfHwgJycsXG4gICAgZGVzY3JpcHRpb246IG1lc3NhZ2UuZGVzY3JpcHRpb24gfHwgJydcbiAgfTtcbn1cblxuLyoqIEkxOG4gc2VwYXJhdG9ycyBmb3IgbWV0YWRhdGEgKiovXG5jb25zdCBJMThOX01FQU5JTkdfU0VQQVJBVE9SID0gJ3wnO1xuY29uc3QgSTE4Tl9JRF9TRVBBUkFUT1IgPSAnQEAnO1xuXG4vKipcbiAqIFBhcnNlcyBpMThuIG1ldGFzIGxpa2U6XG4gKiAgLSBcIkBAaWRcIixcbiAqICAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbiAqICAtIFwibWVhbmluZ3xkZXNjcmlwdGlvbltAQGlkXVwiXG4gKiBhbmQgcmV0dXJucyBhbiBvYmplY3Qgd2l0aCBwYXJzZWQgb3V0cHV0LlxuICpcbiAqIEBwYXJhbSBtZXRhIFN0cmluZyB0aGF0IHJlcHJlc2VudHMgaTE4biBtZXRhXG4gKiBAcmV0dXJucyBPYmplY3Qgd2l0aCBpZCwgbWVhbmluZyBhbmQgZGVzY3JpcHRpb24gZmllbGRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUkxOG5NZXRhKG1ldGE/OiBzdHJpbmcpOiBJMThuTWV0YSB7XG4gIGxldCBpZDogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZDtcblxuICBpZiAobWV0YSkge1xuICAgIGNvbnN0IGlkSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9JRF9TRVBBUkFUT1IpO1xuICAgIGNvbnN0IGRlc2NJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX01FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGlkXSA9XG4gICAgICAgIChpZEluZGV4ID4gLTEpID8gW21ldGEuc2xpY2UoMCwgaWRJbmRleCksIG1ldGEuc2xpY2UoaWRJbmRleCArIDIpXSA6IFttZXRhLCAnJ107XG4gICAgW21lYW5pbmcsIGRlc2NyaXB0aW9uXSA9IChkZXNjSW5kZXggPiAtMSkgP1xuICAgICAgICBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldIDpcbiAgICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2lkLCBtZWFuaW5nLCBkZXNjcmlwdGlvbn07XG59XG5cbi8qKlxuICogU2VyaWFsaXplIHRoZSBnaXZlbiBgbWV0YWAgaW50byBhIHN0cmluZyB0aGF0IGNhbiBiZSB1c2VkIGluIGEgYCRsb2NhbGl6ZWAgdGFnZ2VkIHN0cmluZyBtZXRhZGF0YVxuICogYmxvY2suIFRoZSBmb3JtYXQgaXMgdGhlIHNhbWUgYXMgdGhhdCBwYXJzZWQgYnkgYHBhcnNlSTE4bk1ldGEoKWAuXG4gKlxuICogQHBhcmFtIG1ldGEgVGhlIG1ldGFkYXRhIHRvIHNlcmlhbGl6ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSTE4bk1ldGEobWV0YTogSTE4bk1ldGEpOiBzdHJpbmcge1xuICBsZXQgbWV0YUJsb2NrID0gbWV0YS5kZXNjcmlwdGlvbiB8fCAnJztcbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIG1ldGFCbG9jayA9IGAke21ldGEubWVhbmluZ318JHttZXRhQmxvY2t9YDtcbiAgfVxuICBpZiAobWV0YS5pZCkge1xuICAgIG1ldGFCbG9jayA9IGAke21ldGFCbG9ja31AQCR7bWV0YS5pZH1gO1xuICB9XG4gIHJldHVybiBtZXRhQmxvY2s7XG59XG5cbi8vIENvbnZlcnRzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiBmb3IgYSBtZXNzYWdlIChpZCwgZGVzY3JpcHRpb24sIG1lYW5pbmcpXG4vLyB0byBhIEpzRG9jIHN0YXRlbWVudCBmb3JtYXR0ZWQgYXMgZXhwZWN0ZWQgYnkgdGhlIENsb3N1cmUgY29tcGlsZXIuXG5leHBvcnQgZnVuY3Rpb24gaTE4bk1ldGFUb0RvY1N0bXQobWV0YTogSTE4bk1ldGEpOiBvLkpTRG9jQ29tbWVudFN0bXR8bnVsbCB7XG4gIGNvbnN0IHRhZ3M6IG8uSlNEb2NUYWdbXSA9IFtdO1xuICBpZiAobWV0YS5kZXNjcmlwdGlvbikge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuRGVzYywgdGV4dDogbWV0YS5kZXNjcmlwdGlvbn0pO1xuICB9XG4gIGlmIChtZXRhLm1lYW5pbmcpIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLk1lYW5pbmcsIHRleHQ6IG1ldGEubWVhbmluZ30pO1xuICB9XG4gIHJldHVybiB0YWdzLmxlbmd0aCA9PSAwID8gbnVsbCA6IG5ldyBvLkpTRG9jQ29tbWVudFN0bXQodGFncyk7XG59XG4iXX0=