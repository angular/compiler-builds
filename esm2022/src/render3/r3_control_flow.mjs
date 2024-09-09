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
const ALLOWED_FOR_LOOP_LET_VARIABLES = new Set([
    '$index',
    '$first',
    '$last',
    '$even',
    '$odd',
    '$count',
]);
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
            errors.push(new ParseError(ast.startSourceSpan, '@for loop must have a "track" expression'));
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
    const primaryExpression = ast.parameters.length > 0
        ? parseBlockParameterToBinding(ast.parameters[0], bindingParser)
        : bindingParser.parseBinding('', false, ast.sourceSpan, 0);
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
        const expression = node.name === 'case' ? parseBlockParameterToBinding(node.parameters[0], bindingParser) : null;
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
        errors,
    };
}
/** Parses the parameters of a `for` loop block. */
function parseForLoopParameters(block, errors, bindingParser) {
    if (block.parameters.length === 0) {
        errors.push(new ParseError(block.startSourceSpan, '@for loop does not have an expression'));
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
        context: Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES, (variableName) => {
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
                    errors.push(new ParseError(block.startSourceSpan, '@for loop must have a "track" expression'));
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
        else if (context.some((v) => v.name === name)) {
            errors.push(new ParseError(sourceSpan, `Duplicate "let" parameter variable "${variableName}"`));
        }
        else {
            const [, keyLeadingWhitespace, keyName] = expressionParts[0].match(CHARACTERS_IN_SURROUNDING_WHITESPACE_PATTERN) ?? [];
            const keySpan = keyLeadingWhitespace !== undefined && expressionParts.length === 2
                ? new ParseSourceSpan(
                /* strip leading spaces */
                startSpan.moveBy(keyLeadingWhitespace.length), 
                /* advance to end of the variable name */
                startSpan.moveBy(keyLeadingWhitespace.length + keyName.length))
                : span;
            let valueSpan = undefined;
            if (expressionParts.length === 2) {
                const [, valueLeadingWhitespace, implicit] = expressionParts[1].match(CHARACTERS_IN_SURROUNDING_WHITESPACE_PATTERN) ?? [];
                valueSpan =
                    valueLeadingWhitespace !== undefined
                        ? new ParseSourceSpan(startSpan.moveBy(expressionParts[0].length + 1 + valueLeadingWhitespace.length), startSpan.moveBy(expressionParts[0].length + 1 + valueLeadingWhitespace.length + implicit.length))
                        : undefined;
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
                errors.push(new ParseError(block.startSourceSpan, 'Conditional can only have one @else block'));
            }
            else if (connectedBlocks.length > 1 && i < connectedBlocks.length - 1) {
                errors.push(new ParseError(block.startSourceSpan, '@else block must be last inside the conditional'));
            }
            else if (block.parameters.length > 0) {
                errors.push(new ParseError(block.startSourceSpan, '@else block cannot have parameters'));
            }
            hasElse = true;
        }
        else if (!ELSE_IF_PATTERN.test(block.name)) {
            errors.push(new ParseError(block.startSourceSpan, `Unrecognized conditional block @${block.name}`));
        }
    }
    return errors;
}
/** Checks that the shape of a `switch` block is valid. Returns an array of errors. */
function validateSwitchBlock(ast) {
    const errors = [];
    let hasDefault = false;
    if (ast.parameters.length !== 1) {
        errors.push(new ParseError(ast.startSourceSpan, '@switch block must have exactly one parameter'));
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
                errors.push(new ParseError(node.startSourceSpan, '@switch block can only have one @default block'));
            }
            else if (node.parameters.length > 0) {
                errors.push(new ParseError(node.startSourceSpan, '@default block cannot have parameters'));
            }
            hasDefault = true;
        }
        else if (node.name === 'case' && node.parameters.length !== 1) {
            errors.push(new ParseError(node.startSourceSpan, '@case block must have exactly one parameter'));
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
        errors.push(new ParseError(block.startSourceSpan, 'Conditional block does not have an expression'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBZ0IsU0FBUyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDbEUsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUcxRCxPQUFPLEtBQUssQ0FBQyxNQUFNLFVBQVUsQ0FBQztBQUU5QixzREFBc0Q7QUFDdEQsTUFBTSwyQkFBMkIsR0FBRyx1Q0FBdUMsQ0FBQztBQUU1RSwrREFBK0Q7QUFDL0QsTUFBTSxzQkFBc0IsR0FBRyxvQkFBb0IsQ0FBQztBQUVwRCw4REFBOEQ7QUFDOUQsTUFBTSx5QkFBeUIsR0FBRyxjQUFjLENBQUM7QUFFakQsbURBQW1EO0FBQ25ELE1BQU0sZUFBZSxHQUFHLG1CQUFtQixDQUFDO0FBRTVDLGtEQUFrRDtBQUNsRCxNQUFNLG9CQUFvQixHQUFHLGtCQUFrQixDQUFDO0FBRWhEOzs7R0FHRztBQUNILE1BQU0sNENBQTRDLEdBQUcsaUJBQWlCLENBQUM7QUFFdkUsOEZBQThGO0FBQzlGLE1BQU0sOEJBQThCLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDN0MsUUFBUTtJQUNSLFFBQVE7SUFDUixPQUFPO0lBQ1AsT0FBTztJQUNQLE1BQU07SUFDTixRQUFRO0NBQ1QsQ0FBQyxDQUFDO0FBRUg7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHVCQUF1QixDQUFDLElBQVk7SUFDbEQsT0FBTyxJQUFJLEtBQUssT0FBTyxDQUFDO0FBQzFCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQUMsSUFBWTtJQUNqRCxPQUFPLElB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QyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ2hELE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUzQixJQUFJLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQztZQUNqQixHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQ1IsVUFBVSxFQUFFLENBQUM7WUFDYixJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDckIsTUFBTTtZQUNSLENBQUM7UUFDSCxDQUFDO2FBQU0sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDakMsU0FBUztRQUNYLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTTtRQUNSLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxVQUFVLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDckIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLG9DQUFvQyxDQUFDLENBQUMsQ0FBQztRQUNwRixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxPQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBU1RXaXRoU291cmNlLCBFbXB0eUV4cHJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcblxuLyoqIFBhdHRlcm4gZm9yIHRoZSBleHByZXNzaW9uIGluIGEgZm9yIGxvb3AgYmxvY2suICovXG5jb25zdCBGT1JfTE9PUF9FWFBSRVNTSU9OX1BBVFRFUk4gPSAvXlxccyooWzAtOUEtWmEtel8kXSopXFxzK29mXFxzKyhbXFxTXFxzXSopLztcblxuLyoqIFBhdHRlcm4gZm9yIHRoZSB0cmFja2luZyBleHByZXNzaW9uIGluIGEgZm9yIGxvb3AgYmxvY2suICovXG5jb25zdCBGT1JfTE9PUF9UUkFDS19QQVRURVJOID0gL150cmFja1xccysoW1xcU1xcc10qKS87XG5cbi8qKiBQYXR0ZXJuIGZvciB0aGUgYGFzYCBleHByZXNzaW9uIGluIGEgY29uZGl0aW9uYWwgYmxvY2suICovXG5jb25zdCBDT05ESVRJT05BTF9BTElBU19QQVRURVJOID0gL14oYXNcXHMpKyguKikvO1xuXG4vKiogUGF0dGVybiB1c2VkIHRvIGlkZW50aWZ5IGFuIGBlbHNlIGlmYCBibG9jay4gKi9cbmNvbnN0IEVMU0VfSUZfUEFUVEVSTiA9IC9eZWxzZVteXFxTXFxyXFxuXStpZi87XG5cbi8qKiBQYXR0ZXJuIHVzZWQgdG8gaWRlbnRpZnkgYSBgbGV0YCBwYXJhbWV0ZXIuICovXG5jb25zdCBGT1JfTE9PUF9MRVRfUEFUVEVSTiA9IC9ebGV0XFxzKyhbXFxTXFxzXSopLztcblxuLyoqXG4gKiBQYXR0ZXJuIHRvIGdyb3VwIGEgc3RyaW5nIGludG8gbGVhZGluZyB3aGl0ZXNwYWNlLCBub24gd2hpdGVzcGFjZSwgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2UuXG4gKiBVc2VmdWwgZm9yIGdldHRpbmcgdGhlIHZhcmlhYmxlIG5hbWUgc3BhbiB3aGVuIGEgc3BhbiBjYW4gY29udGFpbiBsZWFkaW5nIGFuZCB0cmFpbGluZyBzcGFjZS5cbiAqL1xuY29uc3QgQ0hBUkFDVEVSU19JTl9TVVJST1VORElOR19XSElURVNQQUNFX1BBVFRFUk4gPSAvKFxccyopKFxcUyspKFxccyopLztcblxuLyoqIE5hbWVzIG9mIHZhcmlhYmxlcyB0aGF0IGFyZSBhbGxvd2VkIHRvIGJlIHVzZWQgaW4gdGhlIGBsZXRgIGV4cHJlc3Npb24gb2YgYSBgZm9yYCBsb29wLiAqL1xuY29uc3QgQUxMT1dFRF9GT1JfTE9PUF9MRVRfVkFSSUFCTEVTID0gbmV3IFNldChbXG4gICckaW5kZXgnLFxuICAnJGZpcnN0JyxcbiAgJyRsYXN0JyxcbiAgJyRldmVuJyxcbiAgJyRvZGQnLFxuICAnJGNvdW50Jyxcbl0pO1xuXG4vKipcbiAqIFByZWRpY2F0ZSBmdW5jdGlvbiB0aGF0IGRldGVybWluZXMgaWYgYSBibG9jayB3aXRoXG4gKiBhIHNwZWNpZmljIG5hbWUgY2FtIGJlIGNvbm5lY3RlZCB0byBhIGBmb3JgIGJsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNDb25uZWN0ZWRGb3JMb29wQmxvY2sobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBuYW1lID09PSAnZW1wdHknO1xufVxuXG4vKipcbiAqIFByZWRpY2F0ZSBmdW5jdGlvbiB0aGF0IGRldGVybWluZXMgaWYgYSBibG9jayB3aXRoXG4gKiBhIHNwZWNpZmljIG5hbWUgY2FtIGJlIGNvbm5lY3RlZCB0byBhbiBgaWZgIGJsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNDb25uZWN0ZWRJZkxvb3BCbG9jayhuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5hbWUgPT09ICdlbHNlJyB8fCBFTFNFX0lGX1BBVFRFUk4udGVzdChuYW1lKTtcbn1cblxuLyoqIENyZWF0ZXMgYW4gYGlmYCBsb29wIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJZkJsb2NrKFxuICBhc3Q6IGh0bWwuQmxvY2ssXG4gIGNvbm5lY3RlZEJsb2NrczogaHRtbC5CbG9ja1tdLFxuICB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4pOiB7bm9kZTogdC5JZkJsb2NrIHwgbnVsbDsgZXJyb3JzOiBQYXJzZUVycm9yW119IHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSB2YWxpZGF0ZUlmQ29ubmVjdGVkQmxvY2tzKGNvbm5lY3RlZEJsb2Nrcyk7XG4gIGNvbnN0IGJyYW5jaGVzOiB0LklmQmxvY2tCcmFuY2hbXSA9IFtdO1xuICBjb25zdCBtYWluQmxvY2tQYXJhbXMgPSBwYXJzZUNvbmRpdGlvbmFsQmxvY2tQYXJhbWV0ZXJzKGFzdCwgZXJyb3JzLCBiaW5kaW5nUGFyc2VyKTtcblxuICBpZiAobWFpbkJsb2NrUGFyYW1zICE9PSBudWxsKSB7XG4gICAgYnJhbmNoZXMucHVzaChcbiAgICAgIG5ldyB0LklmQmxvY2tCcmFuY2goXG4gICAgICAgIG1haW5CbG9ja1BhcmFtcy5leHByZXNzaW9uLFxuICAgICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSxcbiAgICAgICAgbWFpbkJsb2NrUGFyYW1zLmV4cHJlc3Npb25BbGlhcyxcbiAgICAgICAgYXN0LnNvdXJjZVNwYW4sXG4gICAgICAgIGFzdC5zdGFydFNvdXJjZVNwYW4sXG4gICAgICAgIGFzdC5lbmRTb3VyY2VTcGFuLFxuICAgICAgICBhc3QubmFtZVNwYW4sXG4gICAgICAgIGFzdC5pMThuLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgZm9yIChjb25zdCBibG9jayBvZiBjb25uZWN0ZWRCbG9ja3MpIHtcbiAgICBpZiAoRUxTRV9JRl9QQVRURVJOLnRlc3QoYmxvY2submFtZSkpIHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHBhcnNlQ29uZGl0aW9uYWxCbG9ja1BhcmFtZXRlcnMoYmxvY2ssIGVycm9ycywgYmluZGluZ1BhcnNlcik7XG5cbiAgICAgIGlmIChwYXJhbXMgIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuLCBibG9jay5jaGlsZHJlbik7XG4gICAgICAgIGJyYW5jaGVzLnB1c2goXG4gICAgICAgICAgbmV3IHQuSWZCbG9ja0JyYW5jaChcbiAgICAgICAgICAgIHBhcmFtcy5leHByZXNzaW9uLFxuICAgICAgICAgICAgY2hpbGRyZW4sXG4gICAgICAgICAgICBwYXJhbXMuZXhwcmVzc2lvbkFsaWFzLFxuICAgICAgICAgICAgYmxvY2suc291cmNlU3BhbixcbiAgICAgICAgICAgIGJsb2NrLnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgICAgIGJsb2NrLmVuZFNvdXJjZVNwYW4sXG4gICAgICAgICAgICBibG9jay5uYW1lU3BhbixcbiAgICAgICAgICAgIGJsb2NrLmkxOG4sXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGJsb2NrLm5hbWUgPT09ICdlbHNlJykge1xuICAgICAgY29uc3QgY2hpbGRyZW4gPSBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGJsb2NrLmNoaWxkcmVuLCBibG9jay5jaGlsZHJlbik7XG4gICAgICBicmFuY2hlcy5wdXNoKFxuICAgICAgICBuZXcgdC5JZkJsb2NrQnJhbmNoKFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICAgY2hpbGRyZW4sXG4gICAgICAgICAgbnVsbCxcbiAgICAgICAgICBibG9jay5zb3VyY2VTcGFuLFxuICAgICAgICAgIGJsb2NrLnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgICBibG9jay5lbmRTb3VyY2VTcGFuLFxuICAgICAgICAgIGJsb2NrLm5hbWVTcGFuLFxuICAgICAgICAgIGJsb2NrLmkxOG4sXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZSBvdXRlciBJZkJsb2NrIHNob3VsZCBoYXZlIGEgc3BhbiB0aGF0IGVuY2Fwc3VsYXRlcyBhbGwgYnJhbmNoZXMuXG4gIGNvbnN0IGlmQmxvY2tTdGFydFNvdXJjZVNwYW4gPVxuICAgIGJyYW5jaGVzLmxlbmd0aCA+IDAgPyBicmFuY2hlc1swXS5zdGFydFNvdXJjZVNwYW4gOiBhc3Quc3RhcnRTb3VyY2VTcGFuO1xuICBjb25zdCBpZkJsb2NrRW5kU291cmNlU3BhbiA9XG4gICAgYnJhbmNoZXMubGVuZ3RoID4gMCA/IGJyYW5jaGVzW2JyYW5jaGVzLmxlbmd0aCAtIDFdLmVuZFNvdXJjZVNwYW4gOiBhc3QuZW5kU291cmNlU3BhbjtcblxuICBsZXQgd2hvbGVTb3VyY2VTcGFuID0gYXN0LnNvdXJjZVNwYW47XG4gIGNvbnN0IGxhc3RCcmFuY2ggPSBicmFuY2hlc1ticmFuY2hlcy5sZW5ndGggLSAxXTtcbiAgaWYgKGxhc3RCcmFuY2ggIT09IHVuZGVmaW5lZCkge1xuICAgIHdob2xlU291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oaWZCbG9ja1N0YXJ0U291cmNlU3Bhbi5zdGFydCwgbGFzdEJyYW5jaC5zb3VyY2VTcGFuLmVuZCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5vZGU6IG5ldyB0LklmQmxvY2soXG4gICAgICBicmFuY2hlcyxcbiAgICAgIHdob2xlU291cmNlU3BhbixcbiAgICAgIGFzdC5zdGFydFNvdXJjZVNwYW4sXG4gICAgICBpZkJsb2NrRW5kU291cmNlU3BhbixcbiAgICAgIGFzdC5uYW1lU3BhbixcbiAgICApLFxuICAgIGVycm9ycyxcbiAgfTtcbn1cblxuLyoqIENyZWF0ZXMgYSBgZm9yYCBsb29wIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVGb3JMb29wKFxuICBhc3Q6IGh0bWwuQmxvY2ssXG4gIGNvbm5lY3RlZEJsb2NrczogaHRtbC5CbG9ja1tdLFxuICB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4pOiB7bm9kZTogdC5Gb3JMb29wQmxvY2sgfCBudWxsOyBlcnJvcnM6IFBhcnNlRXJyb3JbXX0ge1xuICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBjb25zdCBwYXJhbXMgPSBwYXJzZUZvckxvb3BQYXJhbWV0ZXJzKGFzdCwgZXJyb3JzLCBiaW5kaW5nUGFyc2VyKTtcbiAgbGV0IG5vZGU6IHQuRm9yTG9vcEJsb2NrIHwgbnVsbCA9IG51bGw7XG4gIGxldCBlbXB0eTogdC5Gb3JMb29wQmxvY2tFbXB0eSB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgYmxvY2sgb2YgY29ubmVjdGVkQmxvY2tzKSB7XG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdlbXB0eScpIHtcbiAgICAgIGlmIChlbXB0eSAhPT0gbnVsbCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zb3VyY2VTcGFuLCAnQGZvciBsb29wIGNhbiBvbmx5IGhhdmUgb25lIEBlbXB0eSBibG9jaycpKTtcbiAgICAgIH0gZWxzZSBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKGJsb2NrLnNvdXJjZVNwYW4sICdAZW1wdHkgYmxvY2sgY2Fubm90IGhhdmUgcGFyYW1ldGVycycpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVtcHR5ID0gbmV3IHQuRm9yTG9vcEJsb2NrRW1wdHkoXG4gICAgICAgICAgaHRtbC52aXNpdEFsbCh2aXNpdG9yLCBibG9jay5jaGlsZHJlbiwgYmxvY2suY2hpbGRyZW4pLFxuICAgICAgICAgIGJsb2NrLnNvdXJjZVNwYW4sXG4gICAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICAgIGJsb2NrLmVuZFNvdXJjZVNwYW4sXG4gICAgICAgICAgYmxvY2submFtZVNwYW4sXG4gICAgICAgICAgYmxvY2suaTE4bixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IoYmxvY2suc291cmNlU3BhbiwgYFVucmVjb2duaXplZCBAZm9yIGxvb3AgYmxvY2sgXCIke2Jsb2NrLm5hbWV9XCJgKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHBhcmFtcyAhPT0gbnVsbCkge1xuICAgIGlmIChwYXJhbXMudHJhY2tCeSA9PT0gbnVsbCkge1xuICAgICAgLy8gVE9ETzogV2Ugc2hvdWxkIG5vdCBmYWlsIGhlcmUsIGFuZCBpbnN0ZWFkIHRyeSB0byBwcm9kdWNlIHNvbWUgQVNUIGZvciB0aGUgbGFuZ3VhZ2VcbiAgICAgIC8vIHNlcnZpY2UuXG4gICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihhc3Quc3RhcnRTb3VyY2VTcGFuLCAnQGZvciBsb29wIG11c3QgaGF2ZSBhIFwidHJhY2tcIiBleHByZXNzaW9uJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgYGZvcmAgYmxvY2sgaGFzIGEgbWFpbiBzcGFuIHRoYXQgaW5jbHVkZXMgdGhlIGBlbXB0eWAgYnJhbmNoLiBGb3Igb25seSB0aGUgc3BhbiBvZiB0aGVcbiAgICAgIC8vIG1haW4gYGZvcmAgYm9keSwgdXNlIGBtYWluU291cmNlU3BhbmAuXG4gICAgICBjb25zdCBlbmRTcGFuID0gZW1wdHk/LmVuZFNvdXJjZVNwYW4gPz8gYXN0LmVuZFNvdXJjZVNwYW47XG4gICAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgYXN0LnNvdXJjZVNwYW4uc3RhcnQsXG4gICAgICAgIGVuZFNwYW4/LmVuZCA/PyBhc3Quc291cmNlU3Bhbi5lbmQsXG4gICAgICApO1xuICAgICAgbm9kZSA9IG5ldyB0LkZvckxvb3BCbG9jayhcbiAgICAgICAgcGFyYW1zLml0ZW1OYW1lLFxuICAgICAgICBwYXJhbXMuZXhwcmVzc2lvbixcbiAgICAgICAgcGFyYW1zLnRyYWNrQnkuZXhwcmVzc2lvbixcbiAgICAgICAgcGFyYW1zLnRyYWNrQnkua2V5d29yZFNwYW4sXG4gICAgICAgIHBhcmFtcy5jb250ZXh0LFxuICAgICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIGFzdC5jaGlsZHJlbiwgYXN0LmNoaWxkcmVuKSxcbiAgICAgICAgZW1wdHksXG4gICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICBlbmRTcGFuLFxuICAgICAgICBhc3QubmFtZVNwYW4sXG4gICAgICAgIGFzdC5pMThuLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge25vZGUsIGVycm9yc307XG59XG5cbi8qKiBDcmVhdGVzIGEgc3dpdGNoIGJsb2NrIGZyb20gYW4gSFRNTCBBU1Qgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTd2l0Y2hCbG9jayhcbiAgYXN0OiBodG1sLkJsb2NrLFxuICB2aXNpdG9yOiBodG1sLlZpc2l0b3IsXG4gIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4pOiB7bm9kZTogdC5Td2l0Y2hCbG9jayB8IG51bGw7IGVycm9yczogUGFyc2VFcnJvcltdfSB7XG4gIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlU3dpdGNoQmxvY2soYXN0KTtcbiAgY29uc3QgcHJpbWFyeUV4cHJlc3Npb24gPVxuICAgIGFzdC5wYXJhbWV0ZXJzLmxlbmd0aCA+IDBcbiAgICAgID8gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhhc3QucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcilcbiAgICAgIDogYmluZGluZ1BhcnNlci5wYXJzZUJpbmRpbmcoJycsIGZhbHNlLCBhc3Quc291cmNlU3BhbiwgMCk7XG4gIGNvbnN0IGNhc2VzOiB0LlN3aXRjaEJsb2NrQ2FzZVtdID0gW107XG4gIGNvbnN0IHVua25vd25CbG9ja3M6IHQuVW5rbm93bkJsb2NrW10gPSBbXTtcbiAgbGV0IGRlZmF1bHRDYXNlOiB0LlN3aXRjaEJsb2NrQ2FzZSB8IG51bGwgPSBudWxsO1xuXG4gIC8vIEhlcmUgd2UgYXNzdW1lIHRoYXQgYWxsIHRoZSBibG9ja3MgYXJlIHZhbGlkIGdpdmVuIHRoYXQgd2UgdmFsaWRhdGVkIHRoZW0gYWJvdmUuXG4gIGZvciAoY29uc3Qgbm9kZSBvZiBhc3QuY2hpbGRyZW4pIHtcbiAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgaHRtbC5CbG9jaykpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmICgobm9kZS5uYW1lICE9PSAnY2FzZScgfHwgbm9kZS5wYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkgJiYgbm9kZS5uYW1lICE9PSAnZGVmYXVsdCcpIHtcbiAgICAgIHVua25vd25CbG9ja3MucHVzaChuZXcgdC5Vbmtub3duQmxvY2sobm9kZS5uYW1lLCBub2RlLnNvdXJjZVNwYW4sIG5vZGUubmFtZVNwYW4pKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgbm9kZS5uYW1lID09PSAnY2FzZScgPyBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKG5vZGUucGFyYW1ldGVyc1swXSwgYmluZGluZ1BhcnNlcikgOiBudWxsO1xuICAgIGNvbnN0IGFzdCA9IG5ldyB0LlN3aXRjaEJsb2NrQ2FzZShcbiAgICAgIGV4cHJlc3Npb24sXG4gICAgICBodG1sLnZpc2l0QWxsKHZpc2l0b3IsIG5vZGUuY2hpbGRyZW4sIG5vZGUuY2hpbGRyZW4pLFxuICAgICAgbm9kZS5zb3VyY2VTcGFuLFxuICAgICAgbm9kZS5zdGFydFNvdXJjZVNwYW4sXG4gICAgICBub2RlLmVuZFNvdXJjZVNwYW4sXG4gICAgICBub2RlLm5hbWVTcGFuLFxuICAgICAgbm9kZS5pMThuLFxuICAgICk7XG5cbiAgICBpZiAoZXhwcmVzc2lvbiA9PT0gbnVsbCkge1xuICAgICAgZGVmYXVsdENhc2UgPSBhc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhc2VzLnB1c2goYXN0KTtcbiAgICB9XG4gIH1cblxuICAvLyBFbnN1cmUgdGhhdCB0aGUgZGVmYXVsdCBjYXNlIGlzIGxhc3QgaW4gdGhlIGFycmF5LlxuICBpZiAoZGVmYXVsdENhc2UgIT09IG51bGwpIHtcbiAgICBjYXNlcy5wdXNoKGRlZmF1bHRDYXNlKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbm9kZTogbmV3IHQuU3dpdGNoQmxvY2soXG4gICAgICBwcmltYXJ5RXhwcmVzc2lvbixcbiAgICAgIGNhc2VzLFxuICAgICAgdW5rbm93bkJsb2NrcyxcbiAgICAgIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgYXN0LnN0YXJ0U291cmNlU3BhbixcbiAgICAgIGFzdC5lbmRTb3VyY2VTcGFuLFxuICAgICAgYXN0Lm5hbWVTcGFuLFxuICAgICksXG4gICAgZXJyb3JzLFxuICB9O1xufVxuXG4vKiogUGFyc2VzIHRoZSBwYXJhbWV0ZXJzIG9mIGEgYGZvcmAgbG9vcCBibG9jay4gKi9cbmZ1bmN0aW9uIHBhcnNlRm9yTG9vcFBhcmFtZXRlcnMoXG4gIGJsb2NrOiBodG1sLkJsb2NrLFxuICBlcnJvcnM6IFBhcnNlRXJyb3JbXSxcbiAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbikge1xuICBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zdGFydFNvdXJjZVNwYW4sICdAZm9yIGxvb3AgZG9lcyBub3QgaGF2ZSBhbiBleHByZXNzaW9uJykpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgW2V4cHJlc3Npb25QYXJhbSwgLi4uc2Vjb25kYXJ5UGFyYW1zXSA9IGJsb2NrLnBhcmFtZXRlcnM7XG4gIGNvbnN0IG1hdGNoID0gc3RyaXBPcHRpb25hbFBhcmVudGhlc2VzKGV4cHJlc3Npb25QYXJhbSwgZXJyb3JzKT8ubWF0Y2goXG4gICAgRk9SX0xPT1BfRVhQUkVTU0lPTl9QQVRURVJOLFxuICApO1xuXG4gIGlmICghbWF0Y2ggfHwgbWF0Y2hbMl0udHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKFxuICAgICAgbmV3IFBhcnNlRXJyb3IoXG4gICAgICAgIGV4cHJlc3Npb25QYXJhbS5zb3VyY2VTcGFuLFxuICAgICAgICAnQ2Fubm90IHBhcnNlIGV4cHJlc3Npb24uIEBmb3IgbG9vcCBleHByZXNzaW9uIG11c3QgbWF0Y2ggdGhlIHBhdHRlcm4gXCI8aWRlbnRpZmllcj4gb2YgPGV4cHJlc3Npb24+XCInLFxuICAgICAgKSxcbiAgICApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgWywgaXRlbU5hbWUsIHJhd0V4cHJlc3Npb25dID0gbWF0Y2g7XG4gIGlmIChBTExPV0VEX0ZPUl9MT09QX0xFVF9WQVJJQUJMRVMuaGFzKGl0ZW1OYW1lKSkge1xuICAgIGVycm9ycy5wdXNoKFxuICAgICAgbmV3IFBhcnNlRXJyb3IoXG4gICAgICAgIGV4cHJlc3Npb25QYXJhbS5zb3VyY2VTcGFuLFxuICAgICAgICBgQGZvciBsb29wIGl0ZW0gbmFtZSBjYW5ub3QgYmUgb25lIG9mICR7QXJyYXkuZnJvbShBTExPV0VEX0ZPUl9MT09QX0xFVF9WQVJJQUJMRVMpLmpvaW4oXG4gICAgICAgICAgJywgJyxcbiAgICAgICAgKX0uYCxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIC8vIGBleHByZXNzaW9uUGFyYW0uZXhwcmVzc2lvbmAgY29udGFpbnMgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGFuZCB0aGUgZXhwcmVzc2lvbiBvZiB0aGVcbiAgLy8gZm9yLi4ub2Ygc3RhdGVtZW50LCBpLmUuICd1c2VyIG9mIHVzZXJzJyBUaGUgdmFyaWFibGUgb2YgYSBGb3JPZlN0YXRlbWVudCBpcyBfb25seV8gdGhlIFwiY29uc3RcbiAgLy8gdXNlclwiIHBhcnQgYW5kIGRvZXMgbm90IGluY2x1ZGUgXCJvZiB4XCIuXG4gIGNvbnN0IHZhcmlhYmxlTmFtZSA9IGV4cHJlc3Npb25QYXJhbS5leHByZXNzaW9uLnNwbGl0KCcgJylbMF07XG4gIGNvbnN0IHZhcmlhYmxlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4uc3RhcnQsXG4gICAgZXhwcmVzc2lvblBhcmFtLnNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KHZhcmlhYmxlTmFtZS5sZW5ndGgpLFxuICApO1xuICBjb25zdCByZXN1bHQgPSB7XG4gICAgaXRlbU5hbWU6IG5ldyB0LlZhcmlhYmxlKGl0ZW1OYW1lLCAnJGltcGxpY2l0JywgdmFyaWFibGVTcGFuLCB2YXJpYWJsZVNwYW4pLFxuICAgIHRyYWNrQnk6IG51bGwgYXMge2V4cHJlc3Npb246IEFTVFdpdGhTb3VyY2U7IGtleXdvcmRTcGFuOiBQYXJzZVNvdXJjZVNwYW59IHwgbnVsbCxcbiAgICBleHByZXNzaW9uOiBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKGV4cHJlc3Npb25QYXJhbSwgYmluZGluZ1BhcnNlciwgcmF3RXhwcmVzc2lvbiksXG4gICAgY29udGV4dDogQXJyYXkuZnJvbShBTExPV0VEX0ZPUl9MT09QX0xFVF9WQVJJQUJMRVMsICh2YXJpYWJsZU5hbWUpID0+IHtcbiAgICAgIC8vIEdpdmUgYW1iaWVudGx5LWF2YWlsYWJsZSBjb250ZXh0IHZhcmlhYmxlcyBlbXB0eSBzcGFucyBhdCB0aGUgZW5kIG9mXG4gICAgICAvLyB0aGUgc3RhcnQgb2YgdGhlIGBmb3JgIGJsb2NrLCBzaW5jZSB0aGV5IGFyZSBub3QgZXhwbGljaXRseSBkZWZpbmVkLlxuICAgICAgY29uc3QgZW1wdHlTcGFuQWZ0ZXJGb3JCbG9ja1N0YXJ0ID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLmVuZCxcbiAgICAgICAgYmxvY2suc3RhcnRTb3VyY2VTcGFuLmVuZCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gbmV3IHQuVmFyaWFibGUoXG4gICAgICAgIHZhcmlhYmxlTmFtZSxcbiAgICAgICAgdmFyaWFibGVOYW1lLFxuICAgICAgICBlbXB0eVNwYW5BZnRlckZvckJsb2NrU3RhcnQsXG4gICAgICAgIGVtcHR5U3BhbkFmdGVyRm9yQmxvY2tTdGFydCxcbiAgICAgICk7XG4gICAgfSksXG4gIH07XG5cbiAgZm9yIChjb25zdCBwYXJhbSBvZiBzZWNvbmRhcnlQYXJhbXMpIHtcbiAgICBjb25zdCBsZXRNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goRk9SX0xPT1BfTEVUX1BBVFRFUk4pO1xuXG4gICAgaWYgKGxldE1hdGNoICE9PSBudWxsKSB7XG4gICAgICBjb25zdCB2YXJpYWJsZXNTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgcGFyYW0uc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkobGV0TWF0Y2hbMF0ubGVuZ3RoIC0gbGV0TWF0Y2hbMV0ubGVuZ3RoKSxcbiAgICAgICAgcGFyYW0uc291cmNlU3Bhbi5lbmQsXG4gICAgICApO1xuICAgICAgcGFyc2VMZXRQYXJhbWV0ZXIoXG4gICAgICAgIHBhcmFtLnNvdXJjZVNwYW4sXG4gICAgICAgIGxldE1hdGNoWzFdLFxuICAgICAgICB2YXJpYWJsZXNTcGFuLFxuICAgICAgICBpdGVtTmFtZSxcbiAgICAgICAgcmVzdWx0LmNvbnRleHQsXG4gICAgICAgIGVycm9ycyxcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0cmFja01hdGNoID0gcGFyYW0uZXhwcmVzc2lvbi5tYXRjaChGT1JfTE9PUF9UUkFDS19QQVRURVJOKTtcblxuICAgIGlmICh0cmFja01hdGNoICE9PSBudWxsKSB7XG4gICAgICBpZiAocmVzdWx0LnRyYWNrQnkgIT09IG51bGwpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IocGFyYW0uc291cmNlU3BhbiwgJ0Bmb3IgbG9vcCBjYW4gb25seSBoYXZlIG9uZSBcInRyYWNrXCIgZXhwcmVzc2lvbicpLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHBhcnNlQmxvY2tQYXJhbWV0ZXJUb0JpbmRpbmcocGFyYW0sIGJpbmRpbmdQYXJzZXIsIHRyYWNrTWF0Y2hbMV0pO1xuICAgICAgICBpZiAoZXhwcmVzc2lvbi5hc3QgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgJ0Bmb3IgbG9vcCBtdXN0IGhhdmUgYSBcInRyYWNrXCIgZXhwcmVzc2lvbicpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qga2V5d29yZFNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICAgIHBhcmFtLnNvdXJjZVNwYW4uc3RhcnQsXG4gICAgICAgICAgcGFyYW0uc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkoJ3RyYWNrJy5sZW5ndGgpLFxuICAgICAgICApO1xuICAgICAgICByZXN1bHQudHJhY2tCeSA9IHtleHByZXNzaW9uLCBrZXl3b3JkU3Bhbn07XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBlcnJvcnMucHVzaChcbiAgICAgIG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgQGZvciBsb29wIHBhcmFtYXRlciBcIiR7cGFyYW0uZXhwcmVzc2lvbn1cImApLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKiogUGFyc2VzIHRoZSBgbGV0YCBwYXJhbWV0ZXIgb2YgYSBgZm9yYCBsb29wIGJsb2NrLiAqL1xuZnVuY3Rpb24gcGFyc2VMZXRQYXJhbWV0ZXIoXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgZXhwcmVzc2lvbjogc3RyaW5nLFxuICBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gIGxvb3BJdGVtTmFtZTogc3RyaW5nLFxuICBjb250ZXh0OiB0LlZhcmlhYmxlW10sXG4gIGVycm9yczogUGFyc2VFcnJvcltdLFxuKTogdm9pZCB7XG4gIGNvbnN0IHBhcnRzID0gZXhwcmVzc2lvbi5zcGxpdCgnLCcpO1xuICBsZXQgc3RhcnRTcGFuID0gc3Bhbi5zdGFydDtcbiAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgY29uc3QgZXhwcmVzc2lvblBhcnRzID0gcGFydC5zcGxpdCgnPScpO1xuICAgIGNvbnN0IG5hbWUgPSBleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyID8gZXhwcmVzc2lvblBhcnRzWzBdLnRyaW0oKSA6ICcnO1xuICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IGV4cHJlc3Npb25QYXJ0cy5sZW5ndGggPT09IDIgPyBleHByZXNzaW9uUGFydHNbMV0udHJpbSgpIDogJyc7XG5cbiAgICBpZiAobmFtZS5sZW5ndGggPT09IDAgfHwgdmFyaWFibGVOYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHNvdXJjZVNwYW4sXG4gICAgICAgICAgYEludmFsaWQgQGZvciBsb29wIFwibGV0XCIgcGFyYW1ldGVyLiBQYXJhbWV0ZXIgc2hvdWxkIG1hdGNoIHRoZSBwYXR0ZXJuIFwiPG5hbWU+ID0gPHZhcmlhYmxlIG5hbWU+XCJgLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKCFBTExPV0VEX0ZPUl9MT09QX0xFVF9WQVJJQUJMRVMuaGFzKHZhcmlhYmxlTmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICAgIGBVbmtub3duIFwibGV0XCIgcGFyYW1ldGVyIHZhcmlhYmxlIFwiJHt2YXJpYWJsZU5hbWV9XCIuIFRoZSBhbGxvd2VkIHZhcmlhYmxlcyBhcmU6ICR7QXJyYXkuZnJvbShcbiAgICAgICAgICAgIEFMTE9XRURfRk9SX0xPT1BfTEVUX1ZBUklBQkxFUyxcbiAgICAgICAgICApLmpvaW4oJywgJyl9YCxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmIChuYW1lID09PSBsb29wSXRlbU5hbWUpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VFcnJvcihcbiAgICAgICAgICBzb3VyY2VTcGFuLFxuICAgICAgICAgIGBJbnZhbGlkIEBmb3IgbG9vcCBcImxldFwiIHBhcmFtZXRlci4gVmFyaWFibGUgY2Fubm90IGJlIGNhbGxlZCBcIiR7bG9vcEl0ZW1OYW1lfVwiYCxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmIChjb250ZXh0LnNvbWUoKHYpID0+IHYubmFtZSA9PT0gbmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBgRHVwbGljYXRlIFwibGV0XCIgcGFyYW1ldGVyIHZhcmlhYmxlIFwiJHt2YXJpYWJsZU5hbWV9XCJgKSxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IFssIGtleUxlYWRpbmdXaGl0ZXNwYWNlLCBrZXlOYW1lXSA9XG4gICAgICAgIGV4cHJlc3Npb25QYXJ0c1swXS5tYXRjaChDSEFSQUNURVJTX0lOX1NVUlJPVU5ESU5HX1dISVRFU1BBQ0VfUEFUVEVSTikgPz8gW107XG4gICAgICBjb25zdCBrZXlTcGFuID1cbiAgICAgICAga2V5TGVhZGluZ1doaXRlc3BhY2UgIT09IHVuZGVmaW5lZCAmJiBleHByZXNzaW9uUGFydHMubGVuZ3RoID09PSAyXG4gICAgICAgICAgPyBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICAgICAgICAvKiBzdHJpcCBsZWFkaW5nIHNwYWNlcyAqL1xuICAgICAgICAgICAgICBzdGFydFNwYW4ubW92ZUJ5KGtleUxlYWRpbmdXaGl0ZXNwYWNlLmxlbmd0aCksXG4gICAgICAgICAgICAgIC8qIGFkdmFuY2UgdG8gZW5kIG9mIHRoZSB2YXJpYWJsZSBuYW1lICovXG4gICAgICAgICAgICAgIHN0YXJ0U3Bhbi5tb3ZlQnkoa2V5TGVhZGluZ1doaXRlc3BhY2UubGVuZ3RoICsga2V5TmFtZS5sZW5ndGgpLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIDogc3BhbjtcblxuICAgICAgbGV0IHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgaWYgKGV4cHJlc3Npb25QYXJ0cy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgY29uc3QgWywgdmFsdWVMZWFkaW5nV2hpdGVzcGFjZSwgaW1wbGljaXRdID1cbiAgICAgICAgICBleHByZXNzaW9uUGFydHNbMV0ubWF0Y2goQ0hBUkFDVEVSU19JTl9TVVJST1VORElOR19XSElURVNQQUNFX1BBVFRFUk4pID8/IFtdO1xuICAgICAgICB2YWx1ZVNwYW4gPVxuICAgICAgICAgIHZhbHVlTGVhZGluZ1doaXRlc3BhY2UgIT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgPyBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICAgICAgICAgIHN0YXJ0U3Bhbi5tb3ZlQnkoZXhwcmVzc2lvblBhcnRzWzBdLmxlbmd0aCArIDEgKyB2YWx1ZUxlYWRpbmdXaGl0ZXNwYWNlLmxlbmd0aCksXG4gICAgICAgICAgICAgICAgc3RhcnRTcGFuLm1vdmVCeShcbiAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb25QYXJ0c1swXS5sZW5ndGggKyAxICsgdmFsdWVMZWFkaW5nV2hpdGVzcGFjZS5sZW5ndGggKyBpbXBsaWNpdC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihrZXlTcGFuLnN0YXJ0LCB2YWx1ZVNwYW4/LmVuZCA/PyBrZXlTcGFuLmVuZCk7XG4gICAgICBjb250ZXh0LnB1c2gobmV3IHQuVmFyaWFibGUobmFtZSwgdmFyaWFibGVOYW1lLCBzb3VyY2VTcGFuLCBrZXlTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgICB9XG4gICAgc3RhcnRTcGFuID0gc3RhcnRTcGFuLm1vdmVCeShwYXJ0Lmxlbmd0aCArIDEgLyogYWRkIDEgdG8gbW92ZSBwYXN0IHRoZSBjb21tYSAqLyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3MgdGhhdCB0aGUgc2hhcGUgb2YgdGhlIGJsb2NrcyBjb25uZWN0ZWQgdG8gYW5cbiAqIGBAaWZgIGJsb2NrIGlzIGNvcnJlY3QuIFJldHVybnMgYW4gYXJyYXkgb2YgZXJyb3JzLlxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUlmQ29ubmVjdGVkQmxvY2tzKGNvbm5lY3RlZEJsb2NrczogaHRtbC5CbG9ja1tdKTogUGFyc2VFcnJvcltdIHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgbGV0IGhhc0Vsc2UgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbm5lY3RlZEJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGJsb2NrID0gY29ubmVjdGVkQmxvY2tzW2ldO1xuXG4gICAgaWYgKGJsb2NrLm5hbWUgPT09ICdlbHNlJykge1xuICAgICAgaWYgKGhhc0Vsc2UpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IFBhcnNlRXJyb3IoYmxvY2suc3RhcnRTb3VyY2VTcGFuLCAnQ29uZGl0aW9uYWwgY2FuIG9ubHkgaGF2ZSBvbmUgQGVsc2UgYmxvY2snKSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAoY29ubmVjdGVkQmxvY2tzLmxlbmd0aCA+IDEgJiYgaSA8IGNvbm5lY3RlZEJsb2Nrcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgJ0BlbHNlIGJsb2NrIG11c3QgYmUgbGFzdCBpbnNpZGUgdGhlIGNvbmRpdGlvbmFsJyksXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihibG9jay5zdGFydFNvdXJjZVNwYW4sICdAZWxzZSBibG9jayBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzJykpO1xuICAgICAgfVxuICAgICAgaGFzRWxzZSA9IHRydWU7XG4gICAgfSBlbHNlIGlmICghRUxTRV9JRl9QQVRURVJOLnRlc3QoYmxvY2submFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBuZXcgUGFyc2VFcnJvcihibG9jay5zdGFydFNvdXJjZVNwYW4sIGBVbnJlY29nbml6ZWQgY29uZGl0aW9uYWwgYmxvY2sgQCR7YmxvY2submFtZX1gKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVycm9ycztcbn1cblxuLyoqIENoZWNrcyB0aGF0IHRoZSBzaGFwZSBvZiBhIGBzd2l0Y2hgIGJsb2NrIGlzIHZhbGlkLiBSZXR1cm5zIGFuIGFycmF5IG9mIGVycm9ycy4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlU3dpdGNoQmxvY2soYXN0OiBodG1sLkJsb2NrKTogUGFyc2VFcnJvcltdIHtcbiAgY29uc3QgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgbGV0IGhhc0RlZmF1bHQgPSBmYWxzZTtcblxuICBpZiAoYXN0LnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgZXJyb3JzLnB1c2goXG4gICAgICBuZXcgUGFyc2VFcnJvcihhc3Quc3RhcnRTb3VyY2VTcGFuLCAnQHN3aXRjaCBibG9jayBtdXN0IGhhdmUgZXhhY3RseSBvbmUgcGFyYW1ldGVyJyksXG4gICAgKTtcbiAgICByZXR1cm4gZXJyb3JzO1xuICB9XG5cbiAgZm9yIChjb25zdCBub2RlIG9mIGFzdC5jaGlsZHJlbikge1xuICAgIC8vIFNraXAgb3ZlciBjb21tZW50cyBhbmQgZW1wdHkgdGV4dCBub2RlcyBpbnNpZGUgdGhlIHN3aXRjaCBibG9jay5cbiAgICAvLyBFbXB0eSB0ZXh0IG5vZGVzIGNhbiBiZSB1c2VkIGZvciBmb3JtYXR0aW5nIHdoaWxlIGNvbW1lbnRzIGRvbid0IGFmZmVjdCB0aGUgcnVudGltZS5cbiAgICBpZiAoXG4gICAgICBub2RlIGluc3RhbmNlb2YgaHRtbC5Db21tZW50IHx8XG4gICAgICAobm9kZSBpbnN0YW5jZW9mIGh0bWwuVGV4dCAmJiBub2RlLnZhbHVlLnRyaW0oKS5sZW5ndGggPT09IDApXG4gICAgKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgaHRtbC5CbG9jaykgfHwgKG5vZGUubmFtZSAhPT0gJ2Nhc2UnICYmIG5vZGUubmFtZSAhPT0gJ2RlZmF1bHQnKSkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZUVycm9yKG5vZGUuc291cmNlU3BhbiwgJ0Bzd2l0Y2ggYmxvY2sgY2FuIG9ubHkgY29udGFpbiBAY2FzZSBhbmQgQGRlZmF1bHQgYmxvY2tzJyksXG4gICAgICApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKG5vZGUubmFtZSA9PT0gJ2RlZmF1bHQnKSB7XG4gICAgICBpZiAoaGFzRGVmYXVsdCkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICBuZXcgUGFyc2VFcnJvcihub2RlLnN0YXJ0U291cmNlU3BhbiwgJ0Bzd2l0Y2ggYmxvY2sgY2FuIG9ubHkgaGF2ZSBvbmUgQGRlZmF1bHQgYmxvY2snKSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAobm9kZS5wYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Iobm9kZS5zdGFydFNvdXJjZVNwYW4sICdAZGVmYXVsdCBibG9jayBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzJykpO1xuICAgICAgfVxuICAgICAgaGFzRGVmYXVsdCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChub2RlLm5hbWUgPT09ICdjYXNlJyAmJiBub2RlLnBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlRXJyb3Iobm9kZS5zdGFydFNvdXJjZVNwYW4sICdAY2FzZSBibG9jayBtdXN0IGhhdmUgZXhhY3RseSBvbmUgcGFyYW1ldGVyJyksXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBlcnJvcnM7XG59XG5cbi8qKlxuICogUGFyc2VzIGEgYmxvY2sgcGFyYW1ldGVyIGludG8gYSBiaW5kaW5nIEFTVC5cbiAqIEBwYXJhbSBhc3QgQmxvY2sgcGFyYW1ldGVyIHRoYXQgc2hvdWxkIGJlIHBhcnNlZC5cbiAqIEBwYXJhbSBiaW5kaW5nUGFyc2VyIFBhcnNlciB0aGF0IHRoZSBleHByZXNzaW9uIHNob3VsZCBiZSBwYXJzZWQgd2l0aC5cbiAqIEBwYXJhbSBwYXJ0IFNwZWNpZmljIHBhcnQgb2YgdGhlIGV4cHJlc3Npb24gdGhhdCBzaG91bGQgYmUgcGFyc2VkLlxuICovXG5mdW5jdGlvbiBwYXJzZUJsb2NrUGFyYW1ldGVyVG9CaW5kaW5nKFxuICBhc3Q6IGh0bWwuQmxvY2tQYXJhbWV0ZXIsXG4gIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4gIHBhcnQ/OiBzdHJpbmcsXG4pOiBBU1RXaXRoU291cmNlIHtcbiAgbGV0IHN0YXJ0OiBudW1iZXI7XG4gIGxldCBlbmQ6IG51bWJlcjtcblxuICBpZiAodHlwZW9mIHBhcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgLy8gTm90ZTogYGxhc3RJbmRleE9mYCBoZXJlIHNob3VsZCBiZSBlbm91Z2ggdG8ga25vdyB0aGUgc3RhcnQgaW5kZXggb2YgdGhlIGV4cHJlc3Npb24sXG4gICAgLy8gYmVjYXVzZSB3ZSBrbm93IHRoYXQgaXQnbGwgYmUgYXQgdGhlIGVuZCBvZiB0aGUgcGFyYW0uIElkZWFsbHkgd2UgY291bGQgdXNlIHRoZSBgZGBcbiAgICAvLyBmbGFnIHdoZW4gbWF0Y2hpbmcgdmlhIHJlZ2V4IGFuZCBnZXQgdGhlIGluZGV4IGZyb20gYG1hdGNoLmluZGljZXNgLCBidXQgaXQncyB1bmNsZWFyXG4gICAgLy8gaWYgd2UgY2FuIHVzZSBpdCB5ZXQgc2luY2UgaXQncyBhIHJlbGF0aXZlbHkgbmV3IGZlYXR1cmUuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdGMzOS9wcm9wb3NhbC1yZWdleHAtbWF0Y2gtaW5kaWNlc1xuICAgIHN0YXJ0ID0gTWF0aC5tYXgoMCwgYXN0LmV4cHJlc3Npb24ubGFzdEluZGV4T2YocGFydCkpO1xuICAgIGVuZCA9IHN0YXJ0ICsgcGFydC5sZW5ndGg7XG4gIH0gZWxzZSB7XG4gICAgc3RhcnQgPSAwO1xuICAgIGVuZCA9IGFzdC5leHByZXNzaW9uLmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLnBhcnNlQmluZGluZyhcbiAgICBhc3QuZXhwcmVzc2lvbi5zbGljZShzdGFydCwgZW5kKSxcbiAgICBmYWxzZSxcbiAgICBhc3Quc291cmNlU3BhbixcbiAgICBhc3Quc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBzdGFydCxcbiAgKTtcbn1cblxuLyoqIFBhcnNlcyB0aGUgcGFyYW1ldGVyIG9mIGEgY29uZGl0aW9uYWwgYmxvY2sgKGBpZmAgb3IgYGVsc2UgaWZgKS4gKi9cbmZ1bmN0aW9uIHBhcnNlQ29uZGl0aW9uYWxCbG9ja1BhcmFtZXRlcnMoXG4gIGJsb2NrOiBodG1sLkJsb2NrLFxuICBlcnJvcnM6IFBhcnNlRXJyb3JbXSxcbiAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbikge1xuICBpZiAoYmxvY2sucGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaChcbiAgICAgIG5ldyBQYXJzZUVycm9yKGJsb2NrLnN0YXJ0U291cmNlU3BhbiwgJ0NvbmRpdGlvbmFsIGJsb2NrIGRvZXMgbm90IGhhdmUgYW4gZXhwcmVzc2lvbicpLFxuICAgICk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gcGFyc2VCbG9ja1BhcmFtZXRlclRvQmluZGluZyhibG9jay5wYXJhbWV0ZXJzWzBdLCBiaW5kaW5nUGFyc2VyKTtcbiAgbGV0IGV4cHJlc3Npb25BbGlhczogdC5WYXJpYWJsZSB8IG51bGwgPSBudWxsO1xuXG4gIC8vIFN0YXJ0IGZyb20gMSBzaW5jZSB3ZSBwcm9jZXNzZWQgdGhlIGZpcnN0IHBhcmFtZXRlciBhbHJlYWR5LlxuICBmb3IgKGxldCBpID0gMTsgaSA8IGJsb2NrLnBhcmFtZXRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBwYXJhbSA9IGJsb2NrLnBhcmFtZXRlcnNbaV07XG4gICAgY29uc3QgYWxpYXNNYXRjaCA9IHBhcmFtLmV4cHJlc3Npb24ubWF0Y2goQ09ORElUSU9OQUxfQUxJQVNfUEFUVEVSTik7XG5cbiAgICAvLyBGb3Igbm93IGNvbmRpdGlvbmFscyBjYW4gb25seSBoYXZlIGFuIGBhc2AgcGFyYW1ldGVyLlxuICAgIC8vIFdlIG1heSB3YW50IHRvIHJld29yayB0aGlzIGxhdGVyIGlmIHdlIGFkZCBtb3JlLlxuICAgIGlmIChhbGlhc01hdGNoID09PSBudWxsKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgbmV3IFBhcnNlRXJyb3IoXG4gICAgICAgICAgcGFyYW0uc291cmNlU3BhbixcbiAgICAgICAgICBgVW5yZWNvZ25pemVkIGNvbmRpdGlvbmFsIHBhcmFtYXRlciBcIiR7cGFyYW0uZXhwcmVzc2lvbn1cImAsXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAoYmxvY2submFtZSAhPT0gJ2lmJykge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZUVycm9yKFxuICAgICAgICAgIHBhcmFtLnNvdXJjZVNwYW4sXG4gICAgICAgICAgJ1wiYXNcIiBleHByZXNzaW9uIGlzIG9ubHkgYWxsb3dlZCBvbiB0aGUgcHJpbWFyeSBAaWYgYmxvY2snLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIG5ldyBQYXJzZUVycm9yKHBhcmFtLnNvdXJjZVNwYW4sICdDb25kaXRpb25hbCBjYW4gb25seSBoYXZlIG9uZSBcImFzXCIgZXhwcmVzc2lvbicpLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmFtZSA9IGFsaWFzTWF0Y2hbMl0udHJpbSgpO1xuICAgICAgY29uc3QgdmFyaWFibGVTdGFydCA9IHBhcmFtLnNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KGFsaWFzTWF0Y2hbMV0ubGVuZ3RoKTtcbiAgICAgIGNvbnN0IHZhcmlhYmxlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4odmFyaWFibGVTdGFydCwgdmFyaWFibGVTdGFydC5tb3ZlQnkobmFtZS5sZW5ndGgpKTtcbiAgICAgIGV4cHJlc3Npb25BbGlhcyA9IG5ldyB0LlZhcmlhYmxlKG5hbWUsIG5hbWUsIHZhcmlhYmxlU3BhbiwgdmFyaWFibGVTcGFuKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2V4cHJlc3Npb24sIGV4cHJlc3Npb25BbGlhc307XG59XG5cbi8qKiBTdHJpcHMgb3B0aW9uYWwgcGFyZW50aGVzZXMgYXJvdW5kIGZyb20gYSBjb250cm9sIGZyb20gZXhwcmVzc2lvbiBwYXJhbWV0ZXIuICovXG5mdW5jdGlvbiBzdHJpcE9wdGlvbmFsUGFyZW50aGVzZXMocGFyYW06IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGVycm9yczogUGFyc2VFcnJvcltdKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSBwYXJhbS5leHByZXNzaW9uO1xuICBjb25zdCBzcGFjZVJlZ2V4ID0gL15cXHMkLztcbiAgbGV0IG9wZW5QYXJlbnMgPSAwO1xuICBsZXQgc3RhcnQgPSAwO1xuICBsZXQgZW5kID0gZXhwcmVzc2lvbi5sZW5ndGggLSAxO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwcmVzc2lvbi5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoYXIgPSBleHByZXNzaW9uW2ldO1xuXG4gICAgaWYgKGNoYXIgPT09ICcoJykge1xuICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgIG9wZW5QYXJlbnMrKztcbiAgICB9IGVsc2UgaWYgKHNwYWNlUmVnZXgudGVzdChjaGFyKSkge1xuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChvcGVuUGFyZW5zID09PSAwKSB7XG4gICAgcmV0dXJuIGV4cHJlc3Npb247XG4gIH1cblxuICBmb3IgKGxldCBpID0gZXhwcmVzc2lvbi5sZW5ndGggLSAxOyBpID4gLTE7IGktLSkge1xuICAgIGNvbnN0IGNoYXIgPSBleHByZXNzaW9uW2ldO1xuXG4gICAgaWYgKGNoYXIgPT09ICcpJykge1xuICAgICAgZW5kID0gaTtcbiAgICAgIG9wZW5QYXJlbnMtLTtcbiAgICAgIGlmIChvcGVuUGFyZW5zID09PSAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3BhY2VSZWdleC50ZXN0KGNoYXIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wZW5QYXJlbnMgIT09IDApIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihwYXJhbS5zb3VyY2VTcGFuLCAnVW5jbG9zZWQgcGFyZW50aGVzZXMgaW4gZXhwcmVzc2lvbicpKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBleHByZXNzaW9uLnNsaWNlKHN0YXJ0LCBlbmQpO1xufVxuIl19