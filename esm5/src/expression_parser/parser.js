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
var defaultInterpolateRegExp = _createInterpolateRegExp(DEFAULT_INTERPOLATION_CONFIG);
function _getInterpolateRegExp(config) {
    if (config === DEFAULT_INTERPOLATION_CONFIG) {
        return defaultInterpolateRegExp;
    }
    else {
        return _createInterpolateRegExp(config);
    }
}
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
        var regexp = _getInterpolateRegExp(interpolationConfig);
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
                expressions.push('$implicit');
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
        var regexp = _getInterpolateRegExp(interpolationConfig);
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
                var nameStart = this.inputIndex;
                var name_1 = this.expectIdentifierOrKeyword();
                var nameSpan = this.span(nameStart);
                var args = [];
                while (this.optionalCharacter(chars.$COLON)) {
                    args.push(this.parseExpression());
                }
                var start = result.span.start;
                result =
                    new BindingPipe(this.span(start), this.sourceSpan(start), result, name_1, args, nameSpan);
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
                    new ASTWithSource(ast, source, this.location, this.absoluteOffset + start_1, this.errors);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssS0FBSyxNQUFNLFVBQVUsQ0FBQztBQUNsQyxPQUFPLEVBQUMsNEJBQTRCLEVBQXNCLE1BQU0sbUNBQW1DLENBQUM7QUFDcEcsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUVyQyxPQUFPLEVBQU0sYUFBYSxFQUFrQyxNQUFNLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFpQixnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDblosT0FBTyxFQUFDLEdBQUcsRUFBZ0IsU0FBUyxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFFNUU7SUFDRSw0QkFBbUIsT0FBaUIsRUFBUyxXQUFxQixFQUFTLE9BQWlCO1FBQXpFLFlBQU8sR0FBUCxPQUFPLENBQVU7UUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBVTtRQUFTLFlBQU8sR0FBUCxPQUFPLENBQVU7SUFBRyxDQUFDO0lBQ2xHLHlCQUFDO0FBQUQsQ0FBQyxBQUZELElBRUM7O0FBRUQ7SUFDRSxvQ0FDVyxnQkFBbUMsRUFBUyxRQUFrQixFQUM5RCxNQUFxQjtRQURyQixxQkFBZ0IsR0FBaEIsZ0JBQWdC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XG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoYXJzIGZyb20gJy4uL2NoYXJzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7ZXNjYXBlUmVnRXhwfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtBU1QsIEFTVFdpdGhTb3VyY2UsIEFic29sdXRlU291cmNlU3BhbiwgQXN0VmlzaXRvciwgQmluYXJ5LCBCaW5kaW5nUGlwZSwgQ2hhaW4sIENvbmRpdGlvbmFsLCBFbXB0eUV4cHIsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgS2V5ZWRSZWFkLCBLZXllZFdyaXRlLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxNYXBLZXksIExpdGVyYWxQcmltaXRpdmUsIE1ldGhvZENhbGwsIE5vbk51bGxBc3NlcnQsIFBhcnNlU3BhbiwgUGFyc2VyRXJyb3IsIFByZWZpeE5vdCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBRdW90ZSwgU2FmZU1ldGhvZENhbGwsIFNhZmVQcm9wZXJ0eVJlYWQsIFRlbXBsYXRlQmluZGluZ30gZnJvbSAnLi9hc3QnO1xuaW1wb3J0IHtFT0YsIExleGVyLCBUb2tlbiwgVG9rZW5UeXBlLCBpc0lkZW50aWZpZXIsIGlzUXVvdGV9IGZyb20gJy4vbGV4ZXInO1xuXG5leHBvcnQgY2xhc3MgU3BsaXRJbnRlcnBvbGF0aW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIHN0cmluZ3M6IHN0cmluZ1tdLCBwdWJsaWMgZXhwcmVzc2lvbnM6IHN0cmluZ1tdLCBwdWJsaWMgb2Zmc2V0czogbnVtYmVyW10pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHRlbXBsYXRlQmluZGluZ3M6IFRlbXBsYXRlQmluZGluZ1tdLCBwdWJsaWMgd2FybmluZ3M6IHN0cmluZ1tdLFxuICAgICAgcHVibGljIGVycm9yczogUGFyc2VyRXJyb3JbXSkge31cbn1cblxuY29uc3QgZGVmYXVsdEludGVycG9sYXRlUmVnRXhwID0gX2NyZWF0ZUludGVycG9sYXRlUmVnRXhwKERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpO1xuZnVuY3Rpb24gX2dldEludGVycG9sYXRlUmVnRXhwKGNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IFJlZ0V4cCB7XG4gIGlmIChjb25maWcgPT09IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpIHtcbiAgICByZXR1cm4gZGVmYXVsdEludGVycG9sYXRlUmVnRXhwO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBfY3JlYXRlSW50ZXJwb2xhdGVSZWdFeHAoY29uZmlnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfY3JlYXRlSW50ZXJwb2xhdGVSZWdFeHAoY29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogUmVnRXhwIHtcbiAgY29uc3QgcGF0dGVybiA9IGVzY2FwZVJlZ0V4cChjb25maWcuc3RhcnQpICsgJyhbXFxcXHNcXFxcU10qPyknICsgZXNjYXBlUmVnRXhwKGNvbmZpZy5lbmQpO1xuICByZXR1cm4gbmV3IFJlZ0V4cChwYXR0ZXJuLCAnZycpO1xufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VyIHtcbiAgcHJpdmF0ZSBlcnJvcnM6IFBhcnNlckVycm9yW10gPSBbXTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9sZXhlcjogTGV4ZXIpIHt9XG5cbiAgcGFyc2VBY3Rpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogYW55LCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICB0aGlzLl9jaGVja05vSW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCk7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUodGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCkpO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCB0cnVlLCB0aGlzLmVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICAucGFyc2VDaGFpbigpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHBhcnNlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwYXJzZVNpbXBsZUJpbmRpbmcoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUJpbmRpbmdBc3QoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3QgZXJyb3JzID0gU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIuY2hlY2soYXN0KTtcbiAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBIb3N0IGJpbmRpbmcgZXhwcmVzc2lvbiBjYW5ub3QgY29udGFpbiAke2Vycm9ycy5qb2luKCcgJyl9YCwgaW5wdXQsIGxvY2F0aW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3IobWVzc2FnZTogc3RyaW5nLCBpbnB1dDogc3RyaW5nLCBlcnJMb2NhdGlvbjogc3RyaW5nLCBjdHhMb2NhdGlvbj86IGFueSkge1xuICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlckVycm9yKG1lc3NhZ2UsIGlucHV0LCBlcnJMb2NhdGlvbiwgY3R4TG9jYXRpb24pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQmluZGluZ0FzdChcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogQVNUIHtcbiAgICAvLyBRdW90ZXMgZXhwcmVzc2lvbnMgdXNlIDNyZC1wYXJ0eSBleHByZXNzaW9uIGxhbmd1YWdlLiBXZSBkb24ndCB3YW50IHRvIHVzZVxuICAgIC8vIG91ciBsZXhlciBvciBwYXJzZXIgZm9yIHRoYXQsIHNvIHdlIGNoZWNrIGZvciB0aGF0IGFoZWFkIG9mIHRpbWUuXG4gICAgY29uc3QgcXVvdGUgPSB0aGlzLl9wYXJzZVF1b3RlKGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQpO1xuXG4gICAgaWYgKHF1b3RlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiBxdW90ZTtcbiAgICB9XG5cbiAgICB0aGlzLl9jaGVja05vSW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCk7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUoc291cmNlVG9MZXgpO1xuICAgIHJldHVybiBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsIGZhbHNlLCB0aGlzLmVycm9ycyxcbiAgICAgICAgICAgICAgIGlucHV0Lmxlbmd0aCAtIHNvdXJjZVRvTGV4Lmxlbmd0aClcbiAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUXVvdGUoaW5wdXQ6IHN0cmluZ3xudWxsLCBsb2NhdGlvbjogYW55LCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTogQVNUfG51bGwge1xuICAgIGlmIChpbnB1dCA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBwcmVmaXhTZXBhcmF0b3JJbmRleCA9IGlucHV0LmluZGV4T2YoJzonKTtcbiAgICBpZiAocHJlZml4U2VwYXJhdG9ySW5kZXggPT0gLTEpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHByZWZpeCA9IGlucHV0LnN1YnN0cmluZygwLCBwcmVmaXhTZXBhcmF0b3JJbmRleCkudHJpbSgpO1xuICAgIGlmICghaXNJZGVudGlmaWVyKHByZWZpeCkpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uID0gaW5wdXQuc3Vic3RyaW5nKHByZWZpeFNlcGFyYXRvckluZGV4ICsgMSk7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4oMCwgaW5wdXQubGVuZ3RoKTtcbiAgICByZXR1cm4gbmV3IFF1b3RlKFxuICAgICAgICBzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBwcmVmaXgsIHVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uLCBsb2NhdGlvbik7XG4gIH1cblxuICBwYXJzZVRlbXBsYXRlQmluZGluZ3ModHBsS2V5OiBzdHJpbmcsIHRwbFZhbHVlOiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOlxuICAgICAgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHRwbFZhbHVlKTtcbiAgICByZXR1cm4gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgIHRwbFZhbHVlLCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2VucywgdHBsVmFsdWUubGVuZ3RoLCBmYWxzZSwgdGhpcy5lcnJvcnMsIDApXG4gICAgICAgIC5wYXJzZVRlbXBsYXRlQmluZGluZ3ModHBsS2V5KTtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgY29uc3Qgc3BsaXQgPSB0aGlzLnNwbGl0SW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGlmIChzcGxpdCA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGV4cHJlc3Npb25zOiBBU1RbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGxpdC5leHByZXNzaW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgZXhwcmVzc2lvblRleHQgPSBzcGxpdC5leHByZXNzaW9uc1tpXTtcbiAgICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uVGV4dCk7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9ycywgc3BsaXQub2Zmc2V0c1tpXSArIChleHByZXNzaW9uVGV4dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpKVxuICAgICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgICBleHByZXNzaW9ucy5wdXNoKGFzdCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4oMCwgaW5wdXQgPT0gbnVsbCA/IDAgOiBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShcbiAgICAgICAgbmV3IEludGVycG9sYXRpb24oc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgc3BsaXQuc3RyaW5ncywgZXhwcmVzc2lvbnMpLCBpbnB1dCxcbiAgICAgICAgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBzcGxpdEludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBTcGxpdEludGVycG9sYXRpb25cbiAgICAgIHxudWxsIHtcbiAgICBjb25zdCByZWdleHAgPSBfZ2V0SW50ZXJwb2xhdGVSZWdFeHAoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3QgcGFydHMgPSBpbnB1dC5zcGxpdChyZWdleHApO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggPD0gMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHN0cmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZXhwcmVzc2lvbnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgb2Zmc2V0czogbnVtYmVyW10gPSBbXTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBwYXJ0OiBzdHJpbmcgPSBwYXJ0c1tpXTtcbiAgICAgIGlmIChpICUgMiA9PT0gMCkge1xuICAgICAgICAvLyBmaXhlZCBzdHJpbmdcbiAgICAgICAgc3RyaW5ncy5wdXNoKHBhcnQpO1xuICAgICAgICBvZmZzZXQgKz0gcGFydC5sZW5ndGg7XG4gICAgICB9IGVsc2UgaWYgKHBhcnQudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgb2Zmc2V0ICs9IGludGVycG9sYXRpb25Db25maWcuc3RhcnQubGVuZ3RoO1xuICAgICAgICBleHByZXNzaW9ucy5wdXNoKHBhcnQpO1xuICAgICAgICBvZmZzZXRzLnB1c2gob2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IHBhcnQubGVuZ3RoICsgaW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAnQmxhbmsgZXhwcmVzc2lvbnMgYXJlIG5vdCBhbGxvd2VkIGluIGludGVycG9sYXRlZCBzdHJpbmdzJywgaW5wdXQsXG4gICAgICAgICAgICBgYXQgY29sdW1uICR7dGhpcy5fZmluZEludGVycG9sYXRpb25FcnJvckNvbHVtbihwYXJ0cywgaSwgaW50ZXJwb2xhdGlvbkNvbmZpZyl9IGluYCxcbiAgICAgICAgICAgIGxvY2F0aW9uKTtcbiAgICAgICAgZXhwcmVzc2lvbnMucHVzaCgnJGltcGxpY2l0Jyk7XG4gICAgICAgIG9mZnNldHMucHVzaChvZmZzZXQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFNwbGl0SW50ZXJwb2xhdGlvbihzdHJpbmdzLCBleHByZXNzaW9ucywgb2Zmc2V0cyk7XG4gIH1cblxuICB3cmFwTGl0ZXJhbFByaW1pdGl2ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dCA9PSBudWxsID8gMCA6IGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBpbnB1dCksIGlucHV0LCBsb2NhdGlvbixcbiAgICAgICAgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0cmlwQ29tbWVudHMoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaSA9IHRoaXMuX2NvbW1lbnRTdGFydChpbnB1dCk7XG4gICAgcmV0dXJuIGkgIT0gbnVsbCA/IGlucHV0LnN1YnN0cmluZygwLCBpKS50cmltKCkgOiBpbnB1dDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbW1lbnRTdGFydChpbnB1dDogc3RyaW5nKTogbnVtYmVyfG51bGwge1xuICAgIGxldCBvdXRlclF1b3RlOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGNvbnN0IGNoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgY29uc3QgbmV4dENoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkgKyAxKTtcblxuICAgICAgaWYgKGNoYXIgPT09IGNoYXJzLiRTTEFTSCAmJiBuZXh0Q2hhciA9PSBjaGFycy4kU0xBU0ggJiYgb3V0ZXJRdW90ZSA9PSBudWxsKSByZXR1cm4gaTtcblxuICAgICAgaWYgKG91dGVyUXVvdGUgPT09IGNoYXIpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKG91dGVyUXVvdGUgPT0gbnVsbCAmJiBpc1F1b3RlKGNoYXIpKSB7XG4gICAgICAgIG91dGVyUXVvdGUgPSBjaGFyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrTm9JbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IHZvaWQge1xuICAgIGNvbnN0IHJlZ2V4cCA9IF9nZXRJbnRlcnBvbGF0ZVJlZ0V4cChpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBwYXJ0cyA9IGlucHV0LnNwbGl0KHJlZ2V4cCk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7aW50ZXJwb2xhdGlvbkNvbmZpZy5lbmR9KSB3aGVyZSBleHByZXNzaW9uIHdhcyBleHBlY3RlZGAsXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgYGF0IGNvbHVtbiAke3RoaXMuX2ZpbmRJbnRlcnBvbGF0aW9uRXJyb3JDb2x1bW4ocGFydHMsIDEsIGludGVycG9sYXRpb25Db25maWcpfSBpbmAsXG4gICAgICAgICAgbG9jYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRJbnRlcnBvbGF0aW9uRXJyb3JDb2x1bW4oXG4gICAgICBwYXJ0czogc3RyaW5nW10sIHBhcnRJbkVycklkeDogbnVtYmVyLCBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogbnVtYmVyIHtcbiAgICBsZXQgZXJyTG9jYXRpb24gPSAnJztcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBhcnRJbkVycklkeDsgaisrKSB7XG4gICAgICBlcnJMb2NhdGlvbiArPSBqICUgMiA9PT0gMCA/XG4gICAgICAgICAgcGFydHNbal0gOlxuICAgICAgICAgIGAke2ludGVycG9sYXRpb25Db25maWcuc3RhcnR9JHtwYXJ0c1tqXX0ke2ludGVycG9sYXRpb25Db25maWcuZW5kfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVyckxvY2F0aW9uLmxlbmd0aDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgX1BhcnNlQVNUIHtcbiAgcHJpdmF0ZSBycGFyZW5zRXhwZWN0ZWQgPSAwO1xuICBwcml2YXRlIHJicmFja2V0c0V4cGVjdGVkID0gMDtcbiAgcHJpdmF0ZSByYnJhY2VzRXhwZWN0ZWQgPSAwO1xuXG4gIC8vIENhY2hlIG9mIGV4cHJlc3Npb24gc3RhcnQgYW5kIGlucHV0IGluZGVjZXMgdG8gdGhlIGFic29sdXRlIHNvdXJjZSBzcGFuIHRoZXkgbWFwIHRvLCB1c2VkIHRvXG4gIC8vIHByZXZlbnQgY3JlYXRpbmcgc3VwZXJmbHVvdXMgc291cmNlIHNwYW5zIGluIGBzb3VyY2VTcGFuYC5cbiAgLy8gQSBzZXJpYWwgb2YgdGhlIGV4cHJlc3Npb24gc3RhcnQgYW5kIGlucHV0IGluZGV4IGlzIHVzZWQgZm9yIG1hcHBpbmcgYmVjYXVzZSBib3RoIGFyZSBzdGF0ZWZ1bFxuICAvLyBhbmQgbWF5IGNoYW5nZSBmb3Igc3Vic2VxdWVudCBleHByZXNzaW9ucyB2aXNpdGVkIGJ5IHRoZSBwYXJzZXIuXG4gIHByaXZhdGUgc291cmNlU3BhbkNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIEFic29sdXRlU291cmNlU3Bhbj4oKTtcblxuICBpbmRleDogbnVtYmVyID0gMDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBpbnB1dDogc3RyaW5nLCBwdWJsaWMgbG9jYXRpb246IGFueSwgcHVibGljIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBwdWJsaWMgdG9rZW5zOiBUb2tlbltdLCBwdWJsaWMgaW5wdXRMZW5ndGg6IG51bWJlciwgcHVibGljIHBhcnNlQWN0aW9uOiBib29sZWFuLFxuICAgICAgcHJpdmF0ZSBlcnJvcnM6IFBhcnNlckVycm9yW10sIHByaXZhdGUgb2Zmc2V0OiBudW1iZXIpIHt9XG5cbiAgcGVlayhvZmZzZXQ6IG51bWJlcik6IFRva2VuIHtcbiAgICBjb25zdCBpID0gdGhpcy5pbmRleCArIG9mZnNldDtcbiAgICByZXR1cm4gaSA8IHRoaXMudG9rZW5zLmxlbmd0aCA/IHRoaXMudG9rZW5zW2ldIDogRU9GO1xuICB9XG5cbiAgZ2V0IG5leHQoKTogVG9rZW4geyByZXR1cm4gdGhpcy5wZWVrKDApOyB9XG5cbiAgZ2V0IGlucHV0SW5kZXgoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID8gdGhpcy5uZXh0LmluZGV4ICsgdGhpcy5vZmZzZXQgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmlucHV0TGVuZ3RoICsgdGhpcy5vZmZzZXQ7XG4gIH1cblxuICBzcGFuKHN0YXJ0OiBudW1iZXIpIHsgcmV0dXJuIG5ldyBQYXJzZVNwYW4oc3RhcnQsIHRoaXMuaW5wdXRJbmRleCk7IH1cblxuICBzb3VyY2VTcGFuKHN0YXJ0OiBudW1iZXIpOiBBYnNvbHV0ZVNvdXJjZVNwYW4ge1xuICAgIGNvbnN0IHNlcmlhbCA9IGAke3N0YXJ0fUAke3RoaXMuaW5wdXRJbmRleH1gO1xuICAgIGlmICghdGhpcy5zb3VyY2VTcGFuQ2FjaGUuaGFzKHNlcmlhbCkpIHtcbiAgICAgIHRoaXMuc291cmNlU3BhbkNhY2hlLnNldChzZXJpYWwsIHRoaXMuc3BhbihzdGFydCkudG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNvdXJjZVNwYW5DYWNoZS5nZXQoc2VyaWFsKSAhO1xuICB9XG5cbiAgYWR2YW5jZSgpIHsgdGhpcy5pbmRleCsrOyB9XG5cbiAgb3B0aW9uYWxDaGFyYWN0ZXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3Rlcihjb2RlKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHBlZWtLZXl3b3JkTGV0KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5uZXh0LmlzS2V5d29yZExldCgpOyB9XG4gIHBlZWtLZXl3b3JkQXMoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLm5leHQuaXNLZXl3b3JkQXMoKTsgfVxuXG4gIGV4cGVjdENoYXJhY3Rlcihjb2RlOiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5vcHRpb25hbENoYXJhY3Rlcihjb2RlKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgJHtTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpfWApO1xuICB9XG5cbiAgb3B0aW9uYWxPcGVyYXRvcihvcDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMubmV4dC5pc09wZXJhdG9yKG9wKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGV4cGVjdE9wZXJhdG9yKG9wZXJhdG9yOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5vcHRpb25hbE9wZXJhdG9yKG9wZXJhdG9yKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgb3BlcmF0b3IgJHtvcGVyYXRvcn1gKTtcbiAgfVxuXG4gIGV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAke259LCBleHBlY3RlZCBpZGVudGlmaWVyIG9yIGtleXdvcmRgKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG4udG9TdHJpbmcoKSBhcyBzdHJpbmc7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSAmJiAhbi5pc1N0cmluZygpKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7bn0sIGV4cGVjdGVkIGlkZW50aWZpZXIsIGtleXdvcmQsIG9yIHN0cmluZ2ApO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbi50b1N0cmluZygpIGFzIHN0cmluZztcbiAgfVxuXG4gIHBhcnNlQ2hhaW4oKTogQVNUIHtcbiAgICBjb25zdCBleHByczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBleHBycy5wdXNoKGV4cHIpO1xuXG4gICAgICBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICBpZiAoIXRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5nIGV4cHJlc3Npb24gY2Fubm90IGNvbnRhaW4gY2hhaW5lZCBleHByZXNzaW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgfSAgLy8gcmVhZCBhbGwgc2VtaWNvbG9uc1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgdG9rZW4gJyR7dGhpcy5uZXh0fSdgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGV4cHJzLmxlbmd0aCA9PSAwKSByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICBpZiAoZXhwcnMubGVuZ3RoID09IDEpIHJldHVybiBleHByc1swXTtcbiAgICByZXR1cm4gbmV3IENoYWluKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGV4cHJzKTtcbiAgfVxuXG4gIHBhcnNlUGlwZSgpOiBBU1Qge1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgIGlmICh0aGlzLm9wdGlvbmFsT3BlcmF0b3IoJ3wnKSkge1xuICAgICAgaWYgKHRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgdGhpcy5lcnJvcignQ2Fubm90IGhhdmUgYSBwaXBlIGluIGFuIGFjdGlvbiBleHByZXNzaW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk7XG4gICAgICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zcGFuKG5hbWVTdGFydCk7XG4gICAgICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW107XG4gICAgICAgIHdoaWxlICh0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgICBhcmdzLnB1c2godGhpcy5wYXJzZUV4cHJlc3Npb24oKSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgbmV3IEJpbmRpbmdQaXBlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgbmFtZSwgYXJncywgbmFtZVNwYW4pO1xuICAgICAgfSB3aGlsZSAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCd8JykpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUV4cHJlc3Npb24oKTogQVNUIHsgcmV0dXJuIHRoaXMucGFyc2VDb25kaXRpb25hbCgpOyB9XG5cbiAgcGFyc2VDb25kaXRpb25hbCgpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsT3IoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbmFsT3BlcmF0b3IoJz8nKSkge1xuICAgICAgY29uc3QgeWVzID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIGxldCBubzogQVNUO1xuICAgICAgaWYgKCF0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgY29uc3QgZW5kID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgICAgIHRoaXMuZXJyb3IoYENvbmRpdGlvbmFsIGV4cHJlc3Npb24gJHtleHByZXNzaW9ufSByZXF1aXJlcyBhbGwgMyBleHByZXNzaW9uc2ApO1xuICAgICAgICBubyA9IG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBubyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgeWVzLCBubyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VMb2dpY2FsT3IoKTogQVNUIHtcbiAgICAvLyAnfHwnXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG4gICAgd2hpbGUgKHRoaXMub3B0aW9uYWxPcGVyYXRvcignfHwnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlTG9naWNhbEFuZCgpO1xuICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnfHwnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTG9naWNhbEFuZCgpOiBBU1Qge1xuICAgIC8vICcmJidcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG4gICAgd2hpbGUgKHRoaXMub3B0aW9uYWxPcGVyYXRvcignJiYnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlRXF1YWxpdHkoKTtcbiAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgJyYmJywgcmVzdWx0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUVxdWFsaXR5KCk6IEFTVCB7XG4gICAgLy8gJz09JywnIT0nLCc9PT0nLCchPT0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VSZWxhdGlvbmFsKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgY2FzZSAnIT0nOlxuICAgICAgICBjYXNlICchPT0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlUmVsYXRpb25hbCgpOiBBU1Qge1xuICAgIC8vICc8JywgJz4nLCAnPD0nLCAnPj0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgY2FzZSAnPic6XG4gICAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgY2FzZSAnPj0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUFkZGl0aXZlKCk6IEFTVCB7XG4gICAgLy8gJysnLCAnLSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJysnOlxuICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTXVsdGlwbGljYXRpdmUoKTogQVNUIHtcbiAgICAvLyAnKicsICclJywgJy8nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKic6XG4gICAgICAgIGNhc2UgJyUnOlxuICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZVByZWZpeCgpOiBBU1Qge1xuICAgIGlmICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBjb25zdCBsaXRlcmFsU3BhbiA9IG5ldyBQYXJzZVNwYW4oc3RhcnQsIHN0YXJ0KTtcbiAgICAgIGNvbnN0IGxpdGVyYWxTb3VyY2VTcGFuID0gbGl0ZXJhbFNwYW4udG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KTtcbiAgICAgIGxldCByZXN1bHQ6IEFTVDtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgQmluYXJ5KFxuICAgICAgICAgICAgICB0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnLScsIHJlc3VsdCxcbiAgICAgICAgICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUobGl0ZXJhbFNwYW4sIGxpdGVyYWxTb3VyY2VTcGFuLCAwKSk7XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IEJpbmFyeShcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsXG4gICAgICAgICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKGxpdGVyYWxTcGFuLCBsaXRlcmFsU291cmNlU3BhbiwgMCksIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByZWZpeE5vdCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYXJzZUNhbGxDaGFpbigpO1xuICB9XG5cbiAgcGFyc2VDYWxsQ2hhaW4oKTogQVNUIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByaW1hcnkoKTtcbiAgICBjb25zdCByZXN1bHRTdGFydCA9IHJlc3VsdC5zcGFuLnN0YXJ0O1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kUEVSSU9EKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgZmFsc2UpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWxPcGVyYXRvcignPy4nKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgdHJ1ZSk7XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBLZXllZFdyaXRlKFxuICAgICAgICAgICAgICB0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGtleSwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBLZXllZFJlYWQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBrZXkpO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgICBjb25zdCBhcmdzID0gdGhpcy5wYXJzZUNhbGxBcmd1bWVudHMoKTtcbiAgICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICAgIHJlc3VsdCA9XG4gICAgICAgICAgICBuZXcgRnVuY3Rpb25DYWxsKHRoaXMuc3BhbihyZXN1bHRTdGFydCksIHRoaXMuc291cmNlU3BhbihyZXN1bHRTdGFydCksIHJlc3VsdCwgYXJncyk7XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCchJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IE5vbk51bGxBc3NlcnQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0KTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZVByaW1hcnkoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBpZiAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkTnVsbCgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBudWxsKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFVuZGVmaW5lZCgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB2b2lkIDApO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkVHJ1ZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB0cnVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZEZhbHNlKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGZhbHNlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRoaXMoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IEltcGxpY2l0UmVjZWl2ZXIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgZWxlbWVudHMgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbkxpc3QoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxBcnJheSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBlbGVtZW50cyk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3RlcihjaGFycy4kTEJSQUNFKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VMaXRlcmFsTWFwKCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0lkZW50aWZpZXIoKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwoXG4gICAgICAgICAgbmV3IEltcGxpY2l0UmVjZWl2ZXIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSksIGZhbHNlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzTnVtYmVyKCkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5uZXh0LnRvTnVtYmVyKCk7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB2YWx1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc1N0cmluZygpKSB7XG4gICAgICBjb25zdCBsaXRlcmFsVmFsdWUgPSB0aGlzLm5leHQudG9TdHJpbmcoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGxpdGVyYWxWYWx1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPj0gdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIGVuZCBvZiBleHByZXNzaW9uOiAke3RoaXMuaW5wdXR9YCk7XG4gICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAke3RoaXMubmV4dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbkxpc3QodGVybWluYXRvcjogbnVtYmVyKTogQVNUW10ge1xuICAgIGNvbnN0IHJlc3VsdDogQVNUW10gPSBbXTtcbiAgICBpZiAoIXRoaXMubmV4dC5pc0NoYXJhY3Rlcih0ZXJtaW5hdG9yKSkge1xuICAgICAgZG8ge1xuICAgICAgICByZXN1bHQucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMub3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxpdGVyYWxNYXAoKTogTGl0ZXJhbE1hcCB7XG4gICAgY29uc3Qga2V5czogTGl0ZXJhbE1hcEtleVtdID0gW107XG4gICAgY29uc3QgdmFsdWVzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpO1xuICAgIGlmICghdGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkge1xuICAgICAgdGhpcy5yYnJhY2VzRXhwZWN0ZWQrKztcbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgcXVvdGVkID0gdGhpcy5uZXh0LmlzU3RyaW5nKCk7XG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICAgIGtleXMucHVzaCh7a2V5LCBxdW90ZWR9KTtcbiAgICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKTtcbiAgICAgICAgdmFsdWVzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICB9IHdoaWxlICh0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSkpO1xuICAgICAgdGhpcy5yYnJhY2VzRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IExpdGVyYWxNYXAodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwga2V5cywgdmFsdWVzKTtcbiAgfVxuXG4gIHBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlY2VpdmVyOiBBU1QsIGlzU2FmZTogYm9vbGVhbiA9IGZhbHNlKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHJlY2VpdmVyLnNwYW4uc3RhcnQ7XG4gICAgY29uc3QgaWQgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMucGFyc2VDYWxsQXJndW1lbnRzKCk7XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICBjb25zdCBzcGFuID0gdGhpcy5zcGFuKHN0YXJ0KTtcbiAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpO1xuICAgICAgcmV0dXJuIGlzU2FmZSA/IG5ldyBTYWZlTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpIDpcbiAgICAgICAgICAgICAgICAgICAgICBuZXcgTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpc1NhZmUpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignVGhlIFxcJz8uXFwnIG9wZXJhdG9yIGNhbm5vdCBiZSB1c2VkIGluIHRoZSBhc3NpZ25tZW50Jyk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBTYWZlUHJvcGVydHlSZWFkKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlY2VpdmVyLCBpZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgIGlmICghdGhpcy5wYXJzZUFjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZ3MgY2Fubm90IGNvbnRhaW4gYXNzaWdubWVudHMnKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVdyaXRlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlY2VpdmVyLCBpZCwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHNwYW4gPSB0aGlzLnNwYW4oc3RhcnQpO1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvcGVydHlSZWFkKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlY2VpdmVyLCBpZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZUNhbGxBcmd1bWVudHMoKTogQmluZGluZ1BpcGVbXSB7XG4gICAgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3RlcihjaGFycy4kUlBBUkVOKSkgcmV0dXJuIFtdO1xuICAgIGNvbnN0IHBvc2l0aW9uYWxzOiBBU1RbXSA9IFtdO1xuICAgIGRvIHtcbiAgICAgIHBvc2l0aW9uYWxzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgfSB3aGlsZSAodGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcG9zaXRpb25hbHMgYXMgQmluZGluZ1BpcGVbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBbiBpZGVudGlmaWVyLCBhIGtleXdvcmQsIGEgc3RyaW5nIHdpdGggYW4gb3B0aW9uYWwgYC1gIGluIGJldHdlZW4uXG4gICAqL1xuICBleHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTogc3RyaW5nIHtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgbGV0IG9wZXJhdG9yRm91bmQgPSBmYWxzZTtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTtcbiAgICAgIG9wZXJhdG9yRm91bmQgPSB0aGlzLm9wdGlvbmFsT3BlcmF0b3IoJy0nKTtcbiAgICAgIGlmIChvcGVyYXRvckZvdW5kKSB7XG4gICAgICAgIHJlc3VsdCArPSAnLSc7XG4gICAgICB9XG4gICAgfSB3aGlsZSAob3BlcmF0b3JGb3VuZCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LnRvU3RyaW5nKCk7XG4gIH1cblxuICAvLyBQYXJzZXMgdGhlIEFTVCBmb3IgYDxzb21lLXRhZyAqdHBsS2V5PUFTVD5gXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyh0cGxLZXk6IHN0cmluZyk6IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgICBsZXQgZmlyc3RCaW5kaW5nID0gdHJ1ZTtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICBkbyB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgIGxldCByYXdLZXk6IHN0cmluZztcbiAgICAgIGxldCBrZXk6IHN0cmluZztcbiAgICAgIGxldCBpc1ZhcjogYm9vbGVhbiA9IGZhbHNlO1xuICAgICAgaWYgKGZpcnN0QmluZGluZykge1xuICAgICAgICByYXdLZXkgPSBrZXkgPSB0cGxLZXk7XG4gICAgICAgIGZpcnN0QmluZGluZyA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaXNWYXIgPSB0aGlzLnBlZWtLZXl3b3JkTGV0KCk7XG4gICAgICAgIGlmIChpc1ZhcikgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIHJhd0tleSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgICAgIGtleSA9IGlzVmFyID8gcmF3S2V5IDogdHBsS2V5ICsgcmF3S2V5WzBdLnRvVXBwZXJDYXNlKCkgKyByYXdLZXkuc3Vic3RyaW5nKDEpO1xuICAgICAgICB0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7XG4gICAgICB9XG5cbiAgICAgIGxldCBuYW1lOiBzdHJpbmcgPSBudWxsICE7XG4gICAgICBsZXQgZXhwcmVzc2lvbjogQVNUV2l0aFNvdXJjZXxudWxsID0gbnVsbDtcbiAgICAgIGlmIChpc1Zhcikge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICBuYW1lID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuYW1lID0gJ1xcJGltcGxpY2l0JztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0aGlzLnBlZWtLZXl3b3JkQXMoKSkge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIGNvbnN1bWUgYGFzYFxuICAgICAgICBuYW1lID0gcmF3S2V5O1xuICAgICAgICBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpOyAgLy8gcmVhZCBsb2NhbCB2YXIgbmFtZVxuICAgICAgICBpc1ZhciA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMubmV4dCAhPT0gRU9GICYmICF0aGlzLnBlZWtLZXl3b3JkTGV0KCkpIHtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIGNvbnN0IGFzdCA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0IC0gdGhpcy5vZmZzZXQsIHRoaXMuaW5wdXRJbmRleCAtIHRoaXMub2Zmc2V0KTtcbiAgICAgICAgZXhwcmVzc2lvbiA9XG4gICAgICAgICAgICBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIHNvdXJjZSwgdGhpcy5sb2NhdGlvbiwgdGhpcy5hYnNvbHV0ZU9mZnNldCArIHN0YXJ0LCB0aGlzLmVycm9ycyk7XG4gICAgICB9XG5cbiAgICAgIGJpbmRpbmdzLnB1c2gobmV3IFRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICB0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBrZXksIGlzVmFyLCBuYW1lLCBleHByZXNzaW9uKSk7XG4gICAgICBpZiAodGhpcy5wZWVrS2V5d29yZEFzKCkgJiYgIWlzVmFyKSB7XG4gICAgICAgIGNvbnN0IGxldFN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnN1bWUgYGFzYFxuICAgICAgICBjb25zdCBsZXROYW1lID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTsgIC8vIHJlYWQgbG9jYWwgdmFyIG5hbWVcbiAgICAgICAgYmluZGluZ3MucHVzaChuZXcgVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgICAgdGhpcy5zcGFuKGxldFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKGxldFN0YXJ0KSwgbGV0TmFtZSwgdHJ1ZSwga2V5LCBudWxsICEpKTtcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5vcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICB0aGlzLm9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSk7XG4gICAgICB9XG4gICAgfSB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCk7XG5cbiAgICByZXR1cm4gbmV3IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0KGJpbmRpbmdzLCB3YXJuaW5ncywgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgZXJyb3IobWVzc2FnZTogc3RyaW5nLCBpbmRleDogbnVtYmVyfG51bGwgPSBudWxsKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VyRXJyb3IobWVzc2FnZSwgdGhpcy5pbnB1dCwgdGhpcy5sb2NhdGlvblRleHQoaW5kZXgpLCB0aGlzLmxvY2F0aW9uKSk7XG4gICAgdGhpcy5za2lwKCk7XG4gIH1cblxuICBwcml2YXRlIGxvY2F0aW9uVGV4dChpbmRleDogbnVtYmVyfG51bGwgPSBudWxsKSB7XG4gICAgaWYgKGluZGV4ID09IG51bGwpIGluZGV4ID0gdGhpcy5pbmRleDtcbiAgICByZXR1cm4gKGluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSA/IGBhdCBjb2x1bW4gJHt0aGlzLnRva2Vuc1tpbmRleF0uaW5kZXggKyAxfSBpbmAgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYGF0IHRoZSBlbmQgb2YgdGhlIGV4cHJlc3Npb25gO1xuICB9XG5cbiAgLy8gRXJyb3IgcmVjb3Zlcnkgc2hvdWxkIHNraXAgdG9rZW5zIHVudGlsIGl0IGVuY291bnRlcnMgYSByZWNvdmVyeSBwb2ludC4gc2tpcCgpIHRyZWF0c1xuICAvLyB0aGUgZW5kIG9mIGlucHV0IGFuZCBhICc7JyBhcyB1bmNvbmRpdGlvbmFsbHkgYSByZWNvdmVyeSBwb2ludC4gSXQgYWxzbyB0cmVhdHMgJyknLFxuICAvLyAnfScgYW5kICddJyBhcyBjb25kaXRpb25hbCByZWNvdmVyeSBwb2ludHMgaWYgb25lIG9mIGNhbGxpbmcgcHJvZHVjdGlvbnMgaXMgZXhwZWN0aW5nXG4gIC8vIG9uZSBvZiB0aGVzZSBzeW1ib2xzLiBUaGlzIGFsbG93cyBza2lwKCkgdG8gcmVjb3ZlciBmcm9tIGVycm9ycyBzdWNoIGFzICcoYS4pICsgMScgYWxsb3dpbmdcbiAgLy8gbW9yZSBvZiB0aGUgQVNUIHRvIGJlIHJldGFpbmVkIChpdCBkb2Vzbid0IHNraXAgYW55IHRva2VucyBhcyB0aGUgJyknIGlzIHJldGFpbmVkIGJlY2F1c2VcbiAgLy8gb2YgdGhlICcoJyBiZWdpbnMgYW4gJygnIDxleHByPiAnKScgcHJvZHVjdGlvbikuIFRoZSByZWNvdmVyeSBwb2ludHMgb2YgZ3JvdXBpbmcgc3ltYm9sc1xuICAvLyBtdXN0IGJlIGNvbmRpdGlvbmFsIGFzIHRoZXkgbXVzdCBiZSBza2lwcGVkIGlmIG5vbmUgb2YgdGhlIGNhbGxpbmcgcHJvZHVjdGlvbnMgYXJlIG5vdFxuICAvLyBleHBlY3RpbmcgdGhlIGNsb3NpbmcgdG9rZW4gZWxzZSB3ZSB3aWxsIG5ldmVyIG1ha2UgcHJvZ3Jlc3MgaW4gdGhlIGNhc2Ugb2YgYW5cbiAgLy8gZXh0cmFuZW91cyBncm91cCBjbG9zaW5nIHN5bWJvbCAoc3VjaCBhcyBhIHN0cmF5ICcpJykuIFRoaXMgaXMgbm90IHRoZSBjYXNlIGZvciAnOycgYmVjYXVzZVxuICAvLyBwYXJzZUNoYWluKCkgaXMgYWx3YXlzIHRoZSByb290IHByb2R1Y3Rpb24gYW5kIGl0IGV4cGVjdHMgYSAnOycuXG5cbiAgLy8gSWYgYSBwcm9kdWN0aW9uIGV4cGVjdHMgb25lIG9mIHRoZXNlIHRva2VuIGl0IGluY3JlbWVudHMgdGhlIGNvcnJlc3BvbmRpbmcgbmVzdGluZyBjb3VudCxcbiAgLy8gYW5kIHRoZW4gZGVjcmVtZW50cyBpdCBqdXN0IHByaW9yIHRvIGNoZWNraW5nIGlmIHRoZSB0b2tlbiBpcyBpbiB0aGUgaW5wdXQuXG4gIHByaXZhdGUgc2tpcCgpIHtcbiAgICBsZXQgbiA9IHRoaXMubmV4dDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCAmJiAhbi5pc0NoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSAmJlxuICAgICAgICAgICAodGhpcy5ycGFyZW5zRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUlBBUkVOKSkgJiZcbiAgICAgICAgICAgKHRoaXMucmJyYWNlc0V4cGVjdGVkIDw9IDAgfHwgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSkpICYmXG4gICAgICAgICAgICh0aGlzLnJicmFja2V0c0V4cGVjdGVkIDw9IDAgfHwgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDS0VUKSkpIHtcbiAgICAgIGlmICh0aGlzLm5leHQuaXNFcnJvcigpKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlckVycm9yKFxuICAgICAgICAgICAgdGhpcy5uZXh0LnRvU3RyaW5nKCkgISwgdGhpcy5pbnB1dCwgdGhpcy5sb2NhdGlvblRleHQoKSwgdGhpcy5sb2NhdGlvbikpO1xuICAgICAgfVxuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBuID0gdGhpcy5uZXh0O1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICBzdGF0aWMgY2hlY2soYXN0OiBBU1QpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgcyA9IG5ldyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlcigpO1xuICAgIGFzdC52aXNpdChzKTtcbiAgICByZXR1cm4gcy5lcnJvcnM7XG4gIH1cblxuICBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpIHsgdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpOyB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KSB7IHRoaXMudmlzaXRBbGwoYXN0LnZhbHVlcyk7IH1cblxuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpIHsgdGhpcy5lcnJvcnMucHVzaCgncGlwZXMnKTsgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0QWxsKGFzdHM6IGFueVtdKTogYW55W10geyByZXR1cm4gYXN0cy5tYXAobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTsgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UXVvdGUoYXN0OiBRdW90ZSwgY29udGV4dDogYW55KSB7fVxufVxuIl19