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
const FOR_LOOP_EXPRESSION_PATTERN = /^\s*([0-9A-Za-z_$]*)\s+of\s+(.*)/;
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
        branches.push(new t.IfBlockBranch(mainBlockParams.expression, html.visitAll(visitor, ast.children, ast.children), mainBlockParams.expressionAlias, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan));
    }
    for (const block of connectedBlocks) {
        if (ELSE_IF_PATTERN.test(block.name)) {
            const params = parseConditionalBlockParameters(block, errors, bindingParser);
            if (params !== null) {
                const children = html.visitAll(visitor, block.children, block.children);
                branches.push(new t.IfBlockBranch(params.expression, children, params.expressionAlias, block.sourceSpan, block.startSourceSpan, block.endSourceSpan));
            }
        }
        else if (block.name === 'else') {
            const children = html.visitAll(visitor, block.children, block.children);
            branches.push(new t.IfBlockBranch(null, children, null, block.sourceSpan, block.startSourceSpan, block.endSourceSpan));
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
        node: new t.IfBlock(branches, wholeSourceSpan, ast.startSourceSpan, ifBlockEndSourceSpan),
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
                empty = new t.ForLoopBlockEmpty(html.visitAll(visitor, block.children, block.children), block.sourceSpan, block.startSourceSpan, block.endSourceSpan);
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
            node = new t.ForLoopBlock(params.itemName, params.expression, params.trackBy, params.context, html.visitAll(visitor, ast.children, ast.children), empty, sourceSpan, ast.sourceSpan, ast.startSourceSpan, endSpan);
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
            unknownBlocks.push(new t.UnknownBlock(node.name, node.sourceSpan));
            continue;
        }
        const expression = node.name === 'case' ?
            parseBlockParameterToBinding(node.parameters[0], bindingParser) :
            null;
        const ast = new t.SwitchBlockCase(expression, html.visitAll(visitor, node.children, node.children), node.sourceSpan, node.startSourceSpan, node.endSourceSpan);
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
        node: new t.SwitchBlock(primaryExpression, cases, unknownBlocks, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan),
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
                result.trackBy = parseBlockParameterToBinding(param, bindingParser, trackMatch[1]);
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
        // Skip over empty text nodes inside the switch block since they can be used for formatting.
        if (node instanceof html.Text && node.value.trim().length === 0) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBRSxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFHMUQsT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVLENBQUM7QUFFOUIsc0RBQXNEO0FBQ3RELE1BQU0sMkJBQTJCLEdBQUcsa0NBQWtDLENBQUM7QUFFdkUsK0RBQStEO0FBQy9ELE1BQU0sc0JBQXNCLEdBQUcsb0JBQW9CLENBQUM7QUFFcEQsOERBQThEO0FBQzlELE1BQU0seUJBQXlCLEdBQUcsWUFBWSxDQUFDO0FBRS9DLG1EQUFtRDtBQUNuRCxNQUFNLGVBQWUsR0FBRyxtQkFBbUIsQ0FBQztBQUU1QyxrREFBa0Q7QUFDbEQsTUFBTSxvQkFBb0IsR0FBRyxrQkFBa0IsQ0FBQztBQUVoRCw4RkFBOEY7QUFDOUYsTUFBTSw4QkFBOEIsR0FDaEMsSUFBSSxHQUFHLENBQThCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBRW5HOzs7R0FHRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxJQUFZO0lBQ2xELE9BQU8sSUFBSSxLQUFLLE9BQU8sQ0FBQztBQUMxQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLElBQVk7SUFDakQsT0FBTyxJQUFJLEtBQUssTUFBTSxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkQsQ0FBQztBQUVELHdEQUF3RDtBQUN4RCxNQUFNLFVB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LFNBQVM7U0FDVjthQUFNO1lBQ0wsTUFBTTtTQUNQO0tBQ0Y7SUFFRCxJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUU7UUFDcEIsT0FBTyxVQUFVLENBQUM7S0FDbkI7SUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMvQyxNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFM0IsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFO1lBQ2hCLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDUixVQUFVLEVBQUUsQ0FBQztZQUNiLElBQUksVUFBVSxLQUFLLENBQUMsRUFBRTtnQkFDcEIsTUFBTTthQUNQO1NBQ0Y7YUFBTSxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEMsU0FBUztTQUNWO2FBQU07WUFDTCxNQUFNO1NBQ1A7S0FDRjtJQUVELElBQUksVUFBVSxLQUFLLENBQUMsRUFBRTtRQUNwQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsb0NBQW9DLENBQUMsQ0FBQyxDQUFDO1FBQ3BGLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxPQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBU1RXaXRoU291cmNlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcblxuaW1wb3J0ICogYXMgdCBmcm9tICcuL3IzX2FzdCc7XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgZXhwcmVzc2lvbiBpbiBhIGZvciBsb29wIGJsb2NrLiAqL1xuY29uc3QgRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOID0gL15cXHMqKFswLTlBLVphLXpfJF0qKVxccytvZlxccysoLiopLztcblxuLyoqIFBhdHRlcm4gZm9yIHRoZSB0cmFja2luZyBleHByZXNzaW9uIGluIGEgZm9yIGxvb3AgYmxvY2suICovXG5jb25zdCBGT1JfTE9PUF9UUkFDS19QQVRURVJOID0gL150cmFja1xccysoW1xcU1xcc10qKS87XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgYGFzYCBleHByZXNzaW9uIGluIGEgY29uZGl0aW9uYWwgYmxvY2suICovXG5jb25zdCBDT05ESVRJT05BTF9BTElBU19QQVRURVJOID0gL15hc1xccysoLiopLztcblxuLyoqIFBhdHRlcm4gdXNlZCB0byBpZGVudGlmeSBhbiBgZWxzZSBpZmAgYmxvY2suICovXG5jb25zdCBFTFNFX0lGX1BBVFRFUk4gPSAvXmVsc2VbXlxcU1xcclxcbl0raWYvO1xuXG4vKiogUGF0dGVybiB1c2VkIHRvIGlkZW50aWZ5IGEgYGxldGAgcGFyYW1ldGVyLiAqL1xuY29uc3QgRk9SX0xPT1BfTEVUX1BBVFRFUk4gPSAvXmxldFxccysoW1xcU1xcc10qKS87XG5cbi8qKiBOYW1lcyBvZiB2YXJpYWJsZXMgdGhhdCBhcmUgYWxsb3dlZCB0byBiZSB1c2VkIGluIHRoZSBgbGV0YCBleHByZXNzaW9uIG9mIGEgYGZvcmAgbG9vcC4gKi9cbmNvbnN0IEFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUyA9XG4gICAgbmV3IFNldDxrZXlvZiB0LkZvckxvb3BCbG9ja0NvbnRleHQ+KFsnJGluZGV4JywgJyRmaXJzdCcsICckbGFzdCcsICckZXZlbicsICckb2RkJywgJyRjb3VudCddKTtcblxuLyoqXG4gKiBQcmVkaWNhdGUgZnVuY3Rpb24gdGhhdCBkZXRlcm1pbmVzIGlmIGEgYmxvY2sgd2l0aFxuICogYSBzcGVjaWZpYyBuYW1lIGNhbSBiZSBjb25uZWN0ZWQgdG8gYSBgZm9yYCBibG9jay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQ29ubmVjdGVkRm9yTG9vcEJsb2NrKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZSA9PT0gJ2VtcHR5Jztcbn1cblxuLyoqXG4gKiBQcmVkaWNhdGUgZnVuY3Rpb24gdGhhdCBkZXRlcm1pbmVzIGlmIGEgYmxvY2sgd2l0aFxuICogYSBzcGVjaWZpYyBuYW1lIGNhbSBiZSBjb25uZWN0ZWQgdG8gYW4gYGlmYCBibG9jay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQ29ubmVjdGVkSWZMb29wQmxvY2sobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lID09PSAnZWxzZScgfHwgRUxTRV9JRl9QQVRURVJOLnRlc3QobmFtZSk7XG59XG5cbi8qKiBDcmVhdGVzIGFuIGBpZmAgbG9vcCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSWZCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2ssIGNvbm5lY3RlZEJsb2NrczogaHRtbC5CbG9ja1tdLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LklmQmxvY2t8bnVsbCwgZXJyb3JzOiBQYXJzZUVycm9yW119IHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSB2YWxpZGF0ZUlmQ29ubmVjdGVkQmxvY2tzKGNvbm5lY3RlZEJsb2Nrcyk7XG4gIGNvbnN0IGJyYW5jaGVzOiB0LklmQmxvY2tCcmFuY2hbXSA9IFtdO1xuICBjb25zdCBtYWluQmxvY2tQYXJhbXMgPSBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKGFzdCwgZXJyb3JzLCBiaW5kaW5nUGFyc2VyKTtcblxuICBpZiAobWFpbkJsb2NrUGFyYW1zICE9PSBudWxsKSB7XG4gICAgYnJhbmNoZXMucHVzaChuZXcgdC5JZkJsb2NrQnJhbmNoKFxuICAgICAgICBtYWluQmxvY2tQYXJhbXMuZXhwcmVzc2lvbiwgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBhc3QuY2hpbGRyZW4sIGFzdC5jaGlsZHJlbiksXG4gICAgICAgIG1haW5CbG9ja1BhcmFtcy5leHByZXNzaW9uQWxpYXMsIGFzdC5zb3VyY2VTcGFuLCBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3BhbikpO1xuICB9XG5cbiAgZm9yIChjb25zdCBibG9jayBvZiBjb25uZWN0ZWRCbG9ja3MpIHtcbiAgICBpZiAoRUxTRV9JRl9QQVRURVJOLnRlc3QoYmxvY2submFtZSkpIHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHBhcnNlQ29uZGl0aW9uYWxCbG9ja1BhcmFtZXRlcnMoYmxvY2ssIGVycm9ycywgYmluZGluZ1BhcnNlcik7XG5cbiAgICAgIGlmIChwYXJhbXMgIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuLCBibG9jay5jaGlsZHJlbik7XG4gICAgICAgIGJyYW5jaGVzLnB1c2gobmV3IHQuSWZCbG9ja0JyYW5jaChcbiAgICAgICAgICAgIHBhcmFtcy5leHByZXNzaW9uLCBjaGlsZHJlbiwgcGFyYW1zLmV4cHJlc3Npb25BbGlhcywgYmxvY2suc291cmNlU3BhbixcbiAgICAgICAgICAgIGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgYmxvY2suZW5kU291cmNlU3BhbikpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYmxvY2submFtZSA9PT0gJ2Vsc2UnKSB7XG4gICAgICBjb25zdCBjaGlsZHJlbiA9IGh0bWwudmlzaXRBbGwodmlzaXRvciwgYmxvY2suY2hpbGRyZW4sIGJsb2NrLmNoaWxkcmVuKTtcbiAgICAgIGJyYW5jaGVzLnB1c2gobmV3IHQuSWZCbG9ja0JyYW5jaChcbiAgICAgICAgICBudWxsLCBjaGlsZHJlbiwgbnVsbCwgYmxvY2suc291cmNlU3BhbiwgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBibG9jay5lbmRTb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlIG91dGVyIElmQmxvY2sgc2hvdWxkIGhhdmUgYSBzcGFuIHRoYXQgZW5jYXBzdWxhdGVzIGFsbCBicmFuY2hlcy5cbiAgY29uc3QgaWZCbG9ja1N0YXJ0U291cmNlU3BhbiA9XG4gICAgICBicmFuY2hlcy5sZW5ndGggPiAwID8gYnJhbmNoZXNbMF0uc3RhcnRTb3VyY2VTcGFuIDogYXN0LnN0YXJ0U291cmNlU3BhbjtcbiAgY29uc3QgaWZCbG9ja0VuZFNvdXJjZVNwYW4gPVxuICAgICAgYnJhbmNoZXMubGVuZ3RoID4gMCA/IGJyYW5jaGVzW2JyYW5jaGVzLmxlbmd0aCAtIDFdLmVuZFNvdXJjZVNwYW4gOiBhc3QuZW5kU291cmNlU3BhbjtcblxuICBsZXQgd2hvbGVTb3VyY2VTcGFuID0gYXN0LnNvdXJjZVNwYW47XG4gIGNvbnN0IGxhc3RCcmFuY2ggPSBicmFuY2hlc1ticmFuY2hlcy5sZW5ndGggLSAxXTtcbiAgaWYgKGxhc3RCcmFuY2ggIT09IHVuZGVmaW5lZCkge1xuICAgIHdob2xlU291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oaWZCbG9ja1N0YXJ0U291cmNlU3Bhbi5zdGFydCwgbGFzdEJyYW5jaC5zb3VyY2VTcGFuLmVuZCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5vZGU6IG5ldyB0LklmQmxvY2soYnJhbmNoZXMsIHdob2xlU291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgaWZCbG9ja0VuZFNvdXJjZVNwYW4pLFxuICAgIGVycm9ycyxcbiAgfTtcbn1cblxuLyoqIENyZWF0ZXMgYSBgZm9yYCBsb29wIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVGb3JMb29wKFxuICAgIGFzdDogaHRtbC5CbG9jaywgY29ubmVjdGVkQmxvY2tzOiBodG1sLkJsb2NrW10sIHZpc2l0b3I6IGh0bWwuVmlzaXRvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge25vZGU6IHQuRm9yTG9vcEJsb2NrfG51bGwsIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGNvbnN0IHBhcmFtcyA9IHBhcnNlRm9yTG9vcFBhcmFtZXRlcnMoYXN0LCBlcnJvcnMsIGJpbmRpbmdQYXJzZXIpO1xuICBsZXQgbm9kZTogdC5Gb3JMb29wQmxvY2t8bnVsbCA9IG51bGw7XG4gIGxldCBlbXB0eTogdC5Gb3JMb29wQmxvY2tFbXB0eXxudWxsID0gbnVsbDtcblxuICBmb3IgKGNvbnN0IGJsb2NrIG9mIGNvbm5lY3RlZEJsb2Nrcykge1xuICAgIGlmIChibG9jay5uYW1lID09PSAnZW1wdHknKSB7XG4gICAgICBpZiAoZW1wdHkgIT09IG51bGwpIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0Bmb3IgbG9vcCBjYW4gb25seSBoYXZlIG9uZSBAZW1wdHkgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQGVtcHR5IGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMnKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbXB0eSA9IG5ldyB0LkZvckxvb3BCbG9ja0VtcHR5KFxuICAgICAgICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiwgYmxvY2suY2hpbGRyZW4pLCBibG9jay5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBibG9jay5lbmRTb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBAZm9yIGxvb3AgYmxvY2sgXCIke2Jsb2NrLm5hbWV9XCJgKSk7XG4gICAgfVxuICB9XG5cblxuICBpZiAocGFyYW1zICE9PSBudWxsKSB7XG4gICAgaWYgKHBhcmFtcy50cmFja0J5ID09PSBudWxsKSB7XG4gICAgICAvLyBUT0RPOiBXZSBzaG91bGQgbm90IGZhaWwgaGVyZSwgYW5kIGluc3RlYWQgdHJ5IHRvIHByb2R1Y2Ugc29tZSBBU1QgZm9yIHRoZSBsYW5ndWFnZVxuICAgICAgLy8gc2VydmljZS5cbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGFzdC5zb3VyY2VTcGFuLCAnQGZvciBsb29wIG11c3QgaGF2ZSBhIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgYGZvcmAgYmxvY2sgaGFzIGEgbWFpbiBzcGFuIHRoYXQgaW5jbHVkZXMgdGhlIGBlbXB0eWAgYnJhbmNoLiBGb3Igb25seSB0aGUgc3BhbiBvZiB0aGVcbiAgICAgIC8vIG1haW4gYGZvcmAgYm9keSwgdXNlIGBtYWluU291cmNlU3BhbmAuXG4gICAgICBjb25zdCBlbmRTcGFuID0gZW1wdHk/LmVuZFNvdXJjZVNwYW4gPz8gYXN0LmVuZFNvdXJjZVNwYW47XG4gICAgICBjb25zdCBzb3VyY2VTcGFuID1cbiAgICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKGFzdC5zb3VyY2VTcGFuLnN0YXJ0LCBlbmRTcGFuPy5lbmQgPz8gYXN0LnNvdXJjZVNwYW4uZW5kKTtcbiAgICAgIG5vZGUgPSBuZXcgdC5Gb3JMb29wQmxvY2soXG4gICAgICAgICAgcGFyYW1zLml0ZW1OYW1lLCBwYXJhbXMuZXhwcmVzc2lvbiwgcGFyYW1zLnRyYWNrQnksIHBhcmFtcy5jb250ZXh0LFxuICAgICAgICAgIGh0bWwudmlzaXRBbGwodmlzaXRvciwgYXN0LmNoaWxkcmVuLCBhc3QuY2hpbGRyZW4pLCBlbXB0eSwgc291cmNlU3BhbiwgYXN0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgYXN0LnN0YXJ0U291cmNlU3BhbiwgZW5kU3Bhbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtub2RlLCBlcnJvcnN9O1xufVxuXG4vKiogQ3JlYXRlcyBhIHN3aXRjaCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3dpdGNoQmxvY2soXG4gICAgYXN0OiBodG1sLkJsb2NrLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LlN3aXRjaEJsb2NrfG51bGwsIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlU3dpdGNoQmxvY2soYXN0KTtcbiAgY29uc3QgcHJpbWFyeUV4cHJlc3Npb24gPSBhc3QucGFyYW1ldGVycy5sZW5ndGggPiAwID9cbiAgICAgIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoYXN0LnBhcmFtZXRlcnNbMF0sIGJpbmRpbmdQYXJzZXIpIDpcbiAgICAgIGJpbmRpbmdQYXJzZXIucGFyc2VCaW5kaW5nKCcnLCBmYWxzZSwgYXN0LnNvdXJjZVNwYW4sIDApO1xuICBjb25zdCBjYXNlczogdC5Td2l0Y2hCbG9ja0Nhc2VbXSA9IFtdO1xuICBjb25zdCB1bmtub3duQmxvY2tzOiB0LlVua25vd25CbG9ja1tdID0gW107XG4gIGxldCBkZWZhdWx0Q2FzZTogdC5Td2l0Y2hCbG9ja0Nhc2V8bnVsbCA9IG51bGw7XG5cbiAgLy8gSGVyZSB3ZSBhc3N1bWUgdGhhdCBhbGwgdGhlIGJsb2NrcyBhcmUgdmFsaWQgZ2l2ZW4gdGhhdCB3ZSB2YWxpZGF0ZWQgdGhlbSBhYm92ZS5cbiAgZm9yIChjb25zdCBub2RlIG9mIGFzdC5jaGlsZHJlbikge1xuICAgIGlmICghKG5vZGUgaW5zdGFuY2VvZiBodG1sLkJsb2NrKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKChub2RlLm5hbWUgIT09ICdjYXNlJyB8fCBub2RlLnBhcmFtZXRlcnMubGVuZ3RoID09PSAwKSAmJiBub2RlLm5hbWUgIT09ICdkZWZhdWx0Jykge1xuICAgICAgdW5rbm93bkJsb2Nrcy5wdXNoKG5ldyB0LlVua25vd25CbG9jayhub2RlLm5hbWUsIG5vZGUuc291cmNlU3BhbikpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IG5vZGUubmFtZSA9PT0gJ2Nhc2UnID9cbiAgICAgICAgcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhub2RlLnBhcmFtZXRlcnNbMF0sIGJpbmRpbmdQYXJzZXIpIDpcbiAgICAgICAgbnVsbDtcbiAgICBjb25zdCBhc3QgPSBuZXcgdC5Td2l0Y2hCbG9ja0Nhc2UoXG4gICAgICAgIGV4cHJlc3Npb24sIGh0bWwudmlzaXRBbGwodmlzaXRvciwgbm9kZS5jaGlsZHJlbiwgbm9kZS5jaGlsZHJlbiksIG5vZGUuc291cmNlU3BhbixcbiAgICAgICAgbm9kZS5zdGFydFNvdXJjZVNwYW4sIG5vZGUuZW5kU291cmNlU3Bhbik7XG5cbiAgICBpZiAoZXhwcmVzc2lvbiA9PT0gbnVsbCkge1xuICAgICAgZGVmYXVsdENhc2UgPSBhc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhc2VzLnB1c2goYXN0KTtcbiAgICB9XG4gIH1cblxuICAvLyBFbnN1cmUgdGhhdCB0aGUgZGVmYXVsdCBjYXNlIGlzIGxhc3QgaW4gdGhlIGFycmF5LlxuICBpZiAoZGVmYXVsdENhc2UgIT09IG51bGwpIHtcbiAgICBjYXNlcy5wdXNoKGRlZmF1bHRDYXNlKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbm9kZTogbmV3IHQuU3dpdGNoQmxvY2soXG4gICAgICAgIHByaW1hcnlFeHByZXNzaW9uLCBjYXNlcywgdW5rbm93bkJsb2NrcywgYXN0LnNvdXJjZVNwYW4sIGFzdC5zdGFydFNvdXJjZVNwYW4sXG4gICAgICAgIGFzdC5lbmRTb3VyY2VTcGFuKSxcbiAgICBlcnJvcnNcbiAgfTtcbn1cblxuLyoqIFBhcnNlcyB0aGUgcGFyYW1ldGVycyBvZiBhIGBmb3JgIGxvb3AgYmxvY2suICovXG5mdW5jdGlvbiBwYXJzZUZvckxvb3BQYXJhbWV0ZXJzKFxuICAgIGJsb2NrOiBodG1sLkJsb2NrLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge1xuICBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQGZvciBsb29wIGRvZXMgbm90IGhhdmUgYW4gZXhwcmVzc2lvbicpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IFtleHByZXNzaW9uUGFyYW0sIC4uLnNlY29uZGFyeVBhcmFtc10gPSBibG9jay5wYXJhbWV0ZXJzO1xuICBjb25zdCBtYXRjaCA9XG4gICAgICBzdHJpcE9wdGlvbmFsUGFyZW50aGVzZXMoZXhwcmVzc2lvblBhcmFtLCBlcnJvcnMpPy5tYXRjaChGT1JfTE9PUF9FWFBSRVNTSU9OX1BBVFRFUk4pO1xuXG4gIGlmICghbWF0Y2ggfHwgbWF0Y2hbMl0udHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICBleHByZXNzaW9uUGFyYW0uc291cmNlU3BhbixcbiAgICAgICAgJ0Nhbm5vdCBwYXJzZSBleHByZXNzaW9uLiBAZm9yIGxvb3AgZXhwcmVzc2lvbiBtdXN0IG1hdGNoIHRoZSBwYXR0ZXJuIFwiPGlkZW50aWZpZXI+IG9mIDxleHByZXNzaW9uPlwiJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgWywgaXRlbU5hbWUsIHJhd0V4cHJlc3Npb25dID0gbWF0Y2g7XG4gIGNvbnN0IHJlc3VsdCA9IHtcbiAgICBpdGVtTmFtZTogbmV3IHQuVmFyaWFibGUoXG4gICAgICAgIGl0ZW1OYW1lLCAnJGltcGxpY2l0JywgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4sIGV4cHJlc3Npb25QYXJhbS5zb3VyY2VTcGFuKSxcbiAgICB0cmFja0J5OiBudWxsIGFzIEFTVFdpdGhTb3VyY2UgfCBudWxsLFxuICAgIGV4cHJlc3Npb246IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoZXhwcmVzc2lvblBhcmFtLCBiaW5kaW5nUGFyc2VyLCByYXdFeHByZXNzaW9uKSxcbiAgICBjb250ZXh0OiB7fSBhcyB0LkZvckxvb3BCbG9ja0NvbnRleHQsXG4gIH07XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBzZWNvbmRhcnlQYXJhbXMpIHtcbiAgICBjb25zdCBsZXRNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goRk9SX0xPT1BfTEVUX1BBVFRFUk4pO1xuXG4gICAgaWYgKGxldE1hdGNoICE9PSBudWxsKSB7XG4gICAgICBwYXJzZUxldFBhcmFtZXRlcihwYXJhbS5zb3VyY2VTcGFuLCBsZXRNYXRjaFsxXSwgcGFyYW0uc291cmNlU3BhbiwgcmVzdWx0LmNvbnRleHQsIGVycm9ycyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0cmFja01hdGNoID0gcGFyYW0uZXhwcmVzc2lvbi5tYXRjaChGT1JfTE9PUF9UUkFDS19QQVRURVJOKTtcblxuICAgIGlmICh0cmFja01hdGNoICE9PSBudWxsKSB7XG4gICAgICBpZiAocmVzdWx0LnRyYWNrQnkgIT09IG51bGwpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnQGZvciBsb29wIGNhbiBvbmx5IGhhdmUgb25lIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LnRyYWNrQnkgPSBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKHBhcmFtLCBiaW5kaW5nUGFyc2VyLCB0cmFja01hdGNoWzFdKTtcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCBgVW5yZWNvZ25pemVkIEBmb3IgbG9vcCBwYXJhbWF0ZXIgXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKSk7XG4gIH1cblxuICAvLyBGaWxsIG91dCBhbnkgdmFyaWFibGVzIHRoYXQgaGF2ZW4ndCBiZWVuIGRlZmluZWQgZXhwbGljaXRseS5cbiAgZm9yIChjb25zdCB2YXJpYWJsZU5hbWUgb2YgQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTKSB7XG4gICAgaWYgKCFyZXN1bHQuY29udGV4dC5oYXNPd25Qcm9wZXJ0eSh2YXJpYWJsZU5hbWUpKSB7XG4gICAgICAvLyBHaXZlIGFtYmllbnRseS1hdmFpbGFibGUgY29udGV4dCB2YXJpYWJsZXMgZW1wdHkgc3BhbnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RhcnQgb2YgdGhlIGBmb3JgXG4gICAgICAvLyBibG9jaywgc2luY2UgdGhleSBhcmUgbm90IGV4cGxpY2l0bHkgZGVmaW5lZC5cbiAgICAgIGNvbnN0IGVtcHR5U3BhbkFmdGVyRm9yQmxvY2tTdGFydCA9XG4gICAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihibG9jay5zdGFydFNvdXJjZVNwYW4uZW5kLCBibG9jay5zdGFydFNvdXJjZVNwYW4uZW5kKTtcbiAgICAgIHJlc3VsdC5jb250ZXh0W3ZhcmlhYmxlTmFtZV0gPSBuZXcgdC5WYXJpYWJsZShcbiAgICAgICAgICB2YXJpYWJsZU5hbWUsIHZhcmlhYmxlTmFtZSwgZW1wdHlTcGFuQWZ0ZXJGb3JCbG9ja1N0YXJ0LCBlbXB0eVNwYW5BZnRlckZvckJsb2NrU3RhcnQpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKiBQYXJzZXMgdGhlIGBsZXRgIHBhcmFtZXRlciBvZiBhIGBmb3JgIGxvb3AgYmxvY2suICovXG5mdW5jdGlvbiBwYXJzZUxldFBhcmFtZXRlcihcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGV4cHJlc3Npb246IHN0cmluZywgc3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIGNvbnRleHQ6IHQuRm9yTG9vcEJsb2NrQ29udGV4dCwgZXJyb3JzOiBQYXJzZUVycm9yW10pOiB2b2lkIHtcbiAgY29uc3QgcGFydHMgPSBleHByZXNzaW9uLnNwbGl0KCcsJyk7XG5cbiAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgY29uc3QgZXhwcmVzc2lvblBhcnRzID0gcGFydC5zcGxpdCgnPScpO1xuICAgIGNvbnN0IG5hbWUgPSBleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyID8gZXhwcmVzc2lvblBhcnRzWzBdLnRyaW0oKSA6ICcnO1xuICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IChleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyID8gZXhwcmVzc2lvblBhcnRzWzFdLnRyaW0oKSA6ICcnKSBhc1xuICAgICAgICBrZXlvZiB0LkZvckxvb3BCbG9ja0NvbnRleHQ7XG5cbiAgICBpZiAobmFtZS5sZW5ndGggPT09IDAgfHwgdmFyaWFibGVOYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICBgSW52YWxpZCBAZm9yIGxvb3AgXCJsZXRcIiBwYXJhbWV0ZXIuIFBhcmFtZXRlciBzaG91bGQgbWF0Y2ggdGhlIHBhdHRlcm4gXCI8bmFtZT4gPSA8dmFyaWFibGUgbmFtZT5cImApKTtcbiAgICB9IGVsc2UgaWYgKCFBTExPV0VEX0ZPUl9MT09QX0xFVF9WQVJJQUJMRVMuaGFzKHZhcmlhYmxlTmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgICAgYFVua25vd24gXCJsZXRcIiBwYXJhbWV0ZXIgdmFyaWFibGUgXCIke3ZhcmlhYmxlTmFtZX1cIi4gVGhlIGFsbG93ZWQgdmFyaWFibGVzIGFyZTogJHtcbiAgICAgICAgICAgICAgQXJyYXkuZnJvbShBTExPV0VEX0ZPUl9MT09QX0xFVF9WQVJJQUJMRVMpLmpvaW4oJywgJyl9YCkpO1xuICAgIH0gZWxzZSBpZiAoY29udGV4dC5oYXNPd25Qcm9wZXJ0eSh2YXJpYWJsZU5hbWUpKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICBuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBgRHVwbGljYXRlIFwibGV0XCIgcGFyYW1ldGVyIHZhcmlhYmxlIFwiJHt2YXJpYWJsZU5hbWV9XCJgKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHRbdmFyaWFibGVOYW1lXSA9IG5ldyB0LlZhcmlhYmxlKG5hbWUsIHZhcmlhYmxlTmFtZSwgc3Bhbiwgc3Bhbik7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHRoYXQgdGhlIHNoYXBlIG9mIHRoZSBibG9ja3MgY29ubmVjdGVkIHRvIGFuXG4gKiBgQGlmYCBibG9jayBpcyBjb3JyZWN0LiBSZXR1cm5zIGFuIGFycmF5IG9mIGVycm9ycy5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVJZkNvbm5lY3RlZEJsb2Nrcyhjb25uZWN0ZWRCbG9ja3M6IGh0bWwuQmxvY2tbXSk6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGxldCBoYXNFbHNlID0gZmFsc2U7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb25uZWN0ZWRCbG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBibG9jayA9IGNvbm5lY3RlZEJsb2Nrc1tpXTtcblxuICAgIGlmIChibG9jay5uYW1lID09PSAnZWxzZScpIHtcbiAgICAgIGlmIChoYXNFbHNlKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBjYW4gb25seSBoYXZlIG9uZSBAZWxzZSBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAoY29ubmVjdGVkQmxvY2tzLmxlbmd0aCA+IDEgJiYgaSA8IGNvbm5lY3RlZEJsb2Nrcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0BlbHNlIGJsb2NrIG11c3QgYmUgbGFzdCBpbnNpZGUgdGhlIGNvbmRpdGlvbmFsJykpO1xuICAgICAgfSBlbHNlIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0BlbHNlIGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMnKSk7XG4gICAgICB9XG4gICAgICBoYXNFbHNlID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKCFFTFNFX0lGX1BBVFRFUk4udGVzdChibG9jay5uYW1lKSkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBjb25kaXRpb25hbCBibG9jayBAJHtibG9jay5uYW1lfWApKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXJyb3JzO1xufVxuXG4vKiogQ2hlY2tzIHRoYXQgdGhlIHNoYXBlIG9mIGEgYHN3aXRjaGAgYmxvY2sgaXMgdmFsaWQuIFJldHVybnMgYW4gYXJyYXkgb2YgZXJyb3JzLiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVTd2l0Y2hCbG9jayhhc3Q6IGh0bWwuQmxvY2spOiBQYXJzZUVycm9yW10ge1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBsZXQgaGFzRGVmYXVsdCA9IGZhbHNlO1xuXG4gIGlmIChhc3QucGFyYW1ldGVycy5sZW5ndGggIT09IDEpIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihhc3Quc291cmNlU3BhbiwgJ0Bzd2l0Y2ggYmxvY2sgbXVzdCBoYXZlIGV4YWN0bHkgb25lIHBhcmFtZXRlcicpKTtcbiAgICByZXR1cm4gZXJyb3JzO1xuICB9XG5cbiAgZm9yIChjb25zdCBub2RlIG9mIGFzdC5jaGlsZHJlbikge1xuICAgIC8vIFNraXAgb3ZlciBlbXB0eSB0ZXh0IG5vZGVzIGluc2lkZSB0aGUgc3dpdGNoIGJsb2NrIHNpbmNlIHRoZXkgY2FuIGJlIHVzZWQgZm9yIGZvcm1hdHRpbmcuXG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBodG1sLlRleHQgJiYgbm9kZS52YWx1ZS50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgaHRtbC5CbG9jaykgfHwgKG5vZGUubmFtZSAhPT0gJ2Nhc2UnICYmIG5vZGUubmFtZSAhPT0gJ2RlZmF1bHQnKSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgbm9kZS5zb3VyY2VTcGFuLCAnQHN3aXRjaCBibG9jayBjYW4gb25seSBjb250YWluIEBjYXNlIGFuZCBAZGVmYXVsdCBibG9ja3MnKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAobm9kZS5uYW1lID09PSAnZGVmYXVsdCcpIHtcbiAgICAgIGlmIChoYXNEZWZhdWx0KSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCAnQHN3aXRjaCBibG9jayBjYW4gb25seSBoYXZlIG9uZSBAZGVmYXVsdCBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAobm9kZS5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCAnQGRlZmF1bHQgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICAgIH1cbiAgICAgIGhhc0RlZmF1bHQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAobm9kZS5uYW1lID09PSAnY2FzZScgJiYgbm9kZS5wYXJhbWV0ZXJzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCAnQGNhc2UgYmxvY2sgbXVzdCBoYXZlIGV4YWN0bHkgb25lIHBhcmFtZXRlcicpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXJyb3JzO1xufVxuXG4vKipcbiAqIFBhcnNlcyBhIGJsb2NrIHBhcmFtZXRlciBpbnRvIGEgYmluZGluZyBBU1QuXG4gKiBAcGFyYW0gYXN0IEJsb2NrIHBhcmFtZXRlciB0aGF0IHNob3VsZCBiZSBwYXJzZWQuXG4gKiBAcGFyYW0gYmluZGluZ1BhcnNlciBQYXJzZXIgdGhhdCB0aGUgZXhwcmVzc2lvbiBzaG91bGQgYmUgcGFyc2VkIHdpdGguXG4gKiBAcGFyYW0gcGFydCBTcGVjaWZpYyBwYXJ0IG9mIHRoZSBleHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHBhcnNlZC5cbiAqL1xuZnVuY3Rpb24gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhcbiAgICBhc3Q6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIHBhcnQ/OiBzdHJpbmcpOiBBU1RXaXRoU291cmNlIHtcbiAgbGV0IHN0YXJ0OiBudW1iZXI7XG4gIGxldCBlbmQ6IG51bWJlcjtcblxuICBpZiAodHlwZW9mIHBhcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgLy8gTm90ZTogYGxhc3RJbmRleE9mYCBoZXJlIHNob3VsZCBiZSBlbm91Z2ggdG8ga25vdyB0aGUgc3RhcnQgaW5kZXggb2YgdGhlIGV4cHJlc3Npb24sXG4gICAgLy8gYmVjYXVzZSB3ZSBrbm93IHRoYXQgaXQnbGwgYmUgYXQgdGhlIGVuZCBvZiB0aGUgcGFyYW0uIElkZWFsbHkgd2UgY291bGQgdXNlIHRoZSBgZGBcbiAgICAvLyBmbGFnIHdoZW4gbWF0Y2hpbmcgdmlhIHJlZ2V4IGFuZCBnZXQgdGhlIGluZGV4IGZyb20gYG1hdGNoLmluZGljZXNgLCBidXQgaXQncyB1bmNsZWFyXG4gICAgLy8gaWYgd2UgY2FuIHVzZSBpdCB5ZXQgc2luY2UgaXQncyBhIHJlbGF0aXZlbHkgbmV3IGZlYXR1cmUuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdGMzOS9wcm9wb3NhbC1yZWdleHAtbWF0Y2gtaW5kaWNlc1xuICAgIHN0YXJ0ID0gTWF0aC5tYXgoMCwgYXN0LmV4cHJlc3Npb24ubGFzdEluZGV4T2YocGFydCkpO1xuICAgIGVuZCA9IHN0YXJ0ICsgcGFydC5sZW5ndGg7XG4gIH0gZWxzZSB7XG4gICAgc3RhcnQgPSAwO1xuICAgIGVuZCA9IGFzdC5leHByZXNzaW9uLmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLnBhcnNlQmluZGluZyhcbiAgICAgIGFzdC5leHByZXNzaW9uLnNsaWNlKHN0YXJ0LCBlbmQpLCBmYWxzZSwgYXN0LnNvdXJjZVNwYW4sIGFzdC5zb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCArIHN0YXJ0KTtcbn1cblxuLyoqIFBhcnNlcyB0aGUgcGFyYW1ldGVyIG9mIGEgY29uZGl0aW9uYWwgYmxvY2sgKGBpZmAgb3IgYGVsc2UgaWZgKS4gKi9cbmZ1bmN0aW9uIHBhcnNlQ29uZGl0aW9uYWxCbG9ja1BhcmFtZXRlcnMoXG4gICAgYmxvY2s6IGh0bWwuQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBibG9jayBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhibG9jay5wYXJhbWV0ZXJzWzBdLCBiaW5kaW5nUGFyc2VyKTtcbiAgbGV0IGV4cHJlc3Npb25BbGlhczogdC5WYXJpYWJsZXxudWxsID0gbnVsbDtcblxuICAvLyBTdGFydCBmcm9tIDEgc2luY2Ugd2UgcHJvY2Vzc2VkIHRoZSBmaXJzdCBwYXJhbWV0ZXIgYWxyZWFkeS5cbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBibG9jay5wYXJhbWV0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcGFyYW0gPSBibG9jay5wYXJhbWV0ZXJzW2ldO1xuICAgIGNvbnN0IGFsaWFzTWF0Y2ggPSBwYXJhbS5leHByZXNzaW9uLm1hdGNoKENPTkRJVElPTkFMX0FMSUFTX1BBVFRFUk4pO1xuXG4gICAgLy8gRm9yIG5vdyBjb25kaXRpb25hbHMgY2FuIG9ubHkgaGF2ZSBhbiBgYXNgIHBhcmFtZXRlci5cbiAgICAvLyBXZSBtYXkgd2FudCB0byByZXdvcmsgdGhpcyBsYXRlciBpZiB3ZSBhZGQgbW9yZS5cbiAgICBpZiAoYWxpYXNNYXRjaCA9PT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgcGFyYW0uc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBjb25kaXRpb25hbCBwYXJhbWF0ZXIgXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKSk7XG4gICAgfSBlbHNlIGlmIChibG9jay5uYW1lICE9PSAnaWYnKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICBwYXJhbS5zb3VyY2VTcGFuLCAnXCJhc1wiIGV4cHJlc3Npb24gaXMgb25seSBhbGxvd2VkIG9uIHRoZSBwcmltYXJ5IEBpZiBibG9jaycpKTtcbiAgICB9IGVsc2UgaWYgKGV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ0NvbmRpdGlvbmFsIGNhbiBvbmx5IGhhdmUgb25lIFwiYXNcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuYW1lID0gYWxpYXNNYXRjaFsxXS50cmltKCk7XG4gICAgICBleHByZXNzaW9uQWxpYXMgPSBuZXcgdC5WYXJpYWJsZShuYW1lLCBuYW1lLCBwYXJhbS5zb3VyY2VTcGFuLCBwYXJhbS5zb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2V4cHJlc3Npb24sIGV4cHJlc3Npb25BbGlhc307XG59XG5cbi8qKiBTdHJpcHMgb3B0aW9uYWwgcGFyZW50aGVzZXMgYXJvdW5kIGZyb20gYSBjb250cm9sIGZyb20gZXhwcmVzc2lvbiBwYXJhbWV0ZXIuICovXG5mdW5jdGlvbiBzdHJpcE9wdGlvbmFsUGFyZW50aGVzZXMocGFyYW06IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGVycm9yczogUGFyc2VFcnJvcltdKTogc3RyaW5nfG51bGwge1xuICBjb25zdCBleHByZXNzaW9uID0gcGFyYW0uZXhwcmVzc2lvbjtcbiAgY29uc3Qgc3BhY2VSZWdleCA9IC9eXFxzJC87XG4gIGxldCBvcGVuUGFyZW5zID0gMDtcbiAgbGV0IHN0YXJ0ID0gMDtcbiAgbGV0IGVuZCA9IGV4cHJlc3Npb24ubGVuZ3RoIC0gMTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHJlc3Npb24ubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaGFyID0gZXhwcmVzc2lvbltpXTtcblxuICAgIGlmIChjaGFyID09PSAnKCcpIHtcbiAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICBvcGVuUGFyZW5zKys7XG4gICAgfSBlbHNlIGlmIChzcGFjZVJlZ2V4LnRlc3QoY2hhcikpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAob3BlblBhcmVucyA9PT0gMCkge1xuICAgIHJldHVybiBleHByZXNzaW9uO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IGV4cHJlc3Npb24ubGVuZ3RoIC0gMTsgaSA+IC0xOyBpLS0pIHtcbiAgICBjb25zdCBjaGFyID0gZXhwcmVzc2lvbltpXTtcblxuICAgIGlmIChjaGFyID09PSAnKScpIHtcbiAgICAgIGVuZCA9IGk7XG4gICAgICBvcGVuUGFyZW5zLS07XG4gICAgICBpZiAob3BlblBhcmVucyA9PT0gMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNwYWNlUmVnZXgudGVzdChjaGFyKSkge1xuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChvcGVuUGFyZW5zICE9PSAwKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ1VuY2xvc2VkIHBhcmVudGhlc2VzIGluIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gZXhwcmVzc2lvbi5zbGljZShzdGFydCwgZW5kKTtcbn1cbiJdfQ==