/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as chars from '../chars';
import { Lexer, TokenType } from '../expression_parser/lexer';
import { ParseError, ParseSourceSpan } from '../parse_util';
import * as t from './r3_ast';
/** Pattern for a timing value in a trigger. */
const TIME_PATTERN = /^\d+(ms|s)?$/;
/** Pattern for a separator between keywords in a trigger expression. */
const SEPARATOR_PATTERN = /^\s$/;
/** Pairs of characters that form syntax that is comma-delimited. */
const COMMA_DELIMITED_SYNTAX = new Map([
    [chars.$LBRACE, chars.$RBRACE],
    [chars.$LBRACKET, chars.$RBRACKET],
    [chars.$LPAREN, chars.$RPAREN], // Function calls
]);
/** Possible types of `on` triggers. */
var OnTriggerType;
(function (OnTriggerType) {
    OnTriggerType["IDLE"] = "idle";
    OnTriggerType["TIMER"] = "timer";
    OnTriggerType["INTERACTION"] = "interaction";
    OnTriggerType["IMMEDIATE"] = "immediate";
    OnTriggerType["HOVER"] = "hover";
    OnTriggerType["VIEWPORT"] = "viewport";
})(OnTriggerType || (OnTriggerType = {}));
/** Parses a `when` deferred trigger. */
export function parseWhenTrigger({ expression, sourceSpan }, bindingParser, triggers, errors) {
    const whenIndex = expression.indexOf('when');
    const whenSourceSpan = new ParseSourceSpan(sourceSpan.start.moveBy(whenIndex), sourceSpan.start.moveBy(whenIndex + 'when'.length));
    const prefetchSpan = getPrefetchSpan(expression, sourceSpan);
    // This is here just to be safe, we shouldn't enter this function
    // in the first place if a block doesn't have the "when" keyword.
    if (whenIndex === -1) {
        errors.push(new ParseError(sourceSpan, `Could not find "when" keyword in expression`));
    }
    else {
        const start = getTriggerParametersStart(expression, whenIndex + 1);
        const parsed = bindingParser.parseBinding(expression.slice(start), false, sourceSpan, sourceSpan.start.offset + start);
        trackTrigger('when', triggers, errors, new t.BoundDeferredTrigger(parsed, sourceSpan, prefetchSpan, whenSourceSpan));
    }
}
/** Parses an `on` trigger */
export function parseOnTrigger({ expression, sourceSpan }, triggers, errors, placeholder) {
    const onIndex = expression.indexOf('on');
    const onSourceSpan = new ParseSourceSpan(sourceSpan.start.moveBy(onIndex), sourceSpan.start.moveBy(onIndex + 'on'.length));
    const prefetchSpan = getPrefetchSpan(expression, sourceSpan);
    // This is here just to be safe, we shouldn't enter this function
    // in the first place if a block doesn't have the "on" keyword.
    if (onIndex === -1) {
        errors.push(new ParseError(sourceSpan, `Could not find "on" keyword in expression`));
    }
    else {
        const start = getTriggerParametersStart(expression, onIndex + 1);
        const parser = new OnTriggerParser(expression, start, sourceSpan, triggers, errors, placeholder, prefetchSpan, onSourceSpan);
        parser.parse();
    }
}
function getPrefetchSpan(expression, sourceSpan) {
    if (!expression.startsWith('prefetch')) {
        return null;
    }
    return new ParseSourceSpan(sourceSpan.start, sourceSpan.start.moveBy('prefetch'.length));
}
class OnTriggerParser {
    constructor(expression, start, span, triggers, errors, placeholder, prefetchSpan, onSourceSpan) {
        this.expression = expression;
        this.start = start;
        this.span = span;
        this.triggers = triggers;
        this.errors = errors;
        this.placeholder = placeholder;
        this.prefetchSpan = prefetchSpan;
        this.onSourceSpan = onSourceSpan;
        this.index = 0;
        this.tokens = new Lexer().tokenize(expression.slice(start));
    }
    parse() {
        while (this.tokens.length > 0 && this.index < this.tokens.length) {
            const token = this.token();
            if (!token.isIdentifier()) {
                this.unexpectedToken(token);
                break;
            }
            // An identifier immediately followed by a comma or the end of
            // the expression cannot have parameters so we can exit early.
            if (this.isFollowedByOrLast(chars.$COMMA)) {
                this.consumeTrigger(token, []);
                this.advance();
            }
            else if (this.isFollowedByOrLast(chars.$LPAREN)) {
                this.advance(); // Advance to the opening paren.
                const prevErrors = this.errors.length;
                const parameters = this.consumeParameters();
                if (this.errors.length !== prevErrors) {
                    break;
                }
                this.consumeTrigger(token, parameters);
                this.advance(); // Advance past the closing paren.
            }
            else if (this.index < this.tokens.length - 1) {
                this.unexpectedToken(this.tokens[this.index + 1]);
            }
            this.advance();
        }
    }
    advance() {
        this.index++;
    }
    isFollowedByOrLast(char) {
        if (this.index === this.tokens.length - 1) {
            return true;
        }
        return this.tokens[this.index + 1].isCharacter(char);
    }
    token() {
        return this.tokens[Math.min(this.index, this.tokens.length - 1)];
    }
    consumeTrigger(identifier, parameters) {
        const triggerNameStartSpan = this.span.start.moveBy(this.start + identifier.index - this.tokens[0].index);
        const nameSpan = new ParseSourceSpan(triggerNameStartSpan, triggerNameStartSpan.moveBy(identifier.strValue.length));
        const endSpan = triggerNameStartSpan.moveBy(this.token().end - identifier.index);
        // Put the prefetch and on spans with the first trigger
        // This should maybe be refactored to have something like an outer OnGroup AST
        // Since triggers can be grouped with commas "on hover(x), interaction(y)"
        const isFirstTrigger = identifier.index === 0;
        const onSourceSpan = isFirstTrigger ? this.onSourceSpan : null;
        const prefetchSourceSpan = isFirstTrigger ? this.prefetchSpan : null;
        const sourceSpan = new ParseSourceSpan(isFirstTrigger ? this.span.start : triggerNameStartSpan, endSpan);
        try {
            switch (identifier.toString()) {
                case OnTriggerType.IDLE:
                    this.trackTrigger('idle', createIdleTrigger(parameters, nameSpan, sourceSpan, prefetchSourceSpan, onSourceSpan));
                    break;
                case OnTriggerType.TIMER:
                    this.trackTrigger('timer', createTimerTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan));
                    break;
                case OnTriggerType.INTERACTION:
                    this.trackTrigger('interaction', createInteractionTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan, this.placeholder));
                    break;
                case OnTriggerType.IMMEDIATE:
                    this.trackTrigger('immediate', createImmediateTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan));
                    break;
                case OnTriggerType.HOVER:
                    this.trackTrigger('hover', createHoverTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan, this.placeholder));
                    break;
                case OnTriggerType.VIEWPORT:
                    this.trackTrigger('viewport', createViewportTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan, this.placeholder));
                    break;
                default:
                    throw new Error(`Unrecognized trigger type "${identifier}"`);
            }
        }
        catch (e) {
            this.error(identifier, e.message);
        }
    }
    consumeParameters() {
        const parameters = [];
        if (!this.token().isCharacter(chars.$LPAREN)) {
            this.unexpectedToken(this.token());
            return parameters;
        }
        this.advance();
        const commaDelimStack = [];
        let current = '';
        while (this.index < this.tokens.length) {
            const token = this.token();
            // Stop parsing if we've hit the end character and we're outside of a comma-delimited syntax.
            // Note that we don't need to account for strings here since the lexer already parsed them
            // into string tokens.
            if (token.isCharacter(chars.$RPAREN) && commaDelimStack.length === 0) {
                if (current.length) {
                    parameters.push(current);
                }
                break;
            }
            // In the `on` microsyntax "top-level" commas (e.g. ones outside of an parameters) separate
            // the different triggers (e.g. `on idle,timer(500)`). This is problematic, because the
            // function-like syntax also implies that multiple parameters can be passed into the
            // individual trigger (e.g. `on foo(a, b)`). To avoid tripping up the parser with commas that
            // are part of other sorts of syntax (object literals, arrays), we treat anything inside
            // a comma-delimited syntax block as plain text.
            if (token.type === TokenType.Character && COMMA_DELIMITED_SYNTAX.has(token.numValue)) {
                commaDelimStack.push(COMMA_DELIMITED_SYNTAX.get(token.numValue));
            }
            if (commaDelimStack.length > 0 &&
                token.isCharacter(commaDelimStack[commaDelimStack.length - 1])) {
                commaDelimStack.pop();
            }
            // If we hit a comma outside of a comma-delimited syntax, it means
            // that we're at the top level and we're starting a new parameter.
            if (commaDelimStack.length === 0 && token.isCharacter(chars.$COMMA) && current.length > 0) {
                parameters.push(current);
                current = '';
                this.advance();
                continue;
            }
            // Otherwise treat the token as a plain text character in the current parameter.
            current += this.tokenText();
            this.advance();
        }
        if (!this.token().isCharacter(chars.$RPAREN) || commaDelimStack.length > 0) {
            this.error(this.token(), 'Unexpected end of expression');
        }
        if (this.index < this.tokens.length - 1 &&
            !this.tokens[this.index + 1].isCharacter(chars.$COMMA)) {
            this.unexpectedToken(this.tokens[this.index + 1]);
        }
        return parameters;
    }
    tokenText() {
        // Tokens have a toString already which we could use, but for string tokens it omits the quotes.
        // Eventually we could expose this information on the token directly.
        return this.expression.slice(this.start + this.token().index, this.start + this.token().end);
    }
    trackTrigger(name, trigger) {
        trackTrigger(name, this.triggers, this.errors, trigger);
    }
    error(token, message) {
        const newStart = this.span.start.moveBy(this.start + token.index);
        const newEnd = newStart.moveBy(token.end - token.index);
        this.errors.push(new ParseError(new ParseSourceSpan(newStart, newEnd), message));
    }
    unexpectedToken(token) {
        this.error(token, `Unexpected token "${token}"`);
    }
}
/** Adds a trigger to a map of triggers. */
function trackTrigger(name, allTriggers, errors, trigger) {
    if (allTriggers[name]) {
        errors.push(new ParseError(trigger.sourceSpan, `Duplicate "${name}" trigger is not allowed`));
    }
    else {
        allTriggers[name] = trigger;
    }
}
function createIdleTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan) {
    if (parameters.length > 0) {
        throw new Error(`"${OnTriggerType.IDLE}" trigger cannot have parameters`);
    }
    return new t.IdleDeferredTrigger(nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
}
function createTimerTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan) {
    if (parameters.length !== 1) {
        throw new Error(`"${OnTriggerType.TIMER}" trigger must have exactly one parameter`);
    }
    const delay = parseDeferredTime(parameters[0]);
    if (delay === null) {
        throw new Error(`Could not parse time value of trigger "${OnTriggerType.TIMER}"`);
    }
    return new t.TimerDeferredTrigger(delay, nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
}
function createImmediateTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan) {
    if (parameters.length > 0) {
        throw new Error(`"${OnTriggerType.IMMEDIATE}" trigger cannot have parameters`);
    }
    return new t.ImmediateDeferredTrigger(nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
}
function createHoverTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, placeholder) {
    validateReferenceBasedTrigger(OnTriggerType.HOVER, parameters, placeholder);
    return new t.HoverDeferredTrigger(parameters[0] ?? null, nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
}
function createInteractionTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, placeholder) {
    validateReferenceBasedTrigger(OnTriggerType.INTERACTION, parameters, placeholder);
    return new t.InteractionDeferredTrigger(parameters[0] ?? null, nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
}
function createViewportTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, placeholder) {
    validateReferenceBasedTrigger(OnTriggerType.VIEWPORT, parameters, placeholder);
    return new t.ViewportDeferredTrigger(parameters[0] ?? null, nameSpan, sourceSpan, prefetchSpan, onSourceSpan);
}
function validateReferenceBasedTrigger(type, parameters, placeholder) {
    if (parameters.length > 1) {
        throw new Error(`"${type}" trigger can only have zero or one parameters`);
    }
    if (parameters.length === 0) {
        if (placeholder === null) {
            throw new Error(`"${type}" trigger with no parameters can only be placed on an @defer that has a @placeholder block`);
        }
        if (placeholder.children.length !== 1 || !(placeholder.children[0] instanceof t.Element)) {
            throw new Error(`"${type}" trigger with no parameters can only be placed on an @defer that has a ` +
                `@placeholder block with exactly one root element node`);
        }
    }
}
/** Gets the index within an expression at which the trigger parameters start. */
export function getTriggerParametersStart(value, startPosition = 0) {
    let hasFoundSeparator = false;
    for (let i = startPosition; i < value.length; i++) {
        if (SEPARATOR_PATTERN.test(value[i])) {
            hasFoundSeparator = true;
        }
        else if (hasFoundSeparator) {
            return i;
        }
    }
    return -1;
}
/**
 * Parses a time expression from a deferred trigger to
 * milliseconds. Returns null if it cannot be parsed.
 */
export function parseDeferredTime(value) {
    const match = value.match(TIME_PATTERN);
    if (!match) {
        return null;
    }
    const [time, units] = match;
    return parseInt(time) * (units === 's' ? 1000 : 1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZGVmZXJyZWRfdHJpZ2dlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19kZWZlcnJlZF90cmlnZ2Vycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsS0FBSyxFQUFTLFNBQVMsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBRW5FLE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRzFELE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVSxDQUFDO0FBRTlCLCtDQUErQztBQUMvQyxNQUFNLFlBQVksR0FBRyxjQUFjLENBQUM7QUFFcEMsd0VBQXdFO0FBQ3hFLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDO0FBRWpDLG9FQUFvRTtBQUNwRSxNQUFNLHNCQUFzQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3JDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDO0lBQzlCLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDO0lBQ2xDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQU8saUJBQWlCO0NBQ3ZELENBQUMsQ0FBQztBQUVILHVDQUF1QztBQUN2QyxJQUFLLGFBT0o7QUFQRCxXQUFLLGFBQWE7SUFDaEIsOEJBQWEsQ0FBQTtJQUNiLGdDQUFlLENBQUE7SUFDZiw0Q0FBMkIsQ0FBQTtJQUMzQix3Q0FBdUIsQ0FBQTtJQUN2QixnQ0FBZSxDQUFBO0lBQ2Ysc0NBQXFCLENBQUE7QUFDdkIsQ0FBQyxFQVBJLGFBQWEsS0FBYixhQUFhLFFBT2pCO0FBRUQsd0NBQXdDO0FBQ3hDLE1BQU0sVUFBVSxnQkFB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QUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUN4RixNQUFNLElBQUksS0FBSyxDQUNYLElBQUksSUFBSSwwRUFBMEU7Z0JBQ2xGLHVEQUF1RCxDQUFDLENBQUM7U0FDOUQ7S0FDRjtBQUNILENBQUM7QUFFRCxpRkFBaUY7QUFDakYsTUFBTSxVQUFVLHlCQUF5QixDQUFDLEtBQWEsRUFBRSxhQUFhLEdBQUcsQ0FBQztJQUN4RSxJQUFJLGlCQUFpQixHQUFHLEtBQUssQ0FBQztJQUU5QixLQUFLLElBQUksQ0FBQyxHQUFHLGFBQWEsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNqRCxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNwQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7U0FDMUI7YUFBTSxJQUFJLGlCQUFpQixFQUFFO1lBQzVCLE9BQU8sQ0FBQyxDQUFDO1NBQ1Y7S0FDRjtJQUVELE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDWixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGlCQUFpQixDQUFDLEtBQWE7SUFDN0MsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUV4QyxJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1YsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUVELE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQzVCLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoYXJzIGZyb20gJy4uL2NoYXJzJztcbmltcG9ydCB7TGV4ZXIsIFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5cbmltcG9ydCAqIGFzIHQgZnJvbSAnLi9yM19hc3QnO1xuXG4vKiogUGF0dGVybiBmb3IgYSB0aW1pbmcgdmFsdWUgaW4gYSB0cmlnZ2VyLiAqL1xuY29uc3QgVElNRV9QQVRURVJOID0gL15cXGQrKG1zfHMpPyQvO1xuXG4vKiogUGF0dGVybiBmb3IgYSBzZXBhcmF0b3IgYmV0d2VlbiBrZXl3b3JkcyBpbiBhIHRyaWdnZXIgZXhwcmVzc2lvbi4gKi9cbmNvbnN0IFNFUEFSQVRPUl9QQVRURVJOID0gL15cXHMkLztcblxuLyoqIFBhaXJzIG9mIGNoYXJhY3RlcnMgdGhhdCBmb3JtIHN5bnRheCB0aGF0IGlzIGNvbW1hLWRlbGltaXRlZC4gKi9cbmNvbnN0IENPTU1BX0RFTElNSVRFRF9TWU5UQVggPSBuZXcgTWFwKFtcbiAgW2NoYXJzLiRMQlJBQ0UsIGNoYXJzLiRSQlJBQ0VdLCAgICAgIC8vIE9iamVjdCBsaXRlcmFsc1xuICBbY2hhcnMuJExCUkFDS0VULCBjaGFycy4kUkJSQUNLRVRdLCAgLy8gQXJyYXkgbGl0ZXJhbHNcbiAgW2NoYXJzLiRMUEFSRU4sIGNoYXJzLiRSUEFSRU5dLCAgICAgIC8vIEZ1bmN0aW9uIGNhbGxzXG5dKTtcblxuLyoqIFBvc3NpYmxlIHR5cGVzIG9mIGBvbmAgdHJpZ2dlcnMuICovXG5lbnVtIE9uVHJpZ2dlclR5cGUge1xuICBJRExFID0gJ2lkbGUnLFxuICBUSU1FUiA9ICd0aW1lcicsXG4gIElOVEVSQUNUSU9OID0gJ2ludGVyYWN0aW9uJyxcbiAgSU1NRURJQVRFID0gJ2ltbWVkaWF0ZScsXG4gIEhPVkVSID0gJ2hvdmVyJyxcbiAgVklFV1BPUlQgPSAndmlld3BvcnQnLFxufVxuXG4vKiogUGFyc2VzIGEgYHdoZW5gIGRlZmVycmVkIHRyaWdnZXIuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VXaGVuVHJpZ2dlcihcbiAgICB7ZXhwcmVzc2lvbiwgc291cmNlU3Bhbn06IGh0bWwuQmxvY2tQYXJhbWV0ZXIsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsXG4gICAgdHJpZ2dlcnM6IHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSk6IHZvaWQge1xuICBjb25zdCB3aGVuSW5kZXggPSBleHByZXNzaW9uLmluZGV4T2YoJ3doZW4nKTtcbiAgY29uc3Qgd2hlblNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkod2hlbkluZGV4KSwgc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkod2hlbkluZGV4ICsgJ3doZW4nLmxlbmd0aCkpO1xuICBjb25zdCBwcmVmZXRjaFNwYW4gPSBnZXRQcmVmZXRjaFNwYW4oZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG5cbiAgLy8gVGhpcyBpcyBoZXJlIGp1c3QgdG8gYmUgc2FmZSwgd2Ugc2hvdWxkbid0IGVudGVyIHRoaXMgZnVuY3Rpb25cbiAgLy8gaW4gdGhlIGZpcnN0IHBsYWNlIGlmIGEgYmxvY2sgZG9lc24ndCBoYXZlIHRoZSBcIndoZW5cIiBrZXl3b3JkLlxuICBpZiAod2hlbkluZGV4ID09PSAtMSkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIGBDb3VsZCBub3QgZmluZCBcIndoZW5cIiBrZXl3b3JkIGluIGV4cHJlc3Npb25gKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgc3RhcnQgPSBnZXRUcmlnZ2VyUGFyYW1ldGVyc1N0YXJ0KGV4cHJlc3Npb24sIHdoZW5JbmRleCArIDEpO1xuICAgIGNvbnN0IHBhcnNlZCA9IGJpbmRpbmdQYXJzZXIucGFyc2VCaW5kaW5nKFxuICAgICAgICBleHByZXNzaW9uLnNsaWNlKHN0YXJ0KSwgZmFsc2UsIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0ICsgc3RhcnQpO1xuICAgIHRyYWNrVHJpZ2dlcihcbiAgICAgICAgJ3doZW4nLCB0cmlnZ2VycywgZXJyb3JzLFxuICAgICAgICBuZXcgdC5Cb3VuZERlZmVycmVkVHJpZ2dlcihwYXJzZWQsIHNvdXJjZVNwYW4sIHByZWZldGNoU3Bhbiwgd2hlblNvdXJjZVNwYW4pKTtcbiAgfVxufVxuXG4vKiogUGFyc2VzIGFuIGBvbmAgdHJpZ2dlciAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlT25UcmlnZ2VyKFxuICAgIHtleHByZXNzaW9uLCBzb3VyY2VTcGFufTogaHRtbC5CbG9ja1BhcmFtZXRlciwgdHJpZ2dlcnM6IHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzLFxuICAgIGVycm9yczogUGFyc2VFcnJvcltdLCBwbGFjZWhvbGRlcjogdC5EZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXJ8bnVsbCk6IHZvaWQge1xuICBjb25zdCBvbkluZGV4ID0gZXhwcmVzc2lvbi5pbmRleE9mKCdvbicpO1xuICBjb25zdCBvblNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgc291cmNlU3Bhbi5zdGFydC5tb3ZlQnkob25JbmRleCksIHNvdXJjZVNwYW4uc3RhcnQubW92ZUJ5KG9uSW5kZXggKyAnb24nLmxlbmd0aCkpO1xuICBjb25zdCBwcmVmZXRjaFNwYW4gPSBnZXRQcmVmZXRjaFNwYW4oZXhwcmVzc2lvbiwgc291cmNlU3Bhbik7XG5cbiAgLy8gVGhpcyBpcyBoZXJlIGp1c3QgdG8gYmUgc2FmZSwgd2Ugc2hvdWxkbid0IGVudGVyIHRoaXMgZnVuY3Rpb25cbiAgLy8gaW4gdGhlIGZpcnN0IHBsYWNlIGlmIGEgYmxvY2sgZG9lc24ndCBoYXZlIHRoZSBcIm9uXCIga2V5d29yZC5cbiAgaWYgKG9uSW5kZXggPT09IC0xKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Ioc291cmNlU3BhbiwgYENvdWxkIG5vdCBmaW5kIFwib25cIiBrZXl3b3JkIGluIGV4cHJlc3Npb25gKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgc3RhcnQgPSBnZXRUcmlnZ2VyUGFyYW1ldGVyc1N0YXJ0KGV4cHJlc3Npb24sIG9uSW5kZXggKyAxKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgT25UcmlnZ2VyUGFyc2VyKFxuICAgICAgICBleHByZXNzaW9uLCBzdGFydCwgc291cmNlU3BhbiwgdHJpZ2dlcnMsIGVycm9ycywgcGxhY2Vob2xkZXIsIHByZWZldGNoU3Bhbiwgb25Tb3VyY2VTcGFuKTtcbiAgICBwYXJzZXIucGFyc2UoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRQcmVmZXRjaFNwYW4oZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgaWYgKCFleHByZXNzaW9uLnN0YXJ0c1dpdGgoJ3ByZWZldGNoJykpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3Bhbihzb3VyY2VTcGFuLnN0YXJ0LCBzb3VyY2VTcGFuLnN0YXJ0Lm1vdmVCeSgncHJlZmV0Y2gnLmxlbmd0aCkpO1xufVxuXG5cbmNsYXNzIE9uVHJpZ2dlclBhcnNlciB7XG4gIHByaXZhdGUgaW5kZXggPSAwO1xuICBwcml2YXRlIHRva2VuczogVG9rZW5bXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgZXhwcmVzc2lvbjogc3RyaW5nLCBwcml2YXRlIHN0YXJ0OiBudW1iZXIsIHByaXZhdGUgc3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHJpdmF0ZSB0cmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIHByaXZhdGUgZXJyb3JzOiBQYXJzZUVycm9yW10sXG4gICAgICBwcml2YXRlIHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsLFxuICAgICAgcHJpdmF0ZSBwcmVmZXRjaFNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBwcml2YXRlIG9uU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgdGhpcy50b2tlbnMgPSBuZXcgTGV4ZXIoKS50b2tlbml6ZShleHByZXNzaW9uLnNsaWNlKHN0YXJ0KSk7XG4gIH1cblxuICBwYXJzZSgpOiB2b2lkIHtcbiAgICB3aGlsZSAodGhpcy50b2tlbnMubGVuZ3RoID4gMCAmJiB0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICBjb25zdCB0b2tlbiA9IHRoaXMudG9rZW4oKTtcblxuICAgICAgaWYgKCF0b2tlbi5pc0lkZW50aWZpZXIoKSkge1xuICAgICAgICB0aGlzLnVuZXhwZWN0ZWRUb2tlbih0b2tlbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBBbiBpZGVudGlmaWVyIGltbWVkaWF0ZWx5IGZvbGxvd2VkIGJ5IGEgY29tbWEgb3IgdGhlIGVuZCBvZlxuICAgICAgLy8gdGhlIGV4cHJlc3Npb24gY2Fubm90IGhhdmUgcGFyYW1ldGVycyBzbyB3ZSBjYW4gZXhpdCBlYXJseS5cbiAgICAgIGlmICh0aGlzLmlzRm9sbG93ZWRCeU9yTGFzdChjaGFycy4kQ09NTUEpKSB7XG4gICAgICAgIHRoaXMuY29uc3VtZVRyaWdnZXIodG9rZW4sIFtdKTtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNGb2xsb3dlZEJ5T3JMYXN0KGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gQWR2YW5jZSB0byB0aGUgb3BlbmluZyBwYXJlbi5cbiAgICAgICAgY29uc3QgcHJldkVycm9ycyA9IHRoaXMuZXJyb3JzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHRoaXMuY29uc3VtZVBhcmFtZXRlcnMoKTtcbiAgICAgICAgaWYgKHRoaXMuZXJyb3JzLmxlbmd0aCAhPT0gcHJldkVycm9ycykge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY29uc3VtZVRyaWdnZXIodG9rZW4sIHBhcmFtZXRlcnMpO1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIEFkdmFuY2UgcGFzdCB0aGUgY2xvc2luZyBwYXJlbi5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgdGhpcy51bmV4cGVjdGVkVG9rZW4odGhpcy50b2tlbnNbdGhpcy5pbmRleCArIDFdKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhZHZhbmNlKCkge1xuICAgIHRoaXMuaW5kZXgrKztcbiAgfVxuXG4gIHByaXZhdGUgaXNGb2xsb3dlZEJ5T3JMYXN0KGNoYXI6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB0aGlzLnRva2Vucy5sZW5ndGggLSAxKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy50b2tlbnNbdGhpcy5pbmRleCArIDFdLmlzQ2hhcmFjdGVyKGNoYXIpO1xuICB9XG5cbiAgcHJpdmF0ZSB0b2tlbigpOiBUb2tlbiB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5zW01hdGgubWluKHRoaXMuaW5kZXgsIHRoaXMudG9rZW5zLmxlbmd0aCAtIDEpXTtcbiAgfVxuXG4gIHByaXZhdGUgY29uc3VtZVRyaWdnZXIoaWRlbnRpZmllcjogVG9rZW4sIHBhcmFtZXRlcnM6IHN0cmluZ1tdKSB7XG4gICAgY29uc3QgdHJpZ2dlck5hbWVTdGFydFNwYW4gPVxuICAgICAgICB0aGlzLnNwYW4uc3RhcnQubW92ZUJ5KHRoaXMuc3RhcnQgKyBpZGVudGlmaWVyLmluZGV4IC0gdGhpcy50b2tlbnNbMF0uaW5kZXgpO1xuICAgIGNvbnN0IG5hbWVTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgdHJpZ2dlck5hbWVTdGFydFNwYW4sIHRyaWdnZXJOYW1lU3RhcnRTcGFuLm1vdmVCeShpZGVudGlmaWVyLnN0clZhbHVlLmxlbmd0aCkpO1xuICAgIGNvbnN0IGVuZFNwYW4gPSB0cmlnZ2VyTmFtZVN0YXJ0U3Bhbi5tb3ZlQnkodGhpcy50b2tlbigpLmVuZCAtIGlkZW50aWZpZXIuaW5kZXgpO1xuXG4gICAgLy8gUHV0IHRoZSBwcmVmZXRjaCBhbmQgb24gc3BhbnMgd2l0aCB0aGUgZmlyc3QgdHJpZ2dlclxuICAgIC8vIFRoaXMgc2hvdWxkIG1heWJlIGJlIHJlZmFjdG9yZWQgdG8gaGF2ZSBzb21ldGhpbmcgbGlrZSBhbiBvdXRlciBPbkdyb3VwIEFTVFxuICAgIC8vIFNpbmNlIHRyaWdnZXJzIGNhbiBiZSBncm91cGVkIHdpdGggY29tbWFzIFwib24gaG92ZXIoeCksIGludGVyYWN0aW9uKHkpXCJcbiAgICBjb25zdCBpc0ZpcnN0VHJpZ2dlciA9IGlkZW50aWZpZXIuaW5kZXggPT09IDA7XG4gICAgY29uc3Qgb25Tb3VyY2VTcGFuID0gaXNGaXJzdFRyaWdnZXIgPyB0aGlzLm9uU291cmNlU3BhbiA6IG51bGw7XG4gICAgY29uc3QgcHJlZmV0Y2hTb3VyY2VTcGFuID0gaXNGaXJzdFRyaWdnZXIgPyB0aGlzLnByZWZldGNoU3BhbiA6IG51bGw7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9XG4gICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oaXNGaXJzdFRyaWdnZXIgPyB0aGlzLnNwYW4uc3RhcnQgOiB0cmlnZ2VyTmFtZVN0YXJ0U3BhbiwgZW5kU3Bhbik7XG5cbiAgICB0cnkge1xuICAgICAgc3dpdGNoIChpZGVudGlmaWVyLnRvU3RyaW5nKCkpIHtcbiAgICAgICAgY2FzZSBPblRyaWdnZXJUeXBlLklETEU6XG4gICAgICAgICAgdGhpcy50cmFja1RyaWdnZXIoXG4gICAgICAgICAgICAgICdpZGxlJyxcbiAgICAgICAgICAgICAgY3JlYXRlSWRsZVRyaWdnZXIoXG4gICAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzLCBuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTb3VyY2VTcGFuLCBvblNvdXJjZVNwYW4pKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIE9uVHJpZ2dlclR5cGUuVElNRVI6XG4gICAgICAgICAgdGhpcy50cmFja1RyaWdnZXIoXG4gICAgICAgICAgICAgICd0aW1lcicsXG4gICAgICAgICAgICAgIGNyZWF0ZVRpbWVyVHJpZ2dlcihcbiAgICAgICAgICAgICAgICAgIHBhcmFtZXRlcnMsIG5hbWVTcGFuLCBzb3VyY2VTcGFuLCB0aGlzLnByZWZldGNoU3BhbiwgdGhpcy5vblNvdXJjZVNwYW4pKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIE9uVHJpZ2dlclR5cGUuSU5URVJBQ1RJT046XG4gICAgICAgICAgdGhpcy50cmFja1RyaWdnZXIoXG4gICAgICAgICAgICAgICdpbnRlcmFjdGlvbicsXG4gICAgICAgICAgICAgIGNyZWF0ZUludGVyYWN0aW9uVHJpZ2dlcihcbiAgICAgICAgICAgICAgICAgIHBhcmFtZXRlcnMsIG5hbWVTcGFuLCBzb3VyY2VTcGFuLCB0aGlzLnByZWZldGNoU3BhbiwgdGhpcy5vblNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgICAgICB0aGlzLnBsYWNlaG9sZGVyKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBPblRyaWdnZXJUeXBlLklNTUVESUFURTpcbiAgICAgICAgICB0aGlzLnRyYWNrVHJpZ2dlcihcbiAgICAgICAgICAgICAgJ2ltbWVkaWF0ZScsXG4gICAgICAgICAgICAgIGNyZWF0ZUltbWVkaWF0ZVRyaWdnZXIoXG4gICAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzLCBuYW1lU3Bhbiwgc291cmNlU3BhbiwgdGhpcy5wcmVmZXRjaFNwYW4sIHRoaXMub25Tb3VyY2VTcGFuKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBPblRyaWdnZXJUeXBlLkhPVkVSOlxuICAgICAgICAgIHRoaXMudHJhY2tUcmlnZ2VyKFxuICAgICAgICAgICAgICAnaG92ZXInLFxuICAgICAgICAgICAgICBjcmVhdGVIb3ZlclRyaWdnZXIoXG4gICAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzLCBuYW1lU3Bhbiwgc291cmNlU3BhbiwgdGhpcy5wcmVmZXRjaFNwYW4sIHRoaXMub25Tb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgICAgdGhpcy5wbGFjZWhvbGRlcikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5WSUVXUE9SVDpcbiAgICAgICAgICB0aGlzLnRyYWNrVHJpZ2dlcihcbiAgICAgICAgICAgICAgJ3ZpZXdwb3J0JyxcbiAgICAgICAgICAgICAgY3JlYXRlVmlld3BvcnRUcmlnZ2VyKFxuICAgICAgICAgICAgICAgICAgcGFyYW1ldGVycywgbmFtZVNwYW4sIHNvdXJjZVNwYW4sIHRoaXMucHJlZmV0Y2hTcGFuLCB0aGlzLm9uU291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgIHRoaXMucGxhY2Vob2xkZXIpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5yZWNvZ25pemVkIHRyaWdnZXIgdHlwZSBcIiR7aWRlbnRpZmllcn1cImApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuZXJyb3IoaWRlbnRpZmllciwgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY29uc3VtZVBhcmFtZXRlcnMoKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICBpZiAoIXRoaXMudG9rZW4oKS5pc0NoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgdGhpcy51bmV4cGVjdGVkVG9rZW4odGhpcy50b2tlbigpKTtcbiAgICAgIHJldHVybiBwYXJhbWV0ZXJzO1xuICAgIH1cblxuICAgIHRoaXMuYWR2YW5jZSgpO1xuXG4gICAgY29uc3QgY29tbWFEZWxpbVN0YWNrOiBudW1iZXJbXSA9IFtdO1xuICAgIGxldCBjdXJyZW50ID0gJyc7XG5cbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgdG9rZW4gPSB0aGlzLnRva2VuKCk7XG5cbiAgICAgIC8vIFN0b3AgcGFyc2luZyBpZiB3ZSd2ZSBoaXQgdGhlIGVuZCBjaGFyYWN0ZXIgYW5kIHdlJ3JlIG91dHNpZGUgb2YgYSBjb21tYS1kZWxpbWl0ZWQgc3ludGF4LlxuICAgICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IG5lZWQgdG8gYWNjb3VudCBmb3Igc3RyaW5ncyBoZXJlIHNpbmNlIHRoZSBsZXhlciBhbHJlYWR5IHBhcnNlZCB0aGVtXG4gICAgICAvLyBpbnRvIHN0cmluZyB0b2tlbnMuXG4gICAgICBpZiAodG9rZW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikgJiYgY29tbWFEZWxpbVN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAoY3VycmVudC5sZW5ndGgpIHtcbiAgICAgICAgICBwYXJhbWV0ZXJzLnB1c2goY3VycmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIEluIHRoZSBgb25gIG1pY3Jvc3ludGF4IFwidG9wLWxldmVsXCIgY29tbWFzIChlLmcuIG9uZXMgb3V0c2lkZSBvZiBhbiBwYXJhbWV0ZXJzKSBzZXBhcmF0ZVxuICAgICAgLy8gdGhlIGRpZmZlcmVudCB0cmlnZ2VycyAoZS5nLiBgb24gaWRsZSx0aW1lcig1MDApYCkuIFRoaXMgaXMgcHJvYmxlbWF0aWMsIGJlY2F1c2UgdGhlXG4gICAgICAvLyBmdW5jdGlvbi1saWtlIHN5bnRheCBhbHNvIGltcGxpZXMgdGhhdCBtdWx0aXBsZSBwYXJhbWV0ZXJzIGNhbiBiZSBwYXNzZWQgaW50byB0aGVcbiAgICAgIC8vIGluZGl2aWR1YWwgdHJpZ2dlciAoZS5nLiBgb24gZm9vKGEsIGIpYCkuIFRvIGF2b2lkIHRyaXBwaW5nIHVwIHRoZSBwYXJzZXIgd2l0aCBjb21tYXMgdGhhdFxuICAgICAgLy8gYXJlIHBhcnQgb2Ygb3RoZXIgc29ydHMgb2Ygc3ludGF4IChvYmplY3QgbGl0ZXJhbHMsIGFycmF5cyksIHdlIHRyZWF0IGFueXRoaW5nIGluc2lkZVxuICAgICAgLy8gYSBjb21tYS1kZWxpbWl0ZWQgc3ludGF4IGJsb2NrIGFzIHBsYWluIHRleHQuXG4gICAgICBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkNoYXJhY3RlciAmJiBDT01NQV9ERUxJTUlURURfU1lOVEFYLmhhcyh0b2tlbi5udW1WYWx1ZSkpIHtcbiAgICAgICAgY29tbWFEZWxpbVN0YWNrLnB1c2goQ09NTUFfREVMSU1JVEVEX1NZTlRBWC5nZXQodG9rZW4ubnVtVmFsdWUpISk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb21tYURlbGltU3RhY2subGVuZ3RoID4gMCAmJlxuICAgICAgICAgIHRva2VuLmlzQ2hhcmFjdGVyKGNvbW1hRGVsaW1TdGFja1tjb21tYURlbGltU3RhY2subGVuZ3RoIC0gMV0pKSB7XG4gICAgICAgIGNvbW1hRGVsaW1TdGFjay5wb3AoKTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgd2UgaGl0IGEgY29tbWEgb3V0c2lkZSBvZiBhIGNvbW1hLWRlbGltaXRlZCBzeW50YXgsIGl0IG1lYW5zXG4gICAgICAvLyB0aGF0IHdlJ3JlIGF0IHRoZSB0b3AgbGV2ZWwgYW5kIHdlJ3JlIHN0YXJ0aW5nIGEgbmV3IHBhcmFtZXRlci5cbiAgICAgIGlmIChjb21tYURlbGltU3RhY2subGVuZ3RoID09PSAwICYmIHRva2VuLmlzQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSkgJiYgY3VycmVudC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChjdXJyZW50KTtcbiAgICAgICAgY3VycmVudCA9ICcnO1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE90aGVyd2lzZSB0cmVhdCB0aGUgdG9rZW4gYXMgYSBwbGFpbiB0ZXh0IGNoYXJhY3RlciBpbiB0aGUgY3VycmVudCBwYXJhbWV0ZXIuXG4gICAgICBjdXJyZW50ICs9IHRoaXMudG9rZW5UZXh0KCk7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMudG9rZW4oKS5pc0NoYXJhY3RlcihjaGFycy4kUlBBUkVOKSB8fCBjb21tYURlbGltU3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5lcnJvcih0aGlzLnRva2VuKCksICdVbmV4cGVjdGVkIGVuZCBvZiBleHByZXNzaW9uJyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggLSAxICYmXG4gICAgICAgICF0aGlzLnRva2Vuc1t0aGlzLmluZGV4ICsgMV0uaXNDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSkge1xuICAgICAgdGhpcy51bmV4cGVjdGVkVG9rZW4odGhpcy50b2tlbnNbdGhpcy5pbmRleCArIDFdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyYW1ldGVycztcbiAgfVxuXG4gIHByaXZhdGUgdG9rZW5UZXh0KCk6IHN0cmluZyB7XG4gICAgLy8gVG9rZW5zIGhhdmUgYSB0b1N0cmluZyBhbHJlYWR5IHdoaWNoIHdlIGNvdWxkIHVzZSwgYnV0IGZvciBzdHJpbmcgdG9rZW5zIGl0IG9taXRzIHRoZSBxdW90ZXMuXG4gICAgLy8gRXZlbnR1YWxseSB3ZSBjb3VsZCBleHBvc2UgdGhpcyBpbmZvcm1hdGlvbiBvbiB0aGUgdG9rZW4gZGlyZWN0bHkuXG4gICAgcmV0dXJuIHRoaXMuZXhwcmVzc2lvbi5zbGljZSh0aGlzLnN0YXJ0ICsgdGhpcy50b2tlbigpLmluZGV4LCB0aGlzLnN0YXJ0ICsgdGhpcy50b2tlbigpLmVuZCk7XG4gIH1cblxuICBwcml2YXRlIHRyYWNrVHJpZ2dlcihuYW1lOiBrZXlvZiB0LkRlZmVycmVkQmxvY2tUcmlnZ2VycywgdHJpZ2dlcjogdC5EZWZlcnJlZFRyaWdnZXIpOiB2b2lkIHtcbiAgICB0cmFja1RyaWdnZXIobmFtZSwgdGhpcy50cmlnZ2VycywgdGhpcy5lcnJvcnMsIHRyaWdnZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBlcnJvcih0b2tlbjogVG9rZW4sIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IG5ld1N0YXJ0ID0gdGhpcy5zcGFuLnN0YXJ0Lm1vdmVCeSh0aGlzLnN0YXJ0ICsgdG9rZW4uaW5kZXgpO1xuICAgIGNvbnN0IG5ld0VuZCA9IG5ld1N0YXJ0Lm1vdmVCeSh0b2tlbi5lbmQgLSB0b2tlbi5pbmRleCk7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihuZXcgUGFyc2VTb3VyY2VTcGFuKG5ld1N0YXJ0LCBuZXdFbmQpLCBtZXNzYWdlKSk7XG4gIH1cblxuICBwcml2YXRlIHVuZXhwZWN0ZWRUb2tlbih0b2tlbjogVG9rZW4pIHtcbiAgICB0aGlzLmVycm9yKHRva2VuLCBgVW5leHBlY3RlZCB0b2tlbiBcIiR7dG9rZW59XCJgKTtcbiAgfVxufVxuXG4vKiogQWRkcyBhIHRyaWdnZXIgdG8gYSBtYXAgb2YgdHJpZ2dlcnMuICovXG5mdW5jdGlvbiB0cmFja1RyaWdnZXIoXG4gICAgbmFtZToga2V5b2YgdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIGFsbFRyaWdnZXJzOiB0LkRlZmVycmVkQmxvY2tUcmlnZ2VycywgZXJyb3JzOiBQYXJzZUVycm9yW10sXG4gICAgdHJpZ2dlcjogdC5EZWZlcnJlZFRyaWdnZXIpIHtcbiAgaWYgKGFsbFRyaWdnZXJzW25hbWVdKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IodHJpZ2dlci5zb3VyY2VTcGFuLCBgRHVwbGljYXRlIFwiJHtuYW1lfVwiIHRyaWdnZXIgaXMgbm90IGFsbG93ZWRgKSk7XG4gIH0gZWxzZSB7XG4gICAgYWxsVHJpZ2dlcnNbbmFtZV0gPSB0cmlnZ2VyIGFzIGFueTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVJZGxlVHJpZ2dlcihcbiAgICBwYXJhbWV0ZXJzOiBzdHJpbmdbXSxcbiAgICBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBwcmVmZXRjaFNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIG9uU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgKTogdC5JZGxlRGVmZXJyZWRUcmlnZ2VyIHtcbiAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgXCIke09uVHJpZ2dlclR5cGUuSURMRX1cIiB0cmlnZ2VyIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnNgKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgdC5JZGxlRGVmZXJyZWRUcmlnZ2VyKG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBwcmVmZXRjaFNwYW4sIG9uU291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRpbWVyVHJpZ2dlcihcbiAgICBwYXJhbWV0ZXJzOiBzdHJpbmdbXSxcbiAgICBuYW1lU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBwcmVmZXRjaFNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIG9uU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4pIHtcbiAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBcIiR7T25UcmlnZ2VyVHlwZS5USU1FUn1cIiB0cmlnZ2VyIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbWV0ZXJgKTtcbiAgfVxuXG4gIGNvbnN0IGRlbGF5ID0gcGFyc2VEZWZlcnJlZFRpbWUocGFyYW1ldGVyc1swXSk7XG5cbiAgaWYgKGRlbGF5ID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcGFyc2UgdGltZSB2YWx1ZSBvZiB0cmlnZ2VyIFwiJHtPblRyaWdnZXJUeXBlLlRJTUVSfVwiYCk7XG4gIH1cblxuICByZXR1cm4gbmV3IHQuVGltZXJEZWZlcnJlZFRyaWdnZXIoZGVsYXksIG5hbWVTcGFuLCBzb3VyY2VTcGFuLCBwcmVmZXRjaFNwYW4sIG9uU291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUltbWVkaWF0ZVRyaWdnZXIoXG4gICAgcGFyYW1ldGVyczogc3RyaW5nW10sXG4gICAgbmFtZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgcHJlZmV0Y2hTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCxcbiAgICBvblNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgICk6IHQuSW1tZWRpYXRlRGVmZXJyZWRUcmlnZ2VyIHtcbiAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgXCIke09uVHJpZ2dlclR5cGUuSU1NRURJQVRFfVwiIHRyaWdnZXIgY2Fubm90IGhhdmUgcGFyYW1ldGVyc2ApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyB0LkltbWVkaWF0ZURlZmVycmVkVHJpZ2dlcihuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuLCBvblNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3ZlclRyaWdnZXIoXG4gICAgcGFyYW1ldGVyczogc3RyaW5nW10sIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBwcmVmZXRjaFNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBvblNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsKTogdC5Ib3ZlckRlZmVycmVkVHJpZ2dlciB7XG4gIHZhbGlkYXRlUmVmZXJlbmNlQmFzZWRUcmlnZ2VyKE9uVHJpZ2dlclR5cGUuSE9WRVIsIHBhcmFtZXRlcnMsIHBsYWNlaG9sZGVyKTtcbiAgcmV0dXJuIG5ldyB0LkhvdmVyRGVmZXJyZWRUcmlnZ2VyKFxuICAgICAgcGFyYW1ldGVyc1swXSA/PyBudWxsLCBuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuLCBvblNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnRlcmFjdGlvblRyaWdnZXIoXG4gICAgcGFyYW1ldGVyczogc3RyaW5nW10sIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBwcmVmZXRjaFNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBvblNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsKTogdC5JbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlciB7XG4gIHZhbGlkYXRlUmVmZXJlbmNlQmFzZWRUcmlnZ2VyKE9uVHJpZ2dlclR5cGUuSU5URVJBQ1RJT04sIHBhcmFtZXRlcnMsIHBsYWNlaG9sZGVyKTtcbiAgcmV0dXJuIG5ldyB0LkludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyKFxuICAgICAgcGFyYW1ldGVyc1swXSA/PyBudWxsLCBuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuLCBvblNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVWaWV3cG9ydFRyaWdnZXIoXG4gICAgcGFyYW1ldGVyczogc3RyaW5nW10sIG5hbWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBwcmVmZXRjaFNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBvblNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLFxuICAgIHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsKTogdC5WaWV3cG9ydERlZmVycmVkVHJpZ2dlciB7XG4gIHZhbGlkYXRlUmVmZXJlbmNlQmFzZWRUcmlnZ2VyKE9uVHJpZ2dlclR5cGUuVklFV1BPUlQsIHBhcmFtZXRlcnMsIHBsYWNlaG9sZGVyKTtcbiAgcmV0dXJuIG5ldyB0LlZpZXdwb3J0RGVmZXJyZWRUcmlnZ2VyKFxuICAgICAgcGFyYW1ldGVyc1swXSA/PyBudWxsLCBuYW1lU3Bhbiwgc291cmNlU3BhbiwgcHJlZmV0Y2hTcGFuLCBvblNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVJlZmVyZW5jZUJhc2VkVHJpZ2dlcihcbiAgICB0eXBlOiBPblRyaWdnZXJUeXBlLCBwYXJhbWV0ZXJzOiBzdHJpbmdbXSwgcGxhY2Vob2xkZXI6IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwpIHtcbiAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgXCIke3R5cGV9XCIgdHJpZ2dlciBjYW4gb25seSBoYXZlIHplcm8gb3Igb25lIHBhcmFtZXRlcnNgKTtcbiAgfVxuXG4gIGlmIChwYXJhbWV0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGlmIChwbGFjZWhvbGRlciA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBcIiR7XG4gICAgICAgICAgdHlwZX1cIiB0cmlnZ2VyIHdpdGggbm8gcGFyYW1ldGVycyBjYW4gb25seSBiZSBwbGFjZWQgb24gYW4gQGRlZmVyIHRoYXQgaGFzIGEgQHBsYWNlaG9sZGVyIGJsb2NrYCk7XG4gICAgfVxuXG4gICAgaWYgKHBsYWNlaG9sZGVyLmNoaWxkcmVuLmxlbmd0aCAhPT0gMSB8fCAhKHBsYWNlaG9sZGVyLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5FbGVtZW50KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBcIiR7dHlwZX1cIiB0cmlnZ2VyIHdpdGggbm8gcGFyYW1ldGVycyBjYW4gb25seSBiZSBwbGFjZWQgb24gYW4gQGRlZmVyIHRoYXQgaGFzIGEgYCArXG4gICAgICAgICAgYEBwbGFjZWhvbGRlciBibG9jayB3aXRoIGV4YWN0bHkgb25lIHJvb3QgZWxlbWVudCBub2RlYCk7XG4gICAgfVxuICB9XG59XG5cbi8qKiBHZXRzIHRoZSBpbmRleCB3aXRoaW4gYW4gZXhwcmVzc2lvbiBhdCB3aGljaCB0aGUgdHJpZ2dlciBwYXJhbWV0ZXJzIHN0YXJ0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRyaWdnZXJQYXJhbWV0ZXJzU3RhcnQodmFsdWU6IHN0cmluZywgc3RhcnRQb3NpdGlvbiA9IDApOiBudW1iZXIge1xuICBsZXQgaGFzRm91bmRTZXBhcmF0b3IgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gc3RhcnRQb3NpdGlvbjsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFNFUEFSQVRPUl9QQVRURVJOLnRlc3QodmFsdWVbaV0pKSB7XG4gICAgICBoYXNGb3VuZFNlcGFyYXRvciA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChoYXNGb3VuZFNlcGFyYXRvcikge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xO1xufVxuXG4vKipcbiAqIFBhcnNlcyBhIHRpbWUgZXhwcmVzc2lvbiBmcm9tIGEgZGVmZXJyZWQgdHJpZ2dlciB0b1xuICogbWlsbGlzZWNvbmRzLiBSZXR1cm5zIG51bGwgaWYgaXQgY2Fubm90IGJlIHBhcnNlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRGVmZXJyZWRUaW1lKHZhbHVlOiBzdHJpbmcpOiBudW1iZXJ8bnVsbCB7XG4gIGNvbnN0IG1hdGNoID0gdmFsdWUubWF0Y2goVElNRV9QQVRURVJOKTtcblxuICBpZiAoIW1hdGNoKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBbdGltZSwgdW5pdHNdID0gbWF0Y2g7XG4gIHJldHVybiBwYXJzZUludCh0aW1lKSAqICh1bml0cyA9PT0gJ3MnID8gMTAwMCA6IDEpO1xufVxuIl19