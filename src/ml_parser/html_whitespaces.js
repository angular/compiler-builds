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
        define("@angular/compiler/src/ml_parser/html_whitespaces", ["require", "exports", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/entities", "@angular/compiler/src/ml_parser/parser"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.removeWhitespaces = exports.WhitespaceVisitor = exports.replaceNgsp = exports.PRESERVE_WS_ATTR_NAME = void 0;
    var html = require("@angular/compiler/src/ml_parser/ast");
    var entities_1 = require("@angular/compiler/src/ml_parser/entities");
    var parser_1 = require("@angular/compiler/src/ml_parser/parser");
    exports.PRESERVE_WS_ATTR_NAME = 'ngPreserveWhitespaces';
    var SKIP_WS_TRIM_TAGS = new Set(['pre', 'template', 'textarea', 'script', 'style']);
    // Equivalent to \s with \u00a0 (non-breaking space) excluded.
    // Based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
    var WS_CHARS = ' \f\n\r\t\v\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
    var NO_WS_REGEXP = new RegExp("[^" + WS_CHARS + "]");
    var WS_REPLACE_REGEXP = new RegExp("[" + WS_CHARS + "]{2,}", 'g');
    function hasPreserveWhitespacesAttr(attrs) {
        return attrs.some(function (attr) { return attr.name === exports.PRESERVE_WS_ATTR_NAME; });
    }
    /**
     * Angular Dart introduced &ngsp; as a placeholder for non-removable space, see:
     * https://github.com/dart-lang/angular/blob/0bb611387d29d65b5af7f9d2515ab571fd3fbee4/_tests/test/compiler/preserve_whitespace_test.dart#L25-L32
     * In Angular Dart &ngsp; is converted to the 0xE500 PUA (Private Use Areas) unicode character
     * and later on replaced by a space. We are re-implementing the same idea here.
     */
    function replaceNgsp(value) {
        // lexer is replacing the &ngsp; pseudo-entity with NGSP_UNICODE
        return value.replace(new RegExp(entities_1.NGSP_UNICODE, 'g'), ' ');
    }
    exports.replaceNgsp = replaceNgsp;
    /**
     * This visitor can walk HTML parse tree and remove / trim text nodes using the following rules:
     * - consider spaces, tabs and new lines as whitespace characters;
     * - drop text nodes consisting of whitespace characters only;
     * - for all other text nodes replace consecutive whitespace characters with one space;
     * - convert &ngsp; pseudo-entity to a single space;
     *
     * Removal and trimming of whitespaces have positive performance impact (less code to generate
     * while compiling templates, faster view creation). At the same time it can be "destructive"
     * in some cases (whitespaces can influence layout). Because of the potential of breaking layout
     * this visitor is not activated by default in Angular 5 and people need to explicitly opt-in for
     * whitespace removal. The default option for whitespace removal will be revisited in Angular 6
     * and might be changed to "on" by default.
     */
    var WhitespaceVisitor = /** @class */ (function () {
        function WhitespaceVisitor() {
        }
        WhitespaceVisitor.prototype.visitElement = function (element, context) {
            if (SKIP_WS_TRIM_TAGS.has(element.name) || hasPreserveWhitespacesAttr(element.attrs)) {
                // don't descent into elements where we need to preserve whitespaces
                // but still visit all attributes to eliminate one used as a market to preserve WS
                return new html.Element(element.name, html.visitAll(this, element.attrs), element.children, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
            }
            return new html.Element(element.name, element.attrs, visitAllWithSiblings(this, element.children), element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
        };
        WhitespaceVisitor.prototype.visitAttribute = function (attribute, context) {
            return attribute.name !== exports.PRESERVE_WS_ATTR_NAME ? attribute : null;
        };
        WhitespaceVisitor.prototype.visitText = function (text, context) {
            var isNotBlank = text.value.match(NO_WS_REGEXP);
            var hasExpansionSibling = context &&
                (context.prev instanceof html.Expansion || context.next instanceof html.Expansion);
            if (isNotBlank || hasExpansionSibling) {
                return new html.Text(replaceNgsp(text.value).replace(WS_REPLACE_REGEXP, ' '), text.sourceSpan, text.i18n);
            }
            return null;
        };
        WhitespaceVisitor.prototype.visitComment = function (comment, context) {
            return comment;
        };
        WhitespaceVisitor.prototype.visitExpansion = function (expansion, context) {
            return expansion;
        };
        WhitespaceVisitor.prototype.visitExpansionCase = function (expansionCase, context) {
            return expansionCase;
        };
        return WhitespaceVisitor;
    }());
    exports.WhitespaceVisitor = WhitespaceVisitor;
    function removeWhitespaces(htmlAstWithErrors) {
        return new parser_1.ParseTreeResult(html.visitAll(new WhitespaceVisitor(), htmlAstWithErrors.rootNodes), htmlAstWithErrors.errors);
    }
    exports.removeWhitespaces = removeWhitespaces;
    function visitAllWithSiblings(visitor, nodes) {
        var result = [];
        nodes.forEach(function (ast, i) {
            var context = { prev: nodes[i - 1], next: nodes[i + 1] };
            var astResult = ast.visit(visitor, context);
            if (astResult) {
                result.push(astResult);
            }
        });
        return result;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbF93aGl0ZXNwYWNlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCwwREFBOEI7SUFDOUIscUVBQXdDO0lBQ3hDLGlFQUF5QztJQUU1QixRQUFBLHFCQUFxQixHQUFHLHVCQUF1QixDQUFDO0lBRTdELElBQU0saUJBQWlCLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUV0Riw4REFBOEQ7SUFDOUQsbUdBQW1HO0lBQ25HLElBQU0sUUFBUSxHQUFHLDBFQUEwRSxDQUFDO0lBQzVGLElBQU0sWUFBWSxHQUFHLElBQUksTUFBTSxDQUFDLE9BQUssUUFBUSxNQUFHLENBQUMsQ0FBQztJQUNsRCxJQUFNLGlCQUFpQixHQUFHLElBQUksTUFBTSxDQUFDLE1BQUksUUFBUSxVQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFL0QsU0FBUywwQkFBMEIsQ0FBQyxLQUF1QjtRQUN6RCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBQyxJQUFvQixJQUFLLE9BQUEsSUFBSSxDQUFDLElBQUksS0FBSyw2QkFBcUIsRUFBbkMsQ0FBbUMsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILFNBQWdCLFdBQVcsQ0FBQyxLQUFhO1FBQ3ZDLGdFQUFnRTtRQUNoRSxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxNQUFNLENBQUMsdUJBQVksRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBSEQsa0NBR0M7SUFFRDs7Ozs7Ozs7Ozs7OztPQWFHO0lBQ0g7UUFBQTtR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QyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFDLENBQUM7WUFDaEYsSUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDOUMsSUFBSSxTQUFTLEVBQUU7Z0JBQ2IsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUN4QjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4vYXN0JztcbmltcG9ydCB7TkdTUF9VTklDT0RFfSBmcm9tICcuL2VudGl0aWVzJztcbmltcG9ydCB7UGFyc2VUcmVlUmVzdWx0fSBmcm9tICcuL3BhcnNlcic7XG5cbmV4cG9ydCBjb25zdCBQUkVTRVJWRV9XU19BVFRSX05BTUUgPSAnbmdQcmVzZXJ2ZVdoaXRlc3BhY2VzJztcblxuY29uc3QgU0tJUF9XU19UUklNX1RBR1MgPSBuZXcgU2V0KFsncHJlJywgJ3RlbXBsYXRlJywgJ3RleHRhcmVhJywgJ3NjcmlwdCcsICdzdHlsZSddKTtcblxuLy8gRXF1aXZhbGVudCB0byBcXHMgd2l0aCBcXHUwMGEwIChub24tYnJlYWtpbmcgc3BhY2UpIGV4Y2x1ZGVkLlxuLy8gQmFzZWQgb24gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvUmVnRXhwXG5jb25zdCBXU19DSEFSUyA9ICcgXFxmXFxuXFxyXFx0XFx2XFx1MTY4MFxcdTE4MGVcXHUyMDAwLVxcdTIwMGFcXHUyMDI4XFx1MjAyOVxcdTIwMmZcXHUyMDVmXFx1MzAwMFxcdWZlZmYnO1xuY29uc3QgTk9fV1NfUkVHRVhQID0gbmV3IFJlZ0V4cChgW14ke1dTX0NIQVJTfV1gKTtcbmNvbnN0IFdTX1JFUExBQ0VfUkVHRVhQID0gbmV3IFJlZ0V4cChgWyR7V1NfQ0hBUlN9XXsyLH1gLCAnZycpO1xuXG5mdW5jdGlvbiBoYXNQcmVzZXJ2ZVdoaXRlc3BhY2VzQXR0cihhdHRyczogaHRtbC5BdHRyaWJ1dGVbXSk6IGJvb2xlYW4ge1xuICByZXR1cm4gYXR0cnMuc29tZSgoYXR0cjogaHRtbC5BdHRyaWJ1dGUpID0+IGF0dHIubmFtZSA9PT0gUFJFU0VSVkVfV1NfQVRUUl9OQU1FKTtcbn1cblxuLyoqXG4gKiBBbmd1bGFyIERhcnQgaW50cm9kdWNlZCAmbmdzcDsgYXMgYSBwbGFjZWhvbGRlciBmb3Igbm9uLXJlbW92YWJsZSBzcGFjZSwgc2VlOlxuICogaHR0cHM6Ly9naXRodWIuY29tL2RhcnQtbGFuZy9hbmd1bGFyL2Jsb2IvMGJiNjExMzg3ZDI5ZDY1YjVhZjdmOWQyNTE1YWI1NzFmZDNmYmVlNC9fdGVzdHMvdGVzdC9jb21waWxlci9wcmVzZXJ2ZV93aGl0ZXNwYWNlX3Rlc3QuZGFydCNMMjUtTDMyXG4gKiBJbiBBbmd1bGFyIERhcnQgJm5nc3A7IGlzIGNvbnZlcnRlZCB0byB0aGUgMHhFNTAwIFBVQSAoUHJpdmF0ZSBVc2UgQXJlYXMpIHVuaWNvZGUgY2hhcmFjdGVyXG4gKiBhbmQgbGF0ZXIgb24gcmVwbGFjZWQgYnkgYSBzcGFjZS4gV2UgYXJlIHJlLWltcGxlbWVudGluZyB0aGUgc2FtZSBpZGVhIGhlcmUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXBsYWNlTmdzcCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gbGV4ZXIgaXMgcmVwbGFjaW5nIHRoZSAmbmdzcDsgcHNldWRvLWVudGl0eSB3aXRoIE5HU1BfVU5JQ09ERVxuICByZXR1cm4gdmFsdWUucmVwbGFjZShuZXcgUmVnRXhwKE5HU1BfVU5JQ09ERSwgJ2cnKSwgJyAnKTtcbn1cblxuLyoqXG4gKiBUaGlzIHZpc2l0b3IgY2FuIHdhbGsgSFRNTCBwYXJzZSB0cmVlIGFuZCByZW1vdmUgLyB0cmltIHRleHQgbm9kZXMgdXNpbmcgdGhlIGZvbGxvd2luZyBydWxlczpcbiAqIC0gY29uc2lkZXIgc3BhY2VzLCB0YWJzIGFuZCBuZXcgbGluZXMgYXMgd2hpdGVzcGFjZSBjaGFyYWN0ZXJzO1xuICogLSBkcm9wIHRleHQgbm9kZXMgY29uc2lzdGluZyBvZiB3aGl0ZXNwYWNlIGNoYXJhY3RlcnMgb25seTtcbiAqIC0gZm9yIGFsbCBvdGhlciB0ZXh0IG5vZGVzIHJlcGxhY2UgY29uc2VjdXRpdmUgd2hpdGVzcGFjZSBjaGFyYWN0ZXJzIHdpdGggb25lIHNwYWNlO1xuICogLSBjb252ZXJ0ICZuZ3NwOyBwc2V1ZG8tZW50aXR5IHRvIGEgc2luZ2xlIHNwYWNlO1xuICpcbiAqIFJlbW92YWwgYW5kIHRyaW1taW5nIG9mIHdoaXRlc3BhY2VzIGhhdmUgcG9zaXRpdmUgcGVyZm9ybWFuY2UgaW1wYWN0IChsZXNzIGNvZGUgdG8gZ2VuZXJhdGVcbiAqIHdoaWxlIGNvbXBpbGluZyB0ZW1wbGF0ZXMsIGZhc3RlciB2aWV3IGNyZWF0aW9uKS4gQXQgdGhlIHNhbWUgdGltZSBpdCBjYW4gYmUgXCJkZXN0cnVjdGl2ZVwiXG4gKiBpbiBzb21lIGNhc2VzICh3aGl0ZXNwYWNlcyBjYW4gaW5mbHVlbmNlIGxheW91dCkuIEJlY2F1c2Ugb2YgdGhlIHBvdGVudGlhbCBvZiBicmVha2luZyBsYXlvdXRcbiAqIHRoaXMgdmlzaXRvciBpcyBub3QgYWN0aXZhdGVkIGJ5IGRlZmF1bHQgaW4gQW5ndWxhciA1IGFuZCBwZW9wbGUgbmVlZCB0byBleHBsaWNpdGx5IG9wdC1pbiBmb3JcbiAqIHdoaXRlc3BhY2UgcmVtb3ZhbC4gVGhlIGRlZmF1bHQgb3B0aW9uIGZvciB3aGl0ZXNwYWNlIHJlbW92YWwgd2lsbCBiZSByZXZpc2l0ZWQgaW4gQW5ndWxhciA2XG4gKiBhbmQgbWlnaHQgYmUgY2hhbmdlZCB0byBcIm9uXCIgYnkgZGVmYXVsdC5cbiAqL1xuZXhwb3J0IGNsYXNzIFdoaXRlc3BhY2VWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICBpZiAoU0tJUF9XU19UUklNX1RBR1MuaGFzKGVsZW1lbnQubmFtZSkgfHwgaGFzUHJlc2VydmVXaGl0ZXNwYWNlc0F0dHIoZWxlbWVudC5hdHRycykpIHtcbiAgICAgIC8vIGRvbid0IGRlc2NlbnQgaW50byBlbGVtZW50cyB3aGVyZSB3ZSBuZWVkIHRvIHByZXNlcnZlIHdoaXRlc3BhY2VzXG4gICAgICAvLyBidXQgc3RpbGwgdmlzaXQgYWxsIGF0dHJpYnV0ZXMgdG8gZWxpbWluYXRlIG9uZSB1c2VkIGFzIGEgbWFya2V0IHRvIHByZXNlcnZlIFdTXG4gICAgICByZXR1cm4gbmV3IGh0bWwuRWxlbWVudChcbiAgICAgICAgICBlbGVtZW50Lm5hbWUsIGh0bWwudmlzaXRBbGwodGhpcywgZWxlbWVudC5hdHRycyksIGVsZW1lbnQuY2hpbGRyZW4sIGVsZW1lbnQuc291cmNlU3BhbixcbiAgICAgICAgICBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgaHRtbC5FbGVtZW50KFxuICAgICAgICBlbGVtZW50Lm5hbWUsIGVsZW1lbnQuYXR0cnMsIHZpc2l0QWxsV2l0aFNpYmxpbmdzKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pLFxuICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4sIGVsZW1lbnQuaTE4bik7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBhdHRyaWJ1dGUubmFtZSAhPT0gUFJFU0VSVkVfV1NfQVRUUl9OQU1FID8gYXR0cmlidXRlIDogbnVsbDtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIGNvbnRleHQ6IFNpYmxpbmdWaXNpdG9yQ29udGV4dHxudWxsKTogYW55IHtcbiAgICBjb25zdCBpc05vdEJsYW5rID0gdGV4dC52YWx1ZS5tYXRjaChOT19XU19SRUdFWFApO1xuICAgIGNvbnN0IGhhc0V4cGFuc2lvblNpYmxpbmcgPSBjb250ZXh0ICYmXG4gICAgICAgIChjb250ZXh0LnByZXYgaW5zdGFuY2VvZiBodG1sLkV4cGFuc2lvbiB8fCBjb250ZXh0Lm5leHQgaW5zdGFuY2VvZiBodG1sLkV4cGFuc2lvbik7XG5cbiAgICBpZiAoaXNOb3RCbGFuayB8fCBoYXNFeHBhbnNpb25TaWJsaW5nKSB7XG4gICAgICByZXR1cm4gbmV3IGh0bWwuVGV4dChcbiAgICAgICAgICByZXBsYWNlTmdzcCh0ZXh0LnZhbHVlKS5yZXBsYWNlKFdTX1JFUExBQ0VfUkVHRVhQLCAnICcpLCB0ZXh0LnNvdXJjZVNwYW4sIHRleHQuaTE4bik7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBjb21tZW50O1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gZXhwYW5zaW9uO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gZXhwYW5zaW9uQ2FzZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlV2hpdGVzcGFjZXMoaHRtbEFzdFdpdGhFcnJvcnM6IFBhcnNlVHJlZVJlc3VsdCk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gIHJldHVybiBuZXcgUGFyc2VUcmVlUmVzdWx0KFxuICAgICAgaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzKSxcbiAgICAgIGh0bWxBc3RXaXRoRXJyb3JzLmVycm9ycyk7XG59XG5cbmludGVyZmFjZSBTaWJsaW5nVmlzaXRvckNvbnRleHQge1xuICBwcmV2OiBodG1sLk5vZGV8dW5kZWZpbmVkO1xuICBuZXh0OiBodG1sLk5vZGV8dW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiB2aXNpdEFsbFdpdGhTaWJsaW5ncyh2aXNpdG9yOiBXaGl0ZXNwYWNlVmlzaXRvciwgbm9kZXM6IGh0bWwuTm9kZVtdKTogYW55W10ge1xuICBjb25zdCByZXN1bHQ6IGFueVtdID0gW107XG5cbiAgbm9kZXMuZm9yRWFjaCgoYXN0LCBpKSA9PiB7XG4gICAgY29uc3QgY29udGV4dDogU2libGluZ1Zpc2l0b3JDb250ZXh0ID0ge3ByZXY6IG5vZGVzW2kgLSAxXSwgbmV4dDogbm9kZXNbaSArIDFdfTtcbiAgICBjb25zdCBhc3RSZXN1bHQgPSBhc3QudmlzaXQodmlzaXRvciwgY29udGV4dCk7XG4gICAgaWYgKGFzdFJlc3VsdCkge1xuICAgICAgcmVzdWx0LnB1c2goYXN0UmVzdWx0KTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuIl19