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
        define("@angular/compiler/src/template_parser/template_preparser", ["require", "exports", "@angular/compiler/src/ml_parser/tags"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PreparsedElement = exports.PreparsedElementType = exports.preparseElement = void 0;
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var NG_CONTENT_SELECT_ATTR = 'select';
    var LINK_ELEMENT = 'link';
    var LINK_STYLE_REL_ATTR = 'rel';
    var LINK_STYLE_HREF_ATTR = 'href';
    var LINK_STYLE_REL_VALUE = 'stylesheet';
    var STYLE_ELEMENT = 'style';
    var SCRIPT_ELEMENT = 'script';
    var NG_NON_BINDABLE_ATTR = 'ngNonBindable';
    var NG_PROJECT_AS = 'ngProjectAs';
    function preparseElement(ast) {
        var selectAttr = null;
        var hrefAttr = null;
        var relAttr = null;
        var nonBindable = false;
        var projectAs = '';
        ast.attrs.forEach(function (attr) {
            var lcAttrName = attr.name.toLowerCase();
            if (lcAttrName == NG_CONTENT_SELECT_ATTR) {
                selectAttr = attr.value;
            }
            else if (lcAttrName == LINK_STYLE_HREF_ATTR) {
                hrefAttr = attr.value;
            }
            else if (lcAttrName == LINK_STYLE_REL_ATTR) {
                relAttr = attr.value;
            }
            else if (attr.name == NG_NON_BINDABLE_ATTR) {
                nonBindable = true;
            }
            else if (attr.name == NG_PROJECT_AS) {
                if (attr.value.length > 0) {
                    projectAs = attr.value;
                }
            }
        });
        selectAttr = normalizeNgContentSelect(selectAttr);
        var nodeName = ast.name.toLowerCase();
        var type = PreparsedElementType.OTHER;
        if (tags_1.isNgContent(nodeName)) {
            type = PreparsedElementType.NG_CONTENT;
        }
        else if (nodeName == STYLE_ELEMENT) {
            type = PreparsedElementType.STYLE;
        }
        else if (nodeName == SCRIPT_ELEMENT) {
            type = PreparsedElementType.SCRIPT;
        }
        else if (nodeName == LINK_ELEMENT && relAttr == LINK_STYLE_REL_VALUE) {
            type = PreparsedElementType.STYLESHEET;
        }
        return new PreparsedElement(type, selectAttr, hrefAttr, nonBindable, projectAs);
    }
    exports.preparseElement = preparseElement;
    var PreparsedElementType;
    (function (PreparsedElementType) {
        PreparsedElementType[PreparsedElementType["NG_CONTENT"] = 0] = "NG_CONTENT";
        PreparsedElementType[PreparsedElementType["STYLE"] = 1] = "STYLE";
        PreparsedElementType[PreparsedElementType["STYLESHEET"] = 2] = "STYLESHEET";
        PreparsedElementType[PreparsedElementType["SCRIPT"] = 3] = "SCRIPT";
        PreparsedElementType[PreparsedElementType["OTHER"] = 4] = "OTHER";
    })(PreparsedElementType = exports.PreparsedElementType || (exports.PreparsedElementType = {}));
    var PreparsedElement = /** @class */ (function () {
        function PreparsedElement(type, selectAttr, hrefAttr, nonBindable, projectAs) {
            this.type = type;
            this.selectAttr = selectAttr;
            this.hrefAttr = hrefAttr;
            this.nonBindable = nonBindable;
            this.projectAs = projectAs;
        }
        return PreparsedElement;
    }());
    exports.PreparsedElement = PreparsedElement;
    function normalizeNgContentSelect(selectAttr) {
        if (selectAttr === null || selectAttr.length === 0) {
            return '*';
        }
        return selectAttr;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfcHJlcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wcmVwYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBR0gsNkRBQThDO0lBRTlDLElBQU0sc0JBQXNCLEdBQUcsUUFBUSxDQUFDO0lBQ3hDLElBQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQztJQUM1QixJQUFNLG1CQUFtQixHQUFHLEtBQUssQ0FBQztJQUNsQyxJQUFNLG9CQUFvQixHQUFHLE1BQU0sQ0FBQztJQUNwQyxJQUFNLG9CQUFvQixHQUFHLFlBQVksQ0FBQztJQUMxQyxJQUFNLGFBQWEsR0FBRyxPQUFPLENBQUM7SUFDOUIsSUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDO0lBQ2hDLElBQU0sb0JBQW9CLEdBQUcsZUFBZSxDQUFDO0lBQzdDLElBQU0sYUFBYSxHQUFHLGFBQWEsQ0FBQztJQUVwQyxTQUFnQixlQUFlLENBQUMsR0FBaUI7UUFDL0MsSUFBSSxVQUFVLEdBQVcsSUFBSyxDQUFDO1FBQy9CLElBQUksUUFBUSxHQUFXLElBQUssQ0FBQztRQUM3QixJQUFJLE9BQU8sR0FBVyxJQUFLLENBQUM7UUFDNUIsSUFBSSxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLElBQUksU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNuQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUk7WUFDcEIsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUMzQyxJQUFJLFVBQVUsSUFBSSxzQkFBc0IsRUFBRTtnQkFDeEMsVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7YUFDekI7aUJBQU0sSUFBSSxVQUFVLElBQUksb0JBQW9CLEVBQUU7Z0JBQzdDLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO2FBQ3ZCO2lCQUFNLElBQUksVUFBVSxJQUFJLG1CQUFtQixFQUFFO2dCQUM1QyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQzthQUN0QjtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksb0JBQW9CLEVBQUU7Z0JBQzVDLFdBQVcsR0FBRyxJQUFJLENBQUM7YUFDcEI7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLGFBQWEsRUFBRTtnQkFDckMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQ3pCLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO2lCQUN4QjthQUNGO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSCxVQUFVLEdBQUcsd0JBQXdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbEQsSUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUN4QyxJQUFJLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUM7UUFDdEMsSUFBSSxrQkFBVyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3pCLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxVQUFVLENBQUM7U0FDeEM7YUFBTSxJQUFJLFFBQVEsSUFBSSxhQUFhLEVBQUU7WUFDcEMsSUFBSSxHQUFHLG9CQUFvQixDQUFDLEtBQUssQ0FBQztTQUNuQzthQUFNLElBQUksUUFBUSxJQUFJLGNBQWMsRUFBRTtZQUNyQyxJQUFJLEdBQUcsb0JBQW9CLENBQUMsTUFBTSxDQUFDO1NBQ3BDO2FBQU0sSUFBSSxRQUFRLElBQUksWUFBWSxJQUFJLE9BQU8sSUFBSSxvQkFBb0IsRUFBRTtZQUN0RSxJQUFJLEdBQUcsb0JBQW9CLENBQUMsVUFBVSxDQUFDO1NBQ3hDO1FBQ0QsT0FBTyxJQUFJLGdCQUFnQixDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBbkNELDBDQW1DQztJQUVELElBQVksb0JBTVg7SUFORCxXQUFZLG9CQUFvQjtRQUM5QiwyRUFBVSxDQUFBO1FBQ1YsaUVBQUssQ0FBQTtRQUNMLDJFQUFVLENBQUE7UUFDVixtRUFBTSxDQUFBO1FBQ04saUVBQUssQ0FBQTtJQUNQLENBQUMsRUFOVyxvQkFBb0IsR0FBcEIsNEJBQW9CLEtBQXBCLDRCQUFvQixRQU0vQjtJQUVEO1FBQ0UsMEJBQ1csSUFBMEIsRUFBUyxVQUFrQixFQUFTLFFBQWdCLEVBQzlFLFdBQW9CLEVBQVMsU0FBaUI7WUFEOUMsU0FBSSxHQUFKLElBQUksQ0FBc0I7WUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFRO1lBQVMsYUFBUSxHQUFSLFFBQVEsQ0FBUTtZQUM5RSxnQkFBVyxHQUFYLFdBQVcsQ0FBUztZQUFTLGNBQVMsR0FBVCxTQUFTLENBQVE7UUFBRyxDQUFDO1FBQy9ELHVCQUFDO0lBQUQsQ0FBQyxBQUpELElBSUM7SUFKWSw0Q0FBZ0I7SUFPN0IsU0FBUyx3QkFBd0IsQ0FBQyxVQUFrQjtRQUNsRCxJQUFJLFVBQVUsS0FBSyxJQUFJLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEQsT0FBTyxHQUFHLENBQUM7U0FDWjtRQUNELE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge2lzTmdDb250ZW50fSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5cbmNvbnN0IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIgPSAnc2VsZWN0JztcbmNvbnN0IExJTktfRUxFTUVOVCA9ICdsaW5rJztcbmNvbnN0IExJTktfU1RZTEVfUkVMX0FUVFIgPSAncmVsJztcbmNvbnN0IExJTktfU1RZTEVfSFJFRl9BVFRSID0gJ2hyZWYnO1xuY29uc3QgTElOS19TVFlMRV9SRUxfVkFMVUUgPSAnc3R5bGVzaGVldCc7XG5jb25zdCBTVFlMRV9FTEVNRU5UID0gJ3N0eWxlJztcbmNvbnN0IFNDUklQVF9FTEVNRU5UID0gJ3NjcmlwdCc7XG5jb25zdCBOR19OT05fQklOREFCTEVfQVRUUiA9ICduZ05vbkJpbmRhYmxlJztcbmNvbnN0IE5HX1BST0pFQ1RfQVMgPSAnbmdQcm9qZWN0QXMnO1xuXG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyc2VFbGVtZW50KGFzdDogaHRtbC5FbGVtZW50KTogUHJlcGFyc2VkRWxlbWVudCB7XG4gIGxldCBzZWxlY3RBdHRyOiBzdHJpbmcgPSBudWxsITtcbiAgbGV0IGhyZWZBdHRyOiBzdHJpbmcgPSBudWxsITtcbiAgbGV0IHJlbEF0dHI6IHN0cmluZyA9IG51bGwhO1xuICBsZXQgbm9uQmluZGFibGUgPSBmYWxzZTtcbiAgbGV0IHByb2plY3RBcyA9ICcnO1xuICBhc3QuYXR0cnMuZm9yRWFjaChhdHRyID0+IHtcbiAgICBjb25zdCBsY0F0dHJOYW1lID0gYXR0ci5uYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGxjQXR0ck5hbWUgPT0gTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUikge1xuICAgICAgc2VsZWN0QXR0ciA9IGF0dHIudmFsdWU7XG4gICAgfSBlbHNlIGlmIChsY0F0dHJOYW1lID09IExJTktfU1RZTEVfSFJFRl9BVFRSKSB7XG4gICAgICBocmVmQXR0ciA9IGF0dHIudmFsdWU7XG4gICAgfSBlbHNlIGlmIChsY0F0dHJOYW1lID09IExJTktfU1RZTEVfUkVMX0FUVFIpIHtcbiAgICAgIHJlbEF0dHIgPSBhdHRyLnZhbHVlO1xuICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lID09IE5HX05PTl9CSU5EQUJMRV9BVFRSKSB7XG4gICAgICBub25CaW5kYWJsZSA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChhdHRyLm5hbWUgPT0gTkdfUFJPSkVDVF9BUykge1xuICAgICAgaWYgKGF0dHIudmFsdWUubGVuZ3RoID4gMCkge1xuICAgICAgICBwcm9qZWN0QXMgPSBhdHRyLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIHNlbGVjdEF0dHIgPSBub3JtYWxpemVOZ0NvbnRlbnRTZWxlY3Qoc2VsZWN0QXR0cik7XG4gIGNvbnN0IG5vZGVOYW1lID0gYXN0Lm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgbGV0IHR5cGUgPSBQcmVwYXJzZWRFbGVtZW50VHlwZS5PVEhFUjtcbiAgaWYgKGlzTmdDb250ZW50KG5vZGVOYW1lKSkge1xuICAgIHR5cGUgPSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UO1xuICB9IGVsc2UgaWYgKG5vZGVOYW1lID09IFNUWUxFX0VMRU1FTlQpIHtcbiAgICB0eXBlID0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEU7XG4gIH0gZWxzZSBpZiAobm9kZU5hbWUgPT0gU0NSSVBUX0VMRU1FTlQpIHtcbiAgICB0eXBlID0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUO1xuICB9IGVsc2UgaWYgKG5vZGVOYW1lID09IExJTktfRUxFTUVOVCAmJiByZWxBdHRyID09IExJTktfU1RZTEVfUkVMX1ZBTFVFKSB7XG4gICAgdHlwZSA9IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQ7XG4gIH1cbiAgcmV0dXJuIG5ldyBQcmVwYXJzZWRFbGVtZW50KHR5cGUsIHNlbGVjdEF0dHIsIGhyZWZBdHRyLCBub25CaW5kYWJsZSwgcHJvamVjdEFzKTtcbn1cblxuZXhwb3J0IGVudW0gUHJlcGFyc2VkRWxlbWVudFR5cGUge1xuICBOR19DT05URU5ULFxuICBTVFlMRSxcbiAgU1RZTEVTSEVFVCxcbiAgU0NSSVBULFxuICBPVEhFUlxufVxuXG5leHBvcnQgY2xhc3MgUHJlcGFyc2VkRWxlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHR5cGU6IFByZXBhcnNlZEVsZW1lbnRUeXBlLCBwdWJsaWMgc2VsZWN0QXR0cjogc3RyaW5nLCBwdWJsaWMgaHJlZkF0dHI6IHN0cmluZyxcbiAgICAgIHB1YmxpYyBub25CaW5kYWJsZTogYm9vbGVhbiwgcHVibGljIHByb2plY3RBczogc3RyaW5nKSB7fVxufVxuXG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZU5nQ29udGVudFNlbGVjdChzZWxlY3RBdHRyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoc2VsZWN0QXR0ciA9PT0gbnVsbCB8fCBzZWxlY3RBdHRyLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAnKic7XG4gIH1cbiAgcmV0dXJuIHNlbGVjdEF0dHI7XG59XG4iXX0=