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
var /** @type {?} */ _SELECTOR_REGEXP = new RegExp('(\\:not\\()|' + //":not("
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
var /**
 * A css selector contains an element name,
 * css classes and attribute/value pairs with the purpose
 * of selecting subsets out of them.
 */
CssSelector = /** @class */ (function () {
    function CssSelector() {
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
    CssSelector.parse = /**
     * @param {?} selector
     * @return {?}
     */
    function (selector) {
        var /** @type {?} */ results = [];
        var /** @type {?} */ _addResult = function (res, cssSel) {
            if (cssSel.notSelectors.length > 0 && !cssSel.element && cssSel.classNames.length == 0 &&
                cssSel.attrs.length == 0) {
                cssSel.element = '*';
            }
            res.push(cssSel);
        };
        var /** @type {?} */ cssSelector = new CssSelector();
        var /** @type {?} */ match;
        var /** @type {?} */ current = cssSelector;
        var /** @type {?} */ inNot = false;
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
    };
    /**
     * @return {?}
     */
    CssSelector.prototype.isElementSelector = /**
     * @return {?}
     */
    function () {
        return this.hasElementSelector() && this.classNames.length == 0 && this.attrs.length == 0 &&
            this.notSelectors.length === 0;
    };
    /**
     * @return {?}
     */
    CssSelector.prototype.hasElementSelector = /**
     * @return {?}
     */
    function () { return !!this.element; };
    /**
     * @param {?=} element
     * @return {?}
     */
    CssSelector.prototype.setElement = /**
     * @param {?=} element
     * @return {?}
     */
    function (element) {
        if (element === void 0) { element = null; }
        this.element = element;
    };
    /** Gets a template string for an element that matches the selector. */
    /**
     * Gets a template string for an element that matches the selector.
     * @return {?}
     */
    CssSelector.prototype.getMatchingElementTemplate = /**
     * Gets a template string for an element that matches the selector.
     * @return {?}
     */
    function () {
        var /** @type {?} */ tagName = this.element || 'div';
        var /** @type {?} */ classAttr = this.classNames.length > 0 ? " class=\"" + this.classNames.join(' ') + "\"" : '';
        var /** @type {?} */ attrs = '';
        for (var /** @type {?} */ i = 0; i < this.attrs.length; i += 2) {
            var /** @type {?} */ attrName = this.attrs[i];
            var /** @type {?} */ attrValue = this.attrs[i + 1] !== '' ? "=\"" + this.attrs[i + 1] + "\"" : '';
            attrs += " " + attrName + attrValue;
        }
        return getHtmlTagDefinition(tagName).isVoid ? "<" + tagName + classAttr + attrs + "/>" :
            "<" + tagName + classAttr + attrs + "></" + tagName + ">";
    };
    /**
     * @return {?}
     */
    CssSelector.prototype.getAttrs = /**
     * @return {?}
     */
    function () {
        var /** @type {?} */ result = [];
        if (this.classNames.length > 0) {
            result.push('class', this.classNames.join(' '));
        }
        return result.concat(this.attrs);
    };
    /**
     * @param {?} name
     * @param {?=} value
     * @return {?}
     */
    CssSelector.prototype.addAttribute = /**
     * @param {?} name
     * @param {?=} value
     * @return {?}
     */
    function (name, value) {
        if (value === void 0) { value = ''; }
        this.attrs.push(name, value && value.toLowerCase() || '');
    };
    /**
     * @param {?} name
     * @return {?}
     */
    CssSelector.prototype.addClassName = /**
     * @param {?} name
     * @return {?}
     */
    function (name) { this.classNames.push(name.toLowerCase()); };
    /**
     * @return {?}
     */
    CssSelector.prototype.toString = /**
     * @return {?}
     */
    function () {
        var /** @type {?} */ res = this.element || '';
        if (this.classNames) {
            this.classNames.forEach(function (klass) { return res += "." + klass; });
        }
        if (this.attrs) {
            for (var /** @type {?} */ i = 0; i < this.attrs.length; i += 2) {
                var /** @type {?} */ name_1 = this.attrs[i];
                var /** @type {?} */ value = this.attrs[i + 1];
                res += "[" + name_1 + (value ? '=' + value : '') + "]";
            }
        }
        this.notSelectors.forEach(function (notSelector) { return res += ":not(" + notSelector + ")"; });
        return res;
    };
    return CssSelector;
}());
/**
 * A css selector contains an element name,
 * css classes and attribute/value pairs with the purpose
 * of selecting subsets out of them.
 */
export { CssSelector };
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
var /**
 * Reads a list of CssSelectors and allows to calculate which ones
 * are contained in a given CssSelector.
 */
SelectorMatcher = /** @class */ (function () {
    function SelectorMatcher() {
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
    SelectorMatcher.createNotMatcher = /**
     * @param {?} notSelectors
     * @return {?}
     */
    function (notSelectors) {
        var /** @type {?} */ notMatcher = new SelectorMatcher();
        notMatcher.addSelectables(notSelectors, null);
        return notMatcher;
    };
    /**
     * @param {?} cssSelectors
     * @param {?=} callbackCtxt
     * @return {?}
     */
    SelectorMatcher.prototype.addSelectables = /**
     * @param {?} cssSelectors
     * @param {?=} callbackCtxt
     * @return {?}
     */
    function (cssSelectors, callbackCtxt) {
        var /** @type {?} */ listContext = /** @type {?} */ ((null));
        if (cssSelectors.length > 1) {
            listContext = new SelectorListContext(cssSelectors);
            this._listContexts.push(listContext);
        }
        for (var /** @type {?} */ i = 0; i < cssSelectors.length; i++) {
            this._addSelectable(cssSelectors[i], callbackCtxt, listContext);
        }
    };
    /**
     * Add an object that can be found later on by calling `match`.
     * @param {?} cssSelector A css selector
     * @param {?} callbackCtxt An opaque object that will be given to the callback of the `match` function
     * @param {?} listContext
     * @return {?}
     */
    SelectorMatcher.prototype._addSelectable = /**
     * Add an object that can be found later on by calling `match`.
     * @param {?} cssSelector A css selector
     * @param {?} callbackCtxt An opaque object that will be given to the callback of the `match` function
     * @param {?} listContext
     * @return {?}
     */
    function (cssSelector, callbackCtxt, listContext) {
        var /** @type {?} */ matcher = this;
        var /** @type {?} */ element = cssSelector.element;
        var /** @type {?} */ classNames = cssSelector.classNames;
        var /** @type {?} */ attrs = cssSelector.attrs;
        var /** @type {?} */ selectable = new SelectorContext(cssSelector, callbackCtxt, listContext);
        if (element) {
            var /** @type {?} */ isTerminal = attrs.length === 0 && classNames.length === 0;
            if (isTerminal) {
                this._addTerminal(matcher._elementMap, element, selectable);
            }
            else {
                matcher = this._addPartial(matcher._elementPartialMap, element);
            }
        }
        if (classNames) {
            for (var /** @type {?} */ i = 0; i < classNames.length; i++) {
                var /** @type {?} */ isTerminal = attrs.length === 0 && i === classNames.length - 1;
                var /** @type {?} */ className = classNames[i];
                if (isTerminal) {
                    this._addTerminal(matcher._classMap, className, selectable);
                }
                else {
                    matcher = this._addPartial(matcher._classPartialMap, className);
                }
            }
        }
        if (attrs) {
            for (var /** @type {?} */ i = 0; i < attrs.length; i += 2) {
                var /** @type {?} */ isTerminal = i === attrs.length - 2;
                var /** @type {?} */ name_2 = attrs[i];
                var /** @type {?} */ value = attrs[i + 1];
                if (isTerminal) {
                    var /** @type {?} */ terminalMap = matcher._attrValueMap;
                    var /** @type {?} */ terminalValuesMap = terminalMap.get(name_2);
                    if (!terminalValuesMap) {
                        terminalValuesMap = new Map();
                        terminalMap.set(name_2, terminalValuesMap);
                    }
                    this._addTerminal(terminalValuesMap, value, selectable);
                }
                else {
                    var /** @type {?} */ partialMap = matcher._attrValuePartialMap;
                    var /** @type {?} */ partialValuesMap = partialMap.get(name_2);
                    if (!partialValuesMap) {
                        partialValuesMap = new Map();
                        partialMap.set(name_2, partialValuesMap);
                    }
                    matcher = this._addPartial(partialValuesMap, value);
                }
            }
        }
    };
    /**
     * @param {?} map
     * @param {?} name
     * @param {?} selectable
     * @return {?}
     */
    SelectorMatcher.prototype._addTerminal = /**
     * @param {?} map
     * @param {?} name
     * @param {?} selectable
     * @return {?}
     */
    function (map, name, selectable) {
        var /** @type {?} */ terminalList = map.get(name);
        if (!terminalList) {
            terminalList = [];
            map.set(name, terminalList);
        }
        terminalList.push(selectable);
    };
    /**
     * @param {?} map
     * @param {?} name
     * @return {?}
     */
    SelectorMatcher.prototype._addPartial = /**
     * @param {?} map
     * @param {?} name
     * @return {?}
     */
    function (map, name) {
        var /** @type {?} */ matcher = map.get(name);
        if (!matcher) {
            matcher = new SelectorMatcher();
            map.set(name, matcher);
        }
        return matcher;
    };
    /**
     * Find the objects that have been added via `addSelectable`
     * whose css selector is contained in the given css selector.
     * @param cssSelector A css selector
     * @param matchedCallback This callback will be called with the object handed into `addSelectable`
     * @return boolean true if a match was found
    */
    /**
     * Find the objects that have been added via `addSelectable`
     * whose css selector is contained in the given css selector.
     * @param {?} cssSelector A css selector
     * @param {?} matchedCallback This callback will be called with the object handed into `addSelectable`
     * @return {?} boolean true if a match was found
     */
    SelectorMatcher.prototype.match = /**
     * Find the objects that have been added via `addSelectable`
     * whose css selector is contained in the given css selector.
     * @param {?} cssSelector A css selector
     * @param {?} matchedCallback This callback will be called with the object handed into `addSelectable`
     * @return {?} boolean true if a match was found
     */
    function (cssSelector, matchedCallback) {
        var /** @type {?} */ result = false;
        var /** @type {?} */ element = /** @type {?} */ ((cssSelector.element));
        var /** @type {?} */ classNames = cssSelector.classNames;
        var /** @type {?} */ attrs = cssSelector.attrs;
        for (var /** @type {?} */ i = 0; i < this._listContexts.length; i++) {
            this._listContexts[i].alreadyMatched = false;
        }
        result = this._matchTerminal(this._elementMap, element, cssSelector, matchedCallback) || result;
        result = this._matchPartial(this._elementPartialMap, element, cssSelector, matchedCallback) ||
            result;
        if (classNames) {
            for (var /** @type {?} */ i = 0; i < classNames.length; i++) {
                var /** @type {?} */ className = classNames[i];
                result =
                    this._matchTerminal(this._classMap, className, cssSelector, matchedCallback) || result;
                result =
                    this._matchPartial(this._classPartialMap, className, cssSelector, matchedCallback) ||
                        result;
            }
        }
        if (attrs) {
            for (var /** @type {?} */ i = 0; i < attrs.length; i += 2) {
                var /** @type {?} */ name_3 = attrs[i];
                var /** @type {?} */ value = attrs[i + 1];
                var /** @type {?} */ terminalValuesMap = /** @type {?} */ ((this._attrValueMap.get(name_3)));
                if (value) {
                    result =
                        this._matchTerminal(terminalValuesMap, '', cssSelector, matchedCallback) || result;
                }
                result =
                    this._matchTerminal(terminalValuesMap, value, cssSelector, matchedCallback) || result;
                var /** @type {?} */ partialValuesMap = /** @type {?} */ ((this._attrValuePartialMap.get(name_3)));
                if (value) {
                    result = this._matchPartial(partialValuesMap, '', cssSelector, matchedCallback) || result;
                }
                result =
                    this._matchPartial(partialValuesMap, value, cssSelector, matchedCallback) || result;
            }
        }
        return result;
    };
    /** @internal */
    /**
     * \@internal
     * @param {?} map
     * @param {?} name
     * @param {?} cssSelector
     * @param {?} matchedCallback
     * @return {?}
     */
    SelectorMatcher.prototype._matchTerminal = /**
     * \@internal
     * @param {?} map
     * @param {?} name
     * @param {?} cssSelector
     * @param {?} matchedCallback
     * @return {?}
     */
    function (map, name, cssSelector, matchedCallback) {
        if (!map || typeof name !== 'string') {
            return false;
        }
        var /** @type {?} */ selectables = map.get(name) || [];
        var /** @type {?} */ starSelectables = /** @type {?} */ ((map.get('*')));
        if (starSelectables) {
            selectables = selectables.concat(starSelectables);
        }
        if (selectables.length === 0) {
            return false;
        }
        var /** @type {?} */ selectable;
        var /** @type {?} */ result = false;
        for (var /** @type {?} */ i = 0; i < selectables.length; i++) {
            selectable = selectables[i];
            result = selectable.finalize(cssSelector, matchedCallback) || result;
        }
        return result;
    };
    /** @internal */
    /**
     * \@internal
     * @param {?} map
     * @param {?} name
     * @param {?} cssSelector
     * @param {?} matchedCallback
     * @return {?}
     */
    SelectorMatcher.prototype._matchPartial = /**
     * \@internal
     * @param {?} map
     * @param {?} name
     * @param {?} cssSelector
     * @param {?} matchedCallback
     * @return {?}
     */
    function (map, name, cssSelector, matchedCallback) {
        if (!map || typeof name !== 'string') {
            return false;
        }
        var /** @type {?} */ nestedSelector = map.get(name);
        if (!nestedSelector) {
            return false;
        }
        // TODO(perf): get rid of recursion and measure again
        // TODO(perf): don't pass the whole selector into the recursion,
        // but only the not processed parts
        return nestedSelector.match(cssSelector, matchedCallback);
    };
    return SelectorMatcher;
}());
/**
 * Reads a list of CssSelectors and allows to calculate which ones
 * are contained in a given CssSelector.
 */
export { SelectorMatcher };
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
var SelectorListContext = /** @class */ (function () {
    function SelectorListContext(selectors) {
        this.selectors = selectors;
        this.alreadyMatched = false;
    }
    return SelectorListContext;
}());
export { SelectorListContext };
function SelectorListContext_tsickle_Closure_declarations() {
    /** @type {?} */
    SelectorListContext.prototype.alreadyMatched;
    /** @type {?} */
    SelectorListContext.prototype.selectors;
}
var SelectorContext = /** @class */ (function () {
    function SelectorContext(selector, cbContext, listContext) {
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
    SelectorContext.prototype.finalize = /**
     * @param {?} cssSelector
     * @param {?} callback
     * @return {?}
     */
    function (cssSelector, callback) {
        var /** @type {?} */ result = true;
        if (this.notSelectors.length > 0 && (!this.listContext || !this.listContext.alreadyMatched)) {
            var /** @type {?} */ notMatcher = SelectorMatcher.createNotMatcher(this.notSelectors);
            result = !notMatcher.match(cssSelector, null);
        }
        if (result && callback && (!this.listContext || !this.listContext.alreadyMatched)) {
            if (this.listContext) {
                this.listContext.alreadyMatched = true;
            }
            callback(this.selector, this.cbContext);
        }
        return result;
    };
    return SelectorContext;
}());
export { SelectorContext };
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