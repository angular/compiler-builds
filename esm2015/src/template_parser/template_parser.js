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
import { newArray, syntaxError } from '../util';
import { BindingParser } from './binding_parser';
import * as t from './template_ast';
import { PreparsedElementType, preparseElement } from './template_preparser';
const BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.*))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
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
                const absoluteOffset = (attr.valueSpan || attr.sourceSpan).start.offset;
                this._bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attr.sourceSpan, absoluteOffset, templateMatchableAttrs, templateElementOrDirectiveProps, parsedVariables);
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
        const absoluteOffset = attr.valueSpan ? attr.valueSpan.start.offset : srcSpan.start.offset;
        const boundEvents = [];
        const bindParts = name.match(BIND_NAME_REGEXP);
        let hasBinding = false;
        if (bindParts !== null) {
            hasBinding = true;
            if (bindParts[KW_BIND_IDX] != null) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, absoluteOffset, attr.valueSpan, targetMatchableAttrs, targetProps);
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
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, absoluteOffset, attr.valueSpan, targetMatchableAttrs, targetProps);
                this._parseAssignmentEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attr.valueSpan || srcSpan, targetMatchableAttrs, boundEvents);
            }
            else if (bindParts[KW_AT_IDX]) {
                this._bindingParser.parseLiteralAttr(name, value, srcSpan, absoluteOffset, attr.valueSpan, targetMatchableAttrs, targetProps);
            }
            else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, absoluteOffset, attr.valueSpan, targetMatchableAttrs, targetProps);
                this._parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, attr.valueSpan || srcSpan, targetMatchableAttrs, boundEvents);
            }
            else if (bindParts[IDENT_PROPERTY_IDX]) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, absoluteOffset, attr.valueSpan, targetMatchableAttrs, targetProps);
            }
            else if (bindParts[IDENT_EVENT_IDX]) {
                this._bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, attr.valueSpan || srcSpan, targetMatchableAttrs, boundEvents);
            }
        }
        else {
            hasBinding = this._bindingParser.parsePropertyInterpolation(name, value, srcSpan, attr.valueSpan, targetMatchableAttrs, targetProps);
        }
        if (!hasBinding) {
            this._bindingParser.parseLiteralAttr(name, value, srcSpan, absoluteOffset, attr.valueSpan, targetMatchableAttrs, targetProps);
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
        else if (identifier.length === 0) {
            this._reportError(`Variable does not have a name`, sourceSpan);
        }
        targetVars.push(new t.VariableAst(identifier, value, sourceSpan));
    }
    _parseReference(identifier, value, sourceSpan, targetRefs) {
        if (identifier.indexOf('-') > -1) {
            this._reportError(`"-" is not allowed in reference names`, sourceSpan);
        }
        else if (identifier.length === 0) {
            this._reportError(`Reference does not have a name`, sourceSpan);
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
        const directives = newArray(this.directivesIndex.size);
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
            errorMsg += `1. If '${elName}' is an Angular component, then verify that it is part of this module.\n`;
            if (elName.indexOf('-') > -1) {
                errorMsg += `2. If '${elName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the '@NgModule.schemas' of this component to suppress this message.`;
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
                this._reportError(`Event binding ${event
                    .fullName} not emitted by any directive on an embedded template. Make sure that the event name is spelled correctly and all directives are listed in the "@NgModule.declarations".`, event.sourceSpan);
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
                    errorMsg += `\n1. If '${boundProp
                        .name}' is an Angular directive, then add 'CommonModule' to the '@NgModule.imports' of this component.` +
                        `\n2. To allow any property add 'NO_ERRORS_SCHEMA' to the '@NgModule.schemas' of this component.`;
                }
                else if (elementName.indexOf('-') > -1) {
                    errorMsg += `\n1. If '${elementName}' is an Angular component and it has '${boundProp.name}' input, then verify that it is part of this module.` +
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
export function isEmptyExpression(ast) {
    if (ast instanceof ASTWithSource) {
        ast = ast.ast;
    }
    return ast instanceof EmptyExpr;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFtSCxjQUFjLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUlySyxPQUFPLEVBQU0sYUFBYSxFQUFFLFNBQVMsRUFBOEMsTUFBTSwwQkFBMEIsQ0FBQztBQUVwSCxPQUFPLEVBQUMsV0FBVyxFQUFFLCtCQUErQixFQUFFLHVCQUF1QixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDckcsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQWEsZUFBZSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDckUsT0FBTyxFQUFDLGlCQUFpQixFQUFFLFdBQVcsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzdFLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUMxRCxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0RSxPQUFPLEVBQUMsWUFBWSxFQUFFLFdBQVcsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzVELE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMzRSxPQUFPLEVBQUMsc0JBQXNCLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUVqRixPQUFPLEVBQUMsV0FBVyxFQUFFLGVBQWUsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUN6RCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUMzRCxPQUFPLEVBQVUsUUFBUSxFQUFFLFdBQVcsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUV2RCxP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RyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFFOUIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO1FBQ3JCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDakMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNwQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFFRCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsR0FBUTtJQUN4QyxJQUFJLEdBQUcsWUFBWSxhQUFhLEVBQUU7UUFDaEMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUM7S0FDZjtJQUNELE9BQU8sR0FBRyxZQUFZLFNBQVMsQ0FBQztBQUNsQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVQaXBlU3VtbWFyeSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIENvbXBpbGVUeXBlTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtDb21waWxlckNvbmZpZ30gZnJvbSAnLi4vY29uZmlnJztcbmltcG9ydCB7U2NoZW1hTWV0YWRhdGF9IGZyb20gJy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFTVFdpdGhTb3VyY2UsIEVtcHR5RXhwciwgUGFyc2VkRXZlbnQsIFBhcnNlZFByb3BlcnR5LCBQYXJzZWRWYXJpYWJsZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7UGFyc2VyfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0IHtJZGVudGlmaWVycywgY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSwgY3JlYXRlVG9rZW5Gb3JSZWZlcmVuY2V9IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0h0bWxQYXJzZXIsIFBhcnNlVHJlZVJlc3VsdH0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmltcG9ydCB7cmVtb3ZlV2hpdGVzcGFjZXMsIHJlcGxhY2VOZ3NwfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge2V4cGFuZE5vZGVzfSBmcm9tICcuLi9tbF9wYXJzZXIvaWN1X2FzdF9leHBhbmRlcic7XG5pbXBvcnQge0ludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge2lzTmdUZW1wbGF0ZSwgc3BsaXROc05hbWV9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VFcnJvckxldmVsLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtQcm92aWRlckVsZW1lbnRDb250ZXh0LCBQcm92aWRlclZpZXdDb250ZXh0fSBmcm9tICcuLi9wcm92aWRlcl9hbmFseXplcic7XG5pbXBvcnQge0VsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vc2NoZW1hL2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtpc1N0eWxlVXJsUmVzb2x2YWJsZX0gZnJvbSAnLi4vc3R5bGVfdXJsX3Jlc29sdmVyJztcbmltcG9ydCB7Q29uc29sZSwgbmV3QXJyYXksIHN5bnRheEVycm9yfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi90ZW1wbGF0ZV9hc3QnO1xuaW1wb3J0IHtQcmVwYXJzZWRFbGVtZW50VHlwZSwgcHJlcGFyc2VFbGVtZW50fSBmcm9tICcuL3RlbXBsYXRlX3ByZXBhcnNlcic7XG5cbmNvbnN0IEJJTkRfTkFNRV9SRUdFWFAgPVxuICAgIC9eKD86KD86KD86KGJpbmQtKXwobGV0LSl8KHJlZi18Iyl8KG9uLSl8KGJpbmRvbi0pfChAKSkoLiopKXxcXFtcXCgoW15cXCldKylcXClcXF18XFxbKFteXFxdXSspXFxdfFxcKChbXlxcKV0rKVxcKSkkLztcblxuLy8gR3JvdXAgMSA9IFwiYmluZC1cIlxuY29uc3QgS1dfQklORF9JRFggPSAxO1xuLy8gR3JvdXAgMiA9IFwibGV0LVwiXG5jb25zdCBLV19MRVRfSURYID0gMjtcbi8vIEdyb3VwIDMgPSBcInJlZi0vI1wiXG5jb25zdCBLV19SRUZfSURYID0gMztcbi8vIEdyb3VwIDQgPSBcIm9uLVwiXG5jb25zdCBLV19PTl9JRFggPSA0O1xuLy8gR3JvdXAgNSA9IFwiYmluZG9uLVwiXG5jb25zdCBLV19CSU5ET05fSURYID0gNTtcbi8vIEdyb3VwIDYgPSBcIkBcIlxuY29uc3QgS1dfQVRfSURYID0gNjtcbi8vIEdyb3VwIDcgPSB0aGUgaWRlbnRpZmllciBhZnRlciBcImJpbmQtXCIsIFwibGV0LVwiLCBcInJlZi0vI1wiLCBcIm9uLVwiLCBcImJpbmRvbi1cIiBvciBcIkBcIlxuY29uc3QgSURFTlRfS1dfSURYID0gNztcbi8vIEdyb3VwIDggPSBpZGVudGlmaWVyIGluc2lkZSBbKCldXG5jb25zdCBJREVOVF9CQU5BTkFfQk9YX0lEWCA9IDg7XG4vLyBHcm91cCA5ID0gaWRlbnRpZmllciBpbnNpZGUgW11cbmNvbnN0IElERU5UX1BST1BFUlRZX0lEWCA9IDk7XG4vLyBHcm91cCAxMCA9IGlkZW50aWZpZXIgaW5zaWRlICgpXG5jb25zdCBJREVOVF9FVkVOVF9JRFggPSAxMDtcblxuY29uc3QgVEVNUExBVEVfQVRUUl9QUkVGSVggPSAnKic7XG5jb25zdCBDTEFTU19BVFRSID0gJ2NsYXNzJztcblxubGV0IF9URVhUX0NTU19TRUxFQ1RPUiAhOiBDc3NTZWxlY3RvcjtcbmZ1bmN0aW9uIFRFWFRfQ1NTX1NFTEVDVE9SKCk6IENzc1NlbGVjdG9yIHtcbiAgaWYgKCFfVEVYVF9DU1NfU0VMRUNUT1IpIHtcbiAgICBfVEVYVF9DU1NfU0VMRUNUT1IgPSBDc3NTZWxlY3Rvci5wYXJzZSgnKicpWzBdO1xuICB9XG4gIHJldHVybiBfVEVYVF9DU1NfU0VMRUNUT1I7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVBhcnNlRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwpIHtcbiAgICBzdXBlcihzcGFuLCBtZXNzYWdlLCBsZXZlbCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUFzdD86IHQuVGVtcGxhdGVBc3RbXSwgcHVibGljIHVzZWRQaXBlcz86IENvbXBpbGVQaXBlU3VtbWFyeVtdLFxuICAgICAgcHVibGljIGVycm9ycz86IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9jb25maWc6IENvbXBpbGVyQ29uZmlnLCBwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgICBwcml2YXRlIF9leHByUGFyc2VyOiBQYXJzZXIsIHByaXZhdGUgX3NjaGVtYVJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksXG4gICAgICBwcml2YXRlIF9odG1sUGFyc2VyOiBIdG1sUGFyc2VyLCBwcml2YXRlIF9jb25zb2xlOiBDb25zb2xlLFxuICAgICAgcHVibGljIHRyYW5zZm9ybXM6IHQuVGVtcGxhdGVBc3RWaXNpdG9yW10pIHt9XG5cbiAgcHVibGljIGdldCBleHByZXNzaW9uUGFyc2VyKCkgeyByZXR1cm4gdGhpcy5fZXhwclBhcnNlcjsgfVxuXG4gIHBhcnNlKFxuICAgICAgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHRlbXBsYXRlOiBzdHJpbmd8UGFyc2VUcmVlUmVzdWx0LFxuICAgICAgZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdLCBzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdLFxuICAgICAgdGVtcGxhdGVVcmw6IHN0cmluZyxcbiAgICAgIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW4pOiB7dGVtcGxhdGU6IHQuVGVtcGxhdGVBc3RbXSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdfSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy50cnlQYXJzZShcbiAgICAgICAgY29tcG9uZW50LCB0ZW1wbGF0ZSwgZGlyZWN0aXZlcywgcGlwZXMsIHNjaGVtYXMsIHRlbXBsYXRlVXJsLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzKTtcbiAgICBjb25zdCB3YXJuaW5ncyA9IHJlc3VsdC5lcnJvcnMgIS5maWx0ZXIoZXJyb3IgPT4gZXJyb3IubGV2ZWwgPT09IFBhcnNlRXJyb3JMZXZlbC5XQVJOSU5HKTtcblxuICAgIGNvbnN0IGVycm9ycyA9IHJlc3VsdC5lcnJvcnMgIS5maWx0ZXIoZXJyb3IgPT4gZXJyb3IubGV2ZWwgPT09IFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG5cbiAgICBpZiAod2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fY29uc29sZS53YXJuKGBUZW1wbGF0ZSBwYXJzZSB3YXJuaW5nczpcXG4ke3dhcm5pbmdzLmpvaW4oJ1xcbicpfWApO1xuICAgIH1cblxuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZXJyb3JTdHJpbmcgPSBlcnJvcnMuam9pbignXFxuJyk7XG4gICAgICB0aHJvdyBzeW50YXhFcnJvcihgVGVtcGxhdGUgcGFyc2UgZXJyb3JzOlxcbiR7ZXJyb3JTdHJpbmd9YCwgZXJyb3JzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge3RlbXBsYXRlOiByZXN1bHQudGVtcGxhdGVBc3QgISwgcGlwZXM6IHJlc3VsdC51c2VkUGlwZXMgIX07XG4gIH1cblxuICB0cnlQYXJzZShcbiAgICAgIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCB0ZW1wbGF0ZTogc3RyaW5nfFBhcnNlVHJlZVJlc3VsdCxcbiAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSwgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSxcbiAgICAgIHRlbXBsYXRlVXJsOiBzdHJpbmcsIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW4pOiBUZW1wbGF0ZVBhcnNlUmVzdWx0IHtcbiAgICBsZXQgaHRtbFBhcnNlUmVzdWx0ID0gdHlwZW9mIHRlbXBsYXRlID09PSAnc3RyaW5nJyA/XG4gICAgICAgIHRoaXMuX2h0bWxQYXJzZXIgIS5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwsIHtcbiAgICAgICAgICB0b2tlbml6ZUV4cGFuc2lvbkZvcm1zOiB0cnVlLFxuICAgICAgICAgIGludGVycG9sYXRpb25Db25maWc6IHRoaXMuZ2V0SW50ZXJwb2xhdGlvbkNvbmZpZyhjb21wb25lbnQpXG4gICAgICAgIH0pIDpcbiAgICAgICAgdGVtcGxhdGU7XG5cbiAgICBpZiAoIXByZXNlcnZlV2hpdGVzcGFjZXMpIHtcbiAgICAgIGh0bWxQYXJzZVJlc3VsdCA9IHJlbW92ZVdoaXRlc3BhY2VzKGh0bWxQYXJzZVJlc3VsdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudHJ5UGFyc2VIdG1sKFxuICAgICAgICB0aGlzLmV4cGFuZEh0bWwoaHRtbFBhcnNlUmVzdWx0KSwgY29tcG9uZW50LCBkaXJlY3RpdmVzLCBwaXBlcywgc2NoZW1hcyk7XG4gIH1cblxuICB0cnlQYXJzZUh0bWwoXG4gICAgICBodG1sQXN0V2l0aEVycm9yczogUGFyc2VUcmVlUmVzdWx0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSxcbiAgICAgIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10pOiBUZW1wbGF0ZVBhcnNlUmVzdWx0IHtcbiAgICBsZXQgcmVzdWx0OiB0LlRlbXBsYXRlQXN0W107XG4gICAgY29uc3QgZXJyb3JzID0gaHRtbEFzdFdpdGhFcnJvcnMuZXJyb3JzO1xuICAgIGNvbnN0IHVzZWRQaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10gPSBbXTtcbiAgICBpZiAoaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHVuaXFEaXJlY3RpdmVzID0gcmVtb3ZlU3VtbWFyeUR1cGxpY2F0ZXMoZGlyZWN0aXZlcyk7XG4gICAgICBjb25zdCB1bmlxUGlwZXMgPSByZW1vdmVTdW1tYXJ5RHVwbGljYXRlcyhwaXBlcyk7XG4gICAgICBjb25zdCBwcm92aWRlclZpZXdDb250ZXh0ID0gbmV3IFByb3ZpZGVyVmlld0NvbnRleHQodGhpcy5fcmVmbGVjdG9yLCBjb21wb25lbnQpO1xuICAgICAgbGV0IGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSB1bmRlZmluZWQgITtcbiAgICAgIGlmIChjb21wb25lbnQudGVtcGxhdGUgJiYgY29tcG9uZW50LnRlbXBsYXRlLmludGVycG9sYXRpb24pIHtcbiAgICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZyA9IHtcbiAgICAgICAgICBzdGFydDogY29tcG9uZW50LnRlbXBsYXRlLmludGVycG9sYXRpb25bMF0sXG4gICAgICAgICAgZW5kOiBjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvblsxXVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgY29uc3QgYmluZGluZ1BhcnNlciA9IG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgICAgIHRoaXMuX2V4cHJQYXJzZXIsIGludGVycG9sYXRpb25Db25maWcgISwgdGhpcy5fc2NoZW1hUmVnaXN0cnksIHVuaXFQaXBlcywgZXJyb3JzKTtcbiAgICAgIGNvbnN0IHBhcnNlVmlzaXRvciA9IG5ldyBUZW1wbGF0ZVBhcnNlVmlzaXRvcihcbiAgICAgICAgICB0aGlzLl9yZWZsZWN0b3IsIHRoaXMuX2NvbmZpZywgcHJvdmlkZXJWaWV3Q29udGV4dCwgdW5pcURpcmVjdGl2ZXMsIGJpbmRpbmdQYXJzZXIsXG4gICAgICAgICAgdGhpcy5fc2NoZW1hUmVnaXN0cnksIHNjaGVtYXMsIGVycm9ycyk7XG4gICAgICByZXN1bHQgPSBodG1sLnZpc2l0QWxsKHBhcnNlVmlzaXRvciwgaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzLCBFTVBUWV9FTEVNRU5UX0NPTlRFWFQpO1xuICAgICAgZXJyb3JzLnB1c2goLi4ucHJvdmlkZXJWaWV3Q29udGV4dC5lcnJvcnMpO1xuICAgICAgdXNlZFBpcGVzLnB1c2goLi4uYmluZGluZ1BhcnNlci5nZXRVc2VkUGlwZXMoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IFtdO1xuICAgIH1cbiAgICB0aGlzLl9hc3NlcnROb1JlZmVyZW5jZUR1cGxpY2F0aW9uT25UZW1wbGF0ZShyZXN1bHQsIGVycm9ycyk7XG5cbiAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBuZXcgVGVtcGxhdGVQYXJzZVJlc3VsdChyZXN1bHQsIHVzZWRQaXBlcywgZXJyb3JzKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICB0aGlzLnRyYW5zZm9ybXMuZm9yRWFjaChcbiAgICAgICAgICAodHJhbnNmb3JtOiB0LlRlbXBsYXRlQXN0VmlzaXRvcikgPT4geyByZXN1bHQgPSB0LnRlbXBsYXRlVmlzaXRBbGwodHJhbnNmb3JtLCByZXN1bHQpOyB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRlbXBsYXRlUGFyc2VSZXN1bHQocmVzdWx0LCB1c2VkUGlwZXMsIGVycm9ycyk7XG4gIH1cblxuICBleHBhbmRIdG1sKGh0bWxBc3RXaXRoRXJyb3JzOiBQYXJzZVRyZWVSZXN1bHQsIGZvcmNlZDogYm9vbGVhbiA9IGZhbHNlKTogUGFyc2VUcmVlUmVzdWx0IHtcbiAgICBjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IGh0bWxBc3RXaXRoRXJyb3JzLmVycm9ycztcblxuICAgIGlmIChlcnJvcnMubGVuZ3RoID09IDAgfHwgZm9yY2VkKSB7XG4gICAgICAvLyBUcmFuc2Zvcm0gSUNVIG1lc3NhZ2VzIHRvIGFuZ3VsYXIgZGlyZWN0aXZlc1xuICAgICAgY29uc3QgZXhwYW5kZWRIdG1sQXN0ID0gZXhwYW5kTm9kZXMoaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzKTtcbiAgICAgIGVycm9ycy5wdXNoKC4uLmV4cGFuZGVkSHRtbEFzdC5lcnJvcnMpO1xuICAgICAgaHRtbEFzdFdpdGhFcnJvcnMgPSBuZXcgUGFyc2VUcmVlUmVzdWx0KGV4cGFuZGVkSHRtbEFzdC5ub2RlcywgZXJyb3JzKTtcbiAgICB9XG4gICAgcmV0dXJuIGh0bWxBc3RXaXRoRXJyb3JzO1xuICB9XG5cbiAgZ2V0SW50ZXJwb2xhdGlvbkNvbmZpZyhjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSk6IEludGVycG9sYXRpb25Db25maWd8dW5kZWZpbmVkIHtcbiAgICBpZiAoY29tcG9uZW50LnRlbXBsYXRlKSB7XG4gICAgICByZXR1cm4gSW50ZXJwb2xhdGlvbkNvbmZpZy5mcm9tQXJyYXkoY29tcG9uZW50LnRlbXBsYXRlLmludGVycG9sYXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfYXNzZXJ0Tm9SZWZlcmVuY2VEdXBsaWNhdGlvbk9uVGVtcGxhdGUocmVzdWx0OiB0LlRlbXBsYXRlQXN0W10sIGVycm9yczogVGVtcGxhdGVQYXJzZUVycm9yW10pOlxuICAgICAgdm9pZCB7XG4gICAgY29uc3QgZXhpc3RpbmdSZWZlcmVuY2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgcmVzdWx0LmZpbHRlcihlbGVtZW50ID0+ICEhKDxhbnk+ZWxlbWVudCkucmVmZXJlbmNlcylcbiAgICAgICAgLmZvckVhY2goZWxlbWVudCA9PiAoPGFueT5lbGVtZW50KS5yZWZlcmVuY2VzLmZvckVhY2goKHJlZmVyZW5jZTogdC5SZWZlcmVuY2VBc3QpID0+IHtcbiAgICAgICAgICBjb25zdCBuYW1lID0gcmVmZXJlbmNlLm5hbWU7XG4gICAgICAgICAgaWYgKGV4aXN0aW5nUmVmZXJlbmNlcy5pbmRleE9mKG5hbWUpIDwgMCkge1xuICAgICAgICAgICAgZXhpc3RpbmdSZWZlcmVuY2VzLnB1c2gobmFtZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFRlbXBsYXRlUGFyc2VFcnJvcihcbiAgICAgICAgICAgICAgICBgUmVmZXJlbmNlIFwiIyR7bmFtZX1cIiBpcyBkZWZpbmVkIHNldmVyYWwgdGltZXNgLCByZWZlcmVuY2Uuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICBQYXJzZUVycm9yTGV2ZWwuRVJST1IpO1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkpO1xuICB9XG59XG5cbmNsYXNzIFRlbXBsYXRlUGFyc2VWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgc2VsZWN0b3JNYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcigpO1xuICBkaXJlY3RpdmVzSW5kZXggPSBuZXcgTWFwPENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBudW1iZXI+KCk7XG4gIG5nQ29udGVudENvdW50ID0gMDtcbiAgY29udGVudFF1ZXJ5U3RhcnRJZDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsIHByaXZhdGUgY29uZmlnOiBDb21waWxlckNvbmZpZyxcbiAgICAgIHB1YmxpYyBwcm92aWRlclZpZXdDb250ZXh0OiBQcm92aWRlclZpZXdDb250ZXh0LCBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLFxuICAgICAgcHJpdmF0ZSBfYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgcHJpdmF0ZSBfc2NoZW1hUmVnaXN0cnk6IEVsZW1lbnRTY2hlbWFSZWdpc3RyeSxcbiAgICAgIHByaXZhdGUgX3NjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10sIHByaXZhdGUgX3RhcmdldEVycm9yczogVGVtcGxhdGVQYXJzZUVycm9yW10pIHtcbiAgICAvLyBOb3RlOiBxdWVyaWVzIHN0YXJ0IHdpdGggaWQgMSBzbyB3ZSBjYW4gdXNlIHRoZSBudW1iZXIgaW4gYSBCbG9vbSBmaWx0ZXIhXG4gICAgdGhpcy5jb250ZW50UXVlcnlTdGFydElkID0gcHJvdmlkZXJWaWV3Q29udGV4dC5jb21wb25lbnQudmlld1F1ZXJpZXMubGVuZ3RoICsgMTtcbiAgICBkaXJlY3RpdmVzLmZvckVhY2goKGRpcmVjdGl2ZSwgaW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gQ3NzU2VsZWN0b3IucGFyc2UoZGlyZWN0aXZlLnNlbGVjdG9yICEpO1xuICAgICAgdGhpcy5zZWxlY3Rvck1hdGNoZXIuYWRkU2VsZWN0YWJsZXMoc2VsZWN0b3IsIGRpcmVjdGl2ZSk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZXNJbmRleC5zZXQoZGlyZWN0aXZlLCBpbmRleCk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KFRFWFRfQ1NTX1NFTEVDVE9SKCkpICE7XG4gICAgY29uc3QgdmFsdWVOb05nc3AgPSByZXBsYWNlTmdzcCh0ZXh0LnZhbHVlKTtcbiAgICBjb25zdCBleHByID0gdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUludGVycG9sYXRpb24odmFsdWVOb05nc3AsIHRleHQuc291cmNlU3BhbiAhKTtcbiAgICByZXR1cm4gZXhwciA/IG5ldyB0LkJvdW5kVGV4dEFzdChleHByLCBuZ0NvbnRlbnRJbmRleCwgdGV4dC5zb3VyY2VTcGFuICEpIDpcbiAgICAgICAgICAgICAgICAgIG5ldyB0LlRleHRBc3QodmFsdWVOb05nc3AsIG5nQ29udGVudEluZGV4LCB0ZXh0LnNvdXJjZVNwYW4gISk7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBuZXcgdC5BdHRyQXN0KGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcXVlcnlTdGFydEluZGV4ID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgIGNvbnN0IGVsTmFtZSA9IGVsZW1lbnQubmFtZTtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQgJiZcbiAgICAgICAgaXNTdHlsZVVybFJlc29sdmFibGUocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cikpIHtcbiAgICAgIC8vIFNraXBwaW5nIHN0eWxlc2hlZXRzIHdpdGggZWl0aGVyIHJlbGF0aXZlIHVybHMgb3IgcGFja2FnZSBzY2hlbWUgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgIC8vIHRoZW0gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCBlbGVtZW50T3JEaXJlY3RpdmVQcm9wczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGVsZW1lbnRPckRpcmVjdGl2ZVJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdID0gW107XG4gICAgY29uc3QgZWxlbWVudFZhcnM6IHQuVmFyaWFibGVBc3RbXSA9IFtdO1xuICAgIGNvbnN0IGV2ZW50czogdC5Cb3VuZEV2ZW50QXN0W10gPSBbXTtcblxuICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudE9yRGlyZWN0aXZlUHJvcHM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZU1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZUVsZW1lbnRWYXJzOiB0LlZhcmlhYmxlQXN0W10gPSBbXTtcblxuICAgIGxldCBoYXNJbmxpbmVUZW1wbGF0ZXMgPSBmYWxzZTtcbiAgICBjb25zdCBhdHRyczogdC5BdHRyQXN0W10gPSBbXTtcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgZWxlbWVudC5hdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgY29uc3QgcGFyc2VkVmFyaWFibGVzOiBQYXJzZWRWYXJpYWJsZVtdID0gW107XG4gICAgICBjb25zdCBoYXNCaW5kaW5nID0gdGhpcy5fcGFyc2VBdHRyKFxuICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBhdHRyLCBtYXRjaGFibGVBdHRycywgZWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsIGV2ZW50cyxcbiAgICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50VmFycyk7XG4gICAgICBlbGVtZW50VmFycy5wdXNoKC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAodiA9PiB0LlZhcmlhYmxlQXN0LmZyb21QYXJzZWRWYXJpYWJsZSh2KSkpO1xuXG4gICAgICBsZXQgdGVtcGxhdGVWYWx1ZTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGxldCB0ZW1wbGF0ZUtleTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gdGhpcy5fbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyLm5hbWUpO1xuXG4gICAgICBpZiAobm9ybWFsaXplZE5hbWUuc3RhcnRzV2l0aChURU1QTEFURV9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgdGVtcGxhdGVWYWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICAgIHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhhc1RlbXBsYXRlQmluZGluZyA9IHRlbXBsYXRlVmFsdWUgIT0gbnVsbDtcbiAgICAgIGlmIChoYXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgaWYgKGhhc0lubGluZVRlbXBsYXRlcykge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgQ2FuJ3QgaGF2ZSBtdWx0aXBsZSB0ZW1wbGF0ZSBiaW5kaW5ncyBvbiBvbmUgZWxlbWVudC4gVXNlIG9ubHkgb25lIGF0dHJpYnV0ZSBwcmVmaXhlZCB3aXRoICpgLFxuICAgICAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICAgIGhhc0lubGluZVRlbXBsYXRlcyA9IHRydWU7XG4gICAgICAgIGNvbnN0IHBhcnNlZFZhcmlhYmxlczogUGFyc2VkVmFyaWFibGVbXSA9IFtdO1xuICAgICAgICBjb25zdCBhYnNvbHV0ZU9mZnNldCA9IChhdHRyLnZhbHVlU3BhbiB8fCBhdHRyLnNvdXJjZVNwYW4pLnN0YXJ0Lm9mZnNldDtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUlubGluZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICAgIHRlbXBsYXRlS2V5ICEsIHRlbXBsYXRlVmFsdWUgISwgYXR0ci5zb3VyY2VTcGFuLCBhYnNvbHV0ZU9mZnNldCwgdGVtcGxhdGVNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICAgIHRlbXBsYXRlRWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsIHBhcnNlZFZhcmlhYmxlcyk7XG4gICAgICAgIHRlbXBsYXRlRWxlbWVudFZhcnMucHVzaCguLi5wYXJzZWRWYXJpYWJsZXMubWFwKHYgPT4gdC5WYXJpYWJsZUFzdC5mcm9tUGFyc2VkVmFyaWFibGUodikpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFoYXNCaW5kaW5nICYmICFoYXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgLy8gZG9uJ3QgaW5jbHVkZSB0aGUgYmluZGluZ3MgYXMgYXR0cmlidXRlcyBhcyB3ZWxsIGluIHRoZSBBU1RcbiAgICAgICAgYXR0cnMucHVzaCh0aGlzLnZpc2l0QXR0cmlidXRlKGF0dHIsIG51bGwpKTtcbiAgICAgICAgbWF0Y2hhYmxlQXR0cnMucHVzaChbYXR0ci5uYW1lLCBhdHRyLnZhbHVlXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCBlbGVtZW50Q3NzU2VsZWN0b3IgPSBjcmVhdGVFbGVtZW50Q3NzU2VsZWN0b3IoZWxOYW1lLCBtYXRjaGFibGVBdHRycyk7XG4gICAgY29uc3Qge2RpcmVjdGl2ZXM6IGRpcmVjdGl2ZU1ldGFzLCBtYXRjaEVsZW1lbnR9ID1cbiAgICAgICAgdGhpcy5fcGFyc2VEaXJlY3RpdmVzKHRoaXMuc2VsZWN0b3JNYXRjaGVyLCBlbGVtZW50Q3NzU2VsZWN0b3IpO1xuICAgIGNvbnN0IHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlQXN0W10gPSBbXTtcbiAgICBjb25zdCBib3VuZERpcmVjdGl2ZVByb3BOYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGRpcmVjdGl2ZUFzdHMgPSB0aGlzLl9jcmVhdGVEaXJlY3RpdmVBc3RzKFxuICAgICAgICBpc1RlbXBsYXRlRWxlbWVudCwgZWxlbWVudC5uYW1lLCBkaXJlY3RpdmVNZXRhcywgZWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsXG4gICAgICAgIGVsZW1lbnRPckRpcmVjdGl2ZVJlZnMsIGVsZW1lbnQuc291cmNlU3BhbiAhLCByZWZlcmVuY2VzLCBib3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgY29uc3QgZWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10gPSB0aGlzLl9jcmVhdGVFbGVtZW50UHJvcGVydHlBc3RzKFxuICAgICAgICBlbGVtZW50Lm5hbWUsIGVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCBib3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgY29uc3QgaXNWaWV3Um9vdCA9IHBhcmVudC5pc1RlbXBsYXRlRWxlbWVudCB8fCBoYXNJbmxpbmVUZW1wbGF0ZXM7XG5cbiAgICBjb25zdCBwcm92aWRlckNvbnRleHQgPSBuZXcgUHJvdmlkZXJFbGVtZW50Q29udGV4dChcbiAgICAgICAgdGhpcy5wcm92aWRlclZpZXdDb250ZXh0LCBwYXJlbnQucHJvdmlkZXJDb250ZXh0ICEsIGlzVmlld1Jvb3QsIGRpcmVjdGl2ZUFzdHMsIGF0dHJzLFxuICAgICAgICByZWZlcmVuY2VzLCBpc1RlbXBsYXRlRWxlbWVudCwgcXVlcnlTdGFydEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG5cbiAgICBjb25zdCBjaGlsZHJlbjogdC5UZW1wbGF0ZUFzdFtdID0gaHRtbC52aXNpdEFsbChcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC5ub25CaW5kYWJsZSA/IE5PTl9CSU5EQUJMRV9WSVNJVE9SIDogdGhpcywgZWxlbWVudC5jaGlsZHJlbixcbiAgICAgICAgRWxlbWVudENvbnRleHQuY3JlYXRlKFxuICAgICAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQsIGRpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgICBpc1RlbXBsYXRlRWxlbWVudCA/IHBhcmVudC5wcm92aWRlckNvbnRleHQgISA6IHByb3ZpZGVyQ29udGV4dCkpO1xuICAgIHByb3ZpZGVyQ29udGV4dC5hZnRlckVsZW1lbnQoKTtcbiAgICAvLyBPdmVycmlkZSB0aGUgYWN0dWFsIHNlbGVjdG9yIHdoZW4gdGhlIGBuZ1Byb2plY3RBc2AgYXR0cmlidXRlIGlzIHByb3ZpZGVkXG4gICAgY29uc3QgcHJvamVjdGlvblNlbGVjdG9yID0gcHJlcGFyc2VkRWxlbWVudC5wcm9qZWN0QXMgIT0gJycgP1xuICAgICAgICBDc3NTZWxlY3Rvci5wYXJzZShwcmVwYXJzZWRFbGVtZW50LnByb2plY3RBcylbMF0gOlxuICAgICAgICBlbGVtZW50Q3NzU2VsZWN0b3I7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KHByb2plY3Rpb25TZWxlY3RvcikgITtcbiAgICBsZXQgcGFyc2VkRWxlbWVudDogdC5UZW1wbGF0ZUFzdDtcblxuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLk5HX0NPTlRFTlQpIHtcbiAgICAgIC8vIGA8bmctY29udGVudD5gIGVsZW1lbnRcbiAgICAgIGlmIChlbGVtZW50LmNoaWxkcmVuICYmICFlbGVtZW50LmNoaWxkcmVuLmV2ZXJ5KF9pc0VtcHR5VGV4dE5vZGUpKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGA8bmctY29udGVudD4gZWxlbWVudCBjYW5ub3QgaGF2ZSBjb250ZW50LmAsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICAgIH1cblxuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0Lk5nQ29udGVudEFzdChcbiAgICAgICAgICB0aGlzLm5nQ29udGVudENvdW50KyssIGhhc0lubGluZVRlbXBsYXRlcyA/IG51bGwgISA6IG5nQ29udGVudEluZGV4LFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAvLyBgPG5nLXRlbXBsYXRlPmAgZWxlbWVudFxuICAgICAgdGhpcy5fYXNzZXJ0QWxsRXZlbnRzUHVibGlzaGVkQnlEaXJlY3RpdmVzKGRpcmVjdGl2ZUFzdHMsIGV2ZW50cyk7XG4gICAgICB0aGlzLl9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgICAgIGRpcmVjdGl2ZUFzdHMsIGVsZW1lbnRQcm9wcywgZWxlbWVudC5zb3VyY2VTcGFuICEpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRW1iZWRkZWRUZW1wbGF0ZUFzdChcbiAgICAgICAgICBhdHRycywgZXZlbnRzLCByZWZlcmVuY2VzLCBlbGVtZW50VmFycywgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkRGlyZWN0aXZlQXN0cyxcbiAgICAgICAgICBwcm92aWRlckNvbnRleHQudHJhbnNmb3JtUHJvdmlkZXJzLCBwcm92aWRlckNvbnRleHQudHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyLFxuICAgICAgICAgIHByb3ZpZGVyQ29udGV4dC5xdWVyeU1hdGNoZXMsIGNoaWxkcmVuLCBoYXNJbmxpbmVUZW1wbGF0ZXMgPyBudWxsICEgOiBuZ0NvbnRlbnRJbmRleCxcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGVsZW1lbnQgb3RoZXIgdGhhbiBgPG5nLWNvbnRlbnQ+YCBhbmQgYDxuZy10ZW1wbGF0ZT5gXG4gICAgICB0aGlzLl9hc3NlcnRFbGVtZW50RXhpc3RzKG1hdGNoRWxlbWVudCwgZWxlbWVudCk7XG4gICAgICB0aGlzLl9hc3NlcnRPbmx5T25lQ29tcG9uZW50KGRpcmVjdGl2ZUFzdHMsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcblxuICAgICAgY29uc3QgbmdDb250ZW50SW5kZXggPVxuICAgICAgICAgIGhhc0lubGluZVRlbXBsYXRlcyA/IG51bGwgOiBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KHByb2plY3Rpb25TZWxlY3Rvcik7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRWxlbWVudEFzdChcbiAgICAgICAgICBlbE5hbWUsIGF0dHJzLCBlbGVtZW50UHJvcHMsIGV2ZW50cywgcmVmZXJlbmNlcywgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkRGlyZWN0aXZlQXN0cyxcbiAgICAgICAgICBwcm92aWRlckNvbnRleHQudHJhbnNmb3JtUHJvdmlkZXJzLCBwcm92aWRlckNvbnRleHQudHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyLFxuICAgICAgICAgIHByb3ZpZGVyQ29udGV4dC5xdWVyeU1hdGNoZXMsIGNoaWxkcmVuLCBoYXNJbmxpbmVUZW1wbGF0ZXMgPyBudWxsIDogbmdDb250ZW50SW5kZXgsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4gfHwgbnVsbCk7XG4gICAgfVxuXG4gICAgaWYgKGhhc0lubGluZVRlbXBsYXRlcykge1xuICAgICAgLy8gVGhlIGVsZW1lbnQgYXMgYSAqLWF0dHJpYnV0ZVxuICAgICAgY29uc3QgdGVtcGxhdGVRdWVyeVN0YXJ0SW5kZXggPSB0aGlzLmNvbnRlbnRRdWVyeVN0YXJ0SWQ7XG4gICAgICBjb25zdCB0ZW1wbGF0ZVNlbGVjdG9yID0gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKCduZy10ZW1wbGF0ZScsIHRlbXBsYXRlTWF0Y2hhYmxlQXR0cnMpO1xuICAgICAgY29uc3Qge2RpcmVjdGl2ZXN9ID0gdGhpcy5fcGFyc2VEaXJlY3RpdmVzKHRoaXMuc2VsZWN0b3JNYXRjaGVyLCB0ZW1wbGF0ZVNlbGVjdG9yKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlQm91bmREaXJlY3RpdmVQcm9wTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRGlyZWN0aXZlQXN0cyA9IHRoaXMuX2NyZWF0ZURpcmVjdGl2ZUFzdHMoXG4gICAgICAgICAgdHJ1ZSwgZWxOYW1lLCBkaXJlY3RpdmVzLCB0ZW1wbGF0ZUVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCBbXSwgZWxlbWVudC5zb3VyY2VTcGFuICEsIFtdLFxuICAgICAgICAgIHRlbXBsYXRlQm91bmREaXJlY3RpdmVQcm9wTmFtZXMpO1xuICAgICAgY29uc3QgdGVtcGxhdGVFbGVtZW50UHJvcHM6IHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSA9IHRoaXMuX2NyZWF0ZUVsZW1lbnRQcm9wZXJ0eUFzdHMoXG4gICAgICAgICAgZWxOYW1lLCB0ZW1wbGF0ZUVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCB0ZW1wbGF0ZUJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzKTtcbiAgICAgIHRoaXMuX2Fzc2VydE5vQ29tcG9uZW50c05vckVsZW1lbnRCaW5kaW5nc09uVGVtcGxhdGUoXG4gICAgICAgICAgdGVtcGxhdGVEaXJlY3RpdmVBc3RzLCB0ZW1wbGF0ZUVsZW1lbnRQcm9wcywgZWxlbWVudC5zb3VyY2VTcGFuICEpO1xuICAgICAgY29uc3QgdGVtcGxhdGVQcm92aWRlckNvbnRleHQgPSBuZXcgUHJvdmlkZXJFbGVtZW50Q29udGV4dChcbiAgICAgICAgICB0aGlzLnByb3ZpZGVyVmlld0NvbnRleHQsIHBhcmVudC5wcm92aWRlckNvbnRleHQgISwgcGFyZW50LmlzVGVtcGxhdGVFbGVtZW50LFxuICAgICAgICAgIHRlbXBsYXRlRGlyZWN0aXZlQXN0cywgW10sIFtdLCB0cnVlLCB0ZW1wbGF0ZVF1ZXJ5U3RhcnRJbmRleCwgZWxlbWVudC5zb3VyY2VTcGFuICEpO1xuICAgICAgdGVtcGxhdGVQcm92aWRlckNvbnRleHQuYWZ0ZXJFbGVtZW50KCk7XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5FbWJlZGRlZFRlbXBsYXRlQXN0KFxuICAgICAgICAgIFtdLCBbXSwgW10sIHRlbXBsYXRlRWxlbWVudFZhcnMsIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkRGlyZWN0aXZlQXN0cyxcbiAgICAgICAgICB0ZW1wbGF0ZVByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1Qcm92aWRlcnMsXG4gICAgICAgICAgdGVtcGxhdGVQcm92aWRlckNvbnRleHQudHJhbnNmb3JtZWRIYXNWaWV3Q29udGFpbmVyLCB0ZW1wbGF0ZVByb3ZpZGVyQ29udGV4dC5xdWVyeU1hdGNoZXMsXG4gICAgICAgICAgW3BhcnNlZEVsZW1lbnRdLCBuZ0NvbnRlbnRJbmRleCwgZWxlbWVudC5zb3VyY2VTcGFuICEpO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJzZWRFbGVtZW50O1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBdHRyKFxuICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIGF0dHI6IGh0bWwuQXR0cmlidXRlLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCB0YXJnZXRFdmVudHM6IHQuQm91bmRFdmVudEFzdFtdLFxuICAgICAgdGFyZ2V0UmVmczogRWxlbWVudE9yRGlyZWN0aXZlUmVmW10sIHRhcmdldFZhcnM6IHQuVmFyaWFibGVBc3RbXSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLl9ub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHIubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgIGNvbnN0IHNyY1NwYW4gPSBhdHRyLnNvdXJjZVNwYW47XG4gICAgY29uc3QgYWJzb2x1dGVPZmZzZXQgPSBhdHRyLnZhbHVlU3BhbiA/IGF0dHIudmFsdWVTcGFuLnN0YXJ0Lm9mZnNldCA6IHNyY1NwYW4uc3RhcnQub2Zmc2V0O1xuXG4gICAgY29uc3QgYm91bmRFdmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICBjb25zdCBiaW5kUGFydHMgPSBuYW1lLm1hdGNoKEJJTkRfTkFNRV9SRUdFWFApO1xuICAgIGxldCBoYXNCaW5kaW5nID0gZmFsc2U7XG5cbiAgICBpZiAoYmluZFBhcnRzICE9PSBudWxsKSB7XG4gICAgICBoYXNCaW5kaW5nID0gdHJ1ZTtcbiAgICAgIGlmIChiaW5kUGFydHNbS1dfQklORF9JRFhdICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0xFVF9JRFhdKSB7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgICB0aGlzLl9wYXJzZVZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCB0YXJnZXRWYXJzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCJsZXQtXCIgaXMgb25seSBzdXBwb3J0ZWQgb24gbmctdGVtcGxhdGUgZWxlbWVudHMuYCwgc3JjU3Bhbik7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfUkVGX0lEWF0pIHtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICB0aGlzLl9wYXJzZVJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0UmVmcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX09OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQklORE9OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICAgIHRoaXMuX3BhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQVRfSURYXSkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHIudmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICAgIHRhcmdldFByb3BzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICAgIHRoaXMuX3BhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSwgdmFsdWUsIHNyY1NwYW4sIGF0dHIudmFsdWVTcGFuIHx8IHNyY1NwYW4sXG4gICAgICAgICAgICB0YXJnZXRNYXRjaGFibGVBdHRycywgYm91bmRFdmVudHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBhYnNvbHV0ZU9mZnNldCwgYXR0ci52YWx1ZVNwYW4sXG4gICAgICAgICAgICB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0ci52YWx1ZVNwYW4gfHwgc3JjU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhc0JpbmRpbmcgPSB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIG5hbWUsIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9XG5cbiAgICBpZiAoIWhhc0JpbmRpbmcpIHtcbiAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VMaXRlcmFsQXR0cihcbiAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHIudmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgIH1cblxuICAgIHRhcmdldEV2ZW50cy5wdXNoKC4uLmJvdW5kRXZlbnRzLm1hcChlID0+IHQuQm91bmRFdmVudEFzdC5mcm9tUGFyc2VkRXZlbnQoZSkpKTtcblxuICAgIHJldHVybiBoYXNCaW5kaW5nO1xuICB9XG5cbiAgcHJpdmF0ZSBfbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gL15kYXRhLS9pLnRlc3QoYXR0ck5hbWUpID8gYXR0ck5hbWUuc3Vic3RyaW5nKDUpIDogYXR0ck5hbWU7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVZhcmlhYmxlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHRhcmdldFZhcnM6IHQuVmFyaWFibGVBc3RbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gdmFyaWFibGUgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9IGVsc2UgaWYgKGlkZW50aWZpZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgVmFyaWFibGUgZG9lcyBub3QgaGF2ZSBhIG5hbWVgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICB0YXJnZXRWYXJzLnB1c2gobmV3IHQuVmFyaWFibGVBc3QoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUmVmZXJlbmNlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRSZWZzOiBFbGVtZW50T3JEaXJlY3RpdmVSZWZbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gcmVmZXJlbmNlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfSBlbHNlIGlmIChpZGVudGlmaWVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYFJlZmVyZW5jZSBkb2VzIG5vdCBoYXZlIGEgbmFtZWAsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHRhcmdldFJlZnMucHVzaChuZXcgRWxlbWVudE9yRGlyZWN0aXZlUmVmKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgYCR7bmFtZX1DaGFuZ2VgLCBgJHtleHByZXNzaW9ufT0kZXZlbnRgLCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICB0YXJnZXRFdmVudHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VEaXJlY3RpdmVzKHNlbGVjdG9yTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyLCBlbGVtZW50Q3NzU2VsZWN0b3I6IENzc1NlbGVjdG9yKTpcbiAgICAgIHtkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBtYXRjaEVsZW1lbnQ6IGJvb2xlYW59IHtcbiAgICAvLyBOZWVkIHRvIHNvcnQgdGhlIGRpcmVjdGl2ZXMgc28gdGhhdCB3ZSBnZXQgY29uc2lzdGVudCByZXN1bHRzIHRocm91Z2hvdXQsXG4gICAgLy8gYXMgc2VsZWN0b3JNYXRjaGVyIHVzZXMgTWFwcyBpbnNpZGUuXG4gICAgLy8gQWxzbyBkZWR1cGxpY2F0ZSBkaXJlY3RpdmVzIGFzIHRoZXkgbWlnaHQgbWF0Y2ggbW9yZSB0aGFuIG9uZSB0aW1lIVxuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXdBcnJheSh0aGlzLmRpcmVjdGl2ZXNJbmRleC5zaXplKTtcbiAgICAvLyBXaGV0aGVyIGFueSBkaXJlY3RpdmUgc2VsZWN0b3IgbWF0Y2hlcyBvbiB0aGUgZWxlbWVudCBuYW1lXG4gICAgbGV0IG1hdGNoRWxlbWVudCA9IGZhbHNlO1xuXG4gICAgc2VsZWN0b3JNYXRjaGVyLm1hdGNoKGVsZW1lbnRDc3NTZWxlY3RvciwgKHNlbGVjdG9yLCBkaXJlY3RpdmUpID0+IHtcbiAgICAgIGRpcmVjdGl2ZXNbdGhpcy5kaXJlY3RpdmVzSW5kZXguZ2V0KGRpcmVjdGl2ZSkgIV0gPSBkaXJlY3RpdmU7XG4gICAgICBtYXRjaEVsZW1lbnQgPSBtYXRjaEVsZW1lbnQgfHwgc2VsZWN0b3IuaGFzRWxlbWVudFNlbGVjdG9yKCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgZGlyZWN0aXZlczogZGlyZWN0aXZlcy5maWx0ZXIoZGlyID0+ICEhZGlyKSxcbiAgICAgIG1hdGNoRWxlbWVudCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRGlyZWN0aXZlQXN0cyhcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBlbGVtZW50TmFtZTogc3RyaW5nLCBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLFxuICAgICAgcHJvcHM6IFBhcnNlZFByb3BlcnR5W10sIGVsZW1lbnRPckRpcmVjdGl2ZVJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdLFxuICAgICAgZWxlbWVudFNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbiwgdGFyZ2V0UmVmZXJlbmNlczogdC5SZWZlcmVuY2VBc3RbXSxcbiAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzOiBTZXQ8c3RyaW5nPik6IHQuRGlyZWN0aXZlQXN0W10ge1xuICAgIGNvbnN0IG1hdGNoZWRSZWZlcmVuY2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgbGV0IGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkgPSBudWxsICE7XG5cbiAgICBjb25zdCBkaXJlY3RpdmVBc3RzID0gZGlyZWN0aXZlcy5tYXAoKGRpcmVjdGl2ZSkgPT4ge1xuICAgICAgY29uc3Qgc291cmNlU3BhbiA9IG5ldyBQYXJzZVNvdXJjZVNwYW4oXG4gICAgICAgICAgZWxlbWVudFNvdXJjZVNwYW4uc3RhcnQsIGVsZW1lbnRTb3VyY2VTcGFuLmVuZCxcbiAgICAgICAgICBgRGlyZWN0aXZlICR7aWRlbnRpZmllck5hbWUoZGlyZWN0aXZlLnR5cGUpfWApO1xuXG4gICAgICBpZiAoZGlyZWN0aXZlLmlzQ29tcG9uZW50KSB7XG4gICAgICAgIGNvbXBvbmVudCA9IGRpcmVjdGl2ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpcmVjdGl2ZVByb3BlcnRpZXM6IHQuQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdFtdID0gW107XG4gICAgICBjb25zdCBib3VuZFByb3BlcnRpZXMgPVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdFByb3BlcnR5QXN0cyhkaXJlY3RpdmUsIGVsZW1lbnROYW1lLCBzb3VyY2VTcGFuKSAhO1xuXG4gICAgICBsZXQgaG9zdFByb3BlcnRpZXMgPVxuICAgICAgICAgIGJvdW5kUHJvcGVydGllcy5tYXAocHJvcCA9PiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0LmZyb21Cb3VuZFByb3BlcnR5KHByb3ApKTtcbiAgICAgIC8vIE5vdGU6IFdlIG5lZWQgdG8gY2hlY2sgdGhlIGhvc3QgcHJvcGVydGllcyBoZXJlIGFzIHdlbGwsXG4gICAgICAvLyBhcyB3ZSBkb24ndCBrbm93IHRoZSBlbGVtZW50IG5hbWUgaW4gdGhlIERpcmVjdGl2ZVdyYXBwZXJDb21waWxlciB5ZXQuXG4gICAgICBob3N0UHJvcGVydGllcyA9IHRoaXMuX2NoZWNrUHJvcGVydGllc0luU2NoZW1hKGVsZW1lbnROYW1lLCBob3N0UHJvcGVydGllcyk7XG4gICAgICBjb25zdCBwYXJzZWRFdmVudHMgPVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdEV2ZW50QXN0cyhkaXJlY3RpdmUsIHNvdXJjZVNwYW4pICE7XG4gICAgICB0aGlzLl9jcmVhdGVEaXJlY3RpdmVQcm9wZXJ0eUFzdHMoXG4gICAgICAgICAgZGlyZWN0aXZlLmlucHV0cywgcHJvcHMsIGRpcmVjdGl2ZVByb3BlcnRpZXMsIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzKTtcbiAgICAgIGVsZW1lbnRPckRpcmVjdGl2ZVJlZnMuZm9yRWFjaCgoZWxPckRpclJlZikgPT4ge1xuICAgICAgICBpZiAoKGVsT3JEaXJSZWYudmFsdWUubGVuZ3RoID09PSAwICYmIGRpcmVjdGl2ZS5pc0NvbXBvbmVudCkgfHxcbiAgICAgICAgICAgIChlbE9yRGlyUmVmLmlzUmVmZXJlbmNlVG9EaXJlY3RpdmUoZGlyZWN0aXZlKSkpIHtcbiAgICAgICAgICB0YXJnZXRSZWZlcmVuY2VzLnB1c2gobmV3IHQuUmVmZXJlbmNlQXN0KFxuICAgICAgICAgICAgICBlbE9yRGlyUmVmLm5hbWUsIGNyZWF0ZVRva2VuRm9yUmVmZXJlbmNlKGRpcmVjdGl2ZS50eXBlLnJlZmVyZW5jZSksIGVsT3JEaXJSZWYudmFsdWUsXG4gICAgICAgICAgICAgIGVsT3JEaXJSZWYuc291cmNlU3BhbikpO1xuICAgICAgICAgIG1hdGNoZWRSZWZlcmVuY2VzLmFkZChlbE9yRGlyUmVmLm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGhvc3RFdmVudHMgPSBwYXJzZWRFdmVudHMubWFwKGUgPT4gdC5Cb3VuZEV2ZW50QXN0LmZyb21QYXJzZWRFdmVudChlKSk7XG4gICAgICBjb25zdCBjb250ZW50UXVlcnlTdGFydElkID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgICAgdGhpcy5jb250ZW50UXVlcnlTdGFydElkICs9IGRpcmVjdGl2ZS5xdWVyaWVzLmxlbmd0aDtcbiAgICAgIHJldHVybiBuZXcgdC5EaXJlY3RpdmVBc3QoXG4gICAgICAgICAgZGlyZWN0aXZlLCBkaXJlY3RpdmVQcm9wZXJ0aWVzLCBob3N0UHJvcGVydGllcywgaG9zdEV2ZW50cywgY29udGVudFF1ZXJ5U3RhcnRJZCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9KTtcblxuICAgIGVsZW1lbnRPckRpcmVjdGl2ZVJlZnMuZm9yRWFjaCgoZWxPckRpclJlZikgPT4ge1xuICAgICAgaWYgKGVsT3JEaXJSZWYudmFsdWUubGVuZ3RoID4gMCkge1xuICAgICAgICBpZiAoIW1hdGNoZWRSZWZlcmVuY2VzLmhhcyhlbE9yRGlyUmVmLm5hbWUpKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBUaGVyZSBpcyBubyBkaXJlY3RpdmUgd2l0aCBcImV4cG9ydEFzXCIgc2V0IHRvIFwiJHtlbE9yRGlyUmVmLnZhbHVlfVwiYCxcbiAgICAgICAgICAgICAgZWxPckRpclJlZi5zb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghY29tcG9uZW50KSB7XG4gICAgICAgIGxldCByZWZUb2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEgPSBudWxsICE7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgICAgIHJlZlRva2VuID0gY3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSh0aGlzLnJlZmxlY3RvciwgSWRlbnRpZmllcnMuVGVtcGxhdGVSZWYpO1xuICAgICAgICB9XG4gICAgICAgIHRhcmdldFJlZmVyZW5jZXMucHVzaChcbiAgICAgICAgICAgIG5ldyB0LlJlZmVyZW5jZUFzdChlbE9yRGlyUmVmLm5hbWUsIHJlZlRva2VuLCBlbE9yRGlyUmVmLnZhbHVlLCBlbE9yRGlyUmVmLnNvdXJjZVNwYW4pKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZGlyZWN0aXZlQXN0cztcbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZURpcmVjdGl2ZVByb3BlcnR5QXN0cyhcbiAgICAgIGRpcmVjdGl2ZVByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LCBib3VuZFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLFxuICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wczogdC5Cb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0W10sXG4gICAgICB0YXJnZXRCb3VuZERpcmVjdGl2ZVByb3BOYW1lczogU2V0PHN0cmluZz4pIHtcbiAgICBpZiAoZGlyZWN0aXZlUHJvcGVydGllcykge1xuICAgICAgY29uc3QgYm91bmRQcm9wc0J5TmFtZSA9IG5ldyBNYXA8c3RyaW5nLCBQYXJzZWRQcm9wZXJ0eT4oKTtcbiAgICAgIGJvdW5kUHJvcHMuZm9yRWFjaChib3VuZFByb3AgPT4ge1xuICAgICAgICBjb25zdCBwcmV2VmFsdWUgPSBib3VuZFByb3BzQnlOYW1lLmdldChib3VuZFByb3AubmFtZSk7XG4gICAgICAgIGlmICghcHJldlZhbHVlIHx8IHByZXZWYWx1ZS5pc0xpdGVyYWwpIHtcbiAgICAgICAgICAvLyBnaXZlIFthXT1cImJcIiBhIGhpZ2hlciBwcmVjZWRlbmNlIHRoYW4gYT1cImJcIiBvbiB0aGUgc2FtZSBlbGVtZW50XG4gICAgICAgICAgYm91bmRQcm9wc0J5TmFtZS5zZXQoYm91bmRQcm9wLm5hbWUsIGJvdW5kUHJvcCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBPYmplY3Qua2V5cyhkaXJlY3RpdmVQcm9wZXJ0aWVzKS5mb3JFYWNoKGRpclByb3AgPT4ge1xuICAgICAgICBjb25zdCBlbFByb3AgPSBkaXJlY3RpdmVQcm9wZXJ0aWVzW2RpclByb3BdO1xuICAgICAgICBjb25zdCBib3VuZFByb3AgPSBib3VuZFByb3BzQnlOYW1lLmdldChlbFByb3ApO1xuXG4gICAgICAgIC8vIEJpbmRpbmdzIGFyZSBvcHRpb25hbCwgc28gdGhpcyBiaW5kaW5nIG9ubHkgbmVlZHMgdG8gYmUgc2V0IHVwIGlmIGFuIGV4cHJlc3Npb24gaXMgZ2l2ZW4uXG4gICAgICAgIGlmIChib3VuZFByb3ApIHtcbiAgICAgICAgICB0YXJnZXRCb3VuZERpcmVjdGl2ZVByb3BOYW1lcy5hZGQoYm91bmRQcm9wLm5hbWUpO1xuICAgICAgICAgIGlmICghaXNFbXB0eUV4cHJlc3Npb24oYm91bmRQcm9wLmV4cHJlc3Npb24pKSB7XG4gICAgICAgICAgICB0YXJnZXRCb3VuZERpcmVjdGl2ZVByb3BzLnB1c2gobmV3IHQuQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdChcbiAgICAgICAgICAgICAgICBkaXJQcm9wLCBib3VuZFByb3AubmFtZSwgYm91bmRQcm9wLmV4cHJlc3Npb24sIGJvdW5kUHJvcC5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVFbGVtZW50UHJvcGVydHlBc3RzKFxuICAgICAgZWxlbWVudE5hbWU6IHN0cmluZywgcHJvcHM6IFBhcnNlZFByb3BlcnR5W10sXG4gICAgICBib3VuZERpcmVjdGl2ZVByb3BOYW1lczogU2V0PHN0cmluZz4pOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10ge1xuICAgIGNvbnN0IGJvdW5kRWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10gPSBbXTtcblxuICAgIHByb3BzLmZvckVhY2goKHByb3A6IFBhcnNlZFByb3BlcnR5KSA9PiB7XG4gICAgICBpZiAoIXByb3AuaXNMaXRlcmFsICYmICFib3VuZERpcmVjdGl2ZVByb3BOYW1lcy5oYXMocHJvcC5uYW1lKSkge1xuICAgICAgICBjb25zdCBib3VuZFByb3AgPSB0aGlzLl9iaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kRWxlbWVudFByb3BlcnR5KGVsZW1lbnROYW1lLCBwcm9wKTtcbiAgICAgICAgYm91bmRFbGVtZW50UHJvcHMucHVzaCh0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0LmZyb21Cb3VuZFByb3BlcnR5KGJvdW5kUHJvcCkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLl9jaGVja1Byb3BlcnRpZXNJblNjaGVtYShlbGVtZW50TmFtZSwgYm91bmRFbGVtZW50UHJvcHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmluZENvbXBvbmVudERpcmVjdGl2ZXMoZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSk6IHQuRGlyZWN0aXZlQXN0W10ge1xuICAgIHJldHVybiBkaXJlY3RpdmVzLmZpbHRlcihkaXJlY3RpdmUgPT4gZGlyZWN0aXZlLmRpcmVjdGl2ZS5pc0NvbXBvbmVudCk7XG4gIH1cblxuICBwcml2YXRlIF9maW5kQ29tcG9uZW50RGlyZWN0aXZlTmFtZXMoZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gdGhpcy5fZmluZENvbXBvbmVudERpcmVjdGl2ZXMoZGlyZWN0aXZlcylcbiAgICAgICAgLm1hcChkaXJlY3RpdmUgPT4gaWRlbnRpZmllck5hbWUoZGlyZWN0aXZlLmRpcmVjdGl2ZS50eXBlKSAhKTtcbiAgfVxuXG4gIHByaXZhdGUgX2Fzc2VydE9ubHlPbmVDb21wb25lbnQoZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgY29uc3QgY29tcG9uZW50VHlwZU5hbWVzID0gdGhpcy5fZmluZENvbXBvbmVudERpcmVjdGl2ZU5hbWVzKGRpcmVjdGl2ZXMpO1xuICAgIGlmIChjb21wb25lbnRUeXBlTmFtZXMubGVuZ3RoID4gMSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYE1vcmUgdGhhbiBvbmUgY29tcG9uZW50IG1hdGNoZWQgb24gdGhpcyBlbGVtZW50LlxcbmAgK1xuICAgICAgICAgICAgICBgTWFrZSBzdXJlIHRoYXQgb25seSBvbmUgY29tcG9uZW50J3Mgc2VsZWN0b3IgY2FuIG1hdGNoIGEgZ2l2ZW4gZWxlbWVudC5cXG5gICtcbiAgICAgICAgICAgICAgYENvbmZsaWN0aW5nIGNvbXBvbmVudHM6ICR7Y29tcG9uZW50VHlwZU5hbWVzLmpvaW4oJywnKX1gLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlIHN1cmUgdGhhdCBub24tYW5ndWxhciB0YWdzIGNvbmZvcm0gdG8gdGhlIHNjaGVtYXMuXG4gICAqXG4gICAqIE5vdGU6IEFuIGVsZW1lbnQgaXMgY29uc2lkZXJlZCBhbiBhbmd1bGFyIHRhZyB3aGVuIGF0IGxlYXN0IG9uZSBkaXJlY3RpdmUgc2VsZWN0b3IgbWF0Y2hlcyB0aGVcbiAgICogdGFnIG5hbWUuXG4gICAqXG4gICAqIEBwYXJhbSBtYXRjaEVsZW1lbnQgV2hldGhlciBhbnkgZGlyZWN0aXZlIGhhcyBtYXRjaGVkIG9uIHRoZSB0YWcgbmFtZVxuICAgKiBAcGFyYW0gZWxlbWVudCB0aGUgaHRtbCBlbGVtZW50XG4gICAqL1xuICBwcml2YXRlIF9hc3NlcnRFbGVtZW50RXhpc3RzKG1hdGNoRWxlbWVudDogYm9vbGVhbiwgZWxlbWVudDogaHRtbC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxOYW1lID0gZWxlbWVudC5uYW1lLnJlcGxhY2UoL146eGh0bWw6LywgJycpO1xuXG4gICAgaWYgKCFtYXRjaEVsZW1lbnQgJiYgIXRoaXMuX3NjaGVtYVJlZ2lzdHJ5Lmhhc0VsZW1lbnQoZWxOYW1lLCB0aGlzLl9zY2hlbWFzKSkge1xuICAgICAgbGV0IGVycm9yTXNnID0gYCcke2VsTmFtZX0nIGlzIG5vdCBhIGtub3duIGVsZW1lbnQ6XFxuYDtcbiAgICAgIGVycm9yTXNnICs9IGAxLiBJZiAnJHtcbiAgICAgICAgICBlbE5hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbXBvbmVudCwgdGhlbiB2ZXJpZnkgdGhhdCBpdCBpcyBwYXJ0IG9mIHRoaXMgbW9kdWxlLlxcbmA7XG4gICAgICBpZiAoZWxOYW1lLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgIGVycm9yTXNnICs9IGAyLiBJZiAnJHtcbiAgICAgICAgICAgIGVsTmFtZX0nIGlzIGEgV2ViIENvbXBvbmVudCB0aGVuIGFkZCAnQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQgdG8gc3VwcHJlc3MgdGhpcyBtZXNzYWdlLmA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlcnJvck1zZyArPVxuICAgICAgICAgICAgYDIuIFRvIGFsbG93IGFueSBlbGVtZW50IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVycm9yTXNnLCBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXNzZXJ0Tm9Db21wb25lbnRzTm9yRWxlbWVudEJpbmRpbmdzT25UZW1wbGF0ZShcbiAgICAgIGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10sIGVsZW1lbnRQcm9wczogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdLFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgY29uc3QgY29tcG9uZW50VHlwZU5hbWVzOiBzdHJpbmdbXSA9IHRoaXMuX2ZpbmRDb21wb25lbnREaXJlY3RpdmVOYW1lcyhkaXJlY3RpdmVzKTtcbiAgICBpZiAoY29tcG9uZW50VHlwZU5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBDb21wb25lbnRzIG9uIGFuIGVtYmVkZGVkIHRlbXBsYXRlOiAke2NvbXBvbmVudFR5cGVOYW1lcy5qb2luKCcsJyl9YCwgc291cmNlU3Bhbik7XG4gICAgfVxuICAgIGVsZW1lbnRQcm9wcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYFByb3BlcnR5IGJpbmRpbmcgJHtcbiAgICAgICAgICAgICAgcHJvcC5uYW1lfSBub3QgdXNlZCBieSBhbnkgZGlyZWN0aXZlIG9uIGFuIGVtYmVkZGVkIHRlbXBsYXRlLiBNYWtlIHN1cmUgdGhhdCB0aGUgcHJvcGVydHkgbmFtZSBpcyBzcGVsbGVkIGNvcnJlY3RseSBhbmQgYWxsIGRpcmVjdGl2ZXMgYXJlIGxpc3RlZCBpbiB0aGUgXCJATmdNb2R1bGUuZGVjbGFyYXRpb25zXCIuYCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2Fzc2VydEFsbEV2ZW50c1B1Ymxpc2hlZEJ5RGlyZWN0aXZlcyhcbiAgICAgIGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10sIGV2ZW50czogdC5Cb3VuZEV2ZW50QXN0W10pIHtcbiAgICBjb25zdCBhbGxEaXJlY3RpdmVFdmVudHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGRpcmVjdGl2ZXMuZm9yRWFjaChkaXJlY3RpdmUgPT4ge1xuICAgICAgT2JqZWN0LmtleXMoZGlyZWN0aXZlLmRpcmVjdGl2ZS5vdXRwdXRzKS5mb3JFYWNoKGsgPT4ge1xuICAgICAgICBjb25zdCBldmVudE5hbWUgPSBkaXJlY3RpdmUuZGlyZWN0aXZlLm91dHB1dHNba107XG4gICAgICAgIGFsbERpcmVjdGl2ZUV2ZW50cy5hZGQoZXZlbnROYW1lKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZXZlbnRzLmZvckVhY2goZXZlbnQgPT4ge1xuICAgICAgaWYgKGV2ZW50LnRhcmdldCAhPSBudWxsIHx8ICFhbGxEaXJlY3RpdmVFdmVudHMuaGFzKGV2ZW50Lm5hbWUpKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgYEV2ZW50IGJpbmRpbmcgJHtcbiAgICAgICAgICAgICAgICBldmVudFxuICAgICAgICAgICAgICAgICAgICAuZnVsbE5hbWV9IG5vdCBlbWl0dGVkIGJ5IGFueSBkaXJlY3RpdmUgb24gYW4gZW1iZWRkZWQgdGVtcGxhdGUuIE1ha2Ugc3VyZSB0aGF0IHRoZSBldmVudCBuYW1lIGlzIHNwZWxsZWQgY29ycmVjdGx5IGFuZCBhbGwgZGlyZWN0aXZlcyBhcmUgbGlzdGVkIGluIHRoZSBcIkBOZ01vZHVsZS5kZWNsYXJhdGlvbnNcIi5gLFxuICAgICAgICAgICAgZXZlbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9jaGVja1Byb3BlcnRpZXNJblNjaGVtYShlbGVtZW50TmFtZTogc3RyaW5nLCBib3VuZFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10pOlxuICAgICAgdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdIHtcbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBmaWx0ZXIgb3V0IGVtcHR5IGV4cHJlc3Npb25zIGJlZm9yZSB0aGlzIG1ldGhvZCxcbiAgICAvLyBhcyB3ZSBzdGlsbCB3YW50IHRvIHZhbGlkYXRlIHRoZW0hXG4gICAgcmV0dXJuIGJvdW5kUHJvcHMuZmlsdGVyKChib3VuZFByb3ApID0+IHtcbiAgICAgIGlmIChib3VuZFByb3AudHlwZSA9PT0gdC5Qcm9wZXJ0eUJpbmRpbmdUeXBlLlByb3BlcnR5ICYmXG4gICAgICAgICAgIXRoaXMuX3NjaGVtYVJlZ2lzdHJ5Lmhhc1Byb3BlcnR5KGVsZW1lbnROYW1lLCBib3VuZFByb3AubmFtZSwgdGhpcy5fc2NoZW1hcykpIHtcbiAgICAgICAgbGV0IGVycm9yTXNnID0gYENhbid0IGJpbmQgdG8gJyR7Ym91bmRQcm9wLm5hbWV9JyBzaW5jZSBpdCBpc24ndCBhIGtub3duIHByb3BlcnR5IG9mICcke1xuICAgICAgICAgICAgZWxlbWVudE5hbWV9Jy5gO1xuICAgICAgICBpZiAoZWxlbWVudE5hbWUuc3RhcnRzV2l0aCgnbmctJykpIHtcbiAgICAgICAgICBlcnJvck1zZyArPSBgXFxuMS4gSWYgJyR7XG4gICAgICAgICAgICAgICAgICBib3VuZFByb3BcbiAgICAgICAgICAgICAgICAgICAgICAubmFtZX0nIGlzIGFuIEFuZ3VsYXIgZGlyZWN0aXZlLCB0aGVuIGFkZCAnQ29tbW9uTW9kdWxlJyB0byB0aGUgJ0BOZ01vZHVsZS5pbXBvcnRzJyBvZiB0aGlzIGNvbXBvbmVudC5gICtcbiAgICAgICAgICAgICAgYFxcbjIuIFRvIGFsbG93IGFueSBwcm9wZXJ0eSBhZGQgJ05PX0VSUk9SU19TQ0hFTUEnIHRvIHRoZSAnQE5nTW9kdWxlLnNjaGVtYXMnIG9mIHRoaXMgY29tcG9uZW50LmA7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudE5hbWUuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgICAgICBlcnJvck1zZyArPSBgXFxuMS4gSWYgJyR7ZWxlbWVudE5hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbXBvbmVudCBhbmQgaXQgaGFzICcke1xuICAgICAgICAgICAgICAgICAgYm91bmRQcm9wLm5hbWV9JyBpbnB1dCwgdGhlbiB2ZXJpZnkgdGhhdCBpdCBpcyBwYXJ0IG9mIHRoaXMgbW9kdWxlLmAgK1xuICAgICAgICAgICAgICBgXFxuMi4gSWYgJyR7XG4gICAgICAgICAgICAgICAgICBlbGVtZW50TmFtZX0nIGlzIGEgV2ViIENvbXBvbmVudCB0aGVuIGFkZCAnQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQgdG8gc3VwcHJlc3MgdGhpcyBtZXNzYWdlLmAgK1xuICAgICAgICAgICAgICBgXFxuMy4gVG8gYWxsb3cgYW55IHByb3BlcnR5IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihlcnJvck1zZywgYm91bmRQcm9wLnNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuICFpc0VtcHR5RXhwcmVzc2lvbihib3VuZFByb3AudmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLl90YXJnZXRFcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBtZXNzYWdlLCBsZXZlbCkpO1xuICB9XG59XG5cbmNsYXNzIE5vbkJpbmRhYmxlVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIHZpc2l0RWxlbWVudChhc3Q6IGh0bWwuRWxlbWVudCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IHQuRWxlbWVudEFzdHxudWxsIHtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGFzdCk7XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUIHx8XG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEUgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRVNIRUVUKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhbmQgc3R5bGVzaGVldHMgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWQgdGhlbVxuICAgICAgLy8gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGF0dHJOYW1lQW5kVmFsdWVzID0gYXN0LmF0dHJzLm1hcCgoYXR0cik6IFtzdHJpbmcsIHN0cmluZ10gPT4gW2F0dHIubmFtZSwgYXR0ci52YWx1ZV0pO1xuICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKGFzdC5uYW1lLCBhdHRyTmFtZUFuZFZhbHVlcyk7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KHNlbGVjdG9yKTtcbiAgICBjb25zdCBjaGlsZHJlbjogdC5UZW1wbGF0ZUFzdFtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuY2hpbGRyZW4sIEVNUFRZX0VMRU1FTlRfQ09OVEVYVCk7XG4gICAgcmV0dXJuIG5ldyB0LkVsZW1lbnRBc3QoXG4gICAgICAgIGFzdC5uYW1lLCBodG1sLnZpc2l0QWxsKHRoaXMsIGFzdC5hdHRycyksIFtdLCBbXSwgW10sIFtdLCBbXSwgZmFsc2UsIFtdLCBjaGlsZHJlbixcbiAgICAgICAgbmdDb250ZW50SW5kZXgsIGFzdC5zb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiB0LkF0dHJBc3Qge1xuICAgIHJldHVybiBuZXcgdC5BdHRyQXN0KGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQsIHBhcmVudDogRWxlbWVudENvbnRleHQpOiB0LlRleHRBc3Qge1xuICAgIGNvbnN0IG5nQ29udGVudEluZGV4ID0gcGFyZW50LmZpbmROZ0NvbnRlbnRJbmRleChURVhUX0NTU19TRUxFQ1RPUigpKSAhO1xuICAgIHJldHVybiBuZXcgdC5UZXh0QXN0KHRleHQudmFsdWUsIG5nQ29udGVudEluZGV4LCB0ZXh0LnNvdXJjZVNwYW4gISk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gZXhwYW5zaW9uOyB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGV4cGFuc2lvbkNhc2U7IH1cbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSB0byBhbiBlbGVtZW50IG9yIGRpcmVjdGl2ZSBpbiBhIHRlbXBsYXRlLiBFLmcuLCB0aGUgcmVmZXJlbmNlIGluIHRoaXMgdGVtcGxhdGU6XG4gKlxuICogPGRpdiAjbXlNZW51PVwiY29vbE1lbnVcIj5cbiAqXG4gKiB3b3VsZCBiZSB7bmFtZTogJ215TWVudScsIHZhbHVlOiAnY29vbE1lbnUnLCBzb3VyY2VTcGFuOiAuLi59XG4gKi9cbmNsYXNzIEVsZW1lbnRPckRpcmVjdGl2ZVJlZiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIC8qKiBHZXRzIHdoZXRoZXIgdGhpcyBpcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2l2ZW4gZGlyZWN0aXZlLiAqL1xuICBpc1JlZmVyZW5jZVRvRGlyZWN0aXZlKGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkpIHtcbiAgICByZXR1cm4gc3BsaXRFeHBvcnRBcyhkaXJlY3RpdmUuZXhwb3J0QXMpLmluZGV4T2YodGhpcy52YWx1ZSkgIT09IC0xO1xuICB9XG59XG5cbi8qKiBTcGxpdHMgYSByYXcsIHBvdGVudGlhbGx5IGNvbW1hLWRlbGltaXRlZCBgZXhwb3J0QXNgIHZhbHVlIGludG8gYW4gYXJyYXkgb2YgbmFtZXMuICovXG5mdW5jdGlvbiBzcGxpdEV4cG9ydEFzKGV4cG9ydEFzOiBzdHJpbmcgfCBudWxsKTogc3RyaW5nW10ge1xuICByZXR1cm4gZXhwb3J0QXMgPyBleHBvcnRBcy5zcGxpdCgnLCcpLm1hcChlID0+IGUudHJpbSgpKSA6IFtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRDbGFzc2VzKGNsYXNzQXR0clZhbHVlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBjbGFzc0F0dHJWYWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG59XG5cbmNsYXNzIEVsZW1lbnRDb250ZXh0IHtcbiAgc3RhdGljIGNyZWF0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdLFxuICAgICAgcHJvdmlkZXJDb250ZXh0OiBQcm92aWRlckVsZW1lbnRDb250ZXh0KTogRWxlbWVudENvbnRleHQge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gICAgbGV0IHdpbGRjYXJkTmdDb250ZW50SW5kZXg6IG51bWJlciA9IG51bGwgITtcbiAgICBjb25zdCBjb21wb25lbnQgPSBkaXJlY3RpdmVzLmZpbmQoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS5kaXJlY3RpdmUuaXNDb21wb25lbnQpO1xuICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgIGNvbnN0IG5nQ29udGVudFNlbGVjdG9ycyA9IGNvbXBvbmVudC5kaXJlY3RpdmUudGVtcGxhdGUgIS5uZ0NvbnRlbnRTZWxlY3RvcnM7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5nQ29udGVudFNlbGVjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBzZWxlY3RvciA9IG5nQ29udGVudFNlbGVjdG9yc1tpXTtcbiAgICAgICAgaWYgKHNlbGVjdG9yID09PSAnKicpIHtcbiAgICAgICAgICB3aWxkY2FyZE5nQ29udGVudEluZGV4ID0gaTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKG5nQ29udGVudFNlbGVjdG9yc1tpXSksIGkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgRWxlbWVudENvbnRleHQoaXNUZW1wbGF0ZUVsZW1lbnQsIG1hdGNoZXIsIHdpbGRjYXJkTmdDb250ZW50SW5kZXgsIHByb3ZpZGVyQ29udGV4dCk7XG4gIH1cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIHByaXZhdGUgX25nQ29udGVudEluZGV4TWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyLFxuICAgICAgcHJpdmF0ZSBfd2lsZGNhcmROZ0NvbnRlbnRJbmRleDogbnVtYmVyfG51bGwsXG4gICAgICBwdWJsaWMgcHJvdmlkZXJDb250ZXh0OiBQcm92aWRlckVsZW1lbnRDb250ZXh0fG51bGwpIHt9XG5cbiAgZmluZE5nQ29udGVudEluZGV4KHNlbGVjdG9yOiBDc3NTZWxlY3Rvcik6IG51bWJlcnxudWxsIHtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRpY2VzOiBudW1iZXJbXSA9IFtdO1xuICAgIHRoaXMuX25nQ29udGVudEluZGV4TWF0Y2hlci5tYXRjaChcbiAgICAgICAgc2VsZWN0b3IsIChzZWxlY3RvciwgbmdDb250ZW50SW5kZXgpID0+IHsgbmdDb250ZW50SW5kaWNlcy5wdXNoKG5nQ29udGVudEluZGV4KTsgfSk7XG4gICAgbmdDb250ZW50SW5kaWNlcy5zb3J0KCk7XG4gICAgaWYgKHRoaXMuX3dpbGRjYXJkTmdDb250ZW50SW5kZXggIT0gbnVsbCkge1xuICAgICAgbmdDb250ZW50SW5kaWNlcy5wdXNoKHRoaXMuX3dpbGRjYXJkTmdDb250ZW50SW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gbmdDb250ZW50SW5kaWNlcy5sZW5ndGggPiAwID8gbmdDb250ZW50SW5kaWNlc1swXSA6IG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnRDc3NTZWxlY3RvcihcbiAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBhdHRyaWJ1dGVzOiBbc3RyaW5nLCBzdHJpbmddW10pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsTmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbE5hbWVOb05zKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBhdHRyTmFtZSA9IGF0dHJpYnV0ZXNbaV1bMF07XG4gICAgY29uc3QgYXR0ck5hbWVOb05zID0gc3BsaXROc05hbWUoYXR0ck5hbWUpWzFdO1xuICAgIGNvbnN0IGF0dHJWYWx1ZSA9IGF0dHJpYnV0ZXNbaV1bMV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUoYXR0ck5hbWVOb05zLCBhdHRyVmFsdWUpO1xuICAgIGlmIChhdHRyTmFtZS50b0xvd2VyQ2FzZSgpID09IENMQVNTX0FUVFIpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSBzcGxpdENsYXNzZXMoYXR0clZhbHVlKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbmNvbnN0IEVNUFRZX0VMRU1FTlRfQ09OVEVYVCA9IG5ldyBFbGVtZW50Q29udGV4dCh0cnVlLCBuZXcgU2VsZWN0b3JNYXRjaGVyKCksIG51bGwsIG51bGwpO1xuY29uc3QgTk9OX0JJTkRBQkxFX1ZJU0lUT1IgPSBuZXcgTm9uQmluZGFibGVWaXNpdG9yKCk7XG5cbmZ1bmN0aW9uIF9pc0VtcHR5VGV4dE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5UZXh0ICYmIG5vZGUudmFsdWUudHJpbSgpLmxlbmd0aCA9PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlU3VtbWFyeUR1cGxpY2F0ZXM8VCBleHRlbmRze3R5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGF9PihpdGVtczogVFtdKTogVFtdIHtcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxhbnksIFQ+KCk7XG5cbiAgaXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgIGlmICghbWFwLmdldChpdGVtLnR5cGUucmVmZXJlbmNlKSkge1xuICAgICAgbWFwLnNldChpdGVtLnR5cGUucmVmZXJlbmNlLCBpdGVtKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKG1hcC52YWx1ZXMoKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5RXhwcmVzc2lvbihhc3Q6IEFTVCk6IGJvb2xlYW4ge1xuICBpZiAoYXN0IGluc3RhbmNlb2YgQVNUV2l0aFNvdXJjZSkge1xuICAgIGFzdCA9IGFzdC5hc3Q7XG4gIH1cbiAgcmV0dXJuIGFzdCBpbnN0YW5jZW9mIEVtcHR5RXhwcjtcbn1cbiJdfQ==