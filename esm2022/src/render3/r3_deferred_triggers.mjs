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
export function parseOnTrigger({ expression, sourceSpan }, triggers, errors, placeholder) {
    const onIndex = expression.indexOf('on');
    // This is here just to be safe, we shouldn't enter this function
    // in the first place if a block doesn't have the "on" keyword.
    if (onIndex === -1) {
        errors.push(new ParseError(sourceSpan, `Could not find "on" keyword in expression`));
    }
    else {
        const start = getTriggerParametersStart(expression, onIndex + 1);
        const parser = new OnTriggerParser(expression, start, sourceSpan, triggers, errors, placeholder);
        parser.parse();
    }
}
class OnTriggerParser {
    constructor(expression, start, span, triggers, errors, placeholder) {
        this.expression = expression;
        this.start = start;
        this.span = span;
        this.triggers = triggers;
        this.errors = errors;
        this.placeholder = placeholder;
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
                    this.trackTrigger('interaction', createInteractionTrigger(parameters, sourceSpan, this.placeholder));
                    break;
                case OnTriggerType.IMMEDIATE:
                    this.trackTrigger('immediate', createImmediateTrigger(parameters, sourceSpan));
                    break;
                case OnTriggerType.HOVER:
                    this.trackTrigger('hover', createHoverTrigger(parameters, sourceSpan, this.placeholder));
                    break;
                case OnTriggerType.VIEWPORT:
                    this.trackTrigger('viewport', createViewportTrigger(parameters, sourceSpan, this.placeholder));
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
function createImmediateTrigger(parameters, sourceSpan) {
    if (parameters.length > 0) {
        throw new Error(`"${OnTriggerType.IMMEDIATE}" trigger cannot have parameters`);
    }
    return new t.ImmediateDeferredTrigger(sourceSpan);
}
function createHoverTrigger(parameters, sourceSpan, placeholder) {
    validateReferenceBasedTrigger(OnTriggerType.HOVER, parameters, placeholder);
    return new t.HoverDeferredTrigger(parameters[0] ?? null, sourceSpan);
}
function createInteractionTrigger(parameters, sourceSpan, placeholder) {
    validateReferenceBasedTrigger(OnTriggerType.INTERACTION, parameters, placeholder);
    return new t.InteractionDeferredTrigger(parameters[0] ?? null, sourceSpan);
}
function createViewportTrigger(parameters, sourceSpan, placeholder) {
    validateReferenceBasedTrigger(OnTriggerType.VIEWPORT, parameters, placeholder);
    return new t.ViewportDeferredTrigger(parameters[0] ?? null, sourceSpan);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfZGVmZXJyZWRfdHJpZ2dlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19kZWZlcnJlZF90cmlnZ2Vycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsS0FBSyxFQUFTLFNBQVMsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBRW5FLE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRzFELE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVSxDQUFDO0FBRTlCLCtDQUErQztBQUMvQyxNQUFNLFlBQVksR0FBRyxjQUFjLENBQUM7QUFFcEMsd0VBQXdFO0FBQ3hFLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDO0FBRWpDLG9FQUFvRTtBQUNwRSxNQUFNLHNCQUFzQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3JDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDO0lBQzlCLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDO0lBQ2xDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQU8saUJBQWlCO0NBQ3ZELENBQUMsQ0FBQztBQUVILHVDQUF1QztBQUN2QyxJQUFLLGFBT0o7QUFQRCxXQUFLLGFBQWE7SUFDaEIsOEJBQWEsQ0FBQTtJQUNiLGdDQUFlLENBQUE7SUFDZiw0Q0FBMkIsQ0FBQTtJQUMzQix3Q0FBdUIsQ0FBQTtJQUN2QixnQ0FBZSxDQUFBO0lBQ2Ysc0NBQXFCLENBQUE7QUFDdkIsQ0FBQyxFQVBJLGFBQWEsS0FBYixhQUFhLFFBT2pCO0FBRUQsd0NBQXdDO0FBQ3hDLE1BQU0sVUFBVSxnQkFB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WCxJQUFJLElBQUksMEVBQTBFO2dCQUNsRix1REFBdUQsQ0FBQyxDQUFDO1NBQzlEO0tBQ0Y7QUFDSCxDQUFDO0FBRUQsaUZBQWlGO0FBQ2pGLE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxLQUFhLEVBQUUsYUFBYSxHQUFHLENBQUM7SUFDeEUsSUFBSSxpQkFBaUIsR0FBRyxLQUFLLENBQUM7SUFFOUIsS0FBSyxJQUFJLENBQUMsR0FBRyxhQUFhLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDakQsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDcEMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1NBQzFCO2FBQU0sSUFBSSxpQkFBaUIsRUFBRTtZQUM1QixPQUFPLENBQUMsQ0FBQztTQUNWO0tBQ0Y7SUFFRCxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ1osQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxLQUFhO0lBQzdDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7SUFFeEMsSUFBSSxDQUFDLEtBQUssRUFBRTtRQUNWLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxNQUFNLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQztJQUM1QixPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGFycyBmcm9tICcuLi9jaGFycyc7XG5pbXBvcnQge0xleGVyLCBUb2tlbiwgVG9rZW5UeXBlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcblxuLyoqIFBhdHRlcm4gZm9yIGEgdGltaW5nIHZhbHVlIGluIGEgdHJpZ2dlci4gKi9cbmNvbnN0IFRJTUVfUEFUVEVSTiA9IC9eXFxkKyhtc3xzKT8kLztcblxuLyoqIFBhdHRlcm4gZm9yIGEgc2VwYXJhdG9yIGJldHdlZW4ga2V5d29yZHMgaW4gYSB0cmlnZ2VyIGV4cHJlc3Npb24uICovXG5jb25zdCBTRVBBUkFUT1JfUEFUVEVSTiA9IC9eXFxzJC87XG5cbi8qKiBQYWlycyBvZiBjaGFyYWN0ZXJzIHRoYXQgZm9ybSBzeW50YXggdGhhdCBpcyBjb21tYS1kZWxpbWl0ZWQuICovXG5jb25zdCBDT01NQV9ERUxJTUlURURfU1lOVEFYID0gbmV3IE1hcChbXG4gIFtjaGFycy4kTEJSQUNFLCBjaGFycy4kUkJSQUNFXSwgICAgICAvLyBPYmplY3QgbGl0ZXJhbHNcbiAgW2NoYXJzLiRMQlJBQ0tFVCwgY2hhcnMuJFJCUkFDS0VUXSwgIC8vIEFycmF5IGxpdGVyYWxzXG4gIFtjaGFycy4kTFBBUkVOLCBjaGFycy4kUlBBUkVOXSwgICAgICAvLyBGdW5jdGlvbiBjYWxsc1xuXSk7XG5cbi8qKiBQb3NzaWJsZSB0eXBlcyBvZiBgb25gIHRyaWdnZXJzLiAqL1xuZW51bSBPblRyaWdnZXJUeXBlIHtcbiAgSURMRSA9ICdpZGxlJyxcbiAgVElNRVIgPSAndGltZXInLFxuICBJTlRFUkFDVElPTiA9ICdpbnRlcmFjdGlvbicsXG4gIElNTUVESUFURSA9ICdpbW1lZGlhdGUnLFxuICBIT1ZFUiA9ICdob3ZlcicsXG4gIFZJRVdQT1JUID0gJ3ZpZXdwb3J0Jyxcbn1cblxuLyoqIFBhcnNlcyBhIGB3aGVuYCBkZWZlcnJlZCB0cmlnZ2VyLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlV2hlblRyaWdnZXIoXG4gICAge2V4cHJlc3Npb24sIHNvdXJjZVNwYW59OiBodG1sLkJsb2NrUGFyYW1ldGVyLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLFxuICAgIHRyaWdnZXJzOiB0LkRlZmVycmVkQmxvY2tUcmlnZ2VycywgZXJyb3JzOiBQYXJzZUVycm9yW10pOiB2b2lkIHtcbiAgY29uc3Qgd2hlbkluZGV4ID0gZXhwcmVzc2lvbi5pbmRleE9mKCd3aGVuJyk7XG5cbiAgLy8gVGhpcyBpcyBoZXJlIGp1c3QgdG8gYmUgc2FmZSwgd2Ugc2hvdWxkbid0IGVudGVyIHRoaXMgZnVuY3Rpb25cbiAgLy8gaW4gdGhlIGZpcnN0IHBsYWNlIGlmIGEgYmxvY2sgZG9lc24ndCBoYXZlIHRoZSBcIndoZW5cIiBrZXl3b3JkLlxuICBpZiAod2hlbkluZGV4ID09PSAtMSkge1xuICAgIGVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIGBDb3VsZCBub3QgZmluZCBcIndoZW5cIiBrZXl3b3JkIGluIGV4cHJlc3Npb25gKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgc3RhcnQgPSBnZXRUcmlnZ2VyUGFyYW1ldGVyc1N0YXJ0KGV4cHJlc3Npb24sIHdoZW5JbmRleCArIDEpO1xuICAgIGNvbnN0IHBhcnNlZCA9IGJpbmRpbmdQYXJzZXIucGFyc2VCaW5kaW5nKFxuICAgICAgICBleHByZXNzaW9uLnNsaWNlKHN0YXJ0KSwgZmFsc2UsIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4uc3RhcnQub2Zmc2V0ICsgc3RhcnQpO1xuICAgIHRyYWNrVHJpZ2dlcignd2hlbicsIHRyaWdnZXJzLCBlcnJvcnMsIG5ldyB0LkJvdW5kRGVmZXJyZWRUcmlnZ2VyKHBhcnNlZCwgc291cmNlU3BhbikpO1xuICB9XG59XG5cbi8qKiBQYXJzZXMgYW4gYG9uYCB0cmlnZ2VyICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VPblRyaWdnZXIoXG4gICAge2V4cHJlc3Npb24sIHNvdXJjZVNwYW59OiBodG1sLkJsb2NrUGFyYW1ldGVyLCB0cmlnZ2VyczogdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMsXG4gICAgZXJyb3JzOiBQYXJzZUVycm9yW10sIHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsKTogdm9pZCB7XG4gIGNvbnN0IG9uSW5kZXggPSBleHByZXNzaW9uLmluZGV4T2YoJ29uJyk7XG5cbiAgLy8gVGhpcyBpcyBoZXJlIGp1c3QgdG8gYmUgc2FmZSwgd2Ugc2hvdWxkbid0IGVudGVyIHRoaXMgZnVuY3Rpb25cbiAgLy8gaW4gdGhlIGZpcnN0IHBsYWNlIGlmIGEgYmxvY2sgZG9lc24ndCBoYXZlIHRoZSBcIm9uXCIga2V5d29yZC5cbiAgaWYgKG9uSW5kZXggPT09IC0xKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3Ioc291cmNlU3BhbiwgYENvdWxkIG5vdCBmaW5kIFwib25cIiBrZXl3b3JkIGluIGV4cHJlc3Npb25gKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgc3RhcnQgPSBnZXRUcmlnZ2VyUGFyYW1ldGVyc1N0YXJ0KGV4cHJlc3Npb24sIG9uSW5kZXggKyAxKTtcbiAgICBjb25zdCBwYXJzZXIgPVxuICAgICAgICBuZXcgT25UcmlnZ2VyUGFyc2VyKGV4cHJlc3Npb24sIHN0YXJ0LCBzb3VyY2VTcGFuLCB0cmlnZ2VycywgZXJyb3JzLCBwbGFjZWhvbGRlcik7XG4gICAgcGFyc2VyLnBhcnNlKCk7XG4gIH1cbn1cblxuXG5jbGFzcyBPblRyaWdnZXJQYXJzZXIge1xuICBwcml2YXRlIGluZGV4ID0gMDtcbiAgcHJpdmF0ZSB0b2tlbnM6IFRva2VuW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGV4cHJlc3Npb246IHN0cmluZywgcHJpdmF0ZSBzdGFydDogbnVtYmVyLCBwcml2YXRlIHNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHByaXZhdGUgdHJpZ2dlcnM6IHQuRGVmZXJyZWRCbG9ja1RyaWdnZXJzLCBwcml2YXRlIGVycm9yczogUGFyc2VFcnJvcltdLFxuICAgICAgcHJpdmF0ZSBwbGFjZWhvbGRlcjogdC5EZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXJ8bnVsbCkge1xuICAgIHRoaXMudG9rZW5zID0gbmV3IExleGVyKCkudG9rZW5pemUoZXhwcmVzc2lvbi5zbGljZShzdGFydCkpO1xuICB9XG5cbiAgcGFyc2UoKTogdm9pZCB7XG4gICAgd2hpbGUgKHRoaXMudG9rZW5zLmxlbmd0aCA+IDAgJiYgdGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgdG9rZW4gPSB0aGlzLnRva2VuKCk7XG5cbiAgICAgIGlmICghdG9rZW4uaXNJZGVudGlmaWVyKCkpIHtcbiAgICAgICAgdGhpcy51bmV4cGVjdGVkVG9rZW4odG9rZW4pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gQW4gaWRlbnRpZmllciBpbW1lZGlhdGVseSBmb2xsb3dlZCBieSBhIGNvbW1hIG9yIHRoZSBlbmQgb2ZcbiAgICAgIC8vIHRoZSBleHByZXNzaW9uIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnMgc28gd2UgY2FuIGV4aXQgZWFybHkuXG4gICAgICBpZiAodGhpcy5pc0ZvbGxvd2VkQnlPckxhc3QoY2hhcnMuJENPTU1BKSkge1xuICAgICAgICB0aGlzLmNvbnN1bWVUcmlnZ2VyKHRva2VuLCBbXSk7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzRm9sbG93ZWRCeU9yTGFzdChjaGFycy4kTFBBUkVOKSkge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIEFkdmFuY2UgdG8gdGhlIG9wZW5pbmcgcGFyZW4uXG4gICAgICAgIGNvbnN0IHByZXZFcnJvcnMgPSB0aGlzLmVycm9ycy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHBhcmFtZXRlcnMgPSB0aGlzLmNvbnN1bWVQYXJhbWV0ZXJzKCk7XG4gICAgICAgIGlmICh0aGlzLmVycm9ycy5sZW5ndGggIT09IHByZXZFcnJvcnMpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbnN1bWVUcmlnZ2VyKHRva2VuLCBwYXJhbWV0ZXJzKTtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBBZHZhbmNlIHBhc3QgdGhlIGNsb3NpbmcgcGFyZW4uXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggLSAxKSB7XG4gICAgICAgIHRoaXMudW5leHBlY3RlZFRva2VuKHRoaXMudG9rZW5zW3RoaXMuaW5kZXggKyAxXSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWR2YW5jZSgpIHtcbiAgICB0aGlzLmluZGV4Kys7XG4gIH1cblxuICBwcml2YXRlIGlzRm9sbG93ZWRCeU9yTGFzdChjaGFyOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdGhpcy50b2tlbnMubGVuZ3RoIC0gMSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMuaW5kZXggKyAxXS5pc0NoYXJhY3RlcihjaGFyKTtcbiAgfVxuXG4gIHByaXZhdGUgdG9rZW4oKTogVG9rZW4ge1xuICAgIHJldHVybiB0aGlzLnRva2Vuc1tNYXRoLm1pbih0aGlzLmluZGV4LCB0aGlzLnRva2Vucy5sZW5ndGggLSAxKV07XG4gIH1cblxuICBwcml2YXRlIGNvbnN1bWVUcmlnZ2VyKGlkZW50aWZpZXI6IFRva2VuLCBwYXJhbWV0ZXJzOiBzdHJpbmdbXSkge1xuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IHRoaXMuc3Bhbi5zdGFydC5tb3ZlQnkodGhpcy5zdGFydCArIGlkZW50aWZpZXIuaW5kZXggLSB0aGlzLnRva2Vuc1swXS5pbmRleCk7XG4gICAgY29uc3QgZW5kU3BhbiA9IHN0YXJ0U3Bhbi5tb3ZlQnkodGhpcy50b2tlbigpLmVuZCAtIGlkZW50aWZpZXIuaW5kZXgpO1xuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0U3BhbiwgZW5kU3Bhbik7XG5cbiAgICB0cnkge1xuICAgICAgc3dpdGNoIChpZGVudGlmaWVyLnRvU3RyaW5nKCkpIHtcbiAgICAgICAgY2FzZSBPblRyaWdnZXJUeXBlLklETEU6XG4gICAgICAgICAgdGhpcy50cmFja1RyaWdnZXIoJ2lkbGUnLCBjcmVhdGVJZGxlVHJpZ2dlcihwYXJhbWV0ZXJzLCBzb3VyY2VTcGFuKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBPblRyaWdnZXJUeXBlLlRJTUVSOlxuICAgICAgICAgIHRoaXMudHJhY2tUcmlnZ2VyKCd0aW1lcicsIGNyZWF0ZVRpbWVyVHJpZ2dlcihwYXJhbWV0ZXJzLCBzb3VyY2VTcGFuKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBPblRyaWdnZXJUeXBlLklOVEVSQUNUSU9OOlxuICAgICAgICAgIHRoaXMudHJhY2tUcmlnZ2VyKFxuICAgICAgICAgICAgICAnaW50ZXJhY3Rpb24nLCBjcmVhdGVJbnRlcmFjdGlvblRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbiwgdGhpcy5wbGFjZWhvbGRlcikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5JTU1FRElBVEU6XG4gICAgICAgICAgdGhpcy50cmFja1RyaWdnZXIoJ2ltbWVkaWF0ZScsIGNyZWF0ZUltbWVkaWF0ZVRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5IT1ZFUjpcbiAgICAgICAgICB0aGlzLnRyYWNrVHJpZ2dlcignaG92ZXInLCBjcmVhdGVIb3ZlclRyaWdnZXIocGFyYW1ldGVycywgc291cmNlU3BhbiwgdGhpcy5wbGFjZWhvbGRlcikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgT25UcmlnZ2VyVHlwZS5WSUVXUE9SVDpcbiAgICAgICAgICB0aGlzLnRyYWNrVHJpZ2dlcihcbiAgICAgICAgICAgICAgJ3ZpZXdwb3J0JywgY3JlYXRlVmlld3BvcnRUcmlnZ2VyKHBhcmFtZXRlcnMsIHNvdXJjZVNwYW4sIHRoaXMucGxhY2Vob2xkZXIpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5yZWNvZ25pemVkIHRyaWdnZXIgdHlwZSBcIiR7aWRlbnRpZmllcn1cImApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuZXJyb3IoaWRlbnRpZmllciwgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY29uc3VtZVBhcmFtZXRlcnMoKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICBpZiAoIXRoaXMudG9rZW4oKS5pc0NoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgdGhpcy51bmV4cGVjdGVkVG9rZW4odGhpcy50b2tlbigpKTtcbiAgICAgIHJldHVybiBwYXJhbWV0ZXJzO1xuICAgIH1cblxuICAgIHRoaXMuYWR2YW5jZSgpO1xuXG4gICAgY29uc3QgY29tbWFEZWxpbVN0YWNrOiBudW1iZXJbXSA9IFtdO1xuICAgIGxldCBjdXJyZW50ID0gJyc7XG5cbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgdG9rZW4gPSB0aGlzLnRva2VuKCk7XG5cbiAgICAgIC8vIFN0b3AgcGFyc2luZyBpZiB3ZSd2ZSBoaXQgdGhlIGVuZCBjaGFyYWN0ZXIgYW5kIHdlJ3JlIG91dHNpZGUgb2YgYSBjb21tYS1kZWxpbWl0ZWQgc3ludGF4LlxuICAgICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IG5lZWQgdG8gYWNjb3VudCBmb3Igc3RyaW5ncyBoZXJlIHNpbmNlIHRoZSBsZXhlciBhbHJlYWR5IHBhcnNlZCB0aGVtXG4gICAgICAvLyBpbnRvIHN0cmluZyB0b2tlbnMuXG4gICAgICBpZiAodG9rZW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikgJiYgY29tbWFEZWxpbVN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAoY3VycmVudC5sZW5ndGgpIHtcbiAgICAgICAgICBwYXJhbWV0ZXJzLnB1c2goY3VycmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIEluIHRoZSBgb25gIG1pY3Jvc3ludGF4IFwidG9wLWxldmVsXCIgY29tbWFzIChlLmcuIG9uZXMgb3V0c2lkZSBvZiBhbiBwYXJhbWV0ZXJzKSBzZXBhcmF0ZVxuICAgICAgLy8gdGhlIGRpZmZlcmVudCB0cmlnZ2VycyAoZS5nLiBgb24gaWRsZSx0aW1lcig1MDApYCkuIFRoaXMgaXMgcHJvYmxlbWF0aWMsIGJlY2F1c2UgdGhlXG4gICAgICAvLyBmdW5jdGlvbi1saWtlIHN5bnRheCBhbHNvIGltcGxpZXMgdGhhdCBtdWx0aXBsZSBwYXJhbWV0ZXJzIGNhbiBiZSBwYXNzZWQgaW50byB0aGVcbiAgICAgIC8vIGluZGl2aWR1YWwgdHJpZ2dlciAoZS5nLiBgb24gZm9vKGEsIGIpYCkuIFRvIGF2b2lkIHRyaXBwaW5nIHVwIHRoZSBwYXJzZXIgd2l0aCBjb21tYXMgdGhhdFxuICAgICAgLy8gYXJlIHBhcnQgb2Ygb3RoZXIgc29ydHMgb2Ygc3ludGF4IChvYmplY3QgbGl0ZXJhbHMsIGFycmF5cyksIHdlIHRyZWF0IGFueXRoaW5nIGluc2lkZVxuICAgICAgLy8gYSBjb21tYS1kZWxpbWl0ZWQgc3ludGF4IGJsb2NrIGFzIHBsYWluIHRleHQuXG4gICAgICBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkNoYXJhY3RlciAmJiBDT01NQV9ERUxJTUlURURfU1lOVEFYLmhhcyh0b2tlbi5udW1WYWx1ZSkpIHtcbiAgICAgICAgY29tbWFEZWxpbVN0YWNrLnB1c2goQ09NTUFfREVMSU1JVEVEX1NZTlRBWC5nZXQodG9rZW4ubnVtVmFsdWUpISk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb21tYURlbGltU3RhY2subGVuZ3RoID4gMCAmJlxuICAgICAgICAgIHRva2VuLmlzQ2hhcmFjdGVyKGNvbW1hRGVsaW1TdGFja1tjb21tYURlbGltU3RhY2subGVuZ3RoIC0gMV0pKSB7XG4gICAgICAgIGNvbW1hRGVsaW1TdGFjay5wb3AoKTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgd2UgaGl0IGEgY29tbWEgb3V0c2lkZSBvZiBhIGNvbW1hLWRlbGltaXRlZCBzeW50YXgsIGl0IG1lYW5zXG4gICAgICAvLyB0aGF0IHdlJ3JlIGF0IHRoZSB0b3AgbGV2ZWwgYW5kIHdlJ3JlIHN0YXJ0aW5nIGEgbmV3IHBhcmFtZXRlci5cbiAgICAgIGlmIChjb21tYURlbGltU3RhY2subGVuZ3RoID09PSAwICYmIHRva2VuLmlzQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSkgJiYgY3VycmVudC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChjdXJyZW50KTtcbiAgICAgICAgY3VycmVudCA9ICcnO1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE90aGVyd2lzZSB0cmVhdCB0aGUgdG9rZW4gYXMgYSBwbGFpbiB0ZXh0IGNoYXJhY3RlciBpbiB0aGUgY3VycmVudCBwYXJhbWV0ZXIuXG4gICAgICBjdXJyZW50ICs9IHRoaXMudG9rZW5UZXh0KCk7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMudG9rZW4oKS5pc0NoYXJhY3RlcihjaGFycy4kUlBBUkVOKSB8fCBjb21tYURlbGltU3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5lcnJvcih0aGlzLnRva2VuKCksICdVbmV4cGVjdGVkIGVuZCBvZiBleHByZXNzaW9uJyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggLSAxICYmXG4gICAgICAgICF0aGlzLnRva2Vuc1t0aGlzLmluZGV4ICsgMV0uaXNDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSkge1xuICAgICAgdGhpcy51bmV4cGVjdGVkVG9rZW4odGhpcy50b2tlbnNbdGhpcy5pbmRleCArIDFdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyYW1ldGVycztcbiAgfVxuXG4gIHByaXZhdGUgdG9rZW5UZXh0KCk6IHN0cmluZyB7XG4gICAgLy8gVG9rZW5zIGhhdmUgYSB0b1N0cmluZyBhbHJlYWR5IHdoaWNoIHdlIGNvdWxkIHVzZSwgYnV0IGZvciBzdHJpbmcgdG9rZW5zIGl0IG9taXRzIHRoZSBxdW90ZXMuXG4gICAgLy8gRXZlbnR1YWxseSB3ZSBjb3VsZCBleHBvc2UgdGhpcyBpbmZvcm1hdGlvbiBvbiB0aGUgdG9rZW4gZGlyZWN0bHkuXG4gICAgcmV0dXJuIHRoaXMuZXhwcmVzc2lvbi5zbGljZSh0aGlzLnN0YXJ0ICsgdGhpcy50b2tlbigpLmluZGV4LCB0aGlzLnN0YXJ0ICsgdGhpcy50b2tlbigpLmVuZCk7XG4gIH1cblxuICBwcml2YXRlIHRyYWNrVHJpZ2dlcihuYW1lOiBrZXlvZiB0LkRlZmVycmVkQmxvY2tUcmlnZ2VycywgdHJpZ2dlcjogdC5EZWZlcnJlZFRyaWdnZXIpOiB2b2lkIHtcbiAgICB0cmFja1RyaWdnZXIobmFtZSwgdGhpcy50cmlnZ2VycywgdGhpcy5lcnJvcnMsIHRyaWdnZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBlcnJvcih0b2tlbjogVG9rZW4sIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IG5ld1N0YXJ0ID0gdGhpcy5zcGFuLnN0YXJ0Lm1vdmVCeSh0aGlzLnN0YXJ0ICsgdG9rZW4uaW5kZXgpO1xuICAgIGNvbnN0IG5ld0VuZCA9IG5ld1N0YXJ0Lm1vdmVCeSh0b2tlbi5lbmQgLSB0b2tlbi5pbmRleCk7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihuZXcgUGFyc2VTb3VyY2VTcGFuKG5ld1N0YXJ0LCBuZXdFbmQpLCBtZXNzYWdlKSk7XG4gIH1cblxuICBwcml2YXRlIHVuZXhwZWN0ZWRUb2tlbih0b2tlbjogVG9rZW4pIHtcbiAgICB0aGlzLmVycm9yKHRva2VuLCBgVW5leHBlY3RlZCB0b2tlbiBcIiR7dG9rZW59XCJgKTtcbiAgfVxufVxuXG4vKiogQWRkcyBhIHRyaWdnZXIgdG8gYSBtYXAgb2YgdHJpZ2dlcnMuICovXG5mdW5jdGlvbiB0cmFja1RyaWdnZXIoXG4gICAgbmFtZToga2V5b2YgdC5EZWZlcnJlZEJsb2NrVHJpZ2dlcnMsIGFsbFRyaWdnZXJzOiB0LkRlZmVycmVkQmxvY2tUcmlnZ2VycywgZXJyb3JzOiBQYXJzZUVycm9yW10sXG4gICAgdHJpZ2dlcjogdC5EZWZlcnJlZFRyaWdnZXIpIHtcbiAgaWYgKGFsbFRyaWdnZXJzW25hbWVdKSB7XG4gICAgZXJyb3JzLnB1c2gobmV3IFBhcnNlRXJyb3IodHJpZ2dlci5zb3VyY2VTcGFuLCBgRHVwbGljYXRlIFwiJHtuYW1lfVwiIHRyaWdnZXIgaXMgbm90IGFsbG93ZWRgKSk7XG4gIH0gZWxzZSB7XG4gICAgYWxsVHJpZ2dlcnNbbmFtZV0gPSB0cmlnZ2VyIGFzIGFueTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVJZGxlVHJpZ2dlcihcbiAgICBwYXJhbWV0ZXJzOiBzdHJpbmdbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogdC5JZGxlRGVmZXJyZWRUcmlnZ2VyIHtcbiAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgXCIke09uVHJpZ2dlclR5cGUuSURMRX1cIiB0cmlnZ2VyIGNhbm5vdCBoYXZlIHBhcmFtZXRlcnNgKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgdC5JZGxlRGVmZXJyZWRUcmlnZ2VyKHNvdXJjZVNwYW4pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVUaW1lclRyaWdnZXIocGFyYW1ldGVyczogc3RyaW5nW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICBpZiAocGFyYW1ldGVycy5sZW5ndGggIT09IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFwiJHtPblRyaWdnZXJUeXBlLlRJTUVSfVwiIHRyaWdnZXIgbXVzdCBoYXZlIGV4YWN0bHkgb25lIHBhcmFtZXRlcmApO1xuICB9XG5cbiAgY29uc3QgZGVsYXkgPSBwYXJzZURlZmVycmVkVGltZShwYXJhbWV0ZXJzWzBdKTtcblxuICBpZiAoZGVsYXkgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBwYXJzZSB0aW1lIHZhbHVlIG9mIHRyaWdnZXIgXCIke09uVHJpZ2dlclR5cGUuVElNRVJ9XCJgKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgdC5UaW1lckRlZmVycmVkVHJpZ2dlcihkZWxheSwgc291cmNlU3Bhbik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUltbWVkaWF0ZVRyaWdnZXIoXG4gICAgcGFyYW1ldGVyczogc3RyaW5nW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IHQuSW1tZWRpYXRlRGVmZXJyZWRUcmlnZ2VyIHtcbiAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgXCIke09uVHJpZ2dlclR5cGUuSU1NRURJQVRFfVwiIHRyaWdnZXIgY2Fubm90IGhhdmUgcGFyYW1ldGVyc2ApO1xuICB9XG5cbiAgcmV0dXJuIG5ldyB0LkltbWVkaWF0ZURlZmVycmVkVHJpZ2dlcihzb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG92ZXJUcmlnZ2VyKFxuICAgIHBhcmFtZXRlcnM6IHN0cmluZ1tdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgcGxhY2Vob2xkZXI6IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwpOiB0LkhvdmVyRGVmZXJyZWRUcmlnZ2VyIHtcbiAgdmFsaWRhdGVSZWZlcmVuY2VCYXNlZFRyaWdnZXIoT25UcmlnZ2VyVHlwZS5IT1ZFUiwgcGFyYW1ldGVycywgcGxhY2Vob2xkZXIpO1xuICByZXR1cm4gbmV3IHQuSG92ZXJEZWZlcnJlZFRyaWdnZXIocGFyYW1ldGVyc1swXSA/PyBudWxsLCBzb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW50ZXJhY3Rpb25UcmlnZ2VyKFxuICAgIHBhcmFtZXRlcnM6IHN0cmluZ1tdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgcGxhY2Vob2xkZXI6IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwpOiB0LkludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyIHtcbiAgdmFsaWRhdGVSZWZlcmVuY2VCYXNlZFRyaWdnZXIoT25UcmlnZ2VyVHlwZS5JTlRFUkFDVElPTiwgcGFyYW1ldGVycywgcGxhY2Vob2xkZXIpO1xuICByZXR1cm4gbmV3IHQuSW50ZXJhY3Rpb25EZWZlcnJlZFRyaWdnZXIocGFyYW1ldGVyc1swXSA/PyBudWxsLCBzb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVmlld3BvcnRUcmlnZ2VyKFxuICAgIHBhcmFtZXRlcnM6IHN0cmluZ1tdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgcGxhY2Vob2xkZXI6IHQuRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyfG51bGwpOiB0LlZpZXdwb3J0RGVmZXJyZWRUcmlnZ2VyIHtcbiAgdmFsaWRhdGVSZWZlcmVuY2VCYXNlZFRyaWdnZXIoT25UcmlnZ2VyVHlwZS5WSUVXUE9SVCwgcGFyYW1ldGVycywgcGxhY2Vob2xkZXIpO1xuICByZXR1cm4gbmV3IHQuVmlld3BvcnREZWZlcnJlZFRyaWdnZXIocGFyYW1ldGVyc1swXSA/PyBudWxsLCBzb3VyY2VTcGFuKTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVSZWZlcmVuY2VCYXNlZFRyaWdnZXIoXG4gICAgdHlwZTogT25UcmlnZ2VyVHlwZSwgcGFyYW1ldGVyczogc3RyaW5nW10sIHBsYWNlaG9sZGVyOiB0LkRlZmVycmVkQmxvY2tQbGFjZWhvbGRlcnxudWxsKSB7XG4gIGlmIChwYXJhbWV0ZXJzLmxlbmd0aCA+IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFwiJHt0eXBlfVwiIHRyaWdnZXIgY2FuIG9ubHkgaGF2ZSB6ZXJvIG9yIG9uZSBwYXJhbWV0ZXJzYCk7XG4gIH1cblxuICBpZiAocGFyYW1ldGVycy5sZW5ndGggPT09IDApIHtcbiAgICBpZiAocGxhY2Vob2xkZXIgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgXCIke1xuICAgICAgICAgIHR5cGV9XCIgdHJpZ2dlciB3aXRoIG5vIHBhcmFtZXRlcnMgY2FuIG9ubHkgYmUgcGxhY2VkIG9uIGFuIEBkZWZlciB0aGF0IGhhcyBhIEBwbGFjZWhvbGRlciBibG9ja2ApO1xuICAgIH1cblxuICAgIGlmIChwbGFjZWhvbGRlci5jaGlsZHJlbi5sZW5ndGggIT09IDEgfHwgIShwbGFjZWhvbGRlci5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgXCIke3R5cGV9XCIgdHJpZ2dlciB3aXRoIG5vIHBhcmFtZXRlcnMgY2FuIG9ubHkgYmUgcGxhY2VkIG9uIGFuIEBkZWZlciB0aGF0IGhhcyBhIGAgK1xuICAgICAgICAgIGBAcGxhY2Vob2xkZXIgYmxvY2sgd2l0aCBleGFjdGx5IG9uZSByb290IGVsZW1lbnQgbm9kZWApO1xuICAgIH1cbiAgfVxufVxuXG4vKiogR2V0cyB0aGUgaW5kZXggd2l0aGluIGFuIGV4cHJlc3Npb24gYXQgd2hpY2ggdGhlIHRyaWdnZXIgcGFyYW1ldGVycyBzdGFydC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUcmlnZ2VyUGFyYW1ldGVyc1N0YXJ0KHZhbHVlOiBzdHJpbmcsIHN0YXJ0UG9zaXRpb24gPSAwKTogbnVtYmVyIHtcbiAgbGV0IGhhc0ZvdW5kU2VwYXJhdG9yID0gZmFsc2U7XG5cbiAgZm9yIChsZXQgaSA9IHN0YXJ0UG9zaXRpb247IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChTRVBBUkFUT1JfUEFUVEVSTi50ZXN0KHZhbHVlW2ldKSkge1xuICAgICAgaGFzRm91bmRTZXBhcmF0b3IgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaGFzRm91bmRTZXBhcmF0b3IpIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiAtMTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSB0aW1lIGV4cHJlc3Npb24gZnJvbSBhIGRlZmVycmVkIHRyaWdnZXIgdG9cbiAqIG1pbGxpc2Vjb25kcy4gUmV0dXJucyBudWxsIGlmIGl0IGNhbm5vdCBiZSBwYXJzZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZURlZmVycmVkVGltZSh2YWx1ZTogc3RyaW5nKTogbnVtYmVyfG51bGwge1xuICBjb25zdCBtYXRjaCA9IHZhbHVlLm1hdGNoKFRJTUVfUEFUVEVSTik7XG5cbiAgaWYgKCFtYXRjaCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgW3RpbWUsIHVuaXRzXSA9IG1hdGNoO1xuICByZXR1cm4gcGFyc2VJbnQodGltZSkgKiAodW5pdHMgPT09ICdzJyA/IDEwMDAgOiAxKTtcbn1cbiJdfQ==