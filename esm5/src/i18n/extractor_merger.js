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
import * as html from '../ml_parser/ast';
import { ParseTreeResult } from '../ml_parser/parser';
import * as i18n from './i18n_ast';
import { createI18nMessageFactory } from './i18n_parser';
import { I18nError } from './parse_util';
var /** @type {?} */ _I18N_ATTR = 'i18n';
var /** @type {?} */ _I18N_ATTR_PREFIX = 'i18n-';
var /** @type {?} */ _I18N_COMMENT_PREFIX_REGEXP = /^i18n:?/;
var /** @type {?} */ MEANING_SEPARATOR = '|';
var /** @type {?} */ ID_SEPARATOR = '@@';
var /** @type {?} */ i18nCommentsWarned = false;
/**
 * Extract translatable messages from an html AST
 * @param {?} nodes
 * @param {?} interpolationConfig
 * @param {?} implicitTags
 * @param {?} implicitAttrs
 * @return {?}
 */
export function extractMessages(nodes, interpolationConfig, implicitTags, implicitAttrs) {
    var /** @type {?} */ visitor = new _Visitor(implicitTags, implicitAttrs);
    return visitor.extract(nodes, interpolationConfig);
}
/**
 * @param {?} nodes
 * @param {?} translations
 * @param {?} interpolationConfig
 * @param {?} implicitTags
 * @param {?} implicitAttrs
 * @return {?}
 */
export function mergeTranslations(nodes, translations, interpolationConfig, implicitTags, implicitAttrs) {
    var /** @type {?} */ visitor = new _Visitor(implicitTags, implicitAttrs);
    return visitor.merge(nodes, translations, interpolationConfig);
}
var ExtractionResult = /** @class */ (function () {
    function ExtractionResult(messages, errors) {
        this.messages = messages;
        this.errors = errors;
    }
    return ExtractionResult;
}());
export { ExtractionResult };
function ExtractionResult_tsickle_Closure_declarations() {
    /** @type {?} */
    ExtractionResult.prototype.messages;
    /** @type {?} */
    ExtractionResult.prototype.errors;
}
/** @enum {number} */
var _VisitorMode = {
    Extract: 0,
    Merge: 1,
};
_VisitorMode[_VisitorMode.Extract] = "Extract";
_VisitorMode[_VisitorMode.Merge] = "Merge";
/**
 * This Visitor is used:
 * 1. to extract all the translatable strings from an html AST (see `extract()`),
 * 2. to replace the translatable strings with the actual translations (see `merge()`)
 *
 * \@internal
 */
var /**
 * This Visitor is used:
 * 1. to extract all the translatable strings from an html AST (see `extract()`),
 * 2. to replace the translatable strings with the actual translations (see `merge()`)
 *
 * \@internal
 */
_Visitor = /** @class */ (function () {
    function _Visitor(_implicitTags, _implicitAttrs) {
        this._implicitTags = _implicitTags;
        this._implicitAttrs = _implicitAttrs;
    }
    /**
     * Extracts the messages from the tree
     */
    /**
     * Extracts the messages from the tree
     * @param {?} nodes
     * @param {?} interpolationConfig
     * @return {?}
     */
    _Visitor.prototype.extract = /**
     * Extracts the messages from the tree
     * @param {?} nodes
     * @param {?} interpolationConfig
     * @return {?}
     */
    function (nodes, interpolationConfig) {
        var _this = this;
        this._init(_VisitorMode.Extract, interpolationConfig);
        nodes.forEach(function (node) { return node.visit(_this, null); });
        if (this._inI18nBlock) {
            this._reportError(nodes[nodes.length - 1], 'Unclosed block');
        }
        return new ExtractionResult(this._messages, this._errors);
    };
    /**
     * Returns a tree where all translatable nodes are translated
     */
    /**
     * Returns a tree where all translatable nodes are translated
     * @param {?} nodes
     * @param {?} translations
     * @param {?} interpolationConfig
     * @return {?}
     */
    _Visitor.prototype.merge = /**
     * Returns a tree where all translatable nodes are translated
     * @param {?} nodes
     * @param {?} translations
     * @param {?} interpolationConfig
     * @return {?}
     */
    function (nodes, translations, interpolationConfig) {
        this._init(_VisitorMode.Merge, interpolationConfig);
        this._translations = translations;
        // Construct a single fake root element
        var /** @type {?} */ wrapper = new html.Element('wrapper', [], nodes, /** @type {?} */ ((undefined)), undefined, undefined);
        var /** @type {?} */ translatedNode = wrapper.visit(this, null);
        if (this._inI18nBlock) {
            this._reportError(nodes[nodes.length - 1], 'Unclosed block');
        }
        return new ParseTreeResult(translatedNode.children, this._errors);
    };
    /**
     * @param {?} icuCase
     * @param {?} context
     * @return {?}
     */
    _Visitor.prototype.visitExpansionCase = /**
     * @param {?} icuCase
     * @param {?} context
     * @return {?}
     */
    function (icuCase, context) {
        // Parse cases for translatable html attributes
        var /** @type {?} */ expression = html.visitAll(this, icuCase.expression, context);
        if (this._mode === _VisitorMode.Merge) {
            return new html.ExpansionCase(icuCase.value, expression, icuCase.sourceSpan, icuCase.valueSourceSpan, icuCase.expSourceSpan);
        }
    };
    /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    _Visitor.prototype.visitExpansion = /**
     * @param {?} icu
     * @param {?} context
     * @return {?}
     */
    function (icu, context) {
        this._mayBeAddBlockChildren(icu);
        var /** @type {?} */ wasInIcu = this._inIcu;
        if (!this._inIcu) {
            // nested ICU messages should not be extracted but top-level translated as a whole
            if (this._isInTranslatableSection) {
                this._addMessage([icu]);
            }
            this._inIcu = true;
        }
        var /** @type {?} */ cases = html.visitAll(this, icu.cases, context);
        if (this._mode === _VisitorMode.Merge) {
            icu = new html.Expansion(icu.switchValue, icu.type, cases, icu.sourceSpan, icu.switchValueSourceSpan);
        }
        this._inIcu = wasInIcu;
        return icu;
    };
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    _Visitor.prototype.visitComment = /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    function (comment, context) {
        var /** @type {?} */ isOpening = _isOpeningComment(comment);
        if (isOpening && this._isInTranslatableSection) {
            this._reportError(comment, 'Could not start a block inside a translatable section');
            return;
        }
        var /** @type {?} */ isClosing = _isClosingComment(comment);
        if (isClosing && !this._inI18nBlock) {
            this._reportError(comment, 'Trying to close an unopened block');
            return;
        }
        if (!this._inI18nNode && !this._inIcu) {
            if (!this._inI18nBlock) {
                if (isOpening) {
                    // deprecated from v5 you should use <ng-container i18n> instead of i18n comments
                    if (!i18nCommentsWarned && /** @type {?} */ (console) && /** @type {?} */ (console.warn)) {
                        i18nCommentsWarned = true;
                        var /** @type {?} */ details = comment.sourceSpan.details ? ", " + comment.sourceSpan.details : '';
                        // TODO(ocombe): use a log service once there is a public one available
                        console.warn("I18n comments are deprecated, use an <ng-container> element instead (" + comment.sourceSpan.start + details + ")");
                    }
                    this._inI18nBlock = true;
                    this._blockStartDepth = this._depth;
                    this._blockChildren = [];
                    this._blockMeaningAndDesc = /** @type {?} */ ((comment.value)).replace(_I18N_COMMENT_PREFIX_REGEXP, '').trim();
                    this._openTranslatableSection(comment);
                }
            }
            else {
                if (isClosing) {
                    if (this._depth == this._blockStartDepth) {
                        this._closeTranslatableSection(comment, this._blockChildren);
                        this._inI18nBlock = false;
                        var /** @type {?} */ message = /** @type {?} */ ((this._addMessage(this._blockChildren, this._blockMeaningAndDesc)));
                        // merge attributes in sections
                        var /** @type {?} */ nodes = this._translateMessage(comment, message);
                        return html.visitAll(this, nodes);
                    }
                    else {
                        this._reportError(comment, 'I18N blocks should not cross element boundaries');
                        return;
                    }
                }
            }
        }
    };
    /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    _Visitor.prototype.visitText = /**
     * @param {?} text
     * @param {?} context
     * @return {?}
     */
    function (text, context) {
        if (this._isInTranslatableSection) {
            this._mayBeAddBlockChildren(text);
        }
        return text;
    };
    /**
     * @param {?} el
     * @param {?} context
     * @return {?}
     */
    _Visitor.prototype.visitElement = /**
     * @param {?} el
     * @param {?} context
     * @return {?}
     */
    function (el, context) {
        var _this = this;
        this._mayBeAddBlockChildren(el);
        this._depth++;
        var /** @type {?} */ wasInI18nNode = this._inI18nNode;
        var /** @type {?} */ wasInImplicitNode = this._inImplicitNode;
        var /** @type {?} */ childNodes = [];
        var /** @type {?} */ translatedChildNodes = /** @type {?} */ ((undefined));
        // Extract:
        // - top level nodes with the (implicit) "i18n" attribute if not already in a section
        // - ICU messages
        var /** @type {?} */ i18nAttr = _getI18nAttr(el);
        var /** @type {?} */ i18nMeta = i18nAttr ? i18nAttr.value : '';
        var /** @type {?} */ isImplicit = this._implicitTags.some(function (tag) { return el.name === tag; }) && !this._inIcu &&
            !this._isInTranslatableSection;
        var /** @type {?} */ isTopLevelImplicit = !wasInImplicitNode && isImplicit;
        this._inImplicitNode = wasInImplicitNode || isImplicit;
        if (!this._isInTranslatableSection && !this._inIcu) {
            if (i18nAttr || isTopLevelImplicit) {
                this._inI18nNode = true;
                var /** @type {?} */ message = /** @type {?} */ ((this._addMessage(el.children, i18nMeta)));
                translatedChildNodes = this._translateMessage(el, message);
            }
            if (this._mode == _VisitorMode.Extract) {
                var /** @type {?} */ isTranslatable = i18nAttr || isTopLevelImplicit;
                if (isTranslatable)
                    this._openTranslatableSection(el);
                html.visitAll(this, el.children);
                if (isTranslatable)
                    this._closeTranslatableSection(el, el.children);
            }
        }
        else {
            if (i18nAttr || isTopLevelImplicit) {
                this._reportError(el, 'Could not mark an element as translatable inside a translatable section');
            }
            if (this._mode == _VisitorMode.Extract) {
                // Descend into child nodes for extraction
                html.visitAll(this, el.children);
            }
        }
        if (this._mode === _VisitorMode.Merge) {
            var /** @type {?} */ visitNodes = translatedChildNodes || el.children;
            visitNodes.forEach(function (child) {
                var /** @type {?} */ visited = child.visit(_this, context);
                if (visited && !_this._isInTranslatableSection) {
                    // Do not add the children from translatable sections (= i18n blocks here)
                    // They will be added later in this loop when the block closes (i.e. on `<!-- /i18n -->`)
                    childNodes = childNodes.concat(visited);
                }
            });
        }
        this._visitAttributesOf(el);
        this._depth--;
        this._inI18nNode = wasInI18nNode;
        this._inImplicitNode = wasInImplicitNode;
        if (this._mode === _VisitorMode.Merge) {
            var /** @type {?} */ translatedAttrs = this._translateAttributes(el);
            return new html.Element(el.name, translatedAttrs, childNodes, el.sourceSpan, el.startSourceSpan, el.endSourceSpan);
        }
        return null;
    };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    _Visitor.prototype.visitAttribute = /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    function (attribute, context) {
        throw new Error('unreachable code');
    };
    /**
     * @param {?} mode
     * @param {?} interpolationConfig
     * @return {?}
     */
    _Visitor.prototype._init = /**
     * @param {?} mode
     * @param {?} interpolationConfig
     * @return {?}
     */
    function (mode, interpolationConfig) {
        this._mode = mode;
        this._inI18nBlock = false;
        this._inI18nNode = false;
        this._depth = 0;
        this._inIcu = false;
        this._msgCountAtSectionStart = undefined;
        this._errors = [];
        this._messages = [];
        this._inImplicitNode = false;
        this._createI18nMessage = createI18nMessageFactory(interpolationConfig);
    };
    /**
     * @param {?} el
     * @return {?}
     */
    _Visitor.prototype._visitAttributesOf = /**
     * @param {?} el
     * @return {?}
     */
    function (el) {
        var _this = this;
        var /** @type {?} */ explicitAttrNameToValue = {};
        var /** @type {?} */ implicitAttrNames = this._implicitAttrs[el.name] || [];
        el.attrs.filter(function (attr) { return attr.name.startsWith(_I18N_ATTR_PREFIX); })
            .forEach(function (attr) {
            return explicitAttrNameToValue[attr.name.slice(_I18N_ATTR_PREFIX.length)] =
                attr.value;
        });
        el.attrs.forEach(function (attr) {
            if (attr.name in explicitAttrNameToValue) {
                _this._addMessage([attr], explicitAttrNameToValue[attr.name]);
            }
            else if (implicitAttrNames.some(function (name) { return attr.name === name; })) {
                _this._addMessage([attr]);
            }
        });
    };
    /**
     * @param {?} ast
     * @param {?=} msgMeta
     * @return {?}
     */
    _Visitor.prototype._addMessage = /**
     * @param {?} ast
     * @param {?=} msgMeta
     * @return {?}
     */
    function (ast, msgMeta) {
        if (ast.length == 0 ||
            ast.length == 1 && ast[0] instanceof html.Attribute && !(/** @type {?} */ (ast[0])).value) {
            // Do not create empty messages
            return null;
        }
        var _a = _parseMessageMeta(msgMeta), meaning = _a.meaning, description = _a.description, id = _a.id;
        var /** @type {?} */ message = this._createI18nMessage(ast, meaning, description, id);
        this._messages.push(message);
        return message;
    };
    /**
     * @param {?} el
     * @param {?} message
     * @return {?}
     */
    _Visitor.prototype._translateMessage = /**
     * @param {?} el
     * @param {?} message
     * @return {?}
     */
    function (el, message) {
        if (message && this._mode === _VisitorMode.Merge) {
            var /** @type {?} */ nodes = this._translations.get(message);
            if (nodes) {
                return nodes;
            }
            this._reportError(el, "Translation unavailable for message id=\"" + this._translations.digest(message) + "\"");
        }
        return [];
    };
    /**
     * @param {?} el
     * @return {?}
     */
    _Visitor.prototype._translateAttributes = /**
     * @param {?} el
     * @return {?}
     */
    function (el) {
        var _this = this;
        var /** @type {?} */ attributes = el.attrs;
        var /** @type {?} */ i18nParsedMessageMeta = {};
        attributes.forEach(function (attr) {
            if (attr.name.startsWith(_I18N_ATTR_PREFIX)) {
                i18nParsedMessageMeta[attr.name.slice(_I18N_ATTR_PREFIX.length)] =
                    _parseMessageMeta(attr.value);
            }
        });
        var /** @type {?} */ translatedAttributes = [];
        attributes.forEach(function (attr) {
            if (attr.name === _I18N_ATTR || attr.name.startsWith(_I18N_ATTR_PREFIX)) {
                // strip i18n specific attributes
                return;
            }
            if (attr.value && attr.value != '' && i18nParsedMessageMeta.hasOwnProperty(attr.name)) {
                var _a = i18nParsedMessageMeta[attr.name], meaning = _a.meaning, description = _a.description, id = _a.id;
                var /** @type {?} */ message = _this._createI18nMessage([attr], meaning, description, id);
                var /** @type {?} */ nodes = _this._translations.get(message);
                if (nodes) {
                    if (nodes.length == 0) {
                        translatedAttributes.push(new html.Attribute(attr.name, '', attr.sourceSpan));
                    }
                    else if (nodes[0] instanceof html.Text) {
                        var /** @type {?} */ value = (/** @type {?} */ (nodes[0])).value;
                        translatedAttributes.push(new html.Attribute(attr.name, value, attr.sourceSpan));
                    }
                    else {
                        _this._reportError(el, "Unexpected translation for attribute \"" + attr.name + "\" (id=\"" + (id || _this._translations.digest(message)) + "\")");
                    }
                }
                else {
                    _this._reportError(el, "Translation unavailable for attribute \"" + attr.name + "\" (id=\"" + (id || _this._translations.digest(message)) + "\")");
                }
            }
            else {
                translatedAttributes.push(attr);
            }
        });
        return translatedAttributes;
    };
    /**
     * Add the node as a child of the block when:
     * - we are in a block,
     * - we are not inside a ICU message (those are handled separately),
     * - the node is a "direct child" of the block
     * @param {?} node
     * @return {?}
     */
    _Visitor.prototype._mayBeAddBlockChildren = /**
     * Add the node as a child of the block when:
     * - we are in a block,
     * - we are not inside a ICU message (those are handled separately),
     * - the node is a "direct child" of the block
     * @param {?} node
     * @return {?}
     */
    function (node) {
        if (this._inI18nBlock && !this._inIcu && this._depth == this._blockStartDepth) {
            this._blockChildren.push(node);
        }
    };
    /**
     * Marks the start of a section, see `_closeTranslatableSection`
     * @param {?} node
     * @return {?}
     */
    _Visitor.prototype._openTranslatableSection = /**
     * Marks the start of a section, see `_closeTranslatableSection`
     * @param {?} node
     * @return {?}
     */
    function (node) {
        if (this._isInTranslatableSection) {
            this._reportError(node, 'Unexpected section start');
        }
        else {
            this._msgCountAtSectionStart = this._messages.length;
        }
    };
    Object.defineProperty(_Visitor.prototype, "_isInTranslatableSection", {
        get: /**
         * A translatable section could be:
         * - the content of translatable element,
         * - nodes between `<!-- i18n -->` and `<!-- /i18n -->` comments
         * @return {?}
         */
        function () {
            return this._msgCountAtSectionStart !== void 0;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Terminates a section.
     *
     * If a section has only one significant children (comments not significant) then we should not
     * keep the message from this children:
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
     * @param {?} node
     * @param {?} directChildren
     * @return {?}
     */
    _Visitor.prototype._closeTranslatableSection = /**
     * Terminates a section.
     *
     * If a section has only one significant children (comments not significant) then we should not
     * keep the message from this children:
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
     * @param {?} node
     * @param {?} directChildren
     * @return {?}
     */
    function (node, directChildren) {
        if (!this._isInTranslatableSection) {
            this._reportError(node, 'Unexpected section end');
            return;
        }
        var /** @type {?} */ startIndex = this._msgCountAtSectionStart;
        var /** @type {?} */ significantChildren = directChildren.reduce(function (count, node) { return count + (node instanceof html.Comment ? 0 : 1); }, 0);
        if (significantChildren == 1) {
            for (var /** @type {?} */ i = this._messages.length - 1; i >= /** @type {?} */ ((startIndex)); i--) {
                var /** @type {?} */ ast = this._messages[i].nodes;
                if (!(ast.length == 1 && ast[0] instanceof i18n.Text)) {
                    this._messages.splice(i, 1);
                    break;
                }
            }
        }
        this._msgCountAtSectionStart = undefined;
    };
    /**
     * @param {?} node
     * @param {?} msg
     * @return {?}
     */
    _Visitor.prototype._reportError = /**
     * @param {?} node
     * @param {?} msg
     * @return {?}
     */
    function (node, msg) {
        this._errors.push(new I18nError(/** @type {?} */ ((node.sourceSpan)), msg));
    };
    return _Visitor;
}());
function _Visitor_tsickle_Closure_declarations() {
    /** @type {?} */
    _Visitor.prototype._depth;
    /** @type {?} */
    _Visitor.prototype._inI18nNode;
    /** @type {?} */
    _Visitor.prototype._inImplicitNode;
    /** @type {?} */
    _Visitor.prototype._inI18nBlock;
    /** @type {?} */
    _Visitor.prototype._blockMeaningAndDesc;
    /** @type {?} */
    _Visitor.prototype._blockChildren;
    /** @type {?} */
    _Visitor.prototype._blockStartDepth;
    /** @type {?} */
    _Visitor.prototype._inIcu;
    /** @type {?} */
    _Visitor.prototype._msgCountAtSectionStart;
    /** @type {?} */
    _Visitor.prototype._errors;
    /** @type {?} */
    _Visitor.prototype._mode;
    /** @type {?} */
    _Visitor.prototype._messages;
    /** @type {?} */
    _Visitor.prototype._translations;
    /** @type {?} */
    _Visitor.prototype._createI18nMessage;
    /** @type {?} */
    _Visitor.prototype._implicitTags;
    /** @type {?} */
    _Visitor.prototype._implicitAttrs;
}
/**
 * @param {?} n
 * @return {?}
 */
function _isOpeningComment(n) {
    return !!(n instanceof html.Comment && n.value && n.value.startsWith('i18n'));
}
/**
 * @param {?} n
 * @return {?}
 */
function _isClosingComment(n) {
    return !!(n instanceof html.Comment && n.value && n.value === '/i18n');
}
/**
 * @param {?} p
 * @return {?}
 */
function _getI18nAttr(p) {
    return p.attrs.find(function (attr) { return attr.name === _I18N_ATTR; }) || null;
}
/**
 * @param {?=} i18n
 * @return {?}
 */
function _parseMessageMeta(i18n) {
    if (!i18n)
        return { meaning: '', description: '', id: '' };
    var /** @type {?} */ idIndex = i18n.indexOf(ID_SEPARATOR);
    var /** @type {?} */ descIndex = i18n.indexOf(MEANING_SEPARATOR);
    var _a = (idIndex > -1) ? [i18n.slice(0, idIndex), i18n.slice(idIndex + 2)] : [i18n, ''], meaningAndDesc = _a[0], id = _a[1];
    var _b = (descIndex > -1) ?
        [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
        ['', meaningAndDesc], meaning = _b[0], description = _b[1];
    return { meaning: meaning, description: description, id: id };
}
//# sourceMappingURL=extractor_merger.js.map