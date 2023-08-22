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
/** Pattern used to identify a `let` parameter. */
const FOR_LOOP_LET_PATTERN = /^let\s+(.*)/;
/** Names of variables that are allowed to be used in the `let` expression of a `for` loop. */
const ALLOWED_FOR_LOOP_LET_VARIABLES = new Set(['$index', '$first', '$last', '$even', '$odd', '$count']);
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
        const params = parseConditionalBlockParameters(block, errors, bindingParser);
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
            node = new t.ForLoopBlock(params.itemName, params.expression, params.trackBy, params.context, html.visitAll(visitor, primaryBlock.children), empty, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
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
        expression: parseBlockParameterToBinding(expressionParam, bindingParser, rawExpression),
        context: null,
    };
    for (const param of secondaryParams) {
        const letMatch = param.expression.match(FOR_LOOP_LET_PATTERN);
        if (letMatch !== null) {
            result.context = result.context || {};
            parseLetParameter(param.sourceSpan, letMatch[1], result.context, errors);
            continue;
        }
        const trackMatch = param.expression.match(FOR_LOOP_TRACK_PATTERN);
        if (trackMatch !== null) {
            if (result.trackBy !== null) {
                errors.push(new ParseError(param.sourceSpan, 'For loop can only have one "track" expression'));
            }
            else {
                result.trackBy = parseBlockParameterToBinding(param, bindingParser, trackMatch[1]);
            }
            continue;
        }
        errors.push(new ParseError(param.sourceSpan, `Unrecognized loop paramater "${param.expression}"`));
    }
    return result;
}
/** Parses the `let` parameter of a `for` loop block. */
function parseLetParameter(sourceSpan, expression, context, errors) {
    const parts = expression.split(',');
    for (const part of parts) {
        const expressionParts = part.split('=');
        const name = expressionParts.length === 2 ? expressionParts[0].trim() : '';
        const variableName = expressionParts.length === 2 ? expressionParts[1].trim() : '';
        if (name.length === 0 || variableName.length === 0) {
            errors.push(new ParseError(sourceSpan, `Invalid for loop "let" parameter. Parameter should match the pattern "<name> = <variable name>"`));
        }
        else if (!ALLOWED_FOR_LOOP_LET_VARIABLES.has(variableName)) {
            errors.push(new ParseError(sourceSpan, `Unknown "let" parameter variable "${variableName}". The allowed variables are: ${Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES).join(', ')}`));
        }
        else if (context.hasOwnProperty(variableName)) {
            errors.push(new ParseError(sourceSpan, `Duplicate "let" parameter variable "${variableName}"`));
        }
        else {
            context[variableName] = name;
        }
    }
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
function parseBlockParameterToBinding(ast, bindingParser, part = 0) {
    let start;
    let end;
    if (typeof part === 'number') {
        start = part;
        end = ast.expression.length;
    }
    else {
        // Note: `lastIndexOf` here should be enough to know the start index of the expression,
        // because we know that it'll be at the end of the param. Ideally we could use the `d`
        // flag when matching via regex and get the index from `match.indices`, but it's unclear
        // if we can use it yet since it's a relatively new feature. See:
        // https://github.com/tc39/proposal-regexp-match-indices
        start = Math.max(0, ast.expression.lastIndexOf(part));
        end = start + part.length;
    }
    return bindingParser.parseBinding(ast.expression.slice(start, end), false, ast.sourceSpan, ast.sourceSpan.start.offset + start);
}
/** Parses the parameter of a conditional block (`if` or `else if`). */
function parseConditionalBlockParameters(block, errors, bindingParser) {
    if (block.parameters.length === 0) {
        errors.push(new ParseError(block.sourceSpan, 'Conditional block does not have an expression'));
        return null;
    }
    const isPrimaryIfBlock = block.name === 'if';
    const expression = 
    // Expressions for `{:else if}` blocks start at 2 to skip the `if` from the expression.
    parseBlockParameterToBinding(block.parameters[0], bindingParser, isPrimaryIfBlock ? 0 : 2);
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
        else if (!isPrimaryIfBlock) {
            errors.push(new ParseError(param.sourceSpan, '"as" expression is only allowed on the primary "if" block'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBa0IsTUFBTSxlQUFlLENBQUM7QUFHMUQsT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVLENBQUM7QUFFOUIsc0RBQXNEO0FBQ3RELE1BQU0sMkJBQTJCLEdBQUcsa0NBQWtDLENBQUM7QUFFdkUsK0RBQStEO0FBQy9ELE1BQU0sc0JBQXNCLEdBQUcsZUFBZSxDQUFDO0FBRS9DLDhEQUE4RDtBQUM5RCxNQUFNLHlCQUF5QixHQUFHLFlBQVksQ0FBQztBQUUvQyxtREFBbUQ7QUFDbkQsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDO0FBRWhDLGtEQUFrRDtBQUNsRCxNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQztBQUUzQyw4RkFBOEY7QUFDOUYsTUFBTSw4QkFBOEIsR0FDaEMsSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFFdEUsd0RBQXdEO0FBQ3hELE1BQU0sVUFBVSxhQUFhLENBQ3pCLEdBQW9CLEVBQUUsT0FBcUIsRUFDM0MsYUFBNEI7SUFDOUIsTUFBTSxNQUFNLEdBQWlCLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNsRCxNQUFNLFFBQVEsR0FBc0IsRUFBRSxDQUFDO0lBRXZDLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDckIsT0FBTyxFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7S0FDN0I7SUFF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SUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFO1lBQ2hCLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDUixVQUFVLEVBQUUsQ0FBQztZQUNiLElBQUksVUFBVSxLQUFLLENBQUMsRUFBRTtnQkFDcEIsTUFBTTthQUNQO1NBQ0Y7YUFBTSxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEMsU0FBUztTQUNWO2FBQU07WUFDTCxNQUFNO1NBQ1A7S0FDRjtJQUVELElBQUksVUFBVSxLQUFLLENBQUMsRUFBRTtRQUNwQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsb0NBQW9DLENBQUMsQ0FBQyxDQUFDO1FBQ3BGLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxPQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBU1RXaXRoU291cmNlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcblxuaW1wb3J0ICogYXMgdCBmcm9tICcuL3IzX2FzdCc7XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgZXhwcmVzc2lvbiBpbiBhIGZvciBsb29wIGJsb2NrLiAqL1xuY29uc3QgRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOID0gL15cXHMqKFswLTlBLVphLXpfJF0qKVxccytvZlxccysoLiopLztcblxuLyoqIFBhdHRlcm4gZm9yIHRoZSB0cmFja2luZyBleHByZXNzaW9uIGluIGEgZm9yIGxvb3AgYmxvY2suICovXG5jb25zdCBGT1JfTE9PUF9UUkFDS19QQVRURVJOID0gL150cmFja1xccysoLiopLztcblxuLyoqIFBhdHRlcm4gZm9yIHRoZSBgYXNgIGV4cHJlc3Npb24gaW4gYSBjb25kaXRpb25hbCBibG9jay4gKi9cbmNvbnN0IENPTkRJVElPTkFMX0FMSUFTX1BBVFRFUk4gPSAvXmFzXFxzKyguKikvO1xuXG4vKiogUGF0dGVybiB1c2VkIHRvIGlkZW50aWZ5IGFuIGBlbHNlIGlmYCBibG9jay4gKi9cbmNvbnN0IEVMU0VfSUZfUEFUVEVSTiA9IC9eaWZcXHMvO1xuXG4vKiogUGF0dGVybiB1c2VkIHRvIGlkZW50aWZ5IGEgYGxldGAgcGFyYW1ldGVyLiAqL1xuY29uc3QgRk9SX0xPT1BfTEVUX1BBVFRFUk4gPSAvXmxldFxccysoLiopLztcblxuLyoqIE5hbWVzIG9mIHZhcmlhYmxlcyB0aGF0IGFyZSBhbGxvd2VkIHRvIGJlIHVzZWQgaW4gdGhlIGBsZXRgIGV4cHJlc3Npb24gb2YgYSBgZm9yYCBsb29wLiAqL1xuY29uc3QgQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTID1cbiAgICBuZXcgU2V0KFsnJGluZGV4JywgJyRmaXJzdCcsICckbGFzdCcsICckZXZlbicsICckb2RkJywgJyRjb3VudCddKTtcblxuLyoqIENyZWF0ZXMgYW4gYGlmYCBsb29wIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJZkJsb2NrKFxuICAgIGFzdDogaHRtbC5CbG9ja0dyb3VwLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LklmQmxvY2t8bnVsbCwgZXJyb3JzOiBQYXJzZUVycm9yW119IHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSB2YWxpZGF0ZUlmQmxvY2soYXN0KTtcbiAgY29uc3QgYnJhbmNoZXM6IHQuSWZCbG9ja0JyYW5jaFtdID0gW107XG5cbiAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtub2RlOiBudWxsLCBlcnJvcnN9O1xuICB9XG5cbiAgLy8gQXNzdW1lcyB0aGF0IHRoZSBzdHJ1Y3R1cmUgaXMgdmFsaWQgc2luY2Ugd2UgdmFsaWRhdGVkIGl0IGFib3ZlLlxuICBmb3IgKGNvbnN0IGJsb2NrIG9mIGFzdC5ibG9ja3MpIHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IGh0bWwudmlzaXRBbGwodmlzaXRvciwgYmxvY2suY2hpbGRyZW4pO1xuXG4gICAgLy8gYHs6ZWxzZX1gIGJsb2NrLlxuICAgIGlmIChibG9jay5uYW1lID09PSAnZWxzZScgJiYgYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGJyYW5jaGVzLnB1c2goXG4gICAgICAgICAgbmV3IHQuSWZCbG9ja0JyYW5jaChudWxsLCBjaGlsZHJlbiwgbnVsbCwgYmxvY2suc291cmNlU3BhbiwgYmxvY2suc3RhcnRTb3VyY2VTcGFuKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKGJsb2NrLCBlcnJvcnMsIGJpbmRpbmdQYXJzZXIpO1xuXG4gICAgaWYgKHBhcmFtcyAhPT0gbnVsbCkge1xuICAgICAgYnJhbmNoZXMucHVzaChuZXcgdC5JZkJsb2NrQnJhbmNoKFxuICAgICAgICAgIHBhcmFtcy5leHByZXNzaW9uLCBjaGlsZHJlbiwgcGFyYW1zLmV4cHJlc3Npb25BbGlhcywgYmxvY2suc291cmNlU3BhbixcbiAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5vZGU6IG5ldyB0LklmQmxvY2soYnJhbmNoZXMsIGFzdC5zb3VyY2VTcGFuLCBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3BhbiksXG4gICAgZXJyb3JzLFxuICB9O1xufVxuXG4vKiogQ3JlYXRlcyBhIGBmb3JgIGxvb3AgYmxvY2sgZnJvbSBhbiBIVE1MIEFTVCBub2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZvckxvb3AoXG4gICAgYXN0OiBodG1sLkJsb2NrR3JvdXAsIHZpc2l0b3I6IGh0bWwuVmlzaXRvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge25vZGU6IHQuRm9yTG9vcEJsb2NrfG51bGwsIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IFtwcmltYXJ5QmxvY2ssIC4uLnNlY29uZGFyeUJsb2Nrc10gPSBhc3QuYmxvY2tzO1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBjb25zdCBwYXJhbXMgPSBwYXJzZUZvckxvb3BQYXJhbWV0ZXJzKHByaW1hcnlCbG9jaywgZXJyb3JzLCBiaW5kaW5nUGFyc2VyKTtcbiAgbGV0IG5vZGU6IHQuRm9yTG9vcEJsb2NrfG51bGwgPSBudWxsO1xuICBsZXQgZW1wdHk6IHQuRm9yTG9vcEJsb2NrRW1wdHl8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBibG9jayBvZiBzZWNvbmRhcnlCbG9ja3MpIHtcbiAgICBpZiAoYmxvY2submFtZSA9PT0gJ2VtcHR5Jykge1xuICAgICAgaWYgKGVtcHR5ICE9PSBudWxsKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdGb3IgbG9vcCBjYW4gb25seSBoYXZlIG9uZSBcImVtcHR5XCIgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRW1wdHkgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVtcHR5ID0gbmV3IHQuRm9yTG9vcEJsb2NrRW1wdHkoXG4gICAgICAgICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuKSwgYmxvY2suc291cmNlU3BhbiwgYmxvY2suc3RhcnRTb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBsb29wIGJsb2NrIFwiJHtibG9jay5uYW1lfVwiYCkpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChwYXJhbXMgIT09IG51bGwpIHtcbiAgICBpZiAocGFyYW1zLnRyYWNrQnkgPT09IG51bGwpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGFzdC5zb3VyY2VTcGFuLCAnRm9yIGxvb3AgbXVzdCBoYXZlIGEgXCJ0cmFja1wiIGV4cHJlc3Npb24nKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUgPSBuZXcgdC5Gb3JMb29wQmxvY2soXG4gICAgICAgICAgcGFyYW1zLml0ZW1OYW1lLCBwYXJhbXMuZXhwcmVzc2lvbiwgcGFyYW1zLnRyYWNrQnksIHBhcmFtcy5jb250ZXh0LFxuICAgICAgICAgIGh0bWwudmlzaXRBbGwodmlzaXRvciwgcHJpbWFyeUJsb2NrLmNoaWxkcmVuKSwgZW1wdHksIGFzdC5zb3VyY2VTcGFuLCBhc3Quc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICAgIGFzdC5lbmRTb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge25vZGUsIGVycm9yc307XG59XG5cbi8qKiBDcmVhdGVzIGEgc3dpdGNoIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTd2l0Y2hCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2tHcm91cCwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5Td2l0Y2hCbG9ja3xudWxsLCBlcnJvcnM6IFBhcnNlRXJyb3JbXX0ge1xuICBjb25zdCBbcHJpbWFyeUJsb2NrLCAuLi5zZWNvbmRhcnlCbG9ja3NdID0gYXN0LmJsb2NrcztcbiAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGVTd2l0Y2hCbG9jayhhc3QpO1xuXG4gIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7bm9kZTogbnVsbCwgZXJyb3JzfTtcbiAgfVxuXG4gIGNvbnN0IHByaW1hcnlFeHByZXNzaW9uID0gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhwcmltYXJ5QmxvY2sucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcik7XG4gIGNvbnN0IGNhc2VzOiB0LlN3aXRjaEJsb2NrQ2FzZVtdID0gW107XG4gIGxldCBkZWZhdWx0Q2FzZTogdC5Td2l0Y2hCbG9ja0Nhc2V8bnVsbCA9IG51bGw7XG5cbiAgLy8gSGVyZSB3ZSBhc3N1bWUgdGhhdCBhbGwgdGhlIGJsb2NrcyBhcmUgdmFsaWQgZ2l2ZW4gdGhhdCB3ZSB2YWxpZGF0ZWQgdGhlbSBhYm92ZS5cbiAgZm9yIChjb25zdCBibG9jayBvZiBzZWNvbmRhcnlCbG9ja3MpIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gYmxvY2submFtZSA9PT0gJ2Nhc2UnID9cbiAgICAgICAgcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhibG9jay5wYXJhbWV0ZXJzWzBdLCBiaW5kaW5nUGFyc2VyKSA6XG4gICAgICAgIG51bGw7XG4gICAgY29uc3QgYXN0ID0gbmV3IHQuU3dpdGNoQmxvY2tDYXNlKFxuICAgICAgICBleHByZXNzaW9uLCBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuKSwgYmxvY2suc291cmNlU3BhbixcbiAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuKTtcblxuICAgIGlmIChleHByZXNzaW9uID09PSBudWxsKSB7XG4gICAgICBkZWZhdWx0Q2FzZSA9IGFzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FzZXMucHVzaChhc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEVuc3VyZSB0aGF0IHRoZSBkZWZhdWx0IGNhc2UgaXMgbGFzdCBpbiB0aGUgYXJyYXkuXG4gIGlmIChkZWZhdWx0Q2FzZSAhPT0gbnVsbCkge1xuICAgIGNhc2VzLnB1c2goZGVmYXVsdENhc2UpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBub2RlOiBuZXcgdC5Td2l0Y2hCbG9jayhcbiAgICAgICAgcHJpbWFyeUV4cHJlc3Npb24sIGNhc2VzLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pLFxuICAgIGVycm9yc1xuICB9O1xufVxuXG4vKiogUGFyc2VzIHRoZSBwYXJhbWV0ZXJzIG9mIGEgYGZvcmAgbG9vcCBibG9jay4gKi9cbmZ1bmN0aW9uIHBhcnNlRm9yTG9vcFBhcmFtZXRlcnMoXG4gICAgYmxvY2s6IGh0bWwuQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdGb3IgbG9vcCBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBbZXhwcmVzc2lvblBhcmFtLCAuLi5zZWNvbmRhcnlQYXJhbXNdID0gYmxvY2sucGFyYW1ldGVycztcbiAgY29uc3QgbWF0Y2ggPVxuICAgICAgc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKGV4cHJlc3Npb25QYXJhbSwgZXJyb3JzKT8ubWF0Y2goRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOKTtcblxuICBpZiAoIW1hdGNoIHx8IG1hdGNoWzJdLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4sXG4gICAgICAgICdDYW5ub3QgcGFyc2UgZXhwcmVzc2lvbi4gRm9yIGxvb3AgZXhwcmVzc2lvbiBtdXN0IG1hdGNoIHRoZSBwYXR0ZXJuIFwiPGlkZW50aWZpZXI+IG9mIDxleHByZXNzaW9uPlwiJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgWywgaXRlbU5hbWUsIHJhd0V4cHJlc3Npb25dID0gbWF0Y2g7XG4gIGNvbnN0IHJlc3VsdCA9IHtcbiAgICBpdGVtTmFtZSxcbiAgICB0cmFja0J5OiBudWxsIGFzIEFTVFdpdGhTb3VyY2UgfCBudWxsLFxuICAgIGV4cHJlc3Npb246IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoZXhwcmVzc2lvblBhcmFtLCBiaW5kaW5nUGFyc2VyLCByYXdFeHByZXNzaW9uKSxcbiAgICBjb250ZXh0OiBudWxsIGFzIHQuRm9yTG9vcEJsb2NrQ29udGV4dCB8IG51bGwsXG4gIH07XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBzZWNvbmRhcnlQYXJhbXMpIHtcbiAgICBjb25zdCBsZXRNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goRk9SX0xPT1BfTEVUX1BBVFRFUk4pO1xuXG4gICAgaWYgKGxldE1hdGNoICE9PSBudWxsKSB7XG4gICAgICByZXN1bHQuY29udGV4dCA9IHJlc3VsdC5jb250ZXh0IHx8IHt9O1xuICAgICAgcGFyc2VMZXRQYXJhbWV0ZXIocGFyYW0uc291cmNlU3BhbiwgbGV0TWF0Y2hbMV0sIHJlc3VsdC5jb250ZXh0LCBlcnJvcnMpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdHJhY2tNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goRk9SX0xPT1BfVFJBQ0tfUEFUVEVSTik7XG5cbiAgICBpZiAodHJhY2tNYXRjaCAhPT0gbnVsbCkge1xuICAgICAgaWYgKHJlc3VsdC50cmFja0J5ICE9PSBudWxsKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ0ZvciBsb29wIGNhbiBvbmx5IGhhdmUgb25lIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LnRyYWNrQnkgPSBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKHBhcmFtLCBiaW5kaW5nUGFyc2VyLCB0cmFja01hdGNoWzFdKTtcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCBgVW5yZWNvZ25pemVkIGxvb3AgcGFyYW1hdGVyIFwiJHtwYXJhbS5leHByZXNzaW9ufVwiYCkpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIFBhcnNlcyB0aGUgYGxldGAgcGFyYW1ldGVyIG9mIGEgYGZvcmAgbG9vcCBibG9jay4gKi9cbmZ1bmN0aW9uIHBhcnNlTGV0UGFyYW1ldGVyKFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgZXhwcmVzc2lvbjogc3RyaW5nLCBjb250ZXh0OiB0LkZvckxvb3BCbG9ja0NvbnRleHQsXG4gICAgZXJyb3JzOiBQYXJzZUVycm9yW10pOiB2b2lkIHtcbiAgY29uc3QgcGFydHMgPSBleHByZXNzaW9uLnNwbGl0KCcsJyk7XG5cbiAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgY29uc3QgZXhwcmVzc2lvblBhcnRzID0gcGFydC5zcGxpdCgnPScpO1xuICAgIGNvbnN0IG5hbWUgPSBleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyID8gZXhwcmVzc2lvblBhcnRzWzBdLnRyaW0oKSA6ICcnO1xuICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IGV4cHJlc3Npb25QYXJ0cy5sZW5ndGggPT09IDIgPyBleHByZXNzaW9uUGFydHNbMV0udHJpbSgpIDogJyc7XG5cbiAgICBpZiAobmFtZS5sZW5ndGggPT09IDAgfHwgdmFyaWFibGVOYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICBgSW52YWxpZCBmb3IgbG9vcCBcImxldFwiIHBhcmFtZXRlci4gUGFyYW1ldGVyIHNob3VsZCBtYXRjaCB0aGUgcGF0dGVybiBcIjxuYW1lPiA9IDx2YXJpYWJsZSBuYW1lPlwiYCkpO1xuICAgIH0gZWxzZSBpZiAoIUFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUy5oYXModmFyaWFibGVOYW1lKSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICBgVW5rbm93biBcImxldFwiIHBhcmFtZXRlciB2YXJpYWJsZSBcIiR7dmFyaWFibGVOYW1lfVwiLiBUaGUgYWxsb3dlZCB2YXJpYWJsZXMgYXJlOiAke1xuICAgICAgICAgICAgICBBcnJheS5mcm9tKEFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUykuam9pbignLCAnKX1gKSk7XG4gICAgfSBlbHNlIGlmIChjb250ZXh0Lmhhc093blByb3BlcnR5KHZhcmlhYmxlTmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIGBEdXBsaWNhdGUgXCJsZXRcIiBwYXJhbWV0ZXIgdmFyaWFibGUgXCIke3ZhcmlhYmxlTmFtZX1cImApKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dFt2YXJpYWJsZU5hbWUgYXMga2V5b2YgdC5Gb3JMb29wQmxvY2tDb250ZXh0XSA9IG5hbWU7XG4gICAgfVxuICB9XG59XG5cbi8qKiBDaGVja3MgdGhhdCB0aGUgc2hhcGUgb2YgYSBgaWZgIGJsb2NrIGlzIHZhbGlkLiBSZXR1cm5zIGFuIGFycmF5IG9mIGVycm9ycy4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlSWZCbG9jayhhc3Q6IGh0bWwuQmxvY2tHcm91cCk6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGxldCBoYXNFbHNlID0gZmFsc2U7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3QuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYmxvY2sgPSBhc3QuYmxvY2tzW2ldO1xuXG4gICAgLy8gQ29uZGl0aW9uYWwgYmxvY2tzIG9ubHkgYWxsb3cgYGlmYCwgYGVsc2UgaWZgIGFuZCBgZWxzZWAgYmxvY2tzLlxuICAgIGlmICgoYmxvY2submFtZSAhPT0gJ2lmJyB8fCBpID4gMCkgJiYgYmxvY2submFtZSAhPT0gJ2Vsc2UnKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICBuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCBgVW5yZWNvZ25pemVkIGNvbmRpdGlvbmFsIGJsb2NrIFwiJHtibG9jay5uYW1lfVwiYCkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdpZicpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKGhhc0Vsc2UpIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0NvbmRpdGlvbmFsIGNhbiBvbmx5IGhhdmUgb25lIFwiZWxzZVwiIGJsb2NrJykpO1xuICAgICAgfSBlbHNlIGlmIChhc3QuYmxvY2tzLmxlbmd0aCA+IDEgJiYgaSA8IGFzdC5ibG9ja3MubGVuZ3RoIC0gMSkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdFbHNlIGJsb2NrIG11c3QgYmUgbGFzdCBpbnNpZGUgdGhlIGNvbmRpdGlvbmFsJykpO1xuICAgICAgfVxuICAgICAgaGFzRWxzZSA9IHRydWU7XG5cbiAgICAgIC8vIGBlbHNlIGlmYCBpcyBhbiBlZGdlIGNhc2UsIGJlY2F1c2UgaXQgaGFzIGEgc3BhY2UgYWZ0ZXIgdGhlIGJsb2NrIG5hbWVcbiAgICAgIC8vIHdoaWNoIG1lYW5zIHRoYXQgdGhlIGBpZmAgaXMgY2FwdHVyZWQgYXMgYSBwYXJ0IG9mIHRoZSBwYXJhbWV0ZXJzLlxuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCAmJiAhRUxTRV9JRl9QQVRURVJOLnRlc3QoYmxvY2sucGFyYW1ldGVyc1swXS5leHByZXNzaW9uKSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0Vsc2UgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXJyb3JzO1xufVxuXG4vKiogQ2hlY2tzIHRoYXQgdGhlIHNoYXBlIG9mIGEgYHN3aXRjaGAgYmxvY2sgaXMgdmFsaWQuIFJldHVybnMgYW4gYXJyYXkgb2YgZXJyb3JzLiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVTd2l0Y2hCbG9jayhhc3Q6IGh0bWwuQmxvY2tHcm91cCk6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IFtwcmltYXJ5QmxvY2ssIC4uLnNlY29uZGFyeUJsb2Nrc10gPSBhc3QuYmxvY2tzO1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBsZXQgaGFzRGVmYXVsdCA9IGZhbHNlO1xuXG4gIGlmIChwcmltYXJ5QmxvY2suY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICBwcmltYXJ5QmxvY2suc291cmNlU3BhbiwgJ1N3aXRjaCBibG9jayBjYW4gb25seSBjb250YWluIFwiY2FzZVwiIGFuZCBcImRlZmF1bHRcIiBibG9ja3MnKSk7XG4gIH1cblxuICBpZiAocHJpbWFyeUJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgZXJyb3JzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZUVycm9yKHByaW1hcnlCbG9jay5zb3VyY2VTcGFuLCAnU3dpdGNoIGJsb2NrIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbWV0ZXInKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGJsb2NrIG9mIHNlY29uZGFyeUJsb2Nrcykge1xuICAgIGlmIChibG9jay5uYW1lID09PSAnY2FzZScpIHtcbiAgICAgIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQ2FzZSBibG9jayBtdXN0IGhhdmUgZXhhY3RseSBvbmUgcGFyYW1ldGVyJykpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYmxvY2submFtZSA9PT0gJ2RlZmF1bHQnKSB7XG4gICAgICBpZiAoaGFzRGVmYXVsdCkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdTd2l0Y2ggYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJkZWZhdWx0XCIgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRGVmYXVsdCBibG9jayBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzJykpO1xuICAgICAgfVxuICAgICAgaGFzRGVmYXVsdCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIGJsb2NrLnNvdXJjZVNwYW4sICdTd2l0Y2ggYmxvY2sgY2FuIG9ubHkgY29udGFpbiBcImNhc2VcIiBhbmQgXCJkZWZhdWx0XCIgYmxvY2tzJykpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBlcnJvcnM7XG59XG5cbi8qKlxuICogUGFyc2VzIGEgYmxvY2sgcGFyYW1ldGVyIGludG8gYSBiaW5kaW5nIEFTVC5cbiAqIEBwYXJhbSBhc3QgQmxvY2sgcGFyYW1ldGVyIHRoYXQgc2hvdWxkIGJlIHBhcnNlZC5cbiAqIEBwYXJhbSBiaW5kaW5nUGFyc2VyIFBhcnNlciB0aGF0IHRoZSBleHByZXNzaW9uIHNob3VsZCBiZSBwYXJzZWQgd2l0aC5cbiAqIEBwYXJhbSBzdGFydCBJbmRleCBmcm9tIHdoaWNoIHRvIHN0YXJ0IHRoZSBwYXJzaW5nLiBEZWZhdWx0cyB0byAwLlxuICovXG5mdW5jdGlvbiBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKFxuICAgIGFzdDogaHRtbC5CbG9ja1BhcmFtZXRlciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgc3RhcnQ/OiBudW1iZXIpOiBBU1RXaXRoU291cmNlO1xuXG4vKipcbiAqIFBhcnNlcyBhIGJsb2NrIHBhcmFtZXRlciBpbnRvIGEgYmluZGluZyBBU1QuXG4gKiBAcGFyYW0gYXN0IEJsb2NrIHBhcmFtZXRlciB0aGF0IHNob3VsZCBiZSBwYXJzZWQuXG4gKiBAcGFyYW0gYmluZGluZ1BhcnNlciBQYXJzZXIgdGhhdCB0aGUgZXhwcmVzc2lvbiBzaG91bGQgYmUgcGFyc2VkIHdpdGguXG4gKiBAcGFyYW0gcGFydCBTcGVjaWZpYyBwYXJ0IG9mIHRoZSBleHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHBhcnNlZC5cbiAqL1xuZnVuY3Rpb24gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhcbiAgICBhc3Q6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIHBhcnQ6IHN0cmluZyk6IEFTVFdpdGhTb3VyY2U7XG5cbmZ1bmN0aW9uIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoXG4gICAgYXN0OiBodG1sLkJsb2NrUGFyYW1ldGVyLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLFxuICAgIHBhcnQ6IHN0cmluZ3xudW1iZXIgPSAwKTogQVNUV2l0aFNvdXJjZSB7XG4gIGxldCBzdGFydDogbnVtYmVyO1xuICBsZXQgZW5kOiBudW1iZXI7XG5cbiAgaWYgKHR5cGVvZiBwYXJ0ID09PSAnbnVtYmVyJykge1xuICAgIHN0YXJ0ID0gcGFydDtcbiAgICBlbmQgPSBhc3QuZXhwcmVzc2lvbi5sZW5ndGg7XG4gIH0gZWxzZSB7XG4gICAgLy8gTm90ZTogYGxhc3RJbmRleE9mYCBoZXJlIHNob3VsZCBiZSBlbm91Z2ggdG8ga25vdyB0aGUgc3RhcnQgaW5kZXggb2YgdGhlIGV4cHJlc3Npb24sXG4gICAgLy8gYmVjYXVzZSB3ZSBrbm93IHRoYXQgaXQnbGwgYmUgYXQgdGhlIGVuZCBvZiB0aGUgcGFyYW0uIElkZWFsbHkgd2UgY291bGQgdXNlIHRoZSBgZGBcbiAgICAvLyBmbGFnIHdoZW4gbWF0Y2hpbmcgdmlhIHJlZ2V4IGFuZCBnZXQgdGhlIGluZGV4IGZyb20gYG1hdGNoLmluZGljZXNgLCBidXQgaXQncyB1bmNsZWFyXG4gICAgLy8gaWYgd2UgY2FuIHVzZSBpdCB5ZXQgc2luY2UgaXQncyBhIHJlbGF0aXZlbHkgbmV3IGZlYXR1cmUuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdGMzOS9wcm9wb3NhbC1yZWdleHAtbWF0Y2gtaW5kaWNlc1xuICAgIHN0YXJ0ID0gTWF0aC5tYXgoMCwgYXN0LmV4cHJlc3Npb24ubGFzdEluZGV4T2YocGFydCkpO1xuICAgIGVuZCA9IHN0YXJ0ICsgcGFydC5sZW5ndGg7XG4gIH1cblxuICByZXR1cm4gYmluZGluZ1BhcnNlci5wYXJzZUJpbmRpbmcoXG4gICAgICBhc3QuZXhwcmVzc2lvbi5zbGljZShzdGFydCwgZW5kKSwgZmFsc2UsIGFzdC5zb3VyY2VTcGFuLCBhc3Quc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBzdGFydCk7XG59XG5cbi8qKiBQYXJzZXMgdGhlIHBhcmFtZXRlciBvZiBhIGNvbmRpdGlvbmFsIGJsb2NrIChgaWZgIG9yIGBlbHNlIGlmYCkuICovXG5mdW5jdGlvbiBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKFxuICAgIGJsb2NrOiBodG1sLkJsb2NrLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge1xuICBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQ29uZGl0aW9uYWwgYmxvY2sgZG9lcyBub3QgaGF2ZSBhbiBleHByZXNzaW9uJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgaXNQcmltYXJ5SWZCbG9jayA9IGJsb2NrLm5hbWUgPT09ICdpZic7XG4gIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgLy8gRXhwcmVzc2lvbnMgZm9yIGB7OmVsc2UgaWZ9YCBibG9ja3Mgc3RhcnQgYXQgMiB0byBza2lwIHRoZSBgaWZgIGZyb20gdGhlIGV4cHJlc3Npb24uXG4gICAgICBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKGJsb2NrLnBhcmFtZXRlcnNbMF0sIGJpbmRpbmdQYXJzZXIsIGlzUHJpbWFyeUlmQmxvY2sgPyAwIDogMik7XG4gIGxldCBleHByZXNzaW9uQWxpYXM6IHN0cmluZ3xudWxsID0gbnVsbDtcblxuICAvLyBTdGFydCBmcm9tIDEgc2luY2Ugd2UgcHJvY2Vzc2VkIHRoZSBmaXJzdCBwYXJhbWV0ZXIgYWxyZWFkeS5cbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBibG9jay5wYXJhbWV0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcGFyYW0gPSBibG9jay5wYXJhbWV0ZXJzW2ldO1xuICAgIGNvbnN0IGFsaWFzTWF0Y2ggPSBwYXJhbS5leHByZXNzaW9uLm1hdGNoKENPTkRJVElPTkFMX0FMSUFTX1BBVFRFUk4pO1xuXG4gICAgLy8gRm9yIG5vdyBjb25kaXRpb25hbHMgY2FuIG9ubHkgaGF2ZSBhbiBgYXNgIHBhcmFtZXRlci5cbiAgICAvLyBXZSBtYXkgd2FudCB0byByZXdvcmsgdGhpcyBsYXRlciBpZiB3ZSBhZGQgbW9yZS5cbiAgICBpZiAoYWxpYXNNYXRjaCA9PT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgcGFyYW0uc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBjb25kaXRpb25hbCBwYXJhbWF0ZXIgXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKSk7XG4gICAgfSBlbHNlIGlmICghaXNQcmltYXJ5SWZCbG9jaykge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgcGFyYW0uc291cmNlU3BhbiwgJ1wiYXNcIiBleHByZXNzaW9uIGlzIG9ubHkgYWxsb3dlZCBvbiB0aGUgcHJpbWFyeSBcImlmXCIgYmxvY2snKSk7XG4gICAgfSBlbHNlIGlmIChleHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBjYW4gb25seSBoYXZlIG9uZSBcImFzXCIgZXhwcmVzc2lvbicpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwcmVzc2lvbkFsaWFzID0gYWxpYXNNYXRjaFsxXS50cmltKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCBleHByZXNzaW9uQWxpYXN9O1xufVxuXG4vKiogU3RyaXBzIG9wdGlvbmFsIHBhcmVudGhlc2VzIGFyb3VuZCBmcm9tIGEgY29udHJvbCBmcm9tIGV4cHJlc3Npb24gcGFyYW1ldGVyLiAqL1xuZnVuY3Rpb24gc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKHBhcmFtOiBodG1sLkJsb2NrUGFyYW1ldGVyLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSk6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgZXhwcmVzc2lvbiA9IHBhcmFtLmV4cHJlc3Npb247XG4gIGNvbnN0IHNwYWNlUmVnZXggPSAvXlxccyQvO1xuICBsZXQgb3BlblBhcmVucyA9IDA7XG4gIGxldCBzdGFydCA9IDA7XG4gIGxldCBlbmQgPSBleHByZXNzaW9uLmxlbmd0aCAtIDE7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByZXNzaW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhciA9IGV4cHJlc3Npb25baV07XG5cbiAgICBpZiAoY2hhciA9PT0gJygnKSB7XG4gICAgICBzdGFydCA9IGkgKyAxO1xuICAgICAgb3BlblBhcmVucysrO1xuICAgIH0gZWxzZSBpZiAoc3BhY2VSZWdleC50ZXN0KGNoYXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wZW5QYXJlbnMgPT09IDApIHtcbiAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSBleHByZXNzaW9uLmxlbmd0aCAtIDE7IGkgPiAtMTsgaS0tKSB7XG4gICAgY29uc3QgY2hhciA9IGV4cHJlc3Npb25baV07XG5cbiAgICBpZiAoY2hhciA9PT0gJyknKSB7XG4gICAgICBlbmQgPSBpO1xuICAgICAgb3BlblBhcmVucy0tO1xuICAgICAgaWYgKG9wZW5QYXJlbnMgPT09IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzcGFjZVJlZ2V4LnRlc3QoY2hhcikpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAob3BlblBhcmVucyAhPT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdVbmNsb3NlZCBwYXJlbnRoZXNlcyBpbiBleHByZXNzaW9uJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIGV4cHJlc3Npb24uc2xpY2Uoc3RhcnQsIGVuZCk7XG59XG4iXX0=