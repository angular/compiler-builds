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
        define("@angular/compiler/src/i18n/message_bundle", ["require", "exports", "tslib", "@angular/compiler/src/i18n/extractor_merger", "@angular/compiler/src/i18n/i18n_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MessageBundle = void 0;
    var tslib_1 = require("tslib");
    var extractor_merger_1 = require("@angular/compiler/src/i18n/extractor_merger");
    var i18n = require("@angular/compiler/src/i18n/i18n_ast");
    /**
     * A container for message extracted from the templates.
     */
    var MessageBundle = /** @class */ (function () {
        function MessageBundle(_htmlParser, _implicitTags, _implicitAttrs, _locale) {
            if (_locale === void 0) { _locale = null; }
            this._htmlParser = _htmlParser;
            this._implicitTags = _implicitTags;
            this._implicitAttrs = _implicitAttrs;
            this._locale = _locale;
            this._messages = [];
        }
        MessageBundle.prototype.updateFromTemplate = function (html, url, interpolationConfig) {
            var _a;
            var htmlParserResult = this._htmlParser.parse(html, url, { tokenizeExpansionForms: true, interpolationConfig: interpolationConfig });
            if (htmlParserResult.errors.length) {
                return htmlParserResult.errors;
            }
            var i18nParserResult = (0, extractor_merger_1.extractMessages)(htmlParserResult.rootNodes, interpolationConfig, this._implicitTags, this._implicitAttrs);
            if (i18nParserResult.errors.length) {
                return i18nParserResult.errors;
            }
            (_a = this._messages).push.apply(_a, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(i18nParserResult.messages), false));
            return [];
        };
        // Return the message in the internal format
        // The public (serialized) format might be different, see the `write` method.
        MessageBundle.prototype.getMessages = function () {
            return this._messages;
        };
        MessageBundle.prototype.write = function (serializer, filterSources) {
            var messages = {};
            var mapperVisitor = new MapPlaceholderNames();
            // Deduplicate messages based on their ID
            this._messages.forEach(function (message) {
                var _a;
                var id = serializer.digest(message);
                if (!messages.hasOwnProperty(id)) {
                    messages[id] = message;
                }
                else {
                    (_a = messages[id].sources).push.apply(_a, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(message.sources), false));
                }
            });
            // Transform placeholder names using the serializer mapping
            var msgList = Object.keys(messages).map(function (id) {
                var mapper = serializer.createNameMapper(messages[id]);
                var src = messages[id];
                var nodes = mapper ? mapperVisitor.convert(src.nodes, mapper) : src.nodes;
                var transformedMessage = new i18n.Message(nodes, {}, {}, src.meaning, src.description, id);
                transformedMessage.sources = src.sources;
                if (filterSources) {
                    transformedMessage.sources.forEach(function (source) { return source.filePath = filterSources(source.filePath); });
                }
                return transformedMessage;
            });
            return serializer.write(msgList, this._locale);
        };
        return MessageBundle;
    }());
    exports.MessageBundle = MessageBundle;
    // Transform an i18n AST by renaming the placeholder nodes with the given mapper
    var MapPlaceholderNames = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(MapPlaceholderNames, _super);
        function MapPlaceholderNames() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MapPlaceholderNames.prototype.convert = function (nodes, mapper) {
            var _this = this;
            return mapper ? nodes.map(function (n) { return n.visit(_this, mapper); }) : nodes;
        };
        MapPlaceholderNames.prototype.visitTagPlaceholder = function (ph, mapper) {
            var _this = this;
            var startName = mapper.toPublicName(ph.startName);
            var closeName = ph.closeName ? mapper.toPublicName(ph.closeName) : ph.closeName;
            var children = ph.children.map(function (n) { return n.visit(_this, mapper); });
            return new i18n.TagPlaceholder(ph.tag, ph.attrs, startName, closeName, children, ph.isVoid, ph.sourceSpan, ph.startSourceSpan, ph.endSourceSpan);
        };
        MapPlaceholderNames.prototype.visitPlaceholder = function (ph, mapper) {
            return new i18n.Placeholder(ph.value, mapper.toPublicName(ph.name), ph.sourceSpan);
        };
        MapPlaceholderNames.prototype.visitIcuPlaceholder = function (ph, mapper) {
            return new i18n.IcuPlaceholder(ph.value, mapper.toPublicName(ph.name), ph.sourceSpan);
        };
        return MapPlaceholderNames;
    }(i18n.CloneVisitor));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZV9idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9tZXNzYWdlX2J1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBTUgsZ0ZBQW1EO0lBQ25ELDBEQUFtQztJQUluQzs7T0FFRztJQUNIO1FBR0UsdUJBQ1ksV0FBdUIsRUFBVSxhQUF1QixFQUN4RCxjQUF1QyxFQUFVLE9BQTJCO1lBQTNCLHdCQUFBLEVBQUEsY0FBMkI7WUFENUUsZ0JBQVcsR0FBWCxXQUFXLENBQVk7WUFBVSxrQkFBYSxHQUFiLGFBQWEsQ0FBVTtZQUN4RCxtQkFBYyxHQUFkLGNBQWMsQ0FBeUI7WUFBVSxZQUFPLEdBQVAsT0FBTyxDQUFvQjtZQUpoRixjQUFTLEdBQW1CLEVBQUUsQ0FBQztRQUlvRCxDQUFDO1FBRTVGLDBDQUFrQixHQUFsQixVQUFtQixJQUFZLEVBQUUsR0FBVyxFQUFFLG1CQUF3Qzs7WUFFcEYsSUFBTSxnQkFBZ0IsR0FDbEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFDLHNCQUFzQixFQUFFLElBQUksRUFBRSxtQkFBbUIscUJBQUEsRUFBQyxDQUFDLENBQUM7WUFFM0YsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUNsQyxPQUFPLGdCQUFnQixDQUFDLE1BQU0sQ0FBQzthQUNoQztZQUVELElBQU0sZ0JBQWdCLEdBQUcsSUFBQSxrQ0FBZSxFQUNwQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7WUFFOUYsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUNsQyxPQUFPLGdCQUFnQixDQUFDLE1B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UUFDSCwwQkFBQztJQUFELENBQUMsQUF2QkQsQ0FBa0MsSUFBSSxDQUFDLFlBQVksR0F1QmxEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SHRtbFBhcnNlcn0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmltcG9ydCB7SW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7UGFyc2VFcnJvcn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCB7ZXh0cmFjdE1lc3NhZ2VzfSBmcm9tICcuL2V4dHJhY3Rvcl9tZXJnZXInO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuL2kxOG5fYXN0JztcbmltcG9ydCB7UGxhY2Vob2xkZXJNYXBwZXIsIFNlcmlhbGl6ZXJ9IGZyb20gJy4vc2VyaWFsaXplcnMvc2VyaWFsaXplcic7XG5cblxuLyoqXG4gKiBBIGNvbnRhaW5lciBmb3IgbWVzc2FnZSBleHRyYWN0ZWQgZnJvbSB0aGUgdGVtcGxhdGVzLlxuICovXG5leHBvcnQgY2xhc3MgTWVzc2FnZUJ1bmRsZSB7XG4gIHByaXZhdGUgX21lc3NhZ2VzOiBpMThuLk1lc3NhZ2VbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfaHRtbFBhcnNlcjogSHRtbFBhcnNlciwgcHJpdmF0ZSBfaW1wbGljaXRUYWdzOiBzdHJpbmdbXSxcbiAgICAgIHByaXZhdGUgX2ltcGxpY2l0QXR0cnM6IHtbazogc3RyaW5nXTogc3RyaW5nW119LCBwcml2YXRlIF9sb2NhbGU6IHN0cmluZ3xudWxsID0gbnVsbCkge31cblxuICB1cGRhdGVGcm9tVGVtcGxhdGUoaHRtbDogc3RyaW5nLCB1cmw6IHN0cmluZywgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6XG4gICAgICBQYXJzZUVycm9yW10ge1xuICAgIGNvbnN0IGh0bWxQYXJzZXJSZXN1bHQgPVxuICAgICAgICB0aGlzLl9odG1sUGFyc2VyLnBhcnNlKGh0bWwsIHVybCwge3Rva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWUsIGludGVycG9sYXRpb25Db25maWd9KTtcblxuICAgIGlmIChodG1sUGFyc2VyUmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBodG1sUGFyc2VyUmVzdWx0LmVycm9ycztcbiAgICB9XG5cbiAgICBjb25zdCBpMThuUGFyc2VyUmVzdWx0ID0gZXh0cmFjdE1lc3NhZ2VzKFxuICAgICAgICBodG1sUGFyc2VyUmVzdWx0LnJvb3ROb2RlcywgaW50ZXJwb2xhdGlvbkNvbmZpZywgdGhpcy5faW1wbGljaXRUYWdzLCB0aGlzLl9pbXBsaWNpdEF0dHJzKTtcblxuICAgIGlmIChpMThuUGFyc2VyUmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBpMThuUGFyc2VyUmVzdWx0LmVycm9ycztcbiAgICB9XG5cbiAgICB0aGlzLl9tZXNzYWdlcy5wdXNoKC4uLmkxOG5QYXJzZXJSZXN1bHQubWVzc2FnZXMpO1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbWVzc2FnZSBpbiB0aGUgaW50ZXJuYWwgZm9ybWF0XG4gIC8vIFRoZSBwdWJsaWMgKHNlcmlhbGl6ZWQpIGZvcm1hdCBtaWdodCBiZSBkaWZmZXJlbnQsIHNlZSB0aGUgYHdyaXRlYCBtZXRob2QuXG4gIGdldE1lc3NhZ2VzKCk6IGkxOG4uTWVzc2FnZVtdIHtcbiAgICByZXR1cm4gdGhpcy5fbWVzc2FnZXM7XG4gIH1cblxuICB3cml0ZShzZXJpYWxpemVyOiBTZXJpYWxpemVyLCBmaWx0ZXJTb3VyY2VzPzogKHBhdGg6IHN0cmluZykgPT4gc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBtZXNzYWdlczoge1tpZDogc3RyaW5nXTogaTE4bi5NZXNzYWdlfSA9IHt9O1xuICAgIGNvbnN0IG1hcHBlclZpc2l0b3IgPSBuZXcgTWFwUGxhY2Vob2xkZXJOYW1lcygpO1xuXG4gICAgLy8gRGVkdXBsaWNhdGUgbWVzc2FnZXMgYmFzZWQgb24gdGhlaXIgSURcbiAgICB0aGlzLl9tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4ge1xuICAgICAgY29uc3QgaWQgPSBzZXJpYWxpemVyLmRpZ2VzdChtZXNzYWdlKTtcbiAgICAgIGlmICghbWVzc2FnZXMuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgIG1lc3NhZ2VzW2lkXSA9IG1lc3NhZ2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZXNzYWdlc1tpZF0uc291cmNlcy5wdXNoKC4uLm1lc3NhZ2Uuc291cmNlcyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUcmFuc2Zvcm0gcGxhY2Vob2xkZXIgbmFtZXMgdXNpbmcgdGhlIHNlcmlhbGl6ZXIgbWFwcGluZ1xuICAgIGNvbnN0IG1zZ0xpc3QgPSBPYmplY3Qua2V5cyhtZXNzYWdlcykubWFwKGlkID0+IHtcbiAgICAgIGNvbnN0IG1hcHBlciA9IHNlcmlhbGl6ZXIuY3JlYXRlTmFtZU1hcHBlcihtZXNzYWdlc1tpZF0pO1xuICAgICAgY29uc3Qgc3JjID0gbWVzc2FnZXNbaWRdO1xuICAgICAgY29uc3Qgbm9kZXMgPSBtYXBwZXIgPyBtYXBwZXJWaXNpdG9yLmNvbnZlcnQoc3JjLm5vZGVzLCBtYXBwZXIpIDogc3JjLm5vZGVzO1xuICAgICAgbGV0IHRyYW5zZm9ybWVkTWVzc2FnZSA9IG5ldyBpMThuLk1lc3NhZ2Uobm9kZXMsIHt9LCB7fSwgc3JjLm1lYW5pbmcsIHNyYy5kZXNjcmlwdGlvbiwgaWQpO1xuICAgICAgdHJhbnNmb3JtZWRNZXNzYWdlLnNvdXJjZXMgPSBzcmMuc291cmNlcztcbiAgICAgIGlmIChmaWx0ZXJTb3VyY2VzKSB7XG4gICAgICAgIHRyYW5zZm9ybWVkTWVzc2FnZS5zb3VyY2VzLmZvckVhY2goXG4gICAgICAgICAgICAoc291cmNlOiBpMThuLk1lc3NhZ2VTcGFuKSA9PiBzb3VyY2UuZmlsZVBhdGggPSBmaWx0ZXJTb3VyY2VzKHNvdXJjZS5maWxlUGF0aCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRyYW5zZm9ybWVkTWVzc2FnZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzZXJpYWxpemVyLndyaXRlKG1zZ0xpc3QsIHRoaXMuX2xvY2FsZSk7XG4gIH1cbn1cblxuLy8gVHJhbnNmb3JtIGFuIGkxOG4gQVNUIGJ5IHJlbmFtaW5nIHRoZSBwbGFjZWhvbGRlciBub2RlcyB3aXRoIHRoZSBnaXZlbiBtYXBwZXJcbmNsYXNzIE1hcFBsYWNlaG9sZGVyTmFtZXMgZXh0ZW5kcyBpMThuLkNsb25lVmlzaXRvciB7XG4gIGNvbnZlcnQobm9kZXM6IGkxOG4uTm9kZVtdLCBtYXBwZXI6IFBsYWNlaG9sZGVyTWFwcGVyKTogaTE4bi5Ob2RlW10ge1xuICAgIHJldHVybiBtYXBwZXIgPyBub2Rlcy5tYXAobiA9PiBuLnZpc2l0KHRoaXMsIG1hcHBlcikpIDogbm9kZXM7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdFRhZ1BsYWNlaG9sZGVyKHBoOiBpMThuLlRhZ1BsYWNlaG9sZGVyLCBtYXBwZXI6IFBsYWNlaG9sZGVyTWFwcGVyKTpcbiAgICAgIGkxOG4uVGFnUGxhY2Vob2xkZXIge1xuICAgIGNvbnN0IHN0YXJ0TmFtZSA9IG1hcHBlci50b1B1YmxpY05hbWUocGguc3RhcnROYW1lKSE7XG4gICAgY29uc3QgY2xvc2VOYW1lID0gcGguY2xvc2VOYW1lID8gbWFwcGVyLnRvUHVibGljTmFtZShwaC5jbG9zZU5hbWUpISA6IHBoLmNsb3NlTmFtZTtcbiAgICBjb25zdCBjaGlsZHJlbiA9IHBoLmNoaWxkcmVuLm1hcChuID0+IG4udmlzaXQodGhpcywgbWFwcGVyKSk7XG4gICAgcmV0dXJuIG5ldyBpMThuLlRhZ1BsYWNlaG9sZGVyKFxuICAgICAgICBwaC50YWcsIHBoLmF0dHJzLCBzdGFydE5hbWUsIGNsb3NlTmFtZSwgY2hpbGRyZW4sIHBoLmlzVm9pZCwgcGguc291cmNlU3BhbixcbiAgICAgICAgcGguc3RhcnRTb3VyY2VTcGFuLCBwaC5lbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIsIG1hcHBlcjogUGxhY2Vob2xkZXJNYXBwZXIpOiBpMThuLlBsYWNlaG9sZGVyIHtcbiAgICByZXR1cm4gbmV3IGkxOG4uUGxhY2Vob2xkZXIocGgudmFsdWUsIG1hcHBlci50b1B1YmxpY05hbWUocGgubmFtZSkhLCBwaC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IGkxOG4uSWN1UGxhY2Vob2xkZXIsIG1hcHBlcjogUGxhY2Vob2xkZXJNYXBwZXIpOlxuICAgICAgaTE4bi5JY3VQbGFjZWhvbGRlciB7XG4gICAgcmV0dXJuIG5ldyBpMThuLkljdVBsYWNlaG9sZGVyKHBoLnZhbHVlLCBtYXBwZXIudG9QdWJsaWNOYW1lKHBoLm5hbWUpISwgcGguc291cmNlU3Bhbik7XG4gIH1cbn1cbiJdfQ==