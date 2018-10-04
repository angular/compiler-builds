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
        define("@angular/compiler/src/render3/view/template", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/expression_parser/lexer", "@angular/compiler/src/expression_parser/parser", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_parser", "@angular/compiler/src/ml_parser/html_whitespaces", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/schema/dom_element_schema_registry", "@angular/compiler/src/selector", "@angular/compiler/src/template_parser/binding_parser", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/r3_template_transform", "@angular/compiler/src/render3/view/styling", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var expression_converter_1 = require("@angular/compiler/src/compiler_util/expression_converter");
    var core = require("@angular/compiler/src/core");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var lexer_1 = require("@angular/compiler/src/expression_parser/lexer");
    var parser_1 = require("@angular/compiler/src/expression_parser/parser");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var html_parser_1 = require("@angular/compiler/src/ml_parser/html_parser");
    var html_whitespaces_1 = require("@angular/compiler/src/ml_parser/html_whitespaces");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var o = require("@angular/compiler/src/output/output_ast");
    var dom_element_schema_registry_1 = require("@angular/compiler/src/schema/dom_element_schema_registry");
    var selector_1 = require("@angular/compiler/src/selector");
    var binding_parser_1 = require("@angular/compiler/src/template_parser/binding_parser");
    var util_1 = require("@angular/compiler/src/util");
    var t = require("@angular/compiler/src/render3/r3_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var r3_template_transform_1 = require("@angular/compiler/src/render3/r3_template_transform");
    var styling_1 = require("@angular/compiler/src/render3/view/styling");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    function mapBindingToInstruction(type) {
        switch (type) {
            case 0 /* Property */:
                return r3_identifiers_1.Identifiers.elementProperty;
            case 2 /* Class */:
                return r3_identifiers_1.Identifiers.elementClassProp;
            case 1 /* Attribute */:
            case 4 /* Animation */:
                return r3_identifiers_1.Identifiers.elementAttribute;
            default:
                return undefined;
        }
    }
    //  if (rf & flags) { .. }
    function renderFlagCheckIfStmt(flags, statements) {
        return o.ifStmt(o.variable(util_2.RENDER_FLAGS).bitwiseAnd(o.literal(flags), null, false), statements);
    }
    exports.renderFlagCheckIfStmt = renderFlagCheckIfStmt;
    var TemplateDefinitionBuilder = /** @class */ (function () {
        function TemplateDefinitionBuilder(constantPool, parentBindingScope, level, contextName, templateName, viewQueries, directiveMatcher, directives, pipeTypeByName, pipes, _namespace, relativeContextFilePath) {
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
            this.relativeContextFilePath = relativeContextFilePath;
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
            this._unsupported = util_2.unsupported;
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
            this.visitReference = util_2.invalid;
            this.visitVariable = util_2.invalid;
            this.visitTextAttribute = util_2.invalid;
            this.visitBoundAttribute = util_2.invalid;
            this.visitBoundEvent = util_2.invalid;
            // view queries can take up space in data and allocation happens earlier (in the "viewQuery"
            // function)
            this._dataIndex = viewQueries.length;
            this._bindingScope = parentBindingScope.nestedScope(level);
            // Turn the relative context file path into an identifier by replacing non-alphanumeric
            // characters with underscores.
            this.fileBasedI18nSuffix = relativeContextFilePath.replace(/[^A-Za-z0-9]/g, '_') + '_';
            this._valueConverter = new ValueConverter(constantPool, function () { return _this.allocateDataSlot(); }, function (numSlots) { return _this.allocatePureFunctionSlots(numSlots); }, function (name, localName, slot, value) {
                var pipeType = pipeTypeByName.get(name);
                if (pipeType) {
                    _this.pipes.add(pipeType);
                }
                _this._bindingScope.set(_this.level, localName, value);
                _this.creationInstruction(null, r3_identifiers_1.Identifiers.pipe, [o.literal(slot), o.literal(name)]);
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
                    rhs = o.variable(util_2.CONTEXT_NAME);
                }
                else {
                    var sharedCtxVar = scope.getSharedContextName(retrievalLevel);
                    // e.g. ctx_r0   OR  x(2);
                    rhs = sharedCtxVar ? sharedCtxVar : generateNextContextExpr(relativeLevel);
                }
                // e.g. const $item$ = x(2).$implicit;
                return [lhs.set(rhs.prop(variable.value || util_2.IMPLICIT_REFERENCE)).toConstDecl()];
            });
        };
        TemplateDefinitionBuilder.prototype.buildTemplateFunction = function (nodes, variables, hasNgContent, ngContentSelectors) {
            var _this = this;
            if (hasNgContent === void 0) { hasNgContent = false; }
            if (ngContentSelectors === void 0) { ngContentSelectors = []; }
            var e_1, _a;
            if (this._namespace !== r3_identifiers_1.Identifiers.namespaceHTML) {
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
                    var parsed = this.constantPool.getConstLiteral(util_2.asLiteral(r3Selectors), true);
                    var unParsed = this.constantPool.getConstLiteral(util_2.asLiteral(ngContentSelectors), true);
                    parameters.push(parsed, unParsed);
                }
                this.creationInstruction(null, r3_identifiers_1.Identifiers.projectionDef, parameters);
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
                        var phMap = o.variable(scopedName).set(util_2.mapToExpression(phToNodeIdx, true)).toConstDecl();
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
            [new o.FnParam(util_2.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_2.CONTEXT_NAME, null)], tslib_1.__spread(this._prefixCode, creationBlock, updateBlock), o.INFERRED_TYPE, null, this.templateName);
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
                parameters.push(o.literal(selectorIndex), util_2.asLiteral(attributeAsList));
            }
            else if (selectorIndex !== 0) {
                parameters.push(o.literal(selectorIndex));
            }
            this.creationInstruction(ngContent.sourceSpan, r3_identifiers_1.Identifiers.projection, parameters);
        };
        TemplateDefinitionBuilder.prototype.getNamespaceInstruction = function (namespaceKey) {
            switch (namespaceKey) {
                case 'math':
                    return r3_identifiers_1.Identifiers.namespaceMathML;
                case 'svg':
                    return r3_identifiers_1.Identifiers.namespaceSVG;
                default:
                    return r3_identifiers_1.Identifiers.namespaceHTML;
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
            var _b = tslib_1.__read(tags_1.splitNsName(element.name), 2), namespaceKey = _b[0], elementName = _b[1];
            var isNgContainer = tags_1.isNgContainer(element.name);
            // Elements inside i18n sections are replaced with placeholders
            // TODO(vicb): nested elements are a WIP in this phase
            if (this._inI18nSection) {
                var phName = element.name.toLowerCase();
                if (!this._phToNodeIdxes[this._i18nSectionIndex][phName]) {
                    this._phToNodeIdxes[this._i18nSectionIndex][phName] = [];
                }
                this._phToNodeIdxes[this._i18nSectionIndex][phName].push(elementIndex);
            }
            var isNonBindableMode = false;
            try {
                // Handle i18n attributes
                for (var _c = tslib_1.__values(element.attributes), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var attr = _d.value;
                    var name_1 = attr.name;
                    var value = attr.value;
                    if (name_1 === util_2.NON_BINDABLE_ATTR) {
                        isNonBindableMode = true;
                    }
                    else if (name_1 === util_2.I18N_ATTR) {
                        if (this._inI18nSection) {
                            throw new Error("Could not mark an element as translatable inside of a translatable section");
                        }
                        this._inI18nSection = true;
                        this._i18nSectionIndex++;
                        this._phToNodeIdxes[this._i18nSectionIndex] = {};
                        i18nMeta = value;
                    }
                    else if (name_1.startsWith(util_2.I18N_ATTR_PREFIX)) {
                        attrI18nMetas[name_1.slice(util_2.I18N_ATTR_PREFIX.length)] = value;
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
                    staticStylesMap = styling_1.parseStyle(value);
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
                        var variable = _this.constantPool.getTranslation(value, meta, _this.fileBasedI18nSuffix);
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
            attributes.push.apply(attributes, tslib_1.__spread(this.prepareSyntheticAndSelectOnlyAttrs(allOtherInputs, element.outputs)));
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
            var implicit = o.variable(util_2.CONTEXT_NAME);
            var createSelfClosingInstruction = !hasStylingInstructions && !isNgContainer &&
                element.children.length === 0 && element.outputs.length === 0;
            if (createSelfClosingInstruction) {
                this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.element, util_2.trimTrailingNulls(parameters));
            }
            else {
                this.creationInstruction(element.sourceSpan, isNgContainer ? r3_identifiers_1.Identifiers.elementContainerStart : r3_identifiers_1.Identifiers.elementStart, util_2.trimTrailingNulls(parameters));
                if (isNonBindableMode) {
                    this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.disableBindings);
                }
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
                        paramsList.push(o.importExpr(r3_identifiers_1.Identifiers.defaultStyleSanitizer));
                    }
                    this.creationInstruction(null, r3_identifiers_1.Identifiers.elementStyling, paramsList);
                }
                // Generate Listeners (outputs)
                element.outputs.forEach(function (outputAst) {
                    _this.creationInstruction(outputAst.sourceSpan, r3_identifiers_1.Identifiers.listener, _this.prepareListenerParameter(element.name, outputAst));
                });
            }
            if ((styleInputs.length || classInputs.length) && hasStylingInstructions) {
                var indexLiteral_1 = o.literal(elementIndex);
                var firstStyle = styleInputs[0];
                var mapBasedStyleInput_1 = firstStyle && firstStyle.name == 'style' ? firstStyle : null;
                var firstClass = classInputs[0];
                var mapBasedClassInput_1 = firstClass && isClassBinding(firstClass) ? firstClass : null;
                var stylingInput = mapBasedStyleInput_1 || mapBasedClassInput_1;
                if (stylingInput) {
                    this.updateInstruction(stylingInput.sourceSpan, r3_identifiers_1.Identifiers.elementStylingMap, function () {
                        var params = [indexLiteral_1];
                        if (mapBasedClassInput_1) {
                            var mapBasedClassValue = mapBasedClassInput_1.value.visit(_this._valueConverter);
                            params.push(_this.convertPropertyBinding(implicit, mapBasedClassValue, true));
                        }
                        else if (mapBasedStyleInput_1) {
                            params.push(o.NULL_EXPR);
                        }
                        if (mapBasedStyleInput_1) {
                            var mapBasedStyleValue = mapBasedStyleInput_1.value.visit(_this._valueConverter);
                            params.push(_this.convertPropertyBinding(implicit, mapBasedStyleValue, true));
                        }
                        return params;
                    });
                }
                var lastInputCommand = null;
                if (styleInputs.length) {
                    var i = mapBasedStyleInput_1 ? 1 : 0;
                    var _loop_1 = function () {
                        var input = styleInputs[i];
                        var params = [];
                        var sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                        if (sanitizationRef)
                            params.push(sanitizationRef);
                        var key = input.name;
                        var styleIndex = stylesIndexMap[key];
                        var value = input.value.visit(this_1._valueConverter);
                        this_1.updateInstruction(input.sourceSpan, r3_identifiers_1.Identifiers.elementStyleProp, function () {
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
                    var i = mapBasedClassInput_1 ? 1 : 0;
                    var _loop_2 = function () {
                        var input = classInputs[i];
                        var params = [];
                        var sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                        if (sanitizationRef)
                            params.push(sanitizationRef);
                        var key = input.name;
                        var classIndex = classesIndexMap[key];
                        var value = input.value.visit(this_2._valueConverter);
                        this_2.updateInstruction(input.sourceSpan, r3_identifiers_1.Identifiers.elementClassProp, function () {
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
                this.updateInstruction(lastInputCommand.sourceSpan, r3_identifiers_1.Identifiers.elementStylingApply, [indexLiteral_1]);
            }
            // Generate element input bindings
            allOtherInputs.forEach(function (input) {
                var instruction = mapBindingToInstruction(input.type);
                if (input.type === 4 /* Animation */) {
                    var value_1 = input.value.visit(_this._valueConverter);
                    // setAttribute without a value doesn't make any sense
                    if (value_1.name || value_1.value) {
                        var name_2 = prepareSyntheticAttributeName(input.name);
                        _this.updateInstruction(input.sourceSpan, r3_identifiers_1.Identifiers.elementAttribute, function () {
                            return [
                                o.literal(elementIndex), o.literal(name_2), _this.convertPropertyBinding(implicit, value_1)
                            ];
                        });
                    }
                }
                else if (instruction) {
                    var params_1 = [];
                    var sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                    if (sanitizationRef)
                        params_1.push(sanitizationRef);
                    // TODO(chuckj): runtime: security context
                    var value_2 = input.value.visit(_this._valueConverter);
                    _this.allocateBindingSlots(value_2);
                    _this.updateInstruction(input.sourceSpan, instruction, function () {
                        return tslib_1.__spread([
                            o.literal(elementIndex), o.literal(input.name),
                            _this.convertPropertyBinding(implicit, value_2)
                        ], params_1);
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
                if (isNonBindableMode) {
                    this.creationInstruction(element.endSourceSpan || element.sourceSpan, r3_identifiers_1.Identifiers.enableBindings);
                }
                this.creationInstruction(element.endSourceSpan || element.sourceSpan, isNgContainer ? r3_identifiers_1.Identifiers.elementContainerEnd : r3_identifiers_1.Identifiers.elementEnd);
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
                elName = compile_metadata_1.sanitizeIdentifier(template.children[0].name);
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
            template.attributes.forEach(function (a) { attrsExprs.push(util_2.asLiteral(a.name), util_2.asLiteral(a.value)); });
            attrsExprs.push.apply(attrsExprs, tslib_1.__spread(this.prepareSyntheticAndSelectOnlyAttrs(template.inputs, template.outputs)));
            parameters.push(this.toAttrsParam(attrsExprs));
            // local refs (ex.: <ng-template #foo>)
            if (template.references && template.references.length) {
                parameters.push(this.prepareRefsParameter(template.references));
                parameters.push(o.importExpr(r3_identifiers_1.Identifiers.templateRefExtractor));
            }
            // handle property bindings e.g. p(1, 'forOf', ɵbind(ctx.items));
            var context = o.variable(util_2.CONTEXT_NAME);
            template.inputs.forEach(function (input) {
                var value = input.value.visit(_this._valueConverter);
                _this.allocateBindingSlots(value);
                _this.updateInstruction(template.sourceSpan, r3_identifiers_1.Identifiers.elementProperty, function () {
                    return [
                        o.literal(templateIndex), o.literal(input.name),
                        _this.convertPropertyBinding(context, value)
                    ];
                });
            });
            // Create the template function
            var templateVisitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, templateName, [], this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes, this._namespace, this.fileBasedI18nSuffix);
            // Nested templates must not be visited until after their parent templates have completed
            // processing, so they are queued here until after the initial pass. Otherwise, we wouldn't
            // be able to support bindings in nested templates to local refs that occur after the
            // template definition. e.g. <div *ngIf="showing"> {{ foo }} </div>  <div #foo></div>
            this._nestedTemplateFns.push(function () {
                var templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables);
                _this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(templateName, null));
            });
            // e.g. template(1, MyComp_Template_1)
            this.creationInstruction(template.sourceSpan, r3_identifiers_1.Identifiers.templateCreate, function () {
                parameters.splice(2, 0, o.literal(templateVisitor.getConstCount()), o.literal(templateVisitor.getVarCount()));
                return util_2.trimTrailingNulls(parameters);
            });
            // Generate listeners for directive output
            template.outputs.forEach(function (outputAst) {
                _this.creationInstruction(outputAst.sourceSpan, r3_identifiers_1.Identifiers.listener, _this.prepareListenerParameter('ng_template', outputAst));
            });
        };
        TemplateDefinitionBuilder.prototype.visitBoundText = function (text) {
            var _this = this;
            var nodeIndex = this.allocateDataSlot();
            this.creationInstruction(text.sourceSpan, r3_identifiers_1.Identifiers.text, [o.literal(nodeIndex)]);
            var value = text.value.visit(this._valueConverter);
            this.allocateBindingSlots(value);
            this.updateInstruction(text.sourceSpan, r3_identifiers_1.Identifiers.textBinding, function () { return [o.literal(nodeIndex), _this.convertPropertyBinding(o.variable(util_2.CONTEXT_NAME), value)]; });
        };
        TemplateDefinitionBuilder.prototype.visitText = function (text) {
            this.creationInstruction(text.sourceSpan, r3_identifiers_1.Identifiers.text, [o.literal(this.allocateDataSlot()), o.literal(text.value)]);
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
            var variable = this.constantPool.getTranslation(text.value, meta, this.fileBasedI18nSuffix);
            this.creationInstruction(text.sourceSpan, r3_identifiers_1.Identifiers.text, [o.literal(this.allocateDataSlot()), variable]);
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
            this._bindingSlots += value instanceof ast_1.Interpolation ? value.expressions.length : 1;
        };
        TemplateDefinitionBuilder.prototype.convertPropertyBinding = function (implicit, value, skipBindFn) {
            var _a;
            var interpolationFn = value instanceof ast_1.Interpolation ? interpolate : function () { return util_1.error('Unexpected interpolation'); };
            var convertedPropertyBinding = expression_converter_1.convertPropertyBinding(this, implicit, value, this.bindingContext(), expression_converter_1.BindingForm.TrySimple, interpolationFn);
            (_a = this._tempVariables).push.apply(_a, tslib_1.__spread(convertedPropertyBinding.stmts));
            var valExpr = convertedPropertyBinding.currValExpr;
            return value instanceof ast_1.Interpolation || skipBindFn ? valExpr :
                o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([valExpr]);
        };
        TemplateDefinitionBuilder.prototype.matchDirectives = function (tagName, elOrTpl) {
            var _this = this;
            if (this.directiveMatcher) {
                var selector = createCssSelector(tagName, util_2.getAttrsForDirectiveMatching(elOrTpl));
                this.directiveMatcher.match(selector, function (cssSelector, staticType) { _this.directives.add(staticType); });
            }
        };
        TemplateDefinitionBuilder.prototype.prepareSyntheticAndSelectOnlyAttrs = function (inputs, outputs) {
            var attrExprs = [];
            var nonSyntheticInputs = [];
            if (inputs.length) {
                var EMPTY_STRING_EXPR_1 = util_2.asLiteral('');
                inputs.forEach(function (input) {
                    if (input.type === 4 /* Animation */) {
                        // @attributes are for Renderer2 animation @triggers, but this feature
                        // may be supported differently in future versions of angular. However,
                        // @triggers should always just be treated as regular attributes (it's up
                        // to the renderer to detect and use them in a special way).
                        attrExprs.push(util_2.asLiteral(prepareSyntheticAttributeName(input.name)), EMPTY_STRING_EXPR_1);
                    }
                    else {
                        nonSyntheticInputs.push(input);
                    }
                });
            }
            if (nonSyntheticInputs.length || outputs.length) {
                attrExprs.push(o.literal(1 /* SelectOnly */));
                nonSyntheticInputs.forEach(function (i) { return attrExprs.push(util_2.asLiteral(i.name)); });
                outputs.forEach(function (o) { return attrExprs.push(util_2.asLiteral(o.name)); });
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
            var refsParam = compile_metadata_1.flatten(references.map(function (reference) {
                var slot = _this.allocateDataSlot();
                // Generate the update temporary.
                var variableName = _this._bindingScope.freshReferenceName();
                var retrievalLevel = _this.level;
                var lhs = o.variable(variableName);
                _this._bindingScope.set(retrievalLevel, reference.name, lhs, 0 /* DEFAULT */, function (scope, relativeLevel) {
                    // e.g. x(2);
                    var nextContextStmt = relativeLevel > 0 ? [generateNextContextExpr(relativeLevel).toStmt()] : [];
                    // e.g. const $foo$ = r(1);
                    var refExpr = lhs.set(o.importExpr(r3_identifiers_1.Identifiers.reference).callFn([o.literal(slot)]));
                    return nextContextStmt.concat(refExpr.toConstDecl());
                });
                return [reference.name, reference.value];
            }));
            return this.constantPool.getConstLiteral(util_2.asLiteral(refsParam), true);
        };
        TemplateDefinitionBuilder.prototype.prepareListenerParameter = function (tagName, outputAst) {
            var _this = this;
            var evNameSanitized = compile_metadata_1.sanitizeIdentifier(outputAst.name);
            var tagNameSanitized = compile_metadata_1.sanitizeIdentifier(tagName);
            var functionName = this.templateName + "_" + tagNameSanitized + "_" + evNameSanitized + "_listener";
            return function () {
                var listenerScope = _this._bindingScope.nestedScope(_this._bindingScope.bindingLevel);
                var bindingExpr = expression_converter_1.convertActionBinding(listenerScope, o.variable(util_2.CONTEXT_NAME), outputAst.handler, 'b', function () { return util_1.error('Unexpected interpolation'); });
                var statements = tslib_1.__spread(listenerScope.restoreViewStatement(), listenerScope.variableDeclarations(), bindingExpr.render3Stmts);
                var handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], statements, o.INFERRED_TYPE, null, functionName);
                return [o.literal(outputAst.name), handler];
            };
        };
        return TemplateDefinitionBuilder;
    }());
    exports.TemplateDefinitionBuilder = TemplateDefinitionBuilder;
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
            var target = new ast_1.PropertyRead(pipe.span, new ast_1.ImplicitReceiver(pipe.span), slotPseudoLocal);
            var _a = pipeBindingCallInfo(pipe.args), identifier = _a.identifier, isVarLength = _a.isVarLength;
            this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(identifier));
            var args = tslib_1.__spread([pipe.exp], pipe.args);
            var convertedArgs = isVarLength ? this.visitAll([new ast_1.LiteralArray(pipe.span, args)]) : this.visitAll(args);
            var pipeBindExpr = new ast_1.FunctionCall(pipe.span, target, tslib_1.__spread([
                new ast_1.LiteralPrimitive(pipe.span, slot),
                new ast_1.LiteralPrimitive(pipe.span, pureFunctionSlot)
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
            return new expression_converter_1.BuiltinFunctionCall(array.span, this.visitAll(array.expressions), function (values) {
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
            return new expression_converter_1.BuiltinFunctionCall(map.span, this.visitAll(map.values), function (values) {
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
    }(ast_1.AstMemoryEfficientTransformer));
    exports.ValueConverter = ValueConverter;
    // Pipes always have at least one parameter, the value they operate on
    var pipeBindingIdentifiers = [r3_identifiers_1.Identifiers.pipeBind1, r3_identifiers_1.Identifiers.pipeBind2, r3_identifiers_1.Identifiers.pipeBind3, r3_identifiers_1.Identifiers.pipeBind4];
    function pipeBindingCallInfo(args) {
        var identifier = pipeBindingIdentifiers[args.length];
        return {
            identifier: identifier || r3_identifiers_1.Identifiers.pipeBindV,
            isVarLength: !identifier,
        };
    }
    var pureFunctionIdentifiers = [
        r3_identifiers_1.Identifiers.pureFunction0, r3_identifiers_1.Identifiers.pureFunction1, r3_identifiers_1.Identifiers.pureFunction2, r3_identifiers_1.Identifiers.pureFunction3, r3_identifiers_1.Identifiers.pureFunction4,
        r3_identifiers_1.Identifiers.pureFunction5, r3_identifiers_1.Identifiers.pureFunction6, r3_identifiers_1.Identifiers.pureFunction7, r3_identifiers_1.Identifiers.pureFunction8
    ];
    function pureFunctionCallInfo(args) {
        var identifier = pureFunctionIdentifiers[args.length];
        return {
            identifier: identifier || r3_identifiers_1.Identifiers.pureFunctionV,
            isVarLength: !identifier,
        };
    }
    function instruction(span, reference, params) {
        return o.importExpr(reference, null, span).callFn(params, span);
    }
    // e.g. x(2);
    function generateNextContextExpr(relativeLevelDiff) {
        return o.importExpr(r3_identifiers_1.Identifiers.nextContext)
            .callFn(relativeLevelDiff > 1 ? [o.literal(relativeLevelDiff)] : []);
    }
    function getLiteralFactory(constantPool, literal, allocateSlots) {
        var _a = constantPool.getLiteralFactory(literal), literalFactory = _a.literalFactory, literalFactoryArguments = _a.literalFactoryArguments;
        // Allocate 1 slot for the result plus 1 per argument
        var startSlot = allocateSlots(1 + literalFactoryArguments.length);
        literalFactoryArguments.length > 0 || util_1.error("Expected arguments to a literal factory function");
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
        Object.defineProperty(BindingScope, "ROOT_SCOPE", {
            get: function () {
                if (!BindingScope._ROOT_SCOPE) {
                    BindingScope._ROOT_SCOPE = new BindingScope().set(0, '$event', o.variable('$event'));
                }
                return BindingScope._ROOT_SCOPE;
            },
            enumerable: true,
            configurable: true
        });
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
                util_1.error("The name " + name + " is already defined in scope to be " + this.map.get(name));
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
            var lhs = o.variable(util_2.CONTEXT_NAME + this.freshReferenceName());
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
                [instruction(null, r3_identifiers_1.Identifiers.restoreView, [this.restoreViewVariable]).toStmt()] :
                [];
        };
        BindingScope.prototype.viewSnapshotStatements = function () {
            // const $state$ = gV();
            var getCurrentViewInstruction = instruction(null, r3_identifiers_1.Identifiers.getCurrentView, []);
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
            var ref = "" + util_2.REFERENCE_PREFIX + current.referenceNameIndex++;
            return ref;
        };
        return BindingScope;
    }());
    exports.BindingScope = BindingScope;
    /**
     * Creates a `CssSelector` given a tag name and a map of attributes
     */
    function createCssSelector(tag, attributes) {
        var cssSelector = new selector_1.CssSelector();
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
            var idIndex = i18n.indexOf(util_2.ID_SEPARATOR);
            var descIndex = i18n.indexOf(util_2.MEANING_SEPARATOR);
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
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation1).callFn(args);
            case 5:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation2).callFn(args);
            case 7:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation3).callFn(args);
            case 9:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation4).callFn(args);
            case 11:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation5).callFn(args);
            case 13:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation6).callFn(args);
            case 15:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation7).callFn(args);
            case 17:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation8).callFn(args);
        }
        (args.length >= 19 && args.length % 2 == 1) ||
            util_1.error("Invalid interpolation argument length " + args.length);
        return o.importExpr(r3_identifiers_1.Identifiers.interpolationV).callFn([o.literalArr(args)]);
    }
    /**
     * Parse a template into render3 `Node`s and additional metadata, with no other dependencies.
     *
     * @param template text of the template to parse
     * @param templateUrl URL to use for source mapping of the parsed template
     */
    function parseTemplate(template, templateUrl, options, relativeContextFilePath) {
        if (options === void 0) { options = {}; }
        var bindingParser = makeBindingParser();
        var htmlParser = new html_parser_1.HtmlParser();
        var parseResult = htmlParser.parse(template, templateUrl);
        if (parseResult.errors && parseResult.errors.length > 0) {
            return {
                errors: parseResult.errors,
                nodes: [],
                hasNgContent: false,
                ngContentSelectors: [], relativeContextFilePath: relativeContextFilePath
            };
        }
        var rootNodes = parseResult.rootNodes;
        if (!options.preserveWhitespaces) {
            rootNodes = html.visitAll(new html_whitespaces_1.WhitespaceVisitor(), rootNodes);
        }
        var _a = r3_template_transform_1.htmlAstToRender3Ast(rootNodes, bindingParser), nodes = _a.nodes, hasNgContent = _a.hasNgContent, ngContentSelectors = _a.ngContentSelectors, errors = _a.errors;
        if (errors && errors.length > 0) {
            return {
                errors: errors,
                nodes: [],
                hasNgContent: false,
                ngContentSelectors: [], relativeContextFilePath: relativeContextFilePath
            };
        }
        return { nodes: nodes, hasNgContent: hasNgContent, ngContentSelectors: ngContentSelectors, relativeContextFilePath: relativeContextFilePath };
    }
    exports.parseTemplate = parseTemplate;
    /**
     * Construct a `BindingParser` with a default configuration.
     */
    function makeBindingParser() {
        return new binding_parser_1.BindingParser(new parser_1.Parser(new lexer_1.Lexer()), interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG, new dom_element_schema_registry_1.DomElementSchemaRegistry(), null, []);
    }
    exports.makeBindingParser = makeBindingParser;
    function isClassBinding(input) {
        return input.name == 'className' || input.name == 'class';
    }
    function resolveSanitizationFn(input, context) {
        switch (context) {
            case core.SecurityContext.HTML:
                return o.importExpr(r3_identifiers_1.Identifiers.sanitizeHtml);
            case core.SecurityContext.SCRIPT:
                return o.importExpr(r3_identifiers_1.Identifiers.sanitizeScript);
            case core.SecurityContext.STYLE:
                // the compiler does not fill in an instruction for [style.prop?] binding
                // values because the style algorithm knows internally what props are subject
                // to sanitization (only [attr.style] values are explicitly sanitized)
                return input.type === 1 /* Attribute */ ? o.importExpr(r3_identifiers_1.Identifiers.sanitizeStyle) : null;
            case core.SecurityContext.URL:
                return o.importExpr(r3_identifiers_1.Identifiers.sanitizeUrl);
            case core.SecurityContext.RESOURCE_URL:
                return o.importExpr(r3_identifiers_1.Identifiers.sanitizeResourceUrl);
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
    function prepareSyntheticAttributeName(name) {
        return '@' + name;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUFtRTtJQUNuRSxpR0FBdUo7SUFFdkosaURBQW1DO0lBQ25DLG1FQUFrTjtJQUNsTix1RUFBb0Q7SUFDcEQseUVBQXNEO0lBQ3RELDBEQUE0QztJQUM1QywyRUFBdUQ7SUFDdkQscUZBQW1FO0lBQ25FLDZGQUFrRjtJQUNsRiw2REFBc0Y7SUFDdEYsMkRBQTZDO0lBRTdDLHdHQUFrRjtJQUNsRiwyREFBNEQ7SUFDNUQsdUZBQW1FO0lBQ25FLG1EQUFpQztJQUNqQyx3REFBK0I7SUFDL0IsK0VBQW9EO0lBQ3BELDZGQUE2RDtJQUc3RCxzRUFBcUM7SUFDckMsZ0VBQTZSO0lBRTdSLFNBQVMsdUJBQXVCLENBQUMsSUFBaUI7UUFDaEQsUUFBUSxJQUFJLEVBQUU7WUFDWjtnQkFDRSxPQUFPLDRCQUFFLENBQUMsZUFBZSxDQUFDO1lBQzVCO2dCQUNFLE9BQU8sNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztZQUM3Qix1QkFBMkI7WUFDM0I7Z0JBQ0UsT0FBTyw0QkFBRSxDQUFDLGdCQUFnQixDQUFDO1lBQzdCO2dCQUNFLE9BQU8sU0FBUyxDQUFDO1NBQ3BCO0lBQ0gsQ0FBQztJQUVELDBCQUEwQjtJQUMxQixTQUFnQixxQkFBcUIsQ0FDakMsS0FBdUIsRUFBRSxVQUF5QjtRQUNwRCxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQkFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2xHLENBQUM7SUFIRCxzREFHQztJQUVEO1FBK0NFLG1DQUNZLFlBQTBCLEVBQUUsa0JBQWdDLEVBQVUsS0FBUyxFQUMvRSxXQUF3QixFQUFVLFlBQXlCLEVBQzNELFdBQThCLEVBQVUsZ0JBQXNDLEVBQzlFLFVBQTZCLEVBQVUsY0FBeUMsRUFDaEYsS0FBd0IsRUFBVSxVQUErQixFQUNqRSx1QkFBK0I7WUFMdUMsc0JBQUEsRUFBQSxTQUFTO1lBRDNGLGlCQTRCQztZQTNCVyxpQkFBWSxHQUFaLFlBQVksQ0FBYztZQUE0QyxVQUFLLEdBQUwsS0FBSyxDQUFJO1lBQy9FLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1lBQVUsaUJBQVksR0FBWixZQUFZLENBQWE7WUFDM0QsZ0JBQVcsR0FBWCxXQUFXLENBQW1CO1lBQVUscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFzQjtZQUM5RSxlQUFVLEdBQVYsVUFBVSxDQUFtQjtZQUFVLG1CQUFjLEdBQWQsY0FBYyxDQUEyQjtZQUNoRixVQUFLLEdBQUwsS0FBSyxDQUFtQjtZQUFVLGVBQVUsR0FBVixVQUFVLENBQXFCO1lBQ2pFLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBUTtZQXBEbkMsZUFBVSxHQUFHLENBQUMsQ0FBQztZQUNmLG9CQUFlLEdBQUcsQ0FBQyxDQUFDO1lBQ3BCLGdCQUFXLEdBQWtCLEVBQUUsQ0FBQztZQUN4Qzs7OztlQUlHO1lBQ0sscUJBQWdCLEdBQTBCLEVBQUUsQ0FBQztZQUNyRDs7OztlQUlHO1lBQ0ssbUJBQWMsR0FBMEIsRUFBRSxDQUFDO1lBQ25ELG9GQUFvRjtZQUM1RSxtQkFBYyxHQUFrQixFQUFFLENBQUM7WUFDM0M7Ozs7O2VBS0c7WUFDSyx1QkFBa0IsR0FBbUIsRUFBRSxDQUFDO1lBT3hDLGlCQUFZLEdBQUcsa0JBQVcsQ0FBQztZQUVuQyxzRkFBc0Y7WUFDOUUsbUJBQWMsR0FBWSxLQUFLLENBQUM7WUFDaEMsc0JBQWlCLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDL0IsbUVBQW1FO1lBQzNELG1CQUFjLEdBQW1DLENBQUMsRUFBRSxDQUFDLENBQUM7WUFFOUQsK0NBQStDO1lBQ3ZDLHVCQUFrQixHQUFHLENBQUMsQ0FBQztZQUUvQiwwQkFBMEI7WUFDbEIsa0JBQWEsR0FBRyxDQUFDLENBQUM7WUFtcEIxQiwrREFBK0Q7WUFDdEQsbUJBQWMsR0FBRyxjQUFPLENBQUM7WUFDekIsa0JBQWEsR0FBRyxjQUFPLENBQUM7WUFDeEIsdUJBQWtCLEdBQUcsY0FBTyxDQUFDO1lBQzdCLHdCQUFtQixHQUFHLGNBQU8sQ0FBQztZQUM5QixvQkFBZSxHQUFHLGNBQU8sQ0FBQztZQTdvQmpDLDRGQUE0RjtZQUM1RixZQUFZO1lBQ1osSUFBSSxDQUFDLFVBQVUsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO1lBRXJDLElBQUksQ0FBQyxhQUFhLEdBQUcsa0JBQWtCLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRTNELHVGQUF1RjtZQUN2RiwrQkFBK0I7WUFDL0IsSUFBSSxDQUFDLG1CQUFtQixHQUFHLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO1lBRXZGLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxjQUFjLENBQ3JDLFlBQVksRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLGdCQUFnQixFQUFFLEVBQXZCLENBQXVCLEVBQzNDLFVBQUMsUUFBZ0IsSUFBSyxPQUFBLEtBQUksQ0FBQyx5QkFBeUIsQ0FBQyxRQUFRLENBQUMsRUFBeEMsQ0FBd0MsRUFDOUQsVUFBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxLQUFvQjtnQkFDMUMsSUFBTSxRQUFRLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDMUMsSUFBSSxRQUFRLEVBQUU7b0JBQ1osS0FBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7aUJBQzFCO2dCQUNELEtBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEtBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUNyRCxLQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLDRCQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5RSxDQUFDLENBQUMsQ0FBQztRQUNULENBQUM7UUFFRCw0REFBd0IsR0FBeEIsVUFBeUIsUUFBb0I7WUFDM0MsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQzNELElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDbEMsSUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQyxDQUFDO1lBQ25ELElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUNsQixjQUFjLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxHQUFHLG1CQUNsQyxVQUFDLEtBQW1CLEVBQUUsYUFBcUI7Z0JBQ3pDLElBQUksR0FBaUIsQ0FBQztnQkFDdEIsSUFBSSxLQUFLLENBQUMsWUFBWSxLQUFLLGNBQWMsRUFBRTtvQkFDekMsV0FBVztvQkFDWCxHQUFHLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQkFBWSxDQUFDLENBQUM7aUJBQ2hDO3FCQUFNO29CQUNMLElBQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztvQkFDaEUsMEJBQTBCO29CQUMxQixHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO2lCQUM1RTtnQkFDRCxzQ0FBc0M7Z0JBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssSUFBSSx5QkFBa0IsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUNqRixDQUFDLENBQUMsQ0FBQztRQUNULENBQUM7UUFFRCx5REFBcUIsR0FBckIsVUFDSSxLQUFlLEVBQUUsU0FBdUIsRUFBRSxZQUE2QixFQUN2RSxrQkFBaUM7WUFGckMsaUJBd0ZDO1lBdkY2Qyw2QkFBQSxFQUFBLG9CQUE2QjtZQUN2RSxtQ0FBQSxFQUFBLHVCQUFpQzs7WUFDbkMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLDRCQUFFLENBQUMsYUFBYSxFQUFFO2dCQUN4QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUNqRDtZQUVELDJCQUEyQjtZQUMzQixTQUFTLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsS0FBSSxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFoQyxDQUFnQyxDQUFDLENBQUM7WUFFekQsNEVBQTRFO1lBQzVFLElBQUksWUFBWSxFQUFFO2dCQUNoQixJQUFNLFVBQVUsR0FBbUIsRUFBRSxDQUFDO2dCQUV0Qyx3REFBd0Q7Z0JBQ3hELElBQUksa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtvQkFDakMsSUFBTSxXQUFXLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQyxFQUFqQyxDQUFpQyxDQUFDLENBQUM7b0JBQ25GLHVFQUF1RTtvQkFDdkUsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsZ0JBQVMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDL0UsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsZ0JBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUN4RixVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztpQkFDbkM7Z0JBRUQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSw0QkFBRSxDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQzthQUM5RDtZQUVELGdGQUFnRjtZQUNoRixvRkFBb0Y7WUFDcEYsc0ZBQXNGO1lBQ3RGLHdGQUF3RjtZQUN4RixDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUV4QixtRkFBbUY7WUFDbkYsaUZBQWlGO1lBQ2pGLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDO1lBRTlDLG9GQUFvRjtZQUNwRixrRkFBa0Y7WUFDbEYsMkJBQTJCO1lBQzNCLElBQUksQ0FBQyxlQUFlLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBRS9ELGdGQUFnRjtZQUNoRix1RUFBdUU7WUFDdkUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxVQUFBLGVBQWUsSUFBSSxPQUFBLGVBQWUsRUFBRSxFQUFqQixDQUFpQixDQUFDLENBQUM7WUFFdEUsbUZBQW1GO1lBQ25GLElBQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxVQUFDLEVBQXFCLElBQUssT0FBQSxFQUFFLEVBQUUsRUFBSixDQUFJLENBQUMsQ0FBQztZQUV0RixxRkFBcUY7WUFDckYsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxVQUFDLEVBQXFCLElBQUssT0FBQSxFQUFFLEVBQUUsRUFBSixDQUFJLENBQUMsQ0FBQztZQUVsRix1RkFBdUY7WUFDdkYseUZBQXlGO1lBQ3pGLElBQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1lBQ3RFLElBQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBRTlGLElBQU0sYUFBYSxHQUFHLGtCQUFrQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDakQsQ0FBQyxxQkFBcUIsaUJBQ08saUJBQWlCLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdFLEVBQUUsQ0FBQztZQUVQLElBQU0sV0FBVyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDN0MsQ0FBQyxxQkFBcUIsaUJBQTBCLGVBQWUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDNUYsRUFBRSxDQUFDOztnQkFFUCxvREFBb0Q7Z0JBQ3BELHFEQUFxRDtnQkFDckQsS0FBMEIsSUFBQSxLQUFBLGlCQUFBLElBQUksQ0FBQyxjQUFjLENBQUEsZ0JBQUEsNEJBQUU7b0JBQTFDLElBQU0sV0FBVyxXQUFBO29CQUNwQixJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTt3QkFDdkMsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO3dCQUMzRCxJQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxzQkFBZSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUUzRixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztxQkFDOUI7aUJBQ0Y7Ozs7Ozs7OztZQUVELE9BQU8sQ0FBQyxDQUFDLEVBQUU7WUFDUCxtQ0FBbUM7WUFDbkMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQVksRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsbUJBRzFFLElBQUksQ0FBQyxXQUFXLEVBRWhCLGFBQWEsRUFFYixXQUFXLEdBRWhCLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNoRCxDQUFDO1FBRUQsZ0JBQWdCO1FBQ2hCLDRDQUFRLEdBQVIsVUFBUyxJQUFZLElBQXVCLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRWxGLGdEQUFZLEdBQVosVUFBYSxTQUFvQjtZQUMvQixJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUNyQyxJQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDO1lBQzlDLElBQU0sVUFBVSxHQUFtQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUVyRCxJQUFNLGVBQWUsR0FBYSxFQUFFLENBQUM7WUFFckMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQyxTQUFTO2dCQUNyQyxJQUFNLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO2dCQUM1QixJQUFJLElBQUksS0FBSyxRQUFRLEVBQUU7b0JBQ3JCLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDN0M7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQzlCLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRSxnQkFBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7YUFDdkU7aUJBQU0sSUFBSSxhQUFhLEtBQUssQ0FBQyxFQUFFO2dCQUM5QixVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzthQUMzQztZQUVELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzVFLENBQUM7UUFHRCwyREFBdUIsR0FBdkIsVUFBd0IsWUFBeUI7WUFDL0MsUUFBUSxZQUFZLEVBQUU7Z0JBQ3BCLEtBQUssTUFBTTtvQkFDVCxPQUFPLDRCQUFFLENBQUMsZUFBZSxDQUFDO2dCQUM1QixLQUFLLEtBQUs7b0JBQ1IsT0FBTyw0QkFBRSxDQUFDLFlBQVksQ0FBQztnQkFDekI7b0JBQ0UsT0FBTyw0QkFBRSxDQUFDLGFBQWEsQ0FBQzthQUMzQjtRQUNILENBQUM7UUFFRCwyREFBdUIsR0FBdkIsVUFBd0IsYUFBa0MsRUFBRSxPQUFrQjtZQUM1RSxJQUFJLENBQUMsVUFBVSxHQUFHLGFBQWEsQ0FBQztZQUNoQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUM5RCxDQUFDO1FBRUQsZ0RBQVksR0FBWixVQUFhLE9BQWtCO1lBQS9CLGlCQW9ZQzs7WUFuWUMsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDN0MsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDO1lBRTdDLElBQU0sV0FBVyxHQUE2QixFQUFFLENBQUM7WUFDakQsSUFBTSxhQUFhLEdBQTZCLEVBQUUsQ0FBQztZQUNuRCxJQUFJLFFBQVEsR0FBVyxFQUFFLENBQUM7WUFFcEIsSUFBQSx3REFBdUQsRUFBdEQsb0JBQVksRUFBRSxtQkFBd0MsQ0FBQztZQUM5RCxJQUFNLGFBQWEsR0FBRyxvQkFBa0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFdkQsK0RBQStEO1lBQy9ELHNEQUFzRDtZQUN0RCxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUU7Z0JBQ3ZCLElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFO29CQUN4RCxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztpQkFDMUQ7Z0JBQ0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7YUFDeEU7WUFFRCxJQUFJLGlCQUFpQixHQUFZLEtBQUssQ0FBQzs7Z0JBRXZDLHlCQUF5QjtnQkFDekIsS0FBbUIsSUFBQSxLQUFBLGlCQUFBLE9BQU8sQ0FBQyxVQUFVLENBQUEsZ0JBQUEsNEJBQUU7b0JBQWxDLElBQU0sSUFBSSxXQUFBO29CQUNiLElBQU0sTUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7b0JBQ3ZCLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7b0JBQ3pCLElBQUksTUFBSSxLQUFLLHdCQUFpQixFQUFFO3dCQUM5QixpQkFBaUIsR0FBRyxJQUFJLENBQUM7cUJBQzFCO3lCQUFNLElBQUksTUFBSSxLQUFLLGdCQUFTLEVBQUU7d0JBQzdCLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRTs0QkFDdkIsTUFBTSxJQUFJLEtBQUssQ0FDWCw0RUFBNEUsQ0FBQyxDQUFDO3lCQUNuRjt3QkFDRCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQzt3QkFDM0IsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7d0JBQ3pCLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUNqRCxRQUFRLEdBQUcsS0FBSyxDQUFDO3FCQUNsQjt5QkFBTSxJQUFJLE1BQUksQ0FBQyxVQUFVLENBQUMsdUJBQWdCLENBQUMsRUFBRTt3QkFDNUMsYUFBYSxDQUFDLE1BQUksQ0FBQyxLQUFLLENBQUMsdUJBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7cUJBQzVEO3lCQUFNO3dCQUNMLFdBQVcsQ0FBQyxNQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7cUJBQzNCO2lCQUNGOzs7Ozs7Ozs7WUFFRCwwQ0FBMEM7WUFDMUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBRTVDLGdEQUFnRDtZQUNoRCxJQUFNLFVBQVUsR0FBbUIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDN0QsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDbEIsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7YUFDekM7WUFFRCxxQkFBcUI7WUFDckIsSUFBTSxVQUFVLEdBQW1CLEVBQUUsQ0FBQztZQUN0QyxJQUFNLHdCQUF3QixHQUFtQixFQUFFLENBQUM7WUFDcEQsSUFBTSx3QkFBd0IsR0FBbUIsRUFBRSxDQUFDO1lBRXBELElBQU0sV0FBVyxHQUF1QixFQUFFLENBQUM7WUFDM0MsSUFBTSxXQUFXLEdBQXVCLEVBQUUsQ0FBQztZQUMzQyxJQUFNLGNBQWMsR0FBdUIsRUFBRSxDQUFDO1lBRTlDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBdUI7Z0JBQzdDLFFBQVEsS0FBSyxDQUFDLElBQUksRUFBRTtvQkFDbEIsc0VBQXNFO29CQUN0RSxzRUFBc0U7b0JBQ3RFLHFFQUFxRTtvQkFDckUsMkRBQTJEO29CQUMzRCwwQ0FBMEM7b0JBQzFDO3dCQUNFLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxPQUFPLEVBQUU7NEJBQ3pCLCtEQUErRDs0QkFDL0QsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO3lCQUNqQzs2QkFBTSxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRTs0QkFDaEMsK0RBQStEOzRCQUMvRCxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7eUJBQ2pDOzZCQUFNOzRCQUNMLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7eUJBQzVCO3dCQUNELE1BQU07b0JBQ1I7d0JBQ0UsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDeEIsTUFBTTtvQkFDUjt3QkFDRSxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN4QixNQUFNO29CQUNSO3dCQUNFLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQzNCLE1BQU07aUJBQ1Q7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQztZQUN2QixJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUM7WUFDdkIsSUFBSSxlQUFlLEdBQThCLElBQUksQ0FBQztZQUN0RCxJQUFJLGdCQUFnQixHQUFrQyxJQUFJLENBQUM7WUFDM0QsSUFBTSxjQUFjLEdBQTRCLEVBQUUsQ0FBQztZQUNuRCxJQUFNLGVBQWUsR0FBNEIsRUFBRSxDQUFDO1lBQ3BELE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO2dCQUNsRCxJQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2hDLElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtvQkFDbkIsZUFBZSxHQUFHLG9CQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3BDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsSUFBSSxJQUFNLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUM1RjtxQkFBTSxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7b0JBQzFCLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztvQkFDdEIsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxTQUFTO3dCQUNuQyxlQUFlLENBQUMsU0FBUyxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUM7d0JBQzlDLGdCQUFrQixDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztvQkFDdkMsQ0FBQyxDQUFDLENBQUM7aUJBQ0o7cUJBQU07b0JBQ0wsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2pDLElBQUksYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTt3QkFDdEMsSUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUNoRCxJQUFNLFFBQVEsR0FBRyxLQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO3dCQUN6RixVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO3FCQUMzQjt5QkFBTTt3QkFDTCxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztxQkFDbkM7aUJBQ0Y7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksa0JBQWtCLEdBQUcsS0FBSyxDQUFDO1lBQy9CLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUMzQyxJQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLElBQU0sc0JBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sQ0FBQztnQkFDakUsSUFBSSxzQkFBc0IsRUFBRTtvQkFDMUIsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO2lCQUMzQjtxQkFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3JELGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUM7aUJBQy9DO2FBQ0Y7WUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDM0MsSUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixJQUFNLHNCQUFzQixHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNoRSxJQUFJLENBQUMsc0JBQXNCLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDekUsZUFBZSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxjQUFjLEVBQUUsQ0FBQztpQkFDaEQ7YUFDRjtZQUVELHFFQUFxRTtZQUNyRSxzRUFBc0U7WUFDdEUsd0VBQXdFO1lBQ3hFLHdDQUF3QztZQUN4QyxJQUFJLHdCQUF3QixHQUFHLGtCQUFrQixDQUFDO1lBRWxELCtFQUErRTtZQUMvRSw0REFBNEQ7WUFDNUQsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO2dCQUN0Qyx3QkFBd0IsR0FBRyx3QkFBd0IsSUFBSSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDaEYsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNqRCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksZUFBZSxFQUFFO2dCQUNuQix3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8scUJBQXNDLENBQUMsQ0FBQztnQkFFL0UsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO29CQUN2Qyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUMvQyxJQUFNLEtBQUssR0FBRyxlQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN0Qyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNsRCxDQUFDLENBQUMsQ0FBQzthQUNKO1lBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO2dCQUN2Qyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ2pELENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxnQkFBZ0IsRUFBRTtnQkFDcEIsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLHFCQUFzQyxDQUFDLENBQUM7Z0JBRS9FLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxTQUFTO29CQUM3Qyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUNwRCx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNqRCxDQUFDLENBQUMsQ0FBQzthQUNKO1lBRUQsSUFBTSxzQkFBc0IsR0FBRyx3QkFBd0IsQ0FBQyxNQUFNLElBQUksV0FBVyxDQUFDLE1BQU07Z0JBQ2hGLHdCQUF3QixDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDO1lBRTFELGlEQUFpRDtZQUNqRCxVQUFVLENBQUMsSUFBSSxPQUFmLFVBQVUsbUJBQVMsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUU7WUFDN0YsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFFL0MsMENBQTBDO1lBQzFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBRS9ELElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDdkMsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWSxDQUFDLENBQUM7WUFFcEUsd0VBQXdFO1lBQ3hFLDJCQUEyQjtZQUMzQixJQUFJLGdCQUFnQixLQUFLLGNBQWMsRUFBRTtnQkFDdkMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxDQUFDO2FBQ3pEO1lBRUQsSUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQkFBWSxDQUFDLENBQUM7WUFFMUMsSUFBTSw0QkFBNEIsR0FBRyxDQUFDLHNCQUFzQixJQUFJLENBQUMsYUFBYTtnQkFDMUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztZQUVsRSxJQUFJLDRCQUE0QixFQUFFO2dCQUNoQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSw0QkFBRSxDQUFDLE9BQU8sRUFBRSx3QkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2FBQ3pGO2lCQUFNO2dCQUNMLElBQUksQ0FBQyxtQkFBbUIsQ0FDcEIsT0FBTyxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLDRCQUFFLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLDRCQUFFLENBQUMsWUFBWSxFQUM5RSx3QkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUVuQyxJQUFJLGlCQUFpQixFQUFFO29CQUNyQixJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSw0QkFBRSxDQUFDLGVBQWUsQ0FBQyxDQUFDO2lCQUNsRTtnQkFFRCxvREFBb0Q7Z0JBQ3BELElBQUksc0JBQXNCLEVBQUU7b0JBQzFCLElBQU0sVUFBVSxHQUFxQixFQUFFLENBQUM7b0JBRXhDLElBQUksd0JBQXdCLENBQUMsTUFBTSxFQUFFO3dCQUNuQyxnRkFBZ0Y7d0JBQ2hGLHVFQUF1RTt3QkFDdkUsMkVBQTJFO3dCQUMzRSxtRkFBbUY7d0JBQ25GLFVBQVUsQ0FBQyxJQUFJLENBQ1gsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7cUJBQ3RGO3lCQUFNLElBQUksd0JBQXdCLENBQUMsTUFBTSxJQUFJLHdCQUF3QixFQUFFO3dCQUN0RSw2RUFBNkU7d0JBQzdFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO3FCQUM5QjtvQkFFRCxJQUFJLHdCQUF3QixDQUFDLE1BQU0sRUFBRTt3QkFDbkMsd0VBQXdFO3dCQUN4RSx3RUFBd0U7d0JBQ3hFLDRFQUE0RTt3QkFDNUUsbUZBQW1GO3dCQUNuRixVQUFVLENBQUMsSUFBSSxDQUNYLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsd0JBQXdCLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO3FCQUN0Rjt5QkFBTSxJQUFJLHdCQUF3QixFQUFFO3dCQUNuQyw2RUFBNkU7d0JBQzdFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO3FCQUM5QjtvQkFFRCxJQUFJLHdCQUF3QixFQUFFO3dCQUM1QixVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7cUJBQ3pEO29CQUVELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsNEJBQUUsQ0FBQyxjQUFjLEVBQUUsVUFBVSxDQUFDLENBQUM7aUJBQy9EO2dCQUVELCtCQUErQjtnQkFDL0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxTQUF1QjtvQkFDOUMsS0FBSSxDQUFDLG1CQUFtQixDQUNwQixTQUFTLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsUUFBUSxFQUNqQyxLQUFJLENBQUMsd0JBQXdCLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUM5RCxDQUFDLENBQUMsQ0FBQzthQUNKO1lBRUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLHNCQUFzQixFQUFFO2dCQUN4RSxJQUFNLGNBQVksR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUU3QyxJQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xDLElBQU0sb0JBQWtCLEdBQUcsVUFBVSxJQUFJLFVBQVUsQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFFeEYsSUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxJQUFNLG9CQUFrQixHQUFHLFVBQVUsSUFBSSxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO2dCQUV4RixJQUFNLFlBQVksR0FBRyxvQkFBa0IsSUFBSSxvQkFBa0IsQ0FBQztnQkFDOUQsSUFBSSxZQUFZLEVBQUU7b0JBQ2hCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsaUJBQWlCLEVBQUU7d0JBQ3BFLElBQU0sTUFBTSxHQUFtQixDQUFDLGNBQVksQ0FBQyxDQUFDO3dCQUU5QyxJQUFJLG9CQUFrQixFQUFFOzRCQUN0QixJQUFNLGtCQUFrQixHQUFHLG9CQUFrQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDOzRCQUNoRixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQzt5QkFDOUU7NkJBQU0sSUFBSSxvQkFBa0IsRUFBRTs0QkFDN0IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7eUJBQzFCO3dCQUVELElBQUksb0JBQWtCLEVBQUU7NEJBQ3RCLElBQU0sa0JBQWtCLEdBQUcsb0JBQWtCLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7NEJBQ2hGLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO3lCQUM5RTt3QkFFRCxPQUFPLE1BQU0sQ0FBQztvQkFDaEIsQ0FBQyxDQUFDLENBQUM7aUJBQ0o7Z0JBRUQsSUFBSSxnQkFBZ0IsR0FBMEIsSUFBSSxDQUFDO2dCQUNuRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUU7b0JBQ3RCLElBQUksQ0FBQyxHQUFHLG9CQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7d0JBRWpDLElBQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDN0IsSUFBTSxNQUFNLEdBQVUsRUFBRSxDQUFDO3dCQUN6QixJQUFNLGVBQWUsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO3dCQUM1RSxJQUFJLGVBQWU7NEJBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQzt3QkFFbEQsSUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQzt3QkFDdkIsSUFBTSxVQUFVLEdBQVcsY0FBYyxDQUFDLEdBQUcsQ0FBRyxDQUFDO3dCQUNqRCxJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFLLGVBQWUsQ0FBQyxDQUFDO3dCQUN0RCxPQUFLLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsNEJBQUUsQ0FBQyxnQkFBZ0IsRUFBRTs0QkFDNUQ7Z0NBQ0UsY0FBWSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO2dDQUNuQyxLQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUM7K0JBQUssTUFBTSxFQUM3RDt3QkFDSixDQUFDLENBQUMsQ0FBQztvQkFDTCxDQUFDOztvQkFmRCxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7O3FCQWVsQztvQkFFRCxnQkFBZ0IsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztpQkFDeEQ7Z0JBRUQsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO29CQUN0QixJQUFJLENBQUMsR0FBRyxvQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O3dCQUVqQyxJQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzdCLElBQU0sTUFBTSxHQUFVLEVBQUUsQ0FBQzt3QkFDekIsSUFBTSxlQUFlLEdBQUcscUJBQXFCLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQzt3QkFDNUUsSUFBSSxlQUFlOzRCQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7d0JBRWxELElBQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7d0JBQ3ZCLElBQU0sVUFBVSxHQUFXLGVBQWUsQ0FBQyxHQUFHLENBQUcsQ0FBQzt3QkFDbEQsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBSyxlQUFlLENBQUMsQ0FBQzt3QkFDdEQsT0FBSyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsZ0JBQWdCLEVBQUU7NEJBQzVEO2dDQUNFLGNBQVksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztnQ0FDbkMsS0FBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDOytCQUFLLE1BQU0sRUFDN0Q7d0JBQ0osQ0FBQyxDQUFDLENBQUM7b0JBQ0wsQ0FBQzs7b0JBZkQsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFOztxQkFlbEM7b0JBRUQsZ0JBQWdCLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7aUJBQ3hEO2dCQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBa0IsQ0FBQyxVQUFVLEVBQUUsNEJBQUUsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLGNBQVksQ0FBQyxDQUFDLENBQUM7YUFDL0Y7WUFFRCxrQ0FBa0M7WUFDbEMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxVQUFDLEtBQXVCO2dCQUM3QyxJQUFNLFdBQVcsR0FBRyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3hELElBQUksS0FBSyxDQUFDLElBQUksc0JBQTBCLEVBQUU7b0JBQ3hDLElBQU0sT0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDdEQsc0RBQXNEO29CQUN0RCxJQUFJLE9BQUssQ0FBQyxJQUFJLElBQUksT0FBSyxDQUFDLEtBQUssRUFBRTt3QkFDN0IsSUFBTSxNQUFJLEdBQUcsNkJBQTZCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUN2RCxLQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSw0QkFBRSxDQUFDLGdCQUFnQixFQUFFOzRCQUM1RCxPQUFPO2dDQUNMLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFJLENBQUMsRUFBRSxLQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLE9BQUssQ0FBQzs2QkFDdkYsQ0FBQzt3QkFDSixDQUFDLENBQUMsQ0FBQztxQkFDSjtpQkFDRjtxQkFBTSxJQUFJLFdBQVcsRUFBRTtvQkFDdEIsSUFBTSxRQUFNLEdBQVUsRUFBRSxDQUFDO29CQUN6QixJQUFNLGVBQWUsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO29CQUM1RSxJQUFJLGVBQWU7d0JBQUUsUUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFFbEQsMENBQTBDO29CQUMxQyxJQUFNLE9BQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQ3RELEtBQUksQ0FBQyxvQkFBb0IsQ0FBQyxPQUFLLENBQUMsQ0FBQztvQkFFakMsS0FBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFO3dCQUNwRDs0QkFDRSxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQzs0QkFDOUMsS0FBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxPQUFLLENBQUM7MkJBQUssUUFBTSxFQUN2RDtvQkFDSixDQUFDLENBQUMsQ0FBQztpQkFDSjtxQkFBTTtvQkFDTCxLQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFnQixLQUFLLENBQUMsSUFBTSxDQUFDLENBQUM7aUJBQ2pEO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCwrQkFBK0I7WUFDL0IsSUFBSSxJQUFJLENBQUMsY0FBYyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLENBQUM7Z0JBQ25ELE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksRUFBRTtnQkFDekMsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQVcsQ0FBQztnQkFDM0MsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQzthQUMvQztpQkFBTTtnQkFDTCxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDcEM7WUFFRCxJQUFJLENBQUMsNEJBQTRCLEVBQUU7Z0JBQ2pDLG9DQUFvQztnQkFDcEMsSUFBSSxpQkFBaUIsRUFBRTtvQkFDckIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxhQUFhLElBQUksT0FBTyxDQUFDLFVBQVUsRUFBRSw0QkFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2lCQUMxRjtnQkFDRCxJQUFJLENBQUMsbUJBQW1CLENBQ3BCLE9BQU8sQ0FBQyxhQUFhLElBQUksT0FBTyxDQUFDLFVBQVUsRUFDM0MsYUFBYSxDQUFDLENBQUMsQ0FBQyw0QkFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyw0QkFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQzdEO1lBRUQsNkNBQTZDO1lBQzdDLElBQUksQ0FBQyxjQUFjLEdBQUcsZ0JBQWdCLENBQUM7UUFDekMsQ0FBQztRQUVELGlEQUFhLEdBQWIsVUFBYyxRQUFvQjtZQUFsQyxpQkErRUM7WUE5RUMsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFFOUMsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO1lBQ2hCLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sRUFBRTtnQkFDL0UsNEVBQTRFO2dCQUM1RSxNQUFNLEdBQUcscUNBQWtCLENBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUN2RTtZQUVELElBQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUksSUFBSSxDQUFDLFdBQVcsU0FBSSxNQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUVsRSxJQUFNLFlBQVksR0FDZCxXQUFXLENBQUMsQ0FBQyxDQUFJLFdBQVcsa0JBQWEsYUFBZSxDQUFDLENBQUMsQ0FBQyxjQUFZLGFBQWUsQ0FBQztZQUUzRixJQUFNLFVBQVUsR0FBbUI7Z0JBQ2pDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO2dCQUN4QixDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQztnQkFDeEIsQ0FBQyxDQUFDLGVBQWU7YUFDbEIsQ0FBQztZQUVGLHlEQUF5RDtZQUN6RCxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUU5QyxrRkFBa0Y7WUFDbEYsSUFBTSxVQUFVLEdBQW1CLEVBQUUsQ0FBQztZQUN0QyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FDdkIsVUFBQyxDQUFrQixJQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUMsZ0JBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsZ0JBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pGLFVBQVUsQ0FBQyxJQUFJLE9BQWYsVUFBVSxtQkFBUyxJQUFJLENBQUMsa0NBQWtDLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUU7WUFDL0YsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFFL0MsdUNBQXVDO1lBQ3ZDLElBQUksUUFBUSxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRTtnQkFDckQsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQzthQUN4RDtZQUVELGlFQUFpRTtZQUNqRSxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLG1CQUFZLENBQUMsQ0FBQztZQUN6QyxRQUFRLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFBLEtBQUs7Z0JBQzNCLElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDdEQsS0FBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNqQyxLQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSw0QkFBRSxDQUFDLGVBQWUsRUFBRTtvQkFDOUQsT0FBTzt3QkFDTCxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQzt3QkFDL0MsS0FBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUM7cUJBQzVDLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztZQUVILCtCQUErQjtZQUMvQixJQUFNLGVBQWUsR0FBRyxJQUFJLHlCQUF5QixDQUNqRCxJQUFJLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxFQUFFLEVBQ3BGLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxFQUN4RixJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUU5Qix5RkFBeUY7WUFDekYsMkZBQTJGO1lBQzNGLHFGQUFxRjtZQUNyRixxRkFBcUY7WUFDckYsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQztnQkFDM0IsSUFBTSxvQkFBb0IsR0FDdEIsZUFBZSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNqRixLQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3pGLENBQUMsQ0FBQyxDQUFDO1lBRUgsc0NBQXNDO1lBQ3RDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsY0FBYyxFQUFFO2dCQUMvRCxVQUFVLENBQUMsTUFBTSxDQUNiLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsYUFBYSxFQUFFLENBQUMsRUFDaEQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM5QyxPQUFPLHdCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZDLENBQUMsQ0FBQyxDQUFDO1lBRUgsMENBQTBDO1lBQzFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUMsU0FBdUI7Z0JBQy9DLEtBQUksQ0FBQyxtQkFBbUIsQ0FDcEIsU0FBUyxDQUFDLFVBQVUsRUFBRSw0QkFBRSxDQUFDLFFBQVEsRUFDakMsS0FBSSxDQUFDLHdCQUF3QixDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQy9ELENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQVNELGtEQUFjLEdBQWQsVUFBZSxJQUFpQjtZQUFoQyxpQkFVQztZQVRDLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBRTFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFM0UsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3JELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMsaUJBQWlCLENBQ2xCLElBQUksQ0FBQyxVQUFVLEVBQUUsNEJBQUUsQ0FBQyxXQUFXLEVBQy9CLGNBQU0sT0FBQSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsbUJBQVksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQXBGLENBQW9GLENBQUMsQ0FBQztRQUNsRyxDQUFDO1FBRUQsNkNBQVMsR0FBVCxVQUFVLElBQVk7WUFDcEIsSUFBSSxDQUFDLG1CQUFtQixDQUNwQixJQUFJLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3RixDQUFDO1FBRUQsd0ZBQXdGO1FBQ3hGLEVBQUU7UUFDRix5Q0FBeUM7UUFDekMsY0FBYztRQUNkLE1BQU07UUFDTixNQUFNO1FBQ04sZUFBZTtRQUNmLGtCQUFrQjtRQUNsQixLQUFLO1FBQ0wsK0NBQStDO1FBQy9DLHdCQUF3QjtRQUN4QixNQUFNO1FBQ04sNERBQXdCLEdBQXhCLFVBQXlCLElBQVksRUFBRSxRQUFnQjtZQUNyRCxJQUFNLElBQUksR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDckMsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDOUYsSUFBSSxDQUFDLG1CQUFtQixDQUNwQixJQUFJLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDaEYsQ0FBQztRQUVPLG9EQUFnQixHQUF4QixjQUE2QixPQUFPLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFeEQsaURBQWEsR0FBYixjQUFrQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBRTNDLCtDQUFXLEdBQVgsY0FBZ0IsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBRXpDLGtEQUFjLEdBQXRCLGNBQTJCLE9BQU8sS0FBRyxJQUFJLENBQUMsZUFBZSxFQUFJLENBQUMsQ0FBQyxDQUFDO1FBRWhFLGdGQUFnRjtRQUNoRix5RkFBeUY7UUFDekYsb0ZBQW9GO1FBQ3BGLDRDQUE0QztRQUNwQyxpREFBYSxHQUFyQixVQUNJLEdBQTBCLEVBQUUsSUFBMEIsRUFBRSxTQUE4QixFQUN0RixVQUFpRDtZQUNuRCxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUNQLElBQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ3JFLE9BQU8sV0FBVyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdkQsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRU8sdURBQW1CLEdBQTNCLFVBQ0ksSUFBMEIsRUFBRSxTQUE4QixFQUMxRCxVQUFrRDtZQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvRSxDQUFDO1FBRU8scURBQWlCLEdBQXpCLFVBQ0ksSUFBMEIsRUFBRSxTQUE4QixFQUMxRCxVQUFrRDtZQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUVPLDZEQUF5QixHQUFqQyxVQUFrQyxRQUFnQjtZQUNoRCxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUM7WUFDOUMsSUFBSSxDQUFDLGtCQUFrQixJQUFJLFFBQVEsQ0FBQztZQUNwQyxPQUFPLGFBQWEsQ0FBQztRQUN2QixDQUFDO1FBRU8sd0RBQW9CLEdBQTVCLFVBQTZCLEtBQVU7WUFDckMsSUFBSSxDQUFDLGFBQWEsSUFBSSxLQUFLLFlBQVksbUJBQWEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RixDQUFDO1FBRU8sMERBQXNCLEdBQTlCLFVBQStCLFFBQXNCLEVBQUUsS0FBVSxFQUFFLFVBQW9COztZQUVyRixJQUFNLGVBQWUsR0FDakIsS0FBSyxZQUFZLG1CQUFhLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsY0FBTSxPQUFBLFlBQUssQ0FBQywwQkFBMEIsQ0FBQyxFQUFqQyxDQUFpQyxDQUFDO1lBRTNGLElBQU0sd0JBQXdCLEdBQUcsNkNBQXNCLENBQ25ELElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRSxrQ0FBVyxDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUMxRixDQUFBLEtBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQSxDQUFDLElBQUksNEJBQUksd0JBQXdCLENBQUMsS0FBSyxHQUFFO1lBRTVELElBQU0sT0FBTyxHQUFHLHdCQUF3QixDQUFDLFdBQVcsQ0FBQztZQUNyRCxPQUFPLEtBQUssWUFBWSxtQkFBYSxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ1QsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDaEcsQ0FBQztRQUVPLG1EQUFlLEdBQXZCLFVBQXdCLE9BQWUsRUFBRSxPQUE2QjtZQUF0RSxpQkFNQztZQUxDLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUN6QixJQUFNLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsbUNBQTRCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDbkYsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FDdkIsUUFBUSxFQUFFLFVBQUMsV0FBVyxFQUFFLFVBQVUsSUFBTyxLQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2xGO1FBQ0gsQ0FBQztRQUVPLHNFQUFrQyxHQUExQyxVQUEyQyxNQUEwQixFQUFFLE9BQXVCO1lBRTVGLElBQU0sU0FBUyxHQUFtQixFQUFFLENBQUM7WUFDckMsSUFBTSxrQkFBa0IsR0FBdUIsRUFBRSxDQUFDO1lBRWxELElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtnQkFDakIsSUFBTSxtQkFBaUIsR0FBRyxnQkFBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN4QyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUEsS0FBSztvQkFDbEIsSUFBSSxLQUFLLENBQUMsSUFBSSxzQkFBMEIsRUFBRTt3QkFDeEMsc0VBQXNFO3dCQUN0RSx1RUFBdUU7d0JBQ3ZFLHlFQUF5RTt3QkFDekUsNERBQTREO3dCQUM1RCxTQUFTLENBQUMsSUFBSSxDQUFDLGdCQUFTLENBQUMsNkJBQTZCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsbUJBQWlCLENBQUMsQ0FBQztxQkFDekY7eUJBQU07d0JBQ0wsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO3FCQUNoQztnQkFDSCxDQUFDLENBQUMsQ0FBQzthQUNKO1lBRUQsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtnQkFDL0MsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxvQkFBaUMsQ0FBQyxDQUFDO2dCQUMzRCxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsVUFBQyxDQUFtQixJQUFLLE9BQUEsU0FBUyxDQUFDLElBQUksQ0FBQyxnQkFBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFqQyxDQUFpQyxDQUFDLENBQUM7Z0JBQ3ZGLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQyxDQUFlLElBQUssT0FBQSxTQUFTLENBQUMsSUFBSSxDQUFDLGdCQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQWpDLENBQWlDLENBQUMsQ0FBQzthQUN6RTtZQUVELE9BQU8sU0FBUyxDQUFDO1FBQ25CLENBQUM7UUFFTyxnREFBWSxHQUFwQixVQUFxQixVQUEwQjtZQUM3QyxPQUFPLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDbkUsQ0FBQyxDQUFDLGVBQWUsQ0FBQztRQUN4QixDQUFDO1FBRU8sd0RBQW9CLEdBQTVCLFVBQTZCLFVBQXlCO1lBQXRELGlCQTBCQztZQXpCQyxJQUFJLENBQUMsVUFBVSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUMxQyxPQUFPLENBQUMsQ0FBQyxlQUFlLENBQUM7YUFDMUI7WUFFRCxJQUFNLFNBQVMsR0FBRywwQkFBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsVUFBQSxTQUFTO2dCQUNoRCxJQUFNLElBQUksR0FBRyxLQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDckMsaUNBQWlDO2dCQUNqQyxJQUFNLFlBQVksR0FBRyxLQUFJLENBQUMsYUFBYSxDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQzdELElBQU0sY0FBYyxHQUFHLEtBQUksQ0FBQyxLQUFLLENBQUM7Z0JBQ2xDLElBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ3JDLEtBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUNsQixjQUFjLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxHQUFHLG1CQUNuQyxVQUFDLEtBQW1CLEVBQUUsYUFBcUI7b0JBQ3pDLGFBQWE7b0JBQ2IsSUFBTSxlQUFlLEdBQ2pCLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUUvRSwyQkFBMkI7b0JBQzNCLElBQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzlFLE9BQU8sZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztnQkFDdkQsQ0FBQyxDQUFDLENBQUM7Z0JBQ1AsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzNDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFSixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLGdCQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUVPLDREQUF3QixHQUFoQyxVQUFpQyxPQUFlLEVBQUUsU0FBdUI7WUFBekUsaUJBd0JDO1lBdkJDLElBQU0sZUFBZSxHQUFHLHFDQUFrQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMzRCxJQUFNLGdCQUFnQixHQUFHLHFDQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3JELElBQU0sWUFBWSxHQUFNLElBQUksQ0FBQyxZQUFZLFNBQUksZ0JBQWdCLFNBQUksZUFBZSxjQUFXLENBQUM7WUFFNUYsT0FBTztnQkFFTCxJQUFNLGFBQWEsR0FBRyxLQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxLQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUV0RixJQUFNLFdBQVcsR0FBRywyQ0FBb0IsQ0FDcEMsYUFBYSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsbUJBQVksQ0FBQyxFQUFFLFNBQVMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUMvRCxjQUFNLE9BQUEsWUFBSyxDQUFDLDBCQUEwQixDQUFDLEVBQWpDLENBQWlDLENBQUMsQ0FBQztnQkFFN0MsSUFBTSxVQUFVLG9CQUNYLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRSxFQUFLLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRSxFQUM3RSxXQUFXLENBQUMsWUFBWSxDQUM1QixDQUFDO2dCQUVGLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQ2hCLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQzVFLFlBQVksQ0FBQyxDQUFDO2dCQUVsQixPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDOUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQztRQUNILGdDQUFDO0lBQUQsQ0FBQyxBQWw0QkQsSUFrNEJDO0lBbDRCWSw4REFBeUI7SUFvNEJ0QztRQUFvQywwQ0FBNkI7UUFHL0Qsd0JBQ1ksWUFBMEIsRUFBVSxZQUEwQixFQUM5RCx5QkFBdUQsRUFDdkQsVUFDd0U7WUFKcEYsWUFLRSxpQkFBTyxTQUNSO1lBTFcsa0JBQVksR0FBWixZQUFZLENBQWM7WUFBVSxrQkFBWSxHQUFaLFlBQVksQ0FBYztZQUM5RCwrQkFBeUIsR0FBekIseUJBQXlCLENBQThCO1lBQ3ZELGdCQUFVLEdBQVYsVUFBVSxDQUM4RDtZQU41RSxvQkFBYyxHQUFtQixFQUFFLENBQUM7O1FBUTVDLENBQUM7UUFFRCxnQ0FBZ0M7UUFDaEMsa0NBQVMsR0FBVCxVQUFVLElBQWlCLEVBQUUsT0FBWTtZQUN2QyxxQ0FBcUM7WUFDckMsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2pDLElBQU0sZUFBZSxHQUFHLFVBQVEsSUFBTSxDQUFDO1lBQ3ZDLG1FQUFtRTtZQUNuRSxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM5RSxJQUFNLE1BQU0sR0FBRyxJQUFJLGtCQUFZLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLHNCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RixJQUFBLG1DQUEwRCxFQUF6RCwwQkFBVSxFQUFFLDRCQUE2QyxDQUFDO1lBQ2pFLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUM1RSxJQUFNLElBQUkscUJBQVcsSUFBSSxDQUFDLEdBQUcsR0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0MsSUFBTSxhQUFhLEdBQ2YsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxrQkFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTNGLElBQU0sWUFBWSxHQUFHLElBQUksa0JBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU07Z0JBQ3JELElBQUksc0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUM7Z0JBQ3JDLElBQUksc0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsQ0FBQztlQUM5QyxhQUFhLEVBQ2hCLENBQUM7WUFDSCxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN2QyxPQUFPLFlBQVksQ0FBQztRQUN0QixDQUFDO1FBRUQsOENBQXFCLEdBQXJCLFVBQXNCLFlBQW9CO1lBQ3hDLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLFVBQUMsSUFBa0I7Z0JBQzdDLG9FQUFvRTtnQkFDcEUsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQXFCLENBQUM7Z0JBQ25ELFVBQVUsQ0FBQyxLQUFnQixJQUFJLFlBQVksQ0FBQztZQUMvQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCwwQ0FBaUIsR0FBakIsVUFBa0IsS0FBbUIsRUFBRSxPQUFZO1lBQW5ELGlCQVVDO1lBVEMsT0FBTyxJQUFJLDBDQUFtQixDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUsVUFBQSxNQUFNO2dCQUNqRix5RUFBeUU7Z0JBQ3pFLGtGQUFrRjtnQkFDbEYsNEVBQTRFO2dCQUM1RSxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNyQyxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQWQsQ0FBYyxDQUFDLENBQUMsQ0FBQztvQkFDdEMsS0FBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2xELGlCQUFpQixDQUFDLEtBQUksQ0FBQyxZQUFZLEVBQUUsT0FBTyxFQUFFLEtBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1lBQ3BGLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELHdDQUFlLEdBQWYsVUFBZ0IsR0FBZSxFQUFFLE9BQVk7WUFBN0MsaUJBV0M7WUFWQyxPQUFPLElBQUksMENBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxVQUFBLE1BQU07Z0JBQ3hFLDBFQUEwRTtnQkFDMUUsa0ZBQWtGO2dCQUNsRiw0RUFBNEU7Z0JBQzVFLElBQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FDbkMsVUFBQyxLQUFLLEVBQUUsS0FBSyxJQUFLLE9BQUEsQ0FBQyxFQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLE9BQUEsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEVBQUMsQ0FBQyxFQUFuRSxDQUFtRSxDQUFDLENBQUMsQ0FBQztnQkFDNUYsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFkLENBQWMsQ0FBQyxDQUFDLENBQUM7b0JBQ3RDLEtBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNsRCxpQkFBaUIsQ0FBQyxLQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sRUFBRSxLQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQztZQUNwRixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDSCxxQkFBQztJQUFELENBQUMsQUFsRUQsQ0FBb0MsbUNBQTZCLEdBa0VoRTtJQWxFWSx3Q0FBYztJQW9FM0Isc0VBQXNFO0lBQ3RFLElBQU0sc0JBQXNCLEdBQUcsQ0FBQyw0QkFBRSxDQUFDLFNBQVMsRUFBRSw0QkFBRSxDQUFDLFNBQVMsRUFBRSw0QkFBRSxDQUFDLFNBQVMsRUFBRSw0QkFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBRXhGLFNBQVMsbUJBQW1CLENBQUMsSUFBb0I7UUFDL0MsSUFBTSxVQUFVLEdBQUcsc0JBQXNCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE9BQU87WUFDTCxVQUFVLEVBQUUsVUFBVSxJQUFJLDRCQUFFLENBQUMsU0FBUztZQUN0QyxXQUFXLEVBQUUsQ0FBQyxVQUFVO1NBQ3pCLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBTSx1QkFBdUIsR0FBRztRQUM5Qiw0QkFBRSxDQUFDLGFBQWEsRUFBRSw0QkFBRSxDQUFDLGFBQWEsRUFBRSw0QkFBRSxDQUFDLGFBQWEsRUFBRSw0QkFBRSxDQUFDLGFBQWEsRUFBRSw0QkFBRSxDQUFDLGFBQWE7UUFDeEYsNEJBQUUsQ0FBQyxhQUFhLEVBQUUsNEJBQUUsQ0FBQyxhQUFhLEVBQUUsNEJBQUUsQ0FBQyxhQUFhLEVBQUUsNEJBQUUsQ0FBQyxhQUFhO0tBQ3ZFLENBQUM7SUFFRixTQUFTLG9CQUFvQixDQUFDLElBQW9CO1FBQ2hELElBQU0sVUFBVSxHQUFHLHVCQUF1QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN4RCxPQUFPO1lBQ0wsVUFBVSxFQUFFLFVBQVUsSUFBSSw0QkFBRSxDQUFDLGFBQWE7WUFDMUMsV0FBVyxFQUFFLENBQUMsVUFBVTtTQUN6QixDQUFDO0lBQ0osQ0FBQztJQUVELFNBQVMsV0FBVyxDQUNoQixJQUE0QixFQUFFLFNBQThCLEVBQzVELE1BQXNCO1FBQ3hCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVELGFBQWE7SUFDYixTQUFTLHVCQUF1QixDQUFDLGlCQUF5QjtRQUN4RCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxXQUFXLENBQUM7YUFDOUIsTUFBTSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVELFNBQVMsaUJBQWlCLENBQ3RCLFlBQTBCLEVBQUUsT0FBOEMsRUFDMUUsYUFBMkM7UUFDdkMsSUFBQSw0Q0FBbUYsRUFBbEYsa0NBQWMsRUFBRSxvREFBa0UsQ0FBQztRQUMxRixxREFBcUQ7UUFDckQsSUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwRSx1QkFBdUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLFlBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1FBQzFGLElBQUEsa0RBQXlFLEVBQXhFLDBCQUFVLEVBQUUsNEJBQTRELENBQUM7UUFFaEYsMkZBQTJGO1FBQzNGLFVBQVU7UUFDVixJQUFNLElBQUksR0FBRztZQUNYLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1lBQ3BCLGNBQWM7U0FDZixDQUFDO1FBRUYsSUFBSSxXQUFXLEVBQUU7WUFDZixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDO1NBQ2xEO2FBQU07WUFDTCxJQUFJLENBQUMsSUFBSSxPQUFULElBQUksbUJBQVMsdUJBQXVCLEdBQUU7U0FDdkM7UUFFRCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFVRCxxRUFBcUU7SUFDckUsSUFBTSxrQkFBa0IsR0FBRyxnQkFBZ0IsQ0FBQztJQTJCNUM7UUFjRSxzQkFBMkIsWUFBd0IsRUFBVSxNQUFnQztZQUFsRSw2QkFBQSxFQUFBLGdCQUF3QjtZQUFVLHVCQUFBLEVBQUEsYUFBZ0M7WUFBbEUsaUJBQVksR0FBWixZQUFZLENBQVk7WUFBVSxXQUFNLEdBQU4sTUFBTSxDQUEwQjtZQWI3Riw2REFBNkQ7WUFDckQsUUFBRyxHQUFHLElBQUksR0FBRyxFQUF1QixDQUFDO1lBQ3JDLHVCQUFrQixHQUFHLENBQUMsQ0FBQztZQUN2Qix3QkFBbUIsR0FBdUIsSUFBSSxDQUFDO1FBVXlDLENBQUM7UUFQakcsc0JBQVcsMEJBQVU7aUJBQXJCO2dCQUNFLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFO29CQUM3QixZQUFZLENBQUMsV0FBVyxHQUFHLElBQUksWUFBWSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2lCQUN0RjtnQkFDRCxPQUFPLFlBQVksQ0FBQyxXQUFXLENBQUM7WUFDbEMsQ0FBQzs7O1dBQUE7UUFJRCwwQkFBRyxHQUFILFVBQUksSUFBWTtZQUNkLElBQUksT0FBTyxHQUFzQixJQUFJLENBQUM7WUFDdEMsT0FBTyxPQUFPLEVBQUU7Z0JBQ2QsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2xDLElBQUksS0FBSyxJQUFJLElBQUksRUFBRTtvQkFDakIsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO3dCQUNwQixrREFBa0Q7d0JBQ2xELEtBQUssR0FBRzs0QkFDTixjQUFjLEVBQUUsS0FBSyxDQUFDLGNBQWM7NEJBQ3BDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRzs0QkFDZCxvQkFBb0IsRUFBRSxLQUFLLENBQUMsb0JBQW9COzRCQUNoRCxPQUFPLEVBQUUsS0FBSzs0QkFDZCxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVE7eUJBQ3pCLENBQUM7d0JBRUYsMkJBQTJCO3dCQUMzQixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7d0JBQzFCLHlDQUF5Qzt3QkFDekMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUMxQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO3FCQUM3QztvQkFFRCxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUU7d0JBQ2hELEtBQUssQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO3FCQUN0QjtvQkFDRCxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUM7aUJBQ2xCO2dCQUNELE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO2FBQzFCO1lBRUQsb0ZBQW9GO1lBQ3BGLDBFQUEwRTtZQUMxRSxrRkFBa0Y7WUFDbEYsNkVBQTZFO1lBQzdFLE9BQU8sSUFBSSxDQUFDLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFFLENBQUM7UUFFRDs7Ozs7Ozs7V0FRRztRQUNILDBCQUFHLEdBQUgsVUFBSSxjQUFzQixFQUFFLElBQVksRUFBRSxHQUFrQixFQUN4RCxRQUE4QyxFQUM5QyxvQkFBOEM7WUFEOUMseUJBQUEsRUFBQSwwQkFBOEM7WUFFaEQsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7Z0JBQ2YsWUFBSyxDQUFDLGNBQVksSUFBSSwyQ0FBc0MsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFHLENBQUMsQ0FBQztZQUN0RixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2pCLGNBQWMsRUFBRSxjQUFjO2dCQUM5QixHQUFHLEVBQUUsR0FBRztnQkFDUixPQUFPLEVBQUUsS0FBSztnQkFDZCxvQkFBb0IsRUFBRSxvQkFBb0I7Z0JBQzFDLFFBQVEsRUFBRSxRQUFRO2FBQ25CLENBQUMsQ0FBQztZQUNILE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELCtCQUFRLEdBQVIsVUFBUyxJQUFZLElBQXlCLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFdEUsa0NBQVcsR0FBWCxVQUFZLEtBQWE7WUFDdkIsSUFBTSxRQUFRLEdBQUcsSUFBSSxZQUFZLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQy9DLElBQUksS0FBSyxHQUFHLENBQUM7Z0JBQUUsUUFBUSxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELE9BQU8sUUFBUSxDQUFDO1FBQ2xCLENBQUM7UUFFRCwyQ0FBb0IsR0FBcEIsVUFBcUIsY0FBc0I7WUFDekMsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEdBQUcsY0FBYyxDQUFDLENBQUM7WUFDdkUsT0FBTyxZQUFZLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ3hFLENBQUM7UUFFRCxvREFBNkIsR0FBN0IsVUFBOEIsS0FBa0I7WUFDOUMsSUFBSSxLQUFLLENBQUMsUUFBUSxvQkFBZ0MsRUFBRTtnQkFDbEQsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUM3RSxJQUFJLFlBQVksRUFBRTtvQkFDaEIsWUFBWSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7aUJBQzdCO3FCQUFNO29CQUNMLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7aUJBQ3JEO2FBQ0Y7UUFDSCxDQUFDO1FBRUQsK0NBQXdCLEdBQXhCLFVBQXlCLGNBQXNCO1lBQzdDLElBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsbUJBQVksR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO1lBQ2pFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGtCQUFrQixHQUFHLGNBQWMsRUFBRTtnQkFDaEQsY0FBYyxFQUFFLGNBQWM7Z0JBQzlCLEdBQUcsRUFBRSxHQUFHO2dCQUNSLG9CQUFvQixFQUFFLFVBQUMsS0FBbUIsRUFBRSxhQUFxQjtvQkFDL0QsdUJBQXVCO29CQUN2QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7Z0JBQ3pFLENBQUM7Z0JBQ0QsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsUUFBUSx3QkFBb0M7YUFDN0MsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELDJDQUFvQixHQUFwQixVQUFxQixJQUFZO1lBQy9CLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBRyxDQUFDO1lBQzlELGNBQWMsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1lBQzlCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QixPQUFPLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFFRCx1Q0FBZ0IsR0FBaEIsVUFBaUIsY0FBc0I7WUFDckMsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUU7Z0JBQ2hFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBUSxDQUFDLG1CQUFtQixFQUFFO29CQUN0Qyw2RUFBNkU7b0JBQzdFLElBQUksQ0FBQyxNQUFRLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBUSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztpQkFDcEY7Z0JBQ0QsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxNQUFRLENBQUMsbUJBQW1CLENBQUM7YUFDOUQ7UUFDSCxDQUFDO1FBRUQsMkNBQW9CLEdBQXBCO1lBQ0UsZUFBZTtZQUNmLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBQzdCLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSw0QkFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMxRSxFQUFFLENBQUM7UUFDVCxDQUFDO1FBRUQsNkNBQXNCLEdBQXRCO1lBQ0Usd0JBQXdCO1lBQ3hCLElBQU0seUJBQXlCLEdBQUcsV0FBVyxDQUFDLElBQUksRUFBRSw0QkFBRSxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMzRSxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2dCQUM3QixDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pFLEVBQUUsQ0FBQztRQUNULENBQUM7UUFFRCxzQ0FBZSxHQUFmLGNBQW9CLE9BQU8sSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztRQUUzRiwyQ0FBb0IsR0FBcEI7WUFBQSxpQkFXQztZQVZDLElBQUksbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO2lCQUMvQixNQUFNLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsT0FBTyxFQUFiLENBQWEsQ0FBQztpQkFDOUIsSUFBSSxDQUFDLFVBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSyxPQUFBLENBQUMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQTlELENBQThELENBQUM7aUJBQzlFLE1BQU0sQ0FBQyxVQUFDLEtBQW9CLEVBQUUsS0FBa0I7Z0JBQy9DLElBQU0sU0FBUyxHQUFHLEtBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQztnQkFDM0QsSUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLG9CQUFzQixDQUFDLEtBQUksRUFBRSxTQUFTLEdBQUcsbUJBQW1CLENBQUMsQ0FBQztnQkFDdEYsbUJBQW1CLEdBQUcsU0FBUyxDQUFDO2dCQUNoQyxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakMsQ0FBQyxFQUFFLEVBQUUsQ0FBa0IsQ0FBQztRQUM5QixDQUFDO1FBR0QseUNBQWtCLEdBQWxCO1lBQ0UsSUFBSSxPQUFPLEdBQWlCLElBQUksQ0FBQztZQUNqQyxnRUFBZ0U7WUFDaEUsT0FBTyxPQUFPLENBQUMsTUFBTTtnQkFBRSxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztZQUNoRCxJQUFNLEdBQUcsR0FBRyxLQUFHLHVCQUFnQixHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsRUFBSSxDQUFDO1lBQ2pFLE9BQU8sR0FBRyxDQUFDO1FBQ2IsQ0FBQztRQUNILG1CQUFDO0lBQUQsQ0FBQyxBQTFLRCxJQTBLQztJQTFLWSxvQ0FBWTtJQTRLekI7O09BRUc7SUFDSCxTQUFTLGlCQUFpQixDQUFDLEdBQVcsRUFBRSxVQUFvQztRQUMxRSxJQUFNLFdBQVcsR0FBRyxJQUFJLHNCQUFXLEVBQUUsQ0FBQztRQUV0QyxXQUFXLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTVCLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxJQUFJO1lBQ2xELElBQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUUvQixXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN0QyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxPQUFPLEVBQUU7Z0JBQ2xDLElBQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzNDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQSxTQUFTLElBQUksT0FBQSxXQUFXLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUFuQyxDQUFtQyxDQUFDLENBQUM7YUFDbkU7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFFRCx5QkFBeUI7SUFDekIsWUFBWTtJQUNaLHlCQUF5QjtJQUN6QixnQ0FBZ0M7SUFDaEMsU0FBUyxhQUFhLENBQUMsSUFBYTs7UUFDbEMsSUFBSSxPQUF5QixDQUFDO1FBQzlCLElBQUksV0FBNkIsQ0FBQztRQUNsQyxJQUFJLEVBQW9CLENBQUM7UUFFekIsSUFBSSxJQUFJLEVBQUU7WUFDUixrRUFBa0U7WUFDbEUsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBWSxDQUFDLENBQUM7WUFFM0MsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyx3QkFBaUIsQ0FBQyxDQUFDO1lBQ2xELElBQUksY0FBYyxTQUFRLENBQUM7WUFDM0IsdUdBQ21GLEVBRGxGLHNCQUFjLEVBQUUsVUFBRSxDQUNpRTtZQUNwRjs7d0NBRXdCLEVBRnZCLGVBQU8sRUFBRSxtQkFBVyxDQUVJO1NBQzFCO1FBRUQsT0FBTyxFQUFDLFdBQVcsYUFBQSxFQUFFLEVBQUUsSUFBQSxFQUFFLE9BQU8sU0FBQSxFQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFNBQVMsV0FBVyxDQUFDLElBQW9CO1FBQ3ZDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUUsNkNBQTZDO1FBQ3BFLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNuQixLQUFLLENBQUM7Z0JBQ0osT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RELEtBQUssQ0FBQztnQkFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEQsS0FBSyxDQUFDO2dCQUNKLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0RCxLQUFLLENBQUM7Z0JBQ0osT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RELEtBQUssRUFBRTtnQkFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEQsS0FBSyxFQUFFO2dCQUNMLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0RCxLQUFLLEVBQUU7Z0JBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RELEtBQUssRUFBRTtnQkFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdkQ7UUFDRCxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN2QyxZQUFLLENBQUMsMkNBQXlDLElBQUksQ0FBQyxNQUFRLENBQUMsQ0FBQztRQUNsRSxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxTQUFnQixhQUFhLENBQ3pCLFFBQWdCLEVBQUUsV0FBbUIsRUFBRSxPQUE2QyxFQUNwRix1QkFBK0I7UUFEUSx3QkFBQSxFQUFBLFlBQTZDO1FBUXRGLElBQU0sYUFBYSxHQUFHLGlCQUFpQixFQUFFLENBQUM7UUFDMUMsSUFBTSxVQUFVLEdBQUcsSUFBSSx3QkFBVSxFQUFFLENBQUM7UUFDcEMsSUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFNUQsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN2RCxPQUFPO2dCQUNMLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTTtnQkFDMUIsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsWUFBWSxFQUFFLEtBQUs7Z0JBQ25CLGtCQUFrQixFQUFFLEVBQUUsRUFBRSx1QkFBdUIseUJBQUE7YUFDaEQsQ0FBQztTQUNIO1FBRUQsSUFBSSxTQUFTLEdBQWdCLFdBQVcsQ0FBQyxTQUFTLENBQUM7UUFDbkQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRTtZQUNoQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLG9DQUFpQixFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7U0FDL0Q7UUFFSyxJQUFBLDBFQUMyQyxFQUQxQyxnQkFBSyxFQUFFLDhCQUFZLEVBQUUsMENBQWtCLEVBQUUsa0JBQ0MsQ0FBQztRQUNsRCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUMvQixPQUFPO2dCQUNMLE1BQU0sUUFBQTtnQkFDTixLQUFLLEVBQUUsRUFBRTtnQkFDVCxZQUFZLEVBQUUsS0FBSztnQkFDbkIsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLHVCQUF1Qix5QkFBQTthQUNoRCxDQUFDO1NBQ0g7UUFFRCxPQUFPLEVBQUMsS0FBSyxPQUFBLEVBQUUsWUFBWSxjQUFBLEVBQUUsa0JBQWtCLG9CQUFBLEVBQUUsdUJBQXVCLHlCQUFBLEVBQUMsQ0FBQztJQUM1RSxDQUFDO0lBdkNELHNDQXVDQztJQUVEOztPQUVHO0lBQ0gsU0FBZ0IsaUJBQWlCO1FBQy9CLE9BQU8sSUFBSSw4QkFBYSxDQUNwQixJQUFJLGVBQU0sQ0FBQyxJQUFJLGFBQUssRUFBRSxDQUFDLEVBQUUsbURBQTRCLEVBQUUsSUFBSSxzREFBd0IsRUFBRSxFQUFFLElBQUksRUFDM0YsRUFBRSxDQUFDLENBQUM7SUFDVixDQUFDO0lBSkQsOENBSUM7SUFFRCxTQUFTLGNBQWMsQ0FBQyxLQUF1QjtRQUM3QyxPQUFPLEtBQUssQ0FBQyxJQUFJLElBQUksV0FBVyxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDO0lBQzVELENBQUM7SUFFRCxTQUFTLHFCQUFxQixDQUFDLEtBQXVCLEVBQUUsT0FBNkI7UUFDbkYsUUFBUSxPQUFPLEVBQUU7WUFDZixLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSTtnQkFDNUIsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDdkMsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU07Z0JBQzlCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ3pDLEtBQUssSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLO2dCQUM3Qix5RUFBeUU7Z0JBQ3pFLDZFQUE2RTtnQkFDN0Usc0VBQXNFO2dCQUN0RSxPQUFPLEtBQUssQ0FBQyxJQUFJLHNCQUEwQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUN0RixLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRztnQkFDM0IsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdEMsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVk7Z0JBQ3BDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDOUM7Z0JBQ0UsT0FBTyxJQUFJLENBQUM7U0FDZjtJQUNILENBQUM7SUFFRCxTQUFTLGtCQUFrQixDQUFDLElBQVk7UUFDdEMsUUFBUSxJQUFJLEVBQUU7WUFDWixLQUFLLGtCQUFrQixDQUFDO1lBQ3hCLEtBQUssWUFBWSxDQUFDO1lBQ2xCLEtBQUssY0FBYyxDQUFDO1lBQ3BCLEtBQUssUUFBUSxDQUFDO1lBQ2QsS0FBSyxZQUFZLENBQUM7WUFDbEIsS0FBSyxrQkFBa0I7Z0JBQ3JCLE9BQU8sSUFBSSxDQUFDO1NBQ2Y7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxTQUFTLDZCQUE2QixDQUFDLElBQVk7UUFDakQsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDO0lBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZmxhdHRlbiwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIEJ1aWx0aW5GdW5jdGlvbkNhbGwsIExvY2FsUmVzb2x2ZXIsIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgRnVuY3Rpb25DYWxsLCBJbXBsaWNpdFJlY2VpdmVyLCBJbnRlcnBvbGF0aW9uLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIFByb3BlcnR5UmVhZH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7TGV4ZXJ9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmltcG9ydCB7UGFyc2VyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0ICogYXMgaHRtbCBmcm9tICcuLi8uLi9tbF9wYXJzZXIvYXN0JztcbmltcG9ydCB7SHRtbFBhcnNlcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfcGFyc2VyJztcbmltcG9ydCB7V2hpdGVzcGFjZVZpc2l0b3J9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3doaXRlc3BhY2VzJztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJR30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCB7aXNOZ0NvbnRhaW5lciBhcyBjaGVja0lzTmdDb250YWluZXIsIHNwbGl0TnNOYW1lfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5cbmltcG9ydCB7UjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge3BhcnNlU3R5bGV9IGZyb20gJy4vc3R5bGluZyc7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgSTE4Tl9BVFRSLCBJMThOX0FUVFJfUFJFRklYLCBJRF9TRVBBUkFUT1IsIElNUExJQ0lUX1JFRkVSRU5DRSwgTUVBTklOR19TRVBBUkFUT1IsIE5PTl9CSU5EQUJMRV9BVFRSLCBSRUZFUkVOQ0VfUFJFRklYLCBSRU5ERVJfRkxBR1MsIGFzTGl0ZXJhbCwgZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZywgaW52YWxpZCwgaXNJMThOQXR0cmlidXRlLCBtYXBUb0V4cHJlc3Npb24sIHRyaW1UcmFpbGluZ051bGxzLCB1bnN1cHBvcnRlZH0gZnJvbSAnLi91dGlsJztcblxuZnVuY3Rpb24gbWFwQmluZGluZ1RvSW5zdHJ1Y3Rpb24odHlwZTogQmluZGluZ1R5cGUpOiBvLkV4dGVybmFsUmVmZXJlbmNlfHVuZGVmaW5lZCB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgQmluZGluZ1R5cGUuUHJvcGVydHk6XG4gICAgICByZXR1cm4gUjMuZWxlbWVudFByb3BlcnR5O1xuICAgIGNhc2UgQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICByZXR1cm4gUjMuZWxlbWVudENsYXNzUHJvcDtcbiAgICBjYXNlIEJpbmRpbmdUeXBlLkF0dHJpYnV0ZTpcbiAgICBjYXNlIEJpbmRpbmdUeXBlLkFuaW1hdGlvbjpcbiAgICAgIHJldHVybiBSMy5lbGVtZW50QXR0cmlidXRlO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8vICBpZiAocmYgJiBmbGFncykgeyAuLiB9XG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgIGZsYWdzOiBjb3JlLlJlbmRlckZsYWdzLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKTogby5JZlN0bXQge1xuICByZXR1cm4gby5pZlN0bXQoby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGZsYWdzKSwgbnVsbCwgZmFsc2UpLCBzdGF0ZW1lbnRzKTtcbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgaW1wbGVtZW50cyB0LlZpc2l0b3I8dm9pZD4sIExvY2FsUmVzb2x2ZXIge1xuICBwcml2YXRlIF9kYXRhSW5kZXggPSAwO1xuICBwcml2YXRlIF9iaW5kaW5nQ29udGV4dCA9IDA7XG4gIHByaXZhdGUgX3ByZWZpeENvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgaW4gbGlzdGVuZXJzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLlxuICAgKiBUaGlzIGVuc3VyZXMgYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfY3JlYXRpb25Db2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLiBUaGlzIGVuc3VyZXNcbiAgICogYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfdXBkYXRlQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGdlbmVyYXRlZCBmcm9tIHZpc2l0aW5nIHBpcGVzLCBsaXRlcmFscywgZXRjLiAqL1xuICBwcml2YXRlIF90ZW1wVmFyaWFibGVzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBidWlsZCBuZXN0ZWQgdGVtcGxhdGVzLiBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWxcbiAgICogYWZ0ZXIgdGhlIHBhcmVudCB0ZW1wbGF0ZSBoYXMgZmluaXNoZWQgdmlzaXRpbmcgYWxsIG9mIGl0cyBub2Rlcy4gVGhpcyBlbnN1cmVzIHRoYXQgYWxsXG4gICAqIGxvY2FsIHJlZiBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIGFyZSBhYmxlIHRvIGZpbmQgbG9jYWwgcmVmIHZhbHVlcyBpZiB0aGUgcmVmc1xuICAgKiBhcmUgZGVmaW5lZCBhZnRlciB0aGUgdGVtcGxhdGUgZGVjbGFyYXRpb24uXG4gICAqL1xuICBwcml2YXRlIF9uZXN0ZWRUZW1wbGF0ZUZuczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgLyoqXG4gICAqIFRoaXMgc2NvcGUgY29udGFpbnMgbG9jYWwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB1cGRhdGUgbW9kZSBibG9jayBvZiB0aGUgdGVtcGxhdGUuXG4gICAqIChlLmcuIHJlZnMgYW5kIGNvbnRleHQgdmFycyBpbiBiaW5kaW5ncylcbiAgICovXG4gIHByaXZhdGUgX2JpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlO1xuICBwcml2YXRlIF92YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIHByaXZhdGUgX3Vuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5cbiAgLy8gV2hldGhlciB3ZSBhcmUgaW5zaWRlIGEgdHJhbnNsYXRhYmxlIGVsZW1lbnQgKGA8cCBpMThuPi4uLiBzb21ld2hlcmUgaGVyZSAuLi4gPC9wPilcbiAgcHJpdmF0ZSBfaW5JMThuU2VjdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9pMThuU2VjdGlvbkluZGV4ID0gLTE7XG4gIC8vIE1hcHMgb2YgcGxhY2Vob2xkZXIgdG8gbm9kZSBpbmRleGVzIGZvciBlYWNoIG9mIHRoZSBpMThuIHNlY3Rpb25cbiAgcHJpdmF0ZSBfcGhUb05vZGVJZHhlczoge1twaE5hbWU6IHN0cmluZ106IG51bWJlcltdfVtdID0gW3t9XTtcblxuICAvLyBOdW1iZXIgb2Ygc2xvdHMgdG8gcmVzZXJ2ZSBmb3IgcHVyZUZ1bmN0aW9uc1xuICBwcml2YXRlIF9wdXJlRnVuY3Rpb25TbG90cyA9IDA7XG5cbiAgLy8gTnVtYmVyIG9mIGJpbmRpbmcgc2xvdHNcbiAgcHJpdmF0ZSBfYmluZGluZ1Nsb3RzID0gMDtcblxuICBwcml2YXRlIGZpbGVCYXNlZEkxOG5TdWZmaXg6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHBhcmVudEJpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlLCBwcml2YXRlIGxldmVsID0gMCxcbiAgICAgIHByaXZhdGUgY29udGV4dE5hbWU6IHN0cmluZ3xudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIHZpZXdRdWVyaWVzOiBSM1F1ZXJ5TWV0YWRhdGFbXSwgcHJpdmF0ZSBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCxcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlczogU2V0PG8uRXhwcmVzc2lvbj4sIHByaXZhdGUgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIHBpcGVzOiBTZXQ8by5FeHByZXNzaW9uPiwgcHJpdmF0ZSBfbmFtZXNwYWNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcHJpdmF0ZSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nKSB7XG4gICAgLy8gdmlldyBxdWVyaWVzIGNhbiB0YWtlIHVwIHNwYWNlIGluIGRhdGEgYW5kIGFsbG9jYXRpb24gaGFwcGVucyBlYXJsaWVyIChpbiB0aGUgXCJ2aWV3UXVlcnlcIlxuICAgIC8vIGZ1bmN0aW9uKVxuICAgIHRoaXMuX2RhdGFJbmRleCA9IHZpZXdRdWVyaWVzLmxlbmd0aDtcblxuICAgIHRoaXMuX2JpbmRpbmdTY29wZSA9IHBhcmVudEJpbmRpbmdTY29wZS5uZXN0ZWRTY29wZShsZXZlbCk7XG5cbiAgICAvLyBUdXJuIHRoZSByZWxhdGl2ZSBjb250ZXh0IGZpbGUgcGF0aCBpbnRvIGFuIGlkZW50aWZpZXIgYnkgcmVwbGFjaW5nIG5vbi1hbHBoYW51bWVyaWNcbiAgICAvLyBjaGFyYWN0ZXJzIHdpdGggdW5kZXJzY29yZXMuXG4gICAgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4ID0gcmVsYXRpdmVDb250ZXh0RmlsZVBhdGgucmVwbGFjZSgvW15BLVphLXowLTldL2csICdfJykgKyAnXyc7XG5cbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgY29uc3RhbnRQb29sLCAoKSA9PiB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSxcbiAgICAgICAgKG51bVNsb3RzOiBudW1iZXIpID0+IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90cyksXG4gICAgICAgIChuYW1lLCBsb2NhbE5hbWUsIHNsb3QsIHZhbHVlOiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGlwZVR5cGUgPSBwaXBlVHlwZUJ5TmFtZS5nZXQobmFtZSk7XG4gICAgICAgICAgaWYgKHBpcGVUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLnBpcGVzLmFkZChwaXBlVHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQodGhpcy5sZXZlbCwgbG9jYWxOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnBpcGUsIFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChuYW1lKV0pO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyh2YXJpYWJsZTogdC5WYXJpYWJsZSkge1xuICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUodmFyaWFibGUubmFtZSArIHNjb3BlZE5hbWUpO1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQoXG4gICAgICAgIHJldHJpZXZhbExldmVsLCB2YXJpYWJsZS5uYW1lLCBsaHMsIERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCxcbiAgICAgICAgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgIGxldCByaHM6IG8uRXhwcmVzc2lvbjtcbiAgICAgICAgICBpZiAoc2NvcGUuYmluZGluZ0xldmVsID09PSByZXRyaWV2YWxMZXZlbCkge1xuICAgICAgICAgICAgLy8gZS5nLiBjdHhcbiAgICAgICAgICAgIHJocyA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2hhcmVkQ3R4VmFyID0gc2NvcGUuZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWwpO1xuICAgICAgICAgICAgLy8gZS5nLiBjdHhfcjAgICBPUiAgeCgyKTtcbiAgICAgICAgICAgIHJocyA9IHNoYXJlZEN0eFZhciA/IHNoYXJlZEN0eFZhciA6IGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRpdGVtJCA9IHgoMikuJGltcGxpY2l0O1xuICAgICAgICAgIHJldHVybiBbbGhzLnNldChyaHMucHJvcCh2YXJpYWJsZS52YWx1ZSB8fCBJTVBMSUNJVF9SRUZFUkVOQ0UpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBidWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICBub2RlczogdC5Ob2RlW10sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdLCBoYXNOZ0NvbnRlbnQ6IGJvb2xlYW4gPSBmYWxzZSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10gPSBbXSk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYpKTtcblxuICAgIC8vIE91dHB1dCBhIGBQcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiB3aGVuIHNvbWUgYDxuZy1jb250ZW50PmAgYXJlIHByZXNlbnRcbiAgICBpZiAoaGFzTmdDb250ZW50KSB7XG4gICAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgICAvLyBPbmx5IHNlbGVjdG9ycyB3aXRoIGEgbm9uLWRlZmF1bHQgdmFsdWUgYXJlIGdlbmVyYXRlZFxuICAgICAgaWYgKG5nQ29udGVudFNlbGVjdG9ycy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGNvbnN0IHIzU2VsZWN0b3JzID0gbmdDb250ZW50U2VsZWN0b3JzLm1hcChzID0+IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzKSk7XG4gICAgICAgIC8vIGBwcm9qZWN0aW9uRGVmYCBuZWVkcyBib3RoIHRoZSBwYXJzZWQgYW5kIHJhdyB2YWx1ZSBvZiB0aGUgc2VsZWN0b3JzXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNTZWxlY3RvcnMpLCB0cnVlKTtcbiAgICAgICAgY29uc3QgdW5QYXJzZWQgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKG5nQ29udGVudFNlbGVjdG9ycyksIHRydWUpO1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2gocGFyc2VkLCB1blBhcnNlZCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5wcm9qZWN0aW9uRGVmLCBwYXJhbWV0ZXJzKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIGJpbmRpbmdzIGluIGxpc3RlbmVycylcbiAgICBjb25zdCBjcmVhdGlvblN0YXRlbWVudHMgPSB0aGlzLl9jcmVhdGlvbkNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBwcm9wZXJ0eSBvciB0ZXh0IGJpbmRpbmdzKVxuICAgIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHMgPSB0aGlzLl91cGRhdGVDb2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vICBWYXJpYWJsZSBkZWNsYXJhdGlvbiBtdXN0IG9jY3VyIGFmdGVyIGJpbmRpbmcgcmVzb2x1dGlvbiBzbyB3ZSBjYW4gZ2VuZXJhdGUgY29udGV4dFxuICAgIC8vICBpbnN0cnVjdGlvbnMgdGhhdCBidWlsZCBvbiBlYWNoIG90aGVyLiBlLmcuIGNvbnN0IGIgPSB4KCkuJGltcGxpY2l0KCk7IGNvbnN0IGIgPSB4KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIC8vIEdlbmVyYXRlIG1hcHMgb2YgcGxhY2Vob2xkZXIgbmFtZSB0byBub2RlIGluZGV4ZXNcbiAgICAvLyBUT0RPKHZpY2IpOiBUaGlzIGlzIGEgV0lQLCBub3QgZnVsbHkgc3VwcG9ydGVkIHlldFxuICAgIGZvciAoY29uc3QgcGhUb05vZGVJZHggb2YgdGhpcy5fcGhUb05vZGVJZHhlcykge1xuICAgICAgaWYgKE9iamVjdC5rZXlzKHBoVG9Ob2RlSWR4KS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICAgIGNvbnN0IHBoTWFwID0gby52YXJpYWJsZShzY29wZWROYW1lKS5zZXQobWFwVG9FeHByZXNzaW9uKHBoVG9Ob2RlSWR4LCB0cnVlKSkudG9Db25zdERlY2woKTtcblxuICAgICAgICB0aGlzLl9wcmVmaXhDb2RlLnB1c2gocGhNYXApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzZWxlY3RvckluZGV4ID0gbmdDb250ZW50LnNlbGVjdG9ySW5kZXg7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QpXTtcblxuICAgIGNvbnN0IGF0dHJpYnV0ZUFzTGlzdDogc3RyaW5nW10gPSBbXTtcblxuICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZvckVhY2goKGF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHJpYnV0ZS5uYW1lO1xuICAgICAgaWYgKG5hbWUgIT09ICdzZWxlY3QnKSB7XG4gICAgICAgIGF0dHJpYnV0ZUFzTGlzdC5wdXNoKG5hbWUsIGF0dHJpYnV0ZS52YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYXR0cmlidXRlQXNMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCksIGFzTGl0ZXJhbChhdHRyaWJ1dGVBc0xpc3QpKTtcbiAgICB9IGVsc2UgaWYgKHNlbGVjdG9ySW5kZXggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCkpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgcGFyYW1ldGVycyk7XG4gIH1cblxuXG4gIGdldE5hbWVzcGFjZUluc3RydWN0aW9uKG5hbWVzcGFjZUtleTogc3RyaW5nfG51bGwpIHtcbiAgICBzd2l0Y2ggKG5hbWVzcGFjZUtleSkge1xuICAgICAgY2FzZSAnbWF0aCc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VNYXRoTUw7XG4gICAgICBjYXNlICdzdmcnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlU1ZHO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZUhUTUw7XG4gICAgfVxuICB9XG5cbiAgYWRkTmFtZXNwYWNlSW5zdHJ1Y3Rpb24obnNJbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgdGhpcy5fbmFtZXNwYWNlID0gbnNJbnN0cnVjdGlvbjtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBuc0luc3RydWN0aW9uKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICBjb25zdCBlbGVtZW50SW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCB3YXNJbkkxOG5TZWN0aW9uID0gdGhpcy5faW5JMThuU2VjdGlvbjtcblxuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBjb25zdCBhdHRySTE4bk1ldGFzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBsZXQgaTE4bk1ldGE6IHN0cmluZyA9ICcnO1xuXG4gICAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcbiAgICBjb25zdCBpc05nQ29udGFpbmVyID0gY2hlY2tJc05nQ29udGFpbmVyKGVsZW1lbnQubmFtZSk7XG5cbiAgICAvLyBFbGVtZW50cyBpbnNpZGUgaTE4biBzZWN0aW9ucyBhcmUgcmVwbGFjZWQgd2l0aCBwbGFjZWhvbGRlcnNcbiAgICAvLyBUT0RPKHZpY2IpOiBuZXN0ZWQgZWxlbWVudHMgYXJlIGEgV0lQIGluIHRoaXMgcGhhc2VcbiAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbikge1xuICAgICAgY29uc3QgcGhOYW1lID0gZWxlbWVudC5uYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIXRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF1bcGhOYW1lXSkge1xuICAgICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF1bcGhOYW1lXS5wdXNoKGVsZW1lbnRJbmRleCk7XG4gICAgfVxuXG4gICAgbGV0IGlzTm9uQmluZGFibGVNb2RlOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICAvLyBIYW5kbGUgaTE4biBhdHRyaWJ1dGVzXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHIubmFtZTtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXR0ci52YWx1ZTtcbiAgICAgIGlmIChuYW1lID09PSBOT05fQklOREFCTEVfQVRUUikge1xuICAgICAgICBpc05vbkJpbmRhYmxlTW9kZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09IEkxOE5fQVRUUikge1xuICAgICAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYENvdWxkIG5vdCBtYXJrIGFuIGVsZW1lbnQgYXMgdHJhbnNsYXRhYmxlIGluc2lkZSBvZiBhIHRyYW5zbGF0YWJsZSBzZWN0aW9uYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5JMThuU2VjdGlvbiA9IHRydWU7XG4gICAgICAgIHRoaXMuX2kxOG5TZWN0aW9uSW5kZXgrKztcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XSA9IHt9O1xuICAgICAgICBpMThuTWV0YSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgYXR0ckkxOG5NZXRhc1tuYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKV0gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dEF0dHJzW25hbWVdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWF0Y2ggZGlyZWN0aXZlcyBvbiBub24gaTE4biBhdHRyaWJ1dGVzXG4gICAgdGhpcy5tYXRjaERpcmVjdGl2ZXMoZWxlbWVudC5uYW1lLCBlbGVtZW50KTtcblxuICAgIC8vIFJlZ3VsYXIgZWxlbWVudCBvciBuZy1jb250YWluZXIgY3JlYXRpb24gbW9kZVxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChlbGVtZW50SW5kZXgpXTtcbiAgICBpZiAoIWlzTmdDb250YWluZXIpIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoZWxlbWVudE5hbWUpKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGF0dHJpYnV0ZXNcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IGluaXRpYWxTdHlsZURlY2xhcmF0aW9uczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBjb25zdCBzdHlsZUlucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgY2xhc3NJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGFsbE90aGVySW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcblxuICAgIGVsZW1lbnQuaW5wdXRzLmZvckVhY2goKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKSA9PiB7XG4gICAgICBzd2l0Y2ggKGlucHV0LnR5cGUpIHtcbiAgICAgICAgLy8gW2F0dHIuc3R5bGVdIG9yIFthdHRyLmNsYXNzXSBzaG91bGQgbm90IGJlIHRyZWF0ZWQgYXMgc3R5bGluZy1iYXNlZFxuICAgICAgICAvLyBiaW5kaW5ncyBzaW5jZSB0aGV5IGFyZSBpbnRlbmRlZCB0byBiZSB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSBhdHRyXG4gICAgICAgIC8vIGFuZCB0aGVyZWZvcmUgd2lsbCBza2lwIGFsbCBzdHlsZS9jbGFzcyByZXNvbHV0aW9uIHRoYXQgaXMgcHJlc2VudFxuICAgICAgICAvLyB3aXRoIHN0eWxlPVwiXCIsIFtzdHlsZV09XCJcIiBhbmQgW3N0eWxlLnByb3BdPVwiXCIsIGNsYXNzPVwiXCIsXG4gICAgICAgIC8vIFtjbGFzcy5wcm9wXT1cIlwiLiBbY2xhc3NdPVwiXCIgYXNzaWdubWVudHNcbiAgICAgICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgICAgICBpZiAoaW5wdXQubmFtZSA9PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAvLyB0aGlzIHNob3VsZCBhbHdheXMgZ28gZmlyc3QgaW4gdGhlIGNvbXBpbGF0aW9uIChmb3IgW3N0eWxlXSlcbiAgICAgICAgICAgIHN0eWxlSW5wdXRzLnNwbGljZSgwLCAwLCBpbnB1dCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChpc0NsYXNzQmluZGluZyhpbnB1dCkpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyBnbyBmaXJzdCBpbiB0aGUgY29tcGlsYXRpb24gKGZvciBbY2xhc3NdKVxuICAgICAgICAgICAgY2xhc3NJbnB1dHMuc3BsaWNlKDAsIDAsIGlucHV0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgICAgIHN0eWxlSW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEJpbmRpbmdUeXBlLkNsYXNzOlxuICAgICAgICAgIGNsYXNzSW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGFsbE90aGVySW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgbGV0IGN1cnJTdHlsZUluZGV4ID0gMDtcbiAgICBsZXQgY3VyckNsYXNzSW5kZXggPSAwO1xuICAgIGxldCBzdGF0aWNTdHlsZXNNYXA6IHtba2V5OiBzdHJpbmddOiBhbnl9fG51bGwgPSBudWxsO1xuICAgIGxldCBzdGF0aWNDbGFzc2VzTWFwOiB7W2tleTogc3RyaW5nXTogYm9vbGVhbn18bnVsbCA9IG51bGw7XG4gICAgY29uc3Qgc3R5bGVzSW5kZXhNYXA6IHtba2V5OiBzdHJpbmddOiBudW1iZXJ9ID0ge307XG4gICAgY29uc3QgY2xhc3Nlc0luZGV4TWFwOiB7W2tleTogc3RyaW5nXTogbnVtYmVyfSA9IHt9O1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG91dHB1dEF0dHJzKS5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBvdXRwdXRBdHRyc1tuYW1lXTtcbiAgICAgIGlmIChuYW1lID09ICdzdHlsZScpIHtcbiAgICAgICAgc3RhdGljU3R5bGVzTWFwID0gcGFyc2VTdHlsZSh2YWx1ZSk7XG4gICAgICAgIE9iamVjdC5rZXlzKHN0YXRpY1N0eWxlc01hcCkuZm9yRWFjaChwcm9wID0+IHsgc3R5bGVzSW5kZXhNYXBbcHJvcF0gPSBjdXJyU3R5bGVJbmRleCsrOyB9KTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PSAnY2xhc3MnKSB7XG4gICAgICAgIHN0YXRpY0NsYXNzZXNNYXAgPSB7fTtcbiAgICAgICAgdmFsdWUuc3BsaXQoL1xccysvZykuZm9yRWFjaChjbGFzc05hbWUgPT4ge1xuICAgICAgICAgIGNsYXNzZXNJbmRleE1hcFtjbGFzc05hbWVdID0gY3VyckNsYXNzSW5kZXgrKztcbiAgICAgICAgICBzdGF0aWNDbGFzc2VzTWFwICFbY2xhc3NOYW1lXSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKG8ubGl0ZXJhbChuYW1lKSk7XG4gICAgICAgIGlmIChhdHRySTE4bk1ldGFzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IHBhcnNlSTE4bk1ldGEoYXR0ckkxOG5NZXRhc1tuYW1lXSk7XG4gICAgICAgICAgY29uc3QgdmFyaWFibGUgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRUcmFuc2xhdGlvbih2YWx1ZSwgbWV0YSwgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4KTtcbiAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2godmFyaWFibGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF0dHJpYnV0ZXMucHVzaChvLmxpdGVyYWwodmFsdWUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgbGV0IGhhc01hcEJhc2VkU3R5bGluZyA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3R5bGVJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGlucHV0ID0gc3R5bGVJbnB1dHNbaV07XG4gICAgICBjb25zdCBpc01hcEJhc2VkU3R5bGVCaW5kaW5nID0gaSA9PT0gMCAmJiBpbnB1dC5uYW1lID09PSAnc3R5bGUnO1xuICAgICAgaWYgKGlzTWFwQmFzZWRTdHlsZUJpbmRpbmcpIHtcbiAgICAgICAgaGFzTWFwQmFzZWRTdHlsaW5nID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXN0eWxlc0luZGV4TWFwLmhhc093blByb3BlcnR5KGlucHV0Lm5hbWUpKSB7XG4gICAgICAgIHN0eWxlc0luZGV4TWFwW2lucHV0Lm5hbWVdID0gY3VyclN0eWxlSW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsYXNzSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnB1dCA9IGNsYXNzSW5wdXRzW2ldO1xuICAgICAgY29uc3QgaXNNYXBCYXNlZENsYXNzQmluZGluZyA9IGkgPT09IDAgJiYgaXNDbGFzc0JpbmRpbmcoaW5wdXQpO1xuICAgICAgaWYgKCFpc01hcEJhc2VkQ2xhc3NCaW5kaW5nICYmICFzdHlsZXNJbmRleE1hcC5oYXNPd25Qcm9wZXJ0eShpbnB1dC5uYW1lKSkge1xuICAgICAgICBjbGFzc2VzSW5kZXhNYXBbaW5wdXQubmFtZV0gPSBjdXJyQ2xhc3NJbmRleCsrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGluIHRoZSBldmVudCB0aGF0IGEgW3N0eWxlXSBiaW5kaW5nIGlzIHVzZWQgdGhlbiBzYW5pdGl6YXRpb24gd2lsbFxuICAgIC8vIGFsd2F5cyBiZSBpbXBvcnRlZCBiZWNhdXNlIGl0IGlzIG5vdCBwb3NzaWJsZSB0byBrbm93IGFoZWFkIG9mIHRpbWVcbiAgICAvLyB3aGV0aGVyIHN0eWxlIGJpbmRpbmdzIHdpbGwgdXNlIG9yIG5vdCB1c2UgYW55IHNhbml0aXphYmxlIHByb3BlcnRpZXNcbiAgICAvLyB0aGF0IGlzU3R5bGVTYW5pdGl6YWJsZSgpIHdpbGwgZGV0ZWN0XG4gICAgbGV0IHVzZURlZmF1bHRTdHlsZVNhbml0aXplciA9IGhhc01hcEJhc2VkU3R5bGluZztcblxuICAgIC8vIHRoaXMgd2lsbCBidWlsZCB0aGUgaW5zdHJ1Y3Rpb25zIHNvIHRoYXQgdGhleSBmYWxsIGludG8gdGhlIGZvbGxvd2luZyBzeW50YXhcbiAgICAvLyA9PiBbcHJvcDEsIHByb3AyLCBwcm9wMywgMCwgcHJvcDEsIHZhbHVlMSwgcHJvcDIsIHZhbHVlMl1cbiAgICBPYmplY3Qua2V5cyhzdHlsZXNJbmRleE1hcCkuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgIHVzZURlZmF1bHRTdHlsZVNhbml0aXplciA9IHVzZURlZmF1bHRTdHlsZVNhbml0aXplciB8fCBpc1N0eWxlU2FuaXRpemFibGUocHJvcCk7XG4gICAgICBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwocHJvcCkpO1xuICAgIH0pO1xuXG4gICAgaWYgKHN0YXRpY1N0eWxlc01hcCkge1xuICAgICAgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKGNvcmUuSW5pdGlhbFN0eWxpbmdGbGFncy5WQUxVRVNfTU9ERSkpO1xuXG4gICAgICBPYmplY3Qua2V5cyhzdGF0aWNTdHlsZXNNYXApLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChwcm9wKSk7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gc3RhdGljU3R5bGVzTWFwICFbcHJvcF07XG4gICAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbCh2YWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoY2xhc3Nlc0luZGV4TWFwKS5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHByb3ApKTtcbiAgICB9KTtcblxuICAgIGlmIChzdGF0aWNDbGFzc2VzTWFwKSB7XG4gICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwoY29yZS5Jbml0aWFsU3R5bGluZ0ZsYWdzLlZBTFVFU19NT0RFKSk7XG5cbiAgICAgIE9iamVjdC5rZXlzKHN0YXRpY0NsYXNzZXNNYXApLmZvckVhY2goY2xhc3NOYW1lID0+IHtcbiAgICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKGNsYXNzTmFtZSkpO1xuICAgICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwodHJ1ZSkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgaGFzU3R5bGluZ0luc3RydWN0aW9ucyA9IGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5sZW5ndGggfHwgc3R5bGVJbnB1dHMubGVuZ3RoIHx8XG4gICAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5sZW5ndGggfHwgY2xhc3NJbnB1dHMubGVuZ3RoO1xuXG4gICAgLy8gYWRkIGF0dHJpYnV0ZXMgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZyBwdXJwb3Nlc1xuICAgIGF0dHJpYnV0ZXMucHVzaCguLi50aGlzLnByZXBhcmVTeW50aGV0aWNBbmRTZWxlY3RPbmx5QXR0cnMoYWxsT3RoZXJJbnB1dHMsIGVsZW1lbnQub3V0cHV0cykpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnRvQXR0cnNQYXJhbShhdHRyaWJ1dGVzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxkaXYgI2ZvbyAjYmFyPVwiYmF6XCI+KVxuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnByZXBhcmVSZWZzUGFyYW1ldGVyKGVsZW1lbnQucmVmZXJlbmNlcykpO1xuXG4gICAgY29uc3Qgd2FzSW5OYW1lc3BhY2UgPSB0aGlzLl9uYW1lc3BhY2U7XG4gICAgY29uc3QgY3VycmVudE5hbWVzcGFjZSA9IHRoaXMuZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5KTtcblxuICAgIC8vIElmIHRoZSBuYW1lc3BhY2UgaXMgY2hhbmdpbmcgbm93LCBpbmNsdWRlIGFuIGluc3RydWN0aW9uIHRvIGNoYW5nZSBpdFxuICAgIC8vIGR1cmluZyBlbGVtZW50IGNyZWF0aW9uLlxuICAgIGlmIChjdXJyZW50TmFtZXNwYWNlICE9PSB3YXNJbk5hbWVzcGFjZSkge1xuICAgICAgdGhpcy5hZGROYW1lc3BhY2VJbnN0cnVjdGlvbihjdXJyZW50TmFtZXNwYWNlLCBlbGVtZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCBpbXBsaWNpdCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcblxuICAgIGNvbnN0IGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24gPSAhaGFzU3R5bGluZ0luc3RydWN0aW9ucyAmJiAhaXNOZ0NvbnRhaW5lciAmJlxuICAgICAgICBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA9PT0gMCAmJiBlbGVtZW50Lm91dHB1dHMubGVuZ3RoID09PSAwO1xuXG4gICAgaWYgKGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnQsIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJTdGFydCA6IFIzLmVsZW1lbnRTdGFydCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5kaXNhYmxlQmluZGluZ3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBpbml0aWFsIHN0eWxpbmcgZm9yIHN0YXRpYyBzdHlsZT1cIi4uLlwiIGF0dHJpYnV0ZXNcbiAgICAgIGlmIChoYXNTdHlsaW5nSW5zdHJ1Y3Rpb25zKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtc0xpc3Q6IChvLkV4cHJlc3Npb24pW10gPSBbXTtcblxuICAgICAgICBpZiAoaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLmxlbmd0aCkge1xuICAgICAgICAgIC8vIHRoZSB0ZW1wbGF0ZSBjb21waWxlciBoYW5kbGVzIGluaXRpYWwgY2xhc3Mgc3R5bGluZyAoZS5nLiBjbGFzcz1cImZvb1wiKSB2YWx1ZXNcbiAgICAgICAgICAvLyBpbiBhIHNwZWNpYWwgY29tbWFuZCBjYWxsZWQgYGVsZW1lbnRDbGFzc2Agc28gdGhhdCB0aGUgaW5pdGlhbCBjbGFzc1xuICAgICAgICAgIC8vIGNhbiBiZSBwcm9jZXNzZWQgZHVyaW5nIHJ1bnRpbWUuIFRoZXNlIGluaXRpYWwgY2xhc3MgdmFsdWVzIGFyZSBib3VuZCB0b1xuICAgICAgICAgIC8vIGEgY29uc3RhbnQgYmVjYXVzZSB0aGUgaW5pdGFsIGNsYXNzIHZhbHVlcyBkbyBub3QgY2hhbmdlIChzaW5jZSB0aGV5J3JlIHN0YXRpYykuXG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKFxuICAgICAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucyksIHRydWUpKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMubGVuZ3RoIHx8IHVzZURlZmF1bHRTdHlsZVNhbml0aXplcikge1xuICAgICAgICAgIC8vIG5vIHBvaW50IGluIGhhdmluZyBhbiBleHRyYSBgbnVsbGAgdmFsdWUgdW5sZXNzIHRoZXJlIGFyZSBmb2xsb3ctdXAgcGFyYW1zXG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdGhlIHRlbXBsYXRlIGNvbXBpbGVyIGhhbmRsZXMgaW5pdGlhbCBzdHlsZSAoZS5nLiBzdHlsZT1cImZvb1wiKSB2YWx1ZXNcbiAgICAgICAgICAvLyBpbiBhIHNwZWNpYWwgY29tbWFuZCBjYWxsZWQgYGVsZW1lbnRTdHlsZWAgc28gdGhhdCB0aGUgaW5pdGlhbCBzdHlsZXNcbiAgICAgICAgICAvLyBjYW4gYmUgcHJvY2Vzc2VkIGR1cmluZyBydW50aW1lLiBUaGVzZSBpbml0aWFsIHN0eWxlcyB2YWx1ZXMgYXJlIGJvdW5kIHRvXG4gICAgICAgICAgLy8gYSBjb25zdGFudCBiZWNhdXNlIHRoZSBpbml0YWwgc3R5bGUgdmFsdWVzIGRvIG5vdCBjaGFuZ2UgKHNpbmNlIHRoZXkncmUgc3RhdGljKS5cbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goXG4gICAgICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zKSwgdHJ1ZSkpO1xuICAgICAgICB9IGVsc2UgaWYgKHVzZURlZmF1bHRTdHlsZVNhbml0aXplcikge1xuICAgICAgICAgIC8vIG5vIHBvaW50IGluIGhhdmluZyBhbiBleHRyYSBgbnVsbGAgdmFsdWUgdW5sZXNzIHRoZXJlIGFyZSBmb2xsb3ctdXAgcGFyYW1zXG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIpIHtcbiAgICAgICAgICBwYXJhbXNMaXN0LnB1c2goby5pbXBvcnRFeHByKFIzLmRlZmF1bHRTdHlsZVNhbml0aXplcikpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLmVsZW1lbnRTdHlsaW5nLCBwYXJhbXNMaXN0KTtcbiAgICAgIH1cblxuICAgICAgLy8gR2VuZXJhdGUgTGlzdGVuZXJzIChvdXRwdXRzKVxuICAgICAgZWxlbWVudC5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICAgIHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKGVsZW1lbnQubmFtZSwgb3V0cHV0QXN0KSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoKHN0eWxlSW5wdXRzLmxlbmd0aCB8fCBjbGFzc0lucHV0cy5sZW5ndGgpICYmIGhhc1N0eWxpbmdJbnN0cnVjdGlvbnMpIHtcbiAgICAgIGNvbnN0IGluZGV4TGl0ZXJhbCA9IG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpO1xuXG4gICAgICBjb25zdCBmaXJzdFN0eWxlID0gc3R5bGVJbnB1dHNbMF07XG4gICAgICBjb25zdCBtYXBCYXNlZFN0eWxlSW5wdXQgPSBmaXJzdFN0eWxlICYmIGZpcnN0U3R5bGUubmFtZSA9PSAnc3R5bGUnID8gZmlyc3RTdHlsZSA6IG51bGw7XG5cbiAgICAgIGNvbnN0IGZpcnN0Q2xhc3MgPSBjbGFzc0lucHV0c1swXTtcbiAgICAgIGNvbnN0IG1hcEJhc2VkQ2xhc3NJbnB1dCA9IGZpcnN0Q2xhc3MgJiYgaXNDbGFzc0JpbmRpbmcoZmlyc3RDbGFzcykgPyBmaXJzdENsYXNzIDogbnVsbDtcblxuICAgICAgY29uc3Qgc3R5bGluZ0lucHV0ID0gbWFwQmFzZWRTdHlsZUlucHV0IHx8IG1hcEJhc2VkQ2xhc3NJbnB1dDtcbiAgICAgIGlmIChzdHlsaW5nSW5wdXQpIHtcbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzdHlsaW5nSW5wdXQuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxpbmdNYXAsICgpID0+IHtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW2luZGV4TGl0ZXJhbF07XG5cbiAgICAgICAgICBpZiAobWFwQmFzZWRDbGFzc0lucHV0KSB7XG4gICAgICAgICAgICBjb25zdCBtYXBCYXNlZENsYXNzVmFsdWUgPSBtYXBCYXNlZENsYXNzSW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCBtYXBCYXNlZENsYXNzVmFsdWUsIHRydWUpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1hcEJhc2VkU3R5bGVJbnB1dCkge1xuICAgICAgICAgICAgcGFyYW1zLnB1c2goby5OVUxMX0VYUFIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChtYXBCYXNlZFN0eWxlSW5wdXQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1hcEJhc2VkU3R5bGVWYWx1ZSA9IG1hcEJhc2VkU3R5bGVJbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgICAgICBwYXJhbXMucHVzaCh0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIG1hcEJhc2VkU3R5bGVWYWx1ZSwgdHJ1ZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBsZXQgbGFzdElucHV0Q29tbWFuZDogdC5Cb3VuZEF0dHJpYnV0ZXxudWxsID0gbnVsbDtcbiAgICAgIGlmIChzdHlsZUlucHV0cy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGkgPSBtYXBCYXNlZFN0eWxlSW5wdXQgPyAxIDogMDtcbiAgICAgICAgZm9yIChpOyBpIDwgc3R5bGVJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBpbnB1dCA9IHN0eWxlSW5wdXRzW2ldO1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcblxuICAgICAgICAgIGNvbnN0IGtleSA9IGlucHV0Lm5hbWU7XG4gICAgICAgICAgY29uc3Qgc3R5bGVJbmRleDogbnVtYmVyID0gc3R5bGVzSW5kZXhNYXBba2V5XSAhO1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oaW5wdXQuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxlUHJvcCwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgaW5kZXhMaXRlcmFsLCBvLmxpdGVyYWwoc3R5bGVJbmRleCksXG4gICAgICAgICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUsIHRydWUpLCAuLi5wYXJhbXNcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0SW5wdXRDb21tYW5kID0gc3R5bGVJbnB1dHNbc3R5bGVJbnB1dHMubGVuZ3RoIC0gMV07XG4gICAgICB9XG5cbiAgICAgIGlmIChjbGFzc0lucHV0cy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGkgPSBtYXBCYXNlZENsYXNzSW5wdXQgPyAxIDogMDtcbiAgICAgICAgZm9yIChpOyBpIDwgY2xhc3NJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBpbnB1dCA9IGNsYXNzSW5wdXRzW2ldO1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgICAgaWYgKHNhbml0aXphdGlvblJlZikgcGFyYW1zLnB1c2goc2FuaXRpemF0aW9uUmVmKTtcblxuICAgICAgICAgIGNvbnN0IGtleSA9IGlucHV0Lm5hbWU7XG4gICAgICAgICAgY29uc3QgY2xhc3NJbmRleDogbnVtYmVyID0gY2xhc3Nlc0luZGV4TWFwW2tleV0gITtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGlucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRDbGFzc1Byb3AsICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIGluZGV4TGl0ZXJhbCwgby5saXRlcmFsKGNsYXNzSW5kZXgpLFxuICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlLCB0cnVlKSwgLi4ucGFyYW1zXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdElucHV0Q29tbWFuZCA9IGNsYXNzSW5wdXRzW2NsYXNzSW5wdXRzLmxlbmd0aCAtIDFdO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGxhc3RJbnB1dENvbW1hbmQgIS5zb3VyY2VTcGFuLCBSMy5lbGVtZW50U3R5bGluZ0FwcGx5LCBbaW5kZXhMaXRlcmFsXSk7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgZWxlbWVudCBpbnB1dCBiaW5kaW5nc1xuICAgIGFsbE90aGVySW5wdXRzLmZvckVhY2goKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKSA9PiB7XG4gICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IG1hcEJpbmRpbmdUb0luc3RydWN0aW9uKGlucHV0LnR5cGUpO1xuICAgICAgaWYgKGlucHV0LnR5cGUgPT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgLy8gc2V0QXR0cmlidXRlIHdpdGhvdXQgYSB2YWx1ZSBkb2Vzbid0IG1ha2UgYW55IHNlbnNlXG4gICAgICAgIGlmICh2YWx1ZS5uYW1lIHx8IHZhbHVlLnZhbHVlKSB7XG4gICAgICAgICAgY29uc3QgbmFtZSA9IHByZXBhcmVTeW50aGV0aWNBdHRyaWJ1dGVOYW1lKGlucHV0Lm5hbWUpO1xuICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oaW5wdXQuc291cmNlU3BhbiwgUjMuZWxlbWVudEF0dHJpYnV0ZSwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChuYW1lKSwgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSlcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQsIGlucHV0LnNlY3VyaXR5Q29udGV4dCk7XG4gICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG5cbiAgICAgICAgLy8gVE9ETyhjaHVja2opOiBydW50aW1lOiBzZWN1cml0eSBjb250ZXh0XG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGlucHV0LnNvdXJjZVNwYW4sIGluc3RydWN0aW9uLCAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBvLmxpdGVyYWwoaW5wdXQubmFtZSksXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlKSwgLi4ucGFyYW1zXG4gICAgICAgICAgXTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91bnN1cHBvcnRlZChgYmluZGluZyB0eXBlICR7aW5wdXQudHlwZX1gKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbiAmJiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA9PSAxICYmXG4gICAgICAgIGVsZW1lbnQuY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgIGNvbnN0IHRleHQgPSBlbGVtZW50LmNoaWxkcmVuWzBdIGFzIHQuVGV4dDtcbiAgICAgIHRoaXMudmlzaXRTaW5nbGVJMThuVGV4dENoaWxkKHRleHQsIGkxOG5NZXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKTtcbiAgICB9XG5cbiAgICBpZiAoIWNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIC8vIEZpbmlzaCBlbGVtZW50IGNvbnN0cnVjdGlvbiBtb2RlLlxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LmVuZFNvdXJjZVNwYW4gfHwgZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5lbmFibGVCaW5kaW5ncyk7XG4gICAgICB9XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbixcbiAgICAgICAgICBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lckVuZCA6IFIzLmVsZW1lbnRFbmQpO1xuICAgIH1cblxuICAgIC8vIFJlc3RvcmUgdGhlIHN0YXRlIGJlZm9yZSBleGl0aW5nIHRoaXMgbm9kZVxuICAgIHRoaXMuX2luSTE4blNlY3Rpb24gPSB3YXNJbkkxOG5TZWN0aW9uO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogdC5UZW1wbGF0ZSkge1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGxldCBlbE5hbWUgPSAnJztcbiAgICBpZiAodGVtcGxhdGUuY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIHRlbXBsYXRlLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICAvLyBXaGVuIHRoZSB0ZW1wbGF0ZSBhcyBhIHNpbmdsZSBjaGlsZCwgZGVyaXZlIHRoZSBjb250ZXh0IG5hbWUgZnJvbSB0aGUgdGFnXG4gICAgICBlbE5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIoKHRlbXBsYXRlLmNoaWxkcmVuWzBdIGFzIHQuRWxlbWVudCkubmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBlbE5hbWUgPyBgJHt0aGlzLmNvbnRleHROYW1lfV8ke2VsTmFtZX1gIDogJyc7XG5cbiAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPVxuICAgICAgICBjb250ZXh0TmFtZSA/IGAke2NvbnRleHROYW1lfV9UZW1wbGF0ZV8ke3RlbXBsYXRlSW5kZXh9YCA6IGBUZW1wbGF0ZV8ke3RlbXBsYXRlSW5kZXh9YDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuICAgICAgby5UWVBFRF9OVUxMX0VYUFIsXG4gICAgXTtcblxuICAgIC8vIGZpbmQgZGlyZWN0aXZlcyBtYXRjaGluZyBvbiBhIGdpdmVuIDxuZy10ZW1wbGF0ZT4gbm9kZVxuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKCduZy10ZW1wbGF0ZScsIHRlbXBsYXRlKTtcblxuICAgIC8vIHByZXBhcmUgYXR0cmlidXRlcyBwYXJhbWV0ZXIgKGluY2x1ZGluZyBhdHRyaWJ1dGVzIHVzZWQgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZylcbiAgICBjb25zdCBhdHRyc0V4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIHRlbXBsYXRlLmF0dHJpYnV0ZXMuZm9yRWFjaChcbiAgICAgICAgKGE6IHQuVGV4dEF0dHJpYnV0ZSkgPT4geyBhdHRyc0V4cHJzLnB1c2goYXNMaXRlcmFsKGEubmFtZSksIGFzTGl0ZXJhbChhLnZhbHVlKSk7IH0pO1xuICAgIGF0dHJzRXhwcnMucHVzaCguLi50aGlzLnByZXBhcmVTeW50aGV0aWNBbmRTZWxlY3RPbmx5QXR0cnModGVtcGxhdGUuaW5wdXRzLCB0ZW1wbGF0ZS5vdXRwdXRzKSk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMudG9BdHRyc1BhcmFtKGF0dHJzRXhwcnMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPG5nLXRlbXBsYXRlICNmb28+KVxuICAgIGlmICh0ZW1wbGF0ZS5yZWZlcmVuY2VzICYmIHRlbXBsYXRlLnJlZmVyZW5jZXMubGVuZ3RoKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5wcmVwYXJlUmVmc1BhcmFtZXRlcih0ZW1wbGF0ZS5yZWZlcmVuY2VzKSk7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5pbXBvcnRFeHByKFIzLnRlbXBsYXRlUmVmRXh0cmFjdG9yKSk7XG4gICAgfVxuXG4gICAgLy8gaGFuZGxlIHByb3BlcnR5IGJpbmRpbmdzIGUuZy4gcCgxLCAnZm9yT2YnLCDJtWJpbmQoY3R4Lml0ZW1zKSk7XG4gICAgY29uc3QgY29udGV4dCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgICB0ZW1wbGF0ZS5pbnB1dHMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy5lbGVtZW50UHJvcGVydHksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSxcbiAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoY29udGV4dCwgdmFsdWUpXG4gICAgICAgIF07XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSB0aGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAgICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0ZW1wbGF0ZU5hbWUsIFtdLFxuICAgICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIsIHRoaXMuZGlyZWN0aXZlcywgdGhpcy5waXBlVHlwZUJ5TmFtZSwgdGhpcy5waXBlcywgdGhpcy5fbmFtZXNwYWNlLFxuICAgICAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXgpO1xuXG4gICAgLy8gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsIGFmdGVyIHRoZWlyIHBhcmVudCB0ZW1wbGF0ZXMgaGF2ZSBjb21wbGV0ZWRcbiAgICAvLyBwcm9jZXNzaW5nLCBzbyB0aGV5IGFyZSBxdWV1ZWQgaGVyZSB1bnRpbCBhZnRlciB0aGUgaW5pdGlhbCBwYXNzLiBPdGhlcndpc2UsIHdlIHdvdWxkbid0XG4gICAgLy8gYmUgYWJsZSB0byBzdXBwb3J0IGJpbmRpbmdzIGluIG5lc3RlZCB0ZW1wbGF0ZXMgdG8gbG9jYWwgcmVmcyB0aGF0IG9jY3VyIGFmdGVyIHRoZVxuICAgIC8vIHRlbXBsYXRlIGRlZmluaXRpb24uIGUuZy4gPGRpdiAqbmdJZj1cInNob3dpbmdcIj4ge3sgZm9vIH19IDwvZGl2PiAgPGRpdiAjZm9vPjwvZGl2PlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPVxuICAgICAgICAgIHRlbXBsYXRlVmlzaXRvci5idWlsZFRlbXBsYXRlRnVuY3Rpb24odGVtcGxhdGUuY2hpbGRyZW4sIHRlbXBsYXRlLnZhcmlhYmxlcyk7XG4gICAgICB0aGlzLmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2godGVtcGxhdGVGdW5jdGlvbkV4cHIudG9EZWNsU3RtdCh0ZW1wbGF0ZU5hbWUsIG51bGwpKTtcbiAgICB9KTtcblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZShcbiAgICAgICAgICAyLCAwLCBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldENvbnN0Q291bnQoKSksXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBsaXN0ZW5lcnMgZm9yIGRpcmVjdGl2ZSBvdXRwdXRcbiAgICB0ZW1wbGF0ZS5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgb3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLFxuICAgICAgICAgIHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKCduZ190ZW1wbGF0ZScsIG91dHB1dEFzdCkpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gVGhlc2Ugc2hvdWxkIGJlIGhhbmRsZWQgaW4gdGhlIHRlbXBsYXRlIG9yIGVsZW1lbnQgZGlyZWN0bHkuXG4gIHJlYWRvbmx5IHZpc2l0UmVmZXJlbmNlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRWYXJpYWJsZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VGV4dEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kRXZlbnQgPSBpbnZhbGlkO1xuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IHQuQm91bmRUZXh0KSB7XG4gICAgY29uc3Qgbm9kZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24odGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKG5vZGVJbmRleCldKTtcblxuICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0QmluZGluZyxcbiAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChub2RlSW5kZXgpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoby52YXJpYWJsZShDT05URVhUX05BTUUpLCB2YWx1ZSldKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIG8ubGl0ZXJhbCh0ZXh0LnZhbHVlKV0pO1xuICB9XG5cbiAgLy8gV2hlbiB0aGUgY29udGVudCBvZiB0aGUgZWxlbWVudCBpcyBhIHNpbmdsZSB0ZXh0IG5vZGUgdGhlIHRyYW5zbGF0aW9uIGNhbiBiZSBpbmxpbmVkOlxuICAvL1xuICAvLyBgPHAgaTE4bj1cImRlc2N8bWVhblwiPnNvbWUgY29udGVudDwvcD5gXG4gIC8vIGNvbXBpbGVzIHRvXG4gIC8vIGBgYFxuICAvLyAvKipcbiAgLy8gKiBAZGVzYyBkZXNjXG4gIC8vICogQG1lYW5pbmcgbWVhblxuICAvLyAqL1xuICAvLyBjb25zdCBNU0dfWFlaID0gZ29vZy5nZXRNc2coJ3NvbWUgY29udGVudCcpO1xuICAvLyBpMC7JtXRleHQoMSwgTVNHX1hZWik7XG4gIC8vIGBgYFxuICB2aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dDogdC5UZXh0LCBpMThuTWV0YTogc3RyaW5nKSB7XG4gICAgY29uc3QgbWV0YSA9IHBhcnNlSTE4bk1ldGEoaTE4bk1ldGEpO1xuICAgIGNvbnN0IHZhcmlhYmxlID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0VHJhbnNsYXRpb24odGV4dC52YWx1ZSwgbWV0YSwgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4KTtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIHZhcmlhYmxlXSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlRGF0YVNsb3QoKSB7IHJldHVybiB0aGlzLl9kYXRhSW5kZXgrKzsgfVxuXG4gIGdldENvbnN0Q291bnQoKSB7IHJldHVybiB0aGlzLl9kYXRhSW5kZXg7IH1cblxuICBnZXRWYXJDb3VudCgpIHsgcmV0dXJuIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzOyB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHsgcmV0dXJuIGAke3RoaXMuX2JpbmRpbmdDb250ZXh0Kyt9YDsgfVxuXG4gIC8vIEJpbmRpbmdzIG11c3Qgb25seSBiZSByZXNvbHZlZCBhZnRlciBhbGwgbG9jYWwgcmVmcyBoYXZlIGJlZW4gdmlzaXRlZCwgc28gYWxsXG4gIC8vIGluc3RydWN0aW9ucyBhcmUgcXVldWVkIGluIGNhbGxiYWNrcyB0aGF0IGV4ZWN1dGUgb25jZSB0aGUgaW5pdGlhbCBwYXNzIGhhcyBjb21wbGV0ZWQuXG4gIC8vIE90aGVyd2lzZSwgd2Ugd291bGRuJ3QgYmUgYWJsZSB0byBzdXBwb3J0IGxvY2FsIHJlZnMgdGhhdCBhcmUgZGVmaW5lZCBhZnRlciB0aGVpclxuICAvLyBiaW5kaW5ncy4gZS5nLiB7eyBmb28gfX0gPGRpdiAjZm9vPjwvZGl2PlxuICBwcml2YXRlIGluc3RydWN0aW9uRm4oXG4gICAgICBmbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm46IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpOiB2b2lkIHtcbiAgICBmbnMucHVzaCgoKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBBcnJheS5pc0FycmF5KHBhcmFtc09yRm4pID8gcGFyYW1zT3JGbiA6IHBhcmFtc09yRm4oKTtcbiAgICAgIHJldHVybiBpbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIHBhcmFtcykudG9TdG10KCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fY3JlYXRpb25Db2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSkge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10pO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IG9yaWdpbmFsU2xvdHMgPSB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cztcbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSBudW1TbG90cztcbiAgICByZXR1cm4gb3JpZ2luYWxTbG90cztcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWU6IEFTVCkge1xuICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAxO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0OiBvLkV4cHJlc3Npb24sIHZhbHVlOiBBU1QsIHNraXBCaW5kRm4/OiBib29sZWFuKTpcbiAgICAgIG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbkZuID1cbiAgICAgICAgdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gaW50ZXJwb2xhdGUgOiAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJyk7XG5cbiAgICBjb25zdCBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICB0aGlzLCBpbXBsaWNpdCwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLCBpbnRlcnBvbGF0aW9uRm4pO1xuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5jb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuc3RtdHMpO1xuXG4gICAgY29uc3QgdmFsRXhwciA9IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5jdXJyVmFsRXhwcjtcbiAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uIHx8IHNraXBCaW5kRm4gPyB2YWxFeHByIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFt2YWxFeHByXSk7XG4gIH1cblxuICBwcml2YXRlIG1hdGNoRGlyZWN0aXZlcyh0YWdOYW1lOiBzdHJpbmcsIGVsT3JUcGw6IHQuRWxlbWVudHx0LlRlbXBsYXRlKSB7XG4gICAgaWYgKHRoaXMuZGlyZWN0aXZlTWF0Y2hlcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVDc3NTZWxlY3Rvcih0YWdOYW1lLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGwpKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZVN5bnRoZXRpY0FuZFNlbGVjdE9ubHlBdHRycyhpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgb3V0cHV0czogdC5Cb3VuZEV2ZW50W10pOlxuICAgICAgby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGF0dHJFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBub25TeW50aGV0aWNJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgaWYgKGlucHV0cy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IEVNUFRZX1NUUklOR19FWFBSID0gYXNMaXRlcmFsKCcnKTtcbiAgICAgIGlucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgICAgaWYgKGlucHV0LnR5cGUgPT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICAgIC8vIEBhdHRyaWJ1dGVzIGFyZSBmb3IgUmVuZGVyZXIyIGFuaW1hdGlvbiBAdHJpZ2dlcnMsIGJ1dCB0aGlzIGZlYXR1cmVcbiAgICAgICAgICAvLyBtYXkgYmUgc3VwcG9ydGVkIGRpZmZlcmVudGx5IGluIGZ1dHVyZSB2ZXJzaW9ucyBvZiBhbmd1bGFyLiBIb3dldmVyLFxuICAgICAgICAgIC8vIEB0cmlnZ2VycyBzaG91bGQgYWx3YXlzIGp1c3QgYmUgdHJlYXRlZCBhcyByZWd1bGFyIGF0dHJpYnV0ZXMgKGl0J3MgdXBcbiAgICAgICAgICAvLyB0byB0aGUgcmVuZGVyZXIgdG8gZGV0ZWN0IGFuZCB1c2UgdGhlbSBpbiBhIHNwZWNpYWwgd2F5KS5cbiAgICAgICAgICBhdHRyRXhwcnMucHVzaChhc0xpdGVyYWwocHJlcGFyZVN5bnRoZXRpY0F0dHJpYnV0ZU5hbWUoaW5wdXQubmFtZSkpLCBFTVBUWV9TVFJJTkdfRVhQUik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbm9uU3ludGhldGljSW5wdXRzLnB1c2goaW5wdXQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAobm9uU3ludGhldGljSW5wdXRzLmxlbmd0aCB8fCBvdXRwdXRzLmxlbmd0aCkge1xuICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlNlbGVjdE9ubHkpKTtcbiAgICAgIG5vblN5bnRoZXRpY0lucHV0cy5mb3JFYWNoKChpOiB0LkJvdW5kQXR0cmlidXRlKSA9PiBhdHRyRXhwcnMucHVzaChhc0xpdGVyYWwoaS5uYW1lKSkpO1xuICAgICAgb3V0cHV0cy5mb3JFYWNoKChvOiB0LkJvdW5kRXZlbnQpID0+IGF0dHJFeHBycy5wdXNoKGFzTGl0ZXJhbChvLm5hbWUpKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGF0dHJFeHBycztcbiAgfVxuXG4gIHByaXZhdGUgdG9BdHRyc1BhcmFtKGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gYXR0cnNFeHBycy5sZW5ndGggPiAwID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihhdHRyc0V4cHJzKSwgdHJ1ZSkgOlxuICAgICAgICBvLlRZUEVEX05VTExfRVhQUjtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZVJlZnNQYXJhbWV0ZXIocmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFyZWZlcmVuY2VzIHx8IHJlZmVyZW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgcmVmc1BhcmFtID0gZmxhdHRlbihyZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsXG4gICAgICAgICAgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiB4KDIpO1xuICAgICAgICAgICAgY29uc3QgbmV4dENvbnRleHRTdG10ID1cbiAgICAgICAgICAgICAgICByZWxhdGl2ZUxldmVsID4gMCA/IFtnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKS50b1N0bXQoKV0gOiBbXTtcblxuICAgICAgICAgICAgLy8gZS5nLiBjb25zdCAkZm9vJCA9IHIoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSk7XG4gICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgIH0pKTtcblxuICAgIHJldHVybiB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHJlZnNQYXJhbSksIHRydWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIodGFnTmFtZTogc3RyaW5nLCBvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCk6ICgpID0+IG8uRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCBldk5hbWVTYW5pdGl6ZWQgPSBzYW5pdGl6ZUlkZW50aWZpZXIob3V0cHV0QXN0Lm5hbWUpO1xuICAgIGNvbnN0IHRhZ05hbWVTYW5pdGl6ZWQgPSBzYW5pdGl6ZUlkZW50aWZpZXIodGFnTmFtZSk7XG4gICAgY29uc3QgZnVuY3Rpb25OYW1lID0gYCR7dGhpcy50ZW1wbGF0ZU5hbWV9XyR7dGFnTmFtZVNhbml0aXplZH1fJHtldk5hbWVTYW5pdGl6ZWR9X2xpc3RlbmVyYDtcblxuICAgIHJldHVybiAoKSA9PiB7XG5cbiAgICAgIGNvbnN0IGxpc3RlbmVyU2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUodGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCk7XG5cbiAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgICAgICAgbGlzdGVuZXJTY29wZSwgby52YXJpYWJsZShDT05URVhUX05BTUUpLCBvdXRwdXRBc3QuaGFuZGxlciwgJ2InLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG5cbiAgICAgIGNvbnN0IHN0YXRlbWVudHMgPSBbXG4gICAgICAgIC4uLmxpc3RlbmVyU2NvcGUucmVzdG9yZVZpZXdTdGF0ZW1lbnQoKSwgLi4ubGlzdGVuZXJTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLFxuICAgICAgICAuLi5iaW5kaW5nRXhwci5yZW5kZXIzU3RtdHNcbiAgICAgIF07XG5cbiAgICAgIGNvbnN0IGhhbmRsZXIgPSBvLmZuKFxuICAgICAgICAgIFtuZXcgby5GblBhcmFtKCckZXZlbnQnLCBvLkRZTkFNSUNfVFlQRSldLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgICAgZnVuY3Rpb25OYW1lKTtcblxuICAgICAgcmV0dXJuIFtvLmxpdGVyYWwob3V0cHV0QXN0Lm5hbWUpLCBoYW5kbGVyXTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWYWx1ZUNvbnZlcnRlciBleHRlbmRzIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyIHtcbiAgcHJpdmF0ZSBfcGlwZUJpbmRFeHByczogRnVuY3Rpb25DYWxsW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgb25lIHNsb3QgcGVyIHBpcGUgYXJndW1lbnRcbiAgICBjb25zdCBwdXJlRnVuY3Rpb25TbG90ID0gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKDIgKyBwaXBlLmFyZ3MubGVuZ3RoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKHBpcGUuc3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuKSwgc2xvdFBzZXVkb0xvY2FsKTtcbiAgICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcGlwZUJpbmRpbmdDYWxsSW5mbyhwaXBlLmFyZ3MpO1xuICAgIHRoaXMuZGVmaW5lUGlwZShwaXBlLm5hbWUsIHNsb3RQc2V1ZG9Mb2NhbCwgc2xvdCwgby5pbXBvcnRFeHByKGlkZW50aWZpZXIpKTtcbiAgICBjb25zdCBhcmdzOiBBU1RbXSA9IFtwaXBlLmV4cCwgLi4ucGlwZS5hcmdzXTtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzOiBBU1RbXSA9XG4gICAgICAgIGlzVmFyTGVuZ3RoID8gdGhpcy52aXNpdEFsbChbbmV3IExpdGVyYWxBcnJheShwaXBlLnNwYW4sIGFyZ3MpXSkgOiB0aGlzLnZpc2l0QWxsKGFyZ3MpO1xuXG4gICAgY29uc3QgcGlwZUJpbmRFeHByID0gbmV3IEZ1bmN0aW9uQ2FsbChwaXBlLnNwYW4sIHRhcmdldCwgW1xuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBzbG90KSxcbiAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3BhbiwgcHVyZUZ1bmN0aW9uU2xvdCksXG4gICAgICAuLi5jb252ZXJ0ZWRBcmdzLFxuICAgIF0pO1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMucHVzaChwaXBlQmluZEV4cHIpO1xuICAgIHJldHVybiBwaXBlQmluZEV4cHI7XG4gIH1cblxuICB1cGRhdGVQaXBlU2xvdE9mZnNldHMoYmluZGluZ1Nsb3RzOiBudW1iZXIpIHtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLmZvckVhY2goKHBpcGU6IEZ1bmN0aW9uQ2FsbCkgPT4ge1xuICAgICAgLy8gdXBkYXRlIHRoZSBzbG90IG9mZnNldCBhcmcgKGluZGV4IDEpIHRvIGFjY291bnQgZm9yIGJpbmRpbmcgc2xvdHNcbiAgICAgIGNvbnN0IHNsb3RPZmZzZXQgPSBwaXBlLmFyZ3NbMV0gYXMgTGl0ZXJhbFByaW1pdGl2ZTtcbiAgICAgIChzbG90T2Zmc2V0LnZhbHVlIGFzIG51bWJlcikgKz0gYmluZGluZ1Nsb3RzO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXJyYXk6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoYXJyYXkuc3BhbiwgdGhpcy52aXNpdEFsbChhcnJheS5leHByZXNzaW9ucyksIHZhbHVlcyA9PiB7XG4gICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuIE90aGVyd2lzZSwganVzdCByZXR1cm4gYW4gbGl0ZXJhbCBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsQXJyKHZhbHVlcyk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID9cbiAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKG1hcDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwobWFwLnNwYW4sIHRoaXMudmlzaXRBbGwobWFwLnZhbHVlcyksIHZhbHVlcyA9PiB7XG4gICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzICB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbE1hcCh2YWx1ZXMubWFwKFxuICAgICAgICAgICh2YWx1ZSwgaW5kZXgpID0+ICh7a2V5OiBtYXAua2V5c1tpbmRleF0ua2V5LCB2YWx1ZSwgcXVvdGVkOiBtYXAua2V5c1tpbmRleF0ucXVvdGVkfSkpKTtcbiAgICAgIHJldHVybiB2YWx1ZXMuZXZlcnkoYSA9PiBhLmlzQ29uc3RhbnQoKSkgP1xuICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChsaXRlcmFsLCB0cnVlKSA6XG4gICAgICAgICAgZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gUGlwZXMgYWx3YXlzIGhhdmUgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciwgdGhlIHZhbHVlIHRoZXkgb3BlcmF0ZSBvblxuY29uc3QgcGlwZUJpbmRpbmdJZGVudGlmaWVycyA9IFtSMy5waXBlQmluZDEsIFIzLnBpcGVCaW5kMiwgUjMucGlwZUJpbmQzLCBSMy5waXBlQmluZDRdO1xuXG5mdW5jdGlvbiBwaXBlQmluZGluZ0NhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwaXBlQmluZGluZ0lkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnBpcGVCaW5kVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmNvbnN0IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzID0gW1xuICBSMy5wdXJlRnVuY3Rpb24wLCBSMy5wdXJlRnVuY3Rpb24xLCBSMy5wdXJlRnVuY3Rpb24yLCBSMy5wdXJlRnVuY3Rpb24zLCBSMy5wdXJlRnVuY3Rpb240LFxuICBSMy5wdXJlRnVuY3Rpb241LCBSMy5wdXJlRnVuY3Rpb242LCBSMy5wdXJlRnVuY3Rpb243LCBSMy5wdXJlRnVuY3Rpb244XG5dO1xuXG5mdW5jdGlvbiBwdXJlRnVuY3Rpb25DYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucHVyZUZ1bmN0aW9uVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGluc3RydWN0aW9uKFxuICAgIHNwYW46IFBhcnNlU291cmNlU3BhbiB8IG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICBwYXJhbXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihyZWZlcmVuY2UsIG51bGwsIHNwYW4pLmNhbGxGbihwYXJhbXMsIHNwYW4pO1xufVxuXG4vLyBlLmcuIHgoMik7XG5mdW5jdGlvbiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsRGlmZjogbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5uZXh0Q29udGV4dClcbiAgICAgIC5jYWxsRm4ocmVsYXRpdmVMZXZlbERpZmYgPiAxID8gW28ubGl0ZXJhbChyZWxhdGl2ZUxldmVsRGlmZildIDogW10pO1xufVxuXG5mdW5jdGlvbiBnZXRMaXRlcmFsRmFjdG9yeShcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbGl0ZXJhbDogby5MaXRlcmFsQXJyYXlFeHByIHwgby5MaXRlcmFsTWFwRXhwcixcbiAgICBhbGxvY2F0ZVNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3Qge2xpdGVyYWxGYWN0b3J5LCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50c30gPSBjb25zdGFudFBvb2wuZ2V0TGl0ZXJhbEZhY3RvcnkobGl0ZXJhbCk7XG4gIC8vIEFsbG9jYXRlIDEgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIDEgcGVyIGFyZ3VtZW50XG4gIGNvbnN0IHN0YXJ0U2xvdCA9IGFsbG9jYXRlU2xvdHMoMSArIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCk7XG4gIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCA+IDAgfHwgZXJyb3IoYEV4cGVjdGVkIGFyZ3VtZW50cyB0byBhIGxpdGVyYWwgZmFjdG9yeSBmdW5jdGlvbmApO1xuICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcHVyZUZ1bmN0aW9uQ2FsbEluZm8obGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuXG4gIC8vIExpdGVyYWwgZmFjdG9yaWVzIGFyZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG9ubHkgbmVlZCB0byBiZSByZS1pbnZva2VkIHdoZW4gdGhlIHBhcmFtZXRlcnNcbiAgLy8gY2hhbmdlLlxuICBjb25zdCBhcmdzID0gW1xuICAgIG8ubGl0ZXJhbChzdGFydFNsb3QpLFxuICAgIGxpdGVyYWxGYWN0b3J5LFxuICBdO1xuXG4gIGlmIChpc1Zhckxlbmd0aCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWxBcnIobGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpKTtcbiAgfSBlbHNlIHtcbiAgICBhcmdzLnB1c2goLi4ubGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKS5jYWxsRm4oYXJncyk7XG59XG5cbi8qKlxuICogRnVuY3Rpb24gd2hpY2ggaXMgZXhlY3V0ZWQgd2hlbmV2ZXIgYSB2YXJpYWJsZSBpcyByZWZlcmVuY2VkIGZvciB0aGUgZmlyc3QgdGltZSBpbiBhIGdpdmVuXG4gKiBzY29wZS5cbiAqXG4gKiBJdCBpcyBleHBlY3RlZCB0aGF0IHRoZSBmdW5jdGlvbiBjcmVhdGVzIHRoZSBgY29uc3QgbG9jYWxOYW1lID0gZXhwcmVzc2lvbmA7IHN0YXRlbWVudC5cbiAqL1xuZXhwb3J0IHR5cGUgRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiBvLlN0YXRlbWVudFtdO1xuXG4vKiogVGhlIHByZWZpeCB1c2VkIHRvIGdldCBhIHNoYXJlZCBjb250ZXh0IGluIEJpbmRpbmdTY29wZSdzIG1hcC4gKi9cbmNvbnN0IFNIQVJFRF9DT05URVhUX0tFWSA9ICckJHNoYXJlZF9jdHgkJCc7XG5cbi8qKlxuICogVGhpcyBpcyB1c2VkIHdoZW4gb25lIHJlZmVycyB0byB2YXJpYWJsZSBzdWNoIGFzOiAnbGV0IGFiYyA9IHgoMikuJGltcGxpY2l0YC5cbiAqIC0ga2V5IHRvIHRoZSBtYXAgaXMgdGhlIHN0cmluZyBsaXRlcmFsIGBcImFiY1wiYC5cbiAqIC0gdmFsdWUgYHJldHJpZXZhbExldmVsYCBpcyB0aGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWQsIHdoaWNoIGlzIDIgbGV2ZWxzXG4gKiB1cCBpbiBleGFtcGxlLlxuICogLSB2YWx1ZSBgbGhzYCBpcyB0aGUgbGVmdCBoYW5kIHNpZGUgd2hpY2ggaXMgYW4gQVNUIHJlcHJlc2VudGluZyBgYWJjYC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVMb2NhbENhbGxiYWNrYCBpcyBhIGNhbGxiYWNrIHRoYXQgaXMgaW52b2tlZCB3aGVuIGRlY2xhcmluZyB0aGUgbG9jYWwuXG4gKiAtIHZhbHVlIGBkZWNsYXJlYCBpcyB0cnVlIGlmIHRoaXMgdmFsdWUgbmVlZHMgdG8gYmUgZGVjbGFyZWQuXG4gKiAtIHZhbHVlIGBwcmlvcml0eWAgZGljdGF0ZXMgdGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXIgZGVjbGFyYXRpb24gY29tcGFyZWRcbiAqIHRvIG90aGVyIHZhciBkZWNsYXJhdGlvbnMgb24gdGhlIHNhbWUgcmV0cmlldmFsIGxldmVsLiBGb3IgZXhhbXBsZSwgaWYgdGhlcmUgaXMgYVxuICogY29udGV4dCB2YXJpYWJsZSBhbmQgYSBsb2NhbCByZWYgYWNjZXNzaW5nIHRoZSBzYW1lIHBhcmVudCB2aWV3LCB0aGUgY29udGV4dCB2YXJcbiAqIGRlY2xhcmF0aW9uIHNob3VsZCBhbHdheXMgY29tZSBiZWZvcmUgdGhlIGxvY2FsIHJlZiBkZWNsYXJhdGlvbi5cbiAqL1xudHlwZSBCaW5kaW5nRGF0YSA9IHtcbiAgcmV0cmlldmFsTGV2ZWw6IG51bWJlcjsgbGhzOiBvLlJlYWRWYXJFeHByOyBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrO1xuICBkZWNsYXJlOiBib29sZWFuO1xuICBwcmlvcml0eTogbnVtYmVyO1xufTtcblxuLyoqXG4gKiBUaGUgc29ydGluZyBwcmlvcml0eSBvZiBhIGxvY2FsIHZhcmlhYmxlIGRlY2xhcmF0aW9uLiBIaWdoZXIgbnVtYmVyc1xuICogbWVhbiB0aGUgZGVjbGFyYXRpb24gd2lsbCBhcHBlYXIgZmlyc3QgaW4gdGhlIGdlbmVyYXRlZCBjb2RlLlxuICovXG5jb25zdCBlbnVtIERlY2xhcmF0aW9uUHJpb3JpdHkgeyBERUZBVUxUID0gMCwgQ09OVEVYVCA9IDEsIFNIQVJFRF9DT05URVhUID0gMiB9XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nU2NvcGUgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgLyoqIEtlZXBzIGEgbWFwIGZyb20gbG9jYWwgdmFyaWFibGVzIHRvIHRoZWlyIEJpbmRpbmdEYXRhLiAqL1xuICBwcml2YXRlIG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBCaW5kaW5nRGF0YT4oKTtcbiAgcHJpdmF0ZSByZWZlcmVuY2VOYW1lSW5kZXggPSAwO1xuICBwcml2YXRlIHJlc3RvcmVWaWV3VmFyaWFibGU6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc3RhdGljIF9ST09UX1NDT1BFOiBCaW5kaW5nU2NvcGU7XG5cbiAgc3RhdGljIGdldCBST09UX1NDT1BFKCk6IEJpbmRpbmdTY29wZSB7XG4gICAgaWYgKCFCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEUpIHtcbiAgICAgIEJpbmRpbmdTY29wZS5fUk9PVF9TQ09QRSA9IG5ldyBCaW5kaW5nU2NvcGUoKS5zZXQoMCwgJyRldmVudCcsIG8udmFyaWFibGUoJyRldmVudCcpKTtcbiAgICB9XG4gICAgcmV0dXJuIEJpbmRpbmdTY29wZS5fUk9PVF9TQ09QRTtcbiAgfVxuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocHVibGljIGJpbmRpbmdMZXZlbDogbnVtYmVyID0gMCwgcHJpdmF0ZSBwYXJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCkge31cblxuICBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGN1cnJlbnQubWFwLmdldChuYW1lKTtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSB0aGlzKSB7XG4gICAgICAgICAgLy8gbWFrZSBhIGxvY2FsIGNvcHkgYW5kIHJlc2V0IHRoZSBgZGVjbGFyZWAgc3RhdGVcbiAgICAgICAgICB2YWx1ZSA9IHtcbiAgICAgICAgICAgIHJldHJpZXZhbExldmVsOiB2YWx1ZS5yZXRyaWV2YWxMZXZlbCxcbiAgICAgICAgICAgIGxoczogdmFsdWUubGhzLFxuICAgICAgICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICAgICAgICBwcmlvcml0eTogdmFsdWUucHJpb3JpdHlcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQ2FjaGUgdGhlIHZhbHVlIGxvY2FsbHkuXG4gICAgICAgICAgdGhpcy5tYXAuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAvLyBQb3NzaWJseSBnZW5lcmF0ZSBhIHNoYXJlZCBjb250ZXh0IHZhclxuICAgICAgICAgIHRoaXMubWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUpO1xuICAgICAgICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldyh2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgJiYgIXZhbHVlLmRlY2xhcmUpIHtcbiAgICAgICAgICB2YWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCB0byB0aGlzIHBvaW50LCB3ZSBhcmUgbG9va2luZyBmb3IgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wIGxldmVsIGNvbXBvbmVudFxuICAgIC8vIC0gSWYgbGV2ZWwgPT09IDAsIHdlIGFyZSBvbiB0aGUgdG9wIGFuZCBkb24ndCBuZWVkIHRvIHJlLWRlY2xhcmUgYGN0eGAuXG4gICAgLy8gLSBJZiBsZXZlbCA+IDAsIHdlIGFyZSBpbiBhbiBlbWJlZGRlZCB2aWV3LiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGxvY2FsIHZhciB3ZSB1c2VkIHRvIHN0b3JlIHRoZSBjb21wb25lbnQgY29udGV4dCwgZS5nLiBjb25zdCAkY29tcCQgPSB4KCk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ0xldmVsID09PSAwID8gbnVsbCA6IHRoaXMuZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbG9jYWwgdmFyaWFibGUgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHJldHJpZXZhbExldmVsIFRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZFxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHByaW9yaXR5IFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyXG4gICAqIEBwYXJhbSBkZWNsYXJlTG9jYWxDYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIHdoZW4gZGVjbGFyaW5nIHRoaXMgbG9jYWwgdmFyXG4gICAqL1xuICBzZXQocmV0cmlldmFsTGV2ZWw6IG51bWJlciwgbmFtZTogc3RyaW5nLCBsaHM6IG8uUmVhZFZhckV4cHIsXG4gICAgICBwcmlvcml0eTogbnVtYmVyID0gRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayk6IEJpbmRpbmdTY29wZSB7XG4gICAgIXRoaXMubWFwLmhhcyhuYW1lKSB8fFxuICAgICAgICBlcnJvcihgVGhlIG5hbWUgJHtuYW1lfSBpcyBhbHJlYWR5IGRlZmluZWQgaW4gc2NvcGUgdG8gYmUgJHt0aGlzLm1hcC5nZXQobmFtZSl9YCk7XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHlcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IChvLkV4cHJlc3Npb258bnVsbCkgeyByZXR1cm4gdGhpcy5nZXQobmFtZSk7IH1cblxuICBuZXN0ZWRTY29wZShsZXZlbDogbnVtYmVyKTogQmluZGluZ1Njb3BlIHtcbiAgICBjb25zdCBuZXdTY29wZSA9IG5ldyBCaW5kaW5nU2NvcGUobGV2ZWwsIHRoaXMpO1xuICAgIGlmIChsZXZlbCA+IDApIG5ld1Njb3BlLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcigwKTtcbiAgICByZXR1cm4gbmV3U2NvcGU7XG4gIH1cblxuICBnZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwcnxudWxsIHtcbiAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwpO1xuICAgIHJldHVybiBzaGFyZWRDdHhPYmogJiYgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPyBzaGFyZWRDdHhPYmoubGhzIDogbnVsbDtcbiAgfVxuXG4gIG1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlOiBCaW5kaW5nRGF0YSkge1xuICAgIGlmICh2YWx1ZS5wcmlvcml0eSA9PT0gRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhUKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSB4KDIpO1xuICAgICAgICByZXR1cm4gW2xocy5zZXQoZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgfSxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgcHJpb3JpdHk6IERlY2xhcmF0aW9uUHJpb3JpdHkuU0hBUkVEX0NPTlRFWFRcbiAgICB9KTtcbiAgfVxuXG4gIGdldENvbXBvbmVudFByb3BlcnR5KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29tcG9uZW50VmFsdWUgPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgMCkgITtcbiAgICBjb21wb25lbnRWYWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcoMCk7XG4gICAgcmV0dXJuIGNvbXBvbmVudFZhbHVlLmxocy5wcm9wKG5hbWUpO1xuICB9XG5cbiAgbWF5YmVSZXN0b3JlVmlldyhyZXRyaWV2YWxMZXZlbDogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuaXNMaXN0ZW5lclNjb3BlKCkgJiYgcmV0cmlldmFsTGV2ZWwgPCB0aGlzLmJpbmRpbmdMZXZlbCkge1xuICAgICAgaWYgKCF0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUpIHtcbiAgICAgICAgLy8gcGFyZW50IHNhdmVzIHZhcmlhYmxlIHRvIGdlbmVyYXRlIGEgc2hhcmVkIGBjb25zdCAkcyQgPSBnVigpO2AgaW5zdHJ1Y3Rpb25cbiAgICAgICAgdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLnBhcmVudCAhLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA9IHRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZTtcbiAgICB9XG4gIH1cblxuICByZXN0b3JlVmlld1N0YXRlbWVudCgpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyByVigkc3RhdGUkKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW2luc3RydWN0aW9uKG51bGwsIFIzLnJlc3RvcmVWaWV3LCBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlXSkudG9TdG10KCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICB2aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIGNvbnN0ICRzdGF0ZSQgPSBnVigpO1xuICAgIGNvbnN0IGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24gPSBpbnN0cnVjdGlvbihudWxsLCBSMy5nZXRDdXJyZW50VmlldywgW10pO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlLnNldChnZXRDdXJyZW50Vmlld0luc3RydWN0aW9uKS50b0NvbnN0RGVjbCgpXSA6XG4gICAgICAgIFtdO1xuICB9XG5cbiAgaXNMaXN0ZW5lclNjb3BlKCkgeyByZXR1cm4gdGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQuYmluZGluZ0xldmVsID09PSB0aGlzLmJpbmRpbmdMZXZlbDsgfVxuXG4gIHZhcmlhYmxlRGVjbGFyYXRpb25zKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGxldCBjdXJyZW50Q29udGV4dExldmVsID0gMDtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLm1hcC52YWx1ZXMoKSlcbiAgICAgICAgLmZpbHRlcih2YWx1ZSA9PiB2YWx1ZS5kZWNsYXJlKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5yZXRyaWV2YWxMZXZlbCAtIGEucmV0cmlldmFsTGV2ZWwgfHwgYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpXG4gICAgICAgIC5yZWR1Y2UoKHN0bXRzOiBvLlN0YXRlbWVudFtdLCB2YWx1ZTogQmluZGluZ0RhdGEpID0+IHtcbiAgICAgICAgICBjb25zdCBsZXZlbERpZmYgPSB0aGlzLmJpbmRpbmdMZXZlbCAtIHZhbHVlLnJldHJpZXZhbExldmVsO1xuICAgICAgICAgIGNvbnN0IGN1cnJTdG10cyA9IHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrICEodGhpcywgbGV2ZWxEaWZmIC0gY3VycmVudENvbnRleHRMZXZlbCk7XG4gICAgICAgICAgY3VycmVudENvbnRleHRMZXZlbCA9IGxldmVsRGlmZjtcbiAgICAgICAgICByZXR1cm4gc3RtdHMuY29uY2F0KGN1cnJTdG10cyk7XG4gICAgICAgIH0sIFtdKSBhcyBvLlN0YXRlbWVudFtdO1xuICB9XG5cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZ2l2ZW4gYSB0YWcgbmFtZSBhbmQgYSBtYXAgb2YgYXR0cmlidXRlc1xuICovXG5mdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3Rvcih0YWc6IHN0cmluZywgYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuXG4gIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQodGFnKTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8vIFBhcnNlIGkxOG4gbWV0YXMgbGlrZTpcbi8vIC0gXCJAQGlkXCIsXG4vLyAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbi8vIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbmZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEoaTE4bj86IHN0cmluZyk6IHtkZXNjcmlwdGlvbj86IHN0cmluZywgaWQ/OiBzdHJpbmcsIG1lYW5pbmc/OiBzdHJpbmd9IHtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGlkOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGlmIChpMThuKSB7XG4gICAgLy8gVE9ETyh2aWNiKTogZmlndXJlIG91dCBob3cgdG8gZm9yY2UgYSBtZXNzYWdlIElEIHdpdGggY2xvc3VyZSA/XG4gICAgY29uc3QgaWRJbmRleCA9IGkxOG4uaW5kZXhPZihJRF9TRVBBUkFUT1IpO1xuXG4gICAgY29uc3QgZGVzY0luZGV4ID0gaTE4bi5pbmRleE9mKE1FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGlkXSA9XG4gICAgICAgIChpZEluZGV4ID4gLTEpID8gW2kxOG4uc2xpY2UoMCwgaWRJbmRleCksIGkxOG4uc2xpY2UoaWRJbmRleCArIDIpXSA6IFtpMThuLCAnJ107XG4gICAgW21lYW5pbmcsIGRlc2NyaXB0aW9uXSA9IChkZXNjSW5kZXggPiAtMSkgP1xuICAgICAgICBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldIDpcbiAgICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2Rlc2NyaXB0aW9uLCBpZCwgbWVhbmluZ307XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgYXJncyA9IGFyZ3Muc2xpY2UoMSk7ICAvLyBJZ25vcmUgdGhlIGxlbmd0aCBwcmVmaXggYWRkZWQgZm9yIHJlbmRlcjJcbiAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjEpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24yKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjQpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb242KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjcpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uOCkuY2FsbEZuKGFyZ3MpO1xuICB9XG4gIChhcmdzLmxlbmd0aCA+PSAxOSAmJiBhcmdzLmxlbmd0aCAlIDIgPT0gMSkgfHxcbiAgICAgIGVycm9yKGBJbnZhbGlkIGludGVycG9sYXRpb24gYXJndW1lbnQgbGVuZ3RoICR7YXJncy5sZW5ndGh9YCk7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvblYpLmNhbGxGbihbby5saXRlcmFsQXJyKGFyZ3MpXSk7XG59XG5cbi8qKlxuICogUGFyc2UgYSB0ZW1wbGF0ZSBpbnRvIHJlbmRlcjMgYE5vZGVgcyBhbmQgYWRkaXRpb25hbCBtZXRhZGF0YSwgd2l0aCBubyBvdGhlciBkZXBlbmRlbmNpZXMuXG4gKlxuICogQHBhcmFtIHRlbXBsYXRlIHRleHQgb2YgdGhlIHRlbXBsYXRlIHRvIHBhcnNlXG4gKiBAcGFyYW0gdGVtcGxhdGVVcmwgVVJMIHRvIHVzZSBmb3Igc291cmNlIG1hcHBpbmcgb2YgdGhlIHBhcnNlZCB0ZW1wbGF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiB7cHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW59ID0ge30sXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZyk6IHtcbiAgZXJyb3JzPzogUGFyc2VFcnJvcltdLFxuICBub2RlczogdC5Ob2RlW10sXG4gIGhhc05nQ29udGVudDogYm9vbGVhbixcbiAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSxcbiAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZ1xufSB7XG4gIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcbiAgY29uc3QgcGFyc2VSZXN1bHQgPSBodG1sUGFyc2VyLnBhcnNlKHRlbXBsYXRlLCB0ZW1wbGF0ZVVybCk7XG5cbiAgaWYgKHBhcnNlUmVzdWx0LmVycm9ycyAmJiBwYXJzZVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7XG4gICAgICBlcnJvcnM6IHBhcnNlUmVzdWx0LmVycm9ycyxcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIGhhc05nQ29udGVudDogZmFsc2UsXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aFxuICAgIH07XG4gIH1cblxuICBsZXQgcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IHBhcnNlUmVzdWx0LnJvb3ROb2RlcztcbiAgaWYgKCFvcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZXMpIHtcbiAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKG5ldyBXaGl0ZXNwYWNlVmlzaXRvcigpLCByb290Tm9kZXMpO1xuICB9XG5cbiAgY29uc3Qge25vZGVzLCBoYXNOZ0NvbnRlbnQsIG5nQ29udGVudFNlbGVjdG9ycywgZXJyb3JzfSA9XG4gICAgICBodG1sQXN0VG9SZW5kZXIzQXN0KHJvb3ROb2RlcywgYmluZGluZ1BhcnNlcik7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JzLFxuICAgICAgbm9kZXM6IFtdLFxuICAgICAgaGFzTmdDb250ZW50OiBmYWxzZSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW10sIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiB7bm9kZXMsIGhhc05nQ29udGVudCwgbmdDb250ZW50U2VsZWN0b3JzLCByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aH07XG59XG5cbi8qKlxuICogQ29uc3RydWN0IGEgYEJpbmRpbmdQYXJzZXJgIHdpdGggYSBkZWZhdWx0IGNvbmZpZ3VyYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlQmluZGluZ1BhcnNlcigpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgbmV3IFBhcnNlcihuZXcgTGV4ZXIoKSksIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKSwgbnVsbCxcbiAgICAgIFtdKTtcbn1cblxuZnVuY3Rpb24gaXNDbGFzc0JpbmRpbmcoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIGlucHV0Lm5hbWUgPT0gJ2NsYXNzTmFtZScgfHwgaW5wdXQubmFtZSA9PSAnY2xhc3MnO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUsIGNvbnRleHQ6IGNvcmUuU2VjdXJpdHlDb250ZXh0KSB7XG4gIHN3aXRjaCAoY29udGV4dCkge1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuSFRNTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVIdG1sKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNDUklQVDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTY3JpcHQpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU1RZTEU6XG4gICAgICAvLyB0aGUgY29tcGlsZXIgZG9lcyBub3QgZmlsbCBpbiBhbiBpbnN0cnVjdGlvbiBmb3IgW3N0eWxlLnByb3A/XSBiaW5kaW5nXG4gICAgICAvLyB2YWx1ZXMgYmVjYXVzZSB0aGUgc3R5bGUgYWxnb3JpdGhtIGtub3dzIGludGVybmFsbHkgd2hhdCBwcm9wcyBhcmUgc3ViamVjdFxuICAgICAgLy8gdG8gc2FuaXRpemF0aW9uIChvbmx5IFthdHRyLnN0eWxlXSB2YWx1ZXMgYXJlIGV4cGxpY2l0bHkgc2FuaXRpemVkKVxuICAgICAgcmV0dXJuIGlucHV0LnR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZSA/IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVN0eWxlKSA6IG51bGw7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVSZXNvdXJjZVVybCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgc3dpdGNoIChwcm9wKSB7XG4gICAgY2FzZSAnYmFja2dyb3VuZC1pbWFnZSc6XG4gICAgY2FzZSAnYmFja2dyb3VuZCc6XG4gICAgY2FzZSAnYm9yZGVyLWltYWdlJzpcbiAgICBjYXNlICdmaWx0ZXInOlxuICAgIGNhc2UgJ2xpc3Qtc3R5bGUnOlxuICAgIGNhc2UgJ2xpc3Qtc3R5bGUtaW1hZ2UnOlxuICAgICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBwcmVwYXJlU3ludGhldGljQXR0cmlidXRlTmFtZShuYW1lOiBzdHJpbmcpIHtcbiAgcmV0dXJuICdAJyArIG5hbWU7XG59XG4iXX0=