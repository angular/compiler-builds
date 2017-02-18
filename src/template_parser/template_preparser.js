/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { splitNsName } from '../ml_parser/tags';
const /** @type {?} */ NG_CONTENT_SELECT_ATTR = 'select';
const /** @type {?} */ NG_CONTENT_ELEMENT = 'ng-content';
const /** @type {?} */ LINK_ELEMENT = 'link';
const /** @type {?} */ LINK_STYLE_REL_ATTR = 'rel';
const /** @type {?} */ LINK_STYLE_HREF_ATTR = 'href';
const /** @type {?} */ LINK_STYLE_REL_VALUE = 'stylesheet';
const /** @type {?} */ STYLE_ELEMENT = 'style';
const /** @type {?} */ SCRIPT_ELEMENT = 'script';
const /** @type {?} */ NG_NON_BINDABLE_ATTR = 'ngNonBindable';
const /** @type {?} */ NG_PROJECT_AS = 'ngProjectAs';
/**
 * @param {?} ast
 * @return {?}
 */
export function preparseElement(ast) {
    let /** @type {?} */ selectAttr = null;
    let /** @type {?} */ hrefAttr = null;
    let /** @type {?} */ relAttr = null;
    let /** @type {?} */ nonBindable = false;
    let /** @type {?} */ projectAs = null;
    ast.attrs.forEach(attr => {
        const /** @type {?} */ lcAttrName = attr.name.toLowerCase();
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
    const /** @type {?} */ nodeName = ast.name.toLowerCase();
    let /** @type {?} */ type = PreparsedElementType.OTHER;
    if (splitNsName(nodeName)[1] == NG_CONTENT_ELEMENT) {
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
export let PreparsedElementType = {};
PreparsedElementType.NG_CONTENT = 0;
PreparsedElementType.STYLE = 1;
PreparsedElementType.STYLESHEET = 2;
PreparsedElementType.SCRIPT = 3;
PreparsedElementType.OTHER = 4;
PreparsedElementType[PreparsedElementType.NG_CONTENT] = "NG_CONTENT";
PreparsedElementType[PreparsedElementType.STYLE] = "STYLE";
PreparsedElementType[PreparsedElementType.STYLESHEET] = "STYLESHEET";
PreparsedElementType[PreparsedElementType.SCRIPT] = "SCRIPT";
PreparsedElementType[PreparsedElementType.OTHER] = "OTHER";
export class PreparsedElement {
    /**
     * @param {?} type
     * @param {?} selectAttr
     * @param {?} hrefAttr
     * @param {?} nonBindable
     * @param {?} projectAs
     */
    constructor(type, selectAttr, hrefAttr, nonBindable, projectAs) {
        this.type = type;
        this.selectAttr = selectAttr;
        this.hrefAttr = hrefAttr;
        this.nonBindable = nonBindable;
        this.projectAs = projectAs;
    }
}
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