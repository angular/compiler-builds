/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as chars from '../chars';
import { DEFAULT_INTERPOLATION_CONFIG } from '../ml_parser/interpolation_config';
import { AbsoluteSourceSpan, ASTWithSource, Binary, BindingPipe, Call, Chain, Conditional, EmptyExpr, ExpressionBinding, ImplicitReceiver, Interpolation, KeyedRead, KeyedWrite, LiteralArray, LiteralMap, LiteralPrimitive, NonNullAssert, ParserError, ParseSpan, PrefixNot, PropertyRead, PropertyWrite, Quote, RecursiveAstVisitor, SafeCall, SafeKeyedRead, SafePropertyRead, ThisReceiver, Unary, VariableBinding } from './ast';
import { EOF, isIdentifier, TokenType } from './lexer';
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
export class Parser {
    constructor(_lexer) {
        this._lexer = _lexer;
        this.errors = [];
    }
    parseAction(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        this._checkNoInterpolation(input, location, interpolationConfig);
        const sourceToLex = this._stripComments(input);
        const tokens = this._lexer.tokenize(sourceToLex);
        const ast = new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, true, this.errors, 0)
            .parseChain();
        return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
    }
    parseBinding(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
        const ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
        return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
    }
    checkSimpleExpression(ast) {
        const checker = new SimpleExpressionChecker();
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
        return new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, false, this.errors, 0)
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
        const { strings, expressions, offsets } = this.splitInterpolation(input, location, interpolationConfig);
        if (expressions.length === 0)
            return null;
        const expressionNodes = [];
        for (let i = 0; i < expressions.length; ++i) {
            const expressionText = expressions[i].text;
            const sourceToLex = this._stripComments(expressionText);
            const tokens = this._lexer.tokenize(sourceToLex);
            const ast = new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, false, this.errors, offsets[i])
                .parseChain();
            expressionNodes.push(ast);
        }
        return this.createInterpolationAst(strings.map(s => s.text), expressionNodes, input, location, absoluteOffset);
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
                const text = input.substring(start, i);
                strings.push({ text, start, end: i });
                atInterpolation = true;
            }
            else {
                // parse from starting {{ to ending }} while ignoring content inside quotes.
                const fullStart = i;
                const exprStart = fullStart + interpStart.length;
                const exprEnd = this._getInterpolationEndIndex(input, interpEnd, exprStart);
                if (exprEnd === -1) {
                    // Could not find the end of the interpolation; do not parse an expression.
                    // Instead we should extend the content on the last raw string.
                    atInterpolation = false;
                    extendLastString = true;
                    break;
                }
                const fullEnd = exprEnd + interpEnd.length;
                const text = input.substring(exprStart, exprEnd);
                if (text.trim().length === 0) {
                    this._reportError('Blank expressions are not allowed in interpolated strings', input, `at column ${i} in`, location);
                }
                expressions.push({ text, start: fullStart, end: fullEnd });
                offsets.push(exprStart);
                i = fullEnd;
                atInterpolation = false;
            }
        }
        if (!atInterpolation) {
            // If we are now at a text section, add the remaining content as a raw string.
            if (extendLastString) {
                const piece = strings[strings.length - 1];
                piece.text += input.substring(i);
                piece.end = input.length;
            }
            else {
                strings.push({ text: input.substring(i), start: i, end: input.length });
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
            else if (outerQuote == null && chars.isQuote(char)) {
                outerQuote = char;
            }
        }
        return null;
    }
    _checkNoInterpolation(input, location, { start, end }) {
        let startIndex = -1;
        let endIndex = -1;
        for (const charIndex of this._forEachUnquotedChar(input, 0)) {
            if (startIndex === -1) {
                if (input.startsWith(start)) {
                    startIndex = charIndex;
                }
            }
            else {
                endIndex = this._getInterpolationEndIndex(input, end, charIndex);
                if (endIndex > -1) {
                    break;
                }
            }
        }
        if (startIndex > -1 && endIndex > -1) {
            this._reportError(`Got interpolation (${start}${end}) where expression was expected`, input, `at column ${startIndex} in`, location);
        }
    }
    /**
     * Finds the index of the end of an interpolation expression
     * while ignoring comments and quoted content.
     */
    _getInterpolationEndIndex(input, expressionEnd, start) {
        for (const charIndex of this._forEachUnquotedChar(input, start)) {
            if (input.startsWith(expressionEnd, charIndex)) {
                return charIndex;
            }
            // Nothing else in the expression matters after we've
            // hit a comment so look directly for the end token.
            if (input.startsWith('//', charIndex)) {
                return input.indexOf(expressionEnd, charIndex);
            }
        }
        return -1;
    }
    /**
     * Generator used to iterate over the character indexes of a string that are outside of quotes.
     * @param input String to loop through.
     * @param start Index within the string at which to start.
     */
    *_forEachUnquotedChar(input, start) {
        let currentQuote = null;
        let escapeCount = 0;
        for (let i = start; i < input.length; i++) {
            const char = input[i];
            // Skip the characters inside quotes. Note that we only care about the outer-most
            // quotes matching up and we need to account for escape characters.
            if (chars.isQuote(input.charCodeAt(i)) && (currentQuote === null || currentQuote === char) &&
                escapeCount % 2 === 0) {
                currentQuote = currentQuote === null ? char : null;
            }
            else if (currentQuote === null) {
                yield i;
            }
            escapeCount = char === '\\' ? escapeCount + 1 : 0;
        }
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
    /**
     * Retrieve a `ParseSpan` from `start` to the current position (or to `artificialEndIndex` if
     * provided).
     *
     * @param start Position from which the `ParseSpan` will start.
     * @param artificialEndIndex Optional ending index to be used if provided (and if greater than the
     *     natural ending index)
     */
    span(start, artificialEndIndex) {
        let endIndex = this.currentEndIndex;
        if (artificialEndIndex !== undefined && artificialEndIndex > this.currentEndIndex) {
            endIndex = artificialEndIndex;
        }
        // In some unusual parsing scenarios (like when certain tokens are missing and an `EmptyExpr` is
        // being created), the current token may already be advanced beyond the `currentEndIndex`. This
        // appears to be a deep-seated parser bug.
        //
        // As a workaround for now, swap the start and end indices to ensure a valid `ParseSpan`.
        // TODO(alxhub): fix the bug upstream in the parser state, and remove this workaround.
        if (start > endIndex) {
            const tmp = endIndex;
            endIndex = start;
            start = tmp;
        }
        return new ParseSpan(start, endIndex);
    }
    sourceSpan(start, artificialEndIndex) {
        const serial = `${start}@${this.inputIndex}:${artificialEndIndex}`;
        if (!this.sourceSpanCache.has(serial)) {
            this.sourceSpanCache.set(serial, this.span(start, artificialEndIndex).toAbsolute(this.absoluteOffset));
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
            if (n.isPrivateIdentifier()) {
                this._reportErrorForPrivateIdentifier(n, 'expected identifier or keyword');
            }
            else {
                this.error(`Unexpected ${this.prettyPrintToken(n)}, expected identifier or keyword`);
            }
            return null;
        }
        this.advance();
        return n.toString();
    }
    expectIdentifierOrKeywordOrString() {
        const n = this.next;
        if (!n.isIdentifier() && !n.isKeyword() && !n.isString()) {
            if (n.isPrivateIdentifier()) {
                this._reportErrorForPrivateIdentifier(n, 'expected identifier, keyword or string');
            }
            else {
                this.error(`Unexpected ${this.prettyPrintToken(n)}, expected identifier, keyword, or string`);
            }
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
        if (exprs.length == 0) {
            // We have no expressions so create an empty expression that spans the entire input length
            const artificialStart = this.offset;
            const artificialEnd = this.offset + this.inputLength;
            return new EmptyExpr(this.span(artificialStart, artificialEnd), this.sourceSpan(artificialStart, artificialEnd));
        }
        if (exprs.length == 1)
            return exprs[0];
        return new Chain(this.span(start), this.sourceSpan(start), exprs);
    }
    parsePipe() {
        const start = this.inputIndex;
        let result = this.parseExpression();
        if (this.consumeOptionalOperator('|')) {
            if (this.parseAction) {
                this.error('Cannot have a pipe in an action expression');
            }
            do {
                const nameStart = this.inputIndex;
                let nameId = this.expectIdentifierOrKeyword();
                let nameSpan;
                let fullSpanEnd = undefined;
                if (nameId !== null) {
                    nameSpan = this.sourceSpan(nameStart);
                }
                else {
                    // No valid identifier was found, so we'll assume an empty pipe name ('').
                    nameId = '';
                    // However, there may have been whitespace present between the pipe character and the next
                    // token in the sequence (or the end of input). We want to track this whitespace so that
                    // the `BindingPipe` we produce covers not just the pipe character, but any trailing
                    // whitespace beyond it. Another way of thinking about this is that the zero-length name
                    // is assumed to be at the end of any whitespace beyond the pipe character.
                    //
                    // Therefore, we push the end of the `ParseSpan` for this pipe all the way up to the
                    // beginning of the next token, or until the end of input if the next token is EOF.
                    fullSpanEnd = this.next.index !== -1 ? this.next.index : this.inputLength + this.offset;
                    // The `nameSpan` for an empty pipe name is zero-length at the end of any whitespace
                    // beyond the pipe character.
                    nameSpan = new ParseSpan(fullSpanEnd, fullSpanEnd).toAbsolute(this.absoluteOffset);
                }
                const args = [];
                while (this.consumeOptionalCharacter(chars.$COLON)) {
                    args.push(this.parseExpression());
                    // If there are additional expressions beyond the name, then the artificial end for the
                    // name is no longer relevant.
                }
                result = new BindingPipe(this.span(start), this.sourceSpan(start, fullSpanEnd), result, nameId, args, nameSpan);
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
        const start = this.inputIndex;
        let result = this.parseLogicalAnd();
        while (this.consumeOptionalOperator('||')) {
            const right = this.parseLogicalAnd();
            result = new Binary(this.span(start), this.sourceSpan(start), '||', result, right);
        }
        return result;
    }
    parseLogicalAnd() {
        // '&&'
        const start = this.inputIndex;
        let result = this.parseNullishCoalescing();
        while (this.consumeOptionalOperator('&&')) {
            const right = this.parseNullishCoalescing();
            result = new Binary(this.span(start), this.sourceSpan(start), '&&', result, right);
        }
        return result;
    }
    parseNullishCoalescing() {
        // '??'
        const start = this.inputIndex;
        let result = this.parseEquality();
        while (this.consumeOptionalOperator('??')) {
            const right = this.parseEquality();
            result = new Binary(this.span(start), this.sourceSpan(start), '??', result, right);
        }
        return result;
    }
    parseEquality() {
        // '==','!=','===','!=='
        const start = this.inputIndex;
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
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    }
    parseRelational() {
        // '<', '>', '<=', '>='
        const start = this.inputIndex;
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
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    }
    parseAdditive() {
        // '+', '-'
        const start = this.inputIndex;
        let result = this.parseMultiplicative();
        while (this.next.type == TokenType.Operator) {
            const operator = this.next.strValue;
            switch (operator) {
                case '+':
                case '-':
                    this.advance();
                    let right = this.parseMultiplicative();
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    }
    parseMultiplicative() {
        // '*', '%', '/'
        const start = this.inputIndex;
        let result = this.parsePrefix();
        while (this.next.type == TokenType.Operator) {
            const operator = this.next.strValue;
            switch (operator) {
                case '*':
                case '%':
                case '/':
                    this.advance();
                    let right = this.parsePrefix();
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
        const start = this.inputIndex;
        let result = this.parsePrimary();
        while (true) {
            if (this.consumeOptionalCharacter(chars.$PERIOD)) {
                result = this.parseAccessMember(result, start, false);
            }
            else if (this.consumeOptionalOperator('?.')) {
                if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                    result = this.parseCall(result, start, true);
                }
                else {
                    result = this.consumeOptionalCharacter(chars.$LBRACKET) ?
                        this.parseKeyedReadOrWrite(result, start, true) :
                        this.parseAccessMember(result, start, true);
                }
            }
            else if (this.consumeOptionalCharacter(chars.$LBRACKET)) {
                result = this.parseKeyedReadOrWrite(result, start, false);
            }
            else if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                result = this.parseCall(result, start, false);
            }
            else if (this.consumeOptionalOperator('!')) {
                result = new NonNullAssert(this.span(start), this.sourceSpan(start), result);
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
            return this.parseAccessMember(new ImplicitReceiver(this.span(start), this.sourceSpan(start)), start, false);
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
        else if (this.next.isPrivateIdentifier()) {
            this._reportErrorForPrivateIdentifier(this.next, null);
            return new EmptyExpr(this.span(start), this.sourceSpan(start));
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
        do {
            if (!this.next.isCharacter(terminator)) {
                result.push(this.parsePipe());
            }
            else {
                break;
            }
        } while (this.consumeOptionalCharacter(chars.$COMMA));
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
                const keyStart = this.inputIndex;
                const quoted = this.next.isString();
                const key = this.expectIdentifierOrKeywordOrString();
                keys.push({ key, quoted });
                // Properties with quoted keys can't use the shorthand syntax.
                if (quoted) {
                    this.expectCharacter(chars.$COLON);
                    values.push(this.parsePipe());
                }
                else if (this.consumeOptionalCharacter(chars.$COLON)) {
                    values.push(this.parsePipe());
                }
                else {
                    const span = this.span(keyStart);
                    const sourceSpan = this.sourceSpan(keyStart);
                    values.push(new PropertyRead(span, sourceSpan, sourceSpan, new ImplicitReceiver(span, sourceSpan), key));
                }
            } while (this.consumeOptionalCharacter(chars.$COMMA));
            this.rbracesExpected--;
            this.expectCharacter(chars.$RBRACE);
        }
        return new LiteralMap(this.span(start), this.sourceSpan(start), keys, values);
    }
    parseAccessMember(readReceiver, start, isSafe) {
        const nameStart = this.inputIndex;
        const id = this.withContext(ParseContextFlags.Writable, () => {
            const id = this.expectIdentifierOrKeyword() ?? '';
            if (id.length === 0) {
                this.error(`Expected identifier for property access`, readReceiver.span.end);
            }
            return id;
        });
        const nameSpan = this.sourceSpan(nameStart);
        let receiver;
        if (isSafe) {
            if (this.consumeOptionalOperator('=')) {
                this.error('The \'?.\' operator cannot be used in the assignment');
                receiver = new EmptyExpr(this.span(start), this.sourceSpan(start));
            }
            else {
                receiver = new SafePropertyRead(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id);
            }
        }
        else {
            if (this.consumeOptionalOperator('=')) {
                if (!this.parseAction) {
                    this.error('Bindings cannot contain assignments');
                    return new EmptyExpr(this.span(start), this.sourceSpan(start));
                }
                const value = this.parseConditional();
                receiver = new PropertyWrite(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id, value);
            }
            else {
                receiver =
                    new PropertyRead(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id);
            }
        }
        return receiver;
    }
    parseCall(receiver, start, isSafe) {
        const argumentStart = this.inputIndex;
        this.rparensExpected++;
        const args = this.parseCallArguments();
        const argumentSpan = this.span(argumentStart, this.inputIndex).toAbsolute(this.absoluteOffset);
        this.expectCharacter(chars.$RPAREN);
        this.rparensExpected--;
        const span = this.span(start);
        const sourceSpan = this.sourceSpan(start);
        return isSafe ? new SafeCall(span, sourceSpan, receiver, args, argumentSpan) :
            new Call(span, sourceSpan, receiver, args, argumentSpan);
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
                    key.source =
                        templateKey.source + key.source.charAt(0).toUpperCase() + key.source.substring(1);
                    bindings.push(...this.parseDirectiveKeywordBindings(key));
                }
            }
            this.consumeStatementTerminator();
        }
        return new TemplateBindingParseResult(bindings, [] /* warnings */, this.errors);
    }
    parseKeyedReadOrWrite(receiver, start, isSafe) {
        return this.withContext(ParseContextFlags.Writable, () => {
            this.rbracketsExpected++;
            const key = this.parsePipe();
            if (key instanceof EmptyExpr) {
                this.error(`Key access cannot be empty`);
            }
            this.rbracketsExpected--;
            this.expectCharacter(chars.$RBRACKET);
            if (this.consumeOptionalOperator('=')) {
                if (isSafe) {
                    this.error('The \'?.\' operator cannot be used in the assignment');
                }
                else {
                    const value = this.parseConditional();
                    return new KeyedWrite(this.span(start), this.sourceSpan(start), receiver, key, value);
                }
            }
            else {
                return isSafe ? new SafeKeyedRead(this.span(start), this.sourceSpan(start), receiver, key) :
                    new KeyedRead(this.span(start), this.sourceSpan(start), receiver, key);
            }
            return new EmptyExpr(this.span(start), this.sourceSpan(start));
        });
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
     * Records an error for an unexpected private identifier being discovered.
     * @param token Token representing a private identifier.
     * @param extraMessage Optional additional message being appended to the error.
     */
    _reportErrorForPrivateIdentifier(token, extraMessage) {
        let errorMessage = `Private identifiers are not supported. Unexpected private identifier: ${token}`;
        if (extraMessage !== null) {
            errorMessage += `, ${extraMessage}`;
        }
        this.error(errorMessage);
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
class SimpleExpressionChecker extends RecursiveAstVisitor {
    constructor() {
        super(...arguments);
        this.errors = [];
    }
    visitPipe() {
        this.errors.push('pipes');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sbUNBQW1DLENBQUM7QUFFcEcsT0FBTyxFQUFDLGtCQUFrQixFQUFPLGFBQWEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFpQixnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxnQkFBZ0IsRUFBOEMsWUFBWSxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDcmUsT0FBTyxFQUFDLEdBQUcsRUFBRSxZQUFZLEVBQWdCLFNBQVMsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQU9uRSxNQUFNLE9BQU8sa0JBQWtCO0lBQzdCLFlBQ1csT0FBNkIsRUFBUyxXQUFpQyxFQUN2RSxPQUFpQjtRQURqQixZQUFPLEdBQVAsT0FBTyxDQUFzQjtRQUFTLGdCQUFXLEdBQVgsV0FBVyxDQUFzQjtRQUN2RSxZQUFPLEdBQVAsT0FBTyxDQUFVO0lBQUcsQ0FBQztDQUNqQztBQUVELE1BQU0sT0FBTywwQkFBMEI7SUFDckMsWUFDVyxnQkFBbUMsRUFBUyxRQUFrQixFQUM5RCxNQUFxQjtRQURyQixxQkFBZ0IsR0FBaEIs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ZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoYXJzIGZyb20gJy4uL2NoYXJzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcblxuaW1wb3J0IHtBYnNvbHV0ZVNvdXJjZVNwYW4sIEFTVCwgQVNUV2l0aFNvdXJjZSwgQmluYXJ5LCBCaW5kaW5nUGlwZSwgQ2FsbCwgQ2hhaW4sIENvbmRpdGlvbmFsLCBFbXB0eUV4cHIsIEV4cHJlc3Npb25CaW5kaW5nLCBJbXBsaWNpdFJlY2VpdmVyLCBJbnRlcnBvbGF0aW9uLCBLZXllZFJlYWQsIEtleWVkV3JpdGUsIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbE1hcEtleSwgTGl0ZXJhbFByaW1pdGl2ZSwgTm9uTnVsbEFzc2VydCwgUGFyc2VyRXJyb3IsIFBhcnNlU3BhbiwgUHJlZml4Tm90LCBQcm9wZXJ0eVJlYWQsIFByb3BlcnR5V3JpdGUsIFF1b3RlLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBTYWZlQ2FsbCwgU2FmZUtleWVkUmVhZCwgU2FmZVByb3BlcnR5UmVhZCwgVGVtcGxhdGVCaW5kaW5nLCBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyLCBUaGlzUmVjZWl2ZXIsIFVuYXJ5LCBWYXJpYWJsZUJpbmRpbmd9IGZyb20gJy4vYXN0JztcbmltcG9ydCB7RU9GLCBpc0lkZW50aWZpZXIsIExleGVyLCBUb2tlbiwgVG9rZW5UeXBlfSBmcm9tICcuL2xleGVyJztcblxuZXhwb3J0IGludGVyZmFjZSBJbnRlcnBvbGF0aW9uUGllY2Uge1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0OiBudW1iZXI7XG4gIGVuZDogbnVtYmVyO1xufVxuZXhwb3J0IGNsYXNzIFNwbGl0SW50ZXJwb2xhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHN0cmluZ3M6IEludGVycG9sYXRpb25QaWVjZVtdLCBwdWJsaWMgZXhwcmVzc2lvbnM6IEludGVycG9sYXRpb25QaWVjZVtdLFxuICAgICAgcHVibGljIG9mZnNldHM6IG51bWJlcltdKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSwgcHVibGljIHdhcm5pbmdzOiBzdHJpbmdbXSxcbiAgICAgIHB1YmxpYyBlcnJvcnM6IFBhcnNlckVycm9yW10pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2xleGVyOiBMZXhlcikge31cblxuICBwYXJzZUFjdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIHRoaXMuX2NoZWNrTm9JbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgY29uc3QgYXN0ID1cbiAgICAgICAgbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCB0cnVlLCB0aGlzLmVycm9ycywgMClcbiAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcGFyc2VCaW5kaW5nKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VCaW5kaW5nQXN0KGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tTaW1wbGVFeHByZXNzaW9uKGFzdDogQVNUKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGNoZWNrZXIgPSBuZXcgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIoKTtcbiAgICBhc3QudmlzaXQoY2hlY2tlcik7XG4gICAgcmV0dXJuIGNoZWNrZXIuZXJyb3JzO1xuICB9XG5cbiAgcGFyc2VTaW1wbGVCaW5kaW5nKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VCaW5kaW5nQXN0KGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IGVycm9ycyA9IHRoaXMuY2hlY2tTaW1wbGVFeHByZXNzaW9uKGFzdCk7XG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgSG9zdCBiaW5kaW5nIGV4cHJlc3Npb24gY2Fubm90IGNvbnRhaW4gJHtlcnJvcnMuam9pbignICcpfWAsIGlucHV0LCBsb2NhdGlvbik7XG4gICAgfVxuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcG9ydEVycm9yKG1lc3NhZ2U6IHN0cmluZywgaW5wdXQ6IHN0cmluZywgZXJyTG9jYXRpb246IHN0cmluZywgY3R4TG9jYXRpb24/OiBzdHJpbmcpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihtZXNzYWdlLCBpbnB1dCwgZXJyTG9jYXRpb24sIGN0eExvY2F0aW9uKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUJpbmRpbmdBc3QoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IEFTVCB7XG4gICAgLy8gUXVvdGVzIGV4cHJlc3Npb25zIHVzZSAzcmQtcGFydHkgZXhwcmVzc2lvbiBsYW5ndWFnZS4gV2UgZG9uJ3Qgd2FudCB0byB1c2VcbiAgICAvLyBvdXIgbGV4ZXIgb3IgcGFyc2VyIGZvciB0aGF0LCBzbyB3ZSBjaGVjayBmb3IgdGhhdCBhaGVhZCBvZiB0aW1lLlxuICAgIGNvbnN0IHF1b3RlID0gdGhpcy5fcGFyc2VRdW90ZShpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0KTtcblxuICAgIGlmIChxdW90ZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gcXVvdGU7XG4gICAgfVxuXG4gICAgdGhpcy5fY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHNvdXJjZVRvTGV4KTtcbiAgICByZXR1cm4gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSwgdGhpcy5lcnJvcnMsIDApXG4gICAgICAgIC5wYXJzZUNoYWluKCk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVF1b3RlKGlucHV0OiBzdHJpbmd8bnVsbCwgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6IEFTVHxudWxsIHtcbiAgICBpZiAoaW5wdXQgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4U2VwYXJhdG9ySW5kZXggPSBpbnB1dC5pbmRleE9mKCc6Jyk7XG4gICAgaWYgKHByZWZpeFNlcGFyYXRvckluZGV4ID09IC0xKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBwcmVmaXggPSBpbnB1dC5zdWJzdHJpbmcoMCwgcHJlZml4U2VwYXJhdG9ySW5kZXgpLnRyaW0oKTtcbiAgICBpZiAoIWlzSWRlbnRpZmllcihwcmVmaXgpKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCB1bmludGVycHJldGVkRXhwcmVzc2lvbiA9IGlucHV0LnN1YnN0cmluZyhwcmVmaXhTZXBhcmF0b3JJbmRleCArIDEpO1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBRdW90ZShcbiAgICAgICAgc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgcHJlZml4LCB1bmludGVycHJldGVkRXhwcmVzc2lvbiwgbG9jYXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIG1pY3Jvc3ludGF4IHRlbXBsYXRlIGV4cHJlc3Npb24gYW5kIHJldHVybiBhIGxpc3Qgb2YgYmluZGluZ3Mgb3JcbiAgICogcGFyc2luZyBlcnJvcnMgaW4gY2FzZSB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBpcyBpbnZhbGlkLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgPGRpdiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiPlxuICAgKiAgICAgICAgIF4gICAgICBeIGFic29sdXRlVmFsdWVPZmZzZXQgZm9yIGB0ZW1wbGF0ZVZhbHVlYFxuICAgKiAgICAgICAgIGFic29sdXRlS2V5T2Zmc2V0IGZvciBgdGVtcGxhdGVLZXlgXG4gICAqIGBgYFxuICAgKiBjb250YWlucyB0aHJlZSBiaW5kaW5nczpcbiAgICogMS4gbmdGb3IgLT4gbnVsbFxuICAgKiAyLiBpdGVtIC0+IE5nRm9yT2ZDb250ZXh0LiRpbXBsaWNpdFxuICAgKiAzLiBuZ0Zvck9mIC0+IGl0ZW1zXG4gICAqXG4gICAqIFRoaXMgaXMgYXBwYXJlbnQgZnJvbSB0aGUgZGUtc3VnYXJlZCB0ZW1wbGF0ZTpcbiAgICogYGBgXG4gICAqICAgPG5nLXRlbXBsYXRlIG5nRm9yIGxldC1pdGVtIFtuZ0Zvck9mXT1cIml0ZW1zXCI+XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGVLZXkgbmFtZSBvZiBkaXJlY3RpdmUsIHdpdGhvdXQgdGhlICogcHJlZml4LiBGb3IgZXhhbXBsZTogbmdJZiwgbmdGb3JcbiAgICogQHBhcmFtIHRlbXBsYXRlVmFsdWUgUkhTIG9mIHRoZSBtaWNyb3N5bnRheCBhdHRyaWJ1dGVcbiAgICogQHBhcmFtIHRlbXBsYXRlVXJsIHRlbXBsYXRlIGZpbGVuYW1lIGlmIGl0J3MgZXh0ZXJuYWwsIGNvbXBvbmVudCBmaWxlbmFtZSBpZiBpdCdzIGlubGluZVxuICAgKiBAcGFyYW0gYWJzb2x1dGVLZXlPZmZzZXQgc3RhcnQgb2YgdGhlIGB0ZW1wbGF0ZUtleWBcbiAgICogQHBhcmFtIGFic29sdXRlVmFsdWVPZmZzZXQgc3RhcnQgb2YgdGhlIGB0ZW1wbGF0ZVZhbHVlYFxuICAgKi9cbiAgcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKFxuICAgICAgdGVtcGxhdGVLZXk6IHN0cmluZywgdGVtcGxhdGVWYWx1ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBhYnNvbHV0ZUtleU9mZnNldDogbnVtYmVyLFxuICAgICAgYWJzb2x1dGVWYWx1ZU9mZnNldDogbnVtYmVyKTogVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHRlbXBsYXRlVmFsdWUpO1xuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgIHRlbXBsYXRlVmFsdWUsIHRlbXBsYXRlVXJsLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0LCB0b2tlbnMsIHRlbXBsYXRlVmFsdWUubGVuZ3RoLFxuICAgICAgICBmYWxzZSAvKiBwYXJzZUFjdGlvbiAqLywgdGhpcy5lcnJvcnMsIDAgLyogcmVsYXRpdmUgb2Zmc2V0ICovKTtcbiAgICByZXR1cm4gcGFyc2VyLnBhcnNlVGVtcGxhdGVCaW5kaW5ncyh7XG4gICAgICBzb3VyY2U6IHRlbXBsYXRlS2V5LFxuICAgICAgc3BhbjogbmV3IEFic29sdXRlU291cmNlU3BhbihhYnNvbHV0ZUtleU9mZnNldCwgYWJzb2x1dGVLZXlPZmZzZXQgKyB0ZW1wbGF0ZUtleS5sZW5ndGgpLFxuICAgIH0pO1xuICB9XG5cbiAgcGFyc2VJbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZXxudWxsIHtcbiAgICBjb25zdCB7c3RyaW5ncywgZXhwcmVzc2lvbnMsIG9mZnNldHN9ID1cbiAgICAgICAgdGhpcy5zcGxpdEludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGV4cHJlc3Npb25Ob2RlczogQVNUW10gPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwcmVzc2lvbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGV4cHJlc3Npb25UZXh0ID0gZXhwcmVzc2lvbnNbaV0udGV4dDtcbiAgICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uVGV4dCk7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9ycywgb2Zmc2V0c1tpXSlcbiAgICAgICAgICAgICAgICAgICAgICAucGFyc2VDaGFpbigpO1xuICAgICAgZXhwcmVzc2lvbk5vZGVzLnB1c2goYXN0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jcmVhdGVJbnRlcnBvbGF0aW9uQXN0KFxuICAgICAgICBzdHJpbmdzLm1hcChzID0+IHMudGV4dCksIGV4cHJlc3Npb25Ob2RlcywgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG4gIH1cblxuICAvKipcbiAgICogU2ltaWxhciB0byBgcGFyc2VJbnRlcnBvbGF0aW9uYCwgYnV0IHRyZWF0cyB0aGUgcHJvdmlkZWQgc3RyaW5nIGFzIGEgc2luZ2xlIGV4cHJlc3Npb25cbiAgICogZWxlbWVudCB0aGF0IHdvdWxkIG5vcm1hbGx5IGFwcGVhciB3aXRoaW4gdGhlIGludGVycG9sYXRpb24gcHJlZml4IGFuZCBzdWZmaXggKGB7e2AgYW5kIGB9fWApLlxuICAgKiBUaGlzIGlzIHVzZWQgZm9yIHBhcnNpbmcgdGhlIHN3aXRjaCBleHByZXNzaW9uIGluIElDVXMuXG4gICAqL1xuICBwYXJzZUludGVycG9sYXRpb25FeHByZXNzaW9uKGV4cHJlc3Npb246IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6XG4gICAgICBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoZXhwcmVzc2lvbik7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUoc291cmNlVG9MZXgpO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb24sIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIC8qIHBhcnNlQWN0aW9uICovIGZhbHNlLCB0aGlzLmVycm9ycywgMClcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICBjb25zdCBzdHJpbmdzID0gWycnLCAnJ107ICAvLyBUaGUgcHJlZml4IGFuZCBzdWZmaXggc3RyaW5ncyBhcmUgYm90aCBlbXB0eVxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUludGVycG9sYXRpb25Bc3Qoc3RyaW5ncywgW2FzdF0sIGV4cHJlc3Npb24sIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUludGVycG9sYXRpb25Bc3QoXG4gICAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IEFTVFtdLCBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0Lmxlbmd0aCk7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbiA9XG4gICAgICAgIG5ldyBJbnRlcnBvbGF0aW9uKHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoaW50ZXJwb2xhdGlvbiwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNwbGl0cyBhIHN0cmluZyBvZiB0ZXh0IGludG8gXCJyYXdcIiB0ZXh0IHNlZ21lbnRzIGFuZCBleHByZXNzaW9ucyBwcmVzZW50IGluIGludGVycG9sYXRpb25zIGluXG4gICAqIHRoZSBzdHJpbmcuXG4gICAqIFJldHVybnMgYG51bGxgIGlmIHRoZXJlIGFyZSBubyBpbnRlcnBvbGF0aW9ucywgb3RoZXJ3aXNlIGFcbiAgICogYFNwbGl0SW50ZXJwb2xhdGlvbmAgd2l0aCBzcGxpdHMgdGhhdCBsb29rIGxpa2VcbiAgICogICA8cmF3IHRleHQ+IDxleHByZXNzaW9uPiA8cmF3IHRleHQ+IC4uLiA8cmF3IHRleHQ+IDxleHByZXNzaW9uPiA8cmF3IHRleHQ+XG4gICAqL1xuICBzcGxpdEludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBTcGxpdEludGVycG9sYXRpb24ge1xuICAgIGNvbnN0IHN0cmluZ3M6IEludGVycG9sYXRpb25QaWVjZVtdID0gW107XG4gICAgY29uc3QgZXhwcmVzc2lvbnM6IEludGVycG9sYXRpb25QaWVjZVtdID0gW107XG4gICAgY29uc3Qgb2Zmc2V0czogbnVtYmVyW10gPSBbXTtcbiAgICBsZXQgaSA9IDA7XG4gICAgbGV0IGF0SW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgIGxldCBleHRlbmRMYXN0U3RyaW5nID0gZmFsc2U7XG4gICAgbGV0IHtzdGFydDogaW50ZXJwU3RhcnQsIGVuZDogaW50ZXJwRW5kfSA9IGludGVycG9sYXRpb25Db25maWc7XG4gICAgd2hpbGUgKGkgPCBpbnB1dC5sZW5ndGgpIHtcbiAgICAgIGlmICghYXRJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIC8vIHBhcnNlIHVudGlsIHN0YXJ0aW5nIHt7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gaTtcbiAgICAgICAgaSA9IGlucHV0LmluZGV4T2YoaW50ZXJwU3RhcnQsIGkpO1xuICAgICAgICBpZiAoaSA9PT0gLTEpIHtcbiAgICAgICAgICBpID0gaW5wdXQubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRleHQgPSBpbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGkpO1xuICAgICAgICBzdHJpbmdzLnB1c2goe3RleHQsIHN0YXJ0LCBlbmQ6IGl9KTtcblxuICAgICAgICBhdEludGVycG9sYXRpb24gPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gcGFyc2UgZnJvbSBzdGFydGluZyB7eyB0byBlbmRpbmcgfX0gd2hpbGUgaWdub3JpbmcgY29udGVudCBpbnNpZGUgcXVvdGVzLlxuICAgICAgICBjb25zdCBmdWxsU3RhcnQgPSBpO1xuICAgICAgICBjb25zdCBleHByU3RhcnQgPSBmdWxsU3RhcnQgKyBpbnRlcnBTdGFydC5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGV4cHJFbmQgPSB0aGlzLl9nZXRJbnRlcnBvbGF0aW9uRW5kSW5kZXgoaW5wdXQsIGludGVycEVuZCwgZXhwclN0YXJ0KTtcbiAgICAgICAgaWYgKGV4cHJFbmQgPT09IC0xKSB7XG4gICAgICAgICAgLy8gQ291bGQgbm90IGZpbmQgdGhlIGVuZCBvZiB0aGUgaW50ZXJwb2xhdGlvbjsgZG8gbm90IHBhcnNlIGFuIGV4cHJlc3Npb24uXG4gICAgICAgICAgLy8gSW5zdGVhZCB3ZSBzaG91bGQgZXh0ZW5kIHRoZSBjb250ZW50IG9uIHRoZSBsYXN0IHJhdyBzdHJpbmcuXG4gICAgICAgICAgYXRJbnRlcnBvbGF0aW9uID0gZmFsc2U7XG4gICAgICAgICAgZXh0ZW5kTGFzdFN0cmluZyA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVsbEVuZCA9IGV4cHJFbmQgKyBpbnRlcnBFbmQubGVuZ3RoO1xuXG4gICAgICAgIGNvbnN0IHRleHQgPSBpbnB1dC5zdWJzdHJpbmcoZXhwclN0YXJ0LCBleHByRW5kKTtcbiAgICAgICAgaWYgKHRleHQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAnQmxhbmsgZXhwcmVzc2lvbnMgYXJlIG5vdCBhbGxvd2VkIGluIGludGVycG9sYXRlZCBzdHJpbmdzJywgaW5wdXQsXG4gICAgICAgICAgICAgIGBhdCBjb2x1bW4gJHtpfSBpbmAsIGxvY2F0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBleHByZXNzaW9ucy5wdXNoKHt0ZXh0LCBzdGFydDogZnVsbFN0YXJ0LCBlbmQ6IGZ1bGxFbmR9KTtcbiAgICAgICAgb2Zmc2V0cy5wdXNoKGV4cHJTdGFydCk7XG5cbiAgICAgICAgaSA9IGZ1bGxFbmQ7XG4gICAgICAgIGF0SW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgLy8gSWYgd2UgYXJlIG5vdyBhdCBhIHRleHQgc2VjdGlvbiwgYWRkIHRoZSByZW1haW5pbmcgY29udGVudCBhcyBhIHJhdyBzdHJpbmcuXG4gICAgICBpZiAoZXh0ZW5kTGFzdFN0cmluZykge1xuICAgICAgICBjb25zdCBwaWVjZSA9IHN0cmluZ3Nbc3RyaW5ncy5sZW5ndGggLSAxXTtcbiAgICAgICAgcGllY2UudGV4dCArPSBpbnB1dC5zdWJzdHJpbmcoaSk7XG4gICAgICAgIHBpZWNlLmVuZCA9IGlucHV0Lmxlbmd0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0cmluZ3MucHVzaCh7dGV4dDogaW5wdXQuc3Vic3RyaW5nKGkpLCBzdGFydDogaSwgZW5kOiBpbnB1dC5sZW5ndGh9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTcGxpdEludGVycG9sYXRpb24oc3RyaW5ncywgZXhwcmVzc2lvbnMsIG9mZnNldHMpO1xuICB9XG5cbiAgd3JhcExpdGVyYWxQcmltaXRpdmUoaW5wdXQ6IHN0cmluZ3xudWxsLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTpcbiAgICAgIEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0ID09IG51bGwgPyAwIDogaW5wdXQubGVuZ3RoKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoXG4gICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIGlucHV0KSwgaW5wdXQsIGxvY2F0aW9uLFxuICAgICAgICBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3RyaXBDb21tZW50cyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBpID0gdGhpcy5fY29tbWVudFN0YXJ0KGlucHV0KTtcbiAgICByZXR1cm4gaSAhPSBudWxsID8gaW5wdXQuc3Vic3RyaW5nKDAsIGkpLnRyaW0oKSA6IGlucHV0O1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tbWVudFN0YXJ0KGlucHV0OiBzdHJpbmcpOiBudW1iZXJ8bnVsbCB7XG4gICAgbGV0IG91dGVyUXVvdGU6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgY29uc3QgY2hhciA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG4gICAgICBjb25zdCBuZXh0Q2hhciA9IGlucHV0LmNoYXJDb2RlQXQoaSArIDEpO1xuXG4gICAgICBpZiAoY2hhciA9PT0gY2hhcnMuJFNMQVNIICYmIG5leHRDaGFyID09IGNoYXJzLiRTTEFTSCAmJiBvdXRlclF1b3RlID09IG51bGwpIHJldHVybiBpO1xuXG4gICAgICBpZiAob3V0ZXJRdW90ZSA9PT0gY2hhcikge1xuICAgICAgICBvdXRlclF1b3RlID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAob3V0ZXJRdW90ZSA9PSBudWxsICYmIGNoYXJzLmlzUXVvdGUoY2hhcikpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IGNoYXI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywge3N0YXJ0LCBlbmR9OiBJbnRlcnBvbGF0aW9uQ29uZmlnKTpcbiAgICAgIHZvaWQge1xuICAgIGxldCBzdGFydEluZGV4ID0gLTE7XG4gICAgbGV0IGVuZEluZGV4ID0gLTE7XG5cbiAgICBmb3IgKGNvbnN0IGNoYXJJbmRleCBvZiB0aGlzLl9mb3JFYWNoVW5xdW90ZWRDaGFyKGlucHV0LCAwKSkge1xuICAgICAgaWYgKHN0YXJ0SW5kZXggPT09IC0xKSB7XG4gICAgICAgIGlmIChpbnB1dC5zdGFydHNXaXRoKHN0YXJ0KSkge1xuICAgICAgICAgIHN0YXJ0SW5kZXggPSBjaGFySW5kZXg7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVuZEluZGV4ID0gdGhpcy5fZ2V0SW50ZXJwb2xhdGlvbkVuZEluZGV4KGlucHV0LCBlbmQsIGNoYXJJbmRleCk7XG4gICAgICAgIGlmIChlbmRJbmRleCA+IC0xKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3RhcnRJbmRleCA+IC0xICYmIGVuZEluZGV4ID4gLTEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtzdGFydH0ke2VuZH0pIHdoZXJlIGV4cHJlc3Npb24gd2FzIGV4cGVjdGVkYCwgaW5wdXQsXG4gICAgICAgICAgYGF0IGNvbHVtbiAke3N0YXJ0SW5kZXh9IGluYCwgbG9jYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgaW5kZXggb2YgdGhlIGVuZCBvZiBhbiBpbnRlcnBvbGF0aW9uIGV4cHJlc3Npb25cbiAgICogd2hpbGUgaWdub3JpbmcgY29tbWVudHMgYW5kIHF1b3RlZCBjb250ZW50LlxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0SW50ZXJwb2xhdGlvbkVuZEluZGV4KGlucHV0OiBzdHJpbmcsIGV4cHJlc3Npb25FbmQ6IHN0cmluZywgc3RhcnQ6IG51bWJlcik6IG51bWJlciB7XG4gICAgZm9yIChjb25zdCBjaGFySW5kZXggb2YgdGhpcy5fZm9yRWFjaFVucXVvdGVkQ2hhcihpbnB1dCwgc3RhcnQpKSB7XG4gICAgICBpZiAoaW5wdXQuc3RhcnRzV2l0aChleHByZXNzaW9uRW5kLCBjaGFySW5kZXgpKSB7XG4gICAgICAgIHJldHVybiBjaGFySW5kZXg7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGhpbmcgZWxzZSBpbiB0aGUgZXhwcmVzc2lvbiBtYXR0ZXJzIGFmdGVyIHdlJ3ZlXG4gICAgICAvLyBoaXQgYSBjb21tZW50IHNvIGxvb2sgZGlyZWN0bHkgZm9yIHRoZSBlbmQgdG9rZW4uXG4gICAgICBpZiAoaW5wdXQuc3RhcnRzV2l0aCgnLy8nLCBjaGFySW5kZXgpKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5pbmRleE9mKGV4cHJlc3Npb25FbmQsIGNoYXJJbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRvciB1c2VkIHRvIGl0ZXJhdGUgb3ZlciB0aGUgY2hhcmFjdGVyIGluZGV4ZXMgb2YgYSBzdHJpbmcgdGhhdCBhcmUgb3V0c2lkZSBvZiBxdW90ZXMuXG4gICAqIEBwYXJhbSBpbnB1dCBTdHJpbmcgdG8gbG9vcCB0aHJvdWdoLlxuICAgKiBAcGFyYW0gc3RhcnQgSW5kZXggd2l0aGluIHRoZSBzdHJpbmcgYXQgd2hpY2ggdG8gc3RhcnQuXG4gICAqL1xuICBwcml2YXRlICogX2ZvckVhY2hVbnF1b3RlZENoYXIoaW5wdXQ6IHN0cmluZywgc3RhcnQ6IG51bWJlcikge1xuICAgIGxldCBjdXJyZW50UXVvdGU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgZXNjYXBlQ291bnQgPSAwO1xuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjaGFyID0gaW5wdXRbaV07XG4gICAgICAvLyBTa2lwIHRoZSBjaGFyYWN0ZXJzIGluc2lkZSBxdW90ZXMuIE5vdGUgdGhhdCB3ZSBvbmx5IGNhcmUgYWJvdXQgdGhlIG91dGVyLW1vc3RcbiAgICAgIC8vIHF1b3RlcyBtYXRjaGluZyB1cCBhbmQgd2UgbmVlZCB0byBhY2NvdW50IGZvciBlc2NhcGUgY2hhcmFjdGVycy5cbiAgICAgIGlmIChjaGFycy5pc1F1b3RlKGlucHV0LmNoYXJDb2RlQXQoaSkpICYmIChjdXJyZW50UXVvdGUgPT09IG51bGwgfHwgY3VycmVudFF1b3RlID09PSBjaGFyKSAmJlxuICAgICAgICAgIGVzY2FwZUNvdW50ICUgMiA9PT0gMCkge1xuICAgICAgICBjdXJyZW50UXVvdGUgPSBjdXJyZW50UXVvdGUgPT09IG51bGwgPyBjaGFyIDogbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoY3VycmVudFF1b3RlID09PSBudWxsKSB7XG4gICAgICAgIHlpZWxkIGk7XG4gICAgICB9XG4gICAgICBlc2NhcGVDb3VudCA9IGNoYXIgPT09ICdcXFxcJyA/IGVzY2FwZUNvdW50ICsgMSA6IDA7XG4gICAgfVxuICB9XG59XG5cbi8qKiBEZXNjcmliZXMgYSBzdGF0ZWZ1bCBjb250ZXh0IGFuIGV4cHJlc3Npb24gcGFyc2VyIGlzIGluLiAqL1xuZW51bSBQYXJzZUNvbnRleHRGbGFncyB7XG4gIE5vbmUgPSAwLFxuICAvKipcbiAgICogQSBXcml0YWJsZSBjb250ZXh0IGlzIG9uZSBpbiB3aGljaCBhIHZhbHVlIG1heSBiZSB3cml0dGVuIHRvIGFuIGx2YWx1ZS5cbiAgICogRm9yIGV4YW1wbGUsIGFmdGVyIHdlIHNlZSBhIHByb3BlcnR5IGFjY2Vzcywgd2UgbWF5IGV4cGVjdCBhIHdyaXRlIHRvIHRoZVxuICAgKiBwcm9wZXJ0eSB2aWEgdGhlIFwiPVwiIG9wZXJhdG9yLlxuICAgKiAgIHByb3BcbiAgICogICAgICAgIF4gcG9zc2libGUgXCI9XCIgYWZ0ZXJcbiAgICovXG4gIFdyaXRhYmxlID0gMSxcbn1cblxuZXhwb3J0IGNsYXNzIF9QYXJzZUFTVCB7XG4gIHByaXZhdGUgcnBhcmVuc0V4cGVjdGVkID0gMDtcbiAgcHJpdmF0ZSByYnJhY2tldHNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNlc0V4cGVjdGVkID0gMDtcbiAgcHJpdmF0ZSBjb250ZXh0ID0gUGFyc2VDb250ZXh0RmxhZ3MuTm9uZTtcblxuICAvLyBDYWNoZSBvZiBleHByZXNzaW9uIHN0YXJ0IGFuZCBpbnB1dCBpbmRlY2VzIHRvIHRoZSBhYnNvbHV0ZSBzb3VyY2Ugc3BhbiB0aGV5IG1hcCB0bywgdXNlZCB0b1xuICAvLyBwcmV2ZW50IGNyZWF0aW5nIHN1cGVyZmx1b3VzIHNvdXJjZSBzcGFucyBpbiBgc291cmNlU3BhbmAuXG4gIC8vIEEgc2VyaWFsIG9mIHRoZSBleHByZXNzaW9uIHN0YXJ0IGFuZCBpbnB1dCBpbmRleCBpcyB1c2VkIGZvciBtYXBwaW5nIGJlY2F1c2UgYm90aCBhcmUgc3RhdGVmdWxcbiAgLy8gYW5kIG1heSBjaGFuZ2UgZm9yIHN1YnNlcXVlbnQgZXhwcmVzc2lvbnMgdmlzaXRlZCBieSB0aGUgcGFyc2VyLlxuICBwcml2YXRlIHNvdXJjZVNwYW5DYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBBYnNvbHV0ZVNvdXJjZVNwYW4+KCk7XG5cbiAgaW5kZXg6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaW5wdXQ6IHN0cmluZywgcHVibGljIGxvY2F0aW9uOiBzdHJpbmcsIHB1YmxpYyBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgcHVibGljIHRva2VuczogVG9rZW5bXSwgcHVibGljIGlucHV0TGVuZ3RoOiBudW1iZXIsIHB1YmxpYyBwYXJzZUFjdGlvbjogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgZXJyb3JzOiBQYXJzZXJFcnJvcltdLCBwcml2YXRlIG9mZnNldDogbnVtYmVyKSB7fVxuXG4gIHBlZWsob2Zmc2V0OiBudW1iZXIpOiBUb2tlbiB7XG4gICAgY29uc3QgaSA9IHRoaXMuaW5kZXggKyBvZmZzZXQ7XG4gICAgcmV0dXJuIGkgPCB0aGlzLnRva2Vucy5sZW5ndGggPyB0aGlzLnRva2Vuc1tpXSA6IEVPRjtcbiAgfVxuXG4gIGdldCBuZXh0KCk6IFRva2VuIHtcbiAgICByZXR1cm4gdGhpcy5wZWVrKDApO1xuICB9XG5cbiAgLyoqIFdoZXRoZXIgYWxsIHRoZSBwYXJzZXIgaW5wdXQgaGFzIGJlZW4gcHJvY2Vzc2VkLiAqL1xuICBnZXQgYXRFT0YoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZXggPj0gdGhpcy50b2tlbnMubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIEluZGV4IG9mIHRoZSBuZXh0IHRva2VuIHRvIGJlIHByb2Nlc3NlZCwgb3IgdGhlIGVuZCBvZiB0aGUgbGFzdCB0b2tlbiBpZiBhbGwgaGF2ZSBiZWVuXG4gICAqIHByb2Nlc3NlZC5cbiAgICovXG4gIGdldCBpbnB1dEluZGV4KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuYXRFT0YgPyB0aGlzLmN1cnJlbnRFbmRJbmRleCA6IHRoaXMubmV4dC5pbmRleCArIHRoaXMub2Zmc2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIEVuZCBpbmRleCBvZiB0aGUgbGFzdCBwcm9jZXNzZWQgdG9rZW4sIG9yIHRoZSBzdGFydCBvZiB0aGUgZmlyc3QgdG9rZW4gaWYgbm9uZSBoYXZlIGJlZW5cbiAgICogcHJvY2Vzc2VkLlxuICAgKi9cbiAgZ2V0IGN1cnJlbnRFbmRJbmRleCgpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLmluZGV4ID4gMCkge1xuICAgICAgY29uc3QgY3VyVG9rZW4gPSB0aGlzLnBlZWsoLTEpO1xuICAgICAgcmV0dXJuIGN1clRva2VuLmVuZCArIHRoaXMub2Zmc2V0O1xuICAgIH1cbiAgICAvLyBObyB0b2tlbnMgaGF2ZSBiZWVuIHByb2Nlc3NlZCB5ZXQ7IHJldHVybiB0aGUgbmV4dCB0b2tlbidzIHN0YXJ0IG9yIHRoZSBsZW5ndGggb2YgdGhlIGlucHV0XG4gICAgLy8gaWYgdGhlcmUgaXMgbm8gdG9rZW4uXG4gICAgaWYgKHRoaXMudG9rZW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuaW5wdXRMZW5ndGggKyB0aGlzLm9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pbmRleCArIHRoaXMub2Zmc2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGFic29sdXRlIG9mZnNldCBvZiB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgdG9rZW4uXG4gICAqL1xuICBnZXQgY3VycmVudEFic29sdXRlT2Zmc2V0KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuYWJzb2x1dGVPZmZzZXQgKyB0aGlzLmlucHV0SW5kZXg7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgYSBgUGFyc2VTcGFuYCBmcm9tIGBzdGFydGAgdG8gdGhlIGN1cnJlbnQgcG9zaXRpb24gKG9yIHRvIGBhcnRpZmljaWFsRW5kSW5kZXhgIGlmXG4gICAqIHByb3ZpZGVkKS5cbiAgICpcbiAgICogQHBhcmFtIHN0YXJ0IFBvc2l0aW9uIGZyb20gd2hpY2ggdGhlIGBQYXJzZVNwYW5gIHdpbGwgc3RhcnQuXG4gICAqIEBwYXJhbSBhcnRpZmljaWFsRW5kSW5kZXggT3B0aW9uYWwgZW5kaW5nIGluZGV4IHRvIGJlIHVzZWQgaWYgcHJvdmlkZWQgKGFuZCBpZiBncmVhdGVyIHRoYW4gdGhlXG4gICAqICAgICBuYXR1cmFsIGVuZGluZyBpbmRleClcbiAgICovXG4gIHNwYW4oc3RhcnQ6IG51bWJlciwgYXJ0aWZpY2lhbEVuZEluZGV4PzogbnVtYmVyKTogUGFyc2VTcGFuIHtcbiAgICBsZXQgZW5kSW5kZXggPSB0aGlzLmN1cnJlbnRFbmRJbmRleDtcbiAgICBpZiAoYXJ0aWZpY2lhbEVuZEluZGV4ICE9PSB1bmRlZmluZWQgJiYgYXJ0aWZpY2lhbEVuZEluZGV4ID4gdGhpcy5jdXJyZW50RW5kSW5kZXgpIHtcbiAgICAgIGVuZEluZGV4ID0gYXJ0aWZpY2lhbEVuZEluZGV4O1xuICAgIH1cblxuICAgIC8vIEluIHNvbWUgdW51c3VhbCBwYXJzaW5nIHNjZW5hcmlvcyAobGlrZSB3aGVuIGNlcnRhaW4gdG9rZW5zIGFyZSBtaXNzaW5nIGFuZCBhbiBgRW1wdHlFeHByYCBpc1xuICAgIC8vIGJlaW5nIGNyZWF0ZWQpLCB0aGUgY3VycmVudCB0b2tlbiBtYXkgYWxyZWFkeSBiZSBhZHZhbmNlZCBiZXlvbmQgdGhlIGBjdXJyZW50RW5kSW5kZXhgLiBUaGlzXG4gICAgLy8gYXBwZWFycyB0byBiZSBhIGRlZXAtc2VhdGVkIHBhcnNlciBidWcuXG4gICAgLy9cbiAgICAvLyBBcyBhIHdvcmthcm91bmQgZm9yIG5vdywgc3dhcCB0aGUgc3RhcnQgYW5kIGVuZCBpbmRpY2VzIHRvIGVuc3VyZSBhIHZhbGlkIGBQYXJzZVNwYW5gLlxuICAgIC8vIFRPRE8oYWx4aHViKTogZml4IHRoZSBidWcgdXBzdHJlYW0gaW4gdGhlIHBhcnNlciBzdGF0ZSwgYW5kIHJlbW92ZSB0aGlzIHdvcmthcm91bmQuXG4gICAgaWYgKHN0YXJ0ID4gZW5kSW5kZXgpIHtcbiAgICAgIGNvbnN0IHRtcCA9IGVuZEluZGV4O1xuICAgICAgZW5kSW5kZXggPSBzdGFydDtcbiAgICAgIHN0YXJ0ID0gdG1wO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUGFyc2VTcGFuKHN0YXJ0LCBlbmRJbmRleCk7XG4gIH1cblxuICBzb3VyY2VTcGFuKHN0YXJ0OiBudW1iZXIsIGFydGlmaWNpYWxFbmRJbmRleD86IG51bWJlcik6IEFic29sdXRlU291cmNlU3BhbiB7XG4gICAgY29uc3Qgc2VyaWFsID0gYCR7c3RhcnR9QCR7dGhpcy5pbnB1dEluZGV4fToke2FydGlmaWNpYWxFbmRJbmRleH1gO1xuICAgIGlmICghdGhpcy5zb3VyY2VTcGFuQ2FjaGUuaGFzKHNlcmlhbCkpIHtcbiAgICAgIHRoaXMuc291cmNlU3BhbkNhY2hlLnNldChcbiAgICAgICAgICBzZXJpYWwsIHRoaXMuc3BhbihzdGFydCwgYXJ0aWZpY2lhbEVuZEluZGV4KS50b0Fic29sdXRlKHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc291cmNlU3BhbkNhY2hlLmdldChzZXJpYWwpITtcbiAgfVxuXG4gIGFkdmFuY2UoKSB7XG4gICAgdGhpcy5pbmRleCsrO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIGEgY2FsbGJhY2sgaW4gdGhlIHByb3ZpZGVkIGNvbnRleHQuXG4gICAqL1xuICBwcml2YXRlIHdpdGhDb250ZXh0PFQ+KGNvbnRleHQ6IFBhcnNlQ29udGV4dEZsYWdzLCBjYjogKCkgPT4gVCk6IFQge1xuICAgIHRoaXMuY29udGV4dCB8PSBjb250ZXh0O1xuICAgIGNvbnN0IHJldCA9IGNiKCk7XG4gICAgdGhpcy5jb250ZXh0IF49IGNvbnRleHQ7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGNvbnN1bWVPcHRpb25hbENoYXJhY3Rlcihjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNvZGUpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcGVla0tleXdvcmRMZXQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pc0tleXdvcmRMZXQoKTtcbiAgfVxuICBwZWVrS2V5d29yZEFzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5leHQuaXNLZXl3b3JkQXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdW1lcyBhbiBleHBlY3RlZCBjaGFyYWN0ZXIsIG90aGVyd2lzZSBlbWl0cyBhbiBlcnJvciBhYm91dCB0aGUgbWlzc2luZyBleHBlY3RlZCBjaGFyYWN0ZXJcbiAgICogYW5kIHNraXBzIG92ZXIgdGhlIHRva2VuIHN0cmVhbSB1bnRpbCByZWFjaGluZyBhIHJlY292ZXJhYmxlIHBvaW50LlxuICAgKlxuICAgKiBTZWUgYHRoaXMuZXJyb3JgIGFuZCBgdGhpcy5za2lwYCBmb3IgbW9yZSBkZXRhaWxzLlxuICAgKi9cbiAgZXhwZWN0Q2hhcmFjdGVyKGNvZGU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3Rlcihjb2RlKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgJHtTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpfWApO1xuICB9XG5cbiAgY29uc3VtZU9wdGlvbmFsT3BlcmF0b3Iob3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5leHQuaXNPcGVyYXRvcihvcCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBleHBlY3RPcGVyYXRvcihvcGVyYXRvcjogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3Iob3BlcmF0b3IpKSByZXR1cm47XG4gICAgdGhpcy5lcnJvcihgTWlzc2luZyBleHBlY3RlZCBvcGVyYXRvciAke29wZXJhdG9yfWApO1xuICB9XG5cbiAgcHJldHR5UHJpbnRUb2tlbih0b2s6IFRva2VuKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdG9rID09PSBFT0YgPyAnZW5kIG9mIGlucHV0JyA6IGB0b2tlbiAke3Rva31gO1xuICB9XG5cbiAgZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpOiBzdHJpbmd8bnVsbCB7XG4gICAgY29uc3QgbiA9IHRoaXMubmV4dDtcbiAgICBpZiAoIW4uaXNJZGVudGlmaWVyKCkgJiYgIW4uaXNLZXl3b3JkKCkpIHtcbiAgICAgIGlmIChuLmlzUHJpdmF0ZUlkZW50aWZpZXIoKSkge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvckZvclByaXZhdGVJZGVudGlmaWVyKG4sICdleHBlY3RlZCBpZGVudGlmaWVyIG9yIGtleXdvcmQnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgJHt0aGlzLnByZXR0eVByaW50VG9rZW4obil9LCBleHBlY3RlZCBpZGVudGlmaWVyIG9yIGtleXdvcmRgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbi50b1N0cmluZygpIGFzIHN0cmluZztcbiAgfVxuXG4gIGV4cGVjdElkZW50aWZpZXJPcktleXdvcmRPclN0cmluZygpOiBzdHJpbmcge1xuICAgIGNvbnN0IG4gPSB0aGlzLm5leHQ7XG4gICAgaWYgKCFuLmlzSWRlbnRpZmllcigpICYmICFuLmlzS2V5d29yZCgpICYmICFuLmlzU3RyaW5nKCkpIHtcbiAgICAgIGlmIChuLmlzUHJpdmF0ZUlkZW50aWZpZXIoKSkge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvckZvclByaXZhdGVJZGVudGlmaWVyKG4sICdleHBlY3RlZCBpZGVudGlmaWVyLCBrZXl3b3JkIG9yIHN0cmluZycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5lcnJvcihcbiAgICAgICAgICAgIGBVbmV4cGVjdGVkICR7dGhpcy5wcmV0dHlQcmludFRva2VuKG4pfSwgZXhwZWN0ZWQgaWRlbnRpZmllciwga2V5d29yZCwgb3Igc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuLnRvU3RyaW5nKCkgYXMgc3RyaW5nO1xuICB9XG5cbiAgcGFyc2VDaGFpbigpOiBBU1Qge1xuICAgIGNvbnN0IGV4cHJzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHdoaWxlICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBleHByID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIGV4cHJzLnB1c2goZXhwcik7XG5cbiAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICBpZiAoIXRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5nIGV4cHJlc3Npb24gY2Fubm90IGNvbnRhaW4gY2hhaW5lZCBleHByZXNzaW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRTRU1JQ09MT04pKSB7XG4gICAgICAgIH0gIC8vIHJlYWQgYWxsIHNlbWljb2xvbnNcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICcke3RoaXMubmV4dH0nYCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChleHBycy5sZW5ndGggPT0gMCkge1xuICAgICAgLy8gV2UgaGF2ZSBubyBleHByZXNzaW9ucyBzbyBjcmVhdGUgYW4gZW1wdHkgZXhwcmVzc2lvbiB0aGF0IHNwYW5zIHRoZSBlbnRpcmUgaW5wdXQgbGVuZ3RoXG4gICAgICBjb25zdCBhcnRpZmljaWFsU3RhcnQgPSB0aGlzLm9mZnNldDtcbiAgICAgIGNvbnN0IGFydGlmaWNpYWxFbmQgPSB0aGlzLm9mZnNldCArIHRoaXMuaW5wdXRMZW5ndGg7XG4gICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcihcbiAgICAgICAgICB0aGlzLnNwYW4oYXJ0aWZpY2lhbFN0YXJ0LCBhcnRpZmljaWFsRW5kKSxcbiAgICAgICAgICB0aGlzLnNvdXJjZVNwYW4oYXJ0aWZpY2lhbFN0YXJ0LCBhcnRpZmljaWFsRW5kKSk7XG4gICAgfVxuICAgIGlmIChleHBycy5sZW5ndGggPT0gMSkgcmV0dXJuIGV4cHJzWzBdO1xuICAgIHJldHVybiBuZXcgQ2hhaW4odGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZXhwcnMpO1xuICB9XG5cbiAgcGFyc2VQaXBlKCk6IEFTVCB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSkge1xuICAgICAgaWYgKHRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgdGhpcy5lcnJvcignQ2Fubm90IGhhdmUgYSBwaXBlIGluIGFuIGFjdGlvbiBleHByZXNzaW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBsZXQgbmFtZUlkID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk7XG4gICAgICAgIGxldCBuYW1lU3BhbjogQWJzb2x1dGVTb3VyY2VTcGFuO1xuICAgICAgICBsZXQgZnVsbFNwYW5FbmQ6IG51bWJlcnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChuYW1lSWQgIT09IG51bGwpIHtcbiAgICAgICAgICBuYW1lU3BhbiA9IHRoaXMuc291cmNlU3BhbihuYW1lU3RhcnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vIHZhbGlkIGlkZW50aWZpZXIgd2FzIGZvdW5kLCBzbyB3ZSdsbCBhc3N1bWUgYW4gZW1wdHkgcGlwZSBuYW1lICgnJykuXG4gICAgICAgICAgbmFtZUlkID0gJyc7XG5cbiAgICAgICAgICAvLyBIb3dldmVyLCB0aGVyZSBtYXkgaGF2ZSBiZWVuIHdoaXRlc3BhY2UgcHJlc2VudCBiZXR3ZWVuIHRoZSBwaXBlIGNoYXJhY3RlciBhbmQgdGhlIG5leHRcbiAgICAgICAgICAvLyB0b2tlbiBpbiB0aGUgc2VxdWVuY2UgKG9yIHRoZSBlbmQgb2YgaW5wdXQpLiBXZSB3YW50IHRvIHRyYWNrIHRoaXMgd2hpdGVzcGFjZSBzbyB0aGF0XG4gICAgICAgICAgLy8gdGhlIGBCaW5kaW5nUGlwZWAgd2UgcHJvZHVjZSBjb3ZlcnMgbm90IGp1c3QgdGhlIHBpcGUgY2hhcmFjdGVyLCBidXQgYW55IHRyYWlsaW5nXG4gICAgICAgICAgLy8gd2hpdGVzcGFjZSBiZXlvbmQgaXQuIEFub3RoZXIgd2F5IG9mIHRoaW5raW5nIGFib3V0IHRoaXMgaXMgdGhhdCB0aGUgemVyby1sZW5ndGggbmFtZVxuICAgICAgICAgIC8vIGlzIGFzc3VtZWQgdG8gYmUgYXQgdGhlIGVuZCBvZiBhbnkgd2hpdGVzcGFjZSBiZXlvbmQgdGhlIHBpcGUgY2hhcmFjdGVyLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gVGhlcmVmb3JlLCB3ZSBwdXNoIHRoZSBlbmQgb2YgdGhlIGBQYXJzZVNwYW5gIGZvciB0aGlzIHBpcGUgYWxsIHRoZSB3YXkgdXAgdG8gdGhlXG4gICAgICAgICAgLy8gYmVnaW5uaW5nIG9mIHRoZSBuZXh0IHRva2VuLCBvciB1bnRpbCB0aGUgZW5kIG9mIGlucHV0IGlmIHRoZSBuZXh0IHRva2VuIGlzIEVPRi5cbiAgICAgICAgICBmdWxsU3BhbkVuZCA9IHRoaXMubmV4dC5pbmRleCAhPT0gLTEgPyB0aGlzLm5leHQuaW5kZXggOiB0aGlzLmlucHV0TGVuZ3RoICsgdGhpcy5vZmZzZXQ7XG5cbiAgICAgICAgICAvLyBUaGUgYG5hbWVTcGFuYCBmb3IgYW4gZW1wdHkgcGlwZSBuYW1lIGlzIHplcm8tbGVuZ3RoIGF0IHRoZSBlbmQgb2YgYW55IHdoaXRlc3BhY2VcbiAgICAgICAgICAvLyBiZXlvbmQgdGhlIHBpcGUgY2hhcmFjdGVyLlxuICAgICAgICAgIG5hbWVTcGFuID0gbmV3IFBhcnNlU3BhbihmdWxsU3BhbkVuZCwgZnVsbFNwYW5FbmQpLnRvQWJzb2x1dGUodGhpcy5hYnNvbHV0ZU9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcmdzOiBBU1RbXSA9IFtdO1xuICAgICAgICB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKSkge1xuICAgICAgICAgIGFyZ3MucHVzaCh0aGlzLnBhcnNlRXhwcmVzc2lvbigpKTtcblxuICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBhZGRpdGlvbmFsIGV4cHJlc3Npb25zIGJleW9uZCB0aGUgbmFtZSwgdGhlbiB0aGUgYXJ0aWZpY2lhbCBlbmQgZm9yIHRoZVxuICAgICAgICAgIC8vIG5hbWUgaXMgbm8gbG9uZ2VyIHJlbGV2YW50LlxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5kaW5nUGlwZShcbiAgICAgICAgICAgIHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCwgZnVsbFNwYW5FbmQpLCByZXN1bHQsIG5hbWVJZCwgYXJncywgbmFtZVNwYW4pO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignfCcpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uKCk6IEFTVCB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICB9XG5cbiAgcGFyc2VDb25kaXRpb25hbCgpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsT3IoKTtcblxuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc/JykpIHtcbiAgICAgIGNvbnN0IHllcyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBsZXQgbm86IEFTVDtcbiAgICAgIGlmICghdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKSkge1xuICAgICAgICBjb25zdCBlbmQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgZW5kKTtcbiAgICAgICAgdGhpcy5lcnJvcihgQ29uZGl0aW9uYWwgZXhwcmVzc2lvbiAke2V4cHJlc3Npb259IHJlcXVpcmVzIGFsbCAzIGV4cHJlc3Npb25zYCk7XG4gICAgICAgIG5vID0gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgQ29uZGl0aW9uYWwodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0LCB5ZXMsIG5vKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH1cblxuICBwYXJzZUxvZ2ljYWxPcigpOiBBU1Qge1xuICAgIC8vICd8fCdcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKTtcbiAgICB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignfHwnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlTG9naWNhbEFuZCgpO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnfHwnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTG9naWNhbEFuZCgpOiBBU1Qge1xuICAgIC8vICcmJidcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZU51bGxpc2hDb2FsZXNjaW5nKCk7XG4gICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJyYmJykpIHtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZU51bGxpc2hDb2FsZXNjaW5nKCk7XG4gICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksICcmJicsIHJlc3VsdCwgcmlnaHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VOdWxsaXNoQ29hbGVzY2luZygpOiBBU1Qge1xuICAgIC8vICc/PydcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG4gICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz8/JykpIHtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG4gICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksICc/PycsIHJlc3VsdCwgcmlnaHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VFcXVhbGl0eSgpOiBBU1Qge1xuICAgIC8vICc9PScsJyE9JywnPT09JywnIT09J1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUmVsYXRpb25hbCgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICc9PSc6XG4gICAgICAgIGNhc2UgJz09PSc6XG4gICAgICAgIGNhc2UgJyE9JzpcbiAgICAgICAgY2FzZSAnIT09JzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VSZWxhdGlvbmFsKCk7XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlUmVsYXRpb25hbCgpOiBBU1Qge1xuICAgIC8vICc8JywgJz4nLCAnPD0nLCAnPj0nXG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgY2FzZSAnPic6XG4gICAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgY2FzZSAnPj0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlQWRkaXRpdmUoKTogQVNUIHtcbiAgICAvLyAnKycsICctJ1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCByaWdodCA9IHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZU11bHRpcGxpY2F0aXZlKCk6IEFTVCB7XG4gICAgLy8gJyonLCAnJScsICcvJ1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJyonOlxuICAgICAgICBjYXNlICclJzpcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgbGV0IHJpZ2h0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZVByZWZpeCgpOiBBU1Qge1xuICAgIGlmICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBsZXQgcmVzdWx0OiBBU1Q7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJysnOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gVW5hcnkuY3JlYXRlUGx1cyh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgcmV0dXJuIFVuYXJ5LmNyZWF0ZU1pbnVzKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByZWZpeE5vdCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYXJzZUNhbGxDaGFpbigpO1xuICB9XG5cbiAgcGFyc2VDYWxsQ2hhaW4oKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByaW1hcnkoKTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRQRVJJT0QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VBY2Nlc3NNZW1iZXIocmVzdWx0LCBzdGFydCwgZmFsc2UpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc/LicpKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VDYWxsKHJlc3VsdCwgc3RhcnQsIHRydWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0tFVCkgP1xuICAgICAgICAgICAgICB0aGlzLnBhcnNlS2V5ZWRSZWFkT3JXcml0ZShyZXN1bHQsIHN0YXJ0LCB0cnVlKSA6XG4gICAgICAgICAgICAgIHRoaXMucGFyc2VBY2Nlc3NNZW1iZXIocmVzdWx0LCBzdGFydCwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlS2V5ZWRSZWFkT3JXcml0ZShyZXN1bHQsIHN0YXJ0LCBmYWxzZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VDYWxsKHJlc3VsdCwgc3RhcnQsIGZhbHNlKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignIScpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBOb25OdWxsQXNzZXJ0KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcGFyc2VQcmltYXJ5KCk6IEFTVCB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmROdWxsKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG51bGwpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkVW5kZWZpbmVkKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHZvaWQgMCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRUcnVlKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHRydWUpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkRmFsc2UoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZmFsc2UpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkVGhpcygpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgVGhpc1JlY2VpdmVyKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgZWxlbWVudHMgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbkxpc3QoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxBcnJheSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBlbGVtZW50cyk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3RlcihjaGFycy4kTEJSQUNFKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VMaXRlcmFsTWFwKCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0lkZW50aWZpZXIoKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VBY2Nlc3NNZW1iZXIoXG4gICAgICAgICAgbmV3IEltcGxpY2l0UmVjZWl2ZXIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSksIHN0YXJ0LCBmYWxzZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNOdW1iZXIoKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLm5leHQudG9OdW1iZXIoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzU3RyaW5nKCkpIHtcbiAgICAgIGNvbnN0IGxpdGVyYWxWYWx1ZSA9IHRoaXMubmV4dC50b1N0cmluZygpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbGl0ZXJhbFZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzUHJpdmF0ZUlkZW50aWZpZXIoKSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3JGb3JQcml2YXRlSWRlbnRpZmllcih0aGlzLm5leHQsIG51bGwpO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPj0gdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIGVuZCBvZiBleHByZXNzaW9uOiAke3RoaXMuaW5wdXR9YCk7XG4gICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAke3RoaXMubmV4dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbkxpc3QodGVybWluYXRvcjogbnVtYmVyKTogQVNUW10ge1xuICAgIGNvbnN0IHJlc3VsdDogQVNUW10gPSBbXTtcblxuICAgIGRvIHtcbiAgICAgIGlmICghdGhpcy5uZXh0LmlzQ2hhcmFjdGVyKHRlcm1pbmF0b3IpKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTGl0ZXJhbE1hcCgpOiBMaXRlcmFsTWFwIHtcbiAgICBjb25zdCBrZXlzOiBMaXRlcmFsTWFwS2V5W10gPSBbXTtcbiAgICBjb25zdCB2YWx1ZXM6IEFTVFtdID0gW107XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJExCUkFDRSk7XG4gICAgaWYgKCF0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkge1xuICAgICAgdGhpcy5yYnJhY2VzRXhwZWN0ZWQrKztcbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3Qga2V5U3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIGNvbnN0IHF1b3RlZCA9IHRoaXMubmV4dC5pc1N0cmluZygpO1xuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmRPclN0cmluZygpO1xuICAgICAgICBrZXlzLnB1c2goe2tleSwgcXVvdGVkfSk7XG5cbiAgICAgICAgLy8gUHJvcGVydGllcyB3aXRoIHF1b3RlZCBrZXlzIGNhbid0IHVzZSB0aGUgc2hvcnRoYW5kIHN5bnRheC5cbiAgICAgICAgaWYgKHF1b3RlZCkge1xuICAgICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7XG4gICAgICAgICAgdmFsdWVzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKSkge1xuICAgICAgICAgIHZhbHVlcy5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHNwYW4gPSB0aGlzLnNwYW4oa2V5U3RhcnQpO1xuICAgICAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4oa2V5U3RhcnQpO1xuICAgICAgICAgIHZhbHVlcy5wdXNoKG5ldyBQcm9wZXJ0eVJlYWQoXG4gICAgICAgICAgICAgIHNwYW4sIHNvdXJjZVNwYW4sIHNvdXJjZVNwYW4sIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHNwYW4sIHNvdXJjZVNwYW4pLCBrZXkpKTtcbiAgICAgICAgfVxuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgICB0aGlzLnJicmFjZXNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgTGl0ZXJhbE1hcCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBrZXlzLCB2YWx1ZXMpO1xuICB9XG5cbiAgcGFyc2VBY2Nlc3NNZW1iZXIocmVhZFJlY2VpdmVyOiBBU1QsIHN0YXJ0OiBudW1iZXIsIGlzU2FmZTogYm9vbGVhbik6IEFTVCB7XG4gICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGNvbnN0IGlkID0gdGhpcy53aXRoQ29udGV4dChQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSwgKCkgPT4ge1xuICAgICAgY29uc3QgaWQgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKSA/PyAnJztcbiAgICAgIGlmIChpZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhpcy5lcnJvcihgRXhwZWN0ZWQgaWRlbnRpZmllciBmb3IgcHJvcGVydHkgYWNjZXNzYCwgcmVhZFJlY2VpdmVyLnNwYW4uZW5kKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpZDtcbiAgICB9KTtcbiAgICBjb25zdCBuYW1lU3BhbiA9IHRoaXMuc291cmNlU3BhbihuYW1lU3RhcnQpO1xuICAgIGxldCByZWNlaXZlcjogQVNUO1xuXG4gICAgaWYgKGlzU2FmZSkge1xuICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICB0aGlzLmVycm9yKCdUaGUgXFwnPy5cXCcgb3BlcmF0b3IgY2Fubm90IGJlIHVzZWQgaW4gdGhlIGFzc2lnbm1lbnQnKTtcbiAgICAgICAgcmVjZWl2ZXIgPSBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVjZWl2ZXIgPSBuZXcgU2FmZVByb3BlcnR5UmVhZChcbiAgICAgICAgICAgIHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWFkUmVjZWl2ZXIsIGlkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICBpZiAoIXRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5ncyBjYW5ub3QgY29udGFpbiBhc3NpZ25tZW50cycpO1xuICAgICAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgcmVjZWl2ZXIgPSBuZXcgUHJvcGVydHlXcml0ZShcbiAgICAgICAgICAgIHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWFkUmVjZWl2ZXIsIGlkLCB2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWNlaXZlciA9XG4gICAgICAgICAgICBuZXcgUHJvcGVydHlSZWFkKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWFkUmVjZWl2ZXIsIGlkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVjZWl2ZXI7XG4gIH1cblxuICBwYXJzZUNhbGwocmVjZWl2ZXI6IEFTVCwgc3RhcnQ6IG51bWJlciwgaXNTYWZlOiBib29sZWFuKTogQVNUIHtcbiAgICBjb25zdCBhcmd1bWVudFN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgY29uc3QgYXJncyA9IHRoaXMucGFyc2VDYWxsQXJndW1lbnRzKCk7XG4gICAgY29uc3QgYXJndW1lbnRTcGFuID0gdGhpcy5zcGFuKGFyZ3VtZW50U3RhcnQsIHRoaXMuaW5wdXRJbmRleCkudG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KTtcbiAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgIGNvbnN0IHNwYW4gPSB0aGlzLnNwYW4oc3RhcnQpO1xuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpO1xuICAgIHJldHVybiBpc1NhZmUgPyBuZXcgU2FmZUNhbGwoc3Bhbiwgc291cmNlU3BhbiwgcmVjZWl2ZXIsIGFyZ3MsIGFyZ3VtZW50U3BhbikgOlxuICAgICAgICAgICAgICAgICAgICBuZXcgQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgYXJncywgYXJndW1lbnRTcGFuKTtcbiAgfVxuXG4gIHBhcnNlQ2FsbEFyZ3VtZW50cygpOiBCaW5kaW5nUGlwZVtdIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSByZXR1cm4gW107XG4gICAgY29uc3QgcG9zaXRpb25hbHM6IEFTVFtdID0gW107XG4gICAgZG8ge1xuICAgICAgcG9zaXRpb25hbHMucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcG9zaXRpb25hbHMgYXMgQmluZGluZ1BpcGVbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZXMgYW4gaWRlbnRpZmllciwgYSBrZXl3b3JkLCBhIHN0cmluZyB3aXRoIGFuIG9wdGlvbmFsIGAtYCBpbiBiZXR3ZWVuLFxuICAgKiBhbmQgcmV0dXJucyB0aGUgc3RyaW5nIGFsb25nIHdpdGggaXRzIGFic29sdXRlIHNvdXJjZSBzcGFuLlxuICAgKi9cbiAgZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIge1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBsZXQgb3BlcmF0b3JGb3VuZCA9IGZhbHNlO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgZG8ge1xuICAgICAgcmVzdWx0ICs9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICBvcGVyYXRvckZvdW5kID0gdGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignLScpO1xuICAgICAgaWYgKG9wZXJhdG9yRm91bmQpIHtcbiAgICAgICAgcmVzdWx0ICs9ICctJztcbiAgICAgIH1cbiAgICB9IHdoaWxlIChvcGVyYXRvckZvdW5kKTtcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlOiByZXN1bHQsXG4gICAgICBzcGFuOiBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKHN0YXJ0LCBzdGFydCArIHJlc3VsdC5sZW5ndGgpLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgbWljcm9zeW50YXggdGVtcGxhdGUgZXhwcmVzc2lvbiBhbmQgcmV0dXJuIGEgbGlzdCBvZiBiaW5kaW5ncyBvclxuICAgKiBwYXJzaW5nIGVycm9ycyBpbiBjYXNlIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGludmFsaWQuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICA8ZGl2ICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpOyB0cmFja0J5OiBmdW5jXCI+XG4gICAqIGBgYFxuICAgKiBjb250YWlucyBmaXZlIGJpbmRpbmdzOlxuICAgKiAxLiBuZ0ZvciAtPiBudWxsXG4gICAqIDIuIGl0ZW0gLT4gTmdGb3JPZkNvbnRleHQuJGltcGxpY2l0XG4gICAqIDMuIG5nRm9yT2YgLT4gaXRlbXNcbiAgICogNC4gaSAtPiBOZ0Zvck9mQ29udGV4dC5pbmRleFxuICAgKiA1LiBuZ0ZvclRyYWNrQnkgLT4gZnVuY1xuICAgKlxuICAgKiBGb3IgYSBmdWxsIGRlc2NyaXB0aW9uIG9mIHRoZSBtaWNyb3N5bnRheCBncmFtbWFyLCBzZWVcbiAgICogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vbWhldmVyeS9kMzUzMDI5NGNmZjJlNGExYjNmZTE1ZmY3NWQwODg1NVxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGVLZXkgbmFtZSBvZiB0aGUgbWljcm9zeW50YXggZGlyZWN0aXZlLCBsaWtlIG5nSWYsIG5nRm9yLFxuICAgKiB3aXRob3V0IHRoZSAqLCBhbG9uZyB3aXRoIGl0cyBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKHRlbXBsYXRlS2V5OiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyKTogVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IGJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSA9IFtdO1xuXG4gICAgLy8gVGhlIGZpcnN0IGJpbmRpbmcgaXMgZm9yIHRoZSB0ZW1wbGF0ZSBrZXkgaXRzZWxmXG4gICAgLy8gSW4gKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIiwga2V5ID0gXCJuZ0ZvclwiLCB2YWx1ZSA9IG51bGxcbiAgICAvLyBJbiAqbmdJZj1cImNvbmQgfCBwaXBlXCIsIGtleSA9IFwibmdJZlwiLCB2YWx1ZSA9IFwiY29uZCB8IHBpcGVcIlxuICAgIGJpbmRpbmdzLnB1c2goLi4udGhpcy5wYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyh0ZW1wbGF0ZUtleSkpO1xuXG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIC8vIElmIGl0IHN0YXJ0cyB3aXRoICdsZXQnLCB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZSBkZWNsYXJhdGlvblxuICAgICAgY29uc3QgbGV0QmluZGluZyA9IHRoaXMucGFyc2VMZXRCaW5kaW5nKCk7XG4gICAgICBpZiAobGV0QmluZGluZykge1xuICAgICAgICBiaW5kaW5ncy5wdXNoKGxldEJpbmRpbmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVHdvIHBvc3NpYmxlIGNhc2VzIGhlcmUsIGVpdGhlciBgdmFsdWUgXCJhc1wiIGtleWAgb3JcbiAgICAgICAgLy8gXCJkaXJlY3RpdmUta2V5d29yZCBleHByZXNzaW9uXCIuIFdlIGRvbid0IGtub3cgd2hpY2ggY2FzZSwgYnV0IGJvdGhcbiAgICAgICAgLy8gXCJ2YWx1ZVwiIGFuZCBcImRpcmVjdGl2ZS1rZXl3b3JkXCIgYXJlIHRlbXBsYXRlIGJpbmRpbmcga2V5LCBzbyBjb25zdW1lXG4gICAgICAgIC8vIHRoZSBrZXkgZmlyc3QuXG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgICAgIC8vIFBlZWsgYXQgdGhlIG5leHQgdG9rZW4sIGlmIGl0IGlzIFwiYXNcIiB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZVxuICAgICAgICAvLyBkZWNsYXJhdGlvbi5cbiAgICAgICAgY29uc3QgYmluZGluZyA9IHRoaXMucGFyc2VBc0JpbmRpbmcoa2V5KTtcbiAgICAgICAgaWYgKGJpbmRpbmcpIHtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSB0aGUga2V5IG11c3QgYmUgYSBkaXJlY3RpdmUga2V5d29yZCwgbGlrZSBcIm9mXCIuIFRyYW5zZm9ybVxuICAgICAgICAgIC8vIHRoZSBrZXkgdG8gYWN0dWFsIGtleS4gRWcuIG9mIC0+IG5nRm9yT2YsIHRyYWNrQnkgLT4gbmdGb3JUcmFja0J5XG4gICAgICAgICAga2V5LnNvdXJjZSA9XG4gICAgICAgICAgICAgIHRlbXBsYXRlS2V5LnNvdXJjZSArIGtleS5zb3VyY2UuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBrZXkuc291cmNlLnN1YnN0cmluZygxKTtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKC4uLnRoaXMucGFyc2VEaXJlY3RpdmVLZXl3b3JkQmluZGluZ3Moa2V5KSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0KGJpbmRpbmdzLCBbXSAvKiB3YXJuaW5ncyAqLywgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcGFyc2VLZXllZFJlYWRPcldyaXRlKHJlY2VpdmVyOiBBU1QsIHN0YXJ0OiBudW1iZXIsIGlzU2FmZTogYm9vbGVhbik6IEFTVCB7XG4gICAgcmV0dXJuIHRoaXMud2l0aENvbnRleHQoUGFyc2VDb250ZXh0RmxhZ3MuV3JpdGFibGUsICgpID0+IHtcbiAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IGtleSA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBpZiAoa2V5IGluc3RhbmNlb2YgRW1wdHlFeHByKSB7XG4gICAgICAgIHRoaXMuZXJyb3IoYEtleSBhY2Nlc3MgY2Fubm90IGJlIGVtcHR5YCk7XG4gICAgICB9XG4gICAgICB0aGlzLnJicmFja2V0c0V4cGVjdGVkLS07XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICBpZiAoaXNTYWZlKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignVGhlIFxcJz8uXFwnIG9wZXJhdG9yIGNhbm5vdCBiZSB1c2VkIGluIHRoZSBhc3NpZ25tZW50Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IEtleWVkV3JpdGUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVjZWl2ZXIsIGtleSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gaXNTYWZlID8gbmV3IFNhZmVLZXllZFJlYWQodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVjZWl2ZXIsIGtleSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IEtleWVkUmVhZCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZWNlaXZlciwga2V5KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgYSBkaXJlY3RpdmUga2V5d29yZCwgZm9sbG93ZWQgYnkgYSBtYW5kYXRvcnkgZXhwcmVzc2lvbi5cbiAgICogRm9yIGV4YW1wbGUsIFwib2YgaXRlbXNcIiwgXCJ0cmFja0J5OiBmdW5jXCIuXG4gICAqIFRoZSBiaW5kaW5ncyBhcmU6IG5nRm9yT2YgLT4gaXRlbXMsIG5nRm9yVHJhY2tCeSAtPiBmdW5jXG4gICAqIFRoZXJlIGNvdWxkIGJlIGFuIG9wdGlvbmFsIFwiYXNcIiBiaW5kaW5nIHRoYXQgZm9sbG93cyB0aGUgZXhwcmVzc2lvbi5cbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zIHwgc2xpY2U6MDoxIGFzIGNvbGxlY3Rpb25cIi5cbiAgICogICAgICAgICAgICAgICAgICAgIF5eIF5eXl5eXl5eXl5eXl5eXl5eIF5eXl5eXl5eXl5eXl5cbiAgICogICAgICAgICAgICAgICBrZXl3b3JkICAgIGJvdW5kIHRhcmdldCAgIG9wdGlvbmFsICdhcycgYmluZGluZ1xuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGtleSBiaW5kaW5nIGtleSwgZm9yIGV4YW1wbGUsIG5nRm9yLCBuZ0lmLCBuZ0Zvck9mLCBhbG9uZyB3aXRoIGl0c1xuICAgKiBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyhrZXk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmdbXSB7XG4gICAgY29uc3QgYmluZGluZ3M6IFRlbXBsYXRlQmluZGluZ1tdID0gW107XG4gICAgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKTsgIC8vIHRyYWNrQnk6IHRyYWNrQnlGdW5jdGlvblxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5nZXREaXJlY3RpdmVCb3VuZFRhcmdldCgpO1xuICAgIGxldCBzcGFuRW5kID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgLy8gVGhlIGJpbmRpbmcgY291bGQgb3B0aW9uYWxseSBiZSBmb2xsb3dlZCBieSBcImFzXCIuIEZvciBleGFtcGxlLFxuICAgIC8vICpuZ0lmPVwiY29uZCB8IHBpcGUgYXMgeFwiLiBJbiB0aGlzIGNhc2UsIHRoZSBrZXkgaW4gdGhlIFwiYXNcIiBiaW5kaW5nXG4gICAgLy8gaXMgXCJ4XCIgYW5kIHRoZSB2YWx1ZSBpcyB0aGUgdGVtcGxhdGUga2V5IGl0c2VsZiAoXCJuZ0lmXCIpLiBOb3RlIHRoYXQgdGhlXG4gICAgLy8gJ2tleScgaW4gdGhlIGN1cnJlbnQgY29udGV4dCBub3cgYmVjb21lcyB0aGUgXCJ2YWx1ZVwiIGluIHRoZSBuZXh0IGJpbmRpbmcuXG4gICAgY29uc3QgYXNCaW5kaW5nID0gdGhpcy5wYXJzZUFzQmluZGluZyhrZXkpO1xuICAgIGlmICghYXNCaW5kaW5nKSB7XG4gICAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgICBzcGFuRW5kID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKGtleS5zcGFuLnN0YXJ0LCBzcGFuRW5kKTtcbiAgICBiaW5kaW5ncy5wdXNoKG5ldyBFeHByZXNzaW9uQmluZGluZyhzb3VyY2VTcGFuLCBrZXksIHZhbHVlKSk7XG4gICAgaWYgKGFzQmluZGluZykge1xuICAgICAgYmluZGluZ3MucHVzaChhc0JpbmRpbmcpO1xuICAgIH1cbiAgICByZXR1cm4gYmluZGluZ3M7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBleHByZXNzaW9uIEFTVCBmb3IgdGhlIGJvdW5kIHRhcmdldCBvZiBhIGRpcmVjdGl2ZSBrZXl3b3JkXG4gICAqIGJpbmRpbmcuIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICAqbmdJZj1cImNvbmRpdGlvbiB8IHBpcGVcIlxuICAgKiAgICAgICAgICBeXl5eXl5eXl5eXl5eXl5eIGJvdW5kIHRhcmdldCBmb3IgXCJuZ0lmXCJcbiAgICogICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiXG4gICAqICAgICAgICAgICAgICAgICAgICAgICBeXl5eXiBib3VuZCB0YXJnZXQgZm9yIFwibmdGb3JPZlwiXG4gICAqIGBgYFxuICAgKi9cbiAgcHJpdmF0ZSBnZXREaXJlY3RpdmVCb3VuZFRhcmdldCgpOiBBU1RXaXRoU291cmNlfG51bGwge1xuICAgIGlmICh0aGlzLm5leHQgPT09IEVPRiB8fCB0aGlzLnBlZWtLZXl3b3JkQXMoKSB8fCB0aGlzLnBlZWtLZXl3b3JkTGV0KCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBhc3QgPSB0aGlzLnBhcnNlUGlwZSgpOyAgLy8gZXhhbXBsZTogXCJjb25kaXRpb24gfCBhc3luY1wiXG4gICAgY29uc3Qge3N0YXJ0LCBlbmR9ID0gYXN0LnNwYW47XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgZW5kKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCB2YWx1ZSwgdGhpcy5sb2NhdGlvbiwgdGhpcy5hYnNvbHV0ZU9mZnNldCArIHN0YXJ0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBiaW5kaW5nIGZvciBhIHZhcmlhYmxlIGRlY2xhcmVkIHVzaW5nIGBhc2AuIE5vdGUgdGhhdCB0aGUgb3JkZXJcbiAgICogb2YgdGhlIGtleS12YWx1ZSBwYWlyIGluIHRoaXMgZGVjbGFyYXRpb24gaXMgcmV2ZXJzZWQuIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtczsgaW5kZXggYXMgaVwiXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXl5eXl4gICAgXlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlICAgIGtleVxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHZhbHVlIG5hbWUgb2YgdGhlIHZhbHVlIGluIHRoZSBkZWNsYXJhdGlvbiwgXCJuZ0lmXCIgaW4gdGhlIGV4YW1wbGVcbiAgICogYWJvdmUsIGFsb25nIHdpdGggaXRzIGFic29sdXRlIHNwYW4uXG4gICAqL1xuICBwcml2YXRlIHBhcnNlQXNCaW5kaW5nKHZhbHVlOiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyKTogVGVtcGxhdGVCaW5kaW5nfG51bGwge1xuICAgIGlmICghdGhpcy5wZWVrS2V5d29yZEFzKCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIGNvbnN1bWUgdGhlICdhcycga2V5d29yZFxuICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgdGhpcy5jb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpO1xuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKHZhbHVlLnNwYW4uc3RhcnQsIHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0KTtcbiAgICByZXR1cm4gbmV3IFZhcmlhYmxlQmluZGluZyhzb3VyY2VTcGFuLCBrZXksIHZhbHVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGJpbmRpbmcgZm9yIGEgdmFyaWFibGUgZGVjbGFyZWQgdXNpbmcgYGxldGAuIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtczsgbGV0IGk9aW5kZXg7XCJcbiAgICogICAgICAgICAgIF5eXl5eXl5eICAgICAgICAgICBeXl5eXl5eXl5eXlxuICAgKiBgYGBcbiAgICogSW4gdGhlIGZpcnN0IGJpbmRpbmcsIGBpdGVtYCBpcyBib3VuZCB0byBgTmdGb3JPZkNvbnRleHQuJGltcGxpY2l0YC5cbiAgICogSW4gdGhlIHNlY29uZCBiaW5kaW5nLCBgaWAgaXMgYm91bmQgdG8gYE5nRm9yT2ZDb250ZXh0LmluZGV4YC5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VMZXRCaW5kaW5nKCk6IFRlbXBsYXRlQmluZGluZ3xudWxsIHtcbiAgICBpZiAoIXRoaXMucGVla0tleXdvcmRMZXQoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHNwYW5TdGFydCA9IHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0O1xuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gY29uc3VtZSB0aGUgJ2xldCcga2V5d29yZFxuICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgbGV0IHZhbHVlOiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyfG51bGwgPSBudWxsO1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICB9XG4gICAgdGhpcy5jb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpO1xuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKHNwYW5TdGFydCwgdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQpO1xuICAgIHJldHVybiBuZXcgVmFyaWFibGVCaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN1bWUgdGhlIG9wdGlvbmFsIHN0YXRlbWVudCB0ZXJtaW5hdG9yOiBzZW1pY29sb24gb3IgY29tbWEuXG4gICAqL1xuICBwcml2YXRlIGNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCkge1xuICAgIHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRTRU1JQ09MT04pIHx8IHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSk7XG4gIH1cblxuICAvKipcbiAgICogUmVjb3JkcyBhbiBlcnJvciBhbmQgc2tpcHMgb3ZlciB0aGUgdG9rZW4gc3RyZWFtIHVudGlsIHJlYWNoaW5nIGEgcmVjb3ZlcmFibGUgcG9pbnQuIFNlZVxuICAgKiBgdGhpcy5za2lwYCBmb3IgbW9yZSBkZXRhaWxzIG9uIHRva2VuIHNraXBwaW5nLlxuICAgKi9cbiAgZXJyb3IobWVzc2FnZTogc3RyaW5nLCBpbmRleDogbnVtYmVyfG51bGwgPSBudWxsKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VyRXJyb3IobWVzc2FnZSwgdGhpcy5pbnB1dCwgdGhpcy5sb2NhdGlvblRleHQoaW5kZXgpLCB0aGlzLmxvY2F0aW9uKSk7XG4gICAgdGhpcy5za2lwKCk7XG4gIH1cblxuICBwcml2YXRlIGxvY2F0aW9uVGV4dChpbmRleDogbnVtYmVyfG51bGwgPSBudWxsKSB7XG4gICAgaWYgKGluZGV4ID09IG51bGwpIGluZGV4ID0gdGhpcy5pbmRleDtcbiAgICByZXR1cm4gKGluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSA/IGBhdCBjb2x1bW4gJHt0aGlzLnRva2Vuc1tpbmRleF0uaW5kZXggKyAxfSBpbmAgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYGF0IHRoZSBlbmQgb2YgdGhlIGV4cHJlc3Npb25gO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlY29yZHMgYW4gZXJyb3IgZm9yIGFuIHVuZXhwZWN0ZWQgcHJpdmF0ZSBpZGVudGlmaWVyIGJlaW5nIGRpc2NvdmVyZWQuXG4gICAqIEBwYXJhbSB0b2tlbiBUb2tlbiByZXByZXNlbnRpbmcgYSBwcml2YXRlIGlkZW50aWZpZXIuXG4gICAqIEBwYXJhbSBleHRyYU1lc3NhZ2UgT3B0aW9uYWwgYWRkaXRpb25hbCBtZXNzYWdlIGJlaW5nIGFwcGVuZGVkIHRvIHRoZSBlcnJvci5cbiAgICovXG4gIHByaXZhdGUgX3JlcG9ydEVycm9yRm9yUHJpdmF0ZUlkZW50aWZpZXIodG9rZW46IFRva2VuLCBleHRyYU1lc3NhZ2U6IHN0cmluZ3xudWxsKSB7XG4gICAgbGV0IGVycm9yTWVzc2FnZSA9XG4gICAgICAgIGBQcml2YXRlIGlkZW50aWZpZXJzIGFyZSBub3Qgc3VwcG9ydGVkLiBVbmV4cGVjdGVkIHByaXZhdGUgaWRlbnRpZmllcjogJHt0b2tlbn1gO1xuICAgIGlmIChleHRyYU1lc3NhZ2UgIT09IG51bGwpIHtcbiAgICAgIGVycm9yTWVzc2FnZSArPSBgLCAke2V4dHJhTWVzc2FnZX1gO1xuICAgIH1cbiAgICB0aGlzLmVycm9yKGVycm9yTWVzc2FnZSk7XG4gIH1cblxuICAvKipcbiAgICogRXJyb3IgcmVjb3Zlcnkgc2hvdWxkIHNraXAgdG9rZW5zIHVudGlsIGl0IGVuY291bnRlcnMgYSByZWNvdmVyeSBwb2ludC5cbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgdHJlYXRlZCBhcyB1bmNvbmRpdGlvbmFsIHJlY292ZXJ5IHBvaW50czpcbiAgICogICAtIGVuZCBvZiBpbnB1dFxuICAgKiAgIC0gJzsnIChwYXJzZUNoYWluKCkgaXMgYWx3YXlzIHRoZSByb290IHByb2R1Y3Rpb24sIGFuZCBpdCBleHBlY3RzIGEgJzsnKVxuICAgKiAgIC0gJ3wnIChzaW5jZSBwaXBlcyBtYXkgYmUgY2hhaW5lZCBhbmQgZWFjaCBwaXBlIGV4cHJlc3Npb24gbWF5IGJlIHRyZWF0ZWQgaW5kZXBlbmRlbnRseSlcbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgY29uZGl0aW9uYWwgcmVjb3ZlcnkgcG9pbnRzOlxuICAgKiAgIC0gJyknLCAnfScsICddJyBpZiBvbmUgb2YgY2FsbGluZyBwcm9kdWN0aW9ucyBpcyBleHBlY3Rpbmcgb25lIG9mIHRoZXNlIHN5bWJvbHNcbiAgICogICAgIC0gVGhpcyBhbGxvd3Mgc2tpcCgpIHRvIHJlY292ZXIgZnJvbSBlcnJvcnMgc3VjaCBhcyAnKGEuKSArIDEnIGFsbG93aW5nIG1vcmUgb2YgdGhlIEFTVCB0b1xuICAgKiAgICAgICBiZSByZXRhaW5lZCAoaXQgZG9lc24ndCBza2lwIGFueSB0b2tlbnMgYXMgdGhlICcpJyBpcyByZXRhaW5lZCBiZWNhdXNlIG9mIHRoZSAnKCcgYmVnaW5zXG4gICAqICAgICAgIGFuICcoJyA8ZXhwcj4gJyknIHByb2R1Y3Rpb24pLlxuICAgKiAgICAgICBUaGUgcmVjb3ZlcnkgcG9pbnRzIG9mIGdyb3VwaW5nIHN5bWJvbHMgbXVzdCBiZSBjb25kaXRpb25hbCBhcyB0aGV5IG11c3QgYmUgc2tpcHBlZCBpZlxuICAgKiAgICAgICBub25lIG9mIHRoZSBjYWxsaW5nIHByb2R1Y3Rpb25zIGFyZSBub3QgZXhwZWN0aW5nIHRoZSBjbG9zaW5nIHRva2VuIGVsc2Ugd2Ugd2lsbCBuZXZlclxuICAgKiAgICAgICBtYWtlIHByb2dyZXNzIGluIHRoZSBjYXNlIG9mIGFuIGV4dHJhbmVvdXMgZ3JvdXAgY2xvc2luZyBzeW1ib2wgKHN1Y2ggYXMgYSBzdHJheSAnKScpLlxuICAgKiAgICAgICBUaGF0IGlzLCB3ZSBza2lwIGEgY2xvc2luZyBzeW1ib2wgaWYgd2UgYXJlIG5vdCBpbiBhIGdyb3VwaW5nIHByb2R1Y3Rpb24uXG4gICAqICAgLSAnPScgaW4gYSBgV3JpdGFibGVgIGNvbnRleHRcbiAgICogICAgIC0gSW4gdGhpcyBjb250ZXh0LCB3ZSBhcmUgYWJsZSB0byByZWNvdmVyIGFmdGVyIHNlZWluZyB0aGUgYD1gIG9wZXJhdG9yLCB3aGljaFxuICAgKiAgICAgICBzaWduYWxzIHRoZSBwcmVzZW5jZSBvZiBhbiBpbmRlcGVuZGVudCBydmFsdWUgZXhwcmVzc2lvbiBmb2xsb3dpbmcgdGhlIGA9YCBvcGVyYXRvci5cbiAgICpcbiAgICogSWYgYSBwcm9kdWN0aW9uIGV4cGVjdHMgb25lIG9mIHRoZXNlIHRva2VuIGl0IGluY3JlbWVudHMgdGhlIGNvcnJlc3BvbmRpbmcgbmVzdGluZyBjb3VudCxcbiAgICogYW5kIHRoZW4gZGVjcmVtZW50cyBpdCBqdXN0IHByaW9yIHRvIGNoZWNraW5nIGlmIHRoZSB0b2tlbiBpcyBpbiB0aGUgaW5wdXQuXG4gICAqL1xuICBwcml2YXRlIHNraXAoKSB7XG4gICAgbGV0IG4gPSB0aGlzLm5leHQ7XG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggJiYgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgJiZcbiAgICAgICAgICAgIW4uaXNPcGVyYXRvcignfCcpICYmICh0aGlzLnJwYXJlbnNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2VzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkgJiZcbiAgICAgICAgICAgKHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpKSAmJlxuICAgICAgICAgICAoISh0aGlzLmNvbnRleHQgJiBQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSkgfHwgIW4uaXNPcGVyYXRvcignPScpKSkge1xuICAgICAgaWYgKHRoaXMubmV4dC5pc0Vycm9yKCkpIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZXJFcnJvcih0aGlzLm5leHQudG9TdHJpbmcoKSEsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KCksIHRoaXMubG9jYXRpb24pKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbiA9IHRoaXMubmV4dDtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIG92ZXJyaWRlIHZpc2l0UGlwZSgpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKCdwaXBlcycpO1xuICB9XG59XG4iXX0=