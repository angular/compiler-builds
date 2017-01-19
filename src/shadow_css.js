export class ShadowCss {
    constructor() {
        this.strictStyling = true;
    }
    /**
     * @param {?} cssText
     * @param {?} selector
     * @param {?=} hostSelector
     * @return {?}
     */
    shimCssText(cssText, selector, hostSelector = '') {
        const /** @type {?} */ sourceMappingUrl = extractSourceMappingUrl(cssText);
        cssText = stripComments(cssText);
        cssText = this._insertDirectives(cssText);
        return this._scopeCssText(cssText, selector, hostSelector) + sourceMappingUrl;
    }
    /**
     * @param {?} cssText
     * @return {?}
     */
    _insertDirectives(cssText) {
        cssText = this._insertPolyfillDirectivesInCssText(cssText);
        return this._insertPolyfillRulesInCssText(cssText);
    }
    /**
     * @param {?} cssText
     * @return {?}
     */
    _insertPolyfillDirectivesInCssText(cssText) {
        // Difference with webcomponents.js: does not handle comments
        return cssText.replace(_cssContentNextSelectorRe, function (...m) { return m[2] + '{'; });
    }
    /**
     * @param {?} cssText
     * @return {?}
     */
    _insertPolyfillRulesInCssText(cssText) {
        // Difference with webcomponents.js: does not handle comments
        return cssText.replace(_cssContentRuleRe, (...m) => {
            const /** @type {?} */ rule = m[0].replace(m[1], '').replace(m[2], '');
            return m[4] + rule;
        });
    }
    /**
     * @param {?} cssText
     * @param {?} scopeSelector
     * @param {?} hostSelector
     * @return {?}
     */
    _scopeCssText(cssText, scopeSelector, hostSelector) {
        const /** @type {?} */ unscopedRules = this._extractUnscopedRulesFromCssText(cssText);
        // replace :host and :host-context -shadowcsshost and -shadowcsshost respectively
        cssText = this._insertPolyfillHostInCssText(cssText);
        cssText = this._convertColonHost(cssText);
        cssText = this._convertColonHostContext(cssText);
        cssText = this._convertShadowDOMSelectors(cssText);
        if (scopeSelector) {
            cssText = this._scopeSelectors(cssText, scopeSelector, hostSelector);
        }
        cssText = cssText + '\n' + unscopedRules;
        return cssText.trim();
    }
    /**
     * @param {?} cssText
     * @return {?}
     */
    _extractUnscopedRulesFromCssText(cssText) {
        // Difference with webcomponents.js: does not handle comments
        let /** @type {?} */ r = '';
        let /** @type {?} */ m;
        _cssContentUnscopedRuleRe.lastIndex = 0;
        while ((m = _cssContentUnscopedRuleRe.exec(cssText)) !== null) {
            const /** @type {?} */ rule = m[0].replace(m[2], '').replace(m[1], m[4]);
            r += rule + '\n\n';
        }
        return r;
    }
    /**
     * @param {?} cssText
     * @return {?}
     */
    _convertColonHost(cssText) {
        return this._convertColonRule(cssText, _cssColonHostRe, this._colonHostPartReplacer);
    }
    /**
     * @param {?} cssText
     * @return {?}
     */
    _convertColonHostContext(cssText) {
        return this._convertColonRule(cssText, _cssColonHostContextRe, this._colonHostContextPartReplacer);
    }
    /**
     * @param {?} cssText
     * @param {?} regExp
     * @param {?} partReplacer
     * @return {?}
     */
    _convertColonRule(cssText, regExp, partReplacer) {
        // m[1] = :host(-context), m[2] = contents of (), m[3] rest of rule
        return cssText.replace(regExp, function (...m) {
            if (m[2]) {
                const /** @type {?} */ parts = m[2].split(',');
                const /** @type {?} */ r = [];
                for (let /** @type {?} */ i = 0; i < parts.length; i++) {
                    const /** @type {?} */ p = parts[i].trim();
                    if (!p)
                        break;
                    r.push(partReplacer(_polyfillHostNoCombinator, p, m[3]));
                }
                return r.join(',');
            }
            else {
                return _polyfillHostNoCombinator + m[3];
            }
        });
    }
    /**
     * @param {?} host
     * @param {?} part
     * @param {?} suffix
     * @return {?}
     */
    _colonHostContextPartReplacer(host, part, suffix) {
        if (part.indexOf(_polyfillHost) > -1) {
            return this._colonHostPartReplacer(host, part, suffix);
        }
        else {
            return host + part + suffix + ', ' + part + ' ' + host + suffix;
        }
    }
    /**
     * @param {?} host
     * @param {?} part
     * @param {?} suffix
     * @return {?}
     */
    _colonHostPartReplacer(host, part, suffix) {
        return host + part.replace(_polyfillHost, '') + suffix;
    }
    /**
     * @param {?} cssText
     * @return {?}
     */
    _convertShadowDOMSelectors(cssText) {
        return _shadowDOMSelectorsRe.reduce((result, pattern) => result.replace(pattern, ' '), cssText);
    }
    /**
     * @param {?} cssText
     * @param {?} scopeSelector
     * @param {?} hostSelector
     * @return {?}
     */
    _scopeSelectors(cssText, scopeSelector, hostSelector) {
        return processRules(cssText, (rule) => {
            let /** @type {?} */ selector = rule.selector;
            let /** @type {?} */ content = rule.content;
            if (rule.selector[0] != '@') {
                selector =
                    this._scopeSelector(rule.selector, scopeSelector, hostSelector, this.strictStyling);
            }
            else if (rule.selector.startsWith('@media') || rule.selector.startsWith('@supports') ||
                rule.selector.startsWith('@page') || rule.selector.startsWith('@document')) {
                content = this._scopeSelectors(rule.content, scopeSelector, hostSelector);
            }
            return new CssRule(selector, content);
        });
    }
    /**
     * @param {?} selector
     * @param {?} scopeSelector
     * @param {?} hostSelector
     * @param {?} strict
     * @return {?}
     */
    _scopeSelector(selector, scopeSelector, hostSelector, strict) {
        return selector.split(',')
            .map(part => part.trim().split(_shadowDeepSelectors))
            .map((deepParts) => {
            const [shallowPart, ...otherParts] = deepParts;
            const /** @type {?} */ applyScope = (shallowPart) => {
                if (this._selectorNeedsScoping(shallowPart, scopeSelector)) {
                    return strict ?
                        this._applyStrictSelectorScope(shallowPart, scopeSelector, hostSelector) :
                        this._applySelectorScope(shallowPart, scopeSelector, hostSelector);
                }
                else {
                    return shallowPart;
                }
            };
            return [applyScope(shallowPart), ...otherParts].join(' ');
        })
            .join(', ');
    }
    /**
     * @param {?} selector
     * @param {?} scopeSelector
     * @return {?}
     */
    _selectorNeedsScoping(selector, scopeSelector) {
        const /** @type {?} */ re = this._makeScopeMatcher(scopeSelector);
        return !re.test(selector);
    }
    /**
     * @param {?} scopeSelector
     * @return {?}
     */
    _makeScopeMatcher(scopeSelector) {
        const /** @type {?} */ lre = /\[/g;
        const /** @type {?} */ rre = /\]/g;
        scopeSelector = scopeSelector.replace(lre, '\\[').replace(rre, '\\]');
        return new RegExp('^(' + scopeSelector + ')' + _selectorReSuffix, 'm');
    }
    /**
     * @param {?} selector
     * @param {?} scopeSelector
     * @param {?} hostSelector
     * @return {?}
     */
    _applySelectorScope(selector, scopeSelector, hostSelector) {
        // Difference from webcomponents.js: scopeSelector could not be an array
        return this._applySimpleSelectorScope(selector, scopeSelector, hostSelector);
    }
    /**
     * @param {?} selector
     * @param {?} scopeSelector
     * @param {?} hostSelector
     * @return {?}
     */
    _applySimpleSelectorScope(selector, scopeSelector, hostSelector) {
        // In Android browser, the lastIndex is not reset when the regex is used in String.replace()
        _polyfillHostRe.lastIndex = 0;
        if (_polyfillHostRe.test(selector)) {
            const /** @type {?} */ replaceBy = this.strictStyling ? `[${hostSelector}]` : scopeSelector;
            return selector
                .replace(_polyfillHostNoCombinatorRe, (hnc, selector) => {
                return selector.replace(/([^:]*)(:*)(.*)/, (_, before, colon, after) => {
                    return before + replaceBy + colon + after;
                });
            })
                .replace(_polyfillHostRe, replaceBy + ' ');
        }
        return scopeSelector + ' ' + selector;
    }
    /**
     * @param {?} selector
     * @param {?} scopeSelector
     * @param {?} hostSelector
     * @return {?}
     */
    _applyStrictSelectorScope(selector, scopeSelector, hostSelector) {
        const /** @type {?} */ isRe = /\[is=([^\]]*)\]/g;
        scopeSelector = scopeSelector.replace(isRe, (_, ...parts) => parts[0]);
        const /** @type {?} */ attrName = '[' + scopeSelector + ']';
        const /** @type {?} */ _scopeSelectorPart = (p) => {
            let /** @type {?} */ scopedP = p.trim();
            if (!scopedP) {
                return '';
            }
            if (p.indexOf(_polyfillHostNoCombinator) > -1) {
                scopedP = this._applySimpleSelectorScope(p, scopeSelector, hostSelector);
            }
            else {
                // remove :host since it should be unnecessary
                const /** @type {?} */ t = p.replace(_polyfillHostRe, '');
                if (t.length > 0) {
                    const /** @type {?} */ matches = t.match(/([^:]*)(:*)(.*)/);
                    if (matches) {
                        scopedP = matches[1] + attrName + matches[2] + matches[3];
                    }
                }
            }
            return scopedP;
        };
        const /** @type {?} */ safeContent = new SafeSelector(selector);
        selector = safeContent.content();
        let /** @type {?} */ scopedSelector = '';
        let /** @type {?} */ startIndex = 0;
        let /** @type {?} */ res;
        const /** @type {?} */ sep = /( |>|\+|~(?!=))\s*/g;
        const /** @type {?} */ scopeAfter = selector.indexOf(_polyfillHostNoCombinator);
        while ((res = sep.exec(selector)) !== null) {
            const /** @type {?} */ separator = res[1];
            const /** @type {?} */ part = selector.slice(startIndex, res.index).trim();
            // if a selector appears before :host-context it should not be shimmed as it
            // matches on ancestor elements and not on elements in the host's shadow
            const /** @type {?} */ scopedPart = startIndex >= scopeAfter ? _scopeSelectorPart(part) : part;
            scopedSelector += `${scopedPart} ${separator} `;
            startIndex = sep.lastIndex;
        }
        scopedSelector += _scopeSelectorPart(selector.substring(startIndex));
        // replace the placeholders with their original values
        return safeContent.restore(scopedSelector);
    }
    /**
     * @param {?} selector
     * @return {?}
     */
    _insertPolyfillHostInCssText(selector) {
        return selector.replace(_colonHostContextRe, _polyfillHostContext)
            .replace(_colonHostRe, _polyfillHost);
    }
}
function ShadowCss_tsickle_Closure_declarations() {
    /** @type {?} */
    ShadowCss.prototype.strictStyling;
}
class SafeSelector {
    /**
     * @param {?} selector
     */
    constructor(selector) {
        this.placeholders = [];
        this.index = 0;
        // Replaces attribute selectors with placeholders.
        // The WS in [attr="va lue"] would otherwise be interpreted as a selector separator.
        selector = selector.replace(/(\[[^\]]*\])/g, (_, keep) => {
            const replaceBy = `__ph-${this.index}__`;
            this.placeholders.push(keep);
            this.index++;
            return replaceBy;
        });
        // Replaces the expression in `:nth-child(2n + 1)` with a placeholder.
        // WS and "+" would otherwise be interpreted as selector separators.
        this._content = selector.replace(/(:nth-[-\w]+)(\([^)]+\))/g, (_, pseudo, exp) => {
            const replaceBy = `__ph-${this.index}__`;
            this.placeholders.push(exp);
            this.index++;
            return pseudo + replaceBy;
        });
    }
    ;
    /**
     * @param {?} content
     * @return {?}
     */
    restore(content) {
        return content.replace(/__ph-(\d+)__/g, (ph, index) => this.placeholders[+index]);
    }
    /**
     * @return {?}
     */
    content() { return this._content; }
}
function SafeSelector_tsickle_Closure_declarations() {
    /** @type {?} */
    SafeSelector.prototype.placeholders;
    /** @type {?} */
    SafeSelector.prototype.index;
    /** @type {?} */
    SafeSelector.prototype._content;
}
const /** @type {?} */ _cssContentNextSelectorRe = /polyfill-next-selector[^}]*content:[\s]*?(['"])(.*?)\1[;\s]*}([^{]*?){/gim;
const /** @type {?} */ _cssContentRuleRe = /(polyfill-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const /** @type {?} */ _cssContentUnscopedRuleRe = /(polyfill-unscoped-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const /** @type {?} */ _polyfillHost = '-shadowcsshost';
// note: :host-context pre-processed to -shadowcsshostcontext.
const /** @type {?} */ _polyfillHostContext = '-shadowcsscontext';
const /** @type {?} */ _parenSuffix = ')(?:\\((' +
    '(?:\\([^)(]*\\)|[^)(]*)+?' +
    ')\\))?([^,{]*)';
const /** @type {?} */ _cssColonHostRe = new RegExp('(' + _polyfillHost + _parenSuffix, 'gim');
const /** @type {?} */ _cssColonHostContextRe = new RegExp('(' + _polyfillHostContext + _parenSuffix, 'gim');
const /** @type {?} */ _polyfillHostNoCombinator = _polyfillHost + '-no-combinator';
const /** @type {?} */ _polyfillHostNoCombinatorRe = /-shadowcsshost-no-combinator([^\s]*)/;
const /** @type {?} */ _shadowDOMSelectorsRe = [
    /::shadow/g,
    /::content/g,
    // Deprecated selectors
    /\/shadow-deep\//g,
    /\/shadow\//g,
];
const /** @type {?} */ _shadowDeepSelectors = /(?:>>>)|(?:\/deep\/)/g;
const /** @type {?} */ _selectorReSuffix = '([>\\s~+\[.,{:][\\s\\S]*)?$';
const /** @type {?} */ _polyfillHostRe = /-shadowcsshost/gim;
const /** @type {?} */ _colonHostRe = /:host/gim;
const /** @type {?} */ _colonHostContextRe = /:host-context/gim;
const /** @type {?} */ _commentRe = /\/\*\s*[\s\S]*?\*\//g;
/**
 * @param {?} input
 * @return {?}
 */
function stripComments(input) {
    return input.replace(_commentRe, '');
}
// all comments except inline source mapping
const /** @type {?} */ _sourceMappingUrlRe = /\/\*\s*#\s*sourceMappingURL=[\s\S]+?\*\//;
/**
 * @param {?} input
 * @return {?}
 */
function extractSourceMappingUrl(input) {
    const /** @type {?} */ matcher = input.match(_sourceMappingUrlRe);
    return matcher ? matcher[0] : '';
}
const /** @type {?} */ _ruleRe = /(\s*)([^;\{\}]+?)(\s*)((?:{%BLOCK%}?\s*;?)|(?:\s*;))/g;
const /** @type {?} */ _curlyRe = /([{}])/g;
const /** @type {?} */ OPEN_CURLY = '{';
const /** @type {?} */ CLOSE_CURLY = '}';
const /** @type {?} */ BLOCK_PLACEHOLDER = '%BLOCK%';
export class CssRule {
    /**
     * @param {?} selector
     * @param {?} content
     */
    constructor(selector, content) {
        this.selector = selector;
        this.content = content;
    }
}
function CssRule_tsickle_Closure_declarations() {
    /** @type {?} */
    CssRule.prototype.selector;
    /** @type {?} */
    CssRule.prototype.content;
}
/**
 * @param {?} input
 * @param {?} ruleCallback
 * @return {?}
 */
export function processRules(input, ruleCallback) {
    const /** @type {?} */ inputWithEscapedBlocks = escapeBlocks(input);
    let /** @type {?} */ nextBlockIndex = 0;
    return inputWithEscapedBlocks.escapedString.replace(_ruleRe, function (...m) {
        const /** @type {?} */ selector = m[2];
        let /** @type {?} */ content = '';
        let /** @type {?} */ suffix = m[4];
        let /** @type {?} */ contentPrefix = '';
        if (suffix && suffix.startsWith('{' + BLOCK_PLACEHOLDER)) {
            content = inputWithEscapedBlocks.blocks[nextBlockIndex++];
            suffix = suffix.substring(BLOCK_PLACEHOLDER.length + 1);
            contentPrefix = '{';
        }
        const /** @type {?} */ rule = ruleCallback(new CssRule(selector, content));
        return `${m[1]}${rule.selector}${m[3]}${contentPrefix}${rule.content}${suffix}`;
    });
}
class StringWithEscapedBlocks {
    /**
     * @param {?} escapedString
     * @param {?} blocks
     */
    constructor(escapedString, blocks) {
        this.escapedString = escapedString;
        this.blocks = blocks;
    }
}
function StringWithEscapedBlocks_tsickle_Closure_declarations() {
    /** @type {?} */
    StringWithEscapedBlocks.prototype.escapedString;
    /** @type {?} */
    StringWithEscapedBlocks.prototype.blocks;
}
/**
 * @param {?} input
 * @return {?}
 */
function escapeBlocks(input) {
    const /** @type {?} */ inputParts = input.split(_curlyRe);
    const /** @type {?} */ resultParts = [];
    const /** @type {?} */ escapedBlocks = [];
    let /** @type {?} */ bracketCount = 0;
    let /** @type {?} */ currentBlockParts = [];
    for (let /** @type {?} */ partIndex = 0; partIndex < inputParts.length; partIndex++) {
        const /** @type {?} */ part = inputParts[partIndex];
        if (part == CLOSE_CURLY) {
            bracketCount--;
        }
        if (bracketCount > 0) {
            currentBlockParts.push(part);
        }
        else {
            if (currentBlockParts.length > 0) {
                escapedBlocks.push(currentBlockParts.join(''));
                resultParts.push(BLOCK_PLACEHOLDER);
                currentBlockParts = [];
            }
            resultParts.push(part);
        }
        if (part == OPEN_CURLY) {
            bracketCount++;
        }
    }
    if (currentBlockParts.length > 0) {
        escapedBlocks.push(currentBlockParts.join(''));
        resultParts.push(BLOCK_PLACEHOLDER);
    }
    return new StringWithEscapedBlocks(resultParts.join(''), escapedBlocks);
}
//# sourceMappingURL=shadow_css.js.map