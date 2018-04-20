/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isNgContent } from '../ml_parser/tags';
var /** @type {?} */ NG_CONTENT_SELECT_ATTR = 'select';
var /** @type {?} */ LINK_ELEMENT = 'link';
var /** @type {?} */ LINK_STYLE_REL_ATTR = 'rel';
var /** @type {?} */ LINK_STYLE_HREF_ATTR = 'href';
var /** @type {?} */ LINK_STYLE_REL_VALUE = 'stylesheet';
var /** @type {?} */ STYLE_ELEMENT = 'style';
var /** @type {?} */ SCRIPT_ELEMENT = 'script';
var /** @type {?} */ NG_NON_BINDABLE_ATTR = 'ngNonBindable';
var /** @type {?} */ NG_PROJECT_AS = 'ngProjectAs';
/**
 * @param {?} ast
 * @return {?}
 */
export function preparseElement(ast) {
    var /** @type {?} */ selectAttr = /** @type {?} */ ((null));
    var /** @type {?} */ hrefAttr = /** @type {?} */ ((null));
    var /** @type {?} */ relAttr = /** @type {?} */ ((null));
    var /** @type {?} */ nonBindable = false;
    var /** @type {?} */ projectAs = '';
    ast.attrs.forEach(function (attr) {
        var /** @type {?} */ lcAttrName = attr.name.toLowerCase();
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
    var /** @type {?} */ nodeName = ast.name.toLowerCase();
    var /** @type {?} */ type = PreparsedElementType.OTHER;
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
/** @enum {number} */
var PreparsedElementType = {
    NG_CONTENT: 0,
    STYLE: 1,
    STYLESHEET: 2,
    SCRIPT: 3,
    OTHER: 4,
};
export { PreparsedElementType };
PreparsedElementType[PreparsedElementType.NG_CONTENT] = "NG_CONTENT";
PreparsedElementType[PreparsedElementType.STYLE] = "STYLE";
PreparsedElementType[PreparsedElementType.STYLESHEET] = "STYLESHEET";
PreparsedElementType[PreparsedElementType.SCRIPT] = "SCRIPT";
PreparsedElementType[PreparsedElementType.OTHER] = "OTHER";
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
export { PreparsedElement };
function PreparsedElement_tsickle_Closure_declarations() {
    /** @type {?} */
    PreparsedElement.prototype.type;
    /** @type {?} */
    PreparsedElement.prototype.selectAttr;
    /** @type {?} */
    PreparsedElement.prototype.hrefAttr;
    /** @type {?} */
    PreparsedElement.prototype.nonBindable;
    /** @type {?} */
    PreparsedElement.prototype.projectAs;
}
/**
 * @param {?} selectAttr
 * @return {?}
 */
function normalizeNgContentSelect(selectAttr) {
    if (selectAttr === null || selectAttr.length === 0) {
        return '*';
    }
    return selectAttr;
}
//# sourceMappingURL=template_preparser.js.map