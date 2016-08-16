/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var collection_1 = require('../facade/collection');
var exceptions_1 = require('../facade/exceptions');
var lang_1 = require('../facade/lang');
var html_ast_1 = require('../html_ast');
var html_parser_1 = require('../html_parser');
var interpolation_config_1 = require('../interpolation_config');
var message_1 = require('./message');
var shared_1 = require('./shared');
var _PLACEHOLDER_ELEMENT = 'ph';
var _NAME_ATTR = 'name';
var _PLACEHOLDER_EXPANDED_REGEXP = /<ph\s+name="(\w+)"><\/ph>/gi;
/**
 * Creates an i18n-ed version of the parsed template.
 *
 * Algorithm:
 *
 * See `message_extractor.ts` for details on the partitioning algorithm.
 *
 * This is how the merging works:
 *
 * 1. Use the stringify function to get the message id. Look up the message in the map.
 * 2. Get the translated message. At this point we have two trees: the original tree
 * and the translated tree, where all the elements are replaced with placeholders.
 * 3. Use the original tree to create a mapping Index:number -> HtmlAst.
 * 4. Walk the translated tree.
 * 5. If we encounter a placeholder element, get its name property.
 * 6. Get the type and the index of the node using the name property.
 * 7. If the type is 'e', which means element, then:
 *     - translate the attributes of the original element
 *     - recurse to merge the children
 *     - create a new element using the original element name, original position,
 *     and translated children and attributes
 * 8. If the type if 't', which means text, then:
 *     - get the list of expressions from the original node.
 *     - get the string version of the interpolation subtree
 *     - find all the placeholders in the translated message, and replace them with the
 *     corresponding original expressions
 */
var I18nHtmlParser = (function () {
    function I18nHtmlParser(_htmlParser, _expressionParser, _messagesContent, _messages, _implicitTags, _implicitAttrs) {
        this._htmlParser = _htmlParser;
        this._expressionParser = _expressionParser;
        this._messagesContent = _messagesContent;
        this._messages = _messages;
        this._implicitTags = _implicitTags;
        this._implicitAttrs = _implicitAttrs;
    }
    I18nHtmlParser.prototype.parse = function (sourceContent, sourceUrl, parseExpansionForms, interpolationConfig) {
        if (parseExpansionForms === void 0) { parseExpansionForms = false; }
        if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
        this._errors = [];
        this._interpolationConfig = interpolationConfig;
        var res = this._htmlParser.parse(sourceContent, sourceUrl, true, interpolationConfig);
        if (res.errors.length > 0) {
            return res;
        }
        var nodes = this._recurse(res.rootNodes);
        return this._errors.length > 0 ? new html_parser_1.HtmlParseTreeResult([], this._errors) :
            new html_parser_1.HtmlParseTreeResult(nodes, []);
    };
    // Merge the translation recursively
    I18nHtmlParser.prototype._processI18nPart = function (part) {
        try {
            return part.hasI18n ? this._mergeI18Part(part) : this._recurseIntoI18nPart(part);
        }
        catch (e) {
            if (e instanceof shared_1.I18nError) {
                this._errors.push(e);
                return [];
            }
            else {
                throw e;
            }
        }
    };
    I18nHtmlParser.prototype._recurseIntoI18nPart = function (p) {
        // we found an element without an i18n attribute
        // we need to recurse in case its children may have i18n set
        // we also need to translate its attributes
        if (lang_1.isPresent(p.rootElement)) {
            var root = p.rootElement;
            var children = this._recurse(p.children);
            var attrs = this._i18nAttributes(root);
            return [new html_ast_1.HtmlElementAst(root.name, attrs, children, root.sourceSpan, root.startSourceSpan, root.endSourceSpan)];
        }
        if (lang_1.isPresent(p.rootTextNode)) {
            // a text node without i18n or interpolation, nothing to do
            return [p.rootTextNode];
        }
        return this._recurse(p.children);
    };
    I18nHtmlParser.prototype._recurse = function (nodes) {
        var _this = this;
        var parts = shared_1.partition(nodes, this._errors, this._implicitTags);
        return collection_1.ListWrapper.flatten(parts.map(function (p) { return _this._processI18nPart(p); }));
    };
    // Look for the translated message and merge it back to the tree
    I18nHtmlParser.prototype._mergeI18Part = function (part) {
        var message = part.createMessage(this._expressionParser, this._interpolationConfig);
        var messageId = message_1.id(message);
        if (!collection_1.StringMapWrapper.contains(this._messages, messageId)) {
            throw new shared_1.I18nError(part.sourceSpan, "Cannot find message for id '" + messageId + "', content '" + message.content + "'.");
        }
        var translation = this._messages[messageId];
        return this._mergeTrees(part, translation);
    };
    I18nHtmlParser.prototype._mergeTrees = function (part, translation) {
        if (lang_1.isPresent(part.rootTextNode)) {
            // this should never happen with a part. Parts that have root text node should not be merged.
            throw new exceptions_1.BaseException('should not be reached');
        }
        var visitor = new _NodeMappingVisitor();
        html_ast_1.htmlVisitAll(visitor, part.children);
        // merge the translated tree with the original tree.
        // we do it by preserving the source code position of the original tree
        var translatedAst = this._expandPlaceholders(translation, visitor.mapping);
        // if the root element is present, we need to create a new root element with its attributes
        // translated
        if (part.rootElement) {
            var root = part.rootElement;
            var attrs = this._i18nAttributes(root);
            return [new html_ast_1.HtmlElementAst(root.name, attrs, translatedAst, root.sourceSpan, root.startSourceSpan, root.endSourceSpan)];
        }
        return translatedAst;
    };
    /**
     * The translation AST is composed on text nodes and placeholder elements
     */
    I18nHtmlParser.prototype._expandPlaceholders = function (translation, mapping) {
        var _this = this;
        return translation.map(function (node) {
            if (node instanceof html_ast_1.HtmlElementAst) {
                // This node is a placeholder, replace with the original content
                return _this._expandPlaceholdersInNode(node, mapping);
            }
            if (node instanceof html_ast_1.HtmlTextAst) {
                return node;
            }
            throw new exceptions_1.BaseException('should not be reached');
        });
    };
    I18nHtmlParser.prototype._expandPlaceholdersInNode = function (node, mapping) {
        var name = this._getName(node);
        var index = lang_1.NumberWrapper.parseInt(name.substring(1), 10);
        var originalNode = mapping[index];
        if (originalNode instanceof html_ast_1.HtmlTextAst) {
            return this._mergeTextInterpolation(node, originalNode);
        }
        if (originalNode instanceof html_ast_1.HtmlElementAst) {
            return this._mergeElement(node, originalNode, mapping);
        }
        throw new exceptions_1.BaseException('should not be reached');
    };
    // Extract the value of a <ph> name attribute
    I18nHtmlParser.prototype._getName = function (node) {
        if (node.name != _PLACEHOLDER_ELEMENT) {
            throw new shared_1.I18nError(node.sourceSpan, "Unexpected tag \"" + node.name + "\". Only \"" + _PLACEHOLDER_ELEMENT + "\" tags are allowed.");
        }
        var nameAttr = node.attrs.find(function (a) { return a.name == _NAME_ATTR; });
        if (nameAttr) {
            return nameAttr.value;
        }
        throw new shared_1.I18nError(node.sourceSpan, "Missing \"" + _NAME_ATTR + "\" attribute.");
    };
    I18nHtmlParser.prototype._mergeTextInterpolation = function (node, originalNode) {
        var split = this._expressionParser.splitInterpolation(originalNode.value, originalNode.sourceSpan.toString(), this._interpolationConfig);
        var exps = split ? split.expressions : [];
        var messageSubstring = this._messagesContent.substring(node.startSourceSpan.end.offset, node.endSourceSpan.start.offset);
        var translated = this._replacePlaceholdersWithInterpolations(messageSubstring, exps, originalNode.sourceSpan);
        return new html_ast_1.HtmlTextAst(translated, originalNode.sourceSpan);
    };
    I18nHtmlParser.prototype._mergeElement = function (node, originalNode, mapping) {
        var children = this._expandPlaceholders(node.children, mapping);
        return new html_ast_1.HtmlElementAst(originalNode.name, this._i18nAttributes(originalNode), children, originalNode.sourceSpan, originalNode.startSourceSpan, originalNode.endSourceSpan);
    };
    I18nHtmlParser.prototype._i18nAttributes = function (el) {
        var _this = this;
        var res = [];
        var implicitAttrs = lang_1.isPresent(this._implicitAttrs[el.name]) ? this._implicitAttrs[el.name] : [];
        el.attrs.forEach(function (attr) {
            if (attr.name.startsWith(shared_1.I18N_ATTR_PREFIX) || attr.name == shared_1.I18N_ATTR)
                return;
            var message;
            var i18nAttr = el.attrs.find(function (a) { return a.name == "" + shared_1.I18N_ATTR_PREFIX + attr.name; });
            if (!i18nAttr) {
                if (implicitAttrs.indexOf(attr.name) == -1) {
                    res.push(attr);
                    return;
                }
                message = shared_1.messageFromAttribute(_this._expressionParser, _this._interpolationConfig, attr);
            }
            else {
                message = shared_1.messageFromI18nAttribute(_this._expressionParser, _this._interpolationConfig, el, i18nAttr);
            }
            var messageId = message_1.id(message);
            if (collection_1.StringMapWrapper.contains(_this._messages, messageId)) {
                var updatedMessage = _this._replaceInterpolationInAttr(attr, _this._messages[messageId]);
                res.push(new html_ast_1.HtmlAttrAst(attr.name, updatedMessage, attr.sourceSpan));
            }
            else {
                throw new shared_1.I18nError(attr.sourceSpan, "Cannot find message for id '" + messageId + "', content '" + message.content + "'.");
            }
        });
        return res;
    };
    I18nHtmlParser.prototype._replaceInterpolationInAttr = function (attr, msg) {
        var split = this._expressionParser.splitInterpolation(attr.value, attr.sourceSpan.toString(), this._interpolationConfig);
        var exps = lang_1.isPresent(split) ? split.expressions : [];
        var first = msg[0];
        var last = msg[msg.length - 1];
        var start = first.sourceSpan.start.offset;
        var end = last instanceof html_ast_1.HtmlElementAst ? last.endSourceSpan.end.offset : last.sourceSpan.end.offset;
        var messageSubstring = this._messagesContent.substring(start, end);
        return this._replacePlaceholdersWithInterpolations(messageSubstring, exps, attr.sourceSpan);
    };
    ;
    I18nHtmlParser.prototype._replacePlaceholdersWithInterpolations = function (message, exps, sourceSpan) {
        var _this = this;
        var expMap = this._buildExprMap(exps);
        return message.replace(_PLACEHOLDER_EXPANDED_REGEXP, function (_, name) { return _this._convertIntoExpression(name, expMap, sourceSpan); });
    };
    I18nHtmlParser.prototype._buildExprMap = function (exps) {
        var expMap = new Map();
        var usedNames = new Map();
        for (var i = 0; i < exps.length; i++) {
            var phName = shared_1.extractPhNameFromInterpolation(exps[i], i);
            expMap.set(shared_1.dedupePhName(usedNames, phName), exps[i]);
        }
        return expMap;
    };
    I18nHtmlParser.prototype._convertIntoExpression = function (name, expMap, sourceSpan) {
        if (expMap.has(name)) {
            return "" + this._interpolationConfig.start + expMap.get(name) + this._interpolationConfig.end;
        }
        throw new shared_1.I18nError(sourceSpan, "Invalid interpolation name '" + name + "'");
    };
    return I18nHtmlParser;
}());
exports.I18nHtmlParser = I18nHtmlParser;
// Creates a list of elements and text nodes in the AST
// The indexes match the placeholders indexes
var _NodeMappingVisitor = (function () {
    function _NodeMappingVisitor() {
        this.mapping = [];
    }
    _NodeMappingVisitor.prototype.visitElement = function (ast, context) {
        this.mapping.push(ast);
        html_ast_1.htmlVisitAll(this, ast.children);
    };
    _NodeMappingVisitor.prototype.visitText = function (ast, context) { this.mapping.push(ast); };
    _NodeMappingVisitor.prototype.visitAttr = function (ast, context) { };
    _NodeMappingVisitor.prototype.visitExpansion = function (ast, context) { };
    _NodeMappingVisitor.prototype.visitExpansionCase = function (ast, context) { };
    _NodeMappingVisitor.prototype.visitComment = function (ast, context) { };
    return _NodeMappingVisitor;
}());
//# sourceMappingURL=i18n_html_parser.js.map