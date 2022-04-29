/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getHtmlTagDefinition } from './ml_parser/html_tags';
const _SELECTOR_REGEXP = new RegExp('(\\:not\\()|' + // 1: ":not("
    '(([\\.\\#]?)[-\\w]+)|' + // 2: "tag"; 3: "."/"#";
    // "-" should appear first in the regexp below as FF31 parses "[.-\w]" as a range
    // 4: attribute; 5: attribute_string; 6: attribute_value
    '(?:\\[([-.\\w*\\\\$]+)(?:=([\"\']?)([^\\]\"\']*)\\5)?\\])|' + // "[name]", "[name=value]",
    // "[name="value"]",
    // "[name='value']"
    '(\\))|' + // 7: ")"
    '(\\s*,\\s*)', // 8: ","
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
    static parse(selector) {
        const results = [];
        const _addResult = (res, cssSel) => {
            if (cssSel.notSelectors.length > 0 && !cssSel.element && cssSel.classNames.length == 0 &&
                cssSel.attrs.length == 0) {
                cssSel.element = '*';
            }
            res.push(cssSel);
        };
        let cssSelector = new CssSelector();
        let match;
        let current = cssSelector;
        let inNot = false;
        _SELECTOR_REGEXP.lastIndex = 0;
        while (match = _SELECTOR_REGEXP.exec(selector)) {
            if (match[1 /* NOT */]) {
                if (inNot) {
                    throw new Error('Nesting :not in a selector is not allowed');
                }
                inNot = true;
                current = new CssSelector();
                cssSelector.notSelectors.push(current);
            }
            const tag = match[2 /* TAG */];
            if (tag) {
                const prefix = match[3 /* PREFIX */];
                if (prefix === '#') {
                    // #hash
                    current.addAttribute('id', tag.slice(1));
                }
                else if (prefix === '.') {
                    // Class
                    current.addClassName(tag.slice(1));
                }
                else {
                    // Element
                    current.setElement(tag);
                }
            }
            const attribute = match[4 /* ATTRIBUTE */];
            if (attribute) {
                current.addAttribute(current.unescapeAttribute(attribute), match[6 /* ATTRIBUTE_VALUE */]);
            }
            if (match[7 /* NOT_END */]) {
                inNot = false;
                current = cssSelector;
            }
            if (match[8 /* SEPARATOR */]) {
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
     * Unescape `\$` sequences from the CSS attribute selector.
     *
     * This is needed because `$` can have a special meaning in CSS selectors,
     * but we might want to match an attribute that contains `$`.
     * [MDN web link for more
     * info](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors).
     * @param attr the attribute to unescape.
     * @returns the unescaped string.
     */
    unescapeAttribute(attr) {
        let result = '';
        let escaping = false;
        for (let i = 0; i < attr.length; i++) {
            const char = attr.charAt(i);
            if (char === '\\') {
                escaping = true;
                continue;
            }
            if (char === '$' && !escaping) {
                throw new Error(`Error in attribute selector "${attr}". ` +
                    `Unescaped "$" is not supported. Please escape with "\\$".`);
            }
            escaping = false;
            result += char;
        }
        return result;
    }
    /**
     * Escape `$` sequences from the CSS attribute selector.
     *
     * This is needed because `$` can have a special meaning in CSS selectors,
     * with this method we are escaping `$` with `\$'.
     * [MDN web link for more
     * info](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors).
     * @param attr the attribute to escape.
     * @returns the escaped string.
     */
    escapeAttribute(attr) {
        return attr.replace(/\\/g, '\\\\').replace(/\$/g, '\\$');
    }
    isElementSelector() {
        return this.hasElementSelector() && this.classNames.length == 0 && this.attrs.length == 0 &&
            this.notSelectors.length === 0;
    }
    hasElementSelector() {
        return !!this.element;
    }
    setElement(element = null) {
        this.element = element;
    }
    /** Gets a template string for an element that matches the selector. */
    getMatchingElementTemplate() {
        const tagName = this.element || 'div';
        const classAttr = this.classNames.length > 0 ? ` class="${this.classNames.join(' ')}"` : '';
        let attrs = '';
        for (let i = 0; i < this.attrs.length; i += 2) {
            const attrName = this.attrs[i];
            const attrValue = this.attrs[i + 1] !== '' ? `="${this.attrs[i + 1]}"` : '';
            attrs += ` ${attrName}${attrValue}`;
        }
        return getHtmlTagDefinition(tagName).isVoid ? `<${tagName}${classAttr}${attrs}/>` :
            `<${tagName}${classAttr}${attrs}></${tagName}>`;
    }
    getAttrs() {
        const result = [];
        if (this.classNames.length > 0) {
            result.push('class', this.classNames.join(' '));
        }
        return result.concat(this.attrs);
    }
    addAttribute(name, value = '') {
        this.attrs.push(name, value && value.toLowerCase() || '');
    }
    addClassName(name) {
        this.classNames.push(name.toLowerCase());
    }
    toString() {
        let res = this.element || '';
        if (this.classNames) {
            this.classNames.forEach(klass => res += `.${klass}`);
        }
        if (this.attrs) {
            for (let i = 0; i < this.attrs.length; i += 2) {
                const name = this.escapeAttribute(this.attrs[i]);
                const value = this.attrs[i + 1];
                res += `[${name}${value ? '=' + value : ''}]`;
            }
        }
        this.notSelectors.forEach(notSelector => res += `:not(${notSelector})`);
        return res;
    }
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
    static createNotMatcher(notSelectors) {
        const notMatcher = new SelectorMatcher();
        notMatcher.addSelectables(notSelectors, null);
        return notMatcher;
    }
    addSelectables(cssSelectors, callbackCtxt) {
        let listContext = null;
        if (cssSelectors.length > 1) {
            listContext = new SelectorListContext(cssSelectors);
            this._listContexts.push(listContext);
        }
        for (let i = 0; i < cssSelectors.length; i++) {
            this._addSelectable(cssSelectors[i], callbackCtxt, listContext);
        }
    }
    /**
     * Add an object that can be found later on by calling `match`.
     * @param cssSelector A css selector
     * @param callbackCtxt An opaque object that will be given to the callback of the `match` function
     */
    _addSelectable(cssSelector, callbackCtxt, listContext) {
        let matcher = this;
        const element = cssSelector.element;
        const classNames = cssSelector.classNames;
        const attrs = cssSelector.attrs;
        const selectable = new SelectorContext(cssSelector, callbackCtxt, listContext);
        if (element) {
            const isTerminal = attrs.length === 0 && classNames.length === 0;
            if (isTerminal) {
                this._addTerminal(matcher._elementMap, element, selectable);
            }
            else {
                matcher = this._addPartial(matcher._elementPartialMap, element);
            }
        }
        if (classNames) {
            for (let i = 0; i < classNames.length; i++) {
                const isTerminal = attrs.length === 0 && i === classNames.length - 1;
                const className = classNames[i];
                if (isTerminal) {
                    this._addTerminal(matcher._classMap, className, selectable);
                }
                else {
                    matcher = this._addPartial(matcher._classPartialMap, className);
                }
            }
        }
        if (attrs) {
            for (let i = 0; i < attrs.length; i += 2) {
                const isTerminal = i === attrs.length - 2;
                const name = attrs[i];
                const value = attrs[i + 1];
                if (isTerminal) {
                    const terminalMap = matcher._attrValueMap;
                    let terminalValuesMap = terminalMap.get(name);
                    if (!terminalValuesMap) {
                        terminalValuesMap = new Map();
                        terminalMap.set(name, terminalValuesMap);
                    }
                    this._addTerminal(terminalValuesMap, value, selectable);
                }
                else {
                    const partialMap = matcher._attrValuePartialMap;
                    let partialValuesMap = partialMap.get(name);
                    if (!partialValuesMap) {
                        partialValuesMap = new Map();
                        partialMap.set(name, partialValuesMap);
                    }
                    matcher = this._addPartial(partialValuesMap, value);
                }
            }
        }
    }
    _addTerminal(map, name, selectable) {
        let terminalList = map.get(name);
        if (!terminalList) {
            terminalList = [];
            map.set(name, terminalList);
        }
        terminalList.push(selectable);
    }
    _addPartial(map, name) {
        let matcher = map.get(name);
        if (!matcher) {
            matcher = new SelectorMatcher();
            map.set(name, matcher);
        }
        return matcher;
    }
    /**
     * Find the objects that have been added via `addSelectable`
     * whose css selector is contained in the given css selector.
     * @param cssSelector A css selector
     * @param matchedCallback This callback will be called with the object handed into `addSelectable`
     * @return boolean true if a match was found
     */
    match(cssSelector, matchedCallback) {
        let result = false;
        const element = cssSelector.element;
        const classNames = cssSelector.classNames;
        const attrs = cssSelector.attrs;
        for (let i = 0; i < this._listContexts.length; i++) {
            this._listContexts[i].alreadyMatched = false;
        }
        result = this._matchTerminal(this._elementMap, element, cssSelector, matchedCallback) || result;
        result = this._matchPartial(this._elementPartialMap, element, cssSelector, matchedCallback) ||
            result;
        if (classNames) {
            for (let i = 0; i < classNames.length; i++) {
                const className = classNames[i];
                result =
                    this._matchTerminal(this._classMap, className, cssSelector, matchedCallback) || result;
                result =
                    this._matchPartial(this._classPartialMap, className, cssSelector, matchedCallback) ||
                        result;
            }
        }
        if (attrs) {
            for (let i = 0; i < attrs.length; i += 2) {
                const name = attrs[i];
                const value = attrs[i + 1];
                const terminalValuesMap = this._attrValueMap.get(name);
                if (value) {
                    result =
                        this._matchTerminal(terminalValuesMap, '', cssSelector, matchedCallback) || result;
                }
                result =
                    this._matchTerminal(terminalValuesMap, value, cssSelector, matchedCallback) || result;
                const partialValuesMap = this._attrValuePartialMap.get(name);
                if (value) {
                    result = this._matchPartial(partialValuesMap, '', cssSelector, matchedCallback) || result;
                }
                result =
                    this._matchPartial(partialValuesMap, value, cssSelector, matchedCallback) || result;
            }
        }
        return result;
    }
    /** @internal */
    _matchTerminal(map, name, cssSelector, matchedCallback) {
        if (!map || typeof name !== 'string') {
            return false;
        }
        let selectables = map.get(name) || [];
        const starSelectables = map.get('*');
        if (starSelectables) {
            selectables = selectables.concat(starSelectables);
        }
        if (selectables.length === 0) {
            return false;
        }
        let selectable;
        let result = false;
        for (let i = 0; i < selectables.length; i++) {
            selectable = selectables[i];
            result = selectable.finalize(cssSelector, matchedCallback) || result;
        }
        return result;
    }
    /** @internal */
    _matchPartial(map, name, cssSelector, matchedCallback) {
        if (!map || typeof name !== 'string') {
            return false;
        }
        const nestedSelector = map.get(name);
        if (!nestedSelector) {
            return false;
        }
        // TODO(perf): get rid of recursion and measure again
        // TODO(perf): don't pass the whole selector into the recursion,
        // but only the not processed parts
        return nestedSelector.match(cssSelector, matchedCallback);
    }
}
export class SelectorListContext {
    constructor(selectors) {
        this.selectors = selectors;
        this.alreadyMatched = false;
    }
}
// Store context to pass back selector and context when a selector is matched
export class SelectorContext {
    constructor(selector, cbContext, listContext) {
        this.selector = selector;
        this.cbContext = cbContext;
        this.listContext = listContext;
        this.notSelectors = selector.notSelectors;
    }
    finalize(cssSelector, callback) {
        let result = true;
        if (this.notSelectors.length > 0 && (!this.listContext || !this.listContext.alreadyMatched)) {
            const notMatcher = SelectorMatcher.createNotMatcher(this.notSelectors);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VsZWN0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvc2VsZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFFM0QsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLE1BQU0sQ0FDL0IsY0FBYyxHQUFpQixhQUFhO0lBQ3hDLHVCQUF1QixHQUFJLHdCQUF3QjtJQUNuRCxpRkFBaUY7SUFDakYsd0RBQXdEO0lBQ3hELDREQUE0RCxHQUFJLDRCQUE0QjtJQUM1QixvQkFBb0I7SUFDcEIsbUJBQW1CO0lBQ25GLFFBQVEsR0FBd0QsU0FBUztJQUN6RSxhQUFhLEVBQW1ELFNBQVM7QUFDN0UsR0FBRyxDQUFDLENBQUM7QUFnQlQ7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxXQUFXO0lBQXhCO1FBQ0UsWUFBTyxHQUFnQixJQUFJLENBQUM7UUFDNUIsZUFBVSxHQUFhLEVBQUUsQ0FBQztRQUMxQjs7Ozs7Ozs7OztXQVVHO1FBQ0gsVUFBSyxHQUFhLEVBQUUsQ0FBQztRQUNyQixpQkFBWSxHQUFrQixFQUFFLENBQUM7SUFxS25DLENBQUM7SUFuS0MsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFnQjtRQUMzQixNQUFNLE9BQU8sR0FBa0IsRUFBRSxDQUFDO1FBQ2xDLE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxNQUFtQixFQUFFLEVBQUU7WUFDN0QsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxJQUFJLENBQUM7Z0JBQ2xGLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtnQkFDNUIsTUFBTSxDQUFDLE9BQU8sR0FBRyxH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QUNoRixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbEIsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQzNGLE1BQU0sVUFBVSxHQUFHLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDdkUsTUFBTSxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDL0M7UUFDRCxJQUFJLE1BQU0sSUFBSSxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQ2pGLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDcEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO2FBQ3hDO1lBQ0QsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ3pDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Z2V0SHRtbFRhZ0RlZmluaXRpb259IGZyb20gJy4vbWxfcGFyc2VyL2h0bWxfdGFncyc7XG5cbmNvbnN0IF9TRUxFQ1RPUl9SRUdFWFAgPSBuZXcgUmVnRXhwKFxuICAgICcoXFxcXDpub3RcXFxcKCl8JyArICAgICAgICAgICAgICAgLy8gMTogXCI6bm90KFwiXG4gICAgICAgICcoKFtcXFxcLlxcXFwjXT8pWy1cXFxcd10rKXwnICsgIC8vIDI6IFwidGFnXCI7IDM6IFwiLlwiL1wiI1wiO1xuICAgICAgICAvLyBcIi1cIiBzaG91bGQgYXBwZWFyIGZpcnN0IGluIHRoZSByZWdleHAgYmVsb3cgYXMgRkYzMSBwYXJzZXMgXCJbLi1cXHddXCIgYXMgYSByYW5nZVxuICAgICAgICAvLyA0OiBhdHRyaWJ1dGU7IDU6IGF0dHJpYnV0ZV9zdHJpbmc7IDY6IGF0dHJpYnV0ZV92YWx1ZVxuICAgICAgICAnKD86XFxcXFsoWy0uXFxcXHcqXFxcXFxcXFwkXSspKD86PShbXFxcIlxcJ10/KShbXlxcXFxdXFxcIlxcJ10qKVxcXFw1KT9cXFxcXSl8JyArICAvLyBcIltuYW1lXVwiLCBcIltuYW1lPXZhbHVlXVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gXCJbbmFtZT1cInZhbHVlXCJdXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBcIltuYW1lPSd2YWx1ZSddXCJcbiAgICAgICAgJyhcXFxcKSl8JyArICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gNzogXCIpXCJcbiAgICAgICAgJyhcXFxccyosXFxcXHMqKScsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyA4OiBcIixcIlxuICAgICdnJyk7XG5cbi8qKlxuICogVGhlc2Ugb2Zmc2V0cyBzaG91bGQgbWF0Y2ggdGhlIG1hdGNoLWdyb3VwcyBpbiBgX1NFTEVDVE9SX1JFR0VYUGAgb2Zmc2V0cy5cbiAqL1xuY29uc3QgZW51bSBTZWxlY3RvclJlZ2V4cCB7XG4gIEFMTCA9IDAsICAvLyBUaGUgd2hvbGUgbWF0Y2hcbiAgTk9UID0gMSxcbiAgVEFHID0gMixcbiAgUFJFRklYID0gMyxcbiAgQVRUUklCVVRFID0gNCxcbiAgQVRUUklCVVRFX1NUUklORyA9IDUsXG4gIEFUVFJJQlVURV9WQUxVRSA9IDYsXG4gIE5PVF9FTkQgPSA3LFxuICBTRVBBUkFUT1IgPSA4LFxufVxuLyoqXG4gKiBBIGNzcyBzZWxlY3RvciBjb250YWlucyBhbiBlbGVtZW50IG5hbWUsXG4gKiBjc3MgY2xhc3NlcyBhbmQgYXR0cmlidXRlL3ZhbHVlIHBhaXJzIHdpdGggdGhlIHB1cnBvc2VcbiAqIG9mIHNlbGVjdGluZyBzdWJzZXRzIG91dCBvZiB0aGVtLlxuICovXG5leHBvcnQgY2xhc3MgQ3NzU2VsZWN0b3Ige1xuICBlbGVtZW50OiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gIGNsYXNzTmFtZXM6IHN0cmluZ1tdID0gW107XG4gIC8qKlxuICAgKiBUaGUgc2VsZWN0b3JzIGFyZSBlbmNvZGVkIGluIHBhaXJzIHdoZXJlOlxuICAgKiAtIGV2ZW4gbG9jYXRpb25zIGFyZSBhdHRyaWJ1dGUgbmFtZXNcbiAgICogLSBvZGQgbG9jYXRpb25zIGFyZSBhdHRyaWJ1dGUgdmFsdWVzLlxuICAgKlxuICAgKiBFeGFtcGxlOlxuICAgKiBTZWxlY3RvcjogYFtrZXkxPXZhbHVlMV1ba2V5Ml1gIHdvdWxkIHBhcnNlIHRvOlxuICAgKiBgYGBcbiAgICogWydrZXkxJywgJ3ZhbHVlMScsICdrZXkyJywgJyddXG4gICAqIGBgYFxuICAgKi9cbiAgYXR0cnM6IHN0cmluZ1tdID0gW107XG4gIG5vdFNlbGVjdG9yczogQ3NzU2VsZWN0b3JbXSA9IFtdO1xuXG4gIHN0YXRpYyBwYXJzZShzZWxlY3Rvcjogc3RyaW5nKTogQ3NzU2VsZWN0b3JbXSB7XG4gICAgY29uc3QgcmVzdWx0czogQ3NzU2VsZWN0b3JbXSA9IFtdO1xuICAgIGNvbnN0IF9hZGRSZXN1bHQgPSAocmVzOiBDc3NTZWxlY3RvcltdLCBjc3NTZWw6IENzc1NlbGVjdG9yKSA9PiB7XG4gICAgICBpZiAoY3NzU2VsLm5vdFNlbGVjdG9ycy5sZW5ndGggPiAwICYmICFjc3NTZWwuZWxlbWVudCAmJiBjc3NTZWwuY2xhc3NOYW1lcy5sZW5ndGggPT0gMCAmJlxuICAgICAgICAgIGNzc1NlbC5hdHRycy5sZW5ndGggPT0gMCkge1xuICAgICAgICBjc3NTZWwuZWxlbWVudCA9ICcqJztcbiAgICAgIH1cbiAgICAgIHJlcy5wdXNoKGNzc1NlbCk7XG4gICAgfTtcbiAgICBsZXQgY3NzU2VsZWN0b3IgPSBuZXcgQ3NzU2VsZWN0b3IoKTtcbiAgICBsZXQgbWF0Y2g6IHN0cmluZ1tdfG51bGw7XG4gICAgbGV0IGN1cnJlbnQgPSBjc3NTZWxlY3RvcjtcbiAgICBsZXQgaW5Ob3QgPSBmYWxzZTtcbiAgICBfU0VMRUNUT1JfUkVHRVhQLmxhc3RJbmRleCA9IDA7XG4gICAgd2hpbGUgKG1hdGNoID0gX1NFTEVDVE9SX1JFR0VYUC5leGVjKHNlbGVjdG9yKSkge1xuICAgICAgaWYgKG1hdGNoW1NlbGVjdG9yUmVnZXhwLk5PVF0pIHtcbiAgICAgICAgaWYgKGluTm90KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOZXN0aW5nIDpub3QgaW4gYSBzZWxlY3RvciBpcyBub3QgYWxsb3dlZCcpO1xuICAgICAgICB9XG4gICAgICAgIGluTm90ID0gdHJ1ZTtcbiAgICAgICAgY3VycmVudCA9IG5ldyBDc3NTZWxlY3RvcigpO1xuICAgICAgICBjc3NTZWxlY3Rvci5ub3RTZWxlY3RvcnMucHVzaChjdXJyZW50KTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRhZyA9IG1hdGNoW1NlbGVjdG9yUmVnZXhwLlRBR107XG4gICAgICBpZiAodGFnKSB7XG4gICAgICAgIGNvbnN0IHByZWZpeCA9IG1hdGNoW1NlbGVjdG9yUmVnZXhwLlBSRUZJWF07XG4gICAgICAgIGlmIChwcmVmaXggPT09ICcjJykge1xuICAgICAgICAgIC8vICNoYXNoXG4gICAgICAgICAgY3VycmVudC5hZGRBdHRyaWJ1dGUoJ2lkJywgdGFnLnNsaWNlKDEpKTtcbiAgICAgICAgfSBlbHNlIGlmIChwcmVmaXggPT09ICcuJykge1xuICAgICAgICAgIC8vIENsYXNzXG4gICAgICAgICAgY3VycmVudC5hZGRDbGFzc05hbWUodGFnLnNsaWNlKDEpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBFbGVtZW50XG4gICAgICAgICAgY3VycmVudC5zZXRFbGVtZW50KHRhZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IGF0dHJpYnV0ZSA9IG1hdGNoW1NlbGVjdG9yUmVnZXhwLkFUVFJJQlVURV07XG5cbiAgICAgIGlmIChhdHRyaWJ1dGUpIHtcbiAgICAgICAgY3VycmVudC5hZGRBdHRyaWJ1dGUoXG4gICAgICAgICAgICBjdXJyZW50LnVuZXNjYXBlQXR0cmlidXRlKGF0dHJpYnV0ZSksIG1hdGNoW1NlbGVjdG9yUmVnZXhwLkFUVFJJQlVURV9WQUxVRV0pO1xuICAgICAgfVxuICAgICAgaWYgKG1hdGNoW1NlbGVjdG9yUmVnZXhwLk5PVF9FTkRdKSB7XG4gICAgICAgIGluTm90ID0gZmFsc2U7XG4gICAgICAgIGN1cnJlbnQgPSBjc3NTZWxlY3RvcjtcbiAgICAgIH1cbiAgICAgIGlmIChtYXRjaFtTZWxlY3RvclJlZ2V4cC5TRVBBUkFUT1JdKSB7XG4gICAgICAgIGlmIChpbk5vdCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTXVsdGlwbGUgc2VsZWN0b3JzIGluIDpub3QgYXJlIG5vdCBzdXBwb3J0ZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBfYWRkUmVzdWx0KHJlc3VsdHMsIGNzc1NlbGVjdG9yKTtcbiAgICAgICAgY3NzU2VsZWN0b3IgPSBjdXJyZW50ID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gICAgICB9XG4gICAgfVxuICAgIF9hZGRSZXN1bHQocmVzdWx0cywgY3NzU2VsZWN0b3IpO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVuZXNjYXBlIGBcXCRgIHNlcXVlbmNlcyBmcm9tIHRoZSBDU1MgYXR0cmlidXRlIHNlbGVjdG9yLlxuICAgKlxuICAgKiBUaGlzIGlzIG5lZWRlZCBiZWNhdXNlIGAkYCBjYW4gaGF2ZSBhIHNwZWNpYWwgbWVhbmluZyBpbiBDU1Mgc2VsZWN0b3JzLFxuICAgKiBidXQgd2UgbWlnaHQgd2FudCB0byBtYXRjaCBhbiBhdHRyaWJ1dGUgdGhhdCBjb250YWlucyBgJGAuXG4gICAqIFtNRE4gd2ViIGxpbmsgZm9yIG1vcmVcbiAgICogaW5mb10oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL0F0dHJpYnV0ZV9zZWxlY3RvcnMpLlxuICAgKiBAcGFyYW0gYXR0ciB0aGUgYXR0cmlidXRlIHRvIHVuZXNjYXBlLlxuICAgKiBAcmV0dXJucyB0aGUgdW5lc2NhcGVkIHN0cmluZy5cbiAgICovXG4gIHVuZXNjYXBlQXR0cmlidXRlKGF0dHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGxldCBlc2NhcGluZyA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXR0ci5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY2hhciA9IGF0dHIuY2hhckF0KGkpO1xuICAgICAgaWYgKGNoYXIgPT09ICdcXFxcJykge1xuICAgICAgICBlc2NhcGluZyA9IHRydWU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKGNoYXIgPT09ICckJyAmJiAhZXNjYXBpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEVycm9yIGluIGF0dHJpYnV0ZSBzZWxlY3RvciBcIiR7YXR0cn1cIi4gYCArXG4gICAgICAgICAgICBgVW5lc2NhcGVkIFwiJFwiIGlzIG5vdCBzdXBwb3J0ZWQuIFBsZWFzZSBlc2NhcGUgd2l0aCBcIlxcXFwkXCIuYCk7XG4gICAgICB9XG4gICAgICBlc2NhcGluZyA9IGZhbHNlO1xuICAgICAgcmVzdWx0ICs9IGNoYXI7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogRXNjYXBlIGAkYCBzZXF1ZW5jZXMgZnJvbSB0aGUgQ1NTIGF0dHJpYnV0ZSBzZWxlY3Rvci5cbiAgICpcbiAgICogVGhpcyBpcyBuZWVkZWQgYmVjYXVzZSBgJGAgY2FuIGhhdmUgYSBzcGVjaWFsIG1lYW5pbmcgaW4gQ1NTIHNlbGVjdG9ycyxcbiAgICogd2l0aCB0aGlzIG1ldGhvZCB3ZSBhcmUgZXNjYXBpbmcgYCRgIHdpdGggYFxcJCcuXG4gICAqIFtNRE4gd2ViIGxpbmsgZm9yIG1vcmVcbiAgICogaW5mb10oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL0F0dHJpYnV0ZV9zZWxlY3RvcnMpLlxuICAgKiBAcGFyYW0gYXR0ciB0aGUgYXR0cmlidXRlIHRvIGVzY2FwZS5cbiAgICogQHJldHVybnMgdGhlIGVzY2FwZWQgc3RyaW5nLsKgXG4gICAqL1xuICBlc2NhcGVBdHRyaWJ1dGUoYXR0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYXR0ci5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpLnJlcGxhY2UoL1xcJC9nLCAnXFxcXCQnKTtcbiAgfVxuXG4gIGlzRWxlbWVudFNlbGVjdG9yKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmhhc0VsZW1lbnRTZWxlY3RvcigpICYmIHRoaXMuY2xhc3NOYW1lcy5sZW5ndGggPT0gMCAmJiB0aGlzLmF0dHJzLmxlbmd0aCA9PSAwICYmXG4gICAgICAgIHRoaXMubm90U2VsZWN0b3JzLmxlbmd0aCA9PT0gMDtcbiAgfVxuXG4gIGhhc0VsZW1lbnRTZWxlY3RvcigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gISF0aGlzLmVsZW1lbnQ7XG4gIH1cblxuICBzZXRFbGVtZW50KGVsZW1lbnQ6IHN0cmluZ3xudWxsID0gbnVsbCkge1xuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gIH1cblxuICAvKiogR2V0cyBhIHRlbXBsYXRlIHN0cmluZyBmb3IgYW4gZWxlbWVudCB0aGF0IG1hdGNoZXMgdGhlIHNlbGVjdG9yLiAqL1xuICBnZXRNYXRjaGluZ0VsZW1lbnRUZW1wbGF0ZSgpOiBzdHJpbmcge1xuICAgIGNvbnN0IHRhZ05hbWUgPSB0aGlzLmVsZW1lbnQgfHwgJ2Rpdic7XG4gICAgY29uc3QgY2xhc3NBdHRyID0gdGhpcy5jbGFzc05hbWVzLmxlbmd0aCA+IDAgPyBgIGNsYXNzPVwiJHt0aGlzLmNsYXNzTmFtZXMuam9pbignICcpfVwiYCA6ICcnO1xuXG4gICAgbGV0IGF0dHJzID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmF0dHJzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICBjb25zdCBhdHRyTmFtZSA9IHRoaXMuYXR0cnNbaV07XG4gICAgICBjb25zdCBhdHRyVmFsdWUgPSB0aGlzLmF0dHJzW2kgKyAxXSAhPT0gJycgPyBgPVwiJHt0aGlzLmF0dHJzW2kgKyAxXX1cImAgOiAnJztcbiAgICAgIGF0dHJzICs9IGAgJHthdHRyTmFtZX0ke2F0dHJWYWx1ZX1gO1xuICAgIH1cblxuICAgIHJldHVybiBnZXRIdG1sVGFnRGVmaW5pdGlvbih0YWdOYW1lKS5pc1ZvaWQgPyBgPCR7dGFnTmFtZX0ke2NsYXNzQXR0cn0ke2F0dHJzfS8+YCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGA8JHt0YWdOYW1lfSR7Y2xhc3NBdHRyfSR7YXR0cnN9PjwvJHt0YWdOYW1lfT5gO1xuICB9XG5cbiAgZ2V0QXR0cnMoKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAodGhpcy5jbGFzc05hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5wdXNoKCdjbGFzcycsIHRoaXMuY2xhc3NOYW1lcy5qb2luKCcgJykpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0LmNvbmNhdCh0aGlzLmF0dHJzKTtcbiAgfVxuXG4gIGFkZEF0dHJpYnV0ZShuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcgPSAnJykge1xuICAgIHRoaXMuYXR0cnMucHVzaChuYW1lLCB2YWx1ZSAmJiB2YWx1ZS50b0xvd2VyQ2FzZSgpIHx8ICcnKTtcbiAgfVxuXG4gIGFkZENsYXNzTmFtZShuYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmNsYXNzTmFtZXMucHVzaChuYW1lLnRvTG93ZXJDYXNlKCkpO1xuICB9XG5cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICBsZXQgcmVzOiBzdHJpbmcgPSB0aGlzLmVsZW1lbnQgfHwgJyc7XG4gICAgaWYgKHRoaXMuY2xhc3NOYW1lcykge1xuICAgICAgdGhpcy5jbGFzc05hbWVzLmZvckVhY2goa2xhc3MgPT4gcmVzICs9IGAuJHtrbGFzc31gKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuYXR0cnMpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hdHRycy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5lc2NhcGVBdHRyaWJ1dGUodGhpcy5hdHRyc1tpXSk7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5hdHRyc1tpICsgMV07XG4gICAgICAgIHJlcyArPSBgWyR7bmFtZX0ke3ZhbHVlID8gJz0nICsgdmFsdWUgOiAnJ31dYDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5ub3RTZWxlY3RvcnMuZm9yRWFjaChub3RTZWxlY3RvciA9PiByZXMgKz0gYDpub3QoJHtub3RTZWxlY3Rvcn0pYCk7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxufVxuXG4vKipcbiAqIFJlYWRzIGEgbGlzdCBvZiBDc3NTZWxlY3RvcnMgYW5kIGFsbG93cyB0byBjYWxjdWxhdGUgd2hpY2ggb25lc1xuICogYXJlIGNvbnRhaW5lZCBpbiBhIGdpdmVuIENzc1NlbGVjdG9yLlxuICovXG5leHBvcnQgY2xhc3MgU2VsZWN0b3JNYXRjaGVyPFQgPSBhbnk+IHtcbiAgc3RhdGljIGNyZWF0ZU5vdE1hdGNoZXIobm90U2VsZWN0b3JzOiBDc3NTZWxlY3RvcltdKTogU2VsZWN0b3JNYXRjaGVyPG51bGw+IHtcbiAgICBjb25zdCBub3RNYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcjxudWxsPigpO1xuICAgIG5vdE1hdGNoZXIuYWRkU2VsZWN0YWJsZXMobm90U2VsZWN0b3JzLCBudWxsKTtcbiAgICByZXR1cm4gbm90TWF0Y2hlcjtcbiAgfVxuXG4gIHByaXZhdGUgX2VsZW1lbnRNYXAgPSBuZXcgTWFwPHN0cmluZywgU2VsZWN0b3JDb250ZXh0PFQ+W10+KCk7XG4gIHByaXZhdGUgX2VsZW1lbnRQYXJ0aWFsTWFwID0gbmV3IE1hcDxzdHJpbmcsIFNlbGVjdG9yTWF0Y2hlcjxUPj4oKTtcbiAgcHJpdmF0ZSBfY2xhc3NNYXAgPSBuZXcgTWFwPHN0cmluZywgU2VsZWN0b3JDb250ZXh0PFQ+W10+KCk7XG4gIHByaXZhdGUgX2NsYXNzUGFydGlhbE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBTZWxlY3Rvck1hdGNoZXI8VD4+KCk7XG4gIHByaXZhdGUgX2F0dHJWYWx1ZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBNYXA8c3RyaW5nLCBTZWxlY3RvckNvbnRleHQ8VD5bXT4+KCk7XG4gIHByaXZhdGUgX2F0dHJWYWx1ZVBhcnRpYWxNYXAgPSBuZXcgTWFwPHN0cmluZywgTWFwPHN0cmluZywgU2VsZWN0b3JNYXRjaGVyPFQ+Pj4oKTtcbiAgcHJpdmF0ZSBfbGlzdENvbnRleHRzOiBTZWxlY3Rvckxpc3RDb250ZXh0W10gPSBbXTtcblxuICBhZGRTZWxlY3RhYmxlcyhjc3NTZWxlY3RvcnM6IENzc1NlbGVjdG9yW10sIGNhbGxiYWNrQ3R4dD86IFQpIHtcbiAgICBsZXQgbGlzdENvbnRleHQ6IFNlbGVjdG9yTGlzdENvbnRleHQgPSBudWxsITtcbiAgICBpZiAoY3NzU2VsZWN0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGxpc3RDb250ZXh0ID0gbmV3IFNlbGVjdG9yTGlzdENvbnRleHQoY3NzU2VsZWN0b3JzKTtcbiAgICAgIHRoaXMuX2xpc3RDb250ZXh0cy5wdXNoKGxpc3RDb250ZXh0KTtcbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjc3NTZWxlY3RvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuX2FkZFNlbGVjdGFibGUoY3NzU2VsZWN0b3JzW2ldLCBjYWxsYmFja0N0eHQgYXMgVCwgbGlzdENvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gb2JqZWN0IHRoYXQgY2FuIGJlIGZvdW5kIGxhdGVyIG9uIGJ5IGNhbGxpbmcgYG1hdGNoYC5cbiAgICogQHBhcmFtIGNzc1NlbGVjdG9yIEEgY3NzIHNlbGVjdG9yXG4gICAqIEBwYXJhbSBjYWxsYmFja0N0eHQgQW4gb3BhcXVlIG9iamVjdCB0aGF0IHdpbGwgYmUgZ2l2ZW4gdG8gdGhlIGNhbGxiYWNrIG9mIHRoZSBgbWF0Y2hgIGZ1bmN0aW9uXG4gICAqL1xuICBwcml2YXRlIF9hZGRTZWxlY3RhYmxlKFxuICAgICAgY3NzU2VsZWN0b3I6IENzc1NlbGVjdG9yLCBjYWxsYmFja0N0eHQ6IFQsIGxpc3RDb250ZXh0OiBTZWxlY3Rvckxpc3RDb250ZXh0KSB7XG4gICAgbGV0IG1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxUPiA9IHRoaXM7XG4gICAgY29uc3QgZWxlbWVudCA9IGNzc1NlbGVjdG9yLmVsZW1lbnQ7XG4gICAgY29uc3QgY2xhc3NOYW1lcyA9IGNzc1NlbGVjdG9yLmNsYXNzTmFtZXM7XG4gICAgY29uc3QgYXR0cnMgPSBjc3NTZWxlY3Rvci5hdHRycztcbiAgICBjb25zdCBzZWxlY3RhYmxlID0gbmV3IFNlbGVjdG9yQ29udGV4dChjc3NTZWxlY3RvciwgY2FsbGJhY2tDdHh0LCBsaXN0Q29udGV4dCk7XG5cbiAgICBpZiAoZWxlbWVudCkge1xuICAgICAgY29uc3QgaXNUZXJtaW5hbCA9IGF0dHJzLmxlbmd0aCA9PT0gMCAmJiBjbGFzc05hbWVzLmxlbmd0aCA9PT0gMDtcbiAgICAgIGlmIChpc1Rlcm1pbmFsKSB7XG4gICAgICAgIHRoaXMuX2FkZFRlcm1pbmFsKG1hdGNoZXIuX2VsZW1lbnRNYXAsIGVsZW1lbnQsIHNlbGVjdGFibGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWF0Y2hlciA9IHRoaXMuX2FkZFBhcnRpYWwobWF0Y2hlci5fZWxlbWVudFBhcnRpYWxNYXAsIGVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjbGFzc05hbWVzKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsYXNzTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgaXNUZXJtaW5hbCA9IGF0dHJzLmxlbmd0aCA9PT0gMCAmJiBpID09PSBjbGFzc05hbWVzLmxlbmd0aCAtIDE7XG4gICAgICAgIGNvbnN0IGNsYXNzTmFtZSA9IGNsYXNzTmFtZXNbaV07XG4gICAgICAgIGlmIChpc1Rlcm1pbmFsKSB7XG4gICAgICAgICAgdGhpcy5fYWRkVGVybWluYWwobWF0Y2hlci5fY2xhc3NNYXAsIGNsYXNzTmFtZSwgc2VsZWN0YWJsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWF0Y2hlciA9IHRoaXMuX2FkZFBhcnRpYWwobWF0Y2hlci5fY2xhc3NQYXJ0aWFsTWFwLCBjbGFzc05hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGF0dHJzKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGNvbnN0IGlzVGVybWluYWwgPSBpID09PSBhdHRycy5sZW5ndGggLSAyO1xuICAgICAgICBjb25zdCBuYW1lID0gYXR0cnNbaV07XG4gICAgICAgIGNvbnN0IHZhbHVlID0gYXR0cnNbaSArIDFdO1xuICAgICAgICBpZiAoaXNUZXJtaW5hbCkge1xuICAgICAgICAgIGNvbnN0IHRlcm1pbmFsTWFwID0gbWF0Y2hlci5fYXR0clZhbHVlTWFwO1xuICAgICAgICAgIGxldCB0ZXJtaW5hbFZhbHVlc01hcCA9IHRlcm1pbmFsTWFwLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAoIXRlcm1pbmFsVmFsdWVzTWFwKSB7XG4gICAgICAgICAgICB0ZXJtaW5hbFZhbHVlc01hcCA9IG5ldyBNYXA8c3RyaW5nLCBTZWxlY3RvckNvbnRleHQ8VD5bXT4oKTtcbiAgICAgICAgICAgIHRlcm1pbmFsTWFwLnNldChuYW1lLCB0ZXJtaW5hbFZhbHVlc01hcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2FkZFRlcm1pbmFsKHRlcm1pbmFsVmFsdWVzTWFwLCB2YWx1ZSwgc2VsZWN0YWJsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcGFydGlhbE1hcCA9IG1hdGNoZXIuX2F0dHJWYWx1ZVBhcnRpYWxNYXA7XG4gICAgICAgICAgbGV0IHBhcnRpYWxWYWx1ZXNNYXAgPSBwYXJ0aWFsTWFwLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAoIXBhcnRpYWxWYWx1ZXNNYXApIHtcbiAgICAgICAgICAgIHBhcnRpYWxWYWx1ZXNNYXAgPSBuZXcgTWFwPHN0cmluZywgU2VsZWN0b3JNYXRjaGVyPFQ+PigpO1xuICAgICAgICAgICAgcGFydGlhbE1hcC5zZXQobmFtZSwgcGFydGlhbFZhbHVlc01hcCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG1hdGNoZXIgPSB0aGlzLl9hZGRQYXJ0aWFsKHBhcnRpYWxWYWx1ZXNNYXAsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FkZFRlcm1pbmFsKFxuICAgICAgbWFwOiBNYXA8c3RyaW5nLCBTZWxlY3RvckNvbnRleHQ8VD5bXT4sIG5hbWU6IHN0cmluZywgc2VsZWN0YWJsZTogU2VsZWN0b3JDb250ZXh0PFQ+KSB7XG4gICAgbGV0IHRlcm1pbmFsTGlzdCA9IG1hcC5nZXQobmFtZSk7XG4gICAgaWYgKCF0ZXJtaW5hbExpc3QpIHtcbiAgICAgIHRlcm1pbmFsTGlzdCA9IFtdO1xuICAgICAgbWFwLnNldChuYW1lLCB0ZXJtaW5hbExpc3QpO1xuICAgIH1cbiAgICB0ZXJtaW5hbExpc3QucHVzaChzZWxlY3RhYmxlKTtcbiAgfVxuXG4gIHByaXZhdGUgX2FkZFBhcnRpYWwobWFwOiBNYXA8c3RyaW5nLCBTZWxlY3Rvck1hdGNoZXI8VD4+LCBuYW1lOiBzdHJpbmcpOiBTZWxlY3Rvck1hdGNoZXI8VD4ge1xuICAgIGxldCBtYXRjaGVyID0gbWFwLmdldChuYW1lKTtcbiAgICBpZiAoIW1hdGNoZXIpIHtcbiAgICAgIG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyPFQ+KCk7XG4gICAgICBtYXAuc2V0KG5hbWUsIG1hdGNoZXIpO1xuICAgIH1cbiAgICByZXR1cm4gbWF0Y2hlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIHRoZSBvYmplY3RzIHRoYXQgaGF2ZSBiZWVuIGFkZGVkIHZpYSBgYWRkU2VsZWN0YWJsZWBcbiAgICogd2hvc2UgY3NzIHNlbGVjdG9yIGlzIGNvbnRhaW5lZCBpbiB0aGUgZ2l2ZW4gY3NzIHNlbGVjdG9yLlxuICAgKiBAcGFyYW0gY3NzU2VsZWN0b3IgQSBjc3Mgc2VsZWN0b3JcbiAgICogQHBhcmFtIG1hdGNoZWRDYWxsYmFjayBUaGlzIGNhbGxiYWNrIHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlIG9iamVjdCBoYW5kZWQgaW50byBgYWRkU2VsZWN0YWJsZWBcbiAgICogQHJldHVybiBib29sZWFuIHRydWUgaWYgYSBtYXRjaCB3YXMgZm91bmRcbiAgICovXG4gIG1hdGNoKGNzc1NlbGVjdG9yOiBDc3NTZWxlY3RvciwgbWF0Y2hlZENhbGxiYWNrOiAoKGM6IENzc1NlbGVjdG9yLCBhOiBUKSA9PiB2b2lkKXxudWxsKTogYm9vbGVhbiB7XG4gICAgbGV0IHJlc3VsdCA9IGZhbHNlO1xuICAgIGNvbnN0IGVsZW1lbnQgPSBjc3NTZWxlY3Rvci5lbGVtZW50ITtcbiAgICBjb25zdCBjbGFzc05hbWVzID0gY3NzU2VsZWN0b3IuY2xhc3NOYW1lcztcbiAgICBjb25zdCBhdHRycyA9IGNzc1NlbGVjdG9yLmF0dHJzO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9saXN0Q29udGV4dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuX2xpc3RDb250ZXh0c1tpXS5hbHJlYWR5TWF0Y2hlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlc3VsdCA9IHRoaXMuX21hdGNoVGVybWluYWwodGhpcy5fZWxlbWVudE1hcCwgZWxlbWVudCwgY3NzU2VsZWN0b3IsIG1hdGNoZWRDYWxsYmFjaykgfHwgcmVzdWx0O1xuICAgIHJlc3VsdCA9IHRoaXMuX21hdGNoUGFydGlhbCh0aGlzLl9lbGVtZW50UGFydGlhbE1hcCwgZWxlbWVudCwgY3NzU2VsZWN0b3IsIG1hdGNoZWRDYWxsYmFjaykgfHxcbiAgICAgICAgcmVzdWx0O1xuXG4gICAgaWYgKGNsYXNzTmFtZXMpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2xhc3NOYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjbGFzc05hbWUgPSBjbGFzc05hbWVzW2ldO1xuICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgdGhpcy5fbWF0Y2hUZXJtaW5hbCh0aGlzLl9jbGFzc01hcCwgY2xhc3NOYW1lLCBjc3NTZWxlY3RvciwgbWF0Y2hlZENhbGxiYWNrKSB8fCByZXN1bHQ7XG4gICAgICAgIHJlc3VsdCA9XG4gICAgICAgICAgICB0aGlzLl9tYXRjaFBhcnRpYWwodGhpcy5fY2xhc3NQYXJ0aWFsTWFwLCBjbGFzc05hbWUsIGNzc1NlbGVjdG9yLCBtYXRjaGVkQ2FsbGJhY2spIHx8XG4gICAgICAgICAgICByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGF0dHJzKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBhdHRyc1tpXTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBhdHRyc1tpICsgMV07XG5cbiAgICAgICAgY29uc3QgdGVybWluYWxWYWx1ZXNNYXAgPSB0aGlzLl9hdHRyVmFsdWVNYXAuZ2V0KG5hbWUpITtcbiAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgICAgdGhpcy5fbWF0Y2hUZXJtaW5hbCh0ZXJtaW5hbFZhbHVlc01hcCwgJycsIGNzc1NlbGVjdG9yLCBtYXRjaGVkQ2FsbGJhY2spIHx8IHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgdGhpcy5fbWF0Y2hUZXJtaW5hbCh0ZXJtaW5hbFZhbHVlc01hcCwgdmFsdWUsIGNzc1NlbGVjdG9yLCBtYXRjaGVkQ2FsbGJhY2spIHx8IHJlc3VsdDtcblxuICAgICAgICBjb25zdCBwYXJ0aWFsVmFsdWVzTWFwID0gdGhpcy5fYXR0clZhbHVlUGFydGlhbE1hcC5nZXQobmFtZSkhO1xuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICByZXN1bHQgPSB0aGlzLl9tYXRjaFBhcnRpYWwocGFydGlhbFZhbHVlc01hcCwgJycsIGNzc1NlbGVjdG9yLCBtYXRjaGVkQ2FsbGJhY2spIHx8IHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgdGhpcy5fbWF0Y2hQYXJ0aWFsKHBhcnRpYWxWYWx1ZXNNYXAsIHZhbHVlLCBjc3NTZWxlY3RvciwgbWF0Y2hlZENhbGxiYWNrKSB8fCByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9tYXRjaFRlcm1pbmFsKFxuICAgICAgbWFwOiBNYXA8c3RyaW5nLCBTZWxlY3RvckNvbnRleHQ8VD5bXT4sIG5hbWU6IHN0cmluZywgY3NzU2VsZWN0b3I6IENzc1NlbGVjdG9yLFxuICAgICAgbWF0Y2hlZENhbGxiYWNrOiAoKGM6IENzc1NlbGVjdG9yLCBhOiBhbnkpID0+IHZvaWQpfG51bGwpOiBib29sZWFuIHtcbiAgICBpZiAoIW1hcCB8fCB0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsZXQgc2VsZWN0YWJsZXM6IFNlbGVjdG9yQ29udGV4dDxUPltdID0gbWFwLmdldChuYW1lKSB8fCBbXTtcbiAgICBjb25zdCBzdGFyU2VsZWN0YWJsZXM6IFNlbGVjdG9yQ29udGV4dDxUPltdID0gbWFwLmdldCgnKicpITtcbiAgICBpZiAoc3RhclNlbGVjdGFibGVzKSB7XG4gICAgICBzZWxlY3RhYmxlcyA9IHNlbGVjdGFibGVzLmNvbmNhdChzdGFyU2VsZWN0YWJsZXMpO1xuICAgIH1cbiAgICBpZiAoc2VsZWN0YWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGxldCBzZWxlY3RhYmxlOiBTZWxlY3RvckNvbnRleHQ8VD47XG4gICAgbGV0IHJlc3VsdCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZWN0YWJsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNlbGVjdGFibGUgPSBzZWxlY3RhYmxlc1tpXTtcbiAgICAgIHJlc3VsdCA9IHNlbGVjdGFibGUuZmluYWxpemUoY3NzU2VsZWN0b3IsIG1hdGNoZWRDYWxsYmFjaykgfHwgcmVzdWx0O1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbWF0Y2hQYXJ0aWFsKFxuICAgICAgbWFwOiBNYXA8c3RyaW5nLCBTZWxlY3Rvck1hdGNoZXI8VD4+LCBuYW1lOiBzdHJpbmcsIGNzc1NlbGVjdG9yOiBDc3NTZWxlY3RvcixcbiAgICAgIG1hdGNoZWRDYWxsYmFjazogKChjOiBDc3NTZWxlY3RvciwgYTogYW55KSA9PiB2b2lkKXxudWxsKTogYm9vbGVhbiB7XG4gICAgaWYgKCFtYXAgfHwgdHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgbmVzdGVkU2VsZWN0b3IgPSBtYXAuZ2V0KG5hbWUpO1xuICAgIGlmICghbmVzdGVkU2VsZWN0b3IpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gVE9ETyhwZXJmKTogZ2V0IHJpZCBvZiByZWN1cnNpb24gYW5kIG1lYXN1cmUgYWdhaW5cbiAgICAvLyBUT0RPKHBlcmYpOiBkb24ndCBwYXNzIHRoZSB3aG9sZSBzZWxlY3RvciBpbnRvIHRoZSByZWN1cnNpb24sXG4gICAgLy8gYnV0IG9ubHkgdGhlIG5vdCBwcm9jZXNzZWQgcGFydHNcbiAgICByZXR1cm4gbmVzdGVkU2VsZWN0b3IubWF0Y2goY3NzU2VsZWN0b3IsIG1hdGNoZWRDYWxsYmFjayk7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgU2VsZWN0b3JMaXN0Q29udGV4dCB7XG4gIGFscmVhZHlNYXRjaGVkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHVibGljIHNlbGVjdG9yczogQ3NzU2VsZWN0b3JbXSkge31cbn1cblxuLy8gU3RvcmUgY29udGV4dCB0byBwYXNzIGJhY2sgc2VsZWN0b3IgYW5kIGNvbnRleHQgd2hlbiBhIHNlbGVjdG9yIGlzIG1hdGNoZWRcbmV4cG9ydCBjbGFzcyBTZWxlY3RvckNvbnRleHQ8VCA9IGFueT4ge1xuICBub3RTZWxlY3RvcnM6IENzc1NlbGVjdG9yW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc2VsZWN0b3I6IENzc1NlbGVjdG9yLCBwdWJsaWMgY2JDb250ZXh0OiBULCBwdWJsaWMgbGlzdENvbnRleHQ6IFNlbGVjdG9yTGlzdENvbnRleHQpIHtcbiAgICB0aGlzLm5vdFNlbGVjdG9ycyA9IHNlbGVjdG9yLm5vdFNlbGVjdG9ycztcbiAgfVxuXG4gIGZpbmFsaXplKGNzc1NlbGVjdG9yOiBDc3NTZWxlY3RvciwgY2FsbGJhY2s6ICgoYzogQ3NzU2VsZWN0b3IsIGE6IFQpID0+IHZvaWQpfG51bGwpOiBib29sZWFuIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5ub3RTZWxlY3RvcnMubGVuZ3RoID4gMCAmJiAoIXRoaXMubGlzdENvbnRleHQgfHwgIXRoaXMubGlzdENvbnRleHQuYWxyZWFkeU1hdGNoZWQpKSB7XG4gICAgICBjb25zdCBub3RNYXRjaGVyID0gU2VsZWN0b3JNYXRjaGVyLmNyZWF0ZU5vdE1hdGNoZXIodGhpcy5ub3RTZWxlY3RvcnMpO1xuICAgICAgcmVzdWx0ID0gIW5vdE1hdGNoZXIubWF0Y2goY3NzU2VsZWN0b3IsIG51bGwpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0ICYmIGNhbGxiYWNrICYmICghdGhpcy5saXN0Q29udGV4dCB8fCAhdGhpcy5saXN0Q29udGV4dC5hbHJlYWR5TWF0Y2hlZCkpIHtcbiAgICAgIGlmICh0aGlzLmxpc3RDb250ZXh0KSB7XG4gICAgICAgIHRoaXMubGlzdENvbnRleHQuYWxyZWFkeU1hdGNoZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2sodGhpcy5zZWxlY3RvciwgdGhpcy5jYkNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG4iXX0=