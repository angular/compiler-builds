/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
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
         *  - (^|\s+|,)
         *    captures how many (if any) leading whitespaces are present or a comma
         *  - (?:(?:(['"])((?:\\\\|\\\2|(?!\2).)+)\2)|(-?[A-Za-z][\w\-]*))
         *    captures two different possible keyframes, ones which are quoted or ones which are valid css
         * indents (custom properties excluded)
         *  - (?=[,\s;]|$)
         *    simply matches the end of the possible keyframe, valid endings are: a comma, a space, a
         * semicolon or the end of the string
         */
        this._animationDeclarationKeyframesRe = /(^|\s+|,)(?:(?:(['"])((?:\\\\|\\\2|(?!\2).)+)\2)|(-?[A-Za-z][\w\-]*))(?=[,\s]|$)/g;
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
        let content = rule.content.replace(/((?:^|\s+|;)(?:-webkit-)?animation\s*:\s*),*([^;]+)/g, (_, start, animationDeclarations) => start +
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
        // replace :host and :host-context with -shadowcsshost and -shadowcsshostcontext respectively
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
        return cssText.replace(_cssColonHostContextReGlobal, (selectorText, pseudoPrefix) => {
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
            // selectors that `:host-context` can match. See `_combineHostContextSelectors()` for more
            // info about how this is done.
            return contextSelectorGroups
                .map((contextSelectors) => _combineHostContextSelectors(contextSelectors, selectorText, pseudoPrefix))
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
                selector = this._scopeSelector({
                    selector,
                    scopeSelector,
                    hostSelector,
                    isParentSelector: true,
                });
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
    // `isParentSelector` is used to distinguish the selectors which are coming from
    // the initial selector string and any nested selectors, parsed recursively,
    // for example `selector = 'a:where(.one)'` could be the parent, while recursive call
    // would have `selector = '.one'`.
    _scopeSelector({ selector, scopeSelector, hostSelector, isParentSelector = false, }) {
        // Split the selector into independent parts by `,` (comma) unless
        // comma is within parenthesis, for example `:is(.one, two)`.
        // Negative lookup after comma allows not splitting inside nested parenthesis,
        // up to three levels (((,))).
        const selectorSplitRe = / ?,(?!(?:[^)(]*(?:\([^)(]*(?:\([^)(]*(?:\([^)(]*\)[^)(]*)*\)[^)(]*)*\)[^)(]*)*\))) ?/;
        return selector
            .split(selectorSplitRe)
            .map((part) => part.split(_shadowDeepSelectors))
            .map((deepParts) => {
            const [shallowPart, ...otherParts] = deepParts;
            const applyScope = (shallowPart) => {
                if (this._selectorNeedsScoping(shallowPart, scopeSelector)) {
                    return this._applySelectorScope({
                        selector: shallowPart,
                        scopeSelector,
                        hostSelector,
                        isParentSelector,
                    });
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
                .replace(_polyfillHostNoCombinatorReGlobal, (_hnc, selector) => {
                return selector.replace(/([^:\)]*)(:*)(.*)/, (_, before, colon, after) => {
                    return before + replaceBy + colon + after;
                });
            })
                .replace(_polyfillHostRe, replaceBy + ' ');
        }
        return scopeSelector + ' ' + selector;
    }
    // return a selector with [name] suffix on each simple selector
    // e.g. .foo.bar > .zot becomes .foo[name].bar[name] > .zot[name]  /** @internal */
    _applySelectorScope({ selector, scopeSelector, hostSelector, isParentSelector, }) {
        const isRe = /\[is=([^\]]*)\]/g;
        scopeSelector = scopeSelector.replace(isRe, (_, ...parts) => parts[0]);
        const attrName = '[' + scopeSelector + ']';
        const _scopeSelectorPart = (p) => {
            let scopedP = p.trim();
            if (!scopedP) {
                return p;
            }
            if (p.includes(_polyfillHostNoCombinator)) {
                scopedP = this._applySimpleSelectorScope(p, scopeSelector, hostSelector);
                if (_polyfillHostNoCombinatorWithinPseudoFunction.test(p)) {
                    const [_, before, colon, after] = scopedP.match(/([^:]*)(:*)(.*)/);
                    scopedP = before + attrName + colon + after;
                }
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
        // Wraps `_scopeSelectorPart()` to not use it directly on selectors with
        // pseudo selector functions like `:where()`. Selectors within pseudo selector
        // functions are recursively sent to `_scopeSelector()`.
        const _pseudoFunctionAwareScopeSelectorPart = (selectorPart) => {
            let scopedPart = '';
            const cssPrefixWithPseudoSelectorFunctionMatch = selectorPart.match(_cssPrefixWithPseudoSelectorFunction);
            if (cssPrefixWithPseudoSelectorFunctionMatch) {
                const [cssPseudoSelectorFunction] = cssPrefixWithPseudoSelectorFunctionMatch;
                // Unwrap the pseudo selector to scope its contents.
                // For example,
                // - `:where(selectorToScope)` -> `selectorToScope`;
                // - `:is(.foo, .bar)` -> `.foo, .bar`.
                const selectorToScope = selectorPart.slice(cssPseudoSelectorFunction.length, -1);
                if (selectorToScope.includes(_polyfillHostNoCombinator)) {
                    this._shouldScopeIndicator = true;
                }
                const scopedInnerPart = this._scopeSelector({
                    selector: selectorToScope,
                    scopeSelector,
                    hostSelector,
                });
                // Put the result back into the pseudo selector function.
                scopedPart = `${cssPseudoSelectorFunction}${scopedInnerPart})`;
            }
            else {
                this._shouldScopeIndicator =
                    this._shouldScopeIndicator || selectorPart.includes(_polyfillHostNoCombinator);
                scopedPart = this._shouldScopeIndicator ? _scopeSelectorPart(selectorPart) : selectorPart;
            }
            return scopedPart;
        };
        if (isParentSelector) {
            this._safeSelector = new SafeSelector(selector);
            selector = this._safeSelector.content();
        }
        let scopedSelector = '';
        let startIndex = 0;
        let res;
        // Combinators aren't used as a delimiter if they are within parenthesis,
        // for example `:where(.one .two)` stays intact.
        // Similarly to selector separation by comma initially, negative lookahead
        // is used here to not break selectors within nested parenthesis up to three
        // nested layers.
        const sep = /( |>|\+|~(?!=))(?!([^)(]*(?:\([^)(]*(?:\([^)(]*(?:\([^)(]*\)[^)(]*)*\)[^)(]*)*\)[^)(]*)*\)))\s*/g;
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
        const hasHost = selector.includes(_polyfillHostNoCombinator);
        // Only scope parts after or on the same level as the first `-shadowcsshost-no-combinator`
        // when it is present. The selector has the same level when it is a part of a pseudo
        // selector, like `:where()`, for example `:where(:host, .foo)` would result in `.foo`
        // being scoped.
        if (isParentSelector || this._shouldScopeIndicator) {
            this._shouldScopeIndicator = !hasHost;
        }
        while ((res = sep.exec(selector)) !== null) {
            const separator = res[1];
            // Do not trim the selector, as otherwise this will break sourcemaps
            // when they are defined on multiple lines
            // Example:
            //  div,
            //  p { color: red}
            const part = selector.slice(startIndex, res.index);
            // A space following an escaped hex value and followed by another hex character
            // (ie: ".\fc ber" for ".über") is not a separator between 2 selectors
            // also keep in mind that backslashes are replaced by a placeholder by SafeSelector
            // These escaped selectors happen for example when esbuild runs with optimization.minify.
            if (part.match(/__esc-ph-(\d+)__/) && selector[res.index + 1]?.match(/[a-fA-F\d]/)) {
                continue;
            }
            const scopedPart = _pseudoFunctionAwareScopeSelectorPart(part);
            scopedSelector += `${scopedPart} ${separator} `;
            startIndex = sep.lastIndex;
        }
        const part = selector.substring(startIndex);
        scopedSelector += _pseudoFunctionAwareScopeSelectorPart(part);
        // replace the placeholders with their original values
        // using values stored inside the `safeSelector` instance.
        return this._safeSelector.restore(scopedSelector);
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
const _cssScopedPseudoFunctionPrefix = '(:(where|is)\\()?';
const _cssPrefixWithPseudoSelectorFunction = /^:(where|is)\(/i;
const _cssContentNextSelectorRe = /polyfill-next-selector[^}]*content:[\s]*?(['"])(.*?)\1[;\s]*}([^{]*?){/gim;
const _cssContentRuleRe = /(polyfill-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const _cssContentUnscopedRuleRe = /(polyfill-unscoped-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const _polyfillHost = '-shadowcsshost';
// note: :host-context pre-processed to -shadowcsshostcontext.
const _polyfillHostContext = '-shadowcsscontext';
const _parenSuffix = '(?:\\((' + '(?:\\([^)(]*\\)|[^)(]*)+?' + ')\\))?([^,{]*)';
const _cssColonHostRe = new RegExp(_polyfillHost + _parenSuffix, 'gim');
const _cssColonHostContextReGlobal = new RegExp(_cssScopedPseudoFunctionPrefix + '(' + _polyfillHostContext + _parenSuffix + ')', 'gim');
const _cssColonHostContextRe = new RegExp(_polyfillHostContext + _parenSuffix, 'im');
const _polyfillHostNoCombinator = _polyfillHost + '-no-combinator';
const _polyfillHostNoCombinatorWithinPseudoFunction = new RegExp(`:.*\\(.*${_polyfillHostNoCombinator}.*\\)`);
const _polyfillHostNoCombinatorRe = /-shadowcsshost-no-combinator([^\s]*)/;
const _polyfillHostNoCombinatorReGlobal = new RegExp(_polyfillHostNoCombinatorRe, 'g');
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
function _combineHostContextSelectors(contextSelectors, otherSelectors, pseudoPrefix = '') {
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
        ? `${pseudoPrefix}${s}${otherSelectors}`
        : `${pseudoPrefix}${s}${hostMarker}${otherSelectors}, ${pseudoPrefix}${s} ${hostMarker}${otherSelectors}`)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93X2Nzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zaGFkb3dfY3NzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLGlCQUFpQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ2hDLGdCQUFnQjtJQUNoQixTQUFTO0lBQ1QsU0FBUztJQUNULFFBQVE7SUFDUixPQUFPO0lBQ1Asc0JBQXNCO0lBQ3RCLFdBQVc7SUFDWCxtQkFBbUI7SUFDbkIsUUFBUTtJQUNSLFNBQVM7SUFDVCxzQkFBc0I7SUFDdEIsV0FBVztJQUNYLE1BQU07SUFDTixVQUFVO0lBQ1YsTUFBTTtJQUNOLHVCQUF1QjtJQUN2QixRQUFRO0lBQ1IsU0FBUztJQUNULDRCQUE0QjtJQUM1QixNQUFNO0lBQ04sU0FBUztJQUNULGFBQWE7SUFDYixVQUFVO0lBQ1YsUUFBUTtJQUNSLFlBQVk7SUFDWixVQUFVO0lBQ1YscUJBQXFCO0lBQ3JCLEtBQUs7SUFDTCxXQUFXO0lBQ1gsVUFBVTtJQUNWLFdBQVc7SUFDWCxZQUFZO0lBQ1osT0FBTztDQUNSLENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSx1QkFBdUIsR0FBRztJQUM5QixRQUFRO0lBQ1IsV0FBVztJQUNYLFdBQVc7SUFDWCxRQUFRO0lBQ1IsWUFBWTtJQUNaLFFBQVE7SUFDUixpQkFBaUI7Q0FDbEIsQ0FBQztBQUVGOzs7Ozs7OztHQVFHO0FBRUg7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztFQTZGRTtBQUNGLE1BQU0sT0FBTyxTQUFTO0lBQXRCO1FBcUtFOzs7Ozs7Ozs7Ozs7O1dBYUc7UUFDSyxxQ0FBZ0MsR0FDdEMsbUZBQW1GLENBQUM7SUE4aUJ4RixD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QUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25DLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNoQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlDLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmRldi9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBUaGUgZm9sbG93aW5nIHNldCBjb250YWlucyBhbGwga2V5d29yZHMgdGhhdCBjYW4gYmUgdXNlZCBpbiB0aGUgYW5pbWF0aW9uIGNzcyBzaG9ydGhhbmRcbiAqIHByb3BlcnR5IGFuZCBpcyB1c2VkIGR1cmluZyB0aGUgc2NvcGluZyBvZiBrZXlmcmFtZXMgdG8gbWFrZSBzdXJlIHN1Y2gga2V5d29yZHNcbiAqIGFyZSBub3QgbW9kaWZpZWQuXG4gKi9cbmNvbnN0IGFuaW1hdGlvbktleXdvcmRzID0gbmV3IFNldChbXG4gIC8vIGdsb2JhbCB2YWx1ZXNcbiAgJ2luaGVyaXQnLFxuICAnaW5pdGlhbCcsXG4gICdyZXZlcnQnLFxuICAndW5zZXQnLFxuICAvLyBhbmltYXRpb24tZGlyZWN0aW9uXG4gICdhbHRlcm5hdGUnLFxuICAnYWx0ZXJuYXRlLXJldmVyc2UnLFxuICAnbm9ybWFsJyxcbiAgJ3JldmVyc2UnLFxuICAvLyBhbmltYXRpb24tZmlsbC1tb2RlXG4gICdiYWNrd2FyZHMnLFxuICAnYm90aCcsXG4gICdmb3J3YXJkcycsXG4gICdub25lJyxcbiAgLy8gYW5pbWF0aW9uLXBsYXktc3RhdGVcbiAgJ3BhdXNlZCcsXG4gICdydW5uaW5nJyxcbiAgLy8gYW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvblxuICAnZWFzZScsXG4gICdlYXNlLWluJyxcbiAgJ2Vhc2UtaW4tb3V0JyxcbiAgJ2Vhc2Utb3V0JyxcbiAgJ2xpbmVhcicsXG4gICdzdGVwLXN0YXJ0JyxcbiAgJ3N0ZXAtZW5kJyxcbiAgLy8gYHN0ZXBzKClgIGZ1bmN0aW9uXG4gICdlbmQnLFxuICAnanVtcC1ib3RoJyxcbiAgJ2p1bXAtZW5kJyxcbiAgJ2p1bXAtbm9uZScsXG4gICdqdW1wLXN0YXJ0JyxcbiAgJ3N0YXJ0Jyxcbl0pO1xuXG4vKipcbiAqIFRoZSBmb2xsb3dpbmcgYXJyYXkgY29udGFpbnMgYWxsIG9mIHRoZSBDU1MgYXQtcnVsZSBpZGVudGlmaWVycyB3aGljaCBhcmUgc2NvcGVkLlxuICovXG5jb25zdCBzY29wZWRBdFJ1bGVJZGVudGlmaWVycyA9IFtcbiAgJ0BtZWRpYScsXG4gICdAc3VwcG9ydHMnLFxuICAnQGRvY3VtZW50JyxcbiAgJ0BsYXllcicsXG4gICdAY29udGFpbmVyJyxcbiAgJ0BzY29wZScsXG4gICdAc3RhcnRpbmctc3R5bGUnLFxuXTtcblxuLyoqXG4gKiBUaGUgZm9sbG93aW5nIGNsYXNzIGhhcyBpdHMgb3JpZ2luIGZyb20gYSBwb3J0IG9mIHNoYWRvd0NTUyBmcm9tIHdlYmNvbXBvbmVudHMuanMgdG8gVHlwZVNjcmlwdC5cbiAqIEl0IGhhcyBzaW5jZSBkaXZlcmdlIGluIG1hbnkgd2F5cyB0byB0YWlsb3IgQW5ndWxhcidzIG5lZWRzLlxuICpcbiAqIFNvdXJjZTpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJjb21wb25lbnRzL3dlYmNvbXBvbmVudHNqcy9ibG9iLzRlZmVjZDdlMGUvc3JjL1NoYWRvd0NTUy9TaGFkb3dDU1MuanNcbiAqXG4gKiBUaGUgb3JpZ2luYWwgZmlsZSBsZXZlbCBjb21tZW50IGlzIHJlcHJvZHVjZWQgYmVsb3dcbiAqL1xuXG4vKlxuICBUaGlzIGlzIGEgbGltaXRlZCBzaGltIGZvciBTaGFkb3dET00gY3NzIHN0eWxpbmcuXG4gIGh0dHBzOi8vZHZjcy53My5vcmcvaGcvd2ViY29tcG9uZW50cy9yYXctZmlsZS90aXAvc3BlYy9zaGFkb3cvaW5kZXguaHRtbCNzdHlsZXNcblxuICBUaGUgaW50ZW50aW9uIGhlcmUgaXMgdG8gc3VwcG9ydCBvbmx5IHRoZSBzdHlsaW5nIGZlYXR1cmVzIHdoaWNoIGNhbiBiZVxuICByZWxhdGl2ZWx5IHNpbXBseSBpbXBsZW1lbnRlZC4gVGhlIGdvYWwgaXMgdG8gYWxsb3cgdXNlcnMgdG8gYXZvaWQgdGhlXG4gIG1vc3Qgb2J2aW91cyBwaXRmYWxscyBhbmQgZG8gc28gd2l0aG91dCBjb21wcm9taXNpbmcgcGVyZm9ybWFuY2Ugc2lnbmlmaWNhbnRseS5cbiAgRm9yIFNoYWRvd0RPTSBzdHlsaW5nIHRoYXQncyBub3QgY292ZXJlZCBoZXJlLCBhIHNldCBvZiBiZXN0IHByYWN0aWNlc1xuICBjYW4gYmUgcHJvdmlkZWQgdGhhdCBzaG91bGQgYWxsb3cgdXNlcnMgdG8gYWNjb21wbGlzaCBtb3JlIGNvbXBsZXggc3R5bGluZy5cblxuICBUaGUgZm9sbG93aW5nIGlzIGEgbGlzdCBvZiBzcGVjaWZpYyBTaGFkb3dET00gc3R5bGluZyBmZWF0dXJlcyBhbmQgYSBicmllZlxuICBkaXNjdXNzaW9uIG9mIHRoZSBhcHByb2FjaCB1c2VkIHRvIHNoaW0uXG5cbiAgU2hpbW1lZCBmZWF0dXJlczpcblxuICAqIDpob3N0LCA6aG9zdC1jb250ZXh0OiBTaGFkb3dET00gYWxsb3dzIHN0eWxpbmcgb2YgdGhlIHNoYWRvd1Jvb3QncyBob3N0XG4gIGVsZW1lbnQgdXNpbmcgdGhlIDpob3N0IHJ1bGUuIFRvIHNoaW0gdGhpcyBmZWF0dXJlLCB0aGUgOmhvc3Qgc3R5bGVzIGFyZVxuICByZWZvcm1hdHRlZCBhbmQgcHJlZml4ZWQgd2l0aCBhIGdpdmVuIHNjb3BlIG5hbWUgYW5kIHByb21vdGVkIHRvIGFcbiAgZG9jdW1lbnQgbGV2ZWwgc3R5bGVzaGVldC5cbiAgRm9yIGV4YW1wbGUsIGdpdmVuIGEgc2NvcGUgbmFtZSBvZiAuZm9vLCBhIHJ1bGUgbGlrZSB0aGlzOlxuXG4gICAgOmhvc3Qge1xuICAgICAgICBiYWNrZ3JvdW5kOiByZWQ7XG4gICAgICB9XG4gICAgfVxuXG4gIGJlY29tZXM6XG5cbiAgICAuZm9vIHtcbiAgICAgIGJhY2tncm91bmQ6IHJlZDtcbiAgICB9XG5cbiAgKiBlbmNhcHN1bGF0aW9uOiBTdHlsZXMgZGVmaW5lZCB3aXRoaW4gU2hhZG93RE9NLCBhcHBseSBvbmx5IHRvXG4gIGRvbSBpbnNpZGUgdGhlIFNoYWRvd0RPTS5cbiAgVGhlIHNlbGVjdG9ycyBhcmUgc2NvcGVkIGJ5IGFkZGluZyBhbiBhdHRyaWJ1dGUgc2VsZWN0b3Igc3VmZml4IHRvIGVhY2hcbiAgc2ltcGxlIHNlbGVjdG9yIHRoYXQgY29udGFpbnMgdGhlIGhvc3QgZWxlbWVudCB0YWcgbmFtZS4gRWFjaCBlbGVtZW50XG4gIGluIHRoZSBlbGVtZW50J3MgU2hhZG93RE9NIHRlbXBsYXRlIGlzIGFsc28gZ2l2ZW4gdGhlIHNjb3BlIGF0dHJpYnV0ZS5cbiAgVGh1cywgdGhlc2UgcnVsZXMgbWF0Y2ggb25seSBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHNjb3BlIGF0dHJpYnV0ZS5cbiAgRm9yIGV4YW1wbGUsIGdpdmVuIGEgc2NvcGUgbmFtZSBvZiB4LWZvbywgYSBydWxlIGxpa2UgdGhpczpcblxuICAgIGRpdiB7XG4gICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICB9XG5cbiAgYmVjb21lczpcblxuICAgIGRpdlt4LWZvb10ge1xuICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgfVxuXG4gIE5vdGUgdGhhdCBlbGVtZW50cyB0aGF0IGFyZSBkeW5hbWljYWxseSBhZGRlZCB0byBhIHNjb3BlIG11c3QgaGF2ZSB0aGUgc2NvcGVcbiAgc2VsZWN0b3IgYWRkZWQgdG8gdGhlbSBtYW51YWxseS5cblxuICAqIHVwcGVyL2xvd2VyIGJvdW5kIGVuY2Fwc3VsYXRpb246IFN0eWxlcyB3aGljaCBhcmUgZGVmaW5lZCBvdXRzaWRlIGFcbiAgc2hhZG93Um9vdCBzaG91bGQgbm90IGNyb3NzIHRoZSBTaGFkb3dET00gYm91bmRhcnkgYW5kIHNob3VsZCBub3QgYXBwbHlcbiAgaW5zaWRlIGEgc2hhZG93Um9vdC5cblxuICBUaGlzIHN0eWxpbmcgYmVoYXZpb3IgaXMgbm90IGVtdWxhdGVkLiBTb21lIHBvc3NpYmxlIHdheXMgdG8gZG8gdGhpcyB0aGF0XG4gIHdlcmUgcmVqZWN0ZWQgZHVlIHRvIGNvbXBsZXhpdHkgYW5kL29yIHBlcmZvcm1hbmNlIGNvbmNlcm5zIGluY2x1ZGU6ICgxKSByZXNldFxuICBldmVyeSBwb3NzaWJsZSBwcm9wZXJ0eSBmb3IgZXZlcnkgcG9zc2libGUgc2VsZWN0b3IgZm9yIGEgZ2l2ZW4gc2NvcGUgbmFtZTtcbiAgKDIpIHJlLWltcGxlbWVudCBjc3MgaW4gamF2YXNjcmlwdC5cblxuICBBcyBhbiBhbHRlcm5hdGl2ZSwgdXNlcnMgc2hvdWxkIG1ha2Ugc3VyZSB0byB1c2Ugc2VsZWN0b3JzXG4gIHNwZWNpZmljIHRvIHRoZSBzY29wZSBpbiB3aGljaCB0aGV5IGFyZSB3b3JraW5nLlxuXG4gICogOjpkaXN0cmlidXRlZDogVGhpcyBiZWhhdmlvciBpcyBub3QgZW11bGF0ZWQuIEl0J3Mgb2Z0ZW4gbm90IG5lY2Vzc2FyeVxuICB0byBzdHlsZSB0aGUgY29udGVudHMgb2YgYSBzcGVjaWZpYyBpbnNlcnRpb24gcG9pbnQgYW5kIGluc3RlYWQsIGRlc2NlbmRhbnRzXG4gIG9mIHRoZSBob3N0IGVsZW1lbnQgY2FuIGJlIHN0eWxlZCBzZWxlY3RpdmVseS4gVXNlcnMgY2FuIGFsc28gY3JlYXRlIGFuXG4gIGV4dHJhIG5vZGUgYXJvdW5kIGFuIGluc2VydGlvbiBwb2ludCBhbmQgc3R5bGUgdGhhdCBub2RlJ3MgY29udGVudHNcbiAgdmlhIGRlc2NlbmRlbnQgc2VsZWN0b3JzLiBGb3IgZXhhbXBsZSwgd2l0aCBhIHNoYWRvd1Jvb3QgbGlrZSB0aGlzOlxuXG4gICAgPHN0eWxlPlxuICAgICAgOjpjb250ZW50KGRpdikge1xuICAgICAgICBiYWNrZ3JvdW5kOiByZWQ7XG4gICAgICB9XG4gICAgPC9zdHlsZT5cbiAgICA8Y29udGVudD48L2NvbnRlbnQ+XG5cbiAgY291bGQgYmVjb21lOlxuXG4gICAgPHN0eWxlPlxuICAgICAgLyAqQHBvbHlmaWxsIC5jb250ZW50LWNvbnRhaW5lciBkaXYgKiAvXG4gICAgICA6OmNvbnRlbnQoZGl2KSB7XG4gICAgICAgIGJhY2tncm91bmQ6IHJlZDtcbiAgICAgIH1cbiAgICA8L3N0eWxlPlxuICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbnRhaW5lclwiPlxuICAgICAgPGNvbnRlbnQ+PC9jb250ZW50PlxuICAgIDwvZGl2PlxuXG4gIE5vdGUgdGhlIHVzZSBvZiBAcG9seWZpbGwgaW4gdGhlIGNvbW1lbnQgYWJvdmUgYSBTaGFkb3dET00gc3BlY2lmaWMgc3R5bGVcbiAgZGVjbGFyYXRpb24uIFRoaXMgaXMgYSBkaXJlY3RpdmUgdG8gdGhlIHN0eWxpbmcgc2hpbSB0byB1c2UgdGhlIHNlbGVjdG9yXG4gIGluIGNvbW1lbnRzIGluIGxpZXUgb2YgdGhlIG5leHQgc2VsZWN0b3Igd2hlbiBydW5uaW5nIHVuZGVyIHBvbHlmaWxsLlxuKi9cbmV4cG9ydCBjbGFzcyBTaGFkb3dDc3Mge1xuICAvKlxuICAgKiBTaGltIHNvbWUgY3NzVGV4dCB3aXRoIHRoZSBnaXZlbiBzZWxlY3Rvci4gUmV0dXJucyBjc3NUZXh0IHRoYXQgY2FuIGJlIGluY2x1ZGVkIGluIHRoZSBkb2N1bWVudFxuICAgKlxuICAgKiBUaGUgc2VsZWN0b3IgaXMgdGhlIGF0dHJpYnV0ZSBhZGRlZCB0byBhbGwgZWxlbWVudHMgaW5zaWRlIHRoZSBob3N0LFxuICAgKiBUaGUgaG9zdFNlbGVjdG9yIGlzIHRoZSBhdHRyaWJ1dGUgYWRkZWQgdG8gdGhlIGhvc3QgaXRzZWxmLlxuICAgKi9cbiAgc2hpbUNzc1RleHQoY3NzVGV4dDogc3RyaW5nLCBzZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyA9ICcnKTogc3RyaW5nIHtcbiAgICAvLyAqKk5PVEUqKjogRG8gbm90IHN0cmlwIGNvbW1lbnRzIGFzIHRoaXMgd2lsbCBjYXVzZSBjb21wb25lbnQgc291cmNlbWFwcyB0byBicmVha1xuICAgIC8vIGR1ZSB0byBzaGlmdCBpbiBsaW5lcy5cblxuICAgIC8vIENvbGxlY3QgY29tbWVudHMgYW5kIHJlcGxhY2UgdGhlbSB3aXRoIGEgcGxhY2Vob2xkZXIsIHRoaXMgaXMgZG9uZSB0byBhdm9pZCBjb21wbGljYXRpbmdcbiAgICAvLyB0aGUgcnVsZSBwYXJzaW5nIFJlZ0V4cCBhbmQga2VlcCBpdCBzYWZlci5cbiAgICBjb25zdCBjb21tZW50czogc3RyaW5nW10gPSBbXTtcbiAgICBjc3NUZXh0ID0gY3NzVGV4dC5yZXBsYWNlKF9jb21tZW50UmUsIChtKSA9PiB7XG4gICAgICBpZiAobS5tYXRjaChfY29tbWVudFdpdGhIYXNoUmUpKSB7XG4gICAgICAgIGNvbW1lbnRzLnB1c2gobSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBSZXBsYWNlIG5vbiBoYXNoIGNvbW1lbnRzIHdpdGggZW1wdHkgbGluZXMuXG4gICAgICAgIC8vIFRoaXMgaXMgZG9uZSBzbyB0aGF0IHdlIGRvIG5vdCBsZWFrIGFueSBzZW5zaXRpdmUgZGF0YSBpbiBjb21tZW50cy5cbiAgICAgICAgY29uc3QgbmV3TGluZXNNYXRjaGVzID0gbS5tYXRjaChfbmV3TGluZXNSZSk7XG4gICAgICAgIGNvbW1lbnRzLnB1c2goKG5ld0xpbmVzTWF0Y2hlcz8uam9pbignJykgPz8gJycpICsgJ1xcbicpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gQ09NTUVOVF9QTEFDRUhPTERFUjtcbiAgICB9KTtcblxuICAgIGNzc1RleHQgPSB0aGlzLl9pbnNlcnREaXJlY3RpdmVzKGNzc1RleHQpO1xuICAgIGNvbnN0IHNjb3BlZENzc1RleHQgPSB0aGlzLl9zY29wZUNzc1RleHQoY3NzVGV4dCwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgLy8gQWRkIGJhY2sgY29tbWVudHMgYXQgdGhlIG9yaWdpbmFsIHBvc2l0aW9uLlxuICAgIGxldCBjb21tZW50SWR4ID0gMDtcbiAgICByZXR1cm4gc2NvcGVkQ3NzVGV4dC5yZXBsYWNlKF9jb21tZW50V2l0aEhhc2hQbGFjZUhvbGRlclJlLCAoKSA9PiBjb21tZW50c1tjb21tZW50SWR4KytdKTtcbiAgfVxuXG4gIHByaXZhdGUgX2luc2VydERpcmVjdGl2ZXMoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjc3NUZXh0ID0gdGhpcy5faW5zZXJ0UG9seWZpbGxEaXJlY3RpdmVzSW5Dc3NUZXh0KGNzc1RleHQpO1xuICAgIHJldHVybiB0aGlzLl9pbnNlcnRQb2x5ZmlsbFJ1bGVzSW5Dc3NUZXh0KGNzc1RleHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBzY29wZSB0byBrZXlmcmFtZXMuXG4gICAqXG4gICAqIE1vZGlmeSBib3RoIHRoZSBuYW1lcyBvZiB0aGUga2V5ZnJhbWVzIGRlZmluZWQgaW4gdGhlIGNvbXBvbmVudCBzdHlsZXMgYW5kIGFsc28gdGhlIGNzc1xuICAgKiBhbmltYXRpb24gcnVsZXMgdXNpbmcgdGhlbS5cbiAgICpcbiAgICogQW5pbWF0aW9uIHJ1bGVzIHVzaW5nIGtleWZyYW1lcyBkZWZpbmVkIGVsc2V3aGVyZSBhcmUgbm90IG1vZGlmaWVkIHRvIGFsbG93IGZvciBnbG9iYWxseVxuICAgKiBkZWZpbmVkIGtleWZyYW1lcy5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIHdlIGNvbnZlcnQgdGhpcyBjc3M6XG4gICAqXG4gICAqIGBgYFxuICAgKiAuYm94IHtcbiAgICogICBhbmltYXRpb246IGJveC1hbmltYXRpb24gMXMgZm9yd2FyZHM7XG4gICAqIH1cbiAgICpcbiAgICogQGtleWZyYW1lcyBib3gtYW5pbWF0aW9uIHtcbiAgICogICB0byB7XG4gICAqICAgICBiYWNrZ3JvdW5kLWNvbG9yOiBncmVlbjtcbiAgICogICB9XG4gICAqIH1cbiAgICogYGBgXG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiAuYm94IHtcbiAgICogICBhbmltYXRpb246IHNjb3BlTmFtZV9ib3gtYW5pbWF0aW9uIDFzIGZvcndhcmRzO1xuICAgKiB9XG4gICAqXG4gICAqIEBrZXlmcmFtZXMgc2NvcGVOYW1lX2JveC1hbmltYXRpb24ge1xuICAgKiAgIHRvIHtcbiAgICogICAgIGJhY2tncm91bmQtY29sb3I6IGdyZWVuO1xuICAgKiAgIH1cbiAgICogfVxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGNzc1RleHQgdGhlIGNvbXBvbmVudCdzIGNzcyB0ZXh0IHRoYXQgbmVlZHMgdG8gYmUgc2NvcGVkLlxuICAgKiBAcGFyYW0gc2NvcGVTZWxlY3RvciB0aGUgY29tcG9uZW50J3Mgc2NvcGUgc2VsZWN0b3IuXG4gICAqXG4gICAqIEByZXR1cm5zIHRoZSBzY29wZWQgY3NzIHRleHQuXG4gICAqL1xuICBwcml2YXRlIF9zY29wZUtleWZyYW1lc1JlbGF0ZWRDc3MoY3NzVGV4dDogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVuc2NvcGVkS2V5ZnJhbWVzU2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3Qgc2NvcGVkS2V5ZnJhbWVzQ3NzVGV4dCA9IHByb2Nlc3NSdWxlcyhjc3NUZXh0LCAocnVsZSkgPT5cbiAgICAgIHRoaXMuX3Njb3BlTG9jYWxLZXlmcmFtZURlY2xhcmF0aW9ucyhydWxlLCBzY29wZVNlbGVjdG9yLCB1bnNjb3BlZEtleWZyYW1lc1NldCksXG4gICAgKTtcbiAgICByZXR1cm4gcHJvY2Vzc1J1bGVzKHNjb3BlZEtleWZyYW1lc0Nzc1RleHQsIChydWxlKSA9PlxuICAgICAgdGhpcy5fc2NvcGVBbmltYXRpb25SdWxlKHJ1bGUsIHNjb3BlU2VsZWN0b3IsIHVuc2NvcGVkS2V5ZnJhbWVzU2V0KSxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFNjb3BlcyBsb2NhbCBrZXlmcmFtZXMgbmFtZXMsIHJldHVybmluZyB0aGUgdXBkYXRlZCBjc3MgcnVsZSBhbmQgaXQgYWxzb1xuICAgKiBhZGRzIHRoZSBvcmlnaW5hbCBrZXlmcmFtZSBuYW1lIHRvIGEgcHJvdmlkZWQgc2V0IHRvIGNvbGxlY3QgYWxsIGtleWZyYW1lcyBuYW1lc1xuICAgKiBzbyB0aGF0IGl0IGNhbiBsYXRlciBiZSB1c2VkIHRvIHNjb3BlIHRoZSBhbmltYXRpb24gcnVsZXMuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLCBpdCB0YWtlcyBhIHJ1bGUgc3VjaCBhczpcbiAgICpcbiAgICogYGBgXG4gICAqIEBrZXlmcmFtZXMgYm94LWFuaW1hdGlvbiB7XG4gICAqICAgdG8ge1xuICAgKiAgICAgYmFja2dyb3VuZC1jb2xvcjogZ3JlZW47XG4gICAqICAgfVxuICAgKiB9XG4gICAqIGBgYFxuICAgKlxuICAgKiBhbmQgcmV0dXJuczpcbiAgICpcbiAgICogYGBgXG4gICAqIEBrZXlmcmFtZXMgc2NvcGVOYW1lX2JveC1hbmltYXRpb24ge1xuICAgKiAgIHRvIHtcbiAgICogICAgIGJhY2tncm91bmQtY29sb3I6IGdyZWVuO1xuICAgKiAgIH1cbiAgICogfVxuICAgKiBgYGBcbiAgICogYW5kIGFzIGEgc2lkZSBlZmZlY3QgaXQgYWRkcyBcImJveC1hbmltYXRpb25cIiB0byB0aGUgYHVuc2NvcGVkS2V5ZnJhbWVzU2V0YCBzZXRcbiAgICpcbiAgICogQHBhcmFtIGNzc1J1bGUgdGhlIGNzcyBydWxlIHRvIHByb2Nlc3MuXG4gICAqIEBwYXJhbSBzY29wZVNlbGVjdG9yIHRoZSBjb21wb25lbnQncyBzY29wZSBzZWxlY3Rvci5cbiAgICogQHBhcmFtIHVuc2NvcGVkS2V5ZnJhbWVzU2V0IHRoZSBzZXQgb2YgdW5zY29wZWQga2V5ZnJhbWVzIG5hbWVzICh3aGljaCBjYW4gYmVcbiAgICogbW9kaWZpZWQgYXMgYSBzaWRlIGVmZmVjdClcbiAgICpcbiAgICogQHJldHVybnMgdGhlIGNzcyBydWxlIG1vZGlmaWVkIHdpdGggdGhlIHNjb3BlZCBrZXlmcmFtZXMgbmFtZS5cbiAgICovXG4gIHByaXZhdGUgX3Njb3BlTG9jYWxLZXlmcmFtZURlY2xhcmF0aW9ucyhcbiAgICBydWxlOiBDc3NSdWxlLFxuICAgIHNjb3BlU2VsZWN0b3I6IHN0cmluZyxcbiAgICB1bnNjb3BlZEtleWZyYW1lc1NldDogU2V0PHN0cmluZz4sXG4gICk6IENzc1J1bGUge1xuICAgIHJldHVybiB7XG4gICAgICAuLi5ydWxlLFxuICAgICAgc2VsZWN0b3I6IHJ1bGUuc2VsZWN0b3IucmVwbGFjZShcbiAgICAgICAgLyheQCg/Oi13ZWJraXQtKT9rZXlmcmFtZXMoPzpcXHMrKSkoWydcIl0/KSguKylcXDIoXFxzKikkLyxcbiAgICAgICAgKF8sIHN0YXJ0LCBxdW90ZSwga2V5ZnJhbWVOYW1lLCBlbmRTcGFjZXMpID0+IHtcbiAgICAgICAgICB1bnNjb3BlZEtleWZyYW1lc1NldC5hZGQodW5lc2NhcGVRdW90ZXMoa2V5ZnJhbWVOYW1lLCBxdW90ZSkpO1xuICAgICAgICAgIHJldHVybiBgJHtzdGFydH0ke3F1b3RlfSR7c2NvcGVTZWxlY3Rvcn1fJHtrZXlmcmFtZU5hbWV9JHtxdW90ZX0ke2VuZFNwYWNlc31gO1xuICAgICAgICB9LFxuICAgICAgKSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEZ1bmN0aW9uIHVzZWQgdG8gc2NvcGUgYSBrZXlmcmFtZXMgbmFtZSAob2J0YWluZWQgZnJvbSBhbiBhbmltYXRpb24gZGVjbGFyYXRpb24pXG4gICAqIHVzaW5nIGFuIGV4aXN0aW5nIHNldCBvZiB1bnNjb3BlZEtleWZyYW1lcyBuYW1lcyB0byBkaXNjZXJuIGlmIHRoZSBzY29waW5nIG5lZWRzIHRvIGJlXG4gICAqIHBlcmZvcm1lZCAoa2V5ZnJhbWVzIG5hbWVzIG9mIGtleWZyYW1lcyBub3QgZGVmaW5lZCBpbiB0aGUgY29tcG9uZW50J3MgY3NzIG5lZWQgbm90IHRvIGJlXG4gICAqIHNjb3BlZCkuXG4gICAqXG4gICAqIEBwYXJhbSBrZXlmcmFtZSB0aGUga2V5ZnJhbWVzIG5hbWUgdG8gY2hlY2suXG4gICAqIEBwYXJhbSBzY29wZVNlbGVjdG9yIHRoZSBjb21wb25lbnQncyBzY29wZSBzZWxlY3Rvci5cbiAgICogQHBhcmFtIHVuc2NvcGVkS2V5ZnJhbWVzU2V0IHRoZSBzZXQgb2YgdW5zY29wZWQga2V5ZnJhbWVzIG5hbWVzLlxuICAgKlxuICAgKiBAcmV0dXJucyB0aGUgc2NvcGVkIG5hbWUgb2YgdGhlIGtleWZyYW1lLCBvciB0aGUgb3JpZ2luYWwgbmFtZSBpcyB0aGUgbmFtZSBuZWVkIG5vdCB0byBiZVxuICAgKiBzY29wZWQuXG4gICAqL1xuICBwcml2YXRlIF9zY29wZUFuaW1hdGlvbktleWZyYW1lKFxuICAgIGtleWZyYW1lOiBzdHJpbmcsXG4gICAgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLFxuICAgIHVuc2NvcGVkS2V5ZnJhbWVzU2V0OiBSZWFkb25seVNldDxzdHJpbmc+LFxuICApOiBzdHJpbmcge1xuICAgIHJldHVybiBrZXlmcmFtZS5yZXBsYWNlKC9eKFxccyopKFsnXCJdPykoLis/KVxcMihcXHMqKSQvLCAoXywgc3BhY2VzMSwgcXVvdGUsIG5hbWUsIHNwYWNlczIpID0+IHtcbiAgICAgIG5hbWUgPSBgJHt1bnNjb3BlZEtleWZyYW1lc1NldC5oYXModW5lc2NhcGVRdW90ZXMobmFtZSwgcXVvdGUpKSA/IHNjb3BlU2VsZWN0b3IgKyAnXycgOiAnJ30ke25hbWV9YDtcbiAgICAgIHJldHVybiBgJHtzcGFjZXMxfSR7cXVvdGV9JHtuYW1lfSR7cXVvdGV9JHtzcGFjZXMyfWA7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVndWxhciBleHByZXNzaW9uIHVzZWQgdG8gZXh0cmFwb2xhdGUgdGhlIHBvc3NpYmxlIGtleWZyYW1lcyBmcm9tIGFuXG4gICAqIGFuaW1hdGlvbiBkZWNsYXJhdGlvbiAod2l0aCBwb3NzaWJseSBtdWx0aXBsZSBhbmltYXRpb24gZGVmaW5pdGlvbnMpXG4gICAqXG4gICAqIFRoZSByZWd1bGFyIGV4cHJlc3Npb24gY2FuIGJlIGRpdmlkZWQgaW4gdGhyZWUgcGFydHNcbiAgICogIC0gKF58XFxzK3wsKVxuICAgKiAgICBjYXB0dXJlcyBob3cgbWFueSAoaWYgYW55KSBsZWFkaW5nIHdoaXRlc3BhY2VzIGFyZSBwcmVzZW50IG9yIGEgY29tbWFcbiAgICogIC0gKD86KD86KFsnXCJdKSgoPzpcXFxcXFxcXHxcXFxcXFwyfCg/IVxcMikuKSspXFwyKXwoLT9bQS1aYS16XVtcXHdcXC1dKikpXG4gICAqICAgIGNhcHR1cmVzIHR3byBkaWZmZXJlbnQgcG9zc2libGUga2V5ZnJhbWVzLCBvbmVzIHdoaWNoIGFyZSBxdW90ZWQgb3Igb25lcyB3aGljaCBhcmUgdmFsaWQgY3NzXG4gICAqIGluZGVudHMgKGN1c3RvbSBwcm9wZXJ0aWVzIGV4Y2x1ZGVkKVxuICAgKiAgLSAoPz1bLFxccztdfCQpXG4gICAqICAgIHNpbXBseSBtYXRjaGVzIHRoZSBlbmQgb2YgdGhlIHBvc3NpYmxlIGtleWZyYW1lLCB2YWxpZCBlbmRpbmdzIGFyZTogYSBjb21tYSwgYSBzcGFjZSwgYVxuICAgKiBzZW1pY29sb24gb3IgdGhlIGVuZCBvZiB0aGUgc3RyaW5nXG4gICAqL1xuICBwcml2YXRlIF9hbmltYXRpb25EZWNsYXJhdGlvbktleWZyYW1lc1JlID1cbiAgICAvKF58XFxzK3wsKSg/Oig/OihbJ1wiXSkoKD86XFxcXFxcXFx8XFxcXFxcMnwoPyFcXDIpLikrKVxcMil8KC0/W0EtWmEtel1bXFx3XFwtXSopKSg/PVssXFxzXXwkKS9nO1xuXG4gIC8qKlxuICAgKiBTY29wZSBhbiBhbmltYXRpb24gcnVsZSBzbyB0aGF0IHRoZSBrZXlmcmFtZXMgbWVudGlvbmVkIGluIHN1Y2ggcnVsZVxuICAgKiBhcmUgc2NvcGVkIGlmIGRlZmluZWQgaW4gdGhlIGNvbXBvbmVudCdzIGNzcyBhbmQgbGVmdCB1bnRvdWNoZWQgb3RoZXJ3aXNlLlxuICAgKlxuICAgKiBJdCBjYW4gc2NvcGUgdmFsdWVzIG9mIGJvdGggdGhlICdhbmltYXRpb24nIGFuZCAnYW5pbWF0aW9uLW5hbWUnIHByb3BlcnRpZXMuXG4gICAqXG4gICAqIEBwYXJhbSBydWxlIGNzcyBydWxlIHRvIHNjb3BlLlxuICAgKiBAcGFyYW0gc2NvcGVTZWxlY3RvciB0aGUgY29tcG9uZW50J3Mgc2NvcGUgc2VsZWN0b3IuXG4gICAqIEBwYXJhbSB1bnNjb3BlZEtleWZyYW1lc1NldCB0aGUgc2V0IG9mIHVuc2NvcGVkIGtleWZyYW1lcyBuYW1lcy5cbiAgICpcbiAgICogQHJldHVybnMgdGhlIHVwZGF0ZWQgY3NzIHJ1bGUuXG4gICAqKi9cbiAgcHJpdmF0ZSBfc2NvcGVBbmltYXRpb25SdWxlKFxuICAgIHJ1bGU6IENzc1J1bGUsXG4gICAgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLFxuICAgIHVuc2NvcGVkS2V5ZnJhbWVzU2V0OiBSZWFkb25seVNldDxzdHJpbmc+LFxuICApOiBDc3NSdWxlIHtcbiAgICBsZXQgY29udGVudCA9IHJ1bGUuY29udGVudC5yZXBsYWNlKFxuICAgICAgLygoPzpefFxccyt8OykoPzotd2Via2l0LSk/YW5pbWF0aW9uXFxzKjpcXHMqKSwqKFteO10rKS9nLFxuICAgICAgKF8sIHN0YXJ0LCBhbmltYXRpb25EZWNsYXJhdGlvbnMpID0+XG4gICAgICAgIHN0YXJ0ICtcbiAgICAgICAgYW5pbWF0aW9uRGVjbGFyYXRpb25zLnJlcGxhY2UoXG4gICAgICAgICAgdGhpcy5fYW5pbWF0aW9uRGVjbGFyYXRpb25LZXlmcmFtZXNSZSxcbiAgICAgICAgICAoXG4gICAgICAgICAgICBvcmlnaW5hbDogc3RyaW5nLFxuICAgICAgICAgICAgbGVhZGluZ1NwYWNlczogc3RyaW5nLFxuICAgICAgICAgICAgcXVvdGUgPSAnJyxcbiAgICAgICAgICAgIHF1b3RlZE5hbWU6IHN0cmluZyxcbiAgICAgICAgICAgIG5vblF1b3RlZE5hbWU6IHN0cmluZyxcbiAgICAgICAgICApID0+IHtcbiAgICAgICAgICAgIGlmIChxdW90ZWROYW1lKSB7XG4gICAgICAgICAgICAgIHJldHVybiBgJHtsZWFkaW5nU3BhY2VzfSR7dGhpcy5fc2NvcGVBbmltYXRpb25LZXlmcmFtZShcbiAgICAgICAgICAgICAgICBgJHtxdW90ZX0ke3F1b3RlZE5hbWV9JHtxdW90ZX1gLFxuICAgICAgICAgICAgICAgIHNjb3BlU2VsZWN0b3IsXG4gICAgICAgICAgICAgICAgdW5zY29wZWRLZXlmcmFtZXNTZXQsXG4gICAgICAgICAgICAgICl9YDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBhbmltYXRpb25LZXl3b3Jkcy5oYXMobm9uUXVvdGVkTmFtZSlcbiAgICAgICAgICAgICAgICA/IG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgOiBgJHtsZWFkaW5nU3BhY2VzfSR7dGhpcy5fc2NvcGVBbmltYXRpb25LZXlmcmFtZShcbiAgICAgICAgICAgICAgICAgICAgbm9uUXVvdGVkTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgc2NvcGVTZWxlY3RvcixcbiAgICAgICAgICAgICAgICAgICAgdW5zY29wZWRLZXlmcmFtZXNTZXQsXG4gICAgICAgICAgICAgICAgICApfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgKSxcbiAgICApO1xuICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoXG4gICAgICAvKCg/Ol58XFxzK3w7KSg/Oi13ZWJraXQtKT9hbmltYXRpb24tbmFtZSg/OlxccyopOig/OlxccyopKShbXjtdKykvZyxcbiAgICAgIChfbWF0Y2gsIHN0YXJ0LCBjb21tYVNlcGFyYXRlZEtleWZyYW1lcykgPT5cbiAgICAgICAgYCR7c3RhcnR9JHtjb21tYVNlcGFyYXRlZEtleWZyYW1lc1xuICAgICAgICAgIC5zcGxpdCgnLCcpXG4gICAgICAgICAgLm1hcCgoa2V5ZnJhbWU6IHN0cmluZykgPT5cbiAgICAgICAgICAgIHRoaXMuX3Njb3BlQW5pbWF0aW9uS2V5ZnJhbWUoa2V5ZnJhbWUsIHNjb3BlU2VsZWN0b3IsIHVuc2NvcGVkS2V5ZnJhbWVzU2V0KSxcbiAgICAgICAgICApXG4gICAgICAgICAgLmpvaW4oJywnKX1gLFxuICAgICk7XG4gICAgcmV0dXJuIHsuLi5ydWxlLCBjb250ZW50fTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGNvbnZlcnQgbmF0aXZlIFNoYWRvd0RPTSBydWxlcyB0aGF0IHdpbGwgdHJpcFxuICAgKiB1cCB0aGUgY3NzIHBhcnNlcjsgd2UgcmVseSBvbiBkZWNvcmF0aW5nIHRoZSBzdHlsZXNoZWV0IHdpdGggaW5lcnQgcnVsZXMuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLCB3ZSBjb252ZXJ0IHRoaXMgcnVsZTpcbiAgICpcbiAgICogcG9seWZpbGwtbmV4dC1zZWxlY3RvciB7IGNvbnRlbnQ6ICc6aG9zdCBtZW51LWl0ZW0nOyB9XG4gICAqIDo6Y29udGVudCBtZW51LWl0ZW0ge1xuICAgKlxuICAgKiB0byB0aGlzOlxuICAgKlxuICAgKiBzY29wZU5hbWUgbWVudS1pdGVtIHtcbiAgICpcbiAgICoqL1xuICBwcml2YXRlIF9pbnNlcnRQb2x5ZmlsbERpcmVjdGl2ZXNJbkNzc1RleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY3NzVGV4dC5yZXBsYWNlKF9jc3NDb250ZW50TmV4dFNlbGVjdG9yUmUsIGZ1bmN0aW9uICguLi5tOiBzdHJpbmdbXSkge1xuICAgICAgcmV0dXJuIG1bMl0gKyAneyc7XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBQcm9jZXNzIHN0eWxlcyB0byBhZGQgcnVsZXMgd2hpY2ggd2lsbCBvbmx5IGFwcGx5IHVuZGVyIHRoZSBwb2x5ZmlsbFxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSwgd2UgY29udmVydCB0aGlzIHJ1bGU6XG4gICAqXG4gICAqIHBvbHlmaWxsLXJ1bGUge1xuICAgKiAgIGNvbnRlbnQ6ICc6aG9zdCBtZW51LWl0ZW0nO1xuICAgKiAuLi5cbiAgICogfVxuICAgKlxuICAgKiB0byB0aGlzOlxuICAgKlxuICAgKiBzY29wZU5hbWUgbWVudS1pdGVtIHsuLi59XG4gICAqXG4gICAqKi9cbiAgcHJpdmF0ZSBfaW5zZXJ0UG9seWZpbGxSdWxlc0luQ3NzVGV4dChjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjc3NUZXh0LnJlcGxhY2UoX2Nzc0NvbnRlbnRSdWxlUmUsICguLi5tOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgY29uc3QgcnVsZSA9IG1bMF0ucmVwbGFjZShtWzFdLCAnJykucmVwbGFjZShtWzJdLCAnJyk7XG4gICAgICByZXR1cm4gbVs0XSArIHJ1bGU7XG4gICAgfSk7XG4gIH1cblxuICAvKiBFbnN1cmUgc3R5bGVzIGFyZSBzY29wZWQuIFBzZXVkby1zY29waW5nIHRha2VzIGEgcnVsZSBsaWtlOlxuICAgKlxuICAgKiAgLmZvbyB7Li4uIH1cbiAgICpcbiAgICogIGFuZCBjb252ZXJ0cyB0aGlzIHRvXG4gICAqXG4gICAqICBzY29wZU5hbWUgLmZvbyB7IC4uLiB9XG4gICAqL1xuICBwcml2YXRlIF9zY29wZUNzc1RleHQoY3NzVGV4dDogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB1bnNjb3BlZFJ1bGVzID0gdGhpcy5fZXh0cmFjdFVuc2NvcGVkUnVsZXNGcm9tQ3NzVGV4dChjc3NUZXh0KTtcbiAgICAvLyByZXBsYWNlIDpob3N0IGFuZCA6aG9zdC1jb250ZXh0IHdpdGggLXNoYWRvd2Nzc2hvc3QgYW5kIC1zaGFkb3djc3Nob3N0Y29udGV4dCByZXNwZWN0aXZlbHlcbiAgICBjc3NUZXh0ID0gdGhpcy5faW5zZXJ0UG9seWZpbGxIb3N0SW5Dc3NUZXh0KGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9jb252ZXJ0Q29sb25Ib3N0KGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9jb252ZXJ0Q29sb25Ib3N0Q29udGV4dChjc3NUZXh0KTtcbiAgICBjc3NUZXh0ID0gdGhpcy5fY29udmVydFNoYWRvd0RPTVNlbGVjdG9ycyhjc3NUZXh0KTtcbiAgICBpZiAoc2NvcGVTZWxlY3Rvcikge1xuICAgICAgY3NzVGV4dCA9IHRoaXMuX3Njb3BlS2V5ZnJhbWVzUmVsYXRlZENzcyhjc3NUZXh0LCBzY29wZVNlbGVjdG9yKTtcbiAgICAgIGNzc1RleHQgPSB0aGlzLl9zY29wZVNlbGVjdG9ycyhjc3NUZXh0LCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICAgIH1cbiAgICBjc3NUZXh0ID0gY3NzVGV4dCArICdcXG4nICsgdW5zY29wZWRSdWxlcztcbiAgICByZXR1cm4gY3NzVGV4dC50cmltKCk7XG4gIH1cblxuICAvKlxuICAgKiBQcm9jZXNzIHN0eWxlcyB0byBhZGQgcnVsZXMgd2hpY2ggd2lsbCBvbmx5IGFwcGx5IHVuZGVyIHRoZSBwb2x5ZmlsbFxuICAgKiBhbmQgZG8gbm90IHByb2Nlc3MgdmlhIENTU09NLiAoQ1NTT00gaXMgZGVzdHJ1Y3RpdmUgdG8gcnVsZXMgb24gcmFyZVxuICAgKiBvY2Nhc2lvbnMsIGUuZy4gLXdlYmtpdC1jYWxjIG9uIFNhZmFyaS4pXG4gICAqIEZvciBleGFtcGxlLCB3ZSBjb252ZXJ0IHRoaXMgcnVsZTpcbiAgICpcbiAgICogQHBvbHlmaWxsLXVuc2NvcGVkLXJ1bGUge1xuICAgKiAgIGNvbnRlbnQ6ICdtZW51LWl0ZW0nO1xuICAgKiAuLi4gfVxuICAgKlxuICAgKiB0byB0aGlzOlxuICAgKlxuICAgKiBtZW51LWl0ZW0gey4uLn1cbiAgICpcbiAgICoqL1xuICBwcml2YXRlIF9leHRyYWN0VW5zY29wZWRSdWxlc0Zyb21Dc3NUZXh0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgbGV0IHIgPSAnJztcbiAgICBsZXQgbTogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcbiAgICBfY3NzQ29udGVudFVuc2NvcGVkUnVsZVJlLmxhc3RJbmRleCA9IDA7XG4gICAgd2hpbGUgKChtID0gX2Nzc0NvbnRlbnRVbnNjb3BlZFJ1bGVSZS5leGVjKGNzc1RleHQpKSAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcnVsZSA9IG1bMF0ucmVwbGFjZShtWzJdLCAnJykucmVwbGFjZShtWzFdLCBtWzRdKTtcbiAgICAgIHIgKz0gcnVsZSArICdcXG5cXG4nO1xuICAgIH1cbiAgICByZXR1cm4gcjtcbiAgfVxuXG4gIC8qXG4gICAqIGNvbnZlcnQgYSBydWxlIGxpa2UgOmhvc3QoLmZvbykgPiAuYmFyIHsgfVxuICAgKlxuICAgKiB0b1xuICAgKlxuICAgKiAuZm9vPHNjb3BlTmFtZT4gPiAuYmFyXG4gICAqL1xuICBwcml2YXRlIF9jb252ZXJ0Q29sb25Ib3N0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGNzc1RleHQucmVwbGFjZShfY3NzQ29sb25Ib3N0UmUsIChfLCBob3N0U2VsZWN0b3JzOiBzdHJpbmcsIG90aGVyU2VsZWN0b3JzOiBzdHJpbmcpID0+IHtcbiAgICAgIGlmIChob3N0U2VsZWN0b3JzKSB7XG4gICAgICAgIGNvbnN0IGNvbnZlcnRlZFNlbGVjdG9yczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgaG9zdFNlbGVjdG9yQXJyYXkgPSBob3N0U2VsZWN0b3JzLnNwbGl0KCcsJykubWFwKChwKSA9PiBwLnRyaW0oKSk7XG4gICAgICAgIGZvciAoY29uc3QgaG9zdFNlbGVjdG9yIG9mIGhvc3RTZWxlY3RvckFycmF5KSB7XG4gICAgICAgICAgaWYgKCFob3N0U2VsZWN0b3IpIGJyZWFrO1xuICAgICAgICAgIGNvbnN0IGNvbnZlcnRlZFNlbGVjdG9yID1cbiAgICAgICAgICAgIF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IgKyBob3N0U2VsZWN0b3IucmVwbGFjZShfcG9seWZpbGxIb3N0LCAnJykgKyBvdGhlclNlbGVjdG9ycztcbiAgICAgICAgICBjb252ZXJ0ZWRTZWxlY3RvcnMucHVzaChjb252ZXJ0ZWRTZWxlY3Rvcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbnZlcnRlZFNlbGVjdG9ycy5qb2luKCcsJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvciArIG90aGVyU2VsZWN0b3JzO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLypcbiAgICogY29udmVydCBhIHJ1bGUgbGlrZSA6aG9zdC1jb250ZXh0KC5mb28pID4gLmJhciB7IH1cbiAgICpcbiAgICogdG9cbiAgICpcbiAgICogLmZvbzxzY29wZU5hbWU+ID4gLmJhciwgLmZvbyA8c2NvcGVOYW1lPiA+IC5iYXIgeyB9XG4gICAqXG4gICAqIGFuZFxuICAgKlxuICAgKiA6aG9zdC1jb250ZXh0KC5mb286aG9zdCkgLmJhciB7IC4uLiB9XG4gICAqXG4gICAqIHRvXG4gICAqXG4gICAqIC5mb288c2NvcGVOYW1lPiAuYmFyIHsgLi4uIH1cbiAgICovXG4gIHByaXZhdGUgX2NvbnZlcnRDb2xvbkhvc3RDb250ZXh0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGNzc1RleHQucmVwbGFjZShfY3NzQ29sb25Ib3N0Q29udGV4dFJlR2xvYmFsLCAoc2VsZWN0b3JUZXh0LCBwc2V1ZG9QcmVmaXgpID0+IHtcbiAgICAgIC8vIFdlIGhhdmUgY2FwdHVyZWQgYSBzZWxlY3RvciB0aGF0IGNvbnRhaW5zIGEgYDpob3N0LWNvbnRleHRgIHJ1bGUuXG5cbiAgICAgIC8vIEZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGA6aG9zdC1jb250ZXh0YCBtYXkgY29udGFpbiBhIGNvbW1hIHNlcGFyYXRlZCBsaXN0IG9mIHNlbGVjdG9ycy5cbiAgICAgIC8vIEVhY2ggY29udGV4dCBzZWxlY3RvciBncm91cCB3aWxsIGNvbnRhaW4gYSBsaXN0IG9mIGhvc3QtY29udGV4dCBzZWxlY3RvcnMgdGhhdCBtdXN0IG1hdGNoXG4gICAgICAvLyBhbiBhbmNlc3RvciBvZiB0aGUgaG9zdC5cbiAgICAgIC8vIChOb3JtYWxseSBgY29udGV4dFNlbGVjdG9yR3JvdXBzYCB3aWxsIG9ubHkgY29udGFpbiBhIHNpbmdsZSBhcnJheSBvZiBjb250ZXh0IHNlbGVjdG9ycy4pXG4gICAgICBjb25zdCBjb250ZXh0U2VsZWN0b3JHcm91cHM6IHN0cmluZ1tdW10gPSBbW11dO1xuXG4gICAgICAvLyBUaGVyZSBtYXkgYmUgbW9yZSB0aGFuIGA6aG9zdC1jb250ZXh0YCBpbiB0aGlzIHNlbGVjdG9yIHNvIGBzZWxlY3RvclRleHRgIGNvdWxkIGxvb2sgbGlrZTpcbiAgICAgIC8vIGA6aG9zdC1jb250ZXh0KC5vbmUpOmhvc3QtY29udGV4dCgudHdvKWAuXG4gICAgICAvLyBFeGVjdXRlIGBfY3NzQ29sb25Ib3N0Q29udGV4dFJlYCBvdmVyIGFuZCBvdmVyIHVudGlsIHdlIGhhdmUgZXh0cmFjdGVkIGFsbCB0aGVcbiAgICAgIC8vIGA6aG9zdC1jb250ZXh0YCBzZWxlY3RvcnMgZnJvbSB0aGlzIHNlbGVjdG9yLlxuICAgICAgbGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICAgICAgd2hpbGUgKChtYXRjaCA9IF9jc3NDb2xvbkhvc3RDb250ZXh0UmUuZXhlYyhzZWxlY3RvclRleHQpKSkge1xuICAgICAgICAvLyBgbWF0Y2hgID0gWyc6aG9zdC1jb250ZXh0KDxzZWxlY3RvcnM+KTxyZXN0PicsIDxzZWxlY3RvcnM+LCA8cmVzdD5dXG5cbiAgICAgICAgLy8gVGhlIGA8c2VsZWN0b3JzPmAgY291bGQgYWN0dWFsbHkgYmUgYSBjb21tYSBzZXBhcmF0ZWQgbGlzdDogYDpob3N0LWNvbnRleHQoLm9uZSwgLnR3bylgLlxuICAgICAgICBjb25zdCBuZXdDb250ZXh0U2VsZWN0b3JzID0gKG1hdGNoWzFdID8/ICcnKVxuICAgICAgICAgIC50cmltKClcbiAgICAgICAgICAuc3BsaXQoJywnKVxuICAgICAgICAgIC5tYXAoKG0pID0+IG0udHJpbSgpKVxuICAgICAgICAgIC5maWx0ZXIoKG0pID0+IG0gIT09ICcnKTtcblxuICAgICAgICAvLyBXZSBtdXN0IGR1cGxpY2F0ZSB0aGUgY3VycmVudCBzZWxlY3RvciBncm91cCBmb3IgZWFjaCBvZiB0aGVzZSBuZXcgc2VsZWN0b3JzLlxuICAgICAgICAvLyBGb3IgZXhhbXBsZSBpZiB0aGUgY3VycmVudCBncm91cHMgYXJlOlxuICAgICAgICAvLyBgYGBcbiAgICAgICAgLy8gW1xuICAgICAgICAvLyAgIFsnYScsICdiJywgJ2MnXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6J10sXG4gICAgICAgIC8vIF1cbiAgICAgICAgLy8gYGBgXG4gICAgICAgIC8vIEFuZCB3ZSBoYXZlIGEgbmV3IHNldCBvZiBjb21tYSBzZXBhcmF0ZWQgc2VsZWN0b3JzOiBgOmhvc3QtY29udGV4dChtLG4pYCB0aGVuIHRoZSBuZXdcbiAgICAgICAgLy8gZ3JvdXBzIGFyZTpcbiAgICAgICAgLy8gYGBgXG4gICAgICAgIC8vIFtcbiAgICAgICAgLy8gICBbJ2EnLCAnYicsICdjJywgJ20nXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6JywgJ20nXSxcbiAgICAgICAgLy8gICBbJ2EnLCAnYicsICdjJywgJ24nXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6JywgJ24nXSxcbiAgICAgICAgLy8gXVxuICAgICAgICAvLyBgYGBcbiAgICAgICAgY29uc3QgY29udGV4dFNlbGVjdG9yR3JvdXBzTGVuZ3RoID0gY29udGV4dFNlbGVjdG9yR3JvdXBzLmxlbmd0aDtcbiAgICAgICAgcmVwZWF0R3JvdXBzKGNvbnRleHRTZWxlY3Rvckdyb3VwcywgbmV3Q29udGV4dFNlbGVjdG9ycy5sZW5ndGgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5ld0NvbnRleHRTZWxlY3RvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNvbnRleHRTZWxlY3Rvckdyb3Vwc0xlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBjb250ZXh0U2VsZWN0b3JHcm91cHNbaiArIGkgKiBjb250ZXh0U2VsZWN0b3JHcm91cHNMZW5ndGhdLnB1c2gobmV3Q29udGV4dFNlbGVjdG9yc1tpXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBgc2VsZWN0b3JUZXh0YCBhbmQgc2VlIHJlcGVhdCB0byBzZWUgaWYgdGhlcmUgYXJlIG1vcmUgYDpob3N0LWNvbnRleHRgcy5cbiAgICAgICAgc2VsZWN0b3JUZXh0ID0gbWF0Y2hbMl07XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBjb250ZXh0IHNlbGVjdG9ycyBub3cgbXVzdCBiZSBjb21iaW5lZCB3aXRoIGVhY2ggb3RoZXIgdG8gY2FwdHVyZSBhbGwgdGhlIHBvc3NpYmxlXG4gICAgICAvLyBzZWxlY3RvcnMgdGhhdCBgOmhvc3QtY29udGV4dGAgY2FuIG1hdGNoLiBTZWUgYF9jb21iaW5lSG9zdENvbnRleHRTZWxlY3RvcnMoKWAgZm9yIG1vcmVcbiAgICAgIC8vIGluZm8gYWJvdXQgaG93IHRoaXMgaXMgZG9uZS5cbiAgICAgIHJldHVybiBjb250ZXh0U2VsZWN0b3JHcm91cHNcbiAgICAgICAgLm1hcCgoY29udGV4dFNlbGVjdG9ycykgPT5cbiAgICAgICAgICBfY29tYmluZUhvc3RDb250ZXh0U2VsZWN0b3JzKGNvbnRleHRTZWxlY3RvcnMsIHNlbGVjdG9yVGV4dCwgcHNldWRvUHJlZml4KSxcbiAgICAgICAgKVxuICAgICAgICAuam9pbignLCAnKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIENvbnZlcnQgY29tYmluYXRvcnMgbGlrZSA6OnNoYWRvdyBhbmQgcHNldWRvLWVsZW1lbnRzIGxpa2UgOjpjb250ZW50XG4gICAqIGJ5IHJlcGxhY2luZyB3aXRoIHNwYWNlLlxuICAgKi9cbiAgcHJpdmF0ZSBfY29udmVydFNoYWRvd0RPTVNlbGVjdG9ycyhjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBfc2hhZG93RE9NU2VsZWN0b3JzUmUucmVkdWNlKChyZXN1bHQsIHBhdHRlcm4pID0+IHJlc3VsdC5yZXBsYWNlKHBhdHRlcm4sICcgJyksIGNzc1RleHQpO1xuICB9XG5cbiAgLy8gY2hhbmdlIGEgc2VsZWN0b3IgbGlrZSAnZGl2JyB0byAnbmFtZSBkaXYnXG4gIHByaXZhdGUgX3Njb3BlU2VsZWN0b3JzKGNzc1RleHQ6IHN0cmluZywgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHByb2Nlc3NSdWxlcyhjc3NUZXh0LCAocnVsZTogQ3NzUnVsZSkgPT4ge1xuICAgICAgbGV0IHNlbGVjdG9yID0gcnVsZS5zZWxlY3RvcjtcbiAgICAgIGxldCBjb250ZW50ID0gcnVsZS5jb250ZW50O1xuICAgICAgaWYgKHJ1bGUuc2VsZWN0b3JbMF0gIT09ICdAJykge1xuICAgICAgICBzZWxlY3RvciA9IHRoaXMuX3Njb3BlU2VsZWN0b3Ioe1xuICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgIHNjb3BlU2VsZWN0b3IsXG4gICAgICAgICAgaG9zdFNlbGVjdG9yLFxuICAgICAgICAgIGlzUGFyZW50U2VsZWN0b3I6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChzY29wZWRBdFJ1bGVJZGVudGlmaWVycy5zb21lKChhdFJ1bGUpID0+IHJ1bGUuc2VsZWN0b3Iuc3RhcnRzV2l0aChhdFJ1bGUpKSkge1xuICAgICAgICBjb250ZW50ID0gdGhpcy5fc2NvcGVTZWxlY3RvcnMocnVsZS5jb250ZW50LCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICAgICAgfSBlbHNlIGlmIChydWxlLnNlbGVjdG9yLnN0YXJ0c1dpdGgoJ0Bmb250LWZhY2UnKSB8fCBydWxlLnNlbGVjdG9yLnN0YXJ0c1dpdGgoJ0BwYWdlJykpIHtcbiAgICAgICAgY29udGVudCA9IHRoaXMuX3N0cmlwU2NvcGluZ1NlbGVjdG9ycyhydWxlLmNvbnRlbnQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBDc3NSdWxlKHNlbGVjdG9yLCBjb250ZW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgYSBjc3MgdGV4dCB0aGF0IGlzIHdpdGhpbiBhIHJ1bGUgdGhhdCBzaG91bGQgbm90IGNvbnRhaW4gc2NvcGUgc2VsZWN0b3JzIGJ5IHNpbXBseVxuICAgKiByZW1vdmluZyB0aGVtISBBbiBleGFtcGxlIG9mIHN1Y2ggYSBydWxlIGlzIGBAZm9udC1mYWNlYC5cbiAgICpcbiAgICogYEBmb250LWZhY2VgIHJ1bGVzIGNhbm5vdCBjb250YWluIG5lc3RlZCBzZWxlY3RvcnMuIE5vciBjYW4gdGhleSBiZSBuZXN0ZWQgdW5kZXIgYSBzZWxlY3Rvci5cbiAgICogTm9ybWFsbHkgdGhpcyB3b3VsZCBiZSBhIHN5bnRheCBlcnJvciBieSB0aGUgYXV0aG9yIG9mIHRoZSBzdHlsZXMuIEJ1dCBpbiBzb21lIHJhcmUgY2FzZXMsIHN1Y2hcbiAgICogYXMgaW1wb3J0aW5nIHN0eWxlcyBmcm9tIGEgbGlicmFyeSwgYW5kIGFwcGx5aW5nIGA6aG9zdCA6Om5nLWRlZXBgIHRvIHRoZSBpbXBvcnRlZCBzdHlsZXMsIHdlXG4gICAqIGNhbiBlbmQgdXAgd2l0aCBicm9rZW4gY3NzIGlmIHRoZSBpbXBvcnRlZCBzdHlsZXMgaGFwcGVuIHRvIGNvbnRhaW4gQGZvbnQtZmFjZSBydWxlcy5cbiAgICpcbiAgICogRm9yIGV4YW1wbGU6XG4gICAqXG4gICAqIGBgYFxuICAgKiA6aG9zdCA6Om5nLWRlZXAge1xuICAgKiAgIGltcG9ydCAnc29tZS9saWIvY29udGFpbmluZy9mb250LWZhY2UnO1xuICAgKiB9XG4gICAqXG4gICAqIFNpbWlsYXIgbG9naWMgYXBwbGllcyB0byBgQHBhZ2VgIHJ1bGVzIHdoaWNoIGNhbiBjb250YWluIGEgcGFydGljdWxhciBzZXQgb2YgcHJvcGVydGllcyxcbiAgICogYXMgd2VsbCBhcyBzb21lIHNwZWNpZmljIGF0LXJ1bGVzLiBTaW5jZSB0aGV5IGNhbid0IGJlIGVuY2Fwc3VsYXRlZCwgd2UgaGF2ZSB0byBzdHJpcFxuICAgKiBhbnkgc2NvcGluZyBzZWxlY3RvcnMgZnJvbSB0aGVtLiBGb3IgbW9yZSBpbmZvcm1hdGlvbjogaHR0cHM6Ly93d3cudzMub3JnL1RSL2Nzcy1wYWdlLTNcbiAgICogYGBgXG4gICAqL1xuICBwcml2YXRlIF9zdHJpcFNjb3BpbmdTZWxlY3RvcnMoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcHJvY2Vzc1J1bGVzKGNzc1RleHQsIChydWxlKSA9PiB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IHJ1bGUuc2VsZWN0b3JcbiAgICAgICAgLnJlcGxhY2UoX3NoYWRvd0RlZXBTZWxlY3RvcnMsICcgJylcbiAgICAgICAgLnJlcGxhY2UoX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvclJlLCAnICcpO1xuICAgICAgcmV0dXJuIG5ldyBDc3NSdWxlKHNlbGVjdG9yLCBydWxlLmNvbnRlbnQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfc2FmZVNlbGVjdG9yOiBTYWZlU2VsZWN0b3IgfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX3Nob3VsZFNjb3BlSW5kaWNhdG9yOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG4gIC8vIGBpc1BhcmVudFNlbGVjdG9yYCBpcyB1c2VkIHRvIGRpc3Rpbmd1aXNoIHRoZSBzZWxlY3RvcnMgd2hpY2ggYXJlIGNvbWluZyBmcm9tXG4gIC8vIHRoZSBpbml0aWFsIHNlbGVjdG9yIHN0cmluZyBhbmQgYW55IG5lc3RlZCBzZWxlY3RvcnMsIHBhcnNlZCByZWN1cnNpdmVseSxcbiAgLy8gZm9yIGV4YW1wbGUgYHNlbGVjdG9yID0gJ2E6d2hlcmUoLm9uZSknYCBjb3VsZCBiZSB0aGUgcGFyZW50LCB3aGlsZSByZWN1cnNpdmUgY2FsbFxuICAvLyB3b3VsZCBoYXZlIGBzZWxlY3RvciA9ICcub25lJ2AuXG4gIHByaXZhdGUgX3Njb3BlU2VsZWN0b3Ioe1xuICAgIHNlbGVjdG9yLFxuICAgIHNjb3BlU2VsZWN0b3IsXG4gICAgaG9zdFNlbGVjdG9yLFxuICAgIGlzUGFyZW50U2VsZWN0b3IgPSBmYWxzZSxcbiAgfToge1xuICAgIHNlbGVjdG9yOiBzdHJpbmc7XG4gICAgc2NvcGVTZWxlY3Rvcjogc3RyaW5nO1xuICAgIGhvc3RTZWxlY3Rvcjogc3RyaW5nO1xuICAgIGlzUGFyZW50U2VsZWN0b3I/OiBib29sZWFuO1xuICB9KTogc3RyaW5nIHtcbiAgICAvLyBTcGxpdCB0aGUgc2VsZWN0b3IgaW50byBpbmRlcGVuZGVudCBwYXJ0cyBieSBgLGAgKGNvbW1hKSB1bmxlc3NcbiAgICAvLyBjb21tYSBpcyB3aXRoaW4gcGFyZW50aGVzaXMsIGZvciBleGFtcGxlIGA6aXMoLm9uZSwgdHdvKWAuXG4gICAgLy8gTmVnYXRpdmUgbG9va3VwIGFmdGVyIGNvbW1hIGFsbG93cyBub3Qgc3BsaXR0aW5nIGluc2lkZSBuZXN0ZWQgcGFyZW50aGVzaXMsXG4gICAgLy8gdXAgdG8gdGhyZWUgbGV2ZWxzICgoKCwpKSkuXG4gICAgY29uc3Qgc2VsZWN0b3JTcGxpdFJlID1cbiAgICAgIC8gPywoPyEoPzpbXikoXSooPzpcXChbXikoXSooPzpcXChbXikoXSooPzpcXChbXikoXSpcXClbXikoXSopKlxcKVteKShdKikqXFwpW14pKF0qKSpcXCkpKSA/LztcblxuICAgIHJldHVybiBzZWxlY3RvclxuICAgICAgLnNwbGl0KHNlbGVjdG9yU3BsaXRSZSlcbiAgICAgIC5tYXAoKHBhcnQpID0+IHBhcnQuc3BsaXQoX3NoYWRvd0RlZXBTZWxlY3RvcnMpKVxuICAgICAgLm1hcCgoZGVlcFBhcnRzKSA9PiB7XG4gICAgICAgIGNvbnN0IFtzaGFsbG93UGFydCwgLi4ub3RoZXJQYXJ0c10gPSBkZWVwUGFydHM7XG4gICAgICAgIGNvbnN0IGFwcGx5U2NvcGUgPSAoc2hhbGxvd1BhcnQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLl9zZWxlY3Rvck5lZWRzU2NvcGluZyhzaGFsbG93UGFydCwgc2NvcGVTZWxlY3RvcikpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9hcHBseVNlbGVjdG9yU2NvcGUoe1xuICAgICAgICAgICAgICBzZWxlY3Rvcjogc2hhbGxvd1BhcnQsXG4gICAgICAgICAgICAgIHNjb3BlU2VsZWN0b3IsXG4gICAgICAgICAgICAgIGhvc3RTZWxlY3RvcixcbiAgICAgICAgICAgICAgaXNQYXJlbnRTZWxlY3RvcixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc2hhbGxvd1BhcnQ7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gW2FwcGx5U2NvcGUoc2hhbGxvd1BhcnQpLCAuLi5vdGhlclBhcnRzXS5qb2luKCcgJyk7XG4gICAgICB9KVxuICAgICAgLmpvaW4oJywgJyk7XG4gIH1cblxuICBwcml2YXRlIF9zZWxlY3Rvck5lZWRzU2NvcGluZyhzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCByZSA9IHRoaXMuX21ha2VTY29wZU1hdGNoZXIoc2NvcGVTZWxlY3Rvcik7XG4gICAgcmV0dXJuICFyZS50ZXN0KHNlbGVjdG9yKTtcbiAgfVxuXG4gIHByaXZhdGUgX21ha2VTY29wZU1hdGNoZXIoc2NvcGVTZWxlY3Rvcjogc3RyaW5nKTogUmVnRXhwIHtcbiAgICBjb25zdCBscmUgPSAvXFxbL2c7XG4gICAgY29uc3QgcnJlID0gL1xcXS9nO1xuICAgIHNjb3BlU2VsZWN0b3IgPSBzY29wZVNlbGVjdG9yLnJlcGxhY2UobHJlLCAnXFxcXFsnKS5yZXBsYWNlKHJyZSwgJ1xcXFxdJyk7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoJ14oJyArIHNjb3BlU2VsZWN0b3IgKyAnKScgKyBfc2VsZWN0b3JSZVN1ZmZpeCwgJ20nKTtcbiAgfVxuXG4gIC8vIHNjb3BlIHZpYSBuYW1lIGFuZCBbaXM9bmFtZV1cbiAgcHJpdmF0ZSBfYXBwbHlTaW1wbGVTZWxlY3RvclNjb3BlKFxuICAgIHNlbGVjdG9yOiBzdHJpbmcsXG4gICAgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLFxuICAgIGhvc3RTZWxlY3Rvcjogc3RyaW5nLFxuICApOiBzdHJpbmcge1xuICAgIC8vIEluIEFuZHJvaWQgYnJvd3NlciwgdGhlIGxhc3RJbmRleCBpcyBub3QgcmVzZXQgd2hlbiB0aGUgcmVnZXggaXMgdXNlZCBpbiBTdHJpbmcucmVwbGFjZSgpXG4gICAgX3BvbHlmaWxsSG9zdFJlLmxhc3RJbmRleCA9IDA7XG4gICAgaWYgKF9wb2x5ZmlsbEhvc3RSZS50ZXN0KHNlbGVjdG9yKSkge1xuICAgICAgY29uc3QgcmVwbGFjZUJ5ID0gYFske2hvc3RTZWxlY3Rvcn1dYDtcbiAgICAgIHJldHVybiBzZWxlY3RvclxuICAgICAgICAucmVwbGFjZShfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yUmVHbG9iYWwsIChfaG5jLCBzZWxlY3RvcikgPT4ge1xuICAgICAgICAgIHJldHVybiBzZWxlY3Rvci5yZXBsYWNlKFxuICAgICAgICAgICAgLyhbXjpcXCldKikoOiopKC4qKS8sXG4gICAgICAgICAgICAoXzogc3RyaW5nLCBiZWZvcmU6IHN0cmluZywgY29sb246IHN0cmluZywgYWZ0ZXI6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gYmVmb3JlICsgcmVwbGFjZUJ5ICsgY29sb24gKyBhZnRlcjtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKTtcbiAgICAgICAgfSlcbiAgICAgICAgLnJlcGxhY2UoX3BvbHlmaWxsSG9zdFJlLCByZXBsYWNlQnkgKyAnICcpO1xuICAgIH1cblxuICAgIHJldHVybiBzY29wZVNlbGVjdG9yICsgJyAnICsgc2VsZWN0b3I7XG4gIH1cblxuICAvLyByZXR1cm4gYSBzZWxlY3RvciB3aXRoIFtuYW1lXSBzdWZmaXggb24gZWFjaCBzaW1wbGUgc2VsZWN0b3JcbiAgLy8gZS5nLiAuZm9vLmJhciA+IC56b3QgYmVjb21lcyAuZm9vW25hbWVdLmJhcltuYW1lXSA+IC56b3RbbmFtZV0gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSBfYXBwbHlTZWxlY3RvclNjb3BlKHtcbiAgICBzZWxlY3RvcixcbiAgICBzY29wZVNlbGVjdG9yLFxuICAgIGhvc3RTZWxlY3RvcixcbiAgICBpc1BhcmVudFNlbGVjdG9yLFxuICB9OiB7XG4gICAgc2VsZWN0b3I6IHN0cmluZztcbiAgICBzY29wZVNlbGVjdG9yOiBzdHJpbmc7XG4gICAgaG9zdFNlbGVjdG9yOiBzdHJpbmc7XG4gICAgaXNQYXJlbnRTZWxlY3Rvcj86IGJvb2xlYW47XG4gIH0pOiBzdHJpbmcge1xuICAgIGNvbnN0IGlzUmUgPSAvXFxbaXM9KFteXFxdXSopXFxdL2c7XG4gICAgc2NvcGVTZWxlY3RvciA9IHNjb3BlU2VsZWN0b3IucmVwbGFjZShpc1JlLCAoXzogc3RyaW5nLCAuLi5wYXJ0czogc3RyaW5nW10pID0+IHBhcnRzWzBdKTtcblxuICAgIGNvbnN0IGF0dHJOYW1lID0gJ1snICsgc2NvcGVTZWxlY3RvciArICddJztcblxuICAgIGNvbnN0IF9zY29wZVNlbGVjdG9yUGFydCA9IChwOiBzdHJpbmcpID0+IHtcbiAgICAgIGxldCBzY29wZWRQID0gcC50cmltKCk7XG5cbiAgICAgIGlmICghc2NvcGVkUCkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICAgIH1cblxuICAgICAgaWYgKHAuaW5jbHVkZXMoX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvcikpIHtcbiAgICAgICAgc2NvcGVkUCA9IHRoaXMuX2FwcGx5U2ltcGxlU2VsZWN0b3JTY29wZShwLCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICAgICAgICBpZiAoX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvcldpdGhpblBzZXVkb0Z1bmN0aW9uLnRlc3QocCkpIHtcbiAgICAgICAgICBjb25zdCBbXywgYmVmb3JlLCBjb2xvbiwgYWZ0ZXJdID0gc2NvcGVkUC5tYXRjaCgvKFteOl0qKSg6KikoLiopLykhO1xuICAgICAgICAgIHNjb3BlZFAgPSBiZWZvcmUgKyBhdHRyTmFtZSArIGNvbG9uICsgYWZ0ZXI7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHJlbW92ZSA6aG9zdCBzaW5jZSBpdCBzaG91bGQgYmUgdW5uZWNlc3NhcnlcbiAgICAgICAgY29uc3QgdCA9IHAucmVwbGFjZShfcG9seWZpbGxIb3N0UmUsICcnKTtcbiAgICAgICAgaWYgKHQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSB0Lm1hdGNoKC8oW146XSopKDoqKSguKikvKTtcbiAgICAgICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICAgICAgc2NvcGVkUCA9IG1hdGNoZXNbMV0gKyBhdHRyTmFtZSArIG1hdGNoZXNbMl0gKyBtYXRjaGVzWzNdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2NvcGVkUDtcbiAgICB9O1xuXG4gICAgLy8gV3JhcHMgYF9zY29wZVNlbGVjdG9yUGFydCgpYCB0byBub3QgdXNlIGl0IGRpcmVjdGx5IG9uIHNlbGVjdG9ycyB3aXRoXG4gICAgLy8gcHNldWRvIHNlbGVjdG9yIGZ1bmN0aW9ucyBsaWtlIGA6d2hlcmUoKWAuIFNlbGVjdG9ycyB3aXRoaW4gcHNldWRvIHNlbGVjdG9yXG4gICAgLy8gZnVuY3Rpb25zIGFyZSByZWN1cnNpdmVseSBzZW50IHRvIGBfc2NvcGVTZWxlY3RvcigpYC5cbiAgICBjb25zdCBfcHNldWRvRnVuY3Rpb25Bd2FyZVNjb3BlU2VsZWN0b3JQYXJ0ID0gKHNlbGVjdG9yUGFydDogc3RyaW5nKSA9PiB7XG4gICAgICBsZXQgc2NvcGVkUGFydCA9ICcnO1xuXG4gICAgICBjb25zdCBjc3NQcmVmaXhXaXRoUHNldWRvU2VsZWN0b3JGdW5jdGlvbk1hdGNoID0gc2VsZWN0b3JQYXJ0Lm1hdGNoKFxuICAgICAgICBfY3NzUHJlZml4V2l0aFBzZXVkb1NlbGVjdG9yRnVuY3Rpb24sXG4gICAgICApO1xuICAgICAgaWYgKGNzc1ByZWZpeFdpdGhQc2V1ZG9TZWxlY3RvckZ1bmN0aW9uTWF0Y2gpIHtcbiAgICAgICAgY29uc3QgW2Nzc1BzZXVkb1NlbGVjdG9yRnVuY3Rpb25dID0gY3NzUHJlZml4V2l0aFBzZXVkb1NlbGVjdG9yRnVuY3Rpb25NYXRjaDtcblxuICAgICAgICAvLyBVbndyYXAgdGhlIHBzZXVkbyBzZWxlY3RvciB0byBzY29wZSBpdHMgY29udGVudHMuXG4gICAgICAgIC8vIEZvciBleGFtcGxlLFxuICAgICAgICAvLyAtIGA6d2hlcmUoc2VsZWN0b3JUb1Njb3BlKWAgLT4gYHNlbGVjdG9yVG9TY29wZWA7XG4gICAgICAgIC8vIC0gYDppcyguZm9vLCAuYmFyKWAgLT4gYC5mb28sIC5iYXJgLlxuICAgICAgICBjb25zdCBzZWxlY3RvclRvU2NvcGUgPSBzZWxlY3RvclBhcnQuc2xpY2UoY3NzUHNldWRvU2VsZWN0b3JGdW5jdGlvbi5sZW5ndGgsIC0xKTtcblxuICAgICAgICBpZiAoc2VsZWN0b3JUb1Njb3BlLmluY2x1ZGVzKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpKSB7XG4gICAgICAgICAgdGhpcy5fc2hvdWxkU2NvcGVJbmRpY2F0b3IgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NvcGVkSW5uZXJQYXJ0ID0gdGhpcy5fc2NvcGVTZWxlY3Rvcih7XG4gICAgICAgICAgc2VsZWN0b3I6IHNlbGVjdG9yVG9TY29wZSxcbiAgICAgICAgICBzY29wZVNlbGVjdG9yLFxuICAgICAgICAgIGhvc3RTZWxlY3RvcixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUHV0IHRoZSByZXN1bHQgYmFjayBpbnRvIHRoZSBwc2V1ZG8gc2VsZWN0b3IgZnVuY3Rpb24uXG4gICAgICAgIHNjb3BlZFBhcnQgPSBgJHtjc3NQc2V1ZG9TZWxlY3RvckZ1bmN0aW9ufSR7c2NvcGVkSW5uZXJQYXJ0fSlgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fc2hvdWxkU2NvcGVJbmRpY2F0b3IgPVxuICAgICAgICAgIHRoaXMuX3Nob3VsZFNjb3BlSW5kaWNhdG9yIHx8IHNlbGVjdG9yUGFydC5pbmNsdWRlcyhfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yKTtcbiAgICAgICAgc2NvcGVkUGFydCA9IHRoaXMuX3Nob3VsZFNjb3BlSW5kaWNhdG9yID8gX3Njb3BlU2VsZWN0b3JQYXJ0KHNlbGVjdG9yUGFydCkgOiBzZWxlY3RvclBhcnQ7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzY29wZWRQYXJ0O1xuICAgIH07XG5cbiAgICBpZiAoaXNQYXJlbnRTZWxlY3Rvcikge1xuICAgICAgdGhpcy5fc2FmZVNlbGVjdG9yID0gbmV3IFNhZmVTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICBzZWxlY3RvciA9IHRoaXMuX3NhZmVTZWxlY3Rvci5jb250ZW50KCk7XG4gICAgfVxuXG4gICAgbGV0IHNjb3BlZFNlbGVjdG9yID0gJyc7XG4gICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuICAgIGxldCByZXM6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gICAgLy8gQ29tYmluYXRvcnMgYXJlbid0IHVzZWQgYXMgYSBkZWxpbWl0ZXIgaWYgdGhleSBhcmUgd2l0aGluIHBhcmVudGhlc2lzLFxuICAgIC8vIGZvciBleGFtcGxlIGA6d2hlcmUoLm9uZSAudHdvKWAgc3RheXMgaW50YWN0LlxuICAgIC8vIFNpbWlsYXJseSB0byBzZWxlY3RvciBzZXBhcmF0aW9uIGJ5IGNvbW1hIGluaXRpYWxseSwgbmVnYXRpdmUgbG9va2FoZWFkXG4gICAgLy8gaXMgdXNlZCBoZXJlIHRvIG5vdCBicmVhayBzZWxlY3RvcnMgd2l0aGluIG5lc3RlZCBwYXJlbnRoZXNpcyB1cCB0byB0aHJlZVxuICAgIC8vIG5lc3RlZCBsYXllcnMuXG4gICAgY29uc3Qgc2VwID1cbiAgICAgIC8oIHw+fFxcK3x+KD8hPSkpKD8hKFteKShdKig/OlxcKFteKShdKig/OlxcKFteKShdKig/OlxcKFteKShdKlxcKVteKShdKikqXFwpW14pKF0qKSpcXClbXikoXSopKlxcKSkpXFxzKi9nO1xuXG4gICAgLy8gSWYgYSBzZWxlY3RvciBhcHBlYXJzIGJlZm9yZSA6aG9zdCBpdCBzaG91bGQgbm90IGJlIHNoaW1tZWQgYXMgaXRcbiAgICAvLyBtYXRjaGVzIG9uIGFuY2VzdG9yIGVsZW1lbnRzIGFuZCBub3Qgb24gZWxlbWVudHMgaW4gdGhlIGhvc3QncyBzaGFkb3dcbiAgICAvLyBgOmhvc3QtY29udGV4dChkaXYpYCBpcyB0cmFuc2Zvcm1lZCB0b1xuICAgIC8vIGAtc2hhZG93Y3NzaG9zdC1uby1jb21iaW5hdG9yZGl2LCBkaXYgLXNoYWRvd2Nzc2hvc3Qtbm8tY29tYmluYXRvcmBcbiAgICAvLyB0aGUgYGRpdmAgaXMgbm90IHBhcnQgb2YgdGhlIGNvbXBvbmVudCBpbiB0aGUgMm5kIHNlbGVjdG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBzY29wZWQuXG4gICAgLy8gSGlzdG9yaWNhbGx5IGBjb21wb25lbnQtdGFnOmhvc3RgIHdhcyBtYXRjaGluZyB0aGUgY29tcG9uZW50IHNvIHdlIGFsc28gd2FudCB0byBwcmVzZXJ2ZVxuICAgIC8vIHRoaXMgYmVoYXZpb3IgdG8gYXZvaWQgYnJlYWtpbmcgbGVnYWN5IGFwcHMgKGl0IHNob3VsZCBub3QgbWF0Y2gpLlxuICAgIC8vIFRoZSBiZWhhdmlvciBzaG91bGQgYmU6XG4gICAgLy8gLSBgdGFnOmhvc3RgIC0+IGB0YWdbaF1gICh0aGlzIGlzIHRvIGF2b2lkIGJyZWFraW5nIGxlZ2FjeSBhcHBzLCBzaG91bGQgbm90IG1hdGNoIGFueXRoaW5nKVxuICAgIC8vIC0gYHRhZyA6aG9zdGAgLT4gYHRhZyBbaF1gIChgdGFnYCBpcyBub3Qgc2NvcGVkIGJlY2F1c2UgaXQncyBjb25zaWRlcmVkIHBhcnQgb2YgYVxuICAgIC8vICAgYDpob3N0LWNvbnRleHQodGFnKWApXG4gICAgY29uc3QgaGFzSG9zdCA9IHNlbGVjdG9yLmluY2x1ZGVzKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpO1xuICAgIC8vIE9ubHkgc2NvcGUgcGFydHMgYWZ0ZXIgb3Igb24gdGhlIHNhbWUgbGV2ZWwgYXMgdGhlIGZpcnN0IGAtc2hhZG93Y3NzaG9zdC1uby1jb21iaW5hdG9yYFxuICAgIC8vIHdoZW4gaXQgaXMgcHJlc2VudC4gVGhlIHNlbGVjdG9yIGhhcyB0aGUgc2FtZSBsZXZlbCB3aGVuIGl0IGlzIGEgcGFydCBvZiBhIHBzZXVkb1xuICAgIC8vIHNlbGVjdG9yLCBsaWtlIGA6d2hlcmUoKWAsIGZvciBleGFtcGxlIGA6d2hlcmUoOmhvc3QsIC5mb28pYCB3b3VsZCByZXN1bHQgaW4gYC5mb29gXG4gICAgLy8gYmVpbmcgc2NvcGVkLlxuICAgIGlmIChpc1BhcmVudFNlbGVjdG9yIHx8IHRoaXMuX3Nob3VsZFNjb3BlSW5kaWNhdG9yKSB7XG4gICAgICB0aGlzLl9zaG91bGRTY29wZUluZGljYXRvciA9ICFoYXNIb3N0O1xuICAgIH1cblxuICAgIHdoaWxlICgocmVzID0gc2VwLmV4ZWMoc2VsZWN0b3IpKSAhPT0gbnVsbCkge1xuICAgICAgY29uc3Qgc2VwYXJhdG9yID0gcmVzWzFdO1xuICAgICAgLy8gRG8gbm90IHRyaW0gdGhlIHNlbGVjdG9yLCBhcyBvdGhlcndpc2UgdGhpcyB3aWxsIGJyZWFrIHNvdXJjZW1hcHNcbiAgICAgIC8vIHdoZW4gdGhleSBhcmUgZGVmaW5lZCBvbiBtdWx0aXBsZSBsaW5lc1xuICAgICAgLy8gRXhhbXBsZTpcbiAgICAgIC8vICBkaXYsXG4gICAgICAvLyAgcCB7IGNvbG9yOiByZWR9XG4gICAgICBjb25zdCBwYXJ0ID0gc2VsZWN0b3Iuc2xpY2Uoc3RhcnRJbmRleCwgcmVzLmluZGV4KTtcblxuICAgICAgLy8gQSBzcGFjZSBmb2xsb3dpbmcgYW4gZXNjYXBlZCBoZXggdmFsdWUgYW5kIGZvbGxvd2VkIGJ5IGFub3RoZXIgaGV4IGNoYXJhY3RlclxuICAgICAgLy8gKGllOiBcIi5cXGZjIGJlclwiIGZvciBcIi7DvGJlclwiKSBpcyBub3QgYSBzZXBhcmF0b3IgYmV0d2VlbiAyIHNlbGVjdG9yc1xuICAgICAgLy8gYWxzbyBrZWVwIGluIG1pbmQgdGhhdCBiYWNrc2xhc2hlcyBhcmUgcmVwbGFjZWQgYnkgYSBwbGFjZWhvbGRlciBieSBTYWZlU2VsZWN0b3JcbiAgICAgIC8vIFRoZXNlIGVzY2FwZWQgc2VsZWN0b3JzIGhhcHBlbiBmb3IgZXhhbXBsZSB3aGVuIGVzYnVpbGQgcnVucyB3aXRoIG9wdGltaXphdGlvbi5taW5pZnkuXG4gICAgICBpZiAocGFydC5tYXRjaCgvX19lc2MtcGgtKFxcZCspX18vKSAmJiBzZWxlY3RvcltyZXMuaW5kZXggKyAxXT8ubWF0Y2goL1thLWZBLUZcXGRdLykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNjb3BlZFBhcnQgPSBfcHNldWRvRnVuY3Rpb25Bd2FyZVNjb3BlU2VsZWN0b3JQYXJ0KHBhcnQpO1xuICAgICAgc2NvcGVkU2VsZWN0b3IgKz0gYCR7c2NvcGVkUGFydH0gJHtzZXBhcmF0b3J9IGA7XG4gICAgICBzdGFydEluZGV4ID0gc2VwLmxhc3RJbmRleDtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJ0ID0gc2VsZWN0b3Iuc3Vic3RyaW5nKHN0YXJ0SW5kZXgpO1xuICAgIHNjb3BlZFNlbGVjdG9yICs9IF9wc2V1ZG9GdW5jdGlvbkF3YXJlU2NvcGVTZWxlY3RvclBhcnQocGFydCk7XG5cbiAgICAvLyByZXBsYWNlIHRoZSBwbGFjZWhvbGRlcnMgd2l0aCB0aGVpciBvcmlnaW5hbCB2YWx1ZXNcbiAgICAvLyB1c2luZyB2YWx1ZXMgc3RvcmVkIGluc2lkZSB0aGUgYHNhZmVTZWxlY3RvcmAgaW5zdGFuY2UuXG4gICAgcmV0dXJuIHRoaXMuX3NhZmVTZWxlY3RvciEucmVzdG9yZShzY29wZWRTZWxlY3Rvcik7XG4gIH1cblxuICBwcml2YXRlIF9pbnNlcnRQb2x5ZmlsbEhvc3RJbkNzc1RleHQoc2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHNlbGVjdG9yXG4gICAgICAucmVwbGFjZShfY29sb25Ib3N0Q29udGV4dFJlLCBfcG9seWZpbGxIb3N0Q29udGV4dClcbiAgICAgIC5yZXBsYWNlKF9jb2xvbkhvc3RSZSwgX3BvbHlmaWxsSG9zdCk7XG4gIH1cbn1cblxuY2xhc3MgU2FmZVNlbGVjdG9yIHtcbiAgcHJpdmF0ZSBwbGFjZWhvbGRlcnM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgaW5kZXggPSAwO1xuICBwcml2YXRlIF9jb250ZW50OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2VsZWN0b3I6IHN0cmluZykge1xuICAgIC8vIFJlcGxhY2VzIGF0dHJpYnV0ZSBzZWxlY3RvcnMgd2l0aCBwbGFjZWhvbGRlcnMuXG4gICAgLy8gVGhlIFdTIGluIFthdHRyPVwidmEgbHVlXCJdIHdvdWxkIG90aGVyd2lzZSBiZSBpbnRlcnByZXRlZCBhcyBhIHNlbGVjdG9yIHNlcGFyYXRvci5cbiAgICBzZWxlY3RvciA9IHRoaXMuX2VzY2FwZVJlZ2V4TWF0Y2hlcyhzZWxlY3RvciwgLyhcXFtbXlxcXV0qXFxdKS9nKTtcblxuICAgIC8vIENTUyBhbGxvd3MgZm9yIGNlcnRhaW4gc3BlY2lhbCBjaGFyYWN0ZXJzIHRvIGJlIHVzZWQgaW4gc2VsZWN0b3JzIGlmIHRoZXkncmUgZXNjYXBlZC5cbiAgICAvLyBFLmcuIGAuZm9vOmJsdWVgIHdvbid0IG1hdGNoIGEgY2xhc3MgY2FsbGVkIGBmb286Ymx1ZWAsIGJlY2F1c2UgdGhlIGNvbG9uIGRlbm90ZXMgYVxuICAgIC8vIHBzZXVkby1jbGFzcywgYnV0IHdyaXRpbmcgYC5mb29cXDpibHVlYCB3aWxsIG1hdGNoLCBiZWNhdXNlIHRoZSBjb2xvbiB3YXMgZXNjYXBlZC5cbiAgICAvLyBSZXBsYWNlIGFsbCBlc2NhcGUgc2VxdWVuY2VzIChgXFxgIGZvbGxvd2VkIGJ5IGEgY2hhcmFjdGVyKSB3aXRoIGEgcGxhY2Vob2xkZXIgc29cbiAgICAvLyB0aGF0IG91ciBoYW5kbGluZyBvZiBwc2V1ZG8tc2VsZWN0b3JzIGRvZXNuJ3QgbWVzcyB3aXRoIHRoZW0uXG4gICAgLy8gRXNjYXBlZCBjaGFyYWN0ZXJzIGhhdmUgYSBzcGVjaWZpYyBwbGFjZWhvbGRlciBzbyB0aGV5IGNhbiBiZSBkZXRlY3RlZCBzZXBhcmF0ZWx5LlxuICAgIHNlbGVjdG9yID0gc2VsZWN0b3IucmVwbGFjZSgvKFxcXFwuKS9nLCAoXywga2VlcCkgPT4ge1xuICAgICAgY29uc3QgcmVwbGFjZUJ5ID0gYF9fZXNjLXBoLSR7dGhpcy5pbmRleH1fX2A7XG4gICAgICB0aGlzLnBsYWNlaG9sZGVycy5wdXNoKGtlZXApO1xuICAgICAgdGhpcy5pbmRleCsrO1xuICAgICAgcmV0dXJuIHJlcGxhY2VCeTtcbiAgICB9KTtcblxuICAgIC8vIFJlcGxhY2VzIHRoZSBleHByZXNzaW9uIGluIGA6bnRoLWNoaWxkKDJuICsgMSlgIHdpdGggYSBwbGFjZWhvbGRlci5cbiAgICAvLyBXUyBhbmQgXCIrXCIgd291bGQgb3RoZXJ3aXNlIGJlIGludGVycHJldGVkIGFzIHNlbGVjdG9yIHNlcGFyYXRvcnMuXG4gICAgdGhpcy5fY29udGVudCA9IHNlbGVjdG9yLnJlcGxhY2UoLyg6bnRoLVstXFx3XSspKFxcKFteKV0rXFwpKS9nLCAoXywgcHNldWRvLCBleHApID0+IHtcbiAgICAgIGNvbnN0IHJlcGxhY2VCeSA9IGBfX3BoLSR7dGhpcy5pbmRleH1fX2A7XG4gICAgICB0aGlzLnBsYWNlaG9sZGVycy5wdXNoKGV4cCk7XG4gICAgICB0aGlzLmluZGV4Kys7XG4gICAgICByZXR1cm4gcHNldWRvICsgcmVwbGFjZUJ5O1xuICAgIH0pO1xuICB9XG5cbiAgcmVzdG9yZShjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjb250ZW50LnJlcGxhY2UoL19fKD86cGh8ZXNjLXBoKS0oXFxkKylfXy9nLCAoX3BoLCBpbmRleCkgPT4gdGhpcy5wbGFjZWhvbGRlcnNbK2luZGV4XSk7XG4gIH1cblxuICBjb250ZW50KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbnRlbnQ7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgYWxsIG9mIHRoZSBzdWJzdHJpbmdzIHRoYXQgbWF0Y2ggYSByZWdleCB3aXRoaW4gYVxuICAgKiBzcGVjaWFsIHN0cmluZyAoZS5nLiBgX19waC0wX19gLCBgX19waC0xX19gLCBldGMpLlxuICAgKi9cbiAgcHJpdmF0ZSBfZXNjYXBlUmVnZXhNYXRjaGVzKGNvbnRlbnQ6IHN0cmluZywgcGF0dGVybjogUmVnRXhwKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY29udGVudC5yZXBsYWNlKHBhdHRlcm4sIChfLCBrZWVwKSA9PiB7XG4gICAgICBjb25zdCByZXBsYWNlQnkgPSBgX19waC0ke3RoaXMuaW5kZXh9X19gO1xuICAgICAgdGhpcy5wbGFjZWhvbGRlcnMucHVzaChrZWVwKTtcbiAgICAgIHRoaXMuaW5kZXgrKztcbiAgICAgIHJldHVybiByZXBsYWNlQnk7XG4gICAgfSk7XG4gIH1cbn1cblxuY29uc3QgX2Nzc1Njb3BlZFBzZXVkb0Z1bmN0aW9uUHJlZml4ID0gJyg6KHdoZXJlfGlzKVxcXFwoKT8nO1xuY29uc3QgX2Nzc1ByZWZpeFdpdGhQc2V1ZG9TZWxlY3RvckZ1bmN0aW9uID0gL146KHdoZXJlfGlzKVxcKC9pO1xuY29uc3QgX2Nzc0NvbnRlbnROZXh0U2VsZWN0b3JSZSA9XG4gIC9wb2x5ZmlsbC1uZXh0LXNlbGVjdG9yW159XSpjb250ZW50OltcXHNdKj8oWydcIl0pKC4qPylcXDFbO1xcc10qfShbXntdKj8pey9naW07XG5jb25zdCBfY3NzQ29udGVudFJ1bGVSZSA9IC8ocG9seWZpbGwtcnVsZSlbXn1dKihjb250ZW50OltcXHNdKihbJ1wiXSkoLio/KVxcMylbO1xcc10qW159XSp9L2dpbTtcbmNvbnN0IF9jc3NDb250ZW50VW5zY29wZWRSdWxlUmUgPVxuICAvKHBvbHlmaWxsLXVuc2NvcGVkLXJ1bGUpW159XSooY29udGVudDpbXFxzXSooWydcIl0pKC4qPylcXDMpWztcXHNdKltefV0qfS9naW07XG5jb25zdCBfcG9seWZpbGxIb3N0ID0gJy1zaGFkb3djc3Nob3N0Jztcbi8vIG5vdGU6IDpob3N0LWNvbnRleHQgcHJlLXByb2Nlc3NlZCB0byAtc2hhZG93Y3NzaG9zdGNvbnRleHQuXG5jb25zdCBfcG9seWZpbGxIb3N0Q29udGV4dCA9ICctc2hhZG93Y3NzY29udGV4dCc7XG5jb25zdCBfcGFyZW5TdWZmaXggPSAnKD86XFxcXCgoJyArICcoPzpcXFxcKFteKShdKlxcXFwpfFteKShdKikrPycgKyAnKVxcXFwpKT8oW14se10qKSc7XG5jb25zdCBfY3NzQ29sb25Ib3N0UmUgPSBuZXcgUmVnRXhwKF9wb2x5ZmlsbEhvc3QgKyBfcGFyZW5TdWZmaXgsICdnaW0nKTtcbmNvbnN0IF9jc3NDb2xvbkhvc3RDb250ZXh0UmVHbG9iYWwgPSBuZXcgUmVnRXhwKFxuICBfY3NzU2NvcGVkUHNldWRvRnVuY3Rpb25QcmVmaXggKyAnKCcgKyBfcG9seWZpbGxIb3N0Q29udGV4dCArIF9wYXJlblN1ZmZpeCArICcpJyxcbiAgJ2dpbScsXG4pO1xuY29uc3QgX2Nzc0NvbG9uSG9zdENvbnRleHRSZSA9IG5ldyBSZWdFeHAoX3BvbHlmaWxsSG9zdENvbnRleHQgKyBfcGFyZW5TdWZmaXgsICdpbScpO1xuY29uc3QgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvciA9IF9wb2x5ZmlsbEhvc3QgKyAnLW5vLWNvbWJpbmF0b3InO1xuY29uc3QgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvcldpdGhpblBzZXVkb0Z1bmN0aW9uID0gbmV3IFJlZ0V4cChcbiAgYDouKlxcXFwoLioke19wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3J9LipcXFxcKWAsXG4pO1xuY29uc3QgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvclJlID0gLy1zaGFkb3djc3Nob3N0LW5vLWNvbWJpbmF0b3IoW15cXHNdKikvO1xuY29uc3QgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvclJlR2xvYmFsID0gbmV3IFJlZ0V4cChfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yUmUsICdnJyk7XG5jb25zdCBfc2hhZG93RE9NU2VsZWN0b3JzUmUgPSBbXG4gIC86OnNoYWRvdy9nLFxuICAvOjpjb250ZW50L2csXG4gIC8vIERlcHJlY2F0ZWQgc2VsZWN0b3JzXG4gIC9cXC9zaGFkb3ctZGVlcFxcLy9nLFxuICAvXFwvc2hhZG93XFwvL2csXG5dO1xuXG4vLyBUaGUgZGVlcCBjb21iaW5hdG9yIGlzIGRlcHJlY2F0ZWQgaW4gdGhlIENTUyBzcGVjXG4vLyBTdXBwb3J0IGZvciBgPj4+YCwgYGRlZXBgLCBgOjpuZy1kZWVwYCBpcyB0aGVuIGFsc28gZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIHRoZSBmdXR1cmUuXG4vLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9wdWxsLzE3Njc3XG5jb25zdCBfc2hhZG93RGVlcFNlbGVjdG9ycyA9IC8oPzo+Pj4pfCg/OlxcL2RlZXBcXC8pfCg/Ojo6bmctZGVlcCkvZztcbmNvbnN0IF9zZWxlY3RvclJlU3VmZml4ID0gJyhbPlxcXFxzfitbLix7Ol1bXFxcXHNcXFxcU10qKT8kJztcbmNvbnN0IF9wb2x5ZmlsbEhvc3RSZSA9IC8tc2hhZG93Y3NzaG9zdC9naW07XG5jb25zdCBfY29sb25Ib3N0UmUgPSAvOmhvc3QvZ2ltO1xuY29uc3QgX2NvbG9uSG9zdENvbnRleHRSZSA9IC86aG9zdC1jb250ZXh0L2dpbTtcblxuY29uc3QgX25ld0xpbmVzUmUgPSAvXFxyP1xcbi9nO1xuY29uc3QgX2NvbW1lbnRSZSA9IC9cXC9cXCpbXFxzXFxTXSo/XFwqXFwvL2c7XG5jb25zdCBfY29tbWVudFdpdGhIYXNoUmUgPSAvXFwvXFwqXFxzKiNcXHMqc291cmNlKE1hcHBpbmcpP1VSTD0vZztcbmNvbnN0IENPTU1FTlRfUExBQ0VIT0xERVIgPSAnJUNPTU1FTlQlJztcbmNvbnN0IF9jb21tZW50V2l0aEhhc2hQbGFjZUhvbGRlclJlID0gbmV3IFJlZ0V4cChDT01NRU5UX1BMQUNFSE9MREVSLCAnZycpO1xuXG5jb25zdCBCTE9DS19QTEFDRUhPTERFUiA9ICclQkxPQ0slJztcbmNvbnN0IF9ydWxlUmUgPSBuZXcgUmVnRXhwKFxuICBgKFxcXFxzKig/OiR7Q09NTUVOVF9QTEFDRUhPTERFUn1cXFxccyopKikoW147XFxcXHtcXFxcfV0rPykoXFxcXHMqKSgoPzp7JUJMT0NLJX0/XFxcXHMqOz8pfCg/OlxcXFxzKjspKWAsXG4gICdnJyxcbik7XG5jb25zdCBDT05URU5UX1BBSVJTID0gbmV3IE1hcChbWyd7JywgJ30nXV0pO1xuXG5jb25zdCBDT01NQV9JTl9QTEFDRUhPTERFUiA9ICclQ09NTUFfSU5fUExBQ0VIT0xERVIlJztcbmNvbnN0IFNFTUlfSU5fUExBQ0VIT0xERVIgPSAnJVNFTUlfSU5fUExBQ0VIT0xERVIlJztcbmNvbnN0IENPTE9OX0lOX1BMQUNFSE9MREVSID0gJyVDT0xPTl9JTl9QTEFDRUhPTERFUiUnO1xuXG5jb25zdCBfY3NzQ29tbWFJblBsYWNlaG9sZGVyUmVHbG9iYWwgPSBuZXcgUmVnRXhwKENPTU1BX0lOX1BMQUNFSE9MREVSLCAnZycpO1xuY29uc3QgX2Nzc1NlbWlJblBsYWNlaG9sZGVyUmVHbG9iYWwgPSBuZXcgUmVnRXhwKFNFTUlfSU5fUExBQ0VIT0xERVIsICdnJyk7XG5jb25zdCBfY3NzQ29sb25JblBsYWNlaG9sZGVyUmVHbG9iYWwgPSBuZXcgUmVnRXhwKENPTE9OX0lOX1BMQUNFSE9MREVSLCAnZycpO1xuXG5leHBvcnQgY2xhc3MgQ3NzUnVsZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBzZWxlY3Rvcjogc3RyaW5nLFxuICAgIHB1YmxpYyBjb250ZW50OiBzdHJpbmcsXG4gICkge31cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb2Nlc3NSdWxlcyhpbnB1dDogc3RyaW5nLCBydWxlQ2FsbGJhY2s6IChydWxlOiBDc3NSdWxlKSA9PiBDc3NSdWxlKTogc3RyaW5nIHtcbiAgY29uc3QgZXNjYXBlZCA9IGVzY2FwZUluU3RyaW5ncyhpbnB1dCk7XG4gIGNvbnN0IGlucHV0V2l0aEVzY2FwZWRCbG9ja3MgPSBlc2NhcGVCbG9ja3MoZXNjYXBlZCwgQ09OVEVOVF9QQUlSUywgQkxPQ0tfUExBQ0VIT0xERVIpO1xuICBsZXQgbmV4dEJsb2NrSW5kZXggPSAwO1xuICBjb25zdCBlc2NhcGVkUmVzdWx0ID0gaW5wdXRXaXRoRXNjYXBlZEJsb2Nrcy5lc2NhcGVkU3RyaW5nLnJlcGxhY2UoX3J1bGVSZSwgKC4uLm06IHN0cmluZ1tdKSA9PiB7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSBtWzJdO1xuICAgIGxldCBjb250ZW50ID0gJyc7XG4gICAgbGV0IHN1ZmZpeCA9IG1bNF07XG4gICAgbGV0IGNvbnRlbnRQcmVmaXggPSAnJztcbiAgICBpZiAoc3VmZml4ICYmIHN1ZmZpeC5zdGFydHNXaXRoKCd7JyArIEJMT0NLX1BMQUNFSE9MREVSKSkge1xuICAgICAgY29udGVudCA9IGlucHV0V2l0aEVzY2FwZWRCbG9ja3MuYmxvY2tzW25leHRCbG9ja0luZGV4KytdO1xuICAgICAgc3VmZml4ID0gc3VmZml4LnN1YnN0cmluZyhCTE9DS19QTEFDRUhPTERFUi5sZW5ndGggKyAxKTtcbiAgICAgIGNvbnRlbnRQcmVmaXggPSAneyc7XG4gICAgfVxuICAgIGNvbnN0IHJ1bGUgPSBydWxlQ2FsbGJhY2sobmV3IENzc1J1bGUoc2VsZWN0b3IsIGNvbnRlbnQpKTtcbiAgICByZXR1cm4gYCR7bVsxXX0ke3J1bGUuc2VsZWN0b3J9JHttWzNdfSR7Y29udGVudFByZWZpeH0ke3J1bGUuY29udGVudH0ke3N1ZmZpeH1gO1xuICB9KTtcbiAgcmV0dXJuIHVuZXNjYXBlSW5TdHJpbmdzKGVzY2FwZWRSZXN1bHQpO1xufVxuXG5jbGFzcyBTdHJpbmdXaXRoRXNjYXBlZEJsb2NrcyB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBlc2NhcGVkU3RyaW5nOiBzdHJpbmcsXG4gICAgcHVibGljIGJsb2Nrczogc3RyaW5nW10sXG4gICkge31cbn1cblxuZnVuY3Rpb24gZXNjYXBlQmxvY2tzKFxuICBpbnB1dDogc3RyaW5nLFxuICBjaGFyUGFpcnM6IE1hcDxzdHJpbmcsIHN0cmluZz4sXG4gIHBsYWNlaG9sZGVyOiBzdHJpbmcsXG4pOiBTdHJpbmdXaXRoRXNjYXBlZEJsb2NrcyB7XG4gIGNvbnN0IHJlc3VsdFBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBlc2NhcGVkQmxvY2tzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgb3BlbkNoYXJDb3VudCA9IDA7XG4gIGxldCBub25CbG9ja1N0YXJ0SW5kZXggPSAwO1xuICBsZXQgYmxvY2tTdGFydEluZGV4ID0gLTE7XG4gIGxldCBvcGVuQ2hhcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBsZXQgY2xvc2VDaGFyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoYXIgPSBpbnB1dFtpXTtcbiAgICBpZiAoY2hhciA9PT0gJ1xcXFwnKSB7XG4gICAgICBpKys7XG4gICAgfSBlbHNlIGlmIChjaGFyID09PSBjbG9zZUNoYXIpIHtcbiAgICAgIG9wZW5DaGFyQ291bnQtLTtcbiAgICAgIGlmIChvcGVuQ2hhckNvdW50ID09PSAwKSB7XG4gICAgICAgIGVzY2FwZWRCbG9ja3MucHVzaChpbnB1dC5zdWJzdHJpbmcoYmxvY2tTdGFydEluZGV4LCBpKSk7XG4gICAgICAgIHJlc3VsdFBhcnRzLnB1c2gocGxhY2Vob2xkZXIpO1xuICAgICAgICBub25CbG9ja1N0YXJ0SW5kZXggPSBpO1xuICAgICAgICBibG9ja1N0YXJ0SW5kZXggPSAtMTtcbiAgICAgICAgb3BlbkNoYXIgPSBjbG9zZUNoYXIgPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjaGFyID09PSBvcGVuQ2hhcikge1xuICAgICAgb3BlbkNoYXJDb3VudCsrO1xuICAgIH0gZWxzZSBpZiAob3BlbkNoYXJDb3VudCA9PT0gMCAmJiBjaGFyUGFpcnMuaGFzKGNoYXIpKSB7XG4gICAgICBvcGVuQ2hhciA9IGNoYXI7XG4gICAgICBjbG9zZUNoYXIgPSBjaGFyUGFpcnMuZ2V0KGNoYXIpO1xuICAgICAgb3BlbkNoYXJDb3VudCA9IDE7XG4gICAgICBibG9ja1N0YXJ0SW5kZXggPSBpICsgMTtcbiAgICAgIHJlc3VsdFBhcnRzLnB1c2goaW5wdXQuc3Vic3RyaW5nKG5vbkJsb2NrU3RhcnRJbmRleCwgYmxvY2tTdGFydEluZGV4KSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGJsb2NrU3RhcnRJbmRleCAhPT0gLTEpIHtcbiAgICBlc2NhcGVkQmxvY2tzLnB1c2goaW5wdXQuc3Vic3RyaW5nKGJsb2NrU3RhcnRJbmRleCkpO1xuICAgIHJlc3VsdFBhcnRzLnB1c2gocGxhY2Vob2xkZXIpO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdFBhcnRzLnB1c2goaW5wdXQuc3Vic3RyaW5nKG5vbkJsb2NrU3RhcnRJbmRleCkpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBTdHJpbmdXaXRoRXNjYXBlZEJsb2NrcyhyZXN1bHRQYXJ0cy5qb2luKCcnKSwgZXNjYXBlZEJsb2Nrcyk7XG59XG5cbi8qKlxuICogT2JqZWN0IGNvbnRhaW5pbmcgYXMga2V5cyBjaGFyYWN0ZXJzIHRoYXQgc2hvdWxkIGJlIHN1YnN0aXR1dGVkIGJ5IHBsYWNlaG9sZGVyc1xuICogd2hlbiBmb3VuZCBpbiBzdHJpbmdzIGR1cmluZyB0aGUgY3NzIHRleHQgcGFyc2luZywgYW5kIGFzIHZhbHVlcyB0aGUgcmVzcGVjdGl2ZVxuICogcGxhY2Vob2xkZXJzXG4gKi9cbmNvbnN0IEVTQ0FQRV9JTl9TVFJJTkdfTUFQOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHtcbiAgJzsnOiBTRU1JX0lOX1BMQUNFSE9MREVSLFxuICAnLCc6IENPTU1BX0lOX1BMQUNFSE9MREVSLFxuICAnOic6IENPTE9OX0lOX1BMQUNFSE9MREVSLFxufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgcHJvdmlkZWQgY3NzIHRleHQgYW5kIGluc2lkZSBzdHJpbmdzIChtZWFuaW5nLCBpbnNpZGUgcGFpcnMgb2YgdW5lc2NhcGVkIHNpbmdsZSBvclxuICogZG91YmxlIHF1b3RlcykgcmVwbGFjZSBzcGVjaWZpYyBjaGFyYWN0ZXJzIHdpdGggdGhlaXIgcmVzcGVjdGl2ZSBwbGFjZWhvbGRlcnMgYXMgaW5kaWNhdGVkXG4gKiBieSB0aGUgYEVTQ0FQRV9JTl9TVFJJTkdfTUFQYCBtYXAuXG4gKlxuICogRm9yIGV4YW1wbGUgY29udmVydCB0aGUgdGV4dFxuICogIGBhbmltYXRpb246IFwibXktYW5pbTphdFxcXCJpb25cIiAxcztgXG4gKiB0b1xuICogIGBhbmltYXRpb246IFwibXktYW5pbSVDT0xPTl9JTl9QTEFDRUhPTERFUiVhdFxcXCJpb25cIiAxcztgXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gcmVtb3ZlIHRoZSBtZWFuaW5nIG9mIHNvbWUgY2hhcmFjdGVycyB3aGVuIGZvdW5kIGluc2lkZSBzdHJpbmdzXG4gKiAoZm9yIGV4YW1wbGUgYDtgIGluZGljYXRlcyB0aGUgZW5kIG9mIGEgY3NzIGRlY2xhcmF0aW9uLCBgLGAgdGhlIHNlcXVlbmNlIG9mIHZhbHVlcyBhbmQgYDpgIHRoZVxuICogZGl2aXNpb24gYmV0d2VlbiBwcm9wZXJ0eSBhbmQgdmFsdWUgZHVyaW5nIGEgZGVjbGFyYXRpb24sIG5vbmUgb2YgdGhlc2UgbWVhbmluZ3MgYXBwbHkgd2hlbiBzdWNoXG4gKiBjaGFyYWN0ZXJzIGFyZSB3aXRoaW4gc3RyaW5ncyBhbmQgc28gaW4gb3JkZXIgdG8gcHJldmVudCBwYXJzaW5nIGlzc3VlcyB0aGV5IG5lZWQgdG8gYmUgcmVwbGFjZWRcbiAqIHdpdGggcGxhY2Vob2xkZXIgdGV4dCBmb3IgdGhlIGR1cmF0aW9uIG9mIHRoZSBjc3MgbWFuaXB1bGF0aW9uIHByb2Nlc3MpLlxuICpcbiAqIEBwYXJhbSBpbnB1dCB0aGUgb3JpZ2luYWwgY3NzIHRleHQuXG4gKlxuICogQHJldHVybnMgdGhlIGNzcyB0ZXh0IHdpdGggc3BlY2lmaWMgY2hhcmFjdGVycyBpbiBzdHJpbmdzIHJlcGxhY2VkIGJ5IHBsYWNlaG9sZGVycy5cbiAqKi9cbmZ1bmN0aW9uIGVzY2FwZUluU3RyaW5ncyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHJlc3VsdCA9IGlucHV0O1xuICBsZXQgY3VycmVudFF1b3RlQ2hhcjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdWx0Lmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhciA9IHJlc3VsdFtpXTtcbiAgICBpZiAoY2hhciA9PT0gJ1xcXFwnKSB7XG4gICAgICBpKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjdXJyZW50UXVvdGVDaGFyICE9PSBudWxsKSB7XG4gICAgICAgIC8vIGluZGV4IGkgaXMgaW5zaWRlIGEgcXVvdGVkIHN1Yi1zdHJpbmdcbiAgICAgICAgaWYgKGNoYXIgPT09IGN1cnJlbnRRdW90ZUNoYXIpIHtcbiAgICAgICAgICBjdXJyZW50UXVvdGVDaGFyID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcjogc3RyaW5nIHwgdW5kZWZpbmVkID0gRVNDQVBFX0lOX1NUUklOR19NQVBbY2hhcl07XG4gICAgICAgICAgaWYgKHBsYWNlaG9sZGVyKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBgJHtyZXN1bHQuc3Vic3RyKDAsIGkpfSR7cGxhY2Vob2xkZXJ9JHtyZXN1bHQuc3Vic3RyKGkgKyAxKX1gO1xuICAgICAgICAgICAgaSArPSBwbGFjZWhvbGRlci5sZW5ndGggLSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIidcIiB8fCBjaGFyID09PSAnXCInKSB7XG4gICAgICAgIGN1cnJlbnRRdW90ZUNoYXIgPSBjaGFyO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFJlcGxhY2UgaW4gYSBzdHJpbmcgYWxsIG9jY3VycmVuY2VzIG9mIGtleXMgaW4gdGhlIGBFU0NBUEVfSU5fU1RSSU5HX01BUGAgbWFwIHdpdGggdGhlaXJcbiAqIG9yaWdpbmFsIHJlcHJlc2VudGF0aW9uLCB0aGlzIGlzIHNpbXBseSB1c2VkIHRvIHJldmVydCB0aGUgY2hhbmdlcyBhcHBsaWVkIGJ5IHRoZVxuICogZXNjYXBlSW5TdHJpbmdzIGZ1bmN0aW9uLlxuICpcbiAqIEZvciBleGFtcGxlIGl0IHJldmVydHMgdGhlIHRleHQ6XG4gKiAgYGFuaW1hdGlvbjogXCJteS1hbmltJUNPTE9OX0lOX1BMQUNFSE9MREVSJWF0XFxcImlvblwiIDFzO2BcbiAqIHRvIGl0J3Mgb3JpZ2luYWwgZm9ybSBvZjpcbiAqICBgYW5pbWF0aW9uOiBcIm15LWFuaW06YXRcXFwiaW9uXCIgMXM7YFxuICpcbiAqIE5vdGU6IEZvciB0aGUgc2FrZSBvZiBzaW1wbGljaXR5IHRoaXMgZnVuY3Rpb24gZG9lcyBub3QgY2hlY2sgdGhhdCB0aGUgcGxhY2Vob2xkZXJzIGFyZVxuICogYWN0dWFsbHkgaW5zaWRlIHN0cmluZ3MgYXMgaXQgd291bGQgYW55d2F5IGJlIGV4dHJlbWVseSB1bmxpa2VseSB0byBmaW5kIHRoZW0gb3V0c2lkZSBvZiBzdHJpbmdzLlxuICpcbiAqIEBwYXJhbSBpbnB1dCB0aGUgY3NzIHRleHQgY29udGFpbmluZyB0aGUgcGxhY2Vob2xkZXJzLlxuICpcbiAqIEByZXR1cm5zIHRoZSBjc3MgdGV4dCB3aXRob3V0IHRoZSBwbGFjZWhvbGRlcnMuXG4gKi9cbmZ1bmN0aW9uIHVuZXNjYXBlSW5TdHJpbmdzKGlucHV0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgcmVzdWx0ID0gaW5wdXQucmVwbGFjZShfY3NzQ29tbWFJblBsYWNlaG9sZGVyUmVHbG9iYWwsICcsJyk7XG4gIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKF9jc3NTZW1pSW5QbGFjZWhvbGRlclJlR2xvYmFsLCAnOycpO1xuICByZXN1bHQgPSByZXN1bHQucmVwbGFjZShfY3NzQ29sb25JblBsYWNlaG9sZGVyUmVHbG9iYWwsICc6Jyk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogVW5lc2NhcGUgYWxsIHF1b3RlcyBwcmVzZW50IGluIGEgc3RyaW5nLCBidXQgb25seSBpZiB0aGUgc3RyaW5nIHdhcyBhY3R1YWxseSBhbHJlYWR5XG4gKiBxdW90ZWQuXG4gKlxuICogVGhpcyBnZW5lcmF0ZXMgYSBcImNhbm9uaWNhbFwiIHJlcHJlc2VudGF0aW9uIG9mIHN0cmluZ3Mgd2hpY2ggY2FuIGJlIHVzZWQgdG8gbWF0Y2ggc3RyaW5nc1xuICogd2hpY2ggd291bGQgb3RoZXJ3aXNlIG9ubHkgZGlmZmVyIGJlY2F1c2Ugb2YgZGlmZmVyZW50bHkgZXNjYXBlZCBxdW90ZXMuXG4gKlxuICogRm9yIGV4YW1wbGUgaXQgY29udmVydHMgdGhlIHN0cmluZyAoYXNzdW1lZCB0byBiZSBxdW90ZWQpOlxuICogIGB0aGlzIFxcXFxcImlzXFxcXFwiIGEgXFxcXCdcXFxcXFxcXCd0ZXN0YFxuICogdG86XG4gKiAgYHRoaXMgXCJpc1wiIGEgJ1xcXFxcXFxcJ3Rlc3RgXG4gKiAobm90ZSB0aGF0IHRoZSBsYXR0ZXIgYmFja3NsYXNoZXMgYXJlIG5vdCByZW1vdmVkIGFzIHRoZXkgYXJlIG5vdCBhY3R1YWxseSBlc2NhcGluZyB0aGUgc2luZ2xlXG4gKiBxdW90ZSlcbiAqXG4gKlxuICogQHBhcmFtIGlucHV0IHRoZSBzdHJpbmcgcG9zc2libHkgY29udGFpbmluZyBlc2NhcGVkIHF1b3Rlcy5cbiAqIEBwYXJhbSBpc1F1b3RlZCBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0aGUgc3RyaW5nIHdhcyBxdW90ZWQgaW5zaWRlIGEgYmlnZ2VyIHN0cmluZyAoaWYgbm90XG4gKiB0aGVuIGl0IG1lYW5zIHRoYXQgaXQgZG9lc24ndCByZXByZXNlbnQgYW4gaW5uZXIgc3RyaW5nIGFuZCB0aHVzIG5vIHVuZXNjYXBpbmcgaXMgcmVxdWlyZWQpXG4gKlxuICogQHJldHVybnMgdGhlIHN0cmluZyBpbiB0aGUgXCJjYW5vbmljYWxcIiByZXByZXNlbnRhdGlvbiB3aXRob3V0IGVzY2FwZWQgcXVvdGVzLlxuICovXG5mdW5jdGlvbiB1bmVzY2FwZVF1b3RlcyhzdHI6IHN0cmluZywgaXNRdW90ZWQ6IGJvb2xlYW4pOiBzdHJpbmcge1xuICByZXR1cm4gIWlzUXVvdGVkID8gc3RyIDogc3RyLnJlcGxhY2UoLygoPzpefFteXFxcXF0pKD86XFxcXFxcXFwpKilcXFxcKD89WydcIl0pL2csICckMScpO1xufVxuXG4vKipcbiAqIENvbWJpbmUgdGhlIGBjb250ZXh0U2VsZWN0b3JzYCB3aXRoIHRoZSBgaG9zdE1hcmtlcmAgYW5kIHRoZSBgb3RoZXJTZWxlY3RvcnNgXG4gKiB0byBjcmVhdGUgYSBzZWxlY3RvciB0aGF0IG1hdGNoZXMgdGhlIHNhbWUgYXMgYDpob3N0LWNvbnRleHQoKWAuXG4gKlxuICogR2l2ZW4gYSBzaW5nbGUgY29udGV4dCBzZWxlY3RvciBgQWAgd2UgbmVlZCB0byBvdXRwdXQgc2VsZWN0b3JzIHRoYXQgbWF0Y2ggb24gdGhlIGhvc3QgYW5kIGFzIGFuXG4gKiBhbmNlc3RvciBvZiB0aGUgaG9zdDpcbiAqXG4gKiBgYGBcbiAqIEEgPGhvc3RNYXJrZXI+LCBBPGhvc3RNYXJrZXI+IHt9XG4gKiBgYGBcbiAqXG4gKiBXaGVuIHRoZXJlIGlzIG1vcmUgdGhhbiBvbmUgY29udGV4dCBzZWxlY3RvciB3ZSBhbHNvIGhhdmUgdG8gY3JlYXRlIGNvbWJpbmF0aW9ucyBvZiB0aG9zZVxuICogc2VsZWN0b3JzIHdpdGggZWFjaCBvdGhlci4gRm9yIGV4YW1wbGUgaWYgdGhlcmUgYXJlIGBBYCBhbmQgYEJgIHNlbGVjdG9ycyB0aGUgb3V0cHV0IGlzOlxuICpcbiAqIGBgYFxuICogQUI8aG9zdE1hcmtlcj4sIEFCIDxob3N0TWFya2VyPiwgQSBCPGhvc3RNYXJrZXI+LFxuICogQiBBPGhvc3RNYXJrZXI+LCBBIEIgPGhvc3RNYXJrZXI+LCBCIEEgPGhvc3RNYXJrZXI+IHt9XG4gKiBgYGBcbiAqXG4gKiBBbmQgc28gb24uLi5cbiAqXG4gKiBAcGFyYW0gY29udGV4dFNlbGVjdG9ycyBhbiBhcnJheSBvZiBjb250ZXh0IHNlbGVjdG9ycyB0aGF0IHdpbGwgYmUgY29tYmluZWQuXG4gKiBAcGFyYW0gb3RoZXJTZWxlY3RvcnMgdGhlIHJlc3Qgb2YgdGhlIHNlbGVjdG9ycyB0aGF0IGFyZSBub3QgY29udGV4dCBzZWxlY3RvcnMuXG4gKi9cbmZ1bmN0aW9uIF9jb21iaW5lSG9zdENvbnRleHRTZWxlY3RvcnMoXG4gIGNvbnRleHRTZWxlY3RvcnM6IHN0cmluZ1tdLFxuICBvdGhlclNlbGVjdG9yczogc3RyaW5nLFxuICBwc2V1ZG9QcmVmaXggPSAnJyxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGhvc3RNYXJrZXIgPSBfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yO1xuICBfcG9seWZpbGxIb3N0UmUubGFzdEluZGV4ID0gMDsgLy8gcmVzZXQgdGhlIHJlZ2V4IHRvIGVuc3VyZSB3ZSBnZXQgYW4gYWNjdXJhdGUgdGVzdFxuICBjb25zdCBvdGhlclNlbGVjdG9yc0hhc0hvc3QgPSBfcG9seWZpbGxIb3N0UmUudGVzdChvdGhlclNlbGVjdG9ycyk7XG5cbiAgLy8gSWYgdGhlcmUgYXJlIG5vIGNvbnRleHQgc2VsZWN0b3JzIHRoZW4ganVzdCBvdXRwdXQgYSBob3N0IG1hcmtlclxuICBpZiAoY29udGV4dFNlbGVjdG9ycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gaG9zdE1hcmtlciArIG90aGVyU2VsZWN0b3JzO1xuICB9XG5cbiAgY29uc3QgY29tYmluZWQ6IHN0cmluZ1tdID0gW2NvbnRleHRTZWxlY3RvcnMucG9wKCkgfHwgJyddO1xuICB3aGlsZSAoY29udGV4dFNlbGVjdG9ycy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbGVuZ3RoID0gY29tYmluZWQubGVuZ3RoO1xuICAgIGNvbnN0IGNvbnRleHRTZWxlY3RvciA9IGNvbnRleHRTZWxlY3RvcnMucG9wKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcHJldmlvdXNTZWxlY3RvcnMgPSBjb21iaW5lZFtpXTtcbiAgICAgIC8vIEFkZCB0aGUgbmV3IHNlbGVjdG9yIGFzIGEgZGVzY2VuZGFudCBvZiB0aGUgcHJldmlvdXMgc2VsZWN0b3JzXG4gICAgICBjb21iaW5lZFtsZW5ndGggKiAyICsgaV0gPSBwcmV2aW91c1NlbGVjdG9ycyArICcgJyArIGNvbnRleHRTZWxlY3RvcjtcbiAgICAgIC8vIEFkZCB0aGUgbmV3IHNlbGVjdG9yIGFzIGFuIGFuY2VzdG9yIG9mIHRoZSBwcmV2aW91cyBzZWxlY3RvcnNcbiAgICAgIGNvbWJpbmVkW2xlbmd0aCArIGldID0gY29udGV4dFNlbGVjdG9yICsgJyAnICsgcHJldmlvdXNTZWxlY3RvcnM7XG4gICAgICAvLyBBZGQgdGhlIG5ldyBzZWxlY3RvciB0byBhY3Qgb24gdGhlIHNhbWUgZWxlbWVudCBhcyB0aGUgcHJldmlvdXMgc2VsZWN0b3JzXG4gICAgICBjb21iaW5lZFtpXSA9IGNvbnRleHRTZWxlY3RvciArIHByZXZpb3VzU2VsZWN0b3JzO1xuICAgIH1cbiAgfVxuICAvLyBGaW5hbGx5IGNvbm5lY3QgdGhlIHNlbGVjdG9yIHRvIHRoZSBgaG9zdE1hcmtlcmBzOiBlaXRoZXIgYWN0aW5nIGRpcmVjdGx5IG9uIHRoZSBob3N0XG4gIC8vIChBPGhvc3RNYXJrZXI+KSBvciBhcyBhbiBhbmNlc3RvciAoQSA8aG9zdE1hcmtlcj4pLlxuICByZXR1cm4gY29tYmluZWRcbiAgICAubWFwKChzKSA9PlxuICAgICAgb3RoZXJTZWxlY3RvcnNIYXNIb3N0XG4gICAgICAgID8gYCR7cHNldWRvUHJlZml4fSR7c30ke290aGVyU2VsZWN0b3JzfWBcbiAgICAgICAgOiBgJHtwc2V1ZG9QcmVmaXh9JHtzfSR7aG9zdE1hcmtlcn0ke290aGVyU2VsZWN0b3JzfSwgJHtwc2V1ZG9QcmVmaXh9JHtzfSAke2hvc3RNYXJrZXJ9JHtvdGhlclNlbGVjdG9yc31gLFxuICAgIClcbiAgICAuam9pbignLCcpO1xufVxuXG4vKipcbiAqIE11dGF0ZSB0aGUgZ2l2ZW4gYGdyb3Vwc2AgYXJyYXkgc28gdGhhdCB0aGVyZSBhcmUgYG11bHRpcGxlc2AgY2xvbmVzIG9mIHRoZSBvcmlnaW5hbCBhcnJheVxuICogc3RvcmVkLlxuICpcbiAqIEZvciBleGFtcGxlIGByZXBlYXRHcm91cHMoW2EsIGJdLCAzKWAgd2lsbCByZXN1bHQgaW4gYFthLCBiLCBhLCBiLCBhLCBiXWAgLSBidXQgaW1wb3J0YW50bHkgdGhlXG4gKiBuZXdseSBhZGRlZCBncm91cHMgd2lsbCBiZSBjbG9uZXMgb2YgdGhlIG9yaWdpbmFsLlxuICpcbiAqIEBwYXJhbSBncm91cHMgQW4gYXJyYXkgb2YgZ3JvdXBzIG9mIHN0cmluZ3MgdGhhdCB3aWxsIGJlIHJlcGVhdGVkLiBUaGlzIGFycmF5IGlzIG11dGF0ZWRcbiAqICAgICBpbi1wbGFjZS5cbiAqIEBwYXJhbSBtdWx0aXBsZXMgVGhlIG51bWJlciBvZiB0aW1lcyB0aGUgY3VycmVudCBncm91cHMgc2hvdWxkIGFwcGVhci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlcGVhdEdyb3Vwcyhncm91cHM6IHN0cmluZ1tdW10sIG11bHRpcGxlczogbnVtYmVyKTogdm9pZCB7XG4gIGNvbnN0IGxlbmd0aCA9IGdyb3Vwcy5sZW5ndGg7XG4gIGZvciAobGV0IGkgPSAxOyBpIDwgbXVsdGlwbGVzOyBpKyspIHtcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbmd0aDsgaisrKSB7XG4gICAgICBncm91cHNbaiArIGkgKiBsZW5ndGhdID0gZ3JvdXBzW2pdLnNsaWNlKDApO1xuICAgIH1cbiAgfVxufVxuIl19