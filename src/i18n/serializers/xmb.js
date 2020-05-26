/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
        define("@angular/compiler/src/i18n/serializers/xmb", ["require", "exports", "tslib", "@angular/compiler/src/i18n/digest", "@angular/compiler/src/i18n/serializers/serializer", "@angular/compiler/src/i18n/serializers/xml_helper"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.toPublicName = exports.digest = exports.Xmb = void 0;
    var tslib_1 = require("tslib");
    var digest_1 = require("@angular/compiler/src/i18n/digest");
    var serializer_1 = require("@angular/compiler/src/i18n/serializers/serializer");
    var xml = require("@angular/compiler/src/i18n/serializers/xml_helper");
    var _MESSAGES_TAG = 'messagebundle';
    var _MESSAGE_TAG = 'msg';
    var _PLACEHOLDER_TAG = 'ph';
    var _EXAMPLE_TAG = 'ex';
    var _SOURCE_TAG = 'source';
    var _DOCTYPE = "<!ELEMENT messagebundle (msg)*>\n<!ATTLIST messagebundle class CDATA #IMPLIED>\n\n<!ELEMENT msg (#PCDATA|ph|source)*>\n<!ATTLIST msg id CDATA #IMPLIED>\n<!ATTLIST msg seq CDATA #IMPLIED>\n<!ATTLIST msg name CDATA #IMPLIED>\n<!ATTLIST msg desc CDATA #IMPLIED>\n<!ATTLIST msg meaning CDATA #IMPLIED>\n<!ATTLIST msg obsolete (obsolete) #IMPLIED>\n<!ATTLIST msg xml:space (default|preserve) \"default\">\n<!ATTLIST msg is_hidden CDATA #IMPLIED>\n\n<!ELEMENT source (#PCDATA)>\n\n<!ELEMENT ph (#PCDATA|ex)*>\n<!ATTLIST ph name CDATA #REQUIRED>\n\n<!ELEMENT ex (#PCDATA)>";
    var Xmb = /** @class */ (function (_super) {
        tslib_1.__extends(Xmb, _super);
        function Xmb() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Xmb.prototype.write = function (messages, locale) {
            var exampleVisitor = new ExampleVisitor();
            var visitor = new _Visitor();
            var rootNode = new xml.Tag(_MESSAGES_TAG);
            messages.forEach(function (message) {
                var attrs = { id: message.id };
                if (message.description) {
                    attrs['desc'] = message.description;
                }
                if (message.meaning) {
                    attrs['meaning'] = message.meaning;
                }
                var sourceTags = [];
                message.sources.forEach(function (source) {
                    sourceTags.push(new xml.Tag(_SOURCE_TAG, {}, [new xml.Text(source.filePath + ":" + source.startLine + (source.endLine !== source.startLine ? ',' + source.endLine : ''))]));
                });
                rootNode.children.push(new xml.CR(2), new xml.Tag(_MESSAGE_TAG, attrs, tslib_1.__spread(sourceTags, visitor.serialize(message.nodes))));
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
        Xmb.prototype.load = function (content, url) {
            throw new Error('Unsupported');
        };
        Xmb.prototype.digest = function (message) {
            return digest(message);
        };
        Xmb.prototype.createNameMapper = function (message) {
            return new serializer_1.SimplePlaceholderMapper(message, toPublicName);
        };
        return Xmb;
    }(serializer_1.Serializer));
    exports.Xmb = Xmb;
    var _Visitor = /** @class */ (function () {
        function _Visitor() {
        }
        _Visitor.prototype.visitText = function (text, context) {
            return [new xml.Text(text.value)];
        };
        _Visitor.prototype.visitContainer = function (container, context) {
            var _this = this;
            var nodes = [];
            container.children.forEach(function (node) { return nodes.push.apply(nodes, tslib_1.__spread(node.visit(_this))); });
            return nodes;
        };
        _Visitor.prototype.visitIcu = function (icu, context) {
            var _this = this;
            var nodes = [new xml.Text("{" + icu.expressionPlaceholder + ", " + icu.type + ", ")];
            Object.keys(icu.cases).forEach(function (c) {
                nodes.push.apply(nodes, tslib_1.__spread([new xml.Text(c + " {")], icu.cases[c].visit(_this), [new xml.Text("} ")]));
            });
            nodes.push(new xml.Text("}"));
            return nodes;
        };
        _Visitor.prototype.visitTagPlaceholder = function (ph, context) {
            var startTagAsText = new xml.Text("<" + ph.tag + ">");
            var startEx = new xml.Tag(_EXAMPLE_TAG, {}, [startTagAsText]);
            // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
            var startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.startName }, [startEx, startTagAsText]);
            if (ph.isVoid) {
                // void tags have no children nor closing tags
                return [startTagPh];
            }
            var closeTagAsText = new xml.Text("</" + ph.tag + ">");
            var closeEx = new xml.Tag(_EXAMPLE_TAG, {}, [closeTagAsText]);
            // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
            var closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.closeName }, [closeEx, closeTagAsText]);
            return tslib_1.__spread([startTagPh], this.serialize(ph.children), [closeTagPh]);
        };
        _Visitor.prototype.visitPlaceholder = function (ph, context) {
            var interpolationAsText = new xml.Text("{{" + ph.value + "}}");
            // Example tag needs to be not-empty for TC.
            var exTag = new xml.Tag(_EXAMPLE_TAG, {}, [interpolationAsText]);
            return [
                // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
                new xml.Tag(_PLACEHOLDER_TAG, { name: ph.name }, [exTag, interpolationAsText])
            ];
        };
        _Visitor.prototype.visitIcuPlaceholder = function (ph, context) {
            var icuExpression = ph.value.expression;
            var icuType = ph.value.type;
            var icuCases = Object.keys(ph.value.cases).map(function (value) { return value + ' {...}'; }).join(' ');
            var icuAsText = new xml.Text("{" + icuExpression + ", " + icuType + ", " + icuCases + "}");
            var exTag = new xml.Tag(_EXAMPLE_TAG, {}, [icuAsText]);
            return [
                // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
                new xml.Tag(_PLACEHOLDER_TAG, { name: ph.name }, [exTag, icuAsText])
            ];
        };
        _Visitor.prototype.serialize = function (nodes) {
            var _this = this;
            return [].concat.apply([], tslib_1.__spread(nodes.map(function (node) { return node.visit(_this); })));
        };
        return _Visitor;
    }());
    function digest(message) {
        return digest_1.decimalDigest(message);
    }
    exports.digest = digest;
    // TC requires at least one non-empty example on placeholders
    var ExampleVisitor = /** @class */ (function () {
        function ExampleVisitor() {
        }
        ExampleVisitor.prototype.addDefaultExamples = function (node) {
            node.visit(this);
            return node;
        };
        ExampleVisitor.prototype.visitTag = function (tag) {
            var _this = this;
            if (tag.name === _PLACEHOLDER_TAG) {
                if (!tag.children || tag.children.length == 0) {
                    var exText = new xml.Text(tag.attrs['name'] || '...');
                    tag.children = [new xml.Tag(_EXAMPLE_TAG, {}, [exText])];
                }
            }
            else if (tag.children) {
                tag.children.forEach(function (node) { return node.visit(_this); });
            }
        };
        ExampleVisitor.prototype.visitText = function (text) { };
        ExampleVisitor.prototype.visitDeclaration = function (decl) { };
        ExampleVisitor.prototype.visitDoctype = function (doctype) { };
        return ExampleVisitor;
    }());
    // XMB/XTB placeholders can only contain A-Z, 0-9 and _
    function toPublicName(internalName) {
        return internalName.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    }
    exports.toPublicName = toPublicName;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieG1iLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2kxOG4vc2VyaWFsaXplcnMveG1iLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw0REFBd0M7SUFHeEMsZ0ZBQW9GO0lBQ3BGLHVFQUFvQztJQUVwQyxJQUFNLGFBQWEsR0FBRyxlQUFlLENBQUM7SUFDdEMsSUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDO0lBQzNCLElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO0lBQzlCLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQztJQUMxQixJQUFNLFdBQVcsR0FBRyxRQUFRLENBQUM7SUFFN0IsSUFBTSxRQUFRLEdBQUcsdWpCQWtCTyxDQUFDO0lBRXpCO1FBQXlCLCtCQUFVO1FBQW5DOztRQXVEQSxDQUFDO1FBdERDLG1CQUFLLEdBQUwsVUFBTSxRQUF3QixFQUFFLE1BQW1CO1lBQ2pELElBQU0sY0FBYyxHQUFHLElBQUksY0FBYyxFQUFFLENBQUM7WUFDNUMsSUFBTSxPQUFPLEdBQUcsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUMvQixJQUFJLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7WUFFMUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFBLE9BQU87Z0JBQ3RCLElBQU0sS0FBSyxHQUEwQixFQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFDLENBQUM7Z0JBRXRELElBQUksT0FBTyxDQUFDLFdBQVcsRUFBRTtvQkFDdkIsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUM7aUJBQ3JDO2dCQUVELElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRTtvQkFDbkIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7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Z2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2RlY2ltYWxEaWdlc3R9IGZyb20gJy4uL2RpZ2VzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uL2kxOG5fYXN0JztcblxuaW1wb3J0IHtQbGFjZWhvbGRlck1hcHBlciwgU2VyaWFsaXplciwgU2ltcGxlUGxhY2Vob2xkZXJNYXBwZXJ9IGZyb20gJy4vc2VyaWFsaXplcic7XG5pbXBvcnQgKiBhcyB4bWwgZnJvbSAnLi94bWxfaGVscGVyJztcblxuY29uc3QgX01FU1NBR0VTX1RBRyA9ICdtZXNzYWdlYnVuZGxlJztcbmNvbnN0IF9NRVNTQUdFX1RBRyA9ICdtc2cnO1xuY29uc3QgX1BMQUNFSE9MREVSX1RBRyA9ICdwaCc7XG5jb25zdCBfRVhBTVBMRV9UQUcgPSAnZXgnO1xuY29uc3QgX1NPVVJDRV9UQUcgPSAnc291cmNlJztcblxuY29uc3QgX0RPQ1RZUEUgPSBgPCFFTEVNRU5UIG1lc3NhZ2VidW5kbGUgKG1zZykqPlxuPCFBVFRMSVNUIG1lc3NhZ2VidW5kbGUgY2xhc3MgQ0RBVEEgI0lNUExJRUQ+XG5cbjwhRUxFTUVOVCBtc2cgKCNQQ0RBVEF8cGh8c291cmNlKSo+XG48IUFUVExJU1QgbXNnIGlkIENEQVRBICNJTVBMSUVEPlxuPCFBVFRMSVNUIG1zZyBzZXEgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG5hbWUgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIGRlc2MgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG1lYW5pbmcgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG9ic29sZXRlIChvYnNvbGV0ZSkgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIHhtbDpzcGFjZSAoZGVmYXVsdHxwcmVzZXJ2ZSkgXCJkZWZhdWx0XCI+XG48IUFUVExJU1QgbXNnIGlzX2hpZGRlbiBDREFUQSAjSU1QTElFRD5cblxuPCFFTEVNRU5UIHNvdXJjZSAoI1BDREFUQSk+XG5cbjwhRUxFTUVOVCBwaCAoI1BDREFUQXxleCkqPlxuPCFBVFRMSVNUIHBoIG5hbWUgQ0RBVEEgI1JFUVVJUkVEPlxuXG48IUVMRU1FTlQgZXggKCNQQ0RBVEEpPmA7XG5cbmV4cG9ydCBjbGFzcyBYbWIgZXh0ZW5kcyBTZXJpYWxpemVyIHtcbiAgd3JpdGUobWVzc2FnZXM6IGkxOG4uTWVzc2FnZVtdLCBsb2NhbGU6IHN0cmluZ3xudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCBleGFtcGxlVmlzaXRvciA9IG5ldyBFeGFtcGxlVmlzaXRvcigpO1xuICAgIGNvbnN0IHZpc2l0b3IgPSBuZXcgX1Zpc2l0b3IoKTtcbiAgICBsZXQgcm9vdE5vZGUgPSBuZXcgeG1sLlRhZyhfTUVTU0FHRVNfVEFHKTtcblxuICAgIG1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiB7XG4gICAgICBjb25zdCBhdHRyczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge2lkOiBtZXNzYWdlLmlkfTtcblxuICAgICAgaWYgKG1lc3NhZ2UuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgYXR0cnNbJ2Rlc2MnXSA9IG1lc3NhZ2UuZGVzY3JpcHRpb247XG4gICAgICB9XG5cbiAgICAgIGlmIChtZXNzYWdlLm1lYW5pbmcpIHtcbiAgICAgICAgYXR0cnNbJ21lYW5pbmcnXSA9IG1lc3NhZ2UubWVhbmluZztcbiAgICAgIH1cblxuICAgICAgbGV0IHNvdXJjZVRhZ3M6IHhtbC5UYWdbXSA9IFtdO1xuICAgICAgbWVzc2FnZS5zb3VyY2VzLmZvckVhY2goKHNvdXJjZTogaTE4bi5NZXNzYWdlU3BhbikgPT4ge1xuICAgICAgICBzb3VyY2VUYWdzLnB1c2gobmV3IHhtbC5UYWcoXG4gICAgICAgICAgICBfU09VUkNFX1RBRywge30sXG4gICAgICAgICAgICBbbmV3IHhtbC5UZXh0KGAke3NvdXJjZS5maWxlUGF0aH06JHtzb3VyY2Uuc3RhcnRMaW5lfSR7XG4gICAgICAgICAgICAgICAgc291cmNlLmVuZExpbmUgIT09IHNvdXJjZS5zdGFydExpbmUgPyAnLCcgKyBzb3VyY2UuZW5kTGluZSA6ICcnfWApXSkpO1xuICAgICAgfSk7XG5cbiAgICAgIHJvb3ROb2RlLmNoaWxkcmVuLnB1c2goXG4gICAgICAgICAgbmV3IHhtbC5DUigyKSxcbiAgICAgICAgICBuZXcgeG1sLlRhZyhfTUVTU0FHRV9UQUcsIGF0dHJzLCBbLi4uc291cmNlVGFncywgLi4udmlzaXRvci5zZXJpYWxpemUobWVzc2FnZS5ub2RlcyldKSk7XG4gICAgfSk7XG5cbiAgICByb290Tm9kZS5jaGlsZHJlbi5wdXNoKG5ldyB4bWwuQ1IoKSk7XG5cbiAgICByZXR1cm4geG1sLnNlcmlhbGl6ZShbXG4gICAgICBuZXcgeG1sLkRlY2xhcmF0aW9uKHt2ZXJzaW9uOiAnMS4wJywgZW5jb2Rpbmc6ICdVVEYtOCd9KSxcbiAgICAgIG5ldyB4bWwuQ1IoKSxcbiAgICAgIG5ldyB4bWwuRG9jdHlwZShfTUVTU0FHRVNfVEFHLCBfRE9DVFlQRSksXG4gICAgICBuZXcgeG1sLkNSKCksXG4gICAgICBleGFtcGxlVmlzaXRvci5hZGREZWZhdWx0RXhhbXBsZXMocm9vdE5vZGUpLFxuICAgICAgbmV3IHhtbC5DUigpLFxuICAgIF0pO1xuICB9XG5cbiAgbG9hZChjb250ZW50OiBzdHJpbmcsIHVybDogc3RyaW5nKTpcbiAgICAgIHtsb2NhbGU6IHN0cmluZywgaTE4bk5vZGVzQnlNc2dJZDoge1ttc2dJZDogc3RyaW5nXTogaTE4bi5Ob2RlW119fSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCcpO1xuICB9XG5cbiAgZGlnZXN0KG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGRpZ2VzdChtZXNzYWdlKTtcbiAgfVxuXG5cbiAgY3JlYXRlTmFtZU1hcHBlcihtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBQbGFjZWhvbGRlck1hcHBlciB7XG4gICAgcmV0dXJuIG5ldyBTaW1wbGVQbGFjZWhvbGRlck1hcHBlcihtZXNzYWdlLCB0b1B1YmxpY05hbWUpO1xuICB9XG59XG5cbmNsYXNzIF9WaXNpdG9yIGltcGxlbWVudHMgaTE4bi5WaXNpdG9yIHtcbiAgdmlzaXRUZXh0KHRleHQ6IGkxOG4uVGV4dCwgY29udGV4dD86IGFueSk6IHhtbC5Ob2RlW10ge1xuICAgIHJldHVybiBbbmV3IHhtbC5UZXh0KHRleHQudmFsdWUpXTtcbiAgfVxuXG4gIHZpc2l0Q29udGFpbmVyKGNvbnRhaW5lcjogaTE4bi5Db250YWluZXIsIGNvbnRleHQ6IGFueSk6IHhtbC5Ob2RlW10ge1xuICAgIGNvbnN0IG5vZGVzOiB4bWwuTm9kZVtdID0gW107XG4gICAgY29udGFpbmVyLmNoaWxkcmVuLmZvckVhY2goKG5vZGU6IGkxOG4uTm9kZSkgPT4gbm9kZXMucHVzaCguLi5ub2RlLnZpc2l0KHRoaXMpKSk7XG4gICAgcmV0dXJuIG5vZGVzO1xuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiBpMThuLkljdSwgY29udGV4dD86IGFueSk6IHhtbC5Ob2RlW10ge1xuICAgIGNvbnN0IG5vZGVzID0gW25ldyB4bWwuVGV4dChgeyR7aWN1LmV4cHJlc3Npb25QbGFjZWhvbGRlcn0sICR7aWN1LnR5cGV9LCBgKV07XG5cbiAgICBPYmplY3Qua2V5cyhpY3UuY2FzZXMpLmZvckVhY2goKGM6IHN0cmluZykgPT4ge1xuICAgICAgbm9kZXMucHVzaChuZXcgeG1sLlRleHQoYCR7Y30ge2ApLCAuLi5pY3UuY2FzZXNbY10udmlzaXQodGhpcyksIG5ldyB4bWwuVGV4dChgfSBgKSk7XG4gICAgfSk7XG5cbiAgICBub2Rlcy5wdXNoKG5ldyB4bWwuVGV4dChgfWApKTtcblxuICAgIHJldHVybiBub2RlcztcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICBjb25zdCBzdGFydFRhZ0FzVGV4dCA9IG5ldyB4bWwuVGV4dChgPCR7cGgudGFnfT5gKTtcbiAgICBjb25zdCBzdGFydEV4ID0gbmV3IHhtbC5UYWcoX0VYQU1QTEVfVEFHLCB7fSwgW3N0YXJ0VGFnQXNUZXh0XSk7XG4gICAgLy8gVEMgcmVxdWlyZXMgUEggdG8gaGF2ZSBhIG5vbiBlbXB0eSBFWCwgYW5kIHVzZXMgdGhlIHRleHQgbm9kZSB0byBzaG93IHRoZSBcIm9yaWdpbmFsXCIgdmFsdWUuXG4gICAgY29uc3Qgc3RhcnRUYWdQaCA9XG4gICAgICAgIG5ldyB4bWwuVGFnKF9QTEFDRUhPTERFUl9UQUcsIHtuYW1lOiBwaC5zdGFydE5hbWV9LCBbc3RhcnRFeCwgc3RhcnRUYWdBc1RleHRdKTtcbiAgICBpZiAocGguaXNWb2lkKSB7XG4gICAgICAvLyB2b2lkIHRhZ3MgaGF2ZSBubyBjaGlsZHJlbiBub3IgY2xvc2luZyB0YWdzXG4gICAgICByZXR1cm4gW3N0YXJ0VGFnUGhdO1xuICAgIH1cblxuICAgIGNvbnN0IGNsb3NlVGFnQXNUZXh0ID0gbmV3IHhtbC5UZXh0KGA8LyR7cGgudGFnfT5gKTtcbiAgICBjb25zdCBjbG9zZUV4ID0gbmV3IHhtbC5UYWcoX0VYQU1QTEVfVEFHLCB7fSwgW2Nsb3NlVGFnQXNUZXh0XSk7XG4gICAgLy8gVEMgcmVxdWlyZXMgUEggdG8gaGF2ZSBhIG5vbiBlbXB0eSBFWCwgYW5kIHVzZXMgdGhlIHRleHQgbm9kZSB0byBzaG93IHRoZSBcIm9yaWdpbmFsXCIgdmFsdWUuXG4gICAgY29uc3QgY2xvc2VUYWdQaCA9XG4gICAgICAgIG5ldyB4bWwuVGFnKF9QTEFDRUhPTERFUl9UQUcsIHtuYW1lOiBwaC5jbG9zZU5hbWV9LCBbY2xvc2VFeCwgY2xvc2VUYWdBc1RleHRdKTtcblxuICAgIHJldHVybiBbc3RhcnRUYWdQaCwgLi4udGhpcy5zZXJpYWxpemUocGguY2hpbGRyZW4pLCBjbG9zZVRhZ1BoXTtcbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uQXNUZXh0ID0gbmV3IHhtbC5UZXh0KGB7eyR7cGgudmFsdWV9fX1gKTtcbiAgICAvLyBFeGFtcGxlIHRhZyBuZWVkcyB0byBiZSBub3QtZW1wdHkgZm9yIFRDLlxuICAgIGNvbnN0IGV4VGFnID0gbmV3IHhtbC5UYWcoX0VYQU1QTEVfVEFHLCB7fSwgW2ludGVycG9sYXRpb25Bc1RleHRdKTtcbiAgICByZXR1cm4gW1xuICAgICAgLy8gVEMgcmVxdWlyZXMgUEggdG8gaGF2ZSBhIG5vbiBlbXB0eSBFWCwgYW5kIHVzZXMgdGhlIHRleHQgbm9kZSB0byBzaG93IHRoZSBcIm9yaWdpbmFsXCIgdmFsdWUuXG4gICAgICBuZXcgeG1sLlRhZyhfUExBQ0VIT0xERVJfVEFHLCB7bmFtZTogcGgubmFtZX0sIFtleFRhZywgaW50ZXJwb2xhdGlvbkFzVGV4dF0pXG4gICAgXTtcbiAgfVxuXG4gIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IGkxOG4uSWN1UGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICBjb25zdCBpY3VFeHByZXNzaW9uID0gcGgudmFsdWUuZXhwcmVzc2lvbjtcbiAgICBjb25zdCBpY3VUeXBlID0gcGgudmFsdWUudHlwZTtcbiAgICBjb25zdCBpY3VDYXNlcyA9IE9iamVjdC5rZXlzKHBoLnZhbHVlLmNhc2VzKS5tYXAoKHZhbHVlOiBzdHJpbmcpID0+IHZhbHVlICsgJyB7Li4ufScpLmpvaW4oJyAnKTtcbiAgICBjb25zdCBpY3VBc1RleHQgPSBuZXcgeG1sLlRleHQoYHske2ljdUV4cHJlc3Npb259LCAke2ljdVR5cGV9LCAke2ljdUNhc2VzfX1gKTtcbiAgICBjb25zdCBleFRhZyA9IG5ldyB4bWwuVGFnKF9FWEFNUExFX1RBRywge30sIFtpY3VBc1RleHRdKTtcbiAgICByZXR1cm4gW1xuICAgICAgLy8gVEMgcmVxdWlyZXMgUEggdG8gaGF2ZSBhIG5vbiBlbXB0eSBFWCwgYW5kIHVzZXMgdGhlIHRleHQgbm9kZSB0byBzaG93IHRoZSBcIm9yaWdpbmFsXCIgdmFsdWUuXG4gICAgICBuZXcgeG1sLlRhZyhfUExBQ0VIT0xERVJfVEFHLCB7bmFtZTogcGgubmFtZX0sIFtleFRhZywgaWN1QXNUZXh0XSlcbiAgICBdO1xuICB9XG5cbiAgc2VyaWFsaXplKG5vZGVzOiBpMThuLk5vZGVbXSk6IHhtbC5Ob2RlW10ge1xuICAgIHJldHVybiBbXS5jb25jYXQoLi4ubm9kZXMubWFwKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSkpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkaWdlc3QobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogc3RyaW5nIHtcbiAgcmV0dXJuIGRlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG59XG5cbi8vIFRDIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBub24tZW1wdHkgZXhhbXBsZSBvbiBwbGFjZWhvbGRlcnNcbmNsYXNzIEV4YW1wbGVWaXNpdG9yIGltcGxlbWVudHMgeG1sLklWaXNpdG9yIHtcbiAgYWRkRGVmYXVsdEV4YW1wbGVzKG5vZGU6IHhtbC5Ob2RlKTogeG1sLk5vZGUge1xuICAgIG5vZGUudmlzaXQodGhpcyk7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdFRhZyh0YWc6IHhtbC5UYWcpOiB2b2lkIHtcbiAgICBpZiAodGFnLm5hbWUgPT09IF9QTEFDRUhPTERFUl9UQUcpIHtcbiAgICAgIGlmICghdGFnLmNoaWxkcmVuIHx8IHRhZy5jaGlsZHJlbi5sZW5ndGggPT0gMCkge1xuICAgICAgICBjb25zdCBleFRleHQgPSBuZXcgeG1sLlRleHQodGFnLmF0dHJzWyduYW1lJ10gfHwgJy4uLicpO1xuICAgICAgICB0YWcuY2hpbGRyZW4gPSBbbmV3IHhtbC5UYWcoX0VYQU1QTEVfVEFHLCB7fSwgW2V4VGV4dF0pXTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRhZy5jaGlsZHJlbikge1xuICAgICAgdGFnLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogeG1sLlRleHQpOiB2b2lkIHt9XG4gIHZpc2l0RGVjbGFyYXRpb24oZGVjbDogeG1sLkRlY2xhcmF0aW9uKTogdm9pZCB7fVxuICB2aXNpdERvY3R5cGUoZG9jdHlwZTogeG1sLkRvY3R5cGUpOiB2b2lkIHt9XG59XG5cbi8vIFhNQi9YVEIgcGxhY2Vob2xkZXJzIGNhbiBvbmx5IGNvbnRhaW4gQS1aLCAwLTkgYW5kIF9cbmV4cG9ydCBmdW5jdGlvbiB0b1B1YmxpY05hbWUoaW50ZXJuYWxOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaW50ZXJuYWxOYW1lLnRvVXBwZXJDYXNlKCkucmVwbGFjZSgvW15BLVowLTlfXS9nLCAnXycpO1xufVxuIl19