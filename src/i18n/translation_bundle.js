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
export var TranslationBundle = (function () {
    function TranslationBundle(_i18nNodesByMsgId, digest) {
        if (_i18nNodesByMsgId === void 0) { _i18nNodesByMsgId = {}; }
        this._i18nNodesByMsgId = _i18nNodesByMsgId;
        this.digest = digest;
        this._i18nToHtml = new I18nToHtmlVisitor(_i18nNodesByMsgId, digest);
    }
    TranslationBundle.load = function (content, url, serializer) {
        var i18nNodesByMsgId = serializer.load(content, url);
        var digestFn = function (m) { return serializer.digest(m); };
        return new TranslationBundle(i18nNodesByMsgId, digestFn);
    };
    TranslationBundle.prototype.get = function (srcMsg) {
        var html = this._i18nToHtml.convert(srcMsg);
        if (html.errors.length) {
            throw new Error(html.errors.join('\n'));
        }
        return html.nodes;
    };
    TranslationBundle.prototype.has = function (srcMsg) { return this.digest(srcMsg) in this._i18nNodesByMsgId; };
    return TranslationBundle;
}());
var I18nToHtmlVisitor = (function () {
    function I18nToHtmlVisitor(_i18nNodesByMsgId, _digest) {
        if (_i18nNodesByMsgId === void 0) { _i18nNodesByMsgId = {}; }
        this._i18nNodesByMsgId = _i18nNodesByMsgId;
        this._digest = _digest;
        this._srcMsgStack = [];
        this._errors = [];
    }
    I18nToHtmlVisitor.prototype.convert = function (srcMsg) {
        this._srcMsgStack.length = 0;
        this._errors.length = 0;
        // i18n to text
        var text = this._convertToText(srcMsg);
        // text to html
        var url = srcMsg.nodes[0].sourceSpan.start.file.url;
        var html = new HtmlParser().parse(text, url, true);
        return {
            nodes: html.rootNodes,
            errors: this._errors.concat(html.errors),
        };
    };
    I18nToHtmlVisitor.prototype.visitText = function (text, context) { return text.value; };
    I18nToHtmlVisitor.prototype.visitContainer = function (container, context) {
        var _this = this;
        return container.children.map(function (n) { return n.visit(_this); }).join('');
    };
    I18nToHtmlVisitor.prototype.visitIcu = function (icu, context) {
        var _this = this;
        var cases = Object.keys(icu.cases).map(function (k) { return (k + " {" + icu.cases[k].visit(_this) + "}"); });
        // TODO(vicb): Once all format switch to using expression placeholders
        // we should throw when the placeholder is not in the source message
        var exp = this._srcMsg.placeholders.hasOwnProperty(icu.expression) ?
            this._srcMsg.placeholders[icu.expression] :
            icu.expression;
        return "{" + exp + ", " + icu.type + ", " + cases.join(' ') + "}";
    };
    I18nToHtmlVisitor.prototype.visitPlaceholder = function (ph, context) {
        var phName = ph.name;
        if (this._srcMsg.placeholders.hasOwnProperty(phName)) {
            return this._srcMsg.placeholders[phName];
        }
        if (this._srcMsg.placeholderToMessage.hasOwnProperty(phName)) {
            return this._convertToText(this._srcMsg.placeholderToMessage[phName]);
        }
        this._addError(ph, "Unknown placeholder");
        return '';
    };
    I18nToHtmlVisitor.prototype.visitTagPlaceholder = function (ph, context) { throw 'unreachable code'; };
    I18nToHtmlVisitor.prototype.visitIcuPlaceholder = function (ph, context) { throw 'unreachable code'; };
    I18nToHtmlVisitor.prototype._convertToText = function (srcMsg) {
        var _this = this;
        var digest = this._digest(srcMsg);
        if (this._i18nNodesByMsgId.hasOwnProperty(digest)) {
            this._srcMsgStack.push(this._srcMsg);
            this._srcMsg = srcMsg;
            var nodes = this._i18nNodesByMsgId[digest];
            var text = nodes.map(function (node) { return node.visit(_this); }).join('');
            this._srcMsg = this._srcMsgStack.pop();
            return text;
        }
        this._addError(srcMsg.nodes[0], "Missing translation for message " + digest);
        return '';
    };
    I18nToHtmlVisitor.prototype._addError = function (el, msg) {
        this._errors.push(new I18nError(el.sourceSpan, msg));
    };
    return I18nToHtmlVisitor;
}());
//# sourceMappingURL=translation_bundle.js.map