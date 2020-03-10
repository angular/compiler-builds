/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as chars from '../chars';
import { DEFAULT_INTERPOLATION_CONFIG } from '../ml_parser/interpolation_config';
import { escapeRegExp } from '../util';
import { AST, ASTWithSource, Binary, BindingPipe, Chain, Conditional, EmptyExpr, FunctionCall, ImplicitReceiver, Interpolation, KeyedRead, KeyedWrite, LiteralArray, LiteralMap, LiteralPrimitive, MethodCall, NonNullAssert, ParseSpan, ParserError, PrefixNot, PropertyRead, PropertyWrite, Quote, SafeMethodCall, SafePropertyRead, TemplateBinding } from './ast';
import { EOF, TokenType, isIdentifier, isQuote } from './lexer';
export class SplitInterpolation {
    constructor(strings, expressions, offsets) {
        this.strings = strings;
        this.expressions = expressions;
        this.offsets = offsets;
    }
}
export class TemplateBindingParseResult {
    constructor(templateBindings, warnings, errors) {
        this.templateBindings = templateBindings;
        this.warnings = warnings;
        this.errors = errors;
    }
}
const defaultInterpolateRegExp = _createInterpolateRegExp(DEFAULT_INTERPOLATION_CONFIG);
function _getInterpolateRegExp(config) {
    if (config === DEFAULT_INTERPOLATION_CONFIG) {
        return defaultInterpolateRegExp;
    }
    else {
        return _createInterpolateRegExp(config);
    }
}
function _createInterpolateRegExp(config) {
    const pattern = escapeRegExp(config.start) + '([\\s\\S]*?)' + escapeRegExp(config.end);
    return new RegExp(pattern, 'g');
}
export class Parser {
    constructor(_lexer) {
        this._lexer = _lexer;
        this.errors = [];
        this.simpleExpressionChecker = SimpleExpressionChecker;
    }
    parseAction(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        this._checkNoInterpolation(input, location, interpolationConfig);
        const sourceToLex = this._stripComments(input);
        const tokens = this._lexer.tokenize(this._stripComments(input));
        const ast = new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, true, this.errors, input.length - sourceToLex.length)
            .parseChain();
        return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
    }
    parseBinding(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        const ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
        return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
    }
    checkSimpleExpression(ast) {
        const checker = new this.simpleExpressionChecker();
        ast.visit(checker);
        return checker.errors;
    }
    parseSimpleBinding(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        const ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
        const errors = this.checkSimpleExpression(ast);
        if (errors.length > 0) {
            this._reportError(`Host binding expression cannot contain ${errors.join(' ')}`, input, location);
        }
        return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
    }
    _reportError(message, input, errLocation, ctxLocation) {
        this.errors.push(new ParserError(message, input, errLocation, ctxLocation));
    }
    _parseBindingAst(input, location, absoluteOffset, interpolationConfig) {
        // Quotes expressions use 3rd-party expression language. We don't want to use
        // our lexer or parser for that, so we check for that ahead of time.
        const quote = this._parseQuote(input, location, absoluteOffset);
        if (quote != null) {
            return quote;
        }
        this._checkNoInterpolation(input, location, interpolationConfig);
        const sourceToLex = this._stripComments(input);
        const tokens = this._lexer.tokenize(sourceToLex);
        return new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, false, this.errors, input.length - sourceToLex.length)
            .parseChain();
    }
    _parseQuote(input, location, absoluteOffset) {
        if (input == null)
            return null;
        const prefixSeparatorIndex = input.indexOf(':');
        if (prefixSeparatorIndex == -1)
            return null;
        const prefix = input.substring(0, prefixSeparatorIndex).trim();
        if (!isIdentifier(prefix))
            return null;
        const uninterpretedExpression = input.substring(prefixSeparatorIndex + 1);
        const span = new ParseSpan(0, input.length);
        return new Quote(span, span.toAbsolute(absoluteOffset), prefix, uninterpretedExpression, location);
    }
    /**
     * Parse microsyntax template expression and return a list of bindings or
     * parsing errors in case the given expression is invalid.
     *
     * For example,
     * ```
     *   <div *ngFor="let item of items">
     *                ^ `absoluteOffset` for `tplValue`
     * ```
     * contains three bindings:
     * 1. ngFor -> null
     * 2. item -> NgForOfContext.$implicit
     * 3. ngForOf -> items
     *
     * This is apparent from the de-sugared template:
     * ```
     *   <ng-template ngFor let-item [ngForOf]="items">
     * ```
     *
     * @param templateKey name of directive, without the * prefix. For example: ngIf, ngFor
     * @param templateValue RHS of the microsyntax attribute
     * @param templateUrl template filename if it's external, component filename if it's inline
     * @param absoluteOffset absolute offset of the `tplValue`
     */
    parseTemplateBindings(templateKey, templateValue, templateUrl, absoluteOffset) {
        const tokens = this._lexer.tokenize(templateValue);
        return new _ParseAST(templateValue, templateUrl, absoluteOffset, tokens, templateValue.length, false /* parseAction */, this.errors, 0 /* relative offset */)
            .parseTemplateBindings(templateKey);
    }
    parseInterpolation(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        const split = this.splitInterpolation(input, location, interpolationConfig);
        if (split == null)
            return null;
        const expressions = [];
        for (let i = 0; i < split.expressions.length; ++i) {
            const expressionText = split.expressions[i];
            const sourceToLex = this._stripComments(expressionText);
            const tokens = this._lexer.tokenize(sourceToLex);
            const ast = new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, false, this.errors, split.offsets[i] + (expressionText.length - sourceToLex.length))
                .parseChain();
            expressions.push(ast);
        }
        const span = new ParseSpan(0, input == null ? 0 : input.length);
        return new ASTWithSource(new Interpolation(span, span.toAbsolute(absoluteOffset), split.strings, expressions), input, location, absoluteOffset, this.errors);
    }
    splitInterpolation(input, location, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        const regexp = _getInterpolateRegExp(interpolationConfig);
        const parts = input.split(regexp);
        if (parts.length <= 1) {
            return null;
        }
        const strings = [];
        const expressions = [];
        const offsets = [];
        let offset = 0;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i % 2 === 0) {
                // fixed string
                strings.push(part);
                offset += part.length;
            }
            else if (part.trim().length > 0) {
                offset += interpolationConfig.start.length;
                expressions.push(part);
                offsets.push(offset);
                offset += part.length + interpolationConfig.end.length;
            }
            else {
                this._reportError('Blank expressions are not allowed in interpolated strings', input, `at column ${this._findInterpolationErrorColumn(parts, i, interpolationConfig)} in`, location);
                expressions.push('$implicit');
                offsets.push(offset);
            }
        }
        return new SplitInterpolation(strings, expressions, offsets);
    }
    wrapLiteralPrimitive(input, location, absoluteOffset) {
        const span = new ParseSpan(0, input == null ? 0 : input.length);
        return new ASTWithSource(new LiteralPrimitive(span, span.toAbsolute(absoluteOffset), input), input, location, absoluteOffset, this.errors);
    }
    _stripComments(input) {
        const i = this._commentStart(input);
        return i != null ? input.substring(0, i).trim() : input;
    }
    _commentStart(input) {
        let outerQuote = null;
        for (let i = 0; i < input.length - 1; i++) {
            const char = input.charCodeAt(i);
            const nextChar = input.charCodeAt(i + 1);
            if (char === chars.$SLASH && nextChar == chars.$SLASH && outerQuote == null)
                return i;
            if (outerQuote === char) {
                outerQuote = null;
            }
            else if (outerQuote == null && isQuote(char)) {
                outerQuote = char;
            }
        }
        return null;
    }
    _checkNoInterpolation(input, location, interpolationConfig) {
        const regexp = _getInterpolateRegExp(interpolationConfig);
        const parts = input.split(regexp);
        if (parts.length > 1) {
            this._reportError(`Got interpolation (${interpolationConfig.start}${interpolationConfig.end}) where expression was expected`, input, `at column ${this._findInterpolationErrorColumn(parts, 1, interpolationConfig)} in`, location);
        }
    }
    _findInterpolationErrorColumn(parts, partInErrIdx, interpolationConfig) {
        let errLocation = '';
        for (let j = 0; j < partInErrIdx; j++) {
            errLocation += j % 2 === 0 ?
                parts[j] :
                `${interpolationConfig.start}${parts[j]}${interpolationConfig.end}`;
        }
        return errLocation.length;
    }
}
export class IvyParser extends Parser {
    constructor() {
        super(...arguments);
        this.simpleExpressionChecker = IvySimpleExpressionChecker; //
    }
}
export class _ParseAST {
    constructor(input, location, absoluteOffset, tokens, inputLength, parseAction, errors, offset) {
        this.input = input;
        this.location = location;
        this.absoluteOffset = absoluteOffset;
        this.tokens = tokens;
        this.inputLength = inputLength;
        this.parseAction = parseAction;
        this.errors = errors;
        this.offset = offset;
        this.rparensExpected = 0;
        this.rbracketsExpected = 0;
        this.rbracesExpected = 0;
        // Cache of expression start and input indeces to the absolute source span they map to, used to
        // prevent creating superfluous source spans in `sourceSpan`.
        // A serial of the expression start and input index is used for mapping because both are stateful
        // and may change for subsequent expressions visited by the parser.
        this.sourceSpanCache = new Map();
        this.index = 0;
    }
    peek(offset) {
        const i = this.index + offset;
        return i < this.tokens.length ? this.tokens[i] : EOF;
    }
    get next() { return this.peek(0); }
    get inputIndex() {
        return (this.index < this.tokens.length) ? this.next.index + this.offset :
            this.inputLength + this.offset;
    }
    span(start) { return new ParseSpan(start, this.inputIndex); }
    sourceSpan(start) {
        const serial = `${start}@${this.inputIndex}`;
        if (!this.sourceSpanCache.has(serial)) {
            this.sourceSpanCache.set(serial, this.span(start).toAbsolute(this.absoluteOffset));
        }
        return this.sourceSpanCache.get(serial);
    }
    advance() { this.index++; }
    consumeOptionalCharacter(code) {
        if (this.next.isCharacter(code)) {
            this.advance();
            return true;
        }
        else {
            return false;
        }
    }
    peekKeywordLet() { return this.next.isKeywordLet(); }
    peekKeywordAs() { return this.next.isKeywordAs(); }
    expectCharacter(code) {
        if (this.consumeOptionalCharacter(code))
            return;
        this.error(`Missing expected ${String.fromCharCode(code)}`);
    }
    consumeOptionalOperator(op) {
        if (this.next.isOperator(op)) {
            this.advance();
            return true;
        }
        else {
            return false;
        }
    }
    expectOperator(operator) {
        if (this.consumeOptionalOperator(operator))
            return;
        this.error(`Missing expected operator ${operator}`);
    }
    expectIdentifierOrKeyword() {
        const n = this.next;
        if (!n.isIdentifier() && !n.isKeyword()) {
            this.error(`Unexpected token ${n}, expected identifier or keyword`);
            return '';
        }
        this.advance();
        return n.toString();
    }
    expectIdentifierOrKeywordOrString() {
        const n = this.next;
        if (!n.isIdentifier() && !n.isKeyword() && !n.isString()) {
            this.error(`Unexpected token ${n}, expected identifier, keyword, or string`);
            return '';
        }
        this.advance();
        return n.toString();
    }
    parseChain() {
        const exprs = [];
        const start = this.inputIndex;
        while (this.index < this.tokens.length) {
            const expr = this.parsePipe();
            exprs.push(expr);
            if (this.consumeOptionalCharacter(chars.$SEMICOLON)) {
                if (!this.parseAction) {
                    this.error('Binding expression cannot contain chained expression');
                }
                while (this.consumeOptionalCharacter(chars.$SEMICOLON)) {
                } // read all semicolons
            }
            else if (this.index < this.tokens.length) {
                this.error(`Unexpected token '${this.next}'`);
            }
        }
        if (exprs.length == 0)
            return new EmptyExpr(this.span(start), this.sourceSpan(start));
        if (exprs.length == 1)
            return exprs[0];
        return new Chain(this.span(start), this.sourceSpan(start), exprs);
    }
    parsePipe() {
        let result = this.parseExpression();
        if (this.consumeOptionalOperator('|')) {
            if (this.parseAction) {
                this.error('Cannot have a pipe in an action expression');
            }
            do {
                const nameStart = this.inputIndex;
                const name = this.expectIdentifierOrKeyword();
                const nameSpan = this.sourceSpan(nameStart);
                const args = [];
                while (this.consumeOptionalCharacter(chars.$COLON)) {
                    args.push(this.parseExpression());
                }
                const { start } = result.span;
                result =
                    new BindingPipe(this.span(start), this.sourceSpan(start), result, name, args, nameSpan);
            } while (this.consumeOptionalOperator('|'));
        }
        return result;
    }
    parseExpression() { return this.parseConditional(); }
    parseConditional() {
        const start = this.inputIndex;
        const result = this.parseLogicalOr();
        if (this.consumeOptionalOperator('?')) {
            const yes = this.parsePipe();
            let no;
            if (!this.consumeOptionalCharacter(chars.$COLON)) {
                const end = this.inputIndex;
                const expression = this.input.substring(start, end);
                this.error(`Conditional expression ${expression} requires all 3 expressions`);
                no = new EmptyExpr(this.span(start), this.sourceSpan(start));
            }
            else {
                no = this.parsePipe();
            }
            return new Conditional(this.span(start), this.sourceSpan(start), result, yes, no);
        }
        else {
            return result;
        }
    }
    parseLogicalOr() {
        // '||'
        let result = this.parseLogicalAnd();
        while (this.consumeOptionalOperator('||')) {
            const right = this.parseLogicalAnd();
            const { start } = result.span;
            result = new Binary(this.span(start), this.sourceSpan(start), '||', result, right);
        }
        return result;
    }
    parseLogicalAnd() {
        // '&&'
        let result = this.parseEquality();
        while (this.consumeOptionalOperator('&&')) {
            const right = this.parseEquality();
            const { start } = result.span;
            result = new Binary(this.span(start), this.sourceSpan(start), '&&', result, right);
        }
        return result;
    }
    parseEquality() {
        // '==','!=','===','!=='
        let result = this.parseRelational();
        while (this.next.type == TokenType.Operator) {
            const operator = this.next.strValue;
            switch (operator) {
                case '==':
                case '===':
                case '!=':
                case '!==':
                    this.advance();
                    const right = this.parseRelational();
                    const { start } = result.span;
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    }
    parseRelational() {
        // '<', '>', '<=', '>='
        let result = this.parseAdditive();
        while (this.next.type == TokenType.Operator) {
            const operator = this.next.strValue;
            switch (operator) {
                case '<':
                case '>':
                case '<=':
                case '>=':
                    this.advance();
                    const right = this.parseAdditive();
                    const { start } = result.span;
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    }
    parseAdditive() {
        // '+', '-'
        let result = this.parseMultiplicative();
        while (this.next.type == TokenType.Operator) {
            const operator = this.next.strValue;
            switch (operator) {
                case '+':
                case '-':
                    this.advance();
                    let right = this.parseMultiplicative();
                    const { start } = result.span;
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    }
    parseMultiplicative() {
        // '*', '%', '/'
        let result = this.parsePrefix();
        while (this.next.type == TokenType.Operator) {
            const operator = this.next.strValue;
            switch (operator) {
                case '*':
                case '%':
                case '/':
                    this.advance();
                    let right = this.parsePrefix();
                    const { start } = result.span;
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    }
    parsePrefix() {
        if (this.next.type == TokenType.Operator) {
            const start = this.inputIndex;
            const operator = this.next.strValue;
            const literalSpan = new ParseSpan(start, start);
            const literalSourceSpan = literalSpan.toAbsolute(this.absoluteOffset);
            let result;
            switch (operator) {
                case '+':
                    this.advance();
                    result = this.parsePrefix();
                    return new Binary(this.span(start), this.sourceSpan(start), '-', result, new LiteralPrimitive(literalSpan, literalSourceSpan, 0));
                case '-':
                    this.advance();
                    result = this.parsePrefix();
                    return new Binary(this.span(start), this.sourceSpan(start), operator, new LiteralPrimitive(literalSpan, literalSourceSpan, 0), result);
                case '!':
                    this.advance();
                    result = this.parsePrefix();
                    return new PrefixNot(this.span(start), this.sourceSpan(start), result);
            }
        }
        return this.parseCallChain();
    }
    parseCallChain() {
        let result = this.parsePrimary();
        const resultStart = result.span.start;
        while (true) {
            if (this.consumeOptionalCharacter(chars.$PERIOD)) {
                result = this.parseAccessMemberOrMethodCall(result, false);
            }
            else if (this.consumeOptionalOperator('?.')) {
                result = this.parseAccessMemberOrMethodCall(result, true);
            }
            else if (this.consumeOptionalCharacter(chars.$LBRACKET)) {
                this.rbracketsExpected++;
                const key = this.parsePipe();
                this.rbracketsExpected--;
                this.expectCharacter(chars.$RBRACKET);
                if (this.consumeOptionalOperator('=')) {
                    const value = this.parseConditional();
                    result = new KeyedWrite(this.span(resultStart), this.sourceSpan(resultStart), result, key, value);
                }
                else {
                    result = new KeyedRead(this.span(resultStart), this.sourceSpan(resultStart), result, key);
                }
            }
            else if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                this.rparensExpected++;
                const args = this.parseCallArguments();
                this.rparensExpected--;
                this.expectCharacter(chars.$RPAREN);
                result =
                    new FunctionCall(this.span(resultStart), this.sourceSpan(resultStart), result, args);
            }
            else if (this.consumeOptionalOperator('!')) {
                result = new NonNullAssert(this.span(resultStart), this.sourceSpan(resultStart), result);
            }
            else {
                return result;
            }
        }
    }
    parsePrimary() {
        const start = this.inputIndex;
        if (this.consumeOptionalCharacter(chars.$LPAREN)) {
            this.rparensExpected++;
            const result = this.parsePipe();
            this.rparensExpected--;
            this.expectCharacter(chars.$RPAREN);
            return result;
        }
        else if (this.next.isKeywordNull()) {
            this.advance();
            return new LiteralPrimitive(this.span(start), this.sourceSpan(start), null);
        }
        else if (this.next.isKeywordUndefined()) {
            this.advance();
            return new LiteralPrimitive(this.span(start), this.sourceSpan(start), void 0);
        }
        else if (this.next.isKeywordTrue()) {
            this.advance();
            return new LiteralPrimitive(this.span(start), this.sourceSpan(start), true);
        }
        else if (this.next.isKeywordFalse()) {
            this.advance();
            return new LiteralPrimitive(this.span(start), this.sourceSpan(start), false);
        }
        else if (this.next.isKeywordThis()) {
            this.advance();
            return new ImplicitReceiver(this.span(start), this.sourceSpan(start));
        }
        else if (this.consumeOptionalCharacter(chars.$LBRACKET)) {
            this.rbracketsExpected++;
            const elements = this.parseExpressionList(chars.$RBRACKET);
            this.rbracketsExpected--;
            this.expectCharacter(chars.$RBRACKET);
            return new LiteralArray(this.span(start), this.sourceSpan(start), elements);
        }
        else if (this.next.isCharacter(chars.$LBRACE)) {
            return this.parseLiteralMap();
        }
        else if (this.next.isIdentifier()) {
            return this.parseAccessMemberOrMethodCall(new ImplicitReceiver(this.span(start), this.sourceSpan(start)), false);
        }
        else if (this.next.isNumber()) {
            const value = this.next.toNumber();
            this.advance();
            return new LiteralPrimitive(this.span(start), this.sourceSpan(start), value);
        }
        else if (this.next.isString()) {
            const literalValue = this.next.toString();
            this.advance();
            return new LiteralPrimitive(this.span(start), this.sourceSpan(start), literalValue);
        }
        else if (this.index >= this.tokens.length) {
            this.error(`Unexpected end of expression: ${this.input}`);
            return new EmptyExpr(this.span(start), this.sourceSpan(start));
        }
        else {
            this.error(`Unexpected token ${this.next}`);
            return new EmptyExpr(this.span(start), this.sourceSpan(start));
        }
    }
    parseExpressionList(terminator) {
        const result = [];
        if (!this.next.isCharacter(terminator)) {
            do {
                result.push(this.parsePipe());
            } while (this.consumeOptionalCharacter(chars.$COMMA));
        }
        return result;
    }
    parseLiteralMap() {
        const keys = [];
        const values = [];
        const start = this.inputIndex;
        this.expectCharacter(chars.$LBRACE);
        if (!this.consumeOptionalCharacter(chars.$RBRACE)) {
            this.rbracesExpected++;
            do {
                const quoted = this.next.isString();
                const key = this.expectIdentifierOrKeywordOrString();
                keys.push({ key, quoted });
                this.expectCharacter(chars.$COLON);
                values.push(this.parsePipe());
            } while (this.consumeOptionalCharacter(chars.$COMMA));
            this.rbracesExpected--;
            this.expectCharacter(chars.$RBRACE);
        }
        return new LiteralMap(this.span(start), this.sourceSpan(start), keys, values);
    }
    parseAccessMemberOrMethodCall(receiver, isSafe = false) {
        const start = receiver.span.start;
        const id = this.expectIdentifierOrKeyword();
        if (this.consumeOptionalCharacter(chars.$LPAREN)) {
            this.rparensExpected++;
            const args = this.parseCallArguments();
            this.expectCharacter(chars.$RPAREN);
            this.rparensExpected--;
            const span = this.span(start);
            const sourceSpan = this.sourceSpan(start);
            return isSafe ? new SafeMethodCall(span, sourceSpan, receiver, id, args) :
                new MethodCall(span, sourceSpan, receiver, id, args);
        }
        else {
            if (isSafe) {
                if (this.consumeOptionalOperator('=')) {
                    this.error('The \'?.\' operator cannot be used in the assignment');
                    return new EmptyExpr(this.span(start), this.sourceSpan(start));
                }
                else {
                    return new SafePropertyRead(this.span(start), this.sourceSpan(start), receiver, id);
                }
            }
            else {
                if (this.consumeOptionalOperator('=')) {
                    if (!this.parseAction) {
                        this.error('Bindings cannot contain assignments');
                        return new EmptyExpr(this.span(start), this.sourceSpan(start));
                    }
                    const value = this.parseConditional();
                    return new PropertyWrite(this.span(start), this.sourceSpan(start), receiver, id, value);
                }
                else {
                    const span = this.span(start);
                    return new PropertyRead(this.span(start), this.sourceSpan(start), receiver, id);
                }
            }
        }
    }
    parseCallArguments() {
        if (this.next.isCharacter(chars.$RPAREN))
            return [];
        const positionals = [];
        do {
            positionals.push(this.parsePipe());
        } while (this.consumeOptionalCharacter(chars.$COMMA));
        return positionals;
    }
    /**
     * Parses an identifier, a keyword, a string with an optional `-` in between.
     */
    expectTemplateBindingKey() {
        let result = '';
        let operatorFound = false;
        const start = this.inputIndex;
        do {
            result += this.expectIdentifierOrKeywordOrString();
            operatorFound = this.consumeOptionalOperator('-');
            if (operatorFound) {
                result += '-';
            }
        } while (operatorFound);
        return {
            key: result,
            keySpan: new ParseSpan(start, start + result.length),
        };
    }
    /**
     * Parse microsyntax template expression and return a list of bindings or
     * parsing errors in case the given expression is invalid.
     *
     * For example,
     * ```
     *   <div *ngFor="let item of items; index as i; trackBy: func">
     * ```
     * contains five bindings:
     * 1. ngFor -> null
     * 2. item -> NgForOfContext.$implicit
     * 3. ngForOf -> items
     * 4. i -> NgForOfContext.index
     * 5. ngForTrackBy -> func
     *
     * For a full description of the microsyntax grammar, see
     * https://gist.github.com/mhevery/d3530294cff2e4a1b3fe15ff75d08855
     *
     * @param templateKey name of the microsyntax directive, like ngIf, ngFor, without the *
     */
    parseTemplateBindings(templateKey) {
        const bindings = [];
        // The first binding is for the template key itself
        // In *ngFor="let item of items", key = "ngFor", value = null
        // In *ngIf="cond | pipe", key = "ngIf", value = "cond | pipe"
        bindings.push(...this.parseDirectiveKeywordBindings(templateKey, new ParseSpan(0, templateKey.length), this.absoluteOffset));
        while (this.index < this.tokens.length) {
            // If it starts with 'let', then this must be variable declaration
            const letBinding = this.parseLetBinding();
            if (letBinding) {
                bindings.push(letBinding);
            }
            else {
                // Two possible cases here, either `value "as" key` or
                // "directive-keyword expression". We don't know which case, but both
                // "value" and "directive-keyword" are template binding key, so consume
                // the key first.
                const { key, keySpan } = this.expectTemplateBindingKey();
                // Peek at the next token, if it is "as" then this must be variable
                // declaration.
                const binding = this.parseAsBinding(key, keySpan, this.absoluteOffset);
                if (binding) {
                    bindings.push(binding);
                }
                else {
                    // Otherwise the key must be a directive keyword, like "of". Transform
                    // the key to actual key. Eg. of -> ngForOf, trackBy -> ngForTrackBy
                    const actualKey = templateKey + key[0].toUpperCase() + key.substring(1);
                    bindings.push(...this.parseDirectiveKeywordBindings(actualKey, keySpan, this.absoluteOffset));
                }
            }
            this.consumeStatementTerminator();
        }
        return new TemplateBindingParseResult(bindings, [] /* warnings */, this.errors);
    }
    /**
     * Parse a directive keyword, followed by a mandatory expression.
     * For example, "of items", "trackBy: func".
     * The bindings are: ngForOf -> items, ngForTrackBy -> func
     * There could be an optional "as" binding that follows the expression.
     * For example,
     * ```
     * *ngFor="let item of items | slice:0:1 as collection".`
     *                  ^^ ^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^
     *             keyword    bound target   optional 'as' binding
     * ```
     *
     * @param key binding key, for example, ngFor, ngIf, ngForOf
     * @param keySpan span of the key in the expression. keySpan might be different
     * from `key.length`. For example, the span for key "ngForOf" is "of".
     * @param absoluteOffset absolute offset of the attribute value
     */
    parseDirectiveKeywordBindings(key, keySpan, absoluteOffset) {
        var _a;
        const bindings = [];
        this.consumeOptionalCharacter(chars.$COLON); // trackBy: trackByFunction
        const valueExpr = this.getDirectiveBoundTarget();
        const span = new ParseSpan(keySpan.start, this.inputIndex);
        bindings.push(new TemplateBinding(span, span.toAbsolute(absoluteOffset), key, false /* keyIsVar */, ((_a = valueExpr) === null || _a === void 0 ? void 0 : _a.source) || '', valueExpr));
        // The binding could optionally be followed by "as". For example,
        // *ngIf="cond | pipe as x". In this case, the key in the "as" binding
        // is "x" and the value is the template key itself ("ngIf"). Note that the
        // 'key' in the current context now becomes the "value" in the next binding.
        const asBinding = this.parseAsBinding(key, keySpan, absoluteOffset);
        if (asBinding) {
            bindings.push(asBinding);
        }
        this.consumeStatementTerminator();
        return bindings;
    }
    /**
     * Return the expression AST for the bound target of a directive keyword
     * binding. For example,
     * ```
     * *ngIf="condition | pipe".
     *        ^^^^^^^^^^^^^^^^ bound target for "ngIf"
     * *ngFor="let item of items"
     *                     ^^^^^ bound target for "ngForOf"
     * ```
     */
    getDirectiveBoundTarget() {
        if (this.next === EOF || this.peekKeywordAs() || this.peekKeywordLet()) {
            return null;
        }
        const ast = this.parsePipe(); // example: "condition | async"
        const { start, end } = ast.span;
        const value = this.input.substring(start, end);
        return new ASTWithSource(ast, value, this.location, this.absoluteOffset + start, this.errors);
    }
    /**
     * Return the binding for a variable declared using `as`. Note that the order
     * of the key-value pair in this declaration is reversed. For example,
     * ```
     * *ngFor="let item of items; index as i"
     *                            ^^^^^    ^
     *                            value    key
     * ```
     *
     * @param value name of the value in the declaration, "ngIf" in the example above
     * @param valueSpan span of the value in the declaration
     * @param absoluteOffset absolute offset of `value`
     */
    parseAsBinding(value, valueSpan, absoluteOffset) {
        if (!this.peekKeywordAs()) {
            return null;
        }
        this.advance(); // consume the 'as' keyword
        const { key } = this.expectTemplateBindingKey();
        const valueAst = new AST(valueSpan, valueSpan.toAbsolute(absoluteOffset));
        const valueExpr = new ASTWithSource(valueAst, value, this.location, absoluteOffset + valueSpan.start, this.errors);
        const span = new ParseSpan(valueSpan.start, this.inputIndex);
        return new TemplateBinding(span, span.toAbsolute(absoluteOffset), key, true /* keyIsVar */, value, valueExpr);
    }
    /**
     * Return the binding for a variable declared using `let`. For example,
     * ```
     * *ngFor="let item of items; let i=index;"
     *         ^^^^^^^^           ^^^^^^^^^^^
     * ```
     * In the first binding, `item` is bound to `NgForOfContext.$implicit`.
     * In the second binding, `i` is bound to `NgForOfContext.index`.
     */
    parseLetBinding() {
        var _a;
        if (!this.peekKeywordLet()) {
            return null;
        }
        const spanStart = this.inputIndex;
        this.advance(); // consume the 'let' keyword
        const { key } = this.expectTemplateBindingKey();
        let valueExpr = null;
        if (this.consumeOptionalOperator('=')) {
            const { key: value, keySpan: valueSpan } = this.expectTemplateBindingKey();
            const ast = new AST(valueSpan, valueSpan.toAbsolute(this.absoluteOffset));
            valueExpr = new ASTWithSource(ast, value, this.location, this.absoluteOffset + valueSpan.start, this.errors);
        }
        const spanEnd = this.inputIndex;
        const span = new ParseSpan(spanStart, spanEnd);
        return new TemplateBinding(span, span.toAbsolute(this.absoluteOffset), key, true /* keyIsVar */, ((_a = valueExpr) === null || _a === void 0 ? void 0 : _a.source) || '$implicit', valueExpr);
    }
    /**
     * Consume the optional statement terminator: semicolon or comma.
     */
    consumeStatementTerminator() {
        this.consumeOptionalCharacter(chars.$SEMICOLON) || this.consumeOptionalCharacter(chars.$COMMA);
    }
    error(message, index = null) {
        this.errors.push(new ParserError(message, this.input, this.locationText(index), this.location));
        this.skip();
    }
    locationText(index = null) {
        if (index == null)
            index = this.index;
        return (index < this.tokens.length) ? `at column ${this.tokens[index].index + 1} in` :
            `at the end of the expression`;
    }
    // Error recovery should skip tokens until it encounters a recovery point. skip() treats
    // the end of input and a ';' as unconditionally a recovery point. It also treats ')',
    // '}' and ']' as conditional recovery points if one of calling productions is expecting
    // one of these symbols. This allows skip() to recover from errors such as '(a.) + 1' allowing
    // more of the AST to be retained (it doesn't skip any tokens as the ')' is retained because
    // of the '(' begins an '(' <expr> ')' production). The recovery points of grouping symbols
    // must be conditional as they must be skipped if none of the calling productions are not
    // expecting the closing token else we will never make progress in the case of an
    // extraneous group closing symbol (such as a stray ')'). This is not the case for ';' because
    // parseChain() is always the root production and it expects a ';'.
    // If a production expects one of these token it increments the corresponding nesting count,
    // and then decrements it just prior to checking if the token is in the input.
    skip() {
        let n = this.next;
        while (this.index < this.tokens.length && !n.isCharacter(chars.$SEMICOLON) &&
            (this.rparensExpected <= 0 || !n.isCharacter(chars.$RPAREN)) &&
            (this.rbracesExpected <= 0 || !n.isCharacter(chars.$RBRACE)) &&
            (this.rbracketsExpected <= 0 || !n.isCharacter(chars.$RBRACKET))) {
            if (this.next.isError()) {
                this.errors.push(new ParserError(this.next.toString(), this.input, this.locationText(), this.location));
            }
            this.advance();
            n = this.next;
        }
    }
}
class SimpleExpressionChecker {
    constructor() {
        this.errors = [];
    }
    visitImplicitReceiver(ast, context) { }
    visitInterpolation(ast, context) { }
    visitLiteralPrimitive(ast, context) { }
    visitPropertyRead(ast, context) { }
    visitPropertyWrite(ast, context) { }
    visitSafePropertyRead(ast, context) { }
    visitMethodCall(ast, context) { }
    visitSafeMethodCall(ast, context) { }
    visitFunctionCall(ast, context) { }
    visitLiteralArray(ast, context) { this.visitAll(ast.expressions); }
    visitLiteralMap(ast, context) { this.visitAll(ast.values); }
    visitBinary(ast, context) { }
    visitPrefixNot(ast, context) { }
    visitNonNullAssert(ast, context) { }
    visitConditional(ast, context) { }
    visitPipe(ast, context) { this.errors.push('pipes'); }
    visitKeyedRead(ast, context) { }
    visitKeyedWrite(ast, context) { }
    visitAll(asts) { return asts.map(node => node.visit(this)); }
    visitChain(ast, context) { }
    visitQuote(ast, context) { }
}
/**
 * This class extends SimpleExpressionChecker used in View Engine and performs more strict checks to
 * make sure host bindings do not contain pipes. In View Engine, having pipes in host bindings is
 * not supported as well, but in some cases (like `!(value | async)`) the error is not triggered at
 * compile time. In order to preserve View Engine behavior, more strict checks are introduced for
 * Ivy mode only.
 */
class IvySimpleExpressionChecker extends SimpleExpressionChecker {
    visitBinary(ast, context) {
        ast.left.visit(this);
        ast.right.visit(this);
    }
    visitPrefixNot(ast, context) { ast.expression.visit(this); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sbUNBQW1DLENBQUM7QUFDcEcsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVyQyxPQUFPLEVBQUMsR0FBRyxFQUFFLGFBQWEsRUFBa0MsTUFBTSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBaUIsZ0JBQWdCLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFDLE1BQU0sT0FBTyxDQUFDO0FBQ25aLE9BQU8sRUFBQyxHQUFHLEVBQWdCLFNBQVMsRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRTVFLE1BQU0sT0FBTyxrQkFBa0I7SUFDN0IsWUFBbUIsT0FBaUIsRUFBUyxXQUFxQixFQUFTLE9BQWlCO1FBQXpFLFlBQU8sR0FBUCxPQUFPLENBQVU7UUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBVTtRQUFTLFlBQU8sR0FBUCxPQUFPLENBQVU7SUFBRyxDQUFDO0NBQ2pHO0FBRUQsTUFBTSxPQUFPLDBCQUEwQjtJQUNyQyxZQUNXLGdCQUFtQyxFQUFTLFFBQWtCLEVBQzlELE1BQXFCO1FBRHJCLHFCQUFnQixHQUFo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QUMsQ0FBQyxDQUFDO0NBQzdFIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGFycyBmcm9tICcuLi9jaGFycyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge2VzY2FwZVJlZ0V4cH0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBBYnNvbHV0ZVNvdXJjZVNwYW4sIEFzdFZpc2l0b3IsIEJpbmFyeSwgQmluZGluZ1BpcGUsIENoYWluLCBDb25kaXRpb25hbCwgRW1wdHlFeHByLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIEtleWVkUmVhZCwgS2V5ZWRXcml0ZSwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsTWFwS2V5LCBMaXRlcmFsUHJpbWl0aXZlLCBNZXRob2RDYWxsLCBOb25OdWxsQXNzZXJ0LCBQYXJzZVNwYW4sIFBhcnNlckVycm9yLCBQcmVmaXhOb3QsIFByb3BlcnR5UmVhZCwgUHJvcGVydHlXcml0ZSwgUXVvdGUsIFNhZmVNZXRob2RDYWxsLCBTYWZlUHJvcGVydHlSZWFkLCBUZW1wbGF0ZUJpbmRpbmd9IGZyb20gJy4vYXN0JztcbmltcG9ydCB7RU9GLCBMZXhlciwgVG9rZW4sIFRva2VuVHlwZSwgaXNJZGVudGlmaWVyLCBpc1F1b3RlfSBmcm9tICcuL2xleGVyJztcblxuZXhwb3J0IGNsYXNzIFNwbGl0SW50ZXJwb2xhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzdHJpbmdzOiBzdHJpbmdbXSwgcHVibGljIGV4cHJlc3Npb25zOiBzdHJpbmdbXSwgcHVibGljIG9mZnNldHM6IG51bWJlcltdKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSwgcHVibGljIHdhcm5pbmdzOiBzdHJpbmdbXSxcbiAgICAgIHB1YmxpYyBlcnJvcnM6IFBhcnNlckVycm9yW10pIHt9XG59XG5cbmNvbnN0IGRlZmF1bHRJbnRlcnBvbGF0ZVJlZ0V4cCA9IF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTtcbmZ1bmN0aW9uIF9nZXRJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBSZWdFeHAge1xuICBpZiAoY29uZmlnID09PSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKSB7XG4gICAgcmV0dXJuIGRlZmF1bHRJbnRlcnBvbGF0ZVJlZ0V4cDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gX2NyZWF0ZUludGVycG9sYXRlUmVnRXhwKGNvbmZpZyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2NyZWF0ZUludGVycG9sYXRlUmVnRXhwKGNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IFJlZ0V4cCB7XG4gIGNvbnN0IHBhdHRlcm4gPSBlc2NhcGVSZWdFeHAoY29uZmlnLnN0YXJ0KSArICcoW1xcXFxzXFxcXFNdKj8pJyArIGVzY2FwZVJlZ0V4cChjb25maWcuZW5kKTtcbiAgcmV0dXJuIG5ldyBSZWdFeHAocGF0dGVybiwgJ2cnKTtcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIHByaXZhdGUgZXJyb3JzOiBQYXJzZXJFcnJvcltdID0gW107XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfbGV4ZXI6IExleGVyKSB7fVxuXG4gIHNpbXBsZUV4cHJlc3Npb25DaGVja2VyID0gU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXI7XG5cbiAgcGFyc2VBY3Rpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogYW55LCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICB0aGlzLl9jaGVja05vSW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCk7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUodGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCkpO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCB0cnVlLCB0aGlzLmVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICAucGFyc2VDaGFpbigpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHBhcnNlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrU2ltcGxlRXhwcmVzc2lvbihhc3Q6IEFTVCk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBjaGVja2VyID0gbmV3IHRoaXMuc2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIoKTtcbiAgICBhc3QudmlzaXQoY2hlY2tlcik7XG4gICAgcmV0dXJuIGNoZWNrZXIuZXJyb3JzO1xuICB9XG5cbiAgcGFyc2VTaW1wbGVCaW5kaW5nKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VCaW5kaW5nQXN0KGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IGVycm9ycyA9IHRoaXMuY2hlY2tTaW1wbGVFeHByZXNzaW9uKGFzdCk7XG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgSG9zdCBiaW5kaW5nIGV4cHJlc3Npb24gY2Fubm90IGNvbnRhaW4gJHtlcnJvcnMuam9pbignICcpfWAsIGlucHV0LCBsb2NhdGlvbik7XG4gICAgfVxuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcG9ydEVycm9yKG1lc3NhZ2U6IHN0cmluZywgaW5wdXQ6IHN0cmluZywgZXJyTG9jYXRpb246IHN0cmluZywgY3R4TG9jYXRpb24/OiBhbnkpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihtZXNzYWdlLCBpbnB1dCwgZXJyTG9jYXRpb24sIGN0eExvY2F0aW9uKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUJpbmRpbmdBc3QoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IEFTVCB7XG4gICAgLy8gUXVvdGVzIGV4cHJlc3Npb25zIHVzZSAzcmQtcGFydHkgZXhwcmVzc2lvbiBsYW5ndWFnZS4gV2UgZG9uJ3Qgd2FudCB0byB1c2VcbiAgICAvLyBvdXIgbGV4ZXIgb3IgcGFyc2VyIGZvciB0aGF0LCBzbyB3ZSBjaGVjayBmb3IgdGhhdCBhaGVhZCBvZiB0aW1lLlxuICAgIGNvbnN0IHF1b3RlID0gdGhpcy5fcGFyc2VRdW90ZShpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0KTtcblxuICAgIGlmIChxdW90ZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gcXVvdGU7XG4gICAgfVxuXG4gICAgdGhpcy5fY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHNvdXJjZVRvTGV4KTtcbiAgICByZXR1cm4gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSwgdGhpcy5lcnJvcnMsXG4gICAgICAgICAgICAgICBpbnB1dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpXG4gICAgICAgIC5wYXJzZUNoYWluKCk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVF1b3RlKGlucHV0OiBzdHJpbmd8bnVsbCwgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6IEFTVHxudWxsIHtcbiAgICBpZiAoaW5wdXQgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4U2VwYXJhdG9ySW5kZXggPSBpbnB1dC5pbmRleE9mKCc6Jyk7XG4gICAgaWYgKHByZWZpeFNlcGFyYXRvckluZGV4ID09IC0xKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBwcmVmaXggPSBpbnB1dC5zdWJzdHJpbmcoMCwgcHJlZml4U2VwYXJhdG9ySW5kZXgpLnRyaW0oKTtcbiAgICBpZiAoIWlzSWRlbnRpZmllcihwcmVmaXgpKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCB1bmludGVycHJldGVkRXhwcmVzc2lvbiA9IGlucHV0LnN1YnN0cmluZyhwcmVmaXhTZXBhcmF0b3JJbmRleCArIDEpO1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBRdW90ZShcbiAgICAgICAgc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgcHJlZml4LCB1bmludGVycHJldGVkRXhwcmVzc2lvbiwgbG9jYXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIG1pY3Jvc3ludGF4IHRlbXBsYXRlIGV4cHJlc3Npb24gYW5kIHJldHVybiBhIGxpc3Qgb2YgYmluZGluZ3Mgb3JcbiAgICogcGFyc2luZyBlcnJvcnMgaW4gY2FzZSB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBpcyBpbnZhbGlkLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgPGRpdiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiPlxuICAgKiAgICAgICAgICAgICAgICBeIGBhYnNvbHV0ZU9mZnNldGAgZm9yIGB0cGxWYWx1ZWBcbiAgICogYGBgXG4gICAqIGNvbnRhaW5zIHRocmVlIGJpbmRpbmdzOlxuICAgKiAxLiBuZ0ZvciAtPiBudWxsXG4gICAqIDIuIGl0ZW0gLT4gTmdGb3JPZkNvbnRleHQuJGltcGxpY2l0XG4gICAqIDMuIG5nRm9yT2YgLT4gaXRlbXNcbiAgICpcbiAgICogVGhpcyBpcyBhcHBhcmVudCBmcm9tIHRoZSBkZS1zdWdhcmVkIHRlbXBsYXRlOlxuICAgKiBgYGBcbiAgICogICA8bmctdGVtcGxhdGUgbmdGb3IgbGV0LWl0ZW0gW25nRm9yT2ZdPVwiaXRlbXNcIj5cbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZUtleSBuYW1lIG9mIGRpcmVjdGl2ZSwgd2l0aG91dCB0aGUgKiBwcmVmaXguIEZvciBleGFtcGxlOiBuZ0lmLCBuZ0ZvclxuICAgKiBAcGFyYW0gdGVtcGxhdGVWYWx1ZSBSSFMgb2YgdGhlIG1pY3Jvc3ludGF4IGF0dHJpYnV0ZVxuICAgKiBAcGFyYW0gdGVtcGxhdGVVcmwgdGVtcGxhdGUgZmlsZW5hbWUgaWYgaXQncyBleHRlcm5hbCwgY29tcG9uZW50IGZpbGVuYW1lIGlmIGl0J3MgaW5saW5lXG4gICAqIEBwYXJhbSBhYnNvbHV0ZU9mZnNldCBhYnNvbHV0ZSBvZmZzZXQgb2YgdGhlIGB0cGxWYWx1ZWBcbiAgICovXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyhcbiAgICAgIHRlbXBsYXRlS2V5OiBzdHJpbmcsIHRlbXBsYXRlVmFsdWU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZyxcbiAgICAgIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUodGVtcGxhdGVWYWx1ZSk7XG4gICAgcmV0dXJuIG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICB0ZW1wbGF0ZVZhbHVlLCB0ZW1wbGF0ZVVybCwgYWJzb2x1dGVPZmZzZXQsIHRva2VucywgdGVtcGxhdGVWYWx1ZS5sZW5ndGgsXG4gICAgICAgICAgICAgICBmYWxzZSAvKiBwYXJzZUFjdGlvbiAqLywgdGhpcy5lcnJvcnMsIDAgLyogcmVsYXRpdmUgb2Zmc2V0ICovKVxuICAgICAgICAucGFyc2VUZW1wbGF0ZUJpbmRpbmdzKHRlbXBsYXRlS2V5KTtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgY29uc3Qgc3BsaXQgPSB0aGlzLnNwbGl0SW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGlmIChzcGxpdCA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGV4cHJlc3Npb25zOiBBU1RbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGxpdC5leHByZXNzaW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgZXhwcmVzc2lvblRleHQgPSBzcGxpdC5leHByZXNzaW9uc1tpXTtcbiAgICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uVGV4dCk7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9ycywgc3BsaXQub2Zmc2V0c1tpXSArIChleHByZXNzaW9uVGV4dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpKVxuICAgICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgICBleHByZXNzaW9ucy5wdXNoKGFzdCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4oMCwgaW5wdXQgPT0gbnVsbCA/IDAgOiBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShcbiAgICAgICAgbmV3IEludGVycG9sYXRpb24oc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgc3BsaXQuc3RyaW5ncywgZXhwcmVzc2lvbnMpLCBpbnB1dCxcbiAgICAgICAgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBzcGxpdEludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBTcGxpdEludGVycG9sYXRpb25cbiAgICAgIHxudWxsIHtcbiAgICBjb25zdCByZWdleHAgPSBfZ2V0SW50ZXJwb2xhdGVSZWdFeHAoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3QgcGFydHMgPSBpbnB1dC5zcGxpdChyZWdleHApO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggPD0gMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHN0cmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZXhwcmVzc2lvbnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgb2Zmc2V0czogbnVtYmVyW10gPSBbXTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBwYXJ0OiBzdHJpbmcgPSBwYXJ0c1tpXTtcbiAgICAgIGlmIChpICUgMiA9PT0gMCkge1xuICAgICAgICAvLyBmaXhlZCBzdHJpbmdcbiAgICAgICAgc3RyaW5ncy5wdXNoKHBhcnQpO1xuICAgICAgICBvZmZzZXQgKz0gcGFydC5sZW5ndGg7XG4gICAgICB9IGVsc2UgaWYgKHBhcnQudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgb2Zmc2V0ICs9IGludGVycG9sYXRpb25Db25maWcuc3RhcnQubGVuZ3RoO1xuICAgICAgICBleHByZXNzaW9ucy5wdXNoKHBhcnQpO1xuICAgICAgICBvZmZzZXRzLnB1c2gob2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IHBhcnQubGVuZ3RoICsgaW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAnQmxhbmsgZXhwcmVzc2lvbnMgYXJlIG5vdCBhbGxvd2VkIGluIGludGVycG9sYXRlZCBzdHJpbmdzJywgaW5wdXQsXG4gICAgICAgICAgICBgYXQgY29sdW1uICR7dGhpcy5fZmluZEludGVycG9sYXRpb25FcnJvckNvbHVtbihwYXJ0cywgaSwgaW50ZXJwb2xhdGlvbkNvbmZpZyl9IGluYCxcbiAgICAgICAgICAgIGxvY2F0aW9uKTtcbiAgICAgICAgZXhwcmVzc2lvbnMucHVzaCgnJGltcGxpY2l0Jyk7XG4gICAgICAgIG9mZnNldHMucHVzaChvZmZzZXQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFNwbGl0SW50ZXJwb2xhdGlvbihzdHJpbmdzLCBleHByZXNzaW9ucywgb2Zmc2V0cyk7XG4gIH1cblxuICB3cmFwTGl0ZXJhbFByaW1pdGl2ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dCA9PSBudWxsID8gMCA6IGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBpbnB1dCksIGlucHV0LCBsb2NhdGlvbixcbiAgICAgICAgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0cmlwQ29tbWVudHMoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaSA9IHRoaXMuX2NvbW1lbnRTdGFydChpbnB1dCk7XG4gICAgcmV0dXJuIGkgIT0gbnVsbCA/IGlucHV0LnN1YnN0cmluZygwLCBpKS50cmltKCkgOiBpbnB1dDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbW1lbnRTdGFydChpbnB1dDogc3RyaW5nKTogbnVtYmVyfG51bGwge1xuICAgIGxldCBvdXRlclF1b3RlOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGNvbnN0IGNoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgY29uc3QgbmV4dENoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkgKyAxKTtcblxuICAgICAgaWYgKGNoYXIgPT09IGNoYXJzLiRTTEFTSCAmJiBuZXh0Q2hhciA9PSBjaGFycy4kU0xBU0ggJiYgb3V0ZXJRdW90ZSA9PSBudWxsKSByZXR1cm4gaTtcblxuICAgICAgaWYgKG91dGVyUXVvdGUgPT09IGNoYXIpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKG91dGVyUXVvdGUgPT0gbnVsbCAmJiBpc1F1b3RlKGNoYXIpKSB7XG4gICAgICAgIG91dGVyUXVvdGUgPSBjaGFyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrTm9JbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IHZvaWQge1xuICAgIGNvbnN0IHJlZ2V4cCA9IF9nZXRJbnRlcnBvbGF0ZVJlZ0V4cChpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBwYXJ0cyA9IGlucHV0LnNwbGl0KHJlZ2V4cCk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7aW50ZXJwb2xhdGlvbkNvbmZpZy5lbmR9KSB3aGVyZSBleHByZXNzaW9uIHdhcyBleHBlY3RlZGAsXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgYGF0IGNvbHVtbiAke3RoaXMuX2ZpbmRJbnRlcnBvbGF0aW9uRXJyb3JDb2x1bW4ocGFydHMsIDEsIGludGVycG9sYXRpb25Db25maWcpfSBpbmAsXG4gICAgICAgICAgbG9jYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRJbnRlcnBvbGF0aW9uRXJyb3JDb2x1bW4oXG4gICAgICBwYXJ0czogc3RyaW5nW10sIHBhcnRJbkVycklkeDogbnVtYmVyLCBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogbnVtYmVyIHtcbiAgICBsZXQgZXJyTG9jYXRpb24gPSAnJztcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBhcnRJbkVycklkeDsgaisrKSB7XG4gICAgICBlcnJMb2NhdGlvbiArPSBqICUgMiA9PT0gMCA/XG4gICAgICAgICAgcGFydHNbal0gOlxuICAgICAgICAgIGAke2ludGVycG9sYXRpb25Db25maWcuc3RhcnR9JHtwYXJ0c1tqXX0ke2ludGVycG9sYXRpb25Db25maWcuZW5kfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVyckxvY2F0aW9uLmxlbmd0aDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSXZ5UGFyc2VyIGV4dGVuZHMgUGFyc2VyIHtcbiAgc2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgPSBJdnlTaW1wbGVFeHByZXNzaW9uQ2hlY2tlcjsgIC8vXG59XG5cbmV4cG9ydCBjbGFzcyBfUGFyc2VBU1Qge1xuICBwcml2YXRlIHJwYXJlbnNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNrZXRzRXhwZWN0ZWQgPSAwO1xuICBwcml2YXRlIHJicmFjZXNFeHBlY3RlZCA9IDA7XG5cbiAgLy8gQ2FjaGUgb2YgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZWNlcyB0byB0aGUgYWJzb2x1dGUgc291cmNlIHNwYW4gdGhleSBtYXAgdG8sIHVzZWQgdG9cbiAgLy8gcHJldmVudCBjcmVhdGluZyBzdXBlcmZsdW91cyBzb3VyY2Ugc3BhbnMgaW4gYHNvdXJjZVNwYW5gLlxuICAvLyBBIHNlcmlhbCBvZiB0aGUgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZXggaXMgdXNlZCBmb3IgbWFwcGluZyBiZWNhdXNlIGJvdGggYXJlIHN0YXRlZnVsXG4gIC8vIGFuZCBtYXkgY2hhbmdlIGZvciBzdWJzZXF1ZW50IGV4cHJlc3Npb25zIHZpc2l0ZWQgYnkgdGhlIHBhcnNlci5cbiAgcHJpdmF0ZSBzb3VyY2VTcGFuQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQWJzb2x1dGVTb3VyY2VTcGFuPigpO1xuXG4gIGluZGV4OiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGlucHV0OiBzdHJpbmcsIHB1YmxpYyBsb2NhdGlvbjogYW55LCBwdWJsaWMgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHB1YmxpYyB0b2tlbnM6IFRva2VuW10sIHB1YmxpYyBpbnB1dExlbmd0aDogbnVtYmVyLCBwdWJsaWMgcGFyc2VBY3Rpb246IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSwgcHJpdmF0ZSBvZmZzZXQ6IG51bWJlcikge31cblxuICBwZWVrKG9mZnNldDogbnVtYmVyKTogVG9rZW4ge1xuICAgIGNvbnN0IGkgPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHJldHVybiBpIDwgdGhpcy50b2tlbnMubGVuZ3RoID8gdGhpcy50b2tlbnNbaV0gOiBFT0Y7XG4gIH1cblxuICBnZXQgbmV4dCgpOiBUb2tlbiB7IHJldHVybiB0aGlzLnBlZWsoMCk7IH1cblxuICBnZXQgaW5wdXRJbmRleCgpOiBudW1iZXIge1xuICAgIHJldHVybiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkgPyB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5wdXRMZW5ndGggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIHNwYW4oc3RhcnQ6IG51bWJlcikgeyByZXR1cm4gbmV3IFBhcnNlU3BhbihzdGFydCwgdGhpcy5pbnB1dEluZGV4KTsgfVxuXG4gIHNvdXJjZVNwYW4oc3RhcnQ6IG51bWJlcik6IEFic29sdXRlU291cmNlU3BhbiB7XG4gICAgY29uc3Qgc2VyaWFsID0gYCR7c3RhcnR9QCR7dGhpcy5pbnB1dEluZGV4fWA7XG4gICAgaWYgKCF0aGlzLnNvdXJjZVNwYW5DYWNoZS5oYXMoc2VyaWFsKSkge1xuICAgICAgdGhpcy5zb3VyY2VTcGFuQ2FjaGUuc2V0KHNlcmlhbCwgdGhpcy5zcGFuKHN0YXJ0KS50b0Fic29sdXRlKHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc291cmNlU3BhbkNhY2hlLmdldChzZXJpYWwpICE7XG4gIH1cblxuICBhZHZhbmNlKCkgeyB0aGlzLmluZGV4Kys7IH1cblxuICBjb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3Rlcihjb2RlKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHBlZWtLZXl3b3JkTGV0KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5uZXh0LmlzS2V5d29yZExldCgpOyB9XG4gIHBlZWtLZXl3b3JkQXMoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLm5leHQuaXNLZXl3b3JkQXMoKTsgfVxuXG4gIGV4cGVjdENoYXJhY3Rlcihjb2RlOiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY29kZSkpIHJldHVybjtcbiAgICB0aGlzLmVycm9yKGBNaXNzaW5nIGV4cGVjdGVkICR7U3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKX1gKTtcbiAgfVxuXG4gIGNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKG9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzT3BlcmF0b3Iob3ApKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZXhwZWN0T3BlcmF0b3Iob3BlcmF0b3I6IHN0cmluZykge1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKG9wZXJhdG9yKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgb3BlcmF0b3IgJHtvcGVyYXRvcn1gKTtcbiAgfVxuXG4gIGV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAke259LCBleHBlY3RlZCBpZGVudGlmaWVyIG9yIGtleXdvcmRgKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG4udG9TdHJpbmcoKSBhcyBzdHJpbmc7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSAmJiAhbi5pc1N0cmluZygpKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7bn0sIGV4cGVjdGVkIGlkZW50aWZpZXIsIGtleXdvcmQsIG9yIHN0cmluZ2ApO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbi50b1N0cmluZygpIGFzIHN0cmluZztcbiAgfVxuXG4gIHBhcnNlQ2hhaW4oKTogQVNUIHtcbiAgICBjb25zdCBleHByczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBleHBycy5wdXNoKGV4cHIpO1xuXG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluIGNoYWluZWQgZXhwcmVzc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICB9ICAvLyByZWFkIGFsbCBzZW1pY29sb25zXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAnJHt0aGlzLm5leHR9J2ApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZXhwcnMubGVuZ3RoID09IDApIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIGlmIChleHBycy5sZW5ndGggPT0gMSkgcmV0dXJuIGV4cHJzWzBdO1xuICAgIHJldHVybiBuZXcgQ2hhaW4odGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZXhwcnMpO1xuICB9XG5cbiAgcGFyc2VQaXBlKCk6IEFTVCB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSkge1xuICAgICAgaWYgKHRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgdGhpcy5lcnJvcignQ2Fubm90IGhhdmUgYSBwaXBlIGluIGFuIGFjdGlvbiBleHByZXNzaW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk7XG4gICAgICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zb3VyY2VTcGFuKG5hbWVTdGFydCk7XG4gICAgICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW107XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pKSB7XG4gICAgICAgICAgYXJncy5wdXNoKHRoaXMucGFyc2VFeHByZXNzaW9uKCkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBCaW5kaW5nUGlwZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQsIG5hbWUsIGFyZ3MsIG5hbWVTcGFuKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbigpOiBBU1QgeyByZXR1cm4gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7IH1cblxuICBwYXJzZUNvbmRpdGlvbmFsKCk6IEFTVCB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5wYXJzZUxvZ2ljYWxPcigpO1xuXG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz8nKSkge1xuICAgICAgY29uc3QgeWVzID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIGxldCBubzogQVNUO1xuICAgICAgaWYgKCF0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pKSB7XG4gICAgICAgIGNvbnN0IGVuZCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuICAgICAgICB0aGlzLmVycm9yKGBDb25kaXRpb25hbCBleHByZXNzaW9uICR7ZXhwcmVzc2lvbn0gcmVxdWlyZXMgYWxsIDMgZXhwcmVzc2lvbnNgKTtcbiAgICAgICAgbm8gPSBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm8gPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBDb25kaXRpb25hbCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQsIHllcywgbm8pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlTG9naWNhbE9yKCk6IEFTVCB7XG4gICAgLy8gJ3x8J1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlTG9naWNhbEFuZCgpO1xuICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCd8fCcpKSB7XG4gICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG4gICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksICd8fCcsIHJlc3VsdCwgcmlnaHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VMb2dpY2FsQW5kKCk6IEFTVCB7XG4gICAgLy8gJyYmJ1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlRXF1YWxpdHkoKTtcbiAgICB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignJiYnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlRXF1YWxpdHkoKTtcbiAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgJyYmJywgcmVzdWx0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUVxdWFsaXR5KCk6IEFTVCB7XG4gICAgLy8gJz09JywnIT0nLCc9PT0nLCchPT0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VSZWxhdGlvbmFsKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgY2FzZSAnIT0nOlxuICAgICAgICBjYXNlICchPT0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlUmVsYXRpb25hbCgpOiBBU1Qge1xuICAgIC8vICc8JywgJz4nLCAnPD0nLCAnPj0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgY2FzZSAnPic6XG4gICAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgY2FzZSAnPj0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUFkZGl0aXZlKCk6IEFTVCB7XG4gICAgLy8gJysnLCAnLSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJysnOlxuICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTXVsdGlwbGljYXRpdmUoKTogQVNUIHtcbiAgICAvLyAnKicsICclJywgJy8nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKic6XG4gICAgICAgIGNhc2UgJyUnOlxuICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZVByZWZpeCgpOiBBU1Qge1xuICAgIGlmICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBjb25zdCBsaXRlcmFsU3BhbiA9IG5ldyBQYXJzZVNwYW4oc3RhcnQsIHN0YXJ0KTtcbiAgICAgIGNvbnN0IGxpdGVyYWxTb3VyY2VTcGFuID0gbGl0ZXJhbFNwYW4udG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KTtcbiAgICAgIGxldCByZXN1bHQ6IEFTVDtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgQmluYXJ5KFxuICAgICAgICAgICAgICB0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnLScsIHJlc3VsdCxcbiAgICAgICAgICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUobGl0ZXJhbFNwYW4sIGxpdGVyYWxTb3VyY2VTcGFuLCAwKSk7XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IEJpbmFyeShcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsXG4gICAgICAgICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKGxpdGVyYWxTcGFuLCBsaXRlcmFsU291cmNlU3BhbiwgMCksIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByZWZpeE5vdCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYXJzZUNhbGxDaGFpbigpO1xuICB9XG5cbiAgcGFyc2VDYWxsQ2hhaW4oKTogQVNUIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByaW1hcnkoKTtcbiAgICBjb25zdCByZXN1bHRTdGFydCA9IHJlc3VsdC5zcGFuLnN0YXJ0O1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFBFUklPRCkpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChyZXN1bHQsIGZhbHNlKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc/LicpKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwocmVzdWx0LCB0cnVlKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgS2V5ZWRXcml0ZShcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBrZXksIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgS2V5ZWRSZWFkKHRoaXMuc3BhbihyZXN1bHRTdGFydCksIHRoaXMuc291cmNlU3BhbihyZXN1bHRTdGFydCksIHJlc3VsdCwga2V5KTtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnBhcnNlQ2FsbEFyZ3VtZW50cygpO1xuICAgICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBGdW5jdGlvbkNhbGwodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBhcmdzKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCchJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IE5vbk51bGxBc3NlcnQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0KTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZVByaW1hcnkoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZE51bGwoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbnVsbCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRVbmRlZmluZWQoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdm9pZCAwKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRydWUoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdHJ1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRGYWxzZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRUaGlzKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICB0aGlzLnJicmFja2V0c0V4cGVjdGVkKys7XG4gICAgICBjb25zdCBlbGVtZW50cyA9IHRoaXMucGFyc2VFeHByZXNzaW9uTGlzdChjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGVsZW1lbnRzKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUxpdGVyYWxNYXAoKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzSWRlbnRpZmllcigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChcbiAgICAgICAgICBuZXcgSW1wbGljaXRSZWNlaXZlcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKSwgZmFsc2UpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNOdW1iZXIoKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLm5leHQudG9OdW1iZXIoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzU3RyaW5nKCkpIHtcbiAgICAgIGNvbnN0IGxpdGVyYWxWYWx1ZSA9IHRoaXMubmV4dC50b1N0cmluZygpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbGl0ZXJhbFZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA+PSB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb246ICR7dGhpcy5pbnB1dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7dGhpcy5uZXh0fWApO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uTGlzdCh0ZXJtaW5hdG9yOiBudW1iZXIpOiBBU1RbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBBU1RbXSA9IFtdO1xuICAgIGlmICghdGhpcy5uZXh0LmlzQ2hhcmFjdGVyKHRlcm1pbmF0b3IpKSB7XG4gICAgICBkbyB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxpdGVyYWxNYXAoKTogTGl0ZXJhbE1hcCB7XG4gICAgY29uc3Qga2V5czogTGl0ZXJhbE1hcEtleVtdID0gW107XG4gICAgY29uc3QgdmFsdWVzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpO1xuICAgIGlmICghdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSkpIHtcbiAgICAgIHRoaXMucmJyYWNlc0V4cGVjdGVkKys7XG4gICAgICBkbyB7XG4gICAgICAgIGNvbnN0IHF1b3RlZCA9IHRoaXMubmV4dC5pc1N0cmluZygpO1xuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmRPclN0cmluZygpO1xuICAgICAgICBrZXlzLnB1c2goe2tleSwgcXVvdGVkfSk7XG4gICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7XG4gICAgICAgIHZhbHVlcy5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgICB0aGlzLnJicmFjZXNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgTGl0ZXJhbE1hcCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBrZXlzLCB2YWx1ZXMpO1xuICB9XG5cbiAgcGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwocmVjZWl2ZXI6IEFTVCwgaXNTYWZlOiBib29sZWFuID0gZmFsc2UpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gcmVjZWl2ZXIuc3Bhbi5zdGFydDtcbiAgICBjb25zdCBpZCA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpO1xuXG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMucGFyc2VDYWxsQXJndW1lbnRzKCk7XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICBjb25zdCBzcGFuID0gdGhpcy5zcGFuKHN0YXJ0KTtcbiAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpO1xuICAgICAgcmV0dXJuIGlzU2FmZSA/IG5ldyBTYWZlTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpIDpcbiAgICAgICAgICAgICAgICAgICAgICBuZXcgTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpc1NhZmUpIHtcbiAgICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgIHRoaXMuZXJyb3IoJ1RoZSBcXCc/LlxcJyBvcGVyYXRvciBjYW5ub3QgYmUgdXNlZCBpbiB0aGUgYXNzaWdubWVudCcpO1xuICAgICAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgU2FmZVByb3BlcnR5UmVhZCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZWNlaXZlciwgaWQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5ncyBjYW5ub3QgY29udGFpbiBhc3NpZ25tZW50cycpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb3BlcnR5V3JpdGUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVjZWl2ZXIsIGlkLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3Qgc3BhbiA9IHRoaXMuc3BhbihzdGFydCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVJlYWQodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVjZWl2ZXIsIGlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBhcnNlQ2FsbEFyZ3VtZW50cygpOiBCaW5kaW5nUGlwZVtdIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSByZXR1cm4gW107XG4gICAgY29uc3QgcG9zaXRpb25hbHM6IEFTVFtdID0gW107XG4gICAgZG8ge1xuICAgICAgcG9zaXRpb25hbHMucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcG9zaXRpb25hbHMgYXMgQmluZGluZ1BpcGVbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZXMgYW4gaWRlbnRpZmllciwgYSBrZXl3b3JkLCBhIHN0cmluZyB3aXRoIGFuIG9wdGlvbmFsIGAtYCBpbiBiZXR3ZWVuLlxuICAgKi9cbiAgZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk6IHtrZXk6IHN0cmluZywga2V5U3BhbjogUGFyc2VTcGFufSB7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGxldCBvcGVyYXRvckZvdW5kID0gZmFsc2U7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgZG8ge1xuICAgICAgcmVzdWx0ICs9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICBvcGVyYXRvckZvdW5kID0gdGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignLScpO1xuICAgICAgaWYgKG9wZXJhdG9yRm91bmQpIHtcbiAgICAgICAgcmVzdWx0ICs9ICctJztcbiAgICAgIH1cbiAgICB9IHdoaWxlIChvcGVyYXRvckZvdW5kKTtcbiAgICByZXR1cm4ge1xuICAgICAga2V5OiByZXN1bHQsXG4gICAgICBrZXlTcGFuOiBuZXcgUGFyc2VTcGFuKHN0YXJ0LCBzdGFydCArIHJlc3VsdC5sZW5ndGgpLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgbWljcm9zeW50YXggdGVtcGxhdGUgZXhwcmVzc2lvbiBhbmQgcmV0dXJuIGEgbGlzdCBvZiBiaW5kaW5ncyBvclxuICAgKiBwYXJzaW5nIGVycm9ycyBpbiBjYXNlIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGludmFsaWQuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICA8ZGl2ICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpOyB0cmFja0J5OiBmdW5jXCI+XG4gICAqIGBgYFxuICAgKiBjb250YWlucyBmaXZlIGJpbmRpbmdzOlxuICAgKiAxLiBuZ0ZvciAtPiBudWxsXG4gICAqIDIuIGl0ZW0gLT4gTmdGb3JPZkNvbnRleHQuJGltcGxpY2l0XG4gICAqIDMuIG5nRm9yT2YgLT4gaXRlbXNcbiAgICogNC4gaSAtPiBOZ0Zvck9mQ29udGV4dC5pbmRleFxuICAgKiA1LiBuZ0ZvclRyYWNrQnkgLT4gZnVuY1xuICAgKlxuICAgKiBGb3IgYSBmdWxsIGRlc2NyaXB0aW9uIG9mIHRoZSBtaWNyb3N5bnRheCBncmFtbWFyLCBzZWVcbiAgICogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vbWhldmVyeS9kMzUzMDI5NGNmZjJlNGExYjNmZTE1ZmY3NWQwODg1NVxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGVLZXkgbmFtZSBvZiB0aGUgbWljcm9zeW50YXggZGlyZWN0aXZlLCBsaWtlIG5nSWYsIG5nRm9yLCB3aXRob3V0IHRoZSAqXG4gICAqL1xuICBwYXJzZVRlbXBsYXRlQmluZGluZ3ModGVtcGxhdGVLZXk6IHN0cmluZyk6IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcblxuICAgIC8vIFRoZSBmaXJzdCBiaW5kaW5nIGlzIGZvciB0aGUgdGVtcGxhdGUga2V5IGl0c2VsZlxuICAgIC8vIEluICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zXCIsIGtleSA9IFwibmdGb3JcIiwgdmFsdWUgPSBudWxsXG4gICAgLy8gSW4gKm5nSWY9XCJjb25kIHwgcGlwZVwiLCBrZXkgPSBcIm5nSWZcIiwgdmFsdWUgPSBcImNvbmQgfCBwaXBlXCJcbiAgICBiaW5kaW5ncy5wdXNoKC4uLnRoaXMucGFyc2VEaXJlY3RpdmVLZXl3b3JkQmluZGluZ3MoXG4gICAgICAgIHRlbXBsYXRlS2V5LCBuZXcgUGFyc2VTcGFuKDAsIHRlbXBsYXRlS2V5Lmxlbmd0aCksIHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcblxuICAgIHdoaWxlICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICAvLyBJZiBpdCBzdGFydHMgd2l0aCAnbGV0JywgdGhlbiB0aGlzIG11c3QgYmUgdmFyaWFibGUgZGVjbGFyYXRpb25cbiAgICAgIGNvbnN0IGxldEJpbmRpbmcgPSB0aGlzLnBhcnNlTGV0QmluZGluZygpO1xuICAgICAgaWYgKGxldEJpbmRpbmcpIHtcbiAgICAgICAgYmluZGluZ3MucHVzaChsZXRCaW5kaW5nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFR3byBwb3NzaWJsZSBjYXNlcyBoZXJlLCBlaXRoZXIgYHZhbHVlIFwiYXNcIiBrZXlgIG9yXG4gICAgICAgIC8vIFwiZGlyZWN0aXZlLWtleXdvcmQgZXhwcmVzc2lvblwiLiBXZSBkb24ndCBrbm93IHdoaWNoIGNhc2UsIGJ1dCBib3RoXG4gICAgICAgIC8vIFwidmFsdWVcIiBhbmQgXCJkaXJlY3RpdmUta2V5d29yZFwiIGFyZSB0ZW1wbGF0ZSBiaW5kaW5nIGtleSwgc28gY29uc3VtZVxuICAgICAgICAvLyB0aGUga2V5IGZpcnN0LlxuICAgICAgICBjb25zdCB7a2V5LCBrZXlTcGFufSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgICAgIC8vIFBlZWsgYXQgdGhlIG5leHQgdG9rZW4sIGlmIGl0IGlzIFwiYXNcIiB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZVxuICAgICAgICAvLyBkZWNsYXJhdGlvbi5cbiAgICAgICAgY29uc3QgYmluZGluZyA9IHRoaXMucGFyc2VBc0JpbmRpbmcoa2V5LCBrZXlTcGFuLCB0aGlzLmFic29sdXRlT2Zmc2V0KTtcbiAgICAgICAgaWYgKGJpbmRpbmcpIHtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSB0aGUga2V5IG11c3QgYmUgYSBkaXJlY3RpdmUga2V5d29yZCwgbGlrZSBcIm9mXCIuIFRyYW5zZm9ybVxuICAgICAgICAgIC8vIHRoZSBrZXkgdG8gYWN0dWFsIGtleS4gRWcuIG9mIC0+IG5nRm9yT2YsIHRyYWNrQnkgLT4gbmdGb3JUcmFja0J5XG4gICAgICAgICAgY29uc3QgYWN0dWFsS2V5ID0gdGVtcGxhdGVLZXkgKyBrZXlbMF0udG9VcHBlckNhc2UoKSArIGtleS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgYmluZGluZ3MucHVzaChcbiAgICAgICAgICAgICAgLi4udGhpcy5wYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyhhY3R1YWxLZXksIGtleVNwYW4sIHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5jb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQoYmluZGluZ3MsIFtdIC8qIHdhcm5pbmdzICovLCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgYSBkaXJlY3RpdmUga2V5d29yZCwgZm9sbG93ZWQgYnkgYSBtYW5kYXRvcnkgZXhwcmVzc2lvbi5cbiAgICogRm9yIGV4YW1wbGUsIFwib2YgaXRlbXNcIiwgXCJ0cmFja0J5OiBmdW5jXCIuXG4gICAqIFRoZSBiaW5kaW5ncyBhcmU6IG5nRm9yT2YgLT4gaXRlbXMsIG5nRm9yVHJhY2tCeSAtPiBmdW5jXG4gICAqIFRoZXJlIGNvdWxkIGJlIGFuIG9wdGlvbmFsIFwiYXNcIiBiaW5kaW5nIHRoYXQgZm9sbG93cyB0aGUgZXhwcmVzc2lvbi5cbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtcyB8IHNsaWNlOjA6MSBhcyBjb2xsZWN0aW9uXCIuYFxuICAgKiAgICAgICAgICAgICAgICAgIF5eIF5eXl5eXl5eXl5eXl5eXl5eIF5eXl5eXl5eXl5eXl5cbiAgICogICAgICAgICAgICAga2V5d29yZCAgICBib3VuZCB0YXJnZXQgICBvcHRpb25hbCAnYXMnIGJpbmRpbmdcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBrZXkgYmluZGluZyBrZXksIGZvciBleGFtcGxlLCBuZ0ZvciwgbmdJZiwgbmdGb3JPZlxuICAgKiBAcGFyYW0ga2V5U3BhbiBzcGFuIG9mIHRoZSBrZXkgaW4gdGhlIGV4cHJlc3Npb24uIGtleVNwYW4gbWlnaHQgYmUgZGlmZmVyZW50XG4gICAqIGZyb20gYGtleS5sZW5ndGhgLiBGb3IgZXhhbXBsZSwgdGhlIHNwYW4gZm9yIGtleSBcIm5nRm9yT2ZcIiBpcyBcIm9mXCIuXG4gICAqIEBwYXJhbSBhYnNvbHV0ZU9mZnNldCBhYnNvbHV0ZSBvZmZzZXQgb2YgdGhlIGF0dHJpYnV0ZSB2YWx1ZVxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyhrZXk6IHN0cmluZywga2V5U3BhbjogUGFyc2VTcGFuLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTpcbiAgICAgIFRlbXBsYXRlQmluZGluZ1tdIHtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcbiAgICB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pOyAgLy8gdHJhY2tCeTogdHJhY2tCeUZ1bmN0aW9uXG4gICAgY29uc3QgdmFsdWVFeHByID0gdGhpcy5nZXREaXJlY3RpdmVCb3VuZFRhcmdldCgpO1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKGtleVNwYW4uc3RhcnQsIHRoaXMuaW5wdXRJbmRleCk7XG4gICAgYmluZGluZ3MucHVzaChuZXcgVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICBzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBrZXksIGZhbHNlIC8qIGtleUlzVmFyICovLCB2YWx1ZUV4cHI/LnNvdXJjZSB8fCAnJywgdmFsdWVFeHByKSk7XG4gICAgLy8gVGhlIGJpbmRpbmcgY291bGQgb3B0aW9uYWxseSBiZSBmb2xsb3dlZCBieSBcImFzXCIuIEZvciBleGFtcGxlLFxuICAgIC8vICpuZ0lmPVwiY29uZCB8IHBpcGUgYXMgeFwiLiBJbiB0aGlzIGNhc2UsIHRoZSBrZXkgaW4gdGhlIFwiYXNcIiBiaW5kaW5nXG4gICAgLy8gaXMgXCJ4XCIgYW5kIHRoZSB2YWx1ZSBpcyB0aGUgdGVtcGxhdGUga2V5IGl0c2VsZiAoXCJuZ0lmXCIpLiBOb3RlIHRoYXQgdGhlXG4gICAgLy8gJ2tleScgaW4gdGhlIGN1cnJlbnQgY29udGV4dCBub3cgYmVjb21lcyB0aGUgXCJ2YWx1ZVwiIGluIHRoZSBuZXh0IGJpbmRpbmcuXG4gICAgY29uc3QgYXNCaW5kaW5nID0gdGhpcy5wYXJzZUFzQmluZGluZyhrZXksIGtleVNwYW4sIGFic29sdXRlT2Zmc2V0KTtcbiAgICBpZiAoYXNCaW5kaW5nKSB7XG4gICAgICBiaW5kaW5ncy5wdXNoKGFzQmluZGluZyk7XG4gICAgfVxuICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICByZXR1cm4gYmluZGluZ3M7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBleHByZXNzaW9uIEFTVCBmb3IgdGhlIGJvdW5kIHRhcmdldCBvZiBhIGRpcmVjdGl2ZSBrZXl3b3JkXG4gICAqIGJpbmRpbmcuIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogKm5nSWY9XCJjb25kaXRpb24gfCBwaXBlXCIuXG4gICAqICAgICAgICBeXl5eXl5eXl5eXl5eXl5eIGJvdW5kIHRhcmdldCBmb3IgXCJuZ0lmXCJcbiAgICogKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIlxuICAgKiAgICAgICAgICAgICAgICAgICAgIF5eXl5eIGJvdW5kIHRhcmdldCBmb3IgXCJuZ0Zvck9mXCJcbiAgICogYGBgXG4gICAqL1xuICBwcml2YXRlIGdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgaWYgKHRoaXMubmV4dCA9PT0gRU9GIHx8IHRoaXMucGVla0tleXdvcmRBcygpIHx8IHRoaXMucGVla0tleXdvcmRMZXQoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGFzdCA9IHRoaXMucGFyc2VQaXBlKCk7ICAvLyBleGFtcGxlOiBcImNvbmRpdGlvbiB8IGFzeW5jXCJcbiAgICBjb25zdCB7c3RhcnQsIGVuZH0gPSBhc3Quc3BhbjtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIHZhbHVlLCB0aGlzLmxvY2F0aW9uLCB0aGlzLmFic29sdXRlT2Zmc2V0ICsgc3RhcnQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGJpbmRpbmcgZm9yIGEgdmFyaWFibGUgZGVjbGFyZWQgdXNpbmcgYGFzYC4gTm90ZSB0aGF0IHRoZSBvcmRlclxuICAgKiBvZiB0aGUga2V5LXZhbHVlIHBhaXIgaW4gdGhpcyBkZWNsYXJhdGlvbiBpcyByZXZlcnNlZC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtczsgaW5kZXggYXMgaVwiXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIF5eXl5eICAgIF5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgICAga2V5XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgbmFtZSBvZiB0aGUgdmFsdWUgaW4gdGhlIGRlY2xhcmF0aW9uLCBcIm5nSWZcIiBpbiB0aGUgZXhhbXBsZSBhYm92ZVxuICAgKiBAcGFyYW0gdmFsdWVTcGFuIHNwYW4gb2YgdGhlIHZhbHVlIGluIHRoZSBkZWNsYXJhdGlvblxuICAgKiBAcGFyYW0gYWJzb2x1dGVPZmZzZXQgYWJzb2x1dGUgb2Zmc2V0IG9mIGB2YWx1ZWBcbiAgICovXG4gIHByaXZhdGUgcGFyc2VBc0JpbmRpbmcodmFsdWU6IHN0cmluZywgdmFsdWVTcGFuOiBQYXJzZVNwYW4sIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOlxuICAgICAgVGVtcGxhdGVCaW5kaW5nfG51bGwge1xuICAgIGlmICghdGhpcy5wZWVrS2V5d29yZEFzKCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIGNvbnN1bWUgdGhlICdhcycga2V5d29yZFxuICAgIGNvbnN0IHtrZXl9ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICBjb25zdCB2YWx1ZUFzdCA9IG5ldyBBU1QodmFsdWVTcGFuLCB2YWx1ZVNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCkpO1xuICAgIGNvbnN0IHZhbHVlRXhwciA9IG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICB2YWx1ZUFzdCwgdmFsdWUsIHRoaXMubG9jYXRpb24sIGFic29sdXRlT2Zmc2V0ICsgdmFsdWVTcGFuLnN0YXJ0LCB0aGlzLmVycm9ycyk7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4odmFsdWVTcGFuLnN0YXJ0LCB0aGlzLmlucHV0SW5kZXgpO1xuICAgIHJldHVybiBuZXcgVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICBzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBrZXksIHRydWUgLyoga2V5SXNWYXIgKi8sIHZhbHVlLCB2YWx1ZUV4cHIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYmluZGluZyBmb3IgYSB2YXJpYWJsZSBkZWNsYXJlZCB1c2luZyBgbGV0YC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtczsgbGV0IGk9aW5kZXg7XCJcbiAgICogICAgICAgICBeXl5eXl5eXiAgICAgICAgICAgXl5eXl5eXl5eXl5cbiAgICogYGBgXG4gICAqIEluIHRoZSBmaXJzdCBiaW5kaW5nLCBgaXRlbWAgaXMgYm91bmQgdG8gYE5nRm9yT2ZDb250ZXh0LiRpbXBsaWNpdGAuXG4gICAqIEluIHRoZSBzZWNvbmQgYmluZGluZywgYGlgIGlzIGJvdW5kIHRvIGBOZ0Zvck9mQ29udGV4dC5pbmRleGAuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlTGV0QmluZGluZygpOiBUZW1wbGF0ZUJpbmRpbmd8bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBlZWtLZXl3b3JkTGV0KCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzcGFuU3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBjb25zdW1lIHRoZSAnbGV0JyBrZXl3b3JkXG4gICAgY29uc3Qge2tleX0gPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIGxldCB2YWx1ZUV4cHI6IEFTVFdpdGhTb3VyY2V8bnVsbCA9IG51bGw7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgY29uc3Qge2tleTogdmFsdWUsIGtleVNwYW46IHZhbHVlU3Bhbn0gPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgICAgY29uc3QgYXN0ID0gbmV3IEFTVCh2YWx1ZVNwYW4sIHZhbHVlU3Bhbi50b0Fic29sdXRlKHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcbiAgICAgIHZhbHVlRXhwciA9IG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICAgIGFzdCwgdmFsdWUsIHRoaXMubG9jYXRpb24sIHRoaXMuYWJzb2x1dGVPZmZzZXQgKyB2YWx1ZVNwYW4uc3RhcnQsIHRoaXMuZXJyb3JzKTtcbiAgICB9XG4gICAgY29uc3Qgc3BhbkVuZCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbihzcGFuU3RhcnQsIHNwYW5FbmQpO1xuICAgIHJldHVybiBuZXcgVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICBzcGFuLCBzcGFuLnRvQWJzb2x1dGUodGhpcy5hYnNvbHV0ZU9mZnNldCksIGtleSwgdHJ1ZSAvKiBrZXlJc1ZhciAqLywgdmFsdWVFeHByPy5zb3VyY2UgfHwgJyRpbXBsaWNpdCcsIHZhbHVlRXhwcik7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3VtZSB0aGUgb3B0aW9uYWwgc3RhdGVtZW50IHRlcm1pbmF0b3I6IHNlbWljb2xvbiBvciBjb21tYS5cbiAgICovXG4gIHByaXZhdGUgY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKSB7XG4gICAgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgfHwgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKTtcbiAgfVxuXG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgaW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCkge1xuICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlckVycm9yKG1lc3NhZ2UsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KGluZGV4KSwgdGhpcy5sb2NhdGlvbikpO1xuICAgIHRoaXMuc2tpcCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2NhdGlvblRleHQoaW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCkge1xuICAgIGlmIChpbmRleCA9PSBudWxsKSBpbmRleCA9IHRoaXMuaW5kZXg7XG4gICAgcmV0dXJuIChpbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkgPyBgYXQgY29sdW1uICR7dGhpcy50b2tlbnNbaW5kZXhdLmluZGV4ICsgMX0gaW5gIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBhdCB0aGUgZW5kIG9mIHRoZSBleHByZXNzaW9uYDtcbiAgfVxuXG4gIC8vIEVycm9yIHJlY292ZXJ5IHNob3VsZCBza2lwIHRva2VucyB1bnRpbCBpdCBlbmNvdW50ZXJzIGEgcmVjb3ZlcnkgcG9pbnQuIHNraXAoKSB0cmVhdHNcbiAgLy8gdGhlIGVuZCBvZiBpbnB1dCBhbmQgYSAnOycgYXMgdW5jb25kaXRpb25hbGx5IGEgcmVjb3ZlcnkgcG9pbnQuIEl0IGFsc28gdHJlYXRzICcpJyxcbiAgLy8gJ30nIGFuZCAnXScgYXMgY29uZGl0aW9uYWwgcmVjb3ZlcnkgcG9pbnRzIGlmIG9uZSBvZiBjYWxsaW5nIHByb2R1Y3Rpb25zIGlzIGV4cGVjdGluZ1xuICAvLyBvbmUgb2YgdGhlc2Ugc3ltYm9scy4gVGhpcyBhbGxvd3Mgc2tpcCgpIHRvIHJlY292ZXIgZnJvbSBlcnJvcnMgc3VjaCBhcyAnKGEuKSArIDEnIGFsbG93aW5nXG4gIC8vIG1vcmUgb2YgdGhlIEFTVCB0byBiZSByZXRhaW5lZCAoaXQgZG9lc24ndCBza2lwIGFueSB0b2tlbnMgYXMgdGhlICcpJyBpcyByZXRhaW5lZCBiZWNhdXNlXG4gIC8vIG9mIHRoZSAnKCcgYmVnaW5zIGFuICcoJyA8ZXhwcj4gJyknIHByb2R1Y3Rpb24pLiBUaGUgcmVjb3ZlcnkgcG9pbnRzIG9mIGdyb3VwaW5nIHN5bWJvbHNcbiAgLy8gbXVzdCBiZSBjb25kaXRpb25hbCBhcyB0aGV5IG11c3QgYmUgc2tpcHBlZCBpZiBub25lIG9mIHRoZSBjYWxsaW5nIHByb2R1Y3Rpb25zIGFyZSBub3RcbiAgLy8gZXhwZWN0aW5nIHRoZSBjbG9zaW5nIHRva2VuIGVsc2Ugd2Ugd2lsbCBuZXZlciBtYWtlIHByb2dyZXNzIGluIHRoZSBjYXNlIG9mIGFuXG4gIC8vIGV4dHJhbmVvdXMgZ3JvdXAgY2xvc2luZyBzeW1ib2wgKHN1Y2ggYXMgYSBzdHJheSAnKScpLiBUaGlzIGlzIG5vdCB0aGUgY2FzZSBmb3IgJzsnIGJlY2F1c2VcbiAgLy8gcGFyc2VDaGFpbigpIGlzIGFsd2F5cyB0aGUgcm9vdCBwcm9kdWN0aW9uIGFuZCBpdCBleHBlY3RzIGEgJzsnLlxuXG4gIC8vIElmIGEgcHJvZHVjdGlvbiBleHBlY3RzIG9uZSBvZiB0aGVzZSB0b2tlbiBpdCBpbmNyZW1lbnRzIHRoZSBjb3JyZXNwb25kaW5nIG5lc3RpbmcgY291bnQsXG4gIC8vIGFuZCB0aGVuIGRlY3JlbWVudHMgaXQganVzdCBwcmlvciB0byBjaGVja2luZyBpZiB0aGUgdG9rZW4gaXMgaW4gdGhlIGlucHV0LlxuICBwcml2YXRlIHNraXAoKSB7XG4gICAgbGV0IG4gPSB0aGlzLm5leHQ7XG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggJiYgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgJiZcbiAgICAgICAgICAgKHRoaXMucnBhcmVuc0V4cGVjdGVkIDw9IDAgfHwgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikpICYmXG4gICAgICAgICAgICh0aGlzLnJicmFjZXNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2tldHNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCkpKSB7XG4gICAgICBpZiAodGhpcy5uZXh0LmlzRXJyb3IoKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihcbiAgICAgICAgICAgIHRoaXMubmV4dC50b1N0cmluZygpICEsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KCksIHRoaXMubG9jYXRpb24pKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbiA9IHRoaXMubmV4dDtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IFNhZmVQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBGdW5jdGlvbkNhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KSB7IHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKTsgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSkgeyB0aGlzLnZpc2l0QWxsKGFzdC52YWx1ZXMpOyB9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KSB7IHRoaXMuZXJyb3JzLnB1c2goJ3BpcGVzJyk7IH1cblxuICB2aXNpdEtleWVkUmVhZChhc3Q6IEtleWVkUmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEFsbChhc3RzOiBhbnlbXSk6IGFueVtdIHsgcmV0dXJuIGFzdHMubWFwKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7IH1cblxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSkge31cbn1cblxuLyoqXG4gKiBUaGlzIGNsYXNzIGV4dGVuZHMgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgdXNlZCBpbiBWaWV3IEVuZ2luZSBhbmQgcGVyZm9ybXMgbW9yZSBzdHJpY3QgY2hlY2tzIHRvXG4gKiBtYWtlIHN1cmUgaG9zdCBiaW5kaW5ncyBkbyBub3QgY29udGFpbiBwaXBlcy4gSW4gVmlldyBFbmdpbmUsIGhhdmluZyBwaXBlcyBpbiBob3N0IGJpbmRpbmdzIGlzXG4gKiBub3Qgc3VwcG9ydGVkIGFzIHdlbGwsIGJ1dCBpbiBzb21lIGNhc2VzIChsaWtlIGAhKHZhbHVlIHwgYXN5bmMpYCkgdGhlIGVycm9yIGlzIG5vdCB0cmlnZ2VyZWQgYXRcbiAqIGNvbXBpbGUgdGltZS4gSW4gb3JkZXIgdG8gcHJlc2VydmUgVmlldyBFbmdpbmUgYmVoYXZpb3IsIG1vcmUgc3RyaWN0IGNoZWNrcyBhcmUgaW50cm9kdWNlZCBmb3JcbiAqIEl2eSBtb2RlIG9ubHkuXG4gKi9cbmNsYXNzIEl2eVNpbXBsZUV4cHJlc3Npb25DaGVja2VyIGV4dGVuZHMgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIge1xuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KSB7XG4gICAgYXN0LmxlZnQudmlzaXQodGhpcyk7XG4gICAgYXN0LnJpZ2h0LnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXRQcmVmaXhOb3QoYXN0OiBQcmVmaXhOb3QsIGNvbnRleHQ6IGFueSkgeyBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzKTsgfVxufVxuIl19