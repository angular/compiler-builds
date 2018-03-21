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
const /** @type {?} */ TAG_TO_PLACEHOLDER_NAMES = {
    'A': 'LINK',
    'B': 'BOLD_TEXT',
    'BR': 'LINE_BREAK',
    'EM': 'EMPHASISED_TEXT',
    'H1': 'HEADING_LEVEL1',
    'H2': 'HEADING_LEVEL2',
    'H3': 'HEADING_LEVEL3',
    'H4': 'HEADING_LEVEL4',
    'H5': 'HEADING_LEVEL5',
    'H6': 'HEADING_LEVEL6',
    'HR': 'HORIZONTAL_RULE',
    'I': 'ITALIC_TEXT',
    'LI': 'LIST_ITEM',
    'LINK': 'MEDIA_LINK',
    'OL': 'ORDERED_LIST',
    'P': 'PARAGRAPH',
    'Q': 'QUOTATION',
    'S': 'STRIKETHROUGH_TEXT',
    'SMALL': 'SMALL_TEXT',
    'SUB': 'SUBSTRIPT',
    'SUP': 'SUPERSCRIPT',
    'TBODY': 'TABLE_BODY',
    'TD': 'TABLE_CELL',
    'TFOOT': 'TABLE_FOOTER',
    'TH': 'TABLE_HEADER_CELL',
    'THEAD': 'TABLE_HEADER',
    'TR': 'TABLE_ROW',
    'TT': 'MONOSPACED_TEXT',
    'U': 'UNDERLINED_TEXT',
    'UL': 'UNORDERED_LIST',
};
/**
 * Creates unique names for placeholder with different content.
 *
 * Returns the same placeholder name when the content is identical.
 */
export class PlaceholderRegistry {
    constructor() {
        this._placeHolderNameCounts = {};
        this._signatureToName = {};
    }
    /**
     * @param {?} tag
     * @param {?} attrs
     * @param {?} isVoid
     * @return {?}
     */
    getStartTagPlaceholderName(tag, attrs, isVoid) {
        const /** @type {?} */ signature = this._hashTag(tag, attrs, isVoid);
        if (this._signatureToName[signature]) {
            return this._signatureToName[signature];
        }
        const /** @type {?} */ upperTag = tag.toUpperCase();
        const /** @type {?} */ baseName = TAG_TO_PLACEHOLDER_NAMES[upperTag] || `TAG_${upperTag}`;
        const /** @type {?} */ name = this._generateUniqueName(isVoid ? baseName : `START_${baseName}`);
        this._signatureToName[signature] = name;
        return name;
    }
    /**
     * @param {?} tag
     * @return {?}
     */
    getCloseTagPlaceholderName(tag) {
        const /** @type {?} */ signature = this._hashClosingTag(tag);
        if (this._signatureToName[signature]) {
            return this._signatureToName[signature];
        }
        const /** @type {?} */ upperTag = tag.toUpperCase();
        const /** @type {?} */ baseName = TAG_TO_PLACEHOLDER_NAMES[upperTag] || `TAG_${upperTag}`;
        const /** @type {?} */ name = this._generateUniqueName(`CLOSE_${baseName}`);
        this._signatureToName[signature] = name;
        return name;
    }
    /**
     * @param {?} name
     * @param {?} content
     * @return {?}
     */
    getPlaceholderName(name, content) {
        const /** @type {?} */ upperName = name.toUpperCase();
        const /** @type {?} */ signature = `PH: ${upperName}=${content}`;
        if (this._signatureToName[signature]) {
            return this._signatureToName[signature];
        }
        const /** @type {?} */ uniqueName = this._generateUniqueName(upperName);
        this._signatureToName[signature] = uniqueName;
        return uniqueName;
    }
    /**
     * @param {?} name
     * @return {?}
     */
    getUniquePlaceholder(name) {
        return this._generateUniqueName(name.toUpperCase());
    }
    /**
     * @param {?} tag
     * @param {?} attrs
     * @param {?} isVoid
     * @return {?}
     */
    _hashTag(tag, attrs, isVoid) {
        const /** @type {?} */ start = `<${tag}`;
        const /** @type {?} */ strAttrs = Object.keys(attrs).sort().map((name) => ` ${name}=${attrs[name]}`).join('');
        const /** @type {?} */ end = isVoid ? '/>' : `></${tag}>`;
        return start + strAttrs + end;
    }
    /**
     * @param {?} tag
     * @return {?}
     */
    _hashClosingTag(tag) { return this._hashTag(`/${tag}`, {}, false); }
    /**
     * @param {?} base
     * @return {?}
     */
    _generateUniqueName(base) {
        const /** @type {?} */ seen = this._placeHolderNameCounts.hasOwnProperty(base);
        if (!seen) {
            this._placeHolderNameCounts[base] = 1;
            return base;
        }
        const /** @type {?} */ id = this._placeHolderNameCounts[base];
        this._placeHolderNameCounts[base] = id + 1;
        return `${base}_${id}`;
    }
}
function PlaceholderRegistry_tsickle_Closure_declarations() {
    /** @type {?} */
    PlaceholderRegistry.prototype._placeHolderNameCounts;
    /** @type {?} */
    PlaceholderRegistry.prototype._signatureToName;
}
//# sourceMappingURL=placeholder.js.map