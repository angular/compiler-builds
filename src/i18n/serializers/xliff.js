/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/i18n/serializers/xliff", ["require", "exports", "tslib", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/xml_parser", "@angular/compiler/src/i18n/digest", "@angular/compiler/src/i18n/i18n_ast", "@angular/compiler/src/i18n/parse_util", "@angular/compiler/src/i18n/serializers/serializer", "@angular/compiler/src/i18n/serializers/xml_helper"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Xliff = void 0;
    var tslib_1 = require("tslib");
    var ml = require("@angular/compiler/src/ml_parser/ast");
    var xml_parser_1 = require("@angular/compiler/src/ml_parser/xml_parser");
    var digest_1 = require("@angular/compiler/src/i18n/digest");
    var i18n = require("@angular/compiler/src/i18n/i18n_ast");
    var parse_util_1 = require("@angular/compiler/src/i18n/parse_util");
    var serializer_1 = require("@angular/compiler/src/i18n/serializers/serializer");
    var xml = require("@angular/compiler/src/i18n/serializers/xml_helper");
    var _VERSION = '1.2';
    var _XMLNS = 'urn:oasis:names:tc:xliff:document:1.2';
    // TODO(vicb): make this a param (s/_/-/)
    var _DEFAULT_SOURCE_LANG = 'en';
    var _PLACEHOLDER_TAG = 'x';
    var _MARKER_TAG = 'mrk';
    var _FILE_TAG = 'file';
    var _SOURCE_TAG = 'source';
    var _SEGMENT_SOURCE_TAG = 'seg-source';
    var _ALT_TRANS_TAG = 'alt-trans';
    var _TARGET_TAG = 'target';
    var _UNIT_TAG = 'trans-unit';
    var _CONTEXT_GROUP_TAG = 'context-group';
    var _CONTEXT_TAG = 'context';
    // http://docs.oasis-open.org/xliff/v1.2/os/xliff-core.html
    // http://docs.oasis-open.org/xliff/v1.2/xliff-profile-html/xliff-profile-html-1.2.html
    var Xliff = /** @class */ (function (_super) {
        tslib_1.__extends(Xliff, _super);
        function Xliff() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Xliff.prototype.write = function (messages, locale) {
            var visitor = new _WriteVisitor();
            var transUnits = [];
            messages.forEach(function (message) {
                var _a;
                var contextTags = [];
                message.sources.forEach(function (source) {
                    var contextGroupTag = new xml.Tag(_CONTEXT_GROUP_TAG, { purpose: 'location' });
                    contextGroupTag.children.push(new xml.CR(10), new xml.Tag(_CONTEXT_TAG, { 'context-type': 'sourcefile' }, [new xml.Text(source.filePath)]), new xml.CR(10), new xml.Tag(_CONTEXT_TAG, { 'context-type': 'linenumber' }, [new xml.Text("" + source.startLine)]), new xml.CR(8));
                    contextTags.push(new xml.CR(8), contextGroupTag);
                });
                var transUnit = new xml.Tag(_UNIT_TAG, { id: message.id, datatype: 'html' });
                (_a = transUnit.children).push.apply(_a, tslib_1.__spread([new xml.CR(8), new xml.Tag(_SOURCE_TAG, {}, visitor.serialize(message.nodes))], contextTags));
                if (message.description) {
                    transUnit.children.push(new xml.CR(8), new xml.Tag('note', { priority: '1', from: 'description' }, [new xml.Text(message.description)]));
                }
                if (message.meaning) {
                    transUnit.children.push(new xml.CR(8), new xml.Tag('note', { priority: '1', from: 'meaning' }, [new xml.Text(message.meaning)]));
                }
                transUnit.children.push(new xml.CR(6));
                transUnits.push(new xml.CR(6), transUnit);
            });
            var body = new xml.Tag('body', {}, tslib_1.__spread(transUnits, [new xml.CR(4)]));
            var file = new xml.Tag('file', {
                'source-language': locale || _DEFAULT_SOURCE_LANG,
                datatype: 'plaintext',
                original: 'ng2.template',
            }, [new xml.CR(4), body, new xml.CR(2)]);
            var xliff = new xml.Tag('xliff', { version: _VERSION, xmlns: _XMLNS }, [new xml.CR(2), file, new xml.CR()]);
            return xml.serialize([
                new xml.Declaration({ version: '1.0', encoding: 'UTF-8' }), new xml.CR(), xliff, new xml.CR()
            ]);
        };
        Xliff.prototype.load = function (content, url) {
            // xliff to xml nodes
            var xliffParser = new XliffParser();
            var _a = xliffParser.parse(content, url), locale = _a.locale, msgIdToHtml = _a.msgIdToHtml, errors = _a.errors;
            // xml nodes to i18n nodes
            var i18nNodesByMsgId = {};
            var converter = new XmlToI18n();
            Object.keys(msgIdToHtml).forEach(function (msgId) {
                var _a = converter.convert(msgIdToHtml[msgId], url), i18nNodes = _a.i18nNodes, e = _a.errors;
                errors.push.apply(errors, tslib_1.__spread(e));
                i18nNodesByMsgId[msgId] = i18nNodes;
            });
            if (errors.length) {
                throw new Error("xliff parse errors:\n" + errors.join('\n'));
            }
            return { locale: locale, i18nNodesByMsgId: i18nNodesByMsgId };
        };
        Xliff.prototype.digest = function (message) {
            return digest_1.digest(message);
        };
        return Xliff;
    }(serializer_1.Serializer));
    exports.Xliff = Xliff;
    var _WriteVisitor = /** @class */ (function () {
        function _WriteVisitor() {
        }
        _WriteVisitor.prototype.visitText = function (text, context) {
            return [new xml.Text(text.value)];
        };
        _WriteVisitor.prototype.visitContainer = function (container, context) {
            var _this = this;
            var nodes = [];
            container.children.forEach(function (node) { return nodes.push.apply(nodes, tslib_1.__spread(node.visit(_this))); });
            return nodes;
        };
        _WriteVisitor.prototype.visitIcu = function (icu, context) {
            var _this = this;
            var nodes = [new xml.Text("{" + icu.expressionPlaceholder + ", " + icu.type + ", ")];
            Object.keys(icu.cases).forEach(function (c) {
                nodes.push.apply(nodes, tslib_1.__spread([new xml.Text(c + " {")], icu.cases[c].visit(_this), [new xml.Text("} ")]));
            });
            nodes.push(new xml.Text("}"));
            return nodes;
        };
        _WriteVisitor.prototype.visitTagPlaceholder = function (ph, context) {
            var ctype = getCtypeForTag(ph.tag);
            if (ph.isVoid) {
                // void tags have no children nor closing tags
                return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.startName, ctype: ctype, 'equiv-text': "<" + ph.tag + "/>" })];
            }
            var startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { id: ph.startName, ctype: ctype, 'equiv-text': "<" + ph.tag + ">" });
            var closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { id: ph.closeName, ctype: ctype, 'equiv-text': "</" + ph.tag + ">" });
            return tslib_1.__spread([startTagPh], this.serialize(ph.children), [closeTagPh]);
        };
        _WriteVisitor.prototype.visitPlaceholder = function (ph, context) {
            return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.name, 'equiv-text': "{{" + ph.value + "}}" })];
        };
        _WriteVisitor.prototype.visitIcuPlaceholder = function (ph, context) {
            var equivText = "{" + ph.value.expression + ", " + ph.value.type + ", " + Object.keys(ph.value.cases).map(function (value) { return value + ' {...}'; }).join(' ') + "}";
            return [new xml.Tag(_PLACEHOLDER_TAG, { id: ph.name, 'equiv-text': equivText })];
        };
        _WriteVisitor.prototype.serialize = function (nodes) {
            var _this = this;
            return [].concat.apply([], tslib_1.__spread(nodes.map(function (node) { return node.visit(_this); })));
        };
        return _WriteVisitor;
    }());
    // TODO(vicb): add error management (structure)
    // Extract messages as xml nodes from the xliff file
    var XliffParser = /** @class */ (function () {
        function XliffParser() {
            this._locale = null;
        }
        XliffParser.prototype.parse = function (xliff, url) {
            this._unitMlString = null;
            this._msgIdToHtml = {};
            var xml = new xml_parser_1.XmlParser().parse(xliff, url);
            this._errors = xml.errors;
            ml.visitAll(this, xml.rootNodes, null);
            return {
                msgIdToHtml: this._msgIdToHtml,
                errors: this._errors,
                locale: this._locale,
            };
        };
        XliffParser.prototype.visitElement = function (element, context) {
            switch (element.name) {
                case _UNIT_TAG:
                    this._unitMlString = null;
                    var idAttr = element.attrs.find(function (attr) { return attr.name === 'id'; });
                    if (!idAttr) {
                        this._addError(element, "<" + _UNIT_TAG + "> misses the \"id\" attribute");
                    }
                    else {
                        var id = idAttr.value;
                        if (this._msgIdToHtml.hasOwnProperty(id)) {
                            this._addError(element, "Duplicated translations for msg " + id);
                        }
                        else {
                            ml.visitAll(this, element.children, null);
                            if (typeof this._unitMlString === 'string') {
                                this._msgIdToHtml[id] = this._unitMlString;
                            }
                            else {
                                this._addError(element, "Message " + id + " misses a translation");
                            }
                        }
                    }
                    break;
                // ignore those tags
                case _SOURCE_TAG:
                case _SEGMENT_SOURCE_TAG:
                case _ALT_TRANS_TAG:
                    break;
                case _TARGET_TAG:
                    var innerTextStart = element.startSourceSpan.end.offset;
                    var innerTextEnd = element.endSourceSpan.start.offset;
                    var content = element.startSourceSpan.start.file.content;
                    var innerText = content.slice(innerTextStart, innerTextEnd);
                    this._unitMlString = innerText;
                    break;
                case _FILE_TAG:
                    var localeAttr = element.attrs.find(function (attr) { return attr.name === 'target-language'; });
                    if (localeAttr) {
                        this._locale = localeAttr.value;
                    }
                    ml.visitAll(this, element.children, null);
                    break;
                default:
                    // TODO(vicb): assert file structure, xliff version
                    // For now only recurse on unhandled nodes
                    ml.visitAll(this, element.children, null);
            }
        };
        XliffParser.prototype.visitAttribute = function (attribute, context) { };
        XliffParser.prototype.visitText = function (text, context) { };
        XliffParser.prototype.visitComment = function (comment, context) { };
        XliffParser.prototype.visitExpansion = function (expansion, context) { };
        XliffParser.prototype.visitExpansionCase = function (expansionCase, context) { };
        XliffParser.prototype._addError = function (node, message) {
            this._errors.push(new parse_util_1.I18nError(node.sourceSpan, message));
        };
        return XliffParser;
    }());
    // Convert ml nodes (xliff syntax) to i18n nodes
    var XmlToI18n = /** @class */ (function () {
        function XmlToI18n() {
        }
        XmlToI18n.prototype.convert = function (message, url) {
            var xmlIcu = new xml_parser_1.XmlParser().parse(message, url, { tokenizeExpansionForms: true });
            this._errors = xmlIcu.errors;
            var i18nNodes = this._errors.length > 0 || xmlIcu.rootNodes.length == 0 ?
                [] : [].concat.apply([], tslib_1.__spread(ml.visitAll(this, xmlIcu.rootNodes)));
            return {
                i18nNodes: i18nNodes,
                errors: this._errors,
            };
        };
        XmlToI18n.prototype.visitText = function (text, context) {
            return new i18n.Text(text.value, text.sourceSpan);
        };
        XmlToI18n.prototype.visitElement = function (el, context) {
            if (el.name === _PLACEHOLDER_TAG) {
                var nameAttr = el.attrs.find(function (attr) { return attr.name === 'id'; });
                if (nameAttr) {
                    return new i18n.Placeholder('', nameAttr.value, el.sourceSpan);
                }
                this._addError(el, "<" + _PLACEHOLDER_TAG + "> misses the \"id\" attribute");
                return null;
            }
            if (el.name === _MARKER_TAG) {
                return [].concat.apply([], tslib_1.__spread(ml.visitAll(this, el.children)));
            }
            this._addError(el, "Unexpected tag");
            return null;
        };
        XmlToI18n.prototype.visitExpansion = function (icu, context) {
            var caseMap = {};
            ml.visitAll(this, icu.cases).forEach(function (c) {
                caseMap[c.value] = new i18n.Container(c.nodes, icu.sourceSpan);
            });
            return new i18n.Icu(icu.switchValue, icu.type, caseMap, icu.sourceSpan);
        };
        XmlToI18n.prototype.visitExpansionCase = function (icuCase, context) {
            return {
                value: icuCase.value,
                nodes: ml.visitAll(this, icuCase.expression),
            };
        };
        XmlToI18n.prototype.visitComment = function (comment, context) { };
        XmlToI18n.prototype.visitAttribute = function (attribute, context) { };
        XmlToI18n.prototype._addError = function (node, message) {
            this._errors.push(new parse_util_1.I18nError(node.sourceSpan, message));
        };
        return XmlToI18n;
    }());
    function getCtypeForTag(tag) {
        switch (tag.toLowerCase()) {
            case 'br':
                return 'lb';
            case 'img':
                return 'image';
            default:
                return "x-" + tag;
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieGxpZmYuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9zZXJpYWxpemVycy94bGlmZi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsd0RBQTBDO0lBQzFDLHlFQUFxRDtJQUNyRCw0REFBaUM7SUFDakMsMERBQW9DO0lBQ3BDLG9FQUF3QztJQUV4QyxnRkFBd0M7SUFDeEMsdUVBQW9DO0lBRXBDLElBQU0sUUFBUSxHQUFHLEtBQUssQ0FBQztJQUN2QixJQUFNLE1BQU0sR0FBRyx1Q0FBdUMsQ0FBQztJQUN2RCx5Q0FBeUM7SUFDekMsSUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUM7SUFDbEMsSUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7SUFDN0IsSUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDO0lBRTFCLElBQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQztJQUN6QixJQUFNLFdBQVcsR0FBRyxRQUFRLENBQUM7SUFDN0IsSUFBTSxtQkFBbUIsR0FBRyxZQUFZLENBQUM7SUFDekMsSUFBTSxjQUFjLEdBQUcsV0FBVyxDQUFDO0lBQ25DLElBQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQztJQUM3QixJQUFNLFNBQVMsR0FBRyxZQUFZLENBQUM7SUFDL0IsSUFBTSxrQkFBa0IsR0FBRyxlQUFlLENBQUM7SUFDM0MsSUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDO0lBRS9CLDJEQUEyRDtJQUMzRCx1RkFBdUY7SUFDdkY7UUFBMkIsaUNBQVU7UUFBckM7O1FBcUZBLENBQUM7UUFwRkMscUJBQUssR0FBTCxVQUFNLFFBQXdCLEVBQUUsTUFBbUI7WUFDakQsSUFBTSxPQUFPLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNwQyxJQUFNLFVBQVUsR0FBZSxFQUFFLENBQUM7WUFFbEMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxV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ZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtYbWxQYXJzZXJ9IGZyb20gJy4uLy4uL21sX3BhcnNlci94bWxfcGFyc2VyJztcbmltcG9ydCB7ZGlnZXN0fSBmcm9tICcuLi9kaWdlc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi9pMThuX2FzdCc7XG5pbXBvcnQge0kxOG5FcnJvcn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCB7U2VyaWFsaXplcn0gZnJvbSAnLi9zZXJpYWxpemVyJztcbmltcG9ydCAqIGFzIHhtbCBmcm9tICcuL3htbF9oZWxwZXInO1xuXG5jb25zdCBfVkVSU0lPTiA9ICcxLjInO1xuY29uc3QgX1hNTE5TID0gJ3VybjpvYXNpczpuYW1lczp0Yzp4bGlmZjpkb2N1bWVudDoxLjInO1xuLy8gVE9ETyh2aWNiKTogbWFrZSB0aGlzIGEgcGFyYW0gKHMvXy8tLylcbmNvbnN0IF9ERUZBVUxUX1NPVVJDRV9MQU5HID0gJ2VuJztcbmNvbnN0IF9QTEFDRUhPTERFUl9UQUcgPSAneCc7XG5jb25zdCBfTUFSS0VSX1RBRyA9ICdtcmsnO1xuXG5jb25zdCBfRklMRV9UQUcgPSAnZmlsZSc7XG5jb25zdCBfU09VUkNFX1RBRyA9ICdzb3VyY2UnO1xuY29uc3QgX1NFR01FTlRfU09VUkNFX1RBRyA9ICdzZWctc291cmNlJztcbmNvbnN0IF9BTFRfVFJBTlNfVEFHID0gJ2FsdC10cmFucyc7XG5jb25zdCBfVEFSR0VUX1RBRyA9ICd0YXJnZXQnO1xuY29uc3QgX1VOSVRfVEFHID0gJ3RyYW5zLXVuaXQnO1xuY29uc3QgX0NPTlRFWFRfR1JPVVBfVEFHID0gJ2NvbnRleHQtZ3JvdXAnO1xuY29uc3QgX0NPTlRFWFRfVEFHID0gJ2NvbnRleHQnO1xuXG4vLyBodHRwOi8vZG9jcy5vYXNpcy1vcGVuLm9yZy94bGlmZi92MS4yL29zL3hsaWZmLWNvcmUuaHRtbFxuLy8gaHR0cDovL2RvY3Mub2FzaXMtb3Blbi5vcmcveGxpZmYvdjEuMi94bGlmZi1wcm9maWxlLWh0bWwveGxpZmYtcHJvZmlsZS1odG1sLTEuMi5odG1sXG5leHBvcnQgY2xhc3MgWGxpZmYgZXh0ZW5kcyBTZXJpYWxpemVyIHtcbiAgd3JpdGUobWVzc2FnZXM6IGkxOG4uTWVzc2FnZVtdLCBsb2NhbGU6IHN0cmluZ3xudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCB2aXNpdG9yID0gbmV3IF9Xcml0ZVZpc2l0b3IoKTtcbiAgICBjb25zdCB0cmFuc1VuaXRzOiB4bWwuTm9kZVtdID0gW107XG5cbiAgICBtZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4ge1xuICAgICAgbGV0IGNvbnRleHRUYWdzOiB4bWwuTm9kZVtdID0gW107XG4gICAgICBtZXNzYWdlLnNvdXJjZXMuZm9yRWFjaCgoc291cmNlOiBpMThuLk1lc3NhZ2VTcGFuKSA9PiB7XG4gICAgICAgIGxldCBjb250ZXh0R3JvdXBUYWcgPSBuZXcgeG1sLlRhZyhfQ09OVEVYVF9HUk9VUF9UQUcsIHtwdXJwb3NlOiAnbG9jYXRpb24nfSk7XG4gICAgICAgIGNvbnRleHRHcm91cFRhZy5jaGlsZHJlbi5wdXNoKFxuICAgICAgICAgICAgbmV3IHhtbC5DUigxMCksXG4gICAgICAgICAgICBuZXcgeG1sLlRhZyhcbiAgICAgICAgICAgICAgICBfQ09OVEVYVF9UQUcsIHsnY29udGV4dC10eXBlJzogJ3NvdXJjZWZpbGUnfSwgW25ldyB4bWwuVGV4dChzb3VyY2UuZmlsZVBhdGgpXSksXG4gICAgICAgICAgICBuZXcgeG1sLkNSKDEwKSxcbiAgICAgICAgICAgIG5ldyB4bWwuVGFnKF9DT05URVhUX1RBRywgeydjb250ZXh0LXR5cGUnOiAnbGluZW51bWJlcid9LCBbbmV3IHhtbC5UZXh0KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHtzb3VyY2Uuc3RhcnRMaW5lfWApXSksXG4gICAgICAgICAgICBuZXcgeG1sLkNSKDgpKTtcbiAgICAgICAgY29udGV4dFRhZ3MucHVzaChuZXcgeG1sLkNSKDgpLCBjb250ZXh0R3JvdXBUYWcpO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHRyYW5zVW5pdCA9IG5ldyB4bWwuVGFnKF9VTklUX1RBRywge2lkOiBtZXNzYWdlLmlkLCBkYXRhdHlwZTogJ2h0bWwnfSk7XG4gICAgICB0cmFuc1VuaXQuY2hpbGRyZW4ucHVzaChcbiAgICAgICAgICBuZXcgeG1sLkNSKDgpLCBuZXcgeG1sLlRhZyhfU09VUkNFX1RBRywge30sIHZpc2l0b3Iuc2VyaWFsaXplKG1lc3NhZ2Uubm9kZXMpKSxcbiAgICAgICAgICAuLi5jb250ZXh0VGFncyk7XG5cbiAgICAgIGlmIChtZXNzYWdlLmRlc2NyaXB0aW9uKSB7XG4gICAgICAgIHRyYW5zVW5pdC5jaGlsZHJlbi5wdXNoKFxuICAgICAgICAgICAgbmV3IHhtbC5DUig4KSxcbiAgICAgICAgICAgIG5ldyB4bWwuVGFnKFxuICAgICAgICAgICAgICAgICdub3RlJywge3ByaW9yaXR5OiAnMScsIGZyb206ICdkZXNjcmlwdGlvbid9LCBbbmV3IHhtbC5UZXh0KG1lc3NhZ2UuZGVzY3JpcHRpb24pXSkpO1xuICAgICAgfVxuXG4gICAgICBpZiAobWVzc2FnZS5tZWFuaW5nKSB7XG4gICAgICAgIHRyYW5zVW5pdC5jaGlsZHJlbi5wdXNoKFxuICAgICAgICAgICAgbmV3IHhtbC5DUig4KSxcbiAgICAgICAgICAgIG5ldyB4bWwuVGFnKCdub3RlJywge3ByaW9yaXR5OiAnMScsIGZyb206ICdtZWFuaW5nJ30sIFtuZXcgeG1sLlRleHQobWVzc2FnZS5tZWFuaW5nKV0pKTtcbiAgICAgIH1cblxuICAgICAgdHJhbnNVbml0LmNoaWxkcmVuLnB1c2gobmV3IHhtbC5DUig2KSk7XG5cbiAgICAgIHRyYW5zVW5pdHMucHVzaChuZXcgeG1sLkNSKDYpLCB0cmFuc1VuaXQpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgYm9keSA9IG5ldyB4bWwuVGFnKCdib2R5Jywge30sIFsuLi50cmFuc1VuaXRzLCBuZXcgeG1sLkNSKDQpXSk7XG4gICAgY29uc3QgZmlsZSA9IG5ldyB4bWwuVGFnKFxuICAgICAgICAnZmlsZScsIHtcbiAgICAgICAgICAnc291cmNlLWxhbmd1YWdlJzogbG9jYWxlIHx8IF9ERUZBVUxUX1NPVVJDRV9MQU5HLFxuICAgICAgICAgIGRhdGF0eXBlOiAncGxhaW50ZXh0JyxcbiAgICAgICAgICBvcmlnaW5hbDogJ25nMi50ZW1wbGF0ZScsXG4gICAgICAgIH0sXG4gICAgICAgIFtuZXcgeG1sLkNSKDQpLCBib2R5LCBuZXcgeG1sLkNSKDIpXSk7XG4gICAgY29uc3QgeGxpZmYgPSBuZXcgeG1sLlRhZyhcbiAgICAgICAgJ3hsaWZmJywge3ZlcnNpb246IF9WRVJTSU9OLCB4bWxuczogX1hNTE5TfSwgW25ldyB4bWwuQ1IoMiksIGZpbGUsIG5ldyB4bWwuQ1IoKV0pO1xuXG4gICAgcmV0dXJuIHhtbC5zZXJpYWxpemUoW1xuICAgICAgbmV3IHhtbC5EZWNsYXJhdGlvbih7dmVyc2lvbjogJzEuMCcsIGVuY29kaW5nOiAnVVRGLTgnfSksIG5ldyB4bWwuQ1IoKSwgeGxpZmYsIG5ldyB4bWwuQ1IoKVxuICAgIF0pO1xuICB9XG5cbiAgbG9hZChjb250ZW50OiBzdHJpbmcsIHVybDogc3RyaW5nKTpcbiAgICAgIHtsb2NhbGU6IHN0cmluZywgaTE4bk5vZGVzQnlNc2dJZDoge1ttc2dJZDogc3RyaW5nXTogaTE4bi5Ob2RlW119fSB7XG4gICAgLy8geGxpZmYgdG8geG1sIG5vZGVzXG4gICAgY29uc3QgeGxpZmZQYXJzZXIgPSBuZXcgWGxpZmZQYXJzZXIoKTtcbiAgICBjb25zdCB7bG9jYWxlLCBtc2dJZFRvSHRtbCwgZXJyb3JzfSA9IHhsaWZmUGFyc2VyLnBhcnNlKGNvbnRlbnQsIHVybCk7XG5cbiAgICAvLyB4bWwgbm9kZXMgdG8gaTE4biBub2Rlc1xuICAgIGNvbnN0IGkxOG5Ob2Rlc0J5TXNnSWQ6IHtbbXNnSWQ6IHN0cmluZ106IGkxOG4uTm9kZVtdfSA9IHt9O1xuICAgIGNvbnN0IGNvbnZlcnRlciA9IG5ldyBYbWxUb0kxOG4oKTtcblxuICAgIE9iamVjdC5rZXlzKG1zZ0lkVG9IdG1sKS5mb3JFYWNoKG1zZ0lkID0+IHtcbiAgICAgIGNvbnN0IHtpMThuTm9kZXMsIGVycm9yczogZX0gPSBjb252ZXJ0ZXIuY29udmVydChtc2dJZFRvSHRtbFttc2dJZF0sIHVybCk7XG4gICAgICBlcnJvcnMucHVzaCguLi5lKTtcbiAgICAgIGkxOG5Ob2Rlc0J5TXNnSWRbbXNnSWRdID0gaTE4bk5vZGVzO1xuICAgIH0pO1xuXG4gICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgeGxpZmYgcGFyc2UgZXJyb3JzOlxcbiR7ZXJyb3JzLmpvaW4oJ1xcbicpfWApO1xuICAgIH1cblxuICAgIHJldHVybiB7bG9jYWxlOiBsb2NhbGUhLCBpMThuTm9kZXNCeU1zZ0lkfTtcbiAgfVxuXG4gIGRpZ2VzdChtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIHJldHVybiBkaWdlc3QobWVzc2FnZSk7XG4gIH1cbn1cblxuY2xhc3MgX1dyaXRlVmlzaXRvciBpbXBsZW1lbnRzIGkxOG4uVmlzaXRvciB7XG4gIHZpc2l0VGV4dCh0ZXh0OiBpMThuLlRleHQsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICByZXR1cm4gW25ldyB4bWwuVGV4dCh0ZXh0LnZhbHVlKV07XG4gIH1cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IGkxOG4uQ29udGFpbmVyLCBjb250ZXh0PzogYW55KTogeG1sLk5vZGVbXSB7XG4gICAgY29uc3Qgbm9kZXM6IHhtbC5Ob2RlW10gPSBbXTtcbiAgICBjb250YWluZXIuY2hpbGRyZW4uZm9yRWFjaCgobm9kZTogaTE4bi5Ob2RlKSA9PiBub2Rlcy5wdXNoKC4uLm5vZGUudmlzaXQodGhpcykpKTtcbiAgICByZXR1cm4gbm9kZXM7XG4gIH1cblxuICB2aXNpdEljdShpY3U6IGkxOG4uSWN1LCBjb250ZXh0PzogYW55KTogeG1sLk5vZGVbXSB7XG4gICAgY29uc3Qgbm9kZXMgPSBbbmV3IHhtbC5UZXh0KGB7JHtpY3UuZXhwcmVzc2lvblBsYWNlaG9sZGVyfSwgJHtpY3UudHlwZX0sIGApXTtcblxuICAgIE9iamVjdC5rZXlzKGljdS5jYXNlcykuZm9yRWFjaCgoYzogc3RyaW5nKSA9PiB7XG4gICAgICBub2Rlcy5wdXNoKG5ldyB4bWwuVGV4dChgJHtjfSB7YCksIC4uLmljdS5jYXNlc1tjXS52aXNpdCh0aGlzKSwgbmV3IHhtbC5UZXh0KGB9IGApKTtcbiAgICB9KTtcblxuICAgIG5vZGVzLnB1c2gobmV3IHhtbC5UZXh0KGB9YCkpO1xuXG4gICAgcmV0dXJuIG5vZGVzO1xuICB9XG5cbiAgdmlzaXRUYWdQbGFjZWhvbGRlcihwaDogaTE4bi5UYWdQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IHhtbC5Ob2RlW10ge1xuICAgIGNvbnN0IGN0eXBlID0gZ2V0Q3R5cGVGb3JUYWcocGgudGFnKTtcblxuICAgIGlmIChwaC5pc1ZvaWQpIHtcbiAgICAgIC8vIHZvaWQgdGFncyBoYXZlIG5vIGNoaWxkcmVuIG5vciBjbG9zaW5nIHRhZ3NcbiAgICAgIHJldHVybiBbbmV3IHhtbC5UYWcoXG4gICAgICAgICAgX1BMQUNFSE9MREVSX1RBRywge2lkOiBwaC5zdGFydE5hbWUsIGN0eXBlLCAnZXF1aXYtdGV4dCc6IGA8JHtwaC50YWd9Lz5gfSldO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXJ0VGFnUGggPVxuICAgICAgICBuZXcgeG1sLlRhZyhfUExBQ0VIT0xERVJfVEFHLCB7aWQ6IHBoLnN0YXJ0TmFtZSwgY3R5cGUsICdlcXVpdi10ZXh0JzogYDwke3BoLnRhZ30+YH0pO1xuICAgIGNvbnN0IGNsb3NlVGFnUGggPVxuICAgICAgICBuZXcgeG1sLlRhZyhfUExBQ0VIT0xERVJfVEFHLCB7aWQ6IHBoLmNsb3NlTmFtZSwgY3R5cGUsICdlcXVpdi10ZXh0JzogYDwvJHtwaC50YWd9PmB9KTtcblxuICAgIHJldHVybiBbc3RhcnRUYWdQaCwgLi4udGhpcy5zZXJpYWxpemUocGguY2hpbGRyZW4pLCBjbG9zZVRhZ1BoXTtcbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICByZXR1cm4gW25ldyB4bWwuVGFnKF9QTEFDRUhPTERFUl9UQUcsIHtpZDogcGgubmFtZSwgJ2VxdWl2LXRleHQnOiBge3ske3BoLnZhbHVlfX19YH0pXTtcbiAgfVxuXG4gIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IGkxOG4uSWN1UGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICBjb25zdCBlcXVpdlRleHQgPSBgeyR7cGgudmFsdWUuZXhwcmVzc2lvbn0sICR7cGgudmFsdWUudHlwZX0sICR7XG4gICAgICAgIE9iamVjdC5rZXlzKHBoLnZhbHVlLmNhc2VzKS5tYXAoKHZhbHVlOiBzdHJpbmcpID0+IHZhbHVlICsgJyB7Li4ufScpLmpvaW4oJyAnKX19YDtcbiAgICByZXR1cm4gW25ldyB4bWwuVGFnKF9QTEFDRUhPTERFUl9UQUcsIHtpZDogcGgubmFtZSwgJ2VxdWl2LXRleHQnOiBlcXVpdlRleHR9KV07XG4gIH1cblxuICBzZXJpYWxpemUobm9kZXM6IGkxOG4uTm9kZVtdKTogeG1sLk5vZGVbXSB7XG4gICAgcmV0dXJuIFtdLmNvbmNhdCguLi5ub2Rlcy5tYXAobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKSk7XG4gIH1cbn1cblxuLy8gVE9ETyh2aWNiKTogYWRkIGVycm9yIG1hbmFnZW1lbnQgKHN0cnVjdHVyZSlcbi8vIEV4dHJhY3QgbWVzc2FnZXMgYXMgeG1sIG5vZGVzIGZyb20gdGhlIHhsaWZmIGZpbGVcbmNsYXNzIFhsaWZmUGFyc2VyIGltcGxlbWVudHMgbWwuVmlzaXRvciB7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwcml2YXRlIF91bml0TWxTdHJpbmchOiBzdHJpbmd8bnVsbDtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgX2Vycm9ycyE6IEkxOG5FcnJvcltdO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBfbXNnSWRUb0h0bWwhOiB7W21zZ0lkOiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcml2YXRlIF9sb2NhbGU6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICBwYXJzZSh4bGlmZjogc3RyaW5nLCB1cmw6IHN0cmluZykge1xuICAgIHRoaXMuX3VuaXRNbFN0cmluZyA9IG51bGw7XG4gICAgdGhpcy5fbXNnSWRUb0h0bWwgPSB7fTtcblxuICAgIGNvbnN0IHhtbCA9IG5ldyBYbWxQYXJzZXIoKS5wYXJzZSh4bGlmZiwgdXJsKTtcblxuICAgIHRoaXMuX2Vycm9ycyA9IHhtbC5lcnJvcnM7XG4gICAgbWwudmlzaXRBbGwodGhpcywgeG1sLnJvb3ROb2RlcywgbnVsbCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbXNnSWRUb0h0bWw6IHRoaXMuX21zZ0lkVG9IdG1sLFxuICAgICAgZXJyb3JzOiB0aGlzLl9lcnJvcnMsXG4gICAgICBsb2NhbGU6IHRoaXMuX2xvY2FsZSxcbiAgICB9O1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IG1sLkVsZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgc3dpdGNoIChlbGVtZW50Lm5hbWUpIHtcbiAgICAgIGNhc2UgX1VOSVRfVEFHOlxuICAgICAgICB0aGlzLl91bml0TWxTdHJpbmcgPSBudWxsITtcbiAgICAgICAgY29uc3QgaWRBdHRyID0gZWxlbWVudC5hdHRycy5maW5kKChhdHRyKSA9PiBhdHRyLm5hbWUgPT09ICdpZCcpO1xuICAgICAgICBpZiAoIWlkQXR0cikge1xuICAgICAgICAgIHRoaXMuX2FkZEVycm9yKGVsZW1lbnQsIGA8JHtfVU5JVF9UQUd9PiBtaXNzZXMgdGhlIFwiaWRcIiBhdHRyaWJ1dGVgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBpZCA9IGlkQXR0ci52YWx1ZTtcbiAgICAgICAgICBpZiAodGhpcy5fbXNnSWRUb0h0bWwuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRFcnJvcihlbGVtZW50LCBgRHVwbGljYXRlZCB0cmFuc2xhdGlvbnMgZm9yIG1zZyAke2lkfWApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtbC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuLCBudWxsKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5fdW5pdE1sU3RyaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICB0aGlzLl9tc2dJZFRvSHRtbFtpZF0gPSB0aGlzLl91bml0TWxTdHJpbmc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLl9hZGRFcnJvcihlbGVtZW50LCBgTWVzc2FnZSAke2lkfSBtaXNzZXMgYSB0cmFuc2xhdGlvbmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgLy8gaWdub3JlIHRob3NlIHRhZ3NcbiAgICAgIGNhc2UgX1NPVVJDRV9UQUc6XG4gICAgICBjYXNlIF9TRUdNRU5UX1NPVVJDRV9UQUc6XG4gICAgICBjYXNlIF9BTFRfVFJBTlNfVEFHOlxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBfVEFSR0VUX1RBRzpcbiAgICAgICAgY29uc3QgaW5uZXJUZXh0U3RhcnQgPSBlbGVtZW50LnN0YXJ0U291cmNlU3Bhbi5lbmQub2Zmc2V0O1xuICAgICAgICBjb25zdCBpbm5lclRleHRFbmQgPSBlbGVtZW50LmVuZFNvdXJjZVNwYW4hLnN0YXJ0Lm9mZnNldDtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLnN0YXJ0LmZpbGUuY29udGVudDtcbiAgICAgICAgY29uc3QgaW5uZXJUZXh0ID0gY29udGVudC5zbGljZShpbm5lclRleHRTdGFydCwgaW5uZXJUZXh0RW5kKTtcbiAgICAgICAgdGhpcy5fdW5pdE1sU3RyaW5nID0gaW5uZXJUZXh0O1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBfRklMRV9UQUc6XG4gICAgICAgIGNvbnN0IGxvY2FsZUF0dHIgPSBlbGVtZW50LmF0dHJzLmZpbmQoKGF0dHIpID0+IGF0dHIubmFtZSA9PT0gJ3RhcmdldC1sYW5ndWFnZScpO1xuICAgICAgICBpZiAobG9jYWxlQXR0cikge1xuICAgICAgICAgIHRoaXMuX2xvY2FsZSA9IGxvY2FsZUF0dHIudmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgbWwudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbiwgbnVsbCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICAvLyBUT0RPKHZpY2IpOiBhc3NlcnQgZmlsZSBzdHJ1Y3R1cmUsIHhsaWZmIHZlcnNpb25cbiAgICAgICAgLy8gRm9yIG5vdyBvbmx5IHJlY3Vyc2Ugb24gdW5oYW5kbGVkIG5vZGVzXG4gICAgICAgIG1sLnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4sIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogbWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge31cblxuICB2aXNpdFRleHQodGV4dDogbWwuVGV4dCwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IG1sLkNvbW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogbWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkge31cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogbWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHt9XG5cbiAgcHJpdmF0ZSBfYWRkRXJyb3Iobm9kZTogbWwuTm9kZSwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5fZXJyb3JzLnB1c2gobmV3IEkxOG5FcnJvcihub2RlLnNvdXJjZVNwYW4sIG1lc3NhZ2UpKTtcbiAgfVxufVxuXG4vLyBDb252ZXJ0IG1sIG5vZGVzICh4bGlmZiBzeW50YXgpIHRvIGkxOG4gbm9kZXNcbmNsYXNzIFhtbFRvSTE4biBpbXBsZW1lbnRzIG1sLlZpc2l0b3Ige1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBfZXJyb3JzITogSTE4bkVycm9yW107XG5cbiAgY29udmVydChtZXNzYWdlOiBzdHJpbmcsIHVybDogc3RyaW5nKSB7XG4gICAgY29uc3QgeG1sSWN1ID0gbmV3IFhtbFBhcnNlcigpLnBhcnNlKG1lc3NhZ2UsIHVybCwge3Rva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWV9KTtcbiAgICB0aGlzLl9lcnJvcnMgPSB4bWxJY3UuZXJyb3JzO1xuXG4gICAgY29uc3QgaTE4bk5vZGVzID0gdGhpcy5fZXJyb3JzLmxlbmd0aCA+IDAgfHwgeG1sSWN1LnJvb3ROb2Rlcy5sZW5ndGggPT0gMCA/XG4gICAgICAgIFtdIDpcbiAgICAgICAgW10uY29uY2F0KC4uLm1sLnZpc2l0QWxsKHRoaXMsIHhtbEljdS5yb290Tm9kZXMpKTtcblxuICAgIHJldHVybiB7XG4gICAgICBpMThuTm9kZXM6IGkxOG5Ob2RlcyxcbiAgICAgIGVycm9yczogdGhpcy5fZXJyb3JzLFxuICAgIH07XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogbWwuVGV4dCwgY29udGV4dDogYW55KSB7XG4gICAgcmV0dXJuIG5ldyBpMThuLlRleHQodGV4dC52YWx1ZSwgdGV4dC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbDogbWwuRWxlbWVudCwgY29udGV4dDogYW55KTogaTE4bi5QbGFjZWhvbGRlcnxtbC5Ob2RlW118bnVsbCB7XG4gICAgaWYgKGVsLm5hbWUgPT09IF9QTEFDRUhPTERFUl9UQUcpIHtcbiAgICAgIGNvbnN0IG5hbWVBdHRyID0gZWwuYXR0cnMuZmluZCgoYXR0cikgPT4gYXR0ci5uYW1lID09PSAnaWQnKTtcbiAgICAgIGlmIChuYW1lQXR0cikge1xuICAgICAgICByZXR1cm4gbmV3IGkxOG4uUGxhY2Vob2xkZXIoJycsIG5hbWVBdHRyLnZhbHVlLCBlbC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fYWRkRXJyb3IoZWwsIGA8JHtfUExBQ0VIT0xERVJfVEFHfT4gbWlzc2VzIHRoZSBcImlkXCIgYXR0cmlidXRlYCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoZWwubmFtZSA9PT0gX01BUktFUl9UQUcpIHtcbiAgICAgIHJldHVybiBbXS5jb25jYXQoLi4ubWwudmlzaXRBbGwodGhpcywgZWwuY2hpbGRyZW4pKTtcbiAgICB9XG5cbiAgICB0aGlzLl9hZGRFcnJvcihlbCwgYFVuZXhwZWN0ZWQgdGFnYCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihpY3U6IG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KSB7XG4gICAgY29uc3QgY2FzZU1hcDoge1t2YWx1ZTogc3RyaW5nXTogaTE4bi5Ob2RlfSA9IHt9O1xuXG4gICAgbWwudmlzaXRBbGwodGhpcywgaWN1LmNhc2VzKS5mb3JFYWNoKChjOiBhbnkpID0+IHtcbiAgICAgIGNhc2VNYXBbYy52YWx1ZV0gPSBuZXcgaTE4bi5Db250YWluZXIoYy5ub2RlcywgaWN1LnNvdXJjZVNwYW4pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBpMThuLkljdShpY3Uuc3dpdGNoVmFsdWUsIGljdS50eXBlLCBjYXNlTWFwLCBpY3Uuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoaWN1Q2FzZTogbWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4ge1xuICAgICAgdmFsdWU6IGljdUNhc2UudmFsdWUsXG4gICAgICBub2RlczogbWwudmlzaXRBbGwodGhpcywgaWN1Q2FzZS5leHByZXNzaW9uKSxcbiAgICB9O1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IG1sLkNvbW1lbnQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IG1sLkF0dHJpYnV0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHByaXZhdGUgX2FkZEVycm9yKG5vZGU6IG1sLk5vZGUsIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuX2Vycm9ycy5wdXNoKG5ldyBJMThuRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCBtZXNzYWdlKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q3R5cGVGb3JUYWcodGFnOiBzdHJpbmcpOiBzdHJpbmcge1xuICBzd2l0Y2ggKHRhZy50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnYnInOlxuICAgICAgcmV0dXJuICdsYic7XG4gICAgY2FzZSAnaW1nJzpcbiAgICAgIHJldHVybiAnaW1hZ2UnO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gYHgtJHt0YWd9YDtcbiAgfVxufVxuIl19