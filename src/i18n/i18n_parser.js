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
        define("@angular/compiler/src/i18n/i18n_parser", ["require", "exports", "tslib", "@angular/compiler/src/expression_parser/lexer", "@angular/compiler/src/expression_parser/parser", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_tags", "@angular/compiler/src/i18n/i18n_ast", "@angular/compiler/src/i18n/serializers/placeholder"], factory);
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
            var isVoid = html_tags_1.getHtmlTagDefinition(el.name).isVoid;
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
            try {
                for (var tokens_1 = tslib_1.__values(tokens), tokens_1_1 = tokens_1.next(); !tokens_1_1.done; tokens_1_1 = tokens_1.next()) {
                    var token = tokens_1_1.value;
                    switch (token.type) {
                        case 8 /* INTERPOLATION */:
                        case 17 /* ATTR_VALUE_INTERPOLATION */:
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
                                nodes.push(new i18n.Text(token.parts[0], token.sourceSpan));
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
            // Whitespace removal may have invalidated the interpolation source-spans.
            reusePreviousSourceSpans(nodes, previousI18n);
            return new i18n.Container(nodes, sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9pMThuX3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsdUVBQW9FO0lBQ3BFLHlFQUF1RTtJQUN2RSwwREFBeUM7SUFDekMsdUVBQTREO0lBSzVELDBEQUFtQztJQUNuQyxrRkFBOEQ7SUFFOUQsSUFBTSxVQUFVLEdBQUcsSUFBSSxlQUFnQixDQUFDLElBQUksYUFBZSxFQUFFLENBQUMsQ0FBQztJQVMvRDs7T0FFRztJQUNILFNBQWdCLHdCQUF3QixDQUFDLG1CQUF3QztRQUUvRSxJQUFNLE9BQU8sR0FBRyxJQUFJLFlBQVksQ0FBQyxVQUFVLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUNsRSxPQUFPLFVBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLFdBQVc7WUFDL0MsT0FBQSxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxXQUFXLENBQUM7UUFBekUsQ0FBeUUsQ0FBQztJQUN2RixDQUFDO0lBTEQsNERBS0M7SUFXRCxTQUFTLGVBQWUsQ0FBQyxLQUFnQixFQUFFLElBQWU7UUFDeEQsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7UUFDRSxzQkFDWSxpQkFBbUMsRUFDbkMsb0JBQXlDO1lBRHpDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBa0I7WUFDbkMseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFxQjtRQUFHLENBQUM7UUFFbEQsb0NBQWEsR0FBcEIsVUFDSSxLQUFrQixFQUFFLE9BQVksRUFBRSxXQUFnQixFQUFFLFFBQWEsRUFDakUsV0FBa0M7WUFEZCx3QkFBQSxFQUFBLFlBQVk7WUFBRSw0QkFBQSxFQUFBLGdCQUFnQjtZ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LENBQUMsQ0FBQyxDQUFDO0lBQ3hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtMZXhlciBhcyBFeHByZXNzaW9uTGV4ZXJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmltcG9ydCB7UGFyc2VyIGFzIEV4cHJlc3Npb25QYXJzZXJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtnZXRIdG1sVGFnRGVmaW5pdGlvbn0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfdGFncyc7XG5pbXBvcnQge0ludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge0ludGVycG9sYXRlZEF0dHJpYnV0ZVRva2VuLCBJbnRlcnBvbGF0ZWRUZXh0VG9rZW4sIFRva2VuVHlwZX0gZnJvbSAnLi4vbWxfcGFyc2VyL3Rva2Vucyc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi9pMThuX2FzdCc7XG5pbXBvcnQge1BsYWNlaG9sZGVyUmVnaXN0cnl9IGZyb20gJy4vc2VyaWFsaXplcnMvcGxhY2Vob2xkZXInO1xuXG5jb25zdCBfZXhwUGFyc2VyID0gbmV3IEV4cHJlc3Npb25QYXJzZXIobmV3IEV4cHJlc3Npb25MZXhlcigpKTtcblxuZXhwb3J0IHR5cGUgVmlzaXROb2RlRm4gPSAoaHRtbDogaHRtbC5Ob2RlLCBpMThuOiBpMThuLk5vZGUpID0+IGkxOG4uTm9kZTtcblxuZXhwb3J0IGludGVyZmFjZSBJMThuTWVzc2FnZUZhY3Rvcnkge1xuICAobm9kZXM6IGh0bWwuTm9kZVtdLCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkLCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZCxcbiAgIGN1c3RvbUlkOiBzdHJpbmd8dW5kZWZpbmVkLCB2aXNpdE5vZGVGbj86IFZpc2l0Tm9kZUZuKTogaTE4bi5NZXNzYWdlO1xufVxuXG4vKipcbiAqIFJldHVybnMgYSBmdW5jdGlvbiBjb252ZXJ0aW5nIGh0bWwgbm9kZXMgdG8gYW4gaTE4biBNZXNzYWdlIGdpdmVuIGFuIGludGVycG9sYXRpb25Db25maWdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeShpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTpcbiAgICBJMThuTWVzc2FnZUZhY3Rvcnkge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9JMThuVmlzaXRvcihfZXhwUGFyc2VyLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgcmV0dXJuIChub2RlcywgbWVhbmluZywgZGVzY3JpcHRpb24sIGN1c3RvbUlkLCB2aXNpdE5vZGVGbikgPT5cbiAgICAgICAgICAgICB2aXNpdG9yLnRvSTE4bk1lc3NhZ2Uobm9kZXMsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZCwgdmlzaXROb2RlRm4pO1xufVxuXG5pbnRlcmZhY2UgSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCB7XG4gIGlzSWN1OiBib29sZWFuO1xuICBpY3VEZXB0aDogbnVtYmVyO1xuICBwbGFjZWhvbGRlclJlZ2lzdHJ5OiBQbGFjZWhvbGRlclJlZ2lzdHJ5O1xuICBwbGFjZWhvbGRlclRvQ29udGVudDoge1twaE5hbWU6IHN0cmluZ106IGkxOG4uTWVzc2FnZVBsYWNlaG9sZGVyfTtcbiAgcGxhY2Vob2xkZXJUb01lc3NhZ2U6IHtbcGhOYW1lOiBzdHJpbmddOiBpMThuLk1lc3NhZ2V9O1xuICB2aXNpdE5vZGVGbjogVmlzaXROb2RlRm47XG59XG5cbmZ1bmN0aW9uIG5vb3BWaXNpdE5vZGVGbihfaHRtbDogaHRtbC5Ob2RlLCBpMThuOiBpMThuLk5vZGUpOiBpMThuLk5vZGUge1xuICByZXR1cm4gaTE4bjtcbn1cblxuY2xhc3MgX0kxOG5WaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9leHByZXNzaW9uUGFyc2VyOiBFeHByZXNzaW9uUGFyc2VyLFxuICAgICAgcHJpdmF0ZSBfaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZykge31cblxuICBwdWJsaWMgdG9JMThuTWVzc2FnZShcbiAgICAgIG5vZGVzOiBodG1sLk5vZGVbXSwgbWVhbmluZyA9ICcnLCBkZXNjcmlwdGlvbiA9ICcnLCBjdXN0b21JZCA9ICcnLFxuICAgICAgdmlzaXROb2RlRm46IFZpc2l0Tm9kZUZufHVuZGVmaW5lZCk6IGkxOG4uTWVzc2FnZSB7XG4gICAgY29uc3QgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCA9IHtcbiAgICAgIGlzSWN1OiBub2Rlcy5sZW5ndGggPT0gMSAmJiBub2Rlc1swXSBpbnN0YW5jZW9mIGh0bWwuRXhwYW5zaW9uLFxuICAgICAgaWN1RGVwdGg6IDAsXG4gICAgICBwbGFjZWhvbGRlclJlZ2lzdHJ5OiBuZXcgUGxhY2Vob2xkZXJSZWdpc3RyeSgpLFxuICAgICAgcGxhY2Vob2xkZXJUb0NvbnRlbnQ6IHt9LFxuICAgICAgcGxhY2Vob2xkZXJUb01lc3NhZ2U6IHt9LFxuICAgICAgdmlzaXROb2RlRm46IHZpc2l0Tm9kZUZuIHx8IG5vb3BWaXNpdE5vZGVGbixcbiAgICB9O1xuXG4gICAgY29uc3QgaTE4bm9kZXM6IGkxOG4uTm9kZVtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBub2RlcywgY29udGV4dCk7XG5cbiAgICByZXR1cm4gbmV3IGkxOG4uTWVzc2FnZShcbiAgICAgICAgaTE4bm9kZXMsIGNvbnRleHQucGxhY2Vob2xkZXJUb0NvbnRlbnQsIGNvbnRleHQucGxhY2Vob2xkZXJUb01lc3NhZ2UsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLFxuICAgICAgICBjdXN0b21JZCk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWw6IGh0bWwuRWxlbWVudCwgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCk6IGkxOG4uTm9kZSB7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKHRoaXMsIGVsLmNoaWxkcmVuLCBjb250ZXh0KTtcbiAgICBjb25zdCBhdHRyczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgZWwuYXR0cnMuZm9yRWFjaChhdHRyID0+IHtcbiAgICAgIC8vIERvIG5vdCB2aXNpdCB0aGUgYXR0cmlidXRlcywgdHJhbnNsYXRhYmxlIG9uZXMgYXJlIHRvcC1sZXZlbCBBU1RzXG4gICAgICBhdHRyc1thdHRyLm5hbWVdID0gYXR0ci52YWx1ZTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGlzVm9pZDogYm9vbGVhbiA9IGdldEh0bWxUYWdEZWZpbml0aW9uKGVsLm5hbWUpLmlzVm9pZDtcbiAgICBjb25zdCBzdGFydFBoTmFtZSA9XG4gICAgICAgIGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRTdGFydFRhZ1BsYWNlaG9sZGVyTmFtZShlbC5uYW1lLCBhdHRycywgaXNWb2lkKTtcbiAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W3N0YXJ0UGhOYW1lXSA9IHtcbiAgICAgIHRleHQ6IGVsLnN0YXJ0U291cmNlU3Bhbi50b1N0cmluZygpLFxuICAgICAgc291cmNlU3BhbjogZWwuc3RhcnRTb3VyY2VTcGFuLFxuICAgIH07XG5cbiAgICBsZXQgY2xvc2VQaE5hbWUgPSAnJztcblxuICAgIGlmICghaXNWb2lkKSB7XG4gICAgICBjbG9zZVBoTmFtZSA9IGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRDbG9zZVRhZ1BsYWNlaG9sZGVyTmFtZShlbC5uYW1lKTtcbiAgICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb0NvbnRlbnRbY2xvc2VQaE5hbWVdID0ge1xuICAgICAgICB0ZXh0OiBgPC8ke2VsLm5hbWV9PmAsXG4gICAgICAgIHNvdXJjZVNwYW46IGVsLmVuZFNvdXJjZVNwYW4gPz8gZWwuc291cmNlU3BhbixcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZSA9IG5ldyBpMThuLlRhZ1BsYWNlaG9sZGVyKFxuICAgICAgICBlbC5uYW1lLCBhdHRycywgc3RhcnRQaE5hbWUsIGNsb3NlUGhOYW1lLCBjaGlsZHJlbiwgaXNWb2lkLCBlbC5zb3VyY2VTcGFuLFxuICAgICAgICBlbC5zdGFydFNvdXJjZVNwYW4sIGVsLmVuZFNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGVsLCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnN0IG5vZGUgPSBhdHRyaWJ1dGUudmFsdWVUb2tlbnMgPT09IHVuZGVmaW5lZCB8fCBhdHRyaWJ1dGUudmFsdWVUb2tlbnMubGVuZ3RoID09PSAxID9cbiAgICAgICAgbmV3IGkxOG4uVGV4dChhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS52YWx1ZVNwYW4gfHwgYXR0cmlidXRlLnNvdXJjZVNwYW4pIDpcbiAgICAgICAgdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24oXG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWVUb2tlbnMsIGF0dHJpYnV0ZS52YWx1ZVNwYW4gfHwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGNvbnRleHQsXG4gICAgICAgICAgICBhdHRyaWJ1dGUuaTE4bik7XG4gICAgcmV0dXJuIGNvbnRleHQudmlzaXROb2RlRm4oYXR0cmlidXRlLCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnN0IG5vZGUgPSB0ZXh0LnRva2Vucy5sZW5ndGggPT09IDEgP1xuICAgICAgICBuZXcgaTE4bi5UZXh0KHRleHQudmFsdWUsIHRleHQuc291cmNlU3BhbikgOlxuICAgICAgICB0aGlzLl92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbih0ZXh0LnRva2VucywgdGV4dC5zb3VyY2VTcGFuLCBjb250ZXh0LCB0ZXh0LmkxOG4pO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKHRleHQsIG5vZGUpO1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCk6IGkxOG4uTm9kZXxudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGljdTogaHRtbC5FeHBhbnNpb24sIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnRleHQuaWN1RGVwdGgrKztcbiAgICBjb25zdCBpMThuSWN1Q2FzZXM6IHtbazogc3RyaW5nXTogaTE4bi5Ob2RlfSA9IHt9O1xuICAgIGNvbnN0IGkxOG5JY3UgPSBuZXcgaTE4bi5JY3UoaWN1LnN3aXRjaFZhbHVlLCBpY3UudHlwZSwgaTE4bkljdUNhc2VzLCBpY3Uuc291cmNlU3Bhbik7XG4gICAgaWN1LmNhc2VzLmZvckVhY2goKGNhemUpOiB2b2lkID0+IHtcbiAgICAgIGkxOG5JY3VDYXNlc1tjYXplLnZhbHVlXSA9IG5ldyBpMThuLkNvbnRhaW5lcihcbiAgICAgICAgICBjYXplLmV4cHJlc3Npb24ubWFwKChub2RlKSA9PiBub2RlLnZpc2l0KHRoaXMsIGNvbnRleHQpKSwgY2F6ZS5leHBTb3VyY2VTcGFuKTtcbiAgICB9KTtcbiAgICBjb250ZXh0LmljdURlcHRoLS07XG5cbiAgICBpZiAoY29udGV4dC5pc0ljdSB8fCBjb250ZXh0LmljdURlcHRoID4gMCkge1xuICAgICAgLy8gUmV0dXJucyBhbiBJQ1Ugbm9kZSB3aGVuOlxuICAgICAgLy8gLSB0aGUgbWVzc2FnZSAodnMgYSBwYXJ0IG9mIHRoZSBtZXNzYWdlKSBpcyBhbiBJQ1UgbWVzc2FnZSwgb3JcbiAgICAgIC8vIC0gdGhlIElDVSBtZXNzYWdlIGlzIG5lc3RlZC5cbiAgICAgIGNvbnN0IGV4cFBoID0gY29udGV4dC5wbGFjZWhvbGRlclJlZ2lzdHJ5LmdldFVuaXF1ZVBsYWNlaG9sZGVyKGBWQVJfJHtpY3UudHlwZX1gKTtcbiAgICAgIGkxOG5JY3UuZXhwcmVzc2lvblBsYWNlaG9sZGVyID0gZXhwUGg7XG4gICAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W2V4cFBoXSA9IHtcbiAgICAgICAgdGV4dDogaWN1LnN3aXRjaFZhbHVlLFxuICAgICAgICBzb3VyY2VTcGFuOiBpY3Uuc3dpdGNoVmFsdWVTb3VyY2VTcGFuLFxuICAgICAgfTtcbiAgICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGljdSwgaTE4bkljdSk7XG4gICAgfVxuXG4gICAgLy8gRWxzZSByZXR1cm5zIGEgcGxhY2Vob2xkZXJcbiAgICAvLyBJQ1UgcGxhY2Vob2xkZXJzIHNob3VsZCBub3QgYmUgcmVwbGFjZWQgd2l0aCB0aGVpciBvcmlnaW5hbCBjb250ZW50IGJ1dCB3aXRoIHRoZSB0aGVpclxuICAgIC8vIHRyYW5zbGF0aW9ucy5cbiAgICAvLyBUT0RPKHZpY2IpOiBhZGQgYSBodG1sLk5vZGUgLT4gaTE4bi5NZXNzYWdlIGNhY2hlIHRvIGF2b2lkIGhhdmluZyB0byByZS1jcmVhdGUgdGhlIG1zZ1xuICAgIGNvbnN0IHBoTmFtZSA9IGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRQbGFjZWhvbGRlck5hbWUoJ0lDVScsIGljdS5zb3VyY2VTcGFuLnRvU3RyaW5nKCkpO1xuICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb01lc3NhZ2VbcGhOYW1lXSA9IHRoaXMudG9JMThuTWVzc2FnZShbaWN1XSwgJycsICcnLCAnJywgdW5kZWZpbmVkKTtcbiAgICBjb25zdCBub2RlID0gbmV3IGkxOG4uSWN1UGxhY2Vob2xkZXIoaTE4bkljdSwgcGhOYW1lLCBpY3Uuc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGNvbnRleHQudmlzaXROb2RlRm4oaWN1LCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShfaWN1Q2FzZTogaHRtbC5FeHBhbnNpb25DYXNlLCBfY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCk6IGkxOG4uTm9kZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbnJlYWNoYWJsZSBjb2RlJyk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCwgdGV4dCBhbmQgaW50ZXJwb2xhdGVkIHRva2VucyB1cCBpbnRvIHRleHQgYW5kIHBsYWNlaG9sZGVyIHBpZWNlcy5cbiAgICpcbiAgICogQHBhcmFtIHRva2VucyBUaGUgdGV4dCBhbmQgaW50ZXJwb2xhdGVkIHRva2Vucy5cbiAgICogQHBhcmFtIHNvdXJjZVNwYW4gVGhlIHNwYW4gb2YgdGhlIHdob2xlIG9mIHRoZSBgdGV4dGAgc3RyaW5nLlxuICAgKiBAcGFyYW0gY29udGV4dCBUaGUgY3VycmVudCBjb250ZXh0IG9mIHRoZSB2aXNpdG9yLCB1c2VkIHRvIGNvbXB1dGUgYW5kIHN0b3JlIHBsYWNlaG9sZGVycy5cbiAgICogQHBhcmFtIHByZXZpb3VzSTE4biBBbnkgaTE4biBtZXRhZGF0YSBhc3NvY2lhdGVkIHdpdGggdGhpcyBgdGV4dGAgZnJvbSBhIHByZXZpb3VzIHBhc3MuXG4gICAqL1xuICBwcml2YXRlIF92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbihcbiAgICAgIHRva2VuczogKEludGVycG9sYXRlZFRleHRUb2tlbnxJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbilbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCwgcHJldmlvdXNJMThuOiBpMThuLkkxOG5NZXRhfHVuZGVmaW5lZCk6IGkxOG4uTm9kZSB7XG4gICAgLy8gUmV0dXJuIGEgc2VxdWVuY2Ugb2YgYFRleHRgIGFuZCBgUGxhY2Vob2xkZXJgIG5vZGVzIGdyb3VwZWQgaW4gYSBgQ29udGFpbmVyYC5cbiAgICBjb25zdCBub2RlczogaTE4bi5Ob2RlW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHRva2Vucykge1xuICAgICAgc3dpdGNoICh0b2tlbi50eXBlKSB7XG4gICAgICAgIGNhc2UgVG9rZW5UeXBlLklOVEVSUE9MQVRJT046XG4gICAgICAgIGNhc2UgVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTjpcbiAgICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdG9rZW4ucGFydHNbMV07XG4gICAgICAgICAgY29uc3QgYmFzZU5hbWUgPSBleHRyYWN0UGxhY2Vob2xkZXJOYW1lKGV4cHJlc3Npb24pIHx8ICdJTlRFUlBPTEFUSU9OJztcbiAgICAgICAgICBjb25zdCBwaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0UGxhY2Vob2xkZXJOYW1lKGJhc2VOYW1lLCBleHByZXNzaW9uKTtcbiAgICAgICAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W3BoTmFtZV0gPSB7XG4gICAgICAgICAgICB0ZXh0OiB0b2tlbi5wYXJ0cy5qb2luKCcnKSxcbiAgICAgICAgICAgIHNvdXJjZVNwYW46IHRva2VuLnNvdXJjZVNwYW5cbiAgICAgICAgICB9O1xuICAgICAgICAgIG5vZGVzLnB1c2gobmV3IGkxOG4uUGxhY2Vob2xkZXIoZXhwcmVzc2lvbiwgcGhOYW1lLCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKHRva2VuLnBhcnRzWzBdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG5vZGVzLnB1c2gobmV3IGkxOG4uVGV4dCh0b2tlbi5wYXJ0c1swXSwgdG9rZW4uc291cmNlU3BhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGl0ZXNwYWNlIHJlbW92YWwgbWF5IGhhdmUgaW52YWxpZGF0ZWQgdGhlIGludGVycG9sYXRpb24gc291cmNlLXNwYW5zLlxuICAgIHJldXNlUHJldmlvdXNTb3VyY2VTcGFucyhub2RlcywgcHJldmlvdXNJMThuKTtcblxuICAgIHJldHVybiBuZXcgaTE4bi5Db250YWluZXIobm9kZXMsIHNvdXJjZVNwYW4pO1xuICB9XG59XG5cbi8qKlxuICogUmUtdXNlIHRoZSBzb3VyY2Utc3BhbnMgZnJvbSBgcHJldmlvdXNJMThuYCBtZXRhZGF0YSBmb3IgdGhlIGBub2Rlc2AuXG4gKlxuICogV2hpdGVzcGFjZSByZW1vdmFsIGNhbiBpbnZhbGlkYXRlIHRoZSBzb3VyY2Utc3BhbnMgb2YgaW50ZXJwb2xhdGlvbiBub2Rlcywgc28gd2VcbiAqIHJldXNlIHRoZSBzb3VyY2Utc3BhbiBzdG9yZWQgZnJvbSBhIHByZXZpb3VzIHBhc3MgYmVmb3JlIHRoZSB3aGl0ZXNwYWNlIHdhcyByZW1vdmVkLlxuICpcbiAqIEBwYXJhbSBub2RlcyBUaGUgYFRleHRgIGFuZCBgUGxhY2Vob2xkZXJgIG5vZGVzIHRvIGJlIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSBwcmV2aW91c0kxOG4gQW55IGkxOG4gbWV0YWRhdGEgZm9yIHRoZXNlIGBub2Rlc2Agc3RvcmVkIGZyb20gYSBwcmV2aW91cyBwYXNzLlxuICovXG5mdW5jdGlvbiByZXVzZVByZXZpb3VzU291cmNlU3BhbnMobm9kZXM6IGkxOG4uTm9kZVtdLCBwcmV2aW91c0kxOG46IGkxOG4uSTE4bk1ldGF8dW5kZWZpbmVkKTogdm9pZCB7XG4gIGlmIChwcmV2aW91c0kxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICAvLyBUaGUgYHByZXZpb3VzSTE4bmAgaXMgYW4gaTE4biBgTWVzc2FnZWAsIHNvIHdlIGFyZSBwcm9jZXNzaW5nIGFuIGBBdHRyaWJ1dGVgIHdpdGggaTE4blxuICAgIC8vIG1ldGFkYXRhLiBUaGUgYE1lc3NhZ2VgIHNob3VsZCBjb25zaXN0IG9ubHkgb2YgYSBzaW5nbGUgYENvbnRhaW5lcmAgdGhhdCBjb250YWlucyB0aGVcbiAgICAvLyBwYXJ0cyAoYFRleHRgIGFuZCBgUGxhY2Vob2xkZXJgKSB0byBwcm9jZXNzLlxuICAgIGFzc2VydFNpbmdsZUNvbnRhaW5lck1lc3NhZ2UocHJldmlvdXNJMThuKTtcbiAgICBwcmV2aW91c0kxOG4gPSBwcmV2aW91c0kxOG4ubm9kZXNbMF07XG4gIH1cblxuICBpZiAocHJldmlvdXNJMThuIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIpIHtcbiAgICAvLyBUaGUgYHByZXZpb3VzSTE4bmAgaXMgYSBgQ29udGFpbmVyYCwgd2hpY2ggbWVhbnMgdGhhdCB0aGlzIGlzIGEgc2Vjb25kIGkxOG4gZXh0cmFjdGlvbiBwYXNzXG4gICAgLy8gYWZ0ZXIgd2hpdGVzcGFjZSBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIEFTVCBub2Rlcy5cbiAgICBhc3NlcnRFcXVpdmFsZW50Tm9kZXMocHJldmlvdXNJMThuLmNoaWxkcmVuLCBub2Rlcyk7XG5cbiAgICAvLyBSZXVzZSB0aGUgc291cmNlLXNwYW5zIGZyb20gdGhlIGZpcnN0IHBhc3MuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbm9kZXNbaV0uc291cmNlU3BhbiA9IHByZXZpb3VzSTE4bi5jaGlsZHJlbltpXS5zb3VyY2VTcGFuO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFzc2VydHMgdGhhdCB0aGUgYG1lc3NhZ2VgIGNvbnRhaW5zIGV4YWN0bHkgb25lIGBDb250YWluZXJgIG5vZGUuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydFNpbmdsZUNvbnRhaW5lck1lc3NhZ2UobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogdm9pZCB7XG4gIGNvbnN0IG5vZGVzID0gbWVzc2FnZS5ub2RlcztcbiAgaWYgKG5vZGVzLmxlbmd0aCAhPT0gMSB8fCAhKG5vZGVzWzBdIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnVW5leHBlY3RlZCBwcmV2aW91cyBpMThuIG1lc3NhZ2UgLSBleHBlY3RlZCBpdCB0byBjb25zaXN0IG9mIG9ubHkgYSBzaW5nbGUgYENvbnRhaW5lcmAgbm9kZS4nKTtcbiAgfVxufVxuXG4vKipcbiAqIEFzc2VydHMgdGhhdCB0aGUgYHByZXZpb3VzTm9kZXNgIGFuZCBgbm9kZWAgY29sbGVjdGlvbnMgaGF2ZSB0aGUgc2FtZSBudW1iZXIgb2YgZWxlbWVudHMgYW5kXG4gKiBjb3JyZXNwb25kaW5nIGVsZW1lbnRzIGhhdmUgdGhlIHNhbWUgbm9kZSB0eXBlLlxuICovXG5mdW5jdGlvbiBhc3NlcnRFcXVpdmFsZW50Tm9kZXMocHJldmlvdXNOb2RlczogaTE4bi5Ob2RlW10sIG5vZGVzOiBpMThuLk5vZGVbXSk6IHZvaWQge1xuICBpZiAocHJldmlvdXNOb2Rlcy5sZW5ndGggIT09IG5vZGVzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIG51bWJlciBvZiBpMThuIG1lc3NhZ2UgY2hpbGRyZW4gY2hhbmdlZCBiZXR3ZWVuIGZpcnN0IGFuZCBzZWNvbmQgcGFzcy4nKTtcbiAgfVxuICBpZiAocHJldmlvdXNOb2Rlcy5zb21lKChub2RlLCBpKSA9PiBub2Rlc1tpXS5jb25zdHJ1Y3RvciAhPT0gbm9kZS5jb25zdHJ1Y3RvcikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdUaGUgdHlwZXMgb2YgdGhlIGkxOG4gbWVzc2FnZSBjaGlsZHJlbiBjaGFuZ2VkIGJldHdlZW4gZmlyc3QgYW5kIHNlY29uZCBwYXNzLicpO1xuICB9XG59XG5cbmNvbnN0IF9DVVNUT01fUEhfRVhQID1cbiAgICAvXFwvXFwvW1xcc1xcU10qaTE4bltcXHNcXFNdKlxcKFtcXHNcXFNdKnBoW1xcc1xcU10qPVtcXHNcXFNdKihcInwnKShbXFxzXFxTXSo/KVxcMVtcXHNcXFNdKlxcKS9nO1xuXG5mdW5jdGlvbiBleHRyYWN0UGxhY2Vob2xkZXJOYW1lKGlucHV0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaW5wdXQuc3BsaXQoX0NVU1RPTV9QSF9FWFApWzJdO1xufVxuIl19