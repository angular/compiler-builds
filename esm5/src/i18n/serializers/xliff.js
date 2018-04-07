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
import { digest } from '../digest';
import * as i18n from '../i18n_ast';
import { I18nError } from '../parse_util';
import { Serializer } from './serializer';
import * as xml from './xml_helper';
var /** @type {?} */ _VERSION = '1.2';
var /** @type {?} */ _XMLNS = 'urn:oasis:names:tc:xliff:document:1.2';
// TODO(vicb): make this a param (s/_/-/)
var /** @type {?} */ _DEFAULT_SOURCE_LANG = 'en';
var /** @type {?} */ _PLACEHOLDER_TAG = 'x';
var /** @type {?} */ _MARKER_TAG = 'mrk';
var /** @type {?} */ _FILE_TAG = 'file';
var /** @type {?} */ _SOURCE_TAG = 'source';
var /** @type {?} */ _SEGMENT_SOURCE_TAG = 'seg-source';
var /** @type {?} */ _TARGET_TAG = 'target';
var /** @type {?} */ _UNIT_TAG = 'trans-unit';
var /** @type {?} */ _CONTEXT_GROUP_TAG = 'context-group';
var /** @type {?} */ _CONTEXT_TAG = 'context';
var Xliff = /** @class */ (function (_super) {
    tslib_1.__extends(Xliff, _super);
    function Xliff() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    Xliff.prototype.write = /**
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    function (messages, locale) {
        var /** @type {?} */ visitor = new _WriteVisitor();
        var /** @type {?} */ transUnits = [];
        messages.forEach(function (message) {
            var /** @type {?} */ contextTags = [];
            message.sources.forEach(function (source) {
                var /** @type {?} */ contextGroupTag = new xml.Tag(_CONTEXT_GROUP_TAG, { purpose: 'location' });
                contextGroupTag.children.push(new xml.CR(10), new xml.Tag(_CONTEXT_TAG, { 'context-type': 'sourcefile' }, [new xml.Text(source.filePath)]), new xml.CR(10), new xml.Tag(_CONTEXT_TAG, { 'context-type': 'linenumber' }, [new xml.Text("" + source.startLine)]), new xml.CR(8));
                contextTags.push(new xml.CR(8), contextGroupTag);
            });
            var /** @type {?} */ transUnit = new xml.Tag(_UNIT_TAG, { id: message.id, datatype: 'html' });
            (_a = transUnit.children).push.apply(_a, [new xml.CR(8), new xml.Tag(_SOURCE_TAG, {}, visitor.serialize(message.nodes))].concat(contextTags));
            if (message.description) {
                transUnit.children.push(new xml.CR(8), new xml.Tag('note', { priority: '1', from: 'description' }, [new xml.Text(message.description)]));
            }
            if (message.meaning) {
                transUnit.children.push(new xml.CR(8), new xml.Tag('note', { priority: '1', from: 'meaning' }, [new xml.Text(message.meaning)]));
            }
            transUnit.children.push(new xml.CR(6));
            transUnits.push(new xml.CR(6), transUnit);
            var _a;
        });
        var /** @type {?} */ body = new xml.Tag('body', {}, transUnits.concat([new xml.CR(4)]));
        var /** @type {?} */ file = new xml.Tag('file', {
            'source-language': locale || _DEFAULT_SOURCE_LANG,
            datatype: 'plaintext',
            original: 'ng2.template',
        }, [new xml.CR(4), body, new xml.CR(2)]);
        var /** @type {?} */ xliff = new xml.Tag('xliff', { version: _VERSION, xmlns: _XMLNS }, [new xml.CR(2), file, new xml.CR()]);
        return xml.serialize([
            new xml.Declaration({ version: '1.0', encoding: 'UTF-8' }), new xml.CR(), xliff, new xml.CR()
        ]);
    };
    /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    Xliff.prototype.load = /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    function (content, url) {
        // xliff to xml nodes
        var /** @type {?} */ xliffParser = new XliffParser();
        var _a = xliffParser.parse(content, url), locale = _a.locale, msgIdToHtml = _a.msgIdToHtml, errors = _a.errors;
        // xml nodes to i18n nodes
        var /** @type {?} */ i18nNodesByMsgId = {};
        var /** @type {?} */ converter = new XmlToI18n();
        Object.keys(msgIdToHtml).forEach(function (msgId) {
            var _a = converter.convert(msgIdToHtml[msgId], url), i18nNodes = _a.i18nNodes, e = _a.errors;
            errors.push.apply(errors, e);
            i18nNodesByMsgId[msgId] = i18nNodes;
        });
        if (errors.length) {
            throw new Error("xliff parse errors:\n" + errors.join('\n'));
        }
        return { locale: /** @type {?} */ ((locale)), i18nNodesByMsgId: i18nNodesByMsgId };
    };
    /**
     * @param {?} message
     * @return {?}
     */
    Xliff.prototype.digest = /**
     * @param {?} message
     * @return {?}
     */
    function (message) { return digest(message); };
    return Xliff;
}(Serializer));
export { Xliff };
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
        var /** @type {?} */ ctype = getCtypeForTag(ph.tag);
        if (ph.isVoid) {
            // void tags have no children nor closing tags
            return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.startName, ctype: ctype, 'equiv-text': "<" + ph.tag + "/>" })];
        }
        var /** @type {?} */ startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { id: ph.startName, ctype: ctype, 'equiv-text': "<" + ph.tag + ">" });
        var /** @type {?} */ closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { id: ph.closeName, ctype: ctype, 'equiv-text': "</" + ph.tag + ">" });
        return [startTagPh].concat(this.serialize(ph.children), [closeTagPh]);
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
        return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.name, 'equiv-text': "{{" + ph.value + "}}" })];
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
        var /** @type {?} */ equivText = "{" + ph.value.expression + ", " + ph.value.type + ", " + Object.keys(ph.value.cases).map(function (value) { return value + ' {...}'; }).join(' ') + "}";
        return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.name, 'equiv-text': equivText })];
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
        return [].concat.apply([], nodes.map(function (node) { return node.visit(_this); }));
    };
    return _WriteVisitor;
}());
var XliffParser = /** @class */ (function () {
    function XliffParser() {
        this._locale = null;
    }
    /**
     * @param {?} xliff
     * @param {?} url
     * @return {?}
     */
    XliffParser.prototype.parse = /**
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
    XliffParser.prototype.visitElement = /**
     * @param {?} element
     * @param {?} context
     * @return {?}
     */
    function (element, context) {
        switch (element.name) {
            case _UNIT_TAG:
                this._unitMlString = /** @type {?} */ ((null));
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
            // ignore those tags
            case _SOURCE_TAG:
            case _SEGMENT_SOURCE_TAG:
                break;
            case _TARGET_TAG:
                var /** @type {?} */ innerTextStart = /** @type {?} */ ((element.startSourceSpan)).end.offset;
                var /** @type {?} */ innerTextEnd = /** @type {?} */ ((element.endSourceSpan)).start.offset;
                var /** @type {?} */ content = /** @type {?} */ ((element.startSourceSpan)).start.file.content;
                var /** @type {?} */ innerText = content.slice(innerTextStart, innerTextEnd);
                this._unitMlString = innerText;
                break;
            case _FILE_TAG:
                var /** @type {?} */ localeAttr = element.attrs.find(function (attr) { return attr.name === 'target-language'; });
                if (localeAttr) {
                    this._locale = localeAttr.value;
                }
                ml.visitAll(this, element.children, null);
                break;
            default:
                // TODO(vicb): assert file structure, xliff version
                // For now only recurse on unhandled nodes
                ml.visitAll(this, element.children, null);
        }
    };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    XliffParser.prototype.visitAttribute = /**
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
    XliffParser.prototype.visitText = /**
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
    XliffParser.prototype.visitComment = /**
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
    XliffParser.prototype.visitExpansion = /**
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
    XliffParser.prototype.visitExpansionCase = /**
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
    XliffParser.prototype._addError = /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    function (node, message) {
        this._errors.push(new I18nError(/** @type {?} */ ((node.sourceSpan)), message));
    };
    return XliffParser;
}());
function XliffParser_tsickle_Closure_declarations() {
    /** @type {?} */
    XliffParser.prototype._unitMlString;
    /** @type {?} */
    XliffParser.prototype._errors;
    /** @type {?} */
    XliffParser.prototype._msgIdToHtml;
    /** @type {?} */
    XliffParser.prototype._locale;
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
    function (text, context) { return new i18n.Text(text.value, /** @type {?} */ ((text.sourceSpan))); };
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
        if (el.name === _PLACEHOLDER_TAG) {
            var /** @type {?} */ nameAttr = el.attrs.find(function (attr) { return attr.name === 'id'; });
            if (nameAttr) {
                return new i18n.Placeholder('', nameAttr.value, /** @type {?} */ ((el.sourceSpan)));
            }
            this._addError(el, "<" + _PLACEHOLDER_TAG + "> misses the \"id\" attribute");
            return null;
        }
        if (el.name === _MARKER_TAG) {
            return [].concat.apply([], ml.visitAll(this, el.children));
        }
        this._addError(el, "Unexpected tag");
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
            nodes: ml.visitAll(this, icuCase.expression),
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
        this._errors.push(new I18nError(/** @type {?} */ ((node.sourceSpan)), message));
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
function getCtypeForTag(tag) {
    switch (tag.toLowerCase()) {
        case 'br':
            return 'lb';
        case 'img':
            return 'image';
        default:
            return "x-" + tag;
    }
}
//# sourceMappingURL=xliff.js.map