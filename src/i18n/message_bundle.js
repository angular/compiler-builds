/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { extractMessages } from './extractor_merger';
import * as i18n from './i18n_ast';
/**
 * A container for message extracted from the templates.
 */
var MessageBundle = (function () {
    /**
     * @param {?} _htmlParser
     * @param {?} _implicitTags
     * @param {?} _implicitAttrs
     */
    function MessageBundle(_htmlParser, _implicitTags, _implicitAttrs) {
        this._htmlParser = _htmlParser;
        this._implicitTags = _implicitTags;
        this._implicitAttrs = _implicitAttrs;
        this._messages = [];
    }
    /**
     * @param {?} html
     * @param {?} url
     * @param {?} interpolationConfig
     * @return {?}
     */
    MessageBundle.prototype.updateFromTemplate = function (html, url, interpolationConfig) {
        var /** @type {?} */ htmlParserResult = this._htmlParser.parse(html, url, true, interpolationConfig);
        if (htmlParserResult.errors.length) {
            return htmlParserResult.errors;
        }
        var /** @type {?} */ i18nParserResult = extractMessages(htmlParserResult.rootNodes, interpolationConfig, this._implicitTags, this._implicitAttrs);
        if (i18nParserResult.errors.length) {
            return i18nParserResult.errors;
        }
        (_a = this._messages).push.apply(_a, i18nParserResult.messages);
        var _a;
    };
    /**
     * @return {?}
     */
    MessageBundle.prototype.getMessages = function () { return this._messages; };
    /**
     * @param {?} serializer
     * @return {?}
     */
    MessageBundle.prototype.write = function (serializer) {
        var /** @type {?} */ messages = {};
        var /** @type {?} */ mapperVisitor = new MapPlaceholderNames();
        // Deduplicate messages based on their ID
        this._messages.forEach(function (message) {
            var /** @type {?} */ id = serializer.digest(message);
            if (!messages.hasOwnProperty(id)) {
                messages[id] = message;
            }
        });
        // Transform placeholder names using the serializer mapping
        var /** @type {?} */ msgList = Object.keys(messages).map(function (id) {
            var /** @type {?} */ mapper = serializer.createNameMapper(messages[id]);
            var /** @type {?} */ src = messages[id];
            var /** @type {?} */ nodes = mapper ? mapperVisitor.convert(src.nodes, mapper) : src.nodes;
            return new i18n.Message(nodes, {}, {}, src.meaning, src.description, id);
        });
        return serializer.write(msgList);
    };
    return MessageBundle;
}());
export { MessageBundle };
function MessageBundle_tsickle_Closure_declarations() {
    /** @type {?} */
    MessageBundle.prototype._messages;
    /** @type {?} */
    MessageBundle.prototype._htmlParser;
    /** @type {?} */
    MessageBundle.prototype._implicitTags;
    /** @type {?} */
    MessageBundle.prototype._implicitAttrs;
}
var MapPlaceholderNames = (function (_super) {
    __extends(MapPlaceholderNames, _super);
    function MapPlaceholderNames() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * @param {?} nodes
     * @param {?} mapper
     * @return {?}
     */
    MapPlaceholderNames.prototype.convert = function (nodes, mapper) {
        var _this = this;
        return mapper ? nodes.map(function (n) { return n.visit(_this, mapper); }) : nodes;
    };
    /**
     * @param {?} ph
     * @param {?} mapper
     * @return {?}
     */
    MapPlaceholderNames.prototype.visitTagPlaceholder = function (ph, mapper) {
        var _this = this;
        var /** @type {?} */ startName = mapper.toPublicName(ph.startName);
        var /** @type {?} */ closeName = ph.closeName ? mapper.toPublicName(ph.closeName) : ph.closeName;
        var /** @type {?} */ children = ph.children.map(function (n) { return n.visit(_this, mapper); });
        return new i18n.TagPlaceholder(ph.tag, ph.attrs, startName, closeName, children, ph.isVoid, ph.sourceSpan);
    };
    /**
     * @param {?} ph
     * @param {?} mapper
     * @return {?}
     */
    MapPlaceholderNames.prototype.visitPlaceholder = function (ph, mapper) {
        return new i18n.Placeholder(ph.value, mapper.toPublicName(ph.name), ph.sourceSpan);
    };
    /**
     * @param {?} ph
     * @param {?} mapper
     * @return {?}
     */
    MapPlaceholderNames.prototype.visitIcuPlaceholder = function (ph, mapper) {
        return new i18n.IcuPlaceholder(ph.value, mapper.toPublicName(ph.name), ph.sourceSpan);
    };
    return MapPlaceholderNames;
}(i18n.CloneVisitor));
//# sourceMappingURL=message_bundle.js.map