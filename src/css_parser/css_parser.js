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
        define("@angular/compiler/src/css_parser/css_parser", ["require", "exports", "tslib", "@angular/compiler/src/chars", "@angular/compiler/src/parse_util", "@angular/compiler/src/css_parser/css_ast", "@angular/compiler/src/css_parser/css_lexer", "@angular/compiler/src/css_parser/css_lexer", "@angular/compiler/src/css_parser/css_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var chars = require("@angular/compiler/src/chars");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var css_ast_1 = require("@angular/compiler/src/css_parser/css_ast");
    var css_lexer_1 = require("@angular/compiler/src/css_parser/css_lexer");
    var SPACE_OPERATOR = ' ';
    var css_lexer_2 = require("@angular/compiler/src/css_parser/css_lexer");
    exports.CssToken = css_lexer_2.CssToken;
    var css_ast_2 = require("@angular/compiler/src/css_parser/css_ast");
    exports.BlockType = css_ast_2.BlockType;
    var SLASH_CHARACTER = '/';
    var GT_CHARACTER = '>';
    var TRIPLE_GT_OPERATOR_STR = '>>>';
    var DEEP_OPERATOR_STR = '/deep/';
    var EOF_DELIM_FLAG = 1;
    var RBRACE_DELIM_FLAG = 2;
    var LBRACE_DELIM_FLAG = 4;
    var COMMA_DELIM_FLAG = 8;
    var COLON_DELIM_FLAG = 16;
    var SEMICOLON_DELIM_FLAG = 32;
    var NEWLINE_DELIM_FLAG = 64;
    var RPAREN_DELIM_FLAG = 128;
    var LPAREN_DELIM_FLAG = 256;
    var SPACE_DELIM_FLAG = 512;
    function _pseudoSelectorSupportsInnerSelectors(name) {
        return ['not', 'host', 'host-context'].indexOf(name) >= 0;
    }
    function isSelectorOperatorCharacter(code) {
        switch (code) {
            case chars.$SLASH:
            case chars.$TILDA:
            case chars.$PLUS:
            case chars.$GT:
                return true;
            default:
                return chars.isWhitespace(code);
        }
    }
    function getDelimFromCharacter(code) {
        switch (code) {
            case chars.$EOF:
                return EOF_DELIM_FLAG;
            case chars.$COMMA:
                return COMMA_DELIM_FLAG;
            case chars.$COLON:
                return COLON_DELIM_FLAG;
            case chars.$SEMICOLON:
                return SEMICOLON_DELIM_FLAG;
            case chars.$RBRACE:
                return RBRACE_DELIM_FLAG;
            case chars.$LBRACE:
                return LBRACE_DELIM_FLAG;
            case chars.$RPAREN:
                return RPAREN_DELIM_FLAG;
            case chars.$SPACE:
            case chars.$TAB:
                return SPACE_DELIM_FLAG;
            default:
                return css_lexer_1.isNewline(code) ? NEWLINE_DELIM_FLAG : 0;
        }
    }
    function characterContainsDelimiter(code, delimiters) {
        return (getDelimFromCharacter(code) & delimiters) > 0;
    }
    var ParsedCssResult = /** @class */ (function () {
        function ParsedCssResult(errors, ast) {
            this.errors = errors;
            this.ast = ast;
        }
        return ParsedCssResult;
    }());
    exports.ParsedCssResult = ParsedCssResult;
    var CssParser = /** @class */ (function () {
        function CssParser() {
            this._errors = [];
        }
        /**
         * @param css the CSS code that will be parsed
         * @param url the name of the CSS file containing the CSS source code
         */
        CssParser.prototype.parse = function (css, url) {
            var lexer = new css_lexer_1.CssLexer();
            this._file = new parse_util_1.ParseSourceFile(css, url);
            this._scanner = lexer.scan(css, false);
            var ast = this._parseStyleSheet(EOF_DELIM_FLAG);
            var errors = this._errors;
            this._errors = [];
            var result = new ParsedCssResult(errors, ast);
            this._file = null;
            this._scanner = null;
            return result;
        };
        /** @internal */
        CssParser.prototype._parseStyleSheet = function (delimiters) {
            var results = [];
            this._scanner.consumeEmptyStatements();
            while (this._scanner.peek != chars.$EOF) {
                this._scanner.setMode(css_lexer_1.CssLexerMode.BLOCK);
                results.push(this._parseRule(delimiters));
            }
            var span = null;
            if (results.length > 0) {
                var firstRule = results[0];
                // we collect the last token like so incase there was an
                // EOF token that was emitted sometime during the lexing
                span = this._generateSourceSpan(firstRule, this._lastToken);
            }
            return new css_ast_1.CssStyleSheetAst(span, results);
        };
        /** @internal */
        CssParser.prototype._getSourceContent = function () { return this._scanner != null ? this._scanner.input : ''; };
        /** @internal */
        CssParser.prototype._extractSourceContent = function (start, end) {
            return this._getSourceContent().substring(start, end + 1);
        };
        /** @internal */
        CssParser.prototype._generateSourceSpan = function (start, end) {
            if (end === void 0) { end = null; }
            var startLoc;
            if (start instanceof css_ast_1.CssAst) {
                startLoc = start.location.start;
            }
            else {
                var token = start;
                if (token == null) {
                    // the data here is invalid, however, if and when this does
                    // occur, any other errors associated with this will be collected
                    token = this._lastToken;
                }
                startLoc = new parse_util_1.ParseLocation(this._file, token.index, token.line, token.column);
            }
            if (end == null) {
                end = this._lastToken;
            }
            var endLine = -1;
            var endColumn = -1;
            var endIndex = -1;
            if (end instanceof css_ast_1.CssAst) {
                endLine = end.location.end.line;
                endColumn = end.location.end.col;
                endIndex = end.location.end.offset;
            }
            else if (end instanceof css_lexer_1.CssToken) {
                endLine = end.line;
                endColumn = end.column;
                endIndex = end.index;
            }
            var endLoc = new parse_util_1.ParseLocation(this._file, endIndex, endLine, endColumn);
            return new parse_util_1.ParseSourceSpan(startLoc, endLoc);
        };
        /** @internal */
        CssParser.prototype._resolveBlockType = function (token) {
            switch (token.strValue) {
                case '@-o-keyframes':
                case '@-moz-keyframes':
                case '@-webkit-keyframes':
                case '@keyframes':
                    return css_ast_1.BlockType.Keyframes;
                case '@charset':
                    return css_ast_1.BlockType.Charset;
                case '@import':
                    return css_ast_1.BlockType.Import;
                case '@namespace':
                    return css_ast_1.BlockType.Namespace;
                case '@page':
                    return css_ast_1.BlockType.Page;
                case '@document':
                    return css_ast_1.BlockType.Document;
                case '@media':
                    return css_ast_1.BlockType.MediaQuery;
                case '@font-face':
                    return css_ast_1.BlockType.FontFace;
                case '@viewport':
                    return css_ast_1.BlockType.Viewport;
                case '@supports':
                    return css_ast_1.BlockType.Supports;
                default:
                    return css_ast_1.BlockType.Unsupported;
            }
        };
        /** @internal */
        CssParser.prototype._parseRule = function (delimiters) {
            if (this._scanner.peek == chars.$AT) {
                return this._parseAtRule(delimiters);
            }
            return this._parseSelectorRule(delimiters);
        };
        /** @internal */
        CssParser.prototype._parseAtRule = function (delimiters) {
            var start = this._getScannerIndex();
            this._scanner.setMode(css_lexer_1.CssLexerMode.BLOCK);
            var token = this._scan();
            var startToken = token;
            this._assertCondition(token.type == css_lexer_1.CssTokenType.AtKeyword, "The CSS Rule " + token.strValue + " is not a valid [@] rule.", token);
            var block;
            var type = this._resolveBlockType(token);
            var span;
            var tokens;
            var endToken;
            var end;
            var strValue;
            var query;
            switch (type) {
                case css_ast_1.BlockType.Charset:
                case css_ast_1.BlockType.Namespace:
                case css_ast_1.BlockType.Import:
                    var value = this._parseValue(delimiters);
                    this._scanner.setMode(css_lexer_1.CssLexerMode.BLOCK);
                    this._scanner.consumeEmptyStatements();
                    span = this._generateSourceSpan(startToken, value);
                    return new css_ast_1.CssInlineRuleAst(span, type, value);
                case css_ast_1.BlockType.Viewport:
                case css_ast_1.BlockType.FontFace:
                    block = this._parseStyleBlock(delimiters);
                    span = this._generateSourceSpan(startToken, block);
                    return new css_ast_1.CssBlockRuleAst(span, type, block);
                case css_ast_1.BlockType.Keyframes:
                    tokens = this._collectUntilDelim(delimiters | RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG);
                    // keyframes only have one identifier name
                    var name_1 = tokens[0];
                    block = this._parseKeyframeBlock(delimiters);
                    span = this._generateSourceSpan(startToken, block);
                    return new css_ast_1.CssKeyframeRuleAst(span, name_1, block);
                case css_ast_1.BlockType.MediaQuery:
                    this._scanner.setMode(css_lexer_1.CssLexerMode.MEDIA_QUERY);
                    tokens = this._collectUntilDelim(delimiters | RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG);
                    endToken = tokens[tokens.length - 1];
                    // we do not track the whitespace after the mediaQuery predicate ends
                    // so we have to calculate the end string value on our own
                    end = endToken.index + endToken.strValue.length - 1;
                    strValue = this._extractSourceContent(start, end);
                    span = this._generateSourceSpan(startToken, endToken);
                    query = new css_ast_1.CssAtRulePredicateAst(span, strValue, tokens);
                    block = this._parseBlock(delimiters);
                    strValue = this._extractSourceContent(start, this._getScannerIndex() - 1);
                    span = this._generateSourceSpan(startToken, block);
                    return new css_ast_1.CssMediaQueryRuleAst(span, strValue, query, block);
                case css_ast_1.BlockType.Document:
                case css_ast_1.BlockType.Supports:
                case css_ast_1.BlockType.Page:
                    this._scanner.setMode(css_lexer_1.CssLexerMode.AT_RULE_QUERY);
                    tokens = this._collectUntilDelim(delimiters | RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG);
                    endToken = tokens[tokens.length - 1];
                    // we do not track the whitespace after this block rule predicate ends
                    // so we have to calculate the end string value on our own
                    end = endToken.index + endToken.strValue.length - 1;
                    strValue = this._extractSourceContent(start, end);
                    span = this._generateSourceSpan(startToken, tokens[tokens.length - 1]);
                    query = new css_ast_1.CssAtRulePredicateAst(span, strValue, tokens);
                    block = this._parseBlock(delimiters);
                    strValue = this._extractSourceContent(start, block.end.offset);
                    span = this._generateSourceSpan(startToken, block);
                    return new css_ast_1.CssBlockDefinitionRuleAst(span, strValue, type, query, block);
                // if a custom @rule { ... } is used it should still tokenize the insides
                default:
                    var listOfTokens_1 = [];
                    var tokenName = token.strValue;
                    this._scanner.setMode(css_lexer_1.CssLexerMode.ALL);
                    this._error(css_lexer_1.generateErrorMessage(this._getSourceContent(), "The CSS \"at\" rule \"" + tokenName + "\" is not allowed to used here", token.strValue, token.index, token.line, token.column), token);
                    this._collectUntilDelim(delimiters | LBRACE_DELIM_FLAG | SEMICOLON_DELIM_FLAG)
                        .forEach(function (token) { listOfTokens_1.push(token); });
                    if (this._scanner.peek == chars.$LBRACE) {
                        listOfTokens_1.push(this._consume(css_lexer_1.CssTokenType.Character, '{'));
                        this._collectUntilDelim(delimiters | RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG)
                            .forEach(function (token) { listOfTokens_1.push(token); });
                        listOfTokens_1.push(this._consume(css_lexer_1.CssTokenType.Character, '}'));
                    }
                    endToken = listOfTokens_1[listOfTokens_1.length - 1];
                    span = this._generateSourceSpan(startToken, endToken);
                    return new css_ast_1.CssUnknownRuleAst(span, tokenName, listOfTokens_1);
            }
        };
        /** @internal */
        CssParser.prototype._parseSelectorRule = function (delimiters) {
            var start = this._getScannerIndex();
            var selectors = this._parseSelectors(delimiters);
            var block = this._parseStyleBlock(delimiters);
            var ruleAst;
            var span;
            var startSelector = selectors[0];
            if (block != null) {
                span = this._generateSourceSpan(startSelector, block);
                ruleAst = new css_ast_1.CssSelectorRuleAst(span, selectors, block);
            }
            else {
                var name_2 = this._extractSourceContent(start, this._getScannerIndex() - 1);
                var innerTokens_1 = [];
                selectors.forEach(function (selector) {
                    selector.selectorParts.forEach(function (part) {
                        part.tokens.forEach(function (token) { innerTokens_1.push(token); });
                    });
                });
                var endToken = innerTokens_1[innerTokens_1.length - 1];
                span = this._generateSourceSpan(startSelector, endToken);
                ruleAst = new css_ast_1.CssUnknownTokenListAst(span, name_2, innerTokens_1);
            }
            this._scanner.setMode(css_lexer_1.CssLexerMode.BLOCK);
            this._scanner.consumeEmptyStatements();
            return ruleAst;
        };
        /** @internal */
        CssParser.prototype._parseSelectors = function (delimiters) {
            delimiters |= LBRACE_DELIM_FLAG | SEMICOLON_DELIM_FLAG;
            var selectors = [];
            var isParsingSelectors = true;
            while (isParsingSelectors) {
                selectors.push(this._parseSelector(delimiters));
                isParsingSelectors = !characterContainsDelimiter(this._scanner.peek, delimiters);
                if (isParsingSelectors) {
                    this._consume(css_lexer_1.CssTokenType.Character, ',');
                    isParsingSelectors = !characterContainsDelimiter(this._scanner.peek, delimiters);
                    if (isParsingSelectors) {
                        this._scanner.consumeWhitespace();
                    }
                }
            }
            return selectors;
        };
        /** @internal */
        CssParser.prototype._scan = function () {
            var output = this._scanner.scan();
            var token = output.token;
            var error = output.error;
            if (error != null) {
                this._error(css_lexer_1.getRawMessage(error), token);
            }
            this._lastToken = token;
            return token;
        };
        /** @internal */
        CssParser.prototype._getScannerIndex = function () { return this._scanner.index; };
        /** @internal */
        CssParser.prototype._consume = function (type, value) {
            if (value === void 0) { value = null; }
            var output = this._scanner.consume(type, value);
            var token = output.token;
            var error = output.error;
            if (error != null) {
                this._error(css_lexer_1.getRawMessage(error), token);
            }
            this._lastToken = token;
            return token;
        };
        /** @internal */
        CssParser.prototype._parseKeyframeBlock = function (delimiters) {
            delimiters |= RBRACE_DELIM_FLAG;
            this._scanner.setMode(css_lexer_1.CssLexerMode.KEYFRAME_BLOCK);
            var startToken = this._consume(css_lexer_1.CssTokenType.Character, '{');
            var definitions = [];
            while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
                definitions.push(this._parseKeyframeDefinition(delimiters));
            }
            var endToken = this._consume(css_lexer_1.CssTokenType.Character, '}');
            var span = this._generateSourceSpan(startToken, endToken);
            return new css_ast_1.CssBlockAst(span, definitions);
        };
        /** @internal */
        CssParser.prototype._parseKeyframeDefinition = function (delimiters) {
            var start = this._getScannerIndex();
            var stepTokens = [];
            delimiters |= LBRACE_DELIM_FLAG;
            while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
                stepTokens.push(this._parseKeyframeLabel(delimiters | COMMA_DELIM_FLAG));
                if (this._scanner.peek != chars.$LBRACE) {
                    this._consume(css_lexer_1.CssTokenType.Character, ',');
                }
            }
            var stylesBlock = this._parseStyleBlock(delimiters | RBRACE_DELIM_FLAG);
            var span = this._generateSourceSpan(stepTokens[0], stylesBlock);
            var ast = new css_ast_1.CssKeyframeDefinitionAst(span, stepTokens, stylesBlock);
            this._scanner.setMode(css_lexer_1.CssLexerMode.BLOCK);
            return ast;
        };
        /** @internal */
        CssParser.prototype._parseKeyframeLabel = function (delimiters) {
            this._scanner.setMode(css_lexer_1.CssLexerMode.KEYFRAME_BLOCK);
            return css_ast_1.mergeTokens(this._collectUntilDelim(delimiters));
        };
        /** @internal */
        CssParser.prototype._parsePseudoSelector = function (delimiters) {
            var start = this._getScannerIndex();
            delimiters &= ~COMMA_DELIM_FLAG;
            // we keep the original value since we may use it to recurse when :not, :host are used
            var startingDelims = delimiters;
            var startToken = this._consume(css_lexer_1.CssTokenType.Character, ':');
            var tokens = [startToken];
            if (this._scanner.peek == chars.$COLON) { // ::something
                tokens.push(this._consume(css_lexer_1.CssTokenType.Character, ':'));
            }
            var innerSelectors = [];
            this._scanner.setMode(css_lexer_1.CssLexerMode.PSEUDO_SELECTOR);
            // host, host-context, lang, not, nth-child are all identifiers
            var pseudoSelectorToken = this._consume(css_lexer_1.CssTokenType.Identifier);
            var pseudoSelectorName = pseudoSelectorToken.strValue;
            tokens.push(pseudoSelectorToken);
            // host(), lang(), nth-child(), etc...
            if (this._scanner.peek == chars.$LPAREN) {
                this._scanner.setMode(css_lexer_1.CssLexerMode.PSEUDO_SELECTOR_WITH_ARGUMENTS);
                var openParenToken = this._consume(css_lexer_1.CssTokenType.Character, '(');
                tokens.push(openParenToken);
                // :host(innerSelector(s)), :not(selector), etc...
                if (_pseudoSelectorSupportsInnerSelectors(pseudoSelectorName)) {
                    var innerDelims = startingDelims | LPAREN_DELIM_FLAG | RPAREN_DELIM_FLAG;
                    if (pseudoSelectorName == 'not') {
                        // the inner selector inside of :not(...) can only be one
                        // CSS selector (no commas allowed) ... This is according
                        // to the CSS specification
                        innerDelims |= COMMA_DELIM_FLAG;
                    }
                    // :host(a, b, c) {
                    this._parseSelectors(innerDelims).forEach(function (selector, index) {
                        innerSelectors.push(selector);
                    });
                }
                else {
                    // this branch is for things like "en-us, 2k + 1, etc..."
                    // which all end up in pseudoSelectors like :lang, :nth-child, etc..
                    var innerValueDelims = delimiters | LBRACE_DELIM_FLAG | COLON_DELIM_FLAG |
                        RPAREN_DELIM_FLAG | LPAREN_DELIM_FLAG;
                    while (!characterContainsDelimiter(this._scanner.peek, innerValueDelims)) {
                        var token = this._scan();
                        tokens.push(token);
                    }
                }
                var closeParenToken = this._consume(css_lexer_1.CssTokenType.Character, ')');
                tokens.push(closeParenToken);
            }
            var end = this._getScannerIndex() - 1;
            var strValue = this._extractSourceContent(start, end);
            var endToken = tokens[tokens.length - 1];
            var span = this._generateSourceSpan(startToken, endToken);
            return new css_ast_1.CssPseudoSelectorAst(span, strValue, pseudoSelectorName, tokens, innerSelectors);
        };
        /** @internal */
        CssParser.prototype._parseSimpleSelector = function (delimiters) {
            var start = this._getScannerIndex();
            delimiters |= COMMA_DELIM_FLAG;
            this._scanner.setMode(css_lexer_1.CssLexerMode.SELECTOR);
            var selectorCssTokens = [];
            var pseudoSelectors = [];
            var previousToken = undefined;
            var selectorPartDelimiters = delimiters | SPACE_DELIM_FLAG;
            var loopOverSelector = !characterContainsDelimiter(this._scanner.peek, selectorPartDelimiters);
            var hasAttributeError = false;
            while (loopOverSelector) {
                var peek = this._scanner.peek;
                switch (peek) {
                    case chars.$COLON:
                        var innerPseudo = this._parsePseudoSelector(delimiters);
                        pseudoSelectors.push(innerPseudo);
                        this._scanner.setMode(css_lexer_1.CssLexerMode.SELECTOR);
                        break;
                    case chars.$LBRACKET:
                        // we set the mode after the scan because attribute mode does not
                        // allow attribute [] values. And this also will catch any errors
                        // if an extra "[" is used inside.
                        selectorCssTokens.push(this._scan());
                        this._scanner.setMode(css_lexer_1.CssLexerMode.ATTRIBUTE_SELECTOR);
                        break;
                    case chars.$RBRACKET:
                        if (this._scanner.getMode() != css_lexer_1.CssLexerMode.ATTRIBUTE_SELECTOR) {
                            hasAttributeError = true;
                        }
                        // we set the mode early because attribute mode does not
                        // allow attribute [] values
                        this._scanner.setMode(css_lexer_1.CssLexerMode.SELECTOR);
                        selectorCssTokens.push(this._scan());
                        break;
                    default:
                        if (isSelectorOperatorCharacter(peek)) {
                            loopOverSelector = false;
                            continue;
                        }
                        var token = this._scan();
                        previousToken = token;
                        selectorCssTokens.push(token);
                        break;
                }
                loopOverSelector = !characterContainsDelimiter(this._scanner.peek, selectorPartDelimiters);
            }
            hasAttributeError =
                hasAttributeError || this._scanner.getMode() == css_lexer_1.CssLexerMode.ATTRIBUTE_SELECTOR;
            if (hasAttributeError) {
                this._error("Unbalanced CSS attribute selector at column " + previousToken.line + ":" + previousToken.column, previousToken);
            }
            var end = this._getScannerIndex() - 1;
            // this happens if the selector is not directly followed by
            // a comma or curly brace without a space in between
            var operator = null;
            var operatorScanCount = 0;
            var lastOperatorToken = null;
            if (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
                while (operator == null && !characterContainsDelimiter(this._scanner.peek, delimiters) &&
                    isSelectorOperatorCharacter(this._scanner.peek)) {
                    var token = this._scan();
                    var tokenOperator = token.strValue;
                    operatorScanCount++;
                    lastOperatorToken = token;
                    if (tokenOperator != SPACE_OPERATOR) {
                        switch (tokenOperator) {
                            case SLASH_CHARACTER:
                                // /deep/ operator
                                var deepToken = this._consume(css_lexer_1.CssTokenType.Identifier);
                                var deepSlash = this._consume(css_lexer_1.CssTokenType.Character);
                                var index = lastOperatorToken.index;
                                var line = lastOperatorToken.line;
                                var column = lastOperatorToken.column;
                                if (deepToken != null && deepToken.strValue.toLowerCase() == 'deep' &&
                                    deepSlash.strValue == SLASH_CHARACTER) {
                                    token = new css_lexer_1.CssToken(lastOperatorToken.index, lastOperatorToken.column, lastOperatorToken.line, css_lexer_1.CssTokenType.Identifier, DEEP_OPERATOR_STR);
                                }
                                else {
                                    var text = SLASH_CHARACTER + deepToken.strValue + deepSlash.strValue;
                                    this._error(css_lexer_1.generateErrorMessage(this._getSourceContent(), text + " is an invalid CSS operator", text, index, line, column), lastOperatorToken);
                                    token = new css_lexer_1.CssToken(index, column, line, css_lexer_1.CssTokenType.Invalid, text);
                                }
                                break;
                            case GT_CHARACTER:
                                // >>> operator
                                if (this._scanner.peek == chars.$GT && this._scanner.peekPeek == chars.$GT) {
                                    this._consume(css_lexer_1.CssTokenType.Character, GT_CHARACTER);
                                    this._consume(css_lexer_1.CssTokenType.Character, GT_CHARACTER);
                                    token = new css_lexer_1.CssToken(lastOperatorToken.index, lastOperatorToken.column, lastOperatorToken.line, css_lexer_1.CssTokenType.Identifier, TRIPLE_GT_OPERATOR_STR);
                                }
                                break;
                        }
                        operator = token;
                    }
                }
                // so long as there is an operator then we can have an
                // ending value that is beyond the selector value ...
                // otherwise it's just a bunch of trailing whitespace
                if (operator != null) {
                    end = operator.index;
                }
            }
            this._scanner.consumeWhitespace();
            var strValue = this._extractSourceContent(start, end);
            // if we do come across one or more spaces inside of
            // the operators loop then an empty space is still a
            // valid operator to use if something else was not found
            if (operator == null && operatorScanCount > 0 && this._scanner.peek != chars.$LBRACE) {
                operator = lastOperatorToken;
            }
            // please note that `endToken` is reassigned multiple times below
            // so please do not optimize the if statements into if/elseif
            var startTokenOrAst = null;
            var endTokenOrAst = null;
            if (selectorCssTokens.length > 0) {
                startTokenOrAst = startTokenOrAst || selectorCssTokens[0];
                endTokenOrAst = selectorCssTokens[selectorCssTokens.length - 1];
            }
            if (pseudoSelectors.length > 0) {
                startTokenOrAst = startTokenOrAst || pseudoSelectors[0];
                endTokenOrAst = pseudoSelectors[pseudoSelectors.length - 1];
            }
            if (operator != null) {
                startTokenOrAst = startTokenOrAst || operator;
                endTokenOrAst = operator;
            }
            var span = this._generateSourceSpan(startTokenOrAst, endTokenOrAst);
            return new css_ast_1.CssSimpleSelectorAst(span, selectorCssTokens, strValue, pseudoSelectors, operator);
        };
        /** @internal */
        CssParser.prototype._parseSelector = function (delimiters) {
            delimiters |= COMMA_DELIM_FLAG;
            this._scanner.setMode(css_lexer_1.CssLexerMode.SELECTOR);
            var simpleSelectors = [];
            while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
                simpleSelectors.push(this._parseSimpleSelector(delimiters));
                this._scanner.consumeWhitespace();
            }
            var firstSelector = simpleSelectors[0];
            var lastSelector = simpleSelectors[simpleSelectors.length - 1];
            var span = this._generateSourceSpan(firstSelector, lastSelector);
            return new css_ast_1.CssSelectorAst(span, simpleSelectors);
        };
        /** @internal */
        CssParser.prototype._parseValue = function (delimiters) {
            delimiters |= RBRACE_DELIM_FLAG | SEMICOLON_DELIM_FLAG | NEWLINE_DELIM_FLAG;
            this._scanner.setMode(css_lexer_1.CssLexerMode.STYLE_VALUE);
            var start = this._getScannerIndex();
            var tokens = [];
            var wsStr = '';
            var previous = undefined;
            while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
                var token = void 0;
                if (previous != null && previous.type == css_lexer_1.CssTokenType.Identifier &&
                    this._scanner.peek == chars.$LPAREN) {
                    token = this._consume(css_lexer_1.CssTokenType.Character, '(');
                    tokens.push(token);
                    this._scanner.setMode(css_lexer_1.CssLexerMode.STYLE_VALUE_FUNCTION);
                    token = this._scan();
                    tokens.push(token);
                    this._scanner.setMode(css_lexer_1.CssLexerMode.STYLE_VALUE);
                    token = this._consume(css_lexer_1.CssTokenType.Character, ')');
                    tokens.push(token);
                }
                else {
                    token = this._scan();
                    if (token.type == css_lexer_1.CssTokenType.Whitespace) {
                        wsStr += token.strValue;
                    }
                    else {
                        wsStr = '';
                        tokens.push(token);
                    }
                }
                previous = token;
            }
            var end = this._getScannerIndex() - 1;
            this._scanner.consumeWhitespace();
            var code = this._scanner.peek;
            if (code == chars.$SEMICOLON) {
                this._consume(css_lexer_1.CssTokenType.Character, ';');
            }
            else if (code != chars.$RBRACE) {
                this._error(css_lexer_1.generateErrorMessage(this._getSourceContent(), "The CSS key/value definition did not end with a semicolon", previous.strValue, previous.index, previous.line, previous.column), previous);
            }
            var strValue = this._extractSourceContent(start, end);
            var startToken = tokens[0];
            var endToken = tokens[tokens.length - 1];
            var span = this._generateSourceSpan(startToken, endToken);
            return new css_ast_1.CssStyleValueAst(span, tokens, strValue);
        };
        /** @internal */
        CssParser.prototype._collectUntilDelim = function (delimiters, assertType) {
            if (assertType === void 0) { assertType = null; }
            var tokens = [];
            while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
                var val = assertType != null ? this._consume(assertType) : this._scan();
                tokens.push(val);
            }
            return tokens;
        };
        /** @internal */
        CssParser.prototype._parseBlock = function (delimiters) {
            delimiters |= RBRACE_DELIM_FLAG;
            this._scanner.setMode(css_lexer_1.CssLexerMode.BLOCK);
            var startToken = this._consume(css_lexer_1.CssTokenType.Character, '{');
            this._scanner.consumeEmptyStatements();
            var results = [];
            while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
                results.push(this._parseRule(delimiters));
            }
            var endToken = this._consume(css_lexer_1.CssTokenType.Character, '}');
            this._scanner.setMode(css_lexer_1.CssLexerMode.BLOCK);
            this._scanner.consumeEmptyStatements();
            var span = this._generateSourceSpan(startToken, endToken);
            return new css_ast_1.CssBlockAst(span, results);
        };
        /** @internal */
        CssParser.prototype._parseStyleBlock = function (delimiters) {
            delimiters |= RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG;
            this._scanner.setMode(css_lexer_1.CssLexerMode.STYLE_BLOCK);
            var startToken = this._consume(css_lexer_1.CssTokenType.Character, '{');
            if (startToken.numValue != chars.$LBRACE) {
                return null;
            }
            var definitions = [];
            this._scanner.consumeEmptyStatements();
            while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
                definitions.push(this._parseDefinition(delimiters));
                this._scanner.consumeEmptyStatements();
            }
            var endToken = this._consume(css_lexer_1.CssTokenType.Character, '}');
            this._scanner.setMode(css_lexer_1.CssLexerMode.STYLE_BLOCK);
            this._scanner.consumeEmptyStatements();
            var span = this._generateSourceSpan(startToken, endToken);
            return new css_ast_1.CssStylesBlockAst(span, definitions);
        };
        /** @internal */
        CssParser.prototype._parseDefinition = function (delimiters) {
            this._scanner.setMode(css_lexer_1.CssLexerMode.STYLE_BLOCK);
            var prop = this._consume(css_lexer_1.CssTokenType.Identifier);
            var parseValue = false;
            var value = null;
            var endToken = prop;
            // the colon value separates the prop from the style.
            // there are a few cases as to what could happen if it
            // is missing
            switch (this._scanner.peek) {
                case chars.$SEMICOLON:
                case chars.$RBRACE:
                case chars.$EOF:
                    parseValue = false;
                    break;
                default:
                    var propStr_1 = [prop.strValue];
                    if (this._scanner.peek != chars.$COLON) {
                        // this will throw the error
                        var nextValue = this._consume(css_lexer_1.CssTokenType.Character, ':');
                        propStr_1.push(nextValue.strValue);
                        var remainingTokens = this._collectUntilDelim(delimiters | COLON_DELIM_FLAG | SEMICOLON_DELIM_FLAG, css_lexer_1.CssTokenType.Identifier);
                        if (remainingTokens.length > 0) {
                            remainingTokens.forEach(function (token) { propStr_1.push(token.strValue); });
                        }
                        endToken = prop =
                            new css_lexer_1.CssToken(prop.index, prop.column, prop.line, prop.type, propStr_1.join(' '));
                    }
                    // this means we've reached the end of the definition and/or block
                    if (this._scanner.peek == chars.$COLON) {
                        this._consume(css_lexer_1.CssTokenType.Character, ':');
                        parseValue = true;
                    }
                    break;
            }
            if (parseValue) {
                value = this._parseValue(delimiters);
                endToken = value;
            }
            else {
                this._error(css_lexer_1.generateErrorMessage(this._getSourceContent(), "The CSS property was not paired with a style value", prop.strValue, prop.index, prop.line, prop.column), prop);
            }
            var span = this._generateSourceSpan(prop, endToken);
            return new css_ast_1.CssDefinitionAst(span, prop, value);
        };
        /** @internal */
        CssParser.prototype._assertCondition = function (status, errorMessage, problemToken) {
            if (!status) {
                this._error(errorMessage, problemToken);
                return true;
            }
            return false;
        };
        /** @internal */
        CssParser.prototype._error = function (message, problemToken) {
            var length = problemToken.strValue.length;
            var error = CssParseError.create(this._file, 0, problemToken.line, problemToken.column, length, message);
            this._errors.push(error);
        };
        return CssParser;
    }());
    exports.CssParser = CssParser;
    var CssParseError = /** @class */ (function (_super) {
        tslib_1.__extends(CssParseError, _super);
        function CssParseError(span, message) {
            return _super.call(this, span, message) || this;
        }
        CssParseError.create = function (file, offset, line, col, length, errMsg) {
            var start = new parse_util_1.ParseLocation(file, offset, line, col);
            var end = new parse_util_1.ParseLocation(file, offset, line, col + length);
            var span = new parse_util_1.ParseSourceSpan(start, end);
            return new CssParseError(span, 'CSS Parse Error: ' + errMsg);
        };
        return CssParseError;
    }(parse_util_1.ParseError));
    exports.CssParseError = CssParseError;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzX3BhcnNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jc3NfcGFyc2VyL2Nzc19wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsbURBQWtDO0lBQ2xDLCtEQUEwRjtJQUUxRixvRUFBK2E7SUFDL2Esd0VBQXVJO0lBRXZJLElBQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztJQUUzQix3RUFBcUM7SUFBN0IsK0JBQUEsUUFBUSxDQUFBO0lBQ2hCLG9FQUFvQztJQUE1Qiw4QkFBQSxTQUFTLENBQUE7SUFFakIsSUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDO0lBQzVCLElBQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQztJQUN6QixJQUFNLHNCQUFzQixHQUFHLEtBQUssQ0FBQztJQUNyQyxJQUFNLGlCQUFpQixHQUFHLFFBQVEsQ0FBQztJQUVuQyxJQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7SUFDekIsSUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7SUFDNUIsSUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7SUFDNUIsSUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7SUFDM0IsSUFBTSxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7SUFDNUIsSUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUM7SUFDaEMsSUFBTSxrQkFBa0IsR0FBRyxFQUFFLENBQUM7SUFDOUIsSUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUM7SUFDOUIsSUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUM7SUFDOUIsSUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7SUFFN0IsU0FBUyxxQ0FBcUMsQ0FBQyxJQUFZO1FBQ3pELE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFD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Z0JBQUM7SUFBRCxDQUFDLEFBdnlCRCxJQXV5QkM7SUF2eUJZLDhCQUFTO0lBeXlCdEI7UUFBbUMseUNBQVU7UUFVM0MsdUJBQVksSUFBcUIsRUFBRSxPQUFlO21CQUFJLGtCQUFNLElBQUksRUFBRSxPQUFPLENBQUM7UUFBRSxDQUFDO1FBVHRFLG9CQUFNLEdBQWIsVUFDSSxJQUFxQixFQUFFLE1BQWMsRUFBRSxJQUFZLEVBQUUsR0FBVyxFQUFFLE1BQWMsRUFDaEYsTUFBYztZQUNoQixJQUFNLEtBQUssR0FBRyxJQUFJLDBCQUFhLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDekQsSUFBTSxHQUFHLEdBQUcsSUFBSSwwQkFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQztZQUNoRSxJQUFNLElBQUksR0FBRyxJQUFJLDRCQUFlLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzdDLE9BQU8sSUFBSSxhQUFhLENBQUMsSUFBSSxFQUFFLG1CQUFtQixHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFHSCxvQkFBQztJQUFELENBQUMsQUFYRCxDQUFtQyx1QkFBVSxHQVc1QztJQVhZLHNDQUFhIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGFycyBmcm9tICcuLi9jaGFycyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlTG9jYXRpb24sIFBhcnNlU291cmNlRmlsZSwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0IHtCbG9ja1R5cGUsIENzc0FzdCwgQ3NzQXRSdWxlUHJlZGljYXRlQXN0LCBDc3NCbG9ja0FzdCwgQ3NzQmxvY2tEZWZpbml0aW9uUnVsZUFzdCwgQ3NzQmxvY2tSdWxlQXN0LCBDc3NEZWZpbml0aW9uQXN0LCBDc3NJbmxpbmVSdWxlQXN0LCBDc3NLZXlmcmFtZURlZmluaXRpb25Bc3QsIENzc0tleWZyYW1lUnVsZUFzdCwgQ3NzTWVkaWFRdWVyeVJ1bGVBc3QsIENzc1BzZXVkb1NlbGVjdG9yQXN0LCBDc3NSdWxlQXN0LCBDc3NTZWxlY3RvckFzdCwgQ3NzU2VsZWN0b3JSdWxlQXN0LCBDc3NTaW1wbGVTZWxlY3RvckFzdCwgQ3NzU3R5bGVTaGVldEFzdCwgQ3NzU3R5bGVWYWx1ZUFzdCwgQ3NzU3R5bGVzQmxvY2tBc3QsIENzc1Vua25vd25SdWxlQXN0LCBDc3NVbmtub3duVG9rZW5MaXN0QXN0LCBtZXJnZVRva2Vuc30gZnJvbSAnLi9jc3NfYXN0JztcbmltcG9ydCB7Q3NzTGV4ZXIsIENzc0xleGVyTW9kZSwgQ3NzU2Nhbm5lciwgQ3NzVG9rZW4sIENzc1Rva2VuVHlwZSwgZ2VuZXJhdGVFcnJvck1lc3NhZ2UsIGdldFJhd01lc3NhZ2UsIGlzTmV3bGluZX0gZnJvbSAnLi9jc3NfbGV4ZXInO1xuXG5jb25zdCBTUEFDRV9PUEVSQVRPUiA9ICcgJztcblxuZXhwb3J0IHtDc3NUb2tlbn0gZnJvbSAnLi9jc3NfbGV4ZXInO1xuZXhwb3J0IHtCbG9ja1R5cGV9IGZyb20gJy4vY3NzX2FzdCc7XG5cbmNvbnN0IFNMQVNIX0NIQVJBQ1RFUiA9ICcvJztcbmNvbnN0IEdUX0NIQVJBQ1RFUiA9ICc+JztcbmNvbnN0IFRSSVBMRV9HVF9PUEVSQVRPUl9TVFIgPSAnPj4+JztcbmNvbnN0IERFRVBfT1BFUkFUT1JfU1RSID0gJy9kZWVwLyc7XG5cbmNvbnN0IEVPRl9ERUxJTV9GTEFHID0gMTtcbmNvbnN0IFJCUkFDRV9ERUxJTV9GTEFHID0gMjtcbmNvbnN0IExCUkFDRV9ERUxJTV9GTEFHID0gNDtcbmNvbnN0IENPTU1BX0RFTElNX0ZMQUcgPSA4O1xuY29uc3QgQ09MT05fREVMSU1fRkxBRyA9IDE2O1xuY29uc3QgU0VNSUNPTE9OX0RFTElNX0ZMQUcgPSAzMjtcbmNvbnN0IE5FV0xJTkVfREVMSU1fRkxBRyA9IDY0O1xuY29uc3QgUlBBUkVOX0RFTElNX0ZMQUcgPSAxMjg7XG5jb25zdCBMUEFSRU5fREVMSU1fRkxBRyA9IDI1NjtcbmNvbnN0IFNQQUNFX0RFTElNX0ZMQUcgPSA1MTI7XG5cbmZ1bmN0aW9uIF9wc2V1ZG9TZWxlY3RvclN1cHBvcnRzSW5uZXJTZWxlY3RvcnMobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBbJ25vdCcsICdob3N0JywgJ2hvc3QtY29udGV4dCddLmluZGV4T2YobmFtZSkgPj0gMDtcbn1cblxuZnVuY3Rpb24gaXNTZWxlY3Rvck9wZXJhdG9yQ2hhcmFjdGVyKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICBzd2l0Y2ggKGNvZGUpIHtcbiAgICBjYXNlIGNoYXJzLiRTTEFTSDpcbiAgICBjYXNlIGNoYXJzLiRUSUxEQTpcbiAgICBjYXNlIGNoYXJzLiRQTFVTOlxuICAgIGNhc2UgY2hhcnMuJEdUOlxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBjaGFycy5pc1doaXRlc3BhY2UoY29kZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0RGVsaW1Gcm9tQ2hhcmFjdGVyKGNvZGU6IG51bWJlcik6IG51bWJlciB7XG4gIHN3aXRjaCAoY29kZSkge1xuICAgIGNhc2UgY2hhcnMuJEVPRjpcbiAgICAgIHJldHVybiBFT0ZfREVMSU1fRkxBRztcbiAgICBjYXNlIGNoYXJzLiRDT01NQTpcbiAgICAgIHJldHVybiBDT01NQV9ERUxJTV9GTEFHO1xuICAgIGNhc2UgY2hhcnMuJENPTE9OOlxuICAgICAgcmV0dXJuIENPTE9OX0RFTElNX0ZMQUc7XG4gICAgY2FzZSBjaGFycy4kU0VNSUNPTE9OOlxuICAgICAgcmV0dXJuIFNFTUlDT0xPTl9ERUxJTV9GTEFHO1xuICAgIGNhc2UgY2hhcnMuJFJCUkFDRTpcbiAgICAgIHJldHVybiBSQlJBQ0VfREVMSU1fRkxBRztcbiAgICBjYXNlIGNoYXJzLiRMQlJBQ0U6XG4gICAgICByZXR1cm4gTEJSQUNFX0RFTElNX0ZMQUc7XG4gICAgY2FzZSBjaGFycy4kUlBBUkVOOlxuICAgICAgcmV0dXJuIFJQQVJFTl9ERUxJTV9GTEFHO1xuICAgIGNhc2UgY2hhcnMuJFNQQUNFOlxuICAgIGNhc2UgY2hhcnMuJFRBQjpcbiAgICAgIHJldHVybiBTUEFDRV9ERUxJTV9GTEFHO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gaXNOZXdsaW5lKGNvZGUpID8gTkVXTElORV9ERUxJTV9GTEFHIDogMDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcihjb2RlOiBudW1iZXIsIGRlbGltaXRlcnM6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKGdldERlbGltRnJvbUNoYXJhY3Rlcihjb2RlKSAmIGRlbGltaXRlcnMpID4gMDtcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlZENzc1Jlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlcnJvcnM6IENzc1BhcnNlRXJyb3JbXSwgcHVibGljIGFzdDogQ3NzU3R5bGVTaGVldEFzdCkge31cbn1cblxuZXhwb3J0IGNsYXNzIENzc1BhcnNlciB7XG4gIHByaXZhdGUgX2Vycm9yczogQ3NzUGFyc2VFcnJvcltdID0gW107XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICBwcml2YXRlIF9maWxlICE6IFBhcnNlU291cmNlRmlsZTtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgX3NjYW5uZXIgITogQ3NzU2Nhbm5lcjtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgX2xhc3RUb2tlbiAhOiBDc3NUb2tlbjtcblxuICAvKipcbiAgICogQHBhcmFtIGNzcyB0aGUgQ1NTIGNvZGUgdGhhdCB3aWxsIGJlIHBhcnNlZFxuICAgKiBAcGFyYW0gdXJsIHRoZSBuYW1lIG9mIHRoZSBDU1MgZmlsZSBjb250YWluaW5nIHRoZSBDU1Mgc291cmNlIGNvZGVcbiAgICovXG4gIHBhcnNlKGNzczogc3RyaW5nLCB1cmw6IHN0cmluZyk6IFBhcnNlZENzc1Jlc3VsdCB7XG4gICAgY29uc3QgbGV4ZXIgPSBuZXcgQ3NzTGV4ZXIoKTtcbiAgICB0aGlzLl9maWxlID0gbmV3IFBhcnNlU291cmNlRmlsZShjc3MsIHVybCk7XG4gICAgdGhpcy5fc2Nhbm5lciA9IGxleGVyLnNjYW4oY3NzLCBmYWxzZSk7XG5cbiAgICBjb25zdCBhc3QgPSB0aGlzLl9wYXJzZVN0eWxlU2hlZXQoRU9GX0RFTElNX0ZMQUcpO1xuXG4gICAgY29uc3QgZXJyb3JzID0gdGhpcy5fZXJyb3JzO1xuICAgIHRoaXMuX2Vycm9ycyA9IFtdO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IFBhcnNlZENzc1Jlc3VsdChlcnJvcnMsIGFzdCk7XG4gICAgdGhpcy5fZmlsZSA9IG51bGwgYXMgYW55O1xuICAgIHRoaXMuX3NjYW5uZXIgPSBudWxsIGFzIGFueTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VTdHlsZVNoZWV0KGRlbGltaXRlcnM6IG51bWJlcik6IENzc1N0eWxlU2hlZXRBc3Qge1xuICAgIGNvbnN0IHJlc3VsdHM6IENzc1J1bGVBc3RbXSA9IFtdO1xuICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZUVtcHR5U3RhdGVtZW50cygpO1xuICAgIHdoaWxlICh0aGlzLl9zY2FubmVyLnBlZWsgIT0gY2hhcnMuJEVPRikge1xuICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5CTE9DSyk7XG4gICAgICByZXN1bHRzLnB1c2godGhpcy5fcGFyc2VSdWxlKGRlbGltaXRlcnMpKTtcbiAgICB9XG4gICAgbGV0IHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbDtcbiAgICBpZiAocmVzdWx0cy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBmaXJzdFJ1bGUgPSByZXN1bHRzWzBdO1xuICAgICAgLy8gd2UgY29sbGVjdCB0aGUgbGFzdCB0b2tlbiBsaWtlIHNvIGluY2FzZSB0aGVyZSB3YXMgYW5cbiAgICAgIC8vIEVPRiB0b2tlbiB0aGF0IHdhcyBlbWl0dGVkIHNvbWV0aW1lIGR1cmluZyB0aGUgbGV4aW5nXG4gICAgICBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKGZpcnN0UnVsZSwgdGhpcy5fbGFzdFRva2VuKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBDc3NTdHlsZVNoZWV0QXN0KHNwYW4gISwgcmVzdWx0cyk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZXRTb3VyY2VDb250ZW50KCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl9zY2FubmVyICE9IG51bGwgPyB0aGlzLl9zY2FubmVyLmlucHV0IDogJyc7IH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9leHRyYWN0U291cmNlQ29udGVudChzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcik6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuX2dldFNvdXJjZUNvbnRlbnQoKS5zdWJzdHJpbmcoc3RhcnQsIGVuZCArIDEpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZ2VuZXJhdGVTb3VyY2VTcGFuKHN0YXJ0OiBDc3NUb2tlbnxDc3NBc3QsIGVuZDogQ3NzVG9rZW58Q3NzQXN0fG51bGwgPSBudWxsKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICBsZXQgc3RhcnRMb2M6IFBhcnNlTG9jYXRpb247XG4gICAgaWYgKHN0YXJ0IGluc3RhbmNlb2YgQ3NzQXN0KSB7XG4gICAgICBzdGFydExvYyA9IHN0YXJ0LmxvY2F0aW9uLnN0YXJ0O1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgdG9rZW4gPSBzdGFydDtcbiAgICAgIGlmICh0b2tlbiA9PSBudWxsKSB7XG4gICAgICAgIC8vIHRoZSBkYXRhIGhlcmUgaXMgaW52YWxpZCwgaG93ZXZlciwgaWYgYW5kIHdoZW4gdGhpcyBkb2VzXG4gICAgICAgIC8vIG9jY3VyLCBhbnkgb3RoZXIgZXJyb3JzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHdpbGwgYmUgY29sbGVjdGVkXG4gICAgICAgIHRva2VuID0gdGhpcy5fbGFzdFRva2VuO1xuICAgICAgfVxuICAgICAgc3RhcnRMb2MgPSBuZXcgUGFyc2VMb2NhdGlvbih0aGlzLl9maWxlLCB0b2tlbi5pbmRleCwgdG9rZW4ubGluZSwgdG9rZW4uY29sdW1uKTtcbiAgICB9XG5cbiAgICBpZiAoZW5kID09IG51bGwpIHtcbiAgICAgIGVuZCA9IHRoaXMuX2xhc3RUb2tlbjtcbiAgICB9XG5cbiAgICBsZXQgZW5kTGluZTogbnVtYmVyID0gLTE7XG4gICAgbGV0IGVuZENvbHVtbjogbnVtYmVyID0gLTE7XG4gICAgbGV0IGVuZEluZGV4OiBudW1iZXIgPSAtMTtcbiAgICBpZiAoZW5kIGluc3RhbmNlb2YgQ3NzQXN0KSB7XG4gICAgICBlbmRMaW5lID0gZW5kLmxvY2F0aW9uLmVuZC5saW5lICE7XG4gICAgICBlbmRDb2x1bW4gPSBlbmQubG9jYXRpb24uZW5kLmNvbCAhO1xuICAgICAgZW5kSW5kZXggPSBlbmQubG9jYXRpb24uZW5kLm9mZnNldCAhO1xuICAgIH0gZWxzZSBpZiAoZW5kIGluc3RhbmNlb2YgQ3NzVG9rZW4pIHtcbiAgICAgIGVuZExpbmUgPSBlbmQubGluZTtcbiAgICAgIGVuZENvbHVtbiA9IGVuZC5jb2x1bW47XG4gICAgICBlbmRJbmRleCA9IGVuZC5pbmRleDtcbiAgICB9XG5cbiAgICBjb25zdCBlbmRMb2MgPSBuZXcgUGFyc2VMb2NhdGlvbih0aGlzLl9maWxlLCBlbmRJbmRleCwgZW5kTGluZSwgZW5kQ29sdW1uKTtcbiAgICByZXR1cm4gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydExvYywgZW5kTG9jKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3Jlc29sdmVCbG9ja1R5cGUodG9rZW46IENzc1Rva2VuKTogQmxvY2tUeXBlIHtcbiAgICBzd2l0Y2ggKHRva2VuLnN0clZhbHVlKSB7XG4gICAgICBjYXNlICdALW8ta2V5ZnJhbWVzJzpcbiAgICAgIGNhc2UgJ0AtbW96LWtleWZyYW1lcyc6XG4gICAgICBjYXNlICdALXdlYmtpdC1rZXlmcmFtZXMnOlxuICAgICAgY2FzZSAnQGtleWZyYW1lcyc6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuS2V5ZnJhbWVzO1xuXG4gICAgICBjYXNlICdAY2hhcnNldCc6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuQ2hhcnNldDtcblxuICAgICAgY2FzZSAnQGltcG9ydCc6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuSW1wb3J0O1xuXG4gICAgICBjYXNlICdAbmFtZXNwYWNlJzpcbiAgICAgICAgcmV0dXJuIEJsb2NrVHlwZS5OYW1lc3BhY2U7XG5cbiAgICAgIGNhc2UgJ0BwYWdlJzpcbiAgICAgICAgcmV0dXJuIEJsb2NrVHlwZS5QYWdlO1xuXG4gICAgICBjYXNlICdAZG9jdW1lbnQnOlxuICAgICAgICByZXR1cm4gQmxvY2tUeXBlLkRvY3VtZW50O1xuXG4gICAgICBjYXNlICdAbWVkaWEnOlxuICAgICAgICByZXR1cm4gQmxvY2tUeXBlLk1lZGlhUXVlcnk7XG5cbiAgICAgIGNhc2UgJ0Bmb250LWZhY2UnOlxuICAgICAgICByZXR1cm4gQmxvY2tUeXBlLkZvbnRGYWNlO1xuXG4gICAgICBjYXNlICdAdmlld3BvcnQnOlxuICAgICAgICByZXR1cm4gQmxvY2tUeXBlLlZpZXdwb3J0O1xuXG4gICAgICBjYXNlICdAc3VwcG9ydHMnOlxuICAgICAgICByZXR1cm4gQmxvY2tUeXBlLlN1cHBvcnRzO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gQmxvY2tUeXBlLlVuc3VwcG9ydGVkO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlUnVsZShkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NSdWxlQXN0IHtcbiAgICBpZiAodGhpcy5fc2Nhbm5lci5wZWVrID09IGNoYXJzLiRBVCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcnNlQXRSdWxlKGRlbGltaXRlcnMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fcGFyc2VTZWxlY3RvclJ1bGUoZGVsaW1pdGVycyk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZUF0UnVsZShkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NSdWxlQXN0IHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2dldFNjYW5uZXJJbmRleCgpO1xuXG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5CTE9DSyk7XG4gICAgY29uc3QgdG9rZW4gPSB0aGlzLl9zY2FuKCk7XG4gICAgY29uc3Qgc3RhcnRUb2tlbiA9IHRva2VuO1xuXG4gICAgdGhpcy5fYXNzZXJ0Q29uZGl0aW9uKFxuICAgICAgICB0b2tlbi50eXBlID09IENzc1Rva2VuVHlwZS5BdEtleXdvcmQsXG4gICAgICAgIGBUaGUgQ1NTIFJ1bGUgJHt0b2tlbi5zdHJWYWx1ZX0gaXMgbm90IGEgdmFsaWQgW0BdIHJ1bGUuYCwgdG9rZW4pO1xuXG4gICAgbGV0IGJsb2NrOiBDc3NCbG9ja0FzdDtcbiAgICBjb25zdCB0eXBlID0gdGhpcy5fcmVzb2x2ZUJsb2NrVHlwZSh0b2tlbik7XG4gICAgbGV0IHNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgICBsZXQgdG9rZW5zOiBDc3NUb2tlbltdO1xuICAgIGxldCBlbmRUb2tlbjogQ3NzVG9rZW47XG4gICAgbGV0IGVuZDogbnVtYmVyO1xuICAgIGxldCBzdHJWYWx1ZTogc3RyaW5nO1xuICAgIGxldCBxdWVyeTogQ3NzQXRSdWxlUHJlZGljYXRlQXN0O1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSBCbG9ja1R5cGUuQ2hhcnNldDpcbiAgICAgIGNhc2UgQmxvY2tUeXBlLk5hbWVzcGFjZTpcbiAgICAgIGNhc2UgQmxvY2tUeXBlLkltcG9ydDpcbiAgICAgICAgbGV0IHZhbHVlID0gdGhpcy5fcGFyc2VWYWx1ZShkZWxpbWl0ZXJzKTtcbiAgICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5CTE9DSyk7XG4gICAgICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZUVtcHR5U3RhdGVtZW50cygpO1xuICAgICAgICBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKHN0YXJ0VG9rZW4sIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG5ldyBDc3NJbmxpbmVSdWxlQXN0KHNwYW4sIHR5cGUsIHZhbHVlKTtcblxuICAgICAgY2FzZSBCbG9ja1R5cGUuVmlld3BvcnQ6XG4gICAgICBjYXNlIEJsb2NrVHlwZS5Gb250RmFjZTpcbiAgICAgICAgYmxvY2sgPSB0aGlzLl9wYXJzZVN0eWxlQmxvY2soZGVsaW1pdGVycykgITtcbiAgICAgICAgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCBibG9jayk7XG4gICAgICAgIHJldHVybiBuZXcgQ3NzQmxvY2tSdWxlQXN0KHNwYW4sIHR5cGUsIGJsb2NrKTtcblxuICAgICAgY2FzZSBCbG9ja1R5cGUuS2V5ZnJhbWVzOlxuICAgICAgICB0b2tlbnMgPSB0aGlzLl9jb2xsZWN0VW50aWxEZWxpbShkZWxpbWl0ZXJzIHwgUkJSQUNFX0RFTElNX0ZMQUcgfCBMQlJBQ0VfREVMSU1fRkxBRyk7XG4gICAgICAgIC8vIGtleWZyYW1lcyBvbmx5IGhhdmUgb25lIGlkZW50aWZpZXIgbmFtZVxuICAgICAgICBsZXQgbmFtZSA9IHRva2Vuc1swXTtcbiAgICAgICAgYmxvY2sgPSB0aGlzLl9wYXJzZUtleWZyYW1lQmxvY2soZGVsaW1pdGVycyk7XG4gICAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgYmxvY2spO1xuICAgICAgICByZXR1cm4gbmV3IENzc0tleWZyYW1lUnVsZUFzdChzcGFuLCBuYW1lLCBibG9jayk7XG5cbiAgICAgIGNhc2UgQmxvY2tUeXBlLk1lZGlhUXVlcnk6XG4gICAgICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuTUVESUFfUVVFUlkpO1xuICAgICAgICB0b2tlbnMgPSB0aGlzLl9jb2xsZWN0VW50aWxEZWxpbShkZWxpbWl0ZXJzIHwgUkJSQUNFX0RFTElNX0ZMQUcgfCBMQlJBQ0VfREVMSU1fRkxBRyk7XG4gICAgICAgIGVuZFRva2VuID0gdG9rZW5zW3Rva2Vucy5sZW5ndGggLSAxXTtcbiAgICAgICAgLy8gd2UgZG8gbm90IHRyYWNrIHRoZSB3aGl0ZXNwYWNlIGFmdGVyIHRoZSBtZWRpYVF1ZXJ5IHByZWRpY2F0ZSBlbmRzXG4gICAgICAgIC8vIHNvIHdlIGhhdmUgdG8gY2FsY3VsYXRlIHRoZSBlbmQgc3RyaW5nIHZhbHVlIG9uIG91ciBvd25cbiAgICAgICAgZW5kID0gZW5kVG9rZW4uaW5kZXggKyBlbmRUb2tlbi5zdHJWYWx1ZS5sZW5ndGggLSAxO1xuICAgICAgICBzdHJWYWx1ZSA9IHRoaXMuX2V4dHJhY3RTb3VyY2VDb250ZW50KHN0YXJ0LCBlbmQpO1xuICAgICAgICBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKHN0YXJ0VG9rZW4sIGVuZFRva2VuKTtcbiAgICAgICAgcXVlcnkgPSBuZXcgQ3NzQXRSdWxlUHJlZGljYXRlQXN0KHNwYW4sIHN0clZhbHVlLCB0b2tlbnMpO1xuICAgICAgICBibG9jayA9IHRoaXMuX3BhcnNlQmxvY2soZGVsaW1pdGVycyk7XG4gICAgICAgIHN0clZhbHVlID0gdGhpcy5fZXh0cmFjdFNvdXJjZUNvbnRlbnQoc3RhcnQsIHRoaXMuX2dldFNjYW5uZXJJbmRleCgpIC0gMSk7XG4gICAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgYmxvY2spO1xuICAgICAgICByZXR1cm4gbmV3IENzc01lZGlhUXVlcnlSdWxlQXN0KHNwYW4sIHN0clZhbHVlLCBxdWVyeSwgYmxvY2spO1xuXG4gICAgICBjYXNlIEJsb2NrVHlwZS5Eb2N1bWVudDpcbiAgICAgIGNhc2UgQmxvY2tUeXBlLlN1cHBvcnRzOlxuICAgICAgY2FzZSBCbG9ja1R5cGUuUGFnZTpcbiAgICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5BVF9SVUxFX1FVRVJZKTtcbiAgICAgICAgdG9rZW5zID0gdGhpcy5fY29sbGVjdFVudGlsRGVsaW0oZGVsaW1pdGVycyB8IFJCUkFDRV9ERUxJTV9GTEFHIHwgTEJSQUNFX0RFTElNX0ZMQUcpO1xuICAgICAgICBlbmRUb2tlbiA9IHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV07XG4gICAgICAgIC8vIHdlIGRvIG5vdCB0cmFjayB0aGUgd2hpdGVzcGFjZSBhZnRlciB0aGlzIGJsb2NrIHJ1bGUgcHJlZGljYXRlIGVuZHNcbiAgICAgICAgLy8gc28gd2UgaGF2ZSB0byBjYWxjdWxhdGUgdGhlIGVuZCBzdHJpbmcgdmFsdWUgb24gb3VyIG93blxuICAgICAgICBlbmQgPSBlbmRUb2tlbi5pbmRleCArIGVuZFRva2VuLnN0clZhbHVlLmxlbmd0aCAtIDE7XG4gICAgICAgIHN0clZhbHVlID0gdGhpcy5fZXh0cmFjdFNvdXJjZUNvbnRlbnQoc3RhcnQsIGVuZCk7XG4gICAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgdG9rZW5zW3Rva2Vucy5sZW5ndGggLSAxXSk7XG4gICAgICAgIHF1ZXJ5ID0gbmV3IENzc0F0UnVsZVByZWRpY2F0ZUFzdChzcGFuLCBzdHJWYWx1ZSwgdG9rZW5zKTtcbiAgICAgICAgYmxvY2sgPSB0aGlzLl9wYXJzZUJsb2NrKGRlbGltaXRlcnMpO1xuICAgICAgICBzdHJWYWx1ZSA9IHRoaXMuX2V4dHJhY3RTb3VyY2VDb250ZW50KHN0YXJ0LCBibG9jay5lbmQub2Zmc2V0ICEpO1xuICAgICAgICBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKHN0YXJ0VG9rZW4sIGJsb2NrKTtcbiAgICAgICAgcmV0dXJuIG5ldyBDc3NCbG9ja0RlZmluaXRpb25SdWxlQXN0KHNwYW4sIHN0clZhbHVlLCB0eXBlLCBxdWVyeSwgYmxvY2spO1xuXG4gICAgICAvLyBpZiBhIGN1c3RvbSBAcnVsZSB7IC4uLiB9IGlzIHVzZWQgaXQgc2hvdWxkIHN0aWxsIHRva2VuaXplIHRoZSBpbnNpZGVzXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZXQgbGlzdE9mVG9rZW5zOiBDc3NUb2tlbltdID0gW107XG4gICAgICAgIGxldCB0b2tlbk5hbWUgPSB0b2tlbi5zdHJWYWx1ZTtcbiAgICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5BTEwpO1xuICAgICAgICB0aGlzLl9lcnJvcihcbiAgICAgICAgICAgIGdlbmVyYXRlRXJyb3JNZXNzYWdlKFxuICAgICAgICAgICAgICAgIHRoaXMuX2dldFNvdXJjZUNvbnRlbnQoKSxcbiAgICAgICAgICAgICAgICBgVGhlIENTUyBcImF0XCIgcnVsZSBcIiR7dG9rZW5OYW1lfVwiIGlzIG5vdCBhbGxvd2VkIHRvIHVzZWQgaGVyZWAsIHRva2VuLnN0clZhbHVlLFxuICAgICAgICAgICAgICAgIHRva2VuLmluZGV4LCB0b2tlbi5saW5lLCB0b2tlbi5jb2x1bW4pLFxuICAgICAgICAgICAgdG9rZW4pO1xuXG4gICAgICAgIHRoaXMuX2NvbGxlY3RVbnRpbERlbGltKGRlbGltaXRlcnMgfCBMQlJBQ0VfREVMSU1fRkxBRyB8IFNFTUlDT0xPTl9ERUxJTV9GTEFHKVxuICAgICAgICAgICAgLmZvckVhY2goKHRva2VuKSA9PiB7IGxpc3RPZlRva2Vucy5wdXNoKHRva2VuKTsgfSk7XG4gICAgICAgIGlmICh0aGlzLl9zY2FubmVyLnBlZWsgPT0gY2hhcnMuJExCUkFDRSkge1xuICAgICAgICAgIGxpc3RPZlRva2Vucy5wdXNoKHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJ3snKSk7XG4gICAgICAgICAgdGhpcy5fY29sbGVjdFVudGlsRGVsaW0oZGVsaW1pdGVycyB8IFJCUkFDRV9ERUxJTV9GTEFHIHwgTEJSQUNFX0RFTElNX0ZMQUcpXG4gICAgICAgICAgICAgIC5mb3JFYWNoKCh0b2tlbikgPT4geyBsaXN0T2ZUb2tlbnMucHVzaCh0b2tlbik7IH0pO1xuICAgICAgICAgIGxpc3RPZlRva2Vucy5wdXNoKHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJ30nKSk7XG4gICAgICAgIH1cbiAgICAgICAgZW5kVG9rZW4gPSBsaXN0T2ZUb2tlbnNbbGlzdE9mVG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgICAgICBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKHN0YXJ0VG9rZW4sIGVuZFRva2VuKTtcbiAgICAgICAgcmV0dXJuIG5ldyBDc3NVbmtub3duUnVsZUFzdChzcGFuLCB0b2tlbk5hbWUsIGxpc3RPZlRva2Vucyk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VTZWxlY3RvclJ1bGUoZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzUnVsZUFzdCB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9nZXRTY2FubmVySW5kZXgoKTtcbiAgICBjb25zdCBzZWxlY3RvcnMgPSB0aGlzLl9wYXJzZVNlbGVjdG9ycyhkZWxpbWl0ZXJzKTtcbiAgICBjb25zdCBibG9jayA9IHRoaXMuX3BhcnNlU3R5bGVCbG9jayhkZWxpbWl0ZXJzKTtcbiAgICBsZXQgcnVsZUFzdDogQ3NzUnVsZUFzdDtcbiAgICBsZXQgc3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICAgIGNvbnN0IHN0YXJ0U2VsZWN0b3IgPSBzZWxlY3RvcnNbMF07XG4gICAgaWYgKGJsb2NrICE9IG51bGwpIHtcbiAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRTZWxlY3RvciwgYmxvY2spO1xuICAgICAgcnVsZUFzdCA9IG5ldyBDc3NTZWxlY3RvclJ1bGVBc3Qoc3Bhbiwgc2VsZWN0b3JzLCBibG9jayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLl9leHRyYWN0U291cmNlQ29udGVudChzdGFydCwgdGhpcy5fZ2V0U2Nhbm5lckluZGV4KCkgLSAxKTtcbiAgICAgIGNvbnN0IGlubmVyVG9rZW5zOiBDc3NUb2tlbltdID0gW107XG4gICAgICBzZWxlY3RvcnMuZm9yRWFjaCgoc2VsZWN0b3I6IENzc1NlbGVjdG9yQXN0KSA9PiB7XG4gICAgICAgIHNlbGVjdG9yLnNlbGVjdG9yUGFydHMuZm9yRWFjaCgocGFydDogQ3NzU2ltcGxlU2VsZWN0b3JBc3QpID0+IHtcbiAgICAgICAgICBwYXJ0LnRva2Vucy5mb3JFYWNoKCh0b2tlbjogQ3NzVG9rZW4pID0+IHsgaW5uZXJUb2tlbnMucHVzaCh0b2tlbik7IH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgZW5kVG9rZW4gPSBpbm5lclRva2Vuc1tpbm5lclRva2Vucy5sZW5ndGggLSAxXTtcbiAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRTZWxlY3RvciwgZW5kVG9rZW4pO1xuICAgICAgcnVsZUFzdCA9IG5ldyBDc3NVbmtub3duVG9rZW5MaXN0QXN0KHNwYW4sIG5hbWUsIGlubmVyVG9rZW5zKTtcbiAgICB9XG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5CTE9DSyk7XG4gICAgdGhpcy5fc2Nhbm5lci5jb25zdW1lRW1wdHlTdGF0ZW1lbnRzKCk7XG4gICAgcmV0dXJuIHJ1bGVBc3Q7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZVNlbGVjdG9ycyhkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NTZWxlY3RvckFzdFtdIHtcbiAgICBkZWxpbWl0ZXJzIHw9IExCUkFDRV9ERUxJTV9GTEFHIHwgU0VNSUNPTE9OX0RFTElNX0ZMQUc7XG5cbiAgICBjb25zdCBzZWxlY3RvcnM6IENzc1NlbGVjdG9yQXN0W10gPSBbXTtcbiAgICBsZXQgaXNQYXJzaW5nU2VsZWN0b3JzID0gdHJ1ZTtcbiAgICB3aGlsZSAoaXNQYXJzaW5nU2VsZWN0b3JzKSB7XG4gICAgICBzZWxlY3RvcnMucHVzaCh0aGlzLl9wYXJzZVNlbGVjdG9yKGRlbGltaXRlcnMpKTtcblxuICAgICAgaXNQYXJzaW5nU2VsZWN0b3JzID0gIWNoYXJhY3RlckNvbnRhaW5zRGVsaW1pdGVyKHRoaXMuX3NjYW5uZXIucGVlaywgZGVsaW1pdGVycyk7XG5cbiAgICAgIGlmIChpc1BhcnNpbmdTZWxlY3RvcnMpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnLCcpO1xuICAgICAgICBpc1BhcnNpbmdTZWxlY3RvcnMgPSAhY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBkZWxpbWl0ZXJzKTtcbiAgICAgICAgaWYgKGlzUGFyc2luZ1NlbGVjdG9ycykge1xuICAgICAgICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZVdoaXRlc3BhY2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzZWxlY3RvcnM7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9zY2FuKCk6IENzc1Rva2VuIHtcbiAgICBjb25zdCBvdXRwdXQgPSB0aGlzLl9zY2FubmVyLnNjYW4oKSAhO1xuICAgIGNvbnN0IHRva2VuID0gb3V0cHV0LnRva2VuO1xuICAgIGNvbnN0IGVycm9yID0gb3V0cHV0LmVycm9yO1xuICAgIGlmIChlcnJvciAhPSBudWxsKSB7XG4gICAgICB0aGlzLl9lcnJvcihnZXRSYXdNZXNzYWdlKGVycm9yKSwgdG9rZW4pO1xuICAgIH1cbiAgICB0aGlzLl9sYXN0VG9rZW4gPSB0b2tlbjtcbiAgICByZXR1cm4gdG9rZW47XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZXRTY2FubmVySW5kZXgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX3NjYW5uZXIuaW5kZXg7IH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9jb25zdW1lKHR5cGU6IENzc1Rva2VuVHlwZSwgdmFsdWU6IHN0cmluZ3xudWxsID0gbnVsbCk6IENzc1Rva2VuIHtcbiAgICBjb25zdCBvdXRwdXQgPSB0aGlzLl9zY2FubmVyLmNvbnN1bWUodHlwZSwgdmFsdWUpO1xuICAgIGNvbnN0IHRva2VuID0gb3V0cHV0LnRva2VuO1xuICAgIGNvbnN0IGVycm9yID0gb3V0cHV0LmVycm9yO1xuICAgIGlmIChlcnJvciAhPSBudWxsKSB7XG4gICAgICB0aGlzLl9lcnJvcihnZXRSYXdNZXNzYWdlKGVycm9yKSwgdG9rZW4pO1xuICAgIH1cbiAgICB0aGlzLl9sYXN0VG9rZW4gPSB0b2tlbjtcbiAgICByZXR1cm4gdG9rZW47XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZUtleWZyYW1lQmxvY2soZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzQmxvY2tBc3Qge1xuICAgIGRlbGltaXRlcnMgfD0gUkJSQUNFX0RFTElNX0ZMQUc7XG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5LRVlGUkFNRV9CTE9DSyk7XG5cbiAgICBjb25zdCBzdGFydFRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAneycpO1xuXG4gICAgY29uc3QgZGVmaW5pdGlvbnM6IENzc0tleWZyYW1lRGVmaW5pdGlvbkFzdFtdID0gW107XG4gICAgd2hpbGUgKCFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGRlbGltaXRlcnMpKSB7XG4gICAgICBkZWZpbml0aW9ucy5wdXNoKHRoaXMuX3BhcnNlS2V5ZnJhbWVEZWZpbml0aW9uKGRlbGltaXRlcnMpKTtcbiAgICB9XG5cbiAgICBjb25zdCBlbmRUb2tlbiA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJ30nKTtcblxuICAgIGNvbnN0IHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgZW5kVG9rZW4pO1xuICAgIHJldHVybiBuZXcgQ3NzQmxvY2tBc3Qoc3BhbiwgZGVmaW5pdGlvbnMpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VLZXlmcmFtZURlZmluaXRpb24oZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzS2V5ZnJhbWVEZWZpbml0aW9uQXN0IHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2dldFNjYW5uZXJJbmRleCgpO1xuICAgIGNvbnN0IHN0ZXBUb2tlbnM6IENzc1Rva2VuW10gPSBbXTtcbiAgICBkZWxpbWl0ZXJzIHw9IExCUkFDRV9ERUxJTV9GTEFHO1xuICAgIHdoaWxlICghY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBkZWxpbWl0ZXJzKSkge1xuICAgICAgc3RlcFRva2Vucy5wdXNoKHRoaXMuX3BhcnNlS2V5ZnJhbWVMYWJlbChkZWxpbWl0ZXJzIHwgQ09NTUFfREVMSU1fRkxBRykpO1xuICAgICAgaWYgKHRoaXMuX3NjYW5uZXIucGVlayAhPSBjaGFycy4kTEJSQUNFKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJywnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgc3R5bGVzQmxvY2sgPSB0aGlzLl9wYXJzZVN0eWxlQmxvY2soZGVsaW1pdGVycyB8IFJCUkFDRV9ERUxJTV9GTEFHKTtcbiAgICBjb25zdCBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKHN0ZXBUb2tlbnNbMF0sIHN0eWxlc0Jsb2NrKTtcbiAgICBjb25zdCBhc3QgPSBuZXcgQ3NzS2V5ZnJhbWVEZWZpbml0aW9uQXN0KHNwYW4sIHN0ZXBUb2tlbnMsIHN0eWxlc0Jsb2NrICEpO1xuXG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5CTE9DSyk7XG4gICAgcmV0dXJuIGFzdDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlS2V5ZnJhbWVMYWJlbChkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NUb2tlbiB7XG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5LRVlGUkFNRV9CTE9DSyk7XG4gICAgcmV0dXJuIG1lcmdlVG9rZW5zKHRoaXMuX2NvbGxlY3RVbnRpbERlbGltKGRlbGltaXRlcnMpKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlUHNldWRvU2VsZWN0b3IoZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzUHNldWRvU2VsZWN0b3JBc3Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fZ2V0U2Nhbm5lckluZGV4KCk7XG5cbiAgICBkZWxpbWl0ZXJzICY9IH5DT01NQV9ERUxJTV9GTEFHO1xuXG4gICAgLy8gd2Uga2VlcCB0aGUgb3JpZ2luYWwgdmFsdWUgc2luY2Ugd2UgbWF5IHVzZSBpdCB0byByZWN1cnNlIHdoZW4gOm5vdCwgOmhvc3QgYXJlIHVzZWRcbiAgICBjb25zdCBzdGFydGluZ0RlbGltcyA9IGRlbGltaXRlcnM7XG5cbiAgICBjb25zdCBzdGFydFRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnOicpO1xuICAgIGNvbnN0IHRva2VucyA9IFtzdGFydFRva2VuXTtcblxuICAgIGlmICh0aGlzLl9zY2FubmVyLnBlZWsgPT0gY2hhcnMuJENPTE9OKSB7ICAvLyA6OnNvbWV0aGluZ1xuICAgICAgdG9rZW5zLnB1c2godGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnOicpKTtcbiAgICB9XG5cbiAgICBjb25zdCBpbm5lclNlbGVjdG9yczogQ3NzU2VsZWN0b3JBc3RbXSA9IFtdO1xuXG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5QU0VVRE9fU0VMRUNUT1IpO1xuXG4gICAgLy8gaG9zdCwgaG9zdC1jb250ZXh0LCBsYW5nLCBub3QsIG50aC1jaGlsZCBhcmUgYWxsIGlkZW50aWZpZXJzXG4gICAgY29uc3QgcHNldWRvU2VsZWN0b3JUb2tlbiA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLklkZW50aWZpZXIpO1xuICAgIGNvbnN0IHBzZXVkb1NlbGVjdG9yTmFtZSA9IHBzZXVkb1NlbGVjdG9yVG9rZW4uc3RyVmFsdWU7XG4gICAgdG9rZW5zLnB1c2gocHNldWRvU2VsZWN0b3JUb2tlbik7XG5cbiAgICAvLyBob3N0KCksIGxhbmcoKSwgbnRoLWNoaWxkKCksIGV0Yy4uLlxuICAgIGlmICh0aGlzLl9zY2FubmVyLnBlZWsgPT0gY2hhcnMuJExQQVJFTikge1xuICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5QU0VVRE9fU0VMRUNUT1JfV0lUSF9BUkdVTUVOVFMpO1xuXG4gICAgICBjb25zdCBvcGVuUGFyZW5Ub2tlbiA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJygnKTtcbiAgICAgIHRva2Vucy5wdXNoKG9wZW5QYXJlblRva2VuKTtcblxuICAgICAgLy8gOmhvc3QoaW5uZXJTZWxlY3RvcihzKSksIDpub3Qoc2VsZWN0b3IpLCBldGMuLi5cbiAgICAgIGlmIChfcHNldWRvU2VsZWN0b3JTdXBwb3J0c0lubmVyU2VsZWN0b3JzKHBzZXVkb1NlbGVjdG9yTmFtZSkpIHtcbiAgICAgICAgbGV0IGlubmVyRGVsaW1zID0gc3RhcnRpbmdEZWxpbXMgfCBMUEFSRU5fREVMSU1fRkxBRyB8IFJQQVJFTl9ERUxJTV9GTEFHO1xuICAgICAgICBpZiAocHNldWRvU2VsZWN0b3JOYW1lID09ICdub3QnKSB7XG4gICAgICAgICAgLy8gdGhlIGlubmVyIHNlbGVjdG9yIGluc2lkZSBvZiA6bm90KC4uLikgY2FuIG9ubHkgYmUgb25lXG4gICAgICAgICAgLy8gQ1NTIHNlbGVjdG9yIChubyBjb21tYXMgYWxsb3dlZCkgLi4uIFRoaXMgaXMgYWNjb3JkaW5nXG4gICAgICAgICAgLy8gdG8gdGhlIENTUyBzcGVjaWZpY2F0aW9uXG4gICAgICAgICAgaW5uZXJEZWxpbXMgfD0gQ09NTUFfREVMSU1fRkxBRztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDpob3N0KGEsIGIsIGMpIHtcbiAgICAgICAgdGhpcy5fcGFyc2VTZWxlY3RvcnMoaW5uZXJEZWxpbXMpLmZvckVhY2goKHNlbGVjdG9yLCBpbmRleCkgPT4ge1xuICAgICAgICAgIGlubmVyU2VsZWN0b3JzLnB1c2goc2VsZWN0b3IpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHRoaXMgYnJhbmNoIGlzIGZvciB0aGluZ3MgbGlrZSBcImVuLXVzLCAyayArIDEsIGV0Yy4uLlwiXG4gICAgICAgIC8vIHdoaWNoIGFsbCBlbmQgdXAgaW4gcHNldWRvU2VsZWN0b3JzIGxpa2UgOmxhbmcsIDpudGgtY2hpbGQsIGV0Yy4uXG4gICAgICAgIGNvbnN0IGlubmVyVmFsdWVEZWxpbXMgPSBkZWxpbWl0ZXJzIHwgTEJSQUNFX0RFTElNX0ZMQUcgfCBDT0xPTl9ERUxJTV9GTEFHIHxcbiAgICAgICAgICAgIFJQQVJFTl9ERUxJTV9GTEFHIHwgTFBBUkVOX0RFTElNX0ZMQUc7XG4gICAgICAgIHdoaWxlICghY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBpbm5lclZhbHVlRGVsaW1zKSkge1xuICAgICAgICAgIGNvbnN0IHRva2VuID0gdGhpcy5fc2NhbigpO1xuICAgICAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBjbG9zZVBhcmVuVG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICcpJyk7XG4gICAgICB0b2tlbnMucHVzaChjbG9zZVBhcmVuVG9rZW4pO1xuICAgIH1cblxuICAgIGNvbnN0IGVuZCA9IHRoaXMuX2dldFNjYW5uZXJJbmRleCgpIC0gMTtcbiAgICBjb25zdCBzdHJWYWx1ZSA9IHRoaXMuX2V4dHJhY3RTb3VyY2VDb250ZW50KHN0YXJ0LCBlbmQpO1xuXG4gICAgY29uc3QgZW5kVG9rZW4gPSB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgZW5kVG9rZW4pO1xuICAgIHJldHVybiBuZXcgQ3NzUHNldWRvU2VsZWN0b3JBc3Qoc3Bhbiwgc3RyVmFsdWUsIHBzZXVkb1NlbGVjdG9yTmFtZSwgdG9rZW5zLCBpbm5lclNlbGVjdG9ycyk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZVNpbXBsZVNlbGVjdG9yKGRlbGltaXRlcnM6IG51bWJlcik6IENzc1NpbXBsZVNlbGVjdG9yQXN0IHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2dldFNjYW5uZXJJbmRleCgpO1xuXG4gICAgZGVsaW1pdGVycyB8PSBDT01NQV9ERUxJTV9GTEFHO1xuXG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5TRUxFQ1RPUik7XG4gICAgY29uc3Qgc2VsZWN0b3JDc3NUb2tlbnM6IENzc1Rva2VuW10gPSBbXTtcbiAgICBjb25zdCBwc2V1ZG9TZWxlY3RvcnM6IENzc1BzZXVkb1NlbGVjdG9yQXN0W10gPSBbXTtcblxuICAgIGxldCBwcmV2aW91c1Rva2VuOiBDc3NUb2tlbiA9IHVuZGVmaW5lZCAhO1xuXG4gICAgY29uc3Qgc2VsZWN0b3JQYXJ0RGVsaW1pdGVycyA9IGRlbGltaXRlcnMgfCBTUEFDRV9ERUxJTV9GTEFHO1xuICAgIGxldCBsb29wT3ZlclNlbGVjdG9yID0gIWNoYXJhY3RlckNvbnRhaW5zRGVsaW1pdGVyKHRoaXMuX3NjYW5uZXIucGVlaywgc2VsZWN0b3JQYXJ0RGVsaW1pdGVycyk7XG5cbiAgICBsZXQgaGFzQXR0cmlidXRlRXJyb3IgPSBmYWxzZTtcbiAgICB3aGlsZSAobG9vcE92ZXJTZWxlY3Rvcikge1xuICAgICAgY29uc3QgcGVlayA9IHRoaXMuX3NjYW5uZXIucGVlaztcblxuICAgICAgc3dpdGNoIChwZWVrKSB7XG4gICAgICAgIGNhc2UgY2hhcnMuJENPTE9OOlxuICAgICAgICAgIGxldCBpbm5lclBzZXVkbyA9IHRoaXMuX3BhcnNlUHNldWRvU2VsZWN0b3IoZGVsaW1pdGVycyk7XG4gICAgICAgICAgcHNldWRvU2VsZWN0b3JzLnB1c2goaW5uZXJQc2V1ZG8pO1xuICAgICAgICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuU0VMRUNUT1IpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgY2hhcnMuJExCUkFDS0VUOlxuICAgICAgICAgIC8vIHdlIHNldCB0aGUgbW9kZSBhZnRlciB0aGUgc2NhbiBiZWNhdXNlIGF0dHJpYnV0ZSBtb2RlIGRvZXMgbm90XG4gICAgICAgICAgLy8gYWxsb3cgYXR0cmlidXRlIFtdIHZhbHVlcy4gQW5kIHRoaXMgYWxzbyB3aWxsIGNhdGNoIGFueSBlcnJvcnNcbiAgICAgICAgICAvLyBpZiBhbiBleHRyYSBcIltcIiBpcyB1c2VkIGluc2lkZS5cbiAgICAgICAgICBzZWxlY3RvckNzc1Rva2Vucy5wdXNoKHRoaXMuX3NjYW4oKSk7XG4gICAgICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5BVFRSSUJVVEVfU0VMRUNUT1IpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgY2hhcnMuJFJCUkFDS0VUOlxuICAgICAgICAgIGlmICh0aGlzLl9zY2FubmVyLmdldE1vZGUoKSAhPSBDc3NMZXhlck1vZGUuQVRUUklCVVRFX1NFTEVDVE9SKSB7XG4gICAgICAgICAgICBoYXNBdHRyaWJ1dGVFcnJvciA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHdlIHNldCB0aGUgbW9kZSBlYXJseSBiZWNhdXNlIGF0dHJpYnV0ZSBtb2RlIGRvZXMgbm90XG4gICAgICAgICAgLy8gYWxsb3cgYXR0cmlidXRlIFtdIHZhbHVlc1xuICAgICAgICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuU0VMRUNUT1IpO1xuICAgICAgICAgIHNlbGVjdG9yQ3NzVG9rZW5zLnB1c2godGhpcy5fc2NhbigpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmIChpc1NlbGVjdG9yT3BlcmF0b3JDaGFyYWN0ZXIocGVlaykpIHtcbiAgICAgICAgICAgIGxvb3BPdmVyU2VsZWN0b3IgPSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCB0b2tlbiA9IHRoaXMuX3NjYW4oKTtcbiAgICAgICAgICBwcmV2aW91c1Rva2VuID0gdG9rZW47XG4gICAgICAgICAgc2VsZWN0b3JDc3NUb2tlbnMucHVzaCh0b2tlbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGxvb3BPdmVyU2VsZWN0b3IgPSAhY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBzZWxlY3RvclBhcnREZWxpbWl0ZXJzKTtcbiAgICB9XG5cbiAgICBoYXNBdHRyaWJ1dGVFcnJvciA9XG4gICAgICAgIGhhc0F0dHJpYnV0ZUVycm9yIHx8IHRoaXMuX3NjYW5uZXIuZ2V0TW9kZSgpID09IENzc0xleGVyTW9kZS5BVFRSSUJVVEVfU0VMRUNUT1I7XG4gICAgaWYgKGhhc0F0dHJpYnV0ZUVycm9yKSB7XG4gICAgICB0aGlzLl9lcnJvcihcbiAgICAgICAgICBgVW5iYWxhbmNlZCBDU1MgYXR0cmlidXRlIHNlbGVjdG9yIGF0IGNvbHVtbiAke3ByZXZpb3VzVG9rZW4ubGluZX06JHtcbiAgICAgICAgICAgICAgcHJldmlvdXNUb2tlbi5jb2x1bW59YCxcbiAgICAgICAgICBwcmV2aW91c1Rva2VuKTtcbiAgICB9XG5cbiAgICBsZXQgZW5kID0gdGhpcy5fZ2V0U2Nhbm5lckluZGV4KCkgLSAxO1xuXG4gICAgLy8gdGhpcyBoYXBwZW5zIGlmIHRoZSBzZWxlY3RvciBpcyBub3QgZGlyZWN0bHkgZm9sbG93ZWQgYnlcbiAgICAvLyBhIGNvbW1hIG9yIGN1cmx5IGJyYWNlIHdpdGhvdXQgYSBzcGFjZSBpbiBiZXR3ZWVuXG4gICAgbGV0IG9wZXJhdG9yOiBDc3NUb2tlbnxudWxsID0gbnVsbDtcbiAgICBsZXQgb3BlcmF0b3JTY2FuQ291bnQgPSAwO1xuICAgIGxldCBsYXN0T3BlcmF0b3JUb2tlbjogQ3NzVG9rZW58bnVsbCA9IG51bGw7XG4gICAgaWYgKCFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGRlbGltaXRlcnMpKSB7XG4gICAgICB3aGlsZSAob3BlcmF0b3IgPT0gbnVsbCAmJiAhY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBkZWxpbWl0ZXJzKSAmJlxuICAgICAgICAgICAgIGlzU2VsZWN0b3JPcGVyYXRvckNoYXJhY3Rlcih0aGlzLl9zY2FubmVyLnBlZWspKSB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMuX3NjYW4oKTtcbiAgICAgICAgY29uc3QgdG9rZW5PcGVyYXRvciA9IHRva2VuLnN0clZhbHVlO1xuICAgICAgICBvcGVyYXRvclNjYW5Db3VudCsrO1xuICAgICAgICBsYXN0T3BlcmF0b3JUb2tlbiA9IHRva2VuO1xuICAgICAgICBpZiAodG9rZW5PcGVyYXRvciAhPSBTUEFDRV9PUEVSQVRPUikge1xuICAgICAgICAgIHN3aXRjaCAodG9rZW5PcGVyYXRvcikge1xuICAgICAgICAgICAgY2FzZSBTTEFTSF9DSEFSQUNURVI6XG4gICAgICAgICAgICAgIC8vIC9kZWVwLyBvcGVyYXRvclxuICAgICAgICAgICAgICBsZXQgZGVlcFRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuSWRlbnRpZmllcik7XG4gICAgICAgICAgICAgIGxldCBkZWVwU2xhc2ggPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIpO1xuICAgICAgICAgICAgICBsZXQgaW5kZXggPSBsYXN0T3BlcmF0b3JUb2tlbi5pbmRleDtcbiAgICAgICAgICAgICAgbGV0IGxpbmUgPSBsYXN0T3BlcmF0b3JUb2tlbi5saW5lO1xuICAgICAgICAgICAgICBsZXQgY29sdW1uID0gbGFzdE9wZXJhdG9yVG9rZW4uY29sdW1uO1xuICAgICAgICAgICAgICBpZiAoZGVlcFRva2VuICE9IG51bGwgJiYgZGVlcFRva2VuLnN0clZhbHVlLnRvTG93ZXJDYXNlKCkgPT0gJ2RlZXAnICYmXG4gICAgICAgICAgICAgICAgICBkZWVwU2xhc2guc3RyVmFsdWUgPT0gU0xBU0hfQ0hBUkFDVEVSKSB7XG4gICAgICAgICAgICAgICAgdG9rZW4gPSBuZXcgQ3NzVG9rZW4oXG4gICAgICAgICAgICAgICAgICAgIGxhc3RPcGVyYXRvclRva2VuLmluZGV4LCBsYXN0T3BlcmF0b3JUb2tlbi5jb2x1bW4sIGxhc3RPcGVyYXRvclRva2VuLmxpbmUsXG4gICAgICAgICAgICAgICAgICAgIENzc1Rva2VuVHlwZS5JZGVudGlmaWVyLCBERUVQX09QRVJBVE9SX1NUUik7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IFNMQVNIX0NIQVJBQ1RFUiArIGRlZXBUb2tlbi5zdHJWYWx1ZSArIGRlZXBTbGFzaC5zdHJWYWx1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9lcnJvcihcbiAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVFcnJvck1lc3NhZ2UoXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nZXRTb3VyY2VDb250ZW50KCksIGAke3RleHR9IGlzIGFuIGludmFsaWQgQ1NTIG9wZXJhdG9yYCwgdGV4dCwgaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lLCBjb2x1bW4pLFxuICAgICAgICAgICAgICAgICAgICBsYXN0T3BlcmF0b3JUb2tlbik7XG4gICAgICAgICAgICAgICAgdG9rZW4gPSBuZXcgQ3NzVG9rZW4oaW5kZXgsIGNvbHVtbiwgbGluZSwgQ3NzVG9rZW5UeXBlLkludmFsaWQsIHRleHQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIEdUX0NIQVJBQ1RFUjpcbiAgICAgICAgICAgICAgLy8gPj4+IG9wZXJhdG9yXG4gICAgICAgICAgICAgIGlmICh0aGlzLl9zY2FubmVyLnBlZWsgPT0gY2hhcnMuJEdUICYmIHRoaXMuX3NjYW5uZXIucGVla1BlZWsgPT0gY2hhcnMuJEdUKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCBHVF9DSEFSQUNURVIpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgR1RfQ0hBUkFDVEVSKTtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IG5ldyBDc3NUb2tlbihcbiAgICAgICAgICAgICAgICAgICAgbGFzdE9wZXJhdG9yVG9rZW4uaW5kZXgsIGxhc3RPcGVyYXRvclRva2VuLmNvbHVtbiwgbGFzdE9wZXJhdG9yVG9rZW4ubGluZSxcbiAgICAgICAgICAgICAgICAgICAgQ3NzVG9rZW5UeXBlLklkZW50aWZpZXIsIFRSSVBMRV9HVF9PUEVSQVRPUl9TVFIpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG9wZXJhdG9yID0gdG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc28gbG9uZyBhcyB0aGVyZSBpcyBhbiBvcGVyYXRvciB0aGVuIHdlIGNhbiBoYXZlIGFuXG4gICAgICAvLyBlbmRpbmcgdmFsdWUgdGhhdCBpcyBiZXlvbmQgdGhlIHNlbGVjdG9yIHZhbHVlIC4uLlxuICAgICAgLy8gb3RoZXJ3aXNlIGl0J3MganVzdCBhIGJ1bmNoIG9mIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAgICAgIGlmIChvcGVyYXRvciAhPSBudWxsKSB7XG4gICAgICAgIGVuZCA9IG9wZXJhdG9yLmluZGV4O1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZVdoaXRlc3BhY2UoKTtcblxuICAgIGNvbnN0IHN0clZhbHVlID0gdGhpcy5fZXh0cmFjdFNvdXJjZUNvbnRlbnQoc3RhcnQsIGVuZCk7XG5cbiAgICAvLyBpZiB3ZSBkbyBjb21lIGFjcm9zcyBvbmUgb3IgbW9yZSBzcGFjZXMgaW5zaWRlIG9mXG4gICAgLy8gdGhlIG9wZXJhdG9ycyBsb29wIHRoZW4gYW4gZW1wdHkgc3BhY2UgaXMgc3RpbGwgYVxuICAgIC8vIHZhbGlkIG9wZXJhdG9yIHRvIHVzZSBpZiBzb21ldGhpbmcgZWxzZSB3YXMgbm90IGZvdW5kXG4gICAgaWYgKG9wZXJhdG9yID09IG51bGwgJiYgb3BlcmF0b3JTY2FuQ291bnQgPiAwICYmIHRoaXMuX3NjYW5uZXIucGVlayAhPSBjaGFycy4kTEJSQUNFKSB7XG4gICAgICBvcGVyYXRvciA9IGxhc3RPcGVyYXRvclRva2VuO1xuICAgIH1cblxuICAgIC8vIHBsZWFzZSBub3RlIHRoYXQgYGVuZFRva2VuYCBpcyByZWFzc2lnbmVkIG11bHRpcGxlIHRpbWVzIGJlbG93XG4gICAgLy8gc28gcGxlYXNlIGRvIG5vdCBvcHRpbWl6ZSB0aGUgaWYgc3RhdGVtZW50cyBpbnRvIGlmL2Vsc2VpZlxuICAgIGxldCBzdGFydFRva2VuT3JBc3Q6IENzc1Rva2VufENzc0FzdHxudWxsID0gbnVsbDtcbiAgICBsZXQgZW5kVG9rZW5PckFzdDogQ3NzVG9rZW58Q3NzQXN0fG51bGwgPSBudWxsO1xuICAgIGlmIChzZWxlY3RvckNzc1Rva2Vucy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGFydFRva2VuT3JBc3QgPSBzdGFydFRva2VuT3JBc3QgfHwgc2VsZWN0b3JDc3NUb2tlbnNbMF07XG4gICAgICBlbmRUb2tlbk9yQXN0ID0gc2VsZWN0b3JDc3NUb2tlbnNbc2VsZWN0b3JDc3NUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgfVxuICAgIGlmIChwc2V1ZG9TZWxlY3RvcnMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhcnRUb2tlbk9yQXN0ID0gc3RhcnRUb2tlbk9yQXN0IHx8IHBzZXVkb1NlbGVjdG9yc1swXTtcbiAgICAgIGVuZFRva2VuT3JBc3QgPSBwc2V1ZG9TZWxlY3RvcnNbcHNldWRvU2VsZWN0b3JzLmxlbmd0aCAtIDFdO1xuICAgIH1cbiAgICBpZiAob3BlcmF0b3IgIT0gbnVsbCkge1xuICAgICAgc3RhcnRUb2tlbk9yQXN0ID0gc3RhcnRUb2tlbk9yQXN0IHx8IG9wZXJhdG9yO1xuICAgICAgZW5kVG9rZW5PckFzdCA9IG9wZXJhdG9yO1xuICAgIH1cblxuICAgIGNvbnN0IHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbk9yQXN0ICEsIGVuZFRva2VuT3JBc3QpO1xuICAgIHJldHVybiBuZXcgQ3NzU2ltcGxlU2VsZWN0b3JBc3Qoc3Bhbiwgc2VsZWN0b3JDc3NUb2tlbnMsIHN0clZhbHVlLCBwc2V1ZG9TZWxlY3RvcnMsIG9wZXJhdG9yICEpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VTZWxlY3RvcihkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NTZWxlY3RvckFzdCB7XG4gICAgZGVsaW1pdGVycyB8PSBDT01NQV9ERUxJTV9GTEFHO1xuICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuU0VMRUNUT1IpO1xuXG4gICAgY29uc3Qgc2ltcGxlU2VsZWN0b3JzOiBDc3NTaW1wbGVTZWxlY3RvckFzdFtdID0gW107XG4gICAgd2hpbGUgKCFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGRlbGltaXRlcnMpKSB7XG4gICAgICBzaW1wbGVTZWxlY3RvcnMucHVzaCh0aGlzLl9wYXJzZVNpbXBsZVNlbGVjdG9yKGRlbGltaXRlcnMpKTtcbiAgICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZVdoaXRlc3BhY2UoKTtcbiAgICB9XG5cbiAgICBjb25zdCBmaXJzdFNlbGVjdG9yID0gc2ltcGxlU2VsZWN0b3JzWzBdO1xuICAgIGNvbnN0IGxhc3RTZWxlY3RvciA9IHNpbXBsZVNlbGVjdG9yc1tzaW1wbGVTZWxlY3RvcnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3Qgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihmaXJzdFNlbGVjdG9yLCBsYXN0U2VsZWN0b3IpO1xuICAgIHJldHVybiBuZXcgQ3NzU2VsZWN0b3JBc3Qoc3Bhbiwgc2ltcGxlU2VsZWN0b3JzKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlVmFsdWUoZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzU3R5bGVWYWx1ZUFzdCB7XG4gICAgZGVsaW1pdGVycyB8PSBSQlJBQ0VfREVMSU1fRkxBRyB8IFNFTUlDT0xPTl9ERUxJTV9GTEFHIHwgTkVXTElORV9ERUxJTV9GTEFHO1xuXG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5TVFlMRV9WQUxVRSk7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9nZXRTY2FubmVySW5kZXgoKTtcblxuICAgIGNvbnN0IHRva2VuczogQ3NzVG9rZW5bXSA9IFtdO1xuICAgIGxldCB3c1N0ciA9ICcnO1xuICAgIGxldCBwcmV2aW91czogQ3NzVG9rZW4gPSB1bmRlZmluZWQgITtcbiAgICB3aGlsZSAoIWNoYXJhY3RlckNvbnRhaW5zRGVsaW1pdGVyKHRoaXMuX3NjYW5uZXIucGVlaywgZGVsaW1pdGVycykpIHtcbiAgICAgIGxldCB0b2tlbjogQ3NzVG9rZW47XG4gICAgICBpZiAocHJldmlvdXMgIT0gbnVsbCAmJiBwcmV2aW91cy50eXBlID09IENzc1Rva2VuVHlwZS5JZGVudGlmaWVyICYmXG4gICAgICAgICAgdGhpcy5fc2Nhbm5lci5wZWVrID09IGNoYXJzLiRMUEFSRU4pIHtcbiAgICAgICAgdG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICcoJyk7XG4gICAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcblxuICAgICAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLlNUWUxFX1ZBTFVFX0ZVTkNUSU9OKTtcblxuICAgICAgICB0b2tlbiA9IHRoaXMuX3NjYW4oKTtcbiAgICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuXG4gICAgICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuU1RZTEVfVkFMVUUpO1xuXG4gICAgICAgIHRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnKScpO1xuICAgICAgICB0b2tlbnMucHVzaCh0b2tlbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0b2tlbiA9IHRoaXMuX3NjYW4oKTtcbiAgICAgICAgaWYgKHRva2VuLnR5cGUgPT0gQ3NzVG9rZW5UeXBlLldoaXRlc3BhY2UpIHtcbiAgICAgICAgICB3c1N0ciArPSB0b2tlbi5zdHJWYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3c1N0ciA9ICcnO1xuICAgICAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcHJldmlvdXMgPSB0b2tlbjtcbiAgICB9XG5cbiAgICBjb25zdCBlbmQgPSB0aGlzLl9nZXRTY2FubmVySW5kZXgoKSAtIDE7XG4gICAgdGhpcy5fc2Nhbm5lci5jb25zdW1lV2hpdGVzcGFjZSgpO1xuXG4gICAgY29uc3QgY29kZSA9IHRoaXMuX3NjYW5uZXIucGVlaztcbiAgICBpZiAoY29kZSA9PSBjaGFycy4kU0VNSUNPTE9OKSB7XG4gICAgICB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICc7Jyk7XG4gICAgfSBlbHNlIGlmIChjb2RlICE9IGNoYXJzLiRSQlJBQ0UpIHtcbiAgICAgIHRoaXMuX2Vycm9yKFxuICAgICAgICAgIGdlbmVyYXRlRXJyb3JNZXNzYWdlKFxuICAgICAgICAgICAgICB0aGlzLl9nZXRTb3VyY2VDb250ZW50KCksIGBUaGUgQ1NTIGtleS92YWx1ZSBkZWZpbml0aW9uIGRpZCBub3QgZW5kIHdpdGggYSBzZW1pY29sb25gLFxuICAgICAgICAgICAgICBwcmV2aW91cy5zdHJWYWx1ZSwgcHJldmlvdXMuaW5kZXgsIHByZXZpb3VzLmxpbmUsIHByZXZpb3VzLmNvbHVtbiksXG4gICAgICAgICAgcHJldmlvdXMpO1xuICAgIH1cblxuICAgIGNvbnN0IHN0clZhbHVlID0gdGhpcy5fZXh0cmFjdFNvdXJjZUNvbnRlbnQoc3RhcnQsIGVuZCk7XG4gICAgY29uc3Qgc3RhcnRUb2tlbiA9IHRva2Vuc1swXTtcbiAgICBjb25zdCBlbmRUb2tlbiA9IHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3Qgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCBlbmRUb2tlbik7XG4gICAgcmV0dXJuIG5ldyBDc3NTdHlsZVZhbHVlQXN0KHNwYW4sIHRva2Vucywgc3RyVmFsdWUpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfY29sbGVjdFVudGlsRGVsaW0oZGVsaW1pdGVyczogbnVtYmVyLCBhc3NlcnRUeXBlOiBDc3NUb2tlblR5cGV8bnVsbCA9IG51bGwpOiBDc3NUb2tlbltdIHtcbiAgICBjb25zdCB0b2tlbnM6IENzc1Rva2VuW10gPSBbXTtcbiAgICB3aGlsZSAoIWNoYXJhY3RlckNvbnRhaW5zRGVsaW1pdGVyKHRoaXMuX3NjYW5uZXIucGVlaywgZGVsaW1pdGVycykpIHtcbiAgICAgIGNvbnN0IHZhbCA9IGFzc2VydFR5cGUgIT0gbnVsbCA/IHRoaXMuX2NvbnN1bWUoYXNzZXJ0VHlwZSkgOiB0aGlzLl9zY2FuKCk7XG4gICAgICB0b2tlbnMucHVzaCh2YWwpO1xuICAgIH1cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VCbG9jayhkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NCbG9ja0FzdCB7XG4gICAgZGVsaW1pdGVycyB8PSBSQlJBQ0VfREVMSU1fRkxBRztcblxuICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuQkxPQ0spO1xuXG4gICAgY29uc3Qgc3RhcnRUb2tlbiA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJ3snKTtcbiAgICB0aGlzLl9zY2FubmVyLmNvbnN1bWVFbXB0eVN0YXRlbWVudHMoKTtcblxuICAgIGNvbnN0IHJlc3VsdHM6IENzc1J1bGVBc3RbXSA9IFtdO1xuICAgIHdoaWxlICghY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBkZWxpbWl0ZXJzKSkge1xuICAgICAgcmVzdWx0cy5wdXNoKHRoaXMuX3BhcnNlUnVsZShkZWxpbWl0ZXJzKSk7XG4gICAgfVxuXG4gICAgY29uc3QgZW5kVG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICd9Jyk7XG5cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkJMT0NLKTtcbiAgICB0aGlzLl9zY2FubmVyLmNvbnN1bWVFbXB0eVN0YXRlbWVudHMoKTtcblxuICAgIGNvbnN0IHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgZW5kVG9rZW4pO1xuICAgIHJldHVybiBuZXcgQ3NzQmxvY2tBc3Qoc3BhbiwgcmVzdWx0cyk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZVN0eWxlQmxvY2soZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzU3R5bGVzQmxvY2tBc3R8bnVsbCB7XG4gICAgZGVsaW1pdGVycyB8PSBSQlJBQ0VfREVMSU1fRkxBRyB8IExCUkFDRV9ERUxJTV9GTEFHO1xuXG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5TVFlMRV9CTE9DSyk7XG5cbiAgICBjb25zdCBzdGFydFRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAneycpO1xuICAgIGlmIChzdGFydFRva2VuLm51bVZhbHVlICE9IGNoYXJzLiRMQlJBQ0UpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRlZmluaXRpb25zOiBDc3NEZWZpbml0aW9uQXN0W10gPSBbXTtcbiAgICB0aGlzLl9zY2FubmVyLmNvbnN1bWVFbXB0eVN0YXRlbWVudHMoKTtcblxuICAgIHdoaWxlICghY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBkZWxpbWl0ZXJzKSkge1xuICAgICAgZGVmaW5pdGlvbnMucHVzaCh0aGlzLl9wYXJzZURlZmluaXRpb24oZGVsaW1pdGVycykpO1xuICAgICAgdGhpcy5fc2Nhbm5lci5jb25zdW1lRW1wdHlTdGF0ZW1lbnRzKCk7XG4gICAgfVxuXG4gICAgY29uc3QgZW5kVG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICd9Jyk7XG5cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLlNUWUxFX0JMT0NLKTtcbiAgICB0aGlzLl9zY2FubmVyLmNvbnN1bWVFbXB0eVN0YXRlbWVudHMoKTtcblxuICAgIGNvbnN0IHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgZW5kVG9rZW4pO1xuICAgIHJldHVybiBuZXcgQ3NzU3R5bGVzQmxvY2tBc3Qoc3BhbiwgZGVmaW5pdGlvbnMpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VEZWZpbml0aW9uKGRlbGltaXRlcnM6IG51bWJlcik6IENzc0RlZmluaXRpb25Bc3Qge1xuICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuU1RZTEVfQkxPQ0spO1xuXG4gICAgbGV0IHByb3AgPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5JZGVudGlmaWVyKTtcbiAgICBsZXQgcGFyc2VWYWx1ZTogYm9vbGVhbiA9IGZhbHNlO1xuICAgIGxldCB2YWx1ZTogQ3NzU3R5bGVWYWx1ZUFzdHxudWxsID0gbnVsbDtcbiAgICBsZXQgZW5kVG9rZW46IENzc1Rva2VufENzc1N0eWxlVmFsdWVBc3QgPSBwcm9wO1xuXG4gICAgLy8gdGhlIGNvbG9uIHZhbHVlIHNlcGFyYXRlcyB0aGUgcHJvcCBmcm9tIHRoZSBzdHlsZS5cbiAgICAvLyB0aGVyZSBhcmUgYSBmZXcgY2FzZXMgYXMgdG8gd2hhdCBjb3VsZCBoYXBwZW4gaWYgaXRcbiAgICAvLyBpcyBtaXNzaW5nXG4gICAgc3dpdGNoICh0aGlzLl9zY2FubmVyLnBlZWspIHtcbiAgICAgIGNhc2UgY2hhcnMuJFNFTUlDT0xPTjpcbiAgICAgIGNhc2UgY2hhcnMuJFJCUkFDRTpcbiAgICAgIGNhc2UgY2hhcnMuJEVPRjpcbiAgICAgICAgcGFyc2VWYWx1ZSA9IGZhbHNlO1xuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGV0IHByb3BTdHIgPSBbcHJvcC5zdHJWYWx1ZV07XG4gICAgICAgIGlmICh0aGlzLl9zY2FubmVyLnBlZWsgIT0gY2hhcnMuJENPTE9OKSB7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIHRocm93IHRoZSBlcnJvclxuICAgICAgICAgIGNvbnN0IG5leHRWYWx1ZSA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJzonKTtcbiAgICAgICAgICBwcm9wU3RyLnB1c2gobmV4dFZhbHVlLnN0clZhbHVlKTtcblxuICAgICAgICAgIGNvbnN0IHJlbWFpbmluZ1Rva2VucyA9IHRoaXMuX2NvbGxlY3RVbnRpbERlbGltKFxuICAgICAgICAgICAgICBkZWxpbWl0ZXJzIHwgQ09MT05fREVMSU1fRkxBRyB8IFNFTUlDT0xPTl9ERUxJTV9GTEFHLCBDc3NUb2tlblR5cGUuSWRlbnRpZmllcik7XG4gICAgICAgICAgaWYgKHJlbWFpbmluZ1Rva2Vucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICByZW1haW5pbmdUb2tlbnMuZm9yRWFjaCgodG9rZW4pID0+IHsgcHJvcFN0ci5wdXNoKHRva2VuLnN0clZhbHVlKTsgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZW5kVG9rZW4gPSBwcm9wID1cbiAgICAgICAgICAgICAgbmV3IENzc1Rva2VuKHByb3AuaW5kZXgsIHByb3AuY29sdW1uLCBwcm9wLmxpbmUsIHByb3AudHlwZSwgcHJvcFN0ci5qb2luKCcgJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGhpcyBtZWFucyB3ZSd2ZSByZWFjaGVkIHRoZSBlbmQgb2YgdGhlIGRlZmluaXRpb24gYW5kL29yIGJsb2NrXG4gICAgICAgIGlmICh0aGlzLl9zY2FubmVyLnBlZWsgPT0gY2hhcnMuJENPTE9OKSB7XG4gICAgICAgICAgdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnOicpO1xuICAgICAgICAgIHBhcnNlVmFsdWUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChwYXJzZVZhbHVlKSB7XG4gICAgICB2YWx1ZSA9IHRoaXMuX3BhcnNlVmFsdWUoZGVsaW1pdGVycyk7XG4gICAgICBlbmRUb2tlbiA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9lcnJvcihcbiAgICAgICAgICBnZW5lcmF0ZUVycm9yTWVzc2FnZShcbiAgICAgICAgICAgICAgdGhpcy5fZ2V0U291cmNlQ29udGVudCgpLCBgVGhlIENTUyBwcm9wZXJ0eSB3YXMgbm90IHBhaXJlZCB3aXRoIGEgc3R5bGUgdmFsdWVgLFxuICAgICAgICAgICAgICBwcm9wLnN0clZhbHVlLCBwcm9wLmluZGV4LCBwcm9wLmxpbmUsIHByb3AuY29sdW1uKSxcbiAgICAgICAgICBwcm9wKTtcbiAgICB9XG5cbiAgICBjb25zdCBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKHByb3AsIGVuZFRva2VuKTtcbiAgICByZXR1cm4gbmV3IENzc0RlZmluaXRpb25Bc3Qoc3BhbiwgcHJvcCwgdmFsdWUgISk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9hc3NlcnRDb25kaXRpb24oc3RhdHVzOiBib29sZWFuLCBlcnJvck1lc3NhZ2U6IHN0cmluZywgcHJvYmxlbVRva2VuOiBDc3NUb2tlbik6IGJvb2xlYW4ge1xuICAgIGlmICghc3RhdHVzKSB7XG4gICAgICB0aGlzLl9lcnJvcihlcnJvck1lc3NhZ2UsIHByb2JsZW1Ub2tlbik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZXJyb3IobWVzc2FnZTogc3RyaW5nLCBwcm9ibGVtVG9rZW46IENzc1Rva2VuKSB7XG4gICAgY29uc3QgbGVuZ3RoID0gcHJvYmxlbVRva2VuLnN0clZhbHVlLmxlbmd0aDtcbiAgICBjb25zdCBlcnJvciA9IENzc1BhcnNlRXJyb3IuY3JlYXRlKFxuICAgICAgICB0aGlzLl9maWxlLCAwLCBwcm9ibGVtVG9rZW4ubGluZSwgcHJvYmxlbVRva2VuLmNvbHVtbiwgbGVuZ3RoLCBtZXNzYWdlKTtcbiAgICB0aGlzLl9lcnJvcnMucHVzaChlcnJvcik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENzc1BhcnNlRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgc3RhdGljIGNyZWF0ZShcbiAgICAgIGZpbGU6IFBhcnNlU291cmNlRmlsZSwgb2Zmc2V0OiBudW1iZXIsIGxpbmU6IG51bWJlciwgY29sOiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLFxuICAgICAgZXJyTXNnOiBzdHJpbmcpOiBDc3NQYXJzZUVycm9yIHtcbiAgICBjb25zdCBzdGFydCA9IG5ldyBQYXJzZUxvY2F0aW9uKGZpbGUsIG9mZnNldCwgbGluZSwgY29sKTtcbiAgICBjb25zdCBlbmQgPSBuZXcgUGFyc2VMb2NhdGlvbihmaWxlLCBvZmZzZXQsIGxpbmUsIGNvbCArIGxlbmd0aCk7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQsIGVuZCk7XG4gICAgcmV0dXJuIG5ldyBDc3NQYXJzZUVycm9yKHNwYW4sICdDU1MgUGFyc2UgRXJyb3I6ICcgKyBlcnJNc2cpO1xuICB9XG5cbiAgY29uc3RydWN0b3Ioc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBtZXNzYWdlOiBzdHJpbmcpIHsgc3VwZXIoc3BhbiwgbWVzc2FnZSk7IH1cbn1cbiJdfQ==