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
/**
 * This file is a port of shadowCSS from webcomponents.js to TypeScript.
 *
 * Please make sure to keep to edits in sync with the source file.
 *
 * Source:
 * https://github.com/webcomponents/webcomponentsjs/blob/4efecd7e0e/src/ShadowCSS/ShadowCSS.js
 *
 * The original file level comment is reproduced below
 */
/*
  This is a limited shim for ShadowDOM css styling.
  https://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#styles

  The intention here is to support only the styling features which can be
  relatively simply implemented. The goal is to allow users to avoid the
  most obvious pitfalls and do so without compromising performance significantly.
  For ShadowDOM styling that's not covered here, a set of best practices
  can be provided that should allow users to accomplish more complex styling.

  The following is a list of specific ShadowDOM styling features and a brief
  discussion of the approach used to shim.

  Shimmed features:

  * :host, :host-context: ShadowDOM allows styling of the shadowRoot's host
  element using the :host rule. To shim this feature, the :host styles are
  reformatted and prefixed with a given scope name and promoted to a
  document level stylesheet.
  For example, given a scope name of .foo, a rule like this:

    :host {
        background: red;
      }
    }

  becomes:

    .foo {
      background: red;
    }

  * encapsulation: Styles defined within ShadowDOM, apply only to
  dom inside the ShadowDOM. Polymer uses one of two techniques to implement
  this feature.

  By default, rules are prefixed with the host element tag name
  as a descendant selector. This ensures styling does not leak out of the 'top'
  of the element's ShadowDOM. For example,

  div {
      font-weight: bold;
    }

  becomes:

  x-foo div {
      font-weight: bold;
    }

  becomes:


  Alternatively, if WebComponents.ShadowCSS.strictStyling is set to true then
  selectors are scoped by adding an attribute selector suffix to each
  simple selector that contains the host element tag name. Each element
  in the element's ShadowDOM template is also given the scope attribute.
  Thus, these rules match only elements that have the scope attribute.
  For example, given a scope name of x-foo, a rule like this:

    div {
      font-weight: bold;
    }

  becomes:

    div[x-foo] {
      font-weight: bold;
    }

  Note that elements that are dynamically added to a scope must have the scope
  selector added to them manually.

  * upper/lower bound encapsulation: Styles which are defined outside a
  shadowRoot should not cross the ShadowDOM boundary and should not apply
  inside a shadowRoot.

  This styling behavior is not emulated. Some possible ways to do this that
  were rejected due to complexity and/or performance concerns include: (1) reset
  every possible property for every possible selector for a given scope name;
  (2) re-implement css in javascript.

  As an alternative, users should make sure to use selectors
  specific to the scope in which they are working.

  * ::distributed: This behavior is not emulated. It's often not necessary
  to style the contents of a specific insertion point and instead, descendants
  of the host element can be styled selectively. Users can also create an
  extra node around an insertion point and style that node's contents
  via descendent selectors. For example, with a shadowRoot like this:

    <style>
      ::content(div) {
        background: red;
      }
    </style>
    <content></content>

  could become:

    <style>
      / *@polyfill .content-container div * /
      ::content(div) {
        background: red;
      }
    </style>
    <div class="content-container">
      <content></content>
    </div>

  Note the use of @polyfill in the comment above a ShadowDOM specific style
  declaration. This is a directive to the styling shim to use the selector
  in comments in lieu of the next selector when running under polyfill.
*/
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
        const /** @type {?} */ commentsWithHash = extractCommentsWithHash(cssText);
        cssText = stripComments(cssText);
        cssText = this._insertDirectives(cssText);
        const /** @type {?} */ scopedCssText = this._scopeCssText(cssText, selector, hostSelector);
        return [scopedCssText, ...commentsWithHash].join('\n');
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
        // If a selector appears before :host it should not be shimmed as it
        // matches on ancestor elements and not on elements in the host's shadow
        // `:host-context(div)` is transformed to
        // `-shadowcsshost-no-combinatordiv, div -shadowcsshost-no-combinator`
        // the `div` is not part of the component in the 2nd selectors and should not be scoped.
        // Historically `component-tag:host` was matching the component so we also want to preserve
        // this behavior to avoid breaking legacy apps (it should not match).
        // The behavior should be:
        // - `tag:host` -> `tag[h]` (this is to avoid breaking legacy apps, should not match anything)
        // - `tag :host` -> `tag [h]` (`tag` is not scoped because it's considered part of a
        //   `:host-context(tag)`)
        const /** @type {?} */ hasHost = selector.indexOf(_polyfillHostNoCombinator) > -1;
        // Only scope parts after the first `-shadowcsshost-no-combinator` when it is present
        let /** @type {?} */ shouldScope = !hasHost;
        while ((res = sep.exec(selector)) !== null) {
            const /** @type {?} */ separator = res[1];
            const /** @type {?} */ part = selector.slice(startIndex, res.index).trim();
            shouldScope = shouldScope || part.indexOf(_polyfillHostNoCombinator) > -1;
            const /** @type {?} */ scopedPart = shouldScope ? _scopeSelectorPart(part) : part;
            scopedSelector += `${scopedPart} ${separator} `;
            startIndex = sep.lastIndex;
        }
        const /** @type {?} */ part = selector.substring(startIndex);
        shouldScope = shouldScope || part.indexOf(_polyfillHostNoCombinator) > -1;
        scopedSelector += shouldScope ? _scopeSelectorPart(part) : part;
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
            const /** @type {?} */ replaceBy = `__ph-${this.index}__`;
            this.placeholders.push(keep);
            this.index++;
            return replaceBy;
        });
        // Replaces the expression in `:nth-child(2n + 1)` with a placeholder.
        // WS and "+" would otherwise be interpreted as selector separators.
        this._content = selector.replace(/(:nth-[-\w]+)(\([^)]+\))/g, (_, pseudo, exp) => {
            const /** @type {?} */ replaceBy = `__ph-${this.index}__`;
            this.placeholders.push(exp);
            this.index++;
            return pseudo + replaceBy;
        });
    }
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
    /\/shadow-deep\//g,
    /\/shadow\//g,
];
// The deep combinator is deprecated in the CSS spec
// Support for `>>>`, `deep`, `::ng-deep` is then also deprecated and will be removed in the future.
// see https://github.com/angular/angular/pull/17677
const /** @type {?} */ _shadowDeepSelectors = /(?:>>>)|(?:\/deep\/)|(?:::ng-deep)/g;
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
const /** @type {?} */ _commentWithHashRe = /\/\*\s*#\s*source(Mapping)?URL=[\s\S]+?\*\//g;
/**
 * @param {?} input
 * @return {?}
 */
function extractCommentsWithHash(input) {
    return input.match(_commentWithHashRe) || [];
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