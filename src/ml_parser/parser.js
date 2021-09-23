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
        define("@angular/compiler/src/ml_parser/parser", ["require", "exports", "tslib", "@angular/compiler/src/parse_util", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/entities", "@angular/compiler/src/ml_parser/lexer", "@angular/compiler/src/ml_parser/tags"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Parser = exports.ParseTreeResult = exports.TreeError = void 0;
    var tslib_1 = require("tslib");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var entities_1 = require("@angular/compiler/src/ml_parser/entities");
    var lexer_1 = require("@angular/compiler/src/ml_parser/lexer");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var TreeError = /** @class */ (function (_super) {
        (0, tslib_1.__extends)(TreeError, _super);
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
            var tokenizeResult = (0, lexer_1.tokenize)(source, url, this.getTagDefinition, options);
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
            while (this._peek.type !== 24 /* EOF */) {
                if (this._peek.type === 0 /* TAG_OPEN_START */ ||
                    this._peek.type === 4 /* INCOMPLETE_TAG_OPEN */) {
                    this._consumeStartTag(this._advance());
                }
                else if (this._peek.type === 3 /* TAG_CLOSE */) {
                    this._consumeEndTag(this._advance());
                }
                else if (this._peek.type === 12 /* CDATA_START */) {
                    this._closeVoidElement();
                    this._consumeCdata(this._advance());
                }
                else if (this._peek.type === 10 /* COMMENT_START */) {
                    this._closeVoidElement();
                    this._consumeComment(this._advance());
                }
                else if (this._peek.type === 5 /* TEXT */ || this._peek.type === 7 /* RAW_TEXT */ ||
                    this._peek.type === 6 /* ESCAPABLE_RAW_TEXT */) {
                    this._closeVoidElement();
                    this._consumeText(this._advance());
                }
                else if (this._peek.type === 19 /* EXPANSION_FORM_START */) {
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
            this._advanceIf(13 /* CDATA_END */);
        };
        _TreeBuilder.prototype._consumeComment = function (token) {
            var text = this._advanceIf(7 /* RAW_TEXT */);
            this._advanceIf(11 /* COMMENT_END */);
            var value = text != null ? text.parts[0].trim() : null;
            this._addToParent(new html.Comment(value, token.sourceSpan));
        };
        _TreeBuilder.prototype._consumeExpansion = function (token) {
            var switchValue = this._advance();
            var type = this._advance();
            var cases = [];
            // read =
            while (this._peek.type === 20 /* EXPANSION_CASE_VALUE */) {
                var expCase = this._parseExpansionCase();
                if (!expCase)
                    return; // error
                cases.push(expCase);
            }
            // read the final }
            if (this._peek.type !== 23 /* EXPANSION_FORM_END */) {
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
            if (this._peek.type !== 21 /* EXPANSION_CASE_EXP_START */) {
                this.errors.push(TreeError.create(null, this._peek.sourceSpan, "Invalid ICU message. Missing '{'."));
                return null;
            }
            // read until }
            var start = this._advance();
            var exp = this._collectExpansionExpTokens(start);
            if (!exp)
                return null;
            var end = this._advance();
            exp.push({ type: 24 /* EOF */, parts: [], sourceSpan: end.sourceSpan });
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
            var expansionFormStack = [21 /* EXPANSION_CASE_EXP_START */];
            while (true) {
                if (this._peek.type === 19 /* EXPANSION_FORM_START */ ||
                    this._peek.type === 21 /* EXPANSION_CASE_EXP_START */) {
                    expansionFormStack.push(this._peek.type);
                }
                if (this._peek.type === 22 /* EXPANSION_CASE_EXP_END */) {
                    if (lastOnStack(expansionFormStack, 21 /* EXPANSION_CASE_EXP_START */)) {
                        expansionFormStack.pop();
                        if (expansionFormStack.length === 0)
                            return exp;
                    }
                    else {
                        this.errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
                        return null;
                    }
                }
                if (this._peek.type === 23 /* EXPANSION_FORM_END */) {
                    if (lastOnStack(expansionFormStack, 19 /* EXPANSION_FORM_START */)) {
                        expansionFormStack.pop();
                    }
                    else {
                        this.errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
                        return null;
                    }
                }
                if (this._peek.type === 24 /* EOF */) {
                    this.errors.push(TreeError.create(null, start.sourceSpan, "Invalid ICU message. Missing '}'."));
                    return null;
                }
                exp.push(this._advance());
            }
        };
        _TreeBuilder.prototype._consumeText = function (token) {
            var tokens = [token];
            var startSpan = token.sourceSpan;
            var text = token.parts[0];
            if (text.length > 0 && text[0] === '\n') {
                var parent_1 = this._getParentElement();
                if (parent_1 != null && parent_1.children.length === 0 &&
                    this.getTagDefinition(parent_1.name).ignoreFirstLf) {
                    text = text.substring(1);
                    tokens[0] = { type: token.type, sourceSpan: token.sourceSpan, parts: [text] };
                }
            }
            while (this._peek.type === 8 /* INTERPOLATION */ || this._peek.type === 5 /* TEXT */ ||
                this._peek.type === 9 /* ENCODED_ENTITY */) {
                token = this._advance();
                tokens.push(token);
                if (token.type === 8 /* INTERPOLATION */) {
                    // For backward compatibility we decode HTML entities that appear in interpolation
                    // expressions. This is arguably a bug, but it could be a considerable breaking change to
                    // fix it. It should be addressed in a larger project to refactor the entire parser/lexer
                    // chain after View Engine has been removed.
                    text += token.parts.join('').replace(/&([^;]+);/g, decodeEntity);
                }
                else if (token.type === 9 /* ENCODED_ENTITY */) {
                    text += token.parts[0];
                }
                else {
                    text += token.parts.join('');
                }
            }
            if (text.length > 0) {
                var endSpan = token.sourceSpan;
                this._addToParent(new html.Text(text, new parse_util_1.ParseSourceSpan(startSpan.start, endSpan.end, startSpan.fullStart, startSpan.details), tokens));
            }
        };
        _TreeBuilder.prototype._closeVoidElement = function () {
            var el = this._getParentElement();
            if (el && this.getTagDefinition(el.name).isVoid) {
                this._elementStack.pop();
            }
        };
        _TreeBuilder.prototype._consumeStartTag = function (startTagToken) {
            var _a = (0, tslib_1.__read)(startTagToken.parts, 2), prefix = _a[0], name = _a[1];
            var attrs = [];
            while (this._peek.type === 14 /* ATTR_NAME */) {
                attrs.push(this._consumeAttr(this._advance()));
            }
            var fullName = this._getElementFullName(prefix, name, this._getParentElement());
            var selfClosing = false;
            // Note: There could have been a tokenizer error
            // so that we don't get a token for the end tag...
            if (this._peek.type === 2 /* TAG_OPEN_END_VOID */) {
                this._advance();
                selfClosing = true;
                var tagDef = this.getTagDefinition(fullName);
                if (!(tagDef.canSelfClose || (0, tags_1.getNsPrefix)(fullName) !== null || tagDef.isVoid)) {
                    this.errors.push(TreeError.create(fullName, startTagToken.sourceSpan, "Only void and foreign elements can be self closed \"" + startTagToken.parts[1] + "\""));
                }
            }
            else if (this._peek.type === 1 /* TAG_OPEN_END */) {
                this._advance();
                selfClosing = false;
            }
            var end = this._peek.sourceSpan.fullStart;
            var span = new parse_util_1.ParseSourceSpan(startTagToken.sourceSpan.start, end, startTagToken.sourceSpan.fullStart);
            // Create a separate `startSpan` because `span` will be modified when there is an `end` span.
            var startSpan = new parse_util_1.ParseSourceSpan(startTagToken.sourceSpan.start, end, startTagToken.sourceSpan.fullStart);
            var el = new html.Element(fullName, attrs, [], span, startSpan, undefined);
            this._pushElement(el);
            if (selfClosing) {
                // Elements that are self-closed have their `endSourceSpan` set to the full span, as the
                // element start tag also represents the end tag.
                this._popElement(fullName, span);
            }
            else if (startTagToken.type === 4 /* INCOMPLETE_TAG_OPEN */) {
                // We already know the opening tag is not complete, so it is unlikely it has a corresponding
                // close tag. Let's optimistically parse it as a full element and emit an error.
                this._popElement(fullName, null);
                this.errors.push(TreeError.create(fullName, span, "Opening tag \"" + fullName + "\" not terminated."));
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
        /**
         * Closes the nearest element with the tag name `fullName` in the parse tree.
         * `endSourceSpan` is the span of the closing tag, or null if the element does
         * not have a closing tag (for example, this happens when an incomplete
         * opening tag is recovered).
         */
        _TreeBuilder.prototype._popElement = function (fullName, endSourceSpan) {
            var unexpectedCloseTagDetected = false;
            for (var stackIndex = this._elementStack.length - 1; stackIndex >= 0; stackIndex--) {
                var el = this._elementStack[stackIndex];
                if (el.name === fullName) {
                    // Record the parse span with the element that is being closed. Any elements that are
                    // removed from the element stack at this point are closed implicitly, so they won't get
                    // an end source span (as there is no explicit closing element).
                    el.endSourceSpan = endSourceSpan;
                    el.sourceSpan.end = endSourceSpan !== null ? endSourceSpan.end : el.sourceSpan.end;
                    this._elementStack.splice(stackIndex, this._elementStack.length - stackIndex);
                    return !unexpectedCloseTagDetected;
                }
                if (!this.getTagDefinition(el.name).closedByParent) {
                    // Note that we encountered an unexpected close tag but continue processing the element
                    // stack so we can assign an `endSourceSpan` if there is a corresponding start tag for this
                    // end tag in the stack.
                    unexpectedCloseTagDetected = true;
                }
            }
            return false;
        };
        _TreeBuilder.prototype._consumeAttr = function (attrName) {
            var fullName = (0, tags_1.mergeNsAndName)(attrName.parts[0], attrName.parts[1]);
            var attrEnd = attrName.sourceSpan.end;
            // Consume any quote
            if (this._peek.type === 15 /* ATTR_QUOTE */) {
                this._advance();
            }
            // Consume the attribute value
            var value = '';
            var valueTokens = [];
            var valueStartSpan = undefined;
            var valueEnd = undefined;
            // NOTE: We need to use a new variable `nextTokenType` here to hide the actual type of
            // `_peek.type` from TS. Otherwise TS will narrow the type of `_peek.type` preventing it from
            // being able to consider `ATTR_VALUE_INTERPOLATION` as an option. This is because TS is not
            // able to see that `_advance()` will actually mutate `_peek`.
            var nextTokenType = this._peek.type;
            if (nextTokenType === 16 /* ATTR_VALUE_TEXT */) {
                valueStartSpan = this._peek.sourceSpan;
                valueEnd = this._peek.sourceSpan.end;
                while (this._peek.type === 16 /* ATTR_VALUE_TEXT */ ||
                    this._peek.type === 17 /* ATTR_VALUE_INTERPOLATION */ ||
                    this._peek.type === 9 /* ENCODED_ENTITY */) {
                    var valueToken = this._advance();
                    valueTokens.push(valueToken);
                    if (valueToken.type === 17 /* ATTR_VALUE_INTERPOLATION */) {
                        // For backward compatibility we decode HTML entities that appear in interpolation
                        // expressions. This is arguably a bug, but it could be a considerable breaking change to
                        // fix it. It should be addressed in a larger project to refactor the entire parser/lexer
                        // chain after View Engine has been removed.
                        value += valueToken.parts.join('').replace(/&([^;]+);/g, decodeEntity);
                    }
                    else if (valueToken.type === 9 /* ENCODED_ENTITY */) {
                        value += valueToken.parts[0];
                    }
                    else {
                        value += valueToken.parts.join('');
                    }
                    valueEnd = attrEnd = valueToken.sourceSpan.end;
                }
            }
            // Consume any quote
            if (this._peek.type === 15 /* ATTR_QUOTE */) {
                var quoteToken = this._advance();
                attrEnd = quoteToken.sourceSpan.end;
            }
            var valueSpan = valueStartSpan && valueEnd &&
                new parse_util_1.ParseSourceSpan(valueStartSpan.start, valueEnd, valueStartSpan.fullStart);
            return new html.Attribute(fullName, value, new parse_util_1.ParseSourceSpan(attrName.sourceSpan.start, attrEnd, attrName.sourceSpan.fullStart), attrName.sourceSpan, valueSpan, valueTokens.length > 0 ? valueTokens : undefined, undefined);
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
                    var parentTagName = (0, tags_1.splitNsName)(parentElement.name)[1];
                    var parentTagDefinition = this.getTagDefinition(parentTagName);
                    if (!parentTagDefinition.preventNamespaceInheritance) {
                        prefix = (0, tags_1.getNsPrefix)(parentElement.name);
                    }
                }
            }
            return (0, tags_1.mergeNsAndName)(prefix, localName);
        };
        return _TreeBuilder;
    }());
    function lastOnStack(stack, element) {
        return stack.length > 0 && stack[stack.length - 1] === element;
    }
    /**
     * Decode the `entity` string, which we believe is the contents of an HTML entity.
     *
     * If the string is not actually a valid/known entity then just return the original `match` string.
     */
    function decodeEntity(match, entity) {
        if (entities_1.NAMED_ENTITIES[entity] !== undefined) {
            return entities_1.NAMED_ENTITIES[entity] || match;
        }
        if (/^#x[a-f0-9]+$/i.test(entity)) {
            return String.fromCodePoint(parseInt(entity.slice(2), 16));
        }
        if (/^#\d+$/.test(entity)) {
            return String.fromCodePoint(parseInt(entity.slice(1), 10));
        }
        return match;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL21sX3BhcnNlci9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILCtEQUF5RTtJQUV6RSwwREFBOEI7SUFDOUIscUVBQTBDO0lBQzFDLCtEQUFrRDtJQUNsRCw2REFBK0U7SUFHL0U7UUFBK0IsMENBQVU7UUFLdkMsbUJBQW1CLFdBQXdCLEVBQUUsSUFBcUIsRUFBRSxHQUFXO1lBQS9FLFlBQ0Usa0JBQU0sSUFBSSxFQUFFLEdBQUcsQ0FBQyxTQUNqQjtZQUZrQixpQkFBVyxHQUFYLFdBQVcsQ0FBYTs7UUFFM0MsQ0FBQztRQU5NLGdCQUFNLEdBQWIsVUFBYyxXQUF3QixFQUFFLElBQXFCLEVBQUUsR0FBVztZQUN4RSxPQUFPLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUtILGdCQUFDO0lBQUQsQ0FBQyxBQVJELENBQStCLHVCQUFVLEdBUXhDO0lBUlksOEJBQVM7SUFVdEI7UUFDRSx5QkFBbUIsU0FBc0IsRUFBUyxNQUFvQjtZQUFuRCxjQUFTLEdBQVQsU0FBUyxDQUFhO1lBQVMsV0FBTSxHQUFOLE1BQU0sQ0FBYztRQUFHLENBQUM7UUFDNUUsc0JBQUM7SUFBRCxDQUFDLEFBRkQsSUFFQztJQUZZLDBDQUFlO0lBSTVCO1FBQ0UsZ0JBQW1CLGdCQUFvRDtZQUFwRCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW9DO1FBQUcsQ0FBQztRQUUzRSxzQkFBSyxHQUFMLFVBQU0sTUFBYyxFQUFFLEdBQVcsRUFBRSxPQUF5QjtZQUMxRCxJQUFNLGNBQWMsR0FBRyxJQUFBLGdCQUFRLEVBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLENB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RUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQzVEO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuL2FzdCc7XG5pbXBvcnQge05BTUVEX0VOVElUSUVTfSBmcm9tICcuL2VudGl0aWVzJztcbmltcG9ydCB7dG9rZW5pemUsIFRva2VuaXplT3B0aW9uc30gZnJvbSAnLi9sZXhlcic7XG5pbXBvcnQge2dldE5zUHJlZml4LCBtZXJnZU5zQW5kTmFtZSwgc3BsaXROc05hbWUsIFRhZ0RlZmluaXRpb259IGZyb20gJy4vdGFncyc7XG5pbXBvcnQge0F0dHJpYnV0ZU5hbWVUb2tlbiwgQXR0cmlidXRlUXVvdGVUb2tlbiwgQ2RhdGFTdGFydFRva2VuLCBDb21tZW50U3RhcnRUb2tlbiwgRXhwYW5zaW9uQ2FzZUV4cHJlc3Npb25FbmRUb2tlbiwgRXhwYW5zaW9uQ2FzZUV4cHJlc3Npb25TdGFydFRva2VuLCBFeHBhbnNpb25DYXNlVmFsdWVUb2tlbiwgRXhwYW5zaW9uRm9ybVN0YXJ0VG9rZW4sIEluY29tcGxldGVUYWdPcGVuVG9rZW4sIEludGVycG9sYXRlZEF0dHJpYnV0ZVRva2VuLCBJbnRlcnBvbGF0ZWRUZXh0VG9rZW4sIFRhZ0Nsb3NlVG9rZW4sIFRhZ09wZW5TdGFydFRva2VuLCBUZXh0VG9rZW4sIFRva2VuLCBUb2tlblR5cGV9IGZyb20gJy4vdG9rZW5zJztcblxuZXhwb3J0IGNsYXNzIFRyZWVFcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBzdGF0aWMgY3JlYXRlKGVsZW1lbnROYW1lOiBzdHJpbmd8bnVsbCwgc3BhbjogUGFyc2VTb3VyY2VTcGFuLCBtc2c6IHN0cmluZyk6IFRyZWVFcnJvciB7XG4gICAgcmV0dXJuIG5ldyBUcmVlRXJyb3IoZWxlbWVudE5hbWUsIHNwYW4sIG1zZyk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgZWxlbWVudE5hbWU6IHN0cmluZ3xudWxsLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIG1zZzogc3RyaW5nKSB7XG4gICAgc3VwZXIoc3BhbiwgbXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VUcmVlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHJvb3ROb2RlczogaHRtbC5Ob2RlW10sIHB1YmxpYyBlcnJvcnM6IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBnZXRUYWdEZWZpbml0aW9uOiAodGFnTmFtZTogc3RyaW5nKSA9PiBUYWdEZWZpbml0aW9uKSB7fVxuXG4gIHBhcnNlKHNvdXJjZTogc3RyaW5nLCB1cmw6IHN0cmluZywgb3B0aW9ucz86IFRva2VuaXplT3B0aW9ucyk6IFBhcnNlVHJlZVJlc3VsdCB7XG4gICAgY29uc3QgdG9rZW5pemVSZXN1bHQgPSB0b2tlbml6ZShzb3VyY2UsIHVybCwgdGhpcy5nZXRUYWdEZWZpbml0aW9uLCBvcHRpb25zKTtcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgX1RyZWVCdWlsZGVyKHRva2VuaXplUmVzdWx0LnRva2VucywgdGhpcy5nZXRUYWdEZWZpbml0aW9uKTtcbiAgICBwYXJzZXIuYnVpbGQoKTtcbiAgICByZXR1cm4gbmV3IFBhcnNlVHJlZVJlc3VsdChcbiAgICAgICAgcGFyc2VyLnJvb3ROb2RlcyxcbiAgICAgICAgKHRva2VuaXplUmVzdWx0LmVycm9ycyBhcyBQYXJzZUVycm9yW10pLmNvbmNhdChwYXJzZXIuZXJyb3JzKSxcbiAgICApO1xuICB9XG59XG5cbmNsYXNzIF9UcmVlQnVpbGRlciB7XG4gIHByaXZhdGUgX2luZGV4OiBudW1iZXIgPSAtMTtcbiAgLy8gYF9wZWVrYCB3aWxsIGJlIGluaXRpYWxpemVkIGJ5IHRoZSBjYWxsIHRvIGBfYWR2YW5jZSgpYCBpbiB0aGUgY29uc3RydWN0b3IuXG4gIHByaXZhdGUgX3BlZWshOiBUb2tlbjtcbiAgcHJpdmF0ZSBfZWxlbWVudFN0YWNrOiBodG1sLkVsZW1lbnRbXSA9IFtdO1xuXG4gIHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBbXTtcbiAgZXJyb3JzOiBUcmVlRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0b2tlbnM6IFRva2VuW10sIHByaXZhdGUgZ2V0VGFnRGVmaW5pdGlvbjogKHRhZ05hbWU6IHN0cmluZykgPT4gVGFnRGVmaW5pdGlvbikge1xuICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgfVxuXG4gIGJ1aWxkKCk6IHZvaWQge1xuICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgIT09IFRva2VuVHlwZS5FT0YpIHtcbiAgICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5UQUdfT1BFTl9TVEFSVCB8fFxuICAgICAgICAgIHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLklOQ09NUExFVEVfVEFHX09QRU4pIHtcbiAgICAgICAgdGhpcy5fY29uc3VtZVN0YXJ0VGFnKHRoaXMuX2FkdmFuY2U8VGFnT3BlblN0YXJ0VG9rZW58SW5jb21wbGV0ZVRhZ09wZW5Ub2tlbj4oKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlRBR19DTE9TRSkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRW5kVGFnKHRoaXMuX2FkdmFuY2U8VGFnQ2xvc2VUb2tlbj4oKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkNEQVRBX1NUQVJUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZUNkYXRhKHRoaXMuX2FkdmFuY2U8Q2RhdGFTdGFydFRva2VuPigpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQ09NTUVOVF9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jbG9zZVZvaWRFbGVtZW50KCk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVDb21tZW50KHRoaXMuX2FkdmFuY2U8Q29tbWVudFN0YXJ0VG9rZW4+KCkpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5URVhUIHx8IHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLlJBV19URVhUIHx8XG4gICAgICAgICAgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVNDQVBBQkxFX1JBV19URVhUKSB7XG4gICAgICAgIHRoaXMuX2Nsb3NlVm9pZEVsZW1lbnQoKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZVRleHQodGhpcy5fYWR2YW5jZTxUZXh0VG9rZW4+KCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FWFBBTlNJT05fRk9STV9TVEFSVCkge1xuICAgICAgICB0aGlzLl9jb25zdW1lRXhwYW5zaW9uKHRoaXMuX2FkdmFuY2U8RXhwYW5zaW9uRm9ybVN0YXJ0VG9rZW4+KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU2tpcCBhbGwgb3RoZXIgdG9rZW5zLi4uXG4gICAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hZHZhbmNlPFQgZXh0ZW5kcyBUb2tlbj4oKTogVCB7XG4gICAgY29uc3QgcHJldiA9IHRoaXMuX3BlZWs7XG4gICAgaWYgKHRoaXMuX2luZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoIC0gMSkge1xuICAgICAgLy8gTm90ZTogdGhlcmUgaXMgYWx3YXlzIGFuIEVPRiB0b2tlbiBhdCB0aGUgZW5kXG4gICAgICB0aGlzLl9pbmRleCsrO1xuICAgIH1cbiAgICB0aGlzLl9wZWVrID0gdGhpcy50b2tlbnNbdGhpcy5faW5kZXhdO1xuICAgIHJldHVybiBwcmV2IGFzIFQ7XG4gIH1cblxuICBwcml2YXRlIF9hZHZhbmNlSWY8VCBleHRlbmRzIFRva2VuVHlwZT4odHlwZTogVCk6IChUb2tlbiZ7dHlwZTogVH0pfG51bGwge1xuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IHR5cGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hZHZhbmNlPFRva2VuJnt0eXBlOiBUfT4oKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ2RhdGEoX3N0YXJ0VG9rZW46IENkYXRhU3RhcnRUb2tlbikge1xuICAgIHRoaXMuX2NvbnN1bWVUZXh0KHRoaXMuX2FkdmFuY2U8VGV4dFRva2VuPigpKTtcbiAgICB0aGlzLl9hZHZhbmNlSWYoVG9rZW5UeXBlLkNEQVRBX0VORCk7XG4gIH1cblxuICBwcml2YXRlIF9jb25zdW1lQ29tbWVudCh0b2tlbjogQ29tbWVudFN0YXJ0VG9rZW4pIHtcbiAgICBjb25zdCB0ZXh0ID0gdGhpcy5fYWR2YW5jZUlmKFRva2VuVHlwZS5SQVdfVEVYVCk7XG4gICAgdGhpcy5fYWR2YW5jZUlmKFRva2VuVHlwZS5DT01NRU5UX0VORCk7XG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0ICE9IG51bGwgPyB0ZXh0LnBhcnRzWzBdLnRyaW0oKSA6IG51bGw7XG4gICAgdGhpcy5fYWRkVG9QYXJlbnQobmV3IGh0bWwuQ29tbWVudCh2YWx1ZSwgdG9rZW4uc291cmNlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUV4cGFuc2lvbih0b2tlbjogRXhwYW5zaW9uRm9ybVN0YXJ0VG9rZW4pIHtcbiAgICBjb25zdCBzd2l0Y2hWYWx1ZSA9IHRoaXMuX2FkdmFuY2U8VGV4dFRva2VuPigpO1xuXG4gICAgY29uc3QgdHlwZSA9IHRoaXMuX2FkdmFuY2U8VGV4dFRva2VuPigpO1xuICAgIGNvbnN0IGNhc2VzOiBodG1sLkV4cGFuc2lvbkNhc2VbXSA9IFtdO1xuXG4gICAgLy8gcmVhZCA9XG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX1ZBTFVFKSB7XG4gICAgICBjb25zdCBleHBDYXNlID0gdGhpcy5fcGFyc2VFeHBhbnNpb25DYXNlKCk7XG4gICAgICBpZiAoIWV4cENhc2UpIHJldHVybjsgIC8vIGVycm9yXG4gICAgICBjYXNlcy5wdXNoKGV4cENhc2UpO1xuICAgIH1cblxuICAgIC8vIHJlYWQgdGhlIGZpbmFsIH1cbiAgICBpZiAodGhpcy5fcGVlay50eXBlICE9PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fRU5EKSB7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLCBgSW52YWxpZCBJQ1UgbWVzc2FnZS4gTWlzc2luZyAnfScuYCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgdG9rZW4uc291cmNlU3Bhbi5zdGFydCwgdGhpcy5fcGVlay5zb3VyY2VTcGFuLmVuZCwgdG9rZW4uc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIHRoaXMuX2FkZFRvUGFyZW50KG5ldyBodG1sLkV4cGFuc2lvbihcbiAgICAgICAgc3dpdGNoVmFsdWUucGFydHNbMF0sIHR5cGUucGFydHNbMF0sIGNhc2VzLCBzb3VyY2VTcGFuLCBzd2l0Y2hWYWx1ZS5zb3VyY2VTcGFuKSk7XG5cbiAgICB0aGlzLl9hZHZhbmNlKCk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUV4cGFuc2lvbkNhc2UoKTogaHRtbC5FeHBhbnNpb25DYXNlfG51bGwge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5fYWR2YW5jZTxFeHBhbnNpb25DYXNlVmFsdWVUb2tlbj4oKTtcblxuICAgIC8vIHJlYWQge1xuICAgIGlmICh0aGlzLl9wZWVrLnR5cGUgIT09IFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpIHtcbiAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgVHJlZUVycm9yLmNyZWF0ZShudWxsLCB0aGlzLl9wZWVrLnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd7Jy5gKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZWFkIHVudGlsIH1cbiAgICBjb25zdCBzdGFydCA9IHRoaXMuX2FkdmFuY2U8RXhwYW5zaW9uQ2FzZUV4cHJlc3Npb25TdGFydFRva2VuPigpO1xuXG4gICAgY29uc3QgZXhwID0gdGhpcy5fY29sbGVjdEV4cGFuc2lvbkV4cFRva2VucyhzdGFydCk7XG4gICAgaWYgKCFleHApIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZW5kID0gdGhpcy5fYWR2YW5jZTxFeHBhbnNpb25DYXNlRXhwcmVzc2lvbkVuZFRva2VuPigpO1xuICAgIGV4cC5wdXNoKHt0eXBlOiBUb2tlblR5cGUuRU9GLCBwYXJ0czogW10sIHNvdXJjZVNwYW46IGVuZC5zb3VyY2VTcGFufSk7XG5cbiAgICAvLyBwYXJzZSBldmVyeXRoaW5nIGluIGJldHdlZW4geyBhbmQgfVxuICAgIGNvbnN0IGV4cGFuc2lvbkNhc2VQYXJzZXIgPSBuZXcgX1RyZWVCdWlsZGVyKGV4cCwgdGhpcy5nZXRUYWdEZWZpbml0aW9uKTtcbiAgICBleHBhbnNpb25DYXNlUGFyc2VyLmJ1aWxkKCk7XG4gICAgaWYgKGV4cGFuc2lvbkNhc2VQYXJzZXIuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuZXJyb3JzID0gdGhpcy5lcnJvcnMuY29uY2F0KGV4cGFuc2lvbkNhc2VQYXJzZXIuZXJyb3JzKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNvdXJjZVNwYW4gPVxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKHZhbHVlLnNvdXJjZVNwYW4uc3RhcnQsIGVuZC5zb3VyY2VTcGFuLmVuZCwgdmFsdWUuc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIGNvbnN0IGV4cFNvdXJjZVNwYW4gPVxuICAgICAgICBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LnNvdXJjZVNwYW4uc3RhcnQsIGVuZC5zb3VyY2VTcGFuLmVuZCwgc3RhcnQuc291cmNlU3Bhbi5mdWxsU3RhcnQpO1xuICAgIHJldHVybiBuZXcgaHRtbC5FeHBhbnNpb25DYXNlKFxuICAgICAgICB2YWx1ZS5wYXJ0c1swXSwgZXhwYW5zaW9uQ2FzZVBhcnNlci5yb290Tm9kZXMsIHNvdXJjZVNwYW4sIHZhbHVlLnNvdXJjZVNwYW4sIGV4cFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29sbGVjdEV4cGFuc2lvbkV4cFRva2VucyhzdGFydDogVG9rZW4pOiBUb2tlbltdfG51bGwge1xuICAgIGNvbnN0IGV4cDogVG9rZW5bXSA9IFtdO1xuICAgIGNvbnN0IGV4cGFuc2lvbkZvcm1TdGFjayA9IFtUb2tlblR5cGUuRVhQQU5TSU9OX0NBU0VfRVhQX1NUQVJUXTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQgfHxcbiAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FWFBBTlNJT05fQ0FTRV9FWFBfU1RBUlQpIHtcbiAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnB1c2godGhpcy5fcGVlay50eXBlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9FTkQpIHtcbiAgICAgICAgaWYgKGxhc3RPblN0YWNrKGV4cGFuc2lvbkZvcm1TdGFjaywgVG9rZW5UeXBlLkVYUEFOU0lPTl9DQVNFX0VYUF9TVEFSVCkpIHtcbiAgICAgICAgICBleHBhbnNpb25Gb3JtU3RhY2sucG9wKCk7XG4gICAgICAgICAgaWYgKGV4cGFuc2lvbkZvcm1TdGFjay5sZW5ndGggPT09IDApIHJldHVybiBleHA7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkVYUEFOU0lPTl9GT1JNX0VORCkge1xuICAgICAgICBpZiAobGFzdE9uU3RhY2soZXhwYW5zaW9uRm9ybVN0YWNrLCBUb2tlblR5cGUuRVhQQU5TSU9OX0ZPUk1fU1RBUlQpKSB7XG4gICAgICAgICAgZXhwYW5zaW9uRm9ybVN0YWNrLnBvcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUobnVsbCwgc3RhcnQuc291cmNlU3BhbiwgYEludmFsaWQgSUNVIG1lc3NhZ2UuIE1pc3NpbmcgJ30nLmApKTtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuRU9GKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goXG4gICAgICAgICAgICBUcmVlRXJyb3IuY3JlYXRlKG51bGwsIHN0YXJ0LnNvdXJjZVNwYW4sIGBJbnZhbGlkIElDVSBtZXNzYWdlLiBNaXNzaW5nICd9Jy5gKSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBleHAucHVzaCh0aGlzLl9hZHZhbmNlKCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVUZXh0KHRva2VuOiBJbnRlcnBvbGF0ZWRUZXh0VG9rZW4pIHtcbiAgICBjb25zdCB0b2tlbnMgPSBbdG9rZW5dO1xuICAgIGNvbnN0IHN0YXJ0U3BhbiA9IHRva2VuLnNvdXJjZVNwYW47XG4gICAgbGV0IHRleHQgPSB0b2tlbi5wYXJ0c1swXTtcbiAgICBpZiAodGV4dC5sZW5ndGggPiAwICYmIHRleHRbMF0gPT09ICdcXG4nKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCk7XG4gICAgICBpZiAocGFyZW50ICE9IG51bGwgJiYgcGFyZW50LmNoaWxkcmVuLmxlbmd0aCA9PT0gMCAmJlxuICAgICAgICAgIHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihwYXJlbnQubmFtZSkuaWdub3JlRmlyc3RMZikge1xuICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMSk7XG4gICAgICAgIHRva2Vuc1swXSA9IHt0eXBlOiB0b2tlbi50eXBlLCBzb3VyY2VTcGFuOiB0b2tlbi5zb3VyY2VTcGFuLCBwYXJ0czogW3RleHRdfSBhcyB0eXBlb2YgdG9rZW47XG4gICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLklOVEVSUE9MQVRJT04gfHwgdGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuVEVYVCB8fFxuICAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FTkNPREVEX0VOVElUWSkge1xuICAgICAgdG9rZW4gPSB0aGlzLl9hZHZhbmNlKCk7XG4gICAgICB0b2tlbnMucHVzaCh0b2tlbik7XG4gICAgICBpZiAodG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLklOVEVSUE9MQVRJT04pIHtcbiAgICAgICAgLy8gRm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkgd2UgZGVjb2RlIEhUTUwgZW50aXRpZXMgdGhhdCBhcHBlYXIgaW4gaW50ZXJwb2xhdGlvblxuICAgICAgICAvLyBleHByZXNzaW9ucy4gVGhpcyBpcyBhcmd1YWJseSBhIGJ1ZywgYnV0IGl0IGNvdWxkIGJlIGEgY29uc2lkZXJhYmxlIGJyZWFraW5nIGNoYW5nZSB0b1xuICAgICAgICAvLyBmaXggaXQuIEl0IHNob3VsZCBiZSBhZGRyZXNzZWQgaW4gYSBsYXJnZXIgcHJvamVjdCB0byByZWZhY3RvciB0aGUgZW50aXJlIHBhcnNlci9sZXhlclxuICAgICAgICAvLyBjaGFpbiBhZnRlciBWaWV3IEVuZ2luZSBoYXMgYmVlbiByZW1vdmVkLlxuICAgICAgICB0ZXh0ICs9IHRva2VuLnBhcnRzLmpvaW4oJycpLnJlcGxhY2UoLyYoW147XSspOy9nLCBkZWNvZGVFbnRpdHkpO1xuICAgICAgfSBlbHNlIGlmICh0b2tlbi50eXBlID09PSBUb2tlblR5cGUuRU5DT0RFRF9FTlRJVFkpIHtcbiAgICAgICAgdGV4dCArPSB0b2tlbi5wYXJ0c1swXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRleHQgKz0gdG9rZW4ucGFydHMuam9pbignJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRleHQubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZW5kU3BhbiA9IHRva2VuLnNvdXJjZVNwYW47XG4gICAgICB0aGlzLl9hZGRUb1BhcmVudChuZXcgaHRtbC5UZXh0KFxuICAgICAgICAgIHRleHQsXG4gICAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihzdGFydFNwYW4uc3RhcnQsIGVuZFNwYW4uZW5kLCBzdGFydFNwYW4uZnVsbFN0YXJ0LCBzdGFydFNwYW4uZGV0YWlscyksXG4gICAgICAgICAgdG9rZW5zKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY2xvc2VWb2lkRWxlbWVudCgpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKTtcbiAgICBpZiAoZWwgJiYgdGhpcy5nZXRUYWdEZWZpbml0aW9uKGVsLm5hbWUpLmlzVm9pZCkge1xuICAgICAgdGhpcy5fZWxlbWVudFN0YWNrLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVTdGFydFRhZyhzdGFydFRhZ1Rva2VuOiBUYWdPcGVuU3RhcnRUb2tlbnxJbmNvbXBsZXRlVGFnT3BlblRva2VuKSB7XG4gICAgY29uc3QgW3ByZWZpeCwgbmFtZV0gPSBzdGFydFRhZ1Rva2VuLnBhcnRzO1xuICAgIGNvbnN0IGF0dHJzOiBodG1sLkF0dHJpYnV0ZVtdID0gW107XG4gICAgd2hpbGUgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfTkFNRSkge1xuICAgICAgYXR0cnMucHVzaCh0aGlzLl9jb25zdW1lQXR0cih0aGlzLl9hZHZhbmNlPEF0dHJpYnV0ZU5hbWVUb2tlbj4oKSkpO1xuICAgIH1cbiAgICBjb25zdCBmdWxsTmFtZSA9IHRoaXMuX2dldEVsZW1lbnRGdWxsTmFtZShwcmVmaXgsIG5hbWUsIHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKSk7XG4gICAgbGV0IHNlbGZDbG9zaW5nID0gZmFsc2U7XG4gICAgLy8gTm90ZTogVGhlcmUgY291bGQgaGF2ZSBiZWVuIGEgdG9rZW5pemVyIGVycm9yXG4gICAgLy8gc28gdGhhdCB3ZSBkb24ndCBnZXQgYSB0b2tlbiBmb3IgdGhlIGVuZCB0YWcuLi5cbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuVEFHX09QRU5fRU5EX1ZPSUQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHNlbGZDbG9zaW5nID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHRhZ0RlZiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSk7XG4gICAgICBpZiAoISh0YWdEZWYuY2FuU2VsZkNsb3NlIHx8IGdldE5zUHJlZml4KGZ1bGxOYW1lKSAhPT0gbnVsbCB8fCB0YWdEZWYuaXNWb2lkKSkge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoXG4gICAgICAgICAgICBmdWxsTmFtZSwgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgYE9ubHkgdm9pZCBhbmQgZm9yZWlnbiBlbGVtZW50cyBjYW4gYmUgc2VsZiBjbG9zZWQgXCIke3N0YXJ0VGFnVG9rZW4ucGFydHNbMV19XCJgKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5UQUdfT1BFTl9FTkQpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICAgIHNlbGZDbG9zaW5nID0gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IGVuZCA9IHRoaXMuX3BlZWsuc291cmNlU3Bhbi5mdWxsU3RhcnQ7XG4gICAgY29uc3Qgc3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgIHN0YXJ0VGFnVG9rZW4uc291cmNlU3Bhbi5zdGFydCwgZW5kLCBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uZnVsbFN0YXJ0KTtcbiAgICAvLyBDcmVhdGUgYSBzZXBhcmF0ZSBgc3RhcnRTcGFuYCBiZWNhdXNlIGBzcGFuYCB3aWxsIGJlIG1vZGlmaWVkIHdoZW4gdGhlcmUgaXMgYW4gYGVuZGAgc3Bhbi5cbiAgICBjb25zdCBzdGFydFNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICBzdGFydFRhZ1Rva2VuLnNvdXJjZVNwYW4uc3RhcnQsIGVuZCwgc3RhcnRUYWdUb2tlbi5zb3VyY2VTcGFuLmZ1bGxTdGFydCk7XG4gICAgY29uc3QgZWwgPSBuZXcgaHRtbC5FbGVtZW50KGZ1bGxOYW1lLCBhdHRycywgW10sIHNwYW4sIHN0YXJ0U3BhbiwgdW5kZWZpbmVkKTtcbiAgICB0aGlzLl9wdXNoRWxlbWVudChlbCk7XG4gICAgaWYgKHNlbGZDbG9zaW5nKSB7XG4gICAgICAvLyBFbGVtZW50cyB0aGF0IGFyZSBzZWxmLWNsb3NlZCBoYXZlIHRoZWlyIGBlbmRTb3VyY2VTcGFuYCBzZXQgdG8gdGhlIGZ1bGwgc3BhbiwgYXMgdGhlXG4gICAgICAvLyBlbGVtZW50IHN0YXJ0IHRhZyBhbHNvIHJlcHJlc2VudHMgdGhlIGVuZCB0YWcuXG4gICAgICB0aGlzLl9wb3BFbGVtZW50KGZ1bGxOYW1lLCBzcGFuKTtcbiAgICB9IGVsc2UgaWYgKHN0YXJ0VGFnVG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLklOQ09NUExFVEVfVEFHX09QRU4pIHtcbiAgICAgIC8vIFdlIGFscmVhZHkga25vdyB0aGUgb3BlbmluZyB0YWcgaXMgbm90IGNvbXBsZXRlLCBzbyBpdCBpcyB1bmxpa2VseSBpdCBoYXMgYSBjb3JyZXNwb25kaW5nXG4gICAgICAvLyBjbG9zZSB0YWcuIExldCdzIG9wdGltaXN0aWNhbGx5IHBhcnNlIGl0IGFzIGEgZnVsbCBlbGVtZW50IGFuZCBlbWl0IGFuIGVycm9yLlxuICAgICAgdGhpcy5fcG9wRWxlbWVudChmdWxsTmFtZSwgbnVsbCk7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFxuICAgICAgICAgIFRyZWVFcnJvci5jcmVhdGUoZnVsbE5hbWUsIHNwYW4sIGBPcGVuaW5nIHRhZyBcIiR7ZnVsbE5hbWV9XCIgbm90IHRlcm1pbmF0ZWQuYCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3B1c2hFbGVtZW50KGVsOiBodG1sLkVsZW1lbnQpIHtcbiAgICBjb25zdCBwYXJlbnRFbCA9IHRoaXMuX2dldFBhcmVudEVsZW1lbnQoKTtcblxuICAgIGlmIChwYXJlbnRFbCAmJiB0aGlzLmdldFRhZ0RlZmluaXRpb24ocGFyZW50RWwubmFtZSkuaXNDbG9zZWRCeUNoaWxkKGVsLm5hbWUpKSB7XG4gICAgICB0aGlzLl9lbGVtZW50U3RhY2sucG9wKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fYWRkVG9QYXJlbnQoZWwpO1xuICAgIHRoaXMuX2VsZW1lbnRTdGFjay5wdXNoKGVsKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnN1bWVFbmRUYWcoZW5kVGFnVG9rZW46IFRhZ0Nsb3NlVG9rZW4pIHtcbiAgICBjb25zdCBmdWxsTmFtZSA9IHRoaXMuX2dldEVsZW1lbnRGdWxsTmFtZShcbiAgICAgICAgZW5kVGFnVG9rZW4ucGFydHNbMF0sIGVuZFRhZ1Rva2VuLnBhcnRzWzFdLCB0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCkpO1xuXG4gICAgaWYgKHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihmdWxsTmFtZSkuaXNWb2lkKSB7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoXG4gICAgICAgICAgZnVsbE5hbWUsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4sXG4gICAgICAgICAgYFZvaWQgZWxlbWVudHMgZG8gbm90IGhhdmUgZW5kIHRhZ3MgXCIke2VuZFRhZ1Rva2VuLnBhcnRzWzFdfVwiYCkpO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX3BvcEVsZW1lbnQoZnVsbE5hbWUsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4pKSB7XG4gICAgICBjb25zdCBlcnJNc2cgPSBgVW5leHBlY3RlZCBjbG9zaW5nIHRhZyBcIiR7XG4gICAgICAgICAgZnVsbE5hbWV9XCIuIEl0IG1heSBoYXBwZW4gd2hlbiB0aGUgdGFnIGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkIGJ5IGFub3RoZXIgdGFnLiBGb3IgbW9yZSBpbmZvIHNlZSBodHRwczovL3d3dy53My5vcmcvVFIvaHRtbDUvc3ludGF4Lmh0bWwjY2xvc2luZy1lbGVtZW50cy10aGF0LWhhdmUtaW1wbGllZC1lbmQtdGFnc2A7XG4gICAgICB0aGlzLmVycm9ycy5wdXNoKFRyZWVFcnJvci5jcmVhdGUoZnVsbE5hbWUsIGVuZFRhZ1Rva2VuLnNvdXJjZVNwYW4sIGVyck1zZykpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZXMgdGhlIG5lYXJlc3QgZWxlbWVudCB3aXRoIHRoZSB0YWcgbmFtZSBgZnVsbE5hbWVgIGluIHRoZSBwYXJzZSB0cmVlLlxuICAgKiBgZW5kU291cmNlU3BhbmAgaXMgdGhlIHNwYW4gb2YgdGhlIGNsb3NpbmcgdGFnLCBvciBudWxsIGlmIHRoZSBlbGVtZW50IGRvZXNcbiAgICogbm90IGhhdmUgYSBjbG9zaW5nIHRhZyAoZm9yIGV4YW1wbGUsIHRoaXMgaGFwcGVucyB3aGVuIGFuIGluY29tcGxldGVcbiAgICogb3BlbmluZyB0YWcgaXMgcmVjb3ZlcmVkKS5cbiAgICovXG4gIHByaXZhdGUgX3BvcEVsZW1lbnQoZnVsbE5hbWU6IHN0cmluZywgZW5kU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpOiBib29sZWFuIHtcbiAgICBsZXQgdW5leHBlY3RlZENsb3NlVGFnRGV0ZWN0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBzdGFja0luZGV4ID0gdGhpcy5fZWxlbWVudFN0YWNrLmxlbmd0aCAtIDE7IHN0YWNrSW5kZXggPj0gMDsgc3RhY2tJbmRleC0tKSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuX2VsZW1lbnRTdGFja1tzdGFja0luZGV4XTtcbiAgICAgIGlmIChlbC5uYW1lID09PSBmdWxsTmFtZSkge1xuICAgICAgICAvLyBSZWNvcmQgdGhlIHBhcnNlIHNwYW4gd2l0aCB0aGUgZWxlbWVudCB0aGF0IGlzIGJlaW5nIGNsb3NlZC4gQW55IGVsZW1lbnRzIHRoYXQgYXJlXG4gICAgICAgIC8vIHJlbW92ZWQgZnJvbSB0aGUgZWxlbWVudCBzdGFjayBhdCB0aGlzIHBvaW50IGFyZSBjbG9zZWQgaW1wbGljaXRseSwgc28gdGhleSB3b24ndCBnZXRcbiAgICAgICAgLy8gYW4gZW5kIHNvdXJjZSBzcGFuIChhcyB0aGVyZSBpcyBubyBleHBsaWNpdCBjbG9zaW5nIGVsZW1lbnQpLlxuICAgICAgICBlbC5lbmRTb3VyY2VTcGFuID0gZW5kU291cmNlU3BhbjtcbiAgICAgICAgZWwuc291cmNlU3Bhbi5lbmQgPSBlbmRTb3VyY2VTcGFuICE9PSBudWxsID8gZW5kU291cmNlU3Bhbi5lbmQgOiBlbC5zb3VyY2VTcGFuLmVuZDtcblxuICAgICAgICB0aGlzLl9lbGVtZW50U3RhY2suc3BsaWNlKHN0YWNrSW5kZXgsIHRoaXMuX2VsZW1lbnRTdGFjay5sZW5ndGggLSBzdGFja0luZGV4KTtcbiAgICAgICAgcmV0dXJuICF1bmV4cGVjdGVkQ2xvc2VUYWdEZXRlY3RlZDtcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmdldFRhZ0RlZmluaXRpb24oZWwubmFtZSkuY2xvc2VkQnlQYXJlbnQpIHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IHdlIGVuY291bnRlcmVkIGFuIHVuZXhwZWN0ZWQgY2xvc2UgdGFnIGJ1dCBjb250aW51ZSBwcm9jZXNzaW5nIHRoZSBlbGVtZW50XG4gICAgICAgIC8vIHN0YWNrIHNvIHdlIGNhbiBhc3NpZ24gYW4gYGVuZFNvdXJjZVNwYW5gIGlmIHRoZXJlIGlzIGEgY29ycmVzcG9uZGluZyBzdGFydCB0YWcgZm9yIHRoaXNcbiAgICAgICAgLy8gZW5kIHRhZyBpbiB0aGUgc3RhY2suXG4gICAgICAgIHVuZXhwZWN0ZWRDbG9zZVRhZ0RldGVjdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29uc3VtZUF0dHIoYXR0ck5hbWU6IEF0dHJpYnV0ZU5hbWVUb2tlbik6IGh0bWwuQXR0cmlidXRlIHtcbiAgICBjb25zdCBmdWxsTmFtZSA9IG1lcmdlTnNBbmROYW1lKGF0dHJOYW1lLnBhcnRzWzBdLCBhdHRyTmFtZS5wYXJ0c1sxXSk7XG4gICAgbGV0IGF0dHJFbmQgPSBhdHRyTmFtZS5zb3VyY2VTcGFuLmVuZDtcblxuICAgIC8vIENvbnN1bWUgYW55IHF1b3RlXG4gICAgaWYgKHRoaXMuX3BlZWsudHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfUVVPVEUpIHtcbiAgICAgIHRoaXMuX2FkdmFuY2UoKTtcbiAgICB9XG5cbiAgICAvLyBDb25zdW1lIHRoZSBhdHRyaWJ1dGUgdmFsdWVcbiAgICBsZXQgdmFsdWUgPSAnJztcbiAgICBjb25zdCB2YWx1ZVRva2VuczogSW50ZXJwb2xhdGVkQXR0cmlidXRlVG9rZW5bXSA9IFtdO1xuICAgIGxldCB2YWx1ZVN0YXJ0U3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBsZXQgdmFsdWVFbmQ6IFBhcnNlTG9jYXRpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIC8vIE5PVEU6IFdlIG5lZWQgdG8gdXNlIGEgbmV3IHZhcmlhYmxlIGBuZXh0VG9rZW5UeXBlYCBoZXJlIHRvIGhpZGUgdGhlIGFjdHVhbCB0eXBlIG9mXG4gICAgLy8gYF9wZWVrLnR5cGVgIGZyb20gVFMuIE90aGVyd2lzZSBUUyB3aWxsIG5hcnJvdyB0aGUgdHlwZSBvZiBgX3BlZWsudHlwZWAgcHJldmVudGluZyBpdCBmcm9tXG4gICAgLy8gYmVpbmcgYWJsZSB0byBjb25zaWRlciBgQVRUUl9WQUxVRV9JTlRFUlBPTEFUSU9OYCBhcyBhbiBvcHRpb24uIFRoaXMgaXMgYmVjYXVzZSBUUyBpcyBub3RcbiAgICAvLyBhYmxlIHRvIHNlZSB0aGF0IGBfYWR2YW5jZSgpYCB3aWxsIGFjdHVhbGx5IG11dGF0ZSBgX3BlZWtgLlxuICAgIGNvbnN0IG5leHRUb2tlblR5cGUgPSB0aGlzLl9wZWVrLnR5cGUgYXMgVG9rZW5UeXBlO1xuICAgIGlmIChuZXh0VG9rZW5UeXBlID09PSBUb2tlblR5cGUuQVRUUl9WQUxVRV9URVhUKSB7XG4gICAgICB2YWx1ZVN0YXJ0U3BhbiA9IHRoaXMuX3BlZWsuc291cmNlU3BhbjtcbiAgICAgIHZhbHVlRW5kID0gdGhpcy5fcGVlay5zb3VyY2VTcGFuLmVuZDtcbiAgICAgIHdoaWxlICh0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5BVFRSX1ZBTFVFX1RFWFQgfHxcbiAgICAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5BVFRSX1ZBTFVFX0lOVEVSUE9MQVRJT04gfHxcbiAgICAgICAgICAgICB0aGlzLl9wZWVrLnR5cGUgPT09IFRva2VuVHlwZS5FTkNPREVEX0VOVElUWSkge1xuICAgICAgICBjb25zdCB2YWx1ZVRva2VuID0gdGhpcy5fYWR2YW5jZTxJbnRlcnBvbGF0ZWRBdHRyaWJ1dGVUb2tlbj4oKTtcbiAgICAgICAgdmFsdWVUb2tlbnMucHVzaCh2YWx1ZVRva2VuKTtcbiAgICAgICAgaWYgKHZhbHVlVG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkFUVFJfVkFMVUVfSU5URVJQT0xBVElPTikge1xuICAgICAgICAgIC8vIEZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdlIGRlY29kZSBIVE1MIGVudGl0aWVzIHRoYXQgYXBwZWFyIGluIGludGVycG9sYXRpb25cbiAgICAgICAgICAvLyBleHByZXNzaW9ucy4gVGhpcyBpcyBhcmd1YWJseSBhIGJ1ZywgYnV0IGl0IGNvdWxkIGJlIGEgY29uc2lkZXJhYmxlIGJyZWFraW5nIGNoYW5nZSB0b1xuICAgICAgICAgIC8vIGZpeCBpdC4gSXQgc2hvdWxkIGJlIGFkZHJlc3NlZCBpbiBhIGxhcmdlciBwcm9qZWN0IHRvIHJlZmFjdG9yIHRoZSBlbnRpcmUgcGFyc2VyL2xleGVyXG4gICAgICAgICAgLy8gY2hhaW4gYWZ0ZXIgVmlldyBFbmdpbmUgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgICAgICB2YWx1ZSArPSB2YWx1ZVRva2VuLnBhcnRzLmpvaW4oJycpLnJlcGxhY2UoLyYoW147XSspOy9nLCBkZWNvZGVFbnRpdHkpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlVG9rZW4udHlwZSA9PT0gVG9rZW5UeXBlLkVOQ09ERURfRU5USVRZKSB7XG4gICAgICAgICAgdmFsdWUgKz0gdmFsdWVUb2tlbi5wYXJ0c1swXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSArPSB2YWx1ZVRva2VuLnBhcnRzLmpvaW4oJycpO1xuICAgICAgICB9XG4gICAgICAgIHZhbHVlRW5kID0gYXR0ckVuZCA9IHZhbHVlVG9rZW4uc291cmNlU3Bhbi5lbmQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29uc3VtZSBhbnkgcXVvdGVcbiAgICBpZiAodGhpcy5fcGVlay50eXBlID09PSBUb2tlblR5cGUuQVRUUl9RVU9URSkge1xuICAgICAgY29uc3QgcXVvdGVUb2tlbiA9IHRoaXMuX2FkdmFuY2U8QXR0cmlidXRlUXVvdGVUb2tlbj4oKTtcbiAgICAgIGF0dHJFbmQgPSBxdW90ZVRva2VuLnNvdXJjZVNwYW4uZW5kO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlU3BhbiA9IHZhbHVlU3RhcnRTcGFuICYmIHZhbHVlRW5kICYmXG4gICAgICAgIG5ldyBQYXJzZVNvdXJjZVNwYW4odmFsdWVTdGFydFNwYW4uc3RhcnQsIHZhbHVlRW5kLCB2YWx1ZVN0YXJ0U3Bhbi5mdWxsU3RhcnQpO1xuICAgIHJldHVybiBuZXcgaHRtbC5BdHRyaWJ1dGUoXG4gICAgICAgIGZ1bGxOYW1lLCB2YWx1ZSxcbiAgICAgICAgbmV3IFBhcnNlU291cmNlU3BhbihhdHRyTmFtZS5zb3VyY2VTcGFuLnN0YXJ0LCBhdHRyRW5kLCBhdHRyTmFtZS5zb3VyY2VTcGFuLmZ1bGxTdGFydCksXG4gICAgICAgIGF0dHJOYW1lLnNvdXJjZVNwYW4sIHZhbHVlU3BhbiwgdmFsdWVUb2tlbnMubGVuZ3RoID4gMCA/IHZhbHVlVG9rZW5zIDogdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0UGFyZW50RWxlbWVudCgpOiBodG1sLkVsZW1lbnR8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2VsZW1lbnRTdGFjay5sZW5ndGggPiAwID8gdGhpcy5fZWxlbWVudFN0YWNrW3RoaXMuX2VsZW1lbnRTdGFjay5sZW5ndGggLSAxXSA6IG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9hZGRUb1BhcmVudChub2RlOiBodG1sLk5vZGUpIHtcbiAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9nZXRQYXJlbnRFbGVtZW50KCk7XG4gICAgaWYgKHBhcmVudCAhPSBudWxsKSB7XG4gICAgICBwYXJlbnQuY2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yb290Tm9kZXMucHVzaChub2RlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9nZXRFbGVtZW50RnVsbE5hbWUocHJlZml4OiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBwYXJlbnRFbGVtZW50OiBodG1sLkVsZW1lbnR8bnVsbCk6XG4gICAgICBzdHJpbmcge1xuICAgIGlmIChwcmVmaXggPT09ICcnKSB7XG4gICAgICBwcmVmaXggPSB0aGlzLmdldFRhZ0RlZmluaXRpb24obG9jYWxOYW1lKS5pbXBsaWNpdE5hbWVzcGFjZVByZWZpeCB8fCAnJztcbiAgICAgIGlmIChwcmVmaXggPT09ICcnICYmIHBhcmVudEVsZW1lbnQgIT0gbnVsbCkge1xuICAgICAgICBjb25zdCBwYXJlbnRUYWdOYW1lID0gc3BsaXROc05hbWUocGFyZW50RWxlbWVudC5uYW1lKVsxXTtcbiAgICAgICAgY29uc3QgcGFyZW50VGFnRGVmaW5pdGlvbiA9IHRoaXMuZ2V0VGFnRGVmaW5pdGlvbihwYXJlbnRUYWdOYW1lKTtcbiAgICAgICAgaWYgKCFwYXJlbnRUYWdEZWZpbml0aW9uLnByZXZlbnROYW1lc3BhY2VJbmhlcml0YW5jZSkge1xuICAgICAgICAgIHByZWZpeCA9IGdldE5zUHJlZml4KHBhcmVudEVsZW1lbnQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWVyZ2VOc0FuZE5hbWUocHJlZml4LCBsb2NhbE5hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGxhc3RPblN0YWNrKHN0YWNrOiBhbnlbXSwgZWxlbWVudDogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiBzdGFjay5sZW5ndGggPiAwICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBlbGVtZW50O1xufVxuXG4vKipcbiAqIERlY29kZSB0aGUgYGVudGl0eWAgc3RyaW5nLCB3aGljaCB3ZSBiZWxpZXZlIGlzIHRoZSBjb250ZW50cyBvZiBhbiBIVE1MIGVudGl0eS5cbiAqXG4gKiBJZiB0aGUgc3RyaW5nIGlzIG5vdCBhY3R1YWxseSBhIHZhbGlkL2tub3duIGVudGl0eSB0aGVuIGp1c3QgcmV0dXJuIHRoZSBvcmlnaW5hbCBgbWF0Y2hgIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZGVjb2RlRW50aXR5KG1hdGNoOiBzdHJpbmcsIGVudGl0eTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKE5BTUVEX0VOVElUSUVTW2VudGl0eV0gIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBOQU1FRF9FTlRJVElFU1tlbnRpdHldIHx8IG1hdGNoO1xuICB9XG4gIGlmICgvXiN4W2EtZjAtOV0rJC9pLnRlc3QoZW50aXR5KSkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNvZGVQb2ludChwYXJzZUludChlbnRpdHkuc2xpY2UoMiksIDE2KSk7XG4gIH1cbiAgaWYgKC9eI1xcZCskLy50ZXN0KGVudGl0eSkpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21Db2RlUG9pbnQocGFyc2VJbnQoZW50aXR5LnNsaWNlKDEpLCAxMCkpO1xuICB9XG4gIHJldHVybiBtYXRjaDtcbn1cbiJdfQ==