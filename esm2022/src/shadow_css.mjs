/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * The following set contains all keywords that can be used in the animation css shorthand
 * property and is used during the scoping of keyframes to make sure such keywords
 * are not modified.
 */
const animationKeywords = new Set([
    // global values
    'inherit', 'initial', 'revert', 'unset',
    // animation-direction
    'alternate', 'alternate-reverse', 'normal', 'reverse',
    // animation-fill-mode
    'backwards', 'both', 'forwards', 'none',
    // animation-play-state
    'paused', 'running',
    // animation-timing-function
    'ease', 'ease-in', 'ease-in-out', 'ease-out', 'linear', 'step-start', 'step-end',
    // `steps()` function
    'end', 'jump-both', 'jump-end', 'jump-none', 'jump-start', 'start'
]);
/**
 * The following array contains all of the CSS at-rule identifiers which are scoped.
 */
const scopedAtRuleIdentifiers = ['@media', '@supports', '@document', '@layer', '@container', '@scope', '@starting-style'];
/**
 * The following class has its origin from a port of shadowCSS from webcomponents.js to TypeScript.
 * It has since diverge in many ways to tailor Angular's needs.
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
  dom inside the ShadowDOM.
  The selectors are scoped by adding an attribute selector suffix to each
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
        /**
         * Regular expression used to extrapolate the possible keyframes from an
         * animation declaration (with possibly multiple animation definitions)
         *
         * The regular expression can be divided in three parts
         *  - (^|\s+)
         *    simply captures how many (if any) leading whitespaces are present
         *  - (?:(?:(['"])((?:\\\\|\\\2|(?!\2).)+)\2)|(-?[A-Za-z][\w\-]*))
         *    captures two different possible keyframes, ones which are quoted or ones which are valid css
         * idents (custom properties excluded)
         *  - (?=[,\s;]|$)
         *    simply matches the end of the possible keyframe, valid endings are: a comma, a space, a
         * semicolon or the end of the string
         */
        this._animationDeclarationKeyframesRe = /(^|\s+)(?:(?:(['"])((?:\\\\|\\\2|(?!\2).)+)\2)|(-?[A-Za-z][\w\-]*))(?=[,\s]|$)/g;
    }
    /*
     * Shim some cssText with the given selector. Returns cssText that can be included in the document
     *
     * The selector is the attribute added to all elements inside the host,
     * The hostSelector is the attribute added to the host itself.
     */
    shimCssText(cssText, selector, hostSelector = '') {
        // **NOTE**: Do not strip comments as this will cause component sourcemaps to break
        // due to shift in lines.
        // Collect comments and replace them with a placeholder, this is done to avoid complicating
        // the rule parsing RegExp and keep it safer.
        const comments = [];
        cssText = cssText.replace(_commentRe, (m) => {
            if (m.match(_commentWithHashRe)) {
                comments.push(m);
            }
            else {
                // Replace non hash comments with empty lines.
                // This is done so that we do not leak any sensitive data in comments.
                const newLinesMatches = m.match(_newLinesRe);
                comments.push((newLinesMatches?.join('') ?? '') + '\n');
            }
            return COMMENT_PLACEHOLDER;
        });
        cssText = this._insertDirectives(cssText);
        const scopedCssText = this._scopeCssText(cssText, selector, hostSelector);
        // Add back comments at the original position.
        let commentIdx = 0;
        return scopedCssText.replace(_commentWithHashPlaceHolderRe, () => comments[commentIdx++]);
    }
    _insertDirectives(cssText) {
        cssText = this._insertPolyfillDirectivesInCssText(cssText);
        return this._insertPolyfillRulesInCssText(cssText);
    }
    /**
     * Process styles to add scope to keyframes.
     *
     * Modify both the names of the keyframes defined in the component styles and also the css
     * animation rules using them.
     *
     * Animation rules using keyframes defined elsewhere are not modified to allow for globally
     * defined keyframes.
     *
     * For example, we convert this css:
     *
     * ```
     * .box {
     *   animation: box-animation 1s forwards;
     * }
     *
     * @keyframes box-animation {
     *   to {
     *     background-color: green;
     *   }
     * }
     * ```
     *
     * to this:
     *
     * ```
     * .box {
     *   animation: scopeName_box-animation 1s forwards;
     * }
     *
     * @keyframes scopeName_box-animation {
     *   to {
     *     background-color: green;
     *   }
     * }
     * ```
     *
     * @param cssText the component's css text that needs to be scoped.
     * @param scopeSelector the component's scope selector.
     *
     * @returns the scoped css text.
     */
    _scopeKeyframesRelatedCss(cssText, scopeSelector) {
        const unscopedKeyframesSet = new Set();
        const scopedKeyframesCssText = processRules(cssText, rule => this._scopeLocalKeyframeDeclarations(rule, scopeSelector, unscopedKeyframesSet));
        return processRules(scopedKeyframesCssText, rule => this._scopeAnimationRule(rule, scopeSelector, unscopedKeyframesSet));
    }
    /**
     * Scopes local keyframes names, returning the updated css rule and it also
     * adds the original keyframe name to a provided set to collect all keyframes names
     * so that it can later be used to scope the animation rules.
     *
     * For example, it takes a rule such as:
     *
     * ```
     * @keyframes box-animation {
     *   to {
     *     background-color: green;
     *   }
     * }
     * ```
     *
     * and returns:
     *
     * ```
     * @keyframes scopeName_box-animation {
     *   to {
     *     background-color: green;
     *   }
     * }
     * ```
     * and as a side effect it adds "box-animation" to the `unscopedKeyframesSet` set
     *
     * @param cssRule the css rule to process.
     * @param scopeSelector the component's scope selector.
     * @param unscopedKeyframesSet the set of unscoped keyframes names (which can be
     * modified as a side effect)
     *
     * @returns the css rule modified with the scoped keyframes name.
     */
    _scopeLocalKeyframeDeclarations(rule, scopeSelector, unscopedKeyframesSet) {
        return {
            ...rule,
            selector: rule.selector.replace(/(^@(?:-webkit-)?keyframes(?:\s+))(['"]?)(.+)\2(\s*)$/, (_, start, quote, keyframeName, endSpaces) => {
                unscopedKeyframesSet.add(unescapeQuotes(keyframeName, quote));
                return `${start}${quote}${scopeSelector}_${keyframeName}${quote}${endSpaces}`;
            }),
        };
    }
    /**
     * Function used to scope a keyframes name (obtained from an animation declaration)
     * using an existing set of unscopedKeyframes names to discern if the scoping needs to be
     * performed (keyframes names of keyframes not defined in the component's css need not to be
     * scoped).
     *
     * @param keyframe the keyframes name to check.
     * @param scopeSelector the component's scope selector.
     * @param unscopedKeyframesSet the set of unscoped keyframes names.
     *
     * @returns the scoped name of the keyframe, or the original name is the name need not to be
     * scoped.
     */
    _scopeAnimationKeyframe(keyframe, scopeSelector, unscopedKeyframesSet) {
        return keyframe.replace(/^(\s*)(['"]?)(.+?)\2(\s*)$/, (_, spaces1, quote, name, spaces2) => {
            name = `${unscopedKeyframesSet.has(unescapeQuotes(name, quote)) ? scopeSelector + '_' : ''}${name}`;
            return `${spaces1}${quote}${name}${quote}${spaces2}`;
        });
    }
    /**
     * Scope an animation rule so that the keyframes mentioned in such rule
     * are scoped if defined in the component's css and left untouched otherwise.
     *
     * It can scope values of both the 'animation' and 'animation-name' properties.
     *
     * @param rule css rule to scope.
     * @param scopeSelector the component's scope selector.
     * @param unscopedKeyframesSet the set of unscoped keyframes names.
     *
     * @returns the updated css rule.
     **/
    _scopeAnimationRule(rule, scopeSelector, unscopedKeyframesSet) {
        let content = rule.content.replace(/((?:^|\s+|;)(?:-webkit-)?animation(?:\s*):(?:\s*))([^;]+)/g, (_, start, animationDeclarations) => start +
            animationDeclarations.replace(this._animationDeclarationKeyframesRe, (original, leadingSpaces, quote = '', quotedName, nonQuotedName) => {
                if (quotedName) {
                    return `${leadingSpaces}${this._scopeAnimationKeyframe(`${quote}${quotedName}${quote}`, scopeSelector, unscopedKeyframesSet)}`;
                }
                else {
                    return animationKeywords.has(nonQuotedName) ?
                        original :
                        `${leadingSpaces}${this._scopeAnimationKeyframe(nonQuotedName, scopeSelector, unscopedKeyframesSet)}`;
                }
            }));
        content = content.replace(/((?:^|\s+|;)(?:-webkit-)?animation-name(?:\s*):(?:\s*))([^;]+)/g, (_match, start, commaSeparatedKeyframes) => `${start}${commaSeparatedKeyframes.split(',')
            .map((keyframe) => this._scopeAnimationKeyframe(keyframe, scopeSelector, unscopedKeyframesSet))
            .join(',')}`);
        return { ...rule, content };
    }
    /*
     * Process styles to convert native ShadowDOM rules that will trip
     * up the css parser; we rely on decorating the stylesheet with inert rules.
     *
     * For example, we convert this rule:
     *
     * polyfill-next-selector { content: ':host menu-item'; }
     * ::content menu-item {
     *
     * to this:
     *
     * scopeName menu-item {
     *
     **/
    _insertPolyfillDirectivesInCssText(cssText) {
        return cssText.replace(_cssContentNextSelectorRe, function (...m) {
            return m[2] + '{';
        });
    }
    /*
     * Process styles to add rules which will only apply under the polyfill
     *
     * For example, we convert this rule:
     *
     * polyfill-rule {
     *   content: ':host menu-item';
     * ...
     * }
     *
     * to this:
     *
     * scopeName menu-item {...}
     *
     **/
    _insertPolyfillRulesInCssText(cssText) {
        return cssText.replace(_cssContentRuleRe, (...m) => {
            const rule = m[0].replace(m[1], '').replace(m[2], '');
            return m[4] + rule;
        });
    }
    /* Ensure styles are scoped. Pseudo-scoping takes a rule like:
     *
     *  .foo {... }
     *
     *  and converts this to
     *
     *  scopeName .foo { ... }
     */
    _scopeCssText(cssText, scopeSelector, hostSelector) {
        const unscopedRules = this._extractUnscopedRulesFromCssText(cssText);
        // replace :host and :host-context -shadowcsshost and -shadowcsshost respectively
        cssText = this._insertPolyfillHostInCssText(cssText);
        cssText = this._convertColonHost(cssText);
        cssText = this._convertColonHostContext(cssText);
        cssText = this._convertShadowDOMSelectors(cssText);
        if (scopeSelector) {
            cssText = this._scopeKeyframesRelatedCss(cssText, scopeSelector);
            cssText = this._scopeSelectors(cssText, scopeSelector, hostSelector);
        }
        cssText = cssText + '\n' + unscopedRules;
        return cssText.trim();
    }
    /*
     * Process styles to add rules which will only apply under the polyfill
     * and do not process via CSSOM. (CSSOM is destructive to rules on rare
     * occasions, e.g. -webkit-calc on Safari.)
     * For example, we convert this rule:
     *
     * @polyfill-unscoped-rule {
     *   content: 'menu-item';
     * ... }
     *
     * to this:
     *
     * menu-item {...}
     *
     **/
    _extractUnscopedRulesFromCssText(cssText) {
        let r = '';
        let m;
        _cssContentUnscopedRuleRe.lastIndex = 0;
        while ((m = _cssContentUnscopedRuleRe.exec(cssText)) !== null) {
            const rule = m[0].replace(m[2], '').replace(m[1], m[4]);
            r += rule + '\n\n';
        }
        return r;
    }
    /*
     * convert a rule like :host(.foo) > .bar { }
     *
     * to
     *
     * .foo<scopeName> > .bar
     */
    _convertColonHost(cssText) {
        return cssText.replace(_cssColonHostRe, (_, hostSelectors, otherSelectors) => {
            if (hostSelectors) {
                const convertedSelectors = [];
                const hostSelectorArray = hostSelectors.split(',').map((p) => p.trim());
                for (const hostSelector of hostSelectorArray) {
                    if (!hostSelector)
                        break;
                    const convertedSelector = _polyfillHostNoCombinator + hostSelector.replace(_polyfillHost, '') + otherSelectors;
                    convertedSelectors.push(convertedSelector);
                }
                return convertedSelectors.join(',');
            }
            else {
                return _polyfillHostNoCombinator + otherSelectors;
            }
        });
    }
    /*
     * convert a rule like :host-context(.foo) > .bar { }
     *
     * to
     *
     * .foo<scopeName> > .bar, .foo <scopeName> > .bar { }
     *
     * and
     *
     * :host-context(.foo:host) .bar { ... }
     *
     * to
     *
     * .foo<scopeName> .bar { ... }
     */
    _convertColonHostContext(cssText) {
        return cssText.replace(_cssColonHostContextReGlobal, (selectorText) => {
            // We have captured a selector that contains a `:host-context` rule.
            // For backward compatibility `:host-context` may contain a comma separated list of selectors.
            // Each context selector group will contain a list of host-context selectors that must match
            // an ancestor of the host.
            // (Normally `contextSelectorGroups` will only contain a single array of context selectors.)
            const contextSelectorGroups = [[]];
            // There may be more than `:host-context` in this selector so `selectorText` could look like:
            // `:host-context(.one):host-context(.two)`.
            // Execute `_cssColonHostContextRe` over and over until we have extracted all the
            // `:host-context` selectors from this selector.
            let match;
            while ((match = _cssColonHostContextRe.exec(selectorText))) {
                // `match` = [':host-context(<selectors>)<rest>', <selectors>, <rest>]
                // The `<selectors>` could actually be a comma separated list: `:host-context(.one, .two)`.
                const newContextSelectors = (match[1] ?? '').trim().split(',').map((m) => m.trim()).filter((m) => m !== '');
                // We must duplicate the current selector group for each of these new selectors.
                // For example if the current groups are:
                // ```
                // [
                //   ['a', 'b', 'c'],
                //   ['x', 'y', 'z'],
                // ]
                // ```
                // And we have a new set of comma separated selectors: `:host-context(m,n)` then the new
                // groups are:
                // ```
                // [
                //   ['a', 'b', 'c', 'm'],
                //   ['x', 'y', 'z', 'm'],
                //   ['a', 'b', 'c', 'n'],
                //   ['x', 'y', 'z', 'n'],
                // ]
                // ```
                const contextSelectorGroupsLength = contextSelectorGroups.length;
                repeatGroups(contextSelectorGroups, newContextSelectors.length);
                for (let i = 0; i < newContextSelectors.length; i++) {
                    for (let j = 0; j < contextSelectorGroupsLength; j++) {
                        contextSelectorGroups[j + i * contextSelectorGroupsLength].push(newContextSelectors[i]);
                    }
                }
                // Update the `selectorText` and see repeat to see if there are more `:host-context`s.
                selectorText = match[2];
            }
            // The context selectors now must be combined with each other to capture all the possible
            // selectors that `:host-context` can match. See `combineHostContextSelectors()` for more
            // info about how this is done.
            return contextSelectorGroups
                .map((contextSelectors) => combineHostContextSelectors(contextSelectors, selectorText))
                .join(', ');
        });
    }
    /*
     * Convert combinators like ::shadow and pseudo-elements like ::content
     * by replacing with space.
     */
    _convertShadowDOMSelectors(cssText) {
        return _shadowDOMSelectorsRe.reduce((result, pattern) => result.replace(pattern, ' '), cssText);
    }
    // change a selector like 'div' to 'name div'
    _scopeSelectors(cssText, scopeSelector, hostSelector) {
        return processRules(cssText, (rule) => {
            let selector = rule.selector;
            let content = rule.content;
            if (rule.selector[0] !== '@') {
                selector = this._scopeSelector(rule.selector, scopeSelector, hostSelector);
            }
            else if (scopedAtRuleIdentifiers.some(atRule => rule.selector.startsWith(atRule))) {
                content = this._scopeSelectors(rule.content, scopeSelector, hostSelector);
            }
            else if (rule.selector.startsWith('@font-face') || rule.selector.startsWith('@page')) {
                content = this._stripScopingSelectors(rule.content);
            }
            return new CssRule(selector, content);
        });
    }
    /**
     * Handle a css text that is within a rule that should not contain scope selectors by simply
     * removing them! An example of such a rule is `@font-face`.
     *
     * `@font-face` rules cannot contain nested selectors. Nor can they be nested under a selector.
     * Normally this would be a syntax error by the author of the styles. But in some rare cases, such
     * as importing styles from a library, and applying `:host ::ng-deep` to the imported styles, we
     * can end up with broken css if the imported styles happen to contain @font-face rules.
     *
     * For example:
     *
     * ```
     * :host ::ng-deep {
     *   import 'some/lib/containing/font-face';
     * }
     *
     * Similar logic applies to `@page` rules which can contain a particular set of properties,
     * as well as some specific at-rules. Since they can't be encapsulated, we have to strip
     * any scoping selectors from them. For more information: https://www.w3.org/TR/css-page-3
     * ```
     */
    _stripScopingSelectors(cssText) {
        return processRules(cssText, (rule) => {
            const selector = rule.selector.replace(_shadowDeepSelectors, ' ')
                .replace(_polyfillHostNoCombinatorRe, ' ');
            return new CssRule(selector, rule.content);
        });
    }
    _scopeSelector(selector, scopeSelector, hostSelector) {
        return selector.split(',')
            .map((part) => part.trim().split(_shadowDeepSelectors))
            .map((deepParts) => {
            const [shallowPart, ...otherParts] = deepParts;
            const applyScope = (shallowPart) => {
                if (this._selectorNeedsScoping(shallowPart, scopeSelector)) {
                    return this._applySelectorScope(shallowPart, scopeSelector, hostSelector);
                }
                else {
                    return shallowPart;
                }
            };
            return [applyScope(shallowPart), ...otherParts].join(' ');
        })
            .join(', ');
    }
    _selectorNeedsScoping(selector, scopeSelector) {
        const re = this._makeScopeMatcher(scopeSelector);
        return !re.test(selector);
    }
    _makeScopeMatcher(scopeSelector) {
        const lre = /\[/g;
        const rre = /\]/g;
        scopeSelector = scopeSelector.replace(lre, '\\[').replace(rre, '\\]');
        return new RegExp('^(' + scopeSelector + ')' + _selectorReSuffix, 'm');
    }
    // scope via name and [is=name]
    _applySimpleSelectorScope(selector, scopeSelector, hostSelector) {
        // In Android browser, the lastIndex is not reset when the regex is used in String.replace()
        _polyfillHostRe.lastIndex = 0;
        if (_polyfillHostRe.test(selector)) {
            const replaceBy = `[${hostSelector}]`;
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
    // return a selector with [name] suffix on each simple selector
    // e.g. .foo.bar > .zot becomes .foo[name].bar[name] > .zot[name]  /** @internal */
    _applySelectorScope(selector, scopeSelector, hostSelector) {
        const isRe = /\[is=([^\]]*)\]/g;
        scopeSelector = scopeSelector.replace(isRe, (_, ...parts) => parts[0]);
        const attrName = '[' + scopeSelector + ']';
        const _scopeSelectorPart = (p) => {
            let scopedP = p.trim();
            if (!scopedP) {
                return '';
            }
            if (p.indexOf(_polyfillHostNoCombinator) > -1) {
                scopedP = this._applySimpleSelectorScope(p, scopeSelector, hostSelector);
            }
            else {
                // remove :host since it should be unnecessary
                const t = p.replace(_polyfillHostRe, '');
                if (t.length > 0) {
                    const matches = t.match(/([^:]*)(:*)(.*)/);
                    if (matches) {
                        scopedP = matches[1] + attrName + matches[2] + matches[3];
                    }
                }
            }
            return scopedP;
        };
        const safeContent = new SafeSelector(selector);
        selector = safeContent.content();
        let scopedSelector = '';
        let startIndex = 0;
        let res;
        const sep = /( |>|\+|~(?!=))\s*/g;
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
        const hasHost = selector.indexOf(_polyfillHostNoCombinator) > -1;
        // Only scope parts after the first `-shadowcsshost-no-combinator` when it is present
        let shouldScope = !hasHost;
        while ((res = sep.exec(selector)) !== null) {
            const separator = res[1];
            const part = selector.slice(startIndex, res.index).trim();
            // A space following an escaped hex value and followed by another hex character
            // (ie: ".\fc ber" for ".über") is not a separator between 2 selectors
            // also keep in mind that backslashes are replaced by a placeholder by SafeSelector
            // These escaped selectors happen for example when esbuild runs with optimization.minify.
            if (part.match(/__esc-ph-(\d+)__/) && selector[res.index + 1]?.match(/[a-fA-F\d]/)) {
                continue;
            }
            shouldScope = shouldScope || part.indexOf(_polyfillHostNoCombinator) > -1;
            const scopedPart = shouldScope ? _scopeSelectorPart(part) : part;
            scopedSelector += `${scopedPart} ${separator} `;
            startIndex = sep.lastIndex;
        }
        const part = selector.substring(startIndex);
        shouldScope = shouldScope || part.indexOf(_polyfillHostNoCombinator) > -1;
        scopedSelector += shouldScope ? _scopeSelectorPart(part) : part;
        // replace the placeholders with their original values
        return safeContent.restore(scopedSelector);
    }
    _insertPolyfillHostInCssText(selector) {
        return selector.replace(_colonHostContextRe, _polyfillHostContext)
            .replace(_colonHostRe, _polyfillHost);
    }
}
class SafeSelector {
    constructor(selector) {
        this.placeholders = [];
        this.index = 0;
        // Replaces attribute selectors with placeholders.
        // The WS in [attr="va lue"] would otherwise be interpreted as a selector separator.
        selector = this._escapeRegexMatches(selector, /(\[[^\]]*\])/g);
        // CSS allows for certain special characters to be used in selectors if they're escaped.
        // E.g. `.foo:blue` won't match a class called `foo:blue`, because the colon denotes a
        // pseudo-class, but writing `.foo\:blue` will match, because the colon was escaped.
        // Replace all escape sequences (`\` followed by a character) with a placeholder so
        // that our handling of pseudo-selectors doesn't mess with them.
        // Escaped characters have a specific placeholder so they can be detected separately.
        selector = selector.replace(/(\\.)/g, (_, keep) => {
            const replaceBy = `__esc-ph-${this.index}__`;
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
    restore(content) {
        return content.replace(/__(?:ph|esc-ph)-(\d+)__/g, (_ph, index) => this.placeholders[+index]);
    }
    content() {
        return this._content;
    }
    /**
     * Replaces all of the substrings that match a regex within a
     * special string (e.g. `__ph-0__`, `__ph-1__`, etc).
     */
    _escapeRegexMatches(content, pattern) {
        return content.replace(pattern, (_, keep) => {
            const replaceBy = `__ph-${this.index}__`;
            this.placeholders.push(keep);
            this.index++;
            return replaceBy;
        });
    }
}
const _cssContentNextSelectorRe = /polyfill-next-selector[^}]*content:[\s]*?(['"])(.*?)\1[;\s]*}([^{]*?){/gim;
const _cssContentRuleRe = /(polyfill-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const _cssContentUnscopedRuleRe = /(polyfill-unscoped-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const _polyfillHost = '-shadowcsshost';
// note: :host-context pre-processed to -shadowcsshostcontext.
const _polyfillHostContext = '-shadowcsscontext';
const _parenSuffix = '(?:\\((' +
    '(?:\\([^)(]*\\)|[^)(]*)+?' +
    ')\\))?([^,{]*)';
const _cssColonHostRe = new RegExp(_polyfillHost + _parenSuffix, 'gim');
const _cssColonHostContextReGlobal = new RegExp(_polyfillHostContext + _parenSuffix, 'gim');
const _cssColonHostContextRe = new RegExp(_polyfillHostContext + _parenSuffix, 'im');
const _polyfillHostNoCombinator = _polyfillHost + '-no-combinator';
const _polyfillHostNoCombinatorRe = /-shadowcsshost-no-combinator([^\s]*)/;
const _shadowDOMSelectorsRe = [
    /::shadow/g,
    /::content/g,
    // Deprecated selectors
    /\/shadow-deep\//g,
    /\/shadow\//g,
];
// The deep combinator is deprecated in the CSS spec
// Support for `>>>`, `deep`, `::ng-deep` is then also deprecated and will be removed in the future.
// see https://github.com/angular/angular/pull/17677
const _shadowDeepSelectors = /(?:>>>)|(?:\/deep\/)|(?:::ng-deep)/g;
const _selectorReSuffix = '([>\\s~+[.,{:][\\s\\S]*)?$';
const _polyfillHostRe = /-shadowcsshost/gim;
const _colonHostRe = /:host/gim;
const _colonHostContextRe = /:host-context/gim;
const _newLinesRe = /\r?\n/g;
const _commentRe = /\/\*[\s\S]*?\*\//g;
const _commentWithHashRe = /\/\*\s*#\s*source(Mapping)?URL=/g;
const COMMENT_PLACEHOLDER = '%COMMENT%';
const _commentWithHashPlaceHolderRe = new RegExp(COMMENT_PLACEHOLDER, 'g');
const BLOCK_PLACEHOLDER = '%BLOCK%';
const _ruleRe = new RegExp(`(\\s*(?:${COMMENT_PLACEHOLDER}\\s*)*)([^;\\{\\}]+?)(\\s*)((?:{%BLOCK%}?\\s*;?)|(?:\\s*;))`, 'g');
const CONTENT_PAIRS = new Map([['{', '}']]);
const COMMA_IN_PLACEHOLDER = '%COMMA_IN_PLACEHOLDER%';
const SEMI_IN_PLACEHOLDER = '%SEMI_IN_PLACEHOLDER%';
const COLON_IN_PLACEHOLDER = '%COLON_IN_PLACEHOLDER%';
const _cssCommaInPlaceholderReGlobal = new RegExp(COMMA_IN_PLACEHOLDER, 'g');
const _cssSemiInPlaceholderReGlobal = new RegExp(SEMI_IN_PLACEHOLDER, 'g');
const _cssColonInPlaceholderReGlobal = new RegExp(COLON_IN_PLACEHOLDER, 'g');
export class CssRule {
    constructor(selector, content) {
        this.selector = selector;
        this.content = content;
    }
}
export function processRules(input, ruleCallback) {
    const escaped = escapeInStrings(input);
    const inputWithEscapedBlocks = escapeBlocks(escaped, CONTENT_PAIRS, BLOCK_PLACEHOLDER);
    let nextBlockIndex = 0;
    const escapedResult = inputWithEscapedBlocks.escapedString.replace(_ruleRe, (...m) => {
        const selector = m[2];
        let content = '';
        let suffix = m[4];
        let contentPrefix = '';
        if (suffix && suffix.startsWith('{' + BLOCK_PLACEHOLDER)) {
            content = inputWithEscapedBlocks.blocks[nextBlockIndex++];
            suffix = suffix.substring(BLOCK_PLACEHOLDER.length + 1);
            contentPrefix = '{';
        }
        const rule = ruleCallback(new CssRule(selector, content));
        return `${m[1]}${rule.selector}${m[3]}${contentPrefix}${rule.content}${suffix}`;
    });
    return unescapeInStrings(escapedResult);
}
class StringWithEscapedBlocks {
    constructor(escapedString, blocks) {
        this.escapedString = escapedString;
        this.blocks = blocks;
    }
}
function escapeBlocks(input, charPairs, placeholder) {
    const resultParts = [];
    const escapedBlocks = [];
    let openCharCount = 0;
    let nonBlockStartIndex = 0;
    let blockStartIndex = -1;
    let openChar;
    let closeChar;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (char === '\\') {
            i++;
        }
        else if (char === closeChar) {
            openCharCount--;
            if (openCharCount === 0) {
                escapedBlocks.push(input.substring(blockStartIndex, i));
                resultParts.push(placeholder);
                nonBlockStartIndex = i;
                blockStartIndex = -1;
                openChar = closeChar = undefined;
            }
        }
        else if (char === openChar) {
            openCharCount++;
        }
        else if (openCharCount === 0 && charPairs.has(char)) {
            openChar = char;
            closeChar = charPairs.get(char);
            openCharCount = 1;
            blockStartIndex = i + 1;
            resultParts.push(input.substring(nonBlockStartIndex, blockStartIndex));
        }
    }
    if (blockStartIndex !== -1) {
        escapedBlocks.push(input.substring(blockStartIndex));
        resultParts.push(placeholder);
    }
    else {
        resultParts.push(input.substring(nonBlockStartIndex));
    }
    return new StringWithEscapedBlocks(resultParts.join(''), escapedBlocks);
}
/**
 * Object containing as keys characters that should be substituted by placeholders
 * when found in strings during the css text parsing, and as values the respective
 * placeholders
 */
const ESCAPE_IN_STRING_MAP = {
    ';': SEMI_IN_PLACEHOLDER,
    ',': COMMA_IN_PLACEHOLDER,
    ':': COLON_IN_PLACEHOLDER
};
/**
 * Parse the provided css text and inside strings (meaning, inside pairs of unescaped single or
 * double quotes) replace specific characters with their respective placeholders as indicated
 * by the `ESCAPE_IN_STRING_MAP` map.
 *
 * For example convert the text
 *  `animation: "my-anim:at\"ion" 1s;`
 * to
 *  `animation: "my-anim%COLON_IN_PLACEHOLDER%at\"ion" 1s;`
 *
 * This is necessary in order to remove the meaning of some characters when found inside strings
 * (for example `;` indicates the end of a css declaration, `,` the sequence of values and `:` the
 * division between property and value during a declaration, none of these meanings apply when such
 * characters are within strings and so in order to prevent parsing issues they need to be replaced
 * with placeholder text for the duration of the css manipulation process).
 *
 * @param input the original css text.
 *
 * @returns the css text with specific characters in strings replaced by placeholders.
 **/
function escapeInStrings(input) {
    let result = input;
    let currentQuoteChar = null;
    for (let i = 0; i < result.length; i++) {
        const char = result[i];
        if (char === '\\') {
            i++;
        }
        else {
            if (currentQuoteChar !== null) {
                // index i is inside a quoted sub-string
                if (char === currentQuoteChar) {
                    currentQuoteChar = null;
                }
                else {
                    const placeholder = ESCAPE_IN_STRING_MAP[char];
                    if (placeholder) {
                        result = `${result.substr(0, i)}${placeholder}${result.substr(i + 1)}`;
                        i += placeholder.length - 1;
                    }
                }
            }
            else if (char === '\'' || char === '"') {
                currentQuoteChar = char;
            }
        }
    }
    return result;
}
/**
 * Replace in a string all occurrences of keys in the `ESCAPE_IN_STRING_MAP` map with their
 * original representation, this is simply used to revert the changes applied by the
 * escapeInStrings function.
 *
 * For example it reverts the text:
 *  `animation: "my-anim%COLON_IN_PLACEHOLDER%at\"ion" 1s;`
 * to it's original form of:
 *  `animation: "my-anim:at\"ion" 1s;`
 *
 * Note: For the sake of simplicity this function does not check that the placeholders are
 * actually inside strings as it would anyway be extremely unlikely to find them outside of strings.
 *
 * @param input the css text containing the placeholders.
 *
 * @returns the css text without the placeholders.
 */
function unescapeInStrings(input) {
    let result = input.replace(_cssCommaInPlaceholderReGlobal, ',');
    result = result.replace(_cssSemiInPlaceholderReGlobal, ';');
    result = result.replace(_cssColonInPlaceholderReGlobal, ':');
    return result;
}
/**
 * Unescape all quotes present in a string, but only if the string was actually already
 * quoted.
 *
 * This generates a "canonical" representation of strings which can be used to match strings
 * which would otherwise only differ because of differently escaped quotes.
 *
 * For example it converts the string (assumed to be quoted):
 *  `this \\"is\\" a \\'\\\\'test`
 * to:
 *  `this "is" a '\\\\'test`
 * (note that the latter backslashes are not removed as they are not actually escaping the single
 * quote)
 *
 *
 * @param input the string possibly containing escaped quotes.
 * @param isQuoted boolean indicating whether the string was quoted inside a bigger string (if not
 * then it means that it doesn't represent an inner string and thus no unescaping is required)
 *
 * @returns the string in the "canonical" representation without escaped quotes.
 */
function unescapeQuotes(str, isQuoted) {
    return !isQuoted ? str : str.replace(/((?:^|[^\\])(?:\\\\)*)\\(?=['"])/g, '$1');
}
/**
 * Combine the `contextSelectors` with the `hostMarker` and the `otherSelectors`
 * to create a selector that matches the same as `:host-context()`.
 *
 * Given a single context selector `A` we need to output selectors that match on the host and as an
 * ancestor of the host:
 *
 * ```
 * A <hostMarker>, A<hostMarker> {}
 * ```
 *
 * When there is more than one context selector we also have to create combinations of those
 * selectors with each other. For example if there are `A` and `B` selectors the output is:
 *
 * ```
 * AB<hostMarker>, AB <hostMarker>, A B<hostMarker>,
 * B A<hostMarker>, A B <hostMarker>, B A <hostMarker> {}
 * ```
 *
 * And so on...
 *
 * @param contextSelectors an array of context selectors that will be combined.
 * @param otherSelectors the rest of the selectors that are not context selectors.
 */
function combineHostContextSelectors(contextSelectors, otherSelectors) {
    const hostMarker = _polyfillHostNoCombinator;
    _polyfillHostRe.lastIndex = 0; // reset the regex to ensure we get an accurate test
    const otherSelectorsHasHost = _polyfillHostRe.test(otherSelectors);
    // If there are no context selectors then just output a host marker
    if (contextSelectors.length === 0) {
        return hostMarker + otherSelectors;
    }
    const combined = [contextSelectors.pop() || ''];
    while (contextSelectors.length > 0) {
        const length = combined.length;
        const contextSelector = contextSelectors.pop();
        for (let i = 0; i < length; i++) {
            const previousSelectors = combined[i];
            // Add the new selector as a descendant of the previous selectors
            combined[length * 2 + i] = previousSelectors + ' ' + contextSelector;
            // Add the new selector as an ancestor of the previous selectors
            combined[length + i] = contextSelector + ' ' + previousSelectors;
            // Add the new selector to act on the same element as the previous selectors
            combined[i] = contextSelector + previousSelectors;
        }
    }
    // Finally connect the selector to the `hostMarker`s: either acting directly on the host
    // (A<hostMarker>) or as an ancestor (A <hostMarker>).
    return combined
        .map(s => otherSelectorsHasHost ?
        `${s}${otherSelectors}` :
        `${s}${hostMarker}${otherSelectors}, ${s} ${hostMarker}${otherSelectors}`)
        .join(',');
}
/**
 * Mutate the given `groups` array so that there are `multiples` clones of the original array
 * stored.
 *
 * For example `repeatGroups([a, b], 3)` will result in `[a, b, a, b, a, b]` - but importantly the
 * newly added groups will be clones of the original.
 *
 * @param groups An array of groups of strings that will be repeated. This array is mutated
 *     in-place.
 * @param multiples The number of times the current groups should appear.
 */
export function repeatGroups(groups, multiples) {
    const length = groups.length;
    for (let i = 1; i < multiples; i++) {
        for (let j = 0; j < length; j++) {
            groups[j + (i * length)] = groups[j].slice(0);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93X2Nzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zaGFkb3dfY3NzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLGlCQUFpQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ2hDLGdCQUFnQjtJQUNoQixTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxPQUFPO0lBQ3ZDLHNCQUFzQjtJQUN0QixXQUFXLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxFQUFFLFNBQVM7SUFDckQsc0JBQXNCO0lBQ3RCLFdBQVcsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLE1BQU07SUFDdkMsdUJBQXVCO0lBQ3ZCLFFBQVEsRUFBRSxTQUFTO0lBQ25CLDRCQUE0QjtJQUM1QixNQUFNLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxVQUFVO0lBQ2hGLHFCQUFxQjtJQUNyQixLQUFLLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLE9BQU87Q0FDbkUsQ0FBQyxDQUFDO0FBRUg7O0dBRUc7QUFDSCxNQUFNLHVCQUF1QixHQUN6QixDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLENBQUM7QUFFOUY7Ozs7Ozs7O0dBUUc7QUFFSDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0VBNkZFO0FBQ0YsTUFBTSxPQUFPLFNBQVM7SUFBdEI7UUErSkU7Ozs7Ozs7Ozs7Ozs7V0FhRztRQUNLLHFDQUFnQyxHQUNwQyxpRkFBaUYsQ0FBQztJQTRh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O0lBQ2hFLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDN0IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25DLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNoQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRCxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBUaGUgZm9sbG93aW5nIHNldCBjb250YWlucyBhbGwga2V5d29yZHMgdGhhdCBjYW4gYmUgdXNlZCBpbiB0aGUgYW5pbWF0aW9uIGNzcyBzaG9ydGhhbmRcbiAqIHByb3BlcnR5IGFuZCBpcyB1c2VkIGR1cmluZyB0aGUgc2NvcGluZyBvZiBrZXlmcmFtZXMgdG8gbWFrZSBzdXJlIHN1Y2gga2V5d29yZHNcbiAqIGFyZSBub3QgbW9kaWZpZWQuXG4gKi9cbmNvbnN0IGFuaW1hdGlvbktleXdvcmRzID0gbmV3IFNldChbXG4gIC8vIGdsb2JhbCB2YWx1ZXNcbiAgJ2luaGVyaXQnLCAnaW5pdGlhbCcsICdyZXZlcnQnLCAndW5zZXQnLFxuICAvLyBhbmltYXRpb24tZGlyZWN0aW9uXG4gICdhbHRlcm5hdGUnLCAnYWx0ZXJuYXRlLXJldmVyc2UnLCAnbm9ybWFsJywgJ3JldmVyc2UnLFxuICAvLyBhbmltYXRpb24tZmlsbC1tb2RlXG4gICdiYWNrd2FyZHMnLCAnYm90aCcsICdmb3J3YXJkcycsICdub25lJyxcbiAgLy8gYW5pbWF0aW9uLXBsYXktc3RhdGVcbiAgJ3BhdXNlZCcsICdydW5uaW5nJyxcbiAgLy8gYW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvblxuICAnZWFzZScsICdlYXNlLWluJywgJ2Vhc2UtaW4tb3V0JywgJ2Vhc2Utb3V0JywgJ2xpbmVhcicsICdzdGVwLXN0YXJ0JywgJ3N0ZXAtZW5kJyxcbiAgLy8gYHN0ZXBzKClgIGZ1bmN0aW9uXG4gICdlbmQnLCAnanVtcC1ib3RoJywgJ2p1bXAtZW5kJywgJ2p1bXAtbm9uZScsICdqdW1wLXN0YXJ0JywgJ3N0YXJ0J1xuXSk7XG5cbi8qKlxuICogVGhlIGZvbGxvd2luZyBhcnJheSBjb250YWlucyBhbGwgb2YgdGhlIENTUyBhdC1ydWxlIGlkZW50aWZpZXJzIHdoaWNoIGFyZSBzY29wZWQuXG4gKi9cbmNvbnN0IHNjb3BlZEF0UnVsZUlkZW50aWZpZXJzID1cbiAgICBbJ0BtZWRpYScsICdAc3VwcG9ydHMnLCAnQGRvY3VtZW50JywgJ0BsYXllcicsICdAY29udGFpbmVyJywgJ0BzY29wZScsICdAc3RhcnRpbmctc3R5bGUnXTtcblxuLyoqXG4gKiBUaGUgZm9sbG93aW5nIGNsYXNzIGhhcyBpdHMgb3JpZ2luIGZyb20gYSBwb3J0IG9mIHNoYWRvd0NTUyBmcm9tIHdlYmNvbXBvbmVudHMuanMgdG8gVHlwZVNjcmlwdC5cbiAqIEl0IGhhcyBzaW5jZSBkaXZlcmdlIGluIG1hbnkgd2F5cyB0byB0YWlsb3IgQW5ndWxhcidzIG5lZWRzLlxuICpcbiAqIFNvdXJjZTpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJjb21wb25lbnRzL3dlYmNvbXBvbmVudHNqcy9ibG9iLzRlZmVjZDdlMGUvc3JjL1NoYWRvd0NTUy9TaGFkb3dDU1MuanNcbiAqXG4gKiBUaGUgb3JpZ2luYWwgZmlsZSBsZXZlbCBjb21tZW50IGlzIHJlcHJvZHVjZWQgYmVsb3dcbiAqL1xuXG4vKlxuICBUaGlzIGlzIGEgbGltaXRlZCBzaGltIGZvciBTaGFkb3dET00gY3NzIHN0eWxpbmcuXG4gIGh0dHBzOi8vZHZjcy53My5vcmcvaGcvd2ViY29tcG9uZW50cy9yYXctZmlsZS90aXAvc3BlYy9zaGFkb3cvaW5kZXguaHRtbCNzdHlsZXNcblxuICBUaGUgaW50ZW50aW9uIGhlcmUgaXMgdG8gc3VwcG9ydCBvbmx5IHRoZSBzdHlsaW5nIGZlYXR1cmVzIHdoaWNoIGNhbiBiZVxuICByZWxhdGl2ZWx5IHNpbXBseSBpbXBsZW1lbnRlZC4gVGhlIGdvYWwgaXMgdG8gYWxsb3cgdXNlcnMgdG8gYXZvaWQgdGhlXG4gIG1vc3Qgb2J2aW91cyBwaXRmYWxscyBhbmQgZG8gc28gd2l0aG91dCBjb21wcm9taXNpbmcgcGVyZm9ybWFuY2Ugc2lnbmlmaWNhbnRseS5cbiAgRm9yIFNoYWRvd0RPTSBzdHlsaW5nIHRoYXQncyBub3QgY292ZXJlZCBoZXJlLCBhIHNldCBvZiBiZXN0IHByYWN0aWNlc1xuICBjYW4gYmUgcHJvdmlkZWQgdGhhdCBzaG91bGQgYWxsb3cgdXNlcnMgdG8gYWNjb21wbGlzaCBtb3JlIGNvbXBsZXggc3R5bGluZy5cblxuICBUaGUgZm9sbG93aW5nIGlzIGEgbGlzdCBvZiBzcGVjaWZpYyBTaGFkb3dET00gc3R5bGluZyBmZWF0dXJlcyBhbmQgYSBicmllZlxuICBkaXNjdXNzaW9uIG9mIHRoZSBhcHByb2FjaCB1c2VkIHRvIHNoaW0uXG5cbiAgU2hpbW1lZCBmZWF0dXJlczpcblxuICAqIDpob3N0LCA6aG9zdC1jb250ZXh0OiBTaGFkb3dET00gYWxsb3dzIHN0eWxpbmcgb2YgdGhlIHNoYWRvd1Jvb3QncyBob3N0XG4gIGVsZW1lbnQgdXNpbmcgdGhlIDpob3N0IHJ1bGUuIFRvIHNoaW0gdGhpcyBmZWF0dXJlLCB0aGUgOmhvc3Qgc3R5bGVzIGFyZVxuICByZWZvcm1hdHRlZCBhbmQgcHJlZml4ZWQgd2l0aCBhIGdpdmVuIHNjb3BlIG5hbWUgYW5kIHByb21vdGVkIHRvIGFcbiAgZG9jdW1lbnQgbGV2ZWwgc3R5bGVzaGVldC5cbiAgRm9yIGV4YW1wbGUsIGdpdmVuIGEgc2NvcGUgbmFtZSBvZiAuZm9vLCBhIHJ1bGUgbGlrZSB0aGlzOlxuXG4gICAgOmhvc3Qge1xuICAgICAgICBiYWNrZ3JvdW5kOiByZWQ7XG4gICAgICB9XG4gICAgfVxuXG4gIGJlY29tZXM6XG5cbiAgICAuZm9vIHtcbiAgICAgIGJhY2tncm91bmQ6IHJlZDtcbiAgICB9XG5cbiAgKiBlbmNhcHN1bGF0aW9uOiBTdHlsZXMgZGVmaW5lZCB3aXRoaW4gU2hhZG93RE9NLCBhcHBseSBvbmx5IHRvXG4gIGRvbSBpbnNpZGUgdGhlIFNoYWRvd0RPTS5cbiAgVGhlIHNlbGVjdG9ycyBhcmUgc2NvcGVkIGJ5IGFkZGluZyBhbiBhdHRyaWJ1dGUgc2VsZWN0b3Igc3VmZml4IHRvIGVhY2hcbiAgc2ltcGxlIHNlbGVjdG9yIHRoYXQgY29udGFpbnMgdGhlIGhvc3QgZWxlbWVudCB0YWcgbmFtZS4gRWFjaCBlbGVtZW50XG4gIGluIHRoZSBlbGVtZW50J3MgU2hhZG93RE9NIHRlbXBsYXRlIGlzIGFsc28gZ2l2ZW4gdGhlIHNjb3BlIGF0dHJpYnV0ZS5cbiAgVGh1cywgdGhlc2UgcnVsZXMgbWF0Y2ggb25seSBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHNjb3BlIGF0dHJpYnV0ZS5cbiAgRm9yIGV4YW1wbGUsIGdpdmVuIGEgc2NvcGUgbmFtZSBvZiB4LWZvbywgYSBydWxlIGxpa2UgdGhpczpcblxuICAgIGRpdiB7XG4gICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICB9XG5cbiAgYmVjb21lczpcblxuICAgIGRpdlt4LWZvb10ge1xuICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgfVxuXG4gIE5vdGUgdGhhdCBlbGVtZW50cyB0aGF0IGFyZSBkeW5hbWljYWxseSBhZGRlZCB0byBhIHNjb3BlIG11c3QgaGF2ZSB0aGUgc2NvcGVcbiAgc2VsZWN0b3IgYWRkZWQgdG8gdGhlbSBtYW51YWxseS5cblxuICAqIHVwcGVyL2xvd2VyIGJvdW5kIGVuY2Fwc3VsYXRpb246IFN0eWxlcyB3aGljaCBhcmUgZGVmaW5lZCBvdXRzaWRlIGFcbiAgc2hhZG93Um9vdCBzaG91bGQgbm90IGNyb3NzIHRoZSBTaGFkb3dET00gYm91bmRhcnkgYW5kIHNob3VsZCBub3QgYXBwbHlcbiAgaW5zaWRlIGEgc2hhZG93Um9vdC5cblxuICBUaGlzIHN0eWxpbmcgYmVoYXZpb3IgaXMgbm90IGVtdWxhdGVkLiBTb21lIHBvc3NpYmxlIHdheXMgdG8gZG8gdGhpcyB0aGF0XG4gIHdlcmUgcmVqZWN0ZWQgZHVlIHRvIGNvbXBsZXhpdHkgYW5kL29yIHBlcmZvcm1hbmNlIGNvbmNlcm5zIGluY2x1ZGU6ICgxKSByZXNldFxuICBldmVyeSBwb3NzaWJsZSBwcm9wZXJ0eSBmb3IgZXZlcnkgcG9zc2libGUgc2VsZWN0b3IgZm9yIGEgZ2l2ZW4gc2NvcGUgbmFtZTtcbiAgKDIpIHJlLWltcGxlbWVudCBjc3MgaW4gamF2YXNjcmlwdC5cblxuICBBcyBhbiBhbHRlcm5hdGl2ZSwgdXNlcnMgc2hvdWxkIG1ha2Ugc3VyZSB0byB1c2Ugc2VsZWN0b3JzXG4gIHNwZWNpZmljIHRvIHRoZSBzY29wZSBpbiB3aGljaCB0aGV5IGFyZSB3b3JraW5nLlxuXG4gICogOjpkaXN0cmlidXRlZDogVGhpcyBiZWhhdmlvciBpcyBub3QgZW11bGF0ZWQuIEl0J3Mgb2Z0ZW4gbm90IG5lY2Vzc2FyeVxuICB0byBzdHlsZSB0aGUgY29udGVudHMgb2YgYSBzcGVjaWZpYyBpbnNlcnRpb24gcG9pbnQgYW5kIGluc3RlYWQsIGRlc2NlbmRhbnRzXG4gIG9mIHRoZSBob3N0IGVsZW1lbnQgY2FuIGJlIHN0eWxlZCBzZWxlY3RpdmVseS4gVXNlcnMgY2FuIGFsc28gY3JlYXRlIGFuXG4gIGV4dHJhIG5vZGUgYXJvdW5kIGFuIGluc2VydGlvbiBwb2ludCBhbmQgc3R5bGUgdGhhdCBub2RlJ3MgY29udGVudHNcbiAgdmlhIGRlc2NlbmRlbnQgc2VsZWN0b3JzLiBGb3IgZXhhbXBsZSwgd2l0aCBhIHNoYWRvd1Jvb3QgbGlrZSB0aGlzOlxuXG4gICAgPHN0eWxlPlxuICAgICAgOjpjb250ZW50KGRpdikge1xuICAgICAgICBiYWNrZ3JvdW5kOiByZWQ7XG4gICAgICB9XG4gICAgPC9zdHlsZT5cbiAgICA8Y29udGVudD48L2NvbnRlbnQ+XG5cbiAgY291bGQgYmVjb21lOlxuXG4gICAgPHN0eWxlPlxuICAgICAgLyAqQHBvbHlmaWxsIC5jb250ZW50LWNvbnRhaW5lciBkaXYgKiAvXG4gICAgICA6OmNvbnRlbnQoZGl2KSB7XG4gICAgICAgIGJhY2tncm91bmQ6IHJlZDtcbiAgICAgIH1cbiAgICA8L3N0eWxlPlxuICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbnRhaW5lclwiPlxuICAgICAgPGNvbnRlbnQ+PC9jb250ZW50PlxuICAgIDwvZGl2PlxuXG4gIE5vdGUgdGhlIHVzZSBvZiBAcG9seWZpbGwgaW4gdGhlIGNvbW1lbnQgYWJvdmUgYSBTaGFkb3dET00gc3BlY2lmaWMgc3R5bGVcbiAgZGVjbGFyYXRpb24uIFRoaXMgaXMgYSBkaXJlY3RpdmUgdG8gdGhlIHN0eWxpbmcgc2hpbSB0byB1c2UgdGhlIHNlbGVjdG9yXG4gIGluIGNvbW1lbnRzIGluIGxpZXUgb2YgdGhlIG5leHQgc2VsZWN0b3Igd2hlbiBydW5uaW5nIHVuZGVyIHBvbHlmaWxsLlxuKi9cbmV4cG9ydCBjbGFzcyBTaGFkb3dDc3Mge1xuICAvKlxuICAgKiBTaGltIHNvbWUgY3NzVGV4dCB3aXRoIHRoZSBnaXZlbiBzZWxlY3Rvci4gUmV0dXJucyBjc3NUZXh0IHRoYXQgY2FuIGJlIGluY2x1ZGVkIGluIHRoZSBkb2N1bWVudFxuICAgKlxuICAgKiBUaGUgc2VsZWN0b3IgaXMgdGhlIGF0dHJpYnV0ZSBhZGRlZCB0byBhbGwgZWxlbWVudHMgaW5zaWRlIHRoZSBob3N0LFxuICAgKiBUaGUgaG9zdFNlbGVjdG9yIGlzIHRoZSBhdHRyaWJ1dGUgYWRkZWQgdG8gdGhlIGhvc3QgaXRzZWxmLlxuICAgKi9cbiAgc2hpbUNzc1RleHQoY3NzVGV4dDogc3RyaW5nLCBzZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyA9ICcnKTogc3RyaW5nIHtcbiAgICAvLyAqKk5PVEUqKjogRG8gbm90IHN0cmlwIGNvbW1lbnRzIGFzIHRoaXMgd2lsbCBjYXVzZSBjb21wb25lbnQgc291cmNlbWFwcyB0byBicmVha1xuICAgIC8vIGR1ZSB0byBzaGlmdCBpbiBsaW5lcy5cblxuICAgIC8vIENvbGxlY3QgY29tbWVudHMgYW5kIHJlcGxhY2UgdGhlbSB3aXRoIGEgcGxhY2Vob2xkZXIsIHRoaXMgaXMgZG9uZSB0byBhdm9pZCBjb21wbGljYXRpbmdcbiAgICAvLyB0aGUgcnVsZSBwYXJzaW5nIFJlZ0V4cCBhbmQga2VlcCBpdCBzYWZlci5cbiAgICBjb25zdCBjb21tZW50czogc3RyaW5nW10gPSBbXTtcbiAgICBjc3NUZXh0ID0gY3NzVGV4dC5yZXBsYWNlKF9jb21tZW50UmUsIChtKSA9PiB7XG4gICAgICBpZiAobS5tYXRjaChfY29tbWVudFdpdGhIYXNoUmUpKSB7XG4gICAgICAgIGNvbW1lbnRzLnB1c2gobSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBSZXBsYWNlIG5vbiBoYXNoIGNvbW1lbnRzIHdpdGggZW1wdHkgbGluZXMuXG4gICAgICAgIC8vIFRoaXMgaXMgZG9uZSBzbyB0aGF0IHdlIGRvIG5vdCBsZWFrIGFueSBzZW5zaXRpdmUgZGF0YSBpbiBjb21tZW50cy5cbiAgICAgICAgY29uc3QgbmV3TGluZXNNYXRjaGVzID0gbS5tYXRjaChfbmV3TGluZXNSZSk7XG4gICAgICAgIGNvbW1lbnRzLnB1c2goKG5ld0xpbmVzTWF0Y2hlcz8uam9pbignJykgPz8gJycpICsgJ1xcbicpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gQ09NTUVOVF9QTEFDRUhPTERFUjtcbiAgICB9KTtcblxuICAgIGNzc1RleHQgPSB0aGlzLl9pbnNlcnREaXJlY3RpdmVzKGNzc1RleHQpO1xuICAgIGNvbnN0IHNjb3BlZENzc1RleHQgPSB0aGlzLl9zY29wZUNzc1RleHQoY3NzVGV4dCwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgLy8gQWRkIGJhY2sgY29tbWVudHMgYXQgdGhlIG9yaWdpbmFsIHBvc2l0aW9uLlxuICAgIGxldCBjb21tZW50SWR4ID0gMDtcbiAgICByZXR1cm4gc2NvcGVkQ3NzVGV4dC5yZXBsYWNlKF9jb21tZW50V2l0aEhhc2hQbGFjZUhvbGRlclJlLCAoKSA9PiBjb21tZW50c1tjb21tZW50SWR4KytdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2luc2VydERpcmVjdGl2ZXMoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjc3NUZXh0ID0gdGhpcy5faW5zZXJ0UG9seWZpbGxEaXJlY3RpdmVzSW5Dc3NUZXh0KGNzc1RleHQpO1xuICAgIHJldHVybiB0aGlzLl9pbnNlcnRQb2x5ZmlsbFJ1bGVzSW5Dc3NUZXh0KGNzc1RleHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBzY29wZSB0byBrZXlmcmFtZXMuXG4gICAqXG4gICAqIE1vZGlmeSBib3RoIHRoZSBuYW1lcyBvZiB0aGUga2V5ZnJhbWVzIGRlZmluZWQgaW4gdGhlIGNvbXBvbmVudCBzdHlsZXMgYW5kIGFsc28gdGhlIGNzc1xuICAgKiBhbmltYXRpb24gcnVsZXMgdXNpbmcgdGhlbS5cbiAgICpcbiAgICogQW5pbWF0aW9uIHJ1bGVzIHVzaW5nIGtleWZyYW1lcyBkZWZpbmVkIGVsc2V3aGVyZSBhcmUgbm90IG1vZGlmaWVkIHRvIGFsbG93IGZvciBnbG9iYWxseVxuICAgKiBkZWZpbmVkIGtleWZyYW1lcy5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIHdlIGNvbnZlcnQgdGhpcyBjc3M6XG4gICAqXG4gICAqIGBgYFxuICAgKiAuYm94IHtcbiAgICogICBhbmltYXRpb246IGJveC1hbmltYXRpb24gMXMgZm9yd2FyZHM7XG4gICAqIH1cbiAgICpcbiAgICogQGtleWZyYW1lcyBib3gtYW5pbWF0aW9uIHtcbiAgICogICB0byB7XG4gICAqICAgICBiYWNrZ3JvdW5kLWNvbG9yOiBncmVlbjtcbiAgICogICB9XG4gICAqIH1cbiAgICogYGBgXG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiAuYm94IHtcbiAgICogICBhbmltYXRpb246IHNjb3BlTmFtZV9ib3gtYW5pbWF0aW9uIDFzIGZvcndhcmRzO1xuICAgKiB9XG4gICAqXG4gICAqIEBrZXlmcmFtZXMgc2NvcGVOYW1lX2JveC1hbmltYXRpb24ge1xuICAgKiAgIHRvIHtcbiAgICogICAgIGJhY2tncm91bmQtY29sb3I6IGdyZWVuO1xuICAgKiAgIH1cbiAgICogfVxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGNzc1RleHQgdGhlIGNvbXBvbmVudCdzIGNzcyB0ZXh0IHRoYXQgbmVlZHMgdG8gYmUgc2NvcGVkLlxuICAgKiBAcGFyYW0gc2NvcGVTZWxlY3RvciB0aGUgY29tcG9uZW50J3Mgc2NvcGUgc2VsZWN0b3IuXG4gICAqXG4gICAqIEByZXR1cm5zIHRoZSBzY29wZWQgY3NzIHRleHQuXG4gICAqL1xuICBwcml2YXRlIF9zY29wZUtleWZyYW1lc1JlbGF0ZWRDc3MoY3NzVGV4dDogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVuc2NvcGVkS2V5ZnJhbWVzU2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3Qgc2NvcGVkS2V5ZnJhbWVzQ3NzVGV4dCA9IHByb2Nlc3NSdWxlcyhcbiAgICAgICAgY3NzVGV4dCxcbiAgICAgICAgcnVsZSA9PiB0aGlzLl9zY29wZUxvY2FsS2V5ZnJhbWVEZWNsYXJhdGlvbnMocnVsZSwgc2NvcGVTZWxlY3RvciwgdW5zY29wZWRLZXlmcmFtZXNTZXQpKTtcbiAgICByZXR1cm4gcHJvY2Vzc1J1bGVzKFxuICAgICAgICBzY29wZWRLZXlmcmFtZXNDc3NUZXh0LFxuICAgICAgICBydWxlID0+IHRoaXMuX3Njb3BlQW5pbWF0aW9uUnVsZShydWxlLCBzY29wZVNlbGVjdG9yLCB1bnNjb3BlZEtleWZyYW1lc1NldCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNjb3BlcyBsb2NhbCBrZXlmcmFtZXMgbmFtZXMsIHJldHVybmluZyB0aGUgdXBkYXRlZCBjc3MgcnVsZSBhbmQgaXQgYWxzb1xuICAgKiBhZGRzIHRoZSBvcmlnaW5hbCBrZXlmcmFtZSBuYW1lIHRvIGEgcHJvdmlkZWQgc2V0IHRvIGNvbGxlY3QgYWxsIGtleWZyYW1lcyBuYW1lc1xuICAgKiBzbyB0aGF0IGl0IGNhbiBsYXRlciBiZSB1c2VkIHRvIHNjb3BlIHRoZSBhbmltYXRpb24gcnVsZXMuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLCBpdCB0YWtlcyBhIHJ1bGUgc3VjaCBhczpcbiAgICpcbiAgICogYGBgXG4gICAqIEBrZXlmcmFtZXMgYm94LWFuaW1hdGlvbiB7XG4gICAqICAgdG8ge1xuICAgKiAgICAgYmFja2dyb3VuZC1jb2xvcjogZ3JlZW47XG4gICAqICAgfVxuICAgKiB9XG4gICAqIGBgYFxuICAgKlxuICAgKiBhbmQgcmV0dXJuczpcbiAgICpcbiAgICogYGBgXG4gICAqIEBrZXlmcmFtZXMgc2NvcGVOYW1lX2JveC1hbmltYXRpb24ge1xuICAgKiAgIHRvIHtcbiAgICogICAgIGJhY2tncm91bmQtY29sb3I6IGdyZWVuO1xuICAgKiAgIH1cbiAgICogfVxuICAgKiBgYGBcbiAgICogYW5kIGFzIGEgc2lkZSBlZmZlY3QgaXQgYWRkcyBcImJveC1hbmltYXRpb25cIiB0byB0aGUgYHVuc2NvcGVkS2V5ZnJhbWVzU2V0YCBzZXRcbiAgICpcbiAgICogQHBhcmFtIGNzc1J1bGUgdGhlIGNzcyBydWxlIHRvIHByb2Nlc3MuXG4gICAqIEBwYXJhbSBzY29wZVNlbGVjdG9yIHRoZSBjb21wb25lbnQncyBzY29wZSBzZWxlY3Rvci5cbiAgICogQHBhcmFtIHVuc2NvcGVkS2V5ZnJhbWVzU2V0IHRoZSBzZXQgb2YgdW5zY29wZWQga2V5ZnJhbWVzIG5hbWVzICh3aGljaCBjYW4gYmVcbiAgICogbW9kaWZpZWQgYXMgYSBzaWRlIGVmZmVjdClcbiAgICpcbiAgICogQHJldHVybnMgdGhlIGNzcyBydWxlIG1vZGlmaWVkIHdpdGggdGhlIHNjb3BlZCBrZXlmcmFtZXMgbmFtZS5cbiAgICovXG4gIHByaXZhdGUgX3Njb3BlTG9jYWxLZXlmcmFtZURlY2xhcmF0aW9ucyhcbiAgICAgIHJ1bGU6IENzc1J1bGUsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgdW5zY29wZWRLZXlmcmFtZXNTZXQ6IFNldDxzdHJpbmc+KTogQ3NzUnVsZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnJ1bGUsXG4gICAgICBzZWxlY3RvcjogcnVsZS5zZWxlY3Rvci5yZXBsYWNlKFxuICAgICAgICAgIC8oXkAoPzotd2Via2l0LSk/a2V5ZnJhbWVzKD86XFxzKykpKFsnXCJdPykoLispXFwyKFxccyopJC8sXG4gICAgICAgICAgKF8sIHN0YXJ0LCBxdW90ZSwga2V5ZnJhbWVOYW1lLCBlbmRTcGFjZXMpID0+IHtcbiAgICAgICAgICAgIHVuc2NvcGVkS2V5ZnJhbWVzU2V0LmFkZCh1bmVzY2FwZVF1b3RlcyhrZXlmcmFtZU5hbWUsIHF1b3RlKSk7XG4gICAgICAgICAgICByZXR1cm4gYCR7c3RhcnR9JHtxdW90ZX0ke3Njb3BlU2VsZWN0b3J9XyR7a2V5ZnJhbWVOYW1lfSR7cXVvdGV9JHtlbmRTcGFjZXN9YDtcbiAgICAgICAgICB9KSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEZ1bmN0aW9uIHVzZWQgdG8gc2NvcGUgYSBrZXlmcmFtZXMgbmFtZSAob2J0YWluZWQgZnJvbSBhbiBhbmltYXRpb24gZGVjbGFyYXRpb24pXG4gICAqIHVzaW5nIGFuIGV4aXN0aW5nIHNldCBvZiB1bnNjb3BlZEtleWZyYW1lcyBuYW1lcyB0byBkaXNjZXJuIGlmIHRoZSBzY29waW5nIG5lZWRzIHRvIGJlXG4gICAqIHBlcmZvcm1lZCAoa2V5ZnJhbWVzIG5hbWVzIG9mIGtleWZyYW1lcyBub3QgZGVmaW5lZCBpbiB0aGUgY29tcG9uZW50J3MgY3NzIG5lZWQgbm90IHRvIGJlXG4gICAqIHNjb3BlZCkuXG4gICAqXG4gICAqIEBwYXJhbSBrZXlmcmFtZSB0aGUga2V5ZnJhbWVzIG5hbWUgdG8gY2hlY2suXG4gICAqIEBwYXJhbSBzY29wZVNlbGVjdG9yIHRoZSBjb21wb25lbnQncyBzY29wZSBzZWxlY3Rvci5cbiAgICogQHBhcmFtIHVuc2NvcGVkS2V5ZnJhbWVzU2V0IHRoZSBzZXQgb2YgdW5zY29wZWQga2V5ZnJhbWVzIG5hbWVzLlxuICAgKlxuICAgKiBAcmV0dXJucyB0aGUgc2NvcGVkIG5hbWUgb2YgdGhlIGtleWZyYW1lLCBvciB0aGUgb3JpZ2luYWwgbmFtZSBpcyB0aGUgbmFtZSBuZWVkIG5vdCB0byBiZVxuICAgKiBzY29wZWQuXG4gICAqL1xuICBwcml2YXRlIF9zY29wZUFuaW1hdGlvbktleWZyYW1lKFxuICAgICAga2V5ZnJhbWU6IHN0cmluZywgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLCB1bnNjb3BlZEtleWZyYW1lc1NldDogUmVhZG9ubHlTZXQ8c3RyaW5nPik6IHN0cmluZyB7XG4gICAgcmV0dXJuIGtleWZyYW1lLnJlcGxhY2UoL14oXFxzKikoWydcIl0/KSguKz8pXFwyKFxccyopJC8sIChfLCBzcGFjZXMxLCBxdW90ZSwgbmFtZSwgc3BhY2VzMikgPT4ge1xuICAgICAgbmFtZSA9IGAke3Vuc2NvcGVkS2V5ZnJhbWVzU2V0Lmhhcyh1bmVzY2FwZVF1b3RlcyhuYW1lLCBxdW90ZSkpID8gc2NvcGVTZWxlY3RvciArICdfJyA6ICcnfSR7XG4gICAgICAgICAgbmFtZX1gO1xuICAgICAgcmV0dXJuIGAke3NwYWNlczF9JHtxdW90ZX0ke25hbWV9JHtxdW90ZX0ke3NwYWNlczJ9YDtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWd1bGFyIGV4cHJlc3Npb24gdXNlZCB0byBleHRyYXBvbGF0ZSB0aGUgcG9zc2libGUga2V5ZnJhbWVzIGZyb20gYW5cbiAgICogYW5pbWF0aW9uIGRlY2xhcmF0aW9uICh3aXRoIHBvc3NpYmx5IG11bHRpcGxlIGFuaW1hdGlvbiBkZWZpbml0aW9ucylcbiAgICpcbiAgICogVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBjYW4gYmUgZGl2aWRlZCBpbiB0aHJlZSBwYXJ0c1xuICAgKiAgLSAoXnxcXHMrKVxuICAgKiAgICBzaW1wbHkgY2FwdHVyZXMgaG93IG1hbnkgKGlmIGFueSkgbGVhZGluZyB3aGl0ZXNwYWNlcyBhcmUgcHJlc2VudFxuICAgKiAgLSAoPzooPzooWydcIl0pKCg/OlxcXFxcXFxcfFxcXFxcXDJ8KD8hXFwyKS4pKylcXDIpfCgtP1tBLVphLXpdW1xcd1xcLV0qKSlcbiAgICogICAgY2FwdHVyZXMgdHdvIGRpZmZlcmVudCBwb3NzaWJsZSBrZXlmcmFtZXMsIG9uZXMgd2hpY2ggYXJlIHF1b3RlZCBvciBvbmVzIHdoaWNoIGFyZSB2YWxpZCBjc3NcbiAgICogaWRlbnRzIChjdXN0b20gcHJvcGVydGllcyBleGNsdWRlZClcbiAgICogIC0gKD89WyxcXHM7XXwkKVxuICAgKiAgICBzaW1wbHkgbWF0Y2hlcyB0aGUgZW5kIG9mIHRoZSBwb3NzaWJsZSBrZXlmcmFtZSwgdmFsaWQgZW5kaW5ncyBhcmU6IGEgY29tbWEsIGEgc3BhY2UsIGFcbiAgICogc2VtaWNvbG9uIG9yIHRoZSBlbmQgb2YgdGhlIHN0cmluZ1xuICAgKi9cbiAgcHJpdmF0ZSBfYW5pbWF0aW9uRGVjbGFyYXRpb25LZXlmcmFtZXNSZSA9XG4gICAgICAvKF58XFxzKykoPzooPzooWydcIl0pKCg/OlxcXFxcXFxcfFxcXFxcXDJ8KD8hXFwyKS4pKylcXDIpfCgtP1tBLVphLXpdW1xcd1xcLV0qKSkoPz1bLFxcc118JCkvZztcblxuICAvKipcbiAgICogU2NvcGUgYW4gYW5pbWF0aW9uIHJ1bGUgc28gdGhhdCB0aGUga2V5ZnJhbWVzIG1lbnRpb25lZCBpbiBzdWNoIHJ1bGVcbiAgICogYXJlIHNjb3BlZCBpZiBkZWZpbmVkIGluIHRoZSBjb21wb25lbnQncyBjc3MgYW5kIGxlZnQgdW50b3VjaGVkIG90aGVyd2lzZS5cbiAgICpcbiAgICogSXQgY2FuIHNjb3BlIHZhbHVlcyBvZiBib3RoIHRoZSAnYW5pbWF0aW9uJyBhbmQgJ2FuaW1hdGlvbi1uYW1lJyBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBAcGFyYW0gcnVsZSBjc3MgcnVsZSB0byBzY29wZS5cbiAgICogQHBhcmFtIHNjb3BlU2VsZWN0b3IgdGhlIGNvbXBvbmVudCdzIHNjb3BlIHNlbGVjdG9yLlxuICAgKiBAcGFyYW0gdW5zY29wZWRLZXlmcmFtZXNTZXQgdGhlIHNldCBvZiB1bnNjb3BlZCBrZXlmcmFtZXMgbmFtZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHRoZSB1cGRhdGVkIGNzcyBydWxlLlxuICAgKiovXG4gIHByaXZhdGUgX3Njb3BlQW5pbWF0aW9uUnVsZShcbiAgICAgIHJ1bGU6IENzc1J1bGUsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgdW5zY29wZWRLZXlmcmFtZXNTZXQ6IFJlYWRvbmx5U2V0PHN0cmluZz4pOiBDc3NSdWxlIHtcbiAgICBsZXQgY29udGVudCA9IHJ1bGUuY29udGVudC5yZXBsYWNlKFxuICAgICAgICAvKCg/Ol58XFxzK3w7KSg/Oi13ZWJraXQtKT9hbmltYXRpb24oPzpcXHMqKTooPzpcXHMqKSkoW147XSspL2csXG4gICAgICAgIChfLCBzdGFydCwgYW5pbWF0aW9uRGVjbGFyYXRpb25zKSA9PiBzdGFydCArXG4gICAgICAgICAgICBhbmltYXRpb25EZWNsYXJhdGlvbnMucmVwbGFjZShcbiAgICAgICAgICAgICAgICB0aGlzLl9hbmltYXRpb25EZWNsYXJhdGlvbktleWZyYW1lc1JlLFxuICAgICAgICAgICAgICAgIChvcmlnaW5hbDogc3RyaW5nLCBsZWFkaW5nU3BhY2VzOiBzdHJpbmcsIHF1b3RlID0gJycsIHF1b3RlZE5hbWU6IHN0cmluZyxcbiAgICAgICAgICAgICAgICAgbm9uUXVvdGVkTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAocXVvdGVkTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYCR7bGVhZGluZ1NwYWNlc30ke1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NvcGVBbmltYXRpb25LZXlmcmFtZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHtxdW90ZX0ke3F1b3RlZE5hbWV9JHtxdW90ZX1gLCBzY29wZVNlbGVjdG9yLCB1bnNjb3BlZEtleWZyYW1lc1NldCl9YDtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhbmltYXRpb25LZXl3b3Jkcy5oYXMobm9uUXVvdGVkTmFtZSkgP1xuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWwgOlxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7bGVhZGluZ1NwYWNlc30ke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Njb3BlQW5pbWF0aW9uS2V5ZnJhbWUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vblF1b3RlZE5hbWUsIHNjb3BlU2VsZWN0b3IsIHVuc2NvcGVkS2V5ZnJhbWVzU2V0KX1gO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKFxuICAgICAgICAvKCg/Ol58XFxzK3w7KSg/Oi13ZWJraXQtKT9hbmltYXRpb24tbmFtZSg/OlxccyopOig/OlxccyopKShbXjtdKykvZyxcbiAgICAgICAgKF9tYXRjaCwgc3RhcnQsIGNvbW1hU2VwYXJhdGVkS2V5ZnJhbWVzKSA9PiBgJHtzdGFydH0ke1xuICAgICAgICAgICAgY29tbWFTZXBhcmF0ZWRLZXlmcmFtZXMuc3BsaXQoJywnKVxuICAgICAgICAgICAgICAgIC5tYXAoXG4gICAgICAgICAgICAgICAgICAgIChrZXlmcmFtZTogc3RyaW5nKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NvcGVBbmltYXRpb25LZXlmcmFtZShrZXlmcmFtZSwgc2NvcGVTZWxlY3RvciwgdW5zY29wZWRLZXlmcmFtZXNTZXQpKVxuICAgICAgICAgICAgICAgIC5qb2luKCcsJyl9YCk7XG4gICAgcmV0dXJuIHsuLi5ydWxlLCBjb250ZW50fTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGNvbnZlcnQgbmF0aXZlIFNoYWRvd0RPTSBydWxlcyB0aGF0IHdpbGwgdHJpcFxuICAgKiB1cCB0aGUgY3NzIHBhcnNlcjsgd2UgcmVseSBvbiBkZWNvcmF0aW5nIHRoZSBzdHlsZXNoZWV0IHdpdGggaW5lcnQgcnVsZXMuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLCB3ZSBjb252ZXJ0IHRoaXMgcnVsZTpcbiAgICpcbiAgICogcG9seWZpbGwtbmV4dC1zZWxlY3RvciB7IGNvbnRlbnQ6ICc6aG9zdCBtZW51LWl0ZW0nOyB9XG4gICAqIDo6Y29udGVudCBtZW51LWl0ZW0ge1xuICAgKlxuICAgKiB0byB0aGlzOlxuICAgKlxuICAgKiBzY29wZU5hbWUgbWVudS1pdGVtIHtcbiAgICpcbiAgICoqL1xuICBwcml2YXRlIF9pbnNlcnRQb2x5ZmlsbERpcmVjdGl2ZXNJbkNzc1RleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY3NzVGV4dC5yZXBsYWNlKF9jc3NDb250ZW50TmV4dFNlbGVjdG9yUmUsIGZ1bmN0aW9uKC4uLm06IHN0cmluZ1tdKSB7XG4gICAgICByZXR1cm4gbVsyXSArICd7JztcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBydWxlcyB3aGljaCB3aWxsIG9ubHkgYXBwbHkgdW5kZXIgdGhlIHBvbHlmaWxsXG4gICAqXG4gICAqIEZvciBleGFtcGxlLCB3ZSBjb252ZXJ0IHRoaXMgcnVsZTpcbiAgICpcbiAgICogcG9seWZpbGwtcnVsZSB7XG4gICAqICAgY29udGVudDogJzpob3N0IG1lbnUtaXRlbSc7XG4gICAqIC4uLlxuICAgKiB9XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIHNjb3BlTmFtZSBtZW51LWl0ZW0gey4uLn1cbiAgICpcbiAgICoqL1xuICBwcml2YXRlIF9pbnNlcnRQb2x5ZmlsbFJ1bGVzSW5Dc3NUZXh0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGNzc1RleHQucmVwbGFjZShfY3NzQ29udGVudFJ1bGVSZSwgKC4uLm06IHN0cmluZ1tdKSA9PiB7XG4gICAgICBjb25zdCBydWxlID0gbVswXS5yZXBsYWNlKG1bMV0sICcnKS5yZXBsYWNlKG1bMl0sICcnKTtcbiAgICAgIHJldHVybiBtWzRdICsgcnVsZTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qIEVuc3VyZSBzdHlsZXMgYXJlIHNjb3BlZC4gUHNldWRvLXNjb3BpbmcgdGFrZXMgYSBydWxlIGxpa2U6XG4gICAqXG4gICAqICAuZm9vIHsuLi4gfVxuICAgKlxuICAgKiAgYW5kIGNvbnZlcnRzIHRoaXMgdG9cbiAgICpcbiAgICogIHNjb3BlTmFtZSAuZm9vIHsgLi4uIH1cbiAgICovXG4gIHByaXZhdGUgX3Njb3BlQ3NzVGV4dChjc3NUZXh0OiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVuc2NvcGVkUnVsZXMgPSB0aGlzLl9leHRyYWN0VW5zY29wZWRSdWxlc0Zyb21Dc3NUZXh0KGNzc1RleHQpO1xuICAgIC8vIHJlcGxhY2UgOmhvc3QgYW5kIDpob3N0LWNvbnRleHQgLXNoYWRvd2Nzc2hvc3QgYW5kIC1zaGFkb3djc3Nob3N0IHJlc3BlY3RpdmVseVxuICAgIGNzc1RleHQgPSB0aGlzLl9pbnNlcnRQb2x5ZmlsbEhvc3RJbkNzc1RleHQoY3NzVGV4dCk7XG4gICAgY3NzVGV4dCA9IHRoaXMuX2NvbnZlcnRDb2xvbkhvc3QoY3NzVGV4dCk7XG4gICAgY3NzVGV4dCA9IHRoaXMuX2NvbnZlcnRDb2xvbkhvc3RDb250ZXh0KGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9jb252ZXJ0U2hhZG93RE9NU2VsZWN0b3JzKGNzc1RleHQpO1xuICAgIGlmIChzY29wZVNlbGVjdG9yKSB7XG4gICAgICBjc3NUZXh0ID0gdGhpcy5fc2NvcGVLZXlmcmFtZXNSZWxhdGVkQ3NzKGNzc1RleHQsIHNjb3BlU2VsZWN0b3IpO1xuICAgICAgY3NzVGV4dCA9IHRoaXMuX3Njb3BlU2VsZWN0b3JzKGNzc1RleHQsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgfVxuICAgIGNzc1RleHQgPSBjc3NUZXh0ICsgJ1xcbicgKyB1bnNjb3BlZFJ1bGVzO1xuICAgIHJldHVybiBjc3NUZXh0LnRyaW0oKTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBydWxlcyB3aGljaCB3aWxsIG9ubHkgYXBwbHkgdW5kZXIgdGhlIHBvbHlmaWxsXG4gICAqIGFuZCBkbyBub3QgcHJvY2VzcyB2aWEgQ1NTT00uIChDU1NPTSBpcyBkZXN0cnVjdGl2ZSB0byBydWxlcyBvbiByYXJlXG4gICAqIG9jY2FzaW9ucywgZS5nLiAtd2Via2l0LWNhbGMgb24gU2FmYXJpLilcbiAgICogRm9yIGV4YW1wbGUsIHdlIGNvbnZlcnQgdGhpcyBydWxlOlxuICAgKlxuICAgKiBAcG9seWZpbGwtdW5zY29wZWQtcnVsZSB7XG4gICAqICAgY29udGVudDogJ21lbnUtaXRlbSc7XG4gICAqIC4uLiB9XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIG1lbnUtaXRlbSB7Li4ufVxuICAgKlxuICAgKiovXG4gIHByaXZhdGUgX2V4dHJhY3RVbnNjb3BlZFJ1bGVzRnJvbUNzc1RleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgciA9ICcnO1xuICAgIGxldCBtOiBSZWdFeHBFeGVjQXJyYXl8bnVsbDtcbiAgICBfY3NzQ29udGVudFVuc2NvcGVkUnVsZVJlLmxhc3RJbmRleCA9IDA7XG4gICAgd2hpbGUgKChtID0gX2Nzc0NvbnRlbnRVbnNjb3BlZFJ1bGVSZS5leGVjKGNzc1RleHQpKSAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcnVsZSA9IG1bMF0ucmVwbGFjZShtWzJdLCAnJykucmVwbGFjZShtWzFdLCBtWzRdKTtcbiAgICAgIHIgKz0gcnVsZSArICdcXG5cXG4nO1xuICAgIH1cbiAgICByZXR1cm4gcjtcbiAgfVxuXG4gIC8qXG4gICAqIGNvbnZlcnQgYSBydWxlIGxpa2UgOmhvc3QoLmZvbykgPiAuYmFyIHsgfVxuICAgKlxuICAgKiB0b1xuICAgKlxuICAgKiAuZm9vPHNjb3BlTmFtZT4gPiAuYmFyXG4gICAqL1xuICBwcml2YXRlIF9jb252ZXJ0Q29sb25Ib3N0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGNzc1RleHQucmVwbGFjZShfY3NzQ29sb25Ib3N0UmUsIChfLCBob3N0U2VsZWN0b3JzOiBzdHJpbmcsIG90aGVyU2VsZWN0b3JzOiBzdHJpbmcpID0+IHtcbiAgICAgIGlmIChob3N0U2VsZWN0b3JzKSB7XG4gICAgICAgIGNvbnN0IGNvbnZlcnRlZFNlbGVjdG9yczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgaG9zdFNlbGVjdG9yQXJyYXkgPSBob3N0U2VsZWN0b3JzLnNwbGl0KCcsJykubWFwKChwKSA9PiBwLnRyaW0oKSk7XG4gICAgICAgIGZvciAoY29uc3QgaG9zdFNlbGVjdG9yIG9mIGhvc3RTZWxlY3RvckFycmF5KSB7XG4gICAgICAgICAgaWYgKCFob3N0U2VsZWN0b3IpIGJyZWFrO1xuICAgICAgICAgIGNvbnN0IGNvbnZlcnRlZFNlbGVjdG9yID1cbiAgICAgICAgICAgICAgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvciArIGhvc3RTZWxlY3Rvci5yZXBsYWNlKF9wb2x5ZmlsbEhvc3QsICcnKSArIG90aGVyU2VsZWN0b3JzO1xuICAgICAgICAgIGNvbnZlcnRlZFNlbGVjdG9ycy5wdXNoKGNvbnZlcnRlZFNlbGVjdG9yKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udmVydGVkU2VsZWN0b3JzLmpvaW4oJywnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yICsgb3RoZXJTZWxlY3RvcnM7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBjb252ZXJ0IGEgcnVsZSBsaWtlIDpob3N0LWNvbnRleHQoLmZvbykgPiAuYmFyIHsgfVxuICAgKlxuICAgKiB0b1xuICAgKlxuICAgKiAuZm9vPHNjb3BlTmFtZT4gPiAuYmFyLCAuZm9vIDxzY29wZU5hbWU+ID4gLmJhciB7IH1cbiAgICpcbiAgICogYW5kXG4gICAqXG4gICAqIDpob3N0LWNvbnRleHQoLmZvbzpob3N0KSAuYmFyIHsgLi4uIH1cbiAgICpcbiAgICogdG9cbiAgICpcbiAgICogLmZvbzxzY29wZU5hbWU+IC5iYXIgeyAuLi4gfVxuICAgKi9cbiAgcHJpdmF0ZSBfY29udmVydENvbG9uSG9zdENvbnRleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY3NzVGV4dC5yZXBsYWNlKF9jc3NDb2xvbkhvc3RDb250ZXh0UmVHbG9iYWwsIChzZWxlY3RvclRleHQpID0+IHtcbiAgICAgIC8vIFdlIGhhdmUgY2FwdHVyZWQgYSBzZWxlY3RvciB0aGF0IGNvbnRhaW5zIGEgYDpob3N0LWNvbnRleHRgIHJ1bGUuXG5cbiAgICAgIC8vIEZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGA6aG9zdC1jb250ZXh0YCBtYXkgY29udGFpbiBhIGNvbW1hIHNlcGFyYXRlZCBsaXN0IG9mIHNlbGVjdG9ycy5cbiAgICAgIC8vIEVhY2ggY29udGV4dCBzZWxlY3RvciBncm91cCB3aWxsIGNvbnRhaW4gYSBsaXN0IG9mIGhvc3QtY29udGV4dCBzZWxlY3RvcnMgdGhhdCBtdXN0IG1hdGNoXG4gICAgICAvLyBhbiBhbmNlc3RvciBvZiB0aGUgaG9zdC5cbiAgICAgIC8vIChOb3JtYWxseSBgY29udGV4dFNlbGVjdG9yR3JvdXBzYCB3aWxsIG9ubHkgY29udGFpbiBhIHNpbmdsZSBhcnJheSBvZiBjb250ZXh0IHNlbGVjdG9ycy4pXG4gICAgICBjb25zdCBjb250ZXh0U2VsZWN0b3JHcm91cHM6IHN0cmluZ1tdW10gPSBbW11dO1xuXG4gICAgICAvLyBUaGVyZSBtYXkgYmUgbW9yZSB0aGFuIGA6aG9zdC1jb250ZXh0YCBpbiB0aGlzIHNlbGVjdG9yIHNvIGBzZWxlY3RvclRleHRgIGNvdWxkIGxvb2sgbGlrZTpcbiAgICAgIC8vIGA6aG9zdC1jb250ZXh0KC5vbmUpOmhvc3QtY29udGV4dCgudHdvKWAuXG4gICAgICAvLyBFeGVjdXRlIGBfY3NzQ29sb25Ib3N0Q29udGV4dFJlYCBvdmVyIGFuZCBvdmVyIHVudGlsIHdlIGhhdmUgZXh0cmFjdGVkIGFsbCB0aGVcbiAgICAgIC8vIGA6aG9zdC1jb250ZXh0YCBzZWxlY3RvcnMgZnJvbSB0aGlzIHNlbGVjdG9yLlxuICAgICAgbGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXl8bnVsbDtcbiAgICAgIHdoaWxlICgobWF0Y2ggPSBfY3NzQ29sb25Ib3N0Q29udGV4dFJlLmV4ZWMoc2VsZWN0b3JUZXh0KSkpIHtcbiAgICAgICAgLy8gYG1hdGNoYCA9IFsnOmhvc3QtY29udGV4dCg8c2VsZWN0b3JzPik8cmVzdD4nLCA8c2VsZWN0b3JzPiwgPHJlc3Q+XVxuXG4gICAgICAgIC8vIFRoZSBgPHNlbGVjdG9ycz5gIGNvdWxkIGFjdHVhbGx5IGJlIGEgY29tbWEgc2VwYXJhdGVkIGxpc3Q6IGA6aG9zdC1jb250ZXh0KC5vbmUsIC50d28pYC5cbiAgICAgICAgY29uc3QgbmV3Q29udGV4dFNlbGVjdG9ycyA9XG4gICAgICAgICAgICAobWF0Y2hbMV0gPz8gJycpLnRyaW0oKS5zcGxpdCgnLCcpLm1hcCgobSkgPT4gbS50cmltKCkpLmZpbHRlcigobSkgPT4gbSAhPT0gJycpO1xuXG4gICAgICAgIC8vIFdlIG11c3QgZHVwbGljYXRlIHRoZSBjdXJyZW50IHNlbGVjdG9yIGdyb3VwIGZvciBlYWNoIG9mIHRoZXNlIG5ldyBzZWxlY3RvcnMuXG4gICAgICAgIC8vIEZvciBleGFtcGxlIGlmIHRoZSBjdXJyZW50IGdyb3VwcyBhcmU6XG4gICAgICAgIC8vIGBgYFxuICAgICAgICAvLyBbXG4gICAgICAgIC8vICAgWydhJywgJ2InLCAnYyddLFxuICAgICAgICAvLyAgIFsneCcsICd5JywgJ3onXSxcbiAgICAgICAgLy8gXVxuICAgICAgICAvLyBgYGBcbiAgICAgICAgLy8gQW5kIHdlIGhhdmUgYSBuZXcgc2V0IG9mIGNvbW1hIHNlcGFyYXRlZCBzZWxlY3RvcnM6IGA6aG9zdC1jb250ZXh0KG0sbilgIHRoZW4gdGhlIG5ld1xuICAgICAgICAvLyBncm91cHMgYXJlOlxuICAgICAgICAvLyBgYGBcbiAgICAgICAgLy8gW1xuICAgICAgICAvLyAgIFsnYScsICdiJywgJ2MnLCAnbSddLFxuICAgICAgICAvLyAgIFsneCcsICd5JywgJ3onLCAnbSddLFxuICAgICAgICAvLyAgIFsnYScsICdiJywgJ2MnLCAnbiddLFxuICAgICAgICAvLyAgIFsneCcsICd5JywgJ3onLCAnbiddLFxuICAgICAgICAvLyBdXG4gICAgICAgIC8vIGBgYFxuICAgICAgICBjb25zdCBjb250ZXh0U2VsZWN0b3JHcm91cHNMZW5ndGggPSBjb250ZXh0U2VsZWN0b3JHcm91cHMubGVuZ3RoO1xuICAgICAgICByZXBlYXRHcm91cHMoY29udGV4dFNlbGVjdG9yR3JvdXBzLCBuZXdDb250ZXh0U2VsZWN0b3JzLmxlbmd0aCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmV3Q29udGV4dFNlbGVjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY29udGV4dFNlbGVjdG9yR3JvdXBzTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnRleHRTZWxlY3Rvckdyb3Vwc1tqICsgaSAqIGNvbnRleHRTZWxlY3Rvckdyb3Vwc0xlbmd0aF0ucHVzaChuZXdDb250ZXh0U2VsZWN0b3JzW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgdGhlIGBzZWxlY3RvclRleHRgIGFuZCBzZWUgcmVwZWF0IHRvIHNlZSBpZiB0aGVyZSBhcmUgbW9yZSBgOmhvc3QtY29udGV4dGBzLlxuICAgICAgICBzZWxlY3RvclRleHQgPSBtYXRjaFsyXTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGNvbnRleHQgc2VsZWN0b3JzIG5vdyBtdXN0IGJlIGNvbWJpbmVkIHdpdGggZWFjaCBvdGhlciB0byBjYXB0dXJlIGFsbCB0aGUgcG9zc2libGVcbiAgICAgIC8vIHNlbGVjdG9ycyB0aGF0IGA6aG9zdC1jb250ZXh0YCBjYW4gbWF0Y2guIFNlZSBgY29tYmluZUhvc3RDb250ZXh0U2VsZWN0b3JzKClgIGZvciBtb3JlXG4gICAgICAvLyBpbmZvIGFib3V0IGhvdyB0aGlzIGlzIGRvbmUuXG4gICAgICByZXR1cm4gY29udGV4dFNlbGVjdG9yR3JvdXBzXG4gICAgICAgICAgLm1hcCgoY29udGV4dFNlbGVjdG9ycykgPT4gY29tYmluZUhvc3RDb250ZXh0U2VsZWN0b3JzKGNvbnRleHRTZWxlY3RvcnMsIHNlbGVjdG9yVGV4dCkpXG4gICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBDb252ZXJ0IGNvbWJpbmF0b3JzIGxpa2UgOjpzaGFkb3cgYW5kIHBzZXVkby1lbGVtZW50cyBsaWtlIDo6Y29udGVudFxuICAgKiBieSByZXBsYWNpbmcgd2l0aCBzcGFjZS5cbiAgICovXG4gIHByaXZhdGUgX2NvbnZlcnRTaGFkb3dET01TZWxlY3RvcnMoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gX3NoYWRvd0RPTVNlbGVjdG9yc1JlLnJlZHVjZSgocmVzdWx0LCBwYXR0ZXJuKSA9PiByZXN1bHQucmVwbGFjZShwYXR0ZXJuLCAnICcpLCBjc3NUZXh0KTtcbiAgfVxuXG4gIC8vIGNoYW5nZSBhIHNlbGVjdG9yIGxpa2UgJ2RpdicgdG8gJ25hbWUgZGl2J1xuICBwcml2YXRlIF9zY29wZVNlbGVjdG9ycyhjc3NUZXh0OiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBwcm9jZXNzUnVsZXMoY3NzVGV4dCwgKHJ1bGU6IENzc1J1bGUpID0+IHtcbiAgICAgIGxldCBzZWxlY3RvciA9IHJ1bGUuc2VsZWN0b3I7XG4gICAgICBsZXQgY29udGVudCA9IHJ1bGUuY29udGVudDtcbiAgICAgIGlmIChydWxlLnNlbGVjdG9yWzBdICE9PSAnQCcpIHtcbiAgICAgICAgc2VsZWN0b3IgPSB0aGlzLl9zY29wZVNlbGVjdG9yKHJ1bGUuc2VsZWN0b3IsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgICB9IGVsc2UgaWYgKHNjb3BlZEF0UnVsZUlkZW50aWZpZXJzLnNvbWUoYXRSdWxlID0+IHJ1bGUuc2VsZWN0b3Iuc3RhcnRzV2l0aChhdFJ1bGUpKSkge1xuICAgICAgICBjb250ZW50ID0gdGhpcy5fc2NvcGVTZWxlY3RvcnMocnVsZS5jb250ZW50LCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICAgICAgfSBlbHNlIGlmIChydWxlLnNlbGVjdG9yLnN0YXJ0c1dpdGgoJ0Bmb250LWZhY2UnKSB8fCBydWxlLnNlbGVjdG9yLnN0YXJ0c1dpdGgoJ0BwYWdlJykpIHtcbiAgICAgICAgY29udGVudCA9IHRoaXMuX3N0cmlwU2NvcGluZ1NlbGVjdG9ycyhydWxlLmNvbnRlbnQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBDc3NSdWxlKHNlbGVjdG9yLCBjb250ZW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgYSBjc3MgdGV4dCB0aGF0IGlzIHdpdGhpbiBhIHJ1bGUgdGhhdCBzaG91bGQgbm90IGNvbnRhaW4gc2NvcGUgc2VsZWN0b3JzIGJ5IHNpbXBseVxuICAgKiByZW1vdmluZyB0aGVtISBBbiBleGFtcGxlIG9mIHN1Y2ggYSBydWxlIGlzIGBAZm9udC1mYWNlYC5cbiAgICpcbiAgICogYEBmb250LWZhY2VgIHJ1bGVzIGNhbm5vdCBjb250YWluIG5lc3RlZCBzZWxlY3RvcnMuIE5vciBjYW4gdGhleSBiZSBuZXN0ZWQgdW5kZXIgYSBzZWxlY3Rvci5cbiAgICogTm9ybWFsbHkgdGhpcyB3b3VsZCBiZSBhIHN5bnRheCBlcnJvciBieSB0aGUgYXV0aG9yIG9mIHRoZSBzdHlsZXMuIEJ1dCBpbiBzb21lIHJhcmUgY2FzZXMsIHN1Y2hcbiAgICogYXMgaW1wb3J0aW5nIHN0eWxlcyBmcm9tIGEgbGlicmFyeSwgYW5kIGFwcGx5aW5nIGA6aG9zdCA6Om5nLWRlZXBgIHRvIHRoZSBpbXBvcnRlZCBzdHlsZXMsIHdlXG4gICAqIGNhbiBlbmQgdXAgd2l0aCBicm9rZW4gY3NzIGlmIHRoZSBpbXBvcnRlZCBzdHlsZXMgaGFwcGVuIHRvIGNvbnRhaW4gQGZvbnQtZmFjZSBydWxlcy5cbiAgICpcbiAgICogRm9yIGV4YW1wbGU6XG4gICAqXG4gICAqIGBgYFxuICAgKiA6aG9zdCA6Om5nLWRlZXAge1xuICAgKiAgIGltcG9ydCAnc29tZS9saWIvY29udGFpbmluZy9mb250LWZhY2UnO1xuICAgKiB9XG4gICAqXG4gICAqIFNpbWlsYXIgbG9naWMgYXBwbGllcyB0byBgQHBhZ2VgIHJ1bGVzIHdoaWNoIGNhbiBjb250YWluIGEgcGFydGljdWxhciBzZXQgb2YgcHJvcGVydGllcyxcbiAgICogYXMgd2VsbCBhcyBzb21lIHNwZWNpZmljIGF0LXJ1bGVzLiBTaW5jZSB0aGV5IGNhbid0IGJlIGVuY2Fwc3VsYXRlZCwgd2UgaGF2ZSB0byBzdHJpcFxuICAgKiBhbnkgc2NvcGluZyBzZWxlY3RvcnMgZnJvbSB0aGVtLiBGb3IgbW9yZSBpbmZvcm1hdGlvbjogaHR0cHM6Ly93d3cudzMub3JnL1RSL2Nzcy1wYWdlLTNcbiAgICogYGBgXG4gICAqL1xuICBwcml2YXRlIF9zdHJpcFNjb3BpbmdTZWxlY3RvcnMoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcHJvY2Vzc1J1bGVzKGNzc1RleHQsIChydWxlKSA9PiB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IHJ1bGUuc2VsZWN0b3IucmVwbGFjZShfc2hhZG93RGVlcFNlbGVjdG9ycywgJyAnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvclJlLCAnICcpO1xuICAgICAgcmV0dXJuIG5ldyBDc3NSdWxlKHNlbGVjdG9yLCBydWxlLmNvbnRlbnQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfc2NvcGVTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gc2VsZWN0b3Iuc3BsaXQoJywnKVxuICAgICAgICAubWFwKChwYXJ0KSA9PiBwYXJ0LnRyaW0oKS5zcGxpdChfc2hhZG93RGVlcFNlbGVjdG9ycykpXG4gICAgICAgIC5tYXAoKGRlZXBQYXJ0cykgPT4ge1xuICAgICAgICAgIGNvbnN0IFtzaGFsbG93UGFydCwgLi4ub3RoZXJQYXJ0c10gPSBkZWVwUGFydHM7XG4gICAgICAgICAgY29uc3QgYXBwbHlTY29wZSA9IChzaGFsbG93UGFydDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2VsZWN0b3JOZWVkc1Njb3Bpbmcoc2hhbGxvd1BhcnQsIHNjb3BlU2VsZWN0b3IpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hcHBseVNlbGVjdG9yU2NvcGUoc2hhbGxvd1BhcnQsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gc2hhbGxvd1BhcnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXR1cm4gW2FwcGx5U2NvcGUoc2hhbGxvd1BhcnQpLCAuLi5vdGhlclBhcnRzXS5qb2luKCcgJyk7XG4gICAgICAgIH0pXG4gICAgICAgIC5qb2luKCcsICcpO1xuICB9XG5cbiAgcHJpdmF0ZSBfc2VsZWN0b3JOZWVkc1Njb3Bpbmcoc2VsZWN0b3I6IHN0cmluZywgc2NvcGVTZWxlY3Rvcjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgcmUgPSB0aGlzLl9tYWtlU2NvcGVNYXRjaGVyKHNjb3BlU2VsZWN0b3IpO1xuICAgIHJldHVybiAhcmUudGVzdChzZWxlY3Rvcik7XG4gIH1cblxuICBwcml2YXRlIF9tYWtlU2NvcGVNYXRjaGVyKHNjb3BlU2VsZWN0b3I6IHN0cmluZyk6IFJlZ0V4cCB7XG4gICAgY29uc3QgbHJlID0gL1xcWy9nO1xuICAgIGNvbnN0IHJyZSA9IC9cXF0vZztcbiAgICBzY29wZVNlbGVjdG9yID0gc2NvcGVTZWxlY3Rvci5yZXBsYWNlKGxyZSwgJ1xcXFxbJykucmVwbGFjZShycmUsICdcXFxcXScpO1xuICAgIHJldHVybiBuZXcgUmVnRXhwKCdeKCcgKyBzY29wZVNlbGVjdG9yICsgJyknICsgX3NlbGVjdG9yUmVTdWZmaXgsICdtJyk7XG4gIH1cblxuICAvLyBzY29wZSB2aWEgbmFtZSBhbmQgW2lzPW5hbWVdXG4gIHByaXZhdGUgX2FwcGx5U2ltcGxlU2VsZWN0b3JTY29wZShzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTpcbiAgICAgIHN0cmluZyB7XG4gICAgLy8gSW4gQW5kcm9pZCBicm93c2VyLCB0aGUgbGFzdEluZGV4IGlzIG5vdCByZXNldCB3aGVuIHRoZSByZWdleCBpcyB1c2VkIGluIFN0cmluZy5yZXBsYWNlKClcbiAgICBfcG9seWZpbGxIb3N0UmUubGFzdEluZGV4ID0gMDtcbiAgICBpZiAoX3BvbHlmaWxsSG9zdFJlLnRlc3Qoc2VsZWN0b3IpKSB7XG4gICAgICBjb25zdCByZXBsYWNlQnkgPSBgWyR7aG9zdFNlbGVjdG9yfV1gO1xuICAgICAgcmV0dXJuIHNlbGVjdG9yXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAgIF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3JSZSxcbiAgICAgICAgICAgICAgKGhuYywgc2VsZWN0b3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZWN0b3IucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgLyhbXjpdKikoOiopKC4qKS8sXG4gICAgICAgICAgICAgICAgICAgIChfOiBzdHJpbmcsIGJlZm9yZTogc3RyaW5nLCBjb2xvbjogc3RyaW5nLCBhZnRlcjogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJlZm9yZSArIHJlcGxhY2VCeSArIGNvbG9uICsgYWZ0ZXI7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgIC5yZXBsYWNlKF9wb2x5ZmlsbEhvc3RSZSwgcmVwbGFjZUJ5ICsgJyAnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2NvcGVTZWxlY3RvciArICcgJyArIHNlbGVjdG9yO1xuICB9XG5cbiAgLy8gcmV0dXJuIGEgc2VsZWN0b3Igd2l0aCBbbmFtZV0gc3VmZml4IG9uIGVhY2ggc2ltcGxlIHNlbGVjdG9yXG4gIC8vIGUuZy4gLmZvby5iYXIgPiAuem90IGJlY29tZXMgLmZvb1tuYW1lXS5iYXJbbmFtZV0gPiAuem90W25hbWVdICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2FwcGx5U2VsZWN0b3JTY29wZShzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTpcbiAgICAgIHN0cmluZyB7XG4gICAgY29uc3QgaXNSZSA9IC9cXFtpcz0oW15cXF1dKilcXF0vZztcbiAgICBzY29wZVNlbGVjdG9yID0gc2NvcGVTZWxlY3Rvci5yZXBsYWNlKGlzUmUsIChfOiBzdHJpbmcsIC4uLnBhcnRzOiBzdHJpbmdbXSkgPT4gcGFydHNbMF0pO1xuXG4gICAgY29uc3QgYXR0ck5hbWUgPSAnWycgKyBzY29wZVNlbGVjdG9yICsgJ10nO1xuXG4gICAgY29uc3QgX3Njb3BlU2VsZWN0b3JQYXJ0ID0gKHA6IHN0cmluZykgPT4ge1xuICAgICAgbGV0IHNjb3BlZFAgPSBwLnRyaW0oKTtcblxuICAgICAgaWYgKCFzY29wZWRQKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICAgIH1cblxuICAgICAgaWYgKHAuaW5kZXhPZihfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yKSA+IC0xKSB7XG4gICAgICAgIHNjb3BlZFAgPSB0aGlzLl9hcHBseVNpbXBsZVNlbGVjdG9yU2NvcGUocCwgc2NvcGVTZWxlY3RvciwgaG9zdFNlbGVjdG9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHJlbW92ZSA6aG9zdCBzaW5jZSBpdCBzaG91bGQgYmUgdW5uZWNlc3NhcnlcbiAgICAgICAgY29uc3QgdCA9IHAucmVwbGFjZShfcG9seWZpbGxIb3N0UmUsICcnKTtcbiAgICAgICAgaWYgKHQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSB0Lm1hdGNoKC8oW146XSopKDoqKSguKikvKTtcbiAgICAgICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICAgICAgc2NvcGVkUCA9IG1hdGNoZXNbMV0gKyBhdHRyTmFtZSArIG1hdGNoZXNbMl0gKyBtYXRjaGVzWzNdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2NvcGVkUDtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2FmZUNvbnRlbnQgPSBuZXcgU2FmZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICBzZWxlY3RvciA9IHNhZmVDb250ZW50LmNvbnRlbnQoKTtcblxuICAgIGxldCBzY29wZWRTZWxlY3RvciA9ICcnO1xuICAgIGxldCBzdGFydEluZGV4ID0gMDtcbiAgICBsZXQgcmVzOiBSZWdFeHBFeGVjQXJyYXl8bnVsbDtcbiAgICBjb25zdCBzZXAgPSAvKCB8PnxcXCt8fig/IT0pKVxccyovZztcblxuICAgIC8vIElmIGEgc2VsZWN0b3IgYXBwZWFycyBiZWZvcmUgOmhvc3QgaXQgc2hvdWxkIG5vdCBiZSBzaGltbWVkIGFzIGl0XG4gICAgLy8gbWF0Y2hlcyBvbiBhbmNlc3RvciBlbGVtZW50cyBhbmQgbm90IG9uIGVsZW1lbnRzIGluIHRoZSBob3N0J3Mgc2hhZG93XG4gICAgLy8gYDpob3N0LWNvbnRleHQoZGl2KWAgaXMgdHJhbnNmb3JtZWQgdG9cbiAgICAvLyBgLXNoYWRvd2Nzc2hvc3Qtbm8tY29tYmluYXRvcmRpdiwgZGl2IC1zaGFkb3djc3Nob3N0LW5vLWNvbWJpbmF0b3JgXG4gICAgLy8gdGhlIGBkaXZgIGlzIG5vdCBwYXJ0IG9mIHRoZSBjb21wb25lbnQgaW4gdGhlIDJuZCBzZWxlY3RvcnMgYW5kIHNob3VsZCBub3QgYmUgc2NvcGVkLlxuICAgIC8vIEhpc3RvcmljYWxseSBgY29tcG9uZW50LXRhZzpob3N0YCB3YXMgbWF0Y2hpbmcgdGhlIGNvbXBvbmVudCBzbyB3ZSBhbHNvIHdhbnQgdG8gcHJlc2VydmVcbiAgICAvLyB0aGlzIGJlaGF2aW9yIHRvIGF2b2lkIGJyZWFraW5nIGxlZ2FjeSBhcHBzIChpdCBzaG91bGQgbm90IG1hdGNoKS5cbiAgICAvLyBUaGUgYmVoYXZpb3Igc2hvdWxkIGJlOlxuICAgIC8vIC0gYHRhZzpob3N0YCAtPiBgdGFnW2hdYCAodGhpcyBpcyB0byBhdm9pZCBicmVha2luZyBsZWdhY3kgYXBwcywgc2hvdWxkIG5vdCBtYXRjaCBhbnl0aGluZylcbiAgICAvLyAtIGB0YWcgOmhvc3RgIC0+IGB0YWcgW2hdYCAoYHRhZ2AgaXMgbm90IHNjb3BlZCBiZWNhdXNlIGl0J3MgY29uc2lkZXJlZCBwYXJ0IG9mIGFcbiAgICAvLyAgIGA6aG9zdC1jb250ZXh0KHRhZylgKVxuICAgIGNvbnN0IGhhc0hvc3QgPSBzZWxlY3Rvci5pbmRleE9mKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpID4gLTE7XG4gICAgLy8gT25seSBzY29wZSBwYXJ0cyBhZnRlciB0aGUgZmlyc3QgYC1zaGFkb3djc3Nob3N0LW5vLWNvbWJpbmF0b3JgIHdoZW4gaXQgaXMgcHJlc2VudFxuICAgIGxldCBzaG91bGRTY29wZSA9ICFoYXNIb3N0O1xuXG4gICAgd2hpbGUgKChyZXMgPSBzZXAuZXhlYyhzZWxlY3RvcikpICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBzZXBhcmF0b3IgPSByZXNbMV07XG4gICAgICBjb25zdCBwYXJ0ID0gc2VsZWN0b3Iuc2xpY2Uoc3RhcnRJbmRleCwgcmVzLmluZGV4KS50cmltKCk7XG5cbiAgICAgIC8vIEEgc3BhY2UgZm9sbG93aW5nIGFuIGVzY2FwZWQgaGV4IHZhbHVlIGFuZCBmb2xsb3dlZCBieSBhbm90aGVyIGhleCBjaGFyYWN0ZXJcbiAgICAgIC8vIChpZTogXCIuXFxmYyBiZXJcIiBmb3IgXCIuw7xiZXJcIikgaXMgbm90IGEgc2VwYXJhdG9yIGJldHdlZW4gMiBzZWxlY3RvcnNcbiAgICAgIC8vIGFsc28ga2VlcCBpbiBtaW5kIHRoYXQgYmFja3NsYXNoZXMgYXJlIHJlcGxhY2VkIGJ5IGEgcGxhY2Vob2xkZXIgYnkgU2FmZVNlbGVjdG9yXG4gICAgICAvLyBUaGVzZSBlc2NhcGVkIHNlbGVjdG9ycyBoYXBwZW4gZm9yIGV4YW1wbGUgd2hlbiBlc2J1aWxkIHJ1bnMgd2l0aCBvcHRpbWl6YXRpb24ubWluaWZ5LlxuICAgICAgaWYgKHBhcnQubWF0Y2goL19fZXNjLXBoLShcXGQrKV9fLykgJiYgc2VsZWN0b3JbcmVzLmluZGV4ICsgMV0/Lm1hdGNoKC9bYS1mQS1GXFxkXS8pKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBzaG91bGRTY29wZSA9IHNob3VsZFNjb3BlIHx8IHBhcnQuaW5kZXhPZihfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yKSA+IC0xO1xuICAgICAgY29uc3Qgc2NvcGVkUGFydCA9IHNob3VsZFNjb3BlID8gX3Njb3BlU2VsZWN0b3JQYXJ0KHBhcnQpIDogcGFydDtcbiAgICAgIHNjb3BlZFNlbGVjdG9yICs9IGAke3Njb3BlZFBhcnR9ICR7c2VwYXJhdG9yfSBgO1xuICAgICAgc3RhcnRJbmRleCA9IHNlcC5sYXN0SW5kZXg7XG4gICAgfVxuXG4gICAgY29uc3QgcGFydCA9IHNlbGVjdG9yLnN1YnN0cmluZyhzdGFydEluZGV4KTtcbiAgICBzaG91bGRTY29wZSA9IHNob3VsZFNjb3BlIHx8IHBhcnQuaW5kZXhPZihfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yKSA+IC0xO1xuICAgIHNjb3BlZFNlbGVjdG9yICs9IHNob3VsZFNjb3BlID8gX3Njb3BlU2VsZWN0b3JQYXJ0KHBhcnQpIDogcGFydDtcblxuICAgIC8vIHJlcGxhY2UgdGhlIHBsYWNlaG9sZGVycyB3aXRoIHRoZWlyIG9yaWdpbmFsIHZhbHVlc1xuICAgIHJldHVybiBzYWZlQ29udGVudC5yZXN0b3JlKHNjb3BlZFNlbGVjdG9yKTtcbiAgfVxuXG4gIHByaXZhdGUgX2luc2VydFBvbHlmaWxsSG9zdEluQ3NzVGV4dChzZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gc2VsZWN0b3IucmVwbGFjZShfY29sb25Ib3N0Q29udGV4dFJlLCBfcG9seWZpbGxIb3N0Q29udGV4dClcbiAgICAgICAgLnJlcGxhY2UoX2NvbG9uSG9zdFJlLCBfcG9seWZpbGxIb3N0KTtcbiAgfVxufVxuXG5jbGFzcyBTYWZlU2VsZWN0b3Ige1xuICBwcml2YXRlIHBsYWNlaG9sZGVyczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBpbmRleCA9IDA7XG4gIHByaXZhdGUgX2NvbnRlbnQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzZWxlY3Rvcjogc3RyaW5nKSB7XG4gICAgLy8gUmVwbGFjZXMgYXR0cmlidXRlIHNlbGVjdG9ycyB3aXRoIHBsYWNlaG9sZGVycy5cbiAgICAvLyBUaGUgV1MgaW4gW2F0dHI9XCJ2YSBsdWVcIl0gd291bGQgb3RoZXJ3aXNlIGJlIGludGVycHJldGVkIGFzIGEgc2VsZWN0b3Igc2VwYXJhdG9yLlxuICAgIHNlbGVjdG9yID0gdGhpcy5fZXNjYXBlUmVnZXhNYXRjaGVzKHNlbGVjdG9yLCAvKFxcW1teXFxdXSpcXF0pL2cpO1xuXG4gICAgLy8gQ1NTIGFsbG93cyBmb3IgY2VydGFpbiBzcGVjaWFsIGNoYXJhY3RlcnMgdG8gYmUgdXNlZCBpbiBzZWxlY3RvcnMgaWYgdGhleSdyZSBlc2NhcGVkLlxuICAgIC8vIEUuZy4gYC5mb286Ymx1ZWAgd29uJ3QgbWF0Y2ggYSBjbGFzcyBjYWxsZWQgYGZvbzpibHVlYCwgYmVjYXVzZSB0aGUgY29sb24gZGVub3RlcyBhXG4gICAgLy8gcHNldWRvLWNsYXNzLCBidXQgd3JpdGluZyBgLmZvb1xcOmJsdWVgIHdpbGwgbWF0Y2gsIGJlY2F1c2UgdGhlIGNvbG9uIHdhcyBlc2NhcGVkLlxuICAgIC8vIFJlcGxhY2UgYWxsIGVzY2FwZSBzZXF1ZW5jZXMgKGBcXGAgZm9sbG93ZWQgYnkgYSBjaGFyYWN0ZXIpIHdpdGggYSBwbGFjZWhvbGRlciBzb1xuICAgIC8vIHRoYXQgb3VyIGhhbmRsaW5nIG9mIHBzZXVkby1zZWxlY3RvcnMgZG9lc24ndCBtZXNzIHdpdGggdGhlbS5cbiAgICAvLyBFc2NhcGVkIGNoYXJhY3RlcnMgaGF2ZSBhIHNwZWNpZmljIHBsYWNlaG9sZGVyIHNvIHRoZXkgY2FuIGJlIGRldGVjdGVkIHNlcGFyYXRlbHkuXG4gICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5yZXBsYWNlKC8oXFxcXC4pL2csIChfLCBrZWVwKSA9PiB7XG4gICAgICBjb25zdCByZXBsYWNlQnkgPSBgX19lc2MtcGgtJHt0aGlzLmluZGV4fV9fYDtcbiAgICAgIHRoaXMucGxhY2Vob2xkZXJzLnB1c2goa2VlcCk7XG4gICAgICB0aGlzLmluZGV4Kys7XG4gICAgICByZXR1cm4gcmVwbGFjZUJ5O1xuICAgIH0pO1xuXG4gICAgLy8gUmVwbGFjZXMgdGhlIGV4cHJlc3Npb24gaW4gYDpudGgtY2hpbGQoMm4gKyAxKWAgd2l0aCBhIHBsYWNlaG9sZGVyLlxuICAgIC8vIFdTIGFuZCBcIitcIiB3b3VsZCBvdGhlcndpc2UgYmUgaW50ZXJwcmV0ZWQgYXMgc2VsZWN0b3Igc2VwYXJhdG9ycy5cbiAgICB0aGlzLl9jb250ZW50ID0gc2VsZWN0b3IucmVwbGFjZSgvKDpudGgtWy1cXHddKykoXFwoW14pXStcXCkpL2csIChfLCBwc2V1ZG8sIGV4cCkgPT4ge1xuICAgICAgY29uc3QgcmVwbGFjZUJ5ID0gYF9fcGgtJHt0aGlzLmluZGV4fV9fYDtcbiAgICAgIHRoaXMucGxhY2Vob2xkZXJzLnB1c2goZXhwKTtcbiAgICAgIHRoaXMuaW5kZXgrKztcbiAgICAgIHJldHVybiBwc2V1ZG8gKyByZXBsYWNlQnk7XG4gICAgfSk7XG4gIH1cblxuICByZXN0b3JlKGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZSgvX18oPzpwaHxlc2MtcGgpLShcXGQrKV9fL2csIChfcGgsIGluZGV4KSA9PiB0aGlzLnBsYWNlaG9sZGVyc1sraW5kZXhdKTtcbiAgfVxuXG4gIGNvbnRlbnQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fY29udGVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBsYWNlcyBhbGwgb2YgdGhlIHN1YnN0cmluZ3MgdGhhdCBtYXRjaCBhIHJlZ2V4IHdpdGhpbiBhXG4gICAqIHNwZWNpYWwgc3RyaW5nIChlLmcuIGBfX3BoLTBfX2AsIGBfX3BoLTFfX2AsIGV0YykuXG4gICAqL1xuICBwcml2YXRlIF9lc2NhcGVSZWdleE1hdGNoZXMoY29udGVudDogc3RyaW5nLCBwYXR0ZXJuOiBSZWdFeHApOiBzdHJpbmcge1xuICAgIHJldHVybiBjb250ZW50LnJlcGxhY2UocGF0dGVybiwgKF8sIGtlZXApID0+IHtcbiAgICAgIGNvbnN0IHJlcGxhY2VCeSA9IGBfX3BoLSR7dGhpcy5pbmRleH1fX2A7XG4gICAgICB0aGlzLnBsYWNlaG9sZGVycy5wdXNoKGtlZXApO1xuICAgICAgdGhpcy5pbmRleCsrO1xuICAgICAgcmV0dXJuIHJlcGxhY2VCeTtcbiAgICB9KTtcbiAgfVxufVxuXG5jb25zdCBfY3NzQ29udGVudE5leHRTZWxlY3RvclJlID1cbiAgICAvcG9seWZpbGwtbmV4dC1zZWxlY3RvcltefV0qY29udGVudDpbXFxzXSo/KFsnXCJdKSguKj8pXFwxWztcXHNdKn0oW157XSo/KXsvZ2ltO1xuY29uc3QgX2Nzc0NvbnRlbnRSdWxlUmUgPSAvKHBvbHlmaWxsLXJ1bGUpW159XSooY29udGVudDpbXFxzXSooWydcIl0pKC4qPylcXDMpWztcXHNdKltefV0qfS9naW07XG5jb25zdCBfY3NzQ29udGVudFVuc2NvcGVkUnVsZVJlID1cbiAgICAvKHBvbHlmaWxsLXVuc2NvcGVkLXJ1bGUpW159XSooY29udGVudDpbXFxzXSooWydcIl0pKC4qPylcXDMpWztcXHNdKltefV0qfS9naW07XG5jb25zdCBfcG9seWZpbGxIb3N0ID0gJy1zaGFkb3djc3Nob3N0Jztcbi8vIG5vdGU6IDpob3N0LWNvbnRleHQgcHJlLXByb2Nlc3NlZCB0byAtc2hhZG93Y3NzaG9zdGNvbnRleHQuXG5jb25zdCBfcG9seWZpbGxIb3N0Q29udGV4dCA9ICctc2hhZG93Y3NzY29udGV4dCc7XG5jb25zdCBfcGFyZW5TdWZmaXggPSAnKD86XFxcXCgoJyArXG4gICAgJyg/OlxcXFwoW14pKF0qXFxcXCl8W14pKF0qKSs/JyArXG4gICAgJylcXFxcKSk/KFteLHtdKiknO1xuY29uc3QgX2Nzc0NvbG9uSG9zdFJlID0gbmV3IFJlZ0V4cChfcG9seWZpbGxIb3N0ICsgX3BhcmVuU3VmZml4LCAnZ2ltJyk7XG5jb25zdCBfY3NzQ29sb25Ib3N0Q29udGV4dFJlR2xvYmFsID0gbmV3IFJlZ0V4cChfcG9seWZpbGxIb3N0Q29udGV4dCArIF9wYXJlblN1ZmZpeCwgJ2dpbScpO1xuY29uc3QgX2Nzc0NvbG9uSG9zdENvbnRleHRSZSA9IG5ldyBSZWdFeHAoX3BvbHlmaWxsSG9zdENvbnRleHQgKyBfcGFyZW5TdWZmaXgsICdpbScpO1xuY29uc3QgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvciA9IF9wb2x5ZmlsbEhvc3QgKyAnLW5vLWNvbWJpbmF0b3InO1xuY29uc3QgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvclJlID0gLy1zaGFkb3djc3Nob3N0LW5vLWNvbWJpbmF0b3IoW15cXHNdKikvO1xuY29uc3QgX3NoYWRvd0RPTVNlbGVjdG9yc1JlID0gW1xuICAvOjpzaGFkb3cvZyxcbiAgLzo6Y29udGVudC9nLFxuICAvLyBEZXByZWNhdGVkIHNlbGVjdG9yc1xuICAvXFwvc2hhZG93LWRlZXBcXC8vZyxcbiAgL1xcL3NoYWRvd1xcLy9nLFxuXTtcblxuLy8gVGhlIGRlZXAgY29tYmluYXRvciBpcyBkZXByZWNhdGVkIGluIHRoZSBDU1Mgc3BlY1xuLy8gU3VwcG9ydCBmb3IgYD4+PmAsIGBkZWVwYCwgYDo6bmctZGVlcGAgaXMgdGhlbiBhbHNvIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiB0aGUgZnV0dXJlLlxuLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvcHVsbC8xNzY3N1xuY29uc3QgX3NoYWRvd0RlZXBTZWxlY3RvcnMgPSAvKD86Pj4+KXwoPzpcXC9kZWVwXFwvKXwoPzo6Om5nLWRlZXApL2c7XG5jb25zdCBfc2VsZWN0b3JSZVN1ZmZpeCA9ICcoWz5cXFxcc34rWy4sezpdW1xcXFxzXFxcXFNdKik/JCc7XG5jb25zdCBfcG9seWZpbGxIb3N0UmUgPSAvLXNoYWRvd2Nzc2hvc3QvZ2ltO1xuY29uc3QgX2NvbG9uSG9zdFJlID0gLzpob3N0L2dpbTtcbmNvbnN0IF9jb2xvbkhvc3RDb250ZXh0UmUgPSAvOmhvc3QtY29udGV4dC9naW07XG5cbmNvbnN0IF9uZXdMaW5lc1JlID0gL1xccj9cXG4vZztcbmNvbnN0IF9jb21tZW50UmUgPSAvXFwvXFwqW1xcc1xcU10qP1xcKlxcLy9nO1xuY29uc3QgX2NvbW1lbnRXaXRoSGFzaFJlID0gL1xcL1xcKlxccyojXFxzKnNvdXJjZShNYXBwaW5nKT9VUkw9L2c7XG5jb25zdCBDT01NRU5UX1BMQUNFSE9MREVSID0gJyVDT01NRU5UJSc7XG5jb25zdCBfY29tbWVudFdpdGhIYXNoUGxhY2VIb2xkZXJSZSA9IG5ldyBSZWdFeHAoQ09NTUVOVF9QTEFDRUhPTERFUiwgJ2cnKTtcblxuY29uc3QgQkxPQ0tfUExBQ0VIT0xERVIgPSAnJUJMT0NLJSc7XG5jb25zdCBfcnVsZVJlID0gbmV3IFJlZ0V4cChcbiAgICBgKFxcXFxzKig/OiR7Q09NTUVOVF9QTEFDRUhPTERFUn1cXFxccyopKikoW147XFxcXHtcXFxcfV0rPykoXFxcXHMqKSgoPzp7JUJMT0NLJX0/XFxcXHMqOz8pfCg/OlxcXFxzKjspKWAsXG4gICAgJ2cnKTtcbmNvbnN0IENPTlRFTlRfUEFJUlMgPSBuZXcgTWFwKFtbJ3snLCAnfSddXSk7XG5cbmNvbnN0IENPTU1BX0lOX1BMQUNFSE9MREVSID0gJyVDT01NQV9JTl9QTEFDRUhPTERFUiUnO1xuY29uc3QgU0VNSV9JTl9QTEFDRUhPTERFUiA9ICclU0VNSV9JTl9QTEFDRUhPTERFUiUnO1xuY29uc3QgQ09MT05fSU5fUExBQ0VIT0xERVIgPSAnJUNPTE9OX0lOX1BMQUNFSE9MREVSJSc7XG5cbmNvbnN0IF9jc3NDb21tYUluUGxhY2Vob2xkZXJSZUdsb2JhbCA9IG5ldyBSZWdFeHAoQ09NTUFfSU5fUExBQ0VIT0xERVIsICdnJyk7XG5jb25zdCBfY3NzU2VtaUluUGxhY2Vob2xkZXJSZUdsb2JhbCA9IG5ldyBSZWdFeHAoU0VNSV9JTl9QTEFDRUhPTERFUiwgJ2cnKTtcbmNvbnN0IF9jc3NDb2xvbkluUGxhY2Vob2xkZXJSZUdsb2JhbCA9IG5ldyBSZWdFeHAoQ09MT05fSU5fUExBQ0VIT0xERVIsICdnJyk7XG5cbmV4cG9ydCBjbGFzcyBDc3NSdWxlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHNlbGVjdG9yOiBzdHJpbmcsIHB1YmxpYyBjb250ZW50OiBzdHJpbmcpIHt9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9jZXNzUnVsZXMoaW5wdXQ6IHN0cmluZywgcnVsZUNhbGxiYWNrOiAocnVsZTogQ3NzUnVsZSkgPT4gQ3NzUnVsZSk6IHN0cmluZyB7XG4gIGNvbnN0IGVzY2FwZWQgPSBlc2NhcGVJblN0cmluZ3MoaW5wdXQpO1xuICBjb25zdCBpbnB1dFdpdGhFc2NhcGVkQmxvY2tzID0gZXNjYXBlQmxvY2tzKGVzY2FwZWQsIENPTlRFTlRfUEFJUlMsIEJMT0NLX1BMQUNFSE9MREVSKTtcbiAgbGV0IG5leHRCbG9ja0luZGV4ID0gMDtcbiAgY29uc3QgZXNjYXBlZFJlc3VsdCA9IGlucHV0V2l0aEVzY2FwZWRCbG9ja3MuZXNjYXBlZFN0cmluZy5yZXBsYWNlKF9ydWxlUmUsICguLi5tOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IHNlbGVjdG9yID0gbVsyXTtcbiAgICBsZXQgY29udGVudCA9ICcnO1xuICAgIGxldCBzdWZmaXggPSBtWzRdO1xuICAgIGxldCBjb250ZW50UHJlZml4ID0gJyc7XG4gICAgaWYgKHN1ZmZpeCAmJiBzdWZmaXguc3RhcnRzV2l0aCgneycgKyBCTE9DS19QTEFDRUhPTERFUikpIHtcbiAgICAgIGNvbnRlbnQgPSBpbnB1dFdpdGhFc2NhcGVkQmxvY2tzLmJsb2Nrc1tuZXh0QmxvY2tJbmRleCsrXTtcbiAgICAgIHN1ZmZpeCA9IHN1ZmZpeC5zdWJzdHJpbmcoQkxPQ0tfUExBQ0VIT0xERVIubGVuZ3RoICsgMSk7XG4gICAgICBjb250ZW50UHJlZml4ID0gJ3snO1xuICAgIH1cbiAgICBjb25zdCBydWxlID0gcnVsZUNhbGxiYWNrKG5ldyBDc3NSdWxlKHNlbGVjdG9yLCBjb250ZW50KSk7XG4gICAgcmV0dXJuIGAke21bMV19JHtydWxlLnNlbGVjdG9yfSR7bVszXX0ke2NvbnRlbnRQcmVmaXh9JHtydWxlLmNvbnRlbnR9JHtzdWZmaXh9YDtcbiAgfSk7XG4gIHJldHVybiB1bmVzY2FwZUluU3RyaW5ncyhlc2NhcGVkUmVzdWx0KTtcbn1cblxuY2xhc3MgU3RyaW5nV2l0aEVzY2FwZWRCbG9ja3Mge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZXNjYXBlZFN0cmluZzogc3RyaW5nLCBwdWJsaWMgYmxvY2tzOiBzdHJpbmdbXSkge31cbn1cblxuZnVuY3Rpb24gZXNjYXBlQmxvY2tzKFxuICAgIGlucHV0OiBzdHJpbmcsIGNoYXJQYWlyczogTWFwPHN0cmluZywgc3RyaW5nPiwgcGxhY2Vob2xkZXI6IHN0cmluZyk6IFN0cmluZ1dpdGhFc2NhcGVkQmxvY2tzIHtcbiAgY29uc3QgcmVzdWx0UGFydHM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVzY2FwZWRCbG9ja3M6IHN0cmluZ1tdID0gW107XG4gIGxldCBvcGVuQ2hhckNvdW50ID0gMDtcbiAgbGV0IG5vbkJsb2NrU3RhcnRJbmRleCA9IDA7XG4gIGxldCBibG9ja1N0YXJ0SW5kZXggPSAtMTtcbiAgbGV0IG9wZW5DaGFyOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgY2xvc2VDaGFyOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaGFyID0gaW5wdXRbaV07XG4gICAgaWYgKGNoYXIgPT09ICdcXFxcJykge1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gY2xvc2VDaGFyKSB7XG4gICAgICBvcGVuQ2hhckNvdW50LS07XG4gICAgICBpZiAob3BlbkNoYXJDb3VudCA9PT0gMCkge1xuICAgICAgICBlc2NhcGVkQmxvY2tzLnB1c2goaW5wdXQuc3Vic3RyaW5nKGJsb2NrU3RhcnRJbmRleCwgaSkpO1xuICAgICAgICByZXN1bHRQYXJ0cy5wdXNoKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgbm9uQmxvY2tTdGFydEluZGV4ID0gaTtcbiAgICAgICAgYmxvY2tTdGFydEluZGV4ID0gLTE7XG4gICAgICAgIG9wZW5DaGFyID0gY2xvc2VDaGFyID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gb3BlbkNoYXIpIHtcbiAgICAgIG9wZW5DaGFyQ291bnQrKztcbiAgICB9IGVsc2UgaWYgKG9wZW5DaGFyQ291bnQgPT09IDAgJiYgY2hhclBhaXJzLmhhcyhjaGFyKSkge1xuICAgICAgb3BlbkNoYXIgPSBjaGFyO1xuICAgICAgY2xvc2VDaGFyID0gY2hhclBhaXJzLmdldChjaGFyKTtcbiAgICAgIG9wZW5DaGFyQ291bnQgPSAxO1xuICAgICAgYmxvY2tTdGFydEluZGV4ID0gaSArIDE7XG4gICAgICByZXN1bHRQYXJ0cy5wdXNoKGlucHV0LnN1YnN0cmluZyhub25CbG9ja1N0YXJ0SW5kZXgsIGJsb2NrU3RhcnRJbmRleCkpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChibG9ja1N0YXJ0SW5kZXggIT09IC0xKSB7XG4gICAgZXNjYXBlZEJsb2Nrcy5wdXNoKGlucHV0LnN1YnN0cmluZyhibG9ja1N0YXJ0SW5kZXgpKTtcbiAgICByZXN1bHRQYXJ0cy5wdXNoKHBsYWNlaG9sZGVyKTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHRQYXJ0cy5wdXNoKGlucHV0LnN1YnN0cmluZyhub25CbG9ja1N0YXJ0SW5kZXgpKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgU3RyaW5nV2l0aEVzY2FwZWRCbG9ja3MocmVzdWx0UGFydHMuam9pbignJyksIGVzY2FwZWRCbG9ja3MpO1xufVxuXG4vKipcbiAqIE9iamVjdCBjb250YWluaW5nIGFzIGtleXMgY2hhcmFjdGVycyB0aGF0IHNob3VsZCBiZSBzdWJzdGl0dXRlZCBieSBwbGFjZWhvbGRlcnNcbiAqIHdoZW4gZm91bmQgaW4gc3RyaW5ncyBkdXJpbmcgdGhlIGNzcyB0ZXh0IHBhcnNpbmcsIGFuZCBhcyB2YWx1ZXMgdGhlIHJlc3BlY3RpdmVcbiAqIHBsYWNlaG9sZGVyc1xuICovXG5jb25zdCBFU0NBUEVfSU5fU1RSSU5HX01BUDoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7XG4gICc7JzogU0VNSV9JTl9QTEFDRUhPTERFUixcbiAgJywnOiBDT01NQV9JTl9QTEFDRUhPTERFUixcbiAgJzonOiBDT0xPTl9JTl9QTEFDRUhPTERFUlxufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgcHJvdmlkZWQgY3NzIHRleHQgYW5kIGluc2lkZSBzdHJpbmdzIChtZWFuaW5nLCBpbnNpZGUgcGFpcnMgb2YgdW5lc2NhcGVkIHNpbmdsZSBvclxuICogZG91YmxlIHF1b3RlcykgcmVwbGFjZSBzcGVjaWZpYyBjaGFyYWN0ZXJzIHdpdGggdGhlaXIgcmVzcGVjdGl2ZSBwbGFjZWhvbGRlcnMgYXMgaW5kaWNhdGVkXG4gKiBieSB0aGUgYEVTQ0FQRV9JTl9TVFJJTkdfTUFQYCBtYXAuXG4gKlxuICogRm9yIGV4YW1wbGUgY29udmVydCB0aGUgdGV4dFxuICogIGBhbmltYXRpb246IFwibXktYW5pbTphdFxcXCJpb25cIiAxcztgXG4gKiB0b1xuICogIGBhbmltYXRpb246IFwibXktYW5pbSVDT0xPTl9JTl9QTEFDRUhPTERFUiVhdFxcXCJpb25cIiAxcztgXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gcmVtb3ZlIHRoZSBtZWFuaW5nIG9mIHNvbWUgY2hhcmFjdGVycyB3aGVuIGZvdW5kIGluc2lkZSBzdHJpbmdzXG4gKiAoZm9yIGV4YW1wbGUgYDtgIGluZGljYXRlcyB0aGUgZW5kIG9mIGEgY3NzIGRlY2xhcmF0aW9uLCBgLGAgdGhlIHNlcXVlbmNlIG9mIHZhbHVlcyBhbmQgYDpgIHRoZVxuICogZGl2aXNpb24gYmV0d2VlbiBwcm9wZXJ0eSBhbmQgdmFsdWUgZHVyaW5nIGEgZGVjbGFyYXRpb24sIG5vbmUgb2YgdGhlc2UgbWVhbmluZ3MgYXBwbHkgd2hlbiBzdWNoXG4gKiBjaGFyYWN0ZXJzIGFyZSB3aXRoaW4gc3RyaW5ncyBhbmQgc28gaW4gb3JkZXIgdG8gcHJldmVudCBwYXJzaW5nIGlzc3VlcyB0aGV5IG5lZWQgdG8gYmUgcmVwbGFjZWRcbiAqIHdpdGggcGxhY2Vob2xkZXIgdGV4dCBmb3IgdGhlIGR1cmF0aW9uIG9mIHRoZSBjc3MgbWFuaXB1bGF0aW9uIHByb2Nlc3MpLlxuICpcbiAqIEBwYXJhbSBpbnB1dCB0aGUgb3JpZ2luYWwgY3NzIHRleHQuXG4gKlxuICogQHJldHVybnMgdGhlIGNzcyB0ZXh0IHdpdGggc3BlY2lmaWMgY2hhcmFjdGVycyBpbiBzdHJpbmdzIHJlcGxhY2VkIGJ5IHBsYWNlaG9sZGVycy5cbiAqKi9cbmZ1bmN0aW9uIGVzY2FwZUluU3RyaW5ncyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHJlc3VsdCA9IGlucHV0O1xuICBsZXQgY3VycmVudFF1b3RlQ2hhcjogc3RyaW5nfG51bGwgPSBudWxsO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoYXIgPSByZXN1bHRbaV07XG4gICAgaWYgKGNoYXIgPT09ICdcXFxcJykge1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY3VycmVudFF1b3RlQ2hhciAhPT0gbnVsbCkge1xuICAgICAgICAvLyBpbmRleCBpIGlzIGluc2lkZSBhIHF1b3RlZCBzdWItc3RyaW5nXG4gICAgICAgIGlmIChjaGFyID09PSBjdXJyZW50UXVvdGVDaGFyKSB7XG4gICAgICAgICAgY3VycmVudFF1b3RlQ2hhciA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXI6IHN0cmluZ3x1bmRlZmluZWQgPSBFU0NBUEVfSU5fU1RSSU5HX01BUFtjaGFyXTtcbiAgICAgICAgICBpZiAocGxhY2Vob2xkZXIpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGAke3Jlc3VsdC5zdWJzdHIoMCwgaSl9JHtwbGFjZWhvbGRlcn0ke3Jlc3VsdC5zdWJzdHIoaSArIDEpfWA7XG4gICAgICAgICAgICBpICs9IHBsYWNlaG9sZGVyLmxlbmd0aCAtIDE7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNoYXIgPT09ICdcXCcnIHx8IGNoYXIgPT09ICdcIicpIHtcbiAgICAgICAgY3VycmVudFF1b3RlQ2hhciA9IGNoYXI7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogUmVwbGFjZSBpbiBhIHN0cmluZyBhbGwgb2NjdXJyZW5jZXMgb2Yga2V5cyBpbiB0aGUgYEVTQ0FQRV9JTl9TVFJJTkdfTUFQYCBtYXAgd2l0aCB0aGVpclxuICogb3JpZ2luYWwgcmVwcmVzZW50YXRpb24sIHRoaXMgaXMgc2ltcGx5IHVzZWQgdG8gcmV2ZXJ0IHRoZSBjaGFuZ2VzIGFwcGxpZWQgYnkgdGhlXG4gKiBlc2NhcGVJblN0cmluZ3MgZnVuY3Rpb24uXG4gKlxuICogRm9yIGV4YW1wbGUgaXQgcmV2ZXJ0cyB0aGUgdGV4dDpcbiAqICBgYW5pbWF0aW9uOiBcIm15LWFuaW0lQ09MT05fSU5fUExBQ0VIT0xERVIlYXRcXFwiaW9uXCIgMXM7YFxuICogdG8gaXQncyBvcmlnaW5hbCBmb3JtIG9mOlxuICogIGBhbmltYXRpb246IFwibXktYW5pbTphdFxcXCJpb25cIiAxcztgXG4gKlxuICogTm90ZTogRm9yIHRoZSBzYWtlIG9mIHNpbXBsaWNpdHkgdGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBjaGVjayB0aGF0IHRoZSBwbGFjZWhvbGRlcnMgYXJlXG4gKiBhY3R1YWxseSBpbnNpZGUgc3RyaW5ncyBhcyBpdCB3b3VsZCBhbnl3YXkgYmUgZXh0cmVtZWx5IHVubGlrZWx5IHRvIGZpbmQgdGhlbSBvdXRzaWRlIG9mIHN0cmluZ3MuXG4gKlxuICogQHBhcmFtIGlucHV0IHRoZSBjc3MgdGV4dCBjb250YWluaW5nIHRoZSBwbGFjZWhvbGRlcnMuXG4gKlxuICogQHJldHVybnMgdGhlIGNzcyB0ZXh0IHdpdGhvdXQgdGhlIHBsYWNlaG9sZGVycy5cbiAqL1xuZnVuY3Rpb24gdW5lc2NhcGVJblN0cmluZ3MoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCByZXN1bHQgPSBpbnB1dC5yZXBsYWNlKF9jc3NDb21tYUluUGxhY2Vob2xkZXJSZUdsb2JhbCwgJywnKTtcbiAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoX2Nzc1NlbWlJblBsYWNlaG9sZGVyUmVHbG9iYWwsICc7Jyk7XG4gIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKF9jc3NDb2xvbkluUGxhY2Vob2xkZXJSZUdsb2JhbCwgJzonKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBVbmVzY2FwZSBhbGwgcXVvdGVzIHByZXNlbnQgaW4gYSBzdHJpbmcsIGJ1dCBvbmx5IGlmIHRoZSBzdHJpbmcgd2FzIGFjdHVhbGx5IGFscmVhZHlcbiAqIHF1b3RlZC5cbiAqXG4gKiBUaGlzIGdlbmVyYXRlcyBhIFwiY2Fub25pY2FsXCIgcmVwcmVzZW50YXRpb24gb2Ygc3RyaW5ncyB3aGljaCBjYW4gYmUgdXNlZCB0byBtYXRjaCBzdHJpbmdzXG4gKiB3aGljaCB3b3VsZCBvdGhlcndpc2Ugb25seSBkaWZmZXIgYmVjYXVzZSBvZiBkaWZmZXJlbnRseSBlc2NhcGVkIHF1b3Rlcy5cbiAqXG4gKiBGb3IgZXhhbXBsZSBpdCBjb252ZXJ0cyB0aGUgc3RyaW5nIChhc3N1bWVkIHRvIGJlIHF1b3RlZCk6XG4gKiAgYHRoaXMgXFxcXFwiaXNcXFxcXCIgYSBcXFxcJ1xcXFxcXFxcJ3Rlc3RgXG4gKiB0bzpcbiAqICBgdGhpcyBcImlzXCIgYSAnXFxcXFxcXFwndGVzdGBcbiAqIChub3RlIHRoYXQgdGhlIGxhdHRlciBiYWNrc2xhc2hlcyBhcmUgbm90IHJlbW92ZWQgYXMgdGhleSBhcmUgbm90IGFjdHVhbGx5IGVzY2FwaW5nIHRoZSBzaW5nbGVcbiAqIHF1b3RlKVxuICpcbiAqXG4gKiBAcGFyYW0gaW5wdXQgdGhlIHN0cmluZyBwb3NzaWJseSBjb250YWluaW5nIGVzY2FwZWQgcXVvdGVzLlxuICogQHBhcmFtIGlzUXVvdGVkIGJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRoZSBzdHJpbmcgd2FzIHF1b3RlZCBpbnNpZGUgYSBiaWdnZXIgc3RyaW5nIChpZiBub3RcbiAqIHRoZW4gaXQgbWVhbnMgdGhhdCBpdCBkb2Vzbid0IHJlcHJlc2VudCBhbiBpbm5lciBzdHJpbmcgYW5kIHRodXMgbm8gdW5lc2NhcGluZyBpcyByZXF1aXJlZClcbiAqXG4gKiBAcmV0dXJucyB0aGUgc3RyaW5nIGluIHRoZSBcImNhbm9uaWNhbFwiIHJlcHJlc2VudGF0aW9uIHdpdGhvdXQgZXNjYXBlZCBxdW90ZXMuXG4gKi9cbmZ1bmN0aW9uIHVuZXNjYXBlUXVvdGVzKHN0cjogc3RyaW5nLCBpc1F1b3RlZDogYm9vbGVhbik6IHN0cmluZyB7XG4gIHJldHVybiAhaXNRdW90ZWQgPyBzdHIgOiBzdHIucmVwbGFjZSgvKCg/Ol58W15cXFxcXSkoPzpcXFxcXFxcXCkqKVxcXFwoPz1bJ1wiXSkvZywgJyQxJyk7XG59XG5cbi8qKlxuICogQ29tYmluZSB0aGUgYGNvbnRleHRTZWxlY3RvcnNgIHdpdGggdGhlIGBob3N0TWFya2VyYCBhbmQgdGhlIGBvdGhlclNlbGVjdG9yc2BcbiAqIHRvIGNyZWF0ZSBhIHNlbGVjdG9yIHRoYXQgbWF0Y2hlcyB0aGUgc2FtZSBhcyBgOmhvc3QtY29udGV4dCgpYC5cbiAqXG4gKiBHaXZlbiBhIHNpbmdsZSBjb250ZXh0IHNlbGVjdG9yIGBBYCB3ZSBuZWVkIHRvIG91dHB1dCBzZWxlY3RvcnMgdGhhdCBtYXRjaCBvbiB0aGUgaG9zdCBhbmQgYXMgYW5cbiAqIGFuY2VzdG9yIG9mIHRoZSBob3N0OlxuICpcbiAqIGBgYFxuICogQSA8aG9zdE1hcmtlcj4sIEE8aG9zdE1hcmtlcj4ge31cbiAqIGBgYFxuICpcbiAqIFdoZW4gdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBjb250ZXh0IHNlbGVjdG9yIHdlIGFsc28gaGF2ZSB0byBjcmVhdGUgY29tYmluYXRpb25zIG9mIHRob3NlXG4gKiBzZWxlY3RvcnMgd2l0aCBlYWNoIG90aGVyLiBGb3IgZXhhbXBsZSBpZiB0aGVyZSBhcmUgYEFgIGFuZCBgQmAgc2VsZWN0b3JzIHRoZSBvdXRwdXQgaXM6XG4gKlxuICogYGBgXG4gKiBBQjxob3N0TWFya2VyPiwgQUIgPGhvc3RNYXJrZXI+LCBBIEI8aG9zdE1hcmtlcj4sXG4gKiBCIEE8aG9zdE1hcmtlcj4sIEEgQiA8aG9zdE1hcmtlcj4sIEIgQSA8aG9zdE1hcmtlcj4ge31cbiAqIGBgYFxuICpcbiAqIEFuZCBzbyBvbi4uLlxuICpcbiAqIEBwYXJhbSBjb250ZXh0U2VsZWN0b3JzIGFuIGFycmF5IG9mIGNvbnRleHQgc2VsZWN0b3JzIHRoYXQgd2lsbCBiZSBjb21iaW5lZC5cbiAqIEBwYXJhbSBvdGhlclNlbGVjdG9ycyB0aGUgcmVzdCBvZiB0aGUgc2VsZWN0b3JzIHRoYXQgYXJlIG5vdCBjb250ZXh0IHNlbGVjdG9ycy5cbiAqL1xuZnVuY3Rpb24gY29tYmluZUhvc3RDb250ZXh0U2VsZWN0b3JzKGNvbnRleHRTZWxlY3RvcnM6IHN0cmluZ1tdLCBvdGhlclNlbGVjdG9yczogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgaG9zdE1hcmtlciA9IF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3I7XG4gIF9wb2x5ZmlsbEhvc3RSZS5sYXN0SW5kZXggPSAwOyAgLy8gcmVzZXQgdGhlIHJlZ2V4IHRvIGVuc3VyZSB3ZSBnZXQgYW4gYWNjdXJhdGUgdGVzdFxuICBjb25zdCBvdGhlclNlbGVjdG9yc0hhc0hvc3QgPSBfcG9seWZpbGxIb3N0UmUudGVzdChvdGhlclNlbGVjdG9ycyk7XG5cbiAgLy8gSWYgdGhlcmUgYXJlIG5vIGNvbnRleHQgc2VsZWN0b3JzIHRoZW4ganVzdCBvdXRwdXQgYSBob3N0IG1hcmtlclxuICBpZiAoY29udGV4dFNlbGVjdG9ycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gaG9zdE1hcmtlciArIG90aGVyU2VsZWN0b3JzO1xuICB9XG5cbiAgY29uc3QgY29tYmluZWQ6IHN0cmluZ1tdID0gW2NvbnRleHRTZWxlY3RvcnMucG9wKCkgfHwgJyddO1xuICB3aGlsZSAoY29udGV4dFNlbGVjdG9ycy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbGVuZ3RoID0gY29tYmluZWQubGVuZ3RoO1xuICAgIGNvbnN0IGNvbnRleHRTZWxlY3RvciA9IGNvbnRleHRTZWxlY3RvcnMucG9wKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcHJldmlvdXNTZWxlY3RvcnMgPSBjb21iaW5lZFtpXTtcbiAgICAgIC8vIEFkZCB0aGUgbmV3IHNlbGVjdG9yIGFzIGEgZGVzY2VuZGFudCBvZiB0aGUgcHJldmlvdXMgc2VsZWN0b3JzXG4gICAgICBjb21iaW5lZFtsZW5ndGggKiAyICsgaV0gPSBwcmV2aW91c1NlbGVjdG9ycyArICcgJyArIGNvbnRleHRTZWxlY3RvcjtcbiAgICAgIC8vIEFkZCB0aGUgbmV3IHNlbGVjdG9yIGFzIGFuIGFuY2VzdG9yIG9mIHRoZSBwcmV2aW91cyBzZWxlY3RvcnNcbiAgICAgIGNvbWJpbmVkW2xlbmd0aCArIGldID0gY29udGV4dFNlbGVjdG9yICsgJyAnICsgcHJldmlvdXNTZWxlY3RvcnM7XG4gICAgICAvLyBBZGQgdGhlIG5ldyBzZWxlY3RvciB0byBhY3Qgb24gdGhlIHNhbWUgZWxlbWVudCBhcyB0aGUgcHJldmlvdXMgc2VsZWN0b3JzXG4gICAgICBjb21iaW5lZFtpXSA9IGNvbnRleHRTZWxlY3RvciArIHByZXZpb3VzU2VsZWN0b3JzO1xuICAgIH1cbiAgfVxuICAvLyBGaW5hbGx5IGNvbm5lY3QgdGhlIHNlbGVjdG9yIHRvIHRoZSBgaG9zdE1hcmtlcmBzOiBlaXRoZXIgYWN0aW5nIGRpcmVjdGx5IG9uIHRoZSBob3N0XG4gIC8vIChBPGhvc3RNYXJrZXI+KSBvciBhcyBhbiBhbmNlc3RvciAoQSA8aG9zdE1hcmtlcj4pLlxuICByZXR1cm4gY29tYmluZWRcbiAgICAgIC5tYXAoXG4gICAgICAgICAgcyA9PiBvdGhlclNlbGVjdG9yc0hhc0hvc3QgP1xuICAgICAgICAgICAgICBgJHtzfSR7b3RoZXJTZWxlY3RvcnN9YCA6XG4gICAgICAgICAgICAgIGAke3N9JHtob3N0TWFya2VyfSR7b3RoZXJTZWxlY3RvcnN9LCAke3N9ICR7aG9zdE1hcmtlcn0ke290aGVyU2VsZWN0b3JzfWApXG4gICAgICAuam9pbignLCcpO1xufVxuXG4vKipcbiAqIE11dGF0ZSB0aGUgZ2l2ZW4gYGdyb3Vwc2AgYXJyYXkgc28gdGhhdCB0aGVyZSBhcmUgYG11bHRpcGxlc2AgY2xvbmVzIG9mIHRoZSBvcmlnaW5hbCBhcnJheVxuICogc3RvcmVkLlxuICpcbiAqIEZvciBleGFtcGxlIGByZXBlYXRHcm91cHMoW2EsIGJdLCAzKWAgd2lsbCByZXN1bHQgaW4gYFthLCBiLCBhLCBiLCBhLCBiXWAgLSBidXQgaW1wb3J0YW50bHkgdGhlXG4gKiBuZXdseSBhZGRlZCBncm91cHMgd2lsbCBiZSBjbG9uZXMgb2YgdGhlIG9yaWdpbmFsLlxuICpcbiAqIEBwYXJhbSBncm91cHMgQW4gYXJyYXkgb2YgZ3JvdXBzIG9mIHN0cmluZ3MgdGhhdCB3aWxsIGJlIHJlcGVhdGVkLiBUaGlzIGFycmF5IGlzIG11dGF0ZWRcbiAqICAgICBpbi1wbGFjZS5cbiAqIEBwYXJhbSBtdWx0aXBsZXMgVGhlIG51bWJlciBvZiB0aW1lcyB0aGUgY3VycmVudCBncm91cHMgc2hvdWxkIGFwcGVhci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlcGVhdEdyb3Vwcyhncm91cHM6IHN0cmluZ1tdW10sIG11bHRpcGxlczogbnVtYmVyKTogdm9pZCB7XG4gIGNvbnN0IGxlbmd0aCA9IGdyb3Vwcy5sZW5ndGg7XG4gIGZvciAobGV0IGkgPSAxOyBpIDwgbXVsdGlwbGVzOyBpKyspIHtcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbmd0aDsgaisrKSB7XG4gICAgICBncm91cHNbaiArIChpICogbGVuZ3RoKV0gPSBncm91cHNbal0uc2xpY2UoMCk7XG4gICAgfVxuICB9XG59XG4iXX0=