/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { flatten, sanitizeIdentifier } from '../../compile_metadata';
import { BindingForm, BuiltinFunctionCall, convertActionBinding, convertPropertyBinding } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { AstMemoryEfficientTransformer, FunctionCall, ImplicitReceiver, Interpolation, LiteralArray, LiteralPrimitive, PropertyRead } from '../../expression_parser/ast';
import { Lexer } from '../../expression_parser/lexer';
import { Parser } from '../../expression_parser/parser';
import * as html from '../../ml_parser/ast';
import { HtmlParser } from '../../ml_parser/html_parser';
import { WhitespaceVisitor } from '../../ml_parser/html_whitespaces';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/interpolation_config';
import { isNgContainer as checkIsNgContainer, splitNsName } from '../../ml_parser/tags';
import * as o from '../../output/output_ast';
import { DomElementSchemaRegistry } from '../../schema/dom_element_schema_registry';
import { CssSelector } from '../../selector';
import { BindingParser } from '../../template_parser/binding_parser';
import { error } from '../../util';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { htmlAstToRender3Ast } from '../r3_template_transform';
import { parseStyle } from './styling';
import { CONTEXT_NAME, I18N_ATTR, I18N_ATTR_PREFIX, ID_SEPARATOR, IMPLICIT_REFERENCE, MEANING_SEPARATOR, REFERENCE_PREFIX, RENDER_FLAGS, asLiteral, invalid, mapToExpression, trimTrailingNulls, unsupported } from './util';
function mapBindingToInstruction(type) {
    switch (type) {
        case 0 /* Property */:
            return R3.elementProperty;
        case 1 /* Attribute */:
            return R3.elementAttribute;
        case 2 /* Class */:
            return R3.elementClassProp;
        default:
            return undefined;
    }
}
//  if (rf & flags) { .. }
export function renderFlagCheckIfStmt(flags, statements) {
    return o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(flags), null, false), statements);
}
var TemplateDefinitionBuilder = /** @class */ (function () {
    function TemplateDefinitionBuilder(constantPool, parentBindingScope, level, contextName, templateName, viewQueries, directiveMatcher, directives, pipeTypeByName, pipes, _namespace) {
        if (level === void 0) { level = 0; }
        var _this = this;
        this.constantPool = constantPool;
        this.level = level;
        this.contextName = contextName;
        this.templateName = templateName;
        this.viewQueries = viewQueries;
        this.directiveMatcher = directiveMatcher;
        this.directives = directives;
        this.pipeTypeByName = pipeTypeByName;
        this.pipes = pipes;
        this._namespace = _namespace;
        this._dataIndex = 0;
        this._bindingContext = 0;
        this._prefixCode = [];
        /**
         * List of callbacks to generate creation mode instructions. We store them here as we process
         * the template so bindings in listeners are resolved only once all nodes have been visited.
         * This ensures all local refs and context variables are available for matching.
         */
        this._creationCodeFns = [];
        /**
         * List of callbacks to generate update mode instructions. We store them here as we process
         * the template so bindings are resolved only once all nodes have been visited. This ensures
         * all local refs and context variables are available for matching.
         */
        this._updateCodeFns = [];
        /** Temporary variable declarations generated from visiting pipes, literals, etc. */
        this._tempVariables = [];
        /**
         * List of callbacks to build nested templates. Nested templates must not be visited until
         * after the parent template has finished visiting all of its nodes. This ensures that all
         * local ref bindings in nested templates are able to find local ref values if the refs
         * are defined after the template declaration.
         */
        this._nestedTemplateFns = [];
        this._unsupported = unsupported;
        // Whether we are inside a translatable element (`<p i18n>... somewhere here ... </p>)
        this._inI18nSection = false;
        this._i18nSectionIndex = -1;
        // Maps of placeholder to node indexes for each of the i18n section
        this._phToNodeIdxes = [{}];
        // Number of slots to reserve for pureFunctions
        this._pureFunctionSlots = 0;
        // Number of binding slots
        this._bindingSlots = 0;
        // These should be handled in the template or element directly.
        this.visitReference = invalid;
        this.visitVariable = invalid;
        this.visitTextAttribute = invalid;
        this.visitBoundAttribute = invalid;
        this.visitBoundEvent = invalid;
        // view queries can take up space in data and allocation happens earlier (in the "viewQuery"
        // function)
        this._dataIndex = viewQueries.length;
        this._bindingScope = parentBindingScope.nestedScope(level);
        this._valueConverter = new ValueConverter(constantPool, function () { return _this.allocateDataSlot(); }, function (numSlots) { return _this._pureFunctionSlots += numSlots; }, function (name, localName, slot, value) {
            var pipeType = pipeTypeByName.get(name);
            if (pipeType) {
                _this.pipes.add(pipeType);
            }
            _this._bindingScope.set(_this.level, localName, value);
            _this.creationInstruction(null, R3.pipe, [o.literal(slot), o.literal(name)]);
        });
    }
    TemplateDefinitionBuilder.prototype.registerContextVariables = function (variable) {
        var scopedName = this._bindingScope.freshReferenceName();
        var retrievalLevel = this.level;
        var lhs = o.variable(variable.name + scopedName);
        this._bindingScope.set(retrievalLevel, variable.name, lhs, 1 /* CONTEXT */, function (scope, relativeLevel) {
            var rhs;
            if (scope.bindingLevel === retrievalLevel) {
                // e.g. ctx
                rhs = o.variable(CONTEXT_NAME);
            }
            else {
                var sharedCtxVar = scope.getSharedContextName(retrievalLevel);
                // e.g. ctx_r0   OR  x(2);
                rhs = sharedCtxVar ? sharedCtxVar : generateNextContextExpr(relativeLevel);
            }
            // e.g. const $item$ = x(2).$implicit;
            return [lhs.set(rhs.prop(variable.value || IMPLICIT_REFERENCE)).toConstDecl()];
        });
    };
    TemplateDefinitionBuilder.prototype.buildTemplateFunction = function (nodes, variables, hasNgContent, ngContentSelectors) {
        var _this = this;
        if (hasNgContent === void 0) { hasNgContent = false; }
        if (ngContentSelectors === void 0) { ngContentSelectors = []; }
        var e_1, _a;
        if (this._namespace !== R3.namespaceHTML) {
            this.creationInstruction(null, this._namespace);
        }
        // Create variable bindings
        variables.forEach(function (v) { return _this.registerContextVariables(v); });
        // Output a `ProjectionDef` instruction when some `<ng-content>` are present
        if (hasNgContent) {
            var parameters = [];
            // Only selectors with a non-default value are generated
            if (ngContentSelectors.length > 1) {
                var r3Selectors = ngContentSelectors.map(function (s) { return core.parseSelectorToR3Selector(s); });
                // `projectionDef` needs both the parsed and raw value of the selectors
                var parsed = this.constantPool.getConstLiteral(asLiteral(r3Selectors), true);
                var unParsed = this.constantPool.getConstLiteral(asLiteral(ngContentSelectors), true);
                parameters.push(parsed, unParsed);
            }
            this.creationInstruction(null, R3.projectionDef, parameters);
        }
        // This is the initial pass through the nodes of this template. In this pass, we
        // queue all creation mode and update mode instructions for generation in the second
        // pass. It's necessary to separate the passes to ensure local refs are defined before
        // resolving bindings.
        t.visitAll(this, nodes);
        // Nested templates must be processed before creation instructions so template()
        // instructions can be generated with the correct internal const count.
        this._nestedTemplateFns.forEach(function (buildTemplateFn) { return buildTemplateFn(); });
        // Generate all the update mode instructions (e.g. resolve property or text bindings)
        var updateStatements = this._updateCodeFns.map(function (fn) { return fn(); });
        // Generate all the creation mode instructions (e.g. resolve bindings in listeners)
        var creationStatements = this._creationCodeFns.map(function (fn) { return fn(); });
        // To count slots for the reserveSlots() instruction, all bindings must have been visited.
        if (this._pureFunctionSlots > 0) {
            creationStatements.push(instruction(null, R3.reserveSlots, [o.literal(this._pureFunctionSlots)]).toStmt());
        }
        //  Variable declaration must occur after binding resolution so we can generate context
        //  instructions that build on each other. e.g. const b = x().$implicit(); const b = x();
        var creationVariables = this._bindingScope.viewSnapshotStatements();
        var updateVariables = this._bindingScope.variableDeclarations().concat(this._tempVariables);
        var creationBlock = creationStatements.length > 0 ?
            [renderFlagCheckIfStmt(1 /* Create */, creationVariables.concat(creationStatements))] :
            [];
        var updateBlock = updateStatements.length > 0 ?
            [renderFlagCheckIfStmt(2 /* Update */, updateVariables.concat(updateStatements))] :
            [];
        try {
            // Generate maps of placeholder name to node indexes
            // TODO(vicb): This is a WIP, not fully supported yet
            for (var _b = tslib_1.__values(this._phToNodeIdxes), _c = _b.next(); !_c.done; _c = _b.next()) {
                var phToNodeIdx = _c.value;
                if (Object.keys(phToNodeIdx).length > 0) {
                    var scopedName = this._bindingScope.freshReferenceName();
                    var phMap = o.variable(scopedName).set(mapToExpression(phToNodeIdx, true)).toConstDecl();
                    this._prefixCode.push(phMap);
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
        return o.fn(
        // i.e. (rf: RenderFlags, ctx: any)
        [new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], tslib_1.__spread(this._prefixCode, creationBlock, updateBlock), o.INFERRED_TYPE, null, this.templateName);
    };
    // LocalResolver
    TemplateDefinitionBuilder.prototype.getLocal = function (name) { return this._bindingScope.get(name); };
    TemplateDefinitionBuilder.prototype.visitContent = function (ngContent) {
        var slot = this.allocateDataSlot();
        var selectorIndex = ngContent.selectorIndex;
        var parameters = [o.literal(slot)];
        var attributeAsList = [];
        ngContent.attributes.forEach(function (attribute) {
            var name = attribute.name;
            if (name !== 'select') {
                attributeAsList.push(name, attribute.value);
            }
        });
        if (attributeAsList.length > 0) {
            parameters.push(o.literal(selectorIndex), asLiteral(attributeAsList));
        }
        else if (selectorIndex !== 0) {
            parameters.push(o.literal(selectorIndex));
        }
        this.creationInstruction(ngContent.sourceSpan, R3.projection, parameters);
    };
    TemplateDefinitionBuilder.prototype.getNamespaceInstruction = function (namespaceKey) {
        switch (namespaceKey) {
            case 'math':
                return R3.namespaceMathML;
            case 'svg':
                return R3.namespaceSVG;
            default:
                return R3.namespaceHTML;
        }
    };
    TemplateDefinitionBuilder.prototype.addNamespaceInstruction = function (nsInstruction, element) {
        this._namespace = nsInstruction;
        this.creationInstruction(element.sourceSpan, nsInstruction);
    };
    TemplateDefinitionBuilder.prototype.visitElement = function (element) {
        var _this = this;
        var e_2, _a;
        var elementIndex = this.allocateDataSlot();
        var wasInI18nSection = this._inI18nSection;
        var outputAttrs = {};
        var attrI18nMetas = {};
        var i18nMeta = '';
        var _b = tslib_1.__read(splitNsName(element.name), 2), namespaceKey = _b[0], elementName = _b[1];
        var isNgContainer = checkIsNgContainer(element.name);
        // Elements inside i18n sections are replaced with placeholders
        // TODO(vicb): nested elements are a WIP in this phase
        if (this._inI18nSection) {
            var phName = element.name.toLowerCase();
            if (!this._phToNodeIdxes[this._i18nSectionIndex][phName]) {
                this._phToNodeIdxes[this._i18nSectionIndex][phName] = [];
            }
            this._phToNodeIdxes[this._i18nSectionIndex][phName].push(elementIndex);
        }
        try {
            // Handle i18n attributes
            for (var _c = tslib_1.__values(element.attributes), _d = _c.next(); !_d.done; _d = _c.next()) {
                var attr = _d.value;
                var name_1 = attr.name;
                var value = attr.value;
                if (name_1 === I18N_ATTR) {
                    if (this._inI18nSection) {
                        throw new Error("Could not mark an element as translatable inside of a translatable section");
                    }
                    this._inI18nSection = true;
                    this._i18nSectionIndex++;
                    this._phToNodeIdxes[this._i18nSectionIndex] = {};
                    i18nMeta = value;
                }
                else if (name_1.startsWith(I18N_ATTR_PREFIX)) {
                    attrI18nMetas[name_1.slice(I18N_ATTR_PREFIX.length)] = value;
                }
                else {
                    outputAttrs[name_1] = value;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_2) throw e_2.error; }
        }
        // Match directives on non i18n attributes
        if (this.directiveMatcher) {
            var selector = createCssSelector(element.name, outputAttrs);
            this.directiveMatcher.match(selector, function (sel, staticType) { _this.directives.add(staticType); });
        }
        // Regular element or ng-container creation mode
        var parameters = [o.literal(elementIndex)];
        if (!isNgContainer) {
            parameters.push(o.literal(elementName));
        }
        // Add the attributes
        var attributes = [];
        var initialStyleDeclarations = [];
        var initialClassDeclarations = [];
        var styleInputs = [];
        var classInputs = [];
        var allOtherInputs = [];
        element.inputs.forEach(function (input) {
            switch (input.type) {
                // [attr.style] or [attr.class] should not be treated as styling-based
                // bindings since they are intended to be written directly to the attr
                // and therefore will skip all style/class resolution that is present
                // with style="", [style]="" and [style.prop]="", class="",
                // [class.prop]="". [class]="" assignments
                case 0 /* Property */:
                    if (input.name == 'style') {
                        // this should always go first in the compilation (for [style])
                        styleInputs.splice(0, 0, input);
                    }
                    else if (isClassBinding(input)) {
                        // this should always go first in the compilation (for [class])
                        classInputs.splice(0, 0, input);
                    }
                    else {
                        allOtherInputs.push(input);
                    }
                    break;
                case 3 /* Style */:
                    styleInputs.push(input);
                    break;
                case 2 /* Class */:
                    classInputs.push(input);
                    break;
                default:
                    allOtherInputs.push(input);
                    break;
            }
        });
        var currStyleIndex = 0;
        var currClassIndex = 0;
        var staticStylesMap = null;
        var staticClassesMap = null;
        var stylesIndexMap = {};
        var classesIndexMap = {};
        Object.getOwnPropertyNames(outputAttrs).forEach(function (name) {
            var value = outputAttrs[name];
            if (name == 'style') {
                staticStylesMap = parseStyle(value);
                Object.keys(staticStylesMap).forEach(function (prop) { stylesIndexMap[prop] = currStyleIndex++; });
            }
            else if (name == 'class') {
                staticClassesMap = {};
                value.split(/\s+/g).forEach(function (className) {
                    classesIndexMap[className] = currClassIndex++;
                    staticClassesMap[className] = true;
                });
            }
            else {
                attributes.push(o.literal(name));
                if (attrI18nMetas.hasOwnProperty(name)) {
                    var meta = parseI18nMeta(attrI18nMetas[name]);
                    var variable = _this.constantPool.getTranslation(value, meta);
                    attributes.push(variable);
                }
                else {
                    attributes.push(o.literal(value));
                }
            }
        });
        var hasMapBasedStyling = false;
        for (var i = 0; i < styleInputs.length; i++) {
            var input = styleInputs[i];
            var isMapBasedStyleBinding = i === 0 && input.name === 'style';
            if (isMapBasedStyleBinding) {
                hasMapBasedStyling = true;
            }
            else if (!stylesIndexMap.hasOwnProperty(input.name)) {
                stylesIndexMap[input.name] = currStyleIndex++;
            }
        }
        for (var i = 0; i < classInputs.length; i++) {
            var input = classInputs[i];
            var isMapBasedClassBinding = i === 0 && isClassBinding(input);
            if (!isMapBasedClassBinding && !stylesIndexMap.hasOwnProperty(input.name)) {
                classesIndexMap[input.name] = currClassIndex++;
            }
        }
        // in the event that a [style] binding is used then sanitization will
        // always be imported because it is not possible to know ahead of time
        // whether style bindings will use or not use any sanitizable properties
        // that isStyleSanitizable() will detect
        var useDefaultStyleSanitizer = hasMapBasedStyling;
        // this will build the instructions so that they fall into the following syntax
        // => [prop1, prop2, prop3, 0, prop1, value1, prop2, value2]
        Object.keys(stylesIndexMap).forEach(function (prop) {
            useDefaultStyleSanitizer = useDefaultStyleSanitizer || isStyleSanitizable(prop);
            initialStyleDeclarations.push(o.literal(prop));
        });
        if (staticStylesMap) {
            initialStyleDeclarations.push(o.literal(1 /* VALUES_MODE */));
            Object.keys(staticStylesMap).forEach(function (prop) {
                initialStyleDeclarations.push(o.literal(prop));
                var value = staticStylesMap[prop];
                initialStyleDeclarations.push(o.literal(value));
            });
        }
        Object.keys(classesIndexMap).forEach(function (prop) {
            initialClassDeclarations.push(o.literal(prop));
        });
        if (staticClassesMap) {
            initialClassDeclarations.push(o.literal(1 /* VALUES_MODE */));
            Object.keys(staticClassesMap).forEach(function (className) {
                initialClassDeclarations.push(o.literal(className));
                initialClassDeclarations.push(o.literal(true));
            });
        }
        var hasStylingInstructions = initialStyleDeclarations.length || styleInputs.length ||
            initialClassDeclarations.length || classInputs.length;
        var attrArg = attributes.length > 0 ?
            this.constantPool.getConstLiteral(o.literalArr(attributes), true) :
            o.TYPED_NULL_EXPR;
        parameters.push(attrArg);
        // local refs (ex.: <div #foo #bar="baz">)
        parameters.push(this.prepareRefsParameter(element.references));
        var wasInNamespace = this._namespace;
        var currentNamespace = this.getNamespaceInstruction(namespaceKey);
        // If the namespace is changing now, include an instruction to change it
        // during element creation.
        if (currentNamespace !== wasInNamespace) {
            this.addNamespaceInstruction(currentNamespace, element);
        }
        var implicit = o.variable(CONTEXT_NAME);
        var createSelfClosingInstruction = !hasStylingInstructions && !isNgContainer &&
            element.children.length === 0 && element.outputs.length === 0;
        if (createSelfClosingInstruction) {
            this.creationInstruction(element.sourceSpan, R3.element, trimTrailingNulls(parameters));
        }
        else {
            this.creationInstruction(element.sourceSpan, isNgContainer ? R3.elementContainerStart : R3.elementStart, trimTrailingNulls(parameters));
            // initial styling for static style="..." attributes
            if (hasStylingInstructions) {
                var paramsList = [];
                if (initialClassDeclarations.length) {
                    // the template compiler handles initial class styling (e.g. class="foo") values
                    // in a special command called `elementClass` so that the initial class
                    // can be processed during runtime. These initial class values are bound to
                    // a constant because the inital class values do not change (since they're static).
                    paramsList.push(this.constantPool.getConstLiteral(o.literalArr(initialClassDeclarations), true));
                }
                else if (initialStyleDeclarations.length || useDefaultStyleSanitizer) {
                    // no point in having an extra `null` value unless there are follow-up params
                    paramsList.push(o.NULL_EXPR);
                }
                if (initialStyleDeclarations.length) {
                    // the template compiler handles initial style (e.g. style="foo") values
                    // in a special command called `elementStyle` so that the initial styles
                    // can be processed during runtime. These initial styles values are bound to
                    // a constant because the inital style values do not change (since they're static).
                    paramsList.push(this.constantPool.getConstLiteral(o.literalArr(initialStyleDeclarations), true));
                }
                else if (useDefaultStyleSanitizer) {
                    // no point in having an extra `null` value unless there are follow-up params
                    paramsList.push(o.NULL_EXPR);
                }
                if (useDefaultStyleSanitizer) {
                    paramsList.push(o.importExpr(R3.defaultStyleSanitizer));
                }
                this.creationInstruction(null, R3.elementStyling, paramsList);
            }
            // Generate Listeners (outputs)
            element.outputs.forEach(function (outputAst) {
                var elName = sanitizeIdentifier(element.name);
                var evName = sanitizeIdentifier(outputAst.name);
                var functionName = _this.templateName + "_" + elName + "_" + evName + "_listener";
                _this.creationInstruction(outputAst.sourceSpan, R3.listener, function () {
                    var listenerScope = _this._bindingScope.nestedScope(_this._bindingScope.bindingLevel);
                    var bindingExpr = convertActionBinding(listenerScope, implicit, outputAst.handler, 'b', function () { return error('Unexpected interpolation'); });
                    var statements = tslib_1.__spread(listenerScope.restoreViewStatement(), listenerScope.variableDeclarations(), bindingExpr.render3Stmts);
                    var handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], statements, o.INFERRED_TYPE, null, functionName);
                    return [o.literal(outputAst.name), handler];
                });
            });
        }
        if ((styleInputs.length || classInputs.length) && hasStylingInstructions) {
            var indexLiteral_1 = o.literal(elementIndex);
            var firstStyle = styleInputs[0];
            var mapBasedStyleInput = firstStyle && firstStyle.name == 'style' ? firstStyle : null;
            var firstClass = classInputs[0];
            var mapBasedClassInput = firstClass && isClassBinding(firstClass) ? firstClass : null;
            var stylingInput = mapBasedStyleInput || mapBasedClassInput;
            if (stylingInput) {
                var params_1 = [];
                var value_1;
                if (mapBasedClassInput) {
                    value_1 = mapBasedClassInput.value.visit(this._valueConverter);
                }
                else if (mapBasedStyleInput) {
                    params_1.push(o.NULL_EXPR);
                }
                if (mapBasedStyleInput) {
                    value_1 = mapBasedStyleInput.value.visit(this._valueConverter);
                }
                this.updateInstruction(stylingInput.sourceSpan, R3.elementStylingMap, function () {
                    params_1.push(_this.convertPropertyBinding(implicit, value_1, true));
                    return tslib_1.__spread([indexLiteral_1], params_1);
                });
            }
            var lastInputCommand = null;
            if (styleInputs.length) {
                var i = mapBasedStyleInput ? 1 : 0;
                var _loop_1 = function () {
                    var input = styleInputs[i];
                    var params = [];
                    var sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                    if (sanitizationRef)
                        params.push(sanitizationRef);
                    var key = input.name;
                    var styleIndex = stylesIndexMap[key];
                    var value = input.value.visit(this_1._valueConverter);
                    this_1.updateInstruction(input.sourceSpan, R3.elementStyleProp, function () {
                        return tslib_1.__spread([
                            indexLiteral_1, o.literal(styleIndex),
                            _this.convertPropertyBinding(implicit, value, true)
                        ], params);
                    });
                };
                var this_1 = this;
                for (i; i < styleInputs.length; i++) {
                    _loop_1();
                }
                lastInputCommand = styleInputs[styleInputs.length - 1];
            }
            if (classInputs.length) {
                var i = mapBasedClassInput ? 1 : 0;
                var _loop_2 = function () {
                    var input = classInputs[i];
                    var params = [];
                    var sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                    if (sanitizationRef)
                        params.push(sanitizationRef);
                    var key = input.name;
                    var classIndex = classesIndexMap[key];
                    var value = input.value.visit(this_2._valueConverter);
                    this_2.updateInstruction(input.sourceSpan, R3.elementClassProp, function () {
                        return tslib_1.__spread([
                            indexLiteral_1, o.literal(classIndex),
                            _this.convertPropertyBinding(implicit, value, true)
                        ], params);
                    });
                };
                var this_2 = this;
                for (i; i < classInputs.length; i++) {
                    _loop_2();
                }
                lastInputCommand = classInputs[classInputs.length - 1];
            }
            this.updateInstruction(lastInputCommand.sourceSpan, R3.elementStylingApply, [indexLiteral_1]);
        }
        // Generate element input bindings
        allOtherInputs.forEach(function (input) {
            if (input.type === 4 /* Animation */) {
                console.error('warning: animation bindings not yet supported');
                return;
            }
            var instruction = mapBindingToInstruction(input.type);
            if (instruction) {
                var params_2 = [];
                var sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                if (sanitizationRef)
                    params_2.push(sanitizationRef);
                // TODO(chuckj): runtime: security context?
                var value_2 = input.value.visit(_this._valueConverter);
                _this.updateInstruction(input.sourceSpan, instruction, function () {
                    return tslib_1.__spread([
                        o.literal(elementIndex), o.literal(input.name),
                        _this.convertPropertyBinding(implicit, value_2)
                    ], params_2);
                });
            }
            else {
                _this._unsupported("binding type " + input.type);
            }
        });
        // Traverse element child nodes
        if (this._inI18nSection && element.children.length == 1 &&
            element.children[0] instanceof t.Text) {
            var text = element.children[0];
            this.visitSingleI18nTextChild(text, i18nMeta);
        }
        else {
            t.visitAll(this, element.children);
        }
        if (!createSelfClosingInstruction) {
            // Finish element construction mode.
            this.creationInstruction(element.endSourceSpan || element.sourceSpan, isNgContainer ? R3.elementContainerEnd : R3.elementEnd);
        }
        // Restore the state before exiting this node
        this._inI18nSection = wasInI18nSection;
    };
    TemplateDefinitionBuilder.prototype.visitTemplate = function (template) {
        var _this = this;
        var templateIndex = this.allocateDataSlot();
        var elName = '';
        if (template.children.length === 1 && template.children[0] instanceof t.Element) {
            // When the template as a single child, derive the context name from the tag
            elName = sanitizeIdentifier(template.children[0].name);
        }
        var contextName = elName ? this.contextName + "_" + elName : '';
        var templateName = contextName ? contextName + "_Template_" + templateIndex : "Template_" + templateIndex;
        var parameters = [
            o.literal(templateIndex),
            o.variable(templateName),
            o.TYPED_NULL_EXPR,
        ];
        // Match directives on both attributes and bound properties
        var attributeNames = [];
        var attributeMap = {};
        template.attributes.forEach(function (a) {
            attributeNames.push(asLiteral(a.name), asLiteral(''));
            attributeMap[a.name] = a.value;
        });
        template.inputs.forEach(function (i) {
            attributeNames.push(asLiteral(i.name), asLiteral(''));
            attributeMap[i.name] = '';
        });
        if (this.directiveMatcher) {
            var selector = createCssSelector('ng-template', attributeMap);
            this.directiveMatcher.match(selector, function (cssSelector, staticType) { _this.directives.add(staticType); });
        }
        if (attributeNames.length) {
            parameters.push(this.constantPool.getConstLiteral(o.literalArr(attributeNames), true));
        }
        else {
            parameters.push(o.TYPED_NULL_EXPR);
        }
        // local refs (ex.: <ng-template #foo>)
        if (template.references && template.references.length) {
            parameters.push(this.prepareRefsParameter(template.references));
            parameters.push(o.importExpr(R3.templateRefExtractor));
        }
        // e.g. p(1, 'forOf', ɵbind(ctx.items));
        var context = o.variable(CONTEXT_NAME);
        template.inputs.forEach(function (input) {
            var value = input.value.visit(_this._valueConverter);
            _this.updateInstruction(template.sourceSpan, R3.elementProperty, function () {
                return [
                    o.literal(templateIndex), o.literal(input.name),
                    _this.convertPropertyBinding(context, value)
                ];
            });
        });
        // Create the template function
        var templateVisitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, templateName, [], this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes, this._namespace);
        // Nested templates must not be visited until after their parent templates have completed
        // processing, so they are queued here until after the initial pass. Otherwise, we wouldn't
        // be able to support bindings in nested templates to local refs that occur after the
        // template definition. e.g. <div *ngIf="showing"> {{ foo }} </div>  <div #foo></div>
        this._nestedTemplateFns.push(function () {
            var templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables);
            _this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(templateName, null));
        });
        // e.g. template(1, MyComp_Template_1)
        this.creationInstruction(template.sourceSpan, R3.templateCreate, function () {
            parameters.splice(2, 0, o.literal(templateVisitor.getConstCount()), o.literal(templateVisitor.getVarCount()));
            return trimTrailingNulls(parameters);
        });
    };
    TemplateDefinitionBuilder.prototype.visitBoundText = function (text) {
        var _this = this;
        var nodeIndex = this.allocateDataSlot();
        this.creationInstruction(text.sourceSpan, R3.text, [o.literal(nodeIndex)]);
        var value = text.value.visit(this._valueConverter);
        this.updateInstruction(text.sourceSpan, R3.textBinding, function () { return [o.literal(nodeIndex), _this.convertPropertyBinding(o.variable(CONTEXT_NAME), value)]; });
    };
    TemplateDefinitionBuilder.prototype.visitText = function (text) {
        this.creationInstruction(text.sourceSpan, R3.text, [o.literal(this.allocateDataSlot()), o.literal(text.value)]);
    };
    // When the content of the element is a single text node the translation can be inlined:
    //
    // `<p i18n="desc|mean">some content</p>`
    // compiles to
    // ```
    // /**
    // * @desc desc
    // * @meaning mean
    // */
    // const MSG_XYZ = goog.getMsg('some content');
    // i0.ɵtext(1, MSG_XYZ);
    // ```
    TemplateDefinitionBuilder.prototype.visitSingleI18nTextChild = function (text, i18nMeta) {
        var meta = parseI18nMeta(i18nMeta);
        var variable = this.constantPool.getTranslation(text.value, meta);
        this.creationInstruction(text.sourceSpan, R3.text, [o.literal(this.allocateDataSlot()), variable]);
    };
    TemplateDefinitionBuilder.prototype.allocateDataSlot = function () { return this._dataIndex++; };
    TemplateDefinitionBuilder.prototype.getConstCount = function () { return this._dataIndex; };
    TemplateDefinitionBuilder.prototype.getVarCount = function () { return this._bindingSlots + this._pureFunctionSlots; };
    TemplateDefinitionBuilder.prototype.bindingContext = function () { return "" + this._bindingContext++; };
    // Bindings must only be resolved after all local refs have been visited, so all
    // instructions are queued in callbacks that execute once the initial pass has completed.
    // Otherwise, we wouldn't be able to support local refs that are defined after their
    // bindings. e.g. {{ foo }} <div #foo></div>
    TemplateDefinitionBuilder.prototype.instructionFn = function (fns, span, reference, paramsOrFn) {
        fns.push(function () {
            var params = Array.isArray(paramsOrFn) ? paramsOrFn : paramsOrFn();
            return instruction(span, reference, params).toStmt();
        });
    };
    TemplateDefinitionBuilder.prototype.creationInstruction = function (span, reference, paramsOrFn) {
        this.instructionFn(this._creationCodeFns, span, reference, paramsOrFn || []);
    };
    TemplateDefinitionBuilder.prototype.updateInstruction = function (span, reference, paramsOrFn) {
        this.instructionFn(this._updateCodeFns, span, reference, paramsOrFn || []);
    };
    TemplateDefinitionBuilder.prototype.convertPropertyBinding = function (implicit, value, skipBindFn) {
        var _a;
        if (!skipBindFn)
            this._bindingSlots++;
        var interpolationFn = value instanceof Interpolation ? interpolate : function () { return error('Unexpected interpolation'); };
        var convertedPropertyBinding = convertPropertyBinding(this, implicit, value, this.bindingContext(), BindingForm.TrySimple, interpolationFn);
        (_a = this._tempVariables).push.apply(_a, tslib_1.__spread(convertedPropertyBinding.stmts));
        var valExpr = convertedPropertyBinding.currValExpr;
        return value instanceof Interpolation || skipBindFn ? valExpr :
            o.importExpr(R3.bind).callFn([valExpr]);
    };
    TemplateDefinitionBuilder.prototype.prepareRefsParameter = function (references) {
        var _this = this;
        if (!references || references.length === 0) {
            return o.TYPED_NULL_EXPR;
        }
        var refsParam = flatten(references.map(function (reference) {
            var slot = _this.allocateDataSlot();
            // Generate the update temporary.
            var variableName = _this._bindingScope.freshReferenceName();
            var retrievalLevel = _this.level;
            var lhs = o.variable(variableName);
            _this._bindingScope.set(retrievalLevel, reference.name, lhs, 0 /* DEFAULT */, function (scope, relativeLevel) {
                // e.g. x(2);
                var nextContextStmt = relativeLevel > 0 ? [generateNextContextExpr(relativeLevel).toStmt()] : [];
                // e.g. const $foo$ = r(1);
                var refExpr = lhs.set(o.importExpr(R3.reference).callFn([o.literal(slot)]));
                return nextContextStmt.concat(refExpr.toConstDecl());
            });
            return [reference.name, reference.value];
        }));
        return this.constantPool.getConstLiteral(asLiteral(refsParam), true);
    };
    return TemplateDefinitionBuilder;
}());
export { TemplateDefinitionBuilder };
var ValueConverter = /** @class */ (function (_super) {
    tslib_1.__extends(ValueConverter, _super);
    function ValueConverter(constantPool, allocateSlot, allocatePureFunctionSlots, definePipe) {
        var _this = _super.call(this) || this;
        _this.constantPool = constantPool;
        _this.allocateSlot = allocateSlot;
        _this.allocatePureFunctionSlots = allocatePureFunctionSlots;
        _this.definePipe = definePipe;
        return _this;
    }
    // AstMemoryEfficientTransformer
    ValueConverter.prototype.visitPipe = function (pipe, context) {
        // Allocate a slot to create the pipe
        var slot = this.allocateSlot();
        var slotPseudoLocal = "PIPE:" + slot;
        // Allocate one slot for the result plus one slot per pipe argument
        var pureFunctionSlot = this.allocatePureFunctionSlots(2 + pipe.args.length);
        var target = new PropertyRead(pipe.span, new ImplicitReceiver(pipe.span), slotPseudoLocal);
        var _a = pipeBindingCallInfo(pipe.args), identifier = _a.identifier, isVarLength = _a.isVarLength;
        this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(identifier));
        var args = tslib_1.__spread([pipe.exp], pipe.args);
        var convertedArgs = isVarLength ? this.visitAll([new LiteralArray(pipe.span, args)]) : this.visitAll(args);
        return new FunctionCall(pipe.span, target, tslib_1.__spread([
            new LiteralPrimitive(pipe.span, slot),
            new LiteralPrimitive(pipe.span, pureFunctionSlot)
        ], convertedArgs));
    };
    ValueConverter.prototype.visitLiteralArray = function (array, context) {
        var _this = this;
        return new BuiltinFunctionCall(array.span, this.visitAll(array.expressions), function (values) {
            // If the literal has calculated (non-literal) elements transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            var literal = o.literalArr(values);
            return values.every(function (a) { return a.isConstant(); }) ?
                _this.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(_this.constantPool, literal, _this.allocatePureFunctionSlots);
        });
    };
    ValueConverter.prototype.visitLiteralMap = function (map, context) {
        var _this = this;
        return new BuiltinFunctionCall(map.span, this.visitAll(map.values), function (values) {
            // If the literal has calculated (non-literal) elements  transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            var literal = o.literalMap(values.map(function (value, index) { return ({ key: map.keys[index].key, value: value, quoted: map.keys[index].quoted }); }));
            return values.every(function (a) { return a.isConstant(); }) ?
                _this.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(_this.constantPool, literal, _this.allocatePureFunctionSlots);
        });
    };
    return ValueConverter;
}(AstMemoryEfficientTransformer));
// Pipes always have at least one parameter, the value they operate on
var pipeBindingIdentifiers = [R3.pipeBind1, R3.pipeBind2, R3.pipeBind3, R3.pipeBind4];
function pipeBindingCallInfo(args) {
    var identifier = pipeBindingIdentifiers[args.length];
    return {
        identifier: identifier || R3.pipeBindV,
        isVarLength: !identifier,
    };
}
var pureFunctionIdentifiers = [
    R3.pureFunction0, R3.pureFunction1, R3.pureFunction2, R3.pureFunction3, R3.pureFunction4,
    R3.pureFunction5, R3.pureFunction6, R3.pureFunction7, R3.pureFunction8
];
function pureFunctionCallInfo(args) {
    var identifier = pureFunctionIdentifiers[args.length];
    return {
        identifier: identifier || R3.pureFunctionV,
        isVarLength: !identifier,
    };
}
function instruction(span, reference, params) {
    return o.importExpr(reference, null, span).callFn(params, span);
}
// e.g. x(2);
function generateNextContextExpr(relativeLevelDiff) {
    return o.importExpr(R3.nextContext)
        .callFn(relativeLevelDiff > 1 ? [o.literal(relativeLevelDiff)] : []);
}
function getLiteralFactory(constantPool, literal, allocateSlots) {
    var _a = constantPool.getLiteralFactory(literal), literalFactory = _a.literalFactory, literalFactoryArguments = _a.literalFactoryArguments;
    // Allocate 1 slot for the result plus 1 per argument
    var startSlot = allocateSlots(1 + literalFactoryArguments.length);
    literalFactoryArguments.length > 0 || error("Expected arguments to a literal factory function");
    var _b = pureFunctionCallInfo(literalFactoryArguments), identifier = _b.identifier, isVarLength = _b.isVarLength;
    // Literal factories are pure functions that only need to be re-invoked when the parameters
    // change.
    var args = [
        o.literal(startSlot),
        literalFactory,
    ];
    if (isVarLength) {
        args.push(o.literalArr(literalFactoryArguments));
    }
    else {
        args.push.apply(args, tslib_1.__spread(literalFactoryArguments));
    }
    return o.importExpr(identifier).callFn(args);
}
/** The prefix used to get a shared context in BindingScope's map. */
var SHARED_CONTEXT_KEY = '$$shared_ctx$$';
var BindingScope = /** @class */ (function () {
    function BindingScope(bindingLevel, parent) {
        if (bindingLevel === void 0) { bindingLevel = 0; }
        if (parent === void 0) { parent = null; }
        this.bindingLevel = bindingLevel;
        this.parent = parent;
        /** Keeps a map from local variables to their BindingData. */
        this.map = new Map();
        this.referenceNameIndex = 0;
        this.restoreViewVariable = null;
    }
    BindingScope.prototype.get = function (name) {
        var current = this;
        while (current) {
            var value = current.map.get(name);
            if (value != null) {
                if (current !== this) {
                    // make a local copy and reset the `declare` state
                    value = {
                        retrievalLevel: value.retrievalLevel,
                        lhs: value.lhs,
                        declareLocalCallback: value.declareLocalCallback,
                        declare: false,
                        priority: value.priority
                    };
                    // Cache the value locally.
                    this.map.set(name, value);
                    // Possibly generate a shared context var
                    this.maybeGenerateSharedContextVar(value);
                    this.maybeRestoreView(value.retrievalLevel);
                }
                if (value.declareLocalCallback && !value.declare) {
                    value.declare = true;
                }
                return value.lhs;
            }
            current = current.parent;
        }
        // If we get to this point, we are looking for a property on the top level component
        // - If level === 0, we are on the top and don't need to re-declare `ctx`.
        // - If level > 0, we are in an embedded view. We need to retrieve the name of the
        // local var we used to store the component context, e.g. const $comp$ = x();
        return this.bindingLevel === 0 ? null : this.getComponentProperty(name);
    };
    /**
     * Create a local variable for later reference.
     *
     * @param retrievalLevel The level from which this value can be retrieved
     * @param name Name of the variable.
     * @param lhs AST representing the left hand side of the `let lhs = rhs;`.
     * @param priority The sorting priority of this var
     * @param declareLocalCallback The callback to invoke when declaring this local var
     */
    BindingScope.prototype.set = function (retrievalLevel, name, lhs, priority, declareLocalCallback) {
        if (priority === void 0) { priority = 0 /* DEFAULT */; }
        !this.map.has(name) ||
            error("The name " + name + " is already defined in scope to be " + this.map.get(name));
        this.map.set(name, {
            retrievalLevel: retrievalLevel,
            lhs: lhs,
            declare: false,
            declareLocalCallback: declareLocalCallback,
            priority: priority
        });
        return this;
    };
    BindingScope.prototype.getLocal = function (name) { return this.get(name); };
    BindingScope.prototype.nestedScope = function (level) {
        var newScope = new BindingScope(level, this);
        if (level > 0)
            newScope.generateSharedContextVar(0);
        return newScope;
    };
    BindingScope.prototype.getSharedContextName = function (retrievalLevel) {
        var sharedCtxObj = this.map.get(SHARED_CONTEXT_KEY + retrievalLevel);
        return sharedCtxObj && sharedCtxObj.declare ? sharedCtxObj.lhs : null;
    };
    BindingScope.prototype.maybeGenerateSharedContextVar = function (value) {
        if (value.priority === 1 /* CONTEXT */) {
            var sharedCtxObj = this.map.get(SHARED_CONTEXT_KEY + value.retrievalLevel);
            if (sharedCtxObj) {
                sharedCtxObj.declare = true;
            }
            else {
                this.generateSharedContextVar(value.retrievalLevel);
            }
        }
    };
    BindingScope.prototype.generateSharedContextVar = function (retrievalLevel) {
        var lhs = o.variable(CONTEXT_NAME + this.freshReferenceName());
        this.map.set(SHARED_CONTEXT_KEY + retrievalLevel, {
            retrievalLevel: retrievalLevel,
            lhs: lhs,
            declareLocalCallback: function (scope, relativeLevel) {
                // const ctx_r0 = x(2);
                return [lhs.set(generateNextContextExpr(relativeLevel)).toConstDecl()];
            },
            declare: false,
            priority: 2 /* SHARED_CONTEXT */
        });
    };
    BindingScope.prototype.getComponentProperty = function (name) {
        var componentValue = this.map.get(SHARED_CONTEXT_KEY + 0);
        componentValue.declare = true;
        this.maybeRestoreView(0);
        return componentValue.lhs.prop(name);
    };
    BindingScope.prototype.maybeRestoreView = function (retrievalLevel) {
        if (this.isListenerScope() && retrievalLevel < this.bindingLevel) {
            if (!this.parent.restoreViewVariable) {
                // parent saves variable to generate a shared `const $s$ = gV();` instruction
                this.parent.restoreViewVariable = o.variable(this.parent.freshReferenceName());
            }
            this.restoreViewVariable = this.parent.restoreViewVariable;
        }
    };
    BindingScope.prototype.restoreViewStatement = function () {
        // rV($state$);
        return this.restoreViewVariable ?
            [instruction(null, R3.restoreView, [this.restoreViewVariable]).toStmt()] :
            [];
    };
    BindingScope.prototype.viewSnapshotStatements = function () {
        // const $state$ = gV();
        var getCurrentViewInstruction = instruction(null, R3.getCurrentView, []);
        return this.restoreViewVariable ?
            [this.restoreViewVariable.set(getCurrentViewInstruction).toConstDecl()] :
            [];
    };
    BindingScope.prototype.isListenerScope = function () { return this.parent && this.parent.bindingLevel === this.bindingLevel; };
    BindingScope.prototype.variableDeclarations = function () {
        var _this = this;
        var currentContextLevel = 0;
        return Array.from(this.map.values())
            .filter(function (value) { return value.declare; })
            .sort(function (a, b) { return b.retrievalLevel - a.retrievalLevel || b.priority - a.priority; })
            .reduce(function (stmts, value) {
            var levelDiff = _this.bindingLevel - value.retrievalLevel;
            var currStmts = value.declareLocalCallback(_this, levelDiff - currentContextLevel);
            currentContextLevel = levelDiff;
            return stmts.concat(currStmts);
        }, []);
    };
    BindingScope.prototype.freshReferenceName = function () {
        var current = this;
        // Find the top scope as it maintains the global reference count
        while (current.parent)
            current = current.parent;
        var ref = "" + REFERENCE_PREFIX + current.referenceNameIndex++;
        return ref;
    };
    BindingScope.ROOT_SCOPE = new BindingScope().set(0, '$event', o.variable('$event'));
    return BindingScope;
}());
export { BindingScope };
/**
 * Creates a `CssSelector` given a tag name and a map of attributes
 */
function createCssSelector(tag, attributes) {
    var cssSelector = new CssSelector();
    cssSelector.setElement(tag);
    Object.getOwnPropertyNames(attributes).forEach(function (name) {
        var value = attributes[name];
        cssSelector.addAttribute(name, value);
        if (name.toLowerCase() === 'class') {
            var classes = value.trim().split(/\s+/g);
            classes.forEach(function (className) { return cssSelector.addClassName(className); });
        }
    });
    return cssSelector;
}
// Parse i18n metas like:
// - "@@id",
// - "description[@@id]",
// - "meaning|description[@@id]"
function parseI18nMeta(i18n) {
    var _a, _b;
    var meaning;
    var description;
    var id;
    if (i18n) {
        // TODO(vicb): figure out how to force a message ID with closure ?
        var idIndex = i18n.indexOf(ID_SEPARATOR);
        var descIndex = i18n.indexOf(MEANING_SEPARATOR);
        var meaningAndDesc = void 0;
        _a = tslib_1.__read((idIndex > -1) ? [i18n.slice(0, idIndex), i18n.slice(idIndex + 2)] : [i18n, ''], 2), meaningAndDesc = _a[0], id = _a[1];
        _b = tslib_1.__read((descIndex > -1) ?
            [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
            ['', meaningAndDesc], 2), meaning = _b[0], description = _b[1];
    }
    return { description: description, id: id, meaning: meaning };
}
function interpolate(args) {
    args = args.slice(1); // Ignore the length prefix added for render2
    switch (args.length) {
        case 3:
            return o.importExpr(R3.interpolation1).callFn(args);
        case 5:
            return o.importExpr(R3.interpolation2).callFn(args);
        case 7:
            return o.importExpr(R3.interpolation3).callFn(args);
        case 9:
            return o.importExpr(R3.interpolation4).callFn(args);
        case 11:
            return o.importExpr(R3.interpolation5).callFn(args);
        case 13:
            return o.importExpr(R3.interpolation6).callFn(args);
        case 15:
            return o.importExpr(R3.interpolation7).callFn(args);
        case 17:
            return o.importExpr(R3.interpolation8).callFn(args);
    }
    (args.length >= 19 && args.length % 2 == 1) ||
        error("Invalid interpolation argument length " + args.length);
    return o.importExpr(R3.interpolationV).callFn([o.literalArr(args)]);
}
/**
 * Parse a template into render3 `Node`s and additional metadata, with no other dependencies.
 *
 * @param template text of the template to parse
 * @param templateUrl URL to use for source mapping of the parsed template
 */
export function parseTemplate(template, templateUrl, options) {
    if (options === void 0) { options = {}; }
    var bindingParser = makeBindingParser();
    var htmlParser = new HtmlParser();
    var parseResult = htmlParser.parse(template, templateUrl);
    if (parseResult.errors && parseResult.errors.length > 0) {
        return { errors: parseResult.errors, nodes: [], hasNgContent: false, ngContentSelectors: [] };
    }
    var rootNodes = parseResult.rootNodes;
    if (!options.preserveWhitespaces) {
        rootNodes = html.visitAll(new WhitespaceVisitor(), rootNodes);
    }
    var _a = htmlAstToRender3Ast(rootNodes, bindingParser), nodes = _a.nodes, hasNgContent = _a.hasNgContent, ngContentSelectors = _a.ngContentSelectors, errors = _a.errors;
    if (errors && errors.length > 0) {
        return { errors: errors, nodes: [], hasNgContent: false, ngContentSelectors: [] };
    }
    return { nodes: nodes, hasNgContent: hasNgContent, ngContentSelectors: ngContentSelectors };
}
/**
 * Construct a `BindingParser` with a default configuration.
 */
export function makeBindingParser() {
    return new BindingParser(new Parser(new Lexer()), DEFAULT_INTERPOLATION_CONFIG, new DomElementSchemaRegistry(), null, []);
}
function isClassBinding(input) {
    return input.name == 'className' || input.name == 'class';
}
function resolveSanitizationFn(input, context) {
    switch (context) {
        case core.SecurityContext.HTML:
            return o.importExpr(R3.sanitizeHtml);
        case core.SecurityContext.SCRIPT:
            return o.importExpr(R3.sanitizeScript);
        case core.SecurityContext.STYLE:
            // the compiler does not fill in an instruction for [style.prop?] binding
            // values because the style algorithm knows internally what props are subject
            // to sanitization (only [attr.style] values are explicitly sanitized)
            return input.type === 1 /* Attribute */ ? o.importExpr(R3.sanitizeStyle) : null;
        case core.SecurityContext.URL:
            return o.importExpr(R3.sanitizeUrl);
        case core.SecurityContext.RESOURCE_URL:
            return o.importExpr(R3.sanitizeResourceUrl);
        default:
            return null;
    }
}
function isStyleSanitizable(prop) {
    switch (prop) {
        case 'background-image':
        case 'background':
        case 'border-image':
        case 'filter':
        case 'list-style':
        case 'list-style-image':
            return true;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbkUsT0FBTyxFQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBaUIsb0JBQW9CLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUV2SixPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQTRCLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFjLGdCQUFnQixFQUFFLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ2xOLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDdEQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDbEYsT0FBTyxFQUFDLGFBQWEsSUFBSSxrQkFBa0IsRUFBRSxXQUFXLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUN0RixPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBQ2xGLE9BQU8sRUFBQyxXQUFXLEVBQWtCLE1BQU0sZ0JBQWdCLENBQUM7QUFDNUQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQ25FLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDakMsT0FBTyxLQUFLLENBQUMsTUFBTSxXQUFXLENBQUM7QUFDL0IsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNwRCxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUc3RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLFlBQVksRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsV0FBVyxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRTNOLGlDQUFpQyxJQUFpQjtJQUNoRCxRQUFRLElBQUksRUFBRTtRQUNaO1lBQ0UsT0FBTyxFQUFFLENBQUMsZUFBZSxDQUFDO1FBQzVCO1lBQ0UsT0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUM7UUFDN0I7WUFDRSxPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztRQUM3QjtZQUNFLE9BQU8sU0FBUyxDQUFDO0tBQ3BCO0FBQ0gsQ0FBQztBQUVELDBCQUEwQjtBQUMxQixNQUFNLGdDQUNGLEtBQXVCLEVBQUUsVUFBeUI7SUFDcEQsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2xHLENBQUM7QUFFRDtJQTZDRSxtQ0FDWSxZQUEwQixFQUFFLGtCQUFnQyxFQUFVLEtBQVMsRUFDL0UsV0FBd0IsRUFBVSxZQUF5QixFQUMzRCxXQUE4QixFQUFVLGdCQUFzQyxFQUM5RSxVQUE2QixFQUFVLGNBQXlDLEVBQ2hGLEtBQXdCLEVBQVUsVUFBK0I7UUFKSyxzQkFBQSxFQUFBLFNBQVM7UUFEM0YsaUJBdUJDO1FBdEJXLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBQTRDLFVBQUssR0FBTCxLQUFLLENBQUk7UUFDL0UsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFBVSxpQkFBWSxHQUFaLFlBQVksQ0FBYTtRQUMzRCxnQkFBVyxHQUFYLFdBQVcsQ0FBbUI7UUFBVSxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQXNCO1FBQzlFLGVBQVUsR0FBVixVQUFVLENBQW1CO1FBQVUsbUJBQWMsR0FBZCxjQUFjLENBQTJCO1FBQ2hGLFVBQUssR0FBTCxLQUFLLENBQW1CO1FBQVUsZUFBVSxHQUFWLFVBQVUsQ0FBcUI7UUFqRHJFLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFDZixvQkFBZSxHQUFHLENBQUMsQ0FBQztRQUNwQixnQkFBVyxHQUFrQixFQUFFLENBQUM7UUFDeEM7Ozs7V0FJRztRQUNLLHFCQUFnQixHQUEwQixFQUFFLENBQUM7UUFDckQ7Ozs7V0FJRztRQUNLLG1CQUFjLEdBQTBCLEVBQUUsQ0FBQztRQUNuRCxvRkFBb0Y7UUFDNUUsbUJBQWMsR0FBa0IsRUFBRSxDQUFDO1FBQzNDOzs7OztXQUtHO1FBQ0ssdUJBQWtCLEdBQW1CLEVBQUUsQ0FBQztRQU94QyxpQkFBWSxHQUFHLFdBQVcsQ0FBQztRQUVuQyxzRkFBc0Y7UUFDOUUsbUJBQWMsR0FBWSxLQUFLLENBQUM7UUFDaEMsc0JBQWlCLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDL0IsbUVBQW1FO1FBQzNELG1CQUFjLEdBQW1DLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFOUQsK0NBQStDO1FBQ3ZDLHVCQUFrQixHQUFHLENBQUMsQ0FBQztRQUUvQiwwQkFBMEI7UUFDbEIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFvcEIxQiwrREFBK0Q7UUFDdEQsbUJBQWMsR0FBRyxPQUFPLENBQUM7UUFDekIsa0JBQWEsR0FBRyxPQUFPLENBQUM7UUFDeEIsdUJBQWtCLEdBQUcsT0FBTyxDQUFDO1FBQzdCLHdCQUFtQixHQUFHLE9BQU8sQ0FBQztRQUM5QixvQkFBZSxHQUFHLE9BQU8sQ0FBQztRQWpwQmpDLDRGQUE0RjtRQUM1RixZQUFZO1FBQ1osSUFBSSxDQUFDLFVBQVUsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO1FBRXJDLElBQUksQ0FBQyxhQUFhLEdBQUcsa0JBQWtCLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTNELElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxjQUFjLENBQ3JDLFlBQVksRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLGdCQUFnQixFQUFFLEVBQXZCLENBQXVCLEVBQzNDLFVBQUMsUUFBZ0IsSUFBYSxPQUFBLEtBQUksQ0FBQyxrQkFBa0IsSUFBSSxRQUFRLEVBQW5DLENBQW1DLEVBQ2pFLFVBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsS0FBb0I7WUFDMUMsSUFBTSxRQUFRLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxQyxJQUFJLFFBQVEsRUFBRTtnQkFDWixLQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUMxQjtZQUNELEtBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEtBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3JELEtBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUUsQ0FBQyxDQUFDLENBQUM7SUFDVCxDQUFDO0lBRUQsNERBQXdCLEdBQXhCLFVBQXlCLFFBQW9CO1FBQzNDLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMzRCxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ2xDLElBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FDbEIsY0FBYyxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxtQkFDbEMsVUFBQyxLQUFtQixFQUFFLGFBQXFCO1lBQ3pDLElBQUksR0FBaUIsQ0FBQztZQUN0QixJQUFJLEtBQUssQ0FBQyxZQUFZLEtBQUssY0FBYyxFQUFFO2dCQUN6QyxXQUFXO2dCQUNYLEdBQUcsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQ2hDO2lCQUFNO2dCQUNMLElBQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztnQkFDaEUsMEJBQTBCO2dCQUMxQixHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO2FBQzVFO1lBQ0Qsc0NBQXNDO1lBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssSUFBSSxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNqRixDQUFDLENBQUMsQ0FBQztJQUNULENBQUM7SUFFRCx5REFBcUIsR0FBckIsVUFDSSxLQUFlLEVBQUUsU0FBdUIsRUFBRSxZQUE2QixFQUN2RSxrQkFBaUM7UUFGckMsaUJBcUZDO1FBcEY2Qyw2QkFBQSxFQUFBLG9CQUE2QjtRQUN2RSxtQ0FBQSxFQUFBLHVCQUFpQzs7UUFDbkMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLEVBQUUsQ0FBQyxhQUFhLEVBQUU7WUFDeEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDakQ7UUFFRCwyQkFBMkI7UUFDM0IsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLEtBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsRUFBaEMsQ0FBZ0MsQ0FBQyxDQUFDO1FBRXpELDRFQUE0RTtRQUM1RSxJQUFJLFlBQVksRUFBRTtZQUNoQixJQUFNLFVBQVUsR0FBbUIsRUFBRSxDQUFDO1lBRXRDLHdEQUF3RDtZQUN4RCxJQUFJLGtCQUFrQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ2pDLElBQU0sV0FBVyxHQUFHLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsRUFBakMsQ0FBaUMsQ0FBQyxDQUFDO2dCQUNuRix1RUFBdUU7Z0JBQ3ZFLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDL0UsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3hGLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQ25DO1lBRUQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQzlEO1FBRUQsZ0ZBQWdGO1FBQ2hGLG9GQUFvRjtRQUNwRixzRkFBc0Y7UUFDdEYsc0JBQXNCO1FBQ3RCLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGdGQUFnRjtRQUNoRix1RUFBdUU7UUFDdkUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxVQUFBLGVBQWUsSUFBSSxPQUFBLGVBQWUsRUFBRSxFQUFqQixDQUFpQixDQUFDLENBQUM7UUFFdEUscUZBQXFGO1FBQ3JGLElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsVUFBQyxFQUFxQixJQUFLLE9BQUEsRUFBRSxFQUFFLEVBQUosQ0FBSSxDQUFDLENBQUM7UUFFbEYsbUZBQW1GO1FBQ25GLElBQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxVQUFDLEVBQXFCLElBQUssT0FBQSxFQUFFLEVBQUUsRUFBSixDQUFJLENBQUMsQ0FBQztRQUV0RiwwRkFBMEY7UUFDMUYsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxFQUFFO1lBQy9CLGtCQUFrQixDQUFDLElBQUksQ0FDbkIsV0FBVyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUN4RjtRQUVELHVGQUF1RjtRQUN2Rix5RkFBeUY7UUFDekYsSUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFDdEUsSUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFOUYsSUFBTSxhQUFhLEdBQUcsa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ2pELENBQUMscUJBQXFCLGlCQUNPLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdFLEVBQUUsQ0FBQztRQUVQLElBQU0sV0FBVyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUM3QyxDQUFDLHFCQUFxQixpQkFBMEIsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVGLEVBQUUsQ0FBQzs7WUFFUCxvREFBb0Q7WUFDcEQscURBQXFEO1lBQ3JELEtBQTBCLElBQUEsS0FBQSxpQkFBQSxJQUFJLENBQUMsY0FBYyxDQUFBLGdCQUFBLDRCQUFFO2dCQUExQyxJQUFNLFdBQVcsV0FBQTtnQkFDcEIsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQ3ZDLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDM0QsSUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUUzRixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDOUI7YUFDRjs7Ozs7Ozs7O1FBRUQsT0FBTyxDQUFDLENBQUMsRUFBRTtRQUNQLG1DQUFtQztRQUNuQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsbUJBRzFFLElBQUksQ0FBQyxXQUFXLEVBRWhCLGFBQWEsRUFFYixXQUFXLEdBRWhCLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQsZ0JBQWdCO0lBQ2hCLDRDQUFRLEdBQVIsVUFBUyxJQUFZLElBQXVCLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRWxGLGdEQUFZLEdBQVosVUFBYSxTQUFvQjtRQUMvQixJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUNyQyxJQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDO1FBQzlDLElBQU0sVUFBVSxHQUFtQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVyRCxJQUFNLGVBQWUsR0FBYSxFQUFFLENBQUM7UUFFckMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQyxTQUFTO1lBQ3JDLElBQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFDNUIsSUFBSSxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUNyQixlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDN0M7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDOUIsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO1NBQ3ZFO2FBQU0sSUFBSSxhQUFhLEtBQUssQ0FBQyxFQUFFO1lBQzlCLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1NBQzNDO1FBRUQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBR0QsMkRBQXVCLEdBQXZCLFVBQXdCLFlBQXlCO1FBQy9DLFFBQVEsWUFBWSxFQUFFO1lBQ3BCLEtBQUssTUFBTTtnQkFDVCxPQUFPLEVBQUUsQ0FBQyxlQUFlLENBQUM7WUFDNUIsS0FBSyxLQUFLO2dCQUNSLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQztZQUN6QjtnQkFDRSxPQUFPLEVBQUUsQ0FBQyxhQUFhLENBQUM7U0FDM0I7SUFDSCxDQUFDO0lBRUQsMkRBQXVCLEdBQXZCLFVBQXdCLGFBQWtDLEVBQUUsT0FBa0I7UUFDNUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxhQUFhLENBQUM7UUFDaEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVELGdEQUFZLEdBQVosVUFBYSxPQUFrQjtRQUEvQixpQkF3WUM7O1FBdllDLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQzdDLElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUU3QyxJQUFNLFdBQVcsR0FBNkIsRUFBRSxDQUFDO1FBQ2pELElBQU0sYUFBYSxHQUE2QixFQUFFLENBQUM7UUFDbkQsSUFBSSxRQUFRLEdBQVcsRUFBRSxDQUFDO1FBRXBCLElBQUEsaURBQXVELEVBQXRELG9CQUFZLEVBQUUsbUJBQVcsQ0FBOEI7UUFDOUQsSUFBTSxhQUFhLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZELCtEQUErRDtRQUMvRCxzREFBc0Q7UUFDdEQsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQ3ZCLElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDMUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3hELElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO2FBQzFEO1lBQ0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDeEU7O1lBRUQseUJBQXlCO1lBQ3pCLEtBQW1CLElBQUEsS0FBQSxpQkFBQSxPQUFPLENBQUMsVUFBVSxDQUFBLGdCQUFBLDRCQUFFO2dCQUFsQyxJQUFNLElBQUksV0FBQTtnQkFDYixJQUFNLE1BQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUN2QixJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUN6QixJQUFJLE1BQUksS0FBSyxTQUFTLEVBQUU7b0JBQ3RCLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRTt3QkFDdkIsTUFBTSxJQUFJLEtBQUssQ0FDWCw0RUFBNEUsQ0FBQyxDQUFDO3FCQUNuRjtvQkFDRCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztvQkFDM0IsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7b0JBQ3pCLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxDQUFDO29CQUNqRCxRQUFRLEdBQUcsS0FBSyxDQUFDO2lCQUNsQjtxQkFBTSxJQUFJLE1BQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtvQkFDNUMsYUFBYSxDQUFDLE1BQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7aUJBQzVEO3FCQUFNO29CQUNMLFdBQVcsQ0FBQyxNQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7aUJBQzNCO2FBQ0Y7Ozs7Ozs7OztRQUVELDBDQUEwQztRQUMxQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUN6QixJQUFNLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQzlELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQ3ZCLFFBQVEsRUFBRSxVQUFDLEdBQWdCLEVBQUUsVUFBZSxJQUFPLEtBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDNUY7UUFFRCxnREFBZ0Q7UUFDaEQsSUFBTSxVQUFVLEdBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQzdELElBQUksQ0FBQyxhQUFhLEVBQUU7WUFDbEIsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7U0FDekM7UUFFRCxxQkFBcUI7UUFDckIsSUFBTSxVQUFVLEdBQW1CLEVBQUUsQ0FBQztRQUN0QyxJQUFNLHdCQUF3QixHQUFtQixFQUFFLENBQUM7UUFDcEQsSUFBTSx3QkFBd0IsR0FBbUIsRUFBRSxDQUFDO1FBRXBELElBQU0sV0FBVyxHQUF1QixFQUFFLENBQUM7UUFDM0MsSUFBTSxXQUFXLEdBQXVCLEVBQUUsQ0FBQztRQUMzQyxJQUFNLGNBQWMsR0FBdUIsRUFBRSxDQUFDO1FBRTlDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBdUI7WUFDN0MsUUFBUSxLQUFLLENBQUMsSUFBSSxFQUFFO2dCQUNsQixzRUFBc0U7Z0JBQ3RFLHNFQUFzRTtnQkFDdEUscUVBQXFFO2dCQUNyRSwyREFBMkQ7Z0JBQzNELDBDQUEwQztnQkFDMUM7b0JBQ0UsSUFBSSxLQUFLLENBQUMsSUFBSSxJQUFJLE9BQU8sRUFBRTt3QkFDekIsK0RBQStEO3dCQUMvRCxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7cUJBQ2pDO3lCQUFNLElBQUksY0FBYyxDQUFDLEtBQUssQ0FBQyxFQUFFO3dCQUNoQywrREFBK0Q7d0JBQy9ELFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztxQkFDakM7eUJBQU07d0JBQ0wsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztxQkFDNUI7b0JBQ0QsTUFBTTtnQkFDUjtvQkFDRSxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN4QixNQUFNO2dCQUNSO29CQUNFLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3hCLE1BQU07Z0JBQ1I7b0JBQ0UsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDM0IsTUFBTTthQUNUO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUM7UUFDdkIsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLElBQUksZUFBZSxHQUE4QixJQUFJLENBQUM7UUFDdEQsSUFBSSxnQkFBZ0IsR0FBa0MsSUFBSSxDQUFDO1FBQzNELElBQU0sY0FBYyxHQUE0QixFQUFFLENBQUM7UUFDbkQsSUFBTSxlQUFlLEdBQTRCLEVBQUUsQ0FBQztRQUNwRCxNQUFNLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsSUFBSTtZQUNsRCxJQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEMsSUFBSSxJQUFJLElBQUksT0FBTyxFQUFFO2dCQUNuQixlQUFlLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNwQyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBTSxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUM1RjtpQkFBTSxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7Z0JBQzFCLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztnQkFDdEIsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxTQUFTO29CQUNuQyxlQUFlLENBQUMsU0FBUyxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUM7b0JBQzlDLGdCQUFrQixDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDdkMsQ0FBQyxDQUFDLENBQUM7YUFDSjtpQkFBTTtnQkFDTCxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDakMsSUFBSSxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN0QyxJQUFNLElBQUksR0FBRyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2hELElBQU0sUUFBUSxHQUFHLEtBQUksQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDL0QsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztpQkFDM0I7cUJBQU07b0JBQ0wsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7aUJBQ25DO2FBQ0Y7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksa0JBQWtCLEdBQUcsS0FBSyxDQUFDO1FBQy9CLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzNDLElBQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QixJQUFNLHNCQUFzQixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxPQUFPLENBQUM7WUFDakUsSUFBSSxzQkFBc0IsRUFBRTtnQkFDMUIsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO2FBQzNCO2lCQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDckQsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxjQUFjLEVBQUUsQ0FBQzthQUMvQztTQUNGO1FBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDM0MsSUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdCLElBQU0sc0JBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEUsSUFBSSxDQUFDLHNCQUFzQixJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3pFLGVBQWUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUM7YUFDaEQ7U0FDRjtRQUVELHFFQUFxRTtRQUNyRSxzRUFBc0U7UUFDdEUsd0VBQXdFO1FBQ3hFLHdDQUF3QztRQUN4QyxJQUFJLHdCQUF3QixHQUFHLGtCQUFrQixDQUFDO1FBRWxELCtFQUErRTtRQUMvRSw0REFBNEQ7UUFDNUQsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO1lBQ3RDLHdCQUF3QixHQUFHLHdCQUF3QixJQUFJLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hGLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDakQsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLGVBQWUsRUFBRTtZQUNuQix3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8scUJBQXNDLENBQUMsQ0FBQztZQUUvRSxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUk7Z0JBQ3ZDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQy9DLElBQU0sS0FBSyxHQUFHLGVBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3RDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDbEQsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsSUFBSTtZQUN2Qyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2pELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxnQkFBZ0IsRUFBRTtZQUNwQix3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8scUJBQXNDLENBQUMsQ0FBQztZQUUvRSxNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsU0FBUztnQkFDN0Msd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDcEQsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNqRCxDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQsSUFBTSxzQkFBc0IsR0FBRyx3QkFBd0IsQ0FBQyxNQUFNLElBQUksV0FBVyxDQUFDLE1BQU07WUFDaEYsd0JBQXdCLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUM7UUFFMUQsSUFBTSxPQUFPLEdBQWlCLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ25FLENBQUMsQ0FBQyxlQUFlLENBQUM7UUFDdEIsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV6QiwwQ0FBMEM7UUFDMUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFFL0QsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUN2QyxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVwRSx3RUFBd0U7UUFDeEUsMkJBQTJCO1FBQzNCLElBQUksZ0JBQWdCLEtBQUssY0FBYyxFQUFFO1lBQ3ZDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN6RDtRQUVELElBQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFMUMsSUFBTSw0QkFBNEIsR0FBRyxDQUFDLHNCQUFzQixJQUFJLENBQUMsYUFBYTtZQUMxRSxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO1FBRWxFLElBQUksNEJBQTRCLEVBQUU7WUFDaEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1NBQ3pGO2FBQU07WUFDTCxJQUFJLENBQUMsbUJBQW1CLENBQ3BCLE9BQU8sQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQzlFLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFFbkMsb0RBQW9EO1lBQ3BELElBQUksc0JBQXNCLEVBQUU7Z0JBQzFCLElBQU0sVUFBVSxHQUFxQixFQUFFLENBQUM7Z0JBRXhDLElBQUksd0JBQXdCLENBQUMsTUFBTSxFQUFFO29CQUNuQyxnRkFBZ0Y7b0JBQ2hGLHVFQUF1RTtvQkFDdkUsMkVBQTJFO29CQUMzRSxtRkFBbUY7b0JBQ25GLFVBQVUsQ0FBQyxJQUFJLENBQ1gsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQ3RGO3FCQUFNLElBQUksd0JBQXdCLENBQUMsTUFBTSxJQUFJLHdCQUF3QixFQUFFO29CQUN0RSw2RUFBNkU7b0JBQzdFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2lCQUM5QjtnQkFFRCxJQUFJLHdCQUF3QixDQUFDLE1BQU0sRUFBRTtvQkFDbkMsd0VBQXdFO29CQUN4RSx3RUFBd0U7b0JBQ3hFLDRFQUE0RTtvQkFDNUUsbUZBQW1GO29CQUNuRixVQUFVLENBQUMsSUFBSSxDQUNYLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsd0JBQXdCLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUN0RjtxQkFBTSxJQUFJLHdCQUF3QixFQUFFO29CQUNuQyw2RUFBNkU7b0JBQzdFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2lCQUM5QjtnQkFFRCxJQUFJLHdCQUF3QixFQUFFO29CQUM1QixVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztpQkFDekQ7Z0JBRUQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsY0FBYyxFQUFFLFVBQVUsQ0FBQyxDQUFDO2FBQy9EO1lBRUQsK0JBQStCO1lBQy9CLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUMsU0FBdUI7Z0JBQzlDLElBQU0sTUFBTSxHQUFHLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDaEQsSUFBTSxNQUFNLEdBQUcsa0JBQWtCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNsRCxJQUFNLFlBQVksR0FBTSxLQUFJLENBQUMsWUFBWSxTQUFJLE1BQU0sU0FBSSxNQUFNLGNBQVcsQ0FBQztnQkFFekUsS0FBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFFBQVEsRUFBRTtvQkFDMUQsSUFBTSxhQUFhLEdBQUcsS0FBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsS0FBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztvQkFFdEYsSUFBTSxXQUFXLEdBQUcsb0JBQW9CLENBQ3BDLGFBQWEsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQy9DLGNBQU0sT0FBQSxLQUFLLENBQUMsMEJBQTBCLENBQUMsRUFBakMsQ0FBaUMsQ0FBQyxDQUFDO29CQUU3QyxJQUFNLFVBQVUsb0JBQ1gsYUFBYSxDQUFDLG9CQUFvQixFQUFFLEVBQUssYUFBYSxDQUFDLG9CQUFvQixFQUFFLEVBQzdFLFdBQVcsQ0FBQyxZQUFZLENBQzVCLENBQUM7b0JBRUYsSUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FDaEIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksRUFDNUUsWUFBWSxDQUFDLENBQUM7b0JBRWxCLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDOUMsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLHNCQUFzQixFQUFFO1lBQ3hFLElBQU0sY0FBWSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7WUFFN0MsSUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLElBQU0sa0JBQWtCLEdBQUcsVUFBVSxJQUFJLFVBQVUsQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUV4RixJQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEMsSUFBTSxrQkFBa0IsR0FBRyxVQUFVLElBQUksY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUV4RixJQUFNLFlBQVksR0FBRyxrQkFBa0IsSUFBSSxrQkFBa0IsQ0FBQztZQUM5RCxJQUFJLFlBQVksRUFBRTtnQkFDaEIsSUFBTSxRQUFNLEdBQW1CLEVBQUUsQ0FBQztnQkFDbEMsSUFBSSxPQUFVLENBQUM7Z0JBQ2YsSUFBSSxrQkFBa0IsRUFBRTtvQkFDdEIsT0FBSyxHQUFHLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO2lCQUM5RDtxQkFBTSxJQUFJLGtCQUFrQixFQUFFO29CQUM3QixRQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztpQkFDMUI7Z0JBRUQsSUFBSSxrQkFBa0IsRUFBRTtvQkFDdEIsT0FBSyxHQUFHLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO2lCQUM5RDtnQkFFRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsaUJBQWlCLEVBQUU7b0JBQ3BFLFFBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxPQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDaEUseUJBQVEsY0FBWSxHQUFLLFFBQU0sRUFBRTtnQkFDbkMsQ0FBQyxDQUFDLENBQUM7YUFDSjtZQUVELElBQUksZ0JBQWdCLEdBQTBCLElBQUksQ0FBQztZQUNuRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3RCLElBQUksQ0FBQyxHQUFHLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7b0JBRWpDLElBQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDN0IsSUFBTSxNQUFNLEdBQVUsRUFBRSxDQUFDO29CQUN6QixJQUFNLGVBQWUsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO29CQUM1RSxJQUFJLGVBQWU7d0JBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFFbEQsSUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztvQkFDdkIsSUFBTSxVQUFVLEdBQVcsY0FBYyxDQUFDLEdBQUcsQ0FBRyxDQUFDO29CQUNqRCxJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFLLGVBQWUsQ0FBQyxDQUFDO29CQUN0RCxPQUFLLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixFQUFFO3dCQUM1RDs0QkFDRSxjQUFZLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7NEJBQ25DLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQzsyQkFBSyxNQUFNLEVBQzdEO29CQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7O2dCQWZELEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRTs7aUJBZWxDO2dCQUVELGdCQUFnQixHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO2FBQ3hEO1lBRUQsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO2dCQUN0QixJQUFJLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O29CQUVqQyxJQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzdCLElBQU0sTUFBTSxHQUFVLEVBQUUsQ0FBQztvQkFDekIsSUFBTSxlQUFlLEdBQUcscUJBQXFCLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDNUUsSUFBSSxlQUFlO3dCQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBRWxELElBQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7b0JBQ3ZCLElBQU0sVUFBVSxHQUFXLGVBQWUsQ0FBQyxHQUFHLENBQUcsQ0FBQztvQkFDbEQsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBSyxlQUFlLENBQUMsQ0FBQztvQkFDdEQsT0FBSyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRTt3QkFDNUQ7NEJBQ0UsY0FBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDOzRCQUNuQyxLQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUM7MkJBQUssTUFBTSxFQUM3RDtvQkFDSixDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDOztnQkFmRCxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7O2lCQWVsQztnQkFFRCxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQzthQUN4RDtZQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBa0IsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLG1CQUFtQixFQUFFLENBQUMsY0FBWSxDQUFDLENBQUMsQ0FBQztTQUMvRjtRQUVELGtDQUFrQztRQUNsQyxjQUFjLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBdUI7WUFDN0MsSUFBSSxLQUFLLENBQUMsSUFBSSxzQkFBMEIsRUFBRTtnQkFDeEMsT0FBTyxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO2dCQUMvRCxPQUFPO2FBQ1I7WUFFRCxJQUFNLFdBQVcsR0FBRyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDeEQsSUFBSSxXQUFXLEVBQUU7Z0JBQ2YsSUFBTSxRQUFNLEdBQVUsRUFBRSxDQUFDO2dCQUN6QixJQUFNLGVBQWUsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUM1RSxJQUFJLGVBQWU7b0JBQUUsUUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFFbEQsMkNBQTJDO2dCQUMzQyxJQUFNLE9BQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ3RELEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLFdBQVcsRUFBRTtvQkFDcEQ7d0JBQ0UsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7d0JBQzlDLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsT0FBSyxDQUFDO3VCQUFLLFFBQU0sRUFDdkQ7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7YUFDSjtpQkFBTTtnQkFDTCxLQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFnQixLQUFLLENBQUMsSUFBTSxDQUFDLENBQUM7YUFDakQ7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILCtCQUErQjtRQUMvQixJQUFJLElBQUksQ0FBQyxjQUFjLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLElBQUksQ0FBQztZQUNuRCxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLEVBQUU7WUFDekMsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQVcsQ0FBQztZQUMzQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQy9DO2FBQU07WUFDTCxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDcEM7UUFFRCxJQUFJLENBQUMsNEJBQTRCLEVBQUU7WUFDakMsb0NBQW9DO1lBQ3BDLElBQUksQ0FBQyxtQkFBbUIsQ0FDcEIsT0FBTyxDQUFDLGFBQWEsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUMzQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQzdEO1FBRUQsNkNBQTZDO1FBQzdDLElBQUksQ0FBQyxjQUFjLEdBQUcsZ0JBQWdCLENBQUM7SUFDekMsQ0FBQztJQUVELGlEQUFhLEdBQWIsVUFBYyxRQUFvQjtRQUFsQyxpQkFzRkM7UUFyRkMsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFOUMsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2hCLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sRUFBRTtZQUMvRSw0RUFBNEU7WUFDNUUsTUFBTSxHQUFHLGtCQUFrQixDQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdkU7UUFFRCxJQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFJLElBQUksQ0FBQyxXQUFXLFNBQUksTUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFFbEUsSUFBTSxZQUFZLEdBQ2QsV0FBVyxDQUFDLENBQUMsQ0FBSSxXQUFXLGtCQUFhLGFBQWUsQ0FBQyxDQUFDLENBQUMsY0FBWSxhQUFlLENBQUM7UUFFM0YsSUFBTSxVQUFVLEdBQW1CO1lBQ2pDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO1lBQ3hCLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO1lBQ3hCLENBQUMsQ0FBQyxlQUFlO1NBQ2xCLENBQUM7UUFFRiwyREFBMkQ7UUFDM0QsSUFBTSxjQUFjLEdBQW1CLEVBQUUsQ0FBQztRQUMxQyxJQUFNLFlBQVksR0FBNkIsRUFBRSxDQUFDO1FBRWxELFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQztZQUMzQixjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEQsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDO1lBQ3ZCLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN0RCxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM1QixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO1lBQ3pCLElBQU0sUUFBUSxHQUFHLGlCQUFpQixDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUNoRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUN2QixRQUFRLEVBQUUsVUFBQyxXQUFXLEVBQUUsVUFBVSxJQUFPLEtBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbEY7UUFFRCxJQUFJLGNBQWMsQ0FBQyxNQUFNLEVBQUU7WUFDekIsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDeEY7YUFBTTtZQUNMLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1NBQ3BDO1FBRUQsdUNBQXVDO1FBQ3ZDLElBQUksUUFBUSxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRTtZQUNyRCxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNoRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztTQUN4RDtRQUVELHdDQUF3QztRQUN4QyxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3pDLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUEsS0FBSztZQUMzQixJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDdEQsS0FBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLGVBQWUsRUFBRTtnQkFDOUQsT0FBTztvQkFDTCxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztvQkFDL0MsS0FBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUM7aUJBQzVDLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQU0sZUFBZSxHQUFHLElBQUkseUJBQXlCLENBQ2pELElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFDcEYsSUFBSSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU5Rix5RkFBeUY7UUFDekYsMkZBQTJGO1FBQzNGLHFGQUFxRjtRQUNyRixxRkFBcUY7UUFDckYsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQztZQUMzQixJQUFNLG9CQUFvQixHQUN0QixlQUFlLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakYsS0FBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN6RixDQUFDLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsY0FBYyxFQUFFO1lBQy9ELFVBQVUsQ0FBQyxNQUFNLENBQ2IsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxFQUNoRCxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDOUMsT0FBTyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN2QyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFTRCxrREFBYyxHQUFkLFVBQWUsSUFBaUI7UUFBaEMsaUJBU0M7UUFSQyxJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUUxQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFM0UsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxpQkFBaUIsQ0FDbEIsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsV0FBVyxFQUMvQixjQUFNLE9BQUEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQXBGLENBQW9GLENBQUMsQ0FBQztJQUNsRyxDQUFDO0lBRUQsNkNBQVMsR0FBVCxVQUFVLElBQVk7UUFDcEIsSUFBSSxDQUFDLG1CQUFtQixDQUNwQixJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdGLENBQUM7SUFFRCx3RkFBd0Y7SUFDeEYsRUFBRTtJQUNGLHlDQUF5QztJQUN6QyxjQUFjO0lBQ2QsTUFBTTtJQUNOLE1BQU07SUFDTixlQUFlO0lBQ2Ysa0JBQWtCO0lBQ2xCLEtBQUs7SUFDTCwrQ0FBK0M7SUFDL0Msd0JBQXdCO0lBQ3hCLE1BQU07SUFDTiw0REFBd0IsR0FBeEIsVUFBeUIsSUFBWSxFQUFFLFFBQWdCO1FBQ3JELElBQU0sSUFBSSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNyQyxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxtQkFBbUIsQ0FDcEIsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDaEYsQ0FBQztJQUVPLG9EQUFnQixHQUF4QixjQUE2QixPQUFPLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFeEQsaURBQWEsR0FBYixjQUFrQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBRTNDLCtDQUFXLEdBQVgsY0FBZ0IsT0FBTyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7SUFFOUQsa0RBQWMsR0FBdEIsY0FBMkIsT0FBTyxLQUFHLElBQUksQ0FBQyxlQUFlLEVBQUksQ0FBQyxDQUFDLENBQUM7SUFFaEUsZ0ZBQWdGO0lBQ2hGLHlGQUF5RjtJQUN6RixvRkFBb0Y7SUFDcEYsNENBQTRDO0lBQ3BDLGlEQUFhLEdBQXJCLFVBQ0ksR0FBMEIsRUFBRSxJQUEwQixFQUFFLFNBQThCLEVBQ3RGLFVBQWlEO1FBQ25ELEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFDUCxJQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3JFLE9BQU8sV0FBVyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDdkQsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sdURBQW1CLEdBQTNCLFVBQ0ksSUFBMEIsRUFBRSxTQUE4QixFQUMxRCxVQUFrRDtRQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRU8scURBQWlCLEdBQXpCLFVBQ0ksSUFBMEIsRUFBRSxTQUE4QixFQUMxRCxVQUFrRDtRQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUVPLDBEQUFzQixHQUE5QixVQUErQixRQUFzQixFQUFFLEtBQVUsRUFBRSxVQUFvQjs7UUFFckYsSUFBSSxDQUFDLFVBQVU7WUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFdEMsSUFBTSxlQUFlLEdBQ2pCLEtBQUssWUFBWSxhQUFhLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsY0FBTSxPQUFBLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxFQUFqQyxDQUFpQyxDQUFDO1FBRTNGLElBQU0sd0JBQXdCLEdBQUcsc0JBQXNCLENBQ25ELElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRSxXQUFXLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQzFGLENBQUEsS0FBQSxJQUFJLENBQUMsY0FBYyxDQUFBLENBQUMsSUFBSSw0QkFBSSx3QkFBd0IsQ0FBQyxLQUFLLEdBQUU7UUFFNUQsSUFBTSxPQUFPLEdBQUcsd0JBQXdCLENBQUMsV0FBVyxDQUFDO1FBQ3JELE9BQU8sS0FBSyxZQUFZLGFBQWEsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ1QsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRU8sd0RBQW9CLEdBQTVCLFVBQTZCLFVBQXlCO1FBQXRELGlCQTBCQztRQXpCQyxJQUFJLENBQUMsVUFBVSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzFDLE9BQU8sQ0FBQyxDQUFDLGVBQWUsQ0FBQztTQUMxQjtRQUVELElBQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQUEsU0FBUztZQUNoRCxJQUFNLElBQUksR0FBRyxLQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUNyQyxpQ0FBaUM7WUFDakMsSUFBTSxZQUFZLEdBQUcsS0FBSSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQzdELElBQU0sY0FBYyxHQUFHLEtBQUksQ0FBQyxLQUFLLENBQUM7WUFDbEMsSUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNyQyxLQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FDbEIsY0FBYyxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxtQkFDbkMsVUFBQyxLQUFtQixFQUFFLGFBQXFCO2dCQUN6QyxhQUFhO2dCQUNiLElBQU0sZUFBZSxHQUNqQixhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFFL0UsMkJBQTJCO2dCQUMzQixJQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzlFLE9BQU8sZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUN2RCxDQUFDLENBQUMsQ0FBQztZQUNQLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUNILGdDQUFDO0FBQUQsQ0FBQyxBQXJ6QkQsSUFxekJDOztBQUVEO0lBQTZCLDBDQUE2QjtJQUN4RCx3QkFDWSxZQUEwQixFQUFVLFlBQTBCLEVBQzlELHlCQUF1RCxFQUN2RCxVQUN3RTtRQUpwRixZQUtFLGlCQUFPLFNBQ1I7UUFMVyxrQkFBWSxHQUFaLFlBQVksQ0FBYztRQUFVLGtCQUFZLEdBQVosWUFBWSxDQUFjO1FBQzlELCtCQUF5QixHQUF6Qix5QkFBeUIsQ0FBOEI7UUFDdkQsZ0JBQVUsR0FBVixVQUFVLENBQzhEOztJQUVwRixDQUFDO0lBRUQsZ0NBQWdDO0lBQ2hDLGtDQUFTLEdBQVQsVUFBVSxJQUFpQixFQUFFLE9BQVk7UUFDdkMscUNBQXFDO1FBQ3JDLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNqQyxJQUFNLGVBQWUsR0FBRyxVQUFRLElBQU0sQ0FBQztRQUN2QyxtRUFBbUU7UUFDbkUsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUUsSUFBTSxNQUFNLEdBQUcsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUN2RixJQUFBLG1DQUEwRCxFQUF6RCwwQkFBVSxFQUFFLDRCQUFXLENBQW1DO1FBQ2pFLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUM1RSxJQUFNLElBQUkscUJBQVcsSUFBSSxDQUFDLEdBQUcsR0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0MsSUFBTSxhQUFhLEdBQ2YsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFM0YsT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU07WUFDdkMsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztZQUNyQyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLENBQUM7V0FDOUMsYUFBYSxFQUNoQixDQUFDO0lBQ0wsQ0FBQztJQUVELDBDQUFpQixHQUFqQixVQUFrQixLQUFtQixFQUFFLE9BQVk7UUFBbkQsaUJBVUM7UUFUQyxPQUFPLElBQUksbUJBQW1CLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsRUFBRSxVQUFBLE1BQU07WUFDakYseUVBQXlFO1lBQ3pFLGtGQUFrRjtZQUNsRiw0RUFBNEU7WUFDNUUsSUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyQyxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQWQsQ0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDdEMsS0FBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ2xELGlCQUFpQixDQUFDLEtBQUksQ0FBQyxZQUFZLEVBQUUsT0FBTyxFQUFFLEtBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQ3BGLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELHdDQUFlLEdBQWYsVUFBZ0IsR0FBZSxFQUFFLE9BQVk7UUFBN0MsaUJBV0M7UUFWQyxPQUFPLElBQUksbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxVQUFBLE1BQU07WUFDeEUsMEVBQTBFO1lBQzFFLGtGQUFrRjtZQUNsRiw0RUFBNEU7WUFDNUUsSUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUNuQyxVQUFDLEtBQUssRUFBRSxLQUFLLElBQUssT0FBQSxDQUFDLEVBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssT0FBQSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sRUFBQyxDQUFDLEVBQW5FLENBQW1FLENBQUMsQ0FBQyxDQUFDO1lBQzVGLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBZCxDQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN0QyxLQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDbEQsaUJBQWlCLENBQUMsS0FBSSxDQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsS0FBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDcEYsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQ0gscUJBQUM7QUFBRCxDQUFDLEFBdERELENBQTZCLDZCQUE2QixHQXNEekQ7QUFFRCxzRUFBc0U7QUFDdEUsSUFBTSxzQkFBc0IsR0FBRyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUV4Riw2QkFBNkIsSUFBb0I7SUFDL0MsSUFBTSxVQUFVLEdBQUcsc0JBQXNCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZELE9BQU87UUFDTCxVQUFVLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxTQUFTO1FBQ3RDLFdBQVcsRUFBRSxDQUFDLFVBQVU7S0FDekIsQ0FBQztBQUNKLENBQUM7QUFFRCxJQUFNLHVCQUF1QixHQUFHO0lBQzlCLEVBQUUsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLGFBQWE7SUFDeEYsRUFBRSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLGFBQWE7Q0FDdkUsQ0FBQztBQUVGLDhCQUE4QixJQUFvQjtJQUNoRCxJQUFNLFVBQVUsR0FBRyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDeEQsT0FBTztRQUNMLFVBQVUsRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDLGFBQWE7UUFDMUMsV0FBVyxFQUFFLENBQUMsVUFBVTtLQUN6QixDQUFDO0FBQ0osQ0FBQztBQUVELHFCQUNJLElBQTRCLEVBQUUsU0FBOEIsRUFDNUQsTUFBc0I7SUFDeEIsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNsRSxDQUFDO0FBRUQsYUFBYTtBQUNiLGlDQUFpQyxpQkFBeUI7SUFDeEQsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUM7U0FDOUIsTUFBTSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDM0UsQ0FBQztBQUVELDJCQUNJLFlBQTBCLEVBQUUsT0FBOEMsRUFDMUUsYUFBMkM7SUFDdkMsSUFBQSw0Q0FBbUYsRUFBbEYsa0NBQWMsRUFBRSxvREFBdUIsQ0FBNEM7SUFDMUYscURBQXFEO0lBQ3JELElBQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxDQUFDLEdBQUcsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEUsdUJBQXVCLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQztJQUMxRixJQUFBLGtEQUF5RSxFQUF4RSwwQkFBVSxFQUFFLDRCQUFXLENBQWtEO0lBRWhGLDJGQUEyRjtJQUMzRixVQUFVO0lBQ1YsSUFBTSxJQUFJLEdBQUc7UUFDWCxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztRQUNwQixjQUFjO0tBQ2YsQ0FBQztJQUVGLElBQUksV0FBVyxFQUFFO1FBQ2YsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQztLQUNsRDtTQUFNO1FBQ0wsSUFBSSxDQUFDLElBQUksT0FBVCxJQUFJLG1CQUFTLHVCQUF1QixHQUFFO0tBQ3ZDO0lBRUQsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBVUQscUVBQXFFO0FBQ3JFLElBQU0sa0JBQWtCLEdBQUcsZ0JBQWdCLENBQUM7QUEyQjVDO0lBUUUsc0JBQTJCLFlBQXdCLEVBQVUsTUFBZ0M7UUFBbEUsNkJBQUEsRUFBQSxnQkFBd0I7UUFBVSx1QkFBQSxFQUFBLGFBQWdDO1FBQWxFLGlCQUFZLEdBQVosWUFBWSxDQUFZO1FBQVUsV0FBTSxHQUFOLE1BQU0sQ0FBMEI7UUFQN0YsNkRBQTZEO1FBQ3JELFFBQUcsR0FBRyxJQUFJLEdBQUcsRUFBdUIsQ0FBQztRQUNyQyx1QkFBa0IsR0FBRyxDQUFDLENBQUM7UUFDdkIsd0JBQW1CLEdBQXVCLElBQUksQ0FBQztJQUl5QyxDQUFDO0lBRWpHLDBCQUFHLEdBQUgsVUFBSSxJQUFZO1FBQ2QsSUFBSSxPQUFPLEdBQXNCLElBQUksQ0FBQztRQUN0QyxPQUFPLE9BQU8sRUFBRTtZQUNkLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLElBQUksS0FBSyxJQUFJLElBQUksRUFBRTtnQkFDakIsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO29CQUNwQixrREFBa0Q7b0JBQ2xELEtBQUssR0FBRzt3QkFDTixjQUFjLEVBQUUsS0FBSyxDQUFDLGNBQWM7d0JBQ3BDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRzt3QkFDZCxvQkFBb0IsRUFBRSxLQUFLLENBQUMsb0JBQW9CO3dCQUNoRCxPQUFPLEVBQUUsS0FBSzt3QkFDZCxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVE7cUJBQ3pCLENBQUM7b0JBRUYsMkJBQTJCO29CQUMzQixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQzFCLHlDQUF5QztvQkFDekMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUMxQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO2lCQUM3QztnQkFFRCxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUU7b0JBQ2hELEtBQUssQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO2lCQUN0QjtnQkFDRCxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUM7YUFDbEI7WUFDRCxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztTQUMxQjtRQUVELG9GQUFvRjtRQUNwRiwwRUFBMEU7UUFDMUUsa0ZBQWtGO1FBQ2xGLDZFQUE2RTtRQUM3RSxPQUFPLElBQUksQ0FBQyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxRSxDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSCwwQkFBRyxHQUFILFVBQUksY0FBc0IsRUFBRSxJQUFZLEVBQUUsR0FBa0IsRUFDeEQsUUFBOEMsRUFDOUMsb0JBQThDO1FBRDlDLHlCQUFBLEVBQUEsMEJBQThDO1FBRWhELENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ2YsS0FBSyxDQUFDLGNBQVksSUFBSSwyQ0FBc0MsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFHLENBQUMsQ0FBQztRQUN0RixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUU7WUFDakIsY0FBYyxFQUFFLGNBQWM7WUFDOUIsR0FBRyxFQUFFLEdBQUc7WUFDUixPQUFPLEVBQUUsS0FBSztZQUNkLG9CQUFvQixFQUFFLG9CQUFvQjtZQUMxQyxRQUFRLEVBQUUsUUFBUTtTQUNuQixDQUFDLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCwrQkFBUSxHQUFSLFVBQVMsSUFBWSxJQUF5QixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXRFLGtDQUFXLEdBQVgsVUFBWSxLQUFhO1FBQ3ZCLElBQU0sUUFBUSxHQUFHLElBQUksWUFBWSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMvQyxJQUFJLEtBQUssR0FBRyxDQUFDO1lBQUUsUUFBUSxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFFRCwyQ0FBb0IsR0FBcEIsVUFBcUIsY0FBc0I7UUFDekMsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEdBQUcsY0FBYyxDQUFDLENBQUM7UUFDdkUsT0FBTyxZQUFZLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ3hFLENBQUM7SUFFRCxvREFBNkIsR0FBN0IsVUFBOEIsS0FBa0I7UUFDOUMsSUFBSSxLQUFLLENBQUMsUUFBUSxvQkFBZ0MsRUFBRTtZQUNsRCxJQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDN0UsSUFBSSxZQUFZLEVBQUU7Z0JBQ2hCLFlBQVksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO2FBQzdCO2lCQUFNO2dCQUNMLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7YUFDckQ7U0FDRjtJQUNILENBQUM7SUFFRCwrQ0FBd0IsR0FBeEIsVUFBeUIsY0FBc0I7UUFDN0MsSUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxjQUFjLEVBQUU7WUFDaEQsY0FBYyxFQUFFLGNBQWM7WUFDOUIsR0FBRyxFQUFFLEdBQUc7WUFDUixvQkFBb0IsRUFBRSxVQUFDLEtBQW1CLEVBQUUsYUFBcUI7Z0JBQy9ELHVCQUF1QjtnQkFDdkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQ3pFLENBQUM7WUFDRCxPQUFPLEVBQUUsS0FBSztZQUNkLFFBQVEsd0JBQW9DO1NBQzdDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCwyQ0FBb0IsR0FBcEIsVUFBcUIsSUFBWTtRQUMvQixJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLENBQUcsQ0FBQztRQUM5RCxjQUFjLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUM5QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekIsT0FBTyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQsdUNBQWdCLEdBQWhCLFVBQWlCLGNBQXNCO1FBQ3JDLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ2hFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBUSxDQUFDLG1CQUFtQixFQUFFO2dCQUN0Qyw2RUFBNkU7Z0JBQzdFLElBQUksQ0FBQyxNQUFRLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBUSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQzthQUNwRjtZQUNELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUMsTUFBUSxDQUFDLG1CQUFtQixDQUFDO1NBQzlEO0lBQ0gsQ0FBQztJQUVELDJDQUFvQixHQUFwQjtRQUNFLGVBQWU7UUFDZixPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQzdCLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDMUUsRUFBRSxDQUFDO0lBQ1QsQ0FBQztJQUVELDZDQUFzQixHQUF0QjtRQUNFLHdCQUF3QjtRQUN4QixJQUFNLHlCQUF5QixHQUFHLFdBQVcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMzRSxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQzdCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN6RSxFQUFFLENBQUM7SUFDVCxDQUFDO0lBRUQsc0NBQWUsR0FBZixjQUFvQixPQUFPLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEtBQUssSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFFM0YsMkNBQW9CLEdBQXBCO1FBQUEsaUJBV0M7UUFWQyxJQUFJLG1CQUFtQixHQUFHLENBQUMsQ0FBQztRQUM1QixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQzthQUMvQixNQUFNLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsT0FBTyxFQUFiLENBQWEsQ0FBQzthQUM5QixJQUFJLENBQUMsVUFBQyxDQUFDLEVBQUUsQ0FBQyxJQUFLLE9BQUEsQ0FBQyxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUMsY0FBYyxJQUFJLENBQUMsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBOUQsQ0FBOEQsQ0FBQzthQUM5RSxNQUFNLENBQUMsVUFBQyxLQUFvQixFQUFFLEtBQWtCO1lBQy9DLElBQU0sU0FBUyxHQUFHLEtBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQztZQUMzRCxJQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsb0JBQXNCLENBQUMsS0FBSSxFQUFFLFNBQVMsR0FBRyxtQkFBbUIsQ0FBQyxDQUFDO1lBQ3RGLG1CQUFtQixHQUFHLFNBQVMsQ0FBQztZQUNoQyxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakMsQ0FBQyxFQUFFLEVBQUUsQ0FBa0IsQ0FBQztJQUM5QixDQUFDO0lBR0QseUNBQWtCLEdBQWxCO1FBQ0UsSUFBSSxPQUFPLEdBQWlCLElBQUksQ0FBQztRQUNqQyxnRUFBZ0U7UUFDaEUsT0FBTyxPQUFPLENBQUMsTUFBTTtZQUFFLE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQ2hELElBQU0sR0FBRyxHQUFHLEtBQUcsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixFQUFJLENBQUM7UUFDakUsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBN0pNLHVCQUFVLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUE4SmhGLG1CQUFDO0NBQUEsQUFwS0QsSUFvS0M7U0FwS1ksWUFBWTtBQXNLekI7O0dBRUc7QUFDSCwyQkFBMkIsR0FBVyxFQUFFLFVBQW9DO0lBQzFFLElBQU0sV0FBVyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7SUFFdEMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUU1QixNQUFNLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsSUFBSTtRQUNsRCxJQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFL0IsV0FBVyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdEMsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssT0FBTyxFQUFFO1lBQ2xDLElBQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0MsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFBLFNBQVMsSUFBSSxPQUFBLFdBQVcsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLEVBQW5DLENBQW1DLENBQUMsQ0FBQztTQUNuRTtJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxXQUFXLENBQUM7QUFDckIsQ0FBQztBQUVELHlCQUF5QjtBQUN6QixZQUFZO0FBQ1oseUJBQXlCO0FBQ3pCLGdDQUFnQztBQUNoQyx1QkFBdUIsSUFBYTs7SUFDbEMsSUFBSSxPQUF5QixDQUFDO0lBQzlCLElBQUksV0FBNkIsQ0FBQztJQUNsQyxJQUFJLEVBQW9CLENBQUM7SUFFekIsSUFBSSxJQUFJLEVBQUU7UUFDUixrRUFBa0U7UUFDbEUsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUUzQyxJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDbEQsSUFBSSxjQUFjLFNBQVEsQ0FBQztRQUMzQix1R0FDbUYsRUFEbEYsc0JBQWMsRUFBRSxVQUFFLENBQ2lFO1FBQ3BGOztvQ0FFd0IsRUFGdkIsZUFBTyxFQUFFLG1CQUFXLENBRUk7S0FDMUI7SUFFRCxPQUFPLEVBQUMsV0FBVyxhQUFBLEVBQUUsRUFBRSxJQUFBLEVBQUUsT0FBTyxTQUFBLEVBQUMsQ0FBQztBQUNwQyxDQUFDO0FBRUQscUJBQXFCLElBQW9CO0lBQ3ZDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUUsNkNBQTZDO0lBQ3BFLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNuQixLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN2RDtJQUNELENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssQ0FBQywyQ0FBeUMsSUFBSSxDQUFDLE1BQVEsQ0FBQyxDQUFDO0lBQ2xFLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEUsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSx3QkFDRixRQUFnQixFQUFFLFdBQW1CLEVBQUUsT0FBNkM7SUFBN0Msd0JBQUEsRUFBQSxZQUE2QztJQUV0RixJQUFNLGFBQWEsR0FBRyxpQkFBaUIsRUFBRSxDQUFDO0lBQzFDLElBQU0sVUFBVSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7SUFDcEMsSUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFNUQsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUN2RCxPQUFPLEVBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLEVBQUUsRUFBQyxDQUFDO0tBQzdGO0lBRUQsSUFBSSxTQUFTLEdBQWdCLFdBQVcsQ0FBQyxTQUFTLENBQUM7SUFDbkQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRTtRQUNoQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7S0FDL0Q7SUFFSyxJQUFBLGtEQUMyQyxFQUQxQyxnQkFBSyxFQUFFLDhCQUFZLEVBQUUsMENBQWtCLEVBQUUsa0JBQU0sQ0FDSjtJQUNsRCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUMvQixPQUFPLEVBQUMsTUFBTSxRQUFBLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLEVBQUUsRUFBQyxDQUFDO0tBQ3pFO0lBRUQsT0FBTyxFQUFDLEtBQUssT0FBQSxFQUFFLFlBQVksY0FBQSxFQUFFLGtCQUFrQixvQkFBQSxFQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTTtJQUNKLE9BQU8sSUFBSSxhQUFhLENBQ3BCLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsRUFBRSw0QkFBNEIsRUFBRSxJQUFJLHdCQUF3QixFQUFFLEVBQUUsSUFBSSxFQUMzRixFQUFFLENBQUMsQ0FBQztBQUNWLENBQUM7QUFFRCx3QkFBd0IsS0FBdUI7SUFDN0MsT0FBTyxLQUFLLENBQUMsSUFBSSxJQUFJLFdBQVcsSUFBSSxLQUFLLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQztBQUM1RCxDQUFDO0FBRUQsK0JBQStCLEtBQXVCLEVBQUUsT0FBNkI7SUFDbkYsUUFBUSxPQUFPLEVBQUU7UUFDZixLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSTtZQUM1QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNO1lBQzlCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDekMsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUs7WUFDN0IseUVBQXlFO1lBQ3pFLDZFQUE2RTtZQUM3RSxzRUFBc0U7WUFDdEUsT0FBTyxLQUFLLENBQUMsSUFBSSxzQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUN0RixLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRztZQUMzQixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3RDLEtBQUssSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZO1lBQ3BDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUM5QztZQUNFLE9BQU8sSUFBSSxDQUFDO0tBQ2Y7QUFDSCxDQUFDO0FBRUQsNEJBQTRCLElBQVk7SUFDdEMsUUFBUSxJQUFJLEVBQUU7UUFDWixLQUFLLGtCQUFrQixDQUFDO1FBQ3hCLEtBQUssWUFBWSxDQUFDO1FBQ2xCLEtBQUssY0FBYyxDQUFDO1FBQ3BCLEtBQUssUUFBUSxDQUFDO1FBQ2QsS0FBSyxZQUFZLENBQUM7UUFDbEIsS0FBSyxrQkFBa0I7WUFDckIsT0FBTyxJQUFJLENBQUM7S0FDZjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmbGF0dGVuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgQnVpbHRpbkZ1bmN0aW9uQ2FsbCwgTG9jYWxSZXNvbHZlciwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmd9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbFByaW1pdGl2ZSwgUHJvcGVydHlSZWFkfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtMZXhlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtQYXJzZXJ9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL3BhcnNlcic7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7aHRtbEFzdFRvUmVuZGVyM0FzdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcblxuaW1wb3J0IHtSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7cGFyc2VTdHlsZX0gZnJvbSAnLi9zdHlsaW5nJztcbmltcG9ydCB7Q09OVEVYVF9OQU1FLCBJMThOX0FUVFIsIEkxOE5fQVRUUl9QUkVGSVgsIElEX1NFUEFSQVRPUiwgSU1QTElDSVRfUkVGRVJFTkNFLCBNRUFOSU5HX1NFUEFSQVRPUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBhc0xpdGVyYWwsIGludmFsaWQsIG1hcFRvRXhwcmVzc2lvbiwgdHJpbVRyYWlsaW5nTnVsbHMsIHVuc3VwcG9ydGVkfSBmcm9tICcuL3V0aWwnO1xuXG5mdW5jdGlvbiBtYXBCaW5kaW5nVG9JbnN0cnVjdGlvbih0eXBlOiBCaW5kaW5nVHlwZSk6IG8uRXh0ZXJuYWxSZWZlcmVuY2V8dW5kZWZpbmVkIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgIHJldHVybiBSMy5lbGVtZW50UHJvcGVydHk7XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU6XG4gICAgICByZXR1cm4gUjMuZWxlbWVudEF0dHJpYnV0ZTtcbiAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgcmV0dXJuIFIzLmVsZW1lbnRDbGFzc1Byb3A7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuLy8gIGlmIChyZiAmIGZsYWdzKSB7IC4uIH1cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgZmxhZ3M6IGNvcmUuUmVuZGVyRmxhZ3MsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pOiBvLklmU3RtdCB7XG4gIHJldHVybiBvLmlmU3RtdChvLnZhcmlhYmxlKFJFTkRFUl9GTEFHUykuYml0d2lzZUFuZChvLmxpdGVyYWwoZmxhZ3MpLCBudWxsLCBmYWxzZSksIHN0YXRlbWVudHMpO1xufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuXG4gICAqIFRoaXMgZW5zdXJlcyBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuIFRoaXMgZW5zdXJlc1xuICAgKiBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF91cGRhdGVDb2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcbiAgLyoqIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZ2VuZXJhdGVkIGZyb20gdmlzaXRpbmcgcGlwZXMsIGxpdGVyYWxzLCBldGMuICovXG4gIHByaXZhdGUgX3RlbXBWYXJpYWJsZXM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGJ1aWxkIG5lc3RlZCB0ZW1wbGF0ZXMuIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbFxuICAgKiBhZnRlciB0aGUgcGFyZW50IHRlbXBsYXRlIGhhcyBmaW5pc2hlZCB2aXNpdGluZyBhbGwgb2YgaXRzIG5vZGVzLiBUaGlzIGVuc3VyZXMgdGhhdCBhbGxcbiAgICogbG9jYWwgcmVmIGJpbmRpbmdzIGluIG5lc3RlZCB0ZW1wbGF0ZXMgYXJlIGFibGUgdG8gZmluZCBsb2NhbCByZWYgdmFsdWVzIGlmIHRoZSByZWZzXG4gICAqIGFyZSBkZWZpbmVkIGFmdGVyIHRoZSB0ZW1wbGF0ZSBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgX25lc3RlZFRlbXBsYXRlRm5zOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICAvKipcbiAgICogVGhpcyBzY29wZSBjb250YWlucyBsb2NhbCB2YXJpYWJsZXMgZGVjbGFyZWQgaW4gdGhlIHVwZGF0ZSBtb2RlIGJsb2NrIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICogKGUuZy4gcmVmcyBhbmQgY29udGV4dCB2YXJzIGluIGJpbmRpbmdzKVxuICAgKi9cbiAgcHJpdmF0ZSBfYmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGU7XG4gIHByaXZhdGUgX3ZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcjtcbiAgcHJpdmF0ZSBfdW5zdXBwb3J0ZWQgPSB1bnN1cHBvcnRlZDtcblxuICAvLyBXaGV0aGVyIHdlIGFyZSBpbnNpZGUgYSB0cmFuc2xhdGFibGUgZWxlbWVudCAoYDxwIGkxOG4+Li4uIHNvbWV3aGVyZSBoZXJlIC4uLiA8L3A+KVxuICBwcml2YXRlIF9pbkkxOG5TZWN0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgX2kxOG5TZWN0aW9uSW5kZXggPSAtMTtcbiAgLy8gTWFwcyBvZiBwbGFjZWhvbGRlciB0byBub2RlIGluZGV4ZXMgZm9yIGVhY2ggb2YgdGhlIGkxOG4gc2VjdGlvblxuICBwcml2YXRlIF9waFRvTm9kZUlkeGVzOiB7W3BoTmFtZTogc3RyaW5nXTogbnVtYmVyW119W10gPSBbe31dO1xuXG4gIC8vIE51bWJlciBvZiBzbG90cyB0byByZXNlcnZlIGZvciBwdXJlRnVuY3Rpb25zXG4gIHByaXZhdGUgX3B1cmVGdW5jdGlvblNsb3RzID0gMDtcblxuICAvLyBOdW1iZXIgb2YgYmluZGluZyBzbG90c1xuICBwcml2YXRlIF9iaW5kaW5nU2xvdHMgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgdGVtcGxhdGVOYW1lOiBzdHJpbmd8bnVsbCxcbiAgICAgIHByaXZhdGUgdmlld1F1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLCBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLFxuICAgICAgcHJpdmF0ZSBkaXJlY3RpdmVzOiBTZXQ8by5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPixcbiAgICAgIHByaXZhdGUgcGlwZXM6IFNldDxvLkV4cHJlc3Npb24+LCBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UpIHtcbiAgICAvLyB2aWV3IHF1ZXJpZXMgY2FuIHRha2UgdXAgc3BhY2UgaW4gZGF0YSBhbmQgYWxsb2NhdGlvbiBoYXBwZW5zIGVhcmxpZXIgKGluIHRoZSBcInZpZXdRdWVyeVwiXG4gICAgLy8gZnVuY3Rpb24pXG4gICAgdGhpcy5fZGF0YUluZGV4ID0gdmlld1F1ZXJpZXMubGVuZ3RoO1xuXG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciA9PiB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSBudW1TbG90cyxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBwaXBlVHlwZSA9IHBpcGVUeXBlQnlOYW1lLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAocGlwZVR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMucGlwZXMuYWRkKHBpcGVUeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldCh0aGlzLmxldmVsLCBsb2NhbE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucGlwZSwgW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHZhcmlhYmxlOiB0LlZhcmlhYmxlKSB7XG4gICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZS5uYW1lICsgc2NvcGVkTmFtZSk7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHZhcmlhYmxlLm5hbWUsIGxocywgRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhULFxuICAgICAgICAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgbGV0IHJoczogby5FeHByZXNzaW9uO1xuICAgICAgICAgIGlmIChzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsKSB7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eFxuICAgICAgICAgICAgcmhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzaGFyZWRDdHhWYXIgPSBzY29wZS5nZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eF9yMCAgIE9SICB4KDIpO1xuICAgICAgICAgICAgcmhzID0gc2hhcmVkQ3R4VmFyID8gc2hhcmVkQ3R4VmFyIDogZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGl0ZW0kID0geCgyKS4kaW1wbGljaXQ7XG4gICAgICAgICAgcmV0dXJuIFtsaHMuc2V0KHJocy5wcm9wKHZhcmlhYmxlLnZhbHVlIHx8IElNUExJQ0lUX1JFRkVSRU5DRSkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIGhhc05nQ29udGVudDogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdKTogby5GdW5jdGlvbkV4cHIge1xuICAgIGlmICh0aGlzLl9uYW1lc3BhY2UgIT09IFIzLm5hbWVzcGFjZUhUTUwpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCB0aGlzLl9uYW1lc3BhY2UpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB2YXJpYWJsZSBiaW5kaW5nc1xuICAgIHZhcmlhYmxlcy5mb3JFYWNoKHYgPT4gdGhpcy5yZWdpc3RlckNvbnRleHRWYXJpYWJsZXModikpO1xuXG4gICAgLy8gT3V0cHV0IGEgYFByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIHdoZW4gc29tZSBgPG5nLWNvbnRlbnQ+YCBhcmUgcHJlc2VudFxuICAgIGlmIChoYXNOZ0NvbnRlbnQpIHtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICAgIC8vIE9ubHkgc2VsZWN0b3JzIHdpdGggYSBub24tZGVmYXVsdCB2YWx1ZSBhcmUgZ2VuZXJhdGVkXG4gICAgICBpZiAobmdDb250ZW50U2VsZWN0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY29uc3QgcjNTZWxlY3RvcnMgPSBuZ0NvbnRlbnRTZWxlY3RvcnMubWFwKHMgPT4gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHMpKTtcbiAgICAgICAgLy8gYHByb2plY3Rpb25EZWZgIG5lZWRzIGJvdGggdGhlIHBhcnNlZCBhbmQgcmF3IHZhbHVlIG9mIHRoZSBzZWxlY3RvcnNcbiAgICAgICAgY29uc3QgcGFyc2VkID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyM1NlbGVjdG9ycyksIHRydWUpO1xuICAgICAgICBjb25zdCB1blBhcnNlZCA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwobmdDb250ZW50U2VsZWN0b3JzKSwgdHJ1ZSk7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChwYXJzZWQsIHVuUGFyc2VkKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnByb2plY3Rpb25EZWYsIHBhcmFtZXRlcnMpO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaXMgdGhlIGluaXRpYWwgcGFzcyB0aHJvdWdoIHRoZSBub2RlcyBvZiB0aGlzIHRlbXBsYXRlLiBJbiB0aGlzIHBhc3MsIHdlXG4gICAgLy8gcXVldWUgYWxsIGNyZWF0aW9uIG1vZGUgYW5kIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyBmb3IgZ2VuZXJhdGlvbiBpbiB0aGUgc2Vjb25kXG4gICAgLy8gcGFzcy4gSXQncyBuZWNlc3NhcnkgdG8gc2VwYXJhdGUgdGhlIHBhc3NlcyB0byBlbnN1cmUgbG9jYWwgcmVmcyBhcmUgZGVmaW5lZCBiZWZvcmVcbiAgICAvLyByZXNvbHZpbmcgYmluZGluZ3MuXG4gICAgdC52aXNpdEFsbCh0aGlzLCBub2Rlcyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBwcm9wZXJ0eSBvciB0ZXh0IGJpbmRpbmdzKVxuICAgIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHMgPSB0aGlzLl91cGRhdGVDb2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMpXG4gICAgY29uc3QgY3JlYXRpb25TdGF0ZW1lbnRzID0gdGhpcy5fY3JlYXRpb25Db2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vIFRvIGNvdW50IHNsb3RzIGZvciB0aGUgcmVzZXJ2ZVNsb3RzKCkgaW5zdHJ1Y3Rpb24sIGFsbCBiaW5kaW5ncyBtdXN0IGhhdmUgYmVlbiB2aXNpdGVkLlxuICAgIGlmICh0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyA+IDApIHtcbiAgICAgIGNyZWF0aW9uU3RhdGVtZW50cy5wdXNoKFxuICAgICAgICAgIGluc3RydWN0aW9uKG51bGwsIFIzLnJlc2VydmVTbG90cywgW28ubGl0ZXJhbCh0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyldKS50b1N0bXQoKSk7XG4gICAgfVxuXG4gICAgLy8gIFZhcmlhYmxlIGRlY2xhcmF0aW9uIG11c3Qgb2NjdXIgYWZ0ZXIgYmluZGluZyByZXNvbHV0aW9uIHNvIHdlIGNhbiBnZW5lcmF0ZSBjb250ZXh0XG4gICAgLy8gIGluc3RydWN0aW9ucyB0aGF0IGJ1aWxkIG9uIGVhY2ggb3RoZXIuIGUuZy4gY29uc3QgYiA9IHgoKS4kaW1wbGljaXQoKTsgY29uc3QgYiA9IHgoKTtcbiAgICBjb25zdCBjcmVhdGlvblZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk7XG4gICAgY29uc3QgdXBkYXRlVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkuY29uY2F0KHRoaXMuX3RlbXBWYXJpYWJsZXMpO1xuXG4gICAgY29uc3QgY3JlYXRpb25CbG9jayA9IGNyZWF0aW9uU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGlvblZhcmlhYmxlcy5jb25jYXQoY3JlYXRpb25TdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICBjb25zdCB1cGRhdGVCbG9jayA9IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVZhcmlhYmxlcy5jb25jYXQodXBkYXRlU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgbWFwcyBvZiBwbGFjZWhvbGRlciBuYW1lIHRvIG5vZGUgaW5kZXhlc1xuICAgIC8vIFRPRE8odmljYik6IFRoaXMgaXMgYSBXSVAsIG5vdCBmdWxseSBzdXBwb3J0ZWQgeWV0XG4gICAgZm9yIChjb25zdCBwaFRvTm9kZUlkeCBvZiB0aGlzLl9waFRvTm9kZUlkeGVzKSB7XG4gICAgICBpZiAoT2JqZWN0LmtleXMocGhUb05vZGVJZHgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgICAgY29uc3QgcGhNYXAgPSBvLnZhcmlhYmxlKHNjb3BlZE5hbWUpLnNldChtYXBUb0V4cHJlc3Npb24ocGhUb05vZGVJZHgsIHRydWUpKS50b0NvbnN0RGVjbCgpO1xuXG4gICAgICAgIHRoaXMuX3ByZWZpeENvZGUucHVzaChwaE1hcCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIC8vIGkuZS4gKHJmOiBSZW5kZXJGbGFncywgY3R4OiBhbnkpXG4gICAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGZvciBxdWVyeSByZWZyZXNoIChpLmUuIGxldCBfdDogYW55OylcbiAgICAgICAgICAuLi50aGlzLl9wcmVmaXhDb2RlLFxuICAgICAgICAgIC8vIENyZWF0aW5nIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuQ3JlYXRlKSB7IC4uLiB9KVxuICAgICAgICAgIC4uLmNyZWF0aW9uQmxvY2ssXG4gICAgICAgICAgLy8gQmluZGluZyBhbmQgcmVmcmVzaCBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLlVwZGF0ZSkgey4uLn0pXG4gICAgICAgICAgLi4udXBkYXRlQmxvY2ssXG4gICAgICAgIF0sXG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdGhpcy50ZW1wbGF0ZU5hbWUpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7IHJldHVybiB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0KG5hbWUpOyB9XG5cbiAgdmlzaXRDb250ZW50KG5nQ29udGVudDogdC5Db250ZW50KSB7XG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHNlbGVjdG9ySW5kZXggPSBuZ0NvbnRlbnQuc2VsZWN0b3JJbmRleDtcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuXG4gICAgY29uc3QgYXR0cmlidXRlQXNMaXN0OiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgbmdDb250ZW50LmF0dHJpYnV0ZXMuZm9yRWFjaCgoYXR0cmlidXRlKSA9PiB7XG4gICAgICBjb25zdCBuYW1lID0gYXR0cmlidXRlLm5hbWU7XG4gICAgICBpZiAobmFtZSAhPT0gJ3NlbGVjdCcpIHtcbiAgICAgICAgYXR0cmlidXRlQXNMaXN0LnB1c2gobmFtZSwgYXR0cmlidXRlLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChhdHRyaWJ1dGVBc0xpc3QubGVuZ3RoID4gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChzZWxlY3RvckluZGV4KSwgYXNMaXRlcmFsKGF0dHJpYnV0ZUFzTGlzdCkpO1xuICAgIH0gZWxzZSBpZiAoc2VsZWN0b3JJbmRleCAhPT0gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChzZWxlY3RvckluZGV4KSk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG5nQ29udGVudC5zb3VyY2VTcGFuLCBSMy5wcm9qZWN0aW9uLCBwYXJhbWV0ZXJzKTtcbiAgfVxuXG5cbiAgZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5OiBzdHJpbmd8bnVsbCkge1xuICAgIHN3aXRjaCAobmFtZXNwYWNlS2V5KSB7XG4gICAgICBjYXNlICdtYXRoJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZU1hdGhNTDtcbiAgICAgIGNhc2UgJ3N2Zyc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VTVkc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlSFRNTDtcbiAgICB9XG4gIH1cblxuICBhZGROYW1lc3BhY2VJbnN0cnVjdGlvbihuc0luc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICB0aGlzLl9uYW1lc3BhY2UgPSBuc0luc3RydWN0aW9uO1xuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIG5zSW5zdHJ1Y3Rpb24pO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsZW1lbnRJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHdhc0luSTE4blNlY3Rpb24gPSB0aGlzLl9pbkkxOG5TZWN0aW9uO1xuXG4gICAgY29uc3Qgb3V0cHV0QXR0cnM6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGNvbnN0IGF0dHJJMThuTWV0YXM6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGxldCBpMThuTWV0YTogc3RyaW5nID0gJyc7XG5cbiAgICBjb25zdCBbbmFtZXNwYWNlS2V5LCBlbGVtZW50TmFtZV0gPSBzcGxpdE5zTmFtZShlbGVtZW50Lm5hbWUpO1xuICAgIGNvbnN0IGlzTmdDb250YWluZXIgPSBjaGVja0lzTmdDb250YWluZXIoZWxlbWVudC5uYW1lKTtcblxuICAgIC8vIEVsZW1lbnRzIGluc2lkZSBpMThuIHNlY3Rpb25zIGFyZSByZXBsYWNlZCB3aXRoIHBsYWNlaG9sZGVyc1xuICAgIC8vIFRPRE8odmljYik6IG5lc3RlZCBlbGVtZW50cyBhcmUgYSBXSVAgaW4gdGhpcyBwaGFzZVxuICAgIGlmICh0aGlzLl9pbkkxOG5TZWN0aW9uKSB7XG4gICAgICBjb25zdCBwaE5hbWUgPSBlbGVtZW50Lm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICghdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdKSB7XG4gICAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF1bcGhOYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdLnB1c2goZWxlbWVudEluZGV4KTtcbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgaTE4biBhdHRyaWJ1dGVzXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHIubmFtZTtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXR0ci52YWx1ZTtcbiAgICAgIGlmIChuYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBDb3VsZCBub3QgbWFyayBhbiBlbGVtZW50IGFzIHRyYW5zbGF0YWJsZSBpbnNpZGUgb2YgYSB0cmFuc2xhdGFibGUgc2VjdGlvbmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2luSTE4blNlY3Rpb24gPSB0cnVlO1xuICAgICAgICB0aGlzLl9pMThuU2VjdGlvbkluZGV4Kys7XG4gICAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF0gPSB7fTtcbiAgICAgICAgaTE4bk1ldGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZS5zdGFydHNXaXRoKEkxOE5fQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgIGF0dHJJMThuTWV0YXNbbmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCldID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRBdHRyc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gbm9uIGkxOG4gYXR0cmlidXRlc1xuICAgIGlmICh0aGlzLmRpcmVjdGl2ZU1hdGNoZXIpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IoZWxlbWVudC5uYW1lLCBvdXRwdXRBdHRycyk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIubWF0Y2goXG4gICAgICAgICAgc2VsZWN0b3IsIChzZWw6IENzc1NlbGVjdG9yLCBzdGF0aWNUeXBlOiBhbnkpID0+IHsgdGhpcy5kaXJlY3RpdmVzLmFkZChzdGF0aWNUeXBlKTsgfSk7XG4gICAgfVxuXG4gICAgLy8gUmVndWxhciBlbGVtZW50IG9yIG5nLWNvbnRhaW5lciBjcmVhdGlvbiBtb2RlXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGVsZW1lbnRJbmRleCldO1xuICAgIGlmICghaXNOZ0NvbnRhaW5lcikge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChlbGVtZW50TmFtZSkpO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IGluaXRpYWxDbGFzc0RlY2xhcmF0aW9uczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgIGNvbnN0IHN0eWxlSW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBjbGFzc0lucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgYWxsT3RoZXJJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIHN3aXRjaCAoaW5wdXQudHlwZSkge1xuICAgICAgICAvLyBbYXR0ci5zdHlsZV0gb3IgW2F0dHIuY2xhc3NdIHNob3VsZCBub3QgYmUgdHJlYXRlZCBhcyBzdHlsaW5nLWJhc2VkXG4gICAgICAgIC8vIGJpbmRpbmdzIHNpbmNlIHRoZXkgYXJlIGludGVuZGVkIHRvIGJlIHdyaXR0ZW4gZGlyZWN0bHkgdG8gdGhlIGF0dHJcbiAgICAgICAgLy8gYW5kIHRoZXJlZm9yZSB3aWxsIHNraXAgYWxsIHN0eWxlL2NsYXNzIHJlc29sdXRpb24gdGhhdCBpcyBwcmVzZW50XG4gICAgICAgIC8vIHdpdGggc3R5bGU9XCJcIiwgW3N0eWxlXT1cIlwiIGFuZCBbc3R5bGUucHJvcF09XCJcIiwgY2xhc3M9XCJcIixcbiAgICAgICAgLy8gW2NsYXNzLnByb3BdPVwiXCIuIFtjbGFzc109XCJcIiBhc3NpZ25tZW50c1xuICAgICAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICAgIGlmIChpbnB1dC5uYW1lID09ICdzdHlsZScpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyBnbyBmaXJzdCBpbiB0aGUgY29tcGlsYXRpb24gKGZvciBbc3R5bGVdKVxuICAgICAgICAgICAgc3R5bGVJbnB1dHMuc3BsaWNlKDAsIDAsIGlucHV0KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGlzQ2xhc3NCaW5kaW5nKGlucHV0KSkge1xuICAgICAgICAgICAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIGdvIGZpcnN0IGluIHRoZSBjb21waWxhdGlvbiAoZm9yIFtjbGFzc10pXG4gICAgICAgICAgICBjbGFzc0lucHV0cy5zcGxpY2UoMCwgMCwgaW5wdXQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbGxPdGhlcklucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQmluZGluZ1R5cGUuU3R5bGU6XG4gICAgICAgICAgc3R5bGVJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgICAgY2xhc3NJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBsZXQgY3VyclN0eWxlSW5kZXggPSAwO1xuICAgIGxldCBjdXJyQ2xhc3NJbmRleCA9IDA7XG4gICAgbGV0IHN0YXRpY1N0eWxlc01hcDoge1trZXk6IHN0cmluZ106IGFueX18bnVsbCA9IG51bGw7XG4gICAgbGV0IHN0YXRpY0NsYXNzZXNNYXA6IHtba2V5OiBzdHJpbmddOiBib29sZWFufXxudWxsID0gbnVsbDtcbiAgICBjb25zdCBzdHlsZXNJbmRleE1hcDoge1trZXk6IHN0cmluZ106IG51bWJlcn0gPSB7fTtcbiAgICBjb25zdCBjbGFzc2VzSW5kZXhNYXA6IHtba2V5OiBzdHJpbmddOiBudW1iZXJ9ID0ge307XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob3V0cHV0QXR0cnMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG91dHB1dEF0dHJzW25hbWVdO1xuICAgICAgaWYgKG5hbWUgPT0gJ3N0eWxlJykge1xuICAgICAgICBzdGF0aWNTdHlsZXNNYXAgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICAgICAgT2JqZWN0LmtleXMoc3RhdGljU3R5bGVzTWFwKS5mb3JFYWNoKHByb3AgPT4geyBzdHlsZXNJbmRleE1hcFtwcm9wXSA9IGN1cnJTdHlsZUluZGV4Kys7IH0pO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09ICdjbGFzcycpIHtcbiAgICAgICAgc3RhdGljQ2xhc3Nlc01hcCA9IHt9O1xuICAgICAgICB2YWx1ZS5zcGxpdCgvXFxzKy9nKS5mb3JFYWNoKGNsYXNzTmFtZSA9PiB7XG4gICAgICAgICAgY2xhc3Nlc0luZGV4TWFwW2NsYXNzTmFtZV0gPSBjdXJyQ2xhc3NJbmRleCsrO1xuICAgICAgICAgIHN0YXRpY0NsYXNzZXNNYXAgIVtjbGFzc05hbWVdID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKG5hbWUpKTtcbiAgICAgICAgaWYgKGF0dHJJMThuTWV0YXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICBjb25zdCBtZXRhID0gcGFyc2VJMThuTWV0YShhdHRySTE4bk1ldGFzW25hbWVdKTtcbiAgICAgICAgICBjb25zdCB2YXJpYWJsZSA9IHRoaXMuY29uc3RhbnRQb29sLmdldFRyYW5zbGF0aW9uKHZhbHVlLCBtZXRhKTtcbiAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2godmFyaWFibGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF0dHJpYnV0ZXMucHVzaChvLmxpdGVyYWwodmFsdWUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgbGV0IGhhc01hcEJhc2VkU3R5bGluZyA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3R5bGVJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGlucHV0ID0gc3R5bGVJbnB1dHNbaV07XG4gICAgICBjb25zdCBpc01hcEJhc2VkU3R5bGVCaW5kaW5nID0gaSA9PT0gMCAmJiBpbnB1dC5uYW1lID09PSAnc3R5bGUnO1xuICAgICAgaWYgKGlzTWFwQmFzZWRTdHlsZUJpbmRpbmcpIHtcbiAgICAgICAgaGFzTWFwQmFzZWRTdHlsaW5nID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXN0eWxlc0luZGV4TWFwLmhhc093blByb3BlcnR5KGlucHV0Lm5hbWUpKSB7XG4gICAgICAgIHN0eWxlc0luZGV4TWFwW2lucHV0Lm5hbWVdID0gY3VyclN0eWxlSW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsYXNzSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnB1dCA9IGNsYXNzSW5wdXRzW2ldO1xuICAgICAgY29uc3QgaXNNYXBCYXNlZENsYXNzQmluZGluZyA9IGkgPT09IDAgJiYgaXNDbGFzc0JpbmRpbmcoaW5wdXQpO1xuICAgICAgaWYgKCFpc01hcEJhc2VkQ2xhc3NCaW5kaW5nICYmICFzdHlsZXNJbmRleE1hcC5oYXNPd25Qcm9wZXJ0eShpbnB1dC5uYW1lKSkge1xuICAgICAgICBjbGFzc2VzSW5kZXhNYXBbaW5wdXQubmFtZV0gPSBjdXJyQ2xhc3NJbmRleCsrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGluIHRoZSBldmVudCB0aGF0IGEgW3N0eWxlXSBiaW5kaW5nIGlzIHVzZWQgdGhlbiBzYW5pdGl6YXRpb24gd2lsbFxuICAgIC8vIGFsd2F5cyBiZSBpbXBvcnRlZCBiZWNhdXNlIGl0IGlzIG5vdCBwb3NzaWJsZSB0byBrbm93IGFoZWFkIG9mIHRpbWVcbiAgICAvLyB3aGV0aGVyIHN0eWxlIGJpbmRpbmdzIHdpbGwgdXNlIG9yIG5vdCB1c2UgYW55IHNhbml0aXphYmxlIHByb3BlcnRpZXNcbiAgICAvLyB0aGF0IGlzU3R5bGVTYW5pdGl6YWJsZSgpIHdpbGwgZGV0ZWN0XG4gICAgbGV0IHVzZURlZmF1bHRTdHlsZVNhbml0aXplciA9IGhhc01hcEJhc2VkU3R5bGluZztcblxuICAgIC8vIHRoaXMgd2lsbCBidWlsZCB0aGUgaW5zdHJ1Y3Rpb25zIHNvIHRoYXQgdGhleSBmYWxsIGludG8gdGhlIGZvbGxvd2luZyBzeW50YXhcbiAgICAvLyA9PiBbcHJvcDEsIHByb3AyLCBwcm9wMywgMCwgcHJvcDEsIHZhbHVlMSwgcHJvcDIsIHZhbHVlMl1cbiAgICBPYmplY3Qua2V5cyhzdHlsZXNJbmRleE1hcCkuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgIHVzZURlZmF1bHRTdHlsZVNhbml0aXplciA9IHVzZURlZmF1bHRTdHlsZVNhbml0aXplciB8fCBpc1N0eWxlU2FuaXRpemFibGUocHJvcCk7XG4gICAgICBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwocHJvcCkpO1xuICAgIH0pO1xuXG4gICAgaWYgKHN0YXRpY1N0eWxlc01hcCkge1xuICAgICAgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKGNvcmUuSW5pdGlhbFN0eWxpbmdGbGFncy5WQUxVRVNfTU9ERSkpO1xuXG4gICAgICBPYmplY3Qua2V5cyhzdGF0aWNTdHlsZXNNYXApLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChwcm9wKSk7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gc3RhdGljU3R5bGVzTWFwICFbcHJvcF07XG4gICAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbCh2YWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoY2xhc3Nlc0luZGV4TWFwKS5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHByb3ApKTtcbiAgICB9KTtcblxuICAgIGlmIChzdGF0aWNDbGFzc2VzTWFwKSB7XG4gICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwoY29yZS5Jbml0aWFsU3R5bGluZ0ZsYWdzLlZBTFVFU19NT0RFKSk7XG5cbiAgICAgIE9iamVjdC5rZXlzKHN0YXRpY0NsYXNzZXNNYXApLmZvckVhY2goY2xhc3NOYW1lID0+IHtcbiAgICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKGNsYXNzTmFtZSkpO1xuICAgICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwodHJ1ZSkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgaGFzU3R5bGluZ0luc3RydWN0aW9ucyA9IGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5sZW5ndGggfHwgc3R5bGVJbnB1dHMubGVuZ3RoIHx8XG4gICAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5sZW5ndGggfHwgY2xhc3NJbnB1dHMubGVuZ3RoO1xuXG4gICAgY29uc3QgYXR0ckFyZzogby5FeHByZXNzaW9uID0gYXR0cmlidXRlcy5sZW5ndGggPiAwID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVzKSwgdHJ1ZSkgOlxuICAgICAgICBvLlRZUEVEX05VTExfRVhQUjtcbiAgICBwYXJhbWV0ZXJzLnB1c2goYXR0ckFyZyk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxkaXYgI2ZvbyAjYmFyPVwiYmF6XCI+KVxuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnByZXBhcmVSZWZzUGFyYW1ldGVyKGVsZW1lbnQucmVmZXJlbmNlcykpO1xuXG4gICAgY29uc3Qgd2FzSW5OYW1lc3BhY2UgPSB0aGlzLl9uYW1lc3BhY2U7XG4gICAgY29uc3QgY3VycmVudE5hbWVzcGFjZSA9IHRoaXMuZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5KTtcblxuICAgIC8vIElmIHRoZSBuYW1lc3BhY2UgaXMgY2hhbmdpbmcgbm93LCBpbmNsdWRlIGFuIGluc3RydWN0aW9uIHRvIGNoYW5nZSBpdFxuICAgIC8vIGR1cmluZyBlbGVtZW50IGNyZWF0aW9uLlxuICAgIGlmIChjdXJyZW50TmFtZXNwYWNlICE9PSB3YXNJbk5hbWVzcGFjZSkge1xuICAgICAgdGhpcy5hZGROYW1lc3BhY2VJbnN0cnVjdGlvbihjdXJyZW50TmFtZXNwYWNlLCBlbGVtZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCBpbXBsaWNpdCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcblxuICAgIGNvbnN0IGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24gPSAhaGFzU3R5bGluZ0luc3RydWN0aW9ucyAmJiAhaXNOZ0NvbnRhaW5lciAmJlxuICAgICAgICBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA9PT0gMCAmJiBlbGVtZW50Lm91dHB1dHMubGVuZ3RoID09PSAwO1xuXG4gICAgaWYgKGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnQsIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJTdGFydCA6IFIzLmVsZW1lbnRTdGFydCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICAgIC8vIGluaXRpYWwgc3R5bGluZyBmb3Igc3RhdGljIHN0eWxlPVwiLi4uXCIgYXR0cmlidXRlc1xuICAgICAgaWYgKGhhc1N0eWxpbmdJbnN0cnVjdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcGFyYW1zTGlzdDogKG8uRXhwcmVzc2lvbilbXSA9IFtdO1xuXG4gICAgICAgIGlmIChpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdGhlIHRlbXBsYXRlIGNvbXBpbGVyIGhhbmRsZXMgaW5pdGlhbCBjbGFzcyBzdHlsaW5nIChlLmcuIGNsYXNzPVwiZm9vXCIpIHZhbHVlc1xuICAgICAgICAgIC8vIGluIGEgc3BlY2lhbCBjb21tYW5kIGNhbGxlZCBgZWxlbWVudENsYXNzYCBzbyB0aGF0IHRoZSBpbml0aWFsIGNsYXNzXG4gICAgICAgICAgLy8gY2FuIGJlIHByb2Nlc3NlZCBkdXJpbmcgcnVudGltZS4gVGhlc2UgaW5pdGlhbCBjbGFzcyB2YWx1ZXMgYXJlIGJvdW5kIHRvXG4gICAgICAgICAgLy8gYSBjb25zdGFudCBiZWNhdXNlIHRoZSBpbml0YWwgY2xhc3MgdmFsdWVzIGRvIG5vdCBjaGFuZ2UgKHNpbmNlIHRoZXkncmUgc3RhdGljKS5cbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goXG4gICAgICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zKSwgdHJ1ZSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5sZW5ndGggfHwgdXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyKSB7XG4gICAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAvLyB0aGUgdGVtcGxhdGUgY29tcGlsZXIgaGFuZGxlcyBpbml0aWFsIHN0eWxlIChlLmcuIHN0eWxlPVwiZm9vXCIpIHZhbHVlc1xuICAgICAgICAgIC8vIGluIGEgc3BlY2lhbCBjb21tYW5kIGNhbGxlZCBgZWxlbWVudFN0eWxlYCBzbyB0aGF0IHRoZSBpbml0aWFsIHN0eWxlc1xuICAgICAgICAgIC8vIGNhbiBiZSBwcm9jZXNzZWQgZHVyaW5nIHJ1bnRpbWUuIFRoZXNlIGluaXRpYWwgc3R5bGVzIHZhbHVlcyBhcmUgYm91bmQgdG9cbiAgICAgICAgICAvLyBhIGNvbnN0YW50IGJlY2F1c2UgdGhlIGluaXRhbCBzdHlsZSB2YWx1ZXMgZG8gbm90IGNoYW5nZSAoc2luY2UgdGhleSdyZSBzdGF0aWMpLlxuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChcbiAgICAgICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMpLCB0cnVlKSk7XG4gICAgICAgIH0gZWxzZSBpZiAodXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyKSB7XG4gICAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHVzZURlZmF1bHRTdHlsZVNhbml0aXplcikge1xuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChvLmltcG9ydEV4cHIoUjMuZGVmYXVsdFN0eWxlU2FuaXRpemVyKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMuZWxlbWVudFN0eWxpbmcsIHBhcmFtc0xpc3QpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZW5lcmF0ZSBMaXN0ZW5lcnMgKG91dHB1dHMpXG4gICAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+IHtcbiAgICAgICAgY29uc3QgZWxOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKGVsZW1lbnQubmFtZSk7XG4gICAgICAgIGNvbnN0IGV2TmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihvdXRwdXRBc3QubmFtZSk7XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke2VsTmFtZX1fJHtldk5hbWV9X2xpc3RlbmVyYDtcblxuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24ob3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLCAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbGlzdGVuZXJTY29wZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5uZXN0ZWRTY29wZSh0aGlzLl9iaW5kaW5nU2NvcGUuYmluZGluZ0xldmVsKTtcblxuICAgICAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgICAgICAgICAgIGxpc3RlbmVyU2NvcGUsIGltcGxpY2l0LCBvdXRwdXRBc3QuaGFuZGxlciwgJ2InLFxuICAgICAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuXG4gICAgICAgICAgY29uc3Qgc3RhdGVtZW50cyA9IFtcbiAgICAgICAgICAgIC4uLmxpc3RlbmVyU2NvcGUucmVzdG9yZVZpZXdTdGF0ZW1lbnQoKSwgLi4ubGlzdGVuZXJTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLFxuICAgICAgICAgICAgLi4uYmluZGluZ0V4cHIucmVuZGVyM1N0bXRzXG4gICAgICAgICAgXTtcblxuICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBvLmZuKFxuICAgICAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSwgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLFxuICAgICAgICAgICAgICBmdW5jdGlvbk5hbWUpO1xuXG4gICAgICAgICAgcmV0dXJuIFtvLmxpdGVyYWwob3V0cHV0QXN0Lm5hbWUpLCBoYW5kbGVyXTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoKHN0eWxlSW5wdXRzLmxlbmd0aCB8fCBjbGFzc0lucHV0cy5sZW5ndGgpICYmIGhhc1N0eWxpbmdJbnN0cnVjdGlvbnMpIHtcbiAgICAgIGNvbnN0IGluZGV4TGl0ZXJhbCA9IG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpO1xuXG4gICAgICBjb25zdCBmaXJzdFN0eWxlID0gc3R5bGVJbnB1dHNbMF07XG4gICAgICBjb25zdCBtYXBCYXNlZFN0eWxlSW5wdXQgPSBmaXJzdFN0eWxlICYmIGZpcnN0U3R5bGUubmFtZSA9PSAnc3R5bGUnID8gZmlyc3RTdHlsZSA6IG51bGw7XG5cbiAgICAgIGNvbnN0IGZpcnN0Q2xhc3MgPSBjbGFzc0lucHV0c1swXTtcbiAgICAgIGNvbnN0IG1hcEJhc2VkQ2xhc3NJbnB1dCA9IGZpcnN0Q2xhc3MgJiYgaXNDbGFzc0JpbmRpbmcoZmlyc3RDbGFzcykgPyBmaXJzdENsYXNzIDogbnVsbDtcblxuICAgICAgY29uc3Qgc3R5bGluZ0lucHV0ID0gbWFwQmFzZWRTdHlsZUlucHV0IHx8IG1hcEJhc2VkQ2xhc3NJbnB1dDtcbiAgICAgIGlmIChzdHlsaW5nSW5wdXQpIHtcbiAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICBsZXQgdmFsdWU6IEFTVDtcbiAgICAgICAgaWYgKG1hcEJhc2VkQ2xhc3NJbnB1dCkge1xuICAgICAgICAgIHZhbHVlID0gbWFwQmFzZWRDbGFzc0lucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgfSBlbHNlIGlmIChtYXBCYXNlZFN0eWxlSW5wdXQpIHtcbiAgICAgICAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWFwQmFzZWRTdHlsZUlucHV0KSB7XG4gICAgICAgICAgdmFsdWUgPSBtYXBCYXNlZFN0eWxlSW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzdHlsaW5nSW5wdXQuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxpbmdNYXAsICgpID0+IHtcbiAgICAgICAgICBwYXJhbXMucHVzaCh0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlLCB0cnVlKSk7XG4gICAgICAgICAgcmV0dXJuIFtpbmRleExpdGVyYWwsIC4uLnBhcmFtc107XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBsZXQgbGFzdElucHV0Q29tbWFuZDogdC5Cb3VuZEF0dHJpYnV0ZXxudWxsID0gbnVsbDtcbiAgICAgIGlmIChzdHlsZUlucHV0cy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGkgPSBtYXBCYXNlZFN0eWxlSW5wdXQgPyAxIDogMDtcbiAgICAgICAgZm9yIChpOyBpIDwgc3R5bGVJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBpbnB1dCA9IHN0eWxlSW5wdXRzW2ldO1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcblxuICAgICAgICAgIGNvbnN0IGtleSA9IGlucHV0Lm5hbWU7XG4gICAgICAgICAgY29uc3Qgc3R5bGVJbmRleDogbnVtYmVyID0gc3R5bGVzSW5kZXhNYXBba2V5XSAhO1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oaW5wdXQuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxlUHJvcCwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgaW5kZXhMaXRlcmFsLCBvLmxpdGVyYWwoc3R5bGVJbmRleCksXG4gICAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUsIHRydWUpLCAuLi5wYXJhbXNcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0SW5wdXRDb21tYW5kID0gc3R5bGVJbnB1dHNbc3R5bGVJbnB1dHMubGVuZ3RoIC0gMV07XG4gICAgICB9XG5cbiAgICAgIGlmIChjbGFzc0lucHV0cy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGkgPSBtYXBCYXNlZENsYXNzSW5wdXQgPyAxIDogMDtcbiAgICAgICAgZm9yIChpOyBpIDwgY2xhc3NJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBpbnB1dCA9IGNsYXNzSW5wdXRzW2ldO1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcblxuICAgICAgICAgIGNvbnN0IGtleSA9IGlucHV0Lm5hbWU7XG4gICAgICAgICAgY29uc3QgY2xhc3NJbmRleDogbnVtYmVyID0gY2xhc3Nlc0luZGV4TWFwW2tleV0gITtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGlucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRDbGFzc1Byb3AsICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIGluZGV4TGl0ZXJhbCwgby5saXRlcmFsKGNsYXNzSW5kZXgpLFxuICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlLCB0cnVlKSwgLi4ucGFyYW1zXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdElucHV0Q29tbWFuZCA9IGNsYXNzSW5wdXRzW2NsYXNzSW5wdXRzLmxlbmd0aCAtIDFdO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGxhc3RJbnB1dENvbW1hbmQgIS5zb3VyY2VTcGFuLCBSMy5lbGVtZW50U3R5bGluZ0FwcGx5LCBbaW5kZXhMaXRlcmFsXSk7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgZWxlbWVudCBpbnB1dCBiaW5kaW5nc1xuICAgIGFsbE90aGVySW5wdXRzLmZvckVhY2goKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKSA9PiB7XG4gICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ3dhcm5pbmc6IGFuaW1hdGlvbiBiaW5kaW5ncyBub3QgeWV0IHN1cHBvcnRlZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gbWFwQmluZGluZ1RvSW5zdHJ1Y3Rpb24oaW5wdXQudHlwZSk7XG4gICAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG5cbiAgICAgICAgLy8gVE9ETyhjaHVja2opOiBydW50aW1lOiBzZWN1cml0eSBjb250ZXh0P1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbiwgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgby5saXRlcmFsKGlucHV0Lm5hbWUpLFxuICAgICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSksIC4uLnBhcmFtc1xuICAgICAgICAgIF07XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdW5zdXBwb3J0ZWQoYGJpbmRpbmcgdHlwZSAke2lucHV0LnR5cGV9YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUcmF2ZXJzZSBlbGVtZW50IGNoaWxkIG5vZGVzXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24gJiYgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPT0gMSAmJlxuICAgICAgICBlbGVtZW50LmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC5jaGlsZHJlblswXSBhcyB0LlRleHQ7XG4gICAgICB0aGlzLnZpc2l0U2luZ2xlSTE4blRleHRDaGlsZCh0ZXh0LCBpMThuTWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHQudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG4gICAgfVxuXG4gICAgaWYgKCFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICAvLyBGaW5pc2ggZWxlbWVudCBjb25zdHJ1Y3Rpb24gbW9kZS5cbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LmVuZFNvdXJjZVNwYW4gfHwgZWxlbWVudC5zb3VyY2VTcGFuLFxuICAgICAgICAgIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyRW5kIDogUjMuZWxlbWVudEVuZCk7XG4gICAgfVxuXG4gICAgLy8gUmVzdG9yZSB0aGUgc3RhdGUgYmVmb3JlIGV4aXRpbmcgdGhpcyBub2RlXG4gICAgdGhpcy5faW5JMThuU2VjdGlvbiA9IHdhc0luSTE4blNlY3Rpb247XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiB0LlRlbXBsYXRlKSB7XG4gICAgY29uc3QgdGVtcGxhdGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgbGV0IGVsTmFtZSA9ICcnO1xuICAgIGlmICh0ZW1wbGF0ZS5jaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgdGVtcGxhdGUuY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiB0LkVsZW1lbnQpIHtcbiAgICAgIC8vIFdoZW4gdGhlIHRlbXBsYXRlIGFzIGEgc2luZ2xlIGNoaWxkLCBkZXJpdmUgdGhlIGNvbnRleHQgbmFtZSBmcm9tIHRoZSB0YWdcbiAgICAgIGVsTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcigodGVtcGxhdGUuY2hpbGRyZW5bMF0gYXMgdC5FbGVtZW50KS5uYW1lKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZXh0TmFtZSA9IGVsTmFtZSA/IGAke3RoaXMuY29udGV4dE5hbWV9XyR7ZWxOYW1lfWAgOiAnJztcblxuICAgIGNvbnN0IHRlbXBsYXRlTmFtZSA9XG4gICAgICAgIGNvbnRleHROYW1lID8gYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlXyR7dGVtcGxhdGVJbmRleH1gIDogYFRlbXBsYXRlXyR7dGVtcGxhdGVJbmRleH1gO1xuXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksXG4gICAgICBvLnZhcmlhYmxlKHRlbXBsYXRlTmFtZSksXG4gICAgICBvLlRZUEVEX05VTExfRVhQUixcbiAgICBdO1xuXG4gICAgLy8gTWF0Y2ggZGlyZWN0aXZlcyBvbiBib3RoIGF0dHJpYnV0ZXMgYW5kIGJvdW5kIHByb3BlcnRpZXNcbiAgICBjb25zdCBhdHRyaWJ1dGVOYW1lczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVNYXA6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgdGVtcGxhdGUuYXR0cmlidXRlcy5mb3JFYWNoKGEgPT4ge1xuICAgICAgYXR0cmlidXRlTmFtZXMucHVzaChhc0xpdGVyYWwoYS5uYW1lKSwgYXNMaXRlcmFsKCcnKSk7XG4gICAgICBhdHRyaWJ1dGVNYXBbYS5uYW1lXSA9IGEudmFsdWU7XG4gICAgfSk7XG5cbiAgICB0ZW1wbGF0ZS5pbnB1dHMuZm9yRWFjaChpID0+IHtcbiAgICAgIGF0dHJpYnV0ZU5hbWVzLnB1c2goYXNMaXRlcmFsKGkubmFtZSksIGFzTGl0ZXJhbCgnJykpO1xuICAgICAgYXR0cmlidXRlTWFwW2kubmFtZV0gPSAnJztcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmRpcmVjdGl2ZU1hdGNoZXIpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IoJ25nLXRlbXBsYXRlJywgYXR0cmlidXRlTWFwKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cblxuICAgIGlmIChhdHRyaWJ1dGVOYW1lcy5sZW5ndGgpIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGF0dHJpYnV0ZU5hbWVzKSwgdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5UWVBFRF9OVUxMX0VYUFIpO1xuICAgIH1cblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPG5nLXRlbXBsYXRlICNmb28+KVxuICAgIGlmICh0ZW1wbGF0ZS5yZWZlcmVuY2VzICYmIHRlbXBsYXRlLnJlZmVyZW5jZXMubGVuZ3RoKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5wcmVwYXJlUmVmc1BhcmFtZXRlcih0ZW1wbGF0ZS5yZWZlcmVuY2VzKSk7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5pbXBvcnRFeHByKFIzLnRlbXBsYXRlUmVmRXh0cmFjdG9yKSk7XG4gICAgfVxuXG4gICAgLy8gZS5nLiBwKDEsICdmb3JPZicsIMm1YmluZChjdHguaXRlbXMpKTtcbiAgICBjb25zdCBjb250ZXh0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgIHRlbXBsYXRlLmlucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy5lbGVtZW50UHJvcGVydHksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSxcbiAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoY29udGV4dCwgdmFsdWUpXG4gICAgICAgIF07XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSB0aGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAgICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0ZW1wbGF0ZU5hbWUsIFtdLFxuICAgICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIsIHRoaXMuZGlyZWN0aXZlcywgdGhpcy5waXBlVHlwZUJ5TmFtZSwgdGhpcy5waXBlcywgdGhpcy5fbmFtZXNwYWNlKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbCBhZnRlciB0aGVpciBwYXJlbnQgdGVtcGxhdGVzIGhhdmUgY29tcGxldGVkXG4gICAgLy8gcHJvY2Vzc2luZywgc28gdGhleSBhcmUgcXVldWVkIGhlcmUgdW50aWwgYWZ0ZXIgdGhlIGluaXRpYWwgcGFzcy4gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndFxuICAgIC8vIGJlIGFibGUgdG8gc3VwcG9ydCBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIHRvIGxvY2FsIHJlZnMgdGhhdCBvY2N1ciBhZnRlciB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBkZWZpbml0aW9uLiBlLmcuIDxkaXYgKm5nSWY9XCJzaG93aW5nXCI+IHt7IGZvbyB9fSA8L2Rpdj4gIDxkaXYgI2Zvbz48L2Rpdj5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID1cbiAgICAgICAgICB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgfSk7XG5cbiAgICAvLyBlLmcuIHRlbXBsYXRlKDEsIE15Q29tcF9UZW1wbGF0ZV8xKVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy50ZW1wbGF0ZUNyZWF0ZSwgKCkgPT4ge1xuICAgICAgcGFyYW1ldGVycy5zcGxpY2UoXG4gICAgICAgICAgMiwgMCwgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRDb25zdENvdW50KCkpLFxuICAgICAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZVZpc2l0b3IuZ2V0VmFyQ291bnQoKSkpO1xuICAgICAgcmV0dXJuIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gVGhlc2Ugc2hvdWxkIGJlIGhhbmRsZWQgaW4gdGhlIHRlbXBsYXRlIG9yIGVsZW1lbnQgZGlyZWN0bHkuXG4gIHJlYWRvbmx5IHZpc2l0UmVmZXJlbmNlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRWYXJpYWJsZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VGV4dEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kRXZlbnQgPSBpbnZhbGlkO1xuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IHQuQm91bmRUZXh0KSB7XG4gICAgY29uc3Qgbm9kZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24odGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKG5vZGVJbmRleCldKTtcblxuICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0QmluZGluZyxcbiAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChub2RlSW5kZXgpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoby52YXJpYWJsZShDT05URVhUX05BTUUpLCB2YWx1ZSldKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIG8ubGl0ZXJhbCh0ZXh0LnZhbHVlKV0pO1xuICB9XG5cbiAgLy8gV2hlbiB0aGUgY29udGVudCBvZiB0aGUgZWxlbWVudCBpcyBhIHNpbmdsZSB0ZXh0IG5vZGUgdGhlIHRyYW5zbGF0aW9uIGNhbiBiZSBpbmxpbmVkOlxuICAvL1xuICAvLyBgPHAgaTE4bj1cImRlc2N8bWVhblwiPnNvbWUgY29udGVudDwvcD5gXG4gIC8vIGNvbXBpbGVzIHRvXG4gIC8vIGBgYFxuICAvLyAvKipcbiAgLy8gKiBAZGVzYyBkZXNjXG4gIC8vICogQG1lYW5pbmcgbWVhblxuICAvLyAqL1xuICAvLyBjb25zdCBNU0dfWFlaID0gZ29vZy5nZXRNc2coJ3NvbWUgY29udGVudCcpO1xuICAvLyBpMC7JtXRleHQoMSwgTVNHX1hZWik7XG4gIC8vIGBgYFxuICB2aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dDogdC5UZXh0LCBpMThuTWV0YTogc3RyaW5nKSB7XG4gICAgY29uc3QgbWV0YSA9IHBhcnNlSTE4bk1ldGEoaTE4bk1ldGEpO1xuICAgIGNvbnN0IHZhcmlhYmxlID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0VHJhbnNsYXRpb24odGV4dC52YWx1ZSwgbWV0YSk7XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCB2YXJpYWJsZV0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7IH1cblxuICBnZXRDb25zdENvdW50KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4OyB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7IHJldHVybiB0aGlzLl9iaW5kaW5nU2xvdHMgKyB0aGlzLl9wdXJlRnVuY3Rpb25TbG90czsgfVxuXG4gIHByaXZhdGUgYmluZGluZ0NvbnRleHQoKSB7IHJldHVybiBgJHt0aGlzLl9iaW5kaW5nQ29udGV4dCsrfWA7IH1cblxuICAvLyBCaW5kaW5ncyBtdXN0IG9ubHkgYmUgcmVzb2x2ZWQgYWZ0ZXIgYWxsIGxvY2FsIHJlZnMgaGF2ZSBiZWVuIHZpc2l0ZWQsIHNvIGFsbFxuICAvLyBpbnN0cnVjdGlvbnMgYXJlIHF1ZXVlZCBpbiBjYWxsYmFja3MgdGhhdCBleGVjdXRlIG9uY2UgdGhlIGluaXRpYWwgcGFzcyBoYXMgY29tcGxldGVkLlxuICAvLyBPdGhlcndpc2UsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gc3VwcG9ydCBsb2NhbCByZWZzIHRoYXQgYXJlIGRlZmluZWQgYWZ0ZXIgdGhlaXJcbiAgLy8gYmluZGluZ3MuIGUuZy4ge3sgZm9vIH19IDxkaXYgI2Zvbz48L2Rpdj5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbkZuKFxuICAgICAgZm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10sIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuOiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKTogdm9pZCB7XG4gICAgZm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShwYXJhbXNPckZuKSA/IHBhcmFtc09yRm4gOiBwYXJhbXNPckZuKCk7XG4gICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24oc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXMpLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX2NyZWF0aW9uQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdDogby5FeHByZXNzaW9uLCB2YWx1ZTogQVNULCBza2lwQmluZEZuPzogYm9vbGVhbik6XG4gICAgICBvLkV4cHJlc3Npb24ge1xuICAgIGlmICghc2tpcEJpbmRGbikgdGhpcy5fYmluZGluZ1Nsb3RzKys7XG5cbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uRm4gPVxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyBpbnRlcnBvbGF0ZSA6ICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKTtcblxuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgIHRoaXMsIGltcGxpY2l0LCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUsIGludGVycG9sYXRpb25Gbik7XG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG5cbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gfHwgc2tpcEJpbmRGbiA/IHZhbEV4cHIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW3ZhbEV4cHJdKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZVJlZnNQYXJhbWV0ZXIocmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFyZWZlcmVuY2VzIHx8IHJlZmVyZW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgcmVmc1BhcmFtID0gZmxhdHRlbihyZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsXG4gICAgICAgICAgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiB4KDIpO1xuICAgICAgICAgICAgY29uc3QgbmV4dENvbnRleHRTdG10ID1cbiAgICAgICAgICAgICAgICByZWxhdGl2ZUxldmVsID4gMCA/IFtnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKS50b1N0bXQoKV0gOiBbXTtcblxuICAgICAgICAgICAgLy8gZS5nLiBjb25zdCAkZm9vJCA9IHIoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSk7XG4gICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgIH0pKTtcblxuICAgIHJldHVybiB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHJlZnNQYXJhbSksIHRydWUpO1xuICB9XG59XG5cbmNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgb25lIHNsb3QgcGVyIHBpcGUgYXJndW1lbnRcbiAgICBjb25zdCBwdXJlRnVuY3Rpb25TbG90ID0gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKDIgKyBwaXBlLmFyZ3MubGVuZ3RoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKHBpcGUuc3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuKSwgc2xvdFBzZXVkb0xvY2FsKTtcbiAgICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcGlwZUJpbmRpbmdDYWxsSW5mbyhwaXBlLmFyZ3MpO1xuICAgIHRoaXMuZGVmaW5lUGlwZShwaXBlLm5hbWUsIHNsb3RQc2V1ZG9Mb2NhbCwgc2xvdCwgby5pbXBvcnRFeHByKGlkZW50aWZpZXIpKTtcbiAgICBjb25zdCBhcmdzOiBBU1RbXSA9IFtwaXBlLmV4cCwgLi4ucGlwZS5hcmdzXTtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzOiBBU1RbXSA9XG4gICAgICAgIGlzVmFyTGVuZ3RoID8gdGhpcy52aXNpdEFsbChbbmV3IExpdGVyYWxBcnJheShwaXBlLnNwYW4sIGFyZ3MpXSkgOiB0aGlzLnZpc2l0QWxsKGFyZ3MpO1xuXG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbkNhbGwocGlwZS5zcGFuLCB0YXJnZXQsIFtcbiAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3Bhbiwgc2xvdCksXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHB1cmVGdW5jdGlvblNsb3QpLFxuICAgICAgLi4uY29udmVydGVkQXJncyxcbiAgICBdKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKGFycmF5LnNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID9cbiAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmdDYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5waXBlQmluZFYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcblxuZnVuY3Rpb24gcHVyZUZ1bmN0aW9uQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnB1cmVGdW5jdGlvblYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnN0cnVjdGlvbihcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLy8gZS5nLiB4KDIpO1xuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbERpZmY6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMubmV4dENvbnRleHQpXG4gICAgICAuY2FsbEZuKHJlbGF0aXZlTGV2ZWxEaWZmID4gMSA/IFtvLmxpdGVyYWwocmVsYXRpdmVMZXZlbERpZmYpXSA6IFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwciB8IG8uTGl0ZXJhbE1hcEV4cHIsXG4gICAgYWxsb2NhdGVTbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICAvLyBBbGxvY2F0ZSAxIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyAxIHBlciBhcmd1bWVudFxuICBjb25zdCBzdGFydFNsb3QgPSBhbGxvY2F0ZVNsb3RzKDEgKyBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGgpO1xuICBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGggPiAwIHx8IGVycm9yKGBFeHBlY3RlZCBhcmd1bWVudHMgdG8gYSBsaXRlcmFsIGZhY3RvcnkgZnVuY3Rpb25gKTtcbiAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHB1cmVGdW5jdGlvbkNhbGxJbmZvKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcblxuICAvLyBMaXRlcmFsIGZhY3RvcmllcyBhcmUgcHVyZSBmdW5jdGlvbnMgdGhhdCBvbmx5IG5lZWQgdG8gYmUgcmUtaW52b2tlZCB3aGVuIHRoZSBwYXJhbWV0ZXJzXG4gIC8vIGNoYW5nZS5cbiAgY29uc3QgYXJncyA9IFtcbiAgICBvLmxpdGVyYWwoc3RhcnRTbG90KSxcbiAgICBsaXRlcmFsRmFjdG9yeSxcbiAgXTtcblxuICBpZiAoaXNWYXJMZW5ndGgpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsQXJyKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKSk7XG4gIH0gZWxzZSB7XG4gICAgYXJncy5wdXNoKC4uLmxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikuY2FsbEZuKGFyZ3MpO1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHdoaWNoIGlzIGV4ZWN1dGVkIHdoZW5ldmVyIGEgdmFyaWFibGUgaXMgcmVmZXJlbmNlZCBmb3IgdGhlIGZpcnN0IHRpbWUgaW4gYSBnaXZlblxuICogc2NvcGUuXG4gKlxuICogSXQgaXMgZXhwZWN0ZWQgdGhhdCB0aGUgZnVuY3Rpb24gY3JlYXRlcyB0aGUgYGNvbnN0IGxvY2FsTmFtZSA9IGV4cHJlc3Npb25gOyBzdGF0ZW1lbnQuXG4gKi9cbmV4cG9ydCB0eXBlIERlY2xhcmVMb2NhbFZhckNhbGxiYWNrID0gKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4gby5TdGF0ZW1lbnRbXTtcblxuLyoqIFRoZSBwcmVmaXggdXNlZCB0byBnZXQgYSBzaGFyZWQgY29udGV4dCBpbiBCaW5kaW5nU2NvcGUncyBtYXAuICovXG5jb25zdCBTSEFSRURfQ09OVEVYVF9LRVkgPSAnJCRzaGFyZWRfY3R4JCQnO1xuXG4vKipcbiAqIFRoaXMgaXMgdXNlZCB3aGVuIG9uZSByZWZlcnMgdG8gdmFyaWFibGUgc3VjaCBhczogJ2xldCBhYmMgPSB4KDIpLiRpbXBsaWNpdGAuXG4gKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gKiAtIHZhbHVlIGByZXRyaWV2YWxMZXZlbGAgaXMgdGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkLCB3aGljaCBpcyAyIGxldmVsc1xuICogdXAgaW4gZXhhbXBsZS5cbiAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gKiAtIHZhbHVlIGBkZWNsYXJlTG9jYWxDYWxsYmFja2AgaXMgYSBjYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiBkZWNsYXJpbmcgdGhlIGxvY2FsLlxuICogLSB2YWx1ZSBgZGVjbGFyZWAgaXMgdHJ1ZSBpZiB0aGlzIHZhbHVlIG5lZWRzIHRvIGJlIGRlY2xhcmVkLlxuICogLSB2YWx1ZSBgcHJpb3JpdHlgIGRpY3RhdGVzIHRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyIGRlY2xhcmF0aW9uIGNvbXBhcmVkXG4gKiB0byBvdGhlciB2YXIgZGVjbGFyYXRpb25zIG9uIHRoZSBzYW1lIHJldHJpZXZhbCBsZXZlbC4gRm9yIGV4YW1wbGUsIGlmIHRoZXJlIGlzIGFcbiAqIGNvbnRleHQgdmFyaWFibGUgYW5kIGEgbG9jYWwgcmVmIGFjY2Vzc2luZyB0aGUgc2FtZSBwYXJlbnQgdmlldywgdGhlIGNvbnRleHQgdmFyXG4gKiBkZWNsYXJhdGlvbiBzaG91bGQgYWx3YXlzIGNvbWUgYmVmb3JlIHRoZSBsb2NhbCByZWYgZGVjbGFyYXRpb24uXG4gKi9cbnR5cGUgQmluZGluZ0RhdGEgPSB7XG4gIHJldHJpZXZhbExldmVsOiBudW1iZXI7IGxoczogby5SZWFkVmFyRXhwcjsgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaztcbiAgZGVjbGFyZTogYm9vbGVhbjtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbn07XG5cbi8qKlxuICogVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgYSBsb2NhbCB2YXJpYWJsZSBkZWNsYXJhdGlvbi4gSGlnaGVyIG51bWJlcnNcbiAqIG1lYW4gdGhlIGRlY2xhcmF0aW9uIHdpbGwgYXBwZWFyIGZpcnN0IGluIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuY29uc3QgZW51bSBEZWNsYXJhdGlvblByaW9yaXR5IHsgREVGQVVMVCA9IDAsIENPTlRFWFQgPSAxLCBTSEFSRURfQ09OVEVYVCA9IDIgfVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBCaW5kaW5nRGF0YS4gKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ0RhdGE+KCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcbiAgcHJpdmF0ZSByZXN0b3JlVmlld1ZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuXG4gIHN0YXRpYyBST09UX1NDT1BFID0gbmV3IEJpbmRpbmdTY29wZSgpLnNldCgwLCAnJGV2ZW50Jywgby52YXJpYWJsZSgnJGV2ZW50JykpO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocHVibGljIGJpbmRpbmdMZXZlbDogbnVtYmVyID0gMCwgcHJpdmF0ZSBwYXJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCkge31cblxuICBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGN1cnJlbnQubWFwLmdldChuYW1lKTtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSB0aGlzKSB7XG4gICAgICAgICAgLy8gbWFrZSBhIGxvY2FsIGNvcHkgYW5kIHJlc2V0IHRoZSBgZGVjbGFyZWAgc3RhdGVcbiAgICAgICAgICB2YWx1ZSA9IHtcbiAgICAgICAgICAgIHJldHJpZXZhbExldmVsOiB2YWx1ZS5yZXRyaWV2YWxMZXZlbCxcbiAgICAgICAgICAgIGxoczogdmFsdWUubGhzLFxuICAgICAgICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICAgICAgICBwcmlvcml0eTogdmFsdWUucHJpb3JpdHlcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQ2FjaGUgdGhlIHZhbHVlIGxvY2FsbHkuXG4gICAgICAgICAgdGhpcy5tYXAuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAvLyBQb3NzaWJseSBnZW5lcmF0ZSBhIHNoYXJlZCBjb250ZXh0IHZhclxuICAgICAgICAgIHRoaXMubWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUpO1xuICAgICAgICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldyh2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgJiYgIXZhbHVlLmRlY2xhcmUpIHtcbiAgICAgICAgICB2YWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCB0byB0aGlzIHBvaW50LCB3ZSBhcmUgbG9va2luZyBmb3IgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wIGxldmVsIGNvbXBvbmVudFxuICAgIC8vIC0gSWYgbGV2ZWwgPT09IDAsIHdlIGFyZSBvbiB0aGUgdG9wIGFuZCBkb24ndCBuZWVkIHRvIHJlLWRlY2xhcmUgYGN0eGAuXG4gICAgLy8gLSBJZiBsZXZlbCA+IDAsIHdlIGFyZSBpbiBhbiBlbWJlZGRlZCB2aWV3LiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGxvY2FsIHZhciB3ZSB1c2VkIHRvIHN0b3JlIHRoZSBjb21wb25lbnQgY29udGV4dCwgZS5nLiBjb25zdCAkY29tcCQgPSB4KCk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ0xldmVsID09PSAwID8gbnVsbCA6IHRoaXMuZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbG9jYWwgdmFyaWFibGUgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHJldHJpZXZhbExldmVsIFRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZFxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHByaW9yaXR5IFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyXG4gICAqIEBwYXJhbSBkZWNsYXJlTG9jYWxDYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIHdoZW4gZGVjbGFyaW5nIHRoaXMgbG9jYWwgdmFyXG4gICAqL1xuICBzZXQocmV0cmlldmFsTGV2ZWw6IG51bWJlciwgbmFtZTogc3RyaW5nLCBsaHM6IG8uUmVhZFZhckV4cHIsXG4gICAgICBwcmlvcml0eTogbnVtYmVyID0gRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayk6IEJpbmRpbmdTY29wZSB7XG4gICAgIXRoaXMubWFwLmhhcyhuYW1lKSB8fFxuICAgICAgICBlcnJvcihgVGhlIG5hbWUgJHtuYW1lfSBpcyBhbHJlYWR5IGRlZmluZWQgaW4gc2NvcGUgdG8gYmUgJHt0aGlzLm1hcC5nZXQobmFtZSl9YCk7XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHlcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IChvLkV4cHJlc3Npb258bnVsbCkgeyByZXR1cm4gdGhpcy5nZXQobmFtZSk7IH1cblxuICBuZXN0ZWRTY29wZShsZXZlbDogbnVtYmVyKTogQmluZGluZ1Njb3BlIHtcbiAgICBjb25zdCBuZXdTY29wZSA9IG5ldyBCaW5kaW5nU2NvcGUobGV2ZWwsIHRoaXMpO1xuICAgIGlmIChsZXZlbCA+IDApIG5ld1Njb3BlLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgICByZXR1cm4gbmV3U2NvcGU7XG4gIH1cblxuICBnZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwcnxudWxsIHtcbiAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwpO1xuICAgIHJldHVybiBzaGFyZWRDdHhPYmogJiYgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPyBzaGFyZWRDdHhPYmoubGhzIDogbnVsbDtcbiAgfVxuXG4gIG1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlOiBCaW5kaW5nRGF0YSkge1xuICAgIGlmICh2YWx1ZS5wcmlvcml0eSA9PT0gRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhUKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSB4KDIpO1xuICAgICAgICByZXR1cm4gW2xocy5zZXQoZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgfSxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgcHJpb3JpdHk6IERlY2xhcmF0aW9uUHJpb3JpdHkuU0hBUkVEX0NPTlRFWFRcbiAgICB9KTtcbiAgfVxuXG4gIGdldENvbXBvbmVudFByb3BlcnR5KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29tcG9uZW50VmFsdWUgPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgMCkgITtcbiAgICBjb21wb25lbnRWYWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcoMCk7XG4gICAgcmV0dXJuIGNvbXBvbmVudFZhbHVlLmxocy5wcm9wKG5hbWUpO1xuICB9XG5cbiAgbWF5YmVSZXN0b3JlVmlldyhyZXRyaWV2YWxMZXZlbDogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuaXNMaXN0ZW5lclNjb3BlKCkgJiYgcmV0cmlldmFsTGV2ZWwgPCB0aGlzLmJpbmRpbmdMZXZlbCkge1xuICAgICAgaWYgKCF0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUpIHtcbiAgICAgICAgLy8gcGFyZW50IHNhdmVzIHZhcmlhYmxlIHRvIGdlbmVyYXRlIGEgc2hhcmVkIGBjb25zdCAkcyQgPSBnVigpO2AgaW5zdHJ1Y3Rpb25cbiAgICAgICAgdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLnBhcmVudCAhLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA9IHRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZTtcbiAgICB9XG4gIH1cblxuICByZXN0b3JlVmlld1N0YXRlbWVudCgpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyByVigkc3RhdGUkKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW2luc3RydWN0aW9uKG51bGwsIFIzLnJlc3RvcmVWaWV3LCBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlXSkudG9TdG10KCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICB2aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIGNvbnN0ICRzdGF0ZSQgPSBnVigpO1xuICAgIGNvbnN0IGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24gPSBpbnN0cnVjdGlvbihudWxsLCBSMy5nZXRDdXJyZW50VmlldywgW10pO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlLnNldChnZXRDdXJyZW50Vmlld0luc3RydWN0aW9uKS50b0NvbnN0RGVjbCgpXSA6XG4gICAgICAgIFtdO1xuICB9XG5cbiAgaXNMaXN0ZW5lclNjb3BlKCkgeyByZXR1cm4gdGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQuYmluZGluZ0xldmVsID09PSB0aGlzLmJpbmRpbmdMZXZlbDsgfVxuXG4gIHZhcmlhYmxlRGVjbGFyYXRpb25zKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGxldCBjdXJyZW50Q29udGV4dExldmVsID0gMDtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLm1hcC52YWx1ZXMoKSlcbiAgICAgICAgLmZpbHRlcih2YWx1ZSA9PiB2YWx1ZS5kZWNsYXJlKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXRyaWV2YWxMZXZlbCAtIGEucmV0cmlldmFsTGV2ZWwgfHwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpXG4gICAgICAgIC5yZWR1Y2UoKHN0bXRzOiBvLlN0YXRlbWVudFtdLCB2YWx1ZTogQmluZGluZ0RhdGEpID0+IHtcbiAgICAgICAgICBjb25zdCBsZXZlbERpZmYgPSB0aGlzLmJpbmRpbmdMZXZlbCAtIHZhbHVlLnJldHJpZXZhbExldmVsO1xuICAgICAgICAgIGNvbnN0IGN1cnJTdG10cyA9IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICEodGhpcywgbGV2ZWxEaWZmIC0gY3VycmVudENvbnRleHRMZXZlbCk7XG4gICAgICAgICAgY3VycmVudENvbnRleHRMZXZlbCA9IGxldmVsRGlmZjtcbiAgICAgICAgICByZXR1cm4gc3RtdHMuY29uY2F0KGN1cnJTdG10cyk7XG4gICAgICAgIH0sIFtdKSBhcyBvLlN0YXRlbWVudFtdO1xuICB9XG5cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZ2l2ZW4gYSB0YWcgbmFtZSBhbmQgYSBtYXAgb2YgYXR0cmlidXRlc1xuICovXG5mdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3Rvcih0YWc6IHN0cmluZywgYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuXG4gIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQodGFnKTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8vIFBhcnNlIGkxOG4gbWV0YXMgbGlrZTpcbi8vIC0gXCJAQGlkXCIsXG4vLyAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbi8vIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbmZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEoaTE4bj86IHN0cmluZyk6IHtkZXNjcmlwdGlvbj86IHN0cmluZywgaWQ/OiBzdHJpbmcsIG1lYW5pbmc/OiBzdHJpbmd9IHtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGlkOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGlmIChpMThuKSB7XG4gICAgLy8gVE9ETyh2aWNiKTogZmlndXJlIG91dCBob3cgdG8gZm9yY2UgYSBtZXNzYWdlIElEIHdpdGggY2xvc3VyZSA/XG4gICAgY29uc3QgaWRJbmRleCA9IGkxOG4uaW5kZXhPZihJRF9TRVBBUkFUT1IpO1xuXG4gICAgY29uc3QgZGVzY0luZGV4ID0gaTE4bi5pbmRleE9mKE1FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGlkXSA9XG4gICAgICAgIChpZEluZGV4ID4gLTEpID8gW2kxOG4uc2xpY2UoMCwgaWRJbmRleCksIGkxOG4uc2xpY2UoaWRJbmRleCArIDIpXSA6IFtpMThuLCAnJ107XG4gICAgW21lYW5pbmcsIGRlc2NyaXB0aW9uXSA9IChkZXNjSW5kZXggPiAtMSkgP1xuICAgICAgICBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldIDpcbiAgICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2Rlc2NyaXB0aW9uLCBpZCwgbWVhbmluZ307XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgYXJncyA9IGFyZ3Muc2xpY2UoMSk7ICAvLyBJZ25vcmUgdGhlIGxlbmd0aCBwcmVmaXggYWRkZWQgZm9yIHJlbmRlcjJcbiAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjEpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24yKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjQpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb242KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjcpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uOCkuY2FsbEZuKGFyZ3MpO1xuICB9XG4gIChhcmdzLmxlbmd0aCA+PSAxOSAmJiBhcmdzLmxlbmd0aCAlIDIgPT0gMSkgfHxcbiAgICAgIGVycm9yKGBJbnZhbGlkIGludGVycG9sYXRpb24gYXJndW1lbnQgbGVuZ3RoICR7YXJncy5sZW5ndGh9YCk7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvblYpLmNhbGxGbihbby5saXRlcmFsQXJyKGFyZ3MpXSk7XG59XG5cbi8qKlxuICogUGFyc2UgYSB0ZW1wbGF0ZSBpbnRvIHJlbmRlcjMgYE5vZGVgcyBhbmQgYWRkaXRpb25hbCBtZXRhZGF0YSwgd2l0aCBubyBvdGhlciBkZXBlbmRlbmNpZXMuXG4gKlxuICogQHBhcmFtIHRlbXBsYXRlIHRleHQgb2YgdGhlIHRlbXBsYXRlIHRvIHBhcnNlXG4gKiBAcGFyYW0gdGVtcGxhdGVVcmwgVVJMIHRvIHVzZSBmb3Igc291cmNlIG1hcHBpbmcgb2YgdGhlIHBhcnNlZCB0ZW1wbGF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiB7cHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW59ID0ge30pOlxuICAgIHtlcnJvcnM/OiBQYXJzZUVycm9yW10sIG5vZGVzOiB0Lk5vZGVbXSwgaGFzTmdDb250ZW50OiBib29sZWFuLCBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdfSB7XG4gIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcbiAgY29uc3QgcGFyc2VSZXN1bHQgPSBodG1sUGFyc2VyLnBhcnNlKHRlbXBsYXRlLCB0ZW1wbGF0ZVVybCk7XG5cbiAgaWYgKHBhcnNlUmVzdWx0LmVycm9ycyAmJiBwYXJzZVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7ZXJyb3JzOiBwYXJzZVJlc3VsdC5lcnJvcnMsIG5vZGVzOiBbXSwgaGFzTmdDb250ZW50OiBmYWxzZSwgbmdDb250ZW50U2VsZWN0b3JzOiBbXX07XG4gIH1cblxuICBsZXQgcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IHBhcnNlUmVzdWx0LnJvb3ROb2RlcztcbiAgaWYgKCFvcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZXMpIHtcbiAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKG5ldyBXaGl0ZXNwYWNlVmlzaXRvcigpLCByb290Tm9kZXMpO1xuICB9XG5cbiAgY29uc3Qge25vZGVzLCBoYXNOZ0NvbnRlbnQsIG5nQ29udGVudFNlbGVjdG9ycywgZXJyb3JzfSA9XG4gICAgICBodG1sQXN0VG9SZW5kZXIzQXN0KHJvb3ROb2RlcywgYmluZGluZ1BhcnNlcik7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9ycywgbm9kZXM6IFtdLCBoYXNOZ0NvbnRlbnQ6IGZhbHNlLCBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdfTtcbiAgfVxuXG4gIHJldHVybiB7bm9kZXMsIGhhc05nQ29udGVudCwgbmdDb250ZW50U2VsZWN0b3JzfTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBgQmluZGluZ1BhcnNlcmAgd2l0aCBhIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VCaW5kaW5nUGFyc2VyKCk6IEJpbmRpbmdQYXJzZXIge1xuICByZXR1cm4gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICBuZXcgUGFyc2VyKG5ldyBMZXhlcigpKSwgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpLCBudWxsLFxuICAgICAgW10pO1xufVxuXG5mdW5jdGlvbiBpc0NsYXNzQmluZGluZyhpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gaW5wdXQubmFtZSA9PSAnY2xhc3NOYW1lJyB8fCBpbnB1dC5uYW1lID09ICdjbGFzcyc7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTYW5pdGl6YXRpb25GbihpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgY29udGV4dDogY29yZS5TZWN1cml0eUNvbnRleHQpIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlID8gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU3R5bGUpIDogbnVsbDtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVJlc291cmNlVXJsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTdHlsZVNhbml0aXphYmxlKHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBzd2l0Y2ggKHByb3ApIHtcbiAgICBjYXNlICdiYWNrZ3JvdW5kLWltYWdlJzpcbiAgICBjYXNlICdiYWNrZ3JvdW5kJzpcbiAgICBjYXNlICdib3JkZXItaW1hZ2UnOlxuICAgIGNhc2UgJ2ZpbHRlcic6XG4gICAgY2FzZSAnbGlzdC1zdHlsZSc6XG4gICAgY2FzZSAnbGlzdC1zdHlsZS1pbWFnZSc6XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iXX0=