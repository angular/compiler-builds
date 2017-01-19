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
const /** @type {?} */ _VERSION = '1.2';
const /** @type {?} */ _XMLNS = 'urn:oasis:names:tc:xliff:document:1.2';
// TODO(vicb): make this a param (s/_/-/)
const /** @type {?} */ _SOURCE_LANG = 'en';
const /** @type {?} */ _PLACEHOLDER_TAG = 'x';
const /** @type {?} */ _SOURCE_TAG = 'source';
const /** @type {?} */ _TARGET_TAG = 'target';
const /** @type {?} */ _UNIT_TAG = 'trans-unit';
export class Xliff {
    /**
     * @param {?} messages
     * @return {?}
     */
    write(messages) {
        const /** @type {?} */ visitor = new _WriteVisitor();
        const /** @type {?} */ visited = {};
        const /** @type {?} */ transUnits = [];
        messages.forEach(message => {
            const /** @type {?} */ id = this.digest(message);
            // deduplicate messages
            if (visited[id])
                return;
            visited[id] = true;
            const /** @type {?} */ transUnit = new xml.Tag(_UNIT_TAG, { id, datatype: 'html' });
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
        const /** @type {?} */ body = new xml.Tag('body', {}, [...transUnits, new xml.CR(4)]);
        const /** @type {?} */ file = new xml.Tag('file', { 'source-language': _SOURCE_LANG, datatype: 'plaintext', original: 'ng2.template' }, [new xml.CR(4), body, new xml.CR(2)]);
        const /** @type {?} */ xliff = new xml.Tag('xliff', { version: _VERSION, xmlns: _XMLNS }, [new xml.CR(2), file, new xml.CR()]);
        return xml.serialize([
            new xml.Declaration({ version: '1.0', encoding: 'UTF-8' }), new xml.CR(), xliff, new xml.CR()
        ]);
    }
    /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    load(content, url) {
        // xliff to xml nodes
        const /** @type {?} */ xliffParser = new XliffParser();
        const { mlNodesByMsgId, errors } = xliffParser.parse(content, url);
        // xml nodes to i18n nodes
        const /** @type {?} */ i18nNodesByMsgId = {};
        const /** @type {?} */ converter = new XmlToI18n();
        Object.keys(mlNodesByMsgId).forEach(msgId => {
            const { i18nNodes, errors: e } = converter.convert(mlNodesByMsgId[msgId]);
            errors.push(...e);
            i18nNodesByMsgId[msgId] = i18nNodes;
        });
        if (errors.length) {
            throw new Error(`xliff parse errors:\n${errors.join('\n')}`);
        }
        return i18nNodesByMsgId;
    }
    /**
     * @param {?} message
     * @return {?}
     */
    digest(message) { return digest(message); }
}
class _WriteVisitor {
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    visitText(text, context) { return [new xml.Text(text.value)]; }
    /**
     * @param {?} container
     * @param {?=} context
     * @return {?}
     */
    visitContainer(container, context) {
        const /** @type {?} */ nodes = [];
        container.children.forEach((node) => nodes.push(...node.visit(this)));
        return nodes;
    }
    /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    visitIcu(icu, context) {
        if (this._isInIcu) {
            // nested ICU is not supported
            throw new Error('xliff does not support nested ICU messages');
        }
        this._isInIcu = true;
        // TODO(vicb): support ICU messages
        // https://lists.oasis-open.org/archives/xliff/201201/msg00028.html
        // http://docs.oasis-open.org/xliff/v1.2/xliff-profile-po/xliff-profile-po-1.2-cd02.html
        const /** @type {?} */ nodes = [];
        this._isInIcu = false;
        return nodes;
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitTagPlaceholder(ph, context) {
        const /** @type {?} */ ctype = getCtypeForTag(ph.tag);
        const /** @type {?} */ startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { id: ph.startName, ctype });
        if (ph.isVoid) {
            // void tags have no children nor closing tags
            return [startTagPh];
        }
        const /** @type {?} */ closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { id: ph.closeName, ctype });
        return [startTagPh, ...this.serialize(ph.children), closeTagPh];
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitPlaceholder(ph, context) {
        return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.name })];
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitIcuPlaceholder(ph, context) {
        return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.name })];
    }
    /**
     * @param {?} nodes
     * @return {?}
     */
    serialize(nodes) {
        this._isInIcu = false;
        return [].concat(...nodes.map(node => node.visit(this)));
    }
}
function _WriteVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _WriteVisitor.prototype._isInIcu;
}
class XliffParser {
    /**
     * @param {?} xliff
     * @param {?} url
     * @return {?}
     */
    parse(xliff, url) {
        this._unitMlNodes = [];
        this._mlNodesByMsgId = {};
        const /** @type {?} */ xml = new XmlParser().parse(xliff, url, false);
        this._errors = xml.errors;
        ml.visitAll(this, xml.rootNodes, null);
        return {
            mlNodesByMsgId: this._mlNodesByMsgId,
            errors: this._errors,
        };
    }
    /**
     * @param {?} element
     * @param {?} context
     * @return {?}
     */
    visitElement(element, context) {
        switch (element.name) {
            case _UNIT_TAG:
                this._unitMlNodes = null;
                const /** @type {?} */ idAttr = element.attrs.find((attr) => attr.name === 'id');
                if (!idAttr) {
                    this._addError(element, `<${_UNIT_TAG}> misses the "id" attribute`);
                }
                else {
                    const /** @type {?} */ id = idAttr.value;
                    if (this._mlNodesByMsgId.hasOwnProperty(id)) {
                        this._addError(element, `Duplicated translations for msg ${id}`);
                    }
                    else {
                        ml.visitAll(this, element.children, null);
                        if (this._unitMlNodes) {
                            this._mlNodesByMsgId[id] = this._unitMlNodes;
                        }
                        else {
                            this._addError(element, `Message ${id} misses a translation`);
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
    }
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    visitAttribute(attribute, context) { }
    /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    visitText(text, context) { }
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    visitComment(comment, context) { }
    /**
     * @param {?} expansion
     * @param {?} context
     * @return {?}
     */
    visitExpansion(expansion, context) { }
    /**
     * @param {?} expansionCase
     * @param {?} context
     * @return {?}
     */
    visitExpansionCase(expansionCase, context) { }
    /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    _addError(node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    }
}
function XliffParser_tsickle_Closure_declarations() {
    /** @type {?} */
    XliffParser.prototype._unitMlNodes;
    /** @type {?} */
    XliffParser.prototype._errors;
    /** @type {?} */
    XliffParser.prototype._mlNodesByMsgId;
}
class XmlToI18n {
    /**
     * @param {?} nodes
     * @return {?}
     */
    convert(nodes) {
        this._errors = [];
        return {
            i18nNodes: ml.visitAll(this, nodes),
            errors: this._errors,
        };
    }
    /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    visitText(text, context) { return new i18n.Text(text.value, text.sourceSpan); }
    /**
     * @param {?} el
     * @param {?} context
     * @return {?}
     */
    visitElement(el, context) {
        if (el.name === _PLACEHOLDER_TAG) {
            const /** @type {?} */ nameAttr = el.attrs.find((attr) => attr.name === 'id');
            if (nameAttr) {
                return new i18n.Placeholder('', nameAttr.value, el.sourceSpan);
            }
            this._addError(el, `<${_PLACEHOLDER_TAG}> misses the "id" attribute`);
        }
        else {
            this._addError(el, `Unexpected tag`);
        }
    }
    /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    visitExpansion(icu, context) { }
    /**
     * @param {?} icuCase
     * @param {?} context
     * @return {?}
     */
    visitExpansionCase(icuCase, context) { }
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    visitComment(comment, context) { }
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    visitAttribute(attribute, context) { }
    /**
     * @param {?} node
     * @param {?} message
     * @return {?}
     */
    _addError(node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    }
}
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
            return `x-${tag}`;
    }
}
//# sourceMappingURL=xliff.js.map