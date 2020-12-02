/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
    exports._ParseAST = exports.IvyParser = exports.Parser = exports.TemplateBindingParseResult = exports.SplitInterpolation = void 0;
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
            var _a = this.splitInterpolation(input, location, interpolationConfig), strings = _a.strings, expressions = _a.expressions, offsets = _a.offsets;
            if (expressions.length === 0)
                return null;
            var expressionNodes = [];
            for (var i = 0; i < expressions.length; ++i) {
                var expressionText = expressions[i].text;
                var sourceToLex = this._stripComments(expressionText);
                var tokens = this._lexer.tokenize(sourceToLex);
                var ast = new _ParseAST(input, location, absoluteOffset, tokens, sourceToLex.length, false, this.errors, offsets[i] + (expressionText.length - sourceToLex.length))
                    .parseChain();
                expressionNodes.push(ast);
            }
            return this.createInterpolationAst(strings.map(function (s) { return s.text; }), expressionNodes, input, location, absoluteOffset);
        };
        /**
         * Similar to `parseInterpolation`, but treats the provided string as a single expression
         * element that would normally appear within the interpolation prefix and suffix (`{{` and `}}`).
         * This is used for parsing the switch expression in ICUs.
         */
        Parser.prototype.parseInterpolationExpression = function (expression, location, absoluteOffset) {
            var sourceToLex = this._stripComments(expression);
            var tokens = this._lexer.tokenize(sourceToLex);
            var ast = new _ParseAST(expression, location, absoluteOffset, tokens, sourceToLex.length, 
            /* parseAction */ false, this.errors, 0)
                .parseChain();
            var strings = ['', '']; // The prefix and suffix strings are both empty
            return this.createInterpolationAst(strings, [ast], expression, location, absoluteOffset);
        };
        Parser.prototype.createInterpolationAst = function (strings, expressions, input, location, absoluteOffset) {
            var span = new ast_1.ParseSpan(0, input.length);
            var interpolation = new ast_1.Interpolation(span, span.toAbsolute(absoluteOffset), strings, expressions);
            return new ast_1.ASTWithSource(interpolation, input, location, absoluteOffset, this.errors);
        };
        /**
         * Splits a string of text into "raw" text segments and expressions present in interpolations in
         * the string.
         * Returns `null` if there are no interpolations, otherwise a
         * `SplitInterpolation` with splits that look like
         *   <raw text> <expression> <raw text> ... <raw text> <expression> <raw text>
         */
        Parser.prototype.splitInterpolation = function (input, location, interpolationConfig) {
            if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
            var strings = [];
            var expressions = [];
            var offsets = [];
            var i = 0;
            var atInterpolation = false;
            var extendLastString = false;
            var interpStart = interpolationConfig.start, interpEnd = interpolationConfig.end;
            while (i < input.length) {
                if (!atInterpolation) {
                    // parse until starting {{
                    var start = i;
                    i = input.indexOf(interpStart, i);
                    if (i === -1) {
                        i = input.length;
                    }
                    var text = input.substring(start, i);
                    strings.push({ text: text, start: start, end: i });
                    atInterpolation = true;
                }
                else {
                    // parse from starting {{ to ending }}
                    var fullStart = i;
                    var exprStart = fullStart + interpStart.length;
                    var exprEnd = input.indexOf(interpEnd, exprStart);
                    if (exprEnd === -1) {
                        // Could not find the end of the interpolation; do not parse an expression.
                        // Instead we should extend the content on the last raw string.
                        atInterpolation = false;
                        extendLastString = true;
                        break;
                    }
                    var fullEnd = exprEnd + interpEnd.length;
                    var text = input.substring(exprStart, exprEnd);
                    if (text.trim().length > 0) {
                        expressions.push({ text: text, start: fullStart, end: fullEnd });
                    }
                    else {
                        this._reportError('Blank expressions are not allowed in interpolated strings', input, "at column " + i + " in", location);
                        expressions.push({ text: '$implicit', start: fullStart, end: fullEnd });
                    }
                    offsets.push(exprStart);
                    i = fullEnd;
                    atInterpolation = false;
                }
            }
            if (!atInterpolation) {
                // If we are now at a text section, add the remaining content as a raw string.
                if (extendLastString) {
                    var piece = strings[strings.length - 1];
                    piece.text += input.substring(i);
                    piece.end = input.length;
                }
                else {
                    strings.push({ text: input.substring(i), start: i, end: input.length });
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
            this.context = ParseContextFlags.None;
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
            get: function () {
                return this.peek(0);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(_ParseAST.prototype, "atEOF", {
            /** Whether all the parser input has been processed. */
            get: function () {
                return this.index >= this.tokens.length;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(_ParseAST.prototype, "inputIndex", {
            /**
             * Index of the next token to be processed, or the end of the last token if all have been
             * processed.
             */
            get: function () {
                return this.atEOF ? this.currentEndIndex : this.next.index + this.offset;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(_ParseAST.prototype, "currentEndIndex", {
            /**
             * End index of the last processed token, or the start of the first token if none have been
             * processed.
             */
            get: function () {
                if (this.index > 0) {
                    var curToken = this.peek(-1);
                    return curToken.end + this.offset;
                }
                // No tokens have been processed yet; return the next token's start or the length of the input
                // if there is no token.
                if (this.tokens.length === 0) {
                    return this.inputLength + this.offset;
                }
                return this.next.index + this.offset;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(_ParseAST.prototype, "currentAbsoluteOffset", {
            /**
             * Returns the absolute offset of the start of the current token.
             */
            get: function () {
                return this.absoluteOffset + this.inputIndex;
            },
            enumerable: false,
            configurable: true
        });
        _ParseAST.prototype.span = function (start) {
            return new ast_1.ParseSpan(start, this.currentEndIndex);
        };
        _ParseAST.prototype.sourceSpan = function (start) {
            var serial = start + "@" + this.inputIndex;
            if (!this.sourceSpanCache.has(serial)) {
                this.sourceSpanCache.set(serial, this.span(start).toAbsolute(this.absoluteOffset));
            }
            return this.sourceSpanCache.get(serial);
        };
        _ParseAST.prototype.advance = function () {
            this.index++;
        };
        /**
         * Executes a callback in the provided context.
         */
        _ParseAST.prototype.withContext = function (context, cb) {
            this.context |= context;
            var ret = cb();
            this.context ^= context;
            return ret;
        };
        _ParseAST.prototype.consumeOptionalCharacter = function (code) {
            if (this.next.isCharacter(code)) {
                this.advance();
                return true;
            }
            else {
                return false;
            }
        };
        _ParseAST.prototype.peekKeywordLet = function () {
            return this.next.isKeywordLet();
        };
        _ParseAST.prototype.peekKeywordAs = function () {
            return this.next.isKeywordAs();
        };
        /**
         * Consumes an expected character, otherwise emits an error about the missing expected character
         * and skips over the token stream until reaching a recoverable point.
         *
         * See `this.error` and `this.skip` for more details.
         */
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
        _ParseAST.prototype.prettyPrintToken = function (tok) {
            return tok === lexer_1.EOF ? 'end of input' : "token " + tok;
        };
        _ParseAST.prototype.expectIdentifierOrKeyword = function () {
            var n = this.next;
            if (!n.isIdentifier() && !n.isKeyword()) {
                this.error("Unexpected " + this.prettyPrintToken(n) + ", expected identifier or keyword");
                return '';
            }
            this.advance();
            return n.toString();
        };
        _ParseAST.prototype.expectIdentifierOrKeywordOrString = function () {
            var n = this.next;
            if (!n.isIdentifier() && !n.isKeyword() && !n.isString()) {
                this.error("Unexpected " + this.prettyPrintToken(n) + ", expected identifier, keyword, or string");
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
        _ParseAST.prototype.parseExpression = function () {
            return this.parseConditional();
        };
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
                var result = void 0;
                switch (operator) {
                    case '+':
                        this.advance();
                        result = this.parsePrefix();
                        return ast_1.Unary.createPlus(this.span(start), this.sourceSpan(start), result);
                    case '-':
                        this.advance();
                        result = this.parsePrefix();
                        return ast_1.Unary.createMinus(this.span(start), this.sourceSpan(start), result);
                    case '!':
                        this.advance();
                        result = this.parsePrefix();
                        return new ast_1.PrefixNot(this.span(start), this.sourceSpan(start), result);
                }
            }
            return this.parseCallChain();
        };
        _ParseAST.prototype.parseCallChain = function () {
            var _this = this;
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
                    this.withContext(ParseContextFlags.Writable, function () {
                        _this.rbracketsExpected++;
                        var key = _this.parsePipe();
                        if (key instanceof ast_1.EmptyExpr) {
                            _this.error("Key access cannot be empty");
                        }
                        _this.rbracketsExpected--;
                        _this.expectCharacter(chars.$RBRACKET);
                        if (_this.consumeOptionalOperator('=')) {
                            var value = _this.parseConditional();
                            result = new ast_1.KeyedWrite(_this.span(resultStart), _this.sourceSpan(resultStart), result, key, value);
                        }
                        else {
                            result =
                                new ast_1.KeyedRead(_this.span(resultStart), _this.sourceSpan(resultStart), result, key);
                        }
                    });
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
                return new ast_1.ThisReceiver(this.span(start), this.sourceSpan(start));
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
            var _this = this;
            if (isSafe === void 0) { isSafe = false; }
            var start = receiver.span.start;
            var nameStart = this.inputIndex;
            var id = this.withContext(ParseContextFlags.Writable, function () {
                var id = _this.expectIdentifierOrKeyword();
                if (id.length === 0) {
                    _this.error("Expected identifier for property access", receiver.span.end);
                }
                return id;
            });
            var nameSpan = this.sourceSpan(nameStart);
            if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                this.rparensExpected++;
                var args = this.parseCallArguments();
                this.expectCharacter(chars.$RPAREN);
                this.rparensExpected--;
                var span = this.span(start);
                var sourceSpan = this.sourceSpan(start);
                return isSafe ? new ast_1.SafeMethodCall(span, sourceSpan, nameSpan, receiver, id, args) :
                    new ast_1.MethodCall(span, sourceSpan, nameSpan, receiver, id, args);
            }
            else {
                if (isSafe) {
                    if (this.consumeOptionalOperator('=')) {
                        this.error('The \'?.\' operator cannot be used in the assignment');
                        return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
                    }
                    else {
                        return new ast_1.SafePropertyRead(this.span(start), this.sourceSpan(start), nameSpan, receiver, id);
                    }
                }
                else {
                    if (this.consumeOptionalOperator('=')) {
                        if (!this.parseAction) {
                            this.error('Bindings cannot contain assignments');
                            return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
                        }
                        var value = this.parseConditional();
                        return new ast_1.PropertyWrite(this.span(start), this.sourceSpan(start), nameSpan, receiver, id, value);
                    }
                    else {
                        return new ast_1.PropertyRead(this.span(start), this.sourceSpan(start), nameSpan, receiver, id);
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
                        key.source =
                            templateKey.source + key.source.charAt(0).toUpperCase() + key.source.substring(1);
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
            var _a = ast.span, start = _a.start, end = _a.end;
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
        /**
         * Records an error and skips over the token stream until reaching a recoverable point. See
         * `this.skip` for more details on token skipping.
         */
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
        _ParseAST.prototype.skip = function () {
            var n = this.next;
            while (this.index < this.tokens.length && !n.isCharacter(chars.$SEMICOLON) &&
                !n.isOperator('|') && (this.rparensExpected <= 0 || !n.isCharacter(chars.$RPAREN)) &&
                (this.rbracesExpected <= 0 || !n.isCharacter(chars.$RBRACE)) &&
                (this.rbracketsExpected <= 0 || !n.isCharacter(chars.$RBRACKET)) &&
                (!(this.context & ParseContextFlags.Writable) || !n.isOperator('='))) {
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
        SimpleExpressionChecker.prototype.visitThisReceiver = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitInterpolation = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitLiteralPrimitive = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitPropertyRead = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitPropertyWrite = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitSafePropertyRead = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitMethodCall = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitSafeMethodCall = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitFunctionCall = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitLiteralArray = function (ast, context) {
            this.visitAll(ast.expressions, context);
        };
        SimpleExpressionChecker.prototype.visitLiteralMap = function (ast, context) {
            this.visitAll(ast.values, context);
        };
        SimpleExpressionChecker.prototype.visitUnary = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitBinary = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitPrefixNot = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitNonNullAssert = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitConditional = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitPipe = function (ast, context) {
            this.errors.push('pipes');
        };
        SimpleExpressionChecker.prototype.visitKeyedRead = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitKeyedWrite = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitAll = function (asts, context) {
            var _this = this;
            return asts.map(function (node) { return node.visit(_this, context); });
        };
        SimpleExpressionChecker.prototype.visitChain = function (ast, context) { };
        SimpleExpressionChecker.prototype.visitQuote = function (ast, context) { };
        return SimpleExpressionChecker;
    }());
    /**
     * This class implements SimpleExpressionChecker used in View Engine and performs more strict checks
     * to make sure host bindings do not contain pipes. In View Engine, having pipes in host bindings is
     * not supported as well, but in some cases (like `!(value | async)`) the error is not triggered at
     * compile time. In order to preserve View Engine behavior, more strict checks are introduced for
     * Ivy mode only.
     */
    var IvySimpleExpressionChecker = /** @class */ (function (_super) {
        tslib_1.__extends(IvySimpleExpressionChecker, _super);
        function IvySimpleExpressionChecker() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.errors = [];
            return _this;
        }
        IvySimpleExpressionChecker.prototype.visitPipe = function () {
            this.errors.push('pipes');
        };
        return IvySimpleExpressionChecker;
    }(ast_1.RecursiveAstVisitor));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbURBQWtDO0lBQ2xDLDZGQUFvRztJQUNwRyxtREFBcUM7SUFFckMsbUVBQTRmO0lBQzVmLHVFQUE0RTtJQU81RTtRQUNFLDRCQUNXLE9BQTZCLEVBQVMsV0FBaUMsRUFDdkUsT0FBaUI7WUFEakIsWUFBTyxHQUFQLE9BQU8sQ0FBc0I7WUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBc0I7WUFDdkUsWUFBTyxHQUFQLE9BQU8sQ0FBVTtRQUFHLENBQUM7UUFDbEMseUJBQUM7SUFBRCxDQUFDLEFBSkQsSUFJQztJQUpZLGdEQUFrQjtJQU0vQjtRQUNFLG9DQUNXLGdCQUFtQyxFQUFTLFFBQWtCLEVBQzlELE1BQXFCO1lBRHJCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7WUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFVO1lBQzlELFdBQU0sR0FBTixNQUFNLENBQWU7UUFBRyxDQUFDO1FBQ3RDLGlDQUFDO0lBQUQsQ0FBQyxBQUpELElBSUM7SUFKWSxnRUFBMEI7SUFNdkMsSUFBTSx3QkFBd0IsR0FBRyx3QkFBd0IsQ0FBQyxtREFBNEIsQ0FBQyxDQUFDO0lBQ3hGLFNBQVMscUJBQXFCLENBQUMsTUFBMkI7UUFDeEQsSUFBSSxNQUFNLEtBQUssbURBQTRCLEVBQUU7WUFDM0MsT0FBTyx3QkFBd0IsQ0FBQztTQUNqQzthQUFNO1lBQ0wsT0FBTyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN6QztJQUNILENBQUM7SUFFRCxTQUFTLHdCQUF3QixDQUFDLE1BQTJCO1FBQzNELElBQU0sT0FBTyxHQUFHLG1CQUFZLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLGNB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ZixVQUFnQixHQUFlLEVBQUUsT0FBWSxJQUFHLENBQUM7UUFFakQsMENBQVEsR0FBUixVQUFTLElBQVcsRUFBRSxPQUFZO1lBQWxDLGlCQUVDO1lBREMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLEVBQUUsT0FBTyxDQUFDLEVBQXpCLENBQXlCLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBRUQsNENBQVUsR0FBVixVQUFXLEdBQVUsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUV2Qyw0Q0FBVSxHQUFWLFVBQVcsR0FBVSxFQUFFLE9BQVksSUFBRyxDQUFDO1FBQ3pDLDhCQUFDO0lBQUQsQ0FBQyxBQXhERCxJQXdEQztJQUVEOzs7Ozs7T0FNRztJQUNIO1FBQXlDLHNEQUFtQjtRQUE1RDtZQUFBLHFFQU1DO1lBTEMsWUFBTSxHQUFhLEVBQUUsQ0FBQzs7UUFLeEIsQ0FBQztRQUhDLDhDQUFTLEdBQVQ7WUFDRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM1QixDQUFDO1FBQ0gsaUNBQUM7SUFBRCxDQUFDLEFBTkQsQ0FBeUMseUJBQW1CLEdBTTNEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoYXJzIGZyb20gJy4uL2NoYXJzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7ZXNjYXBlUmVnRXhwfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtBYnNvbHV0ZVNvdXJjZVNwYW4sIEFTVCwgQXN0VmlzaXRvciwgQVNUV2l0aFNvdXJjZSwgQmluYXJ5LCBCaW5kaW5nUGlwZSwgQ2hhaW4sIENvbmRpdGlvbmFsLCBFbXB0eUV4cHIsIEV4cHJlc3Npb25CaW5kaW5nLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIEtleWVkUmVhZCwgS2V5ZWRXcml0ZSwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsTWFwS2V5LCBMaXRlcmFsUHJpbWl0aXZlLCBNZXRob2RDYWxsLCBOb25OdWxsQXNzZXJ0LCBQYXJzZXJFcnJvciwgUGFyc2VTcGFuLCBQcmVmaXhOb3QsIFByb3BlcnR5UmVhZCwgUHJvcGVydHlXcml0ZSwgUXVvdGUsIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsIFNhZmVNZXRob2RDYWxsLCBTYWZlUHJvcGVydHlSZWFkLCBUZW1wbGF0ZUJpbmRpbmcsIFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIsIFRoaXNSZWNlaXZlciwgVW5hcnksIFZhcmlhYmxlQmluZGluZ30gZnJvbSAnLi9hc3QnO1xuaW1wb3J0IHtFT0YsIGlzSWRlbnRpZmllciwgaXNRdW90ZSwgTGV4ZXIsIFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4vbGV4ZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIEludGVycG9sYXRpb25QaWVjZSB7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG59XG5leHBvcnQgY2xhc3MgU3BsaXRJbnRlcnBvbGF0aW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3RyaW5nczogSW50ZXJwb2xhdGlvblBpZWNlW10sIHB1YmxpYyBleHByZXNzaW9uczogSW50ZXJwb2xhdGlvblBpZWNlW10sXG4gICAgICBwdWJsaWMgb2Zmc2V0czogbnVtYmVyW10pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHRlbXBsYXRlQmluZGluZ3M6IFRlbXBsYXRlQmluZGluZ1tdLCBwdWJsaWMgd2FybmluZ3M6IHN0cmluZ1tdLFxuICAgICAgcHVibGljIGVycm9yczogUGFyc2VyRXJyb3JbXSkge31cbn1cblxuY29uc3QgZGVmYXVsdEludGVycG9sYXRlUmVnRXhwID0gX2NyZWF0ZUludGVycG9sYXRlUmVnRXhwKERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpO1xuZnVuY3Rpb24gX2dldEludGVycG9sYXRlUmVnRXhwKGNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IFJlZ0V4cCB7XG4gIGlmIChjb25maWcgPT09IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpIHtcbiAgICByZXR1cm4gZGVmYXVsdEludGVycG9sYXRlUmVnRXhwO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBfY3JlYXRlSW50ZXJwb2xhdGVSZWdFeHAoY29uZmlnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfY3JlYXRlSW50ZXJwb2xhdGVSZWdFeHAoY29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogUmVnRXhwIHtcbiAgY29uc3QgcGF0dGVybiA9IGVzY2FwZVJlZ0V4cChjb25maWcuc3RhcnQpICsgJyhbXFxcXHNcXFxcU10qPyknICsgZXNjYXBlUmVnRXhwKGNvbmZpZy5lbmQpO1xuICByZXR1cm4gbmV3IFJlZ0V4cChwYXR0ZXJuLCAnZycpO1xufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VyIHtcbiAgcHJpdmF0ZSBlcnJvcnM6IFBhcnNlckVycm9yW10gPSBbXTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9sZXhlcjogTGV4ZXIpIHt9XG5cbiAgc2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgPSBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlcjtcblxuICBwYXJzZUFjdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIHRoaXMuX2NoZWNrTm9JbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZSh0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KSk7XG4gICAgY29uc3QgYXN0ID0gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsIHRydWUsIHRoaXMuZXJyb3JzLFxuICAgICAgICAgICAgICAgICAgICBpbnB1dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcGFyc2VCaW5kaW5nKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VCaW5kaW5nQXN0KGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tTaW1wbGVFeHByZXNzaW9uKGFzdDogQVNUKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGNoZWNrZXIgPSBuZXcgdGhpcy5zaW1wbGVFeHByZXNzaW9uQ2hlY2tlcigpO1xuICAgIGFzdC52aXNpdChjaGVja2VyKTtcbiAgICByZXR1cm4gY2hlY2tlci5lcnJvcnM7XG4gIH1cblxuICBwYXJzZVNpbXBsZUJpbmRpbmcoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUJpbmRpbmdBc3QoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3QgZXJyb3JzID0gdGhpcy5jaGVja1NpbXBsZUV4cHJlc3Npb24oYXN0KTtcbiAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBIb3N0IGJpbmRpbmcgZXhwcmVzc2lvbiBjYW5ub3QgY29udGFpbiAke2Vycm9ycy5qb2luKCcgJyl9YCwgaW5wdXQsIGxvY2F0aW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3IobWVzc2FnZTogc3RyaW5nLCBpbnB1dDogc3RyaW5nLCBlcnJMb2NhdGlvbjogc3RyaW5nLCBjdHhMb2NhdGlvbj86IHN0cmluZykge1xuICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlckVycm9yKG1lc3NhZ2UsIGlucHV0LCBlcnJMb2NhdGlvbiwgY3R4TG9jYXRpb24pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQmluZGluZ0FzdChcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogQVNUIHtcbiAgICAvLyBRdW90ZXMgZXhwcmVzc2lvbnMgdXNlIDNyZC1wYXJ0eSBleHByZXNzaW9uIGxhbmd1YWdlLiBXZSBkb24ndCB3YW50IHRvIHVzZVxuICAgIC8vIG91ciBsZXhlciBvciBwYXJzZXIgZm9yIHRoYXQsIHNvIHdlIGNoZWNrIGZvciB0aGF0IGFoZWFkIG9mIHRpbWUuXG4gICAgY29uc3QgcXVvdGUgPSB0aGlzLl9wYXJzZVF1b3RlKGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQpO1xuXG4gICAgaWYgKHF1b3RlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiBxdW90ZTtcbiAgICB9XG5cbiAgICB0aGlzLl9jaGVja05vSW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCk7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUoc291cmNlVG9MZXgpO1xuICAgIHJldHVybiBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsIGZhbHNlLCB0aGlzLmVycm9ycyxcbiAgICAgICAgICAgICAgIGlucHV0Lmxlbmd0aCAtIHNvdXJjZVRvTGV4Lmxlbmd0aClcbiAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUXVvdGUoaW5wdXQ6IHN0cmluZ3xudWxsLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTogQVNUfG51bGwge1xuICAgIGlmIChpbnB1dCA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBwcmVmaXhTZXBhcmF0b3JJbmRleCA9IGlucHV0LmluZGV4T2YoJzonKTtcbiAgICBpZiAocHJlZml4U2VwYXJhdG9ySW5kZXggPT0gLTEpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHByZWZpeCA9IGlucHV0LnN1YnN0cmluZygwLCBwcmVmaXhTZXBhcmF0b3JJbmRleCkudHJpbSgpO1xuICAgIGlmICghaXNJZGVudGlmaWVyKHByZWZpeCkpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uID0gaW5wdXQuc3Vic3RyaW5nKHByZWZpeFNlcGFyYXRvckluZGV4ICsgMSk7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4oMCwgaW5wdXQubGVuZ3RoKTtcbiAgICByZXR1cm4gbmV3IFF1b3RlKFxuICAgICAgICBzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBwcmVmaXgsIHVuaW50ZXJwcmV0ZWRFeHByZXNzaW9uLCBsb2NhdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgbWljcm9zeW50YXggdGVtcGxhdGUgZXhwcmVzc2lvbiBhbmQgcmV0dXJuIGEgbGlzdCBvZiBiaW5kaW5ncyBvclxuICAgKiBwYXJzaW5nIGVycm9ycyBpbiBjYXNlIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGludmFsaWQuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICA8ZGl2ICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zXCI+XG4gICAqICAgICAgICAgXiAgICAgIF4gYWJzb2x1dGVWYWx1ZU9mZnNldCBmb3IgYHRlbXBsYXRlVmFsdWVgXG4gICAqICAgICAgICAgYWJzb2x1dGVLZXlPZmZzZXQgZm9yIGB0ZW1wbGF0ZUtleWBcbiAgICogYGBgXG4gICAqIGNvbnRhaW5zIHRocmVlIGJpbmRpbmdzOlxuICAgKiAxLiBuZ0ZvciAtPiBudWxsXG4gICAqIDIuIGl0ZW0gLT4gTmdGb3JPZkNvbnRleHQuJGltcGxpY2l0XG4gICAqIDMuIG5nRm9yT2YgLT4gaXRlbXNcbiAgICpcbiAgICogVGhpcyBpcyBhcHBhcmVudCBmcm9tIHRoZSBkZS1zdWdhcmVkIHRlbXBsYXRlOlxuICAgKiBgYGBcbiAgICogICA8bmctdGVtcGxhdGUgbmdGb3IgbGV0LWl0ZW0gW25nRm9yT2ZdPVwiaXRlbXNcIj5cbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZUtleSBuYW1lIG9mIGRpcmVjdGl2ZSwgd2l0aG91dCB0aGUgKiBwcmVmaXguIEZvciBleGFtcGxlOiBuZ0lmLCBuZ0ZvclxuICAgKiBAcGFyYW0gdGVtcGxhdGVWYWx1ZSBSSFMgb2YgdGhlIG1pY3Jvc3ludGF4IGF0dHJpYnV0ZVxuICAgKiBAcGFyYW0gdGVtcGxhdGVVcmwgdGVtcGxhdGUgZmlsZW5hbWUgaWYgaXQncyBleHRlcm5hbCwgY29tcG9uZW50IGZpbGVuYW1lIGlmIGl0J3MgaW5saW5lXG4gICAqIEBwYXJhbSBhYnNvbHV0ZUtleU9mZnNldCBzdGFydCBvZiB0aGUgYHRlbXBsYXRlS2V5YFxuICAgKiBAcGFyYW0gYWJzb2x1dGVWYWx1ZU9mZnNldCBzdGFydCBvZiB0aGUgYHRlbXBsYXRlVmFsdWVgXG4gICAqL1xuICBwYXJzZVRlbXBsYXRlQmluZGluZ3MoXG4gICAgICB0ZW1wbGF0ZUtleTogc3RyaW5nLCB0ZW1wbGF0ZVZhbHVlOiBzdHJpbmcsIHRlbXBsYXRlVXJsOiBzdHJpbmcsIGFic29sdXRlS2V5T2Zmc2V0OiBudW1iZXIsXG4gICAgICBhYnNvbHV0ZVZhbHVlT2Zmc2V0OiBudW1iZXIpOiBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUodGVtcGxhdGVWYWx1ZSk7XG4gICAgY29uc3QgcGFyc2VyID0gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgdGVtcGxhdGVWYWx1ZSwgdGVtcGxhdGVVcmwsIGFic29sdXRlVmFsdWVPZmZzZXQsIHRva2VucywgdGVtcGxhdGVWYWx1ZS5sZW5ndGgsXG4gICAgICAgIGZhbHNlIC8qIHBhcnNlQWN0aW9uICovLCB0aGlzLmVycm9ycywgMCAvKiByZWxhdGl2ZSBvZmZzZXQgKi8pO1xuICAgIHJldHVybiBwYXJzZXIucGFyc2VUZW1wbGF0ZUJpbmRpbmdzKHtcbiAgICAgIHNvdXJjZTogdGVtcGxhdGVLZXksXG4gICAgICBzcGFuOiBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKGFic29sdXRlS2V5T2Zmc2V0LCBhYnNvbHV0ZUtleU9mZnNldCArIHRlbXBsYXRlS2V5Lmxlbmd0aCksXG4gICAgfSk7XG4gIH1cblxuICBwYXJzZUludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlfG51bGwge1xuICAgIGNvbnN0IHtzdHJpbmdzLCBleHByZXNzaW9ucywgb2Zmc2V0c30gPVxuICAgICAgICB0aGlzLnNwbGl0SW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGlmIChleHByZXNzaW9ucy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZXhwcmVzc2lvbk5vZGVzOiBBU1RbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHByZXNzaW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgY29uc3QgZXhwcmVzc2lvblRleHQgPSBleHByZXNzaW9uc1tpXS50ZXh0O1xuICAgICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGV4cHJlc3Npb25UZXh0KTtcbiAgICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHNvdXJjZVRvTGV4KTtcbiAgICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgICAgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsIGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JzLCBvZmZzZXRzW2ldICsgKGV4cHJlc3Npb25UZXh0Lmxlbmd0aCAtIHNvdXJjZVRvTGV4Lmxlbmd0aCkpXG4gICAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICAgIGV4cHJlc3Npb25Ob2Rlcy5wdXNoKGFzdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlSW50ZXJwb2xhdGlvbkFzdChcbiAgICAgICAgc3RyaW5ncy5tYXAocyA9PiBzLnRleHQpLCBleHByZXNzaW9uTm9kZXMsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNpbWlsYXIgdG8gYHBhcnNlSW50ZXJwb2xhdGlvbmAsIGJ1dCB0cmVhdHMgdGhlIHByb3ZpZGVkIHN0cmluZyBhcyBhIHNpbmdsZSBleHByZXNzaW9uXG4gICAqIGVsZW1lbnQgdGhhdCB3b3VsZCBub3JtYWxseSBhcHBlYXIgd2l0aGluIHRoZSBpbnRlcnBvbGF0aW9uIHByZWZpeCBhbmQgc3VmZml4IChge3tgIGFuZCBgfX1gKS5cbiAgICogVGhpcyBpcyB1c2VkIGZvciBwYXJzaW5nIHRoZSBzd2l0Y2ggZXhwcmVzc2lvbiBpbiBJQ1VzLlxuICAgKi9cbiAgcGFyc2VJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihleHByZXNzaW9uOiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOlxuICAgICAgQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGV4cHJlc3Npb24pO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHNvdXJjZVRvTGV4KTtcbiAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICBleHByZXNzaW9uLCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAvKiBwYXJzZUFjdGlvbiAqLyBmYWxzZSwgdGhpcy5lcnJvcnMsIDApXG4gICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgY29uc3Qgc3RyaW5ncyA9IFsnJywgJyddOyAgLy8gVGhlIHByZWZpeCBhbmQgc3VmZml4IHN0cmluZ3MgYXJlIGJvdGggZW1wdHlcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVJbnRlcnBvbGF0aW9uQXN0KHN0cmluZ3MsIFthc3RdLCBleHByZXNzaW9uLCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVJbnRlcnBvbGF0aW9uQXN0KFxuICAgICAgc3RyaW5nczogc3RyaW5nW10sIGV4cHJlc3Npb25zOiBBU1RbXSwgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZyxcbiAgICAgIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dC5sZW5ndGgpO1xuICAgIGNvbnN0IGludGVycG9sYXRpb24gPVxuICAgICAgICBuZXcgSW50ZXJwb2xhdGlvbihzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBzdHJpbmdzLCBleHByZXNzaW9ucyk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGludGVycG9sYXRpb24sIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTcGxpdHMgYSBzdHJpbmcgb2YgdGV4dCBpbnRvIFwicmF3XCIgdGV4dCBzZWdtZW50cyBhbmQgZXhwcmVzc2lvbnMgcHJlc2VudCBpbiBpbnRlcnBvbGF0aW9ucyBpblxuICAgKiB0aGUgc3RyaW5nLlxuICAgKiBSZXR1cm5zIGBudWxsYCBpZiB0aGVyZSBhcmUgbm8gaW50ZXJwb2xhdGlvbnMsIG90aGVyd2lzZSBhXG4gICAqIGBTcGxpdEludGVycG9sYXRpb25gIHdpdGggc3BsaXRzIHRoYXQgbG9vayBsaWtlXG4gICAqICAgPHJhdyB0ZXh0PiA8ZXhwcmVzc2lvbj4gPHJhdyB0ZXh0PiAuLi4gPHJhdyB0ZXh0PiA8ZXhwcmVzc2lvbj4gPHJhdyB0ZXh0PlxuICAgKi9cbiAgc3BsaXRJbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZyxcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogU3BsaXRJbnRlcnBvbGF0aW9uIHtcbiAgICBjb25zdCBzdHJpbmdzOiBJbnRlcnBvbGF0aW9uUGllY2VbXSA9IFtdO1xuICAgIGNvbnN0IGV4cHJlc3Npb25zOiBJbnRlcnBvbGF0aW9uUGllY2VbXSA9IFtdO1xuICAgIGNvbnN0IG9mZnNldHM6IG51bWJlcltdID0gW107XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCBhdEludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICBsZXQgZXh0ZW5kTGFzdFN0cmluZyA9IGZhbHNlO1xuICAgIGxldCB7c3RhcnQ6IGludGVycFN0YXJ0LCBlbmQ6IGludGVycEVuZH0gPSBpbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAgIHdoaWxlIChpIDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgICAvLyBwYXJzZSB1bnRpbCBzdGFydGluZyB7e1xuICAgICAgICBjb25zdCBzdGFydCA9IGk7XG4gICAgICAgIGkgPSBpbnB1dC5pbmRleE9mKGludGVycFN0YXJ0LCBpKTtcbiAgICAgICAgaWYgKGkgPT09IC0xKSB7XG4gICAgICAgICAgaSA9IGlucHV0Lmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0ZXh0ID0gaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBpKTtcbiAgICAgICAgc3RyaW5ncy5wdXNoKHt0ZXh0LCBzdGFydCwgZW5kOiBpfSk7XG5cbiAgICAgICAgYXRJbnRlcnBvbGF0aW9uID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBhcnNlIGZyb20gc3RhcnRpbmcge3sgdG8gZW5kaW5nIH19XG4gICAgICAgIGNvbnN0IGZ1bGxTdGFydCA9IGk7XG4gICAgICAgIGNvbnN0IGV4cHJTdGFydCA9IGZ1bGxTdGFydCArIGludGVycFN0YXJ0Lmxlbmd0aDtcbiAgICAgICAgY29uc3QgZXhwckVuZCA9IGlucHV0LmluZGV4T2YoaW50ZXJwRW5kLCBleHByU3RhcnQpO1xuICAgICAgICBpZiAoZXhwckVuZCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyBDb3VsZCBub3QgZmluZCB0aGUgZW5kIG9mIHRoZSBpbnRlcnBvbGF0aW9uOyBkbyBub3QgcGFyc2UgYW4gZXhwcmVzc2lvbi5cbiAgICAgICAgICAvLyBJbnN0ZWFkIHdlIHNob3VsZCBleHRlbmQgdGhlIGNvbnRlbnQgb24gdGhlIGxhc3QgcmF3IHN0cmluZy5cbiAgICAgICAgICBhdEludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICAgICAgICBleHRlbmRMYXN0U3RyaW5nID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdWxsRW5kID0gZXhwckVuZCArIGludGVycEVuZC5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgdGV4dCA9IGlucHV0LnN1YnN0cmluZyhleHByU3RhcnQsIGV4cHJFbmQpO1xuICAgICAgICBpZiAodGV4dC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGV4cHJlc3Npb25zLnB1c2goe3RleHQsIHN0YXJ0OiBmdWxsU3RhcnQsIGVuZDogZnVsbEVuZH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAnQmxhbmsgZXhwcmVzc2lvbnMgYXJlIG5vdCBhbGxvd2VkIGluIGludGVycG9sYXRlZCBzdHJpbmdzJywgaW5wdXQsXG4gICAgICAgICAgICAgIGBhdCBjb2x1bW4gJHtpfSBpbmAsIGxvY2F0aW9uKTtcbiAgICAgICAgICBleHByZXNzaW9ucy5wdXNoKHt0ZXh0OiAnJGltcGxpY2l0Jywgc3RhcnQ6IGZ1bGxTdGFydCwgZW5kOiBmdWxsRW5kfSk7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0cy5wdXNoKGV4cHJTdGFydCk7XG5cbiAgICAgICAgaSA9IGZ1bGxFbmQ7XG4gICAgICAgIGF0SW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgLy8gSWYgd2UgYXJlIG5vdyBhdCBhIHRleHQgc2VjdGlvbiwgYWRkIHRoZSByZW1haW5pbmcgY29udGVudCBhcyBhIHJhdyBzdHJpbmcuXG4gICAgICBpZiAoZXh0ZW5kTGFzdFN0cmluZykge1xuICAgICAgICBjb25zdCBwaWVjZSA9IHN0cmluZ3Nbc3RyaW5ncy5sZW5ndGggLSAxXTtcbiAgICAgICAgcGllY2UudGV4dCArPSBpbnB1dC5zdWJzdHJpbmcoaSk7XG4gICAgICAgIHBpZWNlLmVuZCA9IGlucHV0Lmxlbmd0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0cmluZ3MucHVzaCh7dGV4dDogaW5wdXQuc3Vic3RyaW5nKGkpLCBzdGFydDogaSwgZW5kOiBpbnB1dC5sZW5ndGh9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTcGxpdEludGVycG9sYXRpb24oc3RyaW5ncywgZXhwcmVzc2lvbnMsIG9mZnNldHMpO1xuICB9XG5cbiAgd3JhcExpdGVyYWxQcmltaXRpdmUoaW5wdXQ6IHN0cmluZ3xudWxsLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTpcbiAgICAgIEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0ID09IG51bGwgPyAwIDogaW5wdXQubGVuZ3RoKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoXG4gICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIGlucHV0KSwgaW5wdXQsIGxvY2F0aW9uLFxuICAgICAgICBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3RyaXBDb21tZW50cyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBpID0gdGhpcy5fY29tbWVudFN0YXJ0KGlucHV0KTtcbiAgICByZXR1cm4gaSAhPSBudWxsID8gaW5wdXQuc3Vic3RyaW5nKDAsIGkpLnRyaW0oKSA6IGlucHV0O1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tbWVudFN0YXJ0KGlucHV0OiBzdHJpbmcpOiBudW1iZXJ8bnVsbCB7XG4gICAgbGV0IG91dGVyUXVvdGU6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgY29uc3QgY2hhciA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG4gICAgICBjb25zdCBuZXh0Q2hhciA9IGlucHV0LmNoYXJDb2RlQXQoaSArIDEpO1xuXG4gICAgICBpZiAoY2hhciA9PT0gY2hhcnMuJFNMQVNIICYmIG5leHRDaGFyID09IGNoYXJzLiRTTEFTSCAmJiBvdXRlclF1b3RlID09IG51bGwpIHJldHVybiBpO1xuXG4gICAgICBpZiAob3V0ZXJRdW90ZSA9PT0gY2hhcikge1xuICAgICAgICBvdXRlclF1b3RlID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAob3V0ZXJRdW90ZSA9PSBudWxsICYmIGlzUXVvdGUoY2hhcikpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IGNoYXI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfY2hlY2tOb0ludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogdm9pZCB7XG4gICAgY29uc3QgcmVnZXhwID0gX2dldEludGVycG9sYXRlUmVnRXhwKGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IHBhcnRzID0gaW5wdXQuc3BsaXQocmVnZXhwKTtcbiAgICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYEdvdCBpbnRlcnBvbGF0aW9uICgke2ludGVycG9sYXRpb25Db25maWcuc3RhcnR9JHtcbiAgICAgICAgICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZy5lbmR9KSB3aGVyZSBleHByZXNzaW9uIHdhcyBleHBlY3RlZGAsXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgYGF0IGNvbHVtbiAke3RoaXMuX2ZpbmRJbnRlcnBvbGF0aW9uRXJyb3JDb2x1bW4ocGFydHMsIDEsIGludGVycG9sYXRpb25Db25maWcpfSBpbmAsXG4gICAgICAgICAgbG9jYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRJbnRlcnBvbGF0aW9uRXJyb3JDb2x1bW4oXG4gICAgICBwYXJ0czogc3RyaW5nW10sIHBhcnRJbkVycklkeDogbnVtYmVyLCBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnKTogbnVtYmVyIHtcbiAgICBsZXQgZXJyTG9jYXRpb24gPSAnJztcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBhcnRJbkVycklkeDsgaisrKSB7XG4gICAgICBlcnJMb2NhdGlvbiArPSBqICUgMiA9PT0gMCA/XG4gICAgICAgICAgcGFydHNbal0gOlxuICAgICAgICAgIGAke2ludGVycG9sYXRpb25Db25maWcuc3RhcnR9JHtwYXJ0c1tqXX0ke2ludGVycG9sYXRpb25Db25maWcuZW5kfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVyckxvY2F0aW9uLmxlbmd0aDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSXZ5UGFyc2VyIGV4dGVuZHMgUGFyc2VyIHtcbiAgc2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgPSBJdnlTaW1wbGVFeHByZXNzaW9uQ2hlY2tlcjsgIC8vXG59XG5cbi8qKiBEZXNjcmliZXMgYSBzdGF0ZWZ1bCBjb250ZXh0IGFuIGV4cHJlc3Npb24gcGFyc2VyIGlzIGluLiAqL1xuZW51bSBQYXJzZUNvbnRleHRGbGFncyB7XG4gIE5vbmUgPSAwLFxuICAvKipcbiAgICogQSBXcml0YWJsZSBjb250ZXh0IGlzIG9uZSBpbiB3aGljaCBhIHZhbHVlIG1heSBiZSB3cml0dGVuIHRvIGFuIGx2YWx1ZS5cbiAgICogRm9yIGV4YW1wbGUsIGFmdGVyIHdlIHNlZSBhIHByb3BlcnR5IGFjY2Vzcywgd2UgbWF5IGV4cGVjdCBhIHdyaXRlIHRvIHRoZVxuICAgKiBwcm9wZXJ0eSB2aWEgdGhlIFwiPVwiIG9wZXJhdG9yLlxuICAgKiAgIHByb3BcbiAgICogICAgICAgIF4gcG9zc2libGUgXCI9XCIgYWZ0ZXJcbiAgICovXG4gIFdyaXRhYmxlID0gMSxcbn1cblxuZXhwb3J0IGNsYXNzIF9QYXJzZUFTVCB7XG4gIHByaXZhdGUgcnBhcmVuc0V4cGVjdGVkID0gMDtcbiAgcHJpdmF0ZSByYnJhY2tldHNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNlc0V4cGVjdGVkID0gMDtcbiAgcHJpdmF0ZSBjb250ZXh0ID0gUGFyc2VDb250ZXh0RmxhZ3MuTm9uZTtcblxuICAvLyBDYWNoZSBvZiBleHByZXNzaW9uIHN0YXJ0IGFuZCBpbnB1dCBpbmRlY2VzIHRvIHRoZSBhYnNvbHV0ZSBzb3VyY2Ugc3BhbiB0aGV5IG1hcCB0bywgdXNlZCB0b1xuICAvLyBwcmV2ZW50IGNyZWF0aW5nIHN1cGVyZmx1b3VzIHNvdXJjZSBzcGFucyBpbiBgc291cmNlU3BhbmAuXG4gIC8vIEEgc2VyaWFsIG9mIHRoZSBleHByZXNzaW9uIHN0YXJ0IGFuZCBpbnB1dCBpbmRleCBpcyB1c2VkIGZvciBtYXBwaW5nIGJlY2F1c2UgYm90aCBhcmUgc3RhdGVmdWxcbiAgLy8gYW5kIG1heSBjaGFuZ2UgZm9yIHN1YnNlcXVlbnQgZXhwcmVzc2lvbnMgdmlzaXRlZCBieSB0aGUgcGFyc2VyLlxuICBwcml2YXRlIHNvdXJjZVNwYW5DYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBBYnNvbHV0ZVNvdXJjZVNwYW4+KCk7XG5cbiAgaW5kZXg6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaW5wdXQ6IHN0cmluZywgcHVibGljIGxvY2F0aW9uOiBzdHJpbmcsIHB1YmxpYyBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgcHVibGljIHRva2VuczogVG9rZW5bXSwgcHVibGljIGlucHV0TGVuZ3RoOiBudW1iZXIsIHB1YmxpYyBwYXJzZUFjdGlvbjogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgZXJyb3JzOiBQYXJzZXJFcnJvcltdLCBwcml2YXRlIG9mZnNldDogbnVtYmVyKSB7fVxuXG4gIHBlZWsob2Zmc2V0OiBudW1iZXIpOiBUb2tlbiB7XG4gICAgY29uc3QgaSA9IHRoaXMuaW5kZXggKyBvZmZzZXQ7XG4gICAgcmV0dXJuIGkgPCB0aGlzLnRva2Vucy5sZW5ndGggPyB0aGlzLnRva2Vuc1tpXSA6IEVPRjtcbiAgfVxuXG4gIGdldCBuZXh0KCk6IFRva2VuIHtcbiAgICByZXR1cm4gdGhpcy5wZWVrKDApO1xuICB9XG5cbiAgLyoqIFdoZXRoZXIgYWxsIHRoZSBwYXJzZXIgaW5wdXQgaGFzIGJlZW4gcHJvY2Vzc2VkLiAqL1xuICBnZXQgYXRFT0YoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZXggPj0gdGhpcy50b2tlbnMubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIEluZGV4IG9mIHRoZSBuZXh0IHRva2VuIHRvIGJlIHByb2Nlc3NlZCwgb3IgdGhlIGVuZCBvZiB0aGUgbGFzdCB0b2tlbiBpZiBhbGwgaGF2ZSBiZWVuXG4gICAqIHByb2Nlc3NlZC5cbiAgICovXG4gIGdldCBpbnB1dEluZGV4KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuYXRFT0YgPyB0aGlzLmN1cnJlbnRFbmRJbmRleCA6IHRoaXMubmV4dC5pbmRleCArIHRoaXMub2Zmc2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIEVuZCBpbmRleCBvZiB0aGUgbGFzdCBwcm9jZXNzZWQgdG9rZW4sIG9yIHRoZSBzdGFydCBvZiB0aGUgZmlyc3QgdG9rZW4gaWYgbm9uZSBoYXZlIGJlZW5cbiAgICogcHJvY2Vzc2VkLlxuICAgKi9cbiAgZ2V0IGN1cnJlbnRFbmRJbmRleCgpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLmluZGV4ID4gMCkge1xuICAgICAgY29uc3QgY3VyVG9rZW4gPSB0aGlzLnBlZWsoLTEpO1xuICAgICAgcmV0dXJuIGN1clRva2VuLmVuZCArIHRoaXMub2Zmc2V0O1xuICAgIH1cbiAgICAvLyBObyB0b2tlbnMgaGF2ZSBiZWVuIHByb2Nlc3NlZCB5ZXQ7IHJldHVybiB0aGUgbmV4dCB0b2tlbidzIHN0YXJ0IG9yIHRoZSBsZW5ndGggb2YgdGhlIGlucHV0XG4gICAgLy8gaWYgdGhlcmUgaXMgbm8gdG9rZW4uXG4gICAgaWYgKHRoaXMudG9rZW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuaW5wdXRMZW5ndGggKyB0aGlzLm9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pbmRleCArIHRoaXMub2Zmc2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGFic29sdXRlIG9mZnNldCBvZiB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgdG9rZW4uXG4gICAqL1xuICBnZXQgY3VycmVudEFic29sdXRlT2Zmc2V0KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuYWJzb2x1dGVPZmZzZXQgKyB0aGlzLmlucHV0SW5kZXg7XG4gIH1cblxuICBzcGFuKHN0YXJ0OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbmV3IFBhcnNlU3BhbihzdGFydCwgdGhpcy5jdXJyZW50RW5kSW5kZXgpO1xuICB9XG5cbiAgc291cmNlU3BhbihzdGFydDogbnVtYmVyKTogQWJzb2x1dGVTb3VyY2VTcGFuIHtcbiAgICBjb25zdCBzZXJpYWwgPSBgJHtzdGFydH1AJHt0aGlzLmlucHV0SW5kZXh9YDtcbiAgICBpZiAoIXRoaXMuc291cmNlU3BhbkNhY2hlLmhhcyhzZXJpYWwpKSB7XG4gICAgICB0aGlzLnNvdXJjZVNwYW5DYWNoZS5zZXQoc2VyaWFsLCB0aGlzLnNwYW4oc3RhcnQpLnRvQWJzb2x1dGUodGhpcy5hYnNvbHV0ZU9mZnNldCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zb3VyY2VTcGFuQ2FjaGUuZ2V0KHNlcmlhbCkhO1xuICB9XG5cbiAgYWR2YW5jZSgpIHtcbiAgICB0aGlzLmluZGV4Kys7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZXMgYSBjYWxsYmFjayBpbiB0aGUgcHJvdmlkZWQgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgd2l0aENvbnRleHQ8VD4oY29udGV4dDogUGFyc2VDb250ZXh0RmxhZ3MsIGNiOiAoKSA9PiBUKTogVCB7XG4gICAgdGhpcy5jb250ZXh0IHw9IGNvbnRleHQ7XG4gICAgY29uc3QgcmV0ID0gY2IoKTtcbiAgICB0aGlzLmNvbnRleHQgXj0gY29udGV4dDtcbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5leHQuaXNDaGFyYWN0ZXIoY29kZSkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBwZWVrS2V5d29yZExldCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5uZXh0LmlzS2V5d29yZExldCgpO1xuICB9XG4gIHBlZWtLZXl3b3JkQXMoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pc0tleXdvcmRBcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN1bWVzIGFuIGV4cGVjdGVkIGNoYXJhY3Rlciwgb3RoZXJ3aXNlIGVtaXRzIGFuIGVycm9yIGFib3V0IHRoZSBtaXNzaW5nIGV4cGVjdGVkIGNoYXJhY3RlclxuICAgKiBhbmQgc2tpcHMgb3ZlciB0aGUgdG9rZW4gc3RyZWFtIHVudGlsIHJlYWNoaW5nIGEgcmVjb3ZlcmFibGUgcG9pbnQuXG4gICAqXG4gICAqIFNlZSBgdGhpcy5lcnJvcmAgYW5kIGB0aGlzLnNraXBgIGZvciBtb3JlIGRldGFpbHMuXG4gICAqL1xuICBleHBlY3RDaGFyYWN0ZXIoY29kZTogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNvZGUpKSByZXR1cm47XG4gICAgdGhpcy5lcnJvcihgTWlzc2luZyBleHBlY3RlZCAke1N0cmluZy5mcm9tQ2hhckNvZGUoY29kZSl9YCk7XG4gIH1cblxuICBjb25zdW1lT3B0aW9uYWxPcGVyYXRvcihvcDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMubmV4dC5pc09wZXJhdG9yKG9wKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGV4cGVjdE9wZXJhdG9yKG9wZXJhdG9yOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcihvcGVyYXRvcikpIHJldHVybjtcbiAgICB0aGlzLmVycm9yKGBNaXNzaW5nIGV4cGVjdGVkIG9wZXJhdG9yICR7b3BlcmF0b3J9YCk7XG4gIH1cblxuICBwcmV0dHlQcmludFRva2VuKHRvazogVG9rZW4pOiBzdHJpbmcge1xuICAgIHJldHVybiB0b2sgPT09IEVPRiA/ICdlbmQgb2YgaW5wdXQnIDogYHRva2VuICR7dG9rfWA7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk6IHN0cmluZyB7XG4gICAgY29uc3QgbiA9IHRoaXMubmV4dDtcbiAgICBpZiAoIW4uaXNJZGVudGlmaWVyKCkgJiYgIW4uaXNLZXl3b3JkKCkpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgJHt0aGlzLnByZXR0eVByaW50VG9rZW4obil9LCBleHBlY3RlZCBpZGVudGlmaWVyIG9yIGtleXdvcmRgKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG4udG9TdHJpbmcoKSBhcyBzdHJpbmc7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSAmJiAhbi5pc1N0cmluZygpKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkICR7dGhpcy5wcmV0dHlQcmludFRva2VuKG4pfSwgZXhwZWN0ZWQgaWRlbnRpZmllciwga2V5d29yZCwgb3Igc3RyaW5nYCk7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuLnRvU3RyaW5nKCkgYXMgc3RyaW5nO1xuICB9XG5cbiAgcGFyc2VDaGFpbigpOiBBU1Qge1xuICAgIGNvbnN0IGV4cHJzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHdoaWxlICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBleHByID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIGV4cHJzLnB1c2goZXhwcik7XG5cbiAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICBpZiAoIXRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5nIGV4cHJlc3Npb24gY2Fubm90IGNvbnRhaW4gY2hhaW5lZCBleHByZXNzaW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRTRU1JQ09MT04pKSB7XG4gICAgICAgIH0gIC8vIHJlYWQgYWxsIHNlbWljb2xvbnNcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICcke3RoaXMubmV4dH0nYCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChleHBycy5sZW5ndGggPT0gMCkgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgaWYgKGV4cHJzLmxlbmd0aCA9PSAxKSByZXR1cm4gZXhwcnNbMF07XG4gICAgcmV0dXJuIG5ldyBDaGFpbih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBleHBycyk7XG4gIH1cblxuICBwYXJzZVBpcGUoKTogQVNUIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignfCcpKSB7XG4gICAgICBpZiAodGhpcy5wYXJzZUFjdGlvbikge1xuICAgICAgICB0aGlzLmVycm9yKCdDYW5ub3QgaGF2ZSBhIHBpcGUgaW4gYW4gYWN0aW9uIGV4cHJlc3Npb24nKTtcbiAgICAgIH1cblxuICAgICAgZG8ge1xuICAgICAgICBjb25zdCBuYW1lU3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTtcbiAgICAgICAgY29uc3QgbmFtZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4obmFtZVN0YXJ0KTtcbiAgICAgICAgY29uc3QgYXJnczogQVNUW10gPSBbXTtcbiAgICAgICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgICBhcmdzLnB1c2godGhpcy5wYXJzZUV4cHJlc3Npb24oKSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgbmV3IEJpbmRpbmdQaXBlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgbmFtZSwgYXJncywgbmFtZVNwYW4pO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignfCcpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uKCk6IEFTVCB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICB9XG5cbiAgcGFyc2VDb25kaXRpb25hbCgpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsT3IoKTtcblxuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc/JykpIHtcbiAgICAgIGNvbnN0IHllcyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBsZXQgbm86IEFTVDtcbiAgICAgIGlmICghdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKSkge1xuICAgICAgICBjb25zdCBlbmQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgZW5kKTtcbiAgICAgICAgdGhpcy5lcnJvcihgQ29uZGl0aW9uYWwgZXhwcmVzc2lvbiAke2V4cHJlc3Npb259IHJlcXVpcmVzIGFsbCAzIGV4cHJlc3Npb25zYCk7XG4gICAgICAgIG5vID0gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgQ29uZGl0aW9uYWwodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0LCB5ZXMsIG5vKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH1cblxuICBwYXJzZUxvZ2ljYWxPcigpOiBBU1Qge1xuICAgIC8vICd8fCdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKTtcbiAgICB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignfHwnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlTG9naWNhbEFuZCgpO1xuICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnfHwnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTG9naWNhbEFuZCgpOiBBU1Qge1xuICAgIC8vICcmJidcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG4gICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJyYmJykpIHtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG4gICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksICcmJicsIHJlc3VsdCwgcmlnaHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VFcXVhbGl0eSgpOiBBU1Qge1xuICAgIC8vICc9PScsJyE9JywnPT09JywnIT09J1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUmVsYXRpb25hbCgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICc9PSc6XG4gICAgICAgIGNhc2UgJz09PSc6XG4gICAgICAgIGNhc2UgJyE9JzpcbiAgICAgICAgY2FzZSAnIT09JzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VSZWxhdGlvbmFsKCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZVJlbGF0aW9uYWwoKTogQVNUIHtcbiAgICAvLyAnPCcsICc+JywgJzw9JywgJz49J1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlQWRkaXRpdmUoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnPCc6XG4gICAgICAgIGNhc2UgJz4nOlxuICAgICAgICBjYXNlICc8PSc6XG4gICAgICAgIGNhc2UgJz49JzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VBZGRpdGl2ZSgpOiBBU1Qge1xuICAgIC8vICcrJywgJy0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgbGV0IHJpZ2h0ID0gdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZU11bHRpcGxpY2F0aXZlKCk6IEFTVCB7XG4gICAgLy8gJyonLCAnJScsICcvJ1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJyonOlxuICAgICAgICBjYXNlICclJzpcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgbGV0IHJpZ2h0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VQcmVmaXgoKTogQVNUIHtcbiAgICBpZiAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgbGV0IHJlc3VsdDogQVNUO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgcmV0dXJuIFVuYXJ5LmNyZWF0ZVBsdXModGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBVbmFyeS5jcmVhdGVNaW51cyh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgICBjYXNlICchJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcmVmaXhOb3QodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFyc2VDYWxsQ2hhaW4oKTtcbiAgfVxuXG4gIHBhcnNlQ2FsbENoYWluKCk6IEFTVCB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VQcmltYXJ5KCk7XG4gICAgY29uc3QgcmVzdWx0U3RhcnQgPSByZXN1bHQuc3Bhbi5zdGFydDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRQRVJJT0QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwocmVzdWx0LCBmYWxzZSk7XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPy4nKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgdHJ1ZSk7XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgICB0aGlzLndpdGhDb250ZXh0KFBhcnNlQ29udGV4dEZsYWdzLldyaXRhYmxlLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZCsrO1xuICAgICAgICAgIGNvbnN0IGtleSA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICAgICAgaWYgKGtleSBpbnN0YW5jZW9mIEVtcHR5RXhwcikge1xuICAgICAgICAgICAgdGhpcy5lcnJvcihgS2V5IGFjY2VzcyBjYW5ub3QgYmUgZW1wdHlgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBLZXllZFdyaXRlKFxuICAgICAgICAgICAgICAgIHRoaXMuc3BhbihyZXN1bHRTdGFydCksIHRoaXMuc291cmNlU3BhbihyZXN1bHRTdGFydCksIHJlc3VsdCwga2V5LCB2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdCA9XG4gICAgICAgICAgICAgICAgbmV3IEtleWVkUmVhZCh0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQrKztcbiAgICAgICAgY29uc3QgYXJncyA9IHRoaXMucGFyc2VDYWxsQXJndW1lbnRzKCk7XG4gICAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgbmV3IEZ1bmN0aW9uQ2FsbCh0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGFyZ3MpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJyEnKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgTm9uTnVsbEFzc2VydCh0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQpO1xuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBhcnNlUHJpbWFyeSgpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkTnVsbCgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBudWxsKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFVuZGVmaW5lZCgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB2b2lkIDApO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkVHJ1ZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB0cnVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZEZhbHNlKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGZhbHNlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRoaXMoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IFRoaXNSZWNlaXZlcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0tFVCkpIHtcbiAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IGVsZW1lbnRzID0gdGhpcy5wYXJzZUV4cHJlc3Npb25MaXN0KGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICB0aGlzLnJicmFja2V0c0V4cGVjdGVkLS07XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsQXJyYXkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZWxlbWVudHMpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNDaGFyYWN0ZXIoY2hhcnMuJExCUkFDRSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlTGl0ZXJhbE1hcCgpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNJZGVudGlmaWVyKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKFxuICAgICAgICAgIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc051bWJlcigpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRoaXMubmV4dC50b051bWJlcigpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdmFsdWUpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNTdHJpbmcoKSkge1xuICAgICAgY29uc3QgbGl0ZXJhbFZhbHVlID0gdGhpcy5uZXh0LnRvU3RyaW5nKCk7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBsaXRlcmFsVmFsdWUpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmluZGV4ID49IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCBlbmQgb2YgZXhwcmVzc2lvbjogJHt0aGlzLmlucHV0fWApO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgdG9rZW4gJHt0aGlzLm5leHR9YCk7XG4gICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZUV4cHJlc3Npb25MaXN0KHRlcm1pbmF0b3I6IG51bWJlcik6IEFTVFtdIHtcbiAgICBjb25zdCByZXN1bHQ6IEFTVFtdID0gW107XG4gICAgaWYgKCF0aGlzLm5leHQuaXNDaGFyYWN0ZXIodGVybWluYXRvcikpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgcmVzdWx0LnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTGl0ZXJhbE1hcCgpOiBMaXRlcmFsTWFwIHtcbiAgICBjb25zdCBrZXlzOiBMaXRlcmFsTWFwS2V5W10gPSBbXTtcbiAgICBjb25zdCB2YWx1ZXM6IEFTVFtdID0gW107XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJExCUkFDRSk7XG4gICAgaWYgKCF0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkge1xuICAgICAgdGhpcy5yYnJhY2VzRXhwZWN0ZWQrKztcbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgcXVvdGVkID0gdGhpcy5uZXh0LmlzU3RyaW5nKCk7XG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICAgIGtleXMucHVzaCh7a2V5LCBxdW90ZWR9KTtcbiAgICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKTtcbiAgICAgICAgdmFsdWVzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICAgIHRoaXMucmJyYWNlc0V4cGVjdGVkLS07XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNFKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsTWFwKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGtleXMsIHZhbHVlcyk7XG4gIH1cblxuICBwYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChyZWNlaXZlcjogQVNULCBpc1NhZmU6IGJvb2xlYW4gPSBmYWxzZSk6IEFTVCB7XG4gICAgY29uc3Qgc3RhcnQgPSByZWNlaXZlci5zcGFuLnN0YXJ0O1xuICAgIGNvbnN0IG5hbWVTdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBjb25zdCBpZCA9IHRoaXMud2l0aENvbnRleHQoUGFyc2VDb250ZXh0RmxhZ3MuV3JpdGFibGUsICgpID0+IHtcbiAgICAgIGNvbnN0IGlkID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk7XG4gICAgICBpZiAoaWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMuZXJyb3IoYEV4cGVjdGVkIGlkZW50aWZpZXIgZm9yIHByb3BlcnR5IGFjY2Vzc2AsIHJlY2VpdmVyLnNwYW4uZW5kKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpZDtcbiAgICB9KTtcbiAgICBjb25zdCBuYW1lU3BhbiA9IHRoaXMuc291cmNlU3BhbihuYW1lU3RhcnQpO1xuXG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgYXJncyA9IHRoaXMucGFyc2VDYWxsQXJndW1lbnRzKCk7XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICBjb25zdCBzcGFuID0gdGhpcy5zcGFuKHN0YXJ0KTtcbiAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpO1xuICAgICAgcmV0dXJuIGlzU2FmZSA/IG5ldyBTYWZlTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCBuYW1lU3BhbiwgcmVjZWl2ZXIsIGlkLCBhcmdzKSA6XG4gICAgICAgICAgICAgICAgICAgICAgbmV3IE1ldGhvZENhbGwoc3Bhbiwgc291cmNlU3BhbiwgbmFtZVNwYW4sIHJlY2VpdmVyLCBpZCwgYXJncyk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlzU2FmZSkge1xuICAgICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignVGhlIFxcJz8uXFwnIG9wZXJhdG9yIGNhbm5vdCBiZSB1c2VkIGluIHRoZSBhc3NpZ25tZW50Jyk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBTYWZlUHJvcGVydHlSZWFkKFxuICAgICAgICAgICAgICB0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBuYW1lU3BhbiwgcmVjZWl2ZXIsIGlkKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgIGlmICghdGhpcy5wYXJzZUFjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZ3MgY2Fubm90IGNvbnRhaW4gYXNzaWdubWVudHMnKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVdyaXRlKFxuICAgICAgICAgICAgICB0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBuYW1lU3BhbiwgcmVjZWl2ZXIsIGlkLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9wZXJ0eVJlYWQodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbmFtZVNwYW4sIHJlY2VpdmVyLCBpZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZUNhbGxBcmd1bWVudHMoKTogQmluZGluZ1BpcGVbXSB7XG4gICAgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3RlcihjaGFycy4kUlBBUkVOKSkgcmV0dXJuIFtdO1xuICAgIGNvbnN0IHBvc2l0aW9uYWxzOiBBU1RbXSA9IFtdO1xuICAgIGRvIHtcbiAgICAgIHBvc2l0aW9uYWxzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKSk7XG4gICAgcmV0dXJuIHBvc2l0aW9uYWxzIGFzIEJpbmRpbmdQaXBlW107XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIGFuIGlkZW50aWZpZXIsIGEga2V5d29yZCwgYSBzdHJpbmcgd2l0aCBhbiBvcHRpb25hbCBgLWAgaW4gYmV0d2VlbixcbiAgICogYW5kIHJldHVybnMgdGhlIHN0cmluZyBhbG9uZyB3aXRoIGl0cyBhYnNvbHV0ZSBzb3VyY2Ugc3Bhbi5cbiAgICovXG4gIGV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpOiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyIHtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgbGV0IG9wZXJhdG9yRm91bmQgPSBmYWxzZTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0O1xuICAgIGRvIHtcbiAgICAgIHJlc3VsdCArPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmRPclN0cmluZygpO1xuICAgICAgb3BlcmF0b3JGb3VuZCA9IHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJy0nKTtcbiAgICAgIGlmIChvcGVyYXRvckZvdW5kKSB7XG4gICAgICAgIHJlc3VsdCArPSAnLSc7XG4gICAgICB9XG4gICAgfSB3aGlsZSAob3BlcmF0b3JGb3VuZCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZTogcmVzdWx0LFxuICAgICAgc3BhbjogbmV3IEFic29sdXRlU291cmNlU3BhbihzdGFydCwgc3RhcnQgKyByZXN1bHQubGVuZ3RoKSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIG1pY3Jvc3ludGF4IHRlbXBsYXRlIGV4cHJlc3Npb24gYW5kIHJldHVybiBhIGxpc3Qgb2YgYmluZGluZ3Mgb3JcbiAgICogcGFyc2luZyBlcnJvcnMgaW4gY2FzZSB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBpcyBpbnZhbGlkLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgPGRpdiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtczsgaW5kZXggYXMgaTsgdHJhY2tCeTogZnVuY1wiPlxuICAgKiBgYGBcbiAgICogY29udGFpbnMgZml2ZSBiaW5kaW5nczpcbiAgICogMS4gbmdGb3IgLT4gbnVsbFxuICAgKiAyLiBpdGVtIC0+IE5nRm9yT2ZDb250ZXh0LiRpbXBsaWNpdFxuICAgKiAzLiBuZ0Zvck9mIC0+IGl0ZW1zXG4gICAqIDQuIGkgLT4gTmdGb3JPZkNvbnRleHQuaW5kZXhcbiAgICogNS4gbmdGb3JUcmFja0J5IC0+IGZ1bmNcbiAgICpcbiAgICogRm9yIGEgZnVsbCBkZXNjcmlwdGlvbiBvZiB0aGUgbWljcm9zeW50YXggZ3JhbW1hciwgc2VlXG4gICAqIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL21oZXZlcnkvZDM1MzAyOTRjZmYyZTRhMWIzZmUxNWZmNzVkMDg4NTVcbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlS2V5IG5hbWUgb2YgdGhlIG1pY3Jvc3ludGF4IGRpcmVjdGl2ZSwgbGlrZSBuZ0lmLCBuZ0ZvcixcbiAgICogd2l0aG91dCB0aGUgKiwgYWxvbmcgd2l0aCBpdHMgYWJzb2x1dGUgc3Bhbi5cbiAgICovXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyh0ZW1wbGF0ZUtleTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcik6IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcblxuICAgIC8vIFRoZSBmaXJzdCBiaW5kaW5nIGlzIGZvciB0aGUgdGVtcGxhdGUga2V5IGl0c2VsZlxuICAgIC8vIEluICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zXCIsIGtleSA9IFwibmdGb3JcIiwgdmFsdWUgPSBudWxsXG4gICAgLy8gSW4gKm5nSWY9XCJjb25kIHwgcGlwZVwiLCBrZXkgPSBcIm5nSWZcIiwgdmFsdWUgPSBcImNvbmQgfCBwaXBlXCJcbiAgICBiaW5kaW5ncy5wdXNoKC4uLnRoaXMucGFyc2VEaXJlY3RpdmVLZXl3b3JkQmluZGluZ3ModGVtcGxhdGVLZXkpKTtcblxuICAgIHdoaWxlICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICAvLyBJZiBpdCBzdGFydHMgd2l0aCAnbGV0JywgdGhlbiB0aGlzIG11c3QgYmUgdmFyaWFibGUgZGVjbGFyYXRpb25cbiAgICAgIGNvbnN0IGxldEJpbmRpbmcgPSB0aGlzLnBhcnNlTGV0QmluZGluZygpO1xuICAgICAgaWYgKGxldEJpbmRpbmcpIHtcbiAgICAgICAgYmluZGluZ3MucHVzaChsZXRCaW5kaW5nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFR3byBwb3NzaWJsZSBjYXNlcyBoZXJlLCBlaXRoZXIgYHZhbHVlIFwiYXNcIiBrZXlgIG9yXG4gICAgICAgIC8vIFwiZGlyZWN0aXZlLWtleXdvcmQgZXhwcmVzc2lvblwiLiBXZSBkb24ndCBrbm93IHdoaWNoIGNhc2UsIGJ1dCBib3RoXG4gICAgICAgIC8vIFwidmFsdWVcIiBhbmQgXCJkaXJlY3RpdmUta2V5d29yZFwiIGFyZSB0ZW1wbGF0ZSBiaW5kaW5nIGtleSwgc28gY29uc3VtZVxuICAgICAgICAvLyB0aGUga2V5IGZpcnN0LlxuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgICAgICAvLyBQZWVrIGF0IHRoZSBuZXh0IHRva2VuLCBpZiBpdCBpcyBcImFzXCIgdGhlbiB0aGlzIG11c3QgYmUgdmFyaWFibGVcbiAgICAgICAgLy8gZGVjbGFyYXRpb24uXG4gICAgICAgIGNvbnN0IGJpbmRpbmcgPSB0aGlzLnBhcnNlQXNCaW5kaW5nKGtleSk7XG4gICAgICAgIGlmIChiaW5kaW5nKSB7XG4gICAgICAgICAgYmluZGluZ3MucHVzaChiaW5kaW5nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBPdGhlcndpc2UgdGhlIGtleSBtdXN0IGJlIGEgZGlyZWN0aXZlIGtleXdvcmQsIGxpa2UgXCJvZlwiLiBUcmFuc2Zvcm1cbiAgICAgICAgICAvLyB0aGUga2V5IHRvIGFjdHVhbCBrZXkuIEVnLiBvZiAtPiBuZ0Zvck9mLCB0cmFja0J5IC0+IG5nRm9yVHJhY2tCeVxuICAgICAgICAgIGtleS5zb3VyY2UgPVxuICAgICAgICAgICAgICB0ZW1wbGF0ZUtleS5zb3VyY2UgKyBrZXkuc291cmNlLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsga2V5LnNvdXJjZS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgYmluZGluZ3MucHVzaCguLi50aGlzLnBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKGtleSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdChiaW5kaW5ncywgW10gLyogd2FybmluZ3MgKi8sIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBhIGRpcmVjdGl2ZSBrZXl3b3JkLCBmb2xsb3dlZCBieSBhIG1hbmRhdG9yeSBleHByZXNzaW9uLlxuICAgKiBGb3IgZXhhbXBsZSwgXCJvZiBpdGVtc1wiLCBcInRyYWNrQnk6IGZ1bmNcIi5cbiAgICogVGhlIGJpbmRpbmdzIGFyZTogbmdGb3JPZiAtPiBpdGVtcywgbmdGb3JUcmFja0J5IC0+IGZ1bmNcbiAgICogVGhlcmUgY291bGQgYmUgYW4gb3B0aW9uYWwgXCJhc1wiIGJpbmRpbmcgdGhhdCBmb2xsb3dzIHRoZSBleHByZXNzaW9uLlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXMgfCBzbGljZTowOjEgYXMgY29sbGVjdGlvblwiLlxuICAgKiAgICAgICAgICAgICAgICAgICAgXl4gXl5eXl5eXl5eXl5eXl5eXl4gXl5eXl5eXl5eXl5eXlxuICAgKiAgICAgICAgICAgICAgIGtleXdvcmQgICAgYm91bmQgdGFyZ2V0ICAgb3B0aW9uYWwgJ2FzJyBiaW5kaW5nXG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ga2V5IGJpbmRpbmcga2V5LCBmb3IgZXhhbXBsZSwgbmdGb3IsIG5nSWYsIG5nRm9yT2YsIGFsb25nIHdpdGggaXRzXG4gICAqIGFic29sdXRlIHNwYW4uXG4gICAqL1xuICBwcml2YXRlIHBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKGtleTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcik6IFRlbXBsYXRlQmluZGluZ1tdIHtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcbiAgICB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pOyAgLy8gdHJhY2tCeTogdHJhY2tCeUZ1bmN0aW9uXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk7XG4gICAgbGV0IHNwYW5FbmQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICAvLyBUaGUgYmluZGluZyBjb3VsZCBvcHRpb25hbGx5IGJlIGZvbGxvd2VkIGJ5IFwiYXNcIi4gRm9yIGV4YW1wbGUsXG4gICAgLy8gKm5nSWY9XCJjb25kIHwgcGlwZSBhcyB4XCIuIEluIHRoaXMgY2FzZSwgdGhlIGtleSBpbiB0aGUgXCJhc1wiIGJpbmRpbmdcbiAgICAvLyBpcyBcInhcIiBhbmQgdGhlIHZhbHVlIGlzIHRoZSB0ZW1wbGF0ZSBrZXkgaXRzZWxmIChcIm5nSWZcIikuIE5vdGUgdGhhdCB0aGVcbiAgICAvLyAna2V5JyBpbiB0aGUgY3VycmVudCBjb250ZXh0IG5vdyBiZWNvbWVzIHRoZSBcInZhbHVlXCIgaW4gdGhlIG5leHQgYmluZGluZy5cbiAgICBjb25zdCBhc0JpbmRpbmcgPSB0aGlzLnBhcnNlQXNCaW5kaW5nKGtleSk7XG4gICAgaWYgKCFhc0JpbmRpbmcpIHtcbiAgICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICAgIHNwYW5FbmQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oa2V5LnNwYW4uc3RhcnQsIHNwYW5FbmQpO1xuICAgIGJpbmRpbmdzLnB1c2gobmV3IEV4cHJlc3Npb25CaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpKTtcbiAgICBpZiAoYXNCaW5kaW5nKSB7XG4gICAgICBiaW5kaW5ncy5wdXNoKGFzQmluZGluZyk7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5ncztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGV4cHJlc3Npb24gQVNUIGZvciB0aGUgYm91bmQgdGFyZ2V0IG9mIGEgZGlyZWN0aXZlIGtleXdvcmRcbiAgICogYmluZGluZy4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0lmPVwiY29uZGl0aW9uIHwgcGlwZVwiXG4gICAqICAgICAgICAgIF5eXl5eXl5eXl5eXl5eXl4gYm91bmQgdGFyZ2V0IGZvciBcIm5nSWZcIlxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zXCJcbiAgICogICAgICAgICAgICAgICAgICAgICAgIF5eXl5eIGJvdW5kIHRhcmdldCBmb3IgXCJuZ0Zvck9mXCJcbiAgICogYGBgXG4gICAqL1xuICBwcml2YXRlIGdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgaWYgKHRoaXMubmV4dCA9PT0gRU9GIHx8IHRoaXMucGVla0tleXdvcmRBcygpIHx8IHRoaXMucGVla0tleXdvcmRMZXQoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGFzdCA9IHRoaXMucGFyc2VQaXBlKCk7ICAvLyBleGFtcGxlOiBcImNvbmRpdGlvbiB8IGFzeW5jXCJcbiAgICBjb25zdCB7c3RhcnQsIGVuZH0gPSBhc3Quc3BhbjtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIHZhbHVlLCB0aGlzLmxvY2F0aW9uLCB0aGlzLmFic29sdXRlT2Zmc2V0ICsgc3RhcnQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGJpbmRpbmcgZm9yIGEgdmFyaWFibGUgZGVjbGFyZWQgdXNpbmcgYGFzYC4gTm90ZSB0aGF0IHRoZSBvcmRlclxuICAgKiBvZiB0aGUga2V5LXZhbHVlIHBhaXIgaW4gdGhpcyBkZWNsYXJhdGlvbiBpcyByZXZlcnNlZC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpXCJcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBeXl5eXiAgICBeXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgICAga2V5XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgbmFtZSBvZiB0aGUgdmFsdWUgaW4gdGhlIGRlY2xhcmF0aW9uLCBcIm5nSWZcIiBpbiB0aGUgZXhhbXBsZVxuICAgKiBhYm92ZSwgYWxvbmcgd2l0aCBpdHMgYWJzb2x1dGUgc3Bhbi5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VBc0JpbmRpbmcodmFsdWU6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmd8bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBlZWtLZXl3b3JkQXMoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gY29uc3VtZSB0aGUgJ2FzJyBrZXl3b3JkXG4gICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4odmFsdWUuc3Bhbi5zdGFydCwgdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQpO1xuICAgIHJldHVybiBuZXcgVmFyaWFibGVCaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYmluZGluZyBmb3IgYSB2YXJpYWJsZSBkZWNsYXJlZCB1c2luZyBgbGV0YC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBsZXQgaT1pbmRleDtcIlxuICAgKiAgICAgICAgICAgXl5eXl5eXl4gICAgICAgICAgIF5eXl5eXl5eXl5eXG4gICAqIGBgYFxuICAgKiBJbiB0aGUgZmlyc3QgYmluZGluZywgYGl0ZW1gIGlzIGJvdW5kIHRvIGBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRgLlxuICAgKiBJbiB0aGUgc2Vjb25kIGJpbmRpbmcsIGBpYCBpcyBib3VuZCB0byBgTmdGb3JPZkNvbnRleHQuaW5kZXhgLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUxldEJpbmRpbmcoKTogVGVtcGxhdGVCaW5kaW5nfG51bGwge1xuICAgIGlmICghdGhpcy5wZWVrS2V5d29yZExldCgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc3BhblN0YXJ0ID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBjb25zdW1lIHRoZSAnbGV0JyBrZXl3b3JkXG4gICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICBsZXQgdmFsdWU6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgdmFsdWUgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIH1cbiAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oc3BhblN0YXJ0LCB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldCk7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3VtZSB0aGUgb3B0aW9uYWwgc3RhdGVtZW50IHRlcm1pbmF0b3I6IHNlbWljb2xvbiBvciBjb21tYS5cbiAgICovXG4gIHByaXZhdGUgY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKSB7XG4gICAgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgfHwgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvcmRzIGFuIGVycm9yIGFuZCBza2lwcyBvdmVyIHRoZSB0b2tlbiBzdHJlYW0gdW50aWwgcmVhY2hpbmcgYSByZWNvdmVyYWJsZSBwb2ludC4gU2VlXG4gICAqIGB0aGlzLnNraXBgIGZvciBtb3JlIGRldGFpbHMgb24gdG9rZW4gc2tpcHBpbmcuXG4gICAqL1xuICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIGluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihtZXNzYWdlLCB0aGlzLmlucHV0LCB0aGlzLmxvY2F0aW9uVGV4dChpbmRleCksIHRoaXMubG9jYXRpb24pKTtcbiAgICB0aGlzLnNraXAoKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9jYXRpb25UZXh0KGluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwpIHtcbiAgICBpZiAoaW5kZXggPT0gbnVsbCkgaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIHJldHVybiAoaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID8gYGF0IGNvbHVtbiAke3RoaXMudG9rZW5zW2luZGV4XS5pbmRleCArIDF9IGluYCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgYXQgdGhlIGVuZCBvZiB0aGUgZXhwcmVzc2lvbmA7XG4gIH1cblxuICAvKipcbiAgICogRXJyb3IgcmVjb3Zlcnkgc2hvdWxkIHNraXAgdG9rZW5zIHVudGlsIGl0IGVuY291bnRlcnMgYSByZWNvdmVyeSBwb2ludC5cbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgdHJlYXRlZCBhcyB1bmNvbmRpdGlvbmFsIHJlY292ZXJ5IHBvaW50czpcbiAgICogICAtIGVuZCBvZiBpbnB1dFxuICAgKiAgIC0gJzsnIChwYXJzZUNoYWluKCkgaXMgYWx3YXlzIHRoZSByb290IHByb2R1Y3Rpb24sIGFuZCBpdCBleHBlY3RzIGEgJzsnKVxuICAgKiAgIC0gJ3wnIChzaW5jZSBwaXBlcyBtYXkgYmUgY2hhaW5lZCBhbmQgZWFjaCBwaXBlIGV4cHJlc3Npb24gbWF5IGJlIHRyZWF0ZWQgaW5kZXBlbmRlbnRseSlcbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgY29uZGl0aW9uYWwgcmVjb3ZlcnkgcG9pbnRzOlxuICAgKiAgIC0gJyknLCAnfScsICddJyBpZiBvbmUgb2YgY2FsbGluZyBwcm9kdWN0aW9ucyBpcyBleHBlY3Rpbmcgb25lIG9mIHRoZXNlIHN5bWJvbHNcbiAgICogICAgIC0gVGhpcyBhbGxvd3Mgc2tpcCgpIHRvIHJlY292ZXIgZnJvbSBlcnJvcnMgc3VjaCBhcyAnKGEuKSArIDEnIGFsbG93aW5nIG1vcmUgb2YgdGhlIEFTVCB0b1xuICAgKiAgICAgICBiZSByZXRhaW5lZCAoaXQgZG9lc24ndCBza2lwIGFueSB0b2tlbnMgYXMgdGhlICcpJyBpcyByZXRhaW5lZCBiZWNhdXNlIG9mIHRoZSAnKCcgYmVnaW5zXG4gICAqICAgICAgIGFuICcoJyA8ZXhwcj4gJyknIHByb2R1Y3Rpb24pLlxuICAgKiAgICAgICBUaGUgcmVjb3ZlcnkgcG9pbnRzIG9mIGdyb3VwaW5nIHN5bWJvbHMgbXVzdCBiZSBjb25kaXRpb25hbCBhcyB0aGV5IG11c3QgYmUgc2tpcHBlZCBpZlxuICAgKiAgICAgICBub25lIG9mIHRoZSBjYWxsaW5nIHByb2R1Y3Rpb25zIGFyZSBub3QgZXhwZWN0aW5nIHRoZSBjbG9zaW5nIHRva2VuIGVsc2Ugd2Ugd2lsbCBuZXZlclxuICAgKiAgICAgICBtYWtlIHByb2dyZXNzIGluIHRoZSBjYXNlIG9mIGFuIGV4dHJhbmVvdXMgZ3JvdXAgY2xvc2luZyBzeW1ib2wgKHN1Y2ggYXMgYSBzdHJheSAnKScpLlxuICAgKiAgICAgICBUaGF0IGlzLCB3ZSBza2lwIGEgY2xvc2luZyBzeW1ib2wgaWYgd2UgYXJlIG5vdCBpbiBhIGdyb3VwaW5nIHByb2R1Y3Rpb24uXG4gICAqICAgLSAnPScgaW4gYSBgV3JpdGFibGVgIGNvbnRleHRcbiAgICogICAgIC0gSW4gdGhpcyBjb250ZXh0LCB3ZSBhcmUgYWJsZSB0byByZWNvdmVyIGFmdGVyIHNlZWluZyB0aGUgYD1gIG9wZXJhdG9yLCB3aGljaFxuICAgKiAgICAgICBzaWduYWxzIHRoZSBwcmVzZW5jZSBvZiBhbiBpbmRlcGVuZGVudCBydmFsdWUgZXhwcmVzc2lvbiBmb2xsb3dpbmcgdGhlIGA9YCBvcGVyYXRvci5cbiAgICpcbiAgICogSWYgYSBwcm9kdWN0aW9uIGV4cGVjdHMgb25lIG9mIHRoZXNlIHRva2VuIGl0IGluY3JlbWVudHMgdGhlIGNvcnJlc3BvbmRpbmcgbmVzdGluZyBjb3VudCxcbiAgICogYW5kIHRoZW4gZGVjcmVtZW50cyBpdCBqdXN0IHByaW9yIHRvIGNoZWNraW5nIGlmIHRoZSB0b2tlbiBpcyBpbiB0aGUgaW5wdXQuXG4gICAqL1xuICBwcml2YXRlIHNraXAoKSB7XG4gICAgbGV0IG4gPSB0aGlzLm5leHQ7XG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggJiYgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgJiZcbiAgICAgICAgICAgIW4uaXNPcGVyYXRvcignfCcpICYmICh0aGlzLnJwYXJlbnNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2VzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkgJiZcbiAgICAgICAgICAgKHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpKSAmJlxuICAgICAgICAgICAoISh0aGlzLmNvbnRleHQgJiBQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSkgfHwgIW4uaXNPcGVyYXRvcignPScpKSkge1xuICAgICAgaWYgKHRoaXMubmV4dC5pc0Vycm9yKCkpIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZXJFcnJvcih0aGlzLm5leHQudG9TdHJpbmcoKSEsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KCksIHRoaXMubG9jYXRpb24pKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbiA9IHRoaXMubmV4dDtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFRoaXNSZWNlaXZlcihhc3Q6IFRoaXNSZWNlaXZlciwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC52YWx1ZXMsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRVbmFyeShhc3Q6IFVuYXJ5LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaCgncGlwZXMnKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0QWxsKGFzdHM6IGFueVtdLCBjb250ZXh0OiBhbnkpOiBhbnlbXSB7XG4gICAgcmV0dXJuIGFzdHMubWFwKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSkge31cbn1cblxuLyoqXG4gKiBUaGlzIGNsYXNzIGltcGxlbWVudHMgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgdXNlZCBpbiBWaWV3IEVuZ2luZSBhbmQgcGVyZm9ybXMgbW9yZSBzdHJpY3QgY2hlY2tzXG4gKiB0byBtYWtlIHN1cmUgaG9zdCBiaW5kaW5ncyBkbyBub3QgY29udGFpbiBwaXBlcy4gSW4gVmlldyBFbmdpbmUsIGhhdmluZyBwaXBlcyBpbiBob3N0IGJpbmRpbmdzIGlzXG4gKiBub3Qgc3VwcG9ydGVkIGFzIHdlbGwsIGJ1dCBpbiBzb21lIGNhc2VzIChsaWtlIGAhKHZhbHVlIHwgYXN5bmMpYCkgdGhlIGVycm9yIGlzIG5vdCB0cmlnZ2VyZWQgYXRcbiAqIGNvbXBpbGUgdGltZS4gSW4gb3JkZXIgdG8gcHJlc2VydmUgVmlldyBFbmdpbmUgYmVoYXZpb3IsIG1vcmUgc3RyaWN0IGNoZWNrcyBhcmUgaW50cm9kdWNlZCBmb3JcbiAqIEl2eSBtb2RlIG9ubHkuXG4gKi9cbmNsYXNzIEl2eVNpbXBsZUV4cHJlc3Npb25DaGVja2VyIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFNpbXBsZUV4cHJlc3Npb25DaGVja2VyIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0UGlwZSgpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKCdwaXBlcycpO1xuICB9XG59XG4iXX0=