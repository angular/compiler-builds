/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { flatten, sanitizeIdentifier } from '../../compile_metadata';
import { BindingForm, BuiltinFunctionCall, convertActionBinding, convertPropertyBinding } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { AstMemoryEfficientTransformer, FunctionCall, ImplicitReceiver, LiteralPrimitive, PropertyRead } from '../../expression_parser/ast';
import * as o from '../../output/output_ast';
import { CssSelector } from '../../selector';
import { error } from '../../util';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { CONTEXT_NAME, I18N_ATTR, I18N_ATTR_PREFIX, ID_SEPARATOR, IMPLICIT_REFERENCE, MEANING_SEPARATOR, REFERENCE_PREFIX, RENDER_FLAGS, TEMPORARY_NAME, asLiteral, getQueryPredicate, invalid, mapToExpression, noop, temporaryAllocator, trimTrailingNulls, unsupported } from './util';
const BINDING_INSTRUCTION_MAP = {
    [0 /* Property */]: R3.elementProperty,
    [1 /* Attribute */]: R3.elementAttribute,
    [2 /* Class */]: R3.elementClassNamed,
    [3 /* Style */]: R3.elementStyleNamed,
};
export class TemplateDefinitionBuilder {
    constructor(constantPool, contextParameter, parentBindingScope, level = 0, contextName, templateName, viewQueries, directiveMatcher, directives, pipeTypeByName, pipes) {
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
            parentBindingScope.nestedScope((lhsVar, expression) => {
                this._bindingCode.push(lhsVar.set(expression).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            });
        this._valueConverter = new ValueConverter(constantPool, () => this.allocateDataSlot(), (name, localName, slot, value) => {
            const pipeType = pipeTypeByName.get(name);
            if (pipeType) {
                this.pipes.add(pipeType);
            }
            this._bindingScope.set(localName, value);
            this._creationCode.push(o.importExpr(R3.pipe).callFn([o.literal(slot), o.literal(name)]).toStmt());
        });
    }
    buildTemplateFunction(nodes, variables, hasNgContent = false, ngContentSelectors = []) {
        // Create variable bindings
        for (const variable of variables) {
            const variableName = variable.name;
            const expression = o.variable(this.contextParameter).prop(variable.value || IMPLICIT_REFERENCE);
            const scopedName = this._bindingScope.freshReferenceName();
            // Add the reference to the local scope.
            this._bindingScope.set(variableName, o.variable(variableName + scopedName), expression);
        }
        // Output a `ProjectionDef` instruction when some `<ng-content>` are present
        if (hasNgContent) {
            this._projectionDefinitionIndex = this.allocateDataSlot();
            const parameters = [o.literal(this._projectionDefinitionIndex)];
            // Only selectors with a non-default value are generated
            if (ngContentSelectors.length > 1) {
                const r3Selectors = ngContentSelectors.map(s => core.parseSelectorToR3Selector(s));
                // `projectionDef` needs both the parsed and raw value of the selectors
                const parsed = this.constantPool.getConstLiteral(asLiteral(r3Selectors), true);
                const unParsed = this.constantPool.getConstLiteral(asLiteral(ngContentSelectors), true);
                parameters.push(parsed, unParsed);
            }
            this.instruction(this._creationCode, null, R3.projectionDef, ...parameters);
        }
        // Define and update any view queries
        for (let query of this.viewQueries) {
            // e.g. r3.Q(0, somePredicate, true);
            const querySlot = this.allocateDataSlot();
            const predicate = getQueryPredicate(query, this.constantPool);
            const args = [
                o.literal(querySlot, o.INFERRED_TYPE),
                predicate,
                o.literal(query.descendants, o.INFERRED_TYPE),
            ];
            if (query.read) {
                args.push(query.read);
            }
            this.instruction(this._creationCode, null, R3.query, ...args);
            // (r3.qR(tmp = r3.ɵld(0)) && (ctx.someDir = tmp));
            const temporary = this._temporary();
            const getQueryList = o.importExpr(R3.load).callFn([o.literal(querySlot)]);
            const refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
            const updateDirective = o.variable(CONTEXT_NAME)
                .prop(query.propertyName)
                .set(query.first ? temporary.prop('first') : temporary);
            this._bindingCode.push(refresh.and(updateDirective).toStmt());
        }
        t.visitAll(this, nodes);
        const creationCode = this._creationCode.length > 0 ?
            [o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(1 /* Create */), null, false), this._creationCode)] :
            [];
        const updateCode = this._bindingCode.length > 0 ?
            [o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(2 /* Update */), null, false), this._bindingCode)] :
            [];
        // Generate maps of placeholder name to node indexes
        // TODO(vicb): This is a WIP, not fully supported yet
        for (const phToNodeIdx of this._phToNodeIdxes) {
            if (Object.keys(phToNodeIdx).length > 0) {
                const scopedName = this._bindingScope.freshReferenceName();
                const phMap = o.variable(scopedName)
                    .set(mapToExpression(phToNodeIdx, true))
                    .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]);
                this._prefixCode.push(phMap);
            }
        }
        return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(this.contextParameter, null)], [
            // Temporary variable declarations for query refresh (i.e. let _t: any;)
            ...this._prefixCode,
            // Creating mode (i.e. if (rf & RenderFlags.Create) { ... })
            ...creationCode,
            // Temporary variable declarations for local refs (i.e. const tmp = ld(1) as any)
            ...this._variableCode,
            // Binding and refresh mode (i.e. if (rf & RenderFlags.Update) {...})
            ...updateCode,
            // Nested templates (i.e. function CompTemplate() {})
            ...this._postfixCode
        ], o.INFERRED_TYPE, null, this.templateName);
    }
    // LocalResolver
    getLocal(name) { return this._bindingScope.get(name); }
    visitContent(ngContent) {
        const slot = this.allocateDataSlot();
        const selectorIndex = ngContent.selectorIndex;
        const parameters = [
            o.literal(slot),
            o.literal(this._projectionDefinitionIndex),
        ];
        const attributeAsList = [];
        ngContent.attributes.forEach((attribute) => {
            const name = attribute.name;
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
        this.instruction(this._creationCode, ngContent.sourceSpan, R3.projection, ...parameters);
    }
    visitElement(element) {
        const elementIndex = this.allocateDataSlot();
        const referenceDataSlots = new Map();
        const wasInI18nSection = this._inI18nSection;
        const outputAttrs = {};
        const attrI18nMetas = {};
        let i18nMeta = '';
        // Elements inside i18n sections are replaced with placeholders
        // TODO(vicb): nested elements are a WIP in this phase
        if (this._inI18nSection) {
            const phName = element.name.toLowerCase();
            if (!this._phToNodeIdxes[this._i18nSectionIndex][phName]) {
                this._phToNodeIdxes[this._i18nSectionIndex][phName] = [];
            }
            this._phToNodeIdxes[this._i18nSectionIndex][phName].push(elementIndex);
        }
        // Handle i18n attributes
        for (const attr of element.attributes) {
            const name = attr.name;
            const value = attr.value;
            if (name === I18N_ATTR) {
                if (this._inI18nSection) {
                    throw new Error(`Could not mark an element as translatable inside of a translatable section`);
                }
                this._inI18nSection = true;
                this._i18nSectionIndex++;
                this._phToNodeIdxes[this._i18nSectionIndex] = {};
                i18nMeta = value;
            }
            else if (name.startsWith(I18N_ATTR_PREFIX)) {
                attrI18nMetas[name.slice(I18N_ATTR_PREFIX.length)] = value;
            }
            else {
                outputAttrs[name] = value;
            }
        }
        // Match directives on non i18n attributes
        if (this.directiveMatcher) {
            const selector = createCssSelector(element.name, outputAttrs);
            this.directiveMatcher.match(selector, (sel, staticType) => { this.directives.add(staticType); });
        }
        // Element creation mode
        const parameters = [
            o.literal(elementIndex),
            o.literal(element.name),
        ];
        // Add the attributes
        const i18nMessages = [];
        const attributes = [];
        Object.getOwnPropertyNames(outputAttrs).forEach(name => {
            const value = outputAttrs[name];
            attributes.push(o.literal(name));
            if (attrI18nMetas.hasOwnProperty(name)) {
                const meta = parseI18nMeta(attrI18nMetas[name]);
                const variable = this.constantPool.getTranslation(value, meta);
                attributes.push(variable);
            }
            else {
                attributes.push(o.literal(value));
            }
        });
        const attrArg = attributes.length > 0 ?
            this.constantPool.getConstLiteral(o.literalArr(attributes), true) :
            o.TYPED_NULL_EXPR;
        parameters.push(attrArg);
        if (element.references && element.references.length > 0) {
            const references = flatten(element.references.map(reference => {
                const slot = this.allocateDataSlot();
                referenceDataSlots.set(reference.name, slot);
                // Generate the update temporary.
                const variableName = this._bindingScope.freshReferenceName();
                this._variableCode.push(o.variable(variableName, o.INFERRED_TYPE)
                    .set(o.importExpr(R3.load).callFn([o.literal(slot)]))
                    .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
                this._bindingScope.set(reference.name, o.variable(variableName));
                return [reference.name, reference.value];
            }));
            parameters.push(this.constantPool.getConstLiteral(asLiteral(references), true));
        }
        else {
            parameters.push(o.TYPED_NULL_EXPR);
        }
        // Generate the instruction create element instruction
        if (i18nMessages.length > 0) {
            this._creationCode.push(...i18nMessages);
        }
        this.instruction(this._creationCode, element.sourceSpan, R3.createElement, ...trimTrailingNulls(parameters));
        const implicit = o.variable(CONTEXT_NAME);
        // Generate Listeners (outputs)
        element.outputs.forEach((outputAst) => {
            const elName = sanitizeIdentifier(element.name);
            const evName = sanitizeIdentifier(outputAst.name);
            const functionName = `${this.templateName}_${elName}_${evName}_listener`;
            const localVars = [];
            const bindingScope = this._bindingScope.nestedScope((lhsVar, rhsExpression) => {
                localVars.push(lhsVar.set(rhsExpression).toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
            });
            const bindingExpr = convertActionBinding(bindingScope, implicit, outputAst.handler, 'b', () => error('Unexpected interpolation'));
            const handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], [...localVars, ...bindingExpr.render3Stmts], o.INFERRED_TYPE, null, functionName);
            this.instruction(this._creationCode, outputAst.sourceSpan, R3.listener, o.literal(outputAst.name), handler);
        });
        // Generate element input bindings
        element.inputs.forEach((input) => {
            if (input.type === 4 /* Animation */) {
                this._unsupported('animations');
            }
            const convertedBinding = this.convertPropertyBinding(implicit, input.value);
            const instruction = BINDING_INSTRUCTION_MAP[input.type];
            if (instruction) {
                // TODO(chuckj): runtime: security context?
                const value = o.importExpr(R3.bind).callFn([convertedBinding]);
                this.instruction(this._bindingCode, input.sourceSpan, instruction, o.literal(elementIndex), o.literal(input.name), value);
            }
            else {
                this._unsupported(`binding type ${input.type}`);
            }
        });
        // Traverse element child nodes
        if (this._inI18nSection && element.children.length == 1 &&
            element.children[0] instanceof t.Text) {
            const text = element.children[0];
            this.visitSingleI18nTextChild(text, i18nMeta);
        }
        else {
            t.visitAll(this, element.children);
        }
        // Finish element construction mode.
        this.instruction(this._creationCode, element.endSourceSpan || element.sourceSpan, R3.elementEnd);
        // Restore the state before exiting this node
        this._inI18nSection = wasInI18nSection;
    }
    visitTemplate(template) {
        const templateIndex = this.allocateDataSlot();
        let elName = '';
        if (template.children.length === 1 && template.children[0] instanceof t.Element) {
            // When the template as a single child, derive the context name from the tag
            elName = sanitizeIdentifier(template.children[0].name);
        }
        const contextName = elName ? `${this.contextName}_${elName}` : '';
        const templateName = contextName ? `${contextName}_Template_${templateIndex}` : `Template_${templateIndex}`;
        const templateContext = `ctx${this.level}`;
        const parameters = [
            o.literal(templateIndex),
            o.variable(templateName),
            o.TYPED_NULL_EXPR,
        ];
        const attributeNames = [];
        const attributeMap = {};
        template.attributes.forEach(a => {
            attributeNames.push(asLiteral(a.name), asLiteral(''));
            attributeMap[a.name] = a.value;
        });
        // Match directives on template attributes
        if (this.directiveMatcher) {
            const selector = createCssSelector('ng-template', attributeMap);
            this.directiveMatcher.match(selector, (cssSelector, staticType) => { this.directives.add(staticType); });
        }
        if (attributeNames.length) {
            parameters.push(this.constantPool.getConstLiteral(o.literalArr(attributeNames), true));
        }
        // e.g. C(1, C1Template)
        this.instruction(this._creationCode, template.sourceSpan, R3.containerCreate, ...trimTrailingNulls(parameters));
        // e.g. p(1, 'forOf', ɵb(ctx.items));
        const context = o.variable(CONTEXT_NAME);
        template.inputs.forEach(input => {
            const convertedBinding = this.convertPropertyBinding(context, input.value);
            this.instruction(this._bindingCode, template.sourceSpan, R3.elementProperty, o.literal(templateIndex), o.literal(input.name), o.importExpr(R3.bind).callFn([convertedBinding]));
        });
        // Create the template function
        const templateVisitor = new TemplateDefinitionBuilder(this.constantPool, templateContext, this._bindingScope, this.level + 1, contextName, templateName, [], this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes);
        const templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables);
        this._postfixCode.push(templateFunctionExpr.toDeclStmt(templateName, null));
    }
    visitBoundText(text) {
        const nodeIndex = this.allocateDataSlot();
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(nodeIndex));
        this.instruction(this._bindingCode, text.sourceSpan, R3.textCreateBound, o.literal(nodeIndex), this.convertPropertyBinding(o.variable(CONTEXT_NAME), text.value));
    }
    visitText(text) {
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(this.allocateDataSlot()), o.literal(text.value));
    }
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
    visitSingleI18nTextChild(text, i18nMeta) {
        const meta = parseI18nMeta(i18nMeta);
        const variable = this.constantPool.getTranslation(text.value, meta);
        this.instruction(this._creationCode, text.sourceSpan, R3.text, o.literal(this.allocateDataSlot()), variable);
    }
    allocateDataSlot() { return this._dataIndex++; }
    bindingContext() { return `${this._bindingContext++}`; }
    instruction(statements, span, reference, ...params) {
        statements.push(o.importExpr(reference, null, span).callFn(params, span).toStmt());
    }
    convertPropertyBinding(implicit, value) {
        const pipesConvertedValue = value.visit(this._valueConverter);
        const convertedPropertyBinding = convertPropertyBinding(this, implicit, pipesConvertedValue, this.bindingContext(), BindingForm.TrySimple, interpolate);
        this._bindingCode.push(...convertedPropertyBinding.stmts);
        return convertedPropertyBinding.currValExpr;
    }
}
class ValueConverter extends AstMemoryEfficientTransformer {
    constructor(constantPool, allocateSlot, definePipe) {
        super();
        this.constantPool = constantPool;
        this.allocateSlot = allocateSlot;
        this.definePipe = definePipe;
    }
    // AstMemoryEfficientTransformer
    visitPipe(pipe, context) {
        // Allocate a slot to create the pipe
        const slot = this.allocateSlot();
        const slotPseudoLocal = `PIPE:${slot}`;
        const target = new PropertyRead(pipe.span, new ImplicitReceiver(pipe.span), slotPseudoLocal);
        const bindingId = pipeBinding(pipe.args);
        this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(bindingId));
        const value = pipe.exp.visit(this);
        const args = this.visitAll(pipe.args);
        return new FunctionCall(pipe.span, target, [new LiteralPrimitive(pipe.span, slot), value, ...args]);
    }
    visitLiteralArray(array, context) {
        return new BuiltinFunctionCall(array.span, this.visitAll(array.expressions), values => {
            // If the literal has calculated (non-literal) elements transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            const literal = o.literalArr(values);
            return values.every(a => a.isConstant()) ? this.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(this.constantPool, literal);
        });
    }
    visitLiteralMap(map, context) {
        return new BuiltinFunctionCall(map.span, this.visitAll(map.values), values => {
            // If the literal has calculated (non-literal) elements  transform it into
            // calls to literal factories that compose the literal and will cache intermediate
            // values. Otherwise, just return an literal array that contains the values.
            const literal = o.literalMap(values.map((value, index) => ({ key: map.keys[index].key, value, quoted: map.keys[index].quoted })));
            return values.every(a => a.isConstant()) ? this.constantPool.getConstLiteral(literal, true) :
                getLiteralFactory(this.constantPool, literal);
        });
    }
}
// Pipes always have at least one parameter, the value they operate on
const pipeBindingIdentifiers = [R3.pipeBind1, R3.pipeBind2, R3.pipeBind3, R3.pipeBind4];
function pipeBinding(args) {
    return pipeBindingIdentifiers[args.length] || R3.pipeBindV;
}
const pureFunctionIdentifiers = [
    R3.pureFunction0, R3.pureFunction1, R3.pureFunction2, R3.pureFunction3, R3.pureFunction4,
    R3.pureFunction5, R3.pureFunction6, R3.pureFunction7, R3.pureFunction8
];
function getLiteralFactory(constantPool, literal) {
    const { literalFactory, literalFactoryArguments } = constantPool.getLiteralFactory(literal);
    literalFactoryArguments.length > 0 || error(`Expected arguments to a literal factory function`);
    let pureFunctionIdent = pureFunctionIdentifiers[literalFactoryArguments.length] || R3.pureFunctionV;
    // Literal factories are pure functions that only need to be re-invoked when the parameters
    // change.
    return o.importExpr(pureFunctionIdent).callFn([literalFactory, ...literalFactoryArguments]);
}
export class BindingScope {
    constructor(parent = null, declareLocalVarCallback = noop) {
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
    get(name) {
        let current = this;
        while (current) {
            let value = current.map.get(name);
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
    }
    /**
     * Create a local variable for later reference.
     *
     * @param name Name of the variable.
     * @param lhs AST representing the left hand side of the `let lhs = rhs;`.
     * @param rhs AST representing the right hand side of the `let lhs = rhs;`. The `rhs` can be
     * `undefined` for variable that are ambient such as `$event` and which don't have `rhs`
     * declaration.
     */
    set(name, lhs, rhs) {
        !this.map.has(name) ||
            error(`The name ${name} is already defined in scope to be ${this.map.get(name)}`);
        this.map.set(name, { lhs: lhs, rhs: rhs, declared: false });
        return this;
    }
    getLocal(name) { return this.get(name); }
    nestedScope(declareCallback) {
        return new BindingScope(this, declareCallback);
    }
    freshReferenceName() {
        let current = this;
        // Find the top scope as it maintains the global reference count
        while (current.parent)
            current = current.parent;
        const ref = `${REFERENCE_PREFIX}${current.referenceNameIndex++}`;
        return ref;
    }
}
BindingScope.ROOT_SCOPE = new BindingScope().set('$event', o.variable('$event'));
/**
 * Creates a `CssSelector` given a tag name and a map of attributes
 */
function createCssSelector(tag, attributes) {
    const cssSelector = new CssSelector();
    cssSelector.setElement(tag);
    Object.getOwnPropertyNames(attributes).forEach((name) => {
        const value = attributes[name];
        cssSelector.addAttribute(name, value);
        if (name.toLowerCase() === 'class') {
            const classes = value.trim().split(/\s+/g);
            classes.forEach(className => cssSelector.addClassName(className));
        }
    });
    return cssSelector;
}
// Parse i18n metas like:
// - "@@id",
// - "description[@@id]",
// - "meaning|description[@@id]"
function parseI18nMeta(i18n) {
    let meaning;
    let description;
    let id;
    if (i18n) {
        // TODO(vicb): figure out how to force a message ID with closure ?
        const idIndex = i18n.indexOf(ID_SEPARATOR);
        const descIndex = i18n.indexOf(MEANING_SEPARATOR);
        let meaningAndDesc;
        [meaningAndDesc, id] =
            (idIndex > -1) ? [i18n.slice(0, idIndex), i18n.slice(idIndex + 2)] : [i18n, ''];
        [meaning, description] = (descIndex > -1) ?
            [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] :
            ['', meaningAndDesc];
    }
    return { description, id, meaning };
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
        error(`Invalid interpolation argument length ${args.length}`);
    return o.importExpr(R3.interpolationV).callFn([o.literalArr(args)]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUVuRSxPQUFPLEVBQUMsV0FBVyxFQUFFLG1CQUFtQixFQUFpQixvQkFBb0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRXZKLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBTSw2QkFBNkIsRUFBNEIsWUFBWSxFQUFFLGdCQUFnQixFQUE0QixnQkFBZ0IsRUFBRSxZQUFZLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUNuTSxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxXQUFXLEVBQWtCLE1BQU0sZ0JBQWdCLENBQUM7QUFDNUQsT0FBTyxFQUFnQixLQUFLLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDaEQsT0FBTyxLQUFLLENBQUMsTUFBTSxXQUFXLENBQUM7QUFDL0IsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUdwRCxPQUFPLEVBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLEVBQUUsV0FBVyxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXhSLE1BQU0sdUJBQXVCLEdBQTBDO0lBQ3JFLGtCQUFzQixF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Q0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELEtBQUssRUFBRTtZQUNMLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsS0FBSyxFQUFFO1lBQ0wsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFDRCxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxLQUFLLENBQUMseUNBQXlDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ2xFLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2ZsYXR0ZW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uLy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIEJ1aWx0aW5GdW5jdGlvbkNhbGwsIExvY2FsUmVzb2x2ZXIsIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIsIEJpbmRpbmdQaXBlLCBCaW5kaW5nVHlwZSwgRnVuY3Rpb25DYWxsLCBJbXBsaWNpdFJlY2VpdmVyLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIFByb3BlcnR5UmVhZH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcblxuaW1wb3J0IHtSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Q09OVEVYVF9OQU1FLCBJMThOX0FUVFIsIEkxOE5fQVRUUl9QUkVGSVgsIElEX1NFUEFSQVRPUiwgSU1QTElDSVRfUkVGRVJFTkNFLCBNRUFOSU5HX1NFUEFSQVRPUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBURU1QT1JBUllfTkFNRSwgYXNMaXRlcmFsLCBnZXRRdWVyeVByZWRpY2F0ZSwgaW52YWxpZCwgbWFwVG9FeHByZXNzaW9uLCBub29wLCB0ZW1wb3JhcnlBbGxvY2F0b3IsIHRyaW1UcmFpbGluZ051bGxzLCB1bnN1cHBvcnRlZH0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgQklORElOR19JTlNUUlVDVElPTl9NQVA6IHtbdHlwZTogbnVtYmVyXTogby5FeHRlcm5hbFJlZmVyZW5jZX0gPSB7XG4gIFtCaW5kaW5nVHlwZS5Qcm9wZXJ0eV06IFIzLmVsZW1lbnRQcm9wZXJ0eSxcbiAgW0JpbmRpbmdUeXBlLkF0dHJpYnV0ZV06IFIzLmVsZW1lbnRBdHRyaWJ1dGUsXG4gIFtCaW5kaW5nVHlwZS5DbGFzc106IFIzLmVsZW1lbnRDbGFzc05hbWVkLFxuICBbQmluZGluZ1R5cGUuU3R5bGVdOiBSMy5lbGVtZW50U3R5bGVOYW1lZCxcbn07XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGltcGxlbWVudHMgdC5WaXNpdG9yPHZvaWQ+LCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGF0YUluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvbnRleHQgPSAwO1xuICBwcml2YXRlIF9wcmVmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIHByaXZhdGUgX2NyZWF0aW9uQ29kZTogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIF92YXJpYWJsZUNvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfcG9zdGZpeENvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBfdGVtcG9yYXJ5ID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHRoaXMuX3ByZWZpeENvZGUsIFRFTVBPUkFSWV9OQU1FKTtcbiAgcHJpdmF0ZSBfcHJvamVjdGlvbkRlZmluaXRpb25JbmRleCA9IC0xO1xuICBwcml2YXRlIF92YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIHByaXZhdGUgX3Vuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG4gIHByaXZhdGUgX2JpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlO1xuXG4gIC8vIFdoZXRoZXIgd2UgYXJlIGluc2lkZSBhIHRyYW5zbGF0YWJsZSBlbGVtZW50IChgPHAgaTE4bj4uLi4gc29tZXdoZXJlIGhlcmUgLi4uIDwvcD4pXG4gIHByaXZhdGUgX2luSTE4blNlY3Rpb246IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfaTE4blNlY3Rpb25JbmRleCA9IC0xO1xuICAvLyBNYXBzIG9mIHBsYWNlaG9sZGVyIHRvIG5vZGUgaW5kZXhlcyBmb3IgZWFjaCBvZiB0aGUgaTE4biBzZWN0aW9uXG4gIHByaXZhdGUgX3BoVG9Ob2RlSWR4ZXM6IHtbcGhOYW1lOiBzdHJpbmddOiBudW1iZXJbXX1bXSA9IFt7fV07XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwcml2YXRlIGNvbnRleHRQYXJhbWV0ZXI6IHN0cmluZyxcbiAgICAgIHBhcmVudEJpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlLCBwcml2YXRlIGxldmVsID0gMCwgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgdmlld1F1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLFxuICAgICAgcHJpdmF0ZSBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCwgcHJpdmF0ZSBkaXJlY3RpdmVzOiBTZXQ8by5FeHByZXNzaW9uPixcbiAgICAgIHByaXZhdGUgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4sIHByaXZhdGUgcGlwZXM6IFNldDxvLkV4cHJlc3Npb24+KSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID1cbiAgICAgICAgcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKChsaHNWYXI6IG8uUmVhZFZhckV4cHIsIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLnB1c2goXG4gICAgICAgICAgICAgIGxoc1Zhci5zZXQoZXhwcmVzc2lvbikudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcbiAgICAgICAgfSk7XG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgKCkgPT4gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCksXG4gICAgICAgIChuYW1lLCBsb2NhbE5hbWUsIHNsb3QsIHZhbHVlOiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICAgICAgY29uc3QgcGlwZVR5cGUgPSBwaXBlVHlwZUJ5TmFtZS5nZXQobmFtZSk7XG4gICAgICAgICAgaWYgKHBpcGVUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLnBpcGVzLmFkZChwaXBlVHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQobG9jYWxOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlLnB1c2goXG4gICAgICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5waXBlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSkudG9TdG10KCkpO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIGhhc05nQ29udGVudDogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdKTogby5GdW5jdGlvbkV4cHIge1xuICAgIC8vIENyZWF0ZSB2YXJpYWJsZSBiaW5kaW5nc1xuICAgIGZvciAoY29uc3QgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB2YXJpYWJsZS5uYW1lO1xuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9XG4gICAgICAgICAgby52YXJpYWJsZSh0aGlzLmNvbnRleHRQYXJhbWV0ZXIpLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKTtcbiAgICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICAvLyBBZGQgdGhlIHJlZmVyZW5jZSB0byB0aGUgbG9jYWwgc2NvcGUuXG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHZhcmlhYmxlTmFtZSwgby52YXJpYWJsZSh2YXJpYWJsZU5hbWUgKyBzY29wZWROYW1lKSwgZXhwcmVzc2lvbik7XG4gICAgfVxuXG4gICAgLy8gT3V0cHV0IGEgYFByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIHdoZW4gc29tZSBgPG5nLWNvbnRlbnQ+YCBhcmUgcHJlc2VudFxuICAgIGlmIChoYXNOZ0NvbnRlbnQpIHtcbiAgICAgIHRoaXMuX3Byb2plY3Rpb25EZWZpbml0aW9uSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbCh0aGlzLl9wcm9qZWN0aW9uRGVmaW5pdGlvbkluZGV4KV07XG5cbiAgICAgIC8vIE9ubHkgc2VsZWN0b3JzIHdpdGggYSBub24tZGVmYXVsdCB2YWx1ZSBhcmUgZ2VuZXJhdGVkXG4gICAgICBpZiAobmdDb250ZW50U2VsZWN0b3JzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY29uc3QgcjNTZWxlY3RvcnMgPSBuZ0NvbnRlbnRTZWxlY3RvcnMubWFwKHMgPT4gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHMpKTtcbiAgICAgICAgLy8gYHByb2plY3Rpb25EZWZgIG5lZWRzIGJvdGggdGhlIHBhcnNlZCBhbmQgcmF3IHZhbHVlIG9mIHRoZSBzZWxlY3RvcnNcbiAgICAgICAgY29uc3QgcGFyc2VkID0gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyM1NlbGVjdG9ycyksIHRydWUpO1xuICAgICAgICBjb25zdCB1blBhcnNlZCA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwobmdDb250ZW50U2VsZWN0b3JzKSwgdHJ1ZSk7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChwYXJzZWQsIHVuUGFyc2VkKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5pbnN0cnVjdGlvbih0aGlzLl9jcmVhdGlvbkNvZGUsIG51bGwsIFIzLnByb2plY3Rpb25EZWYsIC4uLnBhcmFtZXRlcnMpO1xuICAgIH1cblxuICAgIC8vIERlZmluZSBhbmQgdXBkYXRlIGFueSB2aWV3IHF1ZXJpZXNcbiAgICBmb3IgKGxldCBxdWVyeSBvZiB0aGlzLnZpZXdRdWVyaWVzKSB7XG4gICAgICAvLyBlLmcuIHIzLlEoMCwgc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgICBjb25zdCBxdWVyeVNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIGNvbnN0IHByZWRpY2F0ZSA9IGdldFF1ZXJ5UHJlZGljYXRlKHF1ZXJ5LCB0aGlzLmNvbnN0YW50UG9vbCk7XG4gICAgICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgICAgby5saXRlcmFsKHF1ZXJ5U2xvdCwgby5JTkZFUlJFRF9UWVBFKSxcbiAgICAgICAgcHJlZGljYXRlLFxuICAgICAgICBvLmxpdGVyYWwocXVlcnkuZGVzY2VuZGFudHMsIG8uSU5GRVJSRURfVFlQRSksXG4gICAgICBdO1xuXG4gICAgICBpZiAocXVlcnkucmVhZCkge1xuICAgICAgICBhcmdzLnB1c2gocXVlcnkucmVhZCk7XG4gICAgICB9XG4gICAgICB0aGlzLmluc3RydWN0aW9uKHRoaXMuX2NyZWF0aW9uQ29kZSwgbnVsbCwgUjMucXVlcnksIC4uLmFyZ3MpO1xuXG4gICAgICAvLyAocjMucVIodG1wID0gcjMuybVsZCgwKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgICBjb25zdCB0ZW1wb3JhcnkgPSB0aGlzLl90ZW1wb3JhcnkoKTtcbiAgICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkKS5jYWxsRm4oW28ubGl0ZXJhbChxdWVyeVNsb3QpXSk7XG4gICAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgICAgdGhpcy5fYmluZGluZ0NvZGUucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgICB9XG5cbiAgICB0LnZpc2l0QWxsKHRoaXMsIG5vZGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQ29kZSA9IHRoaXMuX2NyZWF0aW9uQ29kZS5sZW5ndGggPiAwID9cbiAgICAgICAgW28uaWZTdG10KFxuICAgICAgICAgICAgby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlKSwgbnVsbCwgZmFsc2UpLFxuICAgICAgICAgICAgdGhpcy5fY3JlYXRpb25Db2RlKV0gOlxuICAgICAgICBbXTtcblxuICAgIGNvbnN0IHVwZGF0ZUNvZGUgPSB0aGlzLl9iaW5kaW5nQ29kZS5sZW5ndGggPiAwID9cbiAgICAgICAgW28uaWZTdG10KFxuICAgICAgICAgICAgby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlKSwgbnVsbCwgZmFsc2UpLFxuICAgICAgICAgICAgdGhpcy5fYmluZGluZ0NvZGUpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgbWFwcyBvZiBwbGFjZWhvbGRlciBuYW1lIHRvIG5vZGUgaW5kZXhlc1xuICAgIC8vIFRPRE8odmljYik6IFRoaXMgaXMgYSBXSVAsIG5vdCBmdWxseSBzdXBwb3J0ZWQgeWV0XG4gICAgZm9yIChjb25zdCBwaFRvTm9kZUlkeCBvZiB0aGlzLl9waFRvTm9kZUlkeGVzKSB7XG4gICAgICBpZiAoT2JqZWN0LmtleXMocGhUb05vZGVJZHgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICAgICAgY29uc3QgcGhNYXAgPSBvLnZhcmlhYmxlKHNjb3BlZE5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQobWFwVG9FeHByZXNzaW9uKHBoVG9Ob2RlSWR4LCB0cnVlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKTtcblxuICAgICAgICB0aGlzLl9wcmVmaXhDb2RlLnB1c2gocGhNYXApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKHRoaXMuY29udGV4dFBhcmFtZXRlciwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkNvZGUsXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgbG9jYWwgcmVmcyAoaS5lLiBjb25zdCB0bXAgPSBsZCgxKSBhcyBhbnkpXG4gICAgICAgICAgLi4udGhpcy5fdmFyaWFibGVDb2RlLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUNvZGUsXG4gICAgICAgICAgLy8gTmVzdGVkIHRlbXBsYXRlcyAoaS5lLiBmdW5jdGlvbiBDb21wVGVtcGxhdGUoKSB7fSlcbiAgICAgICAgICAuLi50aGlzLl9wb3N0Zml4Q29kZVxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBzZWxlY3RvckluZGV4ID0gbmdDb250ZW50LnNlbGVjdG9ySW5kZXg7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwoc2xvdCksXG4gICAgICBvLmxpdGVyYWwodGhpcy5fcHJvamVjdGlvbkRlZmluaXRpb25JbmRleCksXG4gICAgXTtcblxuICAgIGNvbnN0IGF0dHJpYnV0ZUFzTGlzdDogc3RyaW5nW10gPSBbXTtcblxuICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZvckVhY2goKGF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHJpYnV0ZS5uYW1lO1xuICAgICAgaWYgKG5hbWUgIT09ICdzZWxlY3QnKSB7XG4gICAgICAgIGF0dHJpYnV0ZUFzTGlzdC5wdXNoKG5hbWUsIGF0dHJpYnV0ZS52YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYXR0cmlidXRlQXNMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCksIGFzTGl0ZXJhbChhdHRyaWJ1dGVBc0xpc3QpKTtcbiAgICB9IGVsc2UgaWYgKHNlbGVjdG9ySW5kZXggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwoc2VsZWN0b3JJbmRleCkpO1xuICAgIH1cblxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24odGhpcy5fY3JlYXRpb25Db2RlLCBuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgLi4ucGFyYW1ldGVycyk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxlbWVudEluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgcmVmZXJlbmNlRGF0YVNsb3RzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBjb25zdCB3YXNJbkkxOG5TZWN0aW9uID0gdGhpcy5faW5JMThuU2VjdGlvbjtcblxuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBjb25zdCBhdHRySTE4bk1ldGFzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBsZXQgaTE4bk1ldGE6IHN0cmluZyA9ICcnO1xuXG4gICAgLy8gRWxlbWVudHMgaW5zaWRlIGkxOG4gc2VjdGlvbnMgYXJlIHJlcGxhY2VkIHdpdGggcGxhY2Vob2xkZXJzXG4gICAgLy8gVE9ETyh2aWNiKTogbmVzdGVkIGVsZW1lbnRzIGFyZSBhIFdJUCBpbiB0aGlzIHBoYXNlXG4gICAgaWYgKHRoaXMuX2luSTE4blNlY3Rpb24pIHtcbiAgICAgIGNvbnN0IHBoTmFtZSA9IGVsZW1lbnQubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKCF0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0pIHtcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XVtwaE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICB0aGlzLl9waFRvTm9kZUlkeGVzW3RoaXMuX2kxOG5TZWN0aW9uSW5kZXhdW3BoTmFtZV0ucHVzaChlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSBpMThuIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgICBjb25zdCBuYW1lID0gYXR0ci5uYW1lO1xuICAgICAgY29uc3QgdmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgICAgaWYgKG5hbWUgPT09IEkxOE5fQVRUUikge1xuICAgICAgICBpZiAodGhpcy5faW5JMThuU2VjdGlvbikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYENvdWxkIG5vdCBtYXJrIGFuIGVsZW1lbnQgYXMgdHJhbnNsYXRhYmxlIGluc2lkZSBvZiBhIHRyYW5zbGF0YWJsZSBzZWN0aW9uYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5JMThuU2VjdGlvbiA9IHRydWU7XG4gICAgICAgIHRoaXMuX2kxOG5TZWN0aW9uSW5kZXgrKztcbiAgICAgICAgdGhpcy5fcGhUb05vZGVJZHhlc1t0aGlzLl9pMThuU2VjdGlvbkluZGV4XSA9IHt9O1xuICAgICAgICBpMThuTWV0YSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lLnN0YXJ0c1dpdGgoSTE4Tl9BVFRSX1BSRUZJWCkpIHtcbiAgICAgICAgYXR0ckkxOG5NZXRhc1tuYW1lLnNsaWNlKEkxOE5fQVRUUl9QUkVGSVgubGVuZ3RoKV0gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dEF0dHJzW25hbWVdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWF0Y2ggZGlyZWN0aXZlcyBvbiBub24gaTE4biBhdHRyaWJ1dGVzXG4gICAgaWYgKHRoaXMuZGlyZWN0aXZlTWF0Y2hlcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVDc3NTZWxlY3RvcihlbGVtZW50Lm5hbWUsIG91dHB1dEF0dHJzKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKHNlbDogQ3NzU2VsZWN0b3IsIHN0YXRpY1R5cGU6IGFueSkgPT4geyB0aGlzLmRpcmVjdGl2ZXMuYWRkKHN0YXRpY1R5cGUpOyB9KTtcbiAgICB9XG5cbiAgICAvLyBFbGVtZW50IGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLFxuICAgICAgby5saXRlcmFsKGVsZW1lbnQubmFtZSksXG4gICAgXTtcblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGkxOG5NZXNzYWdlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvdXRwdXRBdHRycykuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gb3V0cHV0QXR0cnNbbmFtZV07XG4gICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKG5hbWUpKTtcbiAgICAgIGlmIChhdHRySTE4bk1ldGFzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGNvbnN0IG1ldGEgPSBwYXJzZUkxOG5NZXRhKGF0dHJJMThuTWV0YXNbbmFtZV0pO1xuICAgICAgICBjb25zdCB2YXJpYWJsZSA9IHRoaXMuY29uc3RhbnRQb29sLmdldFRyYW5zbGF0aW9uKHZhbHVlLCBtZXRhKTtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKHZhcmlhYmxlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaChvLmxpdGVyYWwodmFsdWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IGF0dHJBcmc6IG8uRXhwcmVzc2lvbiA9IGF0dHJpYnV0ZXMubGVuZ3RoID4gMCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoYXR0cmlidXRlcyksIHRydWUpIDpcbiAgICAgICAgby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgcGFyYW1ldGVycy5wdXNoKGF0dHJBcmcpO1xuXG4gICAgaWYgKGVsZW1lbnQucmVmZXJlbmNlcyAmJiBlbGVtZW50LnJlZmVyZW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcmVmZXJlbmNlcyA9IGZsYXR0ZW4oZWxlbWVudC5yZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgICAgIHJlZmVyZW5jZURhdGFTbG90cy5zZXQocmVmZXJlbmNlLm5hbWUsIHNsb3QpO1xuICAgICAgICAvLyBHZW5lcmF0ZSB0aGUgdXBkYXRlIHRlbXBvcmFyeS5cbiAgICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgICB0aGlzLl92YXJpYWJsZUNvZGUucHVzaChvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSwgby5JTkZFUlJFRF9UWVBFKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCldKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSkpO1xuICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHJlZmVyZW5jZS5uYW1lLCBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSkpO1xuICAgICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgICAgfSkpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocmVmZXJlbmNlcyksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uVFlQRURfTlVMTF9FWFBSKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgaW5zdHJ1Y3Rpb24gY3JlYXRlIGVsZW1lbnQgaW5zdHJ1Y3Rpb25cbiAgICBpZiAoaTE4bk1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZS5wdXNoKC4uLmkxOG5NZXNzYWdlcyk7XG4gICAgfVxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5jcmVhdGVFbGVtZW50LCAuLi50cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICBjb25zdCBpbXBsaWNpdCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcblxuICAgIC8vIEdlbmVyYXRlIExpc3RlbmVycyAob3V0cHV0cylcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IGVsTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcihlbGVtZW50Lm5hbWUpO1xuICAgICAgY29uc3QgZXZOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKG91dHB1dEFzdC5uYW1lKTtcbiAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke2VsTmFtZX1fJHtldk5hbWV9X2xpc3RlbmVyYDtcbiAgICAgIGNvbnN0IGxvY2FsVmFyczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgY29uc3QgYmluZGluZ1Njb3BlID1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUoKGxoc1Zhcjogby5SZWFkVmFyRXhwciwgcmhzRXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSA9PiB7XG4gICAgICAgICAgICBsb2NhbFZhcnMucHVzaChcbiAgICAgICAgICAgICAgICBsaHNWYXIuc2V0KHJoc0V4cHJlc3Npb24pLnRvRGVjbFN0bXQoby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuRmluYWxdKSk7XG4gICAgICAgICAgfSk7XG4gICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgIGJpbmRpbmdTY29wZSwgaW1wbGljaXQsIG91dHB1dEFzdC5oYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgICBjb25zdCBoYW5kbGVyID0gby5mbihcbiAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSwgWy4uLmxvY2FsVmFycywgLi4uYmluZGluZ0V4cHIucmVuZGVyM1N0bXRzXSxcbiAgICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIGZ1bmN0aW9uTmFtZSk7XG4gICAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgb3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLCBvLmxpdGVyYWwob3V0cHV0QXN0Lm5hbWUpLFxuICAgICAgICAgIGhhbmRsZXIpO1xuICAgIH0pO1xuXG5cbiAgICAvLyBHZW5lcmF0ZSBlbGVtZW50IGlucHV0IGJpbmRpbmdzXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgdGhpcy5fdW5zdXBwb3J0ZWQoJ2FuaW1hdGlvbnMnKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvbnZlcnRlZEJpbmRpbmcgPSB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIGlucHV0LnZhbHVlKTtcbiAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gQklORElOR19JTlNUUlVDVElPTl9NQVBbaW5wdXQudHlwZV07XG4gICAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgICAgLy8gVE9ETyhjaHVja2opOiBydW50aW1lOiBzZWN1cml0eSBjb250ZXh0P1xuICAgICAgICBjb25zdCB2YWx1ZSA9IG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW2NvbnZlcnRlZEJpbmRpbmddKTtcbiAgICAgICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLCBpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbiwgby5saXRlcmFsKGVsZW1lbnRJbmRleCksXG4gICAgICAgICAgICBvLmxpdGVyYWwoaW5wdXQubmFtZSksIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Vuc3VwcG9ydGVkKGBiaW5kaW5nIHR5cGUgJHtpbnB1dC50eXBlfWApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVHJhdmVyc2UgZWxlbWVudCBjaGlsZCBub2Rlc1xuICAgIGlmICh0aGlzLl9pbkkxOG5TZWN0aW9uICYmIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID09IDEgJiZcbiAgICAgICAgZWxlbWVudC5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgY29uc3QgdGV4dCA9IGVsZW1lbnQuY2hpbGRyZW5bMF0gYXMgdC5UZXh0O1xuICAgICAgdGhpcy52aXNpdFNpbmdsZUkxOG5UZXh0Q2hpbGQodGV4dCwgaTE4bk1ldGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgIH1cblxuICAgIC8vIEZpbmlzaCBlbGVtZW50IGNvbnN0cnVjdGlvbiBtb2RlLlxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZWxlbWVudEVuZCk7XG5cbiAgICAvLyBSZXN0b3JlIHRoZSBzdGF0ZSBiZWZvcmUgZXhpdGluZyB0aGlzIG5vZGVcbiAgICB0aGlzLl9pbkkxOG5TZWN0aW9uID0gd2FzSW5JMThuU2VjdGlvbjtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG5cbiAgICBsZXQgZWxOYW1lID0gJyc7XG4gICAgaWYgKHRlbXBsYXRlLmNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiB0ZW1wbGF0ZS5jaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudCkge1xuICAgICAgLy8gV2hlbiB0aGUgdGVtcGxhdGUgYXMgYSBzaW5nbGUgY2hpbGQsIGRlcml2ZSB0aGUgY29udGV4dCBuYW1lIGZyb20gdGhlIHRhZ1xuICAgICAgZWxOYW1lID0gc2FuaXRpemVJZGVudGlmaWVyKCh0ZW1wbGF0ZS5jaGlsZHJlblswXSBhcyB0LkVsZW1lbnQpLm5hbWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRleHROYW1lID0gZWxOYW1lID8gYCR7dGhpcy5jb250ZXh0TmFtZX1fJHtlbE5hbWV9YCA6ICcnO1xuXG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID1cbiAgICAgICAgY29udGV4dE5hbWUgPyBgJHtjb250ZXh0TmFtZX1fVGVtcGxhdGVfJHt0ZW1wbGF0ZUluZGV4fWAgOiBgVGVtcGxhdGVfJHt0ZW1wbGF0ZUluZGV4fWA7XG5cbiAgICBjb25zdCB0ZW1wbGF0ZUNvbnRleHQgPSBgY3R4JHt0aGlzLmxldmVsfWA7XG5cbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgIG8ubGl0ZXJhbCh0ZW1wbGF0ZUluZGV4KSxcbiAgICAgIG8udmFyaWFibGUodGVtcGxhdGVOYW1lKSxcbiAgICAgIG8uVFlQRURfTlVMTF9FWFBSLFxuICAgIF07XG5cbiAgICBjb25zdCBhdHRyaWJ1dGVOYW1lczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBhdHRyaWJ1dGVNYXA6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gICAgdGVtcGxhdGUuYXR0cmlidXRlcy5mb3JFYWNoKGEgPT4ge1xuICAgICAgYXR0cmlidXRlTmFtZXMucHVzaChhc0xpdGVyYWwoYS5uYW1lKSwgYXNMaXRlcmFsKCcnKSk7XG4gICAgICBhdHRyaWJ1dGVNYXBbYS5uYW1lXSA9IGEudmFsdWU7XG4gICAgfSk7XG5cbiAgICAvLyBNYXRjaCBkaXJlY3RpdmVzIG9uIHRlbXBsYXRlIGF0dHJpYnV0ZXNcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKCduZy10ZW1wbGF0ZScsIGF0dHJpYnV0ZU1hcCk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIubWF0Y2goXG4gICAgICAgICAgc2VsZWN0b3IsIChjc3NTZWxlY3Rvciwgc3RhdGljVHlwZSkgPT4geyB0aGlzLmRpcmVjdGl2ZXMuYWRkKHN0YXRpY1R5cGUpOyB9KTtcbiAgICB9XG5cbiAgICBpZiAoYXR0cmlidXRlTmFtZXMubGVuZ3RoKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVOYW1lcyksIHRydWUpKTtcbiAgICB9XG5cbiAgICAvLyBlLmcuIEMoMSwgQzFUZW1wbGF0ZSlcbiAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICB0aGlzLl9jcmVhdGlvbkNvZGUsIHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLmNvbnRhaW5lckNyZWF0ZSxcbiAgICAgICAgLi4udHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgLy8gZS5nLiBwKDEsICdmb3JPZicsIMm1YihjdHguaXRlbXMpKTtcbiAgICBjb25zdCBjb250ZXh0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgIHRlbXBsYXRlLmlucHV0cy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGNvbnN0IGNvbnZlcnRlZEJpbmRpbmcgPSB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoY29udGV4dCwgaW5wdXQudmFsdWUpO1xuICAgICAgdGhpcy5pbnN0cnVjdGlvbihcbiAgICAgICAgICB0aGlzLl9iaW5kaW5nQ29kZSwgdGVtcGxhdGUuc291cmNlU3BhbiwgUjMuZWxlbWVudFByb3BlcnR5LCBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksXG4gICAgICAgICAgby5saXRlcmFsKGlucHV0Lm5hbWUpLCBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFtjb252ZXJ0ZWRCaW5kaW5nXSkpO1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICAgIGNvbnN0IHRlbXBsYXRlVmlzaXRvciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbCwgdGVtcGxhdGVDb250ZXh0LCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSxcbiAgICAgICAgdGVtcGxhdGVOYW1lLCBbXSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsIHRoaXMucGlwZXMpO1xuICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByID1cbiAgICAgICAgdGVtcGxhdGVWaXNpdG9yLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbih0ZW1wbGF0ZS5jaGlsZHJlbiwgdGVtcGxhdGUudmFyaWFibGVzKTtcbiAgICB0aGlzLl9wb3N0Zml4Q29kZS5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gIH1cblxuICAvLyBUaGVzZSBzaG91bGQgYmUgaGFuZGxlZCBpbiB0aGUgdGVtcGxhdGUgb3IgZWxlbWVudCBkaXJlY3RseS5cbiAgcmVhZG9ubHkgdmlzaXRSZWZlcmVuY2UgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFZhcmlhYmxlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRUZXh0QXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRFdmVudCA9IGludmFsaWQ7XG5cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogdC5Cb3VuZFRleHQpIHtcbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24odGhpcy5fY3JlYXRpb25Db2RlLCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIG8ubGl0ZXJhbChub2RlSW5kZXgpKTtcblxuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2JpbmRpbmdDb2RlLCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHRDcmVhdGVCb3VuZCwgby5saXRlcmFsKG5vZGVJbmRleCksXG4gICAgICAgIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSksIHRleHQudmFsdWUpKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICB0aGlzLmluc3RydWN0aW9uKFxuICAgICAgICB0aGlzLl9jcmVhdGlvbkNvZGUsIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSxcbiAgICAgICAgby5saXRlcmFsKHRleHQudmFsdWUpKTtcbiAgfVxuXG4gIC8vIFdoZW4gdGhlIGNvbnRlbnQgb2YgdGhlIGVsZW1lbnQgaXMgYSBzaW5nbGUgdGV4dCBub2RlIHRoZSB0cmFuc2xhdGlvbiBjYW4gYmUgaW5saW5lZDpcbiAgLy9cbiAgLy8gYDxwIGkxOG49XCJkZXNjfG1lYW5cIj5zb21lIGNvbnRlbnQ8L3A+YFxuICAvLyBjb21waWxlcyB0b1xuICAvLyBgYGBcbiAgLy8gLyoqXG4gIC8vICogQGRlc2MgZGVzY1xuICAvLyAqIEBtZWFuaW5nIG1lYW5cbiAgLy8gKi9cbiAgLy8gY29uc3QgTVNHX1hZWiA9IGdvb2cuZ2V0TXNnKCdzb21lIGNvbnRlbnQnKTtcbiAgLy8gaTAuybVUKDEsIE1TR19YWVopO1xuICAvLyBgYGBcbiAgdmlzaXRTaW5nbGVJMThuVGV4dENoaWxkKHRleHQ6IHQuVGV4dCwgaTE4bk1ldGE6IHN0cmluZykge1xuICAgIGNvbnN0IG1ldGEgPSBwYXJzZUkxOG5NZXRhKGkxOG5NZXRhKTtcbiAgICBjb25zdCB2YXJpYWJsZSA9IHRoaXMuY29uc3RhbnRQb29sLmdldFRyYW5zbGF0aW9uKHRleHQudmFsdWUsIG1ldGEpO1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb24oXG4gICAgICAgIHRoaXMuX2NyZWF0aW9uQ29kZSwgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCB2YXJpYWJsZSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlRGF0YVNsb3QoKSB7IHJldHVybiB0aGlzLl9kYXRhSW5kZXgrKzsgfVxuICBwcml2YXRlIGJpbmRpbmdDb250ZXh0KCkgeyByZXR1cm4gYCR7dGhpcy5fYmluZGluZ0NvbnRleHQrK31gOyB9XG5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbihcbiAgICAgIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10sIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICAuLi5wYXJhbXM6IG8uRXhwcmVzc2lvbltdKSB7XG4gICAgc3RhdGVtZW50cy5wdXNoKG8uaW1wb3J0RXhwcihyZWZlcmVuY2UsIG51bGwsIHNwYW4pLmNhbGxGbihwYXJhbXMsIHNwYW4pLnRvU3RtdCgpKTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydFByb3BlcnR5QmluZGluZyhpbXBsaWNpdDogby5FeHByZXNzaW9uLCB2YWx1ZTogQVNUKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBwaXBlc0NvbnZlcnRlZFZhbHVlID0gdmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgIHRoaXMsIGltcGxpY2l0LCBwaXBlc0NvbnZlcnRlZFZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSxcbiAgICAgICAgaW50ZXJwb2xhdGUpO1xuICAgIHRoaXMuX2JpbmRpbmdDb2RlLnB1c2goLi4uY29udmVydGVkUHJvcGVydHlCaW5kaW5nLnN0bXRzKTtcbiAgICByZXR1cm4gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICB9XG59XG5cbmNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIGNvbnN0IHRhcmdldCA9IG5ldyBQcm9wZXJ0eVJlYWQocGlwZS5zcGFuLCBuZXcgSW1wbGljaXRSZWNlaXZlcihwaXBlLnNwYW4pLCBzbG90UHNldWRvTG9jYWwpO1xuICAgIGNvbnN0IGJpbmRpbmdJZCA9IHBpcGVCaW5kaW5nKHBpcGUuYXJncyk7XG4gICAgdGhpcy5kZWZpbmVQaXBlKHBpcGUubmFtZSwgc2xvdFBzZXVkb0xvY2FsLCBzbG90LCBvLmltcG9ydEV4cHIoYmluZGluZ0lkKSk7XG4gICAgY29uc3QgdmFsdWUgPSBwaXBlLmV4cC52aXNpdCh0aGlzKTtcbiAgICBjb25zdCBhcmdzID0gdGhpcy52aXNpdEFsbChwaXBlLmFyZ3MpO1xuXG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbkNhbGwoXG4gICAgICAgIHBpcGUuc3BhbiwgdGFyZ2V0LCBbbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBzbG90KSwgdmFsdWUsIC4uLmFyZ3NdKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKGFycmF5LnNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChsaXRlcmFsLCB0cnVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwpO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKG1hcDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwobWFwLnNwYW4sIHRoaXMudmlzaXRBbGwobWFwLnZhbHVlcyksIHZhbHVlcyA9PiB7XG4gICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzICB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbE1hcCh2YWx1ZXMubWFwKFxuICAgICAgICAgICh2YWx1ZSwgaW5kZXgpID0+ICh7a2V5OiBtYXAua2V5c1tpbmRleF0ua2V5LCB2YWx1ZSwgcXVvdGVkOiBtYXAua2V5c1tpbmRleF0ucXVvdGVkfSkpKTtcbiAgICAgIHJldHVybiB2YWx1ZXMuZXZlcnkoYSA9PiBhLmlzQ29uc3RhbnQoKSkgPyB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsKTtcbiAgICB9KTtcbiAgfVxufVxuXG5cblxuLy8gUGlwZXMgYWx3YXlzIGhhdmUgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciwgdGhlIHZhbHVlIHRoZXkgb3BlcmF0ZSBvblxuY29uc3QgcGlwZUJpbmRpbmdJZGVudGlmaWVycyA9IFtSMy5waXBlQmluZDEsIFIzLnBpcGVCaW5kMiwgUjMucGlwZUJpbmQzLCBSMy5waXBlQmluZDRdO1xuXG5mdW5jdGlvbiBwaXBlQmluZGluZyhhcmdzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXh0ZXJuYWxSZWZlcmVuY2Uge1xuICByZXR1cm4gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF0gfHwgUjMucGlwZUJpbmRWO1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcbmZ1bmN0aW9uIGdldExpdGVyYWxGYWN0b3J5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBsaXRlcmFsOiBvLkxpdGVyYWxBcnJheUV4cHIgfCBvLkxpdGVyYWxNYXBFeHByKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3Qge2xpdGVyYWxGYWN0b3J5LCBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50c30gPSBjb25zdGFudFBvb2wuZ2V0TGl0ZXJhbEZhY3RvcnkobGl0ZXJhbCk7XG4gIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzLmxlbmd0aCA+IDAgfHwgZXJyb3IoYEV4cGVjdGVkIGFyZ3VtZW50cyB0byBhIGxpdGVyYWwgZmFjdG9yeSBmdW5jdGlvbmApO1xuICBsZXQgcHVyZUZ1bmN0aW9uSWRlbnQgPVxuICAgICAgcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnNbbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoXSB8fCBSMy5wdXJlRnVuY3Rpb25WO1xuXG4gIC8vIExpdGVyYWwgZmFjdG9yaWVzIGFyZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG9ubHkgbmVlZCB0byBiZSByZS1pbnZva2VkIHdoZW4gdGhlIHBhcmFtZXRlcnNcbiAgLy8gY2hhbmdlLlxuICByZXR1cm4gby5pbXBvcnRFeHByKHB1cmVGdW5jdGlvbklkZW50KS5jYWxsRm4oW2xpdGVyYWxGYWN0b3J5LCAuLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50c10pO1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHdoaWNoIGlzIGV4ZWN1dGVkIHdoZW5ldmVyIGEgdmFyaWFibGUgaXMgcmVmZXJlbmNlZCBmb3IgdGhlIGZpcnN0IHRpbWUgaW4gYSBnaXZlblxuICogc2NvcGUuXG4gKlxuICogSXQgaXMgZXhwZWN0ZWQgdGhhdCB0aGUgZnVuY3Rpb24gY3JlYXRlcyB0aGUgYGNvbnN0IGxvY2FsTmFtZSA9IGV4cHJlc3Npb25gOyBzdGF0ZW1lbnQuXG4gKi9cbmV4cG9ydCB0eXBlIERlY2xhcmVMb2NhbFZhckNhbGxiYWNrID0gKGxoc1Zhcjogby5SZWFkVmFyRXhwciwgcmhzRXhwcmVzc2lvbjogby5FeHByZXNzaW9uKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKlxuICAgKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBleHByZXNzaW9ucy5cbiAgICpcbiAgICogVGhpcyBpcyB1c2VkIHdoZW4gb25lIHJlZmVycyB0byB2YXJpYWJsZSBzdWNoIGFzOiAnbGV0IGFiYyA9IGEuYi5jYC5cbiAgICogLSBrZXkgdG8gdGhlIG1hcCBpcyB0aGUgc3RyaW5nIGxpdGVyYWwgYFwiYWJjXCJgLlxuICAgKiAtIHZhbHVlIGBsaHNgIGlzIHRoZSBsZWZ0IGhhbmQgc2lkZSB3aGljaCBpcyBhbiBBU1QgcmVwcmVzZW50aW5nIGBhYmNgLlxuICAgKiAtIHZhbHVlIGByaHNgIGlzIHRoZSByaWdodCBoYW5kIHNpZGUgd2hpY2ggaXMgYW4gQVNUIHJlcHJlc2VudGluZyBgYS5iLmNgLlxuICAgKiAtIHZhbHVlIGBkZWNsYXJlZGAgaXMgdHJ1ZSBpZiB0aGUgYGRlY2xhcmVMb2NhbFZhckNhbGxiYWNrYCBoYXMgYmVlbiBjYWxsZWQgZm9yIHRoaXMgc2NvcGVcbiAgICogYWxyZWFkeS5cbiAgICovXG4gIHByaXZhdGUgbWFwID0gbmV3IE1hcCA8IHN0cmluZywge1xuICAgIGxoczogby5SZWFkVmFyRXhwcjtcbiAgICByaHM6IG8uRXhwcmVzc2lvbnx1bmRlZmluZWQ7XG4gICAgZGVjbGFyZWQ6IGJvb2xlYW47XG4gIH1cbiAgPiAoKTtcbiAgcHJpdmF0ZSByZWZlcmVuY2VOYW1lSW5kZXggPSAwO1xuXG4gIHN0YXRpYyBST09UX1NDT1BFID0gbmV3IEJpbmRpbmdTY29wZSgpLnNldCgnJGV2ZW50Jywgby52YXJpYWJsZSgnJGV2ZW50JykpO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHBhcmVudDogQmluZGluZ1Njb3BlfG51bGwgPSBudWxsLFxuICAgICAgcHJpdmF0ZSBkZWNsYXJlTG9jYWxWYXJDYWxsYmFjazogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSBub29wKSB7fVxuXG4gIGdldChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgbGV0IGN1cnJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gdGhpcztcbiAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgbGV0IHZhbHVlID0gY3VycmVudC5tYXAuZ2V0KG5hbWUpO1xuICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IHRoaXMpIHtcbiAgICAgICAgICAvLyBtYWtlIGEgbG9jYWwgY29weSBhbmQgcmVzZXQgdGhlIGBkZWNsYXJlZGAgc3RhdGUuXG4gICAgICAgICAgdmFsdWUgPSB7bGhzOiB2YWx1ZS5saHMsIHJoczogdmFsdWUucmhzLCBkZWNsYXJlZDogZmFsc2V9O1xuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZhbHVlLnJocyAmJiAhdmFsdWUuZGVjbGFyZWQpIHtcbiAgICAgICAgICAvLyBpZiBpdCBpcyBmaXJzdCB0aW1lIHdlIGFyZSByZWZlcmVuY2luZyB0aGUgdmFyaWFibGUgaW4gdGhlIHNjb3BlXG4gICAgICAgICAgLy8gdGhhbiBpbnZva2UgdGhlIGNhbGxiYWNrIHRvIGluc2VydCB2YXJpYWJsZSBkZWNsYXJhdGlvbi5cbiAgICAgICAgICB0aGlzLmRlY2xhcmVMb2NhbFZhckNhbGxiYWNrKHZhbHVlLmxocywgdmFsdWUucmhzKTtcbiAgICAgICAgICB2YWx1ZS5kZWNsYXJlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlLmxocztcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbG9jYWwgdmFyaWFibGUgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgdmFyaWFibGUuXG4gICAqIEBwYXJhbSBsaHMgQVNUIHJlcHJlc2VudGluZyB0aGUgbGVmdCBoYW5kIHNpZGUgb2YgdGhlIGBsZXQgbGhzID0gcmhzO2AuXG4gICAqIEBwYXJhbSByaHMgQVNUIHJlcHJlc2VudGluZyB0aGUgcmlnaHQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLiBUaGUgYHJoc2AgY2FuIGJlXG4gICAqIGB1bmRlZmluZWRgIGZvciB2YXJpYWJsZSB0aGF0IGFyZSBhbWJpZW50IHN1Y2ggYXMgYCRldmVudGAgYW5kIHdoaWNoIGRvbid0IGhhdmUgYHJoc2BcbiAgICogZGVjbGFyYXRpb24uXG4gICAqL1xuICBzZXQobmFtZTogc3RyaW5nLCBsaHM6IG8uUmVhZFZhckV4cHIsIHJocz86IG8uRXhwcmVzc2lvbik6IEJpbmRpbmdTY29wZSB7XG4gICAgIXRoaXMubWFwLmhhcyhuYW1lKSB8fFxuICAgICAgICBlcnJvcihgVGhlIG5hbWUgJHtuYW1lfSBpcyBhbHJlYWR5IGRlZmluZWQgaW4gc2NvcGUgdG8gYmUgJHt0aGlzLm1hcC5nZXQobmFtZSl9YCk7XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtsaHM6IGxocywgcmhzOiByaHMsIGRlY2xhcmVkOiBmYWxzZX0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7IHJldHVybiB0aGlzLmdldChuYW1lKTsgfVxuXG4gIG5lc3RlZFNjb3BlKGRlY2xhcmVDYWxsYmFjazogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2spOiBCaW5kaW5nU2NvcGUge1xuICAgIHJldHVybiBuZXcgQmluZGluZ1Njb3BlKHRoaXMsIGRlY2xhcmVDYWxsYmFjayk7XG4gIH1cblxuICBmcmVzaFJlZmVyZW5jZU5hbWUoKTogc3RyaW5nIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlID0gdGhpcztcbiAgICAvLyBGaW5kIHRoZSB0b3Agc2NvcGUgYXMgaXQgbWFpbnRhaW5zIHRoZSBnbG9iYWwgcmVmZXJlbmNlIGNvdW50XG4gICAgd2hpbGUgKGN1cnJlbnQucGFyZW50KSBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgY29uc3QgcmVmID0gYCR7UkVGRVJFTkNFX1BSRUZJWH0ke2N1cnJlbnQucmVmZXJlbmNlTmFtZUluZGV4Kyt9YDtcbiAgICByZXR1cm4gcmVmO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGBDc3NTZWxlY3RvcmAgZ2l2ZW4gYSB0YWcgbmFtZSBhbmQgYSBtYXAgb2YgYXR0cmlidXRlc1xuICovXG5mdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3Rvcih0YWc6IHN0cmluZywgYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogQ3NzU2VsZWN0b3Ige1xuICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuXG4gIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQodGFnKTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8vIFBhcnNlIGkxOG4gbWV0YXMgbGlrZTpcbi8vIC0gXCJAQGlkXCIsXG4vLyAtIFwiZGVzY3JpcHRpb25bQEBpZF1cIixcbi8vIC0gXCJtZWFuaW5nfGRlc2NyaXB0aW9uW0BAaWRdXCJcbmZ1bmN0aW9uIHBhcnNlSTE4bk1ldGEoaTE4bj86IHN0cmluZyk6IHtkZXNjcmlwdGlvbj86IHN0cmluZywgaWQ/OiBzdHJpbmcsIG1lYW5pbmc/OiBzdHJpbmd9IHtcbiAgbGV0IG1lYW5pbmc6IHN0cmluZ3x1bmRlZmluZWQ7XG4gIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nfHVuZGVmaW5lZDtcbiAgbGV0IGlkOiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gIGlmIChpMThuKSB7XG4gICAgLy8gVE9ETyh2aWNiKTogZmlndXJlIG91dCBob3cgdG8gZm9yY2UgYSBtZXNzYWdlIElEIHdpdGggY2xvc3VyZSA/XG4gICAgY29uc3QgaWRJbmRleCA9IGkxOG4uaW5kZXhPZihJRF9TRVBBUkFUT1IpO1xuXG4gICAgY29uc3QgZGVzY0luZGV4ID0gaTE4bi5pbmRleE9mKE1FQU5JTkdfU0VQQVJBVE9SKTtcbiAgICBsZXQgbWVhbmluZ0FuZERlc2M6IHN0cmluZztcbiAgICBbbWVhbmluZ0FuZERlc2MsIGlkXSA9XG4gICAgICAgIChpZEluZGV4ID4gLTEpID8gW2kxOG4uc2xpY2UoMCwgaWRJbmRleCksIGkxOG4uc2xpY2UoaWRJbmRleCArIDIpXSA6IFtpMThuLCAnJ107XG4gICAgW21lYW5pbmcsIGRlc2NyaXB0aW9uXSA9IChkZXNjSW5kZXggPiAtMSkgP1xuICAgICAgICBbbWVhbmluZ0FuZERlc2Muc2xpY2UoMCwgZGVzY0luZGV4KSwgbWVhbmluZ0FuZERlc2Muc2xpY2UoZGVzY0luZGV4ICsgMSldIDpcbiAgICAgICAgWycnLCBtZWFuaW5nQW5kRGVzY107XG4gIH1cblxuICByZXR1cm4ge2Rlc2NyaXB0aW9uLCBpZCwgbWVhbmluZ307XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgYXJncyA9IGFyZ3Muc2xpY2UoMSk7ICAvLyBJZ25vcmUgdGhlIGxlbmd0aCBwcmVmaXggYWRkZWQgZm9yIHJlbmRlcjJcbiAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjEpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24yKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjQpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb242KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjcpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uOCkuY2FsbEZuKGFyZ3MpO1xuICB9XG4gIChhcmdzLmxlbmd0aCA+PSAxOSAmJiBhcmdzLmxlbmd0aCAlIDIgPT0gMSkgfHxcbiAgICAgIGVycm9yKGBJbnZhbGlkIGludGVycG9sYXRpb24gYXJndW1lbnQgbGVuZ3RoICR7YXJncy5sZW5ndGh9YCk7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvblYpLmNhbGxGbihbby5saXRlcmFsQXJyKGFyZ3MpXSk7XG59XG4iXX0=