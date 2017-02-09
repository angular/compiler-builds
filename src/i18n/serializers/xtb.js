/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import * as ml from '../../ml_parser/ast';
import { XmlParser } from '../../ml_parser/xml_parser';
import * as i18n from '../i18n_ast';
import { I18nError } from '../parse_util';
import { Serializer, SimplePlaceholderMapper } from './serializer';
import { digest, toPublicName } from './xmb';
var /** @type {?} */ _TRANSLATIONS_TAG = 'translationbundle';
var /** @type {?} */ _TRANSLATION_TAG = 'translation';
var /** @type {?} */ _PLACEHOLDER_TAG = 'ph';
var Xtb = (function (_super) {
    __extends(Xtb, _super);
    function Xtb() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * @param {?} messages
     * @return {?}
     */
    Xtb.prototype.write = function (messages) { throw new Error('Unsupported'); };
    /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    Xtb.prototype.load = function (content, url) {
        // xtb to xml nodes
        var /** @type {?} */ xtbParser = new XtbParser();
        var _a = xtbParser.parse(content, url), locale = _a.locale, msgIdToHtml = _a.msgIdToHtml, errors = _a.errors;
        // xml nodes to i18n nodes
        var /** @type {?} */ i18nNodesByMsgId = {};
        var /** @type {?} */ converter = new XmlToI18n();
        // Because we should be able to load xtb files that rely on features not supported by angular,
        // we need to delay the conversion of html to i18n nodes so that non angular messages are not
        // converted
        Object.keys(msgIdToHtml).forEach(function (msgId) {
            var /** @type {?} */ valueFn = function () {
                var _a = converter.convert(msgIdToHtml[msgId], url), i18nNodes = _a.i18nNodes, errors = _a.errors;
                if (errors.length) {
                    throw new Error("xtb parse errors:\n" + errors.join('\n'));
                }
                return i18nNodes;
            };
            createLazyProperty(i18nNodesByMsgId, msgId, valueFn);
        });
        if (errors.length) {
            throw new Error("xtb parse errors:\n" + errors.join('\n'));
        }
        return { locale: locale, i18nNodesByMsgId: i18nNodesByMsgId };
    };
    /**
     * @param {?} message
     * @return {?}
     */
    Xtb.prototype.digest = function (message) { return digest(message); };
    /**
     * @param {?} message
     * @return {?}
     */
    Xtb.prototype.createNameMapper = function (message) {
        return new SimplePlaceholderMapper(message, toPublicName);
    };
    return Xtb;
}(Serializer));
export { Xtb };
/**
 * @param {?} messages
 * @param {?} id
 * @param {?} valueFn
 * @return {?}
 */
function createLazyProperty(messages, id, valueFn) {
    Object.defineProperty(messages, id, {
        configurable: true,
        enumerable: true,
        get: function () {
            var /** @type {?} */ value = valueFn();
            Object.defineProperty(messages, id, { enumerable: true, value: value });
            return value;
        },
        set: function (_) { throw new Error('Could not overwrite an XTB translation'); },
    });
}
var XtbParser = (function () {
    function XtbParser() {
        this._locale = null;
    }
    /**
     * @param {?} xtb
     * @param {?} url
     * @return {?}
     */
    XtbParser.prototype.parse = function (xtb, url) {
        this._bundleDepth = 0;
        this._msgIdToHtml = {};
        // We can not parse the ICU messages at this point as some messages might not originate
        // from Angular that could not be lex'd.
        var /** @type {?} */ xml = new XmlParser().parse(xtb, url, false);
        this._errors = xml.errors;
        ml.visitAll(this, xml.rootNodes);
        return {
            msgIdToHtml: this._msgIdToHtml,
            errors: this._errors,
            locale: this._locale,
        };
    };
    /**
     * @param {?} element
     * @param {?} context
     * @return {?}
     */
    XtbParser.prototype.visitElement = function (element, context) {
        switch (element.name) {
            case _TRANSLATIONS_TAG:
                this._bundleDepth++;
                if (this._bundleDepth > 1) {
                    this._addError(element, "<" + _TRANSLATIONS_TAG + "> elements can not be nested");
                }
                var /** @type {?} */ langAttr = element.attrs.find(function (attr) { return attr.name === 'lang'; });
                if (langAttr) {
                    this._locale = langAttr.value;
                }
                ml.visitAll(this, element.children, null);
                this._bundleDepth--;
                break;
            case _TRANSLATION_TAG:
                var /** @type {?} */ idAttr = element.attrs.find(function (attr) { return attr.name === 'id'; });
                if (!idAttr) {
                    this._addError(element, "<" + _TRANSLATION_TAG + "> misses the \"id\" attribute");
                }
                else {
                    var /** @type {?} */ id = idAttr.value;
                    if (this._msgIdToHtml.hasOwnProperty(id)) {
                        this._addError(element, "Duplicated translations for msg " + id);
                    }
                    else {
                        var /** @type {?} */ innerTextStart = element.startSourceSpan.end.offset;
                        var /** @type {?} */ innerTextEnd = element.endSourceSpan.start.offset;
                        var /** @type {?} */ content = element.startSourceSpan.start.file.content;
                        var /** @type {?} */ innerText = content.slice(innerTextStart, innerTextEnd);
                        this._msgIdToHtml[id] = innerText;
                    }
                }
                break;
            default:
                this._addError(element, 'Unexpected tag');
        }
    };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    XtbParser.prototype.visitAttribute = function (attribute, context) { };
    /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    XtbParser.prototype.visitText = function (text, context) { };
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    XtbParser.prototype.visitComment = function (comment, context) { };
    /**
     * @param {?} expansion
     * @param {?} context
     * @return {?}
     */
    XtbParser.prototype.visitExpansion = function (expansion, context) { };
    /**
     * @param {?} expansionCase
     * @param {?} context
     * @return {?}
     */
    XtbParser.prototype.visitExpansionCase = function (expansionCase, context) { };
    /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    XtbParser.prototype._addError = function (node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    };
    return XtbParser;
}());
function XtbParser_tsickle_Closure_declarations() {
    /** @type {?} */
    XtbParser.prototype._bundleDepth;
    /** @type {?} */
    XtbParser.prototype._errors;
    /** @type {?} */
    XtbParser.prototype._msgIdToHtml;
    /** @type {?} */
    XtbParser.prototype._locale;
}
var XmlToI18n = (function () {
    function XmlToI18n() {
    }
    /**
     * @param {?} message
     * @param {?} url
     * @return {?}
     */
    XmlToI18n.prototype.convert = function (message, url) {
        var /** @type {?} */ xmlIcu = new XmlParser().parse(message, url, true);
        this._errors = xmlIcu.errors;
        var /** @type {?} */ i18nNodes = this._errors.length > 0 || xmlIcu.rootNodes.length == 0 ?
            [] :
            ml.visitAll(this, xmlIcu.rootNodes);
        return {
            i18nNodes: i18nNodes,
            errors: this._errors,
        };
    };
    /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitText = function (text, context) { return new i18n.Text(text.value, text.sourceSpan); };
    /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitExpansion = function (icu, context) {
        var /** @type {?} */ caseMap = {};
        ml.visitAll(this, icu.cases).forEach(function (c) {
            caseMap[c.value] = new i18n.Container(c.nodes, icu.sourceSpan);
        });
        return new i18n.Icu(icu.switchValue, icu.type, caseMap, icu.sourceSpan);
    };
    /**
     * @param {?} icuCase
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitExpansionCase = function (icuCase, context) {
        return {
            value: icuCase.value,
            nodes: ml.visitAll(this, icuCase.expression),
        };
    };
    /**
     * @param {?} el
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitElement = function (el, context) {
        if (el.name === _PLACEHOLDER_TAG) {
            var /** @type {?} */ nameAttr = el.attrs.find(function (attr) { return attr.name === 'name'; });
            if (nameAttr) {
                return new i18n.Placeholder('', nameAttr.value, el.sourceSpan);
            }
            this._addError(el, "<" + _PLACEHOLDER_TAG + "> misses the \"name\" attribute");
        }
        else {
            this._addError(el, "Unexpected tag");
        }
    };
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitComment = function (comment, context) { };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitAttribute = function (attribute, context) { };
    /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    XmlToI18n.prototype._addError = function (node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    };
    return XmlToI18n;
}());
function XmlToI18n_tsickle_Closure_declarations() {
    /** @type {?} */
    XmlToI18n.prototype._errors;
}
//# sourceMappingURL=xtb.js.map