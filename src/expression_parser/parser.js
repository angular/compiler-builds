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
        define("@angular/compiler/src/expression_parser/parser", ["require", "exports", "tslib", "@angular/compiler/src/chars", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/expression_parser/lexer"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports._ParseAST = exports.IvyParser = exports.Parser = exports.TemplateBindingParseResult = exports.SplitInterpolation = void 0;
    var tslib_1 = require("tslib");
    var chars = require("@angular/compiler/src/chars");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
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
                    var exprEnd = this._getInterpolationEndIndex(input, interpEnd, exprStart);
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
        Parser.prototype._checkNoInterpolation = function (input, location, _a) {
            var e_1, _b;
            var start = _a.start, end = _a.end;
            var startIndex = -1;
            var endIndex = -1;
            try {
                for (var _c = tslib_1.__values(this._forEachUnquotedChar(input, 0)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var charIndex = _d.value;
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
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (startIndex > -1 && endIndex > -1) {
                this._reportError("Got interpolation (" + start + end + ") where expression was expected", input, "at column " + startIndex + " in", location);
            }
        };
        /**
         * Finds the index of the end of an interpolation expression
         * while ignoring comments and quoted content.
         */
        Parser.prototype._getInterpolationEndIndex = function (input, expressionEnd, start) {
            var e_2, _a;
            try {
                for (var _b = tslib_1.__values(this._forEachUnquotedChar(input, start)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var charIndex = _c.value;
                    if (input.startsWith(expressionEnd, charIndex)) {
                        return charIndex;
                    }
                    // Nothing else in the expression matters after we've
                    // hit a comment so look directly for the end token.
                    if (input.startsWith('//', charIndex)) {
                        return input.indexOf(expressionEnd, charIndex);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return -1;
        };
        /**
         * Generator used to iterate over the character indexes of a string that are outside of quotes.
         * @param input String to loop through.
         * @param start Index within the string at which to start.
         */
        Parser.prototype._forEachUnquotedChar = function (input, start) {
            var currentQuote, escapeCount, i, char;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentQuote = null;
                        escapeCount = 0;
                        i = start;
                        _a.label = 1;
                    case 1:
                        if (!(i < input.length)) return [3 /*break*/, 6];
                        char = input[i];
                        if (!(lexer_1.isQuote(input.charCodeAt(i)) && (currentQuote === null || currentQuote === char) &&
                            escapeCount % 2 === 0)) return [3 /*break*/, 2];
                        currentQuote = currentQuote === null ? char : null;
                        return [3 /*break*/, 4];
                    case 2:
                        if (!(currentQuote === null)) return [3 /*break*/, 4];
                        return [4 /*yield*/, i];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        escapeCount = char === '\\' ? escapeCount + 1 : 0;
                        _a.label = 5;
                    case 5:
                        i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
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
            do {
                if (!this.next.isCharacter(terminator)) {
                    result.push(this.parsePipe());
                }
                else {
                    break;
                }
            } while (this.consumeOptionalCharacter(chars.$COMMA));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbURBQWtDO0lBQ2xDLDZGQUFvRztJQUVwRyxtRUFBNGY7SUFDNWYsdUVBQTRFO0lBTzVFO1FBQ0UsNEJBQ1csT0FBNkIsRUFBUyxXQUFpQyxFQUN2RSxPQUFpQjtZQURqQixZQUFPLEdBQVAsT0FBTyxDQUFzQjtZQUFTLGdCQUFXLEdBQVgsV0FBVyxDQUFzQjtZQUN2RSxZQUFPLEdBQVAsT0FBTyxDQUFVO1FBQUcsQ0FBQztRQUNsQyx5QkFBQztJQUFELENBQUMsQUFKRCxJQUlDO0lBSlksZ0RBQWtCO0lBTS9CO1FBQ0Usb0NBQ1csZ0JBQW1DLEVBQVMsUUFBa0IsRUFDOUQsTUFBcUI7WUFEckIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFtQjtZQUFTLGFBQVEsR0FBUixRQUFRLENBQVU7WUFDOUQsV0FBTSxHQUFOLE1BQU0sQ0FBZTtRQUFHLENBQUM7UUFDdEMsaUNBQUM7SUFBRCxDQUFDLEFBSkQsSUFJQztJQUpZLGdFQUEwQjtJQU12QztRQUdFLGdCQUFvQixNQUFhO1lBQWIsV0FBTSxHQUFOLE1BQU0sQ0FBTztZQUZ6QixXQUFNLEdBQWtCLEVBQUUsQ0FBQztZQUluQyw0QkFBdUIsR0FBRyx1QkFBdUIsQ0FBQztRQUZkLENBQUM7UUFJckMsNEJBQVcsR0FBWCxVQUNJLEtBQWEsRUFBRSxRQUFnQixFQUFFLGNBQXNCLEVBQ3ZELG1CQUF1RTtZQUF2RSxvQ0FBQSxFQUFBLHNCQUEyQyxtREFBNEI7WUFDekUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztZQUNqRSxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQy9DLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNoRSxJQUFNLEdBQUcsR0FBRyxJQUFJLFNBQVMsQ0FDVCxLQUFLLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFDOUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO2lCQUNqQyxVQUFVLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUksbUJBQWEsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlFLENBQUM7UUFFRCw2QkFBWSxHQUFaLFVBQ0ksS0FBYSxFQUFFLFFBQWdCLEVBQUUsY0FBc0IsRUFDdkQsbUJBQXVFO1lBQXZFLG9DQUFBLEVBQUEsc0JBQTJDLG1EQUE0QjtZQUN6RSxJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztZQUN4RixPQUFPLElBQUksbUJBQWEsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlFLENBQUM7UUFFTyxzQ0FBcUIsR0FBN0IsVUFBOEIsR0FBUTtZQUNwQyxJQUFNLE9BQU8sR0FBRyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ25ELEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDbkIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQ3hCLENBQUM7UUFFRCxtQ0FBa0IsR0FBbEIsVUFDSSxLQUFhLEVBQUUsUUFBZ0IsRUFBRSxjQUFzQixFQUN2RCxtQkFBdUU7WUFBdkUsb0NBQUEsRUFBQSxzQkFBMkMsbURBQTRCO1lBQ3pFLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1lBQ3hGLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMvQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUNyQixJQUFJLENBQUMsWUFBWSxDQUNiLDRDQUEwQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQzthQUNwRjtZQUNELE9BQU8sSUFBSSxtQkFBYSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUUsQ0FBQztRQUVPLDZCQUFZLEdBQXBCLFVBQXFCLE9BQWUsRUFBRSxLQUFhLEVBQUUsV0FBbUIsRUFBRSxXQUFvQjtZQUM1RixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFXLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBRU8saUNBQWdCLEdBQXhCLFVBQ0ksS0FBYSxFQUFFLFFBQWdCLEVBQUUsY0FBc0IsRUFDdkQsbUJBQXdDO1lBQzFDLDZFQUE2RTtZQUM3RSxvRUFBb0U7WUFDcEUsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBRWhFLElBQUksS0FBSyxJQUFJLElBQUksRUFBRTtnQkFDakIsT0FBTyxLQUFLLENBQUM7YUFDZDtZQUVELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFDakUsSUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMvQyxJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNqRCxPQUFPLElBQUksU0FBUyxDQUNULEtBQUssRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxFQUMvRSxLQUFLLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUM7aUJBQ3hDLFVBQVUsRUFBRSxDQUFDO1FBQ3BCLENBQUM7UUFFTyw0QkFBVyxHQUFuQixVQUFvQixLQUFrQixFQUFFLFFBQWdCLEVBQUUsY0FBc0I7WUFDOUUsSUFBSSxLQUFLLElBQUksSUFBSTtnQkFBRSxPQUFPLElBQUksQ0FBQztZQUMvQixJQUFNLG9CQUFvQixHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDaEQsSUFBSSxvQkFBb0IsSUFBSSxDQUFDLENBQUM7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFDNUMsSUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsb0JBQW9CLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUMvRCxJQUFJLENBQUMsb0JBQVksQ0FBQyxNQUFNLENBQUM7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFDdkMsSUFBTSx1QkFBdUIsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLG9CQUFvQixHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzFFLElBQU0sSUFBSSxHQUFHLElBQUksZUFBUyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDNUMsT0FBTyxJQUFJLFdBQUssQ0FDWixJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRSxNQUFNLEVBQUUsdUJBQXVCLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDeEYsQ0FBQztRQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1dBeUJHO1FBQ0gsc0NBQXFCLEdBQXJCLFVBQ0ksV0FBbUIsRUFBRSxhQUFxQixFQUFFLFdBQW1CLEVBQUUsaUJBQXlCLEVBQzFGLG1CQUEyQjtZQUM3QixJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNuRCxJQUFNLE1BQU0sR0FBRyxJQUFJLFNBQVMsQ0FDeEIsYUFBYSxFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDLE1BQU0sRUFDN0UsS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUM7WUFDbkUsT0FBTyxNQUFNLENBQUMscUJBQXFCLENBQUM7Z0JBQ2xDLE1BQU0sRUFBRSxXQUFXO2dCQUNuQixJQUFJLEVBQUUsSUFBSSx3QkFBa0IsQ0FBQyxpQkFBaUIsRUFBRSxpQkFBaUIsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO2FBQ3hGLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxtQ0FBa0IsR0FBbEIsVUFDSSxLQUFhLEVBQUUsUUFBZ0IsRUFBRSxjQUFzQixFQUN2RCxtQkFBdUU7WUFBdkUsb0NBQUEsRUFBQSxzQkFBMkMsbURBQTRCO1lBQ25FLElBQUEsS0FDRixJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxtQkFBbUIsQ0FBQyxFQUQxRCxPQUFPLGFBQUEsRUFBRSxXQUFXLGlCQUFBLEVBQUUsT0FBTyxhQUM2QixDQUFDO1lBQ2xFLElBQUksV0FBVyxDQUFDLE1BQU0sS0FBSyxDQUFDO2dCQUFFLE9BQU8sSUFBSSxDQUFDO1lBRTFDLElBQU0sZUFBZSxHQUFVLEVBQUUsQ0FBQztZQUVsQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtnQkFDM0MsSUFBTSxjQUFjLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDM0MsSUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsQ0FBQztnQkFDeEQsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ2pELElBQU0sR0FBRyxHQUFHLElBQUksU0FBUyxDQUNULEtBQUssRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFDbEUsSUFBSSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztxQkFDdEUsVUFBVSxFQUFFLENBQUM7Z0JBQzlCLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDM0I7WUFFRCxPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FDOUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsQ0FBQyxJQUFJLEVBQU4sQ0FBTSxDQUFDLEVBQUUsZUFBZSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDbEYsQ0FBQztRQUVEOzs7O1dBSUc7UUFDSCw2Q0FBNEIsR0FBNUIsVUFBNkIsVUFBa0IsRUFBRSxRQUFnQixFQUFFLGNBQXNCO1lBRXZGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDcEQsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDakQsSUFBTSxHQUFHLEdBQUcsSUFBSSxTQUFTLENBQ1QsVUFBVSxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxNQUFNO1lBQ2hFLGlCQUFpQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztpQkFDdkMsVUFBVSxFQUFFLENBQUM7WUFDOUIsSUFBTSxPQUFPLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBRSwrQ0FBK0M7WUFDMUUsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUMzRixDQUFDO1FBRU8sdUNBQXNCLEdBQTlCLFVBQ0ksT0FBaUIsRUFBRSxXQUFrQixFQUFFLEtBQWEsRUFBRSxRQUFnQixFQUN0RSxjQUFzQjtZQUN4QixJQUFNLElBQUksR0FBRyxJQUFJLGVBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzVDLElBQU0sYUFBYSxHQUNmLElBQUksbUJBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDbkYsT0FBTyxJQUFJLG1CQUFhLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN4RixDQUFDO1FBRUQ7Ozs7OztXQU1HO1FBQ0gsbUNBQWtCLEdBQWxCLFVBQ0ksS0FBYSxFQUFFLFFBQWdCLEVBQy9CLG1CQUF1RTtZQUF2RSxvQ0FBQSxFQUFBLHNCQUEyQyxtREFBNEI7WUFDekUsSUFBTSxPQUFPLEdBQXlCLEVBQUUsQ0FBQztZQUN6QyxJQUFNLFdBQVcsR0FBeUIsRUFBRSxDQUFDO1lBQzdDLElBQU0sT0FBTyxHQUFhLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDVixJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUM7WUFDNUIsSUFBSSxnQkFBZ0IsR0FBRyxLQUFLLENBQUM7WUFDeEIsSUFBTyxXQUFXLEdBQW9CLG1CQUFtQixNQUF2QyxFQUFPLFNBQVMsR0FBSSxtQkFBbUIsSUFBdkIsQ0FBd0I7WUFDL0QsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRTtnQkFDdkIsSUFBSSxDQUFDLGVBQWUsRUFBRTtvQkFDcEIsMEJBQTBCO29CQUMxQixJQUFNLEtBQUssR0FBRyxDQUFDLENBQUM7b0JBQ2hCLENBQUMsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDbEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7d0JBQ1osQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7cUJBQ2xCO29CQUNELElBQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUN2QyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUMsSUFBSSxNQUFBLEVBQUUsS0FBSyxPQUFBLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQyxDQUFDLENBQUM7b0JBRXBDLGVBQWUsR0FBRyxJQUFJLENBQUM7aUJBQ3hCO3FCQUFNO29CQUNMLDRFQUE0RTtvQkFDNUUsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO29CQUNwQixJQUFNLFNBQVMsR0FBRyxTQUFTLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztvQkFDakQsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQzVFLElBQUksT0FBTyxLQUFLLENBQUMsQ0FBQyxFQUFFO3dCQUNsQiwyRUFBMkU7d0JBQzNFLCtEQUErRDt3QkFDL0QsZUFBZSxHQUFHLEtBQUssQ0FBQzt3QkFDeEIsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO3dCQUN4QixNQUFNO3FCQUNQO29CQUNELElBQU0sT0FBTyxHQUFHLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO29CQUUzQyxJQUFNLElBQUksR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztvQkFDakQsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTt3QkFDMUIsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFDLElBQUksTUFBQSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBQyxDQUFDLENBQUM7cUJBQzFEO3lCQUFNO3dCQUNMLElBQUksQ0FBQyxZQUFZLENBQ2IsMkRBQTJELEVBQUUsS0FBSyxFQUNsRSxlQUFhLENBQUMsUUFBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUNuQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUMsQ0FBQyxDQUFDO3FCQUN2RTtvQkFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUV4QixDQUFDLEdBQUcsT0FBTyxDQUFDO29CQUNaLGVBQWUsR0FBRyxLQUFLLENBQUM7aUJBQ3pCO2FBQ0Y7WUFDRCxJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwQiw4RUFBOEU7Z0JBQzlFLElBQUksZ0JBQWdCLEVBQUU7b0JBQ3BCLElBQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUMxQyxLQUFLLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2pDLEtBQUssQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztpQkFDMUI7cUJBQU07b0JBQ0wsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFDLElBQUksRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUMsQ0FBQyxDQUFDO2lCQUN2RTthQUNGO1lBQ0QsT0FBTyxJQUFJLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVELHFDQUFvQixHQUFwQixVQUFxQixLQUFrQixFQUFFLFFBQWdCLEVBQUUsY0FBc0I7WUFFL0UsSUFBTSxJQUFJLEdBQUcsSUFBSSxlQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2hFLE9BQU8sSUFBSSxtQkFBYSxDQUNwQixJQUFJLHNCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQ25GLGNBQWMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUVPLCtCQUFjLEdBQXRCLFVBQXVCLEtBQWE7WUFDbEMsSUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDMUQsQ0FBQztRQUVPLDhCQUFhLEdBQXJCLFVBQXNCLEtBQWE7WUFDakMsSUFBSSxVQUFVLEdBQWdCLElBQUksQ0FBQztZQUNuQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3pDLElBQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLElBQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUV6QyxJQUFJLElBQUksS0FBSyxLQUFLLENBQUMsTUFBTSxJQUFJLFFBQVEsSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLFVBQVUsSUFBSSxJQUFJO29CQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUV0RixJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7b0JBQ3ZCLFVBQVUsR0FBRyxJQUFJLENBQUM7aUJBQ25CO3FCQUFNLElBQUksVUFBVSxJQUFJLElBQUksSUFBSSxlQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzlDLFVBQVUsR0FBRyxJQUFJLENBQUM7aUJBQ25CO2FBQ0Y7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFTyxzQ0FBcUIsR0FBN0IsVUFBOEIsS0FBYSxFQUFFLFFBQWdCLEVBQUUsRUFBaUM7O2dCQUFoQyxLQUFLLFdBQUEsRUFBRSxHQUFHLFNBQUE7WUFFeEUsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDcEIsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7O2dCQUVsQixLQUF3QixJQUFBLEtBQUEsaUJBQUEsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQSxnQkFBQSw0QkFBRTtvQkFBeEQsSUFBTSxTQUFTLFdBQUE7b0JBQ2xCLElBQUksVUFBVSxLQUFLLENBQUMsQ0FBQyxFQUFFO3dCQUNyQixJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUU7NEJBQzNCLFVBQVUsR0FBRyxTQUFTLENBQUM7eUJBQ3hCO3FCQUNGO3lCQUFNO3dCQUNMLFFBQVEsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxTQUFTLENBQUMsQ0FBQzt3QkFDakUsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDLEVBQUU7NEJBQ2pCLE1BQU07eUJBQ1A7cUJBQ0Y7aUJBQ0Y7Ozs7Ozs7OztZQUVELElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQyxJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDcEMsSUFBSSxDQUFDLFlBQVksQ0FDYix3QkFBc0IsS0FBSyxHQUFHLEdBQUcsb0NBQWlDLEVBQUUsS0FBSyxFQUN6RSxlQUFhLFVBQVUsUUFBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQzdDO1FBQ0gsQ0FBQztRQUVEOzs7V0FHRztRQUNLLDBDQUF5QixHQUFqQyxVQUFrQyxLQUFhLEVBQUUsYUFBcUIsRUFBRSxLQUFhOzs7Z0JBQ25GLEtBQXdCLElBQUEsS0FBQSxpQkFBQSxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFBLGdCQUFBLDRCQUFFO29CQUE1RCxJQUFNLFNBQVMsV0FBQTtvQkFDbEIsSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsRUFBRTt3QkFDOUMsT0FBTyxTQUFTLENBQUM7cUJBQ2xCO29CQUVELHFEQUFxRDtvQkFDckQsb0RBQW9EO29CQUNwRCxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxFQUFFO3dCQUNyQyxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxDQUFDO3FCQUNoRDtpQkFDRjs7Ozs7Ozs7O1lBRUQsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNaLENBQUM7UUFFRDs7OztXQUlHO1FBQ08scUNBQW9CLEdBQTlCLFVBQStCLEtBQWEsRUFBRSxLQUFhOzs7Ozt3QkFDckQsWUFBWSxHQUFnQixJQUFJLENBQUM7d0JBQ2pDLFdBQVcsR0FBRyxDQUFDLENBQUM7d0JBQ1gsQ0FBQyxHQUFHLEtBQUs7Ozs2QkFBRSxDQUFBLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFBO3dCQUM1QixJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDOzZCQUdsQixDQUFBLGVBQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLEtBQUssSUFBSSxJQUFJLFlBQVksS0FBSyxJQUFJLENBQUM7NEJBQ2hGLFdBQVcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFBLEVBRHJCLHdCQUNxQjt3QkFDdkIsWUFBWSxHQUFHLFlBQVksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDOzs7NkJBQzFDLENBQUEsWUFBWSxLQUFLLElBQUksQ0FBQSxFQUFyQix3QkFBcUI7d0JBQzlCLHFCQUFNLENBQUMsRUFBQTs7d0JBQVAsU0FBTyxDQUFDOzs7d0JBRVYsV0FBVyxHQUFHLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7O3dCQVZkLENBQUMsRUFBRSxDQUFBOzs7OztTQVkxQztRQUNILGFBQUM7SUFBRCxDQUFDLEFBalZELElBaVZDO0lBalZZLHdCQUFNO0lBbVZuQjtRQUErQixxQ0FBTTtRQUFyQztZQUFBLHFFQUVDO1lBREMsNkJBQXVCLEdBQUcsMEJBQTBCLENBQUM7O1FBQ3ZELENBQUM7UUFBRCxnQkFBQztJQUFELENBQUMsQUFGRCxDQUErQixNQUFNLEdBRXBDO0lBRlksOEJBQVM7SUFJdEIsK0RBQStEO0lBQy9ELElBQUssaUJBVUo7SUFWRCxXQUFLLGlCQUFpQjtRQUNwQix5REFBUSxDQUFBO1FBQ1I7Ozs7OztXQU1HO1FBQ0gsaUVBQVksQ0FBQTtJQUNkLENBQUMsRUFWSSxpQkFBaUIsS0FBakIsaUJBQWlCLFFBVXJCO0lBRUQ7UUFjRSxtQkFDVyxLQUFhLEVBQVMsUUFBZ0IsRUFBUyxjQUFzQixFQUNyRSxNQUFlLEVBQVMsV0FBbUIsRUFBUyxXQUFvQixFQUN2RSxNQUFxQixFQUFVLE1BQWM7WUFGOUMsVUFBSyxHQUFMLEtBQUssQ0FBUTtZQUFTLGFBQVEsR0FBUixRQUFRLENBQVE7WUFBUyxtQkFBYyxHQUFkLGNBQWMsQ0FBUTtZQUNyRSxXQUFNLEdBQU4sTUFBTSxDQUFTO1lBQVMsZ0JBQVcsR0FBWCxXQUFXLENBQVE7WUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBUztZQUN2RSxXQUFNLEdBQU4sTUFBTSxDQUFlO1lBQVUsV0FBTSxHQUFOLE1BQU0sQ0FBUTtZQWhCakQsb0JBQWUsR0FBRyxDQUFDLENBQUM7WUFDcEIsc0JBQWlCLEdBQUcsQ0FBQyxDQUFDO1lBQ3RCLG9CQUFlLEdBQUcsQ0FBQyxDQUFDO1lBQ3BCLFlBQU8sR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUM7WUFFekMsK0ZBQStGO1lBQy9GLDZEQUE2RDtZQUM3RCxpR0FBaUc7WUFDakcsbUVBQW1FO1lBQzNELG9CQUFlLEdBQUcsSUFBSSxHQUFHLEVBQThCLENBQUM7WUFFaEUsVUFBSyxHQUFXLENBQUMsQ0FBQztRQUswQyxDQUFDO1FBRTdELHdCQUFJLEdBQUosVUFBSyxNQUFjO1lBQ2pCLElBQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDO1lBQzlCLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFHLENBQUM7UUFDdkQsQ0FBQztRQUVELHNCQUFJLDJCQUFJO2lCQUFSO2dCQUNFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0QixDQUFDOzs7V0FBQTtRQUdELHNCQUFJLDRCQUFLO1lBRFQsdURBQXVEO2lCQUN2RDtnQkFDRSxPQUFPLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFDMUMsQ0FBQzs7O1dBQUE7UUFNRCxzQkFBSSxpQ0FBVTtZQUpkOzs7ZUFHRztpQkFDSDtnQkFDRSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDM0UsQ0FBQzs7O1dBQUE7UUFNRCxzQkFBSSxzQ0FBZTtZQUpuQjs7O2VBR0c7aUJBQ0g7Z0JBQ0UsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRTtvQkFDbEIsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUMvQixPQUFPLFFBQVEsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztpQkFDbkM7Z0JBQ0QsOEZBQThGO2dCQUM5Rix3QkFBd0I7Z0JBQ3hCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO29CQUM1QixPQUFPLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztpQkFDdkM7Z0JBQ0QsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ3ZDLENBQUM7OztXQUFBO1FBS0Qsc0JBQUksNENBQXFCO1lBSHpCOztlQUVHO2lCQUNIO2dCQUNFLE9BQU8sSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1lBQy9DLENBQUM7OztXQUFBO1FBRUQsd0JBQUksR0FBSixVQUFLLEtBQWE7WUFDaEIsT0FBTyxJQUFJLGVBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3BELENBQUM7UUFFRCw4QkFBVSxHQUFWLFVBQVcsS0FBYTtZQUN0QixJQUFNLE1BQU0sR0FBTSxLQUFLLFNBQUksSUFBSSxDQUFDLFVBQVksQ0FBQztZQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3JDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQzthQUNwRjtZQUNELE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFFLENBQUM7UUFDM0MsQ0FBQztRQUVELDJCQUFPLEdBQVA7WUFDRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDZixDQUFDO1FBRUQ7O1dBRUc7UUFDSywrQkFBVyxHQUFuQixVQUF1QixPQUEwQixFQUFFLEVBQVc7WUFDNUQsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUM7WUFDeEIsSUFBTSxHQUFHLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUM7WUFDeEIsT0FBTyxHQUFHLENBQUM7UUFDYixDQUFDO1FBRUQsNENBQXdCLEdBQXhCLFVBQXlCLElBQVk7WUFDbkMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDL0IsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNmLE9BQU8sSUFBSSxDQUFDO2FBQ2I7aUJBQU07Z0JBQ0wsT0FBTyxLQUFLLENBQUM7YUFDZDtRQUNILENBQUM7UUFFRCxrQ0FBYyxHQUFkO1lBQ0UsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2xDLENBQUM7UUFDRCxpQ0FBYSxHQUFiO1lBQ0UsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2pDLENBQUM7UUFFRDs7Ozs7V0FLRztRQUNILG1DQUFlLEdBQWYsVUFBZ0IsSUFBWTtZQUMxQixJQUFJLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUM7Z0JBQUUsT0FBTztZQUNoRCxJQUFJLENBQUMsS0FBSyxDQUFDLHNCQUFvQixNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBRyxDQUFDLENBQUM7UUFDOUQsQ0FBQztRQUVELDJDQUF1QixHQUF2QixVQUF3QixFQUFVO1lBQ2hDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQzVCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDZixPQUFPLElBQUksQ0FBQzthQUNiO2lCQUFNO2dCQUNMLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7UUFDSCxDQUFDO1FBRUQsa0NBQWMsR0FBZCxVQUFlLFFBQWdCO1lBQzdCLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQztnQkFBRSxPQUFPO1lBQ25ELElBQUksQ0FBQyxLQUFLLENBQUMsK0JBQTZCLFFBQVUsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFFRCxvQ0FBZ0IsR0FBaEIsVUFBaUIsR0FBVTtZQUN6QixPQUFPLEdBQUcsS0FBSyxXQUFHLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsV0FBUyxHQUFLLENBQUM7UUFDdkQsQ0FBQztRQUVELDZDQUF5QixHQUF6QjtZQUNFLElBQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDcEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRTtnQkFDdkMsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBYyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLHFDQUFrQyxDQUFDLENBQUM7Z0JBQ3JGLE9BQU8sRUFBRSxDQUFDO2FBQ1g7WUFDRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsQ0FBQyxRQUFRLEVBQVksQ0FBQztRQUNoQyxDQUFDO1FBRUQscURBQWlDLEdBQWpDO1lBQ0UsSUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztZQUNwQixJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFO2dCQUN4RCxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFjLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsOENBQTJDLENBQUMsQ0FBQztnQkFDOUYsT0FBTyxFQUFFLENBQUM7YUFDWDtZQUNELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxDQUFDLFFBQVEsRUFBWSxDQUFDO1FBQ2hDLENBQUM7UUFFRCw4QkFBVSxHQUFWO1lBQ0UsSUFBTSxLQUFLLEdBQVUsRUFBRSxDQUFDO1lBQ3hCLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDOUIsT0FBTyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUN0QyxJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQzlCLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBRWpCLElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsRUFBRTtvQkFDbkQsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUU7d0JBQ3JCLElBQUksQ0FBQyxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztxQkFDcEU7b0JBQ0QsT0FBTyxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFO3FCQUN2RCxDQUFFLHNCQUFzQjtpQkFDMUI7cUJBQU0sSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO29CQUMxQyxJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUFxQixJQUFJLENBQUMsSUFBSSxNQUFHLENBQUMsQ0FBQztpQkFDL0M7YUFDRjtZQUNELElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDO2dCQUFFLE9BQU8sSUFBSSxlQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDdEYsSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUM7Z0JBQUUsT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkMsT0FBTyxJQUFJLFdBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDcEUsQ0FBQztRQUVELDZCQUFTLEdBQVQ7WUFDRSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDcEMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3JDLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtvQkFDcEIsSUFBSSxDQUFDLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO2lCQUMxRDtnQkFFRCxHQUFHO29CQUNELElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7b0JBQ2xDLElBQU0sTUFBSSxHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO29CQUM5QyxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUM1QyxJQUFNLElBQUksR0FBVSxFQUFFLENBQUM7b0JBQ3ZCLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTt3QkFDbEQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQztxQkFDbkM7b0JBQ00sSUFBQSxLQUFLLEdBQUksTUFBTSxDQUFDLElBQUksTUFBZixDQUFnQjtvQkFDNUIsTUFBTTt3QkFDRixJQUFJLGlCQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2lCQUM3RixRQUFRLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsRUFBRTthQUM3QztZQUVELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxtQ0FBZSxHQUFmO1lBQ0UsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUNqQyxDQUFDO1FBRUQsb0NBQWdCLEdBQWhCO1lBQ0UsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUM5QixJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFFckMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3JDLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDN0IsSUFBSSxFQUFFLFNBQUssQ0FBQztnQkFDWixJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDaEQsSUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztvQkFDNUIsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUNwRCxJQUFJLENBQUMsS0FBSyxDQUFDLDRCQUEwQixVQUFVLGdDQUE2QixDQUFDLENBQUM7b0JBQzlFLEVBQUUsR0FBRyxJQUFJLGVBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztpQkFDOUQ7cUJBQU07b0JBQ0wsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztpQkFDdkI7Z0JBQ0QsT0FBTyxJQUFJLGlCQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7YUFDbkY7aUJBQU07Z0JBQ0wsT0FBTyxNQUFNLENBQUM7YUFDZjtRQUNILENBQUM7UUFFRCxrQ0FBYyxHQUFkO1lBQ0UsT0FBTztZQUNQLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNwQyxPQUFPLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDekMsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUM5QixJQUFBLEtBQUssR0FBSSxNQUFNLENBQUMsSUFBSSxNQUFmLENBQWdCO2dCQUM1QixNQUFNLEdBQUcsSUFBSSxZQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDcEY7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRUQsbUNBQWUsR0FBZjtZQUNFLE9BQU87WUFDUCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDbEMsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3pDLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDNUIsSUFBQSxLQUFLLEdBQUksTUFBTSxDQUFDLElBQUksTUFBZixDQUFnQjtnQkFDNUIsTUFBTSxHQUFHLElBQUksWUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQ3BGO1lBQ0QsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELGlDQUFhLEdBQWI7WUFDRSx3QkFBd0I7WUFDeEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksaUJBQVMsQ0FBQyxRQUFRLEVBQUU7Z0JBQzNDLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO2dCQUNwQyxRQUFRLFFBQVEsRUFBRTtvQkFDaEIsS0FBSyxJQUFJLENBQUM7b0JBQ1YsS0FBSyxLQUFLLENBQUM7b0JBQ1gsS0FBSyxJQUFJLENBQUM7b0JBQ1YsS0FBSyxLQUFLO3dCQUNSLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQzt3QkFDZixJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7d0JBQzlCLElBQUEsS0FBSyxHQUFJLE1BQU0sQ0FBQyxJQUFJLE1BQWYsQ0FBZ0I7d0JBQzVCLE1BQU0sR0FBRyxJQUFJLFlBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQzt3QkFDdkYsU0FBUztpQkFDWjtnQkFDRCxNQUFNO2FBQ1A7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRUQsbUNBQWUsR0FBZjtZQUNFLHVCQUF1QjtZQUN2QixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDbEMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxpQkFBUyxDQUFDLFFBQVEsRUFBRTtnQkFDM0MsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7Z0JBQ3BDLFFBQVEsUUFBUSxFQUFFO29CQUNoQixLQUFLLEdBQUcsQ0FBQztvQkFDVCxLQUFLLEdBQUcsQ0FBQztvQkFDVCxLQUFLLElBQUksQ0FBQztvQkFDVixLQUFLLElBQUk7d0JBQ1AsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNmLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQzt3QkFDNUIsSUFBQSxLQUFLLEdBQUksTUFBTSxDQUFDLElBQUksTUFBZixDQUFnQjt3QkFDNUIsTUFBTSxHQUFHLElBQUksWUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO3dCQUN2RixTQUFTO2lCQUNaO2dCQUNELE1BQU07YUFDUDtZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxpQ0FBYSxHQUFiO1lBQ0UsV0FBVztZQUNYLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQ3hDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksaUJBQVMsQ0FBQyxRQUFRLEVBQUU7Z0JBQzNDLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO2dCQUNwQyxRQUFRLFFBQVEsRUFBRTtvQkFDaEIsS0FBSyxHQUFHLENBQUM7b0JBQ1QsS0FBSyxHQUFHO3dCQUNOLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQzt3QkFDZixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQzt3QkFDaEMsSUFBQSxLQUFLLEdBQUksTUFBTSxDQUFDLElBQUksTUFBZixDQUFnQjt3QkFDNUIsTUFBTSxHQUFHLElBQUksWUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO3dCQUN2RixTQUFTO2lCQUNaO2dCQUNELE1BQU07YUFDUDtZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCx1Q0FBbUIsR0FBbkI7WUFDRSxnQkFBZ0I7WUFDaEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2hDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksaUJBQVMsQ0FBQyxRQUFRLEVBQUU7Z0JBQzNDLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO2dCQUNwQyxRQUFRLFFBQVEsRUFBRTtvQkFDaEIsS0FBSyxHQUFHLENBQUM7b0JBQ1QsS0FBSyxHQUFHLENBQUM7b0JBQ1QsS0FBSyxHQUFHO3dCQUNOLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQzt3QkFDZixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQ3hCLElBQUEsS0FBSyxHQUFJLE1BQU0sQ0FBQyxJQUFJLE1BQWYsQ0FBZ0I7d0JBQzVCLE1BQU0sR0FBRyxJQUFJLFlBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQzt3QkFDdkYsU0FBUztpQkFDWjtnQkFDRCxNQUFNO2FBQ1A7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRUQsK0JBQVcsR0FBWDtZQUNFLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksaUJBQVMsQ0FBQyxRQUFRLEVBQUU7Z0JBQ3hDLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7Z0JBQzlCLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO2dCQUNwQyxJQUFJLE1BQU0sU0FBSyxDQUFDO2dCQUNoQixRQUFRLFFBQVEsRUFBRTtvQkFDaEIsS0FBSyxHQUFHO3dCQUNOLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQzt3QkFDZixNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUM1QixPQUFPLFdBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUM1RSxLQUFLLEdBQUc7d0JBQ04sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNmLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQzVCLE9BQU8sV0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7b0JBQzdFLEtBQUssR0FBRzt3QkFDTixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ2YsTUFBTSxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDNUIsT0FBTyxJQUFJLGVBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7aUJBQzFFO2FBQ0Y7WUFDRCxPQUFPLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUMvQixDQUFDO1FBRUQsa0NBQWMsR0FBZDtZQUFBLGlCQTJDQztZQTFDQyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDakMsSUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDdEMsT0FBTyxJQUFJLEVBQUU7Z0JBQ1gsSUFBSSxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUNoRCxNQUFNLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztpQkFFNUQ7cUJBQU0sSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzdDLE1BQU0sR0FBRyxJQUFJLENBQUMsNkJBQTZCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO2lCQUUzRDtxQkFBTSxJQUFJLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQ3pELElBQUksQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFO3dCQUMzQyxLQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQzt3QkFDekIsSUFBTSxHQUFHLEdBQUcsS0FBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO3dCQUM3QixJQUFJLEdBQUcsWUFBWSxlQUFTLEVBQUU7NEJBQzVCLEtBQUksQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQzt5QkFDMUM7d0JBQ0QsS0FBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7d0JBQ3pCLEtBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUN0QyxJQUFJLEtBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsRUFBRTs0QkFDckMsSUFBTSxLQUFLLEdBQUcsS0FBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7NEJBQ3RDLE1BQU0sR0FBRyxJQUFJLGdCQUFVLENBQ25CLEtBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsS0FBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO3lCQUMvRTs2QkFBTTs0QkFDTCxNQUFNO2dDQUNGLElBQUksZUFBUyxDQUFDLEtBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsS0FBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUM7eUJBQ3RGO29CQUNILENBQUMsQ0FBQyxDQUFDO2lCQUNKO3FCQUFNLElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRTtvQkFDdkQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUN2QixJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDdkMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUN2QixJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDcEMsTUFBTTt3QkFDRixJQUFJLGtCQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFFMUY7cUJBQU0sSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQzVDLE1BQU0sR0FBRyxJQUFJLG1CQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUUxRjtxQkFBTTtvQkFDTCxPQUFPLE1BQU0sQ0FBQztpQkFDZjthQUNGO1FBQ0gsQ0FBQztRQUVELGdDQUFZLEdBQVo7WUFDRSxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1lBQzlCLElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDaEQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUN2QixJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3BDLE9BQU8sTUFBTSxDQUFDO2FBRWY7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFO2dCQUNwQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxJQUFJLHNCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzthQUU3RTtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsRUFBRTtnQkFDekMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNmLE9BQU8sSUFBSSxzQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQzthQUUvRTtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUU7Z0JBQ3BDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDZixPQUFPLElBQUksc0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2FBRTdFO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRTtnQkFDckMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNmLE9BQU8sSUFBSSxzQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFFOUU7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFO2dCQUNwQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxJQUFJLGtCQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7YUFDbkU7aUJBQU0sSUFBSSxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUN6RCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDekIsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDM0QsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3pCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUN0QyxPQUFPLElBQUksa0JBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7YUFFN0U7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQy9DLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO2FBRS9CO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRTtnQkFDbkMsT0FBTyxJQUFJLENBQUMsNkJBQTZCLENBQ3JDLElBQUksc0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFFNUU7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFO2dCQUMvQixJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNuQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxJQUFJLHNCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUU5RTtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUU7Z0JBQy9CLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDZixPQUFPLElBQUksc0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO2FBRXJGO2lCQUFNLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtnQkFDM0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxtQ0FBaUMsSUFBSSxDQUFDLEtBQU8sQ0FBQyxDQUFDO2dCQUMxRCxPQUFPLElBQUksZUFBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2FBQ2hFO2lCQUFNO2dCQUNMLElBQUksQ0FBQyxLQUFLLENBQUMsc0JBQW9CLElBQUksQ0FBQyxJQUFNLENBQUMsQ0FBQztnQkFDNUMsT0FBTyxJQUFJLGVBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzthQUNoRTtRQUNILENBQUM7UUFFRCx1Q0FBbUIsR0FBbkIsVUFBb0IsVUFBa0I7WUFDcEMsSUFBTSxNQUFNLEdBQVUsRUFBRSxDQUFDO1lBRXpCLEdBQUc7Z0JBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxFQUFFO29CQUN0QyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO2lCQUMvQjtxQkFBTTtvQkFDTCxNQUFNO2lCQUNQO2FBQ0YsUUFBUSxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3RELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxtQ0FBZSxHQUFmO1lBQ0UsSUFBTSxJQUFJLEdBQW9CLEVBQUUsQ0FBQztZQUNqQyxJQUFNLE1BQU0sR0FBVSxFQUFFLENBQUM7WUFDekIsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUM5QixJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNwQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDakQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUN2QixHQUFHO29CQUNELElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQ3BDLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDO29CQUNyRCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxLQUFBLEVBQUUsTUFBTSxRQUFBLEVBQUMsQ0FBQyxDQUFDO29CQUN6QixJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDbkMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztpQkFDL0IsUUFBUSxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN0RCxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2FBQ3JDO1lBQ0QsT0FBTyxJQUFJLGdCQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNoRixDQUFDO1FBRUQsaURBQTZCLEdBQTdCLFVBQThCLFFBQWEsRUFBRSxNQUF1QjtZQUFwRSxpQkE4Q0M7WUE5QzRDLHVCQUFBLEVBQUEsY0FBdUI7WUFDbEUsSUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDbEMsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUNsQyxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtnQkFDdEQsSUFBTSxFQUFFLEdBQUcsS0FBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7Z0JBQzVDLElBQUksRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7b0JBQ25CLEtBQUksQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDMUU7Z0JBQ0QsT0FBTyxFQUFFLENBQUM7WUFDWixDQUFDLENBQUMsQ0FBQztZQUNILElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFNUMsSUFBSSxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNoRCxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3ZCLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUN2QyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDcEMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUN2QixJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM5QixJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUMxQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxvQkFBYyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDcEUsSUFBSSxnQkFBVSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFFaEY7aUJBQU07Z0JBQ0wsSUFBSSxNQUFNLEVBQUU7b0JBQ1YsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ3JDLElBQUksQ0FBQyxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQzt3QkFDbkUsT0FBTyxJQUFJLGVBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztxQkFDaEU7eUJBQU07d0JBQ0wsT0FBTyxJQUFJLHNCQUFnQixDQUN2QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztxQkFDdkU7aUJBQ0Y7cUJBQU07b0JBQ0wsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ3JDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFOzRCQUNyQixJQUFJLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7NEJBQ2xELE9BQU8sSUFBSSxlQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7eUJBQ2hFO3dCQUVELElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO3dCQUN0QyxPQUFPLElBQUksbUJBQWEsQ0FDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO3FCQUM5RTt5QkFBTTt3QkFDTCxPQUFPLElBQUksa0JBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztxQkFDM0Y7aUJBQ0Y7YUFDRjtRQUNILENBQUM7UUFFRCxzQ0FBa0IsR0FBbEI7WUFDRSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7Z0JBQUUsT0FBTyxFQUFFLENBQUM7WUFDcEQsSUFBTSxXQUFXLEdBQVUsRUFBRSxDQUFDO1lBQzlCLEdBQUc7Z0JBQ0QsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQzthQUNwQyxRQUFRLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDdEQsT0FBTyxXQUE0QixDQUFDO1FBQ3RDLENBQUM7UUFFRDs7O1dBR0c7UUFDSCw0Q0FBd0IsR0FBeEI7WUFDRSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7WUFDaEIsSUFBSSxhQUFhLEdBQUcsS0FBSyxDQUFDO1lBQzFCLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztZQUN6QyxHQUFHO2dCQUNELE1BQU0sSUFBSSxJQUFJLENBQUMsaUNBQWlDLEVBQUUsQ0FBQztnQkFDbkQsYUFBYSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbEQsSUFBSSxhQUFhLEVBQUU7b0JBQ2pCLE1BQU0sSUFBSSxHQUFHLENBQUM7aUJBQ2Y7YUFDRixRQUFRLGFBQWEsRUFBRTtZQUN4QixPQUFPO2dCQUNMLE1BQU0sRUFBRSxNQUFNO2dCQUNkLElBQUksRUFBRSxJQUFJLHdCQUFrQixDQUFDLEtBQUssRUFBRSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQzthQUMzRCxDQUFDO1FBQ0osQ0FBQztRQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztXQW9CRztRQUNILHlDQUFxQixHQUFyQixVQUFzQixXQUFzQztZQUMxRCxJQUFNLFFBQVEsR0FBc0IsRUFBRSxDQUFDO1lBRXZDLG1EQUFtRDtZQUNuRCw2REFBNkQ7WUFDN0QsOERBQThEO1lBQzlELFFBQVEsQ0FBQyxJQUFJLE9BQWIsUUFBUSxtQkFBUyxJQUFJLENBQUMsNkJBQTZCLENBQUMsV0FBVyxDQUFDLEdBQUU7WUFFbEUsT0FBTyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUN0QyxrRUFBa0U7Z0JBQ2xFLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDMUMsSUFBSSxVQUFVLEVBQUU7b0JBQ2QsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztpQkFDM0I7cUJBQU07b0JBQ0wsc0RBQXNEO29CQUN0RCxxRUFBcUU7b0JBQ3JFLHVFQUF1RTtvQkFDdkUsaUJBQWlCO29CQUNqQixJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztvQkFDNUMsbUVBQW1FO29CQUNuRSxlQUFlO29CQUNmLElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3pDLElBQUksT0FBTyxFQUFFO3dCQUNYLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7cUJBQ3hCO3lCQUFNO3dCQUNMLHNFQUFzRTt3QkFDdEUsb0VBQW9FO3dCQUNwRSxHQUFHLENBQUMsTUFBTTs0QkFDTixXQUFXLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUN0RixRQUFRLENBQUMsSUFBSSxPQUFiLFFBQVEsbUJBQVMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEdBQUcsQ0FBQyxHQUFFO3FCQUMzRDtpQkFDRjtnQkFDRCxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQzthQUNuQztZQUVELE9BQU8sSUFBSSwwQkFBMEIsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEYsQ0FBQztRQUVEOzs7Ozs7Ozs7Ozs7OztXQWNHO1FBQ0ssaURBQTZCLEdBQXJDLFVBQXNDLEdBQThCO1lBQ2xFLElBQU0sUUFBUSxHQUFzQixFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFFLDJCQUEyQjtZQUN6RSxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUM3QyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUM7WUFDekMsaUVBQWlFO1lBQ2pFLHNFQUFzRTtZQUN0RSwwRUFBMEU7WUFDMUUsNEVBQTRFO1lBQzVFLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDM0MsSUFBSSxDQUFDLFNBQVMsRUFBRTtnQkFDZCxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztnQkFDbEMsT0FBTyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQzthQUN0QztZQUNELElBQU0sVUFBVSxHQUFHLElBQUksd0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDbkUsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLHVCQUFpQixDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUM3RCxJQUFJLFNBQVMsRUFBRTtnQkFDYixRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQzFCO1lBQ0QsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUVEOzs7Ozs7Ozs7V0FTRztRQUNLLDJDQUF1QixHQUEvQjtZQUNFLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxXQUFHLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRTtnQkFDdEUsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFFLCtCQUErQjtZQUN4RCxJQUFBLEtBQWUsR0FBRyxDQUFDLElBQUksRUFBdEIsS0FBSyxXQUFBLEVBQUUsR0FBRyxTQUFZLENBQUM7WUFDOUIsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQy9DLE9BQU8sSUFBSSxtQkFBYSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEcsQ0FBQztRQUVEOzs7Ozs7Ozs7OztXQVdHO1FBQ0ssa0NBQWMsR0FBdEIsVUFBdUIsS0FBZ0M7WUFDckQsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRTtnQkFDekIsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFFLDJCQUEyQjtZQUM1QyxJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztZQUNsQyxJQUFNLFVBQVUsR0FBRyxJQUFJLHdCQUFrQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1lBQ3hGLE9BQU8sSUFBSSxxQkFBZSxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckQsQ0FBQztRQUVEOzs7Ozs7OztXQVFHO1FBQ0ssbUNBQWUsR0FBdkI7WUFDRSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFO2dCQUMxQixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDO1lBQzdDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFFLDRCQUE0QjtZQUM3QyxJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztZQUM1QyxJQUFJLEtBQUssR0FBbUMsSUFBSSxDQUFDO1lBQ2pELElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUNyQyxLQUFLLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7YUFDekM7WUFDRCxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztZQUNsQyxJQUFNLFVBQVUsR0FBRyxJQUFJLHdCQUFrQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUNqRixPQUFPLElBQUkscUJBQWUsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFFRDs7V0FFRztRQUNLLDhDQUEwQixHQUFsQztZQUNFLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqRyxDQUFDO1FBRUQ7OztXQUdHO1FBQ0gseUJBQUssR0FBTCxVQUFNLE9BQWUsRUFBRSxLQUF5QjtZQUF6QixzQkFBQSxFQUFBLFlBQXlCO1lBQzlDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksaUJBQVcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ2hHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNkLENBQUM7UUFFTyxnQ0FBWSxHQUFwQixVQUFxQixLQUF5QjtZQUF6QixzQkFBQSxFQUFBLFlBQXlCO1lBQzVDLElBQUksS0FBSyxJQUFJLElBQUk7Z0JBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDdEMsT0FBTyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxnQkFBYSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLFNBQUssQ0FBQyxDQUFDO2dCQUNoRCw4QkFBOEIsQ0FBQztRQUN2RSxDQUFDO1FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1dBdUJHO1FBQ0ssd0JBQUksR0FBWjtZQUNFLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDbEIsT0FBTyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDO2dCQUNuRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNsRixDQUFDLElBQUksQ0FBQyxlQUFlLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzVELENBQUMsSUFBSSxDQUFDLGlCQUFpQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNoRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO2dCQUMzRSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUU7b0JBQ3ZCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNaLElBQUksaUJBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2lCQUM3RjtnQkFDRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2YsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7YUFDZjtRQUNILENBQUM7UUFDSCxnQkFBQztJQUFELENBQUMsQUEzeEJELElBMnhCQztJQTN4QlksOEJBQVM7SUE2eEJ0QjtRQUFBO1lBQ0UsV0FBTSxHQUFhLEVBQUUsQ0FBQztRQXVEeEIsQ0FBQztRQXJEQyx1REFBcUIsR0FBckIsVUFBc0IsR0FBcUIsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUU3RCxtREFBaUIsR0FBakIsVUFBa0IsR0FBaUIsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUVyRCxvREFBa0IsR0FBbEIsVUFBbUIsR0FBa0IsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUV2RCx1REFBcUIsR0FBckIsVUFBc0IsR0FBcUIsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUU3RCxtREFBaUIsR0FBakIsVUFBa0IsR0FBaUIsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUVyRCxvREFBa0IsR0FBbEIsVUFBbUIsR0FBa0IsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUV2RCx1REFBcUIsR0FBckIsVUFBc0IsR0FBcUIsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUU3RCxpREFBZSxHQUFmLFVBQWdCLEdBQWUsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUVqRCxxREFBbUIsR0FBbkIsVUFBb0IsR0FBbUIsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUV6RCxtREFBaUIsR0FBakIsVUFBa0IsR0FBaUIsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUVyRCxtREFBaUIsR0FBakIsVUFBa0IsR0FBaUIsRUFBRSxPQUFZO1lBQy9DLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBRUQsaURBQWUsR0FBZixVQUFnQixHQUFlLEVBQUUsT0FBWTtZQUMzQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDckMsQ0FBQztRQUVELDRDQUFVLEdBQVYsVUFBVyxHQUFVLEVBQUUsT0FBWSxJQUFHLENBQUM7UUFFdkMsNkNBQVcsR0FBWCxVQUFZLEdBQVcsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUV6QyxnREFBYyxHQUFkLFVBQWUsR0FBYyxFQUFFLE9BQVksSUFBRyxDQUFDO1FBRS9DLG9EQUFrQixHQUFsQixVQUFtQixHQUFrQixFQUFFLE9BQVksSUFBRyxDQUFDO1FBRXZELGtEQUFnQixHQUFoQixVQUFpQixHQUFnQixFQUFFLE9BQVksSUFBRyxDQUFDO1FBRW5ELDJDQUFTLEdBQVQsVUFBVSxHQUFnQixFQUFFLE9BQVk7WUFDdEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUVELGdEQUFjLEdBQWQsVUFBZSxHQUFjLEVBQUUsT0FBWSxJQUFHLENBQUM7UUFFL0MsaURBQWUsR0FBZixVQUFnQixHQUFlLEVBQUUsT0FBWSxJQUFHLENBQUM7UUFFakQsMENBQVEsR0FBUixVQUFTLElBQVcsRUFBRSxPQUFZO1lBQWxDLGlCQUVDO1lBREMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLEVBQUUsT0FBTyxDQUFDLEVBQXpCLENBQXlCLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBRUQsNENBQVUsR0FBVixVQUFXLEdBQVUsRUFBRSxPQUFZLElBQUcsQ0FBQztRQUV2Qyw0Q0FBVSxHQUFWLFVBQVcsR0FBVSxFQUFFLE9BQVksSUFBRyxDQUFDO1FBQ3pDLDhCQUFDO0lBQUQsQ0FBQyxBQXhERCxJQXdEQztJQUVEOzs7Ozs7T0FNRztJQUNIO1FBQXlDLHNEQUFtQjtRQUE1RDtZQUFBLHFFQU1DO1lBTEMsWUFBTSxHQUFhLEVBQUUsQ0FBQzs7UUFLeEIsQ0FBQztRQUhDLDhDQUFTLEdBQVQ7WUFDRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM1QixDQUFDO1FBQ0gsaUNBQUM7SUFBRCxDQUFDLEFBTkQsQ0FBeUMseUJBQW1CLEdBTTNEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoYXJzIGZyb20gJy4uL2NoYXJzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgSW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcblxuaW1wb3J0IHtBYnNvbHV0ZVNvdXJjZVNwYW4sIEFTVCwgQXN0VmlzaXRvciwgQVNUV2l0aFNvdXJjZSwgQmluYXJ5LCBCaW5kaW5nUGlwZSwgQ2hhaW4sIENvbmRpdGlvbmFsLCBFbXB0eUV4cHIsIEV4cHJlc3Npb25CaW5kaW5nLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIEtleWVkUmVhZCwgS2V5ZWRXcml0ZSwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsTWFwS2V5LCBMaXRlcmFsUHJpbWl0aXZlLCBNZXRob2RDYWxsLCBOb25OdWxsQXNzZXJ0LCBQYXJzZXJFcnJvciwgUGFyc2VTcGFuLCBQcmVmaXhOb3QsIFByb3BlcnR5UmVhZCwgUHJvcGVydHlXcml0ZSwgUXVvdGUsIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsIFNhZmVNZXRob2RDYWxsLCBTYWZlUHJvcGVydHlSZWFkLCBUZW1wbGF0ZUJpbmRpbmcsIFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIsIFRoaXNSZWNlaXZlciwgVW5hcnksIFZhcmlhYmxlQmluZGluZ30gZnJvbSAnLi9hc3QnO1xuaW1wb3J0IHtFT0YsIGlzSWRlbnRpZmllciwgaXNRdW90ZSwgTGV4ZXIsIFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4vbGV4ZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIEludGVycG9sYXRpb25QaWVjZSB7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG59XG5leHBvcnQgY2xhc3MgU3BsaXRJbnRlcnBvbGF0aW9uIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgc3RyaW5nczogSW50ZXJwb2xhdGlvblBpZWNlW10sIHB1YmxpYyBleHByZXNzaW9uczogSW50ZXJwb2xhdGlvblBpZWNlW10sXG4gICAgICBwdWJsaWMgb2Zmc2V0czogbnVtYmVyW10pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHRlbXBsYXRlQmluZGluZ3M6IFRlbXBsYXRlQmluZGluZ1tdLCBwdWJsaWMgd2FybmluZ3M6IHN0cmluZ1tdLFxuICAgICAgcHVibGljIGVycm9yczogUGFyc2VyRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIHByaXZhdGUgZXJyb3JzOiBQYXJzZXJFcnJvcltdID0gW107XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfbGV4ZXI6IExleGVyKSB7fVxuXG4gIHNpbXBsZUV4cHJlc3Npb25DaGVja2VyID0gU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXI7XG5cbiAgcGFyc2VBY3Rpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICB0aGlzLl9jaGVja05vSW50ZXJwb2xhdGlvbihpbnB1dCwgbG9jYXRpb24sIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCk7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUodGhpcy5fc3RyaXBDb21tZW50cyhpbnB1dCkpO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCB0cnVlLCB0aGlzLmVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICAucGFyc2VDaGFpbigpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHBhcnNlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrU2ltcGxlRXhwcmVzc2lvbihhc3Q6IEFTVCk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBjaGVja2VyID0gbmV3IHRoaXMuc2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIoKTtcbiAgICBhc3QudmlzaXQoY2hlY2tlcik7XG4gICAgcmV0dXJuIGNoZWNrZXIuZXJyb3JzO1xuICB9XG5cbiAgcGFyc2VTaW1wbGVCaW5kaW5nKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2VCaW5kaW5nQXN0KGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIGludGVycG9sYXRpb25Db25maWcpO1xuICAgIGNvbnN0IGVycm9ycyA9IHRoaXMuY2hlY2tTaW1wbGVFeHByZXNzaW9uKGFzdCk7XG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgSG9zdCBiaW5kaW5nIGV4cHJlc3Npb24gY2Fubm90IGNvbnRhaW4gJHtlcnJvcnMuam9pbignICcpfWAsIGlucHV0LCBsb2NhdGlvbik7XG4gICAgfVxuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcG9ydEVycm9yKG1lc3NhZ2U6IHN0cmluZywgaW5wdXQ6IHN0cmluZywgZXJyTG9jYXRpb246IHN0cmluZywgY3R4TG9jYXRpb24/OiBzdHJpbmcpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihtZXNzYWdlLCBpbnB1dCwgZXJyTG9jYXRpb24sIGN0eExvY2F0aW9uKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUJpbmRpbmdBc3QoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyk6IEFTVCB7XG4gICAgLy8gUXVvdGVzIGV4cHJlc3Npb25zIHVzZSAzcmQtcGFydHkgZXhwcmVzc2lvbiBsYW5ndWFnZS4gV2UgZG9uJ3Qgd2FudCB0byB1c2VcbiAgICAvLyBvdXIgbGV4ZXIgb3IgcGFyc2VyIGZvciB0aGF0LCBzbyB3ZSBjaGVjayBmb3IgdGhhdCBhaGVhZCBvZiB0aW1lLlxuICAgIGNvbnN0IHF1b3RlID0gdGhpcy5fcGFyc2VRdW90ZShpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0KTtcblxuICAgIGlmIChxdW90ZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gcXVvdGU7XG4gICAgfVxuXG4gICAgdGhpcy5fY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHNvdXJjZVRvTGV4KTtcbiAgICByZXR1cm4gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSwgdGhpcy5lcnJvcnMsXG4gICAgICAgICAgICAgICBpbnB1dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpXG4gICAgICAgIC5wYXJzZUNoYWluKCk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVF1b3RlKGlucHV0OiBzdHJpbmd8bnVsbCwgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6IEFTVHxudWxsIHtcbiAgICBpZiAoaW5wdXQgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4U2VwYXJhdG9ySW5kZXggPSBpbnB1dC5pbmRleE9mKCc6Jyk7XG4gICAgaWYgKHByZWZpeFNlcGFyYXRvckluZGV4ID09IC0xKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBwcmVmaXggPSBpbnB1dC5zdWJzdHJpbmcoMCwgcHJlZml4U2VwYXJhdG9ySW5kZXgpLnRyaW0oKTtcbiAgICBpZiAoIWlzSWRlbnRpZmllcihwcmVmaXgpKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCB1bmludGVycHJldGVkRXhwcmVzc2lvbiA9IGlucHV0LnN1YnN0cmluZyhwcmVmaXhTZXBhcmF0b3JJbmRleCArIDEpO1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0Lmxlbmd0aCk7XG4gICAgcmV0dXJuIG5ldyBRdW90ZShcbiAgICAgICAgc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgcHJlZml4LCB1bmludGVycHJldGVkRXhwcmVzc2lvbiwgbG9jYXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIG1pY3Jvc3ludGF4IHRlbXBsYXRlIGV4cHJlc3Npb24gYW5kIHJldHVybiBhIGxpc3Qgb2YgYmluZGluZ3Mgb3JcbiAgICogcGFyc2luZyBlcnJvcnMgaW4gY2FzZSB0aGUgZ2l2ZW4gZXhwcmVzc2lvbiBpcyBpbnZhbGlkLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgPGRpdiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiPlxuICAgKiAgICAgICAgIF4gICAgICBeIGFic29sdXRlVmFsdWVPZmZzZXQgZm9yIGB0ZW1wbGF0ZVZhbHVlYFxuICAgKiAgICAgICAgIGFic29sdXRlS2V5T2Zmc2V0IGZvciBgdGVtcGxhdGVLZXlgXG4gICAqIGBgYFxuICAgKiBjb250YWlucyB0aHJlZSBiaW5kaW5nczpcbiAgICogMS4gbmdGb3IgLT4gbnVsbFxuICAgKiAyLiBpdGVtIC0+IE5nRm9yT2ZDb250ZXh0LiRpbXBsaWNpdFxuICAgKiAzLiBuZ0Zvck9mIC0+IGl0ZW1zXG4gICAqXG4gICAqIFRoaXMgaXMgYXBwYXJlbnQgZnJvbSB0aGUgZGUtc3VnYXJlZCB0ZW1wbGF0ZTpcbiAgICogYGBgXG4gICAqICAgPG5nLXRlbXBsYXRlIG5nRm9yIGxldC1pdGVtIFtuZ0Zvck9mXT1cIml0ZW1zXCI+XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGVLZXkgbmFtZSBvZiBkaXJlY3RpdmUsIHdpdGhvdXQgdGhlICogcHJlZml4LiBGb3IgZXhhbXBsZTogbmdJZiwgbmdGb3JcbiAgICogQHBhcmFtIHRlbXBsYXRlVmFsdWUgUkhTIG9mIHRoZSBtaWNyb3N5bnRheCBhdHRyaWJ1dGVcbiAgICogQHBhcmFtIHRlbXBsYXRlVXJsIHRlbXBsYXRlIGZpbGVuYW1lIGlmIGl0J3MgZXh0ZXJuYWwsIGNvbXBvbmVudCBmaWxlbmFtZSBpZiBpdCdzIGlubGluZVxuICAgKiBAcGFyYW0gYWJzb2x1dGVLZXlPZmZzZXQgc3RhcnQgb2YgdGhlIGB0ZW1wbGF0ZUtleWBcbiAgICogQHBhcmFtIGFic29sdXRlVmFsdWVPZmZzZXQgc3RhcnQgb2YgdGhlIGB0ZW1wbGF0ZVZhbHVlYFxuICAgKi9cbiAgcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKFxuICAgICAgdGVtcGxhdGVLZXk6IHN0cmluZywgdGVtcGxhdGVWYWx1ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBhYnNvbHV0ZUtleU9mZnNldDogbnVtYmVyLFxuICAgICAgYWJzb2x1dGVWYWx1ZU9mZnNldDogbnVtYmVyKTogVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHRlbXBsYXRlVmFsdWUpO1xuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgIHRlbXBsYXRlVmFsdWUsIHRlbXBsYXRlVXJsLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0LCB0b2tlbnMsIHRlbXBsYXRlVmFsdWUubGVuZ3RoLFxuICAgICAgICBmYWxzZSAvKiBwYXJzZUFjdGlvbiAqLywgdGhpcy5lcnJvcnMsIDAgLyogcmVsYXRpdmUgb2Zmc2V0ICovKTtcbiAgICByZXR1cm4gcGFyc2VyLnBhcnNlVGVtcGxhdGVCaW5kaW5ncyh7XG4gICAgICBzb3VyY2U6IHRlbXBsYXRlS2V5LFxuICAgICAgc3BhbjogbmV3IEFic29sdXRlU291cmNlU3BhbihhYnNvbHV0ZUtleU9mZnNldCwgYWJzb2x1dGVLZXlPZmZzZXQgKyB0ZW1wbGF0ZUtleS5sZW5ndGgpLFxuICAgIH0pO1xuICB9XG5cbiAgcGFyc2VJbnRlcnBvbGF0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZXxudWxsIHtcbiAgICBjb25zdCB7c3RyaW5ncywgZXhwcmVzc2lvbnMsIG9mZnNldHN9ID1cbiAgICAgICAgdGhpcy5zcGxpdEludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGV4cHJlc3Npb25Ob2RlczogQVNUW10gPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwcmVzc2lvbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGV4cHJlc3Npb25UZXh0ID0gZXhwcmVzc2lvbnNbaV0udGV4dDtcbiAgICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uVGV4dCk7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICAgIGlucHV0LCBsb2NhdGlvbiwgYWJzb2x1dGVPZmZzZXQsIHRva2Vucywgc291cmNlVG9MZXgubGVuZ3RoLCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9ycywgb2Zmc2V0c1tpXSArIChleHByZXNzaW9uVGV4dC5sZW5ndGggLSBzb3VyY2VUb0xleC5sZW5ndGgpKVxuICAgICAgICAgICAgICAgICAgICAgIC5wYXJzZUNoYWluKCk7XG4gICAgICBleHByZXNzaW9uTm9kZXMucHVzaChhc3QpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUludGVycG9sYXRpb25Bc3QoXG4gICAgICAgIHN0cmluZ3MubWFwKHMgPT4gcy50ZXh0KSwgZXhwcmVzc2lvbk5vZGVzLCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTaW1pbGFyIHRvIGBwYXJzZUludGVycG9sYXRpb25gLCBidXQgdHJlYXRzIHRoZSBwcm92aWRlZCBzdHJpbmcgYXMgYSBzaW5nbGUgZXhwcmVzc2lvblxuICAgKiBlbGVtZW50IHRoYXQgd291bGQgbm9ybWFsbHkgYXBwZWFyIHdpdGhpbiB0aGUgaW50ZXJwb2xhdGlvbiBwcmVmaXggYW5kIHN1ZmZpeCAoYHt7YCBhbmQgYH19YCkuXG4gICAqIFRoaXMgaXMgdXNlZCBmb3IgcGFyc2luZyB0aGUgc3dpdGNoIGV4cHJlc3Npb24gaW4gSUNVcy5cbiAgICovXG4gIHBhcnNlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oZXhwcmVzc2lvbjogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTpcbiAgICAgIEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNvdXJjZVRvTGV4ID0gdGhpcy5fc3RyaXBDb21tZW50cyhleHByZXNzaW9uKTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgY29uc3QgYXN0ID0gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbiwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgLyogcGFyc2VBY3Rpb24gKi8gZmFsc2UsIHRoaXMuZXJyb3JzLCAwKVxuICAgICAgICAgICAgICAgICAgICAucGFyc2VDaGFpbigpO1xuICAgIGNvbnN0IHN0cmluZ3MgPSBbJycsICcnXTsgIC8vIFRoZSBwcmVmaXggYW5kIHN1ZmZpeCBzdHJpbmdzIGFyZSBib3RoIGVtcHR5XG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlSW50ZXJwb2xhdGlvbkFzdChzdHJpbmdzLCBbYXN0XSwgZXhwcmVzc2lvbiwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlSW50ZXJwb2xhdGlvbkFzdChcbiAgICAgIHN0cmluZ3M6IHN0cmluZ1tdLCBleHByZXNzaW9uczogQVNUW10sIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsXG4gICAgICBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNwYW4oMCwgaW5wdXQubGVuZ3RoKTtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uID1cbiAgICAgICAgbmV3IEludGVycG9sYXRpb24oc3Bhbiwgc3Bhbi50b0Fic29sdXRlKGFic29sdXRlT2Zmc2V0KSwgc3RyaW5ncywgZXhwcmVzc2lvbnMpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShpbnRlcnBvbGF0aW9uLCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICAvKipcbiAgICogU3BsaXRzIGEgc3RyaW5nIG9mIHRleHQgaW50byBcInJhd1wiIHRleHQgc2VnbWVudHMgYW5kIGV4cHJlc3Npb25zIHByZXNlbnQgaW4gaW50ZXJwb2xhdGlvbnMgaW5cbiAgICogdGhlIHN0cmluZy5cbiAgICogUmV0dXJucyBgbnVsbGAgaWYgdGhlcmUgYXJlIG5vIGludGVycG9sYXRpb25zLCBvdGhlcndpc2UgYVxuICAgKiBgU3BsaXRJbnRlcnBvbGF0aW9uYCB3aXRoIHNwbGl0cyB0aGF0IGxvb2sgbGlrZVxuICAgKiAgIDxyYXcgdGV4dD4gPGV4cHJlc3Npb24+IDxyYXcgdGV4dD4gLi4uIDxyYXcgdGV4dD4gPGV4cHJlc3Npb24+IDxyYXcgdGV4dD5cbiAgICovXG4gIHNwbGl0SW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IFNwbGl0SW50ZXJwb2xhdGlvbiB7XG4gICAgY29uc3Qgc3RyaW5nczogSW50ZXJwb2xhdGlvblBpZWNlW10gPSBbXTtcbiAgICBjb25zdCBleHByZXNzaW9uczogSW50ZXJwb2xhdGlvblBpZWNlW10gPSBbXTtcbiAgICBjb25zdCBvZmZzZXRzOiBudW1iZXJbXSA9IFtdO1xuICAgIGxldCBpID0gMDtcbiAgICBsZXQgYXRJbnRlcnBvbGF0aW9uID0gZmFsc2U7XG4gICAgbGV0IGV4dGVuZExhc3RTdHJpbmcgPSBmYWxzZTtcbiAgICBsZXQge3N0YXJ0OiBpbnRlcnBTdGFydCwgZW5kOiBpbnRlcnBFbmR9ID0gaW50ZXJwb2xhdGlvbkNvbmZpZztcbiAgICB3aGlsZSAoaSA8IGlucHV0Lmxlbmd0aCkge1xuICAgICAgaWYgKCFhdEludGVycG9sYXRpb24pIHtcbiAgICAgICAgLy8gcGFyc2UgdW50aWwgc3RhcnRpbmcge3tcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBpO1xuICAgICAgICBpID0gaW5wdXQuaW5kZXhPZihpbnRlcnBTdGFydCwgaSk7XG4gICAgICAgIGlmIChpID09PSAtMSkge1xuICAgICAgICAgIGkgPSBpbnB1dC5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGV4dCA9IGlucHV0LnN1YnN0cmluZyhzdGFydCwgaSk7XG4gICAgICAgIHN0cmluZ3MucHVzaCh7dGV4dCwgc3RhcnQsIGVuZDogaX0pO1xuXG4gICAgICAgIGF0SW50ZXJwb2xhdGlvbiA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBwYXJzZSBmcm9tIHN0YXJ0aW5nIHt7IHRvIGVuZGluZyB9fSB3aGlsZSBpZ25vcmluZyBjb250ZW50IGluc2lkZSBxdW90ZXMuXG4gICAgICAgIGNvbnN0IGZ1bGxTdGFydCA9IGk7XG4gICAgICAgIGNvbnN0IGV4cHJTdGFydCA9IGZ1bGxTdGFydCArIGludGVycFN0YXJ0Lmxlbmd0aDtcbiAgICAgICAgY29uc3QgZXhwckVuZCA9IHRoaXMuX2dldEludGVycG9sYXRpb25FbmRJbmRleChpbnB1dCwgaW50ZXJwRW5kLCBleHByU3RhcnQpO1xuICAgICAgICBpZiAoZXhwckVuZCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyBDb3VsZCBub3QgZmluZCB0aGUgZW5kIG9mIHRoZSBpbnRlcnBvbGF0aW9uOyBkbyBub3QgcGFyc2UgYW4gZXhwcmVzc2lvbi5cbiAgICAgICAgICAvLyBJbnN0ZWFkIHdlIHNob3VsZCBleHRlbmQgdGhlIGNvbnRlbnQgb24gdGhlIGxhc3QgcmF3IHN0cmluZy5cbiAgICAgICAgICBhdEludGVycG9sYXRpb24gPSBmYWxzZTtcbiAgICAgICAgICBleHRlbmRMYXN0U3RyaW5nID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdWxsRW5kID0gZXhwckVuZCArIGludGVycEVuZC5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgdGV4dCA9IGlucHV0LnN1YnN0cmluZyhleHByU3RhcnQsIGV4cHJFbmQpO1xuICAgICAgICBpZiAodGV4dC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGV4cHJlc3Npb25zLnB1c2goe3RleHQsIHN0YXJ0OiBmdWxsU3RhcnQsIGVuZDogZnVsbEVuZH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAnQmxhbmsgZXhwcmVzc2lvbnMgYXJlIG5vdCBhbGxvd2VkIGluIGludGVycG9sYXRlZCBzdHJpbmdzJywgaW5wdXQsXG4gICAgICAgICAgICAgIGBhdCBjb2x1bW4gJHtpfSBpbmAsIGxvY2F0aW9uKTtcbiAgICAgICAgICBleHByZXNzaW9ucy5wdXNoKHt0ZXh0OiAnJGltcGxpY2l0Jywgc3RhcnQ6IGZ1bGxTdGFydCwgZW5kOiBmdWxsRW5kfSk7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0cy5wdXNoKGV4cHJTdGFydCk7XG5cbiAgICAgICAgaSA9IGZ1bGxFbmQ7XG4gICAgICAgIGF0SW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgLy8gSWYgd2UgYXJlIG5vdyBhdCBhIHRleHQgc2VjdGlvbiwgYWRkIHRoZSByZW1haW5pbmcgY29udGVudCBhcyBhIHJhdyBzdHJpbmcuXG4gICAgICBpZiAoZXh0ZW5kTGFzdFN0cmluZykge1xuICAgICAgICBjb25zdCBwaWVjZSA9IHN0cmluZ3Nbc3RyaW5ncy5sZW5ndGggLSAxXTtcbiAgICAgICAgcGllY2UudGV4dCArPSBpbnB1dC5zdWJzdHJpbmcoaSk7XG4gICAgICAgIHBpZWNlLmVuZCA9IGlucHV0Lmxlbmd0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0cmluZ3MucHVzaCh7dGV4dDogaW5wdXQuc3Vic3RyaW5nKGkpLCBzdGFydDogaSwgZW5kOiBpbnB1dC5sZW5ndGh9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTcGxpdEludGVycG9sYXRpb24oc3RyaW5ncywgZXhwcmVzc2lvbnMsIG9mZnNldHMpO1xuICB9XG5cbiAgd3JhcExpdGVyYWxQcmltaXRpdmUoaW5wdXQ6IHN0cmluZ3xudWxsLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTpcbiAgICAgIEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0ID09IG51bGwgPyAwIDogaW5wdXQubGVuZ3RoKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoXG4gICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIGlucHV0KSwgaW5wdXQsIGxvY2F0aW9uLFxuICAgICAgICBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3RyaXBDb21tZW50cyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBpID0gdGhpcy5fY29tbWVudFN0YXJ0KGlucHV0KTtcbiAgICByZXR1cm4gaSAhPSBudWxsID8gaW5wdXQuc3Vic3RyaW5nKDAsIGkpLnRyaW0oKSA6IGlucHV0O1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tbWVudFN0YXJ0KGlucHV0OiBzdHJpbmcpOiBudW1iZXJ8bnVsbCB7XG4gICAgbGV0IG91dGVyUXVvdGU6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgY29uc3QgY2hhciA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG4gICAgICBjb25zdCBuZXh0Q2hhciA9IGlucHV0LmNoYXJDb2RlQXQoaSArIDEpO1xuXG4gICAgICBpZiAoY2hhciA9PT0gY2hhcnMuJFNMQVNIICYmIG5leHRDaGFyID09IGNoYXJzLiRTTEFTSCAmJiBvdXRlclF1b3RlID09IG51bGwpIHJldHVybiBpO1xuXG4gICAgICBpZiAob3V0ZXJRdW90ZSA9PT0gY2hhcikge1xuICAgICAgICBvdXRlclF1b3RlID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAob3V0ZXJRdW90ZSA9PSBudWxsICYmIGlzUXVvdGUoY2hhcikpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IGNoYXI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywge3N0YXJ0LCBlbmR9OiBJbnRlcnBvbGF0aW9uQ29uZmlnKTpcbiAgICAgIHZvaWQge1xuICAgIGxldCBzdGFydEluZGV4ID0gLTE7XG4gICAgbGV0IGVuZEluZGV4ID0gLTE7XG5cbiAgICBmb3IgKGNvbnN0IGNoYXJJbmRleCBvZiB0aGlzLl9mb3JFYWNoVW5xdW90ZWRDaGFyKGlucHV0LCAwKSkge1xuICAgICAgaWYgKHN0YXJ0SW5kZXggPT09IC0xKSB7XG4gICAgICAgIGlmIChpbnB1dC5zdGFydHNXaXRoKHN0YXJ0KSkge1xuICAgICAgICAgIHN0YXJ0SW5kZXggPSBjaGFySW5kZXg7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVuZEluZGV4ID0gdGhpcy5fZ2V0SW50ZXJwb2xhdGlvbkVuZEluZGV4KGlucHV0LCBlbmQsIGNoYXJJbmRleCk7XG4gICAgICAgIGlmIChlbmRJbmRleCA+IC0xKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3RhcnRJbmRleCA+IC0xICYmIGVuZEluZGV4ID4gLTEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtzdGFydH0ke2VuZH0pIHdoZXJlIGV4cHJlc3Npb24gd2FzIGV4cGVjdGVkYCwgaW5wdXQsXG4gICAgICAgICAgYGF0IGNvbHVtbiAke3N0YXJ0SW5kZXh9IGluYCwgbG9jYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgaW5kZXggb2YgdGhlIGVuZCBvZiBhbiBpbnRlcnBvbGF0aW9uIGV4cHJlc3Npb25cbiAgICogd2hpbGUgaWdub3JpbmcgY29tbWVudHMgYW5kIHF1b3RlZCBjb250ZW50LlxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0SW50ZXJwb2xhdGlvbkVuZEluZGV4KGlucHV0OiBzdHJpbmcsIGV4cHJlc3Npb25FbmQ6IHN0cmluZywgc3RhcnQ6IG51bWJlcik6IG51bWJlciB7XG4gICAgZm9yIChjb25zdCBjaGFySW5kZXggb2YgdGhpcy5fZm9yRWFjaFVucXVvdGVkQ2hhcihpbnB1dCwgc3RhcnQpKSB7XG4gICAgICBpZiAoaW5wdXQuc3RhcnRzV2l0aChleHByZXNzaW9uRW5kLCBjaGFySW5kZXgpKSB7XG4gICAgICAgIHJldHVybiBjaGFySW5kZXg7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGhpbmcgZWxzZSBpbiB0aGUgZXhwcmVzc2lvbiBtYXR0ZXJzIGFmdGVyIHdlJ3ZlXG4gICAgICAvLyBoaXQgYSBjb21tZW50IHNvIGxvb2sgZGlyZWN0bHkgZm9yIHRoZSBlbmQgdG9rZW4uXG4gICAgICBpZiAoaW5wdXQuc3RhcnRzV2l0aCgnLy8nLCBjaGFySW5kZXgpKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5pbmRleE9mKGV4cHJlc3Npb25FbmQsIGNoYXJJbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRvciB1c2VkIHRvIGl0ZXJhdGUgb3ZlciB0aGUgY2hhcmFjdGVyIGluZGV4ZXMgb2YgYSBzdHJpbmcgdGhhdCBhcmUgb3V0c2lkZSBvZiBxdW90ZXMuXG4gICAqIEBwYXJhbSBpbnB1dCBTdHJpbmcgdG8gbG9vcCB0aHJvdWdoLlxuICAgKiBAcGFyYW0gc3RhcnQgSW5kZXggd2l0aGluIHRoZSBzdHJpbmcgYXQgd2hpY2ggdG8gc3RhcnQuXG4gICAqL1xuICBwcml2YXRlICogX2ZvckVhY2hVbnF1b3RlZENoYXIoaW5wdXQ6IHN0cmluZywgc3RhcnQ6IG51bWJlcikge1xuICAgIGxldCBjdXJyZW50UXVvdGU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgZXNjYXBlQ291bnQgPSAwO1xuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjaGFyID0gaW5wdXRbaV07XG4gICAgICAvLyBTa2lwIHRoZSBjaGFyYWN0ZXJzIGluc2lkZSBxdW90ZXMuIE5vdGUgdGhhdCB3ZSBvbmx5IGNhcmUgYWJvdXQgdGhlIG91dGVyLW1vc3RcbiAgICAgIC8vIHF1b3RlcyBtYXRjaGluZyB1cCBhbmQgd2UgbmVlZCB0byBhY2NvdW50IGZvciBlc2NhcGUgY2hhcmFjdGVycy5cbiAgICAgIGlmIChpc1F1b3RlKGlucHV0LmNoYXJDb2RlQXQoaSkpICYmIChjdXJyZW50UXVvdGUgPT09IG51bGwgfHwgY3VycmVudFF1b3RlID09PSBjaGFyKSAmJlxuICAgICAgICAgIGVzY2FwZUNvdW50ICUgMiA9PT0gMCkge1xuICAgICAgICBjdXJyZW50UXVvdGUgPSBjdXJyZW50UXVvdGUgPT09IG51bGwgPyBjaGFyIDogbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoY3VycmVudFF1b3RlID09PSBudWxsKSB7XG4gICAgICAgIHlpZWxkIGk7XG4gICAgICB9XG4gICAgICBlc2NhcGVDb3VudCA9IGNoYXIgPT09ICdcXFxcJyA/IGVzY2FwZUNvdW50ICsgMSA6IDA7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJdnlQYXJzZXIgZXh0ZW5kcyBQYXJzZXIge1xuICBzaW1wbGVFeHByZXNzaW9uQ2hlY2tlciA9IEl2eVNpbXBsZUV4cHJlc3Npb25DaGVja2VyO1xufVxuXG4vKiogRGVzY3JpYmVzIGEgc3RhdGVmdWwgY29udGV4dCBhbiBleHByZXNzaW9uIHBhcnNlciBpcyBpbi4gKi9cbmVudW0gUGFyc2VDb250ZXh0RmxhZ3Mge1xuICBOb25lID0gMCxcbiAgLyoqXG4gICAqIEEgV3JpdGFibGUgY29udGV4dCBpcyBvbmUgaW4gd2hpY2ggYSB2YWx1ZSBtYXkgYmUgd3JpdHRlbiB0byBhbiBsdmFsdWUuXG4gICAqIEZvciBleGFtcGxlLCBhZnRlciB3ZSBzZWUgYSBwcm9wZXJ0eSBhY2Nlc3MsIHdlIG1heSBleHBlY3QgYSB3cml0ZSB0byB0aGVcbiAgICogcHJvcGVydHkgdmlhIHRoZSBcIj1cIiBvcGVyYXRvci5cbiAgICogICBwcm9wXG4gICAqICAgICAgICBeIHBvc3NpYmxlIFwiPVwiIGFmdGVyXG4gICAqL1xuICBXcml0YWJsZSA9IDEsXG59XG5cbmV4cG9ydCBjbGFzcyBfUGFyc2VBU1Qge1xuICBwcml2YXRlIHJwYXJlbnNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNrZXRzRXhwZWN0ZWQgPSAwO1xuICBwcml2YXRlIHJicmFjZXNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgY29udGV4dCA9IFBhcnNlQ29udGV4dEZsYWdzLk5vbmU7XG5cbiAgLy8gQ2FjaGUgb2YgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZWNlcyB0byB0aGUgYWJzb2x1dGUgc291cmNlIHNwYW4gdGhleSBtYXAgdG8sIHVzZWQgdG9cbiAgLy8gcHJldmVudCBjcmVhdGluZyBzdXBlcmZsdW91cyBzb3VyY2Ugc3BhbnMgaW4gYHNvdXJjZVNwYW5gLlxuICAvLyBBIHNlcmlhbCBvZiB0aGUgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZXggaXMgdXNlZCBmb3IgbWFwcGluZyBiZWNhdXNlIGJvdGggYXJlIHN0YXRlZnVsXG4gIC8vIGFuZCBtYXkgY2hhbmdlIGZvciBzdWJzZXF1ZW50IGV4cHJlc3Npb25zIHZpc2l0ZWQgYnkgdGhlIHBhcnNlci5cbiAgcHJpdmF0ZSBzb3VyY2VTcGFuQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQWJzb2x1dGVTb3VyY2VTcGFuPigpO1xuXG4gIGluZGV4OiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGlucHV0OiBzdHJpbmcsIHB1YmxpYyBsb2NhdGlvbjogc3RyaW5nLCBwdWJsaWMgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHB1YmxpYyB0b2tlbnM6IFRva2VuW10sIHB1YmxpYyBpbnB1dExlbmd0aDogbnVtYmVyLCBwdWJsaWMgcGFyc2VBY3Rpb246IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSwgcHJpdmF0ZSBvZmZzZXQ6IG51bWJlcikge31cblxuICBwZWVrKG9mZnNldDogbnVtYmVyKTogVG9rZW4ge1xuICAgIGNvbnN0IGkgPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHJldHVybiBpIDwgdGhpcy50b2tlbnMubGVuZ3RoID8gdGhpcy50b2tlbnNbaV0gOiBFT0Y7XG4gIH1cblxuICBnZXQgbmV4dCgpOiBUb2tlbiB7XG4gICAgcmV0dXJuIHRoaXMucGVlaygwKTtcbiAgfVxuXG4gIC8qKiBXaGV0aGVyIGFsbCB0aGUgcGFyc2VyIGlucHV0IGhhcyBiZWVuIHByb2Nlc3NlZC4gKi9cbiAgZ2V0IGF0RU9GKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmluZGV4ID49IHRoaXMudG9rZW5zLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmRleCBvZiB0aGUgbmV4dCB0b2tlbiB0byBiZSBwcm9jZXNzZWQsIG9yIHRoZSBlbmQgb2YgdGhlIGxhc3QgdG9rZW4gaWYgYWxsIGhhdmUgYmVlblxuICAgKiBwcm9jZXNzZWQuXG4gICAqL1xuICBnZXQgaW5wdXRJbmRleCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmF0RU9GID8gdGhpcy5jdXJyZW50RW5kSW5kZXggOiB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmQgaW5kZXggb2YgdGhlIGxhc3QgcHJvY2Vzc2VkIHRva2VuLCBvciB0aGUgc3RhcnQgb2YgdGhlIGZpcnN0IHRva2VuIGlmIG5vbmUgaGF2ZSBiZWVuXG4gICAqIHByb2Nlc3NlZC5cbiAgICovXG4gIGdldCBjdXJyZW50RW5kSW5kZXgoKTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy5pbmRleCA+IDApIHtcbiAgICAgIGNvbnN0IGN1clRva2VuID0gdGhpcy5wZWVrKC0xKTtcbiAgICAgIHJldHVybiBjdXJUb2tlbi5lbmQgKyB0aGlzLm9mZnNldDtcbiAgICB9XG4gICAgLy8gTm8gdG9rZW5zIGhhdmUgYmVlbiBwcm9jZXNzZWQgeWV0OyByZXR1cm4gdGhlIG5leHQgdG9rZW4ncyBzdGFydCBvciB0aGUgbGVuZ3RoIG9mIHRoZSBpbnB1dFxuICAgIC8vIGlmIHRoZXJlIGlzIG5vIHRva2VuLlxuICAgIGlmICh0aGlzLnRva2Vucy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGlzLmlucHV0TGVuZ3RoICsgdGhpcy5vZmZzZXQ7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhYnNvbHV0ZSBvZmZzZXQgb2YgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHRva2VuLlxuICAgKi9cbiAgZ2V0IGN1cnJlbnRBYnNvbHV0ZU9mZnNldCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmFic29sdXRlT2Zmc2V0ICsgdGhpcy5pbnB1dEluZGV4O1xuICB9XG5cbiAgc3BhbihzdGFydDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQYXJzZVNwYW4oc3RhcnQsIHRoaXMuY3VycmVudEVuZEluZGV4KTtcbiAgfVxuXG4gIHNvdXJjZVNwYW4oc3RhcnQ6IG51bWJlcik6IEFic29sdXRlU291cmNlU3BhbiB7XG4gICAgY29uc3Qgc2VyaWFsID0gYCR7c3RhcnR9QCR7dGhpcy5pbnB1dEluZGV4fWA7XG4gICAgaWYgKCF0aGlzLnNvdXJjZVNwYW5DYWNoZS5oYXMoc2VyaWFsKSkge1xuICAgICAgdGhpcy5zb3VyY2VTcGFuQ2FjaGUuc2V0KHNlcmlhbCwgdGhpcy5zcGFuKHN0YXJ0KS50b0Fic29sdXRlKHRoaXMuYWJzb2x1dGVPZmZzZXQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc291cmNlU3BhbkNhY2hlLmdldChzZXJpYWwpITtcbiAgfVxuXG4gIGFkdmFuY2UoKSB7XG4gICAgdGhpcy5pbmRleCsrO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIGEgY2FsbGJhY2sgaW4gdGhlIHByb3ZpZGVkIGNvbnRleHQuXG4gICAqL1xuICBwcml2YXRlIHdpdGhDb250ZXh0PFQ+KGNvbnRleHQ6IFBhcnNlQ29udGV4dEZsYWdzLCBjYjogKCkgPT4gVCk6IFQge1xuICAgIHRoaXMuY29udGV4dCB8PSBjb250ZXh0O1xuICAgIGNvbnN0IHJldCA9IGNiKCk7XG4gICAgdGhpcy5jb250ZXh0IF49IGNvbnRleHQ7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGNvbnN1bWVPcHRpb25hbENoYXJhY3Rlcihjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNvZGUpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcGVla0tleXdvcmRMZXQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmV4dC5pc0tleXdvcmRMZXQoKTtcbiAgfVxuICBwZWVrS2V5d29yZEFzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5leHQuaXNLZXl3b3JkQXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdW1lcyBhbiBleHBlY3RlZCBjaGFyYWN0ZXIsIG90aGVyd2lzZSBlbWl0cyBhbiBlcnJvciBhYm91dCB0aGUgbWlzc2luZyBleHBlY3RlZCBjaGFyYWN0ZXJcbiAgICogYW5kIHNraXBzIG92ZXIgdGhlIHRva2VuIHN0cmVhbSB1bnRpbCByZWFjaGluZyBhIHJlY292ZXJhYmxlIHBvaW50LlxuICAgKlxuICAgKiBTZWUgYHRoaXMuZXJyb3JgIGFuZCBgdGhpcy5za2lwYCBmb3IgbW9yZSBkZXRhaWxzLlxuICAgKi9cbiAgZXhwZWN0Q2hhcmFjdGVyKGNvZGU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3Rlcihjb2RlKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgJHtTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpfWApO1xuICB9XG5cbiAgY29uc3VtZU9wdGlvbmFsT3BlcmF0b3Iob3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5leHQuaXNPcGVyYXRvcihvcCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBleHBlY3RPcGVyYXRvcihvcGVyYXRvcjogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3Iob3BlcmF0b3IpKSByZXR1cm47XG4gICAgdGhpcy5lcnJvcihgTWlzc2luZyBleHBlY3RlZCBvcGVyYXRvciAke29wZXJhdG9yfWApO1xuICB9XG5cbiAgcHJldHR5UHJpbnRUb2tlbih0b2s6IFRva2VuKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdG9rID09PSBFT0YgPyAnZW5kIG9mIGlucHV0JyA6IGB0b2tlbiAke3Rva31gO1xuICB9XG5cbiAgZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpOiBzdHJpbmcge1xuICAgIGNvbnN0IG4gPSB0aGlzLm5leHQ7XG4gICAgaWYgKCFuLmlzSWRlbnRpZmllcigpICYmICFuLmlzS2V5d29yZCgpKSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkICR7dGhpcy5wcmV0dHlQcmludFRva2VuKG4pfSwgZXhwZWN0ZWQgaWRlbnRpZmllciBvciBrZXl3b3JkYCk7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuLnRvU3RyaW5nKCkgYXMgc3RyaW5nO1xuICB9XG5cbiAgZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgY29uc3QgbiA9IHRoaXMubmV4dDtcbiAgICBpZiAoIW4uaXNJZGVudGlmaWVyKCkgJiYgIW4uaXNLZXl3b3JkKCkgJiYgIW4uaXNTdHJpbmcoKSkge1xuICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCAke3RoaXMucHJldHR5UHJpbnRUb2tlbihuKX0sIGV4cGVjdGVkIGlkZW50aWZpZXIsIGtleXdvcmQsIG9yIHN0cmluZ2ApO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbi50b1N0cmluZygpIGFzIHN0cmluZztcbiAgfVxuXG4gIHBhcnNlQ2hhaW4oKTogQVNUIHtcbiAgICBjb25zdCBleHByczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBleHBycy5wdXNoKGV4cHIpO1xuXG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluIGNoYWluZWQgZXhwcmVzc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICB9ICAvLyByZWFkIGFsbCBzZW1pY29sb25zXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAnJHt0aGlzLm5leHR9J2ApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZXhwcnMubGVuZ3RoID09IDApIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIGlmIChleHBycy5sZW5ndGggPT0gMSkgcmV0dXJuIGV4cHJzWzBdO1xuICAgIHJldHVybiBuZXcgQ2hhaW4odGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZXhwcnMpO1xuICB9XG5cbiAgcGFyc2VQaXBlKCk6IEFTVCB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSkge1xuICAgICAgaWYgKHRoaXMucGFyc2VBY3Rpb24pIHtcbiAgICAgICAgdGhpcy5lcnJvcignQ2Fubm90IGhhdmUgYSBwaXBlIGluIGFuIGFjdGlvbiBleHByZXNzaW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGRvIHtcbiAgICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkKCk7XG4gICAgICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zb3VyY2VTcGFuKG5hbWVTdGFydCk7XG4gICAgICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW107XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pKSB7XG4gICAgICAgICAgYXJncy5wdXNoKHRoaXMucGFyc2VFeHByZXNzaW9uKCkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBCaW5kaW5nUGlwZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQsIG5hbWUsIGFyZ3MsIG5hbWVTcGFuKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbigpOiBBU1Qge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgfVxuXG4gIHBhcnNlQ29uZGl0aW9uYWwoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlTG9naWNhbE9yKCk7XG5cbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPycpKSB7XG4gICAgICBjb25zdCB5ZXMgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgbGV0IG5vOiBBU1Q7XG4gICAgICBpZiAoIXRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgY29uc3QgZW5kID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgICAgIHRoaXMuZXJyb3IoYENvbmRpdGlvbmFsIGV4cHJlc3Npb24gJHtleHByZXNzaW9ufSByZXF1aXJlcyBhbGwgMyBleHByZXNzaW9uc2ApO1xuICAgICAgICBubyA9IG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBubyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgeWVzLCBubyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VMb2dpY2FsT3IoKTogQVNUIHtcbiAgICAvLyAnfHwnXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG4gICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3x8JykpIHtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKTtcbiAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgJ3x8JywgcmVzdWx0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxvZ2ljYWxBbmQoKTogQVNUIHtcbiAgICAvLyAnJiYnXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCcmJicpKSB7XG4gICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuICAgICAgY29uc3Qge3N0YXJ0fSA9IHJlc3VsdC5zcGFuO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnJiYnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXF1YWxpdHkoKTogQVNUIHtcbiAgICAvLyAnPT0nLCchPScsJz09PScsJyE9PSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnPT0nOlxuICAgICAgICBjYXNlICc9PT0nOlxuICAgICAgICBjYXNlICchPSc6XG4gICAgICAgIGNhc2UgJyE9PSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlUmVsYXRpb25hbCgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VSZWxhdGlvbmFsKCk6IEFTVCB7XG4gICAgLy8gJzwnLCAnPicsICc8PScsICc+PSdcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJzwnOlxuICAgICAgICBjYXNlICc+JzpcbiAgICAgICAgY2FzZSAnPD0nOlxuICAgICAgICBjYXNlICc+PSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlQWRkaXRpdmUoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlQWRkaXRpdmUoKTogQVNUIHtcbiAgICAvLyAnKycsICctJ1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCByaWdodCA9IHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpO1xuICAgICAgICAgIGNvbnN0IHtzdGFydH0gPSByZXN1bHQuc3BhbjtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VNdWx0aXBsaWNhdGl2ZSgpOiBBU1Qge1xuICAgIC8vICcqJywgJyUnLCAnLydcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcqJzpcbiAgICAgICAgY2FzZSAnJSc6XG4gICAgICAgIGNhc2UgJy8nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCByaWdodCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICBjb25zdCB7c3RhcnR9ID0gcmVzdWx0LnNwYW47XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBvcGVyYXRvciwgcmVzdWx0LCByaWdodCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlUHJlZml4KCk6IEFTVCB7XG4gICAgaWYgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIGxldCByZXN1bHQ6IEFTVDtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBVbmFyeS5jcmVhdGVQbHVzKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXR1cm4gVW5hcnkuY3JlYXRlTWludXModGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgICAgY2FzZSAnISc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgUHJlZml4Tm90KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhcnNlQ2FsbENoYWluKCk7XG4gIH1cblxuICBwYXJzZUNhbGxDaGFpbigpOiBBU1Qge1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlUHJpbWFyeSgpO1xuICAgIGNvbnN0IHJlc3VsdFN0YXJ0ID0gcmVzdWx0LnNwYW4uc3RhcnQ7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kUEVSSU9EKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlc3VsdCwgZmFsc2UpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz8uJykpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChyZXN1bHQsIHRydWUpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0tFVCkpIHtcbiAgICAgICAgdGhpcy53aXRoQ29udGV4dChQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQrKztcbiAgICAgICAgICBjb25zdCBrZXkgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgICAgIGlmIChrZXkgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IoYEtleSBhY2Nlc3MgY2Fubm90IGJlIGVtcHR5YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQtLTtcbiAgICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7XG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgS2V5ZWRXcml0ZShcbiAgICAgICAgICAgICAgICB0aGlzLnNwYW4ocmVzdWx0U3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4ocmVzdWx0U3RhcnQpLCByZXN1bHQsIGtleSwgdmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPVxuICAgICAgICAgICAgICAgIG5ldyBLZXllZFJlYWQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBrZXkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnBhcnNlQ2FsbEFyZ3VtZW50cygpO1xuICAgICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZC0tO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgICAgcmVzdWx0ID1cbiAgICAgICAgICAgIG5ldyBGdW5jdGlvbkNhbGwodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0LCBhcmdzKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCchJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IE5vbk51bGxBc3NlcnQodGhpcy5zcGFuKHJlc3VsdFN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHJlc3VsdFN0YXJ0KSwgcmVzdWx0KTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZVByaW1hcnkoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZE51bGwoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbnVsbCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRVbmRlZmluZWQoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdm9pZCAwKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzS2V5d29yZFRydWUoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdHJ1ZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRGYWxzZSgpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRUaGlzKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBUaGlzUmVjZWl2ZXIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTEJSQUNLRVQpKSB7XG4gICAgICB0aGlzLnJicmFja2V0c0V4cGVjdGVkKys7XG4gICAgICBjb25zdCBlbGVtZW50cyA9IHRoaXMucGFyc2VFeHByZXNzaW9uTGlzdChjaGFycy4kUkJSQUNLRVQpO1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZC0tO1xuICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbEFycmF5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGVsZW1lbnRzKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0UpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUxpdGVyYWxNYXAoKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzSWRlbnRpZmllcigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yTWV0aG9kQ2FsbChcbiAgICAgICAgICBuZXcgSW1wbGljaXRSZWNlaXZlcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKSwgZmFsc2UpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNOdW1iZXIoKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLm5leHQudG9OdW1iZXIoKTtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5uZXh0LmlzU3RyaW5nKCkpIHtcbiAgICAgIGNvbnN0IGxpdGVyYWxWYWx1ZSA9IHRoaXMubmV4dC50b1N0cmluZygpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbGl0ZXJhbFZhbHVlKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA+PSB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb246ICR7dGhpcy5pbnB1dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7dGhpcy5uZXh0fWApO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uTGlzdCh0ZXJtaW5hdG9yOiBudW1iZXIpOiBBU1RbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBBU1RbXSA9IFtdO1xuXG4gICAgZG8ge1xuICAgICAgaWYgKCF0aGlzLm5leHQuaXNDaGFyYWN0ZXIodGVybWluYXRvcikpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VMaXRlcmFsTWFwKCk6IExpdGVyYWxNYXAge1xuICAgIGNvbnN0IGtleXM6IExpdGVyYWxNYXBLZXlbXSA9IFtdO1xuICAgIGNvbnN0IHZhbHVlczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kTEJSQUNFKTtcbiAgICBpZiAoIXRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpKSB7XG4gICAgICB0aGlzLnJicmFjZXNFeHBlY3RlZCsrO1xuICAgICAgZG8ge1xuICAgICAgICBjb25zdCBxdW90ZWQgPSB0aGlzLm5leHQuaXNTdHJpbmcoKTtcbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTtcbiAgICAgICAga2V5cy5wdXNoKHtrZXksIHF1b3RlZH0pO1xuICAgICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kQ09MT04pO1xuICAgICAgICB2YWx1ZXMucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSkpO1xuICAgICAgdGhpcy5yYnJhY2VzRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IExpdGVyYWxNYXAodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwga2V5cywgdmFsdWVzKTtcbiAgfVxuXG4gIHBhcnNlQWNjZXNzTWVtYmVyT3JNZXRob2RDYWxsKHJlY2VpdmVyOiBBU1QsIGlzU2FmZTogYm9vbGVhbiA9IGZhbHNlKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHJlY2VpdmVyLnNwYW4uc3RhcnQ7XG4gICAgY29uc3QgbmFtZVN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGNvbnN0IGlkID0gdGhpcy53aXRoQ29udGV4dChQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSwgKCkgPT4ge1xuICAgICAgY29uc3QgaWQgPSB0aGlzLmV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTtcbiAgICAgIGlmIChpZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhpcy5lcnJvcihgRXhwZWN0ZWQgaWRlbnRpZmllciBmb3IgcHJvcGVydHkgYWNjZXNzYCwgcmVjZWl2ZXIuc3Bhbi5lbmQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGlkO1xuICAgIH0pO1xuICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zb3VyY2VTcGFuKG5hbWVTdGFydCk7XG5cbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExQQVJFTikpIHtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy5wYXJzZUNhbGxBcmd1bWVudHMoKTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgIGNvbnN0IHNwYW4gPSB0aGlzLnNwYW4oc3RhcnQpO1xuICAgICAgY29uc3Qgc291cmNlU3BhbiA9IHRoaXMuc291cmNlU3BhbihzdGFydCk7XG4gICAgICByZXR1cm4gaXNTYWZlID8gbmV3IFNhZmVNZXRob2RDYWxsKHNwYW4sIHNvdXJjZVNwYW4sIG5hbWVTcGFuLCByZWNlaXZlciwgaWQsIGFyZ3MpIDpcbiAgICAgICAgICAgICAgICAgICAgICBuZXcgTWV0aG9kQ2FsbChzcGFuLCBzb3VyY2VTcGFuLCBuYW1lU3BhbiwgcmVjZWl2ZXIsIGlkLCBhcmdzKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaXNTYWZlKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc9JykpIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdUaGUgXFwnPy5cXCcgb3BlcmF0b3IgY2Fubm90IGJlIHVzZWQgaW4gdGhlIGFzc2lnbm1lbnQnKTtcbiAgICAgICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFNhZmVQcm9wZXJ0eVJlYWQoXG4gICAgICAgICAgICAgIHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWNlaXZlciwgaWQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmVycm9yKCdCaW5kaW5ncyBjYW5ub3QgY29udGFpbiBhc3NpZ25tZW50cycpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb3BlcnR5V3JpdGUoXG4gICAgICAgICAgICAgIHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG5hbWVTcGFuLCByZWNlaXZlciwgaWQsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb3BlcnR5UmVhZCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBuYW1lU3BhbiwgcmVjZWl2ZXIsIGlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBhcnNlQ2FsbEFyZ3VtZW50cygpOiBCaW5kaW5nUGlwZVtdIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzQ2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pKSByZXR1cm4gW107XG4gICAgY29uc3QgcG9zaXRpb25hbHM6IEFTVFtdID0gW107XG4gICAgZG8ge1xuICAgICAgcG9zaXRpb25hbHMucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcG9zaXRpb25hbHMgYXMgQmluZGluZ1BpcGVbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZXMgYW4gaWRlbnRpZmllciwgYSBrZXl3b3JkLCBhIHN0cmluZyB3aXRoIGFuIG9wdGlvbmFsIGAtYCBpbiBiZXR3ZWVuLFxuICAgKiBhbmQgcmV0dXJucyB0aGUgc3RyaW5nIGFsb25nIHdpdGggaXRzIGFic29sdXRlIHNvdXJjZSBzcGFuLlxuICAgKi9cbiAgZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIge1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBsZXQgb3BlcmF0b3JGb3VuZCA9IGZhbHNlO1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgZG8ge1xuICAgICAgcmVzdWx0ICs9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICBvcGVyYXRvckZvdW5kID0gdGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignLScpO1xuICAgICAgaWYgKG9wZXJhdG9yRm91bmQpIHtcbiAgICAgICAgcmVzdWx0ICs9ICctJztcbiAgICAgIH1cbiAgICB9IHdoaWxlIChvcGVyYXRvckZvdW5kKTtcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlOiByZXN1bHQsXG4gICAgICBzcGFuOiBuZXcgQWJzb2x1dGVTb3VyY2VTcGFuKHN0YXJ0LCBzdGFydCArIHJlc3VsdC5sZW5ndGgpLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgbWljcm9zeW50YXggdGVtcGxhdGUgZXhwcmVzc2lvbiBhbmQgcmV0dXJuIGEgbGlzdCBvZiBiaW5kaW5ncyBvclxuICAgKiBwYXJzaW5nIGVycm9ycyBpbiBjYXNlIHRoZSBnaXZlbiBleHByZXNzaW9uIGlzIGludmFsaWQuXG4gICAqXG4gICAqIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICA8ZGl2ICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpOyB0cmFja0J5OiBmdW5jXCI+XG4gICAqIGBgYFxuICAgKiBjb250YWlucyBmaXZlIGJpbmRpbmdzOlxuICAgKiAxLiBuZ0ZvciAtPiBudWxsXG4gICAqIDIuIGl0ZW0gLT4gTmdGb3JPZkNvbnRleHQuJGltcGxpY2l0XG4gICAqIDMuIG5nRm9yT2YgLT4gaXRlbXNcbiAgICogNC4gaSAtPiBOZ0Zvck9mQ29udGV4dC5pbmRleFxuICAgKiA1LiBuZ0ZvclRyYWNrQnkgLT4gZnVuY1xuICAgKlxuICAgKiBGb3IgYSBmdWxsIGRlc2NyaXB0aW9uIG9mIHRoZSBtaWNyb3N5bnRheCBncmFtbWFyLCBzZWVcbiAgICogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vbWhldmVyeS9kMzUzMDI5NGNmZjJlNGExYjNmZTE1ZmY3NWQwODg1NVxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGVLZXkgbmFtZSBvZiB0aGUgbWljcm9zeW50YXggZGlyZWN0aXZlLCBsaWtlIG5nSWYsIG5nRm9yLFxuICAgKiB3aXRob3V0IHRoZSAqLCBhbG9uZyB3aXRoIGl0cyBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcGFyc2VUZW1wbGF0ZUJpbmRpbmdzKHRlbXBsYXRlS2V5OiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyKTogVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IGJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSA9IFtdO1xuXG4gICAgLy8gVGhlIGZpcnN0IGJpbmRpbmcgaXMgZm9yIHRoZSB0ZW1wbGF0ZSBrZXkgaXRzZWxmXG4gICAgLy8gSW4gKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIiwga2V5ID0gXCJuZ0ZvclwiLCB2YWx1ZSA9IG51bGxcbiAgICAvLyBJbiAqbmdJZj1cImNvbmQgfCBwaXBlXCIsIGtleSA9IFwibmdJZlwiLCB2YWx1ZSA9IFwiY29uZCB8IHBpcGVcIlxuICAgIGJpbmRpbmdzLnB1c2goLi4udGhpcy5wYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyh0ZW1wbGF0ZUtleSkpO1xuXG4gICAgd2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIC8vIElmIGl0IHN0YXJ0cyB3aXRoICdsZXQnLCB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZSBkZWNsYXJhdGlvblxuICAgICAgY29uc3QgbGV0QmluZGluZyA9IHRoaXMucGFyc2VMZXRCaW5kaW5nKCk7XG4gICAgICBpZiAobGV0QmluZGluZykge1xuICAgICAgICBiaW5kaW5ncy5wdXNoKGxldEJpbmRpbmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVHdvIHBvc3NpYmxlIGNhc2VzIGhlcmUsIGVpdGhlciBgdmFsdWUgXCJhc1wiIGtleWAgb3JcbiAgICAgICAgLy8gXCJkaXJlY3RpdmUta2V5d29yZCBleHByZXNzaW9uXCIuIFdlIGRvbid0IGtub3cgd2hpY2ggY2FzZSwgYnV0IGJvdGhcbiAgICAgICAgLy8gXCJ2YWx1ZVwiIGFuZCBcImRpcmVjdGl2ZS1rZXl3b3JkXCIgYXJlIHRlbXBsYXRlIGJpbmRpbmcga2V5LCBzbyBjb25zdW1lXG4gICAgICAgIC8vIHRoZSBrZXkgZmlyc3QuXG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgICAgIC8vIFBlZWsgYXQgdGhlIG5leHQgdG9rZW4sIGlmIGl0IGlzIFwiYXNcIiB0aGVuIHRoaXMgbXVzdCBiZSB2YXJpYWJsZVxuICAgICAgICAvLyBkZWNsYXJhdGlvbi5cbiAgICAgICAgY29uc3QgYmluZGluZyA9IHRoaXMucGFyc2VBc0JpbmRpbmcoa2V5KTtcbiAgICAgICAgaWYgKGJpbmRpbmcpIHtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSB0aGUga2V5IG11c3QgYmUgYSBkaXJlY3RpdmUga2V5d29yZCwgbGlrZSBcIm9mXCIuIFRyYW5zZm9ybVxuICAgICAgICAgIC8vIHRoZSBrZXkgdG8gYWN0dWFsIGtleS4gRWcuIG9mIC0+IG5nRm9yT2YsIHRyYWNrQnkgLT4gbmdGb3JUcmFja0J5XG4gICAgICAgICAga2V5LnNvdXJjZSA9XG4gICAgICAgICAgICAgIHRlbXBsYXRlS2V5LnNvdXJjZSArIGtleS5zb3VyY2UuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBrZXkuc291cmNlLnN1YnN0cmluZygxKTtcbiAgICAgICAgICBiaW5kaW5ncy5wdXNoKC4uLnRoaXMucGFyc2VEaXJlY3RpdmVLZXl3b3JkQmluZGluZ3Moa2V5KSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0KGJpbmRpbmdzLCBbXSAvKiB3YXJuaW5ncyAqLywgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGEgZGlyZWN0aXZlIGtleXdvcmQsIGZvbGxvd2VkIGJ5IGEgbWFuZGF0b3J5IGV4cHJlc3Npb24uXG4gICAqIEZvciBleGFtcGxlLCBcIm9mIGl0ZW1zXCIsIFwidHJhY2tCeTogZnVuY1wiLlxuICAgKiBUaGUgYmluZGluZ3MgYXJlOiBuZ0Zvck9mIC0+IGl0ZW1zLCBuZ0ZvclRyYWNrQnkgLT4gZnVuY1xuICAgKiBUaGVyZSBjb3VsZCBiZSBhbiBvcHRpb25hbCBcImFzXCIgYmluZGluZyB0aGF0IGZvbGxvd3MgdGhlIGV4cHJlc3Npb24uXG4gICAqIEZvciBleGFtcGxlLFxuICAgKiBgYGBcbiAgICogICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtcyB8IHNsaWNlOjA6MSBhcyBjb2xsZWN0aW9uXCIuXG4gICAqICAgICAgICAgICAgICAgICAgICBeXiBeXl5eXl5eXl5eXl5eXl5eXiBeXl5eXl5eXl5eXl5eXG4gICAqICAgICAgICAgICAgICAga2V5d29yZCAgICBib3VuZCB0YXJnZXQgICBvcHRpb25hbCAnYXMnIGJpbmRpbmdcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBrZXkgYmluZGluZyBrZXksIGZvciBleGFtcGxlLCBuZ0ZvciwgbmdJZiwgbmdGb3JPZiwgYWxvbmcgd2l0aCBpdHNcbiAgICogYWJzb2x1dGUgc3Bhbi5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VEaXJlY3RpdmVLZXl3b3JkQmluZGluZ3Moa2V5OiBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyKTogVGVtcGxhdGVCaW5kaW5nW10ge1xuICAgIGNvbnN0IGJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSA9IFtdO1xuICAgIHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTik7ICAvLyB0cmFja0J5OiB0cmFja0J5RnVuY3Rpb25cbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuZ2V0RGlyZWN0aXZlQm91bmRUYXJnZXQoKTtcbiAgICBsZXQgc3BhbkVuZCA9IHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0O1xuICAgIC8vIFRoZSBiaW5kaW5nIGNvdWxkIG9wdGlvbmFsbHkgYmUgZm9sbG93ZWQgYnkgXCJhc1wiLiBGb3IgZXhhbXBsZSxcbiAgICAvLyAqbmdJZj1cImNvbmQgfCBwaXBlIGFzIHhcIi4gSW4gdGhpcyBjYXNlLCB0aGUga2V5IGluIHRoZSBcImFzXCIgYmluZGluZ1xuICAgIC8vIGlzIFwieFwiIGFuZCB0aGUgdmFsdWUgaXMgdGhlIHRlbXBsYXRlIGtleSBpdHNlbGYgKFwibmdJZlwiKS4gTm90ZSB0aGF0IHRoZVxuICAgIC8vICdrZXknIGluIHRoZSBjdXJyZW50IGNvbnRleHQgbm93IGJlY29tZXMgdGhlIFwidmFsdWVcIiBpbiB0aGUgbmV4dCBiaW5kaW5nLlxuICAgIGNvbnN0IGFzQmluZGluZyA9IHRoaXMucGFyc2VBc0JpbmRpbmcoa2V5KTtcbiAgICBpZiAoIWFzQmluZGluZykge1xuICAgICAgdGhpcy5jb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpO1xuICAgICAgc3BhbkVuZCA9IHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0O1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3BhbihrZXkuc3Bhbi5zdGFydCwgc3BhbkVuZCk7XG4gICAgYmluZGluZ3MucHVzaChuZXcgRXhwcmVzc2lvbkJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSkpO1xuICAgIGlmIChhc0JpbmRpbmcpIHtcbiAgICAgIGJpbmRpbmdzLnB1c2goYXNCaW5kaW5nKTtcbiAgICB9XG4gICAgcmV0dXJuIGJpbmRpbmdzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgZXhwcmVzc2lvbiBBU1QgZm9yIHRoZSBib3VuZCB0YXJnZXQgb2YgYSBkaXJlY3RpdmUga2V5d29yZFxuICAgKiBiaW5kaW5nLiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nSWY9XCJjb25kaXRpb24gfCBwaXBlXCJcbiAgICogICAgICAgICAgXl5eXl5eXl5eXl5eXl5eXiBib3VuZCB0YXJnZXQgZm9yIFwibmdJZlwiXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgXl5eXl4gYm91bmQgdGFyZ2V0IGZvciBcIm5nRm9yT2ZcIlxuICAgKiBgYGBcbiAgICovXG4gIHByaXZhdGUgZ2V0RGlyZWN0aXZlQm91bmRUYXJnZXQoKTogQVNUV2l0aFNvdXJjZXxudWxsIHtcbiAgICBpZiAodGhpcy5uZXh0ID09PSBFT0YgfHwgdGhpcy5wZWVrS2V5d29yZEFzKCkgfHwgdGhpcy5wZWVrS2V5d29yZExldCgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgYXN0ID0gdGhpcy5wYXJzZVBpcGUoKTsgIC8vIGV4YW1wbGU6IFwiY29uZGl0aW9uIHwgYXN5bmNcIlxuICAgIGNvbnN0IHtzdGFydCwgZW5kfSA9IGFzdC5zcGFuO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgdmFsdWUsIHRoaXMubG9jYXRpb24sIHRoaXMuYWJzb2x1dGVPZmZzZXQgKyBzdGFydCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYmluZGluZyBmb3IgYSB2YXJpYWJsZSBkZWNsYXJlZCB1c2luZyBgYXNgLiBOb3RlIHRoYXQgdGhlIG9yZGVyXG4gICAqIG9mIHRoZSBrZXktdmFsdWUgcGFpciBpbiB0aGlzIGRlY2xhcmF0aW9uIGlzIHJldmVyc2VkLiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGluZGV4IGFzIGlcIlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF5eXl5eICAgIF5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSAgICBrZXlcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB2YWx1ZSBuYW1lIG9mIHRoZSB2YWx1ZSBpbiB0aGUgZGVjbGFyYXRpb24sIFwibmdJZlwiIGluIHRoZSBleGFtcGxlXG4gICAqIGFib3ZlLCBhbG9uZyB3aXRoIGl0cyBhYnNvbHV0ZSBzcGFuLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUFzQmluZGluZyh2YWx1ZTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcik6IFRlbXBsYXRlQmluZGluZ3xudWxsIHtcbiAgICBpZiAoIXRoaXMucGVla0tleXdvcmRBcygpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBjb25zdW1lIHRoZSAnYXMnIGtleXdvcmRcbiAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3Bhbih2YWx1ZS5zcGFuLnN0YXJ0LCB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldCk7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBiaW5kaW5nIGZvciBhIHZhcmlhYmxlIGRlY2xhcmVkIHVzaW5nIGBsZXRgLiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGxldCBpPWluZGV4O1wiXG4gICAqICAgICAgICAgICBeXl5eXl5eXiAgICAgICAgICAgXl5eXl5eXl5eXl5cbiAgICogYGBgXG4gICAqIEluIHRoZSBmaXJzdCBiaW5kaW5nLCBgaXRlbWAgaXMgYm91bmQgdG8gYE5nRm9yT2ZDb250ZXh0LiRpbXBsaWNpdGAuXG4gICAqIEluIHRoZSBzZWNvbmQgYmluZGluZywgYGlgIGlzIGJvdW5kIHRvIGBOZ0Zvck9mQ29udGV4dC5pbmRleGAuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlTGV0QmluZGluZygpOiBUZW1wbGF0ZUJpbmRpbmd8bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBlZWtLZXl3b3JkTGV0KCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzcGFuU3RhcnQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIGNvbnN1bWUgdGhlICdsZXQnIGtleXdvcmRcbiAgICBjb25zdCBrZXkgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIGxldCB2YWx1ZTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcnxudWxsID0gbnVsbDtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICB2YWx1ZSA9IHRoaXMuZXhwZWN0VGVtcGxhdGVCaW5kaW5nS2V5KCk7XG4gICAgfVxuICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IEFic29sdXRlU291cmNlU3BhbihzcGFuU3RhcnQsIHRoaXMuY3VycmVudEFic29sdXRlT2Zmc2V0KTtcbiAgICByZXR1cm4gbmV3IFZhcmlhYmxlQmluZGluZyhzb3VyY2VTcGFuLCBrZXksIHZhbHVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdW1lIHRoZSBvcHRpb25hbCBzdGF0ZW1lbnQgdGVybWluYXRvcjogc2VtaWNvbG9uIG9yIGNvbW1hLlxuICAgKi9cbiAgcHJpdmF0ZSBjb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpIHtcbiAgICB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSB8fCB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlY29yZHMgYW4gZXJyb3IgYW5kIHNraXBzIG92ZXIgdGhlIHRva2VuIHN0cmVhbSB1bnRpbCByZWFjaGluZyBhIHJlY292ZXJhYmxlIHBvaW50LiBTZWVcbiAgICogYHRoaXMuc2tpcGAgZm9yIG1vcmUgZGV0YWlscyBvbiB0b2tlbiBza2lwcGluZy5cbiAgICovXG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgaW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCkge1xuICAgIHRoaXMuZXJyb3JzLnB1c2gobmV3IFBhcnNlckVycm9yKG1lc3NhZ2UsIHRoaXMuaW5wdXQsIHRoaXMubG9jYXRpb25UZXh0KGluZGV4KSwgdGhpcy5sb2NhdGlvbikpO1xuICAgIHRoaXMuc2tpcCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2NhdGlvblRleHQoaW5kZXg6IG51bWJlcnxudWxsID0gbnVsbCkge1xuICAgIGlmIChpbmRleCA9PSBudWxsKSBpbmRleCA9IHRoaXMuaW5kZXg7XG4gICAgcmV0dXJuIChpbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkgPyBgYXQgY29sdW1uICR7dGhpcy50b2tlbnNbaW5kZXhdLmluZGV4ICsgMX0gaW5gIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBhdCB0aGUgZW5kIG9mIHRoZSBleHByZXNzaW9uYDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFcnJvciByZWNvdmVyeSBzaG91bGQgc2tpcCB0b2tlbnMgdW50aWwgaXQgZW5jb3VudGVycyBhIHJlY292ZXJ5IHBvaW50LlxuICAgKlxuICAgKiBUaGUgZm9sbG93aW5nIGFyZSB0cmVhdGVkIGFzIHVuY29uZGl0aW9uYWwgcmVjb3ZlcnkgcG9pbnRzOlxuICAgKiAgIC0gZW5kIG9mIGlucHV0XG4gICAqICAgLSAnOycgKHBhcnNlQ2hhaW4oKSBpcyBhbHdheXMgdGhlIHJvb3QgcHJvZHVjdGlvbiwgYW5kIGl0IGV4cGVjdHMgYSAnOycpXG4gICAqICAgLSAnfCcgKHNpbmNlIHBpcGVzIG1heSBiZSBjaGFpbmVkIGFuZCBlYWNoIHBpcGUgZXhwcmVzc2lvbiBtYXkgYmUgdHJlYXRlZCBpbmRlcGVuZGVudGx5KVxuICAgKlxuICAgKiBUaGUgZm9sbG93aW5nIGFyZSBjb25kaXRpb25hbCByZWNvdmVyeSBwb2ludHM6XG4gICAqICAgLSAnKScsICd9JywgJ10nIGlmIG9uZSBvZiBjYWxsaW5nIHByb2R1Y3Rpb25zIGlzIGV4cGVjdGluZyBvbmUgb2YgdGhlc2Ugc3ltYm9sc1xuICAgKiAgICAgLSBUaGlzIGFsbG93cyBza2lwKCkgdG8gcmVjb3ZlciBmcm9tIGVycm9ycyBzdWNoIGFzICcoYS4pICsgMScgYWxsb3dpbmcgbW9yZSBvZiB0aGUgQVNUIHRvXG4gICAqICAgICAgIGJlIHJldGFpbmVkIChpdCBkb2Vzbid0IHNraXAgYW55IHRva2VucyBhcyB0aGUgJyknIGlzIHJldGFpbmVkIGJlY2F1c2Ugb2YgdGhlICcoJyBiZWdpbnNcbiAgICogICAgICAgYW4gJygnIDxleHByPiAnKScgcHJvZHVjdGlvbikuXG4gICAqICAgICAgIFRoZSByZWNvdmVyeSBwb2ludHMgb2YgZ3JvdXBpbmcgc3ltYm9scyBtdXN0IGJlIGNvbmRpdGlvbmFsIGFzIHRoZXkgbXVzdCBiZSBza2lwcGVkIGlmXG4gICAqICAgICAgIG5vbmUgb2YgdGhlIGNhbGxpbmcgcHJvZHVjdGlvbnMgYXJlIG5vdCBleHBlY3RpbmcgdGhlIGNsb3NpbmcgdG9rZW4gZWxzZSB3ZSB3aWxsIG5ldmVyXG4gICAqICAgICAgIG1ha2UgcHJvZ3Jlc3MgaW4gdGhlIGNhc2Ugb2YgYW4gZXh0cmFuZW91cyBncm91cCBjbG9zaW5nIHN5bWJvbCAoc3VjaCBhcyBhIHN0cmF5ICcpJykuXG4gICAqICAgICAgIFRoYXQgaXMsIHdlIHNraXAgYSBjbG9zaW5nIHN5bWJvbCBpZiB3ZSBhcmUgbm90IGluIGEgZ3JvdXBpbmcgcHJvZHVjdGlvbi5cbiAgICogICAtICc9JyBpbiBhIGBXcml0YWJsZWAgY29udGV4dFxuICAgKiAgICAgLSBJbiB0aGlzIGNvbnRleHQsIHdlIGFyZSBhYmxlIHRvIHJlY292ZXIgYWZ0ZXIgc2VlaW5nIHRoZSBgPWAgb3BlcmF0b3IsIHdoaWNoXG4gICAqICAgICAgIHNpZ25hbHMgdGhlIHByZXNlbmNlIG9mIGFuIGluZGVwZW5kZW50IHJ2YWx1ZSBleHByZXNzaW9uIGZvbGxvd2luZyB0aGUgYD1gIG9wZXJhdG9yLlxuICAgKlxuICAgKiBJZiBhIHByb2R1Y3Rpb24gZXhwZWN0cyBvbmUgb2YgdGhlc2UgdG9rZW4gaXQgaW5jcmVtZW50cyB0aGUgY29ycmVzcG9uZGluZyBuZXN0aW5nIGNvdW50LFxuICAgKiBhbmQgdGhlbiBkZWNyZW1lbnRzIGl0IGp1c3QgcHJpb3IgdG8gY2hlY2tpbmcgaWYgdGhlIHRva2VuIGlzIGluIHRoZSBpbnB1dC5cbiAgICovXG4gIHByaXZhdGUgc2tpcCgpIHtcbiAgICBsZXQgbiA9IHRoaXMubmV4dDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCAmJiAhbi5pc0NoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSAmJlxuICAgICAgICAgICAhbi5pc09wZXJhdG9yKCd8JykgJiYgKHRoaXMucnBhcmVuc0V4cGVjdGVkIDw9IDAgfHwgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikpICYmXG4gICAgICAgICAgICh0aGlzLnJicmFjZXNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2tldHNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCkpICYmXG4gICAgICAgICAgICghKHRoaXMuY29udGV4dCAmIFBhcnNlQ29udGV4dEZsYWdzLldyaXRhYmxlKSB8fCAhbi5pc09wZXJhdG9yKCc9JykpKSB7XG4gICAgICBpZiAodGhpcy5uZXh0LmlzRXJyb3IoKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlckVycm9yKHRoaXMubmV4dC50b1N0cmluZygpISwgdGhpcy5pbnB1dCwgdGhpcy5sb2NhdGlvblRleHQoKSwgdGhpcy5sb2NhdGlvbikpO1xuICAgICAgfVxuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBuID0gdGhpcy5uZXh0O1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0VGhpc1JlY2VpdmVyKGFzdDogVGhpc1JlY2VpdmVyLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogSW50ZXJwb2xhdGlvbiwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IExpdGVyYWxQcmltaXRpdmUsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRNZXRob2RDYWxsKGFzdDogTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0U2FmZU1ldGhvZENhbGwoYXN0OiBTYWZlTWV0aG9kQ2FsbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogRnVuY3Rpb25DYWxsLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSkge1xuICAgIHRoaXMudmlzaXRBbGwoYXN0LmV4cHJlc3Npb25zLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChhc3Q6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSkge1xuICAgIHRoaXMudmlzaXRBbGwoYXN0LnZhbHVlcywgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdFVuYXJ5KGFzdDogVW5hcnksIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEJpbmFyeShhc3Q6IEJpbmFyeSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UHJlZml4Tm90KGFzdDogUHJlZml4Tm90LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXROb25OdWxsQXNzZXJ0KGFzdDogTm9uTnVsbEFzc2VydCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKCdwaXBlcycpO1xuICB9XG5cbiAgdmlzaXRLZXllZFJlYWQoYXN0OiBLZXllZFJlYWQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdEtleWVkV3JpdGUoYXN0OiBLZXllZFdyaXRlLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRBbGwoYXN0czogYW55W10sIGNvbnRleHQ6IGFueSk6IGFueVtdIHtcbiAgICByZXR1cm4gYXN0cy5tYXAobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0Q2hhaW4oYXN0OiBDaGFpbiwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UXVvdGUoYXN0OiBRdW90ZSwgY29udGV4dDogYW55KSB7fVxufVxuXG4vKipcbiAqIFRoaXMgY2xhc3MgaW1wbGVtZW50cyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciB1c2VkIGluIFZpZXcgRW5naW5lIGFuZCBwZXJmb3JtcyBtb3JlIHN0cmljdCBjaGVja3NcbiAqIHRvIG1ha2Ugc3VyZSBob3N0IGJpbmRpbmdzIGRvIG5vdCBjb250YWluIHBpcGVzLiBJbiBWaWV3IEVuZ2luZSwgaGF2aW5nIHBpcGVzIGluIGhvc3QgYmluZGluZ3MgaXNcbiAqIG5vdCBzdXBwb3J0ZWQgYXMgd2VsbCwgYnV0IGluIHNvbWUgY2FzZXMgKGxpa2UgYCEodmFsdWUgfCBhc3luYylgKSB0aGUgZXJyb3IgaXMgbm90IHRyaWdnZXJlZCBhdFxuICogY29tcGlsZSB0aW1lLiBJbiBvcmRlciB0byBwcmVzZXJ2ZSBWaWV3IEVuZ2luZSBiZWhhdmlvciwgbW9yZSBzdHJpY3QgY2hlY2tzIGFyZSBpbnRyb2R1Y2VkIGZvclxuICogSXZ5IG1vZGUgb25seS5cbiAqL1xuY2xhc3MgSXZ5U2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgU2ltcGxlRXhwcmVzc2lvbkNoZWNrZXIge1xuICBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgdmlzaXRQaXBlKCkge1xuICAgIHRoaXMuZXJyb3JzLnB1c2goJ3BpcGVzJyk7XG4gIH1cbn1cbiJdfQ==