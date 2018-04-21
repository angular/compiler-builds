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
import * as tslib_1 from "tslib";
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
var /** @type {?} */ TEXT_CSS_SELECTOR = CssSelector.parse('*')[0];
var /** @type {?} */ warningCounts = {};
/**
 * @param {?} warnings
 * @return {?}
 */
function warnOnlyOnce(warnings) {
    return function (error) {
        if (warnings.indexOf(error.msg) !== -1) {
            warningCounts[error.msg] = (warningCounts[error.msg] || 0) + 1;
            return warningCounts[error.msg] <= 1;
        }
        return true;
    };
}
var TemplateParseError = /** @class */ (function (_super) {
    tslib_1.__extends(TemplateParseError, _super);
    function TemplateParseError(message, span, level) {
        return _super.call(this, span, message, level) || this;
    }
    return TemplateParseError;
}(ParseError));
export { TemplateParseError };
var TemplateParseResult = /** @class */ (function () {
    function TemplateParseResult(templateAst, usedPipes, errors) {
        this.templateAst = templateAst;
        this.usedPipes = usedPipes;
        this.errors = errors;
    }
    return TemplateParseResult;
}());
export { TemplateParseResult };
function TemplateParseResult_tsickle_Closure_declarations() {
    /** @type {?} */
    TemplateParseResult.prototype.templateAst;
    /** @type {?} */
    TemplateParseResult.prototype.usedPipes;
    /** @type {?} */
    TemplateParseResult.prototype.errors;
}
var TemplateParser = /** @class */ (function () {
    function TemplateParser(_config, _reflector, _exprParser, _schemaRegistry, _htmlParser, _console, transforms) {
        this._config = _config;
        this._reflector = _reflector;
        this._exprParser = _exprParser;
        this._schemaRegistry = _schemaRegistry;
        this._htmlParser = _htmlParser;
        this._console = _console;
        this.transforms = transforms;
    }
    Object.defineProperty(TemplateParser.prototype, "expressionParser", {
        get: /**
         * @return {?}
         */
        function () { return this._exprParser; },
        enumerable: true,
        configurable: true
    });
    /**
     * @param {?} component
     * @param {?} template
     * @param {?} directives
     * @param {?} pipes
     * @param {?} schemas
     * @param {?} templateUrl
     * @param {?} preserveWhitespaces
     * @return {?}
     */
    TemplateParser.prototype.parse = /**
     * @param {?} component
     * @param {?} template
     * @param {?} directives
     * @param {?} pipes
     * @param {?} schemas
     * @param {?} templateUrl
     * @param {?} preserveWhitespaces
     * @return {?}
     */
    function (component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
        var /** @type {?} */ result = this.tryParse(component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces);
        var /** @type {?} */ warnings = /** @type {?} */ ((result.errors)).filter(function (error) { return error.level === ParseErrorLevel.WARNING; });
        var /** @type {?} */ errors = /** @type {?} */ ((result.errors)).filter(function (error) { return error.level === ParseErrorLevel.ERROR; });
        if (warnings.length > 0) {
            this._console.warn("Template parse warnings:\n" + warnings.join('\n'));
        }
        if (errors.length > 0) {
            var /** @type {?} */ errorString = errors.join('\n');
            throw syntaxError("Template parse errors:\n" + errorString, errors);
        }
        return { template: /** @type {?} */ ((result.templateAst)), pipes: /** @type {?} */ ((result.usedPipes)) };
    };
    /**
     * @param {?} component
     * @param {?} template
     * @param {?} directives
     * @param {?} pipes
     * @param {?} schemas
     * @param {?} templateUrl
     * @param {?} preserveWhitespaces
     * @return {?}
     */
    TemplateParser.prototype.tryParse = /**
     * @param {?} component
     * @param {?} template
     * @param {?} directives
     * @param {?} pipes
     * @param {?} schemas
     * @param {?} templateUrl
     * @param {?} preserveWhitespaces
     * @return {?}
     */
    function (component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
        var /** @type {?} */ htmlParseResult = typeof template === 'string' ? /** @type {?} */ ((this._htmlParser)).parse(template, templateUrl, true, this.getInterpolationConfig(component)) :
            template;
        if (!preserveWhitespaces) {
            htmlParseResult = removeWhitespaces(htmlParseResult);
        }
        return this.tryParseHtml(this.expandHtml(htmlParseResult), component, directives, pipes, schemas);
    };
    /**
     * @param {?} htmlAstWithErrors
     * @param {?} component
     * @param {?} directives
     * @param {?} pipes
     * @param {?} schemas
     * @return {?}
     */
    TemplateParser.prototype.tryParseHtml = /**
     * @param {?} htmlAstWithErrors
     * @param {?} component
     * @param {?} directives
     * @param {?} pipes
     * @param {?} schemas
     * @return {?}
     */
    function (htmlAstWithErrors, component, directives, pipes, schemas) {
        var /** @type {?} */ result;
        var /** @type {?} */ errors = htmlAstWithErrors.errors;
        var /** @type {?} */ usedPipes = [];
        if (htmlAstWithErrors.rootNodes.length > 0) {
            var /** @type {?} */ uniqDirectives = removeSummaryDuplicates(directives);
            var /** @type {?} */ uniqPipes = removeSummaryDuplicates(pipes);
            var /** @type {?} */ providerViewContext = new ProviderViewContext(this._reflector, component);
            var /** @type {?} */ interpolationConfig = /** @type {?} */ ((undefined));
            if (component.template && component.template.interpolation) {
                interpolationConfig = {
                    start: component.template.interpolation[0],
                    end: component.template.interpolation[1]
                };
            }
            var /** @type {?} */ bindingParser = new BindingParser(this._exprParser, /** @type {?} */ ((interpolationConfig)), this._schemaRegistry, uniqPipes, errors);
            var /** @type {?} */ parseVisitor = new TemplateParseVisitor(this._reflector, this._config, providerViewContext, uniqDirectives, bindingParser, this._schemaRegistry, schemas, errors);
            result = html.visitAll(parseVisitor, htmlAstWithErrors.rootNodes, EMPTY_ELEMENT_CONTEXT);
            errors.push.apply(errors, providerViewContext.errors);
            usedPipes.push.apply(usedPipes, bindingParser.getUsedPipes());
        }
        else {
            result = [];
        }
        this._assertNoReferenceDuplicationOnTemplate(result, errors);
        if (errors.length > 0) {
            return new TemplateParseResult(result, usedPipes, errors);
        }
        if (this.transforms) {
            this.transforms.forEach(function (transform) { result = t.templateVisitAll(transform, result); });
        }
        return new TemplateParseResult(result, usedPipes, errors);
    };
    /**
     * @param {?} htmlAstWithErrors
     * @param {?=} forced
     * @return {?}
     */
    TemplateParser.prototype.expandHtml = /**
     * @param {?} htmlAstWithErrors
     * @param {?=} forced
     * @return {?}
     */
    function (htmlAstWithErrors, forced) {
        if (forced === void 0) { forced = false; }
        var /** @type {?} */ errors = htmlAstWithErrors.errors;
        if (errors.length == 0 || forced) {
            // Transform ICU messages to angular directives
            var /** @type {?} */ expandedHtmlAst = expandNodes(htmlAstWithErrors.rootNodes);
            errors.push.apply(errors, expandedHtmlAst.errors);
            htmlAstWithErrors = new ParseTreeResult(expandedHtmlAst.nodes, errors);
        }
        return htmlAstWithErrors;
    };
    /**
     * @param {?} component
     * @return {?}
     */
    TemplateParser.prototype.getInterpolationConfig = /**
     * @param {?} component
     * @return {?}
     */
    function (component) {
        if (component.template) {
            return InterpolationConfig.fromArray(component.template.interpolation);
        }
        return undefined;
    };
    /** @internal */
    /**
     * \@internal
     * @param {?} result
     * @param {?} errors
     * @return {?}
     */
    TemplateParser.prototype._assertNoReferenceDuplicationOnTemplate = /**
     * \@internal
     * @param {?} result
     * @param {?} errors
     * @return {?}
     */
    function (result, errors) {
        var /** @type {?} */ existingReferences = [];
        result.filter(function (element) { return !!(/** @type {?} */ (element)).references; })
            .forEach(function (element) {
            return (/** @type {?} */ (element)).references.forEach(function (reference) {
                var /** @type {?} */ name = reference.name;
                if (existingReferences.indexOf(name) < 0) {
                    existingReferences.push(name);
                }
                else {
                    var /** @type {?} */ error = new TemplateParseError("Reference \"#" + name + "\" is defined several times", reference.sourceSpan, ParseErrorLevel.ERROR);
                    errors.push(error);
                }
            });
        });
    };
    return TemplateParser;
}());
export { TemplateParser };
function TemplateParser_tsickle_Closure_declarations() {
    /** @type {?} */
    TemplateParser.prototype._config;
    /** @type {?} */
    TemplateParser.prototype._reflector;
    /** @type {?} */
    TemplateParser.prototype._exprParser;
    /** @type {?} */
    TemplateParser.prototype._schemaRegistry;
    /** @type {?} */
    TemplateParser.prototype._htmlParser;
    /** @type {?} */
    TemplateParser.prototype._console;
    /** @type {?} */
    TemplateParser.prototype.transforms;
}
var TemplateParseVisitor = /** @class */ (function () {
    function TemplateParseVisitor(reflector, config, providerViewContext, directives, _bindingParser, _schemaRegistry, _schemas, _targetErrors) {
        var _this = this;
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
        directives.forEach(function (directive, index) {
            var /** @type {?} */ selector = CssSelector.parse(/** @type {?} */ ((directive.selector)));
            _this.selectorMatcher.addSelectables(selector, directive);
            _this.directivesIndex.set(directive, index);
        });
    }
    /**
     * @param {?} expansion
     * @param {?} context
     * @return {?}
     */
    TemplateParseVisitor.prototype.visitExpansion = /**
     * @param {?} expansion
     * @param {?} context
     * @return {?}
     */
    function (expansion, context) { return null; };
    /**
     * @param {?} expansionCase
     * @param {?} context
     * @return {?}
     */
    TemplateParseVisitor.prototype.visitExpansionCase = /**
     * @param {?} expansionCase
     * @param {?} context
     * @return {?}
     */
    function (expansionCase, context) { return null; };
    /**
     * @param {?} text
     * @param {?} parent
     * @return {?}
     */
    TemplateParseVisitor.prototype.visitText = /**
     * @param {?} text
     * @param {?} parent
     * @return {?}
     */
    function (text, parent) {
        var /** @type {?} */ ngContentIndex = /** @type {?} */ ((parent.findNgContentIndex(TEXT_CSS_SELECTOR)));
        var /** @type {?} */ valueNoNgsp = replaceNgsp(text.value);
        var /** @type {?} */ expr = this._bindingParser.parseInterpolation(valueNoNgsp, /** @type {?} */ ((text.sourceSpan)));
        return expr ? new t.BoundTextAst(expr, ngContentIndex, /** @type {?} */ ((text.sourceSpan))) :
            new t.TextAst(valueNoNgsp, ngContentIndex, /** @type {?} */ ((text.sourceSpan)));
    };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    TemplateParseVisitor.prototype.visitAttribute = /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    function (attribute, context) {
        return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
    };
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    TemplateParseVisitor.prototype.visitComment = /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    function (comment, context) { return null; };
    /**
     * @param {?} element
     * @param {?} parent
     * @return {?}
     */
    TemplateParseVisitor.prototype.visitElement = /**
     * @param {?} element
     * @param {?} parent
     * @return {?}
     */
    function (element, parent) {
        var _this = this;
        var /** @type {?} */ queryStartIndex = this.contentQueryStartId;
        var /** @type {?} */ elName = element.name;
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
        var /** @type {?} */ matchableAttrs = [];
        var /** @type {?} */ elementOrDirectiveProps = [];
        var /** @type {?} */ elementOrDirectiveRefs = [];
        var /** @type {?} */ elementVars = [];
        var /** @type {?} */ events = [];
        var /** @type {?} */ templateElementOrDirectiveProps = [];
        var /** @type {?} */ templateMatchableAttrs = [];
        var /** @type {?} */ templateElementVars = [];
        var /** @type {?} */ hasInlineTemplates = false;
        var /** @type {?} */ attrs = [];
        var /** @type {?} */ isTemplateElement = isNgTemplate(element.name);
        element.attrs.forEach(function (attr) {
            var /** @type {?} */ parsedVariables = [];
            var /** @type {?} */ hasBinding = _this._parseAttr(isTemplateElement, attr, matchableAttrs, elementOrDirectiveProps, events, elementOrDirectiveRefs, elementVars);
            elementVars.push.apply(elementVars, parsedVariables.map(function (v) { return t.VariableAst.fromParsedVariable(v); }));
            var /** @type {?} */ templateValue;
            var /** @type {?} */ templateKey;
            var /** @type {?} */ normalizedName = _this._normalizeAttributeName(attr.name);
            if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                templateValue = attr.value;
                templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
            }
            var /** @type {?} */ hasTemplateBinding = templateValue != null;
            if (hasTemplateBinding) {
                if (hasInlineTemplates) {
                    _this._reportError("Can't have multiple template bindings on one element. Use only one attribute prefixed with *", attr.sourceSpan);
                }
                hasInlineTemplates = true;
                var /** @type {?} */ parsedVariables_1 = [];
                _this._bindingParser.parseInlineTemplateBinding(/** @type {?} */ ((templateKey)), /** @type {?} */ ((templateValue)), attr.sourceSpan, templateMatchableAttrs, templateElementOrDirectiveProps, parsedVariables_1);
                templateElementVars.push.apply(templateElementVars, parsedVariables_1.map(function (v) { return t.VariableAst.fromParsedVariable(v); }));
            }
            if (!hasBinding && !hasTemplateBinding) {
                // don't include the bindings as attributes as well in the AST
                attrs.push(_this.visitAttribute(attr, null));
                matchableAttrs.push([attr.name, attr.value]);
            }
        });
        var /** @type {?} */ elementCssSelector = createElementCssSelector(elName, matchableAttrs);
        var _a = this._parseDirectives(this.selectorMatcher, elementCssSelector), directiveMetas = _a.directives, matchElement = _a.matchElement;
        var /** @type {?} */ references = [];
        var /** @type {?} */ boundDirectivePropNames = new Set();
        var /** @type {?} */ directiveAsts = this._createDirectiveAsts(isTemplateElement, element.name, directiveMetas, elementOrDirectiveProps, elementOrDirectiveRefs, /** @type {?} */ ((element.sourceSpan)), references, boundDirectivePropNames);
        var /** @type {?} */ elementProps = this._createElementPropertyAsts(element.name, elementOrDirectiveProps, boundDirectivePropNames);
        var /** @type {?} */ isViewRoot = parent.isTemplateElement || hasInlineTemplates;
        var /** @type {?} */ providerContext = new ProviderElementContext(this.providerViewContext, /** @type {?} */ ((parent.providerContext)), isViewRoot, directiveAsts, attrs, references, isTemplateElement, queryStartIndex, /** @type {?} */ ((element.sourceSpan)));
        var /** @type {?} */ children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children, ElementContext.create(isTemplateElement, directiveAsts, isTemplateElement ? /** @type {?} */ ((parent.providerContext)) : providerContext));
        providerContext.afterElement();
        // Override the actual selector when the `ngProjectAs` attribute is provided
        var /** @type {?} */ projectionSelector = preparsedElement.projectAs != '' ?
            CssSelector.parse(preparsedElement.projectAs)[0] :
            elementCssSelector;
        var /** @type {?} */ ngContentIndex = /** @type {?} */ ((parent.findNgContentIndex(projectionSelector)));
        var /** @type {?} */ parsedElement;
        if (preparsedElement.type === PreparsedElementType.NG_CONTENT) {
            // `<ng-content>` element
            if (element.children && !element.children.every(_isEmptyTextNode)) {
                this._reportError("<ng-content> element cannot have content.", /** @type {?} */ ((element.sourceSpan)));
            }
            parsedElement = new t.NgContentAst(this.ngContentCount++, hasInlineTemplates ? /** @type {?} */ ((null)) : ngContentIndex, /** @type {?} */ ((element.sourceSpan)));
        }
        else if (isTemplateElement) {
            // `<ng-template>` element
            this._assertAllEventsPublishedByDirectives(directiveAsts, events);
            this._assertNoComponentsNorElementBindingsOnTemplate(directiveAsts, elementProps, /** @type {?} */ ((element.sourceSpan)));
            parsedElement = new t.EmbeddedTemplateAst(attrs, events, references, elementVars, providerContext.transformedDirectiveAsts, providerContext.transformProviders, providerContext.transformedHasViewContainer, providerContext.queryMatches, children, hasInlineTemplates ? /** @type {?} */ ((null)) : ngContentIndex, /** @type {?} */ ((element.sourceSpan)));
        }
        else {
            // element other than `<ng-content>` and `<ng-template>`
            this._assertElementExists(matchElement, element);
            this._assertOnlyOneComponent(directiveAsts, /** @type {?} */ ((element.sourceSpan)));
            var /** @type {?} */ ngContentIndex_1 = hasInlineTemplates ? null : parent.findNgContentIndex(projectionSelector);
            parsedElement = new t.ElementAst(elName, attrs, elementProps, events, references, providerContext.transformedDirectiveAsts, providerContext.transformProviders, providerContext.transformedHasViewContainer, providerContext.queryMatches, children, hasInlineTemplates ? null : ngContentIndex_1, element.sourceSpan, element.endSourceSpan || null);
        }
        if (hasInlineTemplates) {
            // The element as a *-attribute
            var /** @type {?} */ templateQueryStartIndex = this.contentQueryStartId;
            var /** @type {?} */ templateSelector = createElementCssSelector('ng-template', templateMatchableAttrs);
            var directives = this._parseDirectives(this.selectorMatcher, templateSelector).directives;
            var /** @type {?} */ templateBoundDirectivePropNames = new Set();
            var /** @type {?} */ templateDirectiveAsts = this._createDirectiveAsts(true, elName, directives, templateElementOrDirectiveProps, [], /** @type {?} */ ((element.sourceSpan)), [], templateBoundDirectivePropNames);
            var /** @type {?} */ templateElementProps = this._createElementPropertyAsts(elName, templateElementOrDirectiveProps, templateBoundDirectivePropNames);
            this._assertNoComponentsNorElementBindingsOnTemplate(templateDirectiveAsts, templateElementProps, /** @type {?} */ ((element.sourceSpan)));
            var /** @type {?} */ templateProviderContext = new ProviderElementContext(this.providerViewContext, /** @type {?} */ ((parent.providerContext)), parent.isTemplateElement, templateDirectiveAsts, [], [], true, templateQueryStartIndex, /** @type {?} */ ((element.sourceSpan)));
            templateProviderContext.afterElement();
            parsedElement = new t.EmbeddedTemplateAst([], [], [], templateElementVars, templateProviderContext.transformedDirectiveAsts, templateProviderContext.transformProviders, templateProviderContext.transformedHasViewContainer, templateProviderContext.queryMatches, [parsedElement], ngContentIndex, /** @type {?} */ ((element.sourceSpan)));
        }
        return parsedElement;
    };
    /**
     * @param {?} isTemplateElement
     * @param {?} attr
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @param {?} targetEvents
     * @param {?} targetRefs
     * @param {?} targetVars
     * @return {?}
     */
    TemplateParseVisitor.prototype._parseAttr = /**
     * @param {?} isTemplateElement
     * @param {?} attr
     * @param {?} targetMatchableAttrs
     * @param {?} targetProps
     * @param {?} targetEvents
     * @param {?} targetRefs
     * @param {?} targetVars
     * @return {?}
     */
    function (isTemplateElement, attr, targetMatchableAttrs, targetProps, targetEvents, targetRefs, targetVars) {
        var /** @type {?} */ name = this._normalizeAttributeName(attr.name);
        var /** @type {?} */ value = attr.value;
        var /** @type {?} */ srcSpan = attr.sourceSpan;
        var /** @type {?} */ boundEvents = [];
        var /** @type {?} */ bindParts = name.match(BIND_NAME_REGEXP);
        var /** @type {?} */ hasBinding = false;
        if (bindParts !== null) {
            hasBinding = true;
            if (bindParts[KW_BIND_IDX] != null) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
            }
            else if (bindParts[KW_LET_IDX]) {
                if (isTemplateElement) {
                    var /** @type {?} */ identifier = bindParts[IDENT_KW_IDX];
                    this._parseVariable(identifier, value, srcSpan, targetVars);
                }
                else {
                    this._reportError("\"let-\" is only supported on ng-template elements.", srcSpan);
                }
            }
            else if (bindParts[KW_REF_IDX]) {
                var /** @type {?} */ identifier = bindParts[IDENT_KW_IDX];
                this._parseReference(identifier, value, srcSpan, targetRefs);
            }
            else if (bindParts[KW_ON_IDX]) {
                this._bindingParser.parseEvent(bindParts[IDENT_KW_IDX], value, srcSpan, targetMatchableAttrs, boundEvents);
            }
            else if (bindParts[KW_BINDON_IDX]) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
                this._parseAssignmentEvent(bindParts[IDENT_KW_IDX], value, srcSpan, targetMatchableAttrs, boundEvents);
            }
            else if (bindParts[KW_AT_IDX]) {
                this._bindingParser.parseLiteralAttr(name, value, srcSpan, targetMatchableAttrs, targetProps);
            }
            else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
                this._parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, targetMatchableAttrs, boundEvents);
            }
            else if (bindParts[IDENT_PROPERTY_IDX]) {
                this._bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
            }
            else if (bindParts[IDENT_EVENT_IDX]) {
                this._bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, targetMatchableAttrs, boundEvents);
            }
        }
        else {
            hasBinding = this._bindingParser.parsePropertyInterpolation(name, value, srcSpan, targetMatchableAttrs, targetProps);
        }
        if (!hasBinding) {
            this._bindingParser.parseLiteralAttr(name, value, srcSpan, targetMatchableAttrs, targetProps);
        }
        targetEvents.push.apply(targetEvents, boundEvents.map(function (e) { return t.BoundEventAst.fromParsedEvent(e); }));
        return hasBinding;
    };
    /**
     * @param {?} attrName
     * @return {?}
     */
    TemplateParseVisitor.prototype._normalizeAttributeName = /**
     * @param {?} attrName
     * @return {?}
     */
    function (attrName) {
        return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
    };
    /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetVars
     * @return {?}
     */
    TemplateParseVisitor.prototype._parseVariable = /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetVars
     * @return {?}
     */
    function (identifier, value, sourceSpan, targetVars) {
        if (identifier.indexOf('-') > -1) {
            this._reportError("\"-\" is not allowed in variable names", sourceSpan);
        }
        targetVars.push(new t.VariableAst(identifier, value, sourceSpan));
    };
    /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetRefs
     * @return {?}
     */
    TemplateParseVisitor.prototype._parseReference = /**
     * @param {?} identifier
     * @param {?} value
     * @param {?} sourceSpan
     * @param {?} targetRefs
     * @return {?}
     */
    function (identifier, value, sourceSpan, targetRefs) {
        if (identifier.indexOf('-') > -1) {
            this._reportError("\"-\" is not allowed in reference names", sourceSpan);
        }
        targetRefs.push(new ElementOrDirectiveRef(identifier, value, sourceSpan));
    };
    /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetEvents
     * @return {?}
     */
    TemplateParseVisitor.prototype._parseAssignmentEvent = /**
     * @param {?} name
     * @param {?} expression
     * @param {?} sourceSpan
     * @param {?} targetMatchableAttrs
     * @param {?} targetEvents
     * @return {?}
     */
    function (name, expression, sourceSpan, targetMatchableAttrs, targetEvents) {
        this._bindingParser.parseEvent(name + "Change", expression + "=$event", sourceSpan, targetMatchableAttrs, targetEvents);
    };
    /**
     * @param {?} selectorMatcher
     * @param {?} elementCssSelector
     * @return {?}
     */
    TemplateParseVisitor.prototype._parseDirectives = /**
     * @param {?} selectorMatcher
     * @param {?} elementCssSelector
     * @return {?}
     */
    function (selectorMatcher, elementCssSelector) {
        var _this = this;
        // Need to sort the directives so that we get consistent results throughout,
        // as selectorMatcher uses Maps inside.
        // Also deduplicate directives as they might match more than one time!
        var /** @type {?} */ directives = new Array(this.directivesIndex.size);
        // Whether any directive selector matches on the element name
        var /** @type {?} */ matchElement = false;
        selectorMatcher.match(elementCssSelector, function (selector, directive) {
            directives[/** @type {?} */ ((_this.directivesIndex.get(directive)))] = directive;
            matchElement = matchElement || selector.hasElementSelector();
        });
        return {
            directives: directives.filter(function (dir) { return !!dir; }),
            matchElement: matchElement,
        };
    };
    /**
     * @param {?} isTemplateElement
     * @param {?} elementName
     * @param {?} directives
     * @param {?} props
     * @param {?} elementOrDirectiveRefs
     * @param {?} elementSourceSpan
     * @param {?} targetReferences
     * @param {?} targetBoundDirectivePropNames
     * @return {?}
     */
    TemplateParseVisitor.prototype._createDirectiveAsts = /**
     * @param {?} isTemplateElement
     * @param {?} elementName
     * @param {?} directives
     * @param {?} props
     * @param {?} elementOrDirectiveRefs
     * @param {?} elementSourceSpan
     * @param {?} targetReferences
     * @param {?} targetBoundDirectivePropNames
     * @return {?}
     */
    function (isTemplateElement, elementName, directives, props, elementOrDirectiveRefs, elementSourceSpan, targetReferences, targetBoundDirectivePropNames) {
        var _this = this;
        var /** @type {?} */ matchedReferences = new Set();
        var /** @type {?} */ component = /** @type {?} */ ((null));
        var /** @type {?} */ directiveAsts = directives.map(function (directive) {
            var /** @type {?} */ sourceSpan = new ParseSourceSpan(elementSourceSpan.start, elementSourceSpan.end, "Directive " + identifierName(directive.type));
            if (directive.isComponent) {
                component = directive;
            }
            var /** @type {?} */ directiveProperties = [];
            var /** @type {?} */ boundProperties = /** @type {?} */ ((_this._bindingParser.createDirectiveHostPropertyAsts(directive, elementName, sourceSpan)));
            var /** @type {?} */ hostProperties = boundProperties.map(function (prop) { return t.BoundElementPropertyAst.fromBoundProperty(prop); });
            // Note: We need to check the host properties here as well,
            // as we don't know the element name in the DirectiveWrapperCompiler yet.
            hostProperties = _this._checkPropertiesInSchema(elementName, hostProperties);
            var /** @type {?} */ parsedEvents = /** @type {?} */ ((_this._bindingParser.createDirectiveHostEventAsts(directive, sourceSpan)));
            _this._createDirectivePropertyAsts(directive.inputs, props, directiveProperties, targetBoundDirectivePropNames);
            elementOrDirectiveRefs.forEach(function (elOrDirRef) {
                if ((elOrDirRef.value.length === 0 && directive.isComponent) ||
                    (elOrDirRef.isReferenceToDirective(directive))) {
                    targetReferences.push(new t.ReferenceAst(elOrDirRef.name, createTokenForReference(directive.type.reference), elOrDirRef.value, elOrDirRef.sourceSpan));
                    matchedReferences.add(elOrDirRef.name);
                }
            });
            var /** @type {?} */ hostEvents = parsedEvents.map(function (e) { return t.BoundEventAst.fromParsedEvent(e); });
            var /** @type {?} */ contentQueryStartId = _this.contentQueryStartId;
            _this.contentQueryStartId += directive.queries.length;
            return new t.DirectiveAst(directive, directiveProperties, hostProperties, hostEvents, contentQueryStartId, sourceSpan);
        });
        elementOrDirectiveRefs.forEach(function (elOrDirRef) {
            if (elOrDirRef.value.length > 0) {
                if (!matchedReferences.has(elOrDirRef.name)) {
                    _this._reportError("There is no directive with \"exportAs\" set to \"" + elOrDirRef.value + "\"", elOrDirRef.sourceSpan);
                }
            }
            else if (!component) {
                var /** @type {?} */ refToken = /** @type {?} */ ((null));
                if (isTemplateElement) {
                    refToken = createTokenForExternalReference(_this.reflector, Identifiers.TemplateRef);
                }
                targetReferences.push(new t.ReferenceAst(elOrDirRef.name, refToken, elOrDirRef.value, elOrDirRef.sourceSpan));
            }
        });
        return directiveAsts;
    };
    /**
     * @param {?} directiveProperties
     * @param {?} boundProps
     * @param {?} targetBoundDirectiveProps
     * @param {?} targetBoundDirectivePropNames
     * @return {?}
     */
    TemplateParseVisitor.prototype._createDirectivePropertyAsts = /**
     * @param {?} directiveProperties
     * @param {?} boundProps
     * @param {?} targetBoundDirectiveProps
     * @param {?} targetBoundDirectivePropNames
     * @return {?}
     */
    function (directiveProperties, boundProps, targetBoundDirectiveProps, targetBoundDirectivePropNames) {
        if (directiveProperties) {
            var /** @type {?} */ boundPropsByName_1 = new Map();
            boundProps.forEach(function (boundProp) {
                var /** @type {?} */ prevValue = boundPropsByName_1.get(boundProp.name);
                if (!prevValue || prevValue.isLiteral) {
                    // give [a]="b" a higher precedence than a="b" on the same element
                    // give [a]="b" a higher precedence than a="b" on the same element
                    boundPropsByName_1.set(boundProp.name, boundProp);
                }
            });
            Object.keys(directiveProperties).forEach(function (dirProp) {
                var /** @type {?} */ elProp = directiveProperties[dirProp];
                var /** @type {?} */ boundProp = boundPropsByName_1.get(elProp);
                // Bindings are optional, so this binding only needs to be set up if an expression is given.
                if (boundProp) {
                    targetBoundDirectivePropNames.add(boundProp.name);
                    if (!isEmptyExpression(boundProp.expression)) {
                        targetBoundDirectiveProps.push(new t.BoundDirectivePropertyAst(dirProp, boundProp.name, boundProp.expression, boundProp.sourceSpan));
                    }
                }
            });
        }
    };
    /**
     * @param {?} elementName
     * @param {?} props
     * @param {?} boundDirectivePropNames
     * @return {?}
     */
    TemplateParseVisitor.prototype._createElementPropertyAsts = /**
     * @param {?} elementName
     * @param {?} props
     * @param {?} boundDirectivePropNames
     * @return {?}
     */
    function (elementName, props, boundDirectivePropNames) {
        var _this = this;
        var /** @type {?} */ boundElementProps = [];
        props.forEach(function (prop) {
            if (!prop.isLiteral && !boundDirectivePropNames.has(prop.name)) {
                var /** @type {?} */ boundProp = _this._bindingParser.createBoundElementProperty(elementName, prop);
                boundElementProps.push(t.BoundElementPropertyAst.fromBoundProperty(boundProp));
            }
        });
        return this._checkPropertiesInSchema(elementName, boundElementProps);
    };
    /**
     * @param {?} directives
     * @return {?}
     */
    TemplateParseVisitor.prototype._findComponentDirectives = /**
     * @param {?} directives
     * @return {?}
     */
    function (directives) {
        return directives.filter(function (directive) { return directive.directive.isComponent; });
    };
    /**
     * @param {?} directives
     * @return {?}
     */
    TemplateParseVisitor.prototype._findComponentDirectiveNames = /**
     * @param {?} directives
     * @return {?}
     */
    function (directives) {
        return this._findComponentDirectives(directives)
            .map(function (directive) { return ((identifierName(directive.directive.type))); });
    };
    /**
     * @param {?} directives
     * @param {?} sourceSpan
     * @return {?}
     */
    TemplateParseVisitor.prototype._assertOnlyOneComponent = /**
     * @param {?} directives
     * @param {?} sourceSpan
     * @return {?}
     */
    function (directives, sourceSpan) {
        var /** @type {?} */ componentTypeNames = this._findComponentDirectiveNames(directives);
        if (componentTypeNames.length > 1) {
            this._reportError("More than one component matched on this element.\n" +
                "Make sure that only one component's selector can match a given element.\n" +
                ("Conflicting components: " + componentTypeNames.join(',')), sourceSpan);
        }
    };
    /**
     * Make sure that non-angular tags conform to the schemas.
     *
     * Note: An element is considered an angular tag when at least one directive selector matches the
     * tag name.
     *
     * @param {?} matchElement Whether any directive has matched on the tag name
     * @param {?} element the html element
     * @return {?}
     */
    TemplateParseVisitor.prototype._assertElementExists = /**
     * Make sure that non-angular tags conform to the schemas.
     *
     * Note: An element is considered an angular tag when at least one directive selector matches the
     * tag name.
     *
     * @param {?} matchElement Whether any directive has matched on the tag name
     * @param {?} element the html element
     * @return {?}
     */
    function (matchElement, element) {
        var /** @type {?} */ elName = element.name.replace(/^:xhtml:/, '');
        if (!matchElement && !this._schemaRegistry.hasElement(elName, this._schemas)) {
            var /** @type {?} */ errorMsg = "'" + elName + "' is not a known element:\n";
            errorMsg +=
                "1. If '" + elName + "' is an Angular component, then verify that it is part of this module.\n";
            if (elName.indexOf('-') > -1) {
                errorMsg +=
                    "2. If '" + elName + "' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the '@NgModule.schemas' of this component to suppress this message.";
            }
            else {
                errorMsg +=
                    "2. To allow any element add 'NO_ERRORS_SCHEMA' to the '@NgModule.schemas' of this component.";
            }
            this._reportError(errorMsg, /** @type {?} */ ((element.sourceSpan)));
        }
    };
    /**
     * @param {?} directives
     * @param {?} elementProps
     * @param {?} sourceSpan
     * @return {?}
     */
    TemplateParseVisitor.prototype._assertNoComponentsNorElementBindingsOnTemplate = /**
     * @param {?} directives
     * @param {?} elementProps
     * @param {?} sourceSpan
     * @return {?}
     */
    function (directives, elementProps, sourceSpan) {
        var _this = this;
        var /** @type {?} */ componentTypeNames = this._findComponentDirectiveNames(directives);
        if (componentTypeNames.length > 0) {
            this._reportError("Components on an embedded template: " + componentTypeNames.join(','), sourceSpan);
        }
        elementProps.forEach(function (prop) {
            _this._reportError("Property binding " + prop.name + " not used by any directive on an embedded template. Make sure that the property name is spelled correctly and all directives are listed in the \"@NgModule.declarations\".", sourceSpan);
        });
    };
    /**
     * @param {?} directives
     * @param {?} events
     * @return {?}
     */
    TemplateParseVisitor.prototype._assertAllEventsPublishedByDirectives = /**
     * @param {?} directives
     * @param {?} events
     * @return {?}
     */
    function (directives, events) {
        var _this = this;
        var /** @type {?} */ allDirectiveEvents = new Set();
        directives.forEach(function (directive) {
            Object.keys(directive.directive.outputs).forEach(function (k) {
                var /** @type {?} */ eventName = directive.directive.outputs[k];
                allDirectiveEvents.add(eventName);
            });
        });
        events.forEach(function (event) {
            if (event.target != null || !allDirectiveEvents.has(event.name)) {
                _this._reportError("Event binding " + event.fullName + " not emitted by any directive on an embedded template. Make sure that the event name is spelled correctly and all directives are listed in the \"@NgModule.declarations\".", event.sourceSpan);
            }
        });
    };
    /**
     * @param {?} elementName
     * @param {?} boundProps
     * @return {?}
     */
    TemplateParseVisitor.prototype._checkPropertiesInSchema = /**
     * @param {?} elementName
     * @param {?} boundProps
     * @return {?}
     */
    function (elementName, boundProps) {
        var _this = this;
        // Note: We can't filter out empty expressions before this method,
        // as we still want to validate them!
        return boundProps.filter(function (boundProp) {
            if (boundProp.type === t.PropertyBindingType.Property &&
                !_this._schemaRegistry.hasProperty(elementName, boundProp.name, _this._schemas)) {
                var /** @type {?} */ errorMsg = "Can't bind to '" + boundProp.name + "' since it isn't a known property of '" + elementName + "'.";
                if (elementName.startsWith('ng-')) {
                    errorMsg +=
                        "\n1. If '" + boundProp.name + "' is an Angular directive, then add 'CommonModule' to the '@NgModule.imports' of this component." +
                            "\n2. To allow any property add 'NO_ERRORS_SCHEMA' to the '@NgModule.schemas' of this component.";
                }
                else if (elementName.indexOf('-') > -1) {
                    errorMsg +=
                        "\n1. If '" + elementName + "' is an Angular component and it has '" + boundProp.name + "' input, then verify that it is part of this module." +
                            ("\n2. If '" + elementName + "' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the '@NgModule.schemas' of this component to suppress this message.") +
                            "\n3. To allow any property add 'NO_ERRORS_SCHEMA' to the '@NgModule.schemas' of this component.";
                }
                _this._reportError(errorMsg, boundProp.sourceSpan);
            }
            return !isEmptyExpression(boundProp.value);
        });
    };
    /**
     * @param {?} message
     * @param {?} sourceSpan
     * @param {?=} level
     * @return {?}
     */
    TemplateParseVisitor.prototype._reportError = /**
     * @param {?} message
     * @param {?} sourceSpan
     * @param {?=} level
     * @return {?}
     */
    function (message, sourceSpan, level) {
        if (level === void 0) { level = ParseErrorLevel.ERROR; }
        this._targetErrors.push(new ParseError(sourceSpan, message, level));
    };
    return TemplateParseVisitor;
}());
function TemplateParseVisitor_tsickle_Closure_declarations() {
    /** @type {?} */
    TemplateParseVisitor.prototype.selectorMatcher;
    /** @type {?} */
    TemplateParseVisitor.prototype.directivesIndex;
    /** @type {?} */
    TemplateParseVisitor.prototype.ngContentCount;
    /** @type {?} */
    TemplateParseVisitor.prototype.contentQueryStartId;
    /** @type {?} */
    TemplateParseVisitor.prototype.reflector;
    /** @type {?} */
    TemplateParseVisitor.prototype.config;
    /** @type {?} */
    TemplateParseVisitor.prototype.providerViewContext;
    /** @type {?} */
    TemplateParseVisitor.prototype._bindingParser;
    /** @type {?} */
    TemplateParseVisitor.prototype._schemaRegistry;
    /** @type {?} */
    TemplateParseVisitor.prototype._schemas;
    /** @type {?} */
    TemplateParseVisitor.prototype._targetErrors;
}
var NonBindableVisitor = /** @class */ (function () {
    function NonBindableVisitor() {
    }
    /**
     * @param {?} ast
     * @param {?} parent
     * @return {?}
     */
    NonBindableVisitor.prototype.visitElement = /**
     * @param {?} ast
     * @param {?} parent
     * @return {?}
     */
    function (ast, parent) {
        var /** @type {?} */ preparsedElement = preparseElement(ast);
        if (preparsedElement.type === PreparsedElementType.SCRIPT ||
            preparsedElement.type === PreparsedElementType.STYLE ||
            preparsedElement.type === PreparsedElementType.STYLESHEET) {
            // Skipping <script> for security reasons
            // Skipping <style> and stylesheets as we already processed them
            // in the StyleCompiler
            return null;
        }
        var /** @type {?} */ attrNameAndValues = ast.attrs.map(function (attr) { return [attr.name, attr.value]; });
        var /** @type {?} */ selector = createElementCssSelector(ast.name, attrNameAndValues);
        var /** @type {?} */ ngContentIndex = parent.findNgContentIndex(selector);
        var /** @type {?} */ children = html.visitAll(this, ast.children, EMPTY_ELEMENT_CONTEXT);
        return new t.ElementAst(ast.name, html.visitAll(this, ast.attrs), [], [], [], [], [], false, [], children, ngContentIndex, ast.sourceSpan, ast.endSourceSpan);
    };
    /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    NonBindableVisitor.prototype.visitComment = /**
     * @param {?} comment
     * @param {?} context
     * @return {?}
     */
    function (comment, context) { return null; };
    /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    NonBindableVisitor.prototype.visitAttribute = /**
     * @param {?} attribute
     * @param {?} context
     * @return {?}
     */
    function (attribute, context) {
        return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
    };
    /**
     * @param {?} text
     * @param {?} parent
     * @return {?}
     */
    NonBindableVisitor.prototype.visitText = /**
     * @param {?} text
     * @param {?} parent
     * @return {?}
     */
    function (text, parent) {
        var /** @type {?} */ ngContentIndex = /** @type {?} */ ((parent.findNgContentIndex(TEXT_CSS_SELECTOR)));
        return new t.TextAst(text.value, ngContentIndex, /** @type {?} */ ((text.sourceSpan)));
    };
    /**
     * @param {?} expansion
     * @param {?} context
     * @return {?}
     */
    NonBindableVisitor.prototype.visitExpansion = /**
     * @param {?} expansion
     * @param {?} context
     * @return {?}
     */
    function (expansion, context) { return expansion; };
    /**
     * @param {?} expansionCase
     * @param {?} context
     * @return {?}
     */
    NonBindableVisitor.prototype.visitExpansionCase = /**
     * @param {?} expansionCase
     * @param {?} context
     * @return {?}
     */
    function (expansionCase, context) { return expansionCase; };
    return NonBindableVisitor;
}());
/**
 * A reference to an element or directive in a template. E.g., the reference in this template:
 *
 * <div #myMenu="coolMenu">
 *
 * would be {name: 'myMenu', value: 'coolMenu', sourceSpan: ...}
 */
var /**
 * A reference to an element or directive in a template. E.g., the reference in this template:
 *
 * <div #myMenu="coolMenu">
 *
 * would be {name: 'myMenu', value: 'coolMenu', sourceSpan: ...}
 */
ElementOrDirectiveRef = /** @class */ (function () {
    function ElementOrDirectiveRef(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    /** Gets whether this is a reference to the given directive. */
    /**
     * Gets whether this is a reference to the given directive.
     * @param {?} directive
     * @return {?}
     */
    ElementOrDirectiveRef.prototype.isReferenceToDirective = /**
     * Gets whether this is a reference to the given directive.
     * @param {?} directive
     * @return {?}
     */
    function (directive) {
        return splitExportAs(directive.exportAs).indexOf(this.value) !== -1;
    };
    return ElementOrDirectiveRef;
}());
function ElementOrDirectiveRef_tsickle_Closure_declarations() {
    /** @type {?} */
    ElementOrDirectiveRef.prototype.name;
    /** @type {?} */
    ElementOrDirectiveRef.prototype.value;
    /** @type {?} */
    ElementOrDirectiveRef.prototype.sourceSpan;
}
/**
 * Splits a raw, potentially comma-delimited `exportAs` value into an array of names.
 * @param {?} exportAs
 * @return {?}
 */
function splitExportAs(exportAs) {
    return exportAs ? exportAs.split(',').map(function (e) { return e.trim(); }) : [];
}
/**
 * @param {?} classAttrValue
 * @return {?}
 */
export function splitClasses(classAttrValue) {
    return classAttrValue.trim().split(/\s+/g);
}
var ElementContext = /** @class */ (function () {
    function ElementContext(isTemplateElement, _ngContentIndexMatcher, _wildcardNgContentIndex, providerContext) {
        this.isTemplateElement = isTemplateElement;
        this._ngContentIndexMatcher = _ngContentIndexMatcher;
        this._wildcardNgContentIndex = _wildcardNgContentIndex;
        this.providerContext = providerContext;
    }
    /**
     * @param {?} isTemplateElement
     * @param {?} directives
     * @param {?} providerContext
     * @return {?}
     */
    ElementContext.create = /**
     * @param {?} isTemplateElement
     * @param {?} directives
     * @param {?} providerContext
     * @return {?}
     */
    function (isTemplateElement, directives, providerContext) {
        var /** @type {?} */ matcher = new SelectorMatcher();
        var /** @type {?} */ wildcardNgContentIndex = /** @type {?} */ ((null));
        var /** @type {?} */ component = directives.find(function (directive) { return directive.directive.isComponent; });
        if (component) {
            var /** @type {?} */ ngContentSelectors = /** @type {?} */ ((component.directive.template)).ngContentSelectors;
            for (var /** @type {?} */ i = 0; i < ngContentSelectors.length; i++) {
                var /** @type {?} */ selector = ngContentSelectors[i];
                if (selector === '*') {
                    wildcardNgContentIndex = i;
                }
                else {
                    matcher.addSelectables(CssSelector.parse(ngContentSelectors[i]), i);
                }
            }
        }
        return new ElementContext(isTemplateElement, matcher, wildcardNgContentIndex, providerContext);
    };
    /**
     * @param {?} selector
     * @return {?}
     */
    ElementContext.prototype.findNgContentIndex = /**
     * @param {?} selector
     * @return {?}
     */
    function (selector) {
        var /** @type {?} */ ngContentIndices = [];
        this._ngContentIndexMatcher.match(selector, function (selector, ngContentIndex) { ngContentIndices.push(ngContentIndex); });
        ngContentIndices.sort();
        if (this._wildcardNgContentIndex != null) {
            ngContentIndices.push(this._wildcardNgContentIndex);
        }
        return ngContentIndices.length > 0 ? ngContentIndices[0] : null;
    };
    return ElementContext;
}());
function ElementContext_tsickle_Closure_declarations() {
    /** @type {?} */
    ElementContext.prototype.isTemplateElement;
    /** @type {?} */
    ElementContext.prototype._ngContentIndexMatcher;
    /** @type {?} */
    ElementContext.prototype._wildcardNgContentIndex;
    /** @type {?} */
    ElementContext.prototype.providerContext;
}
/**
 * @param {?} elementName
 * @param {?} attributes
 * @return {?}
 */
export function createElementCssSelector(elementName, attributes) {
    var /** @type {?} */ cssSelector = new CssSelector();
    var /** @type {?} */ elNameNoNs = splitNsName(elementName)[1];
    cssSelector.setElement(elNameNoNs);
    for (var /** @type {?} */ i = 0; i < attributes.length; i++) {
        var /** @type {?} */ attrName = attributes[i][0];
        var /** @type {?} */ attrNameNoNs = splitNsName(attrName)[1];
        var /** @type {?} */ attrValue = attributes[i][1];
        cssSelector.addAttribute(attrNameNoNs, attrValue);
        if (attrName.toLowerCase() == CLASS_ATTR) {
            var /** @type {?} */ classes = splitClasses(attrValue);
            classes.forEach(function (className) { return cssSelector.addClassName(className); });
        }
    }
    return cssSelector;
}
var /** @type {?} */ EMPTY_ELEMENT_CONTEXT = new ElementContext(true, new SelectorMatcher(), null, null);
var /** @type {?} */ NON_BINDABLE_VISITOR = new NonBindableVisitor();
/**
 * @param {?} node
 * @return {?}
 */
function _isEmptyTextNode(node) {
    return node instanceof html.Text && node.value.trim().length == 0;
}
/**
 * @template T
 * @param {?} items
 * @return {?}
 */
export function removeSummaryDuplicates(items) {
    var /** @type {?} */ map = new Map();
    items.forEach(function (item) {
        if (!map.get(item.type.reference)) {
            map.set(item.type.reference, item);
        }
    });
    return Array.from(map.values());
}
/**
 * @param {?} ast
 * @return {?}
 */
function isEmptyExpression(ast) {
    if (ast instanceof ASTWithSource) {
        ast = ast.ast;
    }
    return ast instanceof EmptyExpr;
}
//# sourceMappingURL=template_parser.js.map