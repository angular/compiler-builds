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
        define("@angular/compiler/src/ml_parser/html_parser", ["require", "exports", "tslib", "@angular/compiler/src/ml_parser/html_tags", "@angular/compiler/src/ml_parser/parser", "@angular/compiler/src/ml_parser/parser"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HtmlParser = void 0;
    var tslib_1 = require("tslib");
    var html_tags_1 = require("@angular/compiler/src/ml_parser/html_tags");
    var parser_1 = require("@angular/compiler/src/ml_parser/parser");
    var parser_2 = require("@angular/compiler/src/ml_parser/parser");
    Object.defineProperty(exports, "ParseTreeResult", { enumerable: true, get: function () { return parser_2.ParseTreeResult; } });
    Object.defineProperty(exports, "TreeError", { enumerable: true, get: function () { return parser_2.TreeError; } });
    var HtmlParser = /** @class */ (function (_super) {
        tslib_1.__extends(HtmlParser, _super);
        function HtmlParser() {
            return _super.call(this, html_tags_1.getHtmlTagDefinition) || this;
        }
        HtmlParser.prototype.parse = function (source, url, options) {
            return _super.prototype.parse.call(this, source, url, options);
        };
        return HtmlParser;
    }(parser_1.Parser));
    exports.HtmlParser = HtmlParser;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbF9wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvbWxfcGFyc2VyL2h0bWxfcGFyc2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCx1RUFBaUQ7SUFFakQsaUVBQWlEO0lBRWpELGlFQUFvRDtJQUE1Qyx5R0FBQSxlQUFlLE9BQUE7SUFBRSxtR0FBQSxTQUFTLE9BQUE7SUFFbEM7UUFBZ0Msc0NBQU07UUFDcEM7bUJBQ0Usa0JBQU0sZ0NBQW9CLENBQUM7UUFDN0IsQ0FBQztRQUVELDBCQUFLLEdBQUwsVUFBTSxNQUFjLEVBQUUsR0FBVyxFQUFFLE9BQXlCO1lBQzFELE9BQU8saUJBQU0sS0FBSyxZQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUNILGlCQUFDO0lBQUQsQ0FBQyxBQVJELENBQWdDLGVBQU0sR0FRckM7SUFSWSxnQ0FBVSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtnZXRIdG1sVGFnRGVmaW5pdGlvbn0gZnJvbSAnLi9odG1sX3RhZ3MnO1xuaW1wb3J0IHtUb2tlbml6ZU9wdGlvbnN9IGZyb20gJy4vbGV4ZXInO1xuaW1wb3J0IHtQYXJzZXIsIFBhcnNlVHJlZVJlc3VsdH0gZnJvbSAnLi9wYXJzZXInO1xuXG5leHBvcnQge1BhcnNlVHJlZVJlc3VsdCwgVHJlZUVycm9yfSBmcm9tICcuL3BhcnNlcic7XG5cbmV4cG9ydCBjbGFzcyBIdG1sUGFyc2VyIGV4dGVuZHMgUGFyc2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoZ2V0SHRtbFRhZ0RlZmluaXRpb24pO1xuICB9XG5cbiAgcGFyc2Uoc291cmNlOiBzdHJpbmcsIHVybDogc3RyaW5nLCBvcHRpb25zPzogVG9rZW5pemVPcHRpb25zKTogUGFyc2VUcmVlUmVzdWx0IHtcbiAgICByZXR1cm4gc3VwZXIucGFyc2Uoc291cmNlLCB1cmwsIG9wdGlvbnMpO1xuICB9XG59XG4iXX0=