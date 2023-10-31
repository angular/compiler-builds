/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from '../ml_parser/ast';
import { ParseError, ParseSourceSpan } from '../parse_util';
import * as t from './r3_ast';
/** Pattern for the expression in a for loop block. */
const FOR_LOOP_EXPRESSION_PATTERN = /^\s*([0-9A-Za-z_$]*)\s+of\s+([\S\s]*)/;
/** Pattern for the tracking expression in a for loop block. */
const FOR_LOOP_TRACK_PATTERN = /^track\s+([\S\s]*)/;
/** Pattern for the `as` expression in a conditional block. */
const CONDITIONAL_ALIAS_PATTERN = /^as\s+(.*)/;
/** Pattern used to identify an `else if` block. */
const ELSE_IF_PATTERN = /^else[^\S\r\n]+if/;
/** Pattern used to identify a `let` parameter. */
const FOR_LOOP_LET_PATTERN = /^let\s+([\S\s]*)/;
/** Names of variables that are allowed to be used in the `let` expression of a `for` loop. */
const ALLOWED_FOR_LOOP_LET_VARIABLES = new Set(['$index', '$first', '$last', '$even', '$odd', '$count']);
/**
 * Predicate function that determines if a block with
 * a specific name cam be connected to a `for` block.
 */
export function isConnectedForLoopBlock(name) {
    return name === 'empty';
}
/**
 * Predicate function that determines if a block with
 * a specific name cam be connected to an `if` block.
 */
export function isConnectedIfLoopBlock(name) {
    return name === 'else' || ELSE_IF_PATTERN.test(name);
}
/** Creates an `if` loop block from an HTML AST node. */
export function createIfBlock(ast, connectedBlocks, visitor, bindingParser) {
    const errors = validateIfConnectedBlocks(connectedBlocks);
    const branches = [];
    const mainBlockParams = parseConditionalBlockParameters(ast, errors, bindingParser);
    if (mainBlockParams !== null) {
        branches.push(new t.IfBlockBranch(mainBlockParams.expression, html.visitAll(visitor, ast.children, ast.children), mainBlockParams.expressionAlias, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.nameSpan));
    }
    for (const block of connectedBlocks) {
        if (ELSE_IF_PATTERN.test(block.name)) {
            const params = parseConditionalBlockParameters(block, errors, bindingParser);
            if (params !== null) {
                const children = html.visitAll(visitor, block.children, block.children);
                branches.push(new t.IfBlockBranch(params.expression, children, params.expressionAlias, block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan));
            }
        }
        else if (block.name === 'else') {
            const children = html.visitAll(visitor, block.children, block.children);
            branches.push(new t.IfBlockBranch(null, children, null, block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan));
        }
    }
    // The outer IfBlock should have a span that encapsulates all branches.
    const ifBlockStartSourceSpan = branches.length > 0 ? branches[0].startSourceSpan : ast.startSourceSpan;
    const ifBlockEndSourceSpan = branches.length > 0 ? branches[branches.length - 1].endSourceSpan : ast.endSourceSpan;
    let wholeSourceSpan = ast.sourceSpan;
    const lastBranch = branches[branches.length - 1];
    if (lastBranch !== undefined) {
        wholeSourceSpan = new ParseSourceSpan(ifBlockStartSourceSpan.start, lastBranch.sourceSpan.end);
    }
    return {
        node: new t.IfBlock(branches, wholeSourceSpan, ast.startSourceSpan, ifBlockEndSourceSpan, ast.nameSpan),
        errors,
    };
}
/** Creates a `for` loop block from an HTML AST node. */
export function createForLoop(ast, connectedBlocks, visitor, bindingParser) {
    const errors = [];
    const params = parseForLoopParameters(ast, errors, bindingParser);
    let node = null;
    let empty = null;
    for (const block of connectedBlocks) {
        if (block.name === 'empty') {
            if (empty !== null) {
                errors.push(new ParseError(block.sourceSpan, '@for loop can only have one @empty block'));
            }
            else if (block.parameters.length > 0) {
                errors.push(new ParseError(block.sourceSpan, '@empty block cannot have parameters'));
            }
            else {
                empty = new t.ForLoopBlockEmpty(html.visitAll(visitor, block.children, block.children), block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan);
            }
        }
        else {
            errors.push(new ParseError(block.sourceSpan, `Unrecognized @for loop block "${block.name}"`));
        }
    }
    if (params !== null) {
        if (params.trackBy === null) {
            // TODO: We should not fail here, and instead try to produce some AST for the language
            // service.
            errors.push(new ParseError(ast.sourceSpan, '@for loop must have a "track" expression'));
        }
        else {
            // The `for` block has a main span that includes the `empty` branch. For only the span of the
            // main `for` body, use `mainSourceSpan`.
            const endSpan = empty?.endSourceSpan ?? ast.endSourceSpan;
            const sourceSpan = new ParseSourceSpan(ast.sourceSpan.start, endSpan?.end ?? ast.sourceSpan.end);
            node = new t.ForLoopBlock(params.itemName, params.expression, params.trackBy.expression, params.trackBy.keywordSpan, params.context, html.visitAll(visitor, ast.children, ast.children), empty, sourceSpan, ast.sourceSpan, ast.startSourceSpan, endSpan, ast.nameSpan);
        }
    }
    return { node, errors };
}
/** Creates a switch block from an HTML AST node. */
export function createSwitchBlock(ast, visitor, bindingParser) {
    const errors = validateSwitchBlock(ast);
    const primaryExpression = ast.parameters.length > 0 ?
        parseBlockParameterToBinding(ast.parameters[0], bindingParser) :
        bindingParser.parseBinding('', false, ast.sourceSpan, 0);
    const cases = [];
    const unknownBlocks = [];
    let defaultCase = null;
    // Here we assume that all the blocks are valid given that we validated them above.
    for (const node of ast.children) {
        if (!(node instanceof html.Block)) {
            continue;
        }
        if ((node.name !== 'case' || node.parameters.length === 0) && node.name !== 'default') {
            unknownBlocks.push(new t.UnknownBlock(node.name, node.sourceSpan, node.nameSpan));
            continue;
        }
        const expression = node.name === 'case' ?
            parseBlockParameterToBinding(node.parameters[0], bindingParser) :
            null;
        const ast = new t.SwitchBlockCase(expression, html.visitAll(visitor, node.children, node.children), node.sourceSpan, node.startSourceSpan, node.endSourceSpan, node.nameSpan);
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
        node: new t.SwitchBlock(primaryExpression, cases, unknownBlocks, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.nameSpan),
        errors
    };
}
/** Parses the parameters of a `for` loop block. */
function parseForLoopParameters(block, errors, bindingParser) {
    if (block.parameters.length === 0) {
        errors.push(new ParseError(block.sourceSpan, '@for loop does not have an expression'));
        return null;
    }
    const [expressionParam, ...secondaryParams] = block.parameters;
    const match = stripOptionalParentheses(expressionParam, errors)?.match(FOR_LOOP_EXPRESSION_PATTERN);
    if (!match || match[2].trim().length === 0) {
        errors.push(new ParseError(expressionParam.sourceSpan, 'Cannot parse expression. @for loop expression must match the pattern "<identifier> of <expression>"'));
        return null;
    }
    const [, itemName, rawExpression] = match;
    const result = {
        itemName: new t.Variable(itemName, '$implicit', expressionParam.sourceSpan, expressionParam.sourceSpan),
        trackBy: null,
        expression: parseBlockParameterToBinding(expressionParam, bindingParser, rawExpression),
        context: {},
    };
    for (const param of secondaryParams) {
        const letMatch = param.expression.match(FOR_LOOP_LET_PATTERN);
        if (letMatch !== null) {
            parseLetParameter(param.sourceSpan, letMatch[1], param.sourceSpan, result.context, errors);
            continue;
        }
        const trackMatch = param.expression.match(FOR_LOOP_TRACK_PATTERN);
        if (trackMatch !== null) {
            if (result.trackBy !== null) {
                errors.push(new ParseError(param.sourceSpan, '@for loop can only have one "track" expression'));
            }
            else {
                const expression = parseBlockParameterToBinding(param, bindingParser, trackMatch[1]);
                const keywordSpan = new ParseSourceSpan(param.sourceSpan.start, param.sourceSpan.start.moveBy('track'.length));
                result.trackBy = { expression, keywordSpan };
            }
            continue;
        }
        errors.push(new ParseError(param.sourceSpan, `Unrecognized @for loop paramater "${param.expression}"`));
    }
    // Fill out any variables that haven't been defined explicitly.
    for (const variableName of ALLOWED_FOR_LOOP_LET_VARIABLES) {
        if (!result.context.hasOwnProperty(variableName)) {
            // Give ambiently-available context variables empty spans at the end of the start of the `for`
            // block, since they are not explicitly defined.
            const emptySpanAfterForBlockStart = new ParseSourceSpan(block.startSourceSpan.end, block.startSourceSpan.end);
            result.context[variableName] = new t.Variable(variableName, variableName, emptySpanAfterForBlockStart, emptySpanAfterForBlockStart);
        }
    }
    return result;
}
/** Parses the `let` parameter of a `for` loop block. */
function parseLetParameter(sourceSpan, expression, span, context, errors) {
    const parts = expression.split(',');
    for (const part of parts) {
        const expressionParts = part.split('=');
        const name = expressionParts.length === 2 ? expressionParts[0].trim() : '';
        const variableName = (expressionParts.length === 2 ? expressionParts[1].trim() : '');
        if (name.length === 0 || variableName.length === 0) {
            errors.push(new ParseError(sourceSpan, `Invalid @for loop "let" parameter. Parameter should match the pattern "<name> = <variable name>"`));
        }
        else if (!ALLOWED_FOR_LOOP_LET_VARIABLES.has(variableName)) {
            errors.push(new ParseError(sourceSpan, `Unknown "let" parameter variable "${variableName}". The allowed variables are: ${Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES).join(', ')}`));
        }
        else if (context.hasOwnProperty(variableName)) {
            errors.push(new ParseError(sourceSpan, `Duplicate "let" parameter variable "${variableName}"`));
        }
        else {
            context[variableName] = new t.Variable(name, variableName, span, span);
        }
    }
}
/**
 * Checks that the shape of the blocks connected to an
 * `@if` block is correct. Returns an array of errors.
 */
function validateIfConnectedBlocks(connectedBlocks) {
    const errors = [];
    let hasElse = false;
    for (let i = 0; i < connectedBlocks.length; i++) {
        const block = connectedBlocks[i];
        if (block.name === 'else') {
            if (hasElse) {
                errors.push(new ParseError(block.sourceSpan, 'Conditional can only have one @else block'));
            }
            else if (connectedBlocks.length > 1 && i < connectedBlocks.length - 1) {
                errors.push(new ParseError(block.sourceSpan, '@else block must be last inside the conditional'));
            }
            else if (block.parameters.length > 0) {
                errors.push(new ParseError(block.sourceSpan, '@else block cannot have parameters'));
            }
            hasElse = true;
        }
        else if (!ELSE_IF_PATTERN.test(block.name)) {
            errors.push(new ParseError(block.sourceSpan, `Unrecognized conditional block @${block.name}`));
        }
    }
    return errors;
}
/** Checks that the shape of a `switch` block is valid. Returns an array of errors. */
function validateSwitchBlock(ast) {
    const errors = [];
    let hasDefault = false;
    if (ast.parameters.length !== 1) {
        errors.push(new ParseError(ast.sourceSpan, '@switch block must have exactly one parameter'));
        return errors;
    }
    for (const node of ast.children) {
        // Skip over comments and empty text nodes inside the switch block.
        // Empty text nodes can be used for formatting while comments don't affect the runtime.
        if (node instanceof html.Comment ||
            (node instanceof html.Text && node.value.trim().length === 0)) {
            continue;
        }
        if (!(node instanceof html.Block) || (node.name !== 'case' && node.name !== 'default')) {
            errors.push(new ParseError(node.sourceSpan, '@switch block can only contain @case and @default blocks'));
            continue;
        }
        if (node.name === 'default') {
            if (hasDefault) {
                errors.push(new ParseError(node.sourceSpan, '@switch block can only have one @default block'));
            }
            else if (node.parameters.length > 0) {
                errors.push(new ParseError(node.sourceSpan, '@default block cannot have parameters'));
            }
            hasDefault = true;
        }
        else if (node.name === 'case' && node.parameters.length !== 1) {
            errors.push(new ParseError(node.sourceSpan, '@case block must have exactly one parameter'));
        }
    }
    return errors;
}
/**
 * Parses a block parameter into a binding AST.
 * @param ast Block parameter that should be parsed.
 * @param bindingParser Parser that the expression should be parsed with.
 * @param part Specific part of the expression that should be parsed.
 */
function parseBlockParameterToBinding(ast, bindingParser, part) {
    let start;
    let end;
    if (typeof part === 'string') {
        // Note: `lastIndexOf` here should be enough to know the start index of the expression,
        // because we know that it'll be at the end of the param. Ideally we could use the `d`
        // flag when matching via regex and get the index from `match.indices`, but it's unclear
        // if we can use it yet since it's a relatively new feature. See:
        // https://github.com/tc39/proposal-regexp-match-indices
        start = Math.max(0, ast.expression.lastIndexOf(part));
        end = start + part.length;
    }
    else {
        start = 0;
        end = ast.expression.length;
    }
    return bindingParser.parseBinding(ast.expression.slice(start, end), false, ast.sourceSpan, ast.sourceSpan.start.offset + start);
}
/** Parses the parameter of a conditional block (`if` or `else if`). */
function parseConditionalBlockParameters(block, errors, bindingParser) {
    if (block.parameters.length === 0) {
        errors.push(new ParseError(block.sourceSpan, 'Conditional block does not have an expression'));
        return null;
    }
    const expression = parseBlockParameterToBinding(block.parameters[0], bindingParser);
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
        else if (block.name !== 'if') {
            errors.push(new ParseError(param.sourceSpan, '"as" expression is only allowed on the primary @if block'));
        }
        else if (expressionAlias !== null) {
            errors.push(new ParseError(param.sourceSpan, 'Conditional can only have one "as" expression'));
        }
        else {
            const name = aliasMatch[1].trim();
            expressionAlias = new t.Variable(name, name, param.sourceSpan, param.sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFHMUQsT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVLENBQUM7QUFFOUIsc0RBQXNEO0FBQ3RELE1BQU0sMkJBQTJCLEdBQUcsdUNBQXVDLENBQUM7QUFFNUUsK0RBQStEO0FBQy9ELE1BQU0sc0JBQXNCLEdBQUcsb0JBQW9CLENBQUM7QUFFcEQsOERBQThEO0FBQzlELE1BQU0seUJBQXlCLEdBQUcsWUFBWSxDQUFDO0FBRS9DLG1EQUFtRDtBQUNuRCxNQUFNLGVBQWUsR0FBRyxtQkFBbUIsQ0FBQztBQUU1QyxrREFBa0Q7QUFDbEQsTUFBTSxvQkFBb0IsR0FBRyxrQkFBa0IsQ0FBQztBQUVoRCw4RkFBOEY7QUFDOUYsTUFBTSw4QkFBOEIsR0FDaEMsSUFBSSxHQUFHLENBQThCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBRW5HOzs7R0FHRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxJQUFZO0lBQ2xELE9BQU8sSUFBSSxLQUFLLE9BQU8sQ0FBQztBQUMxQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLElBQVk7SUFDakQsT0FBTyxJQUFJLEtBQUssTUFBTSxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkQsQ0FBQztBQUVELHdEQUF3RDtBQUN4RCxNQUFNLFVB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TUFBTTtTQUNQO0tBQ0Y7SUFFRCxJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUU7UUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLG9DQUFvQyxDQUFDLENBQUMsQ0FBQztRQUNwRixPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN0QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNUV2l0aFNvdXJjZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5cbmltcG9ydCAqIGFzIHQgZnJvbSAnLi9yM19hc3QnO1xuXG4vKiogUGF0dGVybiBmb3IgdGhlIGV4cHJlc3Npb24gaW4gYSBmb3IgbG9vcCBibG9jay4gKi9cbmNvbnN0IEZPUl9MT09QX0VYUFJFU1NJT05fUEFUVEVSTiA9IC9eXFxzKihbMC05QS1aYS16XyRdKilcXHMrb2ZcXHMrKFtcXFNcXHNdKikvO1xuXG4vKiogUGF0dGVybiBmb3IgdGhlIHRyYWNraW5nIGV4cHJlc3Npb24gaW4gYSBmb3IgbG9vcCBibG9jay4gKi9cbmNvbnN0IEZPUl9MT09QX1RSQUNLX1BBVFRFUk4gPSAvXnRyYWNrXFxzKyhbXFxTXFxzXSopLztcblxuLyoqIFBhdHRlcm4gZm9yIHRoZSBgYXNgIGV4cHJlc3Npb24gaW4gYSBjb25kaXRpb25hbCBibG9jay4gKi9cbmNvbnN0IENPTkRJVElPTkFMX0FMSUFTX1BBVFRFUk4gPSAvXmFzXFxzKyguKikvO1xuXG4vKiogUGF0dGVybiB1c2VkIHRvIGlkZW50aWZ5IGFuIGBlbHNlIGlmYCBibG9jay4gKi9cbmNvbnN0IEVMU0VfSUZfUEFUVEVSTiA9IC9eZWxzZVteXFxTXFxyXFxuXStpZi87XG5cbi8qKiBQYXR0ZXJuIHVzZWQgdG8gaWRlbnRpZnkgYSBgbGV0YCBwYXJhbWV0ZXIuICovXG5jb25zdCBGT1JfTE9PUF9MRVRfUEFUVEVSTiA9IC9ebGV0XFxzKyhbXFxTXFxzXSopLztcblxuLyoqIE5hbWVzIG9mIHZhcmlhYmxlcyB0aGF0IGFyZSBhbGxvd2VkIHRvIGJlIHVzZWQgaW4gdGhlIGBsZXRgIGV4cHJlc3Npb24gb2YgYSBgZm9yYCBsb29wLiAqL1xuY29uc3QgQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTID1cbiAgICBuZXcgU2V0PGtleW9mIHQuRm9yTG9vcEJsb2NrQ29udGV4dD4oWyckaW5kZXgnLCAnJGZpcnN0JywgJyRsYXN0JywgJyRldmVuJywgJyRvZGQnLCAnJGNvdW50J10pO1xuXG4vKipcbiAqIFByZWRpY2F0ZSBmdW5jdGlvbiB0aGF0IGRldGVybWluZXMgaWYgYSBibG9jayB3aXRoXG4gKiBhIHNwZWNpZmljIG5hbWUgY2FtIGJlIGNvbm5lY3RlZCB0byBhIGBmb3JgIGJsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNDb25uZWN0ZWRGb3JMb29wQmxvY2sobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lID09PSAnZW1wdHknO1xufVxuXG4vKipcbiAqIFByZWRpY2F0ZSBmdW5jdGlvbiB0aGF0IGRldGVybWluZXMgaWYgYSBibG9jayB3aXRoXG4gKiBhIHNwZWNpZmljIG5hbWUgY2FtIGJlIGNvbm5lY3RlZCB0byBhbiBgaWZgIGJsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNDb25uZWN0ZWRJZkxvb3BCbG9jayhuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5hbWUgPT09ICdlbHNlJyB8fCBFTFNFX0lGX1BBVFRFUk4udGVzdChuYW1lKTtcbn1cblxuLyoqIENyZWF0ZXMgYW4gYGlmYCBsb29wIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJZkJsb2NrKFxuICAgIGFzdDogaHRtbC5CbG9jaywgY29ubmVjdGVkQmxvY2tzOiBodG1sLkJsb2NrW10sIHZpc2l0b3I6IGh0bWwuVmlzaXRvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge25vZGU6IHQuSWZCbG9ja3xudWxsLCBlcnJvcnM6IFBhcnNlRXJyb3JbXX0ge1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IHZhbGlkYXRlSWZDb25uZWN0ZWRCbG9ja3MoY29ubmVjdGVkQmxvY2tzKTtcbiAgY29uc3QgYnJhbmNoZXM6IHQuSWZCbG9ja0JyYW5jaFtdID0gW107XG4gIGNvbnN0IG1haW5CbG9ja1BhcmFtcyA9IHBhcnNlQ29uZGl0aW9uYWxCbG9ja1BhcmFtZXRlcnMoYXN0LCBlcnJvcnMsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIGlmIChtYWluQmxvY2tQYXJhbXMgIT09IG51bGwpIHtcbiAgICBicmFuY2hlcy5wdXNoKG5ldyB0LklmQmxvY2tCcmFuY2goXG4gICAgICAgIG1haW5CbG9ja1BhcmFtcy5leHByZXNzaW9uLCBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSxcbiAgICAgICAgbWFpbkJsb2NrUGFyYW1zLmV4cHJlc3Npb25BbGlhcywgYXN0LnNvdXJjZVNwYW4sIGFzdC5zdGFydFNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuLFxuICAgICAgICBhc3QubmFtZVNwYW4pKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYmxvY2sgb2YgY29ubmVjdGVkQmxvY2tzKSB7XG4gICAgaWYgKEVMU0VfSUZfUEFUVEVSTi50ZXN0KGJsb2NrLm5hbWUpKSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKGJsb2NrLCBlcnJvcnMsIGJpbmRpbmdQYXJzZXIpO1xuXG4gICAgICBpZiAocGFyYW1zICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiwgYmxvY2suY2hpbGRyZW4pO1xuICAgICAgICBicmFuY2hlcy5wdXNoKG5ldyB0LklmQmxvY2tCcmFuY2goXG4gICAgICAgICAgICBwYXJhbXMuZXhwcmVzc2lvbiwgY2hpbGRyZW4sIHBhcmFtcy5leHByZXNzaW9uQWxpYXMsIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sIGJsb2NrLmVuZFNvdXJjZVNwYW4sIGJsb2NrLm5hbWVTcGFuKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChibG9jay5uYW1lID09PSAnZWxzZScpIHtcbiAgICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiwgYmxvY2suY2hpbGRyZW4pO1xuICAgICAgYnJhbmNoZXMucHVzaChuZXcgdC5JZkJsb2NrQnJhbmNoKFxuICAgICAgICAgIG51bGwsIGNoaWxkcmVuLCBudWxsLCBibG9jay5zb3VyY2VTcGFuLCBibG9jay5zdGFydFNvdXJjZVNwYW4sIGJsb2NrLmVuZFNvdXJjZVNwYW4sXG4gICAgICAgICAgYmxvY2submFtZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICAvLyBUaGUgb3V0ZXIgSWZCbG9jayBzaG91bGQgaGF2ZSBhIHNwYW4gdGhhdCBlbmNhcHN1bGF0ZXMgYWxsIGJyYW5jaGVzLlxuICBjb25zdCBpZkJsb2NrU3RhcnRTb3VyY2VTcGFuID1cbiAgICAgIGJyYW5jaGVzLmxlbmd0aCA+IDAgPyBicmFuY2hlc1swXS5zdGFydFNvdXJjZVNwYW4gOiBhc3Quc3RhcnRTb3VyY2VTcGFuO1xuICBjb25zdCBpZkJsb2NrRW5kU291cmNlU3BhbiA9XG4gICAgICBicmFuY2hlcy5sZW5ndGggPiAwID8gYnJhbmNoZXNbYnJhbmNoZXMubGVuZ3RoIC0gMV0uZW5kU291cmNlU3BhbiA6IGFzdC5lbmRTb3VyY2VTcGFuO1xuXG4gIGxldCB3aG9sZVNvdXJjZVNwYW4gPSBhc3Quc291cmNlU3BhbjtcbiAgY29uc3QgbGFzdEJyYW5jaCA9IGJyYW5jaGVzW2JyYW5jaGVzLmxlbmd0aCAtIDFdO1xuICBpZiAobGFzdEJyYW5jaCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgd2hvbGVTb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihpZkJsb2NrU3RhcnRTb3VyY2VTcGFuLnN0YXJ0LCBsYXN0QnJhbmNoLnNvdXJjZVNwYW4uZW5kKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbm9kZTogbmV3IHQuSWZCbG9jayhcbiAgICAgICAgYnJhbmNoZXMsIHdob2xlU291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgaWZCbG9ja0VuZFNvdXJjZVNwYW4sIGFzdC5uYW1lU3BhbiksXG4gICAgZXJyb3JzLFxuICB9O1xufVxuXG4vKiogQ3JlYXRlcyBhIGBmb3JgIGxvb3AgYmxvY2sgZnJvbSBhbiBIVE1MIEFTVCBub2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZvckxvb3AoXG4gICAgYXN0OiBodG1sLkJsb2NrLCBjb25uZWN0ZWRCbG9ja3M6IGh0bWwuQmxvY2tbXSwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5Gb3JMb29wQmxvY2t8bnVsbCwgZXJyb3JzOiBQYXJzZUVycm9yW119IHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgY29uc3QgcGFyYW1zID0gcGFyc2VGb3JMb29wUGFyYW1ldGVycyhhc3QsIGVycm9ycywgYmluZGluZ1BhcnNlcik7XG4gIGxldCBub2RlOiB0LkZvckxvb3BCbG9ja3xudWxsID0gbnVsbDtcbiAgbGV0IGVtcHR5OiB0LkZvckxvb3BCbG9ja0VtcHR5fG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgYmxvY2sgb2YgY29ubmVjdGVkQmxvY2tzKSB7XG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdlbXB0eScpIHtcbiAgICAgIGlmIChlbXB0eSAhPT0gbnVsbCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQGZvciBsb29wIGNhbiBvbmx5IGhhdmUgb25lIEBlbXB0eSBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdAZW1wdHkgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVtcHR5ID0gbmV3IHQuRm9yTG9vcEJsb2NrRW1wdHkoXG4gICAgICAgICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuLCBibG9jay5jaGlsZHJlbiksIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sIGJsb2NrLmVuZFNvdXJjZVNwYW4sIGJsb2NrLm5hbWVTcGFuKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBAZm9yIGxvb3AgYmxvY2sgXCIke2Jsb2NrLm5hbWV9XCJgKSk7XG4gICAgfVxuICB9XG5cblxuICBpZiAocGFyYW1zICE9PSBudWxsKSB7XG4gICAgaWYgKHBhcmFtcy50cmFja0J5ID09PSBudWxsKSB7XG4gICAgICAvLyBUT0RPOiBXZSBzaG91bGQgbm90IGZhaWwgaGVyZSwgYW5kIGluc3RlYWQgdHJ5IHRvIHByb2R1Y2Ugc29tZSBBU1QgZm9yIHRoZSBsYW5ndWFnZVxuICAgICAgLy8gc2VydmljZS5cbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGFzdC5zb3VyY2VTcGFuLCAnQGZvciBsb29wIG11c3QgaGF2ZSBhIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgYGZvcmAgYmxvY2sgaGFzIGEgbWFpbiBzcGFuIHRoYXQgaW5jbHVkZXMgdGhlIGBlbXB0eWAgYnJhbmNoLiBGb3Igb25seSB0aGUgc3BhbiBvZiB0aGVcbiAgICAgIC8vIG1haW4gYGZvcmAgYm9keSwgdXNlIGBtYWluU291cmNlU3BhbmAuXG4gICAgICBjb25zdCBlbmRTcGFuID0gZW1wdHk/LmVuZFNvdXJjZVNwYW4gPz8gYXN0LmVuZFNvdXJjZVNwYW47XG4gICAgICBjb25zdCBzb3VyY2VTcGFuID1cbiAgICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKGFzdC5zb3VyY2VTcGFuLnN0YXJ0LCBlbmRTcGFuPy5lbmQgPz8gYXN0LnNvdXJjZVNwYW4uZW5kKTtcbiAgICAgIG5vZGUgPSBuZXcgdC5Gb3JMb29wQmxvY2soXG4gICAgICAgICAgcGFyYW1zLml0ZW1OYW1lLCBwYXJhbXMuZXhwcmVzc2lvbiwgcGFyYW1zLnRyYWNrQnkuZXhwcmVzc2lvbiwgcGFyYW1zLnRyYWNrQnkua2V5d29yZFNwYW4sXG4gICAgICAgICAgcGFyYW1zLmNvbnRleHQsIGh0bWwudmlzaXRBbGwodmlzaXRvciwgYXN0LmNoaWxkcmVuLCBhc3QuY2hpbGRyZW4pLCBlbXB0eSwgc291cmNlU3BhbixcbiAgICAgICAgICBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgZW5kU3BhbiwgYXN0Lm5hbWVTcGFuKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge25vZGUsIGVycm9yc307XG59XG5cbi8qKiBDcmVhdGVzIGEgc3dpdGNoIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTd2l0Y2hCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2ssIHZpc2l0b3I6IGh0bWwuVmlzaXRvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge25vZGU6IHQuU3dpdGNoQmxvY2t8bnVsbCwgZXJyb3JzOiBQYXJzZUVycm9yW119IHtcbiAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGVTd2l0Y2hCbG9jayhhc3QpO1xuICBjb25zdCBwcmltYXJ5RXhwcmVzc2lvbiA9IGFzdC5wYXJhbWV0ZXJzLmxlbmd0aCA+IDAgP1xuICAgICAgcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhhc3QucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcikgOlxuICAgICAgYmluZGluZ1BhcnNlci5wYXJzZUJpbmRpbmcoJycsIGZhbHNlLCBhc3Quc291cmNlU3BhbiwgMCk7XG4gIGNvbnN0IGNhc2VzOiB0LlN3aXRjaEJsb2NrQ2FzZVtdID0gW107XG4gIGNvbnN0IHVua25vd25CbG9ja3M6IHQuVW5rbm93bkJsb2NrW10gPSBbXTtcbiAgbGV0IGRlZmF1bHRDYXNlOiB0LlN3aXRjaEJsb2NrQ2FzZXxudWxsID0gbnVsbDtcblxuICAvLyBIZXJlIHdlIGFzc3VtZSB0aGF0IGFsbCB0aGUgYmxvY2tzIGFyZSB2YWxpZCBnaXZlbiB0aGF0IHdlIHZhbGlkYXRlZCB0aGVtIGFib3ZlLlxuICBmb3IgKGNvbnN0IG5vZGUgb2YgYXN0LmNoaWxkcmVuKSB7XG4gICAgaWYgKCEobm9kZSBpbnN0YW5jZW9mIGh0bWwuQmxvY2spKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoKG5vZGUubmFtZSAhPT0gJ2Nhc2UnIHx8IG5vZGUucGFyYW1ldGVycy5sZW5ndGggPT09IDApICYmIG5vZGUubmFtZSAhPT0gJ2RlZmF1bHQnKSB7XG4gICAgICB1bmtub3duQmxvY2tzLnB1c2gobmV3IHQuVW5rbm93bkJsb2NrKG5vZGUubmFtZSwgbm9kZS5zb3VyY2VTcGFuLCBub2RlLm5hbWVTcGFuKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBleHByZXNzaW9uID0gbm9kZS5uYW1lID09PSAnY2FzZScgP1xuICAgICAgICBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKG5vZGUucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcikgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IGFzdCA9IG5ldyB0LlN3aXRjaEJsb2NrQ2FzZShcbiAgICAgICAgZXhwcmVzc2lvbiwgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBub2RlLmNoaWxkcmVuLCBub2RlLmNoaWxkcmVuKSwgbm9kZS5zb3VyY2VTcGFuLFxuICAgICAgICBub2RlLnN0YXJ0U291cmNlU3Bhbiwgbm9kZS5lbmRTb3VyY2VTcGFuLCBub2RlLm5hbWVTcGFuKTtcblxuICAgIGlmIChleHByZXNzaW9uID09PSBudWxsKSB7XG4gICAgICBkZWZhdWx0Q2FzZSA9IGFzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FzZXMucHVzaChhc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEVuc3VyZSB0aGF0IHRoZSBkZWZhdWx0IGNhc2UgaXMgbGFzdCBpbiB0aGUgYXJyYXkuXG4gIGlmIChkZWZhdWx0Q2FzZSAhPT0gbnVsbCkge1xuICAgIGNhc2VzLnB1c2goZGVmYXVsdENhc2UpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBub2RlOiBuZXcgdC5Td2l0Y2hCbG9jayhcbiAgICAgICAgcHJpbWFyeUV4cHJlc3Npb24sIGNhc2VzLCB1bmtub3duQmxvY2tzLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgYXN0LmVuZFNvdXJjZVNwYW4sIGFzdC5uYW1lU3BhbiksXG4gICAgZXJyb3JzXG4gIH07XG59XG5cbi8qKiBQYXJzZXMgdGhlIHBhcmFtZXRlcnMgb2YgYSBgZm9yYCBsb29wIGJsb2NrLiAqL1xuZnVuY3Rpb24gcGFyc2VGb3JMb29wUGFyYW1ldGVycyhcbiAgICBibG9jazogaHRtbC5CbG9jaywgZXJyb3JzOiBQYXJzZUVycm9yW10sIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpIHtcbiAgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0Bmb3IgbG9vcCBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBbZXhwcmVzc2lvblBhcmFtLCAuLi5zZWNvbmRhcnlQYXJhbXNdID0gYmxvY2sucGFyYW1ldGVycztcbiAgY29uc3QgbWF0Y2ggPVxuICAgICAgc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKGV4cHJlc3Npb25QYXJhbSwgZXJyb3JzKT8ubWF0Y2goRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOKTtcblxuICBpZiAoIW1hdGNoIHx8IG1hdGNoWzJdLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4sXG4gICAgICAgICdDYW5ub3QgcGFyc2UgZXhwcmVzc2lvbi4gQGZvciBsb29wIGV4cHJlc3Npb24gbXVzdCBtYXRjaCB0aGUgcGF0dGVybiBcIjxpZGVudGlmaWVyPiBvZiA8ZXhwcmVzc2lvbj5cIicpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IFssIGl0ZW1OYW1lLCByYXdFeHByZXNzaW9uXSA9IG1hdGNoO1xuICBjb25zdCByZXN1bHQgPSB7XG4gICAgaXRlbU5hbWU6IG5ldyB0LlZhcmlhYmxlKFxuICAgICAgICBpdGVtTmFtZSwgJyRpbXBsaWNpdCcsIGV4cHJlc3Npb25QYXJhbS5zb3VyY2VTcGFuLCBleHByZXNzaW9uUGFyYW0uc291cmNlU3BhbiksXG4gICAgdHJhY2tCeTogbnVsbCBhcyB7ZXhwcmVzc2lvbjogQVNUV2l0aFNvdXJjZSwga2V5d29yZFNwYW46IFBhcnNlU291cmNlU3Bhbn0gfCBudWxsLFxuICAgIGV4cHJlc3Npb246IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoZXhwcmVzc2lvblBhcmFtLCBiaW5kaW5nUGFyc2VyLCByYXdFeHByZXNzaW9uKSxcbiAgICBjb250ZXh0OiB7fSBhcyB0LkZvckxvb3BCbG9ja0NvbnRleHQsXG4gIH07XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBzZWNvbmRhcnlQYXJhbXMpIHtcbiAgICBjb25zdCBsZXRNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goRk9SX0xPT1BfTEVUX1BBVFRFUk4pO1xuXG4gICAgaWYgKGxldE1hdGNoICE9PSBudWxsKSB7XG4gICAgICBwYXJzZUxldFBhcmFtZXRlcihwYXJhbS5zb3VyY2VTcGFuLCBsZXRNYXRjaFsxXSwgcGFyYW0uc291cmNlU3BhbiwgcmVzdWx0LmNvbnRleHQsIGVycm9ycyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0cmFja01hdGNoID0gcGFyYW0uZXhwcmVzc2lvbi5tYXRjaChGT1JfTE9PUF9UUkFDS19QQVRURVJOKTtcblxuICAgIGlmICh0cmFja01hdGNoICE9PSBudWxsKSB7XG4gICAgICBpZiAocmVzdWx0LnRyYWNrQnkgIT09IG51bGwpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnQGZvciBsb29wIGNhbiBvbmx5IGhhdmUgb25lIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcocGFyYW0sIGJpbmRpbmdQYXJzZXIsIHRyYWNrTWF0Y2hbMV0pO1xuICAgICAgICBjb25zdCBrZXl3b3JkU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgICAgICBwYXJhbS5zb3VyY2VTcGFuLnN0YXJ0LCBwYXJhbS5zb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeSgndHJhY2snLmxlbmd0aCkpO1xuICAgICAgICByZXN1bHQudHJhY2tCeSA9IHtleHByZXNzaW9uLCBrZXl3b3JkU3Bhbn07XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBlcnJvcnMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBAZm9yIGxvb3AgcGFyYW1hdGVyIFwiJHtwYXJhbS5leHByZXNzaW9ufVwiYCkpO1xuICB9XG5cbiAgLy8gRmlsbCBvdXQgYW55IHZhcmlhYmxlcyB0aGF0IGhhdmVuJ3QgYmVlbiBkZWZpbmVkIGV4cGxpY2l0bHkuXG4gIGZvciAoY29uc3QgdmFyaWFibGVOYW1lIG9mIEFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUykge1xuICAgIGlmICghcmVzdWx0LmNvbnRleHQuaGFzT3duUHJvcGVydHkodmFyaWFibGVOYW1lKSkge1xuICAgICAgLy8gR2l2ZSBhbWJpZW50bHktYXZhaWxhYmxlIGNvbnRleHQgdmFyaWFibGVzIGVtcHR5IHNwYW5zIGF0IHRoZSBlbmQgb2YgdGhlIHN0YXJ0IG9mIHRoZSBgZm9yYFxuICAgICAgLy8gYmxvY2ssIHNpbmNlIHRoZXkgYXJlIG5vdCBleHBsaWNpdGx5IGRlZmluZWQuXG4gICAgICBjb25zdCBlbXB0eVNwYW5BZnRlckZvckJsb2NrU3RhcnQgPVxuICAgICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oYmxvY2suc3RhcnRTb3VyY2VTcGFuLmVuZCwgYmxvY2suc3RhcnRTb3VyY2VTcGFuLmVuZCk7XG4gICAgICByZXN1bHQuY29udGV4dFt2YXJpYWJsZU5hbWVdID0gbmV3IHQuVmFyaWFibGUoXG4gICAgICAgICAgdmFyaWFibGVOYW1lLCB2YXJpYWJsZU5hbWUsIGVtcHR5U3BhbkFmdGVyRm9yQmxvY2tTdGFydCwgZW1wdHlTcGFuQWZ0ZXJGb3JCbG9ja1N0YXJ0KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKiogUGFyc2VzIHRoZSBgbGV0YCBwYXJhbWV0ZXIgb2YgYSBgZm9yYCBsb29wIGJsb2NrLiAqL1xuZnVuY3Rpb24gcGFyc2VMZXRQYXJhbWV0ZXIoXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBleHByZXNzaW9uOiBzdHJpbmcsIHNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBjb250ZXh0OiB0LkZvckxvb3BCbG9ja0NvbnRleHQsIGVycm9yczogUGFyc2VFcnJvcltdKTogdm9pZCB7XG4gIGNvbnN0IHBhcnRzID0gZXhwcmVzc2lvbi5zcGxpdCgnLCcpO1xuXG4gIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgIGNvbnN0IGV4cHJlc3Npb25QYXJ0cyA9IHBhcnQuc3BsaXQoJz0nKTtcbiAgICBjb25zdCBuYW1lID0gZXhwcmVzc2lvblBhcnRzLmxlbmd0aCA9PT0gMiA/IGV4cHJlc3Npb25QYXJ0c1swXS50cmltKCkgOiAnJztcbiAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSAoZXhwcmVzc2lvblBhcnRzLmxlbmd0aCA9PT0gMiA/IGV4cHJlc3Npb25QYXJ0c1sxXS50cmltKCkgOiAnJykgYXNcbiAgICAgICAga2V5b2YgdC5Gb3JMb29wQmxvY2tDb250ZXh0O1xuXG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwIHx8IHZhcmlhYmxlTmFtZS5sZW5ndGggPT09IDApIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgICAgYEludmFsaWQgQGZvciBsb29wIFwibGV0XCIgcGFyYW1ldGVyLiBQYXJhbWV0ZXIgc2hvdWxkIG1hdGNoIHRoZSBwYXR0ZXJuIFwiPG5hbWU+ID0gPHZhcmlhYmxlIG5hbWU+XCJgKSk7XG4gICAgfSBlbHNlIGlmICghQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTLmhhcyh2YXJpYWJsZU5hbWUpKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICAgIGBVbmtub3duIFwibGV0XCIgcGFyYW1ldGVyIHZhcmlhYmxlIFwiJHt2YXJpYWJsZU5hbWV9XCIuIFRoZSBhbGxvd2VkIHZhcmlhYmxlcyBhcmU6ICR7XG4gICAgICAgICAgICAgIEFycmF5LmZyb20oQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTKS5qb2luKCcsICcpfWApKTtcbiAgICB9IGVsc2UgaWYgKGNvbnRleHQuaGFzT3duUHJvcGVydHkodmFyaWFibGVOYW1lKSkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3Ioc291cmNlU3BhbiwgYER1cGxpY2F0ZSBcImxldFwiIHBhcmFtZXRlciB2YXJpYWJsZSBcIiR7dmFyaWFibGVOYW1lfVwiYCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0W3ZhcmlhYmxlTmFtZV0gPSBuZXcgdC5WYXJpYWJsZShuYW1lLCB2YXJpYWJsZU5hbWUsIHNwYW4sIHNwYW4pO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB0aGF0IHRoZSBzaGFwZSBvZiB0aGUgYmxvY2tzIGNvbm5lY3RlZCB0byBhblxuICogYEBpZmAgYmxvY2sgaXMgY29ycmVjdC4gUmV0dXJucyBhbiBhcnJheSBvZiBlcnJvcnMuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlSWZDb25uZWN0ZWRCbG9ja3MoY29ubmVjdGVkQmxvY2tzOiBodG1sLkJsb2NrW10pOiBQYXJzZUVycm9yW10ge1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBsZXQgaGFzRWxzZSA9IGZhbHNlO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY29ubmVjdGVkQmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYmxvY2sgPSBjb25uZWN0ZWRCbG9ja3NbaV07XG5cbiAgICBpZiAoYmxvY2submFtZSA9PT0gJ2Vsc2UnKSB7XG4gICAgICBpZiAoaGFzRWxzZSkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQ29uZGl0aW9uYWwgY2FuIG9ubHkgaGF2ZSBvbmUgQGVsc2UgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbm5lY3RlZEJsb2Nrcy5sZW5ndGggPiAxICYmIGkgPCBjb25uZWN0ZWRCbG9ja3MubGVuZ3RoIC0gMSkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdAZWxzZSBibG9jayBtdXN0IGJlIGxhc3QgaW5zaWRlIHRoZSBjb25kaXRpb25hbCcpKTtcbiAgICAgIH0gZWxzZSBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdAZWxzZSBibG9jayBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzJykpO1xuICAgICAgfVxuICAgICAgaGFzRWxzZSA9IHRydWU7XG4gICAgfSBlbHNlIGlmICghRUxTRV9JRl9QQVRURVJOLnRlc3QoYmxvY2submFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgY29uZGl0aW9uYWwgYmxvY2sgQCR7YmxvY2submFtZX1gKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVycm9ycztcbn1cblxuLyoqIENoZWNrcyB0aGF0IHRoZSBzaGFwZSBvZiBhIGBzd2l0Y2hgIGJsb2NrIGlzIHZhbGlkLiBSZXR1cm5zIGFuIGFycmF5IG9mIGVycm9ycy4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlU3dpdGNoQmxvY2soYXN0OiBodG1sLkJsb2NrKTogUGFyc2VFcnJvcltdIHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgbGV0IGhhc0RlZmF1bHQgPSBmYWxzZTtcblxuICBpZiAoYXN0LnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYXN0LnNvdXJjZVNwYW4sICdAc3dpdGNoIGJsb2NrIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbWV0ZXInKSk7XG4gICAgcmV0dXJuIGVycm9ycztcbiAgfVxuXG4gIGZvciAoY29uc3Qgbm9kZSBvZiBhc3QuY2hpbGRyZW4pIHtcbiAgICAvLyBTa2lwIG92ZXIgY29tbWVudHMgYW5kIGVtcHR5IHRleHQgbm9kZXMgaW5zaWRlIHRoZSBzd2l0Y2ggYmxvY2suXG4gICAgLy8gRW1wdHkgdGV4dCBub2RlcyBjYW4gYmUgdXNlZCBmb3IgZm9ybWF0dGluZyB3aGlsZSBjb21tZW50cyBkb24ndCBhZmZlY3QgdGhlIHJ1bnRpbWUuXG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBodG1sLkNvbW1lbnQgfHxcbiAgICAgICAgKG5vZGUgaW5zdGFuY2VvZiBodG1sLlRleHQgJiYgbm9kZS52YWx1ZS50cmltKCkubGVuZ3RoID09PSAwKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKCEobm9kZSBpbnN0YW5jZW9mIGh0bWwuQmxvY2spIHx8IChub2RlLm5hbWUgIT09ICdjYXNlJyAmJiBub2RlLm5hbWUgIT09ICdkZWZhdWx0JykpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIG5vZGUuc291cmNlU3BhbiwgJ0Bzd2l0Y2ggYmxvY2sgY2FuIG9ubHkgY29udGFpbiBAY2FzZSBhbmQgQGRlZmF1bHQgYmxvY2tzJykpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKG5vZGUubmFtZSA9PT0gJ2RlZmF1bHQnKSB7XG4gICAgICBpZiAoaGFzRGVmYXVsdCkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKG5vZGUuc291cmNlU3BhbiwgJ0Bzd2l0Y2ggYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgQGRlZmF1bHQgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKG5vZGUucGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKG5vZGUuc291cmNlU3BhbiwgJ0BkZWZhdWx0IGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMnKSk7XG4gICAgICB9XG4gICAgICBoYXNEZWZhdWx0ID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKG5vZGUubmFtZSA9PT0gJ2Nhc2UnICYmIG5vZGUucGFyYW1ldGVycy5sZW5ndGggIT09IDEpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKG5vZGUuc291cmNlU3BhbiwgJ0BjYXNlIGJsb2NrIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbWV0ZXInKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVycm9ycztcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBibG9jayBwYXJhbWV0ZXIgaW50byBhIGJpbmRpbmcgQVNULlxuICogQHBhcmFtIGFzdCBCbG9jayBwYXJhbWV0ZXIgdGhhdCBzaG91bGQgYmUgcGFyc2VkLlxuICogQHBhcmFtIGJpbmRpbmdQYXJzZXIgUGFyc2VyIHRoYXQgdGhlIGV4cHJlc3Npb24gc2hvdWxkIGJlIHBhcnNlZCB3aXRoLlxuICogQHBhcmFtIHBhcnQgU3BlY2lmaWMgcGFydCBvZiB0aGUgZXhwcmVzc2lvbiB0aGF0IHNob3VsZCBiZSBwYXJzZWQuXG4gKi9cbmZ1bmN0aW9uIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoXG4gICAgYXN0OiBodG1sLkJsb2NrUGFyYW1ldGVyLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBwYXJ0Pzogc3RyaW5nKTogQVNUV2l0aFNvdXJjZSB7XG4gIGxldCBzdGFydDogbnVtYmVyO1xuICBsZXQgZW5kOiBudW1iZXI7XG5cbiAgaWYgKHR5cGVvZiBwYXJ0ID09PSAnc3RyaW5nJykge1xuICAgIC8vIE5vdGU6IGBsYXN0SW5kZXhPZmAgaGVyZSBzaG91bGQgYmUgZW5vdWdoIHRvIGtub3cgdGhlIHN0YXJ0IGluZGV4IG9mIHRoZSBleHByZXNzaW9uLFxuICAgIC8vIGJlY2F1c2Ugd2Uga25vdyB0aGF0IGl0J2xsIGJlIGF0IHRoZSBlbmQgb2YgdGhlIHBhcmFtLiBJZGVhbGx5IHdlIGNvdWxkIHVzZSB0aGUgYGRgXG4gICAgLy8gZmxhZyB3aGVuIG1hdGNoaW5nIHZpYSByZWdleCBhbmQgZ2V0IHRoZSBpbmRleCBmcm9tIGBtYXRjaC5pbmRpY2VzYCwgYnV0IGl0J3MgdW5jbGVhclxuICAgIC8vIGlmIHdlIGNhbiB1c2UgaXQgeWV0IHNpbmNlIGl0J3MgYSByZWxhdGl2ZWx5IG5ldyBmZWF0dXJlLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RjMzkvcHJvcG9zYWwtcmVnZXhwLW1hdGNoLWluZGljZXNcbiAgICBzdGFydCA9IE1hdGgubWF4KDAsIGFzdC5leHByZXNzaW9uLmxhc3RJbmRleE9mKHBhcnQpKTtcbiAgICBlbmQgPSBzdGFydCArIHBhcnQubGVuZ3RoO1xuICB9IGVsc2Uge1xuICAgIHN0YXJ0ID0gMDtcbiAgICBlbmQgPSBhc3QuZXhwcmVzc2lvbi5sZW5ndGg7XG4gIH1cblxuICByZXR1cm4gYmluZGluZ1BhcnNlci5wYXJzZUJpbmRpbmcoXG4gICAgICBhc3QuZXhwcmVzc2lvbi5zbGljZShzdGFydCwgZW5kKSwgZmFsc2UsIGFzdC5zb3VyY2VTcGFuLCBhc3Quc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBzdGFydCk7XG59XG5cbi8qKiBQYXJzZXMgdGhlIHBhcmFtZXRlciBvZiBhIGNvbmRpdGlvbmFsIGJsb2NrIChgaWZgIG9yIGBlbHNlIGlmYCkuICovXG5mdW5jdGlvbiBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKFxuICAgIGJsb2NrOiBodG1sLkJsb2NrLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge1xuICBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQ29uZGl0aW9uYWwgYmxvY2sgZG9lcyBub3QgaGF2ZSBhbiBleHByZXNzaW9uJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoYmxvY2sucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcik7XG4gIGxldCBleHByZXNzaW9uQWxpYXM6IHQuVmFyaWFibGV8bnVsbCA9IG51bGw7XG5cbiAgLy8gU3RhcnQgZnJvbSAxIHNpbmNlIHdlIHByb2Nlc3NlZCB0aGUgZmlyc3QgcGFyYW1ldGVyIGFscmVhZHkuXG4gIGZvciAobGV0IGkgPSAxOyBpIDwgYmxvY2sucGFyYW1ldGVycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHBhcmFtID0gYmxvY2sucGFyYW1ldGVyc1tpXTtcbiAgICBjb25zdCBhbGlhc01hdGNoID0gcGFyYW0uZXhwcmVzc2lvbi5tYXRjaChDT05ESVRJT05BTF9BTElBU19QQVRURVJOKTtcblxuICAgIC8vIEZvciBub3cgY29uZGl0aW9uYWxzIGNhbiBvbmx5IGhhdmUgYW4gYGFzYCBwYXJhbWV0ZXIuXG4gICAgLy8gV2UgbWF5IHdhbnQgdG8gcmV3b3JrIHRoaXMgbGF0ZXIgaWYgd2UgYWRkIG1vcmUuXG4gICAgaWYgKGFsaWFzTWF0Y2ggPT09IG51bGwpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHBhcmFtLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgY29uZGl0aW9uYWwgcGFyYW1hdGVyIFwiJHtwYXJhbS5leHByZXNzaW9ufVwiYCkpO1xuICAgIH0gZWxzZSBpZiAoYmxvY2submFtZSAhPT0gJ2lmJykge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgcGFyYW0uc291cmNlU3BhbiwgJ1wiYXNcIiBleHByZXNzaW9uIGlzIG9ubHkgYWxsb3dlZCBvbiB0aGUgcHJpbWFyeSBAaWYgYmxvY2snKSk7XG4gICAgfSBlbHNlIGlmIChleHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBjYW4gb25seSBoYXZlIG9uZSBcImFzXCIgZXhwcmVzc2lvbicpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmFtZSA9IGFsaWFzTWF0Y2hbMV0udHJpbSgpO1xuICAgICAgZXhwcmVzc2lvbkFsaWFzID0gbmV3IHQuVmFyaWFibGUobmFtZSwgbmFtZSwgcGFyYW0uc291cmNlU3BhbiwgcGFyYW0uc291cmNlU3Bhbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCBleHByZXNzaW9uQWxpYXN9O1xufVxuXG4vKiogU3RyaXBzIG9wdGlvbmFsIHBhcmVudGhlc2VzIGFyb3VuZCBmcm9tIGEgY29udHJvbCBmcm9tIGV4cHJlc3Npb24gcGFyYW1ldGVyLiAqL1xuZnVuY3Rpb24gc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKHBhcmFtOiBodG1sLkJsb2NrUGFyYW1ldGVyLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSk6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgZXhwcmVzc2lvbiA9IHBhcmFtLmV4cHJlc3Npb247XG4gIGNvbnN0IHNwYWNlUmVnZXggPSAvXlxccyQvO1xuICBsZXQgb3BlblBhcmVucyA9IDA7XG4gIGxldCBzdGFydCA9IDA7XG4gIGxldCBlbmQgPSBleHByZXNzaW9uLmxlbmd0aCAtIDE7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByZXNzaW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhciA9IGV4cHJlc3Npb25baV07XG5cbiAgICBpZiAoY2hhciA9PT0gJygnKSB7XG4gICAgICBzdGFydCA9IGkgKyAxO1xuICAgICAgb3BlblBhcmVucysrO1xuICAgIH0gZWxzZSBpZiAoc3BhY2VSZWdleC50ZXN0KGNoYXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wZW5QYXJlbnMgPT09IDApIHtcbiAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSBleHByZXNzaW9uLmxlbmd0aCAtIDE7IGkgPiAtMTsgaS0tKSB7XG4gICAgY29uc3QgY2hhciA9IGV4cHJlc3Npb25baV07XG5cbiAgICBpZiAoY2hhciA9PT0gJyknKSB7XG4gICAgICBlbmQgPSBpO1xuICAgICAgb3BlblBhcmVucy0tO1xuICAgICAgaWYgKG9wZW5QYXJlbnMgPT09IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzcGFjZVJlZ2V4LnRlc3QoY2hhcikpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAob3BlblBhcmVucyAhPT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdVbmNsb3NlZCBwYXJlbnRoZXNlcyBpbiBleHByZXNzaW9uJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIGV4cHJlc3Npb24uc2xpY2Uoc3RhcnQsIGVuZCk7XG59XG4iXX0=