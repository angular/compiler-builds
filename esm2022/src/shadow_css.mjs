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
    'inherit',
    'initial',
    'revert',
    'unset',
    // animation-direction
    'alternate',
    'alternate-reverse',
    'normal',
    'reverse',
    // animation-fill-mode
    'backwards',
    'both',
    'forwards',
    'none',
    // animation-play-state
    'paused',
    'running',
    // animation-timing-function
    'ease',
    'ease-in',
    'ease-in-out',
    'ease-out',
    'linear',
    'step-start',
    'step-end',
    // `steps()` function
    'end',
    'jump-both',
    'jump-end',
    'jump-none',
    'jump-start',
    'start',
]);
/**
 * The following array contains all of the CSS at-rule identifiers which are scoped.
 */
const scopedAtRuleIdentifiers = [
    '@media',
    '@supports',
    '@document',
    '@layer',
    '@container',
    '@scope',
    '@starting-style',
];
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
        const scopedKeyframesCssText = processRules(cssText, (rule) => this._scopeLocalKeyframeDeclarations(rule, scopeSelector, unscopedKeyframesSet));
        return processRules(scopedKeyframesCssText, (rule) => this._scopeAnimationRule(rule, scopeSelector, unscopedKeyframesSet));
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
                    return animationKeywords.has(nonQuotedName)
                        ? original
                        : `${leadingSpaces}${this._scopeAnimationKeyframe(nonQuotedName, scopeSelector, unscopedKeyframesSet)}`;
                }
            }));
        content = content.replace(/((?:^|\s+|;)(?:-webkit-)?animation-name(?:\s*):(?:\s*))([^;]+)/g, (_match, start, commaSeparatedKeyframes) => `${start}${commaSeparatedKeyframes
            .split(',')
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
                const newContextSelectors = (match[1] ?? '')
                    .trim()
                    .split(',')
                    .map((m) => m.trim())
                    .filter((m) => m !== '');
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
            else if (scopedAtRuleIdentifiers.some((atRule) => rule.selector.startsWith(atRule))) {
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
            const selector = rule.selector
                .replace(_shadowDeepSelectors, ' ')
                .replace(_polyfillHostNoCombinatorRe, ' ');
            return new CssRule(selector, rule.content);
        });
    }
    _scopeSelector(selector, scopeSelector, hostSelector) {
        return selector
            .split(',')
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
        return selector
            .replace(_colonHostContextRe, _polyfillHostContext)
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
const _parenSuffix = '(?:\\((' + '(?:\\([^)(]*\\)|[^)(]*)+?' + ')\\))?([^,{]*)';
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
    ':': COLON_IN_PLACEHOLDER,
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
            else if (char === "'" || char === '"') {
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
        .map((s) => otherSelectorsHasHost
        ? `${s}${otherSelectors}`
        : `${s}${hostMarker}${otherSelectors}, ${s} ${hostMarker}${otherSelectors}`)
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
            groups[j + i * length] = groups[j].slice(0);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93X2Nzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zaGFkb3dfY3NzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLGlCQUFpQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ2hDLGdCQUFnQjtJQUNoQixTQUFTO0lBQ1QsU0FBUztJQUNULFFBQVE7SUFDUixPQUFPO0lBQ1Asc0JBQXNCO0lBQ3RCLFdBQVc7SUFDWCxtQkFBbUI7SUFDbkIsUUFBUTtJQUNSLFNBQVM7SUFDVCxzQkFBc0I7SUFDdEIsV0FBVztJQUNYLE1BQU07SUFDTixVQUFVO0lBQ1YsTUFBTTtJQUNOLHVCQUF1QjtJQUN2QixRQUFRO0lBQ1IsU0FBUztJQUNULDRCQUE0QjtJQUM1QixNQUFNO0lBQ04sU0FBUztJQUNULGFBQWE7SUFDYixVQUFVO0lBQ1YsUUFBUTtJQUNSLFlBQVk7SUFDWixVQUFVO0lBQ1YscUJBQXFCO0lBQ3JCLEtBQUs7SUFDTCxXQUFXO0lBQ1gsVUFBVTtJQUNWLFdBQVc7SUFDWCxZQUFZO0lBQ1osT0FBTztDQUNSLENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSx1QkFBdUIsR0FBRztJQUM5QixRQUFRO0lBQ1IsV0FBVztJQUNYLFdBQVc7SUFDWCxRQUFRO0lBQ1IsWUFBWTtJQUNaLFFBQVE7SUFDUixpQkFBaUI7Q0FDbEIsQ0FBQztBQUVGOzs7Ozs7OztHQVFHO0FBRUg7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztFQTZGRTtBQUNGLE1BQU0sT0FBTyxTQUFTO0lBQXRCO1FBcUtFOzs7Ozs7Ozs7Ozs7O1dBYUc7UUFDSyxxQ0FBZ0MsR0FDdEMsaUZBQWlGLENBQUM7SUF3Y3RGLENB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QUFVLFlBQVksQ0FBQyxNQUFrQixFQUFFLFNBQWlCO0lBQ2hFLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDN0IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25DLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNoQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlDLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIFRoZSBmb2xsb3dpbmcgc2V0IGNvbnRhaW5zIGFsbCBrZXl3b3JkcyB0aGF0IGNhbiBiZSB1c2VkIGluIHRoZSBhbmltYXRpb24gY3NzIHNob3J0aGFuZFxuICogcHJvcGVydHkgYW5kIGlzIHVzZWQgZHVyaW5nIHRoZSBzY29waW5nIG9mIGtleWZyYW1lcyB0byBtYWtlIHN1cmUgc3VjaCBrZXl3b3Jkc1xuICogYXJlIG5vdCBtb2RpZmllZC5cbiAqL1xuY29uc3QgYW5pbWF0aW9uS2V5d29yZHMgPSBuZXcgU2V0KFtcbiAgLy8gZ2xvYmFsIHZhbHVlc1xuICAnaW5oZXJpdCcsXG4gICdpbml0aWFsJyxcbiAgJ3JldmVydCcsXG4gICd1bnNldCcsXG4gIC8vIGFuaW1hdGlvbi1kaXJlY3Rpb25cbiAgJ2FsdGVybmF0ZScsXG4gICdhbHRlcm5hdGUtcmV2ZXJzZScsXG4gICdub3JtYWwnLFxuICAncmV2ZXJzZScsXG4gIC8vIGFuaW1hdGlvbi1maWxsLW1vZGVcbiAgJ2JhY2t3YXJkcycsXG4gICdib3RoJyxcbiAgJ2ZvcndhcmRzJyxcbiAgJ25vbmUnLFxuICAvLyBhbmltYXRpb24tcGxheS1zdGF0ZVxuICAncGF1c2VkJyxcbiAgJ3J1bm5pbmcnLFxuICAvLyBhbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uXG4gICdlYXNlJyxcbiAgJ2Vhc2UtaW4nLFxuICAnZWFzZS1pbi1vdXQnLFxuICAnZWFzZS1vdXQnLFxuICAnbGluZWFyJyxcbiAgJ3N0ZXAtc3RhcnQnLFxuICAnc3RlcC1lbmQnLFxuICAvLyBgc3RlcHMoKWAgZnVuY3Rpb25cbiAgJ2VuZCcsXG4gICdqdW1wLWJvdGgnLFxuICAnanVtcC1lbmQnLFxuICAnanVtcC1ub25lJyxcbiAgJ2p1bXAtc3RhcnQnLFxuICAnc3RhcnQnLFxuXSk7XG5cbi8qKlxuICogVGhlIGZvbGxvd2luZyBhcnJheSBjb250YWlucyBhbGwgb2YgdGhlIENTUyBhdC1ydWxlIGlkZW50aWZpZXJzIHdoaWNoIGFyZSBzY29wZWQuXG4gKi9cbmNvbnN0IHNjb3BlZEF0UnVsZUlkZW50aWZpZXJzID0gW1xuICAnQG1lZGlhJyxcbiAgJ0BzdXBwb3J0cycsXG4gICdAZG9jdW1lbnQnLFxuICAnQGxheWVyJyxcbiAgJ0Bjb250YWluZXInLFxuICAnQHNjb3BlJyxcbiAgJ0BzdGFydGluZy1zdHlsZScsXG5dO1xuXG4vKipcbiAqIFRoZSBmb2xsb3dpbmcgY2xhc3MgaGFzIGl0cyBvcmlnaW4gZnJvbSBhIHBvcnQgb2Ygc2hhZG93Q1NTIGZyb20gd2ViY29tcG9uZW50cy5qcyB0byBUeXBlU2NyaXB0LlxuICogSXQgaGFzIHNpbmNlIGRpdmVyZ2UgaW4gbWFueSB3YXlzIHRvIHRhaWxvciBBbmd1bGFyJ3MgbmVlZHMuXG4gKlxuICogU291cmNlOlxuICogaHR0cHM6Ly9naXRodWIuY29tL3dlYmNvbXBvbmVudHMvd2ViY29tcG9uZW50c2pzL2Jsb2IvNGVmZWNkN2UwZS9zcmMvU2hhZG93Q1NTL1NoYWRvd0NTUy5qc1xuICpcbiAqIFRoZSBvcmlnaW5hbCBmaWxlIGxldmVsIGNvbW1lbnQgaXMgcmVwcm9kdWNlZCBiZWxvd1xuICovXG5cbi8qXG4gIFRoaXMgaXMgYSBsaW1pdGVkIHNoaW0gZm9yIFNoYWRvd0RPTSBjc3Mgc3R5bGluZy5cbiAgaHR0cHM6Ly9kdmNzLnczLm9yZy9oZy93ZWJjb21wb25lbnRzL3Jhdy1maWxlL3RpcC9zcGVjL3NoYWRvdy9pbmRleC5odG1sI3N0eWxlc1xuXG4gIFRoZSBpbnRlbnRpb24gaGVyZSBpcyB0byBzdXBwb3J0IG9ubHkgdGhlIHN0eWxpbmcgZmVhdHVyZXMgd2hpY2ggY2FuIGJlXG4gIHJlbGF0aXZlbHkgc2ltcGx5IGltcGxlbWVudGVkLiBUaGUgZ29hbCBpcyB0byBhbGxvdyB1c2VycyB0byBhdm9pZCB0aGVcbiAgbW9zdCBvYnZpb3VzIHBpdGZhbGxzIGFuZCBkbyBzbyB3aXRob3V0IGNvbXByb21pc2luZyBwZXJmb3JtYW5jZSBzaWduaWZpY2FudGx5LlxuICBGb3IgU2hhZG93RE9NIHN0eWxpbmcgdGhhdCdzIG5vdCBjb3ZlcmVkIGhlcmUsIGEgc2V0IG9mIGJlc3QgcHJhY3RpY2VzXG4gIGNhbiBiZSBwcm92aWRlZCB0aGF0IHNob3VsZCBhbGxvdyB1c2VycyB0byBhY2NvbXBsaXNoIG1vcmUgY29tcGxleCBzdHlsaW5nLlxuXG4gIFRoZSBmb2xsb3dpbmcgaXMgYSBsaXN0IG9mIHNwZWNpZmljIFNoYWRvd0RPTSBzdHlsaW5nIGZlYXR1cmVzIGFuZCBhIGJyaWVmXG4gIGRpc2N1c3Npb24gb2YgdGhlIGFwcHJvYWNoIHVzZWQgdG8gc2hpbS5cblxuICBTaGltbWVkIGZlYXR1cmVzOlxuXG4gICogOmhvc3QsIDpob3N0LWNvbnRleHQ6IFNoYWRvd0RPTSBhbGxvd3Mgc3R5bGluZyBvZiB0aGUgc2hhZG93Um9vdCdzIGhvc3RcbiAgZWxlbWVudCB1c2luZyB0aGUgOmhvc3QgcnVsZS4gVG8gc2hpbSB0aGlzIGZlYXR1cmUsIHRoZSA6aG9zdCBzdHlsZXMgYXJlXG4gIHJlZm9ybWF0dGVkIGFuZCBwcmVmaXhlZCB3aXRoIGEgZ2l2ZW4gc2NvcGUgbmFtZSBhbmQgcHJvbW90ZWQgdG8gYVxuICBkb2N1bWVudCBsZXZlbCBzdHlsZXNoZWV0LlxuICBGb3IgZXhhbXBsZSwgZ2l2ZW4gYSBzY29wZSBuYW1lIG9mIC5mb28sIGEgcnVsZSBsaWtlIHRoaXM6XG5cbiAgICA6aG9zdCB7XG4gICAgICAgIGJhY2tncm91bmQ6IHJlZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgYmVjb21lczpcblxuICAgIC5mb28ge1xuICAgICAgYmFja2dyb3VuZDogcmVkO1xuICAgIH1cblxuICAqIGVuY2Fwc3VsYXRpb246IFN0eWxlcyBkZWZpbmVkIHdpdGhpbiBTaGFkb3dET00sIGFwcGx5IG9ubHkgdG9cbiAgZG9tIGluc2lkZSB0aGUgU2hhZG93RE9NLlxuICBUaGUgc2VsZWN0b3JzIGFyZSBzY29wZWQgYnkgYWRkaW5nIGFuIGF0dHJpYnV0ZSBzZWxlY3RvciBzdWZmaXggdG8gZWFjaFxuICBzaW1wbGUgc2VsZWN0b3IgdGhhdCBjb250YWlucyB0aGUgaG9zdCBlbGVtZW50IHRhZyBuYW1lLiBFYWNoIGVsZW1lbnRcbiAgaW4gdGhlIGVsZW1lbnQncyBTaGFkb3dET00gdGVtcGxhdGUgaXMgYWxzbyBnaXZlbiB0aGUgc2NvcGUgYXR0cmlidXRlLlxuICBUaHVzLCB0aGVzZSBydWxlcyBtYXRjaCBvbmx5IGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgc2NvcGUgYXR0cmlidXRlLlxuICBGb3IgZXhhbXBsZSwgZ2l2ZW4gYSBzY29wZSBuYW1lIG9mIHgtZm9vLCBhIHJ1bGUgbGlrZSB0aGlzOlxuXG4gICAgZGl2IHtcbiAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgIH1cblxuICBiZWNvbWVzOlxuXG4gICAgZGl2W3gtZm9vXSB7XG4gICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICB9XG5cbiAgTm90ZSB0aGF0IGVsZW1lbnRzIHRoYXQgYXJlIGR5bmFtaWNhbGx5IGFkZGVkIHRvIGEgc2NvcGUgbXVzdCBoYXZlIHRoZSBzY29wZVxuICBzZWxlY3RvciBhZGRlZCB0byB0aGVtIG1hbnVhbGx5LlxuXG4gICogdXBwZXIvbG93ZXIgYm91bmQgZW5jYXBzdWxhdGlvbjogU3R5bGVzIHdoaWNoIGFyZSBkZWZpbmVkIG91dHNpZGUgYVxuICBzaGFkb3dSb290IHNob3VsZCBub3QgY3Jvc3MgdGhlIFNoYWRvd0RPTSBib3VuZGFyeSBhbmQgc2hvdWxkIG5vdCBhcHBseVxuICBpbnNpZGUgYSBzaGFkb3dSb290LlxuXG4gIFRoaXMgc3R5bGluZyBiZWhhdmlvciBpcyBub3QgZW11bGF0ZWQuIFNvbWUgcG9zc2libGUgd2F5cyB0byBkbyB0aGlzIHRoYXRcbiAgd2VyZSByZWplY3RlZCBkdWUgdG8gY29tcGxleGl0eSBhbmQvb3IgcGVyZm9ybWFuY2UgY29uY2VybnMgaW5jbHVkZTogKDEpIHJlc2V0XG4gIGV2ZXJ5IHBvc3NpYmxlIHByb3BlcnR5IGZvciBldmVyeSBwb3NzaWJsZSBzZWxlY3RvciBmb3IgYSBnaXZlbiBzY29wZSBuYW1lO1xuICAoMikgcmUtaW1wbGVtZW50IGNzcyBpbiBqYXZhc2NyaXB0LlxuXG4gIEFzIGFuIGFsdGVybmF0aXZlLCB1c2VycyBzaG91bGQgbWFrZSBzdXJlIHRvIHVzZSBzZWxlY3RvcnNcbiAgc3BlY2lmaWMgdG8gdGhlIHNjb3BlIGluIHdoaWNoIHRoZXkgYXJlIHdvcmtpbmcuXG5cbiAgKiA6OmRpc3RyaWJ1dGVkOiBUaGlzIGJlaGF2aW9yIGlzIG5vdCBlbXVsYXRlZC4gSXQncyBvZnRlbiBub3QgbmVjZXNzYXJ5XG4gIHRvIHN0eWxlIHRoZSBjb250ZW50cyBvZiBhIHNwZWNpZmljIGluc2VydGlvbiBwb2ludCBhbmQgaW5zdGVhZCwgZGVzY2VuZGFudHNcbiAgb2YgdGhlIGhvc3QgZWxlbWVudCBjYW4gYmUgc3R5bGVkIHNlbGVjdGl2ZWx5LiBVc2VycyBjYW4gYWxzbyBjcmVhdGUgYW5cbiAgZXh0cmEgbm9kZSBhcm91bmQgYW4gaW5zZXJ0aW9uIHBvaW50IGFuZCBzdHlsZSB0aGF0IG5vZGUncyBjb250ZW50c1xuICB2aWEgZGVzY2VuZGVudCBzZWxlY3RvcnMuIEZvciBleGFtcGxlLCB3aXRoIGEgc2hhZG93Um9vdCBsaWtlIHRoaXM6XG5cbiAgICA8c3R5bGU+XG4gICAgICA6OmNvbnRlbnQoZGl2KSB7XG4gICAgICAgIGJhY2tncm91bmQ6IHJlZDtcbiAgICAgIH1cbiAgICA8L3N0eWxlPlxuICAgIDxjb250ZW50PjwvY29udGVudD5cblxuICBjb3VsZCBiZWNvbWU6XG5cbiAgICA8c3R5bGU+XG4gICAgICAvICpAcG9seWZpbGwgLmNvbnRlbnQtY29udGFpbmVyIGRpdiAqIC9cbiAgICAgIDo6Y29udGVudChkaXYpIHtcbiAgICAgICAgYmFja2dyb3VuZDogcmVkO1xuICAgICAgfVxuICAgIDwvc3R5bGU+XG4gICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtY29udGFpbmVyXCI+XG4gICAgICA8Y29udGVudD48L2NvbnRlbnQ+XG4gICAgPC9kaXY+XG5cbiAgTm90ZSB0aGUgdXNlIG9mIEBwb2x5ZmlsbCBpbiB0aGUgY29tbWVudCBhYm92ZSBhIFNoYWRvd0RPTSBzcGVjaWZpYyBzdHlsZVxuICBkZWNsYXJhdGlvbi4gVGhpcyBpcyBhIGRpcmVjdGl2ZSB0byB0aGUgc3R5bGluZyBzaGltIHRvIHVzZSB0aGUgc2VsZWN0b3JcbiAgaW4gY29tbWVudHMgaW4gbGlldSBvZiB0aGUgbmV4dCBzZWxlY3RvciB3aGVuIHJ1bm5pbmcgdW5kZXIgcG9seWZpbGwuXG4qL1xuZXhwb3J0IGNsYXNzIFNoYWRvd0NzcyB7XG4gIC8qXG4gICAqIFNoaW0gc29tZSBjc3NUZXh0IHdpdGggdGhlIGdpdmVuIHNlbGVjdG9yLiBSZXR1cm5zIGNzc1RleHQgdGhhdCBjYW4gYmUgaW5jbHVkZWQgaW4gdGhlIGRvY3VtZW50XG4gICAqXG4gICAqIFRoZSBzZWxlY3RvciBpcyB0aGUgYXR0cmlidXRlIGFkZGVkIHRvIGFsbCBlbGVtZW50cyBpbnNpZGUgdGhlIGhvc3QsXG4gICAqIFRoZSBob3N0U2VsZWN0b3IgaXMgdGhlIGF0dHJpYnV0ZSBhZGRlZCB0byB0aGUgaG9zdCBpdHNlbGYuXG4gICAqL1xuICBzaGltQ3NzVGV4dChjc3NUZXh0OiBzdHJpbmcsIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nID0gJycpOiBzdHJpbmcge1xuICAgIC8vICoqTk9URSoqOiBEbyBub3Qgc3RyaXAgY29tbWVudHMgYXMgdGhpcyB3aWxsIGNhdXNlIGNvbXBvbmVudCBzb3VyY2VtYXBzIHRvIGJyZWFrXG4gICAgLy8gZHVlIHRvIHNoaWZ0IGluIGxpbmVzLlxuXG4gICAgLy8gQ29sbGVjdCBjb21tZW50cyBhbmQgcmVwbGFjZSB0aGVtIHdpdGggYSBwbGFjZWhvbGRlciwgdGhpcyBpcyBkb25lIHRvIGF2b2lkIGNvbXBsaWNhdGluZ1xuICAgIC8vIHRoZSBydWxlIHBhcnNpbmcgUmVnRXhwIGFuZCBrZWVwIGl0IHNhZmVyLlxuICAgIGNvbnN0IGNvbW1lbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNzc1RleHQgPSBjc3NUZXh0LnJlcGxhY2UoX2NvbW1lbnRSZSwgKG0pID0+IHtcbiAgICAgIGlmIChtLm1hdGNoKF9jb21tZW50V2l0aEhhc2hSZSkpIHtcbiAgICAgICAgY29tbWVudHMucHVzaChtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFJlcGxhY2Ugbm9uIGhhc2ggY29tbWVudHMgd2l0aCBlbXB0eSBsaW5lcy5cbiAgICAgICAgLy8gVGhpcyBpcyBkb25lIHNvIHRoYXQgd2UgZG8gbm90IGxlYWsgYW55IHNlbnNpdGl2ZSBkYXRhIGluIGNvbW1lbnRzLlxuICAgICAgICBjb25zdCBuZXdMaW5lc01hdGNoZXMgPSBtLm1hdGNoKF9uZXdMaW5lc1JlKTtcbiAgICAgICAgY29tbWVudHMucHVzaCgobmV3TGluZXNNYXRjaGVzPy5qb2luKCcnKSA/PyAnJykgKyAnXFxuJyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBDT01NRU5UX1BMQUNFSE9MREVSO1xuICAgIH0pO1xuXG4gICAgY3NzVGV4dCA9IHRoaXMuX2luc2VydERpcmVjdGl2ZXMoY3NzVGV4dCk7XG4gICAgY29uc3Qgc2NvcGVkQ3NzVGV4dCA9IHRoaXMuX3Njb3BlQ3NzVGV4dChjc3NUZXh0LCBzZWxlY3RvciwgaG9zdFNlbGVjdG9yKTtcbiAgICAvLyBBZGQgYmFjayBjb21tZW50cyBhdCB0aGUgb3JpZ2luYWwgcG9zaXRpb24uXG4gICAgbGV0IGNvbW1lbnRJZHggPSAwO1xuICAgIHJldHVybiBzY29wZWRDc3NUZXh0LnJlcGxhY2UoX2NvbW1lbnRXaXRoSGFzaFBsYWNlSG9sZGVyUmUsICgpID0+IGNvbW1lbnRzW2NvbW1lbnRJZHgrK10pO1xuICB9XG5cbiAgcHJpdmF0ZSBfaW5zZXJ0RGlyZWN0aXZlcyhjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNzc1RleHQgPSB0aGlzLl9pbnNlcnRQb2x5ZmlsbERpcmVjdGl2ZXNJbkNzc1RleHQoY3NzVGV4dCk7XG4gICAgcmV0dXJuIHRoaXMuX2luc2VydFBvbHlmaWxsUnVsZXNJbkNzc1RleHQoY3NzVGV4dCk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBzdHlsZXMgdG8gYWRkIHNjb3BlIHRvIGtleWZyYW1lcy5cbiAgICpcbiAgICogTW9kaWZ5IGJvdGggdGhlIG5hbWVzIG9mIHRoZSBrZXlmcmFtZXMgZGVmaW5lZCBpbiB0aGUgY29tcG9uZW50IHN0eWxlcyBhbmQgYWxzbyB0aGUgY3NzXG4gICAqIGFuaW1hdGlvbiBydWxlcyB1c2luZyB0aGVtLlxuICAgKlxuICAgKiBBbmltYXRpb24gcnVsZXMgdXNpbmcga2V5ZnJhbWVzIGRlZmluZWQgZWxzZXdoZXJlIGFyZSBub3QgbW9kaWZpZWQgdG8gYWxsb3cgZm9yIGdsb2JhbGx5XG4gICAqIGRlZmluZWQga2V5ZnJhbWVzLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSwgd2UgY29udmVydCB0aGlzIGNzczpcbiAgICpcbiAgICogYGBgXG4gICAqIC5ib3gge1xuICAgKiAgIGFuaW1hdGlvbjogYm94LWFuaW1hdGlvbiAxcyBmb3J3YXJkcztcbiAgICogfVxuICAgKlxuICAgKiBAa2V5ZnJhbWVzIGJveC1hbmltYXRpb24ge1xuICAgKiAgIHRvIHtcbiAgICogICAgIGJhY2tncm91bmQtY29sb3I6IGdyZWVuO1xuICAgKiAgIH1cbiAgICogfVxuICAgKiBgYGBcbiAgICpcbiAgICogdG8gdGhpczpcbiAgICpcbiAgICogYGBgXG4gICAqIC5ib3gge1xuICAgKiAgIGFuaW1hdGlvbjogc2NvcGVOYW1lX2JveC1hbmltYXRpb24gMXMgZm9yd2FyZHM7XG4gICAqIH1cbiAgICpcbiAgICogQGtleWZyYW1lcyBzY29wZU5hbWVfYm94LWFuaW1hdGlvbiB7XG4gICAqICAgdG8ge1xuICAgKiAgICAgYmFja2dyb3VuZC1jb2xvcjogZ3JlZW47XG4gICAqICAgfVxuICAgKiB9XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gY3NzVGV4dCB0aGUgY29tcG9uZW50J3MgY3NzIHRleHQgdGhhdCBuZWVkcyB0byBiZSBzY29wZWQuXG4gICAqIEBwYXJhbSBzY29wZVNlbGVjdG9yIHRoZSBjb21wb25lbnQncyBzY29wZSBzZWxlY3Rvci5cbiAgICpcbiAgICogQHJldHVybnMgdGhlIHNjb3BlZCBjc3MgdGV4dC5cbiAgICovXG4gIHByaXZhdGUgX3Njb3BlS2V5ZnJhbWVzUmVsYXRlZENzcyhjc3NUZXh0OiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgdW5zY29wZWRLZXlmcmFtZXNTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBzY29wZWRLZXlmcmFtZXNDc3NUZXh0ID0gcHJvY2Vzc1J1bGVzKGNzc1RleHQsIChydWxlKSA9PlxuICAgICAgdGhpcy5fc2NvcGVMb2NhbEtleWZyYW1lRGVjbGFyYXRpb25zKHJ1bGUsIHNjb3BlU2VsZWN0b3IsIHVuc2NvcGVkS2V5ZnJhbWVzU2V0KSxcbiAgICApO1xuICAgIHJldHVybiBwcm9jZXNzUnVsZXMoc2NvcGVkS2V5ZnJhbWVzQ3NzVGV4dCwgKHJ1bGUpID0+XG4gICAgICB0aGlzLl9zY29wZUFuaW1hdGlvblJ1bGUocnVsZSwgc2NvcGVTZWxlY3RvciwgdW5zY29wZWRLZXlmcmFtZXNTZXQpLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogU2NvcGVzIGxvY2FsIGtleWZyYW1lcyBuYW1lcywgcmV0dXJuaW5nIHRoZSB1cGRhdGVkIGNzcyBydWxlIGFuZCBpdCBhbHNvXG4gICAqIGFkZHMgdGhlIG9yaWdpbmFsIGtleWZyYW1lIG5hbWUgdG8gYSBwcm92aWRlZCBzZXQgdG8gY29sbGVjdCBhbGwga2V5ZnJhbWVzIG5hbWVzXG4gICAqIHNvIHRoYXQgaXQgY2FuIGxhdGVyIGJlIHVzZWQgdG8gc2NvcGUgdGhlIGFuaW1hdGlvbiBydWxlcy5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIGl0IHRha2VzIGEgcnVsZSBzdWNoIGFzOlxuICAgKlxuICAgKiBgYGBcbiAgICogQGtleWZyYW1lcyBib3gtYW5pbWF0aW9uIHtcbiAgICogICB0byB7XG4gICAqICAgICBiYWNrZ3JvdW5kLWNvbG9yOiBncmVlbjtcbiAgICogICB9XG4gICAqIH1cbiAgICogYGBgXG4gICAqXG4gICAqIGFuZCByZXR1cm5zOlxuICAgKlxuICAgKiBgYGBcbiAgICogQGtleWZyYW1lcyBzY29wZU5hbWVfYm94LWFuaW1hdGlvbiB7XG4gICAqICAgdG8ge1xuICAgKiAgICAgYmFja2dyb3VuZC1jb2xvcjogZ3JlZW47XG4gICAqICAgfVxuICAgKiB9XG4gICAqIGBgYFxuICAgKiBhbmQgYXMgYSBzaWRlIGVmZmVjdCBpdCBhZGRzIFwiYm94LWFuaW1hdGlvblwiIHRvIHRoZSBgdW5zY29wZWRLZXlmcmFtZXNTZXRgIHNldFxuICAgKlxuICAgKiBAcGFyYW0gY3NzUnVsZSB0aGUgY3NzIHJ1bGUgdG8gcHJvY2Vzcy5cbiAgICogQHBhcmFtIHNjb3BlU2VsZWN0b3IgdGhlIGNvbXBvbmVudCdzIHNjb3BlIHNlbGVjdG9yLlxuICAgKiBAcGFyYW0gdW5zY29wZWRLZXlmcmFtZXNTZXQgdGhlIHNldCBvZiB1bnNjb3BlZCBrZXlmcmFtZXMgbmFtZXMgKHdoaWNoIGNhbiBiZVxuICAgKiBtb2RpZmllZCBhcyBhIHNpZGUgZWZmZWN0KVxuICAgKlxuICAgKiBAcmV0dXJucyB0aGUgY3NzIHJ1bGUgbW9kaWZpZWQgd2l0aCB0aGUgc2NvcGVkIGtleWZyYW1lcyBuYW1lLlxuICAgKi9cbiAgcHJpdmF0ZSBfc2NvcGVMb2NhbEtleWZyYW1lRGVjbGFyYXRpb25zKFxuICAgIHJ1bGU6IENzc1J1bGUsXG4gICAgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLFxuICAgIHVuc2NvcGVkS2V5ZnJhbWVzU2V0OiBTZXQ8c3RyaW5nPixcbiAgKTogQ3NzUnVsZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnJ1bGUsXG4gICAgICBzZWxlY3RvcjogcnVsZS5zZWxlY3Rvci5yZXBsYWNlKFxuICAgICAgICAvKF5AKD86LXdlYmtpdC0pP2tleWZyYW1lcyg/OlxccyspKShbJ1wiXT8pKC4rKVxcMihcXHMqKSQvLFxuICAgICAgICAoXywgc3RhcnQsIHF1b3RlLCBrZXlmcmFtZU5hbWUsIGVuZFNwYWNlcykgPT4ge1xuICAgICAgICAgIHVuc2NvcGVkS2V5ZnJhbWVzU2V0LmFkZCh1bmVzY2FwZVF1b3RlcyhrZXlmcmFtZU5hbWUsIHF1b3RlKSk7XG4gICAgICAgICAgcmV0dXJuIGAke3N0YXJ0fSR7cXVvdGV9JHtzY29wZVNlbGVjdG9yfV8ke2tleWZyYW1lTmFtZX0ke3F1b3RlfSR7ZW5kU3BhY2VzfWA7XG4gICAgICAgIH0sXG4gICAgICApLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRnVuY3Rpb24gdXNlZCB0byBzY29wZSBhIGtleWZyYW1lcyBuYW1lIChvYnRhaW5lZCBmcm9tIGFuIGFuaW1hdGlvbiBkZWNsYXJhdGlvbilcbiAgICogdXNpbmcgYW4gZXhpc3Rpbmcgc2V0IG9mIHVuc2NvcGVkS2V5ZnJhbWVzIG5hbWVzIHRvIGRpc2Nlcm4gaWYgdGhlIHNjb3BpbmcgbmVlZHMgdG8gYmVcbiAgICogcGVyZm9ybWVkIChrZXlmcmFtZXMgbmFtZXMgb2Yga2V5ZnJhbWVzIG5vdCBkZWZpbmVkIGluIHRoZSBjb21wb25lbnQncyBjc3MgbmVlZCBub3QgdG8gYmVcbiAgICogc2NvcGVkKS5cbiAgICpcbiAgICogQHBhcmFtIGtleWZyYW1lIHRoZSBrZXlmcmFtZXMgbmFtZSB0byBjaGVjay5cbiAgICogQHBhcmFtIHNjb3BlU2VsZWN0b3IgdGhlIGNvbXBvbmVudCdzIHNjb3BlIHNlbGVjdG9yLlxuICAgKiBAcGFyYW0gdW5zY29wZWRLZXlmcmFtZXNTZXQgdGhlIHNldCBvZiB1bnNjb3BlZCBrZXlmcmFtZXMgbmFtZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHRoZSBzY29wZWQgbmFtZSBvZiB0aGUga2V5ZnJhbWUsIG9yIHRoZSBvcmlnaW5hbCBuYW1lIGlzIHRoZSBuYW1lIG5lZWQgbm90IHRvIGJlXG4gICAqIHNjb3BlZC5cbiAgICovXG4gIHByaXZhdGUgX3Njb3BlQW5pbWF0aW9uS2V5ZnJhbWUoXG4gICAga2V5ZnJhbWU6IHN0cmluZyxcbiAgICBzY29wZVNlbGVjdG9yOiBzdHJpbmcsXG4gICAgdW5zY29wZWRLZXlmcmFtZXNTZXQ6IFJlYWRvbmx5U2V0PHN0cmluZz4sXG4gICk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGtleWZyYW1lLnJlcGxhY2UoL14oXFxzKikoWydcIl0/KSguKz8pXFwyKFxccyopJC8sIChfLCBzcGFjZXMxLCBxdW90ZSwgbmFtZSwgc3BhY2VzMikgPT4ge1xuICAgICAgbmFtZSA9IGAke3Vuc2NvcGVkS2V5ZnJhbWVzU2V0Lmhhcyh1bmVzY2FwZVF1b3RlcyhuYW1lLCBxdW90ZSkpID8gc2NvcGVTZWxlY3RvciArICdfJyA6ICcnfSR7bmFtZX1gO1xuICAgICAgcmV0dXJuIGAke3NwYWNlczF9JHtxdW90ZX0ke25hbWV9JHtxdW90ZX0ke3NwYWNlczJ9YDtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWd1bGFyIGV4cHJlc3Npb24gdXNlZCB0byBleHRyYXBvbGF0ZSB0aGUgcG9zc2libGUga2V5ZnJhbWVzIGZyb20gYW5cbiAgICogYW5pbWF0aW9uIGRlY2xhcmF0aW9uICh3aXRoIHBvc3NpYmx5IG11bHRpcGxlIGFuaW1hdGlvbiBkZWZpbml0aW9ucylcbiAgICpcbiAgICogVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBjYW4gYmUgZGl2aWRlZCBpbiB0aHJlZSBwYXJ0c1xuICAgKiAgLSAoXnxcXHMrKVxuICAgKiAgICBzaW1wbHkgY2FwdHVyZXMgaG93IG1hbnkgKGlmIGFueSkgbGVhZGluZyB3aGl0ZXNwYWNlcyBhcmUgcHJlc2VudFxuICAgKiAgLSAoPzooPzooWydcIl0pKCg/OlxcXFxcXFxcfFxcXFxcXDJ8KD8hXFwyKS4pKylcXDIpfCgtP1tBLVphLXpdW1xcd1xcLV0qKSlcbiAgICogICAgY2FwdHVyZXMgdHdvIGRpZmZlcmVudCBwb3NzaWJsZSBrZXlmcmFtZXMsIG9uZXMgd2hpY2ggYXJlIHF1b3RlZCBvciBvbmVzIHdoaWNoIGFyZSB2YWxpZCBjc3NcbiAgICogaWRlbnRzIChjdXN0b20gcHJvcGVydGllcyBleGNsdWRlZClcbiAgICogIC0gKD89WyxcXHM7XXwkKVxuICAgKiAgICBzaW1wbHkgbWF0Y2hlcyB0aGUgZW5kIG9mIHRoZSBwb3NzaWJsZSBrZXlmcmFtZSwgdmFsaWQgZW5kaW5ncyBhcmU6IGEgY29tbWEsIGEgc3BhY2UsIGFcbiAgICogc2VtaWNvbG9uIG9yIHRoZSBlbmQgb2YgdGhlIHN0cmluZ1xuICAgKi9cbiAgcHJpdmF0ZSBfYW5pbWF0aW9uRGVjbGFyYXRpb25LZXlmcmFtZXNSZSA9XG4gICAgLyhefFxccyspKD86KD86KFsnXCJdKSgoPzpcXFxcXFxcXHxcXFxcXFwyfCg/IVxcMikuKSspXFwyKXwoLT9bQS1aYS16XVtcXHdcXC1dKikpKD89WyxcXHNdfCQpL2c7XG5cbiAgLyoqXG4gICAqIFNjb3BlIGFuIGFuaW1hdGlvbiBydWxlIHNvIHRoYXQgdGhlIGtleWZyYW1lcyBtZW50aW9uZWQgaW4gc3VjaCBydWxlXG4gICAqIGFyZSBzY29wZWQgaWYgZGVmaW5lZCBpbiB0aGUgY29tcG9uZW50J3MgY3NzIGFuZCBsZWZ0IHVudG91Y2hlZCBvdGhlcndpc2UuXG4gICAqXG4gICAqIEl0IGNhbiBzY29wZSB2YWx1ZXMgb2YgYm90aCB0aGUgJ2FuaW1hdGlvbicgYW5kICdhbmltYXRpb24tbmFtZScgcHJvcGVydGllcy5cbiAgICpcbiAgICogQHBhcmFtIHJ1bGUgY3NzIHJ1bGUgdG8gc2NvcGUuXG4gICAqIEBwYXJhbSBzY29wZVNlbGVjdG9yIHRoZSBjb21wb25lbnQncyBzY29wZSBzZWxlY3Rvci5cbiAgICogQHBhcmFtIHVuc2NvcGVkS2V5ZnJhbWVzU2V0IHRoZSBzZXQgb2YgdW5zY29wZWQga2V5ZnJhbWVzIG5hbWVzLlxuICAgKlxuICAgKiBAcmV0dXJucyB0aGUgdXBkYXRlZCBjc3MgcnVsZS5cbiAgICoqL1xuICBwcml2YXRlIF9zY29wZUFuaW1hdGlvblJ1bGUoXG4gICAgcnVsZTogQ3NzUnVsZSxcbiAgICBzY29wZVNlbGVjdG9yOiBzdHJpbmcsXG4gICAgdW5zY29wZWRLZXlmcmFtZXNTZXQ6IFJlYWRvbmx5U2V0PHN0cmluZz4sXG4gICk6IENzc1J1bGUge1xuICAgIGxldCBjb250ZW50ID0gcnVsZS5jb250ZW50LnJlcGxhY2UoXG4gICAgICAvKCg/Ol58XFxzK3w7KSg/Oi13ZWJraXQtKT9hbmltYXRpb24oPzpcXHMqKTooPzpcXHMqKSkoW147XSspL2csXG4gICAgICAoXywgc3RhcnQsIGFuaW1hdGlvbkRlY2xhcmF0aW9ucykgPT5cbiAgICAgICAgc3RhcnQgK1xuICAgICAgICBhbmltYXRpb25EZWNsYXJhdGlvbnMucmVwbGFjZShcbiAgICAgICAgICB0aGlzLl9hbmltYXRpb25EZWNsYXJhdGlvbktleWZyYW1lc1JlLFxuICAgICAgICAgIChcbiAgICAgICAgICAgIG9yaWdpbmFsOiBzdHJpbmcsXG4gICAgICAgICAgICBsZWFkaW5nU3BhY2VzOiBzdHJpbmcsXG4gICAgICAgICAgICBxdW90ZSA9ICcnLFxuICAgICAgICAgICAgcXVvdGVkTmFtZTogc3RyaW5nLFxuICAgICAgICAgICAgbm9uUXVvdGVkTmFtZTogc3RyaW5nLFxuICAgICAgICAgICkgPT4ge1xuICAgICAgICAgICAgaWYgKHF1b3RlZE5hbWUpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGAke2xlYWRpbmdTcGFjZXN9JHt0aGlzLl9zY29wZUFuaW1hdGlvbktleWZyYW1lKFxuICAgICAgICAgICAgICAgIGAke3F1b3RlfSR7cXVvdGVkTmFtZX0ke3F1b3RlfWAsXG4gICAgICAgICAgICAgICAgc2NvcGVTZWxlY3RvcixcbiAgICAgICAgICAgICAgICB1bnNjb3BlZEtleWZyYW1lc1NldCxcbiAgICAgICAgICAgICAgKX1gO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGFuaW1hdGlvbktleXdvcmRzLmhhcyhub25RdW90ZWROYW1lKVxuICAgICAgICAgICAgICAgID8gb3JpZ2luYWxcbiAgICAgICAgICAgICAgICA6IGAke2xlYWRpbmdTcGFjZXN9JHt0aGlzLl9zY29wZUFuaW1hdGlvbktleWZyYW1lKFxuICAgICAgICAgICAgICAgICAgICBub25RdW90ZWROYW1lLFxuICAgICAgICAgICAgICAgICAgICBzY29wZVNlbGVjdG9yLFxuICAgICAgICAgICAgICAgICAgICB1bnNjb3BlZEtleWZyYW1lc1NldCxcbiAgICAgICAgICAgICAgICAgICl9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICApLFxuICAgICk7XG4gICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZShcbiAgICAgIC8oKD86XnxcXHMrfDspKD86LXdlYmtpdC0pP2FuaW1hdGlvbi1uYW1lKD86XFxzKik6KD86XFxzKikpKFteO10rKS9nLFxuICAgICAgKF9tYXRjaCwgc3RhcnQsIGNvbW1hU2VwYXJhdGVkS2V5ZnJhbWVzKSA9PlxuICAgICAgICBgJHtzdGFydH0ke2NvbW1hU2VwYXJhdGVkS2V5ZnJhbWVzXG4gICAgICAgICAgLnNwbGl0KCcsJylcbiAgICAgICAgICAubWFwKChrZXlmcmFtZTogc3RyaW5nKSA9PlxuICAgICAgICAgICAgdGhpcy5fc2NvcGVBbmltYXRpb25LZXlmcmFtZShrZXlmcmFtZSwgc2NvcGVTZWxlY3RvciwgdW5zY29wZWRLZXlmcmFtZXNTZXQpLFxuICAgICAgICAgIClcbiAgICAgICAgICAuam9pbignLCcpfWAsXG4gICAgKTtcbiAgICByZXR1cm4gey4uLnJ1bGUsIGNvbnRlbnR9O1xuICB9XG5cbiAgLypcbiAgICogUHJvY2VzcyBzdHlsZXMgdG8gY29udmVydCBuYXRpdmUgU2hhZG93RE9NIHJ1bGVzIHRoYXQgd2lsbCB0cmlwXG4gICAqIHVwIHRoZSBjc3MgcGFyc2VyOyB3ZSByZWx5IG9uIGRlY29yYXRpbmcgdGhlIHN0eWxlc2hlZXQgd2l0aCBpbmVydCBydWxlcy5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIHdlIGNvbnZlcnQgdGhpcyBydWxlOlxuICAgKlxuICAgKiBwb2x5ZmlsbC1uZXh0LXNlbGVjdG9yIHsgY29udGVudDogJzpob3N0IG1lbnUtaXRlbSc7IH1cbiAgICogOjpjb250ZW50IG1lbnUtaXRlbSB7XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIHNjb3BlTmFtZSBtZW51LWl0ZW0ge1xuICAgKlxuICAgKiovXG4gIHByaXZhdGUgX2luc2VydFBvbHlmaWxsRGlyZWN0aXZlc0luQ3NzVGV4dChjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjc3NUZXh0LnJlcGxhY2UoX2Nzc0NvbnRlbnROZXh0U2VsZWN0b3JSZSwgZnVuY3Rpb24gKC4uLm06IHN0cmluZ1tdKSB7XG4gICAgICByZXR1cm4gbVsyXSArICd7JztcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBydWxlcyB3aGljaCB3aWxsIG9ubHkgYXBwbHkgdW5kZXIgdGhlIHBvbHlmaWxsXG4gICAqXG4gICAqIEZvciBleGFtcGxlLCB3ZSBjb252ZXJ0IHRoaXMgcnVsZTpcbiAgICpcbiAgICogcG9seWZpbGwtcnVsZSB7XG4gICAqICAgY29udGVudDogJzpob3N0IG1lbnUtaXRlbSc7XG4gICAqIC4uLlxuICAgKiB9XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIHNjb3BlTmFtZSBtZW51LWl0ZW0gey4uLn1cbiAgICpcbiAgICoqL1xuICBwcml2YXRlIF9pbnNlcnRQb2x5ZmlsbFJ1bGVzSW5Dc3NUZXh0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGNzc1RleHQucmVwbGFjZShfY3NzQ29udGVudFJ1bGVSZSwgKC4uLm06IHN0cmluZ1tdKSA9PiB7XG4gICAgICBjb25zdCBydWxlID0gbVswXS5yZXBsYWNlKG1bMV0sICcnKS5yZXBsYWNlKG1bMl0sICcnKTtcbiAgICAgIHJldHVybiBtWzRdICsgcnVsZTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qIEVuc3VyZSBzdHlsZXMgYXJlIHNjb3BlZC4gUHNldWRvLXNjb3BpbmcgdGFrZXMgYSBydWxlIGxpa2U6XG4gICAqXG4gICAqICAuZm9vIHsuLi4gfVxuICAgKlxuICAgKiAgYW5kIGNvbnZlcnRzIHRoaXMgdG9cbiAgICpcbiAgICogIHNjb3BlTmFtZSAuZm9vIHsgLi4uIH1cbiAgICovXG4gIHByaXZhdGUgX3Njb3BlQ3NzVGV4dChjc3NUZXh0OiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVuc2NvcGVkUnVsZXMgPSB0aGlzLl9leHRyYWN0VW5zY29wZWRSdWxlc0Zyb21Dc3NUZXh0KGNzc1RleHQpO1xuICAgIC8vIHJlcGxhY2UgOmhvc3QgYW5kIDpob3N0LWNvbnRleHQgLXNoYWRvd2Nzc2hvc3QgYW5kIC1zaGFkb3djc3Nob3N0IHJlc3BlY3RpdmVseVxuICAgIGNzc1RleHQgPSB0aGlzLl9pbnNlcnRQb2x5ZmlsbEhvc3RJbkNzc1RleHQoY3NzVGV4dCk7XG4gICAgY3NzVGV4dCA9IHRoaXMuX2NvbnZlcnRDb2xvbkhvc3QoY3NzVGV4dCk7XG4gICAgY3NzVGV4dCA9IHRoaXMuX2NvbnZlcnRDb2xvbkhvc3RDb250ZXh0KGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9jb252ZXJ0U2hhZG93RE9NU2VsZWN0b3JzKGNzc1RleHQpO1xuICAgIGlmIChzY29wZVNlbGVjdG9yKSB7XG4gICAgICBjc3NUZXh0ID0gdGhpcy5fc2NvcGVLZXlmcmFtZXNSZWxhdGVkQ3NzKGNzc1RleHQsIHNjb3BlU2VsZWN0b3IpO1xuICAgICAgY3NzVGV4dCA9IHRoaXMuX3Njb3BlU2VsZWN0b3JzKGNzc1RleHQsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgfVxuICAgIGNzc1RleHQgPSBjc3NUZXh0ICsgJ1xcbicgKyB1bnNjb3BlZFJ1bGVzO1xuICAgIHJldHVybiBjc3NUZXh0LnRyaW0oKTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBydWxlcyB3aGljaCB3aWxsIG9ubHkgYXBwbHkgdW5kZXIgdGhlIHBvbHlmaWxsXG4gICAqIGFuZCBkbyBub3QgcHJvY2VzcyB2aWEgQ1NTT00uIChDU1NPTSBpcyBkZXN0cnVjdGl2ZSB0byBydWxlcyBvbiByYXJlXG4gICAqIG9jY2FzaW9ucywgZS5nLiAtd2Via2l0LWNhbGMgb24gU2FmYXJpLilcbiAgICogRm9yIGV4YW1wbGUsIHdlIGNvbnZlcnQgdGhpcyBydWxlOlxuICAgKlxuICAgKiBAcG9seWZpbGwtdW5zY29wZWQtcnVsZSB7XG4gICAqICAgY29udGVudDogJ21lbnUtaXRlbSc7XG4gICAqIC4uLiB9XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIG1lbnUtaXRlbSB7Li4ufVxuICAgKlxuICAgKiovXG4gIHByaXZhdGUgX2V4dHJhY3RVbnNjb3BlZFJ1bGVzRnJvbUNzc1RleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgciA9ICcnO1xuICAgIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICAgIF9jc3NDb250ZW50VW5zY29wZWRSdWxlUmUubGFzdEluZGV4ID0gMDtcbiAgICB3aGlsZSAoKG0gPSBfY3NzQ29udGVudFVuc2NvcGVkUnVsZVJlLmV4ZWMoY3NzVGV4dCkpICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBydWxlID0gbVswXS5yZXBsYWNlKG1bMl0sICcnKS5yZXBsYWNlKG1bMV0sIG1bNF0pO1xuICAgICAgciArPSBydWxlICsgJ1xcblxcbic7XG4gICAgfVxuICAgIHJldHVybiByO1xuICB9XG5cbiAgLypcbiAgICogY29udmVydCBhIHJ1bGUgbGlrZSA6aG9zdCguZm9vKSA+IC5iYXIgeyB9XG4gICAqXG4gICAqIHRvXG4gICAqXG4gICAqIC5mb288c2NvcGVOYW1lPiA+IC5iYXJcbiAgICovXG4gIHByaXZhdGUgX2NvbnZlcnRDb2xvbkhvc3QoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY3NzVGV4dC5yZXBsYWNlKF9jc3NDb2xvbkhvc3RSZSwgKF8sIGhvc3RTZWxlY3RvcnM6IHN0cmluZywgb3RoZXJTZWxlY3RvcnM6IHN0cmluZykgPT4ge1xuICAgICAgaWYgKGhvc3RTZWxlY3RvcnMpIHtcbiAgICAgICAgY29uc3QgY29udmVydGVkU2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBob3N0U2VsZWN0b3JBcnJheSA9IGhvc3RTZWxlY3RvcnMuc3BsaXQoJywnKS5tYXAoKHApID0+IHAudHJpbSgpKTtcbiAgICAgICAgZm9yIChjb25zdCBob3N0U2VsZWN0b3Igb2YgaG9zdFNlbGVjdG9yQXJyYXkpIHtcbiAgICAgICAgICBpZiAoIWhvc3RTZWxlY3RvcikgYnJlYWs7XG4gICAgICAgICAgY29uc3QgY29udmVydGVkU2VsZWN0b3IgPVxuICAgICAgICAgICAgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvciArIGhvc3RTZWxlY3Rvci5yZXBsYWNlKF9wb2x5ZmlsbEhvc3QsICcnKSArIG90aGVyU2VsZWN0b3JzO1xuICAgICAgICAgIGNvbnZlcnRlZFNlbGVjdG9ycy5wdXNoKGNvbnZlcnRlZFNlbGVjdG9yKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udmVydGVkU2VsZWN0b3JzLmpvaW4oJywnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yICsgb3RoZXJTZWxlY3RvcnM7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBjb252ZXJ0IGEgcnVsZSBsaWtlIDpob3N0LWNvbnRleHQoLmZvbykgPiAuYmFyIHsgfVxuICAgKlxuICAgKiB0b1xuICAgKlxuICAgKiAuZm9vPHNjb3BlTmFtZT4gPiAuYmFyLCAuZm9vIDxzY29wZU5hbWU+ID4gLmJhciB7IH1cbiAgICpcbiAgICogYW5kXG4gICAqXG4gICAqIDpob3N0LWNvbnRleHQoLmZvbzpob3N0KSAuYmFyIHsgLi4uIH1cbiAgICpcbiAgICogdG9cbiAgICpcbiAgICogLmZvbzxzY29wZU5hbWU+IC5iYXIgeyAuLi4gfVxuICAgKi9cbiAgcHJpdmF0ZSBfY29udmVydENvbG9uSG9zdENvbnRleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY3NzVGV4dC5yZXBsYWNlKF9jc3NDb2xvbkhvc3RDb250ZXh0UmVHbG9iYWwsIChzZWxlY3RvclRleHQpID0+IHtcbiAgICAgIC8vIFdlIGhhdmUgY2FwdHVyZWQgYSBzZWxlY3RvciB0aGF0IGNvbnRhaW5zIGEgYDpob3N0LWNvbnRleHRgIHJ1bGUuXG5cbiAgICAgIC8vIEZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGA6aG9zdC1jb250ZXh0YCBtYXkgY29udGFpbiBhIGNvbW1hIHNlcGFyYXRlZCBsaXN0IG9mIHNlbGVjdG9ycy5cbiAgICAgIC8vIEVhY2ggY29udGV4dCBzZWxlY3RvciBncm91cCB3aWxsIGNvbnRhaW4gYSBsaXN0IG9mIGhvc3QtY29udGV4dCBzZWxlY3RvcnMgdGhhdCBtdXN0IG1hdGNoXG4gICAgICAvLyBhbiBhbmNlc3RvciBvZiB0aGUgaG9zdC5cbiAgICAgIC8vIChOb3JtYWxseSBgY29udGV4dFNlbGVjdG9yR3JvdXBzYCB3aWxsIG9ubHkgY29udGFpbiBhIHNpbmdsZSBhcnJheSBvZiBjb250ZXh0IHNlbGVjdG9ycy4pXG4gICAgICBjb25zdCBjb250ZXh0U2VsZWN0b3JHcm91cHM6IHN0cmluZ1tdW10gPSBbW11dO1xuXG4gICAgICAvLyBUaGVyZSBtYXkgYmUgbW9yZSB0aGFuIGA6aG9zdC1jb250ZXh0YCBpbiB0aGlzIHNlbGVjdG9yIHNvIGBzZWxlY3RvclRleHRgIGNvdWxkIGxvb2sgbGlrZTpcbiAgICAgIC8vIGA6aG9zdC1jb250ZXh0KC5vbmUpOmhvc3QtY29udGV4dCgudHdvKWAuXG4gICAgICAvLyBFeGVjdXRlIGBfY3NzQ29sb25Ib3N0Q29udGV4dFJlYCBvdmVyIGFuZCBvdmVyIHVudGlsIHdlIGhhdmUgZXh0cmFjdGVkIGFsbCB0aGVcbiAgICAgIC8vIGA6aG9zdC1jb250ZXh0YCBzZWxlY3RvcnMgZnJvbSB0aGlzIHNlbGVjdG9yLlxuICAgICAgbGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICAgICAgd2hpbGUgKChtYXRjaCA9IF9jc3NDb2xvbkhvc3RDb250ZXh0UmUuZXhlYyhzZWxlY3RvclRleHQpKSkge1xuICAgICAgICAvLyBgbWF0Y2hgID0gWyc6aG9zdC1jb250ZXh0KDxzZWxlY3RvcnM+KTxyZXN0PicsIDxzZWxlY3RvcnM+LCA8cmVzdD5dXG5cbiAgICAgICAgLy8gVGhlIGA8c2VsZWN0b3JzPmAgY291bGQgYWN0dWFsbHkgYmUgYSBjb21tYSBzZXBhcmF0ZWQgbGlzdDogYDpob3N0LWNvbnRleHQoLm9uZSwgLnR3bylgLlxuICAgICAgICBjb25zdCBuZXdDb250ZXh0U2VsZWN0b3JzID0gKG1hdGNoWzFdID8/ICcnKVxuICAgICAgICAgIC50cmltKClcbiAgICAgICAgICAuc3BsaXQoJywnKVxuICAgICAgICAgIC5tYXAoKG0pID0+IG0udHJpbSgpKVxuICAgICAgICAgIC5maWx0ZXIoKG0pID0+IG0gIT09ICcnKTtcblxuICAgICAgICAvLyBXZSBtdXN0IGR1cGxpY2F0ZSB0aGUgY3VycmVudCBzZWxlY3RvciBncm91cCBmb3IgZWFjaCBvZiB0aGVzZSBuZXcgc2VsZWN0b3JzLlxuICAgICAgICAvLyBGb3IgZXhhbXBsZSBpZiB0aGUgY3VycmVudCBncm91cHMgYXJlOlxuICAgICAgICAvLyBgYGBcbiAgICAgICAgLy8gW1xuICAgICAgICAvLyAgIFsnYScsICdiJywgJ2MnXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6J10sXG4gICAgICAgIC8vIF1cbiAgICAgICAgLy8gYGBgXG4gICAgICAgIC8vIEFuZCB3ZSBoYXZlIGEgbmV3IHNldCBvZiBjb21tYSBzZXBhcmF0ZWQgc2VsZWN0b3JzOiBgOmhvc3QtY29udGV4dChtLG4pYCB0aGVuIHRoZSBuZXdcbiAgICAgICAgLy8gZ3JvdXBzIGFyZTpcbiAgICAgICAgLy8gYGBgXG4gICAgICAgIC8vIFtcbiAgICAgICAgLy8gICBbJ2EnLCAnYicsICdjJywgJ20nXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6JywgJ20nXSxcbiAgICAgICAgLy8gICBbJ2EnLCAnYicsICdjJywgJ24nXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6JywgJ24nXSxcbiAgICAgICAgLy8gXVxuICAgICAgICAvLyBgYGBcbiAgICAgICAgY29uc3QgY29udGV4dFNlbGVjdG9yR3JvdXBzTGVuZ3RoID0gY29udGV4dFNlbGVjdG9yR3JvdXBzLmxlbmd0aDtcbiAgICAgICAgcmVwZWF0R3JvdXBzKGNvbnRleHRTZWxlY3Rvckdyb3VwcywgbmV3Q29udGV4dFNlbGVjdG9ycy5sZW5ndGgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5ld0NvbnRleHRTZWxlY3RvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNvbnRleHRTZWxlY3Rvckdyb3Vwc0xlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBjb250ZXh0U2VsZWN0b3JHcm91cHNbaiArIGkgKiBjb250ZXh0U2VsZWN0b3JHcm91cHNMZW5ndGhdLnB1c2gobmV3Q29udGV4dFNlbGVjdG9yc1tpXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBgc2VsZWN0b3JUZXh0YCBhbmQgc2VlIHJlcGVhdCB0byBzZWUgaWYgdGhlcmUgYXJlIG1vcmUgYDpob3N0LWNvbnRleHRgcy5cbiAgICAgICAgc2VsZWN0b3JUZXh0ID0gbWF0Y2hbMl07XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBjb250ZXh0IHNlbGVjdG9ycyBub3cgbXVzdCBiZSBjb21iaW5lZCB3aXRoIGVhY2ggb3RoZXIgdG8gY2FwdHVyZSBhbGwgdGhlIHBvc3NpYmxlXG4gICAgICAvLyBzZWxlY3RvcnMgdGhhdCBgOmhvc3QtY29udGV4dGAgY2FuIG1hdGNoLiBTZWUgYGNvbWJpbmVIb3N0Q29udGV4dFNlbGVjdG9ycygpYCBmb3IgbW9yZVxuICAgICAgLy8gaW5mbyBhYm91dCBob3cgdGhpcyBpcyBkb25lLlxuICAgICAgcmV0dXJuIGNvbnRleHRTZWxlY3Rvckdyb3Vwc1xuICAgICAgICAubWFwKChjb250ZXh0U2VsZWN0b3JzKSA9PiBjb21iaW5lSG9zdENvbnRleHRTZWxlY3RvcnMoY29udGV4dFNlbGVjdG9ycywgc2VsZWN0b3JUZXh0KSlcbiAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBDb252ZXJ0IGNvbWJpbmF0b3JzIGxpa2UgOjpzaGFkb3cgYW5kIHBzZXVkby1lbGVtZW50cyBsaWtlIDo6Y29udGVudFxuICAgKiBieSByZXBsYWNpbmcgd2l0aCBzcGFjZS5cbiAgICovXG4gIHByaXZhdGUgX2NvbnZlcnRTaGFkb3dET01TZWxlY3RvcnMoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gX3NoYWRvd0RPTVNlbGVjdG9yc1JlLnJlZHVjZSgocmVzdWx0LCBwYXR0ZXJuKSA9PiByZXN1bHQucmVwbGFjZShwYXR0ZXJuLCAnICcpLCBjc3NUZXh0KTtcbiAgfVxuXG4gIC8vIGNoYW5nZSBhIHNlbGVjdG9yIGxpa2UgJ2RpdicgdG8gJ25hbWUgZGl2J1xuICBwcml2YXRlIF9zY29wZVNlbGVjdG9ycyhjc3NUZXh0OiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBwcm9jZXNzUnVsZXMoY3NzVGV4dCwgKHJ1bGU6IENzc1J1bGUpID0+IHtcbiAgICAgIGxldCBzZWxlY3RvciA9IHJ1bGUuc2VsZWN0b3I7XG4gICAgICBsZXQgY29udGVudCA9IHJ1bGUuY29udGVudDtcbiAgICAgIGlmIChydWxlLnNlbGVjdG9yWzBdICE9PSAnQCcpIHtcbiAgICAgICAgc2VsZWN0b3IgPSB0aGlzLl9zY29wZVNlbGVjdG9yKHJ1bGUuc2VsZWN0b3IsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgICB9IGVsc2UgaWYgKHNjb3BlZEF0UnVsZUlkZW50aWZpZXJzLnNvbWUoKGF0UnVsZSkgPT4gcnVsZS5zZWxlY3Rvci5zdGFydHNXaXRoKGF0UnVsZSkpKSB7XG4gICAgICAgIGNvbnRlbnQgPSB0aGlzLl9zY29wZVNlbGVjdG9ycyhydWxlLmNvbnRlbnQsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgICB9IGVsc2UgaWYgKHJ1bGUuc2VsZWN0b3Iuc3RhcnRzV2l0aCgnQGZvbnQtZmFjZScpIHx8IHJ1bGUuc2VsZWN0b3Iuc3RhcnRzV2l0aCgnQHBhZ2UnKSkge1xuICAgICAgICBjb250ZW50ID0gdGhpcy5fc3RyaXBTY29waW5nU2VsZWN0b3JzKHJ1bGUuY29udGVudCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IENzc1J1bGUoc2VsZWN0b3IsIGNvbnRlbnQpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIGNzcyB0ZXh0IHRoYXQgaXMgd2l0aGluIGEgcnVsZSB0aGF0IHNob3VsZCBub3QgY29udGFpbiBzY29wZSBzZWxlY3RvcnMgYnkgc2ltcGx5XG4gICAqIHJlbW92aW5nIHRoZW0hIEFuIGV4YW1wbGUgb2Ygc3VjaCBhIHJ1bGUgaXMgYEBmb250LWZhY2VgLlxuICAgKlxuICAgKiBgQGZvbnQtZmFjZWAgcnVsZXMgY2Fubm90IGNvbnRhaW4gbmVzdGVkIHNlbGVjdG9ycy4gTm9yIGNhbiB0aGV5IGJlIG5lc3RlZCB1bmRlciBhIHNlbGVjdG9yLlxuICAgKiBOb3JtYWxseSB0aGlzIHdvdWxkIGJlIGEgc3ludGF4IGVycm9yIGJ5IHRoZSBhdXRob3Igb2YgdGhlIHN0eWxlcy4gQnV0IGluIHNvbWUgcmFyZSBjYXNlcywgc3VjaFxuICAgKiBhcyBpbXBvcnRpbmcgc3R5bGVzIGZyb20gYSBsaWJyYXJ5LCBhbmQgYXBwbHlpbmcgYDpob3N0IDo6bmctZGVlcGAgdG8gdGhlIGltcG9ydGVkIHN0eWxlcywgd2VcbiAgICogY2FuIGVuZCB1cCB3aXRoIGJyb2tlbiBjc3MgaWYgdGhlIGltcG9ydGVkIHN0eWxlcyBoYXBwZW4gdG8gY29udGFpbiBAZm9udC1mYWNlIHJ1bGVzLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZTpcbiAgICpcbiAgICogYGBgXG4gICAqIDpob3N0IDo6bmctZGVlcCB7XG4gICAqICAgaW1wb3J0ICdzb21lL2xpYi9jb250YWluaW5nL2ZvbnQtZmFjZSc7XG4gICAqIH1cbiAgICpcbiAgICogU2ltaWxhciBsb2dpYyBhcHBsaWVzIHRvIGBAcGFnZWAgcnVsZXMgd2hpY2ggY2FuIGNvbnRhaW4gYSBwYXJ0aWN1bGFyIHNldCBvZiBwcm9wZXJ0aWVzLFxuICAgKiBhcyB3ZWxsIGFzIHNvbWUgc3BlY2lmaWMgYXQtcnVsZXMuIFNpbmNlIHRoZXkgY2FuJ3QgYmUgZW5jYXBzdWxhdGVkLCB3ZSBoYXZlIHRvIHN0cmlwXG4gICAqIGFueSBzY29waW5nIHNlbGVjdG9ycyBmcm9tIHRoZW0uIEZvciBtb3JlIGluZm9ybWF0aW9uOiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXBhZ2UtM1xuICAgKiBgYGBcbiAgICovXG4gIHByaXZhdGUgX3N0cmlwU2NvcGluZ1NlbGVjdG9ycyhjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBwcm9jZXNzUnVsZXMoY3NzVGV4dCwgKHJ1bGUpID0+IHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gcnVsZS5zZWxlY3RvclxuICAgICAgICAucmVwbGFjZShfc2hhZG93RGVlcFNlbGVjdG9ycywgJyAnKVxuICAgICAgICAucmVwbGFjZShfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yUmUsICcgJyk7XG4gICAgICByZXR1cm4gbmV3IENzc1J1bGUoc2VsZWN0b3IsIHJ1bGUuY29udGVudCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9zY29wZVNlbGVjdG9yKHNlbGVjdG9yOiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBzZWxlY3RvclxuICAgICAgLnNwbGl0KCcsJylcbiAgICAgIC5tYXAoKHBhcnQpID0+IHBhcnQudHJpbSgpLnNwbGl0KF9zaGFkb3dEZWVwU2VsZWN0b3JzKSlcbiAgICAgIC5tYXAoKGRlZXBQYXJ0cykgPT4ge1xuICAgICAgICBjb25zdCBbc2hhbGxvd1BhcnQsIC4uLm90aGVyUGFydHNdID0gZGVlcFBhcnRzO1xuICAgICAgICBjb25zdCBhcHBseVNjb3BlID0gKHNoYWxsb3dQYXJ0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAodGhpcy5fc2VsZWN0b3JOZWVkc1Njb3Bpbmcoc2hhbGxvd1BhcnQsIHNjb3BlU2VsZWN0b3IpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fYXBwbHlTZWxlY3RvclNjb3BlKHNoYWxsb3dQYXJ0LCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc2hhbGxvd1BhcnQ7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gW2FwcGx5U2NvcGUoc2hhbGxvd1BhcnQpLCAuLi5vdGhlclBhcnRzXS5qb2luKCcgJyk7XG4gICAgICB9KVxuICAgICAgLmpvaW4oJywgJyk7XG4gIH1cblxuICBwcml2YXRlIF9zZWxlY3Rvck5lZWRzU2NvcGluZyhzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCByZSA9IHRoaXMuX21ha2VTY29wZU1hdGNoZXIoc2NvcGVTZWxlY3Rvcik7XG4gICAgcmV0dXJuICFyZS50ZXN0KHNlbGVjdG9yKTtcbiAgfVxuXG4gIHByaXZhdGUgX21ha2VTY29wZU1hdGNoZXIoc2NvcGVTZWxlY3Rvcjogc3RyaW5nKTogUmVnRXhwIHtcbiAgICBjb25zdCBscmUgPSAvXFxbL2c7XG4gICAgY29uc3QgcnJlID0gL1xcXS9nO1xuICAgIHNjb3BlU2VsZWN0b3IgPSBzY29wZVNlbGVjdG9yLnJlcGxhY2UobHJlLCAnXFxcXFsnKS5yZXBsYWNlKHJyZSwgJ1xcXFxdJyk7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoJ14oJyArIHNjb3BlU2VsZWN0b3IgKyAnKScgKyBfc2VsZWN0b3JSZVN1ZmZpeCwgJ20nKTtcbiAgfVxuXG4gIC8vIHNjb3BlIHZpYSBuYW1lIGFuZCBbaXM9bmFtZV1cbiAgcHJpdmF0ZSBfYXBwbHlTaW1wbGVTZWxlY3RvclNjb3BlKFxuICAgIHNlbGVjdG9yOiBzdHJpbmcsXG4gICAgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLFxuICAgIGhvc3RTZWxlY3Rvcjogc3RyaW5nLFxuICApOiBzdHJpbmcge1xuICAgIC8vIEluIEFuZHJvaWQgYnJvd3NlciwgdGhlIGxhc3RJbmRleCBpcyBub3QgcmVzZXQgd2hlbiB0aGUgcmVnZXggaXMgdXNlZCBpbiBTdHJpbmcucmVwbGFjZSgpXG4gICAgX3BvbHlmaWxsSG9zdFJlLmxhc3RJbmRleCA9IDA7XG4gICAgaWYgKF9wb2x5ZmlsbEhvc3RSZS50ZXN0KHNlbGVjdG9yKSkge1xuICAgICAgY29uc3QgcmVwbGFjZUJ5ID0gYFske2hvc3RTZWxlY3Rvcn1dYDtcbiAgICAgIHJldHVybiBzZWxlY3RvclxuICAgICAgICAucmVwbGFjZShfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yUmUsIChobmMsIHNlbGVjdG9yKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHNlbGVjdG9yLnJlcGxhY2UoXG4gICAgICAgICAgICAvKFteOl0qKSg6KikoLiopLyxcbiAgICAgICAgICAgIChfOiBzdHJpbmcsIGJlZm9yZTogc3RyaW5nLCBjb2xvbjogc3RyaW5nLCBhZnRlcjogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBiZWZvcmUgKyByZXBsYWNlQnkgKyBjb2xvbiArIGFmdGVyO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICApO1xuICAgICAgICB9KVxuICAgICAgICAucmVwbGFjZShfcG9seWZpbGxIb3N0UmUsIHJlcGxhY2VCeSArICcgJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjb3BlU2VsZWN0b3IgKyAnICcgKyBzZWxlY3RvcjtcbiAgfVxuXG4gIC8vIHJldHVybiBhIHNlbGVjdG9yIHdpdGggW25hbWVdIHN1ZmZpeCBvbiBlYWNoIHNpbXBsZSBzZWxlY3RvclxuICAvLyBlLmcuIC5mb28uYmFyID4gLnpvdCBiZWNvbWVzIC5mb29bbmFtZV0uYmFyW25hbWVdID4gLnpvdFtuYW1lXSAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIF9hcHBseVNlbGVjdG9yU2NvcGUoXG4gICAgc2VsZWN0b3I6IHN0cmluZyxcbiAgICBzY29wZVNlbGVjdG9yOiBzdHJpbmcsXG4gICAgaG9zdFNlbGVjdG9yOiBzdHJpbmcsXG4gICk6IHN0cmluZyB7XG4gICAgY29uc3QgaXNSZSA9IC9cXFtpcz0oW15cXF1dKilcXF0vZztcbiAgICBzY29wZVNlbGVjdG9yID0gc2NvcGVTZWxlY3Rvci5yZXBsYWNlKGlzUmUsIChfOiBzdHJpbmcsIC4uLnBhcnRzOiBzdHJpbmdbXSkgPT4gcGFydHNbMF0pO1xuXG4gICAgY29uc3QgYXR0ck5hbWUgPSAnWycgKyBzY29wZVNlbGVjdG9yICsgJ10nO1xuXG4gICAgY29uc3QgX3Njb3BlU2VsZWN0b3JQYXJ0ID0gKHA6IHN0cmluZykgPT4ge1xuICAgICAgbGV0IHNjb3BlZFAgPSBwLnRyaW0oKTtcblxuICAgICAgaWYgKCFzY29wZWRQKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICAgIH1cblxuICAgICAgaWYgKHAuaW5kZXhPZihfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yKSA+IC0xKSB7XG4gICAgICAgIHNjb3BlZFAgPSB0aGlzLl9hcHBseVNpbXBsZVNlbGVjdG9yU2NvcGUocCwgc2NvcGVTZWxlY3RvciwgaG9zdFNlbGVjdG9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHJlbW92ZSA6aG9zdCBzaW5jZSBpdCBzaG91bGQgYmUgdW5uZWNlc3NhcnlcbiAgICAgICAgY29uc3QgdCA9IHAucmVwbGFjZShfcG9seWZpbGxIb3N0UmUsICcnKTtcbiAgICAgICAgaWYgKHQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSB0Lm1hdGNoKC8oW146XSopKDoqKSguKikvKTtcbiAgICAgICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICAgICAgc2NvcGVkUCA9IG1hdGNoZXNbMV0gKyBhdHRyTmFtZSArIG1hdGNoZXNbMl0gKyBtYXRjaGVzWzNdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2NvcGVkUDtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2FmZUNvbnRlbnQgPSBuZXcgU2FmZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICBzZWxlY3RvciA9IHNhZmVDb250ZW50LmNvbnRlbnQoKTtcblxuICAgIGxldCBzY29wZWRTZWxlY3RvciA9ICcnO1xuICAgIGxldCBzdGFydEluZGV4ID0gMDtcbiAgICBsZXQgcmVzOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICAgIGNvbnN0IHNlcCA9IC8oIHw+fFxcK3x+KD8hPSkpXFxzKi9nO1xuXG4gICAgLy8gSWYgYSBzZWxlY3RvciBhcHBlYXJzIGJlZm9yZSA6aG9zdCBpdCBzaG91bGQgbm90IGJlIHNoaW1tZWQgYXMgaXRcbiAgICAvLyBtYXRjaGVzIG9uIGFuY2VzdG9yIGVsZW1lbnRzIGFuZCBub3Qgb24gZWxlbWVudHMgaW4gdGhlIGhvc3QncyBzaGFkb3dcbiAgICAvLyBgOmhvc3QtY29udGV4dChkaXYpYCBpcyB0cmFuc2Zvcm1lZCB0b1xuICAgIC8vIGAtc2hhZG93Y3NzaG9zdC1uby1jb21iaW5hdG9yZGl2LCBkaXYgLXNoYWRvd2Nzc2hvc3Qtbm8tY29tYmluYXRvcmBcbiAgICAvLyB0aGUgYGRpdmAgaXMgbm90IHBhcnQgb2YgdGhlIGNvbXBvbmVudCBpbiB0aGUgMm5kIHNlbGVjdG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBzY29wZWQuXG4gICAgLy8gSGlzdG9yaWNhbGx5IGBjb21wb25lbnQtdGFnOmhvc3RgIHdhcyBtYXRjaGluZyB0aGUgY29tcG9uZW50IHNvIHdlIGFsc28gd2FudCB0byBwcmVzZXJ2ZVxuICAgIC8vIHRoaXMgYmVoYXZpb3IgdG8gYXZvaWQgYnJlYWtpbmcgbGVnYWN5IGFwcHMgKGl0IHNob3VsZCBub3QgbWF0Y2gpLlxuICAgIC8vIFRoZSBiZWhhdmlvciBzaG91bGQgYmU6XG4gICAgLy8gLSBgdGFnOmhvc3RgIC0+IGB0YWdbaF1gICh0aGlzIGlzIHRvIGF2b2lkIGJyZWFraW5nIGxlZ2FjeSBhcHBzLCBzaG91bGQgbm90IG1hdGNoIGFueXRoaW5nKVxuICAgIC8vIC0gYHRhZyA6aG9zdGAgLT4gYHRhZyBbaF1gIChgdGFnYCBpcyBub3Qgc2NvcGVkIGJlY2F1c2UgaXQncyBjb25zaWRlcmVkIHBhcnQgb2YgYVxuICAgIC8vICAgYDpob3N0LWNvbnRleHQodGFnKWApXG4gICAgY29uc3QgaGFzSG9zdCA9IHNlbGVjdG9yLmluZGV4T2YoX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvcikgPiAtMTtcbiAgICAvLyBPbmx5IHNjb3BlIHBhcnRzIGFmdGVyIHRoZSBmaXJzdCBgLXNoYWRvd2Nzc2hvc3Qtbm8tY29tYmluYXRvcmAgd2hlbiBpdCBpcyBwcmVzZW50XG4gICAgbGV0IHNob3VsZFNjb3BlID0gIWhhc0hvc3Q7XG5cbiAgICB3aGlsZSAoKHJlcyA9IHNlcC5leGVjKHNlbGVjdG9yKSkgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHNlcGFyYXRvciA9IHJlc1sxXTtcbiAgICAgIGNvbnN0IHBhcnQgPSBzZWxlY3Rvci5zbGljZShzdGFydEluZGV4LCByZXMuaW5kZXgpLnRyaW0oKTtcblxuICAgICAgLy8gQSBzcGFjZSBmb2xsb3dpbmcgYW4gZXNjYXBlZCBoZXggdmFsdWUgYW5kIGZvbGxvd2VkIGJ5IGFub3RoZXIgaGV4IGNoYXJhY3RlclxuICAgICAgLy8gKGllOiBcIi5cXGZjIGJlclwiIGZvciBcIi7DvGJlclwiKSBpcyBub3QgYSBzZXBhcmF0b3IgYmV0d2VlbiAyIHNlbGVjdG9yc1xuICAgICAgLy8gYWxzbyBrZWVwIGluIG1pbmQgdGhhdCBiYWNrc2xhc2hlcyBhcmUgcmVwbGFjZWQgYnkgYSBwbGFjZWhvbGRlciBieSBTYWZlU2VsZWN0b3JcbiAgICAgIC8vIFRoZXNlIGVzY2FwZWQgc2VsZWN0b3JzIGhhcHBlbiBmb3IgZXhhbXBsZSB3aGVuIGVzYnVpbGQgcnVucyB3aXRoIG9wdGltaXphdGlvbi5taW5pZnkuXG4gICAgICBpZiAocGFydC5tYXRjaCgvX19lc2MtcGgtKFxcZCspX18vKSAmJiBzZWxlY3RvcltyZXMuaW5kZXggKyAxXT8ubWF0Y2goL1thLWZBLUZcXGRdLykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHNob3VsZFNjb3BlID0gc2hvdWxkU2NvcGUgfHwgcGFydC5pbmRleE9mKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpID4gLTE7XG4gICAgICBjb25zdCBzY29wZWRQYXJ0ID0gc2hvdWxkU2NvcGUgPyBfc2NvcGVTZWxlY3RvclBhcnQocGFydCkgOiBwYXJ0O1xuICAgICAgc2NvcGVkU2VsZWN0b3IgKz0gYCR7c2NvcGVkUGFydH0gJHtzZXBhcmF0b3J9IGA7XG4gICAgICBzdGFydEluZGV4ID0gc2VwLmxhc3RJbmRleDtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJ0ID0gc2VsZWN0b3Iuc3Vic3RyaW5nKHN0YXJ0SW5kZXgpO1xuICAgIHNob3VsZFNjb3BlID0gc2hvdWxkU2NvcGUgfHwgcGFydC5pbmRleE9mKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpID4gLTE7XG4gICAgc2NvcGVkU2VsZWN0b3IgKz0gc2hvdWxkU2NvcGUgPyBfc2NvcGVTZWxlY3RvclBhcnQocGFydCkgOiBwYXJ0O1xuXG4gICAgLy8gcmVwbGFjZSB0aGUgcGxhY2Vob2xkZXJzIHdpdGggdGhlaXIgb3JpZ2luYWwgdmFsdWVzXG4gICAgcmV0dXJuIHNhZmVDb250ZW50LnJlc3RvcmUoc2NvcGVkU2VsZWN0b3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBfaW5zZXJ0UG9seWZpbGxIb3N0SW5Dc3NUZXh0KHNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBzZWxlY3RvclxuICAgICAgLnJlcGxhY2UoX2NvbG9uSG9zdENvbnRleHRSZSwgX3BvbHlmaWxsSG9zdENvbnRleHQpXG4gICAgICAucmVwbGFjZShfY29sb25Ib3N0UmUsIF9wb2x5ZmlsbEhvc3QpO1xuICB9XG59XG5cbmNsYXNzIFNhZmVTZWxlY3RvciB7XG4gIHByaXZhdGUgcGxhY2Vob2xkZXJzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfY29udGVudDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNlbGVjdG9yOiBzdHJpbmcpIHtcbiAgICAvLyBSZXBsYWNlcyBhdHRyaWJ1dGUgc2VsZWN0b3JzIHdpdGggcGxhY2Vob2xkZXJzLlxuICAgIC8vIFRoZSBXUyBpbiBbYXR0cj1cInZhIGx1ZVwiXSB3b3VsZCBvdGhlcndpc2UgYmUgaW50ZXJwcmV0ZWQgYXMgYSBzZWxlY3RvciBzZXBhcmF0b3IuXG4gICAgc2VsZWN0b3IgPSB0aGlzLl9lc2NhcGVSZWdleE1hdGNoZXMoc2VsZWN0b3IsIC8oXFxbW15cXF1dKlxcXSkvZyk7XG5cbiAgICAvLyBDU1MgYWxsb3dzIGZvciBjZXJ0YWluIHNwZWNpYWwgY2hhcmFjdGVycyB0byBiZSB1c2VkIGluIHNlbGVjdG9ycyBpZiB0aGV5J3JlIGVzY2FwZWQuXG4gICAgLy8gRS5nLiBgLmZvbzpibHVlYCB3b24ndCBtYXRjaCBhIGNsYXNzIGNhbGxlZCBgZm9vOmJsdWVgLCBiZWNhdXNlIHRoZSBjb2xvbiBkZW5vdGVzIGFcbiAgICAvLyBwc2V1ZG8tY2xhc3MsIGJ1dCB3cml0aW5nIGAuZm9vXFw6Ymx1ZWAgd2lsbCBtYXRjaCwgYmVjYXVzZSB0aGUgY29sb24gd2FzIGVzY2FwZWQuXG4gICAgLy8gUmVwbGFjZSBhbGwgZXNjYXBlIHNlcXVlbmNlcyAoYFxcYCBmb2xsb3dlZCBieSBhIGNoYXJhY3Rlcikgd2l0aCBhIHBsYWNlaG9sZGVyIHNvXG4gICAgLy8gdGhhdCBvdXIgaGFuZGxpbmcgb2YgcHNldWRvLXNlbGVjdG9ycyBkb2Vzbid0IG1lc3Mgd2l0aCB0aGVtLlxuICAgIC8vIEVzY2FwZWQgY2hhcmFjdGVycyBoYXZlIGEgc3BlY2lmaWMgcGxhY2Vob2xkZXIgc28gdGhleSBjYW4gYmUgZGV0ZWN0ZWQgc2VwYXJhdGVseS5cbiAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnJlcGxhY2UoLyhcXFxcLikvZywgKF8sIGtlZXApID0+IHtcbiAgICAgIGNvbnN0IHJlcGxhY2VCeSA9IGBfX2VzYy1waC0ke3RoaXMuaW5kZXh9X19gO1xuICAgICAgdGhpcy5wbGFjZWhvbGRlcnMucHVzaChrZWVwKTtcbiAgICAgIHRoaXMuaW5kZXgrKztcbiAgICAgIHJldHVybiByZXBsYWNlQnk7XG4gICAgfSk7XG5cbiAgICAvLyBSZXBsYWNlcyB0aGUgZXhwcmVzc2lvbiBpbiBgOm50aC1jaGlsZCgybiArIDEpYCB3aXRoIGEgcGxhY2Vob2xkZXIuXG4gICAgLy8gV1MgYW5kIFwiK1wiIHdvdWxkIG90aGVyd2lzZSBiZSBpbnRlcnByZXRlZCBhcyBzZWxlY3RvciBzZXBhcmF0b3JzLlxuICAgIHRoaXMuX2NvbnRlbnQgPSBzZWxlY3Rvci5yZXBsYWNlKC8oOm50aC1bLVxcd10rKShcXChbXildK1xcKSkvZywgKF8sIHBzZXVkbywgZXhwKSA9PiB7XG4gICAgICBjb25zdCByZXBsYWNlQnkgPSBgX19waC0ke3RoaXMuaW5kZXh9X19gO1xuICAgICAgdGhpcy5wbGFjZWhvbGRlcnMucHVzaChleHApO1xuICAgICAgdGhpcy5pbmRleCsrO1xuICAgICAgcmV0dXJuIHBzZXVkbyArIHJlcGxhY2VCeTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlc3RvcmUoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY29udGVudC5yZXBsYWNlKC9fXyg/OnBofGVzYy1waCktKFxcZCspX18vZywgKF9waCwgaW5kZXgpID0+IHRoaXMucGxhY2Vob2xkZXJzWytpbmRleF0pO1xuICB9XG5cbiAgY29udGVudCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9jb250ZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGFsbCBvZiB0aGUgc3Vic3RyaW5ncyB0aGF0IG1hdGNoIGEgcmVnZXggd2l0aGluIGFcbiAgICogc3BlY2lhbCBzdHJpbmcgKGUuZy4gYF9fcGgtMF9fYCwgYF9fcGgtMV9fYCwgZXRjKS5cbiAgICovXG4gIHByaXZhdGUgX2VzY2FwZVJlZ2V4TWF0Y2hlcyhjb250ZW50OiBzdHJpbmcsIHBhdHRlcm46IFJlZ0V4cCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZShwYXR0ZXJuLCAoXywga2VlcCkgPT4ge1xuICAgICAgY29uc3QgcmVwbGFjZUJ5ID0gYF9fcGgtJHt0aGlzLmluZGV4fV9fYDtcbiAgICAgIHRoaXMucGxhY2Vob2xkZXJzLnB1c2goa2VlcCk7XG4gICAgICB0aGlzLmluZGV4Kys7XG4gICAgICByZXR1cm4gcmVwbGFjZUJ5O1xuICAgIH0pO1xuICB9XG59XG5cbmNvbnN0IF9jc3NDb250ZW50TmV4dFNlbGVjdG9yUmUgPVxuICAvcG9seWZpbGwtbmV4dC1zZWxlY3RvcltefV0qY29udGVudDpbXFxzXSo/KFsnXCJdKSguKj8pXFwxWztcXHNdKn0oW157XSo/KXsvZ2ltO1xuY29uc3QgX2Nzc0NvbnRlbnRSdWxlUmUgPSAvKHBvbHlmaWxsLXJ1bGUpW159XSooY29udGVudDpbXFxzXSooWydcIl0pKC4qPylcXDMpWztcXHNdKltefV0qfS9naW07XG5jb25zdCBfY3NzQ29udGVudFVuc2NvcGVkUnVsZVJlID1cbiAgLyhwb2x5ZmlsbC11bnNjb3BlZC1ydWxlKVtefV0qKGNvbnRlbnQ6W1xcc10qKFsnXCJdKSguKj8pXFwzKVs7XFxzXSpbXn1dKn0vZ2ltO1xuY29uc3QgX3BvbHlmaWxsSG9zdCA9ICctc2hhZG93Y3NzaG9zdCc7XG4vLyBub3RlOiA6aG9zdC1jb250ZXh0IHByZS1wcm9jZXNzZWQgdG8gLXNoYWRvd2Nzc2hvc3Rjb250ZXh0LlxuY29uc3QgX3BvbHlmaWxsSG9zdENvbnRleHQgPSAnLXNoYWRvd2Nzc2NvbnRleHQnO1xuY29uc3QgX3BhcmVuU3VmZml4ID0gJyg/OlxcXFwoKCcgKyAnKD86XFxcXChbXikoXSpcXFxcKXxbXikoXSopKz8nICsgJylcXFxcKSk/KFteLHtdKiknO1xuY29uc3QgX2Nzc0NvbG9uSG9zdFJlID0gbmV3IFJlZ0V4cChfcG9seWZpbGxIb3N0ICsgX3BhcmVuU3VmZml4LCAnZ2ltJyk7XG5jb25zdCBfY3NzQ29sb25Ib3N0Q29udGV4dFJlR2xvYmFsID0gbmV3IFJlZ0V4cChfcG9seWZpbGxIb3N0Q29udGV4dCArIF9wYXJlblN1ZmZpeCwgJ2dpbScpO1xuY29uc3QgX2Nzc0NvbG9uSG9zdENvbnRleHRSZSA9IG5ldyBSZWdFeHAoX3BvbHlmaWxsSG9zdENvbnRleHQgKyBfcGFyZW5TdWZmaXgsICdpbScpO1xuY29uc3QgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvciA9IF9wb2x5ZmlsbEhvc3QgKyAnLW5vLWNvbWJpbmF0b3InO1xuY29uc3QgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvclJlID0gLy1zaGFkb3djc3Nob3N0LW5vLWNvbWJpbmF0b3IoW15cXHNdKikvO1xuY29uc3QgX3NoYWRvd0RPTVNlbGVjdG9yc1JlID0gW1xuICAvOjpzaGFkb3cvZyxcbiAgLzo6Y29udGVudC9nLFxuICAvLyBEZXByZWNhdGVkIHNlbGVjdG9yc1xuICAvXFwvc2hhZG93LWRlZXBcXC8vZyxcbiAgL1xcL3NoYWRvd1xcLy9nLFxuXTtcblxuLy8gVGhlIGRlZXAgY29tYmluYXRvciBpcyBkZXByZWNhdGVkIGluIHRoZSBDU1Mgc3BlY1xuLy8gU3VwcG9ydCBmb3IgYD4+PmAsIGBkZWVwYCwgYDo6bmctZGVlcGAgaXMgdGhlbiBhbHNvIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiB0aGUgZnV0dXJlLlxuLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvcHVsbC8xNzY3N1xuY29uc3QgX3NoYWRvd0RlZXBTZWxlY3RvcnMgPSAvKD86Pj4+KXwoPzpcXC9kZWVwXFwvKXwoPzo6Om5nLWRlZXApL2c7XG5jb25zdCBfc2VsZWN0b3JSZVN1ZmZpeCA9ICcoWz5cXFxcc34rWy4sezpdW1xcXFxzXFxcXFNdKik/JCc7XG5jb25zdCBfcG9seWZpbGxIb3N0UmUgPSAvLXNoYWRvd2Nzc2hvc3QvZ2ltO1xuY29uc3QgX2NvbG9uSG9zdFJlID0gLzpob3N0L2dpbTtcbmNvbnN0IF9jb2xvbkhvc3RDb250ZXh0UmUgPSAvOmhvc3QtY29udGV4dC9naW07XG5cbmNvbnN0IF9uZXdMaW5lc1JlID0gL1xccj9cXG4vZztcbmNvbnN0IF9jb21tZW50UmUgPSAvXFwvXFwqW1xcc1xcU10qP1xcKlxcLy9nO1xuY29uc3QgX2NvbW1lbnRXaXRoSGFzaFJlID0gL1xcL1xcKlxccyojXFxzKnNvdXJjZShNYXBwaW5nKT9VUkw9L2c7XG5jb25zdCBDT01NRU5UX1BMQUNFSE9MREVSID0gJyVDT01NRU5UJSc7XG5jb25zdCBfY29tbWVudFdpdGhIYXNoUGxhY2VIb2xkZXJSZSA9IG5ldyBSZWdFeHAoQ09NTUVOVF9QTEFDRUhPTERFUiwgJ2cnKTtcblxuY29uc3QgQkxPQ0tfUExBQ0VIT0xERVIgPSAnJUJMT0NLJSc7XG5jb25zdCBfcnVsZVJlID0gbmV3IFJlZ0V4cChcbiAgYChcXFxccyooPzoke0NPTU1FTlRfUExBQ0VIT0xERVJ9XFxcXHMqKSopKFteO1xcXFx7XFxcXH1dKz8pKFxcXFxzKikoKD86eyVCTE9DSyV9P1xcXFxzKjs/KXwoPzpcXFxccyo7KSlgLFxuICAnZycsXG4pO1xuY29uc3QgQ09OVEVOVF9QQUlSUyA9IG5ldyBNYXAoW1sneycsICd9J11dKTtcblxuY29uc3QgQ09NTUFfSU5fUExBQ0VIT0xERVIgPSAnJUNPTU1BX0lOX1BMQUNFSE9MREVSJSc7XG5jb25zdCBTRU1JX0lOX1BMQUNFSE9MREVSID0gJyVTRU1JX0lOX1BMQUNFSE9MREVSJSc7XG5jb25zdCBDT0xPTl9JTl9QTEFDRUhPTERFUiA9ICclQ09MT05fSU5fUExBQ0VIT0xERVIlJztcblxuY29uc3QgX2Nzc0NvbW1hSW5QbGFjZWhvbGRlclJlR2xvYmFsID0gbmV3IFJlZ0V4cChDT01NQV9JTl9QTEFDRUhPTERFUiwgJ2cnKTtcbmNvbnN0IF9jc3NTZW1pSW5QbGFjZWhvbGRlclJlR2xvYmFsID0gbmV3IFJlZ0V4cChTRU1JX0lOX1BMQUNFSE9MREVSLCAnZycpO1xuY29uc3QgX2Nzc0NvbG9uSW5QbGFjZWhvbGRlclJlR2xvYmFsID0gbmV3IFJlZ0V4cChDT0xPTl9JTl9QTEFDRUhPTERFUiwgJ2cnKTtcblxuZXhwb3J0IGNsYXNzIENzc1J1bGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgc2VsZWN0b3I6IHN0cmluZyxcbiAgICBwdWJsaWMgY29udGVudDogc3RyaW5nLFxuICApIHt9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9jZXNzUnVsZXMoaW5wdXQ6IHN0cmluZywgcnVsZUNhbGxiYWNrOiAocnVsZTogQ3NzUnVsZSkgPT4gQ3NzUnVsZSk6IHN0cmluZyB7XG4gIGNvbnN0IGVzY2FwZWQgPSBlc2NhcGVJblN0cmluZ3MoaW5wdXQpO1xuICBjb25zdCBpbnB1dFdpdGhFc2NhcGVkQmxvY2tzID0gZXNjYXBlQmxvY2tzKGVzY2FwZWQsIENPTlRFTlRfUEFJUlMsIEJMT0NLX1BMQUNFSE9MREVSKTtcbiAgbGV0IG5leHRCbG9ja0luZGV4ID0gMDtcbiAgY29uc3QgZXNjYXBlZFJlc3VsdCA9IGlucHV0V2l0aEVzY2FwZWRCbG9ja3MuZXNjYXBlZFN0cmluZy5yZXBsYWNlKF9ydWxlUmUsICguLi5tOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IHNlbGVjdG9yID0gbVsyXTtcbiAgICBsZXQgY29udGVudCA9ICcnO1xuICAgIGxldCBzdWZmaXggPSBtWzRdO1xuICAgIGxldCBjb250ZW50UHJlZml4ID0gJyc7XG4gICAgaWYgKHN1ZmZpeCAmJiBzdWZmaXguc3RhcnRzV2l0aCgneycgKyBCTE9DS19QTEFDRUhPTERFUikpIHtcbiAgICAgIGNvbnRlbnQgPSBpbnB1dFdpdGhFc2NhcGVkQmxvY2tzLmJsb2Nrc1tuZXh0QmxvY2tJbmRleCsrXTtcbiAgICAgIHN1ZmZpeCA9IHN1ZmZpeC5zdWJzdHJpbmcoQkxPQ0tfUExBQ0VIT0xERVIubGVuZ3RoICsgMSk7XG4gICAgICBjb250ZW50UHJlZml4ID0gJ3snO1xuICAgIH1cbiAgICBjb25zdCBydWxlID0gcnVsZUNhbGxiYWNrKG5ldyBDc3NSdWxlKHNlbGVjdG9yLCBjb250ZW50KSk7XG4gICAgcmV0dXJuIGAke21bMV19JHtydWxlLnNlbGVjdG9yfSR7bVszXX0ke2NvbnRlbnRQcmVmaXh9JHtydWxlLmNvbnRlbnR9JHtzdWZmaXh9YDtcbiAgfSk7XG4gIHJldHVybiB1bmVzY2FwZUluU3RyaW5ncyhlc2NhcGVkUmVzdWx0KTtcbn1cblxuY2xhc3MgU3RyaW5nV2l0aEVzY2FwZWRCbG9ja3Mge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgZXNjYXBlZFN0cmluZzogc3RyaW5nLFxuICAgIHB1YmxpYyBibG9ja3M6IHN0cmluZ1tdLFxuICApIHt9XG59XG5cbmZ1bmN0aW9uIGVzY2FwZUJsb2NrcyhcbiAgaW5wdXQ6IHN0cmluZyxcbiAgY2hhclBhaXJzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LFxuICBwbGFjZWhvbGRlcjogc3RyaW5nLFxuKTogU3RyaW5nV2l0aEVzY2FwZWRCbG9ja3Mge1xuICBjb25zdCByZXN1bHRQYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXNjYXBlZEJsb2Nrczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IG9wZW5DaGFyQ291bnQgPSAwO1xuICBsZXQgbm9uQmxvY2tTdGFydEluZGV4ID0gMDtcbiAgbGV0IGJsb2NrU3RhcnRJbmRleCA9IC0xO1xuICBsZXQgb3BlbkNoYXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgbGV0IGNsb3NlQ2hhcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaGFyID0gaW5wdXRbaV07XG4gICAgaWYgKGNoYXIgPT09ICdcXFxcJykge1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gY2xvc2VDaGFyKSB7XG4gICAgICBvcGVuQ2hhckNvdW50LS07XG4gICAgICBpZiAob3BlbkNoYXJDb3VudCA9PT0gMCkge1xuICAgICAgICBlc2NhcGVkQmxvY2tzLnB1c2goaW5wdXQuc3Vic3RyaW5nKGJsb2NrU3RhcnRJbmRleCwgaSkpO1xuICAgICAgICByZXN1bHRQYXJ0cy5wdXNoKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgbm9uQmxvY2tTdGFydEluZGV4ID0gaTtcbiAgICAgICAgYmxvY2tTdGFydEluZGV4ID0gLTE7XG4gICAgICAgIG9wZW5DaGFyID0gY2xvc2VDaGFyID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gb3BlbkNoYXIpIHtcbiAgICAgIG9wZW5DaGFyQ291bnQrKztcbiAgICB9IGVsc2UgaWYgKG9wZW5DaGFyQ291bnQgPT09IDAgJiYgY2hhclBhaXJzLmhhcyhjaGFyKSkge1xuICAgICAgb3BlbkNoYXIgPSBjaGFyO1xuICAgICAgY2xvc2VDaGFyID0gY2hhclBhaXJzLmdldChjaGFyKTtcbiAgICAgIG9wZW5DaGFyQ291bnQgPSAxO1xuICAgICAgYmxvY2tTdGFydEluZGV4ID0gaSArIDE7XG4gICAgICByZXN1bHRQYXJ0cy5wdXNoKGlucHV0LnN1YnN0cmluZyhub25CbG9ja1N0YXJ0SW5kZXgsIGJsb2NrU3RhcnRJbmRleCkpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChibG9ja1N0YXJ0SW5kZXggIT09IC0xKSB7XG4gICAgZXNjYXBlZEJsb2Nrcy5wdXNoKGlucHV0LnN1YnN0cmluZyhibG9ja1N0YXJ0SW5kZXgpKTtcbiAgICByZXN1bHRQYXJ0cy5wdXNoKHBsYWNlaG9sZGVyKTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHRQYXJ0cy5wdXNoKGlucHV0LnN1YnN0cmluZyhub25CbG9ja1N0YXJ0SW5kZXgpKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgU3RyaW5nV2l0aEVzY2FwZWRCbG9ja3MocmVzdWx0UGFydHMuam9pbignJyksIGVzY2FwZWRCbG9ja3MpO1xufVxuXG4vKipcbiAqIE9iamVjdCBjb250YWluaW5nIGFzIGtleXMgY2hhcmFjdGVycyB0aGF0IHNob3VsZCBiZSBzdWJzdGl0dXRlZCBieSBwbGFjZWhvbGRlcnNcbiAqIHdoZW4gZm91bmQgaW4gc3RyaW5ncyBkdXJpbmcgdGhlIGNzcyB0ZXh0IHBhcnNpbmcsIGFuZCBhcyB2YWx1ZXMgdGhlIHJlc3BlY3RpdmVcbiAqIHBsYWNlaG9sZGVyc1xuICovXG5jb25zdCBFU0NBUEVfSU5fU1RSSU5HX01BUDoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7XG4gICc7JzogU0VNSV9JTl9QTEFDRUhPTERFUixcbiAgJywnOiBDT01NQV9JTl9QTEFDRUhPTERFUixcbiAgJzonOiBDT0xPTl9JTl9QTEFDRUhPTERFUixcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIHByb3ZpZGVkIGNzcyB0ZXh0IGFuZCBpbnNpZGUgc3RyaW5ncyAobWVhbmluZywgaW5zaWRlIHBhaXJzIG9mIHVuZXNjYXBlZCBzaW5nbGUgb3JcbiAqIGRvdWJsZSBxdW90ZXMpIHJlcGxhY2Ugc3BlY2lmaWMgY2hhcmFjdGVycyB3aXRoIHRoZWlyIHJlc3BlY3RpdmUgcGxhY2Vob2xkZXJzIGFzIGluZGljYXRlZFxuICogYnkgdGhlIGBFU0NBUEVfSU5fU1RSSU5HX01BUGAgbWFwLlxuICpcbiAqIEZvciBleGFtcGxlIGNvbnZlcnQgdGhlIHRleHRcbiAqICBgYW5pbWF0aW9uOiBcIm15LWFuaW06YXRcXFwiaW9uXCIgMXM7YFxuICogdG9cbiAqICBgYW5pbWF0aW9uOiBcIm15LWFuaW0lQ09MT05fSU5fUExBQ0VIT0xERVIlYXRcXFwiaW9uXCIgMXM7YFxuICpcbiAqIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIHJlbW92ZSB0aGUgbWVhbmluZyBvZiBzb21lIGNoYXJhY3RlcnMgd2hlbiBmb3VuZCBpbnNpZGUgc3RyaW5nc1xuICogKGZvciBleGFtcGxlIGA7YCBpbmRpY2F0ZXMgdGhlIGVuZCBvZiBhIGNzcyBkZWNsYXJhdGlvbiwgYCxgIHRoZSBzZXF1ZW5jZSBvZiB2YWx1ZXMgYW5kIGA6YCB0aGVcbiAqIGRpdmlzaW9uIGJldHdlZW4gcHJvcGVydHkgYW5kIHZhbHVlIGR1cmluZyBhIGRlY2xhcmF0aW9uLCBub25lIG9mIHRoZXNlIG1lYW5pbmdzIGFwcGx5IHdoZW4gc3VjaFxuICogY2hhcmFjdGVycyBhcmUgd2l0aGluIHN0cmluZ3MgYW5kIHNvIGluIG9yZGVyIHRvIHByZXZlbnQgcGFyc2luZyBpc3N1ZXMgdGhleSBuZWVkIHRvIGJlIHJlcGxhY2VkXG4gKiB3aXRoIHBsYWNlaG9sZGVyIHRleHQgZm9yIHRoZSBkdXJhdGlvbiBvZiB0aGUgY3NzIG1hbmlwdWxhdGlvbiBwcm9jZXNzKS5cbiAqXG4gKiBAcGFyYW0gaW5wdXQgdGhlIG9yaWdpbmFsIGNzcyB0ZXh0LlxuICpcbiAqIEByZXR1cm5zIHRoZSBjc3MgdGV4dCB3aXRoIHNwZWNpZmljIGNoYXJhY3RlcnMgaW4gc3RyaW5ncyByZXBsYWNlZCBieSBwbGFjZWhvbGRlcnMuXG4gKiovXG5mdW5jdGlvbiBlc2NhcGVJblN0cmluZ3MoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCByZXN1bHQgPSBpbnB1dDtcbiAgbGV0IGN1cnJlbnRRdW90ZUNoYXI6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoYXIgPSByZXN1bHRbaV07XG4gICAgaWYgKGNoYXIgPT09ICdcXFxcJykge1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY3VycmVudFF1b3RlQ2hhciAhPT0gbnVsbCkge1xuICAgICAgICAvLyBpbmRleCBpIGlzIGluc2lkZSBhIHF1b3RlZCBzdWItc3RyaW5nXG4gICAgICAgIGlmIChjaGFyID09PSBjdXJyZW50UXVvdGVDaGFyKSB7XG4gICAgICAgICAgY3VycmVudFF1b3RlQ2hhciA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXI6IHN0cmluZyB8IHVuZGVmaW5lZCA9IEVTQ0FQRV9JTl9TVFJJTkdfTUFQW2NoYXJdO1xuICAgICAgICAgIGlmIChwbGFjZWhvbGRlcikge1xuICAgICAgICAgICAgcmVzdWx0ID0gYCR7cmVzdWx0LnN1YnN0cigwLCBpKX0ke3BsYWNlaG9sZGVyfSR7cmVzdWx0LnN1YnN0cihpICsgMSl9YDtcbiAgICAgICAgICAgIGkgKz0gcGxhY2Vob2xkZXIubGVuZ3RoIC0gMTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCInXCIgfHwgY2hhciA9PT0gJ1wiJykge1xuICAgICAgICBjdXJyZW50UXVvdGVDaGFyID0gY2hhcjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBSZXBsYWNlIGluIGEgc3RyaW5nIGFsbCBvY2N1cnJlbmNlcyBvZiBrZXlzIGluIHRoZSBgRVNDQVBFX0lOX1NUUklOR19NQVBgIG1hcCB3aXRoIHRoZWlyXG4gKiBvcmlnaW5hbCByZXByZXNlbnRhdGlvbiwgdGhpcyBpcyBzaW1wbHkgdXNlZCB0byByZXZlcnQgdGhlIGNoYW5nZXMgYXBwbGllZCBieSB0aGVcbiAqIGVzY2FwZUluU3RyaW5ncyBmdW5jdGlvbi5cbiAqXG4gKiBGb3IgZXhhbXBsZSBpdCByZXZlcnRzIHRoZSB0ZXh0OlxuICogIGBhbmltYXRpb246IFwibXktYW5pbSVDT0xPTl9JTl9QTEFDRUhPTERFUiVhdFxcXCJpb25cIiAxcztgXG4gKiB0byBpdCdzIG9yaWdpbmFsIGZvcm0gb2Y6XG4gKiAgYGFuaW1hdGlvbjogXCJteS1hbmltOmF0XFxcImlvblwiIDFzO2BcbiAqXG4gKiBOb3RlOiBGb3IgdGhlIHNha2Ugb2Ygc2ltcGxpY2l0eSB0aGlzIGZ1bmN0aW9uIGRvZXMgbm90IGNoZWNrIHRoYXQgdGhlIHBsYWNlaG9sZGVycyBhcmVcbiAqIGFjdHVhbGx5IGluc2lkZSBzdHJpbmdzIGFzIGl0IHdvdWxkIGFueXdheSBiZSBleHRyZW1lbHkgdW5saWtlbHkgdG8gZmluZCB0aGVtIG91dHNpZGUgb2Ygc3RyaW5ncy5cbiAqXG4gKiBAcGFyYW0gaW5wdXQgdGhlIGNzcyB0ZXh0IGNvbnRhaW5pbmcgdGhlIHBsYWNlaG9sZGVycy5cbiAqXG4gKiBAcmV0dXJucyB0aGUgY3NzIHRleHQgd2l0aG91dCB0aGUgcGxhY2Vob2xkZXJzLlxuICovXG5mdW5jdGlvbiB1bmVzY2FwZUluU3RyaW5ncyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHJlc3VsdCA9IGlucHV0LnJlcGxhY2UoX2Nzc0NvbW1hSW5QbGFjZWhvbGRlclJlR2xvYmFsLCAnLCcpO1xuICByZXN1bHQgPSByZXN1bHQucmVwbGFjZShfY3NzU2VtaUluUGxhY2Vob2xkZXJSZUdsb2JhbCwgJzsnKTtcbiAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoX2Nzc0NvbG9uSW5QbGFjZWhvbGRlclJlR2xvYmFsLCAnOicpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFVuZXNjYXBlIGFsbCBxdW90ZXMgcHJlc2VudCBpbiBhIHN0cmluZywgYnV0IG9ubHkgaWYgdGhlIHN0cmluZyB3YXMgYWN0dWFsbHkgYWxyZWFkeVxuICogcXVvdGVkLlxuICpcbiAqIFRoaXMgZ2VuZXJhdGVzIGEgXCJjYW5vbmljYWxcIiByZXByZXNlbnRhdGlvbiBvZiBzdHJpbmdzIHdoaWNoIGNhbiBiZSB1c2VkIHRvIG1hdGNoIHN0cmluZ3NcbiAqIHdoaWNoIHdvdWxkIG90aGVyd2lzZSBvbmx5IGRpZmZlciBiZWNhdXNlIG9mIGRpZmZlcmVudGx5IGVzY2FwZWQgcXVvdGVzLlxuICpcbiAqIEZvciBleGFtcGxlIGl0IGNvbnZlcnRzIHRoZSBzdHJpbmcgKGFzc3VtZWQgdG8gYmUgcXVvdGVkKTpcbiAqICBgdGhpcyBcXFxcXCJpc1xcXFxcIiBhIFxcXFwnXFxcXFxcXFwndGVzdGBcbiAqIHRvOlxuICogIGB0aGlzIFwiaXNcIiBhICdcXFxcXFxcXCd0ZXN0YFxuICogKG5vdGUgdGhhdCB0aGUgbGF0dGVyIGJhY2tzbGFzaGVzIGFyZSBub3QgcmVtb3ZlZCBhcyB0aGV5IGFyZSBub3QgYWN0dWFsbHkgZXNjYXBpbmcgdGhlIHNpbmdsZVxuICogcXVvdGUpXG4gKlxuICpcbiAqIEBwYXJhbSBpbnB1dCB0aGUgc3RyaW5nIHBvc3NpYmx5IGNvbnRhaW5pbmcgZXNjYXBlZCBxdW90ZXMuXG4gKiBAcGFyYW0gaXNRdW90ZWQgYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHN0cmluZyB3YXMgcXVvdGVkIGluc2lkZSBhIGJpZ2dlciBzdHJpbmcgKGlmIG5vdFxuICogdGhlbiBpdCBtZWFucyB0aGF0IGl0IGRvZXNuJ3QgcmVwcmVzZW50IGFuIGlubmVyIHN0cmluZyBhbmQgdGh1cyBubyB1bmVzY2FwaW5nIGlzIHJlcXVpcmVkKVxuICpcbiAqIEByZXR1cm5zIHRoZSBzdHJpbmcgaW4gdGhlIFwiY2Fub25pY2FsXCIgcmVwcmVzZW50YXRpb24gd2l0aG91dCBlc2NhcGVkIHF1b3Rlcy5cbiAqL1xuZnVuY3Rpb24gdW5lc2NhcGVRdW90ZXMoc3RyOiBzdHJpbmcsIGlzUXVvdGVkOiBib29sZWFuKTogc3RyaW5nIHtcbiAgcmV0dXJuICFpc1F1b3RlZCA/IHN0ciA6IHN0ci5yZXBsYWNlKC8oKD86XnxbXlxcXFxdKSg/OlxcXFxcXFxcKSopXFxcXCg/PVsnXCJdKS9nLCAnJDEnKTtcbn1cblxuLyoqXG4gKiBDb21iaW5lIHRoZSBgY29udGV4dFNlbGVjdG9yc2Agd2l0aCB0aGUgYGhvc3RNYXJrZXJgIGFuZCB0aGUgYG90aGVyU2VsZWN0b3JzYFxuICogdG8gY3JlYXRlIGEgc2VsZWN0b3IgdGhhdCBtYXRjaGVzIHRoZSBzYW1lIGFzIGA6aG9zdC1jb250ZXh0KClgLlxuICpcbiAqIEdpdmVuIGEgc2luZ2xlIGNvbnRleHQgc2VsZWN0b3IgYEFgIHdlIG5lZWQgdG8gb3V0cHV0IHNlbGVjdG9ycyB0aGF0IG1hdGNoIG9uIHRoZSBob3N0IGFuZCBhcyBhblxuICogYW5jZXN0b3Igb2YgdGhlIGhvc3Q6XG4gKlxuICogYGBgXG4gKiBBIDxob3N0TWFya2VyPiwgQTxob3N0TWFya2VyPiB7fVxuICogYGBgXG4gKlxuICogV2hlbiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGNvbnRleHQgc2VsZWN0b3Igd2UgYWxzbyBoYXZlIHRvIGNyZWF0ZSBjb21iaW5hdGlvbnMgb2YgdGhvc2VcbiAqIHNlbGVjdG9ycyB3aXRoIGVhY2ggb3RoZXIuIEZvciBleGFtcGxlIGlmIHRoZXJlIGFyZSBgQWAgYW5kIGBCYCBzZWxlY3RvcnMgdGhlIG91dHB1dCBpczpcbiAqXG4gKiBgYGBcbiAqIEFCPGhvc3RNYXJrZXI+LCBBQiA8aG9zdE1hcmtlcj4sIEEgQjxob3N0TWFya2VyPixcbiAqIEIgQTxob3N0TWFya2VyPiwgQSBCIDxob3N0TWFya2VyPiwgQiBBIDxob3N0TWFya2VyPiB7fVxuICogYGBgXG4gKlxuICogQW5kIHNvIG9uLi4uXG4gKlxuICogQHBhcmFtIGNvbnRleHRTZWxlY3RvcnMgYW4gYXJyYXkgb2YgY29udGV4dCBzZWxlY3RvcnMgdGhhdCB3aWxsIGJlIGNvbWJpbmVkLlxuICogQHBhcmFtIG90aGVyU2VsZWN0b3JzIHRoZSByZXN0IG9mIHRoZSBzZWxlY3RvcnMgdGhhdCBhcmUgbm90IGNvbnRleHQgc2VsZWN0b3JzLlxuICovXG5mdW5jdGlvbiBjb21iaW5lSG9zdENvbnRleHRTZWxlY3RvcnMoY29udGV4dFNlbGVjdG9yczogc3RyaW5nW10sIG90aGVyU2VsZWN0b3JzOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBob3N0TWFya2VyID0gX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvcjtcbiAgX3BvbHlmaWxsSG9zdFJlLmxhc3RJbmRleCA9IDA7IC8vIHJlc2V0IHRoZSByZWdleCB0byBlbnN1cmUgd2UgZ2V0IGFuIGFjY3VyYXRlIHRlc3RcbiAgY29uc3Qgb3RoZXJTZWxlY3RvcnNIYXNIb3N0ID0gX3BvbHlmaWxsSG9zdFJlLnRlc3Qob3RoZXJTZWxlY3RvcnMpO1xuXG4gIC8vIElmIHRoZXJlIGFyZSBubyBjb250ZXh0IHNlbGVjdG9ycyB0aGVuIGp1c3Qgb3V0cHV0IGEgaG9zdCBtYXJrZXJcbiAgaWYgKGNvbnRleHRTZWxlY3RvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGhvc3RNYXJrZXIgKyBvdGhlclNlbGVjdG9ycztcbiAgfVxuXG4gIGNvbnN0IGNvbWJpbmVkOiBzdHJpbmdbXSA9IFtjb250ZXh0U2VsZWN0b3JzLnBvcCgpIHx8ICcnXTtcbiAgd2hpbGUgKGNvbnRleHRTZWxlY3RvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGxlbmd0aCA9IGNvbWJpbmVkLmxlbmd0aDtcbiAgICBjb25zdCBjb250ZXh0U2VsZWN0b3IgPSBjb250ZXh0U2VsZWN0b3JzLnBvcCgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzU2VsZWN0b3JzID0gY29tYmluZWRbaV07XG4gICAgICAvLyBBZGQgdGhlIG5ldyBzZWxlY3RvciBhcyBhIGRlc2NlbmRhbnQgb2YgdGhlIHByZXZpb3VzIHNlbGVjdG9yc1xuICAgICAgY29tYmluZWRbbGVuZ3RoICogMiArIGldID0gcHJldmlvdXNTZWxlY3RvcnMgKyAnICcgKyBjb250ZXh0U2VsZWN0b3I7XG4gICAgICAvLyBBZGQgdGhlIG5ldyBzZWxlY3RvciBhcyBhbiBhbmNlc3RvciBvZiB0aGUgcHJldmlvdXMgc2VsZWN0b3JzXG4gICAgICBjb21iaW5lZFtsZW5ndGggKyBpXSA9IGNvbnRleHRTZWxlY3RvciArICcgJyArIHByZXZpb3VzU2VsZWN0b3JzO1xuICAgICAgLy8gQWRkIHRoZSBuZXcgc2VsZWN0b3IgdG8gYWN0IG9uIHRoZSBzYW1lIGVsZW1lbnQgYXMgdGhlIHByZXZpb3VzIHNlbGVjdG9yc1xuICAgICAgY29tYmluZWRbaV0gPSBjb250ZXh0U2VsZWN0b3IgKyBwcmV2aW91c1NlbGVjdG9ycztcbiAgICB9XG4gIH1cbiAgLy8gRmluYWxseSBjb25uZWN0IHRoZSBzZWxlY3RvciB0byB0aGUgYGhvc3RNYXJrZXJgczogZWl0aGVyIGFjdGluZyBkaXJlY3RseSBvbiB0aGUgaG9zdFxuICAvLyAoQTxob3N0TWFya2VyPikgb3IgYXMgYW4gYW5jZXN0b3IgKEEgPGhvc3RNYXJrZXI+KS5cbiAgcmV0dXJuIGNvbWJpbmVkXG4gICAgLm1hcCgocykgPT5cbiAgICAgIG90aGVyU2VsZWN0b3JzSGFzSG9zdFxuICAgICAgICA/IGAke3N9JHtvdGhlclNlbGVjdG9yc31gXG4gICAgICAgIDogYCR7c30ke2hvc3RNYXJrZXJ9JHtvdGhlclNlbGVjdG9yc30sICR7c30gJHtob3N0TWFya2VyfSR7b3RoZXJTZWxlY3RvcnN9YCxcbiAgICApXG4gICAgLmpvaW4oJywnKTtcbn1cblxuLyoqXG4gKiBNdXRhdGUgdGhlIGdpdmVuIGBncm91cHNgIGFycmF5IHNvIHRoYXQgdGhlcmUgYXJlIGBtdWx0aXBsZXNgIGNsb25lcyBvZiB0aGUgb3JpZ2luYWwgYXJyYXlcbiAqIHN0b3JlZC5cbiAqXG4gKiBGb3IgZXhhbXBsZSBgcmVwZWF0R3JvdXBzKFthLCBiXSwgMylgIHdpbGwgcmVzdWx0IGluIGBbYSwgYiwgYSwgYiwgYSwgYl1gIC0gYnV0IGltcG9ydGFudGx5IHRoZVxuICogbmV3bHkgYWRkZWQgZ3JvdXBzIHdpbGwgYmUgY2xvbmVzIG9mIHRoZSBvcmlnaW5hbC5cbiAqXG4gKiBAcGFyYW0gZ3JvdXBzIEFuIGFycmF5IG9mIGdyb3VwcyBvZiBzdHJpbmdzIHRoYXQgd2lsbCBiZSByZXBlYXRlZC4gVGhpcyBhcnJheSBpcyBtdXRhdGVkXG4gKiAgICAgaW4tcGxhY2UuXG4gKiBAcGFyYW0gbXVsdGlwbGVzIFRoZSBudW1iZXIgb2YgdGltZXMgdGhlIGN1cnJlbnQgZ3JvdXBzIHNob3VsZCBhcHBlYXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXBlYXRHcm91cHMoZ3JvdXBzOiBzdHJpbmdbXVtdLCBtdWx0aXBsZXM6IG51bWJlcik6IHZvaWQge1xuICBjb25zdCBsZW5ndGggPSBncm91cHMubGVuZ3RoO1xuICBmb3IgKGxldCBpID0gMTsgaSA8IG11bHRpcGxlczsgaSsrKSB7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW5ndGg7IGorKykge1xuICAgICAgZ3JvdXBzW2ogKyBpICogbGVuZ3RoXSA9IGdyb3Vwc1tqXS5zbGljZSgwKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==