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
        define("@angular/compiler/src/ml_parser/parser", ["require", "exports", "tslib", "@angular/compiler/src/parse_util", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/lexer", "@angular/compiler/src/ml_parser/tags"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
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
            var sourceSpan = new parse_util_1.ParseSourceSpan(token.sourceSpan.start, this._peek.sourceSpan.end);
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
            var sourceSpan = new parse_util_1.ParseSourceSpan(value.sourceSpan.start, end.sourceSpan.end);
            var expSourceSpan = new parse_util_1.ParseSourceSpan(start.sourceSpan.start, end.sourceSpan.end);
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
            var span = new parse_util_1.ParseSourceSpan(startTagToken.sourceSpan.start, end);
            var el = new html.Element(fullName, attrs, [], span, span, undefined);
            this._pushElement(el);
            if (selfClosing) {
                this._popElement(fullName);
                el.endSourceSpan = span;
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
            if (this._getParentElement()) {
                this._getParentElement().endSourceSpan = endTagToken.sourceSpan;
            }
            if (this.getTagDefinition(fullName).isVoid) {
                this.errors.push(TreeError.create(fullName, endTagToken.sourceSpan, "Void elements do not have end tags \"" + endTagToken.parts[1] + "\""));
            }
            else if (!this._popElement(fullName)) {
                var errMsg = "Unexpected closing tag \"" + fullName + "\". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags";
                this.errors.push(TreeError.create(fullName, endTagToken.sourceSpan, errMsg));
            }
        };
        _TreeBuilder.prototype._popElement = function (fullName) {
            for (var stackIndex = this._elementStack.length - 1; stackIndex >= 0; stackIndex--) {
                var el = this._elementStack[stackIndex];
                if (el.name == fullName) {
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
            return new html.Attribute(fullName, value, new parse_util_1.ParseSourceSpan(attrName.sourceSpan.start, end), valueSpan);
        };
        _TreeBuilder.prototype._getParentElement = function () {
            return this._elementStack.length > 0 ? this._elementStack[this._elementStack.length - 1] : null;
        };
        /**
         * Returns the parent in the DOM and the container.
         *
         * `<ng-container>` elements are skipped as they are not rendered as DOM element.
         */
        _TreeBuilder.prototype._getParentElementSkippingContainers = function () {
            var container = null;
            for (var i = this._elementStack.length - 1; i >= 0; i--) {
                if (!tags_1.isNgContainer(this._elementStack[i].name)) {
                    return { parent: this._elementStack[i], container: container };
                }
                container = this._elementStack[i];
            }
            return { parent: null, container: container };
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
        /**
         * Insert a node between the parent and the container.
         * When no container is given, the node is appended as a child of the parent.
         * Also updates the element stack accordingly.
         *
         * @internal
         */
        _TreeBuilder.prototype._insertBeforeContainer = function (parent, container, node) {
            if (!container) {
                this._addToParent(node);
                this._elementStack.push(node);
            }
            else {
                if (parent) {
                    // replace the container with the new node in the children
                    var index = parent.children.indexOf(container);
                    parent.children[index] = node;
                }
                else {
                    this.rootNodes.push(node);
                }
                node.children.push(container);
                this._elementStack.splice(this._elementStack.indexOf(container), 0, node);
            }
        };
        _TreeBuilder.prototype._getElementFullName = function (prefix, localName, parentElement) {
            if (prefix === '') {
                prefix = this.getTagDefinition(localName).implicitNamespacePrefix || '';
                if (prefix === '' && parentElement != null) {
                    prefix = tags_1.getNsPrefix(parentElement.name);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL21sX3BhcnNlci9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsK0RBQTBEO0lBRTFELDBEQUE4QjtJQUM5QiwyREFBK0I7SUFDL0IsNkRBQWlGO0lBRWpGO1FBQStCLHFDQUFVO1FBS3ZDLG1CQUFtQixXQUF3QixFQUFFLElBQXFCLEVBQUUsR0FBVztZQUEvRSxZQUNFLGtCQUFNLElBQUksRUFBRSxHQUFHLENBQUMsU0FDakI7WUFGa0IsaUJBQVcsR0FBWCxXQUFXLENBQWE7O1FBRTNDLENBQUM7UUFOTSxnQkFBTSxHQUFiLFVBQWMsV0FBd0IsRUFBRSxJQUFxQixFQUFFLEdBQVc7WUFDeEUsT0FBTyxJQUFJLFNBQVMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFLSCxnQkFBQztJQUFELENBQUMsQUFSRCxDQUErQix1QkFBVSxHQVF4QztJQVJZLDhCQUFTO0lBVXRCO1FBQ0UseUJBQW1CLFNBQXNCLEVBQVMsTUFBb0I7WUFBbkQsY0FBUyxHQUFULFNBQVMsQ0FBYTtZQUFTLFdBQU0sR0FBTixNQUFNLENBQWM7UUFBRyxDQUFDO1FBQzVFLHNCQUFDO0lBQUQsQ0FBQyxBQUZELElBRUM7SUFGWSwwQ0FBZTtJQUk1QjtRQUNFLGdCQUFtQixnQkFBb0Q7WUFBcEQscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFvQztRQUFHLENBQUM7UUFFM0Usc0JBQUssR0FBTCxVQUFNLE1BQWMsRUFBRSxHQUFXLEVBQUUsT0FBNkI7WUFDOUQsSUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNqRixJ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QUFNLEdBQUcsa0JBQVcsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQzFDO2FBQ0Y7WUFFRCxPQUFPLHFCQUFjLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFDSCxtQkFBQztJQUFELENBQUMsQUF6V0QsSUF5V0M7SUFFRCxTQUFTLFdBQVcsQ0FBQyxLQUFZLEVBQUUsT0FBWTtRQUM3QyxPQUFPLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLE9BQU8sQ0FBQztJQUNqRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5cbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi9hc3QnO1xuaW1wb3J0ICogYXMgbGV4IGZyb20gJy4vbGV4ZXInO1xuaW1wb3J0IHtnZXROc1ByZWZpeCwgaXNOZ0NvbnRhaW5lciwgbWVyZ2VOc0FuZE5hbWUsIFRhZ0RlZmluaXRpb259IGZyb20gJy4vdGFncyc7XG5cbmV4cG9ydCBjbGFzcyBUcmVlRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgc3RhdGljIGNyZWF0ZShlbGVtZW50TmFtZTogc3RyaW5nfG51bGwsIHNwYW46IFBhcnNlU291cmNlU3BhbiwgbXNnOiBzdHJpbmcpOiBUcmVlRXJyb3Ige1xuICAgIHJldHVybiBuZXcgVHJlZUVycm9yKGVsZW1lbnROYW1lLCBzcGFuLCBtc2cpO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHVibGljIGVsZW1lbnROYW1lOiBzdHJpbmd8bnVsbCwgc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBtc2c6IHN0cmluZykge1xuICAgIHN1cGVyKHNwYW4sIG1zZyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlVHJlZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByb290Tm9kZXM6IGh0bWwuTm9kZVtdLCBwdWJsaWMgZXJyb3JzOiBQYXJzZUVycm9yW10pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJzZXIge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbikge31cblxuICBwYXJzZShzb3VyY2U6IHN0cmluZywgdXJsOiBzdHJpbmcsIG9wdGlvbnM/OiBsZXguVG9rZW5pemVPcHRpb25zKTogUGFyc2VUcmVlUmVzdWx0IHtcbiAgICBjb25zdCB0b2tlbml6ZVJlc3VsdCA9IGxleC50b2tlbml6ZShzb3VyY2UsIHVybCwgdGhpcy5nZXRUYWdEZWZpbml0aW9uLCBvcHRpb25zKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgX1RyZWVCdWlsZGVyKHRva2VuaXplUmVzdWx0LnRva2VucywgdGhpcy5nZXRUYWdEZWZpbml0aW9uKTtcbiAgICBwYXJzZXIuYnVpbGQoKTtcbiAgICByZXR1cm4gbmV3IFBhcnNlVHJlZVJlc3VsdChcbiAgICAgICAgcGFyc2VyLnJvb3ROb2RlcyxcbiAgICAgICAgKHRva2VuaXplUmVzdWx0LmVycm9ycyBhcyBQYXJzZUVycm9yW10pLmNvbmNhdChwYXJzZXIuZXJyb3JzKSxcbiAgICApO1xuICB9XG59XG5cbmNsYXNzIF9UcmVlQnVpbGRlciB7XG4gIHByaXZhdGUgX2luZGV4OiBudW1iZXIgPSAtMTtcbiAgLy8gYF9wZWVrYCB3aWxsIGJlIGluaXRpYWxpemVkIGJ5IHRoZSBjYWxsIHRvIGBhZHZhbmNlKClgIGluIHRoZSBjb25zdHJ1Y3Rvci5cbiAgcHJpdmF0ZSBfcGVlayE6IGxleC5Ub2tlbjtcbiAgcHJpdmF0ZSBfZWxlbWVudFN0YWNrOiBodG1sLkVsZW1lbnRbXSA9IFtdO1xuXG4gIHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBbXTtcbiAgZXJyb3JzOiBUcmVlRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0b2tlbnM6IGxleC5Ub2tlbltdLCBwcml2YXRlIGdldFRhZ0RlZmluaXRpb246ICh0YWdOYW1lOiBzdHJpbmcpID0+IFRhZ0RlZmluaXRpb24pIHtcbiAgICB0aGlzLl9hZHZhbmNlKCk7XG4gIH1cblxuICBidWlsZCgpOiB2b2lkIHtcbiAgICB3aGlsZSAodGhpcy5fcGVlay50eXBlICE9PSBsZXguVG9rZW5UeXBlLkVPRikge1xuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5UQUdfT1BFTl9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jb25zdW1lU3RhcnRUYWcodGhpcy5fYWR2YW5jZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLlRBR19DTE9TRSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRW5kVGFnKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5DREFUQV9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVDZGF0YSh0aGlzLl9hZHZhbmNlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuQ09NTUVOVF9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVDb21tZW50KHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5URVhUIHx8IHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5SQVdfVEVYVCB8fFxuICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5FU0NBUEFCTEVfUkFXX1RFWFQpIHtcbiAgICAgICAgdGhpcy5fY2xvc2VWb2lkRWxlbWVudCgpO1xuICAgICAgICB0aGlzLl9jb25zdW1lVGV4dCh0aGlzLl9hZHZhbmNlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQpIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZUV4cGFuc2lvbih0aGlzLl9hZHZhbmNlKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU2tpcCBhbGwgb3RoZXIgdG9rZW5zLi4uXG4gICAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hZHZhbmNlKCk6IGxleC5Ub2tlbiB7XG4gICAgY29uc3QgcHJldiA9IHRoaXMuX3BlZWs7XG4gICAgaWYgKHRoaXMuX2luZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoIC0gMSkge1xuICAgICAgLy8gTm90ZTogdGhlcmUgaXMgYWx3YXlzIGFuIEVPRiB0b2tlbiBhdCB0aGUgZW5kXG4gICAgICB0aGlzLl9pbmRleCsrO1xuICAgIH1cbiAgICB0aGlzLl9wZWVrID0gdGhpcy50b2tlbnNbdGhpcy5faW5kZXhdO1xuICAgIHJldHVybiBwcmV2O1xuICB9XG5cbiAgcHJpdmF0ZSBfYWR2YW5jZUlmKHR5cGU6IGxleC5Ub2tlblR5cGUpOiBsZXguVG9rZW58bnVsbCB7XG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gdHlwZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2FkdmFuY2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ2RhdGEoX3N0YXJ0VG9rZW46IGxleC5Ub2tlbikge1xuICAgIHRoaXMuX2NvbnN1bWVUZXh0KHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgdGhpcy5fYWR2YW5jZUlmKGxleC5Ub2tlblR5cGUuQ0RBVEFfRU5EKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVDb21tZW50KHRva2VuOiBsZXguVG9rZW4pIHtcbiAgICBjb25zdCB0ZXh0ID0gdGhpcy5fYWR2YW5jZUlmKGxleC5Ub2tlblR5cGUuUkFXX1RFWFQpO1xuICAgIHRoaXMuX2FkdmFuY2VJZihsZXguVG9rZW5UeXBlLkNPTU1FTlRfRU5EKTtcbiAgICBjb25zdCB2YWx1ZSA9IHRleHQgIT0gbnVsbCA/IHRleHQucGFydHNbMF0udHJpbSgpIDogbnVsbDtcbiAgICB0aGlzLl9hZGRUb1BhcmVudChuZXcgaHRtbC5Db21tZW50KHZhbHVlLCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRXhwYW5zaW9uKHRva2VuOiBsZXguVG9rZW4pIHtcbiAgICBjb25zdCBzd2l0Y2hWYWx1ZSA9IHRoaXMuX2FkdmFuY2UoKTtcblxuICAgIGNvbnN0IHR5cGUgPSB0aGlzLl9hZHZhbmNlKCk7XG4gICAgY29uc3QgY2FzZXM6IGh0bWwuRXhwYW5zaW9uQ2FzZVtdID0gW107XG5cbiAgICAvLyByZWFkID1cbiAgICB3aGlsZSAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX1ZBTFVFKSB7XG4gICAgICBjb25zdCBleHBDYXNlID0gdGhpcy5fcGFyc2VFeHBhbnNpb25DYXNlKCk7XG4gICAgICBpZiAoIWV4cENhc2UpIHJldHVybjsgIC8vIGVycm9yXG4gICAgICBjYXNlcy5wdXNoKGV4cENhc2UpO1xuICAgIH1cblxuICAgIC8vIHJlYWQgdGhlIGZpbmFsIH1cbiAgICBpZiAodGhpcy5fcGVlay50eXBlICE9PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX0VORCkge1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHRoaXMuX3BlZWsuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ30nLmApKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4odG9rZW4uc291cmNlU3Bhbi5zdGFydCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLmVuZCk7XG4gICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuRXhwYW5zaW9uKFxuICAgICAgICBzd2l0Y2hWYWx1ZS5wYXJ0c1swXSwgdHlwZS5wYXJ0c1swXSwgY2FzZXMsIHNvdXJjZVNwYW4sIHN3aXRjaFZhbHVlLnNvdXJjZVNwYW4pKTtcblxuICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlRXhwYW5zaW9uQ2FzZSgpOiBodG1sLkV4cGFuc2lvbkNhc2V8bnVsbCB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLl9hZHZhbmNlKCk7XG5cbiAgICAvLyByZWFkIHtcbiAgICBpZiAodGhpcy5fcGVlay50eXBlICE9PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkge1xuICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHRoaXMuX3BlZWsuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ3snLmApKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIHJlYWQgdW50aWwgfVxuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fYWR2YW5jZSgpO1xuXG4gICAgY29uc3QgZXhwID0gdGhpcy5fY29sbGVjdEV4cGFuc2lvbkV4cFRva2VucyhzdGFydCk7XG4gICAgaWYgKCFleHApIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZW5kID0gdGhpcy5fYWR2YW5jZSgpO1xuICAgIGV4cC5wdXNoKG5ldyBsZXguVG9rZW4obGV4LlRva2VuVHlwZS5FT0YsIFtdLCBlbmQuc291cmNlU3BhbikpO1xuXG4gICAgLy8gcGFyc2UgZXZlcnl0aGluZyBpbiBiZXR3ZWVuIHsgYW5kIH1cbiAgICBjb25zdCBleHBhbnNpb25DYXNlUGFyc2VyID0gbmV3IF9UcmVlQnVpbGRlcihleHAsIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbik7XG4gICAgZXhwYW5zaW9uQ2FzZVBhcnNlci5idWlsZCgpO1xuICAgIGlmIChleHBhbnNpb25DYXNlUGFyc2VyLmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmNvbmNhdChleHBhbnNpb25DYXNlUGFyc2VyLmVycm9ycyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3Bhbih2YWx1ZS5zb3VyY2VTcGFuLnN0YXJ0LCBlbmQuc291cmNlU3Bhbi5lbmQpO1xuICAgIGNvbnN0IGV4cFNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LnNvdXJjZVNwYW4uc3RhcnQsIGVuZC5zb3VyY2VTcGFuLmVuZCk7XG4gICAgcmV0dXJuIG5ldyBodG1sLkV4cGFuc2lvbkNhc2UoXG4gICAgICAgIHZhbHVlLnBhcnRzWzBdLCBleHBhbnNpb25DYXNlUGFyc2VyLnJvb3ROb2Rlcywgc291cmNlU3BhbiwgdmFsdWUuc291cmNlU3BhbiwgZXhwU291cmNlU3Bhbik7XG4gIH1cblxuICBwcml2YXRlIF9jb2xsZWN0RXhwYW5zaW9uRXhwVG9rZW5zKHN0YXJ0OiBsZXguVG9rZW4pOiBsZXguVG9rZW5bXXxudWxsIHtcbiAgICBjb25zdCBleHA6IGxleC5Ub2tlbltdID0gW107XG4gICAgY29uc3QgZXhwYW5zaW9uRm9ybVN0YWNrID0gW2xleC5Ub2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUXTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUIHx8XG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkge1xuICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucHVzaCh0aGlzLl9wZWVrLnR5cGUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9FTkQpIHtcbiAgICAgICAgaWYgKGxhc3RPblN0YWNrKGV4cGFuc2lvbkZvcm1TdGFjaywgbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpKSB7XG4gICAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnBvcCgpO1xuICAgICAgICAgIGlmIChleHBhbnNpb25Gb3JtU3RhY2subGVuZ3RoID09IDApIHJldHVybiBleHA7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9FTkQpIHtcbiAgICAgICAgaWYgKGxhc3RPblN0YWNrKGV4cGFuc2lvbkZvcm1TdGFjaywgbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCkpIHtcbiAgICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5lcnJvcnMucHVzaChcbiAgICAgICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCBzdGFydC5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuRU9GKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBleHAucHVzaCh0aGlzLl9hZHZhbmNlKCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUZXh0KHRva2VuOiBsZXguVG9rZW4pIHtcbiAgICBsZXQgdGV4dCA9IHRva2VuLnBhcnRzWzBdO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDAgJiYgdGV4dFswXSA9PSAnXFxuJykge1xuICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5fZ2V0UGFyZW50RWxlbWVudCgpO1xuICAgICAgaWYgKHBhcmVudCAhPSBudWxsICYmIHBhcmVudC5jaGlsZHJlbi5sZW5ndGggPT0gMCAmJlxuICAgICAgICAgIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihwYXJlbnQubmFtZSkuaWdub3JlRmlyc3RMZikge1xuICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRleHQubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuVGV4dCh0ZXh0LCB0b2tlbi5zb3VyY2VTcGFuKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY2xvc2VWb2lkRWxlbWVudCgpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKTtcbiAgICBpZiAoZWwgJiYgdGhpcy5nZXRUYWdEZWZpbml0aW9uKGVsLm5hbWUpLmlzVm9pZCkge1xuICAgICAgdGhpcy5fZWxlbWVudFN0YWNrLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVTdGFydFRhZyhzdGFydFRhZ1Rva2VuOiBsZXguVG9rZW4pIHtcbiAgICBjb25zdCBwcmVmaXggPSBzdGFydFRhZ1Rva2VuLnBhcnRzWzBdO1xuICAgIGNvbnN0IG5hbWUgPSBzdGFydFRhZ1Rva2VuLnBhcnRzWzFdO1xuICAgIGNvbnN0IGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdID0gW107XG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5BVFRSX05BTUUpIHtcbiAgICAgIGF0dHJzLnB1c2godGhpcy5fY29uc3VtZUF0dHIodGhpcy5fYWR2YW5jZSgpKSk7XG4gICAgfVxuICAgIGNvbnN0IGZ1bGxOYW1lID0gdGhpcy5fZ2V0RWxlbWVudEZ1bGxOYW1lKHByZWZpeCwgbmFtZSwgdGhpcy5fZ2V0UGFyZW50RWxlbWVudCgpKTtcbiAgICBsZXQgc2VsZkNsb3NpbmcgPSBmYWxzZTtcbiAgICAvLyBOb3RlOiBUaGVyZSBjb3VsZCBoYXZlIGJlZW4gYSB0b2tlbml6ZXIgZXJyb3JcbiAgICAvLyBzbyB0aGF0IHdlIGRvbid0IGdldCBhIHRva2VuIGZvciB0aGUgZW5kIHRhZy4uLlxuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSUQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHNlbGZDbG9zaW5nID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHRhZ0RlZiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSk7XG4gICAgICBpZiAoISh0YWdEZWYuY2FuU2VsZkNsb3NlIHx8IGdldE5zUHJlZml4KGZ1bGxOYW1lKSAhPT0gbnVsbCB8fCB0YWdEZWYuaXNWb2lkKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoXG4gICAgICAgICAgICBmdWxsTmFtZSwgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgYE9ubHkgdm9pZCBhbmQgZm9yZWlnbiBlbGVtZW50cyBjYW4gYmUgc2VsZiBjbG9zZWQgXCIke3N0YXJ0VGFnVG9rZW4ucGFydHNbMV19XCJgKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuVEFHX09QRU5fRU5EKSB7XG4gICAgICB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICBzZWxmQ2xvc2luZyA9IGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbmQgPSB0aGlzLl9wZWVrLnNvdXJjZVNwYW4uc3RhcnQ7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLnN0YXJ0LCBlbmQpO1xuICAgIGNvbnN0IGVsID0gbmV3IGh0bWwuRWxlbWVudChmdWxsTmFtZSwgYXR0cnMsIFtdLCBzcGFuLCBzcGFuLCB1bmRlZmluZWQpO1xuICAgIHRoaXMuX3B1c2hFbGVtZW50KGVsKTtcbiAgICBpZiAoc2VsZkNsb3NpbmcpIHtcbiAgICAgIHRoaXMuX3BvcEVsZW1lbnQoZnVsbE5hbWUpO1xuICAgICAgZWwuZW5kU291cmNlU3BhbiA9IHNwYW47XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcHVzaEVsZW1lbnQoZWw6IGh0bWwuRWxlbWVudCkge1xuICAgIGNvbnN0IHBhcmVudEVsID0gdGhpcy5fZ2V0UGFyZW50RWxlbWVudCgpO1xuXG4gICAgaWYgKHBhcmVudEVsICYmIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihwYXJlbnRFbC5uYW1lKS5pc0Nsb3NlZEJ5Q2hpbGQoZWwubmFtZSkpIHtcbiAgICAgIHRoaXMuX2VsZW1lbnRTdGFjay5wb3AoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9hZGRUb1BhcmVudChlbCk7XG4gICAgdGhpcy5fZWxlbWVudFN0YWNrLnB1c2goZWwpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUVuZFRhZyhlbmRUYWdUb2tlbjogbGV4LlRva2VuKSB7XG4gICAgY29uc3QgZnVsbE5hbWUgPSB0aGlzLl9nZXRFbGVtZW50RnVsbE5hbWUoXG4gICAgICAgIGVuZFRhZ1Rva2VuLnBhcnRzWzBdLCBlbmRUYWdUb2tlbi5wYXJ0c1sxXSwgdGhpcy5fZ2V0UGFyZW50RWxlbWVudCgpKTtcblxuICAgIGlmICh0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCkpIHtcbiAgICAgIHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKSEuZW5kU291cmNlU3BhbiA9IGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSkuaXNWb2lkKSB7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoXG4gICAgICAgICAgZnVsbE5hbWUsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4sXG4gICAgICAgICAgYFZvaWQgZWxlbWVudHMgZG8gbm90IGhhdmUgZW5kIHRhZ3MgXCIke2VuZFRhZ1Rva2VuLnBhcnRzWzFdfVwiYCkpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX3BvcEVsZW1lbnQoZnVsbE5hbWUpKSB7XG4gICAgICBjb25zdCBlcnJNc2cgPSBgVW5leHBlY3RlZCBjbG9zaW5nIHRhZyBcIiR7XG4gICAgICAgICAgZnVsbE5hbWV9XCIuIEl0IG1heSBoYXBwZW4gd2hlbiB0aGUgdGFnIGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkIGJ5IGFub3RoZXIgdGFnLiBGb3IgbW9yZSBpbmZvIHNlZSBodHRwczovL3d3dy53My5vcmcvVFIvaHRtbDUvc3ludGF4Lmh0bWwjY2xvc2luZy1lbGVtZW50cy10aGF0LWhhdmUtaW1wbGllZC1lbmQtdGFnc2A7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoZnVsbE5hbWUsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4sIGVyck1zZykpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3BvcEVsZW1lbnQoZnVsbE5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGZvciAobGV0IHN0YWNrSW5kZXggPSB0aGlzLl9lbGVtZW50U3RhY2subGVuZ3RoIC0gMTsgc3RhY2tJbmRleCA+PSAwOyBzdGFja0luZGV4LS0pIHtcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5fZWxlbWVudFN0YWNrW3N0YWNrSW5kZXhdO1xuICAgICAgaWYgKGVsLm5hbWUgPT0gZnVsbE5hbWUpIHtcbiAgICAgICAgdGhpcy5fZWxlbWVudFN0YWNrLnNwbGljZShzdGFja0luZGV4LCB0aGlzLl9lbGVtZW50U3RhY2subGVuZ3RoIC0gc3RhY2tJbmRleCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMuZ2V0VGFnRGVmaW5pdGlvbihlbC5uYW1lKS5jbG9zZWRCeVBhcmVudCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVBdHRyKGF0dHJOYW1lOiBsZXguVG9rZW4pOiBodG1sLkF0dHJpYnV0ZSB7XG4gICAgY29uc3QgZnVsbE5hbWUgPSBtZXJnZU5zQW5kTmFtZShhdHRyTmFtZS5wYXJ0c1swXSwgYXR0ck5hbWUucGFydHNbMV0pO1xuICAgIGxldCBlbmQgPSBhdHRyTmFtZS5zb3VyY2VTcGFuLmVuZDtcbiAgICBsZXQgdmFsdWUgPSAnJztcbiAgICBsZXQgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW4gPSB1bmRlZmluZWQhO1xuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuQVRUUl9RVU9URSkge1xuICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkFUVFJfVkFMVUUpIHtcbiAgICAgIGNvbnN0IHZhbHVlVG9rZW4gPSB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICB2YWx1ZSA9IHZhbHVlVG9rZW4ucGFydHNbMF07XG4gICAgICBlbmQgPSB2YWx1ZVRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgICAgdmFsdWVTcGFuID0gdmFsdWVUb2tlbi5zb3VyY2VTcGFuO1xuICAgIH1cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkFUVFJfUVVPVEUpIHtcbiAgICAgIGNvbnN0IHF1b3RlVG9rZW4gPSB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICBlbmQgPSBxdW90ZVRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IGh0bWwuQXR0cmlidXRlKFxuICAgICAgICBmdWxsTmFtZSwgdmFsdWUsIG5ldyBQYXJzZVNvdXJjZVNwYW4oYXR0ck5hbWUuc291cmNlU3Bhbi5zdGFydCwgZW5kKSwgdmFsdWVTcGFuKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFBhcmVudEVsZW1lbnQoKTogaHRtbC5FbGVtZW50fG51bGwge1xuICAgIHJldHVybiB0aGlzLl9lbGVtZW50U3RhY2subGVuZ3RoID4gMCA/IHRoaXMuX2VsZW1lbnRTdGFja1t0aGlzLl9lbGVtZW50U3RhY2subGVuZ3RoIC0gMV0gOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHBhcmVudCBpbiB0aGUgRE9NIGFuZCB0aGUgY29udGFpbmVyLlxuICAgKlxuICAgKiBgPG5nLWNvbnRhaW5lcj5gIGVsZW1lbnRzIGFyZSBza2lwcGVkIGFzIHRoZXkgYXJlIG5vdCByZW5kZXJlZCBhcyBET00gZWxlbWVudC5cbiAgICovXG4gIHByaXZhdGUgX2dldFBhcmVudEVsZW1lbnRTa2lwcGluZ0NvbnRhaW5lcnMoKTpcbiAgICAgIHtwYXJlbnQ6IGh0bWwuRWxlbWVudHxudWxsLCBjb250YWluZXI6IGh0bWwuRWxlbWVudHxudWxsfSB7XG4gICAgbGV0IGNvbnRhaW5lcjogaHRtbC5FbGVtZW50fG51bGwgPSBudWxsO1xuXG4gICAgZm9yIChsZXQgaSA9IHRoaXMuX2VsZW1lbnRTdGFjay5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKCFpc05nQ29udGFpbmVyKHRoaXMuX2VsZW1lbnRTdGFja1tpXS5uYW1lKSkge1xuICAgICAgICByZXR1cm4ge3BhcmVudDogdGhpcy5fZWxlbWVudFN0YWNrW2ldLCBjb250YWluZXJ9O1xuICAgICAgfVxuICAgICAgY29udGFpbmVyID0gdGhpcy5fZWxlbWVudFN0YWNrW2ldO1xuICAgIH1cblxuICAgIHJldHVybiB7cGFyZW50OiBudWxsLCBjb250YWluZXJ9O1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkVG9QYXJlbnQobm9kZTogaHRtbC5Ob2RlKSB7XG4gICAgY29uc3QgcGFyZW50ID0gdGhpcy5fZ2V0UGFyZW50RWxlbWVudCgpO1xuICAgIGlmIChwYXJlbnQgIT0gbnVsbCkge1xuICAgICAgcGFyZW50LmNoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucm9vdE5vZGVzLnB1c2gobm9kZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEluc2VydCBhIG5vZGUgYmV0d2VlbiB0aGUgcGFyZW50IGFuZCB0aGUgY29udGFpbmVyLlxuICAgKiBXaGVuIG5vIGNvbnRhaW5lciBpcyBnaXZlbiwgdGhlIG5vZGUgaXMgYXBwZW5kZWQgYXMgYSBjaGlsZCBvZiB0aGUgcGFyZW50LlxuICAgKiBBbHNvIHVwZGF0ZXMgdGhlIGVsZW1lbnQgc3RhY2sgYWNjb3JkaW5nbHkuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgcHJpdmF0ZSBfaW5zZXJ0QmVmb3JlQ29udGFpbmVyKFxuICAgICAgcGFyZW50OiBodG1sLkVsZW1lbnQsIGNvbnRhaW5lcjogaHRtbC5FbGVtZW50fG51bGwsIG5vZGU6IGh0bWwuRWxlbWVudCkge1xuICAgIGlmICghY29udGFpbmVyKSB7XG4gICAgICB0aGlzLl9hZGRUb1BhcmVudChub2RlKTtcbiAgICAgIHRoaXMuX2VsZW1lbnRTdGFjay5wdXNoKG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgIC8vIHJlcGxhY2UgdGhlIGNvbnRhaW5lciB3aXRoIHRoZSBuZXcgbm9kZSBpbiB0aGUgY2hpbGRyZW5cbiAgICAgICAgY29uc3QgaW5kZXggPSBwYXJlbnQuY2hpbGRyZW4uaW5kZXhPZihjb250YWluZXIpO1xuICAgICAgICBwYXJlbnQuY2hpbGRyZW5baW5kZXhdID0gbm9kZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucm9vdE5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB9XG4gICAgICBub2RlLmNoaWxkcmVuLnB1c2goY29udGFpbmVyKTtcbiAgICAgIHRoaXMuX2VsZW1lbnRTdGFjay5zcGxpY2UodGhpcy5fZWxlbWVudFN0YWNrLmluZGV4T2YoY29udGFpbmVyKSwgMCwgbm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0RWxlbWVudEZ1bGxOYW1lKHByZWZpeDogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgcGFyZW50RWxlbWVudDogaHRtbC5FbGVtZW50fG51bGwpOlxuICAgICAgc3RyaW5nIHtcbiAgICBpZiAocHJlZml4ID09PSAnJykge1xuICAgICAgcHJlZml4ID0gdGhpcy5nZXRUYWdEZWZpbml0aW9uKGxvY2FsTmFtZSkuaW1wbGljaXROYW1lc3BhY2VQcmVmaXggfHwgJyc7XG4gICAgICBpZiAocHJlZml4ID09PSAnJyAmJiBwYXJlbnRFbGVtZW50ICE9IG51bGwpIHtcbiAgICAgICAgcHJlZml4ID0gZ2V0TnNQcmVmaXgocGFyZW50RWxlbWVudC5uYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWVyZ2VOc0FuZE5hbWUocHJlZml4LCBsb2NhbE5hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGxhc3RPblN0YWNrKHN0YWNrOiBhbnlbXSwgZWxlbWVudDogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBzdGFjay5sZW5ndGggPiAwICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBlbGVtZW50O1xufVxuIl19