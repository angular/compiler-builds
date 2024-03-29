/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isNgContent } from '../ml_parser/tags';
const NG_CONTENT_SELECT_ATTR = 'select';
const LINK_ELEMENT = 'link';
const LINK_STYLE_REL_ATTR = 'rel';
const LINK_STYLE_HREF_ATTR = 'href';
const LINK_STYLE_REL_VALUE = 'stylesheet';
const STYLE_ELEMENT = 'style';
const SCRIPT_ELEMENT = 'script';
const NG_NON_BINDABLE_ATTR = 'ngNonBindable';
const NG_PROJECT_AS = 'ngProjectAs';
export function preparseElement(ast) {
    let selectAttr = null;
    let hrefAttr = null;
    let relAttr = null;
    let nonBindable = false;
    let projectAs = '';
    ast.attrs.forEach(attr => {
        const lcAttrName = attr.name.toLowerCase();
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
    const nodeName = ast.name.toLowerCase();
    let type = PreparsedElementType.OTHER;
    if (isNgContent(nodeName)) {
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
export var PreparsedElementType;
(function (PreparsedElementType) {
    PreparsedElementType[PreparsedElementType["NG_CONTENT"] = 0] = "NG_CONTENT";
    PreparsedElementType[PreparsedElementType["STYLE"] = 1] = "STYLE";
    PreparsedElementType[PreparsedElementType["STYLESHEET"] = 2] = "STYLESHEET";
    PreparsedElementType[PreparsedElementType["SCRIPT"] = 3] = "SCRIPT";
    PreparsedElementType[PreparsedElementType["OTHER"] = 4] = "OTHER";
})(PreparsedElementType || (PreparsedElementType = {}));
export class PreparsedElement {
    constructor(type, selectAttr, hrefAttr, nonBindable, projectAs) {
        this.type = type;
        this.selectAttr = selectAttr;
        this.hrefAttr = hrefAttr;
        this.nonBindable = nonBindable;
        this.projectAs = projectAs;
    }
}
function normalizeNgContentSelect(selectAttr) {
    if (selectAttr === null || selectAttr.length === 0) {
        return '*';
    }
    return selectAttr;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfcHJlcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wcmVwYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRTlDLE1BQU0sc0JBQXNCLEdBQUcsUUFBUSxDQUFDO0FBQ3hDLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQztBQUM1QixNQUFNLG1CQUFtQixHQUFHLEtBQUssQ0FBQztBQUNsQyxNQUFNLG9CQUFvQixHQUFHLE1BQU0sQ0FBQztBQUNwQyxNQUFNLG9CQUFvQixHQUFHLFlBQVksQ0FBQztBQUMxQyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUM7QUFDOUIsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDO0FBQ2hDLE1BQU0sb0JBQW9CLEdBQUcsZUFBZSxDQUFDO0FBQzdDLE1BQU0sYUFBYSxHQUFHLGFBQWEsQ0FBQztBQUVwQyxNQUFNLFVBQVUsZUFBZSxDQUFDLEdBQWlCO0lBQy9DLElBQUksVUFBVSxHQUFnQixJQUFJLENBQUM7SUFDbkMsSUFBSSxRQUFRLEdBQWdCLElBQUksQ0FBQztJQUNqQyxJQUFJLE9BQU8sR0FBZ0IsSUFBSSxDQUFDO0lBQ2hDLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQztJQUN4QixJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDbkIsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDdkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMzQyxJQUFJLFVBQVUsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO1lBQ3pDLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQzFCLENBQUM7YUFBTSxJQUFJLFVBQVUsSUFBSSxvQkFBb0IsRUFBRSxDQUFDO1lBQzlDLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ3hCLENBQUM7YUFBTSxJQUFJLFVBQVUsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO1lBQzdDLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ3ZCLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksb0JBQW9CLEVBQUUsQ0FBQztZQUM3QyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksYUFBYSxFQUFFLENBQUM7WUFDdEMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDMUIsU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDekIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUNILFVBQVUsR0FBRyx3QkFBd0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNsRCxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3hDLElBQUksSUFBSSxHQUFHLG9CQUFvQixDQUFDLEtBQUssQ0FBQztJQUN0QyxJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1FBQzFCLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxVQUFVLENBQUM7SUFDekMsQ0FBQztTQUFNLElBQUksUUFBUSxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQ3JDLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUM7SUFDcEMsQ0FBQztTQUFNLElBQUksUUFBUSxJQUFJLGNBQWMsRUFBRSxDQUFDO1FBQ3RDLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLENBQUM7SUFDckMsQ0FBQztTQUFNLElBQUksUUFBUSxJQUFJLFlBQVksSUFBSSxPQUFPLElBQUksb0JBQW9CLEVBQUUsQ0FBQztRQUN2RSxJQUFJLEdBQUcsb0JBQW9CLENBQUMsVUFBVSxDQUFDO0lBQ3pDLENBQUM7SUFDRCxPQUFPLElBQUksZ0JBQWdCLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFFRCxNQUFNLENBQU4sSUFBWSxvQkFNWDtBQU5ELFdBQVksb0JBQW9CO0lBQzlCLDJFQUFVLENBQUE7SUFDVixpRUFBSyxDQUFBO0lBQ0wsMkVBQVUsQ0FBQTtJQUNWLG1FQUFNLENBQUE7SUFDTixpRUFBSyxDQUFBO0FBQ1AsQ0FBQyxFQU5XLG9CQUFvQixLQUFwQixvQkFBb0IsUUFNL0I7QUFFRCxNQUFNLE9BQU8sZ0JBQWdCO0lBQzNCLFlBQ1csSUFBMEIsRUFBUyxVQUFrQixFQUFTLFFBQXFCLEVBQ25GLFdBQW9CLEVBQVMsU0FBaUI7UUFEOUMsU0FBSSxHQUFKLElBQUksQ0FBc0I7UUFBUyxlQUFVLEdBQVYsVUFBVSxDQUFRO1FBQVMsYUFBUSxHQUFSLFFBQVEsQ0FBYTtRQUNuRixnQkFBVyxHQUFYLFdBQVcsQ0FBUztRQUFTLGNBQVMsR0FBVCxTQUFTLENBQVE7SUFBRyxDQUFDO0NBQzlEO0FBR0QsU0FBUyx3QkFBd0IsQ0FBQyxVQUF1QjtJQUN2RCxJQUFJLFVBQVUsS0FBSyxJQUFJLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUNuRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFDRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge2lzTmdDb250ZW50fSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5cbmNvbnN0IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIgPSAnc2VsZWN0JztcbmNvbnN0IExJTktfRUxFTUVOVCA9ICdsaW5rJztcbmNvbnN0IExJTktfU1RZTEVfUkVMX0FUVFIgPSAncmVsJztcbmNvbnN0IExJTktfU1RZTEVfSFJFRl9BVFRSID0gJ2hyZWYnO1xuY29uc3QgTElOS19TVFlMRV9SRUxfVkFMVUUgPSAnc3R5bGVzaGVldCc7XG5jb25zdCBTVFlMRV9FTEVNRU5UID0gJ3N0eWxlJztcbmNvbnN0IFNDUklQVF9FTEVNRU5UID0gJ3NjcmlwdCc7XG5jb25zdCBOR19OT05fQklOREFCTEVfQVRUUiA9ICduZ05vbkJpbmRhYmxlJztcbmNvbnN0IE5HX1BST0pFQ1RfQVMgPSAnbmdQcm9qZWN0QXMnO1xuXG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyc2VFbGVtZW50KGFzdDogaHRtbC5FbGVtZW50KTogUHJlcGFyc2VkRWxlbWVudCB7XG4gIGxldCBzZWxlY3RBdHRyOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gIGxldCBocmVmQXR0cjogc3RyaW5nfG51bGwgPSBudWxsO1xuICBsZXQgcmVsQXR0cjogc3RyaW5nfG51bGwgPSBudWxsO1xuICBsZXQgbm9uQmluZGFibGUgPSBmYWxzZTtcbiAgbGV0IHByb2plY3RBcyA9ICcnO1xuICBhc3QuYXR0cnMuZm9yRWFjaChhdHRyID0+IHtcbiAgICBjb25zdCBsY0F0dHJOYW1lID0gYXR0ci5uYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGxjQXR0ck5hbWUgPT0gTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUikge1xuICAgICAgc2VsZWN0QXR0ciA9IGF0dHIudmFsdWU7XG4gICAgfSBlbHNlIGlmIChsY0F0dHJOYW1lID09IExJTktfU1RZTEVfSFJFRl9BVFRSKSB7XG4gICAgICBocmVmQXR0ciA9IGF0dHIudmFsdWU7XG4gICAgfSBlbHNlIGlmIChsY0F0dHJOYW1lID09IExJTktfU1RZTEVfUkVMX0FUVFIpIHtcbiAgICAgIHJlbEF0dHIgPSBhdHRyLnZhbHVlO1xuICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lID09IE5HX05PTl9CSU5EQUJMRV9BVFRSKSB7XG4gICAgICBub25CaW5kYWJsZSA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChhdHRyLm5hbWUgPT0gTkdfUFJPSkVDVF9BUykge1xuICAgICAgaWYgKGF0dHIudmFsdWUubGVuZ3RoID4gMCkge1xuICAgICAgICBwcm9qZWN0QXMgPSBhdHRyLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIHNlbGVjdEF0dHIgPSBub3JtYWxpemVOZ0NvbnRlbnRTZWxlY3Qoc2VsZWN0QXR0cik7XG4gIGNvbnN0IG5vZGVOYW1lID0gYXN0Lm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgbGV0IHR5cGUgPSBQcmVwYXJzZWRFbGVtZW50VHlwZS5PVEhFUjtcbiAgaWYgKGlzTmdDb250ZW50KG5vZGVOYW1lKSkge1xuICAgIHR5cGUgPSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UO1xuICB9IGVsc2UgaWYgKG5vZGVOYW1lID09IFNUWUxFX0VMRU1FTlQpIHtcbiAgICB0eXBlID0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEU7XG4gIH0gZWxzZSBpZiAobm9kZU5hbWUgPT0gU0NSSVBUX0VMRU1FTlQpIHtcbiAgICB0eXBlID0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUO1xuICB9IGVsc2UgaWYgKG5vZGVOYW1lID09IExJTktfRUxFTUVOVCAmJiByZWxBdHRyID09IExJTktfU1RZTEVfUkVMX1ZBTFVFKSB7XG4gICAgdHlwZSA9IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQ7XG4gIH1cbiAgcmV0dXJuIG5ldyBQcmVwYXJzZWRFbGVtZW50KHR5cGUsIHNlbGVjdEF0dHIsIGhyZWZBdHRyLCBub25CaW5kYWJsZSwgcHJvamVjdEFzKTtcbn1cblxuZXhwb3J0IGVudW0gUHJlcGFyc2VkRWxlbWVudFR5cGUge1xuICBOR19DT05URU5ULFxuICBTVFlMRSxcbiAgU1RZTEVTSEVFVCxcbiAgU0NSSVBULFxuICBPVEhFUlxufVxuXG5leHBvcnQgY2xhc3MgUHJlcGFyc2VkRWxlbWVudCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHR5cGU6IFByZXBhcnNlZEVsZW1lbnRUeXBlLCBwdWJsaWMgc2VsZWN0QXR0cjogc3RyaW5nLCBwdWJsaWMgaHJlZkF0dHI6IHN0cmluZ3xudWxsLFxuICAgICAgcHVibGljIG5vbkJpbmRhYmxlOiBib29sZWFuLCBwdWJsaWMgcHJvamVjdEFzOiBzdHJpbmcpIHt9XG59XG5cblxuZnVuY3Rpb24gbm9ybWFsaXplTmdDb250ZW50U2VsZWN0KHNlbGVjdEF0dHI6IHN0cmluZ3xudWxsKTogc3RyaW5nIHtcbiAgaWYgKHNlbGVjdEF0dHIgPT09IG51bGwgfHwgc2VsZWN0QXR0ci5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gJyonO1xuICB9XG4gIHJldHVybiBzZWxlY3RBdHRyO1xufVxuIl19