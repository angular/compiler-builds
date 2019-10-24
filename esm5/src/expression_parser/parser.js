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
import { ASTWithSource, Binary, BindingPipe, Chain, Conditional, EmptyExpr, FunctionCall, ImplicitReceiver, Interpolation, KeyedRead, KeyedWrite, LiteralArray, LiteralMap, LiteralPrimitive, MethodCall, NonNullAssert, ParseSpan, ParserError, PrefixNot, PropertyRead, PropertyWrite, Quote, SafeMethodCall, SafePropertyRead, TemplateBinding } from './ast';
import { EOF, TokenType, isIdentifier, isQuote } from './lexer';
var SplitInterpolation = /** @class */ (function () {
    function SplitInterpolation(strings, expressions, offsets) {
        this.strings = strings;
        this.expressions = expressions;
        this.offsets = offsets;
    }
    return SplitInterpolation;
}());
export { SplitInterpolation };
var TemplateBindingParseResult = /** @class */ (function () {
    function TemplateBindingParseResult(templateBindings, warnings, errors) {
        this.templateBindings = templateBindings;
        this.warnings = warnings;
        this.errors = errors;
    }
    return TemplateBindingParseResult;
}());
export { TemplateBindingParseResult };
function _createInterpolateRegExp(config) {
    var pattern = escapeRegExp(config.start) + '([\\s\\S]*?)' + escapeRegExp(config.end);
    return new RegExp(pattern, 'g');
}
var Parser = /** @class */ (function () {
    function Parser(_lexer) {
        this._lexer = _lexer;
        this.errors = [];
    }
    Parser.prototype.parseAction = function (input, location, absoluteOffset, interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        this._checkNoInterpolation(input, location, interpolationConfig);
        var sourceToLex = this._stripComments(input);
        var tokens = this._lexer.tokenize(this._stripComments(input));
        var ast = new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, true, this.errors, input.length - sourceToLex.length)
            .parseChain();
        return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
    };
    Parser.prototype.parseBinding = function (input, location, absoluteOffset, interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        var ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
        return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
    };
    Parser.prototype.parseSimpleBinding = function (input, location, absoluteOffset, interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        var ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
        var errors = SimpleExpressionChecker.check(ast);
        if (errors.length > 0) {
            this._reportError("Host binding expression cannot contain " + errors.join(' '), input, location);
        }
        return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
    };
    Parser.prototype._reportError = function (message, input, errLocation, ctxLocation) {
        this.errors.push(new ParserError(message, input, errLocation, ctxLocation));
    };
    Parser.prototype._parseBindingAst = function (input, location, absoluteOffset, interpolationConfig) {
        // Quotes expressions use 3rd-party expression language. We don't want to use
        // our lexer or parser for that, so we check for that ahead of time.
        var quote = this._parseQuote(input, location, absoluteOffset);
        if (quote != null) {
            return quote;
        }
        this._checkNoInterpolation(input, location, interpolationConfig);
        var sourceToLex = this._stripComments(input);
        var tokens = this._lexer.tokenize(sourceToLex);
        return new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, false, this.errors, input.length - sourceToLex.length)
            .parseChain();
    };
    Parser.prototype._parseQuote = function (input, location, absoluteOffset) {
        if (input == null)
            return null;
        var prefixSeparatorIndex = input.indexOf(':');
        if (prefixSeparatorIndex == -1)
            return null;
        var prefix = input.substring(0, prefixSeparatorIndex).trim();
        if (!isIdentifier(prefix))
            return null;
        var uninterpretedExpression = input.substring(prefixSeparatorIndex + 1);
        var span = new ParseSpan(0, input.length);
        return new Quote(span, span.toAbsolute(absoluteOffset), prefix, uninterpretedExpression, location);
    };
    Parser.prototype.parseTemplateBindings = function (tplKey, tplValue, location, absoluteOffset) {
        var tokens = this._lexer.tokenize(tplValue);
        return new _ParseAST(tplValue, location, absoluteOffset, tokens, tplValue.length, false, this.errors, 0)
            .parseTemplateBindings(tplKey);
    };
    Parser.prototype.parseInterpolation = function (input, location, absoluteOffset, interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        var split = this.splitInterpolation(input, location, interpolationConfig);
        if (split == null)
            return null;
        var expressions = [];
        for (var i = 0; i < split.expressions.length; ++i) {
            var expressionText = split.expressions[i];
            var sourceToLex = this._stripComments(expressionText);
            var tokens = this._lexer.tokenize(sourceToLex);
            var ast = new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, false, this.errors, split.offsets[i] + (expressionText.length - sourceToLex.length))
                .parseChain();
            expressions.push(ast);
        }
        var span = new ParseSpan(0, input == null ? 0 : input.length);
        return new ASTWithSource(new Interpolation(span, span.toAbsolute(absoluteOffset), split.strings, expressions), input, location, absoluteOffset, this.errors);
    };
    Parser.prototype.splitInterpolation = function (input, location, interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
        var regexp = _createInterpolateRegExp(interpolationConfig);
        var parts = input.split(regexp);
        if (parts.length <= 1) {
            return null;
        }
        var strings = [];
        var expressions = [];
        var offsets = [];
        var offset = 0;
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
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
                this._reportError('Blank expressions are not allowed in interpolated strings', input, "at column " + this._findInterpolationErrorColumn(parts, i, interpolationConfig) + " in", location);
                expressions.push('$implict');
                offsets.push(offset);
            }
        }
        return new SplitInterpolation(strings, expressions, offsets);
    };
    Parser.prototype.wrapLiteralPrimitive = function (input, location, absoluteOffset) {
        var span = new ParseSpan(0, input == null ? 0 : input.length);
        return new ASTWithSource(new LiteralPrimitive(span, span.toAbsolute(absoluteOffset), input), input, location, absoluteOffset, this.errors);
    };
    Parser.prototype._stripComments = function (input) {
        var i = this._commentStart(input);
        return i != null ? input.substring(0, i).trim() : input;
    };
    Parser.prototype._commentStart = function (input) {
        var outerQuote = null;
        for (var i = 0; i < input.length - 1; i++) {
            var char = input.charCodeAt(i);
            var nextChar = input.charCodeAt(i + 1);
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
    };
    Parser.prototype._checkNoInterpolation = function (input, location, interpolationConfig) {
        var regexp = _createInterpolateRegExp(interpolationConfig);
        var parts = input.split(regexp);
        if (parts.length > 1) {
            this._reportError("Got interpolation (" + interpolationConfig.start + interpolationConfig.end + ") where expression was expected", input, "at column " + this._findInterpolationErrorColumn(parts, 1, interpolationConfig) + " in", location);
        }
    };
    Parser.prototype._findInterpolationErrorColumn = function (parts, partInErrIdx, interpolationConfig) {
        var errLocation = '';
        for (var j = 0; j < partInErrIdx; j++) {
            errLocation += j % 2 === 0 ?
                parts[j] :
                "" + interpolationConfig.start + parts[j] + interpolationConfig.end;
        }
        return errLocation.length;
    };
    return Parser;
}());
export { Parser };
var _ParseAST = /** @class */ (function () {
    function _ParseAST(input, location, absoluteOffset, tokens, inputLength, parseAction, errors, offset) {
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
    _ParseAST.prototype.peek = function (offset) {
        var i = this.index + offset;
        return i < this.tokens.length ? this.tokens[i] : EOF;
    };
    Object.defineProperty(_ParseAST.prototype, "next", {
        get: function () { return this.peek(0); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(_ParseAST.prototype, "inputIndex", {
        get: function () {
            return (this.index < this.tokens.length) ? this.next.index + this.offset :
                this.inputLength + this.offset;
        },
        enumerable: true,
        configurable: true
    });
    _ParseAST.prototype.span = function (start) { return new ParseSpan(start, this.inputIndex); };
    _ParseAST.prototype.sourceSpan = function (start) {
        var serial = start + "@" + this.inputIndex;
        if (!this.sourceSpanCache.has(serial)) {
            this.sourceSpanCache.set(serial, this.span(start).toAbsolute(this.absoluteOffset));
        }
        return this.sourceSpanCache.get(serial);
    };
    _ParseAST.prototype.advance = function () { this.index++; };
    _ParseAST.prototype.optionalCharacter = function (code) {
        if (this.next.isCharacter(code)) {
            this.advance();
            return true;
        }
        else {
            return false;
        }
    };
    _ParseAST.prototype.peekKeywordLet = function () { return this.next.isKeywordLet(); };
    _ParseAST.prototype.peekKeywordAs = function () { return this.next.isKeywordAs(); };
    _ParseAST.prototype.expectCharacter = function (code) {
        if (this.optionalCharacter(code))
            return;
        this.error("Missing expected " + String.fromCharCode(code));
    };
    _ParseAST.prototype.optionalOperator = function (op) {
        if (this.next.isOperator(op)) {
            this.advance();
            return true;
        }
        else {
            return false;
        }
    };
    _ParseAST.prototype.expectOperator = function (operator) {
        if (this.optionalOperator(operator))
            return;
        this.error("Missing expected operator " + operator);
    };
    _ParseAST.prototype.expectIdentifierOrKeyword = function () {
        var n = this.next;
        if (!n.isIdentifier() && !n.isKeyword()) {
            this.error("Unexpected token " + n + ", expected identifier or keyword");
            return '';
        }
        this.advance();
        return n.toString();
    };
    _ParseAST.prototype.expectIdentifierOrKeywordOrString = function () {
        var n = this.next;
        if (!n.isIdentifier() && !n.isKeyword() && !n.isString()) {
            this.error("Unexpected token " + n + ", expected identifier, keyword, or string");
            return '';
        }
        this.advance();
        return n.toString();
    };
    _ParseAST.prototype.parseChain = function () {
        var exprs = [];
        var start = this.inputIndex;
        while (this.index < this.tokens.length) {
            var expr = this.parsePipe();
            exprs.push(expr);
            if (this.optionalCharacter(chars.$SEMICOLON)) {
                if (!this.parseAction) {
                    this.error('Binding expression cannot contain chained expression');
                }
                while (this.optionalCharacter(chars.$SEMICOLON)) {
                } // read all semicolons
            }
            else if (this.index < this.tokens.length) {
                this.error("Unexpected token '" + this.next + "'");
            }
        }
        if (exprs.length == 0)
            return new EmptyExpr(this.span(start), this.sourceSpan(start));
        if (exprs.length == 1)
            return exprs[0];
        return new Chain(this.span(start), this.sourceSpan(start), exprs);
    };
    _ParseAST.prototype.parsePipe = function () {
        var result = this.parseExpression();
        if (this.optionalOperator('|')) {
            if (this.parseAction) {
                this.error('Cannot have a pipe in an action expression');
            }
            do {
                var name_1 = this.expectIdentifierOrKeyword();
                var args = [];
                while (this.optionalCharacter(chars.$COLON)) {
                    args.push(this.parseExpression());
                }
                var start = result.span.start;
                result = new BindingPipe(this.span(start), this.sourceSpan(start), result, name_1, args);
            } while (this.optionalOperator('|'));
        }
        return result;
    };
    _ParseAST.prototype.parseExpression = function () { return this.parseConditional(); };
    _ParseAST.prototype.parseConditional = function () {
        var start = this.inputIndex;
        var result = this.parseLogicalOr();
        if (this.optionalOperator('?')) {
            var yes = this.parsePipe();
            var no = void 0;
            if (!this.optionalCharacter(chars.$COLON)) {
                var end = this.inputIndex;
                var expression = this.input.substring(start, end);
                this.error("Conditional expression " + expression + " requires all 3 expressions");
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
    };
    _ParseAST.prototype.parseLogicalOr = function () {
        // '||'
        var result = this.parseLogicalAnd();
        while (this.optionalOperator('||')) {
            var right = this.parseLogicalAnd();
            var start = result.span.start;
            result = new Binary(this.span(start), this.sourceSpan(start), '||', result, right);
        }
        return result;
    };
    _ParseAST.prototype.parseLogicalAnd = function () {
        // '&&'
        var result = this.parseEquality();
        while (this.optionalOperator('&&')) {
            var right = this.parseEquality();
            var start = result.span.start;
            result = new Binary(this.span(start), this.sourceSpan(start), '&&', result, right);
        }
        return result;
    };
    _ParseAST.prototype.parseEquality = function () {
        // '==','!=','===','!=='
        var result = this.parseRelational();
        while (this.next.type == TokenType.Operator) {
            var operator = this.next.strValue;
            switch (operator) {
                case '==':
                case '===':
                case '!=':
                case '!==':
                    this.advance();
                    var right = this.parseRelational();
                    var start = result.span.start;
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    };
    _ParseAST.prototype.parseRelational = function () {
        // '<', '>', '<=', '>='
        var result = this.parseAdditive();
        while (this.next.type == TokenType.Operator) {
            var operator = this.next.strValue;
            switch (operator) {
                case '<':
                case '>':
                case '<=':
                case '>=':
                    this.advance();
                    var right = this.parseAdditive();
                    var start = result.span.start;
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    };
    _ParseAST.prototype.parseAdditive = function () {
        // '+', '-'
        var result = this.parseMultiplicative();
        while (this.next.type == TokenType.Operator) {
            var operator = this.next.strValue;
            switch (operator) {
                case '+':
                case '-':
                    this.advance();
                    var right = this.parseMultiplicative();
                    var start = result.span.start;
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    };
    _ParseAST.prototype.parseMultiplicative = function () {
        // '*', '%', '/'
        var result = this.parsePrefix();
        while (this.next.type == TokenType.Operator) {
            var operator = this.next.strValue;
            switch (operator) {
                case '*':
                case '%':
                case '/':
                    this.advance();
                    var right = this.parsePrefix();
                    var start = result.span.start;
                    result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                    continue;
            }
            break;
        }
        return result;
    };
    _ParseAST.prototype.parsePrefix = function () {
        if (this.next.type == TokenType.Operator) {
            var start = this.inputIndex;
            var operator = this.next.strValue;
            var literalSpan = new ParseSpan(start, start);
            var literalSourceSpan = literalSpan.toAbsolute(this.absoluteOffset);
            var result = void 0;
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
    };
    _ParseAST.prototype.parseCallChain = function () {
        var result = this.parsePrimary();
        var resultStart = result.span.start;
        while (true) {
            if (this.optionalCharacter(chars.$PERIOD)) {
                result = this.parseAccessMemberOrMethodCall(result, false);
            }
            else if (this.optionalOperator('?.')) {
                result = this.parseAccessMemberOrMethodCall(result, true);
            }
            else if (this.optionalCharacter(chars.$LBRACKET)) {
                this.rbracketsExpected++;
                var key = this.parsePipe();
                this.rbracketsExpected--;
                this.expectCharacter(chars.$RBRACKET);
                if (this.optionalOperator('=')) {
                    var value = this.parseConditional();
                    result = new KeyedWrite(this.span(resultStart), this.sourceSpan(resultStart), result, key, value);
                }
                else {
                    result = new KeyedRead(this.span(resultStart), this.sourceSpan(resultStart), result, key);
                }
            }
            else if (this.optionalCharacter(chars.$LPAREN)) {
                this.rparensExpected++;
                var args = this.parseCallArguments();
                this.rparensExpected--;
                this.expectCharacter(chars.$RPAREN);
                result =
                    new FunctionCall(this.span(resultStart), this.sourceSpan(resultStart), result, args);
            }
            else if (this.optionalOperator('!')) {
                result = new NonNullAssert(this.span(resultStart), this.sourceSpan(resultStart), result);
            }
            else {
                return result;
            }
        }
    };
    _ParseAST.prototype.parsePrimary = function () {
        var start = this.inputIndex;
        if (this.optionalCharacter(chars.$LPAREN)) {
            this.rparensExpected++;
            var result = this.parsePipe();
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
        else if (this.optionalCharacter(chars.$LBRACKET)) {
            this.rbracketsExpected++;
            var elements = this.parseExpressionList(chars.$RBRACKET);
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
            var value = this.next.toNumber();
            this.advance();
            return new LiteralPrimitive(this.span(start), this.sourceSpan(start), value);
        }
        else if (this.next.isString()) {
            var literalValue = this.next.toString();
            this.advance();
            return new LiteralPrimitive(this.span(start), this.sourceSpan(start), literalValue);
        }
        else if (this.index >= this.tokens.length) {
            this.error("Unexpected end of expression: " + this.input);
            return new EmptyExpr(this.span(start), this.sourceSpan(start));
        }
        else {
            this.error("Unexpected token " + this.next);
            return new EmptyExpr(this.span(start), this.sourceSpan(start));
        }
    };
    _ParseAST.prototype.parseExpressionList = function (terminator) {
        var result = [];
        if (!this.next.isCharacter(terminator)) {
            do {
                result.push(this.parsePipe());
            } while (this.optionalCharacter(chars.$COMMA));
        }
        return result;
    };
    _ParseAST.prototype.parseLiteralMap = function () {
        var keys = [];
        var values = [];
        var start = this.inputIndex;
        this.expectCharacter(chars.$LBRACE);
        if (!this.optionalCharacter(chars.$RBRACE)) {
            this.rbracesExpected++;
            do {
                var quoted = this.next.isString();
                var key = this.expectIdentifierOrKeywordOrString();
                keys.push({ key: key, quoted: quoted });
                this.expectCharacter(chars.$COLON);
                values.push(this.parsePipe());
            } while (this.optionalCharacter(chars.$COMMA));
            this.rbracesExpected--;
            this.expectCharacter(chars.$RBRACE);
        }
        return new LiteralMap(this.span(start), this.sourceSpan(start), keys, values);
    };
    _ParseAST.prototype.parseAccessMemberOrMethodCall = function (receiver, isSafe) {
        if (isSafe === void 0) { isSafe = false; }
        var start = receiver.span.start;
        var id = this.expectIdentifierOrKeyword();
        if (this.optionalCharacter(chars.$LPAREN)) {
            this.rparensExpected++;
            var args = this.parseCallArguments();
            this.expectCharacter(chars.$RPAREN);
            this.rparensExpected--;
            var span = this.span(start);
            var sourceSpan = this.sourceSpan(start);
            return isSafe ? new SafeMethodCall(span, sourceSpan, receiver, id, args) :
                new MethodCall(span, sourceSpan, receiver, id, args);
        }
        else {
            if (isSafe) {
                if (this.optionalOperator('=')) {
                    this.error('The \'?.\' operator cannot be used in the assignment');
                    return new EmptyExpr(this.span(start), this.sourceSpan(start));
                }
                else {
                    return new SafePropertyRead(this.span(start), this.sourceSpan(start), receiver, id);
                }
            }
            else {
                if (this.optionalOperator('=')) {
                    if (!this.parseAction) {
                        this.error('Bindings cannot contain assignments');
                        return new EmptyExpr(this.span(start), this.sourceSpan(start));
                    }
                    var value = this.parseConditional();
                    return new PropertyWrite(this.span(start), this.sourceSpan(start), receiver, id, value);
                }
                else {
                    var span = this.span(start);
                    return new PropertyRead(this.span(start), this.sourceSpan(start), receiver, id);
                }
            }
        }
    };
    _ParseAST.prototype.parseCallArguments = function () {
        if (this.next.isCharacter(chars.$RPAREN))
            return [];
        var positionals = [];
        do {
            positionals.push(this.parsePipe());
        } while (this.optionalCharacter(chars.$COMMA));
        return positionals;
    };
    /**
     * An identifier, a keyword, a string with an optional `-` in between.
     */
    _ParseAST.prototype.expectTemplateBindingKey = function () {
        var result = '';
        var operatorFound = false;
        do {
            result += this.expectIdentifierOrKeywordOrString();
            operatorFound = this.optionalOperator('-');
            if (operatorFound) {
                result += '-';
            }
        } while (operatorFound);
        return result.toString();
    };
    // Parses the AST for `<some-tag *tplKey=AST>`
    _ParseAST.prototype.parseTemplateBindings = function (tplKey) {
        var firstBinding = true;
        var bindings = [];
        var warnings = [];
        do {
            var start = this.inputIndex;
            var rawKey = void 0;
            var key = void 0;
            var isVar = false;
            if (firstBinding) {
                rawKey = key = tplKey;
                firstBinding = false;
            }
            else {
                isVar = this.peekKeywordLet();
                if (isVar)
                    this.advance();
                rawKey = this.expectTemplateBindingKey();
                key = isVar ? rawKey : tplKey + rawKey[0].toUpperCase() + rawKey.substring(1);
                this.optionalCharacter(chars.$COLON);
            }
            var name_2 = null;
            var expression = null;
            if (isVar) {
                if (this.optionalOperator('=')) {
                    name_2 = this.expectTemplateBindingKey();
                }
                else {
                    name_2 = '\$implicit';
                }
            }
            else if (this.peekKeywordAs()) {
                this.advance(); // consume `as`
                name_2 = rawKey;
                key = this.expectTemplateBindingKey(); // read local var name
                isVar = true;
            }
            else if (this.next !== EOF && !this.peekKeywordLet()) {
                var start_1 = this.inputIndex;
                var ast = this.parsePipe();
                var source = this.input.substring(start_1 - this.offset, this.inputIndex - this.offset);
                expression =
                    new ASTWithSource(ast, source, this.location, this.absoluteOffset, this.errors);
            }
            bindings.push(new TemplateBinding(this.span(start), this.sourceSpan(start), key, isVar, name_2, expression));
            if (this.peekKeywordAs() && !isVar) {
                var letStart = this.inputIndex;
                this.advance(); // consume `as`
                var letName = this.expectTemplateBindingKey(); // read local var name
                bindings.push(new TemplateBinding(this.span(letStart), this.sourceSpan(letStart), letName, true, key, null));
            }
            if (!this.optionalCharacter(chars.$SEMICOLON)) {
                this.optionalCharacter(chars.$COMMA);
            }
        } while (this.index < this.tokens.length);
        return new TemplateBindingParseResult(bindings, warnings, this.errors);
    };
    _ParseAST.prototype.error = function (message, index) {
        if (index === void 0) { index = null; }
        this.errors.push(new ParserError(message, this.input, this.locationText(index), this.location));
        this.skip();
    };
    _ParseAST.prototype.locationText = function (index) {
        if (index === void 0) { index = null; }
        if (index == null)
            index = this.index;
        return (index < this.tokens.length) ? "at column " + (this.tokens[index].index + 1) + " in" :
            "at the end of the expression";
    };
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
    _ParseAST.prototype.skip = function () {
        var n = this.next;
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
    };
    return _ParseAST;
}());
export { _ParseAST };
var SimpleExpressionChecker = /** @class */ (function () {
    function SimpleExpressionChecker() {
        this.errors = [];
    }
    SimpleExpressionChecker.check = function (ast) {
        var s = new SimpleExpressionChecker();
        ast.visit(s);
        return s.errors;
    };
    SimpleExpressionChecker.prototype.visitImplicitReceiver = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitInterpolation = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitLiteralPrimitive = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitPropertyRead = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitPropertyWrite = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitSafePropertyRead = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitMethodCall = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitSafeMethodCall = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitFunctionCall = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitLiteralArray = function (ast, context) { this.visitAll(ast.expressions); };
    SimpleExpressionChecker.prototype.visitLiteralMap = function (ast, context) { this.visitAll(ast.values); };
    SimpleExpressionChecker.prototype.visitBinary = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitPrefixNot = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitNonNullAssert = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitConditional = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitPipe = function (ast, context) { this.errors.push('pipes'); };
    SimpleExpressionChecker.prototype.visitKeyedRead = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitKeyedWrite = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitAll = function (asts) {
        var _this = this;
        return asts.map(function (node) { return node.visit(_this); });
    };
    SimpleExpressionChecker.prototype.visitChain = function (ast, context) { };
    SimpleExpressionChecker.prototype.visitQuote = function (ast, context) { };
    return SimpleExpressionChecker;
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sbUNBQW1DLENBQUM7QUFDcEcsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVyQyxPQUFPLEVBQU0sYUFBYSxFQUFrQyxNQUFNLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFpQixnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDblosT0FBTyxFQUFDLEdBQUcsRUFBZ0IsU0FBUyxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFFNUU7SUFDRSw0QkFBbUIsT0FBaUIsRUFBUyxXQUFxQixFQUFTLE9BQWlCO1FBQXpFLFlBQU8sR0FBUCxPQUFPLENBQVU7UUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBVTtRQUFTLFlBQU8sR0FBUCxPQUFPLENBQVU7SUFBRyxDQUFDO0lBQ2xHLHlCQUFDO0FBQUQsQ0FBQyxBQUZELElBRUM7O0FBRUQ7SUFDRSxvQ0FDVyxnQkFBbUMsRUFBUyxRQUFrQixFQUM5RCxNQUFxQjtRQURyQixxQkFBZ0IsR0FBaEIsZ0JBQWdC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QUFFLE9BQVksSUFBRyxDQUFDO0lBRXZELGtEQUFnQixHQUFoQixVQUFpQixHQUFnQixFQUFFLE9BQVksSUFBRyxDQUFDO0lBRW5ELDJDQUFTLEdBQVQsVUFBVSxHQUFnQixFQUFFLE9BQVksSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFeEUsZ0RBQWMsR0FBZCxVQUFlLEdBQWMsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUUvQyxpREFBZSxHQUFmLFVBQWdCLEdBQWUsRUFBRSxPQUFZLElBQUcsQ0FBQztJQUVqRCwwQ0FBUSxHQUFSLFVBQVMsSUFBVztRQUFwQixpQkFBMkU7UUFBNUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsRUFBaEIsQ0FBZ0IsQ0FBQyxDQUFDO0lBQUMsQ0FBQztJQUUzRSw0Q0FBVSxHQUFWLFVBQVcsR0FBVSxFQUFFLE9BQVksSUFBRyxDQUFDO0lBRXZDLDRDQUFVLEdBQVYsVUFBVyxHQUFVLEVBQUUsT0FBWSxJQUFHLENBQUM7SUFDekMsOEJBQUM7QUFBRCxDQUFDLEFBbERELElBa0RDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGFycyBmcm9tICcuLi9jaGFycyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge2VzY2FwZVJlZ0V4cH0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBBYnNvbHV0ZVNvdXJjZVNwYW4sIEFzdFZpc2l0b3IsIEJpbmFyeSwgQmluZGluZ1BpcGUsIENoYWluLCBDb25kaXRpb25hbCwgRW1wdHlFeHByLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIEtleWVkUmVhZCwgS2V5ZWRXcml0ZSwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsTWFwS2V5LCBMaXRlcmFsUHJpbWl0aXZlLCBNZXRob2RDYWxsLCBOb25OdWxsQXNzZXJ0LCBQYXJzZVNwYW4sIFBhcnNlckVycm9yLCBQcmVmaXhOb3QsIFByb3BlcnR5UmVhZCwgUHJvcGVydHlXcml0ZSwgUXVvdGUsIFNhZmVNZXRob2RDYWxsLCBTYWZlUHJvcGVydHlSZWFkLCBUZW1wbGF0ZUJpbmRpbmd9IGZyb20gJy4vYXN0JztcbmltcG9ydCB7RU9GLCBMZXhlciwgVG9rZW4sIFRva2VuVHlwZSwgaXNJZGVudGlmaWVyLCBpc1F1b3RlfSBmcm9tICcuL2xleGVyJztcblxuZXhwb3J0IGNsYXNzIFNwbGl0SW50ZXJwb2xhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBzdHJpbmdzOiBzdHJpbmdbXSwgcHVibGljIGV4cHJlc3Npb25zOiBzdHJpbmdbXSwgcHVibGljIG9mZnNldHM6IG51bWJlcltdKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSwgcHVibGljIHdhcm5pbmdzOiBzdHJpbmdbXSxcbiAgICAgIHB1YmxpYyBlcnJvcnM6IFBhcnNlckVycm9yW10pIHt9XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBSZWdFeHAge1xuICBjb25zdCBwYXR0ZXJuID0gZXNjYXBlUmVnRXhwKGNvbmZpZy5zdGFydCkgKyAnKFtcXFxcc1xcXFxTXSo/KScgKyBlc2NhcGVSZWdFeHAoY29uZmlnLmVuZCk7XG4gIHJldHVybiBuZXcgUmVnRXhwKHBhdHRlcm4sICdnJyk7XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2xleGVyOiBMZXhlcikge31cblxuICBwYXJzZUFjdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIHRoaXMuX2NoZWNrTm9JbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZSh0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KSk7XG4gICAgY29uc3QgYXN0ID0gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsIHRydWUsIHRoaXMuZXJyb3JzLFxuICAgICAgICAgICAgICAgICAgICBpbnB1dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcGFyc2VCaW5kaW5nKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VCaW5kaW5nQXN0KGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHBhcnNlU2ltcGxlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBlcnJvcnMgPSBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlci5jaGVjayhhc3QpO1xuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYEhvc3QgYmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluICR7ZXJyb3JzLmpvaW4oJyAnKX1gLCBpbnB1dCwgbG9jYXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihtZXNzYWdlOiBzdHJpbmcsIGlucHV0OiBzdHJpbmcsIGVyckxvY2F0aW9uOiBzdHJpbmcsIGN0eExvY2F0aW9uPzogYW55KSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VyRXJyb3IobWVzc2FnZSwgaW5wdXQsIGVyckxvY2F0aW9uLCBjdHhMb2NhdGlvbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VCaW5kaW5nQXN0KFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBBU1Qge1xuICAgIC8vIFF1b3RlcyBleHByZXNzaW9ucyB1c2UgM3JkLXBhcnR5IGV4cHJlc3Npb24gbGFuZ3VhZ2UuIFdlIGRvbid0IHdhbnQgdG8gdXNlXG4gICAgLy8gb3VyIGxleGVyIG9yIHBhcnNlciBmb3IgdGhhdCwgc28gd2UgY2hlY2sgZm9yIHRoYXQgYWhlYWQgb2YgdGltZS5cbiAgICBjb25zdCBxdW90ZSA9IHRoaXMuX3BhcnNlUXVvdGUoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG5cbiAgICBpZiAocXVvdGUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHF1b3RlO1xuICAgIH1cblxuICAgIHRoaXMuX2NoZWNrTm9JbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgcmV0dXJuIG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgZmFsc2UsIHRoaXMuZXJyb3JzLFxuICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAucGFyc2VDaGFpbigpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VRdW90ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1R8bnVsbCB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHByZWZpeFNlcGFyYXRvckluZGV4ID0gaW5wdXQuaW5kZXhPZignOicpO1xuICAgIGlmIChwcmVmaXhTZXBhcmF0b3JJbmRleCA9PSAtMSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4ID0gaW5wdXQuc3Vic3RyaW5nKDAsIHByZWZpeFNlcGFyYXRvckluZGV4KS50cmltKCk7XG4gICAgaWYgKCFpc0lkZW50aWZpZXIocHJlZml4KSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24gPSBpbnB1dC5zdWJzdHJpbmcocHJlZml4U2VwYXJhdG9ySW5kZXggKyAxKTtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgUXVvdGUoXG4gICAgICAgIHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHByZWZpeCwgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24sIGxvY2F0aW9uKTtcbiAgfVxuXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyh0cGxLZXk6IHN0cmluZywgdHBsVmFsdWU6IHN0cmluZywgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6XG4gICAgICBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUodHBsVmFsdWUpO1xuICAgIHJldHVybiBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgdHBsVmFsdWUsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCB0cGxWYWx1ZS5sZW5ndGgsIGZhbHNlLCB0aGlzLmVycm9ycywgMClcbiAgICAgICAgLnBhcnNlVGVtcGxhdGVCaW5kaW5ncyh0cGxLZXkpO1xuICB9XG5cbiAgcGFyc2VJbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZXxudWxsIHtcbiAgICBjb25zdCBzcGxpdCA9IHRoaXMuc3BsaXRJbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgaWYgKHNwbGl0ID09IG51bGwpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZXhwcmVzc2lvbnM6IEFTVFtdID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwbGl0LmV4cHJlc3Npb25zLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBleHByZXNzaW9uVGV4dCA9IHNwbGl0LmV4cHJlc3Npb25zW2ldO1xuICAgICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGV4cHJlc3Npb25UZXh0KTtcbiAgICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHNvdXJjZVRvTGV4KTtcbiAgICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgICAgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsIGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JzLCBzcGxpdC5vZmZzZXRzW2ldICsgKGV4cHJlc3Npb25UZXh0Lmxlbmd0aCAtIHNvdXJjZVRvTGV4Lmxlbmd0aCkpXG4gICAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICAgIGV4cHJlc3Npb25zLnB1c2goYXN0KTtcbiAgICB9XG5cbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dCA9PSBudWxsID8gMCA6IGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICBuZXcgSW50ZXJwb2xhdGlvbihzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBzcGxpdC5zdHJpbmdzLCBleHByZXNzaW9ucyksIGlucHV0LFxuICAgICAgICBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHNwbGl0SW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IFNwbGl0SW50ZXJwb2xhdGlvblxuICAgICAgfG51bGwge1xuICAgIGNvbnN0IHJlZ2V4cCA9IF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBwYXJ0cyA9IGlucHV0LnNwbGl0KHJlZ2V4cCk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA8PSAxKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc3RyaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBleHByZXNzaW9uczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBvZmZzZXRzOiBudW1iZXJbXSA9IFtdO1xuICAgIGxldCBvZmZzZXQgPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHBhcnQ6IHN0cmluZyA9IHBhcnRzW2ldO1xuICAgICAgaWYgKGkgJSAyID09PSAwKSB7XG4gICAgICAgIC8vIGZpeGVkIHN0cmluZ1xuICAgICAgICBzdHJpbmdzLnB1c2gocGFydCk7XG4gICAgICAgIG9mZnNldCArPSBwYXJ0Lmxlbmd0aDtcbiAgICAgIH0gZWxzZSBpZiAocGFydC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICBvZmZzZXQgKz0gaW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydC5sZW5ndGg7XG4gICAgICAgIGV4cHJlc3Npb25zLnB1c2gocGFydCk7XG4gICAgICAgIG9mZnNldHMucHVzaChvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gcGFydC5sZW5ndGggKyBpbnRlcnBvbGF0aW9uQ29uZmlnLmVuZC5sZW5ndGg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICdCbGFuayBleHByZXNzaW9ucyBhcmUgbm90IGFsbG93ZWQgaW4gaW50ZXJwb2xhdGVkIHN0cmluZ3MnLCBpbnB1dCxcbiAgICAgICAgICAgIGBhdCBjb2x1bW4gJHt0aGlzLl9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKHBhcnRzLCBpLCBpbnRlcnBvbGF0aW9uQ29uZmlnKX0gaW5gLFxuICAgICAgICAgICAgbG9jYXRpb24pO1xuICAgICAgICBleHByZXNzaW9ucy5wdXNoKCckaW1wbGljdCcpO1xuICAgICAgICBvZmZzZXRzLnB1c2gob2Zmc2V0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTcGxpdEludGVycG9sYXRpb24oc3RyaW5ncywgZXhwcmVzc2lvbnMsIG9mZnNldHMpO1xuICB9XG5cbiAgd3JhcExpdGVyYWxQcmltaXRpdmUoaW5wdXQ6IHN0cmluZ3xudWxsLCBsb2NhdGlvbjogYW55LCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4oMCwgaW5wdXQgPT0gbnVsbCA/IDAgOiBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShcbiAgICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUoc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgaW5wdXQpLCBpbnB1dCwgbG9jYXRpb24sXG4gICAgICAgIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIF9zdHJpcENvbW1lbnRzKGlucHV0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGkgPSB0aGlzLl9jb21tZW50U3RhcnQoaW5wdXQpO1xuICAgIHJldHVybiBpICE9IG51bGwgPyBpbnB1dC5zdWJzdHJpbmcoMCwgaSkudHJpbSgpIDogaW5wdXQ7XG4gIH1cblxuICBwcml2YXRlIF9jb21tZW50U3RhcnQoaW5wdXQ6IHN0cmluZyk6IG51bWJlcnxudWxsIHtcbiAgICBsZXQgb3V0ZXJRdW90ZTogbnVtYmVyfG51bGwgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBjb25zdCBjaGFyID0gaW5wdXQuY2hhckNvZGVBdChpKTtcbiAgICAgIGNvbnN0IG5leHRDaGFyID0gaW5wdXQuY2hhckNvZGVBdChpICsgMSk7XG5cbiAgICAgIGlmIChjaGFyID09PSBjaGFycy4kU0xBU0ggJiYgbmV4dENoYXIgPT0gY2hhcnMuJFNMQVNIICYmIG91dGVyUXVvdGUgPT0gbnVsbCkgcmV0dXJuIGk7XG5cbiAgICAgIGlmIChvdXRlclF1b3RlID09PSBjaGFyKSB7XG4gICAgICAgIG91dGVyUXVvdGUgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmIChvdXRlclF1b3RlID09IG51bGwgJiYgaXNRdW90ZShjaGFyKSkge1xuICAgICAgICBvdXRlclF1b3RlID0gY2hhcjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9jaGVja05vSW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpOiB2b2lkIHtcbiAgICBjb25zdCByZWdleHAgPSBfY3JlYXRlSW50ZXJwb2xhdGVSZWdFeHAoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3QgcGFydHMgPSBpbnB1dC5zcGxpdChyZWdleHApO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgR290IGludGVycG9sYXRpb24gKCR7aW50ZXJwb2xhdGlvbkNvbmZpZy5zdGFydH0ke2ludGVycG9sYXRpb25Db25maWcuZW5kfSkgd2hlcmUgZXhwcmVzc2lvbiB3YXMgZXhwZWN0ZWRgLFxuICAgICAgICAgIGlucHV0LFxuICAgICAgICAgIGBhdCBjb2x1bW4gJHt0aGlzLl9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKHBhcnRzLCAxLCBpbnRlcnBvbGF0aW9uQ29uZmlnKX0gaW5gLFxuICAgICAgICAgIGxvY2F0aW9uKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKFxuICAgICAgcGFydHM6IHN0cmluZ1tdLCBwYXJ0SW5FcnJJZHg6IG51bWJlciwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IG51bWJlciB7XG4gICAgbGV0IGVyckxvY2F0aW9uID0gJyc7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBwYXJ0SW5FcnJJZHg7IGorKykge1xuICAgICAgZXJyTG9jYXRpb24gKz0gaiAlIDIgPT09IDAgP1xuICAgICAgICAgIHBhcnRzW2pdIDpcbiAgICAgICAgICBgJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7cGFydHNbal19JHtpbnRlcnBvbGF0aW9uQ29uZmlnLmVuZH1gO1xuICAgIH1cblxuICAgIHJldHVybiBlcnJMb2NhdGlvbi5sZW5ndGg7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIF9QYXJzZUFTVCB7XG4gIHByaXZhdGUgcnBhcmVuc0V4cGVjdGVkID0gMDtcbiAgcHJpdmF0ZSByYnJhY2tldHNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNlc0V4cGVjdGVkID0gMDtcblxuICAvLyBDYWNoZSBvZiBleHByZXNzaW9uIHN0YXJ0IGFuZCBpbnB1dCBpbmRlY2VzIHRvIHRoZSBhYnNvbHV0ZSBzb3VyY2Ugc3BhbiB0aGV5IG1hcCB0bywgdXNlZCB0b1xuICAvLyBwcmV2ZW50IGNyZWF0aW5nIHN1cGVyZmx1b3VzIHNvdXJjZSBzcGFucyBpbiBgc291cmNlU3BhbmAuXG4gIC8vIEEgc2VyaWFsIG9mIHRoZSBleHByZXNzaW9uIHN0YXJ0IGFuZCBpbnB1dCBpbmRleCBpcyB1c2VkIGZvciBtYXBwaW5nIGJlY2F1c2UgYm90aCBhcmUgc3RhdGVmdWxcbiAgLy8gYW5kIG1heSBjaGFuZ2UgZm9yIHN1YnNlcXVlbnQgZXhwcmVzc2lvbnMgdmlzaXRlZCBieSB0aGUgcGFyc2VyLlxuICBwcml2YXRlIHNvdXJjZVNwYW5DYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBBYnNvbHV0ZVNvdXJjZVNwYW4+KCk7XG5cbiAgaW5kZXg6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaW5wdXQ6IHN0cmluZywgcHVibGljIGxvY2F0aW9uOiBhbnksIHB1YmxpYyBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgcHVibGljIHRva2VuczogVG9rZW5bXSwgcHVibGljIGlucHV0TGVuZ3RoOiBudW1iZXIsIHB1YmxpYyBwYXJzZUFjdGlvbjogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgZXJyb3JzOiBQYXJzZXJFcnJvcltdLCBwcml2YXRlIG9mZnNldDogbnVtYmVyKSB7fVxuXG4gIHBlZWsob2Zmc2V0OiBudW1iZXIpOiBUb2tlbiB7XG4gICAgY29uc3QgaSA9IHRoaXMuaW5kZXggKyBvZmZzZXQ7XG4gICAgcmV0dXJuIGkgPCB0aGlzLnRva2Vucy5sZW5ndGggPyB0aGlzLnRva2Vuc1tpXSA6IEVPRjtcbiAgfVxuXG4gIGdldCBuZXh0KCk6IFRva2VuIHsgcmV0dXJuIHRoaXMucGVlaygwKTsgfVxuXG4gIGdldCBpbnB1dEluZGV4KCk6IG51bWJlciB7XG4gICAgcmV0dXJuICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSA/IHRoaXMubmV4dC5pbmRleCArIHRoaXMub2Zmc2V0IDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnB1dExlbmd0aCArIHRoaXMub2Zmc2V0O1xuICB9XG5cbiAgc3BhbihzdGFydDogbnVtYmVyKSB7IHJldHVybiBuZXcgUGFyc2VTcGFuKHN0YXJ0LCB0aGlzLmlucHV0SW5kZXgpOyB9XG5cbiAgc291cmNlU3BhbihzdGFydDogbnVtYmVyKTogQWJzb2x1dGVTb3VyY2VTcGFuIHtcbiAgICBjb25zdCBzZXJpYWwgPSBgJHtzdGFydH1AJHt0aGlzLmlucHV0SW5kZXh9YDtcbiAgICBpZiAoIXRoaXMuc291cmNlU3BhbkNhY2hlLmhhcyhzZXJpYWwpKSB7XG4gICAgICB0aGlzLnNvdXJjZVNwYW5DYWNoZS5zZXQoc2VyaWFsLCB0aGlzLnNwYW4oc3RhcnQpLnRvQWJzb2x1dGUodGhpcy5hYnNvbHV0ZU9mZnNldCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zb3VyY2VTcGFuQ2FjaGUuZ2V0KHNlcmlhbCkgITtcbiAgfVxuXG4gIGFkdmFuY2UoKSB7IHRoaXMuaW5kZXgrKzsgfVxuXG4gIG9wdGlvbmFsQ2hhcmFjdGVyKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5leHQuaXNDaGFyYWN0ZXIoY29kZSkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBwZWVrS2V5d29yZExldCgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMubmV4dC5pc0tleXdvcmRMZXQoKTsgfVxuICBwZWVrS2V5d29yZEFzKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5uZXh0LmlzS2V5d29yZEFzKCk7IH1cblxuICBleHBlY3RDaGFyYWN0ZXIoY29kZTogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY29kZSkpIHJldHVybjtcbiAgICB0aGlzLmVycm9yKGBNaXNzaW5nIGV4cGVjdGVkICR7U3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKX1gKTtcbiAgfVxuXG4gIG9wdGlvbmFsT3BlcmF0b3Iob3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5leHQuaXNPcGVyYXRvcihvcCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBleHBlY3RPcGVyYXRvcihvcGVyYXRvcjogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMub3B0aW9uYWxPcGVyYXRvcihvcGVyYXRvcikpIHJldHVybjtcbiAgICB0aGlzLmVycm9yKGBNaXNzaW5nIGV4cGVjdGVkIG9wZXJhdG9yICR7b3BlcmF0b3J9YCk7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk6IHN0cmluZyB7XG4gICAgY29uc3QgbiA9IHRoaXMubmV4dDtcbiAgICBpZiAoIW4uaXNJZGVudGlmaWVyKCkgJiYgIW4uaXNLZXl3b3JkKCkpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgdG9rZW4gJHtufSwgZXhwZWN0ZWQgaWRlbnRpZmllciBvciBrZXl3b3JkYCk7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuLnRvU3RyaW5nKCkgYXMgc3RyaW5nO1xuICB9XG5cbiAgZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgY29uc3QgbiA9IHRoaXMubmV4dDtcbiAgICBpZiAoIW4uaXNJZGVudGlmaWVyKCkgJiYgIW4uaXNLZXl3b3JkKCkgJiYgIW4uaXNTdHJpbmcoKSkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAke259LCBleHBlY3RlZCBpZGVudGlmaWVyLCBrZXl3b3JkLCBvciBzdHJpbmdgKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG4udG9TdHJpbmcoKSBhcyBzdHJpbmc7XG4gIH1cblxuICBwYXJzZUNoYWluKCk6IEFTVCB7XG4gICAgY29uc3QgZXhwcnM6IEFTVFtdID0gW107XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGV4cHIgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgZXhwcnMucHVzaChleHByKTtcblxuICAgICAgaWYgKHRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluIGNoYWluZWQgZXhwcmVzc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRTRU1JQ09MT04pKSB7XG4gICAgICAgIH0gIC8vIHJlYWQgYWxsIHNlbWljb2xvbnNcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICcke3RoaXMubmV4dH0nYCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChleHBycy5sZW5ndGggPT0gMCkgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgaWYgKGV4cHJzLmxlbmd0aCA9PSAxKSByZXR1cm4gZXhwcnNbMF07XG4gICAgcmV0dXJuIG5ldyBDaGFpbih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBleHBycyk7XG4gIH1cblxuICBwYXJzZVBpcGUoKTogQVNUIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICBpZiAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCd8JykpIHtcbiAgICAgIGlmICh0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgIHRoaXMuZXJyb3IoJ0Nhbm5vdCBoYXZlIGEgcGlwZSBpbiBhbiBhY3Rpb24gZXhwcmVzc2lvbicpO1xuICAgICAgfVxuXG4gICAgICBkbyB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTtcbiAgICAgICAgY29uc3QgYXJnczogQVNUW10gPSBbXTtcbiAgICAgICAgd2hpbGUgKHRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKSkge1xuICAgICAgICAgIGFyZ3MucHVzaCh0aGlzLnBhcnNlRXhwcmVzc2lvbigpKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5kaW5nUGlwZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQsIG5hbWUsIGFyZ3MpO1xuICAgICAgfSB3aGlsZSAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCd8JykpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUV4cHJlc3Npb24oKTogQVNUIHsgcmV0dXJuIHRoaXMucGFyc2VDb25kaXRpb25hbCgpOyB9XG5cbiAgcGFyc2VDb25kaXRpb25hbCgpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsT3IoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbmFsT3BlcmF0b3IoJz8nKSkge1xuICAgICAgY29uc3QgeWVzID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIGxldCBubzogQVNUO1xuICAgICAgaWYgKCF0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgY29uc3QgZW5kID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgICAgIHRoaXMuZXJyb3IoYENvbmRpdGlvbmFsIGV4cHJlc3Npb24gJHtleHByZXNzaW9ufSByZXF1aXJlcyBhbGwgMyBleHByZXNzaW9uc2ApO1xuICAgICAgICBubyA9IG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBubyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgeWVzLCBubyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VMb2dpY2FsT3IoKTogQVNUIHtcbiAgICAvLyAnfHwnXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG4gICAgd2hpbGUgKHRoaXMub3B0aW9uYWxPcGVyYXRvcignfHwnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlTG9naWNhbEFuZCgpO1xuICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnfHwnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTG9naWNhbEFuZCgpOiBBU1Qge1xuICAgIC8vICcmJidcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG4gICAgd2hpbGUgKHRoaXMub3B0aW9uYWxPcGVyYXRvcignJiYnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlRXF1YWxpdHkoKTtcbiAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgJyYmJywgcmVzdWx0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUVxdWFsaXR5KCk6IEFTVCB7XG4gICAgLy8gJz09JywnIT0nLCc9PT0nLCchPT0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VSZWxhdGlvbmFsKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgY2FzZSAnIT0nOlxuICAgICAgICBjYXNlICchPT0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlUmVsYXRpb25hbCgpOiBBU1Qge1xuICAgIC8vICc8JywgJz4nLCAnPD0nLCAnPj0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgY2FzZSAnPic6XG4gICAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgY2FzZSAnPj0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUFkZGl0aXZlKCk6IEFTVCB7XG4gICAgLy8gJysnLCAnLSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJysnOlxuICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTXVsdGlwbGljYXRpdmUoKTogQVNUIHtcbiAgICAvLyAnKicsICclJywgJy8nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKic6XG4gICAgICAgIGNhc2UgJyUnOlxuICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZVByZWZpeCgpOiBBU1Qge1xuICAgIGlmICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBjb25zdCBsaXRlcmFsU3BhbiA9IG5ldyBQYXJzZVNwYW4oc3RhcnQsIHN0YXJ0KTtcbiAgICAgIGNvbnN0IGxpdGVyYWxTb3VyY2VTcGFuID0gbGl0ZXJhbFNwYW4udG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KTtcbiAgICAgIGxldCByZXN1bHQ6IEFTVDtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgQmluYXJ5KFxuICAgICAgICAgICAgICB0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnLScsIHJlc3VsdCxcbiAgICAgICAgICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUobGl0ZXJhbFNwYW4sIGxpdGVyYWxTb3VyY2VTcGFuLCAwKSk7XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IEJpbmFyeShcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsXG4gICAgICAgICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKGxpdGVyYWxTcGFuLCBsaXRlcmFsU291cmNlU3BhbiwgMCksIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByZWZpeE5vdCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYXJzZUNhbGxDaGFpbigpO1xuICB9XG5cbiAgcGFyc2VDYWxsQ2hhaW4oKTogQVNUIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByaW1hcnkoKTtcbiAgICBjb25zdCByZXN1bHRTdGFydCA9IHJlc3VsdC5zcGFuLnN0YXJ0O1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kUEVSSU9EKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgZmFsc2UpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWxPcGVyYXRvcignPy4nKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgdHJ1ZSk7XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBLZXllZFdyaXRlKFxuICAgICAgICAgICAgICB0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGtleSwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBLZXllZFJlYWQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBrZXkpO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgICBjb25zdCBhcmdzID0gdGhpcy5wYXJzZUNhbGxBcmd1bWVudHMoKTtcbiAgICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICAgIHJlc3VsdCA9XG4gICAgICAgICAgICBuZXcgRnVuY3Rpb25DYWxsKHRoaXMuc3BhbihyZXN1bHRTdGFydCksIHRoaXMuc291cmNlU3BhbihyZXN1bHRTdGFydCksIHJlc3VsdCwgYXJncyk7XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCchJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IE5vbk51bGxBc3NlcnQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0KTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZVByaW1hcnkoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkTnVsbCgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBudWxsKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFVuZGVmaW5lZCgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB2b2lkIDApO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkVHJ1ZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB0cnVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZEZhbHNlKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGZhbHNlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRoaXMoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IEltcGxpY2l0UmVjZWl2ZXIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgZWxlbWVudHMgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbkxpc3QoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxBcnJheSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBlbGVtZW50cyk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3RlcihjaGFycy4kTEJSQUNFKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VMaXRlcmFsTWFwKCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0lkZW50aWZpZXIoKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwoXG4gICAgICAgICAgbmV3IEltcGxpY2l0UmVjZWl2ZXIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSksIGZhbHNlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzTnVtYmVyKCkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5uZXh0LnRvTnVtYmVyKCk7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB2YWx1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc1N0cmluZygpKSB7XG4gICAgICBjb25zdCBsaXRlcmFsVmFsdWUgPSB0aGlzLm5leHQudG9TdHJpbmcoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGxpdGVyYWxWYWx1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPj0gdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIGVuZCBvZiBleHByZXNzaW9uOiAke3RoaXMuaW5wdXR9YCk7XG4gICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAke3RoaXMubmV4dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbkxpc3QodGVybWluYXRvcjogbnVtYmVyKTogQVNUW10ge1xuICAgIGNvbnN0IHJlc3VsdDogQVNUW10gPSBbXTtcbiAgICBpZiAoIXRoaXMubmV4dC5pc0NoYXJhY3Rlcih0ZXJtaW5hdG9yKSkge1xuICAgICAgZG8ge1xuICAgICAgICByZXN1bHQucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxpdGVyYWxNYXAoKTogTGl0ZXJhbE1hcCB7XG4gICAgY29uc3Qga2V5czogTGl0ZXJhbE1hcEtleVtdID0gW107XG4gICAgY29uc3QgdmFsdWVzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpO1xuICAgIGlmICghdGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkge1xuICAgICAgdGhpcy5yYnJhY2VzRXhwZWN0ZWQrKztcbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgcXVvdGVkID0gdGhpcy5uZXh0LmlzU3RyaW5nKCk7XG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICAgIGtleXMucHVzaCh7a2V5LCBxdW90ZWR9KTtcbiAgICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKTtcbiAgICAgICAgdmFsdWVzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICB9IHdoaWxlICh0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSkpO1xuICAgICAgdGhpcy5yYnJhY2VzRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IExpdGVyYWxNYXAodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwga2V5cywgdmFsdWVzKTtcbiAgfVxuXG4gIHBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlY2VpdmVyOiBBU1QsIGlzU2FmZTogYm9vbGVhbiA9IGZhbHNlKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHJlY2VpdmVyLnNwYW4uc3RhcnQ7XG4gICAgY29uc3QgaWQgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMucGFyc2VDYWxsQXJndW1lbnRzKCk7XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICBjb25zdCBzcGFuID0gdGhpcy5zcGFuKHN0YXJ0KTtcbiAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpO1xuICAgICAgcmV0dXJuIGlzU2FmZSA/IG5ldyBTYWZlTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpIDpcbiAgICAgICAgICAgICAgICAgICAgICBuZXcgTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpc1NhZmUpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignVGhlIFxcJz8uXFwnIG9wZXJhdG9yIGNhbm5vdCBiZSB1c2VkIGluIHRoZSBhc3NpZ25tZW50Jyk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBTYWZlUHJvcGVydHlSZWFkKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlY2VpdmVyLCBpZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgIGlmICghdGhpcy5wYXJzZUFjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZ3MgY2Fubm90IGNvbnRhaW4gYXNzaWdubWVudHMnKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVdyaXRlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlY2VpdmVyLCBpZCwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHNwYW4gPSB0aGlzLnNwYW4oc3RhcnQpO1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvcGVydHlSZWFkKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlY2VpdmVyLCBpZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZUNhbGxBcmd1bWVudHMoKTogQmluZGluZ1BpcGVbXSB7XG4gICAgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3RlcihjaGFycy4kUlBBUkVOKSkgcmV0dXJuIFtdO1xuICAgIGNvbnN0IHBvc2l0aW9uYWxzOiBBU1RbXSA9IFtdO1xuICAgIGRvIHtcbiAgICAgIHBvc2l0aW9uYWxzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgfSB3aGlsZSAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcG9zaXRpb25hbHMgYXMgQmluZGluZ1BpcGVbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBbiBpZGVudGlmaWVyLCBhIGtleXdvcmQsIGEgc3RyaW5nIHdpdGggYW4gb3B0aW9uYWwgYC1gIGluIGJldHdlZW4uXG4gICAqL1xuICBleHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTogc3RyaW5nIHtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgbGV0IG9wZXJhdG9yRm91bmQgPSBmYWxzZTtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTtcbiAgICAgIG9wZXJhdG9yRm91bmQgPSB0aGlzLm9wdGlvbmFsT3BlcmF0b3IoJy0nKTtcbiAgICAgIGlmIChvcGVyYXRvckZvdW5kKSB7XG4gICAgICAgIHJlc3VsdCArPSAnLSc7XG4gICAgICB9XG4gICAgfSB3aGlsZSAob3BlcmF0b3JGb3VuZCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LnRvU3RyaW5nKCk7XG4gIH1cblxuICAvLyBQYXJzZXMgdGhlIEFTVCBmb3IgYDxzb21lLXRhZyAqdHBsS2V5PUFTVD5gXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyh0cGxLZXk6IHN0cmluZyk6IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgICBsZXQgZmlyc3RCaW5kaW5nID0gdHJ1ZTtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICBkbyB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgIGxldCByYXdLZXk6IHN0cmluZztcbiAgICAgIGxldCBrZXk6IHN0cmluZztcbiAgICAgIGxldCBpc1ZhcjogYm9vbGVhbiA9IGZhbHNlO1xuICAgICAgaWYgKGZpcnN0QmluZGluZykge1xuICAgICAgICByYXdLZXkgPSBrZXkgPSB0cGxLZXk7XG4gICAgICAgIGZpcnN0QmluZGluZyA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaXNWYXIgPSB0aGlzLnBlZWtLZXl3b3JkTGV0KCk7XG4gICAgICAgIGlmIChpc1ZhcikgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIHJhd0tleSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgICAgIGtleSA9IGlzVmFyID8gcmF3S2V5IDogdHBsS2V5ICsgcmF3S2V5WzBdLnRvVXBwZXJDYXNlKCkgKyByYXdLZXkuc3Vic3RyaW5nKDEpO1xuICAgICAgICB0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7XG4gICAgICB9XG5cbiAgICAgIGxldCBuYW1lOiBzdHJpbmcgPSBudWxsICE7XG4gICAgICBsZXQgZXhwcmVzc2lvbjogQVNUV2l0aFNvdXJjZXxudWxsID0gbnVsbDtcbiAgICAgIGlmIChpc1Zhcikge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICBuYW1lID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuYW1lID0gJ1xcJGltcGxpY2l0JztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0aGlzLnBlZWtLZXl3b3JkQXMoKSkge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIGNvbnN1bWUgYGFzYFxuICAgICAgICBuYW1lID0gcmF3S2V5O1xuICAgICAgICBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpOyAgLy8gcmVhZCBsb2NhbCB2YXIgbmFtZVxuICAgICAgICBpc1ZhciA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMubmV4dCAhPT0gRU9GICYmICF0aGlzLnBlZWtLZXl3b3JkTGV0KCkpIHtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIGNvbnN0IGFzdCA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0IC0gdGhpcy5vZmZzZXQsIHRoaXMuaW5wdXRJbmRleCAtIHRoaXMub2Zmc2V0KTtcbiAgICAgICAgZXhwcmVzc2lvbiA9XG4gICAgICAgICAgICBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIHNvdXJjZSwgdGhpcy5sb2NhdGlvbiwgdGhpcy5hYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICAgICAgfVxuXG4gICAgICBiaW5kaW5ncy5wdXNoKG5ldyBUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwga2V5LCBpc1ZhciwgbmFtZSwgZXhwcmVzc2lvbikpO1xuICAgICAgaWYgKHRoaXMucGVla0tleXdvcmRBcygpICYmICFpc1Zhcikge1xuICAgICAgICBjb25zdCBsZXRTdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zdW1lIGBhc2BcbiAgICAgICAgY29uc3QgbGV0TmFtZSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7ICAvLyByZWFkIGxvY2FsIHZhciBuYW1lXG4gICAgICAgIGJpbmRpbmdzLnB1c2gobmV3IFRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICAgIHRoaXMuc3BhbihsZXRTdGFydCksIHRoaXMuc291cmNlU3BhbihsZXRTdGFydCksIGxldE5hbWUsIHRydWUsIGtleSwgbnVsbCAhKSk7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgdGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpO1xuXG4gICAgcmV0dXJuIG5ldyBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdChiaW5kaW5ncywgd2FybmluZ3MsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgaW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCkge1xuICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlckVycm9yKG1lc3NhZ2UsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KGluZGV4KSwgdGhpcy5sb2NhdGlvbikpO1xuICAgIHRoaXMuc2tpcCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2NhdGlvblRleHQoaW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCkge1xuICAgIGlmIChpbmRleCA9PSBudWxsKSBpbmRleCA9IHRoaXMuaW5kZXg7XG4gICAgcmV0dXJuIChpbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkgPyBgYXQgY29sdW1uICR7dGhpcy50b2tlbnNbaW5kZXhdLmluZGV4ICsgMX0gaW5gIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBhdCB0aGUgZW5kIG9mIHRoZSBleHByZXNzaW9uYDtcbiAgfVxuXG4gIC8vIEVycm9yIHJlY292ZXJ5IHNob3VsZCBza2lwIHRva2VucyB1bnRpbCBpdCBlbmNvdW50ZXJzIGEgcmVjb3ZlcnkgcG9pbnQuIHNraXAoKSB0cmVhdHNcbiAgLy8gdGhlIGVuZCBvZiBpbnB1dCBhbmQgYSAnOycgYXMgdW5jb25kaXRpb25hbGx5IGEgcmVjb3ZlcnkgcG9pbnQuIEl0IGFsc28gdHJlYXRzICcpJyxcbiAgLy8gJ30nIGFuZCAnXScgYXMgY29uZGl0aW9uYWwgcmVjb3ZlcnkgcG9pbnRzIGlmIG9uZSBvZiBjYWxsaW5nIHByb2R1Y3Rpb25zIGlzIGV4cGVjdGluZ1xuICAvLyBvbmUgb2YgdGhlc2Ugc3ltYm9scy4gVGhpcyBhbGxvd3Mgc2tpcCgpIHRvIHJlY292ZXIgZnJvbSBlcnJvcnMgc3VjaCBhcyAnKGEuKSArIDEnIGFsbG93aW5nXG4gIC8vIG1vcmUgb2YgdGhlIEFTVCB0byBiZSByZXRhaW5lZCAoaXQgZG9lc24ndCBza2lwIGFueSB0b2tlbnMgYXMgdGhlICcpJyBpcyByZXRhaW5lZCBiZWNhdXNlXG4gIC8vIG9mIHRoZSAnKCcgYmVnaW5zIGFuICcoJyA8ZXhwcj4gJyknIHByb2R1Y3Rpb24pLiBUaGUgcmVjb3ZlcnkgcG9pbnRzIG9mIGdyb3VwaW5nIHN5bWJvbHNcbiAgLy8gbXVzdCBiZSBjb25kaXRpb25hbCBhcyB0aGV5IG11c3QgYmUgc2tpcHBlZCBpZiBub25lIG9mIHRoZSBjYWxsaW5nIHByb2R1Y3Rpb25zIGFyZSBub3RcbiAgLy8gZXhwZWN0aW5nIHRoZSBjbG9zaW5nIHRva2VuIGVsc2Ugd2Ugd2lsbCBuZXZlciBtYWtlIHByb2dyZXNzIGluIHRoZSBjYXNlIG9mIGFuXG4gIC8vIGV4dHJhbmVvdXMgZ3JvdXAgY2xvc2luZyBzeW1ib2wgKHN1Y2ggYXMgYSBzdHJheSAnKScpLiBUaGlzIGlzIG5vdCB0aGUgY2FzZSBmb3IgJzsnIGJlY2F1c2VcbiAgLy8gcGFyc2VDaGFpbigpIGlzIGFsd2F5cyB0aGUgcm9vdCBwcm9kdWN0aW9uIGFuZCBpdCBleHBlY3RzIGEgJzsnLlxuXG4gIC8vIElmIGEgcHJvZHVjdGlvbiBleHBlY3RzIG9uZSBvZiB0aGVzZSB0b2tlbiBpdCBpbmNyZW1lbnRzIHRoZSBjb3JyZXNwb25kaW5nIG5lc3RpbmcgY291bnQsXG4gIC8vIGFuZCB0aGVuIGRlY3JlbWVudHMgaXQganVzdCBwcmlvciB0byBjaGVja2luZyBpZiB0aGUgdG9rZW4gaXMgaW4gdGhlIGlucHV0LlxuICBwcml2YXRlIHNraXAoKSB7XG4gICAgbGV0IG4gPSB0aGlzLm5leHQ7XG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggJiYgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgJiZcbiAgICAgICAgICAgKHRoaXMucnBhcmVuc0V4cGVjdGVkIDw9IDAgfHwgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikpICYmXG4gICAgICAgICAgICh0aGlzLnJicmFjZXNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2tldHNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCkpKSB7XG4gICAgICBpZiAodGhpcy5uZXh0LmlzRXJyb3IoKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihcbiAgICAgICAgICAgIHRoaXMubmV4dC50b1N0cmluZygpICEsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KCksIHRoaXMubG9jYXRpb24pKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbiA9IHRoaXMubmV4dDtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgc3RhdGljIGNoZWNrKGFzdDogQVNUKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHMgPSBuZXcgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIoKTtcbiAgICBhc3QudmlzaXQocyk7XG4gICAgcmV0dXJuIHMuZXJyb3JzO1xuICB9XG5cbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3Q6IFNhZmVQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRGdW5jdGlvbkNhbGwoYXN0OiBGdW5jdGlvbkNhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdExpdGVyYWxBcnJheShhc3Q6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KSB7IHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zKTsgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSkgeyB0aGlzLnZpc2l0QWxsKGFzdC52YWx1ZXMpOyB9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KSB7IHRoaXMuZXJyb3JzLnB1c2goJ3BpcGVzJyk7IH1cblxuICB2aXNpdEtleWVkUmVhZChhc3Q6IEtleWVkUmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEFsbChhc3RzOiBhbnlbXSk6IGFueVtdIHsgcmV0dXJuIGFzdHMubWFwKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7IH1cblxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSkge31cbn1cbiJdfQ==