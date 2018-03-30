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
import * as ml from '../../ml_parser/ast';
import { XmlParser } from '../../ml_parser/xml_parser';
import { decimalDigest } from '../digest';
import * as i18n from '../i18n_ast';
import { I18nError } from '../parse_util';
import { Serializer } from './serializer';
import * as xml from './xml_helper';
const /** @type {?} */ _VERSION = '2.0';
const /** @type {?} */ _XMLNS = 'urn:oasis:names:tc:xliff:document:2.0';
// TODO(vicb): make this a param (s/_/-/)
const /** @type {?} */ _DEFAULT_SOURCE_LANG = 'en';
const /** @type {?} */ _PLACEHOLDER_TAG = 'ph';
const /** @type {?} */ _PLACEHOLDER_SPANNING_TAG = 'pc';
const /** @type {?} */ _MARKER_TAG = 'mrk';
const /** @type {?} */ _XLIFF_TAG = 'xliff';
const /** @type {?} */ _SOURCE_TAG = 'source';
const /** @type {?} */ _TARGET_TAG = 'target';
const /** @type {?} */ _UNIT_TAG = 'unit';
export class Xliff2 extends Serializer {
    /**
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    write(messages, locale) {
        const /** @type {?} */ visitor = new _WriteVisitor();
        const /** @type {?} */ units = [];
        messages.forEach(message => {
            const /** @type {?} */ unit = new xml.Tag(_UNIT_TAG, { id: message.id });
            const /** @type {?} */ notes = new xml.Tag('notes');
            if (message.description || message.meaning) {
                if (message.description) {
                    notes.children.push(new xml.CR(8), new xml.Tag('note', { category: 'description' }, [new xml.Text(message.description)]));
                }
                if (message.meaning) {
                    notes.children.push(new xml.CR(8), new xml.Tag('note', { category: 'meaning' }, [new xml.Text(message.meaning)]));
                }
            }
            message.sources.forEach((source) => {
                notes.children.push(new xml.CR(8), new xml.Tag('note', { category: 'location' }, [
                    new xml.Text(`${source.filePath}:${source.startLine}${source.endLine !== source.startLine ? ',' + source.endLine : ''}`)
                ]));
            });
            notes.children.push(new xml.CR(6));
            unit.children.push(new xml.CR(6), notes);
            const /** @type {?} */ segment = new xml.Tag('segment');
            segment.children.push(new xml.CR(8), new xml.Tag(_SOURCE_TAG, {}, visitor.serialize(message.nodes)), new xml.CR(6));
            unit.children.push(new xml.CR(6), segment, new xml.CR(4));
            units.push(new xml.CR(4), unit);
        });
        const /** @type {?} */ file = new xml.Tag('file', { 'original': 'ng.template', id: 'ngi18n' }, [...units, new xml.CR(2)]);
        const /** @type {?} */ xliff = new xml.Tag(_XLIFF_TAG, { version: _VERSION, xmlns: _XMLNS, srcLang: locale || _DEFAULT_SOURCE_LANG }, [new xml.CR(2), file, new xml.CR()]);
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
        const /** @type {?} */ xliff2Parser = new Xliff2Parser();
        const { locale, msgIdToHtml, errors } = xliff2Parser.parse(content, url);
        // xml nodes to i18n nodes
        const /** @type {?} */ i18nNodesByMsgId = {};
        const /** @type {?} */ converter = new XmlToI18n();
        Object.keys(msgIdToHtml).forEach(msgId => {
            const { i18nNodes, errors: e } = converter.convert(msgIdToHtml[msgId], url);
            errors.push(...e);
            i18nNodesByMsgId[msgId] = i18nNodes;
        });
        if (errors.length) {
            throw new Error(`xliff2 parse errors:\n${errors.join('\n')}`);
        }
        return { locale: /** @type {?} */ ((locale)), i18nNodesByMsgId };
    }
    /**
     * @param {?} message
     * @return {?}
     */
    digest(message) { return decimalDigest(message); }
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
        const /** @type {?} */ nodes = [new xml.Text(`{${icu.expressionPlaceholder}, ${icu.type}, `)];
        Object.keys(icu.cases).forEach((c) => {
            nodes.push(new xml.Text(`${c} {`), ...icu.cases[c].visit(this), new xml.Text(`} `));
        });
        nodes.push(new xml.Text(`}`));
        return nodes;
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitTagPlaceholder(ph, context) {
        const /** @type {?} */ type = getTypeForTag(ph.tag);
        if (ph.isVoid) {
            const /** @type {?} */ tagPh = new xml.Tag(_PLACEHOLDER_TAG, {
                id: (this._nextPlaceholderId++).toString(),
                equiv: ph.startName,
                type: type,
                disp: `<${ph.tag}/>`,
            });
            return [tagPh];
        }
        const /** @type {?} */ tagPc = new xml.Tag(_PLACEHOLDER_SPANNING_TAG, {
            id: (this._nextPlaceholderId++).toString(),
            equivStart: ph.startName,
            equivEnd: ph.closeName,
            type: type,
            dispStart: `<${ph.tag}>`,
            dispEnd: `</${ph.tag}>`,
        });
        const /** @type {?} */ nodes = [].concat(...ph.children.map(node => node.visit(this)));
        if (nodes.length) {
            nodes.forEach((node) => tagPc.children.push(node));
        }
        else {
            tagPc.children.push(new xml.Text(''));
        }
        return [tagPc];
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitPlaceholder(ph, context) {
        const /** @type {?} */ idStr = (this._nextPlaceholderId++).toString();
        return [new xml.Tag(_PLACEHOLDER_TAG, {
                id: idStr,
                equiv: ph.name,
                disp: `{{${ph.value}}}`,
            })];
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitIcuPlaceholder(ph, context) {
        const /** @type {?} */ cases = Object.keys(ph.value.cases).map((value) => value + ' {...}').join(' ');
        const /** @type {?} */ idStr = (this._nextPlaceholderId++).toString();
        return [new xml.Tag(_PLACEHOLDER_TAG, { id: idStr, equiv: ph.name, disp: `{${ph.value.expression}, ${ph.value.type}, ${cases}}` })];
    }
    /**
     * @param {?} nodes
     * @return {?}
     */
    serialize(nodes) {
        this._nextPlaceholderId = 0;
        return [].concat(...nodes.map(node => node.visit(this)));
    }
}
function _WriteVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _WriteVisitor.prototype._nextPlaceholderId;
}
class Xliff2Parser {
    constructor() {
        this._locale = null;
    }
    /**
     * @param {?} xliff
     * @param {?} url
     * @return {?}
     */
    parse(xliff, url) {
        this._unitMlString = null;
        this._msgIdToHtml = {};
        const /** @type {?} */ xml = new XmlParser().parse(xliff, url, false);
        this._errors = xml.errors;
        ml.visitAll(this, xml.rootNodes, null);
        return {
            msgIdToHtml: this._msgIdToHtml,
            errors: this._errors,
            locale: this._locale,
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
                this._unitMlString = null;
                const /** @type {?} */ idAttr = element.attrs.find((attr) => attr.name === 'id');
                if (!idAttr) {
                    this._addError(element, `<${_UNIT_TAG}> misses the "id" attribute`);
                }
                else {
                    const /** @type {?} */ id = idAttr.value;
                    if (this._msgIdToHtml.hasOwnProperty(id)) {
                        this._addError(element, `Duplicated translations for msg ${id}`);
                    }
                    else {
                        ml.visitAll(this, element.children, null);
                        if (typeof this._unitMlString === 'string') {
                            this._msgIdToHtml[id] = this._unitMlString;
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
                const /** @type {?} */ innerTextStart = /** @type {?} */ ((element.startSourceSpan)).end.offset;
                const /** @type {?} */ innerTextEnd = /** @type {?} */ ((element.endSourceSpan)).start.offset;
                const /** @type {?} */ content = /** @type {?} */ ((element.startSourceSpan)).start.file.content;
                const /** @type {?} */ innerText = content.slice(innerTextStart, innerTextEnd);
                this._unitMlString = innerText;
                break;
            case _XLIFF_TAG:
                const /** @type {?} */ localeAttr = element.attrs.find((attr) => attr.name === 'trgLang');
                if (localeAttr) {
                    this._locale = localeAttr.value;
                }
                const /** @type {?} */ versionAttr = element.attrs.find((attr) => attr.name === 'version');
                if (versionAttr) {
                    const /** @type {?} */ version = versionAttr.value;
                    if (version !== '2.0') {
                        this._addError(element, `The XLIFF file version ${version} is not compatible with XLIFF 2.0 serializer`);
                    }
                    else {
                        ml.visitAll(this, element.children, null);
                    }
                }
                break;
            default:
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
class XmlToI18n {
    /**
     * @param {?} message
     * @param {?} url
     * @return {?}
     */
    convert(message, url) {
        const /** @type {?} */ xmlIcu = new XmlParser().parse(message, url, true);
        this._errors = xmlIcu.errors;
        const /** @type {?} */ i18nNodes = this._errors.length > 0 || xmlIcu.rootNodes.length == 0 ?
            [] :
            [].concat(...ml.visitAll(this, xmlIcu.rootNodes));
        return {
            i18nNodes,
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
        switch (el.name) {
            case _PLACEHOLDER_TAG:
                const /** @type {?} */ nameAttr = el.attrs.find((attr) => attr.name === 'equiv');
                if (nameAttr) {
                    return [new i18n.Placeholder('', nameAttr.value, el.sourceSpan)];
                }
                this._addError(el, `<${_PLACEHOLDER_TAG}> misses the "equiv" attribute`);
                break;
            case _PLACEHOLDER_SPANNING_TAG:
                const /** @type {?} */ startAttr = el.attrs.find((attr) => attr.name === 'equivStart');
                const /** @type {?} */ endAttr = el.attrs.find((attr) => attr.name === 'equivEnd');
                if (!startAttr) {
                    this._addError(el, `<${_PLACEHOLDER_TAG}> misses the "equivStart" attribute`);
                }
                else if (!endAttr) {
                    this._addError(el, `<${_PLACEHOLDER_TAG}> misses the "equivEnd" attribute`);
                }
                else {
                    const /** @type {?} */ startId = startAttr.value;
                    const /** @type {?} */ endId = endAttr.value;
                    const /** @type {?} */ nodes = [];
                    return nodes.concat(new i18n.Placeholder('', startId, el.sourceSpan), ...el.children.map(node => node.visit(this, null)), new i18n.Placeholder('', endId, el.sourceSpan));
                }
                break;
            case _MARKER_TAG:
                return [].concat(...ml.visitAll(this, el.children));
            default:
                this._addError(el, `Unexpected tag`);
        }
        return null;
    }
    /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    visitExpansion(icu, context) {
        const /** @type {?} */ caseMap = {};
        ml.visitAll(this, icu.cases).forEach((c) => {
            caseMap[c.value] = new i18n.Container(c.nodes, icu.sourceSpan);
        });
        return new i18n.Icu(icu.switchValue, icu.type, caseMap, icu.sourceSpan);
    }
    /**
     * @param {?} icuCase
     * @param {?} context
     * @return {?}
     */
    visitExpansionCase(icuCase, context) {
        return {
            value: icuCase.value,
            nodes: [].concat(...ml.visitAll(this, icuCase.expression)),
        };
    }
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