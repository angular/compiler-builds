/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { computeDecimalDigest, computeDigest, decimalDigest } from '../../../i18n/digest';
import * as i18n from '../../../i18n/i18n_ast';
import { createI18nMessageFactory } from '../../../i18n/i18n_parser';
import * as html from '../../../ml_parser/ast';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../../ml_parser/interpolation_config';
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
    function I18nMetaVisitor(interpolationConfig, keepI18nAttrs, i18nLegacyMessageIdFormat) {
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        if (keepI18nAttrs === void 0) { keepI18nAttrs = false; }
        if (i18nLegacyMessageIdFormat === void 0) { i18nLegacyMessageIdFormat = ''; }
        this.interpolationConfig = interpolationConfig;
        this.keepI18nAttrs = keepI18nAttrs;
        this.i18nLegacyMessageIdFormat = i18nLegacyMessageIdFormat;
        // i18n message generation factory
        this._createI18nMessage = createI18nMessageFactory(this.interpolationConfig);
    }
    I18nMetaVisitor.prototype._generateI18nMessage = function (nodes, meta, visitNodeFn) {
        if (meta === void 0) { meta = ''; }
        var parsed = typeof meta === 'string' ? parseI18nMeta(meta) : metaFromI18nMessage(meta);
        var message = this._createI18nMessage(nodes, parsed.meaning || '', parsed.description || '', parsed.customId || '', visitNodeFn);
        if (!message.id) {
            // generate (or restore) message id if not specified in template
            message.id = typeof meta !== 'string' && meta.id || decimalDigest(message);
        }
        if (this.i18nLegacyMessageIdFormat === 'xlf' || this.i18nLegacyMessageIdFormat === 'xliff') {
            message.legacyId = computeDigest(message);
        }
        else if (this.i18nLegacyMessageIdFormat === 'xlf2' || this.i18nLegacyMessageIdFormat === 'xliff2' ||
            this.i18nLegacyMessageIdFormat === 'xmb') {
            message.legacyId = computeDecimalDigest(message);
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
        html.visitAll(this, element.children, element.i18n);
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
            // ICU is a top level message, try to use metadata from container element if provided via
            // `context` argument. Note: context may not be available for standalone ICUs (without
            // wrapping element), so fallback to ICU metadata in this case.
            message = this._generateI18nMessage([expansion], context || meta);
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
        _a = tslib_1.__read((idIndex > -1) ? [meta.slice(0, idIndex), meta.slice(idIndex + 2)] : [meta, ''], 2), meaningAndDesc = _a[0], customId = _a[1];
        _b = tslib_1.__read((descIndex > -1) ?
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3ZpZXcvaTE4bi9tZXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsb0JBQW9CLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3hGLE9BQU8sS0FBSyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDbkUsT0FBTyxLQUFLLElBQUksTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0seUNBQXlDLENBQUM7QUFDMUcsT0FBTyxLQUFLLENBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUVoRCxPQUFPLEVBQUMsU0FBUyxFQUFFLGdCQUFnQixFQUFFLFlBQVksRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQVVyRixTQUFTLFdBQVcsQ0FBQyxJQUFtQyxFQUFFLElBQWU7SUFDdkUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDbkIsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSDtJQUlFLHlCQUNZLG1CQUF1RSxFQUN2RSxhQUE4QixFQUFVLHlCQUFzQztRQUQ5RSxvQ0FBQSxFQUFBLGtEQUF1RTtRQUN2RSw4QkFBQSxFQUFBLHFCQUE4QjtRQUFVLDBDQUFBLEVBQUEsOEJBQXNDO1FBRDlFLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0Q7UUFDdkUsa0JBQWEsR0FBYixhQUFhLENBQWlCO1FBQVUsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFhO1FBTDFGLGtDQUFrQztRQUMxQix1QkFBa0IsR0FBRyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FB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Q0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQUMsR0FBVztJQUN0QyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y29tcHV0ZURlY2ltYWxEaWdlc3QsIGNvbXB1dGVEaWdlc3QsIGRlY2ltYWxEaWdlc3R9IGZyb20gJy4uLy4uLy4uL2kxOG4vZGlnZXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQge2NyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeX0gZnJvbSAnLi4vLi4vLi4vaTE4bi9pMThuX3BhcnNlcic7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5cbmltcG9ydCB7STE4Tl9BVFRSLCBJMThOX0FUVFJfUFJFRklYLCBoYXNJMThuQXR0cnMsIGljdUZyb21JMThuTWVzc2FnZX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IHR5cGUgSTE4bk1ldGEgPSB7XG4gIGlkPzogc3RyaW5nLFxuICBjdXN0b21JZD86IHN0cmluZyxcbiAgbGVnYWN5SWQ/OiBzdHJpbmcsXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nLFxuICBtZWFuaW5nPzogc3RyaW5nXG59O1xuXG5mdW5jdGlvbiBzZXRJMThuUmVmcyhodG1sOiBodG1sLk5vZGUgJiB7aTE4bj86IGkxOG4uQVNUfSwgaTE4bjogaTE4bi5Ob2RlKSB7XG4gIGh0bWwuaTE4biA9IGkxOG47XG59XG5cbi8qKlxuICogVGhpcyB2aXNpdG9yIHdhbGtzIG92ZXIgSFRNTCBwYXJzZSB0cmVlIGFuZCBjb252ZXJ0cyBpbmZvcm1hdGlvbiBzdG9yZWQgaW5cbiAqIGkxOG4tcmVsYXRlZCBhdHRyaWJ1dGVzIChcImkxOG5cIiBhbmQgXCJpMThuLSpcIikgaW50byBpMThuIG1ldGEgb2JqZWN0IHRoYXQgaXNcbiAqIHN0b3JlZCB3aXRoIG90aGVyIGVsZW1lbnQncyBhbmQgYXR0cmlidXRlJ3MgaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBJMThuTWV0YVZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICAvLyBpMThuIG1lc3NhZ2UgZ2VuZXJhdGlvbiBmYWN0b3J5XG4gIHByaXZhdGUgX2NyZWF0ZUkxOG5NZXNzYWdlID0gY3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5KHRoaXMuaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgICAgcHJpdmF0ZSBrZWVwSTE4bkF0dHJzOiBib29sZWFuID0gZmFsc2UsIHByaXZhdGUgaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdDogc3RyaW5nID0gJycpIHt9XG5cbiAgcHJpdmF0ZSBfZ2VuZXJhdGVJMThuTWVzc2FnZShcbiAgICAgIG5vZGVzOiBodG1sLk5vZGVbXSwgbWV0YTogc3RyaW5nfGkxOG4uQVNUID0gJycsXG4gICAgICB2aXNpdE5vZGVGbj86IChodG1sOiBodG1sLk5vZGUsIGkxOG46IGkxOG4uTm9kZSkgPT4gdm9pZCk6IGkxOG4uTWVzc2FnZSB7XG4gICAgY29uc3QgcGFyc2VkOiBJMThuTWV0YSA9XG4gICAgICAgIHR5cGVvZiBtZXRhID09PSAnc3RyaW5nJyA/IHBhcnNlSTE4bk1ldGEobWV0YSkgOiBtZXRhRnJvbUkxOG5NZXNzYWdlKG1ldGEgYXMgaTE4bi5NZXNzYWdlKTtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fY3JlYXRlSTE4bk1lc3NhZ2UoXG4gICAgICAgIG5vZGVzLCBwYXJzZWQubWVhbmluZyB8fCAnJywgcGFyc2VkLmRlc2NyaXB0aW9uIHx8ICcnLCBwYXJzZWQuY3VzdG9tSWQgfHwgJycsIHZpc2l0Tm9kZUZuKTtcbiAgICBpZiAoIW1lc3NhZ2UuaWQpIHtcbiAgICAgIC8vIGdlbmVyYXRlIChvciByZXN0b3JlKSBtZXNzYWdlIGlkIGlmIG5vdCBzcGVjaWZpZWQgaW4gdGVtcGxhdGVcbiAgICAgIG1lc3NhZ2UuaWQgPSB0eXBlb2YgbWV0YSAhPT0gJ3N0cmluZycgJiYgKG1ldGEgYXMgaTE4bi5NZXNzYWdlKS5pZCB8fCBkZWNpbWFsRGlnZXN0KG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bGYnIHx8IHRoaXMuaTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA9PT0gJ3hsaWZmJykge1xuICAgICAgbWVzc2FnZS5sZWdhY3lJZCA9IGNvbXB1dGVEaWdlc3QobWVzc2FnZSk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgdGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneGxmMicgfHwgdGhpcy5pMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID09PSAneGxpZmYyJyB8fFxuICAgICAgICB0aGlzLmkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPT09ICd4bWInKSB7XG4gICAgICBtZXNzYWdlLmxlZ2FjeUlkID0gY29tcHV0ZURlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWV0YSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFRoaXMgb2NjdXJzIGlmIHdlIGFyZSBkb2luZyB0aGUgMm5kIHBhc3MgYWZ0ZXIgd2hpdGVzcGFjZSByZW1vdmFsXG4gICAgICAvLyBJbiB0aGF0IGNhc2Ugd2Ugd2FudCB0byByZXVzZSB0aGUgbGVnYWN5IG1lc3NhZ2UgZ2VuZXJhdGVkIGluIHRoZSAxc3QgcGFzc1xuICAgICAgLy8gU2VlIGBwYXJzZVRlbXBsYXRlKClgIGluIGBwYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzYFxuICAgICAgbWVzc2FnZS5sZWdhY3lJZCA9IChtZXRhIGFzIGkxOG4uTWVzc2FnZSkubGVnYWN5SWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1lc3NhZ2U7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogaHRtbC5FbGVtZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGlmIChoYXNJMThuQXR0cnMoZWxlbWVudCkpIHtcbiAgICAgIGNvbnN0IGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdID0gW107XG4gICAgICBjb25zdCBhdHRyc01ldGE6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cbiAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJzKSB7XG4gICAgICAgIGlmIChhdHRyLm5hbWUgPT09IEkxOE5fQVRUUikge1xuICAgICAgICAgIC8vIHJvb3QgJ2kxOG4nIG5vZGUgYXR0cmlidXRlXG4gICAgICAgICAgY29uc3QgaTE4biA9IGVsZW1lbnQuaTE4biB8fCBhdHRyLnZhbHVlO1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9nZW5lcmF0ZUkxOG5NZXNzYWdlKGVsZW1lbnQuY2hpbGRyZW4sIGkxOG4sIHNldEkxOG5SZWZzKTtcbiAgICAgICAgICAvLyBkbyBub3QgYXNzaWduIGVtcHR5IGkxOG4gbWV0YVxuICAgICAgICAgIGlmIChtZXNzYWdlLm5vZGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgZWxlbWVudC5pMThuID0gbWVzc2FnZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmIChhdHRyLm5hbWUuc3RhcnRzV2l0aChJMThOX0FUVFJfUFJFRklYKSkge1xuICAgICAgICAgIC8vICdpMThuLSonIGF0dHJpYnV0ZXNcbiAgICAgICAgICBjb25zdCBrZXkgPSBhdHRyLm5hbWUuc2xpY2UoSTE4Tl9BVFRSX1BSRUZJWC5sZW5ndGgpO1xuICAgICAgICAgIGF0dHJzTWV0YVtrZXldID0gYXR0ci52YWx1ZTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vbi1pMThuIGF0dHJpYnV0ZXNcbiAgICAgICAgICBhdHRycy5wdXNoKGF0dHIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHNldCBpMThuIG1ldGEgZm9yIGF0dHJpYnV0ZXNcbiAgICAgIGlmIChPYmplY3Qua2V5cyhhdHRyc01ldGEpLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgYXR0cnMpIHtcbiAgICAgICAgICBjb25zdCBtZXRhID0gYXR0cnNNZXRhW2F0dHIubmFtZV07XG4gICAgICAgICAgLy8gZG8gbm90IGNyZWF0ZSB0cmFuc2xhdGlvbiBmb3IgZW1wdHkgYXR0cmlidXRlc1xuICAgICAgICAgIGlmIChtZXRhICE9PSB1bmRlZmluZWQgJiYgYXR0ci52YWx1ZSkge1xuICAgICAgICAgICAgYXR0ci5pMThuID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbYXR0cl0sIGF0dHIuaTE4biB8fCBtZXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmtlZXBJMThuQXR0cnMpIHtcbiAgICAgICAgLy8gdXBkYXRlIGVsZW1lbnQncyBhdHRyaWJ1dGVzLFxuICAgICAgICAvLyBrZWVwaW5nIG9ubHkgbm9uLWkxOG4gcmVsYXRlZCBvbmVzXG4gICAgICAgIGVsZW1lbnQuYXR0cnMgPSBhdHRycztcbiAgICAgIH1cbiAgICB9XG4gICAgaHRtbC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuLCBlbGVtZW50LmkxOG4pO1xuICAgIHJldHVybiBlbGVtZW50O1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBsZXQgbWVzc2FnZTtcbiAgICBjb25zdCBtZXRhID0gZXhwYW5zaW9uLmkxOG47XG4gICAgaWYgKG1ldGEgaW5zdGFuY2VvZiBpMThuLkljdVBsYWNlaG9sZGVyKSB7XG4gICAgICAvLyBzZXQgSUNVIHBsYWNlaG9sZGVyIG5hbWUgKGUuZy4gXCJJQ1VfMVwiKSxcbiAgICAgIC8vIGdlbmVyYXRlZCB3aGlsZSBwcm9jZXNzaW5nIHJvb3QgZWxlbWVudCBjb250ZW50cyxcbiAgICAgIC8vIHNvIHdlIGNhbiByZWZlcmVuY2UgaXQgd2hlbiB3ZSBvdXRwdXQgdHJhbnNsYXRpb25cbiAgICAgIGNvbnN0IG5hbWUgPSBtZXRhLm5hbWU7XG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgbWV0YSk7XG4gICAgICBjb25zdCBpY3UgPSBpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICBpY3UubmFtZSA9IG5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElDVSBpcyBhIHRvcCBsZXZlbCBtZXNzYWdlLCB0cnkgdG8gdXNlIG1ldGFkYXRhIGZyb20gY29udGFpbmVyIGVsZW1lbnQgaWYgcHJvdmlkZWQgdmlhXG4gICAgICAvLyBgY29udGV4dGAgYXJndW1lbnQuIE5vdGU6IGNvbnRleHQgbWF5IG5vdCBiZSBhdmFpbGFibGUgZm9yIHN0YW5kYWxvbmUgSUNVcyAod2l0aG91dFxuICAgICAgLy8gd3JhcHBpbmcgZWxlbWVudCksIHNvIGZhbGxiYWNrIHRvIElDVSBtZXRhZGF0YSBpbiB0aGlzIGNhc2UuXG4gICAgICBtZXNzYWdlID0gdGhpcy5fZ2VuZXJhdGVJMThuTWVzc2FnZShbZXhwYW5zaW9uXSwgY29udGV4dCB8fCBtZXRhKTtcbiAgICB9XG4gICAgZXhwYW5zaW9uLmkxOG4gPSBtZXNzYWdlO1xuICAgIHJldHVybiBleHBhbnNpb247XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gdGV4dDsgfVxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gYXR0cmlidXRlOyB9XG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBjb21tZW50OyB9XG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBleHBhbnNpb25DYXNlOyB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXRhRnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgaWQ6IHN0cmluZyB8IG51bGwgPSBudWxsKTogSTE4bk1ldGEge1xuICByZXR1cm4ge1xuICAgIGlkOiB0eXBlb2YgaWQgPT09ICdzdHJpbmcnID8gaWQgOiBtZXNzYWdlLmlkIHx8ICcnLFxuICAgIGN1c3RvbUlkOiBtZXNzYWdlLmN1c3RvbUlkLFxuICAgIGxlZ2FjeUlkOiBtZXNzYWdlLmxlZ2FjeUlkLFxuICAgIG1lYW5pbmc6IG1lc3NhZ2UubWVhbmluZyB8fCAnJyxcbiAgICBkZXNjcmlwdGlvbjogbWVzc2FnZS5kZXNjcmlwdGlvbiB8fCAnJ1xuICB9O1xufVxuXG4vKiogSTE4biBzZXBhcmF0b3JzIGZvciBtZXRhZGF0YSAqKi9cbmNvbnN0IEkxOE5fTUVBTklOR19TRVBBUkFUT1IgPSAnfCc7XG5jb25zdCBJMThOX0lEX1NFUEFSQVRPUiA9ICdAQCc7XG5cbi8qKlxuICogUGFyc2VzIGkxOG4gbWV0YXMgbGlrZTpcbiAqICAtIFwiQEBpZFwiLFxuICogIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuICogIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbiAqIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHBhcnNlZCBvdXRwdXQuXG4gKlxuICogQHBhcmFtIG1ldGEgU3RyaW5nIHRoYXQgcmVwcmVzZW50cyBpMThuIG1ldGFcbiAqIEByZXR1cm5zIE9iamVjdCB3aXRoIGlkLCBtZWFuaW5nIGFuZCBkZXNjcmlwdGlvbiBmaWVsZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEobWV0YT86IHN0cmluZyk6IEkxOG5NZXRhIHtcbiAgbGV0IGN1c3RvbUlkOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGlmIChtZXRhKSB7XG4gICAgY29uc3QgaWRJbmRleCA9IG1ldGEuaW5kZXhPZihJMThOX0lEX1NFUEFSQVRPUik7XG4gICAgY29uc3QgZGVzY0luZGV4ID0gbWV0YS5pbmRleE9mKEkxOE5fTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgY3VzdG9tSWRdID1cbiAgICAgICAgKGlkSW5kZXggPiAtMSkgPyBbbWV0YS5zbGljZSgwLCBpZEluZGV4KSwgbWV0YS5zbGljZShpZEluZGV4ICsgMildIDogW21ldGEsICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID0gKGRlc2NJbmRleCA+IC0xKSA/XG4gICAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgICBbJycsIG1lYW5pbmdBbmREZXNjXTtcbiAgfVxuXG4gIHJldHVybiB7Y3VzdG9tSWQsIG1lYW5pbmcsIGRlc2NyaXB0aW9ufTtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBtZXRhYCBhbmQgYG1lc3NhZ2VQYXJ0YCBhIHN0cmluZyB0aGF0IGNhbiBiZSB1c2VkIGluIGEgYCRsb2NhbGl6ZWBcbiAqIHRhZ2dlZCBzdHJpbmcuIFRoZSBmb3JtYXQgb2YgdGhlIG1ldGFkYXRhIGlzIHRoZSBzYW1lIGFzIHRoYXQgcGFyc2VkIGJ5IGBwYXJzZUkxOG5NZXRhKClgLlxuICpcbiAqIEBwYXJhbSBtZXRhIFRoZSBtZXRhZGF0YSB0byBzZXJpYWxpemVcbiAqIEBwYXJhbSBtZXNzYWdlUGFydCBUaGUgZmlyc3QgcGFydCBvZiB0aGUgdGFnZ2VkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSTE4bkhlYWQobWV0YTogSTE4bk1ldGEsIG1lc3NhZ2VQYXJ0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgbWV0YUJsb2NrID0gbWV0YS5kZXNjcmlwdGlvbiB8fCAnJztcbiAgaWYgKG1ldGEubWVhbmluZykge1xuICAgIG1ldGFCbG9jayA9IGAke21ldGEubWVhbmluZ318JHttZXRhQmxvY2t9YDtcbiAgfVxuICBpZiAobWV0YS5jdXN0b21JZCB8fCBtZXRhLmxlZ2FjeUlkKSB7XG4gICAgbWV0YUJsb2NrID0gYCR7bWV0YUJsb2NrfUBAJHttZXRhLmN1c3RvbUlkIHx8IG1ldGEubGVnYWN5SWR9YDtcbiAgfVxuICBpZiAobWV0YUJsb2NrID09PSAnJykge1xuICAgIC8vIFRoZXJlIGlzIG5vIG1ldGFCbG9jaywgc28gd2UgbXVzdCBlbnN1cmUgdGhhdCBhbnkgc3RhcnRpbmcgY29sb24gaXMgZXNjYXBlZC5cbiAgICByZXR1cm4gZXNjYXBlU3RhcnRpbmdDb2xvbihtZXNzYWdlUGFydCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGA6JHtlc2NhcGVDb2xvbnMobWV0YUJsb2NrKX06JHttZXNzYWdlUGFydH1gO1xuICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXplIHRoZSBnaXZlbiBgcGxhY2Vob2xkZXJOYW1lYCBhbmQgYG1lc3NhZ2VQYXJ0YCBpbnRvIHN0cmluZ3MgdGhhdCBjYW4gYmUgdXNlZCBpbiBhXG4gKiBgJGxvY2FsaXplYCB0YWdnZWQgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSBwbGFjZWhvbGRlck5hbWUgVGhlIHBsYWNlaG9sZGVyIG5hbWUgdG8gc2VyaWFsaXplXG4gKiBAcGFyYW0gbWVzc2FnZVBhcnQgVGhlIGZvbGxvd2luZyBtZXNzYWdlIHN0cmluZyBhZnRlciB0aGlzIHBsYWNlaG9sZGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KHBsYWNlaG9sZGVyTmFtZTogc3RyaW5nLCBtZXNzYWdlUGFydDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHBsYWNlaG9sZGVyTmFtZSA9PT0gJycpIHtcbiAgICAvLyBUaGVyZSBpcyBubyBwbGFjZWhvbGRlciBuYW1lIGJsb2NrLCBzbyB3ZSBtdXN0IGVuc3VyZSB0aGF0IGFueSBzdGFydGluZyBjb2xvbiBpcyBlc2NhcGVkLlxuICAgIHJldHVybiBlc2NhcGVTdGFydGluZ0NvbG9uKG1lc3NhZ2VQYXJ0KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYDoke3BsYWNlaG9sZGVyTmFtZX06JHttZXNzYWdlUGFydH1gO1xuICB9XG59XG5cbi8vIENvbnZlcnRzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiBmb3IgYSBtZXNzYWdlIChpZCwgZGVzY3JpcHRpb24sIG1lYW5pbmcpXG4vLyB0byBhIEpzRG9jIHN0YXRlbWVudCBmb3JtYXR0ZWQgYXMgZXhwZWN0ZWQgYnkgdGhlIENsb3N1cmUgY29tcGlsZXIuXG5leHBvcnQgZnVuY3Rpb24gaTE4bk1ldGFUb0RvY1N0bXQobWV0YTogSTE4bk1ldGEpOiBvLkpTRG9jQ29tbWVudFN0bXR8bnVsbCB7XG4gIGNvbnN0IHRhZ3M6IG8uSlNEb2NUYWdbXSA9IFtdO1xuICBpZiAobWV0YS5kZXNjcmlwdGlvbikge1xuICAgIHRhZ3MucHVzaCh7dGFnTmFtZTogby5KU0RvY1RhZ05hbWUuRGVzYywgdGV4dDogbWV0YS5kZXNjcmlwdGlvbn0pO1xuICB9XG4gIGlmIChtZXRhLm1lYW5pbmcpIHtcbiAgICB0YWdzLnB1c2goe3RhZ05hbWU6IG8uSlNEb2NUYWdOYW1lLk1lYW5pbmcsIHRleHQ6IG1ldGEubWVhbmluZ30pO1xuICB9XG4gIHJldHVybiB0YWdzLmxlbmd0aCA9PSAwID8gbnVsbCA6IG5ldyBvLkpTRG9jQ29tbWVudFN0bXQodGFncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVTdGFydGluZ0NvbG9uKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eOi8sICdcXFxcOicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlQ29sb25zKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC86L2csICdcXFxcOicpO1xufSJdfQ==