/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import * as html from '../ml_parser/ast';
import { ParseTreeResult } from '../ml_parser/parser';
import * as i18n from './i18n_ast';
import { createI18nMessageFactory } from './i18n_parser';
import { I18nError } from './parse_util';
var _I18N_ATTR = 'i18n';
var _I18N_ATTR_PREFIX = 'i18n-';
var _I18N_COMMENT_PREFIX_REGEXP = /^i18n:?/;
var MEANING_SEPARATOR = '|';
var ID_SEPARATOR = '@@';
var i18nCommentsWarned = false;
/**
 * Extract translatable messages from an html AST
 */
export function extractMessages(nodes, interpolationConfig, implicitTags, implicitAttrs) {
    var visitor = new _Visitor(implicitTags, implicitAttrs);
    return visitor.extract(nodes, interpolationConfig);
}
export function mergeTranslations(nodes, translations, interpolationConfig, implicitTags, implicitAttrs) {
    var visitor = new _Visitor(implicitTags, implicitAttrs);
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
var _VisitorMode;
(function (_VisitorMode) {
    _VisitorMode[_VisitorMode["Extract"] = 0] = "Extract";
    _VisitorMode[_VisitorMode["Merge"] = 1] = "Merge";
})(_VisitorMode || (_VisitorMode = {}));
/**
 * This Visitor is used:
 * 1. to extract all the translatable strings from an html AST (see `extract()`),
 * 2. to replace the translatable strings with the actual translations (see `merge()`)
 *
 * @internal
 */
var _Visitor = /** @class */ (function () {
    function _Visitor(_implicitTags, _implicitAttrs) {
        this._implicitTags = _implicitTags;
        this._implicitAttrs = _implicitAttrs;
    }
    /**
     * Extracts the messages from the tree
     */
    _Visitor.prototype.extract = function (nodes, interpolationConfig) {
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
    _Visitor.prototype.merge = function (nodes, translations, interpolationConfig) {
        this._init(_VisitorMode.Merge, interpolationConfig);
        this._translations = translations;
        // Construct a single fake root element
        var wrapper = new html.Element('wrapper', [], nodes, undefined, undefined, undefined);
        var translatedNode = wrapper.visit(this, null);
        if (this._inI18nBlock) {
            this._reportError(nodes[nodes.length - 1], 'Unclosed block');
        }
        return new ParseTreeResult(translatedNode.children, this._errors);
    };
    _Visitor.prototype.visitExpansionCase = function (icuCase, context) {
        // Parse cases for translatable html attributes
        var expression = html.visitAll(this, icuCase.expression, context);
        if (this._mode === _VisitorMode.Merge) {
            return new html.ExpansionCase(icuCase.value, expression, icuCase.sourceSpan, icuCase.valueSourceSpan, icuCase.expSourceSpan);
        }
    };
    _Visitor.prototype.visitExpansion = function (icu, context) {
        this._mayBeAddBlockChildren(icu);
        var wasInIcu = this._inIcu;
        if (!this._inIcu) {
            // nested ICU messages should not be extracted but top-level translated as a whole
            if (this._isInTranslatableSection) {
                this._addMessage([icu]);
            }
            this._inIcu = true;
        }
        var cases = html.visitAll(this, icu.cases, context);
        if (this._mode === _VisitorMode.Merge) {
            icu = new html.Expansion(icu.switchValue, icu.type, cases, icu.sourceSpan, icu.switchValueSourceSpan);
        }
        this._inIcu = wasInIcu;
        return icu;
    };
    _Visitor.prototype.visitComment = function (comment, context) {
        var isOpening = _isOpeningComment(comment);
        if (isOpening && this._isInTranslatableSection) {
            this._reportError(comment, 'Could not start a block inside a translatable section');
            return;
        }
        var isClosing = _isClosingComment(comment);
        if (isClosing && !this._inI18nBlock) {
            this._reportError(comment, 'Trying to close an unopened block');
            return;
        }
        if (!this._inI18nNode && !this._inIcu) {
            if (!this._inI18nBlock) {
                if (isOpening) {
                    // deprecated from v5 you should use <ng-container i18n> instead of i18n comments
                    if (!i18nCommentsWarned && console && console.warn) {
                        i18nCommentsWarned = true;
                        var details = comment.sourceSpan.details ? ", " + comment.sourceSpan.details : '';
                        // TODO(ocombe): use a log service once there is a public one available
                        console.warn("I18n comments are deprecated, use an <ng-container> element instead (" + comment.sourceSpan.start + details + ")");
                    }
                    this._inI18nBlock = true;
                    this._blockStartDepth = this._depth;
                    this._blockChildren = [];
                    this._blockMeaningAndDesc =
                        comment.value.replace(_I18N_COMMENT_PREFIX_REGEXP, '').trim();
                    this._openTranslatableSection(comment);
                }
            }
            else {
                if (isClosing) {
                    if (this._depth == this._blockStartDepth) {
                        this._closeTranslatableSection(comment, this._blockChildren);
                        this._inI18nBlock = false;
                        var message = this._addMessage(this._blockChildren, this._blockMeaningAndDesc);
                        // merge attributes in sections
                        var nodes = this._translateMessage(comment, message);
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
    _Visitor.prototype.visitText = function (text, context) {
        if (this._isInTranslatableSection) {
            this._mayBeAddBlockChildren(text);
        }
        return text;
    };
    _Visitor.prototype.visitElement = function (el, context) {
        var _this = this;
        this._mayBeAddBlockChildren(el);
        this._depth++;
        var wasInI18nNode = this._inI18nNode;
        var wasInImplicitNode = this._inImplicitNode;
        var childNodes = [];
        var translatedChildNodes = undefined;
        // Extract:
        // - top level nodes with the (implicit) "i18n" attribute if not already in a section
        // - ICU messages
        var i18nAttr = _getI18nAttr(el);
        var i18nMeta = i18nAttr ? i18nAttr.value : '';
        var isImplicit = this._implicitTags.some(function (tag) { return el.name === tag; }) && !this._inIcu &&
            !this._isInTranslatableSection;
        var isTopLevelImplicit = !wasInImplicitNode && isImplicit;
        this._inImplicitNode = wasInImplicitNode || isImplicit;
        if (!this._isInTranslatableSection && !this._inIcu) {
            if (i18nAttr || isTopLevelImplicit) {
                this._inI18nNode = true;
                var message = this._addMessage(el.children, i18nMeta);
                translatedChildNodes = this._translateMessage(el, message);
            }
            if (this._mode == _VisitorMode.Extract) {
                var isTranslatable = i18nAttr || isTopLevelImplicit;
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
            var visitNodes = translatedChildNodes || el.children;
            visitNodes.forEach(function (child) {
                var visited = child.visit(_this, context);
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
            var translatedAttrs = this._translateAttributes(el);
            return new html.Element(el.name, translatedAttrs, childNodes, el.sourceSpan, el.startSourceSpan, el.endSourceSpan);
        }
        return null;
    };
    _Visitor.prototype.visitAttribute = function (attribute, context) {
        throw new Error('unreachable code');
    };
    _Visitor.prototype._init = function (mode, interpolationConfig) {
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
    // looks for translatable attributes
    _Visitor.prototype._visitAttributesOf = function (el) {
        var _this = this;
        var explicitAttrNameToValue = {};
        var implicitAttrNames = this._implicitAttrs[el.name] || [];
        el.attrs.filter(function (attr) { return attr.name.startsWith(_I18N_ATTR_PREFIX); })
            .forEach(function (attr) { return explicitAttrNameToValue[attr.name.slice(_I18N_ATTR_PREFIX.length)] =
            attr.value; });
        el.attrs.forEach(function (attr) {
            if (attr.name in explicitAttrNameToValue) {
                _this._addMessage([attr], explicitAttrNameToValue[attr.name]);
            }
            else if (implicitAttrNames.some(function (name) { return attr.name === name; })) {
                _this._addMessage([attr]);
            }
        });
    };
    // add a translatable message
    _Visitor.prototype._addMessage = function (ast, msgMeta) {
        if (ast.length == 0 ||
            ast.length == 1 && ast[0] instanceof html.Attribute && !ast[0].value) {
            // Do not create empty messages
            return null;
        }
        var _a = _parseMessageMeta(msgMeta), meaning = _a.meaning, description = _a.description, id = _a.id;
        var message = this._createI18nMessage(ast, meaning, description, id);
        this._messages.push(message);
        return message;
    };
    // Translates the given message given the `TranslationBundle`
    // This is used for translating elements / blocks - see `_translateAttributes` for attributes
    // no-op when called in extraction mode (returns [])
    _Visitor.prototype._translateMessage = function (el, message) {
        if (message && this._mode === _VisitorMode.Merge) {
            var nodes = this._translations.get(message);
            if (nodes) {
                return nodes;
            }
            this._reportError(el, "Translation unavailable for message id=\"" + this._translations.digest(message) + "\"");
        }
        return [];
    };
    // translate the attributes of an element and remove i18n specific attributes
    _Visitor.prototype._translateAttributes = function (el) {
        var _this = this;
        var attributes = el.attrs;
        var i18nParsedMessageMeta = {};
        attributes.forEach(function (attr) {
            if (attr.name.startsWith(_I18N_ATTR_PREFIX)) {
                i18nParsedMessageMeta[attr.name.slice(_I18N_ATTR_PREFIX.length)] =
                    _parseMessageMeta(attr.value);
            }
        });
        var translatedAttributes = [];
        attributes.forEach(function (attr) {
            if (attr.name === _I18N_ATTR || attr.name.startsWith(_I18N_ATTR_PREFIX)) {
                // strip i18n specific attributes
                return;
            }
            if (attr.value && attr.value != '' && i18nParsedMessageMeta.hasOwnProperty(attr.name)) {
                var _a = i18nParsedMessageMeta[attr.name], meaning = _a.meaning, description = _a.description, id = _a.id;
                var message = _this._createI18nMessage([attr], meaning, description, id);
                var nodes = _this._translations.get(message);
                if (nodes) {
                    if (nodes.length == 0) {
                        translatedAttributes.push(new html.Attribute(attr.name, '', attr.sourceSpan));
                    }
                    else if (nodes[0] instanceof html.Text) {
                        var value = nodes[0].value;
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
     */
    _Visitor.prototype._mayBeAddBlockChildren = function (node) {
        if (this._inI18nBlock && !this._inIcu && this._depth == this._blockStartDepth) {
            this._blockChildren.push(node);
        }
    };
    /**
     * Marks the start of a section, see `_closeTranslatableSection`
     */
    _Visitor.prototype._openTranslatableSection = function (node) {
        if (this._isInTranslatableSection) {
            this._reportError(node, 'Unexpected section start');
        }
        else {
            this._msgCountAtSectionStart = this._messages.length;
        }
    };
    Object.defineProperty(_Visitor.prototype, "_isInTranslatableSection", {
        /**
         * A translatable section could be:
         * - the content of translatable element,
         * - nodes between `<!-- i18n -->` and `<!-- /i18n -->` comments
         */
        get: function () {
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
     */
    _Visitor.prototype._closeTranslatableSection = function (node, directChildren) {
        if (!this._isInTranslatableSection) {
            this._reportError(node, 'Unexpected section end');
            return;
        }
        var startIndex = this._msgCountAtSectionStart;
        var significantChildren = directChildren.reduce(function (count, node) { return count + (node instanceof html.Comment ? 0 : 1); }, 0);
        if (significantChildren == 1) {
            for (var i = this._messages.length - 1; i >= startIndex; i--) {
                var ast = this._messages[i].nodes;
                if (!(ast.length == 1 && ast[0] instanceof i18n.Text)) {
                    this._messages.splice(i, 1);
                    break;
                }
            }
        }
        this._msgCountAtSectionStart = undefined;
    };
    _Visitor.prototype._reportError = function (node, msg) {
        this._errors.push(new I18nError(node.sourceSpan, msg));
    };
    return _Visitor;
}());
function _isOpeningComment(n) {
    return !!(n instanceof html.Comment && n.value && n.value.startsWith('i18n'));
}
function _isClosingComment(n) {
    return !!(n instanceof html.Comment && n.value && n.value === '/i18n');
}
function _getI18nAttr(p) {
    return p.attrs.find(function (attr) { return attr.name === _I18N_ATTR; }) || null;
}
function _parseMessageMeta(i18n) {
    if (!i18n)
        return { meaning: '', description: '', id: '' };
    var idIndex = i18n.indexOf(ID_SEPARATOR);
    var descIndex = i18n.indexOf(MEANING_SEPARATOR);
    var _a = tslib_1.__read((idIndex > -1) ? [i18n.slice(0, idIndex), i18n.slice(idIndex + 2)] : [i18n, ''], 2), meaningAndDesc = _a[0], id = _a[1];
    var _b = tslib_1.__read((descIndex > -1) ?
        [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
        ['', meaningAndDesc], 2), meaning = _b[0], description = _b[1];
    return { meaning: meaning, description: description, id: id };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdG9yX21lcmdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9pMThuL2V4dHJhY3Rvcl9tZXJnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQUVILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFFekMsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUN2RCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBR3ZDLElBQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQztBQUMxQixJQUFNLGlCQUFpQixHQUFHLE9BQU8sQ0FBQztBQUNsQyxJQUFNLDJCQUEyQixHQUFHLFNBQVMsQ0FBQztBQUM5QyxJQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQztBQUM5QixJQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDMUIsSUFBSSxrQkFBa0IsR0FBRyxLQUFLLENBQUM7QUFFL0I7O0dBRUc7QUFDSCxNQUFNLDBCQUNGLEtBQWtCLEVBQUUsbUJBQXdDLEVBQUUsWUFBc0IsRUFDcEYsYUFBc0M7SUFDeEMsSUFBTSxPQUFPLEdBQUcsSUFBSSxRQUFRLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzFELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztBQUNyRCxDQUFDO0FBRUQsTUFBTSw0QkFDRixLQUFrQixFQUFFLFlBQStCLEVBQUUsbUJBQXdDLEVBQzdGLFlBQXNCLEVBQUUsYUFBc0M7SUFDaEUsSUFBTSxPQUFPLEdBQUcsSUFBSSxRQUFRLENBQUMsWUFBWSxFQUFFLGFBQWEs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QzVDLElBQUEsdUdBQzZFLEVBRDVFLHNCQUFjLEVBQUUsVUFBRSxDQUMyRDtJQUM5RSxJQUFBOztnQ0FFa0IsRUFGakIsZUFBTyxFQUFFLG1CQUFXLENBRUY7SUFFekIsT0FBTyxFQUFDLE9BQU8sU0FBQSxFQUFFLFdBQVcsYUFBQSxFQUFFLEVBQUUsSUFBQSxFQUFDLENBQUM7QUFDcEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7SW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7UGFyc2VUcmVlUmVzdWx0fSBmcm9tICcuLi9tbF9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi9pMThuX2FzdCc7XG5pbXBvcnQge2NyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeX0gZnJvbSAnLi9pMThuX3BhcnNlcic7XG5pbXBvcnQge0kxOG5FcnJvcn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7VHJhbnNsYXRpb25CdW5kbGV9IGZyb20gJy4vdHJhbnNsYXRpb25fYnVuZGxlJztcblxuY29uc3QgX0kxOE5fQVRUUiA9ICdpMThuJztcbmNvbnN0IF9JMThOX0FUVFJfUFJFRklYID0gJ2kxOG4tJztcbmNvbnN0IF9JMThOX0NPTU1FTlRfUFJFRklYX1JFR0VYUCA9IC9eaTE4bjo/LztcbmNvbnN0IE1FQU5JTkdfU0VQQVJBVE9SID0gJ3wnO1xuY29uc3QgSURfU0VQQVJBVE9SID0gJ0BAJztcbmxldCBpMThuQ29tbWVudHNXYXJuZWQgPSBmYWxzZTtcblxuLyoqXG4gKiBFeHRyYWN0IHRyYW5zbGF0YWJsZSBtZXNzYWdlcyBmcm9tIGFuIGh0bWwgQVNUXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0TWVzc2FnZXMoXG4gICAgbm9kZXM6IGh0bWwuTm9kZVtdLCBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnLCBpbXBsaWNpdFRhZ3M6IHN0cmluZ1tdLFxuICAgIGltcGxpY2l0QXR0cnM6IHtbazogc3RyaW5nXTogc3RyaW5nW119KTogRXh0cmFjdGlvblJlc3VsdCB7XG4gIGNvbnN0IHZpc2l0b3IgPSBuZXcgX1Zpc2l0b3IoaW1wbGljaXRUYWdzLCBpbXBsaWNpdEF0dHJzKTtcbiAgcmV0dXJuIHZpc2l0b3IuZXh0cmFjdChub2RlcywgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZVRyYW5zbGF0aW9ucyhcbiAgICBub2RlczogaHRtbC5Ob2RlW10sIHRyYW5zbGF0aW9uczogVHJhbnNsYXRpb25CdW5kbGUsIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcsXG4gICAgaW1wbGljaXRUYWdzOiBzdHJpbmdbXSwgaW1wbGljaXRBdHRyczoge1trOiBzdHJpbmddOiBzdHJpbmdbXX0pOiBQYXJzZVRyZWVSZXN1bHQge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9WaXNpdG9yKGltcGxpY2l0VGFncywgaW1wbGljaXRBdHRycyk7XG4gIHJldHVybiB2aXNpdG9yLm1lcmdlKG5vZGVzLCB0cmFuc2xhdGlvbnMsIGludGVycG9sYXRpb25Db25maWcpO1xufVxuXG5leHBvcnQgY2xhc3MgRXh0cmFjdGlvblJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBtZXNzYWdlczogaTE4bi5NZXNzYWdlW10sIHB1YmxpYyBlcnJvcnM6IEkxOG5FcnJvcltdKSB7fVxufVxuXG5lbnVtIF9WaXNpdG9yTW9kZSB7XG4gIEV4dHJhY3QsXG4gIE1lcmdlXG59XG5cbi8qKlxuICogVGhpcyBWaXNpdG9yIGlzIHVzZWQ6XG4gKiAxLiB0byBleHRyYWN0IGFsbCB0aGUgdHJhbnNsYXRhYmxlIHN0cmluZ3MgZnJvbSBhbiBodG1sIEFTVCAoc2VlIGBleHRyYWN0KClgKSxcbiAqIDIuIHRvIHJlcGxhY2UgdGhlIHRyYW5zbGF0YWJsZSBzdHJpbmdzIHdpdGggdGhlIGFjdHVhbCB0cmFuc2xhdGlvbnMgKHNlZSBgbWVyZ2UoKWApXG4gKlxuICogQGludGVybmFsXG4gKi9cbmNsYXNzIF9WaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgcHJpdmF0ZSBfZGVwdGg6IG51bWJlcjtcblxuICAvLyA8ZWwgaTE4bj4uLi48L2VsPlxuICBwcml2YXRlIF9pbkkxOG5Ob2RlOiBib29sZWFuO1xuICBwcml2YXRlIF9pbkltcGxpY2l0Tm9kZTogYm9vbGVhbjtcblxuICAvLyA8IS0taTE4bi0tPi4uLjwhLS0vaTE4bi0tPlxuICBwcml2YXRlIF9pbkkxOG5CbG9jazogYm9vbGVhbjtcbiAgcHJpdmF0ZSBfYmxvY2tNZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICBwcml2YXRlIF9ibG9ja0NoaWxkcmVuOiBodG1sLk5vZGVbXTtcbiAgcHJpdmF0ZSBfYmxvY2tTdGFydERlcHRoOiBudW1iZXI7XG5cbiAgLy8gezxpY3UgbWVzc2FnZT59XG4gIHByaXZhdGUgX2luSWN1OiBib29sZWFuO1xuXG4gIC8vIHNldCB0byB2b2lkIDAgd2hlbiBub3QgaW4gYSBzZWN0aW9uXG4gIHByaXZhdGUgX21zZ0NvdW50QXRTZWN0aW9uU3RhcnQ6IG51bWJlcnx1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2Vycm9yczogSTE4bkVycm9yW107XG4gIHByaXZhdGUgX21vZGU6IF9WaXNpdG9yTW9kZTtcblxuICAvLyBfVmlzaXRvck1vZGUuRXh0cmFjdCBvbmx5XG4gIHByaXZhdGUgX21lc3NhZ2VzOiBpMThuLk1lc3NhZ2VbXTtcblxuICAvLyBfVmlzaXRvck1vZGUuTWVyZ2Ugb25seVxuICBwcml2YXRlIF90cmFuc2xhdGlvbnM6IFRyYW5zbGF0aW9uQnVuZGxlO1xuICBwcml2YXRlIF9jcmVhdGVJMThuTWVzc2FnZTpcbiAgICAgIChtc2c6IGh0bWwuTm9kZVtdLCBtZWFuaW5nOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIGlkOiBzdHJpbmcpID0+IGkxOG4uTWVzc2FnZTtcblxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2ltcGxpY2l0VGFnczogc3RyaW5nW10sIHByaXZhdGUgX2ltcGxpY2l0QXR0cnM6IHtbazogc3RyaW5nXTogc3RyaW5nW119KSB7fVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0cyB0aGUgbWVzc2FnZXMgZnJvbSB0aGUgdHJlZVxuICAgKi9cbiAgZXh0cmFjdChub2RlczogaHRtbC5Ob2RlW10sIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBFeHRyYWN0aW9uUmVzdWx0IHtcbiAgICB0aGlzLl9pbml0KF9WaXNpdG9yTW9kZS5FeHRyYWN0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcblxuICAgIG5vZGVzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMsIG51bGwpKTtcblxuICAgIGlmICh0aGlzLl9pbkkxOG5CbG9jaykge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3Iobm9kZXNbbm9kZXMubGVuZ3RoIC0gMV0sICdVbmNsb3NlZCBibG9jaycpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgRXh0cmFjdGlvblJlc3VsdCh0aGlzLl9tZXNzYWdlcywgdGhpcy5fZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgdHJlZSB3aGVyZSBhbGwgdHJhbnNsYXRhYmxlIG5vZGVzIGFyZSB0cmFuc2xhdGVkXG4gICAqL1xuICBtZXJnZShcbiAgICAgIG5vZGVzOiBodG1sLk5vZGVbXSwgdHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvbkJ1bmRsZSxcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBQYXJzZVRyZWVSZXN1bHQge1xuICAgIHRoaXMuX2luaXQoX1Zpc2l0b3JNb2RlLk1lcmdlLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICB0aGlzLl90cmFuc2xhdGlvbnMgPSB0cmFuc2xhdGlvbnM7XG5cbiAgICAvLyBDb25zdHJ1Y3QgYSBzaW5nbGUgZmFrZSByb290IGVsZW1lbnRcbiAgICBjb25zdCB3cmFwcGVyID0gbmV3IGh0bWwuRWxlbWVudCgnd3JhcHBlcicsIFtdLCBub2RlcywgdW5kZWZpbmVkICEsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblxuICAgIGNvbnN0IHRyYW5zbGF0ZWROb2RlID0gd3JhcHBlci52aXNpdCh0aGlzLCBudWxsKTtcblxuICAgIGlmICh0aGlzLl9pbkkxOG5CbG9jaykge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3Iobm9kZXNbbm9kZXMubGVuZ3RoIC0gMV0sICdVbmNsb3NlZCBibG9jaycpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUGFyc2VUcmVlUmVzdWx0KHRyYW5zbGF0ZWROb2RlLmNoaWxkcmVuLCB0aGlzLl9lcnJvcnMpO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGljdUNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICAvLyBQYXJzZSBjYXNlcyBmb3IgdHJhbnNsYXRhYmxlIGh0bWwgYXR0cmlidXRlc1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBodG1sLnZpc2l0QWxsKHRoaXMsIGljdUNhc2UuZXhwcmVzc2lvbiwgY29udGV4dCk7XG5cbiAgICBpZiAodGhpcy5fbW9kZSA9PT0gX1Zpc2l0b3JNb2RlLk1lcmdlKSB7XG4gICAgICByZXR1cm4gbmV3IGh0bWwuRXhwYW5zaW9uQ2FzZShcbiAgICAgICAgICBpY3VDYXNlLnZhbHVlLCBleHByZXNzaW9uLCBpY3VDYXNlLnNvdXJjZVNwYW4sIGljdUNhc2UudmFsdWVTb3VyY2VTcGFuLFxuICAgICAgICAgIGljdUNhc2UuZXhwU291cmNlU3Bhbik7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oaWN1OiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogaHRtbC5FeHBhbnNpb24ge1xuICAgIHRoaXMuX21heUJlQWRkQmxvY2tDaGlsZHJlbihpY3UpO1xuXG4gICAgY29uc3Qgd2FzSW5JY3UgPSB0aGlzLl9pbkljdTtcblxuICAgIGlmICghdGhpcy5faW5JY3UpIHtcbiAgICAgIC8vIG5lc3RlZCBJQ1UgbWVzc2FnZXMgc2hvdWxkIG5vdCBiZSBleHRyYWN0ZWQgYnV0IHRvcC1sZXZlbCB0cmFuc2xhdGVkIGFzIGEgd2hvbGVcbiAgICAgIGlmICh0aGlzLl9pc0luVHJhbnNsYXRhYmxlU2VjdGlvbikge1xuICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKFtpY3VdKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2luSWN1ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCBjYXNlcyA9IGh0bWwudmlzaXRBbGwodGhpcywgaWN1LmNhc2VzLCBjb250ZXh0KTtcblxuICAgIGlmICh0aGlzLl9tb2RlID09PSBfVmlzaXRvck1vZGUuTWVyZ2UpIHtcbiAgICAgIGljdSA9IG5ldyBodG1sLkV4cGFuc2lvbihcbiAgICAgICAgICBpY3Uuc3dpdGNoVmFsdWUsIGljdS50eXBlLCBjYXNlcywgaWN1LnNvdXJjZVNwYW4sIGljdS5zd2l0Y2hWYWx1ZVNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHRoaXMuX2luSWN1ID0gd2FzSW5JY3U7XG5cbiAgICByZXR1cm4gaWN1O1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBjb25zdCBpc09wZW5pbmcgPSBfaXNPcGVuaW5nQ29tbWVudChjb21tZW50KTtcblxuICAgIGlmIChpc09wZW5pbmcgJiYgdGhpcy5faXNJblRyYW5zbGF0YWJsZVNlY3Rpb24pIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGNvbW1lbnQsICdDb3VsZCBub3Qgc3RhcnQgYSBibG9jayBpbnNpZGUgYSB0cmFuc2xhdGFibGUgc2VjdGlvbicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGlzQ2xvc2luZyA9IF9pc0Nsb3NpbmdDb21tZW50KGNvbW1lbnQpO1xuXG4gICAgaWYgKGlzQ2xvc2luZyAmJiAhdGhpcy5faW5JMThuQmxvY2spIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGNvbW1lbnQsICdUcnlpbmcgdG8gY2xvc2UgYW4gdW5vcGVuZWQgYmxvY2snKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX2luSTE4bk5vZGUgJiYgIXRoaXMuX2luSWN1KSB7XG4gICAgICBpZiAoIXRoaXMuX2luSTE4bkJsb2NrKSB7XG4gICAgICAgIGlmIChpc09wZW5pbmcpIHtcbiAgICAgICAgICAvLyBkZXByZWNhdGVkIGZyb20gdjUgeW91IHNob3VsZCB1c2UgPG5nLWNvbnRhaW5lciBpMThuPiBpbnN0ZWFkIG9mIGkxOG4gY29tbWVudHNcbiAgICAgICAgICBpZiAoIWkxOG5Db21tZW50c1dhcm5lZCAmJiA8YW55PmNvbnNvbGUgJiYgPGFueT5jb25zb2xlLndhcm4pIHtcbiAgICAgICAgICAgIGkxOG5Db21tZW50c1dhcm5lZCA9IHRydWU7XG4gICAgICAgICAgICBjb25zdCBkZXRhaWxzID0gY29tbWVudC5zb3VyY2VTcGFuLmRldGFpbHMgPyBgLCAke2NvbW1lbnQuc291cmNlU3Bhbi5kZXRhaWxzfWAgOiAnJztcbiAgICAgICAgICAgIC8vIFRPRE8ob2NvbWJlKTogdXNlIGEgbG9nIHNlcnZpY2Ugb25jZSB0aGVyZSBpcyBhIHB1YmxpYyBvbmUgYXZhaWxhYmxlXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgYEkxOG4gY29tbWVudHMgYXJlIGRlcHJlY2F0ZWQsIHVzZSBhbiA8bmctY29udGFpbmVyPiBlbGVtZW50IGluc3RlYWQgKCR7Y29tbWVudC5zb3VyY2VTcGFuLnN0YXJ0fSR7ZGV0YWlsc30pYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2luSTE4bkJsb2NrID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLl9ibG9ja1N0YXJ0RGVwdGggPSB0aGlzLl9kZXB0aDtcbiAgICAgICAgICB0aGlzLl9ibG9ja0NoaWxkcmVuID0gW107XG4gICAgICAgICAgdGhpcy5fYmxvY2tNZWFuaW5nQW5kRGVzYyA9XG4gICAgICAgICAgICAgIGNvbW1lbnQudmFsdWUgIS5yZXBsYWNlKF9JMThOX0NPTU1FTlRfUFJFRklYX1JFR0VYUCwgJycpLnRyaW0oKTtcbiAgICAgICAgICB0aGlzLl9vcGVuVHJhbnNsYXRhYmxlU2VjdGlvbihjb21tZW50KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzQ2xvc2luZykge1xuICAgICAgICAgIGlmICh0aGlzLl9kZXB0aCA9PSB0aGlzLl9ibG9ja1N0YXJ0RGVwdGgpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nsb3NlVHJhbnNsYXRhYmxlU2VjdGlvbihjb21tZW50LCB0aGlzLl9ibG9ja0NoaWxkcmVuKTtcbiAgICAgICAgICAgIHRoaXMuX2luSTE4bkJsb2NrID0gZmFsc2U7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fYWRkTWVzc2FnZSh0aGlzLl9ibG9ja0NoaWxkcmVuLCB0aGlzLl9ibG9ja01lYW5pbmdBbmREZXNjKSAhO1xuICAgICAgICAgICAgLy8gbWVyZ2UgYXR0cmlidXRlcyBpbiBzZWN0aW9uc1xuICAgICAgICAgICAgY29uc3Qgbm9kZXMgPSB0aGlzLl90cmFuc2xhdGVNZXNzYWdlKGNvbW1lbnQsIG1lc3NhZ2UpO1xuICAgICAgICAgICAgcmV0dXJuIGh0bWwudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihjb21tZW50LCAnSTE4TiBibG9ja3Mgc2hvdWxkIG5vdCBjcm9zcyBlbGVtZW50IGJvdW5kYXJpZXMnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBjb250ZXh0OiBhbnkpOiBodG1sLlRleHQge1xuICAgIGlmICh0aGlzLl9pc0luVHJhbnNsYXRhYmxlU2VjdGlvbikge1xuICAgICAgdGhpcy5fbWF5QmVBZGRCbG9ja0NoaWxkcmVuKHRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdGV4dDtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbDogaHRtbC5FbGVtZW50LCBjb250ZXh0OiBhbnkpOiBodG1sLkVsZW1lbnR8bnVsbCB7XG4gICAgdGhpcy5fbWF5QmVBZGRCbG9ja0NoaWxkcmVuKGVsKTtcbiAgICB0aGlzLl9kZXB0aCsrO1xuICAgIGNvbnN0IHdhc0luSTE4bk5vZGUgPSB0aGlzLl9pbkkxOG5Ob2RlO1xuICAgIGNvbnN0IHdhc0luSW1wbGljaXROb2RlID0gdGhpcy5faW5JbXBsaWNpdE5vZGU7XG4gICAgbGV0IGNoaWxkTm9kZXM6IGh0bWwuTm9kZVtdID0gW107XG4gICAgbGV0IHRyYW5zbGF0ZWRDaGlsZE5vZGVzOiBodG1sLk5vZGVbXSA9IHVuZGVmaW5lZCAhO1xuXG4gICAgLy8gRXh0cmFjdDpcbiAgICAvLyAtIHRvcCBsZXZlbCBub2RlcyB3aXRoIHRoZSAoaW1wbGljaXQpIFwiaTE4blwiIGF0dHJpYnV0ZSBpZiBub3QgYWxyZWFkeSBpbiBhIHNlY3Rpb25cbiAgICAvLyAtIElDVSBtZXNzYWdlc1xuICAgIGNvbnN0IGkxOG5BdHRyID0gX2dldEkxOG5BdHRyKGVsKTtcbiAgICBjb25zdCBpMThuTWV0YSA9IGkxOG5BdHRyID8gaTE4bkF0dHIudmFsdWUgOiAnJztcbiAgICBjb25zdCBpc0ltcGxpY2l0ID0gdGhpcy5faW1wbGljaXRUYWdzLnNvbWUodGFnID0+IGVsLm5hbWUgPT09IHRhZykgJiYgIXRoaXMuX2luSWN1ICYmXG4gICAgICAgICF0aGlzLl9pc0luVHJhbnNsYXRhYmxlU2VjdGlvbjtcbiAgICBjb25zdCBpc1RvcExldmVsSW1wbGljaXQgPSAhd2FzSW5JbXBsaWNpdE5vZGUgJiYgaXNJbXBsaWNpdDtcbiAgICB0aGlzLl9pbkltcGxpY2l0Tm9kZSA9IHdhc0luSW1wbGljaXROb2RlIHx8IGlzSW1wbGljaXQ7XG5cbiAgICBpZiAoIXRoaXMuX2lzSW5UcmFuc2xhdGFibGVTZWN0aW9uICYmICF0aGlzLl9pbkljdSkge1xuICAgICAgaWYgKGkxOG5BdHRyIHx8IGlzVG9wTGV2ZWxJbXBsaWNpdCkge1xuICAgICAgICB0aGlzLl9pbkkxOG5Ob2RlID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2FkZE1lc3NhZ2UoZWwuY2hpbGRyZW4sIGkxOG5NZXRhKSAhO1xuICAgICAgICB0cmFuc2xhdGVkQ2hpbGROb2RlcyA9IHRoaXMuX3RyYW5zbGF0ZU1lc3NhZ2UoZWwsIG1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fbW9kZSA9PSBfVmlzaXRvck1vZGUuRXh0cmFjdCkge1xuICAgICAgICBjb25zdCBpc1RyYW5zbGF0YWJsZSA9IGkxOG5BdHRyIHx8IGlzVG9wTGV2ZWxJbXBsaWNpdDtcbiAgICAgICAgaWYgKGlzVHJhbnNsYXRhYmxlKSB0aGlzLl9vcGVuVHJhbnNsYXRhYmxlU2VjdGlvbihlbCk7XG4gICAgICAgIGh0bWwudmlzaXRBbGwodGhpcywgZWwuY2hpbGRyZW4pO1xuICAgICAgICBpZiAoaXNUcmFuc2xhdGFibGUpIHRoaXMuX2Nsb3NlVHJhbnNsYXRhYmxlU2VjdGlvbihlbCwgZWwuY2hpbGRyZW4pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaTE4bkF0dHIgfHwgaXNUb3BMZXZlbEltcGxpY2l0KSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgZWwsICdDb3VsZCBub3QgbWFyayBhbiBlbGVtZW50IGFzIHRyYW5zbGF0YWJsZSBpbnNpZGUgYSB0cmFuc2xhdGFibGUgc2VjdGlvbicpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fbW9kZSA9PSBfVmlzaXRvck1vZGUuRXh0cmFjdCkge1xuICAgICAgICAvLyBEZXNjZW5kIGludG8gY2hpbGQgbm9kZXMgZm9yIGV4dHJhY3Rpb25cbiAgICAgICAgaHRtbC52aXNpdEFsbCh0aGlzLCBlbC5jaGlsZHJlbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX21vZGUgPT09IF9WaXNpdG9yTW9kZS5NZXJnZSkge1xuICAgICAgY29uc3QgdmlzaXROb2RlcyA9IHRyYW5zbGF0ZWRDaGlsZE5vZGVzIHx8IGVsLmNoaWxkcmVuO1xuICAgICAgdmlzaXROb2Rlcy5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgY29uc3QgdmlzaXRlZCA9IGNoaWxkLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgICAgICBpZiAodmlzaXRlZCAmJiAhdGhpcy5faXNJblRyYW5zbGF0YWJsZVNlY3Rpb24pIHtcbiAgICAgICAgICAvLyBEbyBub3QgYWRkIHRoZSBjaGlsZHJlbiBmcm9tIHRyYW5zbGF0YWJsZSBzZWN0aW9ucyAoPSBpMThuIGJsb2NrcyBoZXJlKVxuICAgICAgICAgIC8vIFRoZXkgd2lsbCBiZSBhZGRlZCBsYXRlciBpbiB0aGlzIGxvb3Agd2hlbiB0aGUgYmxvY2sgY2xvc2VzIChpLmUuIG9uIGA8IS0tIC9pMThuIC0tPmApXG4gICAgICAgICAgY2hpbGROb2RlcyA9IGNoaWxkTm9kZXMuY29uY2F0KHZpc2l0ZWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLl92aXNpdEF0dHJpYnV0ZXNPZihlbCk7XG5cbiAgICB0aGlzLl9kZXB0aC0tO1xuICAgIHRoaXMuX2luSTE4bk5vZGUgPSB3YXNJbkkxOG5Ob2RlO1xuICAgIHRoaXMuX2luSW1wbGljaXROb2RlID0gd2FzSW5JbXBsaWNpdE5vZGU7XG5cbiAgICBpZiAodGhpcy5fbW9kZSA9PT0gX1Zpc2l0b3JNb2RlLk1lcmdlKSB7XG4gICAgICBjb25zdCB0cmFuc2xhdGVkQXR0cnMgPSB0aGlzLl90cmFuc2xhdGVBdHRyaWJ1dGVzKGVsKTtcbiAgICAgIHJldHVybiBuZXcgaHRtbC5FbGVtZW50KFxuICAgICAgICAgIGVsLm5hbWUsIHRyYW5zbGF0ZWRBdHRycywgY2hpbGROb2RlcywgZWwuc291cmNlU3BhbiwgZWwuc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICAgIGVsLmVuZFNvdXJjZVNwYW4pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bnJlYWNoYWJsZSBjb2RlJyk7XG4gIH1cblxuICBwcml2YXRlIF9pbml0KG1vZGU6IF9WaXNpdG9yTW9kZSwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IHZvaWQge1xuICAgIHRoaXMuX21vZGUgPSBtb2RlO1xuICAgIHRoaXMuX2luSTE4bkJsb2NrID0gZmFsc2U7XG4gICAgdGhpcy5faW5JMThuTm9kZSA9IGZhbHNlO1xuICAgIHRoaXMuX2RlcHRoID0gMDtcbiAgICB0aGlzLl9pbkljdSA9IGZhbHNlO1xuICAgIHRoaXMuX21zZ0NvdW50QXRTZWN0aW9uU3RhcnQgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZXJyb3JzID0gW107XG4gICAgdGhpcy5fbWVzc2FnZXMgPSBbXTtcbiAgICB0aGlzLl9pbkltcGxpY2l0Tm9kZSA9IGZhbHNlO1xuICAgIHRoaXMuX2NyZWF0ZUkxOG5NZXNzYWdlID0gY3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5KGludGVycG9sYXRpb25Db25maWcpO1xuICB9XG5cbiAgLy8gbG9va3MgZm9yIHRyYW5zbGF0YWJsZSBhdHRyaWJ1dGVzXG4gIHByaXZhdGUgX3Zpc2l0QXR0cmlidXRlc09mKGVsOiBodG1sLkVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBleHBsaWNpdEF0dHJOYW1lVG9WYWx1ZToge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgY29uc3QgaW1wbGljaXRBdHRyTmFtZXM6IHN0cmluZ1tdID0gdGhpcy5faW1wbGljaXRBdHRyc1tlbC5uYW1lXSB8fCBbXTtcblxuICAgIGVsLmF0dHJzLmZpbHRlcihhdHRyID0+IGF0dHIubmFtZS5zdGFydHNXaXRoKF9JMThOX0FUVFJfUFJFRklYKSlcbiAgICAgICAgLmZvckVhY2goXG4gICAgICAgICAgICBhdHRyID0+IGV4cGxpY2l0QXR0ck5hbWVUb1ZhbHVlW2F0dHIubmFtZS5zbGljZShfSTE4Tl9BVFRSX1BSRUZJWC5sZW5ndGgpXSA9XG4gICAgICAgICAgICAgICAgYXR0ci52YWx1ZSk7XG5cbiAgICBlbC5hdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgaWYgKGF0dHIubmFtZSBpbiBleHBsaWNpdEF0dHJOYW1lVG9WYWx1ZSkge1xuICAgICAgICB0aGlzLl9hZGRNZXNzYWdlKFthdHRyXSwgZXhwbGljaXRBdHRyTmFtZVRvVmFsdWVbYXR0ci5uYW1lXSk7XG4gICAgICB9IGVsc2UgaWYgKGltcGxpY2l0QXR0ck5hbWVzLnNvbWUobmFtZSA9PiBhdHRyLm5hbWUgPT09IG5hbWUpKSB7XG4gICAgICAgIHRoaXMuX2FkZE1lc3NhZ2UoW2F0dHJdKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIGFkZCBhIHRyYW5zbGF0YWJsZSBtZXNzYWdlXG4gIHByaXZhdGUgX2FkZE1lc3NhZ2UoYXN0OiBodG1sLk5vZGVbXSwgbXNnTWV0YT86IHN0cmluZyk6IGkxOG4uTWVzc2FnZXxudWxsIHtcbiAgICBpZiAoYXN0Lmxlbmd0aCA9PSAwIHx8XG4gICAgICAgIGFzdC5sZW5ndGggPT0gMSAmJiBhc3RbMF0gaW5zdGFuY2VvZiBodG1sLkF0dHJpYnV0ZSAmJiAhKDxodG1sLkF0dHJpYnV0ZT5hc3RbMF0pLnZhbHVlKSB7XG4gICAgICAvLyBEbyBub3QgY3JlYXRlIGVtcHR5IG1lc3NhZ2VzXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB7bWVhbmluZywgZGVzY3JpcHRpb24sIGlkfSA9IF9wYXJzZU1lc3NhZ2VNZXRhKG1zZ01ldGEpO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9jcmVhdGVJMThuTWVzc2FnZShhc3QsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBpZCk7XG4gICAgdGhpcy5fbWVzc2FnZXMucHVzaChtZXNzYWdlKTtcbiAgICByZXR1cm4gbWVzc2FnZTtcbiAgfVxuXG4gIC8vIFRyYW5zbGF0ZXMgdGhlIGdpdmVuIG1lc3NhZ2UgZ2l2ZW4gdGhlIGBUcmFuc2xhdGlvbkJ1bmRsZWBcbiAgLy8gVGhpcyBpcyB1c2VkIGZvciB0cmFuc2xhdGluZyBlbGVtZW50cyAvIGJsb2NrcyAtIHNlZSBgX3RyYW5zbGF0ZUF0dHJpYnV0ZXNgIGZvciBhdHRyaWJ1dGVzXG4gIC8vIG5vLW9wIHdoZW4gY2FsbGVkIGluIGV4dHJhY3Rpb24gbW9kZSAocmV0dXJucyBbXSlcbiAgcHJpdmF0ZSBfdHJhbnNsYXRlTWVzc2FnZShlbDogaHRtbC5Ob2RlLCBtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBodG1sLk5vZGVbXSB7XG4gICAgaWYgKG1lc3NhZ2UgJiYgdGhpcy5fbW9kZSA9PT0gX1Zpc2l0b3JNb2RlLk1lcmdlKSB7XG4gICAgICBjb25zdCBub2RlcyA9IHRoaXMuX3RyYW5zbGF0aW9ucy5nZXQobWVzc2FnZSk7XG5cbiAgICAgIGlmIChub2Rlcykge1xuICAgICAgICByZXR1cm4gbm9kZXM7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGVsLCBgVHJhbnNsYXRpb24gdW5hdmFpbGFibGUgZm9yIG1lc3NhZ2UgaWQ9XCIke3RoaXMuX3RyYW5zbGF0aW9ucy5kaWdlc3QobWVzc2FnZSl9XCJgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gW107XG4gIH1cblxuICAvLyB0cmFuc2xhdGUgdGhlIGF0dHJpYnV0ZXMgb2YgYW4gZWxlbWVudCBhbmQgcmVtb3ZlIGkxOG4gc3BlY2lmaWMgYXR0cmlidXRlc1xuICBwcml2YXRlIF90cmFuc2xhdGVBdHRyaWJ1dGVzKGVsOiBodG1sLkVsZW1lbnQpOiBodG1sLkF0dHJpYnV0ZVtdIHtcbiAgICBjb25zdCBhdHRyaWJ1dGVzID0gZWwuYXR0cnM7XG4gICAgY29uc3QgaTE4blBhcnNlZE1lc3NhZ2VNZXRhOlxuICAgICAgICB7W25hbWU6IHN0cmluZ106IHttZWFuaW5nOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIGlkOiBzdHJpbmd9fSA9IHt9O1xuXG4gICAgYXR0cmlidXRlcy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgaWYgKGF0dHIubmFtZS5zdGFydHNXaXRoKF9JMThOX0FUVFJfUFJFRklYKSkge1xuICAgICAgICBpMThuUGFyc2VkTWVzc2FnZU1ldGFbYXR0ci5uYW1lLnNsaWNlKF9JMThOX0FUVFJfUFJFRklYLmxlbmd0aCldID1cbiAgICAgICAgICAgIF9wYXJzZU1lc3NhZ2VNZXRhKGF0dHIudmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgdHJhbnNsYXRlZEF0dHJpYnV0ZXM6IGh0bWwuQXR0cmlidXRlW10gPSBbXTtcblxuICAgIGF0dHJpYnV0ZXMuZm9yRWFjaCgoYXR0cikgPT4ge1xuICAgICAgaWYgKGF0dHIubmFtZSA9PT0gX0kxOE5fQVRUUiB8fCBhdHRyLm5hbWUuc3RhcnRzV2l0aChfSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgLy8gc3RyaXAgaTE4biBzcGVjaWZpYyBhdHRyaWJ1dGVzXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGF0dHIudmFsdWUgJiYgYXR0ci52YWx1ZSAhPSAnJyAmJiBpMThuUGFyc2VkTWVzc2FnZU1ldGEuaGFzT3duUHJvcGVydHkoYXR0ci5uYW1lKSkge1xuICAgICAgICBjb25zdCB7bWVhbmluZywgZGVzY3JpcHRpb24sIGlkfSA9IGkxOG5QYXJzZWRNZXNzYWdlTWV0YVthdHRyLm5hbWVdO1xuICAgICAgICBjb25zdCBtZXNzYWdlOiBpMThuLk1lc3NhZ2UgPSB0aGlzLl9jcmVhdGVJMThuTWVzc2FnZShbYXR0cl0sIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBpZCk7XG4gICAgICAgIGNvbnN0IG5vZGVzID0gdGhpcy5fdHJhbnNsYXRpb25zLmdldChtZXNzYWdlKTtcbiAgICAgICAgaWYgKG5vZGVzKSB7XG4gICAgICAgICAgaWYgKG5vZGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICB0cmFuc2xhdGVkQXR0cmlidXRlcy5wdXNoKG5ldyBodG1sLkF0dHJpYnV0ZShhdHRyLm5hbWUsICcnLCBhdHRyLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG5vZGVzWzBdIGluc3RhbmNlb2YgaHRtbC5UZXh0KSB7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IChub2Rlc1swXSBhcyBodG1sLlRleHQpLnZhbHVlO1xuICAgICAgICAgICAgdHJhbnNsYXRlZEF0dHJpYnV0ZXMucHVzaChuZXcgaHRtbC5BdHRyaWJ1dGUoYXR0ci5uYW1lLCB2YWx1ZSwgYXR0ci5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAgIGVsLFxuICAgICAgICAgICAgICAgIGBVbmV4cGVjdGVkIHRyYW5zbGF0aW9uIGZvciBhdHRyaWJ1dGUgXCIke2F0dHIubmFtZX1cIiAoaWQ9XCIke2lkIHx8IHRoaXMuX3RyYW5zbGF0aW9ucy5kaWdlc3QobWVzc2FnZSl9XCIpYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBlbCxcbiAgICAgICAgICAgICAgYFRyYW5zbGF0aW9uIHVuYXZhaWxhYmxlIGZvciBhdHRyaWJ1dGUgXCIke2F0dHIubmFtZX1cIiAoaWQ9XCIke2lkIHx8IHRoaXMuX3RyYW5zbGF0aW9ucy5kaWdlc3QobWVzc2FnZSl9XCIpYCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyYW5zbGF0ZWRBdHRyaWJ1dGVzLnB1c2goYXR0cik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHJhbnNsYXRlZEF0dHJpYnV0ZXM7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBBZGQgdGhlIG5vZGUgYXMgYSBjaGlsZCBvZiB0aGUgYmxvY2sgd2hlbjpcbiAgICogLSB3ZSBhcmUgaW4gYSBibG9jayxcbiAgICogLSB3ZSBhcmUgbm90IGluc2lkZSBhIElDVSBtZXNzYWdlICh0aG9zZSBhcmUgaGFuZGxlZCBzZXBhcmF0ZWx5KSxcbiAgICogLSB0aGUgbm9kZSBpcyBhIFwiZGlyZWN0IGNoaWxkXCIgb2YgdGhlIGJsb2NrXG4gICAqL1xuICBwcml2YXRlIF9tYXlCZUFkZEJsb2NrQ2hpbGRyZW4obm9kZTogaHRtbC5Ob2RlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2luSTE4bkJsb2NrICYmICF0aGlzLl9pbkljdSAmJiB0aGlzLl9kZXB0aCA9PSB0aGlzLl9ibG9ja1N0YXJ0RGVwdGgpIHtcbiAgICAgIHRoaXMuX2Jsb2NrQ2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWFya3MgdGhlIHN0YXJ0IG9mIGEgc2VjdGlvbiwgc2VlIGBfY2xvc2VUcmFuc2xhdGFibGVTZWN0aW9uYFxuICAgKi9cbiAgcHJpdmF0ZSBfb3BlblRyYW5zbGF0YWJsZVNlY3Rpb24obm9kZTogaHRtbC5Ob2RlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2lzSW5UcmFuc2xhdGFibGVTZWN0aW9uKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihub2RlLCAnVW5leHBlY3RlZCBzZWN0aW9uIHN0YXJ0Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX21zZ0NvdW50QXRTZWN0aW9uU3RhcnQgPSB0aGlzLl9tZXNzYWdlcy5sZW5ndGg7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEEgdHJhbnNsYXRhYmxlIHNlY3Rpb24gY291bGQgYmU6XG4gICAqIC0gdGhlIGNvbnRlbnQgb2YgdHJhbnNsYXRhYmxlIGVsZW1lbnQsXG4gICAqIC0gbm9kZXMgYmV0d2VlbiBgPCEtLSBpMThuIC0tPmAgYW5kIGA8IS0tIC9pMThuIC0tPmAgY29tbWVudHNcbiAgICovXG4gIHByaXZhdGUgZ2V0IF9pc0luVHJhbnNsYXRhYmxlU2VjdGlvbigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5fbXNnQ291bnRBdFNlY3Rpb25TdGFydCAhPT0gdm9pZCAwO1xuICB9XG5cbiAgLyoqXG4gICAqIFRlcm1pbmF0ZXMgYSBzZWN0aW9uLlxuICAgKlxuICAgKiBJZiBhIHNlY3Rpb24gaGFzIG9ubHkgb25lIHNpZ25pZmljYW50IGNoaWxkcmVuIChjb21tZW50cyBub3Qgc2lnbmlmaWNhbnQpIHRoZW4gd2Ugc2hvdWxkIG5vdFxuICAgKiBrZWVwIHRoZSBtZXNzYWdlIGZyb20gdGhpcyBjaGlsZHJlbjpcbiAgICpcbiAgICogYDxwIGkxOG49XCJtZWFuaW5nfGRlc2NyaXB0aW9uXCI+e0lDVSBtZXNzYWdlfTwvcD5gIHdvdWxkIHByb2R1Y2UgdHdvIG1lc3NhZ2VzOlxuICAgKiAtIG9uZSBmb3IgdGhlIDxwPiBjb250ZW50IHdpdGggbWVhbmluZyBhbmQgZGVzY3JpcHRpb24sXG4gICAqIC0gYW5vdGhlciBvbmUgZm9yIHRoZSBJQ1UgbWVzc2FnZS5cbiAgICpcbiAgICogSW4gdGhpcyBjYXNlIHRoZSBsYXN0IG1lc3NhZ2UgaXMgZGlzY2FyZGVkIGFzIGl0IGNvbnRhaW5zIGxlc3MgaW5mb3JtYXRpb24gKHRoZSBBU1QgaXNcbiAgICogb3RoZXJ3aXNlIGlkZW50aWNhbCkuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB3ZSBzaG91bGQgc3RpbGwga2VlcCBtZXNzYWdlcyBleHRyYWN0ZWQgZnJvbSBhdHRyaWJ1dGVzIGluc2lkZSB0aGUgc2VjdGlvbiAoaWUgaW4gdGhlXG4gICAqIElDVSBtZXNzYWdlIGhlcmUpXG4gICAqL1xuICBwcml2YXRlIF9jbG9zZVRyYW5zbGF0YWJsZVNlY3Rpb24obm9kZTogaHRtbC5Ob2RlLCBkaXJlY3RDaGlsZHJlbjogaHRtbC5Ob2RlW10pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2lzSW5UcmFuc2xhdGFibGVTZWN0aW9uKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihub2RlLCAnVW5leHBlY3RlZCBzZWN0aW9uIGVuZCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXJ0SW5kZXggPSB0aGlzLl9tc2dDb3VudEF0U2VjdGlvblN0YXJ0O1xuICAgIGNvbnN0IHNpZ25pZmljYW50Q2hpbGRyZW46IG51bWJlciA9IGRpcmVjdENoaWxkcmVuLnJlZHVjZShcbiAgICAgICAgKGNvdW50OiBudW1iZXIsIG5vZGU6IGh0bWwuTm9kZSk6IG51bWJlciA9PiBjb3VudCArIChub2RlIGluc3RhbmNlb2YgaHRtbC5Db21tZW50ID8gMCA6IDEpLFxuICAgICAgICAwKTtcblxuICAgIGlmIChzaWduaWZpY2FudENoaWxkcmVuID09IDEpIHtcbiAgICAgIGZvciAobGV0IGkgPSB0aGlzLl9tZXNzYWdlcy5sZW5ndGggLSAxOyBpID49IHN0YXJ0SW5kZXggITsgaS0tKSB7XG4gICAgICAgIGNvbnN0IGFzdCA9IHRoaXMuX21lc3NhZ2VzW2ldLm5vZGVzO1xuICAgICAgICBpZiAoIShhc3QubGVuZ3RoID09IDEgJiYgYXN0WzBdIGluc3RhbmNlb2YgaTE4bi5UZXh0KSkge1xuICAgICAgICAgIHRoaXMuX21lc3NhZ2VzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX21zZ0NvdW50QXRTZWN0aW9uU3RhcnQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihub2RlOiBodG1sLk5vZGUsIG1zZzogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5fZXJyb3JzLnB1c2gobmV3IEkxOG5FcnJvcihub2RlLnNvdXJjZVNwYW4gISwgbXNnKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2lzT3BlbmluZ0NvbW1lbnQobjogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiAhIShuIGluc3RhbmNlb2YgaHRtbC5Db21tZW50ICYmIG4udmFsdWUgJiYgbi52YWx1ZS5zdGFydHNXaXRoKCdpMThuJykpO1xufVxuXG5mdW5jdGlvbiBfaXNDbG9zaW5nQ29tbWVudChuOiBodG1sLk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuICEhKG4gaW5zdGFuY2VvZiBodG1sLkNvbW1lbnQgJiYgbi52YWx1ZSAmJiBuLnZhbHVlID09PSAnL2kxOG4nKTtcbn1cblxuZnVuY3Rpb24gX2dldEkxOG5BdHRyKHA6IGh0bWwuRWxlbWVudCk6IGh0bWwuQXR0cmlidXRlfG51bGwge1xuICByZXR1cm4gcC5hdHRycy5maW5kKGF0dHIgPT4gYXR0ci5uYW1lID09PSBfSTE4Tl9BVFRSKSB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiBfcGFyc2VNZXNzYWdlTWV0YShpMThuPzogc3RyaW5nKToge21lYW5pbmc6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZywgaWQ6IHN0cmluZ30ge1xuICBpZiAoIWkxOG4pIHJldHVybiB7bWVhbmluZzogJycsIGRlc2NyaXB0aW9uOiAnJywgaWQ6ICcnfTtcblxuICBjb25zdCBpZEluZGV4ID0gaTE4bi5pbmRleE9mKElEX1NFUEFSQVRPUik7XG4gIGNvbnN0IGRlc2NJbmRleCA9IGkxOG4uaW5kZXhPZihNRUFOSU5HX1NFUEFSQVRPUik7XG4gIGNvbnN0IFttZWFuaW5nQW5kRGVzYywgaWRdID1cbiAgICAgIChpZEluZGV4ID4gLTEpID8gW2kxOG4uc2xpY2UoMCwgaWRJbmRleCksIGkxOG4uc2xpY2UoaWRJbmRleCArIDIpXSA6IFtpMThuLCAnJ107XG4gIGNvbnN0IFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPSAoZGVzY0luZGV4ID4gLTEpID9cbiAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG5cbiAgcmV0dXJuIHttZWFuaW5nLCBkZXNjcmlwdGlvbiwgaWR9O1xufVxuIl19