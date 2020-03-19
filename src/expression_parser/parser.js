/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/expression_parser/parser", ["require", "exports", "tslib", "@angular/compiler/src/chars", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/util", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/expression_parser/lexer"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var chars = require("@angular/compiler/src/chars");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var util_1 = require("@angular/compiler/src/util");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var lexer_1 = require("@angular/compiler/src/expression_parser/lexer");
    var SplitInterpolation = /** @class */ (function () {
        function SplitInterpolation(strings, expressions, offsets) {
            this.strings = strings;
            this.expressions = expressions;
            this.offsets = offsets;
        }
        return SplitInterpolation;
    }());
    exports.SplitInterpolation = SplitInterpolation;
    var TemplateBindingParseResult = /** @class */ (function () {
        function TemplateBindingParseResult(templateBindings, warnings, errors) {
            this.templateBindings = templateBindings;
            this.warnings = warnings;
            this.errors = errors;
        }
        return TemplateBindingParseResult;
    }());
    exports.TemplateBindingParseResult = TemplateBindingParseResult;
    var defaultInterpolateRegExp = _createInterpolateRegExp(interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG);
    function _getInterpolateRegExp(config) {
        if (config === interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG) {
            return defaultInterpolateRegExp;
        }
        else {
            return _createInterpolateRegExp(config);
        }
    }
    function _createInterpolateRegExp(config) {
        var pattern = util_1.escapeRegExp(config.start) + '([\\s\\S]*?)' + util_1.escapeRegExp(config.end);
        return new RegExp(pattern, 'g');
    }
    var Parser = /** @class */ (function () {
        function Parser(_lexer) {
            this._lexer = _lexer;
            this.errors = [];
            this.simpleExpressionChecker = SimpleExpressionChecker;
        }
        Parser.prototype.parseAction = function (input, location, absoluteOffset, interpolationConfig) {
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
            this._checkNoInterpolation(input, location, interpolationConfig);
            var sourceToLex = this._stripComments(input);
            var tokens = this._lexer.tokenize(this._stripComments(input));
            var ast = new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, true, this.errors, input.length - sourceToLex.length)
                .parseChain();
            return new ast_1.ASTWithSource(ast, input, location, absoluteOffset, this.errors);
        };
        Parser.prototype.parseBinding = function (input, location, absoluteOffset, interpolationConfig) {
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
            var ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
            return new ast_1.ASTWithSource(ast, input, location, absoluteOffset, this.errors);
        };
        Parser.prototype.checkSimpleExpression = function (ast) {
            var checker = new this.simpleExpressionChecker();
            ast.visit(checker);
            return checker.errors;
        };
        Parser.prototype.parseSimpleBinding = function (input, location, absoluteOffset, interpolationConfig) {
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
            var ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
            var errors = this.checkSimpleExpression(ast);
            if (errors.length > 0) {
                this._reportError("Host binding expression cannot contain " + errors.join(' '), input, location);
            }
            return new ast_1.ASTWithSource(ast, input, location, absoluteOffset, this.errors);
        };
        Parser.prototype._reportError = function (message, input, errLocation, ctxLocation) {
            this.errors.push(new ast_1.ParserError(message, input, errLocation, ctxLocation));
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
            if (!lexer_1.isIdentifier(prefix))
                return null;
            var uninterpretedExpression = input.substring(prefixSeparatorIndex + 1);
            var span = new ast_1.ParseSpan(0, input.length);
            return new ast_1.Quote(span, span.toAbsolute(absoluteOffset), prefix, uninterpretedExpression, location);
        };
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
        Parser.prototype.parseTemplateBindings = function (templateKey, templateValue, templateUrl, absoluteKeyOffset, absoluteValueOffset) {
            var tokens = this._lexer.tokenize(templateValue);
            var parser = new _ParseAST(templateValue, templateUrl, absoluteValueOffset, tokens, templateValue.length, false /* parseAction */, this.errors, 0 /* relative offset */);
            return parser.parseTemplateBindings({
                source: templateKey,
                span: new ast_1.AbsoluteSourceSpan(absoluteKeyOffset, absoluteKeyOffset + templateKey.length),
            });
        };
        Parser.prototype.parseInterpolation = function (input, location, absoluteOffset, interpolationConfig) {
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
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
            var span = new ast_1.ParseSpan(0, input == null ? 0 : input.length);
            return new ast_1.ASTWithSource(new ast_1.Interpolation(span, span.toAbsolute(absoluteOffset), split.strings, expressions), input, location, absoluteOffset, this.errors);
        };
        Parser.prototype.splitInterpolation = function (input, location, interpolationConfig) {
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
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
            var span = new ast_1.ParseSpan(0, input == null ? 0 : input.length);
            return new ast_1.ASTWithSource(new ast_1.LiteralPrimitive(span, span.toAbsolute(absoluteOffset), input), input, location, absoluteOffset, this.errors);
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
                else if (outerQuote == null && lexer_1.isQuote(char)) {
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
    exports.Parser = Parser;
    var IvyParser = /** @class */ (function (_super) {
        tslib_1.__extends(IvyParser, _super);
        function IvyParser() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.simpleExpressionChecker = IvySimpleExpressionChecker; //
            return _this;
        }
        return IvyParser;
    }(Parser));
    exports.IvyParser = IvyParser;
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
            return i < this.tokens.length ? this.tokens[i] : lexer_1.EOF;
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
        Object.defineProperty(_ParseAST.prototype, "currentAbsoluteOffset", {
            /**
             * Returns the absolute offset of the start of the current token.
             */
            get: function () { return this.absoluteOffset + this.inputIndex; },
            enumerable: true,
            configurable: true
        });
        _ParseAST.prototype.span = function (start) { return new ast_1.ParseSpan(start, this.inputIndex); };
        _ParseAST.prototype.sourceSpan = function (start) {
            var serial = start + "@" + this.inputIndex;
            if (!this.sourceSpanCache.has(serial)) {
                this.sourceSpanCache.set(serial, this.span(start).toAbsolute(this.absoluteOffset));
            }
            return this.sourceSpanCache.get(serial);
        };
        _ParseAST.prototype.advance = function () { this.index++; };
        _ParseAST.prototype.consumeOptionalCharacter = function (code) {
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
            if (this.consumeOptionalCharacter(code))
                return;
            this.error("Missing expected " + String.fromCharCode(code));
        };
        _ParseAST.prototype.consumeOptionalOperator = function (op) {
            if (this.next.isOperator(op)) {
                this.advance();
                return true;
            }
            else {
                return false;
            }
        };
        _ParseAST.prototype.expectOperator = function (operator) {
            if (this.consumeOptionalOperator(operator))
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
                if (this.consumeOptionalCharacter(chars.$SEMICOLON)) {
                    if (!this.parseAction) {
                        this.error('Binding expression cannot contain chained expression');
                    }
                    while (this.consumeOptionalCharacter(chars.$SEMICOLON)) {
                    } // read all semicolons
                }
                else if (this.index < this.tokens.length) {
                    this.error("Unexpected token '" + this.next + "'");
                }
            }
            if (exprs.length == 0)
                return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
            if (exprs.length == 1)
                return exprs[0];
            return new ast_1.Chain(this.span(start), this.sourceSpan(start), exprs);
        };
        _ParseAST.prototype.parsePipe = function () {
            var result = this.parseExpression();
            if (this.consumeOptionalOperator('|')) {
                if (this.parseAction) {
                    this.error('Cannot have a pipe in an action expression');
                }
                do {
                    var nameStart = this.inputIndex;
                    var name_1 = this.expectIdentifierOrKeyword();
                    var nameSpan = this.sourceSpan(nameStart);
                    var args = [];
                    while (this.consumeOptionalCharacter(chars.$COLON)) {
                        args.push(this.parseExpression());
                    }
                    var start = result.span.start;
                    result =
                        new ast_1.BindingPipe(this.span(start), this.sourceSpan(start), result, name_1, args, nameSpan);
                } while (this.consumeOptionalOperator('|'));
            }
            return result;
        };
        _ParseAST.prototype.parseExpression = function () { return this.parseConditional(); };
        _ParseAST.prototype.parseConditional = function () {
            var start = this.inputIndex;
            var result = this.parseLogicalOr();
            if (this.consumeOptionalOperator('?')) {
                var yes = this.parsePipe();
                var no = void 0;
                if (!this.consumeOptionalCharacter(chars.$COLON)) {
                    var end = this.inputIndex;
                    var expression = this.input.substring(start, end);
                    this.error("Conditional expression " + expression + " requires all 3 expressions");
                    no = new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
                }
                else {
                    no = this.parsePipe();
                }
                return new ast_1.Conditional(this.span(start), this.sourceSpan(start), result, yes, no);
            }
            else {
                return result;
            }
        };
        _ParseAST.prototype.parseLogicalOr = function () {
            // '||'
            var result = this.parseLogicalAnd();
            while (this.consumeOptionalOperator('||')) {
                var right = this.parseLogicalAnd();
                var start = result.span.start;
                result = new ast_1.Binary(this.span(start), this.sourceSpan(start), '||', result, right);
            }
            return result;
        };
        _ParseAST.prototype.parseLogicalAnd = function () {
            // '&&'
            var result = this.parseEquality();
            while (this.consumeOptionalOperator('&&')) {
                var right = this.parseEquality();
                var start = result.span.start;
                result = new ast_1.Binary(this.span(start), this.sourceSpan(start), '&&', result, right);
            }
            return result;
        };
        _ParseAST.prototype.parseEquality = function () {
            // '==','!=','===','!=='
            var result = this.parseRelational();
            while (this.next.type == lexer_1.TokenType.Operator) {
                var operator = this.next.strValue;
                switch (operator) {
                    case '==':
                    case '===':
                    case '!=':
                    case '!==':
                        this.advance();
                        var right = this.parseRelational();
                        var start = result.span.start;
                        result = new ast_1.Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                        continue;
                }
                break;
            }
            return result;
        };
        _ParseAST.prototype.parseRelational = function () {
            // '<', '>', '<=', '>='
            var result = this.parseAdditive();
            while (this.next.type == lexer_1.TokenType.Operator) {
                var operator = this.next.strValue;
                switch (operator) {
                    case '<':
                    case '>':
                    case '<=':
                    case '>=':
                        this.advance();
                        var right = this.parseAdditive();
                        var start = result.span.start;
                        result = new ast_1.Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                        continue;
                }
                break;
            }
            return result;
        };
        _ParseAST.prototype.parseAdditive = function () {
            // '+', '-'
            var result = this.parseMultiplicative();
            while (this.next.type == lexer_1.TokenType.Operator) {
                var operator = this.next.strValue;
                switch (operator) {
                    case '+':
                    case '-':
                        this.advance();
                        var right = this.parseMultiplicative();
                        var start = result.span.start;
                        result = new ast_1.Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                        continue;
                }
                break;
            }
            return result;
        };
        _ParseAST.prototype.parseMultiplicative = function () {
            // '*', '%', '/'
            var result = this.parsePrefix();
            while (this.next.type == lexer_1.TokenType.Operator) {
                var operator = this.next.strValue;
                switch (operator) {
                    case '*':
                    case '%':
                    case '/':
                        this.advance();
                        var right = this.parsePrefix();
                        var start = result.span.start;
                        result = new ast_1.Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                        continue;
                }
                break;
            }
            return result;
        };
        _ParseAST.prototype.parsePrefix = function () {
            if (this.next.type == lexer_1.TokenType.Operator) {
                var start = this.inputIndex;
                var operator = this.next.strValue;
                var literalSpan = new ast_1.ParseSpan(start, start);
                var literalSourceSpan = literalSpan.toAbsolute(this.absoluteOffset);
                var result = void 0;
                switch (operator) {
                    case '+':
                        this.advance();
                        result = this.parsePrefix();
                        return new ast_1.Binary(this.span(start), this.sourceSpan(start), '-', result, new ast_1.LiteralPrimitive(literalSpan, literalSourceSpan, 0));
                    case '-':
                        this.advance();
                        result = this.parsePrefix();
                        return new ast_1.Binary(this.span(start), this.sourceSpan(start), operator, new ast_1.LiteralPrimitive(literalSpan, literalSourceSpan, 0), result);
                    case '!':
                        this.advance();
                        result = this.parsePrefix();
                        return new ast_1.PrefixNot(this.span(start), this.sourceSpan(start), result);
                }
            }
            return this.parseCallChain();
        };
        _ParseAST.prototype.parseCallChain = function () {
            var result = this.parsePrimary();
            var resultStart = result.span.start;
            while (true) {
                if (this.consumeOptionalCharacter(chars.$PERIOD)) {
                    result = this.parseAccessMemberOrMethodCall(result, false);
                }
                else if (this.consumeOptionalOperator('?.')) {
                    result = this.parseAccessMemberOrMethodCall(result, true);
                }
                else if (this.consumeOptionalCharacter(chars.$LBRACKET)) {
                    this.rbracketsExpected++;
                    var key = this.parsePipe();
                    this.rbracketsExpected--;
                    this.expectCharacter(chars.$RBRACKET);
                    if (this.consumeOptionalOperator('=')) {
                        var value = this.parseConditional();
                        result = new ast_1.KeyedWrite(this.span(resultStart), this.sourceSpan(resultStart), result, key, value);
                    }
                    else {
                        result = new ast_1.KeyedRead(this.span(resultStart), this.sourceSpan(resultStart), result, key);
                    }
                }
                else if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                    this.rparensExpected++;
                    var args = this.parseCallArguments();
                    this.rparensExpected--;
                    this.expectCharacter(chars.$RPAREN);
                    result =
                        new ast_1.FunctionCall(this.span(resultStart), this.sourceSpan(resultStart), result, args);
                }
                else if (this.consumeOptionalOperator('!')) {
                    result = new ast_1.NonNullAssert(this.span(resultStart), this.sourceSpan(resultStart), result);
                }
                else {
                    return result;
                }
            }
        };
        _ParseAST.prototype.parsePrimary = function () {
            var start = this.inputIndex;
            if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                this.rparensExpected++;
                var result = this.parsePipe();
                this.rparensExpected--;
                this.expectCharacter(chars.$RPAREN);
                return result;
            }
            else if (this.next.isKeywordNull()) {
                this.advance();
                return new ast_1.LiteralPrimitive(this.span(start), this.sourceSpan(start), null);
            }
            else if (this.next.isKeywordUndefined()) {
                this.advance();
                return new ast_1.LiteralPrimitive(this.span(start), this.sourceSpan(start), void 0);
            }
            else if (this.next.isKeywordTrue()) {
                this.advance();
                return new ast_1.LiteralPrimitive(this.span(start), this.sourceSpan(start), true);
            }
            else if (this.next.isKeywordFalse()) {
                this.advance();
                return new ast_1.LiteralPrimitive(this.span(start), this.sourceSpan(start), false);
            }
            else if (this.next.isKeywordThis()) {
                this.advance();
                return new ast_1.ImplicitReceiver(this.span(start), this.sourceSpan(start));
            }
            else if (this.consumeOptionalCharacter(chars.$LBRACKET)) {
                this.rbracketsExpected++;
                var elements = this.parseExpressionList(chars.$RBRACKET);
                this.rbracketsExpected--;
                this.expectCharacter(chars.$RBRACKET);
                return new ast_1.LiteralArray(this.span(start), this.sourceSpan(start), elements);
            }
            else if (this.next.isCharacter(chars.$LBRACE)) {
                return this.parseLiteralMap();
            }
            else if (this.next.isIdentifier()) {
                return this.parseAccessMemberOrMethodCall(new ast_1.ImplicitReceiver(this.span(start), this.sourceSpan(start)), false);
            }
            else if (this.next.isNumber()) {
                var value = this.next.toNumber();
                this.advance();
                return new ast_1.LiteralPrimitive(this.span(start), this.sourceSpan(start), value);
            }
            else if (this.next.isString()) {
                var literalValue = this.next.toString();
                this.advance();
                return new ast_1.LiteralPrimitive(this.span(start), this.sourceSpan(start), literalValue);
            }
            else if (this.index >= this.tokens.length) {
                this.error("Unexpected end of expression: " + this.input);
                return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
            }
            else {
                this.error("Unexpected token " + this.next);
                return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
            }
        };
        _ParseAST.prototype.parseExpressionList = function (terminator) {
            var result = [];
            if (!this.next.isCharacter(terminator)) {
                do {
                    result.push(this.parsePipe());
                } while (this.consumeOptionalCharacter(chars.$COMMA));
            }
            return result;
        };
        _ParseAST.prototype.parseLiteralMap = function () {
            var keys = [];
            var values = [];
            var start = this.inputIndex;
            this.expectCharacter(chars.$LBRACE);
            if (!this.consumeOptionalCharacter(chars.$RBRACE)) {
                this.rbracesExpected++;
                do {
                    var quoted = this.next.isString();
                    var key = this.expectIdentifierOrKeywordOrString();
                    keys.push({ key: key, quoted: quoted });
                    this.expectCharacter(chars.$COLON);
                    values.push(this.parsePipe());
                } while (this.consumeOptionalCharacter(chars.$COMMA));
                this.rbracesExpected--;
                this.expectCharacter(chars.$RBRACE);
            }
            return new ast_1.LiteralMap(this.span(start), this.sourceSpan(start), keys, values);
        };
        _ParseAST.prototype.parseAccessMemberOrMethodCall = function (receiver, isSafe) {
            if (isSafe === void 0) { isSafe = false; }
            var start = receiver.span.start;
            var id = this.expectIdentifierOrKeyword();
            if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                this.rparensExpected++;
                var args = this.parseCallArguments();
                this.expectCharacter(chars.$RPAREN);
                this.rparensExpected--;
                var span = this.span(start);
                var sourceSpan = this.sourceSpan(start);
                return isSafe ? new ast_1.SafeMethodCall(span, sourceSpan, receiver, id, args) :
                    new ast_1.MethodCall(span, sourceSpan, receiver, id, args);
            }
            else {
                if (isSafe) {
                    if (this.consumeOptionalOperator('=')) {
                        this.error('The \'?.\' operator cannot be used in the assignment');
                        return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
                    }
                    else {
                        return new ast_1.SafePropertyRead(this.span(start), this.sourceSpan(start), receiver, id);
                    }
                }
                else {
                    if (this.consumeOptionalOperator('=')) {
                        if (!this.parseAction) {
                            this.error('Bindings cannot contain assignments');
                            return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
                        }
                        var value = this.parseConditional();
                        return new ast_1.PropertyWrite(this.span(start), this.sourceSpan(start), receiver, id, value);
                    }
                    else {
                        var span = this.span(start);
                        return new ast_1.PropertyRead(this.span(start), this.sourceSpan(start), receiver, id);
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
            } while (this.consumeOptionalCharacter(chars.$COMMA));
            return positionals;
        };
        /**
         * Parses an identifier, a keyword, a string with an optional `-` in between,
         * and returns the string along with its absolute source span.
         */
        _ParseAST.prototype.expectTemplateBindingKey = function () {
            var result = '';
            var operatorFound = false;
            var start = this.currentAbsoluteOffset;
            do {
                result += this.expectIdentifierOrKeywordOrString();
                operatorFound = this.consumeOptionalOperator('-');
                if (operatorFound) {
                    result += '-';
                }
            } while (operatorFound);
            return {
                source: result,
                span: new ast_1.AbsoluteSourceSpan(start, start + result.length),
            };
        };
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
        _ParseAST.prototype.parseTemplateBindings = function (templateKey) {
            var bindings = [];
            // The first binding is for the template key itself
            // In *ngFor="let item of items", key = "ngFor", value = null
            // In *ngIf="cond | pipe", key = "ngIf", value = "cond | pipe"
            bindings.push.apply(bindings, tslib_1.__spread(this.parseDirectiveKeywordBindings(templateKey)));
            while (this.index < this.tokens.length) {
                // If it starts with 'let', then this must be variable declaration
                var letBinding = this.parseLetBinding();
                if (letBinding) {
                    bindings.push(letBinding);
                }
                else {
                    // Two possible cases here, either `value "as" key` or
                    // "directive-keyword expression". We don't know which case, but both
                    // "value" and "directive-keyword" are template binding key, so consume
                    // the key first.
                    var key = this.expectTemplateBindingKey();
                    // Peek at the next token, if it is "as" then this must be variable
                    // declaration.
                    var binding = this.parseAsBinding(key);
                    if (binding) {
                        bindings.push(binding);
                    }
                    else {
                        // Otherwise the key must be a directive keyword, like "of". Transform
                        // the key to actual key. Eg. of -> ngForOf, trackBy -> ngForTrackBy
                        key.source = templateKey.source + key.source[0].toUpperCase() + key.source.substring(1);
                        bindings.push.apply(bindings, tslib_1.__spread(this.parseDirectiveKeywordBindings(key)));
                    }
                }
                this.consumeStatementTerminator();
            }
            return new TemplateBindingParseResult(bindings, [] /* warnings */, this.errors);
        };
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
        _ParseAST.prototype.parseDirectiveKeywordBindings = function (key) {
            var bindings = [];
            this.consumeOptionalCharacter(chars.$COLON); // trackBy: trackByFunction
            var value = this.getDirectiveBoundTarget();
            var spanEnd = this.currentAbsoluteOffset;
            // The binding could optionally be followed by "as". For example,
            // *ngIf="cond | pipe as x". In this case, the key in the "as" binding
            // is "x" and the value is the template key itself ("ngIf"). Note that the
            // 'key' in the current context now becomes the "value" in the next binding.
            var asBinding = this.parseAsBinding(key);
            if (!asBinding) {
                this.consumeStatementTerminator();
                spanEnd = this.currentAbsoluteOffset;
            }
            var sourceSpan = new ast_1.AbsoluteSourceSpan(key.span.start, spanEnd);
            bindings.push(new ast_1.ExpressionBinding(sourceSpan, key, value));
            if (asBinding) {
                bindings.push(asBinding);
            }
            return bindings;
        };
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
        _ParseAST.prototype.getDirectiveBoundTarget = function () {
            if (this.next === lexer_1.EOF || this.peekKeywordAs() || this.peekKeywordLet()) {
                return null;
            }
            var ast = this.parsePipe(); // example: "condition | async"
            var start = ast.span.start;
            // Getting the end of the last token removes trailing whitespace.
            // If ast has the correct end span then no need to peek at last token.
            // TODO(ayazhafiz): Remove this in https://github.com/angular/angular/pull/34690
            var end = this.peek(-1).end;
            var value = this.input.substring(start, end);
            return new ast_1.ASTWithSource(ast, value, this.location, this.absoluteOffset + start, this.errors);
        };
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
        _ParseAST.prototype.parseAsBinding = function (value) {
            if (!this.peekKeywordAs()) {
                return null;
            }
            this.advance(); // consume the 'as' keyword
            var key = this.expectTemplateBindingKey();
            this.consumeStatementTerminator();
            var sourceSpan = new ast_1.AbsoluteSourceSpan(value.span.start, this.currentAbsoluteOffset);
            return new ast_1.VariableBinding(sourceSpan, key, value);
        };
        /**
         * Return the binding for a variable declared using `let`. For example,
         * ```
         *   *ngFor="let item of items; let i=index;"
         *           ^^^^^^^^           ^^^^^^^^^^^
         * ```
         * In the first binding, `item` is bound to `NgForOfContext.$implicit`.
         * In the second binding, `i` is bound to `NgForOfContext.index`.
         */
        _ParseAST.prototype.parseLetBinding = function () {
            if (!this.peekKeywordLet()) {
                return null;
            }
            var spanStart = this.currentAbsoluteOffset;
            this.advance(); // consume the 'let' keyword
            var key = this.expectTemplateBindingKey();
            var value = null;
            if (this.consumeOptionalOperator('=')) {
                value = this.expectTemplateBindingKey();
            }
            this.consumeStatementTerminator();
            var sourceSpan = new ast_1.AbsoluteSourceSpan(spanStart, this.currentAbsoluteOffset);
            return new ast_1.VariableBinding(sourceSpan, key, value);
        };
        /**
         * Consume the optional statement terminator: semicolon or comma.
         */
        _ParseAST.prototype.consumeStatementTerminator = function () {
            this.consumeOptionalCharacter(chars.$SEMICOLON) || this.consumeOptionalCharacter(chars.$COMMA);
        };
        _ParseAST.prototype.error = function (message, index) {
            if (index === void 0) { index = null; }
            this.errors.push(new ast_1.ParserError(message, this.input, this.locationText(index), this.location));
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
                    this.errors.push(new ast_1.ParserError(this.next.toString(), this.input, this.locationText(), this.location));
                }
                this.advance();
                n = this.next;
            }
        };
        return _ParseAST;
    }());
    exports._ParseAST = _ParseAST;
    var SimpleExpressionChecker = /** @class */ (function () {
        function SimpleExpressionChecker() {
            this.errors = [];
        }
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
    /**
     * This class extends SimpleExpressionChecker used in View Engine and performs more strict checks to
     * make sure host bindings do not contain pipes. In View Engine, having pipes in host bindings is
     * not supported as well, but in some cases (like `!(value | async)`) the error is not triggered at
     * compile time. In order to preserve View Engine behavior, more strict checks are introduced for
     * Ivy mode only.
     */
    var IvySimpleExpressionChecker = /** @class */ (function (_super) {
        tslib_1.__extends(IvySimpleExpressionChecker, _super);
        function IvySimpleExpressionChecker() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        IvySimpleExpressionChecker.prototype.visitBinary = function (ast, context) {
            ast.left.visit(this);
            ast.right.visit(this);
        };
        IvySimpleExpressionChecker.prototype.visitPrefixNot = function (ast, context) { ast.expression.visit(this); };
        return IvySimpleExpressionChecker;
    }(SimpleExpressionChecker));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCxtREFBa0M7SUFDbEMsNkZBQW9HO0lBQ3BHLG1EQUFxQztJQUVyQyxtRUFBa2Q7SUFDbGQsdUVBQTRFO0lBRTVFO1FBQ0UsNEJBQW1CLE9BQWlCLEVBQVMsV0FBcUIsRUFBUyxPQUFpQjtZQUF6RSxZQUFPLEdBQVAsT0FBTyxDQUFVO1lBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQVU7WUFBUyxZQUFPLEdBQVAsT0FBTyxDQUFVO1FBQUcsQ0FBQztRQUNsRyx5QkFBQztJQUFELENBQUMsQUFGRCxJQUVDO0lBRlksZ0RBQWtCO0lBSS9CO1FBQ0Usb0NBQ1csZ0JBQW1DLEVBQVMsUUFBa0IsRUFDOUQsTUFBcUI7WUFEckIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFtQjtZQUFTLGFBQVEsR0FBUixRQUFRLENBQVU7WUFDOUQsV0FBTSxHQUFOLE1BQU0sQ0FBZTtRQUFHLENBQUM7UUFDdEMsaUNBQUM7SUFBRCxDQUFDLEFBSkQsSUFJQztJQUpZLGdFQUEwQjtJQU12QyxJQUFNLHdCQUF3QixHQUFHLHdCQUF3QixDQUFDLG1EQUE0QixDQUFDLENBQUM7SUFDeEYsU0FBUyxxQkFBcUIsQ0FBQyxNQUEyQjtRQUN4RCxJQUFJLE1BQU0sS0FBSyxtREFBNEIsRUFBRTtZQUMzQyxPQUFPLHdCQUF3QixDQUFDO1NBQ2pDO2FBQU07WUFDTCxPQUFPLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ3pDO0lBQ0gsQ0FBQztJQUVELFNBQVMsd0JBQXdCLENBQUMsTUFBMkI7UUFDM0QsSUFBTSxPQUFPLEdBQUcsbUJBQVksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsY0FBYyxH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QUQsQ0FBQyxBQVBELENBQXlDLHVCQUF1QixHQU8vRCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2hhcnMgZnJvbSAnLi4vY2hhcnMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtlc2NhcGVSZWdFeHB9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge0FTVCwgQVNUV2l0aFNvdXJjZSwgQWJzb2x1dGVTb3VyY2VTcGFuLCBBc3RWaXNpdG9yLCBCaW5hcnksIEJpbmRpbmdQaXBlLCBDaGFpbiwgQ29uZGl0aW9uYWwsIEVtcHR5RXhwciwgRXhwcmVzc2lvbkJpbmRpbmcsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgS2V5ZWRSZWFkLCBLZXllZFdyaXRlLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxNYXBLZXksIExpdGVyYWxQcmltaXRpdmUsIE1ldGhvZENhbGwsIE5vbk51bGxBc3NlcnQsIFBhcnNlU3BhbiwgUGFyc2VyRXJyb3IsIFByZWZpeE5vdCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBRdW90ZSwgU2FmZU1ldGhvZENhbGwsIFNhZmVQcm9wZXJ0eVJlYWQsIFRlbXBsYXRlQmluZGluZywgVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllciwgVmFyaWFibGVCaW5kaW5nfSBmcm9tICcuL2FzdCc7XG5pbXBvcnQge0VPRiwgTGV4ZXIsIFRva2VuLCBUb2tlblR5cGUsIGlzSWRlbnRpZmllciwgaXNRdW90ZX0gZnJvbSAnLi9sZXhlcic7XG5cbmV4cG9ydCBjbGFzcyBTcGxpdEludGVycG9sYXRpb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgc3RyaW5nczogc3RyaW5nW10sIHB1YmxpYyBleHByZXNzaW9uczogc3RyaW5nW10sIHB1YmxpYyBvZmZzZXRzOiBudW1iZXJbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgdGVtcGxhdGVCaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10sIHB1YmxpYyB3YXJuaW5nczogc3RyaW5nW10sXG4gICAgICBwdWJsaWMgZXJyb3JzOiBQYXJzZXJFcnJvcltdKSB7fVxufVxuXG5jb25zdCBkZWZhdWx0SW50ZXJwb2xhdGVSZWdFeHAgPSBfY3JlYXRlSW50ZXJwb2xhdGVSZWdFeHAoREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk7XG5mdW5jdGlvbiBfZ2V0SW50ZXJwb2xhdGVSZWdFeHAoY29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogUmVnRXhwIHtcbiAgaWYgKGNvbmZpZyA9PT0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRykge1xuICAgIHJldHVybiBkZWZhdWx0SW50ZXJwb2xhdGVSZWdFeHA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBSZWdFeHAge1xuICBjb25zdCBwYXR0ZXJuID0gZXNjYXBlUmVnRXhwKGNvbmZpZy5zdGFydCkgKyAnKFtcXFxcc1xcXFxTXSo/KScgKyBlc2NhcGVSZWdFeHAoY29uZmlnLmVuZCk7XG4gIHJldHVybiBuZXcgUmVnRXhwKHBhdHRlcm4sICdnJyk7XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2xleGVyOiBMZXhlcikge31cblxuICBzaW1wbGVFeHByZXNzaW9uQ2hlY2tlciA9IFNpbXBsZUV4cHJlc3Npb25DaGVja2VyO1xuXG4gIHBhcnNlQWN0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgdGhpcy5fY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpKTtcbiAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgdHJ1ZSwgdGhpcy5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgIGlucHV0Lmxlbmd0aCAtIHNvdXJjZVRvTGV4Lmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwYXJzZUJpbmRpbmcoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogYW55LCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUJpbmRpbmdBc3QoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja1NpbXBsZUV4cHJlc3Npb24oYXN0OiBBU1QpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgY2hlY2tlciA9IG5ldyB0aGlzLnNpbXBsZUV4cHJlc3Npb25DaGVja2VyKCk7XG4gICAgYXN0LnZpc2l0KGNoZWNrZXIpO1xuICAgIHJldHVybiBjaGVja2VyLmVycm9ycztcbiAgfVxuXG4gIHBhcnNlU2ltcGxlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBlcnJvcnMgPSB0aGlzLmNoZWNrU2ltcGxlRXhwcmVzc2lvbihhc3QpO1xuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYEhvc3QgYmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluICR7ZXJyb3JzLmpvaW4oJyAnKX1gLCBpbnB1dCwgbG9jYXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihtZXNzYWdlOiBzdHJpbmcsIGlucHV0OiBzdHJpbmcsIGVyckxvY2F0aW9uOiBzdHJpbmcsIGN0eExvY2F0aW9uPzogYW55KSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VyRXJyb3IobWVzc2FnZSwgaW5wdXQsIGVyckxvY2F0aW9uLCBjdHhMb2NhdGlvbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VCaW5kaW5nQXN0KFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBBU1Qge1xuICAgIC8vIFF1b3RlcyBleHByZXNzaW9ucyB1c2UgM3JkLXBhcnR5IGV4cHJlc3Npb24gbGFuZ3VhZ2UuIFdlIGRvbid0IHdhbnQgdG8gdXNlXG4gICAgLy8gb3VyIGxleGVyIG9yIHBhcnNlciBmb3IgdGhhdCwgc28gd2UgY2hlY2sgZm9yIHRoYXQgYWhlYWQgb2YgdGltZS5cbiAgICBjb25zdCBxdW90ZSA9IHRoaXMuX3BhcnNlUXVvdGUoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG5cbiAgICBpZiAocXVvdGUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHF1b3RlO1xuICAgIH1cblxuICAgIHRoaXMuX2NoZWNrTm9JbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgcmV0dXJuIG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgZmFsc2UsIHRoaXMuZXJyb3JzLFxuICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAucGFyc2VDaGFpbigpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VRdW90ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1R8bnVsbCB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHByZWZpeFNlcGFyYXRvckluZGV4ID0gaW5wdXQuaW5kZXhPZignOicpO1xuICAgIGlmIChwcmVmaXhTZXBhcmF0b3JJbmRleCA9PSAtMSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4ID0gaW5wdXQuc3Vic3RyaW5nKDAsIHByZWZpeFNlcGFyYXRvckluZGV4KS50cmltKCk7XG4gICAgaWYgKCFpc0lkZW50aWZpZXIocHJlZml4KSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24gPSBpbnB1dC5zdWJzdHJpbmcocHJlZml4U2VwYXJhdG9ySW5kZXggKyAxKTtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgUXVvdGUoXG4gICAgICAgIHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHByZWZpeCwgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24sIGxvY2F0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBtaWNyb3N5bnRheCB0ZW1wbGF0ZSBleHByZXNzaW9uIGFuZCByZXR1cm4gYSBsaXN0IG9mIGJpbmRpbmdzIG9yXG4gICAqIHBhcnNpbmcgZXJyb3JzIGluIGNhc2UgdGhlIGdpdmVuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgIDxkaXYgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIj5cbiAgICogICAgICAgICBeICAgICAgXiBhYnNvbHV0ZVZhbHVlT2Zmc2V0IGZvciBgdGVtcGxhdGVWYWx1ZWBcbiAgICogICAgICAgICBhYnNvbHV0ZUtleU9mZnNldCBmb3IgYHRlbXBsYXRlS2V5YFxuICAgKiBgYGBcbiAgICogY29udGFpbnMgdGhyZWUgYmluZGluZ3M6XG4gICAqIDEuIG5nRm9yIC0+IG51bGxcbiAgICogMi4gaXRlbSAtPiBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRcbiAgICogMy4gbmdGb3JPZiAtPiBpdGVtc1xuICAgKlxuICAgKiBUaGlzIGlzIGFwcGFyZW50IGZyb20gdGhlIGRlLXN1Z2FyZWQgdGVtcGxhdGU6XG4gICAqIGBgYFxuICAgKiAgIDxuZy10ZW1wbGF0ZSBuZ0ZvciBsZXQtaXRlbSBbbmdGb3JPZl09XCJpdGVtc1wiPlxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlS2V5IG5hbWUgb2YgZGlyZWN0aXZlLCB3aXRob3V0IHRoZSAqIHByZWZpeC4gRm9yIGV4YW1wbGU6IG5nSWYsIG5nRm9yXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZVZhbHVlIFJIUyBvZiB0aGUgbWljcm9zeW50YXggYXR0cmlidXRlXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZVVybCB0ZW1wbGF0ZSBmaWxlbmFtZSBpZiBpdCdzIGV4dGVybmFsLCBjb21wb25lbnQgZmlsZW5hbWUgaWYgaXQncyBpbmxpbmVcbiAgICogQHBhcmFtIGFic29sdXRlS2V5T2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdGVtcGxhdGVLZXlgXG4gICAqIEBwYXJhbSBhYnNvbHV0ZVZhbHVlT2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdGVtcGxhdGVWYWx1ZWBcbiAgICovXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyhcbiAgICAgIHRlbXBsYXRlS2V5OiBzdHJpbmcsIHRlbXBsYXRlVmFsdWU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZywgYWJzb2x1dGVLZXlPZmZzZXQ6IG51bWJlcixcbiAgICAgIGFic29sdXRlVmFsdWVPZmZzZXQ6IG51bWJlcik6IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZSh0ZW1wbGF0ZVZhbHVlKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICB0ZW1wbGF0ZVZhbHVlLCB0ZW1wbGF0ZVVybCwgYWJzb2x1dGVWYWx1ZU9mZnNldCwgdG9rZW5zLCB0ZW1wbGF0ZVZhbHVlLmxlbmd0aCxcbiAgICAgICAgZmFsc2UgLyogcGFyc2VBY3Rpb24gKi8sIHRoaXMuZXJyb3JzLCAwIC8qIHJlbGF0aXZlIG9mZnNldCAqLyk7XG4gICAgcmV0dXJuIHBhcnNlci5wYXJzZVRlbXBsYXRlQmluZGluZ3Moe1xuICAgICAgc291cmNlOiB0ZW1wbGF0ZUtleSxcbiAgICAgIHNwYW46IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oYWJzb2x1dGVLZXlPZmZzZXQsIGFic29sdXRlS2V5T2Zmc2V0ICsgdGVtcGxhdGVLZXkubGVuZ3RoKSxcbiAgICB9KTtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgY29uc3Qgc3BsaXQgPSB0aGlzLnNwbGl0SW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGlmIChzcGxpdCA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGV4cHJlc3Npb25zOiBBU1RbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGxpdC5leHByZXNzaW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgZXhwcmVzc2lvblRleHQgPSBzcGxpdC5leHByZXNzaW9uc1tpXTtcbiAgICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uVGV4dCk7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9ycywgc3BsaXQub2Zmc2V0c1tpXSArIChleHByZXNzaW9uVGV4dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpKVxuICAgICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgICBleHByZXNzaW9ucy5wdXNoKGFzdCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4oMCwgaW5wdXQgPT0gbnVsbCA/IDAgOiBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShcbiAgICAgICAgbmV3IEludGVycG9sYXRpb24oc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgc3BsaXQuc3RyaW5ncywgZXhwcmVzc2lvbnMpLCBpbnB1dCxcbiAgICAgICAgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBzcGxpdEludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBTcGxpdEludGVycG9sYXRpb25cbiAgICAgIHxudWxsIHtcbiAgICBjb25zdCByZWdleHAgPSBfZ2V0SW50ZXJwb2xhdGVSZWdFeHAoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3QgcGFydHMgPSBpbnB1dC5zcGxpdChyZWdleHApO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggPD0gMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHN0cmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZXhwcmVzc2lvbnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgb2Zmc2V0czogbnVtYmVyW10gPSBbXTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBwYXJ0OiBzdHJpbmcgPSBwYXJ0c1tpXTtcbiAgICAgIGlmIChpICUgMiA9PT0gMCkge1xuICAgICAgICAvLyBmaXhlZCBzdHJpbmdcbiAgICAgICAgc3RyaW5ncy5wdXNoKHBhcnQpO1xuICAgICAgICBvZmZzZXQgKz0gcGFydC5sZW5ndGg7XG4gICAgICB9IGVsc2UgaWYgKHBhcnQudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgb2Zmc2V0ICs9IGludGVycG9sYXRpb25Db25maWcuc3RhcnQubGVuZ3RoO1xuICAgICAgICBleHByZXNzaW9ucy5wdXNoKHBhcnQpO1xuICAgICAgICBvZmZzZXRzLnB1c2gob2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IHBhcnQubGVuZ3RoICsgaW50ZXJwb2xhdGlvbkNvbmZpZy5lbmQubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAnQmxhbmsgZXhwcmVzc2lvbnMgYXJlIG5vdCBhbGxvd2VkIGluIGludGVycG9sYXRlZCBzdHJpbmdzJywgaW5wdXQsXG4gICAgICAgICAgICBgYXQgY29sdW1uICR7dGhpcy5fZmluZEludGVycG9sYXRpb25FcnJvckNvbHVtbihwYXJ0cywgaSwgaW50ZXJwb2xhdGlvbkNvbmZpZyl9IGluYCxcbiAgICAgICAgICAgIGxvY2F0aW9uKTtcbiAgICAgICAgZXhwcmVzc2lvbnMucHVzaCgnJGltcGxpY2l0Jyk7XG4gICAgICAgIG9mZnNldHMucHVzaChvZmZzZXQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFNwbGl0SW50ZXJwb2xhdGlvbihzdHJpbmdzLCBleHByZXNzaW9ucywgb2Zmc2V0cyk7XG4gIH1cblxuICB3cmFwTGl0ZXJhbFByaW1pdGl2ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBhbnksIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dCA9PSBudWxsID8gMCA6IGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBpbnB1dCksIGlucHV0LCBsb2NhdGlvbixcbiAgICAgICAgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0cmlwQ29tbWVudHMoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaSA9IHRoaXMuX2NvbW1lbnRTdGFydChpbnB1dCk7XG4gICAgcmV0dXJuIGkgIT0gbnVsbCA/IGlucHV0LnN1YnN0cmluZygwLCBpKS50cmltKCkgOiBpbnB1dDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbW1lbnRTdGFydChpbnB1dDogc3RyaW5nKTogbnVtYmVyfG51bGwge1xuICAgIGxldCBvdXRlclF1b3RlOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGNvbnN0IGNoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgY29uc3QgbmV4dENoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkgKyAxKTtcblxuICAgICAgaWYgKGNoYXIgPT09IGNoYXJzLiRTTEFTSCAmJiBuZXh0Q2hhciA9PSBjaGFycy4kU0xBU0ggJiYgb3V0ZXJRdW90ZSA9PSBudWxsKSByZXR1cm4gaTtcblxuICAgICAgaWYgKG91dGVyUXVvdGUgPT09IGNoYXIpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKG91dGVyUXVvdGUgPT0gbnVsbCAmJiBpc1F1b3RlKGNoYXIpKSB7XG4gICAgICAgIG91dGVyUXVvdGUgPSBjaGFyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrTm9JbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IGFueSwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IHZvaWQge1xuICAgIGNvbnN0IHJlZ2V4cCA9IF9nZXRJbnRlcnBvbGF0ZVJlZ0V4cChpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBwYXJ0cyA9IGlucHV0LnNwbGl0KHJlZ2V4cCk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7aW50ZXJwb2xhdGlvbkNvbmZpZy5lbmR9KSB3aGVyZSBleHByZXNzaW9uIHdhcyBleHBlY3RlZGAsXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgYGF0IGNvbHVtbiAke3RoaXMuX2ZpbmRJbnRlcnBvbGF0aW9uRXJyb3JDb2x1bW4ocGFydHMsIDEsIGludGVycG9sYXRpb25Db25maWcpfSBpbmAsXG4gICAgICAgICAgbG9jYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRJbnRlcnBvbGF0aW9uRXJyb3JDb2x1bW4oXG4gICAgICBwYXJ0czogc3RyaW5nW10sIHBhcnRJbkVycklkeDogbnVtYmVyLCBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogbnVtYmVyIHtcbiAgICBsZXQgZXJyTG9jYXRpb24gPSAnJztcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBhcnRJbkVycklkeDsgaisrKSB7XG4gICAgICBlcnJMb2NhdGlvbiArPSBqICUgMiA9PT0gMCA/XG4gICAgICAgICAgcGFydHNbal0gOlxuICAgICAgICAgIGAke2ludGVycG9sYXRpb25Db25maWcuc3RhcnR9JHtwYXJ0c1tqXX0ke2ludGVycG9sYXRpb25Db25maWcuZW5kfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVyckxvY2F0aW9uLmxlbmd0aDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSXZ5UGFyc2VyIGV4dGVuZHMgUGFyc2VyIHtcbiAgc2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgPSBJdnlTaW1wbGVFeHByZXNzaW9uQ2hlY2tlcjsgIC8vXG59XG5cbmV4cG9ydCBjbGFzcyBfUGFyc2VBU1Qge1xuICBwcml2YXRlIHJwYXJlbnNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNrZXRzRXhwZWN0ZWQgPSAwO1xuICBwcml2YXRlIHJicmFjZXNFeHBlY3RlZCA9IDA7XG5cbiAgLy8gQ2FjaGUgb2YgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZWNlcyB0byB0aGUgYWJzb2x1dGUgc291cmNlIHNwYW4gdGhleSBtYXAgdG8sIHVzZWQgdG9cbiAgLy8gcHJldmVudCBjcmVhdGluZyBzdXBlcmZsdW91cyBzb3VyY2Ugc3BhbnMgaW4gYHNvdXJjZVNwYW5gLlxuICAvLyBBIHNlcmlhbCBvZiB0aGUgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZXggaXMgdXNlZCBmb3IgbWFwcGluZyBiZWNhdXNlIGJvdGggYXJlIHN0YXRlZnVsXG4gIC8vIGFuZCBtYXkgY2hhbmdlIGZvciBzdWJzZXF1ZW50IGV4cHJlc3Npb25zIHZpc2l0ZWQgYnkgdGhlIHBhcnNlci5cbiAgcHJpdmF0ZSBzb3VyY2VTcGFuQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQWJzb2x1dGVTb3VyY2VTcGFuPigpO1xuXG4gIGluZGV4OiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGlucHV0OiBzdHJpbmcsIHB1YmxpYyBsb2NhdGlvbjogYW55LCBwdWJsaWMgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHB1YmxpYyB0b2tlbnM6IFRva2VuW10sIHB1YmxpYyBpbnB1dExlbmd0aDogbnVtYmVyLCBwdWJsaWMgcGFyc2VBY3Rpb246IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSwgcHJpdmF0ZSBvZmZzZXQ6IG51bWJlcikge31cblxuICBwZWVrKG9mZnNldDogbnVtYmVyKTogVG9rZW4ge1xuICAgIGNvbnN0IGkgPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHJldHVybiBpIDwgdGhpcy50b2tlbnMubGVuZ3RoID8gdGhpcy50b2tlbnNbaV0gOiBFT0Y7XG4gIH1cblxuICBnZXQgbmV4dCgpOiBUb2tlbiB7IHJldHVybiB0aGlzLnBlZWsoMCk7IH1cblxuICBnZXQgaW5wdXRJbmRleCgpOiBudW1iZXIge1xuICAgIHJldHVybiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkgPyB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5wdXRMZW5ndGggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhYnNvbHV0ZSBvZmZzZXQgb2YgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHRva2VuLlxuICAgKi9cbiAgZ2V0IGN1cnJlbnRBYnNvbHV0ZU9mZnNldCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5hYnNvbHV0ZU9mZnNldCArIHRoaXMuaW5wdXRJbmRleDsgfVxuXG4gIHNwYW4oc3RhcnQ6IG51bWJlcikgeyByZXR1cm4gbmV3IFBhcnNlU3BhbihzdGFydCwgdGhpcy5pbnB1dEluZGV4KTsgfVxuXG4gIHNvdXJjZVNwYW4oc3RhcnQ6IG51bWJlcik6IEFic29sdXRlU291cmNlU3BhbiB7XG4gICAgY29uc3Qgc2VyaWFsID0gYCR7c3RhcnR9QCR7dGhpcy5pbnB1dEluZGV4fWA7XG4gICAgaWYgKCF0aGlzLnNvdXJjZVNwYW5DYWNoZS5oYXMoc2VyaWFsKSkge1xuICAgICAgdGhpcy5zb3VyY2VTcGFuQ2FjaGUuc2V0KHNlcmlhbCwgdGhpcy5zcGFuKHN0YXJ0KS50b0Fic29sdXRlKHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc291cmNlU3BhbkNhY2hlLmdldChzZXJpYWwpICE7XG4gIH1cblxuICBhZHZhbmNlKCkgeyB0aGlzLmluZGV4Kys7IH1cblxuICBjb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3Rlcihjb2RlKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHBlZWtLZXl3b3JkTGV0KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5uZXh0LmlzS2V5d29yZExldCgpOyB9XG4gIHBlZWtLZXl3b3JkQXMoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLm5leHQuaXNLZXl3b3JkQXMoKTsgfVxuXG4gIGV4cGVjdENoYXJhY3Rlcihjb2RlOiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY29kZSkpIHJldHVybjtcbiAgICB0aGlzLmVycm9yKGBNaXNzaW5nIGV4cGVjdGVkICR7U3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKX1gKTtcbiAgfVxuXG4gIGNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKG9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzT3BlcmF0b3Iob3ApKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZXhwZWN0T3BlcmF0b3Iob3BlcmF0b3I6IHN0cmluZykge1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKG9wZXJhdG9yKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgb3BlcmF0b3IgJHtvcGVyYXRvcn1gKTtcbiAgfVxuXG4gIGV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAke259LCBleHBlY3RlZCBpZGVudGlmaWVyIG9yIGtleXdvcmRgKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG4udG9TdHJpbmcoKSBhcyBzdHJpbmc7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSAmJiAhbi5pc1N0cmluZygpKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7bn0sIGV4cGVjdGVkIGlkZW50aWZpZXIsIGtleXdvcmQsIG9yIHN0cmluZ2ApO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbi50b1N0cmluZygpIGFzIHN0cmluZztcbiAgfVxuXG4gIHBhcnNlQ2hhaW4oKTogQVNUIHtcbiAgICBjb25zdCBleHByczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBleHBycy5wdXNoKGV4cHIpO1xuXG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluIGNoYWluZWQgZXhwcmVzc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICB9ICAvLyByZWFkIGFsbCBzZW1pY29sb25zXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAnJHt0aGlzLm5leHR9J2ApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZXhwcnMubGVuZ3RoID09IDApIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIGlmIChleHBycy5sZW5ndGggPT0gMSkgcmV0dXJuIGV4cHJzWzBdO1xuICAgIHJldHVybiBuZXcgQ2hhaW4odGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZXhwcnMpO1xuICB9XG5cbiAgcGFyc2VQaXBlKCk6IEFTVCB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSkge1xuICAgICAgaWYgKHRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgdGhpcy5lcnJvcignQ2Fubm90IGhhdmUgYSBwaXBlIGluIGFuIGFjdGlvbiBleHByZXNzaW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk7XG4gICAgICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zb3VyY2VTcGFuKG5hbWVTdGFydCk7XG4gICAgICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW107XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pKSB7XG4gICAgICAgICAgYXJncy5wdXNoKHRoaXMucGFyc2VFeHByZXNzaW9uKCkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBCaW5kaW5nUGlwZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQsIG5hbWUsIGFyZ3MsIG5hbWVTcGFuKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbigpOiBBU1QgeyByZXR1cm4gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7IH1cblxuICBwYXJzZUNvbmRpdGlvbmFsKCk6IEFTVCB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5wYXJzZUxvZ2ljYWxPcigpO1xuXG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz8nKSkge1xuICAgICAgY29uc3QgeWVzID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIGxldCBubzogQVNUO1xuICAgICAgaWYgKCF0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pKSB7XG4gICAgICAgIGNvbnN0IGVuZCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuICAgICAgICB0aGlzLmVycm9yKGBDb25kaXRpb25hbCBleHByZXNzaW9uICR7ZXhwcmVzc2lvbn0gcmVxdWlyZXMgYWxsIDMgZXhwcmVzc2lvbnNgKTtcbiAgICAgICAgbm8gPSBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm8gPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBDb25kaXRpb25hbCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQsIHllcywgbm8pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlTG9naWNhbE9yKCk6IEFTVCB7XG4gICAgLy8gJ3x8J1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlTG9naWNhbEFuZCgpO1xuICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCd8fCcpKSB7XG4gICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG4gICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksICd8fCcsIHJlc3VsdCwgcmlnaHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VMb2dpY2FsQW5kKCk6IEFTVCB7XG4gICAgLy8gJyYmJ1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlRXF1YWxpdHkoKTtcbiAgICB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignJiYnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlRXF1YWxpdHkoKTtcbiAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgJyYmJywgcmVzdWx0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUVxdWFsaXR5KCk6IEFTVCB7XG4gICAgLy8gJz09JywnIT0nLCc9PT0nLCchPT0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VSZWxhdGlvbmFsKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJz09JzpcbiAgICAgICAgY2FzZSAnPT09JzpcbiAgICAgICAgY2FzZSAnIT0nOlxuICAgICAgICBjYXNlICchPT0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlUmVsYXRpb25hbCgpOiBBU1Qge1xuICAgIC8vICc8JywgJz4nLCAnPD0nLCAnPj0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgY2FzZSAnPic6XG4gICAgICAgIGNhc2UgJzw9JzpcbiAgICAgICAgY2FzZSAnPj0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUFkZGl0aXZlKCk6IEFTVCB7XG4gICAgLy8gJysnLCAnLSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJysnOlxuICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTXVsdGlwbGljYXRpdmUoKTogQVNUIHtcbiAgICAvLyAnKicsICclJywgJy8nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKic6XG4gICAgICAgIGNhc2UgJyUnOlxuICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZVByZWZpeCgpOiBBU1Qge1xuICAgIGlmICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBjb25zdCBsaXRlcmFsU3BhbiA9IG5ldyBQYXJzZVNwYW4oc3RhcnQsIHN0YXJ0KTtcbiAgICAgIGNvbnN0IGxpdGVyYWxTb3VyY2VTcGFuID0gbGl0ZXJhbFNwYW4udG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KTtcbiAgICAgIGxldCByZXN1bHQ6IEFTVDtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgQmluYXJ5KFxuICAgICAgICAgICAgICB0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnLScsIHJlc3VsdCxcbiAgICAgICAgICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUobGl0ZXJhbFNwYW4sIGxpdGVyYWxTb3VyY2VTcGFuLCAwKSk7XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IEJpbmFyeShcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsXG4gICAgICAgICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKGxpdGVyYWxTcGFuLCBsaXRlcmFsU291cmNlU3BhbiwgMCksIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByZWZpeE5vdCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYXJzZUNhbGxDaGFpbigpO1xuICB9XG5cbiAgcGFyc2VDYWxsQ2hhaW4oKTogQVNUIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByaW1hcnkoKTtcbiAgICBjb25zdCByZXN1bHRTdGFydCA9IHJlc3VsdC5zcGFuLnN0YXJ0O1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFBFUklPRCkpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChyZXN1bHQsIGZhbHNlKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc/LicpKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwocmVzdWx0LCB0cnVlKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgS2V5ZWRXcml0ZShcbiAgICAgICAgICAgICAgdGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBrZXksIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgS2V5ZWRSZWFkKHRoaXMuc3BhbihyZXN1bHRTdGFydCksIHRoaXMuc291cmNlU3BhbihyZXN1bHRTdGFydCksIHJlc3VsdCwga2V5KTtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnBhcnNlQ2FsbEFyZ3VtZW50cygpO1xuICAgICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBGdW5jdGlvbkNhbGwodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBhcmdzKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCchJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IE5vbk51bGxBc3NlcnQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0KTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZVByaW1hcnkoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZE51bGwoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbnVsbCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRVbmRlZmluZWQoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdm9pZCAwKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRydWUoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdHJ1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRGYWxzZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRUaGlzKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICB0aGlzLnJicmFja2V0c0V4cGVjdGVkKys7XG4gICAgICBjb25zdCBlbGVtZW50cyA9IHRoaXMucGFyc2VFeHByZXNzaW9uTGlzdChjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGVsZW1lbnRzKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUxpdGVyYWxNYXAoKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzSWRlbnRpZmllcigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChcbiAgICAgICAgICBuZXcgSW1wbGljaXRSZWNlaXZlcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKSwgZmFsc2UpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNOdW1iZXIoKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLm5leHQudG9OdW1iZXIoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzU3RyaW5nKCkpIHtcbiAgICAgIGNvbnN0IGxpdGVyYWxWYWx1ZSA9IHRoaXMubmV4dC50b1N0cmluZygpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbGl0ZXJhbFZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA+PSB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb246ICR7dGhpcy5pbnB1dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7dGhpcy5uZXh0fWApO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uTGlzdCh0ZXJtaW5hdG9yOiBudW1iZXIpOiBBU1RbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBBU1RbXSA9IFtdO1xuICAgIGlmICghdGhpcy5uZXh0LmlzQ2hhcmFjdGVyKHRlcm1pbmF0b3IpKSB7XG4gICAgICBkbyB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxpdGVyYWxNYXAoKTogTGl0ZXJhbE1hcCB7XG4gICAgY29uc3Qga2V5czogTGl0ZXJhbE1hcEtleVtdID0gW107XG4gICAgY29uc3QgdmFsdWVzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpO1xuICAgIGlmICghdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSkpIHtcbiAgICAgIHRoaXMucmJyYWNlc0V4cGVjdGVkKys7XG4gICAgICBkbyB7XG4gICAgICAgIGNvbnN0IHF1b3RlZCA9IHRoaXMubmV4dC5pc1N0cmluZygpO1xuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmRPclN0cmluZygpO1xuICAgICAgICBrZXlzLnB1c2goe2tleSwgcXVvdGVkfSk7XG4gICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7XG4gICAgICAgIHZhbHVlcy5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgICB0aGlzLnJicmFjZXNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgTGl0ZXJhbE1hcCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBrZXlzLCB2YWx1ZXMpO1xuICB9XG5cbiAgcGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwocmVjZWl2ZXI6IEFTVCwgaXNTYWZlOiBib29sZWFuID0gZmFsc2UpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gcmVjZWl2ZXIuc3Bhbi5zdGFydDtcbiAgICBjb25zdCBpZCA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpO1xuXG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMucGFyc2VDYWxsQXJndW1lbnRzKCk7XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICBjb25zdCBzcGFuID0gdGhpcy5zcGFuKHN0YXJ0KTtcbiAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpO1xuICAgICAgcmV0dXJuIGlzU2FmZSA/IG5ldyBTYWZlTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpIDpcbiAgICAgICAgICAgICAgICAgICAgICBuZXcgTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpc1NhZmUpIHtcbiAgICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgIHRoaXMuZXJyb3IoJ1RoZSBcXCc/LlxcJyBvcGVyYXRvciBjYW5ub3QgYmUgdXNlZCBpbiB0aGUgYXNzaWdubWVudCcpO1xuICAgICAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgU2FmZVByb3BlcnR5UmVhZCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZWNlaXZlciwgaWQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5ncyBjYW5ub3QgY29udGFpbiBhc3NpZ25tZW50cycpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb3BlcnR5V3JpdGUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVjZWl2ZXIsIGlkLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3Qgc3BhbiA9IHRoaXMuc3BhbihzdGFydCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVJlYWQodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVjZWl2ZXIsIGlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBhcnNlQ2FsbEFyZ3VtZW50cygpOiBCaW5kaW5nUGlwZVtdIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSByZXR1cm4gW107XG4gICAgY29uc3QgcG9zaXRpb25hbHM6IEFTVFtdID0gW107XG4gICAgZG8ge1xuICAgICAgcG9zaXRpb25hbHMucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcG9zaXRpb25hbHMgYXMgQmluZGluZ1BpcGVbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZXMgYW4gaWRlbnRpZmllciwgYSBrZXl3b3JkLCBhIHN0cmluZyB3aXRoIGFuIG9wdGlvbmFsIGAtYCBpbiBiZXR3ZWVuLFxuICAgKiBhbmQgcmV0dXJucyB0aGUgc3RyaW5nIGFsb25nIHdpdGggaXRzIGFic29sdXRlIHNvdXJjZSBzcGFuLlxuICAgKi9cbiAgZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIge1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBsZXQgb3BlcmF0b3JGb3VuZCA9IGZhbHNlO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgZG8ge1xuICAgICAgcmVzdWx0ICs9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICBvcGVyYXRvckZvdW5kID0gdGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignLScpO1xuICAgICAgaWYgKG9wZXJhdG9yRm91bmQpIHtcbiAgICAgICAgcmVzdWx0ICs9ICctJztcbiAgICAgIH1cbiAgICB9IHdoaWxlIChvcGVyYXRvckZvdW5kKTtcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlOiByZXN1bHQsXG4gICAgICBzcGFuOiBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKHN0YXJ0LCBzdGFydCArIHJlc3VsdC5sZW5ndGgpLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgbWljcm9zeW50YXggdGVtcGxhdGUgZXhwcmVzc2lvbiBhbmQgcmV0dXJuIGEgbGlzdCBvZiBiaW5kaW5ncyBvclxuICAgKiBwYXJzaW5nIGVycm9ycyBpbiBjYXNlIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGludmFsaWQuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICA8ZGl2ICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpOyB0cmFja0J5OiBmdW5jXCI+XG4gICAqIGBgYFxuICAgKiBjb250YWlucyBmaXZlIGJpbmRpbmdzOlxuICAgKiAxLiBuZ0ZvciAtPiBudWxsXG4gICAqIDIuIGl0ZW0gLT4gTmdGb3JPZkNvbnRleHQuJGltcGxpY2l0XG4gICAqIDMuIG5nRm9yT2YgLT4gaXRlbXNcbiAgICogNC4gaSAtPiBOZ0Zvck9mQ29udGV4dC5pbmRleFxuICAgKiA1LiBuZ0ZvclRyYWNrQnkgLT4gZnVuY1xuICAgKlxuICAgKiBGb3IgYSBmdWxsIGRlc2NyaXB0aW9uIG9mIHRoZSBtaWNyb3N5bnRheCBncmFtbWFyLCBzZWVcbiAgICogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vbWhldmVyeS9kMzUzMDI5NGNmZjJlNGExYjNmZTE1ZmY3NWQwODg1NVxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGVLZXkgbmFtZSBvZiB0aGUgbWljcm9zeW50YXggZGlyZWN0aXZlLCBsaWtlIG5nSWYsIG5nRm9yLFxuICAgKiB3aXRob3V0IHRoZSAqLCBhbG9uZyB3aXRoIGl0cyBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKHRlbXBsYXRlS2V5OiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyKTogVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IGJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSA9IFtdO1xuXG4gICAgLy8gVGhlIGZpcnN0IGJpbmRpbmcgaXMgZm9yIHRoZSB0ZW1wbGF0ZSBrZXkgaXRzZWxmXG4gICAgLy8gSW4gKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIiwga2V5ID0gXCJuZ0ZvclwiLCB2YWx1ZSA9IG51bGxcbiAgICAvLyBJbiAqbmdJZj1cImNvbmQgfCBwaXBlXCIsIGtleSA9IFwibmdJZlwiLCB2YWx1ZSA9IFwiY29uZCB8IHBpcGVcIlxuICAgIGJpbmRpbmdzLnB1c2goLi4udGhpcy5wYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyh0ZW1wbGF0ZUtleSkpO1xuXG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIC8vIElmIGl0IHN0YXJ0cyB3aXRoICdsZXQnLCB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZSBkZWNsYXJhdGlvblxuICAgICAgY29uc3QgbGV0QmluZGluZyA9IHRoaXMucGFyc2VMZXRCaW5kaW5nKCk7XG4gICAgICBpZiAobGV0QmluZGluZykge1xuICAgICAgICBiaW5kaW5ncy5wdXNoKGxldEJpbmRpbmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVHdvIHBvc3NpYmxlIGNhc2VzIGhlcmUsIGVpdGhlciBgdmFsdWUgXCJhc1wiIGtleWAgb3JcbiAgICAgICAgLy8gXCJkaXJlY3RpdmUta2V5d29yZCBleHByZXNzaW9uXCIuIFdlIGRvbid0IGtub3cgd2hpY2ggY2FzZSwgYnV0IGJvdGhcbiAgICAgICAgLy8gXCJ2YWx1ZVwiIGFuZCBcImRpcmVjdGl2ZS1rZXl3b3JkXCIgYXJlIHRlbXBsYXRlIGJpbmRpbmcga2V5LCBzbyBjb25zdW1lXG4gICAgICAgIC8vIHRoZSBrZXkgZmlyc3QuXG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgICAgIC8vIFBlZWsgYXQgdGhlIG5leHQgdG9rZW4sIGlmIGl0IGlzIFwiYXNcIiB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZVxuICAgICAgICAvLyBkZWNsYXJhdGlvbi5cbiAgICAgICAgY29uc3QgYmluZGluZyA9IHRoaXMucGFyc2VBc0JpbmRpbmcoa2V5KTtcbiAgICAgICAgaWYgKGJpbmRpbmcpIHtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSB0aGUga2V5IG11c3QgYmUgYSBkaXJlY3RpdmUga2V5d29yZCwgbGlrZSBcIm9mXCIuIFRyYW5zZm9ybVxuICAgICAgICAgIC8vIHRoZSBrZXkgdG8gYWN0dWFsIGtleS4gRWcuIG9mIC0+IG5nRm9yT2YsIHRyYWNrQnkgLT4gbmdGb3JUcmFja0J5XG4gICAgICAgICAga2V5LnNvdXJjZSA9IHRlbXBsYXRlS2V5LnNvdXJjZSArIGtleS5zb3VyY2VbMF0udG9VcHBlckNhc2UoKSArIGtleS5zb3VyY2Uuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgIGJpbmRpbmdzLnB1c2goLi4udGhpcy5wYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyhrZXkpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5jb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQoYmluZGluZ3MsIFtdIC8qIHdhcm5pbmdzICovLCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgYSBkaXJlY3RpdmUga2V5d29yZCwgZm9sbG93ZWQgYnkgYSBtYW5kYXRvcnkgZXhwcmVzc2lvbi5cbiAgICogRm9yIGV4YW1wbGUsIFwib2YgaXRlbXNcIiwgXCJ0cmFja0J5OiBmdW5jXCIuXG4gICAqIFRoZSBiaW5kaW5ncyBhcmU6IG5nRm9yT2YgLT4gaXRlbXMsIG5nRm9yVHJhY2tCeSAtPiBmdW5jXG4gICAqIFRoZXJlIGNvdWxkIGJlIGFuIG9wdGlvbmFsIFwiYXNcIiBiaW5kaW5nIHRoYXQgZm9sbG93cyB0aGUgZXhwcmVzc2lvbi5cbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zIHwgc2xpY2U6MDoxIGFzIGNvbGxlY3Rpb25cIi5cbiAgICogICAgICAgICAgICAgICAgICAgIF5eIF5eXl5eXl5eXl5eXl5eXl5eIF5eXl5eXl5eXl5eXl5cbiAgICogICAgICAgICAgICAgICBrZXl3b3JkICAgIGJvdW5kIHRhcmdldCAgIG9wdGlvbmFsICdhcycgYmluZGluZ1xuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGtleSBiaW5kaW5nIGtleSwgZm9yIGV4YW1wbGUsIG5nRm9yLCBuZ0lmLCBuZ0Zvck9mLCBhbG9uZyB3aXRoIGl0c1xuICAgKiBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyhrZXk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmdbXSB7XG4gICAgY29uc3QgYmluZGluZ3M6IFRlbXBsYXRlQmluZGluZ1tdID0gW107XG4gICAgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKTsgIC8vIHRyYWNrQnk6IHRyYWNrQnlGdW5jdGlvblxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5nZXREaXJlY3RpdmVCb3VuZFRhcmdldCgpO1xuICAgIGxldCBzcGFuRW5kID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgLy8gVGhlIGJpbmRpbmcgY291bGQgb3B0aW9uYWxseSBiZSBmb2xsb3dlZCBieSBcImFzXCIuIEZvciBleGFtcGxlLFxuICAgIC8vICpuZ0lmPVwiY29uZCB8IHBpcGUgYXMgeFwiLiBJbiB0aGlzIGNhc2UsIHRoZSBrZXkgaW4gdGhlIFwiYXNcIiBiaW5kaW5nXG4gICAgLy8gaXMgXCJ4XCIgYW5kIHRoZSB2YWx1ZSBpcyB0aGUgdGVtcGxhdGUga2V5IGl0c2VsZiAoXCJuZ0lmXCIpLiBOb3RlIHRoYXQgdGhlXG4gICAgLy8gJ2tleScgaW4gdGhlIGN1cnJlbnQgY29udGV4dCBub3cgYmVjb21lcyB0aGUgXCJ2YWx1ZVwiIGluIHRoZSBuZXh0IGJpbmRpbmcuXG4gICAgY29uc3QgYXNCaW5kaW5nID0gdGhpcy5wYXJzZUFzQmluZGluZyhrZXkpO1xuICAgIGlmICghYXNCaW5kaW5nKSB7XG4gICAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgICBzcGFuRW5kID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKGtleS5zcGFuLnN0YXJ0LCBzcGFuRW5kKTtcbiAgICBiaW5kaW5ncy5wdXNoKG5ldyBFeHByZXNzaW9uQmluZGluZyhzb3VyY2VTcGFuLCBrZXksIHZhbHVlKSk7XG4gICAgaWYgKGFzQmluZGluZykge1xuICAgICAgYmluZGluZ3MucHVzaChhc0JpbmRpbmcpO1xuICAgIH1cbiAgICByZXR1cm4gYmluZGluZ3M7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBleHByZXNzaW9uIEFTVCBmb3IgdGhlIGJvdW5kIHRhcmdldCBvZiBhIGRpcmVjdGl2ZSBrZXl3b3JkXG4gICAqIGJpbmRpbmcuIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICAqbmdJZj1cImNvbmRpdGlvbiB8IHBpcGVcIlxuICAgKiAgICAgICAgICBeXl5eXl5eXl5eXl5eXl5eIGJvdW5kIHRhcmdldCBmb3IgXCJuZ0lmXCJcbiAgICogICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiXG4gICAqICAgICAgICAgICAgICAgICAgICAgICBeXl5eXiBib3VuZCB0YXJnZXQgZm9yIFwibmdGb3JPZlwiXG4gICAqIGBgYFxuICAgKi9cbiAgcHJpdmF0ZSBnZXREaXJlY3RpdmVCb3VuZFRhcmdldCgpOiBBU1RXaXRoU291cmNlfG51bGwge1xuICAgIGlmICh0aGlzLm5leHQgPT09IEVPRiB8fCB0aGlzLnBlZWtLZXl3b3JkQXMoKSB8fCB0aGlzLnBlZWtLZXl3b3JkTGV0KCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBhc3QgPSB0aGlzLnBhcnNlUGlwZSgpOyAgLy8gZXhhbXBsZTogXCJjb25kaXRpb24gfCBhc3luY1wiXG4gICAgY29uc3Qge3N0YXJ0fSA9IGFzdC5zcGFuO1xuICAgIC8vIEdldHRpbmcgdGhlIGVuZCBvZiB0aGUgbGFzdCB0b2tlbiByZW1vdmVzIHRyYWlsaW5nIHdoaXRlc3BhY2UuXG4gICAgLy8gSWYgYXN0IGhhcyB0aGUgY29ycmVjdCBlbmQgc3BhbiB0aGVuIG5vIG5lZWQgdG8gcGVlayBhdCBsYXN0IHRva2VuLlxuICAgIC8vIFRPRE8oYXlhemhhZml6KTogUmVtb3ZlIHRoaXMgaW4gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9wdWxsLzM0NjkwXG4gICAgY29uc3Qge2VuZH0gPSB0aGlzLnBlZWsoLTEpO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgdmFsdWUsIHRoaXMubG9jYXRpb24sIHRoaXMuYWJzb2x1dGVPZmZzZXQgKyBzdGFydCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYmluZGluZyBmb3IgYSB2YXJpYWJsZSBkZWNsYXJlZCB1c2luZyBgYXNgLiBOb3RlIHRoYXQgdGhlIG9yZGVyXG4gICAqIG9mIHRoZSBrZXktdmFsdWUgcGFpciBpbiB0aGlzIGRlY2xhcmF0aW9uIGlzIHJldmVyc2VkLiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGluZGV4IGFzIGlcIlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF5eXl5eICAgIF5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSAgICBrZXlcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSBuYW1lIG9mIHRoZSB2YWx1ZSBpbiB0aGUgZGVjbGFyYXRpb24sIFwibmdJZlwiIGluIHRoZSBleGFtcGxlXG4gICAqIGFib3ZlLCBhbG9uZyB3aXRoIGl0cyBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUFzQmluZGluZyh2YWx1ZTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcik6IFRlbXBsYXRlQmluZGluZ3xudWxsIHtcbiAgICBpZiAoIXRoaXMucGVla0tleXdvcmRBcygpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBjb25zdW1lIHRoZSAnYXMnIGtleXdvcmRcbiAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3Bhbih2YWx1ZS5zcGFuLnN0YXJ0LCB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldCk7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBiaW5kaW5nIGZvciBhIHZhcmlhYmxlIGRlY2xhcmVkIHVzaW5nIGBsZXRgLiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGxldCBpPWluZGV4O1wiXG4gICAqICAgICAgICAgICBeXl5eXl5eXiAgICAgICAgICAgXl5eXl5eXl5eXl5cbiAgICogYGBgXG4gICAqIEluIHRoZSBmaXJzdCBiaW5kaW5nLCBgaXRlbWAgaXMgYm91bmQgdG8gYE5nRm9yT2ZDb250ZXh0LiRpbXBsaWNpdGAuXG4gICAqIEluIHRoZSBzZWNvbmQgYmluZGluZywgYGlgIGlzIGJvdW5kIHRvIGBOZ0Zvck9mQ29udGV4dC5pbmRleGAuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlTGV0QmluZGluZygpOiBUZW1wbGF0ZUJpbmRpbmd8bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBlZWtLZXl3b3JkTGV0KCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzcGFuU3RhcnQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIGNvbnN1bWUgdGhlICdsZXQnIGtleXdvcmRcbiAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIGxldCB2YWx1ZTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcnxudWxsID0gbnVsbDtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICB2YWx1ZSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgfVxuICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3BhbihzcGFuU3RhcnQsIHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0KTtcbiAgICByZXR1cm4gbmV3IFZhcmlhYmxlQmluZGluZyhzb3VyY2VTcGFuLCBrZXksIHZhbHVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdW1lIHRoZSBvcHRpb25hbCBzdGF0ZW1lbnQgdGVybWluYXRvcjogc2VtaWNvbG9uIG9yIGNvbW1hLlxuICAgKi9cbiAgcHJpdmF0ZSBjb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpIHtcbiAgICB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSB8fCB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpO1xuICB9XG5cbiAgZXJyb3IobWVzc2FnZTogc3RyaW5nLCBpbmRleDogbnVtYmVyfG51bGwgPSBudWxsKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VyRXJyb3IobWVzc2FnZSwgdGhpcy5pbnB1dCwgdGhpcy5sb2NhdGlvblRleHQoaW5kZXgpLCB0aGlzLmxvY2F0aW9uKSk7XG4gICAgdGhpcy5za2lwKCk7XG4gIH1cblxuICBwcml2YXRlIGxvY2F0aW9uVGV4dChpbmRleDogbnVtYmVyfG51bGwgPSBudWxsKSB7XG4gICAgaWYgKGluZGV4ID09IG51bGwpIGluZGV4ID0gdGhpcy5pbmRleDtcbiAgICByZXR1cm4gKGluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSA/IGBhdCBjb2x1bW4gJHt0aGlzLnRva2Vuc1tpbmRleF0uaW5kZXggKyAxfSBpbmAgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYGF0IHRoZSBlbmQgb2YgdGhlIGV4cHJlc3Npb25gO1xuICB9XG5cbiAgLy8gRXJyb3IgcmVjb3Zlcnkgc2hvdWxkIHNraXAgdG9rZW5zIHVudGlsIGl0IGVuY291bnRlcnMgYSByZWNvdmVyeSBwb2ludC4gc2tpcCgpIHRyZWF0c1xuICAvLyB0aGUgZW5kIG9mIGlucHV0IGFuZCBhICc7JyBhcyB1bmNvbmRpdGlvbmFsbHkgYSByZWNvdmVyeSBwb2ludC4gSXQgYWxzbyB0cmVhdHMgJyknLFxuICAvLyAnfScgYW5kICddJyBhcyBjb25kaXRpb25hbCByZWNvdmVyeSBwb2ludHMgaWYgb25lIG9mIGNhbGxpbmcgcHJvZHVjdGlvbnMgaXMgZXhwZWN0aW5nXG4gIC8vIG9uZSBvZiB0aGVzZSBzeW1ib2xzLiBUaGlzIGFsbG93cyBza2lwKCkgdG8gcmVjb3ZlciBmcm9tIGVycm9ycyBzdWNoIGFzICcoYS4pICsgMScgYWxsb3dpbmdcbiAgLy8gbW9yZSBvZiB0aGUgQVNUIHRvIGJlIHJldGFpbmVkIChpdCBkb2Vzbid0IHNraXAgYW55IHRva2VucyBhcyB0aGUgJyknIGlzIHJldGFpbmVkIGJlY2F1c2VcbiAgLy8gb2YgdGhlICcoJyBiZWdpbnMgYW4gJygnIDxleHByPiAnKScgcHJvZHVjdGlvbikuIFRoZSByZWNvdmVyeSBwb2ludHMgb2YgZ3JvdXBpbmcgc3ltYm9sc1xuICAvLyBtdXN0IGJlIGNvbmRpdGlvbmFsIGFzIHRoZXkgbXVzdCBiZSBza2lwcGVkIGlmIG5vbmUgb2YgdGhlIGNhbGxpbmcgcHJvZHVjdGlvbnMgYXJlIG5vdFxuICAvLyBleHBlY3RpbmcgdGhlIGNsb3NpbmcgdG9rZW4gZWxzZSB3ZSB3aWxsIG5ldmVyIG1ha2UgcHJvZ3Jlc3MgaW4gdGhlIGNhc2Ugb2YgYW5cbiAgLy8gZXh0cmFuZW91cyBncm91cCBjbG9zaW5nIHN5bWJvbCAoc3VjaCBhcyBhIHN0cmF5ICcpJykuIFRoaXMgaXMgbm90IHRoZSBjYXNlIGZvciAnOycgYmVjYXVzZVxuICAvLyBwYXJzZUNoYWluKCkgaXMgYWx3YXlzIHRoZSByb290IHByb2R1Y3Rpb24gYW5kIGl0IGV4cGVjdHMgYSAnOycuXG5cbiAgLy8gSWYgYSBwcm9kdWN0aW9uIGV4cGVjdHMgb25lIG9mIHRoZXNlIHRva2VuIGl0IGluY3JlbWVudHMgdGhlIGNvcnJlc3BvbmRpbmcgbmVzdGluZyBjb3VudCxcbiAgLy8gYW5kIHRoZW4gZGVjcmVtZW50cyBpdCBqdXN0IHByaW9yIHRvIGNoZWNraW5nIGlmIHRoZSB0b2tlbiBpcyBpbiB0aGUgaW5wdXQuXG4gIHByaXZhdGUgc2tpcCgpIHtcbiAgICBsZXQgbiA9IHRoaXMubmV4dDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCAmJiAhbi5pc0NoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSAmJlxuICAgICAgICAgICAodGhpcy5ycGFyZW5zRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUlBBUkVOKSkgJiZcbiAgICAgICAgICAgKHRoaXMucmJyYWNlc0V4cGVjdGVkIDw9IDAgfHwgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDRSkpICYmXG4gICAgICAgICAgICh0aGlzLnJicmFja2V0c0V4cGVjdGVkIDw9IDAgfHwgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDS0VUKSkpIHtcbiAgICAgIGlmICh0aGlzLm5leHQuaXNFcnJvcigpKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlckVycm9yKFxuICAgICAgICAgICAgdGhpcy5uZXh0LnRvU3RyaW5nKCkgISwgdGhpcy5pbnB1dCwgdGhpcy5sb2NhdGlvblRleHQoKSwgdGhpcy5sb2NhdGlvbikpO1xuICAgICAgfVxuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBuID0gdGhpcy5uZXh0O1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpIHsgdGhpcy52aXNpdEFsbChhc3QuZXhwcmVzc2lvbnMpOyB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KSB7IHRoaXMudmlzaXRBbGwoYXN0LnZhbHVlcyk7IH1cblxuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpIHsgdGhpcy5lcnJvcnMucHVzaCgncGlwZXMnKTsgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0QWxsKGFzdHM6IGFueVtdKTogYW55W10geyByZXR1cm4gYXN0cy5tYXAobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTsgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UXVvdGUoYXN0OiBRdW90ZSwgY29udGV4dDogYW55KSB7fVxufVxuXG4vKipcbiAqIFRoaXMgY2xhc3MgZXh0ZW5kcyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciB1c2VkIGluIFZpZXcgRW5naW5lIGFuZCBwZXJmb3JtcyBtb3JlIHN0cmljdCBjaGVja3MgdG9cbiAqIG1ha2Ugc3VyZSBob3N0IGJpbmRpbmdzIGRvIG5vdCBjb250YWluIHBpcGVzLiBJbiBWaWV3IEVuZ2luZSwgaGF2aW5nIHBpcGVzIGluIGhvc3QgYmluZGluZ3MgaXNcbiAqIG5vdCBzdXBwb3J0ZWQgYXMgd2VsbCwgYnV0IGluIHNvbWUgY2FzZXMgKGxpa2UgYCEodmFsdWUgfCBhc3luYylgKSB0aGUgZXJyb3IgaXMgbm90IHRyaWdnZXJlZCBhdFxuICogY29tcGlsZSB0aW1lLiBJbiBvcmRlciB0byBwcmVzZXJ2ZSBWaWV3IEVuZ2luZSBiZWhhdmlvciwgbW9yZSBzdHJpY3QgY2hlY2tzIGFyZSBpbnRyb2R1Y2VkIGZvclxuICogSXZ5IG1vZGUgb25seS5cbiAqL1xuY2xhc3MgSXZ5U2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgZXh0ZW5kcyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciB7XG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5LCBjb250ZXh0OiBhbnkpIHtcbiAgICBhc3QubGVmdC52aXNpdCh0aGlzKTtcbiAgICBhc3QucmlnaHQudmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KSB7IGFzdC5leHByZXNzaW9uLnZpc2l0KHRoaXMpOyB9XG59XG4iXX0=