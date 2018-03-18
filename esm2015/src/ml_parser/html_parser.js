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
import { getHtmlTagDefinition } from './html_tags';
import { DEFAULT_INTERPOLATION_CONFIG } from './interpolation_config';
import { Parser } from './parser';
export { ParseTreeResult, TreeError } from './parser';
export class HtmlParser extends Parser {
    constructor() { super(getHtmlTagDefinition); }
    /**
     * @param {?} source
     * @param {?} url
     * @param {?=} parseExpansionForms
     * @param {?=} interpolationConfig
     * @return {?}
     */
    parse(source, url, parseExpansionForms = false, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        return super.parse(source, url, parseExpansionForms, interpolationConfig);
    }
}
//# sourceMappingURL=html_parser.js.map