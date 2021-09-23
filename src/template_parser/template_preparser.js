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
        if ((0, tags_1.isNgContent)(nodeName)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfcHJlcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wcmVwYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBR0gsNkRBQThDO0lBRTlDLElBQU0sc0JBQXNCLEdBQUcsUUFBUSxDQUFDO0lBQ3hDLElBQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQztJQUM1QixJQUFNLG1CQUFtQixHQUFHLEtBQUssQ0FBQztJQUNsQyxJQUFNLG9CQUFvQixHQUFHLE1BQU0sQ0FBQztJQUNwQyxJQUFNLG9CQUFvQixHQUFHLFlBQVksQ0FBQztJQUMxQyxJQUFNLGFBQWEsR0FBRyxPQUFPLENBQUM7SUFDOUIsSUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDO0lBQ2hDLElBQU0sb0JBQW9CLEdBQUcsZUFBZSxDQUFDO0lBQzdDLElBQU0sYUFBYSxHQUFHLGFBQWEsQ0FBQztJQUVwQyxTQUFnQixlQUFlLENBQUMsR0FBaUI7UUFDL0MsSUFBSSxVQUFVLEdBQVcsSUFBSyxDQUFDO1FBQy9CLElBQUksUUFBUSxHQUFXLElBQUssQ0FBQztRQUM3QixJQUFJLE9BQU8sR0FBVyxJQUFLLENBQUM7UUFDNUIsSUFBSSxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLElBQUksU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNuQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUk7WUFDcEIsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUMzQyxJQUFJLFVBQVUsSUFBSSxzQkFBc0IsRUFBRTtnQkFDeEMsVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7YUFDekI7aUJBQU0sSUFBSSxVQUFVLElBQUksb0JBQW9CLEVBQUU7Z0JBQzdDLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO2FBQ3ZCO2lCQUFNLElBQUksVUFBVSxJQUFJLG1CQUFtQixFQUFFO2dCQUM1QyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQzthQUN0QjtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksb0JBQW9CLEVBQUU7Z0JBQzVDLFdBQVcsR0FBRyxJQUFJLENBQUM7YUFDcEI7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLGFBQWEsRUFBRTtnQkFDckMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQ3pCLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO2lCQUN4QjthQUNGO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSCxVQUFVLEdBQUcsd0JBQXdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbEQsSUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUN4QyxJQUFJLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUM7UUFDdEMsSUFBSSxJQUFBLGtCQUFXLEVBQUMsUUFBUSxDQUFDLEVBQUU7WUFDekIsSUFBSSxHQUFHLG9CQUFvQixDQUFDLFVBQVUsQ0FBQztTQUN4QzthQUFNLElBQUksUUFBUSxJQUFJLGFBQWEsRUFBRTtZQUNwQyxJQUFJLEdBQUcsb0JBQW9CLENBQUMsS0FBSyxDQUFDO1NBQ25DO2FBQU0sSUFBSSxRQUFRLElBQUksY0FBYyxFQUFFO1lBQ3JDLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLENBQUM7U0FDcEM7YUFBTSxJQUFJLFFBQVEsSUFBSSxZQUFZLElBQUksT0FBTyxJQUFJLG9CQUFvQixFQUFFO1lBQ3RFLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxVQUFVLENBQUM7U0FDeEM7UUFDRCxPQUFPLElBQUksZ0JBQWdCLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFuQ0QsMENBbUNDO0lBRUQsSUFBWSxvQkFNWDtJQU5ELFdBQVksb0JBQW9CO1FBQzlCLDJFQUFVLENBQUE7UUFDVixpRUFBSyxDQUFBO1FBQ0wsMkVBQVUsQ0FBQTtRQUNWLG1FQUFNLENBQUE7UUFDTixpRUFBSyxDQUFBO0lBQ1AsQ0FBQyxFQU5XLG9CQUFvQixHQUFwQiw0QkFBb0IsS0FBcEIsNEJBQW9CLFFBTS9CO0lBRUQ7UUFDRSwwQkFDVyxJQUEwQixFQUFTLFVBQWtCLEVBQVMsUUFBZ0IsRUFDOUUsV0FBb0IsRUFBUyxTQUFpQjtZQUQ5QyxTQUFJLEdBQUosSUFBSSxDQUFzQjtZQUFTLGVBQVUsR0FBVixVQUFVLENBQVE7WUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFRO1lBQzlFLGdCQUFXLEdBQVgsV0FBVyxDQUFTO1lBQVMsY0FBUyxHQUFULFNBQVMsQ0FBUTtRQUFHLENBQUM7UUFDL0QsdUJBQUM7SUFBRCxDQUFDLEFBSkQsSUFJQztJQUpZLDRDQUFnQjtJQU83QixTQUFTLHdCQUF3QixDQUFDLFVBQWtCO1FBQ2xELElBQUksVUFBVSxLQUFLLElBQUksSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsRCxPQUFPLEdBQUcsQ0FBQztTQUNaO1FBQ0QsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtpc05nQ29udGVudH0gZnJvbSAnLi4vbWxfcGFyc2VyL3RhZ3MnO1xuXG5jb25zdCBOR19DT05URU5UX1NFTEVDVF9BVFRSID0gJ3NlbGVjdCc7XG5jb25zdCBMSU5LX0VMRU1FTlQgPSAnbGluayc7XG5jb25zdCBMSU5LX1NUWUxFX1JFTF9BVFRSID0gJ3JlbCc7XG5jb25zdCBMSU5LX1NUWUxFX0hSRUZfQVRUUiA9ICdocmVmJztcbmNvbnN0IExJTktfU1RZTEVfUkVMX1ZBTFVFID0gJ3N0eWxlc2hlZXQnO1xuY29uc3QgU1RZTEVfRUxFTUVOVCA9ICdzdHlsZSc7XG5jb25zdCBTQ1JJUFRfRUxFTUVOVCA9ICdzY3JpcHQnO1xuY29uc3QgTkdfTk9OX0JJTkRBQkxFX0FUVFIgPSAnbmdOb25CaW5kYWJsZSc7XG5jb25zdCBOR19QUk9KRUNUX0FTID0gJ25nUHJvamVjdEFzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcnNlRWxlbWVudChhc3Q6IGh0bWwuRWxlbWVudCk6IFByZXBhcnNlZEVsZW1lbnQge1xuICBsZXQgc2VsZWN0QXR0cjogc3RyaW5nID0gbnVsbCE7XG4gIGxldCBocmVmQXR0cjogc3RyaW5nID0gbnVsbCE7XG4gIGxldCByZWxBdHRyOiBzdHJpbmcgPSBudWxsITtcbiAgbGV0IG5vbkJpbmRhYmxlID0gZmFsc2U7XG4gIGxldCBwcm9qZWN0QXMgPSAnJztcbiAgYXN0LmF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgY29uc3QgbGNBdHRyTmFtZSA9IGF0dHIubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChsY0F0dHJOYW1lID09IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIpIHtcbiAgICAgIHNlbGVjdEF0dHIgPSBhdHRyLnZhbHVlO1xuICAgIH0gZWxzZSBpZiAobGNBdHRyTmFtZSA9PSBMSU5LX1NUWUxFX0hSRUZfQVRUUikge1xuICAgICAgaHJlZkF0dHIgPSBhdHRyLnZhbHVlO1xuICAgIH0gZWxzZSBpZiAobGNBdHRyTmFtZSA9PSBMSU5LX1NUWUxFX1JFTF9BVFRSKSB7XG4gICAgICByZWxBdHRyID0gYXR0ci52YWx1ZTtcbiAgICB9IGVsc2UgaWYgKGF0dHIubmFtZSA9PSBOR19OT05fQklOREFCTEVfQVRUUikge1xuICAgICAgbm9uQmluZGFibGUgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoYXR0ci5uYW1lID09IE5HX1BST0pFQ1RfQVMpIHtcbiAgICAgIGlmIChhdHRyLnZhbHVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcHJvamVjdEFzID0gYXR0ci52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBzZWxlY3RBdHRyID0gbm9ybWFsaXplTmdDb250ZW50U2VsZWN0KHNlbGVjdEF0dHIpO1xuICBjb25zdCBub2RlTmFtZSA9IGFzdC5uYW1lLnRvTG93ZXJDYXNlKCk7XG4gIGxldCB0eXBlID0gUHJlcGFyc2VkRWxlbWVudFR5cGUuT1RIRVI7XG4gIGlmIChpc05nQ29udGVudChub2RlTmFtZSkpIHtcbiAgICB0eXBlID0gUHJlcGFyc2VkRWxlbWVudFR5cGUuTkdfQ09OVEVOVDtcbiAgfSBlbHNlIGlmIChub2RlTmFtZSA9PSBTVFlMRV9FTEVNRU5UKSB7XG4gICAgdHlwZSA9IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFO1xuICB9IGVsc2UgaWYgKG5vZGVOYW1lID09IFNDUklQVF9FTEVNRU5UKSB7XG4gICAgdHlwZSA9IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVDtcbiAgfSBlbHNlIGlmIChub2RlTmFtZSA9PSBMSU5LX0VMRU1FTlQgJiYgcmVsQXR0ciA9PSBMSU5LX1NUWUxFX1JFTF9WQUxVRSkge1xuICAgIHR5cGUgPSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRVNIRUVUO1xuICB9XG4gIHJldHVybiBuZXcgUHJlcGFyc2VkRWxlbWVudCh0eXBlLCBzZWxlY3RBdHRyLCBocmVmQXR0ciwgbm9uQmluZGFibGUsIHByb2plY3RBcyk7XG59XG5cbmV4cG9ydCBlbnVtIFByZXBhcnNlZEVsZW1lbnRUeXBlIHtcbiAgTkdfQ09OVEVOVCxcbiAgU1RZTEUsXG4gIFNUWUxFU0hFRVQsXG4gIFNDUklQVCxcbiAgT1RIRVJcbn1cblxuZXhwb3J0IGNsYXNzIFByZXBhcnNlZEVsZW1lbnQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0eXBlOiBQcmVwYXJzZWRFbGVtZW50VHlwZSwgcHVibGljIHNlbGVjdEF0dHI6IHN0cmluZywgcHVibGljIGhyZWZBdHRyOiBzdHJpbmcsXG4gICAgICBwdWJsaWMgbm9uQmluZGFibGU6IGJvb2xlYW4sIHB1YmxpYyBwcm9qZWN0QXM6IHN0cmluZykge31cbn1cblxuXG5mdW5jdGlvbiBub3JtYWxpemVOZ0NvbnRlbnRTZWxlY3Qoc2VsZWN0QXR0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHNlbGVjdEF0dHIgPT09IG51bGwgfHwgc2VsZWN0QXR0ci5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gJyonO1xuICB9XG4gIHJldHVybiBzZWxlY3RBdHRyO1xufVxuIl19