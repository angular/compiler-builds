/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as chars from '../chars';
import { ParseError, ParseLocation, ParseSourceFile, ParseSourceSpan } from '../parse_util';
import { BlockType, CssAst, CssAtRulePredicateAst, CssBlockAst, CssBlockDefinitionRuleAst, CssBlockRuleAst, CssDefinitionAst, CssInlineRuleAst, CssKeyframeDefinitionAst, CssKeyframeRuleAst, CssMediaQueryRuleAst, CssPseudoSelectorAst, CssSelectorAst, CssSelectorRuleAst, CssSimpleSelectorAst, CssStyleSheetAst, CssStyleValueAst, CssStylesBlockAst, CssUnknownRuleAst, CssUnknownTokenListAst, mergeTokens } from './css_ast';
import { CssLexer, CssLexerMode, CssToken, CssTokenType, generateErrorMessage, getRawMessage, isNewline } from './css_lexer';
const SPACE_OPERATOR = ' ';
export { CssToken } from './css_lexer';
export { BlockType } from './css_ast';
const SLASH_CHARACTER = '/';
const GT_CHARACTER = '>';
const TRIPLE_GT_OPERATOR_STR = '>>>';
const DEEP_OPERATOR_STR = '/deep/';
const EOF_DELIM_FLAG = 1;
const RBRACE_DELIM_FLAG = 2;
const LBRACE_DELIM_FLAG = 4;
const COMMA_DELIM_FLAG = 8;
const COLON_DELIM_FLAG = 16;
const SEMICOLON_DELIM_FLAG = 32;
const NEWLINE_DELIM_FLAG = 64;
const RPAREN_DELIM_FLAG = 128;
const LPAREN_DELIM_FLAG = 256;
const SPACE_DELIM_FLAG = 512;
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
            return isNewline(code) ? NEWLINE_DELIM_FLAG : 0;
    }
}
function characterContainsDelimiter(code, delimiters) {
    return (getDelimFromCharacter(code) & delimiters) > 0;
}
export class ParsedCssResult {
    constructor(errors, ast) {
        this.errors = errors;
        this.ast = ast;
    }
}
export class CssParser {
    constructor() {
        this._errors = [];
    }
    /**
     * @param css the CSS code that will be parsed
     * @param url the name of the CSS file containing the CSS source code
     */
    parse(css, url) {
        const lexer = new CssLexer();
        this._file = new ParseSourceFile(css, url);
        this._scanner = lexer.scan(css, false);
        const ast = this._parseStyleSheet(EOF_DELIM_FLAG);
        const errors = this._errors;
        this._errors = [];
        const result = new ParsedCssResult(errors, ast);
        this._file = null;
        this._scanner = null;
        return result;
    }
    /** @internal */
    _parseStyleSheet(delimiters) {
        const results = [];
        this._scanner.consumeEmptyStatements();
        while (this._scanner.peek != chars.$EOF) {
            this._scanner.setMode(CssLexerMode.BLOCK);
            results.push(this._parseRule(delimiters));
        }
        let span = null;
        if (results.length > 0) {
            const firstRule = results[0];
            // we collect the last token like so incase there was an
            // EOF token that was emitted sometime during the lexing
            span = this._generateSourceSpan(firstRule, this._lastToken);
        }
        return new CssStyleSheetAst(span, results);
    }
    /** @internal */
    _getSourceContent() { return this._scanner != null ? this._scanner.input : ''; }
    /** @internal */
    _extractSourceContent(start, end) {
        return this._getSourceContent().substring(start, end + 1);
    }
    /** @internal */
    _generateSourceSpan(start, end = null) {
        let startLoc;
        if (start instanceof CssAst) {
            startLoc = start.location.start;
        }
        else {
            let token = start;
            if (token == null) {
                // the data here is invalid, however, if and when this does
                // occur, any other errors associated with this will be collected
                token = this._lastToken;
            }
            startLoc = new ParseLocation(this._file, token.index, token.line, token.column);
        }
        if (end == null) {
            end = this._lastToken;
        }
        let endLine = -1;
        let endColumn = -1;
        let endIndex = -1;
        if (end instanceof CssAst) {
            endLine = end.location.end.line;
            endColumn = end.location.end.col;
            endIndex = end.location.end.offset;
        }
        else if (end instanceof CssToken) {
            endLine = end.line;
            endColumn = end.column;
            endIndex = end.index;
        }
        const endLoc = new ParseLocation(this._file, endIndex, endLine, endColumn);
        return new ParseSourceSpan(startLoc, endLoc);
    }
    /** @internal */
    _resolveBlockType(token) {
        switch (token.strValue) {
            case '@-o-keyframes':
            case '@-moz-keyframes':
            case '@-webkit-keyframes':
            case '@keyframes':
                return BlockType.Keyframes;
            case '@charset':
                return BlockType.Charset;
            case '@import':
                return BlockType.Import;
            case '@namespace':
                return BlockType.Namespace;
            case '@page':
                return BlockType.Page;
            case '@document':
                return BlockType.Document;
            case '@media':
                return BlockType.MediaQuery;
            case '@font-face':
                return BlockType.FontFace;
            case '@viewport':
                return BlockType.Viewport;
            case '@supports':
                return BlockType.Supports;
            default:
                return BlockType.Unsupported;
        }
    }
    /** @internal */
    _parseRule(delimiters) {
        if (this._scanner.peek == chars.$AT) {
            return this._parseAtRule(delimiters);
        }
        return this._parseSelectorRule(delimiters);
    }
    /** @internal */
    _parseAtRule(delimiters) {
        const start = this._getScannerIndex();
        this._scanner.setMode(CssLexerMode.BLOCK);
        const token = this._scan();
        const startToken = token;
        this._assertCondition(token.type == CssTokenType.AtKeyword, `The CSS Rule ${token.strValue} is not a valid [@] rule.`, token);
        let block;
        const type = this._resolveBlockType(token);
        let span;
        let tokens;
        let endToken;
        let end;
        let strValue;
        let query;
        switch (type) {
            case BlockType.Charset:
            case BlockType.Namespace:
            case BlockType.Import:
                let value = this._parseValue(delimiters);
                this._scanner.setMode(CssLexerMode.BLOCK);
                this._scanner.consumeEmptyStatements();
                span = this._generateSourceSpan(startToken, value);
                return new CssInlineRuleAst(span, type, value);
            case BlockType.Viewport:
            case BlockType.FontFace:
                block = this._parseStyleBlock(delimiters);
                span = this._generateSourceSpan(startToken, block);
                return new CssBlockRuleAst(span, type, block);
            case BlockType.Keyframes:
                tokens = this._collectUntilDelim(delimiters | RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG);
                // keyframes only have one identifier name
                let name = tokens[0];
                block = this._parseKeyframeBlock(delimiters);
                span = this._generateSourceSpan(startToken, block);
                return new CssKeyframeRuleAst(span, name, block);
            case BlockType.MediaQuery:
                this._scanner.setMode(CssLexerMode.MEDIA_QUERY);
                tokens = this._collectUntilDelim(delimiters | RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG);
                endToken = tokens[tokens.length - 1];
                // we do not track the whitespace after the mediaQuery predicate ends
                // so we have to calculate the end string value on our own
                end = endToken.index + endToken.strValue.length - 1;
                strValue = this._extractSourceContent(start, end);
                span = this._generateSourceSpan(startToken, endToken);
                query = new CssAtRulePredicateAst(span, strValue, tokens);
                block = this._parseBlock(delimiters);
                strValue = this._extractSourceContent(start, this._getScannerIndex() - 1);
                span = this._generateSourceSpan(startToken, block);
                return new CssMediaQueryRuleAst(span, strValue, query, block);
            case BlockType.Document:
            case BlockType.Supports:
            case BlockType.Page:
                this._scanner.setMode(CssLexerMode.AT_RULE_QUERY);
                tokens = this._collectUntilDelim(delimiters | RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG);
                endToken = tokens[tokens.length - 1];
                // we do not track the whitespace after this block rule predicate ends
                // so we have to calculate the end string value on our own
                end = endToken.index + endToken.strValue.length - 1;
                strValue = this._extractSourceContent(start, end);
                span = this._generateSourceSpan(startToken, tokens[tokens.length - 1]);
                query = new CssAtRulePredicateAst(span, strValue, tokens);
                block = this._parseBlock(delimiters);
                strValue = this._extractSourceContent(start, block.end.offset);
                span = this._generateSourceSpan(startToken, block);
                return new CssBlockDefinitionRuleAst(span, strValue, type, query, block);
            // if a custom @rule { ... } is used it should still tokenize the insides
            default:
                let listOfTokens = [];
                let tokenName = token.strValue;
                this._scanner.setMode(CssLexerMode.ALL);
                this._error(generateErrorMessage(this._getSourceContent(), `The CSS "at" rule "${tokenName}" is not allowed to used here`, token.strValue, token.index, token.line, token.column), token);
                this._collectUntilDelim(delimiters | LBRACE_DELIM_FLAG | SEMICOLON_DELIM_FLAG)
                    .forEach((token) => { listOfTokens.push(token); });
                if (this._scanner.peek == chars.$LBRACE) {
                    listOfTokens.push(this._consume(CssTokenType.Character, '{'));
                    this._collectUntilDelim(delimiters | RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG)
                        .forEach((token) => { listOfTokens.push(token); });
                    listOfTokens.push(this._consume(CssTokenType.Character, '}'));
                }
                endToken = listOfTokens[listOfTokens.length - 1];
                span = this._generateSourceSpan(startToken, endToken);
                return new CssUnknownRuleAst(span, tokenName, listOfTokens);
        }
    }
    /** @internal */
    _parseSelectorRule(delimiters) {
        const start = this._getScannerIndex();
        const selectors = this._parseSelectors(delimiters);
        const block = this._parseStyleBlock(delimiters);
        let ruleAst;
        let span;
        const startSelector = selectors[0];
        if (block != null) {
            span = this._generateSourceSpan(startSelector, block);
            ruleAst = new CssSelectorRuleAst(span, selectors, block);
        }
        else {
            const name = this._extractSourceContent(start, this._getScannerIndex() - 1);
            const innerTokens = [];
            selectors.forEach((selector) => {
                selector.selectorParts.forEach((part) => {
                    part.tokens.forEach((token) => { innerTokens.push(token); });
                });
            });
            const endToken = innerTokens[innerTokens.length - 1];
            span = this._generateSourceSpan(startSelector, endToken);
            ruleAst = new CssUnknownTokenListAst(span, name, innerTokens);
        }
        this._scanner.setMode(CssLexerMode.BLOCK);
        this._scanner.consumeEmptyStatements();
        return ruleAst;
    }
    /** @internal */
    _parseSelectors(delimiters) {
        delimiters |= LBRACE_DELIM_FLAG | SEMICOLON_DELIM_FLAG;
        const selectors = [];
        let isParsingSelectors = true;
        while (isParsingSelectors) {
            selectors.push(this._parseSelector(delimiters));
            isParsingSelectors = !characterContainsDelimiter(this._scanner.peek, delimiters);
            if (isParsingSelectors) {
                this._consume(CssTokenType.Character, ',');
                isParsingSelectors = !characterContainsDelimiter(this._scanner.peek, delimiters);
                if (isParsingSelectors) {
                    this._scanner.consumeWhitespace();
                }
            }
        }
        return selectors;
    }
    /** @internal */
    _scan() {
        const output = this._scanner.scan();
        const token = output.token;
        const error = output.error;
        if (error != null) {
            this._error(getRawMessage(error), token);
        }
        this._lastToken = token;
        return token;
    }
    /** @internal */
    _getScannerIndex() { return this._scanner.index; }
    /** @internal */
    _consume(type, value = null) {
        const output = this._scanner.consume(type, value);
        const token = output.token;
        const error = output.error;
        if (error != null) {
            this._error(getRawMessage(error), token);
        }
        this._lastToken = token;
        return token;
    }
    /** @internal */
    _parseKeyframeBlock(delimiters) {
        delimiters |= RBRACE_DELIM_FLAG;
        this._scanner.setMode(CssLexerMode.KEYFRAME_BLOCK);
        const startToken = this._consume(CssTokenType.Character, '{');
        const definitions = [];
        while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
            definitions.push(this._parseKeyframeDefinition(delimiters));
        }
        const endToken = this._consume(CssTokenType.Character, '}');
        const span = this._generateSourceSpan(startToken, endToken);
        return new CssBlockAst(span, definitions);
    }
    /** @internal */
    _parseKeyframeDefinition(delimiters) {
        const start = this._getScannerIndex();
        const stepTokens = [];
        delimiters |= LBRACE_DELIM_FLAG;
        while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
            stepTokens.push(this._parseKeyframeLabel(delimiters | COMMA_DELIM_FLAG));
            if (this._scanner.peek != chars.$LBRACE) {
                this._consume(CssTokenType.Character, ',');
            }
        }
        const stylesBlock = this._parseStyleBlock(delimiters | RBRACE_DELIM_FLAG);
        const span = this._generateSourceSpan(stepTokens[0], stylesBlock);
        const ast = new CssKeyframeDefinitionAst(span, stepTokens, stylesBlock);
        this._scanner.setMode(CssLexerMode.BLOCK);
        return ast;
    }
    /** @internal */
    _parseKeyframeLabel(delimiters) {
        this._scanner.setMode(CssLexerMode.KEYFRAME_BLOCK);
        return mergeTokens(this._collectUntilDelim(delimiters));
    }
    /** @internal */
    _parsePseudoSelector(delimiters) {
        const start = this._getScannerIndex();
        delimiters &= ~COMMA_DELIM_FLAG;
        // we keep the original value since we may use it to recurse when :not, :host are used
        const startingDelims = delimiters;
        const startToken = this._consume(CssTokenType.Character, ':');
        const tokens = [startToken];
        if (this._scanner.peek == chars.$COLON) { // ::something
            tokens.push(this._consume(CssTokenType.Character, ':'));
        }
        const innerSelectors = [];
        this._scanner.setMode(CssLexerMode.PSEUDO_SELECTOR);
        // host, host-context, lang, not, nth-child are all identifiers
        const pseudoSelectorToken = this._consume(CssTokenType.Identifier);
        const pseudoSelectorName = pseudoSelectorToken.strValue;
        tokens.push(pseudoSelectorToken);
        // host(), lang(), nth-child(), etc...
        if (this._scanner.peek == chars.$LPAREN) {
            this._scanner.setMode(CssLexerMode.PSEUDO_SELECTOR_WITH_ARGUMENTS);
            const openParenToken = this._consume(CssTokenType.Character, '(');
            tokens.push(openParenToken);
            // :host(innerSelector(s)), :not(selector), etc...
            if (_pseudoSelectorSupportsInnerSelectors(pseudoSelectorName)) {
                let innerDelims = startingDelims | LPAREN_DELIM_FLAG | RPAREN_DELIM_FLAG;
                if (pseudoSelectorName == 'not') {
                    // the inner selector inside of :not(...) can only be one
                    // CSS selector (no commas allowed) ... This is according
                    // to the CSS specification
                    innerDelims |= COMMA_DELIM_FLAG;
                }
                // :host(a, b, c) {
                this._parseSelectors(innerDelims).forEach((selector, index) => {
                    innerSelectors.push(selector);
                });
            }
            else {
                // this branch is for things like "en-us, 2k + 1, etc..."
                // which all end up in pseudoSelectors like :lang, :nth-child, etc..
                const innerValueDelims = delimiters | LBRACE_DELIM_FLAG | COLON_DELIM_FLAG |
                    RPAREN_DELIM_FLAG | LPAREN_DELIM_FLAG;
                while (!characterContainsDelimiter(this._scanner.peek, innerValueDelims)) {
                    const token = this._scan();
                    tokens.push(token);
                }
            }
            const closeParenToken = this._consume(CssTokenType.Character, ')');
            tokens.push(closeParenToken);
        }
        const end = this._getScannerIndex() - 1;
        const strValue = this._extractSourceContent(start, end);
        const endToken = tokens[tokens.length - 1];
        const span = this._generateSourceSpan(startToken, endToken);
        return new CssPseudoSelectorAst(span, strValue, pseudoSelectorName, tokens, innerSelectors);
    }
    /** @internal */
    _parseSimpleSelector(delimiters) {
        const start = this._getScannerIndex();
        delimiters |= COMMA_DELIM_FLAG;
        this._scanner.setMode(CssLexerMode.SELECTOR);
        const selectorCssTokens = [];
        const pseudoSelectors = [];
        let previousToken = undefined;
        const selectorPartDelimiters = delimiters | SPACE_DELIM_FLAG;
        let loopOverSelector = !characterContainsDelimiter(this._scanner.peek, selectorPartDelimiters);
        let hasAttributeError = false;
        while (loopOverSelector) {
            const peek = this._scanner.peek;
            switch (peek) {
                case chars.$COLON:
                    let innerPseudo = this._parsePseudoSelector(delimiters);
                    pseudoSelectors.push(innerPseudo);
                    this._scanner.setMode(CssLexerMode.SELECTOR);
                    break;
                case chars.$LBRACKET:
                    // we set the mode after the scan because attribute mode does not
                    // allow attribute [] values. And this also will catch any errors
                    // if an extra "[" is used inside.
                    selectorCssTokens.push(this._scan());
                    this._scanner.setMode(CssLexerMode.ATTRIBUTE_SELECTOR);
                    break;
                case chars.$RBRACKET:
                    if (this._scanner.getMode() != CssLexerMode.ATTRIBUTE_SELECTOR) {
                        hasAttributeError = true;
                    }
                    // we set the mode early because attribute mode does not
                    // allow attribute [] values
                    this._scanner.setMode(CssLexerMode.SELECTOR);
                    selectorCssTokens.push(this._scan());
                    break;
                default:
                    if (isSelectorOperatorCharacter(peek)) {
                        loopOverSelector = false;
                        continue;
                    }
                    let token = this._scan();
                    previousToken = token;
                    selectorCssTokens.push(token);
                    break;
            }
            loopOverSelector = !characterContainsDelimiter(this._scanner.peek, selectorPartDelimiters);
        }
        hasAttributeError =
            hasAttributeError || this._scanner.getMode() == CssLexerMode.ATTRIBUTE_SELECTOR;
        if (hasAttributeError) {
            this._error(`Unbalanced CSS attribute selector at column ${previousToken.line}:${previousToken.column}`, previousToken);
        }
        let end = this._getScannerIndex() - 1;
        // this happens if the selector is not directly followed by
        // a comma or curly brace without a space in between
        let operator = null;
        let operatorScanCount = 0;
        let lastOperatorToken = null;
        if (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
            while (operator == null && !characterContainsDelimiter(this._scanner.peek, delimiters) &&
                isSelectorOperatorCharacter(this._scanner.peek)) {
                let token = this._scan();
                const tokenOperator = token.strValue;
                operatorScanCount++;
                lastOperatorToken = token;
                if (tokenOperator != SPACE_OPERATOR) {
                    switch (tokenOperator) {
                        case SLASH_CHARACTER:
                            // /deep/ operator
                            let deepToken = this._consume(CssTokenType.Identifier);
                            let deepSlash = this._consume(CssTokenType.Character);
                            let index = lastOperatorToken.index;
                            let line = lastOperatorToken.line;
                            let column = lastOperatorToken.column;
                            if (deepToken != null && deepToken.strValue.toLowerCase() == 'deep' &&
                                deepSlash.strValue == SLASH_CHARACTER) {
                                token = new CssToken(lastOperatorToken.index, lastOperatorToken.column, lastOperatorToken.line, CssTokenType.Identifier, DEEP_OPERATOR_STR);
                            }
                            else {
                                const text = SLASH_CHARACTER + deepToken.strValue + deepSlash.strValue;
                                this._error(generateErrorMessage(this._getSourceContent(), `${text} is an invalid CSS operator`, text, index, line, column), lastOperatorToken);
                                token = new CssToken(index, column, line, CssTokenType.Invalid, text);
                            }
                            break;
                        case GT_CHARACTER:
                            // >>> operator
                            if (this._scanner.peek == chars.$GT && this._scanner.peekPeek == chars.$GT) {
                                this._consume(CssTokenType.Character, GT_CHARACTER);
                                this._consume(CssTokenType.Character, GT_CHARACTER);
                                token = new CssToken(lastOperatorToken.index, lastOperatorToken.column, lastOperatorToken.line, CssTokenType.Identifier, TRIPLE_GT_OPERATOR_STR);
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
        const strValue = this._extractSourceContent(start, end);
        // if we do come across one or more spaces inside of
        // the operators loop then an empty space is still a
        // valid operator to use if something else was not found
        if (operator == null && operatorScanCount > 0 && this._scanner.peek != chars.$LBRACE) {
            operator = lastOperatorToken;
        }
        // please note that `endToken` is reassigned multiple times below
        // so please do not optimize the if statements into if/elseif
        let startTokenOrAst = null;
        let endTokenOrAst = null;
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
        const span = this._generateSourceSpan(startTokenOrAst, endTokenOrAst);
        return new CssSimpleSelectorAst(span, selectorCssTokens, strValue, pseudoSelectors, operator);
    }
    /** @internal */
    _parseSelector(delimiters) {
        delimiters |= COMMA_DELIM_FLAG;
        this._scanner.setMode(CssLexerMode.SELECTOR);
        const simpleSelectors = [];
        while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
            simpleSelectors.push(this._parseSimpleSelector(delimiters));
            this._scanner.consumeWhitespace();
        }
        const firstSelector = simpleSelectors[0];
        const lastSelector = simpleSelectors[simpleSelectors.length - 1];
        const span = this._generateSourceSpan(firstSelector, lastSelector);
        return new CssSelectorAst(span, simpleSelectors);
    }
    /** @internal */
    _parseValue(delimiters) {
        delimiters |= RBRACE_DELIM_FLAG | SEMICOLON_DELIM_FLAG | NEWLINE_DELIM_FLAG;
        this._scanner.setMode(CssLexerMode.STYLE_VALUE);
        const start = this._getScannerIndex();
        const tokens = [];
        let wsStr = '';
        let previous = undefined;
        while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
            let token;
            if (previous != null && previous.type == CssTokenType.Identifier &&
                this._scanner.peek == chars.$LPAREN) {
                token = this._consume(CssTokenType.Character, '(');
                tokens.push(token);
                this._scanner.setMode(CssLexerMode.STYLE_VALUE_FUNCTION);
                token = this._scan();
                tokens.push(token);
                this._scanner.setMode(CssLexerMode.STYLE_VALUE);
                token = this._consume(CssTokenType.Character, ')');
                tokens.push(token);
            }
            else {
                token = this._scan();
                if (token.type == CssTokenType.Whitespace) {
                    wsStr += token.strValue;
                }
                else {
                    wsStr = '';
                    tokens.push(token);
                }
            }
            previous = token;
        }
        const end = this._getScannerIndex() - 1;
        this._scanner.consumeWhitespace();
        const code = this._scanner.peek;
        if (code == chars.$SEMICOLON) {
            this._consume(CssTokenType.Character, ';');
        }
        else if (code != chars.$RBRACE) {
            this._error(generateErrorMessage(this._getSourceContent(), `The CSS key/value definition did not end with a semicolon`, previous.strValue, previous.index, previous.line, previous.column), previous);
        }
        const strValue = this._extractSourceContent(start, end);
        const startToken = tokens[0];
        const endToken = tokens[tokens.length - 1];
        const span = this._generateSourceSpan(startToken, endToken);
        return new CssStyleValueAst(span, tokens, strValue);
    }
    /** @internal */
    _collectUntilDelim(delimiters, assertType = null) {
        const tokens = [];
        while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
            const val = assertType != null ? this._consume(assertType) : this._scan();
            tokens.push(val);
        }
        return tokens;
    }
    /** @internal */
    _parseBlock(delimiters) {
        delimiters |= RBRACE_DELIM_FLAG;
        this._scanner.setMode(CssLexerMode.BLOCK);
        const startToken = this._consume(CssTokenType.Character, '{');
        this._scanner.consumeEmptyStatements();
        const results = [];
        while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
            results.push(this._parseRule(delimiters));
        }
        const endToken = this._consume(CssTokenType.Character, '}');
        this._scanner.setMode(CssLexerMode.BLOCK);
        this._scanner.consumeEmptyStatements();
        const span = this._generateSourceSpan(startToken, endToken);
        return new CssBlockAst(span, results);
    }
    /** @internal */
    _parseStyleBlock(delimiters) {
        delimiters |= RBRACE_DELIM_FLAG | LBRACE_DELIM_FLAG;
        this._scanner.setMode(CssLexerMode.STYLE_BLOCK);
        const startToken = this._consume(CssTokenType.Character, '{');
        if (startToken.numValue != chars.$LBRACE) {
            return null;
        }
        const definitions = [];
        this._scanner.consumeEmptyStatements();
        while (!characterContainsDelimiter(this._scanner.peek, delimiters)) {
            definitions.push(this._parseDefinition(delimiters));
            this._scanner.consumeEmptyStatements();
        }
        const endToken = this._consume(CssTokenType.Character, '}');
        this._scanner.setMode(CssLexerMode.STYLE_BLOCK);
        this._scanner.consumeEmptyStatements();
        const span = this._generateSourceSpan(startToken, endToken);
        return new CssStylesBlockAst(span, definitions);
    }
    /** @internal */
    _parseDefinition(delimiters) {
        this._scanner.setMode(CssLexerMode.STYLE_BLOCK);
        let prop = this._consume(CssTokenType.Identifier);
        let parseValue = false;
        let value = null;
        let endToken = prop;
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
                let propStr = [prop.strValue];
                if (this._scanner.peek != chars.$COLON) {
                    // this will throw the error
                    const nextValue = this._consume(CssTokenType.Character, ':');
                    propStr.push(nextValue.strValue);
                    const remainingTokens = this._collectUntilDelim(delimiters | COLON_DELIM_FLAG | SEMICOLON_DELIM_FLAG, CssTokenType.Identifier);
                    if (remainingTokens.length > 0) {
                        remainingTokens.forEach((token) => { propStr.push(token.strValue); });
                    }
                    endToken = prop =
                        new CssToken(prop.index, prop.column, prop.line, prop.type, propStr.join(' '));
                }
                // this means we've reached the end of the definition and/or block
                if (this._scanner.peek == chars.$COLON) {
                    this._consume(CssTokenType.Character, ':');
                    parseValue = true;
                }
                break;
        }
        if (parseValue) {
            value = this._parseValue(delimiters);
            endToken = value;
        }
        else {
            this._error(generateErrorMessage(this._getSourceContent(), `The CSS property was not paired with a style value`, prop.strValue, prop.index, prop.line, prop.column), prop);
        }
        const span = this._generateSourceSpan(prop, endToken);
        return new CssDefinitionAst(span, prop, value);
    }
    /** @internal */
    _assertCondition(status, errorMessage, problemToken) {
        if (!status) {
            this._error(errorMessage, problemToken);
            return true;
        }
        return false;
    }
    /** @internal */
    _error(message, problemToken) {
        const length = problemToken.strValue.length;
        const error = CssParseError.create(this._file, 0, problemToken.line, problemToken.column, length, message);
        this._errors.push(error);
    }
}
export class CssParseError extends ParseError {
    static create(file, offset, line, col, length, errMsg) {
        const start = new ParseLocation(file, offset, line, col);
        const end = new ParseLocation(file, offset, line, col + length);
        const span = new ParseSourceSpan(start, end);
        return new CssParseError(span, 'CSS Parse Error: ' + errMsg);
    }
    constructor(span, message) { super(span, message); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzX3BhcnNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jc3NfcGFyc2VyL2Nzc19wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEtBQUssTUFBTSxVQUFVLENBQUM7QUFDbEMsT0FBTyxFQUFDLFVBQVUsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUUxRixPQUFPLEVBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxxQkFBcUIsRUFBRSxXQUFXLEVBQUUseUJBQXlCLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLHdCQUF3QixFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUFjLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxvQkFBb0IsRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxzQkFBc0IsRUFBRSxXQUFXLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDL2EsT0FBTyxFQUFDLFFBQVEsRUFBRSxZQUFZLEVBQWMsUUFBUSxFQUFFLFlBQVksRUFBRSxvQkFBb0IsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBRXZJLE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztBQUUzQixPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFFcEMsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDO0FBQzVCLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQztBQUN6QixNQUFNLHNCQUFzQixHQUFHLEtBQUssQ0FBQztBQUNyQyxNQUFNLGlCQUFpQixHQUFHLFFBQVEsQ0FBQztBQUVuQyxN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QUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNCLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxhQUFjLFNBQVEsVUFBVTtJQUMzQyxNQUFNLENBQUMsTUFBTSxDQUNULElBQXFCLEVBQUUsTUFBYyxFQUFFLElBQVksRUFBRSxHQUFXLEVBQUUsTUFBYyxFQUNoRixNQUFjO1FBQ2hCLE1BQU0sS0FBSyxHQUFHLElBQUksYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3pELE1BQU0sR0FBRyxHQUFHLElBQUksYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQztRQUNoRSxNQUFNLElBQUksR0FBRyxJQUFJLGVBQWUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDN0MsT0FBTyxJQUFJLGFBQWEsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEdBQUcsTUFBTSxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVELFlBQVksSUFBcUIsRUFBRSxPQUFlLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDOUUiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoYXJzIGZyb20gJy4uL2NoYXJzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VGaWxlLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQge0Jsb2NrVHlwZSwgQ3NzQXN0LCBDc3NBdFJ1bGVQcmVkaWNhdGVBc3QsIENzc0Jsb2NrQXN0LCBDc3NCbG9ja0RlZmluaXRpb25SdWxlQXN0LCBDc3NCbG9ja1J1bGVBc3QsIENzc0RlZmluaXRpb25Bc3QsIENzc0lubGluZVJ1bGVBc3QsIENzc0tleWZyYW1lRGVmaW5pdGlvbkFzdCwgQ3NzS2V5ZnJhbWVSdWxlQXN0LCBDc3NNZWRpYVF1ZXJ5UnVsZUFzdCwgQ3NzUHNldWRvU2VsZWN0b3JBc3QsIENzc1J1bGVBc3QsIENzc1NlbGVjdG9yQXN0LCBDc3NTZWxlY3RvclJ1bGVBc3QsIENzc1NpbXBsZVNlbGVjdG9yQXN0LCBDc3NTdHlsZVNoZWV0QXN0LCBDc3NTdHlsZVZhbHVlQXN0LCBDc3NTdHlsZXNCbG9ja0FzdCwgQ3NzVW5rbm93blJ1bGVBc3QsIENzc1Vua25vd25Ub2tlbkxpc3RBc3QsIG1lcmdlVG9rZW5zfSBmcm9tICcuL2Nzc19hc3QnO1xuaW1wb3J0IHtDc3NMZXhlciwgQ3NzTGV4ZXJNb2RlLCBDc3NTY2FubmVyLCBDc3NUb2tlbiwgQ3NzVG9rZW5UeXBlLCBnZW5lcmF0ZUVycm9yTWVzc2FnZSwgZ2V0UmF3TWVzc2FnZSwgaXNOZXdsaW5lfSBmcm9tICcuL2Nzc19sZXhlcic7XG5cbmNvbnN0IFNQQUNFX09QRVJBVE9SID0gJyAnO1xuXG5leHBvcnQge0Nzc1Rva2VufSBmcm9tICcuL2Nzc19sZXhlcic7XG5leHBvcnQge0Jsb2NrVHlwZX0gZnJvbSAnLi9jc3NfYXN0JztcblxuY29uc3QgU0xBU0hfQ0hBUkFDVEVSID0gJy8nO1xuY29uc3QgR1RfQ0hBUkFDVEVSID0gJz4nO1xuY29uc3QgVFJJUExFX0dUX09QRVJBVE9SX1NUUiA9ICc+Pj4nO1xuY29uc3QgREVFUF9PUEVSQVRPUl9TVFIgPSAnL2RlZXAvJztcblxuY29uc3QgRU9GX0RFTElNX0ZMQUcgPSAxO1xuY29uc3QgUkJSQUNFX0RFTElNX0ZMQUcgPSAyO1xuY29uc3QgTEJSQUNFX0RFTElNX0ZMQUcgPSA0O1xuY29uc3QgQ09NTUFfREVMSU1fRkxBRyA9IDg7XG5jb25zdCBDT0xPTl9ERUxJTV9GTEFHID0gMTY7XG5jb25zdCBTRU1JQ09MT05fREVMSU1fRkxBRyA9IDMyO1xuY29uc3QgTkVXTElORV9ERUxJTV9GTEFHID0gNjQ7XG5jb25zdCBSUEFSRU5fREVMSU1fRkxBRyA9IDEyODtcbmNvbnN0IExQQVJFTl9ERUxJTV9GTEFHID0gMjU2O1xuY29uc3QgU1BBQ0VfREVMSU1fRkxBRyA9IDUxMjtcblxuZnVuY3Rpb24gX3BzZXVkb1NlbGVjdG9yU3VwcG9ydHNJbm5lclNlbGVjdG9ycyhuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIFsnbm90JywgJ2hvc3QnLCAnaG9zdC1jb250ZXh0J10uaW5kZXhPZihuYW1lKSA+PSAwO1xufVxuXG5mdW5jdGlvbiBpc1NlbGVjdG9yT3BlcmF0b3JDaGFyYWN0ZXIoY29kZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHN3aXRjaCAoY29kZSkge1xuICAgIGNhc2UgY2hhcnMuJFNMQVNIOlxuICAgIGNhc2UgY2hhcnMuJFRJTERBOlxuICAgIGNhc2UgY2hhcnMuJFBMVVM6XG4gICAgY2FzZSBjaGFycy4kR1Q6XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNoYXJzLmlzV2hpdGVzcGFjZShjb2RlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXREZWxpbUZyb21DaGFyYWN0ZXIoY29kZTogbnVtYmVyKTogbnVtYmVyIHtcbiAgc3dpdGNoIChjb2RlKSB7XG4gICAgY2FzZSBjaGFycy4kRU9GOlxuICAgICAgcmV0dXJuIEVPRl9ERUxJTV9GTEFHO1xuICAgIGNhc2UgY2hhcnMuJENPTU1BOlxuICAgICAgcmV0dXJuIENPTU1BX0RFTElNX0ZMQUc7XG4gICAgY2FzZSBjaGFycy4kQ09MT046XG4gICAgICByZXR1cm4gQ09MT05fREVMSU1fRkxBRztcbiAgICBjYXNlIGNoYXJzLiRTRU1JQ09MT046XG4gICAgICByZXR1cm4gU0VNSUNPTE9OX0RFTElNX0ZMQUc7XG4gICAgY2FzZSBjaGFycy4kUkJSQUNFOlxuICAgICAgcmV0dXJuIFJCUkFDRV9ERUxJTV9GTEFHO1xuICAgIGNhc2UgY2hhcnMuJExCUkFDRTpcbiAgICAgIHJldHVybiBMQlJBQ0VfREVMSU1fRkxBRztcbiAgICBjYXNlIGNoYXJzLiRSUEFSRU46XG4gICAgICByZXR1cm4gUlBBUkVOX0RFTElNX0ZMQUc7XG4gICAgY2FzZSBjaGFycy4kU1BBQ0U6XG4gICAgY2FzZSBjaGFycy4kVEFCOlxuICAgICAgcmV0dXJuIFNQQUNFX0RFTElNX0ZMQUc7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBpc05ld2xpbmUoY29kZSkgPyBORVdMSU5FX0RFTElNX0ZMQUcgOiAwO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoYXJhY3RlckNvbnRhaW5zRGVsaW1pdGVyKGNvZGU6IG51bWJlciwgZGVsaW1pdGVyczogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAoZ2V0RGVsaW1Gcm9tQ2hhcmFjdGVyKGNvZGUpICYgZGVsaW1pdGVycykgPiAwO1xufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VkQ3NzUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIGVycm9yczogQ3NzUGFyc2VFcnJvcltdLCBwdWJsaWMgYXN0OiBDc3NTdHlsZVNoZWV0QXN0KSB7fVxufVxuXG5leHBvcnQgY2xhc3MgQ3NzUGFyc2VyIHtcbiAgcHJpdmF0ZSBfZXJyb3JzOiBDc3NQYXJzZUVycm9yW10gPSBbXTtcbiAgLy8gVE9ETyhpc3N1ZS8yNDU3MSk6IHJlbW92ZSAnIScuXG4gIHByaXZhdGUgX2ZpbGUgITogUGFyc2VTb3VyY2VGaWxlO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBfc2Nhbm5lciAhOiBDc3NTY2FubmVyO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBfbGFzdFRva2VuICE6IENzc1Rva2VuO1xuXG4gIC8qKlxuICAgKiBAcGFyYW0gY3NzIHRoZSBDU1MgY29kZSB0aGF0IHdpbGwgYmUgcGFyc2VkXG4gICAqIEBwYXJhbSB1cmwgdGhlIG5hbWUgb2YgdGhlIENTUyBmaWxlIGNvbnRhaW5pbmcgdGhlIENTUyBzb3VyY2UgY29kZVxuICAgKi9cbiAgcGFyc2UoY3NzOiBzdHJpbmcsIHVybDogc3RyaW5nKTogUGFyc2VkQ3NzUmVzdWx0IHtcbiAgICBjb25zdCBsZXhlciA9IG5ldyBDc3NMZXhlcigpO1xuICAgIHRoaXMuX2ZpbGUgPSBuZXcgUGFyc2VTb3VyY2VGaWxlKGNzcywgdXJsKTtcbiAgICB0aGlzLl9zY2FubmVyID0gbGV4ZXIuc2Nhbihjc3MsIGZhbHNlKTtcblxuICAgIGNvbnN0IGFzdCA9IHRoaXMuX3BhcnNlU3R5bGVTaGVldChFT0ZfREVMSU1fRkxBRyk7XG5cbiAgICBjb25zdCBlcnJvcnMgPSB0aGlzLl9lcnJvcnM7XG4gICAgdGhpcy5fZXJyb3JzID0gW107XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgUGFyc2VkQ3NzUmVzdWx0KGVycm9ycywgYXN0KTtcbiAgICB0aGlzLl9maWxlID0gbnVsbCBhcyBhbnk7XG4gICAgdGhpcy5fc2Nhbm5lciA9IG51bGwgYXMgYW55O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZVN0eWxlU2hlZXQoZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzU3R5bGVTaGVldEFzdCB7XG4gICAgY29uc3QgcmVzdWx0czogQ3NzUnVsZUFzdFtdID0gW107XG4gICAgdGhpcy5fc2Nhbm5lci5jb25zdW1lRW1wdHlTdGF0ZW1lbnRzKCk7XG4gICAgd2hpbGUgKHRoaXMuX3NjYW5uZXIucGVlayAhPSBjaGFycy4kRU9GKSB7XG4gICAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkJMT0NLKTtcbiAgICAgIHJlc3VsdHMucHVzaCh0aGlzLl9wYXJzZVJ1bGUoZGVsaW1pdGVycykpO1xuICAgIH1cbiAgICBsZXQgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsO1xuICAgIGlmIChyZXN1bHRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGZpcnN0UnVsZSA9IHJlc3VsdHNbMF07XG4gICAgICAvLyB3ZSBjb2xsZWN0IHRoZSBsYXN0IHRva2VuIGxpa2Ugc28gaW5jYXNlIHRoZXJlIHdhcyBhblxuICAgICAgLy8gRU9GIHRva2VuIHRoYXQgd2FzIGVtaXR0ZWQgc29tZXRpbWUgZHVyaW5nIHRoZSBsZXhpbmdcbiAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oZmlyc3RSdWxlLCB0aGlzLl9sYXN0VG9rZW4pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IENzc1N0eWxlU2hlZXRBc3Qoc3BhbiAhLCByZXN1bHRzKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dldFNvdXJjZUNvbnRlbnQoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuX3NjYW5uZXIgIT0gbnVsbCA/IHRoaXMuX3NjYW5uZXIuaW5wdXQgOiAnJzsgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2V4dHJhY3RTb3VyY2VDb250ZW50KHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0U291cmNlQ29udGVudCgpLnN1YnN0cmluZyhzdGFydCwgZW5kICsgMSk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnQ6IENzc1Rva2VufENzc0FzdCwgZW5kOiBDc3NUb2tlbnxDc3NBc3R8bnVsbCA9IG51bGwpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIGxldCBzdGFydExvYzogUGFyc2VMb2NhdGlvbjtcbiAgICBpZiAoc3RhcnQgaW5zdGFuY2VvZiBDc3NBc3QpIHtcbiAgICAgIHN0YXJ0TG9jID0gc3RhcnQubG9jYXRpb24uc3RhcnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCB0b2tlbiA9IHN0YXJ0O1xuICAgICAgaWYgKHRva2VuID09IG51bGwpIHtcbiAgICAgICAgLy8gdGhlIGRhdGEgaGVyZSBpcyBpbnZhbGlkLCBob3dldmVyLCBpZiBhbmQgd2hlbiB0aGlzIGRvZXNcbiAgICAgICAgLy8gb2NjdXIsIGFueSBvdGhlciBlcnJvcnMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgd2lsbCBiZSBjb2xsZWN0ZWRcbiAgICAgICAgdG9rZW4gPSB0aGlzLl9sYXN0VG9rZW47XG4gICAgICB9XG4gICAgICBzdGFydExvYyA9IG5ldyBQYXJzZUxvY2F0aW9uKHRoaXMuX2ZpbGUsIHRva2VuLmluZGV4LCB0b2tlbi5saW5lLCB0b2tlbi5jb2x1bW4pO1xuICAgIH1cblxuICAgIGlmIChlbmQgPT0gbnVsbCkge1xuICAgICAgZW5kID0gdGhpcy5fbGFzdFRva2VuO1xuICAgIH1cblxuICAgIGxldCBlbmRMaW5lOiBudW1iZXIgPSAtMTtcbiAgICBsZXQgZW5kQ29sdW1uOiBudW1iZXIgPSAtMTtcbiAgICBsZXQgZW5kSW5kZXg6IG51bWJlciA9IC0xO1xuICAgIGlmIChlbmQgaW5zdGFuY2VvZiBDc3NBc3QpIHtcbiAgICAgIGVuZExpbmUgPSBlbmQubG9jYXRpb24uZW5kLmxpbmUgITtcbiAgICAgIGVuZENvbHVtbiA9IGVuZC5sb2NhdGlvbi5lbmQuY29sICE7XG4gICAgICBlbmRJbmRleCA9IGVuZC5sb2NhdGlvbi5lbmQub2Zmc2V0ICE7XG4gICAgfSBlbHNlIGlmIChlbmQgaW5zdGFuY2VvZiBDc3NUb2tlbikge1xuICAgICAgZW5kTGluZSA9IGVuZC5saW5lO1xuICAgICAgZW5kQ29sdW1uID0gZW5kLmNvbHVtbjtcbiAgICAgIGVuZEluZGV4ID0gZW5kLmluZGV4O1xuICAgIH1cblxuICAgIGNvbnN0IGVuZExvYyA9IG5ldyBQYXJzZUxvY2F0aW9uKHRoaXMuX2ZpbGUsIGVuZEluZGV4LCBlbmRMaW5lLCBlbmRDb2x1bW4pO1xuICAgIHJldHVybiBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0TG9jLCBlbmRMb2MpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcmVzb2x2ZUJsb2NrVHlwZSh0b2tlbjogQ3NzVG9rZW4pOiBCbG9ja1R5cGUge1xuICAgIHN3aXRjaCAodG9rZW4uc3RyVmFsdWUpIHtcbiAgICAgIGNhc2UgJ0Atby1rZXlmcmFtZXMnOlxuICAgICAgY2FzZSAnQC1tb3ota2V5ZnJhbWVzJzpcbiAgICAgIGNhc2UgJ0Atd2Via2l0LWtleWZyYW1lcyc6XG4gICAgICBjYXNlICdAa2V5ZnJhbWVzJzpcbiAgICAgICAgcmV0dXJuIEJsb2NrVHlwZS5LZXlmcmFtZXM7XG5cbiAgICAgIGNhc2UgJ0BjaGFyc2V0JzpcbiAgICAgICAgcmV0dXJuIEJsb2NrVHlwZS5DaGFyc2V0O1xuXG4gICAgICBjYXNlICdAaW1wb3J0JzpcbiAgICAgICAgcmV0dXJuIEJsb2NrVHlwZS5JbXBvcnQ7XG5cbiAgICAgIGNhc2UgJ0BuYW1lc3BhY2UnOlxuICAgICAgICByZXR1cm4gQmxvY2tUeXBlLk5hbWVzcGFjZTtcblxuICAgICAgY2FzZSAnQHBhZ2UnOlxuICAgICAgICByZXR1cm4gQmxvY2tUeXBlLlBhZ2U7XG5cbiAgICAgIGNhc2UgJ0Bkb2N1bWVudCc6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuRG9jdW1lbnQ7XG5cbiAgICAgIGNhc2UgJ0BtZWRpYSc6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuTWVkaWFRdWVyeTtcblxuICAgICAgY2FzZSAnQGZvbnQtZmFjZSc6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuRm9udEZhY2U7XG5cbiAgICAgIGNhc2UgJ0B2aWV3cG9ydCc6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuVmlld3BvcnQ7XG5cbiAgICAgIGNhc2UgJ0BzdXBwb3J0cyc6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuU3VwcG9ydHM7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBCbG9ja1R5cGUuVW5zdXBwb3J0ZWQ7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VSdWxlKGRlbGltaXRlcnM6IG51bWJlcik6IENzc1J1bGVBc3Qge1xuICAgIGlmICh0aGlzLl9zY2FubmVyLnBlZWsgPT0gY2hhcnMuJEFUKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcGFyc2VBdFJ1bGUoZGVsaW1pdGVycyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9wYXJzZVNlbGVjdG9yUnVsZShkZWxpbWl0ZXJzKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlQXRSdWxlKGRlbGltaXRlcnM6IG51bWJlcik6IENzc1J1bGVBc3Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fZ2V0U2Nhbm5lckluZGV4KCk7XG5cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkJMT0NLKTtcbiAgICBjb25zdCB0b2tlbiA9IHRoaXMuX3NjYW4oKTtcbiAgICBjb25zdCBzdGFydFRva2VuID0gdG9rZW47XG5cbiAgICB0aGlzLl9hc3NlcnRDb25kaXRpb24oXG4gICAgICAgIHRva2VuLnR5cGUgPT0gQ3NzVG9rZW5UeXBlLkF0S2V5d29yZCxcbiAgICAgICAgYFRoZSBDU1MgUnVsZSAke3Rva2VuLnN0clZhbHVlfSBpcyBub3QgYSB2YWxpZCBbQF0gcnVsZS5gLCB0b2tlbik7XG5cbiAgICBsZXQgYmxvY2s6IENzc0Jsb2NrQXN0O1xuICAgIGNvbnN0IHR5cGUgPSB0aGlzLl9yZXNvbHZlQmxvY2tUeXBlKHRva2VuKTtcbiAgICBsZXQgc3BhbjogUGFyc2VTb3VyY2VTcGFuO1xuICAgIGxldCB0b2tlbnM6IENzc1Rva2VuW107XG4gICAgbGV0IGVuZFRva2VuOiBDc3NUb2tlbjtcbiAgICBsZXQgZW5kOiBudW1iZXI7XG4gICAgbGV0IHN0clZhbHVlOiBzdHJpbmc7XG4gICAgbGV0IHF1ZXJ5OiBDc3NBdFJ1bGVQcmVkaWNhdGVBc3Q7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlIEJsb2NrVHlwZS5DaGFyc2V0OlxuICAgICAgY2FzZSBCbG9ja1R5cGUuTmFtZXNwYWNlOlxuICAgICAgY2FzZSBCbG9ja1R5cGUuSW1wb3J0OlxuICAgICAgICBsZXQgdmFsdWUgPSB0aGlzLl9wYXJzZVZhbHVlKGRlbGltaXRlcnMpO1xuICAgICAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkJMT0NLKTtcbiAgICAgICAgdGhpcy5fc2Nhbm5lci5jb25zdW1lRW1wdHlTdGF0ZW1lbnRzKCk7XG4gICAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gbmV3IENzc0lubGluZVJ1bGVBc3Qoc3BhbiwgdHlwZSwgdmFsdWUpO1xuXG4gICAgICBjYXNlIEJsb2NrVHlwZS5WaWV3cG9ydDpcbiAgICAgIGNhc2UgQmxvY2tUeXBlLkZvbnRGYWNlOlxuICAgICAgICBibG9jayA9IHRoaXMuX3BhcnNlU3R5bGVCbG9jayhkZWxpbWl0ZXJzKSAhO1xuICAgICAgICBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKHN0YXJ0VG9rZW4sIGJsb2NrKTtcbiAgICAgICAgcmV0dXJuIG5ldyBDc3NCbG9ja1J1bGVBc3Qoc3BhbiwgdHlwZSwgYmxvY2spO1xuXG4gICAgICBjYXNlIEJsb2NrVHlwZS5LZXlmcmFtZXM6XG4gICAgICAgIHRva2VucyA9IHRoaXMuX2NvbGxlY3RVbnRpbERlbGltKGRlbGltaXRlcnMgfCBSQlJBQ0VfREVMSU1fRkxBRyB8IExCUkFDRV9ERUxJTV9GTEFHKTtcbiAgICAgICAgLy8ga2V5ZnJhbWVzIG9ubHkgaGF2ZSBvbmUgaWRlbnRpZmllciBuYW1lXG4gICAgICAgIGxldCBuYW1lID0gdG9rZW5zWzBdO1xuICAgICAgICBibG9jayA9IHRoaXMuX3BhcnNlS2V5ZnJhbWVCbG9jayhkZWxpbWl0ZXJzKTtcbiAgICAgICAgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCBibG9jayk7XG4gICAgICAgIHJldHVybiBuZXcgQ3NzS2V5ZnJhbWVSdWxlQXN0KHNwYW4sIG5hbWUsIGJsb2NrKTtcblxuICAgICAgY2FzZSBCbG9ja1R5cGUuTWVkaWFRdWVyeTpcbiAgICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5NRURJQV9RVUVSWSk7XG4gICAgICAgIHRva2VucyA9IHRoaXMuX2NvbGxlY3RVbnRpbERlbGltKGRlbGltaXRlcnMgfCBSQlJBQ0VfREVMSU1fRkxBRyB8IExCUkFDRV9ERUxJTV9GTEFHKTtcbiAgICAgICAgZW5kVG9rZW4gPSB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgICAgICAvLyB3ZSBkbyBub3QgdHJhY2sgdGhlIHdoaXRlc3BhY2UgYWZ0ZXIgdGhlIG1lZGlhUXVlcnkgcHJlZGljYXRlIGVuZHNcbiAgICAgICAgLy8gc28gd2UgaGF2ZSB0byBjYWxjdWxhdGUgdGhlIGVuZCBzdHJpbmcgdmFsdWUgb24gb3VyIG93blxuICAgICAgICBlbmQgPSBlbmRUb2tlbi5pbmRleCArIGVuZFRva2VuLnN0clZhbHVlLmxlbmd0aCAtIDE7XG4gICAgICAgIHN0clZhbHVlID0gdGhpcy5fZXh0cmFjdFNvdXJjZUNvbnRlbnQoc3RhcnQsIGVuZCk7XG4gICAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgZW5kVG9rZW4pO1xuICAgICAgICBxdWVyeSA9IG5ldyBDc3NBdFJ1bGVQcmVkaWNhdGVBc3Qoc3Bhbiwgc3RyVmFsdWUsIHRva2Vucyk7XG4gICAgICAgIGJsb2NrID0gdGhpcy5fcGFyc2VCbG9jayhkZWxpbWl0ZXJzKTtcbiAgICAgICAgc3RyVmFsdWUgPSB0aGlzLl9leHRyYWN0U291cmNlQ29udGVudChzdGFydCwgdGhpcy5fZ2V0U2Nhbm5lckluZGV4KCkgLSAxKTtcbiAgICAgICAgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCBibG9jayk7XG4gICAgICAgIHJldHVybiBuZXcgQ3NzTWVkaWFRdWVyeVJ1bGVBc3Qoc3Bhbiwgc3RyVmFsdWUsIHF1ZXJ5LCBibG9jayk7XG5cbiAgICAgIGNhc2UgQmxvY2tUeXBlLkRvY3VtZW50OlxuICAgICAgY2FzZSBCbG9ja1R5cGUuU3VwcG9ydHM6XG4gICAgICBjYXNlIEJsb2NrVHlwZS5QYWdlOlxuICAgICAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkFUX1JVTEVfUVVFUlkpO1xuICAgICAgICB0b2tlbnMgPSB0aGlzLl9jb2xsZWN0VW50aWxEZWxpbShkZWxpbWl0ZXJzIHwgUkJSQUNFX0RFTElNX0ZMQUcgfCBMQlJBQ0VfREVMSU1fRkxBRyk7XG4gICAgICAgIGVuZFRva2VuID0gdG9rZW5zW3Rva2Vucy5sZW5ndGggLSAxXTtcbiAgICAgICAgLy8gd2UgZG8gbm90IHRyYWNrIHRoZSB3aGl0ZXNwYWNlIGFmdGVyIHRoaXMgYmxvY2sgcnVsZSBwcmVkaWNhdGUgZW5kc1xuICAgICAgICAvLyBzbyB3ZSBoYXZlIHRvIGNhbGN1bGF0ZSB0aGUgZW5kIHN0cmluZyB2YWx1ZSBvbiBvdXIgb3duXG4gICAgICAgIGVuZCA9IGVuZFRva2VuLmluZGV4ICsgZW5kVG9rZW4uc3RyVmFsdWUubGVuZ3RoIC0gMTtcbiAgICAgICAgc3RyVmFsdWUgPSB0aGlzLl9leHRyYWN0U291cmNlQ29udGVudChzdGFydCwgZW5kKTtcbiAgICAgICAgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdKTtcbiAgICAgICAgcXVlcnkgPSBuZXcgQ3NzQXRSdWxlUHJlZGljYXRlQXN0KHNwYW4sIHN0clZhbHVlLCB0b2tlbnMpO1xuICAgICAgICBibG9jayA9IHRoaXMuX3BhcnNlQmxvY2soZGVsaW1pdGVycyk7XG4gICAgICAgIHN0clZhbHVlID0gdGhpcy5fZXh0cmFjdFNvdXJjZUNvbnRlbnQoc3RhcnQsIGJsb2NrLmVuZC5vZmZzZXQgISk7XG4gICAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgYmxvY2spO1xuICAgICAgICByZXR1cm4gbmV3IENzc0Jsb2NrRGVmaW5pdGlvblJ1bGVBc3Qoc3Bhbiwgc3RyVmFsdWUsIHR5cGUsIHF1ZXJ5LCBibG9jayk7XG5cbiAgICAgIC8vIGlmIGEgY3VzdG9tIEBydWxlIHsgLi4uIH0gaXMgdXNlZCBpdCBzaG91bGQgc3RpbGwgdG9rZW5pemUgdGhlIGluc2lkZXNcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxldCBsaXN0T2ZUb2tlbnM6IENzc1Rva2VuW10gPSBbXTtcbiAgICAgICAgbGV0IHRva2VuTmFtZSA9IHRva2VuLnN0clZhbHVlO1xuICAgICAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkFMTCk7XG4gICAgICAgIHRoaXMuX2Vycm9yKFxuICAgICAgICAgICAgZ2VuZXJhdGVFcnJvck1lc3NhZ2UoXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2V0U291cmNlQ29udGVudCgpLFxuICAgICAgICAgICAgICAgIGBUaGUgQ1NTIFwiYXRcIiBydWxlIFwiJHt0b2tlbk5hbWV9XCIgaXMgbm90IGFsbG93ZWQgdG8gdXNlZCBoZXJlYCwgdG9rZW4uc3RyVmFsdWUsXG4gICAgICAgICAgICAgICAgdG9rZW4uaW5kZXgsIHRva2VuLmxpbmUsIHRva2VuLmNvbHVtbiksXG4gICAgICAgICAgICB0b2tlbik7XG5cbiAgICAgICAgdGhpcy5fY29sbGVjdFVudGlsRGVsaW0oZGVsaW1pdGVycyB8IExCUkFDRV9ERUxJTV9GTEFHIHwgU0VNSUNPTE9OX0RFTElNX0ZMQUcpXG4gICAgICAgICAgICAuZm9yRWFjaCgodG9rZW4pID0+IHsgbGlzdE9mVG9rZW5zLnB1c2godG9rZW4pOyB9KTtcbiAgICAgICAgaWYgKHRoaXMuX3NjYW5uZXIucGVlayA9PSBjaGFycy4kTEJSQUNFKSB7XG4gICAgICAgICAgbGlzdE9mVG9rZW5zLnB1c2godGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAneycpKTtcbiAgICAgICAgICB0aGlzLl9jb2xsZWN0VW50aWxEZWxpbShkZWxpbWl0ZXJzIHwgUkJSQUNFX0RFTElNX0ZMQUcgfCBMQlJBQ0VfREVMSU1fRkxBRylcbiAgICAgICAgICAgICAgLmZvckVhY2goKHRva2VuKSA9PiB7IGxpc3RPZlRva2Vucy5wdXNoKHRva2VuKTsgfSk7XG4gICAgICAgICAgbGlzdE9mVG9rZW5zLnB1c2godGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnfScpKTtcbiAgICAgICAgfVxuICAgICAgICBlbmRUb2tlbiA9IGxpc3RPZlRva2Vuc1tsaXN0T2ZUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgICAgIHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RhcnRUb2tlbiwgZW5kVG9rZW4pO1xuICAgICAgICByZXR1cm4gbmV3IENzc1Vua25vd25SdWxlQXN0KHNwYW4sIHRva2VuTmFtZSwgbGlzdE9mVG9rZW5zKTtcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZVNlbGVjdG9yUnVsZShkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NSdWxlQXN0IHtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2dldFNjYW5uZXJJbmRleCgpO1xuICAgIGNvbnN0IHNlbGVjdG9ycyA9IHRoaXMuX3BhcnNlU2VsZWN0b3JzKGRlbGltaXRlcnMpO1xuICAgIGNvbnN0IGJsb2NrID0gdGhpcy5fcGFyc2VTdHlsZUJsb2NrKGRlbGltaXRlcnMpO1xuICAgIGxldCBydWxlQXN0OiBDc3NSdWxlQXN0O1xuICAgIGxldCBzcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gICAgY29uc3Qgc3RhcnRTZWxlY3RvciA9IHNlbGVjdG9yc1swXTtcbiAgICBpZiAoYmxvY2sgIT0gbnVsbCkge1xuICAgICAgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFNlbGVjdG9yLCBibG9jayk7XG4gICAgICBydWxlQXN0ID0gbmV3IENzc1NlbGVjdG9yUnVsZUFzdChzcGFuLCBzZWxlY3RvcnMsIGJsb2NrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmFtZSA9IHRoaXMuX2V4dHJhY3RTb3VyY2VDb250ZW50KHN0YXJ0LCB0aGlzLl9nZXRTY2FubmVySW5kZXgoKSAtIDEpO1xuICAgICAgY29uc3QgaW5uZXJUb2tlbnM6IENzc1Rva2VuW10gPSBbXTtcbiAgICAgIHNlbGVjdG9ycy5mb3JFYWNoKChzZWxlY3RvcjogQ3NzU2VsZWN0b3JBc3QpID0+IHtcbiAgICAgICAgc2VsZWN0b3Iuc2VsZWN0b3JQYXJ0cy5mb3JFYWNoKChwYXJ0OiBDc3NTaW1wbGVTZWxlY3RvckFzdCkgPT4ge1xuICAgICAgICAgIHBhcnQudG9rZW5zLmZvckVhY2goKHRva2VuOiBDc3NUb2tlbikgPT4geyBpbm5lclRva2Vucy5wdXNoKHRva2VuKTsgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBlbmRUb2tlbiA9IGlubmVyVG9rZW5zW2lubmVyVG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgICAgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFNlbGVjdG9yLCBlbmRUb2tlbik7XG4gICAgICBydWxlQXN0ID0gbmV3IENzc1Vua25vd25Ub2tlbkxpc3RBc3Qoc3BhbiwgbmFtZSwgaW5uZXJUb2tlbnMpO1xuICAgIH1cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkJMT0NLKTtcbiAgICB0aGlzLl9zY2FubmVyLmNvbnN1bWVFbXB0eVN0YXRlbWVudHMoKTtcbiAgICByZXR1cm4gcnVsZUFzdDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlU2VsZWN0b3JzKGRlbGltaXRlcnM6IG51bWJlcik6IENzc1NlbGVjdG9yQXN0W10ge1xuICAgIGRlbGltaXRlcnMgfD0gTEJSQUNFX0RFTElNX0ZMQUcgfCBTRU1JQ09MT05fREVMSU1fRkxBRztcblxuICAgIGNvbnN0IHNlbGVjdG9yczogQ3NzU2VsZWN0b3JBc3RbXSA9IFtdO1xuICAgIGxldCBpc1BhcnNpbmdTZWxlY3RvcnMgPSB0cnVlO1xuICAgIHdoaWxlIChpc1BhcnNpbmdTZWxlY3RvcnMpIHtcbiAgICAgIHNlbGVjdG9ycy5wdXNoKHRoaXMuX3BhcnNlU2VsZWN0b3IoZGVsaW1pdGVycykpO1xuXG4gICAgICBpc1BhcnNpbmdTZWxlY3RvcnMgPSAhY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBkZWxpbWl0ZXJzKTtcblxuICAgICAgaWYgKGlzUGFyc2luZ1NlbGVjdG9ycykge1xuICAgICAgICB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICcsJyk7XG4gICAgICAgIGlzUGFyc2luZ1NlbGVjdG9ycyA9ICFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGRlbGltaXRlcnMpO1xuICAgICAgICBpZiAoaXNQYXJzaW5nU2VsZWN0b3JzKSB7XG4gICAgICAgICAgdGhpcy5fc2Nhbm5lci5jb25zdW1lV2hpdGVzcGFjZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlbGVjdG9ycztcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3NjYW4oKTogQ3NzVG9rZW4ge1xuICAgIGNvbnN0IG91dHB1dCA9IHRoaXMuX3NjYW5uZXIuc2NhbigpICE7XG4gICAgY29uc3QgdG9rZW4gPSBvdXRwdXQudG9rZW47XG4gICAgY29uc3QgZXJyb3IgPSBvdXRwdXQuZXJyb3I7XG4gICAgaWYgKGVycm9yICE9IG51bGwpIHtcbiAgICAgIHRoaXMuX2Vycm9yKGdldFJhd01lc3NhZ2UoZXJyb3IpLCB0b2tlbik7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RUb2tlbiA9IHRva2VuO1xuICAgIHJldHVybiB0b2tlbjtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dldFNjYW5uZXJJbmRleCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5fc2Nhbm5lci5pbmRleDsgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2NvbnN1bWUodHlwZTogQ3NzVG9rZW5UeXBlLCB2YWx1ZTogc3RyaW5nfG51bGwgPSBudWxsKTogQ3NzVG9rZW4ge1xuICAgIGNvbnN0IG91dHB1dCA9IHRoaXMuX3NjYW5uZXIuY29uc3VtZSh0eXBlLCB2YWx1ZSk7XG4gICAgY29uc3QgdG9rZW4gPSBvdXRwdXQudG9rZW47XG4gICAgY29uc3QgZXJyb3IgPSBvdXRwdXQuZXJyb3I7XG4gICAgaWYgKGVycm9yICE9IG51bGwpIHtcbiAgICAgIHRoaXMuX2Vycm9yKGdldFJhd01lc3NhZ2UoZXJyb3IpLCB0b2tlbik7XG4gICAgfVxuICAgIHRoaXMuX2xhc3RUb2tlbiA9IHRva2VuO1xuICAgIHJldHVybiB0b2tlbjtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlS2V5ZnJhbWVCbG9jayhkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NCbG9ja0FzdCB7XG4gICAgZGVsaW1pdGVycyB8PSBSQlJBQ0VfREVMSU1fRkxBRztcbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLktFWUZSQU1FX0JMT0NLKTtcblxuICAgIGNvbnN0IHN0YXJ0VG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICd7Jyk7XG5cbiAgICBjb25zdCBkZWZpbml0aW9uczogQ3NzS2V5ZnJhbWVEZWZpbml0aW9uQXN0W10gPSBbXTtcbiAgICB3aGlsZSAoIWNoYXJhY3RlckNvbnRhaW5zRGVsaW1pdGVyKHRoaXMuX3NjYW5uZXIucGVlaywgZGVsaW1pdGVycykpIHtcbiAgICAgIGRlZmluaXRpb25zLnB1c2godGhpcy5fcGFyc2VLZXlmcmFtZURlZmluaXRpb24oZGVsaW1pdGVycykpO1xuICAgIH1cblxuICAgIGNvbnN0IGVuZFRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnfScpO1xuXG4gICAgY29uc3Qgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCBlbmRUb2tlbik7XG4gICAgcmV0dXJuIG5ldyBDc3NCbG9ja0FzdChzcGFuLCBkZWZpbml0aW9ucyk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZUtleWZyYW1lRGVmaW5pdGlvbihkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NLZXlmcmFtZURlZmluaXRpb25Bc3Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fZ2V0U2Nhbm5lckluZGV4KCk7XG4gICAgY29uc3Qgc3RlcFRva2VuczogQ3NzVG9rZW5bXSA9IFtdO1xuICAgIGRlbGltaXRlcnMgfD0gTEJSQUNFX0RFTElNX0ZMQUc7XG4gICAgd2hpbGUgKCFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGRlbGltaXRlcnMpKSB7XG4gICAgICBzdGVwVG9rZW5zLnB1c2godGhpcy5fcGFyc2VLZXlmcmFtZUxhYmVsKGRlbGltaXRlcnMgfCBDT01NQV9ERUxJTV9GTEFHKSk7XG4gICAgICBpZiAodGhpcy5fc2Nhbm5lci5wZWVrICE9IGNoYXJzLiRMQlJBQ0UpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnLCcpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBzdHlsZXNCbG9jayA9IHRoaXMuX3BhcnNlU3R5bGVCbG9jayhkZWxpbWl0ZXJzIHwgUkJSQUNFX0RFTElNX0ZMQUcpO1xuICAgIGNvbnN0IHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4oc3RlcFRva2Vuc1swXSwgc3R5bGVzQmxvY2spO1xuICAgIGNvbnN0IGFzdCA9IG5ldyBDc3NLZXlmcmFtZURlZmluaXRpb25Bc3Qoc3Bhbiwgc3RlcFRva2Vucywgc3R5bGVzQmxvY2sgISk7XG5cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkJMT0NLKTtcbiAgICByZXR1cm4gYXN0O1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VLZXlmcmFtZUxhYmVsKGRlbGltaXRlcnM6IG51bWJlcik6IENzc1Rva2VuIHtcbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLktFWUZSQU1FX0JMT0NLKTtcbiAgICByZXR1cm4gbWVyZ2VUb2tlbnModGhpcy5fY29sbGVjdFVudGlsRGVsaW0oZGVsaW1pdGVycykpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VQc2V1ZG9TZWxlY3RvcihkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NQc2V1ZG9TZWxlY3RvckFzdCB7XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLl9nZXRTY2FubmVySW5kZXgoKTtcblxuICAgIGRlbGltaXRlcnMgJj0gfkNPTU1BX0RFTElNX0ZMQUc7XG5cbiAgICAvLyB3ZSBrZWVwIHRoZSBvcmlnaW5hbCB2YWx1ZSBzaW5jZSB3ZSBtYXkgdXNlIGl0IHRvIHJlY3Vyc2Ugd2hlbiA6bm90LCA6aG9zdCBhcmUgdXNlZFxuICAgIGNvbnN0IHN0YXJ0aW5nRGVsaW1zID0gZGVsaW1pdGVycztcblxuICAgIGNvbnN0IHN0YXJ0VG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICc6Jyk7XG4gICAgY29uc3QgdG9rZW5zID0gW3N0YXJ0VG9rZW5dO1xuXG4gICAgaWYgKHRoaXMuX3NjYW5uZXIucGVlayA9PSBjaGFycy4kQ09MT04pIHsgIC8vIDo6c29tZXRoaW5nXG4gICAgICB0b2tlbnMucHVzaCh0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICc6JykpO1xuICAgIH1cblxuICAgIGNvbnN0IGlubmVyU2VsZWN0b3JzOiBDc3NTZWxlY3RvckFzdFtdID0gW107XG5cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLlBTRVVET19TRUxFQ1RPUik7XG5cbiAgICAvLyBob3N0LCBob3N0LWNvbnRleHQsIGxhbmcsIG5vdCwgbnRoLWNoaWxkIGFyZSBhbGwgaWRlbnRpZmllcnNcbiAgICBjb25zdCBwc2V1ZG9TZWxlY3RvclRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuSWRlbnRpZmllcik7XG4gICAgY29uc3QgcHNldWRvU2VsZWN0b3JOYW1lID0gcHNldWRvU2VsZWN0b3JUb2tlbi5zdHJWYWx1ZTtcbiAgICB0b2tlbnMucHVzaChwc2V1ZG9TZWxlY3RvclRva2VuKTtcblxuICAgIC8vIGhvc3QoKSwgbGFuZygpLCBudGgtY2hpbGQoKSwgZXRjLi4uXG4gICAgaWYgKHRoaXMuX3NjYW5uZXIucGVlayA9PSBjaGFycy4kTFBBUkVOKSB7XG4gICAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLlBTRVVET19TRUxFQ1RPUl9XSVRIX0FSR1VNRU5UUyk7XG5cbiAgICAgIGNvbnN0IG9wZW5QYXJlblRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnKCcpO1xuICAgICAgdG9rZW5zLnB1c2gob3BlblBhcmVuVG9rZW4pO1xuXG4gICAgICAvLyA6aG9zdChpbm5lclNlbGVjdG9yKHMpKSwgOm5vdChzZWxlY3RvciksIGV0Yy4uLlxuICAgICAgaWYgKF9wc2V1ZG9TZWxlY3RvclN1cHBvcnRzSW5uZXJTZWxlY3RvcnMocHNldWRvU2VsZWN0b3JOYW1lKSkge1xuICAgICAgICBsZXQgaW5uZXJEZWxpbXMgPSBzdGFydGluZ0RlbGltcyB8IExQQVJFTl9ERUxJTV9GTEFHIHwgUlBBUkVOX0RFTElNX0ZMQUc7XG4gICAgICAgIGlmIChwc2V1ZG9TZWxlY3Rvck5hbWUgPT0gJ25vdCcpIHtcbiAgICAgICAgICAvLyB0aGUgaW5uZXIgc2VsZWN0b3IgaW5zaWRlIG9mIDpub3QoLi4uKSBjYW4gb25seSBiZSBvbmVcbiAgICAgICAgICAvLyBDU1Mgc2VsZWN0b3IgKG5vIGNvbW1hcyBhbGxvd2VkKSAuLi4gVGhpcyBpcyBhY2NvcmRpbmdcbiAgICAgICAgICAvLyB0byB0aGUgQ1NTIHNwZWNpZmljYXRpb25cbiAgICAgICAgICBpbm5lckRlbGltcyB8PSBDT01NQV9ERUxJTV9GTEFHO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gOmhvc3QoYSwgYiwgYykge1xuICAgICAgICB0aGlzLl9wYXJzZVNlbGVjdG9ycyhpbm5lckRlbGltcykuZm9yRWFjaCgoc2VsZWN0b3IsIGluZGV4KSA9PiB7XG4gICAgICAgICAgaW5uZXJTZWxlY3RvcnMucHVzaChzZWxlY3Rvcik7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdGhpcyBicmFuY2ggaXMgZm9yIHRoaW5ncyBsaWtlIFwiZW4tdXMsIDJrICsgMSwgZXRjLi4uXCJcbiAgICAgICAgLy8gd2hpY2ggYWxsIGVuZCB1cCBpbiBwc2V1ZG9TZWxlY3RvcnMgbGlrZSA6bGFuZywgOm50aC1jaGlsZCwgZXRjLi5cbiAgICAgICAgY29uc3QgaW5uZXJWYWx1ZURlbGltcyA9IGRlbGltaXRlcnMgfCBMQlJBQ0VfREVMSU1fRkxBRyB8IENPTE9OX0RFTElNX0ZMQUcgfFxuICAgICAgICAgICAgUlBBUkVOX0RFTElNX0ZMQUcgfCBMUEFSRU5fREVMSU1fRkxBRztcbiAgICAgICAgd2hpbGUgKCFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGlubmVyVmFsdWVEZWxpbXMpKSB7XG4gICAgICAgICAgY29uc3QgdG9rZW4gPSB0aGlzLl9zY2FuKCk7XG4gICAgICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNsb3NlUGFyZW5Ub2tlbiA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJyknKTtcbiAgICAgIHRva2Vucy5wdXNoKGNsb3NlUGFyZW5Ub2tlbik7XG4gICAgfVxuXG4gICAgY29uc3QgZW5kID0gdGhpcy5fZ2V0U2Nhbm5lckluZGV4KCkgLSAxO1xuICAgIGNvbnN0IHN0clZhbHVlID0gdGhpcy5fZXh0cmFjdFNvdXJjZUNvbnRlbnQoc3RhcnQsIGVuZCk7XG5cbiAgICBjb25zdCBlbmRUb2tlbiA9IHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3Qgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCBlbmRUb2tlbik7XG4gICAgcmV0dXJuIG5ldyBDc3NQc2V1ZG9TZWxlY3RvckFzdChzcGFuLCBzdHJWYWx1ZSwgcHNldWRvU2VsZWN0b3JOYW1lLCB0b2tlbnMsIGlubmVyU2VsZWN0b3JzKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlU2ltcGxlU2VsZWN0b3IoZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzU2ltcGxlU2VsZWN0b3JBc3Qge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fZ2V0U2Nhbm5lckluZGV4KCk7XG5cbiAgICBkZWxpbWl0ZXJzIHw9IENPTU1BX0RFTElNX0ZMQUc7XG5cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLlNFTEVDVE9SKTtcbiAgICBjb25zdCBzZWxlY3RvckNzc1Rva2VuczogQ3NzVG9rZW5bXSA9IFtdO1xuICAgIGNvbnN0IHBzZXVkb1NlbGVjdG9yczogQ3NzUHNldWRvU2VsZWN0b3JBc3RbXSA9IFtdO1xuXG4gICAgbGV0IHByZXZpb3VzVG9rZW46IENzc1Rva2VuID0gdW5kZWZpbmVkICE7XG5cbiAgICBjb25zdCBzZWxlY3RvclBhcnREZWxpbWl0ZXJzID0gZGVsaW1pdGVycyB8IFNQQUNFX0RFTElNX0ZMQUc7XG4gICAgbGV0IGxvb3BPdmVyU2VsZWN0b3IgPSAhY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBzZWxlY3RvclBhcnREZWxpbWl0ZXJzKTtcblxuICAgIGxldCBoYXNBdHRyaWJ1dGVFcnJvciA9IGZhbHNlO1xuICAgIHdoaWxlIChsb29wT3ZlclNlbGVjdG9yKSB7XG4gICAgICBjb25zdCBwZWVrID0gdGhpcy5fc2Nhbm5lci5wZWVrO1xuXG4gICAgICBzd2l0Y2ggKHBlZWspIHtcbiAgICAgICAgY2FzZSBjaGFycy4kQ09MT046XG4gICAgICAgICAgbGV0IGlubmVyUHNldWRvID0gdGhpcy5fcGFyc2VQc2V1ZG9TZWxlY3RvcihkZWxpbWl0ZXJzKTtcbiAgICAgICAgICBwc2V1ZG9TZWxlY3RvcnMucHVzaChpbm5lclBzZXVkbyk7XG4gICAgICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5TRUxFQ1RPUik7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBjaGFycy4kTEJSQUNLRVQ6XG4gICAgICAgICAgLy8gd2Ugc2V0IHRoZSBtb2RlIGFmdGVyIHRoZSBzY2FuIGJlY2F1c2UgYXR0cmlidXRlIG1vZGUgZG9lcyBub3RcbiAgICAgICAgICAvLyBhbGxvdyBhdHRyaWJ1dGUgW10gdmFsdWVzLiBBbmQgdGhpcyBhbHNvIHdpbGwgY2F0Y2ggYW55IGVycm9yc1xuICAgICAgICAgIC8vIGlmIGFuIGV4dHJhIFwiW1wiIGlzIHVzZWQgaW5zaWRlLlxuICAgICAgICAgIHNlbGVjdG9yQ3NzVG9rZW5zLnB1c2godGhpcy5fc2NhbigpKTtcbiAgICAgICAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLkFUVFJJQlVURV9TRUxFQ1RPUik7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBjaGFycy4kUkJSQUNLRVQ6XG4gICAgICAgICAgaWYgKHRoaXMuX3NjYW5uZXIuZ2V0TW9kZSgpICE9IENzc0xleGVyTW9kZS5BVFRSSUJVVEVfU0VMRUNUT1IpIHtcbiAgICAgICAgICAgIGhhc0F0dHJpYnV0ZUVycm9yID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gd2Ugc2V0IHRoZSBtb2RlIGVhcmx5IGJlY2F1c2UgYXR0cmlidXRlIG1vZGUgZG9lcyBub3RcbiAgICAgICAgICAvLyBhbGxvdyBhdHRyaWJ1dGUgW10gdmFsdWVzXG4gICAgICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5TRUxFQ1RPUik7XG4gICAgICAgICAgc2VsZWN0b3JDc3NUb2tlbnMucHVzaCh0aGlzLl9zY2FuKCkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKGlzU2VsZWN0b3JPcGVyYXRvckNoYXJhY3RlcihwZWVrKSkge1xuICAgICAgICAgICAgbG9vcE92ZXJTZWxlY3RvciA9IGZhbHNlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IHRva2VuID0gdGhpcy5fc2NhbigpO1xuICAgICAgICAgIHByZXZpb3VzVG9rZW4gPSB0b2tlbjtcbiAgICAgICAgICBzZWxlY3RvckNzc1Rva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgbG9vcE92ZXJTZWxlY3RvciA9ICFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIHNlbGVjdG9yUGFydERlbGltaXRlcnMpO1xuICAgIH1cblxuICAgIGhhc0F0dHJpYnV0ZUVycm9yID1cbiAgICAgICAgaGFzQXR0cmlidXRlRXJyb3IgfHwgdGhpcy5fc2Nhbm5lci5nZXRNb2RlKCkgPT0gQ3NzTGV4ZXJNb2RlLkFUVFJJQlVURV9TRUxFQ1RPUjtcbiAgICBpZiAoaGFzQXR0cmlidXRlRXJyb3IpIHtcbiAgICAgIHRoaXMuX2Vycm9yKFxuICAgICAgICAgIGBVbmJhbGFuY2VkIENTUyBhdHRyaWJ1dGUgc2VsZWN0b3IgYXQgY29sdW1uICR7cHJldmlvdXNUb2tlbi5saW5lfToke1xuICAgICAgICAgICAgICBwcmV2aW91c1Rva2VuLmNvbHVtbn1gLFxuICAgICAgICAgIHByZXZpb3VzVG9rZW4pO1xuICAgIH1cblxuICAgIGxldCBlbmQgPSB0aGlzLl9nZXRTY2FubmVySW5kZXgoKSAtIDE7XG5cbiAgICAvLyB0aGlzIGhhcHBlbnMgaWYgdGhlIHNlbGVjdG9yIGlzIG5vdCBkaXJlY3RseSBmb2xsb3dlZCBieVxuICAgIC8vIGEgY29tbWEgb3IgY3VybHkgYnJhY2Ugd2l0aG91dCBhIHNwYWNlIGluIGJldHdlZW5cbiAgICBsZXQgb3BlcmF0b3I6IENzc1Rva2VufG51bGwgPSBudWxsO1xuICAgIGxldCBvcGVyYXRvclNjYW5Db3VudCA9IDA7XG4gICAgbGV0IGxhc3RPcGVyYXRvclRva2VuOiBDc3NUb2tlbnxudWxsID0gbnVsbDtcbiAgICBpZiAoIWNoYXJhY3RlckNvbnRhaW5zRGVsaW1pdGVyKHRoaXMuX3NjYW5uZXIucGVlaywgZGVsaW1pdGVycykpIHtcbiAgICAgIHdoaWxlIChvcGVyYXRvciA9PSBudWxsICYmICFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGRlbGltaXRlcnMpICYmXG4gICAgICAgICAgICAgaXNTZWxlY3Rvck9wZXJhdG9yQ2hhcmFjdGVyKHRoaXMuX3NjYW5uZXIucGVlaykpIHtcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5fc2NhbigpO1xuICAgICAgICBjb25zdCB0b2tlbk9wZXJhdG9yID0gdG9rZW4uc3RyVmFsdWU7XG4gICAgICAgIG9wZXJhdG9yU2NhbkNvdW50Kys7XG4gICAgICAgIGxhc3RPcGVyYXRvclRva2VuID0gdG9rZW47XG4gICAgICAgIGlmICh0b2tlbk9wZXJhdG9yICE9IFNQQUNFX09QRVJBVE9SKSB7XG4gICAgICAgICAgc3dpdGNoICh0b2tlbk9wZXJhdG9yKSB7XG4gICAgICAgICAgICBjYXNlIFNMQVNIX0NIQVJBQ1RFUjpcbiAgICAgICAgICAgICAgLy8gL2RlZXAvIG9wZXJhdG9yXG4gICAgICAgICAgICAgIGxldCBkZWVwVG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5JZGVudGlmaWVyKTtcbiAgICAgICAgICAgICAgbGV0IGRlZXBTbGFzaCA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3Rlcik7XG4gICAgICAgICAgICAgIGxldCBpbmRleCA9IGxhc3RPcGVyYXRvclRva2VuLmluZGV4O1xuICAgICAgICAgICAgICBsZXQgbGluZSA9IGxhc3RPcGVyYXRvclRva2VuLmxpbmU7XG4gICAgICAgICAgICAgIGxldCBjb2x1bW4gPSBsYXN0T3BlcmF0b3JUb2tlbi5jb2x1bW47XG4gICAgICAgICAgICAgIGlmIChkZWVwVG9rZW4gIT0gbnVsbCAmJiBkZWVwVG9rZW4uc3RyVmFsdWUudG9Mb3dlckNhc2UoKSA9PSAnZGVlcCcgJiZcbiAgICAgICAgICAgICAgICAgIGRlZXBTbGFzaC5zdHJWYWx1ZSA9PSBTTEFTSF9DSEFSQUNURVIpIHtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IG5ldyBDc3NUb2tlbihcbiAgICAgICAgICAgICAgICAgICAgbGFzdE9wZXJhdG9yVG9rZW4uaW5kZXgsIGxhc3RPcGVyYXRvclRva2VuLmNvbHVtbiwgbGFzdE9wZXJhdG9yVG9rZW4ubGluZSxcbiAgICAgICAgICAgICAgICAgICAgQ3NzVG9rZW5UeXBlLklkZW50aWZpZXIsIERFRVBfT1BFUkFUT1JfU1RSKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXh0ID0gU0xBU0hfQ0hBUkFDVEVSICsgZGVlcFRva2VuLnN0clZhbHVlICsgZGVlcFNsYXNoLnN0clZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2Vycm9yKFxuICAgICAgICAgICAgICAgICAgICBnZW5lcmF0ZUVycm9yTWVzc2FnZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dldFNvdXJjZUNvbnRlbnQoKSwgYCR7dGV4dH0gaXMgYW4gaW52YWxpZCBDU1Mgb3BlcmF0b3JgLCB0ZXh0LCBpbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmUsIGNvbHVtbiksXG4gICAgICAgICAgICAgICAgICAgIGxhc3RPcGVyYXRvclRva2VuKTtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IG5ldyBDc3NUb2tlbihpbmRleCwgY29sdW1uLCBsaW5lLCBDc3NUb2tlblR5cGUuSW52YWxpZCwgdGV4dCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgR1RfQ0hBUkFDVEVSOlxuICAgICAgICAgICAgICAvLyA+Pj4gb3BlcmF0b3JcbiAgICAgICAgICAgICAgaWYgKHRoaXMuX3NjYW5uZXIucGVlayA9PSBjaGFycy4kR1QgJiYgdGhpcy5fc2Nhbm5lci5wZWVrUGVlayA9PSBjaGFycy4kR1QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsIEdUX0NIQVJBQ1RFUik7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCBHVF9DSEFSQUNURVIpO1xuICAgICAgICAgICAgICAgIHRva2VuID0gbmV3IENzc1Rva2VuKFxuICAgICAgICAgICAgICAgICAgICBsYXN0T3BlcmF0b3JUb2tlbi5pbmRleCwgbGFzdE9wZXJhdG9yVG9rZW4uY29sdW1uLCBsYXN0T3BlcmF0b3JUb2tlbi5saW5lLFxuICAgICAgICAgICAgICAgICAgICBDc3NUb2tlblR5cGUuSWRlbnRpZmllciwgVFJJUExFX0dUX09QRVJBVE9SX1NUUik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgb3BlcmF0b3IgPSB0b2tlbjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBzbyBsb25nIGFzIHRoZXJlIGlzIGFuIG9wZXJhdG9yIHRoZW4gd2UgY2FuIGhhdmUgYW5cbiAgICAgIC8vIGVuZGluZyB2YWx1ZSB0aGF0IGlzIGJleW9uZCB0aGUgc2VsZWN0b3IgdmFsdWUgLi4uXG4gICAgICAvLyBvdGhlcndpc2UgaXQncyBqdXN0IGEgYnVuY2ggb2YgdHJhaWxpbmcgd2hpdGVzcGFjZVxuICAgICAgaWYgKG9wZXJhdG9yICE9IG51bGwpIHtcbiAgICAgICAgZW5kID0gb3BlcmF0b3IuaW5kZXg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fc2Nhbm5lci5jb25zdW1lV2hpdGVzcGFjZSgpO1xuXG4gICAgY29uc3Qgc3RyVmFsdWUgPSB0aGlzLl9leHRyYWN0U291cmNlQ29udGVudChzdGFydCwgZW5kKTtcblxuICAgIC8vIGlmIHdlIGRvIGNvbWUgYWNyb3NzIG9uZSBvciBtb3JlIHNwYWNlcyBpbnNpZGUgb2ZcbiAgICAvLyB0aGUgb3BlcmF0b3JzIGxvb3AgdGhlbiBhbiBlbXB0eSBzcGFjZSBpcyBzdGlsbCBhXG4gICAgLy8gdmFsaWQgb3BlcmF0b3IgdG8gdXNlIGlmIHNvbWV0aGluZyBlbHNlIHdhcyBub3QgZm91bmRcbiAgICBpZiAob3BlcmF0b3IgPT0gbnVsbCAmJiBvcGVyYXRvclNjYW5Db3VudCA+IDAgJiYgdGhpcy5fc2Nhbm5lci5wZWVrICE9IGNoYXJzLiRMQlJBQ0UpIHtcbiAgICAgIG9wZXJhdG9yID0gbGFzdE9wZXJhdG9yVG9rZW47XG4gICAgfVxuXG4gICAgLy8gcGxlYXNlIG5vdGUgdGhhdCBgZW5kVG9rZW5gIGlzIHJlYXNzaWduZWQgbXVsdGlwbGUgdGltZXMgYmVsb3dcbiAgICAvLyBzbyBwbGVhc2UgZG8gbm90IG9wdGltaXplIHRoZSBpZiBzdGF0ZW1lbnRzIGludG8gaWYvZWxzZWlmXG4gICAgbGV0IHN0YXJ0VG9rZW5PckFzdDogQ3NzVG9rZW58Q3NzQXN0fG51bGwgPSBudWxsO1xuICAgIGxldCBlbmRUb2tlbk9yQXN0OiBDc3NUb2tlbnxDc3NBc3R8bnVsbCA9IG51bGw7XG4gICAgaWYgKHNlbGVjdG9yQ3NzVG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXJ0VG9rZW5PckFzdCA9IHN0YXJ0VG9rZW5PckFzdCB8fCBzZWxlY3RvckNzc1Rva2Vuc1swXTtcbiAgICAgIGVuZFRva2VuT3JBc3QgPSBzZWxlY3RvckNzc1Rva2Vuc1tzZWxlY3RvckNzc1Rva2Vucy5sZW5ndGggLSAxXTtcbiAgICB9XG4gICAgaWYgKHBzZXVkb1NlbGVjdG9ycy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGFydFRva2VuT3JBc3QgPSBzdGFydFRva2VuT3JBc3QgfHwgcHNldWRvU2VsZWN0b3JzWzBdO1xuICAgICAgZW5kVG9rZW5PckFzdCA9IHBzZXVkb1NlbGVjdG9yc1twc2V1ZG9TZWxlY3RvcnMubGVuZ3RoIC0gMV07XG4gICAgfVxuICAgIGlmIChvcGVyYXRvciAhPSBudWxsKSB7XG4gICAgICBzdGFydFRva2VuT3JBc3QgPSBzdGFydFRva2VuT3JBc3QgfHwgb3BlcmF0b3I7XG4gICAgICBlbmRUb2tlbk9yQXN0ID0gb3BlcmF0b3I7XG4gICAgfVxuXG4gICAgY29uc3Qgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuT3JBc3QgISwgZW5kVG9rZW5PckFzdCk7XG4gICAgcmV0dXJuIG5ldyBDc3NTaW1wbGVTZWxlY3RvckFzdChzcGFuLCBzZWxlY3RvckNzc1Rva2Vucywgc3RyVmFsdWUsIHBzZXVkb1NlbGVjdG9ycywgb3BlcmF0b3IgISk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZVNlbGVjdG9yKGRlbGltaXRlcnM6IG51bWJlcik6IENzc1NlbGVjdG9yQXN0IHtcbiAgICBkZWxpbWl0ZXJzIHw9IENPTU1BX0RFTElNX0ZMQUc7XG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5TRUxFQ1RPUik7XG5cbiAgICBjb25zdCBzaW1wbGVTZWxlY3RvcnM6IENzc1NpbXBsZVNlbGVjdG9yQXN0W10gPSBbXTtcbiAgICB3aGlsZSAoIWNoYXJhY3RlckNvbnRhaW5zRGVsaW1pdGVyKHRoaXMuX3NjYW5uZXIucGVlaywgZGVsaW1pdGVycykpIHtcbiAgICAgIHNpbXBsZVNlbGVjdG9ycy5wdXNoKHRoaXMuX3BhcnNlU2ltcGxlU2VsZWN0b3IoZGVsaW1pdGVycykpO1xuICAgICAgdGhpcy5fc2Nhbm5lci5jb25zdW1lV2hpdGVzcGFjZSgpO1xuICAgIH1cblxuICAgIGNvbnN0IGZpcnN0U2VsZWN0b3IgPSBzaW1wbGVTZWxlY3RvcnNbMF07XG4gICAgY29uc3QgbGFzdFNlbGVjdG9yID0gc2ltcGxlU2VsZWN0b3JzW3NpbXBsZVNlbGVjdG9ycy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKGZpcnN0U2VsZWN0b3IsIGxhc3RTZWxlY3Rvcik7XG4gICAgcmV0dXJuIG5ldyBDc3NTZWxlY3RvckFzdChzcGFuLCBzaW1wbGVTZWxlY3RvcnMpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcGFyc2VWYWx1ZShkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NTdHlsZVZhbHVlQXN0IHtcbiAgICBkZWxpbWl0ZXJzIHw9IFJCUkFDRV9ERUxJTV9GTEFHIHwgU0VNSUNPTE9OX0RFTElNX0ZMQUcgfCBORVdMSU5FX0RFTElNX0ZMQUc7XG5cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLlNUWUxFX1ZBTFVFKTtcbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2dldFNjYW5uZXJJbmRleCgpO1xuXG4gICAgY29uc3QgdG9rZW5zOiBDc3NUb2tlbltdID0gW107XG4gICAgbGV0IHdzU3RyID0gJyc7XG4gICAgbGV0IHByZXZpb3VzOiBDc3NUb2tlbiA9IHVuZGVmaW5lZCAhO1xuICAgIHdoaWxlICghY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBkZWxpbWl0ZXJzKSkge1xuICAgICAgbGV0IHRva2VuOiBDc3NUb2tlbjtcbiAgICAgIGlmIChwcmV2aW91cyAhPSBudWxsICYmIHByZXZpb3VzLnR5cGUgPT0gQ3NzVG9rZW5UeXBlLklkZW50aWZpZXIgJiZcbiAgICAgICAgICB0aGlzLl9zY2FubmVyLnBlZWsgPT0gY2hhcnMuJExQQVJFTikge1xuICAgICAgICB0b2tlbiA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJygnKTtcbiAgICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuXG4gICAgICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuU1RZTEVfVkFMVUVfRlVOQ1RJT04pO1xuXG4gICAgICAgIHRva2VuID0gdGhpcy5fc2NhbigpO1xuICAgICAgICB0b2tlbnMucHVzaCh0b2tlbik7XG5cbiAgICAgICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5TVFlMRV9WQUxVRSk7XG5cbiAgICAgICAgdG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICcpJyk7XG4gICAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRva2VuID0gdGhpcy5fc2NhbigpO1xuICAgICAgICBpZiAodG9rZW4udHlwZSA9PSBDc3NUb2tlblR5cGUuV2hpdGVzcGFjZSkge1xuICAgICAgICAgIHdzU3RyICs9IHRva2VuLnN0clZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdzU3RyID0gJyc7XG4gICAgICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwcmV2aW91cyA9IHRva2VuO1xuICAgIH1cblxuICAgIGNvbnN0IGVuZCA9IHRoaXMuX2dldFNjYW5uZXJJbmRleCgpIC0gMTtcbiAgICB0aGlzLl9zY2FubmVyLmNvbnN1bWVXaGl0ZXNwYWNlKCk7XG5cbiAgICBjb25zdCBjb2RlID0gdGhpcy5fc2Nhbm5lci5wZWVrO1xuICAgIGlmIChjb2RlID09IGNoYXJzLiRTRU1JQ09MT04pIHtcbiAgICAgIHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJzsnKTtcbiAgICB9IGVsc2UgaWYgKGNvZGUgIT0gY2hhcnMuJFJCUkFDRSkge1xuICAgICAgdGhpcy5fZXJyb3IoXG4gICAgICAgICAgZ2VuZXJhdGVFcnJvck1lc3NhZ2UoXG4gICAgICAgICAgICAgIHRoaXMuX2dldFNvdXJjZUNvbnRlbnQoKSwgYFRoZSBDU1Mga2V5L3ZhbHVlIGRlZmluaXRpb24gZGlkIG5vdCBlbmQgd2l0aCBhIHNlbWljb2xvbmAsXG4gICAgICAgICAgICAgIHByZXZpb3VzLnN0clZhbHVlLCBwcmV2aW91cy5pbmRleCwgcHJldmlvdXMubGluZSwgcHJldmlvdXMuY29sdW1uKSxcbiAgICAgICAgICBwcmV2aW91cyk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RyVmFsdWUgPSB0aGlzLl9leHRyYWN0U291cmNlQ29udGVudChzdGFydCwgZW5kKTtcbiAgICBjb25zdCBzdGFydFRva2VuID0gdG9rZW5zWzBdO1xuICAgIGNvbnN0IGVuZFRva2VuID0gdG9rZW5zW3Rva2Vucy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCBzcGFuID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VTcGFuKHN0YXJ0VG9rZW4sIGVuZFRva2VuKTtcbiAgICByZXR1cm4gbmV3IENzc1N0eWxlVmFsdWVBc3Qoc3BhbiwgdG9rZW5zLCBzdHJWYWx1ZSk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9jb2xsZWN0VW50aWxEZWxpbShkZWxpbWl0ZXJzOiBudW1iZXIsIGFzc2VydFR5cGU6IENzc1Rva2VuVHlwZXxudWxsID0gbnVsbCk6IENzc1Rva2VuW10ge1xuICAgIGNvbnN0IHRva2VuczogQ3NzVG9rZW5bXSA9IFtdO1xuICAgIHdoaWxlICghY2hhcmFjdGVyQ29udGFpbnNEZWxpbWl0ZXIodGhpcy5fc2Nhbm5lci5wZWVrLCBkZWxpbWl0ZXJzKSkge1xuICAgICAgY29uc3QgdmFsID0gYXNzZXJ0VHlwZSAhPSBudWxsID8gdGhpcy5fY29uc3VtZShhc3NlcnRUeXBlKSA6IHRoaXMuX3NjYW4oKTtcbiAgICAgIHRva2Vucy5wdXNoKHZhbCk7XG4gICAgfVxuICAgIHJldHVybiB0b2tlbnM7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZUJsb2NrKGRlbGltaXRlcnM6IG51bWJlcik6IENzc0Jsb2NrQXN0IHtcbiAgICBkZWxpbWl0ZXJzIHw9IFJCUkFDRV9ERUxJTV9GTEFHO1xuXG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5CTE9DSyk7XG5cbiAgICBjb25zdCBzdGFydFRva2VuID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAneycpO1xuICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZUVtcHR5U3RhdGVtZW50cygpO1xuXG4gICAgY29uc3QgcmVzdWx0czogQ3NzUnVsZUFzdFtdID0gW107XG4gICAgd2hpbGUgKCFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGRlbGltaXRlcnMpKSB7XG4gICAgICByZXN1bHRzLnB1c2godGhpcy5fcGFyc2VSdWxlKGRlbGltaXRlcnMpKTtcbiAgICB9XG5cbiAgICBjb25zdCBlbmRUb2tlbiA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJ30nKTtcblxuICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuQkxPQ0spO1xuICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZUVtcHR5U3RhdGVtZW50cygpO1xuXG4gICAgY29uc3Qgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCBlbmRUb2tlbik7XG4gICAgcmV0dXJuIG5ldyBDc3NCbG9ja0FzdChzcGFuLCByZXN1bHRzKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3BhcnNlU3R5bGVCbG9jayhkZWxpbWl0ZXJzOiBudW1iZXIpOiBDc3NTdHlsZXNCbG9ja0FzdHxudWxsIHtcbiAgICBkZWxpbWl0ZXJzIHw9IFJCUkFDRV9ERUxJTV9GTEFHIHwgTEJSQUNFX0RFTElNX0ZMQUc7XG5cbiAgICB0aGlzLl9zY2FubmVyLnNldE1vZGUoQ3NzTGV4ZXJNb2RlLlNUWUxFX0JMT0NLKTtcblxuICAgIGNvbnN0IHN0YXJ0VG9rZW4gPSB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICd7Jyk7XG4gICAgaWYgKHN0YXJ0VG9rZW4ubnVtVmFsdWUgIT0gY2hhcnMuJExCUkFDRSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGVmaW5pdGlvbnM6IENzc0RlZmluaXRpb25Bc3RbXSA9IFtdO1xuICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZUVtcHR5U3RhdGVtZW50cygpO1xuXG4gICAgd2hpbGUgKCFjaGFyYWN0ZXJDb250YWluc0RlbGltaXRlcih0aGlzLl9zY2FubmVyLnBlZWssIGRlbGltaXRlcnMpKSB7XG4gICAgICBkZWZpbml0aW9ucy5wdXNoKHRoaXMuX3BhcnNlRGVmaW5pdGlvbihkZWxpbWl0ZXJzKSk7XG4gICAgICB0aGlzLl9zY2FubmVyLmNvbnN1bWVFbXB0eVN0YXRlbWVudHMoKTtcbiAgICB9XG5cbiAgICBjb25zdCBlbmRUb2tlbiA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLkNoYXJhY3RlciwgJ30nKTtcblxuICAgIHRoaXMuX3NjYW5uZXIuc2V0TW9kZShDc3NMZXhlck1vZGUuU1RZTEVfQkxPQ0spO1xuICAgIHRoaXMuX3NjYW5uZXIuY29uc3VtZUVtcHR5U3RhdGVtZW50cygpO1xuXG4gICAgY29uc3Qgc3BhbiA9IHRoaXMuX2dlbmVyYXRlU291cmNlU3BhbihzdGFydFRva2VuLCBlbmRUb2tlbik7XG4gICAgcmV0dXJuIG5ldyBDc3NTdHlsZXNCbG9ja0FzdChzcGFuLCBkZWZpbml0aW9ucyk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9wYXJzZURlZmluaXRpb24oZGVsaW1pdGVyczogbnVtYmVyKTogQ3NzRGVmaW5pdGlvbkFzdCB7XG4gICAgdGhpcy5fc2Nhbm5lci5zZXRNb2RlKENzc0xleGVyTW9kZS5TVFlMRV9CTE9DSyk7XG5cbiAgICBsZXQgcHJvcCA9IHRoaXMuX2NvbnN1bWUoQ3NzVG9rZW5UeXBlLklkZW50aWZpZXIpO1xuICAgIGxldCBwYXJzZVZhbHVlOiBib29sZWFuID0gZmFsc2U7XG4gICAgbGV0IHZhbHVlOiBDc3NTdHlsZVZhbHVlQXN0fG51bGwgPSBudWxsO1xuICAgIGxldCBlbmRUb2tlbjogQ3NzVG9rZW58Q3NzU3R5bGVWYWx1ZUFzdCA9IHByb3A7XG5cbiAgICAvLyB0aGUgY29sb24gdmFsdWUgc2VwYXJhdGVzIHRoZSBwcm9wIGZyb20gdGhlIHN0eWxlLlxuICAgIC8vIHRoZXJlIGFyZSBhIGZldyBjYXNlcyBhcyB0byB3aGF0IGNvdWxkIGhhcHBlbiBpZiBpdFxuICAgIC8vIGlzIG1pc3NpbmdcbiAgICBzd2l0Y2ggKHRoaXMuX3NjYW5uZXIucGVlaykge1xuICAgICAgY2FzZSBjaGFycy4kU0VNSUNPTE9OOlxuICAgICAgY2FzZSBjaGFycy4kUkJSQUNFOlxuICAgICAgY2FzZSBjaGFycy4kRU9GOlxuICAgICAgICBwYXJzZVZhbHVlID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZXQgcHJvcFN0ciA9IFtwcm9wLnN0clZhbHVlXTtcbiAgICAgICAgaWYgKHRoaXMuX3NjYW5uZXIucGVlayAhPSBjaGFycy4kQ09MT04pIHtcbiAgICAgICAgICAvLyB0aGlzIHdpbGwgdGhyb3cgdGhlIGVycm9yXG4gICAgICAgICAgY29uc3QgbmV4dFZhbHVlID0gdGhpcy5fY29uc3VtZShDc3NUb2tlblR5cGUuQ2hhcmFjdGVyLCAnOicpO1xuICAgICAgICAgIHByb3BTdHIucHVzaChuZXh0VmFsdWUuc3RyVmFsdWUpO1xuXG4gICAgICAgICAgY29uc3QgcmVtYWluaW5nVG9rZW5zID0gdGhpcy5fY29sbGVjdFVudGlsRGVsaW0oXG4gICAgICAgICAgICAgIGRlbGltaXRlcnMgfCBDT0xPTl9ERUxJTV9GTEFHIHwgU0VNSUNPTE9OX0RFTElNX0ZMQUcsIENzc1Rva2VuVHlwZS5JZGVudGlmaWVyKTtcbiAgICAgICAgICBpZiAocmVtYWluaW5nVG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJlbWFpbmluZ1Rva2Vucy5mb3JFYWNoKCh0b2tlbikgPT4geyBwcm9wU3RyLnB1c2godG9rZW4uc3RyVmFsdWUpOyB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBlbmRUb2tlbiA9IHByb3AgPVxuICAgICAgICAgICAgICBuZXcgQ3NzVG9rZW4ocHJvcC5pbmRleCwgcHJvcC5jb2x1bW4sIHByb3AubGluZSwgcHJvcC50eXBlLCBwcm9wU3RyLmpvaW4oJyAnKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0aGlzIG1lYW5zIHdlJ3ZlIHJlYWNoZWQgdGhlIGVuZCBvZiB0aGUgZGVmaW5pdGlvbiBhbmQvb3IgYmxvY2tcbiAgICAgICAgaWYgKHRoaXMuX3NjYW5uZXIucGVlayA9PSBjaGFycy4kQ09MT04pIHtcbiAgICAgICAgICB0aGlzLl9jb25zdW1lKENzc1Rva2VuVHlwZS5DaGFyYWN0ZXIsICc6Jyk7XG4gICAgICAgICAgcGFyc2VWYWx1ZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHBhcnNlVmFsdWUpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5fcGFyc2VWYWx1ZShkZWxpbWl0ZXJzKTtcbiAgICAgIGVuZFRva2VuID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2Vycm9yKFxuICAgICAgICAgIGdlbmVyYXRlRXJyb3JNZXNzYWdlKFxuICAgICAgICAgICAgICB0aGlzLl9nZXRTb3VyY2VDb250ZW50KCksIGBUaGUgQ1NTIHByb3BlcnR5IHdhcyBub3QgcGFpcmVkIHdpdGggYSBzdHlsZSB2YWx1ZWAsXG4gICAgICAgICAgICAgIHByb3Auc3RyVmFsdWUsIHByb3AuaW5kZXgsIHByb3AubGluZSwgcHJvcC5jb2x1bW4pLFxuICAgICAgICAgIHByb3ApO1xuICAgIH1cblxuICAgIGNvbnN0IHNwYW4gPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZVNwYW4ocHJvcCwgZW5kVG9rZW4pO1xuICAgIHJldHVybiBuZXcgQ3NzRGVmaW5pdGlvbkFzdChzcGFuLCBwcm9wLCB2YWx1ZSAhKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2Fzc2VydENvbmRpdGlvbihzdGF0dXM6IGJvb2xlYW4sIGVycm9yTWVzc2FnZTogc3RyaW5nLCBwcm9ibGVtVG9rZW46IENzc1Rva2VuKTogYm9vbGVhbiB7XG4gICAgaWYgKCFzdGF0dXMpIHtcbiAgICAgIHRoaXMuX2Vycm9yKGVycm9yTWVzc2FnZSwgcHJvYmxlbVRva2VuKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9lcnJvcihtZXNzYWdlOiBzdHJpbmcsIHByb2JsZW1Ub2tlbjogQ3NzVG9rZW4pIHtcbiAgICBjb25zdCBsZW5ndGggPSBwcm9ibGVtVG9rZW4uc3RyVmFsdWUubGVuZ3RoO1xuICAgIGNvbnN0IGVycm9yID0gQ3NzUGFyc2VFcnJvci5jcmVhdGUoXG4gICAgICAgIHRoaXMuX2ZpbGUsIDAsIHByb2JsZW1Ub2tlbi5saW5lLCBwcm9ibGVtVG9rZW4uY29sdW1uLCBsZW5ndGgsIG1lc3NhZ2UpO1xuICAgIHRoaXMuX2Vycm9ycy5wdXNoKGVycm9yKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ3NzUGFyc2VFcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBzdGF0aWMgY3JlYXRlKFxuICAgICAgZmlsZTogUGFyc2VTb3VyY2VGaWxlLCBvZmZzZXQ6IG51bWJlciwgbGluZTogbnVtYmVyLCBjb2w6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsXG4gICAgICBlcnJNc2c6IHN0cmluZyk6IENzc1BhcnNlRXJyb3Ige1xuICAgIGNvbnN0IHN0YXJ0ID0gbmV3IFBhcnNlTG9jYXRpb24oZmlsZSwgb2Zmc2V0LCBsaW5lLCBjb2wpO1xuICAgIGNvbnN0IGVuZCA9IG5ldyBQYXJzZUxvY2F0aW9uKGZpbGUsIG9mZnNldCwgbGluZSwgY29sICsgbGVuZ3RoKTtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydCwgZW5kKTtcbiAgICByZXR1cm4gbmV3IENzc1BhcnNlRXJyb3Ioc3BhbiwgJ0NTUyBQYXJzZSBFcnJvcjogJyArIGVyck1zZyk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIG1lc3NhZ2U6IHN0cmluZykgeyBzdXBlcihzcGFuLCBtZXNzYWdlKTsgfVxufVxuIl19