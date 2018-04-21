/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as html from '../ml_parser/ast';
import { replaceNgsp } from '../ml_parser/html_whitespaces';
import { isNgTemplate } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel } from '../parse_util';
import { isStyleUrlResolvable } from '../style_url_resolver';
import { PreparsedElementType, preparseElement } from '../template_parser/template_preparser';
import * as t from './r3_ast';
var /** @type {?} */ BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.+))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
// Group 1 = "bind-"
var /** @type {?} */ KW_BIND_IDX = 1;
// Group 2 = "let-"
var /** @type {?} */ KW_LET_IDX = 2;
// Group 3 = "ref-/#"
var /** @type {?} */ KW_REF_IDX = 3;
// Group 4 = "on-"
var /** @type {?} */ KW_ON_IDX = 4;
// Group 5 = "bindon-"
var /** @type {?} */ KW_BINDON_IDX = 5;
// Group 6 = "@"
var /** @type {?} */ KW_AT_IDX = 6;
// Group 7 = the identifier after "bind-", "let-", "ref-/#", "on-", "bindon-" or "@"
var /** @type {?} */ IDENT_KW_IDX = 7;
// Group 8 = identifier inside [()]
var /** @type {?} */ IDENT_BANANA_BOX_IDX = 8;
// Group 9 = identifier inside []
var /** @type {?} */ IDENT_PROPERTY_IDX = 9;
// Group 10 = identifier inside ()
var /** @type {?} */ IDENT_EVENT_IDX = 10;
var /** @type {?} */ TEMPLATE_ATTR_PREFIX = '*';
var /** @type {?} */ CLASS_ATTR = 'class';
// Default selector used by `<ng-content>` if none specified
var /** @type {?} */ DEFAULT_CONTENT_SELECTOR = '*';
var HtmlToTemplateTransform = /** @class */ (function () {
    function HtmlToTemplateTransform(bindingParser) {
        this.bindingParser = bindingParser;
        // Selectors for the `ng-content` tags. Only non `*` selectors are recorded here
        this.ngContentSelectors = [];
        // Any `<ng-content>` in the template ?
        this.hasNgContent = false;
    }
    // HTML visitor
    /**
     * @param {?} element
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.visitElement = /**
     * @param {?} element
     * @return {?}
     */
    function (element) {
        var /** @type {?} */ preparsedElement = preparseElement(element);
        if (preparsedElement.type === PreparsedElementType.SCRIPT ||
            preparsedElement.type === PreparsedElementType.STYLE) {
            // Skipping <script> for security reasons
            // Skipping <style> as we already processed them
            // in the StyleCompiler
            return null;
        }
        if (preparsedElement.type === PreparsedElementType.STYLESHEET &&
            isStyleUrlResolvable(preparsedElement.hrefAttr)) {
            // Skipping stylesheets with either relative urls or package scheme as we already processed
            // them in the StyleCompiler
            return null;
        }
        // Whether the element is a `<ng-template>`
        var /** @type {?} */ isTemplateElement = isNgTemplate(element.name);
        var /** @type {?} */ matchableAttributes = [];
        var /** @type {?} */ parsedProperties = [];
        var /** @type {?} */ boundEvents = [];
        var /** @type {?} */ variables = [];
        var /** @type {?} */ references = [];
        var /** @type {?} */ attributes = [];
        var /** @type {?} */ templateMatchableAttributes = [];
        var /** @type {?} */ inlineTemplateSourceSpan;
        var /** @type {?} */ templateParsedProperties = [];
        var /** @type {?} */ templateVariables = [];
        // Whether the element has any *-attribute
        var /** @type {?} */ elementHasInlineTemplate = false;
        for (var _i = 0, _a = element.attrs; _i < _a.length; _i++) {
            var attribute = _a[_i];
            var /** @type {?} */ hasBinding = false;
            var /** @type {?} */ normalizedName = normalizeAttributeName(attribute.name);
            // `*attr` defines template bindings
            var /** @type {?} */ isTemplateBinding = false;
            if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                if (elementHasInlineTemplate) {
                    this.reportError("Can't have multiple template bindings on one element. Use only one attribute prefixed with *", attribute.sourceSpan);
                }
                isTemplateBinding = true;
                elementHasInlineTemplate = true;
                var /** @type {?} */ templateValue = attribute.value;
                var /** @type {?} */ templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
                inlineTemplateSourceSpan = attribute.valueSpan || attribute.sourceSpan;
                this.bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attribute.sourceSpan, templateMatchableAttributes, templateParsedProperties, templateVariables);
            }
            else {
                // Check for variables, events, property bindings, interpolation
                hasBinding = this.parseAttribute(isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references);
            }
            if (!hasBinding && !isTemplateBinding) {
                // don't include the bindings as attributes as well in the AST
                attributes.push(/** @type {?} */ (this.visitAttribute(attribute)));
                matchableAttributes.push([attribute.name, attribute.value]);
            }
        }
        var /** @type {?} */ children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children);
        var /** @type {?} */ parsedElement;
        if (preparsedElement.type === PreparsedElementType.NG_CONTENT) {
            // `<ng-content>`
            this.hasNgContent = true;
            if (element.children && !element.children.every(isEmptyTextNode)) {
                this.reportError("<ng-content> element cannot have content.", element.sourceSpan);
            }
            var /** @type {?} */ selector = preparsedElement.selectAttr;
            var /** @type {?} */ attributes_1 = element.attrs.map(function (attribute) {
                return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan);
            });
            var /** @type {?} */ selectorIndex = selector === DEFAULT_CONTENT_SELECTOR ? 0 : this.ngContentSelectors.push(selector);
            parsedElement = new t.Content(selectorIndex, attributes_1, element.sourceSpan);
        }
        else if (isTemplateElement) {
            // `<ng-template>`
            var /** @type {?} */ boundAttributes = this.createBoundAttributes(element.name, parsedProperties);
            parsedElement = new t.Template(attributes, boundAttributes, children, references, variables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        else {
            var /** @type {?} */ boundAttributes = this.createBoundAttributes(element.name, parsedProperties);
            parsedElement = new t.Element(element.name, attributes, boundAttributes, boundEvents, children, references, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        if (elementHasInlineTemplate) {
            var /** @type {?} */ attributes_2 = [];
            templateMatchableAttributes.forEach(function (_a) {
                var name = _a[0], value = _a[1];
                return attributes_2.push(new t.TextAttribute(name, value, inlineTemplateSourceSpan));
            });
            var /** @type {?} */ boundAttributes = this.createBoundAttributes('ng-template', templateParsedProperties);
            parsedElement = new t.Template(attributes_2, boundAttributes, [parsedElement], [], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        return parsedElement;
    };
    /**
     * @param {?} attribute
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.visitAttribute = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan);
    };
    /**
     * @param {?} text
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.visitText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) {
        var /** @type {?} */ valueNoNgsp = replaceNgsp(text.value);
        var /** @type {?} */ expr = this.bindingParser.parseInterpolation(valueNoNgsp, text.sourceSpan);
        return expr ? new t.BoundText(expr, text.sourceSpan) : new t.Text(valueNoNgsp, text.sourceSpan);
    };
    /**
     * @param {?} comment
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.visitComment = /**
     * @param {?} comment
     * @return {?}
     */
    function (comment) { return null; };
    /**
     * @param {?} expansion
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.visitExpansion = /**
     * @param {?} expansion
     * @return {?}
     */
    function (expansion) { return null; };
    /**
     * @param {?} expansionCase
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.visitExpansionCase = /**
     * @param {?} expansionCase
     * @return {?}
     */
    function (expansionCase) { return null; };
    /**
     * @param {?} elementName
     * @param {?} properties
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.createBoundAttributes = /**
     * @param {?} elementName
     * @param {?} properties
     * @return {?}
     */
    function (elementName, properties) {
        var _this = this;
        return properties.filter(function (prop) { return !prop.isLiteral; })
            .map(function (prop) { return _this.bindingParser.createBoundElementProperty(elementName, prop); })
            .map(function (prop) { return t.BoundAttribute.fromBoundElementProperty(prop); });
    };
    /**
     * @param {?} isTemplateElement
     * @param {?} attribute
     * @param {?} matchableAttributes
     * @param {?} parsedProperties
     * @param {?} boundEvents
     * @param {?} variables
     * @param {?} references
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.parseAttribute = /**
     * @param {?} isTemplateElement
     * @param {?} attribute
     * @param {?} matchableAttributes
     * @param {?} parsedProperties
     * @param {?} boundEvents
     * @param {?} variables
     * @param {?} references
     * @return {?}
     */
    function (isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references) {
        var /** @type {?} */ name = normalizeAttributeName(attribute.name);
        var /** @type {?} */ value = attribute.value;
        var /** @type {?} */ srcSpan = attribute.sourceSpan;
        var /** @type {?} */ bindParts = name.match(BIND_NAME_REGEXP);
        var /** @type {?} */ hasBinding = false;
        if (bindParts) {
            hasBinding = true;
            if (bindParts[KW_BIND_IDX] != null) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[KW_LET_IDX]) {
                if (isTemplateElement) {
                    var /** @type {?} */ identifier = bindParts[IDENT_KW_IDX];
                    this.parseVariable(identifier, value, srcSpan, variables);
                }
                else {
                    this.reportError("\"let-\" is only supported on ng-template elements.", srcSpan);
                }
            }
            else if (bindParts[KW_REF_IDX]) {
                var /** @type {?} */ identifier = bindParts[IDENT_KW_IDX];
                this.parseReference(identifier, value, srcSpan, references);
            }
            else if (bindParts[KW_ON_IDX]) {
                var /** @type {?} */ events = [];
                this.bindingParser.parseEvent(bindParts[IDENT_KW_IDX], value, srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
            else if (bindParts[KW_BINDON_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
                this.parseAssignmentEvent(bindParts[IDENT_KW_IDX], value, srcSpan, matchableAttributes, boundEvents);
            }
            else if (bindParts[KW_AT_IDX]) {
                this.bindingParser.parseLiteralAttr(name, value, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
                this.parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, matchableAttributes, boundEvents);
            }
            else if (bindParts[IDENT_PROPERTY_IDX]) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[IDENT_EVENT_IDX]) {
                var /** @type {?} */ events = [];
                this.bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
        }
        else {
            hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, matchableAttributes, parsedProperties);
        }
        return hasBinding;
    };
    /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} variables
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.parseVariable = /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} variables
     * @return {?}
     */
    function (identifier, value, sourceSpan, variables) {
        if (identifier.indexOf('-') > -1) {
            this.reportError("\"-\" is not allowed in variable names", sourceSpan);
        }
        variables.push(new t.Variable(identifier, value, sourceSpan));
    };
    /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} references
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.parseReference = /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} references
     * @return {?}
     */
    function (identifier, value, sourceSpan, references) {
        if (identifier.indexOf('-') > -1) {
            this.reportError("\"-\" is not allowed in reference names", sourceSpan);
        }
        references.push(new t.Reference(identifier, value, sourceSpan));
    };
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} boundEvents
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.parseAssignmentEvent = /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} boundEvents
     * @return {?}
     */
    function (name, expression, sourceSpan, targetMatchableAttrs, boundEvents) {
        var /** @type {?} */ events = [];
        this.bindingParser.parseEvent(name + "Change", expression + "=$event", sourceSpan, targetMatchableAttrs, events);
        addEvents(events, boundEvents);
    };
    /**
     * @param {?} message
     * @param {?} sourceSpan
     * @param {?=} level
     * @return {?}
     */
    HtmlToTemplateTransform.prototype.reportError = /**
     * @param {?} message
     * @param {?} sourceSpan
     * @param {?=} level
     * @return {?}
     */
    function (message, sourceSpan, level) {
        if (level === void 0) { level = ParseErrorLevel.ERROR; }
        this.errors.push(new ParseError(sourceSpan, message, level));
    };
    return HtmlToTemplateTransform;
}());
export { HtmlToTemplateTransform };
function HtmlToTemplateTransform_tsickle_Closure_declarations() {
    /** @type {?} */
    HtmlToTemplateTransform.prototype.errors;
    /** @type {?} */
    HtmlToTemplateTransform.prototype.ngContentSelectors;
    /** @type {?} */
    HtmlToTemplateTransform.prototype.hasNgContent;
    /** @type {?} */
    HtmlToTemplateTransform.prototype.bindingParser;
}
var NonBindableVisitor = /** @class */ (function () {
    function NonBindableVisitor() {
    }
    /**
     * @param {?} ast
     * @return {?}
     */
    NonBindableVisitor.prototype.visitElement = /**
     * @param {?} ast
     * @return {?}
     */
    function (ast) {
        var /** @type {?} */ preparsedElement = preparseElement(ast);
        if (preparsedElement.type === PreparsedElementType.SCRIPT ||
            preparsedElement.type === PreparsedElementType.STYLE ||
            preparsedElement.type === PreparsedElementType.STYLESHEET) {
            // Skipping <script> for security reasons
            // Skipping <style> and stylesheets as we already processed them
            // in the StyleCompiler
            return null;
        }
        var /** @type {?} */ children = html.visitAll(this, ast.children, null);
        return new t.Element(ast.name, /** @type {?} */ (html.visitAll(this, ast.attrs)), /* inputs */ [], /* outputs */ /* outputs */ [], children, /* references */ /* references */ [], ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
    };
    /**
     * @param {?} comment
     * @return {?}
     */
    NonBindableVisitor.prototype.visitComment = /**
     * @param {?} comment
     * @return {?}
     */
    function (comment) { return null; };
    /**
     * @param {?} attribute
     * @return {?}
     */
    NonBindableVisitor.prototype.visitAttribute = /**
     * @param {?} attribute
     * @return {?}
     */
    function (attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan);
    };
    /**
     * @param {?} text
     * @return {?}
     */
    NonBindableVisitor.prototype.visitText = /**
     * @param {?} text
     * @return {?}
     */
    function (text) { return new t.Text(text.value, text.sourceSpan); };
    /**
     * @param {?} expansion
     * @return {?}
     */
    NonBindableVisitor.prototype.visitExpansion = /**
     * @param {?} expansion
     * @return {?}
     */
    function (expansion) { return null; };
    /**
     * @param {?} expansionCase
     * @return {?}
     */
    NonBindableVisitor.prototype.visitExpansionCase = /**
     * @param {?} expansionCase
     * @return {?}
     */
    function (expansionCase) { return null; };
    return NonBindableVisitor;
}());
var /** @type {?} */ NON_BINDABLE_VISITOR = new NonBindableVisitor();
/**
 * @param {?} attrName
 * @return {?}
 */
function normalizeAttributeName(attrName) {
    return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
}
/**
 * @param {?} events
 * @param {?} boundEvents
 * @return {?}
 */
function addEvents(events, boundEvents) {
    boundEvents.push.apply(boundEvents, events.map(function (e) { return t.BoundEvent.fromParsedEvent(e); }));
}
/**
 * @param {?} node
 * @return {?}
 */
function isEmptyTextNode(node) {
    return node instanceof html.Text && node.value.trim().length == 0;
}
//# sourceMappingURL=r3_template_transform.js.map