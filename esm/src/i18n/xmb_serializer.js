/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RegExpWrapper, isPresent } from '../facade/lang';
import { HtmlElementAst } from '../html_ast';
import { HtmlParser } from '../html_parser';
import { ParseError } from '../parse_util';
import { id } from './message';
let _PLACEHOLDER_REGEXP = RegExpWrapper.create(`\\<ph(\\s)+name=("(\\w)+")\\/\\>`);
const _ID_ATTR = 'id';
const _MSG_ELEMENT = 'msg';
const _BUNDLE_ELEMENT = 'message-bundle';
export function serializeXmb(messages) {
    let ms = messages.map((m) => _serializeMessage(m)).join('');
    return `<message-bundle>${ms}</message-bundle>`;
}
export class XmbDeserializationResult {
    constructor(content, messages, errors) {
        this.content = content;
        this.messages = messages;
        this.errors = errors;
    }
}
export class XmbDeserializationError extends ParseError {
    constructor(span, msg) {
        super(span, msg);
    }
}
export function deserializeXmb(content, url) {
    const normalizedContent = _expandPlaceholder(content.trim());
    const parsed = new HtmlParser().parse(normalizedContent, url);
    if (parsed.errors.length > 0) {
        return new XmbDeserializationResult(null, {}, parsed.errors);
    }
    if (_checkRootElement(parsed.rootNodes)) {
        return new XmbDeserializationResult(null, {}, [new XmbDeserializationError(null, `Missing element "${_BUNDLE_ELEMENT}"`)]);
    }
    const bundleEl = parsed.rootNodes[0]; // test this
    const errors = [];
    const messages = {};
    _createMessages(bundleEl.children, messages, errors);
    return (errors.length == 0) ?
        new XmbDeserializationResult(normalizedContent, messages, []) :
        new XmbDeserializationResult(null, {}, errors);
}
function _checkRootElement(nodes) {
    return nodes.length < 1 || !(nodes[0] instanceof HtmlElementAst) ||
        nodes[0].name != _BUNDLE_ELEMENT;
}
function _createMessages(nodes, messages, errors) {
    nodes.forEach((node) => {
        if (node instanceof HtmlElementAst) {
            let msg = node;
            if (msg.name != _MSG_ELEMENT) {
                errors.push(new XmbDeserializationError(node.sourceSpan, `Unexpected element "${msg.name}"`));
                return;
            }
            let idAttr = msg.attrs.find(a => a.name == _ID_ATTR);
            if (idAttr) {
                messages[idAttr.value] = msg.children;
            }
            else {
                errors.push(new XmbDeserializationError(node.sourceSpan, `"${_ID_ATTR}" attribute is missing`));
            }
        }
    });
}
function _serializeMessage(m) {
    const desc = isPresent(m.description) ? ` desc='${_escapeXml(m.description)}'` : '';
    const meaning = isPresent(m.meaning) ? ` meaning='${_escapeXml(m.meaning)}'` : '';
    return `<msg id='${id(m)}'${desc}${meaning}>${m.content}</msg>`;
}
function _expandPlaceholder(input) {
    return RegExpWrapper.replaceAll(_PLACEHOLDER_REGEXP, input, (match) => {
        let nameWithQuotes = match[2];
        return `<ph name=${nameWithQuotes}></ph>`;
    });
}
const _XML_ESCAPED_CHARS = [
    [/&/g, '&amp;'],
    [/"/g, '&quot;'],
    [/'/g, '&apos;'],
    [/</g, '&lt;'],
    [/>/g, '&gt;'],
];
function _escapeXml(value) {
    return _XML_ESCAPED_CHARS.reduce((value, escape) => value.replace(escape[0], escape[1]), value);
}
//# sourceMappingURL=xmb_serializer.js.map