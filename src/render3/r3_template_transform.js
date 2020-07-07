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
        define("@angular/compiler/src/render3/r3_template_transform", ["require", "exports", "tslib", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_whitespaces", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/parse_util", "@angular/compiler/src/style_url_resolver", "@angular/compiler/src/template_parser/template_preparser", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.htmlAstToRender3Ast = void 0;
    var tslib_1 = require("tslib");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var html_whitespaces_1 = require("@angular/compiler/src/ml_parser/html_whitespaces");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var style_url_resolver_1 = require("@angular/compiler/src/style_url_resolver");
    var template_preparser_1 = require("@angular/compiler/src/template_parser/template_preparser");
    var util_1 = require("@angular/compiler/src/util");
    var t = require("@angular/compiler/src/render3/r3_ast");
    var util_2 = require("@angular/compiler/src/render3/view/i18n/util");
    var BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.*))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
    // Group 1 = "bind-"
    var KW_BIND_IDX = 1;
    // Group 2 = "let-"
    var KW_LET_IDX = 2;
    // Group 3 = "ref-/#"
    var KW_REF_IDX = 3;
    // Group 4 = "on-"
    var KW_ON_IDX = 4;
    // Group 5 = "bindon-"
    var KW_BINDON_IDX = 5;
    // Group 6 = "@"
    var KW_AT_IDX = 6;
    // Group 7 = the identifier after "bind-", "let-", "ref-/#", "on-", "bindon-" or "@"
    var IDENT_KW_IDX = 7;
    // Group 8 = identifier inside [()]
    var IDENT_BANANA_BOX_IDX = 8;
    // Group 9 = identifier inside []
    var IDENT_PROPERTY_IDX = 9;
    // Group 10 = identifier inside ()
    var IDENT_EVENT_IDX = 10;
    var TEMPLATE_ATTR_PREFIX = '*';
    function htmlAstToRender3Ast(htmlNodes, bindingParser) {
        var transformer = new HtmlAstToIvyAst(bindingParser);
        var ivyNodes = html.visitAll(transformer, htmlNodes);
        // Errors might originate in either the binding parser or the html to ivy transformer
        var allErrors = bindingParser.errors.concat(transformer.errors);
        var errors = allErrors.filter(function (e) { return e.level === parse_util_1.ParseErrorLevel.ERROR; });
        if (errors.length > 0) {
            var errorString = errors.join('\n');
            throw util_1.syntaxError("Template parse errors:\n" + errorString, errors);
        }
        return {
            nodes: ivyNodes,
            errors: allErrors,
            styleUrls: transformer.styleUrls,
            styles: transformer.styles,
            ngContentSelectors: transformer.ngContentSelectors,
        };
    }
    exports.htmlAstToRender3Ast = htmlAstToRender3Ast;
    var HtmlAstToIvyAst = /** @class */ (function () {
        function HtmlAstToIvyAst(bindingParser) {
            this.bindingParser = bindingParser;
            this.errors = [];
            this.styles = [];
            this.styleUrls = [];
            this.ngContentSelectors = [];
            this.inI18nBlock = false;
        }
        // HTML visitor
        HtmlAstToIvyAst.prototype.visitElement = function (element) {
            var e_1, _a;
            var _this = this;
            var isI18nRootElement = util_2.isI18nRootNode(element.i18n);
            if (isI18nRootElement) {
                if (this.inI18nBlock) {
                    this.reportError('Cannot mark an element as translatable inside of a translatable section. Please remove the nested i18n marker.', element.sourceSpan);
                }
                this.inI18nBlock = true;
            }
            var preparsedElement = template_preparser_1.preparseElement(element);
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.SCRIPT) {
                return null;
            }
            else if (preparsedElement.type === template_preparser_1.PreparsedElementType.STYLE) {
                var contents = textContents(element);
                if (contents !== null) {
                    this.styles.push(contents);
                }
                return null;
            }
            else if (preparsedElement.type === template_preparser_1.PreparsedElementType.STYLESHEET &&
                style_url_resolver_1.isStyleUrlResolvable(preparsedElement.hrefAttr)) {
                this.styleUrls.push(preparsedElement.hrefAttr);
                return null;
            }
            // Whether the element is a `<ng-template>`
            var isTemplateElement = tags_1.isNgTemplate(element.name);
            var parsedProperties = [];
            var boundEvents = [];
            var variables = [];
            var references = [];
            var attributes = [];
            var i18nAttrsMeta = {};
            var templateParsedProperties = [];
            var templateVariables = [];
            // Whether the element has any *-attribute
            var elementHasInlineTemplate = false;
            try {
                for (var _b = tslib_1.__values(element.attrs), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var attribute = _c.value;
                    var hasBinding = false;
                    var normalizedName = normalizeAttributeName(attribute.name);
                    // `*attr` defines template bindings
                    var isTemplateBinding = false;
                    if (attribute.i18n) {
                        i18nAttrsMeta[attribute.name] = attribute.i18n;
                    }
                    if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                        // *-attributes
                        if (elementHasInlineTemplate) {
                            this.reportError("Can't have multiple template bindings on one element. Use only one attribute prefixed with *", attribute.sourceSpan);
                        }
                        isTemplateBinding = true;
                        elementHasInlineTemplate = true;
                        var templateValue = attribute.value;
                        var templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
                        var parsedVariables = [];
                        var absoluteValueOffset = attribute.valueSpan ?
                            attribute.valueSpan.start.offset :
                            // If there is no value span the attribute does not have a value, like `attr` in
                            //`<div attr></div>`. In this case, point to one character beyond the last character of
                            // the attribute name.
                            attribute.sourceSpan.start.offset + attribute.name.length;
                        this.bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attribute.sourceSpan, absoluteValueOffset, [], templateParsedProperties, parsedVariables);
                        templateVariables.push.apply(templateVariables, tslib_1.__spread(parsedVariables.map(function (v) { return new t.Variable(v.name, v.value, v.sourceSpan, v.valueSpan); })));
                    }
                    else {
                        // Check for variables, events, property bindings, interpolation
                        hasBinding = this.parseAttribute(isTemplateElement, attribute, [], parsedProperties, boundEvents, variables, references);
                    }
                    if (!hasBinding && !isTemplateBinding) {
                        // don't include the bindings as attributes as well in the AST
                        attributes.push(this.visitAttribute(attribute));
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            var children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children);
            var parsedElement;
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.NG_CONTENT) {
                // `<ng-content>`
                if (element.children &&
                    !element.children.every(function (node) { return isEmptyTextNode(node) || isCommentNode(node); })) {
                    this.reportError("<ng-content> element cannot have content.", element.sourceSpan);
                }
                var selector = preparsedElement.selectAttr;
                var attrs = element.attrs.map(function (attr) { return _this.visitAttribute(attr); });
                parsedElement = new t.Content(selector, attrs, element.sourceSpan, element.i18n);
                this.ngContentSelectors.push(selector);
            }
            else if (isTemplateElement) {
                // `<ng-template>`
                var attrs = this.extractAttributes(element.name, parsedProperties, i18nAttrsMeta);
                parsedElement = new t.Template(element.name, attributes, attrs.bound, boundEvents, [ /* no template attributes */], children, references, variables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
            }
            else {
                var attrs = this.extractAttributes(element.name, parsedProperties, i18nAttrsMeta);
                parsedElement = new t.Element(element.name, attributes, attrs.bound, boundEvents, children, references, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
            }
            if (elementHasInlineTemplate) {
                // If this node is an inline-template (e.g. has *ngFor) then we need to create a template
                // node that contains this node.
                // Moreover, if the node is an element, then we need to hoist its attributes to the template
                // node for matching against content projection selectors.
                var attrs = this.extractAttributes('ng-template', templateParsedProperties, i18nAttrsMeta);
                var templateAttrs_1 = [];
                attrs.literal.forEach(function (attr) { return templateAttrs_1.push(attr); });
                attrs.bound.forEach(function (attr) { return templateAttrs_1.push(attr); });
                var hoistedAttrs = parsedElement instanceof t.Element ?
                    {
                        attributes: parsedElement.attributes,
                        inputs: parsedElement.inputs,
                        outputs: parsedElement.outputs,
                    } :
                    { attributes: [], inputs: [], outputs: [] };
                // For <ng-template>s with structural directives on them, avoid passing i18n information to
                // the wrapping template to prevent unnecessary i18n instructions from being generated. The
                // necessary i18n meta information will be extracted from child elements.
                var i18n_1 = isTemplateElement && isI18nRootElement ? undefined : element.i18n;
                // TODO(pk): test for this case
                parsedElement = new t.Template(parsedElement.name, hoistedAttrs.attributes, hoistedAttrs.inputs, hoistedAttrs.outputs, templateAttrs_1, [parsedElement], [ /* no references */], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, i18n_1);
            }
            if (isI18nRootElement) {
                this.inI18nBlock = false;
            }
            return parsedElement;
        };
        HtmlAstToIvyAst.prototype.visitAttribute = function (attribute) {
            return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan, attribute.i18n);
        };
        HtmlAstToIvyAst.prototype.visitText = function (text) {
            return this._visitTextWithInterpolation(text.value, text.sourceSpan, text.i18n);
        };
        HtmlAstToIvyAst.prototype.visitExpansion = function (expansion) {
            var _this = this;
            if (!expansion.i18n) {
                // do not generate Icu in case it was created
                // outside of i18n block in a template
                return null;
            }
            if (!util_2.isI18nRootNode(expansion.i18n)) {
                throw new Error("Invalid type \"" + expansion.i18n.constructor + "\" for \"i18n\" property of " + expansion.sourceSpan.toString() + ". Expected a \"Message\"");
            }
            var message = expansion.i18n;
            var vars = {};
            var placeholders = {};
            // extract VARs from ICUs - we process them separately while
            // assembling resulting message via goog.getMsg function, since
            // we need to pass them to top-level goog.getMsg call
            Object.keys(message.placeholders).forEach(function (key) {
                var value = message.placeholders[key];
                if (key.startsWith(util_2.I18N_ICU_VAR_PREFIX)) {
                    var config = _this.bindingParser.interpolationConfig;
                    // ICU expression is a plain string, not wrapped into start
                    // and end tags, so we wrap it before passing to binding parser
                    var wrapped = "" + config.start + value + config.end;
                    // Currently when the `plural` or `select` keywords in an ICU contain trailing spaces (e.g.
                    // `{count, select , ...}`), these spaces are also included into the key names in ICU vars
                    // (e.g. "VAR_SELECT "). These trailing spaces are not desirable, since they will later be
                    // converted into `_` symbols while normalizing placeholder names, which might lead to
                    // mismatches at runtime (i.e. placeholder will not be replaced with the correct value).
                    var formattedKey = key.trim();
                    vars[formattedKey] =
                        _this._visitTextWithInterpolation(wrapped, expansion.sourceSpan);
                }
                else {
                    placeholders[key] = _this._visitTextWithInterpolation(value, expansion.sourceSpan);
                }
            });
            return new t.Icu(vars, placeholders, expansion.sourceSpan, message);
        };
        HtmlAstToIvyAst.prototype.visitExpansionCase = function (expansionCase) {
            return null;
        };
        HtmlAstToIvyAst.prototype.visitComment = function (comment) {
            return null;
        };
        // convert view engine `ParsedProperty` to a format suitable for IVY
        HtmlAstToIvyAst.prototype.extractAttributes = function (elementName, properties, i18nPropsMeta) {
            var _this = this;
            var bound = [];
            var literal = [];
            properties.forEach(function (prop) {
                var i18n = i18nPropsMeta[prop.name];
                if (prop.isLiteral) {
                    literal.push(new t.TextAttribute(prop.name, prop.expression.source || '', prop.sourceSpan, undefined, i18n));
                }
                else {
                    // Note that validation is skipped and property mapping is disabled
                    // due to the fact that we need to make sure a given prop is not an
                    // input of a directive and directive matching happens at runtime.
                    var bep = _this.bindingParser.createBoundElementProperty(elementName, prop, /* skipValidation */ true, /* mapPropertyName */ false);
                    bound.push(t.BoundAttribute.fromBoundElementProperty(bep, i18n));
                }
            });
            return { bound: bound, literal: literal };
        };
        HtmlAstToIvyAst.prototype.parseAttribute = function (isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references) {
            var name = normalizeAttributeName(attribute.name);
            var value = attribute.value;
            var srcSpan = attribute.sourceSpan;
            var absoluteOffset = attribute.valueSpan ? attribute.valueSpan.start.offset : srcSpan.start.offset;
            var bindParts = name.match(BIND_NAME_REGEXP);
            var hasBinding = false;
            if (bindParts) {
                hasBinding = true;
                if (bindParts[KW_BIND_IDX] != null) {
                    this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                }
                else if (bindParts[KW_LET_IDX]) {
                    if (isTemplateElement) {
                        var identifier = bindParts[IDENT_KW_IDX];
                        this.parseVariable(identifier, value, srcSpan, attribute.valueSpan, variables);
                    }
                    else {
                        this.reportError("\"let-\" is only supported on ng-template elements.", srcSpan);
                    }
                }
                else if (bindParts[KW_REF_IDX]) {
                    var identifier = bindParts[IDENT_KW_IDX];
                    this.parseReference(identifier, value, srcSpan, attribute.valueSpan, references);
                }
                else if (bindParts[KW_ON_IDX]) {
                    var events = [];
                    this.bindingParser.parseEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events);
                    addEvents(events, boundEvents);
                }
                else if (bindParts[KW_BINDON_IDX]) {
                    this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                    this.parseAssignmentEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents);
                }
                else if (bindParts[KW_AT_IDX]) {
                    this.bindingParser.parseLiteralAttr(name, value, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                }
                else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                    this.bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                    this.parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents);
                }
                else if (bindParts[IDENT_PROPERTY_IDX]) {
                    this.bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                }
                else if (bindParts[IDENT_EVENT_IDX]) {
                    var events = [];
                    this.bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events);
                    addEvents(events, boundEvents);
                }
            }
            else {
                hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, attribute.valueSpan, matchableAttributes, parsedProperties);
            }
            return hasBinding;
        };
        HtmlAstToIvyAst.prototype._visitTextWithInterpolation = function (value, sourceSpan, i18n) {
            var valueNoNgsp = html_whitespaces_1.replaceNgsp(value);
            var expr = this.bindingParser.parseInterpolation(valueNoNgsp, sourceSpan);
            return expr ? new t.BoundText(expr, sourceSpan, i18n) : new t.Text(valueNoNgsp, sourceSpan);
        };
        HtmlAstToIvyAst.prototype.parseVariable = function (identifier, value, sourceSpan, valueSpan, variables) {
            if (identifier.indexOf('-') > -1) {
                this.reportError("\"-\" is not allowed in variable names", sourceSpan);
            }
            else if (identifier.length === 0) {
                this.reportError("Variable does not have a name", sourceSpan);
            }
            variables.push(new t.Variable(identifier, value, sourceSpan, valueSpan));
        };
        HtmlAstToIvyAst.prototype.parseReference = function (identifier, value, sourceSpan, valueSpan, references) {
            if (identifier.indexOf('-') > -1) {
                this.reportError("\"-\" is not allowed in reference names", sourceSpan);
            }
            else if (identifier.length === 0) {
                this.reportError("Reference does not have a name", sourceSpan);
            }
            references.push(new t.Reference(identifier, value, sourceSpan, valueSpan));
        };
        HtmlAstToIvyAst.prototype.parseAssignmentEvent = function (name, expression, sourceSpan, valueSpan, targetMatchableAttrs, boundEvents) {
            var events = [];
            this.bindingParser.parseEvent(name + "Change", expression + "=$event", sourceSpan, valueSpan || sourceSpan, targetMatchableAttrs, events);
            addEvents(events, boundEvents);
        };
        HtmlAstToIvyAst.prototype.reportError = function (message, sourceSpan, level) {
            if (level === void 0) { level = parse_util_1.ParseErrorLevel.ERROR; }
            this.errors.push(new parse_util_1.ParseError(sourceSpan, message, level));
        };
        return HtmlAstToIvyAst;
    }());
    var NonBindableVisitor = /** @class */ (function () {
        function NonBindableVisitor() {
        }
        NonBindableVisitor.prototype.visitElement = function (ast) {
            var preparsedElement = template_preparser_1.preparseElement(ast);
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.SCRIPT ||
                preparsedElement.type === template_preparser_1.PreparsedElementType.STYLE ||
                preparsedElement.type === template_preparser_1.PreparsedElementType.STYLESHEET) {
                // Skipping <script> for security reasons
                // Skipping <style> and stylesheets as we already processed them
                // in the StyleCompiler
                return null;
            }
            var children = html.visitAll(this, ast.children, null);
            return new t.Element(ast.name, html.visitAll(this, ast.attrs), 
            /* inputs */ [], /* outputs */ [], children, /* references */ [], ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
        };
        NonBindableVisitor.prototype.visitComment = function (comment) {
            return null;
        };
        NonBindableVisitor.prototype.visitAttribute = function (attribute) {
            return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, undefined, attribute.i18n);
        };
        NonBindableVisitor.prototype.visitText = function (text) {
            return new t.Text(text.value, text.sourceSpan);
        };
        NonBindableVisitor.prototype.visitExpansion = function (expansion) {
            return null;
        };
        NonBindableVisitor.prototype.visitExpansionCase = function (expansionCase) {
            return null;
        };
        return NonBindableVisitor;
    }());
    var NON_BINDABLE_VISITOR = new NonBindableVisitor();
    function normalizeAttributeName(attrName) {
        return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
    }
    function addEvents(events, boundEvents) {
        boundEvents.push.apply(boundEvents, tslib_1.__spread(events.map(function (e) { return t.BoundEvent.fromParsedEvent(e); })));
    }
    function isEmptyTextNode(node) {
        return node instanceof html.Text && node.value.trim().length == 0;
    }
    function isCommentNode(node) {
        return node instanceof html.Comment;
    }
    function textContents(node) {
        if (node.children.length !== 1 || !(node.children[0] instanceof html.Text)) {
            return null;
        }
        else {
            return node.children[0].value;
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVtcGxhdGVfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFJSCwwREFBeUM7SUFDekMscUZBQTBEO0lBQzFELDZEQUErQztJQUMvQywrREFBMkU7SUFDM0UsK0VBQTJEO0lBRTNELCtGQUE0RjtJQUM1RixtREFBb0M7SUFFcEMsd0RBQThCO0lBQzlCLHFFQUFxRTtJQUVyRSxJQUFNLGdCQUFnQixHQUNsQiwwR0FBMEcsQ0FBQztJQUUvRyxvQkFBb0I7SUFDcEIsSUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0lBQ3RCLG1CQUFtQjtJQUNuQixJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDckIscUJBQXFCO0lBQ3JCLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNyQixrQkFBa0I7SUFDbEIsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBQ3BCLHNCQUFzQjtJQUN0QixJQUFNLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDeEIsZ0JBQWdCO0lBQ2hCLElBQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztJQUNwQixvRkFBb0Y7SUFDcEYsSUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLG1DQUFtQztJQUNuQyxJQUFNLG9CQUFvQixHQUFHLENBQUMsQ0FBQztJQUMvQixpQ0FBaUM7SUFDakMsSUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7SUFDN0Isa0NBQWtDO0lBQ2xDLElBQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQztJQUUzQixJQUFNLG9CQUFvQixHQUFHLEdBQUcsQ0FBQztJQVdqQyxTQUFnQixtQkFBbUIsQ0FDL0IsU0FBc0IsRUFBRSxhQUE0QjtRQUN0RCxJQUFNLFdBQVcsR0FBRyxJQUFJ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QkFBa0IsRUFBRSxDQUFDO0lBRXRELFNBQVMsc0JBQXNCLENBQUMsUUFBZ0I7UUFDOUMsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7SUFDckUsQ0FBQztJQUVELFNBQVMsU0FBUyxDQUFDLE1BQXFCLEVBQUUsV0FBMkI7UUFDbkUsV0FBVyxDQUFDLElBQUksT0FBaEIsV0FBVyxtQkFBUyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQS9CLENBQStCLENBQUMsR0FBRTtJQUN4RSxDQUFDO0lBRUQsU0FBUyxlQUFlLENBQUMsSUFBZTtRQUN0QyxPQUFPLElBQUksWUFBWSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRUQsU0FBUyxhQUFhLENBQUMsSUFBZTtRQUNwQyxPQUFPLElBQUksWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3RDLENBQUM7SUFFRCxTQUFTLFlBQVksQ0FBQyxJQUFrQjtRQUN0QyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsWUFBWSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDMUUsT0FBTyxJQUFJLENBQUM7U0FDYjthQUFNO1lBQ0wsT0FBUSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBZSxDQUFDLEtBQUssQ0FBQztTQUM5QztJQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQYXJzZWRFdmVudCwgUGFyc2VkUHJvcGVydHksIFBhcnNlZFZhcmlhYmxlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge3JlcGxhY2VOZ3NwfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge2lzTmdUZW1wbGF0ZX0gZnJvbSAnLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUVycm9yTGV2ZWwsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2lzU3R5bGVVcmxSZXNvbHZhYmxlfSBmcm9tICcuLi9zdHlsZV91cmxfcmVzb2x2ZXInO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtQcmVwYXJzZWRFbGVtZW50VHlwZSwgcHJlcGFyc2VFbGVtZW50fSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfcHJlcGFyc2VyJztcbmltcG9ydCB7c3ludGF4RXJyb3J9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vcjNfYXN0JztcbmltcG9ydCB7STE4Tl9JQ1VfVkFSX1BSRUZJWCwgaXNJMThuUm9vdE5vZGV9IGZyb20gJy4vdmlldy9pMThuL3V0aWwnO1xuXG5jb25zdCBCSU5EX05BTUVfUkVHRVhQID1cbiAgICAvXig/Oig/Oig/OihiaW5kLSl8KGxldC0pfChyZWYtfCMpfChvbi0pfChiaW5kb24tKXwoQCkpKC4qKSl8XFxbXFwoKFteXFwpXSspXFwpXFxdfFxcWyhbXlxcXV0rKVxcXXxcXCgoW15cXCldKylcXCkpJC87XG5cbi8vIEdyb3VwIDEgPSBcImJpbmQtXCJcbmNvbnN0IEtXX0JJTkRfSURYID0gMTtcbi8vIEdyb3VwIDIgPSBcImxldC1cIlxuY29uc3QgS1dfTEVUX0lEWCA9IDI7XG4vLyBHcm91cCAzID0gXCJyZWYtLyNcIlxuY29uc3QgS1dfUkVGX0lEWCA9IDM7XG4vLyBHcm91cCA0ID0gXCJvbi1cIlxuY29uc3QgS1dfT05fSURYID0gNDtcbi8vIEdyb3VwIDUgPSBcImJpbmRvbi1cIlxuY29uc3QgS1dfQklORE9OX0lEWCA9IDU7XG4vLyBHcm91cCA2ID0gXCJAXCJcbmNvbnN0IEtXX0FUX0lEWCA9IDY7XG4vLyBHcm91cCA3ID0gdGhlIGlkZW50aWZpZXIgYWZ0ZXIgXCJiaW5kLVwiLCBcImxldC1cIiwgXCJyZWYtLyNcIiwgXCJvbi1cIiwgXCJiaW5kb24tXCIgb3IgXCJAXCJcbmNvbnN0IElERU5UX0tXX0lEWCA9IDc7XG4vLyBHcm91cCA4ID0gaWRlbnRpZmllciBpbnNpZGUgWygpXVxuY29uc3QgSURFTlRfQkFOQU5BX0JPWF9JRFggPSA4O1xuLy8gR3JvdXAgOSA9IGlkZW50aWZpZXIgaW5zaWRlIFtdXG5jb25zdCBJREVOVF9QUk9QRVJUWV9JRFggPSA5O1xuLy8gR3JvdXAgMTAgPSBpZGVudGlmaWVyIGluc2lkZSAoKVxuY29uc3QgSURFTlRfRVZFTlRfSURYID0gMTA7XG5cbmNvbnN0IFRFTVBMQVRFX0FUVFJfUFJFRklYID0gJyonO1xuXG4vLyBSZXN1bHQgb2YgdGhlIGh0bWwgQVNUIHRvIEl2eSBBU1QgdHJhbnNmb3JtYXRpb25cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyM1BhcnNlUmVzdWx0IHtcbiAgbm9kZXM6IHQuTm9kZVtdO1xuICBlcnJvcnM6IFBhcnNlRXJyb3JbXTtcbiAgc3R5bGVzOiBzdHJpbmdbXTtcbiAgc3R5bGVVcmxzOiBzdHJpbmdbXTtcbiAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGh0bWxBc3RUb1JlbmRlcjNBc3QoXG4gICAgaHRtbE5vZGVzOiBodG1sLk5vZGVbXSwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFJlbmRlcjNQYXJzZVJlc3VsdCB7XG4gIGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IEh0bWxBc3RUb0l2eUFzdChiaW5kaW5nUGFyc2VyKTtcbiAgY29uc3QgaXZ5Tm9kZXMgPSBodG1sLnZpc2l0QWxsKHRyYW5zZm9ybWVyLCBodG1sTm9kZXMpO1xuXG4gIC8vIEVycm9ycyBtaWdodCBvcmlnaW5hdGUgaW4gZWl0aGVyIHRoZSBiaW5kaW5nIHBhcnNlciBvciB0aGUgaHRtbCB0byBpdnkgdHJhbnNmb3JtZXJcbiAgY29uc3QgYWxsRXJyb3JzID0gYmluZGluZ1BhcnNlci5lcnJvcnMuY29uY2F0KHRyYW5zZm9ybWVyLmVycm9ycyk7XG4gIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gYWxsRXJyb3JzLmZpbHRlcihlID0+IGUubGV2ZWwgPT09IFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG5cbiAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZXJyb3JTdHJpbmcgPSBlcnJvcnMuam9pbignXFxuJyk7XG4gICAgdGhyb3cgc3ludGF4RXJyb3IoYFRlbXBsYXRlIHBhcnNlIGVycm9yczpcXG4ke2Vycm9yU3RyaW5nfWAsIGVycm9ycyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5vZGVzOiBpdnlOb2RlcyxcbiAgICBlcnJvcnM6IGFsbEVycm9ycyxcbiAgICBzdHlsZVVybHM6IHRyYW5zZm9ybWVyLnN0eWxlVXJscyxcbiAgICBzdHlsZXM6IHRyYW5zZm9ybWVyLnN0eWxlcyxcbiAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHRyYW5zZm9ybWVyLm5nQ29udGVudFNlbGVjdG9ycyxcbiAgfTtcbn1cblxuY2xhc3MgSHRtbEFzdFRvSXZ5QXN0IGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgZXJyb3JzOiBQYXJzZUVycm9yW10gPSBbXTtcbiAgc3R5bGVzOiBzdHJpbmdbXSA9IFtdO1xuICBzdHlsZVVybHM6IHN0cmluZ1tdID0gW107XG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBpbkkxOG5CbG9jazogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge31cblxuICAvLyBIVE1MIHZpc2l0b3JcbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCk6IHQuTm9kZXxudWxsIHtcbiAgICBjb25zdCBpc0kxOG5Sb290RWxlbWVudCA9IGlzSTE4blJvb3ROb2RlKGVsZW1lbnQuaTE4bik7XG4gICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICBpZiAodGhpcy5pbkkxOG5CbG9jaykge1xuICAgICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgICAgJ0Nhbm5vdCBtYXJrIGFuIGVsZW1lbnQgYXMgdHJhbnNsYXRhYmxlIGluc2lkZSBvZiBhIHRyYW5zbGF0YWJsZSBzZWN0aW9uLiBQbGVhc2UgcmVtb3ZlIHRoZSBuZXN0ZWQgaTE4biBtYXJrZXIuJyxcbiAgICAgICAgICAgIGVsZW1lbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICB0aGlzLmluSTE4bkJsb2NrID0gdHJ1ZTtcbiAgICB9XG4gICAgY29uc3QgcHJlcGFyc2VkRWxlbWVudCA9IHByZXBhcnNlRWxlbWVudChlbGVtZW50KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSkge1xuICAgICAgY29uc3QgY29udGVudHMgPSB0ZXh0Q29udGVudHMoZWxlbWVudCk7XG4gICAgICBpZiAoY29udGVudHMgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5zdHlsZXMucHVzaChjb250ZW50cyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQgJiZcbiAgICAgICAgaXNTdHlsZVVybFJlc29sdmFibGUocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cikpIHtcbiAgICAgIHRoaXMuc3R5bGVVcmxzLnB1c2gocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBXaGV0aGVyIHRoZSBlbGVtZW50IGlzIGEgYDxuZy10ZW1wbGF0ZT5gXG4gICAgY29uc3QgaXNUZW1wbGF0ZUVsZW1lbnQgPSBpc05nVGVtcGxhdGUoZWxlbWVudC5uYW1lKTtcblxuICAgIGNvbnN0IHBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCBib3VuZEV2ZW50czogdC5Cb3VuZEV2ZW50W10gPSBbXTtcbiAgICBjb25zdCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSA9IFtdO1xuICAgIGNvbnN0IHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGkxOG5BdHRyc01ldGE6IHtba2V5OiBzdHJpbmddOiBpMThuLkkxOG5NZXRhfSA9IHt9O1xuXG4gICAgY29uc3QgdGVtcGxhdGVQYXJzZWRQcm9wZXJ0aWVzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG4gICAgY29uc3QgdGVtcGxhdGVWYXJpYWJsZXM6IHQuVmFyaWFibGVbXSA9IFtdO1xuXG4gICAgLy8gV2hldGhlciB0aGUgZWxlbWVudCBoYXMgYW55ICotYXR0cmlidXRlXG4gICAgbGV0IGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCBhdHRyaWJ1dGUgb2YgZWxlbWVudC5hdHRycykge1xuICAgICAgbGV0IGhhc0JpbmRpbmcgPSBmYWxzZTtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyaWJ1dGUubmFtZSk7XG5cbiAgICAgIC8vIGAqYXR0cmAgZGVmaW5lcyB0ZW1wbGF0ZSBiaW5kaW5nc1xuICAgICAgbGV0IGlzVGVtcGxhdGVCaW5kaW5nID0gZmFsc2U7XG5cbiAgICAgIGlmIChhdHRyaWJ1dGUuaTE4bikge1xuICAgICAgICBpMThuQXR0cnNNZXRhW2F0dHJpYnV0ZS5uYW1lXSA9IGF0dHJpYnV0ZS5pMThuO1xuICAgICAgfVxuXG4gICAgICBpZiAobm9ybWFsaXplZE5hbWUuc3RhcnRzV2l0aChURU1QTEFURV9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgLy8gKi1hdHRyaWJ1dGVzXG4gICAgICAgIGlmIChlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUpIHtcbiAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgQ2FuJ3QgaGF2ZSBtdWx0aXBsZSB0ZW1wbGF0ZSBiaW5kaW5ncyBvbiBvbmUgZWxlbWVudC4gVXNlIG9ubHkgb25lIGF0dHJpYnV0ZSBwcmVmaXhlZCB3aXRoICpgLFxuICAgICAgICAgICAgICBhdHRyaWJ1dGUuc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgICAgaXNUZW1wbGF0ZUJpbmRpbmcgPSB0cnVlO1xuICAgICAgICBlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUgPSB0cnVlO1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZVZhbHVlID0gYXR0cmlidXRlLnZhbHVlO1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZUtleSA9IG5vcm1hbGl6ZWROYW1lLnN1YnN0cmluZyhURU1QTEFURV9BVFRSX1BSRUZJWC5sZW5ndGgpO1xuXG4gICAgICAgIGNvbnN0IHBhcnNlZFZhcmlhYmxlczogUGFyc2VkVmFyaWFibGVbXSA9IFtdO1xuICAgICAgICBjb25zdCBhYnNvbHV0ZVZhbHVlT2Zmc2V0ID0gYXR0cmlidXRlLnZhbHVlU3BhbiA/XG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWVTcGFuLnN0YXJ0Lm9mZnNldCA6XG4gICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyB2YWx1ZSBzcGFuIHRoZSBhdHRyaWJ1dGUgZG9lcyBub3QgaGF2ZSBhIHZhbHVlLCBsaWtlIGBhdHRyYCBpblxuICAgICAgICAgICAgLy9gPGRpdiBhdHRyPjwvZGl2PmAuIEluIHRoaXMgY2FzZSwgcG9pbnQgdG8gb25lIGNoYXJhY3RlciBiZXlvbmQgdGhlIGxhc3QgY2hhcmFjdGVyIG9mXG4gICAgICAgICAgICAvLyB0aGUgYXR0cmlidXRlIG5hbWUuXG4gICAgICAgICAgICBhdHRyaWJ1dGUuc291cmNlU3Bhbi5zdGFydC5vZmZzZXQgKyBhdHRyaWJ1dGUubmFtZS5sZW5ndGg7XG5cbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlSW5saW5lVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgICAgdGVtcGxhdGVLZXksIHRlbXBsYXRlVmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBhYnNvbHV0ZVZhbHVlT2Zmc2V0LCBbXSxcbiAgICAgICAgICAgIHRlbXBsYXRlUGFyc2VkUHJvcGVydGllcywgcGFyc2VkVmFyaWFibGVzKTtcbiAgICAgICAgdGVtcGxhdGVWYXJpYWJsZXMucHVzaCguLi5wYXJzZWRWYXJpYWJsZXMubWFwKFxuICAgICAgICAgICAgdiA9PiBuZXcgdC5WYXJpYWJsZSh2Lm5hbWUsIHYudmFsdWUsIHYuc291cmNlU3Bhbiwgdi52YWx1ZVNwYW4pKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDaGVjayBmb3IgdmFyaWFibGVzLCBldmVudHMsIHByb3BlcnR5IGJpbmRpbmdzLCBpbnRlcnBvbGF0aW9uXG4gICAgICAgIGhhc0JpbmRpbmcgPSB0aGlzLnBhcnNlQXR0cmlidXRlKFxuICAgICAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQsIGF0dHJpYnV0ZSwgW10sIHBhcnNlZFByb3BlcnRpZXMsIGJvdW5kRXZlbnRzLCB2YXJpYWJsZXMsIHJlZmVyZW5jZXMpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWhhc0JpbmRpbmcgJiYgIWlzVGVtcGxhdGVCaW5kaW5nKSB7XG4gICAgICAgIC8vIGRvbid0IGluY2x1ZGUgdGhlIGJpbmRpbmdzIGFzIGF0dHJpYnV0ZXMgYXMgd2VsbCBpbiB0aGUgQVNUXG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaCh0aGlzLnZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZSkgYXMgdC5UZXh0QXR0cmlidXRlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbjogdC5Ob2RlW10gPVxuICAgICAgICBodG1sLnZpc2l0QWxsKHByZXBhcnNlZEVsZW1lbnQubm9uQmluZGFibGUgPyBOT05fQklOREFCTEVfVklTSVRPUiA6IHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgbGV0IHBhcnNlZEVsZW1lbnQ6IHQuTm9kZXx1bmRlZmluZWQ7XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuTkdfQ09OVEVOVCkge1xuICAgICAgLy8gYDxuZy1jb250ZW50PmBcbiAgICAgIGlmIChlbGVtZW50LmNoaWxkcmVuICYmXG4gICAgICAgICAgIWVsZW1lbnQuY2hpbGRyZW4uZXZlcnkoXG4gICAgICAgICAgICAgIChub2RlOiBodG1sLk5vZGUpID0+IGlzRW1wdHlUZXh0Tm9kZShub2RlKSB8fCBpc0NvbW1lbnROb2RlKG5vZGUpKSkge1xuICAgICAgICB0aGlzLnJlcG9ydEVycm9yKGA8bmctY29udGVudD4gZWxlbWVudCBjYW5ub3QgaGF2ZSBjb250ZW50LmAsIGVsZW1lbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICBjb25zdCBzZWxlY3RvciA9IHByZXBhcnNlZEVsZW1lbnQuc2VsZWN0QXR0cjtcbiAgICAgIGNvbnN0IGF0dHJzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IGVsZW1lbnQuYXR0cnMubWFwKGF0dHIgPT4gdGhpcy52aXNpdEF0dHJpYnV0ZShhdHRyKSk7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuQ29udGVudChzZWxlY3RvciwgYXR0cnMsIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5pMThuKTtcblxuICAgICAgdGhpcy5uZ0NvbnRlbnRTZWxlY3RvcnMucHVzaChzZWxlY3Rvcik7XG4gICAgfSBlbHNlIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgLy8gYDxuZy10ZW1wbGF0ZT5gXG4gICAgICBjb25zdCBhdHRycyA9IHRoaXMuZXh0cmFjdEF0dHJpYnV0ZXMoZWxlbWVudC5uYW1lLCBwYXJzZWRQcm9wZXJ0aWVzLCBpMThuQXR0cnNNZXRhKTtcblxuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LlRlbXBsYXRlKFxuICAgICAgICAgIGVsZW1lbnQubmFtZSwgYXR0cmlidXRlcywgYXR0cnMuYm91bmQsIGJvdW5kRXZlbnRzLCBbLyogbm8gdGVtcGxhdGUgYXR0cmlidXRlcyAqL10sXG4gICAgICAgICAgY2hpbGRyZW4sIHJlZmVyZW5jZXMsIHZhcmlhYmxlcywgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgICBlbGVtZW50LmVuZFNvdXJjZVNwYW4sIGVsZW1lbnQuaTE4bik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGF0dHJzID0gdGhpcy5leHRyYWN0QXR0cmlidXRlcyhlbGVtZW50Lm5hbWUsIHBhcnNlZFByb3BlcnRpZXMsIGkxOG5BdHRyc01ldGEpO1xuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LkVsZW1lbnQoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBhdHRyaWJ1dGVzLCBhdHRycy5ib3VuZCwgYm91bmRFdmVudHMsIGNoaWxkcmVuLCByZWZlcmVuY2VzLFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3BhbiwgZWxlbWVudC5pMThuKTtcbiAgICB9XG5cbiAgICBpZiAoZWxlbWVudEhhc0lubGluZVRlbXBsYXRlKSB7XG4gICAgICAvLyBJZiB0aGlzIG5vZGUgaXMgYW4gaW5saW5lLXRlbXBsYXRlIChlLmcuIGhhcyAqbmdGb3IpIHRoZW4gd2UgbmVlZCB0byBjcmVhdGUgYSB0ZW1wbGF0ZVxuICAgICAgLy8gbm9kZSB0aGF0IGNvbnRhaW5zIHRoaXMgbm9kZS5cbiAgICAgIC8vIE1vcmVvdmVyLCBpZiB0aGUgbm9kZSBpcyBhbiBlbGVtZW50LCB0aGVuIHdlIG5lZWQgdG8gaG9pc3QgaXRzIGF0dHJpYnV0ZXMgdG8gdGhlIHRlbXBsYXRlXG4gICAgICAvLyBub2RlIGZvciBtYXRjaGluZyBhZ2FpbnN0IGNvbnRlbnQgcHJvamVjdGlvbiBzZWxlY3RvcnMuXG4gICAgICBjb25zdCBhdHRycyA9IHRoaXMuZXh0cmFjdEF0dHJpYnV0ZXMoJ25nLXRlbXBsYXRlJywgdGVtcGxhdGVQYXJzZWRQcm9wZXJ0aWVzLCBpMThuQXR0cnNNZXRhKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlQXR0cnM6ICh0LlRleHRBdHRyaWJ1dGV8dC5Cb3VuZEF0dHJpYnV0ZSlbXSA9IFtdO1xuICAgICAgYXR0cnMubGl0ZXJhbC5mb3JFYWNoKGF0dHIgPT4gdGVtcGxhdGVBdHRycy5wdXNoKGF0dHIpKTtcbiAgICAgIGF0dHJzLmJvdW5kLmZvckVhY2goYXR0ciA9PiB0ZW1wbGF0ZUF0dHJzLnB1c2goYXR0cikpO1xuICAgICAgY29uc3QgaG9pc3RlZEF0dHJzID0gcGFyc2VkRWxlbWVudCBpbnN0YW5jZW9mIHQuRWxlbWVudCA/XG4gICAgICAgICAge1xuICAgICAgICAgICAgYXR0cmlidXRlczogcGFyc2VkRWxlbWVudC5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgaW5wdXRzOiBwYXJzZWRFbGVtZW50LmlucHV0cyxcbiAgICAgICAgICAgIG91dHB1dHM6IHBhcnNlZEVsZW1lbnQub3V0cHV0cyxcbiAgICAgICAgICB9IDpcbiAgICAgICAgICB7YXR0cmlidXRlczogW10sIGlucHV0czogW10sIG91dHB1dHM6IFtdfTtcblxuICAgICAgLy8gRm9yIDxuZy10ZW1wbGF0ZT5zIHdpdGggc3RydWN0dXJhbCBkaXJlY3RpdmVzIG9uIHRoZW0sIGF2b2lkIHBhc3NpbmcgaTE4biBpbmZvcm1hdGlvbiB0b1xuICAgICAgLy8gdGhlIHdyYXBwaW5nIHRlbXBsYXRlIHRvIHByZXZlbnQgdW5uZWNlc3NhcnkgaTE4biBpbnN0cnVjdGlvbnMgZnJvbSBiZWluZyBnZW5lcmF0ZWQuIFRoZVxuICAgICAgLy8gbmVjZXNzYXJ5IGkxOG4gbWV0YSBpbmZvcm1hdGlvbiB3aWxsIGJlIGV4dHJhY3RlZCBmcm9tIGNoaWxkIGVsZW1lbnRzLlxuICAgICAgY29uc3QgaTE4biA9IGlzVGVtcGxhdGVFbGVtZW50ICYmIGlzSTE4blJvb3RFbGVtZW50ID8gdW5kZWZpbmVkIDogZWxlbWVudC5pMThuO1xuXG4gICAgICAvLyBUT0RPKHBrKTogdGVzdCBmb3IgdGhpcyBjYXNlXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuVGVtcGxhdGUoXG4gICAgICAgICAgKHBhcnNlZEVsZW1lbnQgYXMgdC5FbGVtZW50KS5uYW1lLCBob2lzdGVkQXR0cnMuYXR0cmlidXRlcywgaG9pc3RlZEF0dHJzLmlucHV0cyxcbiAgICAgICAgICBob2lzdGVkQXR0cnMub3V0cHV0cywgdGVtcGxhdGVBdHRycywgW3BhcnNlZEVsZW1lbnRdLCBbLyogbm8gcmVmZXJlbmNlcyAqL10sXG4gICAgICAgICAgdGVtcGxhdGVWYXJpYWJsZXMsIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3BhbixcbiAgICAgICAgICBpMThuKTtcbiAgICB9XG4gICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICB0aGlzLmluSTE4bkJsb2NrID0gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBwYXJzZWRFbGVtZW50O1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSk6IHQuVGV4dEF0dHJpYnV0ZSB7XG4gICAgcmV0dXJuIG5ldyB0LlRleHRBdHRyaWJ1dGUoXG4gICAgICAgIGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLCBhdHRyaWJ1dGUuaTE4bik7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0KTogdC5Ob2RlIHtcbiAgICByZXR1cm4gdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24odGV4dC52YWx1ZSwgdGV4dC5zb3VyY2VTcGFuLCB0ZXh0LmkxOG4pO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbik6IHQuSWN1fG51bGwge1xuICAgIGlmICghZXhwYW5zaW9uLmkxOG4pIHtcbiAgICAgIC8vIGRvIG5vdCBnZW5lcmF0ZSBJY3UgaW4gY2FzZSBpdCB3YXMgY3JlYXRlZFxuICAgICAgLy8gb3V0c2lkZSBvZiBpMThuIGJsb2NrIGluIGEgdGVtcGxhdGVcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAoIWlzSTE4blJvb3ROb2RlKGV4cGFuc2lvbi5pMThuKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHR5cGUgXCIke2V4cGFuc2lvbi5pMThuLmNvbnN0cnVjdG9yfVwiIGZvciBcImkxOG5cIiBwcm9wZXJ0eSBvZiAke1xuICAgICAgICAgIGV4cGFuc2lvbi5zb3VyY2VTcGFuLnRvU3RyaW5nKCl9LiBFeHBlY3RlZCBhIFwiTWVzc2FnZVwiYCk7XG4gICAgfVxuICAgIGNvbnN0IG1lc3NhZ2UgPSBleHBhbnNpb24uaTE4bjtcbiAgICBjb25zdCB2YXJzOiB7W25hbWU6IHN0cmluZ106IHQuQm91bmRUZXh0fSA9IHt9O1xuICAgIGNvbnN0IHBsYWNlaG9sZGVyczoge1tuYW1lOiBzdHJpbmddOiB0LlRleHR8dC5Cb3VuZFRleHR9ID0ge307XG4gICAgLy8gZXh0cmFjdCBWQVJzIGZyb20gSUNVcyAtIHdlIHByb2Nlc3MgdGhlbSBzZXBhcmF0ZWx5IHdoaWxlXG4gICAgLy8gYXNzZW1ibGluZyByZXN1bHRpbmcgbWVzc2FnZSB2aWEgZ29vZy5nZXRNc2cgZnVuY3Rpb24sIHNpbmNlXG4gICAgLy8gd2UgbmVlZCB0byBwYXNzIHRoZW0gdG8gdG9wLWxldmVsIGdvb2cuZ2V0TXNnIGNhbGxcbiAgICBPYmplY3Qua2V5cyhtZXNzYWdlLnBsYWNlaG9sZGVycykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBtZXNzYWdlLnBsYWNlaG9sZGVyc1trZXldO1xuICAgICAgaWYgKGtleS5zdGFydHNXaXRoKEkxOE5fSUNVX1ZBUl9QUkVGSVgpKSB7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuYmluZGluZ1BhcnNlci5pbnRlcnBvbGF0aW9uQ29uZmlnO1xuXG4gICAgICAgIC8vIElDVSBleHByZXNzaW9uIGlzIGEgcGxhaW4gc3RyaW5nLCBub3Qgd3JhcHBlZCBpbnRvIHN0YXJ0XG4gICAgICAgIC8vIGFuZCBlbmQgdGFncywgc28gd2Ugd3JhcCBpdCBiZWZvcmUgcGFzc2luZyB0byBiaW5kaW5nIHBhcnNlclxuICAgICAgICBjb25zdCB3cmFwcGVkID0gYCR7Y29uZmlnLnN0YXJ0fSR7dmFsdWV9JHtjb25maWcuZW5kfWA7XG5cbiAgICAgICAgLy8gQ3VycmVudGx5IHdoZW4gdGhlIGBwbHVyYWxgIG9yIGBzZWxlY3RgIGtleXdvcmRzIGluIGFuIElDVSBjb250YWluIHRyYWlsaW5nIHNwYWNlcyAoZS5nLlxuICAgICAgICAvLyBge2NvdW50LCBzZWxlY3QgLCAuLi59YCksIHRoZXNlIHNwYWNlcyBhcmUgYWxzbyBpbmNsdWRlZCBpbnRvIHRoZSBrZXkgbmFtZXMgaW4gSUNVIHZhcnNcbiAgICAgICAgLy8gKGUuZy4gXCJWQVJfU0VMRUNUIFwiKS4gVGhlc2UgdHJhaWxpbmcgc3BhY2VzIGFyZSBub3QgZGVzaXJhYmxlLCBzaW5jZSB0aGV5IHdpbGwgbGF0ZXIgYmVcbiAgICAgICAgLy8gY29udmVydGVkIGludG8gYF9gIHN5bWJvbHMgd2hpbGUgbm9ybWFsaXppbmcgcGxhY2Vob2xkZXIgbmFtZXMsIHdoaWNoIG1pZ2h0IGxlYWQgdG9cbiAgICAgICAgLy8gbWlzbWF0Y2hlcyBhdCBydW50aW1lIChpLmUuIHBsYWNlaG9sZGVyIHdpbGwgbm90IGJlIHJlcGxhY2VkIHdpdGggdGhlIGNvcnJlY3QgdmFsdWUpLlxuICAgICAgICBjb25zdCBmb3JtYXR0ZWRLZXkgPSBrZXkudHJpbSgpO1xuXG4gICAgICAgIHZhcnNbZm9ybWF0dGVkS2V5XSA9XG4gICAgICAgICAgICB0aGlzLl92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbih3cmFwcGVkLCBleHBhbnNpb24uc291cmNlU3BhbikgYXMgdC5Cb3VuZFRleHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwbGFjZWhvbGRlcnNba2V5XSA9IHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKHZhbHVlLCBleHBhbnNpb24uc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyB0LkljdSh2YXJzLCBwbGFjZWhvbGRlcnMsIGV4cGFuc2lvbi5zb3VyY2VTcGFuLCBtZXNzYWdlKTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UpOiBudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQpOiBudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIGNvbnZlcnQgdmlldyBlbmdpbmUgYFBhcnNlZFByb3BlcnR5YCB0byBhIGZvcm1hdCBzdWl0YWJsZSBmb3IgSVZZXG4gIHByaXZhdGUgZXh0cmFjdEF0dHJpYnV0ZXMoXG4gICAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBwcm9wZXJ0aWVzOiBQYXJzZWRQcm9wZXJ0eVtdLFxuICAgICAgaTE4blByb3BzTWV0YToge1trZXk6IHN0cmluZ106IGkxOG4uSTE4bk1ldGF9KTpcbiAgICAgIHtib3VuZDogdC5Cb3VuZEF0dHJpYnV0ZVtdLCBsaXRlcmFsOiB0LlRleHRBdHRyaWJ1dGVbXX0ge1xuICAgIGNvbnN0IGJvdW5kOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBsaXRlcmFsOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgcHJvcGVydGllcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgY29uc3QgaTE4biA9IGkxOG5Qcm9wc01ldGFbcHJvcC5uYW1lXTtcbiAgICAgIGlmIChwcm9wLmlzTGl0ZXJhbCkge1xuICAgICAgICBsaXRlcmFsLnB1c2gobmV3IHQuVGV4dEF0dHJpYnV0ZShcbiAgICAgICAgICAgIHByb3AubmFtZSwgcHJvcC5leHByZXNzaW9uLnNvdXJjZSB8fCAnJywgcHJvcC5zb3VyY2VTcGFuLCB1bmRlZmluZWQsIGkxOG4pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vdGUgdGhhdCB2YWxpZGF0aW9uIGlzIHNraXBwZWQgYW5kIHByb3BlcnR5IG1hcHBpbmcgaXMgZGlzYWJsZWRcbiAgICAgICAgLy8gZHVlIHRvIHRoZSBmYWN0IHRoYXQgd2UgbmVlZCB0byBtYWtlIHN1cmUgYSBnaXZlbiBwcm9wIGlzIG5vdCBhblxuICAgICAgICAvLyBpbnB1dCBvZiBhIGRpcmVjdGl2ZSBhbmQgZGlyZWN0aXZlIG1hdGNoaW5nIGhhcHBlbnMgYXQgcnVudGltZS5cbiAgICAgICAgY29uc3QgYmVwID0gdGhpcy5iaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kRWxlbWVudFByb3BlcnR5KFxuICAgICAgICAgICAgZWxlbWVudE5hbWUsIHByb3AsIC8qIHNraXBWYWxpZGF0aW9uICovIHRydWUsIC8qIG1hcFByb3BlcnR5TmFtZSAqLyBmYWxzZSk7XG4gICAgICAgIGJvdW5kLnB1c2godC5Cb3VuZEF0dHJpYnV0ZS5mcm9tQm91bmRFbGVtZW50UHJvcGVydHkoYmVwLCBpMThuKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge2JvdW5kLCBsaXRlcmFsfTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBdHRyaWJ1dGUoXG4gICAgICBpc1RlbXBsYXRlRWxlbWVudDogYm9vbGVhbiwgYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgbWF0Y2hhYmxlQXR0cmlidXRlczogc3RyaW5nW11bXSxcbiAgICAgIHBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10sIGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sXG4gICAgICByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKSB7XG4gICAgY29uc3QgbmFtZSA9IG5vcm1hbGl6ZUF0dHJpYnV0ZU5hbWUoYXR0cmlidXRlLm5hbWUpO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlLnZhbHVlO1xuICAgIGNvbnN0IHNyY1NwYW4gPSBhdHRyaWJ1dGUuc291cmNlU3BhbjtcbiAgICBjb25zdCBhYnNvbHV0ZU9mZnNldCA9XG4gICAgICAgIGF0dHJpYnV0ZS52YWx1ZVNwYW4gPyBhdHRyaWJ1dGUudmFsdWVTcGFuLnN0YXJ0Lm9mZnNldCA6IHNyY1NwYW4uc3RhcnQub2Zmc2V0O1xuXG4gICAgY29uc3QgYmluZFBhcnRzID0gbmFtZS5tYXRjaChCSU5EX05BTUVfUkVHRVhQKTtcbiAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuXG4gICAgaWYgKGJpbmRQYXJ0cykge1xuICAgICAgaGFzQmluZGluZyA9IHRydWU7XG4gICAgICBpZiAoYmluZFBhcnRzW0tXX0JJTkRfSURYXSAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyaWJ1dGUudmFsdWVTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0xFVF9JRFhdKSB7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgICB0aGlzLnBhcnNlVmFyaWFibGUoaWRlbnRpZmllciwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIHZhcmlhYmxlcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yZXBvcnRFcnJvcihgXCJsZXQtXCIgaXMgb25seSBzdXBwb3J0ZWQgb24gbmctdGVtcGxhdGUgZWxlbWVudHMuYCwgc3JjU3Bhbik7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfUkVGX0lEWF0pIHtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICB0aGlzLnBhcnNlUmVmZXJlbmNlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLCByZWZlcmVuY2VzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfT05fSURYXSkge1xuICAgICAgICBjb25zdCBldmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlRXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfS1dfSURYXSwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4gfHwgc3JjU3BhbixcbiAgICAgICAgICAgIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIGV2ZW50cyk7XG4gICAgICAgIGFkZEV2ZW50cyhldmVudHMsIGJvdW5kRXZlbnRzKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0JJTkRPTl9JRFhdKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyaWJ1dGUudmFsdWVTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyk7XG4gICAgICAgIHRoaXMucGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfS1dfSURYXSwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBib3VuZEV2ZW50cyk7XG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19BVF9JRFhdKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgICAgICAgbmFtZSwgdmFsdWUsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLFxuICAgICAgICAgICAgcGFyc2VkUHJvcGVydGllcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LFxuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyk7XG4gICAgICAgIHRoaXMucGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbixcbiAgICAgICAgICAgIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSkge1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBhYnNvbHV0ZU9mZnNldCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgZXZlbnRzKTtcbiAgICAgICAgYWRkRXZlbnRzKGV2ZW50cywgYm91bmRFdmVudHMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBoYXNCaW5kaW5nID0gdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIG5hbWUsIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFzQmluZGluZztcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKFxuICAgICAgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBpMThuPzogaTE4bi5JMThuTWV0YSk6IHQuVGV4dHx0LkJvdW5kVGV4dCB7XG4gICAgY29uc3QgdmFsdWVOb05nc3AgPSByZXBsYWNlTmdzcCh2YWx1ZSk7XG4gICAgY29uc3QgZXhwciA9IHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUludGVycG9sYXRpb24odmFsdWVOb05nc3AsIHNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBleHByID8gbmV3IHQuQm91bmRUZXh0KGV4cHIsIHNvdXJjZVNwYW4sIGkxOG4pIDogbmV3IHQuVGV4dCh2YWx1ZU5vTmdzcCwgc291cmNlU3Bhbik7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlVmFyaWFibGUoXG4gICAgICBpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10pIHtcbiAgICBpZiAoaWRlbnRpZmllci5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgdGhpcy5yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gdmFyaWFibGUgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9IGVsc2UgaWYgKGlkZW50aWZpZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBWYXJpYWJsZSBkb2VzIG5vdCBoYXZlIGEgbmFtZWAsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHZhcmlhYmxlcy5wdXNoKG5ldyB0LlZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VSZWZlcmVuY2UoXG4gICAgICBpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFufHVuZGVmaW5lZCwgcmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBcIi1cIiBpcyBub3QgYWxsb3dlZCBpbiByZWZlcmVuY2UgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9IGVsc2UgaWYgKGlkZW50aWZpZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBSZWZlcmVuY2UgZG9lcyBub3QgaGF2ZSBhIG5hbWVgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICByZWZlcmVuY2VzLnB1c2gobmV3IHQuUmVmZXJlbmNlKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSkge1xuICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICBgJHtuYW1lfUNoYW5nZWAsIGAke2V4cHJlc3Npb259PSRldmVudGAsIHNvdXJjZVNwYW4sIHZhbHVlU3BhbiB8fCBzb3VyY2VTcGFuLFxuICAgICAgICB0YXJnZXRNYXRjaGFibGVBdHRycywgZXZlbnRzKTtcbiAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gIH1cblxuICBwcml2YXRlIHJlcG9ydEVycm9yKFxuICAgICAgbWVzc2FnZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICBsZXZlbDogUGFyc2VFcnJvckxldmVsID0gUGFyc2VFcnJvckxldmVsLkVSUk9SKSB7XG4gICAgdGhpcy5lcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBtZXNzYWdlLCBsZXZlbCkpO1xuICB9XG59XG5cbmNsYXNzIE5vbkJpbmRhYmxlVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIHZpc2l0RWxlbWVudChhc3Q6IGh0bWwuRWxlbWVudCk6IHQuRWxlbWVudHxudWxsIHtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGFzdCk7XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUIHx8XG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEUgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRVNIRUVUKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhbmQgc3R5bGVzaGVldHMgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWQgdGhlbVxuICAgICAgLy8gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9IGh0bWwudmlzaXRBbGwodGhpcywgYXN0LmNoaWxkcmVuLCBudWxsKTtcbiAgICByZXR1cm4gbmV3IHQuRWxlbWVudChcbiAgICAgICAgYXN0Lm5hbWUsIGh0bWwudmlzaXRBbGwodGhpcywgYXN0LmF0dHJzKSBhcyB0LlRleHRBdHRyaWJ1dGVbXSxcbiAgICAgICAgLyogaW5wdXRzICovW10sIC8qIG91dHB1dHMgKi9bXSwgY2hpbGRyZW4swqAgLyogcmVmZXJlbmNlcyAqL1tdLCBhc3Quc291cmNlU3BhbixcbiAgICAgICAgYXN0LnN0YXJ0U291cmNlU3BhbiwgYXN0LmVuZFNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCk6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogdC5UZXh0QXR0cmlidXRlIHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dEF0dHJpYnV0ZShcbiAgICAgICAgYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgYXR0cmlidXRlLmkxOG4pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCk6IHQuVGV4dCB7XG4gICAgcmV0dXJuIG5ldyB0LlRleHQodGV4dC52YWx1ZSwgdGV4dC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24pOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSk6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuY29uc3QgTk9OX0JJTkRBQkxFX1ZJU0lUT1IgPSBuZXcgTm9uQmluZGFibGVWaXNpdG9yKCk7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUF0dHJpYnV0ZU5hbWUoYXR0ck5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiAvXmRhdGEtL2kudGVzdChhdHRyTmFtZSkgPyBhdHRyTmFtZS5zdWJzdHJpbmcoNSkgOiBhdHRyTmFtZTtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRzKGV2ZW50czogUGFyc2VkRXZlbnRbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdKSB7XG4gIGJvdW5kRXZlbnRzLnB1c2goLi4uZXZlbnRzLm1hcChlID0+IHQuQm91bmRFdmVudC5mcm9tUGFyc2VkRXZlbnQoZSkpKTtcbn1cblxuZnVuY3Rpb24gaXNFbXB0eVRleHROb2RlKG5vZGU6IGh0bWwuTm9kZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIGh0bWwuVGV4dCAmJiBub2RlLnZhbHVlLnRyaW0oKS5sZW5ndGggPT0gMDtcbn1cblxuZnVuY3Rpb24gaXNDb21tZW50Tm9kZShub2RlOiBodG1sLk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiBodG1sLkNvbW1lbnQ7XG59XG5cbmZ1bmN0aW9uIHRleHRDb250ZW50cyhub2RlOiBodG1sLkVsZW1lbnQpOiBzdHJpbmd8bnVsbCB7XG4gIGlmIChub2RlLmNoaWxkcmVuLmxlbmd0aCAhPT0gMSB8fCAhKG5vZGUuY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiBodG1sLlRleHQpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIChub2RlLmNoaWxkcmVuWzBdIGFzIGh0bWwuVGV4dCkudmFsdWU7XG4gIH1cbn1cbiJdfQ==