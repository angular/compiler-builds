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
import { AstMemoryEfficientTransformer, FunctionCall, ImplicitReceiver, Interpolation, LiteralPrimitive, PropertyRead } from '../../expression_parser/ast';
import { Lexer } from '../../expression_parser/lexer';
import { Parser } from '../../expression_parser/parser';
import { HtmlParser } from '../../ml_parser/html_parser';
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
        this._valueConverter = new ValueConverter(constantPool, function () { return _this.allocateDataSlot(); }, function (name, localName, slot, value) {
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
        var target = new PropertyRead(pipe.span, new ImplicitReceiver(pipe.span), slotPseudoLocal);
        var bindingId = pipeBinding(pipe.args);
        this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(bindingId));
        var value = pipe.exp.visit(this);
        var args = this.visitAll(pipe.args);
        return new FunctionCall(pipe.span, target, tslib_1.__spread([new LiteralPrimitive(pipe.span, slot), value], args));
    };
    ValueConverter.prototype.visitLiteralArray = function (array, context) {
        var _this = this;
        return new BuiltinFunctionCall(array.span, this.visitAll(array.expressions), function (values) {
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
        return new BuiltinFunctionCall(map.span, this.visitAll(map.values), function (values) {
            // If the literal has calculated (non-literal) elements  transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            var literal = o.literalMap(values.map(function (value, index) { return ({ key: map.keys[index].key, value: value, quoted: map.keys[index].quoted }); }));
            return values.every(function (a) { return a.isConstant(); }) ? _this.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(_this.constantPool, literal);
        });
    };
    return ValueConverter;
}(AstMemoryEfficientTransformer));
// Pipes always have at least one parameter, the value they operate on
var pipeBindingIdentifiers = [R3.pipeBind1, R3.pipeBind2, R3.pipeBind3, R3.pipeBind4];
function pipeBinding(args) {
    return pipeBindingIdentifiers[args.length] || R3.pipeBindV;
}
var pureFunctionIdentifiers = [
    R3.pureFunction0, R3.pureFunction1, R3.pureFunction2, R3.pureFunction3, R3.pureFunction4,
    R3.pureFunction5, R3.pureFunction6, R3.pureFunction7, R3.pureFunction8
];
function getLiteralFactory(constantPool, literal) {
    var _a = constantPool.getLiteralFactory(literal), literalFactory = _a.literalFactory, literalFactoryArguments = _a.literalFactoryArguments;
    literalFactoryArguments.length > 0 || error("Expected arguments to a literal factory function");
    var pureFunctionIdent = pureFunctionIdentifiers[literalFactoryArguments.length] || R3.pureFunctionV;
    // Literal factories are pure functions that only need to be re-invoked when the parameters
    // change.
    return o.importExpr(pureFunctionIdent).callFn(tslib_1.__spread([literalFactory], literalFactoryArguments));
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
export function parseTemplate(template, templateUrl) {
    var bindingParser = makeBindingParser();
    var htmlParser = new HtmlParser();
    var parseResult = htmlParser.parse(template, templateUrl);
    if (parseResult.errors && parseResult.errors.length > 0) {
        return { errors: parseResult.errors, nodes: [], hasNgContent: false, ngContentSelectors: [] };
    }
    var _a = htmlAstToRender3Ast(parseResult.rootNodes, bindingParser), nodes = _a.nodes, hasNgContent = _a.hasNgContent, ngContentSelectors = _a.ngContentSelectors, errors = _a.errors;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFbkUsT0FBTyxFQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBaUIsb0JBQW9CLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUV2SixPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQTRCLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQTRCLGdCQUFnQixFQUFFLFlBQVksRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ2xOLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFdEQsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBQyw0QkFBNEIsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xGLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sMENBQTBDLENBQUM7QUFDbEYsT0FBTyxFQUFDLFdBQVcsRUFBa0IsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1RCxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDbkUsT0FBTyxFQUFnQixLQUFLLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDaEQsT0FBTyxLQUFLLENBQUMsTUFBTSxXQUFXLENBQUM7QUFDL0IsT0FBTyxFQUFDLFdBQVcsSUFB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LENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxDQUFDO1lBQ0osT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxDQUFDO1lBQ0osT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxDQUFDO1lBQ0osT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDdkQ7SUFDRCxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxLQUFLLENBQUMsMkNBQXlDLElBQUksQ0FBQyxNQUFRLENBQUMsQ0FBQztJQUNsRSxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RFLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sd0JBQXdCLFFBQWdCLEVBQUUsV0FBbUI7SUFFakUsSUFBTSxhQUFhLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztJQUMxQyxJQUFNLFVBQVUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQ3BDLElBQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzVELElBQUksV0FBVyxDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDdkQsT0FBTyxFQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEVBQUMsQ0FBQztLQUM3RjtJQUNLLElBQUEsOERBQ3VELEVBRHRELGdCQUFLLEVBQUUsOEJBQVksRUFBRSwwQ0FBa0IsRUFBRSxrQkFBTSxDQUNRO0lBQzlELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQy9CLE9BQU8sRUFBQyxNQUFNLFFBQUEsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxFQUFDLENBQUM7S0FDekU7SUFFRCxPQUFPLEVBQUMsS0FBSyxPQUFBLEVBQUUsWUFBWSxjQUFBLEVBQUUsa0JBQWtCLG9CQUFBLEVBQUMsQ0FBQztBQUNuRCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNO0lBQ0osT0FBTyxJQUFJLGFBQWEsQ0FDcEIsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxFQUFFLDRCQUE0QixFQUFFLElBQUksd0JBQXdCLEVBQUUsRUFBRSxFQUFFLEVBQ3pGLEVBQUUsQ0FBQyxDQUFDO0FBQ1YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmbGF0dGVuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi8uLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBCdWlsdGluRnVuY3Rpb25DYWxsLCBMb2NhbFJlc29sdmVyLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsUHJpbWl0aXZlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7RG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0LCBlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5cbmltcG9ydCB7UjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgSTE4Tl9BVFRSLCBJMThOX0FUVFJfUFJFRklYLCBJRF9TRVBBUkFUT1IsIElNUExJQ0lUX1JFRkVSRU5DRSwgTUVBTklOR19TRVBBUkFUT1IsIFJFRkVSRU5DRV9QUkVGSVgsIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIGFzTGl0ZXJhbCwgZ2V0UXVlcnlQcmVkaWNhdGUsIGludmFsaWQsIG1hcFRvRXhwcmVzc2lvbiwgbm9vcCwgdGVtcG9yYXJ5QWxsb2NhdG9yLCB0cmltVHJhaWxpbmdOdWxscywgdW5zdXBwb3J0ZWR9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IEJJTkRJTkdfSU5TVFJVQ1RJT05fTUFQOiB7W3R5cGU6IG51bWJlcl06IG8uRXh0ZXJuYWxSZWZlcmVuY2V9ID0ge1xuICBbQmluZGluZ1R5cGUuUHJvcGVydHldOiBSMy5lbGVtZW50UHJvcGVydHksXG4gIFtCaW5kaW5nVHlwZS5BdHRyaWJ1dGVdOiBSMy5lbGVtZW50QXR0cmlidXRlLFxuICBbQmluZGluZ1R5cGUuQ2xhc3NdOiBSMy5lbGVtZW50Q2xhc3NOYW1lZCxcbiAgW0JpbmRpbmdUeXBlLlN0eWxlXTogUjMuZWxlbWVudFN0eWxlTmFtZWQsXG59O1xuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciBpbXBsZW1lbnRzIHQuVmlzaXRvcjx2b2lkPiwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgX2RhdGFJbmRleCA9IDA7XG4gIHByaXZhdGUgX2JpbmRpbmdDb250ZXh0ID0gMDtcbiAgcHJpdmF0ZSBfcHJlZml4Q29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIF9jcmVhdGlvbkNvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfdmFyaWFibGVDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIHByaXZhdGUgX2JpbmRpbmdDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIHByaXZhdGUgX3Bvc3RmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIHByaXZhdGUgX3RlbXBvcmFyeSA9IHRlbXBvcmFyeUFsbG9jYXRvcih0aGlzLl9wcmVmaXhDb2RlLCBURU1QT1JBUllfTkFNRSk7XG4gIHByaXZhdGUgX3Byb2plY3Rpb25EZWZpbml0aW9uSW5kZXggPSAtMTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBwcml2YXRlIF91bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcblxuICAvLyBXaGV0aGVyIHdlIGFyZSBpbnNpZGUgYSB0cmFuc2xhdGFibGUgZWxlbWVudCAoYDxwIGkxOG4+Li4uIHNvbWV3aGVyZSBoZXJlIC4uLiA8L3A+KVxuICBwcml2YXRlIF9pbkkxOG5TZWN0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgX2kxOG5TZWN0aW9uSW5kZXggPSAtMTtcbiAgLy8gTWFwcyBvZiBwbGFjZWhvbGRlciB0byBub2RlIGluZGV4ZXMgZm9yIGVhY2ggb2YgdGhlIGkxOG4gc2VjdGlvblxuICBwcml2YXRlIF9waFRvTm9kZUlkeGVzOiB7W3BoTmFtZTogc3RyaW5nXTogbnVtYmVyW119W10gPSBbe31dO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcHJpdmF0ZSBjb250ZXh0UGFyYW1ldGVyOiBzdHJpbmcsXG4gICAgICBwYXJlbnRCaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZSwgcHJpdmF0ZSBsZXZlbCA9IDAsIHByaXZhdGUgY29udGV4dE5hbWU6IHN0cmluZ3xudWxsLFxuICAgICAgcHJpdmF0ZSB0ZW1wbGF0ZU5hbWU6IHN0cmluZ3xudWxsLCBwcml2YXRlIHZpZXdRdWVyaWVzOiBSM1F1ZXJ5TWV0YWRhdGFbXSxcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwsIHByaXZhdGUgZGlyZWN0aXZlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LCBwcml2YXRlIHBpcGVzOiBTZXQ8by5FeHByZXNzaW9uPikge1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZSA9XG4gICAgICAgIHBhcmVudEJpbmRpbmdTY29wZS5uZXN0ZWRTY29wZSgobGhzVmFyOiBvLlJlYWRWYXJFeHByLCBleHByZXNzaW9uOiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICB0aGlzLl9iaW5kaW5nQ29kZS5wdXNoKFxuICAgICAgICAgICAgICBsaHNWYXIuc2V0KGV4cHJlc3Npb24pLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gICAgICAgIH0pO1xuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobmFtZSwgbG9jYWxOYW1lLCBzbG90LCB2YWx1ZTogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBpcGVUeXBlID0gcGlwZVR5cGVCeU5hbWUuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmIChwaXBlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5waXBlcy5hZGQocGlwZVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KGxvY2FsTmFtZSwgdmFsdWUpO1xuICAgICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZS5wdXNoKFxuICAgICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMucGlwZSkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCksIG8ubGl0ZXJhbChuYW1lKV0pLnRvU3RtdCgpKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBidWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICBub2RlczogdC5Ob2RlW10sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdLCBoYXNOZ0NvbnRlbnQ6IGJvb2xlYW4gPSBmYWxzZSxcbiAgICAgIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10gPSBbXSk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICBmb3IgKGNvbnN0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdmFyaWFibGUubmFtZTtcbiAgICAgIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgICAgIG8udmFyaWFibGUodGhpcy5jb250ZXh0UGFyYW1ldGVyKS5wcm9wKHZhcmlhYmxlLnZhbHVlIHx8IElNUExJQ0lUX1JFRkVSRU5DRSk7XG4gICAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgLy8gQWRkIHRoZSByZWZlcmVuY2UgdG8gdGhlIGxvY2FsIHNjb3BlLlxuICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldCh2YXJpYWJsZU5hbWUsIG8udmFyaWFibGUodmFyaWFibGVOYW1lICsgc2NvcGVkTmFtZSksIGV4cHJlc3Npb24pO1xuICAgIH1cblxuICAgIC8vIE91dHB1dCBhIGBQcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiB3aGVuIHNvbWUgYDxuZy1jb250ZW50PmAgYXJlIHByZXNlbnRcbiAgICBpZiAoaGFzTmdDb250ZW50KSB7XG4gICAgICB0aGlzLl9wcm9qZWN0aW9uRGVmaW5pdGlvbkluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwodGhpcy5fcHJvamVjdGlvbkRlZmluaXRpb25JbmRleCldO1xuXG4gICAgICAvLyBPbmx5IHNlbGVjdG9ycyB3aXRoIGEgbm9uLWRlZmF1bHQgdmFsdWUgYXJlIGdlbmVyYXRlZFxuICAgICAgaWYgKG5nQ29udGVudFNlbGVjdG9ycy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGNvbnN0IHIzU2VsZWN0b3JzID0gbmdDb250ZW50U2VsZWN0b3JzLm1hcChzID0+IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzKSk7XG4gICAgICAgIC8vIGBwcm9qZWN0aW9uRGVmYCBuZWVkcyBib3RoIHRoZSBwYXJzZWQgYW5kIHJhdyB2YWx1ZSBvZiB0aGUgc2VsZWN0b3JzXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNTZWxlY3RvcnMpLCB0cnVlKTtcbiAgICAgICAgY29uc3QgdW5QYXJzZWQgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKG5nQ29udGVudFNlbGVjdG9ycyksIHRydWUpO1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2gocGFyc2VkLCB1blBhcnNlZCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW5zdHJ1Y3Rpb24odGhpcy5fY3JlYXRpb25Db2RlLCBudWxsLCBSMy5wcm9qZWN0aW9uRGVmLCAuLi5wYXJhbWV0ZXJzKTtcbiAgICB9XG5cbiAgICAvLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgdmlldyBxdWVyaWVzXG4gICAgZm9yIChsZXQgcXVlcnkgb2YgdGhpcy52aWV3UXVlcmllcykge1xuICAgICAgLy8gZS5nLiByMy5RKDAsIHNvbWVQcmVkaWNhdGUsIHRydWUpO1xuICAgICAgY29uc3QgcXVlcnlTbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICBjb25zdCBwcmVkaWNhdGUgPSBnZXRRdWVyeVByZWRpY2F0ZShxdWVyeSwgdGhpcy5jb25zdGFudFBvb2wpO1xuICAgICAgY29uc3QgYXJnczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICAgIG8ubGl0ZXJhbChxdWVyeVNsb3QsIG8uSU5GRVJSRURfVFlQRSksXG4gICAgICAgIHByZWRpY2F0ZSxcbiAgICAgICAgby5saXRlcmFsKHF1ZXJ5LmRlc2NlbmRhbnRzLCBvLklORkVSUkVEX1RZUEUpLFxuICAgICAgXTtcblxuICAgICAgaWYgKHF1ZXJ5LnJlYWQpIHtcbiAgICAgICAgYXJncy5wdXNoKHF1ZXJ5LnJlYWQpO1xuICAgICAgfVxuICAgICAgdGhpcy5pbnN0cnVjdGlvbih0aGlzLl9jcmVhdGlvbkNvZGUsIG51bGwsIFIzLnF1ZXJ5LCAuLi5hcmdzKTtcblxuICAgICAgLy8gKHIzLnFSKHRtcCA9IHIzLsm1bGQoMCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgICAgY29uc3QgdGVtcG9yYXJ5ID0gdGhpcy5fdGVtcG9yYXJ5KCk7XG4gICAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLmxpdGVyYWwocXVlcnlTbG90KV0pO1xuICAgICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gICAgfVxuXG4gICAgdC52aXNpdEFsbCh0aGlzLCBub2Rlcyk7XG5cbiAgICBjb25zdCBjcmVhdGlvbkNvZGUgPSB0aGlzLl9jcmVhdGlvbkNvZGUubGVuZ3RoID4gMCA/XG4gICAgICAgIFtvLmlmU3RtdChcbiAgICAgICAgICAgIG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSksIG51bGwsIGZhbHNlKSxcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSldIDpcbiAgICAgICAgW107XG5cbiAgICBjb25zdCB1cGRhdGVDb2RlID0gdGhpcy5fYmluZGluZ0NvZGUubGVuZ3RoID4gMCA/XG4gICAgICAgIFtvLmlmU3RtdChcbiAgICAgICAgICAgIG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSksIG51bGwsIGZhbHNlKSxcbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlKV0gOlxuICAgICAgICBbXTtcblxuICAgIC8vIEdlbmVyYXRlIG1hcHMgb2YgcGxhY2Vob2xkZXIgbmFtZSB0byBub2RlIGluZGV4ZXNcbiAgICAvLyBUT0RPKHZpY2IpOiBUaGlzIGlzIGEgV0lQLCBub3QgZnVsbHkgc3VwcG9ydGVkIHlldFxuICAgIGZvciAoY29uc3QgcGhUb05vZGVJZHggb2YgdGhpcy5fcGhUb05vZGVJZHhlcykge1xuICAgICAgaWYgKE9iamVjdC5rZXlzKHBoVG9Ob2RlSWR4KS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICAgIGNvbnN0IHBoTWFwID0gby52YXJpYWJsZShzY29wZWROYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KG1hcFRvRXhwcmVzc2lvbihwaFRvTm9kZUlkeCwgdHJ1ZSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSk7XG5cbiAgICAgICAgdGhpcy5fcHJlZml4Q29kZS5wdXNoKHBoTWFwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbSh0aGlzLmNvbnRleHRQYXJhbWV0ZXIsIG51bGwpXSxcbiAgICAgICAgW1xuICAgICAgICAgIC8vIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZm9yIHF1ZXJ5IHJlZnJlc2ggKGkuZS4gbGV0IF90OiBhbnk7KVxuICAgICAgICAgIC4uLnRoaXMuX3ByZWZpeENvZGUsXG4gICAgICAgICAgLy8gQ3JlYXRpbmcgbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5DcmVhdGUpIHsgLi4uIH0pXG4gICAgICAgICAgLi4uY3JlYXRpb25Db2RlLFxuICAgICAgICAgIC8vIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZm9yIGxvY2FsIHJlZnMgKGkuZS4gY29uc3QgdG1wID0gbGQoMSkgYXMgYW55KVxuICAgICAgICAgIC4uLnRoaXMuX3ZhcmlhYmxlQ29kZSxcbiAgICAgICAgICAvLyBCaW5kaW5nIGFuZCByZWZyZXNoIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuVXBkYXRlKSB7Li4ufSlcbiAgICAgICAgICAuLi51cGRhdGVDb2RlLFxuICAgICAgICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgKGkuZS4gZnVuY3Rpb24gQ29tcFRlbXBsYXRlKCkge30pXG4gICAgICAgICAgLi4udGhpcy5fcG9zdGZpeENvZGVcbiAgICAgICAgXSxcbiAgICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB0aGlzLnRlbXBsYXRlTmFtZSk7XG4gIH1cblxuICAvLyBMb2NhbFJlc29sdmVyXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHsgcmV0dXJuIHRoaXMuX2JpbmRpbmdTY29wZS5nZXQobmFtZSk7IH1cblxuICB2aXNpdENvbnRlbnQobmdDb250ZW50OiB0LkNvbnRlbnQpIHtcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qgc2VsZWN0b3JJbmRleCA9IG5nQ29udGVudC5zZWxlY3RvckluZGV4O1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHNsb3QpLFxuICAgICAgby5saXRlcmFsKHRoaXMuX3Byb2plY3Rpb25EZWZpbml0aW9uSW5kZXgpLFxuICAgIF07XG5cbiAgICBjb25zdCBhdHRyaWJ1dGVBc0xpc3Q6IHN0cmluZ1tdID0gW107XG5cbiAgICBuZ0NvbnRlbnQuYXR0cmlidXRlcy5mb3JFYWNoKChhdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyaWJ1dGUubmFtZTtcbiAgICAgIGlmIChuYW1lICE9PSAnc2VsZWN0Jykge1xuICAgICAgICBhdHRyaWJ1dGVBc0xpc3QucHVzaChuYW1lLCBhdHRyaWJ1dGUudmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGF0dHJpYnV0ZUFzTGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHNlbGVjdG9ySW5kZXgpLCBhc0xpdGVyYWwoYXR0cmlidXRlQXNMaXN0KSk7XG4gICAgfSBlbHNlIGlmIChzZWxlY3RvckluZGV4ICE9PSAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHNlbGVjdG9ySW5kZXgpKTtcbiAgICB9XG5cbiAgICB0aGlzLmluc3RydWN0aW9uKHRoaXMuX2NyZWF0aW9uQ29kZSwgbmdDb250ZW50LnNvdXJjZVNwYW4sIFIzLnByb2plY3Rpb24sIC4uLnBhcmFtZXRlcnMpO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsZW1lbnRJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHJlZmVyZW5jZURhdGFTbG90cyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgY29uc3Qgd2FzSW5JMThuU2VjdGlvbiA9IHRoaXMuX2luSTE4blNlY3Rpb247XG5cbiAgICBjb25zdCBvdXRwdXRBdHRyczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgY29uc3QgYXR0ckkxOG5NZXRhczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgbGV0IGkxOG5NZXRhOiBzdHJpbmcgPSAnJztcblxuICAgIC8vIEVsZW1lbnRzIGluc2lkZSBpMThuIHNlY3Rpb25zIGFyZSByZXBsYWNlZCB3aXRoIHBsYWNlaG9sZGVyc1xuICAgIC8vIFRPRE8odmljYik6IG5lc3RlZCBlbGVtZW50cyBhcmUgYSBXSVAgaW4gdGhpcyBwaGFzZVxuICAgIGlmICh0aGlzLl9pbkkxOG5TZWN0aW9uKSB7XG4gICAgICBjb25zdCBwaE5hbWUgPSBlbGVtZW50Lm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICghdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdKSB7XG4gICAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF1bcGhOYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdLnB1c2goZWxlbWVudEluZGV4KTtcbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgaTE4biBhdHRyaWJ1dGVzXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHIubmFtZTtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXR0ci52YWx1ZTtcbiAgICAgIGlmIChuYW1lID09PSBJMThOX0FUVFIpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBDb3VsZCBub3QgbWFyayBhbiBlbGVtZW50IGFzIHRyYW5zbGF0YWJsZSBpbnNpZGUgb2YgYSB0cmFuc2xhdGFibGUgc2VjdGlvbmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2luSTE4blNlY3Rpb24gPSB0cnVlO1xuICAgICAgICB0aGlzLl9pMThuU2VjdGlvbkluZGV4Kys7XG4gICAgICAgIHRoaXMuX3BoVG9Ob2RlSWR4ZXNbdGhpcy5faTE4blNlY3Rpb25JbmRleF0gPSB7fTtcbiAgICAgICAgaTE4bk1ldGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZS5zdGFydHNXaXRoKEkxOE5fQVRUUl9QUkVGSVgpKSB7XG4gICAgICAgIGF0dHJJMThuTWV0YXNbbmFtZS5zbGljZShJMThOX0FUVFJfUFJFRklYLmxlbmd0aCldID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRBdHRyc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gbm9uIGkxOG4gYXR0cmlidXRlc1xuICAgIGlmICh0aGlzLmRpcmVjdGl2ZU1hdGNoZXIpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IoZWxlbWVudC5uYW1lLCBvdXRwdXRBdHRycyk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIubWF0Y2goXG4gICAgICAgICAgc2VsZWN0b3IsIChzZWw6IENzc1NlbGVjdG9yLCBzdGF0aWNUeXBlOiBhbnkpID0+IHsgdGhpcy5kaXJlY3RpdmVzLmFkZChzdGF0aWNUeXBlKTsgfSk7XG4gICAgfVxuXG4gICAgLy8gRWxlbWVudCBjcmVhdGlvbiBtb2RlXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwoZWxlbWVudEluZGV4KSxcbiAgICAgIG8ubGl0ZXJhbChlbGVtZW50Lm5hbWUpLFxuICAgIF07XG5cbiAgICAvLyBBZGQgdGhlIGF0dHJpYnV0ZXNcbiAgICBjb25zdCBpMThuTWVzc2FnZXM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob3V0cHV0QXR0cnMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG91dHB1dEF0dHJzW25hbWVdO1xuICAgICAgYXR0cmlidXRlcy5wdXNoKG8ubGl0ZXJhbChuYW1lKSk7XG4gICAgICBpZiAoYXR0ckkxOG5NZXRhcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICBjb25zdCBtZXRhID0gcGFyc2VJMThuTWV0YShhdHRySTE4bk1ldGFzW25hbWVdKTtcbiAgICAgICAgY29uc3QgdmFyaWFibGUgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRUcmFuc2xhdGlvbih2YWx1ZSwgbWV0YSk7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaCh2YXJpYWJsZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKHZhbHVlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCBhdHRyQXJnOiBvLkV4cHJlc3Npb24gPSBhdHRyaWJ1dGVzLmxlbmd0aCA+IDAgP1xuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGF0dHJpYnV0ZXMpLCB0cnVlKSA6XG4gICAgICAgIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIHBhcmFtZXRlcnMucHVzaChhdHRyQXJnKTtcblxuICAgIGlmIChlbGVtZW50LnJlZmVyZW5jZXMgJiYgZWxlbWVudC5yZWZlcmVuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHJlZmVyZW5jZXMgPSBmbGF0dGVuKGVsZW1lbnQucmVmZXJlbmNlcy5tYXAocmVmZXJlbmNlID0+IHtcbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgICByZWZlcmVuY2VEYXRhU2xvdHMuc2V0KHJlZmVyZW5jZS5uYW1lLCBzbG90KTtcbiAgICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgICAgdGhpcy5fdmFyaWFibGVDb2RlLnB1c2goby52YXJpYWJsZSh2YXJpYWJsZU5hbWUsIG8uSU5GRVJSRURfVFlQRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQoby5pbXBvcnRFeHByKFIzLmxvYWQpLmNhbGxGbihbby5saXRlcmFsKHNsb3QpXSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChyZWZlcmVuY2UubmFtZSwgby52YXJpYWJsZSh2YXJpYWJsZU5hbWUpKTtcbiAgICAgICAgcmV0dXJuIFtyZWZlcmVuY2UubmFtZSwgcmVmZXJlbmNlLnZhbHVlXTtcbiAgICAgIH0pKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHJlZmVyZW5jZXMpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLlRZUEVEX05VTExfRVhQUik7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgdGhlIGluc3RydWN0aW9uIGNyZWF0ZSBlbGVtZW50IGluc3RydWN0aW9uXG4gICAgaWYgKGkxOG5NZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9jcmVhdGlvbkNvZGUucHVzaCguLi5pMThuTWVzc2FnZXMpO1xuICAgIH1cbiAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICB0aGlzLl9jcmVhdGlvbkNvZGUsIGVsZW1lbnQuc291cmNlU3BhbiwgUjMuY3JlYXRlRWxlbWVudCwgLi4udHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgY29uc3QgaW1wbGljaXQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBMaXN0ZW5lcnMgKG91dHB1dHMpXG4gICAgZWxlbWVudC5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiB7XG4gICAgICBjb25zdCBlbE5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIoZWxlbWVudC5uYW1lKTtcbiAgICAgIGNvbnN0IGV2TmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihvdXRwdXRBc3QubmFtZSk7XG4gICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSBgJHt0aGlzLnRlbXBsYXRlTmFtZX1fJHtlbE5hbWV9XyR7ZXZOYW1lfV9saXN0ZW5lcmA7XG4gICAgICBjb25zdCBsb2NhbFZhcnM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICAgIGNvbnN0IGJpbmRpbmdTY29wZSA9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKChsaHNWYXI6IG8uUmVhZFZhckV4cHIsIHJoc0V4cHJlc3Npb246IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgICAgbG9jYWxWYXJzLnB1c2goXG4gICAgICAgICAgICAgICAgbGhzVmFyLnNldChyaHNFeHByZXNzaW9uKS50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSkpO1xuICAgICAgICAgIH0pO1xuICAgICAgY29uc3QgYmluZGluZ0V4cHIgPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgICAgICBiaW5kaW5nU2NvcGUsIGltcGxpY2l0LCBvdXRwdXRBc3QuaGFuZGxlciwgJ2InLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICAgICAgY29uc3QgaGFuZGxlciA9IG8uZm4oXG4gICAgICAgICAgW25ldyBvLkZuUGFyYW0oJyRldmVudCcsIG8uRFlOQU1JQ19UWVBFKV0sIFsuLi5sb2NhbFZhcnMsIC4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10c10sXG4gICAgICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBmdW5jdGlvbk5hbWUpO1xuICAgICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgICB0aGlzLl9jcmVhdGlvbkNvZGUsIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lciwgby5saXRlcmFsKG91dHB1dEFzdC5uYW1lKSxcbiAgICAgICAgICBoYW5kbGVyKTtcbiAgICB9KTtcblxuXG4gICAgLy8gR2VuZXJhdGUgZWxlbWVudCBpbnB1dCBiaW5kaW5nc1xuICAgIGVsZW1lbnQuaW5wdXRzLmZvckVhY2goKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKSA9PiB7XG4gICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgIHRoaXMuX3Vuc3VwcG9ydGVkKCdhbmltYXRpb25zJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBjb252ZXJ0ZWRCaW5kaW5nID0gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCBpbnB1dC52YWx1ZSk7XG4gICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IEJJTkRJTkdfSU5TVFJVQ1RJT05fTUFQW2lucHV0LnR5cGVdO1xuICAgICAgaWYgKGluc3RydWN0aW9uKSB7XG4gICAgICAgIC8vIFRPRE8oY2h1Y2tqKTogcnVudGltZTogc2VjdXJpdHkgY29udGV4dD9cbiAgICAgICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLCBpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbiwgby5saXRlcmFsKGVsZW1lbnRJbmRleCksXG4gICAgICAgICAgICBvLmxpdGVyYWwoaW5wdXQubmFtZSksIGNvbnZlcnRlZEJpbmRpbmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdW5zdXBwb3J0ZWQoYGJpbmRpbmcgdHlwZSAke2lucHV0LnR5cGV9YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUcmF2ZXJzZSBlbGVtZW50IGNoaWxkIG5vZGVzXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24gJiYgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPT0gMSAmJlxuICAgICAgICBlbGVtZW50LmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICBjb25zdCB0ZXh0ID0gZWxlbWVudC5jaGlsZHJlblswXSBhcyB0LlRleHQ7XG4gICAgICB0aGlzLnZpc2l0U2luZ2xlSTE4blRleHRDaGlsZCh0ZXh0LCBpMThuTWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHQudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG4gICAgfVxuXG4gICAgLy8gRmluaXNoIGVsZW1lbnQgY29uc3RydWN0aW9uIG1vZGUuXG4gICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLCBlbGVtZW50LmVuZFNvdXJjZVNwYW4gfHwgZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5lbGVtZW50RW5kKTtcblxuICAgIC8vIFJlc3RvcmUgdGhlIHN0YXRlIGJlZm9yZSBleGl0aW5nIHRoaXMgbm9kZVxuICAgIHRoaXMuX2luSTE4blNlY3Rpb24gPSB3YXNJbkkxOG5TZWN0aW9uO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogdC5UZW1wbGF0ZSkge1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGxldCBlbE5hbWUgPSAnJztcbiAgICBpZiAodGVtcGxhdGUuY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIHRlbXBsYXRlLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5FbGVtZW50KSB7XG4gICAgICAvLyBXaGVuIHRoZSB0ZW1wbGF0ZSBhcyBhIHNpbmdsZSBjaGlsZCwgZGVyaXZlIHRoZSBjb250ZXh0IG5hbWUgZnJvbSB0aGUgdGFnXG4gICAgICBlbE5hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIoKHRlbXBsYXRlLmNoaWxkcmVuWzBdIGFzIHQuRWxlbWVudCkubmFtZSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBlbE5hbWUgPyBgJHt0aGlzLmNvbnRleHROYW1lfV8ke2VsTmFtZX1gIDogJyc7XG5cbiAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPVxuICAgICAgICBjb250ZXh0TmFtZSA/IGAke2NvbnRleHROYW1lfV9UZW1wbGF0ZV8ke3RlbXBsYXRlSW5kZXh9YCA6IGBUZW1wbGF0ZV8ke3RlbXBsYXRlSW5kZXh9YDtcblxuICAgIGNvbnN0IHRlbXBsYXRlQ29udGV4dCA9IGBjdHgke3RoaXMubGV2ZWx9YDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuICAgICAgby5UWVBFRF9OVUxMX0VYUFIsXG4gICAgXTtcblxuICAgIGNvbnN0IGF0dHJpYnV0ZU5hbWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZU1hcDoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cbiAgICB0ZW1wbGF0ZS5hdHRyaWJ1dGVzLmZvckVhY2goYSA9PiB7XG4gICAgICBhdHRyaWJ1dGVOYW1lcy5wdXNoKGFzTGl0ZXJhbChhLm5hbWUpLCBhc0xpdGVyYWwoJycpKTtcbiAgICAgIGF0dHJpYnV0ZU1hcFthLm5hbWVdID0gYS52YWx1ZTtcbiAgICB9KTtcblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gdGVtcGxhdGUgYXR0cmlidXRlc1xuICAgIGlmICh0aGlzLmRpcmVjdGl2ZU1hdGNoZXIpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IoJ25nLXRlbXBsYXRlJywgYXR0cmlidXRlTWFwKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cblxuICAgIGlmIChhdHRyaWJ1dGVOYW1lcy5sZW5ndGgpIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGF0dHJpYnV0ZU5hbWVzKSwgdHJ1ZSkpO1xuICAgIH1cblxuICAgIC8vIGUuZy4gQygxLCBDMVRlbXBsYXRlKVxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgdGVtcGxhdGUuc291cmNlU3BhbiwgUjMuY29udGFpbmVyQ3JlYXRlLFxuICAgICAgICAuLi50cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICAvLyBlLmcuIHAoMSwgJ2Zvck9mJywgybViKGN0eC5pdGVtcykpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3QgY29udmVydGVkQmluZGluZyA9IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhjb250ZXh0LCBpbnB1dC52YWx1ZSk7XG4gICAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLCB0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy5lbGVtZW50UHJvcGVydHksIG8ubGl0ZXJhbCh0ZW1wbGF0ZUluZGV4KSxcbiAgICAgICAgICBvLmxpdGVyYWwoaW5wdXQubmFtZSksIGNvbnZlcnRlZEJpbmRpbmcpO1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICAgIGNvbnN0IHRlbXBsYXRlVmlzaXRvciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbCwgdGVtcGxhdGVDb250ZXh0LCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSxcbiAgICAgICAgdGVtcGxhdGVOYW1lLCBbXSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsIHRoaXMucGlwZXMpO1xuICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID1cbiAgICAgICAgdGVtcGxhdGVWaXNpdG9yLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbih0ZW1wbGF0ZS5jaGlsZHJlbiwgdGVtcGxhdGUudmFyaWFibGVzKTtcbiAgICB0aGlzLl9wb3N0Zml4Q29kZS5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gIH1cblxuICAvLyBUaGVzZSBzaG91bGQgYmUgaGFuZGxlZCBpbiB0aGUgdGVtcGxhdGUgb3IgZWxlbWVudCBkaXJlY3RseS5cbiAgcmVhZG9ubHkgdmlzaXRSZWZlcmVuY2UgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFZhcmlhYmxlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRUZXh0QXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRFdmVudCA9IGludmFsaWQ7XG5cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogdC5Cb3VuZFRleHQpIHtcbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24odGhpcy5fY3JlYXRpb25Db2RlLCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIG8ubGl0ZXJhbChub2RlSW5kZXgpKTtcblxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHRCaW5kaW5nLCBvLmxpdGVyYWwobm9kZUluZGV4KSxcbiAgICAgICAgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSwgdGV4dC52YWx1ZSkpO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IHQuVGV4dCkge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLFxuICAgICAgICBvLmxpdGVyYWwodGV4dC52YWx1ZSkpO1xuICB9XG5cbiAgLy8gV2hlbiB0aGUgY29udGVudCBvZiB0aGUgZWxlbWVudCBpcyBhIHNpbmdsZSB0ZXh0IG5vZGUgdGhlIHRyYW5zbGF0aW9uIGNhbiBiZSBpbmxpbmVkOlxuICAvL1xuICAvLyBgPHAgaTE4bj1cImRlc2N8bWVhblwiPnNvbWUgY29udGVudDwvcD5gXG4gIC8vIGNvbXBpbGVzIHRvXG4gIC8vIGBgYFxuICAvLyAvKipcbiAgLy8gKiBAZGVzYyBkZXNjXG4gIC8vICogQG1lYW5pbmcgbWVhblxuICAvLyAqL1xuICAvLyBjb25zdCBNU0dfWFlaID0gZ29vZy5nZXRNc2coJ3NvbWUgY29udGVudCcpO1xuICAvLyBpMC7JtVQoMSwgTVNHX1hZWik7XG4gIC8vIGBgYFxuICB2aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dDogdC5UZXh0LCBpMThuTWV0YTogc3RyaW5nKSB7XG4gICAgY29uc3QgbWV0YSA9IHBhcnNlSTE4bk1ldGEoaTE4bk1ldGEpO1xuICAgIGNvbnN0IHZhcmlhYmxlID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0VHJhbnNsYXRpb24odGV4dC52YWx1ZSwgbWV0YSk7XG4gICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIG8ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIHZhcmlhYmxlKTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVEYXRhU2xvdCgpIHsgcmV0dXJuIHRoaXMuX2RhdGFJbmRleCsrOyB9XG4gIHByaXZhdGUgYmluZGluZ0NvbnRleHQoKSB7IHJldHVybiBgJHt0aGlzLl9iaW5kaW5nQ29udGV4dCsrfWA7IH1cblxuICBwcml2YXRlIGluc3RydWN0aW9uKFxuICAgICAgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIC4uLnBhcmFtczogby5FeHByZXNzaW9uW10pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2goby5pbXBvcnRFeHByKHJlZmVyZW5jZSwgbnVsbCwgc3BhbikuY2FsbEZuKHBhcmFtcywgc3BhbikudG9TdG10KCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0OiBvLkV4cHJlc3Npb24sIHZhbHVlOiBBU1QpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHBpcGVzQ29udmVydGVkVmFsdWUgPSB2YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgaWYgKHBpcGVzQ29udmVydGVkVmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICBjb25zdCBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgIHRoaXMsIGltcGxpY2l0LCBwaXBlc0NvbnZlcnRlZFZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSxcbiAgICAgICAgICBpbnRlcnBvbGF0ZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nQ29kZS5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG4gICAgICByZXR1cm4gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgIHRoaXMsIGltcGxpY2l0LCBwaXBlc0NvbnZlcnRlZFZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSxcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICAgICAgdGhpcy5fYmluZGluZ0NvZGUucHVzaCguLi5jb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuc3RtdHMpO1xuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW2NvbnZlcnRlZFByb3BlcnR5QmluZGluZy5jdXJyVmFsRXhwcl0pO1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBWYWx1ZUNvbnZlcnRlciBleHRlbmRzIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwcml2YXRlIGFsbG9jYXRlU2xvdDogKCkgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBkZWZpbmVQaXBlOlxuICAgICAgICAgIChuYW1lOiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBzbG90OiBudW1iZXIsIHZhbHVlOiBvLkV4cHJlc3Npb24pID0+IHZvaWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLy8gQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXJcbiAgdmlzaXRQaXBlKHBpcGU6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIC8vIEFsbG9jYXRlIGEgc2xvdCB0byBjcmVhdGUgdGhlIHBpcGVcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZVNsb3QoKTtcbiAgICBjb25zdCBzbG90UHNldWRvTG9jYWwgPSBgUElQRToke3Nsb3R9YDtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKHBpcGUuc3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuKSwgc2xvdFBzZXVkb0xvY2FsKTtcbiAgICBjb25zdCBiaW5kaW5nSWQgPSBwaXBlQmluZGluZyhwaXBlLmFyZ3MpO1xuICAgIHRoaXMuZGVmaW5lUGlwZShwaXBlLm5hbWUsIHNsb3RQc2V1ZG9Mb2NhbCwgc2xvdCwgby5pbXBvcnRFeHByKGJpbmRpbmdJZCkpO1xuICAgIGNvbnN0IHZhbHVlID0gcGlwZS5leHAudmlzaXQodGhpcyk7XG4gICAgY29uc3QgYXJncyA9IHRoaXMudmlzaXRBbGwocGlwZS5hcmdzKTtcblxuICAgIHJldHVybiBuZXcgRnVuY3Rpb25DYWxsKFxuICAgICAgICBwaXBlLnNwYW4sIHRhcmdldCwgW25ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3Bhbiwgc2xvdCksIHZhbHVlLCAuLi5hcmdzXSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxBcnJheShhcnJheTogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChhcnJheS5zcGFuLCB0aGlzLnZpc2l0QWxsKGFycmF5LmV4cHJlc3Npb25zKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgIHJldHVybiB2YWx1ZXMuZXZlcnkoYSA9PiBhLmlzQ29uc3RhbnQoKSkgPyB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID8gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCk7XG4gICAgfSk7XG4gIH1cbn1cblxuXG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmcoYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4dGVybmFsUmVmZXJlbmNlIHtcbiAgcmV0dXJuIHBpcGVCaW5kaW5nSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdIHx8IFIzLnBpcGVCaW5kVjtcbn1cblxuY29uc3QgcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnMgPSBbXG4gIFIzLnB1cmVGdW5jdGlvbjAsIFIzLnB1cmVGdW5jdGlvbjEsIFIzLnB1cmVGdW5jdGlvbjIsIFIzLnB1cmVGdW5jdGlvbjMsIFIzLnB1cmVGdW5jdGlvbjQsXG4gIFIzLnB1cmVGdW5jdGlvbjUsIFIzLnB1cmVGdW5jdGlvbjYsIFIzLnB1cmVGdW5jdGlvbjcsIFIzLnB1cmVGdW5jdGlvbjhcbl07XG5mdW5jdGlvbiBnZXRMaXRlcmFsRmFjdG9yeShcbiAgICBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbGl0ZXJhbDogby5MaXRlcmFsQXJyYXlFeHByIHwgby5MaXRlcmFsTWFwRXhwcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGggPiAwIHx8IGVycm9yKGBFeHBlY3RlZCBhcmd1bWVudHMgdG8gYSBsaXRlcmFsIGZhY3RvcnkgZnVuY3Rpb25gKTtcbiAgbGV0IHB1cmVGdW5jdGlvbklkZW50ID1cbiAgICAgIHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2xpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aF0gfHwgUjMucHVyZUZ1bmN0aW9uVjtcblxuICAvLyBMaXRlcmFsIGZhY3RvcmllcyBhcmUgcHVyZSBmdW5jdGlvbnMgdGhhdCBvbmx5IG5lZWQgdG8gYmUgcmUtaW52b2tlZCB3aGVuIHRoZSBwYXJhbWV0ZXJzXG4gIC8vIGNoYW5nZS5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihwdXJlRnVuY3Rpb25JZGVudCkuY2FsbEZuKFtsaXRlcmFsRmFjdG9yeSwgLi4ubGl0ZXJhbEZhY3RvcnlBcmd1bWVudHNdKTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG5leHBvcnQgdHlwZSBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IChsaHNWYXI6IG8uUmVhZFZhckV4cHIsIHJoc0V4cHJlc3Npb246IG8uRXhwcmVzc2lvbikgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIEJpbmRpbmdTY29wZSBpbXBsZW1lbnRzIExvY2FsUmVzb2x2ZXIge1xuICAvKipcbiAgICogS2VlcHMgYSBtYXAgZnJvbSBsb2NhbCB2YXJpYWJsZXMgdG8gdGhlaXIgZXhwcmVzc2lvbnMuXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZCB3aGVuIG9uZSByZWZlcnMgdG8gdmFyaWFibGUgc3VjaCBhczogJ2xldCBhYmMgPSBhLmIuY2AuXG4gICAqIC0ga2V5IHRvIHRoZSBtYXAgaXMgdGhlIHN0cmluZyBsaXRlcmFsIGBcImFiY1wiYC5cbiAgICogLSB2YWx1ZSBgbGhzYCBpcyB0aGUgbGVmdCBoYW5kIHNpZGUgd2hpY2ggaXMgYW4gQVNUIHJlcHJlc2VudGluZyBgYWJjYC5cbiAgICogLSB2YWx1ZSBgcmhzYCBpcyB0aGUgcmlnaHQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGEuYi5jYC5cbiAgICogLSB2YWx1ZSBgZGVjbGFyZWRgIGlzIHRydWUgaWYgdGhlIGBkZWNsYXJlTG9jYWxWYXJDYWxsYmFja2AgaGFzIGJlZW4gY2FsbGVkIGZvciB0aGlzIHNjb3BlXG4gICAqIGFscmVhZHkuXG4gICAqL1xuICBwcml2YXRlIG1hcCA9IG5ldyBNYXAgPCBzdHJpbmcsIHtcbiAgICBsaHM6IG8uUmVhZFZhckV4cHI7XG4gICAgcmhzOiBvLkV4cHJlc3Npb258dW5kZWZpbmVkO1xuICAgIGRlY2xhcmVkOiBib29sZWFuO1xuICB9XG4gID4gKCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcblxuICBzdGF0aWMgUk9PVF9TQ09QRSA9IG5ldyBCaW5kaW5nU2NvcGUoKS5zZXQoJyRldmVudCcsIG8udmFyaWFibGUoJyRldmVudCcpKTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBwYXJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gbnVsbCxcbiAgICAgIHByaXZhdGUgZGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2s6IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrID0gbm9vcCkge31cblxuICBnZXQobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGN1cnJlbnQubWFwLmdldChuYW1lKTtcbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSB0aGlzKSB7XG4gICAgICAgICAgLy8gbWFrZSBhIGxvY2FsIGNvcHkgYW5kIHJlc2V0IHRoZSBgZGVjbGFyZWRgIHN0YXRlLlxuICAgICAgICAgIHZhbHVlID0ge2xoczogdmFsdWUubGhzLCByaHM6IHZhbHVlLnJocywgZGVjbGFyZWQ6IGZhbHNlfTtcbiAgICAgICAgICAvLyBDYWNoZSB0aGUgdmFsdWUgbG9jYWxseS5cbiAgICAgICAgICB0aGlzLm1hcC5zZXQobmFtZSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh2YWx1ZS5yaHMgJiYgIXZhbHVlLmRlY2xhcmVkKSB7XG4gICAgICAgICAgLy8gaWYgaXQgaXMgZmlyc3QgdGltZSB3ZSBhcmUgcmVmZXJlbmNpbmcgdGhlIHZhcmlhYmxlIGluIHRoZSBzY29wZVxuICAgICAgICAgIC8vIHRoYW4gaW52b2tlIHRoZSBjYWxsYmFjayB0byBpbnNlcnQgdmFyaWFibGUgZGVjbGFyYXRpb24uXG4gICAgICAgICAgdGhpcy5kZWNsYXJlTG9jYWxWYXJDYWxsYmFjayh2YWx1ZS5saHMsIHZhbHVlLnJocyk7XG4gICAgICAgICAgdmFsdWUuZGVjbGFyZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZS5saHM7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGxvY2FsIHZhcmlhYmxlIGZvciBsYXRlciByZWZlcmVuY2UuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcmhzIEFTVCByZXByZXNlbnRpbmcgdGhlIHJpZ2h0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC4gVGhlIGByaHNgIGNhbiBiZVxuICAgKiBgdW5kZWZpbmVkYCBmb3IgdmFyaWFibGUgdGhhdCBhcmUgYW1iaWVudCBzdWNoIGFzIGAkZXZlbnRgIGFuZCB3aGljaCBkb24ndCBoYXZlIGByaHNgXG4gICAqIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgc2V0KG5hbWU6IHN0cmluZywgbGhzOiBvLlJlYWRWYXJFeHByLCByaHM/OiBvLkV4cHJlc3Npb24pOiBCaW5kaW5nU2NvcGUge1xuICAgICF0aGlzLm1hcC5oYXMobmFtZSkgfHxcbiAgICAgICAgZXJyb3IoYFRoZSBuYW1lICR7bmFtZX0gaXMgYWxyZWFkeSBkZWZpbmVkIGluIHNjb3BlIHRvIGJlICR7dGhpcy5tYXAuZ2V0KG5hbWUpfWApO1xuICAgIHRoaXMubWFwLnNldChuYW1lLCB7bGhzOiBsaHMsIHJoczogcmhzLCBkZWNsYXJlZDogZmFsc2V9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IChvLkV4cHJlc3Npb258bnVsbCkgeyByZXR1cm4gdGhpcy5nZXQobmFtZSk7IH1cblxuICBuZXN0ZWRTY29wZShkZWNsYXJlQ2FsbGJhY2s6IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrKTogQmluZGluZ1Njb3BlIHtcbiAgICByZXR1cm4gbmV3IEJpbmRpbmdTY29wZSh0aGlzLCBkZWNsYXJlQ2FsbGJhY2spO1xuICB9XG5cbiAgZnJlc2hSZWZlcmVuY2VOYW1lKCk6IHN0cmluZyB7XG4gICAgbGV0IGN1cnJlbnQ6IEJpbmRpbmdTY29wZSA9IHRoaXM7XG4gICAgLy8gRmluZCB0aGUgdG9wIHNjb3BlIGFzIGl0IG1haW50YWlucyB0aGUgZ2xvYmFsIHJlZmVyZW5jZSBjb3VudFxuICAgIHdoaWxlIChjdXJyZW50LnBhcmVudCkgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIGNvbnN0IHJlZiA9IGAke1JFRkVSRU5DRV9QUkVGSVh9JHtjdXJyZW50LnJlZmVyZW5jZU5hbWVJbmRleCsrfWA7XG4gICAgcmV0dXJuIHJlZjtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBgQ3NzU2VsZWN0b3JgIGdpdmVuIGEgdGFnIG5hbWUgYW5kIGEgbWFwIG9mIGF0dHJpYnV0ZXNcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ3NzU2VsZWN0b3IodGFnOiBzdHJpbmcsIGF0dHJpYnV0ZXM6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IENzc1NlbGVjdG9yIHtcbiAgY29uc3QgY3NzU2VsZWN0b3IgPSBuZXcgQ3NzU2VsZWN0b3IoKTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KHRhZyk7XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcblxuICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vLyBQYXJzZSBpMThuIG1ldGFzIGxpa2U6XG4vLyAtIFwiQEBpZFwiLFxuLy8gLSBcImRlc2NyaXB0aW9uW0BAaWRdXCIsXG4vLyAtIFwibWVhbmluZ3xkZXNjcmlwdGlvbltAQGlkXVwiXG5mdW5jdGlvbiBwYXJzZUkxOG5NZXRhKGkxOG4/OiBzdHJpbmcpOiB7ZGVzY3JpcHRpb24/OiBzdHJpbmcsIGlkPzogc3RyaW5nLCBtZWFuaW5nPzogc3RyaW5nfSB7XG4gIGxldCBtZWFuaW5nOiBzdHJpbmd8dW5kZWZpbmVkO1xuICBsZXQgZGVzY3JpcHRpb246IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBpZDogc3RyaW5nfHVuZGVmaW5lZDtcblxuICBpZiAoaTE4bikge1xuICAgIC8vIFRPRE8odmljYik6IGZpZ3VyZSBvdXQgaG93IHRvIGZvcmNlIGEgbWVzc2FnZSBJRCB3aXRoIGNsb3N1cmUgP1xuICAgIGNvbnN0IGlkSW5kZXggPSBpMThuLmluZGV4T2YoSURfU0VQQVJBVE9SKTtcblxuICAgIGNvbnN0IGRlc2NJbmRleCA9IGkxOG4uaW5kZXhPZihNRUFOSU5HX1NFUEFSQVRPUik7XG4gICAgbGV0IG1lYW5pbmdBbmREZXNjOiBzdHJpbmc7XG4gICAgW21lYW5pbmdBbmREZXNjLCBpZF0gPVxuICAgICAgICAoaWRJbmRleCA+IC0xKSA/IFtpMThuLnNsaWNlKDAsIGlkSW5kZXgpLCBpMThuLnNsaWNlKGlkSW5kZXggKyAyKV0gOiBbaTE4biwgJyddO1xuICAgIFttZWFuaW5nLCBkZXNjcmlwdGlvbl0gPSAoZGVzY0luZGV4ID4gLTEpID9cbiAgICAgICAgW21lYW5pbmdBbmREZXNjLnNsaWNlKDAsIGRlc2NJbmRleCksIG1lYW5pbmdBbmREZXNjLnNsaWNlKGRlc2NJbmRleCArIDEpXSA6XG4gICAgICAgIFsnJywgbWVhbmluZ0FuZERlc2NdO1xuICB9XG5cbiAgcmV0dXJuIHtkZXNjcmlwdGlvbiwgaWQsIG1lYW5pbmd9O1xufVxuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZShhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIGFyZ3MgPSBhcmdzLnNsaWNlKDEpOyAgLy8gSWdub3JlIHRoZSBsZW5ndGggcHJlZml4IGFkZGVkIGZvciByZW5kZXIyXG4gIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24xKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMikuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjMpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb240KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjUpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNikuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb243KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjgpLmNhbGxGbihhcmdzKTtcbiAgfVxuICAoYXJncy5sZW5ndGggPj0gMTkgJiYgYXJncy5sZW5ndGggJSAyID09IDEpIHx8XG4gICAgICBlcnJvcihgSW52YWxpZCBpbnRlcnBvbGF0aW9uIGFyZ3VtZW50IGxlbmd0aCAke2FyZ3MubGVuZ3RofWApO1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb25WKS5jYWxsRm4oW28ubGl0ZXJhbEFycihhcmdzKV0pO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgdGVtcGxhdGUgaW50byByZW5kZXIzIGBOb2RlYHMgYW5kIGFkZGl0aW9uYWwgbWV0YWRhdGEsIHdpdGggbm8gb3RoZXIgZGVwZW5kZW5jaWVzLlxuICpcbiAqIEBwYXJhbSB0ZW1wbGF0ZSB0ZXh0IG9mIHRoZSB0ZW1wbGF0ZSB0byBwYXJzZVxuICogQHBhcmFtIHRlbXBsYXRlVXJsIFVSTCB0byB1c2UgZm9yIHNvdXJjZSBtYXBwaW5nIG9mIHRoZSBwYXJzZWQgdGVtcGxhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUodGVtcGxhdGU6IHN0cmluZywgdGVtcGxhdGVVcmw6IHN0cmluZyk6XG4gICAge2Vycm9ycz86IFBhcnNlRXJyb3JbXSwgbm9kZXM6IHQuTm9kZVtdLCBoYXNOZ0NvbnRlbnQ6IGJvb2xlYW4sIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW119IHtcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKCk7XG4gIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuICBjb25zdCBwYXJzZVJlc3VsdCA9IGh0bWxQYXJzZXIucGFyc2UodGVtcGxhdGUsIHRlbXBsYXRlVXJsKTtcbiAgaWYgKHBhcnNlUmVzdWx0LmVycm9ycyAmJiBwYXJzZVJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7ZXJyb3JzOiBwYXJzZVJlc3VsdC5lcnJvcnMsIG5vZGVzOiBbXSwgaGFzTmdDb250ZW50OiBmYWxzZSwgbmdDb250ZW50U2VsZWN0b3JzOiBbXX07XG4gIH1cbiAgY29uc3Qge25vZGVzLCBoYXNOZ0NvbnRlbnQsIG5nQ29udGVudFNlbGVjdG9ycywgZXJyb3JzfSA9XG4gICAgICBodG1sQXN0VG9SZW5kZXIzQXN0KHBhcnNlUmVzdWx0LnJvb3ROb2RlcywgYmluZGluZ1BhcnNlcik7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9ycywgbm9kZXM6IFtdLCBoYXNOZ0NvbnRlbnQ6IGZhbHNlLCBuZ0NvbnRlbnRTZWxlY3RvcnM6IFtdfTtcbiAgfVxuXG4gIHJldHVybiB7bm9kZXMsIGhhc05nQ29udGVudCwgbmdDb250ZW50U2VsZWN0b3JzfTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYSBgQmluZGluZ1BhcnNlcmAgd2l0aCBhIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VCaW5kaW5nUGFyc2VyKCk6IEJpbmRpbmdQYXJzZXIge1xuICByZXR1cm4gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICBuZXcgUGFyc2VyKG5ldyBMZXhlcigpKSwgREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRywgbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpLCBbXSxcbiAgICAgIFtdKTtcbn1cbiJdfQ==