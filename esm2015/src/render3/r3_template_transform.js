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
const /** @type {?} */ BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.+))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
// Group 1 = "bind-"
const /** @type {?} */ KW_BIND_IDX = 1;
// Group 2 = "let-"
const /** @type {?} */ KW_LET_IDX = 2;
// Group 3 = "ref-/#"
const /** @type {?} */ KW_REF_IDX = 3;
// Group 4 = "on-"
const /** @type {?} */ KW_ON_IDX = 4;
// Group 5 = "bindon-"
const /** @type {?} */ KW_BINDON_IDX = 5;
// Group 6 = "@"
const /** @type {?} */ KW_AT_IDX = 6;
// Group 7 = the identifier after "bind-", "let-", "ref-/#", "on-", "bindon-" or "@"
const /** @type {?} */ IDENT_KW_IDX = 7;
// Group 8 = identifier inside [()]
const /** @type {?} */ IDENT_BANANA_BOX_IDX = 8;
// Group 9 = identifier inside []
const /** @type {?} */ IDENT_PROPERTY_IDX = 9;
// Group 10 = identifier inside ()
const /** @type {?} */ IDENT_EVENT_IDX = 10;
const /** @type {?} */ TEMPLATE_ATTR_PREFIX = '*';
const /** @type {?} */ CLASS_ATTR = 'class';
// Default selector used by `<ng-content>` if none specified
const /** @type {?} */ DEFAULT_CONTENT_SELECTOR = '*';
export class HtmlToTemplateTransform {
    /**
     * @param {?} bindingParser
     */
    constructor(bindingParser) {
        this.bindingParser = bindingParser;
        // Selectors for the `ng-content` tags. Only non `*` selectors are recorded here
        this.ngContentSelectors = [];
        // Any `<ng-content>` in the template ?
        this.hasNgContent = false;
    }
    /**
     * @param {?} element
     * @return {?}
     */
    visitElement(element) {
        const /** @type {?} */ preparsedElement = preparseElement(element);
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
        const /** @type {?} */ isTemplateElement = isNgTemplate(element.name);
        const /** @type {?} */ matchableAttributes = [];
        const /** @type {?} */ parsedProperties = [];
        const /** @type {?} */ boundEvents = [];
        const /** @type {?} */ variables = [];
        const /** @type {?} */ references = [];
        const /** @type {?} */ attributes = [];
        const /** @type {?} */ templateMatchableAttributes = [];
        let /** @type {?} */ inlineTemplateSourceSpan;
        const /** @type {?} */ templateParsedProperties = [];
        const /** @type {?} */ templateVariables = [];
        // Whether the element has any *-attribute
        let /** @type {?} */ elementHasInlineTemplate = false;
        for (const /** @type {?} */ attribute of element.attrs) {
            let /** @type {?} */ hasBinding = false;
            const /** @type {?} */ normalizedName = normalizeAttributeName(attribute.name);
            // `*attr` defines template bindings
            let /** @type {?} */ isTemplateBinding = false;
            if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                if (elementHasInlineTemplate) {
                    this.reportError(`Can't have multiple template bindings on one element. Use only one attribute prefixed with *`, attribute.sourceSpan);
                }
                isTemplateBinding = true;
                elementHasInlineTemplate = true;
                const /** @type {?} */ templateValue = attribute.value;
                const /** @type {?} */ templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
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
        const /** @type {?} */ children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children);
        let /** @type {?} */ parsedElement;
        if (preparsedElement.type === PreparsedElementType.NG_CONTENT) {
            // `<ng-content>`
            this.hasNgContent = true;
            if (element.children && !element.children.every(isEmptyTextNode)) {
                this.reportError(`<ng-content> element cannot have content.`, element.sourceSpan);
            }
            const /** @type {?} */ selector = preparsedElement.selectAttr;
            let /** @type {?} */ attributes = element.attrs.map(attribute => {
                return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan);
            });
            const /** @type {?} */ selectorIndex = selector === DEFAULT_CONTENT_SELECTOR ? 0 : this.ngContentSelectors.push(selector);
            parsedElement = new t.Content(selectorIndex, attributes, element.sourceSpan);
        }
        else if (isTemplateElement) {
            // `<ng-template>`
            const /** @type {?} */ boundAttributes = this.createBoundAttributes(element.name, parsedProperties);
            parsedElement = new t.Template(attributes, boundAttributes, children, references, variables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        else {
            const /** @type {?} */ boundAttributes = this.createBoundAttributes(element.name, parsedProperties);
            parsedElement = new t.Element(element.name, attributes, boundAttributes, boundEvents, children, references, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        if (elementHasInlineTemplate) {
            const /** @type {?} */ attributes = [];
            templateMatchableAttributes.forEach(([name, value]) => attributes.push(new t.TextAttribute(name, value, inlineTemplateSourceSpan)));
            const /** @type {?} */ boundAttributes = this.createBoundAttributes('ng-template', templateParsedProperties);
            parsedElement = new t.Template(attributes, boundAttributes, [parsedElement], [], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan);
        }
        return parsedElement;
    }
    /**
     * @param {?} attribute
     * @return {?}
     */
    visitAttribute(attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan);
    }
    /**
     * @param {?} text
     * @return {?}
     */
    visitText(text) {
        const /** @type {?} */ valueNoNgsp = replaceNgsp(text.value);
        const /** @type {?} */ expr = this.bindingParser.parseInterpolation(valueNoNgsp, text.sourceSpan);
        return expr ? new t.BoundText(expr, text.sourceSpan) : new t.Text(valueNoNgsp, text.sourceSpan);
    }
    /**
     * @param {?} comment
     * @return {?}
     */
    visitComment(comment) { return null; }
    /**
     * @param {?} expansion
     * @return {?}
     */
    visitExpansion(expansion) { return null; }
    /**
     * @param {?} expansionCase
     * @return {?}
     */
    visitExpansionCase(expansionCase) { return null; }
    /**
     * @param {?} elementName
     * @param {?} properties
     * @return {?}
     */
    createBoundAttributes(elementName, properties) {
        return properties.filter(prop => !prop.isLiteral)
            .map(prop => this.bindingParser.createBoundElementProperty(elementName, prop))
            .map(prop => t.BoundAttribute.fromBoundElementProperty(prop));
    }
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
    parseAttribute(isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references) {
        const /** @type {?} */ name = normalizeAttributeName(attribute.name);
        const /** @type {?} */ value = attribute.value;
        const /** @type {?} */ srcSpan = attribute.sourceSpan;
        const /** @type {?} */ bindParts = name.match(BIND_NAME_REGEXP);
        let /** @type {?} */ hasBinding = false;
        if (bindParts) {
            hasBinding = true;
            if (bindParts[KW_BIND_IDX] != null) {
                this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, matchableAttributes, parsedProperties);
            }
            else if (bindParts[KW_LET_IDX]) {
                if (isTemplateElement) {
                    const /** @type {?} */ identifier = bindParts[IDENT_KW_IDX];
                    this.parseVariable(identifier, value, srcSpan, variables);
                }
                else {
                    this.reportError(`"let-" is only supported on ng-template elements.`, srcSpan);
                }
            }
            else if (bindParts[KW_REF_IDX]) {
                const /** @type {?} */ identifier = bindParts[IDENT_KW_IDX];
                this.parseReference(identifier, value, srcSpan, references);
            }
            else if (bindParts[KW_ON_IDX]) {
                const /** @type {?} */ events = [];
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
                const /** @type {?} */ events = [];
                this.bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, matchableAttributes, events);
                addEvents(events, boundEvents);
            }
        }
        else {
            hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, matchableAttributes, parsedProperties);
        }
        return hasBinding;
    }
    /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} variables
     * @return {?}
     */
    parseVariable(identifier, value, sourceSpan, variables) {
        if (identifier.indexOf('-') > -1) {
            this.reportError(`"-" is not allowed in variable names`, sourceSpan);
        }
        variables.push(new t.Variable(identifier, value, sourceSpan));
    }
    /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} references
     * @return {?}
     */
    parseReference(identifier, value, sourceSpan, references) {
        if (identifier.indexOf('-') > -1) {
            this.reportError(`"-" is not allowed in reference names`, sourceSpan);
        }
        references.push(new t.Reference(identifier, value, sourceSpan));
    }
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} boundEvents
     * @return {?}
     */
    parseAssignmentEvent(name, expression, sourceSpan, targetMatchableAttrs, boundEvents) {
        const /** @type {?} */ events = [];
        this.bindingParser.parseEvent(`${name}Change`, `${expression}=$event`, sourceSpan, targetMatchableAttrs, events);
        addEvents(events, boundEvents);
    }
    /**
     * @param {?} message
     * @param {?} sourceSpan
     * @param {?=} level
     * @return {?}
     */
    reportError(message, sourceSpan, level = ParseErrorLevel.ERROR) {
        this.errors.push(new ParseError(sourceSpan, message, level));
    }
}
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
class NonBindableVisitor {
    /**
     * @param {?} ast
     * @return {?}
     */
    visitElement(ast) {
        const /** @type {?} */ preparsedElement = preparseElement(ast);
        if (preparsedElement.type === PreparsedElementType.SCRIPT ||
            preparsedElement.type === PreparsedElementType.STYLE ||
            preparsedElement.type === PreparsedElementType.STYLESHEET) {
            // Skipping <script> for security reasons
            // Skipping <style> and stylesheets as we already processed them
            // in the StyleCompiler
            return null;
        }
        const /** @type {?} */ children = html.visitAll(this, ast.children, null);
        return new t.Element(ast.name, /** @type {?} */ (html.visitAll(this, ast.attrs)), /* inputs */ [], /* outputs */ /* outputs */ [], children, /* references */ /* references */ [], ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
    }
    /**
     * @param {?} comment
     * @return {?}
     */
    visitComment(comment) { return null; }
    /**
     * @param {?} attribute
     * @return {?}
     */
    visitAttribute(attribute) {
        return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan);
    }
    /**
     * @param {?} text
     * @return {?}
     */
    visitText(text) { return new t.Text(text.value, text.sourceSpan); }
    /**
     * @param {?} expansion
     * @return {?}
     */
    visitExpansion(expansion) { return null; }
    /**
     * @param {?} expansionCase
     * @return {?}
     */
    visitExpansionCase(expansionCase) { return null; }
}
const /** @type {?} */ NON_BINDABLE_VISITOR = new NonBindableVisitor();
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
    boundEvents.push(...events.map(e => t.BoundEvent.fromParsedEvent(e)));
}
/**
 * @param {?} node
 * @return {?}
 */
function isEmptyTextNode(node) {
    return node instanceof html.Text && node.value.trim().length == 0;
}
//# sourceMappingURL=r3_template_transform.js.map