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
        Xmb.prototype.digest = function (message) { return digest(message); };
        Xmb.prototype.createNameMapper = function (message) {
            return new serializer_1.SimplePlaceholderMapper(message, toPublicName);
        };
        return Xmb;
    }(serializer_1.Serializer));
    exports.Xmb = Xmb;
    var _Visitor = /** @class */ (function () {
        function _Visitor() {
        }
        _Visitor.prototype.visitText = function (text, context) { return [new xml.Text(text.value)]; };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieG1iLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2kxOG4vc2VyaWFsaXplcnMveG1iLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDREQUF3QztJQUd4QyxnRkFBb0Y7SUFDcEYsdUVBQW9DO0lBRXBDLElBQU0sYUFBYSxHQUFHLGVBQWUsQ0FBQztJQUN0QyxJQUFNLFlBQVksR0FBRyxLQUFLLENBQUM7SUFDM0IsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7SUFDOUIsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDO0lBQzFCLElBQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQztJQUU3QixJQUFNLFFBQVEsR0FBRyx1akJBa0JPLENBQUM7SUFFekI7UUFBeUIsK0JBQVU7UUFBbkM7O1FBb0RBLENBQUM7UUFuREMsbUJBQUssR0FBTCxVQUFNLFFBQXdCLEVBQUUsTUFBbUI7WUFDakQsSUFBTSxjQUFjLEdBQUcsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUM1QyxJQUFNLE9BQU8sR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQy9CLElBQUksUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUUxQyxRQUFRLENBQUMsT0FBTyxDQUFDLFVBQUEsT0FBTztnQkFDdEIsSUFBTSxLQUFLLEdBQTBCLEVBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUMsQ0FBQztnQkFFdEQsSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFO29CQUN2QixLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQztpQkFDckM7Z0JBRUQsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFO29CQUNuQixLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQztp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IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2RlY2ltYWxEaWdlc3R9IGZyb20gJy4uL2RpZ2VzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uL2kxOG5fYXN0JztcblxuaW1wb3J0IHtQbGFjZWhvbGRlck1hcHBlciwgU2VyaWFsaXplciwgU2ltcGxlUGxhY2Vob2xkZXJNYXBwZXJ9IGZyb20gJy4vc2VyaWFsaXplcic7XG5pbXBvcnQgKiBhcyB4bWwgZnJvbSAnLi94bWxfaGVscGVyJztcblxuY29uc3QgX01FU1NBR0VTX1RBRyA9ICdtZXNzYWdlYnVuZGxlJztcbmNvbnN0IF9NRVNTQUdFX1RBRyA9ICdtc2cnO1xuY29uc3QgX1BMQUNFSE9MREVSX1RBRyA9ICdwaCc7XG5jb25zdCBfRVhBTVBMRV9UQUcgPSAnZXgnO1xuY29uc3QgX1NPVVJDRV9UQUcgPSAnc291cmNlJztcblxuY29uc3QgX0RPQ1RZUEUgPSBgPCFFTEVNRU5UIG1lc3NhZ2VidW5kbGUgKG1zZykqPlxuPCFBVFRMSVNUIG1lc3NhZ2VidW5kbGUgY2xhc3MgQ0RBVEEgI0lNUExJRUQ+XG5cbjwhRUxFTUVOVCBtc2cgKCNQQ0RBVEF8cGh8c291cmNlKSo+XG48IUFUVExJU1QgbXNnIGlkIENEQVRBICNJTVBMSUVEPlxuPCFBVFRMSVNUIG1zZyBzZXEgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG5hbWUgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIGRlc2MgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG1lYW5pbmcgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG9ic29sZXRlIChvYnNvbGV0ZSkgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIHhtbDpzcGFjZSAoZGVmYXVsdHxwcmVzZXJ2ZSkgXCJkZWZhdWx0XCI+XG48IUFUVExJU1QgbXNnIGlzX2hpZGRlbiBDREFUQSAjSU1QTElFRD5cblxuPCFFTEVNRU5UIHNvdXJjZSAoI1BDREFUQSk+XG5cbjwhRUxFTUVOVCBwaCAoI1BDREFUQXxleCkqPlxuPCFBVFRMSVNUIHBoIG5hbWUgQ0RBVEEgI1JFUVVJUkVEPlxuXG48IUVMRU1FTlQgZXggKCNQQ0RBVEEpPmA7XG5cbmV4cG9ydCBjbGFzcyBYbWIgZXh0ZW5kcyBTZXJpYWxpemVyIHtcbiAgd3JpdGUobWVzc2FnZXM6IGkxOG4uTWVzc2FnZVtdLCBsb2NhbGU6IHN0cmluZ3xudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCBleGFtcGxlVmlzaXRvciA9IG5ldyBFeGFtcGxlVmlzaXRvcigpO1xuICAgIGNvbnN0IHZpc2l0b3IgPSBuZXcgX1Zpc2l0b3IoKTtcbiAgICBsZXQgcm9vdE5vZGUgPSBuZXcgeG1sLlRhZyhfTUVTU0FHRVNfVEFHKTtcblxuICAgIG1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiB7XG4gICAgICBjb25zdCBhdHRyczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge2lkOiBtZXNzYWdlLmlkfTtcblxuICAgICAgaWYgKG1lc3NhZ2UuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgYXR0cnNbJ2Rlc2MnXSA9IG1lc3NhZ2UuZGVzY3JpcHRpb247XG4gICAgICB9XG5cbiAgICAgIGlmIChtZXNzYWdlLm1lYW5pbmcpIHtcbiAgICAgICAgYXR0cnNbJ21lYW5pbmcnXSA9IG1lc3NhZ2UubWVhbmluZztcbiAgICAgIH1cblxuICAgICAgbGV0IHNvdXJjZVRhZ3M6IHhtbC5UYWdbXSA9IFtdO1xuICAgICAgbWVzc2FnZS5zb3VyY2VzLmZvckVhY2goKHNvdXJjZTogaTE4bi5NZXNzYWdlU3BhbikgPT4ge1xuICAgICAgICBzb3VyY2VUYWdzLnB1c2goXG4gICAgICAgICAgICBuZXcgeG1sLlRhZyhfU09VUkNFX1RBRywge30sIFtuZXcgeG1sLlRleHQoYCR7c291cmNlLmZpbGVQYXRofToke3NvdXJjZS5zdGFydExpbmV9JHtcbiAgICAgICAgICAgICAgICBzb3VyY2UuZW5kTGluZSAhPT0gc291cmNlLnN0YXJ0TGluZSA/ICcsJyArIHNvdXJjZS5lbmRMaW5lIDogJyd9YCldKSk7XG4gICAgICB9KTtcblxuICAgICAgcm9vdE5vZGUuY2hpbGRyZW4ucHVzaChcbiAgICAgICAgICBuZXcgeG1sLkNSKDIpLFxuICAgICAgICAgIG5ldyB4bWwuVGFnKF9NRVNTQUdFX1RBRywgYXR0cnMsIFsuLi5zb3VyY2VUYWdzLCAuLi52aXNpdG9yLnNlcmlhbGl6ZShtZXNzYWdlLm5vZGVzKV0pKTtcbiAgICB9KTtcblxuICAgIHJvb3ROb2RlLmNoaWxkcmVuLnB1c2gobmV3IHhtbC5DUigpKTtcblxuICAgIHJldHVybiB4bWwuc2VyaWFsaXplKFtcbiAgICAgIG5ldyB4bWwuRGVjbGFyYXRpb24oe3ZlcnNpb246ICcxLjAnLCBlbmNvZGluZzogJ1VURi04J30pLFxuICAgICAgbmV3IHhtbC5DUigpLFxuICAgICAgbmV3IHhtbC5Eb2N0eXBlKF9NRVNTQUdFU19UQUcsIF9ET0NUWVBFKSxcbiAgICAgIG5ldyB4bWwuQ1IoKSxcbiAgICAgIGV4YW1wbGVWaXNpdG9yLmFkZERlZmF1bHRFeGFtcGxlcyhyb290Tm9kZSksXG4gICAgICBuZXcgeG1sLkNSKCksXG4gICAgXSk7XG4gIH1cblxuICBsb2FkKGNvbnRlbnQ6IHN0cmluZywgdXJsOiBzdHJpbmcpOlxuICAgICAge2xvY2FsZTogc3RyaW5nLCBpMThuTm9kZXNCeU1zZ0lkOiB7W21zZ0lkOiBzdHJpbmddOiBpMThuLk5vZGVbXX19IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkJyk7XG4gIH1cblxuICBkaWdlc3QobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogc3RyaW5nIHsgcmV0dXJuIGRpZ2VzdChtZXNzYWdlKTsgfVxuXG5cbiAgY3JlYXRlTmFtZU1hcHBlcihtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBQbGFjZWhvbGRlck1hcHBlciB7XG4gICAgcmV0dXJuIG5ldyBTaW1wbGVQbGFjZWhvbGRlck1hcHBlcihtZXNzYWdlLCB0b1B1YmxpY05hbWUpO1xuICB9XG59XG5cbmNsYXNzIF9WaXNpdG9yIGltcGxlbWVudHMgaTE4bi5WaXNpdG9yIHtcbiAgdmlzaXRUZXh0KHRleHQ6IGkxOG4uVGV4dCwgY29udGV4dD86IGFueSk6IHhtbC5Ob2RlW10geyByZXR1cm4gW25ldyB4bWwuVGV4dCh0ZXh0LnZhbHVlKV07IH1cblxuICB2aXNpdENvbnRhaW5lcihjb250YWluZXI6IGkxOG4uQ29udGFpbmVyLCBjb250ZXh0OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICBjb25zdCBub2RlczogeG1sLk5vZGVbXSA9IFtdO1xuICAgIGNvbnRhaW5lci5jaGlsZHJlbi5mb3JFYWNoKChub2RlOiBpMThuLk5vZGUpID0+IG5vZGVzLnB1c2goLi4ubm9kZS52aXNpdCh0aGlzKSkpO1xuICAgIHJldHVybiBub2RlcztcbiAgfVxuXG4gIHZpc2l0SWN1KGljdTogaTE4bi5JY3UsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICBjb25zdCBub2RlcyA9IFtuZXcgeG1sLlRleHQoYHske2ljdS5leHByZXNzaW9uUGxhY2Vob2xkZXJ9LCAke2ljdS50eXBlfSwgYCldO1xuXG4gICAgT2JqZWN0LmtleXMoaWN1LmNhc2VzKS5mb3JFYWNoKChjOiBzdHJpbmcpID0+IHtcbiAgICAgIG5vZGVzLnB1c2gobmV3IHhtbC5UZXh0KGAke2N9IHtgKSwgLi4uaWN1LmNhc2VzW2NdLnZpc2l0KHRoaXMpLCBuZXcgeG1sLlRleHQoYH0gYCkpO1xuICAgIH0pO1xuXG4gICAgbm9kZXMucHVzaChuZXcgeG1sLlRleHQoYH1gKSk7XG5cbiAgICByZXR1cm4gbm9kZXM7XG4gIH1cblxuICB2aXNpdFRhZ1BsYWNlaG9sZGVyKHBoOiBpMThuLlRhZ1BsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogeG1sLk5vZGVbXSB7XG4gICAgY29uc3Qgc3RhcnRUYWdBc1RleHQgPSBuZXcgeG1sLlRleHQoYDwke3BoLnRhZ30+YCk7XG4gICAgY29uc3Qgc3RhcnRFeCA9IG5ldyB4bWwuVGFnKF9FWEFNUExFX1RBRywge30sIFtzdGFydFRhZ0FzVGV4dF0pO1xuICAgIC8vIFRDIHJlcXVpcmVzIFBIIHRvIGhhdmUgYSBub24gZW1wdHkgRVgsIGFuZCB1c2VzIHRoZSB0ZXh0IG5vZGUgdG8gc2hvdyB0aGUgXCJvcmlnaW5hbFwiIHZhbHVlLlxuICAgIGNvbnN0IHN0YXJ0VGFnUGggPVxuICAgICAgICBuZXcgeG1sLlRhZyhfUExBQ0VIT0xERVJfVEFHLCB7bmFtZTogcGguc3RhcnROYW1lfSwgW3N0YXJ0RXgsIHN0YXJ0VGFnQXNUZXh0XSk7XG4gICAgaWYgKHBoLmlzVm9pZCkge1xuICAgICAgLy8gdm9pZCB0YWdzIGhhdmUgbm8gY2hpbGRyZW4gbm9yIGNsb3NpbmcgdGFnc1xuICAgICAgcmV0dXJuIFtzdGFydFRhZ1BoXTtcbiAgICB9XG5cbiAgICBjb25zdCBjbG9zZVRhZ0FzVGV4dCA9IG5ldyB4bWwuVGV4dChgPC8ke3BoLnRhZ30+YCk7XG4gICAgY29uc3QgY2xvc2VFeCA9IG5ldyB4bWwuVGFnKF9FWEFNUExFX1RBRywge30sIFtjbG9zZVRhZ0FzVGV4dF0pO1xuICAgIC8vIFRDIHJlcXVpcmVzIFBIIHRvIGhhdmUgYSBub24gZW1wdHkgRVgsIGFuZCB1c2VzIHRoZSB0ZXh0IG5vZGUgdG8gc2hvdyB0aGUgXCJvcmlnaW5hbFwiIHZhbHVlLlxuICAgIGNvbnN0IGNsb3NlVGFnUGggPVxuICAgICAgICBuZXcgeG1sLlRhZyhfUExBQ0VIT0xERVJfVEFHLCB7bmFtZTogcGguY2xvc2VOYW1lfSwgW2Nsb3NlRXgsIGNsb3NlVGFnQXNUZXh0XSk7XG5cbiAgICByZXR1cm4gW3N0YXJ0VGFnUGgsIC4uLnRoaXMuc2VyaWFsaXplKHBoLmNoaWxkcmVuKSwgY2xvc2VUYWdQaF07XG4gIH1cblxuICB2aXNpdFBsYWNlaG9sZGVyKHBoOiBpMThuLlBsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogeG1sLk5vZGVbXSB7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbkFzVGV4dCA9IG5ldyB4bWwuVGV4dChge3ske3BoLnZhbHVlfX19YCk7XG4gICAgLy8gRXhhbXBsZSB0YWcgbmVlZHMgdG8gYmUgbm90LWVtcHR5IGZvciBUQy5cbiAgICBjb25zdCBleFRhZyA9IG5ldyB4bWwuVGFnKF9FWEFNUExFX1RBRywge30sIFtpbnRlcnBvbGF0aW9uQXNUZXh0XSk7XG4gICAgcmV0dXJuIFtcbiAgICAgIC8vIFRDIHJlcXVpcmVzIFBIIHRvIGhhdmUgYSBub24gZW1wdHkgRVgsIGFuZCB1c2VzIHRoZSB0ZXh0IG5vZGUgdG8gc2hvdyB0aGUgXCJvcmlnaW5hbFwiIHZhbHVlLlxuICAgICAgbmV3IHhtbC5UYWcoX1BMQUNFSE9MREVSX1RBRywge25hbWU6IHBoLm5hbWV9LCBbZXhUYWcsIGludGVycG9sYXRpb25Bc1RleHRdKVxuICAgIF07XG4gIH1cblxuICB2aXNpdEljdVBsYWNlaG9sZGVyKHBoOiBpMThuLkljdVBsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogeG1sLk5vZGVbXSB7XG4gICAgY29uc3QgaWN1RXhwcmVzc2lvbiA9IHBoLnZhbHVlLmV4cHJlc3Npb247XG4gICAgY29uc3QgaWN1VHlwZSA9IHBoLnZhbHVlLnR5cGU7XG4gICAgY29uc3QgaWN1Q2FzZXMgPSBPYmplY3Qua2V5cyhwaC52YWx1ZS5jYXNlcykubWFwKCh2YWx1ZTogc3RyaW5nKSA9PiB2YWx1ZSArICcgey4uLn0nKS5qb2luKCcgJyk7XG4gICAgY29uc3QgaWN1QXNUZXh0ID0gbmV3IHhtbC5UZXh0KGB7JHtpY3VFeHByZXNzaW9ufSwgJHtpY3VUeXBlfSwgJHtpY3VDYXNlc319YCk7XG4gICAgY29uc3QgZXhUYWcgPSBuZXcgeG1sLlRhZyhfRVhBTVBMRV9UQUcsIHt9LCBbaWN1QXNUZXh0XSk7XG4gICAgcmV0dXJuIFtcbiAgICAgIC8vIFRDIHJlcXVpcmVzIFBIIHRvIGhhdmUgYSBub24gZW1wdHkgRVgsIGFuZCB1c2VzIHRoZSB0ZXh0IG5vZGUgdG8gc2hvdyB0aGUgXCJvcmlnaW5hbFwiIHZhbHVlLlxuICAgICAgbmV3IHhtbC5UYWcoX1BMQUNFSE9MREVSX1RBRywge25hbWU6IHBoLm5hbWV9LCBbZXhUYWcsIGljdUFzVGV4dF0pXG4gICAgXTtcbiAgfVxuXG4gIHNlcmlhbGl6ZShub2RlczogaTE4bi5Ob2RlW10pOiB4bWwuTm9kZVtdIHtcbiAgICByZXR1cm4gW10uY29uY2F0KC4uLm5vZGVzLm1hcChub2RlID0+IG5vZGUudmlzaXQodGhpcykpKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGlnZXN0KG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSk6IHN0cmluZyB7XG4gIHJldHVybiBkZWNpbWFsRGlnZXN0KG1lc3NhZ2UpO1xufVxuXG4vLyBUQyByZXF1aXJlcyBhdCBsZWFzdCBvbmUgbm9uLWVtcHR5IGV4YW1wbGUgb24gcGxhY2Vob2xkZXJzXG5jbGFzcyBFeGFtcGxlVmlzaXRvciBpbXBsZW1lbnRzIHhtbC5JVmlzaXRvciB7XG4gIGFkZERlZmF1bHRFeGFtcGxlcyhub2RlOiB4bWwuTm9kZSk6IHhtbC5Ob2RlIHtcbiAgICBub2RlLnZpc2l0KHRoaXMpO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRUYWcodGFnOiB4bWwuVGFnKTogdm9pZCB7XG4gICAgaWYgKHRhZy5uYW1lID09PSBfUExBQ0VIT0xERVJfVEFHKSB7XG4gICAgICBpZiAoIXRhZy5jaGlsZHJlbiB8fCB0YWcuY2hpbGRyZW4ubGVuZ3RoID09IDApIHtcbiAgICAgICAgY29uc3QgZXhUZXh0ID0gbmV3IHhtbC5UZXh0KHRhZy5hdHRyc1snbmFtZSddIHx8ICcuLi4nKTtcbiAgICAgICAgdGFnLmNoaWxkcmVuID0gW25ldyB4bWwuVGFnKF9FWEFNUExFX1RBRywge30sIFtleFRleHRdKV07XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0YWcuY2hpbGRyZW4pIHtcbiAgICAgIHRhZy5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IHhtbC5UZXh0KTogdm9pZCB7fVxuICB2aXNpdERlY2xhcmF0aW9uKGRlY2w6IHhtbC5EZWNsYXJhdGlvbik6IHZvaWQge31cbiAgdmlzaXREb2N0eXBlKGRvY3R5cGU6IHhtbC5Eb2N0eXBlKTogdm9pZCB7fVxufVxuXG4vLyBYTUIvWFRCIHBsYWNlaG9sZGVycyBjYW4gb25seSBjb250YWluIEEtWiwgMC05IGFuZCBfXG5leHBvcnQgZnVuY3Rpb24gdG9QdWJsaWNOYW1lKGludGVybmFsTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGludGVybmFsTmFtZS50b1VwcGVyQ2FzZSgpLnJlcGxhY2UoL1teQS1aMC05X10vZywgJ18nKTtcbn1cbiJdfQ==