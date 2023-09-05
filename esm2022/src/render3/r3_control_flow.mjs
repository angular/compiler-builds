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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sS0FBSyxJQUFJLE1BQU0sa0JBQWtCLENBQUM7QUFDekMsT0FBTyxFQUFDLFVBQVUsRUFBa0IsTUFBTSxlQUFlLENBQUM7QUFHMUQsT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVLENBQUM7QUFFOUIsc0RBQXNEO0FBQ3RELE1BQU0sMkJBQTJCLEdBQUcsa0NBQWtDLENBQUM7QUFFdkUsK0RBQStEO0FBQy9ELE1BQU0sc0JBQXNCLEdBQUcsZUFBZSxDQUFDO0FBRS9DLDhEQUE4RDtBQUM5RCxNQUFNLHlCQUF5QixHQUFHLFlBQVksQ0FBQztBQUUvQyxtREFBbUQ7QUFDbkQsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDO0FBRWhDLGtEQUFrRDtBQUNsRCxNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQztBQUUzQyw4RkFBOEY7QUFDOUYsTUFBTSw4QkFBOEIsR0FDaEMsSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFFdEUsd0RBQXdEO0FBQ3hELE1BQU0sVUFBVSxhQUFhLENBQ3pCLEdBQW9CLEVBQUUsT0FBcUIsRUFDM0MsYUFBNEI7SUFDOUIsTUFBTSxNQUFNLEdBQWlCLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNsRCxNQUFNLFFBQVEsR0FBc0IsRUFBRSxDQUFDO0lBRXZDLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDckIsT0FBTyxFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7S0FDN0I7SUFFRCxtRUFBbUU7SUFDbkUsS0FBSyxNQUFNLEtBQUssSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFO1FBQzlCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUV4RCxtQkFBbUI7UUFDbkIsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDMUQsUUFBUSxDQUFDLElBQUksQ0FDVCxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztZQUN4RixTQUFTO1NBQ1Y7UUFFRCxNQUFNLE1BQU0sR0FBRywrQkFBK0IsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBRTdFLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtZQUNuQixRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FDN0IsTUFBTSxDQUFDLFVBQVUsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsVUFBVSxFQUNyRSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztTQUM3QjtLQUNGO0lBRUQsT0FBTztRQUNMLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLGVBQWUsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDO1FBQ3JGLE1BQU07S0FDUCxDQUFDO0FBQ0osQ0FBQztBQUVELHdEQUF3RDtBQUN4RCxNQUFNLFVBQVUsYUFBYSxDQUN6QixHQUFvQixFQUFFLE9BQXFCLEVBQzNDLGFBQTRCO0lBQzlCLE1BQU0sQ0FBQyxZQUFZLEVBQUUsR0FBRyxlQUFlLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBQ3RELE1BQU0sTUFBTSxHQUFpQixFQUFFLENBQUM7SUFDaEMsTUFBTSxNQUFNLEdBQUcsc0JBQXNCLENBQUMsWUFBWSxFQUFFLE1BQU0sRUFBRSxhQUFhLENBQUMsQ0FBQztJQUMzRSxJQUFJLElBQUksR0FBd0IsSUFBSSxDQUFDO0lBQ3JDLElBQUksS0FBSyxHQUE2QixJQUFJLENBQUM7SUFFM0MsS0FBSyxNQUFNLEtBQUssSUFBSSxlQUFlLEVBQUU7UUFDbkMsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtZQUMxQixJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7Z0JBQ2xCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSwwQ0FBMEMsQ0FBQyxDQUFDLENBQUM7YUFDM0Y7aUJBQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ3RDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxvQ0FBb0MsQ0FBQyxDQUFDLENBQUM7YUFDckY7aUJBQU07Z0JBQ0wsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLGlCQUFpQixDQUMzQixJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7YUFDdEY7U0FDRjthQUFNO1lBQ0wsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLDRCQUE0QixLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQzFGO0tBQ0Y7SUFFRCxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7UUFDbkIsSUFBSSxNQUFNLENBQUMsT0FBTyxLQUFLLElBQUksRUFBRTtZQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUseUNBQXlDLENBQUMsQ0FBQyxDQUFDO1NBQ3hGO2FBQU07WUFDTCxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUNyQixNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxFQUNsRSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLGVBQWUsRUFDekYsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1NBQ3hCO0tBQ0Y7SUFFRCxPQUFPLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDO0FBQ3hCLENBQUM7QUFFRCxvREFBb0Q7QUFDcEQsTUFBTSxVQUFVLGlCQUFpQixDQUM3QixHQUFvQixFQUFFLE9BQXFCLEVBQzNDLGFBQTRCO0lBQzlCLE1BQU0sQ0FBQyxZQUFZLEVBQUUsR0FBRyxlQUFlLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBQ3RELE1BQU0sTUFBTSxHQUFHLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXhDLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDckIsT0FBTyxFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFDLENBQUM7S0FDN0I7SUFFRCxNQUFNLGlCQUFpQixHQUFHLDRCQUE0QixDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDbEcsTUFBTSxLQUFLLEdBQXdCLEVBQUUsQ0FBQztJQUN0QyxJQUFJLFdBQVcsR0FBMkIsSUFBSSxDQUFDO0lBRS9DLG1GQUFtRjtJQUNuRixLQUFLLE1BQU0sS0FBSyxJQUFJLGVBQWUsRUFBRTtRQUNuQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUFDO1lBQ3RDLDRCQUE0QixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztZQUNsRSxJQUFJLENBQUM7UUFDVCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQzdCLFVBQVUsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFDcEUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRTNCLElBQUksVUFBVSxLQUFLLElBQUksRUFBRTtZQUN2QixXQUFXLEdBQUcsR0FBRyxDQUFDO1NBQ25CO2FBQU07WUFDTCxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2pCO0tBQ0Y7SUFFRCxxREFBcUQ7SUFDckQsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFO1FBQ3hCLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDekI7SUFFRCxPQUFPO1FBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FDbkIsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLGVBQWUsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDO1FBQ3JGLE1BQU07S0FDUCxDQUFDO0FBQ0osQ0FBQztBQUVELG1EQUFtRDtBQUNuRCxTQUFTLHNCQUFzQixDQUMzQixLQUFpQixFQUFFLE1BQW9CLEVBQUUsYUFBNEI7SUFDdkUsSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDakMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLHNDQUFzQyxDQUFDLENBQUMsQ0FBQztRQUN0RixPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsTUFBTSxDQUFDLGVBQWUsRUFBRSxHQUFHLGVBQWUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7SUFDL0QsTUFBTSxLQUFLLEdBQ1Asd0JBQXdCLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxFQUFFLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBRTFGLElBQUksQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDMUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FDdEIsZUFBZSxDQUFDLFVBQVUsRUFDMUIsb0dBQW9HLENBQUMsQ0FBQyxDQUFDO1FBQzNHLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUUsYUFBYSxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQzFDLE1BQU0sTUFBTSxHQUFHO1FBQ2IsUUFBUTtRQUNSLE9BQU8sRUFBRSxJQUE0QjtRQUNyQyxVQUFVLEVBQUUsNEJBQTRCLENBQUMsZUFBZSxFQUFFLGFBQWEsRUFBRSxhQUFhLENBQUM7UUFDdkYsT0FBTyxFQUFFLElBQW9DO0tBQzlDLENBQUM7SUFFRixLQUFLLE1BQU0sS0FBSyxJQUFJLGVBQWUsRUFBRTtRQUNuQyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRTlELElBQUksUUFBUSxLQUFLLElBQUksRUFBRTtZQUNyQixNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO1lBQ3RDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDekUsU0FBUztTQUNWO1FBRUQsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUVsRSxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7WUFDdkIsSUFBSSxNQUFNLENBQUMsT0FBTyxLQUFLLElBQUksRUFBRTtnQkFDM0IsTUFBTSxDQUFDLElBQUksQ0FDUCxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLCtDQUErQyxDQUFDLENBQUMsQ0FBQzthQUN4RjtpQkFBTTtnQkFDTCxNQUFNLENBQUMsT0FBTyxHQUFHLDRCQUE0QixDQUFDLEtBQUssRUFBRSxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDcEY7WUFDRCxTQUFTO1NBQ1Y7UUFFRCxNQUFNLENBQUMsSUFBSSxDQUNQLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsZ0NBQWdDLEtBQUssQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDNUY7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQsd0RBQXdEO0FBQ3hELFNBQVMsaUJBQWlCLENBQ3RCLFVBQTJCLEVBQUUsVUFBa0IsRUFBRSxPQUE4QixFQUMvRSxNQUFvQjtJQUN0QixNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXBDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1FBQ3hCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsTUFBTSxJQUFJLEdBQUcsZUFBZSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQzNFLE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUVuRixJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2xELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQ3RCLFVBQVUsRUFDVixpR0FBaUcsQ0FBQyxDQUFDLENBQUM7U0FDekc7YUFBTSxJQUFJLENBQUMsOEJBQThCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQzVELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQ3RCLFVBQVUsRUFDVixxQ0FBcUMsWUFBWSxpQ0FDN0MsS0FBSyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUNuRTthQUFNLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUMvQyxNQUFNLENBQUMsSUFBSSxDQUNQLElBQUksVUFBVSxDQUFDLFVBQVUsRUFBRSx1Q0FBdUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ3pGO2FBQU07WUFDTCxPQUFPLENBQUMsWUFBMkMsQ0FBQyxHQUFHLElBQUksQ0FBQztTQUM3RDtLQUNGO0FBQ0gsQ0FBQztBQUVELGtGQUFrRjtBQUNsRixTQUFTLGVBQWUsQ0FBQyxHQUFvQjtJQUMzQyxNQUFNLE1BQU0sR0FBaUIsRUFBRSxDQUFDO0lBQ2hDLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztJQUVwQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDMUMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU1QixtRUFBbUU7UUFDbkUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtZQUMzRCxNQUFNLENBQUMsSUFBSSxDQUNQLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsbUNBQW1DLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDeEYsU0FBUztTQUNWO1FBRUQsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtZQUN2QixTQUFTO1NBQ1Y7UUFFRCxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNqQyxJQUFJLE9BQU8sRUFBRTtnQkFDWCxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsNENBQTRDLENBQUMsQ0FBQyxDQUFDO2FBQzdGO2lCQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQzdELE1BQU0sQ0FBQyxJQUFJLENBQ1AsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxnREFBZ0QsQ0FBQyxDQUFDLENBQUM7YUFDekY7WUFDRCxPQUFPLEdBQUcsSUFBSSxDQUFDO1lBRWYseUVBQXlFO1lBQ3pFLHFFQUFxRTtTQUN0RTthQUFNLElBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3hGLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxtQ0FBbUMsQ0FBQyxDQUFDLENBQUM7U0FDcEY7S0FDRjtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxzRkFBc0Y7QUFDdEYsU0FBUyxtQkFBbUIsQ0FBQyxHQUFvQjtJQUMvQyxNQUFNLENBQUMsWUFBWSxFQUFFLEdBQUcsZUFBZSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztJQUN0RCxNQUFNLE1BQU0sR0FBaUIsRUFBRSxDQUFDO0lBQ2hDLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztJQUN2QixNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDeEYsa0ZBQWtGO1FBQ2xGLDJEQUEyRDtRQUMzRCxPQUFPLENBQUMsQ0FBQyxLQUFLLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUN4RSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksVUFBVSxFQUFFO1FBQ2QsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FDdEIsWUFBWSxDQUFDLFVBQVUsRUFBRSwyREFBMkQsQ0FBQyxDQUFDLENBQUM7S0FDNUY7SUFFRCxJQUFJLFlBQVksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUN4QyxNQUFNLENBQUMsSUFBSSxDQUNQLElBQUksVUFBVSxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsOENBQThDLENBQUMsQ0FBQyxDQUFDO0tBQzlGO0lBRUQsS0FBSyxNQUFNLEtBQUssSUFBSSxlQUFlLEVBQUU7UUFDbkMsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtZQUN6QixJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDakMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLDRDQUE0QyxDQUFDLENBQUMsQ0FBQzthQUM3RjtTQUNGO2FBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtZQUNuQyxJQUFJLFVBQVUsRUFBRTtnQkFDZCxNQUFNLENBQUMsSUFBSSxDQUNQLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsZ0RBQWdELENBQUMsQ0FBQyxDQUFDO2FBQ3pGO2lCQUFNLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUN0QyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsc0NBQXNDLENBQUMsQ0FBQyxDQUFDO2FBQ3ZGO1lBQ0QsVUFBVSxHQUFHLElBQUksQ0FBQztTQUNuQjthQUFNO1lBQ0wsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FDdEIsS0FBSyxDQUFDLFVBQVUsRUFBRSwyREFBMkQsQ0FBQyxDQUFDLENBQUM7U0FDckY7S0FDRjtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFvQkQsU0FBUyw0QkFBNEIsQ0FDakMsR0FBd0IsRUFBRSxhQUE0QixFQUN0RCxPQUFzQixDQUFDO0lBQ3pCLElBQUksS0FBYSxDQUFDO0lBQ2xCLElBQUksR0FBVyxDQUFDO0lBRWhCLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO1FBQzVCLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDYixHQUFHLEdBQUcsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUM7S0FDN0I7U0FBTTtRQUNMLHVGQUF1RjtRQUN2RixzRkFBc0Y7UUFDdEYsd0ZBQXdGO1FBQ3hGLGlFQUFpRTtRQUNqRSx3REFBd0Q7UUFDeEQsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdEQsR0FBRyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0tBQzNCO0lBRUQsT0FBTyxhQUFhLENBQUMsWUFBWSxDQUM3QixHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQ3BHLENBQUM7QUFFRCx1RUFBdUU7QUFDdkUsU0FBUywrQkFBK0IsQ0FDcEMsS0FBaUIsRUFBRSxNQUFvQixFQUFFLGFBQTRCO0lBQ3ZFLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ2pDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSwrQ0FBK0MsQ0FBQyxDQUFDLENBQUM7UUFDL0YsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUVELE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUM7SUFDN0MsTUFBTSxVQUFVO0lBQ1osdUZBQXVGO0lBQ3ZGLDRCQUE0QixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQy9GLElBQUksZUFBZSxHQUFnQixJQUFJLENBQUM7SUFFeEMsK0RBQStEO0lBQy9ELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNoRCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFFckUsd0RBQXdEO1FBQ3hELG1EQUFtRDtRQUNuRCxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7WUFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FDdEIsS0FBSyxDQUFDLFVBQVUsRUFBRSx1Q0FBdUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztTQUNwRjthQUFNLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUM1QixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUN0QixLQUFLLENBQUMsVUFBVSxFQUFFLDJEQUEyRCxDQUFDLENBQUMsQ0FBQztTQUNyRjthQUFNLElBQUksZUFBZSxLQUFLLElBQUksRUFBRTtZQUNuQyxNQUFNLENBQUMsSUFBSSxDQUNQLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsK0NBQStDLENBQUMsQ0FBQyxDQUFDO1NBQ3hGO2FBQU07WUFDTCxlQUFlLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1NBQ3hDO0tBQ0Y7SUFFRCxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBQyxDQUFDO0FBQ3ZDLENBQUM7QUFFRCxtRkFBbUY7QUFDbkYsU0FBUyx3QkFBd0IsQ0FBQyxLQUEwQixFQUFFLE1BQW9CO0lBQ2hGLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7SUFDcEMsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDO0lBQzFCLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNuQixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDZCxJQUFJLEdBQUcsR0FBRyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUVoQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMxQyxNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFM0IsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFO1lBQ2hCLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2QsVUFBVSxFQUFFLENBQUM7U0FDZDthQUFNLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNoQyxTQUFTO1NBQ1Y7YUFBTTtZQUNMLE1BQU07U0FDUDtLQUNGO0lBRUQsSUFBSSxVQUFVLEtBQUssQ0FBQyxFQUFFO1FBQ3BCLE9BQU8sVUFBVSxDQUFDO0tBQ25CO0lBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0MsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTNCLElBQUksSUFBSSxLQUFLLEdBQUcsRUFBRTtZQUNoQixHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQ1IsVUFBVSxFQUFFLENBQUM7WUFDYixJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUU7Z0JBQ3BCLE1BQU07YUFDUDtTQUNGO2FBQU0sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2hDLFNBQVM7U0FDVjthQUFNO1lBQ0wsTUFBTTtTQUNQO0tBQ0Y7SUFFRCxJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUU7UUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLG9DQUFvQyxDQUFDLENBQUMsQ0FBQztRQUNwRixPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN0QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNUV2l0aFNvdXJjZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5cbmltcG9ydCAqIGFzIHQgZnJvbSAnLi9yM19hc3QnO1xuXG4vKiogUGF0dGVybiBmb3IgdGhlIGV4cHJlc3Npb24gaW4gYSBmb3IgbG9vcCBibG9jay4gKi9cbmNvbnN0IEZPUl9MT09QX0VYUFJFU1NJT05fUEFUVEVSTiA9IC9eXFxzKihbMC05QS1aYS16XyRdKilcXHMrb2ZcXHMrKC4qKS87XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgdHJhY2tpbmcgZXhwcmVzc2lvbiBpbiBhIGZvciBsb29wIGJsb2NrLiAqL1xuY29uc3QgRk9SX0xPT1BfVFJBQ0tfUEFUVEVSTiA9IC9edHJhY2tcXHMrKC4qKS87XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgYGFzYCBleHByZXNzaW9uIGluIGEgY29uZGl0aW9uYWwgYmxvY2suICovXG5jb25zdCBDT05ESVRJT05BTF9BTElBU19QQVRURVJOID0gL15hc1xccysoLiopLztcblxuLyoqIFBhdHRlcm4gdXNlZCB0byBpZGVudGlmeSBhbiBgZWxzZSBpZmAgYmxvY2suICovXG5jb25zdCBFTFNFX0lGX1BBVFRFUk4gPSAvXmlmXFxzLztcblxuLyoqIFBhdHRlcm4gdXNlZCB0byBpZGVudGlmeSBhIGBsZXRgIHBhcmFtZXRlci4gKi9cbmNvbnN0IEZPUl9MT09QX0xFVF9QQVRURVJOID0gL15sZXRcXHMrKC4qKS87XG5cbi8qKiBOYW1lcyBvZiB2YXJpYWJsZXMgdGhhdCBhcmUgYWxsb3dlZCB0byBiZSB1c2VkIGluIHRoZSBgbGV0YCBleHByZXNzaW9uIG9mIGEgYGZvcmAgbG9vcC4gKi9cbmNvbnN0IEFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUyA9XG4gICAgbmV3IFNldChbJyRpbmRleCcsICckZmlyc3QnLCAnJGxhc3QnLCAnJGV2ZW4nLCAnJG9kZCcsICckY291bnQnXSk7XG5cbi8qKiBDcmVhdGVzIGFuIGBpZmAgbG9vcCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSWZCbG9jayhcbiAgICBhc3Q6IGh0bWwuQmxvY2tHcm91cCwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5JZkJsb2NrfG51bGwsIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gdmFsaWRhdGVJZkJsb2NrKGFzdCk7XG4gIGNvbnN0IGJyYW5jaGVzOiB0LklmQmxvY2tCcmFuY2hbXSA9IFtdO1xuXG4gIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7bm9kZTogbnVsbCwgZXJyb3JzfTtcbiAgfVxuXG4gIC8vIEFzc3VtZXMgdGhhdCB0aGUgc3RydWN0dXJlIGlzIHZhbGlkIHNpbmNlIHdlIHZhbGlkYXRlZCBpdCBhYm92ZS5cbiAgZm9yIChjb25zdCBibG9jayBvZiBhc3QuYmxvY2tzKSB7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuKTtcblxuICAgIC8vIGB7OmVsc2V9YCBibG9jay5cbiAgICBpZiAoYmxvY2submFtZSA9PT0gJ2Vsc2UnICYmIGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBicmFuY2hlcy5wdXNoKFxuICAgICAgICAgIG5ldyB0LklmQmxvY2tCcmFuY2gobnVsbCwgY2hpbGRyZW4sIG51bGwsIGJsb2NrLnNvdXJjZVNwYW4sIGJsb2NrLnN0YXJ0U291cmNlU3BhbikpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0gcGFyc2VDb25kaXRpb25hbEJsb2NrUGFyYW1ldGVycyhibG9jaywgZXJyb3JzLCBiaW5kaW5nUGFyc2VyKTtcblxuICAgIGlmIChwYXJhbXMgIT09IG51bGwpIHtcbiAgICAgIGJyYW5jaGVzLnB1c2gobmV3IHQuSWZCbG9ja0JyYW5jaChcbiAgICAgICAgICBwYXJhbXMuZXhwcmVzc2lvbiwgY2hpbGRyZW4sIHBhcmFtcy5leHByZXNzaW9uQWxpYXMsIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBub2RlOiBuZXcgdC5JZkJsb2NrKGJyYW5jaGVzLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pLFxuICAgIGVycm9ycyxcbiAgfTtcbn1cblxuLyoqIENyZWF0ZXMgYSBgZm9yYCBsb29wIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVGb3JMb29wKFxuICAgIGFzdDogaHRtbC5CbG9ja0dyb3VwLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LkZvckxvb3BCbG9ja3xudWxsLCBlcnJvcnM6IFBhcnNlRXJyb3JbXX0ge1xuICBjb25zdCBbcHJpbWFyeUJsb2NrLCAuLi5zZWNvbmRhcnlCbG9ja3NdID0gYXN0LmJsb2NrcztcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgY29uc3QgcGFyYW1zID0gcGFyc2VGb3JMb29wUGFyYW1ldGVycyhwcmltYXJ5QmxvY2ssIGVycm9ycywgYmluZGluZ1BhcnNlcik7XG4gIGxldCBub2RlOiB0LkZvckxvb3BCbG9ja3xudWxsID0gbnVsbDtcbiAgbGV0IGVtcHR5OiB0LkZvckxvb3BCbG9ja0VtcHR5fG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgYmxvY2sgb2Ygc2Vjb25kYXJ5QmxvY2tzKSB7XG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdlbXB0eScpIHtcbiAgICAgIGlmIChlbXB0eSAhPT0gbnVsbCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRm9yIGxvb3AgY2FuIG9ubHkgaGF2ZSBvbmUgXCJlbXB0eVwiIGJsb2NrJykpO1xuICAgICAgfSBlbHNlIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0VtcHR5IGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMnKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbXB0eSA9IG5ldyB0LkZvckxvb3BCbG9ja0VtcHR5KFxuICAgICAgICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiksIGJsb2NrLnNvdXJjZVNwYW4sIGJsb2NrLnN0YXJ0U291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgbG9vcCBibG9jayBcIiR7YmxvY2submFtZX1cImApKTtcbiAgICB9XG4gIH1cblxuICBpZiAocGFyYW1zICE9PSBudWxsKSB7XG4gICAgaWYgKHBhcmFtcy50cmFja0J5ID09PSBudWxsKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihhc3Quc291cmNlU3BhbiwgJ0ZvciBsb29wIG11c3QgaGF2ZSBhIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBub2RlID0gbmV3IHQuRm9yTG9vcEJsb2NrKFxuICAgICAgICAgIHBhcmFtcy5pdGVtTmFtZSwgcGFyYW1zLmV4cHJlc3Npb24sIHBhcmFtcy50cmFja0J5LCBwYXJhbXMuY29udGV4dCxcbiAgICAgICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIHByaW1hcnlCbG9jay5jaGlsZHJlbiksIGVtcHR5LCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgICBhc3QuZW5kU291cmNlU3Bhbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtub2RlLCBlcnJvcnN9O1xufVxuXG4vKiogQ3JlYXRlcyBhIHN3aXRjaCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3dpdGNoQmxvY2soXG4gICAgYXN0OiBodG1sLkJsb2NrR3JvdXAsIHZpc2l0b3I6IGh0bWwuVmlzaXRvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge25vZGU6IHQuU3dpdGNoQmxvY2t8bnVsbCwgZXJyb3JzOiBQYXJzZUVycm9yW119IHtcbiAgY29uc3QgW3ByaW1hcnlCbG9jaywgLi4uc2Vjb25kYXJ5QmxvY2tzXSA9IGFzdC5ibG9ja3M7XG4gIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlU3dpdGNoQmxvY2soYXN0KTtcblxuICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge25vZGU6IG51bGwsIGVycm9yc307XG4gIH1cblxuICBjb25zdCBwcmltYXJ5RXhwcmVzc2lvbiA9IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcocHJpbWFyeUJsb2NrLnBhcmFtZXRlcnNbMF0sIGJpbmRpbmdQYXJzZXIpO1xuICBjb25zdCBjYXNlczogdC5Td2l0Y2hCbG9ja0Nhc2VbXSA9IFtdO1xuICBsZXQgZGVmYXVsdENhc2U6IHQuU3dpdGNoQmxvY2tDYXNlfG51bGwgPSBudWxsO1xuXG4gIC8vIEhlcmUgd2UgYXNzdW1lIHRoYXQgYWxsIHRoZSBibG9ja3MgYXJlIHZhbGlkIGdpdmVuIHRoYXQgd2UgdmFsaWRhdGVkIHRoZW0gYWJvdmUuXG4gIGZvciAoY29uc3QgYmxvY2sgb2Ygc2Vjb25kYXJ5QmxvY2tzKSB7XG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IGJsb2NrLm5hbWUgPT09ICdjYXNlJyA/XG4gICAgICAgIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoYmxvY2sucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcikgOlxuICAgICAgICBudWxsO1xuICAgIGNvbnN0IGFzdCA9IG5ldyB0LlN3aXRjaEJsb2NrQ2FzZShcbiAgICAgICAgZXhwcmVzc2lvbiwgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiksIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICAgIGJsb2NrLnN0YXJ0U291cmNlU3Bhbik7XG5cbiAgICBpZiAoZXhwcmVzc2lvbiA9PT0gbnVsbCkge1xuICAgICAgZGVmYXVsdENhc2UgPSBhc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhc2VzLnB1c2goYXN0KTtcbiAgICB9XG4gIH1cblxuICAvLyBFbnN1cmUgdGhhdCB0aGUgZGVmYXVsdCBjYXNlIGlzIGxhc3QgaW4gdGhlIGFycmF5LlxuICBpZiAoZGVmYXVsdENhc2UgIT09IG51bGwpIHtcbiAgICBjYXNlcy5wdXNoKGRlZmF1bHRDYXNlKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbm9kZTogbmV3IHQuU3dpdGNoQmxvY2soXG4gICAgICAgIHByaW1hcnlFeHByZXNzaW9uLCBjYXNlcywgYXN0LnNvdXJjZVNwYW4sIGFzdC5zdGFydFNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuKSxcbiAgICBlcnJvcnNcbiAgfTtcbn1cblxuLyoqIFBhcnNlcyB0aGUgcGFyYW1ldGVycyBvZiBhIGBmb3JgIGxvb3AgYmxvY2suICovXG5mdW5jdGlvbiBwYXJzZUZvckxvb3BQYXJhbWV0ZXJzKFxuICAgIGJsb2NrOiBodG1sLkJsb2NrLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge1xuICBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRm9yIGxvb3AgZG9lcyBub3QgaGF2ZSBhbiBleHByZXNzaW9uJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgW2V4cHJlc3Npb25QYXJhbSwgLi4uc2Vjb25kYXJ5UGFyYW1zXSA9IGJsb2NrLnBhcmFtZXRlcnM7XG4gIGNvbnN0IG1hdGNoID1cbiAgICAgIHN0cmlwT3B0aW9uYWxQYXJlbnRoZXNlcyhleHByZXNzaW9uUGFyYW0sIGVycm9ycyk/Lm1hdGNoKEZPUl9MT09QX0VYUFJFU1NJT05fUEFUVEVSTik7XG5cbiAgaWYgKCFtYXRjaCB8fCBtYXRjaFsyXS50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgIGV4cHJlc3Npb25QYXJhbS5zb3VyY2VTcGFuLFxuICAgICAgICAnQ2Fubm90IHBhcnNlIGV4cHJlc3Npb24uIEZvciBsb29wIGV4cHJlc3Npb24gbXVzdCBtYXRjaCB0aGUgcGF0dGVybiBcIjxpZGVudGlmaWVyPiBvZiA8ZXhwcmVzc2lvbj5cIicpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IFssIGl0ZW1OYW1lLCByYXdFeHByZXNzaW9uXSA9IG1hdGNoO1xuICBjb25zdCByZXN1bHQgPSB7XG4gICAgaXRlbU5hbWUsXG4gICAgdHJhY2tCeTogbnVsbCBhcyBBU1RXaXRoU291cmNlIHwgbnVsbCxcbiAgICBleHByZXNzaW9uOiBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKGV4cHJlc3Npb25QYXJhbSwgYmluZGluZ1BhcnNlciwgcmF3RXhwcmVzc2lvbiksXG4gICAgY29udGV4dDogbnVsbCBhcyB0LkZvckxvb3BCbG9ja0NvbnRleHQgfCBudWxsLFxuICB9O1xuXG4gIGZvciAoY29uc3QgcGFyYW0gb2Ygc2Vjb25kYXJ5UGFyYW1zKSB7XG4gICAgY29uc3QgbGV0TWF0Y2ggPSBwYXJhbS5leHByZXNzaW9uLm1hdGNoKEZPUl9MT09QX0xFVF9QQVRURVJOKTtcblxuICAgIGlmIChsZXRNYXRjaCAhPT0gbnVsbCkge1xuICAgICAgcmVzdWx0LmNvbnRleHQgPSByZXN1bHQuY29udGV4dCB8fCB7fTtcbiAgICAgIHBhcnNlTGV0UGFyYW1ldGVyKHBhcmFtLnNvdXJjZVNwYW4sIGxldE1hdGNoWzFdLCByZXN1bHQuY29udGV4dCwgZXJyb3JzKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRyYWNrTWF0Y2ggPSBwYXJhbS5leHByZXNzaW9uLm1hdGNoKEZPUl9MT09QX1RSQUNLX1BBVFRFUk4pO1xuXG4gICAgaWYgKHRyYWNrTWF0Y2ggIT09IG51bGwpIHtcbiAgICAgIGlmIChyZXN1bHQudHJhY2tCeSAhPT0gbnVsbCkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdGb3IgbG9vcCBjYW4gb25seSBoYXZlIG9uZSBcInRyYWNrXCIgZXhwcmVzc2lvbicpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC50cmFja0J5ID0gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhwYXJhbSwgYmluZGluZ1BhcnNlciwgdHJhY2tNYXRjaFsxXSk7XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBlcnJvcnMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBsb29wIHBhcmFtYXRlciBcIiR7cGFyYW0uZXhwcmVzc2lvbn1cImApKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKiBQYXJzZXMgdGhlIGBsZXRgIHBhcmFtZXRlciBvZiBhIGBmb3JgIGxvb3AgYmxvY2suICovXG5mdW5jdGlvbiBwYXJzZUxldFBhcmFtZXRlcihcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGV4cHJlc3Npb246IHN0cmluZywgY29udGV4dDogdC5Gb3JMb29wQmxvY2tDb250ZXh0LFxuICAgIGVycm9yczogUGFyc2VFcnJvcltdKTogdm9pZCB7XG4gIGNvbnN0IHBhcnRzID0gZXhwcmVzc2lvbi5zcGxpdCgnLCcpO1xuXG4gIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgIGNvbnN0IGV4cHJlc3Npb25QYXJ0cyA9IHBhcnQuc3BsaXQoJz0nKTtcbiAgICBjb25zdCBuYW1lID0gZXhwcmVzc2lvblBhcnRzLmxlbmd0aCA9PT0gMiA/IGV4cHJlc3Npb25QYXJ0c1swXS50cmltKCkgOiAnJztcbiAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSBleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyID8gZXhwcmVzc2lvblBhcnRzWzFdLnRyaW0oKSA6ICcnO1xuXG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwIHx8IHZhcmlhYmxlTmFtZS5sZW5ndGggPT09IDApIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgICAgYEludmFsaWQgZm9yIGxvb3AgXCJsZXRcIiBwYXJhbWV0ZXIuIFBhcmFtZXRlciBzaG91bGQgbWF0Y2ggdGhlIHBhdHRlcm4gXCI8bmFtZT4gPSA8dmFyaWFibGUgbmFtZT5cImApKTtcbiAgICB9IGVsc2UgaWYgKCFBTExPV0VEX0ZPUl9MT09QX0xFVF9WQVJJQUJMRVMuaGFzKHZhcmlhYmxlTmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgICAgYFVua25vd24gXCJsZXRcIiBwYXJhbWV0ZXIgdmFyaWFibGUgXCIke3ZhcmlhYmxlTmFtZX1cIi4gVGhlIGFsbG93ZWQgdmFyaWFibGVzIGFyZTogJHtcbiAgICAgICAgICAgICAgQXJyYXkuZnJvbShBTExPV0VEX0ZPUl9MT09QX0xFVF9WQVJJQUJMRVMpLmpvaW4oJywgJyl9YCkpO1xuICAgIH0gZWxzZSBpZiAoY29udGV4dC5oYXNPd25Qcm9wZXJ0eSh2YXJpYWJsZU5hbWUpKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICBuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBgRHVwbGljYXRlIFwibGV0XCIgcGFyYW1ldGVyIHZhcmlhYmxlIFwiJHt2YXJpYWJsZU5hbWV9XCJgKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHRbdmFyaWFibGVOYW1lIGFzIGtleW9mIHQuRm9yTG9vcEJsb2NrQ29udGV4dF0gPSBuYW1lO1xuICAgIH1cbiAgfVxufVxuXG4vKiogQ2hlY2tzIHRoYXQgdGhlIHNoYXBlIG9mIGEgYGlmYCBibG9jayBpcyB2YWxpZC4gUmV0dXJucyBhbiBhcnJheSBvZiBlcnJvcnMuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUlmQmxvY2soYXN0OiBodG1sLkJsb2NrR3JvdXApOiBQYXJzZUVycm9yW10ge1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBsZXQgaGFzRWxzZSA9IGZhbHNlO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXN0LmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGJsb2NrID0gYXN0LmJsb2Nrc1tpXTtcblxuICAgIC8vIENvbmRpdGlvbmFsIGJsb2NrcyBvbmx5IGFsbG93IGBpZmAsIGBlbHNlIGlmYCBhbmQgYGVsc2VgIGJsb2Nrcy5cbiAgICBpZiAoKGJsb2NrLm5hbWUgIT09ICdpZicgfHwgaSA+IDApICYmIGJsb2NrLm5hbWUgIT09ICdlbHNlJykge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBjb25kaXRpb25hbCBibG9jayBcIiR7YmxvY2submFtZX1cImApKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChibG9jay5uYW1lID09PSAnaWYnKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGlmIChoYXNFbHNlKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBjYW4gb25seSBoYXZlIG9uZSBcImVsc2VcIiBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAoYXN0LmJsb2Nrcy5sZW5ndGggPiAxICYmIGkgPCBhc3QuYmxvY2tzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnRWxzZSBibG9jayBtdXN0IGJlIGxhc3QgaW5zaWRlIHRoZSBjb25kaXRpb25hbCcpKTtcbiAgICAgIH1cbiAgICAgIGhhc0Vsc2UgPSB0cnVlO1xuXG4gICAgICAvLyBgZWxzZSBpZmAgaXMgYW4gZWRnZSBjYXNlLCBiZWNhdXNlIGl0IGhhcyBhIHNwYWNlIGFmdGVyIHRoZSBibG9jayBuYW1lXG4gICAgICAvLyB3aGljaCBtZWFucyB0aGF0IHRoZSBgaWZgIGlzIGNhcHR1cmVkIGFzIGEgcGFydCBvZiB0aGUgcGFyYW1ldGVycy5cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA+IDAgJiYgIUVMU0VfSUZfUEFUVEVSTi50ZXN0KGJsb2NrLnBhcmFtZXRlcnNbMF0uZXhwcmVzc2lvbikpIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdFbHNlIGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMnKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVycm9ycztcbn1cblxuLyoqIENoZWNrcyB0aGF0IHRoZSBzaGFwZSBvZiBhIGBzd2l0Y2hgIGJsb2NrIGlzIHZhbGlkLiBSZXR1cm5zIGFuIGFycmF5IG9mIGVycm9ycy4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlU3dpdGNoQmxvY2soYXN0OiBodG1sLkJsb2NrR3JvdXApOiBQYXJzZUVycm9yW10ge1xuICBjb25zdCBbcHJpbWFyeUJsb2NrLCAuLi5zZWNvbmRhcnlCbG9ja3NdID0gYXN0LmJsb2NrcztcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgbGV0IGhhc0RlZmF1bHQgPSBmYWxzZTtcbiAgY29uc3QgaGFzUHJpbWFyeSA9IHByaW1hcnlCbG9jay5jaGlsZHJlbi5sZW5ndGggPiAwICYmIHByaW1hcnlCbG9jay5jaGlsZHJlbi5zb21lKGNoaWxkID0+IHtcbiAgICAvLyBUaGUgbWFpbiBibG9jayBtaWdodCBoYXZlIGVtcHR5IHRleHQgbm9kZXMgaWYgYHByZXNlcnZlV2hpdGVzcGFjZXNgIGlzIGVuYWJsZWQuXG4gICAgLy8gQWxsb3cgdGhlbSBzaW5jZSB0aGV5IG1pZ2h0IGJlIHVzZWQgZm9yIGNvZGUgZm9ybWF0dGluZy5cbiAgICByZXR1cm4gIShjaGlsZCBpbnN0YW5jZW9mIGh0bWwuVGV4dCkgfHwgY2hpbGQudmFsdWUudHJpbSgpLmxlbmd0aCA+IDA7XG4gIH0pO1xuXG4gIGlmIChoYXNQcmltYXJ5KSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgIHByaW1hcnlCbG9jay5zb3VyY2VTcGFuLCAnU3dpdGNoIGJsb2NrIGNhbiBvbmx5IGNvbnRhaW4gXCJjYXNlXCIgYW5kIFwiZGVmYXVsdFwiIGJsb2NrcycpKTtcbiAgfVxuXG4gIGlmIChwcmltYXJ5QmxvY2sucGFyYW1ldGVycy5sZW5ndGggIT09IDEpIHtcbiAgICBlcnJvcnMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlRXJyb3IocHJpbWFyeUJsb2NrLnNvdXJjZVNwYW4sICdTd2l0Y2ggYmxvY2sgbXVzdCBoYXZlIGV4YWN0bHkgb25lIHBhcmFtZXRlcicpKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYmxvY2sgb2Ygc2Vjb25kYXJ5QmxvY2tzKSB7XG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdjYXNlJykge1xuICAgICAgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdDYXNlIGJsb2NrIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbWV0ZXInKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChibG9jay5uYW1lID09PSAnZGVmYXVsdCcpIHtcbiAgICAgIGlmIChoYXNEZWZhdWx0KSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ1N3aXRjaCBibG9jayBjYW4gb25seSBoYXZlIG9uZSBcImRlZmF1bHRcIiBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdEZWZhdWx0IGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMnKSk7XG4gICAgICB9XG4gICAgICBoYXNEZWZhdWx0ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgYmxvY2suc291cmNlU3BhbiwgJ1N3aXRjaCBibG9jayBjYW4gb25seSBjb250YWluIFwiY2FzZVwiIGFuZCBcImRlZmF1bHRcIiBibG9ja3MnKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVycm9ycztcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBibG9jayBwYXJhbWV0ZXIgaW50byBhIGJpbmRpbmcgQVNULlxuICogQHBhcmFtIGFzdCBCbG9jayBwYXJhbWV0ZXIgdGhhdCBzaG91bGQgYmUgcGFyc2VkLlxuICogQHBhcmFtIGJpbmRpbmdQYXJzZXIgUGFyc2VyIHRoYXQgdGhlIGV4cHJlc3Npb24gc2hvdWxkIGJlIHBhcnNlZCB3aXRoLlxuICogQHBhcmFtIHN0YXJ0IEluZGV4IGZyb20gd2hpY2ggdG8gc3RhcnQgdGhlIHBhcnNpbmcuIERlZmF1bHRzIHRvIDAuXG4gKi9cbmZ1bmN0aW9uIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoXG4gICAgYXN0OiBodG1sLkJsb2NrUGFyYW1ldGVyLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBzdGFydD86IG51bWJlcik6IEFTVFdpdGhTb3VyY2U7XG5cbi8qKlxuICogUGFyc2VzIGEgYmxvY2sgcGFyYW1ldGVyIGludG8gYSBiaW5kaW5nIEFTVC5cbiAqIEBwYXJhbSBhc3QgQmxvY2sgcGFyYW1ldGVyIHRoYXQgc2hvdWxkIGJlIHBhcnNlZC5cbiAqIEBwYXJhbSBiaW5kaW5nUGFyc2VyIFBhcnNlciB0aGF0IHRoZSBleHByZXNzaW9uIHNob3VsZCBiZSBwYXJzZWQgd2l0aC5cbiAqIEBwYXJhbSBwYXJ0IFNwZWNpZmljIHBhcnQgb2YgdGhlIGV4cHJlc3Npb24gdGhhdCBzaG91bGQgYmUgcGFyc2VkLlxuICovXG5mdW5jdGlvbiBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKFxuICAgIGFzdDogaHRtbC5CbG9ja1BhcmFtZXRlciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgcGFydDogc3RyaW5nKTogQVNUV2l0aFNvdXJjZTtcblxuZnVuY3Rpb24gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhcbiAgICBhc3Q6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4gICAgcGFydDogc3RyaW5nfG51bWJlciA9IDApOiBBU1RXaXRoU291cmNlIHtcbiAgbGV0IHN0YXJ0OiBudW1iZXI7XG4gIGxldCBlbmQ6IG51bWJlcjtcblxuICBpZiAodHlwZW9mIHBhcnQgPT09ICdudW1iZXInKSB7XG4gICAgc3RhcnQgPSBwYXJ0O1xuICAgIGVuZCA9IGFzdC5leHByZXNzaW9uLmxlbmd0aDtcbiAgfSBlbHNlIHtcbiAgICAvLyBOb3RlOiBgbGFzdEluZGV4T2ZgIGhlcmUgc2hvdWxkIGJlIGVub3VnaCB0byBrbm93IHRoZSBzdGFydCBpbmRleCBvZiB0aGUgZXhwcmVzc2lvbixcbiAgICAvLyBiZWNhdXNlIHdlIGtub3cgdGhhdCBpdCdsbCBiZSBhdCB0aGUgZW5kIG9mIHRoZSBwYXJhbS4gSWRlYWxseSB3ZSBjb3VsZCB1c2UgdGhlIGBkYFxuICAgIC8vIGZsYWcgd2hlbiBtYXRjaGluZyB2aWEgcmVnZXggYW5kIGdldCB0aGUgaW5kZXggZnJvbSBgbWF0Y2guaW5kaWNlc2AsIGJ1dCBpdCdzIHVuY2xlYXJcbiAgICAvLyBpZiB3ZSBjYW4gdXNlIGl0IHlldCBzaW5jZSBpdCdzIGEgcmVsYXRpdmVseSBuZXcgZmVhdHVyZS4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L3Byb3Bvc2FsLXJlZ2V4cC1tYXRjaC1pbmRpY2VzXG4gICAgc3RhcnQgPSBNYXRoLm1heCgwLCBhc3QuZXhwcmVzc2lvbi5sYXN0SW5kZXhPZihwYXJ0KSk7XG4gICAgZW5kID0gc3RhcnQgKyBwYXJ0Lmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLnBhcnNlQmluZGluZyhcbiAgICAgIGFzdC5leHByZXNzaW9uLnNsaWNlKHN0YXJ0LCBlbmQpLCBmYWxzZSwgYXN0LnNvdXJjZVNwYW4sIGFzdC5zb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCArIHN0YXJ0KTtcbn1cblxuLyoqIFBhcnNlcyB0aGUgcGFyYW1ldGVyIG9mIGEgY29uZGl0aW9uYWwgYmxvY2sgKGBpZmAgb3IgYGVsc2UgaWZgKS4gKi9cbmZ1bmN0aW9uIHBhcnNlQ29uZGl0aW9uYWxCbG9ja1BhcmFtZXRlcnMoXG4gICAgYmxvY2s6IGh0bWwuQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBibG9jayBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBpc1ByaW1hcnlJZkJsb2NrID0gYmxvY2submFtZSA9PT0gJ2lmJztcbiAgY29uc3QgZXhwcmVzc2lvbiA9XG4gICAgICAvLyBFeHByZXNzaW9ucyBmb3IgYHs6ZWxzZSBpZn1gIGJsb2NrcyBzdGFydCBhdCAyIHRvIHNraXAgdGhlIGBpZmAgZnJvbSB0aGUgZXhwcmVzc2lvbi5cbiAgICAgIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoYmxvY2sucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlciwgaXNQcmltYXJ5SWZCbG9jayA/IDAgOiAyKTtcbiAgbGV0IGV4cHJlc3Npb25BbGlhczogc3RyaW5nfG51bGwgPSBudWxsO1xuXG4gIC8vIFN0YXJ0IGZyb20gMSBzaW5jZSB3ZSBwcm9jZXNzZWQgdGhlIGZpcnN0IHBhcmFtZXRlciBhbHJlYWR5LlxuICBmb3IgKGxldCBpID0gMTsgaSA8IGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBwYXJhbSA9IGJsb2NrLnBhcmFtZXRlcnNbaV07XG4gICAgY29uc3QgYWxpYXNNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goQ09ORElUSU9OQUxfQUxJQVNfUEFUVEVSTik7XG5cbiAgICAvLyBGb3Igbm93IGNvbmRpdGlvbmFscyBjYW4gb25seSBoYXZlIGFuIGBhc2AgcGFyYW1ldGVyLlxuICAgIC8vIFdlIG1heSB3YW50IHRvIHJld29yayB0aGlzIGxhdGVyIGlmIHdlIGFkZCBtb3JlLlxuICAgIGlmIChhbGlhc01hdGNoID09PSBudWxsKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICBwYXJhbS5zb3VyY2VTcGFuLCBgVW5yZWNvZ25pemVkIGNvbmRpdGlvbmFsIHBhcmFtYXRlciBcIiR7cGFyYW0uZXhwcmVzc2lvbn1cImApKTtcbiAgICB9IGVsc2UgaWYgKCFpc1ByaW1hcnlJZkJsb2NrKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICBwYXJhbS5zb3VyY2VTcGFuLCAnXCJhc1wiIGV4cHJlc3Npb24gaXMgb25seSBhbGxvd2VkIG9uIHRoZSBwcmltYXJ5IFwiaWZcIiBibG9jaycpKTtcbiAgICB9IGVsc2UgaWYgKGV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ0NvbmRpdGlvbmFsIGNhbiBvbmx5IGhhdmUgb25lIFwiYXNcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHByZXNzaW9uQWxpYXMgPSBhbGlhc01hdGNoWzFdLnRyaW0oKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2V4cHJlc3Npb24sIGV4cHJlc3Npb25BbGlhc307XG59XG5cbi8qKiBTdHJpcHMgb3B0aW9uYWwgcGFyZW50aGVzZXMgYXJvdW5kIGZyb20gYSBjb250cm9sIGZyb20gZXhwcmVzc2lvbiBwYXJhbWV0ZXIuICovXG5mdW5jdGlvbiBzdHJpcE9wdGlvbmFsUGFyZW50aGVzZXMocGFyYW06IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGVycm9yczogUGFyc2VFcnJvcltdKTogc3RyaW5nfG51bGwge1xuICBjb25zdCBleHByZXNzaW9uID0gcGFyYW0uZXhwcmVzc2lvbjtcbiAgY29uc3Qgc3BhY2VSZWdleCA9IC9eXFxzJC87XG4gIGxldCBvcGVuUGFyZW5zID0gMDtcbiAgbGV0IHN0YXJ0ID0gMDtcbiAgbGV0IGVuZCA9IGV4cHJlc3Npb24ubGVuZ3RoIC0gMTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHJlc3Npb24ubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaGFyID0gZXhwcmVzc2lvbltpXTtcblxuICAgIGlmIChjaGFyID09PSAnKCcpIHtcbiAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICBvcGVuUGFyZW5zKys7XG4gICAgfSBlbHNlIGlmIChzcGFjZVJlZ2V4LnRlc3QoY2hhcikpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAob3BlblBhcmVucyA9PT0gMCkge1xuICAgIHJldHVybiBleHByZXNzaW9uO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IGV4cHJlc3Npb24ubGVuZ3RoIC0gMTsgaSA+IC0xOyBpLS0pIHtcbiAgICBjb25zdCBjaGFyID0gZXhwcmVzc2lvbltpXTtcblxuICAgIGlmIChjaGFyID09PSAnKScpIHtcbiAgICAgIGVuZCA9IGk7XG4gICAgICBvcGVuUGFyZW5zLS07XG4gICAgICBpZiAob3BlblBhcmVucyA9PT0gMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNwYWNlUmVnZXgudGVzdChjaGFyKSkge1xuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChvcGVuUGFyZW5zICE9PSAwKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ1VuY2xvc2VkIHBhcmVudGhlc2VzIGluIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gZXhwcmVzc2lvbi5zbGljZShzdGFydCwgZW5kKTtcbn1cbiJdfQ==