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
        define("@angular/compiler/src/template_parser/template_parser", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/identifiers", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_parser", "@angular/compiler/src/ml_parser/html_whitespaces", "@angular/compiler/src/ml_parser/icu_ast_expander", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/parse_util", "@angular/compiler/src/provider_analyzer", "@angular/compiler/src/selector", "@angular/compiler/src/style_url_resolver", "@angular/compiler/src/util", "@angular/compiler/src/template_parser/binding_parser", "@angular/compiler/src/template_parser/template_ast", "@angular/compiler/src/template_parser/template_preparser"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var html_parser_1 = require("@angular/compiler/src/ml_parser/html_parser");
    var html_whitespaces_1 = require("@angular/compiler/src/ml_parser/html_whitespaces");
    var icu_ast_expander_1 = require("@angular/compiler/src/ml_parser/icu_ast_expander");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var provider_analyzer_1 = require("@angular/compiler/src/provider_analyzer");
    var selector_1 = require("@angular/compiler/src/selector");
    var style_url_resolver_1 = require("@angular/compiler/src/style_url_resolver");
    var util_1 = require("@angular/compiler/src/util");
    var binding_parser_1 = require("@angular/compiler/src/template_parser/binding_parser");
    var t = require("@angular/compiler/src/template_parser/template_ast");
    var template_preparser_1 = require("@angular/compiler/src/template_parser/template_preparser");
    var BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.+))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
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
    var CLASS_ATTR = 'class';
    var TEXT_CSS_SELECTOR = selector_1.CssSelector.parse('*')[0];
    var TemplateParseError = /** @class */ (function (_super) {
        tslib_1.__extends(TemplateParseError, _super);
        function TemplateParseError(message, span, level) {
            return _super.call(this, span, message, level) || this;
        }
        return TemplateParseError;
    }(parse_util_1.ParseError));
    exports.TemplateParseError = TemplateParseError;
    var TemplateParseResult = /** @class */ (function () {
        function TemplateParseResult(templateAst, usedPipes, errors) {
            this.templateAst = templateAst;
            this.usedPipes = usedPipes;
            this.errors = errors;
        }
        return TemplateParseResult;
    }());
    exports.TemplateParseResult = TemplateParseResult;
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
            get: function () { return this._exprParser; },
            enumerable: true,
            configurable: true
        });
        TemplateParser.prototype.parse = function (component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
            var result = this.tryParse(component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces);
            var warnings = result.errors.filter(function (error) { return error.level === parse_util_1.ParseErrorLevel.WARNING; });
            var errors = result.errors.filter(function (error) { return error.level === parse_util_1.ParseErrorLevel.ERROR; });
            if (warnings.length > 0) {
                this._console.warn("Template parse warnings:\n" + warnings.join('\n'));
            }
            if (errors.length > 0) {
                var errorString = errors.join('\n');
                throw util_1.syntaxError("Template parse errors:\n" + errorString, errors);
            }
            return { template: result.templateAst, pipes: result.usedPipes };
        };
        TemplateParser.prototype.tryParse = function (component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
            var htmlParseResult = typeof template === 'string' ?
                this._htmlParser.parse(template, templateUrl, true, this.getInterpolationConfig(component)) :
                template;
            if (!preserveWhitespaces) {
                htmlParseResult = html_whitespaces_1.removeWhitespaces(htmlParseResult);
            }
            return this.tryParseHtml(this.expandHtml(htmlParseResult), component, directives, pipes, schemas);
        };
        TemplateParser.prototype.tryParseHtml = function (htmlAstWithErrors, component, directives, pipes, schemas) {
            var result;
            var errors = htmlAstWithErrors.errors;
            var usedPipes = [];
            if (htmlAstWithErrors.rootNodes.length > 0) {
                var uniqDirectives = removeSummaryDuplicates(directives);
                var uniqPipes = removeSummaryDuplicates(pipes);
                var providerViewContext = new provider_analyzer_1.ProviderViewContext(this._reflector, component);
                var interpolationConfig = undefined;
                if (component.template && component.template.interpolation) {
                    interpolationConfig = {
                        start: component.template.interpolation[0],
                        end: component.template.interpolation[1]
                    };
                }
                var bindingParser = new binding_parser_1.BindingParser(this._exprParser, interpolationConfig, this._schemaRegistry, uniqPipes, errors);
                var parseVisitor = new TemplateParseVisitor(this._reflector, this._config, providerViewContext, uniqDirectives, bindingParser, this._schemaRegistry, schemas, errors);
                result = html.visitAll(parseVisitor, htmlAstWithErrors.rootNodes, EMPTY_ELEMENT_CONTEXT);
                errors.push.apply(errors, tslib_1.__spread(providerViewContext.errors));
                usedPipes.push.apply(usedPipes, tslib_1.__spread(bindingParser.getUsedPipes()));
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
        TemplateParser.prototype.expandHtml = function (htmlAstWithErrors, forced) {
            if (forced === void 0) { forced = false; }
            var errors = htmlAstWithErrors.errors;
            if (errors.length == 0 || forced) {
                // Transform ICU messages to angular directives
                var expandedHtmlAst = icu_ast_expander_1.expandNodes(htmlAstWithErrors.rootNodes);
                errors.push.apply(errors, tslib_1.__spread(expandedHtmlAst.errors));
                htmlAstWithErrors = new html_parser_1.ParseTreeResult(expandedHtmlAst.nodes, errors);
            }
            return htmlAstWithErrors;
        };
        TemplateParser.prototype.getInterpolationConfig = function (component) {
            if (component.template) {
                return interpolation_config_1.InterpolationConfig.fromArray(component.template.interpolation);
            }
            return undefined;
        };
        /** @internal */
        TemplateParser.prototype._assertNoReferenceDuplicationOnTemplate = function (result, errors) {
            var existingReferences = [];
            result.filter(function (element) { return !!element.references; })
                .forEach(function (element) { return element.references.forEach(function (reference) {
                var name = reference.name;
                if (existingReferences.indexOf(name) < 0) {
                    existingReferences.push(name);
                }
                else {
                    var error = new TemplateParseError("Reference \"#" + name + "\" is defined several times", reference.sourceSpan, parse_util_1.ParseErrorLevel.ERROR);
                    errors.push(error);
                }
            }); });
        };
        return TemplateParser;
    }());
    exports.TemplateParser = TemplateParser;
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
            this.selectorMatcher = new selector_1.SelectorMatcher();
            this.directivesIndex = new Map();
            this.ngContentCount = 0;
            // Note: queries start with id 1 so we can use the number in a Bloom filter!
            this.contentQueryStartId = providerViewContext.component.viewQueries.length + 1;
            directives.forEach(function (directive, index) {
                var selector = selector_1.CssSelector.parse(directive.selector);
                _this.selectorMatcher.addSelectables(selector, directive);
                _this.directivesIndex.set(directive, index);
            });
        }
        TemplateParseVisitor.prototype.visitExpansion = function (expansion, context) { return null; };
        TemplateParseVisitor.prototype.visitExpansionCase = function (expansionCase, context) { return null; };
        TemplateParseVisitor.prototype.visitText = function (text, parent) {
            var ngContentIndex = parent.findNgContentIndex(TEXT_CSS_SELECTOR);
            var valueNoNgsp = html_whitespaces_1.replaceNgsp(text.value);
            var expr = this._bindingParser.parseInterpolation(valueNoNgsp, text.sourceSpan);
            return expr ? new t.BoundTextAst(expr, ngContentIndex, text.sourceSpan) :
                new t.TextAst(valueNoNgsp, ngContentIndex, text.sourceSpan);
        };
        TemplateParseVisitor.prototype.visitAttribute = function (attribute, context) {
            return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
        };
        TemplateParseVisitor.prototype.visitComment = function (comment, context) { return null; };
        TemplateParseVisitor.prototype.visitElement = function (element, parent) {
            var _this = this;
            var queryStartIndex = this.contentQueryStartId;
            var elName = element.name;
            var preparsedElement = template_preparser_1.preparseElement(element);
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.SCRIPT ||
                preparsedElement.type === template_preparser_1.PreparsedElementType.STYLE) {
                // Skipping <script> for security reasons
                // Skipping <style> as we already processed them
                // in the StyleCompiler
                return null;
            }
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.STYLESHEET &&
                style_url_resolver_1.isStyleUrlResolvable(preparsedElement.hrefAttr)) {
                // Skipping stylesheets with either relative urls or package scheme as we already processed
                // them in the StyleCompiler
                return null;
            }
            var matchableAttrs = [];
            var elementOrDirectiveProps = [];
            var elementOrDirectiveRefs = [];
            var elementVars = [];
            var events = [];
            var templateElementOrDirectiveProps = [];
            var templateMatchableAttrs = [];
            var templateElementVars = [];
            var hasInlineTemplates = false;
            var attrs = [];
            var isTemplateElement = tags_1.isNgTemplate(element.name);
            element.attrs.forEach(function (attr) {
                var parsedVariables = [];
                var hasBinding = _this._parseAttr(isTemplateElement, attr, matchableAttrs, elementOrDirectiveProps, events, elementOrDirectiveRefs, elementVars);
                elementVars.push.apply(elementVars, tslib_1.__spread(parsedVariables.map(function (v) { return t.VariableAst.fromParsedVariable(v); })));
                var templateValue;
                var templateKey;
                var normalizedName = _this._normalizeAttributeName(attr.name);
                if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                    templateValue = attr.value;
                    templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
                }
                var hasTemplateBinding = templateValue != null;
                if (hasTemplateBinding) {
                    if (hasInlineTemplates) {
                        _this._reportError("Can't have multiple template bindings on one element. Use only one attribute prefixed with *", attr.sourceSpan);
                    }
                    hasInlineTemplates = true;
                    var parsedVariables_1 = [];
                    _this._bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attr.sourceSpan, templateMatchableAttrs, templateElementOrDirectiveProps, parsedVariables_1);
                    templateElementVars.push.apply(templateElementVars, tslib_1.__spread(parsedVariables_1.map(function (v) { return t.VariableAst.fromParsedVariable(v); })));
                }
                if (!hasBinding && !hasTemplateBinding) {
                    // don't include the bindings as attributes as well in the AST
                    attrs.push(_this.visitAttribute(attr, null));
                    matchableAttrs.push([attr.name, attr.value]);
                }
            });
            var elementCssSelector = createElementCssSelector(elName, matchableAttrs);
            var _a = this._parseDirectives(this.selectorMatcher, elementCssSelector), directiveMetas = _a.directives, matchElement = _a.matchElement;
            var references = [];
            var boundDirectivePropNames = new Set();
            var directiveAsts = this._createDirectiveAsts(isTemplateElement, element.name, directiveMetas, elementOrDirectiveProps, elementOrDirectiveRefs, element.sourceSpan, references, boundDirectivePropNames);
            var elementProps = this._createElementPropertyAsts(element.name, elementOrDirectiveProps, boundDirectivePropNames);
            var isViewRoot = parent.isTemplateElement || hasInlineTemplates;
            var providerContext = new provider_analyzer_1.ProviderElementContext(this.providerViewContext, parent.providerContext, isViewRoot, directiveAsts, attrs, references, isTemplateElement, queryStartIndex, element.sourceSpan);
            var children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children, ElementContext.create(isTemplateElement, directiveAsts, isTemplateElement ? parent.providerContext : providerContext));
            providerContext.afterElement();
            // Override the actual selector when the `ngProjectAs` attribute is provided
            var projectionSelector = preparsedElement.projectAs != '' ?
                selector_1.CssSelector.parse(preparsedElement.projectAs)[0] :
                elementCssSelector;
            var ngContentIndex = parent.findNgContentIndex(projectionSelector);
            var parsedElement;
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.NG_CONTENT) {
                // `<ng-content>` element
                if (element.children && !element.children.every(_isEmptyTextNode)) {
                    this._reportError("<ng-content> element cannot have content.", element.sourceSpan);
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
                var ngContentIndex_1 = hasInlineTemplates ? null : parent.findNgContentIndex(projectionSelector);
                parsedElement = new t.ElementAst(elName, attrs, elementProps, events, references, providerContext.transformedDirectiveAsts, providerContext.transformProviders, providerContext.transformedHasViewContainer, providerContext.queryMatches, children, hasInlineTemplates ? null : ngContentIndex_1, element.sourceSpan, element.endSourceSpan || null);
            }
            if (hasInlineTemplates) {
                // The element as a *-attribute
                var templateQueryStartIndex = this.contentQueryStartId;
                var templateSelector = createElementCssSelector('ng-template', templateMatchableAttrs);
                var directives = this._parseDirectives(this.selectorMatcher, templateSelector).directives;
                var templateBoundDirectivePropNames = new Set();
                var templateDirectiveAsts = this._createDirectiveAsts(true, elName, directives, templateElementOrDirectiveProps, [], element.sourceSpan, [], templateBoundDirectivePropNames);
                var templateElementProps = this._createElementPropertyAsts(elName, templateElementOrDirectiveProps, templateBoundDirectivePropNames);
                this._assertNoComponentsNorElementBindingsOnTemplate(templateDirectiveAsts, templateElementProps, element.sourceSpan);
                var templateProviderContext = new provider_analyzer_1.ProviderElementContext(this.providerViewContext, parent.providerContext, parent.isTemplateElement, templateDirectiveAsts, [], [], true, templateQueryStartIndex, element.sourceSpan);
                templateProviderContext.afterElement();
                parsedElement = new t.EmbeddedTemplateAst([], [], [], templateElementVars, templateProviderContext.transformedDirectiveAsts, templateProviderContext.transformProviders, templateProviderContext.transformedHasViewContainer, templateProviderContext.queryMatches, [parsedElement], ngContentIndex, element.sourceSpan);
            }
            return parsedElement;
        };
        TemplateParseVisitor.prototype._parseAttr = function (isTemplateElement, attr, targetMatchableAttrs, targetProps, targetEvents, targetRefs, targetVars) {
            var name = this._normalizeAttributeName(attr.name);
            var value = attr.value;
            var srcSpan = attr.sourceSpan;
            var boundEvents = [];
            var bindParts = name.match(BIND_NAME_REGEXP);
            var hasBinding = false;
            if (bindParts !== null) {
                hasBinding = true;
                if (bindParts[KW_BIND_IDX] != null) {
                    this._bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, targetMatchableAttrs, targetProps);
                }
                else if (bindParts[KW_LET_IDX]) {
                    if (isTemplateElement) {
                        var identifier = bindParts[IDENT_KW_IDX];
                        this._parseVariable(identifier, value, srcSpan, targetVars);
                    }
                    else {
                        this._reportError("\"let-\" is only supported on ng-template elements.", srcSpan);
                    }
                }
                else if (bindParts[KW_REF_IDX]) {
                    var identifier = bindParts[IDENT_KW_IDX];
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
            targetEvents.push.apply(targetEvents, tslib_1.__spread(boundEvents.map(function (e) { return t.BoundEventAst.fromParsedEvent(e); })));
            return hasBinding;
        };
        TemplateParseVisitor.prototype._normalizeAttributeName = function (attrName) {
            return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
        };
        TemplateParseVisitor.prototype._parseVariable = function (identifier, value, sourceSpan, targetVars) {
            if (identifier.indexOf('-') > -1) {
                this._reportError("\"-\" is not allowed in variable names", sourceSpan);
            }
            targetVars.push(new t.VariableAst(identifier, value, sourceSpan));
        };
        TemplateParseVisitor.prototype._parseReference = function (identifier, value, sourceSpan, targetRefs) {
            if (identifier.indexOf('-') > -1) {
                this._reportError("\"-\" is not allowed in reference names", sourceSpan);
            }
            targetRefs.push(new ElementOrDirectiveRef(identifier, value, sourceSpan));
        };
        TemplateParseVisitor.prototype._parseAssignmentEvent = function (name, expression, sourceSpan, targetMatchableAttrs, targetEvents) {
            this._bindingParser.parseEvent(name + "Change", expression + "=$event", sourceSpan, targetMatchableAttrs, targetEvents);
        };
        TemplateParseVisitor.prototype._parseDirectives = function (selectorMatcher, elementCssSelector) {
            var _this = this;
            // Need to sort the directives so that we get consistent results throughout,
            // as selectorMatcher uses Maps inside.
            // Also deduplicate directives as they might match more than one time!
            var directives = new Array(this.directivesIndex.size);
            // Whether any directive selector matches on the element name
            var matchElement = false;
            selectorMatcher.match(elementCssSelector, function (selector, directive) {
                directives[_this.directivesIndex.get(directive)] = directive;
                matchElement = matchElement || selector.hasElementSelector();
            });
            return {
                directives: directives.filter(function (dir) { return !!dir; }),
                matchElement: matchElement,
            };
        };
        TemplateParseVisitor.prototype._createDirectiveAsts = function (isTemplateElement, elementName, directives, props, elementOrDirectiveRefs, elementSourceSpan, targetReferences, targetBoundDirectivePropNames) {
            var _this = this;
            var matchedReferences = new Set();
            var component = null;
            var directiveAsts = directives.map(function (directive) {
                var sourceSpan = new parse_util_1.ParseSourceSpan(elementSourceSpan.start, elementSourceSpan.end, "Directive " + compile_metadata_1.identifierName(directive.type));
                if (directive.isComponent) {
                    component = directive;
                }
                var directiveProperties = [];
                var boundProperties = _this._bindingParser.createDirectiveHostPropertyAsts(directive, elementName, sourceSpan);
                var hostProperties = boundProperties.map(function (prop) { return t.BoundElementPropertyAst.fromBoundProperty(prop); });
                // Note: We need to check the host properties here as well,
                // as we don't know the element name in the DirectiveWrapperCompiler yet.
                hostProperties = _this._checkPropertiesInSchema(elementName, hostProperties);
                var parsedEvents = _this._bindingParser.createDirectiveHostEventAsts(directive, sourceSpan);
                _this._createDirectivePropertyAsts(directive.inputs, props, directiveProperties, targetBoundDirectivePropNames);
                elementOrDirectiveRefs.forEach(function (elOrDirRef) {
                    if ((elOrDirRef.value.length === 0 && directive.isComponent) ||
                        (elOrDirRef.isReferenceToDirective(directive))) {
                        targetReferences.push(new t.ReferenceAst(elOrDirRef.name, identifiers_1.createTokenForReference(directive.type.reference), elOrDirRef.value, elOrDirRef.sourceSpan));
                        matchedReferences.add(elOrDirRef.name);
                    }
                });
                var hostEvents = parsedEvents.map(function (e) { return t.BoundEventAst.fromParsedEvent(e); });
                var contentQueryStartId = _this.contentQueryStartId;
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
                    var refToken = null;
                    if (isTemplateElement) {
                        refToken = identifiers_1.createTokenForExternalReference(_this.reflector, identifiers_1.Identifiers.TemplateRef);
                    }
                    targetReferences.push(new t.ReferenceAst(elOrDirRef.name, refToken, elOrDirRef.value, elOrDirRef.sourceSpan));
                }
            });
            return directiveAsts;
        };
        TemplateParseVisitor.prototype._createDirectivePropertyAsts = function (directiveProperties, boundProps, targetBoundDirectiveProps, targetBoundDirectivePropNames) {
            if (directiveProperties) {
                var boundPropsByName_1 = new Map();
                boundProps.forEach(function (boundProp) {
                    var prevValue = boundPropsByName_1.get(boundProp.name);
                    if (!prevValue || prevValue.isLiteral) {
                        // give [a]="b" a higher precedence than a="b" on the same element
                        boundPropsByName_1.set(boundProp.name, boundProp);
                    }
                });
                Object.keys(directiveProperties).forEach(function (dirProp) {
                    var elProp = directiveProperties[dirProp];
                    var boundProp = boundPropsByName_1.get(elProp);
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
        TemplateParseVisitor.prototype._createElementPropertyAsts = function (elementName, props, boundDirectivePropNames) {
            var _this = this;
            var boundElementProps = [];
            props.forEach(function (prop) {
                if (!prop.isLiteral && !boundDirectivePropNames.has(prop.name)) {
                    var boundProp = _this._bindingParser.createBoundElementProperty(elementName, prop);
                    boundElementProps.push(t.BoundElementPropertyAst.fromBoundProperty(boundProp));
                }
            });
            return this._checkPropertiesInSchema(elementName, boundElementProps);
        };
        TemplateParseVisitor.prototype._findComponentDirectives = function (directives) {
            return directives.filter(function (directive) { return directive.directive.isComponent; });
        };
        TemplateParseVisitor.prototype._findComponentDirectiveNames = function (directives) {
            return this._findComponentDirectives(directives)
                .map(function (directive) { return compile_metadata_1.identifierName(directive.directive.type); });
        };
        TemplateParseVisitor.prototype._assertOnlyOneComponent = function (directives, sourceSpan) {
            var componentTypeNames = this._findComponentDirectiveNames(directives);
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
         * @param matchElement Whether any directive has matched on the tag name
         * @param element the html element
         */
        TemplateParseVisitor.prototype._assertElementExists = function (matchElement, element) {
            var elName = element.name.replace(/^:xhtml:/, '');
            if (!matchElement && !this._schemaRegistry.hasElement(elName, this._schemas)) {
                var errorMsg = "'" + elName + "' is not a known element:\n";
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
                this._reportError(errorMsg, element.sourceSpan);
            }
        };
        TemplateParseVisitor.prototype._assertNoComponentsNorElementBindingsOnTemplate = function (directives, elementProps, sourceSpan) {
            var _this = this;
            var componentTypeNames = this._findComponentDirectiveNames(directives);
            if (componentTypeNames.length > 0) {
                this._reportError("Components on an embedded template: " + componentTypeNames.join(','), sourceSpan);
            }
            elementProps.forEach(function (prop) {
                _this._reportError("Property binding " + prop.name + " not used by any directive on an embedded template. Make sure that the property name is spelled correctly and all directives are listed in the \"@NgModule.declarations\".", sourceSpan);
            });
        };
        TemplateParseVisitor.prototype._assertAllEventsPublishedByDirectives = function (directives, events) {
            var _this = this;
            var allDirectiveEvents = new Set();
            directives.forEach(function (directive) {
                Object.keys(directive.directive.outputs).forEach(function (k) {
                    var eventName = directive.directive.outputs[k];
                    allDirectiveEvents.add(eventName);
                });
            });
            events.forEach(function (event) {
                if (event.target != null || !allDirectiveEvents.has(event.name)) {
                    _this._reportError("Event binding " + event.fullName + " not emitted by any directive on an embedded template. Make sure that the event name is spelled correctly and all directives are listed in the \"@NgModule.declarations\".", event.sourceSpan);
                }
            });
        };
        TemplateParseVisitor.prototype._checkPropertiesInSchema = function (elementName, boundProps) {
            var _this = this;
            // Note: We can't filter out empty expressions before this method,
            // as we still want to validate them!
            return boundProps.filter(function (boundProp) {
                if (boundProp.type === t.PropertyBindingType.Property &&
                    !_this._schemaRegistry.hasProperty(elementName, boundProp.name, _this._schemas)) {
                    var errorMsg = "Can't bind to '" + boundProp.name + "' since it isn't a known property of '" + elementName + "'.";
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
        TemplateParseVisitor.prototype._reportError = function (message, sourceSpan, level) {
            if (level === void 0) { level = parse_util_1.ParseErrorLevel.ERROR; }
            this._targetErrors.push(new parse_util_1.ParseError(sourceSpan, message, level));
        };
        return TemplateParseVisitor;
    }());
    var NonBindableVisitor = /** @class */ (function () {
        function NonBindableVisitor() {
        }
        NonBindableVisitor.prototype.visitElement = function (ast, parent) {
            var preparsedElement = template_preparser_1.preparseElement(ast);
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.SCRIPT ||
                preparsedElement.type === template_preparser_1.PreparsedElementType.STYLE ||
                preparsedElement.type === template_preparser_1.PreparsedElementType.STYLESHEET) {
                // Skipping <script> for security reasons
                // Skipping <style> and stylesheets as we already processed them
                // in the StyleCompiler
                return null;
            }
            var attrNameAndValues = ast.attrs.map(function (attr) { return [attr.name, attr.value]; });
            var selector = createElementCssSelector(ast.name, attrNameAndValues);
            var ngContentIndex = parent.findNgContentIndex(selector);
            var children = html.visitAll(this, ast.children, EMPTY_ELEMENT_CONTEXT);
            return new t.ElementAst(ast.name, html.visitAll(this, ast.attrs), [], [], [], [], [], false, [], children, ngContentIndex, ast.sourceSpan, ast.endSourceSpan);
        };
        NonBindableVisitor.prototype.visitComment = function (comment, context) { return null; };
        NonBindableVisitor.prototype.visitAttribute = function (attribute, context) {
            return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
        };
        NonBindableVisitor.prototype.visitText = function (text, parent) {
            var ngContentIndex = parent.findNgContentIndex(TEXT_CSS_SELECTOR);
            return new t.TextAst(text.value, ngContentIndex, text.sourceSpan);
        };
        NonBindableVisitor.prototype.visitExpansion = function (expansion, context) { return expansion; };
        NonBindableVisitor.prototype.visitExpansionCase = function (expansionCase, context) { return expansionCase; };
        return NonBindableVisitor;
    }());
    /**
     * A reference to an element or directive in a template. E.g., the reference in this template:
     *
     * <div #myMenu="coolMenu">
     *
     * would be {name: 'myMenu', value: 'coolMenu', sourceSpan: ...}
     */
    var ElementOrDirectiveRef = /** @class */ (function () {
        function ElementOrDirectiveRef(name, value, sourceSpan) {
            this.name = name;
            this.value = value;
            this.sourceSpan = sourceSpan;
        }
        /** Gets whether this is a reference to the given directive. */
        ElementOrDirectiveRef.prototype.isReferenceToDirective = function (directive) {
            return splitExportAs(directive.exportAs).indexOf(this.value) !== -1;
        };
        return ElementOrDirectiveRef;
    }());
    /** Splits a raw, potentially comma-delimited `exportAs` value into an array of names. */
    function splitExportAs(exportAs) {
        return exportAs ? exportAs.split(',').map(function (e) { return e.trim(); }) : [];
    }
    function splitClasses(classAttrValue) {
        return classAttrValue.trim().split(/\s+/g);
    }
    exports.splitClasses = splitClasses;
    var ElementContext = /** @class */ (function () {
        function ElementContext(isTemplateElement, _ngContentIndexMatcher, _wildcardNgContentIndex, providerContext) {
            this.isTemplateElement = isTemplateElement;
            this._ngContentIndexMatcher = _ngContentIndexMatcher;
            this._wildcardNgContentIndex = _wildcardNgContentIndex;
            this.providerContext = providerContext;
        }
        ElementContext.create = function (isTemplateElement, directives, providerContext) {
            var matcher = new selector_1.SelectorMatcher();
            var wildcardNgContentIndex = null;
            var component = directives.find(function (directive) { return directive.directive.isComponent; });
            if (component) {
                var ngContentSelectors = component.directive.template.ngContentSelectors;
                for (var i = 0; i < ngContentSelectors.length; i++) {
                    var selector = ngContentSelectors[i];
                    if (selector === '*') {
                        wildcardNgContentIndex = i;
                    }
                    else {
                        matcher.addSelectables(selector_1.CssSelector.parse(ngContentSelectors[i]), i);
                    }
                }
            }
            return new ElementContext(isTemplateElement, matcher, wildcardNgContentIndex, providerContext);
        };
        ElementContext.prototype.findNgContentIndex = function (selector) {
            var ngContentIndices = [];
            this._ngContentIndexMatcher.match(selector, function (selector, ngContentIndex) { ngContentIndices.push(ngContentIndex); });
            ngContentIndices.sort();
            if (this._wildcardNgContentIndex != null) {
                ngContentIndices.push(this._wildcardNgContentIndex);
            }
            return ngContentIndices.length > 0 ? ngContentIndices[0] : null;
        };
        return ElementContext;
    }());
    function createElementCssSelector(elementName, attributes) {
        var cssSelector = new selector_1.CssSelector();
        var elNameNoNs = tags_1.splitNsName(elementName)[1];
        cssSelector.setElement(elNameNoNs);
        for (var i = 0; i < attributes.length; i++) {
            var attrName = attributes[i][0];
            var attrNameNoNs = tags_1.splitNsName(attrName)[1];
            var attrValue = attributes[i][1];
            cssSelector.addAttribute(attrNameNoNs, attrValue);
            if (attrName.toLowerCase() == CLASS_ATTR) {
                var classes = splitClasses(attrValue);
                classes.forEach(function (className) { return cssSelector.addClassName(className); });
            }
        }
        return cssSelector;
    }
    exports.createElementCssSelector = createElementCssSelector;
    var EMPTY_ELEMENT_CONTEXT = new ElementContext(true, new selector_1.SelectorMatcher(), null, null);
    var NON_BINDABLE_VISITOR = new NonBindableVisitor();
    function _isEmptyTextNode(node) {
        return node instanceof html.Text && node.value.trim().length == 0;
    }
    function removeSummaryDuplicates(items) {
        var map = new Map();
        items.forEach(function (item) {
            if (!map.get(item.type.reference)) {
                map.set(item.type.reference, item);
            }
        });
        return Array.from(map.values());
    }
    exports.removeSummaryDuplicates = removeSummaryDuplicates;
    function isEmptyExpression(ast) {
        if (ast instanceof ast_1.ASTWithSource) {
            ast = ast.ast;
        }
        return ast instanceof ast_1.EmptyExpr;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsMkVBQXFLO0lBSXJLLG1FQUFvSDtJQUVwSCxpRUFBcUc7SUFDckcsMERBQXlDO0lBQ3pDLDJFQUFxRTtJQUNyRSxxRkFBNkU7SUFDN0UscUZBQTBEO0lBQzFELDZGQUFzRTtJQUN0RSw2REFBNEQ7SUFDNUQsK0RBQTJFO0lBQzNFLDZFQUFpRjtJQUVqRiwyREFBeUQ7SUFDekQsK0VBQTJEO0lBQzNELG1EQUE2QztJQUU3Qyx1RkFBK0M7SUFDL0Msc0VBQW9DO0lBQ3BDLCtGQUEyRTtJQUUzRSxJQUFNLGdCQUFnQixHQUNsQiwwR0FBMEcsQ0FBQztJQUUvRyxvQkFBb0I7SUFDcEIsSUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0lBQ3RCLG1CQUFtQjtJQUNuQixJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDckIscUJBQXFCO0lBQ3JCLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNyQixrQkFBa0I7SUFDbEIsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBQ3BCLHNCQUFzQjtJQUN0QixJQUFNLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDeEIsZ0JBQWdCO0lBQ2hCLElBQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztJQUNwQixvRkFBb0Y7SUFDcEYsSUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLG1DQUFtQztJQUNuQyxJQUFNLG9CQUFvQixHQUFHLENBQUMsQ0FBQztJQUMvQixpQ0FBaUM7SUFDakMsSUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7SUFDN0Isa0NBQWtDO0lBQ2xDLElBQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQztJ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LEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUU5QixLQUFLLENBQUMsT0FBTyxDQUFDLFVBQUMsSUFBSTtZQUNqQixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUNqQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ3BDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQVZELDBEQVVDO0lBRUQsMkJBQTJCLEdBQVE7UUFDakMsSUFBSSxHQUFHLFlBQVksbUJBQWEsRUFBRTtZQUNoQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQztTQUNmO1FBQ0QsT0FBTyxHQUFHLFlBQVksZUFBUyxDQUFDO0lBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgQ29tcGlsZVBpcGVTdW1tYXJ5LCBDb21waWxlVG9rZW5NZXRhZGF0YSwgQ29tcGlsZVR5cGVNZXRhZGF0YSwgaWRlbnRpZmllck5hbWV9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0NvbXBpbGVyQ29uZmlnfSBmcm9tICcuLi9jb25maWcnO1xuaW1wb3J0IHtTY2hlbWFNZXRhZGF0YX0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQVNUV2l0aFNvdXJjZSwgRW1wdHlFeHByLCBQYXJzZWRFdmVudCwgUGFyc2VkUHJvcGVydHksIFBhcnNlZFZhcmlhYmxlfSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtQYXJzZXJ9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQge0lkZW50aWZpZXJzLCBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlLCBjcmVhdGVUb2tlbkZvclJlZmVyZW5jZX0gZnJvbSAnLi4vaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7SHRtbFBhcnNlciwgUGFyc2VUcmVlUmVzdWx0fSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtyZW1vdmVXaGl0ZXNwYWNlcywgcmVwbGFjZU5nc3B9IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3doaXRlc3BhY2VzJztcbmltcG9ydCB7ZXhwYW5kTm9kZXN9IGZyb20gJy4uL21sX3BhcnNlci9pY3VfYXN0X2V4cGFuZGVyJztcbmltcG9ydCB7SW50ZXJwb2xhdGlvbkNvbmZpZ30gZnJvbSAnLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7aXNOZ1RlbXBsYXRlLCBzcGxpdE5zTmFtZX0gZnJvbSAnLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZUVycm9yTGV2ZWwsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge1Byb3ZpZGVyRWxlbWVudENvbnRleHQsIFByb3ZpZGVyVmlld0NvbnRleHR9IGZyb20gJy4uL3Byb3ZpZGVyX2FuYWx5emVyJztcbmltcG9ydCB7RWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi9zY2hlbWEvZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi9zZWxlY3Rvcic7XG5pbXBvcnQge2lzU3R5bGVVcmxSZXNvbHZhYmxlfSBmcm9tICcuLi9zdHlsZV91cmxfcmVzb2x2ZXInO1xuaW1wb3J0IHtDb25zb2xlLCBzeW50YXhFcnJvcn0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vdGVtcGxhdGVfYXN0JztcbmltcG9ydCB7UHJlcGFyc2VkRWxlbWVudFR5cGUsIHByZXBhcnNlRWxlbWVudH0gZnJvbSAnLi90ZW1wbGF0ZV9wcmVwYXJzZXInO1xuXG5jb25zdCBCSU5EX05BTUVfUkVHRVhQID1cbiAgICAvXig/Oig/Oig/OihiaW5kLSl8KGxldC0pfChyZWYtfCMpfChvbi0pfChiaW5kb24tKXwoQCkpKC4rKSl8XFxbXFwoKFteXFwpXSspXFwpXFxdfFxcWyhbXlxcXV0rKVxcXXxcXCgoW15cXCldKylcXCkpJC87XG5cbi8vIEdyb3VwIDEgPSBcImJpbmQtXCJcbmNvbnN0IEtXX0JJTkRfSURYID0gMTtcbi8vIEdyb3VwIDIgPSBcImxldC1cIlxuY29uc3QgS1dfTEVUX0lEWCA9IDI7XG4vLyBHcm91cCAzID0gXCJyZWYtLyNcIlxuY29uc3QgS1dfUkVGX0lEWCA9IDM7XG4vLyBHcm91cCA0ID0gXCJvbi1cIlxuY29uc3QgS1dfT05fSURYID0gNDtcbi8vIEdyb3VwIDUgPSBcImJpbmRvbi1cIlxuY29uc3QgS1dfQklORE9OX0lEWCA9IDU7XG4vLyBHcm91cCA2ID0gXCJAXCJcbmNvbnN0IEtXX0FUX0lEWCA9IDY7XG4vLyBHcm91cCA3ID0gdGhlIGlkZW50aWZpZXIgYWZ0ZXIgXCJiaW5kLVwiLCBcImxldC1cIiwgXCJyZWYtLyNcIiwgXCJvbi1cIiwgXCJiaW5kb24tXCIgb3IgXCJAXCJcbmNvbnN0IElERU5UX0tXX0lEWCA9IDc7XG4vLyBHcm91cCA4ID0gaWRlbnRpZmllciBpbnNpZGUgWygpXVxuY29uc3QgSURFTlRfQkFOQU5BX0JPWF9JRFggPSA4O1xuLy8gR3JvdXAgOSA9IGlkZW50aWZpZXIgaW5zaWRlIFtdXG5jb25zdCBJREVOVF9QUk9QRVJUWV9JRFggPSA5O1xuLy8gR3JvdXAgMTAgPSBpZGVudGlmaWVyIGluc2lkZSAoKVxuY29uc3QgSURFTlRfRVZFTlRfSURYID0gMTA7XG5cbmNvbnN0IFRFTVBMQVRFX0FUVFJfUFJFRklYID0gJyonO1xuY29uc3QgQ0xBU1NfQVRUUiA9ICdjbGFzcyc7XG5cbmNvbnN0IFRFWFRfQ1NTX1NFTEVDVE9SID0gQ3NzU2VsZWN0b3IucGFyc2UoJyonKVswXTtcblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VFcnJvciBleHRlbmRzIFBhcnNlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIHNwYW46IFBhcnNlU291cmNlU3BhbiwgbGV2ZWw6IFBhcnNlRXJyb3JMZXZlbCkge1xuICAgIHN1cGVyKHNwYW4sIG1lc3NhZ2UsIGxldmVsKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVQYXJzZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIHRlbXBsYXRlQXN0PzogdC5UZW1wbGF0ZUFzdFtdLCBwdWJsaWMgdXNlZFBpcGVzPzogQ29tcGlsZVBpcGVTdW1tYXJ5W10sXG4gICAgICBwdWJsaWMgZXJyb3JzPzogUGFyc2VFcnJvcltdKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVQYXJzZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgX2NvbmZpZzogQ29tcGlsZXJDb25maWcsIHByaXZhdGUgX3JlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcixcbiAgICAgIHByaXZhdGUgX2V4cHJQYXJzZXI6IFBhcnNlciwgcHJpdmF0ZSBfc2NoZW1hUmVnaXN0cnk6IEVsZW1lbnRTY2hlbWFSZWdpc3RyeSxcbiAgICAgIHByaXZhdGUgX2h0bWxQYXJzZXI6IEh0bWxQYXJzZXIsIHByaXZhdGUgX2NvbnNvbGU6IENvbnNvbGUsXG4gICAgICBwdWJsaWMgdHJhbnNmb3JtczogdC5UZW1wbGF0ZUFzdFZpc2l0b3JbXSkge31cblxuICBwdWJsaWMgZ2V0IGV4cHJlc3Npb25QYXJzZXIoKSB7IHJldHVybiB0aGlzLl9leHByUGFyc2VyOyB9XG5cbiAgcGFyc2UoXG4gICAgICBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgdGVtcGxhdGU6IHN0cmluZ3xQYXJzZVRyZWVSZXN1bHQsXG4gICAgICBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBwaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10sIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10sXG4gICAgICB0ZW1wbGF0ZVVybDogc3RyaW5nLFxuICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlczogYm9vbGVhbik6IHt0ZW1wbGF0ZTogdC5UZW1wbGF0ZUFzdFtdLCBwaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W119IHtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnRyeVBhcnNlKFxuICAgICAgICBjb21wb25lbnQsIHRlbXBsYXRlLCBkaXJlY3RpdmVzLCBwaXBlcywgc2NoZW1hcywgdGVtcGxhdGVVcmwsIHByZXNlcnZlV2hpdGVzcGFjZXMpO1xuICAgIGNvbnN0IHdhcm5pbmdzID0gcmVzdWx0LmVycm9ycyAhLmZpbHRlcihlcnJvciA9PiBlcnJvci5sZXZlbCA9PT0gUGFyc2VFcnJvckxldmVsLldBUk5JTkcpO1xuXG4gICAgY29uc3QgZXJyb3JzID0gcmVzdWx0LmVycm9ycyAhLmZpbHRlcihlcnJvciA9PiBlcnJvci5sZXZlbCA9PT0gUGFyc2VFcnJvckxldmVsLkVSUk9SKTtcblxuICAgIGlmICh3YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9jb25zb2xlLndhcm4oYFRlbXBsYXRlIHBhcnNlIHdhcm5pbmdzOlxcbiR7d2FybmluZ3Muam9pbignXFxuJyl9YCk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBlcnJvclN0cmluZyA9IGVycm9ycy5qb2luKCdcXG4nKTtcbiAgICAgIHRocm93IHN5bnRheEVycm9yKGBUZW1wbGF0ZSBwYXJzZSBlcnJvcnM6XFxuJHtlcnJvclN0cmluZ31gLCBlcnJvcnMpO1xuICAgIH1cblxuICAgIHJldHVybiB7dGVtcGxhdGU6IHJlc3VsdC50ZW1wbGF0ZUFzdCAhLCBwaXBlczogcmVzdWx0LnVzZWRQaXBlcyAhfTtcbiAgfVxuXG4gIHRyeVBhcnNlKFxuICAgICAgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHRlbXBsYXRlOiBzdHJpbmd8UGFyc2VUcmVlUmVzdWx0LFxuICAgICAgZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdLCBzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdLFxuICAgICAgdGVtcGxhdGVVcmw6IHN0cmluZywgcHJlc2VydmVXaGl0ZXNwYWNlczogYm9vbGVhbik6IFRlbXBsYXRlUGFyc2VSZXN1bHQge1xuICAgIGxldCBodG1sUGFyc2VSZXN1bHQgPSB0eXBlb2YgdGVtcGxhdGUgPT09ICdzdHJpbmcnID9cbiAgICAgICAgdGhpcy5faHRtbFBhcnNlciAhLnBhcnNlKFxuICAgICAgICAgICAgdGVtcGxhdGUsIHRlbXBsYXRlVXJsLCB0cnVlLCB0aGlzLmdldEludGVycG9sYXRpb25Db25maWcoY29tcG9uZW50KSkgOlxuICAgICAgICB0ZW1wbGF0ZTtcblxuICAgIGlmICghcHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgICAgaHRtbFBhcnNlUmVzdWx0ID0gcmVtb3ZlV2hpdGVzcGFjZXMoaHRtbFBhcnNlUmVzdWx0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy50cnlQYXJzZUh0bWwoXG4gICAgICAgIHRoaXMuZXhwYW5kSHRtbChodG1sUGFyc2VSZXN1bHQpLCBjb21wb25lbnQsIGRpcmVjdGl2ZXMsIHBpcGVzLCBzY2hlbWFzKTtcbiAgfVxuXG4gIHRyeVBhcnNlSHRtbChcbiAgICAgIGh0bWxBc3RXaXRoRXJyb3JzOiBQYXJzZVRyZWVSZXN1bHQsIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLFxuICAgICAgZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSwgcGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdLFxuICAgICAgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSk6IFRlbXBsYXRlUGFyc2VSZXN1bHQge1xuICAgIGxldCByZXN1bHQ6IHQuVGVtcGxhdGVBc3RbXTtcbiAgICBjb25zdCBlcnJvcnMgPSBodG1sQXN0V2l0aEVycm9ycy5lcnJvcnM7XG4gICAgY29uc3QgdXNlZFBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSA9IFtdO1xuICAgIGlmIChodG1sQXN0V2l0aEVycm9ycy5yb290Tm9kZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgdW5pcURpcmVjdGl2ZXMgPSByZW1vdmVTdW1tYXJ5RHVwbGljYXRlcyhkaXJlY3RpdmVzKTtcbiAgICAgIGNvbnN0IHVuaXFQaXBlcyA9IHJlbW92ZVN1bW1hcnlEdXBsaWNhdGVzKHBpcGVzKTtcbiAgICAgIGNvbnN0IHByb3ZpZGVyVmlld0NvbnRleHQgPSBuZXcgUHJvdmlkZXJWaWV3Q29udGV4dCh0aGlzLl9yZWZsZWN0b3IsIGNvbXBvbmVudCk7XG4gICAgICBsZXQgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IHVuZGVmaW5lZCAhO1xuICAgICAgaWYgKGNvbXBvbmVudC50ZW1wbGF0ZSAmJiBjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvbikge1xuICAgICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnID0ge1xuICAgICAgICAgIHN0YXJ0OiBjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvblswXSxcbiAgICAgICAgICBlbmQ6IGNvbXBvbmVudC50ZW1wbGF0ZS5pbnRlcnBvbGF0aW9uWzFdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlciwgaW50ZXJwb2xhdGlvbkNvbmZpZyAhLCB0aGlzLl9zY2hlbWFSZWdpc3RyeSwgdW5pcVBpcGVzLCBlcnJvcnMpO1xuICAgICAgY29uc3QgcGFyc2VWaXNpdG9yID0gbmV3IFRlbXBsYXRlUGFyc2VWaXNpdG9yKFxuICAgICAgICAgIHRoaXMuX3JlZmxlY3RvciwgdGhpcy5fY29uZmlnLCBwcm92aWRlclZpZXdDb250ZXh0LCB1bmlxRGlyZWN0aXZlcywgYmluZGluZ1BhcnNlcixcbiAgICAgICAgICB0aGlzLl9zY2hlbWFSZWdpc3RyeSwgc2NoZW1hcywgZXJyb3JzKTtcbiAgICAgIHJlc3VsdCA9IGh0bWwudmlzaXRBbGwocGFyc2VWaXNpdG9yLCBodG1sQXN0V2l0aEVycm9ycy5yb290Tm9kZXMsIEVNUFRZX0VMRU1FTlRfQ09OVEVYVCk7XG4gICAgICBlcnJvcnMucHVzaCguLi5wcm92aWRlclZpZXdDb250ZXh0LmVycm9ycyk7XG4gICAgICB1c2VkUGlwZXMucHVzaCguLi5iaW5kaW5nUGFyc2VyLmdldFVzZWRQaXBlcygpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gW107XG4gICAgfVxuICAgIHRoaXMuX2Fzc2VydE5vUmVmZXJlbmNlRHVwbGljYXRpb25PblRlbXBsYXRlKHJlc3VsdCwgZXJyb3JzKTtcblxuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIG5ldyBUZW1wbGF0ZVBhcnNlUmVzdWx0KHJlc3VsdCwgdXNlZFBpcGVzLCBlcnJvcnMpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnRyYW5zZm9ybXMpIHtcbiAgICAgIHRoaXMudHJhbnNmb3Jtcy5mb3JFYWNoKFxuICAgICAgICAgICh0cmFuc2Zvcm06IHQuVGVtcGxhdGVBc3RWaXNpdG9yKSA9PiB7IHJlc3VsdCA9IHQudGVtcGxhdGVWaXNpdEFsbCh0cmFuc2Zvcm0sIHJlc3VsdCk7IH0pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVGVtcGxhdGVQYXJzZVJlc3VsdChyZXN1bHQsIHVzZWRQaXBlcywgZXJyb3JzKTtcbiAgfVxuXG4gIGV4cGFuZEh0bWwoaHRtbEFzdFdpdGhFcnJvcnM6IFBhcnNlVHJlZVJlc3VsdCwgZm9yY2VkOiBib29sZWFuID0gZmFsc2UpOiBQYXJzZVRyZWVSZXN1bHQge1xuICAgIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gaHRtbEFzdFdpdGhFcnJvcnMuZXJyb3JzO1xuXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPT0gMCB8fCBmb3JjZWQpIHtcbiAgICAgIC8vIFRyYW5zZm9ybSBJQ1UgbWVzc2FnZXMgdG8gYW5ndWxhciBkaXJlY3RpdmVzXG4gICAgICBjb25zdCBleHBhbmRlZEh0bWxBc3QgPSBleHBhbmROb2RlcyhodG1sQXN0V2l0aEVycm9ycy5yb290Tm9kZXMpO1xuICAgICAgZXJyb3JzLnB1c2goLi4uZXhwYW5kZWRIdG1sQXN0LmVycm9ycyk7XG4gICAgICBodG1sQXN0V2l0aEVycm9ycyA9IG5ldyBQYXJzZVRyZWVSZXN1bHQoZXhwYW5kZWRIdG1sQXN0Lm5vZGVzLCBlcnJvcnMpO1xuICAgIH1cbiAgICByZXR1cm4gaHRtbEFzdFdpdGhFcnJvcnM7XG4gIH1cblxuICBnZXRJbnRlcnBvbGF0aW9uQ29uZmlnKGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKTogSW50ZXJwb2xhdGlvbkNvbmZpZ3x1bmRlZmluZWQge1xuICAgIGlmIChjb21wb25lbnQudGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBJbnRlcnBvbGF0aW9uQ29uZmlnLmZyb21BcnJheShjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvbik7XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9hc3NlcnROb1JlZmVyZW5jZUR1cGxpY2F0aW9uT25UZW1wbGF0ZShyZXN1bHQ6IHQuVGVtcGxhdGVBc3RbXSwgZXJyb3JzOiBUZW1wbGF0ZVBhcnNlRXJyb3JbXSk6XG4gICAgICB2b2lkIHtcbiAgICBjb25zdCBleGlzdGluZ1JlZmVyZW5jZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICByZXN1bHQuZmlsdGVyKGVsZW1lbnQgPT4gISEoPGFueT5lbGVtZW50KS5yZWZlcmVuY2VzKVxuICAgICAgICAuZm9yRWFjaChlbGVtZW50ID0+ICg8YW55PmVsZW1lbnQpLnJlZmVyZW5jZXMuZm9yRWFjaCgocmVmZXJlbmNlOiB0LlJlZmVyZW5jZUFzdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSByZWZlcmVuY2UubmFtZTtcbiAgICAgICAgICBpZiAoZXhpc3RpbmdSZWZlcmVuY2VzLmluZGV4T2YobmFtZSkgPCAwKSB7XG4gICAgICAgICAgICBleGlzdGluZ1JlZmVyZW5jZXMucHVzaChuYW1lKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVGVtcGxhdGVQYXJzZUVycm9yKFxuICAgICAgICAgICAgICAgIGBSZWZlcmVuY2UgXCIjJHtuYW1lfVwiIGlzIGRlZmluZWQgc2V2ZXJhbCB0aW1lc2AsIHJlZmVyZW5jZS5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgIFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9KSk7XG4gIH1cbn1cblxuY2xhc3MgVGVtcGxhdGVQYXJzZVZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICBzZWxlY3Rvck1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gIGRpcmVjdGl2ZXNJbmRleCA9IG5ldyBNYXA8Q29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIG51bWJlcj4oKTtcbiAgbmdDb250ZW50Q291bnQgPSAwO1xuICBjb250ZW50UXVlcnlTdGFydElkOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgcHJpdmF0ZSBjb25maWc6IENvbXBpbGVyQ29uZmlnLFxuICAgICAgcHVibGljIHByb3ZpZGVyVmlld0NvbnRleHQ6IFByb3ZpZGVyVmlld0NvbnRleHQsIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sXG4gICAgICBwcml2YXRlIF9iaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBwcml2YXRlIF9zY2hlbWFSZWdpc3RyeTogRWxlbWVudFNjaGVtYVJlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBfc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSwgcHJpdmF0ZSBfdGFyZ2V0RXJyb3JzOiBUZW1wbGF0ZVBhcnNlRXJyb3JbXSkge1xuICAgIC8vIE5vdGU6IHF1ZXJpZXMgc3RhcnQgd2l0aCBpZCAxIHNvIHdlIGNhbiB1c2UgdGhlIG51bWJlciBpbiBhIEJsb29tIGZpbHRlciFcbiAgICB0aGlzLmNvbnRlbnRRdWVyeVN0YXJ0SWQgPSBwcm92aWRlclZpZXdDb250ZXh0LmNvbXBvbmVudC52aWV3UXVlcmllcy5sZW5ndGggKyAxO1xuICAgIGRpcmVjdGl2ZXMuZm9yRWFjaCgoZGlyZWN0aXZlLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBDc3NTZWxlY3Rvci5wYXJzZShkaXJlY3RpdmUuc2VsZWN0b3IgISk7XG4gICAgICB0aGlzLnNlbGVjdG9yTWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhzZWxlY3RvciwgZGlyZWN0aXZlKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlc0luZGV4LnNldChkaXJlY3RpdmUsIGluZGV4KTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uKGV4cGFuc2lvbjogaHRtbC5FeHBhbnNpb24sIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIG51bGw7IH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBwYXJlbnQ6IEVsZW1lbnRDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRleCA9IHBhcmVudC5maW5kTmdDb250ZW50SW5kZXgoVEVYVF9DU1NfU0VMRUNUT1IpICE7XG4gICAgY29uc3QgdmFsdWVOb05nc3AgPSByZXBsYWNlTmdzcCh0ZXh0LnZhbHVlKTtcbiAgICBjb25zdCBleHByID0gdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUludGVycG9sYXRpb24odmFsdWVOb05nc3AsIHRleHQuc291cmNlU3BhbiAhKTtcbiAgICByZXR1cm4gZXhwciA/IG5ldyB0LkJvdW5kVGV4dEFzdChleHByLCBuZ0NvbnRlbnRJbmRleCwgdGV4dC5zb3VyY2VTcGFuICEpIDpcbiAgICAgICAgICAgICAgICAgIG5ldyB0LlRleHRBc3QodmFsdWVOb05nc3AsIG5nQ29udGVudEluZGV4LCB0ZXh0LnNvdXJjZVNwYW4gISk7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBuZXcgdC5BdHRyQXN0KGF0dHJpYnV0ZS5uYW1lLCBhdHRyaWJ1dGUudmFsdWUsIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0Q29tbWVudChjb21tZW50OiBodG1sLkNvbW1lbnQsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiBudWxsOyB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcXVlcnlTdGFydEluZGV4ID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgIGNvbnN0IGVsTmFtZSA9IGVsZW1lbnQubmFtZTtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQgJiZcbiAgICAgICAgaXNTdHlsZVVybFJlc29sdmFibGUocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cikpIHtcbiAgICAgIC8vIFNraXBwaW5nIHN0eWxlc2hlZXRzIHdpdGggZWl0aGVyIHJlbGF0aXZlIHVybHMgb3IgcGFja2FnZSBzY2hlbWUgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgIC8vIHRoZW0gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCBlbGVtZW50T3JEaXJlY3RpdmVQcm9wczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGVsZW1lbnRPckRpcmVjdGl2ZVJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdID0gW107XG4gICAgY29uc3QgZWxlbWVudFZhcnM6IHQuVmFyaWFibGVBc3RbXSA9IFtdO1xuICAgIGNvbnN0IGV2ZW50czogdC5Cb3VuZEV2ZW50QXN0W10gPSBbXTtcblxuICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudE9yRGlyZWN0aXZlUHJvcHM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZU1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZUVsZW1lbnRWYXJzOiB0LlZhcmlhYmxlQXN0W10gPSBbXTtcblxuICAgIGxldCBoYXNJbmxpbmVUZW1wbGF0ZXMgPSBmYWxzZTtcbiAgICBjb25zdCBhdHRyczogdC5BdHRyQXN0W10gPSBbXTtcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgZWxlbWVudC5hdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgY29uc3QgcGFyc2VkVmFyaWFibGVzOiBQYXJzZWRWYXJpYWJsZVtdID0gW107XG4gICAgICBjb25zdCBoYXNCaW5kaW5nID0gdGhpcy5fcGFyc2VBdHRyKFxuICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBhdHRyLCBtYXRjaGFibGVBdHRycywgZWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsIGV2ZW50cyxcbiAgICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50VmFycyk7XG4gICAgICBlbGVtZW50VmFycy5wdXNoKC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAodiA9PiB0LlZhcmlhYmxlQXN0LmZyb21QYXJzZWRWYXJpYWJsZSh2KSkpO1xuXG4gICAgICBsZXQgdGVtcGxhdGVWYWx1ZTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGxldCB0ZW1wbGF0ZUtleTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gdGhpcy5fbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyLm5hbWUpO1xuXG4gICAgICBpZiAobm9ybWFsaXplZE5hbWUuc3RhcnRzV2l0aChURU1QTEFURV9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgdGVtcGxhdGVWYWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICAgIHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhhc1RlbXBsYXRlQmluZGluZyA9IHRlbXBsYXRlVmFsdWUgIT0gbnVsbDtcbiAgICAgIGlmIChoYXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgaWYgKGhhc0lubGluZVRlbXBsYXRlcykge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgQ2FuJ3QgaGF2ZSBtdWx0aXBsZSB0ZW1wbGF0ZSBiaW5kaW5ncyBvbiBvbmUgZWxlbWVudC4gVXNlIG9ubHkgb25lIGF0dHJpYnV0ZSBwcmVmaXhlZCB3aXRoICpgLFxuICAgICAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICAgIGhhc0lubGluZVRlbXBsYXRlcyA9IHRydWU7XG4gICAgICAgIGNvbnN0IHBhcnNlZFZhcmlhYmxlczogUGFyc2VkVmFyaWFibGVbXSA9IFtdO1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlSW5saW5lVGVtcGxhdGVCaW5kaW5nKFxuICAgICAgICAgICAgdGVtcGxhdGVLZXkgISwgdGVtcGxhdGVWYWx1ZSAhLCBhdHRyLnNvdXJjZVNwYW4sIHRlbXBsYXRlTWF0Y2hhYmxlQXR0cnMsXG4gICAgICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCBwYXJzZWRWYXJpYWJsZXMpO1xuICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRWYXJzLnB1c2goLi4ucGFyc2VkVmFyaWFibGVzLm1hcCh2ID0+IHQuVmFyaWFibGVBc3QuZnJvbVBhcnNlZFZhcmlhYmxlKHYpKSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaGFzVGVtcGxhdGVCaW5kaW5nKSB7XG4gICAgICAgIC8vIGRvbid0IGluY2x1ZGUgdGhlIGJpbmRpbmdzIGFzIGF0dHJpYnV0ZXMgYXMgd2VsbCBpbiB0aGUgQVNUXG4gICAgICAgIGF0dHJzLnB1c2godGhpcy52aXNpdEF0dHJpYnV0ZShhdHRyLCBudWxsKSk7XG4gICAgICAgIG1hdGNoYWJsZUF0dHJzLnB1c2goW2F0dHIubmFtZSwgYXR0ci52YWx1ZV0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgZWxlbWVudENzc1NlbGVjdG9yID0gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKGVsTmFtZSwgbWF0Y2hhYmxlQXR0cnMpO1xuICAgIGNvbnN0IHtkaXJlY3RpdmVzOiBkaXJlY3RpdmVNZXRhcywgbWF0Y2hFbGVtZW50fSA9XG4gICAgICAgIHRoaXMuX3BhcnNlRGlyZWN0aXZlcyh0aGlzLnNlbGVjdG9yTWF0Y2hlciwgZWxlbWVudENzc1NlbGVjdG9yKTtcbiAgICBjb25zdCByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZUFzdFtdID0gW107XG4gICAgY29uc3QgYm91bmREaXJlY3RpdmVQcm9wTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkaXJlY3RpdmVBc3RzID0gdGhpcy5fY3JlYXRlRGlyZWN0aXZlQXN0cyhcbiAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQsIGVsZW1lbnQubmFtZSwgZGlyZWN0aXZlTWV0YXMsIGVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLFxuICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50LnNvdXJjZVNwYW4gISwgcmVmZXJlbmNlcywgYm91bmREaXJlY3RpdmVQcm9wTmFtZXMpO1xuICAgIGNvbnN0IGVsZW1lbnRQcm9wczogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdID0gdGhpcy5fY3JlYXRlRWxlbWVudFByb3BlcnR5QXN0cyhcbiAgICAgICAgZWxlbWVudC5uYW1lLCBlbGVtZW50T3JEaXJlY3RpdmVQcm9wcywgYm91bmREaXJlY3RpdmVQcm9wTmFtZXMpO1xuICAgIGNvbnN0IGlzVmlld1Jvb3QgPSBwYXJlbnQuaXNUZW1wbGF0ZUVsZW1lbnQgfHwgaGFzSW5saW5lVGVtcGxhdGVzO1xuXG4gICAgY29uc3QgcHJvdmlkZXJDb250ZXh0ID0gbmV3IFByb3ZpZGVyRWxlbWVudENvbnRleHQoXG4gICAgICAgIHRoaXMucHJvdmlkZXJWaWV3Q29udGV4dCwgcGFyZW50LnByb3ZpZGVyQ29udGV4dCAhLCBpc1ZpZXdSb290LCBkaXJlY3RpdmVBc3RzLCBhdHRycyxcbiAgICAgICAgcmVmZXJlbmNlcywgaXNUZW1wbGF0ZUVsZW1lbnQsIHF1ZXJ5U3RhcnRJbmRleCwgZWxlbWVudC5zb3VyY2VTcGFuICEpO1xuXG4gICAgY29uc3QgY2hpbGRyZW46IHQuVGVtcGxhdGVBc3RbXSA9IGh0bWwudmlzaXRBbGwoXG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQubm9uQmluZGFibGUgPyBOT05fQklOREFCTEVfVklTSVRPUiA6IHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4sXG4gICAgICAgIEVsZW1lbnRDb250ZXh0LmNyZWF0ZShcbiAgICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBkaXJlY3RpdmVBc3RzLFxuICAgICAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQgPyBwYXJlbnQucHJvdmlkZXJDb250ZXh0ICEgOiBwcm92aWRlckNvbnRleHQpKTtcbiAgICBwcm92aWRlckNvbnRleHQuYWZ0ZXJFbGVtZW50KCk7XG4gICAgLy8gT3ZlcnJpZGUgdGhlIGFjdHVhbCBzZWxlY3RvciB3aGVuIHRoZSBgbmdQcm9qZWN0QXNgIGF0dHJpYnV0ZSBpcyBwcm92aWRlZFxuICAgIGNvbnN0IHByb2plY3Rpb25TZWxlY3RvciA9IHByZXBhcnNlZEVsZW1lbnQucHJvamVjdEFzICE9ICcnID9cbiAgICAgICAgQ3NzU2VsZWN0b3IucGFyc2UocHJlcGFyc2VkRWxlbWVudC5wcm9qZWN0QXMpWzBdIDpcbiAgICAgICAgZWxlbWVudENzc1NlbGVjdG9yO1xuICAgIGNvbnN0IG5nQ29udGVudEluZGV4ID0gcGFyZW50LmZpbmROZ0NvbnRlbnRJbmRleChwcm9qZWN0aW9uU2VsZWN0b3IpICE7XG4gICAgbGV0IHBhcnNlZEVsZW1lbnQ6IHQuVGVtcGxhdGVBc3Q7XG5cbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UKSB7XG4gICAgICAvLyBgPG5nLWNvbnRlbnQ+YCBlbGVtZW50XG4gICAgICBpZiAoZWxlbWVudC5jaGlsZHJlbiAmJiAhZWxlbWVudC5jaGlsZHJlbi5ldmVyeShfaXNFbXB0eVRleHROb2RlKSkge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihgPG5nLWNvbnRlbnQ+IGVsZW1lbnQgY2Fubm90IGhhdmUgY29udGVudC5gLCBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG4gICAgICB9XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5OZ0NvbnRlbnRBc3QoXG4gICAgICAgICAgdGhpcy5uZ0NvbnRlbnRDb3VudCsrLCBoYXNJbmxpbmVUZW1wbGF0ZXMgPyBudWxsICEgOiBuZ0NvbnRlbnRJbmRleCxcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG4gICAgfSBlbHNlIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgLy8gYDxuZy10ZW1wbGF0ZT5gIGVsZW1lbnRcbiAgICAgIHRoaXMuX2Fzc2VydEFsbEV2ZW50c1B1Ymxpc2hlZEJ5RGlyZWN0aXZlcyhkaXJlY3RpdmVBc3RzLCBldmVudHMpO1xuICAgICAgdGhpcy5fYXNzZXJ0Tm9Db21wb25lbnRzTm9yRWxlbWVudEJpbmRpbmdzT25UZW1wbGF0ZShcbiAgICAgICAgICBkaXJlY3RpdmVBc3RzLCBlbGVtZW50UHJvcHMsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcblxuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LkVtYmVkZGVkVGVtcGxhdGVBc3QoXG4gICAgICAgICAgYXR0cnMsIGV2ZW50cywgcmVmZXJlbmNlcywgZWxlbWVudFZhcnMsIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZERpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybVByb3ZpZGVycywgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lcixcbiAgICAgICAgICBwcm92aWRlckNvbnRleHQucXVlcnlNYXRjaGVzLCBjaGlsZHJlbiwgaGFzSW5saW5lVGVtcGxhdGVzID8gbnVsbCAhIDogbmdDb250ZW50SW5kZXgsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuICEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBlbGVtZW50IG90aGVyIHRoYW4gYDxuZy1jb250ZW50PmAgYW5kIGA8bmctdGVtcGxhdGU+YFxuICAgICAgdGhpcy5fYXNzZXJ0RWxlbWVudEV4aXN0cyhtYXRjaEVsZW1lbnQsIGVsZW1lbnQpO1xuICAgICAgdGhpcy5fYXNzZXJ0T25seU9uZUNvbXBvbmVudChkaXJlY3RpdmVBc3RzLCBlbGVtZW50LnNvdXJjZVNwYW4gISk7XG5cbiAgICAgIGNvbnN0IG5nQ29udGVudEluZGV4ID1cbiAgICAgICAgICBoYXNJbmxpbmVUZW1wbGF0ZXMgPyBudWxsIDogcGFyZW50LmZpbmROZ0NvbnRlbnRJbmRleChwcm9qZWN0aW9uU2VsZWN0b3IpO1xuICAgICAgcGFyc2VkRWxlbWVudCA9IG5ldyB0LkVsZW1lbnRBc3QoXG4gICAgICAgICAgZWxOYW1lLCBhdHRycywgZWxlbWVudFByb3BzLCBldmVudHMsIHJlZmVyZW5jZXMsIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZERpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybVByb3ZpZGVycywgcHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lcixcbiAgICAgICAgICBwcm92aWRlckNvbnRleHQucXVlcnlNYXRjaGVzLCBjaGlsZHJlbiwgaGFzSW5saW5lVGVtcGxhdGVzID8gbnVsbCA6IG5nQ29udGVudEluZGV4LFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IG51bGwpO1xuICAgIH1cblxuICAgIGlmIChoYXNJbmxpbmVUZW1wbGF0ZXMpIHtcbiAgICAgIC8vIFRoZSBlbGVtZW50IGFzIGEgKi1hdHRyaWJ1dGVcbiAgICAgIGNvbnN0IHRlbXBsYXRlUXVlcnlTdGFydEluZGV4ID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgICAgY29uc3QgdGVtcGxhdGVTZWxlY3RvciA9IGNyZWF0ZUVsZW1lbnRDc3NTZWxlY3RvcignbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZU1hdGNoYWJsZUF0dHJzKTtcbiAgICAgIGNvbnN0IHtkaXJlY3RpdmVzfSA9IHRoaXMuX3BhcnNlRGlyZWN0aXZlcyh0aGlzLnNlbGVjdG9yTWF0Y2hlciwgdGVtcGxhdGVTZWxlY3Rvcik7XG4gICAgICBjb25zdCB0ZW1wbGF0ZUJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBjb25zdCB0ZW1wbGF0ZURpcmVjdGl2ZUFzdHMgPSB0aGlzLl9jcmVhdGVEaXJlY3RpdmVBc3RzKFxuICAgICAgICAgIHRydWUsIGVsTmFtZSwgZGlyZWN0aXZlcywgdGVtcGxhdGVFbGVtZW50T3JEaXJlY3RpdmVQcm9wcywgW10sIGVsZW1lbnQuc291cmNlU3BhbiAhLCBbXSxcbiAgICAgICAgICB0ZW1wbGF0ZUJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10gPSB0aGlzLl9jcmVhdGVFbGVtZW50UHJvcGVydHlBc3RzKFxuICAgICAgICAgIGVsTmFtZSwgdGVtcGxhdGVFbGVtZW50T3JEaXJlY3RpdmVQcm9wcywgdGVtcGxhdGVCb3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgICB0aGlzLl9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgICAgIHRlbXBsYXRlRGlyZWN0aXZlQXN0cywgdGVtcGxhdGVFbGVtZW50UHJvcHMsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0ID0gbmV3IFByb3ZpZGVyRWxlbWVudENvbnRleHQoXG4gICAgICAgICAgdGhpcy5wcm92aWRlclZpZXdDb250ZXh0LCBwYXJlbnQucHJvdmlkZXJDb250ZXh0ICEsIHBhcmVudC5pc1RlbXBsYXRlRWxlbWVudCxcbiAgICAgICAgICB0ZW1wbGF0ZURpcmVjdGl2ZUFzdHMsIFtdLCBbXSwgdHJ1ZSwgdGVtcGxhdGVRdWVyeVN0YXJ0SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICAgIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LmFmdGVyRWxlbWVudCgpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRW1iZWRkZWRUZW1wbGF0ZUFzdChcbiAgICAgICAgICBbXSwgW10sIFtdLCB0ZW1wbGF0ZUVsZW1lbnRWYXJzLCB0ZW1wbGF0ZVByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZERpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgdGVtcGxhdGVQcm92aWRlckNvbnRleHQudHJhbnNmb3JtUHJvdmlkZXJzLFxuICAgICAgICAgIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lciwgdGVtcGxhdGVQcm92aWRlckNvbnRleHQucXVlcnlNYXRjaGVzLFxuICAgICAgICAgIFtwYXJzZWRFbGVtZW50XSwgbmdDb250ZW50SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyc2VkRWxlbWVudDtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlQXR0cihcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBhdHRyOiBodG1sLkF0dHJpYnV0ZSwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sXG4gICAgICB0YXJnZXRQcm9wczogUGFyc2VkUHJvcGVydHlbXSwgdGFyZ2V0RXZlbnRzOiB0LkJvdW5kRXZlbnRBc3RbXSxcbiAgICAgIHRhcmdldFJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdLCB0YXJnZXRWYXJzOiB0LlZhcmlhYmxlQXN0W10pOiBib29sZWFuIHtcbiAgICBjb25zdCBuYW1lID0gdGhpcy5fbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyLm5hbWUpO1xuICAgIGNvbnN0IHZhbHVlID0gYXR0ci52YWx1ZTtcbiAgICBjb25zdCBzcmNTcGFuID0gYXR0ci5zb3VyY2VTcGFuO1xuXG4gICAgY29uc3QgYm91bmRFdmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICBjb25zdCBiaW5kUGFydHMgPSBuYW1lLm1hdGNoKEJJTkRfTkFNRV9SRUdFWFApO1xuICAgIGxldCBoYXNCaW5kaW5nID0gZmFsc2U7XG5cbiAgICBpZiAoYmluZFBhcnRzICE9PSBudWxsKSB7XG4gICAgICBoYXNCaW5kaW5nID0gdHJ1ZTtcbiAgICAgIGlmIChiaW5kUGFydHNbS1dfQklORF9JRFhdICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0xFVF9JRFhdKSB7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgICB0aGlzLl9wYXJzZVZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCB0YXJnZXRWYXJzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCJsZXQtXCIgaXMgb25seSBzdXBwb3J0ZWQgb24gbmctdGVtcGxhdGUgZWxlbWVudHMuYCwgc3JjU3Bhbik7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfUkVGX0lEWF0pIHtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICB0aGlzLl9wYXJzZVJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0UmVmcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX09OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgYm91bmRFdmVudHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19CSU5ET05fSURYXSkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICAgICAgdGhpcy5fcGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfS1dfSURYXSwgdmFsdWUsIHNyY1NwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCBib3VuZEV2ZW50cyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0FUX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUxpdGVyYWxBdHRyKFxuICAgICAgICAgICAgbmFtZSwgdmFsdWUsIHNyY1NwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICAgIHRhcmdldFByb3BzKTtcbiAgICAgICAgdGhpcy5fcGFyc2VBc3NpZ25tZW50RXZlbnQoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX1BST1BFUlRZX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsXG4gICAgICAgICAgICB0YXJnZXRQcm9wcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX0VWRU5UX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0VWRU5UX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgYm91bmRFdmVudHMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBoYXNCaW5kaW5nID0gdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5SW50ZXJwb2xhdGlvbihcbiAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9XG5cbiAgICBpZiAoIWhhc0JpbmRpbmcpIHtcbiAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VMaXRlcmFsQXR0cihuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9XG5cbiAgICB0YXJnZXRFdmVudHMucHVzaCguLi5ib3VuZEV2ZW50cy5tYXAoZSA9PiB0LkJvdW5kRXZlbnRBc3QuZnJvbVBhcnNlZEV2ZW50KGUpKSk7XG5cbiAgICByZXR1cm4gaGFzQmluZGluZztcbiAgfVxuXG4gIHByaXZhdGUgX25vcm1hbGl6ZUF0dHJpYnV0ZU5hbWUoYXR0ck5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIC9eZGF0YS0vaS50ZXN0KGF0dHJOYW1lKSA/IGF0dHJOYW1lLnN1YnN0cmluZyg1KSA6IGF0dHJOYW1lO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VWYXJpYWJsZShcbiAgICAgIGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB0YXJnZXRWYXJzOiB0LlZhcmlhYmxlQXN0W10pIHtcbiAgICBpZiAoaWRlbnRpZmllci5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYFwiLVwiIGlzIG5vdCBhbGxvd2VkIGluIHZhcmlhYmxlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgdGFyZ2V0VmFycy5wdXNoKG5ldyB0LlZhcmlhYmxlQXN0KGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVJlZmVyZW5jZShcbiAgICAgIGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdGFyZ2V0UmVmczogRWxlbWVudE9yRGlyZWN0aXZlUmVmW10pIHtcbiAgICBpZiAoaWRlbnRpZmllci5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYFwiLVwiIGlzIG5vdCBhbGxvd2VkIGluIHJlZmVyZW5jZSBuYW1lc2AsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHRhcmdldFJlZnMucHVzaChuZXcgRWxlbWVudE9yRGlyZWN0aXZlUmVmKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSwgdGFyZ2V0RXZlbnRzOiBQYXJzZWRFdmVudFtdKSB7XG4gICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICBgJHtuYW1lfUNoYW5nZWAsIGAke2V4cHJlc3Npb259PSRldmVudGAsIHNvdXJjZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRFdmVudHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VEaXJlY3RpdmVzKHNlbGVjdG9yTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyLCBlbGVtZW50Q3NzU2VsZWN0b3I6IENzc1NlbGVjdG9yKTpcbiAgICAgIHtkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBtYXRjaEVsZW1lbnQ6IGJvb2xlYW59IHtcbiAgICAvLyBOZWVkIHRvIHNvcnQgdGhlIGRpcmVjdGl2ZXMgc28gdGhhdCB3ZSBnZXQgY29uc2lzdGVudCByZXN1bHRzIHRocm91Z2hvdXQsXG4gICAgLy8gYXMgc2VsZWN0b3JNYXRjaGVyIHVzZXMgTWFwcyBpbnNpZGUuXG4gICAgLy8gQWxzbyBkZWR1cGxpY2F0ZSBkaXJlY3RpdmVzIGFzIHRoZXkgbWlnaHQgbWF0Y2ggbW9yZSB0aGFuIG9uZSB0aW1lIVxuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXcgQXJyYXkodGhpcy5kaXJlY3RpdmVzSW5kZXguc2l6ZSk7XG4gICAgLy8gV2hldGhlciBhbnkgZGlyZWN0aXZlIHNlbGVjdG9yIG1hdGNoZXMgb24gdGhlIGVsZW1lbnQgbmFtZVxuICAgIGxldCBtYXRjaEVsZW1lbnQgPSBmYWxzZTtcblxuICAgIHNlbGVjdG9yTWF0Y2hlci5tYXRjaChlbGVtZW50Q3NzU2VsZWN0b3IsIChzZWxlY3RvciwgZGlyZWN0aXZlKSA9PiB7XG4gICAgICBkaXJlY3RpdmVzW3RoaXMuZGlyZWN0aXZlc0luZGV4LmdldChkaXJlY3RpdmUpICFdID0gZGlyZWN0aXZlO1xuICAgICAgbWF0Y2hFbGVtZW50ID0gbWF0Y2hFbGVtZW50IHx8IHNlbGVjdG9yLmhhc0VsZW1lbnRTZWxlY3RvcigpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGRpcmVjdGl2ZXM6IGRpcmVjdGl2ZXMuZmlsdGVyKGRpciA9PiAhIWRpciksXG4gICAgICBtYXRjaEVsZW1lbnQsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZURpcmVjdGl2ZUFzdHMoXG4gICAgICBpc1RlbXBsYXRlRWxlbWVudDogYm9vbGVhbiwgZWxlbWVudE5hbWU6IHN0cmluZywgZGlyZWN0aXZlczogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnlbXSxcbiAgICAgIHByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCBlbGVtZW50T3JEaXJlY3RpdmVSZWZzOiBFbGVtZW50T3JEaXJlY3RpdmVSZWZbXSxcbiAgICAgIGVsZW1lbnRTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHRhcmdldFJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlQXN0W10sXG4gICAgICB0YXJnZXRCb3VuZERpcmVjdGl2ZVByb3BOYW1lczogU2V0PHN0cmluZz4pOiB0LkRpcmVjdGl2ZUFzdFtdIHtcbiAgICBjb25zdCBtYXRjaGVkUmVmZXJlbmNlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGxldCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5ID0gbnVsbCAhO1xuXG4gICAgY29uc3QgZGlyZWN0aXZlQXN0cyA9IGRpcmVjdGl2ZXMubWFwKChkaXJlY3RpdmUpID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICAgIGVsZW1lbnRTb3VyY2VTcGFuLnN0YXJ0LCBlbGVtZW50U291cmNlU3Bhbi5lbmQsXG4gICAgICAgICAgYERpcmVjdGl2ZSAke2lkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS50eXBlKX1gKTtcblxuICAgICAgaWYgKGRpcmVjdGl2ZS5pc0NvbXBvbmVudCkge1xuICAgICAgICBjb21wb25lbnQgPSBkaXJlY3RpdmU7XG4gICAgICB9XG4gICAgICBjb25zdCBkaXJlY3RpdmVQcm9wZXJ0aWVzOiB0LkJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3RbXSA9IFtdO1xuICAgICAgY29uc3QgYm91bmRQcm9wZXJ0aWVzID1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RQcm9wZXJ0eUFzdHMoZGlyZWN0aXZlLCBlbGVtZW50TmFtZSwgc291cmNlU3BhbikgITtcblxuICAgICAgbGV0IGhvc3RQcm9wZXJ0aWVzID1cbiAgICAgICAgICBib3VuZFByb3BlcnRpZXMubWFwKHByb3AgPT4gdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdC5mcm9tQm91bmRQcm9wZXJ0eShwcm9wKSk7XG4gICAgICAvLyBOb3RlOiBXZSBuZWVkIHRvIGNoZWNrIHRoZSBob3N0IHByb3BlcnRpZXMgaGVyZSBhcyB3ZWxsLFxuICAgICAgLy8gYXMgd2UgZG9uJ3Qga25vdyB0aGUgZWxlbWVudCBuYW1lIGluIHRoZSBEaXJlY3RpdmVXcmFwcGVyQ29tcGlsZXIgeWV0LlxuICAgICAgaG9zdFByb3BlcnRpZXMgPSB0aGlzLl9jaGVja1Byb3BlcnRpZXNJblNjaGVtYShlbGVtZW50TmFtZSwgaG9zdFByb3BlcnRpZXMpO1xuICAgICAgY29uc3QgcGFyc2VkRXZlbnRzID1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyZWN0aXZlLCBzb3VyY2VTcGFuKSAhO1xuICAgICAgdGhpcy5fY3JlYXRlRGlyZWN0aXZlUHJvcGVydHlBc3RzKFxuICAgICAgICAgIGRpcmVjdGl2ZS5pbnB1dHMsIHByb3BzLCBkaXJlY3RpdmVQcm9wZXJ0aWVzLCB0YXJnZXRCb3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLmZvckVhY2goKGVsT3JEaXJSZWYpID0+IHtcbiAgICAgICAgaWYgKChlbE9yRGlyUmVmLnZhbHVlLmxlbmd0aCA9PT0gMCAmJiBkaXJlY3RpdmUuaXNDb21wb25lbnQpIHx8XG4gICAgICAgICAgICAoZWxPckRpclJlZi5pc1JlZmVyZW5jZVRvRGlyZWN0aXZlKGRpcmVjdGl2ZSkpKSB7XG4gICAgICAgICAgdGFyZ2V0UmVmZXJlbmNlcy5wdXNoKG5ldyB0LlJlZmVyZW5jZUFzdChcbiAgICAgICAgICAgICAgZWxPckRpclJlZi5uYW1lLCBjcmVhdGVUb2tlbkZvclJlZmVyZW5jZShkaXJlY3RpdmUudHlwZS5yZWZlcmVuY2UpLCBlbE9yRGlyUmVmLnZhbHVlLFxuICAgICAgICAgICAgICBlbE9yRGlyUmVmLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICBtYXRjaGVkUmVmZXJlbmNlcy5hZGQoZWxPckRpclJlZi5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBjb25zdCBob3N0RXZlbnRzID0gcGFyc2VkRXZlbnRzLm1hcChlID0+IHQuQm91bmRFdmVudEFzdC5mcm9tUGFyc2VkRXZlbnQoZSkpO1xuICAgICAgY29uc3QgY29udGVudFF1ZXJ5U3RhcnRJZCA9IHRoaXMuY29udGVudFF1ZXJ5U3RhcnRJZDtcbiAgICAgIHRoaXMuY29udGVudFF1ZXJ5U3RhcnRJZCArPSBkaXJlY3RpdmUucXVlcmllcy5sZW5ndGg7XG4gICAgICByZXR1cm4gbmV3IHQuRGlyZWN0aXZlQXN0KFxuICAgICAgICAgIGRpcmVjdGl2ZSwgZGlyZWN0aXZlUHJvcGVydGllcywgaG9zdFByb3BlcnRpZXMsIGhvc3RFdmVudHMsIGNvbnRlbnRRdWVyeVN0YXJ0SWQsXG4gICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgfSk7XG5cbiAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLmZvckVhY2goKGVsT3JEaXJSZWYpID0+IHtcbiAgICAgIGlmIChlbE9yRGlyUmVmLnZhbHVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaWYgKCFtYXRjaGVkUmVmZXJlbmNlcy5oYXMoZWxPckRpclJlZi5uYW1lKSkge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgVGhlcmUgaXMgbm8gZGlyZWN0aXZlIHdpdGggXCJleHBvcnRBc1wiIHNldCB0byBcIiR7ZWxPckRpclJlZi52YWx1ZX1cImAsXG4gICAgICAgICAgICAgIGVsT3JEaXJSZWYuc291cmNlU3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWNvbXBvbmVudCkge1xuICAgICAgICBsZXQgcmVmVG9rZW46IENvbXBpbGVUb2tlbk1ldGFkYXRhID0gbnVsbCAhO1xuICAgICAgICBpZiAoaXNUZW1wbGF0ZUVsZW1lbnQpIHtcbiAgICAgICAgICByZWZUb2tlbiA9IGNyZWF0ZVRva2VuRm9yRXh0ZXJuYWxSZWZlcmVuY2UodGhpcy5yZWZsZWN0b3IsIElkZW50aWZpZXJzLlRlbXBsYXRlUmVmKTtcbiAgICAgICAgfVxuICAgICAgICB0YXJnZXRSZWZlcmVuY2VzLnB1c2goXG4gICAgICAgICAgICBuZXcgdC5SZWZlcmVuY2VBc3QoZWxPckRpclJlZi5uYW1lLCByZWZUb2tlbiwgZWxPckRpclJlZi52YWx1ZSwgZWxPckRpclJlZi5zb3VyY2VTcGFuKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRpcmVjdGl2ZUFzdHM7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVEaXJlY3RpdmVQcm9wZXJ0eUFzdHMoXG4gICAgICBkaXJlY3RpdmVQcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSwgYm91bmRQcm9wczogUGFyc2VkUHJvcGVydHlbXSxcbiAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcHM6IHQuQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdFtdLFxuICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXM6IFNldDxzdHJpbmc+KSB7XG4gICAgaWYgKGRpcmVjdGl2ZVByb3BlcnRpZXMpIHtcbiAgICAgIGNvbnN0IGJvdW5kUHJvcHNCeU5hbWUgPSBuZXcgTWFwPHN0cmluZywgUGFyc2VkUHJvcGVydHk+KCk7XG4gICAgICBib3VuZFByb3BzLmZvckVhY2goYm91bmRQcm9wID0+IHtcbiAgICAgICAgY29uc3QgcHJldlZhbHVlID0gYm91bmRQcm9wc0J5TmFtZS5nZXQoYm91bmRQcm9wLm5hbWUpO1xuICAgICAgICBpZiAoIXByZXZWYWx1ZSB8fCBwcmV2VmFsdWUuaXNMaXRlcmFsKSB7XG4gICAgICAgICAgLy8gZ2l2ZSBbYV09XCJiXCIgYSBoaWdoZXIgcHJlY2VkZW5jZSB0aGFuIGE9XCJiXCIgb24gdGhlIHNhbWUgZWxlbWVudFxuICAgICAgICAgIGJvdW5kUHJvcHNCeU5hbWUuc2V0KGJvdW5kUHJvcC5uYW1lLCBib3VuZFByb3ApO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgT2JqZWN0LmtleXMoZGlyZWN0aXZlUHJvcGVydGllcykuZm9yRWFjaChkaXJQcm9wID0+IHtcbiAgICAgICAgY29uc3QgZWxQcm9wID0gZGlyZWN0aXZlUHJvcGVydGllc1tkaXJQcm9wXTtcbiAgICAgICAgY29uc3QgYm91bmRQcm9wID0gYm91bmRQcm9wc0J5TmFtZS5nZXQoZWxQcm9wKTtcblxuICAgICAgICAvLyBCaW5kaW5ncyBhcmUgb3B0aW9uYWwsIHNvIHRoaXMgYmluZGluZyBvbmx5IG5lZWRzIHRvIGJlIHNldCB1cCBpZiBhbiBleHByZXNzaW9uIGlzIGdpdmVuLlxuICAgICAgICBpZiAoYm91bmRQcm9wKSB7XG4gICAgICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXMuYWRkKGJvdW5kUHJvcC5uYW1lKTtcbiAgICAgICAgICBpZiAoIWlzRW1wdHlFeHByZXNzaW9uKGJvdW5kUHJvcC5leHByZXNzaW9uKSkge1xuICAgICAgICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wcy5wdXNoKG5ldyB0LkJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QoXG4gICAgICAgICAgICAgICAgZGlyUHJvcCwgYm91bmRQcm9wLm5hbWUsIGJvdW5kUHJvcC5leHByZXNzaW9uLCBib3VuZFByb3Auc291cmNlU3BhbikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRWxlbWVudFByb3BlcnR5QXN0cyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLFxuICAgICAgYm91bmREaXJlY3RpdmVQcm9wTmFtZXM6IFNldDxzdHJpbmc+KTogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdIHtcbiAgICBjb25zdCBib3VuZEVsZW1lbnRQcm9wczogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdID0gW107XG5cbiAgICBwcm9wcy5mb3JFYWNoKChwcm9wOiBQYXJzZWRQcm9wZXJ0eSkgPT4ge1xuICAgICAgaWYgKCFwcm9wLmlzTGl0ZXJhbCAmJiAhYm91bmREaXJlY3RpdmVQcm9wTmFtZXMuaGFzKHByb3AubmFtZSkpIHtcbiAgICAgICAgY29uc3QgYm91bmRQcm9wID0gdGhpcy5fYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEVsZW1lbnRQcm9wZXJ0eShlbGVtZW50TmFtZSwgcHJvcCk7XG4gICAgICAgIGJvdW5kRWxlbWVudFByb3BzLnB1c2godC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdC5mcm9tQm91bmRQcm9wZXJ0eShib3VuZFByb3ApKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5fY2hlY2tQcm9wZXJ0aWVzSW5TY2hlbWEoZWxlbWVudE5hbWUsIGJvdW5kRWxlbWVudFByb3BzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRDb21wb25lbnREaXJlY3RpdmVzKGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10pOiB0LkRpcmVjdGl2ZUFzdFtdIHtcbiAgICByZXR1cm4gZGlyZWN0aXZlcy5maWx0ZXIoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS5kaXJlY3RpdmUuaXNDb21wb25lbnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmluZENvbXBvbmVudERpcmVjdGl2ZU5hbWVzKGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10pOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpbmRDb21wb25lbnREaXJlY3RpdmVzKGRpcmVjdGl2ZXMpXG4gICAgICAgIC5tYXAoZGlyZWN0aXZlID0+IGlkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS5kaXJlY3RpdmUudHlwZSkgISk7XG4gIH1cblxuICBwcml2YXRlIF9hc3NlcnRPbmx5T25lQ29tcG9uZW50KGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIGNvbnN0IGNvbXBvbmVudFR5cGVOYW1lcyA9IHRoaXMuX2ZpbmRDb21wb25lbnREaXJlY3RpdmVOYW1lcyhkaXJlY3RpdmVzKTtcbiAgICBpZiAoY29tcG9uZW50VHlwZU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBNb3JlIHRoYW4gb25lIGNvbXBvbmVudCBtYXRjaGVkIG9uIHRoaXMgZWxlbWVudC5cXG5gICtcbiAgICAgICAgICAgICAgYE1ha2Ugc3VyZSB0aGF0IG9ubHkgb25lIGNvbXBvbmVudCdzIHNlbGVjdG9yIGNhbiBtYXRjaCBhIGdpdmVuIGVsZW1lbnQuXFxuYCArXG4gICAgICAgICAgICAgIGBDb25mbGljdGluZyBjb21wb25lbnRzOiAke2NvbXBvbmVudFR5cGVOYW1lcy5qb2luKCcsJyl9YCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWFrZSBzdXJlIHRoYXQgbm9uLWFuZ3VsYXIgdGFncyBjb25mb3JtIHRvIHRoZSBzY2hlbWFzLlxuICAgKlxuICAgKiBOb3RlOiBBbiBlbGVtZW50IGlzIGNvbnNpZGVyZWQgYW4gYW5ndWxhciB0YWcgd2hlbiBhdCBsZWFzdCBvbmUgZGlyZWN0aXZlIHNlbGVjdG9yIG1hdGNoZXMgdGhlXG4gICAqIHRhZyBuYW1lLlxuICAgKlxuICAgKiBAcGFyYW0gbWF0Y2hFbGVtZW50IFdoZXRoZXIgYW55IGRpcmVjdGl2ZSBoYXMgbWF0Y2hlZCBvbiB0aGUgdGFnIG5hbWVcbiAgICogQHBhcmFtIGVsZW1lbnQgdGhlIGh0bWwgZWxlbWVudFxuICAgKi9cbiAgcHJpdmF0ZSBfYXNzZXJ0RWxlbWVudEV4aXN0cyhtYXRjaEVsZW1lbnQ6IGJvb2xlYW4sIGVsZW1lbnQ6IGh0bWwuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsTmFtZSA9IGVsZW1lbnQubmFtZS5yZXBsYWNlKC9eOnhodG1sOi8sICcnKTtcblxuICAgIGlmICghbWF0Y2hFbGVtZW50ICYmICF0aGlzLl9zY2hlbWFSZWdpc3RyeS5oYXNFbGVtZW50KGVsTmFtZSwgdGhpcy5fc2NoZW1hcykpIHtcbiAgICAgIGxldCBlcnJvck1zZyA9IGAnJHtlbE5hbWV9JyBpcyBub3QgYSBrbm93biBlbGVtZW50OlxcbmA7XG4gICAgICBlcnJvck1zZyArPVxuICAgICAgICAgIGAxLiBJZiAnJHtlbE5hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbXBvbmVudCwgdGhlbiB2ZXJpZnkgdGhhdCBpdCBpcyBwYXJ0IG9mIHRoaXMgbW9kdWxlLlxcbmA7XG4gICAgICBpZiAoZWxOYW1lLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgIGVycm9yTXNnICs9XG4gICAgICAgICAgICBgMi4gSWYgJyR7ZWxOYW1lfScgaXMgYSBXZWIgQ29tcG9uZW50IHRoZW4gYWRkICdDVVNUT01fRUxFTUVOVFNfU0NIRU1BJyB0byB0aGUgJ0BOZ01vZHVsZS5zY2hlbWFzJyBvZiB0aGlzIGNvbXBvbmVudCB0byBzdXBwcmVzcyB0aGlzIG1lc3NhZ2UuYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVycm9yTXNnICs9XG4gICAgICAgICAgICBgMi4gVG8gYWxsb3cgYW55IGVsZW1lbnQgYWRkICdOT19FUlJPUlNfU0NIRU1BJyB0byB0aGUgJ0BOZ01vZHVsZS5zY2hlbWFzJyBvZiB0aGlzIGNvbXBvbmVudC5gO1xuICAgICAgfVxuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoZXJyb3JNc2csIGVsZW1lbnQuc291cmNlU3BhbiAhKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgZGlyZWN0aXZlczogdC5EaXJlY3RpdmVBc3RbXSwgZWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10sXG4gICAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHtcbiAgICBjb25zdCBjb21wb25lbnRUeXBlTmFtZXM6IHN0cmluZ1tdID0gdGhpcy5fZmluZENvbXBvbmVudERpcmVjdGl2ZU5hbWVzKGRpcmVjdGl2ZXMpO1xuICAgIGlmIChjb21wb25lbnRUeXBlTmFtZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYENvbXBvbmVudHMgb24gYW4gZW1iZWRkZWQgdGVtcGxhdGU6ICR7Y29tcG9uZW50VHlwZU5hbWVzLmpvaW4oJywnKX1gLCBzb3VyY2VTcGFuKTtcbiAgICB9XG4gICAgZWxlbWVudFByb3BzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICBgUHJvcGVydHkgYmluZGluZyAke3Byb3AubmFtZX0gbm90IHVzZWQgYnkgYW55IGRpcmVjdGl2ZSBvbiBhbiBlbWJlZGRlZCB0ZW1wbGF0ZS4gTWFrZSBzdXJlIHRoYXQgdGhlIHByb3BlcnR5IG5hbWUgaXMgc3BlbGxlZCBjb3JyZWN0bHkgYW5kIGFsbCBkaXJlY3RpdmVzIGFyZSBsaXN0ZWQgaW4gdGhlIFwiQE5nTW9kdWxlLmRlY2xhcmF0aW9uc1wiLmAsXG4gICAgICAgICAgc291cmNlU3Bhbik7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9hc3NlcnRBbGxFdmVudHNQdWJsaXNoZWRCeURpcmVjdGl2ZXMoXG4gICAgICBkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdLCBldmVudHM6IHQuQm91bmRFdmVudEFzdFtdKSB7XG4gICAgY29uc3QgYWxsRGlyZWN0aXZlRXZlbnRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBkaXJlY3RpdmVzLmZvckVhY2goZGlyZWN0aXZlID0+IHtcbiAgICAgIE9iamVjdC5rZXlzKGRpcmVjdGl2ZS5kaXJlY3RpdmUub3V0cHV0cykuZm9yRWFjaChrID0+IHtcbiAgICAgICAgY29uc3QgZXZlbnROYW1lID0gZGlyZWN0aXZlLmRpcmVjdGl2ZS5vdXRwdXRzW2tdO1xuICAgICAgICBhbGxEaXJlY3RpdmVFdmVudHMuYWRkKGV2ZW50TmFtZSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGV2ZW50cy5mb3JFYWNoKGV2ZW50ID0+IHtcbiAgICAgIGlmIChldmVudC50YXJnZXQgIT0gbnVsbCB8fCAhYWxsRGlyZWN0aXZlRXZlbnRzLmhhcyhldmVudC5uYW1lKSkge1xuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihcbiAgICAgICAgICAgIGBFdmVudCBiaW5kaW5nICR7ZXZlbnQuZnVsbE5hbWV9IG5vdCBlbWl0dGVkIGJ5IGFueSBkaXJlY3RpdmUgb24gYW4gZW1iZWRkZWQgdGVtcGxhdGUuIE1ha2Ugc3VyZSB0aGF0IHRoZSBldmVudCBuYW1lIGlzIHNwZWxsZWQgY29ycmVjdGx5IGFuZCBhbGwgZGlyZWN0aXZlcyBhcmUgbGlzdGVkIGluIHRoZSBcIkBOZ01vZHVsZS5kZWNsYXJhdGlvbnNcIi5gLFxuICAgICAgICAgICAgZXZlbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9jaGVja1Byb3BlcnRpZXNJblNjaGVtYShlbGVtZW50TmFtZTogc3RyaW5nLCBib3VuZFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10pOlxuICAgICAgdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdIHtcbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBmaWx0ZXIgb3V0IGVtcHR5IGV4cHJlc3Npb25zIGJlZm9yZSB0aGlzIG1ldGhvZCxcbiAgICAvLyBhcyB3ZSBzdGlsbCB3YW50IHRvIHZhbGlkYXRlIHRoZW0hXG4gICAgcmV0dXJuIGJvdW5kUHJvcHMuZmlsdGVyKChib3VuZFByb3ApID0+IHtcbiAgICAgIGlmIChib3VuZFByb3AudHlwZSA9PT0gdC5Qcm9wZXJ0eUJpbmRpbmdUeXBlLlByb3BlcnR5ICYmXG4gICAgICAgICAgIXRoaXMuX3NjaGVtYVJlZ2lzdHJ5Lmhhc1Byb3BlcnR5KGVsZW1lbnROYW1lLCBib3VuZFByb3AubmFtZSwgdGhpcy5fc2NoZW1hcykpIHtcbiAgICAgICAgbGV0IGVycm9yTXNnID1cbiAgICAgICAgICAgIGBDYW4ndCBiaW5kIHRvICcke2JvdW5kUHJvcC5uYW1lfScgc2luY2UgaXQgaXNuJ3QgYSBrbm93biBwcm9wZXJ0eSBvZiAnJHtlbGVtZW50TmFtZX0nLmA7XG4gICAgICAgIGlmIChlbGVtZW50TmFtZS5zdGFydHNXaXRoKCduZy0nKSkge1xuICAgICAgICAgIGVycm9yTXNnICs9XG4gICAgICAgICAgICAgIGBcXG4xLiBJZiAnJHtib3VuZFByb3AubmFtZX0nIGlzIGFuIEFuZ3VsYXIgZGlyZWN0aXZlLCB0aGVuIGFkZCAnQ29tbW9uTW9kdWxlJyB0byB0aGUgJ0BOZ01vZHVsZS5pbXBvcnRzJyBvZiB0aGlzIGNvbXBvbmVudC5gICtcbiAgICAgICAgICAgICAgYFxcbjIuIFRvIGFsbG93IGFueSBwcm9wZXJ0eSBhZGQgJ05PX0VSUk9SU19TQ0hFTUEnIHRvIHRoZSAnQE5nTW9kdWxlLnNjaGVtYXMnIG9mIHRoaXMgY29tcG9uZW50LmA7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudE5hbWUuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgICAgICBlcnJvck1zZyArPVxuICAgICAgICAgICAgICBgXFxuMS4gSWYgJyR7ZWxlbWVudE5hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbXBvbmVudCBhbmQgaXQgaGFzICcke2JvdW5kUHJvcC5uYW1lfScgaW5wdXQsIHRoZW4gdmVyaWZ5IHRoYXQgaXQgaXMgcGFydCBvZiB0aGlzIG1vZHVsZS5gICtcbiAgICAgICAgICAgICAgYFxcbjIuIElmICcke2VsZW1lbnROYW1lfScgaXMgYSBXZWIgQ29tcG9uZW50IHRoZW4gYWRkICdDVVNUT01fRUxFTUVOVFNfU0NIRU1BJyB0byB0aGUgJ0BOZ01vZHVsZS5zY2hlbWFzJyBvZiB0aGlzIGNvbXBvbmVudCB0byBzdXBwcmVzcyB0aGlzIG1lc3NhZ2UuYCArXG4gICAgICAgICAgICAgIGBcXG4zLiBUbyBhbGxvdyBhbnkgcHJvcGVydHkgYWRkICdOT19FUlJPUlNfU0NIRU1BJyB0byB0aGUgJ0BOZ01vZHVsZS5zY2hlbWFzJyBvZiB0aGlzIGNvbXBvbmVudC5gO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKGVycm9yTXNnLCBib3VuZFByb3Auc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gIWlzRW1wdHlFeHByZXNzaW9uKGJvdW5kUHJvcC52YWx1ZSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9yZXBvcnRFcnJvcihcbiAgICAgIG1lc3NhZ2U6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgbGV2ZWw6IFBhcnNlRXJyb3JMZXZlbCA9IFBhcnNlRXJyb3JMZXZlbC5FUlJPUikge1xuICAgIHRoaXMuX3RhcmdldEVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cbn1cblxuY2xhc3MgTm9uQmluZGFibGVWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgdmlzaXRFbGVtZW50KGFzdDogaHRtbC5FbGVtZW50LCBwYXJlbnQ6IEVsZW1lbnRDb250ZXh0KTogdC5FbGVtZW50QXN0fG51bGwge1xuICAgIGNvbnN0IHByZXBhcnNlZEVsZW1lbnQgPSBwcmVwYXJzZUVsZW1lbnQoYXN0KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQpIHtcbiAgICAgIC8vIFNraXBwaW5nIDxzY3JpcHQ+IGZvciBzZWN1cml0eSByZWFzb25zXG4gICAgICAvLyBTa2lwcGluZyA8c3R5bGU+IGFuZCBzdHlsZXNoZWV0cyBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgYXR0ck5hbWVBbmRWYWx1ZXMgPSBhc3QuYXR0cnMubWFwKChhdHRyKTogW3N0cmluZywgc3RyaW5nXSA9PiBbYXR0ci5uYW1lLCBhdHRyLnZhbHVlXSk7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVFbGVtZW50Q3NzU2VsZWN0b3IoYXN0Lm5hbWUsIGF0dHJOYW1lQW5kVmFsdWVzKTtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRleCA9IHBhcmVudC5maW5kTmdDb250ZW50SW5kZXgoc2VsZWN0b3IpO1xuICAgIGNvbnN0IGNoaWxkcmVuOiB0LlRlbXBsYXRlQXN0W10gPSBodG1sLnZpc2l0QWxsKHRoaXMsIGFzdC5jaGlsZHJlbiwgRU1QVFlfRUxFTUVOVF9DT05URVhUKTtcbiAgICByZXR1cm4gbmV3IHQuRWxlbWVudEFzdChcbiAgICAgICAgYXN0Lm5hbWUsIGh0bWwudmlzaXRBbGwodGhpcywgYXN0LmF0dHJzKSwgW10sIFtdLCBbXSwgW10sIFtdLCBmYWxzZSwgW10sIGNoaWxkcmVuLFxuICAgICAgICBuZ0NvbnRlbnRJbmRleCwgYXN0LnNvdXJjZVNwYW4sIGFzdC5lbmRTb3VyY2VTcGFuKTtcbiAgfVxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gbnVsbDsgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IGFueSk6IHQuQXR0ckFzdCB7XG4gICAgcmV0dXJuIG5ldyB0LkF0dHJBc3QoYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IHQuVGV4dEFzdCB7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KFRFWFRfQ1NTX1NFTEVDVE9SKSAhO1xuICAgIHJldHVybiBuZXcgdC5UZXh0QXN0KHRleHQudmFsdWUsIG5nQ29udGVudEluZGV4LCB0ZXh0LnNvdXJjZVNwYW4gISk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gZXhwYW5zaW9uOyB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIGV4cGFuc2lvbkNhc2U7IH1cbn1cblxuLyoqXG4gKiBBIHJlZmVyZW5jZSB0byBhbiBlbGVtZW50IG9yIGRpcmVjdGl2ZSBpbiBhIHRlbXBsYXRlLiBFLmcuLCB0aGUgcmVmZXJlbmNlIGluIHRoaXMgdGVtcGxhdGU6XG4gKlxuICogPGRpdiAjbXlNZW51PVwiY29vbE1lbnVcIj5cbiAqXG4gKiB3b3VsZCBiZSB7bmFtZTogJ215TWVudScsIHZhbHVlOiAnY29vbE1lbnUnLCBzb3VyY2VTcGFuOiAuLi59XG4gKi9cbmNsYXNzIEVsZW1lbnRPckRpcmVjdGl2ZVJlZiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuXG4gIC8qKiBHZXRzIHdoZXRoZXIgdGhpcyBpcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2l2ZW4gZGlyZWN0aXZlLiAqL1xuICBpc1JlZmVyZW5jZVRvRGlyZWN0aXZlKGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkpIHtcbiAgICByZXR1cm4gc3BsaXRFeHBvcnRBcyhkaXJlY3RpdmUuZXhwb3J0QXMpLmluZGV4T2YodGhpcy52YWx1ZSkgIT09IC0xO1xuICB9XG59XG5cbi8qKiBTcGxpdHMgYSByYXcsIHBvdGVudGlhbGx5IGNvbW1hLWRlbGltaXRlZCBgZXhwb3J0QXNgIHZhbHVlIGludG8gYW4gYXJyYXkgb2YgbmFtZXMuICovXG5mdW5jdGlvbiBzcGxpdEV4cG9ydEFzKGV4cG9ydEFzOiBzdHJpbmcgfCBudWxsKTogc3RyaW5nW10ge1xuICByZXR1cm4gZXhwb3J0QXMgPyBleHBvcnRBcy5zcGxpdCgnLCcpLm1hcChlID0+IGUudHJpbSgpKSA6IFtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRDbGFzc2VzKGNsYXNzQXR0clZhbHVlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBjbGFzc0F0dHJWYWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG59XG5cbmNsYXNzIEVsZW1lbnRDb250ZXh0IHtcbiAgc3RhdGljIGNyZWF0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdLFxuICAgICAgcHJvdmlkZXJDb250ZXh0OiBQcm92aWRlckVsZW1lbnRDb250ZXh0KTogRWxlbWVudENvbnRleHQge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gICAgbGV0IHdpbGRjYXJkTmdDb250ZW50SW5kZXg6IG51bWJlciA9IG51bGwgITtcbiAgICBjb25zdCBjb21wb25lbnQgPSBkaXJlY3RpdmVzLmZpbmQoZGlyZWN0aXZlID0+IGRpcmVjdGl2ZS5kaXJlY3RpdmUuaXNDb21wb25lbnQpO1xuICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgIGNvbnN0IG5nQ29udGVudFNlbGVjdG9ycyA9IGNvbXBvbmVudC5kaXJlY3RpdmUudGVtcGxhdGUgIS5uZ0NvbnRlbnRTZWxlY3RvcnM7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5nQ29udGVudFNlbGVjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBzZWxlY3RvciA9IG5nQ29udGVudFNlbGVjdG9yc1tpXTtcbiAgICAgICAgaWYgKHNlbGVjdG9yID09PSAnKicpIHtcbiAgICAgICAgICB3aWxkY2FyZE5nQ29udGVudEluZGV4ID0gaTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKG5nQ29udGVudFNlbGVjdG9yc1tpXSksIGkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgRWxlbWVudENvbnRleHQoaXNUZW1wbGF0ZUVsZW1lbnQsIG1hdGNoZXIsIHdpbGRjYXJkTmdDb250ZW50SW5kZXgsIHByb3ZpZGVyQ29udGV4dCk7XG4gIH1cbiAgY29uc3RydWN0b3IoXG4gICAgICBwdWJsaWMgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIHByaXZhdGUgX25nQ29udGVudEluZGV4TWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyLFxuICAgICAgcHJpdmF0ZSBfd2lsZGNhcmROZ0NvbnRlbnRJbmRleDogbnVtYmVyfG51bGwsXG4gICAgICBwdWJsaWMgcHJvdmlkZXJDb250ZXh0OiBQcm92aWRlckVsZW1lbnRDb250ZXh0fG51bGwpIHt9XG5cbiAgZmluZE5nQ29udGVudEluZGV4KHNlbGVjdG9yOiBDc3NTZWxlY3Rvcik6IG51bWJlcnxudWxsIHtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRpY2VzOiBudW1iZXJbXSA9IFtdO1xuICAgIHRoaXMuX25nQ29udGVudEluZGV4TWF0Y2hlci5tYXRjaChcbiAgICAgICAgc2VsZWN0b3IsIChzZWxlY3RvciwgbmdDb250ZW50SW5kZXgpID0+IHsgbmdDb250ZW50SW5kaWNlcy5wdXNoKG5nQ29udGVudEluZGV4KTsgfSk7XG4gICAgbmdDb250ZW50SW5kaWNlcy5zb3J0KCk7XG4gICAgaWYgKHRoaXMuX3dpbGRjYXJkTmdDb250ZW50SW5kZXggIT0gbnVsbCkge1xuICAgICAgbmdDb250ZW50SW5kaWNlcy5wdXNoKHRoaXMuX3dpbGRjYXJkTmdDb250ZW50SW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gbmdDb250ZW50SW5kaWNlcy5sZW5ndGggPiAwID8gbmdDb250ZW50SW5kaWNlc1swXSA6IG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnRDc3NTZWxlY3RvcihcbiAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBhdHRyaWJ1dGVzOiBbc3RyaW5nLCBzdHJpbmddW10pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsTmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbE5hbWVOb05zKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBhdHRyTmFtZSA9IGF0dHJpYnV0ZXNbaV1bMF07XG4gICAgY29uc3QgYXR0ck5hbWVOb05zID0gc3BsaXROc05hbWUoYXR0ck5hbWUpWzFdO1xuICAgIGNvbnN0IGF0dHJWYWx1ZSA9IGF0dHJpYnV0ZXNbaV1bMV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUoYXR0ck5hbWVOb05zLCBhdHRyVmFsdWUpO1xuICAgIGlmIChhdHRyTmFtZS50b0xvd2VyQ2FzZSgpID09IENMQVNTX0FUVFIpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSBzcGxpdENsYXNzZXMoYXR0clZhbHVlKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbmNvbnN0IEVNUFRZX0VMRU1FTlRfQ09OVEVYVCA9IG5ldyBFbGVtZW50Q29udGV4dCh0cnVlLCBuZXcgU2VsZWN0b3JNYXRjaGVyKCksIG51bGwsIG51bGwpO1xuY29uc3QgTk9OX0JJTkRBQkxFX1ZJU0lUT1IgPSBuZXcgTm9uQmluZGFibGVWaXNpdG9yKCk7XG5cbmZ1bmN0aW9uIF9pc0VtcHR5VGV4dE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5UZXh0ICYmIG5vZGUudmFsdWUudHJpbSgpLmxlbmd0aCA9PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlU3VtbWFyeUR1cGxpY2F0ZXM8VCBleHRlbmRze3R5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGF9PihpdGVtczogVFtdKTogVFtdIHtcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxhbnksIFQ+KCk7XG5cbiAgaXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgIGlmICghbWFwLmdldChpdGVtLnR5cGUucmVmZXJlbmNlKSkge1xuICAgICAgbWFwLnNldChpdGVtLnR5cGUucmVmZXJlbmNlLCBpdGVtKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKG1hcC52YWx1ZXMoKSk7XG59XG5cbmZ1bmN0aW9uIGlzRW1wdHlFeHByZXNzaW9uKGFzdDogQVNUKTogYm9vbGVhbiB7XG4gIGlmIChhc3QgaW5zdGFuY2VvZiBBU1RXaXRoU291cmNlKSB7XG4gICAgYXN0ID0gYXN0LmFzdDtcbiAgfVxuICByZXR1cm4gYXN0IGluc3RhbmNlb2YgRW1wdHlFeHByO1xufSJdfQ==