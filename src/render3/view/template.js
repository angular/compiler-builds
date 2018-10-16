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
        TemplateDefinitionBuilder.prototype.i18nTranslate = function (label, meta) {
            return this.constantPool.getTranslation(label, parseI18nMeta(meta), this.fileBasedI18nSuffix);
        };
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
                // Handle i18n and ngNonBindable attributes
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
            var i18nAttrs = [];
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
                        else if (attrI18nMetas.hasOwnProperty(input.name)) {
                            i18nAttrs.push({ name: input.name, value: input.value });
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
                    if (attrI18nMetas.hasOwnProperty(name)) {
                        i18nAttrs.push({ name: name, value: value });
                    }
                    else {
                        attributes.push(o.literal(name), o.literal(value));
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
                element.children.length === 0 && element.outputs.length === 0 && i18nAttrs.length === 0;
            if (createSelfClosingInstruction) {
                this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.element, util_2.trimTrailingNulls(parameters));
            }
            else {
                this.creationInstruction(element.sourceSpan, isNgContainer ? r3_identifiers_1.Identifiers.elementContainerStart : r3_identifiers_1.Identifiers.elementStart, util_2.trimTrailingNulls(parameters));
                if (isNonBindableMode) {
                    this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.disableBindings);
                }
                // process i18n element attributes
                if (i18nAttrs.length) {
                    var hasBindings_1 = false;
                    var i18nAttrArgs_1 = [];
                    i18nAttrs.forEach(function (_a) {
                        var name = _a.name, value = _a.value;
                        var meta = attrI18nMetas[name];
                        if (typeof value === 'string') {
                            // in case of static string value, 3rd argument is 0 declares
                            // that there are no expressions defined in this translation
                            i18nAttrArgs_1.push(o.literal(name), _this.i18nTranslate(value, meta), o.literal(0));
                        }
                        else {
                            var converted = value.visit(_this._valueConverter);
                            if (converted instanceof ast_1.Interpolation) {
                                var strings = converted.strings, expressions = converted.expressions;
                                var label = util_2.assembleI18nTemplate(strings);
                                i18nAttrArgs_1.push(o.literal(name), _this.i18nTranslate(label, meta), o.literal(expressions.length));
                                expressions.forEach(function (expression) {
                                    hasBindings_1 = true;
                                    var binding = _this.convertExpressionBinding(implicit, expression);
                                    _this.updateInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.i18nExp, [binding]);
                                });
                            }
                        }
                    });
                    if (i18nAttrArgs_1.length) {
                        var index = o.literal(this.allocateDataSlot());
                        var args = this.constantPool.getConstLiteral(o.literalArr(i18nAttrArgs_1), true);
                        this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.i18nAttribute, [index, args]);
                        if (hasBindings_1) {
                            this.updateInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.i18nApply, [index]);
                        }
                    }
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
                    for (i; i < styleInputs.length; i++) {
                        var input = styleInputs[i];
                        var key = input.name;
                        var styleIndex = stylesIndexMap[key];
                        var value = input.value.visit(this._valueConverter);
                        var params = [
                            indexLiteral_1, o.literal(styleIndex), this.convertPropertyBinding(implicit, value, true)
                        ];
                        if (input.unit != null) {
                            params.push(o.literal(input.unit));
                        }
                        this.updateInstruction(input.sourceSpan, r3_identifiers_1.Identifiers.elementStyleProp, params);
                    }
                    lastInputCommand = styleInputs[styleInputs.length - 1];
                }
                if (classInputs.length) {
                    var i = mapBasedClassInput_1 ? 1 : 0;
                    var _loop_1 = function () {
                        var input = classInputs[i];
                        var params = [];
                        var sanitizationRef = resolveSanitizationFn(input, input.securityContext);
                        if (sanitizationRef)
                            params.push(sanitizationRef);
                        var key = input.name;
                        var classIndex = classesIndexMap[key];
                        var value = input.value.visit(this_1._valueConverter);
                        this_1.updateInstruction(input.sourceSpan, r3_identifiers_1.Identifiers.elementClassProp, function () {
                            return tslib_1.__spread([
                                indexLiteral_1, o.literal(classIndex),
                                _this.convertPropertyBinding(implicit, value, true)
                            ], params);
                        });
                    };
                    var this_1 = this;
                    for (i; i < classInputs.length; i++) {
                        _loop_1();
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
            var variable = this.i18nTranslate(text.value, i18nMeta);
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
        TemplateDefinitionBuilder.prototype.convertExpressionBinding = function (implicit, value) {
            var convertedPropertyBinding = expression_converter_1.convertPropertyBinding(this, implicit, value, this.bindingContext(), expression_converter_1.BindingForm.TrySimple);
            var valExpr = convertedPropertyBinding.currValExpr;
            return o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([valExpr]);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUFtRTtJQUNuRSxpR0FBdUo7SUFFdkosaURBQW1DO0lBQ25DLG1FQUFrTjtJQUNsTix1RUFBb0Q7SUFDcEQseUVBQXNEO0lBQ3RELDBEQUE0QztJQUM1QywyRUFBdUQ7SUFDdkQscUZBQW1FO0lBQ25FLDZGQUFrRjtJQUNsRiw2REFBc0Y7SUFDdEYsMkRBQTZDO0lBRTdDLHdHQUFrRjtJQUNsRiwyREFBNEQ7SUFDNUQsdUZBQW1FO0lBQ25FLG1EQUFpQztJQUNqQyx3REFBK0I7SUFDL0IsK0VBQW9EO0lBQ3BELDZGQUE2RDtJQUc3RCxzRUFBcUM7SUFDckMsZ0VBQW1UO0lBRW5ULFNBQVMsdUJBQXVCLENBQUMsSUFBaUI7UUFDaEQsUUFBUSxJQUFJLEVBQUU7WUFDWjtnQkFDRSxPQUFPLDRCQUFFLENBQUMsZUFBZSxDQUFDO1lBQzVCO2dCQUNFLE9BQU8sNEJBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztZQUM3Qix1QkFBMkI7WUFDM0I7Z0JBQ0UsT0FBTyw0QkFBRSxDQUFDLGdCQUFnQixDQUFDO1lBQzdCO2dCQUNFLE9BQU8sU0FBUyxDQUFDO1NBQ3BCO0lBQ0gsQ0FBQztJQUVELDBCQUEwQjtJQUMxQixTQUFnQixxQkFBcUIsQ0FDakMsS0FBdUIsRUFBRSxVQUF5QjtRQUNwRCxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQkFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2xHLENBQUM7SUFI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Q0FBQztZQUNkLEtBQUssWUFBWSxDQUFDO1lBQ2xCLEtBQUssa0JBQWtCO2dCQUNyQixPQUFPLElBQUksQ0FBQztTQUNmO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsU0FBUyw2QkFBNkIsQ0FBQyxJQUFZO1FBQ2pELE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQztJQUNwQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2ZsYXR0ZW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBCdWlsdGluRnVuY3Rpb25DYWxsLCBMb2NhbFJlc29sdmVyLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsUHJpbWl0aXZlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge1doaXRlc3BhY2VWaXNpdG9yfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge2lzTmdDb250YWluZXIgYXMgY2hlY2tJc05nQ29udGFpbmVyLCBzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtodG1sQXN0VG9SZW5kZXIzQXN0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuXG5pbXBvcnQge1IzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtwYXJzZVN0eWxlfSBmcm9tICcuL3N0eWxpbmcnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIEkxOE5fQVRUUiwgSTE4Tl9BVFRSX1BSRUZJWCwgSURfU0VQQVJBVE9SLCBJTVBMSUNJVF9SRUZFUkVOQ0UsIE1FQU5JTkdfU0VQQVJBVE9SLCBOT05fQklOREFCTEVfQVRUUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBhc0xpdGVyYWwsIGFzc2VtYmxlSTE4blRlbXBsYXRlLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nLCBpbnZhbGlkLCBpc0kxOE5BdHRyaWJ1dGUsIG1hcFRvRXhwcmVzc2lvbiwgdHJpbVRyYWlsaW5nTnVsbHMsIHVuc3VwcG9ydGVkfSBmcm9tICcuL3V0aWwnO1xuXG5mdW5jdGlvbiBtYXBCaW5kaW5nVG9JbnN0cnVjdGlvbih0eXBlOiBCaW5kaW5nVHlwZSk6IG8uRXh0ZXJuYWxSZWZlcmVuY2V8dW5kZWZpbmVkIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eTpcbiAgICAgIHJldHVybiBSMy5lbGVtZW50UHJvcGVydHk7XG4gICAgY2FzZSBCaW5kaW5nVHlwZS5DbGFzczpcbiAgICAgIHJldHVybiBSMy5lbGVtZW50Q2xhc3NQcm9wO1xuICAgIGNhc2UgQmluZGluZ1R5cGUuQXR0cmlidXRlOlxuICAgIGNhc2UgQmluZGluZ1R5cGUuQW5pbWF0aW9uOlxuICAgICAgcmV0dXJuIFIzLmVsZW1lbnRBdHRyaWJ1dGU7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuLy8gIGlmIChyZiAmIGZsYWdzKSB7IC4uIH1cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgZmxhZ3M6IGNvcmUuUmVuZGVyRmxhZ3MsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10pOiBvLklmU3RtdCB7XG4gIHJldHVybiBvLmlmU3RtdChvLnZhcmlhYmxlKFJFTkRFUl9GTEFHUykuYml0d2lzZUFuZChvLmxpdGVyYWwoZmxhZ3MpLCBudWxsLCBmYWxzZSksIHN0YXRlbWVudHMpO1xufVxuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuXG4gICAqIFRoaXMgZW5zdXJlcyBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gZ2VuZXJhdGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgYXJlIHJlc29sdmVkIG9ubHkgb25jZSBhbGwgbm9kZXMgaGF2ZSBiZWVuIHZpc2l0ZWQuIFRoaXMgZW5zdXJlc1xuICAgKiBhbGwgbG9jYWwgcmVmcyBhbmQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGF2YWlsYWJsZSBmb3IgbWF0Y2hpbmcuXG4gICAqL1xuICBwcml2YXRlIF91cGRhdGVDb2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcbiAgLyoqIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZ2VuZXJhdGVkIGZyb20gdmlzaXRpbmcgcGlwZXMsIGxpdGVyYWxzLCBldGMuICovXG4gIHByaXZhdGUgX3RlbXBWYXJpYWJsZXM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGJ1aWxkIG5lc3RlZCB0ZW1wbGF0ZXMuIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbFxuICAgKiBhZnRlciB0aGUgcGFyZW50IHRlbXBsYXRlIGhhcyBmaW5pc2hlZCB2aXNpdGluZyBhbGwgb2YgaXRzIG5vZGVzLiBUaGlzIGVuc3VyZXMgdGhhdCBhbGxcbiAgICogbG9jYWwgcmVmIGJpbmRpbmdzIGluIG5lc3RlZCB0ZW1wbGF0ZXMgYXJlIGFibGUgdG8gZmluZCBsb2NhbCByZWYgdmFsdWVzIGlmIHRoZSByZWZzXG4gICAqIGFyZSBkZWZpbmVkIGFmdGVyIHRoZSB0ZW1wbGF0ZSBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgX25lc3RlZFRlbXBsYXRlRm5zOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICAvKipcbiAgICogVGhpcyBzY29wZSBjb250YWlucyBsb2NhbCB2YXJpYWJsZXMgZGVjbGFyZWQgaW4gdGhlIHVwZGF0ZSBtb2RlIGJsb2NrIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICogKGUuZy4gcmVmcyBhbmQgY29udGV4dCB2YXJzIGluIGJpbmRpbmdzKVxuICAgKi9cbiAgcHJpdmF0ZSBfYmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGU7XG4gIHByaXZhdGUgX3ZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcjtcbiAgcHJpdmF0ZSBfdW5zdXBwb3J0ZWQgPSB1bnN1cHBvcnRlZDtcblxuICAvLyBXaGV0aGVyIHdlIGFyZSBpbnNpZGUgYSB0cmFuc2xhdGFibGUgZWxlbWVudCAoYDxwIGkxOG4+Li4uIHNvbWV3aGVyZSBoZXJlIC4uLiA8L3A+KVxuICBwcml2YXRlIF9pbkkxOG5TZWN0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgX2kxOG5TZWN0aW9uSW5kZXggPSAtMTtcbiAgLy8gTWFwcyBvZiBwbGFjZWhvbGRlciB0byBub2RlIGluZGV4ZXMgZm9yIGVhY2ggb2YgdGhlIGkxOG4gc2VjdGlvblxuICBwcml2YXRlIF9waFRvTm9kZUlkeGVzOiB7W3BoTmFtZTogc3RyaW5nXTogbnVtYmVyW119W10gPSBbe31dO1xuXG4gIC8vIE51bWJlciBvZiBzbG90cyB0byByZXNlcnZlIGZvciBwdXJlRnVuY3Rpb25zXG4gIHByaXZhdGUgX3B1cmVGdW5jdGlvblNsb3RzID0gMDtcblxuICAvLyBOdW1iZXIgb2YgYmluZGluZyBzbG90c1xuICBwcml2YXRlIF9iaW5kaW5nU2xvdHMgPSAwO1xuXG4gIHByaXZhdGUgZmlsZUJhc2VkSTE4blN1ZmZpeDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgdGVtcGxhdGVOYW1lOiBzdHJpbmd8bnVsbCxcbiAgICAgIHByaXZhdGUgdmlld1F1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLCBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLFxuICAgICAgcHJpdmF0ZSBkaXJlY3RpdmVzOiBTZXQ8by5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPixcbiAgICAgIHByaXZhdGUgcGlwZXM6IFNldDxvLkV4cHJlc3Npb24+LCBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwcml2YXRlIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgICAvLyB2aWV3IHF1ZXJpZXMgY2FuIHRha2UgdXAgc3BhY2UgaW4gZGF0YSBhbmQgYWxsb2NhdGlvbiBoYXBwZW5zIGVhcmxpZXIgKGluIHRoZSBcInZpZXdRdWVyeVwiXG4gICAgLy8gZnVuY3Rpb24pXG4gICAgdGhpcy5fZGF0YUluZGV4ID0gdmlld1F1ZXJpZXMubGVuZ3RoO1xuXG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIC8vIFR1cm4gdGhlIHJlbGF0aXZlIGNvbnRleHQgZmlsZSBwYXRoIGludG8gYW4gaWRlbnRpZmllciBieSByZXBsYWNpbmcgbm9uLWFscGhhbnVtZXJpY1xuICAgIC8vIGNoYXJhY3RlcnMgd2l0aCB1bmRlcnNjb3Jlcy5cbiAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXggPSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKSArICdfJztcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcikgPT4gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzKSxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBwaXBlVHlwZSA9IHBpcGVUeXBlQnlOYW1lLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAocGlwZVR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMucGlwZXMuYWRkKHBpcGVUeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldCh0aGlzLmxldmVsLCBsb2NhbE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucGlwZSwgW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHZhcmlhYmxlOiB0LlZhcmlhYmxlKSB7XG4gICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZS5uYW1lICsgc2NvcGVkTmFtZSk7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHZhcmlhYmxlLm5hbWUsIGxocywgRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhULFxuICAgICAgICAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgbGV0IHJoczogby5FeHByZXNzaW9uO1xuICAgICAgICAgIGlmIChzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsKSB7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eFxuICAgICAgICAgICAgcmhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzaGFyZWRDdHhWYXIgPSBzY29wZS5nZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eF9yMCAgIE9SICB4KDIpO1xuICAgICAgICAgICAgcmhzID0gc2hhcmVkQ3R4VmFyID8gc2hhcmVkQ3R4VmFyIDogZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGl0ZW0kID0geCgyKS4kaW1wbGljaXQ7XG4gICAgICAgICAgcmV0dXJuIFtsaHMuc2V0KHJocy5wcm9wKHZhcmlhYmxlLnZhbHVlIHx8IElNUExJQ0lUX1JFRkVSRU5DRSkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIGhhc05nQ29udGVudDogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdKTogby5GdW5jdGlvbkV4cHIge1xuICAgIGlmICh0aGlzLl9uYW1lc3BhY2UgIT09IFIzLm5hbWVzcGFjZUhUTUwpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCB0aGlzLl9uYW1lc3BhY2UpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB2YXJpYWJsZSBiaW5kaW5nc1xuICAgIHZhcmlhYmxlcy5mb3JFYWNoKHYgPT4gdGhpcy5yZWdpc3RlckNvbnRleHRWYXJpYWJsZXModikpO1xuXG4gICAgLy8gT3V0cHV0IGEgYFByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIHdoZW4gc29tZSBgPG5nLWNvbnRlbnQ+YCBhcmUgcHJlc2VudFxuICAgIGlmIChoYXNOZ0NvbnRlbnQpIHtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICAgIC8vIE9ubHkgc2VsZWN0b3JzIHdpdGggYSBub24tZGVmYXVsdCB2YWx1ZSBhcmUgZ2VuZXJhdGVkXG4gICAgICBpZiAobmdDb250ZW50U2VsZWN0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY29uc3QgcjNTZWxlY3RvcnMgPSBuZ0NvbnRlbnRTZWxlY3RvcnMubWFwKHMgPT4gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHMpKTtcbiAgICAgICAgLy8gYHByb2plY3Rpb25EZWZgIG5lZWRzIGJvdGggdGhlIHBhcnNlZCBhbmQgcmF3IHZhbHVlIG9mIHRoZSBzZWxlY3RvcnNcbiAgICAgICAgY29uc3QgcGFyc2VkID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyM1NlbGVjdG9ycyksIHRydWUpO1xuICAgICAgICBjb25zdCB1blBhcnNlZCA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwobmdDb250ZW50U2VsZWN0b3JzKSwgdHJ1ZSk7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChwYXJzZWQsIHVuUGFyc2VkKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnByb2plY3Rpb25EZWYsIHBhcmFtZXRlcnMpO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaXMgdGhlIGluaXRpYWwgcGFzcyB0aHJvdWdoIHRoZSBub2RlcyBvZiB0aGlzIHRlbXBsYXRlLiBJbiB0aGlzIHBhc3MsIHdlXG4gICAgLy8gcXVldWUgYWxsIGNyZWF0aW9uIG1vZGUgYW5kIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyBmb3IgZ2VuZXJhdGlvbiBpbiB0aGUgc2Vjb25kXG4gICAgLy8gcGFzcy4gSXQncyBuZWNlc3NhcnkgdG8gc2VwYXJhdGUgdGhlIHBhc3NlcyB0byBlbnN1cmUgbG9jYWwgcmVmcyBhcmUgZGVmaW5lZCBiZWZvcmVcbiAgICAvLyByZXNvbHZpbmcgYmluZGluZ3MuIFdlIGFsc28gY291bnQgYmluZGluZ3MgaW4gdGhpcyBwYXNzIGFzIHdlIHdhbGsgYm91bmQgZXhwcmVzc2lvbnMuXG4gICAgdC52aXNpdEFsbCh0aGlzLCBub2Rlcyk7XG5cbiAgICAvLyBBZGQgdG90YWwgYmluZGluZyBjb3VudCB0byBwdXJlIGZ1bmN0aW9uIGNvdW50IHNvIHB1cmUgZnVuY3Rpb24gaW5zdHJ1Y3Rpb25zIGFyZVxuICAgIC8vIGdlbmVyYXRlZCB3aXRoIHRoZSBjb3JyZWN0IHNsb3Qgb2Zmc2V0IHdoZW4gdXBkYXRlIGluc3RydWN0aW9ucyBhcmUgcHJvY2Vzc2VkLlxuICAgIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IHRoaXMuX2JpbmRpbmdTbG90cztcblxuICAgIC8vIFBpcGVzIGFyZSB3YWxrZWQgaW4gdGhlIGZpcnN0IHBhc3MgKHRvIGVucXVldWUgYHBpcGUoKWAgY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGFuZFxuICAgIC8vIGBwaXBlQmluZGAgdXBkYXRlIGluc3RydWN0aW9ucyksIHNvIHdlIGhhdmUgdG8gdXBkYXRlIHRoZSBzbG90IG9mZnNldHMgbWFudWFsbHlcbiAgICAvLyB0byBhY2NvdW50IGZvciBiaW5kaW5ncy5cbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlci51cGRhdGVQaXBlU2xvdE9mZnNldHModGhpcy5fYmluZGluZ1Nsb3RzKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBiZSBwcm9jZXNzZWQgYmVmb3JlIGNyZWF0aW9uIGluc3RydWN0aW9ucyBzbyB0ZW1wbGF0ZSgpXG4gICAgLy8gaW5zdHJ1Y3Rpb25zIGNhbiBiZSBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBpbnRlcm5hbCBjb25zdCBjb3VudC5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5mb3JFYWNoKGJ1aWxkVGVtcGxhdGVGbiA9PiBidWlsZFRlbXBsYXRlRm4oKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgYmluZGluZ3MgaW4gbGlzdGVuZXJzKVxuICAgIGNvbnN0IGNyZWF0aW9uU3RhdGVtZW50cyA9IHRoaXMuX2NyZWF0aW9uQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIHByb3BlcnR5IG9yIHRleHQgYmluZGluZ3MpXG4gICAgY29uc3QgdXBkYXRlU3RhdGVtZW50cyA9IHRoaXMuX3VwZGF0ZUNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gIFZhcmlhYmxlIGRlY2xhcmF0aW9uIG11c3Qgb2NjdXIgYWZ0ZXIgYmluZGluZyByZXNvbHV0aW9uIHNvIHdlIGNhbiBnZW5lcmF0ZSBjb250ZXh0XG4gICAgLy8gIGluc3RydWN0aW9ucyB0aGF0IGJ1aWxkIG9uIGVhY2ggb3RoZXIuIGUuZy4gY29uc3QgYiA9IHgoKS4kaW1wbGljaXQoKTsgY29uc3QgYiA9IHgoKTtcbiAgICBjb25zdCBjcmVhdGlvblZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk7XG4gICAgY29uc3QgdXBkYXRlVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkuY29uY2F0KHRoaXMuX3RlbXBWYXJpYWJsZXMpO1xuXG4gICAgY29uc3QgY3JlYXRpb25CbG9jayA9IGNyZWF0aW9uU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGlvblZhcmlhYmxlcy5jb25jYXQoY3JlYXRpb25TdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICBjb25zdCB1cGRhdGVCbG9jayA9IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVZhcmlhYmxlcy5jb25jYXQodXBkYXRlU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgbWFwcyBvZiBwbGFjZWhvbGRlciBuYW1lIHRvIG5vZGUgaW5kZXhlc1xuICAgIC8vIFRPRE8odmljYik6IFRoaXMgaXMgYSBXSVAsIG5vdCBmdWxseSBzdXBwb3J0ZWQgeWV0XG4gICAgZm9yIChjb25zdCBwaFRvTm9kZUlkeCBvZiB0aGlzLl9waFRvTm9kZUlkeGVzKSB7XG4gICAgICBpZiAoT2JqZWN0LmtleXMocGhUb05vZGVJZHgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgICAgY29uc3QgcGhNYXAgPSBvLnZhcmlhYmxlKHNjb3BlZE5hbWUpLnNldChtYXBUb0V4cHJlc3Npb24ocGhUb05vZGVJZHgsIHRydWUpKS50b0NvbnN0RGVjbCgpO1xuXG4gICAgICAgIHRoaXMuX3ByZWZpeENvZGUucHVzaChwaE1hcCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIC8vIGkuZS4gKHJmOiBSZW5kZXJGbGFncywgY3R4OiBhbnkpXG4gICAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGZvciBxdWVyeSByZWZyZXNoIChpLmUuIGxldCBfdDogYW55OylcbiAgICAgICAgICAuLi50aGlzLl9wcmVmaXhDb2RlLFxuICAgICAgICAgIC8vIENyZWF0aW5nIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuQ3JlYXRlKSB7IC4uLiB9KVxuICAgICAgICAgIC4uLmNyZWF0aW9uQmxvY2ssXG4gICAgICAgICAgLy8gQmluZGluZyBhbmQgcmVmcmVzaCBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLlVwZGF0ZSkgey4uLn0pXG4gICAgICAgICAgLi4udXBkYXRlQmxvY2ssXG4gICAgICAgIF0sXG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdGhpcy50ZW1wbGF0ZU5hbWUpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7IHJldHVybiB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0KG5hbWUpOyB9XG5cbiAgaTE4blRyYW5zbGF0ZShsYWJlbDogc3RyaW5nLCBtZXRhPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdGFudFBvb2wuZ2V0VHJhbnNsYXRpb24obGFiZWwsIHBhcnNlSTE4bk1ldGEobWV0YSksIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCk7XG4gIH1cblxuICB2aXNpdENvbnRlbnQobmdDb250ZW50OiB0LkNvbnRlbnQpIHtcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qgc2VsZWN0b3JJbmRleCA9IG5nQ29udGVudC5zZWxlY3RvckluZGV4O1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG5cbiAgICBjb25zdCBhdHRyaWJ1dGVBc0xpc3Q6IHN0cmluZ1tdID0gW107XG5cbiAgICBuZ0NvbnRlbnQuYXR0cmlidXRlcy5mb3JFYWNoKChhdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyaWJ1dGUubmFtZTtcbiAgICAgIGlmIChuYW1lICE9PSAnc2VsZWN0Jykge1xuICAgICAgICBhdHRyaWJ1dGVBc0xpc3QucHVzaChuYW1lLCBhdHRyaWJ1dGUudmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGF0dHJpYnV0ZUFzTGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHNlbGVjdG9ySW5kZXgpLCBhc0xpdGVyYWwoYXR0cmlidXRlQXNMaXN0KSk7XG4gICAgfSBlbHNlIGlmIChzZWxlY3RvckluZGV4ICE9PSAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHNlbGVjdG9ySW5kZXgpKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obmdDb250ZW50LnNvdXJjZVNwYW4sIFIzLnByb2plY3Rpb24sIHBhcmFtZXRlcnMpO1xuICB9XG5cblxuICBnZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXk6IHN0cmluZ3xudWxsKSB7XG4gICAgc3dpdGNoIChuYW1lc3BhY2VLZXkpIHtcbiAgICAgIGNhc2UgJ21hdGgnOlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlTWF0aE1MO1xuICAgICAgY2FzZSAnc3ZnJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZVNWRztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VIVE1MO1xuICAgIH1cbiAgfVxuXG4gIGFkZE5hbWVzcGFjZUluc3RydWN0aW9uKG5zSW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIHRoaXMuX25hbWVzcGFjZSA9IG5zSW5zdHJ1Y3Rpb247XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgbnNJbnN0cnVjdGlvbik7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxlbWVudEluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qgd2FzSW5JMThuU2VjdGlvbiA9IHRoaXMuX2luSTE4blNlY3Rpb247XG5cbiAgICBjb25zdCBvdXRwdXRBdHRyczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgY29uc3QgYXR0ckkxOG5NZXRhczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgbGV0IGkxOG5NZXRhOiBzdHJpbmcgPSAnJztcblxuICAgIGNvbnN0IFtuYW1lc3BhY2VLZXksIGVsZW1lbnROYW1lXSA9IHNwbGl0TnNOYW1lKGVsZW1lbnQubmFtZSk7XG4gICAgY29uc3QgaXNOZ0NvbnRhaW5lciA9IGNoZWNrSXNOZ0NvbnRhaW5lcihlbGVtZW50Lm5hbWUpO1xuXG4gICAgLy8gRWxlbWVudHMgaW5zaWRlIGkxOG4gc2VjdGlvbnMgYXJlIHJlcGxhY2VkIHdpdGggcGxhY2Vob2xkZXJzXG4gICAgLy8gVE9ETyh2aWNiKTogbmVzdGVkIGVsZW1lbnRzIGFyZSBhIFdJUCBpbiB0aGlzIHBoYXNlXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgIGNvbnN0IHBoTmFtZSA9IGVsZW1lbnQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKCF0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0pIHtcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0ucHVzaChlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIGxldCBpc05vbkJpbmRhYmxlTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICAgLy8gSGFuZGxlIGkxOG4gYW5kIG5nTm9uQmluZGFibGUgYXR0cmlidXRlc1xuICAgIGZvciAoY29uc3QgYXR0ciBvZiBlbGVtZW50LmF0dHJpYnV0ZXMpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyLm5hbWU7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgICBpZiAobmFtZSA9PT0gTk9OX0JJTkRBQkxFX0FUVFIpIHtcbiAgICAgICAgaXNOb25CaW5kYWJsZU1vZGUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBDb3VsZCBub3QgbWFyayBhbiBlbGVtZW50IGFzIHRyYW5zbGF0YWJsZSBpbnNpZGUgb2YgYSB0cmFuc2xhdGFibGUgc2VjdGlvbmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2luSTE4blNlY3Rpb24gPSB0cnVlO1xuICAgICAgICB0aGlzLl9pMThuU2VjdGlvbkluZGV4Kys7XG4gICAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF0gPSB7fTtcbiAgICAgICAgaTE4bk1ldGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZS5zdGFydHNXaXRoKEkxOE5fQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgIGF0dHJJMThuTWV0YXNbbmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCldID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRBdHRyc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gbm9uIGkxOG4gYXR0cmlidXRlc1xuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKGVsZW1lbnQubmFtZSwgZWxlbWVudCk7XG5cbiAgICAvLyBSZWd1bGFyIGVsZW1lbnQgb3IgbmctY29udGFpbmVyIGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZWxlbWVudEluZGV4KV07XG4gICAgaWYgKCFpc05nQ29udGFpbmVyKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKGVsZW1lbnROYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBhdHRyaWJ1dGVzXG4gICAgY29uc3QgYXR0cmlidXRlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgY29uc3Qgc3R5bGVJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGNsYXNzSW5wdXRzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcbiAgICBjb25zdCBhbGxPdGhlcklucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBjb25zdCBpMThuQXR0cnM6IEFycmF5PHtuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcgfCBBU1R9PiA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIHN3aXRjaCAoaW5wdXQudHlwZSkge1xuICAgICAgICAvLyBbYXR0ci5zdHlsZV0gb3IgW2F0dHIuY2xhc3NdIHNob3VsZCBub3QgYmUgdHJlYXRlZCBhcyBzdHlsaW5nLWJhc2VkXG4gICAgICAgIC8vIGJpbmRpbmdzIHNpbmNlIHRoZXkgYXJlIGludGVuZGVkIHRvIGJlIHdyaXR0ZW4gZGlyZWN0bHkgdG8gdGhlIGF0dHJcbiAgICAgICAgLy8gYW5kIHRoZXJlZm9yZSB3aWxsIHNraXAgYWxsIHN0eWxlL2NsYXNzIHJlc29sdXRpb24gdGhhdCBpcyBwcmVzZW50XG4gICAgICAgIC8vIHdpdGggc3R5bGU9XCJcIiwgW3N0eWxlXT1cIlwiIGFuZCBbc3R5bGUucHJvcF09XCJcIiwgY2xhc3M9XCJcIixcbiAgICAgICAgLy8gW2NsYXNzLnByb3BdPVwiXCIuIFtjbGFzc109XCJcIiBhc3NpZ25tZW50c1xuICAgICAgICBjYXNlIEJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgICAgIGlmIChpbnB1dC5uYW1lID09ICdzdHlsZScpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyBnbyBmaXJzdCBpbiB0aGUgY29tcGlsYXRpb24gKGZvciBbc3R5bGVdKVxuICAgICAgICAgICAgc3R5bGVJbnB1dHMuc3BsaWNlKDAsIDAsIGlucHV0KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGlzQ2xhc3NCaW5kaW5nKGlucHV0KSkge1xuICAgICAgICAgICAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIGdvIGZpcnN0IGluIHRoZSBjb21waWxhdGlvbiAoZm9yIFtjbGFzc10pXG4gICAgICAgICAgICBjbGFzc0lucHV0cy5zcGxpY2UoMCwgMCwgaW5wdXQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ckkxOG5NZXRhcy5oYXNPd25Qcm9wZXJ0eShpbnB1dC5uYW1lKSkge1xuICAgICAgICAgICAgaTE4bkF0dHJzLnB1c2goe25hbWU6IGlucHV0Lm5hbWUsIHZhbHVlOiBpbnB1dC52YWx1ZX0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbGxPdGhlcklucHV0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQmluZGluZ1R5cGUuU3R5bGU6XG4gICAgICAgICAgc3R5bGVJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICAgICAgY2xhc3NJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBsZXQgY3VyclN0eWxlSW5kZXggPSAwO1xuICAgIGxldCBjdXJyQ2xhc3NJbmRleCA9IDA7XG4gICAgbGV0IHN0YXRpY1N0eWxlc01hcDoge1trZXk6IHN0cmluZ106IGFueX18bnVsbCA9IG51bGw7XG4gICAgbGV0IHN0YXRpY0NsYXNzZXNNYXA6IHtba2V5OiBzdHJpbmddOiBib29sZWFufXxudWxsID0gbnVsbDtcbiAgICBjb25zdCBzdHlsZXNJbmRleE1hcDoge1trZXk6IHN0cmluZ106IG51bWJlcn0gPSB7fTtcbiAgICBjb25zdCBjbGFzc2VzSW5kZXhNYXA6IHtba2V5OiBzdHJpbmddOiBudW1iZXJ9ID0ge307XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob3V0cHV0QXR0cnMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG91dHB1dEF0dHJzW25hbWVdO1xuICAgICAgaWYgKG5hbWUgPT0gJ3N0eWxlJykge1xuICAgICAgICBzdGF0aWNTdHlsZXNNYXAgPSBwYXJzZVN0eWxlKHZhbHVlKTtcbiAgICAgICAgT2JqZWN0LmtleXMoc3RhdGljU3R5bGVzTWFwKS5mb3JFYWNoKHByb3AgPT4geyBzdHlsZXNJbmRleE1hcFtwcm9wXSA9IGN1cnJTdHlsZUluZGV4Kys7IH0pO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09ICdjbGFzcycpIHtcbiAgICAgICAgc3RhdGljQ2xhc3Nlc01hcCA9IHt9O1xuICAgICAgICB2YWx1ZS5zcGxpdCgvXFxzKy9nKS5mb3JFYWNoKGNsYXNzTmFtZSA9PiB7XG4gICAgICAgICAgY2xhc3Nlc0luZGV4TWFwW2NsYXNzTmFtZV0gPSBjdXJyQ2xhc3NJbmRleCsrO1xuICAgICAgICAgIHN0YXRpY0NsYXNzZXNNYXAgIVtjbGFzc05hbWVdID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYXR0ckkxOG5NZXRhcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIGkxOG5BdHRycy5wdXNoKHtuYW1lLCB2YWx1ZX0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF0dHJpYnV0ZXMucHVzaChvLmxpdGVyYWwobmFtZSksIG8ubGl0ZXJhbCh2YWx1ZSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBsZXQgaGFzTWFwQmFzZWRTdHlsaW5nID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHlsZUlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5wdXQgPSBzdHlsZUlucHV0c1tpXTtcbiAgICAgIGNvbnN0IGlzTWFwQmFzZWRTdHlsZUJpbmRpbmcgPSBpID09PSAwICYmIGlucHV0Lm5hbWUgPT09ICdzdHlsZSc7XG4gICAgICBpZiAoaXNNYXBCYXNlZFN0eWxlQmluZGluZykge1xuICAgICAgICBoYXNNYXBCYXNlZFN0eWxpbmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmICghc3R5bGVzSW5kZXhNYXAuaGFzT3duUHJvcGVydHkoaW5wdXQubmFtZSkpIHtcbiAgICAgICAgc3R5bGVzSW5kZXhNYXBbaW5wdXQubmFtZV0gPSBjdXJyU3R5bGVJbmRleCsrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2xhc3NJbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGlucHV0ID0gY2xhc3NJbnB1dHNbaV07XG4gICAgICBjb25zdCBpc01hcEJhc2VkQ2xhc3NCaW5kaW5nID0gaSA9PT0gMCAmJiBpc0NsYXNzQmluZGluZyhpbnB1dCk7XG4gICAgICBpZiAoIWlzTWFwQmFzZWRDbGFzc0JpbmRpbmcgJiYgIXN0eWxlc0luZGV4TWFwLmhhc093blByb3BlcnR5KGlucHV0Lm5hbWUpKSB7XG4gICAgICAgIGNsYXNzZXNJbmRleE1hcFtpbnB1dC5uYW1lXSA9IGN1cnJDbGFzc0luZGV4Kys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaW4gdGhlIGV2ZW50IHRoYXQgYSBbc3R5bGVdIGJpbmRpbmcgaXMgdXNlZCB0aGVuIHNhbml0aXphdGlvbiB3aWxsXG4gICAgLy8gYWx3YXlzIGJlIGltcG9ydGVkIGJlY2F1c2UgaXQgaXMgbm90IHBvc3NpYmxlIHRvIGtub3cgYWhlYWQgb2YgdGltZVxuICAgIC8vIHdoZXRoZXIgc3R5bGUgYmluZGluZ3Mgd2lsbCB1c2Ugb3Igbm90IHVzZSBhbnkgc2FuaXRpemFibGUgcHJvcGVydGllc1xuICAgIC8vIHRoYXQgaXNTdHlsZVNhbml0aXphYmxlKCkgd2lsbCBkZXRlY3RcbiAgICBsZXQgdXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyID0gaGFzTWFwQmFzZWRTdHlsaW5nO1xuXG4gICAgLy8gdGhpcyB3aWxsIGJ1aWxkIHRoZSBpbnN0cnVjdGlvbnMgc28gdGhhdCB0aGV5IGZhbGwgaW50byB0aGUgZm9sbG93aW5nIHN5bnRheFxuICAgIC8vID0+IFtwcm9wMSwgcHJvcDIsIHByb3AzLCAwLCBwcm9wMSwgdmFsdWUxLCBwcm9wMiwgdmFsdWUyXVxuICAgIE9iamVjdC5rZXlzKHN0eWxlc0luZGV4TWFwKS5mb3JFYWNoKHByb3AgPT4ge1xuICAgICAgdXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyID0gdXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyIHx8IGlzU3R5bGVTYW5pdGl6YWJsZShwcm9wKTtcbiAgICAgIGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChwcm9wKSk7XG4gICAgfSk7XG5cbiAgICBpZiAoc3RhdGljU3R5bGVzTWFwKSB7XG4gICAgICBpbml0aWFsU3R5bGVEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwoY29yZS5Jbml0aWFsU3R5bGluZ0ZsYWdzLlZBTFVFU19NT0RFKSk7XG5cbiAgICAgIE9iamVjdC5rZXlzKHN0YXRpY1N0eWxlc01hcCkuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgICAgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHByb3ApKTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBzdGF0aWNTdHlsZXNNYXAgIVtwcm9wXTtcbiAgICAgICAgaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLnB1c2goby5saXRlcmFsKHZhbHVlKSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBPYmplY3Qua2V5cyhjbGFzc2VzSW5kZXhNYXApLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwocHJvcCkpO1xuICAgIH0pO1xuXG4gICAgaWYgKHN0YXRpY0NsYXNzZXNNYXApIHtcbiAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbChjb3JlLkluaXRpYWxTdHlsaW5nRmxhZ3MuVkFMVUVTX01PREUpKTtcblxuICAgICAgT2JqZWN0LmtleXMoc3RhdGljQ2xhc3Nlc01hcCkuZm9yRWFjaChjbGFzc05hbWUgPT4ge1xuICAgICAgICBpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMucHVzaChvLmxpdGVyYWwoY2xhc3NOYW1lKSk7XG4gICAgICAgIGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5wdXNoKG8ubGl0ZXJhbCh0cnVlKSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBoYXNTdHlsaW5nSW5zdHJ1Y3Rpb25zID0gaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLmxlbmd0aCB8fCBzdHlsZUlucHV0cy5sZW5ndGggfHxcbiAgICAgICAgaW5pdGlhbENsYXNzRGVjbGFyYXRpb25zLmxlbmd0aCB8fCBjbGFzc0lucHV0cy5sZW5ndGg7XG5cbiAgICAvLyBhZGQgYXR0cmlidXRlcyBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nIHB1cnBvc2VzXG4gICAgYXR0cmlidXRlcy5wdXNoKC4uLnRoaXMucHJlcGFyZVN5bnRoZXRpY0FuZFNlbGVjdE9ubHlBdHRycyhhbGxPdGhlcklucHV0cywgZWxlbWVudC5vdXRwdXRzKSk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMudG9BdHRyc1BhcmFtKGF0dHJpYnV0ZXMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPGRpdiAjZm9vICNiYXI9XCJiYXpcIj4pXG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMucHJlcGFyZVJlZnNQYXJhbWV0ZXIoZWxlbWVudC5yZWZlcmVuY2VzKSk7XG5cbiAgICBjb25zdCB3YXNJbk5hbWVzcGFjZSA9IHRoaXMuX25hbWVzcGFjZTtcbiAgICBjb25zdCBjdXJyZW50TmFtZXNwYWNlID0gdGhpcy5nZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXkpO1xuXG4gICAgLy8gSWYgdGhlIG5hbWVzcGFjZSBpcyBjaGFuZ2luZyBub3csIGluY2x1ZGUgYW4gaW5zdHJ1Y3Rpb24gdG8gY2hhbmdlIGl0XG4gICAgLy8gZHVyaW5nIGVsZW1lbnQgY3JlYXRpb24uXG4gICAgaWYgKGN1cnJlbnROYW1lc3BhY2UgIT09IHdhc0luTmFtZXNwYWNlKSB7XG4gICAgICB0aGlzLmFkZE5hbWVzcGFjZUluc3RydWN0aW9uKGN1cnJlbnROYW1lc3BhY2UsIGVsZW1lbnQpO1xuICAgIH1cblxuICAgIGNvbnN0IGltcGxpY2l0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuXG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiA9ICFoYXNTdHlsaW5nSW5zdHJ1Y3Rpb25zICYmICFpc05nQ29udGFpbmVyICYmXG4gICAgICAgIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID09PSAwICYmIGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPT09IDAgJiYgaTE4bkF0dHJzLmxlbmd0aCA9PT0gMDtcblxuICAgIGlmIChjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50LCB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQgOiBSMy5lbGVtZW50U3RhcnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gcHJvY2VzcyBpMThuIGVsZW1lbnQgYXR0cmlidXRlc1xuICAgICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGhhc0JpbmRpbmdzOiBib29sZWFuID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGkxOG5BdHRyQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgaTE4bkF0dHJzLmZvckVhY2goKHtuYW1lLCB2YWx1ZX0pID0+IHtcbiAgICAgICAgICBjb25zdCBtZXRhID0gYXR0ckkxOG5NZXRhc1tuYW1lXTtcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gaW4gY2FzZSBvZiBzdGF0aWMgc3RyaW5nIHZhbHVlLCAzcmQgYXJndW1lbnQgaXMgMCBkZWNsYXJlc1xuICAgICAgICAgICAgLy8gdGhhdCB0aGVyZSBhcmUgbm8gZXhwcmVzc2lvbnMgZGVmaW5lZCBpbiB0aGlzIHRyYW5zbGF0aW9uXG4gICAgICAgICAgICBpMThuQXR0ckFyZ3MucHVzaChvLmxpdGVyYWwobmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZSh2YWx1ZSwgbWV0YSksIG8ubGl0ZXJhbCgwKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRlZCA9IHZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICAgIGlmIChjb252ZXJ0ZWQgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHtzdHJpbmdzLCBleHByZXNzaW9uc30gPSBjb252ZXJ0ZWQ7XG4gICAgICAgICAgICAgIGNvbnN0IGxhYmVsID0gYXNzZW1ibGVJMThuVGVtcGxhdGUoc3RyaW5ncyk7XG4gICAgICAgICAgICAgIGkxOG5BdHRyQXJncy5wdXNoKFxuICAgICAgICAgICAgICAgICAgby5saXRlcmFsKG5hbWUpLCB0aGlzLmkxOG5UcmFuc2xhdGUobGFiZWwsIG1ldGEpLCBvLmxpdGVyYWwoZXhwcmVzc2lvbnMubGVuZ3RoKSk7XG4gICAgICAgICAgICAgIGV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB7XG4gICAgICAgICAgICAgICAgaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpbmRpbmcgPSB0aGlzLmNvbnZlcnRFeHByZXNzaW9uQmluZGluZyhpbXBsaWNpdCwgZXhwcmVzc2lvbik7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5FeHAsIFtiaW5kaW5nXSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChpMThuQXR0ckFyZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc3QgaW5kZXg6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSk7XG4gICAgICAgICAgY29uc3QgYXJncyA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoaTE4bkF0dHJBcmdzKSwgdHJ1ZSk7XG4gICAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuaTE4bkF0dHJpYnV0ZSwgW2luZGV4LCBhcmdzXSk7XG4gICAgICAgICAgaWYgKGhhc0JpbmRpbmdzKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuaTE4bkFwcGx5LCBbaW5kZXhdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gaW5pdGlhbCBzdHlsaW5nIGZvciBzdGF0aWMgc3R5bGU9XCIuLi5cIiBhdHRyaWJ1dGVzXG4gICAgICBpZiAoaGFzU3R5bGluZ0luc3RydWN0aW9ucykge1xuICAgICAgICBjb25zdCBwYXJhbXNMaXN0OiAoby5FeHByZXNzaW9uKVtdID0gW107XG5cbiAgICAgICAgaWYgKGluaXRpYWxDbGFzc0RlY2xhcmF0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAvLyB0aGUgdGVtcGxhdGUgY29tcGlsZXIgaGFuZGxlcyBpbml0aWFsIGNsYXNzIHN0eWxpbmcgKGUuZy4gY2xhc3M9XCJmb29cIikgdmFsdWVzXG4gICAgICAgICAgLy8gaW4gYSBzcGVjaWFsIGNvbW1hbmQgY2FsbGVkIGBlbGVtZW50Q2xhc3NgIHNvIHRoYXQgdGhlIGluaXRpYWwgY2xhc3NcbiAgICAgICAgICAvLyBjYW4gYmUgcHJvY2Vzc2VkIGR1cmluZyBydW50aW1lLiBUaGVzZSBpbml0aWFsIGNsYXNzIHZhbHVlcyBhcmUgYm91bmQgdG9cbiAgICAgICAgICAvLyBhIGNvbnN0YW50IGJlY2F1c2UgdGhlIGluaXRhbCBjbGFzcyB2YWx1ZXMgZG8gbm90IGNoYW5nZSAoc2luY2UgdGhleSdyZSBzdGF0aWMpLlxuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChcbiAgICAgICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihpbml0aWFsQ2xhc3NEZWNsYXJhdGlvbnMpLCB0cnVlKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLmxlbmd0aCB8fCB1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIpIHtcbiAgICAgICAgICAvLyBubyBwb2ludCBpbiBoYXZpbmcgYW4gZXh0cmEgYG51bGxgIHZhbHVlIHVubGVzcyB0aGVyZSBhcmUgZm9sbG93LXVwIHBhcmFtc1xuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5pdGlhbFN0eWxlRGVjbGFyYXRpb25zLmxlbmd0aCkge1xuICAgICAgICAgIC8vIHRoZSB0ZW1wbGF0ZSBjb21waWxlciBoYW5kbGVzIGluaXRpYWwgc3R5bGUgKGUuZy4gc3R5bGU9XCJmb29cIikgdmFsdWVzXG4gICAgICAgICAgLy8gaW4gYSBzcGVjaWFsIGNvbW1hbmQgY2FsbGVkIGBlbGVtZW50U3R5bGVgIHNvIHRoYXQgdGhlIGluaXRpYWwgc3R5bGVzXG4gICAgICAgICAgLy8gY2FuIGJlIHByb2Nlc3NlZCBkdXJpbmcgcnVudGltZS4gVGhlc2UgaW5pdGlhbCBzdHlsZXMgdmFsdWVzIGFyZSBib3VuZCB0b1xuICAgICAgICAgIC8vIGEgY29uc3RhbnQgYmVjYXVzZSB0aGUgaW5pdGFsIHN0eWxlIHZhbHVlcyBkbyBub3QgY2hhbmdlIChzaW5jZSB0aGV5J3JlIHN0YXRpYykuXG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKFxuICAgICAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGluaXRpYWxTdHlsZURlY2xhcmF0aW9ucyksIHRydWUpKTtcbiAgICAgICAgfSBlbHNlIGlmICh1c2VEZWZhdWx0U3R5bGVTYW5pdGl6ZXIpIHtcbiAgICAgICAgICAvLyBubyBwb2ludCBpbiBoYXZpbmcgYW4gZXh0cmEgYG51bGxgIHZhbHVlIHVubGVzcyB0aGVyZSBhcmUgZm9sbG93LXVwIHBhcmFtc1xuICAgICAgICAgIHBhcmFtc0xpc3QucHVzaChvLk5VTExfRVhQUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXNlRGVmYXVsdFN0eWxlU2FuaXRpemVyKSB7XG4gICAgICAgICAgcGFyYW1zTGlzdC5wdXNoKG8uaW1wb3J0RXhwcihSMy5kZWZhdWx0U3R5bGVTYW5pdGl6ZXIpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5lbGVtZW50U3R5bGluZywgcGFyYW1zTGlzdCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEdlbmVyYXRlIExpc3RlbmVycyAob3V0cHV0cylcbiAgICAgIGVsZW1lbnQub3V0cHV0cy5mb3JFYWNoKChvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCkgPT4ge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICBvdXRwdXRBc3Quc291cmNlU3BhbiwgUjMubGlzdGVuZXIsXG4gICAgICAgICAgICB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcihlbGVtZW50Lm5hbWUsIG91dHB1dEFzdCkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKChzdHlsZUlucHV0cy5sZW5ndGggfHwgY2xhc3NJbnB1dHMubGVuZ3RoKSAmJiBoYXNTdHlsaW5nSW5zdHJ1Y3Rpb25zKSB7XG4gICAgICBjb25zdCBpbmRleExpdGVyYWwgPSBvLmxpdGVyYWwoZWxlbWVudEluZGV4KTtcblxuICAgICAgY29uc3QgZmlyc3RTdHlsZSA9IHN0eWxlSW5wdXRzWzBdO1xuICAgICAgY29uc3QgbWFwQmFzZWRTdHlsZUlucHV0ID0gZmlyc3RTdHlsZSAmJiBmaXJzdFN0eWxlLm5hbWUgPT0gJ3N0eWxlJyA/IGZpcnN0U3R5bGUgOiBudWxsO1xuXG4gICAgICBjb25zdCBmaXJzdENsYXNzID0gY2xhc3NJbnB1dHNbMF07XG4gICAgICBjb25zdCBtYXBCYXNlZENsYXNzSW5wdXQgPSBmaXJzdENsYXNzICYmIGlzQ2xhc3NCaW5kaW5nKGZpcnN0Q2xhc3MpID8gZmlyc3RDbGFzcyA6IG51bGw7XG5cbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dCA9IG1hcEJhc2VkU3R5bGVJbnB1dCB8fCBtYXBCYXNlZENsYXNzSW5wdXQ7XG4gICAgICBpZiAoc3R5bGluZ0lucHV0KSB7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc3R5bGluZ0lucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRTdHlsaW5nTWFwLCAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtpbmRleExpdGVyYWxdO1xuXG4gICAgICAgICAgaWYgKG1hcEJhc2VkQ2xhc3NJbnB1dCkge1xuICAgICAgICAgICAgY29uc3QgbWFwQmFzZWRDbGFzc1ZhbHVlID0gbWFwQmFzZWRDbGFzc0lucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgbWFwQmFzZWRDbGFzc1ZhbHVlLCB0cnVlKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChtYXBCYXNlZFN0eWxlSW5wdXQpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8uTlVMTF9FWFBSKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobWFwQmFzZWRTdHlsZUlucHV0KSB7XG4gICAgICAgICAgICBjb25zdCBtYXBCYXNlZFN0eWxlVmFsdWUgPSBtYXBCYXNlZFN0eWxlSW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgICAgcGFyYW1zLnB1c2godGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCBtYXBCYXNlZFN0eWxlVmFsdWUsIHRydWUpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgbGV0IGxhc3RJbnB1dENvbW1hbmQ6IHQuQm91bmRBdHRyaWJ1dGV8bnVsbCA9IG51bGw7XG4gICAgICBpZiAoc3R5bGVJbnB1dHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCBpID0gbWFwQmFzZWRTdHlsZUlucHV0ID8gMSA6IDA7XG4gICAgICAgIGZvciAoaTsgaSA8IHN0eWxlSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBzdHlsZUlucHV0c1tpXTtcbiAgICAgICAgICBjb25zdCBrZXkgPSBpbnB1dC5uYW1lO1xuICAgICAgICAgIGNvbnN0IHN0eWxlSW5kZXg6IG51bWJlciA9IHN0eWxlc0luZGV4TWFwW2tleV0gITtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgICAgICAgaW5kZXhMaXRlcmFsLCBvLmxpdGVyYWwoc3R5bGVJbmRleCksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUsIHRydWUpXG4gICAgICAgICAgXTtcblxuICAgICAgICAgIGlmIChpbnB1dC51bml0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpbnB1dC51bml0KSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbnB1dC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50U3R5bGVQcm9wLCBwYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdElucHV0Q29tbWFuZCA9IHN0eWxlSW5wdXRzW3N0eWxlSW5wdXRzLmxlbmd0aCAtIDFdO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2xhc3NJbnB1dHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCBpID0gbWFwQmFzZWRDbGFzc0lucHV0ID8gMSA6IDA7XG4gICAgICAgIGZvciAoaTsgaSA8IGNsYXNzSW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBjbGFzc0lucHV0c1tpXTtcbiAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQpO1xuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG5cbiAgICAgICAgICBjb25zdCBrZXkgPSBpbnB1dC5uYW1lO1xuICAgICAgICAgIGNvbnN0IGNsYXNzSW5kZXg6IG51bWJlciA9IGNsYXNzZXNJbmRleE1hcFtrZXldICE7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbnB1dC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50Q2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICBpbmRleExpdGVyYWwsIG8ubGl0ZXJhbChjbGFzc0luZGV4KSxcbiAgICAgICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSwgdHJ1ZSksIC4uLnBhcmFtc1xuICAgICAgICAgICAgXTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxhc3RJbnB1dENvbW1hbmQgPSBjbGFzc0lucHV0c1tjbGFzc0lucHV0cy5sZW5ndGggLSAxXTtcbiAgICAgIH1cblxuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihsYXN0SW5wdXRDb21tYW5kICEuc291cmNlU3BhbiwgUjMuZWxlbWVudFN0eWxpbmdBcHBseSwgW2luZGV4TGl0ZXJhbF0pO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIGVsZW1lbnQgaW5wdXQgYmluZGluZ3NcbiAgICBhbGxPdGhlcklucHV0cy5mb3JFYWNoKChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBtYXBCaW5kaW5nVG9JbnN0cnVjdGlvbihpbnB1dC50eXBlKTtcbiAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIC8vIHNldEF0dHJpYnV0ZSB3aXRob3V0IGEgdmFsdWUgZG9lc24ndCBtYWtlIGFueSBzZW5zZVxuICAgICAgICBpZiAodmFsdWUubmFtZSB8fCB2YWx1ZS52YWx1ZSkge1xuICAgICAgICAgIGNvbnN0IG5hbWUgPSBwcmVwYXJlU3ludGhldGljQXR0cmlidXRlTmFtZShpbnB1dC5uYW1lKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGlucHV0LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRBdHRyaWJ1dGUsICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBvLmxpdGVyYWwobmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdCwgdmFsdWUpXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGluc3RydWN0aW9uKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LCBpbnB1dC5zZWN1cml0eUNvbnRleHQpO1xuICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSBwYXJhbXMucHVzaChzYW5pdGl6YXRpb25SZWYpO1xuXG4gICAgICAgIC8vIFRPRE8oY2h1Y2tqKTogcnVudGltZTogc2VjdXJpdHkgY29udGV4dFxuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG5cbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbiwgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgby5saXRlcmFsKGlucHV0Lm5hbWUpLFxuICAgICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSksIC4uLnBhcmFtc1xuICAgICAgICAgIF07XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdW5zdXBwb3J0ZWQoYGJpbmRpbmcgdHlwZSAke2lucHV0LnR5cGV9YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUcmF2ZXJzZSBlbGVtZW50IGNoaWxkIG5vZGVzXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24gJiYgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPT0gMSAmJlxuICAgICAgICBlbGVtZW50LmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC5jaGlsZHJlblswXSBhcyB0LlRleHQ7XG4gICAgICB0aGlzLnZpc2l0U2luZ2xlSTE4blRleHRDaGlsZCh0ZXh0LCBpMThuTWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHQudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG4gICAgfVxuXG4gICAgaWYgKCFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uKSB7XG4gICAgICAvLyBGaW5pc2ggZWxlbWVudCBjb25zdHJ1Y3Rpb24gbW9kZS5cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZW5hYmxlQmluZGluZ3MpO1xuICAgICAgfVxuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuZW5kU291cmNlU3BhbiB8fCBlbGVtZW50LnNvdXJjZVNwYW4sXG4gICAgICAgICAgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJFbmQgOiBSMy5lbGVtZW50RW5kKTtcbiAgICB9XG5cbiAgICAvLyBSZXN0b3JlIHRoZSBzdGF0ZSBiZWZvcmUgZXhpdGluZyB0aGlzIG5vZGVcbiAgICB0aGlzLl9pbkkxOG5TZWN0aW9uID0gd2FzSW5JMThuU2VjdGlvbjtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICBsZXQgZWxOYW1lID0gJyc7XG4gICAgaWYgKHRlbXBsYXRlLmNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiB0ZW1wbGF0ZS5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudCkge1xuICAgICAgLy8gV2hlbiB0aGUgdGVtcGxhdGUgYXMgYSBzaW5nbGUgY2hpbGQsIGRlcml2ZSB0aGUgY29udGV4dCBuYW1lIGZyb20gdGhlIHRhZ1xuICAgICAgZWxOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKCh0ZW1wbGF0ZS5jaGlsZHJlblswXSBhcyB0LkVsZW1lbnQpLm5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRleHROYW1lID0gZWxOYW1lID8gYCR7dGhpcy5jb250ZXh0TmFtZX1fJHtlbE5hbWV9YCA6ICcnO1xuXG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID1cbiAgICAgICAgY29udGV4dE5hbWUgPyBgJHtjb250ZXh0TmFtZX1fVGVtcGxhdGVfJHt0ZW1wbGF0ZUluZGV4fWAgOiBgVGVtcGxhdGVfJHt0ZW1wbGF0ZUluZGV4fWA7XG5cbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZUluZGV4KSxcbiAgICAgIG8udmFyaWFibGUodGVtcGxhdGVOYW1lKSxcbiAgICAgIG8uVFlQRURfTlVMTF9FWFBSLFxuICAgIF07XG5cbiAgICAvLyBmaW5kIGRpcmVjdGl2ZXMgbWF0Y2hpbmcgb24gYSBnaXZlbiA8bmctdGVtcGxhdGU+IG5vZGVcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcygnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZSk7XG5cbiAgICAvLyBwcmVwYXJlIGF0dHJpYnV0ZXMgcGFyYW1ldGVyIChpbmNsdWRpbmcgYXR0cmlidXRlcyB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcpXG4gICAgY29uc3QgYXR0cnNFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICB0ZW1wbGF0ZS5hdHRyaWJ1dGVzLmZvckVhY2goXG4gICAgICAgIChhOiB0LlRleHRBdHRyaWJ1dGUpID0+IHsgYXR0cnNFeHBycy5wdXNoKGFzTGl0ZXJhbChhLm5hbWUpLCBhc0xpdGVyYWwoYS52YWx1ZSkpOyB9KTtcbiAgICBhdHRyc0V4cHJzLnB1c2goLi4udGhpcy5wcmVwYXJlU3ludGhldGljQW5kU2VsZWN0T25seUF0dHJzKHRlbXBsYXRlLmlucHV0cywgdGVtcGxhdGUub3V0cHV0cykpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnRvQXR0cnNQYXJhbShhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMucHJlcGFyZVJlZnNQYXJhbWV0ZXIodGVtcGxhdGUucmVmZXJlbmNlcykpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uaW1wb3J0RXhwcihSMy50ZW1wbGF0ZVJlZkV4dHJhY3RvcikpO1xuICAgIH1cblxuICAgIC8vIGhhbmRsZSBwcm9wZXJ0eSBiaW5kaW5ncyBlLmcuIHAoMSwgJ2Zvck9mJywgybViaW5kKGN0eC5pdGVtcykpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24odGVtcGxhdGUuc291cmNlU3BhbiwgUjMuZWxlbWVudFByb3BlcnR5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLCBvLmxpdGVyYWwoaW5wdXQubmFtZSksXG4gICAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGNvbnRleHQsIHZhbHVlKVxuICAgICAgICBdO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gICAgY29uc3QgdGVtcGxhdGVWaXNpdG9yID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSwgdGVtcGxhdGVOYW1lLCBbXSxcbiAgICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsIHRoaXMucGlwZXMsIHRoaXMuX25hbWVzcGFjZSxcbiAgICAgICAgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4KTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbCBhZnRlciB0aGVpciBwYXJlbnQgdGVtcGxhdGVzIGhhdmUgY29tcGxldGVkXG4gICAgLy8gcHJvY2Vzc2luZywgc28gdGhleSBhcmUgcXVldWVkIGhlcmUgdW50aWwgYWZ0ZXIgdGhlIGluaXRpYWwgcGFzcy4gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndFxuICAgIC8vIGJlIGFibGUgdG8gc3VwcG9ydCBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIHRvIGxvY2FsIHJlZnMgdGhhdCBvY2N1ciBhZnRlciB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBkZWZpbml0aW9uLiBlLmcuIDxkaXYgKm5nSWY9XCJzaG93aW5nXCI+IHt7IGZvbyB9fSA8L2Rpdj4gIDxkaXYgI2Zvbz48L2Rpdj5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5wdXNoKCgpID0+IHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID1cbiAgICAgICAgICB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgfSk7XG5cbiAgICAvLyBlLmcuIHRlbXBsYXRlKDEsIE15Q29tcF9UZW1wbGF0ZV8xKVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy50ZW1wbGF0ZUNyZWF0ZSwgKCkgPT4ge1xuICAgICAgcGFyYW1ldGVycy5zcGxpY2UoXG4gICAgICAgICAgMiwgMCwgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRDb25zdENvdW50KCkpLFxuICAgICAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZVZpc2l0b3IuZ2V0VmFyQ291bnQoKSkpO1xuICAgICAgcmV0dXJuIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpO1xuICAgIH0pO1xuXG4gICAgLy8gR2VuZXJhdGUgbGlzdGVuZXJzIGZvciBkaXJlY3RpdmUgb3V0cHV0XG4gICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKChvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCkgPT4ge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcignbmdfdGVtcGxhdGUnLCBvdXRwdXRBc3QpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbChub2RlSW5kZXgpXSk7XG5cbiAgICBjb25zdCB2YWx1ZSA9IHRleHQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dEJpbmRpbmcsXG4gICAgICAgICgpID0+IFtvLmxpdGVyYWwobm9kZUluZGV4KSwgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSwgdmFsdWUpXSk7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogdC5UZXh0KSB7XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCBvLmxpdGVyYWwodGV4dC52YWx1ZSldKTtcbiAgfVxuXG4gIC8vIFdoZW4gdGhlIGNvbnRlbnQgb2YgdGhlIGVsZW1lbnQgaXMgYSBzaW5nbGUgdGV4dCBub2RlIHRoZSB0cmFuc2xhdGlvbiBjYW4gYmUgaW5saW5lZDpcbiAgLy9cbiAgLy8gYDxwIGkxOG49XCJkZXNjfG1lYW5cIj5zb21lIGNvbnRlbnQ8L3A+YFxuICAvLyBjb21waWxlcyB0b1xuICAvLyBgYGBcbiAgLy8gLyoqXG4gIC8vICogQGRlc2MgZGVzY1xuICAvLyAqIEBtZWFuaW5nIG1lYW5cbiAgLy8gKi9cbiAgLy8gY29uc3QgTVNHX1hZWiA9IGdvb2cuZ2V0TXNnKCdzb21lIGNvbnRlbnQnKTtcbiAgLy8gaTAuybV0ZXh0KDEsIE1TR19YWVopO1xuICAvLyBgYGBcbiAgdmlzaXRTaW5nbGVJMThuVGV4dENoaWxkKHRleHQ6IHQuVGV4dCwgaTE4bk1ldGE6IHN0cmluZykge1xuICAgIGNvbnN0IHZhcmlhYmxlID0gdGhpcy5pMThuVHJhbnNsYXRlKHRleHQudmFsdWUsIGkxOG5NZXRhKTtcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIHZhcmlhYmxlXSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlRGF0YVNsb3QoKSB7IHJldHVybiB0aGlzLl9kYXRhSW5kZXgrKzsgfVxuXG4gIGdldENvbnN0Q291bnQoKSB7IHJldHVybiB0aGlzLl9kYXRhSW5kZXg7IH1cblxuICBnZXRWYXJDb3VudCgpIHsgcmV0dXJuIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzOyB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHsgcmV0dXJuIGAke3RoaXMuX2JpbmRpbmdDb250ZXh0Kyt9YDsgfVxuXG4gIC8vIEJpbmRpbmdzIG11c3Qgb25seSBiZSByZXNvbHZlZCBhZnRlciBhbGwgbG9jYWwgcmVmcyBoYXZlIGJlZW4gdmlzaXRlZCwgc28gYWxsXG4gIC8vIGluc3RydWN0aW9ucyBhcmUgcXVldWVkIGluIGNhbGxiYWNrcyB0aGF0IGV4ZWN1dGUgb25jZSB0aGUgaW5pdGlhbCBwYXNzIGhhcyBjb21wbGV0ZWQuXG4gIC8vIE90aGVyd2lzZSwgd2Ugd291bGRuJ3QgYmUgYWJsZSB0byBzdXBwb3J0IGxvY2FsIHJlZnMgdGhhdCBhcmUgZGVmaW5lZCBhZnRlciB0aGVpclxuICAvLyBiaW5kaW5ncy4gZS5nLiB7eyBmb28gfX0gPGRpdiAjZm9vPjwvZGl2PlxuICBwcml2YXRlIGluc3RydWN0aW9uRm4oXG4gICAgICBmbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm46IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpOiB2b2lkIHtcbiAgICBmbnMucHVzaCgoKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBBcnJheS5pc0FycmF5KHBhcmFtc09yRm4pID8gcGFyYW1zT3JGbiA6IHBhcmFtc09yRm4oKTtcbiAgICAgIHJldHVybiBpbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIHBhcmFtcykudG9TdG10KCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpIHtcbiAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fY3JlYXRpb25Db2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSkge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10pO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IG9yaWdpbmFsU2xvdHMgPSB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cztcbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSBudW1TbG90cztcbiAgICByZXR1cm4gb3JpZ2luYWxTbG90cztcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWU6IEFTVCkge1xuICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAxO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0RXhwcmVzc2lvbkJpbmRpbmcoaW1wbGljaXQ6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID1cbiAgICAgICAgY29udmVydFByb3BlcnR5QmluZGluZyh0aGlzLCBpbXBsaWNpdCwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlKTtcbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFt2YWxFeHByXSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQ6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IEFTVCwgc2tpcEJpbmRGbj86IGJvb2xlYW4pOlxuICAgICAgby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uRm4gPVxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyBpbnRlcnBvbGF0ZSA6ICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKTtcblxuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgIHRoaXMsIGltcGxpY2l0LCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUsIGludGVycG9sYXRpb25Gbik7XG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG5cbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gfHwgc2tpcEJpbmRGbiA/IHZhbEV4cHIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW3ZhbEV4cHJdKTtcbiAgfVxuXG4gIHByaXZhdGUgbWF0Y2hEaXJlY3RpdmVzKHRhZ05hbWU6IHN0cmluZywgZWxPclRwbDogdC5FbGVtZW50fHQuVGVtcGxhdGUpIHtcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKHRhZ05hbWUsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcoZWxPclRwbCkpO1xuICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLm1hdGNoKFxuICAgICAgICAgIHNlbGVjdG9yLCAoY3NzU2VsZWN0b3IsIHN0YXRpY1R5cGUpID0+IHsgdGhpcy5kaXJlY3RpdmVzLmFkZChzdGF0aWNUeXBlKTsgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlU3ludGhldGljQW5kU2VsZWN0T25seUF0dHJzKGlucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdLCBvdXRwdXRzOiB0LkJvdW5kRXZlbnRbXSk6XG4gICAgICBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IG5vblN5bnRoZXRpY0lucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBpZiAoaW5wdXRzLmxlbmd0aCkge1xuICAgICAgY29uc3QgRU1QVFlfU1RSSU5HX0VYUFIgPSBhc0xpdGVyYWwoJycpO1xuICAgICAgaW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgICAgLy8gQGF0dHJpYnV0ZXMgYXJlIGZvciBSZW5kZXJlcjIgYW5pbWF0aW9uIEB0cmlnZ2VycywgYnV0IHRoaXMgZmVhdHVyZVxuICAgICAgICAgIC8vIG1heSBiZSBzdXBwb3J0ZWQgZGlmZmVyZW50bHkgaW4gZnV0dXJlIHZlcnNpb25zIG9mIGFuZ3VsYXIuIEhvd2V2ZXIsXG4gICAgICAgICAgLy8gQHRyaWdnZXJzIHNob3VsZCBhbHdheXMganVzdCBiZSB0cmVhdGVkIGFzIHJlZ3VsYXIgYXR0cmlidXRlcyAoaXQncyB1cFxuICAgICAgICAgIC8vIHRvIHRoZSByZW5kZXJlciB0byBkZXRlY3QgYW5kIHVzZSB0aGVtIGluIGEgc3BlY2lhbCB3YXkpLlxuICAgICAgICAgIGF0dHJFeHBycy5wdXNoKGFzTGl0ZXJhbChwcmVwYXJlU3ludGhldGljQXR0cmlidXRlTmFtZShpbnB1dC5uYW1lKSksIEVNUFRZX1NUUklOR19FWFBSKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBub25TeW50aGV0aWNJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChub25TeW50aGV0aWNJbnB1dHMubGVuZ3RoIHx8IG91dHB1dHMubGVuZ3RoKSB7XG4gICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuU2VsZWN0T25seSkpO1xuICAgICAgbm9uU3ludGhldGljSW5wdXRzLmZvckVhY2goKGk6IHQuQm91bmRBdHRyaWJ1dGUpID0+IGF0dHJFeHBycy5wdXNoKGFzTGl0ZXJhbChpLm5hbWUpKSk7XG4gICAgICBvdXRwdXRzLmZvckVhY2goKG86IHQuQm91bmRFdmVudCkgPT4gYXR0ckV4cHJzLnB1c2goYXNMaXRlcmFsKG8ubmFtZSkpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXR0ckV4cHJzO1xuICB9XG5cbiAgcHJpdmF0ZSB0b0F0dHJzUGFyYW0oYXR0cnNFeHByczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIHJldHVybiBhdHRyc0V4cHJzLmxlbmd0aCA+IDAgP1xuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGF0dHJzRXhwcnMpLCB0cnVlKSA6XG4gICAgICAgIG8uVFlQRURfTlVMTF9FWFBSO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlUmVmc1BhcmFtZXRlcihyZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKTogby5FeHByZXNzaW9uIHtcbiAgICBpZiAoIXJlZmVyZW5jZXMgfHwgcmVmZXJlbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBvLlRZUEVEX05VTExfRVhQUjtcbiAgICB9XG5cbiAgICBjb25zdCByZWZzUGFyYW0gPSBmbGF0dGVuKHJlZmVyZW5jZXMubWFwKHJlZmVyZW5jZSA9PiB7XG4gICAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICAvLyBHZW5lcmF0ZSB0aGUgdXBkYXRlIHRlbXBvcmFyeS5cbiAgICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUodmFyaWFibGVOYW1lKTtcbiAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQoXG4gICAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHJlZmVyZW5jZS5uYW1lLCBsaHMsIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgICAgICAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAvLyBlLmcuIHgoMik7XG4gICAgICAgICAgICBjb25zdCBuZXh0Q29udGV4dFN0bXQgPVxuICAgICAgICAgICAgICAgIHJlbGF0aXZlTGV2ZWwgPiAwID8gW2dlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpLnRvU3RtdCgpXSA6IFtdO1xuXG4gICAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRmb28kID0gcigxKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZkV4cHIgPSBsaHMuc2V0KG8uaW1wb3J0RXhwcihSMy5yZWZlcmVuY2UpLmNhbGxGbihbby5saXRlcmFsKHNsb3QpXSkpO1xuICAgICAgICAgICAgcmV0dXJuIG5leHRDb250ZXh0U3RtdC5jb25jYXQocmVmRXhwci50b0NvbnN0RGVjbCgpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIHJldHVybiBbcmVmZXJlbmNlLm5hbWUsIHJlZmVyZW5jZS52YWx1ZV07XG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocmVmc1BhcmFtKSwgdHJ1ZSk7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcih0YWdOYW1lOiBzdHJpbmcsIG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KTogKCkgPT4gby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGV2TmFtZVNhbml0aXplZCA9IHNhbml0aXplSWRlbnRpZmllcihvdXRwdXRBc3QubmFtZSk7XG4gICAgY29uc3QgdGFnTmFtZVNhbml0aXplZCA9IHNhbml0aXplSWRlbnRpZmllcih0YWdOYW1lKTtcbiAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSBgJHt0aGlzLnRlbXBsYXRlTmFtZX1fJHt0YWdOYW1lU2FuaXRpemVkfV8ke2V2TmFtZVNhbml0aXplZH1fbGlzdGVuZXJgO1xuXG4gICAgcmV0dXJuICgpID0+IHtcblxuICAgICAgY29uc3QgbGlzdGVuZXJTY29wZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5uZXN0ZWRTY29wZSh0aGlzLl9iaW5kaW5nU2NvcGUuYmluZGluZ0xldmVsKTtcblxuICAgICAgY29uc3QgYmluZGluZ0V4cHIgPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgICAgICBsaXN0ZW5lclNjb3BlLCBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSksIG91dHB1dEFzdC5oYW5kbGVyLCAnYicsXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpKTtcblxuICAgICAgY29uc3Qgc3RhdGVtZW50cyA9IFtcbiAgICAgICAgLi4ubGlzdGVuZXJTY29wZS5yZXN0b3JlVmlld1N0YXRlbWVudCgpLCAuLi5saXN0ZW5lclNjb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCksXG4gICAgICAgIC4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10c1xuICAgICAgXTtcblxuICAgICAgY29uc3QgaGFuZGxlciA9IG8uZm4oXG4gICAgICAgICAgW25ldyBvLkZuUGFyYW0oJyRldmVudCcsIG8uRFlOQU1JQ19UWVBFKV0sIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCxcbiAgICAgICAgICBmdW5jdGlvbk5hbWUpO1xuXG4gICAgICByZXR1cm4gW28ubGl0ZXJhbChvdXRwdXRBc3QubmFtZSksIGhhbmRsZXJdO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBwcml2YXRlIF9waXBlQmluZEV4cHJzOiBGdW5jdGlvbkNhbGxbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcHJpdmF0ZSBhbGxvY2F0ZVNsb3Q6ICgpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgZGVmaW5lUGlwZTpcbiAgICAgICAgICAobmFtZTogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgc2xvdDogbnVtYmVyLCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyXG4gIHZpc2l0UGlwZShwaXBlOiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICAvLyBBbGxvY2F0ZSBhIHNsb3QgdG8gY3JlYXRlIHRoZSBwaXBlXG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVTbG90KCk7XG4gICAgY29uc3Qgc2xvdFBzZXVkb0xvY2FsID0gYFBJUEU6JHtzbG90fWA7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyBvbmUgc2xvdCBwZXIgcGlwZSBhcmd1bWVudFxuICAgIGNvbnN0IHB1cmVGdW5jdGlvblNsb3QgPSB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMoMiArIHBpcGUuYXJncy5sZW5ndGgpO1xuICAgIGNvbnN0IHRhcmdldCA9IG5ldyBQcm9wZXJ0eVJlYWQocGlwZS5zcGFuLCBuZXcgSW1wbGljaXRSZWNlaXZlcihwaXBlLnNwYW4pLCBzbG90UHNldWRvTG9jYWwpO1xuICAgIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwaXBlQmluZGluZ0NhbGxJbmZvKHBpcGUuYXJncyk7XG4gICAgdGhpcy5kZWZpbmVQaXBlKHBpcGUubmFtZSwgc2xvdFBzZXVkb0xvY2FsLCBzbG90LCBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikpO1xuICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW3BpcGUuZXhwLCAuLi5waXBlLmFyZ3NdO1xuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3M6IEFTVFtdID1cbiAgICAgICAgaXNWYXJMZW5ndGggPyB0aGlzLnZpc2l0QWxsKFtuZXcgTGl0ZXJhbEFycmF5KHBpcGUuc3BhbiwgYXJncyldKSA6IHRoaXMudmlzaXRBbGwoYXJncyk7XG5cbiAgICBjb25zdCBwaXBlQmluZEV4cHIgPSBuZXcgRnVuY3Rpb25DYWxsKHBpcGUuc3BhbiwgdGFyZ2V0LCBbXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHNsb3QpLFxuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwdXJlRnVuY3Rpb25TbG90KSxcbiAgICAgIC4uLmNvbnZlcnRlZEFyZ3MsXG4gICAgXSk7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5wdXNoKHBpcGVCaW5kRXhwcik7XG4gICAgcmV0dXJuIHBpcGVCaW5kRXhwcjtcbiAgfVxuXG4gIHVwZGF0ZVBpcGVTbG90T2Zmc2V0cyhiaW5kaW5nU2xvdHM6IG51bWJlcikge1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMuZm9yRWFjaCgocGlwZTogRnVuY3Rpb25DYWxsKSA9PiB7XG4gICAgICAvLyB1cGRhdGUgdGhlIHNsb3Qgb2Zmc2V0IGFyZyAoaW5kZXggMSkgdG8gYWNjb3VudCBmb3IgYmluZGluZyBzbG90c1xuICAgICAgY29uc3Qgc2xvdE9mZnNldCA9IHBpcGUuYXJnc1sxXSBhcyBMaXRlcmFsUHJpbWl0aXZlO1xuICAgICAgKHNsb3RPZmZzZXQudmFsdWUgYXMgbnVtYmVyKSArPSBiaW5kaW5nU2xvdHM7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxBcnJheShhcnJheTogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChhcnJheS5zcGFuLCB0aGlzLnZpc2l0QWxsKGFycmF5LmV4cHJlc3Npb25zKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgIHJldHVybiB2YWx1ZXMuZXZlcnkoYSA9PiBhLmlzQ29uc3RhbnQoKSkgP1xuICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChsaXRlcmFsLCB0cnVlKSA6XG4gICAgICAgICAgZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAobWFwOiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChtYXAuc3BhbiwgdGhpcy52aXNpdEFsbChtYXAudmFsdWVzKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuIE90aGVyd2lzZSwganVzdCByZXR1cm4gYW4gbGl0ZXJhbCBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsTWFwKHZhbHVlcy5tYXAoXG4gICAgICAgICAgKHZhbHVlLCBpbmRleCkgPT4gKHtrZXk6IG1hcC5rZXlzW2luZGV4XS5rZXksIHZhbHVlLCBxdW90ZWQ6IG1hcC5rZXlzW2luZGV4XS5xdW90ZWR9KSkpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxufVxuXG4vLyBQaXBlcyBhbHdheXMgaGF2ZSBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyLCB0aGUgdmFsdWUgdGhleSBvcGVyYXRlIG9uXG5jb25zdCBwaXBlQmluZGluZ0lkZW50aWZpZXJzID0gW1IzLnBpcGVCaW5kMSwgUjMucGlwZUJpbmQyLCBSMy5waXBlQmluZDMsIFIzLnBpcGVCaW5kNF07XG5cbmZ1bmN0aW9uIHBpcGVCaW5kaW5nQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHBpcGVCaW5kaW5nSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucGlwZUJpbmRWLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuY29uc3QgcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnMgPSBbXG4gIFIzLnB1cmVGdW5jdGlvbjAsIFIzLnB1cmVGdW5jdGlvbjEsIFIzLnB1cmVGdW5jdGlvbjIsIFIzLnB1cmVGdW5jdGlvbjMsIFIzLnB1cmVGdW5jdGlvbjQsXG4gIFIzLnB1cmVGdW5jdGlvbjUsIFIzLnB1cmVGdW5jdGlvbjYsIFIzLnB1cmVGdW5jdGlvbjcsIFIzLnB1cmVGdW5jdGlvbjhcbl07XG5cbmZ1bmN0aW9uIHB1cmVGdW5jdGlvbkNhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwdXJlRnVuY3Rpb25JZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5wdXJlRnVuY3Rpb25WLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5zdHJ1Y3Rpb24oXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgIHBhcmFtczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKHJlZmVyZW5jZSwgbnVsbCwgc3BhbikuY2FsbEZuKHBhcmFtcywgc3Bhbik7XG59XG5cbi8vIGUuZy4geCgyKTtcbmZ1bmN0aW9uIGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWxEaWZmOiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLm5leHRDb250ZXh0KVxuICAgICAgLmNhbGxGbihyZWxhdGl2ZUxldmVsRGlmZiA+IDEgPyBbby5saXRlcmFsKHJlbGF0aXZlTGV2ZWxEaWZmKV0gOiBbXSk7XG59XG5cbmZ1bmN0aW9uIGdldExpdGVyYWxGYWN0b3J5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBsaXRlcmFsOiBvLkxpdGVyYWxBcnJheUV4cHIgfCBvLkxpdGVyYWxNYXBFeHByLFxuICAgIGFsbG9jYXRlU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB7bGl0ZXJhbEZhY3RvcnksIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzfSA9IGNvbnN0YW50UG9vbC5nZXRMaXRlcmFsRmFjdG9yeShsaXRlcmFsKTtcbiAgLy8gQWxsb2NhdGUgMSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgMSBwZXIgYXJndW1lbnRcbiAgY29uc3Qgc3RhcnRTbG90ID0gYWxsb2NhdGVTbG90cygxICsgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoKTtcbiAgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoID4gMCB8fCBlcnJvcihgRXhwZWN0ZWQgYXJndW1lbnRzIHRvIGEgbGl0ZXJhbCBmYWN0b3J5IGZ1bmN0aW9uYCk7XG4gIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwdXJlRnVuY3Rpb25DYWxsSW5mbyhsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG5cbiAgLy8gTGl0ZXJhbCBmYWN0b3JpZXMgYXJlIHB1cmUgZnVuY3Rpb25zIHRoYXQgb25seSBuZWVkIHRvIGJlIHJlLWludm9rZWQgd2hlbiB0aGUgcGFyYW1ldGVyc1xuICAvLyBjaGFuZ2UuXG4gIGNvbnN0IGFyZ3MgPSBbXG4gICAgby5saXRlcmFsKHN0YXJ0U2xvdCksXG4gICAgbGl0ZXJhbEZhY3RvcnksXG4gIF07XG5cbiAgaWYgKGlzVmFyTGVuZ3RoKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbEFycihsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cykpO1xuICB9IGVsc2Uge1xuICAgIGFyZ3MucHVzaCguLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKGlkZW50aWZpZXIpLmNhbGxGbihhcmdzKTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG5leHBvcnQgdHlwZSBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IG8uU3RhdGVtZW50W107XG5cbi8qKiBUaGUgcHJlZml4IHVzZWQgdG8gZ2V0IGEgc2hhcmVkIGNvbnRleHQgaW4gQmluZGluZ1Njb3BlJ3MgbWFwLiAqL1xuY29uc3QgU0hBUkVEX0NPTlRFWFRfS0VZID0gJyQkc2hhcmVkX2N0eCQkJztcblxuLyoqXG4gKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0geCgyKS4kaW1wbGljaXRgLlxuICogLSBrZXkgdG8gdGhlIG1hcCBpcyB0aGUgc3RyaW5nIGxpdGVyYWwgYFwiYWJjXCJgLlxuICogLSB2YWx1ZSBgcmV0cmlldmFsTGV2ZWxgIGlzIHRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZCwgd2hpY2ggaXMgMiBsZXZlbHNcbiAqIHVwIGluIGV4YW1wbGUuXG4gKiAtIHZhbHVlIGBsaHNgIGlzIHRoZSBsZWZ0IGhhbmQgc2lkZSB3aGljaCBpcyBhbiBBU1QgcmVwcmVzZW50aW5nIGBhYmNgLlxuICogLSB2YWx1ZSBgZGVjbGFyZUxvY2FsQ2FsbGJhY2tgIGlzIGEgY2FsbGJhY2sgdGhhdCBpcyBpbnZva2VkIHdoZW4gZGVjbGFyaW5nIHRoZSBsb2NhbC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVgIGlzIHRydWUgaWYgdGhpcyB2YWx1ZSBuZWVkcyB0byBiZSBkZWNsYXJlZC5cbiAqIC0gdmFsdWUgYHByaW9yaXR5YCBkaWN0YXRlcyB0aGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhciBkZWNsYXJhdGlvbiBjb21wYXJlZFxuICogdG8gb3RoZXIgdmFyIGRlY2xhcmF0aW9ucyBvbiB0aGUgc2FtZSByZXRyaWV2YWwgbGV2ZWwuIEZvciBleGFtcGxlLCBpZiB0aGVyZSBpcyBhXG4gKiBjb250ZXh0IHZhcmlhYmxlIGFuZCBhIGxvY2FsIHJlZiBhY2Nlc3NpbmcgdGhlIHNhbWUgcGFyZW50IHZpZXcsIHRoZSBjb250ZXh0IHZhclxuICogZGVjbGFyYXRpb24gc2hvdWxkIGFsd2F5cyBjb21lIGJlZm9yZSB0aGUgbG9jYWwgcmVmIGRlY2xhcmF0aW9uLlxuICovXG50eXBlIEJpbmRpbmdEYXRhID0ge1xuICByZXRyaWV2YWxMZXZlbDogbnVtYmVyOyBsaHM6IG8uUmVhZFZhckV4cHI7IGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2s7XG4gIGRlY2xhcmU6IGJvb2xlYW47XG4gIHByaW9yaXR5OiBudW1iZXI7XG59O1xuXG4vKipcbiAqIFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIGEgbG9jYWwgdmFyaWFibGUgZGVjbGFyYXRpb24uIEhpZ2hlciBudW1iZXJzXG4gKiBtZWFuIHRoZSBkZWNsYXJhdGlvbiB3aWxsIGFwcGVhciBmaXJzdCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmNvbnN0IGVudW0gRGVjbGFyYXRpb25Qcmlvcml0eSB7IERFRkFVTFQgPSAwLCBDT05URVhUID0gMSwgU0hBUkVEX0NPTlRFWFQgPSAyIH1cblxuZXhwb3J0IGNsYXNzIEJpbmRpbmdTY29wZSBpbXBsZW1lbnRzIExvY2FsUmVzb2x2ZXIge1xuICAvKiogS2VlcHMgYSBtYXAgZnJvbSBsb2NhbCB2YXJpYWJsZXMgdG8gdGhlaXIgQmluZGluZ0RhdGEuICovXG4gIHByaXZhdGUgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEJpbmRpbmdEYXRhPigpO1xuICBwcml2YXRlIHJlZmVyZW5jZU5hbWVJbmRleCA9IDA7XG4gIHByaXZhdGUgcmVzdG9yZVZpZXdWYXJpYWJsZTogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0aWMgX1JPT1RfU0NPUEU6IEJpbmRpbmdTY29wZTtcblxuICBzdGF0aWMgZ2V0IFJPT1RfU0NPUEUoKTogQmluZGluZ1Njb3BlIHtcbiAgICBpZiAoIUJpbmRpbmdTY29wZS5fUk9PVF9TQ09QRSkge1xuICAgICAgQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFID0gbmV3IEJpbmRpbmdTY29wZSgpLnNldCgwLCAnJGV2ZW50Jywgby52YXJpYWJsZSgnJGV2ZW50JykpO1xuICAgIH1cbiAgICByZXR1cm4gQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihwdWJsaWMgYmluZGluZ0xldmVsOiBudW1iZXIgPSAwLCBwcml2YXRlIHBhcmVudDogQmluZGluZ1Njb3BlfG51bGwgPSBudWxsKSB7fVxuXG4gIGdldChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgbGV0IGN1cnJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gdGhpcztcbiAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgbGV0IHZhbHVlID0gY3VycmVudC5tYXAuZ2V0KG5hbWUpO1xuICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IHRoaXMpIHtcbiAgICAgICAgICAvLyBtYWtlIGEgbG9jYWwgY29weSBhbmQgcmVzZXQgdGhlIGBkZWNsYXJlYCBzdGF0ZVxuICAgICAgICAgIHZhbHVlID0ge1xuICAgICAgICAgICAgcmV0cmlldmFsTGV2ZWw6IHZhbHVlLnJldHJpZXZhbExldmVsLFxuICAgICAgICAgICAgbGhzOiB2YWx1ZS5saHMsXG4gICAgICAgICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICAgICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiB2YWx1ZS5wcmlvcml0eVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBDYWNoZSB0aGUgdmFsdWUgbG9jYWxseS5cbiAgICAgICAgICB0aGlzLm1hcC5zZXQobmFtZSwgdmFsdWUpO1xuICAgICAgICAgIC8vIFBvc3NpYmx5IGdlbmVyYXRlIGEgc2hhcmVkIGNvbnRleHQgdmFyXG4gICAgICAgICAgdGhpcy5tYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAmJiAhdmFsdWUuZGVjbGFyZSkge1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZS5saHM7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgZ2V0IHRvIHRoaXMgcG9pbnQsIHdlIGFyZSBsb29raW5nIGZvciBhIHByb3BlcnR5IG9uIHRoZSB0b3AgbGV2ZWwgY29tcG9uZW50XG4gICAgLy8gLSBJZiBsZXZlbCA9PT0gMCwgd2UgYXJlIG9uIHRoZSB0b3AgYW5kIGRvbid0IG5lZWQgdG8gcmUtZGVjbGFyZSBgY3R4YC5cbiAgICAvLyAtIElmIGxldmVsID4gMCwgd2UgYXJlIGluIGFuIGVtYmVkZGVkIHZpZXcuIFdlIG5lZWQgdG8gcmV0cmlldmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgLy8gbG9jYWwgdmFyIHdlIHVzZWQgdG8gc3RvcmUgdGhlIGNvbXBvbmVudCBjb250ZXh0LCBlLmcuIGNvbnN0ICRjb21wJCA9IHgoKTtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5nTGV2ZWwgPT09IDAgPyBudWxsIDogdGhpcy5nZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcmV0cmlldmFsTGV2ZWwgVGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcHJpb3JpdHkgVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXJcbiAgICogQHBhcmFtIGRlY2xhcmVMb2NhbENhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBkZWNsYXJpbmcgdGhpcyBsb2NhbCB2YXJcbiAgICovXG4gIHNldChyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGxoczogby5SZWFkVmFyRXhwcixcbiAgICAgIHByaW9yaXR5OiBudW1iZXIgPSBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrKTogQmluZGluZ1Njb3BlIHtcbiAgICAhdGhpcy5tYXAuaGFzKG5hbWUpIHx8XG4gICAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB0aGlzLm1hcC5zZXQobmFtZSwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiBkZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgIHByaW9yaXR5OiBwcmlvcml0eVxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7IHJldHVybiB0aGlzLmdldChuYW1lKTsgfVxuXG4gIG5lc3RlZFNjb3BlKGxldmVsOiBudW1iZXIpOiBCaW5kaW5nU2NvcGUge1xuICAgIGNvbnN0IG5ld1Njb3BlID0gbmV3IEJpbmRpbmdTY29wZShsZXZlbCwgdGhpcyk7XG4gICAgaWYgKGxldmVsID4gMCkgbmV3U2NvcGUuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICAgIHJldHVybiBuZXdTY29wZTtcbiAgfVxuXG4gIGdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByfG51bGwge1xuICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCk7XG4gICAgcmV0dXJuIHNoYXJlZEN0eE9iaiAmJiBzaGFyZWRDdHhPYmouZGVjbGFyZSA/IHNoYXJlZEN0eE9iai5saHMgOiBudWxsO1xuICB9XG5cbiAgbWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWU6IEJpbmRpbmdEYXRhKSB7XG4gICAgaWYgKHZhbHVlLnByaW9yaXR5ID09PSBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQpIHtcbiAgICAgIGNvbnN0IHNoYXJlZEN0eE9iaiA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyB2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICBpZiAoc2hhcmVkQ3R4T2JqKSB7XG4gICAgICAgIHNoYXJlZEN0eE9iai5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIocmV0cmlldmFsTGV2ZWw6IG51bWJlcikge1xuICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FICsgdGhpcy5mcmVzaFJlZmVyZW5jZU5hbWUoKSk7XG4gICAgdGhpcy5tYXAuc2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsLCB7XG4gICAgICByZXRyaWV2YWxMZXZlbDogcmV0cmlldmFsTGV2ZWwsXG4gICAgICBsaHM6IGxocyxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgIC8vIGNvbnN0IGN0eF9yMCA9IHgoMik7XG4gICAgICAgIHJldHVybiBbbGhzLnNldChnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKSkudG9Db25zdERlY2woKV07XG4gICAgICB9LFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBwcmlvcml0eTogRGVjbGFyYXRpb25Qcmlvcml0eS5TSEFSRURfQ09OVEVYVFxuICAgIH0pO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBjb21wb25lbnRWYWx1ZSA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSAhO1xuICAgIGNvbXBvbmVudFZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgIHRoaXMubWF5YmVSZXN0b3JlVmlldygwKTtcbiAgICByZXR1cm4gY29tcG9uZW50VmFsdWUubGhzLnByb3AobmFtZSk7XG4gIH1cblxuICBtYXliZVJlc3RvcmVWaWV3KHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5pc0xpc3RlbmVyU2NvcGUoKSAmJiByZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsKSB7XG4gICAgICBpZiAoIXRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgICAvLyBwYXJlbnQgc2F2ZXMgdmFyaWFibGUgdG8gZ2VuZXJhdGUgYSBzaGFyZWQgYGNvbnN0ICRzJCA9IGdWKCk7YCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUgPSBvLnZhcmlhYmxlKHRoaXMucGFyZW50ICEuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID0gdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlO1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmVWaWV3U3RhdGVtZW50KCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIHJWKCRzdGF0ZSQpO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbaW5zdHJ1Y3Rpb24obnVsbCwgUjMucmVzdG9yZVZpZXcsIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGVdKS50b1N0bXQoKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIHZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gY29uc3QgJHN0YXRlJCA9IGdWKCk7XG4gICAgY29uc3QgZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbiA9IGluc3RydWN0aW9uKG51bGwsIFIzLmdldEN1cnJlbnRWaWV3LCBbXSk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUuc2V0KGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24pLnRvQ29uc3REZWNsKCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICBpc0xpc3RlbmVyU2NvcGUoKSB7IHJldHVybiB0aGlzLnBhcmVudCAmJiB0aGlzLnBhcmVudC5iaW5kaW5nTGV2ZWwgPT09IHRoaXMuYmluZGluZ0xldmVsOyB9XG5cbiAgdmFyaWFibGVEZWNsYXJhdGlvbnMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgbGV0IGN1cnJlbnRDb250ZXh0TGV2ZWwgPSAwO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMubWFwLnZhbHVlcygpKVxuICAgICAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmRlY2xhcmUpXG4gICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnJldHJpZXZhbExldmVsIC0gYS5yZXRyaWV2YWxMZXZlbCB8fCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSlcbiAgICAgICAgLnJlZHVjZSgoc3RtdHM6IG8uU3RhdGVtZW50W10sIHZhbHVlOiBCaW5kaW5nRGF0YSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxldmVsRGlmZiA9IHRoaXMuYmluZGluZ0xldmVsIC0gdmFsdWUucmV0cmlldmFsTGV2ZWw7XG4gICAgICAgICAgY29uc3QgY3VyclN0bXRzID0gdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgISh0aGlzLCBsZXZlbERpZmYgLSBjdXJyZW50Q29udGV4dExldmVsKTtcbiAgICAgICAgICBjdXJyZW50Q29udGV4dExldmVsID0gbGV2ZWxEaWZmO1xuICAgICAgICAgIHJldHVybiBzdG10cy5jb25jYXQoY3VyclN0bXRzKTtcbiAgICAgICAgfSwgW10pIGFzIG8uU3RhdGVtZW50W107XG4gIH1cblxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBnaXZlbiBhIHRhZyBuYW1lIGFuZCBhIG1hcCBvZiBhdHRyaWJ1dGVzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNzc1NlbGVjdG9yKHRhZzogc3RyaW5nLCBhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudCh0YWcpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNbbmFtZV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG4gICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjc3NTZWxlY3Rvcjtcbn1cblxuLy8gUGFyc2UgaTE4biBtZXRhcyBsaWtlOlxuLy8gLSBcIkBAaWRcIixcbi8vIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuLy8gLSBcIm1lYW5pbmd8ZGVzY3JpcHRpb25bQEBpZF1cIlxuZnVuY3Rpb24gcGFyc2VJMThuTWV0YShpMThuPzogc3RyaW5nKToge2Rlc2NyaXB0aW9uPzogc3RyaW5nLCBpZD86IHN0cmluZywgbWVhbmluZz86IHN0cmluZ30ge1xuICBsZXQgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgaWQ6IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgaWYgKGkxOG4pIHtcbiAgICAvLyBUT0RPKHZpY2IpOiBmaWd1cmUgb3V0IGhvdyB0byBmb3JjZSBhIG1lc3NhZ2UgSUQgd2l0aCBjbG9zdXJlID9cbiAgICBjb25zdCBpZEluZGV4ID0gaTE4bi5pbmRleE9mKElEX1NFUEFSQVRPUik7XG5cbiAgICBjb25zdCBkZXNjSW5kZXggPSBpMThuLmluZGV4T2YoTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgaWRdID1cbiAgICAgICAgKGlkSW5kZXggPiAtMSkgPyBbaTE4bi5zbGljZSgwLCBpZEluZGV4KSwgaTE4bi5zbGljZShpZEluZGV4ICsgMildIDogW2kxOG4sICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID0gKGRlc2NJbmRleCA+IC0xKSA/XG4gICAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgICBbJycsIG1lYW5pbmdBbmREZXNjXTtcbiAgfVxuXG4gIHJldHVybiB7ZGVzY3JpcHRpb24sIGlkLCBtZWFuaW5nfTtcbn1cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUoYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICBhcmdzID0gYXJncy5zbGljZSgxKTsgIC8vIElnbm9yZSB0aGUgbGVuZ3RoIHByZWZpeCBhZGRlZCBmb3IgcmVuZGVyMlxuICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjIpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24zKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNCkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb241KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjYpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb244KS5jYWxsRm4oYXJncyk7XG4gIH1cbiAgKGFyZ3MubGVuZ3RoID49IDE5ICYmIGFyZ3MubGVuZ3RoICUgMiA9PSAxKSB8fFxuICAgICAgZXJyb3IoYEludmFsaWQgaW50ZXJwb2xhdGlvbiBhcmd1bWVudCBsZW5ndGggJHthcmdzLmxlbmd0aH1gKTtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uVikuY2FsbEZuKFtvLmxpdGVyYWxBcnIoYXJncyldKTtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIGludG8gcmVuZGVyMyBgTm9kZWBzIGFuZCBhZGRpdGlvbmFsIG1ldGFkYXRhLCB3aXRoIG5vIG90aGVyIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBAcGFyYW0gdGVtcGxhdGUgdGV4dCBvZiB0aGUgdGVtcGxhdGUgdG8gcGFyc2VcbiAqIEBwYXJhbSB0ZW1wbGF0ZVVybCBVUkwgdG8gdXNlIGZvciBzb3VyY2UgbWFwcGluZyBvZiB0aGUgcGFyc2VkIHRlbXBsYXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHRlbXBsYXRlVXJsOiBzdHJpbmcsIG9wdGlvbnM6IHtwcmVzZXJ2ZVdoaXRlc3BhY2VzPzogYm9vbGVhbn0gPSB7fSxcbiAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nKToge1xuICBlcnJvcnM/OiBQYXJzZUVycm9yW10sXG4gIG5vZGVzOiB0Lk5vZGVbXSxcbiAgaGFzTmdDb250ZW50OiBib29sZWFuLFxuICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdLFxuICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nXG59IHtcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKCk7XG4gIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuICBjb25zdCBwYXJzZVJlc3VsdCA9IGh0bWxQYXJzZXIucGFyc2UodGVtcGxhdGUsIHRlbXBsYXRlVXJsKTtcblxuICBpZiAocGFyc2VSZXN1bHQuZXJyb3JzICYmIHBhcnNlUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9yczogcGFyc2VSZXN1bHQuZXJyb3JzLFxuICAgICAgbm9kZXM6IFtdLFxuICAgICAgaGFzTmdDb250ZW50OiBmYWxzZSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogW10sIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoXG4gICAgfTtcbiAgfVxuXG4gIGxldCByb290Tm9kZXM6IGh0bWwuTm9kZVtdID0gcGFyc2VSZXN1bHQucm9vdE5vZGVzO1xuICBpZiAoIW9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwobmV3IFdoaXRlc3BhY2VWaXNpdG9yKCksIHJvb3ROb2Rlcyk7XG4gIH1cblxuICBjb25zdCB7bm9kZXMsIGhhc05nQ29udGVudCwgbmdDb250ZW50U2VsZWN0b3JzLCBlcnJvcnN9ID1cbiAgICAgIGh0bWxBc3RUb1JlbmRlcjNBc3Qocm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyKTtcbiAgaWYgKGVycm9ycyAmJiBlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7XG4gICAgICBlcnJvcnMsXG4gICAgICBub2RlczogW10sXG4gICAgICBoYXNOZ0NvbnRlbnQ6IGZhbHNlLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBbXSwgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGhcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHtub2RlcywgaGFzTmdDb250ZW50LCBuZ0NvbnRlbnRTZWxlY3RvcnMsIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRofTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBgQmluZGluZ1BhcnNlcmAgd2l0aCBhIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VCaW5kaW5nUGFyc2VyKCk6IEJpbmRpbmdQYXJzZXIge1xuICByZXR1cm4gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICBuZXcgUGFyc2VyKG5ldyBMZXhlcigpKSwgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpLCBudWxsLFxuICAgICAgW10pO1xufVxuXG5mdW5jdGlvbiBpc0NsYXNzQmluZGluZyhpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gaW5wdXQubmFtZSA9PSAnY2xhc3NOYW1lJyB8fCBpbnB1dC5uYW1lID09ICdjbGFzcyc7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTYW5pdGl6YXRpb25GbihpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgY29udGV4dDogY29yZS5TZWN1cml0eUNvbnRleHQpIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlID8gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU3R5bGUpIDogbnVsbDtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVJlc291cmNlVXJsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTdHlsZVNhbml0aXphYmxlKHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBzd2l0Y2ggKHByb3ApIHtcbiAgICBjYXNlICdiYWNrZ3JvdW5kLWltYWdlJzpcbiAgICBjYXNlICdiYWNrZ3JvdW5kJzpcbiAgICBjYXNlICdib3JkZXItaW1hZ2UnOlxuICAgIGNhc2UgJ2ZpbHRlcic6XG4gICAgY2FzZSAnbGlzdC1zdHlsZSc6XG4gICAgY2FzZSAnbGlzdC1zdHlsZS1pbWFnZSc6XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVTeW50aGV0aWNBdHRyaWJ1dGVOYW1lKG5hbWU6IHN0cmluZykge1xuICByZXR1cm4gJ0AnICsgbmFtZTtcbn1cbiJdfQ==