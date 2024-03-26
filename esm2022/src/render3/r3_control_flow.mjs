/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { EmptyExpr } from '../expression_parser/ast';
import * as html from '../ml_parser/ast';
import { ParseError, ParseSourceSpan } from '../parse_util';
import * as t from './r3_ast';
/** Pattern for the expression in a for loop block. */
const FOR_LOOP_EXPRESSION_PATTERN = /^\s*([0-9A-Za-z_$]*)\s+of\s+([\S\s]*)/;
/** Pattern for the tracking expression in a for loop block. */
const FOR_LOOP_TRACK_PATTERN = /^track\s+([\S\s]*)/;
/** Pattern for the `as` expression in a conditional block. */
const CONDITIONAL_ALIAS_PATTERN = /^(as\s)+(.*)/;
/** Pattern used to identify an `else if` block. */
const ELSE_IF_PATTERN = /^else[^\S\r\n]+if/;
/** Pattern used to identify a `let` parameter. */
const FOR_LOOP_LET_PATTERN = /^let\s+([\S\s]*)/;
/**
 * Pattern to group a string into leading whitespace, non whitespace, and trailing whitespace.
 * Useful for getting the variable name span when a span can contain leading and trailing space.
 */
const CHARACTERS_IN_SURROUNDING_WHITESPACE_PATTERN = /(\s*)(\S+)(\s*)/;
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
        branches.push(new t.IfBlockBranch(mainBlockParams.expression, html.visitAll(visitor, ast.children, ast.children), mainBlockParams.expressionAlias, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.nameSpan, ast.i18n));
    }
    for (const block of connectedBlocks) {
        if (ELSE_IF_PATTERN.test(block.name)) {
            const params = parseConditionalBlockParameters(block, errors, bindingParser);
            if (params !== null) {
                const children = html.visitAll(visitor, block.children, block.children);
                branches.push(new t.IfBlockBranch(params.expression, children, params.expressionAlias, block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan, block.i18n));
            }
        }
        else if (block.name === 'else') {
            const children = html.visitAll(visitor, block.children, block.children);
            branches.push(new t.IfBlockBranch(null, children, null, block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan, block.i18n));
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
                empty = new t.ForLoopBlockEmpty(html.visitAll(visitor, block.children, block.children), block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan, block.i18n);
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
            node = new t.ForLoopBlock(params.itemName, params.expression, params.trackBy.expression, params.trackBy.keywordSpan, params.context, html.visitAll(visitor, ast.children, ast.children), empty, sourceSpan, ast.sourceSpan, ast.startSourceSpan, endSpan, ast.nameSpan, ast.i18n);
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
        const ast = new t.SwitchBlockCase(expression, html.visitAll(visitor, node.children, node.children), node.sourceSpan, node.startSourceSpan, node.endSourceSpan, node.nameSpan, node.i18n);
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
    if (ALLOWED_FOR_LOOP_LET_VARIABLES.has(itemName)) {
        errors.push(new ParseError(expressionParam.sourceSpan, `@for loop item name cannot be one of ${Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES).join(', ')}.`));
    }
    // `expressionParam.expression` contains the variable declaration and the expression of the
    // for...of statement, i.e. 'user of users' The variable of a ForOfStatement is _only_ the "const
    // user" part and does not include "of x".
    const variableName = expressionParam.expression.split(' ')[0];
    const variableSpan = new ParseSourceSpan(expressionParam.sourceSpan.start, expressionParam.sourceSpan.start.moveBy(variableName.length));
    const result = {
        itemName: new t.Variable(itemName, '$implicit', variableSpan, variableSpan),
        trackBy: null,
        expression: parseBlockParameterToBinding(expressionParam, bindingParser, rawExpression),
        context: Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES, variableName => {
            // Give ambiently-available context variables empty spans at the end of
            // the start of the `for` block, since they are not explicitly defined.
            const emptySpanAfterForBlockStart = new ParseSourceSpan(block.startSourceSpan.end, block.startSourceSpan.end);
            return new t.Variable(variableName, variableName, emptySpanAfterForBlockStart, emptySpanAfterForBlockStart);
        }),
    };
    for (const param of secondaryParams) {
        const letMatch = param.expression.match(FOR_LOOP_LET_PATTERN);
        if (letMatch !== null) {
            const variablesSpan = new ParseSourceSpan(param.sourceSpan.start.moveBy(letMatch[0].length - letMatch[1].length), param.sourceSpan.end);
            parseLetParameter(param.sourceSpan, letMatch[1], variablesSpan, itemName, result.context, errors);
            continue;
        }
        const trackMatch = param.expression.match(FOR_LOOP_TRACK_PATTERN);
        if (trackMatch !== null) {
            if (result.trackBy !== null) {
                errors.push(new ParseError(param.sourceSpan, '@for loop can only have one "track" expression'));
            }
            else {
                const expression = parseBlockParameterToBinding(param, bindingParser, trackMatch[1]);
                if (expression.ast instanceof EmptyExpr) {
                    errors.push(new ParseError(param.sourceSpan, '@for loop must have a "track" expression'));
                }
                const keywordSpan = new ParseSourceSpan(param.sourceSpan.start, param.sourceSpan.start.moveBy('track'.length));
                result.trackBy = { expression, keywordSpan };
            }
            continue;
        }
        errors.push(new ParseError(param.sourceSpan, `Unrecognized @for loop paramater "${param.expression}"`));
    }
    return result;
}
/** Parses the `let` parameter of a `for` loop block. */
function parseLetParameter(sourceSpan, expression, span, loopItemName, context, errors) {
    const parts = expression.split(',');
    let startSpan = span.start;
    for (const part of parts) {
        const expressionParts = part.split('=');
        const name = expressionParts.length === 2 ? expressionParts[0].trim() : '';
        const variableName = expressionParts.length === 2 ? expressionParts[1].trim() : '';
        if (name.length === 0 || variableName.length === 0) {
            errors.push(new ParseError(sourceSpan, `Invalid @for loop "let" parameter. Parameter should match the pattern "<name> = <variable name>"`));
        }
        else if (!ALLOWED_FOR_LOOP_LET_VARIABLES.has(variableName)) {
            errors.push(new ParseError(sourceSpan, `Unknown "let" parameter variable "${variableName}". The allowed variables are: ${Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES).join(', ')}`));
        }
        else if (name === loopItemName) {
            errors.push(new ParseError(sourceSpan, `Invalid @for loop "let" parameter. Variable cannot be called "${loopItemName}"`));
        }
        else if (context.some(v => v.name === name)) {
            errors.push(new ParseError(sourceSpan, `Duplicate "let" parameter variable "${variableName}"`));
        }
        else {
            const [, keyLeadingWhitespace, keyName] = expressionParts[0].match(CHARACTERS_IN_SURROUNDING_WHITESPACE_PATTERN) ?? [];
            const keySpan = keyLeadingWhitespace !== undefined && expressionParts.length === 2 ?
                new ParseSourceSpan(
                /* strip leading spaces */
                startSpan.moveBy(keyLeadingWhitespace.length), 
                /* advance to end of the variable name */
                startSpan.moveBy(keyLeadingWhitespace.length + keyName.length)) :
                span;
            let valueSpan = undefined;
            if (expressionParts.length === 2) {
                const [, valueLeadingWhitespace, implicit] = expressionParts[1].match(CHARACTERS_IN_SURROUNDING_WHITESPACE_PATTERN) ?? [];
                valueSpan = valueLeadingWhitespace !== undefined ?
                    new ParseSourceSpan(startSpan.moveBy(expressionParts[0].length + 1 + valueLeadingWhitespace.length), startSpan.moveBy(expressionParts[0].length + 1 + valueLeadingWhitespace.length +
                        implicit.length)) :
                    undefined;
            }
            const sourceSpan = new ParseSourceSpan(keySpan.start, valueSpan?.end ?? keySpan.end);
            context.push(new t.Variable(name, variableName, sourceSpan, keySpan, valueSpan));
        }
        startSpan = startSpan.moveBy(part.length + 1 /* add 1 to move past the comma */);
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
            const name = aliasMatch[2].trim();
            const variableStart = param.sourceSpan.start.moveBy(aliasMatch[1].length);
            const variableSpan = new ParseSourceSpan(variableStart, variableStart.moveBy(name.length));
            expressionAlias = new t.Variable(name, name, variableSpan, variableSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBZ0IsU0FBUyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDbEUsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUcxRCxPQUFPLEtBQUssQ0FBQyxNQUFNLFVBQVUsQ0FBQztBQUU5QixzREFBc0Q7QUFDdEQsTUFBTSwyQkFBMkIsR0FBRyx1Q0FBdUMsQ0FBQztBQUU1RSwrREFBK0Q7QUFDL0QsTUFBTSxzQkFBc0IsR0FBRyxvQkFBb0IsQ0FBQztBQUVwRCw4REFBOEQ7QUFDOUQsTUFBTSx5QkFBeUIsR0FBRyxjQUFjLENBQUM7QUFFakQsbURBQW1EO0FBQ25ELE1BQU0sZUFBZSxHQUFHLG1CQUFtQixDQUFDO0FBRTVDLGtEQUFrRDtBQUNsRCxNQUFNLG9CQUFvQixHQUFHLGtCQUFrQixDQUFDO0FBRWhEOzs7R0FHRztBQUNILE1BQU0sNENBQTRDLEdBQUcsaUJBQWlCLENBQUM7QUFFdkUsOEZBQThGO0FBQzlGLE1BQU0sOEJBQThCLEdBQ2hDLElBQUksR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBRXRFOzs7R0FHRztBQUNILE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxJQUFZO0lBQ2xELE9BQU8sSUFBSSxLQUFLLE9BQU8sQ0FBQztBQUMxQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLElBQVk7SUFDakQsT0FBTyxJ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QUFFLEVBQUUsQ0FBQztRQUNoRCxNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFM0IsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7WUFDakIsR0FBRyxHQUFHLENBQUMsQ0FBQztZQUNSLFVBQVUsRUFBRSxDQUFDO1lBQ2IsSUFBSSxVQUFVLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3JCLE1BQU07WUFDUixDQUFDO1FBQ0gsQ0FBQzthQUFNLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFNBQVM7UUFDWCxDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU07UUFDUixDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksVUFBVSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxvQ0FBb0MsQ0FBQyxDQUFDLENBQUM7UUFDcEYsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN0QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNUV2l0aFNvdXJjZSwgRW1wdHlFeHByfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcblxuaW1wb3J0ICogYXMgdCBmcm9tICcuL3IzX2FzdCc7XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgZXhwcmVzc2lvbiBpbiBhIGZvciBsb29wIGJsb2NrLiAqL1xuY29uc3QgRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOID0gL15cXHMqKFswLTlBLVphLXpfJF0qKVxccytvZlxccysoW1xcU1xcc10qKS87XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgdHJhY2tpbmcgZXhwcmVzc2lvbiBpbiBhIGZvciBsb29wIGJsb2NrLiAqL1xuY29uc3QgRk9SX0xPT1BfVFJBQ0tfUEFUVEVSTiA9IC9edHJhY2tcXHMrKFtcXFNcXHNdKikvO1xuXG4vKiogUGF0dGVybiBmb3IgdGhlIGBhc2AgZXhwcmVzc2lvbiBpbiBhIGNvbmRpdGlvbmFsIGJsb2NrLiAqL1xuY29uc3QgQ09ORElUSU9OQUxfQUxJQVNfUEFUVEVSTiA9IC9eKGFzXFxzKSsoLiopLztcblxuLyoqIFBhdHRlcm4gdXNlZCB0byBpZGVudGlmeSBhbiBgZWxzZSBpZmAgYmxvY2suICovXG5jb25zdCBFTFNFX0lGX1BBVFRFUk4gPSAvXmVsc2VbXlxcU1xcclxcbl0raWYvO1xuXG4vKiogUGF0dGVybiB1c2VkIHRvIGlkZW50aWZ5IGEgYGxldGAgcGFyYW1ldGVyLiAqL1xuY29uc3QgRk9SX0xPT1BfTEVUX1BBVFRFUk4gPSAvXmxldFxccysoW1xcU1xcc10qKS87XG5cbi8qKlxuICogUGF0dGVybiB0byBncm91cCBhIHN0cmluZyBpbnRvIGxlYWRpbmcgd2hpdGVzcGFjZSwgbm9uIHdoaXRlc3BhY2UsIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlLlxuICogVXNlZnVsIGZvciBnZXR0aW5nIHRoZSB2YXJpYWJsZSBuYW1lIHNwYW4gd2hlbiBhIHNwYW4gY2FuIGNvbnRhaW4gbGVhZGluZyBhbmQgdHJhaWxpbmcgc3BhY2UuXG4gKi9cbmNvbnN0IENIQVJBQ1RFUlNfSU5fU1VSUk9VTkRJTkdfV0hJVEVTUEFDRV9QQVRURVJOID0gLyhcXHMqKShcXFMrKShcXHMqKS87XG5cbi8qKiBOYW1lcyBvZiB2YXJpYWJsZXMgdGhhdCBhcmUgYWxsb3dlZCB0byBiZSB1c2VkIGluIHRoZSBgbGV0YCBleHByZXNzaW9uIG9mIGEgYGZvcmAgbG9vcC4gKi9cbmNvbnN0IEFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUyA9XG4gICAgbmV3IFNldChbJyRpbmRleCcsICckZmlyc3QnLCAnJGxhc3QnLCAnJGV2ZW4nLCAnJG9kZCcsICckY291bnQnXSk7XG5cbi8qKlxuICogUHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgZGV0ZXJtaW5lcyBpZiBhIGJsb2NrIHdpdGhcbiAqIGEgc3BlY2lmaWMgbmFtZSBjYW0gYmUgY29ubmVjdGVkIHRvIGEgYGZvcmAgYmxvY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Nvbm5lY3RlZEZvckxvb3BCbG9jayhuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5hbWUgPT09ICdlbXB0eSc7XG59XG5cbi8qKlxuICogUHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgZGV0ZXJtaW5lcyBpZiBhIGJsb2NrIHdpdGhcbiAqIGEgc3BlY2lmaWMgbmFtZSBjYW0gYmUgY29ubmVjdGVkIHRvIGFuIGBpZmAgYmxvY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Nvbm5lY3RlZElmTG9vcEJsb2NrKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmFtZSA9PT0gJ2Vsc2UnIHx8IEVMU0VfSUZfUEFUVEVSTi50ZXN0KG5hbWUpO1xufVxuXG4vKiogQ3JlYXRlcyBhbiBgaWZgIGxvb3AgYmxvY2sgZnJvbSBhbiBIVE1MIEFTVCBub2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUlmQmxvY2soXG4gICAgYXN0OiBodG1sLkJsb2NrLCBjb25uZWN0ZWRCbG9ja3M6IGh0bWwuQmxvY2tbXSwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5JZkJsb2NrfG51bGwsIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gdmFsaWRhdGVJZkNvbm5lY3RlZEJsb2Nrcyhjb25uZWN0ZWRCbG9ja3MpO1xuICBjb25zdCBicmFuY2hlczogdC5JZkJsb2NrQnJhbmNoW10gPSBbXTtcbiAgY29uc3QgbWFpbkJsb2NrUGFyYW1zID0gcGFyc2VDb25kaXRpb25hbEJsb2NrUGFyYW1ldGVycyhhc3QsIGVycm9ycywgYmluZGluZ1BhcnNlcik7XG5cbiAgaWYgKG1haW5CbG9ja1BhcmFtcyAhPT0gbnVsbCkge1xuICAgIGJyYW5jaGVzLnB1c2gobmV3IHQuSWZCbG9ja0JyYW5jaChcbiAgICAgICAgbWFpbkJsb2NrUGFyYW1zLmV4cHJlc3Npb24sIGh0bWwudmlzaXRBbGwodmlzaXRvciwgYXN0LmNoaWxkcmVuLCBhc3QuY2hpbGRyZW4pLFxuICAgICAgICBtYWluQmxvY2tQYXJhbXMuZXhwcmVzc2lvbkFsaWFzLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4sXG4gICAgICAgIGFzdC5uYW1lU3BhbiwgYXN0LmkxOG4pKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYmxvY2sgb2YgY29ubmVjdGVkQmxvY2tzKSB7XG4gICAgaWYgKEVMU0VfSUZfUEFUVEVSTi50ZXN0KGJsb2NrLm5hbWUpKSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKGJsb2NrLCBlcnJvcnMsIGJpbmRpbmdQYXJzZXIpO1xuXG4gICAgICBpZiAocGFyYW1zICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiwgYmxvY2suY2hpbGRyZW4pO1xuICAgICAgICBicmFuY2hlcy5wdXNoKG5ldyB0LklmQmxvY2tCcmFuY2goXG4gICAgICAgICAgICBwYXJhbXMuZXhwcmVzc2lvbiwgY2hpbGRyZW4sIHBhcmFtcy5leHByZXNzaW9uQWxpYXMsIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sIGJsb2NrLmVuZFNvdXJjZVNwYW4sIGJsb2NrLm5hbWVTcGFuLCBibG9jay5pMThuKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChibG9jay5uYW1lID09PSAnZWxzZScpIHtcbiAgICAgIGNvbnN0IGNoaWxkcmVuID0gaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiwgYmxvY2suY2hpbGRyZW4pO1xuICAgICAgYnJhbmNoZXMucHVzaChuZXcgdC5JZkJsb2NrQnJhbmNoKFxuICAgICAgICAgIG51bGwsIGNoaWxkcmVuLCBudWxsLCBibG9jay5zb3VyY2VTcGFuLCBibG9jay5zdGFydFNvdXJjZVNwYW4sIGJsb2NrLmVuZFNvdXJjZVNwYW4sXG4gICAgICAgICAgYmxvY2submFtZVNwYW4sIGJsb2NrLmkxOG4pKTtcbiAgICB9XG4gIH1cblxuICAvLyBUaGUgb3V0ZXIgSWZCbG9jayBzaG91bGQgaGF2ZSBhIHNwYW4gdGhhdCBlbmNhcHN1bGF0ZXMgYWxsIGJyYW5jaGVzLlxuICBjb25zdCBpZkJsb2NrU3RhcnRTb3VyY2VTcGFuID1cbiAgICAgIGJyYW5jaGVzLmxlbmd0aCA+IDAgPyBicmFuY2hlc1swXS5zdGFydFNvdXJjZVNwYW4gOiBhc3Quc3RhcnRTb3VyY2VTcGFuO1xuICBjb25zdCBpZkJsb2NrRW5kU291cmNlU3BhbiA9XG4gICAgICBicmFuY2hlcy5sZW5ndGggPiAwID8gYnJhbmNoZXNbYnJhbmNoZXMubGVuZ3RoIC0gMV0uZW5kU291cmNlU3BhbiA6IGFzdC5lbmRTb3VyY2VTcGFuO1xuXG4gIGxldCB3aG9sZVNvdXJjZVNwYW4gPSBhc3Quc291cmNlU3BhbjtcbiAgY29uc3QgbGFzdEJyYW5jaCA9IGJyYW5jaGVzW2JyYW5jaGVzLmxlbmd0aCAtIDFdO1xuICBpZiAobGFzdEJyYW5jaCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgd2hvbGVTb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihpZkJsb2NrU3RhcnRTb3VyY2VTcGFuLnN0YXJ0LCBsYXN0QnJhbmNoLnNvdXJjZVNwYW4uZW5kKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbm9kZTogbmV3IHQuSWZCbG9jayhcbiAgICAgICAgYnJhbmNoZXMsIHdob2xlU291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgaWZCbG9ja0VuZFNvdXJjZVNwYW4sIGFzdC5uYW1lU3BhbiksXG4gICAgZXJyb3JzLFxuICB9O1xufVxuXG4vKiogQ3JlYXRlcyBhIGBmb3JgIGxvb3AgYmxvY2sgZnJvbSBhbiBIVE1MIEFTVCBub2RlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZvckxvb3AoXG4gICAgYXN0OiBodG1sLkJsb2NrLCBjb25uZWN0ZWRCbG9ja3M6IGh0bWwuQmxvY2tbXSwgdmlzaXRvcjogaHRtbC5WaXNpdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7bm9kZTogdC5Gb3JMb29wQmxvY2t8bnVsbCwgZXJyb3JzOiBQYXJzZUVycm9yW119IHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgY29uc3QgcGFyYW1zID0gcGFyc2VGb3JMb29wUGFyYW1ldGVycyhhc3QsIGVycm9ycywgYmluZGluZ1BhcnNlcik7XG4gIGxldCBub2RlOiB0LkZvckxvb3BCbG9ja3xudWxsID0gbnVsbDtcbiAgbGV0IGVtcHR5OiB0LkZvckxvb3BCbG9ja0VtcHR5fG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgYmxvY2sgb2YgY29ubmVjdGVkQmxvY2tzKSB7XG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdlbXB0eScpIHtcbiAgICAgIGlmIChlbXB0eSAhPT0gbnVsbCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQGZvciBsb29wIGNhbiBvbmx5IGhhdmUgb25lIEBlbXB0eSBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdAZW1wdHkgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVtcHR5ID0gbmV3IHQuRm9yTG9vcEJsb2NrRW1wdHkoXG4gICAgICAgICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuLCBibG9jay5jaGlsZHJlbiksIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICBibG9jay5zdGFydFNvdXJjZVNwYW4sIGJsb2NrLmVuZFNvdXJjZVNwYW4sIGJsb2NrLm5hbWVTcGFuLCBibG9jay5pMThuKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBAZm9yIGxvb3AgYmxvY2sgXCIke2Jsb2NrLm5hbWV9XCJgKSk7XG4gICAgfVxuICB9XG5cblxuICBpZiAocGFyYW1zICE9PSBudWxsKSB7XG4gICAgaWYgKHBhcmFtcy50cmFja0J5ID09PSBudWxsKSB7XG4gICAgICAvLyBUT0RPOiBXZSBzaG91bGQgbm90IGZhaWwgaGVyZSwgYW5kIGluc3RlYWQgdHJ5IHRvIHByb2R1Y2Ugc29tZSBBU1QgZm9yIHRoZSBsYW5ndWFnZVxuICAgICAgLy8gc2VydmljZS5cbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGFzdC5zb3VyY2VTcGFuLCAnQGZvciBsb29wIG11c3QgaGF2ZSBhIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgYGZvcmAgYmxvY2sgaGFzIGEgbWFpbiBzcGFuIHRoYXQgaW5jbHVkZXMgdGhlIGBlbXB0eWAgYnJhbmNoLiBGb3Igb25seSB0aGUgc3BhbiBvZiB0aGVcbiAgICAgIC8vIG1haW4gYGZvcmAgYm9keSwgdXNlIGBtYWluU291cmNlU3BhbmAuXG4gICAgICBjb25zdCBlbmRTcGFuID0gZW1wdHk/LmVuZFNvdXJjZVNwYW4gPz8gYXN0LmVuZFNvdXJjZVNwYW47XG4gICAgICBjb25zdCBzb3VyY2VTcGFuID1cbiAgICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKGFzdC5zb3VyY2VTcGFuLnN0YXJ0LCBlbmRTcGFuPy5lbmQgPz8gYXN0LnNvdXJjZVNwYW4uZW5kKTtcbiAgICAgIG5vZGUgPSBuZXcgdC5Gb3JMb29wQmxvY2soXG4gICAgICAgICAgcGFyYW1zLml0ZW1OYW1lLCBwYXJhbXMuZXhwcmVzc2lvbiwgcGFyYW1zLnRyYWNrQnkuZXhwcmVzc2lvbiwgcGFyYW1zLnRyYWNrQnkua2V5d29yZFNwYW4sXG4gICAgICAgICAgcGFyYW1zLmNvbnRleHQsIGh0bWwudmlzaXRBbGwodmlzaXRvciwgYXN0LmNoaWxkcmVuLCBhc3QuY2hpbGRyZW4pLCBlbXB0eSwgc291cmNlU3BhbixcbiAgICAgICAgICBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbiwgZW5kU3BhbiwgYXN0Lm5hbWVTcGFuLCBhc3QuaTE4bik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtub2RlLCBlcnJvcnN9O1xufVxuXG4vKiogQ3JlYXRlcyBhIHN3aXRjaCBibG9jayBmcm9tIGFuIEhUTUwgQVNUIG5vZGUuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3dpdGNoQmxvY2soXG4gICAgYXN0OiBodG1sLkJsb2NrLCB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtub2RlOiB0LlN3aXRjaEJsb2NrfG51bGwsIGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlU3dpdGNoQmxvY2soYXN0KTtcbiAgY29uc3QgcHJpbWFyeUV4cHJlc3Npb24gPSBhc3QucGFyYW1ldGVycy5sZW5ndGggPiAwID9cbiAgICAgIHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcoYXN0LnBhcmFtZXRlcnNbMF0sIGJpbmRpbmdQYXJzZXIpIDpcbiAgICAgIGJpbmRpbmdQYXJzZXIucGFyc2VCaW5kaW5nKCcnLCBmYWxzZSwgYXN0LnNvdXJjZVNwYW4sIDApO1xuICBjb25zdCBjYXNlczogdC5Td2l0Y2hCbG9ja0Nhc2VbXSA9IFtdO1xuICBjb25zdCB1bmtub3duQmxvY2tzOiB0LlVua25vd25CbG9ja1tdID0gW107XG4gIGxldCBkZWZhdWx0Q2FzZTogdC5Td2l0Y2hCbG9ja0Nhc2V8bnVsbCA9IG51bGw7XG5cbiAgLy8gSGVyZSB3ZSBhc3N1bWUgdGhhdCBhbGwgdGhlIGJsb2NrcyBhcmUgdmFsaWQgZ2l2ZW4gdGhhdCB3ZSB2YWxpZGF0ZWQgdGhlbSBhYm92ZS5cbiAgZm9yIChjb25zdCBub2RlIG9mIGFzdC5jaGlsZHJlbikge1xuICAgIGlmICghKG5vZGUgaW5zdGFuY2VvZiBodG1sLkJsb2NrKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKChub2RlLm5hbWUgIT09ICdjYXNlJyB8fCBub2RlLnBhcmFtZXRlcnMubGVuZ3RoID09PSAwKSAmJiBub2RlLm5hbWUgIT09ICdkZWZhdWx0Jykge1xuICAgICAgdW5rbm93bkJsb2Nrcy5wdXNoKG5ldyB0LlVua25vd25CbG9jayhub2RlLm5hbWUsIG5vZGUuc291cmNlU3Bhbiwgbm9kZS5uYW1lU3BhbikpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IG5vZGUubmFtZSA9PT0gJ2Nhc2UnID9cbiAgICAgICAgcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhub2RlLnBhcmFtZXRlcnNbMF0sIGJpbmRpbmdQYXJzZXIpIDpcbiAgICAgICAgbnVsbDtcbiAgICBjb25zdCBhc3QgPSBuZXcgdC5Td2l0Y2hCbG9ja0Nhc2UoXG4gICAgICAgIGV4cHJlc3Npb24sIGh0bWwudmlzaXRBbGwodmlzaXRvciwgbm9kZS5jaGlsZHJlbiwgbm9kZS5jaGlsZHJlbiksIG5vZGUuc291cmNlU3BhbixcbiAgICAgICAgbm9kZS5zdGFydFNvdXJjZVNwYW4sIG5vZGUuZW5kU291cmNlU3Bhbiwgbm9kZS5uYW1lU3Bhbiwgbm9kZS5pMThuKTtcblxuICAgIGlmIChleHByZXNzaW9uID09PSBudWxsKSB7XG4gICAgICBkZWZhdWx0Q2FzZSA9IGFzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FzZXMucHVzaChhc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEVuc3VyZSB0aGF0IHRoZSBkZWZhdWx0IGNhc2UgaXMgbGFzdCBpbiB0aGUgYXJyYXkuXG4gIGlmIChkZWZhdWx0Q2FzZSAhPT0gbnVsbCkge1xuICAgIGNhc2VzLnB1c2goZGVmYXVsdENhc2UpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBub2RlOiBuZXcgdC5Td2l0Y2hCbG9jayhcbiAgICAgICAgcHJpbWFyeUV4cHJlc3Npb24sIGNhc2VzLCB1bmtub3duQmxvY2tzLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgYXN0LmVuZFNvdXJjZVNwYW4sIGFzdC5uYW1lU3BhbiksXG4gICAgZXJyb3JzXG4gIH07XG59XG5cbi8qKiBQYXJzZXMgdGhlIHBhcmFtZXRlcnMgb2YgYSBgZm9yYCBsb29wIGJsb2NrLiAqL1xuZnVuY3Rpb24gcGFyc2VGb3JMb29wUGFyYW1ldGVycyhcbiAgICBibG9jazogaHRtbC5CbG9jaywgZXJyb3JzOiBQYXJzZUVycm9yW10sIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpIHtcbiAgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0Bmb3IgbG9vcCBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBbZXhwcmVzc2lvblBhcmFtLCAuLi5zZWNvbmRhcnlQYXJhbXNdID0gYmxvY2sucGFyYW1ldGVycztcbiAgY29uc3QgbWF0Y2ggPVxuICAgICAgc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKGV4cHJlc3Npb25QYXJhbSwgZXJyb3JzKT8ubWF0Y2goRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOKTtcblxuICBpZiAoIW1hdGNoIHx8IG1hdGNoWzJdLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4sXG4gICAgICAgICdDYW5ub3QgcGFyc2UgZXhwcmVzc2lvbi4gQGZvciBsb29wIGV4cHJlc3Npb24gbXVzdCBtYXRjaCB0aGUgcGF0dGVybiBcIjxpZGVudGlmaWVyPiBvZiA8ZXhwcmVzc2lvbj5cIicpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IFssIGl0ZW1OYW1lLCByYXdFeHByZXNzaW9uXSA9IG1hdGNoO1xuICBpZiAoQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTLmhhcyhpdGVtTmFtZSkpIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4sXG4gICAgICAgIGBAZm9yIGxvb3AgaXRlbSBuYW1lIGNhbm5vdCBiZSBvbmUgb2YgJHtcbiAgICAgICAgICAgIEFycmF5LmZyb20oQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTKS5qb2luKCcsICcpfS5gKSk7XG4gIH1cblxuICAvLyBgZXhwcmVzc2lvblBhcmFtLmV4cHJlc3Npb25gIGNvbnRhaW5zIHRoZSB2YXJpYWJsZSBkZWNsYXJhdGlvbiBhbmQgdGhlIGV4cHJlc3Npb24gb2YgdGhlXG4gIC8vIGZvci4uLm9mIHN0YXRlbWVudCwgaS5lLiAndXNlciBvZiB1c2VycycgVGhlIHZhcmlhYmxlIG9mIGEgRm9yT2ZTdGF0ZW1lbnQgaXMgX29ubHlfIHRoZSBcImNvbnN0XG4gIC8vIHVzZXJcIiBwYXJ0IGFuZCBkb2VzIG5vdCBpbmNsdWRlIFwib2YgeFwiLlxuICBjb25zdCB2YXJpYWJsZU5hbWUgPSBleHByZXNzaW9uUGFyYW0uZXhwcmVzc2lvbi5zcGxpdCgnICcpWzBdO1xuICBjb25zdCB2YXJpYWJsZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4uc3RhcnQsXG4gICAgICBleHByZXNzaW9uUGFyYW0uc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkodmFyaWFibGVOYW1lLmxlbmd0aCkpO1xuICBjb25zdCByZXN1bHQgPSB7XG4gICAgaXRlbU5hbWU6IG5ldyB0LlZhcmlhYmxlKGl0ZW1OYW1lLCAnJGltcGxpY2l0JywgdmFyaWFibGVTcGFuLCB2YXJpYWJsZVNwYW4pLFxuICAgIHRyYWNrQnk6IG51bGwgYXMge2V4cHJlc3Npb246IEFTVFdpdGhTb3VyY2UsIGtleXdvcmRTcGFuOiBQYXJzZVNvdXJjZVNwYW59IHwgbnVsbCxcbiAgICBleHByZXNzaW9uOiBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKGV4cHJlc3Npb25QYXJhbSwgYmluZGluZ1BhcnNlciwgcmF3RXhwcmVzc2lvbiksXG4gICAgY29udGV4dDogQXJyYXkuZnJvbShcbiAgICAgICAgQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTLFxuICAgICAgICB2YXJpYWJsZU5hbWUgPT4ge1xuICAgICAgICAgIC8vIEdpdmUgYW1iaWVudGx5LWF2YWlsYWJsZSBjb250ZXh0IHZhcmlhYmxlcyBlbXB0eSBzcGFucyBhdCB0aGUgZW5kIG9mXG4gICAgICAgICAgLy8gdGhlIHN0YXJ0IG9mIHRoZSBgZm9yYCBibG9jaywgc2luY2UgdGhleSBhcmUgbm90IGV4cGxpY2l0bHkgZGVmaW5lZC5cbiAgICAgICAgICBjb25zdCBlbXB0eVNwYW5BZnRlckZvckJsb2NrU3RhcnQgPVxuICAgICAgICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKGJsb2NrLnN0YXJ0U291cmNlU3Bhbi5lbmQsIGJsb2NrLnN0YXJ0U291cmNlU3Bhbi5lbmQpO1xuICAgICAgICAgIHJldHVybiBuZXcgdC5WYXJpYWJsZShcbiAgICAgICAgICAgICAgdmFyaWFibGVOYW1lLCB2YXJpYWJsZU5hbWUsIGVtcHR5U3BhbkFmdGVyRm9yQmxvY2tTdGFydCwgZW1wdHlTcGFuQWZ0ZXJGb3JCbG9ja1N0YXJ0KTtcbiAgICAgICAgfSksXG4gIH07XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBzZWNvbmRhcnlQYXJhbXMpIHtcbiAgICBjb25zdCBsZXRNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goRk9SX0xPT1BfTEVUX1BBVFRFUk4pO1xuXG4gICAgaWYgKGxldE1hdGNoICE9PSBudWxsKSB7XG4gICAgICBjb25zdCB2YXJpYWJsZXNTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICBwYXJhbS5zb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeShsZXRNYXRjaFswXS5sZW5ndGggLSBsZXRNYXRjaFsxXS5sZW5ndGgpLFxuICAgICAgICAgIHBhcmFtLnNvdXJjZVNwYW4uZW5kKTtcbiAgICAgIHBhcnNlTGV0UGFyYW1ldGVyKFxuICAgICAgICAgIHBhcmFtLnNvdXJjZVNwYW4sIGxldE1hdGNoWzFdLCB2YXJpYWJsZXNTcGFuLCBpdGVtTmFtZSwgcmVzdWx0LmNvbnRleHQsIGVycm9ycyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0cmFja01hdGNoID0gcGFyYW0uZXhwcmVzc2lvbi5tYXRjaChGT1JfTE9PUF9UUkFDS19QQVRURVJOKTtcblxuICAgIGlmICh0cmFja01hdGNoICE9PSBudWxsKSB7XG4gICAgICBpZiAocmVzdWx0LnRyYWNrQnkgIT09IG51bGwpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnQGZvciBsb29wIGNhbiBvbmx5IGhhdmUgb25lIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcocGFyYW0sIGJpbmRpbmdQYXJzZXIsIHRyYWNrTWF0Y2hbMV0pO1xuICAgICAgICBpZiAoZXhwcmVzc2lvbi5hc3QgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnQGZvciBsb29wIG11c3QgaGF2ZSBhIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGtleXdvcmRTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgIHBhcmFtLnNvdXJjZVNwYW4uc3RhcnQsIHBhcmFtLnNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KCd0cmFjaycubGVuZ3RoKSk7XG4gICAgICAgIHJlc3VsdC50cmFja0J5ID0ge2V4cHJlc3Npb24sIGtleXdvcmRTcGFufTtcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCBgVW5yZWNvZ25pemVkIEBmb3IgbG9vcCBwYXJhbWF0ZXIgXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKSk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKiogUGFyc2VzIHRoZSBgbGV0YCBwYXJhbWV0ZXIgb2YgYSBgZm9yYCBsb29wIGJsb2NrLiAqL1xuZnVuY3Rpb24gcGFyc2VMZXRQYXJhbWV0ZXIoXG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBleHByZXNzaW9uOiBzdHJpbmcsIHNwYW46IFBhcnNlU291cmNlU3BhbiwgbG9vcEl0ZW1OYW1lOiBzdHJpbmcsXG4gICAgY29udGV4dDogdC5WYXJpYWJsZVtdLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSk6IHZvaWQge1xuICBjb25zdCBwYXJ0cyA9IGV4cHJlc3Npb24uc3BsaXQoJywnKTtcbiAgbGV0IHN0YXJ0U3BhbiA9IHNwYW4uc3RhcnQ7XG4gIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgIGNvbnN0IGV4cHJlc3Npb25QYXJ0cyA9IHBhcnQuc3BsaXQoJz0nKTtcbiAgICBjb25zdCBuYW1lID0gZXhwcmVzc2lvblBhcnRzLmxlbmd0aCA9PT0gMiA/IGV4cHJlc3Npb25QYXJ0c1swXS50cmltKCkgOiAnJztcbiAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSBleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyID8gZXhwcmVzc2lvblBhcnRzWzFdLnRyaW0oKSA6ICcnO1xuXG4gICAgaWYgKG5hbWUubGVuZ3RoID09PSAwIHx8IHZhcmlhYmxlTmFtZS5sZW5ndGggPT09IDApIHtcbiAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgICAgYEludmFsaWQgQGZvciBsb29wIFwibGV0XCIgcGFyYW1ldGVyLiBQYXJhbWV0ZXIgc2hvdWxkIG1hdGNoIHRoZSBwYXR0ZXJuIFwiPG5hbWU+ID0gPHZhcmlhYmxlIG5hbWU+XCJgKSk7XG4gICAgfSBlbHNlIGlmICghQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTLmhhcyh2YXJpYWJsZU5hbWUpKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICAgIGBVbmtub3duIFwibGV0XCIgcGFyYW1ldGVyIHZhcmlhYmxlIFwiJHt2YXJpYWJsZU5hbWV9XCIuIFRoZSBhbGxvd2VkIHZhcmlhYmxlcyBhcmU6ICR7XG4gICAgICAgICAgICAgIEFycmF5LmZyb20oQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTKS5qb2luKCcsICcpfWApKTtcbiAgICB9IGVsc2UgaWYgKG5hbWUgPT09IGxvb3BJdGVtTmFtZSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICBgSW52YWxpZCBAZm9yIGxvb3AgXCJsZXRcIiBwYXJhbWV0ZXIuIFZhcmlhYmxlIGNhbm5vdCBiZSBjYWxsZWQgXCIke2xvb3BJdGVtTmFtZX1cImApKTtcbiAgICB9IGVsc2UgaWYgKGNvbnRleHQuc29tZSh2ID0+IHYubmFtZSA9PT0gbmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIGBEdXBsaWNhdGUgXCJsZXRcIiBwYXJhbWV0ZXIgdmFyaWFibGUgXCIke3ZhcmlhYmxlTmFtZX1cImApKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgWywga2V5TGVhZGluZ1doaXRlc3BhY2UsIGtleU5hbWVdID1cbiAgICAgICAgICBleHByZXNzaW9uUGFydHNbMF0ubWF0Y2goQ0hBUkFDVEVSU19JTl9TVVJST1VORElOR19XSElURVNQQUNFX1BBVFRFUk4pID8/IFtdO1xuICAgICAgY29uc3Qga2V5U3BhbiA9IGtleUxlYWRpbmdXaGl0ZXNwYWNlICE9PSB1bmRlZmluZWQgJiYgZXhwcmVzc2lvblBhcnRzLmxlbmd0aCA9PT0gMiA/XG4gICAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICAgICAgLyogc3RyaXAgbGVhZGluZyBzcGFjZXMgKi9cbiAgICAgICAgICAgICAgc3RhcnRTcGFuLm1vdmVCeShrZXlMZWFkaW5nV2hpdGVzcGFjZS5sZW5ndGgpLFxuICAgICAgICAgICAgICAvKiBhZHZhbmNlIHRvIGVuZCBvZiB0aGUgdmFyaWFibGUgbmFtZSAqL1xuICAgICAgICAgICAgICBzdGFydFNwYW4ubW92ZUJ5KGtleUxlYWRpbmdXaGl0ZXNwYWNlLmxlbmd0aCArIGtleU5hbWUubGVuZ3RoKSkgOlxuICAgICAgICAgIHNwYW47XG5cbiAgICAgIGxldCB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICBpZiAoZXhwcmVzc2lvblBhcnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICBjb25zdCBbLCB2YWx1ZUxlYWRpbmdXaGl0ZXNwYWNlLCBpbXBsaWNpdF0gPVxuICAgICAgICAgICAgZXhwcmVzc2lvblBhcnRzWzFdLm1hdGNoKENIQVJBQ1RFUlNfSU5fU1VSUk9VTkRJTkdfV0hJVEVTUEFDRV9QQVRURVJOKSA/PyBbXTtcbiAgICAgICAgdmFsdWVTcGFuID0gdmFsdWVMZWFkaW5nV2hpdGVzcGFjZSAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgICAgICAgICAgc3RhcnRTcGFuLm1vdmVCeShleHByZXNzaW9uUGFydHNbMF0ubGVuZ3RoICsgMSArIHZhbHVlTGVhZGluZ1doaXRlc3BhY2UubGVuZ3RoKSxcbiAgICAgICAgICAgICAgICBzdGFydFNwYW4ubW92ZUJ5KFxuICAgICAgICAgICAgICAgICAgICBleHByZXNzaW9uUGFydHNbMF0ubGVuZ3RoICsgMSArIHZhbHVlTGVhZGluZ1doaXRlc3BhY2UubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgaW1wbGljaXQubGVuZ3RoKSkgOlxuICAgICAgICAgICAgdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oa2V5U3Bhbi5zdGFydCwgdmFsdWVTcGFuPy5lbmQgPz8ga2V5U3Bhbi5lbmQpO1xuICAgICAgY29udGV4dC5wdXNoKG5ldyB0LlZhcmlhYmxlKG5hbWUsIHZhcmlhYmxlTmFtZSwgc291cmNlU3Bhbiwga2V5U3BhbiwgdmFsdWVTcGFuKSk7XG4gICAgfVxuICAgIHN0YXJ0U3BhbiA9IHN0YXJ0U3Bhbi5tb3ZlQnkocGFydC5sZW5ndGggKyAxIC8qIGFkZCAxIHRvIG1vdmUgcGFzdCB0aGUgY29tbWEgKi8pO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHRoYXQgdGhlIHNoYXBlIG9mIHRoZSBibG9ja3MgY29ubmVjdGVkIHRvIGFuXG4gKiBgQGlmYCBibG9jayBpcyBjb3JyZWN0LiBSZXR1cm5zIGFuIGFycmF5IG9mIGVycm9ycy5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVJZkNvbm5lY3RlZEJsb2Nrcyhjb25uZWN0ZWRCbG9ja3M6IGh0bWwuQmxvY2tbXSk6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gW107XG4gIGxldCBoYXNFbHNlID0gZmFsc2U7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb25uZWN0ZWRCbG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBibG9jayA9IGNvbm5lY3RlZEJsb2Nrc1tpXTtcblxuICAgIGlmIChibG9jay5uYW1lID09PSAnZWxzZScpIHtcbiAgICAgIGlmIChoYXNFbHNlKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBjYW4gb25seSBoYXZlIG9uZSBAZWxzZSBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAoY29ubmVjdGVkQmxvY2tzLmxlbmd0aCA+IDEgJiYgaSA8IGNvbm5lY3RlZEJsb2Nrcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0BlbHNlIGJsb2NrIG11c3QgYmUgbGFzdCBpbnNpZGUgdGhlIGNvbmRpdGlvbmFsJykpO1xuICAgICAgfSBlbHNlIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgJ0BlbHNlIGJsb2NrIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMnKSk7XG4gICAgICB9XG4gICAgICBoYXNFbHNlID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKCFFTFNFX0lGX1BBVFRFUk4udGVzdChibG9jay5uYW1lKSkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBjb25kaXRpb25hbCBibG9jayBAJHtibG9jay5uYW1lfWApKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXJyb3JzO1xufVxuXG4vKiogQ2hlY2tzIHRoYXQgdGhlIHNoYXBlIG9mIGEgYHN3aXRjaGAgYmxvY2sgaXMgdmFsaWQuIFJldHVybnMgYW4gYXJyYXkgb2YgZXJyb3JzLiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVTd2l0Y2hCbG9jayhhc3Q6IGh0bWwuQmxvY2spOiBQYXJzZUVycm9yW10ge1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBsZXQgaGFzRGVmYXVsdCA9IGZhbHNlO1xuXG4gIGlmIChhc3QucGFyYW1ldGVycy5sZW5ndGggIT09IDEpIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihhc3Quc291cmNlU3BhbiwgJ0Bzd2l0Y2ggYmxvY2sgbXVzdCBoYXZlIGV4YWN0bHkgb25lIHBhcmFtZXRlcicpKTtcbiAgICByZXR1cm4gZXJyb3JzO1xuICB9XG5cbiAgZm9yIChjb25zdCBub2RlIG9mIGFzdC5jaGlsZHJlbikge1xuICAgIC8vIFNraXAgb3ZlciBjb21tZW50cyBhbmQgZW1wdHkgdGV4dCBub2RlcyBpbnNpZGUgdGhlIHN3aXRjaCBibG9jay5cbiAgICAvLyBFbXB0eSB0ZXh0IG5vZGVzIGNhbiBiZSB1c2VkIGZvciBmb3JtYXR0aW5nIHdoaWxlIGNvbW1lbnRzIGRvbid0IGFmZmVjdCB0aGUgcnVudGltZS5cbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIGh0bWwuQ29tbWVudCB8fFxuICAgICAgICAobm9kZSBpbnN0YW5jZW9mIGh0bWwuVGV4dCAmJiBub2RlLnZhbHVlLnRyaW0oKS5sZW5ndGggPT09IDApKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgaHRtbC5CbG9jaykgfHwgKG5vZGUubmFtZSAhPT0gJ2Nhc2UnICYmIG5vZGUubmFtZSAhPT0gJ2RlZmF1bHQnKSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgbm9kZS5zb3VyY2VTcGFuLCAnQHN3aXRjaCBibG9jayBjYW4gb25seSBjb250YWluIEBjYXNlIGFuZCBAZGVmYXVsdCBibG9ja3MnKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAobm9kZS5uYW1lID09PSAnZGVmYXVsdCcpIHtcbiAgICAgIGlmIChoYXNEZWZhdWx0KSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCAnQHN3aXRjaCBibG9jayBjYW4gb25seSBoYXZlIG9uZSBAZGVmYXVsdCBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAobm9kZS5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCAnQGRlZmF1bHQgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICAgIH1cbiAgICAgIGhhc0RlZmF1bHQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAobm9kZS5uYW1lID09PSAnY2FzZScgJiYgbm9kZS5wYXJhbWV0ZXJzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Iobm9kZS5zb3VyY2VTcGFuLCAnQGNhc2UgYmxvY2sgbXVzdCBoYXZlIGV4YWN0bHkgb25lIHBhcmFtZXRlcicpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXJyb3JzO1xufVxuXG4vKipcbiAqIFBhcnNlcyBhIGJsb2NrIHBhcmFtZXRlciBpbnRvIGEgYmluZGluZyBBU1QuXG4gKiBAcGFyYW0gYXN0IEJsb2NrIHBhcmFtZXRlciB0aGF0IHNob3VsZCBiZSBwYXJzZWQuXG4gKiBAcGFyYW0gYmluZGluZ1BhcnNlciBQYXJzZXIgdGhhdCB0aGUgZXhwcmVzc2lvbiBzaG91bGQgYmUgcGFyc2VkIHdpdGguXG4gKiBAcGFyYW0gcGFydCBTcGVjaWZpYyBwYXJ0IG9mIHRoZSBleHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHBhcnNlZC5cbiAqL1xuZnVuY3Rpb24gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhcbiAgICBhc3Q6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIHBhcnQ/OiBzdHJpbmcpOiBBU1RXaXRoU291cmNlIHtcbiAgbGV0IHN0YXJ0OiBudW1iZXI7XG4gIGxldCBlbmQ6IG51bWJlcjtcblxuICBpZiAodHlwZW9mIHBhcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgLy8gTm90ZTogYGxhc3RJbmRleE9mYCBoZXJlIHNob3VsZCBiZSBlbm91Z2ggdG8ga25vdyB0aGUgc3RhcnQgaW5kZXggb2YgdGhlIGV4cHJlc3Npb24sXG4gICAgLy8gYmVjYXVzZSB3ZSBrbm93IHRoYXQgaXQnbGwgYmUgYXQgdGhlIGVuZCBvZiB0aGUgcGFyYW0uIElkZWFsbHkgd2UgY291bGQgdXNlIHRoZSBgZGBcbiAgICAvLyBmbGFnIHdoZW4gbWF0Y2hpbmcgdmlhIHJlZ2V4IGFuZCBnZXQgdGhlIGluZGV4IGZyb20gYG1hdGNoLmluZGljZXNgLCBidXQgaXQncyB1bmNsZWFyXG4gICAgLy8gaWYgd2UgY2FuIHVzZSBpdCB5ZXQgc2luY2UgaXQncyBhIHJlbGF0aXZlbHkgbmV3IGZlYXR1cmUuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdGMzOS9wcm9wb3NhbC1yZWdleHAtbWF0Y2gtaW5kaWNlc1xuICAgIHN0YXJ0ID0gTWF0aC5tYXgoMCwgYXN0LmV4cHJlc3Npb24ubGFzdEluZGV4T2YocGFydCkpO1xuICAgIGVuZCA9IHN0YXJ0ICsgcGFydC5sZW5ndGg7XG4gIH0gZWxzZSB7XG4gICAgc3RhcnQgPSAwO1xuICAgIGVuZCA9IGFzdC5leHByZXNzaW9uLmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLnBhcnNlQmluZGluZyhcbiAgICAgIGFzdC5leHByZXNzaW9uLnNsaWNlKHN0YXJ0LCBlbmQpLCBmYWxzZSwgYXN0LnNvdXJjZVNwYW4sIGFzdC5zb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCArIHN0YXJ0KTtcbn1cblxuLyoqIFBhcnNlcyB0aGUgcGFyYW1ldGVyIG9mIGEgY29uZGl0aW9uYWwgYmxvY2sgKGBpZmAgb3IgYGVsc2UgaWZgKS4gKi9cbmZ1bmN0aW9uIHBhcnNlQ29uZGl0aW9uYWxCbG9ja1BhcmFtZXRlcnMoXG4gICAgYmxvY2s6IGh0bWwuQmxvY2ssIGVycm9yczogUGFyc2VFcnJvcltdLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGlmIChibG9jay5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBibG9jayBkb2VzIG5vdCBoYXZlIGFuIGV4cHJlc3Npb24nKSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhibG9jay5wYXJhbWV0ZXJzWzBdLCBiaW5kaW5nUGFyc2VyKTtcbiAgbGV0IGV4cHJlc3Npb25BbGlhczogdC5WYXJpYWJsZXxudWxsID0gbnVsbDtcblxuICAvLyBTdGFydCBmcm9tIDEgc2luY2Ugd2UgcHJvY2Vzc2VkIHRoZSBmaXJzdCBwYXJhbWV0ZXIgYWxyZWFkeS5cbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBibG9jay5wYXJhbWV0ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcGFyYW0gPSBibG9jay5wYXJhbWV0ZXJzW2ldO1xuICAgIGNvbnN0IGFsaWFzTWF0Y2ggPSBwYXJhbS5leHByZXNzaW9uLm1hdGNoKENPTkRJVElPTkFMX0FMSUFTX1BBVFRFUk4pO1xuXG4gICAgLy8gRm9yIG5vdyBjb25kaXRpb25hbHMgY2FuIG9ubHkgaGF2ZSBhbiBgYXNgIHBhcmFtZXRlci5cbiAgICAvLyBXZSBtYXkgd2FudCB0byByZXdvcmsgdGhpcyBsYXRlciBpZiB3ZSBhZGQgbW9yZS5cbiAgICBpZiAoYWxpYXNNYXRjaCA9PT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgcGFyYW0uc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBjb25kaXRpb25hbCBwYXJhbWF0ZXIgXCIke3BhcmFtLmV4cHJlc3Npb259XCJgKSk7XG4gICAgfSBlbHNlIGlmIChibG9jay5uYW1lICE9PSAnaWYnKSB7XG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICBwYXJhbS5zb3VyY2VTcGFuLCAnXCJhc1wiIGV4cHJlc3Npb24gaXMgb25seSBhbGxvd2VkIG9uIHRoZSBwcmltYXJ5IEBpZiBibG9jaycpKTtcbiAgICB9IGVsc2UgaWYgKGV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ0NvbmRpdGlvbmFsIGNhbiBvbmx5IGhhdmUgb25lIFwiYXNcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuYW1lID0gYWxpYXNNYXRjaFsyXS50cmltKCk7XG4gICAgICBjb25zdCB2YXJpYWJsZVN0YXJ0ID0gcGFyYW0uc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoYWxpYXNNYXRjaFsxXS5sZW5ndGgpO1xuICAgICAgY29uc3QgdmFyaWFibGVTcGFuID0gbmV3IFBhcnNlU291cmNlU3Bhbih2YXJpYWJsZVN0YXJ0LCB2YXJpYWJsZVN0YXJ0Lm1vdmVCeShuYW1lLmxlbmd0aCkpO1xuICAgICAgZXhwcmVzc2lvbkFsaWFzID0gbmV3IHQuVmFyaWFibGUobmFtZSwgbmFtZSwgdmFyaWFibGVTcGFuLCB2YXJpYWJsZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgZXhwcmVzc2lvbkFsaWFzfTtcbn1cblxuLyoqIFN0cmlwcyBvcHRpb25hbCBwYXJlbnRoZXNlcyBhcm91bmQgZnJvbSBhIGNvbnRyb2wgZnJvbSBleHByZXNzaW9uIHBhcmFtZXRlci4gKi9cbmZ1bmN0aW9uIHN0cmlwT3B0aW9uYWxQYXJlbnRoZXNlcyhwYXJhbTogaHRtbC5CbG9ja1BhcmFtZXRlciwgZXJyb3JzOiBQYXJzZUVycm9yW10pOiBzdHJpbmd8bnVsbCB7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSBwYXJhbS5leHByZXNzaW9uO1xuICBjb25zdCBzcGFjZVJlZ2V4ID0gL15cXHMkLztcbiAgbGV0IG9wZW5QYXJlbnMgPSAwO1xuICBsZXQgc3RhcnQgPSAwO1xuICBsZXQgZW5kID0gZXhwcmVzc2lvbi5sZW5ndGggLSAxO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwcmVzc2lvbi5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoYXIgPSBleHByZXNzaW9uW2ldO1xuXG4gICAgaWYgKGNoYXIgPT09ICcoJykge1xuICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgIG9wZW5QYXJlbnMrKztcbiAgICB9IGVsc2UgaWYgKHNwYWNlUmVnZXgudGVzdChjaGFyKSkge1xuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChvcGVuUGFyZW5zID09PSAwKSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb247XG4gIH1cblxuICBmb3IgKGxldCBpID0gZXhwcmVzc2lvbi5sZW5ndGggLSAxOyBpID4gLTE7IGktLSkge1xuICAgIGNvbnN0IGNoYXIgPSBleHByZXNzaW9uW2ldO1xuXG4gICAgaWYgKGNoYXIgPT09ICcpJykge1xuICAgICAgZW5kID0gaTtcbiAgICAgIG9wZW5QYXJlbnMtLTtcbiAgICAgIGlmIChvcGVuUGFyZW5zID09PSAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3BhY2VSZWdleC50ZXN0KGNoYXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wZW5QYXJlbnMgIT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnVW5jbG9zZWQgcGFyZW50aGVzZXMgaW4gZXhwcmVzc2lvbicpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBleHByZXNzaW9uLnNsaWNlKHN0YXJ0LCBlbmQpO1xufVxuIl19