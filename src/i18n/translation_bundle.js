/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { MissingTranslationStrategy } from '@angular/core';
import { HtmlParser } from '../ml_parser/html_parser';
import { I18nError } from './parse_util';
/**
 * A container for translated messages
 */
var TranslationBundle = (function () {
    /**
     * @param {?=} _i18nNodesByMsgId
     * @param {?} locale
     * @param {?} digest
     * @param {?=} mapperFactory
     * @param {?=} missingTranslationStrategy
     * @param {?=} console
     */
    function TranslationBundle(_i18nNodesByMsgId, locale, digest, mapperFactory, missingTranslationStrategy, console) {
        if (_i18nNodesByMsgId === void 0) { _i18nNodesByMsgId = {}; }
        if (missingTranslationStrategy === void 0) { missingTranslationStrategy = MissingTranslationStrategy.Warning; }
        this._i18nNodesByMsgId = _i18nNodesByMsgId;
        this.digest = digest;
        this.mapperFactory = mapperFactory;
        this._i18nToHtml = new I18nToHtmlVisitor(_i18nNodesByMsgId, locale, digest, mapperFactory, missingTranslationStrategy, console);
    }
    /**
     * @param {?} content
     * @param {?} url
     * @param {?} serializer
     * @param {?} missingTranslationStrategy
     * @param {?=} console
     * @return {?}
     */
    TranslationBundle.load = function (content, url, serializer, missingTranslationStrategy, console) {
        var _a = serializer.load(content, url), locale = _a.locale, i18nNodesByMsgId = _a.i18nNodesByMsgId;
        var /** @type {?} */ digestFn = function (m) { return serializer.digest(m); };
        var /** @type {?} */ mapperFactory = function (m) { return serializer.createNameMapper(m); };
        return new TranslationBundle(i18nNodesByMsgId, locale, digestFn, mapperFactory, missingTranslationStrategy, console);
    };
    /**
     * @param {?} srcMsg
     * @return {?}
     */
    TranslationBundle.prototype.get = function (srcMsg) {
        var /** @type {?} */ html = this._i18nToHtml.convert(srcMsg);
        if (html.errors.length) {
            throw new Error(html.errors.join('\n'));
        }
        return html.nodes;
    };
    /**
     * @param {?} srcMsg
     * @return {?}
     */
    TranslationBundle.prototype.has = function (srcMsg) { return this.digest(srcMsg) in this._i18nNodesByMsgId; };
    return TranslationBundle;
}());
export { TranslationBundle };
function TranslationBundle_tsickle_Closure_declarations() {
    /** @type {?} */
    TranslationBundle.prototype._i18nToHtml;
    /** @type {?} */
    TranslationBundle.prototype._i18nNodesByMsgId;
    /** @type {?} */
    TranslationBundle.prototype.digest;
    /** @type {?} */
    TranslationBundle.prototype.mapperFactory;
}
var I18nToHtmlVisitor = (function () {
    /**
     * @param {?=} _i18nNodesByMsgId
     * @param {?} _locale
     * @param {?} _digest
     * @param {?} _mapperFactory
     * @param {?} _missingTranslationStrategy
     * @param {?=} _console
     */
    function I18nToHtmlVisitor(_i18nNodesByMsgId, _locale, _digest, _mapperFactory, _missingTranslationStrategy, _console) {
        if (_i18nNodesByMsgId === void 0) { _i18nNodesByMsgId = {}; }
        this._i18nNodesByMsgId = _i18nNodesByMsgId;
        this._locale = _locale;
        this._digest = _digest;
        this._mapperFactory = _mapperFactory;
        this._missingTranslationStrategy = _missingTranslationStrategy;
        this._console = _console;
        this._contextStack = [];
        this._errors = [];
    }
    /**
     * @param {?} srcMsg
     * @return {?}
     */
    I18nToHtmlVisitor.prototype.convert = function (srcMsg) {
        this._contextStack.length = 0;
        this._errors.length = 0;
        // i18n to text
        var /** @type {?} */ text = this._convertToText(srcMsg);
        // text to html
        var /** @type {?} */ url = srcMsg.nodes[0].sourceSpan.start.file.url;
        var /** @type {?} */ html = new HtmlParser().parse(text, url, true);
        return {
            nodes: html.rootNodes,
            errors: this._errors.concat(html.errors),
        };
    };
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    I18nToHtmlVisitor.prototype.visitText = function (text, context) { return text.value; };
    /**
     * @param {?} container
     * @param {?=} context
     * @return {?}
     */
    I18nToHtmlVisitor.prototype.visitContainer = function (container, context) {
        var _this = this;
        return container.children.map(function (n) { return n.visit(_this); }).join('');
    };
    /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    I18nToHtmlVisitor.prototype.visitIcu = function (icu, context) {
        var _this = this;
        var /** @type {?} */ cases = Object.keys(icu.cases).map(function (k) { return k + " {" + icu.cases[k].visit(_this) + "}"; });
        // TODO(vicb): Once all format switch to using expression placeholders
        // we should throw when the placeholder is not in the source message
        var /** @type {?} */ exp = this._srcMsg.placeholders.hasOwnProperty(icu.expression) ?
            this._srcMsg.placeholders[icu.expression] :
            icu.expression;
        return "{" + exp + ", " + icu.type + ", " + cases.join(' ') + "}";
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    I18nToHtmlVisitor.prototype.visitPlaceholder = function (ph, context) {
        var /** @type {?} */ phName = this._mapper(ph.name);
        if (this._srcMsg.placeholders.hasOwnProperty(phName)) {
            return this._srcMsg.placeholders[phName];
        }
        if (this._srcMsg.placeholderToMessage.hasOwnProperty(phName)) {
            return this._convertToText(this._srcMsg.placeholderToMessage[phName]);
        }
        this._addError(ph, "Unknown placeholder \"" + ph.name + "\"");
        return '';
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    I18nToHtmlVisitor.prototype.visitTagPlaceholder = function (ph, context) {
        var _this = this;
        var /** @type {?} */ tag = "" + ph.tag;
        var /** @type {?} */ attrs = Object.keys(ph.attrs).map(function (name) { return name + "=\"" + ph.attrs[name] + "\""; }).join(' ');
        if (ph.isVoid) {
            return "<" + tag + " " + attrs + "/>";
        }
        var /** @type {?} */ children = ph.children.map(function (c) { return c.visit(_this); }).join('');
        return "<" + tag + " " + attrs + ">" + children + "</" + tag + ">";
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    I18nToHtmlVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
        // An ICU placeholder references the source message to be serialized
        return this._convertToText(this._srcMsg.placeholderToMessage[ph.name]);
    };
    /**
     * Convert a source message to a translated text string:
     * - text nodes are replaced with their translation,
     * - placeholders are replaced with their content,
     * - ICU nodes are converted to ICU expressions.
     * @param {?} srcMsg
     * @return {?}
     */
    I18nToHtmlVisitor.prototype._convertToText = function (srcMsg) {
        var _this = this;
        var /** @type {?} */ id = this._digest(srcMsg);
        var /** @type {?} */ mapper = this._mapperFactory ? this._mapperFactory(srcMsg) : null;
        var /** @type {?} */ nodes;
        this._contextStack.push({ msg: this._srcMsg, mapper: this._mapper });
        this._srcMsg = srcMsg;
        if (this._i18nNodesByMsgId.hasOwnProperty(id)) {
            // When there is a translation use its nodes as the source
            // And create a mapper to convert serialized placeholder names to internal names
            nodes = this._i18nNodesByMsgId[id];
            this._mapper = function (name) { return mapper ? mapper.toInternalName(name) : name; };
        }
        else {
            // When no translation has been found
            // - report an error / a warning / nothing,
            // - use the nodes from the original message
            // - placeholders are already internal and need no mapper
            if (this._missingTranslationStrategy === MissingTranslationStrategy.Error) {
                var /** @type {?} */ ctx = this._locale ? " for locale \"" + this._locale + "\"" : '';
                this._addError(srcMsg.nodes[0], "Missing translation for message \"" + id + "\"" + ctx);
            }
            else if (this._console &&
                this._missingTranslationStrategy === MissingTranslationStrategy.Warning) {
                var /** @type {?} */ ctx = this._locale ? " for locale \"" + this._locale + "\"" : '';
                this._console.warn("Missing translation for message \"" + id + "\"" + ctx);
            }
            nodes = srcMsg.nodes;
            this._mapper = function (name) { return name; };
        }
        var /** @type {?} */ text = nodes.map(function (node) { return node.visit(_this); }).join('');
        var /** @type {?} */ context = this._contextStack.pop();
        this._srcMsg = context.msg;
        this._mapper = context.mapper;
        return text;
    };
    /**
     * @param {?} el
     * @param {?} msg
     * @return {?}
     */
    I18nToHtmlVisitor.prototype._addError = function (el, msg) {
        this._errors.push(new I18nError(el.sourceSpan, msg));
    };
    return I18nToHtmlVisitor;
}());
function I18nToHtmlVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    I18nToHtmlVisitor.prototype._srcMsg;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._contextStack;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._errors;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._mapper;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._i18nNodesByMsgId;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._locale;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._digest;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._mapperFactory;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._missingTranslationStrategy;
    /** @type {?} */
    I18nToHtmlVisitor.prototype._console;
}
//# sourceMappingURL=translation_bundle.js.map