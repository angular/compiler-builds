/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import * as ml from '../../ml_parser/ast';
import { XmlParser } from '../../ml_parser/xml_parser';
import { decimalDigest } from '../digest';
import * as i18n from '../i18n_ast';
import { I18nError } from '../parse_util';
import { Serializer } from './serializer';
import * as xml from './xml_helper';
var /** @type {?} */ _VERSION = '2.0';
var /** @type {?} */ _XMLNS = 'urn:oasis:names:tc:xliff:document:2.0';
// TODO(vicb): make this a param (s/_/-/)
var /** @type {?} */ _DEFAULT_SOURCE_LANG = 'en';
var /** @type {?} */ _PLACEHOLDER_TAG = 'ph';
var /** @type {?} */ _PLACEHOLDER_SPANNING_TAG = 'pc';
var /** @type {?} */ _MARKER_TAG = 'mrk';
var /** @type {?} */ _XLIFF_TAG = 'xliff';
var /** @type {?} */ _SOURCE_TAG = 'source';
var /** @type {?} */ _TARGET_TAG = 'target';
var /** @type {?} */ _UNIT_TAG = 'unit';
var Xliff2 = /** @class */ (function (_super) {
    tslib_1.__extends(Xliff2, _super);
    function Xliff2() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    Xliff2.prototype.write = /**
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    function (messages, locale) {
        var /** @type {?} */ visitor = new _WriteVisitor();
        var /** @type {?} */ units = [];
        messages.forEach(function (message) {
            var /** @type {?} */ unit = new xml.Tag(_UNIT_TAG, { id: message.id });
            var /** @type {?} */ notes = new xml.Tag('notes');
            if (message.description || message.meaning) {
                if (message.description) {
                    notes.children.push(new xml.CR(8), new xml.Tag('note', { category: 'description' }, [new xml.Text(message.description)]));
                }
                if (message.meaning) {
                    notes.children.push(new xml.CR(8), new xml.Tag('note', { category: 'meaning' }, [new xml.Text(message.meaning)]));
                }
            }
            message.sources.forEach(function (source) {
                notes.children.push(new xml.CR(8), new xml.Tag('note', { category: 'location' }, [
                    new xml.Text(source.filePath + ":" + source.startLine + (source.endLine !== source.startLine ? ',' + source.endLine : ''))
                ]));
            });
            notes.children.push(new xml.CR(6));
            unit.children.push(new xml.CR(6), notes);
            var /** @type {?} */ segment = new xml.Tag('segment');
            segment.children.push(new xml.CR(8), new xml.Tag(_SOURCE_TAG, {}, visitor.serialize(message.nodes)), new xml.CR(6));
            unit.children.push(new xml.CR(6), segment, new xml.CR(4));
            units.push(new xml.CR(4), unit);
        });
        var /** @type {?} */ file = new xml.Tag('file', { 'original': 'ng.template', id: 'ngi18n' }, units.concat([new xml.CR(2)]));
        var /** @type {?} */ xliff = new xml.Tag(_XLIFF_TAG, { version: _VERSION, xmlns: _XMLNS, srcLang: locale || _DEFAULT_SOURCE_LANG }, [new xml.CR(2), file, new xml.CR()]);
        return xml.serialize([
            new xml.Declaration({ version: '1.0', encoding: 'UTF-8' }), new xml.CR(), xliff, new xml.CR()
        ]);
    };
    /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    Xliff2.prototype.load = /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    function (content, url) {
        // xliff to xml nodes
        var /** @type {?} */ xliff2Parser = new Xliff2Parser();
        var _a = xliff2Parser.parse(content, url), locale = _a.locale, msgIdToHtml = _a.msgIdToHtml, errors = _a.errors;
        // xml nodes to i18n nodes
        var /** @type {?} */ i18nNodesByMsgId = {};
        var /** @type {?} */ converter = new XmlToI18n();
        Object.keys(msgIdToHtml).forEach(function (msgId) {
            var _a = converter.convert(msgIdToHtml[msgId], url), i18nNodes = _a.i18nNodes, e = _a.errors;
            errors.push.apply(errors, e);
            i18nNodesByMsgId[msgId] = i18nNodes;
        });
        if (errors.length) {
            throw new Error("xliff2 parse errors:\n" + errors.join('\n'));
        }
        return { locale: /** @type {?} */ ((locale)), i18nNodesByMsgId: i18nNodesByMsgId };
    };
    /**
     * @param {?} message
     * @return {?}
     */
    Xliff2.prototype.digest = /**
     * @param {?} message
     * @return {?}
     */
    function (message) { return decimalDigest(message); };
    return Xliff2;
}(Serializer));
export { Xliff2 };
var _WriteVisitor = /** @class */ (function () {
    function _WriteVisitor() {
    }
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    _WriteVisitor.prototype.visitText = /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    function (text, context) { return [new xml.Text(text.value)]; };
    /**
     * @param {?} container
     * @param {?=} context
     * @return {?}
     */
    _WriteVisitor.prototype.visitContainer = /**
     * @param {?} container
     * @param {?=} context
     * @return {?}
     */
    function (container, context) {
        var _this = this;
        var /** @type {?} */ nodes = [];
        container.children.forEach(function (node) { return nodes.push.apply(nodes, node.visit(_this)); });
        return nodes;
    };
    /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    _WriteVisitor.prototype.visitIcu = /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    function (icu, context) {
        var _this = this;
        var /** @type {?} */ nodes = [new xml.Text("{" + icu.expressionPlaceholder + ", " + icu.type + ", ")];
        Object.keys(icu.cases).forEach(function (c) {
            nodes.push.apply(nodes, [new xml.Text(c + " {")].concat(icu.cases[c].visit(_this), [new xml.Text("} ")]));
        });
        nodes.push(new xml.Text("}"));
        return nodes;
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    _WriteVisitor.prototype.visitTagPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) {
        var _this = this;
        var /** @type {?} */ type = getTypeForTag(ph.tag);
        if (ph.isVoid) {
            var /** @type {?} */ tagPh = new xml.Tag(_PLACEHOLDER_TAG, {
                id: (this._nextPlaceholderId++).toString(),
                equiv: ph.startName,
                type: type,
                disp: "<" + ph.tag + "/>",
            });
            return [tagPh];
        }
        var /** @type {?} */ tagPc = new xml.Tag(_PLACEHOLDER_SPANNING_TAG, {
            id: (this._nextPlaceholderId++).toString(),
            equivStart: ph.startName,
            equivEnd: ph.closeName,
            type: type,
            dispStart: "<" + ph.tag + ">",
            dispEnd: "</" + ph.tag + ">",
        });
        var /** @type {?} */ nodes = [].concat.apply([], ph.children.map(function (node) { return node.visit(_this); }));
        if (nodes.length) {
            nodes.forEach(function (node) { return tagPc.children.push(node); });
        }
        else {
            tagPc.children.push(new xml.Text(''));
        }
        return [tagPc];
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    _WriteVisitor.prototype.visitPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) {
        var /** @type {?} */ idStr = (this._nextPlaceholderId++).toString();
        return [new xml.Tag(_PLACEHOLDER_TAG, {
                id: idStr,
                equiv: ph.name,
                disp: "{{" + ph.value + "}}",
            })];
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    _WriteVisitor.prototype.visitIcuPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) {
        var /** @type {?} */ cases = Object.keys(ph.value.cases).map(function (value) { return value + ' {...}'; }).join(' ');
        var /** @type {?} */ idStr = (this._nextPlaceholderId++).toString();
        return [new xml.Tag(_PLACEHOLDER_TAG, { id: idStr, equiv: ph.name, disp: "{" + ph.value.expression + ", " + ph.value.type + ", " + cases + "}" })];
    };
    /**
     * @param {?} nodes
     * @return {?}
     */
    _WriteVisitor.prototype.serialize = /**
     * @param {?} nodes
     * @return {?}
     */
    function (nodes) {
        var _this = this;
        this._nextPlaceholderId = 0;
        return [].concat.apply([], nodes.map(function (node) { return node.visit(_this); }));
    };
    return _WriteVisitor;
}());
function _WriteVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _WriteVisitor.prototype._nextPlaceholderId;
}
var Xliff2Parser = /** @class */ (function () {
    function Xliff2Parser() {
        this._locale = null;
    }
    /**
     * @param {?} xliff
     * @param {?} url
     * @return {?}
     */
    Xliff2Parser.prototype.parse = /**
     * @param {?} xliff
     * @param {?} url
     * @return {?}
     */
    function (xliff, url) {
        this._unitMlString = null;
        this._msgIdToHtml = {};
        var /** @type {?} */ xml = new XmlParser().parse(xliff, url, false);
        this._errors = xml.errors;
        ml.visitAll(this, xml.rootNodes, null);
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
    Xliff2Parser.prototype.visitElement = /**
     * @param {?} element
     * @param {?} context
     * @return {?}
     */
    function (element, context) {
        switch (element.name) {
            case _UNIT_TAG:
                this._unitMlString = null;
                var /** @type {?} */ idAttr = element.attrs.find(function (attr) { return attr.name === 'id'; });
                if (!idAttr) {
                    this._addError(element, "<" + _UNIT_TAG + "> misses the \"id\" attribute");
                }
                else {
                    var /** @type {?} */ id = idAttr.value;
                    if (this._msgIdToHtml.hasOwnProperty(id)) {
                        this._addError(element, "Duplicated translations for msg " + id);
                    }
                    else {
                        ml.visitAll(this, element.children, null);
                        if (typeof this._unitMlString === 'string') {
                            this._msgIdToHtml[id] = this._unitMlString;
                        }
                        else {
                            this._addError(element, "Message " + id + " misses a translation");
                        }
                    }
                }
                break;
            case _SOURCE_TAG:
                // ignore source message
                break;
            case _TARGET_TAG:
                var /** @type {?} */ innerTextStart = /** @type {?} */ ((element.startSourceSpan)).end.offset;
                var /** @type {?} */ innerTextEnd = /** @type {?} */ ((element.endSourceSpan)).start.offset;
                var /** @type {?} */ content = /** @type {?} */ ((element.startSourceSpan)).start.file.content;
                var /** @type {?} */ innerText = content.slice(innerTextStart, innerTextEnd);
                this._unitMlString = innerText;
                break;
            case _XLIFF_TAG:
                var /** @type {?} */ localeAttr = element.attrs.find(function (attr) { return attr.name === 'trgLang'; });
                if (localeAttr) {
                    this._locale = localeAttr.value;
                }
                var /** @type {?} */ versionAttr = element.attrs.find(function (attr) { return attr.name === 'version'; });
                if (versionAttr) {
                    var /** @type {?} */ version = versionAttr.value;
                    if (version !== '2.0') {
                        this._addError(element, "The XLIFF file version " + version + " is not compatible with XLIFF 2.0 serializer");
                    }
                    else {
                        ml.visitAll(this, element.children, null);
                    }
                }
                break;
            default:
                ml.visitAll(this, element.children, null);
        }
    };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    Xliff2Parser.prototype.visitAttribute = /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    function (attribute, context) { };
    /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    Xliff2Parser.prototype.visitText = /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    function (text, context) { };
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    Xliff2Parser.prototype.visitComment = /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    function (comment, context) { };
    /**
     * @param {?} expansion
     * @param {?} context
     * @return {?}
     */
    Xliff2Parser.prototype.visitExpansion = /**
     * @param {?} expansion
     * @param {?} context
     * @return {?}
     */
    function (expansion, context) { };
    /**
     * @param {?} expansionCase
     * @param {?} context
     * @return {?}
     */
    Xliff2Parser.prototype.visitExpansionCase = /**
     * @param {?} expansionCase
     * @param {?} context
     * @return {?}
     */
    function (expansionCase, context) { };
    /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    Xliff2Parser.prototype._addError = /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    function (node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    };
    return Xliff2Parser;
}());
function Xliff2Parser_tsickle_Closure_declarations() {
    /** @type {?} */
    Xliff2Parser.prototype._unitMlString;
    /** @type {?} */
    Xliff2Parser.prototype._errors;
    /** @type {?} */
    Xliff2Parser.prototype._msgIdToHtml;
    /** @type {?} */
    Xliff2Parser.prototype._locale;
}
var XmlToI18n = /** @class */ (function () {
    function XmlToI18n() {
    }
    /**
     * @param {?} message
     * @param {?} url
     * @return {?}
     */
    XmlToI18n.prototype.convert = /**
     * @param {?} message
     * @param {?} url
     * @return {?}
     */
    function (message, url) {
        var /** @type {?} */ xmlIcu = new XmlParser().parse(message, url, true);
        this._errors = xmlIcu.errors;
        var /** @type {?} */ i18nNodes = this._errors.length > 0 || xmlIcu.rootNodes.length == 0 ?
            [] : [].concat.apply([], ml.visitAll(this, xmlIcu.rootNodes));
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
    XmlToI18n.prototype.visitText = /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    function (text, context) { return new i18n.Text(text.value, text.sourceSpan); };
    /**
     * @param {?} el
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitElement = /**
     * @param {?} el
     * @param {?} context
     * @return {?}
     */
    function (el, context) {
        var _this = this;
        switch (el.name) {
            case _PLACEHOLDER_TAG:
                var /** @type {?} */ nameAttr = el.attrs.find(function (attr) { return attr.name === 'equiv'; });
                if (nameAttr) {
                    return [new i18n.Placeholder('', nameAttr.value, el.sourceSpan)];
                }
                this._addError(el, "<" + _PLACEHOLDER_TAG + "> misses the \"equiv\" attribute");
                break;
            case _PLACEHOLDER_SPANNING_TAG:
                var /** @type {?} */ startAttr = el.attrs.find(function (attr) { return attr.name === 'equivStart'; });
                var /** @type {?} */ endAttr = el.attrs.find(function (attr) { return attr.name === 'equivEnd'; });
                if (!startAttr) {
                    this._addError(el, "<" + _PLACEHOLDER_TAG + "> misses the \"equivStart\" attribute");
                }
                else if (!endAttr) {
                    this._addError(el, "<" + _PLACEHOLDER_TAG + "> misses the \"equivEnd\" attribute");
                }
                else {
                    var /** @type {?} */ startId = startAttr.value;
                    var /** @type {?} */ endId = endAttr.value;
                    var /** @type {?} */ nodes = [];
                    return nodes.concat.apply(nodes, [new i18n.Placeholder('', startId, el.sourceSpan)].concat(el.children.map(function (node) { return node.visit(_this, null); }), [new i18n.Placeholder('', endId, el.sourceSpan)]));
                }
                break;
            case _MARKER_TAG:
                return [].concat.apply([], ml.visitAll(this, el.children));
            default:
                this._addError(el, "Unexpected tag");
        }
        return null;
    };
    /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitExpansion = /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    function (icu, context) {
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
    XmlToI18n.prototype.visitExpansionCase = /**
     * @param {?} icuCase
     * @param {?} context
     * @return {?}
     */
    function (icuCase, context) {
        return {
            value: icuCase.value,
            nodes: [].concat.apply([], ml.visitAll(this, icuCase.expression)),
        };
    };
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitComment = /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    function (comment, context) { };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    XmlToI18n.prototype.visitAttribute = /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    function (attribute, context) { };
    /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    XmlToI18n.prototype._addError = /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    function (node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    };
    return XmlToI18n;
}());
function XmlToI18n_tsickle_Closure_declarations() {
    /** @type {?} */
    XmlToI18n.prototype._errors;
}
/**
 * @param {?} tag
 * @return {?}
 */
function getTypeForTag(tag) {
    switch (tag.toLowerCase()) {
        case 'br':
        case 'b':
        case 'i':
        case 'u':
            return 'fmt';
        case 'img':
            return 'image';
        case 'a':
            return 'link';
        default:
            return 'other';
    }
}
//# sourceMappingURL=xliff2.js.map