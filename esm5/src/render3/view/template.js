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
import { CONTEXT_NAME, I18N_ATTR, I18N_ATTR_PREFIX, ID_SEPARATOR, IMPLICIT_REFERENCE, MEANING_SEPARATOR, REFERENCE_PREFIX, RENDER_FLAGS, asLiteral, invalid, isI18NAttribute, mapToExpression, trimTrailingNulls, unsupported } from './util';
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
        this._valueConverter = new ValueConverter(constantPool, function () { return _this.allocateDataSlot(); }, function (numSlots) { return _this.allocatePureFunctionSlots(numSlots); }, function (name, localName, slot, value) {
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
        // resolving bindings. We also count bindings in this pass as we walk bound expressions.
        t.visitAll(this, nodes);
        // Add total binding count to pure function count so pure function instructions are
        // generated with the correct slot offset when update instructions are processed.
        this._pureFunctionSlots += this._bindingSlots;
        // Pipes are walked in the first pass (to enqueue `pipe()` creation instructions and
        // `pipeBind` update instructions), so we have to update the slot offsets manually
        // to account for bindings.
        this._valueConverter.updatePipeSlotOffsets(this._bindingSlots);
        // Nested templates must be processed before creation instructions so template()
        // instructions can be generated with the correct internal const count.
        this._nestedTemplateFns.forEach(function (buildTemplateFn) { return buildTemplateFn(); });
        // Generate all the creation mode instructions (e.g. resolve bindings in listeners)
        var creationStatements = this._creationCodeFns.map(function (fn) { return fn(); });
        // Generate all the update mode instructions (e.g. resolve property or text bindings)
        var updateStatements = this._updateCodeFns.map(function (fn) { return fn(); });
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
        this.matchDirectives(element.name, element);
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
        // add attributes for directive matching purposes
        attributes.push.apply(attributes, tslib_1.__spread(this.prepareSelectOnlyAttrs(allOtherInputs, element.outputs)));
        parameters.push(this.toAttrsParam(attributes));
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
                _this.allocateBindingSlots(value_2);
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
        // find directives matching on a given <ng-template> node
        this.matchDirectives('ng-template', template);
        // prepare attributes parameter (including attributes used for directive matching)
        var attrsExprs = [];
        template.attributes.forEach(function (a) { attrsExprs.push(asLiteral(a.name), asLiteral(a.value)); });
        attrsExprs.push.apply(attrsExprs, tslib_1.__spread(this.prepareSelectOnlyAttrs(template.inputs, template.outputs)));
        parameters.push(this.toAttrsParam(attrsExprs));
        // local refs (ex.: <ng-template #foo>)
        if (template.references && template.references.length) {
            parameters.push(this.prepareRefsParameter(template.references));
            parameters.push(o.importExpr(R3.templateRefExtractor));
        }
        // handle property bindings e.g. p(1, 'forOf', ɵbind(ctx.items));
        var context = o.variable(CONTEXT_NAME);
        template.inputs.forEach(function (input) {
            var value = input.value.visit(_this._valueConverter);
            _this.allocateBindingSlots(value);
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
        this.allocateBindingSlots(value);
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
    TemplateDefinitionBuilder.prototype.getVarCount = function () { return this._pureFunctionSlots; };
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
    TemplateDefinitionBuilder.prototype.allocatePureFunctionSlots = function (numSlots) {
        var originalSlots = this._pureFunctionSlots;
        this._pureFunctionSlots += numSlots;
        return originalSlots;
    };
    TemplateDefinitionBuilder.prototype.allocateBindingSlots = function (value) {
        this._bindingSlots += value instanceof Interpolation ? value.expressions.length : 1;
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
    TemplateDefinitionBuilder.prototype.matchDirectives = function (tagName, elOrTpl) {
        var _this = this;
        if (this.directiveMatcher) {
            var selector = createCssSelector(tagName, this.getAttrsForDirectiveMatching(elOrTpl));
            this.directiveMatcher.match(selector, function (cssSelector, staticType) { _this.directives.add(staticType); });
        }
    };
    TemplateDefinitionBuilder.prototype.getAttrsForDirectiveMatching = function (elOrTpl) {
        var attributesMap = {};
        elOrTpl.attributes.forEach(function (a) {
            if (!isI18NAttribute(a.name)) {
                attributesMap[a.name] = a.value;
            }
        });
        elOrTpl.inputs.forEach(function (i) { attributesMap[i.name] = ''; });
        elOrTpl.outputs.forEach(function (o) { attributesMap[o.name] = ''; });
        return attributesMap;
    };
    TemplateDefinitionBuilder.prototype.prepareSelectOnlyAttrs = function (inputs, outputs) {
        var attrExprs = [];
        if (inputs.length || outputs.length) {
            attrExprs.push(o.literal(1 /* SelectOnly */));
            inputs.forEach(function (i) { attrExprs.push(asLiteral(i.name)); });
            outputs.forEach(function (o) { attrExprs.push(asLiteral(o.name)); });
        }
        return attrExprs;
    };
    TemplateDefinitionBuilder.prototype.toAttrsParam = function (attrsExprs) {
        return attrsExprs.length > 0 ?
            this.constantPool.getConstLiteral(o.literalArr(attrsExprs), true) :
            o.TYPED_NULL_EXPR;
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
        _this._pipeBindExprs = [];
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
        var pipeBindExpr = new FunctionCall(pipe.span, target, tslib_1.__spread([
            new LiteralPrimitive(pipe.span, slot),
            new LiteralPrimitive(pipe.span, pureFunctionSlot)
        ], convertedArgs));
        this._pipeBindExprs.push(pipeBindExpr);
        return pipeBindExpr;
    };
    ValueConverter.prototype.updatePipeSlotOffsets = function (bindingSlots) {
        this._pipeBindExprs.forEach(function (pipe) {
            // update the slot offset arg (index 1) to account for binding slots
            var slotOffset = pipe.args[1];
            slotOffset.value += bindingSlots;
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbkUsT0FBTyxFQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBaUIsb0JBQW9CLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUV2SixPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQTRCLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFjLGdCQUFnQixFQUFFLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ2xOLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDdEQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDbEYsT0FBTyxFQUFDLGFBQWEsSUFBSSxrQkFBa0IsRUFBRSxXQUFXLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUN0RixPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBQ2xGLE9BQU8sRUFBQyxXQUFXLEVBQWtCLE1BQU0sZ0JBQWdCLENBQUM7QUFDNUQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQ25FLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDakMsT0FBTyxLQUFLLENBQUMsTUFBTSxXQUFXLENBQUM7QUFDL0IsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNwRCxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUc3RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLFlBQVksRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUU1TyxpQ0FBaUMsSUFBaUI7SUFDaEQsUUFBUSxJQUFJLEVBQUU7UUFDWjtZQUNFLE9BQU8sRUFBRSxDQUFDLGVBQWUsQ0FBQztRQUM1QjtZQUNFLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDO1FBQzdCO1lBQ0UsT0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUM7UUFDN0I7WUFDRSxPQUFPLFNBQVMsQ0FBQztLQUNwQjtBQUNILENBQUM7QUFFRCwwQkFBMEI7QUFDMUIsTUFBTSxnQ0FDRixLQUF1QixFQUFFLFVBQXlCO0lBQ3BELE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUNsRyxDQUFDO0FBRUQ7SUE2Q0UsbUNBQ1ksWUFBMEIsRUFBRSxrQkFBZ0MsRUFBVSxLQUFTLEVBQy9FLFdBQXdCLEVBQVUsWUFBeUIsRUFDM0QsV0FBOEIsRUFBVSxnQkFBc0MsRUFDOUUsVUFBNkIsRUFBVSxjQUF5QyxFQUNoRixLQUF3QixFQUFVLFVBQStCO1FBSkssc0JBQUEsRUFBQSxTQUFTO1FBRDNGLGlCQXVCQztRQXRCVyxpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUE0QyxVQUFLLEdBQUwsS0FBSyxDQUFJO1FBQy9FLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQVUsaUJBQVksR0FBWixZQUFZLENBQWE7UUFDM0QsZ0JBQVcsR0FBWCxXQUFXLENBQW1CO1FBQVUscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFzQjtRQUM5RSxlQUFVLEdBQVYsVUFBVSxDQUFtQjtRQUFVLG1CQUFjLEdBQWQsY0FBYyxDQUEyQjtRQUNoRixVQUFLLEdBQUwsS0FBSyxDQUFtQjtRQUFVLGVBQVUsR0FBVixVQUFVLENBQXFCO1FBakRyRSxlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ2Ysb0JBQWUsR0FBRyxDQUFDLENBQUM7UUFDcEIsZ0JBQVcsR0FBa0IsRUFBRSxDQUFDO1FBQ3hDOzs7O1dBSUc7UUFDSyxxQkFBZ0IsR0FBMEIsRUFBRSxDQUFDO1FBQ3JEOzs7O1dBSUc7UUFDSyxtQkFBYyxHQUEwQixFQUFFLENBQUM7UUFDbkQsb0ZBQW9GO1FBQzVFLG1CQUFjLEdBQWtCLEVBQUUsQ0FBQztRQUMzQzs7Ozs7V0FLRztRQUNLLHVCQUFrQixHQUFtQixFQUFFLENBQUM7UUFPeEMsaUJBQVksR0FBRyxXQUFXLENBQUM7UUFFbkMsc0ZBQXNGO1FBQzlFLG1CQUFjLEdBQVksS0FBSyxDQUFDO1FBQ2hDLHNCQUFpQixHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQy9CLG1FQUFtRTtRQUMzRCxtQkFBYyxHQUFtQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRTlELCtDQUErQztRQUN2Qyx1QkFBa0IsR0FBRyxDQUFDLENBQUM7UUFFL0IsMEJBQTBCO1FBQ2xCLGtCQUFhLEdBQUcsQ0FBQyxDQUFDO1FBb29CMUIsK0RBQStEO1FBQ3RELG1CQUFjLEdBQUcsT0FBTyxDQUFDO1FBQ3pCLGtCQUFhLEdBQUcsT0FBTyxDQUFDO1FBQ3hCLHVCQUFrQixHQUFHLE9BQU8sQ0FBQztRQUM3Qix3QkFBbUIsR0FBRyxPQUFPLENBQUM7UUFDOUIsb0JBQWUsR0FBRyxPQUFPLENBQUM7UUFqb0JqQyw0RkFBNEY7UUFDNUYsWUFBWTtRQUNaLElBQUksQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztRQUVyQyxJQUFJLENBQUMsYUFBYSxHQUFHLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUzRCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksY0FBYyxDQUNyQyxZQUFZLEVBQUUsY0FBTSxPQUFBLEtBQUksQ0FBQyxnQkFBZ0IsRUFBRSxFQUF2QixDQUF1QixFQUMzQyxVQUFDLFFBQWdCLElBQUssT0FBQSxLQUFJLENBQUMseUJBQXlCLENBQUMsUUFBUSxDQUFDLEVBQXhDLENBQXdDLEVBQzlELFVBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsS0FBb0I7WUFDMUMsSUFBTSxRQUFRLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxQyxJQUFJLFFBQVEsRUFBRTtnQkFDWixLQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUMxQjtZQUNELEtBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEtBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3JELEtBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUUsQ0FBQyxDQUFDLENBQUM7SUFDVCxDQUFDO0lBRUQsNERBQXdCLEdBQXhCLFVBQXlCLFFBQW9CO1FBQzNDLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMzRCxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ2xDLElBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FDbEIsY0FBYyxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxtQkFDbEMsVUFBQyxLQUFtQixFQUFFLGFBQXFCO1lBQ3pDLElBQUksR0FBaUIsQ0FBQztZQUN0QixJQUFJLEtBQUssQ0FBQyxZQUFZLEtBQUssY0FBYyxFQUFFO2dCQUN6QyxXQUFXO2dCQUNYLEdBQUcsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQ2hDO2lCQUFNO2dCQUNMLElBQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztnQkFDaEUsMEJBQTBCO2dCQUMxQixHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO2FBQzVFO1lBQ0Qsc0NBQXNDO1lBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssSUFBSSxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNqRixDQUFDLENBQUMsQ0FBQztJQUNULENBQUM7SUFFRCx5REFBcUIsR0FBckIsVUFDSSxLQUFlLEVBQUUsU0FBdUIsRUFBRSxZQUE2QixFQUN2RSxrQkFBaUM7UUFGckMsaUJBd0ZDO1FBdkY2Qyw2QkFBQSxFQUFBLG9CQUE2QjtRQUN2RSxtQ0FBQSxFQUFBLHVCQUFpQzs7UUFDbkMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLEVBQUUsQ0FBQyxhQUFhLEVBQUU7WUFDeEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDakQ7UUFFRCwyQkFBMkI7UUFDM0IsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLEtBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsRUFBaEMsQ0FBZ0MsQ0FBQyxDQUFDO1FBRXpELDRFQUE0RTtRQUM1RSxJQUFJLFlBQVksRUFBRTtZQUNoQixJQUFNLFVBQVUsR0FBbUIsRUFBRSxDQUFDO1lBRXRDLHdEQUF3RDtZQUN4RCxJQUFJLGtCQUFrQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ2pDLElBQU0sV0FBVyxHQUFHLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsRUFBakMsQ0FBaUMsQ0FBQyxDQUFDO2dCQUNuRix1RUFBdUU7Z0JBQ3ZFLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDL0UsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3hGLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQ25DO1lBRUQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQzlEO1FBRUQsZ0ZBQWdGO1FBQ2hGLG9GQUFvRjtRQUNwRixzRkFBc0Y7UUFDdEYsd0ZBQXdGO1FBQ3hGLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG1GQUFtRjtRQUNuRixpRkFBaUY7UUFDakYsSUFBSSxDQUFDLGtCQUFrQixJQUFJLElBQUksQ0FBQyxhQUFhLENBQUM7UUFFOUMsb0ZBQW9GO1FBQ3BGLGtGQUFrRjtRQUNsRiwyQkFBMkI7UUFDM0IsSUFBSSxDQUFDLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFL0QsZ0ZBQWdGO1FBQ2hGLHVFQUF1RTtRQUN2RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLFVBQUEsZUFBZSxJQUFJLE9BQUEsZUFBZSxFQUFFLEVBQWpCLENBQWlCLENBQUMsQ0FBQztRQUV0RSxtRkFBbUY7UUFDbkYsSUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFVBQUMsRUFBcUIsSUFBSyxPQUFBLEVBQUUsRUFBRSxFQUFKLENBQUksQ0FBQyxDQUFDO1FBRXRGLHFGQUFxRjtRQUNyRixJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFVBQUMsRUFBcUIsSUFBSyxPQUFBLEVBQUUsRUFBRSxFQUFKLENBQUksQ0FBQyxDQUFDO1FBRWxGLHVGQUF1RjtRQUN2Rix5RkFBeUY7UUFDekYsSUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFDdEUsSUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFOUYsSUFBTSxhQUFhLEdBQUcsa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ2pELENBQUMscUJBQXFCLGlCQUNPLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdFLEVBQUUsQ0FBQztRQUVQLElBQU0sV0FBVyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUM3QyxDQUFDLHFCQUFxQixpQkFBMEIsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVGLEVBQUUsQ0FBQzs7WUFFUCxvREFBb0Q7WUFDcEQscURBQXFEO1lBQ3JELEtBQTBCLElBQUEsS0FBQSxpQkFBQSxJQUFJLENBQUMsY0FBYyxDQUFBLGdCQUFBLDRCQUFFO2dCQUExQyxJQUFNLFdBQVcsV0FBQTtnQkFDcEIsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQ3ZDLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDM0QsSUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUUzRixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDOUI7YUFDRjs7Ozs7Ozs7O1FBRUQsT0FBTyxDQUFDLENBQUMsRUFBRTtRQUNQLG1DQUFtQztRQUNuQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsbUJBRzFFLElBQUksQ0FBQyxXQUFXLEVBRWhCLGFBQWEsRUFFYixXQUFXLEdBRWhCLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQsZ0JBQWdCO0lBQ2hCLDRDQUFRLEdBQVIsVUFBUyxJQUFZLElBQXVCLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRWxGLGdEQUFZLEdBQVosVUFBYSxTQUFvQjtRQUMvQixJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUNyQyxJQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDO1FBQzlDLElBQU0sVUFBVSxHQUFtQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVyRCxJQUFNLGVBQWUsR0FBYSxFQUFFLENBQUM7UUFFckMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQyxTQUFTO1lBQ3JDLElBQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFDNUIsSUFBSSxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUNyQixlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDN0M7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDOUIsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO1NBQ3ZFO2FBQU0sSUFBSSxhQUFhLEtBQUssQ0FBQyxFQUFFO1lBQzlCLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1NBQzNDO1FBRUQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBR0QsMkRBQXVCLEdBQXZCLFVBQXdCLFlBQXlCO1FBQy9DLFFBQVEsWUFBWSxFQUFFO1lBQ3BCLEtBQUssTUFBTTtnQkFDVCxPQUFPLEVBQUUsQ0FBQyxlQUFlLENBQUM7WUFDNUIsS0FBSyxLQUFLO2dCQUNSLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQztZQUN6QjtnQkFDRSxPQUFPLEVBQUUsQ0FBQyxhQUFhLENBQUM7U0FDM0I7SUFDSCxDQUFDO0lBRUQsMkRBQXVCLEdBQXZCLFVBQXdCLGFBQWtDLEVBQUUsT0FBa0I7UUFDNUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxhQUFhLENBQUM7UUFDaEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVELGdEQUFZLEdBQVosVUFBYSxPQUFrQjtRQUEvQixpQkFvWUM7O1FBbllDLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQzdDLElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUU3QyxJQUFNLFdBQVcsR0FBNkIsRUFBRSxDQUFDO1FBQ2pELElBQU0sYUFBYSxHQUE2QixFQUFFLENBQUM7UUFDbkQsSUFBSSxRQUFRLEdBQVcsRUFBRSxDQUFDO1FBRXBCLElBQUEsaURBQXVELEVBQXRELG9CQUFZLEVBQUUsbUJBQVcsQ0FBOEI7UUFDOUQsSUFBTSxhQUFhLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZELCtEQUErRDtRQUMvRCxzREFBc0Q7UUFDdEQsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQ3ZCLElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDMUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3hELElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO2FBQzFEO1lBQ0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDeEU7O1lBRUQseUJBQXlCO1lBQ3pCLEtBQW1CLElBQUEsS0FBQSxpQkFBQSxPQUFPLENBQUMsVUFBVSxDQUFBLGdCQUFBLDRCQUFFO2dCQUFsQyxJQUFNLElBQUksV0FBQTtnQkFDYixJQUFNLE1BQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUN2QixJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUN6QixJQUFJLE1BQUksS0FBSyxTQUFTLEVBQUU7b0JBQ3RCLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRTt3QkFDdkIsTUFBTSxJQUFJLEtBQUssQ0FDWCw0RUFBNEUsQ0FBQyxDQUFDO3FCQUNuRjtvQkFDRCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztvQkFDM0IsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7b0JBQ3pCLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxDQUFDO29CQUNqRCxRQUFRLEdBQUcsS0FBSyxDQUFDO2lCQUNsQjtxQkFBTSxJQUFJLE1BQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtvQkFDNUMsYUFBYSxDQUFDLE1BQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7aUJBQzVEO3FCQUFNO29CQUNMLFdBQVcsQ0FBQyxNQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7aUJBQzNCO2FBQ0Y7Ozs7Ozs7OztRQUVELDBDQUEwQztRQUMxQyxJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFNUMsZ0RBQWdEO1FBQ2hELElBQU0sVUFBVSxHQUFtQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQ2xCLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1NBQ3pDO1FBRUQscUJBQXFCO1FBQ3JCLElBQU0sVUFBVSxHQUFtQixFQUFFLENBQUM7UUFDdEMsSUFBTSx3QkFBd0IsR0FBbUIsRUFBRSxDQUFDO1FBQ3BELElBQU0sd0JBQXdCLEdBQW1CLEVBQUUsQ0FBQztRQUVwRCxJQUFNLFdBQVcsR0FBdUIsRUFBRSxDQUFDO1FBQzNDLElBQU0sV0FBVyxHQUF1QixFQUFFLENBQUM7UUFDM0MsSUFBTSxjQUFjLEdBQXVCLEVBQUUsQ0FBQztRQUU5QyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFDLEtBQXVCO1lBQzdDLFFBQVEsS0FBSyxDQUFDLElBQUksRUFBRTtnQkFDbEIsc0VBQXNFO2dCQUN0RSxzRUFBc0U7Z0JBQ3RFLHFFQUFxRTtnQkFDckUsMkRBQTJEO2dCQUMzRCwwQ0FBMEM7Z0JBQzFDO29CQUNFLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxPQUFPLEVBQUU7d0JBQ3pCLCtEQUErRDt3QkFDL0QsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO3FCQUNqQzt5QkFBTSxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRTt3QkFDaEMsK0RBQStEO3dCQUMvRCxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7cUJBQ2pDO3lCQUFNO3dCQUNMLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7cUJBQzVCO29CQUNELE1BQU07Z0JBQ1I7b0JBQ0UsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDeEIsTUFBTTtnQkFDUjtvQkFDRSxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN4QixNQUFNO2dCQUNSO29CQUNFLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzNCLE1BQU07YUFDVDtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQztRQUN2QixJQUFJLGVBQWUsR0FBOEIsSUFBSSxDQUFDO1FBQ3RELElBQUksZ0JBQWdCLEdBQWtDLElBQUksQ0FBQztRQUMzRCxJQUFNLGNBQWMsR0FBNEIsRUFBRSxDQUFDO1FBQ25ELElBQU0sZUFBZSxHQUE0QixFQUFFLENBQUM7UUFDcEQsTUFBTSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUk7WUFDbEQsSUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hDLElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtnQkFDbkIsZUFBZSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDcEMsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJLElBQU0sY0FBYyxDQUFDLElBQUksQ0FBQyxHQUFHLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDNUY7aUJBQU0sSUFBSSxJQUFJLElBQUksT0FBTyxFQUFFO2dCQUMxQixnQkFBZ0IsR0FBRyxFQUFFLENBQUM7Z0JBQ3RCLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsU0FBUztvQkFDbkMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxHQUFHLGNBQWMsRUFBRSxDQUFDO29CQUM5QyxnQkFBa0IsQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBQ3ZDLENBQUMsQ0FBQyxDQUFDO2FBQ0o7aUJBQU07Z0JBQ0wsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLElBQUksYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDdEMsSUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNoRCxJQUFNLFFBQVEsR0FBRyxLQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQy9ELFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7aUJBQzNCO3FCQUFNO29CQUNMLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2lCQUNuQzthQUNGO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLGtCQUFrQixHQUFHLEtBQUssQ0FBQztRQUMvQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUMzQyxJQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0IsSUFBTSxzQkFBc0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssT0FBTyxDQUFDO1lBQ2pFLElBQUksc0JBQXNCLEVBQUU7Z0JBQzFCLGtCQUFrQixHQUFHLElBQUksQ0FBQzthQUMzQjtpQkFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3JELGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUM7YUFDL0M7U0FDRjtRQUVELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzNDLElBQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QixJQUFNLHNCQUFzQixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hFLElBQUksQ0FBQyxzQkFBc0IsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN6RSxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLGNBQWMsRUFBRSxDQUFDO2FBQ2hEO1NBQ0Y7UUFFRCxxRUFBcUU7UUFDckUsc0VBQXNFO1FBQ3RFLHdFQUF3RTtRQUN4RSx3Q0FBd0M7UUFDeEMsSUFBSSx3QkFBd0IsR0FBRyxrQkFBa0IsQ0FBQztRQUVsRCwrRUFBK0U7UUFDL0UsNERBQTREO1FBQzVELE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsSUFBSTtZQUN0Qyx3QkFBd0IsR0FBRyx3QkFBd0IsSUFBSSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRix3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2pELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxlQUFlLEVBQUU7WUFDbkIsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLHFCQUFzQyxDQUFDLENBQUM7WUFFL0UsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO2dCQUN2Qyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMvQyxJQUFNLEtBQUssR0FBRyxlQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN0Qyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ2xELENBQUMsQ0FBQyxDQUFDO1NBQ0o7UUFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUk7WUFDdkMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNqRCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksZ0JBQWdCLEVBQUU7WUFDcEIsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLHFCQUFzQyxDQUFDLENBQUM7WUFFL0UsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLFNBQVM7Z0JBQzdDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BELHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDakQsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELElBQU0sc0JBQXNCLEdBQUcsd0JBQXdCLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNO1lBQ2hGLHdCQUF3QixDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDO1FBRTFELGlEQUFpRDtRQUNqRCxVQUFVLENBQUMsSUFBSSxPQUFmLFVBQVUsbUJBQVMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUU7UUFDakYsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFFL0MsMENBQTBDO1FBQzFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBRS9ELElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDdkMsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFcEUsd0VBQXdFO1FBQ3hFLDJCQUEyQjtRQUMzQixJQUFJLGdCQUFnQixLQUFLLGNBQWMsRUFBRTtZQUN2QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDekQ7UUFFRCxJQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTFDLElBQU0sNEJBQTRCLEdBQUcsQ0FBQyxzQkFBc0IsSUFBSSxDQUFDLGFBQWE7WUFDMUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztRQUVsRSxJQUFJLDRCQUE0QixFQUFFO1lBQ2hDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztTQUN6RjthQUFNO1lBQ0wsSUFBSSxDQUFDLG1CQUFtQixDQUNwQixPQUFPLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUM5RSxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBRW5DLG9EQUFvRDtZQUNwRCxJQUFJLHNCQUFzQixFQUFFO2dCQUMxQixJQUFNLFVBQVUsR0FBcUIsRUFBRSxDQUFDO2dCQUV4QyxJQUFJLHdCQUF3QixDQUFDLE1BQU0sRUFBRTtvQkFDbkMsZ0ZBQWdGO29CQUNoRix1RUFBdUU7b0JBQ3ZFLDJFQUEyRTtvQkFDM0UsbUZBQW1GO29CQUNuRixVQUFVLENBQUMsSUFBSSxDQUNYLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsd0JBQXdCLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUN0RjtxQkFBTSxJQUFJLHdCQUF3QixDQUFDLE1BQU0sSUFBSSx3QkFBd0IsRUFBRTtvQkFDdEUsNkVBQTZFO29CQUM3RSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztpQkFDOUI7Z0JBRUQsSUFBSSx3QkFBd0IsQ0FBQyxNQUFNLEVBQUU7b0JBQ25DLHdFQUF3RTtvQkFDeEUsd0VBQXdFO29CQUN4RSw0RUFBNEU7b0JBQzVFLG1GQUFtRjtvQkFDbkYsVUFBVSxDQUFDLElBQUksQ0FDWCxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLHdCQUF3QixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztpQkFDdEY7cUJBQU0sSUFBSSx3QkFBd0IsRUFBRTtvQkFDbkMsNkVBQTZFO29CQUM3RSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztpQkFDOUI7Z0JBRUQsSUFBSSx3QkFBd0IsRUFBRTtvQkFDNUIsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7aUJBQ3pEO2dCQUVELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxVQUFVLENBQUMsQ0FBQzthQUMvRDtZQUVELCtCQUErQjtZQUMvQixPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFDLFNBQXVCO2dCQUM5QyxJQUFNLE1BQU0sR0FBRyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2hELElBQU0sTUFBTSxHQUFHLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEQsSUFBTSxZQUFZLEdBQU0sS0FBSSxDQUFDLFlBQVksU0FBSSxNQUFNLFNBQUksTUFBTSxjQUFXLENBQUM7Z0JBRXpFLEtBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEVBQUU7b0JBQzFELElBQU0sYUFBYSxHQUFHLEtBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLEtBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7b0JBRXRGLElBQU0sV0FBVyxHQUFHLG9CQUFvQixDQUNwQyxhQUFhLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUMvQyxjQUFNLE9BQUEsS0FBSyxDQUFDLDBCQUEwQixDQUFDLEVBQWpDLENBQWlDLENBQUMsQ0FBQztvQkFFN0MsSUFBTSxVQUFVLG9CQUNYLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRSxFQUFLLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRSxFQUM3RSxXQUFXLENBQUMsWUFBWSxDQUM1QixDQUFDO29CQUVGLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQ2hCLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQzVFLFlBQVksQ0FBQyxDQUFDO29CQUVsQixPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQzlDLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxzQkFBc0IsRUFBRTtZQUN4RSxJQUFNLGNBQVksR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRTdDLElBQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsQyxJQUFNLGtCQUFrQixHQUFHLFVBQVUsSUFBSSxVQUFVLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFFeEYsSUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLElBQU0sa0JBQWtCLEdBQUcsVUFBVSxJQUFJLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFFeEYsSUFBTSxZQUFZLEdBQUcsa0JBQWtCLElBQUksa0JBQWtCLENBQUM7WUFDOUQsSUFBSSxZQUFZLEVBQUU7Z0JBQ2hCLElBQU0sUUFBTSxHQUFtQixFQUFFLENBQUM7Z0JBQ2xDLElBQUksT0FBVSxDQUFDO2dCQUNmLElBQUksa0JBQWtCLEVBQUU7b0JBQ3RCLE9BQUssR0FBRyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztpQkFDOUQ7cUJBQU0sSUFBSSxrQkFBa0IsRUFBRTtvQkFDN0IsUUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7aUJBQzFCO2dCQUVELElBQUksa0JBQWtCLEVBQUU7b0JBQ3RCLE9BQUssR0FBRyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztpQkFDOUQ7Z0JBRUQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixFQUFFO29CQUNwRSxRQUFNLENBQUMsSUFBSSxDQUFDLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsT0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2hFLHlCQUFRLGNBQVksR0FBSyxRQUFNLEVBQUU7Z0JBQ25DLENBQUMsQ0FBQyxDQUFDO2FBQ0o7WUFFRCxJQUFJLGdCQUFnQixHQUEwQixJQUFJLENBQUM7WUFDbkQsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO2dCQUN0QixJQUFJLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O29CQUVqQyxJQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzdCLElBQU0sTUFBTSxHQUFVLEVBQUUsQ0FBQztvQkFDekIsSUFBTSxlQUFlLEdBQUcscUJBQXFCLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDNUUsSUFBSSxlQUFlO3dCQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBRWxELElBQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7b0JBQ3ZCLElBQU0sVUFBVSxHQUFXLGNBQWMsQ0FBQyxHQUFHLENBQUcsQ0FBQztvQkFDakQsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBSyxlQUFlLENBQUMsQ0FBQztvQkFDdEQsT0FBSyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRTt3QkFDNUQ7NEJBQ0UsY0FBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDOzRCQUNuQyxLQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUM7MkJBQUssTUFBTSxFQUM3RDtvQkFDSixDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDOztnQkFmRCxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7O2lCQWVsQztnQkFFRCxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQzthQUN4RDtZQUVELElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRTtnQkFDdEIsSUFBSSxDQUFDLEdBQUcsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztvQkFFakMsSUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUM3QixJQUFNLE1BQU0sR0FBVSxFQUFFLENBQUM7b0JBQ3pCLElBQU0sZUFBZSxHQUFHLHFCQUFxQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQzVFLElBQUksZUFBZTt3QkFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO29CQUVsRCxJQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO29CQUN2QixJQUFNLFVBQVUsR0FBVyxlQUFlLENBQUMsR0FBRyxDQUFHLENBQUM7b0JBQ2xELElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQUssZUFBZSxDQUFDLENBQUM7b0JBQ3RELE9BQUssaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLEVBQUU7d0JBQzVEOzRCQUNFLGNBQVksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQzs0QkFDbkMsS0FBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDOzJCQUFLLE1BQU0sRUFDN0Q7b0JBQ0osQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQzs7Z0JBZkQsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFOztpQkFlbEM7Z0JBRUQsZ0JBQWdCLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7YUFDeEQ7WUFFRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsZ0JBQWtCLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLGNBQVksQ0FBQyxDQUFDLENBQUM7U0FDL0Y7UUFFRCxrQ0FBa0M7UUFDbEMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxVQUFDLEtBQXVCO1lBQzdDLElBQUksS0FBSyxDQUFDLElBQUksc0JBQTBCLEVBQUU7Z0JBQ3hDLE9BQU8sQ0FBQyxLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQztnQkFDL0QsT0FBTzthQUNSO1lBRUQsSUFBTSxXQUFXLEdBQUcsdUJBQXVCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3hELElBQUksV0FBVyxFQUFFO2dCQUNmLElBQU0sUUFBTSxHQUFVLEVBQUUsQ0FBQztnQkFDekIsSUFBTSxlQUFlLEdBQUcscUJBQXFCLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDNUUsSUFBSSxlQUFlO29CQUFFLFFBQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBRWxELDJDQUEyQztnQkFDM0MsSUFBTSxPQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUN0RCxLQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBSyxDQUFDLENBQUM7Z0JBQ2pDLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLFdBQVcsRUFBRTtvQkFDcEQ7d0JBQ0UsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7d0JBQzlDLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsT0FBSyxDQUFDO3VCQUFLLFFBQU0sRUFDdkQ7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7YUFDSjtpQkFBTTtnQkFDTCxLQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFnQixLQUFLLENBQUMsSUFBTSxDQUFDLENBQUM7YUFDakQ7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILCtCQUErQjtRQUMvQixJQUFJLElBQUksQ0FBQyxjQUFjLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLElBQUksQ0FBQztZQUNuRCxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLEVBQUU7WUFDekMsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQVcsQ0FBQztZQUMzQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQy9DO2FBQU07WUFDTCxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDcEM7UUFFRCxJQUFJLENBQUMsNEJBQTRCLEVBQUU7WUFDakMsb0NBQW9DO1lBQ3BDLElBQUksQ0FBQyxtQkFBbUIsQ0FDcEIsT0FBTyxDQUFDLGFBQWEsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUMzQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQzdEO1FBRUQsNkNBQTZDO1FBQzdDLElBQUksQ0FBQyxjQUFjLEdBQUcsZ0JBQWdCLENBQUM7SUFDekMsQ0FBQztJQUVELGlEQUFhLEdBQWIsVUFBYyxRQUFvQjtRQUFsQyxpQkF1RUM7UUF0RUMsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFOUMsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2hCLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sRUFBRTtZQUMvRSw0RUFBNEU7WUFDNUUsTUFBTSxHQUFHLGtCQUFrQixDQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdkU7UUFFRCxJQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFJLElBQUksQ0FBQyxXQUFXLFNBQUksTUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFFbEUsSUFBTSxZQUFZLEdBQ2QsV0FBVyxDQUFDLENBQUMsQ0FBSSxXQUFXLGtCQUFhLGFBQWUsQ0FBQyxDQUFDLENBQUMsY0FBWSxhQUFlLENBQUM7UUFFM0YsSUFBTSxVQUFVLEdBQW1CO1lBQ2pDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO1lBQ3hCLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO1lBQ3hCLENBQUMsQ0FBQyxlQUFlO1NBQ2xCLENBQUM7UUFFRix5REFBeUQ7UUFDekQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFOUMsa0ZBQWtGO1FBQ2xGLElBQU0sVUFBVSxHQUFtQixFQUFFLENBQUM7UUFDdEMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQ3ZCLFVBQUMsQ0FBa0IsSUFBTyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekYsVUFBVSxDQUFDLElBQUksT0FBZixVQUFVLG1CQUFTLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRTtRQUNuRixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUUvQyx1Q0FBdUM7UUFDdkMsSUFBSSxRQUFRLENBQUMsVUFBVSxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFO1lBQ3JELFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ2hFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1NBQ3hEO1FBRUQsaUVBQWlFO1FBQ2pFLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDekMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBQSxLQUFLO1lBQzNCLElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUN0RCxLQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDakMsS0FBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLGVBQWUsRUFBRTtnQkFDOUQsT0FBTztvQkFDTCxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztvQkFDL0MsS0FBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUM7aUJBQzVDLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQU0sZUFBZSxHQUFHLElBQUkseUJBQXlCLENBQ2pELElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFDcEYsSUFBSSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU5Rix5RkFBeUY7UUFDekYsMkZBQTJGO1FBQzNGLHFGQUFxRjtRQUNyRixxRkFBcUY7UUFDckYsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQztZQUMzQixJQUFNLG9CQUFvQixHQUN0QixlQUFlLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakYsS0FBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN6RixDQUFDLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsY0FBYyxFQUFFO1lBQy9ELFVBQVUsQ0FBQyxNQUFNLENBQ2IsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxFQUNoRCxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDOUMsT0FBTyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN2QyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFTRCxrREFBYyxHQUFkLFVBQWUsSUFBaUI7UUFBaEMsaUJBVUM7UUFUQyxJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUUxQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFM0UsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqQyxJQUFJLENBQUMsaUJBQWlCLENBQ2xCLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLFdBQVcsRUFDL0IsY0FBTSxPQUFBLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFwRixDQUFvRixDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVELDZDQUFTLEdBQVQsVUFBVSxJQUFZO1FBQ3BCLElBQUksQ0FBQyxtQkFBbUIsQ0FDcEIsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3RixDQUFDO0lBRUQsd0ZBQXdGO0lBQ3hGLEVBQUU7SUFDRix5Q0FBeUM7SUFDekMsY0FBYztJQUNkLE1BQU07SUFDTixNQUFNO0lBQ04sZUFBZTtJQUNmLGtCQUFrQjtJQUNsQixLQUFLO0lBQ0wsK0NBQStDO0lBQy9DLHdCQUF3QjtJQUN4QixNQUFNO0lBQ04sNERBQXdCLEdBQXhCLFVBQXlCLElBQVksRUFBRSxRQUFnQjtRQUNyRCxJQUFNLElBQUksR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDckMsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwRSxJQUFJLENBQUMsbUJBQW1CLENBQ3BCLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7SUFFTyxvREFBZ0IsR0FBeEIsY0FBNkIsT0FBTyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRXhELGlEQUFhLEdBQWIsY0FBa0IsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUUzQywrQ0FBVyxHQUFYLGNBQWdCLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztJQUV6QyxrREFBYyxHQUF0QixjQUEyQixPQUFPLEtBQUcsSUFBSSxDQUFDLGVBQWUsRUFBSSxDQUFDLENBQUMsQ0FBQztJQUVoRSxnRkFBZ0Y7SUFDaEYseUZBQXlGO0lBQ3pGLG9GQUFvRjtJQUNwRiw0Q0FBNEM7SUFDcEMsaURBQWEsR0FBckIsVUFDSSxHQUEwQixFQUFFLElBQTBCLEVBQUUsU0FBOEIsRUFDdEYsVUFBaUQ7UUFDbkQsR0FBRyxDQUFDLElBQUksQ0FBQztZQUNQLElBQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDckUsT0FBTyxXQUFXLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUN2RCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyx1REFBbUIsR0FBM0IsVUFDSSxJQUEwQixFQUFFLFNBQThCLEVBQzFELFVBQWtEO1FBQ3BELElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQy9FLENBQUM7SUFFTyxxREFBaUIsR0FBekIsVUFDSSxJQUEwQixFQUFFLFNBQThCLEVBQzFELFVBQWtEO1FBQ3BELElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRU8sNkRBQXlCLEdBQWpDLFVBQWtDLFFBQWdCO1FBQ2hELElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztRQUM5QyxJQUFJLENBQUMsa0JBQWtCLElBQUksUUFBUSxDQUFDO1FBQ3BDLE9BQU8sYUFBYSxDQUFDO0lBQ3ZCLENBQUM7SUFFTyx3REFBb0IsR0FBNUIsVUFBNkIsS0FBVTtRQUNyQyxJQUFJLENBQUMsYUFBYSxJQUFJLEtBQUssWUFBWSxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEYsQ0FBQztJQUVPLDBEQUFzQixHQUE5QixVQUErQixRQUFzQixFQUFFLEtBQVUsRUFBRSxVQUFvQjs7UUFFckYsSUFBTSxlQUFlLEdBQ2pCLEtBQUssWUFBWSxhQUFhLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsY0FBTSxPQUFBLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxFQUFqQyxDQUFpQyxDQUFDO1FBRTNGLElBQU0sd0JBQXdCLEdBQUcsc0JBQXNCLENBQ25ELElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRSxXQUFXLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQzFGLENBQUEsS0FBQSxJQUFJLENBQUMsY0FBYyxDQUFBLENBQUMsSUFBSSw0QkFBSSx3QkFBd0IsQ0FBQyxLQUFLLEdBQUU7UUFFNUQsSUFBTSxPQUFPLEdBQUcsd0JBQXdCLENBQUMsV0FBVyxDQUFDO1FBQ3JELE9BQU8sS0FBSyxZQUFZLGFBQWEsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ1QsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRU8sbURBQWUsR0FBdkIsVUFBd0IsT0FBZSxFQUFFLE9BQTZCO1FBQXRFLGlCQU1DO1FBTEMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7WUFDekIsSUFBTSxRQUFRLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQ3ZCLFFBQVEsRUFBRSxVQUFDLFdBQVcsRUFBRSxVQUFVLElBQU8sS0FBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNsRjtJQUNILENBQUM7SUFFTyxnRUFBNEIsR0FBcEMsVUFBcUMsT0FBNkI7UUFDaEUsSUFBTSxhQUFhLEdBQTZCLEVBQUUsQ0FBQztRQUVuRCxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUM7WUFDMUIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzVCLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQzthQUNqQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDLElBQU0sYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3RCxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUMsSUFBTSxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTlELE9BQU8sYUFBYSxDQUFDO0lBQ3ZCLENBQUM7SUFFTywwREFBc0IsR0FBOUIsVUFBK0IsTUFBMEIsRUFBRSxPQUF1QjtRQUVoRixJQUFNLFNBQVMsR0FBbUIsRUFBRSxDQUFDO1FBRXJDLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO1lBQ25DLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sb0JBQWlDLENBQUMsQ0FBQztZQUMzRCxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUMsQ0FBbUIsSUFBTyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxDQUFlLElBQU8sU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM5RTtRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7SUFFTyxnREFBWSxHQUFwQixVQUFxQixVQUEwQjtRQUM3QyxPQUFPLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ25FLENBQUMsQ0FBQyxlQUFlLENBQUM7SUFDeEIsQ0FBQztJQUVPLHdEQUFvQixHQUE1QixVQUE2QixVQUF5QjtRQUF0RCxpQkEwQkM7UUF6QkMsSUFBSSxDQUFDLFVBQVUsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUMxQyxPQUFPLENBQUMsQ0FBQyxlQUFlLENBQUM7U0FDMUI7UUFFRCxJQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxVQUFBLFNBQVM7WUFDaEQsSUFBTSxJQUFJLEdBQUcsS0FBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDckMsaUNBQWlDO1lBQ2pDLElBQU0sWUFBWSxHQUFHLEtBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM3RCxJQUFNLGNBQWMsR0FBRyxLQUFJLENBQUMsS0FBSyxDQUFDO1lBQ2xDLElBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDckMsS0FBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQ2xCLGNBQWMsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLEdBQUcsbUJBQ25DLFVBQUMsS0FBbUIsRUFBRSxhQUFxQjtnQkFDekMsYUFBYTtnQkFDYixJQUFNLGVBQWUsR0FDakIsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBRS9FLDJCQUEyQjtnQkFDM0IsSUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM5RSxPQUFPLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7WUFDdkQsQ0FBQyxDQUFDLENBQUM7WUFDUCxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDM0MsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFDSCxnQ0FBQztBQUFELENBQUMsQUF2MUJELElBdTFCQzs7QUFFRDtJQUE2QiwwQ0FBNkI7SUFHeEQsd0JBQ1ksWUFBMEIsRUFBVSxZQUEwQixFQUM5RCx5QkFBdUQsRUFDdkQsVUFDd0U7UUFKcEYsWUFLRSxpQkFBTyxTQUNSO1FBTFcsa0JBQVksR0FBWixZQUFZLENBQWM7UUFBVSxrQkFBWSxHQUFaLFlBQVksQ0FBYztRQUM5RCwrQkFBeUIsR0FBekIseUJBQXlCLENBQThCO1FBQ3ZELGdCQUFVLEdBQVYsVUFBVSxDQUM4RDtRQU41RSxvQkFBYyxHQUFtQixFQUFFLENBQUM7O0lBUTVDLENBQUM7SUFFRCxnQ0FBZ0M7SUFDaEMsa0NBQVMsR0FBVCxVQUFVLElBQWlCLEVBQUUsT0FBWTtRQUN2QyxxQ0FBcUM7UUFDckMsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2pDLElBQU0sZUFBZSxHQUFHLFVBQVEsSUFBTSxDQUFDO1FBQ3ZDLG1FQUFtRTtRQUNuRSxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM5RSxJQUFNLE1BQU0sR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ3ZGLElBQUEsbUNBQTBELEVBQXpELDBCQUFVLEVBQUUsNEJBQVcsQ0FBbUM7UUFDakUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQzVFLElBQU0sSUFBSSxxQkFBVyxJQUFJLENBQUMsR0FBRyxHQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QyxJQUFNLGFBQWEsR0FDZixXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUzRixJQUFNLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU07WUFDckQsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztZQUNyQyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLENBQUM7V0FDOUMsYUFBYSxFQUNoQixDQUFDO1FBQ0gsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDdkMsT0FBTyxZQUFZLENBQUM7SUFDdEIsQ0FBQztJQUVELDhDQUFxQixHQUFyQixVQUFzQixZQUFvQjtRQUN4QyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxVQUFDLElBQWtCO1lBQzdDLG9FQUFvRTtZQUNwRSxJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBcUIsQ0FBQztZQUNuRCxVQUFVLENBQUMsS0FBZ0IsSUFBSSxZQUFZLENBQUM7UUFDL0MsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsMENBQWlCLEdBQWpCLFVBQWtCLEtBQW1CLEVBQUUsT0FBWTtRQUFuRCxpQkFVQztRQVRDLE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFLFVBQUEsTUFBTTtZQUNqRix5RUFBeUU7WUFDekUsa0ZBQWtGO1lBQ2xGLDRFQUE0RTtZQUM1RSxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3JDLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBZCxDQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN0QyxLQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDbEQsaUJBQWlCLENBQUMsS0FBSSxDQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsS0FBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDcEYsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsd0NBQWUsR0FBZixVQUFnQixHQUFlLEVBQUUsT0FBWTtRQUE3QyxpQkFXQztRQVZDLE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLFVBQUEsTUFBTTtZQUN4RSwwRUFBMEU7WUFDMUUsa0ZBQWtGO1lBQ2xGLDRFQUE0RTtZQUM1RSxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQ25DLFVBQUMsS0FBSyxFQUFFLEtBQUssSUFBSyxPQUFBLENBQUMsRUFBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxPQUFBLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFDLENBQUMsRUFBbkUsQ0FBbUUsQ0FBQyxDQUFDLENBQUM7WUFDNUYsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFkLENBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RDLEtBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNsRCxpQkFBaUIsQ0FBQyxLQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sRUFBRSxLQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUNwRixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDSCxxQkFBQztBQUFELENBQUMsQUFsRUQsQ0FBNkIsNkJBQTZCLEdBa0V6RDtBQUVELHNFQUFzRTtBQUN0RSxJQUFNLHNCQUFzQixHQUFHLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBRXhGLDZCQUE2QixJQUFvQjtJQUMvQyxJQUFNLFVBQVUsR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdkQsT0FBTztRQUNMLFVBQVUsRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDLFNBQVM7UUFDdEMsV0FBVyxFQUFFLENBQUMsVUFBVTtLQUN6QixDQUFDO0FBQ0osQ0FBQztBQUVELElBQU0sdUJBQXVCLEdBQUc7SUFDOUIsRUFBRSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsYUFBYTtJQUN4RixFQUFFLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsYUFBYTtDQUN2RSxDQUFDO0FBRUYsOEJBQThCLElBQW9CO0lBQ2hELElBQU0sVUFBVSxHQUFHLHVCQUF1QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN4RCxPQUFPO1FBQ0wsVUFBVSxFQUFFLFVBQVUsSUFBSSxFQUFFLENBQUMsYUFBYTtRQUMxQyxXQUFXLEVBQUUsQ0FBQyxVQUFVO0tBQ3pCLENBQUM7QUFDSixDQUFDO0FBRUQscUJBQ0ksSUFBNEIsRUFBRSxTQUE4QixFQUM1RCxNQUFzQjtJQUN4QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2xFLENBQUM7QUFFRCxhQUFhO0FBQ2IsaUNBQWlDLGlCQUF5QjtJQUN4RCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQztTQUM5QixNQUFNLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMzRSxDQUFDO0FBRUQsMkJBQ0ksWUFBMEIsRUFBRSxPQUE4QyxFQUMxRSxhQUEyQztJQUN2QyxJQUFBLDRDQUFtRixFQUFsRixrQ0FBYyxFQUFFLG9EQUF1QixDQUE0QztJQUMxRixxREFBcUQ7SUFDckQsSUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNwRSx1QkFBdUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO0lBQzFGLElBQUEsa0RBQXlFLEVBQXhFLDBCQUFVLEVBQUUsNEJBQVcsQ0FBa0Q7SUFFaEYsMkZBQTJGO0lBQzNGLFVBQVU7SUFDVixJQUFNLElBQUksR0FBRztRQUNYLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQ3BCLGNBQWM7S0FDZixDQUFDO0lBRUYsSUFBSSxXQUFXLEVBQUU7UUFDZixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDO0tBQ2xEO1NBQU07UUFDTCxJQUFJLENBQUMsSUFBSSxPQUFULElBQUksbUJBQVMsdUJBQXVCLEdBQUU7S0FDdkM7SUFFRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFVRCxxRUFBcUU7QUFDckUsSUFBTSxrQkFBa0IsR0FBRyxnQkFBZ0IsQ0FBQztBQTJCNUM7SUFRRSxzQkFBMkIsWUFBd0IsRUFBVSxNQUFnQztRQUFsRSw2QkFBQSxFQUFBLGdCQUF3QjtRQUFVLHVCQUFBLEVBQUEsYUFBZ0M7UUFBbEUsaUJBQVksR0FBWixZQUFZLENBQVk7UUFBVSxXQUFNLEdBQU4sTUFBTSxDQUEwQjtRQVA3Riw2REFBNkQ7UUFDckQsUUFBRyxHQUFHLElBQUksR0FBRyxFQUF1QixDQUFDO1FBQ3JDLHVCQUFrQixHQUFHLENBQUMsQ0FBQztRQUN2Qix3QkFBbUIsR0FBdUIsSUFBSSxDQUFDO0lBSXlDLENBQUM7SUFFakcsMEJBQUcsR0FBSCxVQUFJLElBQVk7UUFDZCxJQUFJLE9BQU8sR0FBc0IsSUFBSSxDQUFDO1FBQ3RDLE9BQU8sT0FBTyxFQUFFO1lBQ2QsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEMsSUFBSSxLQUFLLElBQUksSUFBSSxFQUFFO2dCQUNqQixJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7b0JBQ3BCLGtEQUFrRDtvQkFDbEQsS0FBSyxHQUFHO3dCQUNOLGNBQWMsRUFBRSxLQUFLLENBQUMsY0FBYzt3QkFDcEMsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO3dCQUNkLG9CQUFvQixFQUFFLEtBQUssQ0FBQyxvQkFBb0I7d0JBQ2hELE9BQU8sRUFBRSxLQUFLO3dCQUNkLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUTtxQkFDekIsQ0FBQztvQkFFRiwyQkFBMkI7b0JBQzNCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDMUIseUNBQXlDO29CQUN6QyxJQUFJLENBQUMsNkJBQTZCLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7aUJBQzdDO2dCQUVELElBQUksS0FBSyxDQUFDLG9CQUFvQixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRTtvQkFDaEQsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7aUJBQ3RCO2dCQUNELE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNsQjtZQUNELE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1NBQzFCO1FBRUQsb0ZBQW9GO1FBQ3BGLDBFQUEwRTtRQUMxRSxrRkFBa0Y7UUFDbEYsNkVBQTZFO1FBQzdFLE9BQU8sSUFBSSxDQUFDLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNILDBCQUFHLEdBQUgsVUFBSSxjQUFzQixFQUFFLElBQVksRUFBRSxHQUFrQixFQUN4RCxRQUE4QyxFQUM5QyxvQkFBOEM7UUFEOUMseUJBQUEsRUFBQSwwQkFBOEM7UUFFaEQsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFDZixLQUFLLENBQUMsY0FBWSxJQUFJLDJDQUFzQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUcsQ0FBQyxDQUFDO1FBQ3RGLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRTtZQUNqQixjQUFjLEVBQUUsY0FBYztZQUM5QixHQUFHLEVBQUUsR0FBRztZQUNSLE9BQU8sRUFBRSxLQUFLO1lBQ2Qsb0JBQW9CLEVBQUUsb0JBQW9CO1lBQzFDLFFBQVEsRUFBRSxRQUFRO1NBQ25CLENBQUMsQ0FBQztRQUNILE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELCtCQUFRLEdBQVIsVUFBUyxJQUFZLElBQXlCLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFdEUsa0NBQVcsR0FBWCxVQUFZLEtBQWE7UUFDdkIsSUFBTSxRQUFRLEdBQUcsSUFBSSxZQUFZLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQy9DLElBQUksS0FBSyxHQUFHLENBQUM7WUFBRSxRQUFRLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEQsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztJQUVELDJDQUFvQixHQUFwQixVQUFxQixjQUFzQjtRQUN6QyxJQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxjQUFjLENBQUMsQ0FBQztRQUN2RSxPQUFPLFlBQVksSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDeEUsQ0FBQztJQUVELG9EQUE2QixHQUE3QixVQUE4QixLQUFrQjtRQUM5QyxJQUFJLEtBQUssQ0FBQyxRQUFRLG9CQUFnQyxFQUFFO1lBQ2xELElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGtCQUFrQixHQUFHLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUM3RSxJQUFJLFlBQVksRUFBRTtnQkFDaEIsWUFBWSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7YUFDN0I7aUJBQU07Z0JBQ0wsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQzthQUNyRDtTQUNGO0lBQ0gsQ0FBQztJQUVELCtDQUF3QixHQUF4QixVQUF5QixjQUFzQjtRQUM3QyxJQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGtCQUFrQixHQUFHLGNBQWMsRUFBRTtZQUNoRCxjQUFjLEVBQUUsY0FBYztZQUM5QixHQUFHLEVBQUUsR0FBRztZQUNSLG9CQUFvQixFQUFFLFVBQUMsS0FBbUIsRUFBRSxhQUFxQjtnQkFDL0QsdUJBQXVCO2dCQUN2QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7WUFDekUsQ0FBQztZQUNELE9BQU8sRUFBRSxLQUFLO1lBQ2QsUUFBUSx3QkFBb0M7U0FDN0MsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELDJDQUFvQixHQUFwQixVQUFxQixJQUFZO1FBQy9CLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBRyxDQUFDO1FBQzlELGNBQWMsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBQzlCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6QixPQUFPLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCx1Q0FBZ0IsR0FBaEIsVUFBaUIsY0FBc0I7UUFDckMsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDaEUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFRLENBQUMsbUJBQW1CLEVBQUU7Z0JBQ3RDLDZFQUE2RTtnQkFDN0UsSUFBSSxDQUFDLE1BQVEsQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFRLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO2FBQ3BGO1lBQ0QsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxNQUFRLENBQUMsbUJBQW1CLENBQUM7U0FDOUQ7SUFDSCxDQUFDO0lBRUQsMkNBQW9CLEdBQXBCO1FBQ0UsZUFBZTtRQUNmLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDN0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMxRSxFQUFFLENBQUM7SUFDVCxDQUFDO0lBRUQsNkNBQXNCLEdBQXRCO1FBQ0Usd0JBQXdCO1FBQ3hCLElBQU0seUJBQXlCLEdBQUcsV0FBVyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzNFLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDN0IsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3pFLEVBQUUsQ0FBQztJQUNULENBQUM7SUFFRCxzQ0FBZSxHQUFmLGNBQW9CLE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUUzRiwyQ0FBb0IsR0FBcEI7UUFBQSxpQkFXQztRQVZDLElBQUksbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO1FBQzVCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQy9CLE1BQU0sQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxPQUFPLEVBQWIsQ0FBYSxDQUFDO2FBQzlCLElBQUksQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDLElBQUssT0FBQSxDQUFDLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQyxjQUFjLElBQUksQ0FBQyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUE5RCxDQUE4RCxDQUFDO2FBQzlFLE1BQU0sQ0FBQyxVQUFDLEtBQW9CLEVBQUUsS0FBa0I7WUFDL0MsSUFBTSxTQUFTLEdBQUcsS0FBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDO1lBQzNELElBQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxvQkFBc0IsQ0FBQyxLQUFJLEVBQUUsU0FBUyxHQUFHLG1CQUFtQixDQUFDLENBQUM7WUFDdEYsbUJBQW1CLEdBQUcsU0FBUyxDQUFDO1lBQ2hDLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNqQyxDQUFDLEVBQUUsRUFBRSxDQUFrQixDQUFDO0lBQzlCLENBQUM7SUFHRCx5Q0FBa0IsR0FBbEI7UUFDRSxJQUFJLE9BQU8sR0FBaUIsSUFBSSxDQUFDO1FBQ2pDLGdFQUFnRTtRQUNoRSxPQUFPLE9BQU8sQ0FBQyxNQUFNO1lBQUUsT0FBTyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDaEQsSUFBTSxHQUFHLEdBQUcsS0FBRyxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsa0JBQWtCLEVBQUksQ0FBQztRQUNqRSxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUE3Sk0sdUJBQVUsR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQThKaEYsbUJBQUM7Q0FBQSxBQXBLRCxJQW9LQztTQXBLWSxZQUFZO0FBc0t6Qjs7R0FFRztBQUNILDJCQUEyQixHQUFXLEVBQUUsVUFBb0M7SUFDMUUsSUFBTSxXQUFXLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQztJQUV0QyxXQUFXLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTVCLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxJQUFJO1FBQ2xELElBQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUvQixXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN0QyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxPQUFPLEVBQUU7WUFDbEMsSUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUEsU0FBUyxJQUFJLE9BQUEsV0FBVyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBbkMsQ0FBbUMsQ0FBQyxDQUFDO1NBQ25FO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBRUQseUJBQXlCO0FBQ3pCLFlBQVk7QUFDWix5QkFBeUI7QUFDekIsZ0NBQWdDO0FBQ2hDLHVCQUF1QixJQUFhOztJQUNsQyxJQUFJLE9BQXlCLENBQUM7SUFDOUIsSUFBSSxXQUE2QixDQUFDO0lBQ2xDLElBQUksRUFBb0IsQ0FBQztJQUV6QixJQUFJLElBQUksRUFBRTtRQUNSLGtFQUFrRTtRQUNsRSxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTNDLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNsRCxJQUFJLGNBQWMsU0FBUSxDQUFDO1FBQzNCLHVHQUNtRixFQURsRixzQkFBYyxFQUFFLFVBQUUsQ0FDaUU7UUFDcEY7O29DQUV3QixFQUZ2QixlQUFPLEVBQUUsbUJBQVcsQ0FFSTtLQUMxQjtJQUVELE9BQU8sRUFBQyxXQUFXLGFBQUEsRUFBRSxFQUFFLElBQUEsRUFBRSxPQUFPLFNBQUEsRUFBQyxDQUFDO0FBQ3BDLENBQUM7QUFFRCxxQkFBcUIsSUFBb0I7SUFDdkMsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRSw2Q0FBNkM7SUFDcEUsUUFBUSxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ25CLEtBQUssQ0FBQztZQUNKLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELEtBQUssQ0FBQztZQUNKLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELEtBQUssQ0FBQztZQUNKLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELEtBQUssQ0FBQztZQUNKLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELEtBQUssRUFBRTtZQUNMLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELEtBQUssRUFBRTtZQUNMLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELEtBQUssRUFBRTtZQUNMLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELEtBQUssRUFBRTtZQUNMLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3ZEO0lBQ0QsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkMsS0FBSyxDQUFDLDJDQUF5QyxJQUFJLENBQUMsTUFBUSxDQUFDLENBQUM7SUFDbEUsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0RSxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxNQUFNLHdCQUNGLFFBQWdCLEVBQUUsV0FBbUIsRUFBRSxPQUE2QztJQUE3Qyx3QkFBQSxFQUFBLFlBQTZDO0lBRXRGLElBQU0sYUFBYSxHQUFHLGlCQUFpQixFQUFFLENBQUM7SUFDMUMsSUFBTSxVQUFVLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQztJQUNwQyxJQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUU1RCxJQUFJLFdBQVcsQ0FBQyxNQUFNLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3ZELE9BQU8sRUFBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxFQUFDLENBQUM7S0FDN0Y7SUFFRCxJQUFJLFNBQVMsR0FBZ0IsV0FBVyxDQUFDLFNBQVMsQ0FBQztJQUNuRCxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixFQUFFO1FBQ2hDLFNBQVMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksaUJBQWlCLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztLQUMvRDtJQUVLLElBQUEsa0RBQzJDLEVBRDFDLGdCQUFLLEVBQUUsOEJBQVksRUFBRSwwQ0FBa0IsRUFBRSxrQkFBTSxDQUNKO0lBQ2xELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQy9CLE9BQU8sRUFBQyxNQUFNLFFBQUEsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxFQUFDLENBQUM7S0FDekU7SUFFRCxPQUFPLEVBQUMsS0FBSyxPQUFBLEVBQUUsWUFBWSxjQUFBLEVBQUUsa0JBQWtCLG9CQUFBLEVBQUMsQ0FBQztBQUNuRCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNO0lBQ0osT0FBTyxJQUFJLGFBQWEsQ0FDcEIsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxFQUFFLDRCQUE0QixFQUFFLElBQUksd0JBQXdCLEVBQUUsRUFBRSxJQUFJLEVBQzNGLEVBQUUsQ0FBQyxDQUFDO0FBQ1YsQ0FBQztBQUVELHdCQUF3QixLQUF1QjtJQUM3QyxPQUFPLEtBQUssQ0FBQyxJQUFJLElBQUksV0FBVyxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDO0FBQzVELENBQUM7QUFFRCwrQkFBK0IsS0FBdUIsRUFBRSxPQUE2QjtJQUNuRixRQUFRLE9BQU8sRUFBRTtRQUNmLEtBQUssSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJO1lBQzVCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDdkMsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU07WUFDOUIsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN6QyxLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSztZQUM3Qix5RUFBeUU7WUFDekUsNkVBQTZFO1lBQzdFLHNFQUFzRTtZQUN0RSxPQUFPLEtBQUssQ0FBQyxJQUFJLHNCQUEwQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ3RGLEtBQUssSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHO1lBQzNCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdEMsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVk7WUFDcEMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQzlDO1lBQ0UsT0FBTyxJQUFJLENBQUM7S0FDZjtBQUNILENBQUM7QUFFRCw0QkFBNEIsSUFBWTtJQUN0QyxRQUFRLElBQUksRUFBRTtRQUNaLEtBQUssa0JBQWtCLENBQUM7UUFDeEIsS0FBSyxZQUFZLENBQUM7UUFDbEIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxRQUFRLENBQUM7UUFDZCxLQUFLLFlBQVksQ0FBQztRQUNsQixLQUFLLGtCQUFrQjtZQUNyQixPQUFPLElBQUksQ0FBQztLQUNmO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2ZsYXR0ZW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBCdWlsdGluRnVuY3Rpb25DYWxsLCBMb2NhbFJlc29sdmVyLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsUHJpbWl0aXZlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge1doaXRlc3BhY2VWaXNpdG9yfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge2lzTmdDb250YWluZXIgYXMgY2hlY2tJc05nQ29udGFpbmVyLCBzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtodG1sQXN0VG9SZW5kZXIzQXN0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuXG5pbXBvcnQge1IzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxpbmcnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIEkxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgSURfU0VQQVJBVE9SLCBJTVBMSUNJVF9SRUZFUkVOQ0UsIE1FQU5JTkdfU0VQQVJBVE9SLCBSRUZFUkVOQ0VfUFJFRklYLCBSRU5ERVJfRkxBR1MsIGFzTGl0ZXJhbCwgaW52YWxpZCwgaXNJMThOQXR0cmlidXRlLCBtYXBUb0V4cHJlc3Npb24sIHRyaW1UcmFpbGluZ051bGxzLCB1bnN1cHBvcnRlZH0gZnJvbSAnLi91dGlsJztcblxuZnVuY3Rpb24gbWFwQmluZGluZ1RvSW5zdHJ1Y3Rpb24odHlwZTogQmluZGluZ1R5cGUpOiBvLkV4dGVybmFsUmVmZXJlbmNlfHVuZGVmaW5lZCB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICByZXR1cm4gUjMuZWxlbWVudFByb3BlcnR5O1xuICAgIGNhc2UgQmluZGluZ1R5cGUuQXR0cmlidXRlOlxuICAgICAgcmV0dXJuIFIzLmVsZW1lbnRBdHRyaWJ1dGU7XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgIHJldHVybiBSMy5lbGVtZW50Q2xhc3NQcm9wO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8vICBpZiAocmYgJiBmbGFncykgeyAuLiB9XG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgIGZsYWdzOiBjb3JlLlJlbmRlckZsYWdzLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKTogby5JZlN0bXQge1xuICByZXR1cm4gby5pZlN0bXQoby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGZsYWdzKSwgbnVsbCwgZmFsc2UpLCBzdGF0ZW1lbnRzKTtcbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgaW1wbGVtZW50cyB0LlZpc2l0b3I8dm9pZD4sIExvY2FsUmVzb2x2ZXIge1xuICBwcml2YXRlIF9kYXRhSW5kZXggPSAwO1xuICBwcml2YXRlIF9iaW5kaW5nQ29udGV4dCA9IDA7XG4gIHByaXZhdGUgX3ByZWZpeENvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgaW4gbGlzdGVuZXJzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLlxuICAgKiBUaGlzIGVuc3VyZXMgYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfY3JlYXRpb25Db2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLiBUaGlzIGVuc3VyZXNcbiAgICogYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfdXBkYXRlQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGdlbmVyYXRlZCBmcm9tIHZpc2l0aW5nIHBpcGVzLCBsaXRlcmFscywgZXRjLiAqL1xuICBwcml2YXRlIF90ZW1wVmFyaWFibGVzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBidWlsZCBuZXN0ZWQgdGVtcGxhdGVzLiBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWxcbiAgICogYWZ0ZXIgdGhlIHBhcmVudCB0ZW1wbGF0ZSBoYXMgZmluaXNoZWQgdmlzaXRpbmcgYWxsIG9mIGl0cyBub2Rlcy4gVGhpcyBlbnN1cmVzIHRoYXQgYWxsXG4gICAqIGxvY2FsIHJlZiBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIGFyZSBhYmxlIHRvIGZpbmQgbG9jYWwgcmVmIHZhbHVlcyBpZiB0aGUgcmVmc1xuICAgKiBhcmUgZGVmaW5lZCBhZnRlciB0aGUgdGVtcGxhdGUgZGVjbGFyYXRpb24uXG4gICAqL1xuICBwcml2YXRlIF9uZXN0ZWRUZW1wbGF0ZUZuczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgLyoqXG4gICAqIFRoaXMgc2NvcGUgY29udGFpbnMgbG9jYWwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB1cGRhdGUgbW9kZSBibG9jayBvZiB0aGUgdGVtcGxhdGUuXG4gICAqIChlLmcuIHJlZnMgYW5kIGNvbnRleHQgdmFycyBpbiBiaW5kaW5ncylcbiAgICovXG4gIHByaXZhdGUgX2JpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlO1xuICBwcml2YXRlIF92YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIHByaXZhdGUgX3Vuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5cbiAgLy8gV2hldGhlciB3ZSBhcmUgaW5zaWRlIGEgdHJhbnNsYXRhYmxlIGVsZW1lbnQgKGA8cCBpMThuPi4uLiBzb21ld2hlcmUgaGVyZSAuLi4gPC9wPilcbiAgcHJpdmF0ZSBfaW5JMThuU2VjdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9pMThuU2VjdGlvbkluZGV4ID0gLTE7XG4gIC8vIE1hcHMgb2YgcGxhY2Vob2xkZXIgdG8gbm9kZSBpbmRleGVzIGZvciBlYWNoIG9mIHRoZSBpMThuIHNlY3Rpb25cbiAgcHJpdmF0ZSBfcGhUb05vZGVJZHhlczoge1twaE5hbWU6IHN0cmluZ106IG51bWJlcltdfVtdID0gW3t9XTtcblxuICAvLyBOdW1iZXIgb2Ygc2xvdHMgdG8gcmVzZXJ2ZSBmb3IgcHVyZUZ1bmN0aW9uc1xuICBwcml2YXRlIF9wdXJlRnVuY3Rpb25TbG90cyA9IDA7XG5cbiAgLy8gTnVtYmVyIG9mIGJpbmRpbmcgc2xvdHNcbiAgcHJpdmF0ZSBfYmluZGluZ1Nsb3RzID0gMDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHBhcmVudEJpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlLCBwcml2YXRlIGxldmVsID0gMCxcbiAgICAgIHByaXZhdGUgY29udGV4dE5hbWU6IHN0cmluZ3xudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIHZpZXdRdWVyaWVzOiBSM1F1ZXJ5TWV0YWRhdGFbXSwgcHJpdmF0ZSBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCxcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlczogU2V0PG8uRXhwcmVzc2lvbj4sIHByaXZhdGUgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIHBpcGVzOiBTZXQ8by5FeHByZXNzaW9uPiwgcHJpdmF0ZSBfbmFtZXNwYWNlOiBvLkV4dGVybmFsUmVmZXJlbmNlKSB7XG4gICAgLy8gdmlldyBxdWVyaWVzIGNhbiB0YWtlIHVwIHNwYWNlIGluIGRhdGEgYW5kIGFsbG9jYXRpb24gaGFwcGVucyBlYXJsaWVyIChpbiB0aGUgXCJ2aWV3UXVlcnlcIlxuICAgIC8vIGZ1bmN0aW9uKVxuICAgIHRoaXMuX2RhdGFJbmRleCA9IHZpZXdRdWVyaWVzLmxlbmd0aDtcblxuICAgIHRoaXMuX2JpbmRpbmdTY29wZSA9IHBhcmVudEJpbmRpbmdTY29wZS5uZXN0ZWRTY29wZShsZXZlbCk7XG5cbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgY29uc3RhbnRQb29sLCAoKSA9PiB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSxcbiAgICAgICAgKG51bVNsb3RzOiBudW1iZXIpID0+IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90cyksXG4gICAgICAgIChuYW1lLCBsb2NhbE5hbWUsIHNsb3QsIHZhbHVlOiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGlwZVR5cGUgPSBwaXBlVHlwZUJ5TmFtZS5nZXQobmFtZSk7XG4gICAgICAgICAgaWYgKHBpcGVUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLnBpcGVzLmFkZChwaXBlVHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQodGhpcy5sZXZlbCwgbG9jYWxOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnBpcGUsIFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChuYW1lKV0pO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyh2YXJpYWJsZTogdC5WYXJpYWJsZSkge1xuICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUodmFyaWFibGUubmFtZSArIHNjb3BlZE5hbWUpO1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQoXG4gICAgICAgIHJldHJpZXZhbExldmVsLCB2YXJpYWJsZS5uYW1lLCBsaHMsIERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCxcbiAgICAgICAgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgIGxldCByaHM6IG8uRXhwcmVzc2lvbjtcbiAgICAgICAgICBpZiAoc2NvcGUuYmluZGluZ0xldmVsID09PSByZXRyaWV2YWxMZXZlbCkge1xuICAgICAgICAgICAgLy8gZS5nLiBjdHhcbiAgICAgICAgICAgIHJocyA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2hhcmVkQ3R4VmFyID0gc2NvcGUuZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWwpO1xuICAgICAgICAgICAgLy8gZS5nLiBjdHhfcjAgICBPUiAgeCgyKTtcbiAgICAgICAgICAgIHJocyA9IHNoYXJlZEN0eFZhciA/IHNoYXJlZEN0eFZhciA6IGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRpdGVtJCA9IHgoMikuJGltcGxpY2l0O1xuICAgICAgICAgIHJldHVybiBbbGhzLnNldChyaHMucHJvcCh2YXJpYWJsZS52YWx1ZSB8fCBJTVBMSUNJVF9SRUZFUkVOQ0UpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBidWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICBub2RlczogdC5Ob2RlW10sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdLCBoYXNOZ0NvbnRlbnQ6IGJvb2xlYW4gPSBmYWxzZSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10gPSBbXSk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYpKTtcblxuICAgIC8vIE91dHB1dCBhIGBQcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiB3aGVuIHNvbWUgYDxuZy1jb250ZW50PmAgYXJlIHByZXNlbnRcbiAgICBpZiAoaGFzTmdDb250ZW50KSB7XG4gICAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgICAvLyBPbmx5IHNlbGVjdG9ycyB3aXRoIGEgbm9uLWRlZmF1bHQgdmFsdWUgYXJlIGdlbmVyYXRlZFxuICAgICAgaWYgKG5nQ29udGVudFNlbGVjdG9ycy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGNvbnN0IHIzU2VsZWN0b3JzID0gbmdDb250ZW50U2VsZWN0b3JzLm1hcChzID0+IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzKSk7XG4gICAgICAgIC8vIGBwcm9qZWN0aW9uRGVmYCBuZWVkcyBib3RoIHRoZSBwYXJzZWQgYW5kIHJhdyB2YWx1ZSBvZiB0aGUgc2VsZWN0b3JzXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNTZWxlY3RvcnMpLCB0cnVlKTtcbiAgICAgICAgY29uc3QgdW5QYXJzZWQgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKG5nQ29udGVudFNlbGVjdG9ycyksIHRydWUpO1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2gocGFyc2VkLCB1blBhcnNlZCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5wcm9qZWN0aW9uRGVmLCBwYXJhbWV0ZXJzKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIGJpbmRpbmdzIGluIGxpc3RlbmVycylcbiAgICBjb25zdCBjcmVhdGlvblN0YXRlbWVudHMgPSB0aGlzLl9jcmVhdGlvbkNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBwcm9wZXJ0eSBvciB0ZXh0IGJpbmRpbmdzKVxuICAgIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHMgPSB0aGlzLl91cGRhdGVDb2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vICBWYXJpYWJsZSBkZWNsYXJhdGlvbiBtdXN0IG9jY3VyIGFmdGVyIGJpbmRpbmcgcmVzb2x1dGlvbiBzbyB3ZSBjYW4gZ2VuZXJhdGUgY29udGV4dFxuICAgIC8vICBpbnN0cnVjdGlvbnMgdGhhdCBidWlsZCBvbiBlYWNoIG90aGVyLiBlLmcuIGNvbnN0IGIgPSB4KCkuJGltcGxpY2l0KCk7IGNvbnN0IGIgPSB4KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIC8vIEdlbmVyYXRlIG1hcHMgb2YgcGxhY2Vob2xkZXIgbmFtZSB0byBub2RlIGluZGV4ZXNcbiAgICAvLyBUT0RPKHZpY2IpOiBUaGlzIGlzIGEgV0lQLCBub3QgZnVsbHkgc3VwcG9ydGVkIHlldFxuICAgIGZvciAoY29uc3QgcGhUb05vZGVJZHggb2YgdGhpcy5fcGhUb05vZGVJZHhlcykge1xuICAgICAgaWYgKE9iamVjdC5rZXlzKHBoVG9Ob2RlSWR4KS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICAgIGNvbnN0IHBoTWFwID0gby52YXJpYWJsZShzY29wZWROYW1lKS5zZXQobWFwVG9FeHByZXNzaW9uKHBoVG9Ob2RlSWR4LCB0cnVlKSkudG9Db25zdERlY2woKTtcblxuICAgICAgICB0aGlzLl9wcmVmaXhDb2RlLnB1c2gocGhNYXApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzZWxlY3RvckluZGV4ID0gbmdDb250ZW50LnNlbGVjdG9ySW5kZXg7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QpXTtcblxuICAgIGNvbnN0IGF0dHJpYnV0ZUFzTGlzdDogc3RyaW5nW10gPSBbXTtcblxuICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZvckVhY2goKGF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHJpYnV0ZS5uYW1lO1xuICAgICAgaWYgKG5hbWUgIT09ICdzZWxlY3QnKSB7XG4gICAgICAgIGF0dHJpYnV0ZUFzTGlzdC5wdXNoKG5hbWUsIGF0dHJpYnV0ZS52YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYXR0cmlidXRlQXNMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCksIGFzTGl0ZXJhbChhdHRyaWJ1dGVBc0xpc3QpKTtcbiAgICB9IGVsc2UgaWYgKHNlbGVjdG9ySW5kZXggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCkpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgcGFyYW1ldGVycyk7XG4gIH1cblxuXG4gIGdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleTogc3RyaW5nfG51bGwpIHtcbiAgICBzd2l0Y2ggKG5hbWVzcGFjZUtleSkge1xuICAgICAgY2FzZSAnbWF0aCc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VNYXRoTUw7XG4gICAgICBjYXNlICdzdmcnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlU1ZHO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZUhUTUw7XG4gICAgfVxuICB9XG5cbiAgYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24obnNJbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgdGhpcy5fbmFtZXNwYWNlID0gbnNJbnN0cnVjdGlvbjtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBuc0luc3RydWN0aW9uKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCB3YXNJbkkxOG5TZWN0aW9uID0gdGhpcy5faW5JMThuU2VjdGlvbjtcblxuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBjb25zdCBhdHRySTE4bk1ldGFzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBsZXQgaTE4bk1ldGE6IHN0cmluZyA9ICcnO1xuXG4gICAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcbiAgICBjb25zdCBpc05nQ29udGFpbmVyID0gY2hlY2tJc05nQ29udGFpbmVyKGVsZW1lbnQubmFtZSk7XG5cbiAgICAvLyBFbGVtZW50cyBpbnNpZGUgaTE4biBzZWN0aW9ucyBhcmUgcmVwbGFjZWQgd2l0aCBwbGFjZWhvbGRlcnNcbiAgICAvLyBUT0RPKHZpY2IpOiBuZXN0ZWQgZWxlbWVudHMgYXJlIGEgV0lQIGluIHRoaXMgcGhhc2VcbiAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbikge1xuICAgICAgY29uc3QgcGhOYW1lID0gZWxlbWVudC5uYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIXRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF1bcGhOYW1lXSkge1xuICAgICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF1bcGhOYW1lXS5wdXNoKGVsZW1lbnRJbmRleCk7XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIGkxOG4gYXR0cmlidXRlc1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyLm5hbWU7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICBpZiAobmFtZSA9PT0gSTE4Tl9BVFRSKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbkkxOG5TZWN0aW9uKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgQ291bGQgbm90IG1hcmsgYW4gZWxlbWVudCBhcyB0cmFuc2xhdGFibGUgaW5zaWRlIG9mIGEgdHJhbnNsYXRhYmxlIHNlY3Rpb25gKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9pbkkxOG5TZWN0aW9uID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5faTE4blNlY3Rpb25JbmRleCsrO1xuICAgICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdID0ge307XG4gICAgICAgIGkxOG5NZXRhID0gdmFsdWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUuc3RhcnRzV2l0aChJMThOX0FUVFJfUFJFRklYKSkge1xuICAgICAgICBhdHRySTE4bk1ldGFzW25hbWUuc2xpY2UoSTE4Tl9BVFRSX1BSRUZJWC5sZW5ndGgpXSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0QXR0cnNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYXRjaCBkaXJlY3RpdmVzIG9uIG5vbiBpMThuIGF0dHJpYnV0ZXNcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhlbGVtZW50Lm5hbWUsIGVsZW1lbnQpO1xuXG4gICAgLy8gUmVndWxhciBlbGVtZW50IG9yIG5nLWNvbnRhaW5lciBjcmVhdGlvbiBtb2RlXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGVsZW1lbnRJbmRleCldO1xuICAgIGlmICghaXNOZ0NvbnRhaW5lcikge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChlbGVtZW50TmFtZSkpO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IGluaXRpYWxDbGFzc0RlY2xhcmF0aW9uczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgIGNvbnN0IHN0eWxlSW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBjbGFzc0lucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgYWxsT3RoZXJJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIHN3aXRjaCAoaW5wdXQudHlwZSkge1xuICAgICAgICAvLyBbYXR0ci5zdHlsZV0gb3IgW2F0dHIuY2xhc3NdIHNob3VsZCBub3QgYmUgdHJlYXRlZCBhcyBzdHlsaW5nLWJhc2VkXG4gICAgICAgIC8vIGJpbmRpbmdzIHNpbmNlIHRoZXkgYXJlIGludGVuZGVkIHRvIGJlIHdyaXR0ZW4gZGlyZWN0bHkgdG8gdGhlIGF0dHJcbiAgICAgICAgLy8gYW5kIHRoZXJlZm9yZSB3aWxsIHNraXAgYWxsIHN0eWxlL2NsYXNzIHJlc29sdXRpb24gdGhhdCBpcyBwcmVzZW50XG4gICAgICAgIC8vIHdpdGggc3R5bGU9XCJcIiwgW3N0eWxlXT1cIlwiIGFuZCBbc3R5bGUucHJvcF09XCJcIiwgY2xhc3M9XCJcIixcbiAgICAgICAgLy8gW2NsYXNzLnByb3BdPVwiXCIuIFtjbGFzc109XCJcIiBhc3NpZ25tZW50c1xuICAgICAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICAgIGlmIChpbnB1dC5uYW1lID09ICdzdHlsZScpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyBnbyBmaXJzdCBpbiB0aGUgY29tcGlsYXRpb24gKGZvciBbc3R5bGVdKVxuICAgICAgICAgICAgc3R5bGVJbnB1dHMuc3BsaWNlKDAsIDAsIGlucHV0KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGlzQ2xhc3NCaW5kaW5nKGlucHV0KSkge1xuICAgICAgICAgICAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIGdvIGZpcnN0IGluIHRoZSBjb21waWxhdGlvbiAoZm9yIFtjbGFzc10pXG4gICAgICAgICAgICBjbGFzc0lucHV0cy5zcGxpY2UoMCwgMCwgaW5wdXQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbGxPdGhlcklucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQmluZGluZ1R5cGUuU3R5bGU6XG4gICAgICAgICAgc3R5bGVJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgICAgY2xhc3NJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBsZXQgY3VyclN0eWxlSW5kZXggPSAwO1xuICAgIGxldCBjdXJyQ2xhc3NJbmRleCA9IDA7XG4gICAgbGV0IHN0YXRpY1N0eWxlc01hcDoge1trZXk6IHN0cmluZ106IGFueX18bnVsbCA9IG51bGw7XG4gICAgbGV0IHN0YXRpY0NsYXNzZXNNYXA6IHtba2V5OiBzdHJpbmddOiBib29sZWFufXxudWxsID0gbnVsbDtcbiAgICBjb25zdCBzdHlsZXNJbmRleE1hcDoge1trZXk6IHN0cmluZ106IG51bWJlcn0gPSB7fTtcbiAgICBjb25zdCBjbGFzc2VzSW5kZXhNYXA6IHtba2V5OiBzdHJpbmddOiBudW1iZXJ9ID0ge307XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob3V0cHV0QXR0cnMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG91dHB1dEF0dHJzW25hbWVdO1xuICAgICAgaWYgKG5hbWUgPT0gJ3N0eWxlJykge1xuICAgICAgICBzdGF0aWNTdHlsZXNNYXAgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICAgICAgT2JqZWN0LmtleXMoc3RhdGljU3R5bGVzTWFwKS5mb3JFYWNoKHByb3AgPT4geyBzdHlsZXNJbmRleE1hcFtwcm9wXSA9IGN1cnJTdHlsZUluZGV4Kys7IH0pO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09ICdjbGFzcycpIHtcbiAgICAgICAgc3RhdGljQ2xhc3Nlc01hcCA9IHt9O1xuICAgICAgICB2YWx1ZS5zcGxpdCgvXFxzKy9nKS5mb3JFYWNoKGNsYXNzTmFtZSA9PiB7XG4gICAgICAgICAgY2xhc3Nlc0luZGV4TWFwW2NsYXNzTmFtZV0gPSBjdXJyQ2xhc3NJbmRleCsrO1xuICAgICAgICAgIHN0YXRpY0NsYXNzZXNNYXAgIVtjbGFzc05hbWVdID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKG5hbWUpKTtcbiAgICAgICAgaWYgKGF0dHJJMThuTWV0YXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICBjb25zdCBtZXRhID0gcGFyc2VJMThuTWV0YShhdHRySTE4bk1ldGFzW25hbWVdKTtcbiAgICAgICAgICBjb25zdCB2YXJpYWJsZSA9IHRoaXMuY29uc3RhbnRQb29sLmdldFRyYW5zbGF0aW9uKHZhbHVlLCBtZXRhKTtcbiAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2godmFyaWFibGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF0dHJpYnV0ZXMucHVzaChvLmxpdGVyYWwodmFsdWUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgbGV0IGhhc01hcEJhc2VkU3R5bGluZyA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3R5bGVJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGlucHV0ID0gc3R5bGVJbnB1dHNbaV07XG4gICAgICBjb25zdCBpc01hcEJhc2VkU3R5bGVCaW5kaW5nID0gaSA9PT0gMCAmJiBpbnB1dC5uYW1lID09PSAnc3R5bGUnO1xuICAgICAgaWYgKGlzTWFwQmFzZWRTdHlsZUJpbmRpbmcpIHtcbiAgICAgICAgaGFzTWFwQmFzZWRTdHlsaW5nID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXN0eWxlc0luZGV4TWFwLmhhc093blByb3BlcnR5KGlucHV0Lm5hbWUpKSB7XG4gICAgICAgIHN0eWxlc0luZGV4TWFwW2lucHV0Lm5hbWVdID0gY3VyclN0eWxlSW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsYXNzSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnB1dCA9IGNsYXNzSW5wdXRzW2ldO1xuICAgICAgY29uc3QgaXNNYXBCYXNlZENsYXNzQmluZGluZyA9IGkgPT09IDAgJiYgaXNDbGFzc0JpbmRpbmcoaW5wdXQpO1xuICAgICAgaWYgKCFpc01hcEJhc2VkQ2xhc3NCaW5kaW5nICYmICFzdHlsZXNJbmRleE1hcC5oYXNPd25Qcm9wZXJ0eShpbnB1dC5uYW1lKSkge1xuICAgICAgICBjbGFzc2VzSW5kZXhNYXBbaW5wdXQubmFtZV0gPSBjdXJyQ2xhc3NJbmRleCsrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGluIHRoZSBldmVudCB0aGF0IGEgW3N0eWxlXSBiaW5kaW5nIGlzIHVzZWQgdGhlbiBzYW5pdGl6YXRpb24gd2lsbFxuICAgIC8vIGFsd2F5cyBiZSBpbXBvcnRlZCBiZWNhdXNlIGl0IGlzIG5vdCBwb3NzaWJsZSB0byBrbm93IGFoZWFkIG9mIHRpbWVcbiAgICAvLyB3aGV0aGVyIHN0eWxlIGJpbmRpbmdzIHdpbGwgdXNlIG9yIG5vdCB1c2UgYW55IHNhbml0aXphYmxlIHByb3BlcnRpZXNcbiAgICAvLyB0aGF0IGlzU3R5bGVTYW5pdGl6YWJsZSgpIHdpbGwgZGV0ZWN0XG4gICAgbGV0IHVzZURlZmF1bHRTdHlsZVNhbml0aXplciA9IGhhc01hcEJhc2VkU3R5bGluZztcblxuICAgIC8vIHRoaXMgd2lsbCBidWlsZCB0aGUgaW5zdHJ1Y3Rpb25zIHNvIHRoYXQgdGhleSBmYWxsIGludG8gdGhlIGZvbGxvd2luZyBzeW50YXhcbiAgICAvLyA9PiBbcHJvcDEsIHByb3AyLCBwcm9wMywgMCwgcHJvcDEsIHZhbHVlMSwgcHJvcDIsIHZhbHVlMl1cbiAgICBPYmplY3Qua2V5cyhzdHlsZXNJbmRleE1hcCkuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgIHVzZURlZmF1bHRTdHlsZVNhbml0aXplciA9IHVzZURlZmF1bHRTdHlsZVNhbml0aXplciB8fCBpc1N0eWxlU2FuaXRpemFibGUocHJvcCk7XG4gICAgICBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwocHJvcCkpO1xuICAgIH0pO1xuXG4gICAgaWYgKHN0YXRpY1N0eWxlc01hcCkge1xuICAgICAgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKGNvcmUuSW5pdGlhbFN0eWxpbmdGbGFncy5WQUxVRVNfTU9ERSkpO1xuXG4gICAgICBPYmplY3Qua2V5cyhzdGF0aWNTdHlsZXNNYXApLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChwcm9wKSk7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gc3RhdGljU3R5bGVzTWFwICFbcHJvcF07XG4gICAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbCh2YWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoY2xhc3Nlc0luZGV4TWFwKS5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHByb3ApKTtcbiAgICB9KTtcblxuICAgIGlmIChzdGF0aWNDbGFzc2VzTWFwKSB7XG4gICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwoY29yZS5Jbml0aWFsU3R5bGluZ0ZsYWdzLlZBTFVFU19NT0RFKSk7XG5cbiAgICAgIE9iamVjdC5rZXlzKHN0YXRpY0NsYXNzZXNNYXApLmZvckVhY2goY2xhc3NOYW1lID0+IHtcbiAgICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKGNsYXNzTmFtZSkpO1xuICAgICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwodHJ1ZSkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgaGFzU3R5bGluZ0luc3RydWN0aW9ucyA9IGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5sZW5ndGggfHwgc3R5bGVJbnB1dHMubGVuZ3RoIHx8XG4gICAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5sZW5ndGggfHwgY2xhc3NJbnB1dHMubGVuZ3RoO1xuXG4gICAgLy8gYWRkIGF0dHJpYnV0ZXMgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZyBwdXJwb3Nlc1xuICAgIGF0dHJpYnV0ZXMucHVzaCguLi50aGlzLnByZXBhcmVTZWxlY3RPbmx5QXR0cnMoYWxsT3RoZXJJbnB1dHMsIGVsZW1lbnQub3V0cHV0cykpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnRvQXR0cnNQYXJhbShhdHRyaWJ1dGVzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxkaXYgI2ZvbyAjYmFyPVwiYmF6XCI+KVxuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnByZXBhcmVSZWZzUGFyYW1ldGVyKGVsZW1lbnQucmVmZXJlbmNlcykpO1xuXG4gICAgY29uc3Qgd2FzSW5OYW1lc3BhY2UgPSB0aGlzLl9uYW1lc3BhY2U7XG4gICAgY29uc3QgY3VycmVudE5hbWVzcGFjZSA9IHRoaXMuZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5KTtcblxuICAgIC8vIElmIHRoZSBuYW1lc3BhY2UgaXMgY2hhbmdpbmcgbm93LCBpbmNsdWRlIGFuIGluc3RydWN0aW9uIHRvIGNoYW5nZSBpdFxuICAgIC8vIGR1cmluZyBlbGVtZW50IGNyZWF0aW9uLlxuICAgIGlmIChjdXJyZW50TmFtZXNwYWNlICE9PSB3YXNJbk5hbWVzcGFjZSkge1xuICAgICAgdGhpcy5hZGROYW1lc3BhY2VJbnN0cnVjdGlvbihjdXJyZW50TmFtZXNwYWNlLCBlbGVtZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCBpbXBsaWNpdCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcblxuICAgIGNvbnN0IGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24gPSAhaGFzU3R5bGluZ0luc3RydWN0aW9ucyAmJiAhaXNOZ0NvbnRhaW5lciAmJlxuICAgICAgICBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA9PT0gMCAmJiBlbGVtZW50Lm91dHB1dHMubGVuZ3RoID09PSAwO1xuXG4gICAgaWYgKGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnQsIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJTdGFydCA6IFIzLmVsZW1lbnRTdGFydCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICAgIC8vIGluaXRpYWwgc3R5bGluZyBmb3Igc3RhdGljIHN0eWxlPVwiLi4uXCIgYXR0cmlidXRlc1xuICAgICAgaWYgKGhhc1N0eWxpbmdJbnN0cnVjdGlvbnMpIHtcbiAgICAgICAgY29uc3QgcGFyYW1zTGlzdDogKG8uRXhwcmVzc2lvbilbXSA9IFtdO1xuXG4gICAgICAgIGlmIChpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdGhlIHRlbXBsYXRlIGNvbXBpbGVyIGhhbmRsZXMgaW5pdGlhbCBjbGFzcyBzdHlsaW5nIChlLmcuIGNsYXNzPVwiZm9vXCIpIHZhbHVlc1xuICAgICAgICAgIC8vIGluIGEgc3BlY2lhbCBjb21tYW5kIGNhbGxlZCBgZWxlbWVudENsYXNzYCBzbyB0aGF0IHRoZSBpbml0aWFsIGNsYXNzXG4gICAgICAgICAgLy8gY2FuIGJlIHByb2Nlc3NlZCBkdXJpbmcgcnVudGltZS4gVGhlc2UgaW5pdGlhbCBjbGFzcyB2YWx1ZXMgYXJlIGJvdW5kIHRvXG4gICAgICAgICAgLy8gYSBjb25zdGFudCBiZWNhdXNlIHRoZSBpbml0YWwgY2xhc3MgdmFsdWVzIGRvIG5vdCBjaGFuZ2UgKHNpbmNlIHRoZXkncmUgc3RhdGljKS5cbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goXG4gICAgICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zKSwgdHJ1ZSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5sZW5ndGggfHwgdXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyKSB7XG4gICAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAvLyB0aGUgdGVtcGxhdGUgY29tcGlsZXIgaGFuZGxlcyBpbml0aWFsIHN0eWxlIChlLmcuIHN0eWxlPVwiZm9vXCIpIHZhbHVlc1xuICAgICAgICAgIC8vIGluIGEgc3BlY2lhbCBjb21tYW5kIGNhbGxlZCBgZWxlbWVudFN0eWxlYCBzbyB0aGF0IHRoZSBpbml0aWFsIHN0eWxlc1xuICAgICAgICAgIC8vIGNhbiBiZSBwcm9jZXNzZWQgZHVyaW5nIHJ1bnRpbWUuIFRoZXNlIGluaXRpYWwgc3R5bGVzIHZhbHVlcyBhcmUgYm91bmQgdG9cbiAgICAgICAgICAvLyBhIGNvbnN0YW50IGJlY2F1c2UgdGhlIGluaXRhbCBzdHlsZSB2YWx1ZXMgZG8gbm90IGNoYW5nZSAoc2luY2UgdGhleSdyZSBzdGF0aWMpLlxuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChcbiAgICAgICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMpLCB0cnVlKSk7XG4gICAgICAgIH0gZWxzZSBpZiAodXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyKSB7XG4gICAgICAgICAgLy8gbm8gcG9pbnQgaW4gaGF2aW5nIGFuIGV4dHJhIGBudWxsYCB2YWx1ZSB1bmxlc3MgdGhlcmUgYXJlIGZvbGxvdy11cCBwYXJhbXNcbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHVzZURlZmF1bHRTdHlsZVNhbml0aXplcikge1xuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChvLmltcG9ydEV4cHIoUjMuZGVmYXVsdFN0eWxlU2FuaXRpemVyKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMuZWxlbWVudFN0eWxpbmcsIHBhcmFtc0xpc3QpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZW5lcmF0ZSBMaXN0ZW5lcnMgKG91dHB1dHMpXG4gICAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+IHtcbiAgICAgICAgY29uc3QgZWxOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKGVsZW1lbnQubmFtZSk7XG4gICAgICAgIGNvbnN0IGV2TmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihvdXRwdXRBc3QubmFtZSk7XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke2VsTmFtZX1fJHtldk5hbWV9X2xpc3RlbmVyYDtcblxuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24ob3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLCAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbGlzdGVuZXJTY29wZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5uZXN0ZWRTY29wZSh0aGlzLl9iaW5kaW5nU2NvcGUuYmluZGluZ0xldmVsKTtcblxuICAgICAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgICAgICAgICAgIGxpc3RlbmVyU2NvcGUsIGltcGxpY2l0LCBvdXRwdXRBc3QuaGFuZGxlciwgJ2InLFxuICAgICAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuXG4gICAgICAgICAgY29uc3Qgc3RhdGVtZW50cyA9IFtcbiAgICAgICAgICAgIC4uLmxpc3RlbmVyU2NvcGUucmVzdG9yZVZpZXdTdGF0ZW1lbnQoKSwgLi4ubGlzdGVuZXJTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLFxuICAgICAgICAgICAgLi4uYmluZGluZ0V4cHIucmVuZGVyM1N0bXRzXG4gICAgICAgICAgXTtcblxuICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBvLmZuKFxuICAgICAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSwgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLFxuICAgICAgICAgICAgICBmdW5jdGlvbk5hbWUpO1xuXG4gICAgICAgICAgcmV0dXJuIFtvLmxpdGVyYWwob3V0cHV0QXN0Lm5hbWUpLCBoYW5kbGVyXTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoKHN0eWxlSW5wdXRzLmxlbmd0aCB8fCBjbGFzc0lucHV0cy5sZW5ndGgpICYmIGhhc1N0eWxpbmdJbnN0cnVjdGlvbnMpIHtcbiAgICAgIGNvbnN0IGluZGV4TGl0ZXJhbCA9IG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpO1xuXG4gICAgICBjb25zdCBmaXJzdFN0eWxlID0gc3R5bGVJbnB1dHNbMF07XG4gICAgICBjb25zdCBtYXBCYXNlZFN0eWxlSW5wdXQgPSBmaXJzdFN0eWxlICYmIGZpcnN0U3R5bGUubmFtZSA9PSAnc3R5bGUnID8gZmlyc3RTdHlsZSA6IG51bGw7XG5cbiAgICAgIGNvbnN0IGZpcnN0Q2xhc3MgPSBjbGFzc0lucHV0c1swXTtcbiAgICAgIGNvbnN0IG1hcEJhc2VkQ2xhc3NJbnB1dCA9IGZpcnN0Q2xhc3MgJiYgaXNDbGFzc0JpbmRpbmcoZmlyc3RDbGFzcykgPyBmaXJzdENsYXNzIDogbnVsbDtcblxuICAgICAgY29uc3Qgc3R5bGluZ0lucHV0ID0gbWFwQmFzZWRTdHlsZUlucHV0IHx8IG1hcEJhc2VkQ2xhc3NJbnB1dDtcbiAgICAgIGlmIChzdHlsaW5nSW5wdXQpIHtcbiAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICBsZXQgdmFsdWU6IEFTVDtcbiAgICAgICAgaWYgKG1hcEJhc2VkQ2xhc3NJbnB1dCkge1xuICAgICAgICAgIHZhbHVlID0gbWFwQmFzZWRDbGFzc0lucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgfSBlbHNlIGlmIChtYXBCYXNlZFN0eWxlSW5wdXQpIHtcbiAgICAgICAgICBwYXJhbXMucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWFwQmFzZWRTdHlsZUlucHV0KSB7XG4gICAgICAgICAgdmFsdWUgPSBtYXBCYXNlZFN0eWxlSW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzdHlsaW5nSW5wdXQuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxpbmdNYXAsICgpID0+IHtcbiAgICAgICAgICBwYXJhbXMucHVzaCh0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlLCB0cnVlKSk7XG4gICAgICAgICAgcmV0dXJuIFtpbmRleExpdGVyYWwsIC4uLnBhcmFtc107XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBsZXQgbGFzdElucHV0Q29tbWFuZDogdC5Cb3VuZEF0dHJpYnV0ZXxudWxsID0gbnVsbDtcbiAgICAgIGlmIChzdHlsZUlucHV0cy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGkgPSBtYXBCYXNlZFN0eWxlSW5wdXQgPyAxIDogMDtcbiAgICAgICAgZm9yIChpOyBpIDwgc3R5bGVJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBpbnB1dCA9IHN0eWxlSW5wdXRzW2ldO1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcblxuICAgICAgICAgIGNvbnN0IGtleSA9IGlucHV0Lm5hbWU7XG4gICAgICAgICAgY29uc3Qgc3R5bGVJbmRleDogbnVtYmVyID0gc3R5bGVzSW5kZXhNYXBba2V5XSAhO1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oaW5wdXQuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxlUHJvcCwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgaW5kZXhMaXRlcmFsLCBvLmxpdGVyYWwoc3R5bGVJbmRleCksXG4gICAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUsIHRydWUpLCAuLi5wYXJhbXNcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0SW5wdXRDb21tYW5kID0gc3R5bGVJbnB1dHNbc3R5bGVJbnB1dHMubGVuZ3RoIC0gMV07XG4gICAgICB9XG5cbiAgICAgIGlmIChjbGFzc0lucHV0cy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGkgPSBtYXBCYXNlZENsYXNzSW5wdXQgPyAxIDogMDtcbiAgICAgICAgZm9yIChpOyBpIDwgY2xhc3NJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBpbnB1dCA9IGNsYXNzSW5wdXRzW2ldO1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcblxuICAgICAgICAgIGNvbnN0IGtleSA9IGlucHV0Lm5hbWU7XG4gICAgICAgICAgY29uc3QgY2xhc3NJbmRleDogbnVtYmVyID0gY2xhc3Nlc0luZGV4TWFwW2tleV0gITtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGlucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRDbGFzc1Byb3AsICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIGluZGV4TGl0ZXJhbCwgby5saXRlcmFsKGNsYXNzSW5kZXgpLFxuICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlLCB0cnVlKSwgLi4ucGFyYW1zXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdElucHV0Q29tbWFuZCA9IGNsYXNzSW5wdXRzW2NsYXNzSW5wdXRzLmxlbmd0aCAtIDFdO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGxhc3RJbnB1dENvbW1hbmQgIS5zb3VyY2VTcGFuLCBSMy5lbGVtZW50U3R5bGluZ0FwcGx5LCBbaW5kZXhMaXRlcmFsXSk7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgZWxlbWVudCBpbnB1dCBiaW5kaW5nc1xuICAgIGFsbE90aGVySW5wdXRzLmZvckVhY2goKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKSA9PiB7XG4gICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ3dhcm5pbmc6IGFuaW1hdGlvbiBiaW5kaW5ncyBub3QgeWV0IHN1cHBvcnRlZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gbWFwQmluZGluZ1RvSW5zdHJ1Y3Rpb24oaW5wdXQudHlwZSk7XG4gICAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG5cbiAgICAgICAgLy8gVE9ETyhjaHVja2opOiBydW50aW1lOiBzZWN1cml0eSBjb250ZXh0P1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oaW5wdXQuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24sICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSxcbiAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUpLCAuLi5wYXJhbXNcbiAgICAgICAgICBdO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Vuc3VwcG9ydGVkKGBiaW5kaW5nIHR5cGUgJHtpbnB1dC50eXBlfWApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVHJhdmVyc2UgZWxlbWVudCBjaGlsZCBub2Rlc1xuICAgIGlmICh0aGlzLl9pbkkxOG5TZWN0aW9uICYmIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID09IDEgJiZcbiAgICAgICAgZWxlbWVudC5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgY29uc3QgdGV4dCA9IGVsZW1lbnQuY2hpbGRyZW5bMF0gYXMgdC5UZXh0O1xuICAgICAgdGhpcy52aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dCwgaTE4bk1ldGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIH1cblxuICAgIGlmICghY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgLy8gRmluaXNoIGVsZW1lbnQgY29uc3RydWN0aW9uIG1vZGUuXG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbixcbiAgICAgICAgICBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lckVuZCA6IFIzLmVsZW1lbnRFbmQpO1xuICAgIH1cblxuICAgIC8vIFJlc3RvcmUgdGhlIHN0YXRlIGJlZm9yZSBleGl0aW5nIHRoaXMgbm9kZVxuICAgIHRoaXMuX2luSTE4blNlY3Rpb24gPSB3YXNJbkkxOG5TZWN0aW9uO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogdC5UZW1wbGF0ZSkge1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGxldCBlbE5hbWUgPSAnJztcbiAgICBpZiAodGVtcGxhdGUuY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIHRlbXBsYXRlLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICAvLyBXaGVuIHRoZSB0ZW1wbGF0ZSBhcyBhIHNpbmdsZSBjaGlsZCwgZGVyaXZlIHRoZSBjb250ZXh0IG5hbWUgZnJvbSB0aGUgdGFnXG4gICAgICBlbE5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIoKHRlbXBsYXRlLmNoaWxkcmVuWzBdIGFzIHQuRWxlbWVudCkubmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBlbE5hbWUgPyBgJHt0aGlzLmNvbnRleHROYW1lfV8ke2VsTmFtZX1gIDogJyc7XG5cbiAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPVxuICAgICAgICBjb250ZXh0TmFtZSA/IGAke2NvbnRleHROYW1lfV9UZW1wbGF0ZV8ke3RlbXBsYXRlSW5kZXh9YCA6IGBUZW1wbGF0ZV8ke3RlbXBsYXRlSW5kZXh9YDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuICAgICAgby5UWVBFRF9OVUxMX0VYUFIsXG4gICAgXTtcblxuICAgIC8vIGZpbmQgZGlyZWN0aXZlcyBtYXRjaGluZyBvbiBhIGdpdmVuIDxuZy10ZW1wbGF0ZT4gbm9kZVxuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKCduZy10ZW1wbGF0ZScsIHRlbXBsYXRlKTtcblxuICAgIC8vIHByZXBhcmUgYXR0cmlidXRlcyBwYXJhbWV0ZXIgKGluY2x1ZGluZyBhdHRyaWJ1dGVzIHVzZWQgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZylcbiAgICBjb25zdCBhdHRyc0V4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIHRlbXBsYXRlLmF0dHJpYnV0ZXMuZm9yRWFjaChcbiAgICAgICAgKGE6IHQuVGV4dEF0dHJpYnV0ZSkgPT4geyBhdHRyc0V4cHJzLnB1c2goYXNMaXRlcmFsKGEubmFtZSksIGFzTGl0ZXJhbChhLnZhbHVlKSk7IH0pO1xuICAgIGF0dHJzRXhwcnMucHVzaCguLi50aGlzLnByZXBhcmVTZWxlY3RPbmx5QXR0cnModGVtcGxhdGUuaW5wdXRzLCB0ZW1wbGF0ZS5vdXRwdXRzKSk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMudG9BdHRyc1BhcmFtKGF0dHJzRXhwcnMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPG5nLXRlbXBsYXRlICNmb28+KVxuICAgIGlmICh0ZW1wbGF0ZS5yZWZlcmVuY2VzICYmIHRlbXBsYXRlLnJlZmVyZW5jZXMubGVuZ3RoKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5wcmVwYXJlUmVmc1BhcmFtZXRlcih0ZW1wbGF0ZS5yZWZlcmVuY2VzKSk7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5pbXBvcnRFeHByKFIzLnRlbXBsYXRlUmVmRXh0cmFjdG9yKSk7XG4gICAgfVxuXG4gICAgLy8gaGFuZGxlIHByb3BlcnR5IGJpbmRpbmdzIGUuZy4gcCgxLCAnZm9yT2YnLCDJtWJpbmQoY3R4Lml0ZW1zKSk7XG4gICAgY29uc3QgY29udGV4dCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgICB0ZW1wbGF0ZS5pbnB1dHMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy5lbGVtZW50UHJvcGVydHksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSxcbiAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoY29udGV4dCwgdmFsdWUpXG4gICAgICAgIF07XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSB0aGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAgICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0ZW1wbGF0ZU5hbWUsIFtdLFxuICAgICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIsIHRoaXMuZGlyZWN0aXZlcywgdGhpcy5waXBlVHlwZUJ5TmFtZSwgdGhpcy5waXBlcywgdGhpcy5fbmFtZXNwYWNlKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbCBhZnRlciB0aGVpciBwYXJlbnQgdGVtcGxhdGVzIGhhdmUgY29tcGxldGVkXG4gICAgLy8gcHJvY2Vzc2luZywgc28gdGhleSBhcmUgcXVldWVkIGhlcmUgdW50aWwgYWZ0ZXIgdGhlIGluaXRpYWwgcGFzcy4gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndFxuICAgIC8vIGJlIGFibGUgdG8gc3VwcG9ydCBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIHRvIGxvY2FsIHJlZnMgdGhhdCBvY2N1ciBhZnRlciB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBkZWZpbml0aW9uLiBlLmcuIDxkaXYgKm5nSWY9XCJzaG93aW5nXCI+IHt7IGZvbyB9fSA8L2Rpdj4gIDxkaXYgI2Zvbz48L2Rpdj5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID1cbiAgICAgICAgICB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgfSk7XG5cbiAgICAvLyBlLmcuIHRlbXBsYXRlKDEsIE15Q29tcF9UZW1wbGF0ZV8xKVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy50ZW1wbGF0ZUNyZWF0ZSwgKCkgPT4ge1xuICAgICAgcGFyYW1ldGVycy5zcGxpY2UoXG4gICAgICAgICAgMiwgMCwgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRDb25zdENvdW50KCkpLFxuICAgICAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZVZpc2l0b3IuZ2V0VmFyQ291bnQoKSkpO1xuICAgICAgcmV0dXJuIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gVGhlc2Ugc2hvdWxkIGJlIGhhbmRsZWQgaW4gdGhlIHRlbXBsYXRlIG9yIGVsZW1lbnQgZGlyZWN0bHkuXG4gIHJlYWRvbmx5IHZpc2l0UmVmZXJlbmNlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRWYXJpYWJsZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VGV4dEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kRXZlbnQgPSBpbnZhbGlkO1xuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IHQuQm91bmRUZXh0KSB7XG4gICAgY29uc3Qgbm9kZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24odGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKG5vZGVJbmRleCldKTtcblxuICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0QmluZGluZyxcbiAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChub2RlSW5kZXgpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoby52YXJpYWJsZShDT05URVhUX05BTUUpLCB2YWx1ZSldKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIG8ubGl0ZXJhbCh0ZXh0LnZhbHVlKV0pO1xuICB9XG5cbiAgLy8gV2hlbiB0aGUgY29udGVudCBvZiB0aGUgZWxlbWVudCBpcyBhIHNpbmdsZSB0ZXh0IG5vZGUgdGhlIHRyYW5zbGF0aW9uIGNhbiBiZSBpbmxpbmVkOlxuICAvL1xuICAvLyBgPHAgaTE4bj1cImRlc2N8bWVhblwiPnNvbWUgY29udGVudDwvcD5gXG4gIC8vIGNvbXBpbGVzIHRvXG4gIC8vIGBgYFxuICAvLyAvKipcbiAgLy8gKiBAZGVzYyBkZXNjXG4gIC8vICogQG1lYW5pbmcgbWVhblxuICAvLyAqL1xuICAvLyBjb25zdCBNU0dfWFlaID0gZ29vZy5nZXRNc2coJ3NvbWUgY29udGVudCcpO1xuICAvLyBpMC7JtXRleHQoMSwgTVNHX1hZWik7XG4gIC8vIGBgYFxuICB2aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dDogdC5UZXh0LCBpMThuTWV0YTogc3RyaW5nKSB7XG4gICAgY29uc3QgbWV0YSA9IHBhcnNlSTE4bk1ldGEoaTE4bk1ldGEpO1xuICAgIGNvbnN0IHZhcmlhYmxlID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0VHJhbnNsYXRpb24odGV4dC52YWx1ZSwgbWV0YSk7XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCB2YXJpYWJsZV0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7IH1cblxuICBnZXRDb25zdENvdW50KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4OyB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7IHJldHVybiB0aGlzLl9wdXJlRnVuY3Rpb25TbG90czsgfVxuXG4gIHByaXZhdGUgYmluZGluZ0NvbnRleHQoKSB7IHJldHVybiBgJHt0aGlzLl9iaW5kaW5nQ29udGV4dCsrfWA7IH1cblxuICAvLyBCaW5kaW5ncyBtdXN0IG9ubHkgYmUgcmVzb2x2ZWQgYWZ0ZXIgYWxsIGxvY2FsIHJlZnMgaGF2ZSBiZWVuIHZpc2l0ZWQsIHNvIGFsbFxuICAvLyBpbnN0cnVjdGlvbnMgYXJlIHF1ZXVlZCBpbiBjYWxsYmFja3MgdGhhdCBleGVjdXRlIG9uY2UgdGhlIGluaXRpYWwgcGFzcyBoYXMgY29tcGxldGVkLlxuICAvLyBPdGhlcndpc2UsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gc3VwcG9ydCBsb2NhbCByZWZzIHRoYXQgYXJlIGRlZmluZWQgYWZ0ZXIgdGhlaXJcbiAgLy8gYmluZGluZ3MuIGUuZy4ge3sgZm9vIH19IDxkaXYgI2Zvbz48L2Rpdj5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbkZuKFxuICAgICAgZm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10sIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuOiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKTogdm9pZCB7XG4gICAgZm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShwYXJhbXNPckZuKSA/IHBhcmFtc09yRm4gOiBwYXJhbXNPckZuKCk7XG4gICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24oc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXMpLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX2NyZWF0aW9uQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90czogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHM7XG4gICAgcmV0dXJuIG9yaWdpbmFsU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlOiBBU1QpIHtcbiAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdDogby5FeHByZXNzaW9uLCB2YWx1ZTogQVNULCBza2lwQmluZEZuPzogYm9vbGVhbik6XG4gICAgICBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGludGVycG9sYXRpb25GbiA9XG4gICAgICAgIHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiA/IGludGVycG9sYXRlIDogKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpO1xuXG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgdGhpcywgaW1wbGljaXQsIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSwgaW50ZXJwb2xhdGlvbkZuKTtcbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uY29udmVydGVkUHJvcGVydHlCaW5kaW5nLnN0bXRzKTtcblxuICAgIGNvbnN0IHZhbEV4cHIgPSBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG4gICAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiB8fCBza2lwQmluZEZuID8gdmFsRXhwciA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLmJpbmQpLmNhbGxGbihbdmFsRXhwcl0pO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaERpcmVjdGl2ZXModGFnTmFtZTogc3RyaW5nLCBlbE9yVHBsOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSkge1xuICAgIGlmICh0aGlzLmRpcmVjdGl2ZU1hdGNoZXIpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IodGFnTmFtZSwgdGhpcy5nZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGwpKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhlbE9yVHBsOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSk6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSB7XG4gICAgY29uc3QgYXR0cmlidXRlc01hcDoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cbiAgICBlbE9yVHBsLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICAgIGlmICghaXNJMThOQXR0cmlidXRlKGEubmFtZSkpIHtcbiAgICAgICAgYXR0cmlidXRlc01hcFthLm5hbWVdID0gYS52YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBlbE9yVHBsLmlucHV0cy5mb3JFYWNoKGkgPT4geyBhdHRyaWJ1dGVzTWFwW2kubmFtZV0gPSAnJzsgfSk7XG4gICAgZWxPclRwbC5vdXRwdXRzLmZvckVhY2gobyA9PiB7IGF0dHJpYnV0ZXNNYXBbby5uYW1lXSA9ICcnOyB9KTtcblxuICAgIHJldHVybiBhdHRyaWJ1dGVzTWFwO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlU2VsZWN0T25seUF0dHJzKGlucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdLCBvdXRwdXRzOiB0LkJvdW5kRXZlbnRbXSk6XG4gICAgICBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgaWYgKGlucHV0cy5sZW5ndGggfHwgb3V0cHV0cy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5TZWxlY3RPbmx5KSk7XG4gICAgICBpbnB1dHMuZm9yRWFjaCgoaTogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4geyBhdHRyRXhwcnMucHVzaChhc0xpdGVyYWwoaS5uYW1lKSk7IH0pO1xuICAgICAgb3V0cHV0cy5mb3JFYWNoKChvOiB0LkJvdW5kRXZlbnQpID0+IHsgYXR0ckV4cHJzLnB1c2goYXNMaXRlcmFsKG8ubmFtZSkpOyB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXR0ckV4cHJzO1xuICB9XG5cbiAgcHJpdmF0ZSB0b0F0dHJzUGFyYW0oYXR0cnNFeHByczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIHJldHVybiBhdHRyc0V4cHJzLmxlbmd0aCA+IDAgP1xuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGF0dHJzRXhwcnMpLCB0cnVlKSA6XG4gICAgICAgIG8uVFlQRURfTlVMTF9FWFBSO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlUmVmc1BhcmFtZXRlcihyZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKTogby5FeHByZXNzaW9uIHtcbiAgICBpZiAoIXJlZmVyZW5jZXMgfHwgcmVmZXJlbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBvLlRZUEVEX05VTExfRVhQUjtcbiAgICB9XG5cbiAgICBjb25zdCByZWZzUGFyYW0gPSBmbGF0dGVuKHJlZmVyZW5jZXMubWFwKHJlZmVyZW5jZSA9PiB7XG4gICAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICAvLyBHZW5lcmF0ZSB0aGUgdXBkYXRlIHRlbXBvcmFyeS5cbiAgICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUodmFyaWFibGVOYW1lKTtcbiAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQoXG4gICAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHJlZmVyZW5jZS5uYW1lLCBsaHMsIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgICAgICAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAvLyBlLmcuIHgoMik7XG4gICAgICAgICAgICBjb25zdCBuZXh0Q29udGV4dFN0bXQgPVxuICAgICAgICAgICAgICAgIHJlbGF0aXZlTGV2ZWwgPiAwID8gW2dlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpLnRvU3RtdCgpXSA6IFtdO1xuXG4gICAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRmb28kID0gcigxKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZkV4cHIgPSBsaHMuc2V0KG8uaW1wb3J0RXhwcihSMy5yZWZlcmVuY2UpLmNhbGxGbihbby5saXRlcmFsKHNsb3QpXSkpO1xuICAgICAgICAgICAgcmV0dXJuIG5leHRDb250ZXh0U3RtdC5jb25jYXQocmVmRXhwci50b0NvbnN0RGVjbCgpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIHJldHVybiBbcmVmZXJlbmNlLm5hbWUsIHJlZmVyZW5jZS52YWx1ZV07XG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocmVmc1BhcmFtKSwgdHJ1ZSk7XG4gIH1cbn1cblxuY2xhc3MgVmFsdWVDb252ZXJ0ZXIgZXh0ZW5kcyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciB7XG4gIHByaXZhdGUgX3BpcGVCaW5kRXhwcnM6IEZ1bmN0aW9uQ2FsbFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwcml2YXRlIGFsbG9jYXRlU2xvdDogKCkgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBkZWZpbmVQaXBlOlxuICAgICAgICAgIChuYW1lOiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBzbG90OiBudW1iZXIsIHZhbHVlOiBvLkV4cHJlc3Npb24pID0+IHZvaWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLy8gQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXJcbiAgdmlzaXRQaXBlKHBpcGU6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIC8vIEFsbG9jYXRlIGEgc2xvdCB0byBjcmVhdGUgdGhlIHBpcGVcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZVNsb3QoKTtcbiAgICBjb25zdCBzbG90UHNldWRvTG9jYWwgPSBgUElQRToke3Nsb3R9YDtcbiAgICAvLyBBbGxvY2F0ZSBvbmUgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIG9uZSBzbG90IHBlciBwaXBlIGFyZ3VtZW50XG4gICAgY29uc3QgcHVyZUZ1bmN0aW9uU2xvdCA9IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cygyICsgcGlwZS5hcmdzLmxlbmd0aCk7XG4gICAgY29uc3QgdGFyZ2V0ID0gbmV3IFByb3BlcnR5UmVhZChwaXBlLnNwYW4sIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHBpcGUuc3BhbiksIHNsb3RQc2V1ZG9Mb2NhbCk7XG4gICAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHBpcGVCaW5kaW5nQ2FsbEluZm8ocGlwZS5hcmdzKTtcbiAgICB0aGlzLmRlZmluZVBpcGUocGlwZS5uYW1lLCBzbG90UHNldWRvTG9jYWwsIHNsb3QsIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKSk7XG4gICAgY29uc3QgYXJnczogQVNUW10gPSBbcGlwZS5leHAsIC4uLnBpcGUuYXJnc107XG4gICAgY29uc3QgY29udmVydGVkQXJnczogQVNUW10gPVxuICAgICAgICBpc1Zhckxlbmd0aCA/IHRoaXMudmlzaXRBbGwoW25ldyBMaXRlcmFsQXJyYXkocGlwZS5zcGFuLCBhcmdzKV0pIDogdGhpcy52aXNpdEFsbChhcmdzKTtcblxuICAgIGNvbnN0IHBpcGVCaW5kRXhwciA9IG5ldyBGdW5jdGlvbkNhbGwocGlwZS5zcGFuLCB0YXJnZXQsIFtcbiAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3Bhbiwgc2xvdCksXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHB1cmVGdW5jdGlvblNsb3QpLFxuICAgICAgLi4uY29udmVydGVkQXJncyxcbiAgICBdKTtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLnB1c2gocGlwZUJpbmRFeHByKTtcbiAgICByZXR1cm4gcGlwZUJpbmRFeHByO1xuICB9XG5cbiAgdXBkYXRlUGlwZVNsb3RPZmZzZXRzKGJpbmRpbmdTbG90czogbnVtYmVyKSB7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5mb3JFYWNoKChwaXBlOiBGdW5jdGlvbkNhbGwpID0+IHtcbiAgICAgIC8vIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXQgYXJnIChpbmRleCAxKSB0byBhY2NvdW50IGZvciBiaW5kaW5nIHNsb3RzXG4gICAgICBjb25zdCBzbG90T2Zmc2V0ID0gcGlwZS5hcmdzWzFdIGFzIExpdGVyYWxQcmltaXRpdmU7XG4gICAgICAoc2xvdE9mZnNldC52YWx1ZSBhcyBudW1iZXIpICs9IGJpbmRpbmdTbG90cztcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKGFycmF5LnNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID9cbiAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmdDYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5waXBlQmluZFYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcblxuZnVuY3Rpb24gcHVyZUZ1bmN0aW9uQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnB1cmVGdW5jdGlvblYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnN0cnVjdGlvbihcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLy8gZS5nLiB4KDIpO1xuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbERpZmY6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMubmV4dENvbnRleHQpXG4gICAgICAuY2FsbEZuKHJlbGF0aXZlTGV2ZWxEaWZmID4gMSA/IFtvLmxpdGVyYWwocmVsYXRpdmVMZXZlbERpZmYpXSA6IFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwciB8IG8uTGl0ZXJhbE1hcEV4cHIsXG4gICAgYWxsb2NhdGVTbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICAvLyBBbGxvY2F0ZSAxIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyAxIHBlciBhcmd1bWVudFxuICBjb25zdCBzdGFydFNsb3QgPSBhbGxvY2F0ZVNsb3RzKDEgKyBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGgpO1xuICBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGggPiAwIHx8IGVycm9yKGBFeHBlY3RlZCBhcmd1bWVudHMgdG8gYSBsaXRlcmFsIGZhY3RvcnkgZnVuY3Rpb25gKTtcbiAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHB1cmVGdW5jdGlvbkNhbGxJbmZvKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcblxuICAvLyBMaXRlcmFsIGZhY3RvcmllcyBhcmUgcHVyZSBmdW5jdGlvbnMgdGhhdCBvbmx5IG5lZWQgdG8gYmUgcmUtaW52b2tlZCB3aGVuIHRoZSBwYXJhbWV0ZXJzXG4gIC8vIGNoYW5nZS5cbiAgY29uc3QgYXJncyA9IFtcbiAgICBvLmxpdGVyYWwoc3RhcnRTbG90KSxcbiAgICBsaXRlcmFsRmFjdG9yeSxcbiAgXTtcblxuICBpZiAoaXNWYXJMZW5ndGgpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsQXJyKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKSk7XG4gIH0gZWxzZSB7XG4gICAgYXJncy5wdXNoKC4uLmxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikuY2FsbEZuKGFyZ3MpO1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHdoaWNoIGlzIGV4ZWN1dGVkIHdoZW5ldmVyIGEgdmFyaWFibGUgaXMgcmVmZXJlbmNlZCBmb3IgdGhlIGZpcnN0IHRpbWUgaW4gYSBnaXZlblxuICogc2NvcGUuXG4gKlxuICogSXQgaXMgZXhwZWN0ZWQgdGhhdCB0aGUgZnVuY3Rpb24gY3JlYXRlcyB0aGUgYGNvbnN0IGxvY2FsTmFtZSA9IGV4cHJlc3Npb25gOyBzdGF0ZW1lbnQuXG4gKi9cbmV4cG9ydCB0eXBlIERlY2xhcmVMb2NhbFZhckNhbGxiYWNrID0gKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4gby5TdGF0ZW1lbnRbXTtcblxuLyoqIFRoZSBwcmVmaXggdXNlZCB0byBnZXQgYSBzaGFyZWQgY29udGV4dCBpbiBCaW5kaW5nU2NvcGUncyBtYXAuICovXG5jb25zdCBTSEFSRURfQ09OVEVYVF9LRVkgPSAnJCRzaGFyZWRfY3R4JCQnO1xuXG4vKipcbiAqIFRoaXMgaXMgdXNlZCB3aGVuIG9uZSByZWZlcnMgdG8gdmFyaWFibGUgc3VjaCBhczogJ2xldCBhYmMgPSB4KDIpLiRpbXBsaWNpdGAuXG4gKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gKiAtIHZhbHVlIGByZXRyaWV2YWxMZXZlbGAgaXMgdGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkLCB3aGljaCBpcyAyIGxldmVsc1xuICogdXAgaW4gZXhhbXBsZS5cbiAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gKiAtIHZhbHVlIGBkZWNsYXJlTG9jYWxDYWxsYmFja2AgaXMgYSBjYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiBkZWNsYXJpbmcgdGhlIGxvY2FsLlxuICogLSB2YWx1ZSBgZGVjbGFyZWAgaXMgdHJ1ZSBpZiB0aGlzIHZhbHVlIG5lZWRzIHRvIGJlIGRlY2xhcmVkLlxuICogLSB2YWx1ZSBgcHJpb3JpdHlgIGRpY3RhdGVzIHRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyIGRlY2xhcmF0aW9uIGNvbXBhcmVkXG4gKiB0byBvdGhlciB2YXIgZGVjbGFyYXRpb25zIG9uIHRoZSBzYW1lIHJldHJpZXZhbCBsZXZlbC4gRm9yIGV4YW1wbGUsIGlmIHRoZXJlIGlzIGFcbiAqIGNvbnRleHQgdmFyaWFibGUgYW5kIGEgbG9jYWwgcmVmIGFjY2Vzc2luZyB0aGUgc2FtZSBwYXJlbnQgdmlldywgdGhlIGNvbnRleHQgdmFyXG4gKiBkZWNsYXJhdGlvbiBzaG91bGQgYWx3YXlzIGNvbWUgYmVmb3JlIHRoZSBsb2NhbCByZWYgZGVjbGFyYXRpb24uXG4gKi9cbnR5cGUgQmluZGluZ0RhdGEgPSB7XG4gIHJldHJpZXZhbExldmVsOiBudW1iZXI7IGxoczogby5SZWFkVmFyRXhwcjsgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaztcbiAgZGVjbGFyZTogYm9vbGVhbjtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbn07XG5cbi8qKlxuICogVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgYSBsb2NhbCB2YXJpYWJsZSBkZWNsYXJhdGlvbi4gSGlnaGVyIG51bWJlcnNcbiAqIG1lYW4gdGhlIGRlY2xhcmF0aW9uIHdpbGwgYXBwZWFyIGZpcnN0IGluIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuY29uc3QgZW51bSBEZWNsYXJhdGlvblByaW9yaXR5IHsgREVGQVVMVCA9IDAsIENPTlRFWFQgPSAxLCBTSEFSRURfQ09OVEVYVCA9IDIgfVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBCaW5kaW5nRGF0YS4gKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ0RhdGE+KCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcbiAgcHJpdmF0ZSByZXN0b3JlVmlld1ZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuXG4gIHN0YXRpYyBST09UX1NDT1BFID0gbmV3IEJpbmRpbmdTY29wZSgpLnNldCgwLCAnJGV2ZW50Jywgby52YXJpYWJsZSgnJGV2ZW50JykpO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocHVibGljIGJpbmRpbmdMZXZlbDogbnVtYmVyID0gMCwgcHJpdmF0ZSBwYXJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCkge31cblxuICBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGN1cnJlbnQubWFwLmdldChuYW1lKTtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSB0aGlzKSB7XG4gICAgICAgICAgLy8gbWFrZSBhIGxvY2FsIGNvcHkgYW5kIHJlc2V0IHRoZSBgZGVjbGFyZWAgc3RhdGVcbiAgICAgICAgICB2YWx1ZSA9IHtcbiAgICAgICAgICAgIHJldHJpZXZhbExldmVsOiB2YWx1ZS5yZXRyaWV2YWxMZXZlbCxcbiAgICAgICAgICAgIGxoczogdmFsdWUubGhzLFxuICAgICAgICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICAgICAgICBwcmlvcml0eTogdmFsdWUucHJpb3JpdHlcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQ2FjaGUgdGhlIHZhbHVlIGxvY2FsbHkuXG4gICAgICAgICAgdGhpcy5tYXAuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAvLyBQb3NzaWJseSBnZW5lcmF0ZSBhIHNoYXJlZCBjb250ZXh0IHZhclxuICAgICAgICAgIHRoaXMubWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUpO1xuICAgICAgICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldyh2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgJiYgIXZhbHVlLmRlY2xhcmUpIHtcbiAgICAgICAgICB2YWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCB0byB0aGlzIHBvaW50LCB3ZSBhcmUgbG9va2luZyBmb3IgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wIGxldmVsIGNvbXBvbmVudFxuICAgIC8vIC0gSWYgbGV2ZWwgPT09IDAsIHdlIGFyZSBvbiB0aGUgdG9wIGFuZCBkb24ndCBuZWVkIHRvIHJlLWRlY2xhcmUgYGN0eGAuXG4gICAgLy8gLSBJZiBsZXZlbCA+IDAsIHdlIGFyZSBpbiBhbiBlbWJlZGRlZCB2aWV3LiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGxvY2FsIHZhciB3ZSB1c2VkIHRvIHN0b3JlIHRoZSBjb21wb25lbnQgY29udGV4dCwgZS5nLiBjb25zdCAkY29tcCQgPSB4KCk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ0xldmVsID09PSAwID8gbnVsbCA6IHRoaXMuZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbG9jYWwgdmFyaWFibGUgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHJldHJpZXZhbExldmVsIFRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZFxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHByaW9yaXR5IFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyXG4gICAqIEBwYXJhbSBkZWNsYXJlTG9jYWxDYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIHdoZW4gZGVjbGFyaW5nIHRoaXMgbG9jYWwgdmFyXG4gICAqL1xuICBzZXQocmV0cmlldmFsTGV2ZWw6IG51bWJlciwgbmFtZTogc3RyaW5nLCBsaHM6IG8uUmVhZFZhckV4cHIsXG4gICAgICBwcmlvcml0eTogbnVtYmVyID0gRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayk6IEJpbmRpbmdTY29wZSB7XG4gICAgIXRoaXMubWFwLmhhcyhuYW1lKSB8fFxuICAgICAgICBlcnJvcihgVGhlIG5hbWUgJHtuYW1lfSBpcyBhbHJlYWR5IGRlZmluZWQgaW4gc2NvcGUgdG8gYmUgJHt0aGlzLm1hcC5nZXQobmFtZSl9YCk7XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHlcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IChvLkV4cHJlc3Npb258bnVsbCkgeyByZXR1cm4gdGhpcy5nZXQobmFtZSk7IH1cblxuICBuZXN0ZWRTY29wZShsZXZlbDogbnVtYmVyKTogQmluZGluZ1Njb3BlIHtcbiAgICBjb25zdCBuZXdTY29wZSA9IG5ldyBCaW5kaW5nU2NvcGUobGV2ZWwsIHRoaXMpO1xuICAgIGlmIChsZXZlbCA+IDApIG5ld1Njb3BlLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgICByZXR1cm4gbmV3U2NvcGU7XG4gIH1cblxuICBnZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwcnxudWxsIHtcbiAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwpO1xuICAgIHJldHVybiBzaGFyZWRDdHhPYmogJiYgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPyBzaGFyZWRDdHhPYmoubGhzIDogbnVsbDtcbiAgfVxuXG4gIG1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlOiBCaW5kaW5nRGF0YSkge1xuICAgIGlmICh2YWx1ZS5wcmlvcml0eSA9PT0gRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhUKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSB4KDIpO1xuICAgICAgICByZXR1cm4gW2xocy5zZXQoZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgfSxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgcHJpb3JpdHk6IERlY2xhcmF0aW9uUHJpb3JpdHkuU0hBUkVEX0NPTlRFWFRcbiAgICB9KTtcbiAgfVxuXG4gIGdldENvbXBvbmVudFByb3BlcnR5KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29tcG9uZW50VmFsdWUgPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgMCkgITtcbiAgICBjb21wb25lbnRWYWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcoMCk7XG4gICAgcmV0dXJuIGNvbXBvbmVudFZhbHVlLmxocy5wcm9wKG5hbWUpO1xuICB9XG5cbiAgbWF5YmVSZXN0b3JlVmlldyhyZXRyaWV2YWxMZXZlbDogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuaXNMaXN0ZW5lclNjb3BlKCkgJiYgcmV0cmlldmFsTGV2ZWwgPCB0aGlzLmJpbmRpbmdMZXZlbCkge1xuICAgICAgaWYgKCF0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUpIHtcbiAgICAgICAgLy8gcGFyZW50IHNhdmVzIHZhcmlhYmxlIHRvIGdlbmVyYXRlIGEgc2hhcmVkIGBjb25zdCAkcyQgPSBnVigpO2AgaW5zdHJ1Y3Rpb25cbiAgICAgICAgdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLnBhcmVudCAhLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA9IHRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZTtcbiAgICB9XG4gIH1cblxuICByZXN0b3JlVmlld1N0YXRlbWVudCgpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyByVigkc3RhdGUkKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW2luc3RydWN0aW9uKG51bGwsIFIzLnJlc3RvcmVWaWV3LCBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlXSkudG9TdG10KCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICB2aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIGNvbnN0ICRzdGF0ZSQgPSBnVigpO1xuICAgIGNvbnN0IGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24gPSBpbnN0cnVjdGlvbihudWxsLCBSMy5nZXRDdXJyZW50VmlldywgW10pO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlLnNldChnZXRDdXJyZW50Vmlld0luc3RydWN0aW9uKS50b0NvbnN0RGVjbCgpXSA6XG4gICAgICAgIFtdO1xuICB9XG5cbiAgaXNMaXN0ZW5lclNjb3BlKCkgeyByZXR1cm4gdGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQuYmluZGluZ0xldmVsID09PSB0aGlzLmJpbmRpbmdMZXZlbDsgfVxuXG4gIHZhcmlhYmxlRGVjbGFyYXRpb25zKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGxldCBjdXJyZW50Q29udGV4dExldmVsID0gMDtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLm1hcC52YWx1ZXMoKSlcbiAgICAgICAgLmZpbHRlcih2YWx1ZSA9PiB2YWx1ZS5kZWNsYXJlKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXRyaWV2YWxMZXZlbCAtIGEucmV0cmlldmFsTGV2ZWwgfHwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpXG4gICAgICAgIC5yZWR1Y2UoKHN0bXRzOiBvLlN0YXRlbWVudFtdLCB2YWx1ZTogQmluZGluZ0RhdGEpID0+IHtcbiAgICAgICAgICBjb25zdCBsZXZlbERpZmYgPSB0aGlzLmJpbmRpbmdMZXZlbCAtIHZhbHVlLnJldHJpZXZhbExldmVsO1xuICAgICAgICAgIGNvbnN0IGN1cnJTdG10cyA9IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICEodGhpcywgbGV2ZWxEaWZmIC0gY3VycmVudENvbnRleHRMZXZlbCk7XG4gICAgICAgICAgY3VycmVudENvbnRleHRMZXZlbCA9IGxldmVsRGlmZjtcbiAgICAgICAgICByZXR1cm4gc3RtdHMuY29uY2F0KGN1cnJTdG10cyk7XG4gICAgICAgIH0sIFtdKSBhcyBvLlN0YXRlbWVudFtdO1xuICB9XG5cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZ2l2ZW4gYSB0YWcgbmFtZSBhbmQgYSBtYXAgb2YgYXR0cmlidXRlc1xuICovXG5mdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3Rvcih0YWc6IHN0cmluZywgYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuXG4gIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQodGFnKTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8vIFBhcnNlIGkxOG4gbWV0YXMgbGlrZTpcbi8vIC0gXCJAQGlkXCIsXG4vLyAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbi8vIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbmZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEoaTE4bj86IHN0cmluZyk6IHtkZXNjcmlwdGlvbj86IHN0cmluZywgaWQ/OiBzdHJpbmcsIG1lYW5pbmc/OiBzdHJpbmd9IHtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGlkOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGlmIChpMThuKSB7XG4gICAgLy8gVE9ETyh2aWNiKTogZmlndXJlIG91dCBob3cgdG8gZm9yY2UgYSBtZXNzYWdlIElEIHdpdGggY2xvc3VyZSA/XG4gICAgY29uc3QgaWRJbmRleCA9IGkxOG4uaW5kZXhPZihJRF9TRVBBUkFUT1IpO1xuXG4gICAgY29uc3QgZGVzY0luZGV4ID0gaTE4bi5pbmRleE9mKE1FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGlkXSA9XG4gICAgICAgIChpZEluZGV4ID4gLTEpID8gW2kxOG4uc2xpY2UoMCwgaWRJbmRleCksIGkxOG4uc2xpY2UoaWRJbmRleCArIDIpXSA6IFtpMThuLCAnJ107XG4gICAgW21lYW5pbmcsIGRlc2NyaXB0aW9uXSA9IChkZXNjSW5kZXggPiAtMSkgP1xuICAgICAgICBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldIDpcbiAgICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2Rlc2NyaXB0aW9uLCBpZCwgbWVhbmluZ307XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgYXJncyA9IGFyZ3Muc2xpY2UoMSk7ICAvLyBJZ25vcmUgdGhlIGxlbmd0aCBwcmVmaXggYWRkZWQgZm9yIHJlbmRlcjJcbiAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjEpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24yKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjQpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb242KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjcpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uOCkuY2FsbEZuKGFyZ3MpO1xuICB9XG4gIChhcmdzLmxlbmd0aCA+PSAxOSAmJiBhcmdzLmxlbmd0aCAlIDIgPT0gMSkgfHxcbiAgICAgIGVycm9yKGBJbnZhbGlkIGludGVycG9sYXRpb24gYXJndW1lbnQgbGVuZ3RoICR7YXJncy5sZW5ndGh9YCk7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvblYpLmNhbGxGbihbby5saXRlcmFsQXJyKGFyZ3MpXSk7XG59XG5cbi8qKlxuICogUGFyc2UgYSB0ZW1wbGF0ZSBpbnRvIHJlbmRlcjMgYE5vZGVgcyBhbmQgYWRkaXRpb25hbCBtZXRhZGF0YSwgd2l0aCBubyBvdGhlciBkZXBlbmRlbmNpZXMuXG4gKlxuICogQHBhcmFtIHRlbXBsYXRlIHRleHQgb2YgdGhlIHRlbXBsYXRlIHRvIHBhcnNlXG4gKiBAcGFyYW0gdGVtcGxhdGVVcmwgVVJMIHRvIHVzZSBmb3Igc291cmNlIG1hcHBpbmcgb2YgdGhlIHBhcnNlZCB0ZW1wbGF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiB7cHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW59ID0ge30pOlxuICAgIHtlcnJvcnM/OiBQYXJzZUVycm9yW10sIG5vZGVzOiB0Lk5vZGVbXSwgaGFzTmdDb250ZW50OiBib29sZWFuLCBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdfSB7XG4gIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcbiAgY29uc3QgcGFyc2VSZXN1bHQgPSBodG1sUGFyc2VyLnBhcnNlKHRlbXBsYXRlLCB0ZW1wbGF0ZVVybCk7XG5cbiAgaWYgKHBhcnNlUmVzdWx0LmVycm9ycyAmJiBwYXJzZVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7ZXJyb3JzOiBwYXJzZVJlc3VsdC5lcnJvcnMsIG5vZGVzOiBbXSwgaGFzTmdDb250ZW50OiBmYWxzZSwgbmdDb250ZW50U2VsZWN0b3JzOiBbXX07XG4gIH1cblxuICBsZXQgcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IHBhcnNlUmVzdWx0LnJvb3ROb2RlcztcbiAgaWYgKCFvcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZXMpIHtcbiAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKG5ldyBXaGl0ZXNwYWNlVmlzaXRvcigpLCByb290Tm9kZXMpO1xuICB9XG5cbiAgY29uc3Qge25vZGVzLCBoYXNOZ0NvbnRlbnQsIG5nQ29udGVudFNlbGVjdG9ycywgZXJyb3JzfSA9XG4gICAgICBodG1sQXN0VG9SZW5kZXIzQXN0KHJvb3ROb2RlcywgYmluZGluZ1BhcnNlcik7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9ycywgbm9kZXM6IFtdLCBoYXNOZ0NvbnRlbnQ6IGZhbHNlLCBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdfTtcbiAgfVxuXG4gIHJldHVybiB7bm9kZXMsIGhhc05nQ29udGVudCwgbmdDb250ZW50U2VsZWN0b3JzfTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBgQmluZGluZ1BhcnNlcmAgd2l0aCBhIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VCaW5kaW5nUGFyc2VyKCk6IEJpbmRpbmdQYXJzZXIge1xuICByZXR1cm4gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICBuZXcgUGFyc2VyKG5ldyBMZXhlcigpKSwgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpLCBudWxsLFxuICAgICAgW10pO1xufVxuXG5mdW5jdGlvbiBpc0NsYXNzQmluZGluZyhpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gaW5wdXQubmFtZSA9PSAnY2xhc3NOYW1lJyB8fCBpbnB1dC5uYW1lID09ICdjbGFzcyc7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTYW5pdGl6YXRpb25GbihpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgY29udGV4dDogY29yZS5TZWN1cml0eUNvbnRleHQpIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlID8gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU3R5bGUpIDogbnVsbDtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVJlc291cmNlVXJsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTdHlsZVNhbml0aXphYmxlKHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBzd2l0Y2ggKHByb3ApIHtcbiAgICBjYXNlICdiYWNrZ3JvdW5kLWltYWdlJzpcbiAgICBjYXNlICdiYWNrZ3JvdW5kJzpcbiAgICBjYXNlICdib3JkZXItaW1hZ2UnOlxuICAgIGNhc2UgJ2ZpbHRlcic6XG4gICAgY2FzZSAnbGlzdC1zdHlsZSc6XG4gICAgY2FzZSAnbGlzdC1zdHlsZS1pbWFnZSc6XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iXX0=