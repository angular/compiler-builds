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
        define("@angular/compiler/src/style_url_resolver", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extractStyleUrls = exports.isStyleUrlResolvable = exports.StyleWithImports = void 0;
    var StyleWithImports = /** @class */ (function () {
        function StyleWithImports(style, styleUrls) {
            this.style = style;
            this.styleUrls = styleUrls;
        }
        return StyleWithImports;
    }());
    exports.StyleWithImports = StyleWithImports;
    function isStyleUrlResolvable(url) {
        if (url == null || url.length === 0 || url[0] == '/')
            return false;
        var schemeMatch = url.match(URL_WITH_SCHEMA_REGEXP);
        return schemeMatch === null || schemeMatch[1] == 'package' || schemeMatch[1] == 'asset';
    }
    exports.isStyleUrlResolvable = isStyleUrlResolvable;
    /**
     * Rewrites stylesheets by resolving and removing the @import urls that
     * are either relative or don't have a `package:` scheme
     */
    function extractStyleUrls(resolver, baseUrl, cssText) {
        var foundUrls = [];
        var modifiedCssText = cssText.replace(CSS_STRIPPABLE_COMMENT_REGEXP, '')
            .replace(CSS_IMPORT_REGEXP, function () {
            var m = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                m[_i] = arguments[_i];
            }
            var url = m[1] || m[2];
            if (!isStyleUrlResolvable(url)) {
                // Do not attempt to resolve non-package absolute URLs with URI
                // scheme
                return m[0];
            }
            foundUrls.push(resolver.resolve(baseUrl, url));
            return '';
        });
        return new StyleWithImports(modifiedCssText, foundUrls);
    }
    exports.extractStyleUrls = extractStyleUrls;
    var CSS_IMPORT_REGEXP = /@import\s+(?:url\()?\s*(?:(?:['"]([^'"]*))|([^;\)\s]*))[^;]*;?/g;
    var CSS_STRIPPABLE_COMMENT_REGEXP = /\/\*(?!#\s*(?:sourceURL|sourceMappingURL)=)[\s\S]+?\*\//g;
    var URL_WITH_SCHEMA_REGEXP = /^([^:/?#]+):/;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVfdXJsX3Jlc29sdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3N0eWxlX3VybF9yZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFPSDtRQUNFLDBCQUFtQixLQUFhLEVBQVMsU0FBbUI7WUFBekMsVUFBSyxHQUFMLEtBQUssQ0FBUTtZQUFTLGNBQVMsR0FBVCxTQUFTLENBQVU7UUFBRyxDQUFDO1FBQ2xFLHVCQUFDO0lBQUQsQ0FBQyxBQUZELElBRUM7SUFGWSw0Q0FBZ0I7SUFJN0IsU0FBZ0Isb0JBQW9CLENBQUMsR0FBVztRQUM5QyxJQUFJLEdBQUcsSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUc7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUNuRSxJQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDdEQsT0FBTyxXQUFXLEtBQUssSUFBSSxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxTQUFTLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQztJQUMxRixDQUFDO0lBSkQsb0RBSUM7SUFFRDs7O09BR0c7SUFDSCxTQUFnQixnQkFBZ0IsQ0FDNUIsUUFBcUIsRUFBRSxPQUFlLEVBQUUsT0FBZTtRQUN6RCxJQUFNLFNBQVMsR0FBYSxFQUFFLENBQUM7UUFFL0IsSUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyw2QkFBNkIsRUFBRSxFQUFFLENBQUM7YUFDN0MsT0FBTyxDQUFDLGlCQUFpQixFQUFFO1lBQUMsV0FBYztpQkFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO2dCQUFkLHNCQUFjOztZQUN6QyxJQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDOUIsK0RBQStEO2dCQUMvRCxTQUFTO2dCQUNULE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2I7WUFDRCxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDL0MsT0FBTyxFQUFFLENBQUM7UUFDWixDQUFDLENBQUMsQ0FBQztRQUMvQixPQUFPLElBQUksZ0JBQWdCLENBQUMsZUFBZSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFoQkQsNENBZ0JDO0lBRUQsSUFBTSxpQkFBaUIsR0FBRyxpRUFBaUUsQ0FBQztJQUM1RixJQUFNLDZCQUE2QixHQUFHLDBEQUEwRCxDQUFDO0lBQ2pHLElBQU0sc0JBQXNCLEdBQUcsY0FBYyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLyBTb21lIG9mIHRoZSBjb2RlIGNvbWVzIGZyb20gV2ViQ29tcG9uZW50cy5KU1xuLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYmNvbXBvbmVudHMvd2ViY29tcG9uZW50c2pzL2Jsb2IvbWFzdGVyL3NyYy9IVE1MSW1wb3J0cy9wYXRoLmpzXG5cbmltcG9ydCB7VXJsUmVzb2x2ZXJ9IGZyb20gJy4vdXJsX3Jlc29sdmVyJztcblxuZXhwb3J0IGNsYXNzIFN0eWxlV2l0aEltcG9ydHMge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3R5bGU6IHN0cmluZywgcHVibGljIHN0eWxlVXJsczogc3RyaW5nW10pIHt9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1N0eWxlVXJsUmVzb2x2YWJsZSh1cmw6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAodXJsID09IG51bGwgfHwgdXJsLmxlbmd0aCA9PT0gMCB8fCB1cmxbMF0gPT0gJy8nKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHNjaGVtZU1hdGNoID0gdXJsLm1hdGNoKFVSTF9XSVRIX1NDSEVNQV9SRUdFWFApO1xuICByZXR1cm4gc2NoZW1lTWF0Y2ggPT09IG51bGwgfHwgc2NoZW1lTWF0Y2hbMV0gPT0gJ3BhY2thZ2UnIHx8IHNjaGVtZU1hdGNoWzFdID09ICdhc3NldCc7XG59XG5cbi8qKlxuICogUmV3cml0ZXMgc3R5bGVzaGVldHMgYnkgcmVzb2x2aW5nIGFuZCByZW1vdmluZyB0aGUgQGltcG9ydCB1cmxzIHRoYXRcbiAqIGFyZSBlaXRoZXIgcmVsYXRpdmUgb3IgZG9uJ3QgaGF2ZSBhIGBwYWNrYWdlOmAgc2NoZW1lXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0U3R5bGVVcmxzKFxuICAgIHJlc29sdmVyOiBVcmxSZXNvbHZlciwgYmFzZVVybDogc3RyaW5nLCBjc3NUZXh0OiBzdHJpbmcpOiBTdHlsZVdpdGhJbXBvcnRzIHtcbiAgY29uc3QgZm91bmRVcmxzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0IG1vZGlmaWVkQ3NzVGV4dCA9IGNzc1RleHQucmVwbGFjZShDU1NfU1RSSVBQQUJMRV9DT01NRU5UX1JFR0VYUCwgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShDU1NfSU1QT1JUX1JFR0VYUCwgKC4uLm06IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IG1bMV0gfHwgbVsyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc1N0eWxlVXJsUmVzb2x2YWJsZSh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRG8gbm90IGF0dGVtcHQgdG8gcmVzb2x2ZSBub24tcGFja2FnZSBhYnNvbHV0ZSBVUkxzIHdpdGggVVJJXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2NoZW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1bMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm91bmRVcmxzLnB1c2gocmVzb2x2ZXIucmVzb2x2ZShiYXNlVXJsLCB1cmwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gIHJldHVybiBuZXcgU3R5bGVXaXRoSW1wb3J0cyhtb2RpZmllZENzc1RleHQsIGZvdW5kVXJscyk7XG59XG5cbmNvbnN0IENTU19JTVBPUlRfUkVHRVhQID0gL0BpbXBvcnRcXHMrKD86dXJsXFwoKT9cXHMqKD86KD86WydcIl0oW14nXCJdKikpfChbXjtcXClcXHNdKikpW147XSo7Py9nO1xuY29uc3QgQ1NTX1NUUklQUEFCTEVfQ09NTUVOVF9SRUdFWFAgPSAvXFwvXFwqKD8hI1xccyooPzpzb3VyY2VVUkx8c291cmNlTWFwcGluZ1VSTCk9KVtcXHNcXFNdKz9cXCpcXC8vZztcbmNvbnN0IFVSTF9XSVRIX1NDSEVNQV9SRUdFWFAgPSAvXihbXjovPyNdKyk6LztcbiJdfQ==