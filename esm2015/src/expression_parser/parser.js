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
import { AbsoluteSourceSpan, ASTWithSource, Binary, BindingPipe, Chain, Conditional, EmptyExpr, ExpressionBinding, FunctionCall, ImplicitReceiver, Interpolation, KeyedRead, KeyedWrite, LiteralArray, LiteralMap, LiteralPrimitive, MethodCall, NonNullAssert, ParserError, ParseSpan, PrefixNot, PropertyRead, PropertyWrite, Quote, RecursiveAstVisitor, SafeMethodCall, SafePropertyRead, Unary, VariableBinding } from './ast';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sbUNBQW1DLENBQUM7QUFDcEcsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVyQyxPQUFPLEVBQUMsa0JBQWtCLEVBQW1CLGFBQWEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFpQixnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBOEMsS0FBSyxFQUFFLGVBQWUsRUFBQyxNQUFNLE9BQU8sQ0FBQztBQUM5ZSxPQUFPLEVBQUMsR0FBRyxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQWdCLFNBQVMsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUU1RSxNQUFNLE9BQU8sa0JBQWtCO0lBQzdCLFlBQ1csT0FBaUIsRUFBUyxXQUEyQyxFQUNyRSxXQUFxQixFQUFTLGdCQUFnRCxFQUM5RSxPQUFpQjtRQUZqQixZQUFPLEdBQVAsT0FBTyxDQUFVO1FBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQWdDO1FBQ3JFLGdCQUFXLEdBQVgsV0FBVyxDQUFVO1FBQVMscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFnQztR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LFVBQVUsQ0FBQyxHQUFVLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFdkMsV0FBVyxDQUFDLEdBQVcsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUV6QyxjQUFjLENBQUMsR0FBYyxFQUFFLE9BQVksSUFBRyxDQUFDO0lBRS9DLGtCQUFrQixDQUFDLEdBQWtCLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFdkQsZ0JBQWdCLENBQUMsR0FBZ0IsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUVuRCxTQUFTLENBQUMsR0FBZ0IsRUFBRSxPQUFZO1FBQ3RDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFRCxjQUFjLENBQUMsR0FBYyxFQUFFLE9BQVksSUFBRyxDQUFDO0lBRS9DLGVBQWUsQ0FBQyxHQUFlLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFakQsUUFBUSxDQUFDLElBQVcsRUFBRSxPQUFZO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVELFVBQVUsQ0FBQyxHQUFVLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFFdkMsVUFBVSxDQUFDLEdBQVUsRUFBRSxPQUFZLElBQUcsQ0FBQztDQUN4QztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sMEJBQTJCLFNBQVEsbUJBQW1CO0lBQTVEOztRQUNFLFdBQU0sR0FBYSxFQUFFLENBQUM7SUFLeEIsQ0FBQztJQUhDLFNBQVM7UUFDUCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM1QixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi4vY2hhcnMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtlc2NhcGVSZWdFeHB9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge0Fic29sdXRlU291cmNlU3BhbiwgQVNULCBBc3RWaXNpdG9yLCBBU1RXaXRoU291cmNlLCBCaW5hcnksIEJpbmRpbmdQaXBlLCBDaGFpbiwgQ29uZGl0aW9uYWwsIEVtcHR5RXhwciwgRXhwcmVzc2lvbkJpbmRpbmcsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgS2V5ZWRSZWFkLCBLZXllZFdyaXRlLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxNYXBLZXksIExpdGVyYWxQcmltaXRpdmUsIE1ldGhvZENhbGwsIE5vbk51bGxBc3NlcnQsIFBhcnNlckVycm9yLCBQYXJzZVNwYW4sIFByZWZpeE5vdCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBRdW90ZSwgUmVjdXJzaXZlQXN0VmlzaXRvciwgU2FmZU1ldGhvZENhbGwsIFNhZmVQcm9wZXJ0eVJlYWQsIFRlbXBsYXRlQmluZGluZywgVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllciwgVW5hcnksIFZhcmlhYmxlQmluZGluZ30gZnJvbSAnLi9hc3QnO1xuaW1wb3J0IHtFT0YsIGlzSWRlbnRpZmllciwgaXNRdW90ZSwgTGV4ZXIsIFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4vbGV4ZXInO1xuXG5leHBvcnQgY2xhc3MgU3BsaXRJbnRlcnBvbGF0aW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3RyaW5nczogc3RyaW5nW10sIHB1YmxpYyBzdHJpbmdTcGFuczoge3N0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyfVtdLFxuICAgICAgcHVibGljIGV4cHJlc3Npb25zOiBzdHJpbmdbXSwgcHVibGljIGV4cHJlc3Npb25zU3BhbnM6IHtzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcn1bXSxcbiAgICAgIHB1YmxpYyBvZmZzZXRzOiBudW1iZXJbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdGVtcGxhdGVCaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10sIHB1YmxpYyB3YXJuaW5nczogc3RyaW5nW10sXG4gICAgICBwdWJsaWMgZXJyb3JzOiBQYXJzZXJFcnJvcltdKSB7fVxufVxuXG5jb25zdCBkZWZhdWx0SW50ZXJwb2xhdGVSZWdFeHAgPSBfY3JlYXRlSW50ZXJwb2xhdGVSZWdFeHAoREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk7XG5mdW5jdGlvbiBfZ2V0SW50ZXJwb2xhdGVSZWdFeHAoY29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogUmVnRXhwIHtcbiAgaWYgKGNvbmZpZyA9PT0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRykge1xuICAgIHJldHVybiBkZWZhdWx0SW50ZXJwb2xhdGVSZWdFeHA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBSZWdFeHAge1xuICBjb25zdCBwYXR0ZXJuID0gZXNjYXBlUmVnRXhwKGNvbmZpZy5zdGFydCkgKyAnKFtcXFxcc1xcXFxTXSo/KScgKyBlc2NhcGVSZWdFeHAoY29uZmlnLmVuZCk7XG4gIHJldHVybiBuZXcgUmVnRXhwKHBhdHRlcm4sICdnJyk7XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2xleGVyOiBMZXhlcikge31cblxuICBzaW1wbGVFeHByZXNzaW9uQ2hlY2tlciA9IFNpbXBsZUV4cHJlc3Npb25DaGVja2VyO1xuXG4gIHBhcnNlQWN0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgdGhpcy5fY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpKTtcbiAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgdHJ1ZSwgdGhpcy5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgIGlucHV0Lmxlbmd0aCAtIHNvdXJjZVRvTGV4Lmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwYXJzZUJpbmRpbmcoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogYW55LCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUJpbmRpbmdBc3QoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja1NpbXBsZUV4cHJlc3Npb24oYXN0OiBBU1QpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgY2hlY2tlciA9IG5ldyB0aGlzLnNpbXBsZUV4cHJlc3Npb25DaGVja2VyKCk7XG4gICAgYXN0LnZpc2l0KGNoZWNrZXIpO1xuICAgIHJldHVybiBjaGVja2VyLmVycm9ycztcbiAgfVxuXG4gIHBhcnNlU2ltcGxlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBlcnJvcnMgPSB0aGlzLmNoZWNrU2ltcGxlRXhwcmVzc2lvbihhc3QpO1xuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYEhvc3QgYmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluICR7ZXJyb3JzLmpvaW4oJyAnKX1gLCBpbnB1dCwgbG9jYXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihtZXNzYWdlOiBzdHJpbmcsIGlucHV0OiBzdHJpbmcsIGVyckxvY2F0aW9uOiBzdHJpbmcsIGN0eExvY2F0aW9uPzogYW55KSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VyRXJyb3IobWVzc2FnZSwgaW5wdXQsIGVyckxvY2F0aW9uLCBjdHhMb2NhdGlvbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VCaW5kaW5nQXN0KFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBBU1Qge1xuICAgIC8vIFF1b3RlcyBleHByZXNzaW9ucyB1c2UgM3JkLXBhcnR5IGV4cHJlc3Npb24gbGFuZ3VhZ2UuIFdlIGRvbid0IHdhbnQgdG8gdXNlXG4gICAgLy8gb3VyIGxleGVyIG9yIHBhcnNlciBmb3IgdGhhdCwgc28gd2UgY2hlY2sgZm9yIHRoYXQgYWhlYWQgb2YgdGltZS5cbiAgICBjb25zdCBxdW90ZSA9IHRoaXMuX3BhcnNlUXVvdGUoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG5cbiAgICBpZiAocXVvdGUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHF1b3RlO1xuICAgIH1cblxuICAgIHRoaXMuX2NoZWNrTm9JbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgcmV0dXJuIG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgZmFsc2UsIHRoaXMuZXJyb3JzLFxuICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAucGFyc2VDaGFpbigpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VRdW90ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1R8bnVsbCB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHByZWZpeFNlcGFyYXRvckluZGV4ID0gaW5wdXQuaW5kZXhPZignOicpO1xuICAgIGlmIChwcmVmaXhTZXBhcmF0b3JJbmRleCA9PSAtMSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4ID0gaW5wdXQuc3Vic3RyaW5nKDAsIHByZWZpeFNlcGFyYXRvckluZGV4KS50cmltKCk7XG4gICAgaWYgKCFpc0lkZW50aWZpZXIocHJlZml4KSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24gPSBpbnB1dC5zdWJzdHJpbmcocHJlZml4U2VwYXJhdG9ySW5kZXggKyAxKTtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgUXVvdGUoXG4gICAgICAgIHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHByZWZpeCwgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24sIGxvY2F0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBtaWNyb3N5bnRheCB0ZW1wbGF0ZSBleHByZXNzaW9uIGFuZCByZXR1cm4gYSBsaXN0IG9mIGJpbmRpbmdzIG9yXG4gICAqIHBhcnNpbmcgZXJyb3JzIGluIGNhc2UgdGhlIGdpdmVuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgIDxkaXYgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIj5cbiAgICogICAgICAgICBeICAgICAgXiBhYnNvbHV0ZVZhbHVlT2Zmc2V0IGZvciBgdGVtcGxhdGVWYWx1ZWBcbiAgICogICAgICAgICBhYnNvbHV0ZUtleU9mZnNldCBmb3IgYHRlbXBsYXRlS2V5YFxuICAgKiBgYGBcbiAgICogY29udGFpbnMgdGhyZWUgYmluZGluZ3M6XG4gICAqIDEuIG5nRm9yIC0+IG51bGxcbiAgICogMi4gaXRlbSAtPiBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRcbiAgICogMy4gbmdGb3JPZiAtPiBpdGVtc1xuICAgKlxuICAgKiBUaGlzIGlzIGFwcGFyZW50IGZyb20gdGhlIGRlLXN1Z2FyZWQgdGVtcGxhdGU6XG4gICAqIGBgYFxuICAgKiAgIDxuZy10ZW1wbGF0ZSBuZ0ZvciBsZXQtaXRlbSBbbmdGb3JPZl09XCJpdGVtc1wiPlxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlS2V5IG5hbWUgb2YgZGlyZWN0aXZlLCB3aXRob3V0IHRoZSAqIHByZWZpeC4gRm9yIGV4YW1wbGU6IG5nSWYsIG5nRm9yXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZVZhbHVlIFJIUyBvZiB0aGUgbWljcm9zeW50YXggYXR0cmlidXRlXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZVVybCB0ZW1wbGF0ZSBmaWxlbmFtZSBpZiBpdCdzIGV4dGVybmFsLCBjb21wb25lbnQgZmlsZW5hbWUgaWYgaXQncyBpbmxpbmVcbiAgICogQHBhcmFtIGFic29sdXRlS2V5T2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdGVtcGxhdGVLZXlgXG4gICAqIEBwYXJhbSBhYnNvbHV0ZVZhbHVlT2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdGVtcGxhdGVWYWx1ZWBcbiAgICovXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyhcbiAgICAgIHRlbXBsYXRlS2V5OiBzdHJpbmcsIHRlbXBsYXRlVmFsdWU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZywgYWJzb2x1dGVLZXlPZmZzZXQ6IG51bWJlcixcbiAgICAgIGFic29sdXRlVmFsdWVPZmZzZXQ6IG51bWJlcik6IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZSh0ZW1wbGF0ZVZhbHVlKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICB0ZW1wbGF0ZVZhbHVlLCB0ZW1wbGF0ZVVybCwgYWJzb2x1dGVWYWx1ZU9mZnNldCwgdG9rZW5zLCB0ZW1wbGF0ZVZhbHVlLmxlbmd0aCxcbiAgICAgICAgZmFsc2UgLyogcGFyc2VBY3Rpb24gKi8sIHRoaXMuZXJyb3JzLCAwIC8qIHJlbGF0aXZlIG9mZnNldCAqLyk7XG4gICAgcmV0dXJuIHBhcnNlci5wYXJzZVRlbXBsYXRlQmluZGluZ3Moe1xuICAgICAgc291cmNlOiB0ZW1wbGF0ZUtleSxcbiAgICAgIHNwYW46IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oYWJzb2x1dGVLZXlPZmZzZXQsIGFic29sdXRlS2V5T2Zmc2V0ICsgdGVtcGxhdGVLZXkubGVuZ3RoKSxcbiAgICB9KTtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgY29uc3Qgc3BsaXQgPSB0aGlzLnNwbGl0SW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGlmIChzcGxpdCA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGV4cHJlc3Npb25zOiBBU1RbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGxpdC5leHByZXNzaW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgZXhwcmVzc2lvblRleHQgPSBzcGxpdC5leHByZXNzaW9uc1tpXTtcbiAgICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uVGV4dCk7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9ycywgc3BsaXQub2Zmc2V0c1tpXSArIChleHByZXNzaW9uVGV4dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpKVxuICAgICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgICBleHByZXNzaW9ucy5wdXNoKGFzdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlSW50ZXJwb2xhdGlvbkFzdChzcGxpdC5zdHJpbmdzLCBleHByZXNzaW9ucywgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG4gIH1cblxuICAvKipcbiAgICogU2ltaWxhciB0byBgcGFyc2VJbnRlcnBvbGF0aW9uYCwgYnV0IHRyZWF0cyB0aGUgcHJvdmlkZWQgc3RyaW5nIGFzIGEgc2luZ2xlIGV4cHJlc3Npb25cbiAgICogZWxlbWVudCB0aGF0IHdvdWxkIG5vcm1hbGx5IGFwcGVhciB3aXRoaW4gdGhlIGludGVycG9sYXRpb24gcHJlZml4IGFuZCBzdWZmaXggKGB7e2AgYW5kIGB9fWApLlxuICAgKiBUaGlzIGlzIHVzZWQgZm9yIHBhcnNpbmcgdGhlIHN3aXRjaCBleHByZXNzaW9uIGluIElDVXMuXG4gICAqL1xuICBwYXJzZUludGVycG9sYXRpb25FeHByZXNzaW9uKGV4cHJlc3Npb246IHN0cmluZywgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6XG4gICAgICBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoZXhwcmVzc2lvbik7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUoc291cmNlVG9MZXgpO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb24sIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIC8qIHBhcnNlQWN0aW9uICovIGZhbHNlLCB0aGlzLmVycm9ycywgMClcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICBjb25zdCBzdHJpbmdzID0gWycnLCAnJ107ICAvLyBUaGUgcHJlZml4IGFuZCBzdWZmaXggc3RyaW5ncyBhcmUgYm90aCBlbXB0eVxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUludGVycG9sYXRpb25Bc3Qoc3RyaW5ncywgW2FzdF0sIGV4cHJlc3Npb24sIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUludGVycG9sYXRpb25Bc3QoXG4gICAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IEFTVFtdLCBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0Lmxlbmd0aCk7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbiA9XG4gICAgICAgIG5ldyBJbnRlcnBvbGF0aW9uKHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoaW50ZXJwb2xhdGlvbiwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNwbGl0cyBhIHN0cmluZyBvZiB0ZXh0IGludG8gXCJyYXdcIiB0ZXh0IHNlZ21lbnRzIGFuZCBleHByZXNzaW9ucyBwcmVzZW50IGluIGludGVycG9sYXRpb25zIGluXG4gICAqIHRoZSBzdHJpbmcuXG4gICAqIFJldHVybnMgYG51bGxgIGlmIHRoZXJlIGFyZSBubyBpbnRlcnBvbGF0aW9ucywgb3RoZXJ3aXNlIGFcbiAgICogYFNwbGl0SW50ZXJwb2xhdGlvbmAgd2l0aCBzcGxpdHMgdGhhdCBsb29rIGxpa2VcbiAgICogICA8cmF3IHRleHQ+IDxleHByZXNzaW9uPiA8cmF3IHRleHQ+IC4uLiA8cmF3IHRleHQ+IDxleHByZXNzaW9uPiA8cmF3IHRleHQ+XG4gICAqL1xuICBzcGxpdEludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBTcGxpdEludGVycG9sYXRpb25cbiAgICAgIHxudWxsIHtcbiAgICBjb25zdCBzdHJpbmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGV4cHJlc3Npb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IG9mZnNldHM6IG51bWJlcltdID0gW107XG4gICAgY29uc3Qgc3RyaW5nU3BhbnM6IHtzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcn1bXSA9IFtdO1xuICAgIGNvbnN0IGV4cHJlc3Npb25TcGFuczoge3N0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyfVtdID0gW107XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCBhdEludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICBsZXQgZXh0ZW5kTGFzdFN0cmluZyA9IGZhbHNlO1xuICAgIGxldCB7c3RhcnQ6IGludGVycFN0YXJ0LCBlbmQ6IGludGVycEVuZH0gPSBpbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAgIHdoaWxlIChpIDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgICAvLyBwYXJzZSB1bnRpbCBzdGFydGluZyB7e1xuICAgICAgICBjb25zdCBzdGFydCA9IGk7XG4gICAgICAgIGkgPSBpbnB1dC5pbmRleE9mKGludGVycFN0YXJ0LCBpKTtcbiAgICAgICAgaWYgKGkgPT09IC0xKSB7XG4gICAgICAgICAgaSA9IGlucHV0Lmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJ0ID0gaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBpKTtcbiAgICAgICAgc3RyaW5ncy5wdXNoKHBhcnQpO1xuICAgICAgICBzdHJpbmdTcGFucy5wdXNoKHtzdGFydCwgZW5kOiBpfSk7XG5cbiAgICAgICAgYXRJbnRlcnBvbGF0aW9uID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBhcnNlIGZyb20gc3RhcnRpbmcge3sgdG8gZW5kaW5nIH19XG4gICAgICAgIGNvbnN0IGZ1bGxTdGFydCA9IGk7XG4gICAgICAgIGNvbnN0IGV4cHJTdGFydCA9IGZ1bGxTdGFydCArIGludGVycFN0YXJ0Lmxlbmd0aDtcbiAgICAgICAgY29uc3QgZXhwckVuZCA9IGlucHV0LmluZGV4T2YoaW50ZXJwRW5kLCBleHByU3RhcnQpO1xuICAgICAgICBpZiAoZXhwckVuZCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyBDb3VsZCBub3QgZmluZCB0aGUgZW5kIG9mIHRoZSBpbnRlcnBvbGF0aW9uOyBkbyBub3QgcGFyc2UgYW4gZXhwcmVzc2lvbi5cbiAgICAgICAgICAvLyBJbnN0ZWFkIHdlIHNob3VsZCBleHRlbmQgdGhlIGNvbnRlbnQgb24gdGhlIGxhc3QgcmF3IHN0cmluZy5cbiAgICAgICAgICBhdEludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICAgICAgICBleHRlbmRMYXN0U3RyaW5nID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdWxsRW5kID0gZXhwckVuZCArIGludGVycEVuZC5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgcGFydCA9IGlucHV0LnN1YnN0cmluZyhleHByU3RhcnQsIGV4cHJFbmQpO1xuICAgICAgICBpZiAocGFydC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGV4cHJlc3Npb25zLnB1c2gocGFydCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgICdCbGFuayBleHByZXNzaW9ucyBhcmUgbm90IGFsbG93ZWQgaW4gaW50ZXJwb2xhdGVkIHN0cmluZ3MnLCBpbnB1dCxcbiAgICAgICAgICAgICAgYGF0IGNvbHVtbiAke2l9IGluYCwgbG9jYXRpb24pO1xuICAgICAgICAgIGV4cHJlc3Npb25zLnB1c2goJyRpbXBsaWNpdCcpO1xuICAgICAgICB9XG4gICAgICAgIG9mZnNldHMucHVzaChleHByU3RhcnQpO1xuICAgICAgICBleHByZXNzaW9uU3BhbnMucHVzaCh7c3RhcnQ6IGZ1bGxTdGFydCwgZW5kOiBmdWxsRW5kfSk7XG5cbiAgICAgICAgaSA9IGZ1bGxFbmQ7XG4gICAgICAgIGF0SW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgLy8gSWYgd2UgYXJlIG5vdyBhdCBhIHRleHQgc2VjdGlvbiwgYWRkIHRoZSByZW1haW5pbmcgY29udGVudCBhcyBhIHJhdyBzdHJpbmcuXG4gICAgICBpZiAoZXh0ZW5kTGFzdFN0cmluZykge1xuICAgICAgICBzdHJpbmdzW3N0cmluZ3MubGVuZ3RoIC0gMV0gKz0gaW5wdXQuc3Vic3RyaW5nKGkpO1xuICAgICAgICBzdHJpbmdTcGFuc1tzdHJpbmdTcGFucy5sZW5ndGggLSAxXS5lbmQgPSBpbnB1dC5sZW5ndGg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHJpbmdzLnB1c2goaW5wdXQuc3Vic3RyaW5nKGkpKTtcbiAgICAgICAgc3RyaW5nU3BhbnMucHVzaCh7c3RhcnQ6IGksIGVuZDogaW5wdXQubGVuZ3RofSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBleHByZXNzaW9ucy5sZW5ndGggPT09IDAgP1xuICAgICAgICBudWxsIDpcbiAgICAgICAgbmV3IFNwbGl0SW50ZXJwb2xhdGlvbihzdHJpbmdzLCBzdHJpbmdTcGFucywgZXhwcmVzc2lvbnMsIGV4cHJlc3Npb25TcGFucywgb2Zmc2V0cyk7XG4gIH1cblxuICB3cmFwTGl0ZXJhbFByaW1pdGl2ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dCA9PSBudWxsID8gMCA6IGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBpbnB1dCksIGlucHV0LCBsb2NhdGlvbixcbiAgICAgICAgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0cmlwQ29tbWVudHMoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaSA9IHRoaXMuX2NvbW1lbnRTdGFydChpbnB1dCk7XG4gICAgcmV0dXJuIGkgIT0gbnVsbCA/IGlucHV0LnN1YnN0cmluZygwLCBpKS50cmltKCkgOiBpbnB1dDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbW1lbnRTdGFydChpbnB1dDogc3RyaW5nKTogbnVtYmVyfG51bGwge1xuICAgIGxldCBvdXRlclF1b3RlOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGNvbnN0IGNoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgY29uc3QgbmV4dENoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkgKyAxKTtcblxuICAgICAgaWYgKGNoYXIgPT09IGNoYXJzLiRTTEFTSCAmJiBuZXh0Q2hhciA9PSBjaGFycy4kU0xBU0ggJiYgb3V0ZXJRdW90ZSA9PSBudWxsKSByZXR1cm4gaTtcblxuICAgICAgaWYgKG91dGVyUXVvdGUgPT09IGNoYXIpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKG91dGVyUXVvdGUgPT0gbnVsbCAmJiBpc1F1b3RlKGNoYXIpKSB7XG4gICAgICAgIG91dGVyUXVvdGUgPSBjaGFyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrTm9JbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IHZvaWQge1xuICAgIGNvbnN0IHJlZ2V4cCA9IF9nZXRJbnRlcnBvbGF0ZVJlZ0V4cChpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBwYXJ0cyA9IGlucHV0LnNwbGl0KHJlZ2V4cCk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7XG4gICAgICAgICAgICAgIGludGVycG9sYXRpb25Db25maWcuZW5kfSkgd2hlcmUgZXhwcmVzc2lvbiB3YXMgZXhwZWN0ZWRgLFxuICAgICAgICAgIGlucHV0LFxuICAgICAgICAgIGBhdCBjb2x1bW4gJHt0aGlzLl9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKHBhcnRzLCAxLCBpbnRlcnBvbGF0aW9uQ29uZmlnKX0gaW5gLFxuICAgICAgICAgIGxvY2F0aW9uKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKFxuICAgICAgcGFydHM6IHN0cmluZ1tdLCBwYXJ0SW5FcnJJZHg6IG51bWJlciwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IG51bWJlciB7XG4gICAgbGV0IGVyckxvY2F0aW9uID0gJyc7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBwYXJ0SW5FcnJJZHg7IGorKykge1xuICAgICAgZXJyTG9jYXRpb24gKz0gaiAlIDIgPT09IDAgP1xuICAgICAgICAgIHBhcnRzW2pdIDpcbiAgICAgICAgICBgJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7cGFydHNbal19JHtpbnRlcnBvbGF0aW9uQ29uZmlnLmVuZH1gO1xuICAgIH1cblxuICAgIHJldHVybiBlcnJMb2NhdGlvbi5sZW5ndGg7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEl2eVBhcnNlciBleHRlbmRzIFBhcnNlciB7XG4gIHNpbXBsZUV4cHJlc3Npb25DaGVja2VyID0gSXZ5U2ltcGxlRXhwcmVzc2lvbkNoZWNrZXI7ICAvL1xufVxuXG4vKiogRGVzY3JpYmVzIGEgc3RhdGVmdWwgY29udGV4dCBhbiBleHByZXNzaW9uIHBhcnNlciBpcyBpbi4gKi9cbmVudW0gUGFyc2VDb250ZXh0RmxhZ3Mge1xuICBOb25lID0gMCxcbiAgLyoqXG4gICAqIEEgV3JpdGFibGUgY29udGV4dCBpcyBvbmUgaW4gd2hpY2ggYSB2YWx1ZSBtYXkgYmUgd3JpdHRlbiB0byBhbiBsdmFsdWUuXG4gICAqIEZvciBleGFtcGxlLCBhZnRlciB3ZSBzZWUgYSBwcm9wZXJ0eSBhY2Nlc3MsIHdlIG1heSBleHBlY3QgYSB3cml0ZSB0byB0aGVcbiAgICogcHJvcGVydHkgdmlhIHRoZSBcIj1cIiBvcGVyYXRvci5cbiAgICogICBwcm9wXG4gICAqICAgICAgICBeIHBvc3NpYmxlIFwiPVwiIGFmdGVyXG4gICAqL1xuICBXcml0YWJsZSA9IDEsXG59XG5cbmV4cG9ydCBjbGFzcyBfUGFyc2VBU1Qge1xuICBwcml2YXRlIHJwYXJlbnNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNrZXRzRXhwZWN0ZWQgPSAwO1xuICBwcml2YXRlIHJicmFjZXNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgY29udGV4dCA9IFBhcnNlQ29udGV4dEZsYWdzLk5vbmU7XG5cbiAgLy8gQ2FjaGUgb2YgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZWNlcyB0byB0aGUgYWJzb2x1dGUgc291cmNlIHNwYW4gdGhleSBtYXAgdG8sIHVzZWQgdG9cbiAgLy8gcHJldmVudCBjcmVhdGluZyBzdXBlcmZsdW91cyBzb3VyY2Ugc3BhbnMgaW4gYHNvdXJjZVNwYW5gLlxuICAvLyBBIHNlcmlhbCBvZiB0aGUgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZXggaXMgdXNlZCBmb3IgbWFwcGluZyBiZWNhdXNlIGJvdGggYXJlIHN0YXRlZnVsXG4gIC8vIGFuZCBtYXkgY2hhbmdlIGZvciBzdWJzZXF1ZW50IGV4cHJlc3Npb25zIHZpc2l0ZWQgYnkgdGhlIHBhcnNlci5cbiAgcHJpdmF0ZSBzb3VyY2VTcGFuQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQWJzb2x1dGVTb3VyY2VTcGFuPigpO1xuXG4gIGluZGV4OiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGlucHV0OiBzdHJpbmcsIHB1YmxpYyBsb2NhdGlvbjogYW55LCBwdWJsaWMgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHB1YmxpYyB0b2tlbnM6IFRva2VuW10sIHB1YmxpYyBpbnB1dExlbmd0aDogbnVtYmVyLCBwdWJsaWMgcGFyc2VBY3Rpb246IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSwgcHJpdmF0ZSBvZmZzZXQ6IG51bWJlcikge31cblxuICBwZWVrKG9mZnNldDogbnVtYmVyKTogVG9rZW4ge1xuICAgIGNvbnN0IGkgPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHJldHVybiBpIDwgdGhpcy50b2tlbnMubGVuZ3RoID8gdGhpcy50b2tlbnNbaV0gOiBFT0Y7XG4gIH1cblxuICBnZXQgbmV4dCgpOiBUb2tlbiB7XG4gICAgcmV0dXJuIHRoaXMucGVlaygwKTtcbiAgfVxuXG4gIC8qKiBXaGV0aGVyIGFsbCB0aGUgcGFyc2VyIGlucHV0IGhhcyBiZWVuIHByb2Nlc3NlZC4gKi9cbiAgZ2V0IGF0RU9GKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmluZGV4ID49IHRoaXMudG9rZW5zLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmRleCBvZiB0aGUgbmV4dCB0b2tlbiB0byBiZSBwcm9jZXNzZWQsIG9yIHRoZSBlbmQgb2YgdGhlIGxhc3QgdG9rZW4gaWYgYWxsIGhhdmUgYmVlblxuICAgKiBwcm9jZXNzZWQuXG4gICAqL1xuICBnZXQgaW5wdXRJbmRleCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmF0RU9GID8gdGhpcy5jdXJyZW50RW5kSW5kZXggOiB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmQgaW5kZXggb2YgdGhlIGxhc3QgcHJvY2Vzc2VkIHRva2VuLCBvciB0aGUgc3RhcnQgb2YgdGhlIGZpcnN0IHRva2VuIGlmIG5vbmUgaGF2ZSBiZWVuXG4gICAqIHByb2Nlc3NlZC5cbiAgICovXG4gIGdldCBjdXJyZW50RW5kSW5kZXgoKTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy5pbmRleCA+IDApIHtcbiAgICAgIGNvbnN0IGN1clRva2VuID0gdGhpcy5wZWVrKC0xKTtcbiAgICAgIHJldHVybiBjdXJUb2tlbi5lbmQgKyB0aGlzLm9mZnNldDtcbiAgICB9XG4gICAgLy8gTm8gdG9rZW5zIGhhdmUgYmVlbiBwcm9jZXNzZWQgeWV0OyByZXR1cm4gdGhlIG5leHQgdG9rZW4ncyBzdGFydCBvciB0aGUgbGVuZ3RoIG9mIHRoZSBpbnB1dFxuICAgIC8vIGlmIHRoZXJlIGlzIG5vIHRva2VuLlxuICAgIGlmICh0aGlzLnRva2Vucy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGlzLmlucHV0TGVuZ3RoICsgdGhpcy5vZmZzZXQ7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhYnNvbHV0ZSBvZmZzZXQgb2YgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHRva2VuLlxuICAgKi9cbiAgZ2V0IGN1cnJlbnRBYnNvbHV0ZU9mZnNldCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmFic29sdXRlT2Zmc2V0ICsgdGhpcy5pbnB1dEluZGV4O1xuICB9XG5cbiAgc3BhbihzdGFydDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQYXJzZVNwYW4oc3RhcnQsIHRoaXMuY3VycmVudEVuZEluZGV4KTtcbiAgfVxuXG4gIHNvdXJjZVNwYW4oc3RhcnQ6IG51bWJlcik6IEFic29sdXRlU291cmNlU3BhbiB7XG4gICAgY29uc3Qgc2VyaWFsID0gYCR7c3RhcnR9QCR7dGhpcy5pbnB1dEluZGV4fWA7XG4gICAgaWYgKCF0aGlzLnNvdXJjZVNwYW5DYWNoZS5oYXMoc2VyaWFsKSkge1xuICAgICAgdGhpcy5zb3VyY2VTcGFuQ2FjaGUuc2V0KHNlcmlhbCwgdGhpcy5zcGFuKHN0YXJ0KS50b0Fic29sdXRlKHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc291cmNlU3BhbkNhY2hlLmdldChzZXJpYWwpITtcbiAgfVxuXG4gIGFkdmFuY2UoKSB7XG4gICAgdGhpcy5pbmRleCsrO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIGEgY2FsbGJhY2sgaW4gdGhlIHByb3ZpZGVkIGNvbnRleHQuXG4gICAqL1xuICBwcml2YXRlIHdpdGhDb250ZXh0PFQ+KGNvbnRleHQ6IFBhcnNlQ29udGV4dEZsYWdzLCBjYjogKCkgPT4gVCk6IFQge1xuICAgIHRoaXMuY29udGV4dCB8PSBjb250ZXh0O1xuICAgIGNvbnN0IHJldCA9IGNiKCk7XG4gICAgdGhpcy5jb250ZXh0IF49IGNvbnRleHQ7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGNvbnN1bWVPcHRpb25hbENoYXJhY3Rlcihjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNvZGUpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcGVla0tleXdvcmRMZXQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pc0tleXdvcmRMZXQoKTtcbiAgfVxuICBwZWVrS2V5d29yZEFzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5leHQuaXNLZXl3b3JkQXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdW1lcyBhbiBleHBlY3RlZCBjaGFyYWN0ZXIsIG90aGVyd2lzZSBlbWl0cyBhbiBlcnJvciBhYm91dCB0aGUgbWlzc2luZyBleHBlY3RlZCBjaGFyYWN0ZXJcbiAgICogYW5kIHNraXBzIG92ZXIgdGhlIHRva2VuIHN0cmVhbSB1bnRpbCByZWFjaGluZyBhIHJlY292ZXJhYmxlIHBvaW50LlxuICAgKlxuICAgKiBTZWUgYHRoaXMuZXJyb3JgIGFuZCBgdGhpcy5za2lwYCBmb3IgbW9yZSBkZXRhaWxzLlxuICAgKi9cbiAgZXhwZWN0Q2hhcmFjdGVyKGNvZGU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3Rlcihjb2RlKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgJHtTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpfWApO1xuICB9XG5cbiAgY29uc3VtZU9wdGlvbmFsT3BlcmF0b3Iob3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5leHQuaXNPcGVyYXRvcihvcCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBleHBlY3RPcGVyYXRvcihvcGVyYXRvcjogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3Iob3BlcmF0b3IpKSByZXR1cm47XG4gICAgdGhpcy5lcnJvcihgTWlzc2luZyBleHBlY3RlZCBvcGVyYXRvciAke29wZXJhdG9yfWApO1xuICB9XG5cbiAgcHJldHR5UHJpbnRUb2tlbih0b2s6IFRva2VuKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdG9rID09PSBFT0YgPyAnZW5kIG9mIGlucHV0JyA6IGB0b2tlbiAke3Rva31gO1xuICB9XG5cbiAgZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpOiBzdHJpbmcge1xuICAgIGNvbnN0IG4gPSB0aGlzLm5leHQ7XG4gICAgaWYgKCFuLmlzSWRlbnRpZmllcigpICYmICFuLmlzS2V5d29yZCgpKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkICR7dGhpcy5wcmV0dHlQcmludFRva2VuKG4pfSwgZXhwZWN0ZWQgaWRlbnRpZmllciBvciBrZXl3b3JkYCk7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuLnRvU3RyaW5nKCkgYXMgc3RyaW5nO1xuICB9XG5cbiAgZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgY29uc3QgbiA9IHRoaXMubmV4dDtcbiAgICBpZiAoIW4uaXNJZGVudGlmaWVyKCkgJiYgIW4uaXNLZXl3b3JkKCkgJiYgIW4uaXNTdHJpbmcoKSkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCAke3RoaXMucHJldHR5UHJpbnRUb2tlbihuKX0sIGV4cGVjdGVkIGlkZW50aWZpZXIsIGtleXdvcmQsIG9yIHN0cmluZ2ApO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbi50b1N0cmluZygpIGFzIHN0cmluZztcbiAgfVxuXG4gIHBhcnNlQ2hhaW4oKTogQVNUIHtcbiAgICBjb25zdCBleHByczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBleHBycy5wdXNoKGV4cHIpO1xuXG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluIGNoYWluZWQgZXhwcmVzc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICB9ICAvLyByZWFkIGFsbCBzZW1pY29sb25zXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAnJHt0aGlzLm5leHR9J2ApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZXhwcnMubGVuZ3RoID09IDApIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIGlmIChleHBycy5sZW5ndGggPT0gMSkgcmV0dXJuIGV4cHJzWzBdO1xuICAgIHJldHVybiBuZXcgQ2hhaW4odGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZXhwcnMpO1xuICB9XG5cbiAgcGFyc2VQaXBlKCk6IEFTVCB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSkge1xuICAgICAgaWYgKHRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgdGhpcy5lcnJvcignQ2Fubm90IGhhdmUgYSBwaXBlIGluIGFuIGFjdGlvbiBleHByZXNzaW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk7XG4gICAgICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zb3VyY2VTcGFuKG5hbWVTdGFydCk7XG4gICAgICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW107XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pKSB7XG4gICAgICAgICAgYXJncy5wdXNoKHRoaXMucGFyc2VFeHByZXNzaW9uKCkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBCaW5kaW5nUGlwZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQsIG5hbWUsIGFyZ3MsIG5hbWVTcGFuKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbigpOiBBU1Qge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgfVxuXG4gIHBhcnNlQ29uZGl0aW9uYWwoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlTG9naWNhbE9yKCk7XG5cbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPycpKSB7XG4gICAgICBjb25zdCB5ZXMgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgbGV0IG5vOiBBU1Q7XG4gICAgICBpZiAoIXRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgY29uc3QgZW5kID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgICAgIHRoaXMuZXJyb3IoYENvbmRpdGlvbmFsIGV4cHJlc3Npb24gJHtleHByZXNzaW9ufSByZXF1aXJlcyBhbGwgMyBleHByZXNzaW9uc2ApO1xuICAgICAgICBubyA9IG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBubyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgeWVzLCBubyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VMb2dpY2FsT3IoKTogQVNUIHtcbiAgICAvLyAnfHwnXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG4gICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3x8JykpIHtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKTtcbiAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgJ3x8JywgcmVzdWx0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxvZ2ljYWxBbmQoKTogQVNUIHtcbiAgICAvLyAnJiYnXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCcmJicpKSB7XG4gICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnJiYnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXF1YWxpdHkoKTogQVNUIHtcbiAgICAvLyAnPT0nLCchPScsJz09PScsJyE9PSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnPT0nOlxuICAgICAgICBjYXNlICc9PT0nOlxuICAgICAgICBjYXNlICchPSc6XG4gICAgICAgIGNhc2UgJyE9PSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlUmVsYXRpb25hbCgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VSZWxhdGlvbmFsKCk6IEFTVCB7XG4gICAgLy8gJzwnLCAnPicsICc8PScsICc+PSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJzwnOlxuICAgICAgICBjYXNlICc+JzpcbiAgICAgICAgY2FzZSAnPD0nOlxuICAgICAgICBjYXNlICc+PSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlQWRkaXRpdmUoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlQWRkaXRpdmUoKTogQVNUIHtcbiAgICAvLyAnKycsICctJ1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCByaWdodCA9IHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VNdWx0aXBsaWNhdGl2ZSgpOiBBU1Qge1xuICAgIC8vICcqJywgJyUnLCAnLydcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcqJzpcbiAgICAgICAgY2FzZSAnJSc6XG4gICAgICAgIGNhc2UgJy8nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCByaWdodCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlUHJlZml4KCk6IEFTVCB7XG4gICAgaWYgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIGxldCByZXN1bHQ6IEFTVDtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBVbmFyeS5jcmVhdGVQbHVzKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gVW5hcnkuY3JlYXRlTWludXModGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgICAgY2FzZSAnISc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgUHJlZml4Tm90KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhcnNlQ2FsbENoYWluKCk7XG4gIH1cblxuICBwYXJzZUNhbGxDaGFpbigpOiBBU1Qge1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUHJpbWFyeSgpO1xuICAgIGNvbnN0IHJlc3VsdFN0YXJ0ID0gcmVzdWx0LnNwYW4uc3RhcnQ7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kUEVSSU9EKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgZmFsc2UpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz8uJykpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChyZXN1bHQsIHRydWUpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0tFVCkpIHtcbiAgICAgICAgdGhpcy53aXRoQ29udGV4dChQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgICAgICBjb25zdCBrZXkgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgICAgIGlmIChrZXkgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IoYEtleSBhY2Nlc3MgY2Fubm90IGJlIGVtcHR5YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQtLTtcbiAgICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7XG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgS2V5ZWRXcml0ZShcbiAgICAgICAgICAgICAgICB0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGtleSwgdmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgICAgIG5ldyBLZXllZFJlYWQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBrZXkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnBhcnNlQ2FsbEFyZ3VtZW50cygpO1xuICAgICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBGdW5jdGlvbkNhbGwodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBhcmdzKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCchJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IE5vbk51bGxBc3NlcnQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0KTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZVByaW1hcnkoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZE51bGwoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbnVsbCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRVbmRlZmluZWQoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdm9pZCAwKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRydWUoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdHJ1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRGYWxzZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRUaGlzKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICB0aGlzLnJicmFja2V0c0V4cGVjdGVkKys7XG4gICAgICBjb25zdCBlbGVtZW50cyA9IHRoaXMucGFyc2VFeHByZXNzaW9uTGlzdChjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGVsZW1lbnRzKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUxpdGVyYWxNYXAoKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzSWRlbnRpZmllcigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChcbiAgICAgICAgICBuZXcgSW1wbGljaXRSZWNlaXZlcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKSwgZmFsc2UpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNOdW1iZXIoKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLm5leHQudG9OdW1iZXIoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzU3RyaW5nKCkpIHtcbiAgICAgIGNvbnN0IGxpdGVyYWxWYWx1ZSA9IHRoaXMubmV4dC50b1N0cmluZygpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbGl0ZXJhbFZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA+PSB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb246ICR7dGhpcy5pbnB1dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7dGhpcy5uZXh0fWApO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uTGlzdCh0ZXJtaW5hdG9yOiBudW1iZXIpOiBBU1RbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBBU1RbXSA9IFtdO1xuICAgIGlmICghdGhpcy5uZXh0LmlzQ2hhcmFjdGVyKHRlcm1pbmF0b3IpKSB7XG4gICAgICBkbyB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxpdGVyYWxNYXAoKTogTGl0ZXJhbE1hcCB7XG4gICAgY29uc3Qga2V5czogTGl0ZXJhbE1hcEtleVtdID0gW107XG4gICAgY29uc3QgdmFsdWVzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpO1xuICAgIGlmICghdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSkpIHtcbiAgICAgIHRoaXMucmJyYWNlc0V4cGVjdGVkKys7XG4gICAgICBkbyB7XG4gICAgICAgIGNvbnN0IHF1b3RlZCA9IHRoaXMubmV4dC5pc1N0cmluZygpO1xuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmRPclN0cmluZygpO1xuICAgICAgICBrZXlzLnB1c2goe2tleSwgcXVvdGVkfSk7XG4gICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7XG4gICAgICAgIHZhbHVlcy5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgICB0aGlzLnJicmFjZXNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgTGl0ZXJhbE1hcCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBrZXlzLCB2YWx1ZXMpO1xuICB9XG5cbiAgcGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwocmVjZWl2ZXI6IEFTVCwgaXNTYWZlOiBib29sZWFuID0gZmFsc2UpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gcmVjZWl2ZXIuc3Bhbi5zdGFydDtcbiAgICBjb25zdCBuYW1lU3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgY29uc3QgaWQgPSB0aGlzLndpdGhDb250ZXh0KFBhcnNlQ29udGV4dEZsYWdzLldyaXRhYmxlLCAoKSA9PiB7XG4gICAgICBjb25zdCBpZCA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpO1xuICAgICAgaWYgKGlkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmVycm9yKGBFeHBlY3RlZCBpZGVudGlmaWVyIGZvciBwcm9wZXJ0eSBhY2Nlc3NgLCByZWNlaXZlci5zcGFuLmVuZCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaWQ7XG4gICAgfSk7XG4gICAgY29uc3QgbmFtZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4obmFtZVN0YXJ0KTtcblxuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnBhcnNlQ2FsbEFyZ3VtZW50cygpO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgY29uc3Qgc3BhbiA9IHRoaXMuc3BhbihzdGFydCk7XG4gICAgICBjb25zdCBzb3VyY2VTcGFuID0gdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KTtcbiAgICAgIHJldHVybiBpc1NhZmUgPyBuZXcgU2FmZU1ldGhvZENhbGwoc3Bhbiwgc291cmNlU3BhbiwgbmFtZVNwYW4sIHJlY2VpdmVyLCBpZCwgYXJncykgOlxuICAgICAgICAgICAgICAgICAgICAgIG5ldyBNZXRob2RDYWxsKHNwYW4sIHNvdXJjZVNwYW4sIG5hbWVTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpc1NhZmUpIHtcbiAgICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgIHRoaXMuZXJyb3IoJ1RoZSBcXCc/LlxcJyBvcGVyYXRvciBjYW5ub3QgYmUgdXNlZCBpbiB0aGUgYXNzaWdubWVudCcpO1xuICAgICAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgU2FmZVByb3BlcnR5UmVhZChcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbmFtZVNwYW4sIHJlY2VpdmVyLCBpZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICBpZiAoIXRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IoJ0JpbmRpbmdzIGNhbm5vdCBjb250YWluIGFzc2lnbm1lbnRzJyk7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvcGVydHlXcml0ZShcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbmFtZVNwYW4sIHJlY2VpdmVyLCBpZCwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvcGVydHlSZWFkKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWNlaXZlciwgaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcGFyc2VDYWxsQXJndW1lbnRzKCk6IEJpbmRpbmdQaXBlW10ge1xuICAgIGlmICh0aGlzLm5leHQuaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikpIHJldHVybiBbXTtcbiAgICBjb25zdCBwb3NpdGlvbmFsczogQVNUW10gPSBbXTtcbiAgICBkbyB7XG4gICAgICBwb3NpdGlvbmFscy5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSkpO1xuICAgIHJldHVybiBwb3NpdGlvbmFscyBhcyBCaW5kaW5nUGlwZVtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbiBpZGVudGlmaWVyLCBhIGtleXdvcmQsIGEgc3RyaW5nIHdpdGggYW4gb3B0aW9uYWwgYC1gIGluIGJldHdlZW4sXG4gICAqIGFuZCByZXR1cm5zIHRoZSBzdHJpbmcgYWxvbmcgd2l0aCBpdHMgYWJzb2x1dGUgc291cmNlIHNwYW4uXG4gICAqL1xuICBleHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllciB7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGxldCBvcGVyYXRvckZvdW5kID0gZmFsc2U7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTtcbiAgICAgIG9wZXJhdG9yRm91bmQgPSB0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCctJyk7XG4gICAgICBpZiAob3BlcmF0b3JGb3VuZCkge1xuICAgICAgICByZXN1bHQgKz0gJy0nO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKG9wZXJhdG9yRm91bmQpO1xuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2U6IHJlc3VsdCxcbiAgICAgIHNwYW46IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oc3RhcnQsIHN0YXJ0ICsgcmVzdWx0Lmxlbmd0aCksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBtaWNyb3N5bnRheCB0ZW1wbGF0ZSBleHByZXNzaW9uIGFuZCByZXR1cm4gYSBsaXN0IG9mIGJpbmRpbmdzIG9yXG4gICAqIHBhcnNpbmcgZXJyb3JzIGluIGNhc2UgdGhlIGdpdmVuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgIDxkaXYgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGluZGV4IGFzIGk7IHRyYWNrQnk6IGZ1bmNcIj5cbiAgICogYGBgXG4gICAqIGNvbnRhaW5zIGZpdmUgYmluZGluZ3M6XG4gICAqIDEuIG5nRm9yIC0+IG51bGxcbiAgICogMi4gaXRlbSAtPiBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRcbiAgICogMy4gbmdGb3JPZiAtPiBpdGVtc1xuICAgKiA0LiBpIC0+IE5nRm9yT2ZDb250ZXh0LmluZGV4XG4gICAqIDUuIG5nRm9yVHJhY2tCeSAtPiBmdW5jXG4gICAqXG4gICAqIEZvciBhIGZ1bGwgZGVzY3JpcHRpb24gb2YgdGhlIG1pY3Jvc3ludGF4IGdyYW1tYXIsIHNlZVxuICAgKiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9taGV2ZXJ5L2QzNTMwMjk0Y2ZmMmU0YTFiM2ZlMTVmZjc1ZDA4ODU1XG4gICAqXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZUtleSBuYW1lIG9mIHRoZSBtaWNyb3N5bnRheCBkaXJlY3RpdmUsIGxpa2UgbmdJZiwgbmdGb3IsXG4gICAqIHdpdGhvdXQgdGhlICosIGFsb25nIHdpdGggaXRzIGFic29sdXRlIHNwYW4uXG4gICAqL1xuICBwYXJzZVRlbXBsYXRlQmluZGluZ3ModGVtcGxhdGVLZXk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gICAgY29uc3QgYmluZGluZ3M6IFRlbXBsYXRlQmluZGluZ1tdID0gW107XG5cbiAgICAvLyBUaGUgZmlyc3QgYmluZGluZyBpcyBmb3IgdGhlIHRlbXBsYXRlIGtleSBpdHNlbGZcbiAgICAvLyBJbiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiLCBrZXkgPSBcIm5nRm9yXCIsIHZhbHVlID0gbnVsbFxuICAgIC8vIEluICpuZ0lmPVwiY29uZCB8IHBpcGVcIiwga2V5ID0gXCJuZ0lmXCIsIHZhbHVlID0gXCJjb25kIHwgcGlwZVwiXG4gICAgYmluZGluZ3MucHVzaCguLi50aGlzLnBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKHRlbXBsYXRlS2V5KSk7XG5cbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgLy8gSWYgaXQgc3RhcnRzIHdpdGggJ2xldCcsIHRoZW4gdGhpcyBtdXN0IGJlIHZhcmlhYmxlIGRlY2xhcmF0aW9uXG4gICAgICBjb25zdCBsZXRCaW5kaW5nID0gdGhpcy5wYXJzZUxldEJpbmRpbmcoKTtcbiAgICAgIGlmIChsZXRCaW5kaW5nKSB7XG4gICAgICAgIGJpbmRpbmdzLnB1c2gobGV0QmluZGluZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUd28gcG9zc2libGUgY2FzZXMgaGVyZSwgZWl0aGVyIGB2YWx1ZSBcImFzXCIga2V5YCBvclxuICAgICAgICAvLyBcImRpcmVjdGl2ZS1rZXl3b3JkIGV4cHJlc3Npb25cIi4gV2UgZG9uJ3Qga25vdyB3aGljaCBjYXNlLCBidXQgYm90aFxuICAgICAgICAvLyBcInZhbHVlXCIgYW5kIFwiZGlyZWN0aXZlLWtleXdvcmRcIiBhcmUgdGVtcGxhdGUgYmluZGluZyBrZXksIHNvIGNvbnN1bWVcbiAgICAgICAgLy8gdGhlIGtleSBmaXJzdC5cbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICAgICAgLy8gUGVlayBhdCB0aGUgbmV4dCB0b2tlbiwgaWYgaXQgaXMgXCJhc1wiIHRoZW4gdGhpcyBtdXN0IGJlIHZhcmlhYmxlXG4gICAgICAgIC8vIGRlY2xhcmF0aW9uLlxuICAgICAgICBjb25zdCBiaW5kaW5nID0gdGhpcy5wYXJzZUFzQmluZGluZyhrZXkpO1xuICAgICAgICBpZiAoYmluZGluZykge1xuICAgICAgICAgIGJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIHRoZSBrZXkgbXVzdCBiZSBhIGRpcmVjdGl2ZSBrZXl3b3JkLCBsaWtlIFwib2ZcIi4gVHJhbnNmb3JtXG4gICAgICAgICAgLy8gdGhlIGtleSB0byBhY3R1YWwga2V5LiBFZy4gb2YgLT4gbmdGb3JPZiwgdHJhY2tCeSAtPiBuZ0ZvclRyYWNrQnlcbiAgICAgICAgICBrZXkuc291cmNlID0gdGVtcGxhdGVLZXkuc291cmNlICsga2V5LnNvdXJjZVswXS50b1VwcGVyQ2FzZSgpICsga2V5LnNvdXJjZS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgYmluZGluZ3MucHVzaCguLi50aGlzLnBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKGtleSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdChiaW5kaW5ncywgW10gLyogd2FybmluZ3MgKi8sIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBhIGRpcmVjdGl2ZSBrZXl3b3JkLCBmb2xsb3dlZCBieSBhIG1hbmRhdG9yeSBleHByZXNzaW9uLlxuICAgKiBGb3IgZXhhbXBsZSwgXCJvZiBpdGVtc1wiLCBcInRyYWNrQnk6IGZ1bmNcIi5cbiAgICogVGhlIGJpbmRpbmdzIGFyZTogbmdGb3JPZiAtPiBpdGVtcywgbmdGb3JUcmFja0J5IC0+IGZ1bmNcbiAgICogVGhlcmUgY291bGQgYmUgYW4gb3B0aW9uYWwgXCJhc1wiIGJpbmRpbmcgdGhhdCBmb2xsb3dzIHRoZSBleHByZXNzaW9uLlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXMgfCBzbGljZTowOjEgYXMgY29sbGVjdGlvblwiLlxuICAgKiAgICAgICAgICAgICAgICAgICAgXl4gXl5eXl5eXl5eXl5eXl5eXl4gXl5eXl5eXl5eXl5eXlxuICAgKiAgICAgICAgICAgICAgIGtleXdvcmQgICAgYm91bmQgdGFyZ2V0ICAgb3B0aW9uYWwgJ2FzJyBiaW5kaW5nXG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ga2V5IGJpbmRpbmcga2V5LCBmb3IgZXhhbXBsZSwgbmdGb3IsIG5nSWYsIG5nRm9yT2YsIGFsb25nIHdpdGggaXRzXG4gICAqIGFic29sdXRlIHNwYW4uXG4gICAqL1xuICBwcml2YXRlIHBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKGtleTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcik6IFRlbXBsYXRlQmluZGluZ1tdIHtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcbiAgICB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pOyAgLy8gdHJhY2tCeTogdHJhY2tCeUZ1bmN0aW9uXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk7XG4gICAgbGV0IHNwYW5FbmQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICAvLyBUaGUgYmluZGluZyBjb3VsZCBvcHRpb25hbGx5IGJlIGZvbGxvd2VkIGJ5IFwiYXNcIi4gRm9yIGV4YW1wbGUsXG4gICAgLy8gKm5nSWY9XCJjb25kIHwgcGlwZSBhcyB4XCIuIEluIHRoaXMgY2FzZSwgdGhlIGtleSBpbiB0aGUgXCJhc1wiIGJpbmRpbmdcbiAgICAvLyBpcyBcInhcIiBhbmQgdGhlIHZhbHVlIGlzIHRoZSB0ZW1wbGF0ZSBrZXkgaXRzZWxmIChcIm5nSWZcIikuIE5vdGUgdGhhdCB0aGVcbiAgICAvLyAna2V5JyBpbiB0aGUgY3VycmVudCBjb250ZXh0IG5vdyBiZWNvbWVzIHRoZSBcInZhbHVlXCIgaW4gdGhlIG5leHQgYmluZGluZy5cbiAgICBjb25zdCBhc0JpbmRpbmcgPSB0aGlzLnBhcnNlQXNCaW5kaW5nKGtleSk7XG4gICAgaWYgKCFhc0JpbmRpbmcpIHtcbiAgICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICAgIHNwYW5FbmQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oa2V5LnNwYW4uc3RhcnQsIHNwYW5FbmQpO1xuICAgIGJpbmRpbmdzLnB1c2gobmV3IEV4cHJlc3Npb25CaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpKTtcbiAgICBpZiAoYXNCaW5kaW5nKSB7XG4gICAgICBiaW5kaW5ncy5wdXNoKGFzQmluZGluZyk7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5ncztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGV4cHJlc3Npb24gQVNUIGZvciB0aGUgYm91bmQgdGFyZ2V0IG9mIGEgZGlyZWN0aXZlIGtleXdvcmRcbiAgICogYmluZGluZy4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0lmPVwiY29uZGl0aW9uIHwgcGlwZVwiXG4gICAqICAgICAgICAgIF5eXl5eXl5eXl5eXl5eXl4gYm91bmQgdGFyZ2V0IGZvciBcIm5nSWZcIlxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zXCJcbiAgICogICAgICAgICAgICAgICAgICAgICAgIF5eXl5eIGJvdW5kIHRhcmdldCBmb3IgXCJuZ0Zvck9mXCJcbiAgICogYGBgXG4gICAqL1xuICBwcml2YXRlIGdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgaWYgKHRoaXMubmV4dCA9PT0gRU9GIHx8IHRoaXMucGVla0tleXdvcmRBcygpIHx8IHRoaXMucGVla0tleXdvcmRMZXQoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGFzdCA9IHRoaXMucGFyc2VQaXBlKCk7ICAvLyBleGFtcGxlOiBcImNvbmRpdGlvbiB8IGFzeW5jXCJcbiAgICBjb25zdCB7c3RhcnQsIGVuZH0gPSBhc3Quc3BhbjtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIHZhbHVlLCB0aGlzLmxvY2F0aW9uLCB0aGlzLmFic29sdXRlT2Zmc2V0ICsgc3RhcnQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGJpbmRpbmcgZm9yIGEgdmFyaWFibGUgZGVjbGFyZWQgdXNpbmcgYGFzYC4gTm90ZSB0aGF0IHRoZSBvcmRlclxuICAgKiBvZiB0aGUga2V5LXZhbHVlIHBhaXIgaW4gdGhpcyBkZWNsYXJhdGlvbiBpcyByZXZlcnNlZC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpXCJcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBeXl5eXiAgICBeXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgICAga2V5XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgbmFtZSBvZiB0aGUgdmFsdWUgaW4gdGhlIGRlY2xhcmF0aW9uLCBcIm5nSWZcIiBpbiB0aGUgZXhhbXBsZVxuICAgKiBhYm92ZSwgYWxvbmcgd2l0aCBpdHMgYWJzb2x1dGUgc3Bhbi5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VBc0JpbmRpbmcodmFsdWU6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmd8bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBlZWtLZXl3b3JkQXMoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gY29uc3VtZSB0aGUgJ2FzJyBrZXl3b3JkXG4gICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4odmFsdWUuc3Bhbi5zdGFydCwgdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQpO1xuICAgIHJldHVybiBuZXcgVmFyaWFibGVCaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYmluZGluZyBmb3IgYSB2YXJpYWJsZSBkZWNsYXJlZCB1c2luZyBgbGV0YC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBsZXQgaT1pbmRleDtcIlxuICAgKiAgICAgICAgICAgXl5eXl5eXl4gICAgICAgICAgIF5eXl5eXl5eXl5eXG4gICAqIGBgYFxuICAgKiBJbiB0aGUgZmlyc3QgYmluZGluZywgYGl0ZW1gIGlzIGJvdW5kIHRvIGBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRgLlxuICAgKiBJbiB0aGUgc2Vjb25kIGJpbmRpbmcsIGBpYCBpcyBib3VuZCB0byBgTmdGb3JPZkNvbnRleHQuaW5kZXhgLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUxldEJpbmRpbmcoKTogVGVtcGxhdGVCaW5kaW5nfG51bGwge1xuICAgIGlmICghdGhpcy5wZWVrS2V5d29yZExldCgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc3BhblN0YXJ0ID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBjb25zdW1lIHRoZSAnbGV0JyBrZXl3b3JkXG4gICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICBsZXQgdmFsdWU6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgdmFsdWUgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIH1cbiAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oc3BhblN0YXJ0LCB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldCk7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3VtZSB0aGUgb3B0aW9uYWwgc3RhdGVtZW50IHRlcm1pbmF0b3I6IHNlbWljb2xvbiBvciBjb21tYS5cbiAgICovXG4gIHByaXZhdGUgY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKSB7XG4gICAgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgfHwgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvcmRzIGFuIGVycm9yIGFuZCBza2lwcyBvdmVyIHRoZSB0b2tlbiBzdHJlYW0gdW50aWwgcmVhY2hpbmcgYSByZWNvdmVyYWJsZSBwb2ludC4gU2VlXG4gICAqIGB0aGlzLnNraXBgIGZvciBtb3JlIGRldGFpbHMgb24gdG9rZW4gc2tpcHBpbmcuXG4gICAqL1xuICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIGluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihtZXNzYWdlLCB0aGlzLmlucHV0LCB0aGlzLmxvY2F0aW9uVGV4dChpbmRleCksIHRoaXMubG9jYXRpb24pKTtcbiAgICB0aGlzLnNraXAoKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9jYXRpb25UZXh0KGluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwpIHtcbiAgICBpZiAoaW5kZXggPT0gbnVsbCkgaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIHJldHVybiAoaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID8gYGF0IGNvbHVtbiAke3RoaXMudG9rZW5zW2luZGV4XS5pbmRleCArIDF9IGluYCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgYXQgdGhlIGVuZCBvZiB0aGUgZXhwcmVzc2lvbmA7XG4gIH1cblxuICAvKipcbiAgICogRXJyb3IgcmVjb3Zlcnkgc2hvdWxkIHNraXAgdG9rZW5zIHVudGlsIGl0IGVuY291bnRlcnMgYSByZWNvdmVyeSBwb2ludC5cbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgdHJlYXRlZCBhcyB1bmNvbmRpdGlvbmFsIHJlY292ZXJ5IHBvaW50czpcbiAgICogICAtIGVuZCBvZiBpbnB1dFxuICAgKiAgIC0gJzsnIChwYXJzZUNoYWluKCkgaXMgYWx3YXlzIHRoZSByb290IHByb2R1Y3Rpb24sIGFuZCBpdCBleHBlY3RzIGEgJzsnKVxuICAgKiAgIC0gJ3wnIChzaW5jZSBwaXBlcyBtYXkgYmUgY2hhaW5lZCBhbmQgZWFjaCBwaXBlIGV4cHJlc3Npb24gbWF5IGJlIHRyZWF0ZWQgaW5kZXBlbmRlbnRseSlcbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgY29uZGl0aW9uYWwgcmVjb3ZlcnkgcG9pbnRzOlxuICAgKiAgIC0gJyknLCAnfScsICddJyBpZiBvbmUgb2YgY2FsbGluZyBwcm9kdWN0aW9ucyBpcyBleHBlY3Rpbmcgb25lIG9mIHRoZXNlIHN5bWJvbHNcbiAgICogICAgIC0gVGhpcyBhbGxvd3Mgc2tpcCgpIHRvIHJlY292ZXIgZnJvbSBlcnJvcnMgc3VjaCBhcyAnKGEuKSArIDEnIGFsbG93aW5nIG1vcmUgb2YgdGhlIEFTVCB0b1xuICAgKiAgICAgICBiZSByZXRhaW5lZCAoaXQgZG9lc24ndCBza2lwIGFueSB0b2tlbnMgYXMgdGhlICcpJyBpcyByZXRhaW5lZCBiZWNhdXNlIG9mIHRoZSAnKCcgYmVnaW5zXG4gICAqICAgICAgIGFuICcoJyA8ZXhwcj4gJyknIHByb2R1Y3Rpb24pLlxuICAgKiAgICAgICBUaGUgcmVjb3ZlcnkgcG9pbnRzIG9mIGdyb3VwaW5nIHN5bWJvbHMgbXVzdCBiZSBjb25kaXRpb25hbCBhcyB0aGV5IG11c3QgYmUgc2tpcHBlZCBpZlxuICAgKiAgICAgICBub25lIG9mIHRoZSBjYWxsaW5nIHByb2R1Y3Rpb25zIGFyZSBub3QgZXhwZWN0aW5nIHRoZSBjbG9zaW5nIHRva2VuIGVsc2Ugd2Ugd2lsbCBuZXZlclxuICAgKiAgICAgICBtYWtlIHByb2dyZXNzIGluIHRoZSBjYXNlIG9mIGFuIGV4dHJhbmVvdXMgZ3JvdXAgY2xvc2luZyBzeW1ib2wgKHN1Y2ggYXMgYSBzdHJheSAnKScpLlxuICAgKiAgICAgICBUaGF0IGlzLCB3ZSBza2lwIGEgY2xvc2luZyBzeW1ib2wgaWYgd2UgYXJlIG5vdCBpbiBhIGdyb3VwaW5nIHByb2R1Y3Rpb24uXG4gICAqICAgLSAnPScgaW4gYSBgV3JpdGFibGVgIGNvbnRleHRcbiAgICogICAgIC0gSW4gdGhpcyBjb250ZXh0LCB3ZSBhcmUgYWJsZSB0byByZWNvdmVyIGFmdGVyIHNlZWluZyB0aGUgYD1gIG9wZXJhdG9yLCB3aGljaFxuICAgKiAgICAgICBzaWduYWxzIHRoZSBwcmVzZW5jZSBvZiBhbiBpbmRlcGVuZGVudCBydmFsdWUgZXhwcmVzc2lvbiBmb2xsb3dpbmcgdGhlIGA9YCBvcGVyYXRvci5cbiAgICpcbiAgICogSWYgYSBwcm9kdWN0aW9uIGV4cGVjdHMgb25lIG9mIHRoZXNlIHRva2VuIGl0IGluY3JlbWVudHMgdGhlIGNvcnJlc3BvbmRpbmcgbmVzdGluZyBjb3VudCxcbiAgICogYW5kIHRoZW4gZGVjcmVtZW50cyBpdCBqdXN0IHByaW9yIHRvIGNoZWNraW5nIGlmIHRoZSB0b2tlbiBpcyBpbiB0aGUgaW5wdXQuXG4gICAqL1xuICBwcml2YXRlIHNraXAoKSB7XG4gICAgbGV0IG4gPSB0aGlzLm5leHQ7XG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggJiYgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgJiZcbiAgICAgICAgICAgIW4uaXNPcGVyYXRvcignfCcpICYmICh0aGlzLnJwYXJlbnNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2VzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkgJiZcbiAgICAgICAgICAgKHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpKSAmJlxuICAgICAgICAgICAoISh0aGlzLmNvbnRleHQgJiBQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSkgfHwgIW4uaXNPcGVyYXRvcignPScpKSkge1xuICAgICAgaWYgKHRoaXMubmV4dC5pc0Vycm9yKCkpIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZXJFcnJvcih0aGlzLm5leHQudG9TdHJpbmcoKSEsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KCksIHRoaXMubG9jYXRpb24pKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbiA9IHRoaXMubmV4dDtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IFNhZmVQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBGdW5jdGlvbkNhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy52aXNpdEFsbChhc3QudmFsdWVzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0VW5hcnkoYXN0OiBVbmFyeSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcmVmaXhOb3QoYXN0OiBQcmVmaXhOb3QsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBOb25OdWxsQXNzZXJ0LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IENvbmRpdGlvbmFsLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSkge1xuICAgIHRoaXMuZXJyb3JzLnB1c2goJ3BpcGVzJyk7XG4gIH1cblxuICB2aXNpdEtleWVkUmVhZChhc3Q6IEtleWVkUmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEFsbChhc3RzOiBhbnlbXSwgY29udGV4dDogYW55KTogYW55W10ge1xuICAgIHJldHVybiBhc3RzLm1hcChub2RlID0+IG5vZGUudmlzaXQodGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgdmlzaXRDaGFpbihhc3Q6IENoYWluLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRRdW90ZShhc3Q6IFF1b3RlLCBjb250ZXh0OiBhbnkpIHt9XG59XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpbXBsZW1lbnRzIFNpbXBsZUV4cHJlc3Npb25DaGVja2VyIHVzZWQgaW4gVmlldyBFbmdpbmUgYW5kIHBlcmZvcm1zIG1vcmUgc3RyaWN0IGNoZWNrc1xuICogdG8gbWFrZSBzdXJlIGhvc3QgYmluZGluZ3MgZG8gbm90IGNvbnRhaW4gcGlwZXMuIEluIFZpZXcgRW5naW5lLCBoYXZpbmcgcGlwZXMgaW4gaG9zdCBiaW5kaW5ncyBpc1xuICogbm90IHN1cHBvcnRlZCBhcyB3ZWxsLCBidXQgaW4gc29tZSBjYXNlcyAobGlrZSBgISh2YWx1ZSB8IGFzeW5jKWApIHRoZSBlcnJvciBpcyBub3QgdHJpZ2dlcmVkIGF0XG4gKiBjb21waWxlIHRpbWUuIEluIG9yZGVyIHRvIHByZXNlcnZlIFZpZXcgRW5naW5lIGJlaGF2aW9yLCBtb3JlIHN0cmljdCBjaGVja3MgYXJlIGludHJvZHVjZWQgZm9yXG4gKiBJdnkgbW9kZSBvbmx5LlxuICovXG5jbGFzcyBJdnlTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciBleHRlbmRzIFJlY3Vyc2l2ZUFzdFZpc2l0b3IgaW1wbGVtZW50cyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciB7XG4gIGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICB2aXNpdFBpcGUoKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaCgncGlwZXMnKTtcbiAgfVxufVxuIl19