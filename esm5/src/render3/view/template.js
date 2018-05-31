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
import * as o from '../../output/output_ast';
import { DomElementSchemaRegistry } from '../../schema/dom_element_schema_registry';
import { CssSelector } from '../../selector';
import { BindingParser } from '../../template_parser/binding_parser';
import { error } from '../../util';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { htmlAstToRender3Ast } from '../r3_template_transform';
import { CONTEXT_NAME, I18N_ATTR, I18N_ATTR_PREFIX, ID_SEPARATOR, IMPLICIT_REFERENCE, MEANING_SEPARATOR, REFERENCE_PREFIX, RENDER_FLAGS, TEMPORARY_NAME, asLiteral, getQueryPredicate, invalid, mapToExpression, noop, temporaryAllocator, trimTrailingNulls, unsupported } from './util';
var BINDING_INSTRUCTION_MAP = (_a = {},
    _a[0 /* Property */] = R3.elementProperty,
    _a[1 /* Attribute */] = R3.elementAttribute,
    _a[2 /* Class */] = R3.elementClassNamed,
    _a[3 /* Style */] = R3.elementStyleNamed,
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
        this._temporary = temporaryAllocator(this._prefixCode, TEMPORARY_NAME);
        this._projectionDefinitionIndex = -1;
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
        this._bindingScope =
            parentBindingScope.nestedScope(function (lhsVar, expression) {
                _this._bindingCode.push(lhsVar.set(expression).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            });
        this._valueConverter = new ValueConverter(constantPool, function () { return _this.allocateDataSlot(); }, function (numSlots) { return _this._pureFunctionSlots += numSlots; }, function (name, localName, slot, value) {
            var pipeType = pipeTypeByName.get(name);
            if (pipeType) {
                _this.pipes.add(pipeType);
            }
            _this._bindingScope.set(localName, value);
            _this._creationCode.push(o.importExpr(R3.pipe).callFn([o.literal(slot), o.literal(name)]).toStmt());
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
                var expression = o.variable(this.contextParameter).prop(variable.value || IMPLICIT_REFERENCE);
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
                var parsed = this.constantPool.getConstLiteral(asLiteral(r3Selectors), true);
                var unParsed = this.constantPool.getConstLiteral(asLiteral(ngContentSelectors), true);
                parameters.push(parsed, unParsed);
            }
            this.instruction.apply(this, tslib_1.__spread([this._creationCode, null, R3.projectionDef], parameters));
        }
        try {
            // Define and update any view queries
            for (var _b = tslib_1.__values(this.viewQueries), _c = _b.next(); !_c.done; _c = _b.next()) {
                var query = _c.value;
                // e.g. r3.Q(0, somePredicate, true);
                var querySlot = this.allocateDataSlot();
                var predicate = getQueryPredicate(query, this.constantPool);
                var args = [
                    o.literal(querySlot, o.INFERRED_TYPE),
                    predicate,
                    o.literal(query.descendants, o.INFERRED_TYPE),
                ];
                if (query.read) {
                    args.push(query.read);
                }
                this.instruction.apply(this, tslib_1.__spread([this._creationCode, null, R3.query], args));
                // (r3.qR(tmp = r3.ɵld(0)) && (ctx.someDir = tmp));
                var temporary = this._temporary();
                var getQueryList = o.importExpr(R3.load).callFn([o.literal(querySlot)]);
                var refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
                var updateDirective = o.variable(CONTEXT_NAME)
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
        if (this._pureFunctionSlots > 0) {
            this.instruction(this._creationCode, null, R3.reserveSlots, o.literal(this._pureFunctionSlots));
        }
        var creationCode = this._creationCode.length > 0 ?
            [o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(1 /* Create */), null, false), this._creationCode)] :
            [];
        var updateCode = this._bindingCode.length > 0 ?
            [o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(2 /* Update */), null, false), this._bindingCode)] :
            [];
        try {
            // Generate maps of placeholder name to node indexes
            // TODO(vicb): This is a WIP, not fully supported yet
            for (var _e = tslib_1.__values(this._phToNodeIdxes), _f = _e.next(); !_f.done; _f = _e.next()) {
                var phToNodeIdx = _f.value;
                if (Object.keys(phToNodeIdx).length > 0) {
                    var scopedName = this._bindingScope.freshReferenceName();
                    var phMap = o.variable(scopedName)
                        .set(mapToExpression(phToNodeIdx, true))
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
        return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(this.contextParameter, null)], tslib_1.__spread(this._prefixCode, creationCode, this._variableCode, updateCode, this._postfixCode), o.INFERRED_TYPE, null, this.templateName);
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
            parameters.push(o.literal(selectorIndex), asLiteral(attributeAsList));
        }
        else if (selectorIndex !== 0) {
            parameters.push(o.literal(selectorIndex));
        }
        this.instruction.apply(this, tslib_1.__spread([this._creationCode, ngContent.sourceSpan, R3.projection], parameters));
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
        Object.getOwnPropertyNames(outputAttrs).forEach(function (name) {
            var value = outputAttrs[name];
            attributes.push(o.literal(name));
            if (attrI18nMetas.hasOwnProperty(name)) {
                var meta = parseI18nMeta(attrI18nMetas[name]);
                var variable = _this.constantPool.getTranslation(value, meta);
                attributes.push(variable);
            }
            else {
                attributes.push(o.literal(value));
            }
        });
        var attrArg = attributes.length > 0 ?
            this.constantPool.getConstLiteral(o.literalArr(attributes), true) :
            o.TYPED_NULL_EXPR;
        parameters.push(attrArg);
        if (element.references && element.references.length > 0) {
            var references = flatten(element.references.map(function (reference) {
                var slot = _this.allocateDataSlot();
                referenceDataSlots.set(reference.name, slot);
                // Generate the update temporary.
                var variableName = _this._bindingScope.freshReferenceName();
                _this._variableCode.push(o.variable(variableName, o.INFERRED_TYPE)
                    .set(o.importExpr(R3.load).callFn([o.literal(slot)]))
                    .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
                _this._bindingScope.set(reference.name, o.variable(variableName));
                return [reference.name, reference.value];
            }));
            parameters.push(this.constantPool.getConstLiteral(asLiteral(references), true));
        }
        else {
            parameters.push(o.TYPED_NULL_EXPR);
        }
        // Generate the instruction create element instruction
        if (i18nMessages.length > 0) {
            (_d = this._creationCode).push.apply(_d, tslib_1.__spread(i18nMessages));
        }
        this.instruction.apply(this, tslib_1.__spread([this._creationCode, element.sourceSpan, R3.createElement], trimTrailingNulls(parameters)));
        var implicit = o.variable(CONTEXT_NAME);
        // Generate Listeners (outputs)
        element.outputs.forEach(function (outputAst) {
            var elName = sanitizeIdentifier(element.name);
            var evName = sanitizeIdentifier(outputAst.name);
            var functionName = _this.templateName + "_" + elName + "_" + evName + "_listener";
            var localVars = [];
            var bindingScope = _this._bindingScope.nestedScope(function (lhsVar, rhsExpression) {
                localVars.push(lhsVar.set(rhsExpression).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            });
            var bindingExpr = convertActionBinding(bindingScope, implicit, outputAst.handler, 'b', function () { return error('Unexpected interpolation'); });
            var handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], tslib_1.__spread(localVars, bindingExpr.render3Stmts), o.INFERRED_TYPE, null, functionName);
            _this.instruction(_this._creationCode, outputAst.sourceSpan, R3.listener, o.literal(outputAst.name), handler);
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
                _this.instruction(_this._bindingCode, input.sourceSpan, instruction, o.literal(elementIndex), o.literal(input.name), convertedBinding);
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
        this.instruction(this._creationCode, element.endSourceSpan || element.sourceSpan, R3.elementEnd);
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
            elName = sanitizeIdentifier(template.children[0].name);
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
            attributeNames.push(asLiteral(a.name), asLiteral(''));
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
        this.instruction.apply(this, tslib_1.__spread([this._creationCode, template.sourceSpan, R3.containerCreate], trimTrailingNulls(parameters)));
        // e.g. p(1, 'forOf', ɵb(ctx.items));
        var context = o.variable(CONTEXT_NAME);
        template.inputs.forEach(function (input) {
            var convertedBinding = _this.convertPropertyBinding(context, input.value);
            _this.instruction(_this._bindingCode, template.sourceSpan, R3.elementProperty, o.literal(templateIndex), o.literal(input.name), convertedBinding);
        });
        // Create the template function
        var templateVisitor = new TemplateDefinitionBuilder(this.constantPool, templateContext, this._bindingScope, this.level + 1, contextName, templateName, [], this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes);
        var templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables);
        this._postfixCode.push(templateFunctionExpr.toDeclStmt(templateName, null));
    };
    TemplateDefinitionBuilder.prototype.visitBoundText = function (text) {
        var nodeIndex = this.allocateDataSlot();
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(nodeIndex));
        this.instruction(this._bindingCode, text.sourceSpan, R3.textBinding, o.literal(nodeIndex), this.convertPropertyBinding(o.variable(CONTEXT_NAME), text.value));
    };
    TemplateDefinitionBuilder.prototype.visitText = function (text) {
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(this.allocateDataSlot()), o.literal(text.value));
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
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(this.allocateDataSlot()), variable);
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
        if (pipesConvertedValue instanceof Interpolation) {
            var convertedPropertyBinding = convertPropertyBinding(this, implicit, pipesConvertedValue, this.bindingContext(), BindingForm.TrySimple, interpolate);
            (_a = this._bindingCode).push.apply(_a, tslib_1.__spread(convertedPropertyBinding.stmts));
            return convertedPropertyBinding.currValExpr;
        }
        else {
            var convertedPropertyBinding = convertPropertyBinding(this, implicit, pipesConvertedValue, this.bindingContext(), BindingForm.TrySimple, function () { return error('Unexpected interpolation'); });
            (_b = this._bindingCode).push.apply(_b, tslib_1.__spread(convertedPropertyBinding.stmts));
            return o.importExpr(R3.bind).callFn([convertedPropertyBinding.currValExpr]);
        }
        var _a, _b;
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
var BindingScope = /** @class */ (function () {
    function BindingScope(parent, declareLocalVarCallback) {
        if (parent === void 0) { parent = null; }
        if (declareLocalVarCallback === void 0) { declareLocalVarCallback = noop; }
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
            error("The name " + name + " is already defined in scope to be " + this.map.get(name));
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
        var ref = "" + REFERENCE_PREFIX + current.referenceNameIndex++;
        return ref;
    };
    BindingScope.ROOT_SCOPE = new BindingScope().set('$event', o.variable('$event'));
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
    var _a, _b;
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
    if (!options.preserveWhitespace) {
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
    return new BindingParser(new Parser(new Lexer()), DEFAULT_INTERPOLATION_CONFIG, new DomElementSchemaRegistry(), [], []);
}
var _a;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFbkUsT0FBTyxFQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBaUIsb0JBQW9CLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUV2SixPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQTRCLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFjLGdCQUFnQixFQUFFLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ2xOLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDdEQsT0FBTyxLQUFLLElBQUksTUFBTSxxQkFBcUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDbEYsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUU3QyxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUNsRixPQUFPLEVBQUMsV0FBVyxFQUFrQixNQUFNLGdCQUFnQixDQUFDO0FBQzVELE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRSxPQUFP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Qy9CLFNBQVMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksaUJBQWlCLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztLQUMvRDtJQUVLLElBQUEsa0RBQzJDLEVBRDFDLGdCQUFLLEVBQUUsOEJBQVksRUFBRSwwQ0FBa0IsRUFBRSxrQkFBTSxDQUNKO0lBQ2xELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQy9CLE9BQU8sRUFBQyxNQUFNLFFBQUEsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxFQUFDLENBQUM7S0FDekU7SUFFRCxPQUFPLEVBQUMsS0FBSyxPQUFBLEVBQUUsWUFBWSxjQUFBLEVBQUUsa0JBQWtCLG9CQUFBLEVBQUMsQ0FBQztBQUNuRCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNO0lBQ0osT0FBTyxJQUFJLGFBQWEsQ0FDcEIsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxFQUFFLDRCQUE0QixFQUFFLElBQUksd0JBQXdCLEVBQUUsRUFBRSxFQUFFLEVBQ3pGLEVBQUUsQ0FBQyxDQUFDO0FBQ1YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmbGF0dGVuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi8uLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBCdWlsdGluRnVuY3Rpb25DYWxsLCBMb2NhbFJlc29sdmVyLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsUHJpbWl0aXZlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge1doaXRlc3BhY2VWaXNpdG9yfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0LCBlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5cbmltcG9ydCB7UjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgSTE4Tl9BVFRSLCBJMThOX0FUVFJfUFJFRklYLCBJRF9TRVBBUkFUT1IsIElNUExJQ0lUX1JFRkVSRU5DRSwgTUVBTklOR19TRVBBUkFUT1IsIFJFRkVSRU5DRV9QUkVGSVgsIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIGFzTGl0ZXJhbCwgZ2V0UXVlcnlQcmVkaWNhdGUsIGludmFsaWQsIG1hcFRvRXhwcmVzc2lvbiwgbm9vcCwgdGVtcG9yYXJ5QWxsb2NhdG9yLCB0cmltVHJhaWxpbmdOdWxscywgdW5zdXBwb3J0ZWR9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IEJJTkRJTkdfSU5TVFJVQ1RJT05fTUFQOiB7W3R5cGU6IG51bWJlcl06IG8uRXh0ZXJuYWxSZWZlcmVuY2V9ID0ge1xuICBbQmluZGluZ1R5cGUuUHJvcGVydHldOiBSMy5lbGVtZW50UHJvcGVydHksXG4gIFtCaW5kaW5nVHlwZS5BdHRyaWJ1dGVdOiBSMy5lbGVtZW50QXR0cmlidXRlLFxuICBbQmluZGluZ1R5cGUuQ2xhc3NdOiBSMy5lbGVtZW50Q2xhc3NOYW1lZCxcbiAgW0JpbmRpbmdUeXBlLlN0eWxlXTogUjMuZWxlbWVudFN0eWxlTmFtZWQsXG59O1xuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfdmFyaWFibGVDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIHByaXZhdGUgX2JpbmRpbmdDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIHByaXZhdGUgX3Bvc3RmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIHByaXZhdGUgX3RlbXBvcmFyeSA9IHRlbXBvcmFyeUFsbG9jYXRvcih0aGlzLl9wcmVmaXhDb2RlLCBURU1QT1JBUllfTkFNRSk7XG4gIHByaXZhdGUgX3Byb2plY3Rpb25EZWZpbml0aW9uSW5kZXggPSAtMTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBwcml2YXRlIF91bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcblxuICAvLyBXaGV0aGVyIHdlIGFyZSBpbnNpZGUgYSB0cmFuc2xhdGFibGUgZWxlbWVudCAoYDxwIGkxOG4+Li4uIHNvbWV3aGVyZSBoZXJlIC4uLiA8L3A+KVxuICBwcml2YXRlIF9pbkkxOG5TZWN0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgX2kxOG5TZWN0aW9uSW5kZXggPSAtMTtcbiAgLy8gTWFwcyBvZiBwbGFjZWhvbGRlciB0byBub2RlIGluZGV4ZXMgZm9yIGVhY2ggb2YgdGhlIGkxOG4gc2VjdGlvblxuICBwcml2YXRlIF9waFRvTm9kZUlkeGVzOiB7W3BoTmFtZTogc3RyaW5nXTogbnVtYmVyW119W10gPSBbe31dO1xuXG4gIC8vIE51bWJlciBvZiBzbG90cyB0byByZXNlcnZlIGZvciBwdXJlRnVuY3Rpb25zXG4gIHByaXZhdGUgX3B1cmVGdW5jdGlvblNsb3RzID0gMDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgY29udGV4dFBhcmFtZXRlcjogc3RyaW5nLFxuICAgICAgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLCBwcml2YXRlIGNvbnRleHROYW1lOiBzdHJpbmd8bnVsbCxcbiAgICAgIHByaXZhdGUgdGVtcGxhdGVOYW1lOiBzdHJpbmd8bnVsbCwgcHJpdmF0ZSB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLCBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4pIHtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUgPVxuICAgICAgICBwYXJlbnRCaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUoKGxoc1Zhcjogby5SZWFkVmFyRXhwciwgZXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYmluZGluZ0NvZGUucHVzaChcbiAgICAgICAgICAgICAgbGhzVmFyLnNldChleHByZXNzaW9uKS50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSkpO1xuICAgICAgICB9KTtcbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgY29uc3RhbnRQb29sLCAoKSA9PiB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSxcbiAgICAgICAgKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIgPT4gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHMsXG4gICAgICAgIChuYW1lLCBsb2NhbE5hbWUsIHNsb3QsIHZhbHVlOiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGlwZVR5cGUgPSBwaXBlVHlwZUJ5TmFtZS5nZXQobmFtZSk7XG4gICAgICAgICAgaWYgKHBpcGVUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLnBpcGVzLmFkZChwaXBlVHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQobG9jYWxOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLnB1c2goXG4gICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5waXBlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSkudG9TdG10KCkpO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIGhhc05nQ29udGVudDogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdKTogby5GdW5jdGlvbkV4cHIge1xuICAgIC8vIENyZWF0ZSB2YXJpYWJsZSBiaW5kaW5nc1xuICAgIGZvciAoY29uc3QgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB2YXJpYWJsZS5uYW1lO1xuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9XG4gICAgICAgICAgby52YXJpYWJsZSh0aGlzLmNvbnRleHRQYXJhbWV0ZXIpLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKTtcbiAgICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICAvLyBBZGQgdGhlIHJlZmVyZW5jZSB0byB0aGUgbG9jYWwgc2NvcGUuXG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHZhcmlhYmxlTmFtZSwgby52YXJpYWJsZSh2YXJpYWJsZU5hbWUgKyBzY29wZWROYW1lKSwgZXhwcmVzc2lvbik7XG4gICAgfVxuXG4gICAgLy8gT3V0cHV0IGEgYFByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIHdoZW4gc29tZSBgPG5nLWNvbnRlbnQ+YCBhcmUgcHJlc2VudFxuICAgIGlmIChoYXNOZ0NvbnRlbnQpIHtcbiAgICAgIHRoaXMuX3Byb2plY3Rpb25EZWZpbml0aW9uSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbCh0aGlzLl9wcm9qZWN0aW9uRGVmaW5pdGlvbkluZGV4KV07XG5cbiAgICAgIC8vIE9ubHkgc2VsZWN0b3JzIHdpdGggYSBub24tZGVmYXVsdCB2YWx1ZSBhcmUgZ2VuZXJhdGVkXG4gICAgICBpZiAobmdDb250ZW50U2VsZWN0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY29uc3QgcjNTZWxlY3RvcnMgPSBuZ0NvbnRlbnRTZWxlY3RvcnMubWFwKHMgPT4gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHMpKTtcbiAgICAgICAgLy8gYHByb2plY3Rpb25EZWZgIG5lZWRzIGJvdGggdGhlIHBhcnNlZCBhbmQgcmF3IHZhbHVlIG9mIHRoZSBzZWxlY3RvcnNcbiAgICAgICAgY29uc3QgcGFyc2VkID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyM1NlbGVjdG9ycyksIHRydWUpO1xuICAgICAgICBjb25zdCB1blBhcnNlZCA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwobmdDb250ZW50U2VsZWN0b3JzKSwgdHJ1ZSk7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChwYXJzZWQsIHVuUGFyc2VkKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5pbnN0cnVjdGlvbih0aGlzLl9jcmVhdGlvbkNvZGUsIG51bGwsIFIzLnByb2plY3Rpb25EZWYsIC4uLnBhcmFtZXRlcnMpO1xuICAgIH1cblxuICAgIC8vIERlZmluZSBhbmQgdXBkYXRlIGFueSB2aWV3IHF1ZXJpZXNcbiAgICBmb3IgKGxldCBxdWVyeSBvZiB0aGlzLnZpZXdRdWVyaWVzKSB7XG4gICAgICAvLyBlLmcuIHIzLlEoMCwgc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgICBjb25zdCBxdWVyeVNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIGNvbnN0IHByZWRpY2F0ZSA9IGdldFF1ZXJ5UHJlZGljYXRlKHF1ZXJ5LCB0aGlzLmNvbnN0YW50UG9vbCk7XG4gICAgICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgICAgby5saXRlcmFsKHF1ZXJ5U2xvdCwgby5JTkZFUlJFRF9UWVBFKSxcbiAgICAgICAgcHJlZGljYXRlLFxuICAgICAgICBvLmxpdGVyYWwocXVlcnkuZGVzY2VuZGFudHMsIG8uSU5GRVJSRURfVFlQRSksXG4gICAgICBdO1xuXG4gICAgICBpZiAocXVlcnkucmVhZCkge1xuICAgICAgICBhcmdzLnB1c2gocXVlcnkucmVhZCk7XG4gICAgICB9XG4gICAgICB0aGlzLmluc3RydWN0aW9uKHRoaXMuX2NyZWF0aW9uQ29kZSwgbnVsbCwgUjMucXVlcnksIC4uLmFyZ3MpO1xuXG4gICAgICAvLyAocjMucVIodG1wID0gcjMuybVsZCgwKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgICBjb25zdCB0ZW1wb3JhcnkgPSB0aGlzLl90ZW1wb3JhcnkoKTtcbiAgICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkKS5jYWxsRm4oW28ubGl0ZXJhbChxdWVyeVNsb3QpXSk7XG4gICAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgICAgdGhpcy5fYmluZGluZ0NvZGUucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgICB9XG5cbiAgICB0LnZpc2l0QWxsKHRoaXMsIG5vZGVzKTtcblxuICAgIGlmICh0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyA+IDApIHtcbiAgICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLCBudWxsLCBSMy5yZXNlcnZlU2xvdHMsIG8ubGl0ZXJhbCh0aGlzLl9wdXJlRnVuY3Rpb25TbG90cykpO1xuICAgIH1cblxuICAgIGNvbnN0IGNyZWF0aW9uQ29kZSA9IHRoaXMuX2NyZWF0aW9uQ29kZS5sZW5ndGggPiAwID9cbiAgICAgICAgW28uaWZTdG10KFxuICAgICAgICAgICAgby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlKSwgbnVsbCwgZmFsc2UpLFxuICAgICAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlKV0gOlxuICAgICAgICBbXTtcblxuICAgIGNvbnN0IHVwZGF0ZUNvZGUgPSB0aGlzLl9iaW5kaW5nQ29kZS5sZW5ndGggPiAwID9cbiAgICAgICAgW28uaWZTdG10KFxuICAgICAgICAgICAgby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlKSwgbnVsbCwgZmFsc2UpLFxuICAgICAgICAgICAgdGhpcy5fYmluZGluZ0NvZGUpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgbWFwcyBvZiBwbGFjZWhvbGRlciBuYW1lIHRvIG5vZGUgaW5kZXhlc1xuICAgIC8vIFRPRE8odmljYik6IFRoaXMgaXMgYSBXSVAsIG5vdCBmdWxseSBzdXBwb3J0ZWQgeWV0XG4gICAgZm9yIChjb25zdCBwaFRvTm9kZUlkeCBvZiB0aGlzLl9waFRvTm9kZUlkeGVzKSB7XG4gICAgICBpZiAoT2JqZWN0LmtleXMocGhUb05vZGVJZHgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgICAgY29uc3QgcGhNYXAgPSBvLnZhcmlhYmxlKHNjb3BlZE5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQobWFwVG9FeHByZXNzaW9uKHBoVG9Ob2RlSWR4LCB0cnVlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKTtcblxuICAgICAgICB0aGlzLl9wcmVmaXhDb2RlLnB1c2gocGhNYXApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKHRoaXMuY29udGV4dFBhcmFtZXRlciwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkNvZGUsXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgbG9jYWwgcmVmcyAoaS5lLiBjb25zdCB0bXAgPSBsZCgxKSBhcyBhbnkpXG4gICAgICAgICAgLi4udGhpcy5fdmFyaWFibGVDb2RlLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUNvZGUsXG4gICAgICAgICAgLy8gTmVzdGVkIHRlbXBsYXRlcyAoaS5lLiBmdW5jdGlvbiBDb21wVGVtcGxhdGUoKSB7fSlcbiAgICAgICAgICAuLi50aGlzLl9wb3N0Zml4Q29kZVxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzZWxlY3RvckluZGV4ID0gbmdDb250ZW50LnNlbGVjdG9ySW5kZXg7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgICBvLmxpdGVyYWwodGhpcy5fcHJvamVjdGlvbkRlZmluaXRpb25JbmRleCksXG4gICAgXTtcblxuICAgIGNvbnN0IGF0dHJpYnV0ZUFzTGlzdDogc3RyaW5nW10gPSBbXTtcblxuICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZvckVhY2goKGF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHJpYnV0ZS5uYW1lO1xuICAgICAgaWYgKG5hbWUgIT09ICdzZWxlY3QnKSB7XG4gICAgICAgIGF0dHJpYnV0ZUFzTGlzdC5wdXNoKG5hbWUsIGF0dHJpYnV0ZS52YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYXR0cmlidXRlQXNMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCksIGFzTGl0ZXJhbChhdHRyaWJ1dGVBc0xpc3QpKTtcbiAgICB9IGVsc2UgaWYgKHNlbGVjdG9ySW5kZXggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCkpO1xuICAgIH1cblxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24odGhpcy5fY3JlYXRpb25Db2RlLCBuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgLi4ucGFyYW1ldGVycyk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxlbWVudEluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgcmVmZXJlbmNlRGF0YVNsb3RzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBjb25zdCB3YXNJbkkxOG5TZWN0aW9uID0gdGhpcy5faW5JMThuU2VjdGlvbjtcblxuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBjb25zdCBhdHRySTE4bk1ldGFzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBsZXQgaTE4bk1ldGE6IHN0cmluZyA9ICcnO1xuXG4gICAgLy8gRWxlbWVudHMgaW5zaWRlIGkxOG4gc2VjdGlvbnMgYXJlIHJlcGxhY2VkIHdpdGggcGxhY2Vob2xkZXJzXG4gICAgLy8gVE9ETyh2aWNiKTogbmVzdGVkIGVsZW1lbnRzIGFyZSBhIFdJUCBpbiB0aGlzIHBoYXNlXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgIGNvbnN0IHBoTmFtZSA9IGVsZW1lbnQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKCF0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0pIHtcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0ucHVzaChlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSBpMThuIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgICBjb25zdCBuYW1lID0gYXR0ci5uYW1lO1xuICAgICAgY29uc3QgdmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgICAgaWYgKG5hbWUgPT09IEkxOE5fQVRUUikge1xuICAgICAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYENvdWxkIG5vdCBtYXJrIGFuIGVsZW1lbnQgYXMgdHJhbnNsYXRhYmxlIGluc2lkZSBvZiBhIHRyYW5zbGF0YWJsZSBzZWN0aW9uYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5JMThuU2VjdGlvbiA9IHRydWU7XG4gICAgICAgIHRoaXMuX2kxOG5TZWN0aW9uSW5kZXgrKztcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XSA9IHt9O1xuICAgICAgICBpMThuTWV0YSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgYXR0ckkxOG5NZXRhc1tuYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKV0gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dEF0dHJzW25hbWVdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWF0Y2ggZGlyZWN0aXZlcyBvbiBub24gaTE4biBhdHRyaWJ1dGVzXG4gICAgaWYgKHRoaXMuZGlyZWN0aXZlTWF0Y2hlcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVDc3NTZWxlY3RvcihlbGVtZW50Lm5hbWUsIG91dHB1dEF0dHJzKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKHNlbDogQ3NzU2VsZWN0b3IsIHN0YXRpY1R5cGU6IGFueSkgPT4geyB0aGlzLmRpcmVjdGl2ZXMuYWRkKHN0YXRpY1R5cGUpOyB9KTtcbiAgICB9XG5cbiAgICAvLyBFbGVtZW50IGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLFxuICAgICAgby5saXRlcmFsKGVsZW1lbnQubmFtZSksXG4gICAgXTtcblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGkxOG5NZXNzYWdlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvdXRwdXRBdHRycykuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gb3V0cHV0QXR0cnNbbmFtZV07XG4gICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKG5hbWUpKTtcbiAgICAgIGlmIChhdHRySTE4bk1ldGFzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGNvbnN0IG1ldGEgPSBwYXJzZUkxOG5NZXRhKGF0dHJJMThuTWV0YXNbbmFtZV0pO1xuICAgICAgICBjb25zdCB2YXJpYWJsZSA9IHRoaXMuY29uc3RhbnRQb29sLmdldFRyYW5zbGF0aW9uKHZhbHVlLCBtZXRhKTtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKHZhcmlhYmxlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaChvLmxpdGVyYWwodmFsdWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IGF0dHJBcmc6IG8uRXhwcmVzc2lvbiA9IGF0dHJpYnV0ZXMubGVuZ3RoID4gMCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoYXR0cmlidXRlcyksIHRydWUpIDpcbiAgICAgICAgby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgcGFyYW1ldGVycy5wdXNoKGF0dHJBcmcpO1xuXG4gICAgaWYgKGVsZW1lbnQucmVmZXJlbmNlcyAmJiBlbGVtZW50LnJlZmVyZW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcmVmZXJlbmNlcyA9IGZsYXR0ZW4oZWxlbWVudC5yZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICAgIHJlZmVyZW5jZURhdGFTbG90cy5zZXQocmVmZXJlbmNlLm5hbWUsIHNsb3QpO1xuICAgICAgICAvLyBHZW5lcmF0ZSB0aGUgdXBkYXRlIHRlbXBvcmFyeS5cbiAgICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgICB0aGlzLl92YXJpYWJsZUNvZGUucHVzaChvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSwgby5JTkZFUlJFRF9UWVBFKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCldKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSkpO1xuICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHJlZmVyZW5jZS5uYW1lLCBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSkpO1xuICAgICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgICAgfSkpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocmVmZXJlbmNlcyksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uVFlQRURfTlVMTF9FWFBSKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgaW5zdHJ1Y3Rpb24gY3JlYXRlIGVsZW1lbnQgaW5zdHJ1Y3Rpb25cbiAgICBpZiAoaTE4bk1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZS5wdXNoKC4uLmkxOG5NZXNzYWdlcyk7XG4gICAgfVxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5jcmVhdGVFbGVtZW50LCAuLi50cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICBjb25zdCBpbXBsaWNpdCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcblxuICAgIC8vIEdlbmVyYXRlIExpc3RlbmVycyAob3V0cHV0cylcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IGVsTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihlbGVtZW50Lm5hbWUpO1xuICAgICAgY29uc3QgZXZOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKG91dHB1dEFzdC5uYW1lKTtcbiAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke2VsTmFtZX1fJHtldk5hbWV9X2xpc3RlbmVyYDtcbiAgICAgIGNvbnN0IGxvY2FsVmFyczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgY29uc3QgYmluZGluZ1Njb3BlID1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUoKGxoc1Zhcjogby5SZWFkVmFyRXhwciwgcmhzRXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgICBsb2NhbFZhcnMucHVzaChcbiAgICAgICAgICAgICAgICBsaHNWYXIuc2V0KHJoc0V4cHJlc3Npb24pLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gICAgICAgICAgfSk7XG4gICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgIGJpbmRpbmdTY29wZSwgaW1wbGljaXQsIG91dHB1dEFzdC5oYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgICBjb25zdCBoYW5kbGVyID0gby5mbihcbiAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSwgWy4uLmxvY2FsVmFycywgLi4uYmluZGluZ0V4cHIucmVuZGVyM1N0bXRzXSxcbiAgICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIGZ1bmN0aW9uTmFtZSk7XG4gICAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgb3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLCBvLmxpdGVyYWwob3V0cHV0QXN0Lm5hbWUpLFxuICAgICAgICAgIGhhbmRsZXIpO1xuICAgIH0pO1xuXG5cbiAgICAvLyBHZW5lcmF0ZSBlbGVtZW50IGlucHV0IGJpbmRpbmdzXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgdGhpcy5fdW5zdXBwb3J0ZWQoJ2FuaW1hdGlvbnMnKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvbnZlcnRlZEJpbmRpbmcgPSB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIGlucHV0LnZhbHVlKTtcbiAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gQklORElOR19JTlNUUlVDVElPTl9NQVBbaW5wdXQudHlwZV07XG4gICAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgLy8gVE9ETyhjaHVja2opOiBydW50aW1lOiBzZWN1cml0eSBjb250ZXh0P1xuICAgICAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICAgICAgdGhpcy5fYmluZGluZ0NvZGUsIGlucHV0LnNvdXJjZVNwYW4sIGluc3RydWN0aW9uLCBvLmxpdGVyYWwoZWxlbWVudEluZGV4KSxcbiAgICAgICAgICAgIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSwgY29udmVydGVkQmluZGluZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91bnN1cHBvcnRlZChgYmluZGluZyB0eXBlICR7aW5wdXQudHlwZX1gKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbiAmJiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA9PSAxICYmXG4gICAgICAgIGVsZW1lbnQuY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgIGNvbnN0IHRleHQgPSBlbGVtZW50LmNoaWxkcmVuWzBdIGFzIHQuVGV4dDtcbiAgICAgIHRoaXMudmlzaXRTaW5nbGVJMThuVGV4dENoaWxkKHRleHQsIGkxOG5NZXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKTtcbiAgICB9XG5cbiAgICAvLyBGaW5pc2ggZWxlbWVudCBjb25zdHJ1Y3Rpb24gbW9kZS5cbiAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICB0aGlzLl9jcmVhdGlvbkNvZGUsIGVsZW1lbnQuZW5kU291cmNlU3BhbiB8fCBlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRFbmQpO1xuXG4gICAgLy8gUmVzdG9yZSB0aGUgc3RhdGUgYmVmb3JlIGV4aXRpbmcgdGhpcyBub2RlXG4gICAgdGhpcy5faW5JMThuU2VjdGlvbiA9IHdhc0luSTE4blNlY3Rpb247XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiB0LlRlbXBsYXRlKSB7XG4gICAgY29uc3QgdGVtcGxhdGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgbGV0IGVsTmFtZSA9ICcnO1xuICAgIGlmICh0ZW1wbGF0ZS5jaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgdGVtcGxhdGUuY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiB0LkVsZW1lbnQpIHtcbiAgICAgIC8vIFdoZW4gdGhlIHRlbXBsYXRlIGFzIGEgc2luZ2xlIGNoaWxkLCBkZXJpdmUgdGhlIGNvbnRleHQgbmFtZSBmcm9tIHRoZSB0YWdcbiAgICAgIGVsTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcigodGVtcGxhdGUuY2hpbGRyZW5bMF0gYXMgdC5FbGVtZW50KS5uYW1lKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZXh0TmFtZSA9IGVsTmFtZSA/IGAke3RoaXMuY29udGV4dE5hbWV9XyR7ZWxOYW1lfWAgOiAnJztcblxuICAgIGNvbnN0IHRlbXBsYXRlTmFtZSA9XG4gICAgICAgIGNvbnRleHROYW1lID8gYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlXyR7dGVtcGxhdGVJbmRleH1gIDogYFRlbXBsYXRlXyR7dGVtcGxhdGVJbmRleH1gO1xuXG4gICAgY29uc3QgdGVtcGxhdGVDb250ZXh0ID0gYGN0eCR7dGhpcy5sZXZlbH1gO1xuXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksXG4gICAgICBvLnZhcmlhYmxlKHRlbXBsYXRlTmFtZSksXG4gICAgICBvLlRZUEVEX05VTExfRVhQUixcbiAgICBdO1xuXG4gICAgY29uc3QgYXR0cmlidXRlTmFtZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgYXR0cmlidXRlTWFwOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICAgIHRlbXBsYXRlLmF0dHJpYnV0ZXMuZm9yRWFjaChhID0+IHtcbiAgICAgIGF0dHJpYnV0ZU5hbWVzLnB1c2goYXNMaXRlcmFsKGEubmFtZSksIGFzTGl0ZXJhbCgnJykpO1xuICAgICAgYXR0cmlidXRlTWFwW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgIH0pO1xuXG4gICAgLy8gTWF0Y2ggZGlyZWN0aXZlcyBvbiB0ZW1wbGF0ZSBhdHRyaWJ1dGVzXG4gICAgaWYgKHRoaXMuZGlyZWN0aXZlTWF0Y2hlcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVDc3NTZWxlY3RvcignbmctdGVtcGxhdGUnLCBhdHRyaWJ1dGVNYXApO1xuICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLm1hdGNoKFxuICAgICAgICAgIHNlbGVjdG9yLCAoY3NzU2VsZWN0b3IsIHN0YXRpY1R5cGUpID0+IHsgdGhpcy5kaXJlY3RpdmVzLmFkZChzdGF0aWNUeXBlKTsgfSk7XG4gICAgfVxuXG4gICAgaWYgKGF0dHJpYnV0ZU5hbWVzLmxlbmd0aCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoYXR0cmlidXRlTmFtZXMpLCB0cnVlKSk7XG4gICAgfVxuXG4gICAgLy8gZS5nLiBDKDEsIEMxVGVtcGxhdGUpXG4gICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLCB0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy5jb250YWluZXJDcmVhdGUsXG4gICAgICAgIC4uLnRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcblxuICAgIC8vIGUuZy4gcCgxLCAnZm9yT2YnLCDJtWIoY3R4Lml0ZW1zKSk7XG4gICAgY29uc3QgY29udGV4dCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgICB0ZW1wbGF0ZS5pbnB1dHMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBjb252ZXJ0ZWRCaW5kaW5nID0gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGNvbnRleHQsIGlucHV0LnZhbHVlKTtcbiAgICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGhpcy5fYmluZGluZ0NvZGUsIHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLmVsZW1lbnRQcm9wZXJ0eSwgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgICAgIG8ubGl0ZXJhbChpbnB1dC5uYW1lKSwgY29udmVydGVkQmluZGluZyk7XG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gICAgY29uc3QgdGVtcGxhdGVWaXNpdG9yID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLCB0ZW1wbGF0ZUNvbnRleHQsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLFxuICAgICAgICB0ZW1wbGF0ZU5hbWUsIFtdLCB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIsIHRoaXMuZGlyZWN0aXZlcywgdGhpcy5waXBlVHlwZUJ5TmFtZSwgdGhpcy5waXBlcyk7XG4gICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPVxuICAgICAgICB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMpO1xuICAgIHRoaXMuX3Bvc3RmaXhDb2RlLnB1c2godGVtcGxhdGVGdW5jdGlvbkV4cHIudG9EZWNsU3RtdCh0ZW1wbGF0ZU5hbWUsIG51bGwpKTtcbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgdGhpcy5pbnN0cnVjdGlvbih0aGlzLl9jcmVhdGlvbkNvZGUsIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgby5saXRlcmFsKG5vZGVJbmRleCkpO1xuXG4gICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgdGhpcy5fYmluZGluZ0NvZGUsIHRleHQuc291cmNlU3BhbiwgUjMudGV4dEJpbmRpbmcsIG8ubGl0ZXJhbChub2RlSW5kZXgpLFxuICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoby52YXJpYWJsZShDT05URVhUX05BTUUpLCB0ZXh0LnZhbHVlKSk7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogdC5UZXh0KSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIG8ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksXG4gICAgICAgIG8ubGl0ZXJhbCh0ZXh0LnZhbHVlKSk7XG4gIH1cblxuICAvLyBXaGVuIHRoZSBjb250ZW50IG9mIHRoZSBlbGVtZW50IGlzIGEgc2luZ2xlIHRleHQgbm9kZSB0aGUgdHJhbnNsYXRpb24gY2FuIGJlIGlubGluZWQ6XG4gIC8vXG4gIC8vIGA8cCBpMThuPVwiZGVzY3xtZWFuXCI+c29tZSBjb250ZW50PC9wPmBcbiAgLy8gY29tcGlsZXMgdG9cbiAgLy8gYGBgXG4gIC8vIC8qKlxuICAvLyAqIEBkZXNjIGRlc2NcbiAgLy8gKiBAbWVhbmluZyBtZWFuXG4gIC8vICovXG4gIC8vIGNvbnN0IE1TR19YWVogPSBnb29nLmdldE1zZygnc29tZSBjb250ZW50Jyk7XG4gIC8vIGkwLsm1VCgxLCBNU0dfWFlaKTtcbiAgLy8gYGBgXG4gIHZpc2l0U2luZ2xlSTE4blRleHRDaGlsZCh0ZXh0OiB0LlRleHQsIGkxOG5NZXRhOiBzdHJpbmcpIHtcbiAgICBjb25zdCBtZXRhID0gcGFyc2VJMThuTWV0YShpMThuTWV0YSk7XG4gICAgY29uc3QgdmFyaWFibGUgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRUcmFuc2xhdGlvbih0ZXh0LnZhbHVlLCBtZXRhKTtcbiAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICB0aGlzLl9jcmVhdGlvbkNvZGUsIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSwgdmFyaWFibGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7IH1cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHsgcmV0dXJuIGAke3RoaXMuX2JpbmRpbmdDb250ZXh0Kyt9YDsgfVxuXG4gIHByaXZhdGUgaW5zdHJ1Y3Rpb24oXG4gICAgICBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgLi4ucGFyYW1zOiBvLkV4cHJlc3Npb25bXSkge1xuICAgIHN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKS50b1N0bXQoKSk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQ6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgcGlwZXNDb252ZXJ0ZWRWYWx1ZSA9IHZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICBpZiAocGlwZXNDb252ZXJ0ZWRWYWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgdGhpcywgaW1wbGljaXQsIHBpcGVzQ29udmVydGVkVmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLFxuICAgICAgICAgIGludGVycG9sYXRlKTtcbiAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLnB1c2goLi4uY29udmVydGVkUHJvcGVydHlCaW5kaW5nLnN0bXRzKTtcbiAgICAgIHJldHVybiBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgdGhpcywgaW1wbGljaXQsIHBpcGVzQ29udmVydGVkVmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgICB0aGlzLl9iaW5kaW5nQ29kZS5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmJpbmQpLmNhbGxGbihbY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByXSk7XG4gICAgfVxuICB9XG59XG5cbmNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgb25lIHNsb3QgcGVyIHBpcGUgYXJndW1lbnRcbiAgICBjb25zdCBwdXJlRnVuY3Rpb25TbG90ID0gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKDIgKyBwaXBlLmFyZ3MubGVuZ3RoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKHBpcGUuc3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuKSwgc2xvdFBzZXVkb0xvY2FsKTtcbiAgICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcGlwZUJpbmRpbmdDYWxsSW5mbyhwaXBlLmFyZ3MpO1xuICAgIHRoaXMuZGVmaW5lUGlwZShwaXBlLm5hbWUsIHNsb3RQc2V1ZG9Mb2NhbCwgc2xvdCwgby5pbXBvcnRFeHByKGlkZW50aWZpZXIpKTtcbiAgICBjb25zdCBhcmdzOiBBU1RbXSA9IFtwaXBlLmV4cCwgLi4ucGlwZS5hcmdzXTtcbiAgICBjb25zdCBjb252ZXJ0ZWRBcmdzOiBBU1RbXSA9XG4gICAgICAgIGlzVmFyTGVuZ3RoID8gdGhpcy52aXNpdEFsbChbbmV3IExpdGVyYWxBcnJheShwaXBlLnNwYW4sIGFyZ3MpXSkgOiB0aGlzLnZpc2l0QWxsKGFyZ3MpO1xuXG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbkNhbGwocGlwZS5zcGFuLCB0YXJnZXQsIFtcbiAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3Bhbiwgc2xvdCksXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHB1cmVGdW5jdGlvblNsb3QpLFxuICAgICAgLi4uY29udmVydGVkQXJncyxcbiAgICBdKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKGFycmF5LnNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID9cbiAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmdDYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5waXBlQmluZFYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcblxuZnVuY3Rpb24gcHVyZUZ1bmN0aW9uQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnB1cmVGdW5jdGlvblYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRMaXRlcmFsRmFjdG9yeShcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbGl0ZXJhbDogby5MaXRlcmFsQXJyYXlFeHByIHwgby5MaXRlcmFsTWFwRXhwcixcbiAgICBhbGxvY2F0ZVNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3Qge2xpdGVyYWxGYWN0b3J5LCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50c30gPSBjb25zdGFudFBvb2wuZ2V0TGl0ZXJhbEZhY3RvcnkobGl0ZXJhbCk7XG4gIC8vIEFsbG9jYXRlIDEgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIDEgcGVyIGFyZ3VtZW50XG4gIGNvbnN0IHN0YXJ0U2xvdCA9IGFsbG9jYXRlU2xvdHMoMSArIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCk7XG4gIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCA+IDAgfHwgZXJyb3IoYEV4cGVjdGVkIGFyZ3VtZW50cyB0byBhIGxpdGVyYWwgZmFjdG9yeSBmdW5jdGlvbmApO1xuICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcHVyZUZ1bmN0aW9uQ2FsbEluZm8obGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuXG4gIC8vIExpdGVyYWwgZmFjdG9yaWVzIGFyZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG9ubHkgbmVlZCB0byBiZSByZS1pbnZva2VkIHdoZW4gdGhlIHBhcmFtZXRlcnNcbiAgLy8gY2hhbmdlLlxuICBjb25zdCBhcmdzID0gW1xuICAgIG8ubGl0ZXJhbChzdGFydFNsb3QpLFxuICAgIGxpdGVyYWxGYWN0b3J5LFxuICBdO1xuXG4gIGlmIChpc1Zhckxlbmd0aCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWxBcnIobGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpKTtcbiAgfSBlbHNlIHtcbiAgICBhcmdzLnB1c2goLi4ubGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKS5jYWxsRm4oYXJncyk7XG59XG5cbi8qKlxuICogRnVuY3Rpb24gd2hpY2ggaXMgZXhlY3V0ZWQgd2hlbmV2ZXIgYSB2YXJpYWJsZSBpcyByZWZlcmVuY2VkIGZvciB0aGUgZmlyc3QgdGltZSBpbiBhIGdpdmVuXG4gKiBzY29wZS5cbiAqXG4gKiBJdCBpcyBleHBlY3RlZCB0aGF0IHRoZSBmdW5jdGlvbiBjcmVhdGVzIHRoZSBgY29uc3QgbG9jYWxOYW1lID0gZXhwcmVzc2lvbmA7IHN0YXRlbWVudC5cbiAqL1xuZXhwb3J0IHR5cGUgRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSAobGhzVmFyOiBvLlJlYWRWYXJFeHByLCByaHNFeHByZXNzaW9uOiBvLkV4cHJlc3Npb24pID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nU2NvcGUgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgLyoqXG4gICAqIEtlZXBzIGEgbWFwIGZyb20gbG9jYWwgdmFyaWFibGVzIHRvIHRoZWlyIGV4cHJlc3Npb25zLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0gYS5iLmNgLlxuICAgKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gICAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gICAqIC0gdmFsdWUgYHJoc2AgaXMgdGhlIHJpZ2h0IGhhbmQgc2lkZSB3aGljaCBpcyBhbiBBU1QgcmVwcmVzZW50aW5nIGBhLmIuY2AuXG4gICAqIC0gdmFsdWUgYGRlY2xhcmVkYCBpcyB0cnVlIGlmIHRoZSBgZGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2tgIGhhcyBiZWVuIGNhbGxlZCBmb3IgdGhpcyBzY29wZVxuICAgKiBhbHJlYWR5LlxuICAgKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwIDwgc3RyaW5nLCB7XG4gICAgbGhzOiBvLlJlYWRWYXJFeHByO1xuICAgIHJoczogby5FeHByZXNzaW9ufHVuZGVmaW5lZDtcbiAgICBkZWNsYXJlZDogYm9vbGVhbjtcbiAgfVxuICA+ICgpO1xuICBwcml2YXRlIHJlZmVyZW5jZU5hbWVJbmRleCA9IDA7XG5cbiAgc3RhdGljIFJPT1RfU0NPUEUgPSBuZXcgQmluZGluZ1Njb3BlKCkuc2V0KCckZXZlbnQnLCBvLnZhcmlhYmxlKCckZXZlbnQnKSk7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwsXG4gICAgICBwcml2YXRlIGRlY2xhcmVMb2NhbFZhckNhbGxiYWNrOiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IG5vb3ApIHt9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVkYCBzdGF0ZS5cbiAgICAgICAgICB2YWx1ZSA9IHtsaHM6IHZhbHVlLmxocywgcmhzOiB2YWx1ZS5yaHMsIGRlY2xhcmVkOiBmYWxzZX07XG4gICAgICAgICAgLy8gQ2FjaGUgdGhlIHZhbHVlIGxvY2FsbHkuXG4gICAgICAgICAgdGhpcy5tYXAuc2V0KG5hbWUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodmFsdWUucmhzICYmICF2YWx1ZS5kZWNsYXJlZCkge1xuICAgICAgICAgIC8vIGlmIGl0IGlzIGZpcnN0IHRpbWUgd2UgYXJlIHJlZmVyZW5jaW5nIHRoZSB2YXJpYWJsZSBpbiB0aGUgc2NvcGVcbiAgICAgICAgICAvLyB0aGFuIGludm9rZSB0aGUgY2FsbGJhY2sgdG8gaW5zZXJ0IHZhcmlhYmxlIGRlY2xhcmF0aW9uLlxuICAgICAgICAgIHRoaXMuZGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sodmFsdWUubGhzLCB2YWx1ZS5yaHMpO1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHJocyBBU1QgcmVwcmVzZW50aW5nIHRoZSByaWdodCBoYW5kIHNpZGUgb2YgdGhlIGBsZXQgbGhzID0gcmhzO2AuIFRoZSBgcmhzYCBjYW4gYmVcbiAgICogYHVuZGVmaW5lZGAgZm9yIHZhcmlhYmxlIHRoYXQgYXJlIGFtYmllbnQgc3VjaCBhcyBgJGV2ZW50YCBhbmQgd2hpY2ggZG9uJ3QgaGF2ZSBgcmhzYFxuICAgKiBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHNldChuYW1lOiBzdHJpbmcsIGxoczogby5SZWFkVmFyRXhwciwgcmhzPzogby5FeHByZXNzaW9uKTogQmluZGluZ1Njb3BlIHtcbiAgICAhdGhpcy5tYXAuaGFzKG5hbWUpIHx8XG4gICAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB0aGlzLm1hcC5zZXQobmFtZSwge2xoczogbGhzLCByaHM6IHJocywgZGVjbGFyZWQ6IGZhbHNlfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiAoby5FeHByZXNzaW9ufG51bGwpIHsgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpOyB9XG5cbiAgbmVzdGVkU2NvcGUoZGVjbGFyZUNhbGxiYWNrOiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayk6IEJpbmRpbmdTY29wZSB7XG4gICAgcmV0dXJuIG5ldyBCaW5kaW5nU2NvcGUodGhpcywgZGVjbGFyZUNhbGxiYWNrKTtcbiAgfVxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBnaXZlbiBhIHRhZyBuYW1lIGFuZCBhIG1hcCBvZiBhdHRyaWJ1dGVzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNzc1NlbGVjdG9yKHRhZzogc3RyaW5nLCBhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudCh0YWcpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNbbmFtZV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG4gICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjc3NTZWxlY3Rvcjtcbn1cblxuLy8gUGFyc2UgaTE4biBtZXRhcyBsaWtlOlxuLy8gLSBcIkBAaWRcIixcbi8vIC0gXCJkZXNjcmlwdGlvbltAQGlkXVwiLFxuLy8gLSBcIm1lYW5pbmd8ZGVzY3JpcHRpb25bQEBpZF1cIlxuZnVuY3Rpb24gcGFyc2VJMThuTWV0YShpMThuPzogc3RyaW5nKToge2Rlc2NyaXB0aW9uPzogc3RyaW5nLCBpZD86IHN0cmluZywgbWVhbmluZz86IHN0cmluZ30ge1xuICBsZXQgbWVhbmluZzogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGRlc2NyaXB0aW9uOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgaWQ6IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgaWYgKGkxOG4pIHtcbiAgICAvLyBUT0RPKHZpY2IpOiBmaWd1cmUgb3V0IGhvdyB0byBmb3JjZSBhIG1lc3NhZ2UgSUQgd2l0aCBjbG9zdXJlID9cbiAgICBjb25zdCBpZEluZGV4ID0gaTE4bi5pbmRleE9mKElEX1NFUEFSQVRPUik7XG5cbiAgICBjb25zdCBkZXNjSW5kZXggPSBpMThuLmluZGV4T2YoTUVBTklOR19TRVBBUkFUT1IpO1xuICAgIGxldCBtZWFuaW5nQW5kRGVzYzogc3RyaW5nO1xuICAgIFttZWFuaW5nQW5kRGVzYywgaWRdID1cbiAgICAgICAgKGlkSW5kZXggPiAtMSkgPyBbaTE4bi5zbGljZSgwLCBpZEluZGV4KSwgaTE4bi5zbGljZShpZEluZGV4ICsgMildIDogW2kxOG4sICcnXTtcbiAgICBbbWVhbmluZywgZGVzY3JpcHRpb25dID0gKGRlc2NJbmRleCA+IC0xKSA/XG4gICAgICAgIFttZWFuaW5nQW5kRGVzYy5zbGljZSgwLCBkZXNjSW5kZXgpLCBtZWFuaW5nQW5kRGVzYy5zbGljZShkZXNjSW5kZXggKyAxKV0gOlxuICAgICAgICBbJycsIG1lYW5pbmdBbmREZXNjXTtcbiAgfVxuXG4gIHJldHVybiB7ZGVzY3JpcHRpb24sIGlkLCBtZWFuaW5nfTtcbn1cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUoYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICBhcmdzID0gYXJncy5zbGljZSgxKTsgIC8vIElnbm9yZSB0aGUgbGVuZ3RoIHByZWZpeCBhZGRlZCBmb3IgcmVuZGVyMlxuICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjIpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24zKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNCkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb241KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjYpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb244KS5jYWxsRm4oYXJncyk7XG4gIH1cbiAgKGFyZ3MubGVuZ3RoID49IDE5ICYmIGFyZ3MubGVuZ3RoICUgMiA9PSAxKSB8fFxuICAgICAgZXJyb3IoYEludmFsaWQgaW50ZXJwb2xhdGlvbiBhcmd1bWVudCBsZW5ndGggJHthcmdzLmxlbmd0aH1gKTtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uVikuY2FsbEZuKFtvLmxpdGVyYWxBcnIoYXJncyldKTtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIGludG8gcmVuZGVyMyBgTm9kZWBzIGFuZCBhZGRpdGlvbmFsIG1ldGFkYXRhLCB3aXRoIG5vIG90aGVyIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBAcGFyYW0gdGVtcGxhdGUgdGV4dCBvZiB0aGUgdGVtcGxhdGUgdG8gcGFyc2VcbiAqIEBwYXJhbSB0ZW1wbGF0ZVVybCBVUkwgdG8gdXNlIGZvciBzb3VyY2UgbWFwcGluZyBvZiB0aGUgcGFyc2VkIHRlbXBsYXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHRlbXBsYXRlVXJsOiBzdHJpbmcsIG9wdGlvbnM6IHtwcmVzZXJ2ZVdoaXRlc3BhY2U/OiBib29sZWFufSA9IHt9KTpcbiAgICB7ZXJyb3JzPzogUGFyc2VFcnJvcltdLCBub2RlczogdC5Ob2RlW10sIGhhc05nQ29udGVudDogYm9vbGVhbiwgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXX0ge1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgY29uc3QgaHRtbFBhcnNlciA9IG5ldyBIdG1sUGFyc2VyKCk7XG4gIGNvbnN0IHBhcnNlUmVzdWx0ID0gaHRtbFBhcnNlci5wYXJzZSh0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwpO1xuXG4gIGlmIChwYXJzZVJlc3VsdC5lcnJvcnMgJiYgcGFyc2VSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9yczogcGFyc2VSZXN1bHQuZXJyb3JzLCBub2RlczogW10sIGhhc05nQ29udGVudDogZmFsc2UsIG5nQ29udGVudFNlbGVjdG9yczogW119O1xuICB9XG5cbiAgbGV0IHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBwYXJzZVJlc3VsdC5yb290Tm9kZXM7XG4gIGlmICghb3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2UpIHtcbiAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKG5ldyBXaGl0ZXNwYWNlVmlzaXRvcigpLCByb290Tm9kZXMpO1xuICB9XG5cbiAgY29uc3Qge25vZGVzLCBoYXNOZ0NvbnRlbnQsIG5nQ29udGVudFNlbGVjdG9ycywgZXJyb3JzfSA9XG4gICAgICBodG1sQXN0VG9SZW5kZXIzQXN0KHJvb3ROb2RlcywgYmluZGluZ1BhcnNlcik7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9ycywgbm9kZXM6IFtdLCBoYXNOZ0NvbnRlbnQ6IGZhbHNlLCBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdfTtcbiAgfVxuXG4gIHJldHVybiB7bm9kZXMsIGhhc05nQ29udGVudCwgbmdDb250ZW50U2VsZWN0b3JzfTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBgQmluZGluZ1BhcnNlcmAgd2l0aCBhIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VCaW5kaW5nUGFyc2VyKCk6IEJpbmRpbmdQYXJzZXIge1xuICByZXR1cm4gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICBuZXcgUGFyc2VyKG5ldyBMZXhlcigpKSwgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpLCBbXSxcbiAgICAgIFtdKTtcbn1cbiJdfQ==