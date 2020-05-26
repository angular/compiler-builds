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
        define("@angular/compiler/src/ml_parser/xml_parser", ["require", "exports", "tslib", "@angular/compiler/src/ml_parser/parser", "@angular/compiler/src/ml_parser/xml_tags", "@angular/compiler/src/ml_parser/parser"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.XmlParser = void 0;
    var tslib_1 = require("tslib");
    var parser_1 = require("@angular/compiler/src/ml_parser/parser");
    var xml_tags_1 = require("@angular/compiler/src/ml_parser/xml_tags");
    var parser_2 = require("@angular/compiler/src/ml_parser/parser");
    Object.defineProperty(exports, "ParseTreeResult", { enumerable: true, get: function () { return parser_2.ParseTreeResult; } });
    Object.defineProperty(exports, "TreeError", { enumerable: true, get: function () { return parser_2.TreeError; } });
    var XmlParser = /** @class */ (function (_super) {
        tslib_1.__extends(XmlParser, _super);
        function XmlParser() {
            return _super.call(this, xml_tags_1.getXmlTagDefinition) || this;
        }
        XmlParser.prototype.parse = function (source, url, options) {
            return _super.prototype.parse.call(this, source, url, options);
        };
        return XmlParser;
    }(parser_1.Parser));
    exports.XmlParser = XmlParser;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieG1sX3BhcnNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9tbF9wYXJzZXIveG1sX3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBR0gsaUVBQWlEO0lBQ2pELHFFQUErQztJQUUvQyxpRUFBb0Q7SUFBNUMseUdBQUEsZUFBZSxPQUFBO0lBQUUsbUdBQUEsU0FBUyxPQUFBO0lBRWxDO1FBQStCLHFDQUFNO1FBQ25DO21CQUNFLGtCQUFNLDhCQUFtQixDQUFDO1FBQzVCLENBQUM7UUFFRCx5QkFBSyxHQUFMLFVBQU0sTUFBYyxFQUFFLEdBQVcsRUFBRSxPQUF5QjtZQUMxRCxPQUFPLGlCQUFNLEtBQUssWUFBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFDSCxnQkFBQztJQUFELENBQUMsQUFSRCxDQUErQixlQUFNLEdBUXBDO0lBUlksOEJBQVMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7VG9rZW5pemVPcHRpb25zfSBmcm9tICcuL2xleGVyJztcbmltcG9ydCB7UGFyc2VyLCBQYXJzZVRyZWVSZXN1bHR9IGZyb20gJy4vcGFyc2VyJztcbmltcG9ydCB7Z2V0WG1sVGFnRGVmaW5pdGlvbn0gZnJvbSAnLi94bWxfdGFncyc7XG5cbmV4cG9ydCB7UGFyc2VUcmVlUmVzdWx0LCBUcmVlRXJyb3J9IGZyb20gJy4vcGFyc2VyJztcblxuZXhwb3J0IGNsYXNzIFhtbFBhcnNlciBleHRlbmRzIFBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKGdldFhtbFRhZ0RlZmluaXRpb24pO1xuICB9XG5cbiAgcGFyc2Uoc291cmNlOiBzdHJpbmcsIHVybDogc3RyaW5nLCBvcHRpb25zPzogVG9rZW5pemVPcHRpb25zKTogUGFyc2VUcmVlUmVzdWx0IHtcbiAgICByZXR1cm4gc3VwZXIucGFyc2Uoc291cmNlLCB1cmwsIG9wdGlvbnMpO1xuICB9XG59XG4iXX0=