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
                    // parse from starting {{ to ending }} while ignoring content inside quotes.
                    var fullStart = i;
                    var exprStart = fullStart + interpStart.length;
                    var exprEnd = this._getExpressiondEndIndex(input, interpEnd, exprStart);
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
        /**
         * Finds the index of the end of an interpolation expression
         * while ignoring comments and quoted content.
         */
        Parser.prototype._getExpressiondEndIndex = function (input, expressionEnd, start) {
            var currentQuote = null;
            var escapeCount = 0;
            for (var i = start; i < input.length; i++) {
                var char = input[i];
                // Skip the characters inside quotes. Note that we only care about the
                // outer-most quotes matching up and we need to account for escape characters.
                if (lexer_1.isQuote(input.charCodeAt(i)) && (currentQuote === null || currentQuote === char) &&
                    escapeCount % 2 === 0) {
                    currentQuote = currentQuote === null ? char : null;
                }
                else if (currentQuote === null) {
                    if (input.startsWith(expressionEnd, i)) {
                        return i;
                    }
                    // Nothing else in the expression matters after we've
                    // hit a comment so look directly for the end token.
                    if (input.startsWith('//', i)) {
                        return input.indexOf(expressionEnd, i);
                    }
                }
                escapeCount = char === '\\' ? escapeCount + 1 : 0;
            }
            return -1;
        };
        return Parser;
    }());
    exports.Parser = Parser;
    var IvyParser = /** @class */ (function (_super) {
        tslib_1.__extends(IvyParser, _super);
        function IvyParser() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.simpleExpressionChecker = IvySimpleExpressionChecker;
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
            if (isSafe === void 0) { isSafe = false; }
            var start = receiver.span.start;
            var nameStart = this.inputIndex;
            var id = this.expectIdentifierOrKeyword();
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
         * Error recovery should skip tokens until it encounters a recovery point. skip() treats
         * the end of input and a ';' as unconditionally a recovery point. It also treats ')',
         * '}' and ']' as conditional recovery points if one of calling productions is expecting
         * one of these symbols. This allows skip() to recover from errors such as '(a.) + 1' allowing
         * more of the AST to be retained (it doesn't skip any tokens as the ')' is retained because
         * of the '(' begins an '(' <expr> ')' production). The recovery points of grouping symbols
         * must be conditional as they must be skipped if none of the calling productions are not
         * expecting the closing token else we will never make progress in the case of an
         * extraneous group closing symbol (such as a stray ')'). This is not the case for ';' because
         * parseChain() is always the root production and it expects a ';'.
         *
         * Furthermore, the presence of a stateful context can add more recovery points.
         *   - in a `Writable` context, we are able to recover after seeing the `=` operator, which
         *     signals the presence of an independent rvalue expression following the `=` operator.
         *
         * If a production expects one of these token it increments the corresponding nesting count,
         * and then decrements it just prior to checking if the token is in the input.
         */
        _ParseAST.prototype.skip = function () {
            var n = this.next;
            while (this.index < this.tokens.length && !n.isCharacter(chars.$SEMICOLON) &&
                (this.rparensExpected <= 0 || !n.isCharacter(chars.$RPAREN)) &&
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbURBQWtDO0lBQ2xDLDZGQUFvRztJQUNwRyxtREFBcUM7SUFFckMsbUVBQTRmO0lBQzVmLHVFQUE0RTtJQU81RTtRQUNFLDRCQUNXLE9BQTZCLEVBQVMsV0FBaUMsRUFDdkUsT0FBaUI7WUFEakIsWUFBTyxHQUFQLE9BQU8sQ0FBc0I7WUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBc0I7WUFDdkUsWUFBTyxHQUFQLE9BQU8sQ0FBVTtRQUFHLENBQUM7UUFDbEMseUJBQUM7SUFBRCxDQUFDLEFBSkQsSUFJQztJQUpZLGdEQUFrQjtJQU0vQjtRQUNFLG9DQUNXLGdCQUFtQyxFQUFTLFFBQWtCLEVBQzlELE1BQXFCO1lBRHJCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7WUFBUyxhQUFRLEdBQVIsUUFBUSxDQUFVO1lBQzlELFdBQU0sR0FBTixNQUFNLENBQWU7UUFBRyxDQUFDO1FBQ3RDLGlDQUFDO0lBQUQsQ0FBQyxBQUpELElBSUM7SUFKWSxnRUFBMEI7SUFNdkMsSUFBTSx3QkFBd0IsR0FBRyx3QkFBd0IsQ0FBQyxtREFBNEIsQ0FBQyxDQUFDO0lBQ3hGLFNBQVMscUJBQXFCLENBQUMsTUFBMkI7UUFDeEQsSUFBSSxNQUFNLEtBQUssbURBQTRCLEVBQUU7WUFDM0MsT0FBTyx3QkFBd0IsQ0FBQztTQUNqQzthQUFNO1lBQ0wsT0FBTyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN6QztJQUNILENBQUM7SUFFRCxTQUFTLHdCQUF3QixDQUFDLE1BQTJCO1FBQzNELElBQU0sT0FBTyxHQUFHLG1CQUFZLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLGNB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RUFBRSxPQUFZLElBQUcsQ0FBQztRQUN6Qyw4QkFBQztJQUFELENBQUMsQUF4REQsSUF3REM7SUFFRDs7Ozs7O09BTUc7SUFDSDtRQUF5QyxzREFBbUI7UUFBNUQ7WUFBQSxxRUFNQztZQUxDLFlBQU0sR0FBYSxFQUFFLENBQUM7O1FBS3hCLENBQUM7UUFIQyw4Q0FBUyxHQUFUO1lBQ0UsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUNILGlDQUFDO0lBQUQsQ0FBQyxBQU5ELENBQXlDLHlCQUFtQixHQU0zRCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGFycyBmcm9tICcuLi9jaGFycyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge2VzY2FwZVJlZ0V4cH0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7QWJzb2x1dGVTb3VyY2VTcGFuLCBBU1QsIEFzdFZpc2l0b3IsIEFTVFdpdGhTb3VyY2UsIEJpbmFyeSwgQmluZGluZ1BpcGUsIENoYWluLCBDb25kaXRpb25hbCwgRW1wdHlFeHByLCBFeHByZXNzaW9uQmluZGluZywgRnVuY3Rpb25DYWxsLCBJbXBsaWNpdFJlY2VpdmVyLCBJbnRlcnBvbGF0aW9uLCBLZXllZFJlYWQsIEtleWVkV3JpdGUsIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbE1hcEtleSwgTGl0ZXJhbFByaW1pdGl2ZSwgTWV0aG9kQ2FsbCwgTm9uTnVsbEFzc2VydCwgUGFyc2VyRXJyb3IsIFBhcnNlU3BhbiwgUHJlZml4Tm90LCBQcm9wZXJ0eVJlYWQsIFByb3BlcnR5V3JpdGUsIFF1b3RlLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBTYWZlTWV0aG9kQ2FsbCwgU2FmZVByb3BlcnR5UmVhZCwgVGVtcGxhdGVCaW5kaW5nLCBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyLCBUaGlzUmVjZWl2ZXIsIFVuYXJ5LCBWYXJpYWJsZUJpbmRpbmd9IGZyb20gJy4vYXN0JztcbmltcG9ydCB7RU9GLCBpc0lkZW50aWZpZXIsIGlzUXVvdGUsIExleGVyLCBUb2tlbiwgVG9rZW5UeXBlfSBmcm9tICcuL2xleGVyJztcblxuZXhwb3J0IGludGVyZmFjZSBJbnRlcnBvbGF0aW9uUGllY2Uge1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0OiBudW1iZXI7XG4gIGVuZDogbnVtYmVyO1xufVxuZXhwb3J0IGNsYXNzIFNwbGl0SW50ZXJwb2xhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHN0cmluZ3M6IEludGVycG9sYXRpb25QaWVjZVtdLCBwdWJsaWMgZXhwcmVzc2lvbnM6IEludGVycG9sYXRpb25QaWVjZVtdLFxuICAgICAgcHVibGljIG9mZnNldHM6IG51bWJlcltdKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSwgcHVibGljIHdhcm5pbmdzOiBzdHJpbmdbXSxcbiAgICAgIHB1YmxpYyBlcnJvcnM6IFBhcnNlckVycm9yW10pIHt9XG59XG5cbmNvbnN0IGRlZmF1bHRJbnRlcnBvbGF0ZVJlZ0V4cCA9IF9jcmVhdGVJbnRlcnBvbGF0ZVJlZ0V4cChERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTtcbmZ1bmN0aW9uIF9nZXRJbnRlcnBvbGF0ZVJlZ0V4cChjb25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBSZWdFeHAge1xuICBpZiAoY29uZmlnID09PSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKSB7XG4gICAgcmV0dXJuIGRlZmF1bHRJbnRlcnBvbGF0ZVJlZ0V4cDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gX2NyZWF0ZUludGVycG9sYXRlUmVnRXhwKGNvbmZpZyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2NyZWF0ZUludGVycG9sYXRlUmVnRXhwKGNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IFJlZ0V4cCB7XG4gIGNvbnN0IHBhdHRlcm4gPSBlc2NhcGVSZWdFeHAoY29uZmlnLnN0YXJ0KSArICcoW1xcXFxzXFxcXFNdKj8pJyArIGVzY2FwZVJlZ0V4cChjb25maWcuZW5kKTtcbiAgcmV0dXJuIG5ldyBSZWdFeHAocGF0dGVybiwgJ2cnKTtcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIHByaXZhdGUgZXJyb3JzOiBQYXJzZXJFcnJvcltdID0gW107XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfbGV4ZXI6IExleGVyKSB7fVxuXG4gIHNpbXBsZUV4cHJlc3Npb25DaGVja2VyID0gU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXI7XG5cbiAgcGFyc2VBY3Rpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICB0aGlzLl9jaGVja05vSW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCk7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUodGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCkpO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCB0cnVlLCB0aGlzLmVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICAucGFyc2VDaGFpbigpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHBhcnNlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrU2ltcGxlRXhwcmVzc2lvbihhc3Q6IEFTVCk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBjaGVja2VyID0gbmV3IHRoaXMuc2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIoKTtcbiAgICBhc3QudmlzaXQoY2hlY2tlcik7XG4gICAgcmV0dXJuIGNoZWNrZXIuZXJyb3JzO1xuICB9XG5cbiAgcGFyc2VTaW1wbGVCaW5kaW5nKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VCaW5kaW5nQXN0KGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IGVycm9ycyA9IHRoaXMuY2hlY2tTaW1wbGVFeHByZXNzaW9uKGFzdCk7XG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgSG9zdCBiaW5kaW5nIGV4cHJlc3Npb24gY2Fubm90IGNvbnRhaW4gJHtlcnJvcnMuam9pbignICcpfWAsIGlucHV0LCBsb2NhdGlvbik7XG4gICAgfVxuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcG9ydEVycm9yKG1lc3NhZ2U6IHN0cmluZywgaW5wdXQ6IHN0cmluZywgZXJyTG9jYXRpb246IHN0cmluZywgY3R4TG9jYXRpb24/OiBzdHJpbmcpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihtZXNzYWdlLCBpbnB1dCwgZXJyTG9jYXRpb24sIGN0eExvY2F0aW9uKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUJpbmRpbmdBc3QoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IEFTVCB7XG4gICAgLy8gUXVvdGVzIGV4cHJlc3Npb25zIHVzZSAzcmQtcGFydHkgZXhwcmVzc2lvbiBsYW5ndWFnZS4gV2UgZG9uJ3Qgd2FudCB0byB1c2VcbiAgICAvLyBvdXIgbGV4ZXIgb3IgcGFyc2VyIGZvciB0aGF0LCBzbyB3ZSBjaGVjayBmb3IgdGhhdCBhaGVhZCBvZiB0aW1lLlxuICAgIGNvbnN0IHF1b3RlID0gdGhpcy5fcGFyc2VRdW90ZShpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0KTtcblxuICAgIGlmIChxdW90ZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gcXVvdGU7XG4gICAgfVxuXG4gICAgdGhpcy5fY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHNvdXJjZVRvTGV4KTtcbiAgICByZXR1cm4gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSwgdGhpcy5lcnJvcnMsXG4gICAgICAgICAgICAgICBpbnB1dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpXG4gICAgICAgIC5wYXJzZUNoYWluKCk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVF1b3RlKGlucHV0OiBzdHJpbmd8bnVsbCwgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6IEFTVHxudWxsIHtcbiAgICBpZiAoaW5wdXQgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4U2VwYXJhdG9ySW5kZXggPSBpbnB1dC5pbmRleE9mKCc6Jyk7XG4gICAgaWYgKHByZWZpeFNlcGFyYXRvckluZGV4ID09IC0xKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBwcmVmaXggPSBpbnB1dC5zdWJzdHJpbmcoMCwgcHJlZml4U2VwYXJhdG9ySW5kZXgpLnRyaW0oKTtcbiAgICBpZiAoIWlzSWRlbnRpZmllcihwcmVmaXgpKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCB1bmludGVycHJldGVkRXhwcmVzc2lvbiA9IGlucHV0LnN1YnN0cmluZyhwcmVmaXhTZXBhcmF0b3JJbmRleCArIDEpO1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBRdW90ZShcbiAgICAgICAgc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgcHJlZml4LCB1bmludGVycHJldGVkRXhwcmVzc2lvbiwgbG9jYXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIG1pY3Jvc3ludGF4IHRlbXBsYXRlIGV4cHJlc3Npb24gYW5kIHJldHVybiBhIGxpc3Qgb2YgYmluZGluZ3Mgb3JcbiAgICogcGFyc2luZyBlcnJvcnMgaW4gY2FzZSB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBpcyBpbnZhbGlkLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgPGRpdiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiPlxuICAgKiAgICAgICAgIF4gICAgICBeIGFic29sdXRlVmFsdWVPZmZzZXQgZm9yIGB0ZW1wbGF0ZVZhbHVlYFxuICAgKiAgICAgICAgIGFic29sdXRlS2V5T2Zmc2V0IGZvciBgdGVtcGxhdGVLZXlgXG4gICAqIGBgYFxuICAgKiBjb250YWlucyB0aHJlZSBiaW5kaW5nczpcbiAgICogMS4gbmdGb3IgLT4gbnVsbFxuICAgKiAyLiBpdGVtIC0+IE5nRm9yT2ZDb250ZXh0LiRpbXBsaWNpdFxuICAgKiAzLiBuZ0Zvck9mIC0+IGl0ZW1zXG4gICAqXG4gICAqIFRoaXMgaXMgYXBwYXJlbnQgZnJvbSB0aGUgZGUtc3VnYXJlZCB0ZW1wbGF0ZTpcbiAgICogYGBgXG4gICAqICAgPG5nLXRlbXBsYXRlIG5nRm9yIGxldC1pdGVtIFtuZ0Zvck9mXT1cIml0ZW1zXCI+XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGVLZXkgbmFtZSBvZiBkaXJlY3RpdmUsIHdpdGhvdXQgdGhlICogcHJlZml4LiBGb3IgZXhhbXBsZTogbmdJZiwgbmdGb3JcbiAgICogQHBhcmFtIHRlbXBsYXRlVmFsdWUgUkhTIG9mIHRoZSBtaWNyb3N5bnRheCBhdHRyaWJ1dGVcbiAgICogQHBhcmFtIHRlbXBsYXRlVXJsIHRlbXBsYXRlIGZpbGVuYW1lIGlmIGl0J3MgZXh0ZXJuYWwsIGNvbXBvbmVudCBmaWxlbmFtZSBpZiBpdCdzIGlubGluZVxuICAgKiBAcGFyYW0gYWJzb2x1dGVLZXlPZmZzZXQgc3RhcnQgb2YgdGhlIGB0ZW1wbGF0ZUtleWBcbiAgICogQHBhcmFtIGFic29sdXRlVmFsdWVPZmZzZXQgc3RhcnQgb2YgdGhlIGB0ZW1wbGF0ZVZhbHVlYFxuICAgKi9cbiAgcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKFxuICAgICAgdGVtcGxhdGVLZXk6IHN0cmluZywgdGVtcGxhdGVWYWx1ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBhYnNvbHV0ZUtleU9mZnNldDogbnVtYmVyLFxuICAgICAgYWJzb2x1dGVWYWx1ZU9mZnNldDogbnVtYmVyKTogVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHRlbXBsYXRlVmFsdWUpO1xuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgIHRlbXBsYXRlVmFsdWUsIHRlbXBsYXRlVXJsLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0LCB0b2tlbnMsIHRlbXBsYXRlVmFsdWUubGVuZ3RoLFxuICAgICAgICBmYWxzZSAvKiBwYXJzZUFjdGlvbiAqLywgdGhpcy5lcnJvcnMsIDAgLyogcmVsYXRpdmUgb2Zmc2V0ICovKTtcbiAgICByZXR1cm4gcGFyc2VyLnBhcnNlVGVtcGxhdGVCaW5kaW5ncyh7XG4gICAgICBzb3VyY2U6IHRlbXBsYXRlS2V5LFxuICAgICAgc3BhbjogbmV3IEFic29sdXRlU291cmNlU3BhbihhYnNvbHV0ZUtleU9mZnNldCwgYWJzb2x1dGVLZXlPZmZzZXQgKyB0ZW1wbGF0ZUtleS5sZW5ndGgpLFxuICAgIH0pO1xuICB9XG5cbiAgcGFyc2VJbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZXxudWxsIHtcbiAgICBjb25zdCB7c3RyaW5ncywgZXhwcmVzc2lvbnMsIG9mZnNldHN9ID1cbiAgICAgICAgdGhpcy5zcGxpdEludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGV4cHJlc3Npb25Ob2RlczogQVNUW10gPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwcmVzc2lvbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGV4cHJlc3Npb25UZXh0ID0gZXhwcmVzc2lvbnNbaV0udGV4dDtcbiAgICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uVGV4dCk7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9ycywgb2Zmc2V0c1tpXSArIChleHByZXNzaW9uVGV4dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpKVxuICAgICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgICBleHByZXNzaW9uTm9kZXMucHVzaChhc3QpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUludGVycG9sYXRpb25Bc3QoXG4gICAgICAgIHN0cmluZ3MubWFwKHMgPT4gcy50ZXh0KSwgZXhwcmVzc2lvbk5vZGVzLCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTaW1pbGFyIHRvIGBwYXJzZUludGVycG9sYXRpb25gLCBidXQgdHJlYXRzIHRoZSBwcm92aWRlZCBzdHJpbmcgYXMgYSBzaW5nbGUgZXhwcmVzc2lvblxuICAgKiBlbGVtZW50IHRoYXQgd291bGQgbm9ybWFsbHkgYXBwZWFyIHdpdGhpbiB0aGUgaW50ZXJwb2xhdGlvbiBwcmVmaXggYW5kIHN1ZmZpeCAoYHt7YCBhbmQgYH19YCkuXG4gICAqIFRoaXMgaXMgdXNlZCBmb3IgcGFyc2luZyB0aGUgc3dpdGNoIGV4cHJlc3Npb24gaW4gSUNVcy5cbiAgICovXG4gIHBhcnNlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oZXhwcmVzc2lvbjogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTpcbiAgICAgIEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uKTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgY29uc3QgYXN0ID0gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbiwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgLyogcGFyc2VBY3Rpb24gKi8gZmFsc2UsIHRoaXMuZXJyb3JzLCAwKVxuICAgICAgICAgICAgICAgICAgICAucGFyc2VDaGFpbigpO1xuICAgIGNvbnN0IHN0cmluZ3MgPSBbJycsICcnXTsgIC8vIFRoZSBwcmVmaXggYW5kIHN1ZmZpeCBzdHJpbmdzIGFyZSBib3RoIGVtcHR5XG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlSW50ZXJwb2xhdGlvbkFzdChzdHJpbmdzLCBbYXN0XSwgZXhwcmVzc2lvbiwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlSW50ZXJwb2xhdGlvbkFzdChcbiAgICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogQVNUW10sIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsXG4gICAgICBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4oMCwgaW5wdXQubGVuZ3RoKTtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uID1cbiAgICAgICAgbmV3IEludGVycG9sYXRpb24oc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShpbnRlcnBvbGF0aW9uLCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICAvKipcbiAgICogU3BsaXRzIGEgc3RyaW5nIG9mIHRleHQgaW50byBcInJhd1wiIHRleHQgc2VnbWVudHMgYW5kIGV4cHJlc3Npb25zIHByZXNlbnQgaW4gaW50ZXJwb2xhdGlvbnMgaW5cbiAgICogdGhlIHN0cmluZy5cbiAgICogUmV0dXJucyBgbnVsbGAgaWYgdGhlcmUgYXJlIG5vIGludGVycG9sYXRpb25zLCBvdGhlcndpc2UgYVxuICAgKiBgU3BsaXRJbnRlcnBvbGF0aW9uYCB3aXRoIHNwbGl0cyB0aGF0IGxvb2sgbGlrZVxuICAgKiAgIDxyYXcgdGV4dD4gPGV4cHJlc3Npb24+IDxyYXcgdGV4dD4gLi4uIDxyYXcgdGV4dD4gPGV4cHJlc3Npb24+IDxyYXcgdGV4dD5cbiAgICovXG4gIHNwbGl0SW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IFNwbGl0SW50ZXJwb2xhdGlvbiB7XG4gICAgY29uc3Qgc3RyaW5nczogSW50ZXJwb2xhdGlvblBpZWNlW10gPSBbXTtcbiAgICBjb25zdCBleHByZXNzaW9uczogSW50ZXJwb2xhdGlvblBpZWNlW10gPSBbXTtcbiAgICBjb25zdCBvZmZzZXRzOiBudW1iZXJbXSA9IFtdO1xuICAgIGxldCBpID0gMDtcbiAgICBsZXQgYXRJbnRlcnBvbGF0aW9uID0gZmFsc2U7XG4gICAgbGV0IGV4dGVuZExhc3RTdHJpbmcgPSBmYWxzZTtcbiAgICBsZXQge3N0YXJ0OiBpbnRlcnBTdGFydCwgZW5kOiBpbnRlcnBFbmR9ID0gaW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgICB3aGlsZSAoaSA8IGlucHV0Lmxlbmd0aCkge1xuICAgICAgaWYgKCFhdEludGVycG9sYXRpb24pIHtcbiAgICAgICAgLy8gcGFyc2UgdW50aWwgc3RhcnRpbmcge3tcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBpO1xuICAgICAgICBpID0gaW5wdXQuaW5kZXhPZihpbnRlcnBTdGFydCwgaSk7XG4gICAgICAgIGlmIChpID09PSAtMSkge1xuICAgICAgICAgIGkgPSBpbnB1dC5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGV4dCA9IGlucHV0LnN1YnN0cmluZyhzdGFydCwgaSk7XG4gICAgICAgIHN0cmluZ3MucHVzaCh7dGV4dCwgc3RhcnQsIGVuZDogaX0pO1xuXG4gICAgICAgIGF0SW50ZXJwb2xhdGlvbiA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBwYXJzZSBmcm9tIHN0YXJ0aW5nIHt7IHRvIGVuZGluZyB9fSB3aGlsZSBpZ25vcmluZyBjb250ZW50IGluc2lkZSBxdW90ZXMuXG4gICAgICAgIGNvbnN0IGZ1bGxTdGFydCA9IGk7XG4gICAgICAgIGNvbnN0IGV4cHJTdGFydCA9IGZ1bGxTdGFydCArIGludGVycFN0YXJ0Lmxlbmd0aDtcbiAgICAgICAgY29uc3QgZXhwckVuZCA9IHRoaXMuX2dldEV4cHJlc3Npb25kRW5kSW5kZXgoaW5wdXQsIGludGVycEVuZCwgZXhwclN0YXJ0KTtcbiAgICAgICAgaWYgKGV4cHJFbmQgPT09IC0xKSB7XG4gICAgICAgICAgLy8gQ291bGQgbm90IGZpbmQgdGhlIGVuZCBvZiB0aGUgaW50ZXJwb2xhdGlvbjsgZG8gbm90IHBhcnNlIGFuIGV4cHJlc3Npb24uXG4gICAgICAgICAgLy8gSW5zdGVhZCB3ZSBzaG91bGQgZXh0ZW5kIHRoZSBjb250ZW50IG9uIHRoZSBsYXN0IHJhdyBzdHJpbmcuXG4gICAgICAgICAgYXRJbnRlcnBvbGF0aW9uID0gZmFsc2U7XG4gICAgICAgICAgZXh0ZW5kTGFzdFN0cmluZyA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVsbEVuZCA9IGV4cHJFbmQgKyBpbnRlcnBFbmQubGVuZ3RoO1xuXG4gICAgICAgIGNvbnN0IHRleHQgPSBpbnB1dC5zdWJzdHJpbmcoZXhwclN0YXJ0LCBleHByRW5kKTtcbiAgICAgICAgaWYgKHRleHQudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBleHByZXNzaW9ucy5wdXNoKHt0ZXh0LCBzdGFydDogZnVsbFN0YXJ0LCBlbmQ6IGZ1bGxFbmR9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgJ0JsYW5rIGV4cHJlc3Npb25zIGFyZSBub3QgYWxsb3dlZCBpbiBpbnRlcnBvbGF0ZWQgc3RyaW5ncycsIGlucHV0LFxuICAgICAgICAgICAgICBgYXQgY29sdW1uICR7aX0gaW5gLCBsb2NhdGlvbik7XG4gICAgICAgICAgZXhwcmVzc2lvbnMucHVzaCh7dGV4dDogJyRpbXBsaWNpdCcsIHN0YXJ0OiBmdWxsU3RhcnQsIGVuZDogZnVsbEVuZH0pO1xuICAgICAgICB9XG4gICAgICAgIG9mZnNldHMucHVzaChleHByU3RhcnQpO1xuXG4gICAgICAgIGkgPSBmdWxsRW5kO1xuICAgICAgICBhdEludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFhdEludGVycG9sYXRpb24pIHtcbiAgICAgIC8vIElmIHdlIGFyZSBub3cgYXQgYSB0ZXh0IHNlY3Rpb24sIGFkZCB0aGUgcmVtYWluaW5nIGNvbnRlbnQgYXMgYSByYXcgc3RyaW5nLlxuICAgICAgaWYgKGV4dGVuZExhc3RTdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcGllY2UgPSBzdHJpbmdzW3N0cmluZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIHBpZWNlLnRleHQgKz0gaW5wdXQuc3Vic3RyaW5nKGkpO1xuICAgICAgICBwaWVjZS5lbmQgPSBpbnB1dC5sZW5ndGg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHJpbmdzLnB1c2goe3RleHQ6IGlucHV0LnN1YnN0cmluZyhpKSwgc3RhcnQ6IGksIGVuZDogaW5wdXQubGVuZ3RofSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgU3BsaXRJbnRlcnBvbGF0aW9uKHN0cmluZ3MsIGV4cHJlc3Npb25zLCBvZmZzZXRzKTtcbiAgfVxuXG4gIHdyYXBMaXRlcmFsUHJpbWl0aXZlKGlucHV0OiBzdHJpbmd8bnVsbCwgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6XG4gICAgICBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dCA9PSBudWxsID8gMCA6IGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKFxuICAgICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShzcGFuLCBzcGFuLnRvQWJzb2x1dGUoYWJzb2x1dGVPZmZzZXQpLCBpbnB1dCksIGlucHV0LCBsb2NhdGlvbixcbiAgICAgICAgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0cmlwQ29tbWVudHMoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaSA9IHRoaXMuX2NvbW1lbnRTdGFydChpbnB1dCk7XG4gICAgcmV0dXJuIGkgIT0gbnVsbCA/IGlucHV0LnN1YnN0cmluZygwLCBpKS50cmltKCkgOiBpbnB1dDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbW1lbnRTdGFydChpbnB1dDogc3RyaW5nKTogbnVtYmVyfG51bGwge1xuICAgIGxldCBvdXRlclF1b3RlOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGNvbnN0IGNoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgY29uc3QgbmV4dENoYXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkgKyAxKTtcblxuICAgICAgaWYgKGNoYXIgPT09IGNoYXJzLiRTTEFTSCAmJiBuZXh0Q2hhciA9PSBjaGFycy4kU0xBU0ggJiYgb3V0ZXJRdW90ZSA9PSBudWxsKSByZXR1cm4gaTtcblxuICAgICAgaWYgKG91dGVyUXVvdGUgPT09IGNoYXIpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKG91dGVyUXVvdGUgPT0gbnVsbCAmJiBpc1F1b3RlKGNoYXIpKSB7XG4gICAgICAgIG91dGVyUXVvdGUgPSBjaGFyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrTm9JbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IHZvaWQge1xuICAgIGNvbnN0IHJlZ2V4cCA9IF9nZXRJbnRlcnBvbGF0ZVJlZ0V4cChpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBwYXJ0cyA9IGlucHV0LnNwbGl0KHJlZ2V4cCk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7XG4gICAgICAgICAgICAgIGludGVycG9sYXRpb25Db25maWcuZW5kfSkgd2hlcmUgZXhwcmVzc2lvbiB3YXMgZXhwZWN0ZWRgLFxuICAgICAgICAgIGlucHV0LFxuICAgICAgICAgIGBhdCBjb2x1bW4gJHt0aGlzLl9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKHBhcnRzLCAxLCBpbnRlcnBvbGF0aW9uQ29uZmlnKX0gaW5gLFxuICAgICAgICAgIGxvY2F0aW9uKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9maW5kSW50ZXJwb2xhdGlvbkVycm9yQ29sdW1uKFxuICAgICAgcGFydHM6IHN0cmluZ1tdLCBwYXJ0SW5FcnJJZHg6IG51bWJlciwgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IG51bWJlciB7XG4gICAgbGV0IGVyckxvY2F0aW9uID0gJyc7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBwYXJ0SW5FcnJJZHg7IGorKykge1xuICAgICAgZXJyTG9jYXRpb24gKz0gaiAlIDIgPT09IDAgP1xuICAgICAgICAgIHBhcnRzW2pdIDpcbiAgICAgICAgICBgJHtpbnRlcnBvbGF0aW9uQ29uZmlnLnN0YXJ0fSR7cGFydHNbal19JHtpbnRlcnBvbGF0aW9uQ29uZmlnLmVuZH1gO1xuICAgIH1cblxuICAgIHJldHVybiBlcnJMb2NhdGlvbi5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogRmluZHMgdGhlIGluZGV4IG9mIHRoZSBlbmQgb2YgYW4gaW50ZXJwb2xhdGlvbiBleHByZXNzaW9uXG4gICAqIHdoaWxlIGlnbm9yaW5nIGNvbW1lbnRzIGFuZCBxdW90ZWQgY29udGVudC5cbiAgICovXG4gIHByaXZhdGUgX2dldEV4cHJlc3Npb25kRW5kSW5kZXgoaW5wdXQ6IHN0cmluZywgZXhwcmVzc2lvbkVuZDogc3RyaW5nLCBzdGFydDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBsZXQgY3VycmVudFF1b3RlOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgbGV0IGVzY2FwZUNvdW50ID0gMDtcbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY2hhciA9IGlucHV0W2ldO1xuICAgICAgLy8gU2tpcCB0aGUgY2hhcmFjdGVycyBpbnNpZGUgcXVvdGVzLiBOb3RlIHRoYXQgd2Ugb25seSBjYXJlIGFib3V0IHRoZVxuICAgICAgLy8gb3V0ZXItbW9zdCBxdW90ZXMgbWF0Y2hpbmcgdXAgYW5kIHdlIG5lZWQgdG8gYWNjb3VudCBmb3IgZXNjYXBlIGNoYXJhY3RlcnMuXG4gICAgICBpZiAoaXNRdW90ZShpbnB1dC5jaGFyQ29kZUF0KGkpKSAmJiAoY3VycmVudFF1b3RlID09PSBudWxsIHx8IGN1cnJlbnRRdW90ZSA9PT0gY2hhcikgJiZcbiAgICAgICAgICBlc2NhcGVDb3VudCAlIDIgPT09IDApIHtcbiAgICAgICAgY3VycmVudFF1b3RlID0gY3VycmVudFF1b3RlID09PSBudWxsID8gY2hhciA6IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKGN1cnJlbnRRdW90ZSA9PT0gbnVsbCkge1xuICAgICAgICBpZiAoaW5wdXQuc3RhcnRzV2l0aChleHByZXNzaW9uRW5kLCBpKSkge1xuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICB9XG4gICAgICAgIC8vIE5vdGhpbmcgZWxzZSBpbiB0aGUgZXhwcmVzc2lvbiBtYXR0ZXJzIGFmdGVyIHdlJ3ZlXG4gICAgICAgIC8vIGhpdCBhIGNvbW1lbnQgc28gbG9vayBkaXJlY3RseSBmb3IgdGhlIGVuZCB0b2tlbi5cbiAgICAgICAgaWYgKGlucHV0LnN0YXJ0c1dpdGgoJy8vJywgaSkpIHtcbiAgICAgICAgICByZXR1cm4gaW5wdXQuaW5kZXhPZihleHByZXNzaW9uRW5kLCBpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZXNjYXBlQ291bnQgPSBjaGFyID09PSAnXFxcXCcgPyBlc2NhcGVDb3VudCArIDEgOiAwO1xuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEl2eVBhcnNlciBleHRlbmRzIFBhcnNlciB7XG4gIHNpbXBsZUV4cHJlc3Npb25DaGVja2VyID0gSXZ5U2ltcGxlRXhwcmVzc2lvbkNoZWNrZXI7XG59XG5cbi8qKiBEZXNjcmliZXMgYSBzdGF0ZWZ1bCBjb250ZXh0IGFuIGV4cHJlc3Npb24gcGFyc2VyIGlzIGluLiAqL1xuZW51bSBQYXJzZUNvbnRleHRGbGFncyB7XG4gIE5vbmUgPSAwLFxuICAvKipcbiAgICogQSBXcml0YWJsZSBjb250ZXh0IGlzIG9uZSBpbiB3aGljaCBhIHZhbHVlIG1heSBiZSB3cml0dGVuIHRvIGFuIGx2YWx1ZS5cbiAgICogRm9yIGV4YW1wbGUsIGFmdGVyIHdlIHNlZSBhIHByb3BlcnR5IGFjY2Vzcywgd2UgbWF5IGV4cGVjdCBhIHdyaXRlIHRvIHRoZVxuICAgKiBwcm9wZXJ0eSB2aWEgdGhlIFwiPVwiIG9wZXJhdG9yLlxuICAgKiAgIHByb3BcbiAgICogICAgICAgIF4gcG9zc2libGUgXCI9XCIgYWZ0ZXJcbiAgICovXG4gIFdyaXRhYmxlID0gMSxcbn1cblxuZXhwb3J0IGNsYXNzIF9QYXJzZUFTVCB7XG4gIHByaXZhdGUgcnBhcmVuc0V4cGVjdGVkID0gMDtcbiAgcHJpdmF0ZSByYnJhY2tldHNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNlc0V4cGVjdGVkID0gMDtcbiAgcHJpdmF0ZSBjb250ZXh0ID0gUGFyc2VDb250ZXh0RmxhZ3MuTm9uZTtcblxuICAvLyBDYWNoZSBvZiBleHByZXNzaW9uIHN0YXJ0IGFuZCBpbnB1dCBpbmRlY2VzIHRvIHRoZSBhYnNvbHV0ZSBzb3VyY2Ugc3BhbiB0aGV5IG1hcCB0bywgdXNlZCB0b1xuICAvLyBwcmV2ZW50IGNyZWF0aW5nIHN1cGVyZmx1b3VzIHNvdXJjZSBzcGFucyBpbiBgc291cmNlU3BhbmAuXG4gIC8vIEEgc2VyaWFsIG9mIHRoZSBleHByZXNzaW9uIHN0YXJ0IGFuZCBpbnB1dCBpbmRleCBpcyB1c2VkIGZvciBtYXBwaW5nIGJlY2F1c2UgYm90aCBhcmUgc3RhdGVmdWxcbiAgLy8gYW5kIG1heSBjaGFuZ2UgZm9yIHN1YnNlcXVlbnQgZXhwcmVzc2lvbnMgdmlzaXRlZCBieSB0aGUgcGFyc2VyLlxuICBwcml2YXRlIHNvdXJjZVNwYW5DYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBBYnNvbHV0ZVNvdXJjZVNwYW4+KCk7XG5cbiAgaW5kZXg6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaW5wdXQ6IHN0cmluZywgcHVibGljIGxvY2F0aW9uOiBzdHJpbmcsIHB1YmxpYyBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgcHVibGljIHRva2VuczogVG9rZW5bXSwgcHVibGljIGlucHV0TGVuZ3RoOiBudW1iZXIsIHB1YmxpYyBwYXJzZUFjdGlvbjogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgZXJyb3JzOiBQYXJzZXJFcnJvcltdLCBwcml2YXRlIG9mZnNldDogbnVtYmVyKSB7fVxuXG4gIHBlZWsob2Zmc2V0OiBudW1iZXIpOiBUb2tlbiB7XG4gICAgY29uc3QgaSA9IHRoaXMuaW5kZXggKyBvZmZzZXQ7XG4gICAgcmV0dXJuIGkgPCB0aGlzLnRva2Vucy5sZW5ndGggPyB0aGlzLnRva2Vuc1tpXSA6IEVPRjtcbiAgfVxuXG4gIGdldCBuZXh0KCk6IFRva2VuIHtcbiAgICByZXR1cm4gdGhpcy5wZWVrKDApO1xuICB9XG5cbiAgLyoqIFdoZXRoZXIgYWxsIHRoZSBwYXJzZXIgaW5wdXQgaGFzIGJlZW4gcHJvY2Vzc2VkLiAqL1xuICBnZXQgYXRFT0YoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZXggPj0gdGhpcy50b2tlbnMubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIEluZGV4IG9mIHRoZSBuZXh0IHRva2VuIHRvIGJlIHByb2Nlc3NlZCwgb3IgdGhlIGVuZCBvZiB0aGUgbGFzdCB0b2tlbiBpZiBhbGwgaGF2ZSBiZWVuXG4gICAqIHByb2Nlc3NlZC5cbiAgICovXG4gIGdldCBpbnB1dEluZGV4KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuYXRFT0YgPyB0aGlzLmN1cnJlbnRFbmRJbmRleCA6IHRoaXMubmV4dC5pbmRleCArIHRoaXMub2Zmc2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIEVuZCBpbmRleCBvZiB0aGUgbGFzdCBwcm9jZXNzZWQgdG9rZW4sIG9yIHRoZSBzdGFydCBvZiB0aGUgZmlyc3QgdG9rZW4gaWYgbm9uZSBoYXZlIGJlZW5cbiAgICogcHJvY2Vzc2VkLlxuICAgKi9cbiAgZ2V0IGN1cnJlbnRFbmRJbmRleCgpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLmluZGV4ID4gMCkge1xuICAgICAgY29uc3QgY3VyVG9rZW4gPSB0aGlzLnBlZWsoLTEpO1xuICAgICAgcmV0dXJuIGN1clRva2VuLmVuZCArIHRoaXMub2Zmc2V0O1xuICAgIH1cbiAgICAvLyBObyB0b2tlbnMgaGF2ZSBiZWVuIHByb2Nlc3NlZCB5ZXQ7IHJldHVybiB0aGUgbmV4dCB0b2tlbidzIHN0YXJ0IG9yIHRoZSBsZW5ndGggb2YgdGhlIGlucHV0XG4gICAgLy8gaWYgdGhlcmUgaXMgbm8gdG9rZW4uXG4gICAgaWYgKHRoaXMudG9rZW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuaW5wdXRMZW5ndGggKyB0aGlzLm9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pbmRleCArIHRoaXMub2Zmc2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGFic29sdXRlIG9mZnNldCBvZiB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgdG9rZW4uXG4gICAqL1xuICBnZXQgY3VycmVudEFic29sdXRlT2Zmc2V0KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuYWJzb2x1dGVPZmZzZXQgKyB0aGlzLmlucHV0SW5kZXg7XG4gIH1cblxuICBzcGFuKHN0YXJ0OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbmV3IFBhcnNlU3BhbihzdGFydCwgdGhpcy5jdXJyZW50RW5kSW5kZXgpO1xuICB9XG5cbiAgc291cmNlU3BhbihzdGFydDogbnVtYmVyKTogQWJzb2x1dGVTb3VyY2VTcGFuIHtcbiAgICBjb25zdCBzZXJpYWwgPSBgJHtzdGFydH1AJHt0aGlzLmlucHV0SW5kZXh9YDtcbiAgICBpZiAoIXRoaXMuc291cmNlU3BhbkNhY2hlLmhhcyhzZXJpYWwpKSB7XG4gICAgICB0aGlzLnNvdXJjZVNwYW5DYWNoZS5zZXQoc2VyaWFsLCB0aGlzLnNwYW4oc3RhcnQpLnRvQWJzb2x1dGUodGhpcy5hYnNvbHV0ZU9mZnNldCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zb3VyY2VTcGFuQ2FjaGUuZ2V0KHNlcmlhbCkhO1xuICB9XG5cbiAgYWR2YW5jZSgpIHtcbiAgICB0aGlzLmluZGV4Kys7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZXMgYSBjYWxsYmFjayBpbiB0aGUgcHJvdmlkZWQgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgd2l0aENvbnRleHQ8VD4oY29udGV4dDogUGFyc2VDb250ZXh0RmxhZ3MsIGNiOiAoKSA9PiBUKTogVCB7XG4gICAgdGhpcy5jb250ZXh0IHw9IGNvbnRleHQ7XG4gICAgY29uc3QgcmV0ID0gY2IoKTtcbiAgICB0aGlzLmNvbnRleHQgXj0gY29udGV4dDtcbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5leHQuaXNDaGFyYWN0ZXIoY29kZSkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBwZWVrS2V5d29yZExldCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5uZXh0LmlzS2V5d29yZExldCgpO1xuICB9XG4gIHBlZWtLZXl3b3JkQXMoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pc0tleXdvcmRBcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN1bWVzIGFuIGV4cGVjdGVkIGNoYXJhY3Rlciwgb3RoZXJ3aXNlIGVtaXRzIGFuIGVycm9yIGFib3V0IHRoZSBtaXNzaW5nIGV4cGVjdGVkIGNoYXJhY3RlclxuICAgKiBhbmQgc2tpcHMgb3ZlciB0aGUgdG9rZW4gc3RyZWFtIHVudGlsIHJlYWNoaW5nIGEgcmVjb3ZlcmFibGUgcG9pbnQuXG4gICAqXG4gICAqIFNlZSBgdGhpcy5lcnJvcmAgYW5kIGB0aGlzLnNraXBgIGZvciBtb3JlIGRldGFpbHMuXG4gICAqL1xuICBleHBlY3RDaGFyYWN0ZXIoY29kZTogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNvZGUpKSByZXR1cm47XG4gICAgdGhpcy5lcnJvcihgTWlzc2luZyBleHBlY3RlZCAke1N0cmluZy5mcm9tQ2hhckNvZGUoY29kZSl9YCk7XG4gIH1cblxuICBjb25zdW1lT3B0aW9uYWxPcGVyYXRvcihvcDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMubmV4dC5pc09wZXJhdG9yKG9wKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGV4cGVjdE9wZXJhdG9yKG9wZXJhdG9yOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcihvcGVyYXRvcikpIHJldHVybjtcbiAgICB0aGlzLmVycm9yKGBNaXNzaW5nIGV4cGVjdGVkIG9wZXJhdG9yICR7b3BlcmF0b3J9YCk7XG4gIH1cblxuICBwcmV0dHlQcmludFRva2VuKHRvazogVG9rZW4pOiBzdHJpbmcge1xuICAgIHJldHVybiB0b2sgPT09IEVPRiA/ICdlbmQgb2YgaW5wdXQnIDogYHRva2VuICR7dG9rfWA7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk6IHN0cmluZyB7XG4gICAgY29uc3QgbiA9IHRoaXMubmV4dDtcbiAgICBpZiAoIW4uaXNJZGVudGlmaWVyKCkgJiYgIW4uaXNLZXl3b3JkKCkpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgJHt0aGlzLnByZXR0eVByaW50VG9rZW4obil9LCBleHBlY3RlZCBpZGVudGlmaWVyIG9yIGtleXdvcmRgKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG4udG9TdHJpbmcoKSBhcyBzdHJpbmc7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSAmJiAhbi5pc1N0cmluZygpKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkICR7dGhpcy5wcmV0dHlQcmludFRva2VuKG4pfSwgZXhwZWN0ZWQgaWRlbnRpZmllciwga2V5d29yZCwgb3Igc3RyaW5nYCk7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuLnRvU3RyaW5nKCkgYXMgc3RyaW5nO1xuICB9XG5cbiAgcGFyc2VDaGFpbigpOiBBU1Qge1xuICAgIGNvbnN0IGV4cHJzOiBBU1RbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIHdoaWxlICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBleHByID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIGV4cHJzLnB1c2goZXhwcik7XG5cbiAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICBpZiAoIXRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5nIGV4cHJlc3Npb24gY2Fubm90IGNvbnRhaW4gY2hhaW5lZCBleHByZXNzaW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRTRU1JQ09MT04pKSB7XG4gICAgICAgIH0gIC8vIHJlYWQgYWxsIHNlbWljb2xvbnNcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICcke3RoaXMubmV4dH0nYCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChleHBycy5sZW5ndGggPT0gMCkgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgaWYgKGV4cHJzLmxlbmd0aCA9PSAxKSByZXR1cm4gZXhwcnNbMF07XG4gICAgcmV0dXJuIG5ldyBDaGFpbih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBleHBycyk7XG4gIH1cblxuICBwYXJzZVBpcGUoKTogQVNUIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignfCcpKSB7XG4gICAgICBpZiAodGhpcy5wYXJzZUFjdGlvbikge1xuICAgICAgICB0aGlzLmVycm9yKCdDYW5ub3QgaGF2ZSBhIHBpcGUgaW4gYW4gYWN0aW9uIGV4cHJlc3Npb24nKTtcbiAgICAgIH1cblxuICAgICAgZG8ge1xuICAgICAgICBjb25zdCBuYW1lU3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTtcbiAgICAgICAgY29uc3QgbmFtZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4obmFtZVN0YXJ0KTtcbiAgICAgICAgY29uc3QgYXJnczogQVNUW10gPSBbXTtcbiAgICAgICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgICBhcmdzLnB1c2godGhpcy5wYXJzZUV4cHJlc3Npb24oKSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgbmV3IEJpbmRpbmdQaXBlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgbmFtZSwgYXJncywgbmFtZVNwYW4pO1xuICAgICAgfSB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignfCcpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uKCk6IEFTVCB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICB9XG5cbiAgcGFyc2VDb25kaXRpb25hbCgpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsT3IoKTtcblxuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc/JykpIHtcbiAgICAgIGNvbnN0IHllcyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBsZXQgbm86IEFTVDtcbiAgICAgIGlmICghdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKSkge1xuICAgICAgICBjb25zdCBlbmQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgZW5kKTtcbiAgICAgICAgdGhpcy5lcnJvcihgQ29uZGl0aW9uYWwgZXhwcmVzc2lvbiAke2V4cHJlc3Npb259IHJlcXVpcmVzIGFsbCAzIGV4cHJlc3Npb25zYCk7XG4gICAgICAgIG5vID0gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgQ29uZGl0aW9uYWwodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0LCB5ZXMsIG5vKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH1cblxuICBwYXJzZUxvZ2ljYWxPcigpOiBBU1Qge1xuICAgIC8vICd8fCdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKTtcbiAgICB3aGlsZSAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignfHwnKSkge1xuICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlTG9naWNhbEFuZCgpO1xuICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnfHwnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTG9naWNhbEFuZCgpOiBBU1Qge1xuICAgIC8vICcmJidcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG4gICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJyYmJykpIHtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG4gICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksICcmJicsIHJlc3VsdCwgcmlnaHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VFcXVhbGl0eSgpOiBBU1Qge1xuICAgIC8vICc9PScsJyE9JywnPT09JywnIT09J1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUmVsYXRpb25hbCgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICc9PSc6XG4gICAgICAgIGNhc2UgJz09PSc6XG4gICAgICAgIGNhc2UgJyE9JzpcbiAgICAgICAgY2FzZSAnIT09JzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VSZWxhdGlvbmFsKCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZVJlbGF0aW9uYWwoKTogQVNUIHtcbiAgICAvLyAnPCcsICc+JywgJzw9JywgJz49J1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlQWRkaXRpdmUoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnPCc6XG4gICAgICAgIGNhc2UgJz4nOlxuICAgICAgICBjYXNlICc8PSc6XG4gICAgICAgIGNhc2UgJz49JzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VBZGRpdGl2ZSgpOiBBU1Qge1xuICAgIC8vICcrJywgJy0nXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgbGV0IHJpZ2h0ID0gdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCk7XG4gICAgICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZU11bHRpcGxpY2F0aXZlKCk6IEFTVCB7XG4gICAgLy8gJyonLCAnJScsICcvJ1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJyonOlxuICAgICAgICBjYXNlICclJzpcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgbGV0IHJpZ2h0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VQcmVmaXgoKTogQVNUIHtcbiAgICBpZiAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgbGV0IHJlc3VsdDogQVNUO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgcmV0dXJuIFVuYXJ5LmNyZWF0ZVBsdXModGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBVbmFyeS5jcmVhdGVNaW51cyh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgICBjYXNlICchJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcmVmaXhOb3QodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFyc2VDYWxsQ2hhaW4oKTtcbiAgfVxuXG4gIHBhcnNlQ2FsbENoYWluKCk6IEFTVCB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VQcmltYXJ5KCk7XG4gICAgY29uc3QgcmVzdWx0U3RhcnQgPSByZXN1bHQuc3Bhbi5zdGFydDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRQRVJJT0QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VBY2Nlc3NNZW1iZXJPck1ldGhvZENhbGwocmVzdWx0LCBmYWxzZSk7XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPy4nKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgdHJ1ZSk7XG5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgICB0aGlzLndpdGhDb250ZXh0KFBhcnNlQ29udGV4dEZsYWdzLldyaXRhYmxlLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZCsrO1xuICAgICAgICAgIGNvbnN0IGtleSA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICAgICAgaWYgKGtleSBpbnN0YW5jZW9mIEVtcHR5RXhwcikge1xuICAgICAgICAgICAgdGhpcy5lcnJvcihgS2V5IGFjY2VzcyBjYW5ub3QgYmUgZW1wdHlgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICAgICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBLZXllZFdyaXRlKFxuICAgICAgICAgICAgICAgIHRoaXMuc3BhbihyZXN1bHRTdGFydCksIHRoaXMuc291cmNlU3BhbihyZXN1bHRTdGFydCksIHJlc3VsdCwga2V5LCB2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdCA9XG4gICAgICAgICAgICAgICAgbmV3IEtleWVkUmVhZCh0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQrKztcbiAgICAgICAgY29uc3QgYXJncyA9IHRoaXMucGFyc2VDYWxsQXJndW1lbnRzKCk7XG4gICAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgbmV3IEZ1bmN0aW9uQ2FsbCh0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGFyZ3MpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJyEnKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgTm9uTnVsbEFzc2VydCh0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQpO1xuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBhcnNlUHJpbWFyeSgpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkTnVsbCgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBudWxsKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFVuZGVmaW5lZCgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB2b2lkIDApO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkVHJ1ZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCB0cnVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZEZhbHNlKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGZhbHNlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRoaXMoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IFRoaXNSZWNlaXZlcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0tFVCkpIHtcbiAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgIGNvbnN0IGVsZW1lbnRzID0gdGhpcy5wYXJzZUV4cHJlc3Npb25MaXN0KGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICB0aGlzLnJicmFja2V0c0V4cGVjdGVkLS07XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsQXJyYXkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZWxlbWVudHMpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNDaGFyYWN0ZXIoY2hhcnMuJExCUkFDRSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlTGl0ZXJhbE1hcCgpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNJZGVudGlmaWVyKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKFxuICAgICAgICAgIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc051bWJlcigpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRoaXMubmV4dC50b051bWJlcigpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdmFsdWUpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNTdHJpbmcoKSkge1xuICAgICAgY29uc3QgbGl0ZXJhbFZhbHVlID0gdGhpcy5uZXh0LnRvU3RyaW5nKCk7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBsaXRlcmFsVmFsdWUpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLmluZGV4ID49IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCBlbmQgb2YgZXhwcmVzc2lvbjogJHt0aGlzLmlucHV0fWApO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgdG9rZW4gJHt0aGlzLm5leHR9YCk7XG4gICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZUV4cHJlc3Npb25MaXN0KHRlcm1pbmF0b3I6IG51bWJlcik6IEFTVFtdIHtcbiAgICBjb25zdCByZXN1bHQ6IEFTVFtdID0gW107XG4gICAgaWYgKCF0aGlzLm5leHQuaXNDaGFyYWN0ZXIodGVybWluYXRvcikpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgcmVzdWx0LnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTGl0ZXJhbE1hcCgpOiBMaXRlcmFsTWFwIHtcbiAgICBjb25zdCBrZXlzOiBMaXRlcmFsTWFwS2V5W10gPSBbXTtcbiAgICBjb25zdCB2YWx1ZXM6IEFTVFtdID0gW107XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJExCUkFDRSk7XG4gICAgaWYgKCF0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkge1xuICAgICAgdGhpcy5yYnJhY2VzRXhwZWN0ZWQrKztcbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgcXVvdGVkID0gdGhpcy5uZXh0LmlzU3RyaW5nKCk7XG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICAgIGtleXMucHVzaCh7a2V5LCBxdW90ZWR9KTtcbiAgICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKTtcbiAgICAgICAgdmFsdWVzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICAgIHRoaXMucmJyYWNlc0V4cGVjdGVkLS07XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNFKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsTWFwKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGtleXMsIHZhbHVlcyk7XG4gIH1cblxuICBwYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChyZWNlaXZlcjogQVNULCBpc1NhZmU6IGJvb2xlYW4gPSBmYWxzZSk6IEFTVCB7XG4gICAgY29uc3Qgc3RhcnQgPSByZWNlaXZlci5zcGFuLnN0YXJ0O1xuICAgIGNvbnN0IG5hbWVTdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBjb25zdCBpZCA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpO1xuICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zb3VyY2VTcGFuKG5hbWVTdGFydCk7XG5cbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy5wYXJzZUNhbGxBcmd1bWVudHMoKTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgIGNvbnN0IHNwYW4gPSB0aGlzLnNwYW4oc3RhcnQpO1xuICAgICAgY29uc3Qgc291cmNlU3BhbiA9IHRoaXMuc291cmNlU3BhbihzdGFydCk7XG4gICAgICByZXR1cm4gaXNTYWZlID8gbmV3IFNhZmVNZXRob2RDYWxsKHNwYW4sIHNvdXJjZVNwYW4sIG5hbWVTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpIDpcbiAgICAgICAgICAgICAgICAgICAgICBuZXcgTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCBuYW1lU3BhbiwgcmVjZWl2ZXIsIGlkLCBhcmdzKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaXNTYWZlKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdUaGUgXFwnPy5cXCcgb3BlcmF0b3IgY2Fubm90IGJlIHVzZWQgaW4gdGhlIGFzc2lnbm1lbnQnKTtcbiAgICAgICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFNhZmVQcm9wZXJ0eVJlYWQoXG4gICAgICAgICAgICAgIHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWNlaXZlciwgaWQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5ncyBjYW5ub3QgY29udGFpbiBhc3NpZ25tZW50cycpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb3BlcnR5V3JpdGUoXG4gICAgICAgICAgICAgIHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWNlaXZlciwgaWQsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb3BlcnR5UmVhZCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBuYW1lU3BhbiwgcmVjZWl2ZXIsIGlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBhcnNlQ2FsbEFyZ3VtZW50cygpOiBCaW5kaW5nUGlwZVtdIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSByZXR1cm4gW107XG4gICAgY29uc3QgcG9zaXRpb25hbHM6IEFTVFtdID0gW107XG4gICAgZG8ge1xuICAgICAgcG9zaXRpb25hbHMucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcG9zaXRpb25hbHMgYXMgQmluZGluZ1BpcGVbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZXMgYW4gaWRlbnRpZmllciwgYSBrZXl3b3JkLCBhIHN0cmluZyB3aXRoIGFuIG9wdGlvbmFsIGAtYCBpbiBiZXR3ZWVuLFxuICAgKiBhbmQgcmV0dXJucyB0aGUgc3RyaW5nIGFsb25nIHdpdGggaXRzIGFic29sdXRlIHNvdXJjZSBzcGFuLlxuICAgKi9cbiAgZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIge1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBsZXQgb3BlcmF0b3JGb3VuZCA9IGZhbHNlO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgZG8ge1xuICAgICAgcmVzdWx0ICs9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICBvcGVyYXRvckZvdW5kID0gdGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignLScpO1xuICAgICAgaWYgKG9wZXJhdG9yRm91bmQpIHtcbiAgICAgICAgcmVzdWx0ICs9ICctJztcbiAgICAgIH1cbiAgICB9IHdoaWxlIChvcGVyYXRvckZvdW5kKTtcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlOiByZXN1bHQsXG4gICAgICBzcGFuOiBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKHN0YXJ0LCBzdGFydCArIHJlc3VsdC5sZW5ndGgpLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgbWljcm9zeW50YXggdGVtcGxhdGUgZXhwcmVzc2lvbiBhbmQgcmV0dXJuIGEgbGlzdCBvZiBiaW5kaW5ncyBvclxuICAgKiBwYXJzaW5nIGVycm9ycyBpbiBjYXNlIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGludmFsaWQuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICA8ZGl2ICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpOyB0cmFja0J5OiBmdW5jXCI+XG4gICAqIGBgYFxuICAgKiBjb250YWlucyBmaXZlIGJpbmRpbmdzOlxuICAgKiAxLiBuZ0ZvciAtPiBudWxsXG4gICAqIDIuIGl0ZW0gLT4gTmdGb3JPZkNvbnRleHQuJGltcGxpY2l0XG4gICAqIDMuIG5nRm9yT2YgLT4gaXRlbXNcbiAgICogNC4gaSAtPiBOZ0Zvck9mQ29udGV4dC5pbmRleFxuICAgKiA1LiBuZ0ZvclRyYWNrQnkgLT4gZnVuY1xuICAgKlxuICAgKiBGb3IgYSBmdWxsIGRlc2NyaXB0aW9uIG9mIHRoZSBtaWNyb3N5bnRheCBncmFtbWFyLCBzZWVcbiAgICogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vbWhldmVyeS9kMzUzMDI5NGNmZjJlNGExYjNmZTE1ZmY3NWQwODg1NVxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGVLZXkgbmFtZSBvZiB0aGUgbWljcm9zeW50YXggZGlyZWN0aXZlLCBsaWtlIG5nSWYsIG5nRm9yLFxuICAgKiB3aXRob3V0IHRoZSAqLCBhbG9uZyB3aXRoIGl0cyBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKHRlbXBsYXRlS2V5OiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyKTogVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IGJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSA9IFtdO1xuXG4gICAgLy8gVGhlIGZpcnN0IGJpbmRpbmcgaXMgZm9yIHRoZSB0ZW1wbGF0ZSBrZXkgaXRzZWxmXG4gICAgLy8gSW4gKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIiwga2V5ID0gXCJuZ0ZvclwiLCB2YWx1ZSA9IG51bGxcbiAgICAvLyBJbiAqbmdJZj1cImNvbmQgfCBwaXBlXCIsIGtleSA9IFwibmdJZlwiLCB2YWx1ZSA9IFwiY29uZCB8IHBpcGVcIlxuICAgIGJpbmRpbmdzLnB1c2goLi4udGhpcy5wYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyh0ZW1wbGF0ZUtleSkpO1xuXG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIC8vIElmIGl0IHN0YXJ0cyB3aXRoICdsZXQnLCB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZSBkZWNsYXJhdGlvblxuICAgICAgY29uc3QgbGV0QmluZGluZyA9IHRoaXMucGFyc2VMZXRCaW5kaW5nKCk7XG4gICAgICBpZiAobGV0QmluZGluZykge1xuICAgICAgICBiaW5kaW5ncy5wdXNoKGxldEJpbmRpbmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVHdvIHBvc3NpYmxlIGNhc2VzIGhlcmUsIGVpdGhlciBgdmFsdWUgXCJhc1wiIGtleWAgb3JcbiAgICAgICAgLy8gXCJkaXJlY3RpdmUta2V5d29yZCBleHByZXNzaW9uXCIuIFdlIGRvbid0IGtub3cgd2hpY2ggY2FzZSwgYnV0IGJvdGhcbiAgICAgICAgLy8gXCJ2YWx1ZVwiIGFuZCBcImRpcmVjdGl2ZS1rZXl3b3JkXCIgYXJlIHRlbXBsYXRlIGJpbmRpbmcga2V5LCBzbyBjb25zdW1lXG4gICAgICAgIC8vIHRoZSBrZXkgZmlyc3QuXG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgICAgIC8vIFBlZWsgYXQgdGhlIG5leHQgdG9rZW4sIGlmIGl0IGlzIFwiYXNcIiB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZVxuICAgICAgICAvLyBkZWNsYXJhdGlvbi5cbiAgICAgICAgY29uc3QgYmluZGluZyA9IHRoaXMucGFyc2VBc0JpbmRpbmcoa2V5KTtcbiAgICAgICAgaWYgKGJpbmRpbmcpIHtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSB0aGUga2V5IG11c3QgYmUgYSBkaXJlY3RpdmUga2V5d29yZCwgbGlrZSBcIm9mXCIuIFRyYW5zZm9ybVxuICAgICAgICAgIC8vIHRoZSBrZXkgdG8gYWN0dWFsIGtleS4gRWcuIG9mIC0+IG5nRm9yT2YsIHRyYWNrQnkgLT4gbmdGb3JUcmFja0J5XG4gICAgICAgICAga2V5LnNvdXJjZSA9XG4gICAgICAgICAgICAgIHRlbXBsYXRlS2V5LnNvdXJjZSArIGtleS5zb3VyY2UuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBrZXkuc291cmNlLnN1YnN0cmluZygxKTtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKC4uLnRoaXMucGFyc2VEaXJlY3RpdmVLZXl3b3JkQmluZGluZ3Moa2V5KSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0KGJpbmRpbmdzLCBbXSAvKiB3YXJuaW5ncyAqLywgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGEgZGlyZWN0aXZlIGtleXdvcmQsIGZvbGxvd2VkIGJ5IGEgbWFuZGF0b3J5IGV4cHJlc3Npb24uXG4gICAqIEZvciBleGFtcGxlLCBcIm9mIGl0ZW1zXCIsIFwidHJhY2tCeTogZnVuY1wiLlxuICAgKiBUaGUgYmluZGluZ3MgYXJlOiBuZ0Zvck9mIC0+IGl0ZW1zLCBuZ0ZvclRyYWNrQnkgLT4gZnVuY1xuICAgKiBUaGVyZSBjb3VsZCBiZSBhbiBvcHRpb25hbCBcImFzXCIgYmluZGluZyB0aGF0IGZvbGxvd3MgdGhlIGV4cHJlc3Npb24uXG4gICAqIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtcyB8IHNsaWNlOjA6MSBhcyBjb2xsZWN0aW9uXCIuXG4gICAqICAgICAgICAgICAgICAgICAgICBeXiBeXl5eXl5eXl5eXl5eXl5eXiBeXl5eXl5eXl5eXl5eXG4gICAqICAgICAgICAgICAgICAga2V5d29yZCAgICBib3VuZCB0YXJnZXQgICBvcHRpb25hbCAnYXMnIGJpbmRpbmdcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBrZXkgYmluZGluZyBrZXksIGZvciBleGFtcGxlLCBuZ0ZvciwgbmdJZiwgbmdGb3JPZiwgYWxvbmcgd2l0aCBpdHNcbiAgICogYWJzb2x1dGUgc3Bhbi5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VEaXJlY3RpdmVLZXl3b3JkQmluZGluZ3Moa2V5OiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyKTogVGVtcGxhdGVCaW5kaW5nW10ge1xuICAgIGNvbnN0IGJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSA9IFtdO1xuICAgIHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7ICAvLyB0cmFja0J5OiB0cmFja0J5RnVuY3Rpb25cbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuZ2V0RGlyZWN0aXZlQm91bmRUYXJnZXQoKTtcbiAgICBsZXQgc3BhbkVuZCA9IHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0O1xuICAgIC8vIFRoZSBiaW5kaW5nIGNvdWxkIG9wdGlvbmFsbHkgYmUgZm9sbG93ZWQgYnkgXCJhc1wiLiBGb3IgZXhhbXBsZSxcbiAgICAvLyAqbmdJZj1cImNvbmQgfCBwaXBlIGFzIHhcIi4gSW4gdGhpcyBjYXNlLCB0aGUga2V5IGluIHRoZSBcImFzXCIgYmluZGluZ1xuICAgIC8vIGlzIFwieFwiIGFuZCB0aGUgdmFsdWUgaXMgdGhlIHRlbXBsYXRlIGtleSBpdHNlbGYgKFwibmdJZlwiKS4gTm90ZSB0aGF0IHRoZVxuICAgIC8vICdrZXknIGluIHRoZSBjdXJyZW50IGNvbnRleHQgbm93IGJlY29tZXMgdGhlIFwidmFsdWVcIiBpbiB0aGUgbmV4dCBiaW5kaW5nLlxuICAgIGNvbnN0IGFzQmluZGluZyA9IHRoaXMucGFyc2VBc0JpbmRpbmcoa2V5KTtcbiAgICBpZiAoIWFzQmluZGluZykge1xuICAgICAgdGhpcy5jb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpO1xuICAgICAgc3BhbkVuZCA9IHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0O1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3BhbihrZXkuc3Bhbi5zdGFydCwgc3BhbkVuZCk7XG4gICAgYmluZGluZ3MucHVzaChuZXcgRXhwcmVzc2lvbkJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSkpO1xuICAgIGlmIChhc0JpbmRpbmcpIHtcbiAgICAgIGJpbmRpbmdzLnB1c2goYXNCaW5kaW5nKTtcbiAgICB9XG4gICAgcmV0dXJuIGJpbmRpbmdzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgZXhwcmVzc2lvbiBBU1QgZm9yIHRoZSBib3VuZCB0YXJnZXQgb2YgYSBkaXJlY3RpdmUga2V5d29yZFxuICAgKiBiaW5kaW5nLiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nSWY9XCJjb25kaXRpb24gfCBwaXBlXCJcbiAgICogICAgICAgICAgXl5eXl5eXl5eXl5eXl5eXiBib3VuZCB0YXJnZXQgZm9yIFwibmdJZlwiXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgXl5eXl4gYm91bmQgdGFyZ2V0IGZvciBcIm5nRm9yT2ZcIlxuICAgKiBgYGBcbiAgICovXG4gIHByaXZhdGUgZ2V0RGlyZWN0aXZlQm91bmRUYXJnZXQoKTogQVNUV2l0aFNvdXJjZXxudWxsIHtcbiAgICBpZiAodGhpcy5uZXh0ID09PSBFT0YgfHwgdGhpcy5wZWVrS2V5d29yZEFzKCkgfHwgdGhpcy5wZWVrS2V5d29yZExldCgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgYXN0ID0gdGhpcy5wYXJzZVBpcGUoKTsgIC8vIGV4YW1wbGU6IFwiY29uZGl0aW9uIHwgYXN5bmNcIlxuICAgIGNvbnN0IHtzdGFydCwgZW5kfSA9IGFzdC5zcGFuO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgdmFsdWUsIHRoaXMubG9jYXRpb24sIHRoaXMuYWJzb2x1dGVPZmZzZXQgKyBzdGFydCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYmluZGluZyBmb3IgYSB2YXJpYWJsZSBkZWNsYXJlZCB1c2luZyBgYXNgLiBOb3RlIHRoYXQgdGhlIG9yZGVyXG4gICAqIG9mIHRoZSBrZXktdmFsdWUgcGFpciBpbiB0aGlzIGRlY2xhcmF0aW9uIGlzIHJldmVyc2VkLiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGluZGV4IGFzIGlcIlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF5eXl5eICAgIF5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSAgICBrZXlcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSBuYW1lIG9mIHRoZSB2YWx1ZSBpbiB0aGUgZGVjbGFyYXRpb24sIFwibmdJZlwiIGluIHRoZSBleGFtcGxlXG4gICAqIGFib3ZlLCBhbG9uZyB3aXRoIGl0cyBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUFzQmluZGluZyh2YWx1ZTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcik6IFRlbXBsYXRlQmluZGluZ3xudWxsIHtcbiAgICBpZiAoIXRoaXMucGVla0tleXdvcmRBcygpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBjb25zdW1lIHRoZSAnYXMnIGtleXdvcmRcbiAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3Bhbih2YWx1ZS5zcGFuLnN0YXJ0LCB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldCk7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBiaW5kaW5nIGZvciBhIHZhcmlhYmxlIGRlY2xhcmVkIHVzaW5nIGBsZXRgLiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGxldCBpPWluZGV4O1wiXG4gICAqICAgICAgICAgICBeXl5eXl5eXiAgICAgICAgICAgXl5eXl5eXl5eXl5cbiAgICogYGBgXG4gICAqIEluIHRoZSBmaXJzdCBiaW5kaW5nLCBgaXRlbWAgaXMgYm91bmQgdG8gYE5nRm9yT2ZDb250ZXh0LiRpbXBsaWNpdGAuXG4gICAqIEluIHRoZSBzZWNvbmQgYmluZGluZywgYGlgIGlzIGJvdW5kIHRvIGBOZ0Zvck9mQ29udGV4dC5pbmRleGAuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlTGV0QmluZGluZygpOiBUZW1wbGF0ZUJpbmRpbmd8bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBlZWtLZXl3b3JkTGV0KCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzcGFuU3RhcnQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIGNvbnN1bWUgdGhlICdsZXQnIGtleXdvcmRcbiAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIGxldCB2YWx1ZTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcnxudWxsID0gbnVsbDtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICB2YWx1ZSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgfVxuICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3BhbihzcGFuU3RhcnQsIHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0KTtcbiAgICByZXR1cm4gbmV3IFZhcmlhYmxlQmluZGluZyhzb3VyY2VTcGFuLCBrZXksIHZhbHVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdW1lIHRoZSBvcHRpb25hbCBzdGF0ZW1lbnQgdGVybWluYXRvcjogc2VtaWNvbG9uIG9yIGNvbW1hLlxuICAgKi9cbiAgcHJpdmF0ZSBjb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpIHtcbiAgICB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSB8fCB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlY29yZHMgYW4gZXJyb3IgYW5kIHNraXBzIG92ZXIgdGhlIHRva2VuIHN0cmVhbSB1bnRpbCByZWFjaGluZyBhIHJlY292ZXJhYmxlIHBvaW50LiBTZWVcbiAgICogYHRoaXMuc2tpcGAgZm9yIG1vcmUgZGV0YWlscyBvbiB0b2tlbiBza2lwcGluZy5cbiAgICovXG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgaW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCkge1xuICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlckVycm9yKG1lc3NhZ2UsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KGluZGV4KSwgdGhpcy5sb2NhdGlvbikpO1xuICAgIHRoaXMuc2tpcCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2NhdGlvblRleHQoaW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCkge1xuICAgIGlmIChpbmRleCA9PSBudWxsKSBpbmRleCA9IHRoaXMuaW5kZXg7XG4gICAgcmV0dXJuIChpbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkgPyBgYXQgY29sdW1uICR7dGhpcy50b2tlbnNbaW5kZXhdLmluZGV4ICsgMX0gaW5gIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBhdCB0aGUgZW5kIG9mIHRoZSBleHByZXNzaW9uYDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFcnJvciByZWNvdmVyeSBzaG91bGQgc2tpcCB0b2tlbnMgdW50aWwgaXQgZW5jb3VudGVycyBhIHJlY292ZXJ5IHBvaW50LiBza2lwKCkgdHJlYXRzXG4gICAqIHRoZSBlbmQgb2YgaW5wdXQgYW5kIGEgJzsnIGFzIHVuY29uZGl0aW9uYWxseSBhIHJlY292ZXJ5IHBvaW50LiBJdCBhbHNvIHRyZWF0cyAnKScsXG4gICAqICd9JyBhbmQgJ10nIGFzIGNvbmRpdGlvbmFsIHJlY292ZXJ5IHBvaW50cyBpZiBvbmUgb2YgY2FsbGluZyBwcm9kdWN0aW9ucyBpcyBleHBlY3RpbmdcbiAgICogb25lIG9mIHRoZXNlIHN5bWJvbHMuIFRoaXMgYWxsb3dzIHNraXAoKSB0byByZWNvdmVyIGZyb20gZXJyb3JzIHN1Y2ggYXMgJyhhLikgKyAxJyBhbGxvd2luZ1xuICAgKiBtb3JlIG9mIHRoZSBBU1QgdG8gYmUgcmV0YWluZWQgKGl0IGRvZXNuJ3Qgc2tpcCBhbnkgdG9rZW5zIGFzIHRoZSAnKScgaXMgcmV0YWluZWQgYmVjYXVzZVxuICAgKiBvZiB0aGUgJygnIGJlZ2lucyBhbiAnKCcgPGV4cHI+ICcpJyBwcm9kdWN0aW9uKS4gVGhlIHJlY292ZXJ5IHBvaW50cyBvZiBncm91cGluZyBzeW1ib2xzXG4gICAqIG11c3QgYmUgY29uZGl0aW9uYWwgYXMgdGhleSBtdXN0IGJlIHNraXBwZWQgaWYgbm9uZSBvZiB0aGUgY2FsbGluZyBwcm9kdWN0aW9ucyBhcmUgbm90XG4gICAqIGV4cGVjdGluZyB0aGUgY2xvc2luZyB0b2tlbiBlbHNlIHdlIHdpbGwgbmV2ZXIgbWFrZSBwcm9ncmVzcyBpbiB0aGUgY2FzZSBvZiBhblxuICAgKiBleHRyYW5lb3VzIGdyb3VwIGNsb3Npbmcgc3ltYm9sIChzdWNoIGFzIGEgc3RyYXkgJyknKS4gVGhpcyBpcyBub3QgdGhlIGNhc2UgZm9yICc7JyBiZWNhdXNlXG4gICAqIHBhcnNlQ2hhaW4oKSBpcyBhbHdheXMgdGhlIHJvb3QgcHJvZHVjdGlvbiBhbmQgaXQgZXhwZWN0cyBhICc7Jy5cbiAgICpcbiAgICogRnVydGhlcm1vcmUsIHRoZSBwcmVzZW5jZSBvZiBhIHN0YXRlZnVsIGNvbnRleHQgY2FuIGFkZCBtb3JlIHJlY292ZXJ5IHBvaW50cy5cbiAgICogICAtIGluIGEgYFdyaXRhYmxlYCBjb250ZXh0LCB3ZSBhcmUgYWJsZSB0byByZWNvdmVyIGFmdGVyIHNlZWluZyB0aGUgYD1gIG9wZXJhdG9yLCB3aGljaFxuICAgKiAgICAgc2lnbmFscyB0aGUgcHJlc2VuY2Ugb2YgYW4gaW5kZXBlbmRlbnQgcnZhbHVlIGV4cHJlc3Npb24gZm9sbG93aW5nIHRoZSBgPWAgb3BlcmF0b3IuXG4gICAqXG4gICAqIElmIGEgcHJvZHVjdGlvbiBleHBlY3RzIG9uZSBvZiB0aGVzZSB0b2tlbiBpdCBpbmNyZW1lbnRzIHRoZSBjb3JyZXNwb25kaW5nIG5lc3RpbmcgY291bnQsXG4gICAqIGFuZCB0aGVuIGRlY3JlbWVudHMgaXQganVzdCBwcmlvciB0byBjaGVja2luZyBpZiB0aGUgdG9rZW4gaXMgaW4gdGhlIGlucHV0LlxuICAgKi9cbiAgcHJpdmF0ZSBza2lwKCkge1xuICAgIGxldCBuID0gdGhpcy5uZXh0O1xuICAgIHdoaWxlICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoICYmICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRTRU1JQ09MT04pICYmXG4gICAgICAgICAgICh0aGlzLnJwYXJlbnNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2VzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNFKSkgJiZcbiAgICAgICAgICAgKHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQgPD0gMCB8fCAhbi5pc0NoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpKSAmJlxuICAgICAgICAgICAoISh0aGlzLmNvbnRleHQgJiBQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSkgfHwgIW4uaXNPcGVyYXRvcignPScpKSkge1xuICAgICAgaWYgKHRoaXMubmV4dC5pc0Vycm9yKCkpIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgIG5ldyBQYXJzZXJFcnJvcih0aGlzLm5leHQudG9TdHJpbmcoKSEsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KCksIHRoaXMubG9jYXRpb24pKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgbiA9IHRoaXMubmV4dDtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0SW1wbGljaXRSZWNlaXZlcihhc3Q6IEltcGxpY2l0UmVjZWl2ZXIsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFRoaXNSZWNlaXZlcihhc3Q6IFRoaXNSZWNlaXZlciwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0SW50ZXJwb2xhdGlvbihhc3Q6IEludGVycG9sYXRpb24sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdExpdGVyYWxQcmltaXRpdmUoYXN0OiBMaXRlcmFsUHJpbWl0aXZlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TWV0aG9kQ2FsbChhc3Q6IE1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEZ1bmN0aW9uQ2FsbChhc3Q6IEZ1bmN0aW9uQ2FsbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC52YWx1ZXMsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRVbmFyeShhc3Q6IFVuYXJ5LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaCgncGlwZXMnKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0QWxsKGFzdHM6IGFueVtdLCBjb250ZXh0OiBhbnkpOiBhbnlbXSB7XG4gICAgcmV0dXJuIGFzdHMubWFwKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSkge31cbn1cblxuLyoqXG4gKiBUaGlzIGNsYXNzIGltcGxlbWVudHMgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgdXNlZCBpbiBWaWV3IEVuZ2luZSBhbmQgcGVyZm9ybXMgbW9yZSBzdHJpY3QgY2hlY2tzXG4gKiB0byBtYWtlIHN1cmUgaG9zdCBiaW5kaW5ncyBkbyBub3QgY29udGFpbiBwaXBlcy4gSW4gVmlldyBFbmdpbmUsIGhhdmluZyBwaXBlcyBpbiBob3N0IGJpbmRpbmdzIGlzXG4gKiBub3Qgc3VwcG9ydGVkIGFzIHdlbGwsIGJ1dCBpbiBzb21lIGNhc2VzIChsaWtlIGAhKHZhbHVlIHwgYXN5bmMpYCkgdGhlIGVycm9yIGlzIG5vdCB0cmlnZ2VyZWQgYXRcbiAqIGNvbXBpbGUgdGltZS4gSW4gb3JkZXIgdG8gcHJlc2VydmUgVmlldyBFbmdpbmUgYmVoYXZpb3IsIG1vcmUgc3RyaWN0IGNoZWNrcyBhcmUgaW50cm9kdWNlZCBmb3JcbiAqIEl2eSBtb2RlIG9ubHkuXG4gKi9cbmNsYXNzIEl2eVNpbXBsZUV4cHJlc3Npb25DaGVja2VyIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFNpbXBsZUV4cHJlc3Npb25DaGVja2VyIHtcbiAgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHZpc2l0UGlwZSgpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKCdwaXBlcycpO1xuICB9XG59XG4iXX0=