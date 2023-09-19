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
    // This is here just to be safe, we shouldn't enter this function
    // in the first place if a block doesn't have the "when" keyword.
    if (whenIndex === -1) {
        errors.push(new ParseError(sourceSpan, `Could not find "when" keyword in expression`));
    }
    else {
        const start = getTriggerParametersStart(expression, whenIndex + 1);
        const parsed = bindingParser.parseBinding(expression.slice(start), false, sourceSpan, sourceSpan.start.offset + start);
        trackTrigger('when', triggers, errors, new t.BoundDeferredTrigger(parsed, sourceSpan));
    }
}
/** Parses an `on` trigger */
export function parseOnTrigger({ expression, sourceSpan }, triggers, errors) {
    const onIndex = expression.indexOf('on');
    // This is here just to be safe, we shouldn't enter this function
    // in the first place if a block doesn't have the "on" keyword.
    if (onIndex === -1) {
        errors.push(new ParseError(sourceSpan, `Could not find "on" keyword in expression`));
    }
    else {
        const start = getTriggerParametersStart(expression, onIndex + 1);
        const parser = new OnTriggerParser(expression, start, sourceSpan, triggers, errors);
        parser.parse();
    }
}
class OnTriggerParser {
    constructor(expression, start, span, triggers, errors) {
        this.expression = expression;
        this.start = start;
        this.span = span;
        this.triggers = triggers;
        this.errors = errors;
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
        const startSpan = this.span.start.moveBy(this.start + identifier.index - this.tokens[0].index);
        const endSpan = startSpan.moveBy(this.token().end - identifier.index);
        const sourceSpan = new ParseSourceSpan(startSpan, endSpan);
        try {
            switch (identifier.toString()) {
                case OnTriggerType.IDLE:
                    this.trackTrigger('idle', createIdleTrigger(parameters, sourceSpan));
                    break;
                case OnTriggerType.TIMER:
                    this.trackTrigger('timer', createTimerTrigger(parameters, sourceSpan));
                    break;
                case OnTriggerType.INTERACTION:
                    this.trackTrigger('interaction', createInteractionTrigger(parameters, sourceSpan));
                    break;
                case OnTriggerType.IMMEDIATE:
                    this.trackTrigger('immediate', createImmediateTrigger(parameters, sourceSpan));
                    break;
                case OnTriggerType.HOVER:
                    this.trackTrigger('hover', createHoverTrigger(parameters, sourceSpan));
                    break;
                case OnTriggerType.VIEWPORT:
                    this.trackTrigger('viewport', createViewportTrigger(parameters, sourceSpan));
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
function createIdleTrigger(parameters, sourceSpan) {
    if (parameters.length > 0) {
        throw new Error(`"${OnTriggerType.IDLE}" trigger cannot have parameters`);
    }
    return new t.IdleDeferredTrigger(sourceSpan);
}
function createTimerTrigger(parameters, sourceSpan) {
    if (parameters.length !== 1) {
        throw new Error(`"${OnTriggerType.TIMER}" trigger must have exactly one parameter`);
    }
    const delay = parseDeferredTime(parameters[0]);
    if (delay === null) {
        throw new Error(`Could not parse time value of trigger "${OnTriggerType.TIMER}"`);
    }
    return new t.TimerDeferredTrigger(delay, sourceSpan);
}
function createInteractionTrigger(parameters, sourceSpan) {
    if (parameters.length !== 1) {
        throw new Error(`"${OnTriggerType.INTERACTION}" trigger must have exactly one parameter`);
    }
    return new t.InteractionDeferredTrigger(parameters[0], sourceSpan);
}
function createImmediateTrigger(parameters, sourceSpan) {
    if (parameters.length > 0) {
        throw new Error(`"${OnTriggerType.IMMEDIATE}" trigger cannot have parameters`);
    }
    return new t.ImmediateDeferredTrigger(sourceSpan);
}
function createHoverTrigger(parameters, sourceSpan) {
    if (parameters.length !== 1) {
        throw new Error(`"${OnTriggerType.HOVER}" trigger must have exactly one parameter`);
    }
    return new t.HoverDeferredTrigger(parameters[0], sourceSpan);
}
function createViewportTrigger(parameters, sourceSpan) {
    // TODO: the RFC has some more potential parameters for `viewport`.
    if (parameters.length > 1) {
        throw new Error(`"${OnTriggerType.VIEWPORT}" trigger can only have zero or one parameters`);
    }
    return new t.ViewportDeferredTrigger(parameters[0] ?? null, sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZGVmZXJyZWRfdHJpZ2dlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19kZWZlcnJlZF90cmlnZ2Vycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsS0FBSyxFQUFTLFNBQVMsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBRW5FLE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRzFELE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVSxDQUFDO0FBRTlCLCtDQUErQztBQUMvQyxNQUFNLFlBQVksR0FBRyxjQUFjLENBQUM7QUFFcEMsd0VBQXdFO0FBQ3hFLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDO0FBRWpDLG9FQUFvRTtBQUNwRSxNQUFNLHNCQUFzQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3JDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDO0lBQzlCLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDO0lBQ2xDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQU8saUJBQWlCO0NBQ3ZELENBQUMsQ0FBQztBQUVILHVDQUF1QztBQUN2QyxJQUFLLGFBT0o7QUFQRCxXQUFLLGFBQWE7SUFDaEIsOEJBQWEsQ0FBQTtJQUNiLGdDQUFlLENBQUE7SUFDZiw0Q0FBMkIsQ0FBQTtJQUMzQix3Q0FBdUIsQ0FBQTtJQUN2QixnQ0FBZSxDQUFBO0lBQ2Ysc0NBQXFCLENBQUE7QUFDdkIsQ0FBQyxFQVBJLGFBQWEsS0FBYixhQUFhLFFBT2pCO0FBRUQsd0NBQXdDO0FBQ3hDLE1BQU0sVUFBVSxnQkFB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QVksQ0FBQyxDQUFDO0lBRXhDLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVixPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUM7SUFDNUIsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi4vY2hhcnMnO1xuaW1wb3J0IHtMZXhlciwgVG9rZW4sIFRva2VuVHlwZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcblxuaW1wb3J0ICogYXMgdCBmcm9tICcuL3IzX2FzdCc7XG5cbi8qKiBQYXR0ZXJuIGZvciBhIHRpbWluZyB2YWx1ZSBpbiBhIHRyaWdnZXIuICovXG5jb25zdCBUSU1FX1BBVFRFUk4gPSAvXlxcZCsobXN8cyk/JC87XG5cbi8qKiBQYXR0ZXJuIGZvciBhIHNlcGFyYXRvciBiZXR3ZWVuIGtleXdvcmRzIGluIGEgdHJpZ2dlciBleHByZXNzaW9uLiAqL1xuY29uc3QgU0VQQVJBVE9SX1BBVFRFUk4gPSAvXlxccyQvO1xuXG4vKiogUGFpcnMgb2YgY2hhcmFjdGVycyB0aGF0IGZvcm0gc3ludGF4IHRoYXQgaXMgY29tbWEtZGVsaW1pdGVkLiAqL1xuY29uc3QgQ09NTUFfREVMSU1JVEVEX1NZTlRBWCA9IG5ldyBNYXAoW1xuICBbY2hhcnMuJExCUkFDRSwgY2hhcnMuJFJCUkFDRV0sICAgICAgLy8gT2JqZWN0IGxpdGVyYWxzXG4gIFtjaGFycy4kTEJSQUNLRVQsIGNoYXJzLiRSQlJBQ0tFVF0sICAvLyBBcnJheSBsaXRlcmFsc1xuICBbY2hhcnMuJExQQVJFTiwgY2hhcnMuJFJQQVJFTl0sICAgICAgLy8gRnVuY3Rpb24gY2FsbHNcbl0pO1xuXG4vKiogUG9zc2libGUgdHlwZXMgb2YgYG9uYCB0cmlnZ2Vycy4gKi9cbmVudW0gT25UcmlnZ2VyVHlwZSB7XG4gIElETEUgPSAnaWRsZScsXG4gIFRJTUVSID0gJ3RpbWVyJyxcbiAgSU5URVJBQ1RJT04gPSAnaW50ZXJhY3Rpb24nLFxuICBJTU1FRElBVEUgPSAnaW1tZWRpYXRlJyxcbiAgSE9WRVIgPSAnaG92ZXInLFxuICBWSUVXUE9SVCA9ICd2aWV3cG9ydCcsXG59XG5cbi8qKiBQYXJzZXMgYSBgd2hlbmAgZGVmZXJyZWQgdHJpZ2dlci4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVdoZW5UcmlnZ2VyKFxuICAgIHtleHByZXNzaW9uLCBzb3VyY2VTcGFufTogaHRtbC5CbG9ja1BhcmFtZXRlciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcixcbiAgICB0cmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIGVycm9yczogUGFyc2VFcnJvcltdKTogdm9pZCB7XG4gIGNvbnN0IHdoZW5JbmRleCA9IGV4cHJlc3Npb24uaW5kZXhPZignd2hlbicpO1xuXG4gIC8vIFRoaXMgaXMgaGVyZSBqdXN0IHRvIGJlIHNhZmUsIHdlIHNob3VsZG4ndCBlbnRlciB0aGlzIGZ1bmN0aW9uXG4gIC8vIGluIHRoZSBmaXJzdCBwbGFjZSBpZiBhIGJsb2NrIGRvZXNuJ3QgaGF2ZSB0aGUgXCJ3aGVuXCIga2V5d29yZC5cbiAgaWYgKHdoZW5JbmRleCA9PT0gLTEpIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBgQ291bGQgbm90IGZpbmQgXCJ3aGVuXCIga2V5d29yZCBpbiBleHByZXNzaW9uYCkpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHN0YXJ0ID0gZ2V0VHJpZ2dlclBhcmFtZXRlcnNTdGFydChleHByZXNzaW9uLCB3aGVuSW5kZXggKyAxKTtcbiAgICBjb25zdCBwYXJzZWQgPSBiaW5kaW5nUGFyc2VyLnBhcnNlQmluZGluZyhcbiAgICAgICAgZXhwcmVzc2lvbi5zbGljZShzdGFydCksIGZhbHNlLCBzb3VyY2VTcGFuLCBzb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCArIHN0YXJ0KTtcbiAgICB0cmFja1RyaWdnZXIoJ3doZW4nLCB0cmlnZ2VycywgZXJyb3JzLCBuZXcgdC5Cb3VuZERlZmVycmVkVHJpZ2dlcihwYXJzZWQsIHNvdXJjZVNwYW4pKTtcbiAgfVxufVxuXG4vKiogUGFyc2VzIGFuIGBvbmAgdHJpZ2dlciAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlT25UcmlnZ2VyKFxuICAgIHtleHByZXNzaW9uLCBzb3VyY2VTcGFufTogaHRtbC5CbG9ja1BhcmFtZXRlciwgdHJpZ2dlcnM6IHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzLFxuICAgIGVycm9yczogUGFyc2VFcnJvcltdKTogdm9pZCB7XG4gIGNvbnN0IG9uSW5kZXggPSBleHByZXNzaW9uLmluZGV4T2YoJ29uJyk7XG5cbiAgLy8gVGhpcyBpcyBoZXJlIGp1c3QgdG8gYmUgc2FmZSwgd2Ugc2hvdWxkbid0IGVudGVyIHRoaXMgZnVuY3Rpb25cbiAgLy8gaW4gdGhlIGZpcnN0IHBsYWNlIGlmIGEgYmxvY2sgZG9lc24ndCBoYXZlIHRoZSBcIm9uXCIga2V5d29yZC5cbiAgaWYgKG9uSW5kZXggPT09IC0xKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Ioc291cmNlU3BhbiwgYENvdWxkIG5vdCBmaW5kIFwib25cIiBrZXl3b3JkIGluIGV4cHJlc3Npb25gKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgc3RhcnQgPSBnZXRUcmlnZ2VyUGFyYW1ldGVyc1N0YXJ0KGV4cHJlc3Npb24sIG9uSW5kZXggKyAxKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgT25UcmlnZ2VyUGFyc2VyKGV4cHJlc3Npb24sIHN0YXJ0LCBzb3VyY2VTcGFuLCB0cmlnZ2VycywgZXJyb3JzKTtcbiAgICBwYXJzZXIucGFyc2UoKTtcbiAgfVxufVxuXG5cbmNsYXNzIE9uVHJpZ2dlclBhcnNlciB7XG4gIHByaXZhdGUgaW5kZXggPSAwO1xuICBwcml2YXRlIHRva2VuczogVG9rZW5bXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgZXhwcmVzc2lvbjogc3RyaW5nLCBwcml2YXRlIHN0YXJ0OiBudW1iZXIsIHByaXZhdGUgc3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgcHJpdmF0ZSB0cmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIHByaXZhdGUgZXJyb3JzOiBQYXJzZUVycm9yW10pIHtcbiAgICB0aGlzLnRva2VucyA9IG5ldyBMZXhlcigpLnRva2VuaXplKGV4cHJlc3Npb24uc2xpY2Uoc3RhcnQpKTtcbiAgfVxuXG4gIHBhcnNlKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLnRva2Vucy5sZW5ndGggPiAwICYmIHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHRva2VuID0gdGhpcy50b2tlbigpO1xuXG4gICAgICBpZiAoIXRva2VuLmlzSWRlbnRpZmllcigpKSB7XG4gICAgICAgIHRoaXMudW5leHBlY3RlZFRva2VuKHRva2VuKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIEFuIGlkZW50aWZpZXIgaW1tZWRpYXRlbHkgZm9sbG93ZWQgYnkgYSBjb21tYSBvciB0aGUgZW5kIG9mXG4gICAgICAvLyB0aGUgZXhwcmVzc2lvbiBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzIHNvIHdlIGNhbiBleGl0IGVhcmx5LlxuICAgICAgaWYgKHRoaXMuaXNGb2xsb3dlZEJ5T3JMYXN0KGNoYXJzLiRDT01NQSkpIHtcbiAgICAgICAgdGhpcy5jb25zdW1lVHJpZ2dlcih0b2tlbiwgW10pO1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0ZvbGxvd2VkQnlPckxhc3QoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBBZHZhbmNlIHRvIHRoZSBvcGVuaW5nIHBhcmVuLlxuICAgICAgICBjb25zdCBwcmV2RXJyb3JzID0gdGhpcy5lcnJvcnMubGVuZ3RoO1xuICAgICAgICBjb25zdCBwYXJhbWV0ZXJzID0gdGhpcy5jb25zdW1lUGFyYW1ldGVycygpO1xuICAgICAgICBpZiAodGhpcy5lcnJvcnMubGVuZ3RoICE9PSBwcmV2RXJyb3JzKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb25zdW1lVHJpZ2dlcih0b2tlbiwgcGFyYW1ldGVycyk7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gQWR2YW5jZSBwYXN0IHRoZSBjbG9zaW5nIHBhcmVuLlxuICAgICAgfSBlbHNlIGlmICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoIC0gMSkge1xuICAgICAgICB0aGlzLnVuZXhwZWN0ZWRUb2tlbih0aGlzLnRva2Vuc1t0aGlzLmluZGV4ICsgMV0pO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFkdmFuY2UoKSB7XG4gICAgdGhpcy5pbmRleCsrO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0ZvbGxvd2VkQnlPckxhc3QoY2hhcjogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHRoaXMudG9rZW5zLmxlbmd0aCAtIDEpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnRva2Vuc1t0aGlzLmluZGV4ICsgMV0uaXNDaGFyYWN0ZXIoY2hhcik7XG4gIH1cblxuICBwcml2YXRlIHRva2VuKCk6IFRva2VuIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbnNbTWF0aC5taW4odGhpcy5pbmRleCwgdGhpcy50b2tlbnMubGVuZ3RoIC0gMSldO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdW1lVHJpZ2dlcihpZGVudGlmaWVyOiBUb2tlbiwgcGFyYW1ldGVyczogc3RyaW5nW10pIHtcbiAgICBjb25zdCBzdGFydFNwYW4gPSB0aGlzLnNwYW4uc3RhcnQubW92ZUJ5KHRoaXMuc3RhcnQgKyBpZGVudGlmaWVyLmluZGV4IC0gdGhpcy50b2tlbnNbMF0uaW5kZXgpO1xuICAgIGNvbnN0IGVuZFNwYW4gPSBzdGFydFNwYW4ubW92ZUJ5KHRoaXMudG9rZW4oKS5lbmQgLSBpZGVudGlmaWVyLmluZGV4KTtcbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydFNwYW4sIGVuZFNwYW4pO1xuXG4gICAgdHJ5IHtcbiAgICAgIHN3aXRjaCAoaWRlbnRpZmllci50b1N0cmluZygpKSB7XG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5JRExFOlxuICAgICAgICAgIHRoaXMudHJhY2tUcmlnZ2VyKCdpZGxlJywgY3JlYXRlSWRsZVRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5USU1FUjpcbiAgICAgICAgICB0aGlzLnRyYWNrVHJpZ2dlcigndGltZXInLCBjcmVhdGVUaW1lclRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5JTlRFUkFDVElPTjpcbiAgICAgICAgICB0aGlzLnRyYWNrVHJpZ2dlcignaW50ZXJhY3Rpb24nLCBjcmVhdGVJbnRlcmFjdGlvblRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5JTU1FRElBVEU6XG4gICAgICAgICAgdGhpcy50cmFja1RyaWdnZXIoJ2ltbWVkaWF0ZScsIGNyZWF0ZUltbWVkaWF0ZVRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5IT1ZFUjpcbiAgICAgICAgICB0aGlzLnRyYWNrVHJpZ2dlcignaG92ZXInLCBjcmVhdGVIb3ZlclRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5WSUVXUE9SVDpcbiAgICAgICAgICB0aGlzLnRyYWNrVHJpZ2dlcigndmlld3BvcnQnLCBjcmVhdGVWaWV3cG9ydFRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgdHJpZ2dlciB0eXBlIFwiJHtpZGVudGlmaWVyfVwiYCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5lcnJvcihpZGVudGlmaWVyLCAoZSBhcyBFcnJvcikubWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjb25zdW1lUGFyYW1ldGVycygpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgcGFyYW1ldGVyczogc3RyaW5nW10gPSBbXTtcblxuICAgIGlmICghdGhpcy50b2tlbigpLmlzQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICB0aGlzLnVuZXhwZWN0ZWRUb2tlbih0aGlzLnRva2VuKCkpO1xuICAgICAgcmV0dXJuIHBhcmFtZXRlcnM7XG4gICAgfVxuXG4gICAgdGhpcy5hZHZhbmNlKCk7XG5cbiAgICBjb25zdCBjb21tYURlbGltU3RhY2s6IG51bWJlcltdID0gW107XG4gICAgbGV0IGN1cnJlbnQgPSAnJztcblxuICAgIHdoaWxlICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICBjb25zdCB0b2tlbiA9IHRoaXMudG9rZW4oKTtcblxuICAgICAgLy8gU3RvcCBwYXJzaW5nIGlmIHdlJ3ZlIGhpdCB0aGUgZW5kIGNoYXJhY3RlciBhbmQgd2UncmUgb3V0c2lkZSBvZiBhIGNvbW1hLWRlbGltaXRlZCBzeW50YXguXG4gICAgICAvLyBOb3RlIHRoYXQgd2UgZG9uJ3QgbmVlZCB0byBhY2NvdW50IGZvciBzdHJpbmdzIGhlcmUgc2luY2UgdGhlIGxleGVyIGFscmVhZHkgcGFyc2VkIHRoZW1cbiAgICAgIC8vIGludG8gc3RyaW5nIHRva2Vucy5cbiAgICAgIGlmICh0b2tlbi5pc0NoYXJhY3RlcihjaGFycy4kUlBBUkVOKSAmJiBjb21tYURlbGltU3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmIChjdXJyZW50Lmxlbmd0aCkge1xuICAgICAgICAgIHBhcmFtZXRlcnMucHVzaChjdXJyZW50KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gSW4gdGhlIGBvbmAgbWljcm9zeW50YXggXCJ0b3AtbGV2ZWxcIiBjb21tYXMgKGUuZy4gb25lcyBvdXRzaWRlIG9mIGFuIHBhcmFtZXRlcnMpIHNlcGFyYXRlXG4gICAgICAvLyB0aGUgZGlmZmVyZW50IHRyaWdnZXJzIChlLmcuIGBvbiBpZGxlLHRpbWVyKDUwMClgKS4gVGhpcyBpcyBwcm9ibGVtYXRpYywgYmVjYXVzZSB0aGVcbiAgICAgIC8vIGZ1bmN0aW9uLWxpa2Ugc3ludGF4IGFsc28gaW1wbGllcyB0aGF0IG11bHRpcGxlIHBhcmFtZXRlcnMgY2FuIGJlIHBhc3NlZCBpbnRvIHRoZVxuICAgICAgLy8gaW5kaXZpZHVhbCB0cmlnZ2VyIChlLmcuIGBvbiBmb28oYSwgYilgKS4gVG8gYXZvaWQgdHJpcHBpbmcgdXAgdGhlIHBhcnNlciB3aXRoIGNvbW1hcyB0aGF0XG4gICAgICAvLyBhcmUgcGFydCBvZiBvdGhlciBzb3J0cyBvZiBzeW50YXggKG9iamVjdCBsaXRlcmFscywgYXJyYXlzKSwgd2UgdHJlYXQgYW55dGhpbmcgaW5zaWRlXG4gICAgICAvLyBhIGNvbW1hLWRlbGltaXRlZCBzeW50YXggYmxvY2sgYXMgcGxhaW4gdGV4dC5cbiAgICAgIGlmICh0b2tlbi50eXBlID09PSBUb2tlblR5cGUuQ2hhcmFjdGVyICYmIENPTU1BX0RFTElNSVRFRF9TWU5UQVguaGFzKHRva2VuLm51bVZhbHVlKSkge1xuICAgICAgICBjb21tYURlbGltU3RhY2sucHVzaChDT01NQV9ERUxJTUlURURfU1lOVEFYLmdldCh0b2tlbi5udW1WYWx1ZSkhKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbW1hRGVsaW1TdGFjay5sZW5ndGggPiAwICYmXG4gICAgICAgICAgdG9rZW4uaXNDaGFyYWN0ZXIoY29tbWFEZWxpbVN0YWNrW2NvbW1hRGVsaW1TdGFjay5sZW5ndGggLSAxXSkpIHtcbiAgICAgICAgY29tbWFEZWxpbVN0YWNrLnBvcCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB3ZSBoaXQgYSBjb21tYSBvdXRzaWRlIG9mIGEgY29tbWEtZGVsaW1pdGVkIHN5bnRheCwgaXQgbWVhbnNcbiAgICAgIC8vIHRoYXQgd2UncmUgYXQgdGhlIHRvcCBsZXZlbCBhbmQgd2UncmUgc3RhcnRpbmcgYSBuZXcgcGFyYW1ldGVyLlxuICAgICAgaWYgKGNvbW1hRGVsaW1TdGFjay5sZW5ndGggPT09IDAgJiYgdG9rZW4uaXNDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSAmJiBjdXJyZW50Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKGN1cnJlbnQpO1xuICAgICAgICBjdXJyZW50ID0gJyc7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gT3RoZXJ3aXNlIHRyZWF0IHRoZSB0b2tlbiBhcyBhIHBsYWluIHRleHQgY2hhcmFjdGVyIGluIHRoZSBjdXJyZW50IHBhcmFtZXRlci5cbiAgICAgIGN1cnJlbnQgKz0gdGhpcy50b2tlblRleHQoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy50b2tlbigpLmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pIHx8IGNvbW1hRGVsaW1TdGFjay5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmVycm9yKHRoaXMudG9rZW4oKSwgJ1VuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb24nKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCAtIDEgJiZcbiAgICAgICAgIXRoaXMudG9rZW5zW3RoaXMuaW5kZXggKyAxXS5pc0NoYXJhY3RlcihjaGFycy4kQ09NTUEpKSB7XG4gICAgICB0aGlzLnVuZXhwZWN0ZWRUb2tlbih0aGlzLnRva2Vuc1t0aGlzLmluZGV4ICsgMV0pO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJhbWV0ZXJzO1xuICB9XG5cbiAgcHJpdmF0ZSB0b2tlblRleHQoKTogc3RyaW5nIHtcbiAgICAvLyBUb2tlbnMgaGF2ZSBhIHRvU3RyaW5nIGFscmVhZHkgd2hpY2ggd2UgY291bGQgdXNlLCBidXQgZm9yIHN0cmluZyB0b2tlbnMgaXQgb21pdHMgdGhlIHF1b3Rlcy5cbiAgICAvLyBFdmVudHVhbGx5IHdlIGNvdWxkIGV4cG9zZSB0aGlzIGluZm9ybWF0aW9uIG9uIHRoZSB0b2tlbiBkaXJlY3RseS5cbiAgICByZXR1cm4gdGhpcy5leHByZXNzaW9uLnNsaWNlKHRoaXMuc3RhcnQgKyB0aGlzLnRva2VuKCkuaW5kZXgsIHRoaXMuc3RhcnQgKyB0aGlzLnRva2VuKCkuZW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgdHJhY2tUcmlnZ2VyKG5hbWU6IGtleW9mIHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCB0cmlnZ2VyOiB0LkRlZmVycmVkVHJpZ2dlcik6IHZvaWQge1xuICAgIHRyYWNrVHJpZ2dlcihuYW1lLCB0aGlzLnRyaWdnZXJzLCB0aGlzLmVycm9ycywgdHJpZ2dlcik7XG4gIH1cblxuICBwcml2YXRlIGVycm9yKHRva2VuOiBUb2tlbiwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgbmV3U3RhcnQgPSB0aGlzLnNwYW4uc3RhcnQubW92ZUJ5KHRoaXMuc3RhcnQgKyB0b2tlbi5pbmRleCk7XG4gICAgY29uc3QgbmV3RW5kID0gbmV3U3RhcnQubW92ZUJ5KHRva2VuLmVuZCAtIHRva2VuLmluZGV4KTtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKG5ldyBQYXJzZVNvdXJjZVNwYW4obmV3U3RhcnQsIG5ld0VuZCksIG1lc3NhZ2UpKTtcbiAgfVxuXG4gIHByaXZhdGUgdW5leHBlY3RlZFRva2VuKHRva2VuOiBUb2tlbikge1xuICAgIHRoaXMuZXJyb3IodG9rZW4sIGBVbmV4cGVjdGVkIHRva2VuIFwiJHt0b2tlbn1cImApO1xuICB9XG59XG5cbi8qKiBBZGRzIGEgdHJpZ2dlciB0byBhIG1hcCBvZiB0cmlnZ2Vycy4gKi9cbmZ1bmN0aW9uIHRyYWNrVHJpZ2dlcihcbiAgICBuYW1lOiBrZXlvZiB0LkRlZmVycmVkQmxvY2tUcmlnZ2VycywgYWxsVHJpZ2dlcnM6IHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCBlcnJvcnM6IFBhcnNlRXJyb3JbXSxcbiAgICB0cmlnZ2VyOiB0LkRlZmVycmVkVHJpZ2dlcikge1xuICBpZiAoYWxsVHJpZ2dlcnNbbmFtZV0pIHtcbiAgICBlcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcih0cmlnZ2VyLnNvdXJjZVNwYW4sIGBEdXBsaWNhdGUgXCIke25hbWV9XCIgdHJpZ2dlciBpcyBub3QgYWxsb3dlZGApKTtcbiAgfSBlbHNlIHtcbiAgICBhbGxUcmlnZ2Vyc1tuYW1lXSA9IHRyaWdnZXIgYXMgYW55O1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUlkbGVUcmlnZ2VyKFxuICAgIHBhcmFtZXRlcnM6IHN0cmluZ1tdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiB0LklkbGVEZWZlcnJlZFRyaWdnZXIge1xuICBpZiAocGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBcIiR7T25UcmlnZ2VyVHlwZS5JRExFfVwiIHRyaWdnZXIgY2Fubm90IGhhdmUgcGFyYW1ldGVyc2ApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyB0LklkbGVEZWZlcnJlZFRyaWdnZXIoc291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRpbWVyVHJpZ2dlcihwYXJhbWV0ZXJzOiBzdHJpbmdbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gIGlmIChwYXJhbWV0ZXJzLmxlbmd0aCAhPT0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgXCIke09uVHJpZ2dlclR5cGUuVElNRVJ9XCIgdHJpZ2dlciBtdXN0IGhhdmUgZXhhY3RseSBvbmUgcGFyYW1ldGVyYCk7XG4gIH1cblxuICBjb25zdCBkZWxheSA9IHBhcnNlRGVmZXJyZWRUaW1lKHBhcmFtZXRlcnNbMF0pO1xuXG4gIGlmIChkZWxheSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHBhcnNlIHRpbWUgdmFsdWUgb2YgdHJpZ2dlciBcIiR7T25UcmlnZ2VyVHlwZS5USU1FUn1cImApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyB0LlRpbWVyRGVmZXJyZWRUcmlnZ2VyKGRlbGF5LCBzb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW50ZXJhY3Rpb25UcmlnZ2VyKFxuICAgIHBhcmFtZXRlcnM6IHN0cmluZ1tdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiB0LkludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyIHtcbiAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBcIiR7T25UcmlnZ2VyVHlwZS5JTlRFUkFDVElPTn1cIiB0cmlnZ2VyIG11c3QgaGF2ZSBleGFjdGx5IG9uZSBwYXJhbWV0ZXJgKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgdC5JbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlcihwYXJhbWV0ZXJzWzBdLCBzb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW1tZWRpYXRlVHJpZ2dlcihcbiAgICBwYXJhbWV0ZXJzOiBzdHJpbmdbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogdC5JbW1lZGlhdGVEZWZlcnJlZFRyaWdnZXIge1xuICBpZiAocGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBcIiR7T25UcmlnZ2VyVHlwZS5JTU1FRElBVEV9XCIgdHJpZ2dlciBjYW5ub3QgaGF2ZSBwYXJhbWV0ZXJzYCk7XG4gIH1cblxuICByZXR1cm4gbmV3IHQuSW1tZWRpYXRlRGVmZXJyZWRUcmlnZ2VyKHNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3ZlclRyaWdnZXIoXG4gICAgcGFyYW1ldGVyczogc3RyaW5nW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IHQuSG92ZXJEZWZlcnJlZFRyaWdnZXIge1xuICBpZiAocGFyYW1ldGVycy5sZW5ndGggIT09IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFwiJHtPblRyaWdnZXJUeXBlLkhPVkVSfVwiIHRyaWdnZXIgbXVzdCBoYXZlIGV4YWN0bHkgb25lIHBhcmFtZXRlcmApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyB0LkhvdmVyRGVmZXJyZWRUcmlnZ2VyKHBhcmFtZXRlcnNbMF0sIHNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVWaWV3cG9ydFRyaWdnZXIoXG4gICAgcGFyYW1ldGVyczogc3RyaW5nW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IHQuVmlld3BvcnREZWZlcnJlZFRyaWdnZXIge1xuICAvLyBUT0RPOiB0aGUgUkZDIGhhcyBzb21lIG1vcmUgcG90ZW50aWFsIHBhcmFtZXRlcnMgZm9yIGB2aWV3cG9ydGAuXG4gIGlmIChwYXJhbWV0ZXJzLmxlbmd0aCA+IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFwiJHtPblRyaWdnZXJUeXBlLlZJRVdQT1JUfVwiIHRyaWdnZXIgY2FuIG9ubHkgaGF2ZSB6ZXJvIG9yIG9uZSBwYXJhbWV0ZXJzYCk7XG4gIH1cblxuICByZXR1cm4gbmV3IHQuVmlld3BvcnREZWZlcnJlZFRyaWdnZXIocGFyYW1ldGVyc1swXSA/PyBudWxsLCBzb3VyY2VTcGFuKTtcbn1cblxuLyoqIEdldHMgdGhlIGluZGV4IHdpdGhpbiBhbiBleHByZXNzaW9uIGF0IHdoaWNoIHRoZSB0cmlnZ2VyIHBhcmFtZXRlcnMgc3RhcnQuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHJpZ2dlclBhcmFtZXRlcnNTdGFydCh2YWx1ZTogc3RyaW5nLCBzdGFydFBvc2l0aW9uID0gMCk6IG51bWJlciB7XG4gIGxldCBoYXNGb3VuZFNlcGFyYXRvciA9IGZhbHNlO1xuXG4gIGZvciAobGV0IGkgPSBzdGFydFBvc2l0aW9uOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoU0VQQVJBVE9SX1BBVFRFUk4udGVzdCh2YWx1ZVtpXSkpIHtcbiAgICAgIGhhc0ZvdW5kU2VwYXJhdG9yID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGhhc0ZvdW5kU2VwYXJhdG9yKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gLTE7XG59XG5cbi8qKlxuICogUGFyc2VzIGEgdGltZSBleHByZXNzaW9uIGZyb20gYSBkZWZlcnJlZCB0cmlnZ2VyIHRvXG4gKiBtaWxsaXNlY29uZHMuIFJldHVybnMgbnVsbCBpZiBpdCBjYW5ub3QgYmUgcGFyc2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VEZWZlcnJlZFRpbWUodmFsdWU6IHN0cmluZyk6IG51bWJlcnxudWxsIHtcbiAgY29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaChUSU1FX1BBVFRFUk4pO1xuXG4gIGlmICghbWF0Y2gpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IFt0aW1lLCB1bml0c10gPSBtYXRjaDtcbiAgcmV0dXJuIHBhcnNlSW50KHRpbWUpICogKHVuaXRzID09PSAncycgPyAxMDAwIDogMSk7XG59XG4iXX0=