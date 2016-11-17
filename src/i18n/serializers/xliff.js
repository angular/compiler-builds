/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ml from '../../ml_parser/ast';
import { XmlParser } from '../../ml_parser/xml_parser';
import { digest } from '../digest';
import * as i18n from '../i18n_ast';
import { I18nError } from '../parse_util';
import * as xml from './xml_helper';
var _VERSION = '1.2';
var _XMLNS = 'urn:oasis:names:tc:xliff:document:1.2';
// TODO(vicb): make this a param (s/_/-/)
var _SOURCE_LANG = 'en';
var _PLACEHOLDER_TAG = 'x';
var _SOURCE_TAG = 'source';
var _TARGET_TAG = 'target';
var _UNIT_TAG = 'trans-unit';
// http://docs.oasis-open.org/xliff/v1.2/os/xliff-core.html
// http://docs.oasis-open.org/xliff/v1.2/xliff-profile-html/xliff-profile-html-1.2.html
export var Xliff = (function () {
    function Xliff() {
    }
    Xliff.prototype.write = function (messages) {
        var _this = this;
        var visitor = new _WriteVisitor();
        var visited = {};
        var transUnits = [];
        messages.forEach(function (message) {
            var id = _this.digest(message);
            // deduplicate messages
            if (visited[id])
                return;
            visited[id] = true;
            var transUnit = new xml.Tag(_UNIT_TAG, { id: id, datatype: 'html' });
            transUnit.children.push(new xml.CR(8), new xml.Tag(_SOURCE_TAG, {}, visitor.serialize(message.nodes)), new xml.CR(8), new xml.Tag(_TARGET_TAG));
            if (message.description) {
                transUnit.children.push(new xml.CR(8), new xml.Tag('note', { priority: '1', from: 'description' }, [new xml.Text(message.description)]));
            }
            if (message.meaning) {
                transUnit.children.push(new xml.CR(8), new xml.Tag('note', { priority: '1', from: 'meaning' }, [new xml.Text(message.meaning)]));
            }
            transUnit.children.push(new xml.CR(6));
            transUnits.push(new xml.CR(6), transUnit);
        });
        var body = new xml.Tag('body', {}, transUnits.concat([new xml.CR(4)]));
        var file = new xml.Tag('file', { 'source-language': _SOURCE_LANG, datatype: 'plaintext', original: 'ng2.template' }, [new xml.CR(4), body, new xml.CR(2)]);
        var xliff = new xml.Tag('xliff', { version: _VERSION, xmlns: _XMLNS }, [new xml.CR(2), file, new xml.CR()]);
        return xml.serialize([
            new xml.Declaration({ version: '1.0', encoding: 'UTF-8' }), new xml.CR(), xliff, new xml.CR()
        ]);
    };
    Xliff.prototype.load = function (content, url) {
        // xliff to xml nodes
        var xliffParser = new XliffParser();
        var _a = xliffParser.parse(content, url), mlNodesByMsgId = _a.mlNodesByMsgId, errors = _a.errors;
        // xml nodes to i18n nodes
        var i18nNodesByMsgId = {};
        var converter = new XmlToI18n();
        Object.keys(mlNodesByMsgId).forEach(function (msgId) {
            var _a = converter.convert(mlNodesByMsgId[msgId]), i18nNodes = _a.i18nNodes, e = _a.errors;
            errors.push.apply(errors, e);
            i18nNodesByMsgId[msgId] = i18nNodes;
        });
        if (errors.length) {
            throw new Error("xliff parse errors:\n" + errors.join('\n'));
        }
        return i18nNodesByMsgId;
    };
    Xliff.prototype.digest = function (message) { return digest(message); };
    return Xliff;
}());
var _WriteVisitor = (function () {
    function _WriteVisitor() {
    }
    _WriteVisitor.prototype.visitText = function (text, context) { return [new xml.Text(text.value)]; };
    _WriteVisitor.prototype.visitContainer = function (container, context) {
        var _this = this;
        var nodes = [];
        container.children.forEach(function (node) { return nodes.push.apply(nodes, node.visit(_this)); });
        return nodes;
    };
    _WriteVisitor.prototype.visitIcu = function (icu, context) {
        if (this._isInIcu) {
            // nested ICU is not supported
            throw new Error('xliff does not support nested ICU messages');
        }
        this._isInIcu = true;
        // TODO(vicb): support ICU messages
        // https://lists.oasis-open.org/archives/xliff/201201/msg00028.html
        // http://docs.oasis-open.org/xliff/v1.2/xliff-profile-po/xliff-profile-po-1.2-cd02.html
        var nodes = [];
        this._isInIcu = false;
        return nodes;
    };
    _WriteVisitor.prototype.visitTagPlaceholder = function (ph, context) {
        var ctype = getCtypeForTag(ph.tag);
        var startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { id: ph.startName, ctype: ctype });
        if (ph.isVoid) {
            // void tags have no children nor closing tags
            return [startTagPh];
        }
        var closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { id: ph.closeName, ctype: ctype });
        return [startTagPh].concat(this.serialize(ph.children), [closeTagPh]);
    };
    _WriteVisitor.prototype.visitPlaceholder = function (ph, context) {
        return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.name })];
    };
    _WriteVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
        return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.name })];
    };
    _WriteVisitor.prototype.serialize = function (nodes) {
        var _this = this;
        this._isInIcu = false;
        return (_a = []).concat.apply(_a, nodes.map(function (node) { return node.visit(_this); }));
        var _a;
    };
    return _WriteVisitor;
}());
// TODO(vicb): add error management (structure)
// Extract messages as xml nodes from the xliff file
var XliffParser = (function () {
    function XliffParser() {
    }
    XliffParser.prototype.parse = function (xliff, url) {
        this._unitMlNodes = [];
        this._mlNodesByMsgId = {};
        var xml = new XmlParser().parse(xliff, url, false);
        this._errors = xml.errors;
        ml.visitAll(this, xml.rootNodes, null);
        return {
            mlNodesByMsgId: this._mlNodesByMsgId,
            errors: this._errors,
        };
    };
    XliffParser.prototype.visitElement = function (element, context) {
        switch (element.name) {
            case _UNIT_TAG:
                this._unitMlNodes = null;
                var idAttr = element.attrs.find(function (attr) { return attr.name === 'id'; });
                if (!idAttr) {
                    this._addError(element, "<" + _UNIT_TAG + "> misses the \"id\" attribute");
                }
                else {
                    var id = idAttr.value;
                    if (this._mlNodesByMsgId.hasOwnProperty(id)) {
                        this._addError(element, "Duplicated translations for msg " + id);
                    }
                    else {
                        ml.visitAll(this, element.children, null);
                        if (this._unitMlNodes) {
                            this._mlNodesByMsgId[id] = this._unitMlNodes;
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
                this._unitMlNodes = element.children;
                break;
            default:
                // TODO(vicb): assert file structure, xliff version
                // For now only recurse on unhandled nodes
                ml.visitAll(this, element.children, null);
        }
    };
    XliffParser.prototype.visitAttribute = function (attribute, context) { };
    XliffParser.prototype.visitText = function (text, context) { };
    XliffParser.prototype.visitComment = function (comment, context) { };
    XliffParser.prototype.visitExpansion = function (expansion, context) { };
    XliffParser.prototype.visitExpansionCase = function (expansionCase, context) { };
    XliffParser.prototype._addError = function (node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    };
    return XliffParser;
}());
// Convert ml nodes (xliff syntax) to i18n nodes
var XmlToI18n = (function () {
    function XmlToI18n() {
    }
    XmlToI18n.prototype.convert = function (nodes) {
        this._errors = [];
        return {
            i18nNodes: ml.visitAll(this, nodes),
            errors: this._errors,
        };
    };
    XmlToI18n.prototype.visitText = function (text, context) { return new i18n.Text(text.value, text.sourceSpan); };
    XmlToI18n.prototype.visitElement = function (el, context) {
        if (el.name === _PLACEHOLDER_TAG) {
            var nameAttr = el.attrs.find(function (attr) { return attr.name === 'id'; });
            if (nameAttr) {
                return new i18n.Placeholder('', nameAttr.value, el.sourceSpan);
            }
            this._addError(el, "<" + _PLACEHOLDER_TAG + "> misses the \"id\" attribute");
        }
        else {
            this._addError(el, "Unexpected tag");
        }
    };
    XmlToI18n.prototype.visitExpansion = function (icu, context) { };
    XmlToI18n.prototype.visitExpansionCase = function (icuCase, context) { };
    XmlToI18n.prototype.visitComment = function (comment, context) { };
    XmlToI18n.prototype.visitAttribute = function (attribute, context) { };
    XmlToI18n.prototype._addError = function (node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    };
    return XmlToI18n;
}());
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