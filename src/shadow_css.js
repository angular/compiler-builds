/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
            return tslib_1.__spread([scopedCssText], commentsWithHash).join('\n');
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
            return this._convertColonRule(cssText, _cssColonHostRe, this._colonHostPartReplacer);
        };
        /*
         * convert a rule like :host-context(.foo) > .bar { }
         *
         * to
         *
         * .foo<scopeName> > .bar, .foo scopeName > .bar { }
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
            return this._convertColonRule(cssText, _cssColonHostContextRe, this._colonHostContextPartReplacer);
        };
        ShadowCss.prototype._convertColonRule = function (cssText, regExp, partReplacer) {
            // m[1] = :host(-context), m[2] = contents of (), m[3] rest of rule
            return cssText.replace(regExp, function () {
                var m = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    m[_i] = arguments[_i];
                }
                if (m[2]) {
                    var parts = m[2].split(',');
                    var r = [];
                    for (var i = 0; i < parts.length; i++) {
                        var p = parts[i].trim();
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
        };
        ShadowCss.prototype._colonHostContextPartReplacer = function (host, part, suffix) {
            if (part.indexOf(_polyfillHost) > -1) {
                return this._colonHostPartReplacer(host, part, suffix);
            }
            else {
                return host + part + suffix + ', ' + part + ' ' + host + suffix;
            }
        };
        ShadowCss.prototype._colonHostPartReplacer = function (host, part, suffix) {
            return host + part.replace(_polyfillHost, '') + suffix;
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
                if (rule.selector[0] != '@') {
                    selector =
                        _this._scopeSelector(rule.selector, scopeSelector, hostSelector, _this.strictStyling);
                }
                else if (rule.selector.startsWith('@media') || rule.selector.startsWith('@supports') ||
                    rule.selector.startsWith('@page') || rule.selector.startsWith('@document')) {
                    content = _this._scopeSelectors(rule.content, scopeSelector, hostSelector);
                }
                return new CssRule(selector, content);
            });
        };
        ShadowCss.prototype._scopeSelector = function (selector, scopeSelector, hostSelector, strict) {
            var _this = this;
            return selector.split(',')
                .map(function (part) { return part.trim().split(_shadowDeepSelectors); })
                .map(function (deepParts) {
                var _a = tslib_1.__read(deepParts), shallowPart = _a[0], otherParts = _a.slice(1);
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
                return tslib_1.__spread([applyScope(shallowPart)], otherParts).join(' ');
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
            selector = selector.replace(/(\[[^\]]*\])/g, function (_, keep) {
                var replaceBy = "__ph-" + _this.index + "__";
                _this.placeholders.push(keep);
                _this.index++;
                return replaceBy;
            });
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
            return content.replace(/__ph-(\d+)__/g, function (ph, index) { return _this.placeholders[+index]; });
        };
        SafeSelector.prototype.content = function () { return this._content; };
        return SafeSelector;
    }());
    var _cssContentNextSelectorRe = /polyfill-next-selector[^}]*content:[\s]*?(['"])(.*?)\1[;\s]*}([^{]*?){/gim;
    var _cssContentRuleRe = /(polyfill-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
    var _cssContentUnscopedRuleRe = /(polyfill-unscoped-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
    var _polyfillHost = '-shadowcsshost';
    // note: :host-context pre-processed to -shadowcsshostcontext.
    var _polyfillHostContext = '-shadowcsscontext';
    var _parenSuffix = ')(?:\\((' +
        '(?:\\([^)(]*\\)|[^)(]*)+?' +
        ')\\))?([^,{]*)';
    var _cssColonHostRe = new RegExp('(' + _polyfillHost + _parenSuffix, 'gim');
    var _cssColonHostContextRe = new RegExp('(' + _polyfillHostContext + _parenSuffix, 'gim');
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
    var _selectorReSuffix = '([>\\s~+\[.,{:][\\s\\S]*)?$';
    var _polyfillHostRe = /-shadowcsshost/gim;
    var _colonHostRe = /:host/gim;
    var _colonHostContextRe = /:host-context/gim;
    var _commentRe = /\/\*\s*[\s\S]*?\*\//g;
    function stripComments(input) {
        return input.replace(_commentRe, '');
    }
    var _commentWithHashRe = /\/\*\s*#\s*source(Mapping)?URL=[\s\S]+?\*\//g;
    function extractCommentsWithHash(input) {
        return input.match(_commentWithHashRe) || [];
    }
    var _ruleRe = /(\s*)([^;\{\}]+?)(\s*)((?:{%BLOCK%}?\s*;?)|(?:\s*;))/g;
    var _curlyRe = /([{}])/g;
    var OPEN_CURLY = '{';
    var CLOSE_CURLY = '}';
    var BLOCK_PLACEHOLDER = '%BLOCK%';
    var CssRule = /** @class */ (function () {
        function CssRule(selector, content) {
            this.selector = selector;
            this.content = content;
        }
        return CssRule;
    }());
    exports.CssRule = CssRule;
    function processRules(input, ruleCallback) {
        var inputWithEscapedBlocks = escapeBlocks(input);
        var nextBlockIndex = 0;
        return inputWithEscapedBlocks.escapedString.replace(_ruleRe, function () {
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
        });
    }
    exports.processRules = processRules;
    var StringWithEscapedBlocks = /** @class */ (function () {
        function StringWithEscapedBlocks(escapedString, blocks) {
            this.escapedString = escapedString;
            this.blocks = blocks;
        }
        return StringWithEscapedBlocks;
    }());
    function escapeBlocks(input) {
        var inputParts = input.split(_curlyRe);
        var resultParts = [];
        var escapedBlocks = [];
        var bracketCount = 0;
        var currentBlockParts = [];
        for (var partIndex = 0; partIndex < inputParts.length; partIndex++) {
            var part = inputParts[partIndex];
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93X2Nzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zaGFkb3dfY3NzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVIOzs7Ozs7Ozs7T0FTRztJQUVIOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztNQWlIRTtJQUVGO1FBR0U7WUFGQSxrQkFBYSxHQUFZLElBQUksQ0FBQztRQUVmLENBQUM7UUFFaEI7Ozs7Ozs7V0FPRztRQUNILCtCQUFXLEdBQVgsVUFBWSxPQUFlLEVBQUUsUUFBZ0IsRUFBRSxZQUF5QjtZQUF6Qiw2QkFBQSxFQUFBLGlCQUF5QjtZQUN0RSxJQUFNLGdCQUFnQixHQUFHLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFELE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakMsT0FBTyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUUxQyxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDMUUsT0FBTyxrQkFBQyxhQUFhLEdBQUssZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFFTyxxQ0FBaUIsR0FBekIsVUFBMEIsT0FBZTtZQUN2QyxPQUFPLEdBQUcsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzNELE9BQU8sSUFBSSxDQUFDLDZCQUE2QixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFFRDs7Ozs7Ozs7Ozs7OztZ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dCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qKlxuICogVGhpcyBmaWxlIGlzIGEgcG9ydCBvZiBzaGFkb3dDU1MgZnJvbSB3ZWJjb21wb25lbnRzLmpzIHRvIFR5cGVTY3JpcHQuXG4gKlxuICogUGxlYXNlIG1ha2Ugc3VyZSB0byBrZWVwIHRvIGVkaXRzIGluIHN5bmMgd2l0aCB0aGUgc291cmNlIGZpbGUuXG4gKlxuICogU291cmNlOlxuICogaHR0cHM6Ly9naXRodWIuY29tL3dlYmNvbXBvbmVudHMvd2ViY29tcG9uZW50c2pzL2Jsb2IvNGVmZWNkN2UwZS9zcmMvU2hhZG93Q1NTL1NoYWRvd0NTUy5qc1xuICpcbiAqIFRoZSBvcmlnaW5hbCBmaWxlIGxldmVsIGNvbW1lbnQgaXMgcmVwcm9kdWNlZCBiZWxvd1xuICovXG5cbi8qXG4gIFRoaXMgaXMgYSBsaW1pdGVkIHNoaW0gZm9yIFNoYWRvd0RPTSBjc3Mgc3R5bGluZy5cbiAgaHR0cHM6Ly9kdmNzLnczLm9yZy9oZy93ZWJjb21wb25lbnRzL3Jhdy1maWxlL3RpcC9zcGVjL3NoYWRvdy9pbmRleC5odG1sI3N0eWxlc1xuXG4gIFRoZSBpbnRlbnRpb24gaGVyZSBpcyB0byBzdXBwb3J0IG9ubHkgdGhlIHN0eWxpbmcgZmVhdHVyZXMgd2hpY2ggY2FuIGJlXG4gIHJlbGF0aXZlbHkgc2ltcGx5IGltcGxlbWVudGVkLiBUaGUgZ29hbCBpcyB0byBhbGxvdyB1c2VycyB0byBhdm9pZCB0aGVcbiAgbW9zdCBvYnZpb3VzIHBpdGZhbGxzIGFuZCBkbyBzbyB3aXRob3V0IGNvbXByb21pc2luZyBwZXJmb3JtYW5jZSBzaWduaWZpY2FudGx5LlxuICBGb3IgU2hhZG93RE9NIHN0eWxpbmcgdGhhdCdzIG5vdCBjb3ZlcmVkIGhlcmUsIGEgc2V0IG9mIGJlc3QgcHJhY3RpY2VzXG4gIGNhbiBiZSBwcm92aWRlZCB0aGF0IHNob3VsZCBhbGxvdyB1c2VycyB0byBhY2NvbXBsaXNoIG1vcmUgY29tcGxleCBzdHlsaW5nLlxuXG4gIFRoZSBmb2xsb3dpbmcgaXMgYSBsaXN0IG9mIHNwZWNpZmljIFNoYWRvd0RPTSBzdHlsaW5nIGZlYXR1cmVzIGFuZCBhIGJyaWVmXG4gIGRpc2N1c3Npb24gb2YgdGhlIGFwcHJvYWNoIHVzZWQgdG8gc2hpbS5cblxuICBTaGltbWVkIGZlYXR1cmVzOlxuXG4gICogOmhvc3QsIDpob3N0LWNvbnRleHQ6IFNoYWRvd0RPTSBhbGxvd3Mgc3R5bGluZyBvZiB0aGUgc2hhZG93Um9vdCdzIGhvc3RcbiAgZWxlbWVudCB1c2luZyB0aGUgOmhvc3QgcnVsZS4gVG8gc2hpbSB0aGlzIGZlYXR1cmUsIHRoZSA6aG9zdCBzdHlsZXMgYXJlXG4gIHJlZm9ybWF0dGVkIGFuZCBwcmVmaXhlZCB3aXRoIGEgZ2l2ZW4gc2NvcGUgbmFtZSBhbmQgcHJvbW90ZWQgdG8gYVxuICBkb2N1bWVudCBsZXZlbCBzdHlsZXNoZWV0LlxuICBGb3IgZXhhbXBsZSwgZ2l2ZW4gYSBzY29wZSBuYW1lIG9mIC5mb28sIGEgcnVsZSBsaWtlIHRoaXM6XG5cbiAgICA6aG9zdCB7XG4gICAgICAgIGJhY2tncm91bmQ6IHJlZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgYmVjb21lczpcblxuICAgIC5mb28ge1xuICAgICAgYmFja2dyb3VuZDogcmVkO1xuICAgIH1cblxuICAqIGVuY2Fwc3VsYXRpb246IFN0eWxlcyBkZWZpbmVkIHdpdGhpbiBTaGFkb3dET00sIGFwcGx5IG9ubHkgdG9cbiAgZG9tIGluc2lkZSB0aGUgU2hhZG93RE9NLiBQb2x5bWVyIHVzZXMgb25lIG9mIHR3byB0ZWNobmlxdWVzIHRvIGltcGxlbWVudFxuICB0aGlzIGZlYXR1cmUuXG5cbiAgQnkgZGVmYXVsdCwgcnVsZXMgYXJlIHByZWZpeGVkIHdpdGggdGhlIGhvc3QgZWxlbWVudCB0YWcgbmFtZVxuICBhcyBhIGRlc2NlbmRhbnQgc2VsZWN0b3IuIFRoaXMgZW5zdXJlcyBzdHlsaW5nIGRvZXMgbm90IGxlYWsgb3V0IG9mIHRoZSAndG9wJ1xuICBvZiB0aGUgZWxlbWVudCdzIFNoYWRvd0RPTS4gRm9yIGV4YW1wbGUsXG5cbiAgZGl2IHtcbiAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgIH1cblxuICBiZWNvbWVzOlxuXG4gIHgtZm9vIGRpdiB7XG4gICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICB9XG5cbiAgYmVjb21lczpcblxuXG4gIEFsdGVybmF0aXZlbHksIGlmIFdlYkNvbXBvbmVudHMuU2hhZG93Q1NTLnN0cmljdFN0eWxpbmcgaXMgc2V0IHRvIHRydWUgdGhlblxuICBzZWxlY3RvcnMgYXJlIHNjb3BlZCBieSBhZGRpbmcgYW4gYXR0cmlidXRlIHNlbGVjdG9yIHN1ZmZpeCB0byBlYWNoXG4gIHNpbXBsZSBzZWxlY3RvciB0aGF0IGNvbnRhaW5zIHRoZSBob3N0IGVsZW1lbnQgdGFnIG5hbWUuIEVhY2ggZWxlbWVudFxuICBpbiB0aGUgZWxlbWVudCdzIFNoYWRvd0RPTSB0ZW1wbGF0ZSBpcyBhbHNvIGdpdmVuIHRoZSBzY29wZSBhdHRyaWJ1dGUuXG4gIFRodXMsIHRoZXNlIHJ1bGVzIG1hdGNoIG9ubHkgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBzY29wZSBhdHRyaWJ1dGUuXG4gIEZvciBleGFtcGxlLCBnaXZlbiBhIHNjb3BlIG5hbWUgb2YgeC1mb28sIGEgcnVsZSBsaWtlIHRoaXM6XG5cbiAgICBkaXYge1xuICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgfVxuXG4gIGJlY29tZXM6XG5cbiAgICBkaXZbeC1mb29dIHtcbiAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgIH1cblxuICBOb3RlIHRoYXQgZWxlbWVudHMgdGhhdCBhcmUgZHluYW1pY2FsbHkgYWRkZWQgdG8gYSBzY29wZSBtdXN0IGhhdmUgdGhlIHNjb3BlXG4gIHNlbGVjdG9yIGFkZGVkIHRvIHRoZW0gbWFudWFsbHkuXG5cbiAgKiB1cHBlci9sb3dlciBib3VuZCBlbmNhcHN1bGF0aW9uOiBTdHlsZXMgd2hpY2ggYXJlIGRlZmluZWQgb3V0c2lkZSBhXG4gIHNoYWRvd1Jvb3Qgc2hvdWxkIG5vdCBjcm9zcyB0aGUgU2hhZG93RE9NIGJvdW5kYXJ5IGFuZCBzaG91bGQgbm90IGFwcGx5XG4gIGluc2lkZSBhIHNoYWRvd1Jvb3QuXG5cbiAgVGhpcyBzdHlsaW5nIGJlaGF2aW9yIGlzIG5vdCBlbXVsYXRlZC4gU29tZSBwb3NzaWJsZSB3YXlzIHRvIGRvIHRoaXMgdGhhdFxuICB3ZXJlIHJlamVjdGVkIGR1ZSB0byBjb21wbGV4aXR5IGFuZC9vciBwZXJmb3JtYW5jZSBjb25jZXJucyBpbmNsdWRlOiAoMSkgcmVzZXRcbiAgZXZlcnkgcG9zc2libGUgcHJvcGVydHkgZm9yIGV2ZXJ5IHBvc3NpYmxlIHNlbGVjdG9yIGZvciBhIGdpdmVuIHNjb3BlIG5hbWU7XG4gICgyKSByZS1pbXBsZW1lbnQgY3NzIGluIGphdmFzY3JpcHQuXG5cbiAgQXMgYW4gYWx0ZXJuYXRpdmUsIHVzZXJzIHNob3VsZCBtYWtlIHN1cmUgdG8gdXNlIHNlbGVjdG9yc1xuICBzcGVjaWZpYyB0byB0aGUgc2NvcGUgaW4gd2hpY2ggdGhleSBhcmUgd29ya2luZy5cblxuICAqIDo6ZGlzdHJpYnV0ZWQ6IFRoaXMgYmVoYXZpb3IgaXMgbm90IGVtdWxhdGVkLiBJdCdzIG9mdGVuIG5vdCBuZWNlc3NhcnlcbiAgdG8gc3R5bGUgdGhlIGNvbnRlbnRzIG9mIGEgc3BlY2lmaWMgaW5zZXJ0aW9uIHBvaW50IGFuZCBpbnN0ZWFkLCBkZXNjZW5kYW50c1xuICBvZiB0aGUgaG9zdCBlbGVtZW50IGNhbiBiZSBzdHlsZWQgc2VsZWN0aXZlbHkuIFVzZXJzIGNhbiBhbHNvIGNyZWF0ZSBhblxuICBleHRyYSBub2RlIGFyb3VuZCBhbiBpbnNlcnRpb24gcG9pbnQgYW5kIHN0eWxlIHRoYXQgbm9kZSdzIGNvbnRlbnRzXG4gIHZpYSBkZXNjZW5kZW50IHNlbGVjdG9ycy4gRm9yIGV4YW1wbGUsIHdpdGggYSBzaGFkb3dSb290IGxpa2UgdGhpczpcblxuICAgIDxzdHlsZT5cbiAgICAgIDo6Y29udGVudChkaXYpIHtcbiAgICAgICAgYmFja2dyb3VuZDogcmVkO1xuICAgICAgfVxuICAgIDwvc3R5bGU+XG4gICAgPGNvbnRlbnQ+PC9jb250ZW50PlxuXG4gIGNvdWxkIGJlY29tZTpcblxuICAgIDxzdHlsZT5cbiAgICAgIC8gKkBwb2x5ZmlsbCAuY29udGVudC1jb250YWluZXIgZGl2ICogL1xuICAgICAgOjpjb250ZW50KGRpdikge1xuICAgICAgICBiYWNrZ3JvdW5kOiByZWQ7XG4gICAgICB9XG4gICAgPC9zdHlsZT5cbiAgICA8ZGl2IGNsYXNzPVwiY29udGVudC1jb250YWluZXJcIj5cbiAgICAgIDxjb250ZW50PjwvY29udGVudD5cbiAgICA8L2Rpdj5cblxuICBOb3RlIHRoZSB1c2Ugb2YgQHBvbHlmaWxsIGluIHRoZSBjb21tZW50IGFib3ZlIGEgU2hhZG93RE9NIHNwZWNpZmljIHN0eWxlXG4gIGRlY2xhcmF0aW9uLiBUaGlzIGlzIGEgZGlyZWN0aXZlIHRvIHRoZSBzdHlsaW5nIHNoaW0gdG8gdXNlIHRoZSBzZWxlY3RvclxuICBpbiBjb21tZW50cyBpbiBsaWV1IG9mIHRoZSBuZXh0IHNlbGVjdG9yIHdoZW4gcnVubmluZyB1bmRlciBwb2x5ZmlsbC5cbiovXG5cbmV4cG9ydCBjbGFzcyBTaGFkb3dDc3Mge1xuICBzdHJpY3RTdHlsaW5nOiBib29sZWFuID0gdHJ1ZTtcblxuICBjb25zdHJ1Y3RvcigpIHt9XG5cbiAgLypcbiAgICogU2hpbSBzb21lIGNzc1RleHQgd2l0aCB0aGUgZ2l2ZW4gc2VsZWN0b3IuIFJldHVybnMgY3NzVGV4dCB0aGF0IGNhblxuICAgKiBiZSBpbmNsdWRlZCBpbiB0aGUgZG9jdW1lbnQgdmlhIFdlYkNvbXBvbmVudHMuU2hhZG93Q1NTLmFkZENzc1RvRG9jdW1lbnQoY3NzKS5cbiAgICpcbiAgICogV2hlbiBzdHJpY3RTdHlsaW5nIGlzIHRydWU6XG4gICAqIC0gc2VsZWN0b3IgaXMgdGhlIGF0dHJpYnV0ZSBhZGRlZCB0byBhbGwgZWxlbWVudHMgaW5zaWRlIHRoZSBob3N0LFxuICAgKiAtIGhvc3RTZWxlY3RvciBpcyB0aGUgYXR0cmlidXRlIGFkZGVkIHRvIHRoZSBob3N0IGl0c2VsZi5cbiAgICovXG4gIHNoaW1Dc3NUZXh0KGNzc1RleHQ6IHN0cmluZywgc2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcgPSAnJyk6IHN0cmluZyB7XG4gICAgY29uc3QgY29tbWVudHNXaXRoSGFzaCA9IGV4dHJhY3RDb21tZW50c1dpdGhIYXNoKGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSBzdHJpcENvbW1lbnRzKGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9pbnNlcnREaXJlY3RpdmVzKGNzc1RleHQpO1xuXG4gICAgY29uc3Qgc2NvcGVkQ3NzVGV4dCA9IHRoaXMuX3Njb3BlQ3NzVGV4dChjc3NUZXh0LCBzZWxlY3RvciwgaG9zdFNlbGVjdG9yKTtcbiAgICByZXR1cm4gW3Njb3BlZENzc1RleHQsIC4uLmNvbW1lbnRzV2l0aEhhc2hdLmpvaW4oJ1xcbicpO1xuICB9XG5cbiAgcHJpdmF0ZSBfaW5zZXJ0RGlyZWN0aXZlcyhjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNzc1RleHQgPSB0aGlzLl9pbnNlcnRQb2x5ZmlsbERpcmVjdGl2ZXNJbkNzc1RleHQoY3NzVGV4dCk7XG4gICAgcmV0dXJuIHRoaXMuX2luc2VydFBvbHlmaWxsUnVsZXNJbkNzc1RleHQoY3NzVGV4dCk7XG4gIH1cblxuICAvKlxuICAgKiBQcm9jZXNzIHN0eWxlcyB0byBjb252ZXJ0IG5hdGl2ZSBTaGFkb3dET00gcnVsZXMgdGhhdCB3aWxsIHRyaXBcbiAgICogdXAgdGhlIGNzcyBwYXJzZXI7IHdlIHJlbHkgb24gZGVjb3JhdGluZyB0aGUgc3R5bGVzaGVldCB3aXRoIGluZXJ0IHJ1bGVzLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSwgd2UgY29udmVydCB0aGlzIHJ1bGU6XG4gICAqXG4gICAqIHBvbHlmaWxsLW5leHQtc2VsZWN0b3IgeyBjb250ZW50OiAnOmhvc3QgbWVudS1pdGVtJzsgfVxuICAgKiA6OmNvbnRlbnQgbWVudS1pdGVtIHtcbiAgICpcbiAgICogdG8gdGhpczpcbiAgICpcbiAgICogc2NvcGVOYW1lIG1lbnUtaXRlbSB7XG4gICAqXG4gICAqKi9cbiAgcHJpdmF0ZSBfaW5zZXJ0UG9seWZpbGxEaXJlY3RpdmVzSW5Dc3NUZXh0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8gRGlmZmVyZW5jZSB3aXRoIHdlYmNvbXBvbmVudHMuanM6IGRvZXMgbm90IGhhbmRsZSBjb21tZW50c1xuICAgIHJldHVybiBjc3NUZXh0LnJlcGxhY2UoXG4gICAgICAgIF9jc3NDb250ZW50TmV4dFNlbGVjdG9yUmUsIGZ1bmN0aW9uKC4uLm06IHN0cmluZ1tdKSB7IHJldHVybiBtWzJdICsgJ3snOyB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBydWxlcyB3aGljaCB3aWxsIG9ubHkgYXBwbHkgdW5kZXIgdGhlIHBvbHlmaWxsXG4gICAqXG4gICAqIEZvciBleGFtcGxlLCB3ZSBjb252ZXJ0IHRoaXMgcnVsZTpcbiAgICpcbiAgICogcG9seWZpbGwtcnVsZSB7XG4gICAqICAgY29udGVudDogJzpob3N0IG1lbnUtaXRlbSc7XG4gICAqIC4uLlxuICAgKiB9XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIHNjb3BlTmFtZSBtZW51LWl0ZW0gey4uLn1cbiAgICpcbiAgICoqL1xuICBwcml2YXRlIF9pbnNlcnRQb2x5ZmlsbFJ1bGVzSW5Dc3NUZXh0KGNzc1RleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8gRGlmZmVyZW5jZSB3aXRoIHdlYmNvbXBvbmVudHMuanM6IGRvZXMgbm90IGhhbmRsZSBjb21tZW50c1xuICAgIHJldHVybiBjc3NUZXh0LnJlcGxhY2UoX2Nzc0NvbnRlbnRSdWxlUmUsICguLi5tOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgY29uc3QgcnVsZSA9IG1bMF0ucmVwbGFjZShtWzFdLCAnJykucmVwbGFjZShtWzJdLCAnJyk7XG4gICAgICByZXR1cm4gbVs0XSArIHJ1bGU7XG4gICAgfSk7XG4gIH1cblxuICAvKiBFbnN1cmUgc3R5bGVzIGFyZSBzY29wZWQuIFBzZXVkby1zY29waW5nIHRha2VzIGEgcnVsZSBsaWtlOlxuICAgKlxuICAgKiAgLmZvbyB7Li4uIH1cbiAgICpcbiAgICogIGFuZCBjb252ZXJ0cyB0aGlzIHRvXG4gICAqXG4gICAqICBzY29wZU5hbWUgLmZvbyB7IC4uLiB9XG4gICAqL1xuICBwcml2YXRlIF9zY29wZUNzc1RleHQoY3NzVGV4dDogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB1bnNjb3BlZFJ1bGVzID0gdGhpcy5fZXh0cmFjdFVuc2NvcGVkUnVsZXNGcm9tQ3NzVGV4dChjc3NUZXh0KTtcbiAgICAvLyByZXBsYWNlIDpob3N0IGFuZCA6aG9zdC1jb250ZXh0IC1zaGFkb3djc3Nob3N0IGFuZCAtc2hhZG93Y3NzaG9zdCByZXNwZWN0aXZlbHlcbiAgICBjc3NUZXh0ID0gdGhpcy5faW5zZXJ0UG9seWZpbGxIb3N0SW5Dc3NUZXh0KGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9jb252ZXJ0Q29sb25Ib3N0KGNzc1RleHQpO1xuICAgIGNzc1RleHQgPSB0aGlzLl9jb252ZXJ0Q29sb25Ib3N0Q29udGV4dChjc3NUZXh0KTtcbiAgICBjc3NUZXh0ID0gdGhpcy5fY29udmVydFNoYWRvd0RPTVNlbGVjdG9ycyhjc3NUZXh0KTtcbiAgICBpZiAoc2NvcGVTZWxlY3Rvcikge1xuICAgICAgY3NzVGV4dCA9IHRoaXMuX3Njb3BlU2VsZWN0b3JzKGNzc1RleHQsIHNjb3BlU2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gICAgfVxuICAgIGNzc1RleHQgPSBjc3NUZXh0ICsgJ1xcbicgKyB1bnNjb3BlZFJ1bGVzO1xuICAgIHJldHVybiBjc3NUZXh0LnRyaW0oKTtcbiAgfVxuXG4gIC8qXG4gICAqIFByb2Nlc3Mgc3R5bGVzIHRvIGFkZCBydWxlcyB3aGljaCB3aWxsIG9ubHkgYXBwbHkgdW5kZXIgdGhlIHBvbHlmaWxsXG4gICAqIGFuZCBkbyBub3QgcHJvY2VzcyB2aWEgQ1NTT00uIChDU1NPTSBpcyBkZXN0cnVjdGl2ZSB0byBydWxlcyBvbiByYXJlXG4gICAqIG9jY2FzaW9ucywgZS5nLiAtd2Via2l0LWNhbGMgb24gU2FmYXJpLilcbiAgICogRm9yIGV4YW1wbGUsIHdlIGNvbnZlcnQgdGhpcyBydWxlOlxuICAgKlxuICAgKiBAcG9seWZpbGwtdW5zY29wZWQtcnVsZSB7XG4gICAqICAgY29udGVudDogJ21lbnUtaXRlbSc7XG4gICAqIC4uLiB9XG4gICAqXG4gICAqIHRvIHRoaXM6XG4gICAqXG4gICAqIG1lbnUtaXRlbSB7Li4ufVxuICAgKlxuICAgKiovXG4gIHByaXZhdGUgX2V4dHJhY3RVbnNjb3BlZFJ1bGVzRnJvbUNzc1RleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBEaWZmZXJlbmNlIHdpdGggd2ViY29tcG9uZW50cy5qczogZG9lcyBub3QgaGFuZGxlIGNvbW1lbnRzXG4gICAgbGV0IHIgPSAnJztcbiAgICBsZXQgbTogUmVnRXhwRXhlY0FycmF5fG51bGw7XG4gICAgX2Nzc0NvbnRlbnRVbnNjb3BlZFJ1bGVSZS5sYXN0SW5kZXggPSAwO1xuICAgIHdoaWxlICgobSA9IF9jc3NDb250ZW50VW5zY29wZWRSdWxlUmUuZXhlYyhjc3NUZXh0KSkgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHJ1bGUgPSBtWzBdLnJlcGxhY2UobVsyXSwgJycpLnJlcGxhY2UobVsxXSwgbVs0XSk7XG4gICAgICByICs9IHJ1bGUgKyAnXFxuXFxuJztcbiAgICB9XG4gICAgcmV0dXJuIHI7XG4gIH1cblxuICAvKlxuICAgKiBjb252ZXJ0IGEgcnVsZSBsaWtlIDpob3N0KC5mb28pID4gLmJhciB7IH1cbiAgICpcbiAgICogdG9cbiAgICpcbiAgICogLmZvbzxzY29wZU5hbWU+ID4gLmJhclxuICAgKi9cbiAgcHJpdmF0ZSBfY29udmVydENvbG9uSG9zdChjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9jb252ZXJ0Q29sb25SdWxlKGNzc1RleHQsIF9jc3NDb2xvbkhvc3RSZSwgdGhpcy5fY29sb25Ib3N0UGFydFJlcGxhY2VyKTtcbiAgfVxuXG4gIC8qXG4gICAqIGNvbnZlcnQgYSBydWxlIGxpa2UgOmhvc3QtY29udGV4dCguZm9vKSA+IC5iYXIgeyB9XG4gICAqXG4gICAqIHRvXG4gICAqXG4gICAqIC5mb288c2NvcGVOYW1lPiA+IC5iYXIsIC5mb28gc2NvcGVOYW1lID4gLmJhciB7IH1cbiAgICpcbiAgICogYW5kXG4gICAqXG4gICAqIDpob3N0LWNvbnRleHQoLmZvbzpob3N0KSAuYmFyIHsgLi4uIH1cbiAgICpcbiAgICogdG9cbiAgICpcbiAgICogLmZvbzxzY29wZU5hbWU+IC5iYXIgeyAuLi4gfVxuICAgKi9cbiAgcHJpdmF0ZSBfY29udmVydENvbG9uSG9zdENvbnRleHQoY3NzVGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fY29udmVydENvbG9uUnVsZShcbiAgICAgICAgY3NzVGV4dCwgX2Nzc0NvbG9uSG9zdENvbnRleHRSZSwgdGhpcy5fY29sb25Ib3N0Q29udGV4dFBhcnRSZXBsYWNlcik7XG4gIH1cblxuICBwcml2YXRlIF9jb252ZXJ0Q29sb25SdWxlKGNzc1RleHQ6IHN0cmluZywgcmVnRXhwOiBSZWdFeHAsIHBhcnRSZXBsYWNlcjogRnVuY3Rpb24pOiBzdHJpbmcge1xuICAgIC8vIG1bMV0gPSA6aG9zdCgtY29udGV4dCksIG1bMl0gPSBjb250ZW50cyBvZiAoKSwgbVszXSByZXN0IG9mIHJ1bGVcbiAgICByZXR1cm4gY3NzVGV4dC5yZXBsYWNlKHJlZ0V4cCwgZnVuY3Rpb24oLi4ubTogc3RyaW5nW10pIHtcbiAgICAgIGlmIChtWzJdKSB7XG4gICAgICAgIGNvbnN0IHBhcnRzID0gbVsyXS5zcGxpdCgnLCcpO1xuICAgICAgICBjb25zdCByOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgcCA9IHBhcnRzW2ldLnRyaW0oKTtcbiAgICAgICAgICBpZiAoIXApIGJyZWFrO1xuICAgICAgICAgIHIucHVzaChwYXJ0UmVwbGFjZXIoX3BvbHlmaWxsSG9zdE5vQ29tYmluYXRvciwgcCwgbVszXSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByLmpvaW4oJywnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yICsgbVszXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbG9uSG9zdENvbnRleHRQYXJ0UmVwbGFjZXIoaG9zdDogc3RyaW5nLCBwYXJ0OiBzdHJpbmcsIHN1ZmZpeDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAocGFydC5pbmRleE9mKF9wb2x5ZmlsbEhvc3QpID4gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jb2xvbkhvc3RQYXJ0UmVwbGFjZXIoaG9zdCwgcGFydCwgc3VmZml4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGhvc3QgKyBwYXJ0ICsgc3VmZml4ICsgJywgJyArIHBhcnQgKyAnICcgKyBob3N0ICsgc3VmZml4O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbG9uSG9zdFBhcnRSZXBsYWNlcihob3N0OiBzdHJpbmcsIHBhcnQ6IHN0cmluZywgc3VmZml4OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBob3N0ICsgcGFydC5yZXBsYWNlKF9wb2x5ZmlsbEhvc3QsICcnKSArIHN1ZmZpeDtcbiAgfVxuXG4gIC8qXG4gICAqIENvbnZlcnQgY29tYmluYXRvcnMgbGlrZSA6OnNoYWRvdyBhbmQgcHNldWRvLWVsZW1lbnRzIGxpa2UgOjpjb250ZW50XG4gICAqIGJ5IHJlcGxhY2luZyB3aXRoIHNwYWNlLlxuICAgKi9cbiAgcHJpdmF0ZSBfY29udmVydFNoYWRvd0RPTVNlbGVjdG9ycyhjc3NUZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBfc2hhZG93RE9NU2VsZWN0b3JzUmUucmVkdWNlKChyZXN1bHQsIHBhdHRlcm4pID0+IHJlc3VsdC5yZXBsYWNlKHBhdHRlcm4sICcgJyksIGNzc1RleHQpO1xuICB9XG5cbiAgLy8gY2hhbmdlIGEgc2VsZWN0b3IgbGlrZSAnZGl2JyB0byAnbmFtZSBkaXYnXG4gIHByaXZhdGUgX3Njb3BlU2VsZWN0b3JzKGNzc1RleHQ6IHN0cmluZywgc2NvcGVTZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHByb2Nlc3NSdWxlcyhjc3NUZXh0LCAocnVsZTogQ3NzUnVsZSkgPT4ge1xuICAgICAgbGV0IHNlbGVjdG9yID0gcnVsZS5zZWxlY3RvcjtcbiAgICAgIGxldCBjb250ZW50ID0gcnVsZS5jb250ZW50O1xuICAgICAgaWYgKHJ1bGUuc2VsZWN0b3JbMF0gIT0gJ0AnKSB7XG4gICAgICAgIHNlbGVjdG9yID1cbiAgICAgICAgICAgIHRoaXMuX3Njb3BlU2VsZWN0b3IocnVsZS5zZWxlY3Rvciwgc2NvcGVTZWxlY3RvciwgaG9zdFNlbGVjdG9yLCB0aGlzLnN0cmljdFN0eWxpbmcpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICBydWxlLnNlbGVjdG9yLnN0YXJ0c1dpdGgoJ0BtZWRpYScpIHx8IHJ1bGUuc2VsZWN0b3Iuc3RhcnRzV2l0aCgnQHN1cHBvcnRzJykgfHxcbiAgICAgICAgICBydWxlLnNlbGVjdG9yLnN0YXJ0c1dpdGgoJ0BwYWdlJykgfHwgcnVsZS5zZWxlY3Rvci5zdGFydHNXaXRoKCdAZG9jdW1lbnQnKSkge1xuICAgICAgICBjb250ZW50ID0gdGhpcy5fc2NvcGVTZWxlY3RvcnMocnVsZS5jb250ZW50LCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBDc3NSdWxlKHNlbGVjdG9yLCBjb250ZW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX3Njb3BlU2VsZWN0b3IoXG4gICAgICBzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nLCBzdHJpY3Q6IGJvb2xlYW4pOiBzdHJpbmcge1xuICAgIHJldHVybiBzZWxlY3Rvci5zcGxpdCgnLCcpXG4gICAgICAgIC5tYXAocGFydCA9PiBwYXJ0LnRyaW0oKS5zcGxpdChfc2hhZG93RGVlcFNlbGVjdG9ycykpXG4gICAgICAgIC5tYXAoKGRlZXBQYXJ0cykgPT4ge1xuICAgICAgICAgIGNvbnN0IFtzaGFsbG93UGFydCwgLi4ub3RoZXJQYXJ0c10gPSBkZWVwUGFydHM7XG4gICAgICAgICAgY29uc3QgYXBwbHlTY29wZSA9IChzaGFsbG93UGFydDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2VsZWN0b3JOZWVkc1Njb3Bpbmcoc2hhbGxvd1BhcnQsIHNjb3BlU2VsZWN0b3IpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzdHJpY3QgP1xuICAgICAgICAgICAgICAgICAgdGhpcy5fYXBwbHlTdHJpY3RTZWxlY3RvclNjb3BlKHNoYWxsb3dQYXJ0LCBzY29wZVNlbGVjdG9yLCBob3N0U2VsZWN0b3IpIDpcbiAgICAgICAgICAgICAgICAgIHRoaXMuX2FwcGx5U2VsZWN0b3JTY29wZShzaGFsbG93UGFydCwgc2NvcGVTZWxlY3RvciwgaG9zdFNlbGVjdG9yKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBzaGFsbG93UGFydDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIHJldHVybiBbYXBwbHlTY29wZShzaGFsbG93UGFydCksIC4uLm90aGVyUGFydHNdLmpvaW4oJyAnKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmpvaW4oJywgJyk7XG4gIH1cblxuICBwcml2YXRlIF9zZWxlY3Rvck5lZWRzU2NvcGluZyhzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCByZSA9IHRoaXMuX21ha2VTY29wZU1hdGNoZXIoc2NvcGVTZWxlY3Rvcik7XG4gICAgcmV0dXJuICFyZS50ZXN0KHNlbGVjdG9yKTtcbiAgfVxuXG4gIHByaXZhdGUgX21ha2VTY29wZU1hdGNoZXIoc2NvcGVTZWxlY3Rvcjogc3RyaW5nKTogUmVnRXhwIHtcbiAgICBjb25zdCBscmUgPSAvXFxbL2c7XG4gICAgY29uc3QgcnJlID0gL1xcXS9nO1xuICAgIHNjb3BlU2VsZWN0b3IgPSBzY29wZVNlbGVjdG9yLnJlcGxhY2UobHJlLCAnXFxcXFsnKS5yZXBsYWNlKHJyZSwgJ1xcXFxdJyk7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoJ14oJyArIHNjb3BlU2VsZWN0b3IgKyAnKScgKyBfc2VsZWN0b3JSZVN1ZmZpeCwgJ20nKTtcbiAgfVxuXG4gIHByaXZhdGUgX2FwcGx5U2VsZWN0b3JTY29wZShzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTpcbiAgICAgIHN0cmluZyB7XG4gICAgLy8gRGlmZmVyZW5jZSBmcm9tIHdlYmNvbXBvbmVudHMuanM6IHNjb3BlU2VsZWN0b3IgY291bGQgbm90IGJlIGFuIGFycmF5XG4gICAgcmV0dXJuIHRoaXMuX2FwcGx5U2ltcGxlU2VsZWN0b3JTY29wZShzZWxlY3Rvciwgc2NvcGVTZWxlY3RvciwgaG9zdFNlbGVjdG9yKTtcbiAgfVxuXG4gIC8vIHNjb3BlIHZpYSBuYW1lIGFuZCBbaXM9bmFtZV1cbiAgcHJpdmF0ZSBfYXBwbHlTaW1wbGVTZWxlY3RvclNjb3BlKHNlbGVjdG9yOiBzdHJpbmcsIHNjb3BlU2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOlxuICAgICAgc3RyaW5nIHtcbiAgICAvLyBJbiBBbmRyb2lkIGJyb3dzZXIsIHRoZSBsYXN0SW5kZXggaXMgbm90IHJlc2V0IHdoZW4gdGhlIHJlZ2V4IGlzIHVzZWQgaW4gU3RyaW5nLnJlcGxhY2UoKVxuICAgIF9wb2x5ZmlsbEhvc3RSZS5sYXN0SW5kZXggPSAwO1xuICAgIGlmIChfcG9seWZpbGxIb3N0UmUudGVzdChzZWxlY3RvcikpIHtcbiAgICAgIGNvbnN0IHJlcGxhY2VCeSA9IHRoaXMuc3RyaWN0U3R5bGluZyA/IGBbJHtob3N0U2VsZWN0b3J9XWAgOiBzY29wZVNlbGVjdG9yO1xuICAgICAgcmV0dXJuIHNlbGVjdG9yXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAgIF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3JSZSxcbiAgICAgICAgICAgICAgKGhuYywgc2VsZWN0b3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZWN0b3IucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgLyhbXjpdKikoOiopKC4qKS8sXG4gICAgICAgICAgICAgICAgICAgIChfOiBzdHJpbmcsIGJlZm9yZTogc3RyaW5nLCBjb2xvbjogc3RyaW5nLCBhZnRlcjogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJlZm9yZSArIHJlcGxhY2VCeSArIGNvbG9uICsgYWZ0ZXI7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgIC5yZXBsYWNlKF9wb2x5ZmlsbEhvc3RSZSwgcmVwbGFjZUJ5ICsgJyAnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2NvcGVTZWxlY3RvciArICcgJyArIHNlbGVjdG9yO1xuICB9XG5cbiAgLy8gcmV0dXJuIGEgc2VsZWN0b3Igd2l0aCBbbmFtZV0gc3VmZml4IG9uIGVhY2ggc2ltcGxlIHNlbGVjdG9yXG4gIC8vIGUuZy4gLmZvby5iYXIgPiAuem90IGJlY29tZXMgLmZvb1tuYW1lXS5iYXJbbmFtZV0gPiAuem90W25hbWVdICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2FwcGx5U3RyaWN0U2VsZWN0b3JTY29wZShzZWxlY3Rvcjogc3RyaW5nLCBzY29wZVNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTpcbiAgICAgIHN0cmluZyB7XG4gICAgY29uc3QgaXNSZSA9IC9cXFtpcz0oW15cXF1dKilcXF0vZztcbiAgICBzY29wZVNlbGVjdG9yID0gc2NvcGVTZWxlY3Rvci5yZXBsYWNlKGlzUmUsIChfOiBzdHJpbmcsIC4uLnBhcnRzOiBzdHJpbmdbXSkgPT4gcGFydHNbMF0pO1xuXG4gICAgY29uc3QgYXR0ck5hbWUgPSAnWycgKyBzY29wZVNlbGVjdG9yICsgJ10nO1xuXG4gICAgY29uc3QgX3Njb3BlU2VsZWN0b3JQYXJ0ID0gKHA6IHN0cmluZykgPT4ge1xuICAgICAgbGV0IHNjb3BlZFAgPSBwLnRyaW0oKTtcblxuICAgICAgaWYgKCFzY29wZWRQKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICAgIH1cblxuICAgICAgaWYgKHAuaW5kZXhPZihfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yKSA+IC0xKSB7XG4gICAgICAgIHNjb3BlZFAgPSB0aGlzLl9hcHBseVNpbXBsZVNlbGVjdG9yU2NvcGUocCwgc2NvcGVTZWxlY3RvciwgaG9zdFNlbGVjdG9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHJlbW92ZSA6aG9zdCBzaW5jZSBpdCBzaG91bGQgYmUgdW5uZWNlc3NhcnlcbiAgICAgICAgY29uc3QgdCA9IHAucmVwbGFjZShfcG9seWZpbGxIb3N0UmUsICcnKTtcbiAgICAgICAgaWYgKHQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSB0Lm1hdGNoKC8oW146XSopKDoqKSguKikvKTtcbiAgICAgICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICAgICAgc2NvcGVkUCA9IG1hdGNoZXNbMV0gKyBhdHRyTmFtZSArIG1hdGNoZXNbMl0gKyBtYXRjaGVzWzNdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2NvcGVkUDtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2FmZUNvbnRlbnQgPSBuZXcgU2FmZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICBzZWxlY3RvciA9IHNhZmVDb250ZW50LmNvbnRlbnQoKTtcblxuICAgIGxldCBzY29wZWRTZWxlY3RvciA9ICcnO1xuICAgIGxldCBzdGFydEluZGV4ID0gMDtcbiAgICBsZXQgcmVzOiBSZWdFeHBFeGVjQXJyYXl8bnVsbDtcbiAgICBjb25zdCBzZXAgPSAvKCB8PnxcXCt8fig/IT0pKVxccyovZztcblxuICAgIC8vIElmIGEgc2VsZWN0b3IgYXBwZWFycyBiZWZvcmUgOmhvc3QgaXQgc2hvdWxkIG5vdCBiZSBzaGltbWVkIGFzIGl0XG4gICAgLy8gbWF0Y2hlcyBvbiBhbmNlc3RvciBlbGVtZW50cyBhbmQgbm90IG9uIGVsZW1lbnRzIGluIHRoZSBob3N0J3Mgc2hhZG93XG4gICAgLy8gYDpob3N0LWNvbnRleHQoZGl2KWAgaXMgdHJhbnNmb3JtZWQgdG9cbiAgICAvLyBgLXNoYWRvd2Nzc2hvc3Qtbm8tY29tYmluYXRvcmRpdiwgZGl2IC1zaGFkb3djc3Nob3N0LW5vLWNvbWJpbmF0b3JgXG4gICAgLy8gdGhlIGBkaXZgIGlzIG5vdCBwYXJ0IG9mIHRoZSBjb21wb25lbnQgaW4gdGhlIDJuZCBzZWxlY3RvcnMgYW5kIHNob3VsZCBub3QgYmUgc2NvcGVkLlxuICAgIC8vIEhpc3RvcmljYWxseSBgY29tcG9uZW50LXRhZzpob3N0YCB3YXMgbWF0Y2hpbmcgdGhlIGNvbXBvbmVudCBzbyB3ZSBhbHNvIHdhbnQgdG8gcHJlc2VydmVcbiAgICAvLyB0aGlzIGJlaGF2aW9yIHRvIGF2b2lkIGJyZWFraW5nIGxlZ2FjeSBhcHBzIChpdCBzaG91bGQgbm90IG1hdGNoKS5cbiAgICAvLyBUaGUgYmVoYXZpb3Igc2hvdWxkIGJlOlxuICAgIC8vIC0gYHRhZzpob3N0YCAtPiBgdGFnW2hdYCAodGhpcyBpcyB0byBhdm9pZCBicmVha2luZyBsZWdhY3kgYXBwcywgc2hvdWxkIG5vdCBtYXRjaCBhbnl0aGluZylcbiAgICAvLyAtIGB0YWcgOmhvc3RgIC0+IGB0YWcgW2hdYCAoYHRhZ2AgaXMgbm90IHNjb3BlZCBiZWNhdXNlIGl0J3MgY29uc2lkZXJlZCBwYXJ0IG9mIGFcbiAgICAvLyAgIGA6aG9zdC1jb250ZXh0KHRhZylgKVxuICAgIGNvbnN0IGhhc0hvc3QgPSBzZWxlY3Rvci5pbmRleE9mKF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IpID4gLTE7XG4gICAgLy8gT25seSBzY29wZSBwYXJ0cyBhZnRlciB0aGUgZmlyc3QgYC1zaGFkb3djc3Nob3N0LW5vLWNvbWJpbmF0b3JgIHdoZW4gaXQgaXMgcHJlc2VudFxuICAgIGxldCBzaG91bGRTY29wZSA9ICFoYXNIb3N0O1xuXG4gICAgd2hpbGUgKChyZXMgPSBzZXAuZXhlYyhzZWxlY3RvcikpICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBzZXBhcmF0b3IgPSByZXNbMV07XG4gICAgICBjb25zdCBwYXJ0ID0gc2VsZWN0b3Iuc2xpY2Uoc3RhcnRJbmRleCwgcmVzLmluZGV4KS50cmltKCk7XG4gICAgICBzaG91bGRTY29wZSA9IHNob3VsZFNjb3BlIHx8IHBhcnQuaW5kZXhPZihfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yKSA+IC0xO1xuICAgICAgY29uc3Qgc2NvcGVkUGFydCA9IHNob3VsZFNjb3BlID8gX3Njb3BlU2VsZWN0b3JQYXJ0KHBhcnQpIDogcGFydDtcbiAgICAgIHNjb3BlZFNlbGVjdG9yICs9IGAke3Njb3BlZFBhcnR9ICR7c2VwYXJhdG9yfSBgO1xuICAgICAgc3RhcnRJbmRleCA9IHNlcC5sYXN0SW5kZXg7XG4gICAgfVxuXG4gICAgY29uc3QgcGFydCA9IHNlbGVjdG9yLnN1YnN0cmluZyhzdGFydEluZGV4KTtcbiAgICBzaG91bGRTY29wZSA9IHNob3VsZFNjb3BlIHx8IHBhcnQuaW5kZXhPZihfcG9seWZpbGxIb3N0Tm9Db21iaW5hdG9yKSA+IC0xO1xuICAgIHNjb3BlZFNlbGVjdG9yICs9IHNob3VsZFNjb3BlID8gX3Njb3BlU2VsZWN0b3JQYXJ0KHBhcnQpIDogcGFydDtcblxuICAgIC8vIHJlcGxhY2UgdGhlIHBsYWNlaG9sZGVycyB3aXRoIHRoZWlyIG9yaWdpbmFsIHZhbHVlc1xuICAgIHJldHVybiBzYWZlQ29udGVudC5yZXN0b3JlKHNjb3BlZFNlbGVjdG9yKTtcbiAgfVxuXG4gIHByaXZhdGUgX2luc2VydFBvbHlmaWxsSG9zdEluQ3NzVGV4dChzZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gc2VsZWN0b3IucmVwbGFjZShfY29sb25Ib3N0Q29udGV4dFJlLCBfcG9seWZpbGxIb3N0Q29udGV4dClcbiAgICAgICAgLnJlcGxhY2UoX2NvbG9uSG9zdFJlLCBfcG9seWZpbGxIb3N0KTtcbiAgfVxufVxuXG5jbGFzcyBTYWZlU2VsZWN0b3Ige1xuICBwcml2YXRlIHBsYWNlaG9sZGVyczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBpbmRleCA9IDA7XG4gIHByaXZhdGUgX2NvbnRlbnQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzZWxlY3Rvcjogc3RyaW5nKSB7XG4gICAgLy8gUmVwbGFjZXMgYXR0cmlidXRlIHNlbGVjdG9ycyB3aXRoIHBsYWNlaG9sZGVycy5cbiAgICAvLyBUaGUgV1MgaW4gW2F0dHI9XCJ2YSBsdWVcIl0gd291bGQgb3RoZXJ3aXNlIGJlIGludGVycHJldGVkIGFzIGEgc2VsZWN0b3Igc2VwYXJhdG9yLlxuICAgIHNlbGVjdG9yID0gc2VsZWN0b3IucmVwbGFjZSgvKFxcW1teXFxdXSpcXF0pL2csIChfLCBrZWVwKSA9PiB7XG4gICAgICBjb25zdCByZXBsYWNlQnkgPSBgX19waC0ke3RoaXMuaW5kZXh9X19gO1xuICAgICAgdGhpcy5wbGFjZWhvbGRlcnMucHVzaChrZWVwKTtcbiAgICAgIHRoaXMuaW5kZXgrKztcbiAgICAgIHJldHVybiByZXBsYWNlQnk7XG4gICAgfSk7XG5cbiAgICAvLyBSZXBsYWNlcyB0aGUgZXhwcmVzc2lvbiBpbiBgOm50aC1jaGlsZCgybiArIDEpYCB3aXRoIGEgcGxhY2Vob2xkZXIuXG4gICAgLy8gV1MgYW5kIFwiK1wiIHdvdWxkIG90aGVyd2lzZSBiZSBpbnRlcnByZXRlZCBhcyBzZWxlY3RvciBzZXBhcmF0b3JzLlxuICAgIHRoaXMuX2NvbnRlbnQgPSBzZWxlY3Rvci5yZXBsYWNlKC8oOm50aC1bLVxcd10rKShcXChbXildK1xcKSkvZywgKF8sIHBzZXVkbywgZXhwKSA9PiB7XG4gICAgICBjb25zdCByZXBsYWNlQnkgPSBgX19waC0ke3RoaXMuaW5kZXh9X19gO1xuICAgICAgdGhpcy5wbGFjZWhvbGRlcnMucHVzaChleHApO1xuICAgICAgdGhpcy5pbmRleCsrO1xuICAgICAgcmV0dXJuIHBzZXVkbyArIHJlcGxhY2VCeTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlc3RvcmUoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY29udGVudC5yZXBsYWNlKC9fX3BoLShcXGQrKV9fL2csIChwaCwgaW5kZXgpID0+IHRoaXMucGxhY2Vob2xkZXJzWytpbmRleF0pO1xuICB9XG5cbiAgY29udGVudCgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5fY29udGVudDsgfVxufVxuXG5jb25zdCBfY3NzQ29udGVudE5leHRTZWxlY3RvclJlID1cbiAgICAvcG9seWZpbGwtbmV4dC1zZWxlY3RvcltefV0qY29udGVudDpbXFxzXSo/KFsnXCJdKSguKj8pXFwxWztcXHNdKn0oW157XSo/KXsvZ2ltO1xuY29uc3QgX2Nzc0NvbnRlbnRSdWxlUmUgPSAvKHBvbHlmaWxsLXJ1bGUpW159XSooY29udGVudDpbXFxzXSooWydcIl0pKC4qPylcXDMpWztcXHNdKltefV0qfS9naW07XG5jb25zdCBfY3NzQ29udGVudFVuc2NvcGVkUnVsZVJlID1cbiAgICAvKHBvbHlmaWxsLXVuc2NvcGVkLXJ1bGUpW159XSooY29udGVudDpbXFxzXSooWydcIl0pKC4qPylcXDMpWztcXHNdKltefV0qfS9naW07XG5jb25zdCBfcG9seWZpbGxIb3N0ID0gJy1zaGFkb3djc3Nob3N0Jztcbi8vIG5vdGU6IDpob3N0LWNvbnRleHQgcHJlLXByb2Nlc3NlZCB0byAtc2hhZG93Y3NzaG9zdGNvbnRleHQuXG5jb25zdCBfcG9seWZpbGxIb3N0Q29udGV4dCA9ICctc2hhZG93Y3NzY29udGV4dCc7XG5jb25zdCBfcGFyZW5TdWZmaXggPSAnKSg/OlxcXFwoKCcgK1xuICAgICcoPzpcXFxcKFteKShdKlxcXFwpfFteKShdKikrPycgK1xuICAgICcpXFxcXCkpPyhbXix7XSopJztcbmNvbnN0IF9jc3NDb2xvbkhvc3RSZSA9IG5ldyBSZWdFeHAoJygnICsgX3BvbHlmaWxsSG9zdCArIF9wYXJlblN1ZmZpeCwgJ2dpbScpO1xuY29uc3QgX2Nzc0NvbG9uSG9zdENvbnRleHRSZSA9IG5ldyBSZWdFeHAoJygnICsgX3BvbHlmaWxsSG9zdENvbnRleHQgKyBfcGFyZW5TdWZmaXgsICdnaW0nKTtcbmNvbnN0IF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3IgPSBfcG9seWZpbGxIb3N0ICsgJy1uby1jb21iaW5hdG9yJztcbmNvbnN0IF9wb2x5ZmlsbEhvc3ROb0NvbWJpbmF0b3JSZSA9IC8tc2hhZG93Y3NzaG9zdC1uby1jb21iaW5hdG9yKFteXFxzXSopLztcbmNvbnN0IF9zaGFkb3dET01TZWxlY3RvcnNSZSA9IFtcbiAgLzo6c2hhZG93L2csXG4gIC86OmNvbnRlbnQvZyxcbiAgLy8gRGVwcmVjYXRlZCBzZWxlY3RvcnNcbiAgL1xcL3NoYWRvdy1kZWVwXFwvL2csXG4gIC9cXC9zaGFkb3dcXC8vZyxcbl07XG5cbi8vIFRoZSBkZWVwIGNvbWJpbmF0b3IgaXMgZGVwcmVjYXRlZCBpbiB0aGUgQ1NTIHNwZWNcbi8vIFN1cHBvcnQgZm9yIGA+Pj5gLCBgZGVlcGAsIGA6Om5nLWRlZXBgIGlzIHRoZW4gYWxzbyBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gdGhlIGZ1dHVyZS5cbi8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL3B1bGwvMTc2NzdcbmNvbnN0IF9zaGFkb3dEZWVwU2VsZWN0b3JzID0gLyg/Oj4+Pil8KD86XFwvZGVlcFxcLyl8KD86OjpuZy1kZWVwKS9nO1xuY29uc3QgX3NlbGVjdG9yUmVTdWZmaXggPSAnKFs+XFxcXHN+K1xcWy4sezpdW1xcXFxzXFxcXFNdKik/JCc7XG5jb25zdCBfcG9seWZpbGxIb3N0UmUgPSAvLXNoYWRvd2Nzc2hvc3QvZ2ltO1xuY29uc3QgX2NvbG9uSG9zdFJlID0gLzpob3N0L2dpbTtcbmNvbnN0IF9jb2xvbkhvc3RDb250ZXh0UmUgPSAvOmhvc3QtY29udGV4dC9naW07XG5cbmNvbnN0IF9jb21tZW50UmUgPSAvXFwvXFwqXFxzKltcXHNcXFNdKj9cXCpcXC8vZztcblxuZnVuY3Rpb24gc3RyaXBDb21tZW50cyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlucHV0LnJlcGxhY2UoX2NvbW1lbnRSZSwgJycpO1xufVxuXG5jb25zdCBfY29tbWVudFdpdGhIYXNoUmUgPSAvXFwvXFwqXFxzKiNcXHMqc291cmNlKE1hcHBpbmcpP1VSTD1bXFxzXFxTXSs/XFwqXFwvL2c7XG5cbmZ1bmN0aW9uIGV4dHJhY3RDb21tZW50c1dpdGhIYXNoKGlucHV0OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBpbnB1dC5tYXRjaChfY29tbWVudFdpdGhIYXNoUmUpIHx8IFtdO1xufVxuXG5jb25zdCBfcnVsZVJlID0gLyhcXHMqKShbXjtcXHtcXH1dKz8pKFxccyopKCg/OnslQkxPQ0slfT9cXHMqOz8pfCg/Olxccyo7KSkvZztcbmNvbnN0IF9jdXJseVJlID0gLyhbe31dKS9nO1xuY29uc3QgT1BFTl9DVVJMWSA9ICd7JztcbmNvbnN0IENMT1NFX0NVUkxZID0gJ30nO1xuY29uc3QgQkxPQ0tfUExBQ0VIT0xERVIgPSAnJUJMT0NLJSc7XG5cbmV4cG9ydCBjbGFzcyBDc3NSdWxlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHNlbGVjdG9yOiBzdHJpbmcsIHB1YmxpYyBjb250ZW50OiBzdHJpbmcpIHt9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm9jZXNzUnVsZXMoaW5wdXQ6IHN0cmluZywgcnVsZUNhbGxiYWNrOiAocnVsZTogQ3NzUnVsZSkgPT4gQ3NzUnVsZSk6IHN0cmluZyB7XG4gIGNvbnN0IGlucHV0V2l0aEVzY2FwZWRCbG9ja3MgPSBlc2NhcGVCbG9ja3MoaW5wdXQpO1xuICBsZXQgbmV4dEJsb2NrSW5kZXggPSAwO1xuICByZXR1cm4gaW5wdXRXaXRoRXNjYXBlZEJsb2Nrcy5lc2NhcGVkU3RyaW5nLnJlcGxhY2UoX3J1bGVSZSwgZnVuY3Rpb24oLi4ubTogc3RyaW5nW10pIHtcbiAgICBjb25zdCBzZWxlY3RvciA9IG1bMl07XG4gICAgbGV0IGNvbnRlbnQgPSAnJztcbiAgICBsZXQgc3VmZml4ID0gbVs0XTtcbiAgICBsZXQgY29udGVudFByZWZpeCA9ICcnO1xuICAgIGlmIChzdWZmaXggJiYgc3VmZml4LnN0YXJ0c1dpdGgoJ3snICsgQkxPQ0tfUExBQ0VIT0xERVIpKSB7XG4gICAgICBjb250ZW50ID0gaW5wdXRXaXRoRXNjYXBlZEJsb2Nrcy5ibG9ja3NbbmV4dEJsb2NrSW5kZXgrK107XG4gICAgICBzdWZmaXggPSBzdWZmaXguc3Vic3RyaW5nKEJMT0NLX1BMQUNFSE9MREVSLmxlbmd0aCArIDEpO1xuICAgICAgY29udGVudFByZWZpeCA9ICd7JztcbiAgICB9XG4gICAgY29uc3QgcnVsZSA9IHJ1bGVDYWxsYmFjayhuZXcgQ3NzUnVsZShzZWxlY3RvciwgY29udGVudCkpO1xuICAgIHJldHVybiBgJHttWzFdfSR7cnVsZS5zZWxlY3Rvcn0ke21bM119JHtjb250ZW50UHJlZml4fSR7cnVsZS5jb250ZW50fSR7c3VmZml4fWA7XG4gIH0pO1xufVxuXG5jbGFzcyBTdHJpbmdXaXRoRXNjYXBlZEJsb2NrcyB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlc2NhcGVkU3RyaW5nOiBzdHJpbmcsIHB1YmxpYyBibG9ja3M6IHN0cmluZ1tdKSB7fVxufVxuXG5mdW5jdGlvbiBlc2NhcGVCbG9ja3MoaW5wdXQ6IHN0cmluZyk6IFN0cmluZ1dpdGhFc2NhcGVkQmxvY2tzIHtcbiAgY29uc3QgaW5wdXRQYXJ0cyA9IGlucHV0LnNwbGl0KF9jdXJseVJlKTtcbiAgY29uc3QgcmVzdWx0UGFydHM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVzY2FwZWRCbG9ja3M6IHN0cmluZ1tdID0gW107XG4gIGxldCBicmFja2V0Q291bnQgPSAwO1xuICBsZXQgY3VycmVudEJsb2NrUGFydHM6IHN0cmluZ1tdID0gW107XG4gIGZvciAobGV0IHBhcnRJbmRleCA9IDA7IHBhcnRJbmRleCA8IGlucHV0UGFydHMubGVuZ3RoOyBwYXJ0SW5kZXgrKykge1xuICAgIGNvbnN0IHBhcnQgPSBpbnB1dFBhcnRzW3BhcnRJbmRleF07XG4gICAgaWYgKHBhcnQgPT0gQ0xPU0VfQ1VSTFkpIHtcbiAgICAgIGJyYWNrZXRDb3VudC0tO1xuICAgIH1cbiAgICBpZiAoYnJhY2tldENvdW50ID4gMCkge1xuICAgICAgY3VycmVudEJsb2NrUGFydHMucHVzaChwYXJ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGN1cnJlbnRCbG9ja1BhcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXNjYXBlZEJsb2Nrcy5wdXNoKGN1cnJlbnRCbG9ja1BhcnRzLmpvaW4oJycpKTtcbiAgICAgICAgcmVzdWx0UGFydHMucHVzaChCTE9DS19QTEFDRUhPTERFUik7XG4gICAgICAgIGN1cnJlbnRCbG9ja1BhcnRzID0gW107XG4gICAgICB9XG4gICAgICByZXN1bHRQYXJ0cy5wdXNoKHBhcnQpO1xuICAgIH1cbiAgICBpZiAocGFydCA9PSBPUEVOX0NVUkxZKSB7XG4gICAgICBicmFja2V0Q291bnQrKztcbiAgICB9XG4gIH1cbiAgaWYgKGN1cnJlbnRCbG9ja1BhcnRzLmxlbmd0aCA+IDApIHtcbiAgICBlc2NhcGVkQmxvY2tzLnB1c2goY3VycmVudEJsb2NrUGFydHMuam9pbignJykpO1xuICAgIHJlc3VsdFBhcnRzLnB1c2goQkxPQ0tfUExBQ0VIT0xERVIpO1xuICB9XG4gIHJldHVybiBuZXcgU3RyaW5nV2l0aEVzY2FwZWRCbG9ja3MocmVzdWx0UGFydHMuam9pbignJyksIGVzY2FwZWRCbG9ja3MpO1xufVxuIl19