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
export function createI18nMessageFactory(interpolationConfig, containerBlocks, retainEmptyTokens) {
    const visitor = new _I18nVisitor(_expParser, interpolationConfig, containerBlocks, retainEmptyTokens);
    return (nodes, meaning, description, customId, visitNodeFn) => visitor.toI18nMessage(nodes, meaning, description, customId, visitNodeFn);
}
function noopVisitNodeFn(_html, i18n) {
    return i18n;
}
class _I18nVisitor {
    constructor(_expressionParser, _interpolationConfig, _containerBlocks, _retainEmptyTokens) {
        this._expressionParser = _expressionParser;
        this._interpolationConfig = _interpolationConfig;
        this._containerBlocks = _containerBlocks;
        this._retainEmptyTokens = _retainEmptyTokens;
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
    visitLetDeclaration(decl, context) {
        return null;
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
                    // Try to merge text tokens with previous tokens. We do this even for all tokens
                    // when `retainEmptyTokens == true` because whitespace tokens may have non-zero
                    // length, but will be trimmed by `WhitespaceVisitor` in one extraction pass and
                    // be considered "empty" there. Therefore a whitespace token with
                    // `retainEmptyTokens === true` should be treated like an empty token and either
                    // retained or merged into the previous node. Since extraction does two passes with
                    // different trimming behavior, the second pass needs to have identical node count
                    // to reuse source spans, so we need this check to get the same answer when both
                    // trimming and not trimming.
                    if (token.parts[0].length > 0 || this._retainEmptyTokens) {
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
                    else {
                        // Retain empty tokens to avoid breaking dropping entire nodes such that source
                        // spans should not be reusable across multiple parses of a template. We *should*
                        // do this all the time, however we need to maintain backwards compatibility
                        // with existing message IDs so we can't do it by default and should only enable
                        // this when removing significant whitespace.
                        if (this._retainEmptyTokens) {
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
        throw new Error(`
The number of i18n message children changed between first and second pass.

First pass (${previousNodes.length} tokens):
${previousNodes.map((node) => `"${node.sourceSpan.toString()}"`).join('\n')}

Second pass (${nodes.length} tokens):
${nodes.map((node) => `"${node.sourceSpan.toString()}"`).join('\n')}
    `.trim());
    }
    if (previousNodes.some((node, i) => nodes[i].constructor !== node.constructor)) {
        throw new Error('The types of the i18n message children changed between first and second pass.');
    }
}
const _CUSTOM_PH_EXP = /\/\/[\s\S]*i18n[\s\S]*\([\s\S]*ph[\s\S]*=[\s\S]*("|')([\s\S]*?)\1[\s\S]*\)/g;
function extractPlaceholderName(input) {
    return input.split(_CUSTOM_PH_EXP)[2];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9pMThuX3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsS0FBSyxJQUFJLGVBQWUsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ3BFLE9BQU8sRUFBQyxNQUFNLElBQUksZ0JBQWdCLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RSxPQUFPLEtBQUssSUFBSSxNQUFNLGtCQUFrQixDQUFDO0FBRXpDLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRTVELE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFOUMsT0FBTyxLQUFLLElBQUksTUFBTSxZQUFZLENBQUM7QUFDbkMsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFFOUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLGVBQWUsRUFBRSxDQUFDLENBQUM7QUFjL0Q7O0dBRUc7QUFDSCxNQUFNLFVBQVUsd0JBQXdCLENBQ3RDLG1CQUF3QyxFQUN4QyxlQUE0QixFQUM1QixpQkFBMEI7SUFFMUIsTUFBTSxPQUFPLEdBQUcsSUFBSSxZQUFZLENBQzlCLFVBQVUsRUFDVixtQkFBbUIsRUFDbkIsZUFBZSxFQUNmLGlCQUFpQixDQUNsQixDQUFDO0lBQ0YsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUM1RCxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUM5RSxDQUFDO0FBV0QsU0FBUyxlQUFlLENBQUMsS0FBZ0IsRUFBRSxJQUFl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QUFLLENBQ2IsK0VBQStFLENBQ2hGLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sY0FBYyxHQUNsQiw2RUFBNkUsQ0FBQztBQUVoRixTQUFTLHNCQUFzQixDQUFDLEtBQWE7SUFDM0MsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtMZXhlciBhcyBFeHByZXNzaW9uTGV4ZXJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmltcG9ydCB7UGFyc2VyIGFzIEV4cHJlc3Npb25QYXJzZXJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvZGVmYXVsdHMnO1xuaW1wb3J0IHtnZXRIdG1sVGFnRGVmaW5pdGlvbn0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfdGFncyc7XG5pbXBvcnQge0ludGVycG9sYXRlZEF0dHJpYnV0ZVRva2VuLCBJbnRlcnBvbGF0ZWRUZXh0VG9rZW4sIFRva2VuVHlwZX0gZnJvbSAnLi4vbWxfcGFyc2VyL3Rva2Vucyc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi9pMThuX2FzdCc7XG5pbXBvcnQge1BsYWNlaG9sZGVyUmVnaXN0cnl9IGZyb20gJy4vc2VyaWFsaXplcnMvcGxhY2Vob2xkZXInO1xuXG5jb25zdCBfZXhwUGFyc2VyID0gbmV3IEV4cHJlc3Npb25QYXJzZXIobmV3IEV4cHJlc3Npb25MZXhlcigpKTtcblxuZXhwb3J0IHR5cGUgVmlzaXROb2RlRm4gPSAoaHRtbDogaHRtbC5Ob2RlLCBpMThuOiBpMThuLk5vZGUpID0+IGkxOG4uTm9kZTtcblxuZXhwb3J0IGludGVyZmFjZSBJMThuTWVzc2FnZUZhY3Rvcnkge1xuICAoXG4gICAgbm9kZXM6IGh0bWwuTm9kZVtdLFxuICAgIG1lYW5pbmc6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICBkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgIGN1c3RvbUlkOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gICAgdmlzaXROb2RlRm4/OiBWaXNpdE5vZGVGbixcbiAgKTogaTE4bi5NZXNzYWdlO1xufVxuXG4vKipcbiAqIFJldHVybnMgYSBmdW5jdGlvbiBjb252ZXJ0aW5nIGh0bWwgbm9kZXMgdG8gYW4gaTE4biBNZXNzYWdlIGdpdmVuIGFuIGludGVycG9sYXRpb25Db25maWdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUkxOG5NZXNzYWdlRmFjdG9yeShcbiAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyxcbiAgY29udGFpbmVyQmxvY2tzOiBTZXQ8c3RyaW5nPixcbiAgcmV0YWluRW1wdHlUb2tlbnM6IGJvb2xlYW4sXG4pOiBJMThuTWVzc2FnZUZhY3Rvcnkge1xuICBjb25zdCB2aXNpdG9yID0gbmV3IF9JMThuVmlzaXRvcihcbiAgICBfZXhwUGFyc2VyLFxuICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgY29udGFpbmVyQmxvY2tzLFxuICAgIHJldGFpbkVtcHR5VG9rZW5zLFxuICApO1xuICByZXR1cm4gKG5vZGVzLCBtZWFuaW5nLCBkZXNjcmlwdGlvbiwgY3VzdG9tSWQsIHZpc2l0Tm9kZUZuKSA9PlxuICAgIHZpc2l0b3IudG9JMThuTWVzc2FnZShub2RlcywgbWVhbmluZywgZGVzY3JpcHRpb24sIGN1c3RvbUlkLCB2aXNpdE5vZGVGbik7XG59XG5cbmludGVyZmFjZSBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0IHtcbiAgaXNJY3U6IGJvb2xlYW47XG4gIGljdURlcHRoOiBudW1iZXI7XG4gIHBsYWNlaG9sZGVyUmVnaXN0cnk6IFBsYWNlaG9sZGVyUmVnaXN0cnk7XG4gIHBsYWNlaG9sZGVyVG9Db250ZW50OiB7W3BoTmFtZTogc3RyaW5nXTogaTE4bi5NZXNzYWdlUGxhY2Vob2xkZXJ9O1xuICBwbGFjZWhvbGRlclRvTWVzc2FnZToge1twaE5hbWU6IHN0cmluZ106IGkxOG4uTWVzc2FnZX07XG4gIHZpc2l0Tm9kZUZuOiBWaXNpdE5vZGVGbjtcbn1cblxuZnVuY3Rpb24gbm9vcFZpc2l0Tm9kZUZuKF9odG1sOiBodG1sLk5vZGUsIGkxOG46IGkxOG4uTm9kZSk6IGkxOG4uTm9kZSB7XG4gIHJldHVybiBpMThuO1xufVxuXG5jbGFzcyBfSTE4blZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIF9leHByZXNzaW9uUGFyc2VyOiBFeHByZXNzaW9uUGFyc2VyLFxuICAgIHByaXZhdGUgX2ludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcsXG4gICAgcHJpdmF0ZSBfY29udGFpbmVyQmxvY2tzOiBTZXQ8c3RyaW5nPixcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9yZXRhaW5FbXB0eVRva2VuczogYm9vbGVhbixcbiAgKSB7fVxuXG4gIHB1YmxpYyB0b0kxOG5NZXNzYWdlKFxuICAgIG5vZGVzOiBodG1sLk5vZGVbXSxcbiAgICBtZWFuaW5nID0gJycsXG4gICAgZGVzY3JpcHRpb24gPSAnJyxcbiAgICBjdXN0b21JZCA9ICcnLFxuICAgIHZpc2l0Tm9kZUZuOiBWaXNpdE5vZGVGbiB8IHVuZGVmaW5lZCxcbiAgKTogaTE4bi5NZXNzYWdlIHtcbiAgICBjb25zdCBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0ID0ge1xuICAgICAgaXNJY3U6IG5vZGVzLmxlbmd0aCA9PSAxICYmIG5vZGVzWzBdIGluc3RhbmNlb2YgaHRtbC5FeHBhbnNpb24sXG4gICAgICBpY3VEZXB0aDogMCxcbiAgICAgIHBsYWNlaG9sZGVyUmVnaXN0cnk6IG5ldyBQbGFjZWhvbGRlclJlZ2lzdHJ5KCksXG4gICAgICBwbGFjZWhvbGRlclRvQ29udGVudDoge30sXG4gICAgICBwbGFjZWhvbGRlclRvTWVzc2FnZToge30sXG4gICAgICB2aXNpdE5vZGVGbjogdmlzaXROb2RlRm4gfHwgbm9vcFZpc2l0Tm9kZUZuLFxuICAgIH07XG5cbiAgICBjb25zdCBpMThub2RlczogaTE4bi5Ob2RlW10gPSBodG1sLnZpc2l0QWxsKHRoaXMsIG5vZGVzLCBjb250ZXh0KTtcblxuICAgIHJldHVybiBuZXcgaTE4bi5NZXNzYWdlKFxuICAgICAgaTE4bm9kZXMsXG4gICAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50LFxuICAgICAgY29udGV4dC5wbGFjZWhvbGRlclRvTWVzc2FnZSxcbiAgICAgIG1lYW5pbmcsXG4gICAgICBkZXNjcmlwdGlvbixcbiAgICAgIGN1c3RvbUlkLFxuICAgICk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWw6IGh0bWwuRWxlbWVudCwgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCk6IGkxOG4uTm9kZSB7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKHRoaXMsIGVsLmNoaWxkcmVuLCBjb250ZXh0KTtcbiAgICBjb25zdCBhdHRyczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgZWwuYXR0cnMuZm9yRWFjaCgoYXR0cikgPT4ge1xuICAgICAgLy8gRG8gbm90IHZpc2l0IHRoZSBhdHRyaWJ1dGVzLCB0cmFuc2xhdGFibGUgb25lcyBhcmUgdG9wLWxldmVsIEFTVHNcbiAgICAgIGF0dHJzW2F0dHIubmFtZV0gPSBhdHRyLnZhbHVlO1xuICAgIH0pO1xuXG4gICAgY29uc3QgaXNWb2lkOiBib29sZWFuID0gZ2V0SHRtbFRhZ0RlZmluaXRpb24oZWwubmFtZSkuaXNWb2lkO1xuICAgIGNvbnN0IHN0YXJ0UGhOYW1lID0gY29udGV4dC5wbGFjZWhvbGRlclJlZ2lzdHJ5LmdldFN0YXJ0VGFnUGxhY2Vob2xkZXJOYW1lKFxuICAgICAgZWwubmFtZSxcbiAgICAgIGF0dHJzLFxuICAgICAgaXNWb2lkLFxuICAgICk7XG4gICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudFtzdGFydFBoTmFtZV0gPSB7XG4gICAgICB0ZXh0OiBlbC5zdGFydFNvdXJjZVNwYW4udG9TdHJpbmcoKSxcbiAgICAgIHNvdXJjZVNwYW46IGVsLnN0YXJ0U291cmNlU3BhbixcbiAgICB9O1xuXG4gICAgbGV0IGNsb3NlUGhOYW1lID0gJyc7XG5cbiAgICBpZiAoIWlzVm9pZCkge1xuICAgICAgY2xvc2VQaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0Q2xvc2VUYWdQbGFjZWhvbGRlck5hbWUoZWwubmFtZSk7XG4gICAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9Db250ZW50W2Nsb3NlUGhOYW1lXSA9IHtcbiAgICAgICAgdGV4dDogYDwvJHtlbC5uYW1lfT5gLFxuICAgICAgICBzb3VyY2VTcGFuOiBlbC5lbmRTb3VyY2VTcGFuID8/IGVsLnNvdXJjZVNwYW4sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGUgPSBuZXcgaTE4bi5UYWdQbGFjZWhvbGRlcihcbiAgICAgIGVsLm5hbWUsXG4gICAgICBhdHRycyxcbiAgICAgIHN0YXJ0UGhOYW1lLFxuICAgICAgY2xvc2VQaE5hbWUsXG4gICAgICBjaGlsZHJlbixcbiAgICAgIGlzVm9pZCxcbiAgICAgIGVsLnNvdXJjZVNwYW4sXG4gICAgICBlbC5zdGFydFNvdXJjZVNwYW4sXG4gICAgICBlbC5lbmRTb3VyY2VTcGFuLFxuICAgICk7XG4gICAgcmV0dXJuIGNvbnRleHQudmlzaXROb2RlRm4oZWwsIG5vZGUpO1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCk6IGkxOG4uTm9kZSB7XG4gICAgY29uc3Qgbm9kZSA9XG4gICAgICBhdHRyaWJ1dGUudmFsdWVUb2tlbnMgPT09IHVuZGVmaW5lZCB8fCBhdHRyaWJ1dGUudmFsdWVUb2tlbnMubGVuZ3RoID09PSAxXG4gICAgICAgID8gbmV3IGkxOG4uVGV4dChhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS52YWx1ZVNwYW4gfHwgYXR0cmlidXRlLnNvdXJjZVNwYW4pXG4gICAgICAgIDogdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24oXG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWVUb2tlbnMsXG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IGF0dHJpYnV0ZS5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZS5pMThuLFxuICAgICAgICAgICk7XG4gICAgcmV0dXJuIGNvbnRleHQudmlzaXROb2RlRm4oYXR0cmlidXRlLCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnN0IG5vZGUgPVxuICAgICAgdGV4dC50b2tlbnMubGVuZ3RoID09PSAxXG4gICAgICAgID8gbmV3IGkxOG4uVGV4dCh0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4pXG4gICAgICAgIDogdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24odGV4dC50b2tlbnMsIHRleHQuc291cmNlU3BhbiwgY29udGV4dCwgdGV4dC5pMThuKTtcbiAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbih0ZXh0LCBub2RlKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQsIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUgfCBudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGljdTogaHRtbC5FeHBhbnNpb24sIGNvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIGNvbnRleHQuaWN1RGVwdGgrKztcbiAgICBjb25zdCBpMThuSWN1Q2FzZXM6IHtbazogc3RyaW5nXTogaTE4bi5Ob2RlfSA9IHt9O1xuICAgIGNvbnN0IGkxOG5JY3UgPSBuZXcgaTE4bi5JY3UoaWN1LnN3aXRjaFZhbHVlLCBpY3UudHlwZSwgaTE4bkljdUNhc2VzLCBpY3Uuc291cmNlU3Bhbik7XG4gICAgaWN1LmNhc2VzLmZvckVhY2goKGNhemUpOiB2b2lkID0+IHtcbiAgICAgIGkxOG5JY3VDYXNlc1tjYXplLnZhbHVlXSA9IG5ldyBpMThuLkNvbnRhaW5lcihcbiAgICAgICAgY2F6ZS5leHByZXNzaW9uLm1hcCgobm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzLCBjb250ZXh0KSksXG4gICAgICAgIGNhemUuZXhwU291cmNlU3BhbixcbiAgICAgICk7XG4gICAgfSk7XG4gICAgY29udGV4dC5pY3VEZXB0aC0tO1xuXG4gICAgaWYgKGNvbnRleHQuaXNJY3UgfHwgY29udGV4dC5pY3VEZXB0aCA+IDApIHtcbiAgICAgIC8vIFJldHVybnMgYW4gSUNVIG5vZGUgd2hlbjpcbiAgICAgIC8vIC0gdGhlIG1lc3NhZ2UgKHZzIGEgcGFydCBvZiB0aGUgbWVzc2FnZSkgaXMgYW4gSUNVIG1lc3NhZ2UsIG9yXG4gICAgICAvLyAtIHRoZSBJQ1UgbWVzc2FnZSBpcyBuZXN0ZWQuXG4gICAgICBjb25zdCBleHBQaCA9IGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRVbmlxdWVQbGFjZWhvbGRlcihgVkFSXyR7aWN1LnR5cGV9YCk7XG4gICAgICBpMThuSWN1LmV4cHJlc3Npb25QbGFjZWhvbGRlciA9IGV4cFBoO1xuICAgICAgY29udGV4dC5wbGFjZWhvbGRlclRvQ29udGVudFtleHBQaF0gPSB7XG4gICAgICAgIHRleHQ6IGljdS5zd2l0Y2hWYWx1ZSxcbiAgICAgICAgc291cmNlU3BhbjogaWN1LnN3aXRjaFZhbHVlU291cmNlU3BhbixcbiAgICAgIH07XG4gICAgICByZXR1cm4gY29udGV4dC52aXNpdE5vZGVGbihpY3UsIGkxOG5JY3UpO1xuICAgIH1cblxuICAgIC8vIEVsc2UgcmV0dXJucyBhIHBsYWNlaG9sZGVyXG4gICAgLy8gSUNVIHBsYWNlaG9sZGVycyBzaG91bGQgbm90IGJlIHJlcGxhY2VkIHdpdGggdGhlaXIgb3JpZ2luYWwgY29udGVudCBidXQgd2l0aCB0aGUgdGhlaXJcbiAgICAvLyB0cmFuc2xhdGlvbnMuXG4gICAgLy8gVE9ETyh2aWNiKTogYWRkIGEgaHRtbC5Ob2RlIC0+IGkxOG4uTWVzc2FnZSBjYWNoZSB0byBhdm9pZCBoYXZpbmcgdG8gcmUtY3JlYXRlIHRoZSBtc2dcbiAgICBjb25zdCBwaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0UGxhY2Vob2xkZXJOYW1lKCdJQ1UnLCBpY3Uuc291cmNlU3Bhbi50b1N0cmluZygpKTtcbiAgICBjb250ZXh0LnBsYWNlaG9sZGVyVG9NZXNzYWdlW3BoTmFtZV0gPSB0aGlzLnRvSTE4bk1lc3NhZ2UoW2ljdV0sICcnLCAnJywgJycsIHVuZGVmaW5lZCk7XG4gICAgY29uc3Qgbm9kZSA9IG5ldyBpMThuLkljdVBsYWNlaG9sZGVyKGkxOG5JY3UsIHBoTmFtZSwgaWN1LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBjb250ZXh0LnZpc2l0Tm9kZUZuKGljdSwgbm9kZSk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoX2ljdUNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgX2NvbnRleHQ6IEkxOG5NZXNzYWdlVmlzaXRvckNvbnRleHQpOiBpMThuLk5vZGUge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5yZWFjaGFibGUgY29kZScpO1xuICB9XG5cbiAgdmlzaXRCbG9jayhibG9jazogaHRtbC5CbG9jaywgY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCkge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh0aGlzLCBibG9jay5jaGlsZHJlbiwgY29udGV4dCk7XG5cbiAgICBpZiAodGhpcy5fY29udGFpbmVyQmxvY2tzLmhhcyhibG9jay5uYW1lKSkge1xuICAgICAgcmV0dXJuIG5ldyBpMThuLkNvbnRhaW5lcihjaGlsZHJlbiwgYmxvY2suc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1ldGVycyA9IGJsb2NrLnBhcmFtZXRlcnMubWFwKChwYXJhbSkgPT4gcGFyYW0uZXhwcmVzc2lvbik7XG4gICAgY29uc3Qgc3RhcnRQaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0U3RhcnRCbG9ja1BsYWNlaG9sZGVyTmFtZShcbiAgICAgIGJsb2NrLm5hbWUsXG4gICAgICBwYXJhbWV0ZXJzLFxuICAgICk7XG4gICAgY29uc3QgY2xvc2VQaE5hbWUgPSBjb250ZXh0LnBsYWNlaG9sZGVyUmVnaXN0cnkuZ2V0Q2xvc2VCbG9ja1BsYWNlaG9sZGVyTmFtZShibG9jay5uYW1lKTtcblxuICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb0NvbnRlbnRbc3RhcnRQaE5hbWVdID0ge1xuICAgICAgdGV4dDogYmxvY2suc3RhcnRTb3VyY2VTcGFuLnRvU3RyaW5nKCksXG4gICAgICBzb3VyY2VTcGFuOiBibG9jay5zdGFydFNvdXJjZVNwYW4sXG4gICAgfTtcblxuICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb0NvbnRlbnRbY2xvc2VQaE5hbWVdID0ge1xuICAgICAgdGV4dDogYmxvY2suZW5kU291cmNlU3BhbiA/IGJsb2NrLmVuZFNvdXJjZVNwYW4udG9TdHJpbmcoKSA6ICd9JyxcbiAgICAgIHNvdXJjZVNwYW46IGJsb2NrLmVuZFNvdXJjZVNwYW4gPz8gYmxvY2suc291cmNlU3BhbixcbiAgICB9O1xuXG4gICAgY29uc3Qgbm9kZSA9IG5ldyBpMThuLkJsb2NrUGxhY2Vob2xkZXIoXG4gICAgICBibG9jay5uYW1lLFxuICAgICAgcGFyYW1ldGVycyxcbiAgICAgIHN0YXJ0UGhOYW1lLFxuICAgICAgY2xvc2VQaE5hbWUsXG4gICAgICBjaGlsZHJlbixcbiAgICAgIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sXG4gICAgICBibG9jay5lbmRTb3VyY2VTcGFuLFxuICAgICk7XG4gICAgcmV0dXJuIGNvbnRleHQudmlzaXROb2RlRm4oYmxvY2ssIG5vZGUpO1xuICB9XG5cbiAgdmlzaXRCbG9ja1BhcmFtZXRlcihfcGFyYW1ldGVyOiBodG1sLkJsb2NrUGFyYW1ldGVyLCBfY29udGV4dDogSTE4bk1lc3NhZ2VWaXNpdG9yQ29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5yZWFjaGFibGUgY29kZScpO1xuICB9XG5cbiAgdmlzaXRMZXREZWNsYXJhdGlvbihkZWNsOiBodG1sLkxldERlY2xhcmF0aW9uLCBjb250ZXh0OiBhbnkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0LCB0ZXh0IGFuZCBpbnRlcnBvbGF0ZWQgdG9rZW5zIHVwIGludG8gdGV4dCBhbmQgcGxhY2Vob2xkZXIgcGllY2VzLlxuICAgKlxuICAgKiBAcGFyYW0gdG9rZW5zIFRoZSB0ZXh0IGFuZCBpbnRlcnBvbGF0ZWQgdG9rZW5zLlxuICAgKiBAcGFyYW0gc291cmNlU3BhbiBUaGUgc3BhbiBvZiB0aGUgd2hvbGUgb2YgdGhlIGB0ZXh0YCBzdHJpbmcuXG4gICAqIEBwYXJhbSBjb250ZXh0IFRoZSBjdXJyZW50IGNvbnRleHQgb2YgdGhlIHZpc2l0b3IsIHVzZWQgdG8gY29tcHV0ZSBhbmQgc3RvcmUgcGxhY2Vob2xkZXJzLlxuICAgKiBAcGFyYW0gcHJldmlvdXNJMThuIEFueSBpMThuIG1ldGFkYXRhIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGB0ZXh0YCBmcm9tIGEgcHJldmlvdXMgcGFzcy5cbiAgICovXG4gIHByaXZhdGUgX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgIHRva2VuczogKEludGVycG9sYXRlZFRleHRUb2tlbiB8IEludGVycG9sYXRlZEF0dHJpYnV0ZVRva2VuKVtdLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBjb250ZXh0OiBJMThuTWVzc2FnZVZpc2l0b3JDb250ZXh0LFxuICAgIHByZXZpb3VzSTE4bjogaTE4bi5JMThuTWV0YSB8IHVuZGVmaW5lZCxcbiAgKTogaTE4bi5Ob2RlIHtcbiAgICAvLyBSZXR1cm4gYSBzZXF1ZW5jZSBvZiBgVGV4dGAgYW5kIGBQbGFjZWhvbGRlcmAgbm9kZXMgZ3JvdXBlZCBpbiBhIGBDb250YWluZXJgLlxuICAgIGNvbnN0IG5vZGVzOiBpMThuLk5vZGVbXSA9IFtdO1xuICAgIC8vIFdlIHdpbGwgb25seSBjcmVhdGUgYSBjb250YWluZXIgaWYgdGhlcmUgYXJlIGFjdHVhbGx5IGludGVycG9sYXRpb25zLFxuICAgIC8vIHNvIHRoaXMgZmxhZyB0cmFja3MgdGhhdC5cbiAgICBsZXQgaGFzSW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgIGZvciAoY29uc3QgdG9rZW4gb2YgdG9rZW5zKSB7XG4gICAgICBzd2l0Y2ggKHRva2VuLnR5cGUpIHtcbiAgICAgICAgY2FzZSBUb2tlblR5cGUuSU5URVJQT0xBVElPTjpcbiAgICAgICAgY2FzZSBUb2tlblR5cGUuQVRUUl9WQUxVRV9JTlRFUlBPTEFUSU9OOlxuICAgICAgICAgIGhhc0ludGVycG9sYXRpb24gPSB0cnVlO1xuICAgICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0b2tlbi5wYXJ0c1sxXTtcbiAgICAgICAgICBjb25zdCBiYXNlTmFtZSA9IGV4dHJhY3RQbGFjZWhvbGRlck5hbWUoZXhwcmVzc2lvbikgfHwgJ0lOVEVSUE9MQVRJT04nO1xuICAgICAgICAgIGNvbnN0IHBoTmFtZSA9IGNvbnRleHQucGxhY2Vob2xkZXJSZWdpc3RyeS5nZXRQbGFjZWhvbGRlck5hbWUoYmFzZU5hbWUsIGV4cHJlc3Npb24pO1xuICAgICAgICAgIGNvbnRleHQucGxhY2Vob2xkZXJUb0NvbnRlbnRbcGhOYW1lXSA9IHtcbiAgICAgICAgICAgIHRleHQ6IHRva2VuLnBhcnRzLmpvaW4oJycpLFxuICAgICAgICAgICAgc291cmNlU3BhbjogdG9rZW4uc291cmNlU3BhbixcbiAgICAgICAgICB9O1xuICAgICAgICAgIG5vZGVzLnB1c2gobmV3IGkxOG4uUGxhY2Vob2xkZXIoZXhwcmVzc2lvbiwgcGhOYW1lLCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgLy8gVHJ5IHRvIG1lcmdlIHRleHQgdG9rZW5zIHdpdGggcHJldmlvdXMgdG9rZW5zLiBXZSBkbyB0aGlzIGV2ZW4gZm9yIGFsbCB0b2tlbnNcbiAgICAgICAgICAvLyB3aGVuIGByZXRhaW5FbXB0eVRva2VucyA9PSB0cnVlYCBiZWNhdXNlIHdoaXRlc3BhY2UgdG9rZW5zIG1heSBoYXZlIG5vbi16ZXJvXG4gICAgICAgICAgLy8gbGVuZ3RoLCBidXQgd2lsbCBiZSB0cmltbWVkIGJ5IGBXaGl0ZXNwYWNlVmlzaXRvcmAgaW4gb25lIGV4dHJhY3Rpb24gcGFzcyBhbmRcbiAgICAgICAgICAvLyBiZSBjb25zaWRlcmVkIFwiZW1wdHlcIiB0aGVyZS4gVGhlcmVmb3JlIGEgd2hpdGVzcGFjZSB0b2tlbiB3aXRoXG4gICAgICAgICAgLy8gYHJldGFpbkVtcHR5VG9rZW5zID09PSB0cnVlYCBzaG91bGQgYmUgdHJlYXRlZCBsaWtlIGFuIGVtcHR5IHRva2VuIGFuZCBlaXRoZXJcbiAgICAgICAgICAvLyByZXRhaW5lZCBvciBtZXJnZWQgaW50byB0aGUgcHJldmlvdXMgbm9kZS4gU2luY2UgZXh0cmFjdGlvbiBkb2VzIHR3byBwYXNzZXMgd2l0aFxuICAgICAgICAgIC8vIGRpZmZlcmVudCB0cmltbWluZyBiZWhhdmlvciwgdGhlIHNlY29uZCBwYXNzIG5lZWRzIHRvIGhhdmUgaWRlbnRpY2FsIG5vZGUgY291bnRcbiAgICAgICAgICAvLyB0byByZXVzZSBzb3VyY2Ugc3BhbnMsIHNvIHdlIG5lZWQgdGhpcyBjaGVjayB0byBnZXQgdGhlIHNhbWUgYW5zd2VyIHdoZW4gYm90aFxuICAgICAgICAgIC8vIHRyaW1taW5nIGFuZCBub3QgdHJpbW1pbmcuXG4gICAgICAgICAgaWYgKHRva2VuLnBhcnRzWzBdLmxlbmd0aCA+IDAgfHwgdGhpcy5fcmV0YWluRW1wdHlUb2tlbnMpIHtcbiAgICAgICAgICAgIC8vIFRoaXMgdG9rZW4gaXMgdGV4dCBvciBhbiBlbmNvZGVkIGVudGl0eS5cbiAgICAgICAgICAgIC8vIElmIGl0IGlzIGZvbGxvd2luZyBvbiBmcm9tIGEgcHJldmlvdXMgdGV4dCBub2RlIHRoZW4gbWVyZ2UgaXQgaW50byB0aGF0IG5vZGVcbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgaWYgaXQgaXMgZm9sbG93aW5nIGFuIGludGVycG9sYXRpb24sIHRoZW4gYWRkIGEgbmV3IG5vZGUuXG4gICAgICAgICAgICBjb25zdCBwcmV2aW91cyA9IG5vZGVzW25vZGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgaWYgKHByZXZpb3VzIGluc3RhbmNlb2YgaTE4bi5UZXh0KSB7XG4gICAgICAgICAgICAgIHByZXZpb3VzLnZhbHVlICs9IHRva2VuLnBhcnRzWzBdO1xuICAgICAgICAgICAgICBwcmV2aW91cy5zb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgICAgICBwcmV2aW91cy5zb3VyY2VTcGFuLnN0YXJ0LFxuICAgICAgICAgICAgICAgIHRva2VuLnNvdXJjZVNwYW4uZW5kLFxuICAgICAgICAgICAgICAgIHByZXZpb3VzLnNvdXJjZVNwYW4uZnVsbFN0YXJ0LFxuICAgICAgICAgICAgICAgIHByZXZpb3VzLnNvdXJjZVNwYW4uZGV0YWlscyxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5vZGVzLnB1c2gobmV3IGkxOG4uVGV4dCh0b2tlbi5wYXJ0c1swXSwgdG9rZW4uc291cmNlU3BhbikpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBSZXRhaW4gZW1wdHkgdG9rZW5zIHRvIGF2b2lkIGJyZWFraW5nIGRyb3BwaW5nIGVudGlyZSBub2RlcyBzdWNoIHRoYXQgc291cmNlXG4gICAgICAgICAgICAvLyBzcGFucyBzaG91bGQgbm90IGJlIHJldXNhYmxlIGFjcm9zcyBtdWx0aXBsZSBwYXJzZXMgb2YgYSB0ZW1wbGF0ZS4gV2UgKnNob3VsZCpcbiAgICAgICAgICAgIC8vIGRvIHRoaXMgYWxsIHRoZSB0aW1lLCBob3dldmVyIHdlIG5lZWQgdG8gbWFpbnRhaW4gYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAgIC8vIHdpdGggZXhpc3RpbmcgbWVzc2FnZSBJRHMgc28gd2UgY2FuJ3QgZG8gaXQgYnkgZGVmYXVsdCBhbmQgc2hvdWxkIG9ubHkgZW5hYmxlXG4gICAgICAgICAgICAvLyB0aGlzIHdoZW4gcmVtb3Zpbmcgc2lnbmlmaWNhbnQgd2hpdGVzcGFjZS5cbiAgICAgICAgICAgIGlmICh0aGlzLl9yZXRhaW5FbXB0eVRva2Vucykge1xuICAgICAgICAgICAgICBub2Rlcy5wdXNoKG5ldyBpMThuLlRleHQodG9rZW4ucGFydHNbMF0sIHRva2VuLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaGFzSW50ZXJwb2xhdGlvbikge1xuICAgICAgLy8gV2hpdGVzcGFjZSByZW1vdmFsIG1heSBoYXZlIGludmFsaWRhdGVkIHRoZSBpbnRlcnBvbGF0aW9uIHNvdXJjZS1zcGFucy5cbiAgICAgIHJldXNlUHJldmlvdXNTb3VyY2VTcGFucyhub2RlcywgcHJldmlvdXNJMThuKTtcbiAgICAgIHJldHVybiBuZXcgaTE4bi5Db250YWluZXIobm9kZXMsIHNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZXNbMF07XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUmUtdXNlIHRoZSBzb3VyY2Utc3BhbnMgZnJvbSBgcHJldmlvdXNJMThuYCBtZXRhZGF0YSBmb3IgdGhlIGBub2Rlc2AuXG4gKlxuICogV2hpdGVzcGFjZSByZW1vdmFsIGNhbiBpbnZhbGlkYXRlIHRoZSBzb3VyY2Utc3BhbnMgb2YgaW50ZXJwb2xhdGlvbiBub2Rlcywgc28gd2VcbiAqIHJldXNlIHRoZSBzb3VyY2Utc3BhbiBzdG9yZWQgZnJvbSBhIHByZXZpb3VzIHBhc3MgYmVmb3JlIHRoZSB3aGl0ZXNwYWNlIHdhcyByZW1vdmVkLlxuICpcbiAqIEBwYXJhbSBub2RlcyBUaGUgYFRleHRgIGFuZCBgUGxhY2Vob2xkZXJgIG5vZGVzIHRvIGJlIHByb2Nlc3NlZC5cbiAqIEBwYXJhbSBwcmV2aW91c0kxOG4gQW55IGkxOG4gbWV0YWRhdGEgZm9yIHRoZXNlIGBub2Rlc2Agc3RvcmVkIGZyb20gYSBwcmV2aW91cyBwYXNzLlxuICovXG5mdW5jdGlvbiByZXVzZVByZXZpb3VzU291cmNlU3BhbnMoXG4gIG5vZGVzOiBpMThuLk5vZGVbXSxcbiAgcHJldmlvdXNJMThuOiBpMThuLkkxOG5NZXRhIHwgdW5kZWZpbmVkLFxuKTogdm9pZCB7XG4gIGlmIChwcmV2aW91c0kxOG4gaW5zdGFuY2VvZiBpMThuLk1lc3NhZ2UpIHtcbiAgICAvLyBUaGUgYHByZXZpb3VzSTE4bmAgaXMgYW4gaTE4biBgTWVzc2FnZWAsIHNvIHdlIGFyZSBwcm9jZXNzaW5nIGFuIGBBdHRyaWJ1dGVgIHdpdGggaTE4blxuICAgIC8vIG1ldGFkYXRhLiBUaGUgYE1lc3NhZ2VgIHNob3VsZCBjb25zaXN0IG9ubHkgb2YgYSBzaW5nbGUgYENvbnRhaW5lcmAgdGhhdCBjb250YWlucyB0aGVcbiAgICAvLyBwYXJ0cyAoYFRleHRgIGFuZCBgUGxhY2Vob2xkZXJgKSB0byBwcm9jZXNzLlxuICAgIGFzc2VydFNpbmdsZUNvbnRhaW5lck1lc3NhZ2UocHJldmlvdXNJMThuKTtcbiAgICBwcmV2aW91c0kxOG4gPSBwcmV2aW91c0kxOG4ubm9kZXNbMF07XG4gIH1cblxuICBpZiAocHJldmlvdXNJMThuIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIpIHtcbiAgICAvLyBUaGUgYHByZXZpb3VzSTE4bmAgaXMgYSBgQ29udGFpbmVyYCwgd2hpY2ggbWVhbnMgdGhhdCB0aGlzIGlzIGEgc2Vjb25kIGkxOG4gZXh0cmFjdGlvbiBwYXNzXG4gICAgLy8gYWZ0ZXIgd2hpdGVzcGFjZSBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIEFTVCBub2Rlcy5cbiAgICBhc3NlcnRFcXVpdmFsZW50Tm9kZXMocHJldmlvdXNJMThuLmNoaWxkcmVuLCBub2Rlcyk7XG5cbiAgICAvLyBSZXVzZSB0aGUgc291cmNlLXNwYW5zIGZyb20gdGhlIGZpcnN0IHBhc3MuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbm9kZXNbaV0uc291cmNlU3BhbiA9IHByZXZpb3VzSTE4bi5jaGlsZHJlbltpXS5zb3VyY2VTcGFuO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFzc2VydHMgdGhhdCB0aGUgYG1lc3NhZ2VgIGNvbnRhaW5zIGV4YWN0bHkgb25lIGBDb250YWluZXJgIG5vZGUuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydFNpbmdsZUNvbnRhaW5lck1lc3NhZ2UobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogdm9pZCB7XG4gIGNvbnN0IG5vZGVzID0gbWVzc2FnZS5ub2RlcztcbiAgaWYgKG5vZGVzLmxlbmd0aCAhPT0gMSB8fCAhKG5vZGVzWzBdIGluc3RhbmNlb2YgaTE4bi5Db250YWluZXIpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ1VuZXhwZWN0ZWQgcHJldmlvdXMgaTE4biBtZXNzYWdlIC0gZXhwZWN0ZWQgaXQgdG8gY29uc2lzdCBvZiBvbmx5IGEgc2luZ2xlIGBDb250YWluZXJgIG5vZGUuJyxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogQXNzZXJ0cyB0aGF0IHRoZSBgcHJldmlvdXNOb2Rlc2AgYW5kIGBub2RlYCBjb2xsZWN0aW9ucyBoYXZlIHRoZSBzYW1lIG51bWJlciBvZiBlbGVtZW50cyBhbmRcbiAqIGNvcnJlc3BvbmRpbmcgZWxlbWVudHMgaGF2ZSB0aGUgc2FtZSBub2RlIHR5cGUuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydEVxdWl2YWxlbnROb2RlcyhwcmV2aW91c05vZGVzOiBpMThuLk5vZGVbXSwgbm9kZXM6IGkxOG4uTm9kZVtdKTogdm9pZCB7XG4gIGlmIChwcmV2aW91c05vZGVzLmxlbmd0aCAhPT0gbm9kZXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFxuVGhlIG51bWJlciBvZiBpMThuIG1lc3NhZ2UgY2hpbGRyZW4gY2hhbmdlZCBiZXR3ZWVuIGZpcnN0IGFuZCBzZWNvbmQgcGFzcy5cblxuRmlyc3QgcGFzcyAoJHtwcmV2aW91c05vZGVzLmxlbmd0aH0gdG9rZW5zKTpcbiR7cHJldmlvdXNOb2Rlcy5tYXAoKG5vZGUpID0+IGBcIiR7bm9kZS5zb3VyY2VTcGFuLnRvU3RyaW5nKCl9XCJgKS5qb2luKCdcXG4nKX1cblxuU2Vjb25kIHBhc3MgKCR7bm9kZXMubGVuZ3RofSB0b2tlbnMpOlxuJHtub2Rlcy5tYXAoKG5vZGUpID0+IGBcIiR7bm9kZS5zb3VyY2VTcGFuLnRvU3RyaW5nKCl9XCJgKS5qb2luKCdcXG4nKX1cbiAgICBgLnRyaW0oKSxcbiAgICApO1xuICB9XG4gIGlmIChwcmV2aW91c05vZGVzLnNvbWUoKG5vZGUsIGkpID0+IG5vZGVzW2ldLmNvbnN0cnVjdG9yICE9PSBub2RlLmNvbnN0cnVjdG9yKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdUaGUgdHlwZXMgb2YgdGhlIGkxOG4gbWVzc2FnZSBjaGlsZHJlbiBjaGFuZ2VkIGJldHdlZW4gZmlyc3QgYW5kIHNlY29uZCBwYXNzLicsXG4gICAgKTtcbiAgfVxufVxuXG5jb25zdCBfQ1VTVE9NX1BIX0VYUCA9XG4gIC9cXC9cXC9bXFxzXFxTXSppMThuW1xcc1xcU10qXFwoW1xcc1xcU10qcGhbXFxzXFxTXSo9W1xcc1xcU10qKFwifCcpKFtcXHNcXFNdKj8pXFwxW1xcc1xcU10qXFwpL2c7XG5cbmZ1bmN0aW9uIGV4dHJhY3RQbGFjZWhvbGRlck5hbWUoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBpbnB1dC5zcGxpdChfQ1VTVE9NX1BIX0VYUClbMl07XG59XG4iXX0=