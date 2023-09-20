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
                errors.push(new ParseError(param.sourceSpan, 'For loop can only have one "track" expression'));
            }
            else {
                result.trackBy = parseBlockParameterToBinding(param, bindingParser, trackMatch[1]);
            }
            continue;
        }
        errors.push(new ParseError(param.sourceSpan, `Unrecognized loop paramater "${param.expression}"`));
    }
    // Fill out any variables that haven't been defined explicitly.
    for (const variableName of ALLOWED_FOR_LOOP_LET_VARIABLES) {
        if (!result.context.hasOwnProperty(variableName)) {
            result.context[variableName] =
                new t.Variable(variableName, variableName, block.startSourceSpan, block.startSourceSpan);
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
            errors.push(new ParseError(sourceSpan, `Invalid for loop "let" parameter. Parameter should match the pattern "<name> = <variable name>"`));
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
    const hasPrimary = primaryBlock.children.length > 0 && primaryBlock.children.some(child => {
        // The main block might have empty text nodes if `preserveWhitespaces` is enabled.
        // Allow them since they might be used for code formatting.
        return !(child instanceof html.Text) || child.value.trim().length > 0;
    });
    if (hasPrimary) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBa0IsTUFBTSxlQUFlLENBQUM7QUFHMUQsT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVLENBQUM7QUFFOUIsc0RBQXNEO0FBQ3RELE1BQU0sMkJBQTJCLEdBQUcsa0NBQWtDLENBQUM7QUFFdkUsK0RBQStEO0FBQy9ELE1BQU0sc0JBQXNCLEdBQUcsZUFBZSxDQUFDO0FBRS9DLDhEQUE4RDtBQUM5RCxNQUFNLHlCQUF5QixHQUFHLFlBQVksQ0FBQztBQUUvQyxtREFBbUQ7QUFDbkQsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDO0FBRWhDLGtEQUFrRDtBQUNsRCxNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQztBQUUzQyw4RkFBOEY7QUFDOUYsTUFBTSw4QkFBOEIsR0FDaEMsSUFBSSxHQUFHLENBQThCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBRW5HLHdEQUF3RDtBQUN4RCxNQUFNLFVBQVUsYUFBYSxDQUN6QixHQUFvQixFQUFFLE9BQXFCLEVBQzNDLGFBQTRCO0lBQzlCLE1BQU0sTUFBTSxHQUFpQixlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbEQsTUFBTSxRQUFRLEdBQXNCLEVBQUUsQ0FBQztJQUV2QyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3JCLE9BQU8sRUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDO0tBQzdCO0lB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QUFFO1lBQ2hDLFNBQVM7U0FDVjthQUFNO1lBQ0wsTUFBTTtTQUNQO0tBQ0Y7SUFFRCxJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUU7UUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLG9DQUFvQyxDQUFDLENBQUMsQ0FBQztRQUNwRixPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN0QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNUV2l0aFNvdXJjZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5cbmltcG9ydCAqIGFzIHQgZnJvbSAnLi9yM19hc3QnO1xuXG4vKiogUGF0dGVybiBmb3IgdGhlIGV4cHJlc3Npb24gaW4gYSBmb3IgbG9vcCBibG9jay4gKi9cbmNvbnN0IEZPUl9MT09QX0VYUFJFU1NJT05fUEFUVEVSTiA9IC9eXFxzKihbMC05QS1aYS16XyRdKilcXHMrb2ZcXHMrKC4qKS87XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgdHJhY2tpbmcgZXhwcmVzc2lvbiBpbiBhIGZvciBsb29wIGJsb2NrLiAqL1xuY29uc3QgRk9SX0xPT1BfVFJBQ0tfUEFUVEVSTiA9IC9edHJhY2tcXHMrKC4qKS87XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgYGFzYCBleHByZXNzaW9uIGluIGEgY29uZGl0aW9uYWwgYmxvY2suICovXG5jb25zdCBDT05ESVRJT05BTF9BTElBU19QQVRURVJOID0gL15hc1xccysoLiopLztcblxuLyoqIFBhdHRlcm4gdXNlZCB0byBpZGVudGlmeSBhbiBgZWxzZSBpZmAgYmxvY2suICovXG5jb25zdCBFTFNFX0lGX1BBVFRFUk4gPSAvXmlmXFxzLztcblxuLyoqIFBhdHRlcm4gdXNlZCB0byBpZGVudGlmeSBhIGBsZXRgIHBhcmFtZXRlci4gKi9cbmNvbnN0IEZPUl9MT09QX0xFVF9QQVRURVJOID0gL15sZXRcXHMrKC4qKS87XG5cbi8qKiBOYW1lcyBvZiB2YXJpYWJsZXMgdGhhdCBhcmUgYWxsb3dlZCB0byBiZSB1c2VkIGluIHRoZSBgbGV0YCBleHByZXNzaW9uIG9mIGEgYGZvcmAgbG9vcC4gKi9cbmNvbnN0IEFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUyA9XG4gICAgbmV3IFNldDxrZXlvZiB0LkZvckxvb3BCbG9ja0NvbnRleHQ+KFsnJGluZGV4JywgJyRmaXJzdCcsICckbGFzdCcsICckZXZlbicsICckb2RkJywgJyRjb3VudCddKTtcblxuLyoqIENyZWF0ZXMgYW4gYGlmYCBsb29wIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJZkJsb2NrKFxuICAgIGFzdDogaHRtbC5CbG9ja0dyb3VwLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LklmQmxvY2t8bnVsbCwgZXJyb3JzOiBQYXJzZUVycm9yW119IHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSB2YWxpZGF0ZUlmQmxvY2soYXN0KTtcbiAgY29uc3QgYnJhbmNoZXM6IHQuSWZCbG9ja0JyYW5jaFtdID0gW107XG5cbiAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtub2RlOiBudWxsLCBlcnJvcnN9O1xuICB9XG5cbiAgLy8gQXNzdW1lcyB0aGF0IHRoZSBzdHJ1Y3R1cmUgaXMgdmFsaWQgc2luY2Ugd2UgdmFsaWRhdGVkIGl0IGFib3ZlLlxuICBmb3IgKGNvbnN0IGJsb2NrIG9mIGFzdC5ibG9ja3MpIHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IGh0bWwudmlzaXRBbGwodmlzaXRvciwgYmxvY2suY2hpbGRyZW4pO1xuXG4gICAgLy8gYHs6ZWxzZX1gIGJsb2NrLlxuICAgIGlmIChibG9jay5uYW1lID09PSAnZWxzZScgJiYgYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGJyYW5jaGVzLnB1c2goXG4gICAgICAgICAgbmV3IHQuSWZCbG9ja0JyYW5jaChudWxsLCBjaGlsZHJlbiwgbnVsbCwgYmxvY2suc291cmNlU3BhbiwgYmxvY2suc3RhcnRTb3VyY2VTcGFuKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKGJsb2NrLCBlcnJvcnMsIGJpbmRpbmdQYXJzZXIpO1xuXG4gICAgaWYgKHBhcmFtcyAhPT0gbnVsbCkge1xuICAgICAgYnJhbmNoZXMucHVzaChuZXcgdC5JZkJsb2NrQnJhbmNoKFxuICAgICAgICAgIHBhcmFtcy5leHByZXNzaW9uLCBjaGlsZHJlbiwgcGFyYW1zLmV4cHJlc3Npb25BbGlhcywgYmxvY2suc291cmNlU3BhbixcbiAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4pKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5vZGU6IG5ldyB0LklmQmxvY2soYnJhbmNoZXMsIGFzdC5zb3VyY2VTcGFuLCBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3BhbiksXG4gICAgZXJyb3JzLFxuICB9O1xufVxuXG4vKiogQ3JlYXRlcyBhIGBmb3JgIGxvb3AgYmxvY2sgZnJvbSBhbiBIVE1MIEFTVCBub2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZvckxvb3AoXG4gICAgYXN0OiBodG1sLkJsb2NrR3JvdXAsIHZpc2l0b3I6IGh0bWwuVmlzaXRvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge25vZGU6IHQuRm9yTG9vcEJsb2NrfG51bGwsIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IFtwcmltYXJ5QmxvY2ssIC4uLnNlY29uZGFyeUJsb2Nrc10gPSBhc3QuYmxvY2tzO1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBjb25zdCBwYXJhbXMgPSBwYXJzZUZvckxvb3BQYXJhbWV0ZXJzKHByaW1hcnlCbG9jaywgZXJyb3JzLCBiaW5kaW5nUGFyc2VyKTtcbiAgbGV0IG5vZGU6IHQuRm9yTG9vcEJsb2NrfG51bGwgPSBudWxsO1xuICBsZXQgZW1wdHk6IHQuRm9yTG9vcEJsb2NrRW1wdHl8bnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBibG9jayBvZiBzZWNvbmRhcnlCbG9ja3MpIHtcbiAgICBpZiAoYmxvY2submFtZSA9PT0gJ2VtcHR5Jykge1xuICAgICAgaWYgKGVtcHR5ICE9PSBudWxsKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdGb3IgbG9vcCBjYW4gb25seSBoYXZlIG9uZSBcImVtcHR5XCIgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRW1wdHkgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVtcHR5ID0gbmV3IHQuRm9yTG9vcEJsb2NrRW1wdHkoXG4gICAgICAgICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuKSwgYmxvY2suc291cmNlU3BhbiwgYmxvY2suc3RhcnRTb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBsb29wIGJsb2NrIFwiJHtibG9jay5uYW1lfVwiYCkpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChwYXJhbXMgIT09IG51bGwpIHtcbiAgICBpZiAocGFyYW1zLnRyYWNrQnkgPT09IG51bGwpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGFzdC5zb3VyY2VTcGFuLCAnRm9yIGxvb3AgbXVzdCBoYXZlIGEgXCJ0cmFja1wiIGV4cHJlc3Npb24nKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUgPSBuZXcgdC5Gb3JMb29wQmxvY2soXG4gICAgICAgICAgcGFyYW1zLml0ZW1OYW1lLCBwYXJhbXMuZXhwcmVzc2lvbiwgcGFyYW1zLnRyYWNrQnksIHBhcmFtcy5jb250ZXh0LFxuICAgICAgICAgIGh0bWwudmlzaXRBbGwodmlzaXRvciwgcHJpbWFyeUJsb2NrLmNoaWxkcmVuKSwgZW1wdHksIGFzdC5zb3VyY2VTcGFuLCBhc3Quc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICAgIGFzdC5lbmRTb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge25vZGUsIGVycm9yc307XG59XG5cbi8qKiBDcmVhdGVzIGEgc3dpdGNoIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTd2l0Y2hCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2tHcm91cCwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5Td2l0Y2hCbG9ja3xudWxsLCBlcnJvcnM6IFBhcnNlRXJyb3JbXX0ge1xuICBjb25zdCBbcHJpbWFyeUJsb2NrLCAuLi5zZWNvbmRhcnlCbG9ja3NdID0gYXN0LmJsb2NrcztcbiAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGVTd2l0Y2hCbG9jayhhc3QpO1xuXG4gIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7bm9kZTogbnVsbCwgZXJyb3JzfTtcbiAgfVxuXG4gIGNvbnN0IHByaW1hcnlFeHByZXNzaW9uID0gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhwcmltYXJ5QmxvY2sucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcik7XG4gIGNvbnN0IGNhc2VzOiB0LlN3aXRjaEJsb2NrQ2FzZVtdID0gW107XG4gIGxldCBkZWZhdWx0Q2FzZTogdC5Td2l0Y2hCbG9ja0Nhc2V8bnVsbCA9IG51bGw7XG5cbiAgLy8gSGVyZSB3ZSBhc3N1bWUgdGhhdCBhbGwgdGhlIGJsb2NrcyBhcmUgdmFsaWQgZ2l2ZW4gdGhhdCB3ZSB2YWxpZGF0ZWQgdGhlbSBhYm92ZS5cbiAgZm9yIChjb25zdCBibG9jayBvZiBzZWNvbmRhcnlCbG9ja3MpIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gYmxvY2submFtZSA9PT0gJ2Nhc2UnID9cbiAgICAgICAgcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhibG9jay5wYXJhbWV0ZXJzWzBdLCBiaW5kaW5nUGFyc2VyKSA6XG4gICAgICAgIG51bGw7XG4gICAgY29uc3QgYXN0ID0gbmV3IHQuU3dpdGNoQmxvY2tDYXNlKFxuICAgICAgICBleHByZXNzaW9uLCBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuKSwgYmxvY2suc291cmNlU3BhbixcbiAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuKTtcblxuICAgIGlmIChleHByZXNzaW9uID09PSBudWxsKSB7XG4gICAgICBkZWZhdWx0Q2FzZSA9IGFzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FzZXMucHVzaChhc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEVuc3VyZSB0aGF0IHRoZSBkZWZhdWx0IGNhc2UgaXMgbGFzdCBpbiB0aGUgYXJyYXkuXG4gIGlmIChkZWZhdWx0Q2FzZSAhPT0gbnVsbCkge1xuICAgIGNhc2VzLnB1c2goZGVmYXVsdENhc2UpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBub2RlOiBuZXcgdC5Td2l0Y2hCbG9jayhcbiAgICAgICAgcHJpbWFyeUV4cHJlc3Npb24sIGNhc2VzLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pLFxuICAgIGVycm9yc1xuICB9O1xufVxuXG4vKiogUGFyc2VzIHRoZSBwYXJhbWV0ZXJzIG9mIGEgYGZvcmAgbG9vcCBibG9jay4gKi9cbmZ1bmN0aW9uIHBhcnNlRm9yTG9vcFBhcmFtZXRlcnMoXG4gICAgYmxvY2s6IGh0bWwuQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdGb3IgbG9vcCBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBbZXhwcmVzc2lvblBhcmFtLCAuLi5zZWNvbmRhcnlQYXJhbXNdID0gYmxvY2sucGFyYW1ldGVycztcbiAgY29uc3QgbWF0Y2ggPVxuICAgICAgc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKGV4cHJlc3Npb25QYXJhbSwgZXJyb3JzKT8ubWF0Y2goRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOKTtcblxuICBpZiAoIW1hdGNoIHx8IG1hdGNoWzJdLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4sXG4gICAgICAgICdDYW5ub3QgcGFyc2UgZXhwcmVzc2lvbi4gRm9yIGxvb3AgZXhwcmVzc2lvbiBtdXN0IG1hdGNoIHRoZSBwYXR0ZXJuIFwiPGlkZW50aWZpZXI+IG9mIDxleHByZXNzaW9uPlwiJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgWywgaXRlbU5hbWUsIHJhd0V4cHJlc3Npb25dID0gbWF0Y2g7XG4gIGNvbnN0IHJlc3VsdCA9IHtcbiAgICBpdGVtTmFtZTogbmV3IHQuVmFyaWFibGUoXG4gICAgICAgIGl0ZW1OYW1lLCAnJGltcGxpY2l0JywgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4sIGV4cHJlc3Npb25QYXJhbS5zb3VyY2VTcGFuKSxcbiAgICB0cmFja0J5OiBudWxsIGFzIEFTVFdpdGhTb3VyY2UgfCBudWxsLFxuICAgIGV4cHJlc3Npb246IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoZXhwcmVzc2lvblBhcmFtLCBiaW5kaW5nUGFyc2VyLCByYXdFeHByZXNzaW9uKSxcbiAgICBjb250ZXh0OiB7fSBhcyB0LkZvckxvb3BCbG9ja0NvbnRleHQsXG4gIH07XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBzZWNvbmRhcnlQYXJhbXMpIHtcbiAgICBjb25zdCBsZXRNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goRk9SX0xPT1BfTEVUX1BBVFRFUk4pO1xuXG4gICAgaWYgKGxldE1hdGNoICE9PSBudWxsKSB7XG4gICAgICBwYXJzZUxldFBhcmFtZXRlcihwYXJhbS5zb3VyY2VTcGFuLCBsZXRNYXRjaFsxXSwgcGFyYW0uc291cmNlU3BhbiwgcmVzdWx0LmNvbnRleHQsIGVycm9ycyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0cmFja01hdGNoID0gcGFyYW0uZXhwcmVzc2lvbi5tYXRjaChGT1JfTE9PUF9UUkFDS19QQVRURVJOKTtcblxuICAgIGlmICh0cmFja01hdGNoICE9PSBudWxsKSB7XG4gICAgICBpZiAocmVzdWx0LnRyYWNrQnkgIT09IG51bGwpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnRm9yIGxvb3AgY2FuIG9ubHkgaGF2ZSBvbmUgXCJ0cmFja1wiIGV4cHJlc3Npb24nKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQudHJhY2tCeSA9IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcocGFyYW0sIGJpbmRpbmdQYXJzZXIsIHRyYWNrTWF0Y2hbMV0pO1xuICAgICAgfVxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgZXJyb3JzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgbG9vcCBwYXJhbWF0ZXIgXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKSk7XG4gIH1cblxuICAvLyBGaWxsIG91dCBhbnkgdmFyaWFibGVzIHRoYXQgaGF2ZW4ndCBiZWVuIGRlZmluZWQgZXhwbGljaXRseS5cbiAgZm9yIChjb25zdCB2YXJpYWJsZU5hbWUgb2YgQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTKSB7XG4gICAgaWYgKCFyZXN1bHQuY29udGV4dC5oYXNPd25Qcm9wZXJ0eSh2YXJpYWJsZU5hbWUpKSB7XG4gICAgICByZXN1bHQuY29udGV4dFt2YXJpYWJsZU5hbWVdID1cbiAgICAgICAgICBuZXcgdC5WYXJpYWJsZSh2YXJpYWJsZU5hbWUsIHZhcmlhYmxlTmFtZSwgYmxvY2suc3RhcnRTb3VyY2VTcGFuLCBibG9jay5zdGFydFNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKiBQYXJzZXMgdGhlIGBsZXRgIHBhcmFtZXRlciBvZiBhIGBmb3JgIGxvb3AgYmxvY2suICovXG5mdW5jdGlvbiBwYXJzZUxldFBhcmFtZXRlcihcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGV4cHJlc3Npb246IHN0cmluZywgc3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIGNvbnRleHQ6IHQuRm9yTG9vcEJsb2NrQ29udGV4dCwgZXJyb3JzOiBQYXJzZUVycm9yW10pOiB2b2lkIHtcbiAgY29uc3QgcGFydHMgPSBleHByZXNzaW9uLnNwbGl0KCcsJyk7XG5cbiAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgY29uc3QgZXhwcmVzc2lvblBhcnRzID0gcGFydC5zcGxpdCgnPScpO1xuICAgIGNvbnN0IG5hbWUgPSBleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyID8gZXhwcmVzc2lvblBhcnRzWzBdLnRyaW0oKSA6ICcnO1xuICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IChleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyID8gZXhwcmVzc2lvblBhcnRzWzFdLnRyaW0oKSA6ICcnKSBhc1xuICAgICAgICBrZXlvZiB0LkZvckxvb3BCbG9ja0NvbnRleHQ7XG5cbiAgICBpZiAobmFtZS5sZW5ndGggPT09IDAgfHwgdmFyaWFibGVOYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICBgSW52YWxpZCBmb3IgbG9vcCBcImxldFwiIHBhcmFtZXRlci4gUGFyYW1ldGVyIHNob3VsZCBtYXRjaCB0aGUgcGF0dGVybiBcIjxuYW1lPiA9IDx2YXJpYWJsZSBuYW1lPlwiYCkpO1xuICAgIH0gZWxzZSBpZiAoIUFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUy5oYXModmFyaWFibGVOYW1lKSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICBgVW5rbm93biBcImxldFwiIHBhcmFtZXRlciB2YXJpYWJsZSBcIiR7dmFyaWFibGVOYW1lfVwiLiBUaGUgYWxsb3dlZCB2YXJpYWJsZXMgYXJlOiAke1xuICAgICAgICAgICAgICBBcnJheS5mcm9tKEFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUykuam9pbignLCAnKX1gKSk7XG4gICAgfSBlbHNlIGlmIChjb250ZXh0Lmhhc093blByb3BlcnR5KHZhcmlhYmxlTmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIGBEdXBsaWNhdGUgXCJsZXRcIiBwYXJhbWV0ZXIgdmFyaWFibGUgXCIke3ZhcmlhYmxlTmFtZX1cImApKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dFt2YXJpYWJsZU5hbWVdID0gbmV3IHQuVmFyaWFibGUobmFtZSwgdmFyaWFibGVOYW1lLCBzcGFuLCBzcGFuKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIENoZWNrcyB0aGF0IHRoZSBzaGFwZSBvZiBhIGBpZmAgYmxvY2sgaXMgdmFsaWQuIFJldHVybnMgYW4gYXJyYXkgb2YgZXJyb3JzLiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVJZkJsb2NrKGFzdDogaHRtbC5CbG9ja0dyb3VwKTogUGFyc2VFcnJvcltdIHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgbGV0IGhhc0Vsc2UgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFzdC5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBibG9jayA9IGFzdC5ibG9ja3NbaV07XG5cbiAgICAvLyBDb25kaXRpb25hbCBibG9ja3Mgb25seSBhbGxvdyBgaWZgLCBgZWxzZSBpZmAgYW5kIGBlbHNlYCBibG9ja3MuXG4gICAgaWYgKChibG9jay5uYW1lICE9PSAnaWYnIHx8IGkgPiAwKSAmJiBibG9jay5uYW1lICE9PSAnZWxzZScpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgY29uZGl0aW9uYWwgYmxvY2sgXCIke2Jsb2NrLm5hbWV9XCJgKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2submFtZSA9PT0gJ2lmJykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBpZiAoaGFzRWxzZSkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQ29uZGl0aW9uYWwgY2FuIG9ubHkgaGF2ZSBvbmUgXCJlbHNlXCIgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKGFzdC5ibG9ja3MubGVuZ3RoID4gMSAmJiBpIDwgYXN0LmJsb2Nrcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0Vsc2UgYmxvY2sgbXVzdCBiZSBsYXN0IGluc2lkZSB0aGUgY29uZGl0aW9uYWwnKSk7XG4gICAgICB9XG4gICAgICBoYXNFbHNlID0gdHJ1ZTtcblxuICAgICAgLy8gYGVsc2UgaWZgIGlzIGFuIGVkZ2UgY2FzZSwgYmVjYXVzZSBpdCBoYXMgYSBzcGFjZSBhZnRlciB0aGUgYmxvY2sgbmFtZVxuICAgICAgLy8gd2hpY2ggbWVhbnMgdGhhdCB0aGUgYGlmYCBpcyBjYXB0dXJlZCBhcyBhIHBhcnQgb2YgdGhlIHBhcmFtZXRlcnMuXG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPiAwICYmICFFTFNFX0lGX1BBVFRFUk4udGVzdChibG9jay5wYXJhbWV0ZXJzWzBdLmV4cHJlc3Npb24pKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRWxzZSBibG9jayBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzJykpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBlcnJvcnM7XG59XG5cbi8qKiBDaGVja3MgdGhhdCB0aGUgc2hhcGUgb2YgYSBgc3dpdGNoYCBibG9jayBpcyB2YWxpZC4gUmV0dXJucyBhbiBhcnJheSBvZiBlcnJvcnMuICovXG5mdW5jdGlvbiB2YWxpZGF0ZVN3aXRjaEJsb2NrKGFzdDogaHRtbC5CbG9ja0dyb3VwKTogUGFyc2VFcnJvcltdIHtcbiAgY29uc3QgW3ByaW1hcnlCbG9jaywgLi4uc2Vjb25kYXJ5QmxvY2tzXSA9IGFzdC5ibG9ja3M7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGxldCBoYXNEZWZhdWx0ID0gZmFsc2U7XG4gIGNvbnN0IGhhc1ByaW1hcnkgPSBwcmltYXJ5QmxvY2suY2hpbGRyZW4ubGVuZ3RoID4gMCAmJiBwcmltYXJ5QmxvY2suY2hpbGRyZW4uc29tZShjaGlsZCA9PiB7XG4gICAgLy8gVGhlIG1haW4gYmxvY2sgbWlnaHQgaGF2ZSBlbXB0eSB0ZXh0IG5vZGVzIGlmIGBwcmVzZXJ2ZVdoaXRlc3BhY2VzYCBpcyBlbmFibGVkLlxuICAgIC8vIEFsbG93IHRoZW0gc2luY2UgdGhleSBtaWdodCBiZSB1c2VkIGZvciBjb2RlIGZvcm1hdHRpbmcuXG4gICAgcmV0dXJuICEoY2hpbGQgaW5zdGFuY2VvZiBodG1sLlRleHQpIHx8IGNoaWxkLnZhbHVlLnRyaW0oKS5sZW5ndGggPiAwO1xuICB9KTtcblxuICBpZiAoaGFzUHJpbWFyeSkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICBwcmltYXJ5QmxvY2suc291cmNlU3BhbiwgJ1N3aXRjaCBibG9jayBjYW4gb25seSBjb250YWluIFwiY2FzZVwiIGFuZCBcImRlZmF1bHRcIiBibG9ja3MnKSk7XG4gIH1cblxuICBpZiAocHJpbWFyeUJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgZXJyb3JzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZUVycm9yKHByaW1hcnlCbG9jay5zb3VyY2VTcGFuLCAnU3dpdGNoIGJsb2NrIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbWV0ZXInKSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGJsb2NrIG9mIHNlY29uZGFyeUJsb2Nrcykge1xuICAgIGlmIChibG9jay5uYW1lID09PSAnY2FzZScpIHtcbiAgICAgIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQ2FzZSBibG9jayBtdXN0IGhhdmUgZXhhY3RseSBvbmUgcGFyYW1ldGVyJykpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYmxvY2submFtZSA9PT0gJ2RlZmF1bHQnKSB7XG4gICAgICBpZiAoaGFzRGVmYXVsdCkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdTd2l0Y2ggYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgXCJkZWZhdWx0XCIgYmxvY2snKSk7XG4gICAgICB9IGVsc2UgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRGVmYXVsdCBibG9jayBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzJykpO1xuICAgICAgfVxuICAgICAgaGFzRGVmYXVsdCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIGJsb2NrLnNvdXJjZVNwYW4sICdTd2l0Y2ggYmxvY2sgY2FuIG9ubHkgY29udGFpbiBcImNhc2VcIiBhbmQgXCJkZWZhdWx0XCIgYmxvY2tzJykpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBlcnJvcnM7XG59XG5cbi8qKlxuICogUGFyc2VzIGEgYmxvY2sgcGFyYW1ldGVyIGludG8gYSBiaW5kaW5nIEFTVC5cbiAqIEBwYXJhbSBhc3QgQmxvY2sgcGFyYW1ldGVyIHRoYXQgc2hvdWxkIGJlIHBhcnNlZC5cbiAqIEBwYXJhbSBiaW5kaW5nUGFyc2VyIFBhcnNlciB0aGF0IHRoZSBleHByZXNzaW9uIHNob3VsZCBiZSBwYXJzZWQgd2l0aC5cbiAqIEBwYXJhbSBzdGFydCBJbmRleCBmcm9tIHdoaWNoIHRvIHN0YXJ0IHRoZSBwYXJzaW5nLiBEZWZhdWx0cyB0byAwLlxuICovXG5mdW5jdGlvbiBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKFxuICAgIGFzdDogaHRtbC5CbG9ja1BhcmFtZXRlciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgc3RhcnQ/OiBudW1iZXIpOiBBU1RXaXRoU291cmNlO1xuXG4vKipcbiAqIFBhcnNlcyBhIGJsb2NrIHBhcmFtZXRlciBpbnRvIGEgYmluZGluZyBBU1QuXG4gKiBAcGFyYW0gYXN0IEJsb2NrIHBhcmFtZXRlciB0aGF0IHNob3VsZCBiZSBwYXJzZWQuXG4gKiBAcGFyYW0gYmluZGluZ1BhcnNlciBQYXJzZXIgdGhhdCB0aGUgZXhwcmVzc2lvbiBzaG91bGQgYmUgcGFyc2VkIHdpdGguXG4gKiBAcGFyYW0gcGFydCBTcGVjaWZpYyBwYXJ0IG9mIHRoZSBleHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHBhcnNlZC5cbiAqL1xuZnVuY3Rpb24gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhcbiAgICBhc3Q6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIHBhcnQ6IHN0cmluZyk6IEFTVFdpdGhTb3VyY2U7XG5cbmZ1bmN0aW9uIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoXG4gICAgYXN0OiBodG1sLkJsb2NrUGFyYW1ldGVyLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLFxuICAgIHBhcnQ6IHN0cmluZ3xudW1iZXIgPSAwKTogQVNUV2l0aFNvdXJjZSB7XG4gIGxldCBzdGFydDogbnVtYmVyO1xuICBsZXQgZW5kOiBudW1iZXI7XG5cbiAgaWYgKHR5cGVvZiBwYXJ0ID09PSAnbnVtYmVyJykge1xuICAgIHN0YXJ0ID0gcGFydDtcbiAgICBlbmQgPSBhc3QuZXhwcmVzc2lvbi5sZW5ndGg7XG4gIH0gZWxzZSB7XG4gICAgLy8gTm90ZTogYGxhc3RJbmRleE9mYCBoZXJlIHNob3VsZCBiZSBlbm91Z2ggdG8ga25vdyB0aGUgc3RhcnQgaW5kZXggb2YgdGhlIGV4cHJlc3Npb24sXG4gICAgLy8gYmVjYXVzZSB3ZSBrbm93IHRoYXQgaXQnbGwgYmUgYXQgdGhlIGVuZCBvZiB0aGUgcGFyYW0uIElkZWFsbHkgd2UgY291bGQgdXNlIHRoZSBgZGBcbiAgICAvLyBmbGFnIHdoZW4gbWF0Y2hpbmcgdmlhIHJlZ2V4IGFuZCBnZXQgdGhlIGluZGV4IGZyb20gYG1hdGNoLmluZGljZXNgLCBidXQgaXQncyB1bmNsZWFyXG4gICAgLy8gaWYgd2UgY2FuIHVzZSBpdCB5ZXQgc2luY2UgaXQncyBhIHJlbGF0aXZlbHkgbmV3IGZlYXR1cmUuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdGMzOS9wcm9wb3NhbC1yZWdleHAtbWF0Y2gtaW5kaWNlc1xuICAgIHN0YXJ0ID0gTWF0aC5tYXgoMCwgYXN0LmV4cHJlc3Npb24ubGFzdEluZGV4T2YocGFydCkpO1xuICAgIGVuZCA9IHN0YXJ0ICsgcGFydC5sZW5ndGg7XG4gIH1cblxuICByZXR1cm4gYmluZGluZ1BhcnNlci5wYXJzZUJpbmRpbmcoXG4gICAgICBhc3QuZXhwcmVzc2lvbi5zbGljZShzdGFydCwgZW5kKSwgZmFsc2UsIGFzdC5zb3VyY2VTcGFuLCBhc3Quc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBzdGFydCk7XG59XG5cbi8qKiBQYXJzZXMgdGhlIHBhcmFtZXRlciBvZiBhIGNvbmRpdGlvbmFsIGJsb2NrIChgaWZgIG9yIGBlbHNlIGlmYCkuICovXG5mdW5jdGlvbiBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKFxuICAgIGJsb2NrOiBodG1sLkJsb2NrLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge1xuICBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQ29uZGl0aW9uYWwgYmxvY2sgZG9lcyBub3QgaGF2ZSBhbiBleHByZXNzaW9uJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgaXNQcmltYXJ5SWZCbG9jayA9IGJsb2NrLm5hbWUgPT09ICdpZic7XG4gIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgLy8gRXhwcmVzc2lvbnMgZm9yIGB7OmVsc2UgaWZ9YCBibG9ja3Mgc3RhcnQgYXQgMiB0byBza2lwIHRoZSBgaWZgIGZyb20gdGhlIGV4cHJlc3Npb24uXG4gICAgICBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKGJsb2NrLnBhcmFtZXRlcnNbMF0sIGJpbmRpbmdQYXJzZXIsIGlzUHJpbWFyeUlmQmxvY2sgPyAwIDogMik7XG4gIGxldCBleHByZXNzaW9uQWxpYXM6IHQuVmFyaWFibGV8bnVsbCA9IG51bGw7XG5cbiAgLy8gU3RhcnQgZnJvbSAxIHNpbmNlIHdlIHByb2Nlc3NlZCB0aGUgZmlyc3QgcGFyYW1ldGVyIGFscmVhZHkuXG4gIGZvciAobGV0IGkgPSAxOyBpIDwgYmxvY2sucGFyYW1ldGVycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHBhcmFtID0gYmxvY2sucGFyYW1ldGVyc1tpXTtcbiAgICBjb25zdCBhbGlhc01hdGNoID0gcGFyYW0uZXhwcmVzc2lvbi5tYXRjaChDT05ESVRJT05BTF9BTElBU19QQVRURVJOKTtcblxuICAgIC8vIEZvciBub3cgY29uZGl0aW9uYWxzIGNhbiBvbmx5IGhhdmUgYW4gYGFzYCBwYXJhbWV0ZXIuXG4gICAgLy8gV2UgbWF5IHdhbnQgdG8gcmV3b3JrIHRoaXMgbGF0ZXIgaWYgd2UgYWRkIG1vcmUuXG4gICAgaWYgKGFsaWFzTWF0Y2ggPT09IG51bGwpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHBhcmFtLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgY29uZGl0aW9uYWwgcGFyYW1hdGVyIFwiJHtwYXJhbS5leHByZXNzaW9ufVwiYCkpO1xuICAgIH0gZWxzZSBpZiAoIWlzUHJpbWFyeUlmQmxvY2spIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHBhcmFtLnNvdXJjZVNwYW4sICdcImFzXCIgZXhwcmVzc2lvbiBpcyBvbmx5IGFsbG93ZWQgb24gdGhlIHByaW1hcnkgXCJpZlwiIGJsb2NrJykpO1xuICAgIH0gZWxzZSBpZiAoZXhwcmVzc2lvbkFsaWFzICE9PSBudWxsKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICBuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnQ29uZGl0aW9uYWwgY2FuIG9ubHkgaGF2ZSBvbmUgXCJhc1wiIGV4cHJlc3Npb24nKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhbGlhc01hdGNoWzFdLnRyaW0oKTtcbiAgICAgIGV4cHJlc3Npb25BbGlhcyA9IG5ldyB0LlZhcmlhYmxlKG5hbWUsIG5hbWUsIHBhcmFtLnNvdXJjZVNwYW4sIHBhcmFtLnNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgZXhwcmVzc2lvbkFsaWFzfTtcbn1cblxuLyoqIFN0cmlwcyBvcHRpb25hbCBwYXJlbnRoZXNlcyBhcm91bmQgZnJvbSBhIGNvbnRyb2wgZnJvbSBleHByZXNzaW9uIHBhcmFtZXRlci4gKi9cbmZ1bmN0aW9uIHN0cmlwT3B0aW9uYWxQYXJlbnRoZXNlcyhwYXJhbTogaHRtbC5CbG9ja1BhcmFtZXRlciwgZXJyb3JzOiBQYXJzZUVycm9yW10pOiBzdHJpbmd8bnVsbCB7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSBwYXJhbS5leHByZXNzaW9uO1xuICBjb25zdCBzcGFjZVJlZ2V4ID0gL15cXHMkLztcbiAgbGV0IG9wZW5QYXJlbnMgPSAwO1xuICBsZXQgc3RhcnQgPSAwO1xuICBsZXQgZW5kID0gZXhwcmVzc2lvbi5sZW5ndGggLSAxO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwcmVzc2lvbi5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoYXIgPSBleHByZXNzaW9uW2ldO1xuXG4gICAgaWYgKGNoYXIgPT09ICcoJykge1xuICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgIG9wZW5QYXJlbnMrKztcbiAgICB9IGVsc2UgaWYgKHNwYWNlUmVnZXgudGVzdChjaGFyKSkge1xuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChvcGVuUGFyZW5zID09PSAwKSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb247XG4gIH1cblxuICBmb3IgKGxldCBpID0gZXhwcmVzc2lvbi5sZW5ndGggLSAxOyBpID4gLTE7IGktLSkge1xuICAgIGNvbnN0IGNoYXIgPSBleHByZXNzaW9uW2ldO1xuXG4gICAgaWYgKGNoYXIgPT09ICcpJykge1xuICAgICAgZW5kID0gaTtcbiAgICAgIG9wZW5QYXJlbnMtLTtcbiAgICAgIGlmIChvcGVuUGFyZW5zID09PSAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3BhY2VSZWdleC50ZXN0KGNoYXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wZW5QYXJlbnMgIT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnVW5jbG9zZWQgcGFyZW50aGVzZXMgaW4gZXhwcmVzc2lvbicpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBleHByZXNzaW9uLnNsaWNlKHN0YXJ0LCBlbmQpO1xufVxuIl19