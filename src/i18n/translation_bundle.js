/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { HtmlParser } from '../ml_parser/html_parser';
import { I18nError } from './parse_util';
/**
 * A container for translated messages
 */
export class TranslationBundle {
    /**
     * @param {?=} _i18nNodesByMsgId
     * @param {?} digest
     */
    constructor(_i18nNodesByMsgId = {}, digest) {
        this._i18nNodesByMsgId = _i18nNodesByMsgId;
        this.digest = digest;
        this._i18nToHtml = new I18nToHtmlVisitor(_i18nNodesByMsgId, digest);
    }
    /**
     * @param {?} content
     * @param {?} url
     * @param {?} serializer
     * @return {?}
     */
    static load(content, url, serializer) {
        const /** @type {?} */ i18nNodesByMsgId = serializer.load(content, url);
        const /** @type {?} */ digestFn = (m) => serializer.digest(m);
        return new TranslationBundle(i18nNodesByMsgId, digestFn);
    }
    /**
     * @param {?} srcMsg
     * @return {?}
     */
    get(srcMsg) {
        const /** @type {?} */ html = this._i18nToHtml.convert(srcMsg);
        if (html.errors.length) {
            throw new Error(html.errors.join('\n'));
        }
        return html.nodes;
    }
    /**
     * @param {?} srcMsg
     * @return {?}
     */
    has(srcMsg) { return this.digest(srcMsg) in this._i18nNodesByMsgId; }
}
function TranslationBundle_tsickle_Closure_declarations() {
    /** @type {?} */
    TranslationBundle.prototype._i18nToHtml;
    /** @type {?} */
    TranslationBundle.prototype._i18nNodesByMsgId;
    /** @type {?} */
    TranslationBundle.prototype.digest;
}
class I18nToHtmlVisitor {
    /**
     * @param {?=} _i18nNodesByMsgId
     * @param {?} _digest
     */
    constructor(_i18nNodesByMsgId = {}, _digest) {
        this._i18nNodesByMsgId = _i18nNodesByMsgId;
        this._digest = _digest;
        this._srcMsgStack = [];
        this._errors = [];
    }
    /**
     * @param {?} srcMsg
     * @return {?}
     */
    convert(srcMsg) {
        this._srcMsgStack.length = 0;
        this._errors.length = 0;
        // i18n to text
        const /** @type {?} */ text = this._convertToText(srcMsg);
        // text to html
        const /** @type {?} */ url = srcMsg.nodes[0].sourceSpan.start.file.url;
        const /** @type {?} */ html = new HtmlParser().parse(text, url, true);
        return {
            nodes: html.rootNodes,
            errors: [...this._errors, ...html.errors],
        };
    }
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    visitText(text, context) { return text.value; }
    /**
     * @param {?} container
     * @param {?=} context
     * @return {?}
     */
    visitContainer(container, context) {
        return container.children.map(n => n.visit(this)).join('');
    }
    /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    visitIcu(icu, context) {
        const /** @type {?} */ cases = Object.keys(icu.cases).map(k => `${k} {${icu.cases[k].visit(this)}}`);
        // TODO(vicb): Once all format switch to using expression placeholders
        // we should throw when the placeholder is not in the source message
        const /** @type {?} */ exp = this._srcMsg.placeholders.hasOwnProperty(icu.expression) ?
            this._srcMsg.placeholders[icu.expression] :
            icu.expression;
        return `{${exp}, ${icu.type}, ${cases.join(' ')}}`;
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitPlaceholder(ph, context) {
        const /** @type {?} */ phName = ph.name;
        if (this._srcMsg.placeholders.hasOwnProperty(phName)) {
            return this._srcMsg.placeholders[phName];
        }
        if (this._srcMsg.placeholderToMessage.hasOwnProperty(phName)) {
            return this._convertToText(this._srcMsg.placeholderToMessage[phName]);
        }
        this._addError(ph, `Unknown placeholder`);
        return '';
    }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitTagPlaceholder(ph, context) { throw 'unreachable code'; }
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    visitIcuPlaceholder(ph, context) { throw 'unreachable code'; }
    /**
     * @param {?} srcMsg
     * @return {?}
     */
    _convertToText(srcMsg) {
        const /** @type {?} */ digest = this._digest(srcMsg);
        if (this._i18nNodesByMsgId.hasOwnProperty(digest)) {
            this._srcMsgStack.push(this._srcMsg);
            this._srcMsg = srcMsg;
            const /** @type {?} */ nodes = this._i18nNodesByMsgId[digest];
            const /** @type {?} */ text = nodes.map(node => node.visit(this)).join('');
            this._srcMsg = this._srcMsgStack.pop();
            return text;
        }
        this._addError(srcMsg.nodes[0], `Missing translation for message ${digest}`);
        return '';
    }
    /**
     * @param {?} el
     * @param {?} msg
     * @return {?}
     */
    _addError(el, msg) {
        this._errors.push(new I18nError(el.sourceSpan, msg));
    }
}
function I18nToHtmlVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    I18nToHtmlVisitor.prototype._srcMsg;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._srcMsgStack;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._errors;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._i18nNodesByMsgId;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._digest;
}
//# sourceMappingURL=translation_bundle.js.map