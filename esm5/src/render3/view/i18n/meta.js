/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { decimalDigest } from '../../../i18n/digest';
import * as i18n from '../../../i18n/i18n_ast';
import { createI18nMessageFactory } from '../../../i18n/i18n_parser';
import * as html from '../../../ml_parser/ast';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../../ml_parser/interpolation_config';
import { ParseTreeResult } from '../../../ml_parser/parser';
import * as o from '../../../output/output_ast';
import { I18N_ATTR, I18N_ATTR_PREFIX, hasI18nAttrs, icuFromI18nMessage } from './util';
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
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        if (keepI18nAttrs === void 0) { keepI18nAttrs = false; }
        this.interpolationConfig = interpolationConfig;
        this.keepI18nAttrs = keepI18nAttrs;
        // i18n message generation factory
        this._createI18nMessage = createI18nMessageFactory(interpolationConfig);
    }
    I18nMetaVisitor.prototype._generateI18nMessage = function (nodes, meta, visitNodeFn) {
        if (meta === void 0) { meta = ''; }
        var parsed = typeof meta === 'string' ? parseI18nMeta(meta) : metaFromI18nMessage(meta);
        var message = this._createI18nMessage(nodes, parsed.meaning || '', parsed.description || '', parsed.id || '', visitNodeFn);
        if (!message.id) {
            // generate (or restore) message id if not specified in template
            message.id = typeof meta !== 'string' && meta.id || decimalDigest(message);
        }
        return message;
    };
    I18nMetaVisitor.prototype.visitElement = function (element, context) {
        var e_1, _a, e_2, _b;
        if (hasI18nAttrs(element)) {
            var attrs = [];
            var attrsMeta = {};
            try {
                for (var _c = tslib_1.__values(element.attrs), _d = _c.next(); !_d.done; _d = _c.next()) {
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
            var icu = icuFromI18nMessage(message);
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
export { I18nMetaVisitor };
export function processI18nMeta(htmlAstWithErrors, interpolationConfig) {
    if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
    return new ParseTreeResult(html.visitAll(new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), htmlAstWithErrors.rootNodes), htmlAstWithErrors.errors);
}
export function metaFromI18nMessage(message, id) {
    if (id === void 0) { id = null; }
    return {
        id: typeof id === 'string' ? id : message.id || '',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDbkQsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNuRSxPQUFPLEtBQUssSUFBSSxNQUFNLHdCQUF3QixDQUFDO0FBQy9DLE9BQU8sRUFBQyw0QkFBNEIsRUFBc0IsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRyxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDMUQsT0FBTyxLQUFLLENBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUVoRCxPQUFPLEVBQUMsU0FBUyxFQUFFLGdCQUFnQixFQUFFLFlBQVksRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQVFyRixTQUFTLFdBQVcsQ0FBQyxJQUFtQyxFQUFFLElBQWU7SUFDdkUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDbkIsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSDtJQUdFLHlCQUNZLG1CQUF1RSxFQUN2RSxhQUE4QjtRQUQ5QixvQ0FBQSxFQUFBLGtEQUF1RTtRQUN2RSw4QkFBQSxFQUFBLHFCQUE4QjtRQUQ5Qix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQW9EO1FBQ3ZFLGtCQUFhLEdBQWIsYUFBYSxDQUFpQjtRQUN4QyxrQ0FBa0M7UUFDbEMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLHdCQUF3QixDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLDhDQUFvQixHQUE1QixVQUNJLEtBQWtCLEVB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QU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3ZELElBQUksY0FBYyxTQUFRLENBQUM7UUFDM0IsdUdBQ21GLEVBRGxGLHNCQUFjLEVBQUUsVUFBRSxDQUNpRTtRQUNwRjs7b0NBRXdCLEVBRnZCLGVBQU8sRUFBRSxtQkFBVyxDQUVJO0tBQzFCO0lBRUQsT0FBTyxFQUFDLEVBQUUsSUFBQSxFQUFFLE9BQU8sU0FBQSxFQUFFLFdBQVcsYUFBQSxFQUFDLENBQUM7QUFDcEMsQ0FBQztBQUVELDBFQUEwRTtBQUMxRSxzRUFBc0U7QUFDdEUsTUFBTSxVQUFVLGlCQUFpQixDQUFDLElBQWM7SUFDOUMsSUFBTSxJQUFJLEdBQWlCLEVBQUUsQ0FBQztJQUM5QixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLE9BQU8sbUJBQXFCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUMsQ0FBQyxDQUFDO0tBQ25FO0lBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLHlCQUF3QixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQztLQUNsRTtJQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtkZWNpbWFsRGlnZXN0fSBmcm9tICcuLi8uLi8uLi9pMThuL2RpZ2VzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9hc3QnO1xuaW1wb3J0IHtjcmVhdGVJMThuTWVzc2FnZUZhY3Rvcnl9IGZyb20gJy4uLy4uLy4uL2kxOG4vaTE4bl9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7UGFyc2VUcmVlUmVzdWx0fSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5pbXBvcnQge0kxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgaGFzSTE4bkF0dHJzLCBpY3VGcm9tSTE4bk1lc3NhZ2V9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCB0eXBlIEkxOG5NZXRhID0ge1xuICBpZD86IHN0cmluZyxcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG4gIG1lYW5pbmc/OiBzdHJpbmdcbn07XG5cbmZ1bmN0aW9uIHNldEkxOG5SZWZzKGh0bWw6IGh0bWwuTm9kZSAmIHtpMThuPzogaTE4bi5BU1R9LCBpMThuOiBpMThuLk5vZGUpIHtcbiAgaHRtbC5pMThuID0gaTE4bjtcbn1cblxuLyoqXG4gKiBUaGlzIHZpc2l0b3Igd2Fsa3Mgb3ZlciBIVE1MIHBhcnNlIHRyZWUgYW5kIGNvbnZlcnRzIGluZm9ybWF0aW9uIHN0b3JlZCBpblxuICogaTE4bi1yZWxhdGVkIGF0dHJpYnV0ZXMgKFwiaTE4blwiIGFuZCBcImkxOG4tKlwiKSBpbnRvIGkxOG4gbWV0YSBvYmplY3QgdGhhdCBpc1xuICogc3RvcmVkIHdpdGggb3RoZXIgZWxlbWVudCdzIGFuZCBhdHRyaWJ1dGUncyBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIEkxOG5NZXRhVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIHByaXZhdGUgX2NyZWF0ZUkxOG5NZXNzYWdlOiBhbnk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgICAgcHJpdmF0ZSBrZWVwSTE4bkF0dHJzOiBib29sZWFuID0gZmFsc2UpIHtcbiAgICAvLyBpMThuIG1lc3NhZ2UgZ2VuZXJhdGlvbiBmYWN0b3J5XG4gICAgdGhpcy5fY3JlYXRlSTE4bk1lc3NhZ2UgPSBjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnkoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIH1cblxuICBwcml2YXRlIF9nZW5lcmF0ZUkxOG5NZXNzYWdlKFxuICAgICAgbm9kZXM6IGh0bWwuTm9kZVtdLCBtZXRhOiBzdHJpbmd8aTE4bi5BU1QgPSAnJyxcbiAgICAgIHZpc2l0Tm9kZUZuPzogKGh0bWw6IGh0bWwuTm9kZSwgaTE4bjogaTE4bi5Ob2RlKSA9PiB2b2lkKTogaTE4bi5NZXNzYWdlIHtcbiAgICBjb25zdCBwYXJzZWQ6IEkxOG5NZXRhID1cbiAgICAgICAgdHlwZW9mIG1ldGEgPT09ICdzdHJpbmcnID8gcGFyc2VJMThuTWV0YShtZXRhKSA6IG1ldGFGcm9tSTE4bk1lc3NhZ2UobWV0YSBhcyBpMThuLk1lc3NhZ2UpO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9jcmVhdGVJMThuTWVzc2FnZShcbiAgICAgICAgbm9kZXMsIHBhcnNlZC5tZWFuaW5nIHx8ICcnLCBwYXJzZWQuZGVzY3JpcHRpb24gfHwgJycsIHBhcnNlZC5pZCB8fCAnJywgdmlzaXROb2RlRm4pO1xuICAgIGlmICghbWVzc2FnZS5pZCkge1xuICAgICAgLy8gZ2VuZXJhdGUgKG9yIHJlc3RvcmUpIG1lc3NhZ2UgaWQgaWYgbm90IHNwZWNpZmllZCBpbiB0ZW1wbGF0ZVxuICAgICAgbWVzc2FnZS5pZCA9IHR5cGVvZiBtZXRhICE9PSAnc3RyaW5nJyAmJiAobWV0YSBhcyBpMThuLk1lc3NhZ2UpLmlkIHx8IGRlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG4gICAgfVxuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoaGFzSTE4bkF0dHJzKGVsZW1lbnQpKSB7XG4gICAgICBjb25zdCBhdHRyczogaHRtbC5BdHRyaWJ1dGVbXSA9IFtdO1xuICAgICAgY29uc3QgYXR0cnNNZXRhOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRycykge1xuICAgICAgICBpZiAoYXR0ci5uYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgICAvLyByb290ICdpMThuJyBub2RlIGF0dHJpYnV0ZVxuICAgICAgICAgIGNvbnN0IGkxOG4gPSBlbGVtZW50LmkxOG4gfHwgYXR0ci52YWx1ZTtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShlbGVtZW50LmNoaWxkcmVuLCBpMThuLCBzZXRJMThuUmVmcyk7XG4gICAgICAgICAgLy8gZG8gbm90IGFzc2lnbiBlbXB0eSBpMThuIG1ldGFcbiAgICAgICAgICBpZiAobWVzc2FnZS5ub2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuaTE4biA9IG1lc3NhZ2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgICAvLyAnaTE4bi0qJyBhdHRyaWJ1dGVzXG4gICAgICAgICAgY29uc3Qga2V5ID0gYXR0ci5uYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKTtcbiAgICAgICAgICBhdHRyc01ldGFba2V5XSA9IGF0dHIudmFsdWU7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBub24taTE4biBhdHRyaWJ1dGVzXG4gICAgICAgICAgYXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBzZXQgaTE4biBtZXRhIGZvciBhdHRyaWJ1dGVzXG4gICAgICBpZiAoT2JqZWN0LmtleXMoYXR0cnNNZXRhKS5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJzKSB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IGF0dHJzTWV0YVthdHRyLm5hbWVdO1xuICAgICAgICAgIC8vIGRvIG5vdCBjcmVhdGUgdHJhbnNsYXRpb24gZm9yIGVtcHR5IGF0dHJpYnV0ZXNcbiAgICAgICAgICBpZiAobWV0YSAhPT0gdW5kZWZpbmVkICYmIGF0dHIudmFsdWUpIHtcbiAgICAgICAgICAgIGF0dHIuaTE4biA9IHRoaXMuX2dlbmVyYXRlSTE4bk1lc3NhZ2UoW2F0dHJdLCBhdHRyLmkxOG4gfHwgbWV0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5rZWVwSTE4bkF0dHJzKSB7XG4gICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50J3MgYXR0cmlidXRlcyxcbiAgICAgICAgLy8ga2VlcGluZyBvbmx5IG5vbi1pMThuIHJlbGF0ZWQgb25lc1xuICAgICAgICBlbGVtZW50LmF0dHJzID0gYXR0cnM7XG4gICAgICB9XG4gICAgfVxuICAgIGh0bWwudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGxldCBtZXNzYWdlO1xuICAgIGNvbnN0IG1ldGEgPSBleHBhbnNpb24uaTE4bjtcbiAgICBpZiAobWV0YSBpbnN0YW5jZW9mIGkxOG4uSWN1UGxhY2Vob2xkZXIpIHtcbiAgICAgIC8vIHNldCBJQ1UgcGxhY2Vob2xkZXIgbmFtZSAoZS5nLiBcIklDVV8xXCIpLFxuICAgICAgLy8gZ2VuZXJhdGVkIHdoaWxlIHByb2Nlc3Npbmcgcm9vdCBlbGVtZW50IGNvbnRlbnRzLFxuICAgICAgLy8gc28gd2UgY2FuIHJlZmVyZW5jZSBpdCB3aGVuIHdlIG91dHB1dCB0cmFuc2xhdGlvblxuICAgICAgY29uc3QgbmFtZSA9IG1ldGEubmFtZTtcbiAgICAgIG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKFtleHBhbnNpb25dLCBtZXRhKTtcbiAgICAgIGNvbnN0IGljdSA9IGljdUZyb21JMThuTWVzc2FnZShtZXNzYWdlKTtcbiAgICAgIGljdS5uYW1lID0gbmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gd2hlbiBJQ1UgaXMgYSByb290IGxldmVsIHRyYW5zbGF0aW9uXG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgfVxuICAgIGV4cGFuc2lvbi5pMThuID0gbWVzc2FnZTtcbiAgICByZXR1cm4gZXhwYW5zaW9uO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHRleHQ7IH1cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGF0dHJpYnV0ZTsgfVxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gY29tbWVudDsgfVxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gZXhwYW5zaW9uQ2FzZTsgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvY2Vzc0kxOG5NZXRhKFxuICAgIGh0bWxBc3RXaXRoRXJyb3JzOiBQYXJzZVRyZWVSZXN1bHQsXG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBQYXJzZVRyZWVSZXN1bHQge1xuICByZXR1cm4gbmV3IFBhcnNlVHJlZVJlc3VsdChcbiAgICAgIGh0bWwudmlzaXRBbGwoXG4gICAgICAgICAgbmV3IEkxOG5NZXRhVmlzaXRvcihpbnRlcnBvbGF0aW9uQ29uZmlnLCAvKiBrZWVwSTE4bkF0dHJzICovIGZhbHNlKSxcbiAgICAgICAgICBodG1sQXN0V2l0aEVycm9ycy5yb290Tm9kZXMpLFxuICAgICAgaHRtbEFzdFdpdGhFcnJvcnMuZXJyb3JzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ldGFGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZTogaTE4bi5NZXNzYWdlLCBpZDogc3RyaW5nIHwgbnVsbCA9IG51bGwpOiBJMThuTWV0YSB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHR5cGVvZiBpZCA9PT0gJ3N0cmluZycgPyBpZCA6IG1lc3NhZ2UuaWQgfHwgJycsXG4gICAgbWVhbmluZzogbWVzc2FnZS5tZWFuaW5nIHx8ICcnLFxuICAgIGRlc2NyaXB0aW9uOiBtZXNzYWdlLmRlc2NyaXB0aW9uIHx8ICcnXG4gIH07XG59XG5cbi8qKiBJMThuIHNlcGFyYXRvcnMgZm9yIG1ldGFkYXRhICoqL1xuY29uc3QgSTE4Tl9NRUFOSU5HX1NFUEFSQVRPUiA9ICd8JztcbmNvbnN0IEkxOE5fSURfU0VQQVJBVE9SID0gJ0BAJztcblxuLyoqXG4gKiBQYXJzZXMgaTE4biBtZXRhcyBsaWtlOlxuICogIC0gXCJAQGlkXCIsXG4gKiAgLSBcImRlc2NyaXB0aW9uW0BAaWRdXCIsXG4gKiAgLSBcIm1lYW5pbmd8ZGVzY3JpcHRpb25bQEBpZF1cIlxuICogYW5kIHJldHVybnMgYW4gb2JqZWN0IHdpdGggcGFyc2VkIG91dHB1dC5cbiAqXG4gKiBAcGFyYW0gbWV0YSBTdHJpbmcgdGhhdCByZXByZXNlbnRzIGkxOG4gbWV0YVxuICogQHJldHVybnMgT2JqZWN0IHdpdGggaWQsIG1lYW5pbmcgYW5kIGRlc2NyaXB0aW9uIGZpZWxkc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VJMThuTWV0YShtZXRhPzogc3RyaW5nKTogSTE4bk1ldGEge1xuICBsZXQgaWQ6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgaWYgKG1ldGEpIHtcbiAgICBjb25zdCBpZEluZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fSURfU0VQQVJBVE9SKTtcbiAgICBjb25zdCBkZXNjSW5kZXggPSBtZXRhLmluZGV4T2YoSTE4Tl9NRUFOSU5HX1NFUEFSQVRPUik7XG4gICAgbGV0IG1lYW5pbmdBbmREZXNjOiBzdHJpbmc7XG4gICAgW21lYW5pbmdBbmREZXNjLCBpZF0gPVxuICAgICAgICAoaWRJbmRleCA+IC0xKSA/IFttZXRhLnNsaWNlKDAsIGlkSW5kZXgpLCBtZXRhLnNsaWNlKGlkSW5kZXggKyAyKV0gOiBbbWV0YSwgJyddO1xuICAgIFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPSAoZGVzY0luZGV4ID4gLTEpID9cbiAgICAgICAgW21lYW5pbmdBbmREZXNjLnNsaWNlKDAsIGRlc2NJbmRleCksIG1lYW5pbmdBbmREZXNjLnNsaWNlKGRlc2NJbmRleCArIDEpXSA6XG4gICAgICAgIFsnJywgbWVhbmluZ0FuZERlc2NdO1xuICB9XG5cbiAgcmV0dXJuIHtpZCwgbWVhbmluZywgZGVzY3JpcHRpb259O1xufVxuXG4vLyBDb252ZXJ0cyBpMThuIG1ldGEgaW5mb3JtYXRpb24gZm9yIGEgbWVzc2FnZSAoaWQsIGRlc2NyaXB0aW9uLCBtZWFuaW5nKVxuLy8gdG8gYSBKc0RvYyBzdGF0ZW1lbnQgZm9ybWF0dGVkIGFzIGV4cGVjdGVkIGJ5IHRoZSBDbG9zdXJlIGNvbXBpbGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGkxOG5NZXRhVG9Eb2NTdG10KG1ldGE6IEkxOG5NZXRhKTogby5KU0RvY0NvbW1lbnRTdG10fG51bGwge1xuICBjb25zdCB0YWdzOiBvLkpTRG9jVGFnW10gPSBbXTtcbiAgaWYgKG1ldGEuZGVzY3JpcHRpb24pIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLkRlc2MsIHRleHQ6IG1ldGEuZGVzY3JpcHRpb259KTtcbiAgfVxuICBpZiAobWV0YS5tZWFuaW5nKSB7XG4gICAgdGFncy5wdXNoKHt0YWdOYW1lOiBvLkpTRG9jVGFnTmFtZS5NZWFuaW5nLCB0ZXh0OiBtZXRhLm1lYW5pbmd9KTtcbiAgfVxuICByZXR1cm4gdGFncy5sZW5ndGggPT0gMCA/IG51bGwgOiBuZXcgby5KU0RvY0NvbW1lbnRTdG10KHRhZ3MpO1xufVxuIl19