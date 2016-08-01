/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var html = require('../html_parser/ast');
var parse_util_1 = require('./parse_util');
var _I18N_ATTR = 'i18n';
var _I18N_ATTR_PREFIX = 'i18n-';
/**
 * Extract translatable message from an html AST as a list of html AST nodes
 */
function extractAstMessages(sourceAst, implicitTags, implicitAttrs) {
    var visitor = new _ExtractVisitor(implicitTags, implicitAttrs);
    return visitor.extract(sourceAst);
}
exports.extractAstMessages = extractAstMessages;
var ExtractionResult = (function () {
    function ExtractionResult(messages, errors) {
        this.messages = messages;
        this.errors = errors;
    }
    return ExtractionResult;
}());
exports.ExtractionResult = ExtractionResult;
var _ExtractVisitor = (function () {
    function _ExtractVisitor(_implicitTags, _implicitAttrs) {
        this._implicitTags = _implicitTags;
        this._implicitAttrs = _implicitAttrs;
        // <el i18n>...</el>
        this._inI18nNode = false;
        this._depth = 0;
        // {<icu message>}
        this._inIcu = false;
    }
    _ExtractVisitor.prototype.extract = function (nodes) {
        var _this = this;
        var messages = [];
        this._inI18nBlock = false;
        this._inI18nNode = false;
        this._depth = 0;
        this._inIcu = false;
        this._sectionStartIndex = void 0;
        this._errors = [];
        nodes.forEach(function (node) { return node.visit(_this, messages); });
        if (this._inI18nBlock) {
            this._reportError(nodes[nodes.length - 1], 'Unclosed block');
        }
        return new ExtractionResult(messages, this._errors);
    };
    _ExtractVisitor.prototype.visitExpansionCase = function (icuCase, messages) {
        html.visitAll(this, icuCase.expression, messages);
    };
    _ExtractVisitor.prototype.visitExpansion = function (icu, messages) {
        this._mayBeAddBlockChildren(icu);
        var wasInIcu = this._inIcu;
        if (!this._inIcu) {
            if (this._inI18nNode || this._inI18nBlock) {
                this._addMessage(messages, [icu]);
            }
            this._inIcu = true;
        }
        html.visitAll(this, icu.cases, messages);
        this._inIcu = wasInIcu;
    };
    _ExtractVisitor.prototype.visitComment = function (comment, messages) {
        var isOpening = _isOpeningComment(comment);
        if (isOpening && (this._inI18nBlock || this._inI18nNode)) {
            this._reportError(comment, 'Could not start a block inside a translatable section');
            return;
        }
        var isClosing = _isClosingComment(comment);
        if (isClosing && !this._inI18nBlock) {
            this._reportError(comment, 'Trying to close an unopened block');
            return;
        }
        if (!(this._inI18nNode || this._inIcu)) {
            if (!this._inI18nBlock) {
                if (isOpening) {
                    this._inI18nBlock = true;
                    this._blockStartDepth = this._depth;
                    this._blockChildren = [];
                    this._blockMeaningAndDesc = comment.value.replace(/^i18n:?/, '').trim();
                    this._startSection(messages);
                }
            }
            else {
                if (isClosing) {
                    if (this._depth == this._blockStartDepth) {
                        this._endSection(messages, this._blockChildren);
                        this._inI18nBlock = false;
                        this._addMessage(messages, this._blockChildren, this._blockMeaningAndDesc);
                    }
                    else {
                        this._reportError(comment, 'I18N blocks should not cross element boundaries');
                        return;
                    }
                }
            }
        }
    };
    _ExtractVisitor.prototype.visitText = function (text, messages) { this._mayBeAddBlockChildren(text); };
    _ExtractVisitor.prototype.visitElement = function (el, messages) {
        this._mayBeAddBlockChildren(el);
        this._depth++;
        var wasInI18nNode = this._inI18nNode;
        var useSection = false;
        // Extract only top level nodes with the (implicit) "i18n" attribute if not in a block or an ICU
        // message
        var i18nAttr = _getI18nAttr(el);
        var isImplicitI18n = this._implicitTags.some(function (tagName) { return el.name === tagName; });
        if (!(this._inI18nNode || this._inIcu || this._inI18nBlock)) {
            if (i18nAttr) {
                this._inI18nNode = true;
                this._addMessage(messages, el.children, i18nAttr.value);
                useSection = true;
            }
            else if (isImplicitI18n) {
                this._inI18nNode = true;
                this._addMessage(messages, el.children);
            }
        }
        else {
            if (i18nAttr || isImplicitI18n) {
                // TODO(vicb): we should probably allow nested implicit element (ie <div>)
                this._reportError(el, 'Could not mark an element as translatable inside a translatable section');
            }
        }
        this._extractFromAttributes(el, messages);
        if (useSection) {
            this._startSection(messages);
            html.visitAll(this, el.children, messages);
            this._endSection(messages, el.children);
        }
        else {
            html.visitAll(this, el.children, messages);
        }
        this._depth--;
        this._inI18nNode = wasInI18nNode;
    };
    _ExtractVisitor.prototype.visitAttribute = function (attribute, messages) {
        throw new Error('unreachable code');
    };
    _ExtractVisitor.prototype._extractFromAttributes = function (el, messages) {
        var _this = this;
        var explicitAttrNameToValue = new Map();
        var implicitAttrNames = this._implicitAttrs[el.name] || [];
        el.attrs.filter(function (attr) { return attr.name.startsWith(_I18N_ATTR_PREFIX); })
            .forEach(function (attr) { return explicitAttrNameToValue.set(attr.name.substring(_I18N_ATTR_PREFIX.length), attr.value); });
        el.attrs.forEach(function (attr) {
            if (explicitAttrNameToValue.has(attr.name)) {
                _this._addMessage(messages, [attr], explicitAttrNameToValue.get(attr.name));
            }
            else if (implicitAttrNames.some(function (name) { return attr.name === name; })) {
                _this._addMessage(messages, [attr]);
            }
        });
    };
    _ExtractVisitor.prototype._addMessage = function (messages, ast, meaningAndDesc) {
        if (ast.length == 0 ||
            ast.length == 1 && ast[0] instanceof html.Attribute && !ast[0].value) {
            // Do not create empty messages
            return;
        }
        var _a = _splitMeaningAndDesc(meaningAndDesc), meaning = _a[0], description = _a[1];
        messages.push(new Message(ast, meaning, description));
    };
    /**
     * Add the node as a child of the block when:
     * - we are in a block,
     * - we are not inside a ICU message (those are handled separately),
     * - the node is a "direct child" of the block
     */
    _ExtractVisitor.prototype._mayBeAddBlockChildren = function (node) {
        if (this._inI18nBlock && !this._inIcu && this._depth == this._blockStartDepth) {
            this._blockChildren.push(node);
        }
    };
    /**
     * Marks the start of a section, see `_endSection`
     */
    _ExtractVisitor.prototype._startSection = function (messages) {
        if (this._sectionStartIndex !== void 0) {
            throw new Error('Unexpected section start');
        }
        this._sectionStartIndex = messages.length;
    };
    /**
     * Terminates a section.
     *
     * If a section has only one significant children (comments not significant) then we should not
     * keep the message
     * from this children:
     *
     * `<p i18n="meaning|description">{ICU message}</p>` would produce two messages:
     * - one for the <p> content with meaning and description,
     * - another one for the ICU message.
     *
     * In this case the last message is discarded as it contains less information (the AST is
     * otherwise identical).
     *
     * Note that we should still keep messages extracted from attributes inside the section (ie in the
     * ICU message here)
     */
    _ExtractVisitor.prototype._endSection = function (messages, directChildren) {
        if (this._sectionStartIndex === void 0) {
            throw new Error('Unexpected section end');
        }
        var startIndex = this._sectionStartIndex;
        var significantChildren = directChildren.reduce(function (count, node) { return count + (node instanceof html.Comment ? 0 : 1); }, 0);
        if (significantChildren == 1) {
            for (var i = startIndex; i < messages.length; i++) {
                var ast = messages[i].nodes;
                if (!(ast.length == 1 && ast[0] instanceof html.Attribute)) {
                    messages.splice(i, 1);
                    break;
                }
            }
        }
        this._sectionStartIndex = void 0;
    };
    _ExtractVisitor.prototype._reportError = function (node, msg) {
        this._errors.push(new parse_util_1.I18nError(node.sourceSpan, msg));
    };
    return _ExtractVisitor;
}());
/**
 * A Message contain a fragment (= a subtree) of the source html AST.
 */
var Message = (function () {
    function Message(nodes, meaning, description) {
        this.nodes = nodes;
        this.meaning = meaning;
        this.description = description;
    }
    return Message;
}());
exports.Message = Message;
function _isOpeningComment(n) {
    return n instanceof html.Comment && n.value && n.value.startsWith('i18n');
}
function _isClosingComment(n) {
    return n instanceof html.Comment && n.value && n.value === '/i18n';
}
function _getI18nAttr(p) {
    return p.attrs.find(function (attr) { return attr.name === _I18N_ATTR; }) || null;
}
function _splitMeaningAndDesc(i18n) {
    if (!i18n)
        return ['', ''];
    var pipeIndex = i18n.indexOf('|');
    return pipeIndex == -1 ? ['', i18n] : [i18n.slice(0, pipeIndex), i18n.slice(pipeIndex + 1)];
}
//# sourceMappingURL=extractor.js.map