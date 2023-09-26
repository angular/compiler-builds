/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from './ast';
import { NGSP_UNICODE } from './entities';
import { ParseTreeResult } from './parser';
export const PRESERVE_WS_ATTR_NAME = 'ngPreserveWhitespaces';
const SKIP_WS_TRIM_TAGS = new Set(['pre', 'template', 'textarea', 'script', 'style']);
// Equivalent to \s with \u00a0 (non-breaking space) excluded.
// Based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
const WS_CHARS = ' \f\n\r\t\v\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
const NO_WS_REGEXP = new RegExp(`[^${WS_CHARS}]`);
const WS_REPLACE_REGEXP = new RegExp(`[${WS_CHARS}]{2,}`, 'g');
function hasPreserveWhitespacesAttr(attrs) {
    return attrs.some((attr) => attr.name === PRESERVE_WS_ATTR_NAME);
}
/**
 * &ngsp; is a placeholder for non-removable space
 * &ngsp; is converted to the 0xE500 PUA (Private Use Areas) unicode character
 * and later on replaced by a space.
 */
export function replaceNgsp(value) {
    // lexer is replacing the &ngsp; pseudo-entity with NGSP_UNICODE
    return value.replace(new RegExp(NGSP_UNICODE, 'g'), ' ');
}
/**
 * This visitor can walk HTML parse tree and remove / trim text nodes using the following rules:
 * - consider spaces, tabs and new lines as whitespace characters;
 * - drop text nodes consisting of whitespace characters only;
 * - for all other text nodes replace consecutive whitespace characters with one space;
 * - convert &ngsp; pseudo-entity to a single space;
 *
 * Removal and trimming of whitespaces have positive performance impact (less code to generate
 * while compiling templates, faster view creation). At the same time it can be "destructive"
 * in some cases (whitespaces can influence layout). Because of the potential of breaking layout
 * this visitor is not activated by default in Angular 5 and people need to explicitly opt-in for
 * whitespace removal. The default option for whitespace removal will be revisited in Angular 6
 * and might be changed to "on" by default.
 */
export class WhitespaceVisitor {
    visitElement(element, context) {
        if (SKIP_WS_TRIM_TAGS.has(element.name) || hasPreserveWhitespacesAttr(element.attrs)) {
            // don't descent into elements where we need to preserve whitespaces
            // but still visit all attributes to eliminate one used as a market to preserve WS
            return new html.Element(element.name, html.visitAll(this, element.attrs), element.children, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
        }
        return new html.Element(element.name, element.attrs, visitAllWithSiblings(this, element.children), element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
    }
    visitAttribute(attribute, context) {
        return attribute.name !== PRESERVE_WS_ATTR_NAME ? attribute : null;
    }
    visitText(text, context) {
        const isNotBlank = text.value.match(NO_WS_REGEXP);
        const hasExpansionSibling = context &&
            (context.prev instanceof html.Expansion || context.next instanceof html.Expansion);
        if (isNotBlank || hasExpansionSibling) {
            // Process the whitespace in the tokens of this Text node
            const tokens = text.tokens.map(token => token.type === 5 /* TokenType.TEXT */ ? createWhitespaceProcessedTextToken(token) : token);
            // Process the whitespace of the value of this Text node
            const value = processWhitespace(text.value);
            return new html.Text(value, text.sourceSpan, tokens, text.i18n);
        }
        return null;
    }
    visitComment(comment, context) {
        return comment;
    }
    visitExpansion(expansion, context) {
        return expansion;
    }
    visitExpansionCase(expansionCase, context) {
        return expansionCase;
    }
    visitBlock(block, context) {
        return new html.Block(block.name, block.parameters, visitAllWithSiblings(this, block.children), block.sourceSpan, block.startSourceSpan, block.endSourceSpan);
    }
    visitBlockParameter(parameter, context) {
        return parameter;
    }
}
function createWhitespaceProcessedTextToken({ type, parts, sourceSpan }) {
    return { type, parts: [processWhitespace(parts[0])], sourceSpan };
}
function processWhitespace(text) {
    return replaceNgsp(text).replace(WS_REPLACE_REGEXP, ' ');
}
export function removeWhitespaces(htmlAstWithErrors) {
    return new ParseTreeResult(html.visitAll(new WhitespaceVisitor(), htmlAstWithErrors.rootNodes), htmlAstWithErrors.errors);
}
function visitAllWithSiblings(visitor, nodes) {
    const result = [];
    nodes.forEach((ast, i) => {
        const context = { prev: nodes[i - 1], next: nodes[i + 1] };
        const astResult = ast.visit(visitor, context);
        if (astResult) {
            result.push(astResult);
        }
    });
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbF93aGl0ZXNwYWNlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssSUFBSSxNQUFNLE9BQU8sQ0FBQztBQUM5QixPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ3hDLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFHekMsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsdUJBQXVCLENBQUM7QUFFN0QsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBRXRGLDhEQUE4RDtBQUM5RCxtR0FBbUc7QUFDbkcsTUFBTSxRQUFRLEdBQUcsMEVBQTBFLENBQUM7QUFDNUYsTUFBTSxZQUFZLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBQ2xELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxRQUFRLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztBQUUvRCxTQUFTLDBCQUEwQixDQUFDLEtBQXVCO0lBQ3pELE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQW9CLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUsscUJBQXFCLENBQUMsQ0FBQztBQUNuRixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxXQUFXLENBQUMsS0FBYTtJQUN2QyxnRUFBZ0U7SUFDaEUsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUMsRUFB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QUFTLEVBQUU7WUFDYixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ3hCO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi9hc3QnO1xuaW1wb3J0IHtOR1NQX1VOSUNPREV9IGZyb20gJy4vZW50aXRpZXMnO1xuaW1wb3J0IHtQYXJzZVRyZWVSZXN1bHR9IGZyb20gJy4vcGFyc2VyJztcbmltcG9ydCB7VGV4dFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4vdG9rZW5zJztcblxuZXhwb3J0IGNvbnN0IFBSRVNFUlZFX1dTX0FUVFJfTkFNRSA9ICduZ1ByZXNlcnZlV2hpdGVzcGFjZXMnO1xuXG5jb25zdCBTS0lQX1dTX1RSSU1fVEFHUyA9IG5ldyBTZXQoWydwcmUnLCAndGVtcGxhdGUnLCAndGV4dGFyZWEnLCAnc2NyaXB0JywgJ3N0eWxlJ10pO1xuXG4vLyBFcXVpdmFsZW50IHRvIFxccyB3aXRoIFxcdTAwYTAgKG5vbi1icmVha2luZyBzcGFjZSkgZXhjbHVkZWQuXG4vLyBCYXNlZCBvbiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9SZWdFeHBcbmNvbnN0IFdTX0NIQVJTID0gJyBcXGZcXG5cXHJcXHRcXHZcXHUxNjgwXFx1MTgwZVxcdTIwMDAtXFx1MjAwYVxcdTIwMjhcXHUyMDI5XFx1MjAyZlxcdTIwNWZcXHUzMDAwXFx1ZmVmZic7XG5jb25zdCBOT19XU19SRUdFWFAgPSBuZXcgUmVnRXhwKGBbXiR7V1NfQ0hBUlN9XWApO1xuY29uc3QgV1NfUkVQTEFDRV9SRUdFWFAgPSBuZXcgUmVnRXhwKGBbJHtXU19DSEFSU31dezIsfWAsICdnJyk7XG5cbmZ1bmN0aW9uIGhhc1ByZXNlcnZlV2hpdGVzcGFjZXNBdHRyKGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdKTogYm9vbGVhbiB7XG4gIHJldHVybiBhdHRycy5zb21lKChhdHRyOiBodG1sLkF0dHJpYnV0ZSkgPT4gYXR0ci5uYW1lID09PSBQUkVTRVJWRV9XU19BVFRSX05BTUUpO1xufVxuXG4vKipcbiAqICZuZ3NwOyBpcyBhIHBsYWNlaG9sZGVyIGZvciBub24tcmVtb3ZhYmxlIHNwYWNlXG4gKiAmbmdzcDsgaXMgY29udmVydGVkIHRvIHRoZSAweEU1MDAgUFVBIChQcml2YXRlIFVzZSBBcmVhcykgdW5pY29kZSBjaGFyYWN0ZXJcbiAqIGFuZCBsYXRlciBvbiByZXBsYWNlZCBieSBhIHNwYWNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVwbGFjZU5nc3AodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIGxleGVyIGlzIHJlcGxhY2luZyB0aGUgJm5nc3A7IHBzZXVkby1lbnRpdHkgd2l0aCBOR1NQX1VOSUNPREVcbiAgcmV0dXJuIHZhbHVlLnJlcGxhY2UobmV3IFJlZ0V4cChOR1NQX1VOSUNPREUsICdnJyksICcgJyk7XG59XG5cbi8qKlxuICogVGhpcyB2aXNpdG9yIGNhbiB3YWxrIEhUTUwgcGFyc2UgdHJlZSBhbmQgcmVtb3ZlIC8gdHJpbSB0ZXh0IG5vZGVzIHVzaW5nIHRoZSBmb2xsb3dpbmcgcnVsZXM6XG4gKiAtIGNvbnNpZGVyIHNwYWNlcywgdGFicyBhbmQgbmV3IGxpbmVzIGFzIHdoaXRlc3BhY2UgY2hhcmFjdGVycztcbiAqIC0gZHJvcCB0ZXh0IG5vZGVzIGNvbnNpc3Rpbmcgb2Ygd2hpdGVzcGFjZSBjaGFyYWN0ZXJzIG9ubHk7XG4gKiAtIGZvciBhbGwgb3RoZXIgdGV4dCBub2RlcyByZXBsYWNlIGNvbnNlY3V0aXZlIHdoaXRlc3BhY2UgY2hhcmFjdGVycyB3aXRoIG9uZSBzcGFjZTtcbiAqIC0gY29udmVydCAmbmdzcDsgcHNldWRvLWVudGl0eSB0byBhIHNpbmdsZSBzcGFjZTtcbiAqXG4gKiBSZW1vdmFsIGFuZCB0cmltbWluZyBvZiB3aGl0ZXNwYWNlcyBoYXZlIHBvc2l0aXZlIHBlcmZvcm1hbmNlIGltcGFjdCAobGVzcyBjb2RlIHRvIGdlbmVyYXRlXG4gKiB3aGlsZSBjb21waWxpbmcgdGVtcGxhdGVzLCBmYXN0ZXIgdmlldyBjcmVhdGlvbikuIEF0IHRoZSBzYW1lIHRpbWUgaXQgY2FuIGJlIFwiZGVzdHJ1Y3RpdmVcIlxuICogaW4gc29tZSBjYXNlcyAod2hpdGVzcGFjZXMgY2FuIGluZmx1ZW5jZSBsYXlvdXQpLiBCZWNhdXNlIG9mIHRoZSBwb3RlbnRpYWwgb2YgYnJlYWtpbmcgbGF5b3V0XG4gKiB0aGlzIHZpc2l0b3IgaXMgbm90IGFjdGl2YXRlZCBieSBkZWZhdWx0IGluIEFuZ3VsYXIgNSBhbmQgcGVvcGxlIG5lZWQgdG8gZXhwbGljaXRseSBvcHQtaW4gZm9yXG4gKiB3aGl0ZXNwYWNlIHJlbW92YWwuIFRoZSBkZWZhdWx0IG9wdGlvbiBmb3Igd2hpdGVzcGFjZSByZW1vdmFsIHdpbGwgYmUgcmV2aXNpdGVkIGluIEFuZ3VsYXIgNlxuICogYW5kIG1pZ2h0IGJlIGNoYW5nZWQgdG8gXCJvblwiIGJ5IGRlZmF1bHQuXG4gKi9cbmV4cG9ydCBjbGFzcyBXaGl0ZXNwYWNlVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBodG1sLkVsZW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgaWYgKFNLSVBfV1NfVFJJTV9UQUdTLmhhcyhlbGVtZW50Lm5hbWUpIHx8IGhhc1ByZXNlcnZlV2hpdGVzcGFjZXNBdHRyKGVsZW1lbnQuYXR0cnMpKSB7XG4gICAgICAvLyBkb24ndCBkZXNjZW50IGludG8gZWxlbWVudHMgd2hlcmUgd2UgbmVlZCB0byBwcmVzZXJ2ZSB3aGl0ZXNwYWNlc1xuICAgICAgLy8gYnV0IHN0aWxsIHZpc2l0IGFsbCBhdHRyaWJ1dGVzIHRvIGVsaW1pbmF0ZSBvbmUgdXNlZCBhcyBhIG1hcmtldCB0byBwcmVzZXJ2ZSBXU1xuICAgICAgcmV0dXJuIG5ldyBodG1sLkVsZW1lbnQoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBodG1sLnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuYXR0cnMpLCBlbGVtZW50LmNoaWxkcmVuLCBlbGVtZW50LnNvdXJjZVNwYW4sXG4gICAgICAgICAgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3BhbiwgZWxlbWVudC5pMThuKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IGh0bWwuRWxlbWVudChcbiAgICAgICAgZWxlbWVudC5uYW1lLCBlbGVtZW50LmF0dHJzLCB2aXNpdEFsbFdpdGhTaWJsaW5ncyh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKSxcbiAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYXR0cmlidXRlLm5hbWUgIT09IFBSRVNFUlZFX1dTX0FUVFJfTkFNRSA/IGF0dHJpYnV0ZSA6IG51bGw7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBjb250ZXh0OiBTaWJsaW5nVmlzaXRvckNvbnRleHR8bnVsbCk6IGFueSB7XG4gICAgY29uc3QgaXNOb3RCbGFuayA9IHRleHQudmFsdWUubWF0Y2goTk9fV1NfUkVHRVhQKTtcbiAgICBjb25zdCBoYXNFeHBhbnNpb25TaWJsaW5nID0gY29udGV4dCAmJlxuICAgICAgICAoY29udGV4dC5wcmV2IGluc3RhbmNlb2YgaHRtbC5FeHBhbnNpb24gfHwgY29udGV4dC5uZXh0IGluc3RhbmNlb2YgaHRtbC5FeHBhbnNpb24pO1xuXG4gICAgaWYgKGlzTm90QmxhbmsgfHwgaGFzRXhwYW5zaW9uU2libGluZykge1xuICAgICAgLy8gUHJvY2VzcyB0aGUgd2hpdGVzcGFjZSBpbiB0aGUgdG9rZW5zIG9mIHRoaXMgVGV4dCBub2RlXG4gICAgICBjb25zdCB0b2tlbnMgPSB0ZXh0LnRva2Vucy5tYXAoXG4gICAgICAgICAgdG9rZW4gPT5cbiAgICAgICAgICAgICAgdG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLlRFWFQgPyBjcmVhdGVXaGl0ZXNwYWNlUHJvY2Vzc2VkVGV4dFRva2VuKHRva2VuKSA6IHRva2VuKTtcbiAgICAgIC8vIFByb2Nlc3MgdGhlIHdoaXRlc3BhY2Ugb2YgdGhlIHZhbHVlIG9mIHRoaXMgVGV4dCBub2RlXG4gICAgICBjb25zdCB2YWx1ZSA9IHByb2Nlc3NXaGl0ZXNwYWNlKHRleHQudmFsdWUpO1xuICAgICAgcmV0dXJuIG5ldyBodG1sLlRleHQodmFsdWUsIHRleHQuc291cmNlU3BhbiwgdG9rZW5zLCB0ZXh0LmkxOG4pO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gY29tbWVudDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGV4cGFuc2lvbjtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGV4cGFuc2lvbkNhc2U7XG4gIH1cblxuICB2aXNpdEJsb2NrKGJsb2NrOiBodG1sLkJsb2NrLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBuZXcgaHRtbC5CbG9jayhcbiAgICAgICAgYmxvY2submFtZSwgYmxvY2sucGFyYW1ldGVycywgdmlzaXRBbGxXaXRoU2libGluZ3ModGhpcywgYmxvY2suY2hpbGRyZW4pLCBibG9jay5zb3VyY2VTcGFuLFxuICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sIGJsb2NrLmVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRCbG9ja1BhcmFtZXRlcihwYXJhbWV0ZXI6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGNvbnRleHQ6IGFueSkge1xuICAgIHJldHVybiBwYXJhbWV0ZXI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlV2hpdGVzcGFjZVByb2Nlc3NlZFRleHRUb2tlbih7dHlwZSwgcGFydHMsIHNvdXJjZVNwYW59OiBUZXh0VG9rZW4pOiBUZXh0VG9rZW4ge1xuICByZXR1cm4ge3R5cGUsIHBhcnRzOiBbcHJvY2Vzc1doaXRlc3BhY2UocGFydHNbMF0pXSwgc291cmNlU3Bhbn07XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NXaGl0ZXNwYWNlKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiByZXBsYWNlTmdzcCh0ZXh0KS5yZXBsYWNlKFdTX1JFUExBQ0VfUkVHRVhQLCAnICcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlV2hpdGVzcGFjZXMoaHRtbEFzdFdpdGhFcnJvcnM6IFBhcnNlVHJlZVJlc3VsdCk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gIHJldHVybiBuZXcgUGFyc2VUcmVlUmVzdWx0KFxuICAgICAgaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzKSxcbiAgICAgIGh0bWxBc3RXaXRoRXJyb3JzLmVycm9ycyk7XG59XG5cbmludGVyZmFjZSBTaWJsaW5nVmlzaXRvckNvbnRleHQge1xuICBwcmV2OiBodG1sLk5vZGV8dW5kZWZpbmVkO1xuICBuZXh0OiBodG1sLk5vZGV8dW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiB2aXNpdEFsbFdpdGhTaWJsaW5ncyh2aXNpdG9yOiBXaGl0ZXNwYWNlVmlzaXRvciwgbm9kZXM6IGh0bWwuTm9kZVtdKTogYW55W10ge1xuICBjb25zdCByZXN1bHQ6IGFueVtdID0gW107XG5cbiAgbm9kZXMuZm9yRWFjaCgoYXN0LCBpKSA9PiB7XG4gICAgY29uc3QgY29udGV4dDogU2libGluZ1Zpc2l0b3JDb250ZXh0ID0ge3ByZXY6IG5vZGVzW2kgLSAxXSwgbmV4dDogbm9kZXNbaSArIDFdfTtcbiAgICBjb25zdCBhc3RSZXN1bHQgPSBhc3QudmlzaXQodmlzaXRvciwgY29udGV4dCk7XG4gICAgaWYgKGFzdFJlc3VsdCkge1xuICAgICAgcmVzdWx0LnB1c2goYXN0UmVzdWx0KTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuIl19