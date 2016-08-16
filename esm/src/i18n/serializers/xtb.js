/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ml from '../../ml_parser/ast';
import { XmlParser } from '../../ml_parser/xml_parser';
import { I18nError } from '../parse_util';
import { extractPlaceholderToIds, extractPlaceholders } from './serializer';
const _TRANSLATIONS_TAG = 'translationbundle';
const _TRANSLATION_TAG = 'translation';
const _PLACEHOLDER_TAG = 'ph';
export class Xtb {
    constructor(_htmlParser, _interpolationConfig) {
        this._htmlParser = _htmlParser;
        this._interpolationConfig = _interpolationConfig;
    }
    write(messageMap) { throw new Error('Unsupported'); }
    load(content, url, messageBundle) {
        // Parse the xtb file into xml nodes
        const result = new XmlParser().parse(content, url);
        if (result.errors.length) {
            throw new Error(`xtb parse errors:\n${result.errors.join('\n')}`);
        }
        // Replace the placeholders, messages are now string
        const { messages, errors } = new _Visitor().parse(result.rootNodes, messageBundle);
        if (errors.length) {
            throw new Error(`xtb parse errors:\n${errors.join('\n')}`);
        }
        // Convert the string messages to html ast
        // TODO(vicb): map error message back to the original message in xtb
        let messageMap = {};
        const parseErrors = [];
        Object.keys(messages).forEach((id) => {
            const res = this._htmlParser.parse(messages[id], url, true, this._interpolationConfig);
            parseErrors.push(...res.errors);
            messageMap[id] = res.rootNodes;
        });
        if (parseErrors.length) {
            throw new Error(`xtb parse errors:\n${parseErrors.join('\n')}`);
        }
        return messageMap;
    }
}
class _Visitor {
    parse(nodes, messageBundle) {
        this._messageNodes = [];
        this._translatedMessages = {};
        this._bundleDepth = 0;
        this._translationDepth = 0;
        this._errors = [];
        // Find all messages
        ml.visitAll(this, nodes, null);
        const messageMap = messageBundle.getMessageMap();
        const placeholders = extractPlaceholders(messageBundle);
        const placeholderToIds = extractPlaceholderToIds(messageBundle);
        this._messageNodes
            .filter(message => {
            // Remove any messages that is not present in the source message bundle.
            return messageMap.hasOwnProperty(message[0]);
        })
            .sort((a, b) => {
            // Because there could be no ICU placeholders inside an ICU message,
            // we do not need to take into account the `placeholderToMsgIds` of the referenced
            // messages, those would always be empty
            // TODO(vicb): overkill - create 2 buckets and [...woDeps, ...wDeps].process()
            if (Object.keys(messageMap[a[0]].placeholderToMsgIds).length == 0) {
                return -1;
            }
            if (Object.keys(messageMap[b[0]].placeholderToMsgIds).length == 0) {
                return 1;
            }
            return 0;
        })
            .forEach(message => {
            const id = message[0];
            this._placeholders = placeholders[id] || {};
            this._placeholderToIds = placeholderToIds[id] || {};
            // TODO(vicb): make sure there is no `_TRANSLATIONS_TAG` nor `_TRANSLATION_TAG`
            this._translatedMessages[id] = ml.visitAll(this, message[1]).join('');
        });
        return { messages: this._translatedMessages, errors: this._errors };
    }
    visitElement(element, context) {
        switch (element.name) {
            case _TRANSLATIONS_TAG:
                this._bundleDepth++;
                if (this._bundleDepth > 1) {
                    this._addError(element, `<${_TRANSLATIONS_TAG}> elements can not be nested`);
                }
                ml.visitAll(this, element.children, null);
                this._bundleDepth--;
                break;
            case _TRANSLATION_TAG:
                this._translationDepth++;
                if (this._translationDepth > 1) {
                    this._addError(element, `<${_TRANSLATION_TAG}> elements can not be nested`);
                }
                const idAttr = element.attrs.find((attr) => attr.name === 'id');
                if (!idAttr) {
                    this._addError(element, `<${_TRANSLATION_TAG}> misses the "id" attribute`);
                }
                else {
                    // ICU placeholders are reference to other messages.
                    // The referenced message might not have been decoded yet.
                    // We need to have all messages available to make sure deps are decoded first.
                    // TODO(vicb): report an error on duplicate id
                    this._messageNodes.push([idAttr.value, element.children]);
                }
                this._translationDepth--;
                break;
            case _PLACEHOLDER_TAG:
                const nameAttr = element.attrs.find((attr) => attr.name === 'name');
                if (!nameAttr) {
                    this._addError(element, `<${_PLACEHOLDER_TAG}> misses the "name" attribute`);
                }
                else {
                    const name = nameAttr.value;
                    if (this._placeholders.hasOwnProperty(name)) {
                        return this._placeholders[name];
                    }
                    if (this._placeholderToIds.hasOwnProperty(name) &&
                        this._translatedMessages.hasOwnProperty(this._placeholderToIds[name])) {
                        return this._translatedMessages[this._placeholderToIds[name]];
                    }
                    // TODO(vicb): better error message for when
                    // !this._translatedMessages.hasOwnProperty(this._placeholderToIds[name])
                    this._addError(element, `The placeholder "${name}" does not exists in the source message`);
                }
                break;
            default:
                this._addError(element, 'Unexpected tag');
        }
    }
    visitAttribute(attribute, context) {
        throw new Error('unreachable code');
    }
    visitText(text, context) { return text.value; }
    visitComment(comment, context) { return ''; }
    visitExpansion(expansion, context) {
        const strCases = expansion.cases.map(c => c.visit(this, null));
        return `{${expansion.switchValue}, ${expansion.type}, strCases.join(' ')}`;
    }
    visitExpansionCase(expansionCase, context) {
        return `${expansionCase.value} {${ml.visitAll(this, expansionCase.expression, null)}}`;
    }
    _addError(node, message) {
        this._errors.push(new I18nError(node.sourceSpan, message));
    }
}
//# sourceMappingURL=xtb.js.map