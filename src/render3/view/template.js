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
        define("@angular/compiler/src/render3/view/template", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/selector", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var expression_converter_1 = require("@angular/compiler/src/compiler_util/expression_converter");
    var core = require("@angular/compiler/src/core");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var o = require("@angular/compiler/src/output/output_ast");
    var selector_1 = require("@angular/compiler/src/selector");
    var util_1 = require("@angular/compiler/src/util");
    var t = require("@angular/compiler/src/render3/r3_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_2 = require("@angular/compiler/src/render3/view/util");
    var BINDING_INSTRUCTION_MAP = (_a = {},
        _a[0 /* Property */] = r3_identifiers_1.Identifiers.elementProperty,
        _a[1 /* Attribute */] = r3_identifiers_1.Identifiers.elementAttribute,
        _a[2 /* Class */] = r3_identifiers_1.Identifiers.elementClassNamed,
        _a[3 /* Style */] = r3_identifiers_1.Identifiers.elementStyleNamed,
        _a);
    var TemplateDefinitionBuilder = /** @class */ (function () {
        function TemplateDefinitionBuilder(constantPool, contextParameter, parentBindingScope, level, contextName, templateName, viewQueries, directiveMatcher, directives, pipeTypeByName, pipes) {
            if (level === void 0) { level = 0; }
            var _this = this;
            this.constantPool = constantPool;
            this.contextParameter = contextParameter;
            this.level = level;
            this.contextName = contextName;
            this.templateName = templateName;
            this.viewQueries = viewQueries;
            this.directiveMatcher = directiveMatcher;
            this.directives = directives;
            this.pipeTypeByName = pipeTypeByName;
            this.pipes = pipes;
            this._dataIndex = 0;
            this._bindingContext = 0;
            this._prefixCode = [];
            this._creationCode = [];
            this._variableCode = [];
            this._bindingCode = [];
            this._postfixCode = [];
            this._temporary = util_2.temporaryAllocator(this._prefixCode, util_2.TEMPORARY_NAME);
            this._projectionDefinitionIndex = -1;
            this._unsupported = util_2.unsupported;
            // Whether we are inside a translatable element (`<p i18n>... somewhere here ... </p>)
            this._inI18nSection = false;
            this._i18nSectionIndex = -1;
            // Maps of placeholder to node indexes for each of the i18n section
            this._phToNodeIdxes = [{}];
            // These should be handled in the template or element directly.
            this.visitReference = util_2.invalid;
            this.visitVariable = util_2.invalid;
            this.visitAttribute = util_2.invalid;
            this.visitBoundAttribute = util_2.invalid;
            this.visitBoundEvent = util_2.invalid;
            this._bindingScope =
                parentBindingScope.nestedScope(function (lhsVar, expression) {
                    _this._bindingCode.push(lhsVar.set(expression).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
                });
            this._valueConverter = new ValueConverter(constantPool, function () { return _this.allocateDataSlot(); }, function (name, localName, slot, value) {
                var pipeType = pipeTypeByName.get(name);
                if (pipeType) {
                    _this.pipes.add(pipeType);
                }
                _this._bindingScope.set(localName, value);
                _this._creationCode.push(o.importExpr(r3_identifiers_1.Identifiers.pipe).callFn([o.literal(slot), o.literal(name)]).toStmt());
            });
        }
        TemplateDefinitionBuilder.prototype.buildTemplateFunction = function (nodes, variables, hasNgContent, ngContentSelectors) {
            if (hasNgContent === void 0) { hasNgContent = false; }
            if (ngContentSelectors === void 0) { ngContentSelectors = []; }
            try {
                // Create variable bindings
                for (var variables_1 = tslib_1.__values(variables), variables_1_1 = variables_1.next(); !variables_1_1.done; variables_1_1 = variables_1.next()) {
                    var variable = variables_1_1.value;
                    var variableName = variable.name;
                    var expression = o.variable(this.contextParameter).prop(variable.value || util_2.IMPLICIT_REFERENCE);
                    var scopedName = this._bindingScope.freshReferenceName();
                    // Add the reference to the local scope.
                    this._bindingScope.set(variableName, o.variable(variableName + scopedName), expression);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (variables_1_1 && !variables_1_1.done && (_a = variables_1.return)) _a.call(variables_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            // Output a `ProjectionDef` instruction when some `<ng-content>` are present
            if (hasNgContent) {
                this._projectionDefinitionIndex = this.allocateDataSlot();
                var parameters = [o.literal(this._projectionDefinitionIndex)];
                // Only selectors with a non-default value are generated
                if (ngContentSelectors.length > 1) {
                    var r3Selectors = ngContentSelectors.map(function (s) { return core.parseSelectorToR3Selector(s); });
                    // `projectionDef` needs both the parsed and raw value of the selectors
                    var parsed = this.constantPool.getConstLiteral(util_2.asLiteral(r3Selectors), true);
                    var unParsed = this.constantPool.getConstLiteral(util_2.asLiteral(ngContentSelectors), true);
                    parameters.push(parsed, unParsed);
                }
                this.instruction.apply(this, tslib_1.__spread([this._creationCode, null, r3_identifiers_1.Identifiers.projectionDef], parameters));
            }
            try {
                // Define and update any view queries
                for (var _b = tslib_1.__values(this.viewQueries), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var query = _c.value;
                    // e.g. r3.Q(0, somePredicate, true);
                    var querySlot = this.allocateDataSlot();
                    var predicate = util_2.getQueryPredicate(query, this.constantPool);
                    var args = [
                        o.literal(querySlot, o.INFERRED_TYPE),
                        predicate,
                        o.literal(query.descendants, o.INFERRED_TYPE),
                    ];
                    if (query.read) {
                        args.push(query.read);
                    }
                    this.instruction.apply(this, tslib_1.__spread([this._creationCode, null, r3_identifiers_1.Identifiers.query], args));
                    // (r3.qR(tmp = r3.ɵld(0)) && (ctx.someDir = tmp));
                    var temporary = this._temporary();
                    var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.load).callFn([o.literal(querySlot)]);
                    var refresh = o.importExpr(r3_identifiers_1.Identifiers.queryRefresh).callFn([temporary.set(getQueryList)]);
                    var updateDirective = o.variable(util_2.CONTEXT_NAME)
                        .prop(query.propertyName)
                        .set(query.first ? temporary.prop('first') : temporary);
                    this._bindingCode.push(refresh.and(updateDirective).toStmt());
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_d = _b.return)) _d.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
            t.visitAll(this, nodes);
            var creationCode = this._creationCode.length > 0 ?
                [o.ifStmt(o.variable(util_2.RENDER_FLAGS).bitwiseAnd(o.literal(1 /* Create */), null, false), this._creationCode)] :
                [];
            var updateCode = this._bindingCode.length > 0 ?
                [o.ifStmt(o.variable(util_2.RENDER_FLAGS).bitwiseAnd(o.literal(2 /* Update */), null, false), this._bindingCode)] :
                [];
            try {
                // Generate maps of placeholder name to node indexes
                // TODO(vicb): This is a WIP, not fully supported yet
                for (var _e = tslib_1.__values(this._phToNodeIdxes), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var phToNodeIdx = _f.value;
                    if (Object.keys(phToNodeIdx).length > 0) {
                        var scopedName = this._bindingScope.freshReferenceName();
                        var phMap = o.variable(scopedName)
                            .set(util_2.mapToExpression(phToNodeIdx, true))
                            .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]);
                        this._prefixCode.push(phMap);
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_g = _e.return)) _g.call(_e);
                }
                finally { if (e_3) throw e_3.error; }
            }
            return o.fn([new o.FnParam(util_2.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(this.contextParameter, null)], tslib_1.__spread(this._prefixCode, creationCode, this._variableCode, updateCode, this._postfixCode), o.INFERRED_TYPE, null, this.templateName);
            var e_1, _a, e_2, _d, e_3, _g;
        };
        // LocalResolver
        TemplateDefinitionBuilder.prototype.getLocal = function (name) { return this._bindingScope.get(name); };
        TemplateDefinitionBuilder.prototype.visitContent = function (ngContent) {
            var slot = this.allocateDataSlot();
            var selectorIndex = ngContent.selectorIndex;
            var parameters = [
                o.literal(slot),
                o.literal(this._projectionDefinitionIndex),
            ];
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
            this.instruction.apply(this, tslib_1.__spread([this._creationCode, ngContent.sourceSpan, r3_identifiers_1.Identifiers.projection], parameters));
        };
        TemplateDefinitionBuilder.prototype.visitElement = function (element) {
            var _this = this;
            var elementIndex = this.allocateDataSlot();
            var referenceDataSlots = new Map();
            var wasInI18nSection = this._inI18nSection;
            var outputAttrs = {};
            var attrI18nMetas = {};
            var i18nMeta = '';
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
                for (var _a = tslib_1.__values(element.attributes), _b = _a.next(); !_b.done; _b = _a.next()) {
                    var attr = _b.value;
                    var name_1 = attr.name;
                    var value = attr.value;
                    if (name_1 === util_2.I18N_ATTR) {
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
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                }
                finally { if (e_4) throw e_4.error; }
            }
            // Match directives on non i18n attributes
            if (this.directiveMatcher) {
                var selector = createCssSelector(element.name, outputAttrs);
                this.directiveMatcher.match(selector, function (sel, staticType) { _this.directives.add(staticType); });
            }
            // Element creation mode
            var parameters = [
                o.literal(elementIndex),
                o.literal(element.name),
            ];
            // Add the attributes
            var i18nMessages = [];
            var attributes = [];
            var hasI18nAttr = false;
            Object.getOwnPropertyNames(outputAttrs).forEach(function (name) {
                var value = outputAttrs[name];
                attributes.push(o.literal(name));
                if (attrI18nMetas.hasOwnProperty(name)) {
                    hasI18nAttr = true;
                    var meta = parseI18nMeta(attrI18nMetas[name]);
                    var variable = _this.constantPool.getTranslation(value, meta);
                    attributes.push(variable);
                }
                else {
                    attributes.push(o.literal(value));
                }
            });
            var attrArg = o.TYPED_NULL_EXPR;
            if (attributes.length > 0) {
                attrArg = hasI18nAttr ? getLiteralFactory(this.constantPool, o.literalArr(attributes)) :
                    this.constantPool.getConstLiteral(o.literalArr(attributes), true);
            }
            parameters.push(attrArg);
            if (element.references && element.references.length > 0) {
                var references = compile_metadata_1.flatten(element.references.map(function (reference) {
                    var slot = _this.allocateDataSlot();
                    referenceDataSlots.set(reference.name, slot);
                    // Generate the update temporary.
                    var variableName = _this._bindingScope.freshReferenceName();
                    _this._variableCode.push(o.variable(variableName, o.INFERRED_TYPE)
                        .set(o.importExpr(r3_identifiers_1.Identifiers.load).callFn([o.literal(slot)]))
                        .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
                    _this._bindingScope.set(reference.name, o.variable(variableName));
                    return [reference.name, reference.value];
                }));
                parameters.push(this.constantPool.getConstLiteral(util_2.asLiteral(references), true));
            }
            else {
                parameters.push(o.TYPED_NULL_EXPR);
            }
            // Generate the instruction create element instruction
            if (i18nMessages.length > 0) {
                (_d = this._creationCode).push.apply(_d, tslib_1.__spread(i18nMessages));
            }
            this.instruction.apply(this, tslib_1.__spread([this._creationCode, element.sourceSpan, r3_identifiers_1.Identifiers.createElement], util_2.trimTrailingNulls(parameters)));
            var implicit = o.variable(util_2.CONTEXT_NAME);
            // Generate Listeners (outputs)
            element.outputs.forEach(function (outputAst) {
                var elName = compile_metadata_1.sanitizeIdentifier(element.name);
                var evName = compile_metadata_1.sanitizeIdentifier(outputAst.name);
                var functionName = _this.templateName + "_" + elName + "_" + evName + "_listener";
                var localVars = [];
                var bindingScope = _this._bindingScope.nestedScope(function (lhsVar, rhsExpression) {
                    localVars.push(lhsVar.set(rhsExpression).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
                });
                var bindingExpr = expression_converter_1.convertActionBinding(bindingScope, implicit, outputAst.handler, 'b', function () { return util_1.error('Unexpected interpolation'); });
                var handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], tslib_1.__spread(localVars, bindingExpr.render3Stmts), o.INFERRED_TYPE, null, functionName);
                _this.instruction(_this._creationCode, outputAst.sourceSpan, r3_identifiers_1.Identifiers.listener, o.literal(outputAst.name), handler);
            });
            // Generate element input bindings
            element.inputs.forEach(function (input) {
                if (input.type === 4 /* Animation */) {
                    _this._unsupported('animations');
                }
                var convertedBinding = _this.convertPropertyBinding(implicit, input.value);
                var instruction = BINDING_INSTRUCTION_MAP[input.type];
                if (instruction) {
                    // TODO(chuckj): runtime: security context?
                    var value = o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([convertedBinding]);
                    _this.instruction(_this._bindingCode, input.sourceSpan, instruction, o.literal(elementIndex), o.literal(input.name), value);
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
            // Finish element construction mode.
            this.instruction(this._creationCode, element.endSourceSpan || element.sourceSpan, r3_identifiers_1.Identifiers.elementEnd);
            // Restore the state before exiting this node
            this._inI18nSection = wasInI18nSection;
            var e_4, _c, _d;
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
            var templateContext = "ctx" + this.level;
            var parameters = [
                o.literal(templateIndex),
                o.variable(templateName),
                o.TYPED_NULL_EXPR,
            ];
            var attributeNames = [];
            var attributeMap = {};
            template.attributes.forEach(function (a) {
                attributeNames.push(util_2.asLiteral(a.name), util_2.asLiteral(''));
                attributeMap[a.name] = a.value;
            });
            // Match directives on template attributes
            if (this.directiveMatcher) {
                var selector = createCssSelector('ng-template', attributeMap);
                this.directiveMatcher.match(selector, function (cssSelector, staticType) { _this.directives.add(staticType); });
            }
            if (attributeNames.length) {
                parameters.push(this.constantPool.getConstLiteral(o.literalArr(attributeNames), true));
            }
            // e.g. C(1, C1Template)
            this.instruction.apply(this, tslib_1.__spread([this._creationCode, template.sourceSpan, r3_identifiers_1.Identifiers.containerCreate], util_2.trimTrailingNulls(parameters)));
            // e.g. p(1, 'forOf', ɵb(ctx.items));
            var context = o.variable(util_2.CONTEXT_NAME);
            template.inputs.forEach(function (input) {
                var convertedBinding = _this.convertPropertyBinding(context, input.value);
                _this.instruction(_this._bindingCode, template.sourceSpan, r3_identifiers_1.Identifiers.elementProperty, o.literal(templateIndex), o.literal(input.name), o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([convertedBinding]));
            });
            // Create the template function
            var templateVisitor = new TemplateDefinitionBuilder(this.constantPool, templateContext, this._bindingScope, this.level + 1, contextName, templateName, [], this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes);
            var templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables);
            this._postfixCode.push(templateFunctionExpr.toDeclStmt(templateName, null));
        };
        TemplateDefinitionBuilder.prototype.visitBoundText = function (text) {
            var nodeIndex = this.allocateDataSlot();
            this.instruction(this._creationCode, text.sourceSpan, r3_identifiers_1.Identifiers.text, o.literal(nodeIndex));
            this.instruction(this._bindingCode, text.sourceSpan, r3_identifiers_1.Identifiers.textCreateBound, o.literal(nodeIndex), this.convertPropertyBinding(o.variable(util_2.CONTEXT_NAME), text.value));
        };
        TemplateDefinitionBuilder.prototype.visitText = function (text) {
            this.instruction(this._creationCode, text.sourceSpan, r3_identifiers_1.Identifiers.text, o.literal(this.allocateDataSlot()), o.literal(text.value));
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
        // i0.ɵT(1, MSG_XYZ);
        // ```
        TemplateDefinitionBuilder.prototype.visitSingleI18nTextChild = function (text, i18nMeta) {
            var meta = parseI18nMeta(i18nMeta);
            var variable = this.constantPool.getTranslation(text.value, meta);
            this.instruction(this._creationCode, text.sourceSpan, r3_identifiers_1.Identifiers.text, o.literal(this.allocateDataSlot()), variable);
        };
        TemplateDefinitionBuilder.prototype.allocateDataSlot = function () { return this._dataIndex++; };
        TemplateDefinitionBuilder.prototype.bindingContext = function () { return "" + this._bindingContext++; };
        TemplateDefinitionBuilder.prototype.instruction = function (statements, span, reference) {
            var params = [];
            for (var _i = 3; _i < arguments.length; _i++) {
                params[_i - 3] = arguments[_i];
            }
            statements.push(o.importExpr(reference, null, span).callFn(params, span).toStmt());
        };
        TemplateDefinitionBuilder.prototype.convertPropertyBinding = function (implicit, value) {
            var pipesConvertedValue = value.visit(this._valueConverter);
            var convertedPropertyBinding = expression_converter_1.convertPropertyBinding(this, implicit, pipesConvertedValue, this.bindingContext(), expression_converter_1.BindingForm.TrySimple, interpolate);
            (_a = this._bindingCode).push.apply(_a, tslib_1.__spread(convertedPropertyBinding.stmts));
            return convertedPropertyBinding.currValExpr;
            var _a;
        };
        return TemplateDefinitionBuilder;
    }());
    exports.TemplateDefinitionBuilder = TemplateDefinitionBuilder;
    var ValueConverter = /** @class */ (function (_super) {
        tslib_1.__extends(ValueConverter, _super);
        function ValueConverter(constantPool, allocateSlot, definePipe) {
            var _this = _super.call(this) || this;
            _this.constantPool = constantPool;
            _this.allocateSlot = allocateSlot;
            _this.definePipe = definePipe;
            return _this;
        }
        // AstMemoryEfficientTransformer
        ValueConverter.prototype.visitPipe = function (pipe, context) {
            // Allocate a slot to create the pipe
            var slot = this.allocateSlot();
            var slotPseudoLocal = "PIPE:" + slot;
            var target = new ast_1.PropertyRead(pipe.span, new ast_1.ImplicitReceiver(pipe.span), slotPseudoLocal);
            var bindingId = pipeBinding(pipe.args);
            this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(bindingId));
            var value = pipe.exp.visit(this);
            var args = this.visitAll(pipe.args);
            return new ast_1.FunctionCall(pipe.span, target, tslib_1.__spread([new ast_1.LiteralPrimitive(pipe.span, slot), value], args));
        };
        ValueConverter.prototype.visitLiteralArray = function (array, context) {
            var _this = this;
            return new expression_converter_1.BuiltinFunctionCall(array.span, this.visitAll(array.expressions), function (values) {
                // If the literal has calculated (non-literal) elements transform it into
                // calls to literal factories that compose the literal and will cache intermediate
                // values. Otherwise, just return an literal array that contains the values.
                var literal = o.literalArr(values);
                return values.every(function (a) { return a.isConstant(); }) ? _this.constantPool.getConstLiteral(literal, true) :
                    getLiteralFactory(_this.constantPool, literal);
            });
        };
        ValueConverter.prototype.visitLiteralMap = function (map, context) {
            var _this = this;
            return new expression_converter_1.BuiltinFunctionCall(map.span, this.visitAll(map.values), function (values) {
                // If the literal has calculated (non-literal) elements  transform it into
                // calls to literal factories that compose the literal and will cache intermediate
                // values. Otherwise, just return an literal array that contains the values.
                var literal = o.literalMap(values.map(function (value, index) { return ({ key: map.keys[index].key, value: value, quoted: map.keys[index].quoted }); }));
                return values.every(function (a) { return a.isConstant(); }) ? _this.constantPool.getConstLiteral(literal, true) :
                    getLiteralFactory(_this.constantPool, literal);
            });
        };
        return ValueConverter;
    }(ast_1.AstMemoryEfficientTransformer));
    // Pipes always have at least one parameter, the value they operate on
    var pipeBindingIdentifiers = [r3_identifiers_1.Identifiers.pipeBind1, r3_identifiers_1.Identifiers.pipeBind2, r3_identifiers_1.Identifiers.pipeBind3, r3_identifiers_1.Identifiers.pipeBind4];
    function pipeBinding(args) {
        return pipeBindingIdentifiers[args.length] || r3_identifiers_1.Identifiers.pipeBindV;
    }
    var pureFunctionIdentifiers = [
        r3_identifiers_1.Identifiers.pureFunction0, r3_identifiers_1.Identifiers.pureFunction1, r3_identifiers_1.Identifiers.pureFunction2, r3_identifiers_1.Identifiers.pureFunction3, r3_identifiers_1.Identifiers.pureFunction4,
        r3_identifiers_1.Identifiers.pureFunction5, r3_identifiers_1.Identifiers.pureFunction6, r3_identifiers_1.Identifiers.pureFunction7, r3_identifiers_1.Identifiers.pureFunction8
    ];
    function getLiteralFactory(constantPool, literal) {
        var _a = constantPool.getLiteralFactory(literal), literalFactory = _a.literalFactory, literalFactoryArguments = _a.literalFactoryArguments;
        literalFactoryArguments.length > 0 || util_1.error("Expected arguments to a literal factory function");
        var pureFunctionIdent = pureFunctionIdentifiers[literalFactoryArguments.length] || r3_identifiers_1.Identifiers.pureFunctionV;
        // Literal factories are pure functions that only need to be re-invoked when the parameters
        // change.
        return o.importExpr(pureFunctionIdent).callFn(tslib_1.__spread([literalFactory], literalFactoryArguments));
    }
    var BindingScope = /** @class */ (function () {
        function BindingScope(parent, declareLocalVarCallback) {
            if (parent === void 0) { parent = null; }
            if (declareLocalVarCallback === void 0) { declareLocalVarCallback = util_2.noop; }
            this.parent = parent;
            this.declareLocalVarCallback = declareLocalVarCallback;
            /**
             * Keeps a map from local variables to their expressions.
             *
             * This is used when one refers to variable such as: 'let abc = a.b.c`.
             * - key to the map is the string literal `"abc"`.
             * - value `lhs` is the left hand side which is an AST representing `abc`.
             * - value `rhs` is the right hand side which is an AST representing `a.b.c`.
             * - value `declared` is true if the `declareLocalVarCallback` has been called for this scope
             * already.
             */
            this.map = new Map();
            this.referenceNameIndex = 0;
        }
        BindingScope.prototype.get = function (name) {
            var current = this;
            while (current) {
                var value = current.map.get(name);
                if (value != null) {
                    if (current !== this) {
                        // make a local copy and reset the `declared` state.
                        value = { lhs: value.lhs, rhs: value.rhs, declared: false };
                        // Cache the value locally.
                        this.map.set(name, value);
                    }
                    if (value.rhs && !value.declared) {
                        // if it is first time we are referencing the variable in the scope
                        // than invoke the callback to insert variable declaration.
                        this.declareLocalVarCallback(value.lhs, value.rhs);
                        value.declared = true;
                    }
                    return value.lhs;
                }
                current = current.parent;
            }
            return null;
        };
        /**
         * Create a local variable for later reference.
         *
         * @param name Name of the variable.
         * @param lhs AST representing the left hand side of the `let lhs = rhs;`.
         * @param rhs AST representing the right hand side of the `let lhs = rhs;`. The `rhs` can be
         * `undefined` for variable that are ambient such as `$event` and which don't have `rhs`
         * declaration.
         */
        BindingScope.prototype.set = function (name, lhs, rhs) {
            !this.map.has(name) ||
                util_1.error("The name " + name + " is already defined in scope to be " + this.map.get(name));
            this.map.set(name, { lhs: lhs, rhs: rhs, declared: false });
            return this;
        };
        BindingScope.prototype.getLocal = function (name) { return this.get(name); };
        BindingScope.prototype.nestedScope = function (declareCallback) {
            return new BindingScope(this, declareCallback);
        };
        BindingScope.prototype.freshReferenceName = function () {
            var current = this;
            // Find the top scope as it maintains the global reference count
            while (current.parent)
                current = current.parent;
            var ref = "" + util_2.REFERENCE_PREFIX + current.referenceNameIndex++;
            return ref;
        };
        BindingScope.ROOT_SCOPE = new BindingScope().set('$event', o.variable('$event'));
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
        var _a, _b;
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
    var _a;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUFtRTtJQUVuRSxpR0FBdUo7SUFFdkosaURBQW1DO0lBQ25DLG1FQUErTTtJQUMvTSwyREFBNkM7SUFFN0MsMkRBQTREO0lBQzVELG1EQUFnRDtJQUNoRCx3REFBK0I7SUFDL0IsK0VBQW9EO0lBR3BELGdFQUF3UjtJQUV4UixJQUFNLHVCQUF1QjtRQUMzQix1QkFBb0MsNEJBQUUsQ0FBQyxlQUFlO1FBQ3RELHdCQUFxQyw0QkFBRSxDQUFDLGdCQUFnQjtRQUN4RCxvQkFBaUMsNEJBQUUsQ0FBQyxpQkFBaUI7UUFDckQsb0JBQWlDLDRCQUFFLENBQUMsaUJBQWlCO1dBQ3RELENBQUM7SUFFRjtRQW9CRSxtQ0FDWSxZQUEwQixFQUFVLGdCQUF3QixFQUNwRSxrQkFBZ0MsRUFBVSxLQUFTLEVBQVUsV0FBd0IsRUFDN0UsWUFBeUIsRUFBVSxXQUE4QixFQUNqRSxnQkFBc0MsRUFBVSxVQUE2QixFQUM3RSxjQUF5QyxFQUFVLEtBQXdCO1lBSHpDLHNCQUFBLEVBQUEsU0FBUztZQUZ2RCxpQkFzQkM7WUFyQlcsaUJBQVksR0FBWixZQUFZLENBQWM7WUFBVSxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQVE7WUFDMUIsVUFBSyxHQUFMLEtBQUssQ0FBSTtZQUFVLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1lBQzdFLGlCQUFZLEdBQVosWUFBWSxDQUFhO1lBQVUsZ0JBQVcsR0FBWCxXQUFXLENBQW1CO1lBQ2pFLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBc0I7WUFBVSxlQUFVLEdBQVYsVUFBVSxDQUFtQjtZQUM3RSxtQkFBYyxHQUFkLGNBQWMsQ0FBMkI7WUFBVSxVQUFLLEdB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QUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RELEtBQUssRUFBRTtnQkFDTCxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyw0QkFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4RCxDQUFDO1FBQ0QsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdkMsWUFBSyxDQUFDLDJDQUF5QyxJQUFJLENBQUMsTUFBUSxDQUFDLENBQUM7UUFDbEUsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2ZsYXR0ZW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uLy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIEJ1aWx0aW5GdW5jdGlvbkNhbGwsIExvY2FsUmVzb2x2ZXIsIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIsIEJpbmRpbmdQaXBlLCBCb3VuZEVsZW1lbnRCaW5kaW5nVHlwZSwgRnVuY3Rpb25DYWxsLCBJbXBsaWNpdFJlY2VpdmVyLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIFByb3BlcnR5UmVhZH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Q09OVEVYVF9OQU1FLCBJMThOX0FUVFIsIEkxOE5fQVRUUl9QUkVGSVgsIElEX1NFUEFSQVRPUiwgSU1QTElDSVRfUkVGRVJFTkNFLCBNRUFOSU5HX1NFUEFSQVRPUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBURU1QT1JBUllfTkFNRSwgYXNMaXRlcmFsLCBnZXRRdWVyeVByZWRpY2F0ZSwgaW52YWxpZCwgbWFwVG9FeHByZXNzaW9uLCBub29wLCB0ZW1wb3JhcnlBbGxvY2F0b3IsIHRyaW1UcmFpbGluZ051bGxzLCB1bnN1cHBvcnRlZH0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgQklORElOR19JTlNUUlVDVElPTl9NQVA6IHtbdHlwZTogbnVtYmVyXTogby5FeHRlcm5hbFJlZmVyZW5jZX0gPSB7XG4gIFtCb3VuZEVsZW1lbnRCaW5kaW5nVHlwZS5Qcm9wZXJ0eV06IFIzLmVsZW1lbnRQcm9wZXJ0eSxcbiAgW0JvdW5kRWxlbWVudEJpbmRpbmdUeXBlLkF0dHJpYnV0ZV06IFIzLmVsZW1lbnRBdHRyaWJ1dGUsXG4gIFtCb3VuZEVsZW1lbnRCaW5kaW5nVHlwZS5DbGFzc106IFIzLmVsZW1lbnRDbGFzc05hbWVkLFxuICBbQm91bmRFbGVtZW50QmluZGluZ1R5cGUuU3R5bGVdOiBSMy5lbGVtZW50U3R5bGVOYW1lZCxcbn07XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGltcGxlbWVudHMgdC5WaXNpdG9yPHZvaWQ+LCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGF0YUluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvbnRleHQgPSAwO1xuICBwcml2YXRlIF9wcmVmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIHByaXZhdGUgX2NyZWF0aW9uQ29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIF92YXJpYWJsZUNvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfcG9zdGZpeENvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfdGVtcG9yYXJ5ID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHRoaXMuX3ByZWZpeENvZGUsIFRFTVBPUkFSWV9OQU1FKTtcbiAgcHJpdmF0ZSBfcHJvamVjdGlvbkRlZmluaXRpb25JbmRleCA9IC0xO1xuICBwcml2YXRlIF92YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIHByaXZhdGUgX3Vuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG4gIHByaXZhdGUgX2JpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlO1xuXG4gIC8vIFdoZXRoZXIgd2UgYXJlIGluc2lkZSBhIHRyYW5zbGF0YWJsZSBlbGVtZW50IChgPHAgaTE4bj4uLi4gc29tZXdoZXJlIGhlcmUgLi4uIDwvcD4pXG4gIHByaXZhdGUgX2luSTE4blNlY3Rpb246IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfaTE4blNlY3Rpb25JbmRleCA9IC0xO1xuICAvLyBNYXBzIG9mIHBsYWNlaG9sZGVyIHRvIG5vZGUgaW5kZXhlcyBmb3IgZWFjaCBvZiB0aGUgaTE4biBzZWN0aW9uXG4gIHByaXZhdGUgX3BoVG9Ob2RlSWR4ZXM6IHtbcGhOYW1lOiBzdHJpbmddOiBudW1iZXJbXX1bXSA9IFt7fV07XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwcml2YXRlIGNvbnRleHRQYXJhbWV0ZXI6IHN0cmluZyxcbiAgICAgIHBhcmVudEJpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlLCBwcml2YXRlIGxldmVsID0gMCwgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgdmlld1F1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLFxuICAgICAgcHJpdmF0ZSBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCwgcHJpdmF0ZSBkaXJlY3RpdmVzOiBTZXQ8by5FeHByZXNzaW9uPixcbiAgICAgIHByaXZhdGUgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sIHByaXZhdGUgcGlwZXM6IFNldDxvLkV4cHJlc3Npb24+KSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID1cbiAgICAgICAgcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKChsaHNWYXI6IG8uUmVhZFZhckV4cHIsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLnB1c2goXG4gICAgICAgICAgICAgIGxoc1Zhci5zZXQoZXhwcmVzc2lvbikudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgICAgICAgfSk7XG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgKCkgPT4gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCksXG4gICAgICAgIChuYW1lLCBsb2NhbE5hbWUsIHNsb3QsIHZhbHVlOiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGlwZVR5cGUgPSBwaXBlVHlwZUJ5TmFtZS5nZXQobmFtZSk7XG4gICAgICAgICAgaWYgKHBpcGVUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLnBpcGVzLmFkZChwaXBlVHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQobG9jYWxOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLnB1c2goXG4gICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5waXBlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSkudG9TdG10KCkpO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIGhhc05nQ29udGVudDogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdKTogby5GdW5jdGlvbkV4cHIge1xuICAgIC8vIENyZWF0ZSB2YXJpYWJsZSBiaW5kaW5nc1xuICAgIGZvciAoY29uc3QgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB2YXJpYWJsZS5uYW1lO1xuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9XG4gICAgICAgICAgby52YXJpYWJsZSh0aGlzLmNvbnRleHRQYXJhbWV0ZXIpLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKTtcbiAgICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICAvLyBBZGQgdGhlIHJlZmVyZW5jZSB0byB0aGUgbG9jYWwgc2NvcGUuXG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHZhcmlhYmxlTmFtZSwgby52YXJpYWJsZSh2YXJpYWJsZU5hbWUgKyBzY29wZWROYW1lKSwgZXhwcmVzc2lvbik7XG4gICAgfVxuXG4gICAgLy8gT3V0cHV0IGEgYFByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIHdoZW4gc29tZSBgPG5nLWNvbnRlbnQ+YCBhcmUgcHJlc2VudFxuICAgIGlmIChoYXNOZ0NvbnRlbnQpIHtcbiAgICAgIHRoaXMuX3Byb2plY3Rpb25EZWZpbml0aW9uSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbCh0aGlzLl9wcm9qZWN0aW9uRGVmaW5pdGlvbkluZGV4KV07XG5cbiAgICAgIC8vIE9ubHkgc2VsZWN0b3JzIHdpdGggYSBub24tZGVmYXVsdCB2YWx1ZSBhcmUgZ2VuZXJhdGVkXG4gICAgICBpZiAobmdDb250ZW50U2VsZWN0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY29uc3QgcjNTZWxlY3RvcnMgPSBuZ0NvbnRlbnRTZWxlY3RvcnMubWFwKHMgPT4gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHMpKTtcbiAgICAgICAgLy8gYHByb2plY3Rpb25EZWZgIG5lZWRzIGJvdGggdGhlIHBhcnNlZCBhbmQgcmF3IHZhbHVlIG9mIHRoZSBzZWxlY3RvcnNcbiAgICAgICAgY29uc3QgcGFyc2VkID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyM1NlbGVjdG9ycyksIHRydWUpO1xuICAgICAgICBjb25zdCB1blBhcnNlZCA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwobmdDb250ZW50U2VsZWN0b3JzKSwgdHJ1ZSk7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChwYXJzZWQsIHVuUGFyc2VkKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5pbnN0cnVjdGlvbih0aGlzLl9jcmVhdGlvbkNvZGUsIG51bGwsIFIzLnByb2plY3Rpb25EZWYsIC4uLnBhcmFtZXRlcnMpO1xuICAgIH1cblxuICAgIC8vIERlZmluZSBhbmQgdXBkYXRlIGFueSB2aWV3IHF1ZXJpZXNcbiAgICBmb3IgKGxldCBxdWVyeSBvZiB0aGlzLnZpZXdRdWVyaWVzKSB7XG4gICAgICAvLyBlLmcuIHIzLlEoMCwgc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgICBjb25zdCBxdWVyeVNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIGNvbnN0IHByZWRpY2F0ZSA9IGdldFF1ZXJ5UHJlZGljYXRlKHF1ZXJ5LCB0aGlzLmNvbnN0YW50UG9vbCk7XG4gICAgICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgICAgby5saXRlcmFsKHF1ZXJ5U2xvdCwgby5JTkZFUlJFRF9UWVBFKSxcbiAgICAgICAgcHJlZGljYXRlLFxuICAgICAgICBvLmxpdGVyYWwocXVlcnkuZGVzY2VuZGFudHMsIG8uSU5GRVJSRURfVFlQRSksXG4gICAgICBdO1xuXG4gICAgICBpZiAocXVlcnkucmVhZCkge1xuICAgICAgICBhcmdzLnB1c2gocXVlcnkucmVhZCk7XG4gICAgICB9XG4gICAgICB0aGlzLmluc3RydWN0aW9uKHRoaXMuX2NyZWF0aW9uQ29kZSwgbnVsbCwgUjMucXVlcnksIC4uLmFyZ3MpO1xuXG4gICAgICAvLyAocjMucVIodG1wID0gcjMuybVsZCgwKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgICBjb25zdCB0ZW1wb3JhcnkgPSB0aGlzLl90ZW1wb3JhcnkoKTtcbiAgICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkKS5jYWxsRm4oW28ubGl0ZXJhbChxdWVyeVNsb3QpXSk7XG4gICAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgICAgdGhpcy5fYmluZGluZ0NvZGUucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgICB9XG5cbiAgICB0LnZpc2l0QWxsKHRoaXMsIG5vZGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQ29kZSA9IHRoaXMuX2NyZWF0aW9uQ29kZS5sZW5ndGggPiAwID9cbiAgICAgICAgW28uaWZTdG10KFxuICAgICAgICAgICAgby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlKSwgbnVsbCwgZmFsc2UpLFxuICAgICAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlKV0gOlxuICAgICAgICBbXTtcblxuICAgIGNvbnN0IHVwZGF0ZUNvZGUgPSB0aGlzLl9iaW5kaW5nQ29kZS5sZW5ndGggPiAwID9cbiAgICAgICAgW28uaWZTdG10KFxuICAgICAgICAgICAgby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlKSwgbnVsbCwgZmFsc2UpLFxuICAgICAgICAgICAgdGhpcy5fYmluZGluZ0NvZGUpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgbWFwcyBvZiBwbGFjZWhvbGRlciBuYW1lIHRvIG5vZGUgaW5kZXhlc1xuICAgIC8vIFRPRE8odmljYik6IFRoaXMgaXMgYSBXSVAsIG5vdCBmdWxseSBzdXBwb3J0ZWQgeWV0XG4gICAgZm9yIChjb25zdCBwaFRvTm9kZUlkeCBvZiB0aGlzLl9waFRvTm9kZUlkeGVzKSB7XG4gICAgICBpZiAoT2JqZWN0LmtleXMocGhUb05vZGVJZHgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgICAgY29uc3QgcGhNYXAgPSBvLnZhcmlhYmxlKHNjb3BlZE5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQobWFwVG9FeHByZXNzaW9uKHBoVG9Ob2RlSWR4LCB0cnVlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKTtcblxuICAgICAgICB0aGlzLl9wcmVmaXhDb2RlLnB1c2gocGhNYXApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKHRoaXMuY29udGV4dFBhcmFtZXRlciwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkNvZGUsXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgbG9jYWwgcmVmcyAoaS5lLiBjb25zdCB0bXAgPSBsZCgxKSBhcyBhbnkpXG4gICAgICAgICAgLi4udGhpcy5fdmFyaWFibGVDb2RlLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUNvZGUsXG4gICAgICAgICAgLy8gTmVzdGVkIHRlbXBsYXRlcyAoaS5lLiBmdW5jdGlvbiBDb21wVGVtcGxhdGUoKSB7fSlcbiAgICAgICAgICAuLi50aGlzLl9wb3N0Zml4Q29kZVxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzZWxlY3RvckluZGV4ID0gbmdDb250ZW50LnNlbGVjdG9ySW5kZXg7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgICBvLmxpdGVyYWwodGhpcy5fcHJvamVjdGlvbkRlZmluaXRpb25JbmRleCksXG4gICAgXTtcblxuICAgIGNvbnN0IGF0dHJpYnV0ZUFzTGlzdDogc3RyaW5nW10gPSBbXTtcblxuICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZvckVhY2goKGF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHJpYnV0ZS5uYW1lO1xuICAgICAgaWYgKG5hbWUgIT09ICdzZWxlY3QnKSB7XG4gICAgICAgIGF0dHJpYnV0ZUFzTGlzdC5wdXNoKG5hbWUsIGF0dHJpYnV0ZS52YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYXR0cmlidXRlQXNMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCksIGFzTGl0ZXJhbChhdHRyaWJ1dGVBc0xpc3QpKTtcbiAgICB9IGVsc2UgaWYgKHNlbGVjdG9ySW5kZXggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCkpO1xuICAgIH1cblxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24odGhpcy5fY3JlYXRpb25Db2RlLCBuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgLi4ucGFyYW1ldGVycyk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxlbWVudEluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgcmVmZXJlbmNlRGF0YVNsb3RzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBjb25zdCB3YXNJbkkxOG5TZWN0aW9uID0gdGhpcy5faW5JMThuU2VjdGlvbjtcblxuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBjb25zdCBhdHRySTE4bk1ldGFzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBsZXQgaTE4bk1ldGE6IHN0cmluZyA9ICcnO1xuXG4gICAgLy8gRWxlbWVudHMgaW5zaWRlIGkxOG4gc2VjdGlvbnMgYXJlIHJlcGxhY2VkIHdpdGggcGxhY2Vob2xkZXJzXG4gICAgLy8gVE9ETyh2aWNiKTogbmVzdGVkIGVsZW1lbnRzIGFyZSBhIFdJUCBpbiB0aGlzIHBoYXNlXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgIGNvbnN0IHBoTmFtZSA9IGVsZW1lbnQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKCF0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0pIHtcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0ucHVzaChlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSBpMThuIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgICBjb25zdCBuYW1lID0gYXR0ci5uYW1lO1xuICAgICAgY29uc3QgdmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgICAgaWYgKG5hbWUgPT09IEkxOE5fQVRUUikge1xuICAgICAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYENvdWxkIG5vdCBtYXJrIGFuIGVsZW1lbnQgYXMgdHJhbnNsYXRhYmxlIGluc2lkZSBvZiBhIHRyYW5zbGF0YWJsZSBzZWN0aW9uYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5JMThuU2VjdGlvbiA9IHRydWU7XG4gICAgICAgIHRoaXMuX2kxOG5TZWN0aW9uSW5kZXgrKztcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XSA9IHt9O1xuICAgICAgICBpMThuTWV0YSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgYXR0ckkxOG5NZXRhc1tuYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKV0gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dEF0dHJzW25hbWVdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWF0Y2ggZGlyZWN0aXZlcyBvbiBub24gaTE4biBhdHRyaWJ1dGVzXG4gICAgaWYgKHRoaXMuZGlyZWN0aXZlTWF0Y2hlcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVDc3NTZWxlY3RvcihlbGVtZW50Lm5hbWUsIG91dHB1dEF0dHJzKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKHNlbDogQ3NzU2VsZWN0b3IsIHN0YXRpY1R5cGU6IGFueSkgPT4geyB0aGlzLmRpcmVjdGl2ZXMuYWRkKHN0YXRpY1R5cGUpOyB9KTtcbiAgICB9XG5cbiAgICAvLyBFbGVtZW50IGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLFxuICAgICAgby5saXRlcmFsKGVsZW1lbnQubmFtZSksXG4gICAgXTtcblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGkxOG5NZXNzYWdlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgbGV0IGhhc0kxOG5BdHRyID0gZmFsc2U7XG5cbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvdXRwdXRBdHRycykuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gb3V0cHV0QXR0cnNbbmFtZV07XG4gICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKG5hbWUpKTtcbiAgICAgIGlmIChhdHRySTE4bk1ldGFzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGhhc0kxOG5BdHRyID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgbWV0YSA9IHBhcnNlSTE4bk1ldGEoYXR0ckkxOG5NZXRhc1tuYW1lXSk7XG4gICAgICAgIGNvbnN0IHZhcmlhYmxlID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0VHJhbnNsYXRpb24odmFsdWUsIG1ldGEpO1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2godmFyaWFibGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKG8ubGl0ZXJhbCh2YWx1ZSkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgbGV0IGF0dHJBcmc6IG8uRXhwcmVzc2lvbiA9IG8uVFlQRURfTlVMTF9FWFBSO1xuXG4gICAgaWYgKGF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgYXR0ckFyZyA9IGhhc0kxOG5BdHRyID8gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVzKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVzKSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgcGFyYW1ldGVycy5wdXNoKGF0dHJBcmcpO1xuXG4gICAgaWYgKGVsZW1lbnQucmVmZXJlbmNlcyAmJiBlbGVtZW50LnJlZmVyZW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcmVmZXJlbmNlcyA9IGZsYXR0ZW4oZWxlbWVudC5yZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICAgIHJlZmVyZW5jZURhdGFTbG90cy5zZXQocmVmZXJlbmNlLm5hbWUsIHNsb3QpO1xuICAgICAgICAvLyBHZW5lcmF0ZSB0aGUgdXBkYXRlIHRlbXBvcmFyeS5cbiAgICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgICB0aGlzLl92YXJpYWJsZUNvZGUucHVzaChvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSwgby5JTkZFUlJFRF9UWVBFKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCldKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSkpO1xuICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHJlZmVyZW5jZS5uYW1lLCBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSkpO1xuICAgICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgICAgfSkpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocmVmZXJlbmNlcyksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uVFlQRURfTlVMTF9FWFBSKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgaW5zdHJ1Y3Rpb24gY3JlYXRlIGVsZW1lbnQgaW5zdHJ1Y3Rpb25cbiAgICBpZiAoaTE4bk1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZS5wdXNoKC4uLmkxOG5NZXNzYWdlcyk7XG4gICAgfVxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5jcmVhdGVFbGVtZW50LCAuLi50cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICBjb25zdCBpbXBsaWNpdCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcblxuICAgIC8vIEdlbmVyYXRlIExpc3RlbmVycyAob3V0cHV0cylcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IGVsTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihlbGVtZW50Lm5hbWUpO1xuICAgICAgY29uc3QgZXZOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKG91dHB1dEFzdC5uYW1lKTtcbiAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke2VsTmFtZX1fJHtldk5hbWV9X2xpc3RlbmVyYDtcbiAgICAgIGNvbnN0IGxvY2FsVmFyczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgY29uc3QgYmluZGluZ1Njb3BlID1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUoKGxoc1Zhcjogby5SZWFkVmFyRXhwciwgcmhzRXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgICBsb2NhbFZhcnMucHVzaChcbiAgICAgICAgICAgICAgICBsaHNWYXIuc2V0KHJoc0V4cHJlc3Npb24pLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gICAgICAgICAgfSk7XG4gICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgIGJpbmRpbmdTY29wZSwgaW1wbGljaXQsIG91dHB1dEFzdC5oYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgICBjb25zdCBoYW5kbGVyID0gby5mbihcbiAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSwgWy4uLmxvY2FsVmFycywgLi4uYmluZGluZ0V4cHIucmVuZGVyM1N0bXRzXSxcbiAgICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIGZ1bmN0aW9uTmFtZSk7XG4gICAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgb3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLCBvLmxpdGVyYWwob3V0cHV0QXN0Lm5hbWUpLFxuICAgICAgICAgIGhhbmRsZXIpO1xuICAgIH0pO1xuXG5cbiAgICAvLyBHZW5lcmF0ZSBlbGVtZW50IGlucHV0IGJpbmRpbmdzXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGlmIChpbnB1dC50eXBlID09PSBCb3VuZEVsZW1lbnRCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgdGhpcy5fdW5zdXBwb3J0ZWQoJ2FuaW1hdGlvbnMnKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvbnZlcnRlZEJpbmRpbmcgPSB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIGlucHV0LnZhbHVlKTtcbiAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gQklORElOR19JTlNUUlVDVElPTl9NQVBbaW5wdXQudHlwZV07XG4gICAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgLy8gVE9ETyhjaHVja2opOiBydW50aW1lOiBzZWN1cml0eSBjb250ZXh0P1xuICAgICAgICBjb25zdCB2YWx1ZSA9IG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW2NvbnZlcnRlZEJpbmRpbmddKTtcbiAgICAgICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLCBpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbiwgby5saXRlcmFsKGVsZW1lbnRJbmRleCksXG4gICAgICAgICAgICBvLmxpdGVyYWwoaW5wdXQubmFtZSksIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Vuc3VwcG9ydGVkKGBiaW5kaW5nIHR5cGUgJHtpbnB1dC50eXBlfWApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVHJhdmVyc2UgZWxlbWVudCBjaGlsZCBub2Rlc1xuICAgIGlmICh0aGlzLl9pbkkxOG5TZWN0aW9uICYmIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID09IDEgJiZcbiAgICAgICAgZWxlbWVudC5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgY29uc3QgdGV4dCA9IGVsZW1lbnQuY2hpbGRyZW5bMF0gYXMgdC5UZXh0O1xuICAgICAgdGhpcy52aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dCwgaTE4bk1ldGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIH1cblxuICAgIC8vIEZpbmlzaCBlbGVtZW50IGNvbnN0cnVjdGlvbiBtb2RlLlxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZWxlbWVudEVuZCk7XG5cbiAgICAvLyBSZXN0b3JlIHRoZSBzdGF0ZSBiZWZvcmUgZXhpdGluZyB0aGlzIG5vZGVcbiAgICB0aGlzLl9pbkkxOG5TZWN0aW9uID0gd2FzSW5JMThuU2VjdGlvbjtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICBsZXQgZWxOYW1lID0gJyc7XG4gICAgaWYgKHRlbXBsYXRlLmNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiB0ZW1wbGF0ZS5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudCkge1xuICAgICAgLy8gV2hlbiB0aGUgdGVtcGxhdGUgYXMgYSBzaW5nbGUgY2hpbGQsIGRlcml2ZSB0aGUgY29udGV4dCBuYW1lIGZyb20gdGhlIHRhZ1xuICAgICAgZWxOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKCh0ZW1wbGF0ZS5jaGlsZHJlblswXSBhcyB0LkVsZW1lbnQpLm5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRleHROYW1lID0gZWxOYW1lID8gYCR7dGhpcy5jb250ZXh0TmFtZX1fJHtlbE5hbWV9YCA6ICcnO1xuXG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID1cbiAgICAgICAgY29udGV4dE5hbWUgPyBgJHtjb250ZXh0TmFtZX1fVGVtcGxhdGVfJHt0ZW1wbGF0ZUluZGV4fWAgOiBgVGVtcGxhdGVfJHt0ZW1wbGF0ZUluZGV4fWA7XG5cbiAgICBjb25zdCB0ZW1wbGF0ZUNvbnRleHQgPSBgY3R4JHt0aGlzLmxldmVsfWA7XG5cbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZUluZGV4KSxcbiAgICAgIG8udmFyaWFibGUodGVtcGxhdGVOYW1lKSxcbiAgICAgIG8uVFlQRURfTlVMTF9FWFBSLFxuICAgIF07XG5cbiAgICBjb25zdCBhdHRyaWJ1dGVOYW1lczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVNYXA6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgdGVtcGxhdGUuYXR0cmlidXRlcy5mb3JFYWNoKGEgPT4ge1xuICAgICAgYXR0cmlidXRlTmFtZXMucHVzaChhc0xpdGVyYWwoYS5uYW1lKSwgYXNMaXRlcmFsKCcnKSk7XG4gICAgICBhdHRyaWJ1dGVNYXBbYS5uYW1lXSA9IGEudmFsdWU7XG4gICAgfSk7XG5cbiAgICAvLyBNYXRjaCBkaXJlY3RpdmVzIG9uIHRlbXBsYXRlIGF0dHJpYnV0ZXNcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKCduZy10ZW1wbGF0ZScsIGF0dHJpYnV0ZU1hcCk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIubWF0Y2goXG4gICAgICAgICAgc2VsZWN0b3IsIChjc3NTZWxlY3Rvciwgc3RhdGljVHlwZSkgPT4geyB0aGlzLmRpcmVjdGl2ZXMuYWRkKHN0YXRpY1R5cGUpOyB9KTtcbiAgICB9XG5cbiAgICBpZiAoYXR0cmlidXRlTmFtZXMubGVuZ3RoKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVOYW1lcyksIHRydWUpKTtcbiAgICB9XG5cbiAgICAvLyBlLmcuIEMoMSwgQzFUZW1wbGF0ZSlcbiAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICB0aGlzLl9jcmVhdGlvbkNvZGUsIHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLmNvbnRhaW5lckNyZWF0ZSxcbiAgICAgICAgLi4udHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgLy8gZS5nLiBwKDEsICdmb3JPZicsIMm1YihjdHguaXRlbXMpKTtcbiAgICBjb25zdCBjb250ZXh0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgIHRlbXBsYXRlLmlucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IGNvbnZlcnRlZEJpbmRpbmcgPSB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoY29udGV4dCwgaW5wdXQudmFsdWUpO1xuICAgICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgICB0aGlzLl9iaW5kaW5nQ29kZSwgdGVtcGxhdGUuc291cmNlU3BhbiwgUjMuZWxlbWVudFByb3BlcnR5LCBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksXG4gICAgICAgICAgby5saXRlcmFsKGlucHV0Lm5hbWUpLCBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFtjb252ZXJ0ZWRCaW5kaW5nXSkpO1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICAgIGNvbnN0IHRlbXBsYXRlVmlzaXRvciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbCwgdGVtcGxhdGVDb250ZXh0LCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSxcbiAgICAgICAgdGVtcGxhdGVOYW1lLCBbXSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsIHRoaXMucGlwZXMpO1xuICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID1cbiAgICAgICAgdGVtcGxhdGVWaXNpdG9yLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbih0ZW1wbGF0ZS5jaGlsZHJlbiwgdGVtcGxhdGUudmFyaWFibGVzKTtcbiAgICB0aGlzLl9wb3N0Zml4Q29kZS5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gIH1cblxuICAvLyBUaGVzZSBzaG91bGQgYmUgaGFuZGxlZCBpbiB0aGUgdGVtcGxhdGUgb3IgZWxlbWVudCBkaXJlY3RseS5cbiAgcmVhZG9ubHkgdmlzaXRSZWZlcmVuY2UgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFZhcmlhYmxlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgdGhpcy5pbnN0cnVjdGlvbih0aGlzLl9jcmVhdGlvbkNvZGUsIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgby5saXRlcmFsKG5vZGVJbmRleCkpO1xuXG4gICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgdGhpcy5fYmluZGluZ0NvZGUsIHRleHQuc291cmNlU3BhbiwgUjMudGV4dENyZWF0ZUJvdW5kLCBvLmxpdGVyYWwobm9kZUluZGV4KSxcbiAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSwgdGV4dC52YWx1ZSkpO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IHQuVGV4dCkge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLFxuICAgICAgICBvLmxpdGVyYWwodGV4dC52YWx1ZSkpO1xuICB9XG5cbiAgLy8gV2hlbiB0aGUgY29udGVudCBvZiB0aGUgZWxlbWVudCBpcyBhIHNpbmdsZSB0ZXh0IG5vZGUgdGhlIHRyYW5zbGF0aW9uIGNhbiBiZSBpbmxpbmVkOlxuICAvL1xuICAvLyBgPHAgaTE4bj1cImRlc2N8bWVhblwiPnNvbWUgY29udGVudDwvcD5gXG4gIC8vIGNvbXBpbGVzIHRvXG4gIC8vIGBgYFxuICAvLyAvKipcbiAgLy8gKiBAZGVzYyBkZXNjXG4gIC8vICogQG1lYW5pbmcgbWVhblxuICAvLyAqL1xuICAvLyBjb25zdCBNU0dfWFlaID0gZ29vZy5nZXRNc2coJ3NvbWUgY29udGVudCcpO1xuICAvLyBpMC7JtVQoMSwgTVNHX1hZWik7XG4gIC8vIGBgYFxuICB2aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dDogdC5UZXh0LCBpMThuTWV0YTogc3RyaW5nKSB7XG4gICAgY29uc3QgbWV0YSA9IHBhcnNlSTE4bk1ldGEoaTE4bk1ldGEpO1xuICAgIGNvbnN0IHZhcmlhYmxlID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0VHJhbnNsYXRpb24odGV4dC52YWx1ZSwgbWV0YSk7XG4gICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIG8ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIHZhcmlhYmxlKTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVEYXRhU2xvdCgpIHsgcmV0dXJuIHRoaXMuX2RhdGFJbmRleCsrOyB9XG4gIHByaXZhdGUgYmluZGluZ0NvbnRleHQoKSB7IHJldHVybiBgJHt0aGlzLl9iaW5kaW5nQ29udGV4dCsrfWA7IH1cblxuICBwcml2YXRlIGluc3RydWN0aW9uKFxuICAgICAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIC4uLnBhcmFtczogby5FeHByZXNzaW9uW10pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2goby5pbXBvcnRFeHByKHJlZmVyZW5jZSwgbnVsbCwgc3BhbikuY2FsbEZuKHBhcmFtcywgc3BhbikudG9TdG10KCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0OiBvLkV4cHJlc3Npb24sIHZhbHVlOiBBU1QpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHBpcGVzQ29udmVydGVkVmFsdWUgPSB2YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgdGhpcywgaW1wbGljaXQsIHBpcGVzQ29udmVydGVkVmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLFxuICAgICAgICBpbnRlcnBvbGF0ZSk7XG4gICAgdGhpcy5fYmluZGluZ0NvZGUucHVzaCguLi5jb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuc3RtdHMpO1xuICAgIHJldHVybiBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG4gIH1cbn1cblxuY2xhc3MgVmFsdWVDb252ZXJ0ZXIgZXh0ZW5kcyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcHJpdmF0ZSBhbGxvY2F0ZVNsb3Q6ICgpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgZGVmaW5lUGlwZTpcbiAgICAgICAgICAobmFtZTogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgc2xvdDogbnVtYmVyLCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyXG4gIHZpc2l0UGlwZShwaXBlOiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICAvLyBBbGxvY2F0ZSBhIHNsb3QgdG8gY3JlYXRlIHRoZSBwaXBlXG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVTbG90KCk7XG4gICAgY29uc3Qgc2xvdFBzZXVkb0xvY2FsID0gYFBJUEU6JHtzbG90fWA7XG4gICAgY29uc3QgdGFyZ2V0ID0gbmV3IFByb3BlcnR5UmVhZChwaXBlLnNwYW4sIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHBpcGUuc3BhbiksIHNsb3RQc2V1ZG9Mb2NhbCk7XG4gICAgY29uc3QgYmluZGluZ0lkID0gcGlwZUJpbmRpbmcocGlwZS5hcmdzKTtcbiAgICB0aGlzLmRlZmluZVBpcGUocGlwZS5uYW1lLCBzbG90UHNldWRvTG9jYWwsIHNsb3QsIG8uaW1wb3J0RXhwcihiaW5kaW5nSWQpKTtcbiAgICBjb25zdCB2YWx1ZSA9IHBpcGUuZXhwLnZpc2l0KHRoaXMpO1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnZpc2l0QWxsKHBpcGUuYXJncyk7XG5cbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uQ2FsbChcbiAgICAgICAgcGlwZS5zcGFuLCB0YXJnZXQsIFtuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHNsb3QpLCB2YWx1ZSwgLi4uYXJnc10pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXJyYXk6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoYXJyYXkuc3BhbiwgdGhpcy52aXNpdEFsbChhcnJheS5leHByZXNzaW9ucyksIHZhbHVlcyA9PiB7XG4gICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuIE90aGVyd2lzZSwganVzdCByZXR1cm4gYW4gbGl0ZXJhbCBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsQXJyKHZhbHVlcyk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID8gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAobWFwOiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChtYXAuc3BhbiwgdGhpcy52aXNpdEFsbChtYXAudmFsdWVzKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuIE90aGVyd2lzZSwganVzdCByZXR1cm4gYW4gbGl0ZXJhbCBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsTWFwKHZhbHVlcy5tYXAoXG4gICAgICAgICAgKHZhbHVlLCBpbmRleCkgPT4gKHtrZXk6IG1hcC5rZXlzW2luZGV4XS5rZXksIHZhbHVlLCBxdW90ZWQ6IG1hcC5rZXlzW2luZGV4XS5xdW90ZWR9KSkpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChsaXRlcmFsLCB0cnVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwpO1xuICAgIH0pO1xuICB9XG59XG5cblxuXG4vLyBQaXBlcyBhbHdheXMgaGF2ZSBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyLCB0aGUgdmFsdWUgdGhleSBvcGVyYXRlIG9uXG5jb25zdCBwaXBlQmluZGluZ0lkZW50aWZpZXJzID0gW1IzLnBpcGVCaW5kMSwgUjMucGlwZUJpbmQyLCBSMy5waXBlQmluZDMsIFIzLnBpcGVCaW5kNF07XG5cbmZ1bmN0aW9uIHBpcGVCaW5kaW5nKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHRlcm5hbFJlZmVyZW5jZSB7XG4gIHJldHVybiBwaXBlQmluZGluZ0lkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXSB8fCBSMy5waXBlQmluZFY7XG59XG5cbmNvbnN0IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzID0gW1xuICBSMy5wdXJlRnVuY3Rpb24wLCBSMy5wdXJlRnVuY3Rpb24xLCBSMy5wdXJlRnVuY3Rpb24yLCBSMy5wdXJlRnVuY3Rpb24zLCBSMy5wdXJlRnVuY3Rpb240LFxuICBSMy5wdXJlRnVuY3Rpb241LCBSMy5wdXJlRnVuY3Rpb242LCBSMy5wdXJlRnVuY3Rpb243LCBSMy5wdXJlRnVuY3Rpb244XG5dO1xuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwciB8IG8uTGl0ZXJhbE1hcEV4cHIpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB7bGl0ZXJhbEZhY3RvcnksIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzfSA9IGNvbnN0YW50UG9vbC5nZXRMaXRlcmFsRmFjdG9yeShsaXRlcmFsKTtcbiAgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoID4gMCB8fCBlcnJvcihgRXhwZWN0ZWQgYXJndW1lbnRzIHRvIGEgbGl0ZXJhbCBmYWN0b3J5IGZ1bmN0aW9uYCk7XG4gIGxldCBwdXJlRnVuY3Rpb25JZGVudCA9XG4gICAgICBwdXJlRnVuY3Rpb25JZGVudGlmaWVyc1tsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGhdIHx8IFIzLnB1cmVGdW5jdGlvblY7XG5cbiAgLy8gTGl0ZXJhbCBmYWN0b3JpZXMgYXJlIHB1cmUgZnVuY3Rpb25zIHRoYXQgb25seSBuZWVkIHRvIGJlIHJlLWludm9rZWQgd2hlbiB0aGUgcGFyYW1ldGVyc1xuICAvLyBjaGFuZ2UuXG4gIHJldHVybiBvLmltcG9ydEV4cHIocHVyZUZ1bmN0aW9uSWRlbnQpLmNhbGxGbihbbGl0ZXJhbEZhY3RvcnksIC4uLmxpdGVyYWxGYWN0b3J5QXJndW1lbnRzXSk7XG59XG5cbi8qKlxuICogRnVuY3Rpb24gd2hpY2ggaXMgZXhlY3V0ZWQgd2hlbmV2ZXIgYSB2YXJpYWJsZSBpcyByZWZlcmVuY2VkIGZvciB0aGUgZmlyc3QgdGltZSBpbiBhIGdpdmVuXG4gKiBzY29wZS5cbiAqXG4gKiBJdCBpcyBleHBlY3RlZCB0aGF0IHRoZSBmdW5jdGlvbiBjcmVhdGVzIHRoZSBgY29uc3QgbG9jYWxOYW1lID0gZXhwcmVzc2lvbmA7IHN0YXRlbWVudC5cbiAqL1xuZXhwb3J0IHR5cGUgRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSAobGhzVmFyOiBvLlJlYWRWYXJFeHByLCByaHNFeHByZXNzaW9uOiBvLkV4cHJlc3Npb24pID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nU2NvcGUgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgLyoqXG4gICAqIEtlZXBzIGEgbWFwIGZyb20gbG9jYWwgdmFyaWFibGVzIHRvIHRoZWlyIGV4cHJlc3Npb25zLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0gYS5iLmNgLlxuICAgKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gICAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gICAqIC0gdmFsdWUgYHJoc2AgaXMgdGhlIHJpZ2h0IGhhbmQgc2lkZSB3aGljaCBpcyBhbiBBU1QgcmVwcmVzZW50aW5nIGBhLmIuY2AuXG4gICAqIC0gdmFsdWUgYGRlY2xhcmVkYCBpcyB0cnVlIGlmIHRoZSBgZGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2tgIGhhcyBiZWVuIGNhbGxlZCBmb3IgdGhpcyBzY29wZVxuICAgKiBhbHJlYWR5LlxuICAgKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwIDwgc3RyaW5nLCB7XG4gICAgbGhzOiBvLlJlYWRWYXJFeHByO1xuICAgIHJoczogby5FeHByZXNzaW9ufHVuZGVmaW5lZDtcbiAgICBkZWNsYXJlZDogYm9vbGVhbjtcbiAgfVxuICA+ICgpO1xuICBwcml2YXRlIHJlZmVyZW5jZU5hbWVJbmRleCA9IDA7XG5cbiAgc3RhdGljIFJPT1RfU0NPUEUgPSBuZXcgQmluZGluZ1Njb3BlKCkuc2V0KCckZXZlbnQnLCBvLnZhcmlhYmxlKCckZXZlbnQnKSk7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwsXG4gICAgICBwcml2YXRlIGRlY2xhcmVMb2NhbFZhckNhbGxiYWNrOiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IG5vb3ApIHt9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVkYCBzdGF0ZS5cbiAgICAgICAgICB2YWx1ZSA9IHtsaHM6IHZhbHVlLmxocywgcmhzOiB2YWx1ZS5yaHMsIGRlY2xhcmVkOiBmYWxzZX07XG4gICAgICAgICAgLy8gQ2FjaGUgdGhlIHZhbHVlIGxvY2FsbHkuXG4gICAgICAgICAgdGhpcy5tYXAuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodmFsdWUucmhzICYmICF2YWx1ZS5kZWNsYXJlZCkge1xuICAgICAgICAgIC8vIGlmIGl0IGlzIGZpcnN0IHRpbWUgd2UgYXJlIHJlZmVyZW5jaW5nIHRoZSB2YXJpYWJsZSBpbiB0aGUgc2NvcGVcbiAgICAgICAgICAvLyB0aGFuIGludm9rZSB0aGUgY2FsbGJhY2sgdG8gaW5zZXJ0IHZhcmlhYmxlIGRlY2xhcmF0aW9uLlxuICAgICAgICAgIHRoaXMuZGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sodmFsdWUubGhzLCB2YWx1ZS5yaHMpO1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHJocyBBU1QgcmVwcmVzZW50aW5nIHRoZSByaWdodCBoYW5kIHNpZGUgb2YgdGhlIGBsZXQgbGhzID0gcmhzO2AuIFRoZSBgcmhzYCBjYW4gYmVcbiAgICogYHVuZGVmaW5lZGAgZm9yIHZhcmlhYmxlIHRoYXQgYXJlIGFtYmllbnQgc3VjaCBhcyBgJGV2ZW50YCBhbmQgd2hpY2ggZG9uJ3QgaGF2ZSBgcmhzYFxuICAgKiBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHNldChuYW1lOiBzdHJpbmcsIGxoczogby5SZWFkVmFyRXhwciwgcmhzPzogby5FeHByZXNzaW9uKTogQmluZGluZ1Njb3BlIHtcbiAgICAhdGhpcy5tYXAuaGFzKG5hbWUpIHx8XG4gICAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB0aGlzLm1hcC5zZXQobmFtZSwge2xoczogbGhzLCByaHM6IHJocywgZGVjbGFyZWQ6IGZhbHNlfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiAoby5FeHByZXNzaW9ufG51bGwpIHsgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpOyB9XG5cbiAgbmVzdGVkU2NvcGUoZGVjbGFyZUNhbGxiYWNrOiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayk6IEJpbmRpbmdTY29wZSB7XG4gICAgcmV0dXJuIG5ldyBCaW5kaW5nU2NvcGUodGhpcywgZGVjbGFyZUNhbGxiYWNrKTtcbiAgfVxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBnaXZlbiBhIHRhZyBuYW1lIGFuZCBhIG1hcCBvZiBhdHRyaWJ1dGVzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNzc1NlbGVjdG9yKHRhZzogc3RyaW5nLCBhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudCh0YWcpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNbbmFtZV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG4gICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjc3NTZWxlY3Rvcjtcbn1cblxuLy8gUGFyc2UgaTE4biBtZXRhcyBsaWtlOlxuLy8gLSBcIkBAaWRcIixcbi8vIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuLy8gLSBcIm1lYW5pbmd8ZGVzY3JpcHRpb25bQEBpZF1cIlxuZnVuY3Rpb24gcGFyc2VJMThuTWV0YShpMThuPzogc3RyaW5nKToge2Rlc2NyaXB0aW9uPzogc3RyaW5nLCBpZD86IHN0cmluZywgbWVhbmluZz86IHN0cmluZ30ge1xuICBsZXQgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgaWQ6IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgaWYgKGkxOG4pIHtcbiAgICAvLyBUT0RPKHZpY2IpOiBmaWd1cmUgb3V0IGhvdyB0byBmb3JjZSBhIG1lc3NhZ2UgSUQgd2l0aCBjbG9zdXJlID9cbiAgICBjb25zdCBpZEluZGV4ID0gaTE4bi5pbmRleE9mKElEX1NFUEFSQVRPUik7XG5cbiAgICBjb25zdCBkZXNjSW5kZXggPSBpMThuLmluZGV4T2YoTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgaWRdID1cbiAgICAgICAgKGlkSW5kZXggPiAtMSkgPyBbaTE4bi5zbGljZSgwLCBpZEluZGV4KSwgaTE4bi5zbGljZShpZEluZGV4ICsgMildIDogW2kxOG4sICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID0gKGRlc2NJbmRleCA+IC0xKSA/XG4gICAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgICBbJycsIG1lYW5pbmdBbmREZXNjXTtcbiAgfVxuXG4gIHJldHVybiB7ZGVzY3JpcHRpb24sIGlkLCBtZWFuaW5nfTtcbn1cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUoYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICBhcmdzID0gYXJncy5zbGljZSgxKTsgIC8vIElnbm9yZSB0aGUgbGVuZ3RoIHByZWZpeCBhZGRlZCBmb3IgcmVuZGVyMlxuICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjIpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24zKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNCkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb241KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjYpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb244KS5jYWxsRm4oYXJncyk7XG4gIH1cbiAgKGFyZ3MubGVuZ3RoID49IDE5ICYmIGFyZ3MubGVuZ3RoICUgMiA9PSAxKSB8fFxuICAgICAgZXJyb3IoYEludmFsaWQgaW50ZXJwb2xhdGlvbiBhcmd1bWVudCBsZW5ndGggJHthcmdzLmxlbmd0aH1gKTtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uVikuY2FsbEZuKFtvLmxpdGVyYWxBcnIoYXJncyldKTtcbn1cbiJdfQ==