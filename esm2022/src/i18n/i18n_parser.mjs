/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Lexer as ExpressionLexer } from '../expression_parser/lexer';
import { Parser as ExpressionParser } from '../expression_parser/parser';
import * as html from '../ml_parser/ast';
import { getHtmlTagDefinition } from '../ml_parser/html_tags';
import { ParseSourceSpan } from '../parse_util';
import * as i18n from './i18n_ast';
import { PlaceholderRegistry } from './serializers/placeholder';
const _expParser = new ExpressionParser(new ExpressionLexer());
/**
 * Returns a function converting html nodes to an i18n Message given an interpolationConfig
 */
export function createI18nMessageFactory(interpolationConfig) {
    const visitor = new _I18nVisitor(_expParser, interpolationConfig);
    return (nodes, meaning, description, customId, visitNodeFn) => visitor.toI18nMessage(nodes, meaning, description, customId, visitNodeFn);
}
function noopVisitNodeFn(_html, i18n) {
    return i18n;
}
class _I18nVisitor {
    constructor(_expressionParser, _interpolationConfig) {
        this._expressionParser = _expressionParser;
        this._interpolationConfig = _interpolationConfig;
    }
    toI18nMessage(nodes, meaning = '', description = '', customId = '', visitNodeFn) {
        const context = {
            isIcu: nodes.length == 1 && nodes[0] instanceof html.Expansion,
            icuDepth: 0,
            placeholderRegistry: new PlaceholderRegistry(),
            placeholderToContent: {},
            placeholderToMessage: {},
            visitNodeFn: visitNodeFn || noopVisitNodeFn,
        };
        const i18nodes = html.visitAll(this, nodes, context);
        return new i18n.Message(i18nodes, context.placeholderToContent, context.placeholderToMessage, meaning, description, customId);
    }
    visitElement(el, context) {
        const children = html.visitAll(this, el.children, context);
        const attrs = {};
        el.attrs.forEach(attr => {
            // Do not visit the attributes, translatable ones are top-level ASTs
            attrs[attr.name] = attr.value;
        });
        const isVoid = getHtmlTagDefinition(el.name).isVoid;
        const startPhName = context.placeholderRegistry.getStartTagPlaceholderName(el.name, attrs, isVoid);
        context.placeholderToContent[startPhName] = {
            text: el.startSourceSpan.toString(),
            sourceSpan: el.startSourceSpan,
        };
        let closePhName = '';
        if (!isVoid) {
            closePhName = context.placeholderRegistry.getCloseTagPlaceholderName(el.name);
            context.placeholderToContent[closePhName] = {
                text: `</${el.name}>`,
                sourceSpan: el.endSourceSpan ?? el.sourceSpan,
            };
        }
        const node = new i18n.TagPlaceholder(el.name, attrs, startPhName, closePhName, children, isVoid, el.sourceSpan, el.startSourceSpan, el.endSourceSpan);
        return context.visitNodeFn(el, node);
    }
    visitAttribute(attribute, context) {
        const node = attribute.valueTokens === undefined || attribute.valueTokens.length === 1 ?
            new i18n.Text(attribute.value, attribute.valueSpan || attribute.sourceSpan) :
            this._visitTextWithInterpolation(attribute.valueTokens, attribute.valueSpan || attribute.sourceSpan, context, attribute.i18n);
        return context.visitNodeFn(attribute, node);
    }
    visitText(text, context) {
        const node = text.tokens.length === 1 ?
            new i18n.Text(text.value, text.sourceSpan) :
            this._visitTextWithInterpolation(text.tokens, text.sourceSpan, context, text.i18n);
        return context.visitNodeFn(text, node);
    }
    visitComment(comment, context) {
        return null;
    }
    visitExpansion(icu, context) {
        context.icuDepth++;
        const i18nIcuCases = {};
        const i18nIcu = new i18n.Icu(icu.switchValue, icu.type, i18nIcuCases, icu.sourceSpan);
        icu.cases.forEach((caze) => {
            i18nIcuCases[caze.value] = new i18n.Container(caze.expression.map((node) => node.visit(this, context)), caze.expSourceSpan);
        });
        context.icuDepth--;
        if (context.isIcu || context.icuDepth > 0) {
            // Returns an ICU node when:
            // - the message (vs a part of the message) is an ICU message, or
            // - the ICU message is nested.
            const expPh = context.placeholderRegistry.getUniquePlaceholder(`VAR_${icu.type}`);
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
        const phName = context.placeholderRegistry.getPlaceholderName('ICU', icu.sourceSpan.toString());
        context.placeholderToMessage[phName] = this.toI18nMessage([icu], '', '', '', undefined);
        const node = new i18n.IcuPlaceholder(i18nIcu, phName, icu.sourceSpan);
        return context.visitNodeFn(icu, node);
    }
    visitExpansionCase(_icuCase, _context) {
        throw new Error('Unreachable code');
    }
    visitBlock(block, context) {
        const children = html.visitAll(this, block.children, context);
        const node = new i18n.Container(children, block.sourceSpan);
        return context.visitNodeFn(block, node);
    }
    visitBlockParameter(_parameter, _context) { }
    /**
     * Convert, text and interpolated tokens up into text and placeholder pieces.
     *
     * @param tokens The text and interpolated tokens.
     * @param sourceSpan The span of the whole of the `text` string.
     * @param context The current context of the visitor, used to compute and store placeholders.
     * @param previousI18n Any i18n metadata associated with this `text` from a previous pass.
     */
    _visitTextWithInterpolation(tokens, sourceSpan, context, previousI18n) {
        // Return a sequence of `Text` and `Placeholder` nodes grouped in a `Container`.
        const nodes = [];
        // We will only create a container if there are actually interpolations,
        // so this flag tracks that.
        let hasInterpolation = false;
        for (const token of tokens) {
            switch (token.type) {
                case 8 /* TokenType.INTERPOLATION */:
                case 17 /* TokenType.ATTR_VALUE_INTERPOLATION */:
                    hasInterpolation = true;
                    const expression = token.parts[1];
                    const baseName = extractPlaceholderName(expression) || 'INTERPOLATION';
                    const phName = context.placeholderRegistry.getPlaceholderName(baseName, expression);
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
                        const previous = nodes[nodes.length - 1];
                        if (previous instanceof i18n.Text) {
                            previous.value += token.parts[0];
                            previous.sourceSpan = new ParseSourceSpan(previous.sourceSpan.start, token.sourceSpan.end, previous.sourceSpan.fullStart, previous.sourceSpan.details);
                        }
                        else {
                            nodes.push(new i18n.Text(token.parts[0], token.sourceSpan));
                        }
                    }
                    break;
            }
        }
        if (hasInterpolation) {
            // Whitespace removal may have invalidated the interpolation source-spans.
            reusePreviousSourceSpans(nodes, previousI18n);
            return new i18n.Container(nodes, sourceSpan);
        }
        else {
            return nodes[0];
        }
    }
}
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
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].sourceSpan = previousI18n.children[i].sourceSpan;
        }
    }
}
/**
 * Asserts that the `message` contains exactly one `Container` node.
 */
function assertSingleContainerMessage(message) {
    const nodes = message.nodes;
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
    if (previousNodes.some((node, i) => nodes[i].constructor !== node.constructor)) {
        throw new Error('The types of the i18n message children changed between first and second pass.');
    }
}
const _CUSTOM_PH_EXP = /\/\/[\s\S]*i18n[\s\S]*\([\s\S]*ph[\s\S]*=[\s\S]*("|')([\s\S]*?)\1[\s\S]*\)/g;
function extractPlaceholderName(input) {
    return input.split(_CUSTOM_PH_EXP)[2];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9pMThuX3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsS0FBSyxJQUFJLGVBQWUsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ3BFLE9BQU8sRUFBQyxNQUFNLElBQUksZ0JBQWdCLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RSxPQUFPLEtBQUssSUFBSSxNQUFNLGtCQUFrQixDQUFDO0FBQ3pDLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRzVELE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFOUMsT0FBTyxLQUFLLElBQUksTUFBTSxZQUFZLENBQUM7QUFDbkMsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFFOUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLGVBQWUsRUFBRSxDQUFDLENBQUM7QUFTL0Q7O0dBRUc7QUFDSCxNQUFNLFVBQVUsd0JBQXdCLENBQUMsbUJBQXdDO0lBRS9FLE1BQU0sT0FBTyxHQUFHLElBQUksWUFBWSxDQUFDLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO0lBQ2xFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FDbkQsT0FBTyxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDdkYsQ0FBQztBQVdELFNBQVMsZUFBZSxDQUFDLEtBQWdCLEVBQUUsSUFBZTtJQUN4RCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxNQUFNLFlBQVk7SUFD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Q0FBQztBQUN4QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7TGV4ZXIgYXMgRXhwcmVzc2lvbkxleGVyfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlciBhcyBFeHByZXNzaW9uUGFyc2VyfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7Z2V0SHRtbFRhZ0RlZmluaXRpb259IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3RhZ3MnO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbiwgSW50ZXJwb2xhdGVkVGV4dFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4uL21sX3BhcnNlci90b2tlbnMnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4vaTE4bl9hc3QnO1xuaW1wb3J0IHtQbGFjZWhvbGRlclJlZ2lzdHJ5fSBmcm9tICcuL3NlcmlhbGl6ZXJzL3BsYWNlaG9sZGVyJztcblxuY29uc3QgX2V4cFBhcnNlciA9IG5ldyBFeHByZXNzaW9uUGFyc2VyKG5ldyBFeHByZXNzaW9uTGV4ZXIoKSk7XG5cbmV4cG9ydCB0eXBlIFZpc2l0Tm9kZUZuID0gKGh0bWw6IGh0bWwuTm9kZSwgaTE4bjogaTE4bi5Ob2RlKSA9PiBpMThuLk5vZGU7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSTE4bk1lc3NhZ2VGYWN0b3J5IHtcbiAgKG5vZGVzOiBodG1sLk5vZGVbXSwgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZCwgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQsXG4gICBjdXN0b21JZDogc3RyaW5nfHVuZGVmaW5lZCwgdmlzaXROb2RlRm4/OiBWaXNpdE5vZGVGbik6IGkxOG4uTWVzc2FnZTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZnVuY3Rpb24gY29udmVydGluZyBodG1sIG5vZGVzIHRvIGFuIGkxOG4gTWVzc2FnZSBnaXZlbiBhbiBpbnRlcnBvbGF0aW9uQ29uZmlnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJMThuTWVzc2FnZUZhY3RvcnkoaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6XG4gICAgSTE4bk1lc3NhZ2VGYWN0b3J5IHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfSTE4blZpc2l0b3IoX2V4cFBhcnNlciwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIHJldHVybiAobm9kZXMsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZCwgdmlzaXROb2RlRm4pID0+XG4gICAgICAgICAgICAgdmlzaXRvci50b0kxOG5NZXNzYWdlKG5vZGVzLCBtZWFuaW5nLCBkZXNjcmlwdGlvbiwgY3VzdG9tSWQsIHZpc2l0Tm9kZUZuKTtcbn1cblxuaW50ZXJmYWNlIEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQge1xuICBpc0ljdTogYm9vbGVhbjtcbiAgaWN1RGVwdGg6IG51bWJlcjtcbiAgcGxhY2Vob2xkZXJSZWdpc3RyeTogUGxhY2Vob2xkZXJSZWdpc3RyeTtcbiAgcGxhY2Vob2xkZXJUb0NvbnRlbnQ6IHtbcGhOYW1lOiBzdHJpbmddOiBpMThuLk1lc3NhZ2VQbGFjZWhvbGRlcn07XG4gIHBsYWNlaG9sZGVyVG9NZXNzYWdlOiB7W3BoTmFtZTogc3RyaW5nXTogaTE4bi5NZXNzYWdlfTtcbiAgdmlzaXROb2RlRm46IFZpc2l0Tm9kZUZuO1xufVxuXG5mdW5jdGlvbiBub29wVmlzaXROb2RlRm4oX2h0bWw6IGh0bWwuTm9kZSwgaTE4bjogaTE4bi5Ob2RlKTogaTE4bi5Ob2RlIHtcbiAgcmV0dXJuIGkxOG47XG59XG5cbmNsYXNzIF9JMThuVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBfZXhwcmVzc2lvblBhcnNlcjogRXhwcmVzc2lvblBhcnNlcixcbiAgICAgIHByaXZhdGUgX2ludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpIHt9XG5cbiAgcHVibGljIHRvSTE4bk1lc3NhZ2UoXG4gICAgICBub2RlczogaHRtbC5Ob2RlW10sIG1lYW5pbmcgPSAnJywgZGVzY3JpcHRpb24gPSAnJywgY3VzdG9tSWQgPSAnJyxcbiAgICAgIHZpc2l0Tm9kZUZuOiBWaXNpdE5vZGVGbnx1bmRlZmluZWQpOiBpMThuLk1lc3NhZ2Uge1xuICAgIGNvbnN0IGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQgPSB7XG4gICAgICBpc0ljdTogbm9kZXMubGVuZ3RoID09IDEgJiYgbm9kZXNbMF0gaW5zdGFuY2VvZiBodG1sLkV4cGFuc2lvbixcbiAgICAgIGljdURlcHRoOiAwLFxuICAgICAgcGxhY2Vob2xkZXJSZWdpc3RyeTogbmV3IFBsYWNlaG9sZGVyUmVnaXN0cnkoKSxcbiAgICAgIHBsYWNlaG9sZGVyVG9Db250ZW50OiB7fSxcbiAgICAgIHBsYWNlaG9sZGVyVG9NZXNzYWdlOiB7fSxcbiAgICAgIHZpc2l0Tm9kZUZuOiB2aXNpdE5vZGVGbiB8fCBub29wVmlzaXROb2RlRm4sXG4gICAgfTtcblxuICAgIGNvbnN0IGkxOG5vZGVzOiBpMThuLk5vZGVbXSA9IGh0bWwudmlzaXRBbGwodGhpcywgbm9kZXMsIGNvbnRleHQpO1xuXG4gICAgcmV0dXJuIG5ldyBpMThuLk1lc3NhZ2UoXG4gICAgICAgIGkxOG5vZGVzLCBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50LCBjb250ZXh0LnBsYWNlaG9sZGVyVG9NZXNzYWdlLCBtZWFuaW5nLCBkZXNjcmlwdGlvbixcbiAgICAgICAgY3VzdG9tSWQpO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsOiBodG1sLkVsZW1lbnQsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh0aGlzLCBlbC5jaGlsZHJlbiwgY29udGV4dCk7XG4gICAgY29uc3QgYXR0cnM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGVsLmF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICAvLyBEbyBub3QgdmlzaXQgdGhlIGF0dHJpYnV0ZXMsIHRyYW5zbGF0YWJsZSBvbmVzIGFyZSB0b3AtbGV2ZWwgQVNUc1xuICAgICAgYXR0cnNbYXR0ci5uYW1lXSA9IGF0dHIudmFsdWU7XG4gICAgfSk7XG5cbiAgICBjb25zdCBpc1ZvaWQ6IGJvb2xlYW4gPSBnZXRIdG1sVGFnRGVmaW5pdGlvbihlbC5uYW1lKS5pc1ZvaWQ7XG4gICAgY29uc3Qgc3RhcnRQaE5hbWUgPVxuICAgICAgICBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0U3RhcnRUYWdQbGFjZWhvbGRlck5hbWUoZWwubmFtZSwgYXR0cnMsIGlzVm9pZCk7XG4gICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudFtzdGFydFBoTmFtZV0gPSB7XG4gICAgICB0ZXh0OiBlbC5zdGFydFNvdXJjZVNwYW4udG9TdHJpbmcoKSxcbiAgICAgIHNvdXJjZVNwYW46IGVsLnN0YXJ0U291cmNlU3BhbixcbiAgICB9O1xuXG4gICAgbGV0IGNsb3NlUGhOYW1lID0gJyc7XG5cbiAgICBpZiAoIWlzVm9pZCkge1xuICAgICAgY2xvc2VQaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0Q2xvc2VUYWdQbGFjZWhvbGRlck5hbWUoZWwubmFtZSk7XG4gICAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W2Nsb3NlUGhOYW1lXSA9IHtcbiAgICAgICAgdGV4dDogYDwvJHtlbC5uYW1lfT5gLFxuICAgICAgICBzb3VyY2VTcGFuOiBlbC5lbmRTb3VyY2VTcGFuID8/IGVsLnNvdXJjZVNwYW4sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGUgPSBuZXcgaTE4bi5UYWdQbGFjZWhvbGRlcihcbiAgICAgICAgZWwubmFtZSwgYXR0cnMsIHN0YXJ0UGhOYW1lLCBjbG9zZVBoTmFtZSwgY2hpbGRyZW4sIGlzVm9pZCwgZWwuc291cmNlU3BhbixcbiAgICAgICAgZWwuc3RhcnRTb3VyY2VTcGFuLCBlbC5lbmRTb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbihlbCwgbm9kZSk7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICBjb25zdCBub2RlID0gYXR0cmlidXRlLnZhbHVlVG9rZW5zID09PSB1bmRlZmluZWQgfHwgYXR0cmlidXRlLnZhbHVlVG9rZW5zLmxlbmd0aCA9PT0gMSA/XG4gICAgICAgIG5ldyBpMThuLlRleHQoYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IGF0dHJpYnV0ZS5zb3VyY2VTcGFuKSA6XG4gICAgICAgIHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlVG9rZW5zLCBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBjb250ZXh0LFxuICAgICAgICAgICAgYXR0cmlidXRlLmkxOG4pO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGF0dHJpYnV0ZSwgbm9kZSk7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICBjb25zdCBub2RlID0gdGV4dC50b2tlbnMubGVuZ3RoID09PSAxID9cbiAgICAgICAgbmV3IGkxOG4uVGV4dCh0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4pIDpcbiAgICAgICAgdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24odGV4dC50b2tlbnMsIHRleHQuc291cmNlU3BhbiwgY29udGV4dCwgdGV4dC5pMThuKTtcbiAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbih0ZXh0LCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGV8bnVsbCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihpY3U6IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICBjb250ZXh0LmljdURlcHRoKys7XG4gICAgY29uc3QgaTE4bkljdUNhc2VzOiB7W2s6IHN0cmluZ106IGkxOG4uTm9kZX0gPSB7fTtcbiAgICBjb25zdCBpMThuSWN1ID0gbmV3IGkxOG4uSWN1KGljdS5zd2l0Y2hWYWx1ZSwgaWN1LnR5cGUsIGkxOG5JY3VDYXNlcywgaWN1LnNvdXJjZVNwYW4pO1xuICAgIGljdS5jYXNlcy5mb3JFYWNoKChjYXplKTogdm9pZCA9PiB7XG4gICAgICBpMThuSWN1Q2FzZXNbY2F6ZS52YWx1ZV0gPSBuZXcgaTE4bi5Db250YWluZXIoXG4gICAgICAgICAgY2F6ZS5leHByZXNzaW9uLm1hcCgobm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzLCBjb250ZXh0KSksIGNhemUuZXhwU291cmNlU3Bhbik7XG4gICAgfSk7XG4gICAgY29udGV4dC5pY3VEZXB0aC0tO1xuXG4gICAgaWYgKGNvbnRleHQuaXNJY3UgfHwgY29udGV4dC5pY3VEZXB0aCA+IDApIHtcbiAgICAgIC8vIFJldHVybnMgYW4gSUNVIG5vZGUgd2hlbjpcbiAgICAgIC8vIC0gdGhlIG1lc3NhZ2UgKHZzIGEgcGFydCBvZiB0aGUgbWVzc2FnZSkgaXMgYW4gSUNVIG1lc3NhZ2UsIG9yXG4gICAgICAvLyAtIHRoZSBJQ1UgbWVzc2FnZSBpcyBuZXN0ZWQuXG4gICAgICBjb25zdCBleHBQaCA9IGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRVbmlxdWVQbGFjZWhvbGRlcihgVkFSXyR7aWN1LnR5cGV9YCk7XG4gICAgICBpMThuSWN1LmV4cHJlc3Npb25QbGFjZWhvbGRlciA9IGV4cFBoO1xuICAgICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudFtleHBQaF0gPSB7XG4gICAgICAgIHRleHQ6IGljdS5zd2l0Y2hWYWx1ZSxcbiAgICAgICAgc291cmNlU3BhbjogaWN1LnN3aXRjaFZhbHVlU291cmNlU3BhbixcbiAgICAgIH07XG4gICAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbihpY3UsIGkxOG5JY3UpO1xuICAgIH1cblxuICAgIC8vIEVsc2UgcmV0dXJucyBhIHBsYWNlaG9sZGVyXG4gICAgLy8gSUNVIHBsYWNlaG9sZGVycyBzaG91bGQgbm90IGJlIHJlcGxhY2VkIHdpdGggdGhlaXIgb3JpZ2luYWwgY29udGVudCBidXQgd2l0aCB0aGUgdGhlaXJcbiAgICAvLyB0cmFuc2xhdGlvbnMuXG4gICAgLy8gVE9ETyh2aWNiKTogYWRkIGEgaHRtbC5Ob2RlIC0+IGkxOG4uTWVzc2FnZSBjYWNoZSB0byBhdm9pZCBoYXZpbmcgdG8gcmUtY3JlYXRlIHRoZSBtc2dcbiAgICBjb25zdCBwaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0UGxhY2Vob2xkZXJOYW1lKCdJQ1UnLCBpY3Uuc291cmNlU3Bhbi50b1N0cmluZygpKTtcbiAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9NZXNzYWdlW3BoTmFtZV0gPSB0aGlzLnRvSTE4bk1lc3NhZ2UoW2ljdV0sICcnLCAnJywgJycsIHVuZGVmaW5lZCk7XG4gICAgY29uc3Qgbm9kZSA9IG5ldyBpMThuLkljdVBsYWNlaG9sZGVyKGkxOG5JY3UsIHBoTmFtZSwgaWN1LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGljdSwgbm9kZSk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoX2ljdUNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgX2NvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5yZWFjaGFibGUgY29kZScpO1xuICB9XG5cbiAgdmlzaXRCbG9jayhibG9jazogaHRtbC5CbG9jaywgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCkge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbiwgY29udGV4dCk7XG4gICAgY29uc3Qgbm9kZSA9IG5ldyBpMThuLkNvbnRhaW5lcihjaGlsZHJlbiwgYmxvY2suc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGNvbnRleHQudmlzaXROb2RlRm4oYmxvY2ssIG5vZGUpO1xuICB9XG5cbiAgdmlzaXRCbG9ja1BhcmFtZXRlcihfcGFyYW1ldGVyOiBodG1sLkJsb2NrUGFyYW1ldGVyLCBfY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCkge31cblxuICAvKipcbiAgICogQ29udmVydCwgdGV4dCBhbmQgaW50ZXJwb2xhdGVkIHRva2VucyB1cCBpbnRvIHRleHQgYW5kIHBsYWNlaG9sZGVyIHBpZWNlcy5cbiAgICpcbiAgICogQHBhcmFtIHRva2VucyBUaGUgdGV4dCBhbmQgaW50ZXJwb2xhdGVkIHRva2Vucy5cbiAgICogQHBhcmFtIHNvdXJjZVNwYW4gVGhlIHNwYW4gb2YgdGhlIHdob2xlIG9mIHRoZSBgdGV4dGAgc3RyaW5nLlxuICAgKiBAcGFyYW0gY29udGV4dCBUaGUgY3VycmVudCBjb250ZXh0IG9mIHRoZSB2aXNpdG9yLCB1c2VkIHRvIGNvbXB1dGUgYW5kIHN0b3JlIHBsYWNlaG9sZGVycy5cbiAgICogQHBhcmFtIHByZXZpb3VzSTE4biBBbnkgaTE4biBtZXRhZGF0YSBhc3NvY2lhdGVkIHdpdGggdGhpcyBgdGV4dGAgZnJvbSBhIHByZXZpb3VzIHBhc3MuXG4gICAqL1xuICBwcml2YXRlIF92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbihcbiAgICAgIHRva2VuczogKEludGVycG9sYXRlZFRleHRUb2tlbnxJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbilbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCwgcHJldmlvdXNJMThuOiBpMThuLkkxOG5NZXRhfHVuZGVmaW5lZCk6IGkxOG4uTm9kZSB7XG4gICAgLy8gUmV0dXJuIGEgc2VxdWVuY2Ugb2YgYFRleHRgIGFuZCBgUGxhY2Vob2xkZXJgIG5vZGVzIGdyb3VwZWQgaW4gYSBgQ29udGFpbmVyYC5cbiAgICBjb25zdCBub2RlczogaTE4bi5Ob2RlW10gPSBbXTtcbiAgICAvLyBXZSB3aWxsIG9ubHkgY3JlYXRlIGEgY29udGFpbmVyIGlmIHRoZXJlIGFyZSBhY3R1YWxseSBpbnRlcnBvbGF0aW9ucyxcbiAgICAvLyBzbyB0aGlzIGZsYWcgdHJhY2tzIHRoYXQuXG4gICAgbGV0IGhhc0ludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHRva2Vucykge1xuICAgICAgc3dpdGNoICh0b2tlbi50eXBlKSB7XG4gICAgICAgIGNhc2UgVG9rZW5UeXBlLklOVEVSUE9MQVRJT046XG4gICAgICAgIGNhc2UgVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTjpcbiAgICAgICAgICBoYXNJbnRlcnBvbGF0aW9uID0gdHJ1ZTtcbiAgICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdG9rZW4ucGFydHNbMV07XG4gICAgICAgICAgY29uc3QgYmFzZU5hbWUgPSBleHRyYWN0UGxhY2Vob2xkZXJOYW1lKGV4cHJlc3Npb24pIHx8ICdJTlRFUlBPTEFUSU9OJztcbiAgICAgICAgICBjb25zdCBwaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0UGxhY2Vob2xkZXJOYW1lKGJhc2VOYW1lLCBleHByZXNzaW9uKTtcbiAgICAgICAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W3BoTmFtZV0gPSB7XG4gICAgICAgICAgICB0ZXh0OiB0b2tlbi5wYXJ0cy5qb2luKCcnKSxcbiAgICAgICAgICAgIHNvdXJjZVNwYW46IHRva2VuLnNvdXJjZVNwYW5cbiAgICAgICAgICB9O1xuICAgICAgICAgIG5vZGVzLnB1c2gobmV3IGkxOG4uUGxhY2Vob2xkZXIoZXhwcmVzc2lvbiwgcGhOYW1lLCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKHRva2VuLnBhcnRzWzBdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIFRoaXMgdG9rZW4gaXMgdGV4dCBvciBhbiBlbmNvZGVkIGVudGl0eS5cbiAgICAgICAgICAgIC8vIElmIGl0IGlzIGZvbGxvd2luZyBvbiBmcm9tIGEgcHJldmlvdXMgdGV4dCBub2RlIHRoZW4gbWVyZ2UgaXQgaW50byB0aGF0IG5vZGVcbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgaWYgaXQgaXMgZm9sbG93aW5nIGFuIGludGVycG9sYXRpb24sIHRoZW4gYWRkIGEgbmV3IG5vZGUuXG4gICAgICAgICAgICBjb25zdCBwcmV2aW91cyA9IG5vZGVzW25vZGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgaWYgKHByZXZpb3VzIGluc3RhbmNlb2YgaTE4bi5UZXh0KSB7XG4gICAgICAgICAgICAgIHByZXZpb3VzLnZhbHVlICs9IHRva2VuLnBhcnRzWzBdO1xuICAgICAgICAgICAgICBwcmV2aW91cy5zb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgICAgICAgIHByZXZpb3VzLnNvdXJjZVNwYW4uc3RhcnQsIHRva2VuLnNvdXJjZVNwYW4uZW5kLCBwcmV2aW91cy5zb3VyY2VTcGFuLmZ1bGxTdGFydCxcbiAgICAgICAgICAgICAgICAgIHByZXZpb3VzLnNvdXJjZVNwYW4uZGV0YWlscyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBub2Rlcy5wdXNoKG5ldyBpMThuLlRleHQodG9rZW4ucGFydHNbMF0sIHRva2VuLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGhhc0ludGVycG9sYXRpb24pIHtcbiAgICAgIC8vIFdoaXRlc3BhY2UgcmVtb3ZhbCBtYXkgaGF2ZSBpbnZhbGlkYXRlZCB0aGUgaW50ZXJwb2xhdGlvbiBzb3VyY2Utc3BhbnMuXG4gICAgICByZXVzZVByZXZpb3VzU291cmNlU3BhbnMobm9kZXMsIHByZXZpb3VzSTE4bik7XG4gICAgICByZXR1cm4gbmV3IGkxOG4uQ29udGFpbmVyKG5vZGVzLCBzb3VyY2VTcGFuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5vZGVzWzBdO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlLXVzZSB0aGUgc291cmNlLXNwYW5zIGZyb20gYHByZXZpb3VzSTE4bmAgbWV0YWRhdGEgZm9yIHRoZSBgbm9kZXNgLlxuICpcbiAqIFdoaXRlc3BhY2UgcmVtb3ZhbCBjYW4gaW52YWxpZGF0ZSB0aGUgc291cmNlLXNwYW5zIG9mIGludGVycG9sYXRpb24gbm9kZXMsIHNvIHdlXG4gKiByZXVzZSB0aGUgc291cmNlLXNwYW4gc3RvcmVkIGZyb20gYSBwcmV2aW91cyBwYXNzIGJlZm9yZSB0aGUgd2hpdGVzcGFjZSB3YXMgcmVtb3ZlZC5cbiAqXG4gKiBAcGFyYW0gbm9kZXMgVGhlIGBUZXh0YCBhbmQgYFBsYWNlaG9sZGVyYCBub2RlcyB0byBiZSBwcm9jZXNzZWQuXG4gKiBAcGFyYW0gcHJldmlvdXNJMThuIEFueSBpMThuIG1ldGFkYXRhIGZvciB0aGVzZSBgbm9kZXNgIHN0b3JlZCBmcm9tIGEgcHJldmlvdXMgcGFzcy5cbiAqL1xuZnVuY3Rpb24gcmV1c2VQcmV2aW91c1NvdXJjZVNwYW5zKG5vZGVzOiBpMThuLk5vZGVbXSwgcHJldmlvdXNJMThuOiBpMThuLkkxOG5NZXRhfHVuZGVmaW5lZCk6IHZvaWQge1xuICBpZiAocHJldmlvdXNJMThuIGluc3RhbmNlb2YgaTE4bi5NZXNzYWdlKSB7XG4gICAgLy8gVGhlIGBwcmV2aW91c0kxOG5gIGlzIGFuIGkxOG4gYE1lc3NhZ2VgLCBzbyB3ZSBhcmUgcHJvY2Vzc2luZyBhbiBgQXR0cmlidXRlYCB3aXRoIGkxOG5cbiAgICAvLyBtZXRhZGF0YS4gVGhlIGBNZXNzYWdlYCBzaG91bGQgY29uc2lzdCBvbmx5IG9mIGEgc2luZ2xlIGBDb250YWluZXJgIHRoYXQgY29udGFpbnMgdGhlXG4gICAgLy8gcGFydHMgKGBUZXh0YCBhbmQgYFBsYWNlaG9sZGVyYCkgdG8gcHJvY2Vzcy5cbiAgICBhc3NlcnRTaW5nbGVDb250YWluZXJNZXNzYWdlKHByZXZpb3VzSTE4bik7XG4gICAgcHJldmlvdXNJMThuID0gcHJldmlvdXNJMThuLm5vZGVzWzBdO1xuICB9XG5cbiAgaWYgKHByZXZpb3VzSTE4biBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSB7XG4gICAgLy8gVGhlIGBwcmV2aW91c0kxOG5gIGlzIGEgYENvbnRhaW5lcmAsIHdoaWNoIG1lYW5zIHRoYXQgdGhpcyBpcyBhIHNlY29uZCBpMThuIGV4dHJhY3Rpb24gcGFzc1xuICAgIC8vIGFmdGVyIHdoaXRlc3BhY2UgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBBU1Qgbm9kZXMuXG4gICAgYXNzZXJ0RXF1aXZhbGVudE5vZGVzKHByZXZpb3VzSTE4bi5jaGlsZHJlbiwgbm9kZXMpO1xuXG4gICAgLy8gUmV1c2UgdGhlIHNvdXJjZS1zcGFucyBmcm9tIHRoZSBmaXJzdCBwYXNzLlxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIG5vZGVzW2ldLnNvdXJjZVNwYW4gPSBwcmV2aW91c0kxOG4uY2hpbGRyZW5baV0uc291cmNlU3BhbjtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnRzIHRoYXQgdGhlIGBtZXNzYWdlYCBjb250YWlucyBleGFjdGx5IG9uZSBgQ29udGFpbmVyYCBub2RlLlxuICovXG5mdW5jdGlvbiBhc3NlcnRTaW5nbGVDb250YWluZXJNZXNzYWdlKG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSk6IHZvaWQge1xuICBjb25zdCBub2RlcyA9IG1lc3NhZ2Uubm9kZXM7XG4gIGlmIChub2Rlcy5sZW5ndGggIT09IDEgfHwgIShub2Rlc1swXSBpbnN0YW5jZW9mIGkxOG4uQ29udGFpbmVyKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1VuZXhwZWN0ZWQgcHJldmlvdXMgaTE4biBtZXNzYWdlIC0gZXhwZWN0ZWQgaXQgdG8gY29uc2lzdCBvZiBvbmx5IGEgc2luZ2xlIGBDb250YWluZXJgIG5vZGUuJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnRzIHRoYXQgdGhlIGBwcmV2aW91c05vZGVzYCBhbmQgYG5vZGVgIGNvbGxlY3Rpb25zIGhhdmUgdGhlIHNhbWUgbnVtYmVyIG9mIGVsZW1lbnRzIGFuZFxuICogY29ycmVzcG9uZGluZyBlbGVtZW50cyBoYXZlIHRoZSBzYW1lIG5vZGUgdHlwZS5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0RXF1aXZhbGVudE5vZGVzKHByZXZpb3VzTm9kZXM6IGkxOG4uTm9kZVtdLCBub2RlczogaTE4bi5Ob2RlW10pOiB2b2lkIHtcbiAgaWYgKHByZXZpb3VzTm9kZXMubGVuZ3RoICE9PSBub2Rlcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBudW1iZXIgb2YgaTE4biBtZXNzYWdlIGNoaWxkcmVuIGNoYW5nZWQgYmV0d2VlbiBmaXJzdCBhbmQgc2Vjb25kIHBhc3MuJyk7XG4gIH1cbiAgaWYgKHByZXZpb3VzTm9kZXMuc29tZSgobm9kZSwgaSkgPT4gbm9kZXNbaV0uY29uc3RydWN0b3IgIT09IG5vZGUuY29uc3RydWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnVGhlIHR5cGVzIG9mIHRoZSBpMThuIG1lc3NhZ2UgY2hpbGRyZW4gY2hhbmdlZCBiZXR3ZWVuIGZpcnN0IGFuZCBzZWNvbmQgcGFzcy4nKTtcbiAgfVxufVxuXG5jb25zdCBfQ1VTVE9NX1BIX0VYUCA9XG4gICAgL1xcL1xcL1tcXHNcXFNdKmkxOG5bXFxzXFxTXSpcXChbXFxzXFxTXSpwaFtcXHNcXFNdKj1bXFxzXFxTXSooXCJ8JykoW1xcc1xcU10qPylcXDFbXFxzXFxTXSpcXCkvZztcblxuZnVuY3Rpb24gZXh0cmFjdFBsYWNlaG9sZGVyTmFtZShpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlucHV0LnNwbGl0KF9DVVNUT01fUEhfRVhQKVsyXTtcbn1cbiJdfQ==