/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from '../ml_parser/ast';
import { ParseError } from '../parse_util';
import * as t from './r3_ast';
/** Pattern for the expression in a for loop block. */
const FOR_LOOP_EXPRESSION_PATTERN = /^\s*([0-9A-Za-z_$]*)\s+of\s+(.*)/;
/** Pattern for the tracking expression in a for loop block. */
const FOR_LOOP_TRACK_PATTERN = /^track\s+(.*)/;
/** Pattern for the `as` expression in a conditional block. */
const CONDITIONAL_ALIAS_PATTERN = /^as\s+(.*)/;
/** Pattern used to identify an `else if` block. */
const ELSE_IF_PATTERN = /^if\s/;
/** Creates an `if` loop block from an HTML AST node. */
export function createIfBlock(ast, visitor, bindingParser) {
    const errors = validateIfBlock(ast);
    const branches = [];
    if (errors.length > 0) {
        return { node: null, errors };
    }
    // Assumes that the structure is valid since we validated it above.
    for (const block of ast.blocks) {
        const children = html.visitAll(visitor, block.children);
        // `{:else}` block.
        if (block.name === 'else' && block.parameters.length === 0) {
            branches.push(new t.IfBlockBranch(null, children, null, block.sourceSpan, block.startSourceSpan));
            continue;
        }
        // Expressions for `{:else if}` blocks start at 2 to skip the `if` from the expression.
        const expressionStart = block.name === 'if' ? 0 : 2;
        const params = parseConditionalBlockParameters(block, errors, bindingParser, expressionStart);
        if (params !== null) {
            branches.push(new t.IfBlockBranch(params.expression, children, params.expressionAlias, block.sourceSpan, block.startSourceSpan));
        }
    }
    return {
        node: new t.IfBlock(branches, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan),
        errors,
    };
}
/** Creates a `for` loop block from an HTML AST node. */
export function createForLoop(ast, visitor, bindingParser) {
    const [primaryBlock, ...secondaryBlocks] = ast.blocks;
    const errors = [];
    const params = parseForLoopParameters(primaryBlock, errors, bindingParser);
    let node = null;
    let empty = null;
    for (const block of secondaryBlocks) {
        if (block.name === 'empty') {
            if (empty !== null) {
                errors.push(new ParseError(block.sourceSpan, 'For loop can only have one "empty" block'));
            }
            else if (block.parameters.length > 0) {
                errors.push(new ParseError(block.sourceSpan, 'Empty block cannot have parameters'));
            }
            else {
                empty = new t.ForLoopBlockEmpty(html.visitAll(visitor, block.children), block.sourceSpan, block.startSourceSpan);
            }
        }
        else {
            errors.push(new ParseError(block.sourceSpan, `Unrecognized loop block "${block.name}"`));
        }
    }
    if (params !== null) {
        if (params.trackBy === null) {
            errors.push(new ParseError(ast.sourceSpan, 'For loop must have a "track" expression'));
        }
        else {
            node = new t.ForLoopBlock(params.itemName, params.expression, params.trackBy, html.visitAll(visitor, primaryBlock.children), empty, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
        }
    }
    return { node, errors };
}
/** Creates a switch block from an HTML AST node. */
export function createSwitchBlock(ast, visitor, bindingParser) {
    const [primaryBlock, ...secondaryBlocks] = ast.blocks;
    const errors = validateSwitchBlock(ast);
    if (errors.length > 0) {
        return { node: null, errors };
    }
    const primaryExpression = parseBlockParameterToBinding(primaryBlock.parameters[0], bindingParser);
    const cases = [];
    let defaultCase = null;
    // Here we assume that all the blocks are valid given that we validated them above.
    for (const block of secondaryBlocks) {
        const expression = block.name === 'case' ?
            parseBlockParameterToBinding(block.parameters[0], bindingParser) :
            null;
        const ast = new t.SwitchBlockCase(expression, html.visitAll(visitor, block.children), block.sourceSpan, block.startSourceSpan);
        if (expression === null) {
            defaultCase = ast;
        }
        else {
            cases.push(ast);
        }
    }
    // Ensure that the default case is last in the array.
    if (defaultCase !== null) {
        cases.push(defaultCase);
    }
    return {
        node: new t.SwitchBlock(primaryExpression, cases, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan),
        errors
    };
}
/** Parses the parameters of a `for` loop block. */
function parseForLoopParameters(block, errors, bindingParser) {
    if (block.parameters.length === 0) {
        errors.push(new ParseError(block.sourceSpan, 'For loop does not have an expression'));
        return null;
    }
    const [expressionParam, ...secondaryParams] = block.parameters;
    const match = stripOptionalParentheses(expressionParam, errors)?.match(FOR_LOOP_EXPRESSION_PATTERN);
    if (!match || match[2].trim().length === 0) {
        errors.push(new ParseError(expressionParam.sourceSpan, 'Cannot parse expression. For loop expression must match the pattern "<identifier> of <expression>"'));
        return null;
    }
    const [, itemName, rawExpression] = match;
    const result = {
        itemName,
        trackBy: null,
        expression: bindingParser.parseBinding(rawExpression, false, expressionParam.sourceSpan, 
        // Note: `lastIndexOf` here should be enough to know the start index of the expression,
        // because we know that it'll be the last matching group. Ideally we could use the `d`
        // flag on the regex and get the index from `match.indices`, but it's unclear if we can
        // use it yet since it's a relatively new feature. See:
        // https://github.com/tc39/proposal-regexp-match-indices
        Math.max(0, expressionParam.expression.lastIndexOf(rawExpression)))
    };
    for (const param of secondaryParams) {
        const trackMatch = param.expression.match(FOR_LOOP_TRACK_PATTERN);
        // For now loops can only have a `track` parameter.
        // We may want to rework this later if we add more.
        if (trackMatch === null) {
            errors.push(new ParseError(param.sourceSpan, `Unrecognized loop paramater "${param.expression}"`));
        }
        else if (result.trackBy !== null) {
            errors.push(new ParseError(param.sourceSpan, 'For loop can only have one "track" expression'));
        }
        else {
            result.trackBy = trackMatch[1].trim();
        }
    }
    return result;
}
/** Checks that the shape of a `if` block is valid. Returns an array of errors. */
function validateIfBlock(ast) {
    const errors = [];
    let hasElse = false;
    for (let i = 0; i < ast.blocks.length; i++) {
        const block = ast.blocks[i];
        // Conditional blocks only allow `if`, `else if` and `else` blocks.
        if ((block.name !== 'if' || i > 0) && block.name !== 'else') {
            errors.push(new ParseError(block.sourceSpan, `Unrecognized conditional block "${block.name}"`));
            continue;
        }
        if (block.name === 'if') {
            continue;
        }
        if (block.parameters.length === 0) {
            if (hasElse) {
                errors.push(new ParseError(block.sourceSpan, 'Conditional can only have one "else" block'));
            }
            else if (ast.blocks.length > 1 && i < ast.blocks.length - 1) {
                errors.push(new ParseError(block.sourceSpan, 'Else block must be last inside the conditional'));
            }
            hasElse = true;
            // `else if` is an edge case, because it has a space after the block name
            // which means that the `if` is captured as a part of the parameters.
        }
        else if (block.parameters.length > 0 && !ELSE_IF_PATTERN.test(block.parameters[0].expression)) {
            errors.push(new ParseError(block.sourceSpan, 'Else block cannot have parameters'));
        }
    }
    return errors;
}
/** Checks that the shape of a `switch` block is valid. Returns an array of errors. */
function validateSwitchBlock(ast) {
    const [primaryBlock, ...secondaryBlocks] = ast.blocks;
    const errors = [];
    let hasDefault = false;
    if (primaryBlock.children.length > 0) {
        errors.push(new ParseError(primaryBlock.sourceSpan, 'Switch block can only contain "case" and "default" blocks'));
    }
    if (primaryBlock.parameters.length !== 1) {
        errors.push(new ParseError(primaryBlock.sourceSpan, 'Switch block must have exactly one parameter'));
    }
    for (const block of secondaryBlocks) {
        if (block.name === 'case') {
            if (block.parameters.length !== 1) {
                errors.push(new ParseError(block.sourceSpan, 'Case block must have exactly one parameter'));
            }
        }
        else if (block.name === 'default') {
            if (hasDefault) {
                errors.push(new ParseError(block.sourceSpan, 'Switch block can only have one "default" block'));
            }
            else if (block.parameters.length > 0) {
                errors.push(new ParseError(block.sourceSpan, 'Default block cannot have parameters'));
            }
            hasDefault = true;
        }
        else {
            errors.push(new ParseError(block.sourceSpan, 'Switch block can only contain "case" and "default" blocks'));
        }
    }
    return errors;
}
/** Parses a block parameter into a binding AST. */
function parseBlockParameterToBinding(ast, bindingParser, start = 0) {
    return bindingParser.parseBinding(ast.expression.slice(start), false, ast.sourceSpan, ast.sourceSpan.start.offset + start);
}
/** Parses the parameter of a conditional block (`if` or `else if`). */
function parseConditionalBlockParameters(block, errors, bindingParser, primaryExpressionStart) {
    if (block.parameters.length === 0) {
        errors.push(new ParseError(block.sourceSpan, 'Conditional block does not have an expression'));
        return null;
    }
    const expression = parseBlockParameterToBinding(block.parameters[0], bindingParser, primaryExpressionStart);
    let expressionAlias = null;
    // Start from 1 since we processed the first parameter already.
    for (let i = 1; i < block.parameters.length; i++) {
        const param = block.parameters[i];
        const aliasMatch = param.expression.match(CONDITIONAL_ALIAS_PATTERN);
        // For now conditionals can only have an `as` parameter.
        // We may want to rework this later if we add more.
        if (aliasMatch === null) {
            errors.push(new ParseError(param.sourceSpan, `Unrecognized conditional paramater "${param.expression}"`));
        }
        else if (expressionAlias !== null) {
            errors.push(new ParseError(param.sourceSpan, 'Conditional can only have one "as" expression'));
        }
        else {
            expressionAlias = aliasMatch[1].trim();
        }
    }
    return { expression, expressionAlias };
}
/** Strips optional parentheses around from a control from expression parameter. */
function stripOptionalParentheses(param, errors) {
    const expression = param.expression;
    const spaceRegex = /^\s$/;
    let openParens = 0;
    let start = 0;
    let end = expression.length - 1;
    for (let i = 0; i < expression.length; i++) {
        const char = expression[i];
        if (char === '(') {
            start = i + 1;
            openParens++;
        }
        else if (spaceRegex.test(char)) {
            continue;
        }
        else {
            break;
        }
    }
    if (openParens === 0) {
        return expression;
    }
    for (let i = expression.length - 1; i > -1; i--) {
        const char = expression[i];
        if (char === ')') {
            end = i;
            openParens--;
            if (openParens === 0) {
                break;
            }
        }
        else if (spaceRegex.test(char)) {
            continue;
        }
        else {
            break;
        }
    }
    if (openParens !== 0) {
        errors.push(new ParseError(param.sourceSpan, 'Unclosed parentheses in expression'));
        return null;
    }
    return expression.slice(start, end);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUd6QyxPQUFPLEtBQUssQ0FBQyxNQUFNLFVBQVUsQ0FBQztBQUU5QixzREFBc0Q7QUFDdEQsTUFBTSwyQkFBMkIsR0FBRyxrQ0FBa0MsQ0FBQztBQUV2RSwrREFBK0Q7QUFDL0QsTUFBTSxzQkFBc0IsR0FBRyxlQUFlLENBQUM7QUFFL0MsOERBQThEO0FBQzlELE1BQU0seUJBQXlCLEdBQUcsWUFBWSxDQUFDO0FBRS9DLG1EQUFtRDtBQUNuRCxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUM7QUFFaEMsd0RBQXdEO0FBQ3hELE1BQU0sVUFBVSxhQUFhLENBQ3pCLEdBQW9CLEVBQUUsT0FBcUIsRUFDM0MsYUFBNEI7SUFDOUIsTUFBTSxNQUFNLEdBQWlCLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNsRCxNQUFNLFFBQVEsR0FBc0IsRUFBRSxDQUFDO0lBRXZDLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDckIsT0FBTyxFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7S0FDN0I7SUFFRCxtRUFBbUU7SUFDbkUsS0FBSyxNQUFNLEtBQUssSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFO1FBQzlCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUV4RCxtQkFBbUI7UUFDbkIsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFL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LEdBQUcsRUFBRTtZQUNoQixHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQ1IsVUFBVSxFQUFFLENBQUM7WUFDYixJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUU7Z0JBQ3BCLE1BQU07YUFDUDtTQUNGO2FBQU0sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2hDLFNBQVM7U0FDVjthQUFNO1lBQ0wsTUFBTTtTQUNQO0tBQ0Y7SUFFRCxJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUU7UUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLG9DQUFvQyxDQUFDLENBQUMsQ0FBQztRQUNwRixPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN0QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNUV2l0aFNvdXJjZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3J9IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcblxuLyoqIFBhdHRlcm4gZm9yIHRoZSBleHByZXNzaW9uIGluIGEgZm9yIGxvb3AgYmxvY2suICovXG5jb25zdCBGT1JfTE9PUF9FWFBSRVNTSU9OX1BBVFRFUk4gPSAvXlxccyooWzAtOUEtWmEtel8kXSopXFxzK29mXFxzKyguKikvO1xuXG4vKiogUGF0dGVybiBmb3IgdGhlIHRyYWNraW5nIGV4cHJlc3Npb24gaW4gYSBmb3IgbG9vcCBibG9jay4gKi9cbmNvbnN0IEZPUl9MT09QX1RSQUNLX1BBVFRFUk4gPSAvXnRyYWNrXFxzKyguKikvO1xuXG4vKiogUGF0dGVybiBmb3IgdGhlIGBhc2AgZXhwcmVzc2lvbiBpbiBhIGNvbmRpdGlvbmFsIGJsb2NrLiAqL1xuY29uc3QgQ09ORElUSU9OQUxfQUxJQVNfUEFUVEVSTiA9IC9eYXNcXHMrKC4qKS87XG5cbi8qKiBQYXR0ZXJuIHVzZWQgdG8gaWRlbnRpZnkgYW4gYGVsc2UgaWZgIGJsb2NrLiAqL1xuY29uc3QgRUxTRV9JRl9QQVRURVJOID0gL15pZlxccy87XG5cbi8qKiBDcmVhdGVzIGFuIGBpZmAgbG9vcCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSWZCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2tHcm91cCwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5JZkJsb2NrfG51bGwsIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gdmFsaWRhdGVJZkJsb2NrKGFzdCk7XG4gIGNvbnN0IGJyYW5jaGVzOiB0LklmQmxvY2tCcmFuY2hbXSA9IFtdO1xuXG4gIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7bm9kZTogbnVsbCwgZXJyb3JzfTtcbiAgfVxuXG4gIC8vIEFzc3VtZXMgdGhhdCB0aGUgc3RydWN0dXJlIGlzIHZhbGlkIHNpbmNlIHdlIHZhbGlkYXRlZCBpdCBhYm92ZS5cbiAgZm9yIChjb25zdCBibG9jayBvZiBhc3QuYmxvY2tzKSB7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuKTtcblxuICAgIC8vIGB7OmVsc2V9YCBibG9jay5cbiAgICBpZiAoYmxvY2submFtZSA9PT0gJ2Vsc2UnICYmIGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBicmFuY2hlcy5wdXNoKFxuICAgICAgICAgIG5ldyB0LklmQmxvY2tCcmFuY2gobnVsbCwgY2hpbGRyZW4sIG51bGwsIGJsb2NrLnNvdXJjZVNwYW4sIGJsb2NrLnN0YXJ0U291cmNlU3BhbikpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gRXhwcmVzc2lvbnMgZm9yIGB7OmVsc2UgaWZ9YCBibG9ja3Mgc3RhcnQgYXQgMiB0byBza2lwIHRoZSBgaWZgIGZyb20gdGhlIGV4cHJlc3Npb24uXG4gICAgY29uc3QgZXhwcmVzc2lvblN0YXJ0ID0gYmxvY2submFtZSA9PT0gJ2lmJyA/IDAgOiAyO1xuICAgIGNvbnN0IHBhcmFtcyA9IHBhcnNlQ29uZGl0aW9uYWxCbG9ja1BhcmFtZXRlcnMoYmxvY2ssIGVycm9ycywgYmluZGluZ1BhcnNlciwgZXhwcmVzc2lvblN0YXJ0KTtcblxuICAgIGlmIChwYXJhbXMgIT09IG51bGwpIHtcbiAgICAgIGJyYW5jaGVzLnB1c2gobmV3IHQuSWZCbG9ja0JyYW5jaChcbiAgICAgICAgICBwYXJhbXMuZXhwcmVzc2lvbiwgY2hpbGRyZW4sIHBhcmFtcy5leHByZXNzaW9uQWxpYXMsIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBub2RlOiBuZXcgdC5JZkJsb2NrKGJyYW5jaGVzLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pLFxuICAgIGVycm9ycyxcbiAgfTtcbn1cblxuLyoqIENyZWF0ZXMgYSBgZm9yYCBsb29wIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVGb3JMb29wKFxuICAgIGFzdDogaHRtbC5CbG9ja0dyb3VwLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LkZvckxvb3BCbG9ja3xudWxsLCBlcnJvcnM6IFBhcnNlRXJyb3JbXX0ge1xuICBjb25zdCBbcHJpbWFyeUJsb2NrLCAuLi5zZWNvbmRhcnlCbG9ja3NdID0gYXN0LmJsb2NrcztcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgY29uc3QgcGFyYW1zID0gcGFyc2VGb3JMb29wUGFyYW1ldGVycyhwcmltYXJ5QmxvY2ssIGVycm9ycywgYmluZGluZ1BhcnNlcik7XG4gIGxldCBub2RlOiB0LkZvckxvb3BCbG9ja3xudWxsID0gbnVsbDtcbiAgbGV0IGVtcHR5OiB0LkZvckxvb3BCbG9ja0VtcHR5fG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgYmxvY2sgb2Ygc2Vjb25kYXJ5QmxvY2tzKSB7XG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdlbXB0eScpIHtcbiAgICAgIGlmIChlbXB0eSAhPT0gbnVsbCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRm9yIGxvb3AgY2FuIG9ubHkgaGF2ZSBvbmUgXCJlbXB0eVwiIGJsb2NrJykpO1xuICAgICAgfSBlbHNlIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0VtcHR5IGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMnKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbXB0eSA9IG5ldyB0LkZvckxvb3BCbG9ja0VtcHR5KFxuICAgICAgICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiksIGJsb2NrLnNvdXJjZVNwYW4sIGJsb2NrLnN0YXJ0U291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgbG9vcCBibG9jayBcIiR7YmxvY2submFtZX1cImApKTtcbiAgICB9XG4gIH1cblxuICBpZiAocGFyYW1zICE9PSBudWxsKSB7XG4gICAgaWYgKHBhcmFtcy50cmFja0J5ID09PSBudWxsKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihhc3Quc291cmNlU3BhbiwgJ0ZvciBsb29wIG11c3QgaGF2ZSBhIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBub2RlID0gbmV3IHQuRm9yTG9vcEJsb2NrKFxuICAgICAgICAgIHBhcmFtcy5pdGVtTmFtZSwgcGFyYW1zLmV4cHJlc3Npb24sIHBhcmFtcy50cmFja0J5LFxuICAgICAgICAgIGh0bWwudmlzaXRBbGwodmlzaXRvciwgcHJpbWFyeUJsb2NrLmNoaWxkcmVuKSwgZW1wdHksIGFzdC5zb3VyY2VTcGFuLCBhc3Quc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICAgIGFzdC5lbmRTb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge25vZGUsIGVycm9yc307XG59XG5cbi8qKiBDcmVhdGVzIGEgc3dpdGNoIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTd2l0Y2hCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2tHcm91cCwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5Td2l0Y2hCbG9ja3xudWxsLCBlcnJvcnM6IFBhcnNlRXJyb3JbXX0ge1xuICBjb25zdCBbcHJpbWFyeUJsb2NrLCAuLi5zZWNvbmRhcnlCbG9ja3NdID0gYXN0LmJsb2NrcztcbiAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGVTd2l0Y2hCbG9jayhhc3QpO1xuXG4gIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7bm9kZTogbnVsbCwgZXJyb3JzfTtcbiAgfVxuXG4gIGNvbnN0IHByaW1hcnlFeHByZXNzaW9uID0gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhwcmltYXJ5QmxvY2sucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcik7XG4gIGNvbnN0IGNhc2VzOiB0LlN3aXRjaEJsb2NrQ2FzZVtdID0gW107XG4gIGxldCBkZWZhdWx0Q2FzZTogdC5Td2l0Y2hCbG9ja0Nhc2V8bnVsbCA9IG51bGw7XG5cbiAgLy8gSGVyZSB3ZSBhc3N1bWUgdGhhdCBhbGwgdGhlIGJsb2NrcyBhcmUgdmFsaWQgZ2l2ZW4gdGhhdCB3ZSB2YWxpZGF0ZWQgdGhlbSBhYm92ZS5cbiAgZm9yIChjb25zdCBibG9jayBvZiBzZWNvbmRhcnlCbG9ja3MpIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gYmxvY2submFtZSA9PT0gJ2Nhc2UnID9cbiAgICAgICAgcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhibG9jay5wYXJhbWV0ZXJzWzBdLCBiaW5kaW5nUGFyc2VyKSA6XG4gICAgICAgIG51bGw7XG4gICAgY29uc3QgYXN0ID0gbmV3IHQuU3dpdGNoQmxvY2tDYXNlKFxuICAgICAgICBleHByZXNzaW9uLCBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuKSwgYmxvY2suc291cmNlU3BhbixcbiAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuKTtcblxuICAgIGlmIChleHByZXNzaW9uID09PSBudWxsKSB7XG4gICAgICBkZWZhdWx0Q2FzZSA9IGFzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FzZXMucHVzaChhc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEVuc3VyZSB0aGF0IHRoZSBkZWZhdWx0IGNhc2UgaXMgbGFzdCBpbiB0aGUgYXJyYXkuXG4gIGlmIChkZWZhdWx0Q2FzZSAhPT0gbnVsbCkge1xuICAgIGNhc2VzLnB1c2goZGVmYXVsdENhc2UpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBub2RlOiBuZXcgdC5Td2l0Y2hCbG9jayhcbiAgICAgICAgcHJpbWFyeUV4cHJlc3Npb24sIGNhc2VzLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pLFxuICAgIGVycm9yc1xuICB9O1xufVxuXG4vKiogUGFyc2VzIHRoZSBwYXJhbWV0ZXJzIG9mIGEgYGZvcmAgbG9vcCBibG9jay4gKi9cbmZ1bmN0aW9uIHBhcnNlRm9yTG9vcFBhcmFtZXRlcnMoXG4gICAgYmxvY2s6IGh0bWwuQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdGb3IgbG9vcCBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBbZXhwcmVzc2lvblBhcmFtLCAuLi5zZWNvbmRhcnlQYXJhbXNdID0gYmxvY2sucGFyYW1ldGVycztcbiAgY29uc3QgbWF0Y2ggPVxuICAgICAgc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKGV4cHJlc3Npb25QYXJhbSwgZXJyb3JzKT8ubWF0Y2goRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOKTtcblxuICBpZiAoIW1hdGNoIHx8IG1hdGNoWzJdLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4sXG4gICAgICAgICdDYW5ub3QgcGFyc2UgZXhwcmVzc2lvbi4gRm9yIGxvb3AgZXhwcmVzc2lvbiBtdXN0IG1hdGNoIHRoZSBwYXR0ZXJuIFwiPGlkZW50aWZpZXI+IG9mIDxleHByZXNzaW9uPlwiJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgWywgaXRlbU5hbWUsIHJhd0V4cHJlc3Npb25dID0gbWF0Y2g7XG4gIGNvbnN0IHJlc3VsdCA9IHtcbiAgICBpdGVtTmFtZSxcbiAgICB0cmFja0J5OiBudWxsIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZXhwcmVzc2lvbjogYmluZGluZ1BhcnNlci5wYXJzZUJpbmRpbmcoXG4gICAgICAgIHJhd0V4cHJlc3Npb24sIGZhbHNlLCBleHByZXNzaW9uUGFyYW0uc291cmNlU3BhbixcbiAgICAgICAgLy8gTm90ZTogYGxhc3RJbmRleE9mYCBoZXJlIHNob3VsZCBiZSBlbm91Z2ggdG8ga25vdyB0aGUgc3RhcnQgaW5kZXggb2YgdGhlIGV4cHJlc3Npb24sXG4gICAgICAgIC8vIGJlY2F1c2Ugd2Uga25vdyB0aGF0IGl0J2xsIGJlIHRoZSBsYXN0IG1hdGNoaW5nIGdyb3VwLiBJZGVhbGx5IHdlIGNvdWxkIHVzZSB0aGUgYGRgXG4gICAgICAgIC8vIGZsYWcgb24gdGhlIHJlZ2V4IGFuZCBnZXQgdGhlIGluZGV4IGZyb20gYG1hdGNoLmluZGljZXNgLCBidXQgaXQncyB1bmNsZWFyIGlmIHdlIGNhblxuICAgICAgICAvLyB1c2UgaXQgeWV0IHNpbmNlIGl0J3MgYSByZWxhdGl2ZWx5IG5ldyBmZWF0dXJlLiBTZWU6XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L3Byb3Bvc2FsLXJlZ2V4cC1tYXRjaC1pbmRpY2VzXG4gICAgICAgIE1hdGgubWF4KDAsIGV4cHJlc3Npb25QYXJhbS5leHByZXNzaW9uLmxhc3RJbmRleE9mKHJhd0V4cHJlc3Npb24pKSlcbiAgfTtcblxuICBmb3IgKGNvbnN0IHBhcmFtIG9mIHNlY29uZGFyeVBhcmFtcykge1xuICAgIGNvbnN0IHRyYWNrTWF0Y2ggPSBwYXJhbS5leHByZXNzaW9uLm1hdGNoKEZPUl9MT09QX1RSQUNLX1BBVFRFUk4pO1xuXG4gICAgLy8gRm9yIG5vdyBsb29wcyBjYW4gb25seSBoYXZlIGEgYHRyYWNrYCBwYXJhbWV0ZXIuXG4gICAgLy8gV2UgbWF5IHdhbnQgdG8gcmV3b3JrIHRoaXMgbGF0ZXIgaWYgd2UgYWRkIG1vcmUuXG4gICAgaWYgKHRyYWNrTWF0Y2ggPT09IG51bGwpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgbG9vcCBwYXJhbWF0ZXIgXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKSk7XG4gICAgfSBlbHNlIGlmIChyZXN1bHQudHJhY2tCeSAhPT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ0ZvciBsb29wIGNhbiBvbmx5IGhhdmUgb25lIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQudHJhY2tCeSA9IHRyYWNrTWF0Y2hbMV0udHJpbSgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKiBDaGVja3MgdGhhdCB0aGUgc2hhcGUgb2YgYSBgaWZgIGJsb2NrIGlzIHZhbGlkLiBSZXR1cm5zIGFuIGFycmF5IG9mIGVycm9ycy4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlSWZCbG9jayhhc3Q6IGh0bWwuQmxvY2tHcm91cCk6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGxldCBoYXNFbHNlID0gZmFsc2U7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3QuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYmxvY2sgPSBhc3QuYmxvY2tzW2ldO1xuXG4gICAgLy8gQ29uZGl0aW9uYWwgYmxvY2tzIG9ubHkgYWxsb3cgYGlmYCwgYGVsc2UgaWZgIGFuZCBgZWxzZWAgYmxvY2tzLlxuICAgIGlmICgoYmxvY2submFtZSAhPT0gJ2lmJyB8fCBpID4gMCkgJiYgYmxvY2submFtZSAhPT0gJ2Vsc2UnKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICBuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCBgVW5yZWNvZ25pemVkIGNvbmRpdGlvbmFsIGJsb2NrIFwiJHtibG9jay5uYW1lfVwiYCkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdpZicpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKGhhc0Vsc2UpIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0NvbmRpdGlvbmFsIGNhbiBvbmx5IGhhdmUgb25lIFwiZWxzZVwiIGJsb2NrJykpO1xuICAgICAgfSBlbHNlIGlmIChhc3QuYmxvY2tzLmxlbmd0aCA+IDEgJiYgaSA8IGFzdC5ibG9ja3MubGVuZ3RoIC0gMSkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdFbHNlIGJsb2NrIG11c3QgYmUgbGFzdCBpbnNpZGUgdGhlIGNvbmRpdGlvbmFsJykpO1xuICAgICAgfVxuICAgICAgaGFzRWxzZSA9IHRydWU7XG5cbiAgICAgIC8vIGBlbHNlIGlmYCBpcyBhbiBlZGdlIGNhc2UsIGJlY2F1c2UgaXQgaGFzIGEgc3BhY2UgYWZ0ZXIgdGhlIGJsb2NrIG5hbWVcbiAgICAgIC8vIHdoaWNoIG1lYW5zIHRoYXQgdGhlIGBpZmAgaXMgY2FwdHVyZWQgYXMgYSBwYXJ0IG9mIHRoZSBwYXJhbWV0ZXJzLlxuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCAmJiAhRUxTRV9JRl9QQVRURVJOLnRlc3QoYmxvY2sucGFyYW1ldGVyc1swXS5leHByZXNzaW9uKSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0Vsc2UgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXJyb3JzO1xufVxuXG4vKiogQ2hlY2tzIHRoYXQgdGhlIHNoYXBlIG9mIGEgYHN3aXRjaGAgYmxvY2sgaXMgdmFsaWQuIFJldHVybnMgYW4gYXJyYXkgb2YgZXJyb3JzLiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVTd2l0Y2hCbG9jayhhc3Q6IGh0bWwuQmxvY2tHcm91cCk6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IFtwcmltYXJ5QmxvY2ssIC4uLnNlY29uZGFyeUJsb2Nrc10gPSBhc3QuYmxvY2tzO1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBsZXQgaGFzRGVmYXVsdCA9IGZhbHNlO1xuXG4gIGlmIChwcmltYXJ5QmxvY2suY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICBwcmltYXJ5QmxvY2suc291cmNlU3BhbiwgJ1N3aXRjaCBibG9jayBjYW4gb25seSBjb250YWluIFwiY2FzZVwiIGFuZCBcImRlZmF1bHRcIiBibG9ja3MnKSk7XG4gIH1cblxuICBpZiAocHJpbWFyeUJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgZXJyb3JzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZUVycm9yKHByaW1hcnlCbG9jay5zb3VyY2VTcGFuLCAnU3dpdGNoIGJsb2NrIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbWV0ZXInKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGJsb2NrIG9mIHNlY29uZGFyeUJsb2Nrcykge1xuICAgIGlmIChibG9jay5uYW1lID09PSAnY2FzZScpIHtcbiAgICAgIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQ2FzZSBibG9jayBtdXN0IGhhdmUgZXhhY3RseSBvbmUgcGFyYW1ldGVyJykpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYmxvY2submFtZSA9PT0gJ2RlZmF1bHQnKSB7XG4gICAgICBpZiAoaGFzRGVmYXVsdCkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdTd2l0Y2ggYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJkZWZhdWx0XCIgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRGVmYXVsdCBibG9jayBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzJykpO1xuICAgICAgfVxuICAgICAgaGFzRGVmYXVsdCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIGJsb2NrLnNvdXJjZVNwYW4sICdTd2l0Y2ggYmxvY2sgY2FuIG9ubHkgY29udGFpbiBcImNhc2VcIiBhbmQgXCJkZWZhdWx0XCIgYmxvY2tzJykpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBlcnJvcnM7XG59XG5cbi8qKiBQYXJzZXMgYSBibG9jayBwYXJhbWV0ZXIgaW50byBhIGJpbmRpbmcgQVNULiAqL1xuZnVuY3Rpb24gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhcbiAgICBhc3Q6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIHN0YXJ0ID0gMCk6IEFTVFdpdGhTb3VyY2Uge1xuICByZXR1cm4gYmluZGluZ1BhcnNlci5wYXJzZUJpbmRpbmcoXG4gICAgICBhc3QuZXhwcmVzc2lvbi5zbGljZShzdGFydCksIGZhbHNlLCBhc3Quc291cmNlU3BhbiwgYXN0LnNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0ICsgc3RhcnQpO1xufVxuXG4vKiogUGFyc2VzIHRoZSBwYXJhbWV0ZXIgb2YgYSBjb25kaXRpb25hbCBibG9jayAoYGlmYCBvciBgZWxzZSBpZmApLiAqL1xuZnVuY3Rpb24gcGFyc2VDb25kaXRpb25hbEJsb2NrUGFyYW1ldGVycyhcbiAgICBibG9jazogaHRtbC5CbG9jaywgZXJyb3JzOiBQYXJzZUVycm9yW10sIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4gICAgcHJpbWFyeUV4cHJlc3Npb25TdGFydDogbnVtYmVyKSB7XG4gIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBibG9jayBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID1cbiAgICAgIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoYmxvY2sucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlciwgcHJpbWFyeUV4cHJlc3Npb25TdGFydCk7XG4gIGxldCBleHByZXNzaW9uQWxpYXM6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICAvLyBTdGFydCBmcm9tIDEgc2luY2Ugd2UgcHJvY2Vzc2VkIHRoZSBmaXJzdCBwYXJhbWV0ZXIgYWxyZWFkeS5cbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBibG9jay5wYXJhbWV0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcGFyYW0gPSBibG9jay5wYXJhbWV0ZXJzW2ldO1xuICAgIGNvbnN0IGFsaWFzTWF0Y2ggPSBwYXJhbS5leHByZXNzaW9uLm1hdGNoKENPTkRJVElPTkFMX0FMSUFTX1BBVFRFUk4pO1xuXG4gICAgLy8gRm9yIG5vdyBjb25kaXRpb25hbHMgY2FuIG9ubHkgaGF2ZSBhbiBgYXNgIHBhcmFtZXRlci5cbiAgICAvLyBXZSBtYXkgd2FudCB0byByZXdvcmsgdGhpcyBsYXRlciBpZiB3ZSBhZGQgbW9yZS5cbiAgICBpZiAoYWxpYXNNYXRjaCA9PT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgcGFyYW0uc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBjb25kaXRpb25hbCBwYXJhbWF0ZXIgXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKSk7XG4gICAgfSBlbHNlIGlmIChleHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBjYW4gb25seSBoYXZlIG9uZSBcImFzXCIgZXhwcmVzc2lvbicpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwcmVzc2lvbkFsaWFzID0gYWxpYXNNYXRjaFsxXS50cmltKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCBleHByZXNzaW9uQWxpYXN9O1xufVxuXG4vKiogU3RyaXBzIG9wdGlvbmFsIHBhcmVudGhlc2VzIGFyb3VuZCBmcm9tIGEgY29udHJvbCBmcm9tIGV4cHJlc3Npb24gcGFyYW1ldGVyLiAqL1xuZnVuY3Rpb24gc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKHBhcmFtOiBodG1sLkJsb2NrUGFyYW1ldGVyLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSk6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgZXhwcmVzc2lvbiA9IHBhcmFtLmV4cHJlc3Npb247XG4gIGNvbnN0IHNwYWNlUmVnZXggPSAvXlxccyQvO1xuICBsZXQgb3BlblBhcmVucyA9IDA7XG4gIGxldCBzdGFydCA9IDA7XG4gIGxldCBlbmQgPSBleHByZXNzaW9uLmxlbmd0aCAtIDE7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByZXNzaW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhciA9IGV4cHJlc3Npb25baV07XG5cbiAgICBpZiAoY2hhciA9PT0gJygnKSB7XG4gICAgICBzdGFydCA9IGkgKyAxO1xuICAgICAgb3BlblBhcmVucysrO1xuICAgIH0gZWxzZSBpZiAoc3BhY2VSZWdleC50ZXN0KGNoYXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wZW5QYXJlbnMgPT09IDApIHtcbiAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSBleHByZXNzaW9uLmxlbmd0aCAtIDE7IGkgPiAtMTsgaS0tKSB7XG4gICAgY29uc3QgY2hhciA9IGV4cHJlc3Npb25baV07XG5cbiAgICBpZiAoY2hhciA9PT0gJyknKSB7XG4gICAgICBlbmQgPSBpO1xuICAgICAgb3BlblBhcmVucy0tO1xuICAgICAgaWYgKG9wZW5QYXJlbnMgPT09IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzcGFjZVJlZ2V4LnRlc3QoY2hhcikpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAob3BlblBhcmVucyAhPT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdVbmNsb3NlZCBwYXJlbnRoZXNlcyBpbiBleHByZXNzaW9uJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIGV4cHJlc3Npb24uc2xpY2Uoc3RhcnQsIGVuZCk7XG59XG4iXX0=