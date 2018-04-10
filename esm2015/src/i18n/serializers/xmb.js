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
import { decimalDigest } from '../digest';
import { Serializer, SimplePlaceholderMapper } from './serializer';
import * as xml from './xml_helper';
const /** @type {?} */ _MESSAGES_TAG = 'messagebundle';
const /** @type {?} */ _MESSAGE_TAG = 'msg';
const /** @type {?} */ _PLACEHOLDER_TAG = 'ph';
const /** @type {?} */ _EXEMPLE_TAG = 'ex';
const /** @type {?} */ _SOURCE_TAG = 'source';
const /** @type {?} */ _DOCTYPE = `<!ELEMENT messagebundle (msg)*>
<!ATTLIST messagebundle class CDATA #IMPLIED>

<!ELEMENT msg (#PCDATA|ph|source)*>
<!ATTLIST msg id CDATA #IMPLIED>
<!ATTLIST msg seq CDATA #IMPLIED>
<!ATTLIST msg name CDATA #IMPLIED>
<!ATTLIST msg desc CDATA #IMPLIED>
<!ATTLIST msg meaning CDATA #IMPLIED>
<!ATTLIST msg obsolete (obsolete) #IMPLIED>
<!ATTLIST msg xml:space (default|preserve) "default">
<!ATTLIST msg is_hidden CDATA #IMPLIED>

<!ELEMENT source (#PCDATA)>

<!ELEMENT ph (#PCDATA|ex)*>
<!ATTLIST ph name CDATA #REQUIRED>

<!ELEMENT ex (#PCDATA)>`;
export class Xmb extends Serializer {
    /**
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    write(messages, locale) {
        const /** @type {?} */ exampleVisitor = new ExampleVisitor();
        const /** @type {?} */ visitor = new _Visitor();
        let /** @type {?} */ rootNode = new xml.Tag(_MESSAGES_TAG);
        messages.forEach(message => {
            const /** @type {?} */ attrs = { id: message.id };
            if (message.description) {
                attrs['desc'] = message.description;
            }
            if (message.meaning) {
                attrs['meaning'] = message.meaning;
            }
            let /** @type {?} */ sourceTags = [];
            message.sources.forEach((source) => {
                sourceTags.push(new xml.Tag(_SOURCE_TAG, {}, [
                    new xml.Text(`${source.filePath}:${source.startLine}${source.endLine !== source.startLine ? ',' + source.endLine : ''}`)
                ]));
            });
            rootNode.children.push(new xml.CR(2), new xml.Tag(_MESSAGE_TAG, attrs, [...sourceTags, ...visitor.serialize(message.nodes)]));
        });
        rootNode.children.push(new xml.CR());
        return xml.serialize([
            new xml.Declaration({ version: '1.0', encoding: 'UTF-8' }),
            new xml.CR(),
            new xml.Doctype(_MESSAGES_TAG, _DOCTYPE),
            new xml.CR(),
            exampleVisitor.addDefaultExamples(rootNode),
            new xml.CR(),
        ]);
    }
    /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    load(content, url) {
        throw new Error('Unsupported');
    }
    /**
     * @param {?} message
     * @return {?}
     */
    digest(message) { return digest(message); }
    /**
     * @param {?} message
     * @return {?}
     */
    createNameMapper(message) {
        return new SimplePlaceholderMapper(message, toPublicName);
    }
}
class _Visitor {
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    visitText(text, context) { return [new xml.Text(text.value)]; }
    /**
     * @param {?} container
     * @param {?} context
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
        const /** @type {?} */ startEx = new xml.Tag(_EXEMPLE_TAG, {}, [new xml.Text(`<${ph.tag}>`)]);
        const /** @type {?} */ startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.startName }, [startEx]);
        if (ph.isVoid) {
            // void tags have no children nor closing tags
            return [startTagPh];
        }
        const /** @type {?} */ closeEx = new xml.Tag(_EXEMPLE_TAG, {}, [new xml.Text(`</${ph.tag}>`)]);
        const /** @type {?} */ closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.closeName }, [closeEx]);
        return [startTagPh, ...this.serialize(ph.children), closeTagPh];
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitPlaceholder(ph, context) {
        const /** @type {?} */ exTag = new xml.Tag(_EXEMPLE_TAG, {}, [new xml.Text(`{{${ph.value}}}`)]);
        return [new xml.Tag(_PLACEHOLDER_TAG, { name: ph.name }, [exTag])];
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitIcuPlaceholder(ph, context) {
        const /** @type {?} */ exTag = new xml.Tag(_EXEMPLE_TAG, {}, [
            new xml.Text(`{${ph.value.expression}, ${ph.value.type}, ${Object.keys(ph.value.cases).map((value) => value + ' {...}').join(' ')}}`)
        ]);
        return [new xml.Tag(_PLACEHOLDER_TAG, { name: ph.name }, [exTag])];
    }
    /**
     * @param {?} nodes
     * @return {?}
     */
    serialize(nodes) {
        return [].concat(...nodes.map(node => node.visit(this)));
    }
}
/**
 * @param {?} message
 * @return {?}
 */
export function digest(message) {
    return decimalDigest(message);
}
class ExampleVisitor {
    /**
     * @param {?} node
     * @return {?}
     */
    addDefaultExamples(node) {
        node.visit(this);
        return node;
    }
    /**
     * @param {?} tag
     * @return {?}
     */
    visitTag(tag) {
        if (tag.name === _PLACEHOLDER_TAG) {
            if (!tag.children || tag.children.length == 0) {
                const /** @type {?} */ exText = new xml.Text(tag.attrs['name'] || '...');
                tag.children = [new xml.Tag(_EXEMPLE_TAG, {}, [exText])];
            }
        }
        else if (tag.children) {
            tag.children.forEach(node => node.visit(this));
        }
    }
    /**
     * @param {?} text
     * @return {?}
     */
    visitText(text) { }
    /**
     * @param {?} decl
     * @return {?}
     */
    visitDeclaration(decl) { }
    /**
     * @param {?} doctype
     * @return {?}
     */
    visitDoctype(doctype) { }
}
/**
 * @param {?} internalName
 * @return {?}
 */
export function toPublicName(internalName) {
    return internalName.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}
//# sourceMappingURL=xmb.js.map