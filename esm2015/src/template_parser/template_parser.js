/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { identifierName } from '../compile_metadata';
import { ASTWithSource, EmptyExpr } from '../expression_parser/ast';
import { createTokenForExternalReference, createTokenForReference, Identifiers } from '../identifiers';
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
    get expressionParser() {
        return this._exprParser;
    }
    parse(component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
        var _a;
        const result = this.tryParse(component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces);
        const warnings = result.errors.filter(error => error.level === ParseErrorLevel.WARNING);
        const errors = result.errors.filter(error => error.level === ParseErrorLevel.ERROR);
        if (warnings.length > 0) {
            (_a = this._console) === null || _a === void 0 ? void 0 : _a.warn(`Template parse warnings:\n${warnings.join('\n')}`);
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
            this.transforms.forEach((transform) => {
                result = t.templateVisitAll(transform, result);
            });
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
    visitExpansion(expansion, context) {
        return null;
    }
    visitExpansionCase(expansionCase, context) {
        return null;
    }
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
    visitComment(comment, context) {
        return null;
    }
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
            const sourceSpan = new ParseSourceSpan(elementSourceSpan.start, elementSourceSpan.end, elementSourceSpan.fullStart, `Directive ${identifierName(directive.type)}`);
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
                    errorMsg +=
                        `\n1. If '${boundProp
                            .name}' is an Angular directive, then add 'CommonModule' to the '@NgModule.imports' of this component.` +
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
    visitComment(comment, context) {
        return null;
    }
    visitAttribute(attribute, context) {
        return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
    }
    visitText(text, parent) {
        const ngContentIndex = parent.findNgContentIndex(TEXT_CSS_SELECTOR());
        return new t.TextAst(text.value, ngContentIndex, text.sourceSpan);
    }
    visitExpansion(expansion, context) {
        return expansion;
    }
    visitExpansionCase(expansionCase, context) {
        return expansionCase;
    }
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
        this._ngContentIndexMatcher.match(selector, (selector, ngContentIndex) => {
            ngContentIndices.push(ngContentIndex);
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFtSCxjQUFjLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUlySyxPQUFPLEVBQU0sYUFBYSxFQUFFLFNBQVMsRUFBOEMsTUFBTSwwQkFBMEIsQ0FBQztBQUVwSCxPQUFPLEVBQUMsK0JBQStCLEVBQUUsdUJBQXVCLEVBQUUsV0FBVyxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDckcsT0FBTyxLQUFLLElBQUksTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQWEsZUFBZSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDckUsT0FBTyxFQUFDLGlCQUFpQixFQUFFLFdBQVcsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzdFLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUMxRCxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0RSxPQUFPLEVBQUMsWUFBWSxFQUFFLFdBQVcsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzVELE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMzRSxPQUFPLEVBQUMsc0JBQXNCLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUVqRixPQUFPLEVBQUMsV0FBVyxFQUFFLGVBQWUsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUN6RCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUMzRCxPQUFPLEVBQVUsUUFBUSxFQUFFLFdBQVcsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUV2RCxP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QXVCLENBQXdDLEtBQVU7SUFDdkYsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUU5QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDckIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUNqQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3BDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDbEMsQ0FBQztBQUVELE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxHQUFRO0lBQ3hDLElBQUksR0FBRyxZQUFZLGFBQWEsRUFBRTtRQUNoQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQztLQUNmO0lBQ0QsT0FBTyxHQUFHLFlBQVksU0FBUyxDQUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUGlwZVN1bW1hcnksIENvbXBpbGVUb2tlbk1ldGFkYXRhLCBDb21waWxlVHlwZU1ldGFkYXRhLCBpZGVudGlmaWVyTmFtZX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7Q29tcGlsZXJDb25maWd9IGZyb20gJy4uL2NvbmZpZyc7XG5pbXBvcnQge1NjaGVtYU1ldGFkYXRhfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBFbXB0eUV4cHIsIFBhcnNlZEV2ZW50LCBQYXJzZWRQcm9wZXJ0eSwgUGFyc2VkVmFyaWFibGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCB7Y3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSwgY3JlYXRlVG9rZW5Gb3JSZWZlcmVuY2UsIElkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyLCBQYXJzZVRyZWVSZXN1bHR9IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge3JlbW92ZVdoaXRlc3BhY2VzLCByZXBsYWNlTmdzcH0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtleHBhbmROb2Rlc30gZnJvbSAnLi4vbWxfcGFyc2VyL2ljdV9hc3RfZXhwYW5kZXInO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtpc05nVGVtcGxhdGUsIHNwbGl0TnNOYW1lfSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlRXJyb3JMZXZlbCwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UHJvdmlkZXJFbGVtZW50Q29udGV4dCwgUHJvdmlkZXJWaWV3Q29udGV4dH0gZnJvbSAnLi4vcHJvdmlkZXJfYW5hbHl6ZXInO1xuaW1wb3J0IHtFbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uL3NjaGVtYS9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uL3NlbGVjdG9yJztcbmltcG9ydCB7aXNTdHlsZVVybFJlc29sdmFibGV9IGZyb20gJy4uL3N0eWxlX3VybF9yZXNvbHZlcic7XG5pbXBvcnQge0NvbnNvbGUsIG5ld0FycmF5LCBzeW50YXhFcnJvcn0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vdGVtcGxhdGVfYXN0JztcbmltcG9ydCB7UHJlcGFyc2VkRWxlbWVudFR5cGUsIHByZXBhcnNlRWxlbWVudH0gZnJvbSAnLi90ZW1wbGF0ZV9wcmVwYXJzZXInO1xuXG5jb25zdCBCSU5EX05BTUVfUkVHRVhQID1cbiAgICAvXig/Oig/Oig/OihiaW5kLSl8KGxldC0pfChyZWYtfCMpfChvbi0pfChiaW5kb24tKXwoQCkpKC4qKSl8XFxbXFwoKFteXFwpXSspXFwpXFxdfFxcWyhbXlxcXV0rKVxcXXxcXCgoW15cXCldKylcXCkpJC87XG5cbi8vIEdyb3VwIDEgPSBcImJpbmQtXCJcbmNvbnN0IEtXX0JJTkRfSURYID0gMTtcbi8vIEdyb3VwIDIgPSBcImxldC1cIlxuY29uc3QgS1dfTEVUX0lEWCA9IDI7XG4vLyBHcm91cCAzID0gXCJyZWYtLyNcIlxuY29uc3QgS1dfUkVGX0lEWCA9IDM7XG4vLyBHcm91cCA0ID0gXCJvbi1cIlxuY29uc3QgS1dfT05fSURYID0gNDtcbi8vIEdyb3VwIDUgPSBcImJpbmRvbi1cIlxuY29uc3QgS1dfQklORE9OX0lEWCA9IDU7XG4vLyBHcm91cCA2ID0gXCJAXCJcbmNvbnN0IEtXX0FUX0lEWCA9IDY7XG4vLyBHcm91cCA3ID0gdGhlIGlkZW50aWZpZXIgYWZ0ZXIgXCJiaW5kLVwiLCBcImxldC1cIiwgXCJyZWYtLyNcIiwgXCJvbi1cIiwgXCJiaW5kb24tXCIgb3IgXCJAXCJcbmNvbnN0IElERU5UX0tXX0lEWCA9IDc7XG4vLyBHcm91cCA4ID0gaWRlbnRpZmllciBpbnNpZGUgWygpXVxuY29uc3QgSURFTlRfQkFOQU5BX0JPWF9JRFggPSA4O1xuLy8gR3JvdXAgOSA9IGlkZW50aWZpZXIgaW5zaWRlIFtdXG5jb25zdCBJREVOVF9QUk9QRVJUWV9JRFggPSA5O1xuLy8gR3JvdXAgMTAgPSBpZGVudGlmaWVyIGluc2lkZSAoKVxuY29uc3QgSURFTlRfRVZFTlRfSURYID0gMTA7XG5cbmNvbnN0IFRFTVBMQVRFX0FUVFJfUFJFRklYID0gJyonO1xuY29uc3QgQ0xBU1NfQVRUUiA9ICdjbGFzcyc7XG5cbmxldCBfVEVYVF9DU1NfU0VMRUNUT1IhOiBDc3NTZWxlY3RvcjtcbmZ1bmN0aW9uIFRFWFRfQ1NTX1NFTEVDVE9SKCk6IENzc1NlbGVjdG9yIHtcbiAgaWYgKCFfVEVYVF9DU1NfU0VMRUNUT1IpIHtcbiAgICBfVEVYVF9DU1NfU0VMRUNUT1IgPSBDc3NTZWxlY3Rvci5wYXJzZSgnKicpWzBdO1xuICB9XG4gIHJldHVybiBfVEVYVF9DU1NfU0VMRUNUT1I7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVBhcnNlRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwpIHtcbiAgICBzdXBlcihzcGFuLCBtZXNzYWdlLCBsZXZlbCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUFzdD86IHQuVGVtcGxhdGVBc3RbXSwgcHVibGljIHVzZWRQaXBlcz86IENvbXBpbGVQaXBlU3VtbWFyeVtdLFxuICAgICAgcHVibGljIGVycm9ycz86IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9jb25maWc6IENvbXBpbGVyQ29uZmlnLCBwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgICBwcml2YXRlIF9leHByUGFyc2VyOiBQYXJzZXIsIHByaXZhdGUgX3NjaGVtYVJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksXG4gICAgICBwcml2YXRlIF9odG1sUGFyc2VyOiBIdG1sUGFyc2VyLCBwcml2YXRlIF9jb25zb2xlOiBDb25zb2xlfG51bGwsXG4gICAgICBwdWJsaWMgdHJhbnNmb3JtczogdC5UZW1wbGF0ZUFzdFZpc2l0b3JbXSkge31cblxuICBwdWJsaWMgZ2V0IGV4cHJlc3Npb25QYXJzZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXI7XG4gIH1cblxuICBwYXJzZShcbiAgICAgIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCB0ZW1wbGF0ZTogc3RyaW5nfFBhcnNlVHJlZVJlc3VsdCxcbiAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSwgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSxcbiAgICAgIHRlbXBsYXRlVXJsOiBzdHJpbmcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuKToge3RlbXBsYXRlOiB0LlRlbXBsYXRlQXN0W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXX0ge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMudHJ5UGFyc2UoXG4gICAgICAgIGNvbXBvbmVudCwgdGVtcGxhdGUsIGRpcmVjdGl2ZXMsIHBpcGVzLCBzY2hlbWFzLCB0ZW1wbGF0ZVVybCwgcHJlc2VydmVXaGl0ZXNwYWNlcyk7XG4gICAgY29uc3Qgd2FybmluZ3MgPSByZXN1bHQuZXJyb3JzIS5maWx0ZXIoZXJyb3IgPT4gZXJyb3IubGV2ZWwgPT09IFBhcnNlRXJyb3JMZXZlbC5XQVJOSU5HKTtcblxuICAgIGNvbnN0IGVycm9ycyA9IHJlc3VsdC5lcnJvcnMhLmZpbHRlcihlcnJvciA9PiBlcnJvci5sZXZlbCA9PT0gUGFyc2VFcnJvckxldmVsLkVSUk9SKTtcblxuICAgIGlmICh3YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9jb25zb2xlPy53YXJuKGBUZW1wbGF0ZSBwYXJzZSB3YXJuaW5nczpcXG4ke3dhcm5pbmdzLmpvaW4oJ1xcbicpfWApO1xuICAgIH1cblxuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZXJyb3JTdHJpbmcgPSBlcnJvcnMuam9pbignXFxuJyk7XG4gICAgICB0aHJvdyBzeW50YXhFcnJvcihgVGVtcGxhdGUgcGFyc2UgZXJyb3JzOlxcbiR7ZXJyb3JTdHJpbmd9YCwgZXJyb3JzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge3RlbXBsYXRlOiByZXN1bHQudGVtcGxhdGVBc3QhLCBwaXBlczogcmVzdWx0LnVzZWRQaXBlcyF9O1xuICB9XG5cbiAgdHJ5UGFyc2UoXG4gICAgICBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgdGVtcGxhdGU6IHN0cmluZ3xQYXJzZVRyZWVSZXN1bHQsXG4gICAgICBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBwaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10sIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10sXG4gICAgICB0ZW1wbGF0ZVVybDogc3RyaW5nLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuKTogVGVtcGxhdGVQYXJzZVJlc3VsdCB7XG4gICAgbGV0IGh0bWxQYXJzZVJlc3VsdCA9IHR5cGVvZiB0ZW1wbGF0ZSA9PT0gJ3N0cmluZycgP1xuICAgICAgICB0aGlzLl9odG1sUGFyc2VyIS5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwsIHtcbiAgICAgICAgICB0b2tlbml6ZUV4cGFuc2lvbkZvcm1zOiB0cnVlLFxuICAgICAgICAgIGludGVycG9sYXRpb25Db25maWc6IHRoaXMuZ2V0SW50ZXJwb2xhdGlvbkNvbmZpZyhjb21wb25lbnQpXG4gICAgICAgIH0pIDpcbiAgICAgICAgdGVtcGxhdGU7XG5cbiAgICBpZiAoIXByZXNlcnZlV2hpdGVzcGFjZXMpIHtcbiAgICAgIGh0bWxQYXJzZVJlc3VsdCA9IHJlbW92ZVdoaXRlc3BhY2VzKGh0bWxQYXJzZVJlc3VsdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudHJ5UGFyc2VIdG1sKFxuICAgICAgICB0aGlzLmV4cGFuZEh0bWwoaHRtbFBhcnNlUmVzdWx0KSwgY29tcG9uZW50LCBkaXJlY3RpdmVzLCBwaXBlcywgc2NoZW1hcyk7XG4gIH1cblxuICB0cnlQYXJzZUh0bWwoXG4gICAgICBodG1sQXN0V2l0aEVycm9yczogUGFyc2VUcmVlUmVzdWx0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSxcbiAgICAgIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10pOiBUZW1wbGF0ZVBhcnNlUmVzdWx0IHtcbiAgICBsZXQgcmVzdWx0OiB0LlRlbXBsYXRlQXN0W107XG4gICAgY29uc3QgZXJyb3JzID0gaHRtbEFzdFdpdGhFcnJvcnMuZXJyb3JzO1xuICAgIGNvbnN0IHVzZWRQaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10gPSBbXTtcbiAgICBpZiAoaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHVuaXFEaXJlY3RpdmVzID0gcmVtb3ZlU3VtbWFyeUR1cGxpY2F0ZXMoZGlyZWN0aXZlcyk7XG4gICAgICBjb25zdCB1bmlxUGlwZXMgPSByZW1vdmVTdW1tYXJ5RHVwbGljYXRlcyhwaXBlcyk7XG4gICAgICBjb25zdCBwcm92aWRlclZpZXdDb250ZXh0ID0gbmV3IFByb3ZpZGVyVmlld0NvbnRleHQodGhpcy5fcmVmbGVjdG9yLCBjb21wb25lbnQpO1xuICAgICAgbGV0IGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSB1bmRlZmluZWQhO1xuICAgICAgaWYgKGNvbXBvbmVudC50ZW1wbGF0ZSAmJiBjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvbikge1xuICAgICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnID0ge1xuICAgICAgICAgIHN0YXJ0OiBjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvblswXSxcbiAgICAgICAgICBlbmQ6IGNvbXBvbmVudC50ZW1wbGF0ZS5pbnRlcnBvbGF0aW9uWzFdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlciwgaW50ZXJwb2xhdGlvbkNvbmZpZyEsIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCB1bmlxUGlwZXMsIGVycm9ycyk7XG4gICAgICBjb25zdCBwYXJzZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVQYXJzZVZpc2l0b3IoXG4gICAgICAgICAgdGhpcy5fcmVmbGVjdG9yLCB0aGlzLl9jb25maWcsIHByb3ZpZGVyVmlld0NvbnRleHQsIHVuaXFEaXJlY3RpdmVzLCBiaW5kaW5nUGFyc2VyLFxuICAgICAgICAgIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCBzY2hlbWFzLCBlcnJvcnMpO1xuICAgICAgcmVzdWx0ID0gaHRtbC52aXNpdEFsbChwYXJzZVZpc2l0b3IsIGh0bWxBc3RXaXRoRXJyb3JzLnJvb3ROb2RlcywgRU1QVFlfRUxFTUVOVF9DT05URVhUKTtcbiAgICAgIGVycm9ycy5wdXNoKC4uLnByb3ZpZGVyVmlld0NvbnRleHQuZXJyb3JzKTtcbiAgICAgIHVzZWRQaXBlcy5wdXNoKC4uLmJpbmRpbmdQYXJzZXIuZ2V0VXNlZFBpcGVzKCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBbXTtcbiAgICB9XG4gICAgdGhpcy5fYXNzZXJ0Tm9SZWZlcmVuY2VEdXBsaWNhdGlvbk9uVGVtcGxhdGUocmVzdWx0LCBlcnJvcnMpO1xuXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gbmV3IFRlbXBsYXRlUGFyc2VSZXN1bHQocmVzdWx0LCB1c2VkUGlwZXMsIGVycm9ycyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgdGhpcy50cmFuc2Zvcm1zLmZvckVhY2goKHRyYW5zZm9ybTogdC5UZW1wbGF0ZUFzdFZpc2l0b3IpID0+IHtcbiAgICAgICAgcmVzdWx0ID0gdC50ZW1wbGF0ZVZpc2l0QWxsKHRyYW5zZm9ybSwgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVGVtcGxhdGVQYXJzZVJlc3VsdChyZXN1bHQsIHVzZWRQaXBlcywgZXJyb3JzKTtcbiAgfVxuXG4gIGV4cGFuZEh0bWwoaHRtbEFzdFdpdGhFcnJvcnM6IFBhcnNlVHJlZVJlc3VsdCwgZm9yY2VkOiBib29sZWFuID0gZmFsc2UpOiBQYXJzZVRyZWVSZXN1bHQge1xuICAgIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gaHRtbEFzdFdpdGhFcnJvcnMuZXJyb3JzO1xuXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPT0gMCB8fCBmb3JjZWQpIHtcbiAgICAgIC8vIFRyYW5zZm9ybSBJQ1UgbWVzc2FnZXMgdG8gYW5ndWxhciBkaXJlY3RpdmVzXG4gICAgICBjb25zdCBleHBhbmRlZEh0bWxBc3QgPSBleHBhbmROb2RlcyhodG1sQXN0V2l0aEVycm9ycy5yb290Tm9kZXMpO1xuICAgICAgZXJyb3JzLnB1c2goLi4uZXhwYW5kZWRIdG1sQXN0LmVycm9ycyk7XG4gICAgICBodG1sQXN0V2l0aEVycm9ycyA9IG5ldyBQYXJzZVRyZWVSZXN1bHQoZXhwYW5kZWRIdG1sQXN0Lm5vZGVzLCBlcnJvcnMpO1xuICAgIH1cbiAgICByZXR1cm4gaHRtbEFzdFdpdGhFcnJvcnM7XG4gIH1cblxuICBnZXRJbnRlcnBvbGF0aW9uQ29uZmlnKGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKTogSW50ZXJwb2xhdGlvbkNvbmZpZ3x1bmRlZmluZWQge1xuICAgIGlmIChjb21wb25lbnQudGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBJbnRlcnBvbGF0aW9uQ29uZmlnLmZyb21BcnJheShjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvbik7XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9hc3NlcnROb1JlZmVyZW5jZUR1cGxpY2F0aW9uT25UZW1wbGF0ZShyZXN1bHQ6IHQuVGVtcGxhdGVBc3RbXSwgZXJyb3JzOiBUZW1wbGF0ZVBhcnNlRXJyb3JbXSk6XG4gICAgICB2b2lkIHtcbiAgICBjb25zdCBleGlzdGluZ1JlZmVyZW5jZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICByZXN1bHQuZmlsdGVyKGVsZW1lbnQgPT4gISEoPGFueT5lbGVtZW50KS5yZWZlcmVuY2VzKVxuICAgICAgICAuZm9yRWFjaChlbGVtZW50ID0+ICg8YW55PmVsZW1lbnQpLnJlZmVyZW5jZXMuZm9yRWFjaCgocmVmZXJlbmNlOiB0LlJlZmVyZW5jZUFzdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSByZWZlcmVuY2UubmFtZTtcbiAgICAgICAgICBpZiAoZXhpc3RpbmdSZWZlcmVuY2VzLmluZGV4T2YobmFtZSkgPCAwKSB7XG4gICAgICAgICAgICBleGlzdGluZ1JlZmVyZW5jZXMucHVzaChuYW1lKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVGVtcGxhdGVQYXJzZUVycm9yKFxuICAgICAgICAgICAgICAgIGBSZWZlcmVuY2UgXCIjJHtuYW1lfVwiIGlzIGRlZmluZWQgc2V2ZXJhbCB0aW1lc2AsIHJlZmVyZW5jZS5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgIFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9KSk7XG4gIH1cbn1cblxuY2xhc3MgVGVtcGxhdGVQYXJzZVZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICBzZWxlY3Rvck1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gIGRpcmVjdGl2ZXNJbmRleCA9IG5ldyBNYXA8Q29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIG51bWJlcj4oKTtcbiAgbmdDb250ZW50Q291bnQgPSAwO1xuICBjb250ZW50UXVlcnlTdGFydElkOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgcHJpdmF0ZSBjb25maWc6IENvbXBpbGVyQ29uZmlnLFxuICAgICAgcHVibGljIHByb3ZpZGVyVmlld0NvbnRleHQ6IFByb3ZpZGVyVmlld0NvbnRleHQsIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sXG4gICAgICBwcml2YXRlIF9iaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBwcml2YXRlIF9zY2hlbWFSZWdpc3RyeTogRWxlbWVudFNjaGVtYVJlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBfc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSwgcHJpdmF0ZSBfdGFyZ2V0RXJyb3JzOiBUZW1wbGF0ZVBhcnNlRXJyb3JbXSkge1xuICAgIC8vIE5vdGU6IHF1ZXJpZXMgc3RhcnQgd2l0aCBpZCAxIHNvIHdlIGNhbiB1c2UgdGhlIG51bWJlciBpbiBhIEJsb29tIGZpbHRlciFcbiAgICB0aGlzLmNvbnRlbnRRdWVyeVN0YXJ0SWQgPSBwcm92aWRlclZpZXdDb250ZXh0LmNvbXBvbmVudC52aWV3UXVlcmllcy5sZW5ndGggKyAxO1xuICAgIGRpcmVjdGl2ZXMuZm9yRWFjaCgoZGlyZWN0aXZlLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBDc3NTZWxlY3Rvci5wYXJzZShkaXJlY3RpdmUuc2VsZWN0b3IhKTtcbiAgICAgIHRoaXMuc2VsZWN0b3JNYXRjaGVyLmFkZFNlbGVjdGFibGVzKHNlbGVjdG9yLCBkaXJlY3RpdmUpO1xuICAgICAgdGhpcy5kaXJlY3RpdmVzSW5kZXguc2V0KGRpcmVjdGl2ZSwgaW5kZXgpO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBwYXJlbnQ6IEVsZW1lbnRDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRleCA9IHBhcmVudC5maW5kTmdDb250ZW50SW5kZXgoVEVYVF9DU1NfU0VMRUNUT1IoKSkhO1xuICAgIGNvbnN0IHZhbHVlTm9OZ3NwID0gcmVwbGFjZU5nc3AodGV4dC52YWx1ZSk7XG4gICAgY29uc3QgZXhwciA9IHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VJbnRlcnBvbGF0aW9uKHZhbHVlTm9OZ3NwLCB0ZXh0LnNvdXJjZVNwYW4hKTtcbiAgICByZXR1cm4gZXhwciA/IG5ldyB0LkJvdW5kVGV4dEFzdChleHByLCBuZ0NvbnRlbnRJbmRleCwgdGV4dC5zb3VyY2VTcGFuISkgOlxuICAgICAgICAgICAgICAgICAgbmV3IHQuVGV4dEFzdCh2YWx1ZU5vTmdzcCwgbmdDb250ZW50SW5kZXgsIHRleHQuc291cmNlU3BhbiEpO1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gbmV3IHQuQXR0ckFzdChhdHRyaWJ1dGUubmFtZSwgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcXVlcnlTdGFydEluZGV4ID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgIGNvbnN0IGVsTmFtZSA9IGVsZW1lbnQubmFtZTtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQgJiZcbiAgICAgICAgaXNTdHlsZVVybFJlc29sdmFibGUocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cikpIHtcbiAgICAgIC8vIFNraXBwaW5nIHN0eWxlc2hlZXRzIHdpdGggZWl0aGVyIHJlbGF0aXZlIHVybHMgb3IgcGFja2FnZSBzY2hlbWUgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgIC8vIHRoZW0gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCBlbGVtZW50T3JEaXJlY3RpdmVQcm9wczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGVsZW1lbnRPckRpcmVjdGl2ZVJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdID0gW107XG4gICAgY29uc3QgZWxlbWVudFZhcnM6IHQuVmFyaWFibGVBc3RbXSA9IFtdO1xuICAgIGNvbnN0IGV2ZW50czogdC5Cb3VuZEV2ZW50QXN0W10gPSBbXTtcblxuICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudE9yRGlyZWN0aXZlUHJvcHM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZU1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZUVsZW1lbnRWYXJzOiB0LlZhcmlhYmxlQXN0W10gPSBbXTtcblxuICAgIGxldCBoYXNJbmxpbmVUZW1wbGF0ZXMgPSBmYWxzZTtcbiAgICBjb25zdCBhdHRyczogdC5BdHRyQXN0W10gPSBbXTtcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgZWxlbWVudC5hdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgY29uc3QgcGFyc2VkVmFyaWFibGVzOiBQYXJzZWRWYXJpYWJsZVtdID0gW107XG4gICAgICBjb25zdCBoYXNCaW5kaW5nID0gdGhpcy5fcGFyc2VBdHRyKFxuICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBhdHRyLCBtYXRjaGFibGVBdHRycywgZWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsIGV2ZW50cyxcbiAgICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50VmFycyk7XG4gICAgICBlbGVtZW50VmFycy5wdXNoKC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAodiA9PiB0LlZhcmlhYmxlQXN0LmZyb21QYXJzZWRWYXJpYWJsZSh2KSkpO1xuXG4gICAgICBsZXQgdGVtcGxhdGVWYWx1ZTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGxldCB0ZW1wbGF0ZUtleTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gdGhpcy5fbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyLm5hbWUpO1xuXG4gICAgICBpZiAobm9ybWFsaXplZE5hbWUuc3RhcnRzV2l0aChURU1QTEFURV9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgdGVtcGxhdGVWYWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICAgIHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhhc1RlbXBsYXRlQmluZGluZyA9IHRlbXBsYXRlVmFsdWUgIT0gbnVsbDtcbiAgICAgIGlmIChoYXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgaWYgKGhhc0lubGluZVRlbXBsYXRlcykge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgQ2FuJ3QgaGF2ZSBtdWx0aXBsZSB0ZW1wbGF0ZSBiaW5kaW5ncyBvbiBvbmUgZWxlbWVudC4gVXNlIG9ubHkgb25lIGF0dHJpYnV0ZSBwcmVmaXhlZCB3aXRoICpgLFxuICAgICAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICAgIGhhc0lubGluZVRlbXBsYXRlcyA9IHRydWU7XG4gICAgICAgIGNvbnN0IHBhcnNlZFZhcmlhYmxlczogUGFyc2VkVmFyaWFibGVbXSA9IFtdO1xuICAgICAgICBjb25zdCBhYnNvbHV0ZU9mZnNldCA9IChhdHRyLnZhbHVlU3BhbiB8fCBhdHRyLnNvdXJjZVNwYW4pLnN0YXJ0Lm9mZnNldDtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUlubGluZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICAgIHRlbXBsYXRlS2V5ISwgdGVtcGxhdGVWYWx1ZSEsIGF0dHIuc291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQsIHRlbXBsYXRlTWF0Y2hhYmxlQXR0cnMsXG4gICAgICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCBwYXJzZWRWYXJpYWJsZXMpO1xuICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRWYXJzLnB1c2goLi4ucGFyc2VkVmFyaWFibGVzLm1hcCh2ID0+IHQuVmFyaWFibGVBc3QuZnJvbVBhcnNlZFZhcmlhYmxlKHYpKSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaGFzVGVtcGxhdGVCaW5kaW5nKSB7XG4gICAgICAgIC8vIGRvbid0IGluY2x1ZGUgdGhlIGJpbmRpbmdzIGFzIGF0dHJpYnV0ZXMgYXMgd2VsbCBpbiB0aGUgQVNUXG4gICAgICAgIGF0dHJzLnB1c2godGhpcy52aXNpdEF0dHJpYnV0ZShhdHRyLCBudWxsKSk7XG4gICAgICAgIG1hdGNoYWJsZUF0dHJzLnB1c2goW2F0dHIubmFtZSwgYXR0ci52YWx1ZV0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgZWxlbWVudENzc1NlbGVjdG9yID0gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKGVsTmFtZSwgbWF0Y2hhYmxlQXR0cnMpO1xuICAgIGNvbnN0IHtkaXJlY3RpdmVzOiBkaXJlY3RpdmVNZXRhcywgbWF0Y2hFbGVtZW50fSA9XG4gICAgICAgIHRoaXMuX3BhcnNlRGlyZWN0aXZlcyh0aGlzLnNlbGVjdG9yTWF0Y2hlciwgZWxlbWVudENzc1NlbGVjdG9yKTtcbiAgICBjb25zdCByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZUFzdFtdID0gW107XG4gICAgY29uc3QgYm91bmREaXJlY3RpdmVQcm9wTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkaXJlY3RpdmVBc3RzID0gdGhpcy5fY3JlYXRlRGlyZWN0aXZlQXN0cyhcbiAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQsIGVsZW1lbnQubmFtZSwgZGlyZWN0aXZlTWV0YXMsIGVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLFxuICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50LnNvdXJjZVNwYW4hLCByZWZlcmVuY2VzLCBib3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgY29uc3QgZWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10gPSB0aGlzLl9jcmVhdGVFbGVtZW50UHJvcGVydHlBc3RzKFxuICAgICAgICBlbGVtZW50Lm5hbWUsIGVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCBib3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgY29uc3QgaXNWaWV3Um9vdCA9IHBhcmVudC5pc1RlbXBsYXRlRWxlbWVudCB8fCBoYXNJbmxpbmVUZW1wbGF0ZXM7XG5cbiAgICBjb25zdCBwcm92aWRlckNvbnRleHQgPSBuZXcgUHJvdmlkZXJFbGVtZW50Q29udGV4dChcbiAgICAgICAgdGhpcy5wcm92aWRlclZpZXdDb250ZXh0LCBwYXJlbnQucHJvdmlkZXJDb250ZXh0ISwgaXNWaWV3Um9vdCwgZGlyZWN0aXZlQXN0cywgYXR0cnMsXG4gICAgICAgIHJlZmVyZW5jZXMsIGlzVGVtcGxhdGVFbGVtZW50LCBxdWVyeVN0YXJ0SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiEpO1xuXG4gICAgY29uc3QgY2hpbGRyZW46IHQuVGVtcGxhdGVBc3RbXSA9IGh0bWwudmlzaXRBbGwoXG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQubm9uQmluZGFibGUgPyBOT05fQklOREFCTEVfVklTSVRPUiA6IHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4sXG4gICAgICAgIEVsZW1lbnRDb250ZXh0LmNyZWF0ZShcbiAgICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBkaXJlY3RpdmVBc3RzLFxuICAgICAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQgPyBwYXJlbnQucHJvdmlkZXJDb250ZXh0ISA6IHByb3ZpZGVyQ29udGV4dCkpO1xuICAgIHByb3ZpZGVyQ29udGV4dC5hZnRlckVsZW1lbnQoKTtcbiAgICAvLyBPdmVycmlkZSB0aGUgYWN0dWFsIHNlbGVjdG9yIHdoZW4gdGhlIGBuZ1Byb2plY3RBc2AgYXR0cmlidXRlIGlzIHByb3ZpZGVkXG4gICAgY29uc3QgcHJvamVjdGlvblNlbGVjdG9yID0gcHJlcGFyc2VkRWxlbWVudC5wcm9qZWN0QXMgIT0gJycgP1xuICAgICAgICBDc3NTZWxlY3Rvci5wYXJzZShwcmVwYXJzZWRFbGVtZW50LnByb2plY3RBcylbMF0gOlxuICAgICAgICBlbGVtZW50Q3NzU2VsZWN0b3I7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KHByb2plY3Rpb25TZWxlY3RvcikhO1xuICAgIGxldCBwYXJzZWRFbGVtZW50OiB0LlRlbXBsYXRlQXN0O1xuXG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuTkdfQ09OVEVOVCkge1xuICAgICAgLy8gYDxuZy1jb250ZW50PmAgZWxlbWVudFxuICAgICAgaWYgKGVsZW1lbnQuY2hpbGRyZW4gJiYgIWVsZW1lbnQuY2hpbGRyZW4uZXZlcnkoX2lzRW1wdHlUZXh0Tm9kZSkpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYDxuZy1jb250ZW50PiBlbGVtZW50IGNhbm5vdCBoYXZlIGNvbnRlbnQuYCwgZWxlbWVudC5zb3VyY2VTcGFuISk7XG4gICAgICB9XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5OZ0NvbnRlbnRBc3QoXG4gICAgICAgICAgdGhpcy5uZ0NvbnRlbnRDb3VudCsrLCBoYXNJbmxpbmVUZW1wbGF0ZXMgPyBudWxsISA6IG5nQ29udGVudEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4hKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAvLyBgPG5nLXRlbXBsYXRlPmAgZWxlbWVudFxuICAgICAgdGhpcy5fYXNzZXJ0QWxsRXZlbnRzUHVibGlzaGVkQnlEaXJlY3RpdmVzKGRpcmVjdGl2ZUFzdHMsIGV2ZW50cyk7XG4gICAgICB0aGlzLl9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgICAgIGRpcmVjdGl2ZUFzdHMsIGVsZW1lbnRQcm9wcywgZWxlbWVudC5zb3VyY2VTcGFuISk7XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5FbWJlZGRlZFRlbXBsYXRlQXN0KFxuICAgICAgICAgIGF0dHJzLCBldmVudHMsIHJlZmVyZW5jZXMsIGVsZW1lbnRWYXJzLCBwcm92aWRlckNvbnRleHQudHJhbnNmb3JtZWREaXJlY3RpdmVBc3RzLFxuICAgICAgICAgIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1Qcm92aWRlcnMsIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXIsXG4gICAgICAgICAgcHJvdmlkZXJDb250ZXh0LnF1ZXJ5TWF0Y2hlcywgY2hpbGRyZW4sIGhhc0lubGluZVRlbXBsYXRlcyA/IG51bGwhIDogbmdDb250ZW50SW5kZXgsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuISk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGVsZW1lbnQgb3RoZXIgdGhhbiBgPG5nLWNvbnRlbnQ+YCBhbmQgYDxuZy10ZW1wbGF0ZT5gXG4gICAgICB0aGlzLl9hc3NlcnRFbGVtZW50RXhpc3RzKG1hdGNoRWxlbWVudCwgZWxlbWVudCk7XG4gICAgICB0aGlzLl9hc3NlcnRPbmx5T25lQ29tcG9uZW50KGRpcmVjdGl2ZUFzdHMsIGVsZW1lbnQuc291cmNlU3BhbiEpO1xuXG4gICAgICBjb25zdCBuZ0NvbnRlbnRJbmRleCA9XG4gICAgICAgICAgaGFzSW5saW5lVGVtcGxhdGVzID8gbnVsbCA6IHBhcmVudC5maW5kTmdDb250ZW50SW5kZXgocHJvamVjdGlvblNlbGVjdG9yKTtcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5FbGVtZW50QXN0KFxuICAgICAgICAgIGVsTmFtZSwgYXR0cnMsIGVsZW1lbnRQcm9wcywgZXZlbnRzLCByZWZlcmVuY2VzLCBwcm92aWRlckNvbnRleHQudHJhbnNmb3JtZWREaXJlY3RpdmVBc3RzLFxuICAgICAgICAgIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1Qcm92aWRlcnMsIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXIsXG4gICAgICAgICAgcHJvdmlkZXJDb250ZXh0LnF1ZXJ5TWF0Y2hlcywgY2hpbGRyZW4sIGhhc0lubGluZVRlbXBsYXRlcyA/IG51bGwgOiBuZ0NvbnRlbnRJbmRleCxcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3BhbiB8fCBudWxsKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzSW5saW5lVGVtcGxhdGVzKSB7XG4gICAgICAvLyBUaGUgZWxlbWVudCBhcyBhICotYXR0cmlidXRlXG4gICAgICBjb25zdCB0ZW1wbGF0ZVF1ZXJ5U3RhcnRJbmRleCA9IHRoaXMuY29udGVudFF1ZXJ5U3RhcnRJZDtcbiAgICAgIGNvbnN0IHRlbXBsYXRlU2VsZWN0b3IgPSBjcmVhdGVFbGVtZW50Q3NzU2VsZWN0b3IoJ25nLXRlbXBsYXRlJywgdGVtcGxhdGVNYXRjaGFibGVBdHRycyk7XG4gICAgICBjb25zdCB7ZGlyZWN0aXZlc30gPSB0aGlzLl9wYXJzZURpcmVjdGl2ZXModGhpcy5zZWxlY3Rvck1hdGNoZXIsIHRlbXBsYXRlU2VsZWN0b3IpO1xuICAgICAgY29uc3QgdGVtcGxhdGVCb3VuZERpcmVjdGl2ZVByb3BOYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgY29uc3QgdGVtcGxhdGVEaXJlY3RpdmVBc3RzID0gdGhpcy5fY3JlYXRlRGlyZWN0aXZlQXN0cyhcbiAgICAgICAgICB0cnVlLCBlbE5hbWUsIGRpcmVjdGl2ZXMsIHRlbXBsYXRlRWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsIFtdLCBlbGVtZW50LnNvdXJjZVNwYW4hLCBbXSxcbiAgICAgICAgICB0ZW1wbGF0ZUJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10gPSB0aGlzLl9jcmVhdGVFbGVtZW50UHJvcGVydHlBc3RzKFxuICAgICAgICAgIGVsTmFtZSwgdGVtcGxhdGVFbGVtZW50T3JEaXJlY3RpdmVQcm9wcywgdGVtcGxhdGVCb3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgICB0aGlzLl9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgICAgIHRlbXBsYXRlRGlyZWN0aXZlQXN0cywgdGVtcGxhdGVFbGVtZW50UHJvcHMsIGVsZW1lbnQuc291cmNlU3BhbiEpO1xuICAgICAgY29uc3QgdGVtcGxhdGVQcm92aWRlckNvbnRleHQgPSBuZXcgUHJvdmlkZXJFbGVtZW50Q29udGV4dChcbiAgICAgICAgICB0aGlzLnByb3ZpZGVyVmlld0NvbnRleHQsIHBhcmVudC5wcm92aWRlckNvbnRleHQhLCBwYXJlbnQuaXNUZW1wbGF0ZUVsZW1lbnQsXG4gICAgICAgICAgdGVtcGxhdGVEaXJlY3RpdmVBc3RzLCBbXSwgW10sIHRydWUsIHRlbXBsYXRlUXVlcnlTdGFydEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4hKTtcbiAgICAgIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LmFmdGVyRWxlbWVudCgpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRW1iZWRkZWRUZW1wbGF0ZUFzdChcbiAgICAgICAgICBbXSwgW10sIFtdLCB0ZW1wbGF0ZUVsZW1lbnRWYXJzLCB0ZW1wbGF0ZVByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZERpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgdGVtcGxhdGVQcm92aWRlckNvbnRleHQudHJhbnNmb3JtUHJvdmlkZXJzLFxuICAgICAgICAgIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lciwgdGVtcGxhdGVQcm92aWRlckNvbnRleHQucXVlcnlNYXRjaGVzLFxuICAgICAgICAgIFtwYXJzZWRFbGVtZW50XSwgbmdDb250ZW50SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiEpO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJzZWRFbGVtZW50O1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBdHRyKFxuICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIGF0dHI6IGh0bWwuQXR0cmlidXRlLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCB0YXJnZXRFdmVudHM6IHQuQm91bmRFdmVudEFzdFtdLFxuICAgICAgdGFyZ2V0UmVmczogRWxlbWVudE9yRGlyZWN0aXZlUmVmW10sIHRhcmdldFZhcnM6IHQuVmFyaWFibGVBc3RbXSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLl9ub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHIubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgIGNvbnN0IHNyY1NwYW4gPSBhdHRyLnNvdXJjZVNwYW47XG4gICAgY29uc3QgYWJzb2x1dGVPZmZzZXQgPSBhdHRyLnZhbHVlU3BhbiA/IGF0dHIudmFsdWVTcGFuLnN0YXJ0Lm9mZnNldCA6IHNyY1NwYW4uc3RhcnQub2Zmc2V0O1xuXG4gICAgY29uc3QgYm91bmRFdmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICBjb25zdCBiaW5kUGFydHMgPSBuYW1lLm1hdGNoKEJJTkRfTkFNRV9SRUdFWFApO1xuICAgIGxldCBoYXNCaW5kaW5nID0gZmFsc2U7XG5cbiAgICBpZiAoYmluZFBhcnRzICE9PSBudWxsKSB7XG4gICAgICBoYXNCaW5kaW5nID0gdHJ1ZTtcbiAgICAgIGlmIChiaW5kUGFydHNbS1dfQklORF9JRFhdICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0xFVF9JRFhdKSB7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgICB0aGlzLl9wYXJzZVZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCB0YXJnZXRWYXJzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCJsZXQtXCIgaXMgb25seSBzdXBwb3J0ZWQgb24gbmctdGVtcGxhdGUgZWxlbWVudHMuYCwgc3JjU3Bhbik7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfUkVGX0lEWF0pIHtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICB0aGlzLl9wYXJzZVJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0UmVmcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX09OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQklORE9OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICAgIHRoaXMuX3BhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQVRfSURYXSkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHIudmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICAgIHRhcmdldFByb3BzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICAgIHRoaXMuX3BhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSwgdmFsdWUsIHNyY1NwYW4sIGF0dHIudmFsdWVTcGFuIHx8IHNyY1NwYW4sXG4gICAgICAgICAgICB0YXJnZXRNYXRjaGFibGVBdHRycywgYm91bmRFdmVudHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBhYnNvbHV0ZU9mZnNldCwgYXR0ci52YWx1ZVNwYW4sXG4gICAgICAgICAgICB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0ci52YWx1ZVNwYW4gfHwgc3JjU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhc0JpbmRpbmcgPSB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIG5hbWUsIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9XG5cbiAgICBpZiAoIWhhc0JpbmRpbmcpIHtcbiAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VMaXRlcmFsQXR0cihcbiAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHIudmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgIH1cblxuICAgIHRhcmdldEV2ZW50cy5wdXNoKC4uLmJvdW5kRXZlbnRzLm1hcChlID0+IHQuQm91bmRFdmVudEFzdC5mcm9tUGFyc2VkRXZlbnQoZSkpKTtcblxuICAgIHJldHVybiBoYXNCaW5kaW5nO1xuICB9XG5cbiAgcHJpdmF0ZSBfbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gL15kYXRhLS9pLnRlc3QoYXR0ck5hbWUpID8gYXR0ck5hbWUuc3Vic3RyaW5nKDUpIDogYXR0ck5hbWU7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVZhcmlhYmxlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHRhcmdldFZhcnM6IHQuVmFyaWFibGVBc3RbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gdmFyaWFibGUgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9IGVsc2UgaWYgKGlkZW50aWZpZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgVmFyaWFibGUgZG9lcyBub3QgaGF2ZSBhIG5hbWVgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICB0YXJnZXRWYXJzLnB1c2gobmV3IHQuVmFyaWFibGVBc3QoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUmVmZXJlbmNlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRSZWZzOiBFbGVtZW50T3JEaXJlY3RpdmVSZWZbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gcmVmZXJlbmNlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfSBlbHNlIGlmIChpZGVudGlmaWVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYFJlZmVyZW5jZSBkb2VzIG5vdCBoYXZlIGEgbmFtZWAsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHRhcmdldFJlZnMucHVzaChuZXcgRWxlbWVudE9yRGlyZWN0aXZlUmVmKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgYCR7bmFtZX1DaGFuZ2VgLCBgJHtleHByZXNzaW9ufT0kZXZlbnRgLCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICB0YXJnZXRFdmVudHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VEaXJlY3RpdmVzKHNlbGVjdG9yTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyLCBlbGVtZW50Q3NzU2VsZWN0b3I6IENzc1NlbGVjdG9yKTpcbiAgICAgIHtkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBtYXRjaEVsZW1lbnQ6IGJvb2xlYW59IHtcbiAgICAvLyBOZWVkIHRvIHNvcnQgdGhlIGRpcmVjdGl2ZXMgc28gdGhhdCB3ZSBnZXQgY29uc2lzdGVudCByZXN1bHRzIHRocm91Z2hvdXQsXG4gICAgLy8gYXMgc2VsZWN0b3JNYXRjaGVyIHVzZXMgTWFwcyBpbnNpZGUuXG4gICAgLy8gQWxzbyBkZWR1cGxpY2F0ZSBkaXJlY3RpdmVzIGFzIHRoZXkgbWlnaHQgbWF0Y2ggbW9yZSB0aGFuIG9uZSB0aW1lIVxuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXdBcnJheSh0aGlzLmRpcmVjdGl2ZXNJbmRleC5zaXplKTtcbiAgICAvLyBXaGV0aGVyIGFueSBkaXJlY3RpdmUgc2VsZWN0b3IgbWF0Y2hlcyBvbiB0aGUgZWxlbWVudCBuYW1lXG4gICAgbGV0IG1hdGNoRWxlbWVudCA9IGZhbHNlO1xuXG4gICAgc2VsZWN0b3JNYXRjaGVyLm1hdGNoKGVsZW1lbnRDc3NTZWxlY3RvciwgKHNlbGVjdG9yLCBkaXJlY3RpdmUpID0+IHtcbiAgICAgIGRpcmVjdGl2ZXNbdGhpcy5kaXJlY3RpdmVzSW5kZXguZ2V0KGRpcmVjdGl2ZSkhXSA9IGRpcmVjdGl2ZTtcbiAgICAgIG1hdGNoRWxlbWVudCA9IG1hdGNoRWxlbWVudCB8fCBzZWxlY3Rvci5oYXNFbGVtZW50U2VsZWN0b3IoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBkaXJlY3RpdmVzOiBkaXJlY3RpdmVzLmZpbHRlcihkaXIgPT4gISFkaXIpLFxuICAgICAgbWF0Y2hFbGVtZW50LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVEaXJlY3RpdmVBc3RzKFxuICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIGVsZW1lbnROYW1lOiBzdHJpbmcsIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sXG4gICAgICBwcm9wczogUGFyc2VkUHJvcGVydHlbXSwgZWxlbWVudE9yRGlyZWN0aXZlUmVmczogRWxlbWVudE9yRGlyZWN0aXZlUmVmW10sXG4gICAgICBlbGVtZW50U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB0YXJnZXRSZWZlcmVuY2VzOiB0LlJlZmVyZW5jZUFzdFtdLFxuICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXM6IFNldDxzdHJpbmc+KTogdC5EaXJlY3RpdmVBc3RbXSB7XG4gICAgY29uc3QgbWF0Y2hlZFJlZmVyZW5jZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBsZXQgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSA9IG51bGwhO1xuXG4gICAgY29uc3QgZGlyZWN0aXZlQXN0cyA9IGRpcmVjdGl2ZXMubWFwKChkaXJlY3RpdmUpID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICAgIGVsZW1lbnRTb3VyY2VTcGFuLnN0YXJ0LCBlbGVtZW50U291cmNlU3Bhbi5lbmQsIGVsZW1lbnRTb3VyY2VTcGFuLmZ1bGxTdGFydCxcbiAgICAgICAgICBgRGlyZWN0aXZlICR7aWRlbnRpZmllck5hbWUoZGlyZWN0aXZlLnR5cGUpfWApO1xuXG4gICAgICBpZiAoZGlyZWN0aXZlLmlzQ29tcG9uZW50KSB7XG4gICAgICAgIGNvbXBvbmVudCA9IGRpcmVjdGl2ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpcmVjdGl2ZVByb3BlcnRpZXM6IHQuQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdFtdID0gW107XG4gICAgICBjb25zdCBib3VuZFByb3BlcnRpZXMgPVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdFByb3BlcnR5QXN0cyhkaXJlY3RpdmUsIGVsZW1lbnROYW1lLCBzb3VyY2VTcGFuKSE7XG5cbiAgICAgIGxldCBob3N0UHJvcGVydGllcyA9XG4gICAgICAgICAgYm91bmRQcm9wZXJ0aWVzLm1hcChwcm9wID0+IHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3QuZnJvbUJvdW5kUHJvcGVydHkocHJvcCkpO1xuICAgICAgLy8gTm90ZTogV2UgbmVlZCB0byBjaGVjayB0aGUgaG9zdCBwcm9wZXJ0aWVzIGhlcmUgYXMgd2VsbCxcbiAgICAgIC8vIGFzIHdlIGRvbid0IGtub3cgdGhlIGVsZW1lbnQgbmFtZSBpbiB0aGUgRGlyZWN0aXZlV3JhcHBlckNvbXBpbGVyIHlldC5cbiAgICAgIGhvc3RQcm9wZXJ0aWVzID0gdGhpcy5fY2hlY2tQcm9wZXJ0aWVzSW5TY2hlbWEoZWxlbWVudE5hbWUsIGhvc3RQcm9wZXJ0aWVzKTtcbiAgICAgIGNvbnN0IHBhcnNlZEV2ZW50cyA9IHRoaXMuX2JpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdEV2ZW50QXN0cyhkaXJlY3RpdmUsIHNvdXJjZVNwYW4pITtcbiAgICAgIHRoaXMuX2NyZWF0ZURpcmVjdGl2ZVByb3BlcnR5QXN0cyhcbiAgICAgICAgICBkaXJlY3RpdmUuaW5wdXRzLCBwcm9wcywgZGlyZWN0aXZlUHJvcGVydGllcywgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXMpO1xuICAgICAgZWxlbWVudE9yRGlyZWN0aXZlUmVmcy5mb3JFYWNoKChlbE9yRGlyUmVmKSA9PiB7XG4gICAgICAgIGlmICgoZWxPckRpclJlZi52YWx1ZS5sZW5ndGggPT09IDAgJiYgZGlyZWN0aXZlLmlzQ29tcG9uZW50KSB8fFxuICAgICAgICAgICAgKGVsT3JEaXJSZWYuaXNSZWZlcmVuY2VUb0RpcmVjdGl2ZShkaXJlY3RpdmUpKSkge1xuICAgICAgICAgIHRhcmdldFJlZmVyZW5jZXMucHVzaChuZXcgdC5SZWZlcmVuY2VBc3QoXG4gICAgICAgICAgICAgIGVsT3JEaXJSZWYubmFtZSwgY3JlYXRlVG9rZW5Gb3JSZWZlcmVuY2UoZGlyZWN0aXZlLnR5cGUucmVmZXJlbmNlKSwgZWxPckRpclJlZi52YWx1ZSxcbiAgICAgICAgICAgICAgZWxPckRpclJlZi5zb3VyY2VTcGFuKSk7XG4gICAgICAgICAgbWF0Y2hlZFJlZmVyZW5jZXMuYWRkKGVsT3JEaXJSZWYubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgY29uc3QgaG9zdEV2ZW50cyA9IHBhcnNlZEV2ZW50cy5tYXAoZSA9PiB0LkJvdW5kRXZlbnRBc3QuZnJvbVBhcnNlZEV2ZW50KGUpKTtcbiAgICAgIGNvbnN0IGNvbnRlbnRRdWVyeVN0YXJ0SWQgPSB0aGlzLmNvbnRlbnRRdWVyeVN0YXJ0SWQ7XG4gICAgICB0aGlzLmNvbnRlbnRRdWVyeVN0YXJ0SWQgKz0gZGlyZWN0aXZlLnF1ZXJpZXMubGVuZ3RoO1xuICAgICAgcmV0dXJuIG5ldyB0LkRpcmVjdGl2ZUFzdChcbiAgICAgICAgICBkaXJlY3RpdmUsIGRpcmVjdGl2ZVByb3BlcnRpZXMsIGhvc3RQcm9wZXJ0aWVzLCBob3N0RXZlbnRzLCBjb250ZW50UXVlcnlTdGFydElkLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH0pO1xuXG4gICAgZWxlbWVudE9yRGlyZWN0aXZlUmVmcy5mb3JFYWNoKChlbE9yRGlyUmVmKSA9PiB7XG4gICAgICBpZiAoZWxPckRpclJlZi52YWx1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGlmICghbWF0Y2hlZFJlZmVyZW5jZXMuaGFzKGVsT3JEaXJSZWYubmFtZSkpIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgICAgYFRoZXJlIGlzIG5vIGRpcmVjdGl2ZSB3aXRoIFwiZXhwb3J0QXNcIiBzZXQgdG8gXCIke2VsT3JEaXJSZWYudmFsdWV9XCJgLFxuICAgICAgICAgICAgICBlbE9yRGlyUmVmLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFjb21wb25lbnQpIHtcbiAgICAgICAgbGV0IHJlZlRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSA9IG51bGwhO1xuICAgICAgICBpZiAoaXNUZW1wbGF0ZUVsZW1lbnQpIHtcbiAgICAgICAgICByZWZUb2tlbiA9IGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2UodGhpcy5yZWZsZWN0b3IsIElkZW50aWZpZXJzLlRlbXBsYXRlUmVmKTtcbiAgICAgICAgfVxuICAgICAgICB0YXJnZXRSZWZlcmVuY2VzLnB1c2goXG4gICAgICAgICAgICBuZXcgdC5SZWZlcmVuY2VBc3QoZWxPckRpclJlZi5uYW1lLCByZWZUb2tlbiwgZWxPckRpclJlZi52YWx1ZSwgZWxPckRpclJlZi5zb3VyY2VTcGFuKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRpcmVjdGl2ZUFzdHM7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVEaXJlY3RpdmVQcm9wZXJ0eUFzdHMoXG4gICAgICBkaXJlY3RpdmVQcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSwgYm91bmRQcm9wczogUGFyc2VkUHJvcGVydHlbXSxcbiAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcHM6IHQuQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdFtdLFxuICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXM6IFNldDxzdHJpbmc+KSB7XG4gICAgaWYgKGRpcmVjdGl2ZVByb3BlcnRpZXMpIHtcbiAgICAgIGNvbnN0IGJvdW5kUHJvcHNCeU5hbWUgPSBuZXcgTWFwPHN0cmluZywgUGFyc2VkUHJvcGVydHk+KCk7XG4gICAgICBib3VuZFByb3BzLmZvckVhY2goYm91bmRQcm9wID0+IHtcbiAgICAgICAgY29uc3QgcHJldlZhbHVlID0gYm91bmRQcm9wc0J5TmFtZS5nZXQoYm91bmRQcm9wLm5hbWUpO1xuICAgICAgICBpZiAoIXByZXZWYWx1ZSB8fCBwcmV2VmFsdWUuaXNMaXRlcmFsKSB7XG4gICAgICAgICAgLy8gZ2l2ZSBbYV09XCJiXCIgYSBoaWdoZXIgcHJlY2VkZW5jZSB0aGFuIGE9XCJiXCIgb24gdGhlIHNhbWUgZWxlbWVudFxuICAgICAgICAgIGJvdW5kUHJvcHNCeU5hbWUuc2V0KGJvdW5kUHJvcC5uYW1lLCBib3VuZFByb3ApO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgT2JqZWN0LmtleXMoZGlyZWN0aXZlUHJvcGVydGllcykuZm9yRWFjaChkaXJQcm9wID0+IHtcbiAgICAgICAgY29uc3QgZWxQcm9wID0gZGlyZWN0aXZlUHJvcGVydGllc1tkaXJQcm9wXTtcbiAgICAgICAgY29uc3QgYm91bmRQcm9wID0gYm91bmRQcm9wc0J5TmFtZS5nZXQoZWxQcm9wKTtcblxuICAgICAgICAvLyBCaW5kaW5ncyBhcmUgb3B0aW9uYWwsIHNvIHRoaXMgYmluZGluZyBvbmx5IG5lZWRzIHRvIGJlIHNldCB1cCBpZiBhbiBleHByZXNzaW9uIGlzIGdpdmVuLlxuICAgICAgICBpZiAoYm91bmRQcm9wKSB7XG4gICAgICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXMuYWRkKGJvdW5kUHJvcC5uYW1lKTtcbiAgICAgICAgICBpZiAoIWlzRW1wdHlFeHByZXNzaW9uKGJvdW5kUHJvcC5leHByZXNzaW9uKSkge1xuICAgICAgICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wcy5wdXNoKG5ldyB0LkJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QoXG4gICAgICAgICAgICAgICAgZGlyUHJvcCwgYm91bmRQcm9wLm5hbWUsIGJvdW5kUHJvcC5leHByZXNzaW9uLCBib3VuZFByb3Auc291cmNlU3BhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRWxlbWVudFByb3BlcnR5QXN0cyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLFxuICAgICAgYm91bmREaXJlY3RpdmVQcm9wTmFtZXM6IFNldDxzdHJpbmc+KTogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdIHtcbiAgICBjb25zdCBib3VuZEVsZW1lbnRQcm9wczogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdID0gW107XG5cbiAgICBwcm9wcy5mb3JFYWNoKChwcm9wOiBQYXJzZWRQcm9wZXJ0eSkgPT4ge1xuICAgICAgaWYgKCFwcm9wLmlzTGl0ZXJhbCAmJiAhYm91bmREaXJlY3RpdmVQcm9wTmFtZXMuaGFzKHByb3AubmFtZSkpIHtcbiAgICAgICAgY29uc3QgYm91bmRQcm9wID0gdGhpcy5fYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShlbGVtZW50TmFtZSwgcHJvcCk7XG4gICAgICAgIGJvdW5kRWxlbWVudFByb3BzLnB1c2godC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdC5mcm9tQm91bmRQcm9wZXJ0eShib3VuZFByb3ApKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5fY2hlY2tQcm9wZXJ0aWVzSW5TY2hlbWEoZWxlbWVudE5hbWUsIGJvdW5kRWxlbWVudFByb3BzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRDb21wb25lbnREaXJlY3RpdmVzKGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10pOiB0LkRpcmVjdGl2ZUFzdFtdIHtcbiAgICByZXR1cm4gZGlyZWN0aXZlcy5maWx0ZXIoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS5kaXJlY3RpdmUuaXNDb21wb25lbnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmluZENvbXBvbmVudERpcmVjdGl2ZU5hbWVzKGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10pOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpbmRDb21wb25lbnREaXJlY3RpdmVzKGRpcmVjdGl2ZXMpXG4gICAgICAgIC5tYXAoZGlyZWN0aXZlID0+IGlkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS5kaXJlY3RpdmUudHlwZSkhKTtcbiAgfVxuXG4gIHByaXZhdGUgX2Fzc2VydE9ubHlPbmVDb21wb25lbnQoZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgY29uc3QgY29tcG9uZW50VHlwZU5hbWVzID0gdGhpcy5fZmluZENvbXBvbmVudERpcmVjdGl2ZU5hbWVzKGRpcmVjdGl2ZXMpO1xuICAgIGlmIChjb21wb25lbnRUeXBlTmFtZXMubGVuZ3RoID4gMSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYE1vcmUgdGhhbiBvbmUgY29tcG9uZW50IG1hdGNoZWQgb24gdGhpcyBlbGVtZW50LlxcbmAgK1xuICAgICAgICAgICAgICBgTWFrZSBzdXJlIHRoYXQgb25seSBvbmUgY29tcG9uZW50J3Mgc2VsZWN0b3IgY2FuIG1hdGNoIGEgZ2l2ZW4gZWxlbWVudC5cXG5gICtcbiAgICAgICAgICAgICAgYENvbmZsaWN0aW5nIGNvbXBvbmVudHM6ICR7Y29tcG9uZW50VHlwZU5hbWVzLmpvaW4oJywnKX1gLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlIHN1cmUgdGhhdCBub24tYW5ndWxhciB0YWdzIGNvbmZvcm0gdG8gdGhlIHNjaGVtYXMuXG4gICAqXG4gICAqIE5vdGU6IEFuIGVsZW1lbnQgaXMgY29uc2lkZXJlZCBhbiBhbmd1bGFyIHRhZyB3aGVuIGF0IGxlYXN0IG9uZSBkaXJlY3RpdmUgc2VsZWN0b3IgbWF0Y2hlcyB0aGVcbiAgICogdGFnIG5hbWUuXG4gICAqXG4gICAqIEBwYXJhbSBtYXRjaEVsZW1lbnQgV2hldGhlciBhbnkgZGlyZWN0aXZlIGhhcyBtYXRjaGVkIG9uIHRoZSB0YWcgbmFtZVxuICAgKiBAcGFyYW0gZWxlbWVudCB0aGUgaHRtbCBlbGVtZW50XG4gICAqL1xuICBwcml2YXRlIF9hc3NlcnRFbGVtZW50RXhpc3RzKG1hdGNoRWxlbWVudDogYm9vbGVhbiwgZWxlbWVudDogaHRtbC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxOYW1lID0gZWxlbWVudC5uYW1lLnJlcGxhY2UoL146eGh0bWw6LywgJycpO1xuXG4gICAgaWYgKCFtYXRjaEVsZW1lbnQgJiYgIXRoaXMuX3NjaGVtYVJlZ2lzdHJ5Lmhhc0VsZW1lbnQoZWxOYW1lLCB0aGlzLl9zY2hlbWFzKSkge1xuICAgICAgbGV0IGVycm9yTXNnID0gYCcke2VsTmFtZX0nIGlzIG5vdCBhIGtub3duIGVsZW1lbnQ6XFxuYDtcbiAgICAgIGVycm9yTXNnICs9IGAxLiBJZiAnJHtcbiAgICAgICAgICBlbE5hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbXBvbmVudCwgdGhlbiB2ZXJpZnkgdGhhdCBpdCBpcyBwYXJ0IG9mIHRoaXMgbW9kdWxlLlxcbmA7XG4gICAgICBpZiAoZWxOYW1lLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgIGVycm9yTXNnICs9IGAyLiBJZiAnJHtcbiAgICAgICAgICAgIGVsTmFtZX0nIGlzIGEgV2ViIENvbXBvbmVudCB0aGVuIGFkZCAnQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQgdG8gc3VwcHJlc3MgdGhpcyBtZXNzYWdlLmA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlcnJvck1zZyArPVxuICAgICAgICAgICAgYDIuIFRvIGFsbG93IGFueSBlbGVtZW50IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVycm9yTXNnLCBlbGVtZW50LnNvdXJjZVNwYW4hKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSwgZWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10sXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBjb25zdCBjb21wb25lbnRUeXBlTmFtZXM6IHN0cmluZ1tdID0gdGhpcy5fZmluZENvbXBvbmVudERpcmVjdGl2ZU5hbWVzKGRpcmVjdGl2ZXMpO1xuICAgIGlmIChjb21wb25lbnRUeXBlTmFtZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYENvbXBvbmVudHMgb24gYW4gZW1iZWRkZWQgdGVtcGxhdGU6ICR7Y29tcG9uZW50VHlwZU5hbWVzLmpvaW4oJywnKX1gLCBzb3VyY2VTcGFuKTtcbiAgICB9XG4gICAgZWxlbWVudFByb3BzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgUHJvcGVydHkgYmluZGluZyAke1xuICAgICAgICAgICAgICBwcm9wLm5hbWV9IG5vdCB1c2VkIGJ5IGFueSBkaXJlY3RpdmUgb24gYW4gZW1iZWRkZWQgdGVtcGxhdGUuIE1ha2Ugc3VyZSB0aGF0IHRoZSBwcm9wZXJ0eSBuYW1lIGlzIHNwZWxsZWQgY29ycmVjdGx5IGFuZCBhbGwgZGlyZWN0aXZlcyBhcmUgbGlzdGVkIGluIHRoZSBcIkBOZ01vZHVsZS5kZWNsYXJhdGlvbnNcIi5gLFxuICAgICAgICAgIHNvdXJjZVNwYW4pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXNzZXJ0QWxsRXZlbnRzUHVibGlzaGVkQnlEaXJlY3RpdmVzKFxuICAgICAgZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSwgZXZlbnRzOiB0LkJvdW5kRXZlbnRBc3RbXSkge1xuICAgIGNvbnN0IGFsbERpcmVjdGl2ZUV2ZW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgZGlyZWN0aXZlcy5mb3JFYWNoKGRpcmVjdGl2ZSA9PiB7XG4gICAgICBPYmplY3Qua2V5cyhkaXJlY3RpdmUuZGlyZWN0aXZlLm91dHB1dHMpLmZvckVhY2goayA9PiB7XG4gICAgICAgIGNvbnN0IGV2ZW50TmFtZSA9IGRpcmVjdGl2ZS5kaXJlY3RpdmUub3V0cHV0c1trXTtcbiAgICAgICAgYWxsRGlyZWN0aXZlRXZlbnRzLmFkZChldmVudE5hbWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBldmVudHMuZm9yRWFjaChldmVudCA9PiB7XG4gICAgICBpZiAoZXZlbnQudGFyZ2V0ICE9IG51bGwgfHwgIWFsbERpcmVjdGl2ZUV2ZW50cy5oYXMoZXZlbnQubmFtZSkpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICBgRXZlbnQgYmluZGluZyAke1xuICAgICAgICAgICAgICAgIGV2ZW50XG4gICAgICAgICAgICAgICAgICAgIC5mdWxsTmFtZX0gbm90IGVtaXR0ZWQgYnkgYW55IGRpcmVjdGl2ZSBvbiBhbiBlbWJlZGRlZCB0ZW1wbGF0ZS4gTWFrZSBzdXJlIHRoYXQgdGhlIGV2ZW50IG5hbWUgaXMgc3BlbGxlZCBjb3JyZWN0bHkgYW5kIGFsbCBkaXJlY3RpdmVzIGFyZSBsaXN0ZWQgaW4gdGhlIFwiQE5nTW9kdWxlLmRlY2xhcmF0aW9uc1wiLmAsXG4gICAgICAgICAgICBldmVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2NoZWNrUHJvcGVydGllc0luU2NoZW1hKGVsZW1lbnROYW1lOiBzdHJpbmcsIGJvdW5kUHJvcHM6IHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSk6XG4gICAgICB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10ge1xuICAgIC8vIE5vdGU6IFdlIGNhbid0IGZpbHRlciBvdXQgZW1wdHkgZXhwcmVzc2lvbnMgYmVmb3JlIHRoaXMgbWV0aG9kLFxuICAgIC8vIGFzIHdlIHN0aWxsIHdhbnQgdG8gdmFsaWRhdGUgdGhlbSFcbiAgICByZXR1cm4gYm91bmRQcm9wcy5maWx0ZXIoKGJvdW5kUHJvcCkgPT4ge1xuICAgICAgaWYgKGJvdW5kUHJvcC50eXBlID09PSB0LlByb3BlcnR5QmluZGluZ1R5cGUuUHJvcGVydHkgJiZcbiAgICAgICAgICAhdGhpcy5fc2NoZW1hUmVnaXN0cnkuaGFzUHJvcGVydHkoZWxlbWVudE5hbWUsIGJvdW5kUHJvcC5uYW1lLCB0aGlzLl9zY2hlbWFzKSkge1xuICAgICAgICBsZXQgZXJyb3JNc2cgPSBgQ2FuJ3QgYmluZCB0byAnJHtib3VuZFByb3AubmFtZX0nIHNpbmNlIGl0IGlzbid0IGEga25vd24gcHJvcGVydHkgb2YgJyR7XG4gICAgICAgICAgICBlbGVtZW50TmFtZX0nLmA7XG4gICAgICAgIGlmIChlbGVtZW50TmFtZS5zdGFydHNXaXRoKCduZy0nKSkge1xuICAgICAgICAgIGVycm9yTXNnICs9XG4gICAgICAgICAgICAgIGBcXG4xLiBJZiAnJHtcbiAgICAgICAgICAgICAgICAgIGJvdW5kUHJvcFxuICAgICAgICAgICAgICAgICAgICAgIC5uYW1lfScgaXMgYW4gQW5ndWxhciBkaXJlY3RpdmUsIHRoZW4gYWRkICdDb21tb25Nb2R1bGUnIHRvIHRoZSAnQE5nTW9kdWxlLmltcG9ydHMnIG9mIHRoaXMgY29tcG9uZW50LmAgK1xuICAgICAgICAgICAgICBgXFxuMi4gVG8gYWxsb3cgYW55IHByb3BlcnR5IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50TmFtZS5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgICAgIGVycm9yTXNnICs9XG4gICAgICAgICAgICAgIGBcXG4xLiBJZiAnJHtlbGVtZW50TmFtZX0nIGlzIGFuIEFuZ3VsYXIgY29tcG9uZW50IGFuZCBpdCBoYXMgJyR7XG4gICAgICAgICAgICAgICAgICBib3VuZFByb3AubmFtZX0nIGlucHV0LCB0aGVuIHZlcmlmeSB0aGF0IGl0IGlzIHBhcnQgb2YgdGhpcyBtb2R1bGUuYCArXG4gICAgICAgICAgICAgIGBcXG4yLiBJZiAnJHtcbiAgICAgICAgICAgICAgICAgIGVsZW1lbnROYW1lfScgaXMgYSBXZWIgQ29tcG9uZW50IHRoZW4gYWRkICdDVVNUT01fRUxFTUVOVFNfU0NIRU1BJyB0byB0aGUgJ0BOZ01vZHVsZS5zY2hlbWFzJyBvZiB0aGlzIGNvbXBvbmVudCB0byBzdXBwcmVzcyB0aGlzIG1lc3NhZ2UuYCArXG4gICAgICAgICAgICAgIGBcXG4zLiBUbyBhbGxvdyBhbnkgcHJvcGVydHkgYWRkICdOT19FUlJPUlNfU0NIRU1BJyB0byB0aGUgJ0BOZ01vZHVsZS5zY2hlbWFzJyBvZiB0aGlzIGNvbXBvbmVudC5gO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVycm9yTXNnLCBib3VuZFByb3Auc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gIWlzRW1wdHlFeHByZXNzaW9uKGJvdW5kUHJvcC52YWx1ZSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihcbiAgICAgIG1lc3NhZ2U6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgbGV2ZWw6IFBhcnNlRXJyb3JMZXZlbCA9IFBhcnNlRXJyb3JMZXZlbC5FUlJPUikge1xuICAgIHRoaXMuX3RhcmdldEVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cbn1cblxuY2xhc3MgTm9uQmluZGFibGVWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgdmlzaXRFbGVtZW50KGFzdDogaHRtbC5FbGVtZW50LCBwYXJlbnQ6IEVsZW1lbnRDb250ZXh0KTogdC5FbGVtZW50QXN0fG51bGwge1xuICAgIGNvbnN0IHByZXBhcnNlZEVsZW1lbnQgPSBwcmVwYXJzZUVsZW1lbnQoYXN0KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQpIHtcbiAgICAgIC8vIFNraXBwaW5nIDxzY3JpcHQ+IGZvciBzZWN1cml0eSByZWFzb25zXG4gICAgICAvLyBTa2lwcGluZyA8c3R5bGU+IGFuZCBzdHlsZXNoZWV0cyBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgYXR0ck5hbWVBbmRWYWx1ZXMgPSBhc3QuYXR0cnMubWFwKChhdHRyKTogW3N0cmluZywgc3RyaW5nXSA9PiBbYXR0ci5uYW1lLCBhdHRyLnZhbHVlXSk7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVFbGVtZW50Q3NzU2VsZWN0b3IoYXN0Lm5hbWUsIGF0dHJOYW1lQW5kVmFsdWVzKTtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRleCA9IHBhcmVudC5maW5kTmdDb250ZW50SW5kZXgoc2VsZWN0b3IpO1xuICAgIGNvbnN0IGNoaWxkcmVuOiB0LlRlbXBsYXRlQXN0W10gPSBodG1sLnZpc2l0QWxsKHRoaXMsIGFzdC5jaGlsZHJlbiwgRU1QVFlfRUxFTUVOVF9DT05URVhUKTtcbiAgICByZXR1cm4gbmV3IHQuRWxlbWVudEFzdChcbiAgICAgICAgYXN0Lm5hbWUsIGh0bWwudmlzaXRBbGwodGhpcywgYXN0LmF0dHJzKSwgW10sIFtdLCBbXSwgW10sIFtdLCBmYWxzZSwgW10sIGNoaWxkcmVuLFxuICAgICAgICBuZ0NvbnRlbnRJbmRleCwgYXN0LnNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgY29udGV4dDogYW55KTogdC5BdHRyQXN0IHtcbiAgICByZXR1cm4gbmV3IHQuQXR0ckFzdChhdHRyaWJ1dGUubmFtZSwgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBwYXJlbnQ6IEVsZW1lbnRDb250ZXh0KTogdC5UZXh0QXN0IHtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRleCA9IHBhcmVudC5maW5kTmdDb250ZW50SW5kZXgoVEVYVF9DU1NfU0VMRUNUT1IoKSkhO1xuICAgIHJldHVybiBuZXcgdC5UZXh0QXN0KHRleHQudmFsdWUsIG5nQ29udGVudEluZGV4LCB0ZXh0LnNvdXJjZVNwYW4hKTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24sIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGV4cGFuc2lvbjtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGV4cGFuc2lvbkNhc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSB0byBhbiBlbGVtZW50IG9yIGRpcmVjdGl2ZSBpbiBhIHRlbXBsYXRlLiBFLmcuLCB0aGUgcmVmZXJlbmNlIGluIHRoaXMgdGVtcGxhdGU6XG4gKlxuICogPGRpdiAjbXlNZW51PVwiY29vbE1lbnVcIj5cbiAqXG4gKiB3b3VsZCBiZSB7bmFtZTogJ215TWVudScsIHZhbHVlOiAnY29vbE1lbnUnLCBzb3VyY2VTcGFuOiAuLi59XG4gKi9cbmNsYXNzIEVsZW1lbnRPckRpcmVjdGl2ZVJlZiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIC8qKiBHZXRzIHdoZXRoZXIgdGhpcyBpcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2l2ZW4gZGlyZWN0aXZlLiAqL1xuICBpc1JlZmVyZW5jZVRvRGlyZWN0aXZlKGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkpIHtcbiAgICByZXR1cm4gc3BsaXRFeHBvcnRBcyhkaXJlY3RpdmUuZXhwb3J0QXMpLmluZGV4T2YodGhpcy52YWx1ZSkgIT09IC0xO1xuICB9XG59XG5cbi8qKiBTcGxpdHMgYSByYXcsIHBvdGVudGlhbGx5IGNvbW1hLWRlbGltaXRlZCBgZXhwb3J0QXNgIHZhbHVlIGludG8gYW4gYXJyYXkgb2YgbmFtZXMuICovXG5mdW5jdGlvbiBzcGxpdEV4cG9ydEFzKGV4cG9ydEFzOiBzdHJpbmd8bnVsbCk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIGV4cG9ydEFzID8gZXhwb3J0QXMuc3BsaXQoJywnKS5tYXAoZSA9PiBlLnRyaW0oKSkgOiBbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNwbGl0Q2xhc3NlcyhjbGFzc0F0dHJWYWx1ZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICByZXR1cm4gY2xhc3NBdHRyVmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xufVxuXG5jbGFzcyBFbGVtZW50Q29udGV4dCB7XG4gIHN0YXRpYyBjcmVhdGUoXG4gICAgICBpc1RlbXBsYXRlRWxlbWVudDogYm9vbGVhbiwgZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSxcbiAgICAgIHByb3ZpZGVyQ29udGV4dDogUHJvdmlkZXJFbGVtZW50Q29udGV4dCk6IEVsZW1lbnRDb250ZXh0IHtcbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IFNlbGVjdG9yTWF0Y2hlcigpO1xuICAgIGxldCB3aWxkY2FyZE5nQ29udGVudEluZGV4OiBudW1iZXIgPSBudWxsITtcbiAgICBjb25zdCBjb21wb25lbnQgPSBkaXJlY3RpdmVzLmZpbmQoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS5kaXJlY3RpdmUuaXNDb21wb25lbnQpO1xuICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgIGNvbnN0IG5nQ29udGVudFNlbGVjdG9ycyA9IGNvbXBvbmVudC5kaXJlY3RpdmUudGVtcGxhdGUgIS5uZ0NvbnRlbnRTZWxlY3RvcnM7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5nQ29udGVudFNlbGVjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBzZWxlY3RvciA9IG5nQ29udGVudFNlbGVjdG9yc1tpXTtcbiAgICAgICAgaWYgKHNlbGVjdG9yID09PSAnKicpIHtcbiAgICAgICAgICB3aWxkY2FyZE5nQ29udGVudEluZGV4ID0gaTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKG5nQ29udGVudFNlbGVjdG9yc1tpXSksIGkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgRWxlbWVudENvbnRleHQoaXNUZW1wbGF0ZUVsZW1lbnQsIG1hdGNoZXIsIHdpbGRjYXJkTmdDb250ZW50SW5kZXgsIHByb3ZpZGVyQ29udGV4dCk7XG4gIH1cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIHByaXZhdGUgX25nQ29udGVudEluZGV4TWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyLFxuICAgICAgcHJpdmF0ZSBfd2lsZGNhcmROZ0NvbnRlbnRJbmRleDogbnVtYmVyfG51bGwsXG4gICAgICBwdWJsaWMgcHJvdmlkZXJDb250ZXh0OiBQcm92aWRlckVsZW1lbnRDb250ZXh0fG51bGwpIHt9XG5cbiAgZmluZE5nQ29udGVudEluZGV4KHNlbGVjdG9yOiBDc3NTZWxlY3Rvcik6IG51bWJlcnxudWxsIHtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRpY2VzOiBudW1iZXJbXSA9IFtdO1xuICAgIHRoaXMuX25nQ29udGVudEluZGV4TWF0Y2hlci5tYXRjaChzZWxlY3RvciwgKHNlbGVjdG9yLCBuZ0NvbnRlbnRJbmRleCkgPT4ge1xuICAgICAgbmdDb250ZW50SW5kaWNlcy5wdXNoKG5nQ29udGVudEluZGV4KTtcbiAgICB9KTtcbiAgICBuZ0NvbnRlbnRJbmRpY2VzLnNvcnQoKTtcbiAgICBpZiAodGhpcy5fd2lsZGNhcmROZ0NvbnRlbnRJbmRleCAhPSBudWxsKSB7XG4gICAgICBuZ0NvbnRlbnRJbmRpY2VzLnB1c2godGhpcy5fd2lsZGNhcmROZ0NvbnRlbnRJbmRleCk7XG4gICAgfVxuICAgIHJldHVybiBuZ0NvbnRlbnRJbmRpY2VzLmxlbmd0aCA+IDAgPyBuZ0NvbnRlbnRJbmRpY2VzWzBdIDogbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKFxuICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIGF0dHJpYnV0ZXM6IFtzdHJpbmcsIHN0cmluZ11bXSk6IENzc1NlbGVjdG9yIHtcbiAgY29uc3QgY3NzU2VsZWN0b3IgPSBuZXcgQ3NzU2VsZWN0b3IoKTtcbiAgY29uc3QgZWxOYW1lTm9OcyA9IHNwbGl0TnNOYW1lKGVsZW1lbnROYW1lKVsxXTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KGVsTmFtZU5vTnMpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGF0dHJOYW1lID0gYXR0cmlidXRlc1tpXVswXTtcbiAgICBjb25zdCBhdHRyTmFtZU5vTnMgPSBzcGxpdE5zTmFtZShhdHRyTmFtZSlbMV07XG4gICAgY29uc3QgYXR0clZhbHVlID0gYXR0cmlidXRlc1tpXVsxXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShhdHRyTmFtZU5vTnMsIGF0dHJWYWx1ZSk7XG4gICAgaWYgKGF0dHJOYW1lLnRvTG93ZXJDYXNlKCkgPT0gQ0xBU1NfQVRUUikge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHNwbGl0Q2xhc3NlcyhhdHRyVmFsdWUpO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjc3NTZWxlY3Rvcjtcbn1cblxuY29uc3QgRU1QVFlfRUxFTUVOVF9DT05URVhUID0gbmV3IEVsZW1lbnRDb250ZXh0KHRydWUsIG5ldyBTZWxlY3Rvck1hdGNoZXIoKSwgbnVsbCwgbnVsbCk7XG5jb25zdCBOT05fQklOREFCTEVfVklTSVRPUiA9IG5ldyBOb25CaW5kYWJsZVZpc2l0b3IoKTtcblxuZnVuY3Rpb24gX2lzRW1wdHlUZXh0Tm9kZShub2RlOiBodG1sLk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiBodG1sLlRleHQgJiYgbm9kZS52YWx1ZS50cmltKCkubGVuZ3RoID09IDA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVTdW1tYXJ5RHVwbGljYXRlczxUIGV4dGVuZHMge3R5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGF9PihpdGVtczogVFtdKTogVFtdIHtcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxhbnksIFQ+KCk7XG5cbiAgaXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgIGlmICghbWFwLmdldChpdGVtLnR5cGUucmVmZXJlbmNlKSkge1xuICAgICAgbWFwLnNldChpdGVtLnR5cGUucmVmZXJlbmNlLCBpdGVtKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKG1hcC52YWx1ZXMoKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5RXhwcmVzc2lvbihhc3Q6IEFTVCk6IGJvb2xlYW4ge1xuICBpZiAoYXN0IGluc3RhbmNlb2YgQVNUV2l0aFNvdXJjZSkge1xuICAgIGFzdCA9IGFzdC5hc3Q7XG4gIH1cbiAgcmV0dXJuIGFzdCBpbnN0YW5jZW9mIEVtcHR5RXhwcjtcbn1cbiJdfQ==