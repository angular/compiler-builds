/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as chars from '../chars';
import { DEFAULT_INTERPOLATION_CONFIG } from '../ml_parser/interpolation_config';
import { escapeRegExp } from '../util';
import { AbsoluteSourceSpan, ASTWithSource, Binary, BindingPipe, Chain, Conditional, EmptyExpr, ExpressionBinding, FunctionCall, ImplicitReceiver, Interpolation, KeyedRead, KeyedWrite, LiteralArray, LiteralMap, LiteralPrimitive, MethodCall, NonNullAssert, ParserError, ParseSpan, PrefixNot, PropertyRead, PropertyWrite, Quote, RecursiveAstVisitor, SafeMethodCall, SafePropertyRead, ThisReceiver, Unary, VariableBinding } from './ast';
import { EOF, isIdentifier, isQuote, TokenType } from './lexer';
export class SplitInterpolation {
    constructor(strings, stringSpans, expressions, expressionsSpans, offsets) {
        this.strings = strings;
        this.stringSpans = stringSpans;
        this.expressions = expressions;
        this.expressionsSpans = expressionsSpans;
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
     *         ^      ^ absoluteValueOffset for `templateValue`
     *         absoluteKeyOffset for `templateKey`
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
     * @param absoluteKeyOffset start of the `templateKey`
     * @param absoluteValueOffset start of the `templateValue`
     */
    parseTemplateBindings(templateKey, templateValue, templateUrl, absoluteKeyOffset, absoluteValueOffset) {
        const tokens = this._lexer.tokenize(templateValue);
        const parser = new _ParseAST(templateValue, templateUrl, absoluteValueOffset, tokens, templateValue.length, false /* parseAction */, this.errors, 0 /* relative offset */);
        return parser.parseTemplateBindings({
            source: templateKey,
            span: new AbsoluteSourceSpan(absoluteKeyOffset, absoluteKeyOffset + templateKey.length),
        });
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
        return this.createInterpolationAst(split.strings, expressions, input, location, absoluteOffset);
    }
    /**
     * Similar to `parseInterpolation`, but treats the provided string as a single expression
     * element that would normally appear within the interpolation prefix and suffix (`{{` and `}}`).
     * This is used for parsing the switch expression in ICUs.
     */
    parseInterpolationExpression(expression, location, absoluteOffset) {
        const sourceToLex = this._stripComments(expression);
        const tokens = this._lexer.tokenize(sourceToLex);
        const ast = new _ParseAST(expression, location, absoluteOffset, tokens, sourceToLex.length, 
        /* parseAction */ false, this.errors, 0)
            .parseChain();
        const strings = ['', '']; // The prefix and suffix strings are both empty
        return this.createInterpolationAst(strings, [ast], expression, location, absoluteOffset);
    }
    createInterpolationAst(strings, expressions, input, location, absoluteOffset) {
        const span = new ParseSpan(0, input.length);
        const interpolation = new Interpolation(span, span.toAbsolute(absoluteOffset), strings, expressions);
        return new ASTWithSource(interpolation, input, location, absoluteOffset, this.errors);
    }
    /**
     * Splits a string of text into "raw" text segments and expressions present in interpolations in
     * the string.
     * Returns `null` if there are no interpolations, otherwise a
     * `SplitInterpolation` with splits that look like
     *   <raw text> <expression> <raw text> ... <raw text> <expression> <raw text>
     */
    splitInterpolation(input, location, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        const strings = [];
        const expressions = [];
        const offsets = [];
        const stringSpans = [];
        const expressionSpans = [];
        let i = 0;
        let atInterpolation = false;
        let extendLastString = false;
        let { start: interpStart, end: interpEnd } = interpolationConfig;
        while (i < input.length) {
            if (!atInterpolation) {
                // parse until starting {{
                const start = i;
                i = input.indexOf(interpStart, i);
                if (i === -1) {
                    i = input.length;
                }
                const part = input.substring(start, i);
                strings.push(part);
                stringSpans.push({ start, end: i });
                atInterpolation = true;
            }
            else {
                // parse from starting {{ to ending }}
                const fullStart = i;
                const exprStart = fullStart + interpStart.length;
                const exprEnd = input.indexOf(interpEnd, exprStart);
                if (exprEnd === -1) {
                    // Could not find the end of the interpolation; do not parse an expression.
                    // Instead we should extend the content on the last raw string.
                    atInterpolation = false;
                    extendLastString = true;
                    break;
                }
                const fullEnd = exprEnd + interpEnd.length;
                const part = input.substring(exprStart, exprEnd);
                if (part.trim().length > 0) {
                    expressions.push(part);
                }
                else {
                    this._reportError('Blank expressions are not allowed in interpolated strings', input, `at column ${i} in`, location);
                    expressions.push('$implicit');
                }
                offsets.push(exprStart);
                expressionSpans.push({ start: fullStart, end: fullEnd });
                i = fullEnd;
                atInterpolation = false;
            }
        }
        if (!atInterpolation) {
            // If we are now at a text section, add the remaining content as a raw string.
            if (extendLastString) {
                strings[strings.length - 1] += input.substring(i);
                stringSpans[stringSpans.length - 1].end = input.length;
            }
            else {
                strings.push(input.substring(i));
                stringSpans.push({ start: i, end: input.length });
            }
        }
        return expressions.length === 0 ?
            null :
            new SplitInterpolation(strings, stringSpans, expressions, expressionSpans, offsets);
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
/** Describes a stateful context an expression parser is in. */
var ParseContextFlags;
(function (ParseContextFlags) {
    ParseContextFlags[ParseContextFlags["None"] = 0] = "None";
    /**
     * A Writable context is one in which a value may be written to an lvalue.
     * For example, after we see a property access, we may expect a write to the
     * property via the "=" operator.
     *   prop
     *        ^ possible "=" after
     */
    ParseContextFlags[ParseContextFlags["Writable"] = 1] = "Writable";
})(ParseContextFlags || (ParseContextFlags = {}));
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
        this.context = ParseContextFlags.None;
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
    get next() {
        return this.peek(0);
    }
    /** Whether all the parser input has been processed. */
    get atEOF() {
        return this.index >= this.tokens.length;
    }
    /**
     * Index of the next token to be processed, or the end of the last token if all have been
     * processed.
     */
    get inputIndex() {
        return this.atEOF ? this.currentEndIndex : this.next.index + this.offset;
    }
    /**
     * End index of the last processed token, or the start of the first token if none have been
     * processed.
     */
    get currentEndIndex() {
        if (this.index > 0) {
            const curToken = this.peek(-1);
            return curToken.end + this.offset;
        }
        // No tokens have been processed yet; return the next token's start or the length of the input
        // if there is no token.
        if (this.tokens.length === 0) {
            return this.inputLength + this.offset;
        }
        return this.next.index + this.offset;
    }
    /**
     * Returns the absolute offset of the start of the current token.
     */
    get currentAbsoluteOffset() {
        return this.absoluteOffset + this.inputIndex;
    }
    span(start) {
        return new ParseSpan(start, this.currentEndIndex);
    }
    sourceSpan(start) {
        const serial = `${start}@${this.inputIndex}`;
        if (!this.sourceSpanCache.has(serial)) {
            this.sourceSpanCache.set(serial, this.span(start).toAbsolute(this.absoluteOffset));
        }
        return this.sourceSpanCache.get(serial);
    }
    advance() {
        this.index++;
    }
    /**
     * Executes a callback in the provided context.
     */
    withContext(context, cb) {
        this.context |= context;
        const ret = cb();
        this.context ^= context;
        return ret;
    }
    consumeOptionalCharacter(code) {
        if (this.next.isCharacter(code)) {
            this.advance();
            return true;
        }
        else {
            return false;
        }
    }
    peekKeywordLet() {
        return this.next.isKeywordLet();
    }
    peekKeywordAs() {
        return this.next.isKeywordAs();
    }
    /**
     * Consumes an expected character, otherwise emits an error about the missing expected character
     * and skips over the token stream until reaching a recoverable point.
     *
     * See `this.error` and `this.skip` for more details.
     */
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
    prettyPrintToken(tok) {
        return tok === EOF ? 'end of input' : `token ${tok}`;
    }
    expectIdentifierOrKeyword() {
        const n = this.next;
        if (!n.isIdentifier() && !n.isKeyword()) {
            this.error(`Unexpected ${this.prettyPrintToken(n)}, expected identifier or keyword`);
            return '';
        }
        this.advance();
        return n.toString();
    }
    expectIdentifierOrKeywordOrString() {
        const n = this.next;
        if (!n.isIdentifier() && !n.isKeyword() && !n.isString()) {
            this.error(`Unexpected ${this.prettyPrintToken(n)}, expected identifier, keyword, or string`);
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
    parseExpression() {
        return this.parseConditional();
    }
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
            let result;
            switch (operator) {
                case '+':
                    this.advance();
                    result = this.parsePrefix();
                    return Unary.createPlus(this.span(start), this.sourceSpan(start), result);
                case '-':
                    this.advance();
                    result = this.parsePrefix();
                    return Unary.createMinus(this.span(start), this.sourceSpan(start), result);
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
                this.withContext(ParseContextFlags.Writable, () => {
                    this.rbracketsExpected++;
                    const key = this.parsePipe();
                    if (key instanceof EmptyExpr) {
                        this.error(`Key access cannot be empty`);
                    }
                    this.rbracketsExpected--;
                    this.expectCharacter(chars.$RBRACKET);
                    if (this.consumeOptionalOperator('=')) {
                        const value = this.parseConditional();
                        result = new KeyedWrite(this.span(resultStart), this.sourceSpan(resultStart), result, key, value);
                    }
                    else {
                        result =
                            new KeyedRead(this.span(resultStart), this.sourceSpan(resultStart), result, key);
                    }
                });
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
            return new ThisReceiver(this.span(start), this.sourceSpan(start));
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
        const nameStart = this.inputIndex;
        const id = this.withContext(ParseContextFlags.Writable, () => {
            const id = this.expectIdentifierOrKeyword();
            if (id.length === 0) {
                this.error(`Expected identifier for property access`, receiver.span.end);
            }
            return id;
        });
        const nameSpan = this.sourceSpan(nameStart);
        if (this.consumeOptionalCharacter(chars.$LPAREN)) {
            this.rparensExpected++;
            const args = this.parseCallArguments();
            this.expectCharacter(chars.$RPAREN);
            this.rparensExpected--;
            const span = this.span(start);
            const sourceSpan = this.sourceSpan(start);
            return isSafe ? new SafeMethodCall(span, sourceSpan, nameSpan, receiver, id, args) :
                new MethodCall(span, sourceSpan, nameSpan, receiver, id, args);
        }
        else {
            if (isSafe) {
                if (this.consumeOptionalOperator('=')) {
                    this.error('The \'?.\' operator cannot be used in the assignment');
                    return new EmptyExpr(this.span(start), this.sourceSpan(start));
                }
                else {
                    return new SafePropertyRead(this.span(start), this.sourceSpan(start), nameSpan, receiver, id);
                }
            }
            else {
                if (this.consumeOptionalOperator('=')) {
                    if (!this.parseAction) {
                        this.error('Bindings cannot contain assignments');
                        return new EmptyExpr(this.span(start), this.sourceSpan(start));
                    }
                    const value = this.parseConditional();
                    return new PropertyWrite(this.span(start), this.sourceSpan(start), nameSpan, receiver, id, value);
                }
                else {
                    return new PropertyRead(this.span(start), this.sourceSpan(start), nameSpan, receiver, id);
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
     * Parses an identifier, a keyword, a string with an optional `-` in between,
     * and returns the string along with its absolute source span.
     */
    expectTemplateBindingKey() {
        let result = '';
        let operatorFound = false;
        const start = this.currentAbsoluteOffset;
        do {
            result += this.expectIdentifierOrKeywordOrString();
            operatorFound = this.consumeOptionalOperator('-');
            if (operatorFound) {
                result += '-';
            }
        } while (operatorFound);
        return {
            source: result,
            span: new AbsoluteSourceSpan(start, start + result.length),
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
     * @param templateKey name of the microsyntax directive, like ngIf, ngFor,
     * without the *, along with its absolute span.
     */
    parseTemplateBindings(templateKey) {
        const bindings = [];
        // The first binding is for the template key itself
        // In *ngFor="let item of items", key = "ngFor", value = null
        // In *ngIf="cond | pipe", key = "ngIf", value = "cond | pipe"
        bindings.push(...this.parseDirectiveKeywordBindings(templateKey));
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
                const key = this.expectTemplateBindingKey();
                // Peek at the next token, if it is "as" then this must be variable
                // declaration.
                const binding = this.parseAsBinding(key);
                if (binding) {
                    bindings.push(binding);
                }
                else {
                    // Otherwise the key must be a directive keyword, like "of". Transform
                    // the key to actual key. Eg. of -> ngForOf, trackBy -> ngForTrackBy
                    key.source = templateKey.source + key.source[0].toUpperCase() + key.source.substring(1);
                    bindings.push(...this.parseDirectiveKeywordBindings(key));
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
     *   *ngFor="let item of items | slice:0:1 as collection".
     *                    ^^ ^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^
     *               keyword    bound target   optional 'as' binding
     * ```
     *
     * @param key binding key, for example, ngFor, ngIf, ngForOf, along with its
     * absolute span.
     */
    parseDirectiveKeywordBindings(key) {
        const bindings = [];
        this.consumeOptionalCharacter(chars.$COLON); // trackBy: trackByFunction
        const value = this.getDirectiveBoundTarget();
        let spanEnd = this.currentAbsoluteOffset;
        // The binding could optionally be followed by "as". For example,
        // *ngIf="cond | pipe as x". In this case, the key in the "as" binding
        // is "x" and the value is the template key itself ("ngIf"). Note that the
        // 'key' in the current context now becomes the "value" in the next binding.
        const asBinding = this.parseAsBinding(key);
        if (!asBinding) {
            this.consumeStatementTerminator();
            spanEnd = this.currentAbsoluteOffset;
        }
        const sourceSpan = new AbsoluteSourceSpan(key.span.start, spanEnd);
        bindings.push(new ExpressionBinding(sourceSpan, key, value));
        if (asBinding) {
            bindings.push(asBinding);
        }
        return bindings;
    }
    /**
     * Return the expression AST for the bound target of a directive keyword
     * binding. For example,
     * ```
     *   *ngIf="condition | pipe"
     *          ^^^^^^^^^^^^^^^^ bound target for "ngIf"
     *   *ngFor="let item of items"
     *                       ^^^^^ bound target for "ngForOf"
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
     *   *ngFor="let item of items; index as i"
     *                              ^^^^^    ^
     *                              value    key
     * ```
     *
     * @param value name of the value in the declaration, "ngIf" in the example
     * above, along with its absolute span.
     */
    parseAsBinding(value) {
        if (!this.peekKeywordAs()) {
            return null;
        }
        this.advance(); // consume the 'as' keyword
        const key = this.expectTemplateBindingKey();
        this.consumeStatementTerminator();
        const sourceSpan = new AbsoluteSourceSpan(value.span.start, this.currentAbsoluteOffset);
        return new VariableBinding(sourceSpan, key, value);
    }
    /**
     * Return the binding for a variable declared using `let`. For example,
     * ```
     *   *ngFor="let item of items; let i=index;"
     *           ^^^^^^^^           ^^^^^^^^^^^
     * ```
     * In the first binding, `item` is bound to `NgForOfContext.$implicit`.
     * In the second binding, `i` is bound to `NgForOfContext.index`.
     */
    parseLetBinding() {
        if (!this.peekKeywordLet()) {
            return null;
        }
        const spanStart = this.currentAbsoluteOffset;
        this.advance(); // consume the 'let' keyword
        const key = this.expectTemplateBindingKey();
        let value = null;
        if (this.consumeOptionalOperator('=')) {
            value = this.expectTemplateBindingKey();
        }
        this.consumeStatementTerminator();
        const sourceSpan = new AbsoluteSourceSpan(spanStart, this.currentAbsoluteOffset);
        return new VariableBinding(sourceSpan, key, value);
    }
    /**
     * Consume the optional statement terminator: semicolon or comma.
     */
    consumeStatementTerminator() {
        this.consumeOptionalCharacter(chars.$SEMICOLON) || this.consumeOptionalCharacter(chars.$COMMA);
    }
    /**
     * Records an error and skips over the token stream until reaching a recoverable point. See
     * `this.skip` for more details on token skipping.
     */
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
    /**
     * Error recovery should skip tokens until it encounters a recovery point.
     *
     * The following are treated as unconditional recovery points:
     *   - end of input
     *   - ';' (parseChain() is always the root production, and it expects a ';')
     *   - '|' (since pipes may be chained and each pipe expression may be treated independently)
     *
     * The following are conditional recovery points:
     *   - ')', '}', ']' if one of calling productions is expecting one of these symbols
     *     - This allows skip() to recover from errors such as '(a.) + 1' allowing more of the AST to
     *       be retained (it doesn't skip any tokens as the ')' is retained because of the '(' begins
     *       an '(' <expr> ')' production).
     *       The recovery points of grouping symbols must be conditional as they must be skipped if
     *       none of the calling productions are not expecting the closing token else we will never
     *       make progress in the case of an extraneous group closing symbol (such as a stray ')').
     *       That is, we skip a closing symbol if we are not in a grouping production.
     *   - '=' in a `Writable` context
     *     - In this context, we are able to recover after seeing the `=` operator, which
     *       signals the presence of an independent rvalue expression following the `=` operator.
     *
     * If a production expects one of these token it increments the corresponding nesting count,
     * and then decrements it just prior to checking if the token is in the input.
     */
    skip() {
        let n = this.next;
        while (this.index < this.tokens.length && !n.isCharacter(chars.$SEMICOLON) &&
            !n.isOperator('|') && (this.rparensExpected <= 0 || !n.isCharacter(chars.$RPAREN)) &&
            (this.rbracesExpected <= 0 || !n.isCharacter(chars.$RBRACE)) &&
            (this.rbracketsExpected <= 0 || !n.isCharacter(chars.$RBRACKET)) &&
            (!(this.context & ParseContextFlags.Writable) || !n.isOperator('='))) {
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
    visitThisReceiver(ast, context) { }
    visitInterpolation(ast, context) { }
    visitLiteralPrimitive(ast, context) { }
    visitPropertyRead(ast, context) { }
    visitPropertyWrite(ast, context) { }
    visitSafePropertyRead(ast, context) { }
    visitMethodCall(ast, context) { }
    visitSafeMethodCall(ast, context) { }
    visitFunctionCall(ast, context) { }
    visitLiteralArray(ast, context) {
        this.visitAll(ast.expressions, context);
    }
    visitLiteralMap(ast, context) {
        this.visitAll(ast.values, context);
    }
    visitUnary(ast, context) { }
    visitBinary(ast, context) { }
    visitPrefixNot(ast, context) { }
    visitNonNullAssert(ast, context) { }
    visitConditional(ast, context) { }
    visitPipe(ast, context) {
        this.errors.push('pipes');
    }
    visitKeyedRead(ast, context) { }
    visitKeyedWrite(ast, context) { }
    visitAll(asts, context) {
        return asts.map(node => node.visit(this, context));
    }
    visitChain(ast, context) { }
    visitQuote(ast, context) { }
}
/**
 * This class implements SimpleExpressionChecker used in View Engine and performs more strict checks
 * to make sure host bindings do not contain pipes. In View Engine, having pipes in host bindings is
 * not supported as well, but in some cases (like `!(value | async)`) the error is not triggered at
 * compile time. In order to preserve View Engine behavior, more strict checks are introduced for
 * Ivy mode only.
 */
class IvySimpleExpressionChecker extends RecursiveAstVisitor {
    constructor() {
        super(...arguments);
        this.errors = [];
    }
    visitPipe() {
        this.errors.push('pipes');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sbUNBQW1DLENBQUM7QUFDcEcsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVyQyxPQUFPLEVBQUMsa0JBQWtCLEVBQW1CLGFBQWEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFpQixnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBOEMsWUFBWSxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDNWYsT0FBTyxFQUFDLEdBQUcsRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFnQixTQUFTLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFFNUUsTUFBTSxPQUFPLGtCQUFrQjtJQUM3QixZQUNXLE9BQWlCLEVBQVMsV0FBMkMsRUFDckUsV0FBcUIsRUFBUyxnQkFBZ0QsRUFDOUUsT0FBaUI7UUFGakIsWUFBTyxHQUFQLE9BQU8sQ0FBVTtRQUFTLGdCQUFXLEdBQVgsV0FBVyxDQUFnQztRQUNyRSxnQkFBVyxHQUFYLFdBQVcsQ0FBVTtRQUFTLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBZ0M7UUFDOUUsWUFBTyxHQUFQLE9BQU8sQ0FBVTtJQUFHLENBQUM7Q0FDakM7QUFFRCxNQUFNLE9BQU8sMEJBQTBCO0lBQ3JDLFlBQ1csZ0JBQW1DLEVBQVMsUUFBa0IsRUFDOUQsTUFBcUI7UUFEckIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFtQjtRQUFTLGFBQVEsR0FBUixRQUFRLENBQVU7UUFDOUQsV0FBTSxHQUFOLE1BQU0sQ0FBZTtJQUFHLENBQUM7Q0FDckM7QUFFRCxNQUFNLHdCQUF3QixHQUFHLHdCQUF3QixDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFDeEYsU0FBUyxxQkFBcUIsQ0FBQyxNQUEyQjtJQUN4RCxJQUFJLE1BQU0sS0FBSyw0QkFBNEIsRUFBRTtRQUMzQyxPQUFPLHdCQUF3QixDQUFDO0tBQ2pDO1NBQU07UUFDTCxPQUFPLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ3pDO0FBQ0gsQ0FBQztBQUVELFNBQVMsd0JBQXdCLENBQUMsTUFBMkI7SUFDM0QsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxjQUFjLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN2RixPQUFPLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBRUQsTUFBTSxPQUFPLE1BQU07SUFHakIsWUFBb0IsTUFBYTtRQUFiLFdBQU0sR0FBTixNQUFNLENBQU87UUFGekIsV0FBTSxHQUFrQixFQUFFLENBQUM7UUFJbkMsNEJBQXVCLEdBQUcsdUJBQXVCLENBQUM7SUFGZCxDQUFDO0lBSXJDLFdBQVcsQ0FDUCxLQUFhLEVBQUUsUUFBYSxFQUFFLGNBQXNCLEVBQ3BELHNCQUEyQyw0QkFBNEI7UUFDekUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUNqRSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9DLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNoRSxNQUFNLEdBQUcsR0FBRyxJQUFJLFNBQVMsQ0FDVCxLQUFLLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFDOUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO2FBQ2pDLFVBQVUsRUFBRSxDQUFDO1FBQzlCLE9BQU8sSUFBSSxhQUFhLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRUQsWUFBWSxDQUNSLEtBQWEsRUFBRSxRQUFhLEVBQUUsY0FBc0IsRUFDcEQsc0JBQTJDLDRCQUE0QjtRQUN6RSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUN4RixPQUFPLElBQUksYUFBYSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDOUUsQ0FBQztJQUVPLHFCQUFxQixDQUFDLEdBQVE7UUFDcEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztRQUNuRCxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25CLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUN4QixDQUFDO0lBRUQsa0JBQWtCLENBQ2QsS0FBYSxFQUFFLFFBQWdCLEVBQUUsY0FBc0IsRUFDdkQsc0JBQTJDLDRCQUE0QjtRQUN6RSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUN4RixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDL0MsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNyQixJQUFJLENBQUMsWUFBWSxDQUNiLDBDQUEwQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQ3BGO1FBQ0QsT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFTyxZQUFZLENBQUMsT0FBZSxFQUFFLEtBQWEsRUFBRSxXQUFtQixFQUFFLFdBQWlCO1FBQ3pGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDOUUsQ0FBQztJQUVPLGdCQUFnQixDQUNwQixLQUFhLEVBQUUsUUFBZ0IsRUFBRSxjQUFzQixFQUN2RCxtQkFBd0M7UUFDMUMsNkVBQTZFO1FBQzdFLG9FQUFvRTtRQUNwRSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFaEUsSUFBSSxLQUFLLElBQUksSUFBSSxFQUFFO1lBQ2pCLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDakQsT0FBTyxJQUFJLFNBQVMsQ0FDVCxLQUFLLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFDL0UsS0FBSyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO2FBQ3hDLFVBQVUsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFTyxXQUFXLENBQUMsS0FBa0IsRUFBRSxRQUFhLEVBQUUsY0FBc0I7UUFDM0UsSUFBSSxLQUFLLElBQUksSUFBSTtZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQy9CLE1BQU0sb0JBQW9CLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoRCxJQUFJLG9CQUFvQixJQUFJLENBQUMsQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQzVDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLG9CQUFvQixDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUN2QyxNQUFNLHVCQUF1QixHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDMUUsTUFBTSxJQUFJLEdBQUcsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QyxPQUFPLElBQUksS0FBSyxDQUNaLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFLE1BQU0sRUFBRSx1QkFBdUIsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0F5Qkc7SUFDSCxxQkFBcUIsQ0FDakIsV0FBbUIsRUFBRSxhQUFxQixFQUFFLFdBQW1CLEVBQUUsaUJBQXlCLEVBQzFGLG1CQUEyQjtRQUM3QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRCxNQUFNLE1BQU0sR0FBRyxJQUFJLFNBQVMsQ0FDeEIsYUFBYSxFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDLE1BQU0sRUFDN0UsS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDbkUsT0FBTyxNQUFNLENBQUMscUJBQXFCLENBQUM7WUFDbEMsTUFBTSxFQUFFLFdBQVc7WUFDbkIsSUFBSSxFQUFFLElBQUksa0JBQWtCLENBQUMsaUJBQWlCLEVBQUUsaUJBQWlCLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztTQUN4RixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsa0JBQWtCLENBQ2QsS0FBYSxFQUFFLFFBQWEsRUFBRSxjQUFzQixFQUNwRCxzQkFBMkMsNEJBQTRCO1FBQ3pFLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDNUUsSUFBSSxLQUFLLElBQUksSUFBSTtZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRS9CLE1BQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztRQUU5QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7WUFDakQsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ3hELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sR0FBRyxHQUFHLElBQUksU0FBUyxDQUNULEtBQUssRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFDbEUsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7aUJBQzVFLFVBQVUsRUFBRSxDQUFDO1lBQzlCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDdkI7UUFFRCxPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ2xHLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsNEJBQTRCLENBQUMsVUFBa0IsRUFBRSxRQUFhLEVBQUUsY0FBc0I7UUFFcEYsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNwRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNqRCxNQUFNLEdBQUcsR0FBRyxJQUFJLFNBQVMsQ0FDVCxVQUFVLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU07UUFDaEUsaUJBQWlCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2FBQ3ZDLFVBQVUsRUFBRSxDQUFDO1FBQzlCLE1BQU0sT0FBTyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUUsK0NBQStDO1FBQzFFLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDM0YsQ0FBQztJQUVPLHNCQUFzQixDQUMxQixPQUFpQixFQUFFLFdBQWtCLEVBQUUsS0FBYSxFQUFFLFFBQWdCLEVBQ3RFLGNBQXNCO1FBQ3hCLE1BQU0sSUFBSSxHQUFHLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUMsTUFBTSxhQUFhLEdBQ2YsSUFBSSxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ25GLE9BQU8sSUFBSSxhQUFhLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsa0JBQWtCLENBQ2QsS0FBYSxFQUFFLFFBQWdCLEVBQy9CLHNCQUEyQyw0QkFBNEI7UUFFekUsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBQzdCLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztRQUNqQyxNQUFNLE9BQU8sR0FBYSxFQUFFLENBQUM7UUFDN0IsTUFBTSxXQUFXLEdBQW1DLEVBQUUsQ0FBQztRQUN2RCxNQUFNLGVBQWUsR0FBbUMsRUFBRSxDQUFDO1FBQzNELElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNWLElBQUksZUFBZSxHQUFHLEtBQUssQ0FBQztRQUM1QixJQUFJLGdCQUFnQixHQUFHLEtBQUssQ0FBQztRQUM3QixJQUFJLEVBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFDLEdBQUcsbUJBQW1CLENBQUM7UUFDL0QsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUN2QixJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwQiwwQkFBMEI7Z0JBQzFCLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQztnQkFDaEIsQ0FBQyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtvQkFDWixDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztpQkFDbEI7Z0JBQ0QsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25CLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQyxDQUFDLENBQUM7Z0JBRWxDLGVBQWUsR0FBRyxJQUFJLENBQUM7YUFDeEI7aUJBQU07Z0JBQ0wsc0NBQXNDO2dCQUN0QyxNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUM7Z0JBQ3BCLE1BQU0sU0FBUyxHQUFHLFNBQVMsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO2dCQUNqRCxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDcEQsSUFBSSxPQUFPLEtBQUssQ0FBQyxDQUFDLEVBQUU7b0JBQ2xCLDJFQUEyRTtvQkFDM0UsK0RBQStEO29CQUMvRCxlQUFlLEdBQUcsS0FBSyxDQUFDO29CQUN4QixnQkFBZ0IsR0FBRyxJQUFJLENBQUM7b0JBQ3hCLE1BQU07aUJBQ1A7Z0JBQ0QsTUFBTSxPQUFPLEdBQUcsT0FBTyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUM7Z0JBRTNDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO29CQUMxQixXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUN4QjtxQkFBTTtvQkFDTCxJQUFJLENBQUMsWUFBWSxDQUNiLDJEQUEyRCxFQUFFLEtBQUssRUFDbEUsYUFBYSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDbkMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztpQkFDL0I7Z0JBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDeEIsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBQyxDQUFDLENBQUM7Z0JBRXZELENBQUMsR0FBRyxPQUFPLENBQUM7Z0JBQ1osZUFBZSxHQUFHLEtBQUssQ0FBQzthQUN6QjtTQUNGO1FBQ0QsSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUNwQiw4RUFBOEU7WUFDOUUsSUFBSSxnQkFBZ0IsRUFBRTtnQkFDcEIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbEQsV0FBVyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7YUFDeEQ7aUJBQU07Z0JBQ0wsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsTUFBTSxFQUFDLENBQUMsQ0FBQzthQUNqRDtTQUNGO1FBQ0QsT0FBTyxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzdCLElBQUksQ0FBQyxDQUFDO1lBQ04sSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDMUYsQ0FBQztJQUVELG9CQUFvQixDQUFDLEtBQWtCLEVBQUUsUUFBYSxFQUFFLGNBQXNCO1FBQzVFLE1BQU0sSUFBSSxHQUFHLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxLQUFLLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoRSxPQUFPLElBQUksYUFBYSxDQUNwQixJQUFJLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQ25GLGNBQWMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVPLGNBQWMsQ0FBQyxLQUFhO1FBQ2xDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDcEMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQzFELENBQUM7SUFFTyxhQUFhLENBQUMsS0FBYTtRQUNqQyxJQUFJLFVBQVUsR0FBZ0IsSUFBSSxDQUFDO1FBQ25DLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN6QyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBRXpDLElBQUksSUFBSSxLQUFLLEtBQUssQ0FBQyxNQUFNLElBQUksUUFBUSxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksVUFBVSxJQUFJLElBQUk7Z0JBQUUsT0FBTyxDQUFDLENBQUM7WUFFdEYsSUFBSSxVQUFVLEtBQUssSUFBSSxFQUFFO2dCQUN2QixVQUFVLEdBQUcsSUFBSSxDQUFDO2FBQ25CO2lCQUFNLElBQUksVUFBVSxJQUFJLElBQUksSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzlDLFVBQVUsR0FBRyxJQUFJLENBQUM7YUFDbkI7U0FDRjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVPLHFCQUFxQixDQUN6QixLQUFhLEVBQUUsUUFBYSxFQUFFLG1CQUF3QztRQUN4RSxNQUFNLE1BQU0sR0FBRyxxQkFBcUIsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQzFELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEMsSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNwQixJQUFJLENBQUMsWUFBWSxDQUNiLHNCQUFzQixtQkFBbUIsQ0FBQyxLQUFLLEdBQzNDLG1CQUFtQixDQUFDLEdBQUcsaUNBQWlDLEVBQzVELEtBQUssRUFDTCxhQUFhLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLG1CQUFtQixDQUFDLEtBQUssRUFDbkYsUUFBUSxDQUFDLENBQUM7U0FDZjtJQUNILENBQUM7SUFFTyw2QkFBNkIsQ0FDakMsS0FBZSxFQUFFLFlBQW9CLEVBQUUsbUJBQXdDO1FBQ2pGLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztRQUNyQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3JDLFdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUN4QixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDVixHQUFHLG1CQUFtQixDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDekU7UUFFRCxPQUFPLFdBQVcsQ0FBQyxNQUFNLENBQUM7SUFDNUIsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFNBQVUsU0FBUSxNQUFNO0lBQXJDOztRQUNFLDRCQUF1QixHQUFHLDBCQUEwQixDQUFDLENBQUUsRUFBRTtJQUMzRCxDQUFDO0NBQUE7QUFFRCwrREFBK0Q7QUFDL0QsSUFBSyxpQkFVSjtBQVZELFdBQUssaUJBQWlCO0lBQ3BCLHlEQUFRLENBQUE7SUFDUjs7Ozs7O09BTUc7SUFDSCxpRUFBWSxDQUFBO0FBQ2QsQ0FBQyxFQVZJLGlCQUFpQixLQUFqQixpQkFBaUIsUUFVckI7QUFFRCxNQUFNLE9BQU8sU0FBUztJQWNwQixZQUNXLEtBQWEsRUFBUyxRQUFhLEVBQVMsY0FBc0IsRUFDbEUsTUFBZSxFQUFTLFdBQW1CLEVBQVMsV0FBb0IsRUFDdkUsTUFBcUIsRUFBVSxNQUFjO1FBRjlDLFVBQUssR0FBTCxLQUFLLENBQVE7UUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFLO1FBQVMsbUJBQWMsR0FBZCxjQUFjLENBQVE7UUFDbEUsV0FBTSxHQUFOLE1BQU0sQ0FBUztRQUFTLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQVM7UUFDdkUsV0FBTSxHQUFOLE1BQU0sQ0FBZTtRQUFVLFdBQU0sR0FBTixNQUFNLENBQVE7UUFoQmpELG9CQUFlLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLHNCQUFpQixHQUFHLENBQUMsQ0FBQztRQUN0QixvQkFBZSxHQUFHLENBQUMsQ0FBQztRQUNwQixZQUFPLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDO1FBRXpDLCtGQUErRjtRQUMvRiw2REFBNkQ7UUFDN0QsaUdBQWlHO1FBQ2pHLG1FQUFtRTtRQUMzRCxvQkFBZSxHQUFHLElBQUksR0FBRyxFQUE4QixDQUFDO1FBRWhFLFVBQUssR0FBVyxDQUFDLENBQUM7SUFLMEMsQ0FBQztJQUU3RCxJQUFJLENBQUMsTUFBYztRQUNqQixNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQztRQUM5QixPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0lBQ3ZELENBQUM7SUFFRCxJQUFJLElBQUk7UUFDTixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEIsQ0FBQztJQUVELHVEQUF1RDtJQUN2RCxJQUFJLEtBQUs7UUFDUCxPQUFPLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDMUMsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksVUFBVTtRQUNaLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUMzRSxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsSUFBSSxlQUFlO1FBQ2pCLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUU7WUFDbEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQy9CLE9BQU8sUUFBUSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1NBQ25DO1FBQ0QsOEZBQThGO1FBQzlGLHdCQUF3QjtRQUN4QixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUM1QixPQUFPLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztTQUN2QztRQUNELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUN2QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLHFCQUFxQjtRQUN2QixPQUFPLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztJQUMvQyxDQUFDO0lBRUQsSUFBSSxDQUFDLEtBQWE7UUFDaEIsT0FBTyxJQUFJLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRCxVQUFVLENBQUMsS0FBYTtRQUN0QixNQUFNLE1BQU0sR0FBRyxHQUFHLEtBQUssSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDN0MsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3JDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztTQUNwRjtRQUNELE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFFLENBQUM7SUFDM0MsQ0FBQztJQUVELE9BQU87UUFDTCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDZixDQUFDO0lBRUQ7O09BRUc7SUFDSyxXQUFXLENBQUksT0FBMEIsRUFBRSxFQUFXO1FBQzVELElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDO1FBQ3hCLE1BQU0sR0FBRyxHQUFHLEVBQUUsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDO1FBQ3hCLE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVELHdCQUF3QixDQUFDLElBQVk7UUFDbkMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUMvQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZixPQUFPLElBQUksQ0FBQztTQUNiO2FBQU07WUFDTCxPQUFPLEtBQUssQ0FBQztTQUNkO0lBQ0gsQ0FBQztJQUVELGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUNELGFBQWE7UUFDWCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsZUFBZSxDQUFDLElBQVk7UUFDMUIsSUFBSSxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDO1lBQUUsT0FBTztRQUNoRCxJQUFJLENBQUMsS0FBSyxDQUFDLG9CQUFvQixNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRUQsdUJBQXVCLENBQUMsRUFBVTtRQUNoQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQzVCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNmLE9BQU8sSUFBSSxDQUFDO1NBQ2I7YUFBTTtZQUNMLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7SUFDSCxDQUFDO0lBRUQsY0FBYyxDQUFDLFFBQWdCO1FBQzdCLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQztZQUFFLE9BQU87UUFDbkQsSUFBSSxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsR0FBVTtRQUN6QixPQUFPLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztJQUN2RCxDQUFDO0lBRUQseUJBQXlCO1FBQ3ZCLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDcEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRTtZQUN2QyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1lBQ3JGLE9BQU8sRUFBRSxDQUFDO1NBQ1g7UUFDRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsQ0FBQyxRQUFRLEVBQVksQ0FBQztJQUNoQyxDQUFDO0lBRUQsaUNBQWlDO1FBQy9CLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDcEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtZQUN4RCxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1lBQzlGLE9BQU8sRUFBRSxDQUFDO1NBQ1g7UUFDRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsQ0FBQyxRQUFRLEVBQVksQ0FBQztJQUNoQyxDQUFDO0lBRUQsVUFBVTtRQUNSLE1BQU0sS0FBSyxHQUFVLEVBQUUsQ0FBQztRQUN4QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQzlCLE9BQU8sSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDOUIsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVqQixJQUFJLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQ25ELElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO29CQUNyQixJQUFJLENBQUMsS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUM7aUJBQ3BFO2dCQUNELE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBRTtpQkFDdkQsQ0FBRSxzQkFBc0I7YUFDMUI7aUJBQU0sSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUMxQyxJQUFJLENBQUMsS0FBSyxDQUFDLHFCQUFxQixJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQzthQUMvQztTQUNGO1FBQ0QsSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUM7WUFBRSxPQUFPLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3RGLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDO1lBQUUsT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkMsT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVELFNBQVM7UUFDUCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDcEMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDckMsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO2dCQUNwQixJQUFJLENBQUMsS0FBSyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7YUFDMUQ7WUFFRCxHQUFHO2dCQUNELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7Z0JBQ2xDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO2dCQUM5QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUM1QyxNQUFNLElBQUksR0FBVSxFQUFFLENBQUM7Z0JBQ3ZCLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDbEQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQztpQkFDbkM7Z0JBQ0QsTUFBTSxFQUFDLEtBQUssRUFBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7Z0JBQzVCLE1BQU07b0JBQ0YsSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQzdGLFFBQVEsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxFQUFFO1NBQzdDO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELGVBQWU7UUFDYixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQ2pDLENBQUM7SUFFRCxnQkFBZ0I7UUFDZCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQzlCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUVyQyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNyQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDN0IsSUFBSSxFQUFPLENBQUM7WUFDWixJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDaEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztnQkFDNUIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNwRCxJQUFJLENBQUMsS0FBSyxDQUFDLDBCQUEwQixVQUFVLDZCQUE2QixDQUFDLENBQUM7Z0JBQzlFLEVBQUUsR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzthQUM5RDtpQkFBTTtnQkFDTCxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2FBQ3ZCO1lBQ0QsT0FBTyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztTQUNuRjthQUFNO1lBQ0wsT0FBTyxNQUFNLENBQUM7U0FDZjtJQUNILENBQUM7SUFFRCxjQUFjO1FBQ1osT0FBTztRQUNQLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUN6QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDckMsTUFBTSxFQUFDLEtBQUssRUFBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDNUIsTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3BGO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELGVBQWU7UUFDYixPQUFPO1FBQ1AsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ2xDLE9BQU8sSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3pDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNuQyxNQUFNLEVBQUMsS0FBSyxFQUFDLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztZQUM1QixNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDcEY7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRUQsYUFBYTtRQUNYLHdCQUF3QjtRQUN4QixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFO1lBQzNDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQ3BDLFFBQVEsUUFBUSxFQUFFO2dCQUNoQixLQUFLLElBQUksQ0FBQztnQkFDVixLQUFLLEtBQUssQ0FBQztnQkFDWCxLQUFLLElBQUksQ0FBQztnQkFDVixLQUFLLEtBQUs7b0JBQ1IsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNmLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztvQkFDckMsTUFBTSxFQUFDLEtBQUssRUFBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0JBQzVCLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDdkYsU0FBUzthQUNaO1lBQ0QsTUFBTTtTQUNQO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELGVBQWU7UUFDYix1QkFBdUI7UUFDdkIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ2xDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRTtZQUMzQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUNwQyxRQUFRLFFBQVEsRUFBRTtnQkFDaEIsS0FBSyxHQUFHLENBQUM7Z0JBQ1QsS0FBSyxHQUFHLENBQUM7Z0JBQ1QsS0FBSyxJQUFJLENBQUM7Z0JBQ1YsS0FBSyxJQUFJO29CQUNQLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDZixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQ25DLE1BQU0sRUFBQyxLQUFLLEVBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUM1QixNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQ3ZGLFNBQVM7YUFDWjtZQUNELE1BQU07U0FDUDtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxhQUFhO1FBQ1gsV0FBVztRQUNYLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQ3hDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRTtZQUMzQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUNwQyxRQUFRLFFBQVEsRUFBRTtnQkFDaEIsS0FBSyxHQUFHLENBQUM7Z0JBQ1QsS0FBSyxHQUFHO29CQUNOLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDZixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztvQkFDdkMsTUFBTSxFQUFDLEtBQUssRUFBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0JBQzVCLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDdkYsU0FBUzthQUNaO1lBQ0QsTUFBTTtTQUNQO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELG1CQUFtQjtRQUNqQixnQkFBZ0I7UUFDaEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRTtZQUMzQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUNwQyxRQUFRLFFBQVEsRUFBRTtnQkFDaEIsS0FBSyxHQUFHLENBQUM7Z0JBQ1QsS0FBSyxHQUFHLENBQUM7Z0JBQ1QsS0FBSyxHQUFHO29CQUNOLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDZixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQy9CLE1BQU0sRUFBQyxLQUFLLEVBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUM1QixNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQ3ZGLFNBQVM7YUFDWjtZQUNELE1BQU07U0FDUDtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxXQUFXO1FBQ1QsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFO1lBQ3hDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDOUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7WUFDcEMsSUFBSSxNQUFXLENBQUM7WUFDaEIsUUFBUSxRQUFRLEVBQUU7Z0JBQ2hCLEtBQUssR0FBRztvQkFDTixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ2YsTUFBTSxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDNUIsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDNUUsS0FBSyxHQUFHO29CQUNOLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDZixNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUM1QixPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUM3RSxLQUFLLEdBQUc7b0JBQ04sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNmLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzVCLE9BQU8sSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2FBQzFFO1NBQ0Y7UUFDRCxPQUFPLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBRUQsY0FBYztRQUNaLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNqQyxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUN0QyxPQUFPLElBQUksRUFBRTtZQUNYLElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDaEQsTUFBTSxHQUFHLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFFNUQ7aUJBQU0sSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzdDLE1BQU0sR0FBRyxJQUFJLENBQUMsNkJBQTZCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO2FBRTNEO2lCQUFNLElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDekQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO29CQUNoRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztvQkFDekIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO29CQUM3QixJQUFJLEdBQUcsWUFBWSxTQUFTLEVBQUU7d0JBQzVCLElBQUksQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztxQkFDMUM7b0JBQ0QsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7b0JBQ3pCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUN0QyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsRUFBRTt3QkFDckMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7d0JBQ3RDLE1BQU0sR0FBRyxJQUFJLFVBQVUsQ0FDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7cUJBQy9FO3lCQUFNO3dCQUNMLE1BQU07NEJBQ0YsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQztxQkFDdEY7Z0JBQ0gsQ0FBQyxDQUFDLENBQUM7YUFDSjtpQkFBTSxJQUFJLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ3ZELElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDdkIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQ3ZDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3BDLE1BQU07b0JBQ0YsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQzthQUUxRjtpQkFBTSxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDNUMsTUFBTSxHQUFHLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQzthQUUxRjtpQkFBTTtnQkFDTCxPQUFPLE1BQU0sQ0FBQzthQUNmO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsWUFBWTtRQUNWLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDOUIsSUFBSSxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ2hELElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN2QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3BDLE9BQU8sTUFBTSxDQUFDO1NBRWY7YUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUU7WUFDcEMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2YsT0FBTyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUU3RTthQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFO1lBQ3pDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNmLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztTQUUvRTthQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRTtZQUNwQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZixPQUFPLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBRTdFO2FBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFO1lBQ3JDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNmLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FFOUU7YUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUU7WUFDcEMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2YsT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztTQUNuRTthQUFNLElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUN6RCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUN6QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzNELElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3RDLE9BQU8sSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBRTdFO2FBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDL0MsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7U0FFL0I7YUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUU7WUFDbkMsT0FBTyxJQUFJLENBQUMsNkJBQTZCLENBQ3JDLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FFNUU7YUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDL0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZixPQUFPLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBRTlFO2FBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQy9CLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDMUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2YsT0FBTyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQztTQUVyRjthQUFNLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUMzQyxJQUFJLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUMxRCxPQUFPLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQ2hFO2FBQU07WUFDTCxJQUFJLENBQUMsS0FBSyxDQUFDLG9CQUFvQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUM1QyxPQUFPLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQ2hFO0lBQ0gsQ0FBQztJQUVELG1CQUFtQixDQUFDLFVBQWtCO1FBQ3BDLE1BQU0sTUFBTSxHQUFVLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDdEMsR0FBRztnQkFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO2FBQy9CLFFBQVEsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTtTQUN2RDtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxlQUFlO1FBQ2IsTUFBTSxJQUFJLEdBQW9CLEVBQUUsQ0FBQztRQUNqQyxNQUFNLE1BQU0sR0FBVSxFQUFFLENBQUM7UUFDekIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUM5QixJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUNqRCxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdkIsR0FBRztnQkFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNwQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsaUNBQWlDLEVBQUUsQ0FBQztnQkFDckQsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDO2dCQUN6QixJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDbkMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQzthQUMvQixRQUFRLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDdEQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ3JDO1FBQ0QsT0FBTyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ2hGLENBQUM7SUFFRCw2QkFBNkIsQ0FBQyxRQUFhLEVBQUUsU0FBa0IsS0FBSztRQUNsRSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUNsQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ2xDLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRTtZQUMzRCxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztZQUM1QyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUNuQixJQUFJLENBQUMsS0FBSyxDQUFDLHlDQUF5QyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDMUU7WUFDRCxPQUFPLEVBQUUsQ0FBQztRQUNaLENBQUMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUU1QyxJQUFJLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDaEQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN2QixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzlCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDMUMsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksY0FBYyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDcEUsSUFBSSxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUVoRjthQUFNO1lBQ0wsSUFBSSxNQUFNLEVBQUU7Z0JBQ1YsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQ3JDLElBQUksQ0FBQyxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztvQkFDbkUsT0FBTyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztpQkFDaEU7cUJBQU07b0JBQ0wsT0FBTyxJQUFJLGdCQUFnQixDQUN2QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDdkU7YUFDRjtpQkFBTTtnQkFDTCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUU7d0JBQ3JCLElBQUksQ0FBQyxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQzt3QkFDbEQsT0FBTyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztxQkFDaEU7b0JBRUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7b0JBQ3RDLE9BQU8sSUFBSSxhQUFhLENBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztpQkFDOUU7cUJBQU07b0JBQ0wsT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDM0Y7YUFDRjtTQUNGO0lBQ0gsQ0FBQztJQUVELGtCQUFrQjtRQUNoQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUNwRCxNQUFNLFdBQVcsR0FBVSxFQUFFLENBQUM7UUFDOUIsR0FBRztZQUNELFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7U0FDcEMsUUFBUSxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3RELE9BQU8sV0FBNEIsQ0FBQztJQUN0QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsd0JBQXdCO1FBQ3RCLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNoQixJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7UUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDO1FBQ3pDLEdBQUc7WUFDRCxNQUFNLElBQUksSUFBSSxDQUFDLGlDQUFpQyxFQUFFLENBQUM7WUFDbkQsYUFBYSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNsRCxJQUFJLGFBQWEsRUFBRTtnQkFDakIsTUFBTSxJQUFJLEdBQUcsQ0FBQzthQUNmO1NBQ0YsUUFBUSxhQUFhLEVBQUU7UUFDeEIsT0FBTztZQUNMLE1BQU0sRUFBRSxNQUFNO1lBQ2QsSUFBSSxFQUFFLElBQUksa0JBQWtCLENBQUMsS0FBSyxFQUFFLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1NBQzNELENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09Bb0JHO0lBQ0gscUJBQXFCLENBQUMsV0FBc0M7UUFDMUQsTUFBTSxRQUFRLEdBQXNCLEVBQUUsQ0FBQztRQUV2QyxtREFBbUQ7UUFDbkQsNkRBQTZEO1FBQzdELDhEQUE4RDtRQUM5RCxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFFbEUsT0FBTyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQ3RDLGtFQUFrRTtZQUNsRSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDMUMsSUFBSSxVQUFVLEVBQUU7Z0JBQ2QsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUMzQjtpQkFBTTtnQkFDTCxzREFBc0Q7Z0JBQ3RELHFFQUFxRTtnQkFDckUsdUVBQXVFO2dCQUN2RSxpQkFBaUI7Z0JBQ2pCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO2dCQUM1QyxtRUFBbUU7Z0JBQ25FLGVBQWU7Z0JBQ2YsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDekMsSUFBSSxPQUFPLEVBQUU7b0JBQ1gsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztpQkFDeEI7cUJBQU07b0JBQ0wsc0VBQXNFO29CQUN0RSxvRUFBb0U7b0JBQ3BFLEdBQUcsQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN4RixRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7aUJBQzNEO2FBQ0Y7WUFDRCxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztTQUNuQztRQUVELE9BQU8sSUFBSSwwQkFBMEIsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7OztPQWNHO0lBQ0ssNkJBQTZCLENBQUMsR0FBOEI7UUFDbEUsTUFBTSxRQUFRLEdBQXNCLEVBQUUsQ0FBQztRQUN2QyxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUUsMkJBQTJCO1FBQ3pFLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBQzdDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztRQUN6QyxpRUFBaUU7UUFDakUsc0VBQXNFO1FBQ3RFLDBFQUEwRTtRQUMxRSw0RUFBNEU7UUFDNUUsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ2QsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUM7WUFDbEMsT0FBTyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztTQUN0QztRQUNELE1BQU0sVUFBVSxHQUFHLElBQUksa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbkUsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUM3RCxJQUFJLFNBQVMsRUFBRTtZQUNiLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDMUI7UUFDRCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBRUQ7Ozs7Ozs7OztPQVNHO0lBQ0ssdUJBQXVCO1FBQzdCLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRTtZQUN0RSxPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUUsK0JBQStCO1FBQzlELE1BQU0sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztRQUM5QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDL0MsT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2hHLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7T0FXRztJQUNLLGNBQWMsQ0FBQyxLQUFnQztRQUNyRCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFO1lBQ3pCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBRSwyQkFBMkI7UUFDNUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDNUMsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUM7UUFDbEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUN4RixPQUFPLElBQUksZUFBZSxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVEOzs7Ozs7OztPQVFHO0lBQ0ssZUFBZTtRQUNyQixJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFO1lBQzFCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUM7UUFDN0MsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUUsNEJBQTRCO1FBQzdDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQzVDLElBQUksS0FBSyxHQUFtQyxJQUFJLENBQUM7UUFDakQsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDckMsS0FBSyxHQUFHLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1NBQ3pDO1FBQ0QsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUM7UUFDbEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDakYsT0FBTyxJQUFJLGVBQWUsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRDs7T0FFRztJQUNLLDBCQUEwQjtRQUNoQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDakcsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxPQUFlLEVBQUUsUUFBcUIsSUFBSTtRQUM5QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ2hHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNkLENBQUM7SUFFTyxZQUFZLENBQUMsUUFBcUIsSUFBSTtRQUM1QyxJQUFJLEtBQUssSUFBSSxJQUFJO1lBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDdEMsT0FBTyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEQsOEJBQThCLENBQUM7SUFDdkUsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQXVCRztJQUNLLElBQUk7UUFDVixJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztZQUNuRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2xGLENBQUMsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM1RCxDQUFDLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNoRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO1lBQzNFLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRTtnQkFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ1osSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUcsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzthQUM3RjtZQUNELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNmLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1NBQ2Y7SUFDSCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLHVCQUF1QjtJQUE3QjtRQUNFLFdBQU0sR0FBYSxFQUFFLENBQUM7SUF1RHhCLENBQUM7SUFyREMscUJBQXFCLENBQUMsR0FBcUIsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUU3RCxpQkFBaUIsQ0FBQyxHQUFpQixFQUFFLE9BQVksSUFBRyxDQUFDO0lBRXJELGtCQUFrQixDQUFDLEdBQWtCLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFdkQscUJBQXFCLENBQUMsR0FBcUIsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUU3RCxpQkFBaUIsQ0FBQyxHQUFpQixFQUFFLE9BQVksSUFBRyxDQUFDO0lBRXJELGtCQUFrQixDQUFDLEdBQWtCLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFdkQscUJBQXFCLENBQUMsR0FBcUIsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUU3RCxlQUFlLENBQUMsR0FBZSxFQUFFLE9BQVksSUFBRyxDQUFDO0lBRWpELG1CQUFtQixDQUFDLEdBQW1CLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFekQsaUJBQWlCLENBQUMsR0FBaUIsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUVyRCxpQkFBaUIsQ0FBQyxHQUFpQixFQUFFLE9BQVk7UUFDL0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxlQUFlLENBQUMsR0FBZSxFQUFFLE9BQVk7UUFDM0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxVQUFVLENBQUMsR0FBVSxFQUFFLE9BQVksSUFBRyxDQUFDO0lBRXZDLFdBQVcsQ0FBQyxHQUFXLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFekMsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUUvQyxrQkFBa0IsQ0FBQyxHQUFrQixFQUFFLE9BQVksSUFBRyxDQUFDO0lBRXZELGdCQUFnQixDQUFDLEdBQWdCLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFbkQsU0FBUyxDQUFDLEdBQWdCLEVBQUUsT0FBWTtRQUN0QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM1QixDQUFDO0lBRUQsY0FBYyxDQUFDLEdBQWMsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUUvQyxlQUFlLENBQUMsR0FBZSxFQUFFLE9BQVksSUFBRyxDQUFDO0lBRWpELFFBQVEsQ0FBQyxJQUFXLEVBQUUsT0FBWTtRQUNoQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRCxVQUFVLENBQUMsR0FBVSxFQUFFLE9BQVksSUFBRyxDQUFDO0lBRXZDLFVBQVUsQ0FBQyxHQUFVLEVBQUUsT0FBWSxJQUFHLENBQUM7Q0FDeEM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLDBCQUEyQixTQUFRLG1CQUFtQjtJQUE1RDs7UUFDRSxXQUFNLEdBQWEsRUFBRSxDQUFDO0lBS3hCLENBQUM7SUFIQyxTQUFTO1FBQ1AsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDNUIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoYXJzIGZyb20gJy4uL2NoYXJzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7ZXNjYXBlUmVnRXhwfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtBYnNvbHV0ZVNvdXJjZVNwYW4sIEFTVCwgQXN0VmlzaXRvciwgQVNUV2l0aFNvdXJjZSwgQmluYXJ5LCBCaW5kaW5nUGlwZSwgQ2hhaW4sIENvbmRpdGlvbmFsLCBFbXB0eUV4cHIsIEV4cHJlc3Npb25CaW5kaW5nLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIEtleWVkUmVhZCwgS2V5ZWRXcml0ZSwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsTWFwS2V5LCBMaXRlcmFsUHJpbWl0aXZlLCBNZXRob2RDYWxsLCBOb25OdWxsQXNzZXJ0LCBQYXJzZXJFcnJvciwgUGFyc2VTcGFuLCBQcmVmaXhOb3QsIFByb3BlcnR5UmVhZCwgUHJvcGVydHlXcml0ZSwgUXVvdGUsIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsIFNhZmVNZXRob2RDYWxsLCBTYWZlUHJvcGVydHlSZWFkLCBUZW1wbGF0ZUJpbmRpbmcsIFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIsIFRoaXNSZWNlaXZlciwgVW5hcnksIFZhcmlhYmxlQmluZGluZ30gZnJvbSAnLi9hc3QnO1xuaW1wb3J0IHtFT0YsIGlzSWRlbnRpZmllciwgaXNRdW90ZSwgTGV4ZXIsIFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4vbGV4ZXInO1xuXG5leHBvcnQgY2xhc3MgU3BsaXRJbnRlcnBvbGF0aW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3RyaW5nczogc3RyaW5nW10sIHB1YmxpYyBzdHJpbmdTcGFuczoge3N0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyfVtdLFxuICAgICAgcHVibGljIGV4cHJlc3Npb25zOiBzdHJpbmdbXSwgcHVibGljIGV4cHJlc3Npb25zU3BhbnM6IHtzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcn1bXSxcbiAgICAgIHB1YmxpYyBvZmZzZXRzOiBudW1iZXJbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdGVtcGxhdGVCaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10sIHB1YmxpYyB3YXJuaW5nczogc3RyaW5nW10sXG4gICAgICBwdWJsaWMgZXJyb3JzOiBQYXJzZXJFcnJvcltdKSB7fVxufVxuXG5jb25zdCBkZWZhdWx0SW50ZXJwb2xhdGVSZWdFeHAgPSBfY3JlYXRlSW50ZXJwb2xhdGVSZWdFeHAoREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk7XG5mdW5jdGlvbiBfZ2V0SW50ZXJwb2xhdGVSZWdFeHAoY29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogUmVnRXhwIHtcbiAgaWYgKGNvbmZpZyA9PT0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRykge1xuICAgIHJldHVybiBkZWZhdWx0SW50ZXJwb2xhdGVSZWdFeHA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBSZWdFeHAge1xuICBjb25zdCBwYXR0ZXJuID0gZXNjYXBlUmVnRXhwKGNvbmZpZy5zdGFydCkgKyAnKFtcXFxcc1xcXFxTXSo/KScgKyBlc2NhcGVSZWdFeHAoY29uZmlnLmVuZCk7XG4gIHJldHVybiBuZXcgUmVnRXhwKHBhdHRlcm4sICdnJyk7XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2xleGVyOiBMZXhlcikge31cblxuICBzaW1wbGVFeHByZXNzaW9uQ2hlY2tlciA9IFNpbXBsZUV4cHJlc3Npb25DaGVja2VyO1xuXG4gIHBhcnNlQWN0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgdGhpcy5fY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpKTtcbiAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgdHJ1ZSwgdGhpcy5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgIGlucHV0Lmxlbmd0aCAtIHNvdXJjZVRvTGV4Lmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwYXJzZUJpbmRpbmcoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogYW55LCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUJpbmRpbmdBc3QoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja1NpbXBsZUV4cHJlc3Npb24oYXN0OiBBU1QpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgY2hlY2tlciA9IG5ldyB0aGlzLnNpbXBsZUV4cHJlc3Npb25DaGVja2VyKCk7XG4gICAgYXN0LnZpc2l0KGNoZWNrZXIpO1xuICAgIHJldHVybiBjaGVja2VyLmVycm9ycztcbiAgfVxuXG4gIHBhcnNlU2ltcGxlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBlcnJvcnMgPSB0aGlzLmNoZWNrU2ltcGxlRXhwcmVzc2lvbihhc3QpO1xuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYEhvc3QgYmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluICR7ZXJyb3JzLmpvaW4oJyAnKX1gLCBpbnB1dCwgbG9jYXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihtZXNzYWdlOiBzdHJpbmcsIGlucHV0OiBzdHJpbmcsIGVyckxvY2F0aW9uOiBzdHJpbmcsIGN0eExvY2F0aW9uPzogYW55KSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VyRXJyb3IobWVzc2FnZSwgaW5wdXQsIGVyckxvY2F0aW9uLCBjdHhMb2NhdGlvbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VCaW5kaW5nQXN0KFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBBU1Qge1xuICAgIC8vIFF1b3RlcyBleHByZXNzaW9ucyB1c2UgM3JkLXBhcnR5IGV4cHJlc3Npb24gbGFuZ3VhZ2UuIFdlIGRvbid0IHdhbnQgdG8gdXNlXG4gICAgLy8gb3VyIGxleGVyIG9yIHBhcnNlciBmb3IgdGhhdCwgc28gd2UgY2hlY2sgZm9yIHRoYXQgYWhlYWQgb2YgdGltZS5cbiAgICBjb25zdCBxdW90ZSA9IHRoaXMuX3BhcnNlUXVvdGUoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG5cbiAgICBpZiAocXVvdGUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHF1b3RlO1xuICAgIH1cblxuICAgIHRoaXMuX2NoZWNrTm9JbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgcmV0dXJuIG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgZmFsc2UsIHRoaXMuZXJyb3JzLFxuICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAucGFyc2VDaGFpbigpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VRdW90ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1R8bnVsbCB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHByZWZpeFNlcGFyYXRvckluZGV4ID0gaW5wdXQuaW5kZXhPZignOicpO1xuICAgIGlmIChwcmVmaXhTZXBhcmF0b3JJbmRleCA9PSAtMSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4ID0gaW5wdXQuc3Vic3RyaW5nKDAsIHByZWZpeFNlcGFyYXRvckluZGV4KS50cmltKCk7XG4gICAgaWYgKCFpc0lkZW50aWZpZXIocHJlZml4KSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24gPSBpbnB1dC5zdWJzdHJpbmcocHJlZml4U2VwYXJhdG9ySW5kZXggKyAxKTtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgUXVvdGUoXG4gICAgICAgIHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHByZWZpeCwgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24sIGxvY2F0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBtaWNyb3N5bnRheCB0ZW1wbGF0ZSBleHByZXNzaW9uIGFuZCByZXR1cm4gYSBsaXN0IG9mIGJpbmRpbmdzIG9yXG4gICAqIHBhcnNpbmcgZXJyb3JzIGluIGNhc2UgdGhlIGdpdmVuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgIDxkaXYgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIj5cbiAgICogICAgICAgICBeICAgICAgXiBhYnNvbHV0ZVZhbHVlT2Zmc2V0IGZvciBgdGVtcGxhdGVWYWx1ZWBcbiAgICogICAgICAgICBhYnNvbHV0ZUtleU9mZnNldCBmb3IgYHRlbXBsYXRlS2V5YFxuICAgKiBgYGBcbiAgICogY29udGFpbnMgdGhyZWUgYmluZGluZ3M6XG4gICAqIDEuIG5nRm9yIC0+IG51bGxcbiAgICogMi4gaXRlbSAtPiBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRcbiAgICogMy4gbmdGb3JPZiAtPiBpdGVtc1xuICAgKlxuICAgKiBUaGlzIGlzIGFwcGFyZW50IGZyb20gdGhlIGRlLXN1Z2FyZWQgdGVtcGxhdGU6XG4gICAqIGBgYFxuICAgKiAgIDxuZy10ZW1wbGF0ZSBuZ0ZvciBsZXQtaXRlbSBbbmdGb3JPZl09XCJpdGVtc1wiPlxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlS2V5IG5hbWUgb2YgZGlyZWN0aXZlLCB3aXRob3V0IHRoZSAqIHByZWZpeC4gRm9yIGV4YW1wbGU6IG5nSWYsIG5nRm9yXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZVZhbHVlIFJIUyBvZiB0aGUgbWljcm9zeW50YXggYXR0cmlidXRlXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZVVybCB0ZW1wbGF0ZSBmaWxlbmFtZSBpZiBpdCdzIGV4dGVybmFsLCBjb21wb25lbnQgZmlsZW5hbWUgaWYgaXQncyBpbmxpbmVcbiAgICogQHBhcmFtIGFic29sdXRlS2V5T2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdGVtcGxhdGVLZXlgXG4gICAqIEBwYXJhbSBhYnNvbHV0ZVZhbHVlT2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdGVtcGxhdGVWYWx1ZWBcbiAgICovXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyhcbiAgICAgIHRlbXBsYXRlS2V5OiBzdHJpbmcsIHRlbXBsYXRlVmFsdWU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZywgYWJzb2x1dGVLZXlPZmZzZXQ6IG51bWJlcixcbiAgICAgIGFic29sdXRlVmFsdWVPZmZzZXQ6IG51bWJlcik6IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZSh0ZW1wbGF0ZVZhbHVlKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICB0ZW1wbGF0ZVZhbHVlLCB0ZW1wbGF0ZVVybCwgYWJzb2x1dGVWYWx1ZU9mZnNldCwgdG9rZW5zLCB0ZW1wbGF0ZVZhbHVlLmxlbmd0aCxcbiAgICAgICAgZmFsc2UgLyogcGFyc2VBY3Rpb24gKi8sIHRoaXMuZXJyb3JzLCAwIC8qIHJlbGF0aXZlIG9mZnNldCAqLyk7XG4gICAgcmV0dXJuIHBhcnNlci5wYXJzZVRlbXBsYXRlQmluZGluZ3Moe1xuICAgICAgc291cmNlOiB0ZW1wbGF0ZUtleSxcbiAgICAgIHNwYW46IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oYWJzb2x1dGVLZXlPZmZzZXQsIGFic29sdXRlS2V5T2Zmc2V0ICsgdGVtcGxhdGVLZXkubGVuZ3RoKSxcbiAgICB9KTtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgY29uc3Qgc3BsaXQgPSB0aGlzLnNwbGl0SW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGlmIChzcGxpdCA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGV4cHJlc3Npb25zOiBBU1RbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGxpdC5leHByZXNzaW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgZXhwcmVzc2lvblRleHQgPSBzcGxpdC5leHByZXNzaW9uc1tpXTtcbiAgICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uVGV4dCk7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9ycywgc3BsaXQub2Zmc2V0c1tpXSArIChleHByZXNzaW9uVGV4dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpKVxuICAgICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgICBleHByZXNzaW9ucy5wdXNoKGFzdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlSW50ZXJwb2xhdGlvbkFzdChzcGxpdC5zdHJpbmdzLCBleHByZXNzaW9ucywgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG4gIH1cblxuICAvKipcbiAgICogU2ltaWxhciB0byBgcGFyc2VJbnRlcnBvbGF0aW9uYCwgYnV0IHRyZWF0cyB0aGUgcHJvdmlkZWQgc3RyaW5nIGFzIGEgc2luZ2xlIGV4cHJlc3Npb25cbiAgICogZWxlbWVudCB0aGF0IHdvdWxkIG5vcm1hbGx5IGFwcGVhciB3aXRoaW4gdGhlIGludGVycG9sYXRpb24gcHJlZml4IGFuZCBzdWZmaXggKGB7e2AgYW5kIGB9fWApLlxuICAgKiBUaGlzIGlzIHVzZWQgZm9yIHBhcnNpbmcgdGhlIHN3aXRjaCBleHByZXNzaW9uIGluIElDVXMuXG4gICAqL1xuICBwYXJzZUludGVycG9sYXRpb25FeHByZXNzaW9uKGV4cHJlc3Npb246IHN0cmluZywgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6XG4gICAgICBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoZXhwcmVzc2lvbik7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUoc291cmNlVG9MZXgpO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb24sIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIC8qIHBhcnNlQWN0aW9uICovIGZhbHNlLCB0aGlzLmVycm9ycywgMClcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICBjb25zdCBzdHJpbmdzID0gWycnLCAnJ107ICAvLyBUaGUgcHJlZml4IGFuZCBzdWZmaXggc3RyaW5ncyBhcmUgYm90aCBlbXB0eVxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUludGVycG9sYXRpb25Bc3Qoc3RyaW5ncywgW2FzdF0sIGV4cHJlc3Npb24sIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUludGVycG9sYXRpb25Bc3QoXG4gICAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IEFTVFtdLCBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0Lmxlbmd0aCk7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbiA9XG4gICAgICAgIG5ldyBJbnRlcnBvbGF0aW9uKHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoaW50ZXJwb2xhdGlvbiwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNwbGl0cyBhIHN0cmluZyBvZiB0ZXh0IGludG8gXCJyYXdcIiB0ZXh0IHNlZ21lbnRzIGFuZCBleHByZXNzaW9ucyBwcmVzZW50IGluIGludGVycG9sYXRpb25zIGluXG4gICAqIHRoZSBzdHJpbmcuXG4gICAqIFJldHVybnMgYG51bGxgIGlmIHRoZXJlIGFyZSBubyBpbnRlcnBvbGF0aW9ucywgb3RoZXJ3aXNlIGFcbiAgICogYFNwbGl0SW50ZXJwb2xhdGlvbmAgd2l0aCBzcGxpdHMgdGhhdCBsb29rIGxpa2VcbiAgICogICA8cmF3IHRleHQ+IDxleHByZXNzaW9uPiA8cmF3IHRleHQ+IC4uLiA8cmF3IHRleHQ+IDxleHByZXNzaW9uPiA8cmF3IHRleHQ+XG4gICAqL1xuICBzcGxpdEludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBTcGxpdEludGVycG9sYXRpb25cbiAgICAgIHxudWxsIHtcbiAgICBjb25zdCBzdHJpbmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGV4cHJlc3Npb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IG9mZnNldHM6IG51bWJlcltdID0gW107XG4gICAgY29uc3Qgc3RyaW5nU3BhbnM6IHtzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcn1bXSA9IFtdO1xuICAgIGNvbnN0IGV4cHJlc3Npb25TcGFuczoge3N0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyfVtdID0gW107XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCBhdEludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICBsZXQgZXh0ZW5kTGFzdFN0cmluZyA9IGZhbHNlO1xuICAgIGxldCB7c3RhcnQ6IGludGVycFN0YXJ0LCBlbmQ6IGludGVycEVuZH0gPSBpbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAgIHdoaWxlIChpIDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgICAvLyBwYXJzZSB1bnRpbCBzdGFydGluZyB7e1xuICAgICAgICBjb25zdCBzdGFydCA9IGk7XG4gICAgICAgIGkgPSBpbnB1dC5pbmRleE9mKGludGVycFN0YXJ0LCBpKTtcbiAgICAgICAgaWYgKGkgPT09IC0xKSB7XG4gICAgICAgICAgaSA9IGlucHV0Lmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJ0ID0gaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBpKTtcbiAgICAgICAgc3RyaW5ncy5wdXNoKHBhcnQpO1xuICAgICAgICBzdHJpbmdTcGFucy5wdXNoKHtzdGFydCwgZW5kOiBpfSk7XG5cbiAgICAgICAgYXRJbnRlcnBvbGF0aW9uID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBhcnNlIGZyb20gc3RhcnRpbmcge3sgdG8gZW5kaW5nIH19XG4gICAgICAgIGNvbnN0IGZ1bGxTdGFydCA9IGk7XG4gICAgICAgIGNvbnN0IGV4cHJTdGFydCA9IGZ1bGxTdGFydCArIGludGVycFN0YXJ0Lmxlbmd0aDtcbiAgICAgICAgY29uc3QgZXhwckVuZCA9IGlucHV0LmluZGV4T2YoaW50ZXJwRW5kLCBleHByU3RhcnQpO1xuICAgICAgICBpZiAoZXhwckVuZCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyBDb3VsZCBub3QgZmluZCB0aGUgZW5kIG9mIHRoZSBpbnRlcnBvbGF0aW9uOyBkbyBub3QgcGFyc2UgYW4gZXhwcmVzc2lvbi5cbiAgICAgICAgICAvLyBJbnN0ZWFkIHdlIHNob3VsZCBleHRlbmQgdGhlIGNvbnRlbnQgb24gdGhlIGxhc3QgcmF3IHN0cmluZy5cbiAgICAgICAgICBhdEludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICAgICAgICBleHRlbmRMYXN0U3RyaW5nID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdWxsRW5kID0gZXhwckVuZCArIGludGVycEVuZC5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgcGFydCA9IGlucHV0LnN1YnN0cmluZyhleHByU3RhcnQsIGV4cHJFbmQpO1xuICAgICAgICBpZiAocGFydC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGV4cHJlc3Npb25zLnB1c2gocGFydCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgICdCbGFuayBleHByZXNzaW9ucyBhcmUgbm90IGFsbG93ZWQgaW4gaW50ZXJwb2xhdGVkIHN0cmluZ3MnLCBpbnB1dCxcbiAgICAgICAgICAgICAgYGF0IGNvbHVtbiAke2l9IGluYCwgbG9jYXRpb24pO1xuICAgICAgICAgIGV4cHJlc3Npb25zLnB1c2goJyRpbXBsaWNpdCcpO1xuICAgICAgICB9XG4gICAgICAgIG9mZnNldHMucHVzaChleHByU3RhcnQpO1xuICAgICAgICBleHByZXNzaW9uU3BhbnMucHVzaCh7c3RhcnQ6IGZ1bGxTdGFydCwgZW5kOiBmdWxsRW5kfSk7XG5cbiAgICAgICAgaSA9IGZ1bGxFbmQ7XG4gICAgICAgIGF0SW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgLy8gSWYgd2UgYXJlIG5vdyBhdCBhIHRleHQgc2VjdGlvbiwgYWRkIHRoZSByZW1haW5pbmcgY29udGVudCBhcyBhIHJhdyBzdHJpbmcuXG4gICAgICBpZiAoZXh0ZW5kTGFzdFN0cmluZykge1xuICAgICAgICBzdHJpbmdzW3N0cmluZ3MubGVuZ3RoIC0gMV0gKz0gaW5wdXQuc3Vic3RyaW5nKGkpO1xuICAgICAgICBzdHJpbmdTcGFuc1tzdHJpbmdTcGFucy5sZW5ndGggLSAxXS5lbmQgPSBpbnB1dC5sZW5ndGg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHJpbmdzLnB1c2goaW5wdXQuc3Vic3RyaW5nKGkpKTtcbiAgICAgICAgc3RyaW5nU3BhbnMucHVzaCh7c3RhcnQ6IGksIGVuZDogaW5wdXQubGVuZ3RofSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBleHByZXNzaW9ucy5sZW5ndGggPT09IDAgP1xuICAgICAgICBudWxsIDpcbiAgICAgICAgbmV3IFNwbGl0SW50ZXJwb2xhdGlvbihzdHJpbmdzLCBzdHJpbmdTcGFucywgZXhwcmVzc2lvbnMsIGV4cHJlc3Npb25TcGFucywgb2Zmc2V0cyk7XG4gIH1cblxuICB3cmFwTGl0ZXJhbFByaW1pdGl2ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dCA9PSBudWxsID8gMCA6IGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBpbnB1dCksIGlucHV0LCBsb2NhdGlvbixcbiAgICAgICAgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0cmlwQ29tbWVudHMoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaSA9IHRoaXMuX2NvbW1lbnRTdGFydChpbnB1dCk7XG4gICAgcmV0dXJuIGkgIT0gbnVsbCA/IGlucHV0LnN1YnN0cmluZygwLCBpKS50cmltKCkgOiBpbnB1dDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbW1lbnRTdGFydChpbnB1dDogc3RyaW5nKTogbnVtYmVyfG51bGwge1xuICAgIGxldCBvdXRlclF1b3RlOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGNvbnN0IGNoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgY29uc3QgbmV4dENoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkgKyAxKTtcblxuICAgICAgaWYgKGNoYXIgPT09IGNoYXJzLiRTTEFTSCAmJiBuZXh0Q2hhciA9PSBjaGFycy4kU0xBU0ggJiYgb3V0ZXJRdW90ZSA9PSBudWxsKSByZXR1cm4gaTtcblxuICAgICAgaWYgKG91dGVyUXVvdGUgPT09IGNoYXIpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKG91dGVyUXVvdGUgPT0gbnVsbCAmJiBpc1F1b3RlKGNoYXIpKSB7XG4gICAgICAgIG91dGVyUXVvdGUgPSBjaGFyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrTm9JbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IHZvaWQge1xuICAgIGNvbnN0IHJlZ2V4cCA9IF9nZXRJbnRlcnBvbGF0ZVJlZ0V4cChpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBwYXJ0cyA9IGlucHV0LnNwbGl0KHJlZ2V4cCk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7XG4gICAgICAgICAgICAgIGludGVycG9sYXRpb25Db25maWcuZW5kfSkgd2hlcmUgZXhwcmVzc2lvbiB3YXMgZXhwZWN0ZWRgLFxuICAgICAgICAgIGlucHV0LFxuICAgICAgICAgIGBhdCBjb2x1bW4gJHt0aGlzLl9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKHBhcnRzLCAxLCBpbnRlcnBvbGF0aW9uQ29uZmlnKX0gaW5gLFxuICAgICAgICAgIGxvY2F0aW9uKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKFxuICAgICAgcGFydHM6IHN0cmluZ1tdLCBwYXJ0SW5FcnJJZHg6IG51bWJlciwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IG51bWJlciB7XG4gICAgbGV0IGVyckxvY2F0aW9uID0gJyc7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBwYXJ0SW5FcnJJZHg7IGorKykge1xuICAgICAgZXJyTG9jYXRpb24gKz0gaiAlIDIgPT09IDAgP1xuICAgICAgICAgIHBhcnRzW2pdIDpcbiAgICAgICAgICBgJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7cGFydHNbal19JHtpbnRlcnBvbGF0aW9uQ29uZmlnLmVuZH1gO1xuICAgIH1cblxuICAgIHJldHVybiBlcnJMb2NhdGlvbi5sZW5ndGg7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEl2eVBhcnNlciBleHRlbmRzIFBhcnNlciB7XG4gIHNpbXBsZUV4cHJlc3Npb25DaGVja2VyID0gSXZ5U2ltcGxlRXhwcmVzc2lvbkNoZWNrZXI7ICAvL1xufVxuXG4vKiogRGVzY3JpYmVzIGEgc3RhdGVmdWwgY29udGV4dCBhbiBleHByZXNzaW9uIHBhcnNlciBpcyBpbi4gKi9cbmVudW0gUGFyc2VDb250ZXh0RmxhZ3Mge1xuICBOb25lID0gMCxcbiAgLyoqXG4gICAqIEEgV3JpdGFibGUgY29udGV4dCBpcyBvbmUgaW4gd2hpY2ggYSB2YWx1ZSBtYXkgYmUgd3JpdHRlbiB0byBhbiBsdmFsdWUuXG4gICAqIEZvciBleGFtcGxlLCBhZnRlciB3ZSBzZWUgYSBwcm9wZXJ0eSBhY2Nlc3MsIHdlIG1heSBleHBlY3QgYSB3cml0ZSB0byB0aGVcbiAgICogcHJvcGVydHkgdmlhIHRoZSBcIj1cIiBvcGVyYXRvci5cbiAgICogICBwcm9wXG4gICAqICAgICAgICBeIHBvc3NpYmxlIFwiPVwiIGFmdGVyXG4gICAqL1xuICBXcml0YWJsZSA9IDEsXG59XG5cbmV4cG9ydCBjbGFzcyBfUGFyc2VBU1Qge1xuICBwcml2YXRlIHJwYXJlbnNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNrZXRzRXhwZWN0ZWQgPSAwO1xuICBwcml2YXRlIHJicmFjZXNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgY29udGV4dCA9IFBhcnNlQ29udGV4dEZsYWdzLk5vbmU7XG5cbiAgLy8gQ2FjaGUgb2YgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZWNlcyB0byB0aGUgYWJzb2x1dGUgc291cmNlIHNwYW4gdGhleSBtYXAgdG8sIHVzZWQgdG9cbiAgLy8gcHJldmVudCBjcmVhdGluZyBzdXBlcmZsdW91cyBzb3VyY2Ugc3BhbnMgaW4gYHNvdXJjZVNwYW5gLlxuICAvLyBBIHNlcmlhbCBvZiB0aGUgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZXggaXMgdXNlZCBmb3IgbWFwcGluZyBiZWNhdXNlIGJvdGggYXJlIHN0YXRlZnVsXG4gIC8vIGFuZCBtYXkgY2hhbmdlIGZvciBzdWJzZXF1ZW50IGV4cHJlc3Npb25zIHZpc2l0ZWQgYnkgdGhlIHBhcnNlci5cbiAgcHJpdmF0ZSBzb3VyY2VTcGFuQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQWJzb2x1dGVTb3VyY2VTcGFuPigpO1xuXG4gIGluZGV4OiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGlucHV0OiBzdHJpbmcsIHB1YmxpYyBsb2NhdGlvbjogYW55LCBwdWJsaWMgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHB1YmxpYyB0b2tlbnM6IFRva2VuW10sIHB1YmxpYyBpbnB1dExlbmd0aDogbnVtYmVyLCBwdWJsaWMgcGFyc2VBY3Rpb246IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSwgcHJpdmF0ZSBvZmZzZXQ6IG51bWJlcikge31cblxuICBwZWVrKG9mZnNldDogbnVtYmVyKTogVG9rZW4ge1xuICAgIGNvbnN0IGkgPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHJldHVybiBpIDwgdGhpcy50b2tlbnMubGVuZ3RoID8gdGhpcy50b2tlbnNbaV0gOiBFT0Y7XG4gIH1cblxuICBnZXQgbmV4dCgpOiBUb2tlbiB7XG4gICAgcmV0dXJuIHRoaXMucGVlaygwKTtcbiAgfVxuXG4gIC8qKiBXaGV0aGVyIGFsbCB0aGUgcGFyc2VyIGlucHV0IGhhcyBiZWVuIHByb2Nlc3NlZC4gKi9cbiAgZ2V0IGF0RU9GKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmluZGV4ID49IHRoaXMudG9rZW5zLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmRleCBvZiB0aGUgbmV4dCB0b2tlbiB0byBiZSBwcm9jZXNzZWQsIG9yIHRoZSBlbmQgb2YgdGhlIGxhc3QgdG9rZW4gaWYgYWxsIGhhdmUgYmVlblxuICAgKiBwcm9jZXNzZWQuXG4gICAqL1xuICBnZXQgaW5wdXRJbmRleCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmF0RU9GID8gdGhpcy5jdXJyZW50RW5kSW5kZXggOiB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmQgaW5kZXggb2YgdGhlIGxhc3QgcHJvY2Vzc2VkIHRva2VuLCBvciB0aGUgc3RhcnQgb2YgdGhlIGZpcnN0IHRva2VuIGlmIG5vbmUgaGF2ZSBiZWVuXG4gICAqIHByb2Nlc3NlZC5cbiAgICovXG4gIGdldCBjdXJyZW50RW5kSW5kZXgoKTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy5pbmRleCA+IDApIHtcbiAgICAgIGNvbnN0IGN1clRva2VuID0gdGhpcy5wZWVrKC0xKTtcbiAgICAgIHJldHVybiBjdXJUb2tlbi5lbmQgKyB0aGlzLm9mZnNldDtcbiAgICB9XG4gICAgLy8gTm8gdG9rZW5zIGhhdmUgYmVlbiBwcm9jZXNzZWQgeWV0OyByZXR1cm4gdGhlIG5leHQgdG9rZW4ncyBzdGFydCBvciB0aGUgbGVuZ3RoIG9mIHRoZSBpbnB1dFxuICAgIC8vIGlmIHRoZXJlIGlzIG5vIHRva2VuLlxuICAgIGlmICh0aGlzLnRva2Vucy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGlzLmlucHV0TGVuZ3RoICsgdGhpcy5vZmZzZXQ7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhYnNvbHV0ZSBvZmZzZXQgb2YgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHRva2VuLlxuICAgKi9cbiAgZ2V0IGN1cnJlbnRBYnNvbHV0ZU9mZnNldCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmFic29sdXRlT2Zmc2V0ICsgdGhpcy5pbnB1dEluZGV4O1xuICB9XG5cbiAgc3BhbihzdGFydDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQYXJzZVNwYW4oc3RhcnQsIHRoaXMuY3VycmVudEVuZEluZGV4KTtcbiAgfVxuXG4gIHNvdXJjZVNwYW4oc3RhcnQ6IG51bWJlcik6IEFic29sdXRlU291cmNlU3BhbiB7XG4gICAgY29uc3Qgc2VyaWFsID0gYCR7c3RhcnR9QCR7dGhpcy5pbnB1dEluZGV4fWA7XG4gICAgaWYgKCF0aGlzLnNvdXJjZVNwYW5DYWNoZS5oYXMoc2VyaWFsKSkge1xuICAgICAgdGhpcy5zb3VyY2VTcGFuQ2FjaGUuc2V0KHNlcmlhbCwgdGhpcy5zcGFuKHN0YXJ0KS50b0Fic29sdXRlKHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc291cmNlU3BhbkNhY2hlLmdldChzZXJpYWwpITtcbiAgfVxuXG4gIGFkdmFuY2UoKSB7XG4gICAgdGhpcy5pbmRleCsrO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIGEgY2FsbGJhY2sgaW4gdGhlIHByb3ZpZGVkIGNvbnRleHQuXG4gICAqL1xuICBwcml2YXRlIHdpdGhDb250ZXh0PFQ+KGNvbnRleHQ6IFBhcnNlQ29udGV4dEZsYWdzLCBjYjogKCkgPT4gVCk6IFQge1xuICAgIHRoaXMuY29udGV4dCB8PSBjb250ZXh0O1xuICAgIGNvbnN0IHJldCA9IGNiKCk7XG4gICAgdGhpcy5jb250ZXh0IF49IGNvbnRleHQ7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGNvbnN1bWVPcHRpb25hbENoYXJhY3Rlcihjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNvZGUpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcGVla0tleXdvcmRMZXQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pc0tleXdvcmRMZXQoKTtcbiAgfVxuICBwZWVrS2V5d29yZEFzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5leHQuaXNLZXl3b3JkQXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdW1lcyBhbiBleHBlY3RlZCBjaGFyYWN0ZXIsIG90aGVyd2lzZSBlbWl0cyBhbiBlcnJvciBhYm91dCB0aGUgbWlzc2luZyBleHBlY3RlZCBjaGFyYWN0ZXJcbiAgICogYW5kIHNraXBzIG92ZXIgdGhlIHRva2VuIHN0cmVhbSB1bnRpbCByZWFjaGluZyBhIHJlY292ZXJhYmxlIHBvaW50LlxuICAgKlxuICAgKiBTZWUgYHRoaXMuZXJyb3JgIGFuZCBgdGhpcy5za2lwYCBmb3IgbW9yZSBkZXRhaWxzLlxuICAgKi9cbiAgZXhwZWN0Q2hhcmFjdGVyKGNvZGU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3Rlcihjb2RlKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgJHtTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpfWApO1xuICB9XG5cbiAgY29uc3VtZU9wdGlvbmFsT3BlcmF0b3Iob3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5leHQuaXNPcGVyYXRvcihvcCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBleHBlY3RPcGVyYXRvcihvcGVyYXRvcjogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3Iob3BlcmF0b3IpKSByZXR1cm47XG4gICAgdGhpcy5lcnJvcihgTWlzc2luZyBleHBlY3RlZCBvcGVyYXRvciAke29wZXJhdG9yfWApO1xuICB9XG5cbiAgcHJldHR5UHJpbnRUb2tlbih0b2s6IFRva2VuKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdG9rID09PSBFT0YgPyAnZW5kIG9mIGlucHV0JyA6IGB0b2tlbiAke3Rva31gO1xuICB9XG5cbiAgZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpOiBzdHJpbmcge1xuICAgIGNvbnN0IG4gPSB0aGlzLm5leHQ7XG4gICAgaWYgKCFuLmlzSWRlbnRpZmllcigpICYmICFuLmlzS2V5d29yZCgpKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkICR7dGhpcy5wcmV0dHlQcmludFRva2VuKG4pfSwgZXhwZWN0ZWQgaWRlbnRpZmllciBvciBrZXl3b3JkYCk7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuLnRvU3RyaW5nKCkgYXMgc3RyaW5nO1xuICB9XG5cbiAgZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgY29uc3QgbiA9IHRoaXMubmV4dDtcbiAgICBpZiAoIW4uaXNJZGVudGlmaWVyKCkgJiYgIW4uaXNLZXl3b3JkKCkgJiYgIW4uaXNTdHJpbmcoKSkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCAke3RoaXMucHJldHR5UHJpbnRUb2tlbihuKX0sIGV4cGVjdGVkIGlkZW50aWZpZXIsIGtleXdvcmQsIG9yIHN0cmluZ2ApO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbi50b1N0cmluZygpIGFzIHN0cmluZztcbiAgfVxuXG4gIHBhcnNlQ2hhaW4oKTogQVNUIHtcbiAgICBjb25zdCBleHByczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBleHBycy5wdXNoKGV4cHIpO1xuXG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluIGNoYWluZWQgZXhwcmVzc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICB9ICAvLyByZWFkIGFsbCBzZW1pY29sb25zXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAnJHt0aGlzLm5leHR9J2ApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZXhwcnMubGVuZ3RoID09IDApIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIGlmIChleHBycy5sZW5ndGggPT0gMSkgcmV0dXJuIGV4cHJzWzBdO1xuICAgIHJldHVybiBuZXcgQ2hhaW4odGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZXhwcnMpO1xuICB9XG5cbiAgcGFyc2VQaXBlKCk6IEFTVCB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSkge1xuICAgICAgaWYgKHRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgdGhpcy5lcnJvcignQ2Fubm90IGhhdmUgYSBwaXBlIGluIGFuIGFjdGlvbiBleHByZXNzaW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk7XG4gICAgICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zb3VyY2VTcGFuKG5hbWVTdGFydCk7XG4gICAgICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW107XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pKSB7XG4gICAgICAgICAgYXJncy5wdXNoKHRoaXMucGFyc2VFeHByZXNzaW9uKCkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBCaW5kaW5nUGlwZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQsIG5hbWUsIGFyZ3MsIG5hbWVTcGFuKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbigpOiBBU1Qge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgfVxuXG4gIHBhcnNlQ29uZGl0aW9uYWwoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlTG9naWNhbE9yKCk7XG5cbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPycpKSB7XG4gICAgICBjb25zdCB5ZXMgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgbGV0IG5vOiBBU1Q7XG4gICAgICBpZiAoIXRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgY29uc3QgZW5kID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgICAgIHRoaXMuZXJyb3IoYENvbmRpdGlvbmFsIGV4cHJlc3Npb24gJHtleHByZXNzaW9ufSByZXF1aXJlcyBhbGwgMyBleHByZXNzaW9uc2ApO1xuICAgICAgICBubyA9IG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBubyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgeWVzLCBubyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VMb2dpY2FsT3IoKTogQVNUIHtcbiAgICAvLyAnfHwnXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG4gICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3x8JykpIHtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKTtcbiAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgJ3x8JywgcmVzdWx0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxvZ2ljYWxBbmQoKTogQVNUIHtcbiAgICAvLyAnJiYnXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCcmJicpKSB7XG4gICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnJiYnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXF1YWxpdHkoKTogQVNUIHtcbiAgICAvLyAnPT0nLCchPScsJz09PScsJyE9PSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnPT0nOlxuICAgICAgICBjYXNlICc9PT0nOlxuICAgICAgICBjYXNlICchPSc6XG4gICAgICAgIGNhc2UgJyE9PSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlUmVsYXRpb25hbCgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VSZWxhdGlvbmFsKCk6IEFTVCB7XG4gICAgLy8gJzwnLCAnPicsICc8PScsICc+PSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJzwnOlxuICAgICAgICBjYXNlICc+JzpcbiAgICAgICAgY2FzZSAnPD0nOlxuICAgICAgICBjYXNlICc+PSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlQWRkaXRpdmUoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlQWRkaXRpdmUoKTogQVNUIHtcbiAgICAvLyAnKycsICctJ1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCByaWdodCA9IHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VNdWx0aXBsaWNhdGl2ZSgpOiBBU1Qge1xuICAgIC8vICcqJywgJyUnLCAnLydcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcqJzpcbiAgICAgICAgY2FzZSAnJSc6XG4gICAgICAgIGNhc2UgJy8nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCByaWdodCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlUHJlZml4KCk6IEFTVCB7XG4gICAgaWYgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIGxldCByZXN1bHQ6IEFTVDtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBVbmFyeS5jcmVhdGVQbHVzKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gVW5hcnkuY3JlYXRlTWludXModGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgICAgY2FzZSAnISc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgUHJlZml4Tm90KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhcnNlQ2FsbENoYWluKCk7XG4gIH1cblxuICBwYXJzZUNhbGxDaGFpbigpOiBBU1Qge1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUHJpbWFyeSgpO1xuICAgIGNvbnN0IHJlc3VsdFN0YXJ0ID0gcmVzdWx0LnNwYW4uc3RhcnQ7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kUEVSSU9EKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgZmFsc2UpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz8uJykpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChyZXN1bHQsIHRydWUpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0tFVCkpIHtcbiAgICAgICAgdGhpcy53aXRoQ29udGV4dChQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgICAgICBjb25zdCBrZXkgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgICAgIGlmIChrZXkgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IoYEtleSBhY2Nlc3MgY2Fubm90IGJlIGVtcHR5YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQtLTtcbiAgICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7XG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgS2V5ZWRXcml0ZShcbiAgICAgICAgICAgICAgICB0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGtleSwgdmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgICAgIG5ldyBLZXllZFJlYWQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBrZXkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnBhcnNlQ2FsbEFyZ3VtZW50cygpO1xuICAgICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBGdW5jdGlvbkNhbGwodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBhcmdzKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCchJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IE5vbk51bGxBc3NlcnQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0KTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZVByaW1hcnkoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZE51bGwoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbnVsbCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRVbmRlZmluZWQoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdm9pZCAwKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRydWUoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdHJ1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRGYWxzZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRUaGlzKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBUaGlzUmVjZWl2ZXIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICB0aGlzLnJicmFja2V0c0V4cGVjdGVkKys7XG4gICAgICBjb25zdCBlbGVtZW50cyA9IHRoaXMucGFyc2VFeHByZXNzaW9uTGlzdChjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGVsZW1lbnRzKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUxpdGVyYWxNYXAoKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzSWRlbnRpZmllcigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChcbiAgICAgICAgICBuZXcgSW1wbGljaXRSZWNlaXZlcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKSwgZmFsc2UpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNOdW1iZXIoKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLm5leHQudG9OdW1iZXIoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzU3RyaW5nKCkpIHtcbiAgICAgIGNvbnN0IGxpdGVyYWxWYWx1ZSA9IHRoaXMubmV4dC50b1N0cmluZygpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbGl0ZXJhbFZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA+PSB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb246ICR7dGhpcy5pbnB1dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7dGhpcy5uZXh0fWApO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uTGlzdCh0ZXJtaW5hdG9yOiBudW1iZXIpOiBBU1RbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBBU1RbXSA9IFtdO1xuICAgIGlmICghdGhpcy5uZXh0LmlzQ2hhcmFjdGVyKHRlcm1pbmF0b3IpKSB7XG4gICAgICBkbyB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxpdGVyYWxNYXAoKTogTGl0ZXJhbE1hcCB7XG4gICAgY29uc3Qga2V5czogTGl0ZXJhbE1hcEtleVtdID0gW107XG4gICAgY29uc3QgdmFsdWVzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpO1xuICAgIGlmICghdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSkpIHtcbiAgICAgIHRoaXMucmJyYWNlc0V4cGVjdGVkKys7XG4gICAgICBkbyB7XG4gICAgICAgIGNvbnN0IHF1b3RlZCA9IHRoaXMubmV4dC5pc1N0cmluZygpO1xuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmRPclN0cmluZygpO1xuICAgICAgICBrZXlzLnB1c2goe2tleSwgcXVvdGVkfSk7XG4gICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7XG4gICAgICAgIHZhbHVlcy5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgICB0aGlzLnJicmFjZXNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgTGl0ZXJhbE1hcCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBrZXlzLCB2YWx1ZXMpO1xuICB9XG5cbiAgcGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwocmVjZWl2ZXI6IEFTVCwgaXNTYWZlOiBib29sZWFuID0gZmFsc2UpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gcmVjZWl2ZXIuc3Bhbi5zdGFydDtcbiAgICBjb25zdCBuYW1lU3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgY29uc3QgaWQgPSB0aGlzLndpdGhDb250ZXh0KFBhcnNlQ29udGV4dEZsYWdzLldyaXRhYmxlLCAoKSA9PiB7XG4gICAgICBjb25zdCBpZCA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpO1xuICAgICAgaWYgKGlkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmVycm9yKGBFeHBlY3RlZCBpZGVudGlmaWVyIGZvciBwcm9wZXJ0eSBhY2Nlc3NgLCByZWNlaXZlci5zcGFuLmVuZCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaWQ7XG4gICAgfSk7XG4gICAgY29uc3QgbmFtZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4obmFtZVN0YXJ0KTtcblxuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnBhcnNlQ2FsbEFyZ3VtZW50cygpO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgY29uc3Qgc3BhbiA9IHRoaXMuc3BhbihzdGFydCk7XG4gICAgICBjb25zdCBzb3VyY2VTcGFuID0gdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KTtcbiAgICAgIHJldHVybiBpc1NhZmUgPyBuZXcgU2FmZU1ldGhvZENhbGwoc3Bhbiwgc291cmNlU3BhbiwgbmFtZVNwYW4sIHJlY2VpdmVyLCBpZCwgYXJncykgOlxuICAgICAgICAgICAgICAgICAgICAgIG5ldyBNZXRob2RDYWxsKHNwYW4sIHNvdXJjZVNwYW4sIG5hbWVTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpc1NhZmUpIHtcbiAgICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgIHRoaXMuZXJyb3IoJ1RoZSBcXCc/LlxcJyBvcGVyYXRvciBjYW5ub3QgYmUgdXNlZCBpbiB0aGUgYXNzaWdubWVudCcpO1xuICAgICAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgU2FmZVByb3BlcnR5UmVhZChcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbmFtZVNwYW4sIHJlY2VpdmVyLCBpZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICBpZiAoIXRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IoJ0JpbmRpbmdzIGNhbm5vdCBjb250YWluIGFzc2lnbm1lbnRzJyk7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvcGVydHlXcml0ZShcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbmFtZVNwYW4sIHJlY2VpdmVyLCBpZCwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvcGVydHlSZWFkKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWNlaXZlciwgaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcGFyc2VDYWxsQXJndW1lbnRzKCk6IEJpbmRpbmdQaXBlW10ge1xuICAgIGlmICh0aGlzLm5leHQuaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikpIHJldHVybiBbXTtcbiAgICBjb25zdCBwb3NpdGlvbmFsczogQVNUW10gPSBbXTtcbiAgICBkbyB7XG4gICAgICBwb3NpdGlvbmFscy5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSkpO1xuICAgIHJldHVybiBwb3NpdGlvbmFscyBhcyBCaW5kaW5nUGlwZVtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbiBpZGVudGlmaWVyLCBhIGtleXdvcmQsIGEgc3RyaW5nIHdpdGggYW4gb3B0aW9uYWwgYC1gIGluIGJldHdlZW4sXG4gICAqIGFuZCByZXR1cm5zIHRoZSBzdHJpbmcgYWxvbmcgd2l0aCBpdHMgYWJzb2x1dGUgc291cmNlIHNwYW4uXG4gICAqL1xuICBleHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllciB7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGxldCBvcGVyYXRvckZvdW5kID0gZmFsc2U7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTtcbiAgICAgIG9wZXJhdG9yRm91bmQgPSB0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCctJyk7XG4gICAgICBpZiAob3BlcmF0b3JGb3VuZCkge1xuICAgICAgICByZXN1bHQgKz0gJy0nO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKG9wZXJhdG9yRm91bmQpO1xuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2U6IHJlc3VsdCxcbiAgICAgIHNwYW46IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oc3RhcnQsIHN0YXJ0ICsgcmVzdWx0Lmxlbmd0aCksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBtaWNyb3N5bnRheCB0ZW1wbGF0ZSBleHByZXNzaW9uIGFuZCByZXR1cm4gYSBsaXN0IG9mIGJpbmRpbmdzIG9yXG4gICAqIHBhcnNpbmcgZXJyb3JzIGluIGNhc2UgdGhlIGdpdmVuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgIDxkaXYgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGluZGV4IGFzIGk7IHRyYWNrQnk6IGZ1bmNcIj5cbiAgICogYGBgXG4gICAqIGNvbnRhaW5zIGZpdmUgYmluZGluZ3M6XG4gICAqIDEuIG5nRm9yIC0+IG51bGxcbiAgICogMi4gaXRlbSAtPiBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRcbiAgICogMy4gbmdGb3JPZiAtPiBpdGVtc1xuICAgKiA0LiBpIC0+IE5nRm9yT2ZDb250ZXh0LmluZGV4XG4gICAqIDUuIG5nRm9yVHJhY2tCeSAtPiBmdW5jXG4gICAqXG4gICAqIEZvciBhIGZ1bGwgZGVzY3JpcHRpb24gb2YgdGhlIG1pY3Jvc3ludGF4IGdyYW1tYXIsIHNlZVxuICAgKiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9taGV2ZXJ5L2QzNTMwMjk0Y2ZmMmU0YTFiM2ZlMTVmZjc1ZDA4ODU1XG4gICAqXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZUtleSBuYW1lIG9mIHRoZSBtaWNyb3N5bnRheCBkaXJlY3RpdmUsIGxpa2UgbmdJZiwgbmdGb3IsXG4gICAqIHdpdGhvdXQgdGhlICosIGFsb25nIHdpdGggaXRzIGFic29sdXRlIHNwYW4uXG4gICAqL1xuICBwYXJzZVRlbXBsYXRlQmluZGluZ3ModGVtcGxhdGVLZXk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gICAgY29uc3QgYmluZGluZ3M6IFRlbXBsYXRlQmluZGluZ1tdID0gW107XG5cbiAgICAvLyBUaGUgZmlyc3QgYmluZGluZyBpcyBmb3IgdGhlIHRlbXBsYXRlIGtleSBpdHNlbGZcbiAgICAvLyBJbiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiLCBrZXkgPSBcIm5nRm9yXCIsIHZhbHVlID0gbnVsbFxuICAgIC8vIEluICpuZ0lmPVwiY29uZCB8IHBpcGVcIiwga2V5ID0gXCJuZ0lmXCIsIHZhbHVlID0gXCJjb25kIHwgcGlwZVwiXG4gICAgYmluZGluZ3MucHVzaCguLi50aGlzLnBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKHRlbXBsYXRlS2V5KSk7XG5cbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgLy8gSWYgaXQgc3RhcnRzIHdpdGggJ2xldCcsIHRoZW4gdGhpcyBtdXN0IGJlIHZhcmlhYmxlIGRlY2xhcmF0aW9uXG4gICAgICBjb25zdCBsZXRCaW5kaW5nID0gdGhpcy5wYXJzZUxldEJpbmRpbmcoKTtcbiAgICAgIGlmIChsZXRCaW5kaW5nKSB7XG4gICAgICAgIGJpbmRpbmdzLnB1c2gobGV0QmluZGluZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUd28gcG9zc2libGUgY2FzZXMgaGVyZSwgZWl0aGVyIGB2YWx1ZSBcImFzXCIga2V5YCBvclxuICAgICAgICAvLyBcImRpcmVjdGl2ZS1rZXl3b3JkIGV4cHJlc3Npb25cIi4gV2UgZG9uJ3Qga25vdyB3aGljaCBjYXNlLCBidXQgYm90aFxuICAgICAgICAvLyBcInZhbHVlXCIgYW5kIFwiZGlyZWN0aXZlLWtleXdvcmRcIiBhcmUgdGVtcGxhdGUgYmluZGluZyBrZXksIHNvIGNvbnN1bWVcbiAgICAgICAgLy8gdGhlIGtleSBmaXJzdC5cbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICAgICAgLy8gUGVlayBhdCB0aGUgbmV4dCB0b2tlbiwgaWYgaXQgaXMgXCJhc1wiIHRoZW4gdGhpcyBtdXN0IGJlIHZhcmlhYmxlXG4gICAgICAgIC8vIGRlY2xhcmF0aW9uLlxuICAgICAgICBjb25zdCBiaW5kaW5nID0gdGhpcy5wYXJzZUFzQmluZGluZyhrZXkpO1xuICAgICAgICBpZiAoYmluZGluZykge1xuICAgICAgICAgIGJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIHRoZSBrZXkgbXVzdCBiZSBhIGRpcmVjdGl2ZSBrZXl3b3JkLCBsaWtlIFwib2ZcIi4gVHJhbnNmb3JtXG4gICAgICAgICAgLy8gdGhlIGtleSB0byBhY3R1YWwga2V5LiBFZy4gb2YgLT4gbmdGb3JPZiwgdHJhY2tCeSAtPiBuZ0ZvclRyYWNrQnlcbiAgICAgICAgICBrZXkuc291cmNlID0gdGVtcGxhdGVLZXkuc291cmNlICsga2V5LnNvdXJjZVswXS50b1VwcGVyQ2FzZSgpICsga2V5LnNvdXJjZS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgYmluZGluZ3MucHVzaCguLi50aGlzLnBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKGtleSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdChiaW5kaW5ncywgW10gLyogd2FybmluZ3MgKi8sIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBhIGRpcmVjdGl2ZSBrZXl3b3JkLCBmb2xsb3dlZCBieSBhIG1hbmRhdG9yeSBleHByZXNzaW9uLlxuICAgKiBGb3IgZXhhbXBsZSwgXCJvZiBpdGVtc1wiLCBcInRyYWNrQnk6IGZ1bmNcIi5cbiAgICogVGhlIGJpbmRpbmdzIGFyZTogbmdGb3JPZiAtPiBpdGVtcywgbmdGb3JUcmFja0J5IC0+IGZ1bmNcbiAgICogVGhlcmUgY291bGQgYmUgYW4gb3B0aW9uYWwgXCJhc1wiIGJpbmRpbmcgdGhhdCBmb2xsb3dzIHRoZSBleHByZXNzaW9uLlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXMgfCBzbGljZTowOjEgYXMgY29sbGVjdGlvblwiLlxuICAgKiAgICAgICAgICAgICAgICAgICAgXl4gXl5eXl5eXl5eXl5eXl5eXl4gXl5eXl5eXl5eXl5eXlxuICAgKiAgICAgICAgICAgICAgIGtleXdvcmQgICAgYm91bmQgdGFyZ2V0ICAgb3B0aW9uYWwgJ2FzJyBiaW5kaW5nXG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ga2V5IGJpbmRpbmcga2V5LCBmb3IgZXhhbXBsZSwgbmdGb3IsIG5nSWYsIG5nRm9yT2YsIGFsb25nIHdpdGggaXRzXG4gICAqIGFic29sdXRlIHNwYW4uXG4gICAqL1xuICBwcml2YXRlIHBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKGtleTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcik6IFRlbXBsYXRlQmluZGluZ1tdIHtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcbiAgICB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pOyAgLy8gdHJhY2tCeTogdHJhY2tCeUZ1bmN0aW9uXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk7XG4gICAgbGV0IHNwYW5FbmQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICAvLyBUaGUgYmluZGluZyBjb3VsZCBvcHRpb25hbGx5IGJlIGZvbGxvd2VkIGJ5IFwiYXNcIi4gRm9yIGV4YW1wbGUsXG4gICAgLy8gKm5nSWY9XCJjb25kIHwgcGlwZSBhcyB4XCIuIEluIHRoaXMgY2FzZSwgdGhlIGtleSBpbiB0aGUgXCJhc1wiIGJpbmRpbmdcbiAgICAvLyBpcyBcInhcIiBhbmQgdGhlIHZhbHVlIGlzIHRoZSB0ZW1wbGF0ZSBrZXkgaXRzZWxmIChcIm5nSWZcIikuIE5vdGUgdGhhdCB0aGVcbiAgICAvLyAna2V5JyBpbiB0aGUgY3VycmVudCBjb250ZXh0IG5vdyBiZWNvbWVzIHRoZSBcInZhbHVlXCIgaW4gdGhlIG5leHQgYmluZGluZy5cbiAgICBjb25zdCBhc0JpbmRpbmcgPSB0aGlzLnBhcnNlQXNCaW5kaW5nKGtleSk7XG4gICAgaWYgKCFhc0JpbmRpbmcpIHtcbiAgICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICAgIHNwYW5FbmQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oa2V5LnNwYW4uc3RhcnQsIHNwYW5FbmQpO1xuICAgIGJpbmRpbmdzLnB1c2gobmV3IEV4cHJlc3Npb25CaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpKTtcbiAgICBpZiAoYXNCaW5kaW5nKSB7XG4gICAgICBiaW5kaW5ncy5wdXNoKGFzQmluZGluZyk7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5ncztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGV4cHJlc3Npb24gQVNUIGZvciB0aGUgYm91bmQgdGFyZ2V0IG9mIGEgZGlyZWN0aXZlIGtleXdvcmRcbiAgICogYmluZGluZy4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0lmPVwiY29uZGl0aW9uIHwgcGlwZVwiXG4gICAqICAgICAgICAgIF5eXl5eXl5eXl5eXl5eXl4gYm91bmQgdGFyZ2V0IGZvciBcIm5nSWZcIlxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zXCJcbiAgICogICAgICAgICAgICAgICAgICAgICAgIF5eXl5eIGJvdW5kIHRhcmdldCBmb3IgXCJuZ0Zvck9mXCJcbiAgICogYGBgXG4gICAqL1xuICBwcml2YXRlIGdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgaWYgKHRoaXMubmV4dCA9PT0gRU9GIHx8IHRoaXMucGVla0tleXdvcmRBcygpIHx8IHRoaXMucGVla0tleXdvcmRMZXQoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGFzdCA9IHRoaXMucGFyc2VQaXBlKCk7ICAvLyBleGFtcGxlOiBcImNvbmRpdGlvbiB8IGFzeW5jXCJcbiAgICBjb25zdCB7c3RhcnQsIGVuZH0gPSBhc3Quc3BhbjtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIHZhbHVlLCB0aGlzLmxvY2F0aW9uLCB0aGlzLmFic29sdXRlT2Zmc2V0ICsgc3RhcnQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGJpbmRpbmcgZm9yIGEgdmFyaWFibGUgZGVjbGFyZWQgdXNpbmcgYGFzYC4gTm90ZSB0aGF0IHRoZSBvcmRlclxuICAgKiBvZiB0aGUga2V5LXZhbHVlIHBhaXIgaW4gdGhpcyBkZWNsYXJhdGlvbiBpcyByZXZlcnNlZC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpXCJcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBeXl5eXiAgICBeXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgICAga2V5XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgbmFtZSBvZiB0aGUgdmFsdWUgaW4gdGhlIGRlY2xhcmF0aW9uLCBcIm5nSWZcIiBpbiB0aGUgZXhhbXBsZVxuICAgKiBhYm92ZSwgYWxvbmcgd2l0aCBpdHMgYWJzb2x1dGUgc3Bhbi5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VBc0JpbmRpbmcodmFsdWU6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmd8bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBlZWtLZXl3b3JkQXMoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gY29uc3VtZSB0aGUgJ2FzJyBrZXl3b3JkXG4gICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4odmFsdWUuc3Bhbi5zdGFydCwgdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQpO1xuICAgIHJldHVybiBuZXcgVmFyaWFibGVCaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYmluZGluZyBmb3IgYSB2YXJpYWJsZSBkZWNsYXJlZCB1c2luZyBgbGV0YC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBsZXQgaT1pbmRleDtcIlxuICAgKiAgICAgICAgICAgXl5eXl5eXl4gICAgICAgICAgIF5eXl5eXl5eXl5eXG4gICAqIGBgYFxuICAgKiBJbiB0aGUgZmlyc3QgYmluZGluZywgYGl0ZW1gIGlzIGJvdW5kIHRvIGBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRgLlxuICAgKiBJbiB0aGUgc2Vjb25kIGJpbmRpbmcsIGBpYCBpcyBib3VuZCB0byBgTmdGb3JPZkNvbnRleHQuaW5kZXhgLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUxldEJpbmRpbmcoKTogVGVtcGxhdGVCaW5kaW5nfG51bGwge1xuICAgIGlmICghdGhpcy5wZWVrS2V5d29yZExldCgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc3BhblN0YXJ0ID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBjb25zdW1lIHRoZSAnbGV0JyBrZXl3b3JkXG4gICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICBsZXQgdmFsdWU6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgdmFsdWUgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIH1cbiAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oc3BhblN0YXJ0LCB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldCk7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3VtZSB0aGUgb3B0aW9uYWwgc3RhdGVtZW50IHRlcm1pbmF0b3I6IHNlbWljb2xvbiBvciBjb21tYS5cbiAgICovXG4gIHByaXZhdGUgY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKSB7XG4gICAgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgfHwgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvcmRzIGFuIGVycm9yIGFuZCBza2lwcyBvdmVyIHRoZSB0b2tlbiBzdHJlYW0gdW50aWwgcmVhY2hpbmcgYSByZWNvdmVyYWJsZSBwb2ludC4gU2VlXG4gICAqIGB0aGlzLnNraXBgIGZvciBtb3JlIGRldGFpbHMgb24gdG9rZW4gc2tpcHBpbmcuXG4gICAqL1xuICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIGluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihtZXNzYWdlLCB0aGlzLmlucHV0LCB0aGlzLmxvY2F0aW9uVGV4dChpbmRleCksIHRoaXMubG9jYXRpb24pKTtcbiAgICB0aGlzLnNraXAoKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9jYXRpb25UZXh0KGluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwpIHtcbiAgICBpZiAoaW5kZXggPT0gbnVsbCkgaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIHJldHVybiAoaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID8gYGF0IGNvbHVtbiAke3RoaXMudG9rZW5zW2luZGV4XS5pbmRleCArIDF9IGluYCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgYXQgdGhlIGVuZCBvZiB0aGUgZXhwcmVzc2lvbmA7XG4gIH1cblxuICAvKipcbiAgICogRXJyb3IgcmVjb3Zlcnkgc2hvdWxkIHNraXAgdG9rZW5zIHVudGlsIGl0IGVuY291bnRlcnMgYSByZWNvdmVyeSBwb2ludC5cbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgdHJlYXRlZCBhcyB1bmNvbmRpdGlvbmFsIHJlY292ZXJ5IHBvaW50czpcbiAgICogICAtIGVuZCBvZiBpbnB1dFxuICAgKiAgIC0gJzsnIChwYXJzZUNoYWluKCkgaXMgYWx3YXlzIHRoZSByb290IHByb2R1Y3Rpb24sIGFuZCBpdCBleHBlY3RzIGEgJzsnKVxuICAgKiAgIC0gJ3wnIChzaW5jZSBwaXBlcyBtYXkgYmUgY2hhaW5lZCBhbmQgZWFjaCBwaXBlIGV4cHJlc3Npb24gbWF5IGJlIHRyZWF0ZWQgaW5kZXBlbmRlbnRseSlcbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgY29uZGl0aW9uYWwgcmVjb3ZlcnkgcG9pbnRzOlxuICAgKiAgIC0gJyknLCAnfScsICddJyBpZiBvbmUgb2YgY2FsbGluZyBwcm9kdWN0aW9ucyBpcyBleHBlY3Rpbmcgb25lIG9mIHRoZXNlIHN5bWJvbHNcbiAgICogICAgIC0gVGhpcyBhbGxvd3Mgc2tpcCgpIHRvIHJlY292ZXIgZnJvbSBlcnJvcnMgc3VjaCBhcyAnKGEuKSArIDEnIGFsbG93aW5nIG1vcmUgb2YgdGhlIEFTVCB0b1xuICAgKiAgICAgICBiZSByZXRhaW5lZCAoaXQgZG9lc24ndCBza2lwIGFueSB0b2tlbnMgYXMgdGhlICcpJyBpcyByZXRhaW5lZCBiZWNhdXNlIG9mIHRoZSAnKCcgYmVnaW5zXG4gICAqICAgICAgIGFuICcoJyA8ZXhwcj4gJyknIHByb2R1Y3Rpb24pLlxuICAgKiAgICAgICBUaGUgcmVjb3ZlcnkgcG9pbnRzIG9mIGdyb3VwaW5nIHN5bWJvbHMgbXVzdCBiZSBjb25kaXRpb25hbCBhcyB0aGV5IG11c3QgYmUgc2tpcHBlZCBpZlxuICAgKiAgICAgICBub25lIG9mIHRoZSBjYWxsaW5nIHByb2R1Y3Rpb25zIGFyZSBub3QgZXhwZWN0aW5nIHRoZSBjbG9zaW5nIHRva2VuIGVsc2Ugd2Ugd2lsbCBuZXZlclxuICAgKiAgICAgICBtYWtlIHByb2dyZXNzIGluIHRoZSBjYXNlIG9mIGFuIGV4dHJhbmVvdXMgZ3JvdXAgY2xvc2luZyBzeW1ib2wgKHN1Y2ggYXMgYSBzdHJheSAnKScpLlxuICAgKiAgICAgICBUaGF0IGlzLCB3ZSBza2lwIGEgY2xvc2luZyBzeW1ib2wgaWYgd2UgYXJlIG5vdCBpbiBhIGdyb3VwaW5nIHByb2R1Y3Rpb24uXG4gICAqICAgLSAnPScgaW4gYSBgV3JpdGFibGVgIGNvbnRleHRcbiAgICogICAgIC0gSW4gdGhpcyBjb250ZXh0LCB3ZSBhcmUgYWJsZSB0byByZWNvdmVyIGFmdGVyIHNlZWluZyB0aGUgYD1gIG9wZXJhdG9yLCB3aGljaFxuICAgKiAgICAgICBzaWduYWxzIHRoZSBwcmVzZW5jZSBvZiBhbiBpbmRlcGVuZGVudCBydmFsdWUgZXhwcmVzc2lvbiBmb2xsb3dpbmcgdGhlIGA9YCBvcGVyYXRvci5cbiAgICpcbiAgICogSWYgYSBwcm9kdWN0aW9uIGV4cGVjdHMgb25lIG9mIHRoZXNlIHRva2VuIGl0IGluY3JlbWVudHMgdGhlIGNvcnJlc3BvbmRpbmcgbmVzdGluZyBjb3VudCxcbiAgICogYW5kIHRoZW4gZGVjcmVtZW50cyBpdCBqdXN0IHByaW9yIHRvIGNoZWNraW5nIGlmIHRoZSB0b2tlbiBpcyBpbiB0aGUgaW5wdXQuXG4gICAqL1xuICBwcml2YXRlIHNraXAoKSB7XG4gICAgbGV0IG4gPSB0aGlzLm5leHQ7XG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggJiYgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgJiZcbiAgICAgICAgICAgIW4uaXNPcGVyYXRvcignfCcpICYmICh0aGlzLnJwYXJlbnNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2VzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkgJiZcbiAgICAgICAgICAgKHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpKSAmJlxuICAgICAgICAgICAoISh0aGlzLmNvbnRleHQgJiBQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSkgfHwgIW4uaXNPcGVyYXRvcignPScpKSkge1xuICAgICAgaWYgKHRoaXMubmV4dC5pc0Vycm9yKCkpIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZXJFcnJvcih0aGlzLm5leHQudG9TdHJpbmcoKSEsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KCksIHRoaXMubG9jYXRpb24pKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbiA9IHRoaXMubmV4dDtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFRoaXNSZWNlaXZlcihhc3Q6IFRoaXNSZWNlaXZlciwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC52YWx1ZXMsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRVbmFyeShhc3Q6IFVuYXJ5LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaCgncGlwZXMnKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0QWxsKGFzdHM6IGFueVtdLCBjb250ZXh0OiBhbnkpOiBhbnlbXSB7XG4gICAgcmV0dXJuIGFzdHMubWFwKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSkge31cbn1cblxuLyoqXG4gKiBUaGlzIGNsYXNzIGltcGxlbWVudHMgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgdXNlZCBpbiBWaWV3IEVuZ2luZSBhbmQgcGVyZm9ybXMgbW9yZSBzdHJpY3QgY2hlY2tzXG4gKiB0byBtYWtlIHN1cmUgaG9zdCBiaW5kaW5ncyBkbyBub3QgY29udGFpbiBwaXBlcy4gSW4gVmlldyBFbmdpbmUsIGhhdmluZyBwaXBlcyBpbiBob3N0IGJpbmRpbmdzIGlzXG4gKiBub3Qgc3VwcG9ydGVkIGFzIHdlbGwsIGJ1dCBpbiBzb21lIGNhc2VzIChsaWtlIGAhKHZhbHVlIHwgYXN5bmMpYCkgdGhlIGVycm9yIGlzIG5vdCB0cmlnZ2VyZWQgYXRcbiAqIGNvbXBpbGUgdGltZS4gSW4gb3JkZXIgdG8gcHJlc2VydmUgVmlldyBFbmdpbmUgYmVoYXZpb3IsIG1vcmUgc3RyaWN0IGNoZWNrcyBhcmUgaW50cm9kdWNlZCBmb3JcbiAqIEl2eSBtb2RlIG9ubHkuXG4gKi9cbmNsYXNzIEl2eVNpbXBsZUV4cHJlc3Npb25DaGVja2VyIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFNpbXBsZUV4cHJlc3Npb25DaGVja2VyIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0UGlwZSgpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKCdwaXBlcycpO1xuICB9XG59XG4iXX0=