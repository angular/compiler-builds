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
    var CLASS_ATTR = 'class';
    var _TEXT_CSS_SELECTOR;
    function TEXT_CSS_SELECTOR() {
        if (!_TEXT_CSS_SELECTOR) {
            _TEXT_CSS_SELECTOR = selector_1.CssSelector.parse('*')[0];
        }
        return _TEXT_CSS_SELECTOR;
    }
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
            get: function () {
                return this._exprParser;
            },
            enumerable: true,
            configurable: true
        });
        TemplateParser.prototype.parse = function (component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
            var _a;
            var result = this.tryParse(component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces);
            var warnings = result.errors.filter(function (error) { return error.level === parse_util_1.ParseErrorLevel.WARNING; });
            var errors = result.errors.filter(function (error) { return error.level === parse_util_1.ParseErrorLevel.ERROR; });
            if (warnings.length > 0) {
                (_a = this._console) === null || _a === void 0 ? void 0 : _a.warn("Template parse warnings:\n" + warnings.join('\n'));
            }
            if (errors.length > 0) {
                var errorString = errors.join('\n');
                throw util_1.syntaxError("Template parse errors:\n" + errorString, errors);
            }
            return { template: result.templateAst, pipes: result.usedPipes };
        };
        TemplateParser.prototype.tryParse = function (component, template, directives, pipes, schemas, templateUrl, preserveWhitespaces) {
            var htmlParseResult = typeof template === 'string' ?
                this._htmlParser.parse(template, templateUrl, {
                    tokenizeExpansionForms: true,
                    interpolationConfig: this.getInterpolationConfig(component)
                }) :
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
                this.transforms.forEach(function (transform) {
                    result = t.templateVisitAll(transform, result);
                });
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
        TemplateParseVisitor.prototype.visitExpansion = function (expansion, context) {
            return null;
        };
        TemplateParseVisitor.prototype.visitExpansionCase = function (expansionCase, context) {
            return null;
        };
        TemplateParseVisitor.prototype.visitText = function (text, parent) {
            var ngContentIndex = parent.findNgContentIndex(TEXT_CSS_SELECTOR());
            var valueNoNgsp = html_whitespaces_1.replaceNgsp(text.value);
            var expr = this._bindingParser.parseInterpolation(valueNoNgsp, text.sourceSpan);
            return expr ? new t.BoundTextAst(expr, ngContentIndex, text.sourceSpan) :
                new t.TextAst(valueNoNgsp, ngContentIndex, text.sourceSpan);
        };
        TemplateParseVisitor.prototype.visitAttribute = function (attribute, context) {
            return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
        };
        TemplateParseVisitor.prototype.visitComment = function (comment, context) {
            return null;
        };
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
                    var absoluteOffset = (attr.valueSpan || attr.sourceSpan).start.offset;
                    _this._bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attr.sourceSpan, absoluteOffset, templateMatchableAttrs, templateElementOrDirectiveProps, parsedVariables_1);
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
            var absoluteOffset = attr.valueSpan ? attr.valueSpan.start.offset : srcSpan.start.offset;
            var boundEvents = [];
            var bindParts = name.match(BIND_NAME_REGEXP);
            var hasBinding = false;
            if (bindParts !== null) {
                hasBinding = true;
                if (bindParts[KW_BIND_IDX] != null) {
                    this._bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, absoluteOffset, attr.valueSpan, targetMatchableAttrs, targetProps);
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
            else if (identifier.length === 0) {
                this._reportError("Variable does not have a name", sourceSpan);
            }
            targetVars.push(new t.VariableAst(identifier, value, sourceSpan));
        };
        TemplateParseVisitor.prototype._parseReference = function (identifier, value, sourceSpan, targetRefs) {
            if (identifier.indexOf('-') > -1) {
                this._reportError("\"-\" is not allowed in reference names", sourceSpan);
            }
            else if (identifier.length === 0) {
                this._reportError("Reference does not have a name", sourceSpan);
            }
            targetRefs.push(new ElementOrDirectiveRef(identifier, value, sourceSpan));
        };
        TemplateParseVisitor.prototype._parseAssignmentEvent = function (name, expression, sourceSpan, valueSpan, targetMatchableAttrs, targetEvents) {
            this._bindingParser.parseEvent(name + "Change", expression + "=$event", sourceSpan, valueSpan, targetMatchableAttrs, targetEvents);
        };
        TemplateParseVisitor.prototype._parseDirectives = function (selectorMatcher, elementCssSelector) {
            var _this = this;
            // Need to sort the directives so that we get consistent results throughout,
            // as selectorMatcher uses Maps inside.
            // Also deduplicate directives as they might match more than one time!
            var directives = util_1.newArray(this.directivesIndex.size);
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
                errorMsg += "1. If '" + elName + "' is an Angular component, then verify that it is part of this module.\n";
                if (elName.indexOf('-') > -1) {
                    errorMsg += "2. If '" + elName + "' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the '@NgModule.schemas' of this component to suppress this message.";
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
                    _this._reportError("Event binding " + event
                        .fullName + " not emitted by any directive on an embedded template. Make sure that the event name is spelled correctly and all directives are listed in the \"@NgModule.declarations\".", event.sourceSpan);
                }
            });
        };
        TemplateParseVisitor.prototype._checkPropertiesInSchema = function (elementName, boundProps) {
            var _this = this;
            // Note: We can't filter out empty expressions before this method,
            // as we still want to validate them!
            return boundProps.filter(function (boundProp) {
                if (boundProp.type === 0 /* Property */ &&
                    !_this._schemaRegistry.hasProperty(elementName, boundProp.name, _this._schemas)) {
                    var errorMsg = "Can't bind to '" + boundProp.name + "' since it isn't a known property of '" + elementName + "'.";
                    if (elementName.startsWith('ng-')) {
                        errorMsg +=
                            "\n1. If '" + boundProp
                                .name + "' is an Angular directive, then add 'CommonModule' to the '@NgModule.imports' of this component." +
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
        NonBindableVisitor.prototype.visitComment = function (comment, context) {
            return null;
        };
        NonBindableVisitor.prototype.visitAttribute = function (attribute, context) {
            return new t.AttrAst(attribute.name, attribute.value, attribute.sourceSpan);
        };
        NonBindableVisitor.prototype.visitText = function (text, parent) {
            var ngContentIndex = parent.findNgContentIndex(TEXT_CSS_SELECTOR());
            return new t.TextAst(text.value, ngContentIndex, text.sourceSpan);
        };
        NonBindableVisitor.prototype.visitExpansion = function (expansion, context) {
            return expansion;
        };
        NonBindableVisitor.prototype.visitExpansionCase = function (expansionCase, context) {
            return expansionCase;
        };
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
            this._ngContentIndexMatcher.match(selector, function (selector, ngContentIndex) {
                ngContentIndices.push(ngContentIndex);
            });
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
    exports.isEmptyExpression = isEmptyExpression;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfcGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsMkVBQXFLO0lBSXJLLG1FQUFvSDtJQUVwSCxpRUFBcUc7SUFDckcsMERBQXlDO0lBQ3pDLDJFQUFxRTtJQUNyRSxxRkFBNkU7SUFDN0UscUZBQTBEO0lBQzFELDZGQUFzRTtJQUN0RSw2REFBNEQ7SUFDNUQsK0RBQTJFO0lBQzNFLDZFQUFpRjtJQUVqRiwyREFBeUQ7SUFDekQsK0VBQTJEO0lBQzNELG1EQUF1RDtJQUV2RCx1RkFBK0M7SUFDL0Msc0VBQW9DO0lBQ3BDLCtGQUEyRTtJQUUzRSxJQUFNLGdCQUFnQixHQUNsQiwwR0FBMEcsQ0FBQztJQUUvRyxvQkFBb0I7SUFDcEIsSUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0lBQ3RCLG1CQUFtQjtJQUNuQixJQUFNLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDckIscUJBQXFCO0lBQ3JCLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNyQixrQkFBa0I7SUFDbEIsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBQ3BCLHNCQUFzQjtJQUN0QixJQUFNLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDeEIsZ0JBQWdCO0lBQ2hCLElBQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztJQUNwQixvRkFBb0Y7SUFDcEYsSUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLG1DQUFtQztJQUNuQyxJQUFNLG9CQUFvQixHQUFHLENBQUMsQ0FBQztJQUMvQixpQ0FBaUM7SUFDakMsSUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7SUFDN0Isa0NBQWtDO0lBQ2xDLElBQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQztJ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LENBQUM7SUFDcEUsQ0FBQztJQUVELFNBQWdCLHVCQUF1QixDQUF3QyxLQUFVO1FBQ3ZGLElBQU0sR0FBRyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFFOUIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFDLElBQUk7WUFDakIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDakMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQzthQUNwQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFWRCwwREFVQztJQUVELFNBQWdCLGlCQUFpQixDQUFDLEdBQVE7UUFDeEMsSUFBSSxHQUFHLFlBQVksbUJBQWEsRUFBRTtZQUNoQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQztTQUNmO1FBQ0QsT0FBTyxHQUFHLFlBQVksZUFBUyxDQUFDO0lBQ2xDLENBQUM7SUFMRCw4Q0FLQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUGlwZVN1bW1hcnksIENvbXBpbGVUb2tlbk1ldGFkYXRhLCBDb21waWxlVHlwZU1ldGFkYXRhLCBpZGVudGlmaWVyTmFtZX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7Q29tcGlsZXJDb25maWd9IGZyb20gJy4uL2NvbmZpZyc7XG5pbXBvcnQge1NjaGVtYU1ldGFkYXRhfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBFbXB0eUV4cHIsIFBhcnNlZEV2ZW50LCBQYXJzZWRQcm9wZXJ0eSwgUGFyc2VkVmFyaWFibGV9IGZyb20gJy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCB7Y3JlYXRlVG9rZW5Gb3JFeHRlcm5hbFJlZmVyZW5jZSwgY3JlYXRlVG9rZW5Gb3JSZWZlcmVuY2UsIElkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyLCBQYXJzZVRyZWVSZXN1bHR9IGZyb20gJy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge3JlbW92ZVdoaXRlc3BhY2VzLCByZXBsYWNlTmdzcH0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtleHBhbmROb2Rlc30gZnJvbSAnLi4vbWxfcGFyc2VyL2ljdV9hc3RfZXhwYW5kZXInO1xuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtpc05nVGVtcGxhdGUsIHNwbGl0TnNOYW1lfSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlRXJyb3JMZXZlbCwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UHJvdmlkZXJFbGVtZW50Q29udGV4dCwgUHJvdmlkZXJWaWV3Q29udGV4dH0gZnJvbSAnLi4vcHJvdmlkZXJfYW5hbHl6ZXInO1xuaW1wb3J0IHtFbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uL3NjaGVtYS9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uL3NlbGVjdG9yJztcbmltcG9ydCB7aXNTdHlsZVVybFJlc29sdmFibGV9IGZyb20gJy4uL3N0eWxlX3VybF9yZXNvbHZlcic7XG5pbXBvcnQge0NvbnNvbGUsIG5ld0FycmF5LCBzeW50YXhFcnJvcn0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4vdGVtcGxhdGVfYXN0JztcbmltcG9ydCB7UHJlcGFyc2VkRWxlbWVudFR5cGUsIHByZXBhcnNlRWxlbWVudH0gZnJvbSAnLi90ZW1wbGF0ZV9wcmVwYXJzZXInO1xuXG5jb25zdCBCSU5EX05BTUVfUkVHRVhQID1cbiAgICAvXig/Oig/Oig/OihiaW5kLSl8KGxldC0pfChyZWYtfCMpfChvbi0pfChiaW5kb24tKXwoQCkpKC4qKSl8XFxbXFwoKFteXFwpXSspXFwpXFxdfFxcWyhbXlxcXV0rKVxcXXxcXCgoW15cXCldKylcXCkpJC87XG5cbi8vIEdyb3VwIDEgPSBcImJpbmQtXCJcbmNvbnN0IEtXX0JJTkRfSURYID0gMTtcbi8vIEdyb3VwIDIgPSBcImxldC1cIlxuY29uc3QgS1dfTEVUX0lEWCA9IDI7XG4vLyBHcm91cCAzID0gXCJyZWYtLyNcIlxuY29uc3QgS1dfUkVGX0lEWCA9IDM7XG4vLyBHcm91cCA0ID0gXCJvbi1cIlxuY29uc3QgS1dfT05fSURYID0gNDtcbi8vIEdyb3VwIDUgPSBcImJpbmRvbi1cIlxuY29uc3QgS1dfQklORE9OX0lEWCA9IDU7XG4vLyBHcm91cCA2ID0gXCJAXCJcbmNvbnN0IEtXX0FUX0lEWCA9IDY7XG4vLyBHcm91cCA3ID0gdGhlIGlkZW50aWZpZXIgYWZ0ZXIgXCJiaW5kLVwiLCBcImxldC1cIiwgXCJyZWYtLyNcIiwgXCJvbi1cIiwgXCJiaW5kb24tXCIgb3IgXCJAXCJcbmNvbnN0IElERU5UX0tXX0lEWCA9IDc7XG4vLyBHcm91cCA4ID0gaWRlbnRpZmllciBpbnNpZGUgWygpXVxuY29uc3QgSURFTlRfQkFOQU5BX0JPWF9JRFggPSA4O1xuLy8gR3JvdXAgOSA9IGlkZW50aWZpZXIgaW5zaWRlIFtdXG5jb25zdCBJREVOVF9QUk9QRVJUWV9JRFggPSA5O1xuLy8gR3JvdXAgMTAgPSBpZGVudGlmaWVyIGluc2lkZSAoKVxuY29uc3QgSURFTlRfRVZFTlRfSURYID0gMTA7XG5cbmNvbnN0IFRFTVBMQVRFX0FUVFJfUFJFRklYID0gJyonO1xuY29uc3QgQ0xBU1NfQVRUUiA9ICdjbGFzcyc7XG5cbmxldCBfVEVYVF9DU1NfU0VMRUNUT1IhOiBDc3NTZWxlY3RvcjtcbmZ1bmN0aW9uIFRFWFRfQ1NTX1NFTEVDVE9SKCk6IENzc1NlbGVjdG9yIHtcbiAgaWYgKCFfVEVYVF9DU1NfU0VMRUNUT1IpIHtcbiAgICBfVEVYVF9DU1NfU0VMRUNUT1IgPSBDc3NTZWxlY3Rvci5wYXJzZSgnKicpWzBdO1xuICB9XG4gIHJldHVybiBfVEVYVF9DU1NfU0VMRUNUT1I7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVBhcnNlRXJyb3IgZXh0ZW5kcyBQYXJzZUVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwpIHtcbiAgICBzdXBlcihzcGFuLCBtZXNzYWdlLCBsZXZlbCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VSZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyB0ZW1wbGF0ZUFzdD86IHQuVGVtcGxhdGVBc3RbXSwgcHVibGljIHVzZWRQaXBlcz86IENvbXBpbGVQaXBlU3VtbWFyeVtdLFxuICAgICAgcHVibGljIGVycm9ycz86IFBhcnNlRXJyb3JbXSkge31cbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUGFyc2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIF9jb25maWc6IENvbXBpbGVyQ29uZmlnLCBwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgICBwcml2YXRlIF9leHByUGFyc2VyOiBQYXJzZXIsIHByaXZhdGUgX3NjaGVtYVJlZ2lzdHJ5OiBFbGVtZW50U2NoZW1hUmVnaXN0cnksXG4gICAgICBwcml2YXRlIF9odG1sUGFyc2VyOiBIdG1sUGFyc2VyLCBwcml2YXRlIF9jb25zb2xlOiBDb25zb2xlfG51bGwsXG4gICAgICBwdWJsaWMgdHJhbnNmb3JtczogdC5UZW1wbGF0ZUFzdFZpc2l0b3JbXSkge31cblxuICBwdWJsaWMgZ2V0IGV4cHJlc3Npb25QYXJzZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2V4cHJQYXJzZXI7XG4gIH1cblxuICBwYXJzZShcbiAgICAgIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCB0ZW1wbGF0ZTogc3RyaW5nfFBhcnNlVHJlZVJlc3VsdCxcbiAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSwgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSxcbiAgICAgIHRlbXBsYXRlVXJsOiBzdHJpbmcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuKToge3RlbXBsYXRlOiB0LlRlbXBsYXRlQXN0W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXX0ge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMudHJ5UGFyc2UoXG4gICAgICAgIGNvbXBvbmVudCwgdGVtcGxhdGUsIGRpcmVjdGl2ZXMsIHBpcGVzLCBzY2hlbWFzLCB0ZW1wbGF0ZVVybCwgcHJlc2VydmVXaGl0ZXNwYWNlcyk7XG4gICAgY29uc3Qgd2FybmluZ3MgPSByZXN1bHQuZXJyb3JzIS5maWx0ZXIoZXJyb3IgPT4gZXJyb3IubGV2ZWwgPT09IFBhcnNlRXJyb3JMZXZlbC5XQVJOSU5HKTtcblxuICAgIGNvbnN0IGVycm9ycyA9IHJlc3VsdC5lcnJvcnMhLmZpbHRlcihlcnJvciA9PiBlcnJvci5sZXZlbCA9PT0gUGFyc2VFcnJvckxldmVsLkVSUk9SKTtcblxuICAgIGlmICh3YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9jb25zb2xlPy53YXJuKGBUZW1wbGF0ZSBwYXJzZSB3YXJuaW5nczpcXG4ke3dhcm5pbmdzLmpvaW4oJ1xcbicpfWApO1xuICAgIH1cblxuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZXJyb3JTdHJpbmcgPSBlcnJvcnMuam9pbignXFxuJyk7XG4gICAgICB0aHJvdyBzeW50YXhFcnJvcihgVGVtcGxhdGUgcGFyc2UgZXJyb3JzOlxcbiR7ZXJyb3JTdHJpbmd9YCwgZXJyb3JzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge3RlbXBsYXRlOiByZXN1bHQudGVtcGxhdGVBc3QhLCBwaXBlczogcmVzdWx0LnVzZWRQaXBlcyF9O1xuICB9XG5cbiAgdHJ5UGFyc2UoXG4gICAgICBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgdGVtcGxhdGU6IHN0cmluZ3xQYXJzZVRyZWVSZXN1bHQsXG4gICAgICBkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBwaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10sIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10sXG4gICAgICB0ZW1wbGF0ZVVybDogc3RyaW5nLCBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuKTogVGVtcGxhdGVQYXJzZVJlc3VsdCB7XG4gICAgbGV0IGh0bWxQYXJzZVJlc3VsdCA9IHR5cGVvZiB0ZW1wbGF0ZSA9PT0gJ3N0cmluZycgP1xuICAgICAgICB0aGlzLl9odG1sUGFyc2VyIS5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwsIHtcbiAgICAgICAgICB0b2tlbml6ZUV4cGFuc2lvbkZvcm1zOiB0cnVlLFxuICAgICAgICAgIGludGVycG9sYXRpb25Db25maWc6IHRoaXMuZ2V0SW50ZXJwb2xhdGlvbkNvbmZpZyhjb21wb25lbnQpXG4gICAgICAgIH0pIDpcbiAgICAgICAgdGVtcGxhdGU7XG5cbiAgICBpZiAoIXByZXNlcnZlV2hpdGVzcGFjZXMpIHtcbiAgICAgIGh0bWxQYXJzZVJlc3VsdCA9IHJlbW92ZVdoaXRlc3BhY2VzKGh0bWxQYXJzZVJlc3VsdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudHJ5UGFyc2VIdG1sKFxuICAgICAgICB0aGlzLmV4cGFuZEh0bWwoaHRtbFBhcnNlUmVzdWx0KSwgY29tcG9uZW50LCBkaXJlY3RpdmVzLCBwaXBlcywgc2NoZW1hcyk7XG4gIH1cblxuICB0cnlQYXJzZUh0bWwoXG4gICAgICBodG1sQXN0V2l0aEVycm9yczogUGFyc2VUcmVlUmVzdWx0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgICAgIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sIHBpcGVzOiBDb21waWxlUGlwZVN1bW1hcnlbXSxcbiAgICAgIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10pOiBUZW1wbGF0ZVBhcnNlUmVzdWx0IHtcbiAgICBsZXQgcmVzdWx0OiB0LlRlbXBsYXRlQXN0W107XG4gICAgY29uc3QgZXJyb3JzID0gaHRtbEFzdFdpdGhFcnJvcnMuZXJyb3JzO1xuICAgIGNvbnN0IHVzZWRQaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10gPSBbXTtcbiAgICBpZiAoaHRtbEFzdFdpdGhFcnJvcnMucm9vdE5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHVuaXFEaXJlY3RpdmVzID0gcmVtb3ZlU3VtbWFyeUR1cGxpY2F0ZXMoZGlyZWN0aXZlcyk7XG4gICAgICBjb25zdCB1bmlxUGlwZXMgPSByZW1vdmVTdW1tYXJ5RHVwbGljYXRlcyhwaXBlcyk7XG4gICAgICBjb25zdCBwcm92aWRlclZpZXdDb250ZXh0ID0gbmV3IFByb3ZpZGVyVmlld0NvbnRleHQodGhpcy5fcmVmbGVjdG9yLCBjb21wb25lbnQpO1xuICAgICAgbGV0IGludGVycG9sYXRpb25Db25maWc6IEludGVycG9sYXRpb25Db25maWcgPSB1bmRlZmluZWQhO1xuICAgICAgaWYgKGNvbXBvbmVudC50ZW1wbGF0ZSAmJiBjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvbikge1xuICAgICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnID0ge1xuICAgICAgICAgIHN0YXJ0OiBjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvblswXSxcbiAgICAgICAgICBlbmQ6IGNvbXBvbmVudC50ZW1wbGF0ZS5pbnRlcnBvbGF0aW9uWzFdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICAgICAgdGhpcy5fZXhwclBhcnNlciwgaW50ZXJwb2xhdGlvbkNvbmZpZyEsIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCB1bmlxUGlwZXMsIGVycm9ycyk7XG4gICAgICBjb25zdCBwYXJzZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVQYXJzZVZpc2l0b3IoXG4gICAgICAgICAgdGhpcy5fcmVmbGVjdG9yLCB0aGlzLl9jb25maWcsIHByb3ZpZGVyVmlld0NvbnRleHQsIHVuaXFEaXJlY3RpdmVzLCBiaW5kaW5nUGFyc2VyLFxuICAgICAgICAgIHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LCBzY2hlbWFzLCBlcnJvcnMpO1xuICAgICAgcmVzdWx0ID0gaHRtbC52aXNpdEFsbChwYXJzZVZpc2l0b3IsIGh0bWxBc3RXaXRoRXJyb3JzLnJvb3ROb2RlcywgRU1QVFlfRUxFTUVOVF9DT05URVhUKTtcbiAgICAgIGVycm9ycy5wdXNoKC4uLnByb3ZpZGVyVmlld0NvbnRleHQuZXJyb3JzKTtcbiAgICAgIHVzZWRQaXBlcy5wdXNoKC4uLmJpbmRpbmdQYXJzZXIuZ2V0VXNlZFBpcGVzKCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBbXTtcbiAgICB9XG4gICAgdGhpcy5fYXNzZXJ0Tm9SZWZlcmVuY2VEdXBsaWNhdGlvbk9uVGVtcGxhdGUocmVzdWx0LCBlcnJvcnMpO1xuXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gbmV3IFRlbXBsYXRlUGFyc2VSZXN1bHQocmVzdWx0LCB1c2VkUGlwZXMsIGVycm9ycyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgdGhpcy50cmFuc2Zvcm1zLmZvckVhY2goKHRyYW5zZm9ybTogdC5UZW1wbGF0ZUFzdFZpc2l0b3IpID0+IHtcbiAgICAgICAgcmVzdWx0ID0gdC50ZW1wbGF0ZVZpc2l0QWxsKHRyYW5zZm9ybSwgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVGVtcGxhdGVQYXJzZVJlc3VsdChyZXN1bHQsIHVzZWRQaXBlcywgZXJyb3JzKTtcbiAgfVxuXG4gIGV4cGFuZEh0bWwoaHRtbEFzdFdpdGhFcnJvcnM6IFBhcnNlVHJlZVJlc3VsdCwgZm9yY2VkOiBib29sZWFuID0gZmFsc2UpOiBQYXJzZVRyZWVSZXN1bHQge1xuICAgIGNvbnN0IGVycm9yczogUGFyc2VFcnJvcltdID0gaHRtbEFzdFdpdGhFcnJvcnMuZXJyb3JzO1xuXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPT0gMCB8fCBmb3JjZWQpIHtcbiAgICAgIC8vIFRyYW5zZm9ybSBJQ1UgbWVzc2FnZXMgdG8gYW5ndWxhciBkaXJlY3RpdmVzXG4gICAgICBjb25zdCBleHBhbmRlZEh0bWxBc3QgPSBleHBhbmROb2RlcyhodG1sQXN0V2l0aEVycm9ycy5yb290Tm9kZXMpO1xuICAgICAgZXJyb3JzLnB1c2goLi4uZXhwYW5kZWRIdG1sQXN0LmVycm9ycyk7XG4gICAgICBodG1sQXN0V2l0aEVycm9ycyA9IG5ldyBQYXJzZVRyZWVSZXN1bHQoZXhwYW5kZWRIdG1sQXN0Lm5vZGVzLCBlcnJvcnMpO1xuICAgIH1cbiAgICByZXR1cm4gaHRtbEFzdFdpdGhFcnJvcnM7XG4gIH1cblxuICBnZXRJbnRlcnBvbGF0aW9uQ29uZmlnKGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKTogSW50ZXJwb2xhdGlvbkNvbmZpZ3x1bmRlZmluZWQge1xuICAgIGlmIChjb21wb25lbnQudGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBJbnRlcnBvbGF0aW9uQ29uZmlnLmZyb21BcnJheShjb21wb25lbnQudGVtcGxhdGUuaW50ZXJwb2xhdGlvbik7XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9hc3NlcnROb1JlZmVyZW5jZUR1cGxpY2F0aW9uT25UZW1wbGF0ZShyZXN1bHQ6IHQuVGVtcGxhdGVBc3RbXSwgZXJyb3JzOiBUZW1wbGF0ZVBhcnNlRXJyb3JbXSk6XG4gICAgICB2b2lkIHtcbiAgICBjb25zdCBleGlzdGluZ1JlZmVyZW5jZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICByZXN1bHQuZmlsdGVyKGVsZW1lbnQgPT4gISEoPGFueT5lbGVtZW50KS5yZWZlcmVuY2VzKVxuICAgICAgICAuZm9yRWFjaChlbGVtZW50ID0+ICg8YW55PmVsZW1lbnQpLnJlZmVyZW5jZXMuZm9yRWFjaCgocmVmZXJlbmNlOiB0LlJlZmVyZW5jZUFzdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSByZWZlcmVuY2UubmFtZTtcbiAgICAgICAgICBpZiAoZXhpc3RpbmdSZWZlcmVuY2VzLmluZGV4T2YobmFtZSkgPCAwKSB7XG4gICAgICAgICAgICBleGlzdGluZ1JlZmVyZW5jZXMucHVzaChuYW1lKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVGVtcGxhdGVQYXJzZUVycm9yKFxuICAgICAgICAgICAgICAgIGBSZWZlcmVuY2UgXCIjJHtuYW1lfVwiIGlzIGRlZmluZWQgc2V2ZXJhbCB0aW1lc2AsIHJlZmVyZW5jZS5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgIFBhcnNlRXJyb3JMZXZlbC5FUlJPUik7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9KSk7XG4gIH1cbn1cblxuY2xhc3MgVGVtcGxhdGVQYXJzZVZpc2l0b3IgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICBzZWxlY3Rvck1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gIGRpcmVjdGl2ZXNJbmRleCA9IG5ldyBNYXA8Q29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIG51bWJlcj4oKTtcbiAgbmdDb250ZW50Q291bnQgPSAwO1xuICBjb250ZW50UXVlcnlTdGFydElkOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgcHJpdmF0ZSBjb25maWc6IENvbXBpbGVyQ29uZmlnLFxuICAgICAgcHVibGljIHByb3ZpZGVyVmlld0NvbnRleHQ6IFByb3ZpZGVyVmlld0NvbnRleHQsIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sXG4gICAgICBwcml2YXRlIF9iaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBwcml2YXRlIF9zY2hlbWFSZWdpc3RyeTogRWxlbWVudFNjaGVtYVJlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBfc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSwgcHJpdmF0ZSBfdGFyZ2V0RXJyb3JzOiBUZW1wbGF0ZVBhcnNlRXJyb3JbXSkge1xuICAgIC8vIE5vdGU6IHF1ZXJpZXMgc3RhcnQgd2l0aCBpZCAxIHNvIHdlIGNhbiB1c2UgdGhlIG51bWJlciBpbiBhIEJsb29tIGZpbHRlciFcbiAgICB0aGlzLmNvbnRlbnRRdWVyeVN0YXJ0SWQgPSBwcm92aWRlclZpZXdDb250ZXh0LmNvbXBvbmVudC52aWV3UXVlcmllcy5sZW5ndGggKyAxO1xuICAgIGRpcmVjdGl2ZXMuZm9yRWFjaCgoZGlyZWN0aXZlLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBDc3NTZWxlY3Rvci5wYXJzZShkaXJlY3RpdmUuc2VsZWN0b3IhKTtcbiAgICAgIHRoaXMuc2VsZWN0b3JNYXRjaGVyLmFkZFNlbGVjdGFibGVzKHNlbGVjdG9yLCBkaXJlY3RpdmUpO1xuICAgICAgdGhpcy5kaXJlY3RpdmVzSW5kZXguc2V0KGRpcmVjdGl2ZSwgaW5kZXgpO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbiwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0RXhwYW5zaW9uQ2FzZShleHBhbnNpb25DYXNlOiBodG1sLkV4cGFuc2lvbkNhc2UsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0LCBwYXJlbnQ6IEVsZW1lbnRDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCBuZ0NvbnRlbnRJbmRleCA9IHBhcmVudC5maW5kTmdDb250ZW50SW5kZXgoVEVYVF9DU1NfU0VMRUNUT1IoKSkhO1xuICAgIGNvbnN0IHZhbHVlTm9OZ3NwID0gcmVwbGFjZU5nc3AodGV4dC52YWx1ZSk7XG4gICAgY29uc3QgZXhwciA9IHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VJbnRlcnBvbGF0aW9uKHZhbHVlTm9OZ3NwLCB0ZXh0LnNvdXJjZVNwYW4hKTtcbiAgICByZXR1cm4gZXhwciA/IG5ldyB0LkJvdW5kVGV4dEFzdChleHByLCBuZ0NvbnRlbnRJbmRleCwgdGV4dC5zb3VyY2VTcGFuISkgOlxuICAgICAgICAgICAgICAgICAgbmV3IHQuVGV4dEFzdCh2YWx1ZU5vTmdzcCwgbmdDb250ZW50SW5kZXgsIHRleHQuc291cmNlU3BhbiEpO1xuICB9XG5cbiAgdmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlOiBodG1sLkF0dHJpYnV0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gbmV3IHQuQXR0ckFzdChhdHRyaWJ1dGUubmFtZSwgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUuc291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IGh0bWwuRWxlbWVudCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IGFueSB7XG4gICAgY29uc3QgcXVlcnlTdGFydEluZGV4ID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgIGNvbnN0IGVsTmFtZSA9IGVsZW1lbnQubmFtZTtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQgJiZcbiAgICAgICAgaXNTdHlsZVVybFJlc29sdmFibGUocHJlcGFyc2VkRWxlbWVudC5ocmVmQXR0cikpIHtcbiAgICAgIC8vIFNraXBwaW5nIHN0eWxlc2hlZXRzIHdpdGggZWl0aGVyIHJlbGF0aXZlIHVybHMgb3IgcGFja2FnZSBzY2hlbWUgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgIC8vIHRoZW0gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCBlbGVtZW50T3JEaXJlY3RpdmVQcm9wczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGVsZW1lbnRPckRpcmVjdGl2ZVJlZnM6IEVsZW1lbnRPckRpcmVjdGl2ZVJlZltdID0gW107XG4gICAgY29uc3QgZWxlbWVudFZhcnM6IHQuVmFyaWFibGVBc3RbXSA9IFtdO1xuICAgIGNvbnN0IGV2ZW50czogdC5Cb3VuZEV2ZW50QXN0W10gPSBbXTtcblxuICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudE9yRGlyZWN0aXZlUHJvcHM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZU1hdGNoYWJsZUF0dHJzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZUVsZW1lbnRWYXJzOiB0LlZhcmlhYmxlQXN0W10gPSBbXTtcblxuICAgIGxldCBoYXNJbmxpbmVUZW1wbGF0ZXMgPSBmYWxzZTtcbiAgICBjb25zdCBhdHRyczogdC5BdHRyQXN0W10gPSBbXTtcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgZWxlbWVudC5hdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgY29uc3QgcGFyc2VkVmFyaWFibGVzOiBQYXJzZWRWYXJpYWJsZVtdID0gW107XG4gICAgICBjb25zdCBoYXNCaW5kaW5nID0gdGhpcy5fcGFyc2VBdHRyKFxuICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBhdHRyLCBtYXRjaGFibGVBdHRycywgZWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsIGV2ZW50cyxcbiAgICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50VmFycyk7XG4gICAgICBlbGVtZW50VmFycy5wdXNoKC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAodiA9PiB0LlZhcmlhYmxlQXN0LmZyb21QYXJzZWRWYXJpYWJsZSh2KSkpO1xuXG4gICAgICBsZXQgdGVtcGxhdGVWYWx1ZTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGxldCB0ZW1wbGF0ZUtleTogc3RyaW5nfHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gdGhpcy5fbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyLm5hbWUpO1xuXG4gICAgICBpZiAobm9ybWFsaXplZE5hbWUuc3RhcnRzV2l0aChURU1QTEFURV9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgdGVtcGxhdGVWYWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICAgIHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhhc1RlbXBsYXRlQmluZGluZyA9IHRlbXBsYXRlVmFsdWUgIT0gbnVsbDtcbiAgICAgIGlmIChoYXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgaWYgKGhhc0lubGluZVRlbXBsYXRlcykge1xuICAgICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgICBgQ2FuJ3QgaGF2ZSBtdWx0aXBsZSB0ZW1wbGF0ZSBiaW5kaW5ncyBvbiBvbmUgZWxlbWVudC4gVXNlIG9ubHkgb25lIGF0dHJpYnV0ZSBwcmVmaXhlZCB3aXRoICpgLFxuICAgICAgICAgICAgICBhdHRyLnNvdXJjZVNwYW4pO1xuICAgICAgICB9XG4gICAgICAgIGhhc0lubGluZVRlbXBsYXRlcyA9IHRydWU7XG4gICAgICAgIGNvbnN0IHBhcnNlZFZhcmlhYmxlczogUGFyc2VkVmFyaWFibGVbXSA9IFtdO1xuICAgICAgICBjb25zdCBhYnNvbHV0ZU9mZnNldCA9IChhdHRyLnZhbHVlU3BhbiB8fCBhdHRyLnNvdXJjZVNwYW4pLnN0YXJ0Lm9mZnNldDtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUlubGluZVRlbXBsYXRlQmluZGluZyhcbiAgICAgICAgICAgIHRlbXBsYXRlS2V5ISwgdGVtcGxhdGVWYWx1ZSEsIGF0dHIuc291cmNlU3BhbiwgYWJzb2x1dGVPZmZzZXQsIHRlbXBsYXRlTWF0Y2hhYmxlQXR0cnMsXG4gICAgICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCBwYXJzZWRWYXJpYWJsZXMpO1xuICAgICAgICB0ZW1wbGF0ZUVsZW1lbnRWYXJzLnB1c2goLi4ucGFyc2VkVmFyaWFibGVzLm1hcCh2ID0+IHQuVmFyaWFibGVBc3QuZnJvbVBhcnNlZFZhcmlhYmxlKHYpKSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaGFzVGVtcGxhdGVCaW5kaW5nKSB7XG4gICAgICAgIC8vIGRvbid0IGluY2x1ZGUgdGhlIGJpbmRpbmdzIGFzIGF0dHJpYnV0ZXMgYXMgd2VsbCBpbiB0aGUgQVNUXG4gICAgICAgIGF0dHJzLnB1c2godGhpcy52aXNpdEF0dHJpYnV0ZShhdHRyLCBudWxsKSk7XG4gICAgICAgIG1hdGNoYWJsZUF0dHJzLnB1c2goW2F0dHIubmFtZSwgYXR0ci52YWx1ZV0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgZWxlbWVudENzc1NlbGVjdG9yID0gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKGVsTmFtZSwgbWF0Y2hhYmxlQXR0cnMpO1xuICAgIGNvbnN0IHtkaXJlY3RpdmVzOiBkaXJlY3RpdmVNZXRhcywgbWF0Y2hFbGVtZW50fSA9XG4gICAgICAgIHRoaXMuX3BhcnNlRGlyZWN0aXZlcyh0aGlzLnNlbGVjdG9yTWF0Y2hlciwgZWxlbWVudENzc1NlbGVjdG9yKTtcbiAgICBjb25zdCByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZUFzdFtdID0gW107XG4gICAgY29uc3QgYm91bmREaXJlY3RpdmVQcm9wTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkaXJlY3RpdmVBc3RzID0gdGhpcy5fY3JlYXRlRGlyZWN0aXZlQXN0cyhcbiAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQsIGVsZW1lbnQubmFtZSwgZGlyZWN0aXZlTWV0YXMsIGVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLFxuICAgICAgICBlbGVtZW50T3JEaXJlY3RpdmVSZWZzLCBlbGVtZW50LnNvdXJjZVNwYW4hLCByZWZlcmVuY2VzLCBib3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgY29uc3QgZWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10gPSB0aGlzLl9jcmVhdGVFbGVtZW50UHJvcGVydHlBc3RzKFxuICAgICAgICBlbGVtZW50Lm5hbWUsIGVsZW1lbnRPckRpcmVjdGl2ZVByb3BzLCBib3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgY29uc3QgaXNWaWV3Um9vdCA9IHBhcmVudC5pc1RlbXBsYXRlRWxlbWVudCB8fCBoYXNJbmxpbmVUZW1wbGF0ZXM7XG5cbiAgICBjb25zdCBwcm92aWRlckNvbnRleHQgPSBuZXcgUHJvdmlkZXJFbGVtZW50Q29udGV4dChcbiAgICAgICAgdGhpcy5wcm92aWRlclZpZXdDb250ZXh0LCBwYXJlbnQucHJvdmlkZXJDb250ZXh0ISwgaXNWaWV3Um9vdCwgZGlyZWN0aXZlQXN0cywgYXR0cnMsXG4gICAgICAgIHJlZmVyZW5jZXMsIGlzVGVtcGxhdGVFbGVtZW50LCBxdWVyeVN0YXJ0SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiEpO1xuXG4gICAgY29uc3QgY2hpbGRyZW46IHQuVGVtcGxhdGVBc3RbXSA9IGh0bWwudmlzaXRBbGwoXG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQubm9uQmluZGFibGUgPyBOT05fQklOREFCTEVfVklTSVRPUiA6IHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4sXG4gICAgICAgIEVsZW1lbnRDb250ZXh0LmNyZWF0ZShcbiAgICAgICAgICAgIGlzVGVtcGxhdGVFbGVtZW50LCBkaXJlY3RpdmVBc3RzLFxuICAgICAgICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQgPyBwYXJlbnQucHJvdmlkZXJDb250ZXh0ISA6IHByb3ZpZGVyQ29udGV4dCkpO1xuICAgIHByb3ZpZGVyQ29udGV4dC5hZnRlckVsZW1lbnQoKTtcbiAgICAvLyBPdmVycmlkZSB0aGUgYWN0dWFsIHNlbGVjdG9yIHdoZW4gdGhlIGBuZ1Byb2plY3RBc2AgYXR0cmlidXRlIGlzIHByb3ZpZGVkXG4gICAgY29uc3QgcHJvamVjdGlvblNlbGVjdG9yID0gcHJlcGFyc2VkRWxlbWVudC5wcm9qZWN0QXMgIT0gJycgP1xuICAgICAgICBDc3NTZWxlY3Rvci5wYXJzZShwcmVwYXJzZWRFbGVtZW50LnByb2plY3RBcylbMF0gOlxuICAgICAgICBlbGVtZW50Q3NzU2VsZWN0b3I7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KHByb2plY3Rpb25TZWxlY3RvcikhO1xuICAgIGxldCBwYXJzZWRFbGVtZW50OiB0LlRlbXBsYXRlQXN0O1xuXG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuTkdfQ09OVEVOVCkge1xuICAgICAgLy8gYDxuZy1jb250ZW50PmAgZWxlbWVudFxuICAgICAgaWYgKGVsZW1lbnQuY2hpbGRyZW4gJiYgIWVsZW1lbnQuY2hpbGRyZW4uZXZlcnkoX2lzRW1wdHlUZXh0Tm9kZSkpIHtcbiAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYDxuZy1jb250ZW50PiBlbGVtZW50IGNhbm5vdCBoYXZlIGNvbnRlbnQuYCwgZWxlbWVudC5zb3VyY2VTcGFuISk7XG4gICAgICB9XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5OZ0NvbnRlbnRBc3QoXG4gICAgICAgICAgdGhpcy5uZ0NvbnRlbnRDb3VudCsrLCBoYXNJbmxpbmVUZW1wbGF0ZXMgPyBudWxsISA6IG5nQ29udGVudEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4hKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAvLyBgPG5nLXRlbXBsYXRlPmAgZWxlbWVudFxuICAgICAgdGhpcy5fYXNzZXJ0QWxsRXZlbnRzUHVibGlzaGVkQnlEaXJlY3RpdmVzKGRpcmVjdGl2ZUFzdHMsIGV2ZW50cyk7XG4gICAgICB0aGlzLl9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgICAgIGRpcmVjdGl2ZUFzdHMsIGVsZW1lbnRQcm9wcywgZWxlbWVudC5zb3VyY2VTcGFuISk7XG5cbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5FbWJlZGRlZFRlbXBsYXRlQXN0KFxuICAgICAgICAgIGF0dHJzLCBldmVudHMsIHJlZmVyZW5jZXMsIGVsZW1lbnRWYXJzLCBwcm92aWRlckNvbnRleHQudHJhbnNmb3JtZWREaXJlY3RpdmVBc3RzLFxuICAgICAgICAgIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1Qcm92aWRlcnMsIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXIsXG4gICAgICAgICAgcHJvdmlkZXJDb250ZXh0LnF1ZXJ5TWF0Y2hlcywgY2hpbGRyZW4sIGhhc0lubGluZVRlbXBsYXRlcyA/IG51bGwhIDogbmdDb250ZW50SW5kZXgsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuISk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGVsZW1lbnQgb3RoZXIgdGhhbiBgPG5nLWNvbnRlbnQ+YCBhbmQgYDxuZy10ZW1wbGF0ZT5gXG4gICAgICB0aGlzLl9hc3NlcnRFbGVtZW50RXhpc3RzKG1hdGNoRWxlbWVudCwgZWxlbWVudCk7XG4gICAgICB0aGlzLl9hc3NlcnRPbmx5T25lQ29tcG9uZW50KGRpcmVjdGl2ZUFzdHMsIGVsZW1lbnQuc291cmNlU3BhbiEpO1xuXG4gICAgICBjb25zdCBuZ0NvbnRlbnRJbmRleCA9XG4gICAgICAgICAgaGFzSW5saW5lVGVtcGxhdGVzID8gbnVsbCA6IHBhcmVudC5maW5kTmdDb250ZW50SW5kZXgocHJvamVjdGlvblNlbGVjdG9yKTtcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5FbGVtZW50QXN0KFxuICAgICAgICAgIGVsTmFtZSwgYXR0cnMsIGVsZW1lbnRQcm9wcywgZXZlbnRzLCByZWZlcmVuY2VzLCBwcm92aWRlckNvbnRleHQudHJhbnNmb3JtZWREaXJlY3RpdmVBc3RzLFxuICAgICAgICAgIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1Qcm92aWRlcnMsIHByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZEhhc1ZpZXdDb250YWluZXIsXG4gICAgICAgICAgcHJvdmlkZXJDb250ZXh0LnF1ZXJ5TWF0Y2hlcywgY2hpbGRyZW4sIGhhc0lubGluZVRlbXBsYXRlcyA/IG51bGwgOiBuZ0NvbnRlbnRJbmRleCxcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuZW5kU291cmNlU3BhbiB8fCBudWxsKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzSW5saW5lVGVtcGxhdGVzKSB7XG4gICAgICAvLyBUaGUgZWxlbWVudCBhcyBhICotYXR0cmlidXRlXG4gICAgICBjb25zdCB0ZW1wbGF0ZVF1ZXJ5U3RhcnRJbmRleCA9IHRoaXMuY29udGVudFF1ZXJ5U3RhcnRJZDtcbiAgICAgIGNvbnN0IHRlbXBsYXRlU2VsZWN0b3IgPSBjcmVhdGVFbGVtZW50Q3NzU2VsZWN0b3IoJ25nLXRlbXBsYXRlJywgdGVtcGxhdGVNYXRjaGFibGVBdHRycyk7XG4gICAgICBjb25zdCB7ZGlyZWN0aXZlc30gPSB0aGlzLl9wYXJzZURpcmVjdGl2ZXModGhpcy5zZWxlY3Rvck1hdGNoZXIsIHRlbXBsYXRlU2VsZWN0b3IpO1xuICAgICAgY29uc3QgdGVtcGxhdGVCb3VuZERpcmVjdGl2ZVByb3BOYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgY29uc3QgdGVtcGxhdGVEaXJlY3RpdmVBc3RzID0gdGhpcy5fY3JlYXRlRGlyZWN0aXZlQXN0cyhcbiAgICAgICAgICB0cnVlLCBlbE5hbWUsIGRpcmVjdGl2ZXMsIHRlbXBsYXRlRWxlbWVudE9yRGlyZWN0aXZlUHJvcHMsIFtdLCBlbGVtZW50LnNvdXJjZVNwYW4hLCBbXSxcbiAgICAgICAgICB0ZW1wbGF0ZUJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRWxlbWVudFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10gPSB0aGlzLl9jcmVhdGVFbGVtZW50UHJvcGVydHlBc3RzKFxuICAgICAgICAgIGVsTmFtZSwgdGVtcGxhdGVFbGVtZW50T3JEaXJlY3RpdmVQcm9wcywgdGVtcGxhdGVCb3VuZERpcmVjdGl2ZVByb3BOYW1lcyk7XG4gICAgICB0aGlzLl9hc3NlcnROb0NvbXBvbmVudHNOb3JFbGVtZW50QmluZGluZ3NPblRlbXBsYXRlKFxuICAgICAgICAgIHRlbXBsYXRlRGlyZWN0aXZlQXN0cywgdGVtcGxhdGVFbGVtZW50UHJvcHMsIGVsZW1lbnQuc291cmNlU3BhbiEpO1xuICAgICAgY29uc3QgdGVtcGxhdGVQcm92aWRlckNvbnRleHQgPSBuZXcgUHJvdmlkZXJFbGVtZW50Q29udGV4dChcbiAgICAgICAgICB0aGlzLnByb3ZpZGVyVmlld0NvbnRleHQsIHBhcmVudC5wcm92aWRlckNvbnRleHQhLCBwYXJlbnQuaXNUZW1wbGF0ZUVsZW1lbnQsXG4gICAgICAgICAgdGVtcGxhdGVEaXJlY3RpdmVBc3RzLCBbXSwgW10sIHRydWUsIHRlbXBsYXRlUXVlcnlTdGFydEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4hKTtcbiAgICAgIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LmFmdGVyRWxlbWVudCgpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRW1iZWRkZWRUZW1wbGF0ZUFzdChcbiAgICAgICAgICBbXSwgW10sIFtdLCB0ZW1wbGF0ZUVsZW1lbnRWYXJzLCB0ZW1wbGF0ZVByb3ZpZGVyQ29udGV4dC50cmFuc2Zvcm1lZERpcmVjdGl2ZUFzdHMsXG4gICAgICAgICAgdGVtcGxhdGVQcm92aWRlckNvbnRleHQudHJhbnNmb3JtUHJvdmlkZXJzLFxuICAgICAgICAgIHRlbXBsYXRlUHJvdmlkZXJDb250ZXh0LnRyYW5zZm9ybWVkSGFzVmlld0NvbnRhaW5lciwgdGVtcGxhdGVQcm92aWRlckNvbnRleHQucXVlcnlNYXRjaGVzLFxuICAgICAgICAgIFtwYXJzZWRFbGVtZW50XSwgbmdDb250ZW50SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiEpO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJzZWRFbGVtZW50O1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VBdHRyKFxuICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIGF0dHI6IGh0bWwuQXR0cmlidXRlLCB0YXJnZXRNYXRjaGFibGVBdHRyczogc3RyaW5nW11bXSxcbiAgICAgIHRhcmdldFByb3BzOiBQYXJzZWRQcm9wZXJ0eVtdLCB0YXJnZXRFdmVudHM6IHQuQm91bmRFdmVudEFzdFtdLFxuICAgICAgdGFyZ2V0UmVmczogRWxlbWVudE9yRGlyZWN0aXZlUmVmW10sIHRhcmdldFZhcnM6IHQuVmFyaWFibGVBc3RbXSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLl9ub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHIubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgIGNvbnN0IHNyY1NwYW4gPSBhdHRyLnNvdXJjZVNwYW47XG4gICAgY29uc3QgYWJzb2x1dGVPZmZzZXQgPSBhdHRyLnZhbHVlU3BhbiA/IGF0dHIudmFsdWVTcGFuLnN0YXJ0Lm9mZnNldCA6IHNyY1NwYW4uc3RhcnQub2Zmc2V0O1xuXG4gICAgY29uc3QgYm91bmRFdmVudHM6IFBhcnNlZEV2ZW50W10gPSBbXTtcbiAgICBjb25zdCBiaW5kUGFydHMgPSBuYW1lLm1hdGNoKEJJTkRfTkFNRV9SRUdFWFApO1xuICAgIGxldCBoYXNCaW5kaW5nID0gZmFsc2U7XG5cbiAgICBpZiAoYmluZFBhcnRzICE9PSBudWxsKSB7XG4gICAgICBoYXNCaW5kaW5nID0gdHJ1ZTtcbiAgICAgIGlmIChiaW5kUGFydHNbS1dfQklORF9JRFhdICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0xFVF9JRFhdKSB7XG4gICAgICAgIGlmIChpc1RlbXBsYXRlRWxlbWVudCkge1xuICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBiaW5kUGFydHNbSURFTlRfS1dfSURYXTtcbiAgICAgICAgICB0aGlzLl9wYXJzZVZhcmlhYmxlKGlkZW50aWZpZXIsIHZhbHVlLCBzcmNTcGFuLCB0YXJnZXRWYXJzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCJsZXQtXCIgaXMgb25seSBzdXBwb3J0ZWQgb24gbmctdGVtcGxhdGUgZWxlbWVudHMuYCwgc3JjU3Bhbik7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfUkVGX0lEWF0pIHtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICB0aGlzLl9wYXJzZVJlZmVyZW5jZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgdGFyZ2V0UmVmcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX09OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQklORE9OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5fYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICAgIHRoaXMuX3BhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIGJvdW5kRXZlbnRzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQVRfSURYXSkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHIudmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycyxcbiAgICAgICAgICAgIHRhcmdldFByb3BzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LCBhdHRyLnZhbHVlU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCB0YXJnZXRQcm9wcyk7XG4gICAgICAgIHRoaXMuX3BhcnNlQXNzaWdubWVudEV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0JBTkFOQV9CT1hfSURYXSwgdmFsdWUsIHNyY1NwYW4sIGF0dHIudmFsdWVTcGFuIHx8IHNyY1NwYW4sXG4gICAgICAgICAgICB0YXJnZXRNYXRjaGFibGVBdHRycywgYm91bmRFdmVudHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBiaW5kUGFydHNbSURFTlRfUFJPUEVSVFlfSURYXSwgdmFsdWUsIGZhbHNlLCBzcmNTcGFuLCBhYnNvbHV0ZU9mZnNldCwgYXR0ci52YWx1ZVNwYW4sXG4gICAgICAgICAgICB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9FVkVOVF9JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0ci52YWx1ZVNwYW4gfHwgc3JjU3BhbixcbiAgICAgICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhc0JpbmRpbmcgPSB0aGlzLl9iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlJbnRlcnBvbGF0aW9uKFxuICAgICAgICAgIG5hbWUsIHZhbHVlLCBzcmNTcGFuLCBhdHRyLnZhbHVlU3BhbiwgdGFyZ2V0TWF0Y2hhYmxlQXR0cnMsIHRhcmdldFByb3BzKTtcbiAgICB9XG5cbiAgICBpZiAoIWhhc0JpbmRpbmcpIHtcbiAgICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VMaXRlcmFsQXR0cihcbiAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHIudmFsdWVTcGFuLCB0YXJnZXRNYXRjaGFibGVBdHRycywgdGFyZ2V0UHJvcHMpO1xuICAgIH1cblxuICAgIHRhcmdldEV2ZW50cy5wdXNoKC4uLmJvdW5kRXZlbnRzLm1hcChlID0+IHQuQm91bmRFdmVudEFzdC5mcm9tUGFyc2VkRXZlbnQoZSkpKTtcblxuICAgIHJldHVybiBoYXNCaW5kaW5nO1xuICB9XG5cbiAgcHJpdmF0ZSBfbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gL15kYXRhLS9pLnRlc3QoYXR0ck5hbWUpID8gYXR0ck5hbWUuc3Vic3RyaW5nKDUpIDogYXR0ck5hbWU7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZVZhcmlhYmxlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHRhcmdldFZhcnM6IHQuVmFyaWFibGVBc3RbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gdmFyaWFibGUgbmFtZXNgLCBzb3VyY2VTcGFuKTtcbiAgICB9IGVsc2UgaWYgKGlkZW50aWZpZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgVmFyaWFibGUgZG9lcyBub3QgaGF2ZSBhIG5hbWVgLCBzb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICB0YXJnZXRWYXJzLnB1c2gobmV3IHQuVmFyaWFibGVBc3QoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlUmVmZXJlbmNlKFxuICAgICAgaWRlbnRpZmllcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB0YXJnZXRSZWZzOiBFbGVtZW50T3JEaXJlY3RpdmVSZWZbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihgXCItXCIgaXMgbm90IGFsbG93ZWQgaW4gcmVmZXJlbmNlIG5hbWVzYCwgc291cmNlU3Bhbik7XG4gICAgfSBlbHNlIGlmIChpZGVudGlmaWVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoYFJlZmVyZW5jZSBkb2VzIG5vdCBoYXZlIGEgbmFtZWAsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHRhcmdldFJlZnMucHVzaChuZXcgRWxlbWVudE9yRGlyZWN0aXZlUmVmKGlkZW50aWZpZXIsIHZhbHVlLCBzb3VyY2VTcGFuKSk7XG4gIH1cblxuICBwcml2YXRlIF9wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIHZhbHVlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdGFyZ2V0TWF0Y2hhYmxlQXR0cnM6IHN0cmluZ1tdW10sIHRhcmdldEV2ZW50czogUGFyc2VkRXZlbnRbXSkge1xuICAgIHRoaXMuX2JpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgYCR7bmFtZX1DaGFuZ2VgLCBgJHtleHByZXNzaW9ufT0kZXZlbnRgLCBzb3VyY2VTcGFuLCB2YWx1ZVNwYW4sIHRhcmdldE1hdGNoYWJsZUF0dHJzLFxuICAgICAgICB0YXJnZXRFdmVudHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcGFyc2VEaXJlY3RpdmVzKHNlbGVjdG9yTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyLCBlbGVtZW50Q3NzU2VsZWN0b3I6IENzc1NlbGVjdG9yKTpcbiAgICAgIHtkaXJlY3RpdmVzOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeVtdLCBtYXRjaEVsZW1lbnQ6IGJvb2xlYW59IHtcbiAgICAvLyBOZWVkIHRvIHNvcnQgdGhlIGRpcmVjdGl2ZXMgc28gdGhhdCB3ZSBnZXQgY29uc2lzdGVudCByZXN1bHRzIHRocm91Z2hvdXQsXG4gICAgLy8gYXMgc2VsZWN0b3JNYXRjaGVyIHVzZXMgTWFwcyBpbnNpZGUuXG4gICAgLy8gQWxzbyBkZWR1cGxpY2F0ZSBkaXJlY3RpdmVzIGFzIHRoZXkgbWlnaHQgbWF0Y2ggbW9yZSB0aGFuIG9uZSB0aW1lIVxuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXdBcnJheSh0aGlzLmRpcmVjdGl2ZXNJbmRleC5zaXplKTtcbiAgICAvLyBXaGV0aGVyIGFueSBkaXJlY3RpdmUgc2VsZWN0b3IgbWF0Y2hlcyBvbiB0aGUgZWxlbWVudCBuYW1lXG4gICAgbGV0IG1hdGNoRWxlbWVudCA9IGZhbHNlO1xuXG4gICAgc2VsZWN0b3JNYXRjaGVyLm1hdGNoKGVsZW1lbnRDc3NTZWxlY3RvciwgKHNlbGVjdG9yLCBkaXJlY3RpdmUpID0+IHtcbiAgICAgIGRpcmVjdGl2ZXNbdGhpcy5kaXJlY3RpdmVzSW5kZXguZ2V0KGRpcmVjdGl2ZSkhXSA9IGRpcmVjdGl2ZTtcbiAgICAgIG1hdGNoRWxlbWVudCA9IG1hdGNoRWxlbWVudCB8fCBzZWxlY3Rvci5oYXNFbGVtZW50U2VsZWN0b3IoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBkaXJlY3RpdmVzOiBkaXJlY3RpdmVzLmZpbHRlcihkaXIgPT4gISFkaXIpLFxuICAgICAgbWF0Y2hFbGVtZW50LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVEaXJlY3RpdmVBc3RzKFxuICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIGVsZW1lbnROYW1lOiBzdHJpbmcsIGRpcmVjdGl2ZXM6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5W10sXG4gICAgICBwcm9wczogUGFyc2VkUHJvcGVydHlbXSwgZWxlbWVudE9yRGlyZWN0aXZlUmVmczogRWxlbWVudE9yRGlyZWN0aXZlUmVmW10sXG4gICAgICBlbGVtZW50U291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCB0YXJnZXRSZWZlcmVuY2VzOiB0LlJlZmVyZW5jZUFzdFtdLFxuICAgICAgdGFyZ2V0Qm91bmREaXJlY3RpdmVQcm9wTmFtZXM6IFNldDxzdHJpbmc+KTogdC5EaXJlY3RpdmVBc3RbXSB7XG4gICAgY29uc3QgbWF0Y2hlZFJlZmVyZW5jZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBsZXQgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSA9IG51bGwhO1xuXG4gICAgY29uc3QgZGlyZWN0aXZlQXN0cyA9IGRpcmVjdGl2ZXMubWFwKChkaXJlY3RpdmUpID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKFxuICAgICAgICAgIGVsZW1lbnRTb3VyY2VTcGFuLnN0YXJ0LCBlbGVtZW50U291cmNlU3Bhbi5lbmQsXG4gICAgICAgICAgYERpcmVjdGl2ZSAke2lkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS50eXBlKX1gKTtcblxuICAgICAgaWYgKGRpcmVjdGl2ZS5pc0NvbXBvbmVudCkge1xuICAgICAgICBjb21wb25lbnQgPSBkaXJlY3RpdmU7XG4gICAgICB9XG4gICAgICBjb25zdCBkaXJlY3RpdmVQcm9wZXJ0aWVzOiB0LkJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3RbXSA9IFtdO1xuICAgICAgY29uc3QgYm91bmRQcm9wZXJ0aWVzID1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RQcm9wZXJ0eUFzdHMoZGlyZWN0aXZlLCBlbGVtZW50TmFtZSwgc291cmNlU3BhbikhO1xuXG4gICAgICBsZXQgaG9zdFByb3BlcnRpZXMgPVxuICAgICAgICAgIGJvdW5kUHJvcGVydGllcy5tYXAocHJvcCA9PiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0LmZyb21Cb3VuZFByb3BlcnR5KHByb3ApKTtcbiAgICAgIC8vIE5vdGU6IFdlIG5lZWQgdG8gY2hlY2sgdGhlIGhvc3QgcHJvcGVydGllcyBoZXJlIGFzIHdlbGwsXG4gICAgICAvLyBhcyB3ZSBkb24ndCBrbm93IHRoZSBlbGVtZW50IG5hbWUgaW4gdGhlIERpcmVjdGl2ZVdyYXBwZXJDb21waWxlciB5ZXQuXG4gICAgICBob3N0UHJvcGVydGllcyA9IHRoaXMuX2NoZWNrUHJvcGVydGllc0luU2NoZW1hKGVsZW1lbnROYW1lLCBob3N0UHJvcGVydGllcyk7XG4gICAgICBjb25zdCBwYXJzZWRFdmVudHMgPSB0aGlzLl9iaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyZWN0aXZlLCBzb3VyY2VTcGFuKSE7XG4gICAgICB0aGlzLl9jcmVhdGVEaXJlY3RpdmVQcm9wZXJ0eUFzdHMoXG4gICAgICAgICAgZGlyZWN0aXZlLmlucHV0cywgcHJvcHMsIGRpcmVjdGl2ZVByb3BlcnRpZXMsIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzKTtcbiAgICAgIGVsZW1lbnRPckRpcmVjdGl2ZVJlZnMuZm9yRWFjaCgoZWxPckRpclJlZikgPT4ge1xuICAgICAgICBpZiAoKGVsT3JEaXJSZWYudmFsdWUubGVuZ3RoID09PSAwICYmIGRpcmVjdGl2ZS5pc0NvbXBvbmVudCkgfHxcbiAgICAgICAgICAgIChlbE9yRGlyUmVmLmlzUmVmZXJlbmNlVG9EaXJlY3RpdmUoZGlyZWN0aXZlKSkpIHtcbiAgICAgICAgICB0YXJnZXRSZWZlcmVuY2VzLnB1c2gobmV3IHQuUmVmZXJlbmNlQXN0KFxuICAgICAgICAgICAgICBlbE9yRGlyUmVmLm5hbWUsIGNyZWF0ZVRva2VuRm9yUmVmZXJlbmNlKGRpcmVjdGl2ZS50eXBlLnJlZmVyZW5jZSksIGVsT3JEaXJSZWYudmFsdWUsXG4gICAgICAgICAgICAgIGVsT3JEaXJSZWYuc291cmNlU3BhbikpO1xuICAgICAgICAgIG1hdGNoZWRSZWZlcmVuY2VzLmFkZChlbE9yRGlyUmVmLm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGhvc3RFdmVudHMgPSBwYXJzZWRFdmVudHMubWFwKGUgPT4gdC5Cb3VuZEV2ZW50QXN0LmZyb21QYXJzZWRFdmVudChlKSk7XG4gICAgICBjb25zdCBjb250ZW50UXVlcnlTdGFydElkID0gdGhpcy5jb250ZW50UXVlcnlTdGFydElkO1xuICAgICAgdGhpcy5jb250ZW50UXVlcnlTdGFydElkICs9IGRpcmVjdGl2ZS5xdWVyaWVzLmxlbmd0aDtcbiAgICAgIHJldHVybiBuZXcgdC5EaXJlY3RpdmVBc3QoXG4gICAgICAgICAgZGlyZWN0aXZlLCBkaXJlY3RpdmVQcm9wZXJ0aWVzLCBob3N0UHJvcGVydGllcywgaG9zdEV2ZW50cywgY29udGVudFF1ZXJ5U3RhcnRJZCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9KTtcblxuICAgIGVsZW1lbnRPckRpcmVjdGl2ZVJlZnMuZm9yRWFjaCgoZWxPckRpclJlZikgPT4ge1xuICAgICAgaWYgKGVsT3JEaXJSZWYudmFsdWUubGVuZ3RoID4gMCkge1xuICAgICAgICBpZiAoIW1hdGNoZWRSZWZlcmVuY2VzLmhhcyhlbE9yRGlyUmVmLm5hbWUpKSB7XG4gICAgICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBUaGVyZSBpcyBubyBkaXJlY3RpdmUgd2l0aCBcImV4cG9ydEFzXCIgc2V0IHRvIFwiJHtlbE9yRGlyUmVmLnZhbHVlfVwiYCxcbiAgICAgICAgICAgICAgZWxPckRpclJlZi5zb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghY29tcG9uZW50KSB7XG4gICAgICAgIGxldCByZWZUb2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGEgPSBudWxsITtcbiAgICAgICAgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAgICAgcmVmVG9rZW4gPSBjcmVhdGVUb2tlbkZvckV4dGVybmFsUmVmZXJlbmNlKHRoaXMucmVmbGVjdG9yLCBJZGVudGlmaWVycy5UZW1wbGF0ZVJlZik7XG4gICAgICAgIH1cbiAgICAgICAgdGFyZ2V0UmVmZXJlbmNlcy5wdXNoKFxuICAgICAgICAgICAgbmV3IHQuUmVmZXJlbmNlQXN0KGVsT3JEaXJSZWYubmFtZSwgcmVmVG9rZW4sIGVsT3JEaXJSZWYudmFsdWUsIGVsT3JEaXJSZWYuc291cmNlU3BhbikpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkaXJlY3RpdmVBc3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRGlyZWN0aXZlUHJvcGVydHlBc3RzKFxuICAgICAgZGlyZWN0aXZlUHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sIGJvdW5kUHJvcHM6IFBhcnNlZFByb3BlcnR5W10sXG4gICAgICB0YXJnZXRCb3VuZERpcmVjdGl2ZVByb3BzOiB0LkJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3RbXSxcbiAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzOiBTZXQ8c3RyaW5nPikge1xuICAgIGlmIChkaXJlY3RpdmVQcm9wZXJ0aWVzKSB7XG4gICAgICBjb25zdCBib3VuZFByb3BzQnlOYW1lID0gbmV3IE1hcDxzdHJpbmcsIFBhcnNlZFByb3BlcnR5PigpO1xuICAgICAgYm91bmRQcm9wcy5mb3JFYWNoKGJvdW5kUHJvcCA9PiB7XG4gICAgICAgIGNvbnN0IHByZXZWYWx1ZSA9IGJvdW5kUHJvcHNCeU5hbWUuZ2V0KGJvdW5kUHJvcC5uYW1lKTtcbiAgICAgICAgaWYgKCFwcmV2VmFsdWUgfHwgcHJldlZhbHVlLmlzTGl0ZXJhbCkge1xuICAgICAgICAgIC8vIGdpdmUgW2FdPVwiYlwiIGEgaGlnaGVyIHByZWNlZGVuY2UgdGhhbiBhPVwiYlwiIG9uIHRoZSBzYW1lIGVsZW1lbnRcbiAgICAgICAgICBib3VuZFByb3BzQnlOYW1lLnNldChib3VuZFByb3AubmFtZSwgYm91bmRQcm9wKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIE9iamVjdC5rZXlzKGRpcmVjdGl2ZVByb3BlcnRpZXMpLmZvckVhY2goZGlyUHJvcCA9PiB7XG4gICAgICAgIGNvbnN0IGVsUHJvcCA9IGRpcmVjdGl2ZVByb3BlcnRpZXNbZGlyUHJvcF07XG4gICAgICAgIGNvbnN0IGJvdW5kUHJvcCA9IGJvdW5kUHJvcHNCeU5hbWUuZ2V0KGVsUHJvcCk7XG5cbiAgICAgICAgLy8gQmluZGluZ3MgYXJlIG9wdGlvbmFsLCBzbyB0aGlzIGJpbmRpbmcgb25seSBuZWVkcyB0byBiZSBzZXQgdXAgaWYgYW4gZXhwcmVzc2lvbiBpcyBnaXZlbi5cbiAgICAgICAgaWYgKGJvdW5kUHJvcCkge1xuICAgICAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzLmFkZChib3VuZFByb3AubmFtZSk7XG4gICAgICAgICAgaWYgKCFpc0VtcHR5RXhwcmVzc2lvbihib3VuZFByb3AuZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICAgIHRhcmdldEJvdW5kRGlyZWN0aXZlUHJvcHMucHVzaChuZXcgdC5Cb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0KFxuICAgICAgICAgICAgICAgIGRpclByb3AsIGJvdW5kUHJvcC5uYW1lLCBib3VuZFByb3AuZXhwcmVzc2lvbiwgYm91bmRQcm9wLnNvdXJjZVNwYW4pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZUVsZW1lbnRQcm9wZXJ0eUFzdHMoXG4gICAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBwcm9wczogUGFyc2VkUHJvcGVydHlbXSxcbiAgICAgIGJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzOiBTZXQ8c3RyaW5nPik6IHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSB7XG4gICAgY29uc3QgYm91bmRFbGVtZW50UHJvcHM6IHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSA9IFtdO1xuXG4gICAgcHJvcHMuZm9yRWFjaCgocHJvcDogUGFyc2VkUHJvcGVydHkpID0+IHtcbiAgICAgIGlmICghcHJvcC5pc0xpdGVyYWwgJiYgIWJvdW5kRGlyZWN0aXZlUHJvcE5hbWVzLmhhcyhwcm9wLm5hbWUpKSB7XG4gICAgICAgIGNvbnN0IGJvdW5kUHJvcCA9IHRoaXMuX2JpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoZWxlbWVudE5hbWUsIHByb3ApO1xuICAgICAgICBib3VuZEVsZW1lbnRQcm9wcy5wdXNoKHQuQm91bmRFbGVtZW50UHJvcGVydHlBc3QuZnJvbUJvdW5kUHJvcGVydHkoYm91bmRQcm9wKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuX2NoZWNrUHJvcGVydGllc0luU2NoZW1hKGVsZW1lbnROYW1lLCBib3VuZEVsZW1lbnRQcm9wcyk7XG4gIH1cblxuICBwcml2YXRlIF9maW5kQ29tcG9uZW50RGlyZWN0aXZlcyhkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdKTogdC5EaXJlY3RpdmVBc3RbXSB7XG4gICAgcmV0dXJuIGRpcmVjdGl2ZXMuZmlsdGVyKGRpcmVjdGl2ZSA9PiBkaXJlY3RpdmUuZGlyZWN0aXZlLmlzQ29tcG9uZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRDb21wb25lbnREaXJlY3RpdmVOYW1lcyhkaXJlY3RpdmVzOiB0LkRpcmVjdGl2ZUFzdFtdKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLl9maW5kQ29tcG9uZW50RGlyZWN0aXZlcyhkaXJlY3RpdmVzKVxuICAgICAgICAubWFwKGRpcmVjdGl2ZSA9PiBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUuZGlyZWN0aXZlLnR5cGUpISk7XG4gIH1cblxuICBwcml2YXRlIF9hc3NlcnRPbmx5T25lQ29tcG9uZW50KGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge1xuICAgIGNvbnN0IGNvbXBvbmVudFR5cGVOYW1lcyA9IHRoaXMuX2ZpbmRDb21wb25lbnREaXJlY3RpdmVOYW1lcyhkaXJlY3RpdmVzKTtcbiAgICBpZiAoY29tcG9uZW50VHlwZU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBNb3JlIHRoYW4gb25lIGNvbXBvbmVudCBtYXRjaGVkIG9uIHRoaXMgZWxlbWVudC5cXG5gICtcbiAgICAgICAgICAgICAgYE1ha2Ugc3VyZSB0aGF0IG9ubHkgb25lIGNvbXBvbmVudCdzIHNlbGVjdG9yIGNhbiBtYXRjaCBhIGdpdmVuIGVsZW1lbnQuXFxuYCArXG4gICAgICAgICAgICAgIGBDb25mbGljdGluZyBjb21wb25lbnRzOiAke2NvbXBvbmVudFR5cGVOYW1lcy5qb2luKCcsJyl9YCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWFrZSBzdXJlIHRoYXQgbm9uLWFuZ3VsYXIgdGFncyBjb25mb3JtIHRvIHRoZSBzY2hlbWFzLlxuICAgKlxuICAgKiBOb3RlOiBBbiBlbGVtZW50IGlzIGNvbnNpZGVyZWQgYW4gYW5ndWxhciB0YWcgd2hlbiBhdCBsZWFzdCBvbmUgZGlyZWN0aXZlIHNlbGVjdG9yIG1hdGNoZXMgdGhlXG4gICAqIHRhZyBuYW1lLlxuICAgKlxuICAgKiBAcGFyYW0gbWF0Y2hFbGVtZW50IFdoZXRoZXIgYW55IGRpcmVjdGl2ZSBoYXMgbWF0Y2hlZCBvbiB0aGUgdGFnIG5hbWVcbiAgICogQHBhcmFtIGVsZW1lbnQgdGhlIGh0bWwgZWxlbWVudFxuICAgKi9cbiAgcHJpdmF0ZSBfYXNzZXJ0RWxlbWVudEV4aXN0cyhtYXRjaEVsZW1lbnQ6IGJvb2xlYW4sIGVsZW1lbnQ6IGh0bWwuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsTmFtZSA9IGVsZW1lbnQubmFtZS5yZXBsYWNlKC9eOnhodG1sOi8sICcnKTtcblxuICAgIGlmICghbWF0Y2hFbGVtZW50ICYmICF0aGlzLl9zY2hlbWFSZWdpc3RyeS5oYXNFbGVtZW50KGVsTmFtZSwgdGhpcy5fc2NoZW1hcykpIHtcbiAgICAgIGxldCBlcnJvck1zZyA9IGAnJHtlbE5hbWV9JyBpcyBub3QgYSBrbm93biBlbGVtZW50OlxcbmA7XG4gICAgICBlcnJvck1zZyArPSBgMS4gSWYgJyR7XG4gICAgICAgICAgZWxOYW1lfScgaXMgYW4gQW5ndWxhciBjb21wb25lbnQsIHRoZW4gdmVyaWZ5IHRoYXQgaXQgaXMgcGFydCBvZiB0aGlzIG1vZHVsZS5cXG5gO1xuICAgICAgaWYgKGVsTmFtZS5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgICBlcnJvck1zZyArPSBgMi4gSWYgJyR7XG4gICAgICAgICAgICBlbE5hbWV9JyBpcyBhIFdlYiBDb21wb25lbnQgdGhlbiBhZGQgJ0NVU1RPTV9FTEVNRU5UU19TQ0hFTUEnIHRvIHRoZSAnQE5nTW9kdWxlLnNjaGVtYXMnIG9mIHRoaXMgY29tcG9uZW50IHRvIHN1cHByZXNzIHRoaXMgbWVzc2FnZS5gO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXJyb3JNc2cgKz1cbiAgICAgICAgICAgIGAyLiBUbyBhbGxvdyBhbnkgZWxlbWVudCBhZGQgJ05PX0VSUk9SU19TQ0hFTUEnIHRvIHRoZSAnQE5nTW9kdWxlLnNjaGVtYXMnIG9mIHRoaXMgY29tcG9uZW50LmA7XG4gICAgICB9XG4gICAgICB0aGlzLl9yZXBvcnRFcnJvcihlcnJvck1zZywgZWxlbWVudC5zb3VyY2VTcGFuISk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXNzZXJ0Tm9Db21wb25lbnRzTm9yRWxlbWVudEJpbmRpbmdzT25UZW1wbGF0ZShcbiAgICAgIGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10sIGVsZW1lbnRQcm9wczogdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdLFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7XG4gICAgY29uc3QgY29tcG9uZW50VHlwZU5hbWVzOiBzdHJpbmdbXSA9IHRoaXMuX2ZpbmRDb21wb25lbnREaXJlY3RpdmVOYW1lcyhkaXJlY3RpdmVzKTtcbiAgICBpZiAoY29tcG9uZW50VHlwZU5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgIGBDb21wb25lbnRzIG9uIGFuIGVtYmVkZGVkIHRlbXBsYXRlOiAke2NvbXBvbmVudFR5cGVOYW1lcy5qb2luKCcsJyl9YCwgc291cmNlU3Bhbik7XG4gICAgfVxuICAgIGVsZW1lbnRQcm9wcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgdGhpcy5fcmVwb3J0RXJyb3IoXG4gICAgICAgICAgYFByb3BlcnR5IGJpbmRpbmcgJHtcbiAgICAgICAgICAgICAgcHJvcC5uYW1lfSBub3QgdXNlZCBieSBhbnkgZGlyZWN0aXZlIG9uIGFuIGVtYmVkZGVkIHRlbXBsYXRlLiBNYWtlIHN1cmUgdGhhdCB0aGUgcHJvcGVydHkgbmFtZSBpcyBzcGVsbGVkIGNvcnJlY3RseSBhbmQgYWxsIGRpcmVjdGl2ZXMgYXJlIGxpc3RlZCBpbiB0aGUgXCJATmdNb2R1bGUuZGVjbGFyYXRpb25zXCIuYCxcbiAgICAgICAgICBzb3VyY2VTcGFuKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2Fzc2VydEFsbEV2ZW50c1B1Ymxpc2hlZEJ5RGlyZWN0aXZlcyhcbiAgICAgIGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10sIGV2ZW50czogdC5Cb3VuZEV2ZW50QXN0W10pIHtcbiAgICBjb25zdCBhbGxEaXJlY3RpdmVFdmVudHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGRpcmVjdGl2ZXMuZm9yRWFjaChkaXJlY3RpdmUgPT4ge1xuICAgICAgT2JqZWN0LmtleXMoZGlyZWN0aXZlLmRpcmVjdGl2ZS5vdXRwdXRzKS5mb3JFYWNoKGsgPT4ge1xuICAgICAgICBjb25zdCBldmVudE5hbWUgPSBkaXJlY3RpdmUuZGlyZWN0aXZlLm91dHB1dHNba107XG4gICAgICAgIGFsbERpcmVjdGl2ZUV2ZW50cy5hZGQoZXZlbnROYW1lKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZXZlbnRzLmZvckVhY2goZXZlbnQgPT4ge1xuICAgICAgaWYgKGV2ZW50LnRhcmdldCAhPSBudWxsIHx8ICFhbGxEaXJlY3RpdmVFdmVudHMuaGFzKGV2ZW50Lm5hbWUpKSB7XG4gICAgICAgIHRoaXMuX3JlcG9ydEVycm9yKFxuICAgICAgICAgICAgYEV2ZW50IGJpbmRpbmcgJHtcbiAgICAgICAgICAgICAgICBldmVudFxuICAgICAgICAgICAgICAgICAgICAuZnVsbE5hbWV9IG5vdCBlbWl0dGVkIGJ5IGFueSBkaXJlY3RpdmUgb24gYW4gZW1iZWRkZWQgdGVtcGxhdGUuIE1ha2Ugc3VyZSB0aGF0IHRoZSBldmVudCBuYW1lIGlzIHNwZWxsZWQgY29ycmVjdGx5IGFuZCBhbGwgZGlyZWN0aXZlcyBhcmUgbGlzdGVkIGluIHRoZSBcIkBOZ01vZHVsZS5kZWNsYXJhdGlvbnNcIi5gLFxuICAgICAgICAgICAgZXZlbnQuc291cmNlU3Bhbik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9jaGVja1Byb3BlcnRpZXNJblNjaGVtYShlbGVtZW50TmFtZTogc3RyaW5nLCBib3VuZFByb3BzOiB0LkJvdW5kRWxlbWVudFByb3BlcnR5QXN0W10pOlxuICAgICAgdC5Cb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdFtdIHtcbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBmaWx0ZXIgb3V0IGVtcHR5IGV4cHJlc3Npb25zIGJlZm9yZSB0aGlzIG1ldGhvZCxcbiAgICAvLyBhcyB3ZSBzdGlsbCB3YW50IHRvIHZhbGlkYXRlIHRoZW0hXG4gICAgcmV0dXJuIGJvdW5kUHJvcHMuZmlsdGVyKChib3VuZFByb3ApID0+IHtcbiAgICAgIGlmIChib3VuZFByb3AudHlwZSA9PT0gdC5Qcm9wZXJ0eUJpbmRpbmdUeXBlLlByb3BlcnR5ICYmXG4gICAgICAgICAgIXRoaXMuX3NjaGVtYVJlZ2lzdHJ5Lmhhc1Byb3BlcnR5KGVsZW1lbnROYW1lLCBib3VuZFByb3AubmFtZSwgdGhpcy5fc2NoZW1hcykpIHtcbiAgICAgICAgbGV0IGVycm9yTXNnID0gYENhbid0IGJpbmQgdG8gJyR7Ym91bmRQcm9wLm5hbWV9JyBzaW5jZSBpdCBpc24ndCBhIGtub3duIHByb3BlcnR5IG9mICcke1xuICAgICAgICAgICAgZWxlbWVudE5hbWV9Jy5gO1xuICAgICAgICBpZiAoZWxlbWVudE5hbWUuc3RhcnRzV2l0aCgnbmctJykpIHtcbiAgICAgICAgICBlcnJvck1zZyArPVxuICAgICAgICAgICAgICBgXFxuMS4gSWYgJyR7XG4gICAgICAgICAgICAgICAgICBib3VuZFByb3BcbiAgICAgICAgICAgICAgICAgICAgICAubmFtZX0nIGlzIGFuIEFuZ3VsYXIgZGlyZWN0aXZlLCB0aGVuIGFkZCAnQ29tbW9uTW9kdWxlJyB0byB0aGUgJ0BOZ01vZHVsZS5pbXBvcnRzJyBvZiB0aGlzIGNvbXBvbmVudC5gICtcbiAgICAgICAgICAgICAgYFxcbjIuIFRvIGFsbG93IGFueSBwcm9wZXJ0eSBhZGQgJ05PX0VSUk9SU19TQ0hFTUEnIHRvIHRoZSAnQE5nTW9kdWxlLnNjaGVtYXMnIG9mIHRoaXMgY29tcG9uZW50LmA7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudE5hbWUuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgICAgICBlcnJvck1zZyArPVxuICAgICAgICAgICAgICBgXFxuMS4gSWYgJyR7ZWxlbWVudE5hbWV9JyBpcyBhbiBBbmd1bGFyIGNvbXBvbmVudCBhbmQgaXQgaGFzICcke1xuICAgICAgICAgICAgICAgICAgYm91bmRQcm9wLm5hbWV9JyBpbnB1dCwgdGhlbiB2ZXJpZnkgdGhhdCBpdCBpcyBwYXJ0IG9mIHRoaXMgbW9kdWxlLmAgK1xuICAgICAgICAgICAgICBgXFxuMi4gSWYgJyR7XG4gICAgICAgICAgICAgICAgICBlbGVtZW50TmFtZX0nIGlzIGEgV2ViIENvbXBvbmVudCB0aGVuIGFkZCAnQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQgdG8gc3VwcHJlc3MgdGhpcyBtZXNzYWdlLmAgK1xuICAgICAgICAgICAgICBgXFxuMy4gVG8gYWxsb3cgYW55IHByb3BlcnR5IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gdGhlICdATmdNb2R1bGUuc2NoZW1hcycgb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9yZXBvcnRFcnJvcihlcnJvck1zZywgYm91bmRQcm9wLnNvdXJjZVNwYW4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuICFpc0VtcHR5RXhwcmVzc2lvbihib3VuZFByb3AudmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLl90YXJnZXRFcnJvcnMucHVzaChuZXcgUGFyc2VFcnJvcihzb3VyY2VTcGFuLCBtZXNzYWdlLCBsZXZlbCkpO1xuICB9XG59XG5cbmNsYXNzIE5vbkJpbmRhYmxlVmlzaXRvciBpbXBsZW1lbnRzIGh0bWwuVmlzaXRvciB7XG4gIHZpc2l0RWxlbWVudChhc3Q6IGh0bWwuRWxlbWVudCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IHQuRWxlbWVudEFzdHxudWxsIHtcbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGFzdCk7XG4gICAgaWYgKHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU0NSSVBUIHx8XG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEUgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRVNIRUVUKSB7XG4gICAgICAvLyBTa2lwcGluZyA8c2NyaXB0PiBmb3Igc2VjdXJpdHkgcmVhc29uc1xuICAgICAgLy8gU2tpcHBpbmcgPHN0eWxlPiBhbmQgc3R5bGVzaGVldHMgYXMgd2UgYWxyZWFkeSBwcm9jZXNzZWQgdGhlbVxuICAgICAgLy8gaW4gdGhlIFN0eWxlQ29tcGlsZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGF0dHJOYW1lQW5kVmFsdWVzID0gYXN0LmF0dHJzLm1hcCgoYXR0cik6IFtzdHJpbmcsIHN0cmluZ10gPT4gW2F0dHIubmFtZSwgYXR0ci52YWx1ZV0pO1xuICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlRWxlbWVudENzc1NlbGVjdG9yKGFzdC5uYW1lLCBhdHRyTmFtZUFuZFZhbHVlcyk7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KHNlbGVjdG9yKTtcbiAgICBjb25zdCBjaGlsZHJlbjogdC5UZW1wbGF0ZUFzdFtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuY2hpbGRyZW4sIEVNUFRZX0VMRU1FTlRfQ09OVEVYVCk7XG4gICAgcmV0dXJuIG5ldyB0LkVsZW1lbnRBc3QoXG4gICAgICAgIGFzdC5uYW1lLCBodG1sLnZpc2l0QWxsKHRoaXMsIGFzdC5hdHRycyksIFtdLCBbXSwgW10sIFtdLCBbXSwgZmFsc2UsIFtdLCBjaGlsZHJlbixcbiAgICAgICAgbmdDb250ZW50SW5kZXgsIGFzdC5zb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG4gIH1cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUsIGNvbnRleHQ6IGFueSk6IHQuQXR0ckFzdCB7XG4gICAgcmV0dXJuIG5ldyB0LkF0dHJBc3QoYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGh0bWwuVGV4dCwgcGFyZW50OiBFbGVtZW50Q29udGV4dCk6IHQuVGV4dEFzdCB7XG4gICAgY29uc3QgbmdDb250ZW50SW5kZXggPSBwYXJlbnQuZmluZE5nQ29udGVudEluZGV4KFRFWFRfQ1NTX1NFTEVDVE9SKCkpITtcbiAgICByZXR1cm4gbmV3IHQuVGV4dEFzdCh0ZXh0LnZhbHVlLCBuZ0NvbnRlbnRJbmRleCwgdGV4dC5zb3VyY2VTcGFuISk7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBleHBhbnNpb247XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBleHBhbnNpb25DYXNlO1xuICB9XG59XG5cbi8qKlxuICogQSByZWZlcmVuY2UgdG8gYW4gZWxlbWVudCBvciBkaXJlY3RpdmUgaW4gYSB0ZW1wbGF0ZS4gRS5nLiwgdGhlIHJlZmVyZW5jZSBpbiB0aGlzIHRlbXBsYXRlOlxuICpcbiAqIDxkaXYgI215TWVudT1cImNvb2xNZW51XCI+XG4gKlxuICogd291bGQgYmUge25hbWU6ICdteU1lbnUnLCB2YWx1ZTogJ2Nvb2xNZW51Jywgc291cmNlU3BhbjogLi4ufVxuICovXG5jbGFzcyBFbGVtZW50T3JEaXJlY3RpdmVSZWYge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IHN0cmluZywgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cblxuICAvKiogR2V0cyB3aGV0aGVyIHRoaXMgaXMgYSByZWZlcmVuY2UgdG8gdGhlIGdpdmVuIGRpcmVjdGl2ZS4gKi9cbiAgaXNSZWZlcmVuY2VUb0RpcmVjdGl2ZShkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5KSB7XG4gICAgcmV0dXJuIHNwbGl0RXhwb3J0QXMoZGlyZWN0aXZlLmV4cG9ydEFzKS5pbmRleE9mKHRoaXMudmFsdWUpICE9PSAtMTtcbiAgfVxufVxuXG4vKiogU3BsaXRzIGEgcmF3LCBwb3RlbnRpYWxseSBjb21tYS1kZWxpbWl0ZWQgYGV4cG9ydEFzYCB2YWx1ZSBpbnRvIGFuIGFycmF5IG9mIG5hbWVzLiAqL1xuZnVuY3Rpb24gc3BsaXRFeHBvcnRBcyhleHBvcnRBczogc3RyaW5nfG51bGwpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBleHBvcnRBcyA/IGV4cG9ydEFzLnNwbGl0KCcsJykubWFwKGUgPT4gZS50cmltKCkpIDogW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGxpdENsYXNzZXMoY2xhc3NBdHRyVmFsdWU6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIGNsYXNzQXR0clZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbn1cblxuY2xhc3MgRWxlbWVudENvbnRleHQge1xuICBzdGF0aWMgY3JlYXRlKFxuICAgICAgaXNUZW1wbGF0ZUVsZW1lbnQ6IGJvb2xlYW4sIGRpcmVjdGl2ZXM6IHQuRGlyZWN0aXZlQXN0W10sXG4gICAgICBwcm92aWRlckNvbnRleHQ6IFByb3ZpZGVyRWxlbWVudENvbnRleHQpOiBFbGVtZW50Q29udGV4dCB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXIoKTtcbiAgICBsZXQgd2lsZGNhcmROZ0NvbnRlbnRJbmRleDogbnVtYmVyID0gbnVsbCE7XG4gICAgY29uc3QgY29tcG9uZW50ID0gZGlyZWN0aXZlcy5maW5kKGRpcmVjdGl2ZSA9PiBkaXJlY3RpdmUuZGlyZWN0aXZlLmlzQ29tcG9uZW50KTtcbiAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICBjb25zdCBuZ0NvbnRlbnRTZWxlY3RvcnMgPSBjb21wb25lbnQuZGlyZWN0aXZlLnRlbXBsYXRlICEubmdDb250ZW50U2VsZWN0b3JzO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZ0NvbnRlbnRTZWxlY3RvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSBuZ0NvbnRlbnRTZWxlY3RvcnNbaV07XG4gICAgICAgIGlmIChzZWxlY3RvciA9PT0gJyonKSB7XG4gICAgICAgICAgd2lsZGNhcmROZ0NvbnRlbnRJbmRleCA9IGk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShuZ0NvbnRlbnRTZWxlY3RvcnNbaV0pLCBpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IEVsZW1lbnRDb250ZXh0KGlzVGVtcGxhdGVFbGVtZW50LCBtYXRjaGVyLCB3aWxkY2FyZE5nQ29udGVudEluZGV4LCBwcm92aWRlckNvbnRleHQpO1xuICB9XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHVibGljIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBwcml2YXRlIF9uZ0NvbnRlbnRJbmRleE1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcixcbiAgICAgIHByaXZhdGUgX3dpbGRjYXJkTmdDb250ZW50SW5kZXg6IG51bWJlcnxudWxsLFxuICAgICAgcHVibGljIHByb3ZpZGVyQ29udGV4dDogUHJvdmlkZXJFbGVtZW50Q29udGV4dHxudWxsKSB7fVxuXG4gIGZpbmROZ0NvbnRlbnRJbmRleChzZWxlY3RvcjogQ3NzU2VsZWN0b3IpOiBudW1iZXJ8bnVsbCB7XG4gICAgY29uc3QgbmdDb250ZW50SW5kaWNlczogbnVtYmVyW10gPSBbXTtcbiAgICB0aGlzLl9uZ0NvbnRlbnRJbmRleE1hdGNoZXIubWF0Y2goc2VsZWN0b3IsIChzZWxlY3RvciwgbmdDb250ZW50SW5kZXgpID0+IHtcbiAgICAgIG5nQ29udGVudEluZGljZXMucHVzaChuZ0NvbnRlbnRJbmRleCk7XG4gICAgfSk7XG4gICAgbmdDb250ZW50SW5kaWNlcy5zb3J0KCk7XG4gICAgaWYgKHRoaXMuX3dpbGRjYXJkTmdDb250ZW50SW5kZXggIT0gbnVsbCkge1xuICAgICAgbmdDb250ZW50SW5kaWNlcy5wdXNoKHRoaXMuX3dpbGRjYXJkTmdDb250ZW50SW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gbmdDb250ZW50SW5kaWNlcy5sZW5ndGggPiAwID8gbmdDb250ZW50SW5kaWNlc1swXSA6IG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnRDc3NTZWxlY3RvcihcbiAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBhdHRyaWJ1dGVzOiBbc3RyaW5nLCBzdHJpbmddW10pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsTmFtZU5vTnMgPSBzcGxpdE5zTmFtZShlbGVtZW50TmFtZSlbMV07XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudChlbE5hbWVOb05zKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBhdHRyTmFtZSA9IGF0dHJpYnV0ZXNbaV1bMF07XG4gICAgY29uc3QgYXR0ck5hbWVOb05zID0gc3BsaXROc05hbWUoYXR0ck5hbWUpWzFdO1xuICAgIGNvbnN0IGF0dHJWYWx1ZSA9IGF0dHJpYnV0ZXNbaV1bMV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUoYXR0ck5hbWVOb05zLCBhdHRyVmFsdWUpO1xuICAgIGlmIChhdHRyTmFtZS50b0xvd2VyQ2FzZSgpID09IENMQVNTX0FUVFIpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSBzcGxpdENsYXNzZXMoYXR0clZhbHVlKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbmNvbnN0IEVNUFRZX0VMRU1FTlRfQ09OVEVYVCA9IG5ldyBFbGVtZW50Q29udGV4dCh0cnVlLCBuZXcgU2VsZWN0b3JNYXRjaGVyKCksIG51bGwsIG51bGwpO1xuY29uc3QgTk9OX0JJTkRBQkxFX1ZJU0lUT1IgPSBuZXcgTm9uQmluZGFibGVWaXNpdG9yKCk7XG5cbmZ1bmN0aW9uIF9pc0VtcHR5VGV4dE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5UZXh0ICYmIG5vZGUudmFsdWUudHJpbSgpLmxlbmd0aCA9PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlU3VtbWFyeUR1cGxpY2F0ZXM8VCBleHRlbmRzIHt0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhfT4oaXRlbXM6IFRbXSk6IFRbXSB7XG4gIGNvbnN0IG1hcCA9IG5ldyBNYXA8YW55LCBUPigpO1xuXG4gIGl0ZW1zLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICBpZiAoIW1hcC5nZXQoaXRlbS50eXBlLnJlZmVyZW5jZSkpIHtcbiAgICAgIG1hcC5zZXQoaXRlbS50eXBlLnJlZmVyZW5jZSwgaXRlbSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gQXJyYXkuZnJvbShtYXAudmFsdWVzKCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFbXB0eUV4cHJlc3Npb24oYXN0OiBBU1QpOiBib29sZWFuIHtcbiAgaWYgKGFzdCBpbnN0YW5jZW9mIEFTVFdpdGhTb3VyY2UpIHtcbiAgICBhc3QgPSBhc3QuYXN0O1xuICB9XG4gIHJldHVybiBhc3QgaW5zdGFuY2VvZiBFbXB0eUV4cHI7XG59XG4iXX0=