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
        define("@angular/compiler/src/ml_parser/parser", ["require", "exports", "tslib", "@angular/compiler/src/parse_util", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/lexer", "@angular/compiler/src/ml_parser/tags"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Parser = exports.ParseTreeResult = exports.TreeError = void 0;
    var tslib_1 = require("tslib");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var lex = require("@angular/compiler/src/ml_parser/lexer");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var TreeError = /** @class */ (function (_super) {
        tslib_1.__extends(TreeError, _super);
        function TreeError(elementName, span, msg) {
            var _this = _super.call(this, span, msg) || this;
            _this.elementName = elementName;
            return _this;
        }
        TreeError.create = function (elementName, span, msg) {
            return new TreeError(elementName, span, msg);
        };
        return TreeError;
    }(parse_util_1.ParseError));
    exports.TreeError = TreeError;
    var ParseTreeResult = /** @class */ (function () {
        function ParseTreeResult(rootNodes, errors) {
            this.rootNodes = rootNodes;
            this.errors = errors;
        }
        return ParseTreeResult;
    }());
    exports.ParseTreeResult = ParseTreeResult;
    var Parser = /** @class */ (function () {
        function Parser(getTagDefinition) {
            this.getTagDefinition = getTagDefinition;
        }
        Parser.prototype.parse = function (source, url, options) {
            var tokenizeResult = lex.tokenize(source, url, this.getTagDefinition, options);
            var parser = new _TreeBuilder(tokenizeResult.tokens, this.getTagDefinition);
            parser.build();
            return new ParseTreeResult(parser.rootNodes, tokenizeResult.errors.concat(parser.errors));
        };
        return Parser;
    }());
    exports.Parser = Parser;
    var _TreeBuilder = /** @class */ (function () {
        function _TreeBuilder(tokens, getTagDefinition) {
            this.tokens = tokens;
            this.getTagDefinition = getTagDefinition;
            this._index = -1;
            this._elementStack = [];
            this.rootNodes = [];
            this.errors = [];
            this._advance();
        }
        _TreeBuilder.prototype.build = function () {
            while (this._peek.type !== lex.TokenType.EOF) {
                if (this._peek.type === lex.TokenType.TAG_OPEN_START) {
                    this._consumeStartTag(this._advance());
                }
                else if (this._peek.type === lex.TokenType.TAG_CLOSE) {
                    this._consumeEndTag(this._advance());
                }
                else if (this._peek.type === lex.TokenType.CDATA_START) {
                    this._closeVoidElement();
                    this._consumeCdata(this._advance());
                }
                else if (this._peek.type === lex.TokenType.COMMENT_START) {
                    this._closeVoidElement();
                    this._consumeComment(this._advance());
                }
                else if (this._peek.type === lex.TokenType.TEXT || this._peek.type === lex.TokenType.RAW_TEXT ||
                    this._peek.type === lex.TokenType.ESCAPABLE_RAW_TEXT) {
                    this._closeVoidElement();
                    this._consumeText(this._advance());
                }
                else if (this._peek.type === lex.TokenType.EXPANSION_FORM_START) {
                    this._consumeExpansion(this._advance());
                }
                else {
                    // Skip all other tokens...
                    this._advance();
                }
            }
        };
        _TreeBuilder.prototype._advance = function () {
            var prev = this._peek;
            if (this._index < this.tokens.length - 1) {
                // Note: there is always an EOF token at the end
                this._index++;
            }
            this._peek = this.tokens[this._index];
            return prev;
        };
        _TreeBuilder.prototype._advanceIf = function (type) {
            if (this._peek.type === type) {
                return this._advance();
            }
            return null;
        };
        _TreeBuilder.prototype._consumeCdata = function (_startToken) {
            this._consumeText(this._advance());
            this._advanceIf(lex.TokenType.CDATA_END);
        };
        _TreeBuilder.prototype._consumeComment = function (token) {
            var text = this._advanceIf(lex.TokenType.RAW_TEXT);
            this._advanceIf(lex.TokenType.COMMENT_END);
            var value = text != null ? text.parts[0].trim() : null;
            this._addToParent(new html.Comment(value, token.sourceSpan));
        };
        _TreeBuilder.prototype._consumeExpansion = function (token) {
            var switchValue = this._advance();
            var type = this._advance();
            var cases = [];
            // read =
            while (this._peek.type === lex.TokenType.EXPANSION_CASE_VALUE) {
                var expCase = this._parseExpansionCase();
                if (!expCase)
                    return; // error
                cases.push(expCase);
            }
            // read the final }
            if (this._peek.type !== lex.TokenType.EXPANSION_FORM_END) {
                this.errors.push(TreeError.create(null, this._peek.sourceSpan, "Invalid ICU message. Missing '}'."));
                return;
            }
            var sourceSpan = new parse_util_1.ParseSourceSpan(token.sourceSpan.start, this._peek.sourceSpan.end, token.sourceSpan.fullStart);
            this._addToParent(new html.Expansion(switchValue.parts[0], type.parts[0], cases, sourceSpan, switchValue.sourceSpan));
            this._advance();
        };
        _TreeBuilder.prototype._parseExpansionCase = function () {
            var value = this._advance();
            // read {
            if (this._peek.type !== lex.TokenType.EXPANSION_CASE_EXP_START) {
                this.errors.push(TreeError.create(null, this._peek.sourceSpan, "Invalid ICU message. Missing '{'."));
                return null;
            }
            // read until }
            var start = this._advance();
            var exp = this._collectExpansionExpTokens(start);
            if (!exp)
                return null;
            var end = this._advance();
            exp.push(new lex.Token(lex.TokenType.EOF, [], end.sourceSpan));
            // parse everything in between { and }
            var expansionCaseParser = new _TreeBuilder(exp, this.getTagDefinition);
            expansionCaseParser.build();
            if (expansionCaseParser.errors.length > 0) {
                this.errors = this.errors.concat(expansionCaseParser.errors);
                return null;
            }
            var sourceSpan = new parse_util_1.ParseSourceSpan(value.sourceSpan.start, end.sourceSpan.end, value.sourceSpan.fullStart);
            var expSourceSpan = new parse_util_1.ParseSourceSpan(start.sourceSpan.start, end.sourceSpan.end, start.sourceSpan.fullStart);
            return new html.ExpansionCase(value.parts[0], expansionCaseParser.rootNodes, sourceSpan, value.sourceSpan, expSourceSpan);
        };
        _TreeBuilder.prototype._collectExpansionExpTokens = function (start) {
            var exp = [];
            var expansionFormStack = [lex.TokenType.EXPANSION_CASE_EXP_START];
            while (true) {
                if (this._peek.type === lex.TokenType.EXPANSION_FORM_START ||
                    this._peek.type === lex.TokenType.EXPANSION_CASE_EXP_START) {
                    expansionFormStack.push(this._peek.type);
                }
                if (this._peek.type === lex.TokenType.EXPANSION_CASE_EXP_END) {
                    if (lastOnStack(expansionFormStack, lex.TokenType.EXPANSION_CASE_EXP_START)) {
                        expansionFormStack.pop();
                        if (expansionFormStack.length == 0)
                            return exp;
                    }
                    else {
                        this.errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
                        return null;
                    }
                }
                if (this._peek.type === lex.TokenType.EXPANSION_FORM_END) {
                    if (lastOnStack(expansionFormStack, lex.TokenType.EXPANSION_FORM_START)) {
                        expansionFormStack.pop();
                    }
                    else {
                        this.errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
                        return null;
                    }
                }
                if (this._peek.type === lex.TokenType.EOF) {
                    this.errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
                    return null;
                }
                exp.push(this._advance());
            }
        };
        _TreeBuilder.prototype._consumeText = function (token) {
            var text = token.parts[0];
            if (text.length > 0 && text[0] == '\n') {
                var parent_1 = this._getParentElement();
                if (parent_1 != null && parent_1.children.length == 0 &&
                    this.getTagDefinition(parent_1.name).ignoreFirstLf) {
                    text = text.substring(1);
                }
            }
            if (text.length > 0) {
                this._addToParent(new html.Text(text, token.sourceSpan));
            }
        };
        _TreeBuilder.prototype._closeVoidElement = function () {
            var el = this._getParentElement();
            if (el && this.getTagDefinition(el.name).isVoid) {
                this._elementStack.pop();
            }
        };
        _TreeBuilder.prototype._consumeStartTag = function (startTagToken) {
            var prefix = startTagToken.parts[0];
            var name = startTagToken.parts[1];
            var attrs = [];
            while (this._peek.type === lex.TokenType.ATTR_NAME) {
                attrs.push(this._consumeAttr(this._advance()));
            }
            var fullName = this._getElementFullName(prefix, name, this._getParentElement());
            var selfClosing = false;
            // Note: There could have been a tokenizer error
            // so that we don't get a token for the end tag...
            if (this._peek.type === lex.TokenType.TAG_OPEN_END_VOID) {
                this._advance();
                selfClosing = true;
                var tagDef = this.getTagDefinition(fullName);
                if (!(tagDef.canSelfClose || tags_1.getNsPrefix(fullName) !== null || tagDef.isVoid)) {
                    this.errors.push(TreeError.create(fullName, startTagToken.sourceSpan, "Only void and foreign elements can be self closed \"" + startTagToken.parts[1] + "\""));
                }
            }
            else if (this._peek.type === lex.TokenType.TAG_OPEN_END) {
                this._advance();
                selfClosing = false;
            }
            var end = this._peek.sourceSpan.start;
            var span = new parse_util_1.ParseSourceSpan(startTagToken.sourceSpan.start, end, startTagToken.sourceSpan.fullStart);
            // Create a separate `startSpan` because `span` may be modified when there is an `end` span.
            var startSpan = new parse_util_1.ParseSourceSpan(startTagToken.sourceSpan.start, end, startTagToken.sourceSpan.fullStart);
            var el = new html.Element(fullName, attrs, [], span, startSpan, undefined);
            this._pushElement(el);
            if (selfClosing) {
                // Elements that are self-closed have their `endSourceSpan` set to the full span, as the
                // element start tag also represents the end tag.
                this._popElement(fullName, span);
            }
        };
        _TreeBuilder.prototype._pushElement = function (el) {
            var parentEl = this._getParentElement();
            if (parentEl && this.getTagDefinition(parentEl.name).isClosedByChild(el.name)) {
                this._elementStack.pop();
            }
            this._addToParent(el);
            this._elementStack.push(el);
        };
        _TreeBuilder.prototype._consumeEndTag = function (endTagToken) {
            var fullName = this._getElementFullName(endTagToken.parts[0], endTagToken.parts[1], this._getParentElement());
            if (this.getTagDefinition(fullName).isVoid) {
                this.errors.push(TreeError.create(fullName, endTagToken.sourceSpan, "Void elements do not have end tags \"" + endTagToken.parts[1] + "\""));
            }
            else if (!this._popElement(fullName, endTagToken.sourceSpan)) {
                var errMsg = "Unexpected closing tag \"" + fullName + "\". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags";
                this.errors.push(TreeError.create(fullName, endTagToken.sourceSpan, errMsg));
            }
        };
        _TreeBuilder.prototype._popElement = function (fullName, endSourceSpan) {
            for (var stackIndex = this._elementStack.length - 1; stackIndex >= 0; stackIndex--) {
                var el = this._elementStack[stackIndex];
                if (el.name == fullName) {
                    // Record the parse span with the element that is being closed. Any elements that are
                    // removed from the element stack at this point are closed implicitly, so they won't get
                    // an end source span (as there is no explicit closing element).
                    el.endSourceSpan = endSourceSpan;
                    this._elementStack.splice(stackIndex, this._elementStack.length - stackIndex);
                    return true;
                }
                if (!this.getTagDefinition(el.name).closedByParent) {
                    return false;
                }
            }
            return false;
        };
        _TreeBuilder.prototype._consumeAttr = function (attrName) {
            var fullName = tags_1.mergeNsAndName(attrName.parts[0], attrName.parts[1]);
            var end = attrName.sourceSpan.end;
            var value = '';
            var valueSpan = undefined;
            if (this._peek.type === lex.TokenType.ATTR_QUOTE) {
                this._advance();
            }
            if (this._peek.type === lex.TokenType.ATTR_VALUE) {
                var valueToken = this._advance();
                value = valueToken.parts[0];
                end = valueToken.sourceSpan.end;
                valueSpan = valueToken.sourceSpan;
            }
            if (this._peek.type === lex.TokenType.ATTR_QUOTE) {
                var quoteToken = this._advance();
                end = quoteToken.sourceSpan.end;
            }
            return new html.Attribute(fullName, value, new parse_util_1.ParseSourceSpan(attrName.sourceSpan.start, end, attrName.sourceSpan.fullStart), valueSpan);
        };
        _TreeBuilder.prototype._getParentElement = function () {
            return this._elementStack.length > 0 ? this._elementStack[this._elementStack.length - 1] : null;
        };
        _TreeBuilder.prototype._addToParent = function (node) {
            var parent = this._getParentElement();
            if (parent != null) {
                parent.children.push(node);
            }
            else {
                this.rootNodes.push(node);
            }
        };
        _TreeBuilder.prototype._getElementFullName = function (prefix, localName, parentElement) {
            if (prefix === '') {
                prefix = this.getTagDefinition(localName).implicitNamespacePrefix || '';
                if (prefix === '' && parentElement != null) {
                    var parentTagName = tags_1.splitNsName(parentElement.name)[1];
                    var parentTagDefinition = this.getTagDefinition(parentTagName);
                    if (!parentTagDefinition.preventNamespaceInheritance) {
                        prefix = tags_1.getNsPrefix(parentElement.name);
                    }
                }
            }
            return tags_1.mergeNsAndName(prefix, localName);
        };
        return _TreeBuilder;
    }());
    function lastOnStack(stack, element) {
        return stack.length > 0 && stack[stack.length - 1] === element;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL21sX3BhcnNlci9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILCtEQUEwRDtJQUUxRCwwREFBOEI7SUFDOUIsMkRBQStCO0lBQy9CLDZEQUErRTtJQUUvRTtRQUErQixxQ0FBVTtRQUt2QyxtQkFBbUIsV0FBd0IsRUFBRSxJQUFxQixFQUFFLEdBQVc7WUFBL0UsWUFDRSxrQkFBTSxJQUFJLEVBQUUsR0FBRyxDQUFDLFNBQ2pCO1lBRmtCLGlCQUFXLEdBQVgsV0FBVyxDQUFhOztRQUUzQyxDQUFDO1FBTk0sZ0JBQU0sR0FBYixVQUFjLFdBQXdCLEVBQUUsSUFBcUIsRUFBRSxHQUFXO1lBQ3hFLE9BQU8sSUFBSSxTQUFTLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBS0gsZ0JBQUM7SUFBRCxDQUFDLEFBUkQsQ0FBK0IsdUJBQVUsR0FReEM7SUFSWSw4QkFBUztJQVV0QjtRQUNFLHlCQUFtQixTQUFzQixFQUFTLE1BQW9CO1lBQW5ELGNBQVMsR0FBVCxTQUFTLENBQWE7WUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFjO1FBQUcsQ0FBQztRQUM1RSxzQkFBQztJQUFELENBQUMsQUFGRCxJQUVDO0lBRlksMENBQWU7SUFJNUI7UUFDRSxnQkFBbUIsZ0JBQW9EO1lBQXBELHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBb0M7UUFBRyxDQUFDO1FBRTNFLHNCQUFLLEdBQUwsVUFBTSxNQUFjLEVBQUUsR0FBVyxFQUFFLE9BQTZCO1lBQzlELElBQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDakYs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Z0JBQ2pCLE1BQU0sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUMsdUJBQXVCLElBQUksRUFBRSxDQUFDO2dCQUN4RSxJQUFJLE1BQU0sS0FBSyxFQUFFLElBQUksYUFBYSxJQUFJLElBQUksRUFBRTtvQkFDMUMsSUFBTSxhQUFhLEdBQUcsa0JBQVcsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3pELElBQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFDO29CQUNqRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsMkJBQTJCLEVBQUU7d0JBQ3BELE1BQU0sR0FBRyxrQkFBVyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDMUM7aUJBQ0Y7YUFDRjtZQUVELE9BQU8scUJBQWMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUNILG1CQUFDO0lBQUQsQ0FBQyxBQTVVRCxJQTRVQztJQUVELFNBQVMsV0FBVyxDQUFDLEtBQVksRUFBRSxPQUFZO1FBQzdDLE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssT0FBTyxDQUFDO0lBQ2pFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuXG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4vYXN0JztcbmltcG9ydCAqIGFzIGxleCBmcm9tICcuL2xleGVyJztcbmltcG9ydCB7Z2V0TnNQcmVmaXgsIG1lcmdlTnNBbmROYW1lLCBzcGxpdE5zTmFtZSwgVGFnRGVmaW5pdGlvbn0gZnJvbSAnLi90YWdzJztcblxuZXhwb3J0IGNsYXNzIFRyZWVFcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBzdGF0aWMgY3JlYXRlKGVsZW1lbnROYW1lOiBzdHJpbmd8bnVsbCwgc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBtc2c6IHN0cmluZyk6IFRyZWVFcnJvciB7XG4gICAgcmV0dXJuIG5ldyBUcmVlRXJyb3IoZWxlbWVudE5hbWUsIHNwYW4sIG1zZyk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZWxlbWVudE5hbWU6IHN0cmluZ3xudWxsLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIG1zZzogc3RyaW5nKSB7XG4gICAgc3VwZXIoc3BhbiwgbXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VUcmVlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHJvb3ROb2RlczogaHRtbC5Ob2RlW10sIHB1YmxpYyBlcnJvcnM6IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBnZXRUYWdEZWZpbml0aW9uOiAodGFnTmFtZTogc3RyaW5nKSA9PiBUYWdEZWZpbml0aW9uKSB7fVxuXG4gIHBhcnNlKHNvdXJjZTogc3RyaW5nLCB1cmw6IHN0cmluZywgb3B0aW9ucz86IGxleC5Ub2tlbml6ZU9wdGlvbnMpOiBQYXJzZVRyZWVSZXN1bHQge1xuICAgIGNvbnN0IHRva2VuaXplUmVzdWx0ID0gbGV4LnRva2VuaXplKHNvdXJjZSwgdXJsLCB0aGlzLmdldFRhZ0RlZmluaXRpb24sIG9wdGlvbnMpO1xuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBfVHJlZUJ1aWxkZXIodG9rZW5pemVSZXN1bHQudG9rZW5zLCB0aGlzLmdldFRhZ0RlZmluaXRpb24pO1xuICAgIHBhcnNlci5idWlsZCgpO1xuICAgIHJldHVybiBuZXcgUGFyc2VUcmVlUmVzdWx0KFxuICAgICAgICBwYXJzZXIucm9vdE5vZGVzLFxuICAgICAgICAodG9rZW5pemVSZXN1bHQuZXJyb3JzIGFzIFBhcnNlRXJyb3JbXSkuY29uY2F0KHBhcnNlci5lcnJvcnMpLFxuICAgICk7XG4gIH1cbn1cblxuY2xhc3MgX1RyZWVCdWlsZGVyIHtcbiAgcHJpdmF0ZSBfaW5kZXg6IG51bWJlciA9IC0xO1xuICAvLyBgX3BlZWtgIHdpbGwgYmUgaW5pdGlhbGl6ZWQgYnkgdGhlIGNhbGwgdG8gYGFkdmFuY2UoKWAgaW4gdGhlIGNvbnN0cnVjdG9yLlxuICBwcml2YXRlIF9wZWVrITogbGV4LlRva2VuO1xuICBwcml2YXRlIF9lbGVtZW50U3RhY2s6IGh0bWwuRWxlbWVudFtdID0gW107XG5cbiAgcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IFtdO1xuICBlcnJvcnM6IFRyZWVFcnJvcltdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHRva2VuczogbGV4LlRva2VuW10sIHByaXZhdGUgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbikge1xuICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgfVxuXG4gIGJ1aWxkKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgIT09IGxleC5Ub2tlblR5cGUuRU9GKSB7XG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLlRBR19PUEVOX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVTdGFydFRhZyh0aGlzLl9hZHZhbmNlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuVEFHX0NMT1NFKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVFbmRUYWcodGhpcy5fYWR2YW5jZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkNEQVRBX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUNkYXRhKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5DT01NRU5UX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUNvbW1lbnQodGhpcy5fYWR2YW5jZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLlRFWFQgfHwgdGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLlJBV19URVhUIHx8XG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVTQ0FQQUJMRV9SQVdfVEVYVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVUZXh0KHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTa2lwIGFsbCBvdGhlciB0b2tlbnMuLi5cbiAgICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FkdmFuY2UoKTogbGV4LlRva2VuIHtcbiAgICBjb25zdCBwcmV2ID0gdGhpcy5fcGVlaztcbiAgICBpZiAodGhpcy5faW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGggLSAxKSB7XG4gICAgICAvLyBOb3RlOiB0aGVyZSBpcyBhbHdheXMgYW4gRU9GIHRva2VuIGF0IHRoZSBlbmRcbiAgICAgIHRoaXMuX2luZGV4Kys7XG4gICAgfVxuICAgIHRoaXMuX3BlZWsgPSB0aGlzLnRva2Vuc1t0aGlzLl9pbmRleF07XG4gICAgcmV0dXJuIHByZXY7XG4gIH1cblxuICBwcml2YXRlIF9hZHZhbmNlSWYodHlwZTogbGV4LlRva2VuVHlwZSk6IGxleC5Ub2tlbnxudWxsIHtcbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSB0eXBlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYWR2YW5jZSgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVDZGF0YShfc3RhcnRUb2tlbjogbGV4LlRva2VuKSB7XG4gICAgdGhpcy5fY29uc3VtZVRleHQodGhpcy5fYWR2YW5jZSgpKTtcbiAgICB0aGlzLl9hZHZhbmNlSWYobGV4LlRva2VuVHlwZS5DREFUQV9FTkQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUNvbW1lbnQodG9rZW46IGxleC5Ub2tlbikge1xuICAgIGNvbnN0IHRleHQgPSB0aGlzLl9hZHZhbmNlSWYobGV4LlRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgdGhpcy5fYWR2YW5jZUlmKGxleC5Ub2tlblR5cGUuQ09NTUVOVF9FTkQpO1xuICAgIGNvbnN0IHZhbHVlID0gdGV4dCAhPSBudWxsID8gdGV4dC5wYXJ0c1swXS50cmltKCkgOiBudWxsO1xuICAgIHRoaXMuX2FkZFRvUGFyZW50KG5ldyBodG1sLkNvbW1lbnQodmFsdWUsIHRva2VuLnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVFeHBhbnNpb24odG9rZW46IGxleC5Ub2tlbikge1xuICAgIGNvbnN0IHN3aXRjaFZhbHVlID0gdGhpcy5fYWR2YW5jZSgpO1xuXG4gICAgY29uc3QgdHlwZSA9IHRoaXMuX2FkdmFuY2UoKTtcbiAgICBjb25zdCBjYXNlczogaHRtbC5FeHBhbnNpb25DYXNlW10gPSBbXTtcblxuICAgIC8vIHJlYWQgPVxuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfVkFMVUUpIHtcbiAgICAgIGNvbnN0IGV4cENhc2UgPSB0aGlzLl9wYXJzZUV4cGFuc2lvbkNhc2UoKTtcbiAgICAgIGlmICghZXhwQ2FzZSkgcmV0dXJuOyAgLy8gZXJyb3JcbiAgICAgIGNhc2VzLnB1c2goZXhwQ2FzZSk7XG4gICAgfVxuXG4gICAgLy8gcmVhZCB0aGUgZmluYWwgfVxuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgIT09IGxleC5Ub2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fRU5EKSB7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgdG9rZW4uc291cmNlU3Bhbi5zdGFydCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLmVuZCwgdG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIHRoaXMuX2FkZFRvUGFyZW50KG5ldyBodG1sLkV4cGFuc2lvbihcbiAgICAgICAgc3dpdGNoVmFsdWUucGFydHNbMF0sIHR5cGUucGFydHNbMF0sIGNhc2VzLCBzb3VyY2VTcGFuLCBzd2l0Y2hWYWx1ZS5zb3VyY2VTcGFuKSk7XG5cbiAgICB0aGlzLl9hZHZhbmNlKCk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUV4cGFuc2lvbkNhc2UoKTogaHRtbC5FeHBhbnNpb25DYXNlfG51bGwge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5fYWR2YW5jZSgpO1xuXG4gICAgLy8gcmVhZCB7XG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSAhPT0gbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCB0aGlzLl9wZWVrLnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd7Jy5gKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZWFkIHVudGlsIH1cbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2FkdmFuY2UoKTtcblxuICAgIGNvbnN0IGV4cCA9IHRoaXMuX2NvbGxlY3RFeHBhbnNpb25FeHBUb2tlbnMoc3RhcnQpO1xuICAgIGlmICghZXhwKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGVuZCA9IHRoaXMuX2FkdmFuY2UoKTtcbiAgICBleHAucHVzaChuZXcgbGV4LlRva2VuKGxleC5Ub2tlblR5cGUuRU9GLCBbXSwgZW5kLnNvdXJjZVNwYW4pKTtcblxuICAgIC8vIHBhcnNlIGV2ZXJ5dGhpbmcgaW4gYmV0d2VlbiB7IGFuZCB9XG4gICAgY29uc3QgZXhwYW5zaW9uQ2FzZVBhcnNlciA9IG5ldyBfVHJlZUJ1aWxkZXIoZXhwLCB0aGlzLmdldFRhZ0RlZmluaXRpb24pO1xuICAgIGV4cGFuc2lvbkNhc2VQYXJzZXIuYnVpbGQoKTtcbiAgICBpZiAoZXhwYW5zaW9uQ2FzZVBhcnNlci5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5lcnJvcnMgPSB0aGlzLmVycm9ycy5jb25jYXQoZXhwYW5zaW9uQ2FzZVBhcnNlci5lcnJvcnMpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc291cmNlU3BhbiA9XG4gICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4odmFsdWUuc291cmNlU3Bhbi5zdGFydCwgZW5kLnNvdXJjZVNwYW4uZW5kLCB2YWx1ZS5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgY29uc3QgZXhwU291cmNlU3BhbiA9XG4gICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQuc291cmNlU3Bhbi5zdGFydCwgZW5kLnNvdXJjZVNwYW4uZW5kLCBzdGFydC5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgcmV0dXJuIG5ldyBodG1sLkV4cGFuc2lvbkNhc2UoXG4gICAgICAgIHZhbHVlLnBhcnRzWzBdLCBleHBhbnNpb25DYXNlUGFyc2VyLnJvb3ROb2Rlcywgc291cmNlU3BhbiwgdmFsdWUuc291cmNlU3BhbiwgZXhwU291cmNlU3Bhbik7XG4gIH1cblxuICBwcml2YXRlIF9jb2xsZWN0RXhwYW5zaW9uRXhwVG9rZW5zKHN0YXJ0OiBsZXguVG9rZW4pOiBsZXguVG9rZW5bXXxudWxsIHtcbiAgICBjb25zdCBleHA6IGxleC5Ub2tlbltdID0gW107XG4gICAgY29uc3QgZXhwYW5zaW9uRm9ybVN0YWNrID0gW2xleC5Ub2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUXTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUIHx8XG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkge1xuICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucHVzaCh0aGlzLl9wZWVrLnR5cGUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9FTkQpIHtcbiAgICAgICAgaWYgKGxhc3RPblN0YWNrKGV4cGFuc2lvbkZvcm1TdGFjaywgbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpKSB7XG4gICAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnBvcCgpO1xuICAgICAgICAgIGlmIChleHBhbnNpb25Gb3JtU3RhY2subGVuZ3RoID09IDApIHJldHVybiBleHA7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9FTkQpIHtcbiAgICAgICAgaWYgKGxhc3RPblN0YWNrKGV4cGFuc2lvbkZvcm1TdGFjaywgbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCkpIHtcbiAgICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCBzdGFydC5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuRU9GKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBleHAucHVzaCh0aGlzLl9hZHZhbmNlKCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUZXh0KHRva2VuOiBsZXguVG9rZW4pIHtcbiAgICBsZXQgdGV4dCA9IHRva2VuLnBhcnRzWzBdO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDAgJiYgdGV4dFswXSA9PSAnXFxuJykge1xuICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5fZ2V0UGFyZW50RWxlbWVudCgpO1xuICAgICAgaWYgKHBhcmVudCAhPSBudWxsICYmIHBhcmVudC5jaGlsZHJlbi5sZW5ndGggPT0gMCAmJlxuICAgICAgICAgIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihwYXJlbnQubmFtZSkuaWdub3JlRmlyc3RMZikge1xuICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRleHQubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuVGV4dCh0ZXh0LCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY2xvc2VWb2lkRWxlbWVudCgpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKTtcbiAgICBpZiAoZWwgJiYgdGhpcy5nZXRUYWdEZWZpbml0aW9uKGVsLm5hbWUpLmlzVm9pZCkge1xuICAgICAgdGhpcy5fZWxlbWVudFN0YWNrLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVTdGFydFRhZyhzdGFydFRhZ1Rva2VuOiBsZXguVG9rZW4pIHtcbiAgICBjb25zdCBwcmVmaXggPSBzdGFydFRhZ1Rva2VuLnBhcnRzWzBdO1xuICAgIGNvbnN0IG5hbWUgPSBzdGFydFRhZ1Rva2VuLnBhcnRzWzFdO1xuICAgIGNvbnN0IGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdID0gW107XG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5BVFRSX05BTUUpIHtcbiAgICAgIGF0dHJzLnB1c2godGhpcy5fY29uc3VtZUF0dHIodGhpcy5fYWR2YW5jZSgpKSk7XG4gICAgfVxuICAgIGNvbnN0IGZ1bGxOYW1lID0gdGhpcy5fZ2V0RWxlbWVudEZ1bGxOYW1lKHByZWZpeCwgbmFtZSwgdGhpcy5fZ2V0UGFyZW50RWxlbWVudCgpKTtcbiAgICBsZXQgc2VsZkNsb3NpbmcgPSBmYWxzZTtcbiAgICAvLyBOb3RlOiBUaGVyZSBjb3VsZCBoYXZlIGJlZW4gYSB0b2tlbml6ZXIgZXJyb3JcbiAgICAvLyBzbyB0aGF0IHdlIGRvbid0IGdldCBhIHRva2VuIGZvciB0aGUgZW5kIHRhZy4uLlxuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSUQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHNlbGZDbG9zaW5nID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHRhZ0RlZiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSk7XG4gICAgICBpZiAoISh0YWdEZWYuY2FuU2VsZkNsb3NlIHx8IGdldE5zUHJlZml4KGZ1bGxOYW1lKSAhPT0gbnVsbCB8fCB0YWdEZWYuaXNWb2lkKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoXG4gICAgICAgICAgICBmdWxsTmFtZSwgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgYE9ubHkgdm9pZCBhbmQgZm9yZWlnbiBlbGVtZW50cyBjYW4gYmUgc2VsZiBjbG9zZWQgXCIke3N0YXJ0VGFnVG9rZW4ucGFydHNbMV19XCJgKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuVEFHX09QRU5fRU5EKSB7XG4gICAgICB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICBzZWxmQ2xvc2luZyA9IGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbmQgPSB0aGlzLl9wZWVrLnNvdXJjZVNwYW4uc3RhcnQ7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgIHN0YXJ0VGFnVG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICAvLyBDcmVhdGUgYSBzZXBhcmF0ZSBgc3RhcnRTcGFuYCBiZWNhdXNlIGBzcGFuYCBtYXkgYmUgbW9kaWZpZWQgd2hlbiB0aGVyZSBpcyBhbiBgZW5kYCBzcGFuLlxuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgIHN0YXJ0VGFnVG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICBjb25zdCBlbCA9IG5ldyBodG1sLkVsZW1lbnQoZnVsbE5hbWUsIGF0dHJzLCBbXSwgc3Bhbiwgc3RhcnRTcGFuLCB1bmRlZmluZWQpO1xuICAgIHRoaXMuX3B1c2hFbGVtZW50KGVsKTtcbiAgICBpZiAoc2VsZkNsb3NpbmcpIHtcbiAgICAgIC8vIEVsZW1lbnRzIHRoYXQgYXJlIHNlbGYtY2xvc2VkIGhhdmUgdGhlaXIgYGVuZFNvdXJjZVNwYW5gIHNldCB0byB0aGUgZnVsbCBzcGFuLCBhcyB0aGVcbiAgICAgIC8vIGVsZW1lbnQgc3RhcnQgdGFnIGFsc28gcmVwcmVzZW50cyB0aGUgZW5kIHRhZy5cbiAgICAgIHRoaXMuX3BvcEVsZW1lbnQoZnVsbE5hbWUsIHNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3B1c2hFbGVtZW50KGVsOiBodG1sLkVsZW1lbnQpIHtcbiAgICBjb25zdCBwYXJlbnRFbCA9IHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKTtcblxuICAgIGlmIChwYXJlbnRFbCAmJiB0aGlzLmdldFRhZ0RlZmluaXRpb24ocGFyZW50RWwubmFtZSkuaXNDbG9zZWRCeUNoaWxkKGVsLm5hbWUpKSB7XG4gICAgICB0aGlzLl9lbGVtZW50U3RhY2sucG9wKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fYWRkVG9QYXJlbnQoZWwpO1xuICAgIHRoaXMuX2VsZW1lbnRTdGFjay5wdXNoKGVsKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVFbmRUYWcoZW5kVGFnVG9rZW46IGxleC5Ub2tlbikge1xuICAgIGNvbnN0IGZ1bGxOYW1lID0gdGhpcy5fZ2V0RWxlbWVudEZ1bGxOYW1lKFxuICAgICAgICBlbmRUYWdUb2tlbi5wYXJ0c1swXSwgZW5kVGFnVG9rZW4ucGFydHNbMV0sIHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKSk7XG5cbiAgICBpZiAodGhpcy5nZXRUYWdEZWZpbml0aW9uKGZ1bGxOYW1lKS5pc1ZvaWQpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShcbiAgICAgICAgICBmdWxsTmFtZSwgZW5kVGFnVG9rZW4uc291cmNlU3BhbixcbiAgICAgICAgICBgVm9pZCBlbGVtZW50cyBkbyBub3QgaGF2ZSBlbmQgdGFncyBcIiR7ZW5kVGFnVG9rZW4ucGFydHNbMV19XCJgKSk7XG4gICAgfSBlbHNlIGlmICghdGhpcy5fcG9wRWxlbWVudChmdWxsTmFtZSwgZW5kVGFnVG9rZW4uc291cmNlU3BhbikpIHtcbiAgICAgIGNvbnN0IGVyck1zZyA9IGBVbmV4cGVjdGVkIGNsb3NpbmcgdGFnIFwiJHtcbiAgICAgICAgICBmdWxsTmFtZX1cIi4gSXQgbWF5IGhhcHBlbiB3aGVuIHRoZSB0YWcgaGFzIGFscmVhZHkgYmVlbiBjbG9zZWQgYnkgYW5vdGhlciB0YWcuIEZvciBtb3JlIGluZm8gc2VlIGh0dHBzOi8vd3d3LnczLm9yZy9UUi9odG1sNS9zeW50YXguaHRtbCNjbG9zaW5nLWVsZW1lbnRzLXRoYXQtaGF2ZS1pbXBsaWVkLWVuZC10YWdzYDtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShmdWxsTmFtZSwgZW5kVGFnVG9rZW4uc291cmNlU3BhbiwgZXJyTXNnKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcG9wRWxlbWVudChmdWxsTmFtZTogc3RyaW5nLCBlbmRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBib29sZWFuIHtcbiAgICBmb3IgKGxldCBzdGFja0luZGV4ID0gdGhpcy5fZWxlbWVudFN0YWNrLmxlbmd0aCAtIDE7IHN0YWNrSW5kZXggPj0gMDsgc3RhY2tJbmRleC0tKSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuX2VsZW1lbnRTdGFja1tzdGFja0luZGV4XTtcbiAgICAgIGlmIChlbC5uYW1lID09IGZ1bGxOYW1lKSB7XG4gICAgICAgIC8vIFJlY29yZCB0aGUgcGFyc2Ugc3BhbiB3aXRoIHRoZSBlbGVtZW50IHRoYXQgaXMgYmVpbmcgY2xvc2VkLiBBbnkgZWxlbWVudHMgdGhhdCBhcmVcbiAgICAgICAgLy8gcmVtb3ZlZCBmcm9tIHRoZSBlbGVtZW50IHN0YWNrIGF0IHRoaXMgcG9pbnQgYXJlIGNsb3NlZCBpbXBsaWNpdGx5LCBzbyB0aGV5IHdvbid0IGdldFxuICAgICAgICAvLyBhbiBlbmQgc291cmNlIHNwYW4gKGFzIHRoZXJlIGlzIG5vIGV4cGxpY2l0IGNsb3NpbmcgZWxlbWVudCkuXG4gICAgICAgIGVsLmVuZFNvdXJjZVNwYW4gPSBlbmRTb3VyY2VTcGFuO1xuXG4gICAgICAgIHRoaXMuX2VsZW1lbnRTdGFjay5zcGxpY2Uoc3RhY2tJbmRleCwgdGhpcy5fZWxlbWVudFN0YWNrLmxlbmd0aCAtIHN0YWNrSW5kZXgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmdldFRhZ0RlZmluaXRpb24oZWwubmFtZSkuY2xvc2VkQnlQYXJlbnQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQXR0cihhdHRyTmFtZTogbGV4LlRva2VuKTogaHRtbC5BdHRyaWJ1dGUge1xuICAgIGNvbnN0IGZ1bGxOYW1lID0gbWVyZ2VOc0FuZE5hbWUoYXR0ck5hbWUucGFydHNbMF0sIGF0dHJOYW1lLnBhcnRzWzFdKTtcbiAgICBsZXQgZW5kID0gYXR0ck5hbWUuc291cmNlU3Bhbi5lbmQ7XG4gICAgbGV0IHZhbHVlID0gJyc7XG4gICAgbGV0IHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFuID0gdW5kZWZpbmVkITtcbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkFUVFJfUVVPVEUpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5BVFRSX1ZBTFVFKSB7XG4gICAgICBjb25zdCB2YWx1ZVRva2VuID0gdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgdmFsdWUgPSB2YWx1ZVRva2VuLnBhcnRzWzBdO1xuICAgICAgZW5kID0gdmFsdWVUb2tlbi5zb3VyY2VTcGFuLmVuZDtcbiAgICAgIHZhbHVlU3BhbiA9IHZhbHVlVG9rZW4uc291cmNlU3BhbjtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5BVFRSX1FVT1RFKSB7XG4gICAgICBjb25zdCBxdW90ZVRva2VuID0gdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgZW5kID0gcXVvdGVUb2tlbi5zb3VyY2VTcGFuLmVuZDtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBodG1sLkF0dHJpYnV0ZShcbiAgICAgICAgZnVsbE5hbWUsIHZhbHVlLFxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKGF0dHJOYW1lLnNvdXJjZVNwYW4uc3RhcnQsIGVuZCwgYXR0ck5hbWUuc291cmNlU3Bhbi5mdWxsU3RhcnQpLFxuICAgICAgICB2YWx1ZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0UGFyZW50RWxlbWVudCgpOiBodG1sLkVsZW1lbnR8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2VsZW1lbnRTdGFjay5sZW5ndGggPiAwID8gdGhpcy5fZWxlbWVudFN0YWNrW3RoaXMuX2VsZW1lbnRTdGFjay5sZW5ndGggLSAxXSA6IG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9hZGRUb1BhcmVudChub2RlOiBodG1sLk5vZGUpIHtcbiAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCk7XG4gICAgaWYgKHBhcmVudCAhPSBudWxsKSB7XG4gICAgICBwYXJlbnQuY2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yb290Tm9kZXMucHVzaChub2RlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9nZXRFbGVtZW50RnVsbE5hbWUocHJlZml4OiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBwYXJlbnRFbGVtZW50OiBodG1sLkVsZW1lbnR8bnVsbCk6XG4gICAgICBzdHJpbmcge1xuICAgIGlmIChwcmVmaXggPT09ICcnKSB7XG4gICAgICBwcmVmaXggPSB0aGlzLmdldFRhZ0RlZmluaXRpb24obG9jYWxOYW1lKS5pbXBsaWNpdE5hbWVzcGFjZVByZWZpeCB8fCAnJztcbiAgICAgIGlmIChwcmVmaXggPT09ICcnICYmIHBhcmVudEVsZW1lbnQgIT0gbnVsbCkge1xuICAgICAgICBjb25zdCBwYXJlbnRUYWdOYW1lID0gc3BsaXROc05hbWUocGFyZW50RWxlbWVudC5uYW1lKVsxXTtcbiAgICAgICAgY29uc3QgcGFyZW50VGFnRGVmaW5pdGlvbiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihwYXJlbnRUYWdOYW1lKTtcbiAgICAgICAgaWYgKCFwYXJlbnRUYWdEZWZpbml0aW9uLnByZXZlbnROYW1lc3BhY2VJbmhlcml0YW5jZSkge1xuICAgICAgICAgIHByZWZpeCA9IGdldE5zUHJlZml4KHBhcmVudEVsZW1lbnQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWVyZ2VOc0FuZE5hbWUocHJlZml4LCBsb2NhbE5hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGxhc3RPblN0YWNrKHN0YWNrOiBhbnlbXSwgZWxlbWVudDogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBzdGFjay5sZW5ndGggPiAwICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBlbGVtZW50O1xufVxuIl19