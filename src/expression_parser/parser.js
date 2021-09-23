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
            if (!(0, lexer_1.isIdentifier)(prefix))
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
                    if (text.trim().length === 0) {
                        this._reportError('Blank expressions are not allowed in interpolated strings', input, "at column " + i + " in", location);
                    }
                    expressions.push({ text: text, start: fullStart, end: fullEnd });
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
                else if (outerQuote == null && chars.isQuote(char)) {
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
                for (var _c = (0, tslib_1.__values)(this._forEachUnquotedChar(input, 0)), _d = _c.next(); !_d.done; _d = _c.next()) {
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
                for (var _b = (0, tslib_1.__values)(this._forEachUnquotedChar(input, start)), _c = _b.next(); !_c.done; _c = _b.next()) {
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
            return (0, tslib_1.__generator)(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentQuote = null;
                        escapeCount = 0;
                        i = start;
                        _a.label = 1;
                    case 1:
                        if (!(i < input.length)) return [3 /*break*/, 6];
                        char = input[i];
                        if (!(chars.isQuote(input.charCodeAt(i)) && (currentQuote === null || currentQuote === char) &&
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
        (0, tslib_1.__extends)(IvyParser, _super);
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
        /**
         * Retrieve a `ParseSpan` from `start` to the current position (or to `artificialEndIndex` if
         * provided).
         *
         * @param start Position from which the `ParseSpan` will start.
         * @param artificialEndIndex Optional ending index to be used if provided (and if greater than the
         *     natural ending index)
         */
        _ParseAST.prototype.span = function (start, artificialEndIndex) {
            var endIndex = this.currentEndIndex;
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
                var tmp = endIndex;
                endIndex = start;
                start = tmp;
            }
            return new ast_1.ParseSpan(start, endIndex);
        };
        _ParseAST.prototype.sourceSpan = function (start, artificialEndIndex) {
            var serial = start + "@" + this.inputIndex + ":" + artificialEndIndex;
            if (!this.sourceSpanCache.has(serial)) {
                this.sourceSpanCache.set(serial, this.span(start, artificialEndIndex).toAbsolute(this.absoluteOffset));
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
                if (n.isPrivateIdentifier()) {
                    this._reportErrorForPrivateIdentifier(n, 'expected identifier or keyword');
                }
                else {
                    this.error("Unexpected " + this.prettyPrintToken(n) + ", expected identifier or keyword");
                }
                return null;
            }
            this.advance();
            return n.toString();
        };
        _ParseAST.prototype.expectIdentifierOrKeywordOrString = function () {
            var n = this.next;
            if (!n.isIdentifier() && !n.isKeyword() && !n.isString()) {
                if (n.isPrivateIdentifier()) {
                    this._reportErrorForPrivateIdentifier(n, 'expected identifier, keyword or string');
                }
                else {
                    this.error("Unexpected " + this.prettyPrintToken(n) + ", expected identifier, keyword, or string");
                }
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
            if (exprs.length == 0) {
                // We have no expressions so create an empty expression that spans the entire input length
                var artificialStart = this.offset;
                var artificialEnd = this.offset + this.inputLength;
                return new ast_1.EmptyExpr(this.span(artificialStart, artificialEnd), this.sourceSpan(artificialStart, artificialEnd));
            }
            if (exprs.length == 1)
                return exprs[0];
            return new ast_1.Chain(this.span(start), this.sourceSpan(start), exprs);
        };
        _ParseAST.prototype.parsePipe = function () {
            var start = this.inputIndex;
            var result = this.parseExpression();
            if (this.consumeOptionalOperator('|')) {
                if (this.parseAction) {
                    this.error('Cannot have a pipe in an action expression');
                }
                do {
                    var nameStart = this.inputIndex;
                    var nameId = this.expectIdentifierOrKeyword();
                    var nameSpan = void 0;
                    var fullSpanEnd = undefined;
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
                        nameSpan = new ast_1.ParseSpan(fullSpanEnd, fullSpanEnd).toAbsolute(this.absoluteOffset);
                    }
                    var args = [];
                    while (this.consumeOptionalCharacter(chars.$COLON)) {
                        args.push(this.parseExpression());
                        // If there are additional expressions beyond the name, then the artificial end for the
                        // name is no longer relevant.
                    }
                    result = new ast_1.BindingPipe(this.span(start), this.sourceSpan(start, fullSpanEnd), result, nameId, args, nameSpan);
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
            var start = this.inputIndex;
            var result = this.parseLogicalAnd();
            while (this.consumeOptionalOperator('||')) {
                var right = this.parseLogicalAnd();
                result = new ast_1.Binary(this.span(start), this.sourceSpan(start), '||', result, right);
            }
            return result;
        };
        _ParseAST.prototype.parseLogicalAnd = function () {
            // '&&'
            var start = this.inputIndex;
            var result = this.parseNullishCoalescing();
            while (this.consumeOptionalOperator('&&')) {
                var right = this.parseNullishCoalescing();
                result = new ast_1.Binary(this.span(start), this.sourceSpan(start), '&&', result, right);
            }
            return result;
        };
        _ParseAST.prototype.parseNullishCoalescing = function () {
            // '??'
            var start = this.inputIndex;
            var result = this.parseEquality();
            while (this.consumeOptionalOperator('??')) {
                var right = this.parseEquality();
                result = new ast_1.Binary(this.span(start), this.sourceSpan(start), '??', result, right);
            }
            return result;
        };
        _ParseAST.prototype.parseEquality = function () {
            // '==','!=','===','!=='
            var start = this.inputIndex;
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
                        result = new ast_1.Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                        continue;
                }
                break;
            }
            return result;
        };
        _ParseAST.prototype.parseRelational = function () {
            // '<', '>', '<=', '>='
            var start = this.inputIndex;
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
                        result = new ast_1.Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                        continue;
                }
                break;
            }
            return result;
        };
        _ParseAST.prototype.parseAdditive = function () {
            // '+', '-'
            var start = this.inputIndex;
            var result = this.parseMultiplicative();
            while (this.next.type == lexer_1.TokenType.Operator) {
                var operator = this.next.strValue;
                switch (operator) {
                    case '+':
                    case '-':
                        this.advance();
                        var right = this.parseMultiplicative();
                        result = new ast_1.Binary(this.span(start), this.sourceSpan(start), operator, result, right);
                        continue;
                }
                break;
            }
            return result;
        };
        _ParseAST.prototype.parseMultiplicative = function () {
            // '*', '%', '/'
            var start = this.inputIndex;
            var result = this.parsePrefix();
            while (this.next.type == lexer_1.TokenType.Operator) {
                var operator = this.next.strValue;
                switch (operator) {
                    case '*':
                    case '%':
                    case '/':
                        this.advance();
                        var right = this.parsePrefix();
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
            var start = this.inputIndex;
            var result = this.parsePrimary();
            while (true) {
                if (this.consumeOptionalCharacter(chars.$PERIOD)) {
                    result = this.parseAccessMemberOrCall(result, start, false);
                }
                else if (this.consumeOptionalOperator('?.')) {
                    result = this.consumeOptionalCharacter(chars.$LBRACKET) ?
                        this.parseKeyedReadOrWrite(result, start, true) :
                        this.parseAccessMemberOrCall(result, start, true);
                }
                else if (this.consumeOptionalCharacter(chars.$LBRACKET)) {
                    result = this.parseKeyedReadOrWrite(result, start, false);
                }
                else if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                    var argumentStart = this.inputIndex;
                    this.rparensExpected++;
                    var args = this.parseCallArguments();
                    var argumentSpan = this.span(argumentStart, this.inputIndex).toAbsolute(this.absoluteOffset);
                    this.rparensExpected--;
                    this.expectCharacter(chars.$RPAREN);
                    result = new ast_1.Call(this.span(start), this.sourceSpan(start), result, args, argumentSpan);
                }
                else if (this.consumeOptionalOperator('!')) {
                    result = new ast_1.NonNullAssert(this.span(start), this.sourceSpan(start), result);
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
                return this.parseAccessMemberOrCall(new ast_1.ImplicitReceiver(this.span(start), this.sourceSpan(start)), start, false);
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
            else if (this.next.isPrivateIdentifier()) {
                this._reportErrorForPrivateIdentifier(this.next, null);
                return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
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
                    var keyStart = this.inputIndex;
                    var quoted = this.next.isString();
                    var key = this.expectIdentifierOrKeywordOrString();
                    keys.push({ key: key, quoted: quoted });
                    // Properties with quoted keys can't use the shorthand syntax.
                    if (quoted) {
                        this.expectCharacter(chars.$COLON);
                        values.push(this.parsePipe());
                    }
                    else if (this.consumeOptionalCharacter(chars.$COLON)) {
                        values.push(this.parsePipe());
                    }
                    else {
                        var span = this.span(keyStart);
                        var sourceSpan = this.sourceSpan(keyStart);
                        values.push(new ast_1.PropertyRead(span, sourceSpan, sourceSpan, new ast_1.ImplicitReceiver(span, sourceSpan), key));
                    }
                } while (this.consumeOptionalCharacter(chars.$COMMA));
                this.rbracesExpected--;
                this.expectCharacter(chars.$RBRACE);
            }
            return new ast_1.LiteralMap(this.span(start), this.sourceSpan(start), keys, values);
        };
        _ParseAST.prototype.parseAccessMemberOrCall = function (readReceiver, start, isSafe) {
            var _this = this;
            var nameStart = this.inputIndex;
            var id = this.withContext(ParseContextFlags.Writable, function () {
                var _a;
                var id = (_a = _this.expectIdentifierOrKeyword()) !== null && _a !== void 0 ? _a : '';
                if (id.length === 0) {
                    _this.error("Expected identifier for property access", readReceiver.span.end);
                }
                return id;
            });
            var nameSpan = this.sourceSpan(nameStart);
            var receiver;
            if (isSafe) {
                if (this.consumeOptionalOperator('=')) {
                    this.error('The \'?.\' operator cannot be used in the assignment');
                    receiver = new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
                }
                else {
                    receiver = new ast_1.SafePropertyRead(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id);
                }
            }
            else {
                if (this.consumeOptionalOperator('=')) {
                    if (!this.parseAction) {
                        this.error('Bindings cannot contain assignments');
                        return new ast_1.EmptyExpr(this.span(start), this.sourceSpan(start));
                    }
                    var value = this.parseConditional();
                    receiver = new ast_1.PropertyWrite(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id, value);
                }
                else {
                    receiver =
                        new ast_1.PropertyRead(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id);
                }
            }
            if (this.consumeOptionalCharacter(chars.$LPAREN)) {
                var argumentStart = this.inputIndex;
                this.rparensExpected++;
                var args = this.parseCallArguments();
                var argumentSpan = this.span(argumentStart, this.inputIndex).toAbsolute(this.absoluteOffset);
                this.expectCharacter(chars.$RPAREN);
                this.rparensExpected--;
                var span = this.span(start);
                var sourceSpan = this.sourceSpan(start);
                return new ast_1.Call(span, sourceSpan, receiver, args, argumentSpan);
            }
            return receiver;
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
            bindings.push.apply(bindings, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(this.parseDirectiveKeywordBindings(templateKey)), false));
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
                        bindings.push.apply(bindings, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(this.parseDirectiveKeywordBindings(key)), false));
                    }
                }
                this.consumeStatementTerminator();
            }
            return new TemplateBindingParseResult(bindings, [] /* warnings */, this.errors);
        };
        _ParseAST.prototype.parseKeyedReadOrWrite = function (receiver, start, isSafe) {
            var _this = this;
            return this.withContext(ParseContextFlags.Writable, function () {
                _this.rbracketsExpected++;
                var key = _this.parsePipe();
                if (key instanceof ast_1.EmptyExpr) {
                    _this.error("Key access cannot be empty");
                }
                _this.rbracketsExpected--;
                _this.expectCharacter(chars.$RBRACKET);
                if (_this.consumeOptionalOperator('=')) {
                    if (isSafe) {
                        _this.error('The \'?.\' operator cannot be used in the assignment');
                    }
                    else {
                        var value = _this.parseConditional();
                        return new ast_1.KeyedWrite(_this.span(start), _this.sourceSpan(start), receiver, key, value);
                    }
                }
                else {
                    return isSafe ? new ast_1.SafeKeyedRead(_this.span(start), _this.sourceSpan(start), receiver, key) :
                        new ast_1.KeyedRead(_this.span(start), _this.sourceSpan(start), receiver, key);
                }
                return new ast_1.EmptyExpr(_this.span(start), _this.sourceSpan(start));
            });
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
         * Records an error for an unexpected private identifier being discovered.
         * @param token Token representing a private identifier.
         * @param extraMessage Optional additional message being appended to the error.
         */
        _ParseAST.prototype._reportErrorForPrivateIdentifier = function (token, extraMessage) {
            var errorMessage = "Private identifiers are not supported. Unexpected private identifier: " + token;
            if (extraMessage !== null) {
                errorMessage += ", " + extraMessage;
            }
            this.error(errorMessage);
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
        SimpleExpressionChecker.prototype.visitCall = function (ast, context) { };
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
        SimpleExpressionChecker.prototype.visitSafeKeyedRead = function (ast, context) { };
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
        (0, tslib_1.__extends)(IvySimpleExpressionChecker, _super);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbURBQWtDO0lBQ2xDLDZGQUFvRztJQUVwRyxtRUFBdWU7SUFDdmUsdUVBQW1FO0lBT25FO1FBQ0UsNEJBQ1csT0FBNkIsRUFBUyxXQUFpQyxFQUN2RSxPQUFpQjtZQURqQixZQUFPLEdBQVAsT0FBTyxDQUFzQjtZQUFTLGdCQUFXLEdBQVgsV0FBVyxDQUFzQjtZQUN2RSxZQUFPLEdBQVAsT0FBTyxDQUFVO1FBQUcsQ0FBQztRQUNsQyx5QkFBQztJQUFELENBQUMsQUFKRCxJQUlDO0lBSlksZ0RBQWtCO0lBTS9CO1FBQ0Usb0NBQ1csZ0JBQW1DLEVBQVMsUUFBa0IsRUFDOUQsTUFBcUI7WUFEckIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFtQjtZQUFTLGFBQVEsR0FBUixRQUFRLENBQVU7WUFDOUQsV0FBTSxHQUFOLE1BQU0sQ0FBZTtRQUFHLENBQUM7UUFDdEMsaUNBQUM7SUFBRCxDQUFDLEFBSkQsSUFJQztJQUpZLGdFQUEwQjtJQU12QztRQUdFLGdCQUFvQixNQUFhO1lBQWIsV0FBTSxHQUFOLE1BQU0sQ0FBTztZQUZ6QixXQUFNLEdBQWtCLEVBQUUsQ0FBQztZQUluQyw0QkFBdUIsR0FBRyx1QkFBdUIsQ0FBQztRQUZkLENBQUM7UUFJckMsNEJBQVcsR0FBWCxVQUNJLEtBQWEsRUFBRSxRQUFnQixFQUFFLGNBQXNCLEVBQ3ZELG1CQUF1RTtZQUF2RSxvQ0FBQSxFQUFBLHNCQUEyQyxtREFBNEI7WUFDekUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztZQUNqRSxJQUFNLFdBQVcsR0FBRyxJQUFJLENB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biAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGFycyBmcm9tICcuLi9jaGFycyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5cbmltcG9ydCB7QWJzb2x1dGVTb3VyY2VTcGFuLCBBU1QsIEFzdFZpc2l0b3IsIEFTVFdpdGhTb3VyY2UsIEJpbmFyeSwgQmluZGluZ1BpcGUsIENhbGwsIENoYWluLCBDb25kaXRpb25hbCwgRW1wdHlFeHByLCBFeHByZXNzaW9uQmluZGluZywgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgS2V5ZWRSZWFkLCBLZXllZFdyaXRlLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxNYXBLZXksIExpdGVyYWxQcmltaXRpdmUsIE5vbk51bGxBc3NlcnQsIFBhcnNlckVycm9yLCBQYXJzZVNwYW4sIFByZWZpeE5vdCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBRdW90ZSwgUmVjdXJzaXZlQXN0VmlzaXRvciwgU2FmZUtleWVkUmVhZCwgU2FmZVByb3BlcnR5UmVhZCwgVGVtcGxhdGVCaW5kaW5nLCBUZW1wbGF0ZUJpbmRpbmdJZGVudGlmaWVyLCBUaGlzUmVjZWl2ZXIsIFVuYXJ5LCBWYXJpYWJsZUJpbmRpbmd9IGZyb20gJy4vYXN0JztcbmltcG9ydCB7RU9GLCBpc0lkZW50aWZpZXIsIExleGVyLCBUb2tlbiwgVG9rZW5UeXBlfSBmcm9tICcuL2xleGVyJztcblxuZXhwb3J0IGludGVyZmFjZSBJbnRlcnBvbGF0aW9uUGllY2Uge1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0OiBudW1iZXI7XG4gIGVuZDogbnVtYmVyO1xufVxuZXhwb3J0IGNsYXNzIFNwbGl0SW50ZXJwb2xhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHN0cmluZ3M6IEludGVycG9sYXRpb25QaWVjZVtdLCBwdWJsaWMgZXhwcmVzc2lvbnM6IEludGVycG9sYXRpb25QaWVjZVtdLFxuICAgICAgcHVibGljIG9mZnNldHM6IG51bWJlcltdKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUJpbmRpbmdzOiBUZW1wbGF0ZUJpbmRpbmdbXSwgcHVibGljIHdhcm5pbmdzOiBzdHJpbmdbXSxcbiAgICAgIHB1YmxpYyBlcnJvcnM6IFBhcnNlckVycm9yW10pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2xleGVyOiBMZXhlcikge31cblxuICBzaW1wbGVFeHByZXNzaW9uQ2hlY2tlciA9IFNpbXBsZUV4cHJlc3Npb25DaGVja2VyO1xuXG4gIHBhcnNlQWN0aW9uKFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKTogQVNUV2l0aFNvdXJjZSB7XG4gICAgdGhpcy5fY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQsIGxvY2F0aW9uLCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpO1xuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuX2xleGVyLnRva2VuaXplKHRoaXMuX3N0cmlwQ29tbWVudHMoaW5wdXQpKTtcbiAgICBjb25zdCBhc3QgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgdHJ1ZSwgdGhpcy5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgIGlucHV0Lmxlbmd0aCAtIHNvdXJjZVRvTGV4Lmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwYXJzZUJpbmRpbmcoXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZUJpbmRpbmdBc3QoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgcmV0dXJuIG5ldyBBU1RXaXRoU291cmNlKGFzdCwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja1NpbXBsZUV4cHJlc3Npb24oYXN0OiBBU1QpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgY2hlY2tlciA9IG5ldyB0aGlzLnNpbXBsZUV4cHJlc3Npb25DaGVja2VyKCk7XG4gICAgYXN0LnZpc2l0KGNoZWNrZXIpO1xuICAgIHJldHVybiBjaGVja2VyLmVycm9ycztcbiAgfVxuXG4gIHBhcnNlU2ltcGxlQmluZGluZyhcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlQmluZGluZ0FzdChpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCBpbnRlcnBvbGF0aW9uQ29uZmlnKTtcbiAgICBjb25zdCBlcnJvcnMgPSB0aGlzLmNoZWNrU2ltcGxlRXhwcmVzc2lvbihhc3QpO1xuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYEhvc3QgYmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluICR7ZXJyb3JzLmpvaW4oJyAnKX1gLCBpbnB1dCwgbG9jYXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoYXN0LCBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihtZXNzYWdlOiBzdHJpbmcsIGlucHV0OiBzdHJpbmcsIGVyckxvY2F0aW9uOiBzdHJpbmcsIGN0eExvY2F0aW9uPzogc3RyaW5nKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VyRXJyb3IobWVzc2FnZSwgaW5wdXQsIGVyckxvY2F0aW9uLCBjdHhMb2NhdGlvbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VCaW5kaW5nQXN0KFxuICAgICAgaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcpOiBBU1Qge1xuICAgIC8vIFF1b3RlcyBleHByZXNzaW9ucyB1c2UgM3JkLXBhcnR5IGV4cHJlc3Npb24gbGFuZ3VhZ2UuIFdlIGRvbid0IHdhbnQgdG8gdXNlXG4gICAgLy8gb3VyIGxleGVyIG9yIHBhcnNlciBmb3IgdGhhdCwgc28gd2UgY2hlY2sgZm9yIHRoYXQgYWhlYWQgb2YgdGltZS5cbiAgICBjb25zdCBxdW90ZSA9IHRoaXMuX3BhcnNlUXVvdGUoaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG5cbiAgICBpZiAocXVvdGUgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHF1b3RlO1xuICAgIH1cblxuICAgIHRoaXMuX2NoZWNrTm9JbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgY29uc3Qgc291cmNlVG9MZXggPSB0aGlzLl9zdHJpcENvbW1lbnRzKGlucHV0KTtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZShzb3VyY2VUb0xleCk7XG4gICAgcmV0dXJuIG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgZmFsc2UsIHRoaXMuZXJyb3JzLFxuICAgICAgICAgICAgICAgaW5wdXQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKVxuICAgICAgICAucGFyc2VDaGFpbigpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VRdW90ZShpbnB1dDogc3RyaW5nfG51bGwsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIpOiBBU1R8bnVsbCB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHByZWZpeFNlcGFyYXRvckluZGV4ID0gaW5wdXQuaW5kZXhPZignOicpO1xuICAgIGlmIChwcmVmaXhTZXBhcmF0b3JJbmRleCA9PSAtMSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcHJlZml4ID0gaW5wdXQuc3Vic3RyaW5nKDAsIHByZWZpeFNlcGFyYXRvckluZGV4KS50cmltKCk7XG4gICAgaWYgKCFpc0lkZW50aWZpZXIocHJlZml4KSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24gPSBpbnB1dC5zdWJzdHJpbmcocHJlZml4U2VwYXJhdG9ySW5kZXggKyAxKTtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU3BhbigwLCBpbnB1dC5sZW5ndGgpO1xuICAgIHJldHVybiBuZXcgUXVvdGUoXG4gICAgICAgIHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHByZWZpeCwgdW5pbnRlcnByZXRlZEV4cHJlc3Npb24sIGxvY2F0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBtaWNyb3N5bnRheCB0ZW1wbGF0ZSBleHByZXNzaW9uIGFuZCByZXR1cm4gYSBsaXN0IG9mIGJpbmRpbmdzIG9yXG4gICAqIHBhcnNpbmcgZXJyb3JzIGluIGNhc2UgdGhlIGdpdmVuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgIDxkaXYgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXNcIj5cbiAgICogICAgICAgICBeICAgICAgXiBhYnNvbHV0ZVZhbHVlT2Zmc2V0IGZvciBgdGVtcGxhdGVWYWx1ZWBcbiAgICogICAgICAgICBhYnNvbHV0ZUtleU9mZnNldCBmb3IgYHRlbXBsYXRlS2V5YFxuICAgKiBgYGBcbiAgICogY29udGFpbnMgdGhyZWUgYmluZGluZ3M6XG4gICAqIDEuIG5nRm9yIC0+IG51bGxcbiAgICogMi4gaXRlbSAtPiBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRcbiAgICogMy4gbmdGb3JPZiAtPiBpdGVtc1xuICAgKlxuICAgKiBUaGlzIGlzIGFwcGFyZW50IGZyb20gdGhlIGRlLXN1Z2FyZWQgdGVtcGxhdGU6XG4gICAqIGBgYFxuICAgKiAgIDxuZy10ZW1wbGF0ZSBuZ0ZvciBsZXQtaXRlbSBbbmdGb3JPZl09XCJpdGVtc1wiPlxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlS2V5IG5hbWUgb2YgZGlyZWN0aXZlLCB3aXRob3V0IHRoZSAqIHByZWZpeC4gRm9yIGV4YW1wbGU6IG5nSWYsIG5nRm9yXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZVZhbHVlIFJIUyBvZiB0aGUgbWljcm9zeW50YXggYXR0cmlidXRlXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZVVybCB0ZW1wbGF0ZSBmaWxlbmFtZSBpZiBpdCdzIGV4dGVybmFsLCBjb21wb25lbnQgZmlsZW5hbWUgaWYgaXQncyBpbmxpbmVcbiAgICogQHBhcmFtIGFic29sdXRlS2V5T2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdGVtcGxhdGVLZXlgXG4gICAqIEBwYXJhbSBhYnNvbHV0ZVZhbHVlT2Zmc2V0IHN0YXJ0IG9mIHRoZSBgdGVtcGxhdGVWYWx1ZWBcbiAgICovXG4gIHBhcnNlVGVtcGxhdGVCaW5kaW5ncyhcbiAgICAgIHRlbXBsYXRlS2V5OiBzdHJpbmcsIHRlbXBsYXRlVmFsdWU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZywgYWJzb2x1dGVLZXlPZmZzZXQ6IG51bWJlcixcbiAgICAgIGFic29sdXRlVmFsdWVPZmZzZXQ6IG51bWJlcik6IFRlbXBsYXRlQmluZGluZ1BhcnNlUmVzdWx0IHtcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLl9sZXhlci50b2tlbml6ZSh0ZW1wbGF0ZVZhbHVlKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgX1BhcnNlQVNUKFxuICAgICAgICB0ZW1wbGF0ZVZhbHVlLCB0ZW1wbGF0ZVVybCwgYWJzb2x1dGVWYWx1ZU9mZnNldCwgdG9rZW5zLCB0ZW1wbGF0ZVZhbHVlLmxlbmd0aCxcbiAgICAgICAgZmFsc2UgLyogcGFyc2VBY3Rpb24gKi8sIHRoaXMuZXJyb3JzLCAwIC8qIHJlbGF0aXZlIG9mZnNldCAqLyk7XG4gICAgcmV0dXJuIHBhcnNlci5wYXJzZVRlbXBsYXRlQmluZGluZ3Moe1xuICAgICAgc291cmNlOiB0ZW1wbGF0ZUtleSxcbiAgICAgIHNwYW46IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oYWJzb2x1dGVLZXlPZmZzZXQsIGFic29sdXRlS2V5T2Zmc2V0ICsgdGVtcGxhdGVLZXkubGVuZ3RoKSxcbiAgICB9KTtcbiAgfVxuXG4gIHBhcnNlSW50ZXJwb2xhdGlvbihcbiAgICAgIGlucHV0OiBzdHJpbmcsIGxvY2F0aW9uOiBzdHJpbmcsIGFic29sdXRlT2Zmc2V0OiBudW1iZXIsXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgY29uc3Qge3N0cmluZ3MsIGV4cHJlc3Npb25zLCBvZmZzZXRzfSA9XG4gICAgICAgIHRoaXMuc3BsaXRJbnRlcnBvbGF0aW9uKGlucHV0LCBsb2NhdGlvbiwgaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gICAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBleHByZXNzaW9uTm9kZXM6IEFTVFtdID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHJlc3Npb25zLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBleHByZXNzaW9uVGV4dCA9IGV4cHJlc3Npb25zW2ldLnRleHQ7XG4gICAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoZXhwcmVzc2lvblRleHQpO1xuICAgICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUoc291cmNlVG9MZXgpO1xuICAgICAgY29uc3QgYXN0ID0gbmV3IF9QYXJzZUFTVChcbiAgICAgICAgICAgICAgICAgICAgICBpbnB1dCwgbG9jYXRpb24sIGFic29sdXRlT2Zmc2V0LCB0b2tlbnMsIHNvdXJjZVRvTGV4Lmxlbmd0aCwgZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcnMsIG9mZnNldHNbaV0gKyAoZXhwcmVzc2lvblRleHQubGVuZ3RoIC0gc291cmNlVG9MZXgubGVuZ3RoKSlcbiAgICAgICAgICAgICAgICAgICAgICAucGFyc2VDaGFpbigpO1xuICAgICAgZXhwcmVzc2lvbk5vZGVzLnB1c2goYXN0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jcmVhdGVJbnRlcnBvbGF0aW9uQXN0KFxuICAgICAgICBzdHJpbmdzLm1hcChzID0+IHMudGV4dCksIGV4cHJlc3Npb25Ob2RlcywgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG4gIH1cblxuICAvKipcbiAgICogU2ltaWxhciB0byBgcGFyc2VJbnRlcnBvbGF0aW9uYCwgYnV0IHRyZWF0cyB0aGUgcHJvdmlkZWQgc3RyaW5nIGFzIGEgc2luZ2xlIGV4cHJlc3Npb25cbiAgICogZWxlbWVudCB0aGF0IHdvdWxkIG5vcm1hbGx5IGFwcGVhciB3aXRoaW4gdGhlIGludGVycG9sYXRpb24gcHJlZml4IGFuZCBzdWZmaXggKGB7e2AgYW5kIGB9fWApLlxuICAgKiBUaGlzIGlzIHVzZWQgZm9yIHBhcnNpbmcgdGhlIHN3aXRjaCBleHByZXNzaW9uIGluIElDVXMuXG4gICAqL1xuICBwYXJzZUludGVycG9sYXRpb25FeHByZXNzaW9uKGV4cHJlc3Npb246IHN0cmluZywgbG9jYXRpb246IHN0cmluZywgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6XG4gICAgICBBU1RXaXRoU291cmNlIHtcbiAgICBjb25zdCBzb3VyY2VUb0xleCA9IHRoaXMuX3N0cmlwQ29tbWVudHMoZXhwcmVzc2lvbik7XG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5fbGV4ZXIudG9rZW5pemUoc291cmNlVG9MZXgpO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBfUGFyc2VBU1QoXG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb24sIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdG9rZW5zLCBzb3VyY2VUb0xleC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIC8qIHBhcnNlQWN0aW9uICovIGZhbHNlLCB0aGlzLmVycm9ycywgMClcbiAgICAgICAgICAgICAgICAgICAgLnBhcnNlQ2hhaW4oKTtcbiAgICBjb25zdCBzdHJpbmdzID0gWycnLCAnJ107ICAvLyBUaGUgcHJlZml4IGFuZCBzdWZmaXggc3RyaW5ncyBhcmUgYm90aCBlbXB0eVxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUludGVycG9sYXRpb25Bc3Qoc3RyaW5ncywgW2FzdF0sIGV4cHJlc3Npb24sIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUludGVycG9sYXRpb25Bc3QoXG4gICAgICBzdHJpbmdzOiBzdHJpbmdbXSwgZXhwcmVzc2lvbnM6IEFTVFtdLCBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcik6IEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0Lmxlbmd0aCk7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbiA9XG4gICAgICAgIG5ldyBJbnRlcnBvbGF0aW9uKHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIHN0cmluZ3MsIGV4cHJlc3Npb25zKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoaW50ZXJwb2xhdGlvbiwgaW5wdXQsIGxvY2F0aW9uLCBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNwbGl0cyBhIHN0cmluZyBvZiB0ZXh0IGludG8gXCJyYXdcIiB0ZXh0IHNlZ21lbnRzIGFuZCBleHByZXNzaW9ucyBwcmVzZW50IGluIGludGVycG9sYXRpb25zIGluXG4gICAqIHRoZSBzdHJpbmcuXG4gICAqIFJldHVybnMgYG51bGxgIGlmIHRoZXJlIGFyZSBubyBpbnRlcnBvbGF0aW9ucywgb3RoZXJ3aXNlIGFcbiAgICogYFNwbGl0SW50ZXJwb2xhdGlvbmAgd2l0aCBzcGxpdHMgdGhhdCBsb29rIGxpa2VcbiAgICogICA8cmF3IHRleHQ+IDxleHByZXNzaW9uPiA8cmF3IHRleHQ+IC4uLiA8cmF3IHRleHQ+IDxleHByZXNzaW9uPiA8cmF3IHRleHQ+XG4gICAqL1xuICBzcGxpdEludGVycG9sYXRpb24oXG4gICAgICBpbnB1dDogc3RyaW5nLCBsb2NhdGlvbjogc3RyaW5nLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBTcGxpdEludGVycG9sYXRpb24ge1xuICAgIGNvbnN0IHN0cmluZ3M6IEludGVycG9sYXRpb25QaWVjZVtdID0gW107XG4gICAgY29uc3QgZXhwcmVzc2lvbnM6IEludGVycG9sYXRpb25QaWVjZVtdID0gW107XG4gICAgY29uc3Qgb2Zmc2V0czogbnVtYmVyW10gPSBbXTtcbiAgICBsZXQgaSA9IDA7XG4gICAgbGV0IGF0SW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgIGxldCBleHRlbmRMYXN0U3RyaW5nID0gZmFsc2U7XG4gICAgbGV0IHtzdGFydDogaW50ZXJwU3RhcnQsIGVuZDogaW50ZXJwRW5kfSA9IGludGVycG9sYXRpb25Db25maWc7XG4gICAgd2hpbGUgKGkgPCBpbnB1dC5sZW5ndGgpIHtcbiAgICAgIGlmICghYXRJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIC8vIHBhcnNlIHVudGlsIHN0YXJ0aW5nIHt7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gaTtcbiAgICAgICAgaSA9IGlucHV0LmluZGV4T2YoaW50ZXJwU3RhcnQsIGkpO1xuICAgICAgICBpZiAoaSA9PT0gLTEpIHtcbiAgICAgICAgICBpID0gaW5wdXQubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRleHQgPSBpbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGkpO1xuICAgICAgICBzdHJpbmdzLnB1c2goe3RleHQsIHN0YXJ0LCBlbmQ6IGl9KTtcblxuICAgICAgICBhdEludGVycG9sYXRpb24gPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gcGFyc2UgZnJvbSBzdGFydGluZyB7eyB0byBlbmRpbmcgfX0gd2hpbGUgaWdub3JpbmcgY29udGVudCBpbnNpZGUgcXVvdGVzLlxuICAgICAgICBjb25zdCBmdWxsU3RhcnQgPSBpO1xuICAgICAgICBjb25zdCBleHByU3RhcnQgPSBmdWxsU3RhcnQgKyBpbnRlcnBTdGFydC5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGV4cHJFbmQgPSB0aGlzLl9nZXRJbnRlcnBvbGF0aW9uRW5kSW5kZXgoaW5wdXQsIGludGVycEVuZCwgZXhwclN0YXJ0KTtcbiAgICAgICAgaWYgKGV4cHJFbmQgPT09IC0xKSB7XG4gICAgICAgICAgLy8gQ291bGQgbm90IGZpbmQgdGhlIGVuZCBvZiB0aGUgaW50ZXJwb2xhdGlvbjsgZG8gbm90IHBhcnNlIGFuIGV4cHJlc3Npb24uXG4gICAgICAgICAgLy8gSW5zdGVhZCB3ZSBzaG91bGQgZXh0ZW5kIHRoZSBjb250ZW50IG9uIHRoZSBsYXN0IHJhdyBzdHJpbmcuXG4gICAgICAgICAgYXRJbnRlcnBvbGF0aW9uID0gZmFsc2U7XG4gICAgICAgICAgZXh0ZW5kTGFzdFN0cmluZyA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVsbEVuZCA9IGV4cHJFbmQgKyBpbnRlcnBFbmQubGVuZ3RoO1xuXG4gICAgICAgIGNvbnN0IHRleHQgPSBpbnB1dC5zdWJzdHJpbmcoZXhwclN0YXJ0LCBleHByRW5kKTtcbiAgICAgICAgaWYgKHRleHQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICAnQmxhbmsgZXhwcmVzc2lvbnMgYXJlIG5vdCBhbGxvd2VkIGluIGludGVycG9sYXRlZCBzdHJpbmdzJywgaW5wdXQsXG4gICAgICAgICAgICAgIGBhdCBjb2x1bW4gJHtpfSBpbmAsIGxvY2F0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBleHByZXNzaW9ucy5wdXNoKHt0ZXh0LCBzdGFydDogZnVsbFN0YXJ0LCBlbmQ6IGZ1bGxFbmR9KTtcbiAgICAgICAgb2Zmc2V0cy5wdXNoKGV4cHJTdGFydCk7XG5cbiAgICAgICAgaSA9IGZ1bGxFbmQ7XG4gICAgICAgIGF0SW50ZXJwb2xhdGlvbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWF0SW50ZXJwb2xhdGlvbikge1xuICAgICAgLy8gSWYgd2UgYXJlIG5vdyBhdCBhIHRleHQgc2VjdGlvbiwgYWRkIHRoZSByZW1haW5pbmcgY29udGVudCBhcyBhIHJhdyBzdHJpbmcuXG4gICAgICBpZiAoZXh0ZW5kTGFzdFN0cmluZykge1xuICAgICAgICBjb25zdCBwaWVjZSA9IHN0cmluZ3Nbc3RyaW5ncy5sZW5ndGggLSAxXTtcbiAgICAgICAgcGllY2UudGV4dCArPSBpbnB1dC5zdWJzdHJpbmcoaSk7XG4gICAgICAgIHBpZWNlLmVuZCA9IGlucHV0Lmxlbmd0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0cmluZ3MucHVzaCh7dGV4dDogaW5wdXQuc3Vic3RyaW5nKGkpLCBzdGFydDogaSwgZW5kOiBpbnB1dC5sZW5ndGh9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTcGxpdEludGVycG9sYXRpb24oc3RyaW5ncywgZXhwcmVzc2lvbnMsIG9mZnNldHMpO1xuICB9XG5cbiAgd3JhcExpdGVyYWxQcmltaXRpdmUoaW5wdXQ6IHN0cmluZ3xudWxsLCBsb2NhdGlvbjogc3RyaW5nLCBhYnNvbHV0ZU9mZnNldDogbnVtYmVyKTpcbiAgICAgIEFTVFdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTcGFuKDAsIGlucHV0ID09IG51bGwgPyAwIDogaW5wdXQubGVuZ3RoKTtcbiAgICByZXR1cm4gbmV3IEFTVFdpdGhTb3VyY2UoXG4gICAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHNwYW4sIHNwYW4udG9BYnNvbHV0ZShhYnNvbHV0ZU9mZnNldCksIGlucHV0KSwgaW5wdXQsIGxvY2F0aW9uLFxuICAgICAgICBhYnNvbHV0ZU9mZnNldCwgdGhpcy5lcnJvcnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3RyaXBDb21tZW50cyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBpID0gdGhpcy5fY29tbWVudFN0YXJ0KGlucHV0KTtcbiAgICByZXR1cm4gaSAhPSBudWxsID8gaW5wdXQuc3Vic3RyaW5nKDAsIGkpLnRyaW0oKSA6IGlucHV0O1xuICB9XG5cbiAgcHJpdmF0ZSBfY29tbWVudFN0YXJ0KGlucHV0OiBzdHJpbmcpOiBudW1iZXJ8bnVsbCB7XG4gICAgbGV0IG91dGVyUXVvdGU6IG51bWJlcnxudWxsID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgY29uc3QgY2hhciA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG4gICAgICBjb25zdCBuZXh0Q2hhciA9IGlucHV0LmNoYXJDb2RlQXQoaSArIDEpO1xuXG4gICAgICBpZiAoY2hhciA9PT0gY2hhcnMuJFNMQVNIICYmIG5leHRDaGFyID09IGNoYXJzLiRTTEFTSCAmJiBvdXRlclF1b3RlID09IG51bGwpIHJldHVybiBpO1xuXG4gICAgICBpZiAob3V0ZXJRdW90ZSA9PT0gY2hhcikge1xuICAgICAgICBvdXRlclF1b3RlID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAob3V0ZXJRdW90ZSA9PSBudWxsICYmIGNoYXJzLmlzUXVvdGUoY2hhcikpIHtcbiAgICAgICAgb3V0ZXJRdW90ZSA9IGNoYXI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfY2hlY2tOb0ludGVycG9sYXRpb24oaW5wdXQ6IHN0cmluZywgbG9jYXRpb246IHN0cmluZywge3N0YXJ0LCBlbmR9OiBJbnRlcnBvbGF0aW9uQ29uZmlnKTpcbiAgICAgIHZvaWQge1xuICAgIGxldCBzdGFydEluZGV4ID0gLTE7XG4gICAgbGV0IGVuZEluZGV4ID0gLTE7XG5cbiAgICBmb3IgKGNvbnN0IGNoYXJJbmRleCBvZiB0aGlzLl9mb3JFYWNoVW5xdW90ZWRDaGFyKGlucHV0LCAwKSkge1xuICAgICAgaWYgKHN0YXJ0SW5kZXggPT09IC0xKSB7XG4gICAgICAgIGlmIChpbnB1dC5zdGFydHNXaXRoKHN0YXJ0KSkge1xuICAgICAgICAgIHN0YXJ0SW5kZXggPSBjaGFySW5kZXg7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVuZEluZGV4ID0gdGhpcy5fZ2V0SW50ZXJwb2xhdGlvbkVuZEluZGV4KGlucHV0LCBlbmQsIGNoYXJJbmRleCk7XG4gICAgICAgIGlmIChlbmRJbmRleCA+IC0xKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3RhcnRJbmRleCA+IC0xICYmIGVuZEluZGV4ID4gLTEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBHb3QgaW50ZXJwb2xhdGlvbiAoJHtzdGFydH0ke2VuZH0pIHdoZXJlIGV4cHJlc3Npb24gd2FzIGV4cGVjdGVkYCwgaW5wdXQsXG4gICAgICAgICAgYGF0IGNvbHVtbiAke3N0YXJ0SW5kZXh9IGluYCwgbG9jYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgaW5kZXggb2YgdGhlIGVuZCBvZiBhbiBpbnRlcnBvbGF0aW9uIGV4cHJlc3Npb25cbiAgICogd2hpbGUgaWdub3JpbmcgY29tbWVudHMgYW5kIHF1b3RlZCBjb250ZW50LlxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0SW50ZXJwb2xhdGlvbkVuZEluZGV4KGlucHV0OiBzdHJpbmcsIGV4cHJlc3Npb25FbmQ6IHN0cmluZywgc3RhcnQ6IG51bWJlcik6IG51bWJlciB7XG4gICAgZm9yIChjb25zdCBjaGFySW5kZXggb2YgdGhpcy5fZm9yRWFjaFVucXVvdGVkQ2hhcihpbnB1dCwgc3RhcnQpKSB7XG4gICAgICBpZiAoaW5wdXQuc3RhcnRzV2l0aChleHByZXNzaW9uRW5kLCBjaGFySW5kZXgpKSB7XG4gICAgICAgIHJldHVybiBjaGFySW5kZXg7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGhpbmcgZWxzZSBpbiB0aGUgZXhwcmVzc2lvbiBtYXR0ZXJzIGFmdGVyIHdlJ3ZlXG4gICAgICAvLyBoaXQgYSBjb21tZW50IHNvIGxvb2sgZGlyZWN0bHkgZm9yIHRoZSBlbmQgdG9rZW4uXG4gICAgICBpZiAoaW5wdXQuc3RhcnRzV2l0aCgnLy8nLCBjaGFySW5kZXgpKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5pbmRleE9mKGV4cHJlc3Npb25FbmQsIGNoYXJJbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRvciB1c2VkIHRvIGl0ZXJhdGUgb3ZlciB0aGUgY2hhcmFjdGVyIGluZGV4ZXMgb2YgYSBzdHJpbmcgdGhhdCBhcmUgb3V0c2lkZSBvZiBxdW90ZXMuXG4gICAqIEBwYXJhbSBpbnB1dCBTdHJpbmcgdG8gbG9vcCB0aHJvdWdoLlxuICAgKiBAcGFyYW0gc3RhcnQgSW5kZXggd2l0aGluIHRoZSBzdHJpbmcgYXQgd2hpY2ggdG8gc3RhcnQuXG4gICAqL1xuICBwcml2YXRlICogX2ZvckVhY2hVbnF1b3RlZENoYXIoaW5wdXQ6IHN0cmluZywgc3RhcnQ6IG51bWJlcikge1xuICAgIGxldCBjdXJyZW50UXVvdGU6IHN0cmluZ3xudWxsID0gbnVsbDtcbiAgICBsZXQgZXNjYXBlQ291bnQgPSAwO1xuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjaGFyID0gaW5wdXRbaV07XG4gICAgICAvLyBTa2lwIHRoZSBjaGFyYWN0ZXJzIGluc2lkZSBxdW90ZXMuIE5vdGUgdGhhdCB3ZSBvbmx5IGNhcmUgYWJvdXQgdGhlIG91dGVyLW1vc3RcbiAgICAgIC8vIHF1b3RlcyBtYXRjaGluZyB1cCBhbmQgd2UgbmVlZCB0byBhY2NvdW50IGZvciBlc2NhcGUgY2hhcmFjdGVycy5cbiAgICAgIGlmIChjaGFycy5pc1F1b3RlKGlucHV0LmNoYXJDb2RlQXQoaSkpICYmIChjdXJyZW50UXVvdGUgPT09IG51bGwgfHwgY3VycmVudFF1b3RlID09PSBjaGFyKSAmJlxuICAgICAgICAgIGVzY2FwZUNvdW50ICUgMiA9PT0gMCkge1xuICAgICAgICBjdXJyZW50UXVvdGUgPSBjdXJyZW50UXVvdGUgPT09IG51bGwgPyBjaGFyIDogbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoY3VycmVudFF1b3RlID09PSBudWxsKSB7XG4gICAgICAgIHlpZWxkIGk7XG4gICAgICB9XG4gICAgICBlc2NhcGVDb3VudCA9IGNoYXIgPT09ICdcXFxcJyA/IGVzY2FwZUNvdW50ICsgMSA6IDA7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJdnlQYXJzZXIgZXh0ZW5kcyBQYXJzZXIge1xuICBvdmVycmlkZSBzaW1wbGVFeHByZXNzaW9uQ2hlY2tlciA9IEl2eVNpbXBsZUV4cHJlc3Npb25DaGVja2VyO1xufVxuXG4vKiogRGVzY3JpYmVzIGEgc3RhdGVmdWwgY29udGV4dCBhbiBleHByZXNzaW9uIHBhcnNlciBpcyBpbi4gKi9cbmVudW0gUGFyc2VDb250ZXh0RmxhZ3Mge1xuICBOb25lID0gMCxcbiAgLyoqXG4gICAqIEEgV3JpdGFibGUgY29udGV4dCBpcyBvbmUgaW4gd2hpY2ggYSB2YWx1ZSBtYXkgYmUgd3JpdHRlbiB0byBhbiBsdmFsdWUuXG4gICAqIEZvciBleGFtcGxlLCBhZnRlciB3ZSBzZWUgYSBwcm9wZXJ0eSBhY2Nlc3MsIHdlIG1heSBleHBlY3QgYSB3cml0ZSB0byB0aGVcbiAgICogcHJvcGVydHkgdmlhIHRoZSBcIj1cIiBvcGVyYXRvci5cbiAgICogICBwcm9wXG4gICAqICAgICAgICBeIHBvc3NpYmxlIFwiPVwiIGFmdGVyXG4gICAqL1xuICBXcml0YWJsZSA9IDEsXG59XG5cbmV4cG9ydCBjbGFzcyBfUGFyc2VBU1Qge1xuICBwcml2YXRlIHJwYXJlbnNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgcmJyYWNrZXRzRXhwZWN0ZWQgPSAwO1xuICBwcml2YXRlIHJicmFjZXNFeHBlY3RlZCA9IDA7XG4gIHByaXZhdGUgY29udGV4dCA9IFBhcnNlQ29udGV4dEZsYWdzLk5vbmU7XG5cbiAgLy8gQ2FjaGUgb2YgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZWNlcyB0byB0aGUgYWJzb2x1dGUgc291cmNlIHNwYW4gdGhleSBtYXAgdG8sIHVzZWQgdG9cbiAgLy8gcHJldmVudCBjcmVhdGluZyBzdXBlcmZsdW91cyBzb3VyY2Ugc3BhbnMgaW4gYHNvdXJjZVNwYW5gLlxuICAvLyBBIHNlcmlhbCBvZiB0aGUgZXhwcmVzc2lvbiBzdGFydCBhbmQgaW5wdXQgaW5kZXggaXMgdXNlZCBmb3IgbWFwcGluZyBiZWNhdXNlIGJvdGggYXJlIHN0YXRlZnVsXG4gIC8vIGFuZCBtYXkgY2hhbmdlIGZvciBzdWJzZXF1ZW50IGV4cHJlc3Npb25zIHZpc2l0ZWQgYnkgdGhlIHBhcnNlci5cbiAgcHJpdmF0ZSBzb3VyY2VTcGFuQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQWJzb2x1dGVTb3VyY2VTcGFuPigpO1xuXG4gIGluZGV4OiBudW1iZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGlucHV0OiBzdHJpbmcsIHB1YmxpYyBsb2NhdGlvbjogc3RyaW5nLCBwdWJsaWMgYWJzb2x1dGVPZmZzZXQ6IG51bWJlcixcbiAgICAgIHB1YmxpYyB0b2tlbnM6IFRva2VuW10sIHB1YmxpYyBpbnB1dExlbmd0aDogbnVtYmVyLCBwdWJsaWMgcGFyc2VBY3Rpb246IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGVycm9yczogUGFyc2VyRXJyb3JbXSwgcHJpdmF0ZSBvZmZzZXQ6IG51bWJlcikge31cblxuICBwZWVrKG9mZnNldDogbnVtYmVyKTogVG9rZW4ge1xuICAgIGNvbnN0IGkgPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHJldHVybiBpIDwgdGhpcy50b2tlbnMubGVuZ3RoID8gdGhpcy50b2tlbnNbaV0gOiBFT0Y7XG4gIH1cblxuICBnZXQgbmV4dCgpOiBUb2tlbiB7XG4gICAgcmV0dXJuIHRoaXMucGVlaygwKTtcbiAgfVxuXG4gIC8qKiBXaGV0aGVyIGFsbCB0aGUgcGFyc2VyIGlucHV0IGhhcyBiZWVuIHByb2Nlc3NlZC4gKi9cbiAgZ2V0IGF0RU9GKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmluZGV4ID49IHRoaXMudG9rZW5zLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmRleCBvZiB0aGUgbmV4dCB0b2tlbiB0byBiZSBwcm9jZXNzZWQsIG9yIHRoZSBlbmQgb2YgdGhlIGxhc3QgdG9rZW4gaWYgYWxsIGhhdmUgYmVlblxuICAgKiBwcm9jZXNzZWQuXG4gICAqL1xuICBnZXQgaW5wdXRJbmRleCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmF0RU9GID8gdGhpcy5jdXJyZW50RW5kSW5kZXggOiB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmQgaW5kZXggb2YgdGhlIGxhc3QgcHJvY2Vzc2VkIHRva2VuLCBvciB0aGUgc3RhcnQgb2YgdGhlIGZpcnN0IHRva2VuIGlmIG5vbmUgaGF2ZSBiZWVuXG4gICAqIHByb2Nlc3NlZC5cbiAgICovXG4gIGdldCBjdXJyZW50RW5kSW5kZXgoKTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy5pbmRleCA+IDApIHtcbiAgICAgIGNvbnN0IGN1clRva2VuID0gdGhpcy5wZWVrKC0xKTtcbiAgICAgIHJldHVybiBjdXJUb2tlbi5lbmQgKyB0aGlzLm9mZnNldDtcbiAgICB9XG4gICAgLy8gTm8gdG9rZW5zIGhhdmUgYmVlbiBwcm9jZXNzZWQgeWV0OyByZXR1cm4gdGhlIG5leHQgdG9rZW4ncyBzdGFydCBvciB0aGUgbGVuZ3RoIG9mIHRoZSBpbnB1dFxuICAgIC8vIGlmIHRoZXJlIGlzIG5vIHRva2VuLlxuICAgIGlmICh0aGlzLnRva2Vucy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGlzLmlucHV0TGVuZ3RoICsgdGhpcy5vZmZzZXQ7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5leHQuaW5kZXggKyB0aGlzLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhYnNvbHV0ZSBvZmZzZXQgb2YgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHRva2VuLlxuICAgKi9cbiAgZ2V0IGN1cnJlbnRBYnNvbHV0ZU9mZnNldCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmFic29sdXRlT2Zmc2V0ICsgdGhpcy5pbnB1dEluZGV4O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGEgYFBhcnNlU3BhbmAgZnJvbSBgc3RhcnRgIHRvIHRoZSBjdXJyZW50IHBvc2l0aW9uIChvciB0byBgYXJ0aWZpY2lhbEVuZEluZGV4YCBpZlxuICAgKiBwcm92aWRlZCkuXG4gICAqXG4gICAqIEBwYXJhbSBzdGFydCBQb3NpdGlvbiBmcm9tIHdoaWNoIHRoZSBgUGFyc2VTcGFuYCB3aWxsIHN0YXJ0LlxuICAgKiBAcGFyYW0gYXJ0aWZpY2lhbEVuZEluZGV4IE9wdGlvbmFsIGVuZGluZyBpbmRleCB0byBiZSB1c2VkIGlmIHByb3ZpZGVkIChhbmQgaWYgZ3JlYXRlciB0aGFuIHRoZVxuICAgKiAgICAgbmF0dXJhbCBlbmRpbmcgaW5kZXgpXG4gICAqL1xuICBzcGFuKHN0YXJ0OiBudW1iZXIsIGFydGlmaWNpYWxFbmRJbmRleD86IG51bWJlcik6IFBhcnNlU3BhbiB7XG4gICAgbGV0IGVuZEluZGV4ID0gdGhpcy5jdXJyZW50RW5kSW5kZXg7XG4gICAgaWYgKGFydGlmaWNpYWxFbmRJbmRleCAhPT0gdW5kZWZpbmVkICYmIGFydGlmaWNpYWxFbmRJbmRleCA+IHRoaXMuY3VycmVudEVuZEluZGV4KSB7XG4gICAgICBlbmRJbmRleCA9IGFydGlmaWNpYWxFbmRJbmRleDtcbiAgICB9XG5cbiAgICAvLyBJbiBzb21lIHVudXN1YWwgcGFyc2luZyBzY2VuYXJpb3MgKGxpa2Ugd2hlbiBjZXJ0YWluIHRva2VucyBhcmUgbWlzc2luZyBhbmQgYW4gYEVtcHR5RXhwcmAgaXNcbiAgICAvLyBiZWluZyBjcmVhdGVkKSwgdGhlIGN1cnJlbnQgdG9rZW4gbWF5IGFscmVhZHkgYmUgYWR2YW5jZWQgYmV5b25kIHRoZSBgY3VycmVudEVuZEluZGV4YC4gVGhpc1xuICAgIC8vIGFwcGVhcnMgdG8gYmUgYSBkZWVwLXNlYXRlZCBwYXJzZXIgYnVnLlxuICAgIC8vXG4gICAgLy8gQXMgYSB3b3JrYXJvdW5kIGZvciBub3csIHN3YXAgdGhlIHN0YXJ0IGFuZCBlbmQgaW5kaWNlcyB0byBlbnN1cmUgYSB2YWxpZCBgUGFyc2VTcGFuYC5cbiAgICAvLyBUT0RPKGFseGh1Yik6IGZpeCB0aGUgYnVnIHVwc3RyZWFtIGluIHRoZSBwYXJzZXIgc3RhdGUsIGFuZCByZW1vdmUgdGhpcyB3b3JrYXJvdW5kLlxuICAgIGlmIChzdGFydCA+IGVuZEluZGV4KSB7XG4gICAgICBjb25zdCB0bXAgPSBlbmRJbmRleDtcbiAgICAgIGVuZEluZGV4ID0gc3RhcnQ7XG4gICAgICBzdGFydCA9IHRtcDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFBhcnNlU3BhbihzdGFydCwgZW5kSW5kZXgpO1xuICB9XG5cbiAgc291cmNlU3BhbihzdGFydDogbnVtYmVyLCBhcnRpZmljaWFsRW5kSW5kZXg/OiBudW1iZXIpOiBBYnNvbHV0ZVNvdXJjZVNwYW4ge1xuICAgIGNvbnN0IHNlcmlhbCA9IGAke3N0YXJ0fUAke3RoaXMuaW5wdXRJbmRleH06JHthcnRpZmljaWFsRW5kSW5kZXh9YDtcbiAgICBpZiAoIXRoaXMuc291cmNlU3BhbkNhY2hlLmhhcyhzZXJpYWwpKSB7XG4gICAgICB0aGlzLnNvdXJjZVNwYW5DYWNoZS5zZXQoXG4gICAgICAgICAgc2VyaWFsLCB0aGlzLnNwYW4oc3RhcnQsIGFydGlmaWNpYWxFbmRJbmRleCkudG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNvdXJjZVNwYW5DYWNoZS5nZXQoc2VyaWFsKSE7XG4gIH1cblxuICBhZHZhbmNlKCkge1xuICAgIHRoaXMuaW5kZXgrKztcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyBhIGNhbGxiYWNrIGluIHRoZSBwcm92aWRlZCBjb250ZXh0LlxuICAgKi9cbiAgcHJpdmF0ZSB3aXRoQ29udGV4dDxUPihjb250ZXh0OiBQYXJzZUNvbnRleHRGbGFncywgY2I6ICgpID0+IFQpOiBUIHtcbiAgICB0aGlzLmNvbnRleHQgfD0gY29udGV4dDtcbiAgICBjb25zdCByZXQgPSBjYigpO1xuICAgIHRoaXMuY29udGV4dCBePSBjb250ZXh0O1xuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICBjb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3Rlcihjb2RlKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHBlZWtLZXl3b3JkTGV0KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5leHQuaXNLZXl3b3JkTGV0KCk7XG4gIH1cbiAgcGVla0tleXdvcmRBcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5uZXh0LmlzS2V5d29yZEFzKCk7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3VtZXMgYW4gZXhwZWN0ZWQgY2hhcmFjdGVyLCBvdGhlcndpc2UgZW1pdHMgYW4gZXJyb3IgYWJvdXQgdGhlIG1pc3NpbmcgZXhwZWN0ZWQgY2hhcmFjdGVyXG4gICAqIGFuZCBza2lwcyBvdmVyIHRoZSB0b2tlbiBzdHJlYW0gdW50aWwgcmVhY2hpbmcgYSByZWNvdmVyYWJsZSBwb2ludC5cbiAgICpcbiAgICogU2VlIGB0aGlzLmVycm9yYCBhbmQgYHRoaXMuc2tpcGAgZm9yIG1vcmUgZGV0YWlscy5cbiAgICovXG4gIGV4cGVjdENoYXJhY3Rlcihjb2RlOiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY29kZSkpIHJldHVybjtcbiAgICB0aGlzLmVycm9yKGBNaXNzaW5nIGV4cGVjdGVkICR7U3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKX1gKTtcbiAgfVxuXG4gIGNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKG9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5uZXh0LmlzT3BlcmF0b3Iob3ApKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZXhwZWN0T3BlcmF0b3Iob3BlcmF0b3I6IHN0cmluZykge1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKG9wZXJhdG9yKSkgcmV0dXJuO1xuICAgIHRoaXMuZXJyb3IoYE1pc3NpbmcgZXhwZWN0ZWQgb3BlcmF0b3IgJHtvcGVyYXRvcn1gKTtcbiAgfVxuXG4gIHByZXR0eVByaW50VG9rZW4odG9rOiBUb2tlbik6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRvayA9PT0gRU9GID8gJ2VuZCBvZiBpbnB1dCcgOiBgdG9rZW4gJHt0b2t9YDtcbiAgfVxuXG4gIGV4cGVjdElkZW50aWZpZXJPcktleXdvcmQoKTogc3RyaW5nfG51bGwge1xuICAgIGNvbnN0IG4gPSB0aGlzLm5leHQ7XG4gICAgaWYgKCFuLmlzSWRlbnRpZmllcigpICYmICFuLmlzS2V5d29yZCgpKSB7XG4gICAgICBpZiAobi5pc1ByaXZhdGVJZGVudGlmaWVyKCkpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3JGb3JQcml2YXRlSWRlbnRpZmllcihuLCAnZXhwZWN0ZWQgaWRlbnRpZmllciBvciBrZXl3b3JkJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkICR7dGhpcy5wcmV0dHlQcmludFRva2VuKG4pfSwgZXhwZWN0ZWQgaWRlbnRpZmllciBvciBrZXl3b3JkYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG4udG9TdHJpbmcoKSBhcyBzdHJpbmc7XG4gIH1cblxuICBleHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTogc3RyaW5nIHtcbiAgICBjb25zdCBuID0gdGhpcy5uZXh0O1xuICAgIGlmICghbi5pc0lkZW50aWZpZXIoKSAmJiAhbi5pc0tleXdvcmQoKSAmJiAhbi5pc1N0cmluZygpKSB7XG4gICAgICBpZiAobi5pc1ByaXZhdGVJZGVudGlmaWVyKCkpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3JGb3JQcml2YXRlSWRlbnRpZmllcihuLCAnZXhwZWN0ZWQgaWRlbnRpZmllciwga2V5d29yZCBvciBzdHJpbmcnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZXJyb3IoXG4gICAgICAgICAgICBgVW5leHBlY3RlZCAke3RoaXMucHJldHR5UHJpbnRUb2tlbihuKX0sIGV4cGVjdGVkIGlkZW50aWZpZXIsIGtleXdvcmQsIG9yIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbi50b1N0cmluZygpIGFzIHN0cmluZztcbiAgfVxuXG4gIHBhcnNlQ2hhaW4oKTogQVNUIHtcbiAgICBjb25zdCBleHByczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgY29uc3QgZXhwciA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICBleHBycy5wdXNoKGV4cHIpO1xuXG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcignQmluZGluZyBleHByZXNzaW9uIGNhbm5vdCBjb250YWluIGNoYWluZWQgZXhwcmVzc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSkge1xuICAgICAgICB9ICAvLyByZWFkIGFsbCBzZW1pY29sb25zXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5lcnJvcihgVW5leHBlY3RlZCB0b2tlbiAnJHt0aGlzLm5leHR9J2ApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZXhwcnMubGVuZ3RoID09IDApIHtcbiAgICAgIC8vIFdlIGhhdmUgbm8gZXhwcmVzc2lvbnMgc28gY3JlYXRlIGFuIGVtcHR5IGV4cHJlc3Npb24gdGhhdCBzcGFucyB0aGUgZW50aXJlIGlucHV0IGxlbmd0aFxuICAgICAgY29uc3QgYXJ0aWZpY2lhbFN0YXJ0ID0gdGhpcy5vZmZzZXQ7XG4gICAgICBjb25zdCBhcnRpZmljaWFsRW5kID0gdGhpcy5vZmZzZXQgKyB0aGlzLmlucHV0TGVuZ3RoO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIoXG4gICAgICAgICAgdGhpcy5zcGFuKGFydGlmaWNpYWxTdGFydCwgYXJ0aWZpY2lhbEVuZCksXG4gICAgICAgICAgdGhpcy5zb3VyY2VTcGFuKGFydGlmaWNpYWxTdGFydCwgYXJ0aWZpY2lhbEVuZCkpO1xuICAgIH1cbiAgICBpZiAoZXhwcnMubGVuZ3RoID09IDEpIHJldHVybiBleHByc1swXTtcbiAgICByZXR1cm4gbmV3IENoYWluKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGV4cHJzKTtcbiAgfVxuXG4gIHBhcnNlUGlwZSgpOiBBU1Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCd8JykpIHtcbiAgICAgIGlmICh0aGlzLnBhcnNlQWN0aW9uKSB7XG4gICAgICAgIHRoaXMuZXJyb3IoJ0Nhbm5vdCBoYXZlIGEgcGlwZSBpbiBhbiBhY3Rpb24gZXhwcmVzc2lvbicpO1xuICAgICAgfVxuXG4gICAgICBkbyB7XG4gICAgICAgIGNvbnN0IG5hbWVTdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgICAgbGV0IG5hbWVJZCA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpO1xuICAgICAgICBsZXQgbmFtZVNwYW46IEFic29sdXRlU291cmNlU3BhbjtcbiAgICAgICAgbGV0IGZ1bGxTcGFuRW5kOiBudW1iZXJ8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgICBpZiAobmFtZUlkICE9PSBudWxsKSB7XG4gICAgICAgICAgbmFtZVNwYW4gPSB0aGlzLnNvdXJjZVNwYW4obmFtZVN0YXJ0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBObyB2YWxpZCBpZGVudGlmaWVyIHdhcyBmb3VuZCwgc28gd2UnbGwgYXNzdW1lIGFuIGVtcHR5IHBpcGUgbmFtZSAoJycpLlxuICAgICAgICAgIG5hbWVJZCA9ICcnO1xuXG4gICAgICAgICAgLy8gSG93ZXZlciwgdGhlcmUgbWF5IGhhdmUgYmVlbiB3aGl0ZXNwYWNlIHByZXNlbnQgYmV0d2VlbiB0aGUgcGlwZSBjaGFyYWN0ZXIgYW5kIHRoZSBuZXh0XG4gICAgICAgICAgLy8gdG9rZW4gaW4gdGhlIHNlcXVlbmNlIChvciB0aGUgZW5kIG9mIGlucHV0KS4gV2Ugd2FudCB0byB0cmFjayB0aGlzIHdoaXRlc3BhY2Ugc28gdGhhdFxuICAgICAgICAgIC8vIHRoZSBgQmluZGluZ1BpcGVgIHdlIHByb2R1Y2UgY292ZXJzIG5vdCBqdXN0IHRoZSBwaXBlIGNoYXJhY3RlciwgYnV0IGFueSB0cmFpbGluZ1xuICAgICAgICAgIC8vIHdoaXRlc3BhY2UgYmV5b25kIGl0LiBBbm90aGVyIHdheSBvZiB0aGlua2luZyBhYm91dCB0aGlzIGlzIHRoYXQgdGhlIHplcm8tbGVuZ3RoIG5hbWVcbiAgICAgICAgICAvLyBpcyBhc3N1bWVkIHRvIGJlIGF0IHRoZSBlbmQgb2YgYW55IHdoaXRlc3BhY2UgYmV5b25kIHRoZSBwaXBlIGNoYXJhY3Rlci5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFRoZXJlZm9yZSwgd2UgcHVzaCB0aGUgZW5kIG9mIHRoZSBgUGFyc2VTcGFuYCBmb3IgdGhpcyBwaXBlIGFsbCB0aGUgd2F5IHVwIHRvIHRoZVxuICAgICAgICAgIC8vIGJlZ2lubmluZyBvZiB0aGUgbmV4dCB0b2tlbiwgb3IgdW50aWwgdGhlIGVuZCBvZiBpbnB1dCBpZiB0aGUgbmV4dCB0b2tlbiBpcyBFT0YuXG4gICAgICAgICAgZnVsbFNwYW5FbmQgPSB0aGlzLm5leHQuaW5kZXggIT09IC0xID8gdGhpcy5uZXh0LmluZGV4IDogdGhpcy5pbnB1dExlbmd0aCArIHRoaXMub2Zmc2V0O1xuXG4gICAgICAgICAgLy8gVGhlIGBuYW1lU3BhbmAgZm9yIGFuIGVtcHR5IHBpcGUgbmFtZSBpcyB6ZXJvLWxlbmd0aCBhdCB0aGUgZW5kIG9mIGFueSB3aGl0ZXNwYWNlXG4gICAgICAgICAgLy8gYmV5b25kIHRoZSBwaXBlIGNoYXJhY3Rlci5cbiAgICAgICAgICBuYW1lU3BhbiA9IG5ldyBQYXJzZVNwYW4oZnVsbFNwYW5FbmQsIGZ1bGxTcGFuRW5kKS50b0Fic29sdXRlKHRoaXMuYWJzb2x1dGVPZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXJnczogQVNUW10gPSBbXTtcbiAgICAgICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgICBhcmdzLnB1c2godGhpcy5wYXJzZUV4cHJlc3Npb24oKSk7XG5cbiAgICAgICAgICAvLyBJZiB0aGVyZSBhcmUgYWRkaXRpb25hbCBleHByZXNzaW9ucyBiZXlvbmQgdGhlIG5hbWUsIHRoZW4gdGhlIGFydGlmaWNpYWwgZW5kIGZvciB0aGVcbiAgICAgICAgICAvLyBuYW1lIGlzIG5vIGxvbmdlciByZWxldmFudC5cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPSBuZXcgQmluZGluZ1BpcGUoXG4gICAgICAgICAgICB0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQsIGZ1bGxTcGFuRW5kKSwgcmVzdWx0LCBuYW1lSWQsIGFyZ3MsIG5hbWVTcGFuKTtcbiAgICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3wnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXhwcmVzc2lvbigpOiBBU1Qge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcbiAgfVxuXG4gIHBhcnNlQ29uZGl0aW9uYWwoKTogQVNUIHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlTG9naWNhbE9yKCk7XG5cbiAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPycpKSB7XG4gICAgICBjb25zdCB5ZXMgPSB0aGlzLnBhcnNlUGlwZSgpO1xuICAgICAgbGV0IG5vOiBBU1Q7XG4gICAgICBpZiAoIXRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT0xPTikpIHtcbiAgICAgICAgY29uc3QgZW5kID0gdGhpcy5pbnB1dEluZGV4O1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG4gICAgICAgIHRoaXMuZXJyb3IoYENvbmRpdGlvbmFsIGV4cHJlc3Npb24gJHtleHByZXNzaW9ufSByZXF1aXJlcyBhbGwgMyBleHByZXNzaW9uc2ApO1xuICAgICAgICBubyA9IG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBubyA9IHRoaXMucGFyc2VQaXBlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IENvbmRpdGlvbmFsKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgeWVzLCBubyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VMb2dpY2FsT3IoKTogQVNUIHtcbiAgICAvLyAnfHwnXG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG4gICAgd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJ3x8JykpIHtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKTtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgJ3x8JywgcmVzdWx0LCByaWdodCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxvZ2ljYWxBbmQoKTogQVNUIHtcbiAgICAvLyAnJiYnXG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VOdWxsaXNoQ29hbGVzY2luZygpO1xuICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCcmJicpKSB7XG4gICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VOdWxsaXNoQ29hbGVzY2luZygpO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnJiYnLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTnVsbGlzaENvYWxlc2NpbmcoKTogQVNUIHtcbiAgICAvLyAnPz8nXG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuICAgIHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc/PycpKSB7XG4gICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCAnPz8nLCByZXN1bHQsIHJpZ2h0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlRXF1YWxpdHkoKTogQVNUIHtcbiAgICAvLyAnPT0nLCchPScsJz09PScsJyE9PSdcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnPT0nOlxuICAgICAgICBjYXNlICc9PT0nOlxuICAgICAgICBjYXNlICchPSc6XG4gICAgICAgIGNhc2UgJyE9PSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSB0aGlzLnBhcnNlUmVsYXRpb25hbCgpO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZVJlbGF0aW9uYWwoKTogQVNUIHtcbiAgICAvLyAnPCcsICc+JywgJzw9JywgJz49J1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5pbnB1dEluZGV4O1xuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnNlQWRkaXRpdmUoKTtcbiAgICB3aGlsZSAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IHRoaXMubmV4dC5zdHJWYWx1ZTtcbiAgICAgIHN3aXRjaCAob3BlcmF0b3IpIHtcbiAgICAgICAgY2FzZSAnPCc6XG4gICAgICAgIGNhc2UgJz4nOlxuICAgICAgICBjYXNlICc8PSc6XG4gICAgICAgIGNhc2UgJz49JzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBjb25zdCByaWdodCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgb3BlcmF0b3IsIHJlc3VsdCwgcmlnaHQpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUFkZGl0aXZlKCk6IEFTVCB7XG4gICAgLy8gJysnLCAnLSdcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCk7XG4gICAgd2hpbGUgKHRoaXMubmV4dC50eXBlID09IFRva2VuVHlwZS5PcGVyYXRvcikge1xuICAgICAgY29uc3Qgb3BlcmF0b3IgPSB0aGlzLm5leHQuc3RyVmFsdWU7XG4gICAgICBzd2l0Y2ggKG9wZXJhdG9yKSB7XG4gICAgICAgIGNhc2UgJysnOlxuICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VNdWx0aXBsaWNhdGl2ZSgpOiBBU1Qge1xuICAgIC8vICcqJywgJyUnLCAnLydcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgIHdoaWxlICh0aGlzLm5leHQudHlwZSA9PSBUb2tlblR5cGUuT3BlcmF0b3IpIHtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcqJzpcbiAgICAgICAgY2FzZSAnJSc6XG4gICAgICAgIGNhc2UgJy8nOlxuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIGxldCByaWdodCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcbiAgICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG9wZXJhdG9yLCByZXN1bHQsIHJpZ2h0KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VQcmVmaXgoKTogQVNUIHtcbiAgICBpZiAodGhpcy5uZXh0LnR5cGUgPT0gVG9rZW5UeXBlLk9wZXJhdG9yKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgIGNvbnN0IG9wZXJhdG9yID0gdGhpcy5uZXh0LnN0clZhbHVlO1xuICAgICAgbGV0IHJlc3VsdDogQVNUO1xuICAgICAgc3dpdGNoIChvcGVyYXRvcikge1xuICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgcmV0dXJuIFVuYXJ5LmNyZWF0ZVBsdXModGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuICAgICAgICAgIHJldHVybiBVbmFyeS5jcmVhdGVNaW51cyh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZXN1bHQpO1xuICAgICAgICBjYXNlICchJzpcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcmVmaXhOb3QodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFyc2VDYWxsQ2hhaW4oKTtcbiAgfVxuXG4gIHBhcnNlQ2FsbENoYWluKCk6IEFTVCB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFyc2VQcmltYXJ5KCk7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kUEVSSU9EKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyT3JDYWxsKHJlc3VsdCwgc3RhcnQsIGZhbHNlKTtcblxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCc/LicpKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMQlJBQ0tFVCkgP1xuICAgICAgICAgICAgdGhpcy5wYXJzZUtleWVkUmVhZE9yV3JpdGUocmVzdWx0LCBzdGFydCwgdHJ1ZSkgOlxuICAgICAgICAgICAgdGhpcy5wYXJzZUFjY2Vzc01lbWJlck9yQ2FsbChyZXN1bHQsIHN0YXJ0LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnBhcnNlS2V5ZWRSZWFkT3JXcml0ZShyZXN1bHQsIHN0YXJ0LCBmYWxzZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICAgIGNvbnN0IGFyZ3VtZW50U3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnBhcnNlQ2FsbEFyZ3VtZW50cygpO1xuICAgICAgICBjb25zdCBhcmd1bWVudFNwYW4gPVxuICAgICAgICAgICAgdGhpcy5zcGFuKGFyZ3VtZW50U3RhcnQsIHRoaXMuaW5wdXRJbmRleCkudG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KTtcbiAgICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTik7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBDYWxsKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCwgYXJncywgYXJndW1lbnRTcGFuKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignIScpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBOb25OdWxsQXNzZXJ0KHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlc3VsdCk7XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcGFyc2VQcmltYXJ5KCk6IEFTVCB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRMUEFSRU4pKSB7XG4gICAgICB0aGlzLnJwYXJlbnNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkLS07XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUlBBUkVOKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmROdWxsKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIG51bGwpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkVW5kZWZpbmVkKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHZvaWQgMCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0tleXdvcmRUcnVlKCkpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHRydWUpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkRmFsc2UoKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgZmFsc2UpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNLZXl3b3JkVGhpcygpKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgVGhpc1JlY2VpdmVyKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJExCUkFDS0VUKSkge1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZCsrO1xuICAgICAgY29uc3QgZWxlbWVudHMgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbkxpc3QoY2hhcnMuJFJCUkFDS0VUKTtcbiAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxBcnJheSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBlbGVtZW50cyk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0NoYXJhY3RlcihjaGFycy4kTEJSQUNFKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VMaXRlcmFsTWFwKCk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc0lkZW50aWZpZXIoKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VBY2Nlc3NNZW1iZXJPckNhbGwoXG4gICAgICAgICAgbmV3IEltcGxpY2l0UmVjZWl2ZXIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSksIHN0YXJ0LCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHRoaXMubmV4dC5pc051bWJlcigpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRoaXMubmV4dC50b051bWJlcigpO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgdmFsdWUpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNTdHJpbmcoKSkge1xuICAgICAgY29uc3QgbGl0ZXJhbFZhbHVlID0gdGhpcy5uZXh0LnRvU3RyaW5nKCk7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCBsaXRlcmFsVmFsdWUpO1xuXG4gICAgfSBlbHNlIGlmICh0aGlzLm5leHQuaXNQcml2YXRlSWRlbnRpZmllcigpKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvckZvclByaXZhdGVJZGVudGlmaWVyKHRoaXMubmV4dCwgbnVsbCk7XG4gICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcblxuICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA+PSB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZXJyb3IoYFVuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb246ICR7dGhpcy5pbnB1dH1gKTtcbiAgICAgIHJldHVybiBuZXcgRW1wdHlFeHByKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVycm9yKGBVbmV4cGVjdGVkIHRva2VuICR7dGhpcy5uZXh0fWApO1xuICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VFeHByZXNzaW9uTGlzdCh0ZXJtaW5hdG9yOiBudW1iZXIpOiBBU1RbXSB7XG4gICAgY29uc3QgcmVzdWx0OiBBU1RbXSA9IFtdO1xuXG4gICAgZG8ge1xuICAgICAgaWYgKCF0aGlzLm5leHQuaXNDaGFyYWN0ZXIodGVybWluYXRvcikpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VMaXRlcmFsTWFwKCk6IExpdGVyYWxNYXAge1xuICAgIGNvbnN0IGtleXM6IExpdGVyYWxNYXBLZXlbXSA9IFtdO1xuICAgIGNvbnN0IHZhbHVlczogQVNUW10gPSBbXTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kTEJSQUNFKTtcbiAgICBpZiAoIXRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpKSB7XG4gICAgICB0aGlzLnJicmFjZXNFeHBlY3RlZCsrO1xuICAgICAgZG8ge1xuICAgICAgICBjb25zdCBrZXlTdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgICAgY29uc3QgcXVvdGVkID0gdGhpcy5uZXh0LmlzU3RyaW5nKCk7XG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZE9yU3RyaW5nKCk7XG4gICAgICAgIGtleXMucHVzaCh7a2V5LCBxdW90ZWR9KTtcblxuICAgICAgICAvLyBQcm9wZXJ0aWVzIHdpdGggcXVvdGVkIGtleXMgY2FuJ3QgdXNlIHRoZSBzaG9ydGhhbmQgc3ludGF4LlxuICAgICAgICBpZiAocXVvdGVkKSB7XG4gICAgICAgICAgdGhpcy5leHBlY3RDaGFyYWN0ZXIoY2hhcnMuJENPTE9OKTtcbiAgICAgICAgICB2YWx1ZXMucHVzaCh0aGlzLnBhcnNlUGlwZSgpKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pKSB7XG4gICAgICAgICAgdmFsdWVzLnB1c2godGhpcy5wYXJzZVBpcGUoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3Qgc3BhbiA9IHRoaXMuc3BhbihrZXlTdGFydCk7XG4gICAgICAgICAgY29uc3Qgc291cmNlU3BhbiA9IHRoaXMuc291cmNlU3BhbihrZXlTdGFydCk7XG4gICAgICAgICAgdmFsdWVzLnB1c2gobmV3IFByb3BlcnR5UmVhZChcbiAgICAgICAgICAgICAgc3Bhbiwgc291cmNlU3Bhbiwgc291cmNlU3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIoc3Bhbiwgc291cmNlU3BhbiksIGtleSkpO1xuICAgICAgICB9XG4gICAgICB9IHdoaWxlICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09NTUEpKTtcbiAgICAgIHRoaXMucmJyYWNlc0V4cGVjdGVkLS07XG4gICAgICB0aGlzLmV4cGVjdENoYXJhY3RlcihjaGFycy4kUkJSQUNFKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBMaXRlcmFsTWFwKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIGtleXMsIHZhbHVlcyk7XG4gIH1cblxuICBwYXJzZUFjY2Vzc01lbWJlck9yQ2FsbChyZWFkUmVjZWl2ZXI6IEFTVCwgc3RhcnQ6IG51bWJlciwgaXNTYWZlOiBib29sZWFuKTogQVNUIHtcbiAgICBjb25zdCBuYW1lU3RhcnQgPSB0aGlzLmlucHV0SW5kZXg7XG4gICAgY29uc3QgaWQgPSB0aGlzLndpdGhDb250ZXh0KFBhcnNlQ29udGV4dEZsYWdzLldyaXRhYmxlLCAoKSA9PiB7XG4gICAgICBjb25zdCBpZCA9IHRoaXMuZXhwZWN0SWRlbnRpZmllck9yS2V5d29yZCgpID8/ICcnO1xuICAgICAgaWYgKGlkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmVycm9yKGBFeHBlY3RlZCBpZGVudGlmaWVyIGZvciBwcm9wZXJ0eSBhY2Nlc3NgLCByZWFkUmVjZWl2ZXIuc3Bhbi5lbmQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGlkO1xuICAgIH0pO1xuICAgIGNvbnN0IG5hbWVTcGFuID0gdGhpcy5zb3VyY2VTcGFuKG5hbWVTdGFydCk7XG4gICAgbGV0IHJlY2VpdmVyOiBBU1Q7XG5cbiAgICBpZiAoaXNTYWZlKSB7XG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgIHRoaXMuZXJyb3IoJ1RoZSBcXCc/LlxcJyBvcGVyYXRvciBjYW5ub3QgYmUgdXNlZCBpbiB0aGUgYXNzaWdubWVudCcpO1xuICAgICAgICByZWNlaXZlciA9IG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWNlaXZlciA9IG5ldyBTYWZlUHJvcGVydHlSZWFkKFxuICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbmFtZVNwYW4sIHJlYWRSZWNlaXZlciwgaWQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgIGlmICghdGhpcy5wYXJzZUFjdGlvbikge1xuICAgICAgICAgIHRoaXMuZXJyb3IoJ0JpbmRpbmdzIGNhbm5vdCBjb250YWluIGFzc2lnbm1lbnRzJyk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBFbXB0eUV4cHIodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB2YWx1ZSA9IHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICAgICAgICByZWNlaXZlciA9IG5ldyBQcm9wZXJ0eVdyaXRlKFxuICAgICAgICAgICAgdGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbmFtZVNwYW4sIHJlYWRSZWNlaXZlciwgaWQsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlY2VpdmVyID1cbiAgICAgICAgICAgIG5ldyBQcm9wZXJ0eVJlYWQodGhpcy5zcGFuKHN0YXJ0KSwgdGhpcy5zb3VyY2VTcGFuKHN0YXJ0KSwgbmFtZVNwYW4sIHJlYWRSZWNlaXZlciwgaWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kTFBBUkVOKSkge1xuICAgICAgY29uc3QgYXJndW1lbnRTdGFydCA9IHRoaXMuaW5wdXRJbmRleDtcbiAgICAgIHRoaXMucnBhcmVuc0V4cGVjdGVkKys7XG4gICAgICBjb25zdCBhcmdzID0gdGhpcy5wYXJzZUNhbGxBcmd1bWVudHMoKTtcbiAgICAgIGNvbnN0IGFyZ3VtZW50U3BhbiA9XG4gICAgICAgICAgdGhpcy5zcGFuKGFyZ3VtZW50U3RhcnQsIHRoaXMuaW5wdXRJbmRleCkudG9BYnNvbHV0ZSh0aGlzLmFic29sdXRlT2Zmc2V0KTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSUEFSRU4pO1xuICAgICAgdGhpcy5ycGFyZW5zRXhwZWN0ZWQtLTtcbiAgICAgIGNvbnN0IHNwYW4gPSB0aGlzLnNwYW4oc3RhcnQpO1xuICAgICAgY29uc3Qgc291cmNlU3BhbiA9IHRoaXMuc291cmNlU3BhbihzdGFydCk7XG4gICAgICByZXR1cm4gbmV3IENhbGwoc3Bhbiwgc291cmNlU3BhbiwgcmVjZWl2ZXIsIGFyZ3MsIGFyZ3VtZW50U3Bhbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlY2VpdmVyO1xuICB9XG5cbiAgcGFyc2VDYWxsQXJndW1lbnRzKCk6IEJpbmRpbmdQaXBlW10ge1xuICAgIGlmICh0aGlzLm5leHQuaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikpIHJldHVybiBbXTtcbiAgICBjb25zdCBwb3NpdGlvbmFsczogQVNUW10gPSBbXTtcbiAgICBkbyB7XG4gICAgICBwb3NpdGlvbmFscy5wdXNoKHRoaXMucGFyc2VQaXBlKCkpO1xuICAgIH0gd2hpbGUgKHRoaXMuY29uc3VtZU9wdGlvbmFsQ2hhcmFjdGVyKGNoYXJzLiRDT01NQSkpO1xuICAgIHJldHVybiBwb3NpdGlvbmFscyBhcyBCaW5kaW5nUGlwZVtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbiBpZGVudGlmaWVyLCBhIGtleXdvcmQsIGEgc3RyaW5nIHdpdGggYW4gb3B0aW9uYWwgYC1gIGluIGJldHdlZW4sXG4gICAqIGFuZCByZXR1cm5zIHRoZSBzdHJpbmcgYWxvbmcgd2l0aCBpdHMgYWJzb2x1dGUgc291cmNlIHNwYW4uXG4gICAqL1xuICBleHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllciB7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGxldCBvcGVyYXRvckZvdW5kID0gZmFsc2U7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gdGhpcy5leHBlY3RJZGVudGlmaWVyT3JLZXl3b3JkT3JTdHJpbmcoKTtcbiAgICAgIG9wZXJhdG9yRm91bmQgPSB0aGlzLmNvbnN1bWVPcHRpb25hbE9wZXJhdG9yKCctJyk7XG4gICAgICBpZiAob3BlcmF0b3JGb3VuZCkge1xuICAgICAgICByZXN1bHQgKz0gJy0nO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKG9wZXJhdG9yRm91bmQpO1xuICAgIHJldHVybiB7XG4gICAgICBzb3VyY2U6IHJlc3VsdCxcbiAgICAgIHNwYW46IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oc3RhcnQsIHN0YXJ0ICsgcmVzdWx0Lmxlbmd0aCksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBtaWNyb3N5bnRheCB0ZW1wbGF0ZSBleHByZXNzaW9uIGFuZCByZXR1cm4gYSBsaXN0IG9mIGJpbmRpbmdzIG9yXG4gICAqIHBhcnNpbmcgZXJyb3JzIGluIGNhc2UgdGhlIGdpdmVuIGV4cHJlc3Npb24gaXMgaW52YWxpZC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgIDxkaXYgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXM7IGluZGV4IGFzIGk7IHRyYWNrQnk6IGZ1bmNcIj5cbiAgICogYGBgXG4gICAqIGNvbnRhaW5zIGZpdmUgYmluZGluZ3M6XG4gICAqIDEuIG5nRm9yIC0+IG51bGxcbiAgICogMi4gaXRlbSAtPiBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRcbiAgICogMy4gbmdGb3JPZiAtPiBpdGVtc1xuICAgKiA0LiBpIC0+IE5nRm9yT2ZDb250ZXh0LmluZGV4XG4gICAqIDUuIG5nRm9yVHJhY2tCeSAtPiBmdW5jXG4gICAqXG4gICAqIEZvciBhIGZ1bGwgZGVzY3JpcHRpb24gb2YgdGhlIG1pY3Jvc3ludGF4IGdyYW1tYXIsIHNlZVxuICAgKiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9taGV2ZXJ5L2QzNTMwMjk0Y2ZmMmU0YTFiM2ZlMTVmZjc1ZDA4ODU1XG4gICAqXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZUtleSBuYW1lIG9mIHRoZSBtaWNyb3N5bnRheCBkaXJlY3RpdmUsIGxpa2UgbmdJZiwgbmdGb3IsXG4gICAqIHdpdGhvdXQgdGhlICosIGFsb25nIHdpdGggaXRzIGFic29sdXRlIHNwYW4uXG4gICAqL1xuICBwYXJzZVRlbXBsYXRlQmluZGluZ3ModGVtcGxhdGVLZXk6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmdQYXJzZVJlc3VsdCB7XG4gICAgY29uc3QgYmluZGluZ3M6IFRlbXBsYXRlQmluZGluZ1tdID0gW107XG5cbiAgICAvLyBUaGUgZmlyc3QgYmluZGluZyBpcyBmb3IgdGhlIHRlbXBsYXRlIGtleSBpdHNlbGZcbiAgICAvLyBJbiAqbmdGb3I9XCJsZXQgaXRlbSBvZiBpdGVtc1wiLCBrZXkgPSBcIm5nRm9yXCIsIHZhbHVlID0gbnVsbFxuICAgIC8vIEluICpuZ0lmPVwiY29uZCB8IHBpcGVcIiwga2V5ID0gXCJuZ0lmXCIsIHZhbHVlID0gXCJjb25kIHwgcGlwZVwiXG4gICAgYmluZGluZ3MucHVzaCguLi50aGlzLnBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKHRlbXBsYXRlS2V5KSk7XG5cbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgLy8gSWYgaXQgc3RhcnRzIHdpdGggJ2xldCcsIHRoZW4gdGhpcyBtdXN0IGJlIHZhcmlhYmxlIGRlY2xhcmF0aW9uXG4gICAgICBjb25zdCBsZXRCaW5kaW5nID0gdGhpcy5wYXJzZUxldEJpbmRpbmcoKTtcbiAgICAgIGlmIChsZXRCaW5kaW5nKSB7XG4gICAgICAgIGJpbmRpbmdzLnB1c2gobGV0QmluZGluZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUd28gcG9zc2libGUgY2FzZXMgaGVyZSwgZWl0aGVyIGB2YWx1ZSBcImFzXCIga2V5YCBvclxuICAgICAgICAvLyBcImRpcmVjdGl2ZS1rZXl3b3JkIGV4cHJlc3Npb25cIi4gV2UgZG9uJ3Qga25vdyB3aGljaCBjYXNlLCBidXQgYm90aFxuICAgICAgICAvLyBcInZhbHVlXCIgYW5kIFwiZGlyZWN0aXZlLWtleXdvcmRcIiBhcmUgdGVtcGxhdGUgYmluZGluZyBrZXksIHNvIGNvbnN1bWVcbiAgICAgICAgLy8gdGhlIGtleSBmaXJzdC5cbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICAgICAgLy8gUGVlayBhdCB0aGUgbmV4dCB0b2tlbiwgaWYgaXQgaXMgXCJhc1wiIHRoZW4gdGhpcyBtdXN0IGJlIHZhcmlhYmxlXG4gICAgICAgIC8vIGRlY2xhcmF0aW9uLlxuICAgICAgICBjb25zdCBiaW5kaW5nID0gdGhpcy5wYXJzZUFzQmluZGluZyhrZXkpO1xuICAgICAgICBpZiAoYmluZGluZykge1xuICAgICAgICAgIGJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIHRoZSBrZXkgbXVzdCBiZSBhIGRpcmVjdGl2ZSBrZXl3b3JkLCBsaWtlIFwib2ZcIi4gVHJhbnNmb3JtXG4gICAgICAgICAgLy8gdGhlIGtleSB0byBhY3R1YWwga2V5LiBFZy4gb2YgLT4gbmdGb3JPZiwgdHJhY2tCeSAtPiBuZ0ZvclRyYWNrQnlcbiAgICAgICAgICBrZXkuc291cmNlID1cbiAgICAgICAgICAgICAgdGVtcGxhdGVLZXkuc291cmNlICsga2V5LnNvdXJjZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGtleS5zb3VyY2Uuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgIGJpbmRpbmdzLnB1c2goLi4udGhpcy5wYXJzZURpcmVjdGl2ZUtleXdvcmRCaW5kaW5ncyhrZXkpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5jb25zdW1lU3RhdGVtZW50VGVybWluYXRvcigpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVGVtcGxhdGVCaW5kaW5nUGFyc2VSZXN1bHQoYmluZGluZ3MsIFtdIC8qIHdhcm5pbmdzICovLCB0aGlzLmVycm9ycyk7XG4gIH1cblxuICBwYXJzZUtleWVkUmVhZE9yV3JpdGUocmVjZWl2ZXI6IEFTVCwgc3RhcnQ6IG51bWJlciwgaXNTYWZlOiBib29sZWFuKTogQVNUIHtcbiAgICByZXR1cm4gdGhpcy53aXRoQ29udGV4dChQYXJzZUNvbnRleHRGbGFncy5Xcml0YWJsZSwgKCkgPT4ge1xuICAgICAgdGhpcy5yYnJhY2tldHNFeHBlY3RlZCsrO1xuICAgICAgY29uc3Qga2V5ID0gdGhpcy5wYXJzZVBpcGUoKTtcbiAgICAgIGlmIChrZXkgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgICAgdGhpcy5lcnJvcihgS2V5IGFjY2VzcyBjYW5ub3QgYmUgZW1wdHlgKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmJyYWNrZXRzRXhwZWN0ZWQtLTtcbiAgICAgIHRoaXMuZXhwZWN0Q2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCk7XG4gICAgICBpZiAodGhpcy5jb25zdW1lT3B0aW9uYWxPcGVyYXRvcignPScpKSB7XG4gICAgICAgIGlmIChpc1NhZmUpIHtcbiAgICAgICAgICB0aGlzLmVycm9yKCdUaGUgXFwnPy5cXCcgb3BlcmF0b3IgY2Fubm90IGJlIHVzZWQgaW4gdGhlIGFzc2lnbm1lbnQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuICAgICAgICAgIHJldHVybiBuZXcgS2V5ZWRXcml0ZSh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZWNlaXZlciwga2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBpc1NhZmUgPyBuZXcgU2FmZUtleWVkUmVhZCh0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpLCByZWNlaXZlciwga2V5KSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgS2V5ZWRSZWFkKHRoaXMuc3BhbihzdGFydCksIHRoaXMuc291cmNlU3BhbihzdGFydCksIHJlY2VpdmVyLCBrZXkpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmV3IEVtcHR5RXhwcih0aGlzLnNwYW4oc3RhcnQpLCB0aGlzLnNvdXJjZVNwYW4oc3RhcnQpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBhIGRpcmVjdGl2ZSBrZXl3b3JkLCBmb2xsb3dlZCBieSBhIG1hbmRhdG9yeSBleHByZXNzaW9uLlxuICAgKiBGb3IgZXhhbXBsZSwgXCJvZiBpdGVtc1wiLCBcInRyYWNrQnk6IGZ1bmNcIi5cbiAgICogVGhlIGJpbmRpbmdzIGFyZTogbmdGb3JPZiAtPiBpdGVtcywgbmdGb3JUcmFja0J5IC0+IGZ1bmNcbiAgICogVGhlcmUgY291bGQgYmUgYW4gb3B0aW9uYWwgXCJhc1wiIGJpbmRpbmcgdGhhdCBmb2xsb3dzIHRoZSBleHByZXNzaW9uLlxuICAgKiBGb3IgZXhhbXBsZSxcbiAgICogYGBgXG4gICAqICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgaXRlbXMgfCBzbGljZTowOjEgYXMgY29sbGVjdGlvblwiLlxuICAgKiAgICAgICAgICAgICAgICAgICAgXl4gXl5eXl5eXl5eXl5eXl5eXl4gXl5eXl5eXl5eXl5eXlxuICAgKiAgICAgICAgICAgICAgIGtleXdvcmQgICAgYm91bmQgdGFyZ2V0ICAgb3B0aW9uYWwgJ2FzJyBiaW5kaW5nXG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ga2V5IGJpbmRpbmcga2V5LCBmb3IgZXhhbXBsZSwgbmdGb3IsIG5nSWYsIG5nRm9yT2YsIGFsb25nIHdpdGggaXRzXG4gICAqIGFic29sdXRlIHNwYW4uXG4gICAqL1xuICBwcml2YXRlIHBhcnNlRGlyZWN0aXZlS2V5d29yZEJpbmRpbmdzKGtleTogVGVtcGxhdGVCaW5kaW5nSWRlbnRpZmllcik6IFRlbXBsYXRlQmluZGluZ1tdIHtcbiAgICBjb25zdCBiaW5kaW5nczogVGVtcGxhdGVCaW5kaW5nW10gPSBbXTtcbiAgICB0aGlzLmNvbnN1bWVPcHRpb25hbENoYXJhY3RlcihjaGFycy4kQ09MT04pOyAgLy8gdHJhY2tCeTogdHJhY2tCeUZ1bmN0aW9uXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk7XG4gICAgbGV0IHNwYW5FbmQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICAvLyBUaGUgYmluZGluZyBjb3VsZCBvcHRpb25hbGx5IGJlIGZvbGxvd2VkIGJ5IFwiYXNcIi4gRm9yIGV4YW1wbGUsXG4gICAgLy8gKm5nSWY9XCJjb25kIHwgcGlwZSBhcyB4XCIuIEluIHRoaXMgY2FzZSwgdGhlIGtleSBpbiB0aGUgXCJhc1wiIGJpbmRpbmdcbiAgICAvLyBpcyBcInhcIiBhbmQgdGhlIHZhbHVlIGlzIHRoZSB0ZW1wbGF0ZSBrZXkgaXRzZWxmIChcIm5nSWZcIikuIE5vdGUgdGhhdCB0aGVcbiAgICAvLyAna2V5JyBpbiB0aGUgY3VycmVudCBjb250ZXh0IG5vdyBiZWNvbWVzIHRoZSBcInZhbHVlXCIgaW4gdGhlIG5leHQgYmluZGluZy5cbiAgICBjb25zdCBhc0JpbmRpbmcgPSB0aGlzLnBhcnNlQXNCaW5kaW5nKGtleSk7XG4gICAgaWYgKCFhc0JpbmRpbmcpIHtcbiAgICAgIHRoaXMuY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKTtcbiAgICAgIHNwYW5FbmQgPSB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldDtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oa2V5LnNwYW4uc3RhcnQsIHNwYW5FbmQpO1xuICAgIGJpbmRpbmdzLnB1c2gobmV3IEV4cHJlc3Npb25CaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpKTtcbiAgICBpZiAoYXNCaW5kaW5nKSB7XG4gICAgICBiaW5kaW5ncy5wdXNoKGFzQmluZGluZyk7XG4gICAgfVxuICAgIHJldHVybiBiaW5kaW5ncztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGV4cHJlc3Npb24gQVNUIGZvciB0aGUgYm91bmQgdGFyZ2V0IG9mIGEgZGlyZWN0aXZlIGtleXdvcmRcbiAgICogYmluZGluZy4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0lmPVwiY29uZGl0aW9uIHwgcGlwZVwiXG4gICAqICAgICAgICAgIF5eXl5eXl5eXl5eXl5eXl4gYm91bmQgdGFyZ2V0IGZvciBcIm5nSWZcIlxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zXCJcbiAgICogICAgICAgICAgICAgICAgICAgICAgIF5eXl5eIGJvdW5kIHRhcmdldCBmb3IgXCJuZ0Zvck9mXCJcbiAgICogYGBgXG4gICAqL1xuICBwcml2YXRlIGdldERpcmVjdGl2ZUJvdW5kVGFyZ2V0KCk6IEFTVFdpdGhTb3VyY2V8bnVsbCB7XG4gICAgaWYgKHRoaXMubmV4dCA9PT0gRU9GIHx8IHRoaXMucGVla0tleXdvcmRBcygpIHx8IHRoaXMucGVla0tleXdvcmRMZXQoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGFzdCA9IHRoaXMucGFyc2VQaXBlKCk7ICAvLyBleGFtcGxlOiBcImNvbmRpdGlvbiB8IGFzeW5jXCJcbiAgICBjb25zdCB7c3RhcnQsIGVuZH0gPSBhc3Quc3BhbjtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuICAgIHJldHVybiBuZXcgQVNUV2l0aFNvdXJjZShhc3QsIHZhbHVlLCB0aGlzLmxvY2F0aW9uLCB0aGlzLmFic29sdXRlT2Zmc2V0ICsgc3RhcnQsIHRoaXMuZXJyb3JzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGJpbmRpbmcgZm9yIGEgdmFyaWFibGUgZGVjbGFyZWQgdXNpbmcgYGFzYC4gTm90ZSB0aGF0IHRoZSBvcmRlclxuICAgKiBvZiB0aGUga2V5LXZhbHVlIHBhaXIgaW4gdGhpcyBkZWNsYXJhdGlvbiBpcyByZXZlcnNlZC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBpbmRleCBhcyBpXCJcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBeXl5eXiAgICBeXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgICAga2V5XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgbmFtZSBvZiB0aGUgdmFsdWUgaW4gdGhlIGRlY2xhcmF0aW9uLCBcIm5nSWZcIiBpbiB0aGUgZXhhbXBsZVxuICAgKiBhYm92ZSwgYWxvbmcgd2l0aCBpdHMgYWJzb2x1dGUgc3Bhbi5cbiAgICovXG4gIHByaXZhdGUgcGFyc2VBc0JpbmRpbmcodmFsdWU6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXIpOiBUZW1wbGF0ZUJpbmRpbmd8bnVsbCB7XG4gICAgaWYgKCF0aGlzLnBlZWtLZXl3b3JkQXMoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gY29uc3VtZSB0aGUgJ2FzJyBrZXl3b3JkXG4gICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4odmFsdWUuc3Bhbi5zdGFydCwgdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQpO1xuICAgIHJldHVybiBuZXcgVmFyaWFibGVCaW5kaW5nKHNvdXJjZVNwYW4sIGtleSwgdmFsdWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYmluZGluZyBmb3IgYSB2YXJpYWJsZSBkZWNsYXJlZCB1c2luZyBgbGV0YC4gRm9yIGV4YW1wbGUsXG4gICAqIGBgYFxuICAgKiAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGl0ZW1zOyBsZXQgaT1pbmRleDtcIlxuICAgKiAgICAgICAgICAgXl5eXl5eXl4gICAgICAgICAgIF5eXl5eXl5eXl5eXG4gICAqIGBgYFxuICAgKiBJbiB0aGUgZmlyc3QgYmluZGluZywgYGl0ZW1gIGlzIGJvdW5kIHRvIGBOZ0Zvck9mQ29udGV4dC4kaW1wbGljaXRgLlxuICAgKiBJbiB0aGUgc2Vjb25kIGJpbmRpbmcsIGBpYCBpcyBib3VuZCB0byBgTmdGb3JPZkNvbnRleHQuaW5kZXhgLlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUxldEJpbmRpbmcoKTogVGVtcGxhdGVCaW5kaW5nfG51bGwge1xuICAgIGlmICghdGhpcy5wZWVrS2V5d29yZExldCgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc3BhblN0YXJ0ID0gdGhpcy5jdXJyZW50QWJzb2x1dGVPZmZzZXQ7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBjb25zdW1lIHRoZSAnbGV0JyBrZXl3b3JkXG4gICAgY29uc3Qga2V5ID0gdGhpcy5leHBlY3RUZW1wbGF0ZUJpbmRpbmdLZXkoKTtcbiAgICBsZXQgdmFsdWU6IFRlbXBsYXRlQmluZGluZ0lkZW50aWZpZXJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHRoaXMuY29uc3VtZU9wdGlvbmFsT3BlcmF0b3IoJz0nKSkge1xuICAgICAgdmFsdWUgPSB0aGlzLmV4cGVjdFRlbXBsYXRlQmluZGluZ0tleSgpO1xuICAgIH1cbiAgICB0aGlzLmNvbnN1bWVTdGF0ZW1lbnRUZXJtaW5hdG9yKCk7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBBYnNvbHV0ZVNvdXJjZVNwYW4oc3BhblN0YXJ0LCB0aGlzLmN1cnJlbnRBYnNvbHV0ZU9mZnNldCk7XG4gICAgcmV0dXJuIG5ldyBWYXJpYWJsZUJpbmRpbmcoc291cmNlU3Bhbiwga2V5LCB2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3VtZSB0aGUgb3B0aW9uYWwgc3RhdGVtZW50IHRlcm1pbmF0b3I6IHNlbWljb2xvbiBvciBjb21tYS5cbiAgICovXG4gIHByaXZhdGUgY29uc3VtZVN0YXRlbWVudFRlcm1pbmF0b3IoKSB7XG4gICAgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJFNFTUlDT0xPTikgfHwgdGhpcy5jb25zdW1lT3B0aW9uYWxDaGFyYWN0ZXIoY2hhcnMuJENPTU1BKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvcmRzIGFuIGVycm9yIGFuZCBza2lwcyBvdmVyIHRoZSB0b2tlbiBzdHJlYW0gdW50aWwgcmVhY2hpbmcgYSByZWNvdmVyYWJsZSBwb2ludC4gU2VlXG4gICAqIGB0aGlzLnNraXBgIGZvciBtb3JlIGRldGFpbHMgb24gdG9rZW4gc2tpcHBpbmcuXG4gICAqL1xuICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIGluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZXJFcnJvcihtZXNzYWdlLCB0aGlzLmlucHV0LCB0aGlzLmxvY2F0aW9uVGV4dChpbmRleCksIHRoaXMubG9jYXRpb24pKTtcbiAgICB0aGlzLnNraXAoKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9jYXRpb25UZXh0KGluZGV4OiBudW1iZXJ8bnVsbCA9IG51bGwpIHtcbiAgICBpZiAoaW5kZXggPT0gbnVsbCkgaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIHJldHVybiAoaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID8gYGF0IGNvbHVtbiAke3RoaXMudG9rZW5zW2luZGV4XS5pbmRleCArIDF9IGluYCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgYXQgdGhlIGVuZCBvZiB0aGUgZXhwcmVzc2lvbmA7XG4gIH1cblxuICAvKipcbiAgICogUmVjb3JkcyBhbiBlcnJvciBmb3IgYW4gdW5leHBlY3RlZCBwcml2YXRlIGlkZW50aWZpZXIgYmVpbmcgZGlzY292ZXJlZC5cbiAgICogQHBhcmFtIHRva2VuIFRva2VuIHJlcHJlc2VudGluZyBhIHByaXZhdGUgaWRlbnRpZmllci5cbiAgICogQHBhcmFtIGV4dHJhTWVzc2FnZSBPcHRpb25hbCBhZGRpdGlvbmFsIG1lc3NhZ2UgYmVpbmcgYXBwZW5kZWQgdG8gdGhlIGVycm9yLlxuICAgKi9cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3JGb3JQcml2YXRlSWRlbnRpZmllcih0b2tlbjogVG9rZW4sIGV4dHJhTWVzc2FnZTogc3RyaW5nfG51bGwpIHtcbiAgICBsZXQgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgYFByaXZhdGUgaWRlbnRpZmllcnMgYXJlIG5vdCBzdXBwb3J0ZWQuIFVuZXhwZWN0ZWQgcHJpdmF0ZSBpZGVudGlmaWVyOiAke3Rva2VufWA7XG4gICAgaWYgKGV4dHJhTWVzc2FnZSAhPT0gbnVsbCkge1xuICAgICAgZXJyb3JNZXNzYWdlICs9IGAsICR7ZXh0cmFNZXNzYWdlfWA7XG4gICAgfVxuICAgIHRoaXMuZXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFcnJvciByZWNvdmVyeSBzaG91bGQgc2tpcCB0b2tlbnMgdW50aWwgaXQgZW5jb3VudGVycyBhIHJlY292ZXJ5IHBvaW50LlxuICAgKlxuICAgKiBUaGUgZm9sbG93aW5nIGFyZSB0cmVhdGVkIGFzIHVuY29uZGl0aW9uYWwgcmVjb3ZlcnkgcG9pbnRzOlxuICAgKiAgIC0gZW5kIG9mIGlucHV0XG4gICAqICAgLSAnOycgKHBhcnNlQ2hhaW4oKSBpcyBhbHdheXMgdGhlIHJvb3QgcHJvZHVjdGlvbiwgYW5kIGl0IGV4cGVjdHMgYSAnOycpXG4gICAqICAgLSAnfCcgKHNpbmNlIHBpcGVzIG1heSBiZSBjaGFpbmVkIGFuZCBlYWNoIHBpcGUgZXhwcmVzc2lvbiBtYXkgYmUgdHJlYXRlZCBpbmRlcGVuZGVudGx5KVxuICAgKlxuICAgKiBUaGUgZm9sbG93aW5nIGFyZSBjb25kaXRpb25hbCByZWNvdmVyeSBwb2ludHM6XG4gICAqICAgLSAnKScsICd9JywgJ10nIGlmIG9uZSBvZiBjYWxsaW5nIHByb2R1Y3Rpb25zIGlzIGV4cGVjdGluZyBvbmUgb2YgdGhlc2Ugc3ltYm9sc1xuICAgKiAgICAgLSBUaGlzIGFsbG93cyBza2lwKCkgdG8gcmVjb3ZlciBmcm9tIGVycm9ycyBzdWNoIGFzICcoYS4pICsgMScgYWxsb3dpbmcgbW9yZSBvZiB0aGUgQVNUIHRvXG4gICAqICAgICAgIGJlIHJldGFpbmVkIChpdCBkb2Vzbid0IHNraXAgYW55IHRva2VucyBhcyB0aGUgJyknIGlzIHJldGFpbmVkIGJlY2F1c2Ugb2YgdGhlICcoJyBiZWdpbnNcbiAgICogICAgICAgYW4gJygnIDxleHByPiAnKScgcHJvZHVjdGlvbikuXG4gICAqICAgICAgIFRoZSByZWNvdmVyeSBwb2ludHMgb2YgZ3JvdXBpbmcgc3ltYm9scyBtdXN0IGJlIGNvbmRpdGlvbmFsIGFzIHRoZXkgbXVzdCBiZSBza2lwcGVkIGlmXG4gICAqICAgICAgIG5vbmUgb2YgdGhlIGNhbGxpbmcgcHJvZHVjdGlvbnMgYXJlIG5vdCBleHBlY3RpbmcgdGhlIGNsb3NpbmcgdG9rZW4gZWxzZSB3ZSB3aWxsIG5ldmVyXG4gICAqICAgICAgIG1ha2UgcHJvZ3Jlc3MgaW4gdGhlIGNhc2Ugb2YgYW4gZXh0cmFuZW91cyBncm91cCBjbG9zaW5nIHN5bWJvbCAoc3VjaCBhcyBhIHN0cmF5ICcpJykuXG4gICAqICAgICAgIFRoYXQgaXMsIHdlIHNraXAgYSBjbG9zaW5nIHN5bWJvbCBpZiB3ZSBhcmUgbm90IGluIGEgZ3JvdXBpbmcgcHJvZHVjdGlvbi5cbiAgICogICAtICc9JyBpbiBhIGBXcml0YWJsZWAgY29udGV4dFxuICAgKiAgICAgLSBJbiB0aGlzIGNvbnRleHQsIHdlIGFyZSBhYmxlIHRvIHJlY292ZXIgYWZ0ZXIgc2VlaW5nIHRoZSBgPWAgb3BlcmF0b3IsIHdoaWNoXG4gICAqICAgICAgIHNpZ25hbHMgdGhlIHByZXNlbmNlIG9mIGFuIGluZGVwZW5kZW50IHJ2YWx1ZSBleHByZXNzaW9uIGZvbGxvd2luZyB0aGUgYD1gIG9wZXJhdG9yLlxuICAgKlxuICAgKiBJZiBhIHByb2R1Y3Rpb24gZXhwZWN0cyBvbmUgb2YgdGhlc2UgdG9rZW4gaXQgaW5jcmVtZW50cyB0aGUgY29ycmVzcG9uZGluZyBuZXN0aW5nIGNvdW50LFxuICAgKiBhbmQgdGhlbiBkZWNyZW1lbnRzIGl0IGp1c3QgcHJpb3IgdG8gY2hlY2tpbmcgaWYgdGhlIHRva2VuIGlzIGluIHRoZSBpbnB1dC5cbiAgICovXG4gIHByaXZhdGUgc2tpcCgpIHtcbiAgICBsZXQgbiA9IHRoaXMubmV4dDtcbiAgICB3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCAmJiAhbi5pc0NoYXJhY3RlcihjaGFycy4kU0VNSUNPTE9OKSAmJlxuICAgICAgICAgICAhbi5pc09wZXJhdG9yKCd8JykgJiYgKHRoaXMucnBhcmVuc0V4cGVjdGVkIDw9IDAgfHwgIW4uaXNDaGFyYWN0ZXIoY2hhcnMuJFJQQVJFTikpICYmXG4gICAgICAgICAgICh0aGlzLnJicmFjZXNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0UpKSAmJlxuICAgICAgICAgICAodGhpcy5yYnJhY2tldHNFeHBlY3RlZCA8PSAwIHx8ICFuLmlzQ2hhcmFjdGVyKGNoYXJzLiRSQlJBQ0tFVCkpICYmXG4gICAgICAgICAgICghKHRoaXMuY29udGV4dCAmIFBhcnNlQ29udGV4dEZsYWdzLldyaXRhYmxlKSB8fCAhbi5pc09wZXJhdG9yKCc9JykpKSB7XG4gICAgICBpZiAodGhpcy5uZXh0LmlzRXJyb3IoKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgICAgbmV3IFBhcnNlckVycm9yKHRoaXMubmV4dC50b1N0cmluZygpISwgdGhpcy5pbnB1dCwgdGhpcy5sb2NhdGlvblRleHQoKSwgdGhpcy5sb2NhdGlvbikpO1xuICAgICAgfVxuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICBuID0gdGhpcy5uZXh0O1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlciwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0VGhpc1JlY2VpdmVyKGFzdDogVGhpc1JlY2VpdmVyLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRJbnRlcnBvbGF0aW9uKGFzdDogSW50ZXJwb2xhdGlvbiwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IExpdGVyYWxQcmltaXRpdmUsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRDYWxsKGFzdDogQ2FsbCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFzdDogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC5leHByZXNzaW9ucywgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpIHtcbiAgICB0aGlzLnZpc2l0QWxsKGFzdC52YWx1ZXMsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRVbmFyeShhc3Q6IFVuYXJ5LCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRCaW5hcnkoYXN0OiBCaW5hcnksIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdENvbmRpdGlvbmFsKGFzdDogQ29uZGl0aW9uYWwsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaCgncGlwZXMnKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSwgY29udGV4dDogYW55KSB7fVxuXG4gIHZpc2l0QWxsKGFzdHM6IGFueVtdLCBjb250ZXh0OiBhbnkpOiBhbnlbXSB7XG4gICAgcmV0dXJuIGFzdHMubWFwKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4sIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUsIGNvbnRleHQ6IGFueSkge31cblxuICB2aXNpdFNhZmVLZXllZFJlYWQoYXN0OiBTYWZlS2V5ZWRSZWFkLCBjb250ZXh0OiBhbnkpIHt9XG59XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpbXBsZW1lbnRzIFNpbXBsZUV4cHJlc3Npb25DaGVja2VyIHVzZWQgaW4gVmlldyBFbmdpbmUgYW5kIHBlcmZvcm1zIG1vcmUgc3RyaWN0IGNoZWNrc1xuICogdG8gbWFrZSBzdXJlIGhvc3QgYmluZGluZ3MgZG8gbm90IGNvbnRhaW4gcGlwZXMuIEluIFZpZXcgRW5naW5lLCBoYXZpbmcgcGlwZXMgaW4gaG9zdCBiaW5kaW5ncyBpc1xuICogbm90IHN1cHBvcnRlZCBhcyB3ZWxsLCBidXQgaW4gc29tZSBjYXNlcyAobGlrZSBgISh2YWx1ZSB8IGFzeW5jKWApIHRoZSBlcnJvciBpcyBub3QgdHJpZ2dlcmVkIGF0XG4gKiBjb21waWxlIHRpbWUuIEluIG9yZGVyIHRvIHByZXNlcnZlIFZpZXcgRW5naW5lIGJlaGF2aW9yLCBtb3JlIHN0cmljdCBjaGVja3MgYXJlIGludHJvZHVjZWQgZm9yXG4gKiBJdnkgbW9kZSBvbmx5LlxuICovXG5jbGFzcyBJdnlTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciBleHRlbmRzIFJlY3Vyc2l2ZUFzdFZpc2l0b3IgaW1wbGVtZW50cyBTaW1wbGVFeHByZXNzaW9uQ2hlY2tlciB7XG4gIGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICBvdmVycmlkZSB2aXNpdFBpcGUoKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaCgncGlwZXMnKTtcbiAgfVxufVxuIl19