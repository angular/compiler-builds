/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { identifierName } from '../compile_metadata';
import { ASTWithSource, EmptyExpr } from '../expression_parser/ast';
import { Identifiers, createTokenForExternalReference, createTokenForReference } from '../identifiers';
import * as html from '../ml_parser/ast';
import { ParseTreeResult } from '../ml_parser/html_parser';
import { removeWhitespaces, replaceNgsp } from '../ml_parser/html_whitespaces';
import { expandNodes } from '../ml_parser/icu_ast_expander';
import { InterpolationConfig } from '../ml_parser/interpolation_config';
import { isNgTemplate, splitNsName } from '../ml_parser/tags';
import { ParseError, ParseErrorLevel, ParseSourceSpan } from '../parse_util';
import { ProviderElementContext, ProviderViewContext } from '../provider_analyzer';
import { CssSelector, SelectorMatcher } from '../selector';
import { isStyleUrlResolvable } from '../style_url_resolver';
import { syntaxError } from '../util';
import { BindingParser } from './binding_parser';
import * as t from './template_ast';
import { PreparsedElementType, preparseElement } from './template_preparser';
const BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.+))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
// Group 1 = "bind-"
const KW_BIND_IDX = 1;
// Group 2 = "let-"
const KW_LET_IDX = 2;
// Group 3 = "ref-/#"
const KW_REF_IDX = 3;
// Group 4 = "on-"
const KW_ON_IDX = 4;
// Group 5 = "bindon-"
const KW_BINDON_IDX = 5;
// Group 6 = "@"
const KW_AT_IDX = 6;
// Group 7 = the identifier after "bind-", "let-", "ref-/#", "on-", "bindon-" or "@"
const IDENT_KW_IDX = 7;
// Group 8 = identifier inside [()]
const IDENT_BANANA_BOX_IDX = 8;
// Group 9 = identifier inside []
const IDENT_PROPERTY_IDX = 9;
// Group 10 = identifier inside ()
const IDENT_EVENT_IDX = 10;
const TEMPLATE_ATTR_PREFIX = '*';
const CLASS_ATTR = 'class';
let _TEXT_CSS_SELECTOR;
function TEXT_CSS_SELECTOR() {
    if (!_TEXT_CSS_SELECTOR) {
        _TEXT_CSS_SELECTOR = CssSelector.parse('*')[0];
    }
    return _TEXT_CSS_SELECTOR;
}
export class TemplateParseError extends ParseError {
    constructor(message, span, level) {
        super(span, message, level);
    }
}
export class TemplateParseResult {
    constructor(templateAst, usedPipes, errors) {
        this.templateAst = templateAst;
        this.usedPipes = usedPipes;
        this.errors = errors;
    }
}
export class TemplateParser {
    constructor(_config, _reflector, _exprParser, _schemaRegistry, _htmlParser, _console, transforms) {
        this._config = _config;
        this._reflector = _reflector;
        this._exprParser = _exprParser;
        this._schemaRegistry = _schemaRegistry;
        this._htmlParser = _htmlParser;
        this._console = _console;
        this.transforms = transforms;
    }
    get expressionParser() { return this._exprParser; }
    parse(component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
        const result = this.tryParse(component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces);
        const warnings = result.errors.filter(error => error.level === ParseErrorLevel.WARNING);
        const errors = result.errors.filter(error => error.level === ParseErrorLevel.ERROR);
        if (warnings.length > 0) {
            this._console.warn(`Template parse warnings:\n${warnings.join('\n')}`);
        }
        if (errors.length > 0) {
            const errorString = errors.join('\n');
            throw syntaxError(`Template parse errors:\n${errorString}`, errors);
        }
        return { template: result.templateAst, pipes: result.usedPipes };
    }
    tryParse(component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
        let htmlParseResult = typeof template === 'string' ?
            this._htmlParser.parse(template, templateUrl, {
                tokenizeExpansionForms: true,
                interpolationConfig: this.getInterpolationConfig(component)
            }) :
            template;
        if (!preserveWhitespaces) {
            htmlParseResult = removeWhitespaces(htmlParseResult);
        }
        return this.tryParseHtml(this.expandHtml(htmlParseResult), component, directives, pipes, schemas);
    }
    tryParseHtml(htmlAstWithErrors, component, directives, pipes, schemas) {
        let result;
        const errors = htmlAstWithErrors.errors;
        const usedPipes = [];
        if (htmlAstWithErrors.rootNodes.length > 0) {
            const uniqDirectives = removeSummaryDuplicates(directives);
            const uniqPipes = removeSummaryDuplicates(pipes);
            const providerViewContext = new ProviderViewContext(this._reflector, component);
            let interpolationConfig = undefined;
            if (component.template && component.template.interpolation) {
                interpolationConfig = {
                    start: component.template.interpolation[0],
                    end: component.template.interpolation[1]
                };
            }
            const bindingParser = new BindingParser(this._exprParser, interpolationConfig, this._schemaRegistry, uniqPipes, errors);
            const parseVisitor = new TemplateParseVisitor(this._reflector, this._config, providerViewContext, uniqDirectives, bindingParser, this._schemaRegistry, schemas, errors);
            result = html.visitAll(parseVisitor, htmlAstWithErrors.rootNodes, EMPTY_ELEMENT_CONTEXT);
            errors.push(...providerViewContext.errors);
            usedPipes.push(...bindingParser.getUsedPipes());
        }
        else {
            result = [];
        }
        this._assertNoReferenceDuplicationOnTemplate(result, errors);
        if (errors.length > 0) {
            return new TemplateParseResult(result, usedPipes, errors);
        }
        if (this.transforms) {
            this.transforms.forEach((transform) => { result = t.templateVisitAll(transform, result); });
        }
        return new TemplateParseResult(result, usedPipes, errors);
    }
    expandHtml(htmlAstWithErrors, forced = false) {
        const errors = htmlAstWithErrors.errors;
        if (errors.length == 0 || forced) {
            // Transform ICU messages to angular directives
            const expandedHtmlAst = expandNodes(htmlAstWithErrors.rootNodes);
            errors.push(...expandedHtmlAst.errors);
            htmlAstWithErrors = new ParseTreeResult(expandedHtmlAst.nodes, errors);
        }
        return htmlAstWithErrors;
    }
    getInterpolationConfig(component) {
        if (component.template) {
            return InterpolationConfig.fromArray(component.template.interpolation);
        }
        return undefined;
    }
    /** @internal */
    _assertNoReferenceDuplicationOnTemplate(result, errors) {
        const existingReferences = [];
        result.filter(element => !!element.references)
            .forEach(element => element.references.forEach((reference) => {
            const name = reference.name;
            if (existingReferences.indexOf(name) < 0) {
                existingReferences.push(name);
            }
            else {
                const error = new TemplateParseError(`Reference "#${name}" is defined several times`, reference.sourceSpan, ParseErrorLevel.ERROR);
                errors.push(error);
            }
        }));
    }
}
class TemplateParseVisitor {
    constructor(reflector, config, providerViewContext, directives, _bindingParser, _schemaRegistry, _schemas, _targetErrors) {
        this.reflector = reflector;
        this.config = config;
        this.providerViewContext = providerViewContext;
        this._bindingParser = _bindingParser;
        this._schemaRegistry = _schemaRegistry;
        this._schemas = _schemas;
        this._targetErrors = _targetErrors;
        this.selectorMatcher = new SelectorMatcher();
        this.directivesIndex = new Map();
        this.ngContentCount = 0;
        // Note: queries start with id 1 so we can use the number in a Bloom filter!
        this.contentQueryStartId = providerViewContext.component.viewQueries.length + 1;
        directives.forEach((directive, index) => {
            const selector = CssSelector.parse(directive.selector);
            this.selectorMatcher.addSelectables(selector, directive);
            this.directivesIndex.set(directive, index);
        });
    }
    visitExpansion(expansion, context) { return null; }
    visitExpansionCase(expansionCase, context) { return null; }
    visitText(text, parent) {
        const ngContentIndex = parent.findNgContentIndex(TEXT_CSS_SELECTOR());
        const valueNoNgsp = replaceNgsp(text.value);
        const expr = this._bindingParser.parseInterpolation(valueNoNgsp, text.sourceSpan);
        return expr ? new t.BoundTextAst(expr, ngContentIndex, text.sourceSpan) :
            new t.TextAst(valueNoNgsp, ngContentIndex, text.sourceSpan);
    }
    visitAttribute(attribute, context) {
        return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
    }
    visitComment(comment, context) { return null; }
    visitElement(element, parent) {
        const queryStartIndex = this.contentQueryStartId;
        const elName = element.name;
        const preparsedElement = preparseElement(element);
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
        const matchableAttrs = [];
        const elementOrDirectiveProps = [];
        const elementOrDirectiveRefs = [];
        const elementVars = [];
        const events = [];
        const templateElementOrDirectiveProps = [];
        const templateMatchableAttrs = [];
        const templateElementVars = [];
        let hasInlineTemplates = false;
        const attrs = [];
        const isTemplateElement = isNgTemplate(element.name);
        element.attrs.forEach(attr => {
            const parsedVariables = [];
            const hasBinding = this._parseAttr(isTemplateElement, attr, matchableAttrs, elementOrDirectiveProps, events, elementOrDirectiveRefs, elementVars);
            elementVars.push(...parsedVariables.map(v => t.VariableAst.fromParsedVariable(v)));
            let templateValue;
            let templateKey;
            const normalizedName = this._normalizeAttributeName(attr.name);
            if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                templateValue = attr.value;
                templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
            }
            const hasTemplateBinding = templateValue != null;
            if (hasTemplateBinding) {
                if (hasInlineTemplates) {
                    this._reportError(`Can't have multiple template bindings on one element. Use only one attribute prefixed with *`, attr.sourceSpan);
                }
                hasInlineTemplates = true;
                const parsedVariables = [];
                this._bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attr.sourceSpan, templateMatchableAttrs, templateElementOrDirectiveProps, parsedVariables);
                templateElementVars.push(...parsedVariables.map(v => t.VariableAst.fromParsedVariable(v)));
            }
            if (!hasBinding && !hasTemplateBinding) {
                // don't include the bindings as attributes as well in the AST
                attrs.push(this.visitAttribute(attr, null));
                matchableAttrs.push([attr.name, attr.value]);
            }
        });
        const elementCssSelector = createElementCssSelector(elName, matchableAttrs);
        const { directives: directiveMetas, matchElement } = this._parseDirectives(this.selectorMatcher, elementCssSelector);
        const references = [];
        const boundDirectivePropNames = new Set();
        const directiveAsts = this._createDirectiveAsts(isTemplateElement, element.name, directiveMetas, elementOrDirectiveProps, elementOrDirectiveRefs, element.sourceSpan, references, boundDirectivePropNames);
        const elementProps = this._createElementPropertyAsts(element.name, elementOrDirectiveProps, boundDirectivePropNames);
        const isViewRoot = parent.isTemplateElement || hasInlineTemplates;
        const providerContext = new ProviderElementContext(this.providerViewContext, parent.providerContext, isViewRoot, directiveAsts, attrs, references, isTemplateElement, queryStartIndex, element.sourceSpan);
        const children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children, ElementContext.create(isTemplateElement, directiveAsts, isTemplateElement ? parent.providerContext : providerContext));
        providerContext.afterElement();
        // Override the actual selector when the `ngProjectAs` attribute is provided
        const projectionSelector = preparsedElement.projectAs != '' ?
            CssSelector.parse(preparsedElement.projectAs)[0] :
            elementCssSelector;
        const ngContentIndex = parent.findNgContentIndex(projectionSelector);
        let parsedElement;
        if (preparsedElement.type === PreparsedElementType.NG_CONTENT) {
            // `<ng-content>` element
            if (element.children && !element.children.every(_isEmptyTextNode)) {
                this._reportError(`<ng-content> element cannot have content.`, element.sourceSpan);
            }
            parsedElement = new t.NgContentAst(this.ngContentCount++, hasInlineTemplates ? null : ngContentIndex, element.sourceSpan);
        }
        else if (isTemplateElement) {
            // `<ng-template>` element
            this._assertAllEventsPublishedByDirectives(directiveAsts, events);
            this._assertNoComponentsNorElementBindingsOnTemplate(directiveAsts, elementProps, element.sourceSpan);
            parsedElement = new t.EmbeddedTemplateAst(attrs, events, references, elementVars, providerContext.transformedDirectiveAsts, providerContext.transformProviders, providerContext.transformedHasViewContainer, providerContext.queryMatches, children, hasInlineTemplates ? null : ngContentIndex, element.sourceSpan);
        }
        else {
            // element other than `<ng-content>` and `<ng-template>`
            this._assertElementExists(matchElement, element);
            this._assertOnlyOneComponent(directiveAsts, element.sourceSpan);
            const ngContentIndex = hasInlineTemplates ? null : parent.findNgContentIndex(projectionSelector);
            parsedElement = new t.ElementAst(elName, attrs, elementProps, events, references, providerContext.transformedDirectiveAsts, providerContext.transformProviders, providerContext.transformedHasViewContainer, providerContext.queryMatches, children, hasInlineTemplates ? null : ngContentIndex, element.sourceSpan, element.endSourceSpan || null);
        }
        if (hasInlineTemplates) {
            // The element as a *-attribute
            const templateQueryStartIndex = this.contentQueryStartId;
            const templateSelector = createElementCssSelector('ng-template', templateMatchableAttrs);
            const { directives } = this._parseDirectives(this.selectorMatcher, templateSelector);
            const templateBoundDirectivePropNames = new Set();
            const templateDirectiveAsts = this._createDirectiveAsts(true, elName, directives, templateElementOrDirectiveProps, [], element.sourceSpan, [], templateBoundDirectivePropNames);
            const templateElementProps = this._createElementPropertyAsts(elName, templateElementOrDirectiveProps, templateBoundDirectivePropNames);
            this._assertNoComponentsNorElementBindingsOnTemplate(templateDirectiveAsts, templateElementProps, element.sourceSpan);
            const templateProviderContext = new ProviderElementContext(this.providerViewContext, parent.providerContext, parent.isTemplateElement, templateDirectiveAsts, [], [], true, templateQueryStartIndex, element.sourceSpan);
            templateProviderContext.afterElement();
            parsedElement = new t.EmbeddedTemplateAst([], [], [], templateElementVars, templateProviderContext.transformedDirectiveAsts, templateProviderContext.transformProviders, templateProviderContext.transformedHasViewContainer, templateProviderContext.queryMatches, [parsedElement], ngContentIndex, element.sourceSpan);
        }
        return parsedElement;
    }
    _parseAttr(isTemplateElement, attr, targetMatchableAttrs, targetProps, targetEvents, targetRefs, targetVars) {
        const name = this._normalizeAttributeName(attr.name);
        const value = attr.value;
        const srcSpan = attr.sourceSpan;
        const boundEvents = [];
        const bindParts = name.match(BIND_NAME_REGEXP);
        let hasBinding = false;
        if (bindParts !== null) {
            hasBinding = true;
            if (bindParts[KW_BIND_IDX] != null) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
            }
            else if (bindParts[KW_LET_IDX]) {
                if (isTemplateElement) {
                    const identifier = bindParts[IDENT_KW_IDX];
                    this._parseVariable(identifier, value, srcSpan, targetVars);
                }
                else {
                    this._reportError(`"let-" is only supported on ng-template elements.`, srcSpan);
                }
            }
            else if (bindParts[KW_REF_IDX]) {
                const identifier = bindParts[IDENT_KW_IDX];
                this._parseReference(identifier, value, srcSpan, targetRefs);
            }
            else if (bindParts[KW_ON_IDX]) {
                this._bindingParser.parseEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attr.valueSpan || srcSpan, targetMatchableAttrs, boundEvents);
            }
            else if (bindParts[KW_BINDON_IDX]) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
                this._parseAssignmentEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attr.valueSpan || srcSpan, targetMatchableAttrs, boundEvents);
            }
            else if (bindParts[KW_AT_IDX]) {
                this._bindingParser.parseLiteralAttr(name, value, srcSpan, targetMatchableAttrs, targetProps);
            }
            else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
                this._parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, attr.valueSpan || srcSpan, targetMatchableAttrs, boundEvents);
            }
            else if (bindParts[IDENT_PROPERTY_IDX]) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
            }
            else if (bindParts[IDENT_EVENT_IDX]) {
                this._bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, attr.valueSpan || srcSpan, targetMatchableAttrs, boundEvents);
            }
        }
        else {
            hasBinding = this._bindingParser.parsePropertyInterpolation(name, value, srcSpan, targetMatchableAttrs, targetProps);
        }
        if (!hasBinding) {
            this._bindingParser.parseLiteralAttr(name, value, srcSpan, targetMatchableAttrs, targetProps);
        }
        targetEvents.push(...boundEvents.map(e => t.BoundEventAst.fromParsedEvent(e)));
        return hasBinding;
    }
    _normalizeAttributeName(attrName) {
        return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
    }
    _parseVariable(identifier, value, sourceSpan, targetVars) {
        if (identifier.indexOf('-') > -1) {
            this._reportError(`"-" is not allowed in variable names`, sourceSpan);
        }
        targetVars.push(new t.VariableAst(identifier, value, sourceSpan));
    }
    _parseReference(identifier, value, sourceSpan, targetRefs) {
        if (identifier.indexOf('-') > -1) {
            this._reportError(`"-" is not allowed in reference names`, sourceSpan);
        }
        targetRefs.push(new ElementOrDirectiveRef(identifier, value, sourceSpan));
    }
    _parseAssignmentEvent(name, expression, sourceSpan, valueSpan, targetMatchableAttrs, targetEvents) {
        this._bindingParser.parseEvent(`${name}Change`, `${expression}=$event`, sourceSpan, valueSpan, targetMatchableAttrs, targetEvents);
    }
    _parseDirectives(selectorMatcher, elementCssSelector) {
        // Need to sort the directives so that we get consistent results throughout,
        // as selectorMatcher uses Maps inside.
        // Also deduplicate directives as they might match more than one time!
        const directives = new Array(this.directivesIndex.size);
        // Whether any directive selector matches on the element name
        let matchElement = false;
        selectorMatcher.match(elementCssSelector, (selector, directive) => {
            directives[this.directivesIndex.get(directive)] = directive;
            matchElement = matchElement || selector.hasElementSelector();
        });
        return {
            directives: directives.filter(dir => !!dir),
            matchElement,
        };
    }
    _createDirectiveAsts(isTemplateElement, elementName, directives, props, elementOrDirectiveRefs, elementSourceSpan, targetReferences, targetBoundDirectivePropNames) {
        const matchedReferences = new Set();
        let component = null;
        const directiveAsts = directives.map((directive) => {
            const sourceSpan = new ParseSourceSpan(elementSourceSpan.start, elementSourceSpan.end, `Directive ${identifierName(directive.type)}`);
            if (directive.isComponent) {
                component = directive;
            }
            const directiveProperties = [];
            const boundProperties = this._bindingParser.createDirectiveHostPropertyAsts(directive, elementName, sourceSpan);
            let hostProperties = boundProperties.map(prop => t.BoundElementPropertyAst.fromBoundProperty(prop));
            // Note: We need to check the host properties here as well,
            // as we don't know the element name in the DirectiveWrapperCompiler yet.
            hostProperties = this._checkPropertiesInSchema(elementName, hostProperties);
            const parsedEvents = this._bindingParser.createDirectiveHostEventAsts(directive, sourceSpan);
            this._createDirectivePropertyAsts(directive.inputs, props, directiveProperties, targetBoundDirectivePropNames);
            elementOrDirectiveRefs.forEach((elOrDirRef) => {
                if ((elOrDirRef.value.length === 0 && directive.isComponent) ||
                    (elOrDirRef.isReferenceToDirective(directive))) {
                    targetReferences.push(new t.ReferenceAst(elOrDirRef.name, createTokenForReference(directive.type.reference), elOrDirRef.value, elOrDirRef.sourceSpan));
                    matchedReferences.add(elOrDirRef.name);
                }
            });
            const hostEvents = parsedEvents.map(e => t.BoundEventAst.fromParsedEvent(e));
            const contentQueryStartId = this.contentQueryStartId;
            this.contentQueryStartId += directive.queries.length;
            return new t.DirectiveAst(directive, directiveProperties, hostProperties, hostEvents, contentQueryStartId, sourceSpan);
        });
        elementOrDirectiveRefs.forEach((elOrDirRef) => {
            if (elOrDirRef.value.length > 0) {
                if (!matchedReferences.has(elOrDirRef.name)) {
                    this._reportError(`There is no directive with "exportAs" set to "${elOrDirRef.value}"`, elOrDirRef.sourceSpan);
                }
            }
            else if (!component) {
                let refToken = null;
                if (isTemplateElement) {
                    refToken = createTokenForExternalReference(this.reflector, Identifiers.TemplateRef);
                }
                targetReferences.push(new t.ReferenceAst(elOrDirRef.name, refToken, elOrDirRef.value, elOrDirRef.sourceSpan));
            }
        });
        return directiveAsts;
    }
    _createDirectivePropertyAsts(directiveProperties, boundProps, targetBoundDirectiveProps, targetBoundDirectivePropNames) {
        if (directiveProperties) {
            const boundPropsByName = new Map();
            boundProps.forEach(boundProp => {
                const prevValue = boundPropsByName.get(boundProp.name);
                if (!prevValue || prevValue.isLiteral) {
                    // give [a]="b" a higher precedence than a="b" on the same element
                    boundPropsByName.set(boundProp.name, boundProp);
                }
            });
            Object.keys(directiveProperties).forEach(dirProp => {
                const elProp = directiveProperties[dirProp];
                const boundProp = boundPropsByName.get(elProp);
                // Bindings are optional, so this binding only needs to be set up if an expression is given.
                if (boundProp) {
                    targetBoundDirectivePropNames.add(boundProp.name);
                    if (!isEmptyExpression(boundProp.expression)) {
                        targetBoundDirectiveProps.push(new t.BoundDirectivePropertyAst(dirProp, boundProp.name, boundProp.expression, boundProp.sourceSpan));
                    }
                }
            });
        }
    }
    _createElementPropertyAsts(elementName, props, boundDirectivePropNames) {
        const boundElementProps = [];
        props.forEach((prop) => {
            if (!prop.isLiteral && !boundDirectivePropNames.has(prop.name)) {
                const boundProp = this._bindingParser.createBoundElementProperty(elementName, prop);
                boundElementProps.push(t.BoundElementPropertyAst.fromBoundProperty(boundProp));
            }
        });
        return this._checkPropertiesInSchema(elementName, boundElementProps);
    }
    _findComponentDirectives(directives) {
        return directives.filter(directive => directive.directive.isComponent);
    }
    _findComponentDirectiveNames(directives) {
        return this._findComponentDirectives(directives)
            .map(directive => identifierName(directive.directive.type));
    }
    _assertOnlyOneComponent(directives, sourceSpan) {
        const componentTypeNames = this._findComponentDirectiveNames(directives);
        if (componentTypeNames.length > 1) {
            this._reportError(`More than one component matched on this element.\n` +
                `Make sure that only one component's selector can match a given element.\n` +
                `Conflicting components: ${componentTypeNames.join(',')}`, sourceSpan);
        }
    }
    /**
     * Make sure that non-angular tags conform to the schemas.
     *
     * Note: An element is considered an angular tag when at least one directive selector matches the
     * tag name.
     *
     * @param matchElement Whether any directive has matched on the tag name
     * @param element the html element
     */
    _assertElementExists(matchElement, element) {
        const elName = element.name.replace(/^:xhtml:/, '');
        if (!matchElement && !this._schemaRegistry.hasElement(elName, this._schemas)) {
            let errorMsg = `'${elName}' is not a known element:\n`;
            errorMsg +=
                `1. If '${elName}' is an Angular component, then verify that it is part of this module.\n`;
            if (elName.indexOf('-') > -1) {
                errorMsg +=
                    `2. If '${elName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the '@NgModule.schemas' of this component to suppress this message.`;
            }
            else {
                errorMsg +=
                    `2. To allow any element add 'NO_ERRORS_SCHEMA' to the '@NgModule.schemas' of this component.`;
            }
            this._reportError(errorMsg, element.sourceSpan);
        }
    }
    _assertNoComponentsNorElementBindingsOnTemplate(directives, elementProps, sourceSpan) {
        const componentTypeNames = this._findComponentDirectiveNames(directives);
        if (componentTypeNames.length > 0) {
            this._reportError(`Components on an embedded template: ${componentTypeNames.join(',')}`, sourceSpan);
        }
        elementProps.forEach(prop => {
            this._reportError(`Property binding ${prop.name} not used by any directive on an embedded template. Make sure that the property name is spelled correctly and all directives are listed in the "@NgModule.declarations".`, sourceSpan);
        });
    }
    _assertAllEventsPublishedByDirectives(directives, events) {
        const allDirectiveEvents = new Set();
        directives.forEach(directive => {
            Object.keys(directive.directive.outputs).forEach(k => {
                const eventName = directive.directive.outputs[k];
                allDirectiveEvents.add(eventName);
            });
        });
        events.forEach(event => {
            if (event.target != null || !allDirectiveEvents.has(event.name)) {
                this._reportError(`Event binding ${event.fullName} not emitted by any directive on an embedded template. Make sure that the event name is spelled correctly and all directives are listed in the "@NgModule.declarations".`, event.sourceSpan);
            }
        });
    }
    _checkPropertiesInSchema(elementName, boundProps) {
        // Note: We can't filter out empty expressions before this method,
        // as we still want to validate them!
        return boundProps.filter((boundProp) => {
            if (boundProp.type === 0 /* Property */ &&
                !this._schemaRegistry.hasProperty(elementName, boundProp.name, this._schemas)) {
                let errorMsg = `Can't bind to '${boundProp.name}' since it isn't a known property of '${elementName}'.`;
                if (elementName.startsWith('ng-')) {
                    errorMsg +=
                        `\n1. If '${boundProp.name}' is an Angular directive, then add 'CommonModule' to the '@NgModule.imports' of this component.` +
                            `\n2. To allow any property add 'NO_ERRORS_SCHEMA' to the '@NgModule.schemas' of this component.`;
                }
                else if (elementName.indexOf('-') > -1) {
                    errorMsg +=
                        `\n1. If '${elementName}' is an Angular component and it has '${boundProp.name}' input, then verify that it is part of this module.` +
                            `\n2. If '${elementName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the '@NgModule.schemas' of this component to suppress this message.` +
                            `\n3. To allow any property add 'NO_ERRORS_SCHEMA' to the '@NgModule.schemas' of this component.`;
                }
                this._reportError(errorMsg, boundProp.sourceSpan);
            }
            return !isEmptyExpression(boundProp.value);
        });
    }
    _reportError(message, sourceSpan, level = ParseErrorLevel.ERROR) {
        this._targetErrors.push(new ParseError(sourceSpan, message, level));
    }
}
class NonBindableVisitor {
    visitElement(ast, parent) {
        const preparsedElement = preparseElement(ast);
        if (preparsedElement.type === PreparsedElementType.SCRIPT ||
            preparsedElement.type === PreparsedElementType.STYLE ||
            preparsedElement.type === PreparsedElementType.STYLESHEET) {
            // Skipping <script> for security reasons
            // Skipping <style> and stylesheets as we already processed them
            // in the StyleCompiler
            return null;
        }
        const attrNameAndValues = ast.attrs.map((attr) => [attr.name, attr.value]);
        const selector = createElementCssSelector(ast.name, attrNameAndValues);
        const ngContentIndex = parent.findNgContentIndex(selector);
        const children = html.visitAll(this, ast.children, EMPTY_ELEMENT_CONTEXT);
        return new t.ElementAst(ast.name, html.visitAll(this, ast.attrs), [], [], [], [], [], false, [], children, ngContentIndex, ast.sourceSpan, ast.endSourceSpan);
    }
    visitComment(comment, context) { return null; }
    visitAttribute(attribute, context) {
        return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
    }
    visitText(text, parent) {
        const ngContentIndex = parent.findNgContentIndex(TEXT_CSS_SELECTOR());
        return new t.TextAst(text.value, ngContentIndex, text.sourceSpan);
    }
    visitExpansion(expansion, context) { return expansion; }
    visitExpansionCase(expansionCase, context) { return expansionCase; }
}
/**
 * A reference to an element or directive in a template. E.g., the reference in this template:
 *
 * <div #myMenu="coolMenu">
 *
 * would be {name: 'myMenu', value: 'coolMenu', sourceSpan: ...}
 */
class ElementOrDirectiveRef {
    constructor(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /** Gets whether this is a reference to the given directive. */
    isReferenceToDirective(directive) {
        return splitExportAs(directive.exportAs).indexOf(this.value) !== -1;
    }
}
/** Splits a raw, potentially comma-delimited `exportAs` value into an array of names. */
function splitExportAs(exportAs) {
    return exportAs ? exportAs.split(',').map(e => e.trim()) : [];
}
export function splitClasses(classAttrValue) {
    return classAttrValue.trim().split(/\s+/g);
}
class ElementContext {
    constructor(isTemplateElement, _ngContentIndexMatcher, _wildcardNgContentIndex, providerContext) {
        this.isTemplateElement = isTemplateElement;
        this._ngContentIndexMatcher = _ngContentIndexMatcher;
        this._wildcardNgContentIndex = _wildcardNgContentIndex;
        this.providerContext = providerContext;
    }
    static create(isTemplateElement, directives, providerContext) {
        const matcher = new SelectorMatcher();
        let wildcardNgContentIndex = null;
        const component = directives.find(directive => directive.directive.isComponent);
        if (component) {
            const ngContentSelectors = component.directive.template.ngContentSelectors;
            for (let i = 0; i < ngContentSelectors.length; i++) {
                const selector = ngContentSelectors[i];
                if (selector === '*') {
                    wildcardNgContentIndex = i;
                }
                else {
                    matcher.addSelectables(CssSelector.parse(ngContentSelectors[i]), i);
                }
            }
        }
        return new ElementContext(isTemplateElement, matcher, wildcardNgContentIndex, providerContext);
    }
    findNgContentIndex(selector) {
        const ngContentIndices = [];
        this._ngContentIndexMatcher.match(selector, (selector, ngContentIndex) => { ngContentIndices.push(ngContentIndex); });
        ngContentIndices.sort();
        if (this._wildcardNgContentIndex != null) {
            ngContentIndices.push(this._wildcardNgContentIndex);
        }
        return ngContentIndices.length > 0 ? ngContentIndices[0] : null;
    }
}
export function createElementCssSelector(elementName, attributes) {
    const cssSelector = new CssSelector();
    const elNameNoNs = splitNsName(elementName)[1];
    cssSelector.setElement(elNameNoNs);
    for (let i = 0; i < attributes.length; i++) {
        const attrName = attributes[i][0];
        const attrNameNoNs = splitNsName(attrName)[1];
        const attrValue = attributes[i][1];
        cssSelector.addAttribute(attrNameNoNs, attrValue);
        if (attrName.toLowerCase() == CLASS_ATTR) {
            const classes = splitClasses(attrValue);
            classes.forEach(className => cssSelector.addClassName(className));
        }
    }
    return cssSelector;
}
const EMPTY_ELEMENT_CONTEXT = new ElementContext(true, new SelectorMatcher(), null, null);
const NON_BINDABLE_VISITOR = new NonBindableVisitor();
function _isEmptyTextNode(node) {
    return node instanceof html.Text && node.value.trim().length == 0;
}
export function removeSummaryDuplicates(items) {
    const map = new Map();
    items.forEach((item) => {
        if (!map.get(item.type.reference)) {
            map.set(item.type.reference, item);
        }
    });
    return Array.from(map.values());
}
function isEmptyExpression(ast) {
    if (ast instanceof ASTWithSource) {
        ast = ast.ast;
    }
    return ast instanceof EmptyExpr;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFtSCxjQUFjLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUlySyxPQUFPLEVBQU0sYUFBYSxFQUFFLFNBQVMsRUFBOEMsTUFBTSwwQkFBMEIsQ0FBQztBQUVwSCxPQUFPLEVBQUMsV0FBVyxFQUFFLCtCQUErQixFQUFFLHVCQUF1QixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDckcsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQWEsZUFBZSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDckUsT0FBTyxFQUFDLGlCQUFpQixFQUFFLFdBQVcsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzdFLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUMxRCxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0RSxPQUFPLEVBQUMsWUFBWSxFQUFFLFdBQVcsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzVELE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMzRSxPQUFPLEVBQUMsc0JBQXNCLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUVqRixPQUFPLEVBQUMsV0FBVyxFQUFFLGVBQWUsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUN6RCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUMzRCxPQUFPLEVBQVUsV0FBVyxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRTdDLE9BQU8sRUFBQyxh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ZSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzFGLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO0FBRXRELFNBQVMsZ0JBQWdCLENBQUMsSUFBZTtJQUN2QyxPQUFPLElBQUksWUFBWSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztBQUNwRSxDQUFDO0FBRUQsTUFBTSxVQUFVLHVCQUF1QixDQUF1QyxLQUFVO0lBQ3RGLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFFOUIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO1FBQ3JCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDakMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNwQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLEdBQVE7SUFDakMsSUFBSSxHQUFHLFlBQVksYUFBYSxFQUFFO1FBQ2hDLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDO0tBQ2Y7SUFDRCxPQUFPLEdBQUcsWUFBWSxTQUFTLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUGlwZVN1bW1hcnksIENvbXBpbGVUb2tlbk1ldGFkYXRhLCBDb21waWxlVHlwZU1ldGFkYXRhLCBpZGVudGlmaWVyTmFtZX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7Q29tcGlsZXJDb25maWd9IGZyb20gJy4uL2NvbmZpZyc7XG5pbXBvcnQge1NjaGVtYU1ldGFkYXRhfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBFbXB0eUV4cHIsIFBhcnNlZEV2ZW50LCBQYXJzZWRQcm9wZXJ0eSwgUGFyc2VkVmFyaWFibGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCB7SWRlbnRpZmllcnMsIGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2UsIGNyZWF0ZVRva2VuRm9yUmVmZXJlbmNlfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyLCBQYXJzZVRyZWVSZXN1bHR9IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge3JlbW92ZVdoaXRlc3BhY2VzLCByZXBsYWNlTmdzcH0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtleHBhbmROb2Rlc30gZnJvbSAnLi4vbWxfcGFyc2VyL2ljdV9hc3RfZXhwYW5kZXInO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtpc05nVGVtcGxhdGUsIHNwbGl0TnNOYW1lfSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlRXJyb3JMZXZlbCwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UHJvdmlkZXJFbGVtZW50Q29udGV4dCwgUHJvdmlkZXJWaWV3Q29udGV4dH0gZnJvbSAnLi4vcHJvdmlkZXJfYW5hbHl6ZXInO1xuaW1wb3J0IHtFbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uL3NjaGVtYS9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uL3NlbGVjdG9yJztcbmltcG9ydCB7aXNTdHlsZVVybFJlc29sdmFibGV9IGZyb20gJy4uL3N0eWxlX3VybF9yZXNvbHZlcic7XG5pbXBvcnQge0NvbnNvbGUsIHN5bnRheEVycm9yfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi90ZW1wbGF0ZV9hc3QnO1xuaW1wb3J0IHtQcmVwYXJzZWRFbGVtZW50VHlwZSwgcHJlcGFyc2VFbGVtZW50fSBmcm9tICcuL3RlbXBsYXRlX3ByZXBhcnNlcic7XG5cbmNvbnN0IEJJTkRfTkFNRV9SRUdFWFAgPVxuICAgIC9eKD86KD86KD86KGJpbmQtKXwobGV0LSl8KHJlZi18Iyl8KG9uLSl8KGJpbmRvbi0pfChAKSkoLispKXxcXFtcXCgoW15cXCldKylcXClcXF18XFxbKFteXFxdXSspXFxdfFxcKChbXlxcKV0rKVxcKSkkLztcblxuLy8gR3JvdXAgMSA9IFwiYmluZC1cIlxuY29uc3QgS1dfQklORF9JRFggPSAxO1xuLy8gR3JvdXAgMiA9IFwibGV0LVwiXG5jb25zdCBLV19MRVRfSURYID0gMjtcbi8vIEdyb3VwIDMgPSBcInJlZi0vI1wiXG5jb25zdCBLV19SRUZfSURYID0gMztcbi8vIEdyb3VwIDQgPSBcIm9uLVwiXG5jb25zdCBLV19PTl9JRFggPSA0O1xuLy8gR3JvdXAgNSA9IFwiYmluZG9uLVwiXG5jb25zdCBLV19CSU5ET05fSURYID0gNTtcbi8vIEdyb3VwIDYgPSBcIkBcIlxuY29uc3QgS1dfQVRfSURYID0gNjtcbi8vIEdyb3VwIDcgPSB0aGUgaWRlbnRpZmllciBhZnRlciBcImJpbmQtXCIsIFwibGV0LVwiLCBcInJlZi0vI1wiLCBcIm9uLVwiLCBcImJpbmRvbi1cIiBvciBcIkBcIlxuY29uc3QgSURFTlRfS1dfSURYID0gNztcbi8vIEdyb3VwIDggPSBpZGVudGlmaWVyIGluc2lkZSBbKCldXG5jb25zdCBJREVOVF9CQU5BTkFfQk9YX0lEWCA9IDg7XG4vLyBHcm91cCA5ID0gaWRlbnRpZmllciBpbnNpZGUgW11cbmNvbnN0IElERU5UX1BST1BFUlRZX0lEWCA9IDk7XG4vLyBHcm91cCAxMCA9IGlkZW50aWZpZXIgaW5zaWRlICgpXG5jb25zdCBJREVOVF9FVkVOVF9JRFggPSAxMDtcblxuY29uc3QgVEVNUExBVEVfQVRUUl9QUkVGSVggPSAnKic7XG5jb25zdCBDTEFTU19BVFRSID0gJ2NsYXNzJztcblxubGV0IF9URVhUX0NTU19TRUxFQ1RPUiAhOiBDc3NTZWxlY3RvcjtcbmZ1bmN0aW9uIFRFWFRfQ1NTX1NFTEVDVE9SKCk6IENzc1NlbGVjdG9yIHtcbiAgaWYgKCFfVEVYVF9DU1NfU0VMRUNUT1IpIHtcbiAgICBfVEVYVF9DU1NfU0VMRUNUT1IgPSBDc3NTZWxlY3Rvci5wYXJzZSgnKicpWzBdO1xuICB9XG4gIHJldHVybiBfVEVYVF9DU1NfU0VMRUNUT1I7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVBhcnNlRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwpIHtcbiAgICBzdXBlcihzcGFuLCBtZXNzYWdlLCBsZXZlbCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUFzdD86IHQuVGVtcGxhdGVBc3RbXSwgcHVibGljIHVzZWRQaXBlcz86IENvbXBpbGVQaXBlU3VtbWFyeVtdLFxuICAgICAgcHVibGljIGVycm9ycz86IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9jb25maWc6IENvbXBpbGVyQ29uZmlnLCBwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgICBwcml2YXRlIF9leHByUGFyc2VyOiBQYXJzZXIsIHByaXZhdGUgX3NjaGVtYVJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksXG4gICAgICBwcml2YXRlIF9odG1sUGFyc2VyOiBIdG1sUGFyc2VyLCBwcml2YXRlIF9jb25zb2xlOiBDb25zb2xlLFxuICAgICAgcHVibGljIHRyYW5zZm9ybXM6IHQuVGVtcGxhdGVBc3RWaXNpdG9yW10pIHt9XG5cbiAgcHVibGljIGdldCBleHByZXNzaW9uUGFyc2VyKCkgeyByZXR1cm4gdGhpcy5fZXhwclBhcnNlcjsgfVxuXG4gIHBhcnNlKFxuICAgICAgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHRlbXBsYXRlOiBzdHJpbmd8UGFyc2VUcmVlUmVzdWx0LFxuICAgICAgZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdLCBzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdLFxuICAgICAgdGVtcGxhdGVVcmw6IHN0cmluZyxcbiAgICAgIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW4pOiB7dGVtcGxhdGU6IHQuVGVtcGxhdGVBc3RbXSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdfSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy50cnlQYXJzZShcbiAgICAgICAgY29tcG9uZW50LCB0ZW1wbGF0ZSwgZGlyZWN0aXZlcywgcGlwZXMsIHNjaGVtYXMsIHRlbXBsYXRlVXJsLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzKTtcbiAgICBjb25zdCB3YXJuaW5ncyA9IHJlc3VsdC5lcnJvcnMgIS5maWx0ZXIoZXJyb3IgPT4gZXJyb3IubGV2ZWwgPT09IFBhcnNlRXJyb3JMZXZlbC5XQVJOSU5HKTtcblxuICAgIGNvbnN0IGVycm9ycyA9IHJlc3VsdC5lcnJvcnMgIS5maWx0ZXIoZXJyb3IgPT4gZXJyb3IubGV2ZWwgPT09IFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG5cbiAgICBpZiAod2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fY29uc29sZS53YXJuKGBUZW1wbGF0ZSBwYXJzZSB3YXJuaW5nczpcXG4ke3dhcm5pbmdzLmpvaW4oJ1xcbicpfWApO1xuICAgIH1cblxuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZXJyb3JTdHJpbmcgPSBlcnJvcnMuam9pbignXFxuJyk7XG4gICAgICB0aHJvdyBzeW50YXhFcnJvcihgVGVtcGxhdGUgcGFyc2UgZXJyb3JzOlxcbiR7ZXJyb3JTdHJpbmd9YCwgZXJyb3JzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge3RlbXBsYXRlOiByZXN1bHQudGVtcGxhdGVBc3QgISwgcGlwZXM6IHJlc3VsdC51c2VkUGlwZXMgIX07XG4gIH1cblxuICB0cnlQYXJzZShcbiAgICAgIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCB0ZW1wbGF0ZTogc3RyaW5nfFBhcnNlVHJlZVJlc3VsdCxcbiAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSwgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSxcbiAgICAgIHRlbXBsYXRlVXJsOiBzdHJpbmcsIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW4pOiBUZW1wbGF0ZVBhcnNlUmVzdWx0IHtcbiAgICBsZXQgaHRtbFBhcnNlUmVzdWx0ID0gdHlwZW9mIHRlbXBsYXRlID09PSAnc3RyaW5nJyA/XG4gICAgICAgIHRoaXMuX2h0bWxQYXJzZXIgIS5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwsIHtcbiAgICAgICAgICB0b2tlbml6ZUV4cGFuc2lvbkZvcm1zOiB0cnVlLFxuICAgICAgICAgIGludGVycG9sYXRpb25Db25maWc6IHRoaXMuZ2V0SW50ZXJwb2xhdGlvbkNvbmZpZyhjb21wb25lbnQpXG4gICAgICAgIH0pIDpcbiAgICAgICAgdGVtcGxhdGU7XG5cbiAgICBpZiAoIXByZXNlcnZlV2hpdGVzcGFjZXMpIHtcbiAgICAgIGh0bWxQYXJzZVJlc3VsdCA9IHJlbW92ZVdoaXRlc3BhY2VzKGh0bWxQYXJzZVJlc3VsdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudHJ5UGFyc2VIdG1sKFxuICAgICAgICB0aGlzLmV4cGFuZEh0bWwoaHRtbFBhcnNlUmVzdWx0KSwgY29tcG9uZW50LCBkaXJlY3RpdmVzLCBwaXBlcywgc2NoZW1hcyk7XG4gIH1cblxuICB0cnlQYXJzZUh0bWwoXG4gICAgICBodG1sQXN0V2l0aEVycm9yczogUGFyc2VUcmVlUmVzdWx0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSxcbiAgICAgIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10pOiBUZW1wbGF0ZVBhcnNlUmVzdWx0IHtcbiAgICBsZXQgcmVzdWx0OiB0LlRlbXBsYXRlQXN0W107XG4gICAgY29uc3QgZXJyb3JzID0gaHRtbEFzdFdpdGhFcnJvcnMuZXJyb3JzO1xuICAgIGNvbnN0IHVzZWRQaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10gPSBbXTtcbiAgICBpZiAoaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHVuaXFEaXJlY3RpdmVzID0gcmVtb3ZlU3VtbWFyeUR1cGxpY2F0ZXMoZGlyZWN0aXZlcyk7XG4gICAgICBjb25zdCB1bmlxUGlwZXMgPSByZW1vdmVTdW1tYXJ5RHVwbGljYXRlcyhwaXBlcyk7XG4gICAgICBjb25zdCBwcm92aWRlclZpZXdDb250ZXh0ID0gbmV3IFByb3ZpZGVyVmlld0NvbnRleHQodGhpcy5fcmVmbGVjdG9yLCBjb21wb25lbnQpO1xuICAgICAgbGV0IGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSB1bmRlZmluZWQgITtcbiAgICAgIGlmIChjb21wb25lbnQudGVtcGxhdGUgJiYgY29tcG9uZW50LnRlbXBsYXRlLmludGVycG9sYXRpb24pIHtcbiAgICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZyA9IHtcbiAgICAgICAgICBzdGFydDogY29tcG9uZW50LnRlbXBsYXRlLmludGVycG9sYXRpb25bMF0sXG4gICAgICAgICAgZW5kOiBjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvblsxXVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgY29uc3QgYmluZGluZ1BhcnNlciA9IG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgICAgIHRoaXMuX2V4cHJQYXJzZXIsIGludGVycG9sYXRpb25Db25maWcgISwgdGhpcy5fc2NoZW1hUmVnaXN0cnksIHVuaXFQaXBlcywgZXJyb3JzKTtcbiAgICAgIGNvbnN0IHBhcnNlVmlzaXRvciA9IG5ldyBUZW1wbGF0ZVBhcnNlVmlzaXRvcihcbiAgICAgICAgICB0aGlzLl9yZWZsZWN0b3IsIHRoaXMuX2NvbmZpZywgcHJvdmlkZXJWaWV3Q29udGV4dCwgdW5pcURpcmVjdGl2ZXMsIGJpbmRpbmdQYXJzZXIsXG4gICAgICAgICAgdGhpcy5fc2NoZW1hUmVnaXN0cnksIHNjaGVtYXMsIGVycm9ycyk7XG4gICAgICByZXN1bHQgPSBodG1sLnZpc2l0QWxsKHBhcnNlVmlzaXRvciwgaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzLCBFTVBUWV9FTEVNRU5UX0NPTlRFWFQpO1xuICAgICAgZXJyb3JzLnB1c2goLi4ucHJvdmlkZXJWaWV3Q29udGV4dC5lcnJvcnMpO1xuICAgICAgdXNlZFBpcGVzLnB1c2goLi4uYmluZGluZ1BhcnNlci5nZXRVc2VkUGlwZXMoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IFtdO1xuICAgIH1cbiAgICB0aGlzLl9hc3NlcnROb1JlZmVyZW5jZUR1cGxpY2F0aW9uT25UZW1wbGF0ZShyZXN1bHQsIGVycm9ycyk7XG5cbiAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBuZXcgVGVtcGxhdGVQYXJzZVJlc3VsdChyZXN1bHQsIHVzZWRQaXBlcywgZXJyb3JzKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICB0aGlzLnRyYW5zZm9ybXMuZm9yRWFjaChcbiAgICAgICAgICAodHJhbnNmb3JtOiB0LlRlbXBsYXRlQXN0VmlzaXRvcikgPT4geyByZXN1bHQgPSB0LnRlbXBsYXRlVmlzaXRBbGwodHJhbnNmb3JtLCByZXN1bHQpOyB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRlbXBsYXRlUGFyc2VSZXN1bHQocmVzdWx0LCB1c2VkUGlwZXMsIGVycm9ycyk7XG4gIH1cblxuICBleHBhbmRIdG1sKGh0bWxBc3RXaXRoRXJyb3JzOiBQYXJzZVRyZWVSZXN1bHQsIGZvcmNlZDogYm9vbGVhbiA9IGZhbHNlKTogUGFyc2VUcmVlUmVzdWx0IHtcbiAgICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IGh0bWxBc3RXaXRoRXJyb3JzLmVycm9ycztcblxuICAgIGlmIChlcnJvcnMubGVuZ3RoID09IDAgfHwgZm9yY2VkKSB7XG4gICAgICAvLyBUcmFuc2Zvcm0gSUNVIG1lc3NhZ2VzIHRvIGFuZ3VsYXIgZGlyZWN0aXZlc1xuICAgICAgY29uc3QgZXhwYW5kZWRIdG1sQXN0ID0gZXhwYW5kTm9kZXMoaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzKTtcbiAgICAgIGVycm9ycy5wdXNoKC4uLmV4cGFuZGVkSHRtbEFzdC5lcnJvcnMpO1xuICAgICAgaHRtbEFzdFdpdGhFcnJvcnMgPSBuZXcgUGFyc2VUcmVlUmVzdWx0KGV4cGFuZGVkSHRtbEFzdC5ub2RlcywgZXJyb3JzKTtcbiAgICB9XG4gICAgcmV0dXJuIGh0bWxBc3RXaXRoRXJyb3JzO1xuICB9XG5cbiAgZ2V0SW50ZXJwb2xhdGlvbkNvbmZpZyhjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSk6IEludGVycG9sYXRpb25Db25maWd8dW5kZWZpbmVkIHtcbiAgICBpZiAoY29tcG9uZW50LnRlbXBsYXRlKSB7XG4gICAgICByZXR1cm4gSW50ZXJwb2xhdGlvbkNvbmZpZy5mcm9tQXJyYXkoY29tcG9uZW50LnRlbXBsYXRlLmludGVycG9sYXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfYXNzZXJ0Tm9SZWZlcmVuY2VEdXBsaWNhdGlvbk9uVGVtcGxhdGUocmVzdWx0OiB0LlRlbXBsYXRlQXN0W10sIGVycm9yczogVGVtcGxhdGVQYXJzZUVycm9yW10pOlxuICAgICAgdm9pZCB7XG4gICAgY29uc3QgZXhpc3RpbmdSZWZlcmVuY2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgcmVzdWx0LmZpbHRlcihlbGVtZW50ID0+ICEhKDxhbnk+ZWxlbWVudCkucmVmZXJlbmNlcylcbiAgICAgICAgLmZvckVhY2goZWxlbWVudCA9PiAoPGFueT5lbGVtZW50KS5yZWZlcmVuY2VzLmZvckVhY2goKHJlZmVyZW5jZTogdC5SZWZlcmVuY2VBc3QpID0+IHtcbiAgICAgICAgICBjb25zdCBuYW1lID0gcmVmZXJlbmNlLm5hbWU7XG4gICAgICAgICAgaWYgKGV4aXN0aW5nUmVmZXJlbmNlcy5pbmRleE9mKG5hbWUpIDwgMCkge1xuICAgICAgICAgICAgZXhpc3RpbmdSZWZlcmVuY2VzLnB1c2gobmFtZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFRlbXBsYXRlUGFyc2VFcnJvcihcbiAgICAgICAgICAgICAgICBgUmVmZXJlbmNlIFwiIyR7bmFtZX1cIiBpcyBkZWZpbmVkIHNldmVyYWwgdGltZXNgLCByZWZlcmVuY2Uuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICBQYXJzZUVycm9yTGV2ZWwuRVJST1IpO1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkpO1xuICB9XG59XG5cbmNsYXNzIFRlbXBsYXRlUGFyc2VWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgc2VsZWN0b3JNYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcigpO1xuICBkaXJlY3RpdmVzSW5kZXggPSBuZXcgTWFwPENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBudW1iZXI+KCk7XG4gIG5nQ29udGVudENvdW50ID0gMDtcbiAgY29udGVudFF1ZXJ5U3RhcnRJZDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsIHByaXZhdGUgY29uZmlnOiBDb21waWxlckNvbmZpZyxcbiAgICAgIHB1YmxpYyBwcm92aWRlclZpZXdDb250ZXh0OiBQcm92aWRlclZpZXdDb250ZXh0LCBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLFxuICAgICAgcHJpdmF0ZSBfYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgcHJpdmF0ZSBfc2NoZW1hUmVnaXN0cnk6IEVsZW1lbnRTY2hlbWFSZWdpc3RyeSxcbiAgICAgIHByaXZhdGUgX3NjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10sIHByaXZhdGUgX3RhcmdldEVycm9yczogVGVtcGxhdGVQYXJzZUVycm9yW10pIHtcbiAgICAvLyBOb3RlOiBxdWVyaWVzIHN0YXJ0IHdpdGggaWQgMSBzbyB3ZSBjYW4gdXNlIHRoZSBudW1iZXIgaW4gYSBCbG9vbSBmaWx0ZXIhXG4gICAgdGhpcy5jb250ZW50UXVlcnlTdGFydElkID0gcHJvdmlkZXJWaWV3Q29udGV4dC5jb21wb25lbnQudmlld1F1ZXJpZXMubGVuZ3RoICsgMTtcbiAgICBkaXJlY3RpdmVzLmZvckVhY2goKGRpcmVjdGl2ZSwgaW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gQ3NzU2VsZWN0b3IucGFyc2UoZGlyZWN0aXZlLnNlbGVjdG9yICEpO1xuICAgICAgdGhpcy5zZWxlY3Rvck1hdGNoZXIuYWRkU2VsZWN0YWJsZXMoc2VsZWN0b3IsIGRpcmVjdGl2ZSk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZXNJbmRleC5zZXQoZGlyZWN0aXZlLCBpbmRleCk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KFRFWFRfQ1NTX1NFTEVDVE9SKCkpICE7XG4gICAgY29uc3QgdmFsdWVOb05nc3AgPSByZXBsYWNlTmdzcCh0ZXh0LnZhbHVlKTtcbiAgICBjb25zdCBleHByID0gdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUludGVycG9sYXRpb24odmFsdWVOb05nc3AsIHRleHQuc291cmNlU3BhbiAhKTtcbiAgICByZXR1cm4gZXhwciA/IG5ldyB0LkJvdW5kVGV4dEFzdChleHByLCBuZ0NvbnRlbnRJbmRleCwgdGV4dC5zb3VyY2VTcGFuICEpIDpcbiAgICAgICAgICAgICAgICAgIG5ldyB0LlRleHRBc3QodmFsdWVOb05nc3AsIG5nQ29udGVudEluZGV4LCB0ZXh0LnNvdXJjZVNwYW4gISk7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBuZXcgdC5BdHRyQXN0KGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcXVlcnlTdGFydEluZGV4ID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgIGNvbnN0IGVsTmFtZSA9IGVsZW1lbnQubmFtZTtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQgJiZcbiAgICAgICAgaXNTdHlsZVVybFJlc29sdmFibGUocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cikpIHtcbiAgICAgIC8vIFNraXBwaW5nIHN0eWxlc2hlZXRzIHdpdGggZWl0aGVyIHJlbGF0aXZlIHVybHMgb3IgcGFja2FnZSBzY2hlbWUgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgIC8vIHRoZW0gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCBlbGVtZW50T3JEaXJlY3RpdmVQcm9wczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGVsZW1lbnRPckRpcmVjdGl2ZVJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdID0gW107XG4gICAgY29uc3QgZWxlbWVudFZhcnM6IHQuVmFyaWFibGVBc3RbXSA9IFtdO1xuICAgIGNvbnN0IGV2ZW50czogdC5Cb3VuZEV2ZW50QXN0W10gPSBbXTtcblxuICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudE9yRGlyZWN0aXZlUHJvcHM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZU1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZUVsZW1lbnRWYXJzOiB0LlZhcmlhYmxlQXN0W10gPSBbXTtcblxuICAgIGxldCBoYXNJbmxpbmVUZW1wbGF0ZXMgPSBmYWxzZTtcbiAgICBjb25zdCBhdHRyczogdC5BdHRyQXN0W10gPSBbXTtcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgZWxlbWVudC5hdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgY29uc3QgcGFyc2VkVmFyaWFibGVzOiBQYXJzZWRWYXJpYWJsZVtdID0gW107XG4gICAgICBjb25zdCBoYXNCaW5kaW5nID0gdGhpcy5fcGFyc2VBdHRyKFxuICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBhdHRyLCBtYXRjaGFibGVBdHRycywgZWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsIGV2ZW50cyxcbiAgICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50VmFycyk7XG4gICAgICBlbGVtZW50VmFycy5wdXNoKC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAodiA9PiB0LlZhcmlhYmxlQXN0LmZyb21QYXJzZWRWYXJpYWJsZSh2KSkpO1xuXG4gICAgICBsZXQgdGVtcGxhdGVWYWx1ZTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGxldCB0ZW1wbGF0ZUtleTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gdGhpcy5fbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyLm5hbWUpO1xuXG4gICAgICBpZiAobm9ybWFsaXplZE5hbWUuc3RhcnRzV2l0aChURU1QTEFURV9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgdGVtcGxhdGVWYWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICAgIHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhhc1RlbXBsYXRlQmluZGluZyA9IHRlbXBsYXRlVmFsdWUgIT0gbnVsbDtcbiAgICAgIGlmIChoYXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgaWYgKGhhc0lubGluZVRlbXBsYXRlcykge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgQ2FuJ3QgaGF2ZSBtdWx0aXBsZSB0ZW1wbGF0ZSBiaW5kaW5ncyBvbiBvbmUgZWxlbWVudC4gVXNlIG9ubHkgb25lIGF0dHJpYnV0ZSBwcmVmaXhlZCB3aXRoICpgLFxuICAgICAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICAgIGhhc0lubGluZVRlbXBsYXRlcyA9IHRydWU7XG4gICAgICAgIGNvbnN0IHBhcnNlZFZhcmlhYmxlczogUGFyc2VkVmFyaWFibGVbXSA9IFtdO1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlSW5saW5lVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgICAgdGVtcGxhdGVLZXkgISwgdGVtcGxhdGVWYWx1ZSAhLCBhdHRyLnNvdXJjZVNwYW4sIHRlbXBsYXRlTWF0Y2hhYmxlQXR0cnMsXG4gICAgICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCBwYXJzZWRWYXJpYWJsZXMpO1xuICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRWYXJzLnB1c2goLi4ucGFyc2VkVmFyaWFibGVzLm1hcCh2ID0+IHQuVmFyaWFibGVBc3QuZnJvbVBhcnNlZFZhcmlhYmxlKHYpKSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaGFzVGVtcGxhdGVCaW5kaW5nKSB7XG4gICAgICAgIC8vIGRvbid0IGluY2x1ZGUgdGhlIGJpbmRpbmdzIGFzIGF0dHJpYnV0ZXMgYXMgd2VsbCBpbiB0aGUgQVNUXG4gICAgICAgIGF0dHJzLnB1c2godGhpcy52aXNpdEF0dHJpYnV0ZShhdHRyLCBudWxsKSk7XG4gICAgICAgIG1hdGNoYWJsZUF0dHJzLnB1c2goW2F0dHIubmFtZSwgYXR0ci52YWx1ZV0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgZWxlbWVudENzc1NlbGVjdG9yID0gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKGVsTmFtZSwgbWF0Y2hhYmxlQXR0cnMpO1xuICAgIGNvbnN0IHtkaXJlY3RpdmVzOiBkaXJlY3RpdmVNZXRhcywgbWF0Y2hFbGVtZW50fSA9XG4gICAgICAgIHRoaXMuX3BhcnNlRGlyZWN0aXZlcyh0aGlzLnNlbGVjdG9yTWF0Y2hlciwgZWxlbWVudENzc1NlbGVjdG9yKTtcbiAgICBjb25zdCByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZUFzdFtdID0gW107XG4gICAgY29uc3QgYm91bmREaXJlY3RpdmVQcm9wTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkaXJlY3RpdmVBc3RzID0gdGhpcy5fY3JlYXRlRGlyZWN0aXZlQXN0cyhcbiAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQsIGVsZW1lbnQubmFtZSwgZGlyZWN0aXZlTWV0YXMsIGVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLFxuICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50LnNvdXJjZVNwYW4gISwgcmVmZXJlbmNlcywgYm91bmREaXJlY3RpdmVQcm9wTmFtZXMpO1xuICAgIGNvbnN0IGVsZW1lbnRQcm9wczogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdID0gdGhpcy5fY3JlYXRlRWxlbWVudFByb3BlcnR5QXN0cyhcbiAgICAgICAgZWxlbWVudC5uYW1lLCBlbGVtZW50T3JEaXJlY3RpdmVQcm9wcywgYm91bmREaXJlY3RpdmVQcm9wTmFtZXMpO1xuICAgIGNvbnN0IGlzVmlld1Jvb3QgPSBwYXJlbnQuaXNUZW1wbGF0ZUVsZW1lbnQgfHwgaGFzSW5saW5lVGVtcGxhdGVzO1xuXG4gICAgY29uc3QgcHJvdmlkZXJDb250ZXh0ID0gbmV3IFByb3ZpZGVyRWxlbWVudENvbnRleHQoXG4gICAgICAgIHRoaXMucHJvdmlkZXJWaWV3Q29udGV4dCwgcGFyZW50LnByb3ZpZGVyQ29udGV4dCAhLCBpc1ZpZXdSb290LCBkaXJlY3RpdmVBc3RzLCBhdHRycyxcbiAgICAgICAgcmVmZXJlbmNlcywgaXNUZW1wbGF0ZUVsZW1lbnQsIHF1ZXJ5U3RhcnRJbmRleCwgZWxlbWVudC5zb3VyY2VTcGFuICEpO1xuXG4gICAgY29uc3QgY2hpbGRyZW46IHQuVGVtcGxhdGVBc3RbXSA9IGh0bWwudmlzaXRBbGwoXG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQubm9uQmluZGFibGUgPyBOT05fQklOREFCTEVfVklTSVRPUiA6IHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4sXG4gICAgICAgIEVsZW1lbnRDb250ZXh0LmNyZWF0ZShcbiAgICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBkaXJlY3RpdmVBc3RzLFxuICAgICAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQgPyBwYXJlbnQucHJvdmlkZXJDb250ZXh0ICEgOiBwcm92aWRlckNvbnRleHQpKTtcbiAgICBwcm92aWRlckNvbnRleHQuYWZ0ZXJFbGVtZW50KCk7XG4gICAgLy8gT3ZlcnJpZGUgdGhlIGFjdHVhbCBzZWxlY3RvciB3aGVuIHRoZSBgbmdQcm9qZWN0QXNgIGF0dHJpYnV0ZSBpcyBwcm92aWRlZFxuICAgIGNvbnN0IHByb2plY3Rpb25TZWxlY3RvciA9IHByZXBhcnNlZEVsZW1lbnQucHJvamVjdEFzICE9ICcnID9cbiAgICAgICAgQ3NzU2VsZWN0b3IucGFyc2UocHJlcGFyc2VkRWxlbWVudC5wcm9qZWN0QXMpWzBdIDpcbiAgICAgICAgZWxlbWVudENzc1NlbGVjdG9yO1xuICAgIGNvbnN0IG5nQ29udGVudEluZGV4ID0gcGFyZW50LmZpbmROZ0NvbnRlbnRJbmRleChwcm9qZWN0aW9uU2VsZWN0b3IpICE7XG4gICAgbGV0IHBhcnNlZEVsZW1lbnQ6IHQuVGVtcGxhdGVBc3Q7XG5cbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UKSB7XG4gICAgICAvLyBgPG5nLWNvbnRlbnQ+YCBlbGVtZW50XG4gICAgICBpZiAoZWxlbWVudC5jaGlsZHJlbiAmJiAhZWxlbWVudC5jaGlsZHJlbi5ldmVyeShfaXNFbXB0eVRleHROb2RlKSkge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihgPG5nLWNvbnRlbnQ+IGVsZW1lbnQgY2Fubm90IGhhdmUgY29udGVudC5gLCBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG4gICAgICB9XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5OZ0NvbnRlbnRBc3QoXG4gICAgICAgICAgdGhpcy5uZ0NvbnRlbnRDb3VudCsrLCBoYXNJbmxpbmVUZW1wbGF0ZXMgPyBudWxsICEgOiBuZ0NvbnRlbnRJbmRleCxcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG4gICAgfSBlbHNlIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgLy8gYDxuZy10ZW1wbGF0ZT5gIGVsZW1lbnRcbiAgICAgIHRoaXMuX2Fzc2VydEFsbEV2ZW50c1B1Ymxpc2hlZEJ5RGlyZWN0aXZlcyhkaXJlY3RpdmVBc3RzLCBldmVudHMpO1xuICAgICAgdGhpcy5fYXNzZXJ0Tm9Db21wb25lbnRzTm9yRWxlbWVudEJpbmRpbmdzT25UZW1wbGF0ZShcbiAgICAgICAgICBkaXJlY3RpdmVBc3RzLCBlbGVtZW50UHJvcHMsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcblxuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LkVtYmVkZGVkVGVtcGxhdGVBc3QoXG4gICAgICAgICAgYXR0cnMsIGV2ZW50cywgcmVmZXJlbmNlcywgZWxlbWVudFZhcnMsIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZERpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybVByb3ZpZGVycywgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lcixcbiAgICAgICAgICBwcm92aWRlckNvbnRleHQucXVlcnlNYXRjaGVzLCBjaGlsZHJlbiwgaGFzSW5saW5lVGVtcGxhdGVzID8gbnVsbCAhIDogbmdDb250ZW50SW5kZXgsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuICEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBlbGVtZW50IG90aGVyIHRoYW4gYDxuZy1jb250ZW50PmAgYW5kIGA8bmctdGVtcGxhdGU+YFxuICAgICAgdGhpcy5fYXNzZXJ0RWxlbWVudEV4aXN0cyhtYXRjaEVsZW1lbnQsIGVsZW1lbnQpO1xuICAgICAgdGhpcy5fYXNzZXJ0T25seU9uZUNvbXBvbmVudChkaXJlY3RpdmVBc3RzLCBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG5cbiAgICAgIGNvbnN0IG5nQ29udGVudEluZGV4ID1cbiAgICAgICAgICBoYXNJbmxpbmVUZW1wbGF0ZXMgPyBudWxsIDogcGFyZW50LmZpbmROZ0NvbnRlbnRJbmRleChwcm9qZWN0aW9uU2VsZWN0b3IpO1xuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LkVsZW1lbnRBc3QoXG4gICAgICAgICAgZWxOYW1lLCBhdHRycywgZWxlbWVudFByb3BzLCBldmVudHMsIHJlZmVyZW5jZXMsIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZERpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybVByb3ZpZGVycywgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lcixcbiAgICAgICAgICBwcm92aWRlckNvbnRleHQucXVlcnlNYXRjaGVzLCBjaGlsZHJlbiwgaGFzSW5saW5lVGVtcGxhdGVzID8gbnVsbCA6IG5nQ29udGVudEluZGV4LFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IG51bGwpO1xuICAgIH1cblxuICAgIGlmIChoYXNJbmxpbmVUZW1wbGF0ZXMpIHtcbiAgICAgIC8vIFRoZSBlbGVtZW50IGFzIGEgKi1hdHRyaWJ1dGVcbiAgICAgIGNvbnN0IHRlbXBsYXRlUXVlcnlTdGFydEluZGV4ID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgICAgY29uc3QgdGVtcGxhdGVTZWxlY3RvciA9IGNyZWF0ZUVsZW1lbnRDc3NTZWxlY3RvcignbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZU1hdGNoYWJsZUF0dHJzKTtcbiAgICAgIGNvbnN0IHtkaXJlY3RpdmVzfSA9IHRoaXMuX3BhcnNlRGlyZWN0aXZlcyh0aGlzLnNlbGVjdG9yTWF0Y2hlciwgdGVtcGxhdGVTZWxlY3Rvcik7XG4gICAgICBjb25zdCB0ZW1wbGF0ZUJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBjb25zdCB0ZW1wbGF0ZURpcmVjdGl2ZUFzdHMgPSB0aGlzLl9jcmVhdGVEaXJlY3RpdmVBc3RzKFxuICAgICAgICAgIHRydWUsIGVsTmFtZSwgZGlyZWN0aXZlcywgdGVtcGxhdGVFbGVtZW50T3JEaXJlY3RpdmVQcm9wcywgW10sIGVsZW1lbnQuc291cmNlU3BhbiAhLCBbXSxcbiAgICAgICAgICB0ZW1wbGF0ZUJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10gPSB0aGlzLl9jcmVhdGVFbGVtZW50UHJvcGVydHlBc3RzKFxuICAgICAgICAgIGVsTmFtZSwgdGVtcGxhdGVFbGVtZW50T3JEaXJlY3RpdmVQcm9wcywgdGVtcGxhdGVCb3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgICB0aGlzLl9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgICAgIHRlbXBsYXRlRGlyZWN0aXZlQXN0cywgdGVtcGxhdGVFbGVtZW50UHJvcHMsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0ID0gbmV3IFByb3ZpZGVyRWxlbWVudENvbnRleHQoXG4gICAgICAgICAgdGhpcy5wcm92aWRlclZpZXdDb250ZXh0LCBwYXJlbnQucHJvdmlkZXJDb250ZXh0ICEsIHBhcmVudC5pc1RlbXBsYXRlRWxlbWVudCxcbiAgICAgICAgICB0ZW1wbGF0ZURpcmVjdGl2ZUFzdHMsIFtdLCBbXSwgdHJ1ZSwgdGVtcGxhdGVRdWVyeVN0YXJ0SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICAgIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LmFmdGVyRWxlbWVudCgpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRW1iZWRkZWRUZW1wbGF0ZUFzdChcbiAgICAgICAgICBbXSwgW10sIFtdLCB0ZW1wbGF0ZUVsZW1lbnRWYXJzLCB0ZW1wbGF0ZVByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZERpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgdGVtcGxhdGVQcm92aWRlckNvbnRleHQudHJhbnNmb3JtUHJvdmlkZXJzLFxuICAgICAgICAgIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lciwgdGVtcGxhdGVQcm92aWRlckNvbnRleHQucXVlcnlNYXRjaGVzLFxuICAgICAgICAgIFtwYXJzZWRFbGVtZW50XSwgbmdDb250ZW50SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyc2VkRWxlbWVudDtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQXR0cihcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBhdHRyOiBodG1sLkF0dHJpYnV0ZSwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sXG4gICAgICB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSwgdGFyZ2V0RXZlbnRzOiB0LkJvdW5kRXZlbnRBc3RbXSxcbiAgICAgIHRhcmdldFJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdLCB0YXJnZXRWYXJzOiB0LlZhcmlhYmxlQXN0W10pOiBib29sZWFuIHtcbiAgICBjb25zdCBuYW1lID0gdGhpcy5fbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyLm5hbWUpO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0ci52YWx1ZTtcbiAgICBjb25zdCBzcmNTcGFuID0gYXR0ci5zb3VyY2VTcGFuO1xuXG4gICAgY29uc3QgYm91bmRFdmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICBjb25zdCBiaW5kUGFydHMgPSBuYW1lLm1hdGNoKEJJTkRfTkFNRV9SRUdFWFApO1xuICAgIGxldCBoYXNCaW5kaW5nID0gZmFsc2U7XG5cbiAgICBpZiAoYmluZFBhcnRzICE9PSBudWxsKSB7XG4gICAgICBoYXNCaW5kaW5nID0gdHJ1ZTtcbiAgICAgIGlmIChiaW5kUGFydHNbS1dfQklORF9JRFhdICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0xFVF9JRFhdKSB7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgICB0aGlzLl9wYXJzZVZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCB0YXJnZXRWYXJzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCJsZXQtXCIgaXMgb25seSBzdXBwb3J0ZWQgb24gbmctdGVtcGxhdGUgZWxlbWVudHMuYCwgc3JjU3Bhbik7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfUkVGX0lEWF0pIHtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICB0aGlzLl9wYXJzZVJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0UmVmcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX09OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQklORE9OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICAgIHRoaXMuX3BhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQVRfSURYXSkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICAgICAgdGFyZ2V0UHJvcHMpO1xuICAgICAgICB0aGlzLl9wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX1BST1BFUlRZX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsXG4gICAgICAgICAgICB0YXJnZXRQcm9wcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX0VWRU5UX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0VWRU5UX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaGFzQmluZGluZyA9IHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUludGVycG9sYXRpb24oXG4gICAgICAgICAgbmFtZSwgdmFsdWUsIHNyY1NwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgfVxuXG4gICAgaWYgKCFoYXNCaW5kaW5nKSB7XG4gICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIobmFtZSwgdmFsdWUsIHNyY1NwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgfVxuXG4gICAgdGFyZ2V0RXZlbnRzLnB1c2goLi4uYm91bmRFdmVudHMubWFwKGUgPT4gdC5Cb3VuZEV2ZW50QXN0LmZyb21QYXJzZWRFdmVudChlKSkpO1xuXG4gICAgcmV0dXJuIGhhc0JpbmRpbmc7XG4gIH1cblxuICBwcml2YXRlIF9ub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHJOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiAvXmRhdGEtL2kudGVzdChhdHRyTmFtZSkgPyBhdHRyTmFtZS5zdWJzdHJpbmcoNSkgOiBhdHRyTmFtZTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlVmFyaWFibGUoXG4gICAgICBpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgdGFyZ2V0VmFyczogdC5WYXJpYWJsZUFzdFtdKSB7XG4gICAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGBcIi1cIiBpcyBub3QgYWxsb3dlZCBpbiB2YXJpYWJsZSBuYW1lc2AsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHRhcmdldFZhcnMucHVzaChuZXcgdC5WYXJpYWJsZUFzdChpZGVudGlmaWVyLCB2YWx1ZSwgc291cmNlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VSZWZlcmVuY2UoXG4gICAgICBpZGVudGlmaWVyOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldFJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdKSB7XG4gICAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGBcIi1cIiBpcyBub3QgYWxsb3dlZCBpbiByZWZlcmVuY2UgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICB0YXJnZXRSZWZzLnB1c2gobmV3IEVsZW1lbnRPckRpcmVjdGl2ZVJlZihpZGVudGlmaWVyLCB2YWx1ZSwgc291cmNlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICBuYW1lOiBzdHJpbmcsIGV4cHJlc3Npb246IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLCB0YXJnZXRFdmVudHM6IFBhcnNlZEV2ZW50W10pIHtcbiAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlRXZlbnQoXG4gICAgICAgIGAke25hbWV9Q2hhbmdlYCwgYCR7ZXhwcmVzc2lvbn09JGV2ZW50YCwgc291cmNlU3BhbiwgdmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgdGFyZ2V0RXZlbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlRGlyZWN0aXZlcyhzZWxlY3Rvck1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlciwgZWxlbWVudENzc1NlbGVjdG9yOiBDc3NTZWxlY3Rvcik6XG4gICAgICB7ZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSwgbWF0Y2hFbGVtZW50OiBib29sZWFufSB7XG4gICAgLy8gTmVlZCB0byBzb3J0IHRoZSBkaXJlY3RpdmVzIHNvIHRoYXQgd2UgZ2V0IGNvbnNpc3RlbnQgcmVzdWx0cyB0aHJvdWdob3V0LFxuICAgIC8vIGFzIHNlbGVjdG9yTWF0Y2hlciB1c2VzIE1hcHMgaW5zaWRlLlxuICAgIC8vIEFsc28gZGVkdXBsaWNhdGUgZGlyZWN0aXZlcyBhcyB0aGV5IG1pZ2h0IG1hdGNoIG1vcmUgdGhhbiBvbmUgdGltZSFcbiAgICBjb25zdCBkaXJlY3RpdmVzID0gbmV3IEFycmF5KHRoaXMuZGlyZWN0aXZlc0luZGV4LnNpemUpO1xuICAgIC8vIFdoZXRoZXIgYW55IGRpcmVjdGl2ZSBzZWxlY3RvciBtYXRjaGVzIG9uIHRoZSBlbGVtZW50IG5hbWVcbiAgICBsZXQgbWF0Y2hFbGVtZW50ID0gZmFsc2U7XG5cbiAgICBzZWxlY3Rvck1hdGNoZXIubWF0Y2goZWxlbWVudENzc1NlbGVjdG9yLCAoc2VsZWN0b3IsIGRpcmVjdGl2ZSkgPT4ge1xuICAgICAgZGlyZWN0aXZlc1t0aGlzLmRpcmVjdGl2ZXNJbmRleC5nZXQoZGlyZWN0aXZlKSAhXSA9IGRpcmVjdGl2ZTtcbiAgICAgIG1hdGNoRWxlbWVudCA9IG1hdGNoRWxlbWVudCB8fCBzZWxlY3Rvci5oYXNFbGVtZW50U2VsZWN0b3IoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBkaXJlY3RpdmVzOiBkaXJlY3RpdmVzLmZpbHRlcihkaXIgPT4gISFkaXIpLFxuICAgICAgbWF0Y2hFbGVtZW50LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVEaXJlY3RpdmVBc3RzKFxuICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIGVsZW1lbnROYW1lOiBzdHJpbmcsIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sXG4gICAgICBwcm9wczogUGFyc2VkUHJvcGVydHlbXSwgZWxlbWVudE9yRGlyZWN0aXZlUmVmczogRWxlbWVudE9yRGlyZWN0aXZlUmVmW10sXG4gICAgICBlbGVtZW50U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB0YXJnZXRSZWZlcmVuY2VzOiB0LlJlZmVyZW5jZUFzdFtdLFxuICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXM6IFNldDxzdHJpbmc+KTogdC5EaXJlY3RpdmVBc3RbXSB7XG4gICAgY29uc3QgbWF0Y2hlZFJlZmVyZW5jZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBsZXQgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSA9IG51bGwgITtcblxuICAgIGNvbnN0IGRpcmVjdGl2ZUFzdHMgPSBkaXJlY3RpdmVzLm1hcCgoZGlyZWN0aXZlKSA9PiB7XG4gICAgICBjb25zdCBzb3VyY2VTcGFuID0gbmV3IFBhcnNlU291cmNlU3BhbihcbiAgICAgICAgICBlbGVtZW50U291cmNlU3Bhbi5zdGFydCwgZWxlbWVudFNvdXJjZVNwYW4uZW5kLFxuICAgICAgICAgIGBEaXJlY3RpdmUgJHtpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSl9YCk7XG5cbiAgICAgIGlmIChkaXJlY3RpdmUuaXNDb21wb25lbnQpIHtcbiAgICAgICAgY29tcG9uZW50ID0gZGlyZWN0aXZlO1xuICAgICAgfVxuICAgICAgY29uc3QgZGlyZWN0aXZlUHJvcGVydGllczogdC5Cb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0W10gPSBbXTtcbiAgICAgIGNvbnN0IGJvdW5kUHJvcGVydGllcyA9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0UHJvcGVydHlBc3RzKGRpcmVjdGl2ZSwgZWxlbWVudE5hbWUsIHNvdXJjZVNwYW4pICE7XG5cbiAgICAgIGxldCBob3N0UHJvcGVydGllcyA9XG4gICAgICAgICAgYm91bmRQcm9wZXJ0aWVzLm1hcChwcm9wID0+IHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3QuZnJvbUJvdW5kUHJvcGVydHkocHJvcCkpO1xuICAgICAgLy8gTm90ZTogV2UgbmVlZCB0byBjaGVjayB0aGUgaG9zdCBwcm9wZXJ0aWVzIGhlcmUgYXMgd2VsbCxcbiAgICAgIC8vIGFzIHdlIGRvbid0IGtub3cgdGhlIGVsZW1lbnQgbmFtZSBpbiB0aGUgRGlyZWN0aXZlV3JhcHBlckNvbXBpbGVyIHlldC5cbiAgICAgIGhvc3RQcm9wZXJ0aWVzID0gdGhpcy5fY2hlY2tQcm9wZXJ0aWVzSW5TY2hlbWEoZWxlbWVudE5hbWUsIGhvc3RQcm9wZXJ0aWVzKTtcbiAgICAgIGNvbnN0IHBhcnNlZEV2ZW50cyA9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpcmVjdGl2ZSwgc291cmNlU3BhbikgITtcbiAgICAgIHRoaXMuX2NyZWF0ZURpcmVjdGl2ZVByb3BlcnR5QXN0cyhcbiAgICAgICAgICBkaXJlY3RpdmUuaW5wdXRzLCBwcm9wcywgZGlyZWN0aXZlUHJvcGVydGllcywgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXMpO1xuICAgICAgZWxlbWVudE9yRGlyZWN0aXZlUmVmcy5mb3JFYWNoKChlbE9yRGlyUmVmKSA9PiB7XG4gICAgICAgIGlmICgoZWxPckRpclJlZi52YWx1ZS5sZW5ndGggPT09IDAgJiYgZGlyZWN0aXZlLmlzQ29tcG9uZW50KSB8fFxuICAgICAgICAgICAgKGVsT3JEaXJSZWYuaXNSZWZlcmVuY2VUb0RpcmVjdGl2ZShkaXJlY3RpdmUpKSkge1xuICAgICAgICAgIHRhcmdldFJlZmVyZW5jZXMucHVzaChuZXcgdC5SZWZlcmVuY2VBc3QoXG4gICAgICAgICAgICAgIGVsT3JEaXJSZWYubmFtZSwgY3JlYXRlVG9rZW5Gb3JSZWZlcmVuY2UoZGlyZWN0aXZlLnR5cGUucmVmZXJlbmNlKSwgZWxPckRpclJlZi52YWx1ZSxcbiAgICAgICAgICAgICAgZWxPckRpclJlZi5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgbWF0Y2hlZFJlZmVyZW5jZXMuYWRkKGVsT3JEaXJSZWYubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgY29uc3QgaG9zdEV2ZW50cyA9IHBhcnNlZEV2ZW50cy5tYXAoZSA9PiB0LkJvdW5kRXZlbnRBc3QuZnJvbVBhcnNlZEV2ZW50KGUpKTtcbiAgICAgIGNvbnN0IGNvbnRlbnRRdWVyeVN0YXJ0SWQgPSB0aGlzLmNvbnRlbnRRdWVyeVN0YXJ0SWQ7XG4gICAgICB0aGlzLmNvbnRlbnRRdWVyeVN0YXJ0SWQgKz0gZGlyZWN0aXZlLnF1ZXJpZXMubGVuZ3RoO1xuICAgICAgcmV0dXJuIG5ldyB0LkRpcmVjdGl2ZUFzdChcbiAgICAgICAgICBkaXJlY3RpdmUsIGRpcmVjdGl2ZVByb3BlcnRpZXMsIGhvc3RQcm9wZXJ0aWVzLCBob3N0RXZlbnRzLCBjb250ZW50UXVlcnlTdGFydElkLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH0pO1xuXG4gICAgZWxlbWVudE9yRGlyZWN0aXZlUmVmcy5mb3JFYWNoKChlbE9yRGlyUmVmKSA9PiB7XG4gICAgICBpZiAoZWxPckRpclJlZi52YWx1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGlmICghbWF0Y2hlZFJlZmVyZW5jZXMuaGFzKGVsT3JEaXJSZWYubmFtZSkpIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYFRoZXJlIGlzIG5vIGRpcmVjdGl2ZSB3aXRoIFwiZXhwb3J0QXNcIiBzZXQgdG8gXCIke2VsT3JEaXJSZWYudmFsdWV9XCJgLFxuICAgICAgICAgICAgICBlbE9yRGlyUmVmLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFjb21wb25lbnQpIHtcbiAgICAgICAgbGV0IHJlZlRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSA9IG51bGwgITtcbiAgICAgICAgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAgICAgcmVmVG9rZW4gPSBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHRoaXMucmVmbGVjdG9yLCBJZGVudGlmaWVycy5UZW1wbGF0ZVJlZik7XG4gICAgICAgIH1cbiAgICAgICAgdGFyZ2V0UmVmZXJlbmNlcy5wdXNoKFxuICAgICAgICAgICAgbmV3IHQuUmVmZXJlbmNlQXN0KGVsT3JEaXJSZWYubmFtZSwgcmVmVG9rZW4sIGVsT3JEaXJSZWYudmFsdWUsIGVsT3JEaXJSZWYuc291cmNlU3BhbikpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkaXJlY3RpdmVBc3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRGlyZWN0aXZlUHJvcGVydHlBc3RzKFxuICAgICAgZGlyZWN0aXZlUHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sIGJvdW5kUHJvcHM6IFBhcnNlZFByb3BlcnR5W10sXG4gICAgICB0YXJnZXRCb3VuZERpcmVjdGl2ZVByb3BzOiB0LkJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3RbXSxcbiAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzOiBTZXQ8c3RyaW5nPikge1xuICAgIGlmIChkaXJlY3RpdmVQcm9wZXJ0aWVzKSB7XG4gICAgICBjb25zdCBib3VuZFByb3BzQnlOYW1lID0gbmV3IE1hcDxzdHJpbmcsIFBhcnNlZFByb3BlcnR5PigpO1xuICAgICAgYm91bmRQcm9wcy5mb3JFYWNoKGJvdW5kUHJvcCA9PiB7XG4gICAgICAgIGNvbnN0IHByZXZWYWx1ZSA9IGJvdW5kUHJvcHNCeU5hbWUuZ2V0KGJvdW5kUHJvcC5uYW1lKTtcbiAgICAgICAgaWYgKCFwcmV2VmFsdWUgfHwgcHJldlZhbHVlLmlzTGl0ZXJhbCkge1xuICAgICAgICAgIC8vIGdpdmUgW2FdPVwiYlwiIGEgaGlnaGVyIHByZWNlZGVuY2UgdGhhbiBhPVwiYlwiIG9uIHRoZSBzYW1lIGVsZW1lbnRcbiAgICAgICAgICBib3VuZFByb3BzQnlOYW1lLnNldChib3VuZFByb3AubmFtZSwgYm91bmRQcm9wKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIE9iamVjdC5rZXlzKGRpcmVjdGl2ZVByb3BlcnRpZXMpLmZvckVhY2goZGlyUHJvcCA9PiB7XG4gICAgICAgIGNvbnN0IGVsUHJvcCA9IGRpcmVjdGl2ZVByb3BlcnRpZXNbZGlyUHJvcF07XG4gICAgICAgIGNvbnN0IGJvdW5kUHJvcCA9IGJvdW5kUHJvcHNCeU5hbWUuZ2V0KGVsUHJvcCk7XG5cbiAgICAgICAgLy8gQmluZGluZ3MgYXJlIG9wdGlvbmFsLCBzbyB0aGlzIGJpbmRpbmcgb25seSBuZWVkcyB0byBiZSBzZXQgdXAgaWYgYW4gZXhwcmVzc2lvbiBpcyBnaXZlbi5cbiAgICAgICAgaWYgKGJvdW5kUHJvcCkge1xuICAgICAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzLmFkZChib3VuZFByb3AubmFtZSk7XG4gICAgICAgICAgaWYgKCFpc0VtcHR5RXhwcmVzc2lvbihib3VuZFByb3AuZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcHMucHVzaChuZXcgdC5Cb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0KFxuICAgICAgICAgICAgICAgIGRpclByb3AsIGJvdW5kUHJvcC5uYW1lLCBib3VuZFByb3AuZXhwcmVzc2lvbiwgYm91bmRQcm9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZUVsZW1lbnRQcm9wZXJ0eUFzdHMoXG4gICAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBwcm9wczogUGFyc2VkUHJvcGVydHlbXSxcbiAgICAgIGJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzOiBTZXQ8c3RyaW5nPik6IHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSB7XG4gICAgY29uc3QgYm91bmRFbGVtZW50UHJvcHM6IHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSA9IFtdO1xuXG4gICAgcHJvcHMuZm9yRWFjaCgocHJvcDogUGFyc2VkUHJvcGVydHkpID0+IHtcbiAgICAgIGlmICghcHJvcC5pc0xpdGVyYWwgJiYgIWJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzLmhhcyhwcm9wLm5hbWUpKSB7XG4gICAgICAgIGNvbnN0IGJvdW5kUHJvcCA9IHRoaXMuX2JpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoZWxlbWVudE5hbWUsIHByb3ApO1xuICAgICAgICBib3VuZEVsZW1lbnRQcm9wcy5wdXNoKHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3QuZnJvbUJvdW5kUHJvcGVydHkoYm91bmRQcm9wKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuX2NoZWNrUHJvcGVydGllc0luU2NoZW1hKGVsZW1lbnROYW1lLCBib3VuZEVsZW1lbnRQcm9wcyk7XG4gIH1cblxuICBwcml2YXRlIF9maW5kQ29tcG9uZW50RGlyZWN0aXZlcyhkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdKTogdC5EaXJlY3RpdmVBc3RbXSB7XG4gICAgcmV0dXJuIGRpcmVjdGl2ZXMuZmlsdGVyKGRpcmVjdGl2ZSA9PiBkaXJlY3RpdmUuZGlyZWN0aXZlLmlzQ29tcG9uZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRDb21wb25lbnREaXJlY3RpdmVOYW1lcyhkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLl9maW5kQ29tcG9uZW50RGlyZWN0aXZlcyhkaXJlY3RpdmVzKVxuICAgICAgICAubWFwKGRpcmVjdGl2ZSA9PiBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUuZGlyZWN0aXZlLnR5cGUpICEpO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXNzZXJ0T25seU9uZUNvbXBvbmVudChkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBjb25zdCBjb21wb25lbnRUeXBlTmFtZXMgPSB0aGlzLl9maW5kQ29tcG9uZW50RGlyZWN0aXZlTmFtZXMoZGlyZWN0aXZlcyk7XG4gICAgaWYgKGNvbXBvbmVudFR5cGVOYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgTW9yZSB0aGFuIG9uZSBjb21wb25lbnQgbWF0Y2hlZCBvbiB0aGlzIGVsZW1lbnQuXFxuYCArXG4gICAgICAgICAgICAgIGBNYWtlIHN1cmUgdGhhdCBvbmx5IG9uZSBjb21wb25lbnQncyBzZWxlY3RvciBjYW4gbWF0Y2ggYSBnaXZlbiBlbGVtZW50LlxcbmAgK1xuICAgICAgICAgICAgICBgQ29uZmxpY3RpbmcgY29tcG9uZW50czogJHtjb21wb25lbnRUeXBlTmFtZXMuam9pbignLCcpfWAsXG4gICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1ha2Ugc3VyZSB0aGF0IG5vbi1hbmd1bGFyIHRhZ3MgY29uZm9ybSB0byB0aGUgc2NoZW1hcy5cbiAgICpcbiAgICogTm90ZTogQW4gZWxlbWVudCBpcyBjb25zaWRlcmVkIGFuIGFuZ3VsYXIgdGFnIHdoZW4gYXQgbGVhc3Qgb25lIGRpcmVjdGl2ZSBzZWxlY3RvciBtYXRjaGVzIHRoZVxuICAgKiB0YWcgbmFtZS5cbiAgICpcbiAgICogQHBhcmFtIG1hdGNoRWxlbWVudCBXaGV0aGVyIGFueSBkaXJlY3RpdmUgaGFzIG1hdGNoZWQgb24gdGhlIHRhZyBuYW1lXG4gICAqIEBwYXJhbSBlbGVtZW50IHRoZSBodG1sIGVsZW1lbnRcbiAgICovXG4gIHByaXZhdGUgX2Fzc2VydEVsZW1lbnRFeGlzdHMobWF0Y2hFbGVtZW50OiBib29sZWFuLCBlbGVtZW50OiBodG1sLkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbE5hbWUgPSBlbGVtZW50Lm5hbWUucmVwbGFjZSgvXjp4aHRtbDovLCAnJyk7XG5cbiAgICBpZiAoIW1hdGNoRWxlbWVudCAmJiAhdGhpcy5fc2NoZW1hUmVnaXN0cnkuaGFzRWxlbWVudChlbE5hbWUsIHRoaXMuX3NjaGVtYXMpKSB7XG4gICAgICBsZXQgZXJyb3JNc2cgPSBgJyR7ZWxOYW1lfScgaXMgbm90IGEga25vd24gZWxlbWVudDpcXG5gO1xuICAgICAgZXJyb3JNc2cgKz1cbiAgICAgICAgICBgMS4gSWYgJyR7ZWxOYW1lfScgaXMgYW4gQW5ndWxhciBjb21wb25lbnQsIHRoZW4gdmVyaWZ5IHRoYXQgaXQgaXMgcGFydCBvZiB0aGlzIG1vZHVsZS5cXG5gO1xuICAgICAgaWYgKGVsTmFtZS5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgICBlcnJvck1zZyArPVxuICAgICAgICAgICAgYDIuIElmICcke2VsTmFtZX0nIGlzIGEgV2ViIENvbXBvbmVudCB0aGVuIGFkZCAnQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQgdG8gc3VwcHJlc3MgdGhpcyBtZXNzYWdlLmA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlcnJvck1zZyArPVxuICAgICAgICAgICAgYDIuIFRvIGFsbG93IGFueSBlbGVtZW50IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVycm9yTXNnLCBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXNzZXJ0Tm9Db21wb25lbnRzTm9yRWxlbWVudEJpbmRpbmdzT25UZW1wbGF0ZShcbiAgICAgIGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10sIGVsZW1lbnRQcm9wczogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdLFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgY29uc3QgY29tcG9uZW50VHlwZU5hbWVzOiBzdHJpbmdbXSA9IHRoaXMuX2ZpbmRDb21wb25lbnREaXJlY3RpdmVOYW1lcyhkaXJlY3RpdmVzKTtcbiAgICBpZiAoY29tcG9uZW50VHlwZU5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBDb21wb25lbnRzIG9uIGFuIGVtYmVkZGVkIHRlbXBsYXRlOiAke2NvbXBvbmVudFR5cGVOYW1lcy5qb2luKCcsJyl9YCwgc291cmNlU3Bhbik7XG4gICAgfVxuICAgIGVsZW1lbnRQcm9wcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYFByb3BlcnR5IGJpbmRpbmcgJHtwcm9wLm5hbWV9IG5vdCB1c2VkIGJ5IGFueSBkaXJlY3RpdmUgb24gYW4gZW1iZWRkZWQgdGVtcGxhdGUuIE1ha2Ugc3VyZSB0aGF0IHRoZSBwcm9wZXJ0eSBuYW1lIGlzIHNwZWxsZWQgY29ycmVjdGx5IGFuZCBhbGwgZGlyZWN0aXZlcyBhcmUgbGlzdGVkIGluIHRoZSBcIkBOZ01vZHVsZS5kZWNsYXJhdGlvbnNcIi5gLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXNzZXJ0QWxsRXZlbnRzUHVibGlzaGVkQnlEaXJlY3RpdmVzKFxuICAgICAgZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSwgZXZlbnRzOiB0LkJvdW5kRXZlbnRBc3RbXSkge1xuICAgIGNvbnN0IGFsbERpcmVjdGl2ZUV2ZW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgZGlyZWN0aXZlcy5mb3JFYWNoKGRpcmVjdGl2ZSA9PiB7XG4gICAgICBPYmplY3Qua2V5cyhkaXJlY3RpdmUuZGlyZWN0aXZlLm91dHB1dHMpLmZvckVhY2goayA9PiB7XG4gICAgICAgIGNvbnN0IGV2ZW50TmFtZSA9IGRpcmVjdGl2ZS5kaXJlY3RpdmUub3V0cHV0c1trXTtcbiAgICAgICAgYWxsRGlyZWN0aXZlRXZlbnRzLmFkZChldmVudE5hbWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBldmVudHMuZm9yRWFjaChldmVudCA9PiB7XG4gICAgICBpZiAoZXZlbnQudGFyZ2V0ICE9IG51bGwgfHwgIWFsbERpcmVjdGl2ZUV2ZW50cy5oYXMoZXZlbnQubmFtZSkpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICBgRXZlbnQgYmluZGluZyAke2V2ZW50LmZ1bGxOYW1lfSBub3QgZW1pdHRlZCBieSBhbnkgZGlyZWN0aXZlIG9uIGFuIGVtYmVkZGVkIHRlbXBsYXRlLiBNYWtlIHN1cmUgdGhhdCB0aGUgZXZlbnQgbmFtZSBpcyBzcGVsbGVkIGNvcnJlY3RseSBhbmQgYWxsIGRpcmVjdGl2ZXMgYXJlIGxpc3RlZCBpbiB0aGUgXCJATmdNb2R1bGUuZGVjbGFyYXRpb25zXCIuYCxcbiAgICAgICAgICAgIGV2ZW50LnNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfY2hlY2tQcm9wZXJ0aWVzSW5TY2hlbWEoZWxlbWVudE5hbWU6IHN0cmluZywgYm91bmRQcm9wczogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdKTpcbiAgICAgIHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSB7XG4gICAgLy8gTm90ZTogV2UgY2FuJ3QgZmlsdGVyIG91dCBlbXB0eSBleHByZXNzaW9ucyBiZWZvcmUgdGhpcyBtZXRob2QsXG4gICAgLy8gYXMgd2Ugc3RpbGwgd2FudCB0byB2YWxpZGF0ZSB0aGVtIVxuICAgIHJldHVybiBib3VuZFByb3BzLmZpbHRlcigoYm91bmRQcm9wKSA9PiB7XG4gICAgICBpZiAoYm91bmRQcm9wLnR5cGUgPT09IHQuUHJvcGVydHlCaW5kaW5nVHlwZS5Qcm9wZXJ0eSAmJlxuICAgICAgICAgICF0aGlzLl9zY2hlbWFSZWdpc3RyeS5oYXNQcm9wZXJ0eShlbGVtZW50TmFtZSwgYm91bmRQcm9wLm5hbWUsIHRoaXMuX3NjaGVtYXMpKSB7XG4gICAgICAgIGxldCBlcnJvck1zZyA9XG4gICAgICAgICAgICBgQ2FuJ3QgYmluZCB0byAnJHtib3VuZFByb3AubmFtZX0nIHNpbmNlIGl0IGlzbid0IGEga25vd24gcHJvcGVydHkgb2YgJyR7ZWxlbWVudE5hbWV9Jy5gO1xuICAgICAgICBpZiAoZWxlbWVudE5hbWUuc3RhcnRzV2l0aCgnbmctJykpIHtcbiAgICAgICAgICBlcnJvck1zZyArPVxuICAgICAgICAgICAgICBgXFxuMS4gSWYgJyR7Ym91bmRQcm9wLm5hbWV9JyBpcyBhbiBBbmd1bGFyIGRpcmVjdGl2ZSwgdGhlbiBhZGQgJ0NvbW1vbk1vZHVsZScgdG8gdGhlICdATmdNb2R1bGUuaW1wb3J0cycgb2YgdGhpcyBjb21wb25lbnQuYCArXG4gICAgICAgICAgICAgIGBcXG4yLiBUbyBhbGxvdyBhbnkgcHJvcGVydHkgYWRkICdOT19FUlJPUlNfU0NIRU1BJyB0byB0aGUgJ0BOZ01vZHVsZS5zY2hlbWFzJyBvZiB0aGlzIGNvbXBvbmVudC5gO1xuICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnROYW1lLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgICAgZXJyb3JNc2cgKz1cbiAgICAgICAgICAgICAgYFxcbjEuIElmICcke2VsZW1lbnROYW1lfScgaXMgYW4gQW5ndWxhciBjb21wb25lbnQgYW5kIGl0IGhhcyAnJHtib3VuZFByb3AubmFtZX0nIGlucHV0LCB0aGVuIHZlcmlmeSB0aGF0IGl0IGlzIHBhcnQgb2YgdGhpcyBtb2R1bGUuYCArXG4gICAgICAgICAgICAgIGBcXG4yLiBJZiAnJHtlbGVtZW50TmFtZX0nIGlzIGEgV2ViIENvbXBvbmVudCB0aGVuIGFkZCAnQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQgdG8gc3VwcHJlc3MgdGhpcyBtZXNzYWdlLmAgK1xuICAgICAgICAgICAgICBgXFxuMy4gVG8gYWxsb3cgYW55IHByb3BlcnR5IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihlcnJvck1zZywgYm91bmRQcm9wLnNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuICFpc0VtcHR5RXhwcmVzc2lvbihib3VuZFByb3AudmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLl90YXJnZXRFcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBtZXNzYWdlLCBsZXZlbCkpO1xuICB9XG59XG5cbmNsYXNzIE5vbkJpbmRhYmxlVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIHZpc2l0RWxlbWVudChhc3Q6IGh0bWwuRWxlbWVudCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IHQuRWxlbWVudEFzdHxudWxsIHtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGFzdCk7XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUIHx8XG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEUgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRVNIRUVUKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhbmQgc3R5bGVzaGVldHMgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWQgdGhlbVxuICAgICAgLy8gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGF0dHJOYW1lQW5kVmFsdWVzID0gYXN0LmF0dHJzLm1hcCgoYXR0cik6IFtzdHJpbmcsIHN0cmluZ10gPT4gW2F0dHIubmFtZSwgYXR0ci52YWx1ZV0pO1xuICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKGFzdC5uYW1lLCBhdHRyTmFtZUFuZFZhbHVlcyk7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KHNlbGVjdG9yKTtcbiAgICBjb25zdCBjaGlsZHJlbjogdC5UZW1wbGF0ZUFzdFtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuY2hpbGRyZW4sIEVNUFRZX0VMRU1FTlRfQ09OVEVYVCk7XG4gICAgcmV0dXJuIG5ldyB0LkVsZW1lbnRBc3QoXG4gICAgICAgIGFzdC5uYW1lLCBodG1sLnZpc2l0QWxsKHRoaXMsIGFzdC5hdHRycyksIFtdLCBbXSwgW10sIFtdLCBbXSwgZmFsc2UsIFtdLCBjaGlsZHJlbixcbiAgICAgICAgbmdDb250ZW50SW5kZXgsIGFzdC5zb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiB0LkF0dHJBc3Qge1xuICAgIHJldHVybiBuZXcgdC5BdHRyQXN0KGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIHBhcmVudDogRWxlbWVudENvbnRleHQpOiB0LlRleHRBc3Qge1xuICAgIGNvbnN0IG5nQ29udGVudEluZGV4ID0gcGFyZW50LmZpbmROZ0NvbnRlbnRJbmRleChURVhUX0NTU19TRUxFQ1RPUigpKSAhO1xuICAgIHJldHVybiBuZXcgdC5UZXh0QXN0KHRleHQudmFsdWUsIG5nQ29udGVudEluZGV4LCB0ZXh0LnNvdXJjZVNwYW4gISk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gZXhwYW5zaW9uOyB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGV4cGFuc2lvbkNhc2U7IH1cbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSB0byBhbiBlbGVtZW50IG9yIGRpcmVjdGl2ZSBpbiBhIHRlbXBsYXRlLiBFLmcuLCB0aGUgcmVmZXJlbmNlIGluIHRoaXMgdGVtcGxhdGU6XG4gKlxuICogPGRpdiAjbXlNZW51PVwiY29vbE1lbnVcIj5cbiAqXG4gKiB3b3VsZCBiZSB7bmFtZTogJ215TWVudScsIHZhbHVlOiAnY29vbE1lbnUnLCBzb3VyY2VTcGFuOiAuLi59XG4gKi9cbmNsYXNzIEVsZW1lbnRPckRpcmVjdGl2ZVJlZiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIC8qKiBHZXRzIHdoZXRoZXIgdGhpcyBpcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2l2ZW4gZGlyZWN0aXZlLiAqL1xuICBpc1JlZmVyZW5jZVRvRGlyZWN0aXZlKGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkpIHtcbiAgICByZXR1cm4gc3BsaXRFeHBvcnRBcyhkaXJlY3RpdmUuZXhwb3J0QXMpLmluZGV4T2YodGhpcy52YWx1ZSkgIT09IC0xO1xuICB9XG59XG5cbi8qKiBTcGxpdHMgYSByYXcsIHBvdGVudGlhbGx5IGNvbW1hLWRlbGltaXRlZCBgZXhwb3J0QXNgIHZhbHVlIGludG8gYW4gYXJyYXkgb2YgbmFtZXMuICovXG5mdW5jdGlvbiBzcGxpdEV4cG9ydEFzKGV4cG9ydEFzOiBzdHJpbmcgfCBudWxsKTogc3RyaW5nW10ge1xuICByZXR1cm4gZXhwb3J0QXMgPyBleHBvcnRBcy5zcGxpdCgnLCcpLm1hcChlID0+IGUudHJpbSgpKSA6IFtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRDbGFzc2VzKGNsYXNzQXR0clZhbHVlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBjbGFzc0F0dHJWYWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG59XG5cbmNsYXNzIEVsZW1lbnRDb250ZXh0IHtcbiAgc3RhdGljIGNyZWF0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdLFxuICAgICAgcHJvdmlkZXJDb250ZXh0OiBQcm92aWRlckVsZW1lbnRDb250ZXh0KTogRWxlbWVudENvbnRleHQge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gICAgbGV0IHdpbGRjYXJkTmdDb250ZW50SW5kZXg6IG51bWJlciA9IG51bGwgITtcbiAgICBjb25zdCBjb21wb25lbnQgPSBkaXJlY3RpdmVzLmZpbmQoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS5kaXJlY3RpdmUuaXNDb21wb25lbnQpO1xuICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgIGNvbnN0IG5nQ29udGVudFNlbGVjdG9ycyA9IGNvbXBvbmVudC5kaXJlY3RpdmUudGVtcGxhdGUgIS5uZ0NvbnRlbnRTZWxlY3RvcnM7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5nQ29udGVudFNlbGVjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBzZWxlY3RvciA9IG5nQ29udGVudFNlbGVjdG9yc1tpXTtcbiAgICAgICAgaWYgKHNlbGVjdG9yID09PSAnKicpIHtcbiAgICAgICAgICB3aWxkY2FyZE5nQ29udGVudEluZGV4ID0gaTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKG5nQ29udGVudFNlbGVjdG9yc1tpXSksIGkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgRWxlbWVudENvbnRleHQoaXNUZW1wbGF0ZUVsZW1lbnQsIG1hdGNoZXIsIHdpbGRjYXJkTmdDb250ZW50SW5kZXgsIHByb3ZpZGVyQ29udGV4dCk7XG4gIH1cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIHByaXZhdGUgX25nQ29udGVudEluZGV4TWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyLFxuICAgICAgcHJpdmF0ZSBfd2lsZGNhcmROZ0NvbnRlbnRJbmRleDogbnVtYmVyfG51bGwsXG4gICAgICBwdWJsaWMgcHJvdmlkZXJDb250ZXh0OiBQcm92aWRlckVsZW1lbnRDb250ZXh0fG51bGwpIHt9XG5cbiAgZmluZE5nQ29udGVudEluZGV4KHNlbGVjdG9yOiBDc3NTZWxlY3Rvcik6IG51bWJlcnxudWxsIHtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRpY2VzOiBudW1iZXJbXSA9IFtdO1xuICAgIHRoaXMuX25nQ29udGVudEluZGV4TWF0Y2hlci5tYXRjaChcbiAgICAgICAgc2VsZWN0b3IsIChzZWxlY3RvciwgbmdDb250ZW50SW5kZXgpID0+IHsgbmdDb250ZW50SW5kaWNlcy5wdXNoKG5nQ29udGVudEluZGV4KTsgfSk7XG4gICAgbmdDb250ZW50SW5kaWNlcy5zb3J0KCk7XG4gICAgaWYgKHRoaXMuX3dpbGRjYXJkTmdDb250ZW50SW5kZXggIT0gbnVsbCkge1xuICAgICAgbmdDb250ZW50SW5kaWNlcy5wdXNoKHRoaXMuX3dpbGRjYXJkTmdDb250ZW50SW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gbmdDb250ZW50SW5kaWNlcy5sZW5ndGggPiAwID8gbmdDb250ZW50SW5kaWNlc1swXSA6IG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnRDc3NTZWxlY3RvcihcbiAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBhdHRyaWJ1dGVzOiBbc3RyaW5nLCBzdHJpbmddW10pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsTmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbE5hbWVOb05zKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBhdHRyTmFtZSA9IGF0dHJpYnV0ZXNbaV1bMF07XG4gICAgY29uc3QgYXR0ck5hbWVOb05zID0gc3BsaXROc05hbWUoYXR0ck5hbWUpWzFdO1xuICAgIGNvbnN0IGF0dHJWYWx1ZSA9IGF0dHJpYnV0ZXNbaV1bMV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUoYXR0ck5hbWVOb05zLCBhdHRyVmFsdWUpO1xuICAgIGlmIChhdHRyTmFtZS50b0xvd2VyQ2FzZSgpID09IENMQVNTX0FUVFIpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSBzcGxpdENsYXNzZXMoYXR0clZhbHVlKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbmNvbnN0IEVNUFRZX0VMRU1FTlRfQ09OVEVYVCA9IG5ldyBFbGVtZW50Q29udGV4dCh0cnVlLCBuZXcgU2VsZWN0b3JNYXRjaGVyKCksIG51bGwsIG51bGwpO1xuY29uc3QgTk9OX0JJTkRBQkxFX1ZJU0lUT1IgPSBuZXcgTm9uQmluZGFibGVWaXNpdG9yKCk7XG5cbmZ1bmN0aW9uIF9pc0VtcHR5VGV4dE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5UZXh0ICYmIG5vZGUudmFsdWUudHJpbSgpLmxlbmd0aCA9PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlU3VtbWFyeUR1cGxpY2F0ZXM8VCBleHRlbmRze3R5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGF9PihpdGVtczogVFtdKTogVFtdIHtcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxhbnksIFQ+KCk7XG5cbiAgaXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgIGlmICghbWFwLmdldChpdGVtLnR5cGUucmVmZXJlbmNlKSkge1xuICAgICAgbWFwLnNldChpdGVtLnR5cGUucmVmZXJlbmNlLCBpdGVtKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKG1hcC52YWx1ZXMoKSk7XG59XG5cbmZ1bmN0aW9uIGlzRW1wdHlFeHByZXNzaW9uKGFzdDogQVNUKTogYm9vbGVhbiB7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBBU1RXaXRoU291cmNlKSB7XG4gICAgYXN0ID0gYXN0LmFzdDtcbiAgfVxuICByZXR1cm4gYXN0IGluc3RhbmNlb2YgRW1wdHlFeHByO1xufVxuIl19