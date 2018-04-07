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
import { getHtmlTagDefinition } from './ml_parser/html_tags';
const /** @type {?} */ _SELECTOR_REGEXP = new RegExp('(\\:not\\()|' + //":not("
    '([-\\w]+)|' + // "tag"
    '(?:\\.([-\\w]+))|' + // ".class"
    '(?:\\[([-.\\w*]+)(?:=([\"\']?)([^\\]\"\']*)\\5)?\\])|' + // "[name]", "[name=value]",
    '(\\))|' + // ")"
    '(\\s*,\\s*)', // ","
'g');
/**
 * A css selector contains an element name,
 * css classes and attribute/value pairs with the purpose
 * of selecting subsets out of them.
 */
export class CssSelector {
    constructor() {
        this.element = null;
        this.classNames = [];
        /**
         * The selectors are encoded in pairs where:
         * - even locations are attribute names
         * - odd locations are attribute values.
         *
         * Example:
         * Selector: `[key1=value1][key2]` would parse to:
         * ```
         * ['key1', 'value1', 'key2', '']
         * ```
         */
        this.attrs = [];
        this.notSelectors = [];
    }
    /**
     * @param {?} selector
     * @return {?}
     */
    static parse(selector) {
        const /** @type {?} */ results = [];
        const /** @type {?} */ _addResult = (res, cssSel) => {
            if (cssSel.notSelectors.length > 0 && !cssSel.element && cssSel.classNames.length == 0 &&
                cssSel.attrs.length == 0) {
                cssSel.element = '*';
            }
            res.push(cssSel);
        };
        let /** @type {?} */ cssSelector = new CssSelector();
        let /** @type {?} */ match;
        let /** @type {?} */ current = cssSelector;
        let /** @type {?} */ inNot = false;
        _SELECTOR_REGEXP.lastIndex = 0;
        while (match = _SELECTOR_REGEXP.exec(selector)) {
            if (match[1]) {
                if (inNot) {
                    throw new Error('Nesting :not is not allowed in a selector');
                }
                inNot = true;
                current = new CssSelector();
                cssSelector.notSelectors.push(current);
            }
            if (match[2]) {
                current.setElement(match[2]);
            }
            if (match[3]) {
                current.addClassName(match[3]);
            }
            if (match[4]) {
                current.addAttribute(match[4], match[6]);
            }
            if (match[7]) {
                inNot = false;
                current = cssSelector;
            }
            if (match[8]) {
                if (inNot) {
                    throw new Error('Multiple selectors in :not are not supported');
                }
                _addResult(results, cssSelector);
                cssSelector = current = new CssSelector();
            }
        }
        _addResult(results, cssSelector);
        return results;
    }
    /**
     * @return {?}
     */
    isElementSelector() {
        return this.hasElementSelector() && this.classNames.length == 0 && this.attrs.length == 0 &&
            this.notSelectors.length === 0;
    }
    /**
     * @return {?}
     */
    hasElementSelector() { return !!this.element; }
    /**
     * @param {?=} element
     * @return {?}
     */
    setElement(element = null) { this.element = element; }
    /**
     * Gets a template string for an element that matches the selector.
     * @return {?}
     */
    getMatchingElementTemplate() {
        const /** @type {?} */ tagName = this.element || 'div';
        const /** @type {?} */ classAttr = this.classNames.length > 0 ? ` class="${this.classNames.join(' ')}"` : '';
        let /** @type {?} */ attrs = '';
        for (let /** @type {?} */ i = 0; i < this.attrs.length; i += 2) {
            const /** @type {?} */ attrName = this.attrs[i];
            const /** @type {?} */ attrValue = this.attrs[i + 1] !== '' ? `="${this.attrs[i + 1]}"` : '';
            attrs += ` ${attrName}${attrValue}`;
        }
        return getHtmlTagDefinition(tagName).isVoid ? `<${tagName}${classAttr}${attrs}/>` :
            `<${tagName}${classAttr}${attrs}></${tagName}>`;
    }
    /**
     * @return {?}
     */
    getAttrs() {
        const /** @type {?} */ result = [];
        if (this.classNames.length > 0) {
            result.push('class', this.classNames.join(' '));
        }
        return result.concat(this.attrs);
    }
    /**
     * @param {?} name
     * @param {?=} value
     * @return {?}
     */
    addAttribute(name, value = '') {
        this.attrs.push(name, value && value.toLowerCase() || '');
    }
    /**
     * @param {?} name
     * @return {?}
     */
    addClassName(name) { this.classNames.push(name.toLowerCase()); }
    /**
     * @return {?}
     */
    toString() {
        let /** @type {?} */ res = this.element || '';
        if (this.classNames) {
            this.classNames.forEach(klass => res += `.${klass}`);
        }
        if (this.attrs) {
            for (let /** @type {?} */ i = 0; i < this.attrs.length; i += 2) {
                const /** @type {?} */ name = this.attrs[i];
                const /** @type {?} */ value = this.attrs[i + 1];
                res += `[${name}${value ? '=' + value : ''}]`;
            }
        }
        this.notSelectors.forEach(notSelector => res += `:not(${notSelector})`);
        return res;
    }
}
function CssSelector_tsickle_Closure_declarations() {
    /** @type {?} */
    CssSelector.prototype.element;
    /** @type {?} */
    CssSelector.prototype.classNames;
    /**
     * The selectors are encoded in pairs where:
     * - even locations are attribute names
     * - odd locations are attribute values.
     *
     * Example:
     * Selector: `[key1=value1][key2]` would parse to:
     * ```
     * ['key1', 'value1', 'key2', '']
     * ```
     * @type {?}
     */
    CssSelector.prototype.attrs;
    /** @type {?} */
    CssSelector.prototype.notSelectors;
}
/**
 * Reads a list of CssSelectors and allows to calculate which ones
 * are contained in a given CssSelector.
 */
export class SelectorMatcher {
    constructor() {
        this._elementMap = new Map();
        this._elementPartialMap = new Map();
        this._classMap = new Map();
        this._classPartialMap = new Map();
        this._attrValueMap = new Map();
        this._attrValuePartialMap = new Map();
        this._listContexts = [];
    }
    /**
     * @param {?} notSelectors
     * @return {?}
     */
    static createNotMatcher(notSelectors) {
        const /** @type {?} */ notMatcher = new SelectorMatcher();
        notMatcher.addSelectables(notSelectors, null);
        return notMatcher;
    }
    /**
     * @param {?} cssSelectors
     * @param {?=} callbackCtxt
     * @return {?}
     */
    addSelectables(cssSelectors, callbackCtxt) {
        let /** @type {?} */ listContext = /** @type {?} */ ((null));
        if (cssSelectors.length > 1) {
            listContext = new SelectorListContext(cssSelectors);
            this._listContexts.push(listContext);
        }
        for (let /** @type {?} */ i = 0; i < cssSelectors.length; i++) {
            this._addSelectable(cssSelectors[i], callbackCtxt, listContext);
        }
    }
    /**
     * Add an object that can be found later on by calling `match`.
     * @param {?} cssSelector A css selector
     * @param {?} callbackCtxt An opaque object that will be given to the callback of the `match` function
     * @param {?} listContext
     * @return {?}
     */
    _addSelectable(cssSelector, callbackCtxt, listContext) {
        let /** @type {?} */ matcher = this;
        const /** @type {?} */ element = cssSelector.element;
        const /** @type {?} */ classNames = cssSelector.classNames;
        const /** @type {?} */ attrs = cssSelector.attrs;
        const /** @type {?} */ selectable = new SelectorContext(cssSelector, callbackCtxt, listContext);
        if (element) {
            const /** @type {?} */ isTerminal = attrs.length === 0 && classNames.length === 0;
            if (isTerminal) {
                this._addTerminal(matcher._elementMap, element, selectable);
            }
            else {
                matcher = this._addPartial(matcher._elementPartialMap, element);
            }
        }
        if (classNames) {
            for (let /** @type {?} */ i = 0; i < classNames.length; i++) {
                const /** @type {?} */ isTerminal = attrs.length === 0 && i === classNames.length - 1;
                const /** @type {?} */ className = classNames[i];
                if (isTerminal) {
                    this._addTerminal(matcher._classMap, className, selectable);
                }
                else {
                    matcher = this._addPartial(matcher._classPartialMap, className);
                }
            }
        }
        if (attrs) {
            for (let /** @type {?} */ i = 0; i < attrs.length; i += 2) {
                const /** @type {?} */ isTerminal = i === attrs.length - 2;
                const /** @type {?} */ name = attrs[i];
                const /** @type {?} */ value = attrs[i + 1];
                if (isTerminal) {
                    const /** @type {?} */ terminalMap = matcher._attrValueMap;
                    let /** @type {?} */ terminalValuesMap = terminalMap.get(name);
                    if (!terminalValuesMap) {
                        terminalValuesMap = new Map();
                        terminalMap.set(name, terminalValuesMap);
                    }
                    this._addTerminal(terminalValuesMap, value, selectable);
                }
                else {
                    const /** @type {?} */ partialMap = matcher._attrValuePartialMap;
                    let /** @type {?} */ partialValuesMap = partialMap.get(name);
                    if (!partialValuesMap) {
                        partialValuesMap = new Map();
                        partialMap.set(name, partialValuesMap);
                    }
                    matcher = this._addPartial(partialValuesMap, value);
                }
            }
        }
    }
    /**
     * @param {?} map
     * @param {?} name
     * @param {?} selectable
     * @return {?}
     */
    _addTerminal(map, name, selectable) {
        let /** @type {?} */ terminalList = map.get(name);
        if (!terminalList) {
            terminalList = [];
            map.set(name, terminalList);
        }
        terminalList.push(selectable);
    }
    /**
     * @param {?} map
     * @param {?} name
     * @return {?}
     */
    _addPartial(map, name) {
        let /** @type {?} */ matcher = map.get(name);
        if (!matcher) {
            matcher = new SelectorMatcher();
            map.set(name, matcher);
        }
        return matcher;
    }
    /**
     * Find the objects that have been added via `addSelectable`
     * whose css selector is contained in the given css selector.
     * @param {?} cssSelector A css selector
     * @param {?} matchedCallback This callback will be called with the object handed into `addSelectable`
     * @return {?} boolean true if a match was found
     */
    match(cssSelector, matchedCallback) {
        let /** @type {?} */ result = false;
        const /** @type {?} */ element = /** @type {?} */ ((cssSelector.element));
        const /** @type {?} */ classNames = cssSelector.classNames;
        const /** @type {?} */ attrs = cssSelector.attrs;
        for (let /** @type {?} */ i = 0; i < this._listContexts.length; i++) {
            this._listContexts[i].alreadyMatched = false;
        }
        result = this._matchTerminal(this._elementMap, element, cssSelector, matchedCallback) || result;
        result = this._matchPartial(this._elementPartialMap, element, cssSelector, matchedCallback) ||
            result;
        if (classNames) {
            for (let /** @type {?} */ i = 0; i < classNames.length; i++) {
                const /** @type {?} */ className = classNames[i];
                result =
                    this._matchTerminal(this._classMap, className, cssSelector, matchedCallback) || result;
                result =
                    this._matchPartial(this._classPartialMap, className, cssSelector, matchedCallback) ||
                        result;
            }
        }
        if (attrs) {
            for (let /** @type {?} */ i = 0; i < attrs.length; i += 2) {
                const /** @type {?} */ name = attrs[i];
                const /** @type {?} */ value = attrs[i + 1];
                const /** @type {?} */ terminalValuesMap = /** @type {?} */ ((this._attrValueMap.get(name)));
                if (value) {
                    result =
                        this._matchTerminal(terminalValuesMap, '', cssSelector, matchedCallback) || result;
                }
                result =
                    this._matchTerminal(terminalValuesMap, value, cssSelector, matchedCallback) || result;
                const /** @type {?} */ partialValuesMap = /** @type {?} */ ((this._attrValuePartialMap.get(name)));
                if (value) {
                    result = this._matchPartial(partialValuesMap, '', cssSelector, matchedCallback) || result;
                }
                result =
                    this._matchPartial(partialValuesMap, value, cssSelector, matchedCallback) || result;
            }
        }
        return result;
    }
    /**
     * \@internal
     * @param {?} map
     * @param {?} name
     * @param {?} cssSelector
     * @param {?} matchedCallback
     * @return {?}
     */
    _matchTerminal(map, name, cssSelector, matchedCallback) {
        if (!map || typeof name !== 'string') {
            return false;
        }
        let /** @type {?} */ selectables = map.get(name) || [];
        const /** @type {?} */ starSelectables = /** @type {?} */ ((map.get('*')));
        if (starSelectables) {
            selectables = selectables.concat(starSelectables);
        }
        if (selectables.length === 0) {
            return false;
        }
        let /** @type {?} */ selectable;
        let /** @type {?} */ result = false;
        for (let /** @type {?} */ i = 0; i < selectables.length; i++) {
            selectable = selectables[i];
            result = selectable.finalize(cssSelector, matchedCallback) || result;
        }
        return result;
    }
    /**
     * \@internal
     * @param {?} map
     * @param {?} name
     * @param {?} cssSelector
     * @param {?} matchedCallback
     * @return {?}
     */
    _matchPartial(map, name, cssSelector, matchedCallback) {
        if (!map || typeof name !== 'string') {
            return false;
        }
        const /** @type {?} */ nestedSelector = map.get(name);
        if (!nestedSelector) {
            return false;
        }
        // TODO(perf): get rid of recursion and measure again
        // TODO(perf): don't pass the whole selector into the recursion,
        // but only the not processed parts
        return nestedSelector.match(cssSelector, matchedCallback);
    }
}
function SelectorMatcher_tsickle_Closure_declarations() {
    /** @type {?} */
    SelectorMatcher.prototype._elementMap;
    /** @type {?} */
    SelectorMatcher.prototype._elementPartialMap;
    /** @type {?} */
    SelectorMatcher.prototype._classMap;
    /** @type {?} */
    SelectorMatcher.prototype._classPartialMap;
    /** @type {?} */
    SelectorMatcher.prototype._attrValueMap;
    /** @type {?} */
    SelectorMatcher.prototype._attrValuePartialMap;
    /** @type {?} */
    SelectorMatcher.prototype._listContexts;
}
export class SelectorListContext {
    /**
     * @param {?} selectors
     */
    constructor(selectors) {
        this.selectors = selectors;
        this.alreadyMatched = false;
    }
}
function SelectorListContext_tsickle_Closure_declarations() {
    /** @type {?} */
    SelectorListContext.prototype.alreadyMatched;
    /** @type {?} */
    SelectorListContext.prototype.selectors;
}
export class SelectorContext {
    /**
     * @param {?} selector
     * @param {?} cbContext
     * @param {?} listContext
     */
    constructor(selector, cbContext, listContext) {
        this.selector = selector;
        this.cbContext = cbContext;
        this.listContext = listContext;
        this.notSelectors = selector.notSelectors;
    }
    /**
     * @param {?} cssSelector
     * @param {?} callback
     * @return {?}
     */
    finalize(cssSelector, callback) {
        let /** @type {?} */ result = true;
        if (this.notSelectors.length > 0 && (!this.listContext || !this.listContext.alreadyMatched)) {
            const /** @type {?} */ notMatcher = SelectorMatcher.createNotMatcher(this.notSelectors);
            result = !notMatcher.match(cssSelector, null);
        }
        if (result && callback && (!this.listContext || !this.listContext.alreadyMatched)) {
            if (this.listContext) {
                this.listContext.alreadyMatched = true;
            }
            callback(this.selector, this.cbContext);
        }
        return result;
    }
}
function SelectorContext_tsickle_Closure_declarations() {
    /** @type {?} */
    SelectorContext.prototype.notSelectors;
    /** @type {?} */
    SelectorContext.prototype.selector;
    /** @type {?} */
    SelectorContext.prototype.cbContext;
    /** @type {?} */
    SelectorContext.prototype.listContext;
}
//# sourceMappingURL=selector.js.map