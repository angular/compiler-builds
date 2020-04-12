/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __extends } from "tslib";
import { ParseError, ParseSourceSpan } from '../parse_util';
import * as html from './ast';
import * as lex from './lexer';
import { getNsPrefix, isNgContainer, mergeNsAndName } from './tags';
var TreeError = /** @class */ (function (_super) {
    __extends(TreeError, _super);
    function TreeError(elementName, span, msg) {
        var _this = _super.call(this, span, msg) || this;
        _this.elementName = elementName;
        return _this;
    }
    TreeError.create = function (elementName, span, msg) {
        return new TreeError(elementName, span, msg);
    };
    return TreeError;
}(ParseError));
export { TreeError };
var ParseTreeResult = /** @class */ (function () {
    function ParseTreeResult(rootNodes, errors) {
        this.rootNodes = rootNodes;
        this.errors = errors;
    }
    return ParseTreeResult;
}());
export { ParseTreeResult };
var Parser = /** @class */ (function () {
    function Parser(getTagDefinition) {
        this.getTagDefinition = getTagDefinition;
    }
    Parser.prototype.parse = function (source, url, options) {
        var tokensAndErrors = lex.tokenize(source, url, this.getTagDefinition, options);
        var treeAndErrors = new _TreeBuilder(tokensAndErrors.tokens, this.getTagDefinition).build();
        return new ParseTreeResult(treeAndErrors.rootNodes, tokensAndErrors.errors.concat(treeAndErrors.errors));
    };
    return Parser;
}());
export { Parser };
var _TreeBuilder = /** @class */ (function () {
    function _TreeBuilder(tokens, getTagDefinition) {
        this.tokens = tokens;
        this.getTagDefinition = getTagDefinition;
        this._index = -1;
        this._rootNodes = [];
        this._errors = [];
        this._elementStack = [];
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
        return new ParseTreeResult(this._rootNodes, this._errors);
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
    _TreeBuilder.prototype._consumeCdata = function (startToken) {
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
            this._errors.push(TreeError.create(null, this._peek.sourceSpan, "Invalid ICU message. Missing '}'."));
            return;
        }
        var sourceSpan = new ParseSourceSpan(token.sourceSpan.start, this._peek.sourceSpan.end);
        this._addToParent(new html.Expansion(switchValue.parts[0], type.parts[0], cases, sourceSpan, switchValue.sourceSpan));
        this._advance();
    };
    _TreeBuilder.prototype._parseExpansionCase = function () {
        var value = this._advance();
        // read {
        if (this._peek.type !== lex.TokenType.EXPANSION_CASE_EXP_START) {
            this._errors.push(TreeError.create(null, this._peek.sourceSpan, "Invalid ICU message. Missing '{'."));
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
        var parsedExp = new _TreeBuilder(exp, this.getTagDefinition).build();
        if (parsedExp.errors.length > 0) {
            this._errors = this._errors.concat(parsedExp.errors);
            return null;
        }
        var sourceSpan = new ParseSourceSpan(value.sourceSpan.start, end.sourceSpan.end);
        var expSourceSpan = new ParseSourceSpan(start.sourceSpan.start, end.sourceSpan.end);
        return new html.ExpansionCase(value.parts[0], parsedExp.rootNodes, sourceSpan, value.sourceSpan, expSourceSpan);
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
                    this._errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
                    return null;
                }
            }
            if (this._peek.type === lex.TokenType.EXPANSION_FORM_END) {
                if (lastOnStack(expansionFormStack, lex.TokenType.EXPANSION_FORM_START)) {
                    expansionFormStack.pop();
                }
                else {
                    this._errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
                    return null;
                }
            }
            if (this._peek.type === lex.TokenType.EOF) {
                this._errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
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
            if (!(tagDef.canSelfClose || getNsPrefix(fullName) !== null || tagDef.isVoid)) {
                this._errors.push(TreeError.create(fullName, startTagToken.sourceSpan, "Only void and foreign elements can be self closed \"" + startTagToken.parts[1] + "\""));
            }
        }
        else if (this._peek.type === lex.TokenType.TAG_OPEN_END) {
            this._advance();
            selfClosing = false;
        }
        var end = this._peek.sourceSpan.start;
        var span = new ParseSourceSpan(startTagToken.sourceSpan.start, end);
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
            this._errors.push(TreeError.create(fullName, endTagToken.sourceSpan, "Void elements do not have end tags \"" + endTagToken.parts[1] + "\""));
        }
        else if (!this._popElement(fullName)) {
            var errMsg = "Unexpected closing tag \"" + fullName + "\". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags";
            this._errors.push(TreeError.create(fullName, endTagToken.sourceSpan, errMsg));
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
        var fullName = mergeNsAndName(attrName.parts[0], attrName.parts[1]);
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
        return new html.Attribute(fullName, value, new ParseSourceSpan(attrName.sourceSpan.start, end), valueSpan);
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
            if (!isNgContainer(this._elementStack[i].name)) {
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
            this._rootNodes.push(node);
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
                this._rootNodes.push(node);
            }
            node.children.push(container);
            this._elementStack.splice(this._elementStack.indexOf(container), 0, node);
        }
    };
    _TreeBuilder.prototype._getElementFullName = function (prefix, localName, parentElement) {
        if (prefix === '') {
            prefix = this.getTagDefinition(localName).implicitNamespacePrefix || '';
            if (prefix === '' && parentElement != null) {
                prefix = getNsPrefix(parentElement.name);
            }
        }
        return mergeNsAndName(prefix, localName);
    };
    return _TreeBuilder;
}());
function lastOnStack(stack, element) {
    return stack.length > 0 && stack[stack.length - 1] === element;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL21sX3BhcnNlci9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQUVILE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRTFELE9BQU8sS0FBSyxJQUFJLE1BQU0sT0FBTyxDQUFDO0FBQzlCLE9BQU8sS0FBSyxHQUFHLE1BQU0sU0FBUyxDQUFDO0FBQy9CLE9BQU8sRUFBZ0IsV0FBVyxFQUFFLGFBQWEsRUFBRSxjQUFjLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFakY7SUFBK0IsNkJBQVU7SUFLdkMsbUJBQW1CLFdBQXdCLEVBQUUsSUFBcUIsRUFBRSxHQUFXO1FBQS9FLFlBQ0Usa0JBQU0sSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUNqQjtRQUZrQixpQkFBVyxHQUFYLFdBQVcsQ0FBYTs7SUFFM0MsQ0FBQztJQU5NLGdCQUFNLEdBQWIsVUFBYyxXQUF3QixFQUFFLElBQXFCLEVBQUUsR0FBVztRQUN4RSxPQUFPLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUtILGdCQUFDO0FBQUQsQ0FBQyxBQVJELENBQStCLFVBQVUsR0FReEM7O0FBRUQ7SUFDRSx5QkFBbUIsU0FBc0IsRUFBUyxNQUFvQjtRQUFuRCxjQUFTLEdBQVQsU0FBUyxDQUFhO1FBQVMsV0FBTSxHQUFOLE1BQU0sQ0FBYztJQUFHLENBQUM7SUFDNUUsc0JBQUM7QUFBRCxDQUFDLEFBRkQsSUFFQzs7QUFFRDtJQUNFLGdCQUFtQixnQkFBb0Q7UUFBcEQscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFvQztJQUFHLENBQUM7SUFFM0Usc0JBQUssR0FBTCxVQUFNLE1BQWMsRUFBRSxHQUFXLEVBQUUsT0FB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RUFBRSxJQUFJLGFBQWEsSUFBSSxJQUFJLEVBQUU7Z0JBQzFDLE1BQU0sR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFDO1NBQ0Y7UUFFRCxPQUFPLGNBQWMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUNILG1CQUFDO0FBQUQsQ0FBQyxBQTFXRCxJQTBXQztBQUVELFNBQVMsV0FBVyxDQUFDLEtBQVksRUFBRSxPQUFZO0lBQzdDLE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssT0FBTyxDQUFDO0FBQ2pFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuL2FzdCc7XG5pbXBvcnQgKiBhcyBsZXggZnJvbSAnLi9sZXhlcic7XG5pbXBvcnQge1RhZ0RlZmluaXRpb24sIGdldE5zUHJlZml4LCBpc05nQ29udGFpbmVyLCBtZXJnZU5zQW5kTmFtZX0gZnJvbSAnLi90YWdzJztcblxuZXhwb3J0IGNsYXNzIFRyZWVFcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBzdGF0aWMgY3JlYXRlKGVsZW1lbnROYW1lOiBzdHJpbmd8bnVsbCwgc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBtc2c6IHN0cmluZyk6IFRyZWVFcnJvciB7XG4gICAgcmV0dXJuIG5ldyBUcmVlRXJyb3IoZWxlbWVudE5hbWUsIHNwYW4sIG1zZyk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZWxlbWVudE5hbWU6IHN0cmluZ3xudWxsLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIG1zZzogc3RyaW5nKSB7XG4gICAgc3VwZXIoc3BhbiwgbXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VUcmVlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHJvb3ROb2RlczogaHRtbC5Ob2RlW10sIHB1YmxpYyBlcnJvcnM6IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBnZXRUYWdEZWZpbml0aW9uOiAodGFnTmFtZTogc3RyaW5nKSA9PiBUYWdEZWZpbml0aW9uKSB7fVxuXG4gIHBhcnNlKHNvdXJjZTogc3RyaW5nLCB1cmw6IHN0cmluZywgb3B0aW9ucz86IGxleC5Ub2tlbml6ZU9wdGlvbnMpOiBQYXJzZVRyZWVSZXN1bHQge1xuICAgIGNvbnN0IHRva2Vuc0FuZEVycm9ycyA9IGxleC50b2tlbml6ZShzb3VyY2UsIHVybCwgdGhpcy5nZXRUYWdEZWZpbml0aW9uLCBvcHRpb25zKTtcblxuICAgIGNvbnN0IHRyZWVBbmRFcnJvcnMgPSBuZXcgX1RyZWVCdWlsZGVyKHRva2Vuc0FuZEVycm9ycy50b2tlbnMsIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbikuYnVpbGQoKTtcblxuICAgIHJldHVybiBuZXcgUGFyc2VUcmVlUmVzdWx0KFxuICAgICAgICB0cmVlQW5kRXJyb3JzLnJvb3ROb2RlcyxcbiAgICAgICAgKDxQYXJzZUVycm9yW10+dG9rZW5zQW5kRXJyb3JzLmVycm9ycykuY29uY2F0KHRyZWVBbmRFcnJvcnMuZXJyb3JzKSk7XG4gIH1cbn1cblxuY2xhc3MgX1RyZWVCdWlsZGVyIHtcbiAgcHJpdmF0ZSBfaW5kZXg6IG51bWJlciA9IC0xO1xuICAvLyBUT0RPKGlzc3VlLzI0NTcxKTogcmVtb3ZlICchJy5cbiAgcHJpdmF0ZSBfcGVlayAhOiBsZXguVG9rZW47XG5cbiAgcHJpdmF0ZSBfcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IFtdO1xuICBwcml2YXRlIF9lcnJvcnM6IFRyZWVFcnJvcltdID0gW107XG5cbiAgcHJpdmF0ZSBfZWxlbWVudFN0YWNrOiBodG1sLkVsZW1lbnRbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0b2tlbnM6IGxleC5Ub2tlbltdLCBwcml2YXRlIGdldFRhZ0RlZmluaXRpb246ICh0YWdOYW1lOiBzdHJpbmcpID0+IFRhZ0RlZmluaXRpb24pIHtcbiAgICB0aGlzLl9hZHZhbmNlKCk7XG4gIH1cblxuICBidWlsZCgpOiBQYXJzZVRyZWVSZXN1bHQge1xuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgIT09IGxleC5Ub2tlblR5cGUuRU9GKSB7XG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLlRBR19PUEVOX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVTdGFydFRhZyh0aGlzLl9hZHZhbmNlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuVEFHX0NMT1NFKSB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVFbmRUYWcodGhpcy5fYWR2YW5jZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkNEQVRBX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUNkYXRhKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5DT01NRU5UX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUNvbW1lbnQodGhpcy5fYWR2YW5jZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLlRFWFQgfHwgdGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLlJBV19URVhUIHx8XG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVTQ0FQQUJMRV9SQVdfVEVYVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVUZXh0KHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uKHRoaXMuX2FkdmFuY2UoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTa2lwIGFsbCBvdGhlciB0b2tlbnMuLi5cbiAgICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFBhcnNlVHJlZVJlc3VsdCh0aGlzLl9yb290Tm9kZXMsIHRoaXMuX2Vycm9ycyk7XG4gIH1cblxuICBwcml2YXRlIF9hZHZhbmNlKCk6IGxleC5Ub2tlbiB7XG4gICAgY29uc3QgcHJldiA9IHRoaXMuX3BlZWs7XG4gICAgaWYgKHRoaXMuX2luZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoIC0gMSkge1xuICAgICAgLy8gTm90ZTogdGhlcmUgaXMgYWx3YXlzIGFuIEVPRiB0b2tlbiBhdCB0aGUgZW5kXG4gICAgICB0aGlzLl9pbmRleCsrO1xuICAgIH1cbiAgICB0aGlzLl9wZWVrID0gdGhpcy50b2tlbnNbdGhpcy5faW5kZXhdO1xuICAgIHJldHVybiBwcmV2O1xuICB9XG5cbiAgcHJpdmF0ZSBfYWR2YW5jZUlmKHR5cGU6IGxleC5Ub2tlblR5cGUpOiBsZXguVG9rZW58bnVsbCB7XG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gdHlwZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2FkdmFuY2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ2RhdGEoc3RhcnRUb2tlbjogbGV4LlRva2VuKSB7XG4gICAgdGhpcy5fY29uc3VtZVRleHQodGhpcy5fYWR2YW5jZSgpKTtcbiAgICB0aGlzLl9hZHZhbmNlSWYobGV4LlRva2VuVHlwZS5DREFUQV9FTkQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUNvbW1lbnQodG9rZW46IGxleC5Ub2tlbikge1xuICAgIGNvbnN0IHRleHQgPSB0aGlzLl9hZHZhbmNlSWYobGV4LlRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgdGhpcy5fYWR2YW5jZUlmKGxleC5Ub2tlblR5cGUuQ09NTUVOVF9FTkQpO1xuICAgIGNvbnN0IHZhbHVlID0gdGV4dCAhPSBudWxsID8gdGV4dC5wYXJ0c1swXS50cmltKCkgOiBudWxsO1xuICAgIHRoaXMuX2FkZFRvUGFyZW50KG5ldyBodG1sLkNvbW1lbnQodmFsdWUsIHRva2VuLnNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVFeHBhbnNpb24odG9rZW46IGxleC5Ub2tlbikge1xuICAgIGNvbnN0IHN3aXRjaFZhbHVlID0gdGhpcy5fYWR2YW5jZSgpO1xuXG4gICAgY29uc3QgdHlwZSA9IHRoaXMuX2FkdmFuY2UoKTtcbiAgICBjb25zdCBjYXNlczogaHRtbC5FeHBhbnNpb25DYXNlW10gPSBbXTtcblxuICAgIC8vIHJlYWQgPVxuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfVkFMVUUpIHtcbiAgICAgIGNvbnN0IGV4cENhc2UgPSB0aGlzLl9wYXJzZUV4cGFuc2lvbkNhc2UoKTtcbiAgICAgIGlmICghZXhwQ2FzZSkgcmV0dXJuOyAgLy8gZXJyb3JcbiAgICAgIGNhc2VzLnB1c2goZXhwQ2FzZSk7XG4gICAgfVxuXG4gICAgLy8gcmVhZCB0aGUgZmluYWwgfVxuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgIT09IGxleC5Ub2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fRU5EKSB7XG4gICAgICB0aGlzLl9lcnJvcnMucHVzaChcbiAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHRoaXMuX3BlZWsuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ30nLmApKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4odG9rZW4uc291cmNlU3Bhbi5zdGFydCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLmVuZCk7XG4gICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuRXhwYW5zaW9uKFxuICAgICAgICBzd2l0Y2hWYWx1ZS5wYXJ0c1swXSwgdHlwZS5wYXJ0c1swXSwgY2FzZXMsIHNvdXJjZVNwYW4sIHN3aXRjaFZhbHVlLnNvdXJjZVNwYW4pKTtcblxuICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlRXhwYW5zaW9uQ2FzZSgpOiBodG1sLkV4cGFuc2lvbkNhc2V8bnVsbCB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLl9hZHZhbmNlKCk7XG5cbiAgICAvLyByZWFkIHtcbiAgICBpZiAodGhpcy5fcGVlay50eXBlICE9PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkge1xuICAgICAgdGhpcy5fZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCB0aGlzLl9wZWVrLnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd7Jy5gKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZWFkIHVudGlsIH1cbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2FkdmFuY2UoKTtcblxuICAgIGNvbnN0IGV4cCA9IHRoaXMuX2NvbGxlY3RFeHBhbnNpb25FeHBUb2tlbnMoc3RhcnQpO1xuICAgIGlmICghZXhwKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGVuZCA9IHRoaXMuX2FkdmFuY2UoKTtcbiAgICBleHAucHVzaChuZXcgbGV4LlRva2VuKGxleC5Ub2tlblR5cGUuRU9GLCBbXSwgZW5kLnNvdXJjZVNwYW4pKTtcblxuICAgIC8vIHBhcnNlIGV2ZXJ5dGhpbmcgaW4gYmV0d2VlbiB7IGFuZCB9XG4gICAgY29uc3QgcGFyc2VkRXhwID0gbmV3IF9UcmVlQnVpbGRlcihleHAsIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbikuYnVpbGQoKTtcbiAgICBpZiAocGFyc2VkRXhwLmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9lcnJvcnMgPSB0aGlzLl9lcnJvcnMuY29uY2F0KDxUcmVlRXJyb3JbXT5wYXJzZWRFeHAuZXJyb3JzKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHZhbHVlLnNvdXJjZVNwYW4uc3RhcnQsIGVuZC5zb3VyY2VTcGFuLmVuZCk7XG4gICAgY29uc3QgZXhwU291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oc3RhcnQuc291cmNlU3Bhbi5zdGFydCwgZW5kLnNvdXJjZVNwYW4uZW5kKTtcbiAgICByZXR1cm4gbmV3IGh0bWwuRXhwYW5zaW9uQ2FzZShcbiAgICAgICAgdmFsdWUucGFydHNbMF0sIHBhcnNlZEV4cC5yb290Tm9kZXMsIHNvdXJjZVNwYW4sIHZhbHVlLnNvdXJjZVNwYW4sIGV4cFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29sbGVjdEV4cGFuc2lvbkV4cFRva2VucyhzdGFydDogbGV4LlRva2VuKTogbGV4LlRva2VuW118bnVsbCB7XG4gICAgY29uc3QgZXhwOiBsZXguVG9rZW5bXSA9IFtdO1xuICAgIGNvbnN0IGV4cGFuc2lvbkZvcm1TdGFjayA9IFtsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVF07XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCB8fFxuICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpIHtcbiAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnB1c2godGhpcy5fcGVlay50eXBlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfRU5EKSB7XG4gICAgICAgIGlmIChsYXN0T25TdGFjayhleHBhbnNpb25Gb3JtU3RhY2ssIGxleC5Ub2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUKSkge1xuICAgICAgICAgIGV4cGFuc2lvbkZvcm1TdGFjay5wb3AoKTtcbiAgICAgICAgICBpZiAoZXhwYW5zaW9uRm9ybVN0YWNrLmxlbmd0aCA9PSAwKSByZXR1cm4gZXhwO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fZXJyb3JzLnB1c2goXG4gICAgICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgc3RhcnQuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ30nLmApKTtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX0VORCkge1xuICAgICAgICBpZiAobGFzdE9uU3RhY2soZXhwYW5zaW9uRm9ybVN0YWNrLCBsZXguVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX1NUQVJUKSkge1xuICAgICAgICAgIGV4cGFuc2lvbkZvcm1TdGFjay5wb3AoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9lcnJvcnMucHVzaChcbiAgICAgICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCBzdGFydC5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuRU9GKSB7XG4gICAgICAgIHRoaXMuX2Vycm9ycy5wdXNoKFxuICAgICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCBzdGFydC5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgZXhwLnB1c2godGhpcy5fYWR2YW5jZSgpKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lVGV4dCh0b2tlbjogbGV4LlRva2VuKSB7XG4gICAgbGV0IHRleHQgPSB0b2tlbi5wYXJ0c1swXTtcbiAgICBpZiAodGV4dC5sZW5ndGggPiAwICYmIHRleHRbMF0gPT0gJ1xcbicpIHtcbiAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKTtcbiAgICAgIGlmIChwYXJlbnQgIT0gbnVsbCAmJiBwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID09IDAgJiZcbiAgICAgICAgICB0aGlzLmdldFRhZ0RlZmluaXRpb24ocGFyZW50Lm5hbWUpLmlnbm9yZUZpcnN0TGYpIHtcbiAgICAgICAgdGV4dCA9IHRleHQuc3Vic3RyaW5nKDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX2FkZFRvUGFyZW50KG5ldyBodG1sLlRleHQodGV4dCwgdG9rZW4uc291cmNlU3BhbikpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2Nsb3NlVm9pZEVsZW1lbnQoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCk7XG4gICAgaWYgKGVsICYmIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihlbC5uYW1lKS5pc1ZvaWQpIHtcbiAgICAgIHRoaXMuX2VsZW1lbnRTdGFjay5wb3AoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lU3RhcnRUYWcoc3RhcnRUYWdUb2tlbjogbGV4LlRva2VuKSB7XG4gICAgY29uc3QgcHJlZml4ID0gc3RhcnRUYWdUb2tlbi5wYXJ0c1swXTtcbiAgICBjb25zdCBuYW1lID0gc3RhcnRUYWdUb2tlbi5wYXJ0c1sxXTtcbiAgICBjb25zdCBhdHRyczogaHRtbC5BdHRyaWJ1dGVbXSA9IFtdO1xuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuQVRUUl9OQU1FKSB7XG4gICAgICBhdHRycy5wdXNoKHRoaXMuX2NvbnN1bWVBdHRyKHRoaXMuX2FkdmFuY2UoKSkpO1xuICAgIH1cbiAgICBjb25zdCBmdWxsTmFtZSA9IHRoaXMuX2dldEVsZW1lbnRGdWxsTmFtZShwcmVmaXgsIG5hbWUsIHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKSk7XG4gICAgbGV0IHNlbGZDbG9zaW5nID0gZmFsc2U7XG4gICAgLy8gTm90ZTogVGhlcmUgY291bGQgaGF2ZSBiZWVuIGEgdG9rZW5pemVyIGVycm9yXG4gICAgLy8gc28gdGhhdCB3ZSBkb24ndCBnZXQgYSB0b2tlbiBmb3IgdGhlIGVuZCB0YWcuLi5cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLlRBR19PUEVOX0VORF9WT0lEKSB7XG4gICAgICB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICBzZWxmQ2xvc2luZyA9IHRydWU7XG4gICAgICBjb25zdCB0YWdEZWYgPSB0aGlzLmdldFRhZ0RlZmluaXRpb24oZnVsbE5hbWUpO1xuICAgICAgaWYgKCEodGFnRGVmLmNhblNlbGZDbG9zZSB8fCBnZXROc1ByZWZpeChmdWxsTmFtZSkgIT09IG51bGwgfHwgdGFnRGVmLmlzVm9pZCkpIHtcbiAgICAgICAgdGhpcy5fZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShcbiAgICAgICAgICAgIGZ1bGxOYW1lLCBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICBgT25seSB2b2lkIGFuZCBmb3JlaWduIGVsZW1lbnRzIGNhbiBiZSBzZWxmIGNsb3NlZCBcIiR7c3RhcnRUYWdUb2tlbi5wYXJ0c1sxXX1cImApKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gbGV4LlRva2VuVHlwZS5UQUdfT1BFTl9FTkQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHNlbGZDbG9zaW5nID0gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IGVuZCA9IHRoaXMuX3BlZWsuc291cmNlU3Bhbi5zdGFydDtcbiAgICBjb25zdCBzcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZCk7XG4gICAgY29uc3QgZWwgPSBuZXcgaHRtbC5FbGVtZW50KGZ1bGxOYW1lLCBhdHRycywgW10sIHNwYW4sIHNwYW4sIHVuZGVmaW5lZCk7XG4gICAgdGhpcy5fcHVzaEVsZW1lbnQoZWwpO1xuICAgIGlmIChzZWxmQ2xvc2luZykge1xuICAgICAgdGhpcy5fcG9wRWxlbWVudChmdWxsTmFtZSk7XG4gICAgICBlbC5lbmRTb3VyY2VTcGFuID0gc3BhbjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9wdXNoRWxlbWVudChlbDogaHRtbC5FbGVtZW50KSB7XG4gICAgY29uc3QgcGFyZW50RWwgPSB0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCk7XG5cbiAgICBpZiAocGFyZW50RWwgJiYgdGhpcy5nZXRUYWdEZWZpbml0aW9uKHBhcmVudEVsLm5hbWUpLmlzQ2xvc2VkQnlDaGlsZChlbC5uYW1lKSkge1xuICAgICAgdGhpcy5fZWxlbWVudFN0YWNrLnBvcCgpO1xuICAgIH1cblxuICAgIHRoaXMuX2FkZFRvUGFyZW50KGVsKTtcbiAgICB0aGlzLl9lbGVtZW50U3RhY2sucHVzaChlbCk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lRW5kVGFnKGVuZFRhZ1Rva2VuOiBsZXguVG9rZW4pIHtcbiAgICBjb25zdCBmdWxsTmFtZSA9IHRoaXMuX2dldEVsZW1lbnRGdWxsTmFtZShcbiAgICAgICAgZW5kVGFnVG9rZW4ucGFydHNbMF0sIGVuZFRhZ1Rva2VuLnBhcnRzWzFdLCB0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCkpO1xuXG4gICAgaWYgKHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKSkge1xuICAgICAgdGhpcy5fZ2V0UGFyZW50RWxlbWVudCgpICEuZW5kU291cmNlU3BhbiA9IGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSkuaXNWb2lkKSB7XG4gICAgICB0aGlzLl9lcnJvcnMucHVzaChUcmVlRXJyb3IuY3JlYXRlKFxuICAgICAgICAgIGZ1bGxOYW1lLCBlbmRUYWdUb2tlbi5zb3VyY2VTcGFuLFxuICAgICAgICAgIGBWb2lkIGVsZW1lbnRzIGRvIG5vdCBoYXZlIGVuZCB0YWdzIFwiJHtlbmRUYWdUb2tlbi5wYXJ0c1sxXX1cImApKTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9wb3BFbGVtZW50KGZ1bGxOYW1lKSkge1xuICAgICAgY29uc3QgZXJyTXNnID0gYFVuZXhwZWN0ZWQgY2xvc2luZyB0YWcgXCIke1xuICAgICAgICAgIGZ1bGxOYW1lfVwiLiBJdCBtYXkgaGFwcGVuIHdoZW4gdGhlIHRhZyBoYXMgYWxyZWFkeSBiZWVuIGNsb3NlZCBieSBhbm90aGVyIHRhZy4gRm9yIG1vcmUgaW5mbyBzZWUgaHR0cHM6Ly93d3cudzMub3JnL1RSL2h0bWw1L3N5bnRheC5odG1sI2Nsb3NpbmctZWxlbWVudHMtdGhhdC1oYXZlLWltcGxpZWQtZW5kLXRhZ3NgO1xuICAgICAgdGhpcy5fZXJyb3JzLnB1c2goVHJlZUVycm9yLmNyZWF0ZShmdWxsTmFtZSwgZW5kVGFnVG9rZW4uc291cmNlU3BhbiwgZXJyTXNnKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcG9wRWxlbWVudChmdWxsTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgZm9yIChsZXQgc3RhY2tJbmRleCA9IHRoaXMuX2VsZW1lbnRTdGFjay5sZW5ndGggLSAxOyBzdGFja0luZGV4ID49IDA7IHN0YWNrSW5kZXgtLSkge1xuICAgICAgY29uc3QgZWwgPSB0aGlzLl9lbGVtZW50U3RhY2tbc3RhY2tJbmRleF07XG4gICAgICBpZiAoZWwubmFtZSA9PSBmdWxsTmFtZSkge1xuICAgICAgICB0aGlzLl9lbGVtZW50U3RhY2suc3BsaWNlKHN0YWNrSW5kZXgsIHRoaXMuX2VsZW1lbnRTdGFjay5sZW5ndGggLSBzdGFja0luZGV4KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5nZXRUYWdEZWZpbml0aW9uKGVsLm5hbWUpLmNsb3NlZEJ5UGFyZW50KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHIoYXR0ck5hbWU6IGxleC5Ub2tlbik6IGh0bWwuQXR0cmlidXRlIHtcbiAgICBjb25zdCBmdWxsTmFtZSA9IG1lcmdlTnNBbmROYW1lKGF0dHJOYW1lLnBhcnRzWzBdLCBhdHRyTmFtZS5wYXJ0c1sxXSk7XG4gICAgbGV0IGVuZCA9IGF0dHJOYW1lLnNvdXJjZVNwYW4uZW5kO1xuICAgIGxldCB2YWx1ZSA9ICcnO1xuICAgIGxldCB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3BhbiA9IHVuZGVmaW5lZCAhO1xuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IGxleC5Ub2tlblR5cGUuQVRUUl9RVU9URSkge1xuICAgICAgdGhpcy5fYWR2YW5jZSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkFUVFJfVkFMVUUpIHtcbiAgICAgIGNvbnN0IHZhbHVlVG9rZW4gPSB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICB2YWx1ZSA9IHZhbHVlVG9rZW4ucGFydHNbMF07XG4gICAgICBlbmQgPSB2YWx1ZVRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgICAgdmFsdWVTcGFuID0gdmFsdWVUb2tlbi5zb3VyY2VTcGFuO1xuICAgIH1cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBsZXguVG9rZW5UeXBlLkFUVFJfUVVPVEUpIHtcbiAgICAgIGNvbnN0IHF1b3RlVG9rZW4gPSB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICBlbmQgPSBxdW90ZVRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IGh0bWwuQXR0cmlidXRlKFxuICAgICAgICBmdWxsTmFtZSwgdmFsdWUsIG5ldyBQYXJzZVNvdXJjZVNwYW4oYXR0ck5hbWUuc291cmNlU3Bhbi5zdGFydCwgZW5kKSwgdmFsdWVTcGFuKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFBhcmVudEVsZW1lbnQoKTogaHRtbC5FbGVtZW50fG51bGwge1xuICAgIHJldHVybiB0aGlzLl9lbGVtZW50U3RhY2subGVuZ3RoID4gMCA/IHRoaXMuX2VsZW1lbnRTdGFja1t0aGlzLl9lbGVtZW50U3RhY2subGVuZ3RoIC0gMV0gOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHBhcmVudCBpbiB0aGUgRE9NIGFuZCB0aGUgY29udGFpbmVyLlxuICAgKlxuICAgKiBgPG5nLWNvbnRhaW5lcj5gIGVsZW1lbnRzIGFyZSBza2lwcGVkIGFzIHRoZXkgYXJlIG5vdCByZW5kZXJlZCBhcyBET00gZWxlbWVudC5cbiAgICovXG4gIHByaXZhdGUgX2dldFBhcmVudEVsZW1lbnRTa2lwcGluZ0NvbnRhaW5lcnMoKTpcbiAgICAgIHtwYXJlbnQ6IGh0bWwuRWxlbWVudCB8IG51bGwsIGNvbnRhaW5lcjogaHRtbC5FbGVtZW50fG51bGx9IHtcbiAgICBsZXQgY29udGFpbmVyOiBodG1sLkVsZW1lbnR8bnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGxldCBpID0gdGhpcy5fZWxlbWVudFN0YWNrLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAoIWlzTmdDb250YWluZXIodGhpcy5fZWxlbWVudFN0YWNrW2ldLm5hbWUpKSB7XG4gICAgICAgIHJldHVybiB7cGFyZW50OiB0aGlzLl9lbGVtZW50U3RhY2tbaV0sIGNvbnRhaW5lcn07XG4gICAgICB9XG4gICAgICBjb250YWluZXIgPSB0aGlzLl9lbGVtZW50U3RhY2tbaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtwYXJlbnQ6IG51bGwsIGNvbnRhaW5lcn07XG4gIH1cblxuICBwcml2YXRlIF9hZGRUb1BhcmVudChub2RlOiBodG1sLk5vZGUpIHtcbiAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCk7XG4gICAgaWYgKHBhcmVudCAhPSBudWxsKSB7XG4gICAgICBwYXJlbnQuY2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcm9vdE5vZGVzLnB1c2gobm9kZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEluc2VydCBhIG5vZGUgYmV0d2VlbiB0aGUgcGFyZW50IGFuZCB0aGUgY29udGFpbmVyLlxuICAgKiBXaGVuIG5vIGNvbnRhaW5lciBpcyBnaXZlbiwgdGhlIG5vZGUgaXMgYXBwZW5kZWQgYXMgYSBjaGlsZCBvZiB0aGUgcGFyZW50LlxuICAgKiBBbHNvIHVwZGF0ZXMgdGhlIGVsZW1lbnQgc3RhY2sgYWNjb3JkaW5nbHkuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgcHJpdmF0ZSBfaW5zZXJ0QmVmb3JlQ29udGFpbmVyKFxuICAgICAgcGFyZW50OiBodG1sLkVsZW1lbnQsIGNvbnRhaW5lcjogaHRtbC5FbGVtZW50fG51bGwsIG5vZGU6IGh0bWwuRWxlbWVudCkge1xuICAgIGlmICghY29udGFpbmVyKSB7XG4gICAgICB0aGlzLl9hZGRUb1BhcmVudChub2RlKTtcbiAgICAgIHRoaXMuX2VsZW1lbnRTdGFjay5wdXNoKG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgIC8vIHJlcGxhY2UgdGhlIGNvbnRhaW5lciB3aXRoIHRoZSBuZXcgbm9kZSBpbiB0aGUgY2hpbGRyZW5cbiAgICAgICAgY29uc3QgaW5kZXggPSBwYXJlbnQuY2hpbGRyZW4uaW5kZXhPZihjb250YWluZXIpO1xuICAgICAgICBwYXJlbnQuY2hpbGRyZW5baW5kZXhdID0gbm9kZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Jvb3ROb2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgfVxuICAgICAgbm9kZS5jaGlsZHJlbi5wdXNoKGNvbnRhaW5lcik7XG4gICAgICB0aGlzLl9lbGVtZW50U3RhY2suc3BsaWNlKHRoaXMuX2VsZW1lbnRTdGFjay5pbmRleE9mKGNvbnRhaW5lciksIDAsIG5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2dldEVsZW1lbnRGdWxsTmFtZShwcmVmaXg6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHBhcmVudEVsZW1lbnQ6IGh0bWwuRWxlbWVudHxudWxsKTpcbiAgICAgIHN0cmluZyB7XG4gICAgaWYgKHByZWZpeCA9PT0gJycpIHtcbiAgICAgIHByZWZpeCA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihsb2NhbE5hbWUpLmltcGxpY2l0TmFtZXNwYWNlUHJlZml4IHx8ICcnO1xuICAgICAgaWYgKHByZWZpeCA9PT0gJycgJiYgcGFyZW50RWxlbWVudCAhPSBudWxsKSB7XG4gICAgICAgIHByZWZpeCA9IGdldE5zUHJlZml4KHBhcmVudEVsZW1lbnQubmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1lcmdlTnNBbmROYW1lKHByZWZpeCwgbG9jYWxOYW1lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBsYXN0T25TdGFjayhzdGFjazogYW55W10sIGVsZW1lbnQ6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gc3RhY2subGVuZ3RoID4gMCAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gZWxlbWVudDtcbn1cbiJdfQ==