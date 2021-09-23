/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/shadow_css", ["require", "exports", "tslib"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.repeatGroups = exports.processRules = exports.CssRule = exports.ShadowCss = void 0;
    var tslib_1 = require("tslib");
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
    var ShadowCss = /** @class */ (function () {
        function ShadowCss() {
            this.strictStyling = true;
        }
        /*
         * Shim some cssText with the given selector. Returns cssText that can
         * be included in the document via WebComponents.ShadowCSS.addCssToDocument(css).
         *
         * When strictStyling is true:
         * - selector is the attribute added to all elements inside the host,
         * - hostSelector is the attribute added to the host itself.
         */
        ShadowCss.prototype.shimCssText = function (cssText, selector, hostSelector) {
            if (hostSelector === void 0) { hostSelector = ''; }
            var commentsWithHash = extractCommentsWithHash(cssText);
            cssText = stripComments(cssText);
            cssText = this._insertDirectives(cssText);
            var scopedCssText = this._scopeCssText(cssText, selector, hostSelector);
            return (0, tslib_1.__spreadArray)([scopedCssText], (0, tslib_1.__read)(commentsWithHash), false).join('\n');
        };
        ShadowCss.prototype._insertDirectives = function (cssText) {
            cssText = this._insertPolyfillDirectivesInCssText(cssText);
            return this._insertPolyfillRulesInCssText(cssText);
        };
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
        ShadowCss.prototype._insertPolyfillDirectivesInCssText = function (cssText) {
            // Difference with webcomponents.js: does not handle comments
            return cssText.replace(_cssContentNextSelectorRe, function () {
                var m = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    m[_i] = arguments[_i];
                }
                return m[2] + '{';
            });
        };
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
        ShadowCss.prototype._insertPolyfillRulesInCssText = function (cssText) {
            // Difference with webcomponents.js: does not handle comments
            return cssText.replace(_cssContentRuleRe, function () {
                var m = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    m[_i] = arguments[_i];
                }
                var rule = m[0].replace(m[1], '').replace(m[2], '');
                return m[4] + rule;
            });
        };
        /* Ensure styles are scoped. Pseudo-scoping takes a rule like:
         *
         *  .foo {... }
         *
         *  and converts this to
         *
         *  scopeName .foo { ... }
         */
        ShadowCss.prototype._scopeCssText = function (cssText, scopeSelector, hostSelector) {
            var unscopedRules = this._extractUnscopedRulesFromCssText(cssText);
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
        };
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
        ShadowCss.prototype._extractUnscopedRulesFromCssText = function (cssText) {
            // Difference with webcomponents.js: does not handle comments
            var r = '';
            var m;
            _cssContentUnscopedRuleRe.lastIndex = 0;
            while ((m = _cssContentUnscopedRuleRe.exec(cssText)) !== null) {
                var rule = m[0].replace(m[2], '').replace(m[1], m[4]);
                r += rule + '\n\n';
            }
            return r;
        };
        /*
         * convert a rule like :host(.foo) > .bar { }
         *
         * to
         *
         * .foo<scopeName> > .bar
         */
        ShadowCss.prototype._convertColonHost = function (cssText) {
            return cssText.replace(_cssColonHostRe, function (_, hostSelectors, otherSelectors) {
                var e_1, _a;
                if (hostSelectors) {
                    var convertedSelectors = [];
                    var hostSelectorArray = hostSelectors.split(',').map(function (p) { return p.trim(); });
                    try {
                        for (var hostSelectorArray_1 = (0, tslib_1.__values)(hostSelectorArray), hostSelectorArray_1_1 = hostSelectorArray_1.next(); !hostSelectorArray_1_1.done; hostSelectorArray_1_1 = hostSelectorArray_1.next()) {
                            var hostSelector = hostSelectorArray_1_1.value;
                            if (!hostSelector)
                                break;
                            var convertedSelector = _polyfillHostNoCombinator + hostSelector.replace(_polyfillHost, '') + otherSelectors;
                            convertedSelectors.push(convertedSelector);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (hostSelectorArray_1_1 && !hostSelectorArray_1_1.done && (_a = hostSelectorArray_1.return)) _a.call(hostSelectorArray_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    return convertedSelectors.join(',');
                }
                else {
                    return _polyfillHostNoCombinator + otherSelectors;
                }
            });
        };
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
        ShadowCss.prototype._convertColonHostContext = function (cssText) {
            return cssText.replace(_cssColonHostContextReGlobal, function (selectorText) {
                // We have captured a selector that contains a `:host-context` rule.
                var _a;
                // For backward compatibility `:host-context` may contain a comma separated list of selectors.
                // Each context selector group will contain a list of host-context selectors that must match
                // an ancestor of the host.
                // (Normally `contextSelectorGroups` will only contain a single array of context selectors.)
                var contextSelectorGroups = [[]];
                // There may be more than `:host-context` in this selector so `selectorText` could look like:
                // `:host-context(.one):host-context(.two)`.
                // Execute `_cssColonHostContextRe` over and over until we have extracted all the
                // `:host-context` selectors from this selector.
                var match;
                while (match = _cssColonHostContextRe.exec(selectorText)) {
                    // `match` = [':host-context(<selectors>)<rest>', <selectors>, <rest>]
                    // The `<selectors>` could actually be a comma separated list: `:host-context(.one, .two)`.
                    var newContextSelectors = ((_a = match[1]) !== null && _a !== void 0 ? _a : '').trim().split(',').map(function (m) { return m.trim(); }).filter(function (m) { return m !== ''; });
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
                    var contextSelectorGroupsLength = contextSelectorGroups.length;
                    repeatGroups(contextSelectorGroups, newContextSelectors.length);
                    for (var i = 0; i < newContextSelectors.length; i++) {
                        for (var j = 0; j < contextSelectorGroupsLength; j++) {
                            contextSelectorGroups[j + (i * contextSelectorGroupsLength)].push(newContextSelectors[i]);
                        }
                    }
                    // Update the `selectorText` and see repeat to see if there are more `:host-context`s.
                    selectorText = match[2];
                }
                // The context selectors now must be combined with each other to capture all the possible
                // selectors that `:host-context` can match. See `combineHostContextSelectors()` for more
                // info about how this is done.
                return contextSelectorGroups
                    .map(function (contextSelectors) { return combineHostContextSelectors(contextSelectors, selectorText); })
                    .join(', ');
            });
        };
        /*
         * Convert combinators like ::shadow and pseudo-elements like ::content
         * by replacing with space.
         */
        ShadowCss.prototype._convertShadowDOMSelectors = function (cssText) {
            return _shadowDOMSelectorsRe.reduce(function (result, pattern) { return result.replace(pattern, ' '); }, cssText);
        };
        // change a selector like 'div' to 'name div'
        ShadowCss.prototype._scopeSelectors = function (cssText, scopeSelector, hostSelector) {
            var _this = this;
            return processRules(cssText, function (rule) {
                var selector = rule.selector;
                var content = rule.content;
                if (rule.selector[0] !== '@') {
                    selector =
                        _this._scopeSelector(rule.selector, scopeSelector, hostSelector, _this.strictStyling);
                }
                else if (rule.selector.startsWith('@media') || rule.selector.startsWith('@supports') ||
                    rule.selector.startsWith('@document')) {
                    content = _this._scopeSelectors(rule.content, scopeSelector, hostSelector);
                }
                else if (rule.selector.startsWith('@font-face') || rule.selector.startsWith('@page')) {
                    content = _this._stripScopingSelectors(rule.content);
                }
                return new CssRule(selector, content);
            });
        };
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
        ShadowCss.prototype._stripScopingSelectors = function (cssText) {
            return processRules(cssText, function (rule) {
                var selector = rule.selector.replace(_shadowDeepSelectors, ' ')
                    .replace(_polyfillHostNoCombinatorRe, ' ');
                return new CssRule(selector, rule.content);
            });
        };
        ShadowCss.prototype._scopeSelector = function (selector, scopeSelector, hostSelector, strict) {
            var _this = this;
            return selector.split(',')
                .map(function (part) { return part.trim().split(_shadowDeepSelectors); })
                .map(function (deepParts) {
                var _a = (0, tslib_1.__read)(deepParts), shallowPart = _a[0], otherParts = _a.slice(1);
                var applyScope = function (shallowPart) {
                    if (_this._selectorNeedsScoping(shallowPart, scopeSelector)) {
                        return strict ?
                            _this._applyStrictSelectorScope(shallowPart, scopeSelector, hostSelector) :
                            _this._applySelectorScope(shallowPart, scopeSelector, hostSelector);
                    }
                    else {
                        return shallowPart;
                    }
                };
                return (0, tslib_1.__spreadArray)([applyScope(shallowPart)], (0, tslib_1.__read)(otherParts), false).join(' ');
            })
                .join(', ');
        };
        ShadowCss.prototype._selectorNeedsScoping = function (selector, scopeSelector) {
            var re = this._makeScopeMatcher(scopeSelector);
            return !re.test(selector);
        };
        ShadowCss.prototype._makeScopeMatcher = function (scopeSelector) {
            var lre = /\[/g;
            var rre = /\]/g;
            scopeSelector = scopeSelector.replace(lre, '\\[').replace(rre, '\\]');
            return new RegExp('^(' + scopeSelector + ')' + _selectorReSuffix, 'm');
        };
        ShadowCss.prototype._applySelectorScope = function (selector, scopeSelector, hostSelector) {
            // Difference from webcomponents.js: scopeSelector could not be an array
            return this._applySimpleSelectorScope(selector, scopeSelector, hostSelector);
        };
        // scope via name and [is=name]
        ShadowCss.prototype._applySimpleSelectorScope = function (selector, scopeSelector, hostSelector) {
            // In Android browser, the lastIndex is not reset when the regex is used in String.replace()
            _polyfillHostRe.lastIndex = 0;
            if (_polyfillHostRe.test(selector)) {
                var replaceBy_1 = this.strictStyling ? "[" + hostSelector + "]" : scopeSelector;
                return selector
                    .replace(_polyfillHostNoCombinatorRe, function (hnc, selector) {
                    return selector.replace(/([^:]*)(:*)(.*)/, function (_, before, colon, after) {
                        return before + replaceBy_1 + colon + after;
                    });
                })
                    .replace(_polyfillHostRe, replaceBy_1 + ' ');
            }
            return scopeSelector + ' ' + selector;
        };
        // return a selector with [name] suffix on each simple selector
        // e.g. .foo.bar > .zot becomes .foo[name].bar[name] > .zot[name]  /** @internal */
        ShadowCss.prototype._applyStrictSelectorScope = function (selector, scopeSelector, hostSelector) {
            var _this = this;
            var isRe = /\[is=([^\]]*)\]/g;
            scopeSelector = scopeSelector.replace(isRe, function (_) {
                var parts = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    parts[_i - 1] = arguments[_i];
                }
                return parts[0];
            });
            var attrName = '[' + scopeSelector + ']';
            var _scopeSelectorPart = function (p) {
                var scopedP = p.trim();
                if (!scopedP) {
                    return '';
                }
                if (p.indexOf(_polyfillHostNoCombinator) > -1) {
                    scopedP = _this._applySimpleSelectorScope(p, scopeSelector, hostSelector);
                }
                else {
                    // remove :host since it should be unnecessary
                    var t = p.replace(_polyfillHostRe, '');
                    if (t.length > 0) {
                        var matches = t.match(/([^:]*)(:*)(.*)/);
                        if (matches) {
                            scopedP = matches[1] + attrName + matches[2] + matches[3];
                        }
                    }
                }
                return scopedP;
            };
            var safeContent = new SafeSelector(selector);
            selector = safeContent.content();
            var scopedSelector = '';
            var startIndex = 0;
            var res;
            var sep = /( |>|\+|~(?!=))\s*/g;
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
            var hasHost = selector.indexOf(_polyfillHostNoCombinator) > -1;
            // Only scope parts after the first `-shadowcsshost-no-combinator` when it is present
            var shouldScope = !hasHost;
            while ((res = sep.exec(selector)) !== null) {
                var separator = res[1];
                var part_1 = selector.slice(startIndex, res.index).trim();
                shouldScope = shouldScope || part_1.indexOf(_polyfillHostNoCombinator) > -1;
                var scopedPart = shouldScope ? _scopeSelectorPart(part_1) : part_1;
                scopedSelector += scopedPart + " " + separator + " ";
                startIndex = sep.lastIndex;
            }
            var part = selector.substring(startIndex);
            shouldScope = shouldScope || part.indexOf(_polyfillHostNoCombinator) > -1;
            scopedSelector += shouldScope ? _scopeSelectorPart(part) : part;
            // replace the placeholders with their original values
            return safeContent.restore(scopedSelector);
        };
        ShadowCss.prototype._insertPolyfillHostInCssText = function (selector) {
            return selector.replace(_colonHostContextRe, _polyfillHostContext)
                .replace(_colonHostRe, _polyfillHost);
        };
        return ShadowCss;
    }());
    exports.ShadowCss = ShadowCss;
    var SafeSelector = /** @class */ (function () {
        function SafeSelector(selector) {
            var _this = this;
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
            selector = this._escapeRegexMatches(selector, /(\\.)/g);
            // Replaces the expression in `:nth-child(2n + 1)` with a placeholder.
            // WS and "+" would otherwise be interpreted as selector separators.
            this._content = selector.replace(/(:nth-[-\w]+)(\([^)]+\))/g, function (_, pseudo, exp) {
                var replaceBy = "__ph-" + _this.index + "__";
                _this.placeholders.push(exp);
                _this.index++;
                return pseudo + replaceBy;
            });
        }
        SafeSelector.prototype.restore = function (content) {
            var _this = this;
            return content.replace(/__ph-(\d+)__/g, function (_ph, index) { return _this.placeholders[+index]; });
        };
        SafeSelector.prototype.content = function () {
            return this._content;
        };
        /**
         * Replaces all of the substrings that match a regex within a
         * special string (e.g. `__ph-0__`, `__ph-1__`, etc).
         */
        SafeSelector.prototype._escapeRegexMatches = function (content, pattern) {
            var _this = this;
            return content.replace(pattern, function (_, keep) {
                var replaceBy = "__ph-" + _this.index + "__";
                _this.placeholders.push(keep);
                _this.index++;
                return replaceBy;
            });
        };
        return SafeSelector;
    }());
    var _cssContentNextSelectorRe = /polyfill-next-selector[^}]*content:[\s]*?(['"])(.*?)\1[;\s]*}([^{]*?){/gim;
    var _cssContentRuleRe = /(polyfill-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
    var _cssContentUnscopedRuleRe = /(polyfill-unscoped-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
    var _polyfillHost = '-shadowcsshost';
    // note: :host-context pre-processed to -shadowcsshostcontext.
    var _polyfillHostContext = '-shadowcsscontext';
    var _parenSuffix = '(?:\\((' +
        '(?:\\([^)(]*\\)|[^)(]*)+?' +
        ')\\))?([^,{]*)';
    var _cssColonHostRe = new RegExp(_polyfillHost + _parenSuffix, 'gim');
    var _cssColonHostContextReGlobal = new RegExp(_polyfillHostContext + _parenSuffix, 'gim');
    var _cssColonHostContextRe = new RegExp(_polyfillHostContext + _parenSuffix, 'im');
    var _polyfillHostNoCombinator = _polyfillHost + '-no-combinator';
    var _polyfillHostNoCombinatorRe = /-shadowcsshost-no-combinator([^\s]*)/;
    var _shadowDOMSelectorsRe = [
        /::shadow/g,
        /::content/g,
        // Deprecated selectors
        /\/shadow-deep\//g,
        /\/shadow\//g,
    ];
    // The deep combinator is deprecated in the CSS spec
    // Support for `>>>`, `deep`, `::ng-deep` is then also deprecated and will be removed in the future.
    // see https://github.com/angular/angular/pull/17677
    var _shadowDeepSelectors = /(?:>>>)|(?:\/deep\/)|(?:::ng-deep)/g;
    var _selectorReSuffix = '([>\\s~+[.,{:][\\s\\S]*)?$';
    var _polyfillHostRe = /-shadowcsshost/gim;
    var _colonHostRe = /:host/gim;
    var _colonHostContextRe = /:host-context/gim;
    var _commentRe = /\/\*[\s\S]*?\*\//g;
    function stripComments(input) {
        return input.replace(_commentRe, '');
    }
    var _commentWithHashRe = /\/\*\s*#\s*source(Mapping)?URL=[\s\S]+?\*\//g;
    function extractCommentsWithHash(input) {
        return input.match(_commentWithHashRe) || [];
    }
    var BLOCK_PLACEHOLDER = '%BLOCK%';
    var QUOTE_PLACEHOLDER = '%QUOTED%';
    var _ruleRe = /(\s*)([^;\{\}]+?)(\s*)((?:{%BLOCK%}?\s*;?)|(?:\s*;))/g;
    var _quotedRe = /%QUOTED%/g;
    var CONTENT_PAIRS = new Map([['{', '}']]);
    var QUOTE_PAIRS = new Map([["\"", "\""], ["'", "'"]]);
    var CssRule = /** @class */ (function () {
        function CssRule(selector, content) {
            this.selector = selector;
            this.content = content;
        }
        return CssRule;
    }());
    exports.CssRule = CssRule;
    function processRules(input, ruleCallback) {
        var inputWithEscapedQuotes = escapeBlocks(input, QUOTE_PAIRS, QUOTE_PLACEHOLDER);
        var inputWithEscapedBlocks = escapeBlocks(inputWithEscapedQuotes.escapedString, CONTENT_PAIRS, BLOCK_PLACEHOLDER);
        var nextBlockIndex = 0;
        var nextQuoteIndex = 0;
        return inputWithEscapedBlocks.escapedString
            .replace(_ruleRe, function () {
            var m = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                m[_i] = arguments[_i];
            }
            var selector = m[2];
            var content = '';
            var suffix = m[4];
            var contentPrefix = '';
            if (suffix && suffix.startsWith('{' + BLOCK_PLACEHOLDER)) {
                content = inputWithEscapedBlocks.blocks[nextBlockIndex++];
                suffix = suffix.substring(BLOCK_PLACEHOLDER.length + 1);
                contentPrefix = '{';
            }
            var rule = ruleCallback(new CssRule(selector, content));
            return "" + m[1] + rule.selector + m[3] + contentPrefix + rule.content + suffix;
        })
            .replace(_quotedRe, function () { return inputWithEscapedQuotes.blocks[nextQuoteIndex++]; });
    }
    exports.processRules = processRules;
    var StringWithEscapedBlocks = /** @class */ (function () {
        function StringWithEscapedBlocks(escapedString, blocks) {
            this.escapedString = escapedString;
            this.blocks = blocks;
        }
        return StringWithEscapedBlocks;
    }());
    function escapeBlocks(input, charPairs, placeholder) {
        var resultParts = [];
        var escapedBlocks = [];
        var openCharCount = 0;
        var nonBlockStartIndex = 0;
        var blockStartIndex = -1;
        var openChar;
        var closeChar;
        for (var i = 0; i < input.length; i++) {
            var char = input[i];
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
     * @param hostMarker the string that selects the host element.
     * @param contextSelectors an array of context selectors that will be combined.
     * @param otherSelectors the rest of the selectors that are not context selectors.
     */
    function combineHostContextSelectors(contextSelectors, otherSelectors) {
        var hostMarker = _polyfillHostNoCombinator;
        _polyfillHostRe.lastIndex = 0; // reset the regex to ensure we get an accurate test
        var otherSelectorsHasHost = _polyfillHostRe.test(otherSelectors);
        // If there are no context selectors then just output a host marker
        if (contextSelectors.length === 0) {
            return hostMarker + otherSelectors;
        }
        var combined = [contextSelectors.pop() || ''];
        while (contextSelectors.length > 0) {
            var length_1 = combined.length;
            var contextSelector = contextSelectors.pop();
            for (var i = 0; i < length_1; i++) {
                var previousSelectors = combined[i];
                // Add the new selector as a descendant of the previous selectors
                combined[length_1 * 2 + i] = previousSelectors + ' ' + contextSelector;
                // Add the new selector as an ancestor of the previous selectors
                combined[length_1 + i] = contextSelector + ' ' + previousSelectors;
                // Add the new selector to act on the same element as the previous selectors
                combined[i] = contextSelector + previousSelectors;
            }
        }
        // Finally connect the selector to the `hostMarker`s: either acting directly on the host
        // (A<hostMarker>) or as an ancestor (A <hostMarker>).
        return combined
            .map(function (s) { return otherSelectorsHasHost ?
            "" + s + otherSelectors :
            "" + s + hostMarker + otherSelectors + ", " + s + " " + hostMarker + otherSelectors; })
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
    function repeatGroups(groups, multiples) {
        var length = groups.length;
        for (var i = 1; i < multiples; i++) {
            for (var j = 0; j < length; j++) {
                groups[j + (i * length)] = groups[j].slice(0);
            }
        }
    }
    exports.repeatGroups = repeatGroups;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93X2Nzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zaGFkb3dfY3NzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSDs7Ozs7Ozs7O09BU0c7SUFFSDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7TUFpSEU7SUFFRjtRQUFBO1lBQ0Usa0JBQWEsR0FBWSxJQUFJLENBQUM7UUE0WmhDLENBQUM7UUExWkM7Ozs7Ozs7V0FPRztRQUNILCtCQUFXLEdBQVgsVUFBWSxPQUFlLEVBQUUsUUFBZ0IsRUFBRSxZQUF5QjtZQUF6Qiw2QkFBQSxFQUFBLGlCQUF5QjtZQUN0RSxJQUFNLGdCQUFnQixHQUFHLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFELE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakMsT0FBTyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUUxQyxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDMUUsT0FBTyw0QkFBQyxhQUFhLHVCQUFLLGdCQUFnQixVQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6RCxDQUFDO1FBRU8scUNBQWlCLEdBQXpCLFVBQTBCLE9BQWU7WUFDdkMsT0FBTyxHQUFHLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMzRCxPQUFPLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBRUQ7Ozs7Ozs7Ozs7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LENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ2xDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQy9CLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQy9DO1NBQ0Y7SUFDSCxDQUFDO0lBUEQsb0NBT0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBUaGlzIGZpbGUgaXMgYSBwb3J0IG9mIHNoYWRvd0NTUyBmcm9tIHdlYmNvbXBvbmVudHMuanMgdG8gVHlwZVNjcmlwdC5cbiAqXG4gKiBQbGVhc2UgbWFrZSBzdXJlIHRvIGtlZXAgdG8gZWRpdHMgaW4gc3luYyB3aXRoIHRoZSBzb3VyY2UgZmlsZS5cbiAqXG4gKiBTb3VyY2U6XG4gKiBodHRwczovL2dpdGh1Yi5jb20vd2ViY29tcG9uZW50cy93ZWJjb21wb25lbnRzanMvYmxvYi80ZWZlY2Q3ZTBlL3NyYy9TaGFkb3dDU1MvU2hhZG93Q1NTLmpzXG4gKlxuICogVGhlIG9yaWdpbmFsIGZpbGUgbGV2ZWwgY29tbWVudCBpcyByZXByb2R1Y2VkIGJlbG93XG4gKi9cblxuLypcbiAgVGhpcyBpcyBhIGxpbWl0ZWQgc2hpbSBmb3IgU2hhZG93RE9NIGNzcyBzdHlsaW5nLlxuICBodHRwczovL2R2Y3MudzMub3JnL2hnL3dlYmNvbXBvbmVudHMvcmF3LWZpbGUvdGlwL3NwZWMvc2hhZG93L2luZGV4Lmh0bWwjc3R5bGVzXG5cbiAgVGhlIGludGVudGlvbiBoZXJlIGlzIHRvIHN1cHBvcnQgb25seSB0aGUgc3R5bGluZyBmZWF0dXJlcyB3aGljaCBjYW4gYmVcbiAgcmVsYXRpdmVseSBzaW1wbHkgaW1wbGVtZW50ZWQuIFRoZSBnb2FsIGlzIHRvIGFsbG93IHVzZXJzIHRvIGF2b2lkIHRoZVxuICBtb3N0IG9idmlvdXMgcGl0ZmFsbHMgYW5kIGRvIHNvIHdpdGhvdXQgY29tcHJvbWlzaW5nIHBlcmZvcm1hbmNlIHNpZ25pZmljYW50bHkuXG4gIEZvciBTaGFkb3dET00gc3R5bGluZyB0aGF0J3Mgbm90IGNvdmVyZWQgaGVyZSwgYSBzZXQgb2YgYmVzdCBwcmFjdGljZXNcbiAgY2FuIGJlIHByb3ZpZGVkIHRoYXQgc2hvdWxkIGFsbG93IHVzZXJzIHRvIGFjY29tcGxpc2ggbW9yZSBjb21wbGV4IHN0eWxpbmcuXG5cbiAgVGhlIGZvbGxvd2luZyBpcyBhIGxpc3Qgb2Ygc3BlY2lmaWMgU2hhZG93RE9NIHN0eWxpbmcgZmVhdHVyZXMgYW5kIGEgYnJpZWZcbiAgZGlzY3Vzc2lvbiBvZiB0aGUgYXBwcm9hY2ggdXNlZCB0byBzaGltLlxuXG4gIFNoaW1tZWQgZmVhdHVyZXM6XG5cbiAgKiA6aG9zdCwgOmhvc3QtY29udGV4dDogU2hhZG93RE9NIGFsbG93cyBzdHlsaW5nIG9mIHRoZSBzaGFkb3dSb290J3MgaG9zdFxuICBlbGVtZW50IHVzaW5nIHRoZSA6aG9zdCBydWxlLiBUbyBzaGltIHRoaXMgZmVhdHVyZSwgdGhlIDpob3N0IHN0eWxlcyBhcmVcbiAgcmVmb3JtYXR0ZWQgYW5kIHByZWZpeGVkIHdpdGggYSBnaXZlbiBzY29wZSBuYW1lIGFuZCBwcm9tb3RlZCB0byBhXG4gIGRvY3VtZW50IGxldmVsIHN0eWxlc2hlZXQuXG4gIEZvciBleGFtcGxlLCBnaXZlbiBhIHNjb3BlIG5hbWUgb2YgLmZvbywgYSBydWxlIGxpa2UgdGhpczpcblxuICAgIDpob3N0IHtcbiAgICAgICAgYmFja2dyb3VuZDogcmVkO1xuICAgICAgfVxuICAgIH1cblxuICBiZWNvbWVzOlxuXG4gICAgLmZvbyB7XG4gICAgICBiYWNrZ3JvdW5kOiByZWQ7XG4gICAgfVxuXG4gICogZW5jYXBzdWxhdGlvbjogU3R5bGVzIGRlZmluZWQgd2l0aGluIFNoYWRvd0RPTSwgYXBwbHkgb25seSB0b1xuICBkb20gaW5zaWRlIHRoZSBTaGFkb3dET00uIFBvbHltZXIgdXNlcyBvbmUgb2YgdHdvIHRlY2huaXF1ZXMgdG8gaW1wbGVtZW50XG4gIHRoaXMgZmVhdHVyZS5cblxuICBCeSBkZWZhdWx0LCBydWxlcyBhcmUgcHJlZml4ZWQgd2l0aCB0aGUgaG9zdCBlbGVtZW50IHRhZyBuYW1lXG4gIGFzIGEgZGVzY2VuZGFudCBzZWxlY3Rvci4gVGhpcyBlbnN1cmVzIHN0eWxpbmcgZG9lcyBub3QgbGVhayBvdXQgb2YgdGhlICd0b3AnXG4gIG9mIHRoZSBlbGVtZW50J3MgU2hhZG93RE9NLiBGb3IgZXhhbXBsZSxcblxuICBkaXYge1xuICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgfVxuXG4gIGJlY29tZXM6XG5cbiAgeC1mb28gZGl2IHtcbiAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgIH1cblxuICBiZWNvbWVzOlxuXG5cbiAgQWx0ZXJuYXRpdmVseSwgaWYgV2ViQ29tcG9uZW50cy5TaGFkb3dDU1Muc3RyaWN0U3R5bGluZyBpcyBzZXQgdG8gdHJ1ZSB0aGVuXG4gIHNlbGVjdG9ycyBhcmUgc2NvcGVkIGJ5IGFkZGluZyBhbiBhdHRyaWJ1dGUgc2VsZWN0b3Igc3VmZml4IHRvIGVhY2hcbiAgc2ltcGxlIHNlbGVjdG9yIHRoYXQgY29udGFpbnMgdGhlIGhvc3QgZWxlbWVudCB0YWcgbmFtZS4gRWFjaCBlbGVtZW50XG4gIGluIHRoZSBlbGVtZW50J3MgU2hhZG93RE9NIHRlbXBsYXRlIGlzIGFsc28gZ2l2ZW4gdGhlIHNjb3BlIGF0dHJpYnV0ZS5cbiAgVGh1cywgdGhlc2UgcnVsZXMgbWF0Y2ggb25seSBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHNjb3BlIGF0dHJpYnV0ZS5cbiAgRm9yIGV4YW1wbGUsIGdpdmVuIGEgc2NvcGUgbmFtZSBvZiB4LWZvbywgYSBydWxlIGxpa2UgdGhpczpcblxuICAgIGRpdiB7XG4gICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICB9XG5cbiAgYmVjb21lczpcblxuICAgIGRpdlt4LWZvb10ge1xuICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgfVxuXG4gIE5vdGUgdGhhdCBlbGVtZW50cyB0aGF0IGFyZSBkeW5hbWljYWxseSBhZGRlZCB0byBhIHNjb3BlIG11c3QgaGF2ZSB0aGUgc2NvcGVcbiAgc2VsZWN0b3IgYWRkZWQgdG8gdGhlbSBtYW51YWxseS5cblxuICAqIHVwcGVyL2xvd2VyIGJvdW5kIGVuY2Fwc3VsYXRpb246IFN0eWxlcyB3aGljaCBhcmUgZGVmaW5lZCBvdXRzaWRlIGFcbiAgc2hhZG93Um9vdCBzaG91bGQgbm90IGNyb3NzIHRoZSBTaGFkb3dET00gYm91bmRhcnkgYW5kIHNob3VsZCBub3QgYXBwbHlcbiAgaW5zaWRlIGEgc2hhZG93Um9vdC5cblxuICBUaGlzIHN0eWxpbmcgYmVoYXZpb3IgaXMgbm90IGVtdWxhdGVkLiBTb21lIHBvc3NpYmxlIHdheXMgdG8gZG8gdGhpcyB0aGF0XG4gIHdlcmUgcmVqZWN0ZWQgZHVlIHRvIGNvbXBsZXhpdHkgYW5kL29yIHBlcmZvcm1hbmNlIGNvbmNlcm5zIGluY2x1ZGU6ICgxKSByZXNldFxuICBldmVyeSBwb3NzaWJsZSBwcm9wZXJ0eSBmb3IgZXZlcnkgcG9zc2libGUgc2VsZWN0b3IgZm9yIGEgZ2l2ZW4gc2NvcGUgbmFtZTtcbiAgKDIpIHJlLWltcGxlbWVudCBjc3MgaW4gamF2YXNjcmlwdC5cblxuICBBcyBhbiBhbHRlcm5hdGl2ZSwgdXNlcnMgc2hvdWxkIG1ha2Ugc3VyZSB0byB1c2Ugc2VsZWN0b3JzXG4gIHNwZWNpZmljIHRvIHRoZSBzY29wZSBpbiB3aGljaCB0aGV5IGFyZSB3b3JraW5nLlxuXG4gICogOjpkaXN0cmlidXRlZDogVGhpcyBiZWhhdmlvciBpcyBub3QgZW11bGF0ZWQuIEl0J3Mgb2Z0ZW4gbm90IG5lY2Vzc2FyeVxuICB0byBzdHlsZSB0aGUgY29udGVudHMgb2YgYSBzcGVjaWZpYyBpbnNlcnRpb24gcG9pbnQgYW5kIGluc3RlYWQsIGRlc2NlbmRhbnRzXG4gIG9mIHRoZSBob3N0IGVsZW1lbnQgY2FuIGJlIHN0eWxlZCBzZWxlY3RpdmVseS4gVXNlcnMgY2FuIGFsc28gY3JlYXRlIGFuXG4gIGV4dHJhIG5vZGUgYXJvdW5kIGFuIGluc2VydGlvbiBwb2ludCBhbmQgc3R5bGUgdGhhdCBub2RlJ3MgY29udGVudHNcbiAgdmlhIGRlc2NlbmRlbnQgc2VsZWN0b3JzLiBGb3IgZXhhbXBsZSwgd2l0aCBhIHNoYWRvd1Jvb3QgbGlrZSB0aGlzOlxuXG4gICAgPHN0eWxlPlxuICAgICAgOjpjb250ZW50KGRpdikge1xuICAgICAgICBiYWNrZ3JvdW5kOiByZWQ7XG4gICAgICB9XG4gICAgPC9zdHlsZT5cbiAgICA8Y29udGVudD48L2NvbnRlbnQ+XG5cbiAgY291bGQgYmVjb21lOlxuXG4gICAgPHN0eWxlPlxuICAgICAgLyAqQHBvbHlmaWxsIC5jb250ZW50LWNvbnRhaW5lciBkaXYgKiAvXG4gICAgICA6OmNvbnRlbnQoZGl2KSB7XG4gICAgICAgIGJhY2tncm91bmQ6IHJlZDtcbiAgICAgIH1cbiAgICA8L3N0eWxlPlxuICAgIDxkaXYgY2xhc3M9XCJjb250ZW50LWNvbnRhaW5lclwiPlxuICAgICAgPGNvbnRlbnQ+PC9jb250ZW50PlxuICAgIDwvZGl2PlxuXG4gIE5vdGUgdGhlIHVzZSBvZiBAcG9seWZpbGwgaW4gdGhlIGNvbW1lbnQgYWJvdmUgYSBTaGFkb3dET00gc3BlY2lmaWMgc3R5bGVcbiAgZGVjbGFyYXRpb24uIFRoaXMgaXMgYSBkaXJlY3RpdmUgdG8gdGhlIHN0eWxpbmcgc2hpbSB0byB1c2UgdGhlIHNlbGVjdG9yXG4gIGluIGNvbW1lbnRzIGluIGxpZXUgb2YgdGhlIG5leHQgc2VsZWN0b3Igd2hlbiBydW5uaW5nIHVuZGVyIHBvbHlmaWxsLlxuKi9cblxuZXhwb3J0IGNsYXNzIFNoYWRvd0NzcyB7XG4gIHN0cmljdFN0eWxpbmc6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIC8qXG4gICAqIFNoaW0gc29tZSBjc3NUZXh0IHdpdGggdGhlIGdpdmVuIHNlbGVjdG9yLiBSZXR1cm5zIGNzc1RleHQgdGhhdCBjYW5cbiAgICogYmUgaW5jbHVkZWQgaW4gdGhlIGRvY3VtZW50IHZpYSBXZWJDb21wb25lbnRzLlNoYWRvd0NTUy5hZGRDc3NUb0RvY3VtZW50KGNzcykuXG4gICAqXG4gICAqIFdoZW4gc3RyaWN0U3R5bGluZyBpcyB0cnVlOlxuICAgKiAtIHNlbGVjdG9yIGlzIHRoZSBhdHRyaWJ1dGUgYWRkZWQgdG8gYWxsIGVsZW1lbnRzIGluc2lkZSB0aGUgaG9zdCxcbiAgICogLSBob3N0U2VsZWN0b3IgaXMgdGhlIGF0dHJpYnV0ZSBhZGRlZCB0byB0aGUgaG9zdCBpdHNlbGYuXG4gICAqL1xuICBzaGltQ3NzVGV4dChjc3NUZXh0OiBzdHJpbmcsIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nID0gJycpOiBzdHJpbmcge1xuICAgIGNvbnN0IGNvbW1lbnRzV2l0aEhhc2ggPSBleHRyYWN0Q29tbWVudHNXaXRoSGFzaChjc3NUZXh0KTtcbiAgICBjc3NUZXh0ID0gc3RyaXBDb21tZW50cyhjc3NUZXh0KTtcbiAgICBjc3NUZXh0ID0gdGhpcy5faW5zZXJ0RGlyZWN0aXZlcyhjc3NUZXh0KTtcblxuICAgIGNvbnN0IHNjb3BlZENzc1RleHQgPSB0aGlzLl9zY29wZUNzc1RleHQoY3NzVGV4dCwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgcmV0dXJuIFtzY29wZWRDc3NUZXh0LCAuLi5jb21tZW50c1dpdGhIYXNoXS5qb2luKCdcXG4nKTtcbiAgfVxuXG4gIHByaXZhdGUgX2luc2VydERpcmVjdGl2ZXMoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjc3NUZXh0ID0gdGhpcy5faW5zZXJ0UG9seWZpbGxEaXJlY3RpdmVzSW5Dc3NUZXh0KGNzc1RleHQpO1xuICAgIHJldHVybiB0aGlzLl9pbnNlcnRQb2x5ZmlsbFJ1bGVzSW5Dc3NUZXh0KGNzc1RleHQpO1xuICB9XG5cbiAgLypcbiAgICogUHJvY2VzcyBzdHlsZXMgdG8gY29udmVydCBuYXRpdmUgU2hhZG93RE9NIHJ1bGVzIHRoYXQgd2lsbCB0cmlwXG4gICAqIHVwIHRoZSBjc3MgcGFyc2VyOyB3ZSByZWx5IG9uIGRlY29yYXRpbmcgdGhlIHN0eWxlc2hlZXQgd2l0aCBpbmVydCBydWxlcy5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIHdlIGNvbnZlcnQgdGhpcyBydWxlOlxuICAgKlxuICAgKiBwb2x5ZmlsbC1uZXh0LXNlbGVjdG9yIHsgY29udGVudDogJzpob3N0IG1lbnUtaXRlbSc7IH1cbiAgICogOjpjb250ZW50IG1lbnUtaXRlbSB7XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIHNjb3BlTmFtZSBtZW51LWl0ZW0ge1xuICAgKlxuICAgKiovXG4gIHByaXZhdGUgX2luc2VydFBvbHlmaWxsRGlyZWN0aXZlc0luQ3NzVGV4dChjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIC8vIERpZmZlcmVuY2Ugd2l0aCB3ZWJjb21wb25lbnRzLmpzOiBkb2VzIG5vdCBoYW5kbGUgY29tbWVudHNcbiAgICByZXR1cm4gY3NzVGV4dC5yZXBsYWNlKF9jc3NDb250ZW50TmV4dFNlbGVjdG9yUmUsIGZ1bmN0aW9uKC4uLm06IHN0cmluZ1tdKSB7XG4gICAgICByZXR1cm4gbVsyXSArICd7JztcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBydWxlcyB3aGljaCB3aWxsIG9ubHkgYXBwbHkgdW5kZXIgdGhlIHBvbHlmaWxsXG4gICAqXG4gICAqIEZvciBleGFtcGxlLCB3ZSBjb252ZXJ0IHRoaXMgcnVsZTpcbiAgICpcbiAgICogcG9seWZpbGwtcnVsZSB7XG4gICAqICAgY29udGVudDogJzpob3N0IG1lbnUtaXRlbSc7XG4gICAqIC4uLlxuICAgKiB9XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIHNjb3BlTmFtZSBtZW51LWl0ZW0gey4uLn1cbiAgICpcbiAgICoqL1xuICBwcml2YXRlIF9pbnNlcnRQb2x5ZmlsbFJ1bGVzSW5Dc3NUZXh0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8gRGlmZmVyZW5jZSB3aXRoIHdlYmNvbXBvbmVudHMuanM6IGRvZXMgbm90IGhhbmRsZSBjb21tZW50c1xuICAgIHJldHVybiBjc3NUZXh0LnJlcGxhY2UoX2Nzc0NvbnRlbnRSdWxlUmUsICguLi5tOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgY29uc3QgcnVsZSA9IG1bMF0ucmVwbGFjZShtWzFdLCAnJykucmVwbGFjZShtWzJdLCAnJyk7XG4gICAgICByZXR1cm4gbVs0XSArIHJ1bGU7XG4gICAgfSk7XG4gIH1cblxuICAvKiBFbnN1cmUgc3R5bGVzIGFyZSBzY29wZWQuIFBzZXVkby1zY29waW5nIHRha2VzIGEgcnVsZSBsaWtlOlxuICAgKlxuICAgKiAgLmZvbyB7Li4uIH1cbiAgICpcbiAgICogIGFuZCBjb252ZXJ0cyB0aGlzIHRvXG4gICAqXG4gICAqICBzY29wZU5hbWUgLmZvbyB7IC4uLiB9XG4gICAqL1xuICBwcml2YXRlIF9zY29wZUNzc1RleHQoY3NzVGV4dDogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB1bnNjb3BlZFJ1bGVzID0gdGhpcy5fZXh0cmFjdFVuc2NvcGVkUnVsZXNGcm9tQ3NzVGV4dChjc3NUZXh0KTtcbiAgICAvLyByZXBsYWNlIDpob3N0IGFuZCA6aG9zdC1jb250ZXh0IC1zaGFkb3djc3Nob3N0IGFuZCAtc2hhZG93Y3NzaG9zdCByZXNwZWN0aXZlbHlcbiAgICBjc3NUZXh0ID0gdGhpcy5faW5zZXJ0UG9seWZpbGxIb3N0SW5Dc3NUZXh0KGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9jb252ZXJ0Q29sb25Ib3N0KGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9jb252ZXJ0Q29sb25Ib3N0Q29udGV4dChjc3NUZXh0KTtcbiAgICBjc3NUZXh0ID0gdGhpcy5fY29udmVydFNoYWRvd0RPTVNlbGVjdG9ycyhjc3NUZXh0KTtcbiAgICBpZiAoc2NvcGVTZWxlY3Rvcikge1xuICAgICAgY3NzVGV4dCA9IHRoaXMuX3Njb3BlU2VsZWN0b3JzKGNzc1RleHQsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgfVxuICAgIGNzc1RleHQgPSBjc3NUZXh0ICsgJ1xcbicgKyB1bnNjb3BlZFJ1bGVzO1xuICAgIHJldHVybiBjc3NUZXh0LnRyaW0oKTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBydWxlcyB3aGljaCB3aWxsIG9ubHkgYXBwbHkgdW5kZXIgdGhlIHBvbHlmaWxsXG4gICAqIGFuZCBkbyBub3QgcHJvY2VzcyB2aWEgQ1NTT00uIChDU1NPTSBpcyBkZXN0cnVjdGl2ZSB0byBydWxlcyBvbiByYXJlXG4gICAqIG9jY2FzaW9ucywgZS5nLiAtd2Via2l0LWNhbGMgb24gU2FmYXJpLilcbiAgICogRm9yIGV4YW1wbGUsIHdlIGNvbnZlcnQgdGhpcyBydWxlOlxuICAgKlxuICAgKiBAcG9seWZpbGwtdW5zY29wZWQtcnVsZSB7XG4gICAqICAgY29udGVudDogJ21lbnUtaXRlbSc7XG4gICAqIC4uLiB9XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIG1lbnUtaXRlbSB7Li4ufVxuICAgKlxuICAgKiovXG4gIHByaXZhdGUgX2V4dHJhY3RVbnNjb3BlZFJ1bGVzRnJvbUNzc1RleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBEaWZmZXJlbmNlIHdpdGggd2ViY29tcG9uZW50cy5qczogZG9lcyBub3QgaGFuZGxlIGNvbW1lbnRzXG4gICAgbGV0IHIgPSAnJztcbiAgICBsZXQgbTogUmVnRXhwRXhlY0FycmF5fG51bGw7XG4gICAgX2Nzc0NvbnRlbnRVbnNjb3BlZFJ1bGVSZS5sYXN0SW5kZXggPSAwO1xuICAgIHdoaWxlICgobSA9IF9jc3NDb250ZW50VW5zY29wZWRSdWxlUmUuZXhlYyhjc3NUZXh0KSkgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHJ1bGUgPSBtWzBdLnJlcGxhY2UobVsyXSwgJycpLnJlcGxhY2UobVsxXSwgbVs0XSk7XG4gICAgICByICs9IHJ1bGUgKyAnXFxuXFxuJztcbiAgICB9XG4gICAgcmV0dXJuIHI7XG4gIH1cblxuICAvKlxuICAgKiBjb252ZXJ0IGEgcnVsZSBsaWtlIDpob3N0KC5mb28pID4gLmJhciB7IH1cbiAgICpcbiAgICogdG9cbiAgICpcbiAgICogLmZvbzxzY29wZU5hbWU+ID4gLmJhclxuICAgKi9cbiAgcHJpdmF0ZSBfY29udmVydENvbG9uSG9zdChjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjc3NUZXh0LnJlcGxhY2UoX2Nzc0NvbG9uSG9zdFJlLCAoXywgaG9zdFNlbGVjdG9yczogc3RyaW5nLCBvdGhlclNlbGVjdG9yczogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAoaG9zdFNlbGVjdG9ycykge1xuICAgICAgICBjb25zdCBjb252ZXJ0ZWRTZWxlY3RvcnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IGhvc3RTZWxlY3RvckFycmF5ID0gaG9zdFNlbGVjdG9ycy5zcGxpdCgnLCcpLm1hcChwID0+IHAudHJpbSgpKTtcbiAgICAgICAgZm9yIChjb25zdCBob3N0U2VsZWN0b3Igb2YgaG9zdFNlbGVjdG9yQXJyYXkpIHtcbiAgICAgICAgICBpZiAoIWhvc3RTZWxlY3RvcikgYnJlYWs7XG4gICAgICAgICAgY29uc3QgY29udmVydGVkU2VsZWN0b3IgPVxuICAgICAgICAgICAgICBfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yICsgaG9zdFNlbGVjdG9yLnJlcGxhY2UoX3BvbHlmaWxsSG9zdCwgJycpICsgb3RoZXJTZWxlY3RvcnM7XG4gICAgICAgICAgY29udmVydGVkU2VsZWN0b3JzLnB1c2goY29udmVydGVkU2VsZWN0b3IpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb252ZXJ0ZWRTZWxlY3RvcnMuam9pbignLCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IgKyBvdGhlclNlbGVjdG9ycztcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIGNvbnZlcnQgYSBydWxlIGxpa2UgOmhvc3QtY29udGV4dCguZm9vKSA+IC5iYXIgeyB9XG4gICAqXG4gICAqIHRvXG4gICAqXG4gICAqIC5mb288c2NvcGVOYW1lPiA+IC5iYXIsIC5mb28gPHNjb3BlTmFtZT4gPiAuYmFyIHsgfVxuICAgKlxuICAgKiBhbmRcbiAgICpcbiAgICogOmhvc3QtY29udGV4dCguZm9vOmhvc3QpIC5iYXIgeyAuLi4gfVxuICAgKlxuICAgKiB0b1xuICAgKlxuICAgKiAuZm9vPHNjb3BlTmFtZT4gLmJhciB7IC4uLiB9XG4gICAqL1xuICBwcml2YXRlIF9jb252ZXJ0Q29sb25Ib3N0Q29udGV4dChjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjc3NUZXh0LnJlcGxhY2UoX2Nzc0NvbG9uSG9zdENvbnRleHRSZUdsb2JhbCwgc2VsZWN0b3JUZXh0ID0+IHtcbiAgICAgIC8vIFdlIGhhdmUgY2FwdHVyZWQgYSBzZWxlY3RvciB0aGF0IGNvbnRhaW5zIGEgYDpob3N0LWNvbnRleHRgIHJ1bGUuXG5cbiAgICAgIC8vIEZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGA6aG9zdC1jb250ZXh0YCBtYXkgY29udGFpbiBhIGNvbW1hIHNlcGFyYXRlZCBsaXN0IG9mIHNlbGVjdG9ycy5cbiAgICAgIC8vIEVhY2ggY29udGV4dCBzZWxlY3RvciBncm91cCB3aWxsIGNvbnRhaW4gYSBsaXN0IG9mIGhvc3QtY29udGV4dCBzZWxlY3RvcnMgdGhhdCBtdXN0IG1hdGNoXG4gICAgICAvLyBhbiBhbmNlc3RvciBvZiB0aGUgaG9zdC5cbiAgICAgIC8vIChOb3JtYWxseSBgY29udGV4dFNlbGVjdG9yR3JvdXBzYCB3aWxsIG9ubHkgY29udGFpbiBhIHNpbmdsZSBhcnJheSBvZiBjb250ZXh0IHNlbGVjdG9ycy4pXG4gICAgICBjb25zdCBjb250ZXh0U2VsZWN0b3JHcm91cHM6IHN0cmluZ1tdW10gPSBbW11dO1xuXG4gICAgICAvLyBUaGVyZSBtYXkgYmUgbW9yZSB0aGFuIGA6aG9zdC1jb250ZXh0YCBpbiB0aGlzIHNlbGVjdG9yIHNvIGBzZWxlY3RvclRleHRgIGNvdWxkIGxvb2sgbGlrZTpcbiAgICAgIC8vIGA6aG9zdC1jb250ZXh0KC5vbmUpOmhvc3QtY29udGV4dCgudHdvKWAuXG4gICAgICAvLyBFeGVjdXRlIGBfY3NzQ29sb25Ib3N0Q29udGV4dFJlYCBvdmVyIGFuZCBvdmVyIHVudGlsIHdlIGhhdmUgZXh0cmFjdGVkIGFsbCB0aGVcbiAgICAgIC8vIGA6aG9zdC1jb250ZXh0YCBzZWxlY3RvcnMgZnJvbSB0aGlzIHNlbGVjdG9yLlxuICAgICAgbGV0IG1hdGNoOiBSZWdFeHBNYXRjaEFycmF5fG51bGw7XG4gICAgICB3aGlsZSAobWF0Y2ggPSBfY3NzQ29sb25Ib3N0Q29udGV4dFJlLmV4ZWMoc2VsZWN0b3JUZXh0KSkge1xuICAgICAgICAvLyBgbWF0Y2hgID0gWyc6aG9zdC1jb250ZXh0KDxzZWxlY3RvcnM+KTxyZXN0PicsIDxzZWxlY3RvcnM+LCA8cmVzdD5dXG5cbiAgICAgICAgLy8gVGhlIGA8c2VsZWN0b3JzPmAgY291bGQgYWN0dWFsbHkgYmUgYSBjb21tYSBzZXBhcmF0ZWQgbGlzdDogYDpob3N0LWNvbnRleHQoLm9uZSwgLnR3bylgLlxuICAgICAgICBjb25zdCBuZXdDb250ZXh0U2VsZWN0b3JzID1cbiAgICAgICAgICAgIChtYXRjaFsxXSA/PyAnJykudHJpbSgpLnNwbGl0KCcsJykubWFwKG0gPT4gbS50cmltKCkpLmZpbHRlcihtID0+IG0gIT09ICcnKTtcblxuICAgICAgICAvLyBXZSBtdXN0IGR1cGxpY2F0ZSB0aGUgY3VycmVudCBzZWxlY3RvciBncm91cCBmb3IgZWFjaCBvZiB0aGVzZSBuZXcgc2VsZWN0b3JzLlxuICAgICAgICAvLyBGb3IgZXhhbXBsZSBpZiB0aGUgY3VycmVudCBncm91cHMgYXJlOlxuICAgICAgICAvLyBgYGBcbiAgICAgICAgLy8gW1xuICAgICAgICAvLyAgIFsnYScsICdiJywgJ2MnXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6J10sXG4gICAgICAgIC8vIF1cbiAgICAgICAgLy8gYGBgXG4gICAgICAgIC8vIEFuZCB3ZSBoYXZlIGEgbmV3IHNldCBvZiBjb21tYSBzZXBhcmF0ZWQgc2VsZWN0b3JzOiBgOmhvc3QtY29udGV4dChtLG4pYCB0aGVuIHRoZSBuZXdcbiAgICAgICAgLy8gZ3JvdXBzIGFyZTpcbiAgICAgICAgLy8gYGBgXG4gICAgICAgIC8vIFtcbiAgICAgICAgLy8gICBbJ2EnLCAnYicsICdjJywgJ20nXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6JywgJ20nXSxcbiAgICAgICAgLy8gICBbJ2EnLCAnYicsICdjJywgJ24nXSxcbiAgICAgICAgLy8gICBbJ3gnLCAneScsICd6JywgJ24nXSxcbiAgICAgICAgLy8gXVxuICAgICAgICAvLyBgYGBcbiAgICAgICAgY29uc3QgY29udGV4dFNlbGVjdG9yR3JvdXBzTGVuZ3RoID0gY29udGV4dFNlbGVjdG9yR3JvdXBzLmxlbmd0aDtcbiAgICAgICAgcmVwZWF0R3JvdXBzKGNvbnRleHRTZWxlY3Rvckdyb3VwcywgbmV3Q29udGV4dFNlbGVjdG9ycy5sZW5ndGgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5ld0NvbnRleHRTZWxlY3RvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNvbnRleHRTZWxlY3Rvckdyb3Vwc0xlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBjb250ZXh0U2VsZWN0b3JHcm91cHNbaiArIChpICogY29udGV4dFNlbGVjdG9yR3JvdXBzTGVuZ3RoKV0ucHVzaChcbiAgICAgICAgICAgICAgICBuZXdDb250ZXh0U2VsZWN0b3JzW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgdGhlIGBzZWxlY3RvclRleHRgIGFuZCBzZWUgcmVwZWF0IHRvIHNlZSBpZiB0aGVyZSBhcmUgbW9yZSBgOmhvc3QtY29udGV4dGBzLlxuICAgICAgICBzZWxlY3RvclRleHQgPSBtYXRjaFsyXTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGNvbnRleHQgc2VsZWN0b3JzIG5vdyBtdXN0IGJlIGNvbWJpbmVkIHdpdGggZWFjaCBvdGhlciB0byBjYXB0dXJlIGFsbCB0aGUgcG9zc2libGVcbiAgICAgIC8vIHNlbGVjdG9ycyB0aGF0IGA6aG9zdC1jb250ZXh0YCBjYW4gbWF0Y2guIFNlZSBgY29tYmluZUhvc3RDb250ZXh0U2VsZWN0b3JzKClgIGZvciBtb3JlXG4gICAgICAvLyBpbmZvIGFib3V0IGhvdyB0aGlzIGlzIGRvbmUuXG4gICAgICByZXR1cm4gY29udGV4dFNlbGVjdG9yR3JvdXBzXG4gICAgICAgICAgLm1hcChjb250ZXh0U2VsZWN0b3JzID0+IGNvbWJpbmVIb3N0Q29udGV4dFNlbGVjdG9ycyhjb250ZXh0U2VsZWN0b3JzLCBzZWxlY3RvclRleHQpKVxuICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgIH0pO1xuICB9XG5cbiAgLypcbiAgICogQ29udmVydCBjb21iaW5hdG9ycyBsaWtlIDo6c2hhZG93IGFuZCBwc2V1ZG8tZWxlbWVudHMgbGlrZSA6OmNvbnRlbnRcbiAgICogYnkgcmVwbGFjaW5nIHdpdGggc3BhY2UuXG4gICAqL1xuICBwcml2YXRlIF9jb252ZXJ0U2hhZG93RE9NU2VsZWN0b3JzKGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIF9zaGFkb3dET01TZWxlY3RvcnNSZS5yZWR1Y2UoKHJlc3VsdCwgcGF0dGVybikgPT4gcmVzdWx0LnJlcGxhY2UocGF0dGVybiwgJyAnKSwgY3NzVGV4dCk7XG4gIH1cblxuICAvLyBjaGFuZ2UgYSBzZWxlY3RvciBsaWtlICdkaXYnIHRvICduYW1lIGRpdidcbiAgcHJpdmF0ZSBfc2NvcGVTZWxlY3RvcnMoY3NzVGV4dDogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcHJvY2Vzc1J1bGVzKGNzc1RleHQsIChydWxlOiBDc3NSdWxlKSA9PiB7XG4gICAgICBsZXQgc2VsZWN0b3IgPSBydWxlLnNlbGVjdG9yO1xuICAgICAgbGV0IGNvbnRlbnQgPSBydWxlLmNvbnRlbnQ7XG4gICAgICBpZiAocnVsZS5zZWxlY3RvclswXSAhPT0gJ0AnKSB7XG4gICAgICAgIHNlbGVjdG9yID1cbiAgICAgICAgICAgIHRoaXMuX3Njb3BlU2VsZWN0b3IocnVsZS5zZWxlY3Rvciwgc2NvcGVTZWxlY3RvciwgaG9zdFNlbGVjdG9yLCB0aGlzLnN0cmljdFN0eWxpbmcpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICBydWxlLnNlbGVjdG9yLnN0YXJ0c1dpdGgoJ0BtZWRpYScpIHx8IHJ1bGUuc2VsZWN0b3Iuc3RhcnRzV2l0aCgnQHN1cHBvcnRzJykgfHxcbiAgICAgICAgICBydWxlLnNlbGVjdG9yLnN0YXJ0c1dpdGgoJ0Bkb2N1bWVudCcpKSB7XG4gICAgICAgIGNvbnRlbnQgPSB0aGlzLl9zY29wZVNlbGVjdG9ycyhydWxlLmNvbnRlbnQsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgICB9IGVsc2UgaWYgKHJ1bGUuc2VsZWN0b3Iuc3RhcnRzV2l0aCgnQGZvbnQtZmFjZScpIHx8IHJ1bGUuc2VsZWN0b3Iuc3RhcnRzV2l0aCgnQHBhZ2UnKSkge1xuICAgICAgICBjb250ZW50ID0gdGhpcy5fc3RyaXBTY29waW5nU2VsZWN0b3JzKHJ1bGUuY29udGVudCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IENzc1J1bGUoc2VsZWN0b3IsIGNvbnRlbnQpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIGNzcyB0ZXh0IHRoYXQgaXMgd2l0aGluIGEgcnVsZSB0aGF0IHNob3VsZCBub3QgY29udGFpbiBzY29wZSBzZWxlY3RvcnMgYnkgc2ltcGx5XG4gICAqIHJlbW92aW5nIHRoZW0hIEFuIGV4YW1wbGUgb2Ygc3VjaCBhIHJ1bGUgaXMgYEBmb250LWZhY2VgLlxuICAgKlxuICAgKiBgQGZvbnQtZmFjZWAgcnVsZXMgY2Fubm90IGNvbnRhaW4gbmVzdGVkIHNlbGVjdG9ycy4gTm9yIGNhbiB0aGV5IGJlIG5lc3RlZCB1bmRlciBhIHNlbGVjdG9yLlxuICAgKiBOb3JtYWxseSB0aGlzIHdvdWxkIGJlIGEgc3ludGF4IGVycm9yIGJ5IHRoZSBhdXRob3Igb2YgdGhlIHN0eWxlcy4gQnV0IGluIHNvbWUgcmFyZSBjYXNlcywgc3VjaFxuICAgKiBhcyBpbXBvcnRpbmcgc3R5bGVzIGZyb20gYSBsaWJyYXJ5LCBhbmQgYXBwbHlpbmcgYDpob3N0IDo6bmctZGVlcGAgdG8gdGhlIGltcG9ydGVkIHN0eWxlcywgd2VcbiAgICogY2FuIGVuZCB1cCB3aXRoIGJyb2tlbiBjc3MgaWYgdGhlIGltcG9ydGVkIHN0eWxlcyBoYXBwZW4gdG8gY29udGFpbiBAZm9udC1mYWNlIHJ1bGVzLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZTpcbiAgICpcbiAgICogYGBgXG4gICAqIDpob3N0IDo6bmctZGVlcCB7XG4gICAqICAgaW1wb3J0ICdzb21lL2xpYi9jb250YWluaW5nL2ZvbnQtZmFjZSc7XG4gICAqIH1cbiAgICpcbiAgICogU2ltaWxhciBsb2dpYyBhcHBsaWVzIHRvIGBAcGFnZWAgcnVsZXMgd2hpY2ggY2FuIGNvbnRhaW4gYSBwYXJ0aWN1bGFyIHNldCBvZiBwcm9wZXJ0aWVzLFxuICAgKiBhcyB3ZWxsIGFzIHNvbWUgc3BlY2lmaWMgYXQtcnVsZXMuIFNpbmNlIHRoZXkgY2FuJ3QgYmUgZW5jYXBzdWxhdGVkLCB3ZSBoYXZlIHRvIHN0cmlwXG4gICAqIGFueSBzY29waW5nIHNlbGVjdG9ycyBmcm9tIHRoZW0uIEZvciBtb3JlIGluZm9ybWF0aW9uOiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXBhZ2UtM1xuICAgKiBgYGBcbiAgICovXG4gIHByaXZhdGUgX3N0cmlwU2NvcGluZ1NlbGVjdG9ycyhjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBwcm9jZXNzUnVsZXMoY3NzVGV4dCwgcnVsZSA9PiB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IHJ1bGUuc2VsZWN0b3IucmVwbGFjZShfc2hhZG93RGVlcFNlbGVjdG9ycywgJyAnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvclJlLCAnICcpO1xuICAgICAgcmV0dXJuIG5ldyBDc3NSdWxlKHNlbGVjdG9yLCBydWxlLmNvbnRlbnQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfc2NvcGVTZWxlY3RvcihcbiAgICAgIHNlbGVjdG9yOiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcsIHN0cmljdDogYm9vbGVhbik6IHN0cmluZyB7XG4gICAgcmV0dXJuIHNlbGVjdG9yLnNwbGl0KCcsJylcbiAgICAgICAgLm1hcChwYXJ0ID0+IHBhcnQudHJpbSgpLnNwbGl0KF9zaGFkb3dEZWVwU2VsZWN0b3JzKSlcbiAgICAgICAgLm1hcCgoZGVlcFBhcnRzKSA9PiB7XG4gICAgICAgICAgY29uc3QgW3NoYWxsb3dQYXJ0LCAuLi5vdGhlclBhcnRzXSA9IGRlZXBQYXJ0cztcbiAgICAgICAgICBjb25zdCBhcHBseVNjb3BlID0gKHNoYWxsb3dQYXJ0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zZWxlY3Rvck5lZWRzU2NvcGluZyhzaGFsbG93UGFydCwgc2NvcGVTZWxlY3RvcikpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN0cmljdCA/XG4gICAgICAgICAgICAgICAgICB0aGlzLl9hcHBseVN0cmljdFNlbGVjdG9yU2NvcGUoc2hhbGxvd1BhcnQsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3RvcikgOlxuICAgICAgICAgICAgICAgICAgdGhpcy5fYXBwbHlTZWxlY3RvclNjb3BlKHNoYWxsb3dQYXJ0LCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNoYWxsb3dQYXJ0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgcmV0dXJuIFthcHBseVNjb3BlKHNoYWxsb3dQYXJ0KSwgLi4ub3RoZXJQYXJ0c10uam9pbignICcpO1xuICAgICAgICB9KVxuICAgICAgICAuam9pbignLCAnKTtcbiAgfVxuXG4gIHByaXZhdGUgX3NlbGVjdG9yTmVlZHNTY29waW5nKHNlbGVjdG9yOiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHJlID0gdGhpcy5fbWFrZVNjb3BlTWF0Y2hlcihzY29wZVNlbGVjdG9yKTtcbiAgICByZXR1cm4gIXJlLnRlc3Qoc2VsZWN0b3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBfbWFrZVNjb3BlTWF0Y2hlcihzY29wZVNlbGVjdG9yOiBzdHJpbmcpOiBSZWdFeHAge1xuICAgIGNvbnN0IGxyZSA9IC9cXFsvZztcbiAgICBjb25zdCBycmUgPSAvXFxdL2c7XG4gICAgc2NvcGVTZWxlY3RvciA9IHNjb3BlU2VsZWN0b3IucmVwbGFjZShscmUsICdcXFxcWycpLnJlcGxhY2UocnJlLCAnXFxcXF0nKTtcbiAgICByZXR1cm4gbmV3IFJlZ0V4cCgnXignICsgc2NvcGVTZWxlY3RvciArICcpJyArIF9zZWxlY3RvclJlU3VmZml4LCAnbScpO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXBwbHlTZWxlY3RvclNjb3BlKHNlbGVjdG9yOiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOlxuICAgICAgc3RyaW5nIHtcbiAgICAvLyBEaWZmZXJlbmNlIGZyb20gd2ViY29tcG9uZW50cy5qczogc2NvcGVTZWxlY3RvciBjb3VsZCBub3QgYmUgYW4gYXJyYXlcbiAgICByZXR1cm4gdGhpcy5fYXBwbHlTaW1wbGVTZWxlY3RvclNjb3BlKHNlbGVjdG9yLCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICB9XG5cbiAgLy8gc2NvcGUgdmlhIG5hbWUgYW5kIFtpcz1uYW1lXVxuICBwcml2YXRlIF9hcHBseVNpbXBsZVNlbGVjdG9yU2NvcGUoc2VsZWN0b3I6IHN0cmluZywgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6XG4gICAgICBzdHJpbmcge1xuICAgIC8vIEluIEFuZHJvaWQgYnJvd3NlciwgdGhlIGxhc3RJbmRleCBpcyBub3QgcmVzZXQgd2hlbiB0aGUgcmVnZXggaXMgdXNlZCBpbiBTdHJpbmcucmVwbGFjZSgpXG4gICAgX3BvbHlmaWxsSG9zdFJlLmxhc3RJbmRleCA9IDA7XG4gICAgaWYgKF9wb2x5ZmlsbEhvc3RSZS50ZXN0KHNlbGVjdG9yKSkge1xuICAgICAgY29uc3QgcmVwbGFjZUJ5ID0gdGhpcy5zdHJpY3RTdHlsaW5nID8gYFske2hvc3RTZWxlY3Rvcn1dYCA6IHNjb3BlU2VsZWN0b3I7XG4gICAgICByZXR1cm4gc2VsZWN0b3JcbiAgICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAgICAgX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvclJlLFxuICAgICAgICAgICAgICAoaG5jLCBzZWxlY3RvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxlY3Rvci5yZXBsYWNlKFxuICAgICAgICAgICAgICAgICAgICAvKFteOl0qKSg6KikoLiopLyxcbiAgICAgICAgICAgICAgICAgICAgKF86IHN0cmluZywgYmVmb3JlOiBzdHJpbmcsIGNvbG9uOiBzdHJpbmcsIGFmdGVyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYmVmb3JlICsgcmVwbGFjZUJ5ICsgY29sb24gKyBhZnRlcjtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgLnJlcGxhY2UoX3BvbHlmaWxsSG9zdFJlLCByZXBsYWNlQnkgKyAnICcpO1xuICAgIH1cblxuICAgIHJldHVybiBzY29wZVNlbGVjdG9yICsgJyAnICsgc2VsZWN0b3I7XG4gIH1cblxuICAvLyByZXR1cm4gYSBzZWxlY3RvciB3aXRoIFtuYW1lXSBzdWZmaXggb24gZWFjaCBzaW1wbGUgc2VsZWN0b3JcbiAgLy8gZS5nLiAuZm9vLmJhciA+IC56b3QgYmVjb21lcyAuZm9vW25hbWVdLmJhcltuYW1lXSA+IC56b3RbbmFtZV0gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSBfYXBwbHlTdHJpY3RTZWxlY3RvclNjb3BlKHNlbGVjdG9yOiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOlxuICAgICAgc3RyaW5nIHtcbiAgICBjb25zdCBpc1JlID0gL1xcW2lzPShbXlxcXV0qKVxcXS9nO1xuICAgIHNjb3BlU2VsZWN0b3IgPSBzY29wZVNlbGVjdG9yLnJlcGxhY2UoaXNSZSwgKF86IHN0cmluZywgLi4ucGFydHM6IHN0cmluZ1tdKSA9PiBwYXJ0c1swXSk7XG5cbiAgICBjb25zdCBhdHRyTmFtZSA9ICdbJyArIHNjb3BlU2VsZWN0b3IgKyAnXSc7XG5cbiAgICBjb25zdCBfc2NvcGVTZWxlY3RvclBhcnQgPSAocDogc3RyaW5nKSA9PiB7XG4gICAgICBsZXQgc2NvcGVkUCA9IHAudHJpbSgpO1xuXG4gICAgICBpZiAoIXNjb3BlZFApIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgICAgfVxuXG4gICAgICBpZiAocC5pbmRleE9mKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpID4gLTEpIHtcbiAgICAgICAgc2NvcGVkUCA9IHRoaXMuX2FwcGx5U2ltcGxlU2VsZWN0b3JTY29wZShwLCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gcmVtb3ZlIDpob3N0IHNpbmNlIGl0IHNob3VsZCBiZSB1bm5lY2Vzc2FyeVxuICAgICAgICBjb25zdCB0ID0gcC5yZXBsYWNlKF9wb2x5ZmlsbEhvc3RSZSwgJycpO1xuICAgICAgICBpZiAodC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IHQubWF0Y2goLyhbXjpdKikoOiopKC4qKS8pO1xuICAgICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBzY29wZWRQID0gbWF0Y2hlc1sxXSArIGF0dHJOYW1lICsgbWF0Y2hlc1syXSArIG1hdGNoZXNbM107XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzY29wZWRQO1xuICAgIH07XG5cbiAgICBjb25zdCBzYWZlQ29udGVudCA9IG5ldyBTYWZlU2VsZWN0b3Ioc2VsZWN0b3IpO1xuICAgIHNlbGVjdG9yID0gc2FmZUNvbnRlbnQuY29udGVudCgpO1xuXG4gICAgbGV0IHNjb3BlZFNlbGVjdG9yID0gJyc7XG4gICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuICAgIGxldCByZXM6IFJlZ0V4cEV4ZWNBcnJheXxudWxsO1xuICAgIGNvbnN0IHNlcCA9IC8oIHw+fFxcK3x+KD8hPSkpXFxzKi9nO1xuXG4gICAgLy8gSWYgYSBzZWxlY3RvciBhcHBlYXJzIGJlZm9yZSA6aG9zdCBpdCBzaG91bGQgbm90IGJlIHNoaW1tZWQgYXMgaXRcbiAgICAvLyBtYXRjaGVzIG9uIGFuY2VzdG9yIGVsZW1lbnRzIGFuZCBub3Qgb24gZWxlbWVudHMgaW4gdGhlIGhvc3QncyBzaGFkb3dcbiAgICAvLyBgOmhvc3QtY29udGV4dChkaXYpYCBpcyB0cmFuc2Zvcm1lZCB0b1xuICAgIC8vIGAtc2hhZG93Y3NzaG9zdC1uby1jb21iaW5hdG9yZGl2LCBkaXYgLXNoYWRvd2Nzc2hvc3Qtbm8tY29tYmluYXRvcmBcbiAgICAvLyB0aGUgYGRpdmAgaXMgbm90IHBhcnQgb2YgdGhlIGNvbXBvbmVudCBpbiB0aGUgMm5kIHNlbGVjdG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBzY29wZWQuXG4gICAgLy8gSGlzdG9yaWNhbGx5IGBjb21wb25lbnQtdGFnOmhvc3RgIHdhcyBtYXRjaGluZyB0aGUgY29tcG9uZW50IHNvIHdlIGFsc28gd2FudCB0byBwcmVzZXJ2ZVxuICAgIC8vIHRoaXMgYmVoYXZpb3IgdG8gYXZvaWQgYnJlYWtpbmcgbGVnYWN5IGFwcHMgKGl0IHNob3VsZCBub3QgbWF0Y2gpLlxuICAgIC8vIFRoZSBiZWhhdmlvciBzaG91bGQgYmU6XG4gICAgLy8gLSBgdGFnOmhvc3RgIC0+IGB0YWdbaF1gICh0aGlzIGlzIHRvIGF2b2lkIGJyZWFraW5nIGxlZ2FjeSBhcHBzLCBzaG91bGQgbm90IG1hdGNoIGFueXRoaW5nKVxuICAgIC8vIC0gYHRhZyA6aG9zdGAgLT4gYHRhZyBbaF1gIChgdGFnYCBpcyBub3Qgc2NvcGVkIGJlY2F1c2UgaXQncyBjb25zaWRlcmVkIHBhcnQgb2YgYVxuICAgIC8vICAgYDpob3N0LWNvbnRleHQodGFnKWApXG4gICAgY29uc3QgaGFzSG9zdCA9IHNlbGVjdG9yLmluZGV4T2YoX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvcikgPiAtMTtcbiAgICAvLyBPbmx5IHNjb3BlIHBhcnRzIGFmdGVyIHRoZSBmaXJzdCBgLXNoYWRvd2Nzc2hvc3Qtbm8tY29tYmluYXRvcmAgd2hlbiBpdCBpcyBwcmVzZW50XG4gICAgbGV0IHNob3VsZFNjb3BlID0gIWhhc0hvc3Q7XG5cbiAgICB3aGlsZSAoKHJlcyA9IHNlcC5leGVjKHNlbGVjdG9yKSkgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHNlcGFyYXRvciA9IHJlc1sxXTtcbiAgICAgIGNvbnN0IHBhcnQgPSBzZWxlY3Rvci5zbGljZShzdGFydEluZGV4LCByZXMuaW5kZXgpLnRyaW0oKTtcbiAgICAgIHNob3VsZFNjb3BlID0gc2hvdWxkU2NvcGUgfHwgcGFydC5pbmRleE9mKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpID4gLTE7XG4gICAgICBjb25zdCBzY29wZWRQYXJ0ID0gc2hvdWxkU2NvcGUgPyBfc2NvcGVTZWxlY3RvclBhcnQocGFydCkgOiBwYXJ0O1xuICAgICAgc2NvcGVkU2VsZWN0b3IgKz0gYCR7c2NvcGVkUGFydH0gJHtzZXBhcmF0b3J9IGA7XG4gICAgICBzdGFydEluZGV4ID0gc2VwLmxhc3RJbmRleDtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJ0ID0gc2VsZWN0b3Iuc3Vic3RyaW5nKHN0YXJ0SW5kZXgpO1xuICAgIHNob3VsZFNjb3BlID0gc2hvdWxkU2NvcGUgfHwgcGFydC5pbmRleE9mKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpID4gLTE7XG4gICAgc2NvcGVkU2VsZWN0b3IgKz0gc2hvdWxkU2NvcGUgPyBfc2NvcGVTZWxlY3RvclBhcnQocGFydCkgOiBwYXJ0O1xuXG4gICAgLy8gcmVwbGFjZSB0aGUgcGxhY2Vob2xkZXJzIHdpdGggdGhlaXIgb3JpZ2luYWwgdmFsdWVzXG4gICAgcmV0dXJuIHNhZmVDb250ZW50LnJlc3RvcmUoc2NvcGVkU2VsZWN0b3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBfaW5zZXJ0UG9seWZpbGxIb3N0SW5Dc3NUZXh0KHNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBzZWxlY3Rvci5yZXBsYWNlKF9jb2xvbkhvc3RDb250ZXh0UmUsIF9wb2x5ZmlsbEhvc3RDb250ZXh0KVxuICAgICAgICAucmVwbGFjZShfY29sb25Ib3N0UmUsIF9wb2x5ZmlsbEhvc3QpO1xuICB9XG59XG5cbmNsYXNzIFNhZmVTZWxlY3RvciB7XG4gIHByaXZhdGUgcGxhY2Vob2xkZXJzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfY29udGVudDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNlbGVjdG9yOiBzdHJpbmcpIHtcbiAgICAvLyBSZXBsYWNlcyBhdHRyaWJ1dGUgc2VsZWN0b3JzIHdpdGggcGxhY2Vob2xkZXJzLlxuICAgIC8vIFRoZSBXUyBpbiBbYXR0cj1cInZhIGx1ZVwiXSB3b3VsZCBvdGhlcndpc2UgYmUgaW50ZXJwcmV0ZWQgYXMgYSBzZWxlY3RvciBzZXBhcmF0b3IuXG4gICAgc2VsZWN0b3IgPSB0aGlzLl9lc2NhcGVSZWdleE1hdGNoZXMoc2VsZWN0b3IsIC8oXFxbW15cXF1dKlxcXSkvZyk7XG5cbiAgICAvLyBDU1MgYWxsb3dzIGZvciBjZXJ0YWluIHNwZWNpYWwgY2hhcmFjdGVycyB0byBiZSB1c2VkIGluIHNlbGVjdG9ycyBpZiB0aGV5J3JlIGVzY2FwZWQuXG4gICAgLy8gRS5nLiBgLmZvbzpibHVlYCB3b24ndCBtYXRjaCBhIGNsYXNzIGNhbGxlZCBgZm9vOmJsdWVgLCBiZWNhdXNlIHRoZSBjb2xvbiBkZW5vdGVzIGFcbiAgICAvLyBwc2V1ZG8tY2xhc3MsIGJ1dCB3cml0aW5nIGAuZm9vXFw6Ymx1ZWAgd2lsbCBtYXRjaCwgYmVjYXVzZSB0aGUgY29sb24gd2FzIGVzY2FwZWQuXG4gICAgLy8gUmVwbGFjZSBhbGwgZXNjYXBlIHNlcXVlbmNlcyAoYFxcYCBmb2xsb3dlZCBieSBhIGNoYXJhY3Rlcikgd2l0aCBhIHBsYWNlaG9sZGVyIHNvXG4gICAgLy8gdGhhdCBvdXIgaGFuZGxpbmcgb2YgcHNldWRvLXNlbGVjdG9ycyBkb2Vzbid0IG1lc3Mgd2l0aCB0aGVtLlxuICAgIHNlbGVjdG9yID0gdGhpcy5fZXNjYXBlUmVnZXhNYXRjaGVzKHNlbGVjdG9yLCAvKFxcXFwuKS9nKTtcblxuICAgIC8vIFJlcGxhY2VzIHRoZSBleHByZXNzaW9uIGluIGA6bnRoLWNoaWxkKDJuICsgMSlgIHdpdGggYSBwbGFjZWhvbGRlci5cbiAgICAvLyBXUyBhbmQgXCIrXCIgd291bGQgb3RoZXJ3aXNlIGJlIGludGVycHJldGVkIGFzIHNlbGVjdG9yIHNlcGFyYXRvcnMuXG4gICAgdGhpcy5fY29udGVudCA9IHNlbGVjdG9yLnJlcGxhY2UoLyg6bnRoLVstXFx3XSspKFxcKFteKV0rXFwpKS9nLCAoXywgcHNldWRvLCBleHApID0+IHtcbiAgICAgIGNvbnN0IHJlcGxhY2VCeSA9IGBfX3BoLSR7dGhpcy5pbmRleH1fX2A7XG4gICAgICB0aGlzLnBsYWNlaG9sZGVycy5wdXNoKGV4cCk7XG4gICAgICB0aGlzLmluZGV4Kys7XG4gICAgICByZXR1cm4gcHNldWRvICsgcmVwbGFjZUJ5O1xuICAgIH0pO1xuICB9XG5cbiAgcmVzdG9yZShjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjb250ZW50LnJlcGxhY2UoL19fcGgtKFxcZCspX18vZywgKF9waCwgaW5kZXgpID0+IHRoaXMucGxhY2Vob2xkZXJzWytpbmRleF0pO1xuICB9XG5cbiAgY29udGVudCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9jb250ZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGFsbCBvZiB0aGUgc3Vic3RyaW5ncyB0aGF0IG1hdGNoIGEgcmVnZXggd2l0aGluIGFcbiAgICogc3BlY2lhbCBzdHJpbmcgKGUuZy4gYF9fcGgtMF9fYCwgYF9fcGgtMV9fYCwgZXRjKS5cbiAgICovXG4gIHByaXZhdGUgX2VzY2FwZVJlZ2V4TWF0Y2hlcyhjb250ZW50OiBzdHJpbmcsIHBhdHRlcm46IFJlZ0V4cCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZShwYXR0ZXJuLCAoXywga2VlcCkgPT4ge1xuICAgICAgY29uc3QgcmVwbGFjZUJ5ID0gYF9fcGgtJHt0aGlzLmluZGV4fV9fYDtcbiAgICAgIHRoaXMucGxhY2Vob2xkZXJzLnB1c2goa2VlcCk7XG4gICAgICB0aGlzLmluZGV4Kys7XG4gICAgICByZXR1cm4gcmVwbGFjZUJ5O1xuICAgIH0pO1xuICB9XG59XG5cbmNvbnN0IF9jc3NDb250ZW50TmV4dFNlbGVjdG9yUmUgPVxuICAgIC9wb2x5ZmlsbC1uZXh0LXNlbGVjdG9yW159XSpjb250ZW50OltcXHNdKj8oWydcIl0pKC4qPylcXDFbO1xcc10qfShbXntdKj8pey9naW07XG5jb25zdCBfY3NzQ29udGVudFJ1bGVSZSA9IC8ocG9seWZpbGwtcnVsZSlbXn1dKihjb250ZW50OltcXHNdKihbJ1wiXSkoLio/KVxcMylbO1xcc10qW159XSp9L2dpbTtcbmNvbnN0IF9jc3NDb250ZW50VW5zY29wZWRSdWxlUmUgPVxuICAgIC8ocG9seWZpbGwtdW5zY29wZWQtcnVsZSlbXn1dKihjb250ZW50OltcXHNdKihbJ1wiXSkoLio/KVxcMylbO1xcc10qW159XSp9L2dpbTtcbmNvbnN0IF9wb2x5ZmlsbEhvc3QgPSAnLXNoYWRvd2Nzc2hvc3QnO1xuLy8gbm90ZTogOmhvc3QtY29udGV4dCBwcmUtcHJvY2Vzc2VkIHRvIC1zaGFkb3djc3Nob3N0Y29udGV4dC5cbmNvbnN0IF9wb2x5ZmlsbEhvc3RDb250ZXh0ID0gJy1zaGFkb3djc3Njb250ZXh0JztcbmNvbnN0IF9wYXJlblN1ZmZpeCA9ICcoPzpcXFxcKCgnICtcbiAgICAnKD86XFxcXChbXikoXSpcXFxcKXxbXikoXSopKz8nICtcbiAgICAnKVxcXFwpKT8oW14se10qKSc7XG5jb25zdCBfY3NzQ29sb25Ib3N0UmUgPSBuZXcgUmVnRXhwKF9wb2x5ZmlsbEhvc3QgKyBfcGFyZW5TdWZmaXgsICdnaW0nKTtcbmNvbnN0IF9jc3NDb2xvbkhvc3RDb250ZXh0UmVHbG9iYWwgPSBuZXcgUmVnRXhwKF9wb2x5ZmlsbEhvc3RDb250ZXh0ICsgX3BhcmVuU3VmZml4LCAnZ2ltJyk7XG5jb25zdCBfY3NzQ29sb25Ib3N0Q29udGV4dFJlID0gbmV3IFJlZ0V4cChfcG9seWZpbGxIb3N0Q29udGV4dCArIF9wYXJlblN1ZmZpeCwgJ2ltJyk7XG5jb25zdCBfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yID0gX3BvbHlmaWxsSG9zdCArICctbm8tY29tYmluYXRvcic7XG5jb25zdCBfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yUmUgPSAvLXNoYWRvd2Nzc2hvc3Qtbm8tY29tYmluYXRvcihbXlxcc10qKS87XG5jb25zdCBfc2hhZG93RE9NU2VsZWN0b3JzUmUgPSBbXG4gIC86OnNoYWRvdy9nLFxuICAvOjpjb250ZW50L2csXG4gIC8vIERlcHJlY2F0ZWQgc2VsZWN0b3JzXG4gIC9cXC9zaGFkb3ctZGVlcFxcLy9nLFxuICAvXFwvc2hhZG93XFwvL2csXG5dO1xuXG4vLyBUaGUgZGVlcCBjb21iaW5hdG9yIGlzIGRlcHJlY2F0ZWQgaW4gdGhlIENTUyBzcGVjXG4vLyBTdXBwb3J0IGZvciBgPj4+YCwgYGRlZXBgLCBgOjpuZy1kZWVwYCBpcyB0aGVuIGFsc28gZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIHRoZSBmdXR1cmUuXG4vLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9wdWxsLzE3Njc3XG5jb25zdCBfc2hhZG93RGVlcFNlbGVjdG9ycyA9IC8oPzo+Pj4pfCg/OlxcL2RlZXBcXC8pfCg/Ojo6bmctZGVlcCkvZztcbmNvbnN0IF9zZWxlY3RvclJlU3VmZml4ID0gJyhbPlxcXFxzfitbLix7Ol1bXFxcXHNcXFxcU10qKT8kJztcbmNvbnN0IF9wb2x5ZmlsbEhvc3RSZSA9IC8tc2hhZG93Y3NzaG9zdC9naW07XG5jb25zdCBfY29sb25Ib3N0UmUgPSAvOmhvc3QvZ2ltO1xuY29uc3QgX2NvbG9uSG9zdENvbnRleHRSZSA9IC86aG9zdC1jb250ZXh0L2dpbTtcblxuY29uc3QgX2NvbW1lbnRSZSA9IC9cXC9cXCpbXFxzXFxTXSo/XFwqXFwvL2c7XG5cbmZ1bmN0aW9uIHN0cmlwQ29tbWVudHMoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBpbnB1dC5yZXBsYWNlKF9jb21tZW50UmUsICcnKTtcbn1cblxuY29uc3QgX2NvbW1lbnRXaXRoSGFzaFJlID0gL1xcL1xcKlxccyojXFxzKnNvdXJjZShNYXBwaW5nKT9VUkw9W1xcc1xcU10rP1xcKlxcLy9nO1xuXG5mdW5jdGlvbiBleHRyYWN0Q29tbWVudHNXaXRoSGFzaChpbnB1dDogc3RyaW5nKTogc3RyaW5nW10ge1xuICByZXR1cm4gaW5wdXQubWF0Y2goX2NvbW1lbnRXaXRoSGFzaFJlKSB8fCBbXTtcbn1cblxuY29uc3QgQkxPQ0tfUExBQ0VIT0xERVIgPSAnJUJMT0NLJSc7XG5jb25zdCBRVU9URV9QTEFDRUhPTERFUiA9ICclUVVPVEVEJSc7XG5jb25zdCBfcnVsZVJlID0gLyhcXHMqKShbXjtcXHtcXH1dKz8pKFxccyopKCg/OnslQkxPQ0slfT9cXHMqOz8pfCg/Olxccyo7KSkvZztcbmNvbnN0IF9xdW90ZWRSZSA9IC8lUVVPVEVEJS9nO1xuY29uc3QgQ09OVEVOVF9QQUlSUyA9IG5ldyBNYXAoW1sneycsICd9J11dKTtcbmNvbnN0IFFVT1RFX1BBSVJTID0gbmV3IE1hcChbW2BcImAsIGBcImBdLCBbYCdgLCBgJ2BdXSk7XG5cbmV4cG9ydCBjbGFzcyBDc3NSdWxlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHNlbGVjdG9yOiBzdHJpbmcsIHB1YmxpYyBjb250ZW50OiBzdHJpbmcpIHt9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9jZXNzUnVsZXMoaW5wdXQ6IHN0cmluZywgcnVsZUNhbGxiYWNrOiAocnVsZTogQ3NzUnVsZSkgPT4gQ3NzUnVsZSk6IHN0cmluZyB7XG4gIGNvbnN0IGlucHV0V2l0aEVzY2FwZWRRdW90ZXMgPSBlc2NhcGVCbG9ja3MoaW5wdXQsIFFVT1RFX1BBSVJTLCBRVU9URV9QTEFDRUhPTERFUik7XG4gIGNvbnN0IGlucHV0V2l0aEVzY2FwZWRCbG9ja3MgPVxuICAgICAgZXNjYXBlQmxvY2tzKGlucHV0V2l0aEVzY2FwZWRRdW90ZXMuZXNjYXBlZFN0cmluZywgQ09OVEVOVF9QQUlSUywgQkxPQ0tfUExBQ0VIT0xERVIpO1xuICBsZXQgbmV4dEJsb2NrSW5kZXggPSAwO1xuICBsZXQgbmV4dFF1b3RlSW5kZXggPSAwO1xuICByZXR1cm4gaW5wdXRXaXRoRXNjYXBlZEJsb2Nrcy5lc2NhcGVkU3RyaW5nXG4gICAgICAucmVwbGFjZShcbiAgICAgICAgICBfcnVsZVJlLFxuICAgICAgICAgICguLi5tOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSBtWzJdO1xuICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSAnJztcbiAgICAgICAgICAgIGxldCBzdWZmaXggPSBtWzRdO1xuICAgICAgICAgICAgbGV0IGNvbnRlbnRQcmVmaXggPSAnJztcbiAgICAgICAgICAgIGlmIChzdWZmaXggJiYgc3VmZml4LnN0YXJ0c1dpdGgoJ3snICsgQkxPQ0tfUExBQ0VIT0xERVIpKSB7XG4gICAgICAgICAgICAgIGNvbnRlbnQgPSBpbnB1dFdpdGhFc2NhcGVkQmxvY2tzLmJsb2Nrc1tuZXh0QmxvY2tJbmRleCsrXTtcbiAgICAgICAgICAgICAgc3VmZml4ID0gc3VmZml4LnN1YnN0cmluZyhCTE9DS19QTEFDRUhPTERFUi5sZW5ndGggKyAxKTtcbiAgICAgICAgICAgICAgY29udGVudFByZWZpeCA9ICd7JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJ1bGUgPSBydWxlQ2FsbGJhY2sobmV3IENzc1J1bGUoc2VsZWN0b3IsIGNvbnRlbnQpKTtcbiAgICAgICAgICAgIHJldHVybiBgJHttWzFdfSR7cnVsZS5zZWxlY3Rvcn0ke21bM119JHtjb250ZW50UHJlZml4fSR7cnVsZS5jb250ZW50fSR7c3VmZml4fWA7XG4gICAgICAgICAgfSlcbiAgICAgIC5yZXBsYWNlKF9xdW90ZWRSZSwgKCkgPT4gaW5wdXRXaXRoRXNjYXBlZFF1b3Rlcy5ibG9ja3NbbmV4dFF1b3RlSW5kZXgrK10pO1xufVxuXG5jbGFzcyBTdHJpbmdXaXRoRXNjYXBlZEJsb2NrcyB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlc2NhcGVkU3RyaW5nOiBzdHJpbmcsIHB1YmxpYyBibG9ja3M6IHN0cmluZ1tdKSB7fVxufVxuXG5mdW5jdGlvbiBlc2NhcGVCbG9ja3MoXG4gICAgaW5wdXQ6IHN0cmluZywgY2hhclBhaXJzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LCBwbGFjZWhvbGRlcjogc3RyaW5nKTogU3RyaW5nV2l0aEVzY2FwZWRCbG9ja3Mge1xuICBjb25zdCByZXN1bHRQYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXNjYXBlZEJsb2Nrczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IG9wZW5DaGFyQ291bnQgPSAwO1xuICBsZXQgbm9uQmxvY2tTdGFydEluZGV4ID0gMDtcbiAgbGV0IGJsb2NrU3RhcnRJbmRleCA9IC0xO1xuICBsZXQgb3BlbkNoYXI6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBjbG9zZUNoYXI6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaGFyID0gaW5wdXRbaV07XG4gICAgaWYgKGNoYXIgPT09ICdcXFxcJykge1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gY2xvc2VDaGFyKSB7XG4gICAgICBvcGVuQ2hhckNvdW50LS07XG4gICAgICBpZiAob3BlbkNoYXJDb3VudCA9PT0gMCkge1xuICAgICAgICBlc2NhcGVkQmxvY2tzLnB1c2goaW5wdXQuc3Vic3RyaW5nKGJsb2NrU3RhcnRJbmRleCwgaSkpO1xuICAgICAgICByZXN1bHRQYXJ0cy5wdXNoKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgbm9uQmxvY2tTdGFydEluZGV4ID0gaTtcbiAgICAgICAgYmxvY2tTdGFydEluZGV4ID0gLTE7XG4gICAgICAgIG9wZW5DaGFyID0gY2xvc2VDaGFyID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gb3BlbkNoYXIpIHtcbiAgICAgIG9wZW5DaGFyQ291bnQrKztcbiAgICB9IGVsc2UgaWYgKG9wZW5DaGFyQ291bnQgPT09IDAgJiYgY2hhclBhaXJzLmhhcyhjaGFyKSkge1xuICAgICAgb3BlbkNoYXIgPSBjaGFyO1xuICAgICAgY2xvc2VDaGFyID0gY2hhclBhaXJzLmdldChjaGFyKTtcbiAgICAgIG9wZW5DaGFyQ291bnQgPSAxO1xuICAgICAgYmxvY2tTdGFydEluZGV4ID0gaSArIDE7XG4gICAgICByZXN1bHRQYXJ0cy5wdXNoKGlucHV0LnN1YnN0cmluZyhub25CbG9ja1N0YXJ0SW5kZXgsIGJsb2NrU3RhcnRJbmRleCkpO1xuICAgIH1cbiAgfVxuICBpZiAoYmxvY2tTdGFydEluZGV4ICE9PSAtMSkge1xuICAgIGVzY2FwZWRCbG9ja3MucHVzaChpbnB1dC5zdWJzdHJpbmcoYmxvY2tTdGFydEluZGV4KSk7XG4gICAgcmVzdWx0UGFydHMucHVzaChwbGFjZWhvbGRlcik7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0UGFydHMucHVzaChpbnB1dC5zdWJzdHJpbmcobm9uQmxvY2tTdGFydEluZGV4KSk7XG4gIH1cbiAgcmV0dXJuIG5ldyBTdHJpbmdXaXRoRXNjYXBlZEJsb2NrcyhyZXN1bHRQYXJ0cy5qb2luKCcnKSwgZXNjYXBlZEJsb2Nrcyk7XG59XG5cbi8qKlxuICogQ29tYmluZSB0aGUgYGNvbnRleHRTZWxlY3RvcnNgIHdpdGggdGhlIGBob3N0TWFya2VyYCBhbmQgdGhlIGBvdGhlclNlbGVjdG9yc2BcbiAqIHRvIGNyZWF0ZSBhIHNlbGVjdG9yIHRoYXQgbWF0Y2hlcyB0aGUgc2FtZSBhcyBgOmhvc3QtY29udGV4dCgpYC5cbiAqXG4gKiBHaXZlbiBhIHNpbmdsZSBjb250ZXh0IHNlbGVjdG9yIGBBYCB3ZSBuZWVkIHRvIG91dHB1dCBzZWxlY3RvcnMgdGhhdCBtYXRjaCBvbiB0aGUgaG9zdCBhbmQgYXMgYW5cbiAqIGFuY2VzdG9yIG9mIHRoZSBob3N0OlxuICpcbiAqIGBgYFxuICogQSA8aG9zdE1hcmtlcj4sIEE8aG9zdE1hcmtlcj4ge31cbiAqIGBgYFxuICpcbiAqIFdoZW4gdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBjb250ZXh0IHNlbGVjdG9yIHdlIGFsc28gaGF2ZSB0byBjcmVhdGUgY29tYmluYXRpb25zIG9mIHRob3NlXG4gKiBzZWxlY3RvcnMgd2l0aCBlYWNoIG90aGVyLiBGb3IgZXhhbXBsZSBpZiB0aGVyZSBhcmUgYEFgIGFuZCBgQmAgc2VsZWN0b3JzIHRoZSBvdXRwdXQgaXM6XG4gKlxuICogYGBgXG4gKiBBQjxob3N0TWFya2VyPiwgQUIgPGhvc3RNYXJrZXI+LCBBIEI8aG9zdE1hcmtlcj4sXG4gKiBCIEE8aG9zdE1hcmtlcj4sIEEgQiA8aG9zdE1hcmtlcj4sIEIgQSA8aG9zdE1hcmtlcj4ge31cbiAqIGBgYFxuICpcbiAqIEFuZCBzbyBvbi4uLlxuICpcbiAqIEBwYXJhbSBob3N0TWFya2VyIHRoZSBzdHJpbmcgdGhhdCBzZWxlY3RzIHRoZSBob3N0IGVsZW1lbnQuXG4gKiBAcGFyYW0gY29udGV4dFNlbGVjdG9ycyBhbiBhcnJheSBvZiBjb250ZXh0IHNlbGVjdG9ycyB0aGF0IHdpbGwgYmUgY29tYmluZWQuXG4gKiBAcGFyYW0gb3RoZXJTZWxlY3RvcnMgdGhlIHJlc3Qgb2YgdGhlIHNlbGVjdG9ycyB0aGF0IGFyZSBub3QgY29udGV4dCBzZWxlY3RvcnMuXG4gKi9cbmZ1bmN0aW9uIGNvbWJpbmVIb3N0Q29udGV4dFNlbGVjdG9ycyhjb250ZXh0U2VsZWN0b3JzOiBzdHJpbmdbXSwgb3RoZXJTZWxlY3RvcnM6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGhvc3RNYXJrZXIgPSBfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yO1xuICBfcG9seWZpbGxIb3N0UmUubGFzdEluZGV4ID0gMDsgIC8vIHJlc2V0IHRoZSByZWdleCB0byBlbnN1cmUgd2UgZ2V0IGFuIGFjY3VyYXRlIHRlc3RcbiAgY29uc3Qgb3RoZXJTZWxlY3RvcnNIYXNIb3N0ID0gX3BvbHlmaWxsSG9zdFJlLnRlc3Qob3RoZXJTZWxlY3RvcnMpO1xuXG4gIC8vIElmIHRoZXJlIGFyZSBubyBjb250ZXh0IHNlbGVjdG9ycyB0aGVuIGp1c3Qgb3V0cHV0IGEgaG9zdCBtYXJrZXJcbiAgaWYgKGNvbnRleHRTZWxlY3RvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGhvc3RNYXJrZXIgKyBvdGhlclNlbGVjdG9ycztcbiAgfVxuXG4gIGNvbnN0IGNvbWJpbmVkOiBzdHJpbmdbXSA9IFtjb250ZXh0U2VsZWN0b3JzLnBvcCgpIHx8ICcnXTtcbiAgd2hpbGUgKGNvbnRleHRTZWxlY3RvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGxlbmd0aCA9IGNvbWJpbmVkLmxlbmd0aDtcbiAgICBjb25zdCBjb250ZXh0U2VsZWN0b3IgPSBjb250ZXh0U2VsZWN0b3JzLnBvcCgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzU2VsZWN0b3JzID0gY29tYmluZWRbaV07XG4gICAgICAvLyBBZGQgdGhlIG5ldyBzZWxlY3RvciBhcyBhIGRlc2NlbmRhbnQgb2YgdGhlIHByZXZpb3VzIHNlbGVjdG9yc1xuICAgICAgY29tYmluZWRbbGVuZ3RoICogMiArIGldID0gcHJldmlvdXNTZWxlY3RvcnMgKyAnICcgKyBjb250ZXh0U2VsZWN0b3I7XG4gICAgICAvLyBBZGQgdGhlIG5ldyBzZWxlY3RvciBhcyBhbiBhbmNlc3RvciBvZiB0aGUgcHJldmlvdXMgc2VsZWN0b3JzXG4gICAgICBjb21iaW5lZFtsZW5ndGggKyBpXSA9IGNvbnRleHRTZWxlY3RvciArICcgJyArIHByZXZpb3VzU2VsZWN0b3JzO1xuICAgICAgLy8gQWRkIHRoZSBuZXcgc2VsZWN0b3IgdG8gYWN0IG9uIHRoZSBzYW1lIGVsZW1lbnQgYXMgdGhlIHByZXZpb3VzIHNlbGVjdG9yc1xuICAgICAgY29tYmluZWRbaV0gPSBjb250ZXh0U2VsZWN0b3IgKyBwcmV2aW91c1NlbGVjdG9ycztcbiAgICB9XG4gIH1cbiAgLy8gRmluYWxseSBjb25uZWN0IHRoZSBzZWxlY3RvciB0byB0aGUgYGhvc3RNYXJrZXJgczogZWl0aGVyIGFjdGluZyBkaXJlY3RseSBvbiB0aGUgaG9zdFxuICAvLyAoQTxob3N0TWFya2VyPikgb3IgYXMgYW4gYW5jZXN0b3IgKEEgPGhvc3RNYXJrZXI+KS5cbiAgcmV0dXJuIGNvbWJpbmVkXG4gICAgICAubWFwKFxuICAgICAgICAgIHMgPT4gb3RoZXJTZWxlY3RvcnNIYXNIb3N0ID9cbiAgICAgICAgICAgICAgYCR7c30ke290aGVyU2VsZWN0b3JzfWAgOlxuICAgICAgICAgICAgICBgJHtzfSR7aG9zdE1hcmtlcn0ke290aGVyU2VsZWN0b3JzfSwgJHtzfSAke2hvc3RNYXJrZXJ9JHtvdGhlclNlbGVjdG9yc31gKVxuICAgICAgLmpvaW4oJywnKTtcbn1cblxuLyoqXG4gKiBNdXRhdGUgdGhlIGdpdmVuIGBncm91cHNgIGFycmF5IHNvIHRoYXQgdGhlcmUgYXJlIGBtdWx0aXBsZXNgIGNsb25lcyBvZiB0aGUgb3JpZ2luYWwgYXJyYXlcbiAqIHN0b3JlZC5cbiAqXG4gKiBGb3IgZXhhbXBsZSBgcmVwZWF0R3JvdXBzKFthLCBiXSwgMylgIHdpbGwgcmVzdWx0IGluIGBbYSwgYiwgYSwgYiwgYSwgYl1gIC0gYnV0IGltcG9ydGFudGx5IHRoZVxuICogbmV3bHkgYWRkZWQgZ3JvdXBzIHdpbGwgYmUgY2xvbmVzIG9mIHRoZSBvcmlnaW5hbC5cbiAqXG4gKiBAcGFyYW0gZ3JvdXBzIEFuIGFycmF5IG9mIGdyb3VwcyBvZiBzdHJpbmdzIHRoYXQgd2lsbCBiZSByZXBlYXRlZC4gVGhpcyBhcnJheSBpcyBtdXRhdGVkXG4gKiAgICAgaW4tcGxhY2UuXG4gKiBAcGFyYW0gbXVsdGlwbGVzIFRoZSBudW1iZXIgb2YgdGltZXMgdGhlIGN1cnJlbnQgZ3JvdXBzIHNob3VsZCBhcHBlYXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXBlYXRHcm91cHMoZ3JvdXBzOiBzdHJpbmdbXVtdLCBtdWx0aXBsZXM6IG51bWJlcik6IHZvaWQge1xuICBjb25zdCBsZW5ndGggPSBncm91cHMubGVuZ3RoO1xuICBmb3IgKGxldCBpID0gMTsgaSA8IG11bHRpcGxlczsgaSsrKSB7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW5ndGg7IGorKykge1xuICAgICAgZ3JvdXBzW2ogKyAoaSAqIGxlbmd0aCldID0gZ3JvdXBzW2pdLnNsaWNlKDApO1xuICAgIH1cbiAgfVxufVxuIl19