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
import { Parser } from './parser';
import { getXmlTagDefinition } from './xml_tags';
export { ParseTreeResult, TreeError } from './parser';
export class XmlParser extends Parser {
    constructor() { super(getXmlTagDefinition); }
    /**
     * @param {?} source
     * @param {?} url
     * @param {?=} parseExpansionForms
     * @return {?}
     */
    parse(source, url, parseExpansionForms = false) {
        return super.parse(source, url, parseExpansionForms);
    }
}
//# sourceMappingURL=xml_parser.js.map