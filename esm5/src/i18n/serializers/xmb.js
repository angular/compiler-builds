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
import * as tslib_1 from "tslib";
import { decimalDigest } from '../digest';
import { Serializer, SimplePlaceholderMapper } from './serializer';
import * as xml from './xml_helper';
var /** @type {?} */ _MESSAGES_TAG = 'messagebundle';
var /** @type {?} */ _MESSAGE_TAG = 'msg';
var /** @type {?} */ _PLACEHOLDER_TAG = 'ph';
var /** @type {?} */ _EXEMPLE_TAG = 'ex';
var /** @type {?} */ _SOURCE_TAG = 'source';
var /** @type {?} */ _DOCTYPE = "<!ELEMENT messagebundle (msg)*>\n<!ATTLIST messagebundle class CDATA #IMPLIED>\n\n<!ELEMENT msg (#PCDATA|ph|source)*>\n<!ATTLIST msg id CDATA #IMPLIED>\n<!ATTLIST msg seq CDATA #IMPLIED>\n<!ATTLIST msg name CDATA #IMPLIED>\n<!ATTLIST msg desc CDATA #IMPLIED>\n<!ATTLIST msg meaning CDATA #IMPLIED>\n<!ATTLIST msg obsolete (obsolete) #IMPLIED>\n<!ATTLIST msg xml:space (default|preserve) \"default\">\n<!ATTLIST msg is_hidden CDATA #IMPLIED>\n\n<!ELEMENT source (#PCDATA)>\n\n<!ELEMENT ph (#PCDATA|ex)*>\n<!ATTLIST ph name CDATA #REQUIRED>\n\n<!ELEMENT ex (#PCDATA)>";
var Xmb = /** @class */ (function (_super) {
    tslib_1.__extends(Xmb, _super);
    function Xmb() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    Xmb.prototype.write = /**
     * @param {?} messages
     * @param {?} locale
     * @return {?}
     */
    function (messages, locale) {
        var /** @type {?} */ exampleVisitor = new ExampleVisitor();
        var /** @type {?} */ visitor = new _Visitor();
        var /** @type {?} */ rootNode = new xml.Tag(_MESSAGES_TAG);
        messages.forEach(function (message) {
            var /** @type {?} */ attrs = { id: message.id };
            if (message.description) {
                attrs['desc'] = message.description;
            }
            if (message.meaning) {
                attrs['meaning'] = message.meaning;
            }
            var /** @type {?} */ sourceTags = [];
            message.sources.forEach(function (source) {
                sourceTags.push(new xml.Tag(_SOURCE_TAG, {}, [
                    new xml.Text(source.filePath + ":" + source.startLine + (source.endLine !== source.startLine ? ',' + source.endLine : ''))
                ]));
            });
            rootNode.children.push(new xml.CR(2), new xml.Tag(_MESSAGE_TAG, attrs, sourceTags.concat(visitor.serialize(message.nodes))));
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
    };
    /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    Xmb.prototype.load = /**
     * @param {?} content
     * @param {?} url
     * @return {?}
     */
    function (content, url) {
        throw new Error('Unsupported');
    };
    /**
     * @param {?} message
     * @return {?}
     */
    Xmb.prototype.digest = /**
     * @param {?} message
     * @return {?}
     */
    function (message) { return digest(message); };
    /**
     * @param {?} message
     * @return {?}
     */
    Xmb.prototype.createNameMapper = /**
     * @param {?} message
     * @return {?}
     */
    function (message) {
        return new SimplePlaceholderMapper(message, toPublicName);
    };
    return Xmb;
}(Serializer));
export { Xmb };
var _Visitor = /** @class */ (function () {
    function _Visitor() {
    }
    /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    _Visitor.prototype.visitText = /**
     * @param {?} text
     * @param {?=} context
     * @return {?}
     */
    function (text, context) { return [new xml.Text(text.value)]; };
    /**
     * @param {?} container
     * @param {?} context
     * @return {?}
     */
    _Visitor.prototype.visitContainer = /**
     * @param {?} container
     * @param {?} context
     * @return {?}
     */
    function (container, context) {
        var _this = this;
        var /** @type {?} */ nodes = [];
        container.children.forEach(function (node) { return nodes.push.apply(nodes, node.visit(_this)); });
        return nodes;
    };
    /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    _Visitor.prototype.visitIcu = /**
     * @param {?} icu
     * @param {?=} context
     * @return {?}
     */
    function (icu, context) {
        var _this = this;
        var /** @type {?} */ nodes = [new xml.Text("{" + icu.expressionPlaceholder + ", " + icu.type + ", ")];
        Object.keys(icu.cases).forEach(function (c) {
            nodes.push.apply(nodes, [new xml.Text(c + " {")].concat(icu.cases[c].visit(_this), [new xml.Text("} ")]));
        });
        nodes.push(new xml.Text("}"));
        return nodes;
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    _Visitor.prototype.visitTagPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) {
        var /** @type {?} */ startEx = new xml.Tag(_EXEMPLE_TAG, {}, [new xml.Text("<" + ph.tag + ">")]);
        var /** @type {?} */ startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.startName }, [startEx]);
        if (ph.isVoid) {
            // void tags have no children nor closing tags
            return [startTagPh];
        }
        var /** @type {?} */ closeEx = new xml.Tag(_EXEMPLE_TAG, {}, [new xml.Text("</" + ph.tag + ">")]);
        var /** @type {?} */ closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.closeName }, [closeEx]);
        return [startTagPh].concat(this.serialize(ph.children), [closeTagPh]);
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    _Visitor.prototype.visitPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) {
        var /** @type {?} */ exTag = new xml.Tag(_EXEMPLE_TAG, {}, [new xml.Text("{{" + ph.value + "}}")]);
        return [new xml.Tag(_PLACEHOLDER_TAG, { name: ph.name }, [exTag])];
    };
    /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    _Visitor.prototype.visitIcuPlaceholder = /**
     * @param {?} ph
     * @param {?=} context
     * @return {?}
     */
    function (ph, context) {
        var /** @type {?} */ exTag = new xml.Tag(_EXEMPLE_TAG, {}, [
            new xml.Text("{" + ph.value.expression + ", " + ph.value.type + ", " + Object.keys(ph.value.cases).map(function (value) { return value + ' {...}'; }).join(' ') + "}")
        ]);
        return [new xml.Tag(_PLACEHOLDER_TAG, { name: ph.name }, [exTag])];
    };
    /**
     * @param {?} nodes
     * @return {?}
     */
    _Visitor.prototype.serialize = /**
     * @param {?} nodes
     * @return {?}
     */
    function (nodes) {
        var _this = this;
        return [].concat.apply([], nodes.map(function (node) { return node.visit(_this); }));
    };
    return _Visitor;
}());
/**
 * @param {?} message
 * @return {?}
 */
export function digest(message) {
    return decimalDigest(message);
}
var ExampleVisitor = /** @class */ (function () {
    function ExampleVisitor() {
    }
    /**
     * @param {?} node
     * @return {?}
     */
    ExampleVisitor.prototype.addDefaultExamples = /**
     * @param {?} node
     * @return {?}
     */
    function (node) {
        node.visit(this);
        return node;
    };
    /**
     * @param {?} tag
     * @return {?}
     */
    ExampleVisitor.prototype.visitTag = /**
     * @param {?} tag
     * @return {?}
     */
    function (tag) {
        var _this = this;
        if (tag.name === _PLACEHOLDER_TAG) {
            if (!tag.children || tag.children.length == 0) {
                var /** @type {?} */ exText = new xml.Text(tag.attrs['name'] || '...');
                tag.children = [new xml.Tag(_EXEMPLE_TAG, {}, [exText])];
            }
        }
        else if (tag.children) {
            tag.children.forEach(function (node) { return node.visit(_this); });
        }
    };
    /**
     * @param {?} text
     * @return {?}
     */
    ExampleVisitor.prototype.visitText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) { };
    /**
     * @param {?} decl
     * @return {?}
     */
    ExampleVisitor.prototype.visitDeclaration = /**
     * @param {?} decl
     * @return {?}
     */
    function (decl) { };
    /**
     * @param {?} doctype
     * @return {?}
     */
    ExampleVisitor.prototype.visitDoctype = /**
     * @param {?} doctype
     * @return {?}
     */
    function (doctype) { };
    return ExampleVisitor;
}());
/**
 * @param {?} internalName
 * @return {?}
 */
export function toPublicName(internalName) {
    return internalName.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}
//# sourceMappingURL=xmb.js.map