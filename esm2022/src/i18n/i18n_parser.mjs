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
export function createI18nMessageFactory(interpolationConfig, containerBlocks) {
    const visitor = new _I18nVisitor(_expParser, interpolationConfig, containerBlocks);
    return (nodes, meaning, description, customId, visitNodeFn) => visitor.toI18nMessage(nodes, meaning, description, customId, visitNodeFn);
}
function noopVisitNodeFn(_html, i18n) {
    return i18n;
}
class _I18nVisitor {
    constructor(_expressionParser, _interpolationConfig, _containerBlocks) {
        this._expressionParser = _expressionParser;
        this._interpolationConfig = _interpolationConfig;
        this._containerBlocks = _containerBlocks;
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
        el.attrs.forEach((attr) => {
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
        const node = attribute.valueTokens === undefined || attribute.valueTokens.length === 1
            ? new i18n.Text(attribute.value, attribute.valueSpan || attribute.sourceSpan)
            : this._visitTextWithInterpolation(attribute.valueTokens, attribute.valueSpan || attribute.sourceSpan, context, attribute.i18n);
        return context.visitNodeFn(attribute, node);
    }
    visitText(text, context) {
        const node = text.tokens.length === 1
            ? new i18n.Text(text.value, text.sourceSpan)
            : this._visitTextWithInterpolation(text.tokens, text.sourceSpan, context, text.i18n);
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
        if (this._containerBlocks.has(block.name)) {
            return new i18n.Container(children, block.sourceSpan);
        }
        const parameters = block.parameters.map((param) => param.expression);
        const startPhName = context.placeholderRegistry.getStartBlockPlaceholderName(block.name, parameters);
        const closePhName = context.placeholderRegistry.getCloseBlockPlaceholderName(block.name);
        context.placeholderToContent[startPhName] = {
            text: block.startSourceSpan.toString(),
            sourceSpan: block.startSourceSpan,
        };
        context.placeholderToContent[closePhName] = {
            text: block.endSourceSpan ? block.endSourceSpan.toString() : '}',
            sourceSpan: block.endSourceSpan ?? block.sourceSpan,
        };
        const node = new i18n.BlockPlaceholder(block.name, parameters, startPhName, closePhName, children, block.sourceSpan, block.startSourceSpan, block.endSourceSpan);
        return context.visitNodeFn(block, node);
    }
    visitBlockParameter(_parameter, _context) {
        throw new Error('Unreachable code');
    }
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
                        sourceSpan: token.sourceSpan,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9pMThuX3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsS0FBSyxJQUFJLGVBQWUsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ3BFLE9BQU8sRUFBQyxNQUFNLElBQUksZ0JBQWdCLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RSxPQUFPLEtBQUssSUFBSSxNQUFNLGtCQUFrQixDQUFDO0FBRXpDLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRTVELE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFOUMsT0FBTyxLQUFLLElBQUksTUFBTSxZQUFZLENBQUM7QUFDbkMsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFFOUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLGVBQWUsRUFBRSxDQUFDLENBQUM7QUFjL0Q7O0dBRUc7QUFDSCxNQUFNLFVBQVUsd0JBQXdCLENBQ3RDLG1CQUF3QyxFQUN4QyxlQUE0QjtJQUU1QixNQUFNLE9BQU8sR0FBRyxJQUFJLFlBQVksQ0FBQyxVQUFVLEVBQUUsbUJBQW1CLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDbkYsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUM1RCxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUM5RSxDQUFDO0FBV0QsU0FBUyxlQUFlLENBQUMsS0FBZ0IsRUFBRSxJQUFlO0lBQ3hELE9BQU8sSUFBSSxDQUFDO0FBQ2Qs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QyxXQUFXLEtBQUssSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7UUFDL0UsTUFBTSxJQUFJLEtBQUssQ0FDYiwrRUFBK0UsQ0FDaEYsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDO0FBRUQsTUFBTSxjQUFjLEdBQ2xCLDZFQUE2RSxDQUFDO0FBRWhGLFNBQVMsc0JBQXNCLENBQUMsS0FBYTtJQUMzQyxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0xleGVyIGFzIEV4cHJlc3Npb25MZXhlcn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtQYXJzZXIgYXMgRXhwcmVzc2lvblBhcnNlcn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0ludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9kZWZhdWx0cyc7XG5pbXBvcnQge2dldEh0bWxUYWdEZWZpbml0aW9ufSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF90YWdzJztcbmltcG9ydCB7SW50ZXJwb2xhdGVkQXR0cmlidXRlVG9rZW4sIEludGVycG9sYXRlZFRleHRUb2tlbiwgVG9rZW5UeXBlfSBmcm9tICcuLi9tbF9wYXJzZXIvdG9rZW5zJztcbmltcG9ydCB7UGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuL2kxOG5fYXN0JztcbmltcG9ydCB7UGxhY2Vob2xkZXJSZWdpc3RyeX0gZnJvbSAnLi9zZXJpYWxpemVycy9wbGFjZWhvbGRlcic7XG5cbmNvbnN0IF9leHBQYXJzZXIgPSBuZXcgRXhwcmVzc2lvblBhcnNlcihuZXcgRXhwcmVzc2lvbkxleGVyKCkpO1xuXG5leHBvcnQgdHlwZSBWaXNpdE5vZGVGbiA9IChodG1sOiBodG1sLk5vZGUsIGkxOG46IGkxOG4uTm9kZSkgPT4gaTE4bi5Ob2RlO1xuXG5leHBvcnQgaW50ZXJmYWNlIEkxOG5NZXNzYWdlRmFjdG9yeSB7XG4gIChcbiAgICBub2RlczogaHRtbC5Ob2RlW10sXG4gICAgbWVhbmluZzogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gICAgY3VzdG9tSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICB2aXNpdE5vZGVGbj86IFZpc2l0Tm9kZUZuLFxuICApOiBpMThuLk1lc3NhZ2U7XG59XG5cbi8qKlxuICogUmV0dXJucyBhIGZ1bmN0aW9uIGNvbnZlcnRpbmcgaHRtbCBub2RlcyB0byBhbiBpMThuIE1lc3NhZ2UgZ2l2ZW4gYW4gaW50ZXJwb2xhdGlvbkNvbmZpZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSTE4bk1lc3NhZ2VGYWN0b3J5KFxuICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnLFxuICBjb250YWluZXJCbG9ja3M6IFNldDxzdHJpbmc+LFxuKTogSTE4bk1lc3NhZ2VGYWN0b3J5IHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfSTE4blZpc2l0b3IoX2V4cFBhcnNlciwgaW50ZXJwb2xhdGlvbkNvbmZpZywgY29udGFpbmVyQmxvY2tzKTtcbiAgcmV0dXJuIChub2RlcywgbWVhbmluZywgZGVzY3JpcHRpb24sIGN1c3RvbUlkLCB2aXNpdE5vZGVGbikgPT5cbiAgICB2aXNpdG9yLnRvSTE4bk1lc3NhZ2Uobm9kZXMsIG1lYW5pbmcsIGRlc2NyaXB0aW9uLCBjdXN0b21JZCwgdmlzaXROb2RlRm4pO1xufVxuXG5pbnRlcmZhY2UgSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCB7XG4gIGlzSWN1OiBib29sZWFuO1xuICBpY3VEZXB0aDogbnVtYmVyO1xuICBwbGFjZWhvbGRlclJlZ2lzdHJ5OiBQbGFjZWhvbGRlclJlZ2lzdHJ5O1xuICBwbGFjZWhvbGRlclRvQ29udGVudDoge1twaE5hbWU6IHN0cmluZ106IGkxOG4uTWVzc2FnZVBsYWNlaG9sZGVyfTtcbiAgcGxhY2Vob2xkZXJUb01lc3NhZ2U6IHtbcGhOYW1lOiBzdHJpbmddOiBpMThuLk1lc3NhZ2V9O1xuICB2aXNpdE5vZGVGbjogVmlzaXROb2RlRm47XG59XG5cbmZ1bmN0aW9uIG5vb3BWaXNpdE5vZGVGbihfaHRtbDogaHRtbC5Ob2RlLCBpMThuOiBpMThuLk5vZGUpOiBpMThuLk5vZGUge1xuICByZXR1cm4gaTE4bjtcbn1cblxuY2xhc3MgX0kxOG5WaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBfZXhwcmVzc2lvblBhcnNlcjogRXhwcmVzc2lvblBhcnNlcixcbiAgICBwcml2YXRlIF9pbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnLFxuICAgIHByaXZhdGUgX2NvbnRhaW5lckJsb2NrczogU2V0PHN0cmluZz4sXG4gICkge31cblxuICBwdWJsaWMgdG9JMThuTWVzc2FnZShcbiAgICBub2RlczogaHRtbC5Ob2RlW10sXG4gICAgbWVhbmluZyA9ICcnLFxuICAgIGRlc2NyaXB0aW9uID0gJycsXG4gICAgY3VzdG9tSWQgPSAnJyxcbiAgICB2aXNpdE5vZGVGbjogVmlzaXROb2RlRm4gfCB1bmRlZmluZWQsXG4gICk6IGkxOG4uTWVzc2FnZSB7XG4gICAgY29uc3QgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCA9IHtcbiAgICAgIGlzSWN1OiBub2Rlcy5sZW5ndGggPT0gMSAmJiBub2Rlc1swXSBpbnN0YW5jZW9mIGh0bWwuRXhwYW5zaW9uLFxuICAgICAgaWN1RGVwdGg6IDAsXG4gICAgICBwbGFjZWhvbGRlclJlZ2lzdHJ5OiBuZXcgUGxhY2Vob2xkZXJSZWdpc3RyeSgpLFxuICAgICAgcGxhY2Vob2xkZXJUb0NvbnRlbnQ6IHt9LFxuICAgICAgcGxhY2Vob2xkZXJUb01lc3NhZ2U6IHt9LFxuICAgICAgdmlzaXROb2RlRm46IHZpc2l0Tm9kZUZuIHx8IG5vb3BWaXNpdE5vZGVGbixcbiAgICB9O1xuXG4gICAgY29uc3QgaTE4bm9kZXM6IGkxOG4uTm9kZVtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBub2RlcywgY29udGV4dCk7XG5cbiAgICByZXR1cm4gbmV3IGkxOG4uTWVzc2FnZShcbiAgICAgIGkxOG5vZGVzLFxuICAgICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudCxcbiAgICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb01lc3NhZ2UsXG4gICAgICBtZWFuaW5nLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgICBjdXN0b21JZCxcbiAgICApO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsOiBodG1sLkVsZW1lbnQsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh0aGlzLCBlbC5jaGlsZHJlbiwgY29udGV4dCk7XG4gICAgY29uc3QgYXR0cnM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGVsLmF0dHJzLmZvckVhY2goKGF0dHIpID0+IHtcbiAgICAgIC8vIERvIG5vdCB2aXNpdCB0aGUgYXR0cmlidXRlcywgdHJhbnNsYXRhYmxlIG9uZXMgYXJlIHRvcC1sZXZlbCBBU1RzXG4gICAgICBhdHRyc1thdHRyLm5hbWVdID0gYXR0ci52YWx1ZTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGlzVm9pZDogYm9vbGVhbiA9IGdldEh0bWxUYWdEZWZpbml0aW9uKGVsLm5hbWUpLmlzVm9pZDtcbiAgICBjb25zdCBzdGFydFBoTmFtZSA9IGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRTdGFydFRhZ1BsYWNlaG9sZGVyTmFtZShcbiAgICAgIGVsLm5hbWUsXG4gICAgICBhdHRycyxcbiAgICAgIGlzVm9pZCxcbiAgICApO1xuICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb0NvbnRlbnRbc3RhcnRQaE5hbWVdID0ge1xuICAgICAgdGV4dDogZWwuc3RhcnRTb3VyY2VTcGFuLnRvU3RyaW5nKCksXG4gICAgICBzb3VyY2VTcGFuOiBlbC5zdGFydFNvdXJjZVNwYW4sXG4gICAgfTtcblxuICAgIGxldCBjbG9zZVBoTmFtZSA9ICcnO1xuXG4gICAgaWYgKCFpc1ZvaWQpIHtcbiAgICAgIGNsb3NlUGhOYW1lID0gY29udGV4dC5wbGFjZWhvbGRlclJlZ2lzdHJ5LmdldENsb3NlVGFnUGxhY2Vob2xkZXJOYW1lKGVsLm5hbWUpO1xuICAgICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudFtjbG9zZVBoTmFtZV0gPSB7XG4gICAgICAgIHRleHQ6IGA8LyR7ZWwubmFtZX0+YCxcbiAgICAgICAgc291cmNlU3BhbjogZWwuZW5kU291cmNlU3BhbiA/PyBlbC5zb3VyY2VTcGFuLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlID0gbmV3IGkxOG4uVGFnUGxhY2Vob2xkZXIoXG4gICAgICBlbC5uYW1lLFxuICAgICAgYXR0cnMsXG4gICAgICBzdGFydFBoTmFtZSxcbiAgICAgIGNsb3NlUGhOYW1lLFxuICAgICAgY2hpbGRyZW4sXG4gICAgICBpc1ZvaWQsXG4gICAgICBlbC5zb3VyY2VTcGFuLFxuICAgICAgZWwuc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgZWwuZW5kU291cmNlU3BhbixcbiAgICApO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGVsLCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnN0IG5vZGUgPVxuICAgICAgYXR0cmlidXRlLnZhbHVlVG9rZW5zID09PSB1bmRlZmluZWQgfHwgYXR0cmlidXRlLnZhbHVlVG9rZW5zLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IG5ldyBpMThuLlRleHQoYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IGF0dHJpYnV0ZS5zb3VyY2VTcGFuKVxuICAgICAgICA6IHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlVG9rZW5zLFxuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiB8fCBhdHRyaWJ1dGUuc291cmNlU3BhbixcbiAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICBhdHRyaWJ1dGUuaTE4bixcbiAgICAgICAgICApO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGF0dHJpYnV0ZSwgbm9kZSk7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICBjb25zdCBub2RlID1cbiAgICAgIHRleHQudG9rZW5zLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IG5ldyBpMThuLlRleHQodGV4dC52YWx1ZSwgdGV4dC5zb3VyY2VTcGFuKVxuICAgICAgICA6IHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKHRleHQudG9rZW5zLCB0ZXh0LnNvdXJjZVNwYW4sIGNvbnRleHQsIHRleHQuaTE4bik7XG4gICAgcmV0dXJuIGNvbnRleHQudmlzaXROb2RlRm4odGV4dCwgbm9kZSk7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHwgbnVsbCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihpY3U6IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICBjb250ZXh0LmljdURlcHRoKys7XG4gICAgY29uc3QgaTE4bkljdUNhc2VzOiB7W2s6IHN0cmluZ106IGkxOG4uTm9kZX0gPSB7fTtcbiAgICBjb25zdCBpMThuSWN1ID0gbmV3IGkxOG4uSWN1KGljdS5zd2l0Y2hWYWx1ZSwgaWN1LnR5cGUsIGkxOG5JY3VDYXNlcywgaWN1LnNvdXJjZVNwYW4pO1xuICAgIGljdS5jYXNlcy5mb3JFYWNoKChjYXplKTogdm9pZCA9PiB7XG4gICAgICBpMThuSWN1Q2FzZXNbY2F6ZS52YWx1ZV0gPSBuZXcgaTE4bi5Db250YWluZXIoXG4gICAgICAgIGNhemUuZXhwcmVzc2lvbi5tYXAoKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcywgY29udGV4dCkpLFxuICAgICAgICBjYXplLmV4cFNvdXJjZVNwYW4sXG4gICAgICApO1xuICAgIH0pO1xuICAgIGNvbnRleHQuaWN1RGVwdGgtLTtcblxuICAgIGlmIChjb250ZXh0LmlzSWN1IHx8IGNvbnRleHQuaWN1RGVwdGggPiAwKSB7XG4gICAgICAvLyBSZXR1cm5zIGFuIElDVSBub2RlIHdoZW46XG4gICAgICAvLyAtIHRoZSBtZXNzYWdlICh2cyBhIHBhcnQgb2YgdGhlIG1lc3NhZ2UpIGlzIGFuIElDVSBtZXNzYWdlLCBvclxuICAgICAgLy8gLSB0aGUgSUNVIG1lc3NhZ2UgaXMgbmVzdGVkLlxuICAgICAgY29uc3QgZXhwUGggPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0VW5pcXVlUGxhY2Vob2xkZXIoYFZBUl8ke2ljdS50eXBlfWApO1xuICAgICAgaTE4bkljdS5leHByZXNzaW9uUGxhY2Vob2xkZXIgPSBleHBQaDtcbiAgICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb0NvbnRlbnRbZXhwUGhdID0ge1xuICAgICAgICB0ZXh0OiBpY3Uuc3dpdGNoVmFsdWUsXG4gICAgICAgIHNvdXJjZVNwYW46IGljdS5zd2l0Y2hWYWx1ZVNvdXJjZVNwYW4sXG4gICAgICB9O1xuICAgICAgcmV0dXJuIGNvbnRleHQudmlzaXROb2RlRm4oaWN1LCBpMThuSWN1KTtcbiAgICB9XG5cbiAgICAvLyBFbHNlIHJldHVybnMgYSBwbGFjZWhvbGRlclxuICAgIC8vIElDVSBwbGFjZWhvbGRlcnMgc2hvdWxkIG5vdCBiZSByZXBsYWNlZCB3aXRoIHRoZWlyIG9yaWdpbmFsIGNvbnRlbnQgYnV0IHdpdGggdGhlIHRoZWlyXG4gICAgLy8gdHJhbnNsYXRpb25zLlxuICAgIC8vIFRPRE8odmljYik6IGFkZCBhIGh0bWwuTm9kZSAtPiBpMThuLk1lc3NhZ2UgY2FjaGUgdG8gYXZvaWQgaGF2aW5nIHRvIHJlLWNyZWF0ZSB0aGUgbXNnXG4gICAgY29uc3QgcGhOYW1lID0gY29udGV4dC5wbGFjZWhvbGRlclJlZ2lzdHJ5LmdldFBsYWNlaG9sZGVyTmFtZSgnSUNVJywgaWN1LnNvdXJjZVNwYW4udG9TdHJpbmcoKSk7XG4gICAgY29udGV4dC5wbGFjZWhvbGRlclRvTWVzc2FnZVtwaE5hbWVdID0gdGhpcy50b0kxOG5NZXNzYWdlKFtpY3VdLCAnJywgJycsICcnLCB1bmRlZmluZWQpO1xuICAgIGNvbnN0IG5vZGUgPSBuZXcgaTE4bi5JY3VQbGFjZWhvbGRlcihpMThuSWN1LCBwaE5hbWUsIGljdS5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbihpY3UsIG5vZGUpO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKF9pY3VDYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIF9jb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0KTogaTE4bi5Ob2RlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1VucmVhY2hhYmxlIGNvZGUnKTtcbiAgfVxuXG4gIHZpc2l0QmxvY2soYmxvY2s6IGh0bWwuQmxvY2ssIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpIHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IGh0bWwudmlzaXRBbGwodGhpcywgYmxvY2suY2hpbGRyZW4sIGNvbnRleHQpO1xuXG4gICAgaWYgKHRoaXMuX2NvbnRhaW5lckJsb2Nrcy5oYXMoYmxvY2submFtZSkpIHtcbiAgICAgIHJldHVybiBuZXcgaTE4bi5Db250YWluZXIoY2hpbGRyZW4sIGJsb2NrLnNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBibG9jay5wYXJhbWV0ZXJzLm1hcCgocGFyYW0pID0+IHBhcmFtLmV4cHJlc3Npb24pO1xuICAgIGNvbnN0IHN0YXJ0UGhOYW1lID0gY29udGV4dC5wbGFjZWhvbGRlclJlZ2lzdHJ5LmdldFN0YXJ0QmxvY2tQbGFjZWhvbGRlck5hbWUoXG4gICAgICBibG9jay5uYW1lLFxuICAgICAgcGFyYW1ldGVycyxcbiAgICApO1xuICAgIGNvbnN0IGNsb3NlUGhOYW1lID0gY29udGV4dC5wbGFjZWhvbGRlclJlZ2lzdHJ5LmdldENsb3NlQmxvY2tQbGFjZWhvbGRlck5hbWUoYmxvY2submFtZSk7XG5cbiAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W3N0YXJ0UGhOYW1lXSA9IHtcbiAgICAgIHRleHQ6IGJsb2NrLnN0YXJ0U291cmNlU3Bhbi50b1N0cmluZygpLFxuICAgICAgc291cmNlU3BhbjogYmxvY2suc3RhcnRTb3VyY2VTcGFuLFxuICAgIH07XG5cbiAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W2Nsb3NlUGhOYW1lXSA9IHtcbiAgICAgIHRleHQ6IGJsb2NrLmVuZFNvdXJjZVNwYW4gPyBibG9jay5lbmRTb3VyY2VTcGFuLnRvU3RyaW5nKCkgOiAnfScsXG4gICAgICBzb3VyY2VTcGFuOiBibG9jay5lbmRTb3VyY2VTcGFuID8/IGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgfTtcblxuICAgIGNvbnN0IG5vZGUgPSBuZXcgaTE4bi5CbG9ja1BsYWNlaG9sZGVyKFxuICAgICAgYmxvY2submFtZSxcbiAgICAgIHBhcmFtZXRlcnMsXG4gICAgICBzdGFydFBoTmFtZSxcbiAgICAgIGNsb3NlUGhOYW1lLFxuICAgICAgY2hpbGRyZW4sXG4gICAgICBibG9jay5zb3VyY2VTcGFuLFxuICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgYmxvY2suZW5kU291cmNlU3BhbixcbiAgICApO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGJsb2NrLCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0QmxvY2tQYXJhbWV0ZXIoX3BhcmFtZXRlcjogaHRtbC5CbG9ja1BhcmFtZXRlciwgX2NvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1VucmVhY2hhYmxlIGNvZGUnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0LCB0ZXh0IGFuZCBpbnRlcnBvbGF0ZWQgdG9rZW5zIHVwIGludG8gdGV4dCBhbmQgcGxhY2Vob2xkZXIgcGllY2VzLlxuICAgKlxuICAgKiBAcGFyYW0gdG9rZW5zIFRoZSB0ZXh0IGFuZCBpbnRlcnBvbGF0ZWQgdG9rZW5zLlxuICAgKiBAcGFyYW0gc291cmNlU3BhbiBUaGUgc3BhbiBvZiB0aGUgd2hvbGUgb2YgdGhlIGB0ZXh0YCBzdHJpbmcuXG4gICAqIEBwYXJhbSBjb250ZXh0IFRoZSBjdXJyZW50IGNvbnRleHQgb2YgdGhlIHZpc2l0b3IsIHVzZWQgdG8gY29tcHV0ZSBhbmQgc3RvcmUgcGxhY2Vob2xkZXJzLlxuICAgKiBAcGFyYW0gcHJldmlvdXNJMThuIEFueSBpMThuIG1ldGFkYXRhIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGB0ZXh0YCBmcm9tIGEgcHJldmlvdXMgcGFzcy5cbiAgICovXG4gIHByaXZhdGUgX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgIHRva2VuczogKEludGVycG9sYXRlZFRleHRUb2tlbiB8IEludGVycG9sYXRlZEF0dHJpYnV0ZVRva2VuKVtdLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0LFxuICAgIHByZXZpb3VzSTE4bjogaTE4bi5JMThuTWV0YSB8IHVuZGVmaW5lZCxcbiAgKTogaTE4bi5Ob2RlIHtcbiAgICAvLyBSZXR1cm4gYSBzZXF1ZW5jZSBvZiBgVGV4dGAgYW5kIGBQbGFjZWhvbGRlcmAgbm9kZXMgZ3JvdXBlZCBpbiBhIGBDb250YWluZXJgLlxuICAgIGNvbnN0IG5vZGVzOiBpMThuLk5vZGVbXSA9IFtdO1xuICAgIC8vIFdlIHdpbGwgb25seSBjcmVhdGUgYSBjb250YWluZXIgaWYgdGhlcmUgYXJlIGFjdHVhbGx5IGludGVycG9sYXRpb25zLFxuICAgIC8vIHNvIHRoaXMgZmxhZyB0cmFja3MgdGhhdC5cbiAgICBsZXQgaGFzSW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgIGZvciAoY29uc3QgdG9rZW4gb2YgdG9rZW5zKSB7XG4gICAgICBzd2l0Y2ggKHRva2VuLnR5cGUpIHtcbiAgICAgICAgY2FzZSBUb2tlblR5cGUuSU5URVJQT0xBVElPTjpcbiAgICAgICAgY2FzZSBUb2tlblR5cGUuQVRUUl9WQUxVRV9JTlRFUlBPTEFUSU9OOlxuICAgICAgICAgIGhhc0ludGVycG9sYXRpb24gPSB0cnVlO1xuICAgICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0b2tlbi5wYXJ0c1sxXTtcbiAgICAgICAgICBjb25zdCBiYXNlTmFtZSA9IGV4dHJhY3RQbGFjZWhvbGRlck5hbWUoZXhwcmVzc2lvbikgfHwgJ0lOVEVSUE9MQVRJT04nO1xuICAgICAgICAgIGNvbnN0IHBoTmFtZSA9IGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRQbGFjZWhvbGRlck5hbWUoYmFzZU5hbWUsIGV4cHJlc3Npb24pO1xuICAgICAgICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb0NvbnRlbnRbcGhOYW1lXSA9IHtcbiAgICAgICAgICAgIHRleHQ6IHRva2VuLnBhcnRzLmpvaW4oJycpLFxuICAgICAgICAgICAgc291cmNlU3BhbjogdG9rZW4uc291cmNlU3BhbixcbiAgICAgICAgICB9O1xuICAgICAgICAgIG5vZGVzLnB1c2gobmV3IGkxOG4uUGxhY2Vob2xkZXIoZXhwcmVzc2lvbiwgcGhOYW1lLCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKHRva2VuLnBhcnRzWzBdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIFRoaXMgdG9rZW4gaXMgdGV4dCBvciBhbiBlbmNvZGVkIGVudGl0eS5cbiAgICAgICAgICAgIC8vIElmIGl0IGlzIGZvbGxvd2luZyBvbiBmcm9tIGEgcHJldmlvdXMgdGV4dCBub2RlIHRoZW4gbWVyZ2UgaXQgaW50byB0aGF0IG5vZGVcbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgaWYgaXQgaXMgZm9sbG93aW5nIGFuIGludGVycG9sYXRpb24sIHRoZW4gYWRkIGEgbmV3IG5vZGUuXG4gICAgICAgICAgICBjb25zdCBwcmV2aW91cyA9IG5vZGVzW25vZGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgaWYgKHByZXZpb3VzIGluc3RhbmNlb2YgaTE4bi5UZXh0KSB7XG4gICAgICAgICAgICAgIHByZXZpb3VzLnZhbHVlICs9IHRva2VuLnBhcnRzWzBdO1xuICAgICAgICAgICAgICBwcmV2aW91cy5zb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgICAgICBwcmV2aW91cy5zb3VyY2VTcGFuLnN0YXJ0LFxuICAgICAgICAgICAgICAgIHRva2VuLnNvdXJjZVNwYW4uZW5kLFxuICAgICAgICAgICAgICAgIHByZXZpb3VzLnNvdXJjZVNwYW4uZnVsbFN0YXJ0LFxuICAgICAgICAgICAgICAgIHByZXZpb3VzLnNvdXJjZVNwYW4uZGV0YWlscyxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5vZGVzLnB1c2gobmV3IGkxOG4uVGV4dCh0b2tlbi5wYXJ0c1swXSwgdG9rZW4uc291cmNlU3BhbikpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaGFzSW50ZXJwb2xhdGlvbikge1xuICAgICAgLy8gV2hpdGVzcGFjZSByZW1vdmFsIG1heSBoYXZlIGludmFsaWRhdGVkIHRoZSBpbnRlcnBvbGF0aW9uIHNvdXJjZS1zcGFucy5cbiAgICAgIHJldXNlUHJldmlvdXNTb3VyY2VTcGFucyhub2RlcywgcHJldmlvdXNJMThuKTtcbiAgICAgIHJldHVybiBuZXcgaTE4bi5Db250YWluZXIobm9kZXMsIHNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZXNbMF07XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUmUtdXNlIHRoZSBzb3VyY2Utc3BhbnMgZnJvbSBgcHJldmlvdXNJMThuYCBtZXRhZGF0YSBmb3IgdGhlIGBub2Rlc2AuXG4gKlxuICogV2hpdGVzcGFjZSByZW1vdmFsIGNhbiBpbnZhbGlkYXRlIHRoZSBzb3VyY2Utc3BhbnMgb2YgaW50ZXJwb2xhdGlvbiBub2Rlcywgc28gd2VcbiAqIHJldXNlIHRoZSBzb3VyY2Utc3BhbiBzdG9yZWQgZnJvbSBhIHByZXZpb3VzIHBhc3MgYmVmb3JlIHRoZSB3aGl0ZXNwYWNlIHdhcyByZW1vdmVkLlxuICpcbiAqIEBwYXJhbSBub2RlcyBUaGUgYFRleHRgIGFuZCBgUGxhY2Vob2xkZXJgIG5vZGVzIHRvIGJlIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSBwcmV2aW91c0kxOG4gQW55IGkxOG4gbWV0YWRhdGEgZm9yIHRoZXNlIGBub2Rlc2Agc3RvcmVkIGZyb20gYSBwcmV2aW91cyBwYXNzLlxuICovXG5mdW5jdGlvbiByZXVzZVByZXZpb3VzU291cmNlU3BhbnMoXG4gIG5vZGVzOiBpMThuLk5vZGVbXSxcbiAgcHJldmlvdXNJMThuOiBpMThuLkkxOG5NZXRhIHwgdW5kZWZpbmVkLFxuKTogdm9pZCB7XG4gIGlmIChwcmV2aW91c0kxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICAvLyBUaGUgYHByZXZpb3VzSTE4bmAgaXMgYW4gaTE4biBgTWVzc2FnZWAsIHNvIHdlIGFyZSBwcm9jZXNzaW5nIGFuIGBBdHRyaWJ1dGVgIHdpdGggaTE4blxuICAgIC8vIG1ldGFkYXRhLiBUaGUgYE1lc3NhZ2VgIHNob3VsZCBjb25zaXN0IG9ubHkgb2YgYSBzaW5nbGUgYENvbnRhaW5lcmAgdGhhdCBjb250YWlucyB0aGVcbiAgICAvLyBwYXJ0cyAoYFRleHRgIGFuZCBgUGxhY2Vob2xkZXJgKSB0byBwcm9jZXNzLlxuICAgIGFzc2VydFNpbmdsZUNvbnRhaW5lck1lc3NhZ2UocHJldmlvdXNJMThuKTtcbiAgICBwcmV2aW91c0kxOG4gPSBwcmV2aW91c0kxOG4ubm9kZXNbMF07XG4gIH1cblxuICBpZiAocHJldmlvdXNJMThuIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIpIHtcbiAgICAvLyBUaGUgYHByZXZpb3VzSTE4bmAgaXMgYSBgQ29udGFpbmVyYCwgd2hpY2ggbWVhbnMgdGhhdCB0aGlzIGlzIGEgc2Vjb25kIGkxOG4gZXh0cmFjdGlvbiBwYXNzXG4gICAgLy8gYWZ0ZXIgd2hpdGVzcGFjZSBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIEFTVCBub2Rlcy5cbiAgICBhc3NlcnRFcXVpdmFsZW50Tm9kZXMocHJldmlvdXNJMThuLmNoaWxkcmVuLCBub2Rlcyk7XG5cbiAgICAvLyBSZXVzZSB0aGUgc291cmNlLXNwYW5zIGZyb20gdGhlIGZpcnN0IHBhc3MuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbm9kZXNbaV0uc291cmNlU3BhbiA9IHByZXZpb3VzSTE4bi5jaGlsZHJlbltpXS5zb3VyY2VTcGFuO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFzc2VydHMgdGhhdCB0aGUgYG1lc3NhZ2VgIGNvbnRhaW5zIGV4YWN0bHkgb25lIGBDb250YWluZXJgIG5vZGUuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydFNpbmdsZUNvbnRhaW5lck1lc3NhZ2UobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogdm9pZCB7XG4gIGNvbnN0IG5vZGVzID0gbWVzc2FnZS5ub2RlcztcbiAgaWYgKG5vZGVzLmxlbmd0aCAhPT0gMSB8fCAhKG5vZGVzWzBdIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ1VuZXhwZWN0ZWQgcHJldmlvdXMgaTE4biBtZXNzYWdlIC0gZXhwZWN0ZWQgaXQgdG8gY29uc2lzdCBvZiBvbmx5IGEgc2luZ2xlIGBDb250YWluZXJgIG5vZGUuJyxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogQXNzZXJ0cyB0aGF0IHRoZSBgcHJldmlvdXNOb2Rlc2AgYW5kIGBub2RlYCBjb2xsZWN0aW9ucyBoYXZlIHRoZSBzYW1lIG51bWJlciBvZiBlbGVtZW50cyBhbmRcbiAqIGNvcnJlc3BvbmRpbmcgZWxlbWVudHMgaGF2ZSB0aGUgc2FtZSBub2RlIHR5cGUuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydEVxdWl2YWxlbnROb2RlcyhwcmV2aW91c05vZGVzOiBpMThuLk5vZGVbXSwgbm9kZXM6IGkxOG4uTm9kZVtdKTogdm9pZCB7XG4gIGlmIChwcmV2aW91c05vZGVzLmxlbmd0aCAhPT0gbm9kZXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgbnVtYmVyIG9mIGkxOG4gbWVzc2FnZSBjaGlsZHJlbiBjaGFuZ2VkIGJldHdlZW4gZmlyc3QgYW5kIHNlY29uZCBwYXNzLicpO1xuICB9XG4gIGlmIChwcmV2aW91c05vZGVzLnNvbWUoKG5vZGUsIGkpID0+IG5vZGVzW2ldLmNvbnN0cnVjdG9yICE9PSBub2RlLmNvbnN0cnVjdG9yKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdUaGUgdHlwZXMgb2YgdGhlIGkxOG4gbWVzc2FnZSBjaGlsZHJlbiBjaGFuZ2VkIGJldHdlZW4gZmlyc3QgYW5kIHNlY29uZCBwYXNzLicsXG4gICAgKTtcbiAgfVxufVxuXG5jb25zdCBfQ1VTVE9NX1BIX0VYUCA9XG4gIC9cXC9cXC9bXFxzXFxTXSppMThuW1xcc1xcU10qXFwoW1xcc1xcU10qcGhbXFxzXFxTXSo9W1xcc1xcU10qKFwifCcpKFtcXHNcXFNdKj8pXFwxW1xcc1xcU10qXFwpL2c7XG5cbmZ1bmN0aW9uIGV4dHJhY3RQbGFjZWhvbGRlck5hbWUoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBpbnB1dC5zcGxpdChfQ1VTVE9NX1BIX0VYUClbMl07XG59XG4iXX0=