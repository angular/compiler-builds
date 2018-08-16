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
        // Generate all the creation mode instructions (e.g. resolve bindings in listeners)
        var creationStatements = this._creationCodeFns.map(function (fn) { return fn(); });
        // Generate all the update mode instructions (e.g. resolve property or text bindings)
        var updateStatements = this._updateCodeFns.map(function (fn) { return fn(); });
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
        this._nestedTemplateFns.forEach(function (buildTemplateFn) { return buildTemplateFn(); });
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
        if (element.references && element.references.length > 0) {
            var references = flatten(element.references.map(function (reference) {
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
            parameters.push(this.constantPool.getConstLiteral(asLiteral(references), true));
        }
        else {
            parameters.push(o.TYPED_NULL_EXPR);
        }
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
        // e.g. template(1, MyComp_Template_1)
        this.creationInstruction(template.sourceSpan, R3.templateCreate, trimTrailingNulls(parameters));
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
        var interpolationFn = value instanceof Interpolation ? interpolate : function () { return error('Unexpected interpolation'); };
        var convertedPropertyBinding = convertPropertyBinding(this, implicit, value, this.bindingContext(), BindingForm.TrySimple, interpolationFn);
        (_a = this._tempVariables).push.apply(_a, tslib_1.__spread(convertedPropertyBinding.stmts));
        var valExpr = convertedPropertyBinding.currValExpr;
        return value instanceof Interpolation || skipBindFn ? valExpr :
            o.importExpr(R3.bind).callFn([valExpr]);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbkUsT0FBTyxFQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBaUIsb0JBQW9CLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUV2SixPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQTRCLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFjLGdCQUFnQixFQUFFLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ2xOLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDdEQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDbEYsT0FBTyxFQUFDLGFBQWEsSUFBSSxrQkFBa0IsRUFBRSxXQUFXLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUN0RixPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBQ2xGLE9BQU8sRUFBQyxXQUFXLEVBQWtCLE1BQU0s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S0FBSyxDQUFDO1lBQ0osT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxDQUFDO1lBQ0osT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxDQUFDO1lBQ0osT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDdkQ7SUFDRCxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxLQUFLLENBQUMsMkNBQXlDLElBQUksQ0FBQyxNQUFRLENBQUMsQ0FBQztJQUNsRSxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RFLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sd0JBQ0YsUUFBZ0IsRUFBRSxXQUFtQixFQUFFLE9BQTZDO0lBQTdDLHdCQUFBLEVBQUEsWUFBNkM7SUFFdEYsSUFBTSxhQUFhLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztJQUMxQyxJQUFNLFVBQVUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQ3BDLElBQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBRTVELElBQUksV0FBVyxDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDdkQsT0FBTyxFQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEVBQUMsQ0FBQztLQUM3RjtJQUVELElBQUksU0FBUyxHQUFnQixXQUFXLENBQUMsU0FBUyxDQUFDO0lBQ25ELElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLEVBQUU7UUFDaEMsU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxpQkFBaUIsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQy9EO0lBRUssSUFBQSxrREFDMkMsRUFEMUMsZ0JBQUssRUFBRSw4QkFBWSxFQUFFLDBDQUFrQixFQUFFLGtCQUFNLENBQ0o7SUFDbEQsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDL0IsT0FBTyxFQUFDLE1BQU0sUUFBQSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEVBQUMsQ0FBQztLQUN6RTtJQUVELE9BQU8sRUFBQyxLQUFLLE9BQUEsRUFBRSxZQUFZLGNBQUEsRUFBRSxrQkFBa0Isb0JBQUEsRUFBQyxDQUFDO0FBQ25ELENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU07SUFDSixPQUFPLElBQUksYUFBYSxDQUNwQixJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLEVBQUUsNEJBQTRCLEVBQUUsSUFBSSx3QkFBd0IsRUFBRSxFQUFFLElBQUksRUFDM0YsRUFBRSxDQUFDLENBQUM7QUFDVixDQUFDO0FBRUQsd0JBQXdCLEtBQXVCO0lBQzdDLE9BQU8sS0FBSyxDQUFDLElBQUksSUFBSSxXQUFXLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxPQUFPLENBQUM7QUFDNUQsQ0FBQztBQUVELCtCQUErQixLQUF1QixFQUFFLE9BQTZCO0lBQ25GLFFBQVEsT0FBTyxFQUFFO1FBQ2YsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUk7WUFDNUIsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN2QyxLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTTtZQUM5QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3pDLEtBQUssSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLO1lBQzdCLHlFQUF5RTtZQUN6RSw2RUFBNkU7WUFDN0Usc0VBQXNFO1lBQ3RFLE9BQU8sS0FBSyxDQUFDLElBQUksc0JBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDdEYsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUc7WUFDM0IsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN0QyxLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWTtZQUNwQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDOUM7WUFDRSxPQUFPLElBQUksQ0FBQztLQUNmO0FBQ0gsQ0FBQztBQUVELDRCQUE0QixJQUFZO0lBQ3RDLFFBQVEsSUFBSSxFQUFFO1FBQ1osS0FBSyxrQkFBa0IsQ0FBQztRQUN4QixLQUFLLFlBQVksQ0FBQztRQUNsQixLQUFLLGNBQWMsQ0FBQztRQUNwQixLQUFLLFFBQVEsQ0FBQztRQUNkLEtBQUssWUFBWSxDQUFDO1FBQ2xCLEtBQUssa0JBQWtCO1lBQ3JCLE9BQU8sSUFBSSxDQUFDO0tBQ2Y7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZmxhdHRlbiwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIEJ1aWx0aW5GdW5jdGlvbkNhbGwsIExvY2FsUmVzb2x2ZXIsIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgRnVuY3Rpb25DYWxsLCBJbXBsaWNpdFJlY2VpdmVyLCBJbnRlcnBvbGF0aW9uLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIFByb3BlcnR5UmVhZH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7TGV4ZXJ9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmltcG9ydCB7UGFyc2VyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7SHRtbFBhcnNlcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmltcG9ydCB7V2hpdGVzcGFjZVZpc2l0b3J9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3doaXRlc3BhY2VzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJR30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7aXNOZ0NvbnRhaW5lciBhcyBjaGVja0lzTmdDb250YWluZXIsIHNwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5cbmltcG9ydCB7UjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge3BhcnNlU3R5bGV9IGZyb20gJy4vc3R5bGluZyc7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgSTE4Tl9BVFRSLCBJMThOX0FUVFJfUFJFRklYLCBJRF9TRVBBUkFUT1IsIElNUExJQ0lUX1JFRkVSRU5DRSwgTUVBTklOR19TRVBBUkFUT1IsIFJFRkVSRU5DRV9QUkVGSVgsIFJFTkRFUl9GTEFHUywgYXNMaXRlcmFsLCBpbnZhbGlkLCBtYXBUb0V4cHJlc3Npb24sIHRyaW1UcmFpbGluZ051bGxzLCB1bnN1cHBvcnRlZH0gZnJvbSAnLi91dGlsJztcblxuZnVuY3Rpb24gbWFwQmluZGluZ1RvSW5zdHJ1Y3Rpb24odHlwZTogQmluZGluZ1R5cGUpOiBvLkV4dGVybmFsUmVmZXJlbmNlfHVuZGVmaW5lZCB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICByZXR1cm4gUjMuZWxlbWVudFByb3BlcnR5O1xuICAgIGNhc2UgQmluZGluZ1R5cGUuQXR0cmlidXRlOlxuICAgICAgcmV0dXJuIFIzLmVsZW1lbnRBdHRyaWJ1dGU7XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgIHJldHVybiBSMy5lbGVtZW50Q2xhc3NQcm9wO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8vICBpZiAocmYgJiBmbGFncykgeyAuLiB9XG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgIGZsYWdzOiBjb3JlLlJlbmRlckZsYWdzLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKTogby5JZlN0bXQge1xuICByZXR1cm4gby5pZlN0bXQoby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGZsYWdzKSwgbnVsbCwgZmFsc2UpLCBzdGF0ZW1lbnRzKTtcbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgaW1wbGVtZW50cyB0LlZpc2l0b3I8dm9pZD4sIExvY2FsUmVzb2x2ZXIge1xuICBwcml2YXRlIF9kYXRhSW5kZXggPSAwO1xuICBwcml2YXRlIF9iaW5kaW5nQ29udGV4dCA9IDA7XG4gIHByaXZhdGUgX3ByZWZpeENvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgaW4gbGlzdGVuZXJzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLlxuICAgKiBUaGlzIGVuc3VyZXMgYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfY3JlYXRpb25Db2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLiBUaGlzIGVuc3VyZXNcbiAgICogYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfdXBkYXRlQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGdlbmVyYXRlZCBmcm9tIHZpc2l0aW5nIHBpcGVzLCBsaXRlcmFscywgZXRjLiAqL1xuICBwcml2YXRlIF90ZW1wVmFyaWFibGVzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBidWlsZCBuZXN0ZWQgdGVtcGxhdGVzLiBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWxcbiAgICogYWZ0ZXIgdGhlIHBhcmVudCB0ZW1wbGF0ZSBoYXMgZmluaXNoZWQgdmlzaXRpbmcgYWxsIG9mIGl0cyBub2Rlcy4gVGhpcyBlbnN1cmVzIHRoYXQgYWxsXG4gICAqIGxvY2FsIHJlZiBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIGFyZSBhYmxlIHRvIGZpbmQgbG9jYWwgcmVmIHZhbHVlcyBpZiB0aGUgcmVmc1xuICAgKiBhcmUgZGVmaW5lZCBhZnRlciB0aGUgdGVtcGxhdGUgZGVjbGFyYXRpb24uXG4gICAqL1xuICBwcml2YXRlIF9uZXN0ZWRUZW1wbGF0ZUZuczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgLyoqXG4gICAqIFRoaXMgc2NvcGUgY29udGFpbnMgbG9jYWwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB1cGRhdGUgbW9kZSBibG9jayBvZiB0aGUgdGVtcGxhdGUuXG4gICAqIChlLmcuIHJlZnMgYW5kIGNvbnRleHQgdmFycyBpbiBiaW5kaW5ncylcbiAgICovXG4gIHByaXZhdGUgX2JpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlO1xuICBwcml2YXRlIF92YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIHByaXZhdGUgX3Vuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5cbiAgLy8gV2hldGhlciB3ZSBhcmUgaW5zaWRlIGEgdHJhbnNsYXRhYmxlIGVsZW1lbnQgKGA8cCBpMThuPi4uLiBzb21ld2hlcmUgaGVyZSAuLi4gPC9wPilcbiAgcHJpdmF0ZSBfaW5JMThuU2VjdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9pMThuU2VjdGlvbkluZGV4ID0gLTE7XG4gIC8vIE1hcHMgb2YgcGxhY2Vob2xkZXIgdG8gbm9kZSBpbmRleGVzIGZvciBlYWNoIG9mIHRoZSBpMThuIHNlY3Rpb25cbiAgcHJpdmF0ZSBfcGhUb05vZGVJZHhlczoge1twaE5hbWU6IHN0cmluZ106IG51bWJlcltdfVtdID0gW3t9XTtcblxuICAvLyBOdW1iZXIgb2Ygc2xvdHMgdG8gcmVzZXJ2ZSBmb3IgcHVyZUZ1bmN0aW9uc1xuICBwcml2YXRlIF9wdXJlRnVuY3Rpb25TbG90cyA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwYXJlbnRCaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZSwgcHJpdmF0ZSBsZXZlbCA9IDAsXG4gICAgICBwcml2YXRlIGNvbnRleHROYW1lOiBzdHJpbmd8bnVsbCwgcHJpdmF0ZSB0ZW1wbGF0ZU5hbWU6IHN0cmluZ3xudWxsLFxuICAgICAgcHJpdmF0ZSB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwsXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LCBwcml2YXRlIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4sIHByaXZhdGUgX25hbWVzcGFjZTogby5FeHRlcm5hbFJlZmVyZW5jZSkge1xuICAgIC8vIHZpZXcgcXVlcmllcyBjYW4gdGFrZSB1cCBzcGFjZSBpbiBkYXRhIGFuZCBhbGxvY2F0aW9uIGhhcHBlbnMgZWFybGllciAoaW4gdGhlIFwidmlld1F1ZXJ5XCJcbiAgICAvLyBmdW5jdGlvbilcbiAgICB0aGlzLl9kYXRhSW5kZXggPSB2aWV3UXVlcmllcy5sZW5ndGg7XG5cbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUgPSBwYXJlbnRCaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUobGV2ZWwpO1xuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgKCkgPT4gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCksXG4gICAgICAgIChudW1TbG90czogbnVtYmVyKTogbnVtYmVyID0+IHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IG51bVNsb3RzLFxuICAgICAgICAobmFtZSwgbG9jYWxOYW1lLCBzbG90LCB2YWx1ZTogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBpcGVUeXBlID0gcGlwZVR5cGVCeU5hbWUuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmIChwaXBlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5waXBlcy5hZGQocGlwZVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHRoaXMubGV2ZWwsIGxvY2FsTmFtZSwgdmFsdWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5waXBlLCBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwobmFtZSldKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICByZWdpc3RlckNvbnRleHRWYXJpYWJsZXModmFyaWFibGU6IHQuVmFyaWFibGUpIHtcbiAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlLm5hbWUgKyBzY29wZWROYW1lKTtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICByZXRyaWV2YWxMZXZlbCwgdmFyaWFibGUubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQsXG4gICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBsZXQgcmhzOiBvLkV4cHJlc3Npb247XG4gICAgICAgICAgaWYgKHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwpIHtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4XG4gICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZEN0eFZhciA9IHNjb3BlLmdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsKTtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4X3IwICAgT1IgIHgoMik7XG4gICAgICAgICAgICByaHMgPSBzaGFyZWRDdHhWYXIgPyBzaGFyZWRDdHhWYXIgOiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZS5nLiBjb25zdCAkaXRlbSQgPSB4KDIpLiRpbXBsaWNpdDtcbiAgICAgICAgICByZXR1cm4gW2xocy5zZXQocmhzLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKSkudG9Db25zdERlY2woKV07XG4gICAgICAgIH0pO1xuICB9XG5cbiAgYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgbm9kZXM6IHQuTm9kZVtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSwgaGFzTmdDb250ZW50OiBib29sZWFuID0gZmFsc2UsXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdID0gW10pOiBvLkZ1bmN0aW9uRXhwciB7XG4gICAgaWYgKHRoaXMuX25hbWVzcGFjZSAhPT0gUjMubmFtZXNwYWNlSFRNTCkge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIHRoaXMuX25hbWVzcGFjZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHZhcmlhYmxlIGJpbmRpbmdzXG4gICAgdmFyaWFibGVzLmZvckVhY2godiA9PiB0aGlzLnJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyh2KSk7XG5cbiAgICAvLyBPdXRwdXQgYSBgUHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIGFyZSBwcmVzZW50XG4gICAgaWYgKGhhc05nQ29udGVudCkge1xuICAgICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgLy8gT25seSBzZWxlY3RvcnMgd2l0aCBhIG5vbi1kZWZhdWx0IHZhbHVlIGFyZSBnZW5lcmF0ZWRcbiAgICAgIGlmIChuZ0NvbnRlbnRTZWxlY3RvcnMubGVuZ3RoID4gMSkge1xuICAgICAgICBjb25zdCByM1NlbGVjdG9ycyA9IG5nQ29udGVudFNlbGVjdG9ycy5tYXAocyA9PiBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocykpO1xuICAgICAgICAvLyBgcHJvamVjdGlvbkRlZmAgbmVlZHMgYm90aCB0aGUgcGFyc2VkIGFuZCByYXcgdmFsdWUgb2YgdGhlIHNlbGVjdG9yc1xuICAgICAgICBjb25zdCBwYXJzZWQgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHIzU2VsZWN0b3JzKSwgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IHVuUGFyc2VkID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChuZ0NvbnRlbnRTZWxlY3RvcnMpLCB0cnVlKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHBhcnNlZCwgdW5QYXJzZWQpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucHJvamVjdGlvbkRlZiwgcGFyYW1ldGVycyk7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpcyB0aGUgaW5pdGlhbCBwYXNzIHRocm91Z2ggdGhlIG5vZGVzIG9mIHRoaXMgdGVtcGxhdGUuIEluIHRoaXMgcGFzcywgd2VcbiAgICAvLyBxdWV1ZSBhbGwgY3JlYXRpb24gbW9kZSBhbmQgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIGZvciBnZW5lcmF0aW9uIGluIHRoZSBzZWNvbmRcbiAgICAvLyBwYXNzLiBJdCdzIG5lY2Vzc2FyeSB0byBzZXBhcmF0ZSB0aGUgcGFzc2VzIHRvIGVuc3VyZSBsb2NhbCByZWZzIGFyZSBkZWZpbmVkIGJlZm9yZVxuICAgIC8vIHJlc29sdmluZyBiaW5kaW5ncy5cbiAgICB0LnZpc2l0QWxsKHRoaXMsIG5vZGVzKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMpXG4gICAgY29uc3QgY3JlYXRpb25TdGF0ZW1lbnRzID0gdGhpcy5fY3JlYXRpb25Db2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgcHJvcGVydHkgb3IgdGV4dCBiaW5kaW5ncylcbiAgICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzID0gdGhpcy5fdXBkYXRlQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyBUbyBjb3VudCBzbG90cyBmb3IgdGhlIHJlc2VydmVTbG90cygpIGluc3RydWN0aW9uLCBhbGwgYmluZGluZ3MgbXVzdCBoYXZlIGJlZW4gdmlzaXRlZC5cbiAgICBpZiAodGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgPiAwKSB7XG4gICAgICBjcmVhdGlvblN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICBpbnN0cnVjdGlvbihudWxsLCBSMy5yZXNlcnZlU2xvdHMsIFtvLmxpdGVyYWwodGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMpXSkudG9TdG10KCkpO1xuICAgIH1cblxuICAgIC8vICBWYXJpYWJsZSBkZWNsYXJhdGlvbiBtdXN0IG9jY3VyIGFmdGVyIGJpbmRpbmcgcmVzb2x1dGlvbiBzbyB3ZSBjYW4gZ2VuZXJhdGUgY29udGV4dFxuICAgIC8vICBpbnN0cnVjdGlvbnMgdGhhdCBidWlsZCBvbiBlYWNoIG90aGVyLiBlLmcuIGNvbnN0IGIgPSB4KCkuJGltcGxpY2l0KCk7IGNvbnN0IGIgPSB4KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIC8vIEdlbmVyYXRlIG1hcHMgb2YgcGxhY2Vob2xkZXIgbmFtZSB0byBub2RlIGluZGV4ZXNcbiAgICAvLyBUT0RPKHZpY2IpOiBUaGlzIGlzIGEgV0lQLCBub3QgZnVsbHkgc3VwcG9ydGVkIHlldFxuICAgIGZvciAoY29uc3QgcGhUb05vZGVJZHggb2YgdGhpcy5fcGhUb05vZGVJZHhlcykge1xuICAgICAgaWYgKE9iamVjdC5rZXlzKHBoVG9Ob2RlSWR4KS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICAgIGNvbnN0IHBoTWFwID0gby52YXJpYWJsZShzY29wZWROYW1lKS5zZXQobWFwVG9FeHByZXNzaW9uKHBoVG9Ob2RlSWR4LCB0cnVlKSkudG9Db25zdERlY2woKTtcblxuICAgICAgICB0aGlzLl9wcmVmaXhDb2RlLnB1c2gocGhNYXApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLmZvckVhY2goYnVpbGRUZW1wbGF0ZUZuID0+IGJ1aWxkVGVtcGxhdGVGbigpKTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzZWxlY3RvckluZGV4ID0gbmdDb250ZW50LnNlbGVjdG9ySW5kZXg7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QpXTtcblxuICAgIGNvbnN0IGF0dHJpYnV0ZUFzTGlzdDogc3RyaW5nW10gPSBbXTtcblxuICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZvckVhY2goKGF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHJpYnV0ZS5uYW1lO1xuICAgICAgaWYgKG5hbWUgIT09ICdzZWxlY3QnKSB7XG4gICAgICAgIGF0dHJpYnV0ZUFzTGlzdC5wdXNoKG5hbWUsIGF0dHJpYnV0ZS52YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYXR0cmlidXRlQXNMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCksIGFzTGl0ZXJhbChhdHRyaWJ1dGVBc0xpc3QpKTtcbiAgICB9IGVsc2UgaWYgKHNlbGVjdG9ySW5kZXggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCkpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgcGFyYW1ldGVycyk7XG4gIH1cblxuXG4gIGdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleTogc3RyaW5nfG51bGwpIHtcbiAgICBzd2l0Y2ggKG5hbWVzcGFjZUtleSkge1xuICAgICAgY2FzZSAnbWF0aCc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VNYXRoTUw7XG4gICAgICBjYXNlICdzdmcnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlU1ZHO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZUhUTUw7XG4gICAgfVxuICB9XG5cbiAgYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24obnNJbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgdGhpcy5fbmFtZXNwYWNlID0gbnNJbnN0cnVjdGlvbjtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBuc0luc3RydWN0aW9uKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCB3YXNJbkkxOG5TZWN0aW9uID0gdGhpcy5faW5JMThuU2VjdGlvbjtcblxuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBjb25zdCBhdHRySTE4bk1ldGFzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBsZXQgaTE4bk1ldGE6IHN0cmluZyA9ICcnO1xuXG4gICAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcbiAgICBjb25zdCBpc05nQ29udGFpbmVyID0gY2hlY2tJc05nQ29udGFpbmVyKGVsZW1lbnQubmFtZSk7XG5cbiAgICAvLyBFbGVtZW50cyBpbnNpZGUgaTE4biBzZWN0aW9ucyBhcmUgcmVwbGFjZWQgd2l0aCBwbGFjZWhvbGRlcnNcbiAgICAvLyBUT0RPKHZpY2IpOiBuZXN0ZWQgZWxlbWVudHMgYXJlIGEgV0lQIGluIHRoaXMgcGhhc2VcbiAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbikge1xuICAgICAgY29uc3QgcGhOYW1lID0gZWxlbWVudC5uYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIXRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF1bcGhOYW1lXSkge1xuICAgICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF1bcGhOYW1lXS5wdXNoKGVsZW1lbnRJbmRleCk7XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIGkxOG4gYXR0cmlidXRlc1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyLm5hbWU7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICBpZiAobmFtZSA9PT0gSTE4Tl9BVFRSKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbkkxOG5TZWN0aW9uKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgQ291bGQgbm90IG1hcmsgYW4gZWxlbWVudCBhcyB0cmFuc2xhdGFibGUgaW5zaWRlIG9mIGEgdHJhbnNsYXRhYmxlIHNlY3Rpb25gKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9pbkkxOG5TZWN0aW9uID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5faTE4blNlY3Rpb25JbmRleCsrO1xuICAgICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdID0ge307XG4gICAgICAgIGkxOG5NZXRhID0gdmFsdWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUuc3RhcnRzV2l0aChJMThOX0FUVFJfUFJFRklYKSkge1xuICAgICAgICBhdHRySTE4bk1ldGFzW25hbWUuc2xpY2UoSTE4Tl9BVFRSX1BSRUZJWC5sZW5ndGgpXSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0QXR0cnNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYXRjaCBkaXJlY3RpdmVzIG9uIG5vbiBpMThuIGF0dHJpYnV0ZXNcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKGVsZW1lbnQubmFtZSwgb3V0cHV0QXR0cnMpO1xuICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLm1hdGNoKFxuICAgICAgICAgIHNlbGVjdG9yLCAoc2VsOiBDc3NTZWxlY3Rvciwgc3RhdGljVHlwZTogYW55KSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cblxuICAgIC8vIFJlZ3VsYXIgZWxlbWVudCBvciBuZy1jb250YWluZXIgY3JlYXRpb24gbW9kZVxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChlbGVtZW50SW5kZXgpXTtcbiAgICBpZiAoIWlzTmdDb250YWluZXIpIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoZWxlbWVudE5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGF0dHJpYnV0ZXNcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IGluaXRpYWxTdHlsZURlY2xhcmF0aW9uczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBjb25zdCBzdHlsZUlucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgY2xhc3NJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGFsbE90aGVySW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcblxuICAgIGVsZW1lbnQuaW5wdXRzLmZvckVhY2goKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKSA9PiB7XG4gICAgICBzd2l0Y2ggKGlucHV0LnR5cGUpIHtcbiAgICAgICAgLy8gW2F0dHIuc3R5bGVdIG9yIFthdHRyLmNsYXNzXSBzaG91bGQgbm90IGJlIHRyZWF0ZWQgYXMgc3R5bGluZy1iYXNlZFxuICAgICAgICAvLyBiaW5kaW5ncyBzaW5jZSB0aGV5IGFyZSBpbnRlbmRlZCB0byBiZSB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSBhdHRyXG4gICAgICAgIC8vIGFuZCB0aGVyZWZvcmUgd2lsbCBza2lwIGFsbCBzdHlsZS9jbGFzcyByZXNvbHV0aW9uIHRoYXQgaXMgcHJlc2VudFxuICAgICAgICAvLyB3aXRoIHN0eWxlPVwiXCIsIFtzdHlsZV09XCJcIiBhbmQgW3N0eWxlLnByb3BdPVwiXCIsIGNsYXNzPVwiXCIsXG4gICAgICAgIC8vIFtjbGFzcy5wcm9wXT1cIlwiLiBbY2xhc3NdPVwiXCIgYXNzaWdubWVudHNcbiAgICAgICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgICAgICBpZiAoaW5wdXQubmFtZSA9PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAvLyB0aGlzIHNob3VsZCBhbHdheXMgZ28gZmlyc3QgaW4gdGhlIGNvbXBpbGF0aW9uIChmb3IgW3N0eWxlXSlcbiAgICAgICAgICAgIHN0eWxlSW5wdXRzLnNwbGljZSgwLCAwLCBpbnB1dCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChpc0NsYXNzQmluZGluZyhpbnB1dCkpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyBnbyBmaXJzdCBpbiB0aGUgY29tcGlsYXRpb24gKGZvciBbY2xhc3NdKVxuICAgICAgICAgICAgY2xhc3NJbnB1dHMuc3BsaWNlKDAsIDAsIGlucHV0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICAgIHN0eWxlSW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgICAgIGNsYXNzSW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGFsbE90aGVySW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgbGV0IGN1cnJTdHlsZUluZGV4ID0gMDtcbiAgICBsZXQgY3VyckNsYXNzSW5kZXggPSAwO1xuICAgIGxldCBzdGF0aWNTdHlsZXNNYXA6IHtba2V5OiBzdHJpbmddOiBhbnl9fG51bGwgPSBudWxsO1xuICAgIGxldCBzdGF0aWNDbGFzc2VzTWFwOiB7W2tleTogc3RyaW5nXTogYm9vbGVhbn18bnVsbCA9IG51bGw7XG4gICAgY29uc3Qgc3R5bGVzSW5kZXhNYXA6IHtba2V5OiBzdHJpbmddOiBudW1iZXJ9ID0ge307XG4gICAgY29uc3QgY2xhc3Nlc0luZGV4TWFwOiB7W2tleTogc3RyaW5nXTogbnVtYmVyfSA9IHt9O1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG91dHB1dEF0dHJzKS5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBvdXRwdXRBdHRyc1tuYW1lXTtcbiAgICAgIGlmIChuYW1lID09ICdzdHlsZScpIHtcbiAgICAgICAgc3RhdGljU3R5bGVzTWFwID0gcGFyc2VTdHlsZSh2YWx1ZSk7XG4gICAgICAgIE9iamVjdC5rZXlzKHN0YXRpY1N0eWxlc01hcCkuZm9yRWFjaChwcm9wID0+IHsgc3R5bGVzSW5kZXhNYXBbcHJvcF0gPSBjdXJyU3R5bGVJbmRleCsrOyB9KTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PSAnY2xhc3MnKSB7XG4gICAgICAgIHN0YXRpY0NsYXNzZXNNYXAgPSB7fTtcbiAgICAgICAgdmFsdWUuc3BsaXQoL1xccysvZykuZm9yRWFjaChjbGFzc05hbWUgPT4ge1xuICAgICAgICAgIGNsYXNzZXNJbmRleE1hcFtjbGFzc05hbWVdID0gY3VyckNsYXNzSW5kZXgrKztcbiAgICAgICAgICBzdGF0aWNDbGFzc2VzTWFwICFbY2xhc3NOYW1lXSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKG8ubGl0ZXJhbChuYW1lKSk7XG4gICAgICAgIGlmIChhdHRySTE4bk1ldGFzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IHBhcnNlSTE4bk1ldGEoYXR0ckkxOG5NZXRhc1tuYW1lXSk7XG4gICAgICAgICAgY29uc3QgdmFyaWFibGUgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRUcmFuc2xhdGlvbih2YWx1ZSwgbWV0YSk7XG4gICAgICAgICAgYXR0cmlidXRlcy5wdXNoKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKHZhbHVlKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGxldCBoYXNNYXBCYXNlZFN0eWxpbmcgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0eWxlSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnB1dCA9IHN0eWxlSW5wdXRzW2ldO1xuICAgICAgY29uc3QgaXNNYXBCYXNlZFN0eWxlQmluZGluZyA9IGkgPT09IDAgJiYgaW5wdXQubmFtZSA9PT0gJ3N0eWxlJztcbiAgICAgIGlmIChpc01hcEJhc2VkU3R5bGVCaW5kaW5nKSB7XG4gICAgICAgIGhhc01hcEJhc2VkU3R5bGluZyA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKCFzdHlsZXNJbmRleE1hcC5oYXNPd25Qcm9wZXJ0eShpbnB1dC5uYW1lKSkge1xuICAgICAgICBzdHlsZXNJbmRleE1hcFtpbnB1dC5uYW1lXSA9IGN1cnJTdHlsZUluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbGFzc0lucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5wdXQgPSBjbGFzc0lucHV0c1tpXTtcbiAgICAgIGNvbnN0IGlzTWFwQmFzZWRDbGFzc0JpbmRpbmcgPSBpID09PSAwICYmIGlzQ2xhc3NCaW5kaW5nKGlucHV0KTtcbiAgICAgIGlmICghaXNNYXBCYXNlZENsYXNzQmluZGluZyAmJiAhc3R5bGVzSW5kZXhNYXAuaGFzT3duUHJvcGVydHkoaW5wdXQubmFtZSkpIHtcbiAgICAgICAgY2xhc3Nlc0luZGV4TWFwW2lucHV0Lm5hbWVdID0gY3VyckNsYXNzSW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbiB0aGUgZXZlbnQgdGhhdCBhIFtzdHlsZV0gYmluZGluZyBpcyB1c2VkIHRoZW4gc2FuaXRpemF0aW9uIHdpbGxcbiAgICAvLyBhbHdheXMgYmUgaW1wb3J0ZWQgYmVjYXVzZSBpdCBpcyBub3QgcG9zc2libGUgdG8ga25vdyBhaGVhZCBvZiB0aW1lXG4gICAgLy8gd2hldGhlciBzdHlsZSBiaW5kaW5ncyB3aWxsIHVzZSBvciBub3QgdXNlIGFueSBzYW5pdGl6YWJsZSBwcm9wZXJ0aWVzXG4gICAgLy8gdGhhdCBpc1N0eWxlU2FuaXRpemFibGUoKSB3aWxsIGRldGVjdFxuICAgIGxldCB1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIgPSBoYXNNYXBCYXNlZFN0eWxpbmc7XG5cbiAgICAvLyB0aGlzIHdpbGwgYnVpbGQgdGhlIGluc3RydWN0aW9ucyBzbyB0aGF0IHRoZXkgZmFsbCBpbnRvIHRoZSBmb2xsb3dpbmcgc3ludGF4XG4gICAgLy8gPT4gW3Byb3AxLCBwcm9wMiwgcHJvcDMsIDAsIHByb3AxLCB2YWx1ZTEsIHByb3AyLCB2YWx1ZTJdXG4gICAgT2JqZWN0LmtleXMoc3R5bGVzSW5kZXhNYXApLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICB1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIgPSB1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIgfHwgaXNTdHlsZVNhbml0aXphYmxlKHByb3ApO1xuICAgICAgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHByb3ApKTtcbiAgICB9KTtcblxuICAgIGlmIChzdGF0aWNTdHlsZXNNYXApIHtcbiAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChjb3JlLkluaXRpYWxTdHlsaW5nRmxhZ3MuVkFMVUVTX01PREUpKTtcblxuICAgICAgT2JqZWN0LmtleXMoc3RhdGljU3R5bGVzTWFwKS5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgICBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwocHJvcCkpO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHN0YXRpY1N0eWxlc01hcCAhW3Byb3BdO1xuICAgICAgICBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwodmFsdWUpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKGNsYXNzZXNJbmRleE1hcCkuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChwcm9wKSk7XG4gICAgfSk7XG5cbiAgICBpZiAoc3RhdGljQ2xhc3Nlc01hcCkge1xuICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKGNvcmUuSW5pdGlhbFN0eWxpbmdGbGFncy5WQUxVRVNfTU9ERSkpO1xuXG4gICAgICBPYmplY3Qua2V5cyhzdGF0aWNDbGFzc2VzTWFwKS5mb3JFYWNoKGNsYXNzTmFtZSA9PiB7XG4gICAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChjbGFzc05hbWUpKTtcbiAgICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHRydWUpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGhhc1N0eWxpbmdJbnN0cnVjdGlvbnMgPSBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMubGVuZ3RoIHx8IHN0eWxlSW5wdXRzLmxlbmd0aCB8fFxuICAgICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMubGVuZ3RoIHx8IGNsYXNzSW5wdXRzLmxlbmd0aDtcblxuICAgIGNvbnN0IGF0dHJBcmc6IG8uRXhwcmVzc2lvbiA9IGF0dHJpYnV0ZXMubGVuZ3RoID4gMCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoYXR0cmlidXRlcyksIHRydWUpIDpcbiAgICAgICAgby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgcGFyYW1ldGVycy5wdXNoKGF0dHJBcmcpO1xuXG4gICAgaWYgKGVsZW1lbnQucmVmZXJlbmNlcyAmJiBlbGVtZW50LnJlZmVyZW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcmVmZXJlbmNlcyA9IGZsYXR0ZW4oZWxlbWVudC5yZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICAgIC8vIEdlbmVyYXRlIHRoZSB1cGRhdGUgdGVtcG9yYXJ5LlxuICAgICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICAgICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZU5hbWUpO1xuICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHJlZmVyZW5jZS5uYW1lLCBsaHMsIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgLy8gZS5nLiB4KDIpO1xuICAgICAgICAgICAgICBjb25zdCBuZXh0Q29udGV4dFN0bXQgPVxuICAgICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgICAgLy8gZS5nLiBjb25zdCAkZm9vJCA9IHIoMSk7XG4gICAgICAgICAgICAgIGNvbnN0IHJlZkV4cHIgPSBsaHMuc2V0KG8uaW1wb3J0RXhwcihSMy5yZWZlcmVuY2UpLmNhbGxGbihbby5saXRlcmFsKHNsb3QpXSkpO1xuICAgICAgICAgICAgICByZXR1cm4gbmV4dENvbnRleHRTdG10LmNvbmNhdChyZWZFeHByLnRvQ29uc3REZWNsKCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBbcmVmZXJlbmNlLm5hbWUsIHJlZmVyZW5jZS52YWx1ZV07XG4gICAgICB9KSk7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyZWZlcmVuY2VzKSwgdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5UWVBFRF9OVUxMX0VYUFIpO1xuICAgIH1cblxuICAgIGNvbnN0IHdhc0luTmFtZXNwYWNlID0gdGhpcy5fbmFtZXNwYWNlO1xuICAgIGNvbnN0IGN1cnJlbnROYW1lc3BhY2UgPSB0aGlzLmdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleSk7XG5cbiAgICAvLyBJZiB0aGUgbmFtZXNwYWNlIGlzIGNoYW5naW5nIG5vdywgaW5jbHVkZSBhbiBpbnN0cnVjdGlvbiB0byBjaGFuZ2UgaXRcbiAgICAvLyBkdXJpbmcgZWxlbWVudCBjcmVhdGlvbi5cbiAgICBpZiAoY3VycmVudE5hbWVzcGFjZSAhPT0gd2FzSW5OYW1lc3BhY2UpIHtcbiAgICAgIHRoaXMuYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24oY3VycmVudE5hbWVzcGFjZSwgZWxlbWVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgaW1wbGljaXQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uID0gIWhhc1N0eWxpbmdJbnN0cnVjdGlvbnMgJiYgIWlzTmdDb250YWluZXIgJiZcbiAgICAgICAgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPT09IDAgJiYgZWxlbWVudC5vdXRwdXRzLmxlbmd0aCA9PT0gMDtcblxuICAgIGlmIChjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50LCB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQgOiBSMy5lbGVtZW50U3RhcnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgICAvLyBpbml0aWFsIHN0eWxpbmcgZm9yIHN0YXRpYyBzdHlsZT1cIi4uLlwiIGF0dHJpYnV0ZXNcbiAgICAgIGlmIChoYXNTdHlsaW5nSW5zdHJ1Y3Rpb25zKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtc0xpc3Q6IChvLkV4cHJlc3Npb24pW10gPSBbXTtcblxuICAgICAgICBpZiAoaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLmxlbmd0aCkge1xuICAgICAgICAgIC8vIHRoZSB0ZW1wbGF0ZSBjb21waWxlciBoYW5kbGVzIGluaXRpYWwgY2xhc3Mgc3R5bGluZyAoZS5nLiBjbGFzcz1cImZvb1wiKSB2YWx1ZXNcbiAgICAgICAgICAvLyBpbiBhIHNwZWNpYWwgY29tbWFuZCBjYWxsZWQgYGVsZW1lbnRDbGFzc2Agc28gdGhhdCB0aGUgaW5pdGlhbCBjbGFzc1xuICAgICAgICAgIC8vIGNhbiBiZSBwcm9jZXNzZWQgZHVyaW5nIHJ1bnRpbWUuIFRoZXNlIGluaXRpYWwgY2xhc3MgdmFsdWVzIGFyZSBib3VuZCB0b1xuICAgICAgICAgIC8vIGEgY29uc3RhbnQgYmVjYXVzZSB0aGUgaW5pdGFsIGNsYXNzIHZhbHVlcyBkbyBub3QgY2hhbmdlIChzaW5jZSB0aGV5J3JlIHN0YXRpYykuXG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKFxuICAgICAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucyksIHRydWUpKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMubGVuZ3RoIHx8IHVzZURlZmF1bHRTdHlsZVNhbml0aXplcikge1xuICAgICAgICAgIC8vIG5vIHBvaW50IGluIGhhdmluZyBhbiBleHRyYSBgbnVsbGAgdmFsdWUgdW5sZXNzIHRoZXJlIGFyZSBmb2xsb3ctdXAgcGFyYW1zXG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdGhlIHRlbXBsYXRlIGNvbXBpbGVyIGhhbmRsZXMgaW5pdGlhbCBzdHlsZSAoZS5nLiBzdHlsZT1cImZvb1wiKSB2YWx1ZXNcbiAgICAgICAgICAvLyBpbiBhIHNwZWNpYWwgY29tbWFuZCBjYWxsZWQgYGVsZW1lbnRTdHlsZWAgc28gdGhhdCB0aGUgaW5pdGlhbCBzdHlsZXNcbiAgICAgICAgICAvLyBjYW4gYmUgcHJvY2Vzc2VkIGR1cmluZyBydW50aW1lLiBUaGVzZSBpbml0aWFsIHN0eWxlcyB2YWx1ZXMgYXJlIGJvdW5kIHRvXG4gICAgICAgICAgLy8gYSBjb25zdGFudCBiZWNhdXNlIHRoZSBpbml0YWwgc3R5bGUgdmFsdWVzIGRvIG5vdCBjaGFuZ2UgKHNpbmNlIHRoZXkncmUgc3RhdGljKS5cbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goXG4gICAgICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zKSwgdHJ1ZSkpO1xuICAgICAgICB9IGVsc2UgaWYgKHVzZURlZmF1bHRTdHlsZVNhbml0aXplcikge1xuICAgICAgICAgIC8vIG5vIHBvaW50IGluIGhhdmluZyBhbiBleHRyYSBgbnVsbGAgdmFsdWUgdW5sZXNzIHRoZXJlIGFyZSBmb2xsb3ctdXAgcGFyYW1zXG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIpIHtcbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goby5pbXBvcnRFeHByKFIzLmRlZmF1bHRTdHlsZVNhbml0aXplcikpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLmVsZW1lbnRTdHlsaW5nLCBwYXJhbXNMaXN0KTtcbiAgICAgIH1cblxuICAgICAgLy8gR2VuZXJhdGUgTGlzdGVuZXJzIChvdXRwdXRzKVxuICAgICAgZWxlbWVudC5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IGVsTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihlbGVtZW50Lm5hbWUpO1xuICAgICAgICBjb25zdCBldk5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIob3V0cHV0QXN0Lm5hbWUpO1xuICAgICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSBgJHt0aGlzLnRlbXBsYXRlTmFtZX1fJHtlbE5hbWV9XyR7ZXZOYW1lfV9saXN0ZW5lcmA7XG5cbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lciwgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxpc3RlbmVyU2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUodGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCk7XG5cbiAgICAgICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgICAgICBsaXN0ZW5lclNjb3BlLCBpbXBsaWNpdCwgb3V0cHV0QXN0LmhhbmRsZXIsICdiJyxcbiAgICAgICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpKTtcblxuICAgICAgICAgIGNvbnN0IHN0YXRlbWVudHMgPSBbXG4gICAgICAgICAgICAuLi5saXN0ZW5lclNjb3BlLnJlc3RvcmVWaWV3U3RhdGVtZW50KCksIC4uLmxpc3RlbmVyU2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKSxcbiAgICAgICAgICAgIC4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10c1xuICAgICAgICAgIF07XG5cbiAgICAgICAgICBjb25zdCBoYW5kbGVyID0gby5mbihcbiAgICAgICAgICAgICAgW25ldyBvLkZuUGFyYW0oJyRldmVudCcsIG8uRFlOQU1JQ19UWVBFKV0sIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCxcbiAgICAgICAgICAgICAgZnVuY3Rpb25OYW1lKTtcblxuICAgICAgICAgIHJldHVybiBbby5saXRlcmFsKG91dHB1dEFzdC5uYW1lKSwgaGFuZGxlcl07XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKChzdHlsZUlucHV0cy5sZW5ndGggfHwgY2xhc3NJbnB1dHMubGVuZ3RoKSAmJiBoYXNTdHlsaW5nSW5zdHJ1Y3Rpb25zKSB7XG4gICAgICBjb25zdCBpbmRleExpdGVyYWwgPSBvLmxpdGVyYWwoZWxlbWVudEluZGV4KTtcblxuICAgICAgY29uc3QgZmlyc3RTdHlsZSA9IHN0eWxlSW5wdXRzWzBdO1xuICAgICAgY29uc3QgbWFwQmFzZWRTdHlsZUlucHV0ID0gZmlyc3RTdHlsZSAmJiBmaXJzdFN0eWxlLm5hbWUgPT0gJ3N0eWxlJyA/IGZpcnN0U3R5bGUgOiBudWxsO1xuXG4gICAgICBjb25zdCBmaXJzdENsYXNzID0gY2xhc3NJbnB1dHNbMF07XG4gICAgICBjb25zdCBtYXBCYXNlZENsYXNzSW5wdXQgPSBmaXJzdENsYXNzICYmIGlzQ2xhc3NCaW5kaW5nKGZpcnN0Q2xhc3MpID8gZmlyc3RDbGFzcyA6IG51bGw7XG5cbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dCA9IG1hcEJhc2VkU3R5bGVJbnB1dCB8fCBtYXBCYXNlZENsYXNzSW5wdXQ7XG4gICAgICBpZiAoc3R5bGluZ0lucHV0KSB7XG4gICAgICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgbGV0IHZhbHVlOiBBU1Q7XG4gICAgICAgIGlmIChtYXBCYXNlZENsYXNzSW5wdXQpIHtcbiAgICAgICAgICB2YWx1ZSA9IG1hcEJhc2VkQ2xhc3NJbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIH0gZWxzZSBpZiAobWFwQmFzZWRTdHlsZUlucHV0KSB7XG4gICAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1hcEJhc2VkU3R5bGVJbnB1dCkge1xuICAgICAgICAgIHZhbHVlID0gbWFwQmFzZWRTdHlsZUlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRTdHlsaW5nTWFwLCAoKSA9PiB7XG4gICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSwgdHJ1ZSkpO1xuICAgICAgICAgIHJldHVybiBbaW5kZXhMaXRlcmFsLCAuLi5wYXJhbXNdO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgbGV0IGxhc3RJbnB1dENvbW1hbmQ6IHQuQm91bmRBdHRyaWJ1dGV8bnVsbCA9IG51bGw7XG4gICAgICBpZiAoc3R5bGVJbnB1dHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCBpID0gbWFwQmFzZWRTdHlsZUlucHV0ID8gMSA6IDA7XG4gICAgICAgIGZvciAoaTsgaSA8IHN0eWxlSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBzdHlsZUlucHV0c1tpXTtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQpO1xuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG5cbiAgICAgICAgICBjb25zdCBrZXkgPSBpbnB1dC5uYW1lO1xuICAgICAgICAgIGNvbnN0IHN0eWxlSW5kZXg6IG51bWJlciA9IHN0eWxlc0luZGV4TWFwW2tleV0gITtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGlucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRTdHlsZVByb3AsICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIGluZGV4TGl0ZXJhbCwgby5saXRlcmFsKHN0eWxlSW5kZXgpLFxuICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlLCB0cnVlKSwgLi4ucGFyYW1zXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdElucHV0Q29tbWFuZCA9IHN0eWxlSW5wdXRzW3N0eWxlSW5wdXRzLmxlbmd0aCAtIDFdO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2xhc3NJbnB1dHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCBpID0gbWFwQmFzZWRDbGFzc0lucHV0ID8gMSA6IDA7XG4gICAgICAgIGZvciAoaTsgaSA8IGNsYXNzSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBjbGFzc0lucHV0c1tpXTtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQpO1xuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG5cbiAgICAgICAgICBjb25zdCBrZXkgPSBpbnB1dC5uYW1lO1xuICAgICAgICAgIGNvbnN0IGNsYXNzSW5kZXg6IG51bWJlciA9IGNsYXNzZXNJbmRleE1hcFtrZXldICE7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbnB1dC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50Q2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICBpbmRleExpdGVyYWwsIG8ubGl0ZXJhbChjbGFzc0luZGV4KSxcbiAgICAgICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSwgdHJ1ZSksIC4uLnBhcmFtc1xuICAgICAgICAgICAgXTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxhc3RJbnB1dENvbW1hbmQgPSBjbGFzc0lucHV0c1tjbGFzc0lucHV0cy5sZW5ndGggLSAxXTtcbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihsYXN0SW5wdXRDb21tYW5kICEuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxpbmdBcHBseSwgW2luZGV4TGl0ZXJhbF0pO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIGVsZW1lbnQgaW5wdXQgYmluZGluZ3NcbiAgICBhbGxPdGhlcklucHV0cy5mb3JFYWNoKChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4ge1xuICAgICAgaWYgKGlucHV0LnR5cGUgPT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCd3YXJuaW5nOiBhbmltYXRpb24gYmluZGluZ3Mgbm90IHlldCBzdXBwb3J0ZWQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IG1hcEJpbmRpbmdUb0luc3RydWN0aW9uKGlucHV0LnR5cGUpO1xuICAgICAgaWYgKGluc3RydWN0aW9uKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQpO1xuICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSBwYXJhbXMucHVzaChzYW5pdGl6YXRpb25SZWYpO1xuXG4gICAgICAgIC8vIFRPRE8oY2h1Y2tqKTogcnVudGltZTogc2VjdXJpdHkgY29udGV4dD9cbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oaW5wdXQuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24sICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSxcbiAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUpLCAuLi5wYXJhbXNcbiAgICAgICAgICBdO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Vuc3VwcG9ydGVkKGBiaW5kaW5nIHR5cGUgJHtpbnB1dC50eXBlfWApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVHJhdmVyc2UgZWxlbWVudCBjaGlsZCBub2Rlc1xuICAgIGlmICh0aGlzLl9pbkkxOG5TZWN0aW9uICYmIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID09IDEgJiZcbiAgICAgICAgZWxlbWVudC5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgY29uc3QgdGV4dCA9IGVsZW1lbnQuY2hpbGRyZW5bMF0gYXMgdC5UZXh0O1xuICAgICAgdGhpcy52aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dCwgaTE4bk1ldGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIH1cblxuICAgIGlmICghY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgLy8gRmluaXNoIGVsZW1lbnQgY29uc3RydWN0aW9uIG1vZGUuXG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbixcbiAgICAgICAgICBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lckVuZCA6IFIzLmVsZW1lbnRFbmQpO1xuICAgIH1cblxuICAgIC8vIFJlc3RvcmUgdGhlIHN0YXRlIGJlZm9yZSBleGl0aW5nIHRoaXMgbm9kZVxuICAgIHRoaXMuX2luSTE4blNlY3Rpb24gPSB3YXNJbkkxOG5TZWN0aW9uO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogdC5UZW1wbGF0ZSkge1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGxldCBlbE5hbWUgPSAnJztcbiAgICBpZiAodGVtcGxhdGUuY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIHRlbXBsYXRlLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICAvLyBXaGVuIHRoZSB0ZW1wbGF0ZSBhcyBhIHNpbmdsZSBjaGlsZCwgZGVyaXZlIHRoZSBjb250ZXh0IG5hbWUgZnJvbSB0aGUgdGFnXG4gICAgICBlbE5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIoKHRlbXBsYXRlLmNoaWxkcmVuWzBdIGFzIHQuRWxlbWVudCkubmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBlbE5hbWUgPyBgJHt0aGlzLmNvbnRleHROYW1lfV8ke2VsTmFtZX1gIDogJyc7XG5cbiAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPVxuICAgICAgICBjb250ZXh0TmFtZSA/IGAke2NvbnRleHROYW1lfV9UZW1wbGF0ZV8ke3RlbXBsYXRlSW5kZXh9YCA6IGBUZW1wbGF0ZV8ke3RlbXBsYXRlSW5kZXh9YDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuICAgICAgby5UWVBFRF9OVUxMX0VYUFIsXG4gICAgXTtcblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gYm90aCBhdHRyaWJ1dGVzIGFuZCBib3VuZCBwcm9wZXJ0aWVzXG4gICAgY29uc3QgYXR0cmlidXRlTmFtZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgYXR0cmlidXRlTWFwOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICAgIHRlbXBsYXRlLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICAgIGF0dHJpYnV0ZU5hbWVzLnB1c2goYXNMaXRlcmFsKGEubmFtZSksIGFzTGl0ZXJhbCgnJykpO1xuICAgICAgYXR0cmlidXRlTWFwW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgIH0pO1xuXG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2goaSA9PiB7XG4gICAgICBhdHRyaWJ1dGVOYW1lcy5wdXNoKGFzTGl0ZXJhbChpLm5hbWUpLCBhc0xpdGVyYWwoJycpKTtcbiAgICAgIGF0dHJpYnV0ZU1hcFtpLm5hbWVdID0gJyc7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKCduZy10ZW1wbGF0ZScsIGF0dHJpYnV0ZU1hcCk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIubWF0Y2goXG4gICAgICAgICAgc2VsZWN0b3IsIChjc3NTZWxlY3Rvciwgc3RhdGljVHlwZSkgPT4geyB0aGlzLmRpcmVjdGl2ZXMuYWRkKHN0YXRpY1R5cGUpOyB9KTtcbiAgICB9XG5cbiAgICBpZiAoYXR0cmlidXRlTmFtZXMubGVuZ3RoKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVOYW1lcyksIHRydWUpKTtcbiAgICB9XG5cbiAgICAvLyBlLmcuIHRlbXBsYXRlKDEsIE15Q29tcF9UZW1wbGF0ZV8xKVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy50ZW1wbGF0ZUNyZWF0ZSwgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgLy8gZS5nLiBwKDEsICdmb3JPZicsIMm1YmluZChjdHguaXRlbXMpKTtcbiAgICBjb25zdCBjb250ZXh0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgIHRlbXBsYXRlLmlucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy5lbGVtZW50UHJvcGVydHksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSxcbiAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoY29udGV4dCwgdmFsdWUpXG4gICAgICAgIF07XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSB0aGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAgICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0ZW1wbGF0ZU5hbWUsIFtdLFxuICAgICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIsIHRoaXMuZGlyZWN0aXZlcywgdGhpcy5waXBlVHlwZUJ5TmFtZSwgdGhpcy5waXBlcywgdGhpcy5fbmFtZXNwYWNlKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbCBhZnRlciB0aGVpciBwYXJlbnQgdGVtcGxhdGVzIGhhdmUgY29tcGxldGVkXG4gICAgLy8gcHJvY2Vzc2luZywgc28gdGhleSBhcmUgcXVldWVkIGhlcmUgdW50aWwgYWZ0ZXIgdGhlIGluaXRpYWwgcGFzcy4gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndFxuICAgIC8vIGJlIGFibGUgdG8gc3VwcG9ydCBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIHRvIGxvY2FsIHJlZnMgdGhhdCBvY2N1ciBhZnRlciB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBkZWZpbml0aW9uLiBlLmcuIDxkaXYgKm5nSWY9XCJzaG93aW5nXCI+IHt7IGZvbyB9fSA8L2Rpdj4gIDxkaXYgI2Zvbz48L2Rpdj5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID1cbiAgICAgICAgICB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBUaGVzZSBzaG91bGQgYmUgaGFuZGxlZCBpbiB0aGUgdGVtcGxhdGUgb3IgZWxlbWVudCBkaXJlY3RseS5cbiAgcmVhZG9ubHkgdmlzaXRSZWZlcmVuY2UgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFZhcmlhYmxlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRUZXh0QXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRFdmVudCA9IGludmFsaWQ7XG5cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogdC5Cb3VuZFRleHQpIHtcbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuXG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHRCaW5kaW5nLFxuICAgICAgICAoKSA9PiBbby5saXRlcmFsKG5vZGVJbmRleCksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSksIHZhbHVlKV0pO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IHQuVGV4dCkge1xuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSwgby5saXRlcmFsKHRleHQudmFsdWUpXSk7XG4gIH1cblxuICAvLyBXaGVuIHRoZSBjb250ZW50IG9mIHRoZSBlbGVtZW50IGlzIGEgc2luZ2xlIHRleHQgbm9kZSB0aGUgdHJhbnNsYXRpb24gY2FuIGJlIGlubGluZWQ6XG4gIC8vXG4gIC8vIGA8cCBpMThuPVwiZGVzY3xtZWFuXCI+c29tZSBjb250ZW50PC9wPmBcbiAgLy8gY29tcGlsZXMgdG9cbiAgLy8gYGBgXG4gIC8vIC8qKlxuICAvLyAqIEBkZXNjIGRlc2NcbiAgLy8gKiBAbWVhbmluZyBtZWFuXG4gIC8vICovXG4gIC8vIGNvbnN0IE1TR19YWVogPSBnb29nLmdldE1zZygnc29tZSBjb250ZW50Jyk7XG4gIC8vIGkwLsm1dGV4dCgxLCBNU0dfWFlaKTtcbiAgLy8gYGBgXG4gIHZpc2l0U2luZ2xlSTE4blRleHRDaGlsZCh0ZXh0OiB0LlRleHQsIGkxOG5NZXRhOiBzdHJpbmcpIHtcbiAgICBjb25zdCBtZXRhID0gcGFyc2VJMThuTWV0YShpMThuTWV0YSk7XG4gICAgY29uc3QgdmFyaWFibGUgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRUcmFuc2xhdGlvbih0ZXh0LnZhbHVlLCBtZXRhKTtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIHZhcmlhYmxlXSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlRGF0YVNsb3QoKSB7IHJldHVybiB0aGlzLl9kYXRhSW5kZXgrKzsgfVxuICBwcml2YXRlIGJpbmRpbmdDb250ZXh0KCkgeyByZXR1cm4gYCR7dGhpcy5fYmluZGluZ0NvbnRleHQrK31gOyB9XG5cbiAgLy8gQmluZGluZ3MgbXVzdCBvbmx5IGJlIHJlc29sdmVkIGFmdGVyIGFsbCBsb2NhbCByZWZzIGhhdmUgYmVlbiB2aXNpdGVkLCBzbyBhbGxcbiAgLy8gaW5zdHJ1Y3Rpb25zIGFyZSBxdWV1ZWQgaW4gY2FsbGJhY2tzIHRoYXQgZXhlY3V0ZSBvbmNlIHRoZSBpbml0aWFsIHBhc3MgaGFzIGNvbXBsZXRlZC5cbiAgLy8gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndCBiZSBhYmxlIHRvIHN1cHBvcnQgbG9jYWwgcmVmcyB0aGF0IGFyZSBkZWZpbmVkIGFmdGVyIHRoZWlyXG4gIC8vIGJpbmRpbmdzLiBlLmcuIHt7IGZvbyB9fSA8ZGl2ICNmb28+PC9kaXY+XG4gIHByaXZhdGUgaW5zdHJ1Y3Rpb25GbihcbiAgICAgIGZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbjogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSk6IHZvaWQge1xuICAgIGZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IEFycmF5LmlzQXJyYXkocGFyYW1zT3JGbikgPyBwYXJhbXNPckZuIDogcGFyYW1zT3JGbigpO1xuICAgICAgcmV0dXJuIGluc3RydWN0aW9uKHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSkge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl9jcmVhdGlvbkNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQ6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IEFTVCwgc2tpcEJpbmRGbj86IGJvb2xlYW4pOlxuICAgICAgby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uRm4gPVxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyBpbnRlcnBvbGF0ZSA6ICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKTtcblxuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgIHRoaXMsIGltcGxpY2l0LCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUsIGludGVycG9sYXRpb25Gbik7XG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG5cbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gfHwgc2tpcEJpbmRGbiA/IHZhbEV4cHIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW3ZhbEV4cHJdKTtcbiAgfVxufVxuXG5jbGFzcyBWYWx1ZUNvbnZlcnRlciBleHRlbmRzIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwcml2YXRlIGFsbG9jYXRlU2xvdDogKCkgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBkZWZpbmVQaXBlOlxuICAgICAgICAgIChuYW1lOiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBzbG90OiBudW1iZXIsIHZhbHVlOiBvLkV4cHJlc3Npb24pID0+IHZvaWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLy8gQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXJcbiAgdmlzaXRQaXBlKHBpcGU6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIC8vIEFsbG9jYXRlIGEgc2xvdCB0byBjcmVhdGUgdGhlIHBpcGVcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZVNsb3QoKTtcbiAgICBjb25zdCBzbG90UHNldWRvTG9jYWwgPSBgUElQRToke3Nsb3R9YDtcbiAgICAvLyBBbGxvY2F0ZSBvbmUgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIG9uZSBzbG90IHBlciBwaXBlIGFyZ3VtZW50XG4gICAgY29uc3QgcHVyZUZ1bmN0aW9uU2xvdCA9IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cygyICsgcGlwZS5hcmdzLmxlbmd0aCk7XG4gICAgY29uc3QgdGFyZ2V0ID0gbmV3IFByb3BlcnR5UmVhZChwaXBlLnNwYW4sIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHBpcGUuc3BhbiksIHNsb3RQc2V1ZG9Mb2NhbCk7XG4gICAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHBpcGVCaW5kaW5nQ2FsbEluZm8ocGlwZS5hcmdzKTtcbiAgICB0aGlzLmRlZmluZVBpcGUocGlwZS5uYW1lLCBzbG90UHNldWRvTG9jYWwsIHNsb3QsIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKSk7XG4gICAgY29uc3QgYXJnczogQVNUW10gPSBbcGlwZS5leHAsIC4uLnBpcGUuYXJnc107XG4gICAgY29uc3QgY29udmVydGVkQXJnczogQVNUW10gPVxuICAgICAgICBpc1Zhckxlbmd0aCA/IHRoaXMudmlzaXRBbGwoW25ldyBMaXRlcmFsQXJyYXkocGlwZS5zcGFuLCBhcmdzKV0pIDogdGhpcy52aXNpdEFsbChhcmdzKTtcblxuICAgIHJldHVybiBuZXcgRnVuY3Rpb25DYWxsKHBpcGUuc3BhbiwgdGFyZ2V0LCBbXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHNsb3QpLFxuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwdXJlRnVuY3Rpb25TbG90KSxcbiAgICAgIC4uLmNvbnZlcnRlZEFyZ3MsXG4gICAgXSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxBcnJheShhcnJheTogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChhcnJheS5zcGFuLCB0aGlzLnZpc2l0QWxsKGFycmF5LmV4cHJlc3Npb25zKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgIHJldHVybiB2YWx1ZXMuZXZlcnkoYSA9PiBhLmlzQ29uc3RhbnQoKSkgP1xuICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChsaXRlcmFsLCB0cnVlKSA6XG4gICAgICAgICAgZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAobWFwOiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChtYXAuc3BhbiwgdGhpcy52aXNpdEFsbChtYXAudmFsdWVzKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuIE90aGVyd2lzZSwganVzdCByZXR1cm4gYW4gbGl0ZXJhbCBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsTWFwKHZhbHVlcy5tYXAoXG4gICAgICAgICAgKHZhbHVlLCBpbmRleCkgPT4gKHtrZXk6IG1hcC5rZXlzW2luZGV4XS5rZXksIHZhbHVlLCBxdW90ZWQ6IG1hcC5rZXlzW2luZGV4XS5xdW90ZWR9KSkpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxufVxuXG4vLyBQaXBlcyBhbHdheXMgaGF2ZSBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyLCB0aGUgdmFsdWUgdGhleSBvcGVyYXRlIG9uXG5jb25zdCBwaXBlQmluZGluZ0lkZW50aWZpZXJzID0gW1IzLnBpcGVCaW5kMSwgUjMucGlwZUJpbmQyLCBSMy5waXBlQmluZDMsIFIzLnBpcGVCaW5kNF07XG5cbmZ1bmN0aW9uIHBpcGVCaW5kaW5nQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHBpcGVCaW5kaW5nSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucGlwZUJpbmRWLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuY29uc3QgcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnMgPSBbXG4gIFIzLnB1cmVGdW5jdGlvbjAsIFIzLnB1cmVGdW5jdGlvbjEsIFIzLnB1cmVGdW5jdGlvbjIsIFIzLnB1cmVGdW5jdGlvbjMsIFIzLnB1cmVGdW5jdGlvbjQsXG4gIFIzLnB1cmVGdW5jdGlvbjUsIFIzLnB1cmVGdW5jdGlvbjYsIFIzLnB1cmVGdW5jdGlvbjcsIFIzLnB1cmVGdW5jdGlvbjhcbl07XG5cbmZ1bmN0aW9uIHB1cmVGdW5jdGlvbkNhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwdXJlRnVuY3Rpb25JZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5wdXJlRnVuY3Rpb25WLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5zdHJ1Y3Rpb24oXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgIHBhcmFtczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKHJlZmVyZW5jZSwgbnVsbCwgc3BhbikuY2FsbEZuKHBhcmFtcywgc3Bhbik7XG59XG5cbi8vIGUuZy4geCgyKTtcbmZ1bmN0aW9uIGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWxEaWZmOiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLm5leHRDb250ZXh0KVxuICAgICAgLmNhbGxGbihyZWxhdGl2ZUxldmVsRGlmZiA+IDEgPyBbby5saXRlcmFsKHJlbGF0aXZlTGV2ZWxEaWZmKV0gOiBbXSk7XG59XG5cbmZ1bmN0aW9uIGdldExpdGVyYWxGYWN0b3J5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBsaXRlcmFsOiBvLkxpdGVyYWxBcnJheUV4cHIgfCBvLkxpdGVyYWxNYXBFeHByLFxuICAgIGFsbG9jYXRlU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB7bGl0ZXJhbEZhY3RvcnksIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzfSA9IGNvbnN0YW50UG9vbC5nZXRMaXRlcmFsRmFjdG9yeShsaXRlcmFsKTtcbiAgLy8gQWxsb2NhdGUgMSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgMSBwZXIgYXJndW1lbnRcbiAgY29uc3Qgc3RhcnRTbG90ID0gYWxsb2NhdGVTbG90cygxICsgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoKTtcbiAgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoID4gMCB8fCBlcnJvcihgRXhwZWN0ZWQgYXJndW1lbnRzIHRvIGEgbGl0ZXJhbCBmYWN0b3J5IGZ1bmN0aW9uYCk7XG4gIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwdXJlRnVuY3Rpb25DYWxsSW5mbyhsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG5cbiAgLy8gTGl0ZXJhbCBmYWN0b3JpZXMgYXJlIHB1cmUgZnVuY3Rpb25zIHRoYXQgb25seSBuZWVkIHRvIGJlIHJlLWludm9rZWQgd2hlbiB0aGUgcGFyYW1ldGVyc1xuICAvLyBjaGFuZ2UuXG4gIGNvbnN0IGFyZ3MgPSBbXG4gICAgby5saXRlcmFsKHN0YXJ0U2xvdCksXG4gICAgbGl0ZXJhbEZhY3RvcnksXG4gIF07XG5cbiAgaWYgKGlzVmFyTGVuZ3RoKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbEFycihsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cykpO1xuICB9IGVsc2Uge1xuICAgIGFyZ3MucHVzaCguLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKGlkZW50aWZpZXIpLmNhbGxGbihhcmdzKTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG5leHBvcnQgdHlwZSBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IG8uU3RhdGVtZW50W107XG5cbi8qKiBUaGUgcHJlZml4IHVzZWQgdG8gZ2V0IGEgc2hhcmVkIGNvbnRleHQgaW4gQmluZGluZ1Njb3BlJ3MgbWFwLiAqL1xuY29uc3QgU0hBUkVEX0NPTlRFWFRfS0VZID0gJyQkc2hhcmVkX2N0eCQkJztcblxuLyoqXG4gKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0geCgyKS4kaW1wbGljaXRgLlxuICogLSBrZXkgdG8gdGhlIG1hcCBpcyB0aGUgc3RyaW5nIGxpdGVyYWwgYFwiYWJjXCJgLlxuICogLSB2YWx1ZSBgcmV0cmlldmFsTGV2ZWxgIGlzIHRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZCwgd2hpY2ggaXMgMiBsZXZlbHNcbiAqIHVwIGluIGV4YW1wbGUuXG4gKiAtIHZhbHVlIGBsaHNgIGlzIHRoZSBsZWZ0IGhhbmQgc2lkZSB3aGljaCBpcyBhbiBBU1QgcmVwcmVzZW50aW5nIGBhYmNgLlxuICogLSB2YWx1ZSBgZGVjbGFyZUxvY2FsQ2FsbGJhY2tgIGlzIGEgY2FsbGJhY2sgdGhhdCBpcyBpbnZva2VkIHdoZW4gZGVjbGFyaW5nIHRoZSBsb2NhbC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVgIGlzIHRydWUgaWYgdGhpcyB2YWx1ZSBuZWVkcyB0byBiZSBkZWNsYXJlZC5cbiAqIC0gdmFsdWUgYHByaW9yaXR5YCBkaWN0YXRlcyB0aGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhciBkZWNsYXJhdGlvbiBjb21wYXJlZFxuICogdG8gb3RoZXIgdmFyIGRlY2xhcmF0aW9ucyBvbiB0aGUgc2FtZSByZXRyaWV2YWwgbGV2ZWwuIEZvciBleGFtcGxlLCBpZiB0aGVyZSBpcyBhXG4gKiBjb250ZXh0IHZhcmlhYmxlIGFuZCBhIGxvY2FsIHJlZiBhY2Nlc3NpbmcgdGhlIHNhbWUgcGFyZW50IHZpZXcsIHRoZSBjb250ZXh0IHZhclxuICogZGVjbGFyYXRpb24gc2hvdWxkIGFsd2F5cyBjb21lIGJlZm9yZSB0aGUgbG9jYWwgcmVmIGRlY2xhcmF0aW9uLlxuICovXG50eXBlIEJpbmRpbmdEYXRhID0ge1xuICByZXRyaWV2YWxMZXZlbDogbnVtYmVyOyBsaHM6IG8uUmVhZFZhckV4cHI7IGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2s7XG4gIGRlY2xhcmU6IGJvb2xlYW47XG4gIHByaW9yaXR5OiBudW1iZXI7XG59O1xuXG4vKipcbiAqIFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIGEgbG9jYWwgdmFyaWFibGUgZGVjbGFyYXRpb24uIEhpZ2hlciBudW1iZXJzXG4gKiBtZWFuIHRoZSBkZWNsYXJhdGlvbiB3aWxsIGFwcGVhciBmaXJzdCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmNvbnN0IGVudW0gRGVjbGFyYXRpb25Qcmlvcml0eSB7IERFRkFVTFQgPSAwLCBDT05URVhUID0gMSwgU0hBUkVEX0NPTlRFWFQgPSAyIH1cblxuZXhwb3J0IGNsYXNzIEJpbmRpbmdTY29wZSBpbXBsZW1lbnRzIExvY2FsUmVzb2x2ZXIge1xuICAvKiogS2VlcHMgYSBtYXAgZnJvbSBsb2NhbCB2YXJpYWJsZXMgdG8gdGhlaXIgQmluZGluZ0RhdGEuICovXG4gIHByaXZhdGUgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEJpbmRpbmdEYXRhPigpO1xuICBwcml2YXRlIHJlZmVyZW5jZU5hbWVJbmRleCA9IDA7XG4gIHByaXZhdGUgcmVzdG9yZVZpZXdWYXJpYWJsZTogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcblxuICBzdGF0aWMgUk9PVF9TQ09QRSA9IG5ldyBCaW5kaW5nU2NvcGUoKS5zZXQoMCwgJyRldmVudCcsIG8udmFyaWFibGUoJyRldmVudCcpKTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKHB1YmxpYyBiaW5kaW5nTGV2ZWw6IG51bWJlciA9IDAsIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwpIHt9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVgIHN0YXRlXG4gICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICByZXRyaWV2YWxMZXZlbDogdmFsdWUucmV0cmlldmFsTGV2ZWwsXG4gICAgICAgICAgICBsaHM6IHZhbHVlLmxocyxcbiAgICAgICAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgICAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IHZhbHVlLnByaW9yaXR5XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgLy8gUG9zc2libHkgZ2VuZXJhdGUgYSBzaGFyZWQgY29udGV4dCB2YXJcbiAgICAgICAgICB0aGlzLm1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcodmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICYmICF2YWx1ZS5kZWNsYXJlKSB7XG4gICAgICAgICAgdmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlLmxocztcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBnZXQgdG8gdGhpcyBwb2ludCwgd2UgYXJlIGxvb2tpbmcgZm9yIGEgcHJvcGVydHkgb24gdGhlIHRvcCBsZXZlbCBjb21wb25lbnRcbiAgICAvLyAtIElmIGxldmVsID09PSAwLCB3ZSBhcmUgb24gdGhlIHRvcCBhbmQgZG9uJ3QgbmVlZCB0byByZS1kZWNsYXJlIGBjdHhgLlxuICAgIC8vIC0gSWYgbGV2ZWwgPiAwLCB3ZSBhcmUgaW4gYW4gZW1iZWRkZWQgdmlldy4gV2UgbmVlZCB0byByZXRyaWV2ZSB0aGUgbmFtZSBvZiB0aGVcbiAgICAvLyBsb2NhbCB2YXIgd2UgdXNlZCB0byBzdG9yZSB0aGUgY29tcG9uZW50IGNvbnRleHQsIGUuZy4gY29uc3QgJGNvbXAkID0geCgpO1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdMZXZlbCA9PT0gMCA/IG51bGwgOiB0aGlzLmdldENvbXBvbmVudFByb3BlcnR5KG5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGxvY2FsIHZhcmlhYmxlIGZvciBsYXRlciByZWZlcmVuY2UuXG4gICAqXG4gICAqIEBwYXJhbSByZXRyaWV2YWxMZXZlbCBUaGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWRcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgdmFyaWFibGUuXG4gICAqIEBwYXJhbSBsaHMgQVNUIHJlcHJlc2VudGluZyB0aGUgbGVmdCBoYW5kIHNpZGUgb2YgdGhlIGBsZXQgbGhzID0gcmhzO2AuXG4gICAqIEBwYXJhbSBwcmlvcml0eSBUaGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhclxuICAgKiBAcGFyYW0gZGVjbGFyZUxvY2FsQ2FsbGJhY2sgVGhlIGNhbGxiYWNrIHRvIGludm9rZSB3aGVuIGRlY2xhcmluZyB0aGlzIGxvY2FsIHZhclxuICAgKi9cbiAgc2V0KHJldHJpZXZhbExldmVsOiBudW1iZXIsIG5hbWU6IHN0cmluZywgbGhzOiBvLlJlYWRWYXJFeHByLFxuICAgICAgcHJpb3JpdHk6IG51bWJlciA9IERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2spOiBCaW5kaW5nU2NvcGUge1xuICAgICF0aGlzLm1hcC5oYXMobmFtZSkgfHxcbiAgICAgICAgZXJyb3IoYFRoZSBuYW1lICR7bmFtZX0gaXMgYWxyZWFkeSBkZWZpbmVkIGluIHNjb3BlIHRvIGJlICR7dGhpcy5tYXAuZ2V0KG5hbWUpfWApO1xuICAgIHRoaXMubWFwLnNldChuYW1lLCB7XG4gICAgICByZXRyaWV2YWxMZXZlbDogcmV0cmlldmFsTGV2ZWwsXG4gICAgICBsaHM6IGxocyxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IGRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgcHJpb3JpdHk6IHByaW9yaXR5XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiAoby5FeHByZXNzaW9ufG51bGwpIHsgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpOyB9XG5cbiAgbmVzdGVkU2NvcGUobGV2ZWw6IG51bWJlcik6IEJpbmRpbmdTY29wZSB7XG4gICAgY29uc3QgbmV3U2NvcGUgPSBuZXcgQmluZGluZ1Njb3BlKGxldmVsLCB0aGlzKTtcbiAgICBpZiAobGV2ZWwgPiAwKSBuZXdTY29wZS5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gICAgcmV0dXJuIG5ld1Njb3BlO1xuICB9XG5cbiAgZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWw6IG51bWJlcik6IG8uUmVhZFZhckV4cHJ8bnVsbCB7XG4gICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsKTtcbiAgICByZXR1cm4gc2hhcmVkQ3R4T2JqICYmIHNoYXJlZEN0eE9iai5kZWNsYXJlID8gc2hhcmVkQ3R4T2JqLmxocyA6IG51bGw7XG4gIH1cblxuICBtYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZTogQmluZGluZ0RhdGEpIHtcbiAgICBpZiAodmFsdWUucHJpb3JpdHkgPT09IERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCkge1xuICAgICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIGlmIChzaGFyZWRDdHhPYmopIHtcbiAgICAgICAgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbDogbnVtYmVyKSB7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUgKyB0aGlzLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICB0aGlzLm1hcC5zZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgLy8gY29uc3QgY3R4X3IwID0geCgyKTtcbiAgICAgICAgcmV0dXJuIFtsaHMuc2V0KGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgIH0sXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIHByaW9yaXR5OiBEZWNsYXJhdGlvblByaW9yaXR5LlNIQVJFRF9DT05URVhUXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbXBvbmVudFZhbHVlID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApICE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KDApO1xuICAgIHJldHVybiBjb21wb25lbnRWYWx1ZS5saHMucHJvcChuYW1lKTtcbiAgfVxuXG4gIG1heWJlUmVzdG9yZVZpZXcocmV0cmlldmFsTGV2ZWw6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmlzTGlzdGVuZXJTY29wZSgpICYmIHJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwpIHtcbiAgICAgIGlmICghdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlKSB7XG4gICAgICAgIC8vIHBhcmVudCBzYXZlcyB2YXJpYWJsZSB0byBnZW5lcmF0ZSBhIHNoYXJlZCBgY29uc3QgJHMkID0gZ1YoKTtgIGluc3RydWN0aW9uXG4gICAgICAgIHRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZSA9IG8udmFyaWFibGUodGhpcy5wYXJlbnQgIS5mcmVzaFJlZmVyZW5jZU5hbWUoKSk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgPSB0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGU7XG4gICAgfVxuICB9XG5cbiAgcmVzdG9yZVZpZXdTdGF0ZW1lbnQoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gclYoJHN0YXRlJCk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFtpbnN0cnVjdGlvbihudWxsLCBSMy5yZXN0b3JlVmlldywgW3RoaXMucmVzdG9yZVZpZXdWYXJpYWJsZV0pLnRvU3RtdCgpXSA6XG4gICAgICAgIFtdO1xuICB9XG5cbiAgdmlld1NuYXBzaG90U3RhdGVtZW50cygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyBjb25zdCAkc3RhdGUkID0gZ1YoKTtcbiAgICBjb25zdCBnZXRDdXJyZW50Vmlld0luc3RydWN0aW9uID0gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuZ2V0Q3VycmVudFZpZXcsIFtdKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW3RoaXMucmVzdG9yZVZpZXdWYXJpYWJsZS5zZXQoZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbikudG9Db25zdERlY2woKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIGlzTGlzdGVuZXJTY29wZSgpIHsgcmV0dXJuIHRoaXMucGFyZW50ICYmIHRoaXMucGFyZW50LmJpbmRpbmdMZXZlbCA9PT0gdGhpcy5iaW5kaW5nTGV2ZWw7IH1cblxuICB2YXJpYWJsZURlY2xhcmF0aW9ucygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICBsZXQgY3VycmVudENvbnRleHRMZXZlbCA9IDA7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5tYXAudmFsdWVzKCkpXG4gICAgICAgIC5maWx0ZXIodmFsdWUgPT4gdmFsdWUuZGVjbGFyZSlcbiAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIucmV0cmlldmFsTGV2ZWwgLSBhLnJldHJpZXZhbExldmVsIHx8IGIucHJpb3JpdHkgLSBhLnByaW9yaXR5KVxuICAgICAgICAucmVkdWNlKChzdG10czogby5TdGF0ZW1lbnRbXSwgdmFsdWU6IEJpbmRpbmdEYXRhKSA9PiB7XG4gICAgICAgICAgY29uc3QgbGV2ZWxEaWZmID0gdGhpcy5iaW5kaW5nTGV2ZWwgLSB2YWx1ZS5yZXRyaWV2YWxMZXZlbDtcbiAgICAgICAgICBjb25zdCBjdXJyU3RtdHMgPSB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAhKHRoaXMsIGxldmVsRGlmZiAtIGN1cnJlbnRDb250ZXh0TGV2ZWwpO1xuICAgICAgICAgIGN1cnJlbnRDb250ZXh0TGV2ZWwgPSBsZXZlbERpZmY7XG4gICAgICAgICAgcmV0dXJuIHN0bXRzLmNvbmNhdChjdXJyU3RtdHMpO1xuICAgICAgICB9LCBbXSkgYXMgby5TdGF0ZW1lbnRbXTtcbiAgfVxuXG5cbiAgZnJlc2hSZWZlcmVuY2VOYW1lKCk6IHN0cmluZyB7XG4gICAgbGV0IGN1cnJlbnQ6IEJpbmRpbmdTY29wZSA9IHRoaXM7XG4gICAgLy8gRmluZCB0aGUgdG9wIHNjb3BlIGFzIGl0IG1haW50YWlucyB0aGUgZ2xvYmFsIHJlZmVyZW5jZSBjb3VudFxuICAgIHdoaWxlIChjdXJyZW50LnBhcmVudCkgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIGNvbnN0IHJlZiA9IGAke1JFRkVSRU5DRV9QUkVGSVh9JHtjdXJyZW50LnJlZmVyZW5jZU5hbWVJbmRleCsrfWA7XG4gICAgcmV0dXJuIHJlZjtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBgQ3NzU2VsZWN0b3JgIGdpdmVuIGEgdGFnIG5hbWUgYW5kIGEgbWFwIG9mIGF0dHJpYnV0ZXNcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ3NzU2VsZWN0b3IodGFnOiBzdHJpbmcsIGF0dHJpYnV0ZXM6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IENzc1NlbGVjdG9yIHtcbiAgY29uc3QgY3NzU2VsZWN0b3IgPSBuZXcgQ3NzU2VsZWN0b3IoKTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KHRhZyk7XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vLyBQYXJzZSBpMThuIG1ldGFzIGxpa2U6XG4vLyAtIFwiQEBpZFwiLFxuLy8gLSBcImRlc2NyaXB0aW9uW0BAaWRdXCIsXG4vLyAtIFwibWVhbmluZ3xkZXNjcmlwdGlvbltAQGlkXVwiXG5mdW5jdGlvbiBwYXJzZUkxOG5NZXRhKGkxOG4/OiBzdHJpbmcpOiB7ZGVzY3JpcHRpb24/OiBzdHJpbmcsIGlkPzogc3RyaW5nLCBtZWFuaW5nPzogc3RyaW5nfSB7XG4gIGxldCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBpZDogc3RyaW5nfHVuZGVmaW5lZDtcblxuICBpZiAoaTE4bikge1xuICAgIC8vIFRPRE8odmljYik6IGZpZ3VyZSBvdXQgaG93IHRvIGZvcmNlIGEgbWVzc2FnZSBJRCB3aXRoIGNsb3N1cmUgP1xuICAgIGNvbnN0IGlkSW5kZXggPSBpMThuLmluZGV4T2YoSURfU0VQQVJBVE9SKTtcblxuICAgIGNvbnN0IGRlc2NJbmRleCA9IGkxOG4uaW5kZXhPZihNRUFOSU5HX1NFUEFSQVRPUik7XG4gICAgbGV0IG1lYW5pbmdBbmREZXNjOiBzdHJpbmc7XG4gICAgW21lYW5pbmdBbmREZXNjLCBpZF0gPVxuICAgICAgICAoaWRJbmRleCA+IC0xKSA/IFtpMThuLnNsaWNlKDAsIGlkSW5kZXgpLCBpMThuLnNsaWNlKGlkSW5kZXggKyAyKV0gOiBbaTE4biwgJyddO1xuICAgIFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPSAoZGVzY0luZGV4ID4gLTEpID9cbiAgICAgICAgW21lYW5pbmdBbmREZXNjLnNsaWNlKDAsIGRlc2NJbmRleCksIG1lYW5pbmdBbmREZXNjLnNsaWNlKGRlc2NJbmRleCArIDEpXSA6XG4gICAgICAgIFsnJywgbWVhbmluZ0FuZERlc2NdO1xuICB9XG5cbiAgcmV0dXJuIHtkZXNjcmlwdGlvbiwgaWQsIG1lYW5pbmd9O1xufVxuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZShhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIGFyZ3MgPSBhcmdzLnNsaWNlKDEpOyAgLy8gSWdub3JlIHRoZSBsZW5ndGggcHJlZml4IGFkZGVkIGZvciByZW5kZXIyXG4gIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24xKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMikuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjMpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb240KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjUpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNikuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb243KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjgpLmNhbGxGbihhcmdzKTtcbiAgfVxuICAoYXJncy5sZW5ndGggPj0gMTkgJiYgYXJncy5sZW5ndGggJSAyID09IDEpIHx8XG4gICAgICBlcnJvcihgSW52YWxpZCBpbnRlcnBvbGF0aW9uIGFyZ3VtZW50IGxlbmd0aCAke2FyZ3MubGVuZ3RofWApO1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb25WKS5jYWxsRm4oW28ubGl0ZXJhbEFycihhcmdzKV0pO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgdGVtcGxhdGUgaW50byByZW5kZXIzIGBOb2RlYHMgYW5kIGFkZGl0aW9uYWwgbWV0YWRhdGEsIHdpdGggbm8gb3RoZXIgZGVwZW5kZW5jaWVzLlxuICpcbiAqIEBwYXJhbSB0ZW1wbGF0ZSB0ZXh0IG9mIHRoZSB0ZW1wbGF0ZSB0byBwYXJzZVxuICogQHBhcmFtIHRlbXBsYXRlVXJsIFVSTCB0byB1c2UgZm9yIHNvdXJjZSBtYXBwaW5nIG9mIHRoZSBwYXJzZWQgdGVtcGxhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUoXG4gICAgdGVtcGxhdGU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZywgb3B0aW9uczoge3ByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFufSA9IHt9KTpcbiAgICB7ZXJyb3JzPzogUGFyc2VFcnJvcltdLCBub2RlczogdC5Ob2RlW10sIGhhc05nQ29udGVudDogYm9vbGVhbiwgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXX0ge1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgY29uc3QgaHRtbFBhcnNlciA9IG5ldyBIdG1sUGFyc2VyKCk7XG4gIGNvbnN0IHBhcnNlUmVzdWx0ID0gaHRtbFBhcnNlci5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwpO1xuXG4gIGlmIChwYXJzZVJlc3VsdC5lcnJvcnMgJiYgcGFyc2VSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9yczogcGFyc2VSZXN1bHQuZXJyb3JzLCBub2RlczogW10sIGhhc05nQ29udGVudDogZmFsc2UsIG5nQ29udGVudFNlbGVjdG9yczogW119O1xuICB9XG5cbiAgbGV0IHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBwYXJzZVJlc3VsdC5yb290Tm9kZXM7XG4gIGlmICghb3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgcm9vdE5vZGVzKTtcbiAgfVxuXG4gIGNvbnN0IHtub2RlcywgaGFzTmdDb250ZW50LCBuZ0NvbnRlbnRTZWxlY3RvcnMsIGVycm9yc30gPVxuICAgICAgaHRtbEFzdFRvUmVuZGVyM0FzdChyb290Tm9kZXMsIGJpbmRpbmdQYXJzZXIpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtlcnJvcnMsIG5vZGVzOiBbXSwgaGFzTmdDb250ZW50OiBmYWxzZSwgbmdDb250ZW50U2VsZWN0b3JzOiBbXX07XG4gIH1cblxuICByZXR1cm4ge25vZGVzLCBoYXNOZ0NvbnRlbnQsIG5nQ29udGVudFNlbGVjdG9yc307XG59XG5cbi8qKlxuICogQ29uc3RydWN0IGEgYEJpbmRpbmdQYXJzZXJgIHdpdGggYSBkZWZhdWx0IGNvbmZpZ3VyYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlQmluZGluZ1BhcnNlcigpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgbmV3IFBhcnNlcihuZXcgTGV4ZXIoKSksIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKSwgbnVsbCxcbiAgICAgIFtdKTtcbn1cblxuZnVuY3Rpb24gaXNDbGFzc0JpbmRpbmcoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIGlucHV0Lm5hbWUgPT0gJ2NsYXNzTmFtZScgfHwgaW5wdXQubmFtZSA9PSAnY2xhc3MnO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUsIGNvbnRleHQ6IGNvcmUuU2VjdXJpdHlDb250ZXh0KSB7XG4gIHN3aXRjaCAoY29udGV4dCkge1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuSFRNTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVIdG1sKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNDUklQVDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTY3JpcHQpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU1RZTEU6XG4gICAgICAvLyB0aGUgY29tcGlsZXIgZG9lcyBub3QgZmlsbCBpbiBhbiBpbnN0cnVjdGlvbiBmb3IgW3N0eWxlLnByb3A/XSBiaW5kaW5nXG4gICAgICAvLyB2YWx1ZXMgYmVjYXVzZSB0aGUgc3R5bGUgYWxnb3JpdGhtIGtub3dzIGludGVybmFsbHkgd2hhdCBwcm9wcyBhcmUgc3ViamVjdFxuICAgICAgLy8gdG8gc2FuaXRpemF0aW9uIChvbmx5IFthdHRyLnN0eWxlXSB2YWx1ZXMgYXJlIGV4cGxpY2l0bHkgc2FuaXRpemVkKVxuICAgICAgcmV0dXJuIGlucHV0LnR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZSA/IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVN0eWxlKSA6IG51bGw7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVSZXNvdXJjZVVybCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgc3dpdGNoIChwcm9wKSB7XG4gICAgY2FzZSAnYmFja2dyb3VuZC1pbWFnZSc6XG4gICAgY2FzZSAnYmFja2dyb3VuZCc6XG4gICAgY2FzZSAnYm9yZGVyLWltYWdlJzpcbiAgICBjYXNlICdmaWx0ZXInOlxuICAgIGNhc2UgJ2xpc3Qtc3R5bGUnOlxuICAgIGNhc2UgJ2xpc3Qtc3R5bGUtaW1hZ2UnOlxuICAgICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl19