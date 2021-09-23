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
        define("@angular/compiler/src/i18n/i18n_parser", ["require", "exports", "tslib", "@angular/compiler/src/expression_parser/lexer", "@angular/compiler/src/expression_parser/parser", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_tags", "@angular/compiler/src/parse_util", "@angular/compiler/src/i18n/i18n_ast", "@angular/compiler/src/i18n/serializers/placeholder"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createI18nMessageFactory = void 0;
    var tslib_1 = require("tslib");
    var lexer_1 = require("@angular/compiler/src/expression_parser/lexer");
    var parser_1 = require("@angular/compiler/src/expression_parser/parser");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var html_tags_1 = require("@angular/compiler/src/ml_parser/html_tags");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var i18n = require("@angular/compiler/src/i18n/i18n_ast");
    var placeholder_1 = require("@angular/compiler/src/i18n/serializers/placeholder");
    var _expParser = new parser_1.Parser(new lexer_1.Lexer());
    /**
     * Returns a function converting html nodes to an i18n Message given an interpolationConfig
     */
    function createI18nMessageFactory(interpolationConfig) {
        var visitor = new _I18nVisitor(_expParser, interpolationConfig);
        return function (nodes, meaning, description, customId, visitNodeFn) {
            return visitor.toI18nMessage(nodes, meaning, description, customId, visitNodeFn);
        };
    }
    exports.createI18nMessageFactory = createI18nMessageFactory;
    function noopVisitNodeFn(_html, i18n) {
        return i18n;
    }
    var _I18nVisitor = /** @class */ (function () {
        function _I18nVisitor(_expressionParser, _interpolationConfig) {
            this._expressionParser = _expressionParser;
            this._interpolationConfig = _interpolationConfig;
        }
        _I18nVisitor.prototype.toI18nMessage = function (nodes, meaning, description, customId, visitNodeFn) {
            if (meaning === void 0) { meaning = ''; }
            if (description === void 0) { description = ''; }
            if (customId === void 0) { customId = ''; }
            var context = {
                isIcu: nodes.length == 1 && nodes[0] instanceof html.Expansion,
                icuDepth: 0,
                placeholderRegistry: new placeholder_1.PlaceholderRegistry(),
                placeholderToContent: {},
                placeholderToMessage: {},
                visitNodeFn: visitNodeFn || noopVisitNodeFn,
            };
            var i18nodes = html.visitAll(this, nodes, context);
            return new i18n.Message(i18nodes, context.placeholderToContent, context.placeholderToMessage, meaning, description, customId);
        };
        _I18nVisitor.prototype.visitElement = function (el, context) {
            var _a;
            var children = html.visitAll(this, el.children, context);
            var attrs = {};
            el.attrs.forEach(function (attr) {
                // Do not visit the attributes, translatable ones are top-level ASTs
                attrs[attr.name] = attr.value;
            });
            var isVoid = (0, html_tags_1.getHtmlTagDefinition)(el.name).isVoid;
            var startPhName = context.placeholderRegistry.getStartTagPlaceholderName(el.name, attrs, isVoid);
            context.placeholderToContent[startPhName] = {
                text: el.startSourceSpan.toString(),
                sourceSpan: el.startSourceSpan,
            };
            var closePhName = '';
            if (!isVoid) {
                closePhName = context.placeholderRegistry.getCloseTagPlaceholderName(el.name);
                context.placeholderToContent[closePhName] = {
                    text: "</" + el.name + ">",
                    sourceSpan: (_a = el.endSourceSpan) !== null && _a !== void 0 ? _a : el.sourceSpan,
                };
            }
            var node = new i18n.TagPlaceholder(el.name, attrs, startPhName, closePhName, children, isVoid, el.sourceSpan, el.startSourceSpan, el.endSourceSpan);
            return context.visitNodeFn(el, node);
        };
        _I18nVisitor.prototype.visitAttribute = function (attribute, context) {
            var node = attribute.valueTokens === undefined || attribute.valueTokens.length === 1 ?
                new i18n.Text(attribute.value, attribute.valueSpan || attribute.sourceSpan) :
                this._visitTextWithInterpolation(attribute.valueTokens, attribute.valueSpan || attribute.sourceSpan, context, attribute.i18n);
            return context.visitNodeFn(attribute, node);
        };
        _I18nVisitor.prototype.visitText = function (text, context) {
            var node = text.tokens.length === 1 ?
                new i18n.Text(text.value, text.sourceSpan) :
                this._visitTextWithInterpolation(text.tokens, text.sourceSpan, context, text.i18n);
            return context.visitNodeFn(text, node);
        };
        _I18nVisitor.prototype.visitComment = function (comment, context) {
            return null;
        };
        _I18nVisitor.prototype.visitExpansion = function (icu, context) {
            var _this = this;
            context.icuDepth++;
            var i18nIcuCases = {};
            var i18nIcu = new i18n.Icu(icu.switchValue, icu.type, i18nIcuCases, icu.sourceSpan);
            icu.cases.forEach(function (caze) {
                i18nIcuCases[caze.value] = new i18n.Container(caze.expression.map(function (node) { return node.visit(_this, context); }), caze.expSourceSpan);
            });
            context.icuDepth--;
            if (context.isIcu || context.icuDepth > 0) {
                // Returns an ICU node when:
                // - the message (vs a part of the message) is an ICU message, or
                // - the ICU message is nested.
                var expPh = context.placeholderRegistry.getUniquePlaceholder("VAR_" + icu.type);
                i18nIcu.expressionPlaceholder = expPh;
                context.placeholderToContent[expPh] = {
                    text: icu.switchValue,
                    sourceSpan: icu.switchValueSourceSpan,
                };
                return context.visitNodeFn(icu, i18nIcu);
            }
            // Else returns a placeholder
            // ICU placeholders should not be replaced with their original content but with the their
            // translations.
            // TODO(vicb): add a html.Node -> i18n.Message cache to avoid having to re-create the msg
            var phName = context.placeholderRegistry.getPlaceholderName('ICU', icu.sourceSpan.toString());
            context.placeholderToMessage[phName] = this.toI18nMessage([icu], '', '', '', undefined);
            var node = new i18n.IcuPlaceholder(i18nIcu, phName, icu.sourceSpan);
            return context.visitNodeFn(icu, node);
        };
        _I18nVisitor.prototype.visitExpansionCase = function (_icuCase, _context) {
            throw new Error('Unreachable code');
        };
        /**
         * Convert, text and interpolated tokens up into text and placeholder pieces.
         *
         * @param tokens The text and interpolated tokens.
         * @param sourceSpan The span of the whole of the `text` string.
         * @param context The current context of the visitor, used to compute and store placeholders.
         * @param previousI18n Any i18n metadata associated with this `text` from a previous pass.
         */
        _I18nVisitor.prototype._visitTextWithInterpolation = function (tokens, sourceSpan, context, previousI18n) {
            var e_1, _a;
            // Return a sequence of `Text` and `Placeholder` nodes grouped in a `Container`.
            var nodes = [];
            // We will only create a container if there are actually interpolations,
            // so this flag tracks that.
            var hasInterpolation = false;
            try {
                for (var tokens_1 = (0, tslib_1.__values)(tokens), tokens_1_1 = tokens_1.next(); !tokens_1_1.done; tokens_1_1 = tokens_1.next()) {
                    var token = tokens_1_1.value;
                    switch (token.type) {
                        case 8 /* INTERPOLATION */:
                        case 17 /* ATTR_VALUE_INTERPOLATION */:
                            hasInterpolation = true;
                            var expression = token.parts[1];
                            var baseName = extractPlaceholderName(expression) || 'INTERPOLATION';
                            var phName = context.placeholderRegistry.getPlaceholderName(baseName, expression);
                            context.placeholderToContent[phName] = {
                                text: token.parts.join(''),
                                sourceSpan: token.sourceSpan
                            };
                            nodes.push(new i18n.Placeholder(expression, phName, token.sourceSpan));
                            break;
                        default:
                            if (token.parts[0].length > 0) {
                                // This token is text or an encoded entity.
                                // If it is following on from a previous text node then merge it into that node
                                // Otherwise, if it is following an interpolation, then add a new node.
                                var previous = nodes[nodes.length - 1];
                                if (previous instanceof i18n.Text) {
                                    previous.value += token.parts[0];
                                    previous.sourceSpan = new parse_util_1.ParseSourceSpan(previous.sourceSpan.start, token.sourceSpan.end, previous.sourceSpan.fullStart, previous.sourceSpan.details);
                                }
                                else {
                                    nodes.push(new i18n.Text(token.parts[0], token.sourceSpan));
                                }
                            }
                            break;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (tokens_1_1 && !tokens_1_1.done && (_a = tokens_1.return)) _a.call(tokens_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (hasInterpolation) {
                // Whitespace removal may have invalidated the interpolation source-spans.
                reusePreviousSourceSpans(nodes, previousI18n);
                return new i18n.Container(nodes, sourceSpan);
            }
            else {
                return nodes[0];
            }
        };
        return _I18nVisitor;
    }());
    /**
     * Re-use the source-spans from `previousI18n` metadata for the `nodes`.
     *
     * Whitespace removal can invalidate the source-spans of interpolation nodes, so we
     * reuse the source-span stored from a previous pass before the whitespace was removed.
     *
     * @param nodes The `Text` and `Placeholder` nodes to be processed.
     * @param previousI18n Any i18n metadata for these `nodes` stored from a previous pass.
     */
    function reusePreviousSourceSpans(nodes, previousI18n) {
        if (previousI18n instanceof i18n.Message) {
            // The `previousI18n` is an i18n `Message`, so we are processing an `Attribute` with i18n
            // metadata. The `Message` should consist only of a single `Container` that contains the
            // parts (`Text` and `Placeholder`) to process.
            assertSingleContainerMessage(previousI18n);
            previousI18n = previousI18n.nodes[0];
        }
        if (previousI18n instanceof i18n.Container) {
            // The `previousI18n` is a `Container`, which means that this is a second i18n extraction pass
            // after whitespace has been removed from the AST nodes.
            assertEquivalentNodes(previousI18n.children, nodes);
            // Reuse the source-spans from the first pass.
            for (var i = 0; i < nodes.length; i++) {
                nodes[i].sourceSpan = previousI18n.children[i].sourceSpan;
            }
        }
    }
    /**
     * Asserts that the `message` contains exactly one `Container` node.
     */
    function assertSingleContainerMessage(message) {
        var nodes = message.nodes;
        if (nodes.length !== 1 || !(nodes[0] instanceof i18n.Container)) {
            throw new Error('Unexpected previous i18n message - expected it to consist of only a single `Container` node.');
        }
    }
    /**
     * Asserts that the `previousNodes` and `node` collections have the same number of elements and
     * corresponding elements have the same node type.
     */
    function assertEquivalentNodes(previousNodes, nodes) {
        if (previousNodes.length !== nodes.length) {
            throw new Error('The number of i18n message children changed between first and second pass.');
        }
        if (previousNodes.some(function (node, i) { return nodes[i].constructor !== node.constructor; })) {
            throw new Error('The types of the i18n message children changed between first and second pass.');
        }
    }
    var _CUSTOM_PH_EXP = /\/\/[\s\S]*i18n[\s\S]*\([\s\S]*ph[\s\S]*=[\s\S]*("|')([\s\S]*?)\1[\s\S]*\)/g;
    function extractPlaceholderName(input) {
        return input.split(_CUSTOM_PH_EXP)[2];
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9pMThuX3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsdUVBQW9FO0lBQ3BFLHlFQUF1RTtJQUN2RSwwREFBeUM7SUFDekMsdUVBQTREO0lBRzVELCtEQUE4QztJQUU5QywwREFBbUM7SUFDbkMsa0ZBQThEO0lBRTlELElBQU0sVUFBVSxHQUFHLElBQUksZUFBZ0IsQ0FBQyxJQUFJLGFBQWUsRUFBRSxDQUFDLENBQUM7SUFTL0Q7O09BRUc7SUFDSCxTQUFnQix3QkFBd0IsQ0FBQyxtQkFBd0M7UUFFL0UsSUFBTSxPQUFPLEdBQUcsSUFBSSxZQUFZLENBQUMsVUFBVSxFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDbEUsT0FBTyxVQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxXQUFXO1lBQy9DLE9BQUEsT0FBTyxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDO1FBQXpFLENBQXlFLENBQUM7SUFDdkYsQ0FBQztJQUxELDREQUtDO0lBV0QsU0FBUyxlQUFlLENBQUMsS0FBZ0IsRUFBRSxJQUFlO1FBQ3hELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEO1FBQ0Usc0JBQ1ksaUJBQW1DLEVBQ25DLG9CQUF5QztZQUR6QyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQWtCO1lBQ25DLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBcUI7UUFBRyxDQUFDO1FBRWxELG9DQUFhLEdBQXBCLFVBQ0ksS0FBa0IsRUFBRSxPQUFZLEVBQUUsV0FBZ0IsRUFBRSxRQUFhLEVBQ2pFLFdBQWtDO1lBRGQsd0JBQUEsRUFBQSxZQUFZO1lBQUUsNEJBQUEs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QUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQy9ELE1BQU0sSUFBSSxLQUFLLENBQ1gsOEZBQThGLENBQUMsQ0FBQztTQUNyRztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLHFCQUFxQixDQUFDLGFBQTBCLEVBQUUsS0FBa0I7UUFDM0UsSUFBSSxhQUFhLENBQUMsTUFBTSxLQUFLLEtBQUssQ0FBQyxNQUFNLEVBQUU7WUFDekMsTUFBTSxJQUFJLEtBQUssQ0FBQyw0RUFBNEUsQ0FBQyxDQUFDO1NBQy9GO1FBQ0QsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQUMsSUFBSSxFQUFFLENBQUMsSUFBSyxPQUFBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEtBQUssSUFBSSxDQUFDLFdBQVcsRUFBekMsQ0FBeUMsQ0FBQyxFQUFFO1lBQzlFLE1BQU0sSUFBSSxLQUFLLENBQ1gsK0VBQStFLENBQUMsQ0FBQztTQUN0RjtJQUNILENBQUM7SUFFRCxJQUFNLGNBQWMsR0FDaEIsNkVBQTZFLENBQUM7SUFFbEYsU0FBUyxzQkFBc0IsQ0FBQyxLQUFhO1FBQzNDLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7TGV4ZXIgYXMgRXhwcmVzc2lvbkxleGVyfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlciBhcyBFeHByZXNzaW9uUGFyc2VyfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7Z2V0SHRtbFRhZ0RlZmluaXRpb259IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3RhZ3MnO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbiwgSW50ZXJwb2xhdGVkVGV4dFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4uL21sX3BhcnNlci90b2tlbnMnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4vaTE4bl9hc3QnO1xuaW1wb3J0IHtQbGFjZWhvbGRlclJlZ2lzdHJ5fSBmcm9tICcuL3NlcmlhbGl6ZXJzL3BsYWNlaG9sZGVyJztcblxuY29uc3QgX2V4cFBhcnNlciA9IG5ldyBFeHByZXNzaW9uUGFyc2VyKG5ldyBFeHByZXNzaW9uTGV4ZXIoKSk7XG5cbmV4cG9ydCB0eXBlIFZpc2l0Tm9kZUZuID0gKGh0bWw6IGh0bWwuTm9kZSwgaTE4bjogaTE4bi5Ob2RlKSA9PiBpMThuLk5vZGU7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSTE4bk1lc3NhZ2VGYWN0b3J5IHtcbiAgKG5vZGVzOiBodG1sLk5vZGVbXSwgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZCwgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQsXG4gICBjdXN0b21JZDogc3RyaW5nfHVuZGVmaW5lZCwgdmlzaXROb2RlRm4/OiBWaXNpdE5vZGVGbik6IGkxOG4uTWVzc2FnZTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZnVuY3Rpb24gY29udmVydGluZyBodG1sIG5vZGVzIHRvIGFuIGkxOG4gTWVzc2FnZSBnaXZlbiBhbiBpbnRlcnBvbGF0aW9uQ29uZmlnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnkoaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6XG4gICAgSTE4bk1lc3NhZ2VGYWN0b3J5IHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfSTE4blZpc2l0b3IoX2V4cFBhcnNlciwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIHJldHVybiAobm9kZXMsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZCwgdmlzaXROb2RlRm4pID0+XG4gICAgICAgICAgICAgdmlzaXRvci50b0kxOG5NZXNzYWdlKG5vZGVzLCBtZWFuaW5nLCBkZXNjcmlwdGlvbiwgY3VzdG9tSWQsIHZpc2l0Tm9kZUZuKTtcbn1cblxuaW50ZXJmYWNlIEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQge1xuICBpc0ljdTogYm9vbGVhbjtcbiAgaWN1RGVwdGg6IG51bWJlcjtcbiAgcGxhY2Vob2xkZXJSZWdpc3RyeTogUGxhY2Vob2xkZXJSZWdpc3RyeTtcbiAgcGxhY2Vob2xkZXJUb0NvbnRlbnQ6IHtbcGhOYW1lOiBzdHJpbmddOiBpMThuLk1lc3NhZ2VQbGFjZWhvbGRlcn07XG4gIHBsYWNlaG9sZGVyVG9NZXNzYWdlOiB7W3BoTmFtZTogc3RyaW5nXTogaTE4bi5NZXNzYWdlfTtcbiAgdmlzaXROb2RlRm46IFZpc2l0Tm9kZUZuO1xufVxuXG5mdW5jdGlvbiBub29wVmlzaXROb2RlRm4oX2h0bWw6IGh0bWwuTm9kZSwgaTE4bjogaTE4bi5Ob2RlKTogaTE4bi5Ob2RlIHtcbiAgcmV0dXJuIGkxOG47XG59XG5cbmNsYXNzIF9JMThuVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfZXhwcmVzc2lvblBhcnNlcjogRXhwcmVzc2lvblBhcnNlcixcbiAgICAgIHByaXZhdGUgX2ludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpIHt9XG5cbiAgcHVibGljIHRvSTE4bk1lc3NhZ2UoXG4gICAgICBub2RlczogaHRtbC5Ob2RlW10sIG1lYW5pbmcgPSAnJywgZGVzY3JpcHRpb24gPSAnJywgY3VzdG9tSWQgPSAnJyxcbiAgICAgIHZpc2l0Tm9kZUZuOiBWaXNpdE5vZGVGbnx1bmRlZmluZWQpOiBpMThuLk1lc3NhZ2Uge1xuICAgIGNvbnN0IGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQgPSB7XG4gICAgICBpc0ljdTogbm9kZXMubGVuZ3RoID09IDEgJiYgbm9kZXNbMF0gaW5zdGFuY2VvZiBodG1sLkV4cGFuc2lvbixcbiAgICAgIGljdURlcHRoOiAwLFxuICAgICAgcGxhY2Vob2xkZXJSZWdpc3RyeTogbmV3IFBsYWNlaG9sZGVyUmVnaXN0cnkoKSxcbiAgICAgIHBsYWNlaG9sZGVyVG9Db250ZW50OiB7fSxcbiAgICAgIHBsYWNlaG9sZGVyVG9NZXNzYWdlOiB7fSxcbiAgICAgIHZpc2l0Tm9kZUZuOiB2aXNpdE5vZGVGbiB8fCBub29wVmlzaXROb2RlRm4sXG4gICAgfTtcblxuICAgIGNvbnN0IGkxOG5vZGVzOiBpMThuLk5vZGVbXSA9IGh0bWwudmlzaXRBbGwodGhpcywgbm9kZXMsIGNvbnRleHQpO1xuXG4gICAgcmV0dXJuIG5ldyBpMThuLk1lc3NhZ2UoXG4gICAgICAgIGkxOG5vZGVzLCBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50LCBjb250ZXh0LnBsYWNlaG9sZGVyVG9NZXNzYWdlLCBtZWFuaW5nLCBkZXNjcmlwdGlvbixcbiAgICAgICAgY3VzdG9tSWQpO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsOiBodG1sLkVsZW1lbnQsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh0aGlzLCBlbC5jaGlsZHJlbiwgY29udGV4dCk7XG4gICAgY29uc3QgYXR0cnM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGVsLmF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICAvLyBEbyBub3QgdmlzaXQgdGhlIGF0dHJpYnV0ZXMsIHRyYW5zbGF0YWJsZSBvbmVzIGFyZSB0b3AtbGV2ZWwgQVNUc1xuICAgICAgYXR0cnNbYXR0ci5uYW1lXSA9IGF0dHIudmFsdWU7XG4gICAgfSk7XG5cbiAgICBjb25zdCBpc1ZvaWQ6IGJvb2xlYW4gPSBnZXRIdG1sVGFnRGVmaW5pdGlvbihlbC5uYW1lKS5pc1ZvaWQ7XG4gICAgY29uc3Qgc3RhcnRQaE5hbWUgPVxuICAgICAgICBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0U3RhcnRUYWdQbGFjZWhvbGRlck5hbWUoZWwubmFtZSwgYXR0cnMsIGlzVm9pZCk7XG4gICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudFtzdGFydFBoTmFtZV0gPSB7XG4gICAgICB0ZXh0OiBlbC5zdGFydFNvdXJjZVNwYW4udG9TdHJpbmcoKSxcbiAgICAgIHNvdXJjZVNwYW46IGVsLnN0YXJ0U291cmNlU3BhbixcbiAgICB9O1xuXG4gICAgbGV0IGNsb3NlUGhOYW1lID0gJyc7XG5cbiAgICBpZiAoIWlzVm9pZCkge1xuICAgICAgY2xvc2VQaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0Q2xvc2VUYWdQbGFjZWhvbGRlck5hbWUoZWwubmFtZSk7XG4gICAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W2Nsb3NlUGhOYW1lXSA9IHtcbiAgICAgICAgdGV4dDogYDwvJHtlbC5uYW1lfT5gLFxuICAgICAgICBzb3VyY2VTcGFuOiBlbC5lbmRTb3VyY2VTcGFuID8/IGVsLnNvdXJjZVNwYW4sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGUgPSBuZXcgaTE4bi5UYWdQbGFjZWhvbGRlcihcbiAgICAgICAgZWwubmFtZSwgYXR0cnMsIHN0YXJ0UGhOYW1lLCBjbG9zZVBoTmFtZSwgY2hpbGRyZW4sIGlzVm9pZCwgZWwuc291cmNlU3BhbixcbiAgICAgICAgZWwuc3RhcnRTb3VyY2VTcGFuLCBlbC5lbmRTb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbihlbCwgbm9kZSk7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICBjb25zdCBub2RlID0gYXR0cmlidXRlLnZhbHVlVG9rZW5zID09PSB1bmRlZmluZWQgfHwgYXR0cmlidXRlLnZhbHVlVG9rZW5zLmxlbmd0aCA9PT0gMSA/XG4gICAgICAgIG5ldyBpMThuLlRleHQoYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IGF0dHJpYnV0ZS5zb3VyY2VTcGFuKSA6XG4gICAgICAgIHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlVG9rZW5zLCBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBjb250ZXh0LFxuICAgICAgICAgICAgYXR0cmlidXRlLmkxOG4pO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGF0dHJpYnV0ZSwgbm9kZSk7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICBjb25zdCBub2RlID0gdGV4dC50b2tlbnMubGVuZ3RoID09PSAxID9cbiAgICAgICAgbmV3IGkxOG4uVGV4dCh0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4pIDpcbiAgICAgICAgdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24odGV4dC50b2tlbnMsIHRleHQuc291cmNlU3BhbiwgY29udGV4dCwgdGV4dC5pMThuKTtcbiAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbih0ZXh0LCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGV8bnVsbCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihpY3U6IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICBjb250ZXh0LmljdURlcHRoKys7XG4gICAgY29uc3QgaTE4bkljdUNhc2VzOiB7W2s6IHN0cmluZ106IGkxOG4uTm9kZX0gPSB7fTtcbiAgICBjb25zdCBpMThuSWN1ID0gbmV3IGkxOG4uSWN1KGljdS5zd2l0Y2hWYWx1ZSwgaWN1LnR5cGUsIGkxOG5JY3VDYXNlcywgaWN1LnNvdXJjZVNwYW4pO1xuICAgIGljdS5jYXNlcy5mb3JFYWNoKChjYXplKTogdm9pZCA9PiB7XG4gICAgICBpMThuSWN1Q2FzZXNbY2F6ZS52YWx1ZV0gPSBuZXcgaTE4bi5Db250YWluZXIoXG4gICAgICAgICAgY2F6ZS5leHByZXNzaW9uLm1hcCgobm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzLCBjb250ZXh0KSksIGNhemUuZXhwU291cmNlU3Bhbik7XG4gICAgfSk7XG4gICAgY29udGV4dC5pY3VEZXB0aC0tO1xuXG4gICAgaWYgKGNvbnRleHQuaXNJY3UgfHwgY29udGV4dC5pY3VEZXB0aCA+IDApIHtcbiAgICAgIC8vIFJldHVybnMgYW4gSUNVIG5vZGUgd2hlbjpcbiAgICAgIC8vIC0gdGhlIG1lc3NhZ2UgKHZzIGEgcGFydCBvZiB0aGUgbWVzc2FnZSkgaXMgYW4gSUNVIG1lc3NhZ2UsIG9yXG4gICAgICAvLyAtIHRoZSBJQ1UgbWVzc2FnZSBpcyBuZXN0ZWQuXG4gICAgICBjb25zdCBleHBQaCA9IGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRVbmlxdWVQbGFjZWhvbGRlcihgVkFSXyR7aWN1LnR5cGV9YCk7XG4gICAgICBpMThuSWN1LmV4cHJlc3Npb25QbGFjZWhvbGRlciA9IGV4cFBoO1xuICAgICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudFtleHBQaF0gPSB7XG4gICAgICAgIHRleHQ6IGljdS5zd2l0Y2hWYWx1ZSxcbiAgICAgICAgc291cmNlU3BhbjogaWN1LnN3aXRjaFZhbHVlU291cmNlU3BhbixcbiAgICAgIH07XG4gICAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbihpY3UsIGkxOG5JY3UpO1xuICAgIH1cblxuICAgIC8vIEVsc2UgcmV0dXJucyBhIHBsYWNlaG9sZGVyXG4gICAgLy8gSUNVIHBsYWNlaG9sZGVycyBzaG91bGQgbm90IGJlIHJlcGxhY2VkIHdpdGggdGhlaXIgb3JpZ2luYWwgY29udGVudCBidXQgd2l0aCB0aGUgdGhlaXJcbiAgICAvLyB0cmFuc2xhdGlvbnMuXG4gICAgLy8gVE9ETyh2aWNiKTogYWRkIGEgaHRtbC5Ob2RlIC0+IGkxOG4uTWVzc2FnZSBjYWNoZSB0byBhdm9pZCBoYXZpbmcgdG8gcmUtY3JlYXRlIHRoZSBtc2dcbiAgICBjb25zdCBwaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0UGxhY2Vob2xkZXJOYW1lKCdJQ1UnLCBpY3Uuc291cmNlU3Bhbi50b1N0cmluZygpKTtcbiAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9NZXNzYWdlW3BoTmFtZV0gPSB0aGlzLnRvSTE4bk1lc3NhZ2UoW2ljdV0sICcnLCAnJywgJycsIHVuZGVmaW5lZCk7XG4gICAgY29uc3Qgbm9kZSA9IG5ldyBpMThuLkljdVBsYWNlaG9sZGVyKGkxOG5JY3UsIHBoTmFtZSwgaWN1LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGljdSwgbm9kZSk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoX2ljdUNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgX2NvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5yZWFjaGFibGUgY29kZScpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQsIHRleHQgYW5kIGludGVycG9sYXRlZCB0b2tlbnMgdXAgaW50byB0ZXh0IGFuZCBwbGFjZWhvbGRlciBwaWVjZXMuXG4gICAqXG4gICAqIEBwYXJhbSB0b2tlbnMgVGhlIHRleHQgYW5kIGludGVycG9sYXRlZCB0b2tlbnMuXG4gICAqIEBwYXJhbSBzb3VyY2VTcGFuIFRoZSBzcGFuIG9mIHRoZSB3aG9sZSBvZiB0aGUgYHRleHRgIHN0cmluZy5cbiAgICogQHBhcmFtIGNvbnRleHQgVGhlIGN1cnJlbnQgY29udGV4dCBvZiB0aGUgdmlzaXRvciwgdXNlZCB0byBjb21wdXRlIGFuZCBzdG9yZSBwbGFjZWhvbGRlcnMuXG4gICAqIEBwYXJhbSBwcmV2aW91c0kxOG4gQW55IGkxOG4gbWV0YWRhdGEgYXNzb2NpYXRlZCB3aXRoIHRoaXMgYHRleHRgIGZyb20gYSBwcmV2aW91cyBwYXNzLlxuICAgKi9cbiAgcHJpdmF0ZSBfdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24oXG4gICAgICB0b2tlbnM6IChJbnRlcnBvbGF0ZWRUZXh0VG9rZW58SW50ZXJwb2xhdGVkQXR0cmlidXRlVG9rZW4pW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQsIHByZXZpb3VzSTE4bjogaTE4bi5JMThuTWV0YXx1bmRlZmluZWQpOiBpMThuLk5vZGUge1xuICAgIC8vIFJldHVybiBhIHNlcXVlbmNlIG9mIGBUZXh0YCBhbmQgYFBsYWNlaG9sZGVyYCBub2RlcyBncm91cGVkIGluIGEgYENvbnRhaW5lcmAuXG4gICAgY29uc3Qgbm9kZXM6IGkxOG4uTm9kZVtdID0gW107XG4gICAgLy8gV2Ugd2lsbCBvbmx5IGNyZWF0ZSBhIGNvbnRhaW5lciBpZiB0aGVyZSBhcmUgYWN0dWFsbHkgaW50ZXJwb2xhdGlvbnMsXG4gICAgLy8gc28gdGhpcyBmbGFnIHRyYWNrcyB0aGF0LlxuICAgIGxldCBoYXNJbnRlcnBvbGF0aW9uID0gZmFsc2U7XG4gICAgZm9yIChjb25zdCB0b2tlbiBvZiB0b2tlbnMpIHtcbiAgICAgIHN3aXRjaCAodG9rZW4udHlwZSkge1xuICAgICAgICBjYXNlIFRva2VuVHlwZS5JTlRFUlBPTEFUSU9OOlxuICAgICAgICBjYXNlIFRva2VuVHlwZS5BVFRSX1ZBTFVFX0lOVEVSUE9MQVRJT046XG4gICAgICAgICAgaGFzSW50ZXJwb2xhdGlvbiA9IHRydWU7XG4gICAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHRva2VuLnBhcnRzWzFdO1xuICAgICAgICAgIGNvbnN0IGJhc2VOYW1lID0gZXh0cmFjdFBsYWNlaG9sZGVyTmFtZShleHByZXNzaW9uKSB8fCAnSU5URVJQT0xBVElPTic7XG4gICAgICAgICAgY29uc3QgcGhOYW1lID0gY29udGV4dC5wbGFjZWhvbGRlclJlZ2lzdHJ5LmdldFBsYWNlaG9sZGVyTmFtZShiYXNlTmFtZSwgZXhwcmVzc2lvbik7XG4gICAgICAgICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudFtwaE5hbWVdID0ge1xuICAgICAgICAgICAgdGV4dDogdG9rZW4ucGFydHMuam9pbignJyksXG4gICAgICAgICAgICBzb3VyY2VTcGFuOiB0b2tlbi5zb3VyY2VTcGFuXG4gICAgICAgICAgfTtcbiAgICAgICAgICBub2Rlcy5wdXNoKG5ldyBpMThuLlBsYWNlaG9sZGVyKGV4cHJlc3Npb24sIHBoTmFtZSwgdG9rZW4uc291cmNlU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmICh0b2tlbi5wYXJ0c1swXS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBUaGlzIHRva2VuIGlzIHRleHQgb3IgYW4gZW5jb2RlZCBlbnRpdHkuXG4gICAgICAgICAgICAvLyBJZiBpdCBpcyBmb2xsb3dpbmcgb24gZnJvbSBhIHByZXZpb3VzIHRleHQgbm9kZSB0aGVuIG1lcmdlIGl0IGludG8gdGhhdCBub2RlXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UsIGlmIGl0IGlzIGZvbGxvd2luZyBhbiBpbnRlcnBvbGF0aW9uLCB0aGVuIGFkZCBhIG5ldyBub2RlLlxuICAgICAgICAgICAgY29uc3QgcHJldmlvdXMgPSBub2Rlc1tub2Rlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgIGlmIChwcmV2aW91cyBpbnN0YW5jZW9mIGkxOG4uVGV4dCkge1xuICAgICAgICAgICAgICBwcmV2aW91cy52YWx1ZSArPSB0b2tlbi5wYXJ0c1swXTtcbiAgICAgICAgICAgICAgcHJldmlvdXMuc291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgICAgICAgICAgICBwcmV2aW91cy5zb3VyY2VTcGFuLnN0YXJ0LCB0b2tlbi5zb3VyY2VTcGFuLmVuZCwgcHJldmlvdXMuc291cmNlU3Bhbi5mdWxsU3RhcnQsXG4gICAgICAgICAgICAgICAgICBwcmV2aW91cy5zb3VyY2VTcGFuLmRldGFpbHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbm9kZXMucHVzaChuZXcgaTE4bi5UZXh0KHRva2VuLnBhcnRzWzBdLCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChoYXNJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAvLyBXaGl0ZXNwYWNlIHJlbW92YWwgbWF5IGhhdmUgaW52YWxpZGF0ZWQgdGhlIGludGVycG9sYXRpb24gc291cmNlLXNwYW5zLlxuICAgICAgcmV1c2VQcmV2aW91c1NvdXJjZVNwYW5zKG5vZGVzLCBwcmV2aW91c0kxOG4pO1xuICAgICAgcmV0dXJuIG5ldyBpMThuLkNvbnRhaW5lcihub2Rlcywgc291cmNlU3Bhbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2Rlc1swXTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBSZS11c2UgdGhlIHNvdXJjZS1zcGFucyBmcm9tIGBwcmV2aW91c0kxOG5gIG1ldGFkYXRhIGZvciB0aGUgYG5vZGVzYC5cbiAqXG4gKiBXaGl0ZXNwYWNlIHJlbW92YWwgY2FuIGludmFsaWRhdGUgdGhlIHNvdXJjZS1zcGFucyBvZiBpbnRlcnBvbGF0aW9uIG5vZGVzLCBzbyB3ZVxuICogcmV1c2UgdGhlIHNvdXJjZS1zcGFuIHN0b3JlZCBmcm9tIGEgcHJldmlvdXMgcGFzcyBiZWZvcmUgdGhlIHdoaXRlc3BhY2Ugd2FzIHJlbW92ZWQuXG4gKlxuICogQHBhcmFtIG5vZGVzIFRoZSBgVGV4dGAgYW5kIGBQbGFjZWhvbGRlcmAgbm9kZXMgdG8gYmUgcHJvY2Vzc2VkLlxuICogQHBhcmFtIHByZXZpb3VzSTE4biBBbnkgaTE4biBtZXRhZGF0YSBmb3IgdGhlc2UgYG5vZGVzYCBzdG9yZWQgZnJvbSBhIHByZXZpb3VzIHBhc3MuXG4gKi9cbmZ1bmN0aW9uIHJldXNlUHJldmlvdXNTb3VyY2VTcGFucyhub2RlczogaTE4bi5Ob2RlW10sIHByZXZpb3VzSTE4bjogaTE4bi5JMThuTWV0YXx1bmRlZmluZWQpOiB2b2lkIHtcbiAgaWYgKHByZXZpb3VzSTE4biBpbnN0YW5jZW9mIGkxOG4uTWVzc2FnZSkge1xuICAgIC8vIFRoZSBgcHJldmlvdXNJMThuYCBpcyBhbiBpMThuIGBNZXNzYWdlYCwgc28gd2UgYXJlIHByb2Nlc3NpbmcgYW4gYEF0dHJpYnV0ZWAgd2l0aCBpMThuXG4gICAgLy8gbWV0YWRhdGEuIFRoZSBgTWVzc2FnZWAgc2hvdWxkIGNvbnNpc3Qgb25seSBvZiBhIHNpbmdsZSBgQ29udGFpbmVyYCB0aGF0IGNvbnRhaW5zIHRoZVxuICAgIC8vIHBhcnRzIChgVGV4dGAgYW5kIGBQbGFjZWhvbGRlcmApIHRvIHByb2Nlc3MuXG4gICAgYXNzZXJ0U2luZ2xlQ29udGFpbmVyTWVzc2FnZShwcmV2aW91c0kxOG4pO1xuICAgIHByZXZpb3VzSTE4biA9IHByZXZpb3VzSTE4bi5ub2Rlc1swXTtcbiAgfVxuXG4gIGlmIChwcmV2aW91c0kxOG4gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lcikge1xuICAgIC8vIFRoZSBgcHJldmlvdXNJMThuYCBpcyBhIGBDb250YWluZXJgLCB3aGljaCBtZWFucyB0aGF0IHRoaXMgaXMgYSBzZWNvbmQgaTE4biBleHRyYWN0aW9uIHBhc3NcbiAgICAvLyBhZnRlciB3aGl0ZXNwYWNlIGhhcyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgQVNUIG5vZGVzLlxuICAgIGFzc2VydEVxdWl2YWxlbnROb2RlcyhwcmV2aW91c0kxOG4uY2hpbGRyZW4sIG5vZGVzKTtcblxuICAgIC8vIFJldXNlIHRoZSBzb3VyY2Utc3BhbnMgZnJvbSB0aGUgZmlyc3QgcGFzcy5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBub2Rlc1tpXS5zb3VyY2VTcGFuID0gcHJldmlvdXNJMThuLmNoaWxkcmVuW2ldLnNvdXJjZVNwYW47XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQXNzZXJ0cyB0aGF0IHRoZSBgbWVzc2FnZWAgY29udGFpbnMgZXhhY3RseSBvbmUgYENvbnRhaW5lcmAgbm9kZS5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0U2luZ2xlQ29udGFpbmVyTWVzc2FnZShtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiB2b2lkIHtcbiAgY29uc3Qgbm9kZXMgPSBtZXNzYWdlLm5vZGVzO1xuICBpZiAobm9kZXMubGVuZ3RoICE9PSAxIHx8ICEobm9kZXNbMF0gaW5zdGFuY2VvZiBpMThuLkNvbnRhaW5lcikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdVbmV4cGVjdGVkIHByZXZpb3VzIGkxOG4gbWVzc2FnZSAtIGV4cGVjdGVkIGl0IHRvIGNvbnNpc3Qgb2Ygb25seSBhIHNpbmdsZSBgQ29udGFpbmVyYCBub2RlLicpO1xuICB9XG59XG5cbi8qKlxuICogQXNzZXJ0cyB0aGF0IHRoZSBgcHJldmlvdXNOb2Rlc2AgYW5kIGBub2RlYCBjb2xsZWN0aW9ucyBoYXZlIHRoZSBzYW1lIG51bWJlciBvZiBlbGVtZW50cyBhbmRcbiAqIGNvcnJlc3BvbmRpbmcgZWxlbWVudHMgaGF2ZSB0aGUgc2FtZSBub2RlIHR5cGUuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydEVxdWl2YWxlbnROb2RlcyhwcmV2aW91c05vZGVzOiBpMThuLk5vZGVbXSwgbm9kZXM6IGkxOG4uTm9kZVtdKTogdm9pZCB7XG4gIGlmIChwcmV2aW91c05vZGVzLmxlbmd0aCAhPT0gbm9kZXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgbnVtYmVyIG9mIGkxOG4gbWVzc2FnZSBjaGlsZHJlbiBjaGFuZ2VkIGJldHdlZW4gZmlyc3QgYW5kIHNlY29uZCBwYXNzLicpO1xuICB9XG4gIGlmIChwcmV2aW91c05vZGVzLnNvbWUoKG5vZGUsIGkpID0+IG5vZGVzW2ldLmNvbnN0cnVjdG9yICE9PSBub2RlLmNvbnN0cnVjdG9yKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1RoZSB0eXBlcyBvZiB0aGUgaTE4biBtZXNzYWdlIGNoaWxkcmVuIGNoYW5nZWQgYmV0d2VlbiBmaXJzdCBhbmQgc2Vjb25kIHBhc3MuJyk7XG4gIH1cbn1cblxuY29uc3QgX0NVU1RPTV9QSF9FWFAgPVxuICAgIC9cXC9cXC9bXFxzXFxTXSppMThuW1xcc1xcU10qXFwoW1xcc1xcU10qcGhbXFxzXFxTXSo9W1xcc1xcU10qKFwifCcpKFtcXHNcXFNdKj8pXFwxW1xcc1xcU10qXFwpL2c7XG5cbmZ1bmN0aW9uIGV4dHJhY3RQbGFjZWhvbGRlck5hbWUoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBpbnB1dC5zcGxpdChfQ1VTVE9NX1BIX0VYUClbMl07XG59XG4iXX0=